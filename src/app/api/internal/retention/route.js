import { timingSafeEqual } from "node:crypto";
import { getDatabasePool } from "../../../../server/database.mjs";
import { purgeExpiredBookingRequests, retentionConfig } from "../../../../server/booking-requests/retention.mjs";

export const runtime = "nodejs";

function authorized(request, secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) return false;
  const actual = request.headers.get("authorization");
  const expected = `Bearer ${secret}`;
  if (typeof actual !== "string") return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createRetentionHandler({ pool, env = process.env, purge = purgeExpiredBookingRequests, maxBatches = 50 } = {}) {
  if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 50) throw new TypeError("maxBatches must be between 1 and 50");
  return async function GET(request) {
    if (!authorized(request, env.CRON_SECRET)) return Response.json({ error: "not_found" }, { status: 404 });
    try {
      const { days } = retentionConfig(env);
      const batchSize = 1000;
      let deleted = 0;
      let batches = 0;
      let lastBatchDeleted = batchSize;
      while (batches < maxBatches && lastBatchDeleted === batchSize) {
        const result = await purge({ pool, retentionDays: days, batchSize });
        lastBatchDeleted = result.deleted;
        deleted += lastBatchDeleted;
        batches += 1;
      }
      return Response.json({ ok: true, deleted, batches, backlogRemaining: batches === maxBatches && lastBatchDeleted === batchSize });
    } catch {
      return Response.json({ error: "retention_unavailable" }, { status: 503 });
    }
  };
}

export async function GET(request) {
  return createRetentionHandler({ pool: getDatabasePool() })(request);
}
