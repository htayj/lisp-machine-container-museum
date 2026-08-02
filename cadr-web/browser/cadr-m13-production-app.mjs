/*
 * Source-only M13 production-composition P1 coordinator.
 *
 * This module deliberately owns no browser storage, media locator, lower
 * protocol, or direct input channel.  One instance creates exactly one
 * dedicated worker and one CadrM13Shell, and every public v8 request crosses
 * that shell through this coordinator's FIFO and request-ID counter.
 *
 * P1 is composition infrastructure, not selected-media runtime evidence,
 * durable export/restore support, an offline package, or a release surface.
 */
import {
  CADR_M13_PROFILE,
  CADR_M13_PROTOCOL_VERSION,
  CADR_M13_STATUS,
  CadrM13Shell,
} from "./cadr-m13-shell.mjs";

export const CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA =
  "cadr-m13-production-p1-receipt-v1";

export const CADR_M13_PRODUCTION_STATES = Object.freeze([
  "UNCONFIGURED", "RECEIPT_ACCEPTED", "INPUTS_SELECTED", "BOOTSTRAPPING",
  "BASE_IMPORTING", "MEDIA_MOUNTED", "M10_CLEAN", "PAUSED", "RUNNING",
  "STOPPED", "FAILED", "IN_DOUBT", "RECOVERY_REQUIRED",
]);

export const CADR_M13_PRODUCTION_INPUT_OPERATIONS = Object.freeze([
  "keyboard-down", "keyboard-up", "keyboard-focus-lost", "keyboard-drain",
  "keyboard-state", "pointer-motion", "pointer-down", "pointer-up",
  "pointer-neutralize", "pointer-warp-request", "pointer-state", "pointer-drain",
]);

const P1_PROFILE = CADR_M13_PROFILE;
const INPUT_OPERATIONS = new Set(CADR_M13_PRODUCTION_INPUT_OPERATIONS);
const FENCED_STATES = new Set(["FAILED", "IN_DOUBT", "RECOVERY_REQUIRED"]);
const U32_MAX = 0xffffffff;

/* P1 freezes its own request-field surface instead of inheriting later shell
 * additions.  Common v8 authority fields are deliberately absent: callers
 * may supply only the fields belonging to the separately selected operation. */
export const CADR_M13_PRODUCTION_REQUEST_SCHEMAS = Object.freeze({
  bootstrap: Object.freeze(["wasmBytes", "wasmSha256"]),
  "base-import-begin": Object.freeze(["role", "byteCount", "sha256"]),
  "base-import-chunk": Object.freeze(["importId", "offset", "bytes", "chunkSha256"]),
  "base-import-finish": Object.freeze(["importId"]),
  "base-media-mount": Object.freeze(["importId"]),
  "m10-reopen": Object.freeze(["diskUuid", "baseSha256", "profileSha256", "artifactSetSha256", "createIfMissing"]),
  "machine-cold-power-on": Object.freeze([]),
  "machine-boot": Object.freeze([]),
  "machine-visibility": Object.freeze(["hidden"]),
  "machine-pause": Object.freeze([]),
  "machine-start": Object.freeze([]),
  "keyboard-down": Object.freeze(["code", "repeat"]),
  "keyboard-up": Object.freeze(["code"]),
  "keyboard-focus-lost": Object.freeze([]),
  "keyboard-drain": Object.freeze(["maxEvents"]),
  "keyboard-state": Object.freeze([]),
  "pointer-motion": Object.freeze(["x", "y", "cause", "tick", "generation", "ingressOrdinal"]),
  "pointer-down": Object.freeze(["domButton", "x", "y", "cause", "tick", "generation", "ingressOrdinal"]),
  "pointer-up": Object.freeze(["domButton", "x", "y", "cause", "tick", "generation", "ingressOrdinal"]),
  "pointer-neutralize": Object.freeze(["cause", "tick", "generation"]),
  "pointer-warp-request": Object.freeze(["cursorState", "x", "y", "generation"]),
  "pointer-state": Object.freeze([]),
  "pointer-drain": Object.freeze(["maxEntries"]),
});

class ProductionCompositionError extends Error {
  constructor(message, kind = "FAILED") {
    super(message); this.name = "ProductionCompositionError"; this.kind = kind;
  }
}

