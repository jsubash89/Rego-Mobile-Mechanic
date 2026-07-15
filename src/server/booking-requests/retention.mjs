export function retentionConfig(env = process.env) {
  const raw = env.BOOKING_RETENTION_DAYS ?? "90";
  if (!/^\d+$/.test(raw)) throw new Error("BOOKING_RETENTION_DAYS must be an integer from 30 through 90");
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 30 || days > 90) throw new Error("BOOKING_RETENTION_DAYS must be an integer from 30 through 90");
  return { days };
}

export async function purgeExpiredBookingRequests({ pool, retentionDays = 90, batchSize = 500, now = new Date(), dryRun = false } = {}) {
  if (!pool?.query) throw new TypeError("A PostgreSQL pool is required");
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 90) throw new RangeError("retentionDays must be between 30 and 90");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10_000) throw new RangeError("batchSize must be between 1 and 10000");
  const current = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(current.getTime())) throw new TypeError("now must be a valid date");
  const cutoff = new Date(current.getTime() - retentionDays * 86_400_000);
  if (dryRun) {
    const result = await pool.query("SELECT count(*)::int AS eligible FROM booking_requests WHERE created_at < $1", [cutoff]);
    return { dryRun: true, eligible: result.rows[0].eligible, deleted: 0, cutoff };
  }
  const result = await pool.query(`WITH expired AS (
      SELECT id FROM booking_requests WHERE created_at < $1
      ORDER BY created_at, id LIMIT $2 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM booking_requests request USING expired
    WHERE request.id = expired.id RETURNING request.id`, [cutoff, batchSize]);
  return { dryRun: false, eligible: result.rowCount, deleted: result.rowCount, cutoff };
}
