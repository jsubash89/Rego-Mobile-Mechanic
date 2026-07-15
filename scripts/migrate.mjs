import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultMigrationsDirectory = path.join(root, "migrations");
const MIGRATION_LOCK_ID = "487531982441";
function checksum(sql) { return createHash("sha256").update(sql).digest("hex"); }

export async function runMigrations({ pool, migrationsDirectory = defaultMigrationsDirectory } = {}) {
  if (!pool?.connect) throw new TypeError("A PostgreSQL pool is required");
  const names = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const files = await Promise.all(names.map(async (name) => {
    const sql = await readFile(path.join(migrationsDirectory, name), "utf8");
    return { name, sql, checksum: checksum(sql) };
  }));
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)");
    const missingChecksums = await client.query("SELECT name FROM schema_migrations WHERE checksum IS NULL OR btrim(checksum) = '' LIMIT 1");
    if (missingChecksums.rowCount) throw new Error(`Applied migration has missing checksum: ${missingChecksums.rows[0].name}`);
    await client.query("ALTER TABLE schema_migrations ALTER COLUMN checksum SET NOT NULL");
    for (const migration of files) {
      const applied = await client.query("SELECT checksum FROM schema_migrations WHERE name = $1", [migration.name]);
      if (applied.rowCount) {
        const stored = applied.rows[0].checksum;
        if (stored !== migration.checksum) throw new Error(`Applied migration checksum mismatch: ${migration.name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try { await runMigrations({ pool }); console.log("Database migrations complete"); }
  finally { await pool.end(); }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => { console.error("Database migration failed"); process.exitCode = 1; });
}
