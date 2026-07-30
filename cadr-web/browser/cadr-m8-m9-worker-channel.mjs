/*
 * Browser-side transport and DOM ingress for the dedicated C-M8/C-M9 v6
 * worker operations.  It deliberately holds no guest input state: worker
 * responses remain the authority for accepted keys and pointer edges.
 */

import { CADR_M8_PROTOCOL_VERSION, cadrM8KeyForCode } from "../wasm/cadr-m8-keyboard.mjs";

export const CADR_M8_M9_BROWSER_PROTOCOL_VERSION = CADR_M8_PROTOCOL_VERSION;

function invariant(condition, message) {
  if (!condition) throw new TypeError(`C-M8/M9 channel: ${message}`);
}

function protocolId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 0xffffffff;
}

function addListener(target, name, listener) {
  invariant(target !== null && typeof target === "object" &&
    typeof target.addEventListener === "function" &&
    typeof target.removeEventListener === "function", "event target must support listeners");
  target.addEventListener(name, listener);
  return () => target.removeEventListener(name, listener);
}

function messageData(value) {
  return value !== null && typeof value === "object" && "data" in value ? value.data : value;
}

/**
 * Serialize all guest-worker request IDs across keyboard and pointer adapters.
 * The channel accepts a request that already has an ID only when its caller
 * obtained that ID from `allocateRequestId`; this makes concurrent DOM edges
 * retain the worker's global monotonic request discipline.
 */
export function createCadrM8M9WorkerChannel({ worker, version = CADR_M8_M9_BROWSER_PROTOCOL_VERSION,
  initialId = 1 } = {}) {
  invariant(worker !== null && typeof worker === "object" && typeof worker.postMessage === "function",
    "worker must provide postMessage");
  invariant(version === CADR_M8_M9_BROWSER_PROTOCOL_VERSION, "only protocol v6 is supported");
  invariant(protocolId(initialId), "initialId must be a positive uint32");
  let nextId = initialId;
  let closed = false;
  const reserved = new Set();
  const pending = new Map();

  const removeMessage = addListener(worker, "message", event => {
    const response = messageData(event);
    if (response === null || typeof response !== "object" || !protocolId(response.id)) return;
    const deferred = pending.get(response.id);
    if (deferred === undefined) return;
    pending.delete(response.id);
    if (response.type === "cadr-error") {
      deferred.reject(new Error(`CADR worker ${response.code ?? "error"}: ${response.message ?? "unknown error"}`));
    } else {
      deferred.resolve(response);
    }
  });
  const removeError = typeof worker.addEventListener === "function" ? addListener(worker, "error", event => {
    const error = event?.error instanceof Error ? event.error : new Error(event?.message ?? "worker error");
    for (const deferred of pending.values()) deferred.reject(error);
    pending.clear();
  }) : () => {};

  function allocateRequestId() {
    invariant(!closed, "channel is closed");
    invariant(nextId <= 0xffffffff, "request ID space exhausted");
    const id = nextId++;
    reserved.add(id);
    return id;
  }

  function submit(operation) {
    invariant(!closed, "channel is closed");
    invariant(operation !== null && typeof operation === "object" && !Array.isArray(operation),
      "operation must be a record");
    const id = operation.id === undefined ? allocateRequestId() : operation.id;
    invariant(protocolId(id), "operation id must be a positive uint32");
    invariant(reserved.has(id), "operation id was not allocated by this channel");
    invariant(operation.version === undefined || operation.version === version, "operation protocol version differs");
    invariant(typeof operation.op === "string" && operation.op.length !== 0, "operation name is required");
    invariant(!pending.has(id), "request ID is already pending");
    const request = Object.freeze({ ...operation, version, id });
    return new Promise((resolve, reject) => {
      reserved.delete(id);
      pending.set(id, { resolve, reject });
      try {
        worker.postMessage(request);
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  return Object.freeze({
    version,
    allocateRequestId,
    submit,
    pendingCount() { return pending.size; },
    close(reason = new Error("C-M8/M9 channel closed")) {
      if (closed) return;
      closed = true;
      removeMessage(); removeError();
      reserved.clear();
      for (const deferred of pending.values()) deferred.reject(reason);
      pending.clear();
    },
  });
}

/**
 * Attach M8 physical-key normalization to a focusable browser surface.  The
 * source `KeyboardEvent.code` is forwarded unchanged; `key` is never read.
 * Every mapped edge is prevented locally so browser shortcuts do not both act
 * on the page and enter the guest path.
 */
export function bindCadrM8PhysicalKeyboard({ target, submitKeyboardOperation } = {}) {
  invariant(typeof submitKeyboardOperation === "function", "keyboard submitter must be a function");
  const dispatch = operation => {
    try { return Promise.resolve(submitKeyboardOperation(operation)); }
    catch { return Promise.resolve(null); }
  };
  const keydown = event => {
    const descriptor = cadrM8KeyForCode(event?.code);
    if (descriptor === null) return;
    event.preventDefault?.();
    void dispatch({ op: "keyboard-down", code: descriptor.code, repeat: event.repeat === true });
  };
  const keyup = event => {
    const descriptor = cadrM8KeyForCode(event?.code);
    if (descriptor === null) return;
    event.preventDefault?.();
    void dispatch({ op: "keyboard-up", code: descriptor.code });
  };
  const blur = () => { void dispatch({ op: "keyboard-focus-lost" }); };
  const removers = [addListener(target, "keydown", keydown), addListener(target, "keyup", keyup),
    addListener(target, "blur", blur)];
  return Object.freeze({ dispose() { for (const remove of removers.splice(0)) remove(); } });
}

/**
 * Attach the existing M9 adapter to one browser surface.  Geometry remains an
 * explicit caller-supplied transform; this binding never guesses scale or
 * letterbox offsets from CSS.  Lifecycle-triggered neutralization remains a
 * separate worker/core boundary until the selected System 303 pointer device
 * has an ABI witness.
 */
export function bindCadrM9PointerEvents({ target, adapter } = {}) {
  invariant(adapter !== null && typeof adapter === "object", "pointer adapter is required");
  for (const name of ["pointerDown", "pointerMove", "pointerUp", "lostPointerCapture"]) {
    invariant(typeof adapter[name] === "function", `pointer adapter lacks ${name}`);
  }
  const invoke = (method, event) => {
    try { void Promise.resolve(adapter[method](event)); }
    catch { /* The adapter records the rejection without leaking it to DOM dispatch. */ }
  };
  const removers = [
    addListener(target, "pointerdown", event => invoke("pointerDown", event)),
    addListener(target, "pointermove", event => invoke("pointerMove", event)),
    addListener(target, "pointerup", event => invoke("pointerUp", event)),
    addListener(target, "lostpointercapture", event => invoke("lostPointerCapture", event)),
  ];
  return Object.freeze({ dispose() { for (const remove of removers.splice(0)) remove(); } });
}
