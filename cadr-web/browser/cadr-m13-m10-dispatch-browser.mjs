/* Browser-only composition probe for the M13 dispatcher and real C-M10-IDB-v1
 * controller.  The lower peer deliberately supplies one exact synthetic M4
 * write request; it is not a System 303 boot or selected-Wasm runtime claim. */
import { CadrM13Shell, CADR_M13_PROTOCOL_VERSION } from "./cadr-m13-shell.mjs";
import { createCadrM10Controller, createCadrM10WorkerDiskBridge } from "./cadr-m10-controller.mjs";
import { createCadrM10IndexedDbBackend } from "./cadr-m10-indexeddb.mjs";
import { CADR_M10_BASE_SHA256 } from "../wasm/cadr-m10-persistence.mjs";

const status = document.querySelector("#cadr-m13-m10-dispatch-status");
const TEXT = new TextEncoder();

function equal(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

async function sha256(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function basePage(lba) {
  return Uint8Array.from({ length: 1024 }, (_, index) =>
    Number((lba * 31n + BigInt(index * 7 + 3)) & 255n));
}

async function binding(serial) {
  return Object.freeze({
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => (serial + index * 19) & 255),
    baseSha256: CADR_M10_BASE_SHA256.slice(),
    profileSha256: new Uint8Array(await crypto.subtle.digest("SHA-256", TEXT.encode(`M13 M10 browser probe ${serial}`))),
    artifactSetSha256: new Uint8Array(await crypto.subtle.digest("SHA-256", TEXT.encode("M13 M10 browser probe artifact set"))),
  });
}

class SyntheticM4WriteWorker {
  #listeners = new Map();
  #payload = Uint8Array.from({ length: 1024 }, (_, index) => (index * 37 + 11) & 255);
  requests = [];
  completions = [];
  terminated = false;
  addEventListener(type, listener) {
    const values = this.#listeners.get(type) ?? [];
    values.push(listener); this.#listeners.set(type, values);
  }
  removeEventListener(type, listener) {
    this.#listeners.set(type, (this.#listeners.get(type) ?? []).filter(value => value !== listener));
  }
  #emit(type, event) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
  #response(request, status, remainder = {}) {
    queueMicrotask(() => this.#emit("message", { data: {
      type: "cadr-response", version: 7, id: request.id, op: request.op,
      status, ok: status === 0, ...remainder,
    } }));
  }
  postMessage(request) {
    this.requests.push(request);
    if (request.op === "scheduler-run-v7-slice") {
      this.#response(request, 8, { lifecycle: "WAITING_FOR_HOST", completedSlots: 0, microinstructionsExecuted: 0 });
    } else if (request.op === "host-next-request") {
      const descriptor = new Uint8Array(24); const view = new DataView(descriptor.buffer);
      view.setBigUint64(0, 0x4d31334dn, true); view.setBigUint64(8, 3n, true);
      view.setUint32(16, 1, true); view.setUint32(20, 1024, true);
      this.#response(request, 0, { lifecycle: "WAITING_FOR_HOST", request: {
        operation: 2, generation: 5n, requestId: 0x4d31334dn,
        descriptorByteCount: 24n, completionByteCount: 0n, requestPayloadByteCount: 1024n,
      }, descriptor: descriptor.buffer, requestPayload: this.#payload.slice().buffer });
    } else if (request.op === "host-complete") {
      this.completions.push({ ...request, bytes: new Uint8Array(request.bytes).slice() });
      this.#response(request, 0, { lifecycle: "RUNNING", byteCount: request.bytes.byteLength });
    } else {
      this.#response(request, 2, { lifecycle: "FAILED" });
    }
  }
  terminate() { this.terminated = true; }
  get payload() { return this.#payload.slice(); }
}

function m13Request(shell, id, op, fields = {}) {
  return Object.freeze({ type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
    sessionId: shell.sessionId, id, op, ...fields });
}

async function controllerFor({ serial, failBeforeCompletion = false, failAfterCompletion = false }) {
  const selectedBinding = await binding(serial);
  const indexedDbBackend = createCadrM10IndexedDbBackend({
    databasePrefix: `cadr-m13-dispatch-${serial}-${Date.now().toString(36)}`,
    seamHook: async event => {
      if (failAfterCompletion && event.seam === "before-head-activation") {
        throw new Error("injected post-completion durable-publication failure");
      }
    },
  });
  const wrapHandle = handle => {
    if (!failBeforeCompletion) return handle;
    const facade = {};
    for (const key of Object.keys(handle)) facade[key] = key === "stage" ?
      async () => { throw new Error("injected controller-before-guest staging failure"); } : handle[key];
    return Object.freeze(facade);
  };
  const backend = !failBeforeCompletion ? indexedDbBackend : Object.freeze({
    profile: indexedDbBackend.profile,
    initializeDisk: async value => wrapHandle(await indexedDbBackend.initializeDisk(value)),
    reopenDisk: async value => wrapHandle(await indexedDbBackend.reopenDisk(value)),
    deleteDisk: value => indexedDbBackend.deleteDisk(value),
  });
  let replaced = 0;
  const controller = createCadrM10Controller({ backend, binding: selectedBinding,
    readBasePage: async lba => basePage(lba),
    readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
    replaceWorker: async () => { replaced += 1; },
  });
  await controller.open({ initialize: true });
  return Object.freeze({ backend, binding: selectedBinding, controller, replacements: () => replaced });
}

