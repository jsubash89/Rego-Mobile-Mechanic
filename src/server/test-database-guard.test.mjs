import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeTestDatabaseUrl, UNSAFE_TEST_DATABASE_OVERRIDE } from "./test-database-guard.mjs";

test("destructive test database guard requires TEST_DATABASE_URL with a clear test database name", () => {
  assert.equal(assertSafeTestDatabaseUrl("postgresql:///rego_test", {}), "postgresql:///rego_test");
  assert.equal(assertSafeTestDatabaseUrl("postgres://localhost/js889-test-db", {}), "postgres://localhost/js889-test-db");
  for (const value of [undefined, "", "postgresql:///rego_dev", "https://localhost/rego_test"]) assert.throws(() => assertSafeTestDatabaseUrl(value, {}));
  assert.equal(assertSafeTestDatabaseUrl("postgresql:///rego_dev", { ALLOW_UNSAFE_TEST_DATABASE: UNSAFE_TEST_DATABASE_OVERRIDE }), "postgresql:///rego_dev");
  assert.throws(() => assertSafeTestDatabaseUrl("postgresql:///rego_dev", { ALLOW_UNSAFE_TEST_DATABASE: "yes" }));
});
