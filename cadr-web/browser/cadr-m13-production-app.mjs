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
import {
  CadrM12ProductionDebugger, cadrM12ProductionDebuggerReceipt,
} from "./cadr-m12-production-debugger.mjs";
import { mountCadrM12DebuggerPanel } from "./cadr-m12-debugger-panel.mjs";

/* Additive M12-P2 composition is exported from the production entrypoint but
 * does not widen P1's frozen receipt or request-schema inventory. */
export {
  CADR_M12_PRODUCTION_DEBUGGER_PROFILE,
  CADR_M12_PRODUCTION_DEBUGGER_RECEIPT_SCHEMA,
  CADR_M12_PRODUCTION_DEBUGGER_STATES,
  CadrM12ProductionDebugger,
  cadrM12ProductionDebuggerReceipt,
  validateCadrM12ProductionDebuggerReceipt,
} from "./cadr-m12-production-debugger.mjs";

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

/* The handoff object is a module-private, linear capability.  It is not a
 * serializable receipt and no public constructor argument can manufacture it.
 * P1 creates it only after its exact FIFO reaches a quiescent PAUSED head. */
const P2_HANDOFFS = new WeakMap();
const P2_HANDOFF_BRAND = new WeakSet();

function debuggerFields(op, fields) {
  const schemas = {
    "machine-pause": [], "debug-inspect-read": ["arrayKind", "index"],
    "debug-breakpoint-set": ["slot", "breakpoint"], "debug-breakpoint-clear": ["slot"],
    "debug-resume-one-boundary": [], "debug-trace-filter": ["filter"],
    "debug-micro-step": [], "debug-macro-step": [], "debug-stop-record": [],
  };
  const allowed = schemas[op];
  if (allowed === undefined) throw new TypeError("P2 debugger operation is not in the exact handoff schema");
  const record = exactRecord(fields, `${op} P2 fields`, [], allowed);
  const output = Object.create(null);
  for (const [key, value] of Object.entries(record)) output[key] = copyValue(value, `${op}.${key}`);
  return Object.freeze(output);
}

function assertReviewAuthority(authority) {
  if (authority === null || typeof authority !== "object" ||
      typeof authority.acquire !== "function" || typeof authority.revoke !== "function") {
    throw new TypeError("P2 needs a restricted M10 review authority");
  }
  return authority;
}

/* This is deliberately a small host-side state machine rather than a
 * best-effort finally block.  M10's branded authority may be in
 * RECOVERY_REQUIRED after a post-pin acquisition failure whose rollback also
 * failed.  In that state revoke() must reject: only the same authority's next
 * acquire() is permitted to compensate the opaque pin.  The recovery lease is
 * retained privately until release succeeds, so every failed terminal action
 * remains observable and retryable without exposing an M10 handle or pin ID. */
export const CADR_M12_TERMINAL_CLEANUP_STATES = Object.freeze([
  "IDLE", "INVALIDATING", "INVALIDATION_RETRY_REQUIRED",
  "WORKER_TERMINATION_PENDING", "EXTERNAL_RECOVERY_REQUIRED",
  "M10_RELEASE_RETRY_REQUIRED", "AUTHORITY_REVOKING",
  "AUTHORITY_RECOVERING_ACQUIRE", "AUTHORITY_RECOVERING_RELEASE",
  "AUTHORITY_RECOVERY_RETRY_REQUIRED", "AUTHORITY_RELEASE_RETRY_REQUIRED",
  "AUTHORITY_REVOCATION_RETRY_REQUIRED", "REVOKED",
]);

class M12TerminalReviewAuthorityCleanup {
  #authority; #phase = "IDLE"; #reason = null; #attempts = 0; #failure = null;
  #lease = null; #recoveryLeaseReleased = false; #flight = null;

