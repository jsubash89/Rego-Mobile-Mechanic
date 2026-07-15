import assert from "node:assert/strict";
import test from "node:test";

import { createPostHandler } from "./route.js";

const allowLimiter = { consume: async () => ({ allowed: true, retryAfter: 1 }) };

const request = (body, key = "idem-1234567890") => new Request("http://localhost/api/booking-requests", {
  method: "POST",
  headers: { "content-type": "application/json", "idempotency-key": key },
  body: JSON.stringify(body),
});

test("POST returns 201 with service result", async () => {
  const expected = { publicReference: "BR_1234567890", status: "pending_review", createdAt: "2026-07-14T12:00:00.000Z", summary: {} };
  const handler = createPostHandler({ service: { create: async () => expected }, rateLimiter: allowLimiter });
  const response = await handler(request({ ok: true }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), expected);
});

test("POST maps validation failures to 400", async () => {
  const error = Object.assign(new Error("Invalid request"), { name: "BookingRequestValidationError", code: "invalid_input" });
  const handler = createPostHandler({ service: { create: async () => { throw error; } }, rateLimiter: allowLimiter });
  const response = await handler(request({ bad: true }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_booking_request", code: "invalid_input" });
});

test("POST rejects unsupported media, oversized streaming bodies, and maps distributed rate-limit excess", async () => {
  const service = { create: async () => ({ ok: true }) };
  const largeHandler = createPostHandler({ service, rateLimiter: allowLimiter, bodyLimitBytes: 16 });
  const wrong = await largeHandler(new Request("http://localhost", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }));
  assert.equal(wrong.status, 415);
  const large = await largeHandler(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "idem-1234567890" }, body: JSON.stringify({ value: "x".repeat(100) }) }));
  assert.equal(large.status, 413);

  let count = 0;
  const handler = createPostHandler({ service, rateLimiter: { consume: async () => ({ allowed: ++count <= 1, retryAfter: 60 }) } });
  assert.equal((await handler(request({ ok: true }))).status, 201);
  const limited = await handler(request({ ok: true }, "idem-1234567891"));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("POST maps idempotency conflict to 409 and emits safe correlation telemetry", async () => {
  const logs = [];
  const error = Object.assign(new Error("secret"), { name: "IdempotencyConflictError", code: "idempotency_conflict" });
  const handler = createPostHandler({ service: { create: async () => { throw error; } }, rateLimiter: allowLimiter, logger: { error: (...args) => logs.push(args) }, correlationId: () => "corr_123" });
  const response = await handler(request({ ok: true }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "idempotency_conflict", correlationId: "corr_123" });
  assert.equal(JSON.stringify(logs).includes("secret"), false);
});

test("POST returns generic DB failure and logs no request payload PII", async () => {
  const logs = [];
  const handler = createPostHandler({
    service: { create: async () => { throw new Error("db exploded for ada@example.com"); } },
    rateLimiter: allowLimiter,
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

test("POST handler fails closed when no limiter is injected", () => {
  assert.throws(() => createPostHandler({ service: { create: async () => ({ ok: true }) } }), /distributed rate limiter/i);
});

test("POST fails closed before persistence when distributed protection is unavailable", async () => {
  let persisted = false;
  const logs = [];
  const handler = createPostHandler({
    service: { create: async () => { persisted = true; } },
    rateLimiter: { consume: async () => { throw new Error("raw private detail"); } },
    logger: { error: (...args) => logs.push(args) },
    correlationId: () => "safe-correlation",
  });
  const response = await handler(request({ ok: true }));
  assert.equal(response.status, 503);
  assert.equal(persisted, false);
  assert.equal(JSON.stringify(logs).includes("raw private detail"), false);
});
