export const UNSAFE_TEST_DATABASE_OVERRIDE = "JS889_ONE_OFF_ALLOW_DESTRUCTIVE_TESTS";

export function assertSafeTestDatabaseUrl(value, env = process.env) {
  if (typeof value !== "string" || !value.trim()) throw new Error("TEST_DATABASE_URL is required; DATABASE_URL is never a test fallback");
  let databaseName;
  try {
    const url = new URL(value);
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("protocol");
    databaseName = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!/test/i.test(databaseName) && env.ALLOW_UNSAFE_TEST_DATABASE !== UNSAFE_TEST_DATABASE_OVERRIDE) {
    throw new Error("Destructive tests require a database name containing 'test'; set the documented one-off override only after manual verification");
  }
  return value;
}
