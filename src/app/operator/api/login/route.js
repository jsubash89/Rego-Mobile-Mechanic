import { getDatabasePool } from "../../../../server/database.mjs";
import { ipIdentity, loginAtomically, operatorConfig, sessionCookie, verifyOrigin } from "../../../../server/operator/auth.mjs";
import { BodyTooLargeError, isJsonRequest, readJsonBody } from "../../../../server/operator/body.mjs";
export const runtime = "nodejs";
const headers = { "cache-control": "no-store, private", "content-type": "application/json" };
function reply(body, status, extra = {}) { return new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } }); }
export async function POST(request) {
  let config; try { config = operatorConfig(); } catch { return reply({ error: "authentication_unavailable" }, 503); }
  if (!verifyOrigin(request, config)) return reply({ error: "forbidden" }, 403);
  if (!isJsonRequest(request)) return reply({ error: "unsupported_media_type" }, 415);
  let body; try { body = await readJsonBody(request); } catch (error) { return error instanceof BodyTooLargeError ? reply({ error: "payload_too_large" }, 413) : reply({ error: "invalid_credentials" }, 401); }
  const pool = getDatabasePool();
  try {
    const result = await loginAtomically({ pool, identity: ipIdentity(request, config), candidate: body?.secret, config });
    if (result.status === "rate_limited") return reply({ error: "rate_limited" }, 429, { "retry-after": "900" });
    if (result.status === "invalid") return reply({ error: "invalid_credentials" }, 401);
    return reply({ ok: true }, 200, { "set-cookie": sessionCookie(result.token) });
  } catch { return reply({ error: "authentication_unavailable" }, 503); }
}