async function cleanDispatch() {
  const durable = await controllerFor({ serial: 41 });
  const worker = new SyntheticM4WriteWorker();
  const shell = new CadrM13Shell({ worker, m10Controller: durable.controller,
    m10BridgeFactory: createCadrM10WorkerDiskBridge });
  try {
    const reply = await shell.submit(m13Request(shell, 1, "machine-run", { clockSlots: 1 }));
    const stored = await durable.controller.readBlock(3n);
    if (reply.status !== 8 || reply.terminal || worker.completions.length !== 1 ||
        !equal(stored, worker.payload) || worker.terminated || durable.controller.state !== "CLEAN") {
      throw new Error("clean M13/M10 dispatch result differs");
    }
    return Object.freeze({ status: reply.status, terminal: reply.terminal,
      controllerState: durable.controller.state, completionCount: worker.completions.length,
      completionByteCount: worker.completions[0].bytes.byteLength,
      storedPageSha256: await sha256(stored),
      requestOps: worker.requests.map(request => request.op),
    });
  } finally {
    shell.dispose();
    try { durable.controller.close(); } catch { /* terminal dispatch may already have closed it */ }
    await durable.backend.deleteDisk(durable.binding);
  }
}

async function uncertainDispatch() {
  const durable = await controllerFor({ serial: 79, failAfterCompletion: true });
  const worker = new SyntheticM4WriteWorker();
  const shell = new CadrM13Shell({ worker, m10Controller: durable.controller,
    m10BridgeFactory: createCadrM10WorkerDiskBridge });
  try {
    const reply = await shell.submit(m13Request(shell, 1, "machine-run", { clockSlots: 1 }));
    if (reply.status !== 7 || !reply.terminal || durable.controller.state !== "IN_DOUBT" ||
        durable.replacements() !== 1 || worker.completions.length !== 1 || !worker.terminated) {
      throw new Error("post-completion M13/M10 fencing result differs");
    }
    return Object.freeze({ status: reply.status, terminal: reply.terminal,
      controllerState: durable.controller.state, replacementCount: durable.replacements(),
      completionCount: worker.completions.length, workerTerminated: worker.terminated,
      requestOps: worker.requests.map(request => request.op),
    });
  } finally {
    shell.dispose();
    try { durable.controller.close(); } catch { /* recovery owns this controller after IN_DOUBT */ }
    await durable.backend.deleteDisk(durable.binding);
  }
}

async function preCompletionDispatch() {
  const durable = await controllerFor({ serial: 111, failBeforeCompletion: true });
  const worker = new SyntheticM4WriteWorker();
  const shell = new CadrM13Shell({ worker, m10Controller: durable.controller,
    m10BridgeFactory: createCadrM10WorkerDiskBridge });
  try {
    const reply = await shell.submit(m13Request(shell, 1, "machine-run", { clockSlots: 1 }));
    if (reply.status !== 7 || reply.terminal || durable.controller.state !== "CLEAN" ||
        durable.replacements() !== 0 || worker.completions.length !== 1 || worker.terminated ||
        worker.completions[0].hostStatus !== 1) {
      throw new Error("pre-completion M13/M10 failure result differs");
    }
    return Object.freeze({ status: reply.status, terminal: reply.terminal,
      controllerState: durable.controller.state, replacementCount: durable.replacements(),
      completionCount: worker.completions.length, completionStatus: worker.completions[0].hostStatus,
      workerTerminated: worker.terminated, requestOps: worker.requests.map(request => request.op) });
  } finally {
    shell.dispose();
    try { durable.controller.close(); } catch { /* close remains best effort in probe cleanup */ }
    await durable.backend.deleteDisk(durable.binding);
  }
}

try {
  const clean = await cleanDispatch();
  const uncertain = await uncertainDispatch();
  const preCompletion = await preCompletionDispatch();
  globalThis.cadrM13M10DispatchHarness = Object.freeze({ clean, uncertain, preCompletion });
  status.textContent = "M13/M10 dispatch probe passed.";
} catch (error) {
  globalThis.cadrM13M10DispatchHarness = Object.freeze({ error: String(error?.stack ?? error) });
  status.textContent = "M13/M10 dispatch probe failed.";
}
