/* Browser integration seam for the scalar-only C-M12 inspector.  This page
 * deliberately starts a generated synthetic Wasm core, not a System 303 disk
 * session.  It is an accessibility/protocol probe for the browser boundary;
 * it makes no preserved-runtime debugger or provenance claim. */
import { mountCadrM12DebuggerPanel } from "./cadr-m12-debugger-panel.mjs";

const root = document.getElementById("cadr-m12-debugger-root");
if (root === null) throw new Error("C-M12 browser root is missing");

let nextId = 1;
const worker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), { type: "module" });
const pending = new Map();
worker.addEventListener("message", event => {
  const reply = event.data;
  const waiter = pending.get(reply?.id);
  if (waiter === undefined) return;
  pending.delete(reply.id);
  waiter.resolve(reply);
});
worker.addEventListener("error", event => {
  for (const waiter of pending.values()) waiter.reject(event.error ?? new Error("C-M12 worker failed"));
  pending.clear();
});

function request(op, fields = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ version: 7, id, op, ...fields });
  });
}

try {
  const wasmBytes = await (await fetch(new URL("../build/cadr-web-m12-O0.wasm", import.meta.url))).arrayBuffer();
  const module = await WebAssembly.compile(wasmBytes);
  const initial = await request("instantiate", { module });
  if (initial?.status !== 0) throw new Error(`C-M12 Wasm create failed with status ${initial?.status}`);
  const panel = mountCadrM12DebuggerPanel({ root, request });
  /* Browser campaigns use this only to await/destroy the self-contained test
   * fixture.  It exposes neither the worker nor any Wasm memory object. */
  window.__CADR_M12_DEBUGGER_PANEL_READY__ = true;
  window.__CADR_M12_DEBUGGER_PANEL_DISPOSE__ = () => worker.terminate();
  panel.status.textContent = "Debugger controls ready; generated M12 Wasm is paused for scalar inspection.";
} catch (error) {
  root.textContent = "C-M12 browser debugger controls could not start.";
  root.dataset.status = "failed";
  worker.terminate();
  throw error;
}
