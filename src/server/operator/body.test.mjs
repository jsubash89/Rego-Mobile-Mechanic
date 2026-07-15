import test from "node:test";
import assert from "node:assert/strict";
import { BodyTooLargeError, InvalidJsonError, isJsonRequest, readJsonBody } from "./body.mjs";

function streaming(bytes) {
  return new Request("https://rego.test/operator", { method: "POST", headers: { "content-type": "application/json" }, body: new ReadableStream({ start(controller) { for (const chunk of bytes) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }), duplex: "half" });
}
test("streaming JSON parser bounds chunked bodies before buffering", async () => {
  assert.deepEqual(await readJsonBody(streaming(["{\"ok\":", "true}"]), 32), { ok: true });
  await assert.rejects(() => readJsonBody(streaming(["12345678", "9"]), 8), BodyTooLargeError);
  await assert.rejects(() => readJsonBody(streaming(["not json"]), 32), InvalidJsonError);
});
test("JSON content type is normalized and false content lengths fail closed", async () => {
  assert.equal(isJsonRequest(new Request("https://rego.test", { headers: { "content-type": "Application/JSON; charset=utf-8" } })), true);
  const request = streaming(["{}"]); request.headers.set("content-length", "false");
  await assert.rejects(() => readJsonBody(request), BodyTooLargeError);
});
