import pg from "pg";
import { purgeExpiredBookingRequests, retentionConfig } from "../src/server/booking-requests/retention.mjs";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is explicitly required");
  const execute = process.argv.includes("--execute");
  const batchArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const batchSize = batchArg ? Number(batchArg.split("=", 2)[1]) : 500;
  const { days } = retentionConfig(process.env);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    if (!execute) {
      const report = await purgeExpiredBookingRequests({ pool, retentionDays: days, batchSize, dryRun: true });
      console.log(JSON.stringify({ mode: "dry-run", eligible: report.eligible, retentionDays: days }));
      return;
    }
    let deleted = 0;
    while (true) {
      const report = await purgeExpiredBookingRequests({ pool, retentionDays: days, batchSize });
      deleted += report.deleted;
      if (report.deleted < batchSize) break;
    }
    console.log(JSON.stringify({ mode: "execute", deleted, retentionDays: days }));
  } finally { await pool.end(); }
}

main().catch(() => { console.error("Booking retention purge failed"); process.exitCode = 1; });
