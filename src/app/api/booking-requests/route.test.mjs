import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler, deriveProductionRateKey, productionRatePolicy } from "./route.js";

const request = (body, key = "idem-1234567890") => new Request("http://localhost/api/booking-requests", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body: JSON.stringify(body),
});

test("POST returns 201 with service result", async () => {
  const expected = { publicReference: "BR_1234567890", status: "pending_review", createdAt: "2026-07-14T12:00:00.000Z", summary: {} };
  const handler = createPostHandler({ service: { create: async () => expected } });
  const response = await handler(request({ ok: true }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), expected);
});

test("POST maps validation failures to 400", async () => {
  const error = Object.assign(new Error("Invalid request"), { name: "BookingRequestValidationError", code: "invalid_input" });
  const handler = createPostHandler({ service: { create: async () => { throw error; } } });
  const response = await handler(request({ bad: true }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_booking_request", code: "invalid_input" });
});

test("POST rejects unsupported media, oversized streaming bodies, and rate-limit excess", async () => {
  const service = { create: async () => ({ ok: true }) };
  const handler = createPostHandler({ service, bodyLimitBytes: 16, rateLimit: { limit: 2, windowMs: 1000 }, now: () => 0 });
  const wrong = await handler(new Request("http://localhost", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }));
  assert.equal(wrong.status, 415);
  const large = await handler(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "idem-1234567890" }, body: JSON.stringify({ value: "x".repeat(100) }) }));
  assert.equal(large.status, 413);

  const roomy = createPostHandler({ service, rateLimit: { limit: 1, windowMs: 1000 }, now: () => 0 });
  assert.equal((await roomy(request({ ok: true }))).status, 201);
  assert.equal((await roomy(request({ ok: true }, "idem-1234567891"))).status, 429);
});

test("POST maps idempotency conflict to 409 and emits safe correlation telemetry", async () => {
  const logs = [];
  const error = Object.assign(new Error("secret"), { name: "IdempotencyConflictError", code: "idempotency_conflict" });
  const handler = createPostHandler({ service: { create: async () => { throw error; } }, logger: { error: (...args) => logs.push(args) }, correlationId: () => "corr_123" });
  const response = await handler(request({ ok: true }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "idempotency_conflict", correlationId: "corr_123" });
  assert.equal(JSON.stringify(logs).includes("secret"), false);
});

test("POST returns generic DB failure and logs no request payload PII", async () => {
  const logs = [];
  const handler = createPostHandler({
    service: { create: async () => { throw new Error("db exploded for ada@example.com"); } },
    logger: { error: (...args) => logs.push(args) },
  });
  const response = await handler(request({ email: "ada@example.com", address: "123 Main St" }));
  assert.equal(response.status, 503);
  const failureBody = await response.json();
  assert.equal(failureBody.error, "booking_request_unavailable");
  assert.match(failureBody.correlationId, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.stringify(logs).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(logs).includes("123 Main St"), false);
});

test("production rate keys trust only Vercel-controlled client IP and normalize safely", () => {
  const vercelRequest = (value, extra = {}) => new Request("http://localhost", { headers: { "x-vercel-forwarded-for": value, ...extra } });
  assert.equal(deriveProductionRateKey(vercelRequest("203.0.113.7"), { vercel: true }), "client:203.0.113.7");
  assert.equal(deriveProductionRateKey(vercelRequest("2001:DB8::1"), { vercel: true }), "client:2001:db8::1");
  assert.equal(deriveProductionRateKey(vercelRequest("bad,203.0.113.7"), { vercel: true }), "vercel:malformed-client-ip");
  assert.equal(deriveProductionRateKey(vercelRequest("203.0.113.7", { "x-forwarded-for": "198.51.100.4" }), { vercel: false }), "global:circuit-breaker");
});

test("non-Vercel production policy is a high global circuit breaker, not the old shared 60/min bucket", async () => {
  const policy = productionRatePolicy({ vercel: false });
  assert.ok(policy.rateLimit.limit >= 10_000);
  const handler = createPostHandler({ service: { create: async () => ({ ok: true }) }, ...policy, now: () => 0 });
  for (let index = 0; index < 61; index += 1) {
    assert.equal((await handler(request({ index }, `global-circuit-${index}`))).status, 201);
  }
});
