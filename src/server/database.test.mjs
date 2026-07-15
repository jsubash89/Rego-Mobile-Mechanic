import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolOptions } from "./database.mjs";

test("database pool configuration is bounded and serverless hardened", () => {
  for (const value of ["0", "-1", "1.5", "abc", "21"]) {
    assert.throws(() => databasePoolOptions({ DATABASE_URL: "postgresql://localhost/x", DATABASE_POOL_MAX: value }));
  }
  const options = databasePoolOptions({ DATABASE_URL: "postgresql://localhost/x", DATABASE_POOL_MAX: "4" });
  assert.equal(options.max, 4);
  assert.ok(options.connectionTimeoutMillis > 0);
  assert.ok(options.idleTimeoutMillis > 0);
  assert.ok(options.statement_timeout > 0);
  assert.ok(options.query_timeout >= options.statement_timeout);
  assert.throws(() => databasePoolOptions({}));
});
