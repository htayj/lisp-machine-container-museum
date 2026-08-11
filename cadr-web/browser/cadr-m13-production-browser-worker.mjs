/* Public-synthetic lower Worker for the M13 P1 browser-composition probe.
 * It is intentionally not the selected CADR runtime, an M10 adapter, or a
 * replacement for the real worker. Its only job is to make the P1/shell
 * ownership, request framing, and terminal handling observable in Chromium. */

function fullFrame() {
  const bytes = new Uint8Array(80 + 16 + (24 * 963 * 4));
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRDISP1"), 0);
  view.setUint16(8, 1, true); view.setUint16(10, 80, true); view.setUint32(12, 3, true);
  view.setBigUint64(16, 1n, true); view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true); view.setUint32(36, 963, true); view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true); view.setUint32(48, 23112, true);
  view.setUint32(56, 1, true); view.setUint32(60, 23112, true);
  view.setBigUint64(64, 92448n, true); view.setBigUint64(72, BigInt(bytes.byteLength), true);
  view.setUint32(88, 768, true); view.setUint32(92, 963, true);
  return bytes.buffer;
}

let delayOperation = null;

function reply(request, fields = {}) {
  self.postMessage({ type: "cadr-response", version: 8, id: request.id, op: request.op,
    status: 0, ok: true, ...fields });
}

async function dispatch(request) {
  if (request?.type === "cadr-m13-production-browser-init") {
    if (request.delayOperation !== null && typeof request.delayOperation !== "string") {
      throw new TypeError("synthetic delay operation is invalid");
    }
    delayOperation = request.delayOperation;
    self.postMessage({ type: "cadr-m13-production-browser-ready" });
    return;
  }
  if (request?.version !== 8 || !Number.isSafeInteger(request.id) || typeof request.op !== "string") {
    throw new TypeError("synthetic lower request is malformed");
  }
  if (request.op === delayOperation) await new Promise(resolve => setTimeout(resolve, 150));
  if (request.op === "display-full") {
    reply(request, { full: true, frame: fullFrame(), lifecycle: "PAUSED" });
    return;
  }
  reply(request, { lifecycle: request.op === "scheduler-start" ? "RUNNING" : "PAUSED" });
}

self.addEventListener("message", event => {
  if (event.data?.type === "cadr-m13-production-browser-control" && event.data.op === "crash") {
    throw new Error("injected public-synthetic worker loss");
  }
  void dispatch(event.data);
});
