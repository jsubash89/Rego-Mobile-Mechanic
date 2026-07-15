import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { runMigrations } from "../../../scripts/migrate.mjs";
import { assertSafeTestDatabaseUrl } from "../test-database-guard.mjs";
import { authenticateToken, issueSession, loginAtomically, operatorConfig, persistSession, revokeSession, sessionHash } from "./auth.mjs";
import { createOperatorQueueRepository, OperatorQueueError } from "./repository.mjs";
import { createBookingRequestRepository } from "../booking-requests/repository.mjs";
const { Pool } = pg;
const connectionString = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const env = { NODE_ENV: "test", OPERATOR_SHARED_SECRET: "o".repeat(32), OPERATOR_SESSION_SECRET: "s".repeat(32), OPERATOR_RATE_LIMIT_SECRET: "r".repeat(32), OPERATOR_CANONICAL_ORIGIN: "https://rego.test" };
async function withDatabase(t, callback) {
  const schema = `operator_${randomUUID().replaceAll("-", "")}`; const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA "${schema}"`); const pool = new Pool({ connectionString, max: 12, options: `-c search_path=${schema}` });
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); });
  await runMigrations({ pool }); await callback(pool);
}
function booking() { const id = randomUUID(); return { idempotencyKey: `operator-${id}`, requestFingerprint: "a".repeat(64), status: "pending_review", responseSummary: { customerName: "Private Person", serviceName: "Diagnostic", fulfillmentLabel: "Mobile", vehicle: "Car", quoteRequired: false }, customer: { name: "Private Person", email: "private@example.test", phone: null }, consentedAt: new Date(), consentSource: "booking_request_form", marketId: "chicago", service: { id: "diagnostic", name: "Diagnostic" }, fulfillment: { id: "mobile", label: "Mobile" }, providerPreference: null, oilOption: null, vehicle: { year: 2020, make: "Honda", model: "Civic", vinSuffix: "123456" }, schedulePreference: "Arbitrary private free text", location: { type: "driveway", address: "123 Main St, Chicago, IL", postalCode: "60601", notes: "private note" }, estimateSnapshot: { source: "server_catalog", currency: "USD", total: 100 }, quoteRequired: false, createdAt: new Date() }; }

test("migration 006 enforces hashed, fixed-actor, eight-hour sessions with cleanup indexes", async (t) => withDatabase(t, async (pool) => {
  const columns = await pool.query("SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='operator_sessions'");
  assert.deepEqual(columns.rows.map((r) => r.column_name).sort(), ["actor", "expires_at", "issued_at", "revoked_at", "session_hash"]);
  assert.equal(columns.rows.find((r) => r.column_name === "session_hash").is_nullable, "NO");
  const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='operator_sessions'"); assert.ok(indexes.rowCount >= 3);
  await assert.rejects(() => pool.query(`INSERT INTO operator_sessions(session_hash,actor,issued_at,expires_at) VALUES($1,'attacker',now(),now()+interval '1 hour')`, ["c".repeat(64)]));
  await assert.rejects(() => pool.query(`INSERT INTO operator_sessions(session_hash,issued_at,expires_at) VALUES($1,now(),now()+interval '9 hours')`, ["d".repeat(64)]));
}));

test("concurrent invalid logins atomically allow only five comparisons and success resets failures", async (t) => withDatabase(t, async (pool) => {
  const config = operatorConfig(env); const identity = "f".repeat(64);
  const results = await Promise.all(Array.from({ length: 20 }, () => loginAtomically({ pool, identity, candidate: "wrong", config })));
  assert.equal(results.filter((r) => r.status === "invalid").length, 5); assert.equal(results.filter((r) => r.status === "rate_limited").length, 15);
  await pool.query("DELETE FROM operator_login_rate_limit_windows");
  assert.equal((await loginAtomically({ pool, identity, candidate: config.sharedSecret, config })).status, "ok");
  assert.equal((await pool.query("SELECT count(*)::int count FROM operator_login_rate_limit_windows WHERE identity_hash=$1", [identity])).rows[0].count, 0);
}));

test("server session revocation defeats copied-cookie replay and stores no bearer ID", async (t) => withDatabase(t, async (pool) => {
  const config = operatorConfig(env), token = issueSession(config); const client = await pool.connect();
  try { await persistSession(client, token, config); } finally { client.release(); }
  assert.ok(await authenticateToken(token, config, pool));
  const request = new Request("https://rego.test/operator/api/logout", { headers: { cookie: `rego_operator=${encodeURIComponent(token)}` } });
  assert.equal(await revokeSession(request, config, pool), true); assert.equal(await authenticateToken(token, config, pool), null);
  const rows = await pool.query("SELECT session_hash FROM operator_sessions"); assert.equal(rows.rows[0].session_hash, sessionHash(JSON.parse(Buffer.from(token.split('.')[0], 'base64url')).sid)); assert.equal(JSON.stringify(rows.rows).includes(token), false);
}));

test("masked list omits schedule text; each successful detail reveal is minimal and atomic", async (t) => withDatabase(t, async (pool) => {
  const input = booking(); await createBookingRequestRepository({ pool }).create(input); const id = (await pool.query("SELECT id FROM booking_requests WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0].id;
  const repo = createOperatorQueueRepository({ pool }); const list = await repo.list();
  assert.equal(JSON.stringify(list).includes(input.schedulePreference), false); assert.equal(list.items[0].hasSchedulePreference, true);
  assert.equal((await pool.query("SELECT count(*)::int count FROM booking_request_events WHERE event_type='operator_pii_revealed'")).rows[0].count, 0);
  const pseudonym = "b".repeat(64); await repo.detail(id, pseudonym); await repo.detail(id, pseudonym);
  const events = await pool.query("SELECT metadata FROM booking_request_events WHERE event_type='operator_pii_revealed'"); assert.equal(events.rowCount, 2);
  for (const row of events.rows) { assert.deepEqual(Object.keys(row.metadata).sort(), ["actor", "sessionPseudonym"]); assert.equal(JSON.stringify(row.metadata).includes("private"), false); }
  await assert.rejects(() => repo.detail(randomUUID(), null), OperatorQueueError);
}));

test("concurrent status transitions produce one update and exactly one audit event", async (t) => withDatabase(t, async (pool) => {
  const input = booking(); await createBookingRequestRepository({ pool }).create(input); const id = (await pool.query("SELECT id FROM booking_requests WHERE idempotency_key=$1", [input.idempotencyKey])).rows[0].id; const repo = createOperatorQueueRepository({ pool });
  const settled = await Promise.allSettled(Array.from({ length: 8 }, () => repo.transition(id, { currentStatus: "pending_review", version: 0, newStatus: "contacted", reason: "Customer contacted" })));
  assert.equal(settled.filter((r) => r.status === "fulfilled").length, 1); assert.ok(settled.filter((r) => r.status === "rejected").every((r) => r.reason.code === "conflict"));
  assert.equal((await pool.query("SELECT count(*)::int count FROM booking_request_events WHERE booking_request_id=$1 AND event_type='operator_status_transition'", [id])).rows[0].count, 1);
}));
