import assert from "node:assert/strict";
import test from "node:test";
import {
  AbuseProtectionConfigurationError,
  abuseProtectionConfig,
  hashClientIdentity,
  trustedClientIdentity,
} from "./abuse-control.mjs";

const SECRET = "s".repeat(32);
const req = (headers = {}) => new Request("https://example.test", { headers });

test("production config is bounded and requires a strong HMAC secret", () => {
  for (const secret of [undefined, "short"]) {
    assert.throws(() => abuseProtectionConfig({ NODE_ENV: "production", VERCEL: "1", BOOKING_RATE_LIMIT_SECRET: secret }), AbuseProtectionConfigurationError);
  }
  for (const value of ["0", "101", "1.5", "nope"]) {
    assert.throws(() => abuseProtectionConfig({ NODE_ENV: "production", VERCEL: "1", BOOKING_RATE_LIMIT_SECRET: SECRET, BOOKING_RATE_LIMIT: value }));
  }
  assert.deepEqual(abuseProtectionConfig({ NODE_ENV: "production", VERCEL: "1", BOOKING_RATE_LIMIT_SECRET: SECRET }), {
    production: true, mode: "vercel", secret: SECRET, limit: 10, windowMs: 60_000,
  });
});

test("Vercel trusts only normalized x-vercel-forwarded-for and ignores x-forwarded-for", () => {
  const config = abuseProtectionConfig({ NODE_ENV: "production", VERCEL: "1", BOOKING_RATE_LIMIT_SECRET: SECRET });
  assert.equal(trustedClientIdentity(req({ "x-vercel-forwarded-for": "2001:DB8::1", "x-forwarded-for": "198.51.100.2" }), config), "2001:db8::1");
  for (const value of [undefined, "bad", "203.0.113.1, 198.51.100.2"]) {
    assert.throws(() => trustedClientIdentity(req({ ...(value && { "x-vercel-forwarded-for": value }), "x-forwarded-for": "203.0.113.9" }), config));
  }
});

test("non-Vercel production fails closed without an authenticated trusted-proxy contract", () => {
  assert.throws(() => abuseProtectionConfig({ NODE_ENV: "production", BOOKING_RATE_LIMIT_SECRET: SECRET }));
  const config = abuseProtectionConfig({ NODE_ENV: "production", BOOKING_RATE_LIMIT_SECRET: SECRET, BOOKING_TRUSTED_PROXY_IP_HEADER: "x-real-client-ip", BOOKING_TRUSTED_PROXY_SECRET: "p".repeat(32) });
  assert.throws(() => trustedClientIdentity(req({ "x-real-client-ip": "203.0.113.4" }), config));
  assert.equal(trustedClientIdentity(req({ "x-real-client-ip": "203.0.113.4", "x-booking-proxy-secret": "p".repeat(32) }), config), "203.0.113.4");
});

test("identity HMAC is deterministic and does not expose raw identity", () => {
  const hash = hashClientIdentity("203.0.113.7", SECRET);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash.includes("203.0.113.7"), false);
  assert.equal(hash, hashClientIdentity("203.0.113.7", SECRET));
});
