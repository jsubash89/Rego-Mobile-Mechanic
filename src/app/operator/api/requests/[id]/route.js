import { getDatabasePool } from "../../../../../server/database.mjs";
import { authenticated, operatorConfig, verifyOrigin } from "../../../../../server/operator/auth.mjs";
import { BodyTooLargeError, isJsonRequest, readJsonBody } from "../../../../../server/operator/body.mjs";
import { createOperatorQueueRepository, OperatorQueueError } from "../../../../../server/operator/repository.mjs";
const cache = { "cache-control": "no-store, private" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function context(request) { try { const config = operatorConfig(); const pool = getDatabasePool(); return { config, pool, auth: await authenticated(request, config, pool) }; } catch { return null; } }
export async function GET(request, { params }) {
  const id = (await params).id; if (!uuid.test(id)) return Response.json({ error: "not_found" }, { status: 404, headers: cache });
  const ctx = await context(request); if (!ctx?.auth) return Response.json({ error: "unauthorized" }, { status: 401, headers: cache });
  try { const item = await createOperatorQueueRepository({ pool: ctx.pool }).detail(id, ctx.auth.sessionPseudonym); return item ? Response.json(item, { headers: cache }) : Response.json({ error: "not_found" }, { status: 404, headers: cache }); }
  catch { return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
}
export async function PATCH(request, { params }) {
  const id = (await params).id; if (!uuid.test(id)) return Response.json({ error: "invalid_request" }, { status: 400, headers: cache });
  const ctx = await context(request); if (!ctx?.auth) return Response.json({ error: "unauthorized" }, { status: 401, headers: cache });
  if (!verifyOrigin(request, ctx.config)) return Response.json({ error: "forbidden" }, { status: 403, headers: cache });
  if (!isJsonRequest(request)) return Response.json({ error: "unsupported_media_type" }, { status: 415, headers: cache });
  let body; try { body = await readJsonBody(request); } catch (error) { return Response.json({ error: error instanceof BodyTooLargeError ? "payload_too_large" : "invalid_request" }, { status: error instanceof BodyTooLargeError ? 413 : 400, headers: cache }); }
  try { return Response.json(await createOperatorQueueRepository({ pool: ctx.pool }).transition(id, body), { headers: cache }); }
  catch (error) { if (error instanceof OperatorQueueError) { const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 422; return Response.json({ error: error.code }, { status, headers: cache }); } return Response.json({ error: "unavailable" }, { status: 503, headers: cache }); }
}
