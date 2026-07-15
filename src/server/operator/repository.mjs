const STATUSES = new Set(["pending_review", "contacted", "accepted", "rejected", "cancelled"]);
const TERMINAL = new Set(["accepted", "rejected", "cancelled"]);
const ALLOWED = { pending_review: new Set(["contacted", "cancelled"]), contacted: new Set(["accepted", "rejected", "cancelled"]) };
export class OperatorQueueError extends Error { constructor(code) { super(code); this.name = "OperatorQueueError"; this.code = code; } }
function safeId(value) { return typeof value === "string" && /^[a-z0-9_-]{1,64}$/.test(value) ? value : null; }
function maskEmail(value) { if (!value) return null; const [local, domain] = value.split("@"); return domain ? `${local.slice(0, 1)}***@${domain}` : "***"; }
function maskPhone(value) { return value ? `••• ••• ${value.replace(/\D/g, "").slice(-4)}` : null; }
function maskAddress(value) { if (!value) return null; const postal = value.match(/\b\d{5}\b/)?.[0]; return postal ? `Chicago, IL ${postal}` : "Chicago, IL"; }
function projected(row) { return {
  id: row.id, reference: row.public_reference, status: row.status, version: row.version,
  service: row.service, fulfillment: row.fulfillment, hasSchedulePreference: row.has_schedule_preference,
  quoteStatus: row.quote_required ? "Quote required" : "Estimate available", createdAt: row.created_at,
  contact: row.customer?.email ? maskEmail(row.customer.email) : maskPhone(row.customer?.phone),
  address: maskAddress(row.location?.address), vinSuffix: row.vehicle?.vinSuffix || null,
}; }
export function createOperatorQueueRepository({ pool }) {
  if (!pool?.query || !pool?.connect) throw new TypeError("A PostgreSQL pool is required");
  return {
    async list(input = {}) {
      const page = Math.max(1, Math.min(100000, Number.parseInt(input.page, 10) || 1));
      const pageSize = Math.max(1, Math.min(50, Number.parseInt(input.pageSize, 10) || 20));
      const status = STATUSES.has(input.status) ? input.status : null;
      const service = safeId(input.service); const fulfillment = safeId(input.fulfillment);
      const result = await pool.query(`SELECT id, public_reference, status, version, service, fulfillment, (schedule_preference IS NOT NULL) AS has_schedule_preference,
        quote_required, created_at, customer, location, vehicle, count(*) OVER()::int AS total
        FROM booking_requests
        WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR service->>'id' = $2)
          AND ($3::text IS NULL OR fulfillment->>'id' = $3)
        ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`, [status, service, fulfillment, pageSize, (page - 1) * pageSize]);
      return { items: result.rows.map(projected), page, pageSize, total: result.rows[0]?.total ?? 0 };
    },
    async detail(id, sessionPseudonym) {
      if (!/^[a-f0-9]{64}$/.test(sessionPseudonym ?? "")) throw new OperatorQueueError("invalid_session");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query(`SELECT id, public_reference, status, version, customer, service, fulfillment, vehicle,
          schedule_preference, location, estimate_snapshot, quote_required, created_at
          FROM booking_requests WHERE id = $1 FOR SHARE`, [id]);
        const row = result.rows[0];
        if (!row) { await client.query("COMMIT"); return null; }
        await client.query(`INSERT INTO booking_request_events(booking_request_id,event_type,actor_type,metadata)
          VALUES($1,'operator_pii_revealed','operator',$2::jsonb)`, [id, JSON.stringify({ actor: "pilot_operator", sessionPseudonym })]);
        await client.query("COMMIT");
        return { id: row.id, reference: row.public_reference, status: row.status, version: row.version, customer: row.customer,
          service: row.service, fulfillment: row.fulfillment, vehicle: row.vehicle, requestedTime: row.schedule_preference,
          location: row.location, estimate: row.estimate_snapshot, quoteRequired: row.quote_required, createdAt: row.created_at };
      } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }
    },
    async transition(id, { currentStatus, version, newStatus, reason }) {
      if (!STATUSES.has(currentStatus) || !STATUSES.has(newStatus) || !Number.isInteger(version) || version < 0) throw new OperatorQueueError("invalid_transition");
      const cleanReason = typeof reason === "string" ? reason.trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ") : "";
      if (cleanReason.length < 3 || cleanReason.length > 500) throw new OperatorQueueError("reason_required");
      if (currentStatus === newStatus || TERMINAL.has(currentStatus) || !ALLOWED[currentStatus]?.has(newStatus)) throw new OperatorQueueError("invalid_transition");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query("SELECT status, version FROM booking_requests WHERE id = $1 FOR UPDATE", [id]);
        if (!locked.rows[0]) throw new OperatorQueueError("not_found");
        if (locked.rows[0].status !== currentStatus || locked.rows[0].version !== version) throw new OperatorQueueError("conflict");
        const updated = await client.query("UPDATE booking_requests SET status = $2, version = version + 1 WHERE id = $1 RETURNING status, version", [id, newStatus]);
        await client.query(`INSERT INTO booking_request_events (booking_request_id, event_type, actor_type, metadata)
          VALUES ($1, 'operator_status_transition', 'operator', $2::jsonb)`, [id, JSON.stringify({ previousStatus: currentStatus, newStatus, reason: cleanReason, actor: "pilot_operator" })]);
        await client.query("COMMIT"); return updated.rows[0];
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
  };
}
