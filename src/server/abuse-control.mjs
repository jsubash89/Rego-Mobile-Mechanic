import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;
const MIN_SECRET_BYTES = 32;

export class AbuseProtectionConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AbuseProtectionConfigurationError";
  }
}

function boundedInteger(value, fallback, min, max, name) {
  const raw = value == null || value === "" ? String(fallback) : String(value);
  if (!/^\d+$/.test(raw)) throw new AbuseProtectionConfigurationError(`${name} is invalid`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new AbuseProtectionConfigurationError(`${name} is invalid`);
  return parsed;
}

function validSecret(value) {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") >= MIN_SECRET_BYTES && Buffer.byteLength(value, "utf8") <= 1024;
}

function equalSecret(actual, expected) {
  if (typeof actual !== "string") return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizedIp(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate && !candidate.includes(",") && isIP(candidate) ? candidate.toLowerCase() : null;
}

export function abuseProtectionConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const limit = boundedInteger(env.BOOKING_RATE_LIMIT, DEFAULT_LIMIT, 1, 100, "BOOKING_RATE_LIMIT");
  const windowMs = boundedInteger(env.BOOKING_RATE_WINDOW_MS, DEFAULT_WINDOW_MS, 1_000, 3_600_000, "BOOKING_RATE_WINDOW_MS");
  if (!production) return { production, mode: "local", secret: env.BOOKING_RATE_LIMIT_SECRET || "local-test-only-deterministic-secret", limit, windowMs };
  if (!validSecret(env.BOOKING_RATE_LIMIT_SECRET)) throw new AbuseProtectionConfigurationError("BOOKING_RATE_LIMIT_SECRET is required");
  if (env.VERCEL === "1") return { production, mode: "vercel", secret: env.BOOKING_RATE_LIMIT_SECRET, limit, windowMs };
  const header = env.BOOKING_TRUSTED_PROXY_IP_HEADER?.toLowerCase();
  if (!header || !/^x-[a-z0-9-]{1,62}$/.test(header) || !validSecret(env.BOOKING_TRUSTED_PROXY_SECRET)) {
    throw new AbuseProtectionConfigurationError("A trusted proxy contract is required outside Vercel");
  }
  return { production, mode: "trusted-proxy", secret: env.BOOKING_RATE_LIMIT_SECRET, limit, windowMs, header, proxySecret: env.BOOKING_TRUSTED_PROXY_SECRET };
}

export function trustedClientIdentity(request, config) {
  if (config.mode === "local") return "local-test-client";
  if (config.mode === "vercel") {
    const ip = normalizedIp(request.headers.get("x-vercel-forwarded-for"));
    if (!ip) throw new AbuseProtectionConfigurationError("Trusted client identity unavailable");
    return ip;
  }
  if (!equalSecret(request.headers.get("x-booking-proxy-secret"), config.proxySecret)) {
    throw new AbuseProtectionConfigurationError("Trusted proxy authentication failed");
  }
  const ip = normalizedIp(request.headers.get(config.header));
  if (!ip) throw new AbuseProtectionConfigurationError("Trusted client identity unavailable");
  return ip;
}

export function hashClientIdentity(identity, secret) {
  return createHmac("sha256", secret).update(identity, "utf8").digest("hex");
}

export function createPostgresRateLimiter({ pool, config, now = () => new Date() } = {}) {
  if (!pool?.query) throw new TypeError("A PostgreSQL pool is required");
  if (!config?.secret) throw new AbuseProtectionConfigurationError("Abuse protection is not configured");
  return {
    async consume(request) {
      const current = now();
      const timestamp = current instanceof Date ? current : new Date(current);
      if (!Number.isFinite(timestamp.getTime())) throw new TypeError("Rate-limit clock is invalid");
      const identityHash = hashClientIdentity(trustedClientIdentity(request, config), config.secret);
      const startMs = Math.floor(timestamp.getTime() / config.windowMs) * config.windowMs;
      const windowStart = new Date(startMs);
      const resetAt = new Date(startMs + config.windowMs);
      // Retain only enough history for an active window plus cleanup slack.
      const expiresAt = new Date(resetAt.getTime() + Math.min(config.windowMs, 300_000));
      await pool.query("DELETE FROM booking_rate_limit_windows WHERE expires_at <= $1", [timestamp]);
      const result = await pool.query(`INSERT INTO booking_rate_limit_windows
        (identity_hash, window_start, request_count, expires_at) VALUES ($1, $2, 1, $3)
        ON CONFLICT (identity_hash, window_start) DO UPDATE SET
          request_count = LEAST(booking_rate_limit_windows.request_count + 1, $4),
          expires_at = EXCLUDED.expires_at
        RETURNING request_count`, [identityHash, windowStart, expiresAt, config.limit + 1]);
      const count = result.rows[0].request_count;
      return { allowed: count <= config.limit, retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - timestamp.getTime()) / 1000)) };
    },
  };
}
