import { randomUUID } from "node:crypto";
import { createBookingRequestService } from "../../../server/booking-requests/booking-request.mjs";
import { createBookingRequestRepository } from "../../../server/booking-requests/repository.mjs";
import { abuseProtectionConfig, createPostgresRateLimiter } from "../../../server/abuse-control.mjs";
import { getDatabasePool } from "../../../server/database.mjs";

export const runtime = "nodejs";
function json(body, status, headers) { return Response.json(body, { status, headers }); }

async function readJsonBounded(request, limit) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) return { error: "too_large" };
  if (!request.body) return { error: "invalid_json" };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); return { error: "too_large" }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return { error: "invalid_json" }; }
}
function safeTelemetry(error, correlationId) {
  const sqlstateClass = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code.slice(0, 2) : undefined;
  return { correlationId, category: sqlstateClass ? "database" : "internal", ...(sqlstateClass && { sqlstateClass }) };
}
const SAFE_VALIDATION_CODES = new Set([
  "forbidden_field", "invalid_input", "invalid_idempotency_key", "invalid_postal_code", "invalid_address",
  "invalid_vin_suffix", "unsupported_market", "partner_only_service",
  "unavailable_service_fulfillment", "ineligible_provider",
]);

export function createPostHandler({
  service, rateLimiter,
  logger = console, bodyLimitBytes = 32 * 1024, correlationId = randomUUID,
} = {}) {
  if (!service?.create) throw new TypeError("A booking request service is required");
  if (!rateLimiter?.consume) throw new TypeError("A distributed rate limiter is required");
  if (!Number.isInteger(bodyLimitBytes) || bodyLimitBytes < 1) throw new TypeError("Body limit must be a positive integer");
  return async function post(request) {
    const id = correlationId();
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") return json({ error: "unsupported_media_type" }, 415);
    try {
      const rate = await rateLimiter.consume(request);
      if (!rate.allowed) return json({ error: "rate_limited" }, 429, { "retry-after": String(rate.retryAfter) });
    } catch (error) {
      logger.error("booking_request_protection_unavailable", safeTelemetry(error, id));
      return json({ error: "booking_request_unavailable", correlationId: id }, 503);
    }
    const parsed = await readJsonBounded(request, bodyLimitBytes);
    if (parsed.error === "too_large") return json({ error: "payload_too_large" }, 413);
    if (parsed.error) return json({ error: "invalid_booking_request", code: "invalid_json" }, 400);
    try {
      const result = await service.create(parsed.value, request.headers.get("idempotency-key"));
      return json(result, 201);
    } catch (error) {
      if (error?.name === "BookingRequestValidationError") return json({ error: "invalid_booking_request", code: SAFE_VALIDATION_CODES.has(error.code) ? error.code : "invalid_input" }, 400);
      if (error?.name === "IdempotencyConflictError") return json({ error: "idempotency_conflict", correlationId: id }, 409);
      logger.error("booking_request_create_failed", safeTelemetry(error, id));
      return json({ error: "booking_request_unavailable", correlationId: id }, 503);
    }
  };
}

let productionHandler;
export async function POST(request) {
  if (!productionHandler) {
    try {
      const pool = getDatabasePool();
      const config = abuseProtectionConfig(process.env);
      const repository = createBookingRequestRepository({ pool });
      productionHandler = createPostHandler({
        service: createBookingRequestService({ repository }),
        rateLimiter: createPostgresRateLimiter({ pool, config }),
      });
    } catch {
      return json({ error: "booking_request_unavailable" }, 503);
    }
  }
  return productionHandler(request);
}
