/* Synthetic v7 lower peer for the browser-only M13 message-boundary test. */
const mode = new URL(self.location.href).searchParams.get("mode") ?? "echo";

function reply(request, status = 0, ok = status === 0) {
  self.postMessage({ type: "cadr-response", version: 7, id: request.id,
    op: request.op, status, ok, lifecycle: "PAUSED" });
}

self.addEventListener("message", event => {
  const request = event.data;
  if (mode === "ignore") return;
  if (mode === "error") throw new Error("synthetic M13 lower-worker failure");
  if (mode === "malformed") {
    self.postMessage({ type: "cadr-response", version: 7, id: request.id + 1,
      op: request.op, status: 0, ok: true });
    return;
  }
  if (mode === "status21") { reply(request, 21, false); return; }
  if (mode === "delayed") { self.setTimeout(() => reply(request), 20); return; }
  reply(request);
  if (mode === "duplicate") self.setTimeout(() => reply(request), 20);
});
