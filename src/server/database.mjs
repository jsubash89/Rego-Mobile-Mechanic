import pg from "pg";

const { Pool } = pg;
const globalKey = Symbol.for("rego.postgres.pool");

export function databasePoolOptions(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const rawMax = env.DATABASE_POOL_MAX ?? "5";
  if (!/^\d+$/.test(rawMax)) throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20");
  const max = Number(rawMax);
  if (max < 1 || max > 20) throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20");
  return {
    connectionString: env.DATABASE_URL,
    max,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 10_000,
    statement_timeout: 8_000,
    idle_in_transaction_session_timeout: 5_000,
    allowExitOnIdle: true,
  };
}

export function getDatabasePool() {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Pool(databasePoolOptions());
    globalThis[globalKey].on("error", (error) => {
      const sqlstateClass = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code.slice(0, 2) : undefined;
      console.error("postgres_pool_idle_error", { category: "database", ...(sqlstateClass && { sqlstateClass }) });
    });
  }
  return globalThis[globalKey];
}
