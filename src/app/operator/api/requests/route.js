import { getDatabasePool } from "../../../../server/database.mjs";
import { authenticated, operatorConfig } from "../../../../server/operator/auth.mjs";
import { createOperatorQueueRepository } from "../../../../server/operator/repository.mjs";
export const dynamic = "force-dynamic";
const cache = { "cache-control": "no-store, private" };
export async function GET(request) {
  let config; try { config = operatorConfig(); } catch { return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
  const pool = getDatabasePool();
  try {
    if (!await authenticated(request, config, pool)) return Response.json({ error: "unauthorized" }, { status: 401, headers: cache });
    const url = new URL(request.url); return Response.json(await createOperatorQueueRepository({ pool }).list(Object.fromEntries(url.searchParams)), { headers: cache });
  } catch { return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
}
