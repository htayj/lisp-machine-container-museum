/* Narrow browser composition probe for the real selected M13 ABI1.11 Wasm
 * module and protocol-v8 worker.  This is intentionally not an application bootstrap:
 * no licensed base bytes, M10 service, audio device, or DOM input path is
 * supplied.  Its only claim is that the M13 v8 shell compiles a byte-checked
 * selected module, structured-clones it to the real worker, and preserves
 * lower lifecycle results without widening a storage capability. */
import { CADR_M13_PROTOCOL_VERSION, CadrM13Shell } from "./cadr-m13-shell.mjs";

const status = document.querySelector("#cadr-m13-selected-wasm-status");
const worker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), {
  type: "module", name: "cadr-m13-selected-wasm-probe",
});
const shell = new CadrM13Shell({ worker, timeoutMs: 10000 });

async function sha256(value) {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", value));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function requestFor(target, id, op, fields = {}) {
  return Object.freeze({ type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
    sessionId: target.sessionId, id, op, ...fields });
}

let bootstrapped = false;
let selectedWasmBytes = null;
let selectedWasmSha256 = null;
async function bootstrap() {
  if (bootstrapped) throw new Error("selected-Wasm probe is single-bootstrap");
  const response = await fetch(new URL("../build/cadr-web-m13-audio-O2.wasm", import.meta.url),
    { cache: "no-store" });
  if (!response.ok) throw new Error(`selected Wasm fetch failed (${response.status})`);
  const wasmBytes = await response.arrayBuffer();
  selectedWasmBytes = wasmBytes.slice(0);
  selectedWasmSha256 = await sha256(selectedWasmBytes);
  const result = await shell.submit(requestFor(shell, 1, "bootstrap", {
    wasmBytes, wasmSha256: selectedWasmSha256,
  }));
  if (result.status === 0) bootstrapped = true;
  status.textContent = result.status === 0 ?
    "Selected M13 ABI1.11 Wasm instantiated in the real v8 worker; no storage is configured." :
    `Selected M13 ABI1.11 Wasm bootstrap failed with status ${result.status}.`;
  return result;
}

/* A separate worker keeps the normal session alive while exercising the v8
 * public-ID exhaustion rule with the same verified module.  This checks only
 * the normal maximum-ID result against the selected worker; hostile clone and
 * reply races remain separate F04 obligations. */
async function bootstrapAtMaximumId() {
  if (!bootstrapped || selectedWasmBytes === null || selectedWasmSha256 === null) {
    throw new Error("selected-Wasm probe must bootstrap normally first");
  }
  const maximumWorker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), {
    type: "module", name: "cadr-m13-selected-wasm-maximum-id-probe",
  });
  const maximumShell = new CadrM13Shell({ worker: maximumWorker, timeoutMs: 10000,
    initialId: 0xffffffff });
  try {
    const result = await maximumShell.submit(requestFor(maximumShell, 0xffffffff, "bootstrap", {
      wasmBytes: selectedWasmBytes.slice(0), wasmSha256: selectedWasmSha256,
    }));
    return Object.freeze({ result, state: maximumShell.state });
  } finally { maximumShell.dispose(); }
}

/* `terminate()` is an actual browser-worker loss rather than a synthetic lower
 * reply.  The independent shell has a short explicit response deadline; its
 * status-24 result remains distinct from the selected worker's normal status
 * 9 cold-power response checked by the primary shell. */
async function terminateSelectedWorkerDuringRequest() {
  if (!bootstrapped || selectedWasmBytes === null || selectedWasmSha256 === null) {
    throw new Error("selected-Wasm probe must bootstrap normally first");
  }
  const lossWorker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), {
    type: "module", name: "cadr-m13-selected-wasm-worker-loss-probe",
  });
  const lossShell = new CadrM13Shell({ worker: lossWorker, timeoutMs: 250 });
  try {
    const bootstrapResult = await lossShell.submit(requestFor(lossShell, 1, "bootstrap", {
      wasmBytes: selectedWasmBytes.slice(0), wasmSha256: selectedWasmSha256,
    }));
    if (bootstrapResult.status !== 0) return Object.freeze({ bootstrapResult, result: null, state: lossShell.state });
    const pending = lossShell.submit(requestFor(lossShell, 2, "machine-cold-power-on"));
    lossWorker.terminate();
    const result = await pending;
    return Object.freeze({ bootstrapResult, result, state: lossShell.state });
  } finally { lossShell.dispose(); }
}

globalThis.cadrM13SelectedWasmHarness = Object.freeze({
  sessionId: shell.sessionId,
  bootstrap,
  bootstrapAtMaximumId,
  terminateSelectedWorkerDuringRequest,
  submit(id, op, fields = {}) { return shell.submit(requestFor(shell, id, op, fields)); },
  state() { return shell.state; },
  dispose() { shell.dispose(); },
});
status.textContent = "Selected-Wasm composition probe ready.";
