import { randomBytes } from "node:crypto";

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function publicReference() {
  const bytes = randomBytes(10);
  let value = "BR_";
  for (const byte of bytes) value += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return value;
}
function json(value) { return value == null ? null : JSON.stringify(value); }

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency key was already used for a different request");
    this.name = "IdempotencyConflictError";
    this.code = "idempotency_conflict";
  }
}

export function createBookingRequestRepository({ pool, initialEventType = "booking_request_created" } = {}) {
  if (!pool?.connect) throw new TypeError("A PostgreSQL pool is required");
  return {
    async findByIdempotencyKey(idempotencyKey) {
      const result = await pool.query(`SELECT public_reference, created_at, request_fingerprint, response_summary
        FROM booking_requests WHERE idempotency_key = $1`, [idempotencyKey]);
      const row = result.rows[0];
      return row ? { publicReference: row.public_reference, createdAt: row.created_at, requestFingerprint: row.request_fingerprint, responseSummary: row.response_summary } : null;
    },
    async create(record) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(`
        INSERT INTO booking_requests (
          public_reference, idempotency_key, request_fingerprint, response_summary, status,
          customer, consented_at, consent_source, market_id, service, fulfillment, provider_preference,
          oil_option, vehicle, schedule_preference, location, estimate_snapshot, quote_required, created_at
        ) VALUES (
          $1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb,
          $13::jsonb, $14::jsonb, $15, $16::jsonb, $17::jsonb, $18, $19
        ) ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id, public_reference, created_at, request_fingerprint, response_summary
      `, [
        publicReference(), record.idempotencyKey, record.requestFingerprint, json(record.responseSummary), record.status,
        json(record.customer), record.consentedAt, record.consentSource, record.marketId, json(record.service), json(record.fulfillment),
        json(record.providerPreference), json(record.oilOption), json(record.vehicle), record.schedulePreference,
        json(record.location), json(record.estimateSnapshot), record.quoteRequired, record.createdAt,
      ]);
      let row = inserted.rows[0];
      if (row) {
        await client.query(`INSERT INTO booking_request_events
          (booking_request_id, event_type, actor_type, metadata, created_at)
          VALUES ($1, $2, 'system', '{}'::jsonb, $3)`, [row.id, initialEventType, record.createdAt]);
      } else {
        const existing = await client.query(`SELECT public_reference, created_at, request_fingerprint, response_summary
          FROM booking_requests WHERE idempotency_key = $1 FOR UPDATE`, [record.idempotencyKey]);
        row = existing.rows[0];
        if (!row) throw new Error("Idempotent booking request could not be read");
        if (row.request_fingerprint !== record.requestFingerprint) throw new IdempotencyConflictError();
      }
      await client.query("COMMIT");
      return { publicReference: row.public_reference, createdAt: row.created_at, responseSummary: row.response_summary };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } };
}
