import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import pg from "pg";

import { createPostHandler } from "../../app/api/booking-requests/route.js";
import { runMigrations } from "../../../scripts/migrate.mjs";
import { createBookingRequestService } from "./booking-request.mjs";
import { createBookingRequestRepository, IdempotencyConflictError } from "./repository.mjs";
import { createPostgresRateLimiter } from "../abuse-control.mjs";
import { purgeExpiredBookingRequests } from "./retention.mjs";
import { assertSafeTestDatabaseUrl } from "../test-database-guard.mjs";

if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
const { Pool } = pg;
const connectionString = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);

async function withDatabase(t, callback) {
  const schema = `js889_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString, max: 2 });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  });
  await callback({ pool, schema });
}
function record(suffix = "one") {
  return {
    idempotencyKey: `js889-${suffix}-1234567890`, requestFingerprint: "a".repeat(64), status: "new",
    responseSummary: { customerName: "Integration Customer", serviceName: "Check-engine diagnostic", fulfillmentLabel: "Mobile mechanic", vehicle: "2020 Honda Accord", quoteRequired: false },
    customer: { name: "Integration Customer", email: null, phone: ["+1", "312", "555", "0199"].join("") },
    consentedAt: new Date("2026-07-14T12:00:00.000Z"), consentSource: "booking_request_form", marketId: "chicago",
    service: { id: "diagnostic", name: "Check-engine diagnostic" }, fulfillment: { id: "mobile", label: "Mobile mechanic" },
    providerPreference: null, oilOption: null, vehicle: { year: 2020, make: "Honda", model: "Accord", vinSuffix: "88K921" },
    schedulePreference: "Tomorrow afternoon", location: { type: "driveway", address: "123 Main St, Chicago, IL", postalCode: "60601", notes: null },
    estimateSnapshot: { source: "server_catalog", currency: "USD", total: 102 }, quoteRequired: false,
    createdAt: new Date("2026-07-14T12:00:00.000Z"),
  };
}
async function counts(pool, key) {
  const result = await pool.query(`SELECT count(DISTINCT r.id)::int AS requests, count(e.id)::int AS events
    FROM booking_requests r LEFT JOIN booking_request_events e ON e.booking_request_id = r.id WHERE r.idempotency_key = $1`, [key]);
  return result.rows[0];
}


test("fresh migration is serialized, checksummed, and creates required integrity constraints", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await Promise.all([runMigrations({ pool }), runMigrations({ pool }), runMigrations({ pool })]);
    const migrations = await pool.query("SELECT name, checksum FROM schema_migrations");
    assert.equal(migrations.rowCount, 4);
    for (const migration of migrations.rows) assert.match(migration.checksum, /^[a-f0-9]{64}$/);
    const checksumColumn = await pool.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'schema_migrations' AND column_name = 'checksum'");
    assert.equal(checksumColumn.rows[0].is_nullable, "NO");
    const constraints = await pool.query(`SELECT contype FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
      WHERE r.relname IN ('booking_requests','booking_request_events')`);
    for (const type of ["p", "u", "f", "c"]) assert.ok(constraints.rows.some((row) => row.contype === type));
    await pool.query("UPDATE schema_migrations SET checksum = $1", ["0".repeat(64)]);
    await assert.rejects(() => runMigrations({ pool }), /checksum mismatch/);
  });
});

test("migration 003 fails closed when legacy rows violate the 002 postal constraint", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    const directory = await mkdtemp(path.join(tmpdir(), "js889-migration-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const migrationName = "001_create_booking_requests.sql";
    const sql = await readFile(new URL(`../../../migrations/${migrationName}`, import.meta.url), "utf8");
    await writeFile(path.join(directory, migrationName), sql);
    await runMigrations({ pool, migrationsDirectory: directory });
    const legacy = record(randomUUID());
    legacy.location.postalCode = "48201";
    await createBookingRequestRepository({ pool }).create(legacy);
    await assert.rejects(() => runMigrations({ pool }), /booking_requests_location_chicago_postal_code/);
    const applied = await pool.query("SELECT name FROM schema_migrations WHERE name = '003_privacy_retention_and_abuse_control.sql'");
    assert.equal(applied.rowCount, 0);
  });
});

test("migration runner fails closed for legacy NULL or blank applied checksums", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    for (const value of [null, ""]) {
      await pool.query("DROP TABLE IF EXISTS schema_migrations");
      await pool.query("CREATE TABLE schema_migrations (name text PRIMARY KEY, checksum char(64), applied_at timestamptz NOT NULL DEFAULT now())");
      await pool.query("INSERT INTO schema_migrations (name, checksum) VALUES ('001_create_booking_requests.sql', $1)", [value]);
      await assert.rejects(() => runMigrations({ pool }), /missing checksum/i);
      const row = await pool.query("SELECT checksum FROM schema_migrations");
      assert.equal(row.rows[0].checksum?.trim() ?? null, value);
    }
  });
});

test("repository returns fully equivalent stored response sequentially and concurrently without duplicate rows/events", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const repository = createBookingRequestRepository({ pool });
    const input = record(randomUUID());
    const first = await repository.create(input);
    const second = await repository.create({ ...input, createdAt: new Date("2030-01-01") });
    assert.deepEqual(second, first);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => repository.create(input)));
    for (const result of concurrent) assert.deepEqual(result, first);
    assert.deepEqual(await counts(pool, input.idempotencyKey), { requests: 1, events: 1 });
    await assert.rejects(() => repository.create({ ...input, requestFingerprint: "b".repeat(64) }), IdempotencyConflictError);
    assert.deepEqual(await counts(pool, input.idempotencyKey), { requests: 1, events: 1 });
  });
});

test("handler through validation/service persists trusted estimate and replays full safe response", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const service = createBookingRequestService({ repository: createBookingRequestRepository({ pool }), now: () => new Date("2026-07-14T12:00:00Z") });
    const handler = createPostHandler({ service, rateLimiter: { consume: async () => ({ allowed: true, retryAfter: 1 }) } });
    const payload = {
      customer: { name: "Ada Lovelace", email: "ada@example.com", phone: "+1 312 555 0199" },
      consent: { accepted: true, source: "booking_request_form" }, marketId: "chicago", serviceId: "diagnostic", fulfillmentId: "mobile", providerPreferenceId: "maria",
      vehicle: { year: 2020, make: "Subaru", model: "Outback", vinSuffix: "H4P220" }, schedulePreference: "Weekday mornings",
      location: { type: "driveway", address: "123 Main St, Chicago, IL", postalCode: "60601", notes: null },
    };
    const makeRequest = () => new Request("http://localhost/api/booking-requests", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "e2e-idempotency-123" }, body: JSON.stringify(payload) });
    const firstResponse = await handler(makeRequest());
    const secondResponse = await handler(makeRequest());
    assert.equal(firstResponse.status, 201);
    assert.deepEqual(await secondResponse.json(), await firstResponse.json());
    const stored = await pool.query("SELECT estimate_snapshot, quote_required, customer FROM booking_requests");
    assert.deepEqual(stored.rows[0].estimate_snapshot, { source: "server_catalog", currency: "USD", total: 102 });
    assert.equal(stored.rows[0].quote_required, false);
    assert.equal(stored.rows[0].customer.phone, "+13125550199");
    assert.deepEqual(await counts(pool, "e2e-idempotency-123"), { requests: 1, events: 1 });
  });
});

test("database constraints reject direct invalid contact, VIN, status, JSON and estimate writes", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const good = record(randomUUID());
    const repository = createBookingRequestRepository({ pool });
    await repository.create(good);
    const id = (await pool.query("SELECT id FROM booking_requests")).rows[0].id;
    for (const [sql, values] of [
      ["UPDATE booking_requests SET customer = $1::jsonb WHERE id = $2", [JSON.stringify({ name: "X", email: null, phone: null }), id]],
      ["UPDATE booking_requests SET vehicle = vehicle || $1::jsonb WHERE id = $2", [JSON.stringify({ vin: "1HGCM82633A004352" }), id]],
      ["UPDATE booking_requests SET status = $1 WHERE id = $2", ["approved", id]],
      ["UPDATE booking_requests SET service = $1::jsonb WHERE id = $2", [JSON.stringify({}), id]],
      ["UPDATE booking_requests SET response_summary = $1::jsonb WHERE id = $2", [JSON.stringify({ customerName: "X" }), id]],
      ["UPDATE booking_requests SET estimate_snapshot = $1::jsonb WHERE id = $2", [JSON.stringify({ source: "server_catalog", currency: "USD", total: -1 }), id]],
    ]) await assert.rejects(() => pool.query(sql, values), /constraint/i);
  });
});

test("migration 004 enforces address/postal consistency and adds the purge index", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const repository = createBookingRequestRepository({ pool });
    const mismatch = record(randomUUID());
    mismatch.location.address = "123 Main St, Chicago, IL 60699";
    await assert.rejects(() => repository.create(mismatch), /booking_requests_location_postal_code_consistent/);
    const matching = record(randomUUID());
    matching.location.address = "123 Main St, Chicago, IL 60601-1234";
    await repository.create(matching);
    const index = await pool.query("SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'booking_requests_created_at_id_idx'");
    assert.equal(index.rowCount, 1);
    assert.match(index.rows[0].indexdef, /\(created_at, id\)/i);
  });
});

test("event failure rolls back request creation", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const repository = createBookingRequestRepository({ pool, initialEventType: null });
    const input = record(randomUUID());
    await assert.rejects(() => repository.create(input));
    assert.deepEqual(await counts(pool, input.idempotencyKey), { requests: 0, events: 0 });
  });
});

test("PostgreSQL limiter is atomic across concurrent callers, resets windows, and stores no raw IP", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    let current = new Date("2026-07-15T12:00:00.000Z");
    const config = { mode: "vercel", secret: "r".repeat(32), limit: 10, windowMs: 60_000 };
    const limiter = createPostgresRateLimiter({ pool, config, now: () => current });
    const request = new Request("https://example.test", { headers: { "x-vercel-forwarded-for": "203.0.113.77", "x-forwarded-for": "198.51.100.9" } });
    const concurrent = await Promise.all(Array.from({ length: 14 }, () => limiter.consume(request)));
    assert.equal(concurrent.filter((result) => result.allowed).length, 10);
    assert.equal(concurrent.filter((result) => !result.allowed).length, 4);
    const stored = await pool.query("SELECT identity_hash, request_count FROM booking_rate_limit_windows");
    assert.equal(stored.rowCount, 1);
    assert.match(stored.rows[0].identity_hash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(stored.rows).includes("203.0.113.77"), false);
    assert.equal(stored.rows[0].request_count, 11);
    current = new Date("2026-07-15T12:01:00.000Z");
    assert.equal((await limiter.consume(request)).allowed, true);
  });
});

test("90-day purge deletes all old statuses in safe batches and cascades events", async (t) => {
  await withDatabase(t, async ({ pool }) => {
    await runMigrations({ pool });
    const repository = createBookingRequestRepository({ pool });
    const old = record(`old-${randomUUID()}`);
    old.createdAt = new Date("2026-04-15T11:59:59.000Z");
    old.consentedAt = old.createdAt;
    const boundary = record(`boundary-${randomUUID()}`);
    boundary.createdAt = new Date("2026-04-16T12:00:00.000Z");
    boundary.consentedAt = boundary.createdAt;
    await repository.create(old);
    await repository.create(boundary);
    const dry = await purgeExpiredBookingRequests({ pool, retentionDays: 90, now: new Date("2026-07-15T12:00:00.000Z"), dryRun: true });
    assert.equal(dry.eligible, 1);
    const result = await purgeExpiredBookingRequests({ pool, retentionDays: 90, batchSize: 1, now: new Date("2026-07-15T12:00:00.000Z") });
    assert.equal(result.deleted, 1);
    assert.deepEqual(await counts(pool, old.idempotencyKey), { requests: 0, events: 0 });
    assert.deepEqual(await counts(pool, boundary.idempotencyKey), { requests: 1, events: 1 });
  });
});
