import test from "node:test";
import assert from "node:assert/strict";
import { cookieValue, operatorConfig, issueSession, verifySession, verifyOrigin } from "./auth.mjs";

const env = { NODE_ENV: "test", OPERATOR_SHARED_SECRET: "o".repeat(32), OPERATOR_SESSION_SECRET: "s".repeat(32), OPERATOR_RATE_LIMIT_SECRET: "r".repeat(32), OPERATOR_CANONICAL_ORIGIN: "https://rego.test" };
test("operator config rejects weak, reused secrets, and invalid canonical origins", () => {
  assert.throws(() => operatorConfig({ ...env, OPERATOR_SHARED_SECRET: "short" }));
  assert.throws(() => operatorConfig({ ...env, OPERATOR_SESSION_SECRET: "o".repeat(32) }));
  for (const origin of [undefined, "https://rego.test/", "https://user@rego.test", "https://rego.test/path", "javascript:alert(1)"]) assert.throws(() => operatorConfig({ ...env, OPERATOR_CANONICAL_ORIGIN: origin }));
  assert.doesNotThrow(() => operatorConfig(env));
});
test("signed high-entropy session expires, rejects tampering and malformed values", () => {
  const config = operatorConfig(env); const token = issueSession(config, 1_000); const value = verifySession(token, config, 1_001);
  assert.match(value.sid, /^[A-Za-z0-9_-]{43}$/); assert.equal(value.exp, 1_000 + 8 * 60 * 60);
  for (const invalid of [`${token}x`, "", ".", "abc.def.ghi", "%E0%A4%A"]) assert.equal(verifySession(invalid, config, 1_001), null);
  assert.equal(verifySession(token, config, 1_000 + 8 * 60 * 60 + 1), null);
  assert.equal(cookieValue(new Request("https://rego.test", { headers: { cookie: "rego_operator=%E0%A4%A" } })), null);
});
test("mutation origin uses only canonical config and ignores forwarded-host forgery", () => {
  const config = operatorConfig(env);
  assert.equal(verifyOrigin(new Request("https://internal.test/operator/api/logout", { method: "POST", headers: { origin: "https://rego.test", "x-forwarded-host": "evil.test" } }), config), true);
  assert.equal(verifyOrigin(new Request("https://rego.test/operator/api/logout", { method: "POST", headers: { origin: "https://evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" } }), config), false);
  assert.equal(verifyOrigin(new Request("https://rego.test/operator/api/logout", { method: "POST" }), config), false);
});
