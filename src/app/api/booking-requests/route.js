import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { createBookingRequestService } from "../../../server/booking-requests/booking-request.mjs";
import { createBookingRequestRepository } from "../../../server/booking-requests/repository.mjs";
import { getDatabasePool } from "../../../server/database.mjs";

export const runtime = "nodejs";
const defaultRateStore = new Map();
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
      if (size > limit) {
        await reader.cancel();
        return { error: "too_large" };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return { error: "invalid_json" }; }
}
function takeRateLimit({ store, key, now, limit, windowMs, maxKeys }) {
  let entry = store.get(key);
  const current = now();
  if (!entry || current >= entry.resetAt) entry = { count: 0, resetAt: current + windowMs };
  entry.count += 1;
  store.set(key, entry);
  if (store.size > maxKeys) store.delete(store.keys().next().value);
  return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)) };
}
function safeTelemetry(error, correlationId) {
  const sqlstateClass = typeof error?.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? error.code.slice(0, 2) : undefined;
  return { correlationId, category: sqlstateClass ? "database" : "internal", ...(sqlstateClass && { sqlstateClass }) };
}

export function deriveProductionRateKey(request, { vercel = process.env.VERCEL === "1" } = {}) {
  if (!vercel) return "global:circuit-breaker";
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (!forwarded || forwarded.includes(",") || isIP(forwarded) === 0) return "vercel:malformed-client-ip";
  return `client:${forwarded.toLowerCase()}`;
}

export function productionRatePolicy({ vercel = process.env.VERCEL === "1" } = {}) {
  return vercel
    ? { rateLimit: { limit: 120, windowMs: 60_000, maxKeys: 10_000 }, rateKey: (request) => deriveProductionRateKey(request, { vercel: true }) }
    : { rateLimit: { limit: 10_000, windowMs: 60_000, maxKeys: 1 }, rateKey: () => "global:circuit-breaker" };
}

function safeRateKey(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9:.\-]+$/.test(value)
    ? value
    : "invalid:rate-key";
}

const defaultPolicy = productionRatePolicy();

export function createPostHandler({
  service, logger = console, bodyLimitBytes = 32 * 1024,
  rateLimit = defaultPolicy.rateLimit, rateStore = new Map(),
  rateKey = defaultPolicy.rateKey, now = Date.now, correlationId = randomUUID,
} = {}) {
  if (!service?.create) throw new TypeError("A booking request service is required");
  const config = { limit: rateLimit.limit, windowMs: rateLimit.windowMs, maxKeys: rateLimit.maxKeys ?? 10_000 };
  if (![bodyLimitBytes, config.limit, config.windowMs, config.maxKeys].every((v) => Number.isInteger(v) && v > 0)) throw new TypeError("Abuse-control limits must be positive integers");
  return async function post(request) {
    const id = correlationId();
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") return json({ error: "unsupported_media_type" }, 415);
    const rate = takeRateLimit({ store: rateStore, key: safeRateKey(rateKey(request)), now, ...config });
    if (!rate.allowed) return json({ error: "rate_limited" }, 429, { "retry-after": String(rate.retryAfter) });
    const parsed = await readJsonBounded(request, bodyLimitBytes);
    if (parsed.error === "too_large") return json({ error: "payload_too_large" }, 413);
    if (parsed.error) return json({ error: "invalid_booking_request", code: "invalid_json" }, 400);
    try {
      const result = await service.create(parsed.value, request.headers.get("idempotency-key"));
      return json(result, 201);
    } catch (error) {
      if (error?.name === "BookingRequestValidationError") return json({ error: "invalid_booking_request", code: error.code ?? "invalid_input" }, 400);
      if (error?.name === "IdempotencyConflictError") return json({ error: "idempotency_conflict", correlationId: id }, 409);
      logger.error("booking_request_create_failed", safeTelemetry(error, id));
      return json({ error: "booking_request_unavailable", correlationId: id }, 503);
    }
  };
}

let productionHandler;
export async function POST(request) {
  if (!productionHandler) {
    const repository = createBookingRequestRepository({ pool: getDatabasePool() });
    productionHandler = createPostHandler({ service: createBookingRequestService({ repository }), rateStore: defaultRateStore });
  }
  return productionHandler(request);
}
