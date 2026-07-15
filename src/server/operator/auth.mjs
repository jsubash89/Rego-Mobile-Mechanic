import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const OPERATOR_COOKIE = "rego_operator";
export const SESSION_SECONDS = 8 * 60 * 60;
export const LOGIN_MAX_FAILURES = 5;
const requiredSecrets = ["OPERATOR_SHARED_SECRET", "OPERATOR_SESSION_SECRET", "OPERATOR_RATE_LIMIT_SECRET"];

export function operatorConfig(env = process.env) {
  for (const key of requiredSecrets) if (Buffer.byteLength(env[key] ?? "", "utf8") < 32) throw new Error("Operator authentication is unavailable");
  if (new Set(requiredSecrets.map((key) => env[key])).size !== requiredSecrets.length) throw new Error("Operator authentication is unavailable");
  const rawOrigin = env.OPERATOR_CANONICAL_ORIGIN;
  let canonicalOrigin;
  try { const parsed = new URL(rawOrigin); if (rawOrigin !== parsed.origin || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); canonicalOrigin = parsed.origin; }
  catch { throw new Error("Operator authentication is unavailable"); }
  const config = { sharedSecret: env.OPERATOR_SHARED_SECRET, sessionSecret: env.OPERATOR_SESSION_SECRET, rateSecret: env.OPERATOR_RATE_LIMIT_SECRET, canonicalOrigin, mode: "local" };
  if (env.NODE_ENV === "production" && env.VERCEL === "1") config.mode = "vercel";
  else if (env.NODE_ENV === "production") {
    const header = env.OPERATOR_TRUSTED_PROXY_IP_HEADER?.toLowerCase();
    if (!header || !/^x-[a-z0-9-]{1,62}$/.test(header) || Buffer.byteLength(env.OPERATOR_TRUSTED_PROXY_SECRET ?? "") < 32) throw new Error("Operator authentication is unavailable");
    Object.assign(config, { mode: "trusted-proxy", header, proxySecret: env.OPERATOR_TRUSTED_PROXY_SECRET });
  }
  return config;
}
function equalSecret(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}
export function validateSharedSecret(candidate, config) { return equalSecret(candidate, config.sharedSecret); }
function signature(payload, secret) { return createHmac("sha256", secret).update(payload).digest("base64url"); }
export function sessionHash(sessionId) { return createHash("sha256").update(sessionId).digest("hex"); }
export function sessionPseudonym(sessionId, config) { return createHmac("sha256", config.sessionSecret).update(`audit:${sessionId}`).digest("hex"); }
export function issueSession(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const value = { sid: randomBytes(32).toString("base64url"), iat: nowSeconds, exp: nowSeconds + SESSION_SECONDS };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signature(payload, config.sessionSecret)}`;
}
export function verifySession(token, config, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, supplied, extra] = token.split(".");
  if (!payload || !supplied || extra || !equalSecret(supplied, signature(payload, config.sessionSecret))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^[A-Za-z0-9_-]{43}$/.test(value.sid) || !Number.isInteger(value.iat) || !Number.isInteger(value.exp) || value.exp - value.iat !== SESSION_SECONDS || value.iat > nowSeconds + 60 || value.exp <= nowSeconds) return null;
    return value;
  } catch { return null; }
}
export function cookieValue(request, name = OPERATOR_COOKIE) {
  const part = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}
export async function authenticated(request, config, pool, now = new Date()) {
  return authenticateToken(cookieValue(request), config, pool, now);
}
export async function authenticateToken(token, config, pool, now = new Date()) {
  const session = verifySession(token, config, Math.floor(now.getTime() / 1000));
  if (!session || !pool?.query) return null;
  const result = await pool.query(`SELECT actor FROM operator_sessions
    WHERE session_hash=$1 AND revoked_at IS NULL AND issued_at <= $2 AND expires_at > $2`, [sessionHash(session.sid), now]);
  return result.rowCount === 1 ? { actor: result.rows[0].actor, sessionHash: sessionHash(session.sid), sessionPseudonym: sessionPseudonym(session.sid, config), expiresAt: new Date(session.exp * 1000) } : null;
}
export async function persistSession(client, token, config) {
  const session = verifySession(token, config);
  if (!session) throw new Error("Invalid generated session");
  await client.query(`INSERT INTO operator_sessions(session_hash, actor, issued_at, expires_at)
    VALUES ($1, 'pilot_operator', to_timestamp($2), to_timestamp($3))`, [sessionHash(session.sid), session.iat, session.exp]);
  return session;
}
export async function revokeSession(request, config, pool) {
  const session = verifySession(cookieValue(request), config);
  if (!session) return false;
  const result = await pool.query("UPDATE operator_sessions SET revoked_at=now() WHERE session_hash=$1 AND revoked_at IS NULL RETURNING session_hash", [sessionHash(session.sid)]);
  return result.rowCount === 1;
}
export function sessionCookie(token, production = process.env.NODE_ENV === "production") { return `${OPERATOR_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/operator; Max-Age=${SESSION_SECONDS}${production ? "; Secure" : ""}`; }
export function expiredCookie(production = process.env.NODE_ENV === "production") { return `${OPERATOR_COOKIE}=; HttpOnly; SameSite=Strict; Path=/operator; Max-Age=0${production ? "; Secure" : ""}`; }
export function verifyOrigin(request, config) { return request.headers.get("origin") === config?.canonicalOrigin; }
export function ipIdentity(request, config) {
  let raw = "local-test-client";
  if (config.mode === "vercel") raw = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (config.mode === "trusted-proxy") { if (!equalSecret(request.headers.get("x-operator-proxy-secret"), config.proxySecret)) throw new Error("Client identity unavailable"); raw = request.headers.get(config.header)?.trim(); }
  if (config.mode !== "local" && (!raw || raw.includes(",") || !isIP(raw))) throw new Error("Client identity unavailable");
  return createHmac("sha256", config.rateSecret).update(raw).digest("hex");
}

export async function loginAtomically({ pool, identity, candidate, config }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 731947))", [identity]);
    await client.query(`DELETE FROM operator_login_rate_limit_windows WHERE ctid IN
      (SELECT ctid FROM operator_login_rate_limit_windows WHERE expires_at <= now() LIMIT 100)`);
    await client.query(`DELETE FROM operator_sessions WHERE session_hash IN
      (SELECT session_hash FROM operator_sessions WHERE expires_at <= now() OR revoked_at <= now() - interval '24 hours' LIMIT 100)`);
    const count = await client.query("SELECT coalesce(sum(failed_count),0)::int AS failures FROM operator_login_rate_limit_windows WHERE identity_hash=$1 AND expires_at>now()", [identity]);
    if (count.rows[0].failures >= LOGIN_MAX_FAILURES) { await client.query("COMMIT"); return { status: "rate_limited" }; }
    if (!validateSharedSecret(candidate, config)) {
      await client.query(`INSERT INTO operator_login_rate_limit_windows(identity_hash,window_start,failed_count,expires_at)
        VALUES($1,to_timestamp(floor(extract(epoch from now())/900)*900),1,to_timestamp(floor(extract(epoch from now())/900)*900)+interval '15 minutes')
        ON CONFLICT(identity_hash,window_start) DO UPDATE SET failed_count=operator_login_rate_limit_windows.failed_count+1`, [identity]);
      await client.query("COMMIT"); return { status: "invalid" };
    }
    await client.query("DELETE FROM operator_login_rate_limit_windows WHERE identity_hash=$1", [identity]);
    const token = issueSession(config); await persistSession(client, token, config);
    await client.query("COMMIT"); return { status: "ok", token };
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }
}