  constructor(authority) { this.#authority = authority; }

  get state() { return Object.freeze({ phase: this.#phase, reason: this.#reason,
    attempts: this.#attempts, retryable: this.#phase.endsWith("RETRY_REQUIRED"),
    failure: this.#failure }); }

  run(reason) {
    if (typeof reason !== "string" || reason.length === 0 || reason.length > 160) {
      return Promise.reject(new TypeError("P2 terminal cleanup reason is invalid"));
    }
    if (this.#phase === "REVOKED") return Promise.resolve(this.state);
    if (this.#flight !== null) return this.#flight;
    this.#reason = reason; this.#attempts += 1; this.#failure = null;
    const run = this.#run(reason);
    this.#flight = run;
    void run.then(() => {
      if (this.#flight === run) this.#flight = null;
    }, error => {
      this.#recordFailure(error);
      if (this.#flight === run) this.#flight = null;
      /* The P1 observer records this rejected attempt in terminalCleanup;
       * callers that deliberately retry receive the original rejection. */
      return error;
    });
    return run;
  }

  async #run(reason) {
    if (this.#lease !== null || this.#phase === "AUTHORITY_RELEASE_RETRY_REQUIRED") {
      return this.#releaseThenRevoke(reason);
    }
    if (this.#phase === "AUTHORITY_REVOCATION_RETRY_REQUIRED") return this.#revoke(reason);

    let directFailure;
    try { return this.#revoke(reason); }
    catch (error) { directFailure = error; }

    try {
      this.#phase = "AUTHORITY_RECOVERING_ACQUIRE";
      const lease = await this.#authority.acquire();
      if (lease === null || typeof lease !== "object" || typeof lease.release !== "function") {
        throw new ProductionCompositionError("P2 M10 recovery acquire returned an invalid lease");
      }
      this.#lease = lease;
      return await this.#releaseThenRevoke(reason);
    } catch (error) {
      if (error === directFailure) throw error;
      throw new AggregateError([directFailure, error],
        "P2 M10 terminal revocation requires explicit recovery retry");
    }
  }

  #revoke(reason) {
    this.#phase = "AUTHORITY_REVOKING";
    const receipt = this.#authority.revoke(reason);
    if (receipt !== null && typeof receipt === "object" && typeof receipt.then === "function") {
      throw new ProductionCompositionError("P2 M10 authority revoke must return a synchronous receipt");
    }
    if (receipt?.revoked !== true) {
      throw new ProductionCompositionError("P2 M10 authority revocation failed");
    }
    this.#phase = "REVOKED"; this.#failure = null;
    return this.state;
  }

  async #releaseThenRevoke(reason) {
    const lease = this.#lease;
    if (lease === null) throw new ProductionCompositionError("P2 M10 recovery lease was lost");
    this.#phase = "AUTHORITY_RECOVERING_RELEASE";
    const receipt = await lease.release();
    if (receipt?.released !== true) {
      throw new ProductionCompositionError("P2 M10 recovery lease release failed");
    }
    this.#lease = null; this.#recoveryLeaseReleased = true;
    return this.#revoke(reason);
  }

  #recordFailure(error) {
    if (this.#lease !== null) this.#phase = "AUTHORITY_RELEASE_RETRY_REQUIRED";
    else if (this.#recoveryLeaseReleased) this.#phase = "AUTHORITY_REVOCATION_RETRY_REQUIRED";
    else this.#phase = "AUTHORITY_RECOVERY_RETRY_REQUIRED";
    this.#failure = error;
  }
}

function validateP2Dependencies(value) {
  const deps = exactRecord(value, "P2 debugger dependencies", ["receipt", "audio"],
    ["exportBundle", "digest"]);
  const receipt = exactRecord(deps.receipt, "P2 debugger receipt", ["schema", "profile", "disposition"]);
  if (receipt.schema !== CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA ||
      receipt.profile !== cadrM12ProductionDebuggerReceipt().profile || receipt.disposition !== "source-only") {
    throw new TypeError("P2 debugger receipt mismatch");
  }
  const audio = exactRecord(deps.audio, "P2 audio dependency", ["joinTail", "pause", "reducePause"]);
  if (![audio.joinTail, audio.pause, audio.reducePause].every(value => typeof value === "function")) {
    throw new TypeError("P2 audio dependency is incomplete");
  }
  if (Object.hasOwn(deps, "exportBundle") && deps.exportBundle !== null && typeof deps.exportBundle !== "function") {
    throw new TypeError("P2 exporter is invalid");
  }
  if (Object.hasOwn(deps, "digest") && deps.digest !== null && typeof deps.digest !== "function") {
    throw new TypeError("P2 digest is invalid");
  }
  /* Capture only the three named audio callbacks.  This avoids passing a
   * host-wide audio handle into P2 merely because it supplied these methods. */
  return Object.freeze({ receipt: Object.freeze({ ...receipt }),
    audio: Object.freeze({ joinTail: audio.joinTail, pause: audio.pause, reducePause: audio.reducePause }),
    exportBundle: Object.hasOwn(deps, "exportBundle") ? deps.exportBundle : null,
    digest: Object.hasOwn(deps, "digest") ? deps.digest : null });
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
  #handoffRequested = false; #requestOwner = "P1"; #debuggerApp = null; #m10ReviewAuthorityFactory;
  /* M10 intentionally permits only one branded authority claim per
   * controller.  If P2 construction fails before ownership transfers, retain
   * that still-active, lease-free authority for the next handoff attempt;
   * revoking it would make a harmless constructor failure permanently consume
   * the controller's only review route. */
  #pendingM10ReviewAuthority = null;
  #pendingTerminalAuthorityCleanup = null; #terminalCleanupFlight = null;
  #workerTerminationPhase = "IDLE"; #workerTerminationFailure = null;

  constructor({ workerFactory, shellFactory = options => new CadrM13Shell(options), shellOptions = {},
    m10Controller, audioHandle = null, debuggerHandle = null, storageHandle = null,
    detachIngress = null, m10ReviewAuthorityFactory = null } = {}) {
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
    if (m10ReviewAuthorityFactory !== null && typeof m10ReviewAuthorityFactory !== "function") {
      throw new TypeError("P1 M10 review authority factory must be a function");
    }
    this.#workerFactory = workerFactory; this.#shellFactory = shellFactory; this.#shellOptions = Object.freeze({ ...shellOptions });
    this.#m10Controller = m10Controller; this.#audioHandle = audioHandle; this.#debuggerHandle = debuggerHandle;
    this.#storageHandle = storageHandle; this.#detachIngress = detachIngress;
    this.#m10ReviewAuthorityFactory = m10ReviewAuthorityFactory;
  }

  get state() { return this.#state; }
  get requestIdHighWater() { return this.#nextId - 1; }
  get workerCount() { return this.#worker === null ? 0 : 1; }
  get shellCount() { return this.#shell === null ? 0 : 1; }
  get terminalCleanup() {
    if (["WORKER_TERMINATION_PENDING", "EXTERNAL_RECOVERY_REQUIRED"].includes(this.#workerTerminationPhase)) {
      return Object.freeze({ phase: this.#workerTerminationPhase, reason: "P1-owned-worker-terminal",
        attempts: 1, retryable: false, failure: this.#workerTerminationFailure });
    }
    if (this.#debuggerApp !== null) return this.#debuggerApp.terminalCleanup;
    if (this.#pendingTerminalAuthorityCleanup !== null) return this.#pendingTerminalAuthorityCleanup.state;
    return Object.freeze({ phase: "IDLE", reason: null, attempts: 0, retryable: false, failure: null });
  }

  retryTerminalCleanup() {
    if (!this.#stopped) return Promise.reject(new ProductionCompositionError(
      "P1 terminal cleanup retry requires terminal loss"));
    if (this.#workerTerminationPhase === "EXTERNAL_RECOVERY_REQUIRED") {
      return Promise.resolve(this.terminalCleanup);
    }
    if (this.#debuggerApp !== null) {
      return this.#observeTerminalCleanup(this.#debuggerApp.retryTerminalCleanup("P1-terminal-retry"));
    }
    if (this.#pendingTerminalAuthorityCleanup !== null) {
      return this.#observeTerminalCleanup(this.#pendingTerminalAuthorityCleanup.run("P1-terminal-retry"), {
        clearPendingOnSuccess: true,
      });
    }
    return Promise.resolve(this.terminalCleanup);
  }

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
    this.#assertP1RequestOwner("bootstrap");
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
    this.#assertP1RequestOwner("resume");
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
    this.#assertP1RequestOwner("pause");
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
    this.#assertP1RequestOwner("input");
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

  /* Admission is intentionally synchronous.  As soon as this method returns a
   * promise, subsequent P1 request-producing entries are fenced, while work
   * already linked into #tail is allowed to finish before the head checks run. */
  handoffDebugger(deps) {
    const checked = validateP2Dependencies(deps);
    if (this.#handoffRequested || this.#requestOwner !== "P1") {
      return Promise.reject(new ProductionCompositionError("P1 debugger handoff is unavailable"));
    }
    this.#handoffRequested = true;
    const previous = this.#tail;
    const run = previous.then(async () => {
      let authority = null;
      try {
        if (this.#stopped || this.#state.phase !== "PAUSED" || this.#state.inputEnabled ||
            this.#resumePromise !== null || !cleanM10(this.#m10Controller) ||
            this.#shell === null || typeof this.#shell.submit !== "function" ||
            typeof this.#shell.openDebuggerHostTransaction !== "function" ||
            this.#shell.state === "FAILED") {
          throw new ProductionCompositionError("P1 debugger handoff requires a neutral paused clean live head");
        }
        if (await this.#shell.awaitInputNeutralization() !== true || this.#stopped ||
            this.#state.phase !== "PAUSED" || this.#state.inputEnabled || !cleanM10(this.#m10Controller)) {
          throw new ProductionCompositionError("P1 debugger handoff lost its neutral paused head");
        }
        authority = this.#claimReviewAuthority();
        const token = Object.freeze({}); const handoff = Object.freeze({});
        const submitDebugger = (op, fields = {}) => this.#submitHandoffDebugger(token, op, fields);
        const openSnapshotTransaction = () => {
          if (this.#requestOwner !== token || this.#stopped) throw new ProductionCompositionError("P2 snapshot authority is fenced");
          return this.#shell.openDebuggerHostTransaction();
        };
        P2_HANDOFFS.set(handoff, Object.freeze({ token, submitDebugger, openSnapshotTransaction,
          m10Authority: authority, deps: checked }));
        P2_HANDOFF_BRAND.add(handoff);
        /* Construction is intentionally before the owner flip.  Should an
         * injected constructor/dependency reject, the still-active authority
         * is revoked and P1 retains its original request stream and ID. */
        let debuggerApp;
        try { debuggerApp = new CadrM13ProductionP2DebuggerApp(handoff); }
        catch (error) {
          /* The authority has no lease and remains P1-private.  It is reused
           * by a retry rather than revoked, because M10 has a one-claim
           * authority boundary.  #closeAuthorities revokes it if P1 instead
           * terminates before that retry. */
          throw error;
        }
        this.#pendingM10ReviewAuthority = null;
        this.#requestOwner = token; this.#debuggerApp = debuggerApp;
        return debuggerApp;
      } catch (error) {
        this.#handoffRequested = false;
        throw error;
      }
    });
    this.#tail = run.catch(() => {});
    return run;
  }

  #transition(event) {
    const prior = this.#state;
    this.#state = reduceCadrM13Production(prior, event);
    if (!FENCED_STATES.has(prior.phase) && FENCED_STATES.has(this.#state.phase) && !this.#stopped) {
      this.#closeAuthorities(`reducer-${this.#state.reason ?? "failure"}`);
    }
    return this.#state;
  }
  #assertP1RequestOwner(label) {
    if (this.#handoffRequested || this.#requestOwner !== "P1") {
      throw new ProductionCompositionError(`P1 ${label} authority is fenced by debugger handoff`);
    }
  }
  #claimReviewAuthority() {
    if (this.#pendingM10ReviewAuthority !== null) return this.#pendingM10ReviewAuthority;
    const authority = this.#m10ReviewAuthorityFactory !== null ?
      this.#m10ReviewAuthorityFactory() : this.#m10Controller?.claimSnapshotReviewAuthority?.();
    this.#pendingM10ReviewAuthority = assertReviewAuthority(authority);
    return this.#pendingM10ReviewAuthority;
  }
  #current(generation) { return !this.#stopped && !FENCED_STATES.has(this.#state.phase) && this.#state.generation === generation; }

  #createShellOnce() {
    if (this.#worker !== null || this.#shell !== null) throw new ProductionCompositionError("worker/shell replacement is forbidden");
    const worker = this.#workerFactory(Object.freeze({ profile: P1_PROFILE }));
    if (worker === null || typeof worker !== "object" || typeof worker.terminate !== "function") {
      throw new ProductionCompositionError("worker factory did not return one terminable worker");
    }
    this.#worker = worker;
    if (this.#stopped) { this.#disposeOwnedWorker(); throw cancelled("worker acquisition was stopped"); }
    const shell = this.#shellFactory(Object.freeze({ ...this.#shellOptions,
      worker, m10Controller: this.#m10Controller, workerOwnership: "external",
      onWorkerLoss: loss => this.#handleWorkerLoss(loss) }));
    this.#shell = shell;
    if (this.#stopped) { this.#disposeOwnedWorker(); throw cancelled("shell acquisition was stopped"); }
    if (shell === null || typeof shell.submit !== "function" || typeof shell.releaseInput !== "function" ||
        typeof shell.awaitInputNeutralization !== "function" || typeof shell.restoreInputIngress !== "function" ||
        typeof shell.dispose !== "function" || typeof shell.terminateExternalWorker !== "function") {
      try { shell?.dispose?.({ terminateWorker: false }); } catch { /* incompatible shell is untrusted */ }
      this.#shell = null;
      throw new ProductionCompositionError("shell factory did not return CadrM13Shell-compatible boundary");
    }
  }

  #disposeOwnedWorker() {
    if (this.#workerTerminated) {
      try { this.#shell?.dispose?.({ terminateWorker: false }); } catch { /* worker is already terminal */ }
      return;
    }
    if (!this.#workerTerminated && this.#worker !== null) {
      this.#workerTerminationPhase = "WORKER_TERMINATION_PENDING";
      if (this.#shell === null) {
        try { this.#worker.terminate(); }
        catch (error) {
          this.#workerTerminationPhase = "EXTERNAL_RECOVERY_REQUIRED";
          this.#workerTerminationFailure = error;
          return;
        }
        this.#workerTerminated = true; this.#workerTerminationPhase = "CONFIRMED";
        this.#workerTerminationFailure = null; return;
      }
      let confirmation;
      try { confirmation = this.#shell.terminateExternalWorker("P1-owned-worker-terminal"); }
      catch (error) {
        this.#workerTerminationPhase = "EXTERNAL_RECOVERY_REQUIRED";
        this.#workerTerminationFailure = error;
        return;
      }
      if (confirmation?.terminated !== true || confirmation.disposition === undefined) {
        this.#workerTerminationPhase = "EXTERNAL_RECOVERY_REQUIRED";
        this.#workerTerminationFailure = new ProductionCompositionError(
          "P1 shell could not prove owned worker termination");
        return;
      }
      this.#workerTerminated = true;
      this.#workerTerminationPhase = "CONFIRMED"; this.#workerTerminationFailure = null;
      void Promise.resolve(confirmation.disposition).then(() => {
        /* P2's disposition callback owns the resulting state.  If durable
         * release failed, only explicit retryTerminalCleanup() may retry it. */
      }, () => { /* P2 retains the exact retryable disposition/M10 failure. */ });
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
    /* A terminal stop cannot await a hostile worker/shell teardown, but it may
     * not drop the one branded M10 recovery route.  Start the P2 state machine
     * and retain its named result for an explicit retry after the synchronous
     * ingress/handle/worker fence below has completed. */
    if (this.#debuggerApp !== null) {
      this.#observeTerminalCleanup(this.#debuggerApp.dispose(`P1-${reason}`));
    }
    if (this.#debuggerApp === null && this.#pendingM10ReviewAuthority !== null) {
      this.#pendingTerminalAuthorityCleanup ??= new M12TerminalReviewAuthorityCleanup(
        this.#pendingM10ReviewAuthority);
      this.#observeTerminalCleanup(this.#pendingTerminalAuthorityCleanup.run(`P1-${reason}`), {
        clearPendingOnSuccess: true,
      });
    }
    safeSynchronous(this.#audioHandle, ["pause", "fence", "closeForWorkerLoss"]);
    safeSynchronous(this.#debuggerHandle, ["pause", "fence", "dispose"]);
    safeSynchronous(this.#storageHandle, ["pause", "fence", "close"]);
    this.#disposeOwnedWorker();
  }

  #observeTerminalCleanup(flight, { clearPendingOnSuccess = false } = {}) {
    this.#terminalCleanupFlight = flight;
    void flight.then(() => {
      if (this.#terminalCleanupFlight !== flight) return;
      this.#terminalCleanupFlight = null;
      if (clearPendingOnSuccess) this.#pendingM10ReviewAuthority = null;
    }, error => {
      /* This is not a best-effort catch: both P2 and the retained authority
       * record a retryable terminalCleanup state before this observer consumes
       * the rejection, and retryTerminalCleanup() returns the next real flight. */
      if (this.#terminalCleanupFlight === flight) this.#terminalCleanupFlight = null;
      return error;
    });
    return flight;
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
  #submitHandoffDebugger(token, op, fields) {
    const safeFields = debuggerFields(op, fields);
    if (this.#requestOwner !== token || this.#stopped || this.#shell === null) {
      return Promise.reject(new ProductionCompositionError("P2 debugger request authority is fenced"));
    }
    const generation = this.#state.generation;
    const previous = this.#tail;
    const run = previous.then(async () => {
      if (this.#requestOwner !== token || this.#stopped || !this.#current(generation) ||
          this.#shell === null || this.#nextId > U32_MAX) {
        throw new ProductionCompositionError("P2 debugger request authority is fenced");
      }
      const id = this.#nextId++;
      const reply = await this.#shell.submit(Object.freeze({ ...safeFields,
        type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
        sessionId: this.#shell.sessionId, id, op }));
      if (!this.#current(generation)) throw cancelled("stale P2 debugger reply");
      return reply;
    });
    this.#tail = run.catch(() => {});
    return run;
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

/* Additive P2 composition for an already-paused P1.  Its constructor accepts
 * only the module-private linear handoff minted by P1; it never receives the
 * shell, controller, worker, or an independently allocatable request ID. */
export const CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA =
  "cadr-m13-production-p2-debugger-v1";
export const CADR_M13_PRODUCTION_P2_DEBUGGER_OPERATIONS = Object.freeze([
  "debug-inspect-read", "debug-breakpoint-set", "debug-breakpoint-clear",
  "debug-resume-one-boundary", "debug-trace-filter", "debug-micro-step",
  "debug-macro-step", "debug-stop-record",
]);

export class CadrM13ProductionP2DebuggerApp {
  #submitDebugger; #debugger; #tail = Promise.resolve(); #terminal = false;
  #terminalAuthorityCleanup; #terminalCleanupPhase = "IDLE"; #terminalCleanupReason = null;
  #terminalCleanupFailure = null; #terminalCleanupAttempts = 0; #terminalCleanupFlight = null;
  constructor(handoff) {
    const record = P2_HANDOFFS.get(handoff);
    if (!P2_HANDOFF_BRAND.has(handoff) || record === undefined) {
      throw new TypeError("P2 debugger must be created by P1 handoffDebugger()");
    }
    P2_HANDOFF_BRAND.delete(handoff); P2_HANDOFFS.delete(handoff);
    this.#submitDebugger = record.submitDebugger;
    /* Do not read acquire/revoke here.  A constructor-only failure must leave
     * P1's single claimed authority reusable for its next handoff attempt. */
    this.#terminalAuthorityCleanup = new M12TerminalReviewAuthorityCleanup(record.m10Authority);
    this.#debugger = new CadrM12ProductionDebugger({
      request: (op, fields) => this.#submit(op, fields),
      openSnapshotTransaction: record.openSnapshotTransaction,
      receipt: cadrM12ProductionDebuggerReceipt(), audio: record.deps.audio,
      m10Authority: record.m10Authority, exportBundle: record.deps.exportBundle,
      digest: record.deps.digest,
    });
  }
  get state() { return this.#debugger.state; }
  get review() { return this.#debugger.review; }
  get zeroizationReceipt() { return this.#debugger.zeroizationReceipt; }
  get terminalCleanup() { return Object.freeze({ phase: this.#terminalCleanupPhase,
    reason: this.#terminalCleanupReason, attempts: this.#terminalCleanupAttempts,
    retryable: this.#terminalCleanupPhase.endsWith("RETRY_REQUIRED") &&
      this.#terminalCleanupPhase !== "EXTERNAL_RECOVERY_REQUIRED",
    failure: this.#terminalCleanupFailure,
    authority: this.#terminalAuthorityCleanup.state }); }
  request(op, fields = {}) { return this.#debugger.request(op, fields); }
  prepareReview() { return this.#debugger.prepareReview(); }
  beginReviewExport() { return this.#debugger.beginReviewExport(); }
  completeReviewExport(token) { return this.#debugger.completeReviewExport(token); }
  discardReview() { return this.#debugger.discardReview(); }
  mountPanel({ documentObject = globalThis.document, root } = {}) {
    return mountCadrM12DebuggerPanel({ documentObject, root,
      request: (op, fields) => this.request(op, fields),
      prepareReview: () => this.prepareReview(),
      beginReviewExport: () => this.beginReviewExport(),
      completeReviewExport: token => this.completeReviewExport(token),
      discardReview: () => this.discardReview(),
      getProvenance: () => this.review?.provenance,
    });
  }
  invalidate(reason = "production-composition-invalidated") {
    return this.dispose(reason);
  }
  dispose(reason = "production-composition-disposed") {
    this.#terminal = true;
    return this.#runTerminalCleanup(reason);
  }
  retryTerminalCleanup(reason = "production-composition-terminal-retry") {
    if (!this.#terminal) return Promise.reject(new ProductionCompositionError(
      "P2 terminal cleanup retry requires terminal invalidation"));
    return this.#runTerminalCleanup(reason);
  }
  #runTerminalCleanup(reason) {
    if (typeof reason !== "string" || reason.length === 0 || reason.length > 160) {
      return Promise.reject(new TypeError("P2 terminal cleanup reason is invalid"));
    }
    if (this.#terminalCleanupPhase === "REVOKED") return Promise.resolve(this.terminalCleanup);
    if (this.#terminalCleanupPhase === "EXTERNAL_RECOVERY_REQUIRED" &&
        this.#debugger.cleanupDisposition === "UNKNOWN") {
      return Promise.resolve(this.terminalCleanup);
    }
    if (this.#terminalCleanupFlight !== null) return this.#terminalCleanupFlight;
    this.#terminalCleanupPhase = "INVALIDATING"; this.#terminalCleanupReason = reason;
    this.#terminalCleanupFailure = null; this.#terminalCleanupAttempts += 1;
    const run = this.#tail.then(async () => {
      try {
        const state = await this.#debugger.invalidate(reason);
        if (state === "RELEASE_REQUIRED") {
          this.#terminalCleanupPhase = this.#debugger.cleanupDisposition === "UNKNOWN" ?
            "EXTERNAL_RECOVERY_REQUIRED" : "M10_RELEASE_RETRY_REQUIRED";
          throw new ProductionCompositionError("P2 terminal cleanup retains an M10 lease for retry");
        }
        const authority = await this.#terminalAuthorityCleanup.run(reason);
        if (authority.phase !== "REVOKED") {
          throw new ProductionCompositionError("P2 terminal M10 authority did not reach REVOKED");
        }
        this.#terminalCleanupPhase = "REVOKED"; this.#terminalCleanupFailure = null;
        return this.terminalCleanup;
      } catch (error) {
        if (this.#debugger.state === "RELEASE_REQUIRED") {
          this.#terminalCleanupPhase = this.#debugger.cleanupDisposition === "UNKNOWN" ?
            "EXTERNAL_RECOVERY_REQUIRED" : "M10_RELEASE_RETRY_REQUIRED";
        } else if (this.#terminalAuthorityCleanup.state.phase !== "IDLE") {
          this.#terminalCleanupPhase = this.#terminalAuthorityCleanup.state.phase;
        } else {
          this.#terminalCleanupPhase = "INVALIDATION_RETRY_REQUIRED";
        }
        this.#terminalCleanupFailure = error;
        throw error;
      }
    });
    this.#tail = run.catch(() => {});
    this.#terminalCleanupFlight = run;
    void run.then(() => {
      if (this.#terminalCleanupFlight === run) this.#terminalCleanupFlight = null;
    }, error => {
      /* P1 observes this same flight and exposes retryTerminalCleanup(); this
       * local consumer prevents an unhandled terminal rejection without hiding
       * its named failure state. */
      if (this.#terminalCleanupFlight === run) this.#terminalCleanupFlight = null;
      return error;
    });
    return run;
  }
  #submit(op, fields) {
    const run = this.#tail.then(async () => {
      if (this.#terminal || !CADR_M13_PRODUCTION_P2_DEBUGGER_OPERATIONS.includes(op) && op !== "machine-pause") {
        throw new ProductionCompositionError("P2 debugger operation is fenced");
      }
      const reply = await this.#submitDebugger(op, fields);
      if (reply?.status === CADR_M13_STATUS.PROTOCOL_VIOLATION || reply?.status === CADR_M13_STATUS.WORKER_LOST || reply?.terminal === true) {
        this.#terminal = true;
      }
      /* 19/20 are direct debugger outcomes, not application failure. */
      if (![CADR_M13_STATUS.OK, 19, 20].includes(reply?.status)) throw new ProductionCompositionError(`${op} was rejected`);
      return reply;
    });
    this.#tail = run.catch(() => {}); return run;
  }
}
