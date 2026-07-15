import { getDatabasePool } from "../../../../server/database.mjs";
import { expiredCookie, operatorConfig, revokeSession, verifyOrigin } from "../../../../server/operator/auth.mjs";
const cache = { "cache-control": "no-store, private" };
export async function POST(request) {
  let config; try { config = operatorConfig(); } catch { return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
  if (!verifyOrigin(request, config)) return Response.json({ error: "forbidden" }, { status: 403, headers: cache });
  try {
    const revoked = await revokeSession(request, config, getDatabasePool());
    if (!revoked) return Response.json({ error: "unauthorized" }, { status: 401, headers: cache });
    return Response.json({ ok: true }, { headers: { ...cache, "set-cookie": expiredCookie() } });
  } catch { return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
}