function cancelled(message) { return new ProductionCompositionError(message, "CANCELLED"); }

function frozenState(phase, generation = 0, inputEnabled = false, reason = null) {
  return Object.freeze({ phase, generation, inputEnabled, reason });
}

function knownState(state) {
  return state !== null && typeof state === "object" &&
    CADR_M13_PRODUCTION_STATES.includes(state.phase) &&
    Number.isSafeInteger(state.generation) && state.generation >= 0 &&
    typeof state.inputEnabled === "boolean";
}

function transition(state, phase, { inputEnabled = false, reason = null, advance = false } = {}) {
  return frozenState(phase, state.generation + (advance ? 1 : 0), inputEnabled, reason);
}

/* The reducer is intentionally smaller than the shell.  It controls only
 * composition ownership and treats every unexpected event as a fenced failure
 * instead of attempting an inferred rollback. */
export function reduceCadrM13Production(state = frozenState("UNCONFIGURED"), event = null) {
  if (!knownState(state)) return frozenState("FAILED", 0, false, "invalid-state");
  const type = event?.type;
  if (typeof type !== "string") return transition(state, "FAILED", { reason: "invalid-event", advance: true });
  if (FENCED_STATES.has(state.phase)) return state;
  if (type === "FAIL") {
    const kind = event.kind === "IN_DOUBT" || event.kind === "RECOVERY_REQUIRED" ? event.kind : "FAILED";
    return transition(state, kind, { reason: event.reason ?? "failure", advance: true });
  }
  if (type === "STOP") {
    return state.phase === "STOPPED" ? state : transition(state, "STOPPED", { reason: event.reason ?? "stopped", advance: true });
  }
  if (type === "FENCE_INPUT") {
    return transition(state, state.phase, { reason: event.reason ?? state.reason, advance: true });
  }
  const legal = {
    UNCONFIGURED: { RECEIPT_ACCEPTED: "RECEIPT_ACCEPTED" },
    RECEIPT_ACCEPTED: { INPUTS_SELECTED: "INPUTS_SELECTED" },
    INPUTS_SELECTED: { BOOTSTRAP_STARTED: "BOOTSTRAPPING" },
    BOOTSTRAPPING: { BOOTSTRAP_COMPLETE: "BASE_IMPORTING" },
    BASE_IMPORTING: { BASE_COMPLETE: "MEDIA_MOUNTED" },
    MEDIA_MOUNTED: { M10_CLEAN: "M10_CLEAN" },
    M10_CLEAN: { PAUSE_READY: "PAUSED" },
    PAUSED: { RUN: "RUNNING" },
    RUNNING: { PAUSE_READY: "PAUSED" },
  };
  const next = legal[state.phase]?.[type];
  if (next === undefined) return transition(state, "FAILED", {
    reason: `illegal-${state.phase.toLowerCase()}-${type.toLowerCase()}`, advance: true,
  });
  return transition(state, next, { inputEnabled: type === "RUN" && event.inputEnabled === true });
}

function exactRecord(value, label, required, optional = []) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) throw new TypeError(`${label} has an inherited prototype`);
  const allowed = new Set([...required, ...optional]);
  const output = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) throw new TypeError(`${label} has an unknown field`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || descriptor.get !== undefined || descriptor.set !== undefined) {
      throw new TypeError(`${label}.${key} is an accessor`);
    }
    output[key] = descriptor.value;
  }
  for (const key of required) if (!Object.hasOwn(output, key)) throw new TypeError(`${label}.${key} is required`);
  return output;
}

function copyValue(value, label, depth = 0) {
  if (depth > 16) throw new TypeError(`${label} exceeds the P1 nesting bound`);
  if (value === null || typeof value === "boolean" || typeof value === "string" ||
      typeof value === "number" || typeof value === "bigint") return value;
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (Array.isArray(value)) return Object.freeze(value.map((item, index) => copyValue(item, `${label}[${index}]`, depth + 1)));
  if (value !== null && typeof value === "object") {
    const record = exactRecord(value, label, [], Reflect.ownKeys(value).filter(key => typeof key === "string"));
    const output = Object.create(null);
    for (const [key, item] of Object.entries(record)) output[key] = copyValue(item, `${label}.${key}`, depth + 1);
    return Object.freeze(output);
  }
  throw new TypeError(`${label} is not a copied record value`);
}

