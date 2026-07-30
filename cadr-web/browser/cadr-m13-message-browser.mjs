/* Browser-only conformance harness for the M13 message boundary.  It contains
 * no CADR image, disk, storage adapter, DOM input bridge, or executable guest.
 * Its worker is a deliberately synthetic lower-protocol peer selected by query
 * parameter so Chromium can exercise structured clone and Worker lifecycle
 * behavior that the Node fake-worker tests cannot establish. */
import { CADR_M13_PROTOCOL_VERSION, CadrM13Shell } from "./cadr-m13-shell.mjs";

const query = new URL(globalThis.location.href).searchParams;
const workerUrl = new URL("./cadr-m13-message-worker.mjs", import.meta.url);
workerUrl.searchParams.set("mode", query.get("mode") ?? "echo");
const initialId = Number.parseInt(query.get("initialId") ?? "1", 10);
/* The synthetic peer has no imports, so a classic dedicated Worker makes the
 * test about the message boundary rather than module-worker import policy. */
const worker = new Worker(workerUrl, { name: "cadr-m13-conformance-lower" });
const shell = new CadrM13Shell({
  worker,
  initialId,
  timeoutMs: 1000,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x6d),
});
const status = document.getElementById("cadr-m13-message-status");
const sessionId = "6d".repeat(32);

function request(id, op, fields = {}) {
  return { type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION, sessionId, id, op, ...fields };
}

/* This narrow API is test-only.  It returns scalar response facts so protocol
 * values never need to be serialized through an unrelated testing bridge. */
globalThis.cadrM13MessageHarness = Object.freeze({
  sessionId,
  request,
  async submit(candidate) {
    try {
      const reply = await shell.submit(candidate);
      return Object.freeze({ rejected: false, status: reply.status, terminal: reply.terminal,
        state: shell.state, reason: typeof reply.reason === "string" ? reply.reason : null });
    } catch (error) {
      return Object.freeze({ rejected: true, name: error?.name ?? "Error", state: shell.state });
    }
  },
  state() { return shell.state; },
  dispose() { shell.dispose(); },
});
status.textContent = "M13 Worker message-boundary harness ready.";
