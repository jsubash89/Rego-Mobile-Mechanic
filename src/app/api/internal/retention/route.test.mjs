import assert from "node:assert/strict";
import test from "node:test";
import { createRetentionHandler } from "./route.js";

const SECRET = "c".repeat(32);
const request = (authorization) => new Request("https://example.test/api/internal/retention", { headers: { ...(authorization && { authorization }) } });

test("cron retention route fails closed for missing, weak, and wrong secrets", async () => {
  let called = false;
  for (const [env, authorization] of [[{}, undefined], [{ CRON_SECRET: "short" }, "Bearer short"], [{ CRON_SECRET: SECRET }, "Bearer wrong"]]) {
    const handler = createRetentionHandler({ pool: {}, env, purge: async () => { called = true; } });
    assert.equal((await handler(request(authorization))).status, 404);
  }
  assert.equal(called, false);
});

test("cron retention route drains multiple batches and returns generic reporting", async () => {
  const calls = [];
  const handler = createRetentionHandler({
    pool: { marker: true }, env: { CRON_SECRET: SECRET, BOOKING_RETENTION_DAYS: "90" },
    purge: async (options) => {
      calls.push(options);
      return { deleted: calls.length < 3 ? 1000 : 7 };
    },
  });
  const response = await handler(request(`Bearer ${SECRET}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deleted: 2007, batches: 3, backlogRemaining: false });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].retentionDays, 90);
  assert.equal(calls[0].batchSize, 1000);
});

test("cron retention route stops at its batch bound and reports possible backlog", async () => {
  let calls = 0;
  const handler = createRetentionHandler({
    pool: {}, env: { CRON_SECRET: SECRET }, maxBatches: 2,
    purge: async () => { calls += 1; return { deleted: 1000 }; },
  });
  const response = await handler(request(`Bearer ${SECRET}`));
  assert.deepEqual(await response.json(), { ok: true, deleted: 2000, batches: 2, backlogRemaining: true });
  assert.equal(calls, 2);
});
