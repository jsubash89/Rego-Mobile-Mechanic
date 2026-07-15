import assert from "node:assert/strict";
import test from "node:test";
import { purgeExpiredBookingRequests, retentionConfig } from "./retention.mjs";

test("retention policy defaults to 90 days and rejects unsafe bounds", () => {
  assert.deepEqual(retentionConfig({}), { days: 90 });
  for (const value of ["29", "91", "365", "366", "90.5", "nope", ""]) assert.throws(() => retentionConfig({ BOOKING_RETENTION_DAYS: value }));
  assert.deepEqual(retentionConfig({ BOOKING_RETENTION_DAYS: "30" }), { days: 30 });
  assert.deepEqual(retentionConfig({ BOOKING_RETENTION_DAYS: "90" }), { days: 90 });
});

test("purge uses parameterized cutoff and bounded batches", async () => {
  const calls = [];
  const pool = { query: async (sql, values) => { calls.push({ sql, values }); return { rows: [], rowCount: 0 }; } };
  const now = new Date("2026-07-15T00:00:00.000Z");
  await purgeExpiredBookingRequests({ pool, retentionDays: 90, batchSize: 250, now });
  assert.match(calls[0].sql, /created_at < \$1/);
  assert.deepEqual(calls[0].values, [new Date("2026-04-16T00:00:00.000Z"), 250]);
  for (const batchSize of [0, 10_001]) await assert.rejects(() => purgeExpiredBookingRequests({ pool, batchSize }));
  await assert.rejects(() => purgeExpiredBookingRequests({ pool, retentionDays: 91 }));
});