function operationFields(op, value, label = `${op} fields`) {
  const allowed = CADR_M13_PRODUCTION_REQUEST_SCHEMAS[op];
  if (allowed === undefined) throw new TypeError(`${label} has no P1 operation schema`);
  const record = exactRecord(value, label, [], allowed);
  const output = Object.create(null);
  for (const [key, item] of Object.entries(record)) output[key] = copyValue(item, `${label}.${key}`);
  return Object.freeze(output);
}

function inputStep(value, index) {
  const record = exactRecord(value, `baseImport[${index}]`, ["op", "fields"]);
  if (!["base-import-begin", "base-import-chunk", "base-import-finish"].includes(record.op)) {
    throw new TypeError(`baseImport[${index}] has an unapproved operation`);
  }
  return Object.freeze({ op: record.op,
    fields: operationFields(record.op, record.fields, `baseImport[${index}].fields`) });
}

function validateReceipt(value) {
  const receipt = exactRecord(value, "P1 receipt", ["schema", "profile", "disposition"]);
  if (receipt.schema !== CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA || receipt.profile !== P1_PROFILE ||
      receipt.disposition !== "source-only") {
    throw new TypeError("P1 receipt does not name this source-only composition profile");
  }
  return Object.freeze({ ...receipt });
}

function validateInputs(value) {
  const inputs = exactRecord(value, "P1 inputs", ["wasm", "baseImport", "mount", "m10Reopen"]);
  const wasm = operationFields("bootstrap", inputs.wasm, "P1 Wasm input");
  if (!(wasm.wasmBytes instanceof ArrayBuffer) || typeof wasm.wasmSha256 !== "string") {
    throw new TypeError("P1 Wasm input is not an admitted byte/hash pair");
  }
  if (!Array.isArray(inputs.baseImport) || inputs.baseImport.length < 2) {
    throw new TypeError("P1 base import needs a bounded begin/finish sequence");
  }
  const baseImport = inputs.baseImport.map(inputStep);
  if (baseImport[0].op !== "base-import-begin" || baseImport.at(-1).op !== "base-import-finish" ||
      baseImport.slice(1, -1).some(step => step.op !== "base-import-chunk")) {
    throw new TypeError("P1 base import is not ordered begin, chunks, finish");
  }
  const mount = operationFields("base-media-mount", inputs.mount, "P1 media mount");
  if (!Object.hasOwn(mount, "importId")) throw new TypeError("P1 media mount.importId is required");
  const m10Reopen = operationFields("m10-reopen", inputs.m10Reopen, "P1 M10 reopen");
  return Object.freeze({
    wasm: Object.freeze({ wasmBytes: wasm.wasmBytes.slice(0), wasmSha256: wasm.wasmSha256 }),
    baseImport: Object.freeze(baseImport), mount: Object.freeze({ ...mount }), m10Reopen,
  });
}

function cleanM10(controller) {
  try {
    const status = controller?.status?.();
    return status?.state === "CLEAN" && status.open === true && status.readOnly === false;
  } catch { return false; }
}

function m10Disposition(controller) {
  try {
    const status = controller?.status?.();
    return typeof status?.state === "string" ? status.state : null;
  } catch { return null; }
}

function safeSynchronous(handle, names) {
  for (const name of names) {
    try { handle?.[name]?.(); } catch { /* terminal cleanup remains best effort */ }
  }
}

/**
 * One production composition may exist per page authority.  A caller supplies
 * the dedicated-worker factory and the already configured M10/controller shell
 * dependencies.  P1 intentionally does not create a durable backend or locate
 * selected media itself.
 */
export class CadrM13ProductionApp {
  #workerFactory; #shellFactory; #shellOptions; #m10Controller; #audioHandle; #debuggerHandle; #storageHandle;
  #worker = null; #shell = null; #receipt = null; #inputs = null; #state = frozenState("UNCONFIGURED");
  #nextId = 1; #tail = Promise.resolve(); #resumePromise = null; #stopped = false; #detachIngress; #workerTerminated = false;

