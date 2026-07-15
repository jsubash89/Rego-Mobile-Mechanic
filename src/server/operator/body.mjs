export class BodyTooLargeError extends Error {}
export class InvalidJsonError extends Error {}

export function isJsonRequest(request) {
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

export async function readJsonBody(request, limit = 4096) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared.trim()) || Number(declared) > limit)) throw new BodyTooLargeError();
  if (!request.body) throw new InvalidJsonError();
  const reader = request.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel().catch(() => {}); throw new BodyTooLargeError(); }
      chunks.push(value);
    }
    const all = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all)); } catch { throw new InvalidJsonError(); }
  } finally { reader.releaseLock(); }
}