  constructor({ workerFactory, shellFactory = options => new CadrM13Shell(options), shellOptions = {},
    m10Controller, audioHandle = null, debuggerHandle = null, storageHandle = null,
    detachIngress = null } = {}) {
    if (typeof workerFactory !== "function" || typeof shellFactory !== "function") {
      throw new TypeError("P1 needs a worker and shell factory");
    }
    if (m10Controller === null || typeof m10Controller?.status !== "function") {
      throw new TypeError("P1 needs the existing M10 controller");
    }
    if (shellOptions === null || typeof shellOptions !== "object" ||
        ["worker", "m10Controller", "initialId", "workerOwnership", "onWorkerLoss",
          "requestCanonicalizer", "sha256Function"].some(key => Object.hasOwn(shellOptions, key))) {
      throw new TypeError("P1 shell options must not replace worker, M10, ID, ownership, or loss-report authority");
    }
    if (detachIngress !== null && typeof detachIngress !== "function") throw new TypeError("P1 ingress fence must be a function");
    this.#workerFactory = workerFactory; this.#shellFactory = shellFactory; this.#shellOptions = Object.freeze({ ...shellOptions });
    this.#m10Controller = m10Controller; this.#audioHandle = audioHandle; this.#debuggerHandle = debuggerHandle;
    this.#storageHandle = storageHandle; this.#detachIngress = detachIngress;
  }

  get state() { return this.#state; }
  get requestIdHighWater() { return this.#nextId - 1; }
  get workerCount() { return this.#worker === null ? 0 : 1; }
  get shellCount() { return this.#shell === null ? 0 : 1; }

  acceptReceipt(receipt) {
    if (this.#state.phase !== "UNCONFIGURED") return this.#fail("receipt-replay");
    try { this.#receipt = validateReceipt(receipt); this.#transition({ type: "RECEIPT_ACCEPTED" }); return this.#state; }
    catch { return this.#fail("invalid-receipt"); }
  }

  selectInputs(inputs) {
    if (this.#state.phase !== "RECEIPT_ACCEPTED") return this.#fail("inputs-before-receipt");
    /* Selection is pure admission: a hostile recipe is rejected before the
       reducer, worker, shell, or request-ID authority changes. */
    this.#inputs = validateInputs(inputs);
    this.#transition({ type: "INPUTS_SELECTED" });
    return this.#state;
  }

  async bootstrapToPaused() {
    if (this.#state.phase !== "INPUTS_SELECTED") return this.#fail("bootstrap-without-inputs");
    this.#transition({ type: "BOOTSTRAP_STARTED" });
    const generation = this.#state.generation;
    return this.#enqueue(generation, async () => {
      try {
        this.#createShellOnce();
        await this.#request(generation, "bootstrap", this.#inputs.wasm);
        this.#transition({ type: "BOOTSTRAP_COMPLETE" });
        for (const step of this.#inputs.baseImport) await this.#request(generation, step.op, step.fields);
        await this.#request(generation, "base-media-mount", this.#inputs.mount);
        this.#transition({ type: "BASE_COMPLETE" });
        /* `MEDIA_MOUNTED` means only that the shell accepted the selected
           source recipe.  It is not a claim that a selected runtime booted. */
        await this.#request(generation, "m10-reopen", this.#inputs.m10Reopen);
        if (!cleanM10(this.#m10Controller)) throw new ProductionCompositionError("M10 did not reach CLEAN", "RECOVERY_REQUIRED");
        this.#transition({ type: "M10_CLEAN" });
        for (const [op, fields] of [
          ["machine-cold-power-on", {}], ["machine-boot", {}],
          ["machine-visibility", { hidden: false }], ["machine-pause", {}],
        ]) await this.#request(generation, op, fields);
        if (!this.#current(generation)) return this.#state;
        const neutralGeneration = this.#fenceInput("startup-paused");
        if (await this.#shell.awaitInputNeutralization() !== true || !this.#current(neutralGeneration)) {
          throw new ProductionCompositionError("startup neutralization did not close");
        }
        this.#transition({ type: "PAUSE_READY" });
        return this.#state;
      } catch (error) { return this.#failFrom(error, "bootstrap-failed"); }
    });
  }

  resume() {
    if (this.#resumePromise !== null) return this.#resumePromise;
    if (this.#state.phase !== "PAUSED") return Promise.resolve(this.#fail("resume-outside-paused"));
    const generation = this.#state.generation;
    const flight = this.#enqueue(generation, async () => {
      try {
        if (!cleanM10(this.#m10Controller)) throw new ProductionCompositionError("M10 is not clean", "RECOVERY_REQUIRED");
        /* The shell verifies neutral acknowledgement, a fresh full CDRDISP1
           frame, and the same clean M10 controller before it can attach
           ingress.  This app retains its own gate until machine start wins. */
        if (await this.#shell.restoreInputIngress() !== true || !this.#current(generation) || !cleanM10(this.#m10Controller)) {
          throw new ProductionCompositionError("input handshake did not close");
        }
        await this.#request(generation, "machine-start", {});
        if (!this.#current(generation)) return this.#state;
        this.#transition({ type: "RUN", inputEnabled: true });
        return this.#state;
      } catch (error) { return this.#failFrom(error, "resume-failed"); }
    });
    this.#resumePromise = flight;
    void flight.finally(() => { if (this.#resumePromise === flight) this.#resumePromise = null; });
    return flight;
  }

  async pause(reason = "pause") {
    if (!["RUNNING", "PAUSED"].includes(this.#state.phase)) return this.#fail("pause-outside-running");
    const generation = this.#fenceInput(reason);
    return this.#enqueue(generation, async () => {
      try {
        const [neutral] = await Promise.all([
          this.#shell.awaitInputNeutralization(),
          this.#request(generation, "machine-pause", {}),
        ]);
        if (neutral !== true || !this.#current(generation)) throw cancelled("pause generation was fenced");
        if (this.#state.phase === "RUNNING") this.#transition({ type: "PAUSE_READY" });
        return this.#state;
      } catch (error) { return this.#failFrom(error, "pause-failed"); }
    });
  }

  layoutChanged() { return this.pause("layout-change"); }
  releaseInput() { return this.pause("release-input"); }

  async submitInput(op, fields = {}) {
    if (!INPUT_OPERATIONS.has(op) || this.#state.phase !== "RUNNING" || !this.#state.inputEnabled) {
      throw new ProductionCompositionError("input is fenced");
    }
    /* Admission precedes FIFO insertion, request-ID allocation, and every
       reducer mutation.  Operation identity is a separate argument. */
    const safeFields = operationFields(op, fields, `${op} input fields`);
    const generation = this.#state.generation;
    try { return await this.#enqueue(generation, () => this.#request(generation, op, safeFields)); }
    catch (error) { return this.#failFrom(error, "input-rejected"); }
  }

  stop(reason = "stop") {
    if (this.#stopped) return this.#state;
    this.#transition({ type: "STOP", reason });
    /* This ordering is intentionally synchronous.  It removes DOM ingress and
       fences every optional handle before the sole shell can terminate its
       worker; no queued response may then re-open input. */
    this.#closeAuthorities(`stop-${reason}`);
    return this.#state;
  }

  #transition(event) {
    const prior = this.#state;
    this.#state = reduceCadrM13Production(prior, event);
    if (!FENCED_STATES.has(prior.phase) && FENCED_STATES.has(this.#state.phase) && !this.#stopped) {
      this.#closeAuthorities(`reducer-${this.#state.reason ?? "failure"}`);
    }
    return this.#state;
  }
  #current(generation) { return !this.#stopped && !FENCED_STATES.has(this.#state.phase) && this.#state.generation === generation; }

  #createShellOnce() {
    if (this.#worker !== null || this.#shell !== null) throw new ProductionCompositionError("worker/shell replacement is forbidden");
    const worker = this.#workerFactory(Object.freeze({ profile: P1_PROFILE }));
    if (worker === null || typeof worker !== "object") throw new ProductionCompositionError("worker factory did not return one worker");
    this.#worker = worker;
    if (this.#stopped) { this.#disposeOwnedWorker(); throw cancelled("worker acquisition was stopped"); }
    const shell = this.#shellFactory(Object.freeze({ ...this.#shellOptions,
      worker, m10Controller: this.#m10Controller, workerOwnership: "external",
      onWorkerLoss: loss => this.#handleWorkerLoss(loss) }));
    this.#shell = shell;
    if (this.#stopped) { this.#disposeOwnedWorker(); throw cancelled("shell acquisition was stopped"); }
    if (shell === null || typeof shell.submit !== "function" || typeof shell.releaseInput !== "function" ||
        typeof shell.awaitInputNeutralization !== "function" || typeof shell.restoreInputIngress !== "function" ||
        typeof shell.dispose !== "function") {
      throw new ProductionCompositionError("shell factory did not return CadrM13Shell-compatible boundary");
    }
  }

  #disposeOwnedWorker() {
    try { this.#shell?.dispose?.({ terminateWorker: false }); } catch { /* direct worker disposer remains authoritative */ }
    if (!this.#workerTerminated && this.#worker !== null) {
      this.#workerTerminated = true;
      try { this.#worker.terminate?.(); } catch { /* terminal cleanup remains best effort */ }
    }
  }

  #workerFailureKind() {
    if (!["M10_CLEAN", "PAUSED", "RUNNING"].includes(this.#state.phase)) return "FAILED";
    const disposition = m10Disposition(this.#m10Controller);
    if (disposition === "IN_DOUBT") return "IN_DOUBT";
    if (disposition === "RECOVERY_REQUIRED") return "RECOVERY_REQUIRED";
    return "FAILED";
  }

  #handleWorkerLoss(loss) {
    if (this.#stopped || FENCED_STATES.has(this.#state.phase)) return;
    const reason = loss !== null && typeof loss === "object" && typeof loss.reason === "string" ?
      loss.reason : "worker-lost";
    this.#fail(reason, this.#workerFailureKind());
  }

  #closeAuthorities(reason) {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#fenceInput(reason);
    safeSynchronous(this.#audioHandle, ["pause", "fence", "closeForWorkerLoss"]);
    safeSynchronous(this.#debuggerHandle, ["pause", "fence", "dispose"]);
    safeSynchronous(this.#storageHandle, ["pause", "fence", "close"]);
    this.#disposeOwnedWorker();
  }

  #fenceInput(reason) {
    const prior = this.#state.generation;
    this.#state = reduceCadrM13Production(this.#state, { type: "FENCE_INPUT", reason });
    try { this.#detachIngress?.(Object.freeze({ reason, generation: this.#state.generation })); } catch { this.#fail("ingress-detach-failed"); }
    try { this.#shell?.releaseInput?.(reason); } catch { this.#fail("shell-input-release-failed"); }
    return this.#state.generation > prior ? this.#state.generation : prior;
  }

  #enqueue(generation, operation) {
    const run = this.#tail.then(async () => this.#current(generation) ? operation() : this.#state);
    this.#tail = run.catch(() => {});
    return run;
  }

  async #request(generation, op, fields) {
    if (!this.#current(generation)) throw cancelled("stale composition generation");
    const safeFields = operationFields(op, fields);
    if (this.#nextId > U32_MAX) throw new ProductionCompositionError("v8 request ID exhausted");
    const id = this.#nextId++;
    /* Authority fields are written last as defense in depth even though exact
       operation admission has already rejected every common-field override. */
    const reply = await this.#shell.submit(Object.freeze({ ...safeFields,
      type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
      sessionId: this.#shell.sessionId, id, op }));
    if (!this.#current(generation)) throw cancelled("stale composition reply");
    if (reply?.status !== CADR_M13_STATUS.OK || reply?.terminal === true) {
      const workerLoss = reply?.status === CADR_M13_STATUS.WORKER_LOST ||
        reply?.status === CADR_M13_STATUS.PROTOCOL_VIOLATION;
      const kind = workerLoss || reply?.status === CADR_M13_STATUS.HOST_FAILURE ? this.#workerFailureKind() :
        (op === "m10-reopen" ? "RECOVERY_REQUIRED" : "FAILED");
      const reason = typeof reply?.reason === "string" ? reply.reason : `${op} was rejected`;
      throw new ProductionCompositionError(reason, kind);
    }
    return reply;
  }

  #failFrom(error, fallback) {
    if (error instanceof ProductionCompositionError && error.kind === "CANCELLED") return this.#state;
    if (this.#stopped || FENCED_STATES.has(this.#state.phase)) return this.#state;
    return this.#fail(error instanceof ProductionCompositionError ? error.message : fallback,
      error instanceof ProductionCompositionError ? error.kind : "FAILED");
  }

  #fail(reason, kind = "FAILED") {
    if (FENCED_STATES.has(this.#state.phase)) return this.#state;
    this.#state = reduceCadrM13Production(this.#state, { type: "FAIL", reason, kind });
    this.#closeAuthorities(`failure-${reason}`);
    return this.#state;
  }
}
