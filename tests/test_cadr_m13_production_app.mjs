import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA,
  CADR_M13_PRODUCTION_REQUEST_SCHEMAS,
  CADR_M13_PRODUCTION_STATES,
  CadrM13ProductionApp,
  reduceCadrM13Production,
} from "../cadr-web/browser/cadr-m13-production-app.mjs";
import {
  CADR_M13_BASE_BLOCKS,
  CADR_M13_BASE_SHA256,
  CADR_M13_PROFILE,
  CadrM13BaseMediaBinding,
  CadrM13Shell,
  CadrM13StorageBoundary,
  canonicalizeCadrM13Request,
} from "../cadr-web/browser/cadr-m13-shell.mjs";

const receipt = Object.freeze({ schema: CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA,
  profile: CADR_M13_PROFILE, disposition: "source-only" });
const SELECTED_WASM_SHA256 = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";

function inputs() {
  return {
    wasm: { wasmBytes: Uint8Array.of(0).buffer, wasmSha256: "0".repeat(64) },
    baseImport: [
      { op: "base-import-begin", fields: { role: "synthetic" } },
      { op: "base-import-finish", fields: { importId: 1 } },
    ],
    mount: { importId: 1 },
    m10Reopen: {},
  };
}

class WorkerDouble {
  constructor(events = null) { this.events = events; }
  terminated = 0;
  terminate() { this.terminated += 1; this.events?.push("worker:terminate"); }
}

class ShellDouble {
  constructor(worker, { replies = null, events = null, restore = null } = {}) {
    this.worker = worker; this.sessionId = "a".repeat(64); this.requests = [];
    this.replies = replies ?? new Map(); this.events = events ?? [];
    this.restore = restore;
    this.releaseCount = 0; this.restoreCount = 0; this.disposed = 0;
  }
  async submit(request) {
    this.requests.push(request); this.events.push(`submit:${request.op}`);
    const response = this.replies.get(request.op);
    return response === undefined ? { status: 0 } : await response(request);
  }
  releaseInput(reason) { this.releaseCount += 1; this.events.push(`release:${reason}`); }
  async awaitInputNeutralization() { this.events.push("neutral-ready"); return true; }
  async restoreInputIngress() {
    this.restoreCount += 1; this.events.push("restore");
    return this.restore === null ? true : await this.restore();
  }
  dispose({ terminateWorker = true } = {}) {
    this.disposed += 1; this.events.push("dispose");
    if (terminateWorker) this.worker.terminate();
  }
}

class RealShellWorker extends WorkerDouble {
  listeners = new Map(); requests = [];
  addEventListener(type, listener) { const values = this.listeners.get(type) ?? []; values.push(listener); this.listeners.set(type, values); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(value => value !== listener)); }
  postMessage(value) { this.requests.push(value); }
  reply(request, fields = {}) {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: {
      type: "cadr-response", version: 8, id: request.id, op: request.op,
      status: 0, ok: true, ...fields,
    } });
  }
  audioEvent(fields = {}) {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: {
      type: "cadr-event", version: 8, op: "audio-packets", ...fields,
    } });
  }
}

class ProductionFaultWorker extends RealShellWorker {
  holdOperation = null;
  postMessage(value) {
    this.requests.push(value);
    if (value.op === this.holdOperation) return;
    queueMicrotask(() => this.reply(value, value.op === "display-full" ?
      { full: true, frame: fullFrame() } : { lifecycle: "PAUSED" }));
  }
  fault(type) {
    for (const listener of this.listeners.get(type) ?? []) listener({ error: new Error(`injected ${type}`) });
  }
}

function fullFrame() {
  const frame = new Uint8Array(80 + 16 + (24 * 963 * 4));
  const view = new DataView(frame.buffer); frame.set(new TextEncoder().encode("CDRDISP1"), 0);
  view.setUint16(8, 1, true); view.setUint16(10, 80, true); view.setUint32(12, 3, true);
  view.setBigUint64(16, 1n, true); view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true); view.setUint32(36, 963, true); view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true); view.setUint32(48, 23112, true);
  view.setUint32(56, 1, true); view.setUint32(60, 23112, true);
  view.setBigUint64(64, 92448n, true); view.setBigUint64(72, BigInt(frame.byteLength), true);
  view.setUint32(88, 768, true); view.setUint32(92, 963, true);
  return frame.buffer;
}

function cleanController() {
  return { clean: true, status() { return { state: this.clean ? "CLEAN" : "RECOVERY_REQUIRED",
    open: this.clean, readOnly: !this.clean }; } };
}

function inDoubtController() {
  return Object.freeze({ status() { return { state: "IN_DOUBT", open: false, readOnly: true }; } });
}

function selectedInputs() {
  return {
    wasm: { wasmBytes: Uint8Array.of(0).buffer, wasmSha256: SELECTED_WASM_SHA256 },
    baseImport: [
      { op: "base-import-begin", fields: { role: "system-303-base", byteCount: 269562880,
        sha256: CADR_M13_BASE_SHA256 } },
      { op: "base-import-finish", fields: { importId: 1 } },
    ],
    mount: { importId: 1 },
    m10Reopen: { diskUuid: "01".repeat(16), baseSha256: CADR_M13_BASE_SHA256,
      profileSha256: "02".repeat(32), artifactSetSha256: "03".repeat(32), createIfMissing: true },
  };
}

function selectedBootArtifacts() {
  return [
    { kind: 1, bytes: new ArrayBuffer(854) }, { kind: 2, bytes: new ArrayBuffer(20480) },
    { kind: 4, bytes: new ArrayBuffer(3130) }, { kind: 5, bytes: new ArrayBuffer(83270) },
  ];
}

function realCompositionFixture({ holdStage = null, preDispatch = null, audioBoundary = null } = {}) {
  const events = []; const worker = new ProductionFaultWorker(events);
  const reached = Object.create(null); const reach = name => {
    let resolve; const promise = new Promise(value => { resolve = value; });
    let continueResolve; const continuation = new Promise(value => { continueResolve = value; });
    reached[name] = Object.freeze({ promise, resolve, continuation, continue: continueResolve });
  };
  for (const name of ["base-import", "mount", "m10-reopen", "canonicalizer", "hash", "compiler"]) reach(name);
  let disposition = "RECOVERY_REQUIRED";
  const controller = {
    status() { return { state: disposition, open: disposition === "CLEAN", readOnly: disposition !== "CLEAN" }; },
    setDisposition(value) { disposition = value; },
    async commitWrites() {}, async readBlock() { return new Uint8Array(1024); },
    async invalidateAfterAmbiguousGuest() {},
  };
  const service = {
    async beginBaseImport() {
      if (holdStage === "base-import") { reached["base-import"].resolve(); await reached["base-import"].continuation; }
      return Object.freeze({ importId: 1, nextOffset: 0n });
    },
    async appendBaseImport() { throw new Error("not used"); },
    async finishBaseImport() { return Object.freeze({ role: "system-303-base", byteCount: 269562880n,
      sha256: CADR_M13_BASE_SHA256, blockBytes: 1024, blockCount: CADR_M13_BASE_BLOCKS }); },
    async readBaseRange() { throw new Error("fast binding owns mount reads"); },
    async reopenDisk() {
      if (holdStage === "m10-reopen") { reached["m10-reopen"].resolve(); await reached["m10-reopen"].continuation; }
      disposition = "CLEAN"; return Object.freeze({ mounted: true });
    },
  };
  const boundary = new CadrM13StorageBoundary(service);
  class FastBinding extends CadrM13BaseMediaBinding {
    phase = "IDLE"; next = 0;
    beginMount() { this.phase = "MOUNTING"; this.next = 0; }
    abortMount() { this.phase = "IDLE"; this.next = 0; }
    async readMountRange(firstBlock, blockCount) {
      assert.equal(firstBlock, this.next);
      if (holdStage === "mount" && firstBlock === 0) { reached.mount.resolve(); await reached.mount.continuation; }
      this.next += blockCount; return new Uint8Array(1);
    }
    finishMount() { assert.equal(this.next, CADR_M13_BASE_BLOCKS); this.phase = "MOUNTED"; }
  }
  const binding = new FastBinding({ storage: boundary });
  if (holdStage === "instantiate") worker.holdOperation = "instantiate";
  if (holdStage === "pending-input") worker.holdOperation = "keyboard-down";
  const app = new CadrM13ProductionApp({ workerFactory() { return worker; }, m10Controller: controller,
    shellFactory: preDispatch === null ? undefined : options => new CadrM13Shell({ ...options,
      requestCanonicalizer: async (...args) => {
        if (preDispatch === "canonicalizer") { reached.canonicalizer.resolve(); await reached.canonicalizer.continuation; }
        return canonicalizeCadrM13Request(...args);
      },
      sha256Function: async value => {
        if (preDispatch === "hash") { reached.hash.resolve(); await reached.hash.continuation; }
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", value))].map(
          byte => byte.toString(16).padStart(2, "0")).join("");
      },
      wasmCompiler: async () => {
        if (preDispatch === "compiler") { reached.compiler.resolve(); await reached.compiler.continuation; }
        return Object.freeze({});
      },
    }),
    shellOptions: { storage: boundary, baseMediaBinding: binding,
      selectedBootArtifacts: selectedBootArtifacts(), selectedWasmSha256: SELECTED_WASM_SHA256,
      ...(audioBoundary === null ? {} : { audioBoundary }),
      ...(preDispatch === null ? { wasmCompiler: async () => Object.freeze({}) } : {}),
      m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
      sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x41) },
    detachIngress({ reason }) { events.push(`detach:${reason}`); },
    ...{ audioHandle: cleanupHandles(events).audio, debuggerHandle: cleanupHandles(events).debugger,
      storageHandle: cleanupHandles(events).storage },
  });
  return { app, worker, controller, events, reached };
}

function pendingAudioBoundary() {
  let release;
  const acceptance = new Promise(resolve => { release = resolve; });
  const observations = { accepted: 0, closed: 0 };
  return {
    observations,
    release(value = true) { release(value); },
    boundary: {
      prepareActivation() { return false; },
      async open() { return { status: 0 }; },
      async pause() { return { status: 0 }; },
      async resume() { return { status: 0 }; },
      acceptWorkerEvent() { observations.accepted += 1; return acceptance; },
      closeForWorkerLoss() { observations.closed += 1; },
    },
  };
}

async function withoutUnhandledRejection(operation, label) {
  const unhandled = [];
  const listener = reason => { unhandled.push(reason); };
  process.on("unhandledRejection", listener);
  try {
    await operation();
    await flushTurns();
    assert.deepEqual(unhandled, [], `${label} must consume its terminal generation-fence rejection`);
  } finally {
    process.removeListener("unhandledRejection", listener);
  }
}

async function bounded(value) {
  return Promise.race([value, new Promise((_, reject) => setTimeout(() => reject(new Error("unbounded P1 settlement")), 250))]);
}

async function eventually(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error("P1 stage was not reached");
}

function assertCoordinatorLossCleanup(target, label) {
  assert.equal(target.worker.terminated, 1, `${label} has one coordinator-owned termination`);
  const termination = target.events.indexOf("worker:terminate");
  for (const marker of ["audio:loss", "debugger:dispose", "storage:close"]) {
    assert.ok(target.events.indexOf(marker) >= 0 && target.events.indexOf(marker) < termination,
      `${marker} must precede the sole worker termination at ${label}`);
  }
}

async function flushTurns() {
  for (let index = 0; index < 4; index += 1) await new Promise(resolve => setTimeout(resolve, 0));
}

function configured({ shellOptions = {}, controller = cleanController(), handles = {} } = {}) {
  const workers = []; const shells = []; const events = [];
  const app = new CadrM13ProductionApp({
    workerFactory() { const worker = new WorkerDouble(events); workers.push(worker); return worker; },
    shellFactory({ worker }) { const shell = new ShellDouble(worker, { events, ...shellOptions }); shells.push(shell); return shell; },
    m10Controller: controller, detachIngress({ reason }) { events.push(`detach:${reason}`); },
    audioHandle: handles.audio ?? null, debuggerHandle: handles.debugger ?? null, storageHandle: handles.storage ?? null,
  });
  return { app, workers, shells, events, controller };
}

function cleanupHandles(events) {
  return {
    audio: { pause() { events.push("audio:pause"); }, fence() { events.push("audio:fence"); },
      closeForWorkerLoss() { events.push("audio:loss"); } },
    debugger: { pause() { events.push("debugger:pause"); }, fence() { events.push("debugger:fence"); },
      dispose() { events.push("debugger:dispose"); } },
    storage: { pause() { events.push("storage:pause"); }, fence() { events.push("storage:fence"); },
      close() { events.push("storage:close"); } },
  };
}

function assertTerminalCleanupOrder(events, { shell = true } = {}) {
  const start = events.findLastIndex(value => value.startsWith("detach:"));
  assert.ok(start >= 0, "terminal cleanup must begin by detaching ingress");
  const normalized = events.slice(start).map(value => value.startsWith("detach:") ? "ingress:detach" :
    (value.startsWith("release:") ? "shell:release" : value));
  assert.deepEqual(normalized, ["ingress:detach", ...(shell ? ["shell:release"] : []),
    "audio:pause", "audio:fence", "audio:loss",
    "debugger:pause", "debugger:fence", "debugger:dispose",
    "storage:pause", "storage:fence", "storage:close",
    ...(shell ? ["dispose"] : []), "worker:terminate"],
  "ingress and optional authorities must close before shell detach and the sole worker termination");
}

function testReducerClosure() {
  let state = undefined;
  for (const event of ["RECEIPT_ACCEPTED", "INPUTS_SELECTED", "BOOTSTRAP_STARTED", "BOOTSTRAP_COMPLETE",
    "BASE_COMPLETE", "M10_CLEAN", "PAUSE_READY", "RUN"]) state = reduceCadrM13Production(state, { type: event });
  assert.equal(state.phase, "RUNNING"); assert.equal(state.inputEnabled, false,
    "the pure reducer cannot assert a completed frame/M10/neutral handshake");
  const fenced = reduceCadrM13Production(state, { type: "FENCE_INPUT", reason: "layout" });
  assert.equal(fenced.phase, "RUNNING"); assert.equal(fenced.inputEnabled, false);
  for (const phase of ["FAILED", "IN_DOUBT", "RECOVERY_REQUIRED"]) {
    const absorbing = reduceCadrM13Production(fenced, { type: "FAIL", kind: phase, reason: "durable" });
    assert.equal(absorbing.phase, phase);
    for (const event of ["RECEIPT_ACCEPTED", "INPUTS_SELECTED", "BOOTSTRAP_STARTED", "BOOTSTRAP_COMPLETE",
      "BASE_COMPLETE", "M10_CLEAN", "PAUSE_READY", "RUN", "STOP", "FENCE_INPUT", "FAIL"]) {
      assert.strictEqual(reduceCadrM13Production(absorbing, { type: event }), absorbing,
        `${phase} must absorb ${event}`);
    }
  }
  assert.deepEqual(new Set(CADR_M13_PRODUCTION_STATES), new Set([
    "UNCONFIGURED", "RECEIPT_ACCEPTED", "INPUTS_SELECTED", "BOOTSTRAPPING", "BASE_IMPORTING",
    "MEDIA_MOUNTED", "M10_CLEAN", "PAUSED", "RUNNING", "STOPPED", "FAILED", "IN_DOUBT", "RECOVERY_REQUIRED",
  ]));
  for (const forbiddenOption of ["worker", "m10Controller", "initialId"]) {
    assert.throws(() => new CadrM13ProductionApp({ workerFactory() { return new WorkerDouble(); },
      m10Controller: cleanController(), shellOptions: { [forbiddenOption]: null } }), /must not replace/,
    `${forbiddenOption} cannot create a competing composition authority`);
  }
}

async function testOneWorkerOneFifoAndHappyLifecycle() {
  const { app, workers, shells, events } = configured();
  assert.equal(app.acceptReceipt(receipt).phase, "RECEIPT_ACCEPTED");
  assert.equal(app.selectInputs(inputs()).phase, "INPUTS_SELECTED");
  const paused = await app.bootstrapToPaused();
  assert.equal(paused.phase, "PAUSED"); assert.equal(paused.inputEnabled, false);
  assert.equal(app.workerCount, 1); assert.equal(app.shellCount, 1);
  assert.equal(workers.length, 1); assert.equal(shells.length, 1);
  assert.deepEqual(shells[0].requests.map(item => item.op), [
    "bootstrap", "base-import-begin", "base-import-finish", "base-media-mount", "m10-reopen",
    "machine-cold-power-on", "machine-boot", "machine-visibility", "machine-pause",
  ]);
  assert.deepEqual(shells[0].requests.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "only the coordinator assigns public v8 request IDs");
  const running = await app.resume();
  assert.equal(running.phase, "RUNNING"); assert.equal(running.inputEnabled, true);
  assert.deepEqual(shells[0].requests.map(item => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(shells[0].requests.at(-1).op, "machine-start");
  await app.submitInput("keyboard-down", { code: "KeyQ", repeat: false });
  assert.equal(shells[0].requests.at(-1).id, 11); assert.equal(shells[0].requests.at(-1).op, "keyboard-down");
  const pause = app.layoutChanged();
  assert.equal(app.state.inputEnabled, false, "layout invalidation closes ingress before its queued pause");
  await pause;
  const releaseAt = events.findIndex(value => value === "release:layout-change");
  const pauseAt = events.lastIndexOf("submit:machine-pause");
  assert.ok(releaseAt >= 0 && releaseAt < pauseAt, "release is synchronous and precedes the queued lower pause");
  await assert.rejects(app.submitInput("keyboard-down", { code: "KeyQ" }), /input is fenced/);

  const malformed = configured();
  malformed.app.acceptReceipt(receipt); malformed.app.selectInputs(inputs());
  await malformed.app.bootstrapToPaused(); await malformed.app.resume();
  let getterCalled = false;
  const getterFields = {};
  Object.defineProperty(getterFields, "code", { enumerable: true, get() { getterCalled = true; return "KeyQ"; } });
  await assert.rejects(malformed.app.submitInput("keyboard-down", getterFields), /accessor/);
  assert.equal(getterCalled, false, "the P1 facade leaves hostile field access to no code path");
  assert.equal(malformed.shells[0].requests.at(-1).op, "machine-start");
  assert.equal(malformed.app.state.phase, "RUNNING");
  assert.equal(malformed.app.requestIdHighWater, 10, "rejected input consumes no request ID");
}

async function testRequestAuthorityAdmission() {
  assert.deepEqual(Object.keys(CADR_M13_PRODUCTION_REQUEST_SCHEMAS).sort(), [
    "base-import-begin", "base-import-chunk", "base-import-finish", "base-media-mount", "bootstrap",
    "keyboard-down", "keyboard-drain", "keyboard-focus-lost", "keyboard-state", "keyboard-up",
    "m10-reopen", "machine-boot", "machine-cold-power-on", "machine-pause", "machine-start",
    "machine-visibility", "pointer-down", "pointer-drain", "pointer-motion", "pointer-neutralize",
    "pointer-state", "pointer-up", "pointer-warp-request",
  ], "P1 has a closed, reviewable operation-schema inventory");

  const authorityAttacks = [
    ["type", "cadr-response"], ["version", 7], ["sessionId", "b".repeat(64)], ["id", 0xffffffff],
    ["session", "b".repeat(64)], ["op", "machine-reset"], ["op", "audio-open"], ["op", "debug-micro-step"],
  ];
  for (const [key, value] of authorityAttacks) {
    const target = configured();
    target.app.acceptReceipt(receipt); target.app.selectInputs(inputs());
    await target.app.bootstrapToPaused(); await target.app.resume();
    const beforeCount = target.shells[0].requests.length;
    const beforeId = target.app.requestIdHighWater;
    await assert.rejects(target.app.submitInput("keyboard-down", { code: "KeyQ", [key]: value }), /unknown field/,
      `${key} cannot override an input request's coordinator authority`);
    assert.equal(target.shells[0].requests.length, beforeCount);
    assert.equal(target.app.requestIdHighWater, beforeId);
    assert.equal(target.app.state.phase, "RUNNING");
  }

  for (const location of ["base-import", "m10-reopen"]) {
    for (const [key, value] of authorityAttacks) {
      const target = configured(); target.app.acceptReceipt(receipt);
      const recipe = inputs();
      if (location === "base-import") recipe.baseImport[0].fields[key] = value;
      else recipe.m10Reopen[key] = value;
      assert.throws(() => target.app.selectInputs(recipe), /unknown field/,
        `${location} must reject the reserved ${key} field`);
      assert.equal(target.app.state.phase, "RECEIPT_ACCEPTED");
      assert.equal(target.app.requestIdHighWater, 0); assert.equal(target.workers.length, 0);
    }
  }

  for (const location of ["base-import", "m10-reopen"]) {
    for (const hostile of [null, [], Object.create({ importId: 1 })]) {
      const target = configured(); target.app.acceptReceipt(receipt); const recipe = inputs();
      if (location === "base-import") recipe.baseImport[0].fields = hostile;
      else recipe.m10Reopen = hostile;
      assert.throws(() => target.app.selectInputs(recipe), /record|prototype/);
      assert.equal(target.app.state.phase, "RECEIPT_ACCEPTED"); assert.equal(target.app.requestIdHighWater, 0);
    }
  }

  const malformedFields = [null, [], new Date(0), Object.create({ code: "KeyQ" })];
  for (const fields of malformedFields) {
    const target = configured(); target.app.acceptReceipt(receipt); target.app.selectInputs(inputs());
    await target.app.bootstrapToPaused(); await target.app.resume();
    const beforeId = target.app.requestIdHighWater;
    await assert.rejects(target.app.submitInput("keyboard-down", fields), /record|prototype/);
    assert.equal(target.app.requestIdHighWater, beforeId); assert.equal(target.app.state.phase, "RUNNING");
  }

  for (const location of ["base-import", "m10-reopen"]) {
    let getterCalled = false;
    const hostile = {};
    Object.defineProperty(hostile, location === "base-import" ? "role" : "diskUuid",
      { enumerable: true, get() { getterCalled = true; return "hostile"; } });
    const target = configured(); target.app.acceptReceipt(receipt); const recipe = inputs();
    if (location === "base-import") recipe.baseImport[0].fields = hostile;
    else recipe.m10Reopen = hostile;
    assert.throws(() => target.app.selectInputs(recipe), /accessor/);
    assert.equal(getterCalled, false); assert.equal(target.app.state.phase, "RECEIPT_ACCEPTED");
    assert.equal(target.app.requestIdHighWater, 0);
  }
}

async function testFailureClassificationAndSynchronousStop() {
  const controller = cleanController(); const stopEvents = [];
  const { app, workers, shells, events } = configured({ controller, handles: cleanupHandles(stopEvents) });
  for (const event of events) stopEvents.push(event);
  events.push = (...values) => Array.prototype.push.apply(stopEvents, values);
  app.acceptReceipt(receipt); app.selectInputs(inputs()); await app.bootstrapToPaused(); await app.resume();
  const stopped = app.stop("test-stop");
  assert.equal(stopped.phase, "STOPPED"); assert.equal(stopped.inputEnabled, false);
  assert.equal(shells[0].disposed, 1); assert.equal(workers[0].terminated, 1);
  assertTerminalCleanupOrder(stopEvents);

  const recoveryEvents = []; const recovery = configured({
    controller: Object.freeze({ status() { return { state: "RECOVERY_REQUIRED", open: false, readOnly: true }; } }),
    handles: cleanupHandles(recoveryEvents),
  });
  recovery.events.push = (...values) => Array.prototype.push.apply(recoveryEvents, values);
  recovery.app.acceptReceipt(receipt); recovery.app.selectInputs(inputs());
  assert.equal((await recovery.app.bootstrapToPaused()).phase, "RECOVERY_REQUIRED",
    "a non-clean M10 state is fenced rather than called bootable");
  assert.equal(recovery.workers[0].terminated, 1);
  assertTerminalCleanupOrder(recoveryEvents);

  const inDoubtEvents = []; const m10Failure = configured({
    shellOptions: { replies: new Map([["base-import-finish", async () => ({ status: 7 })]]) },
    controller: inDoubtController(),
    handles: cleanupHandles(inDoubtEvents),
  });
  m10Failure.events.push = (...values) => Array.prototype.push.apply(inDoubtEvents, values);
  m10Failure.app.acceptReceipt(receipt); m10Failure.app.selectInputs(inputs());
  assert.equal((await m10Failure.app.bootstrapToPaused()).phase, "FAILED",
    "even a stale controller IN_DOUBT label cannot promote a pre-M10-clean startup failure");
  assertTerminalCleanupOrder(inDoubtEvents);

  const failedEvents = []; const failed = configured({
    shellOptions: { replies: new Map([["bootstrap", async () => ({ status: 1 })]]) },
    handles: cleanupHandles(failedEvents),
  });
  failed.events.push = (...values) => Array.prototype.push.apply(failedEvents, values);
  failed.app.acceptReceipt(receipt); failed.app.selectInputs(inputs());
  assert.equal((await failed.app.bootstrapToPaused()).phase, "FAILED");
  assertTerminalCleanupOrder(failedEvents);
}

async function testAbsorbingPublicSurface() {
  const failed = configured({ shellOptions: { replies: new Map([["bootstrap", async () => ({ status: 1 })]]) } });
  failed.app.acceptReceipt(receipt); failed.app.selectInputs(inputs()); await failed.app.bootstrapToPaused();
  let durableDisposition = "CLEAN";
  const durableController = { status() { return { state: durableDisposition,
    open: durableDisposition === "CLEAN", readOnly: durableDisposition !== "CLEAN" }; } };
  const inDoubt = configured({ controller: durableController,
    shellOptions: { replies: new Map([["keyboard-down", async () => ({ status: 7 })]]) } });
  inDoubt.app.acceptReceipt(receipt); inDoubt.app.selectInputs(inputs());
  await inDoubt.app.bootstrapToPaused(); await inDoubt.app.resume(); durableDisposition = "IN_DOUBT";
  await inDoubt.app.submitInput("keyboard-down", { code: "KeyQ" });
  const recovery = configured({ controller: Object.freeze({ status() { return { state: "RECOVERY_REQUIRED", open: false, readOnly: true }; } }) });
  recovery.app.acceptReceipt(receipt); recovery.app.selectInputs(inputs()); await recovery.app.bootstrapToPaused();
  const targets = [failed, inDoubt, recovery];
  for (const target of targets) {
    assert.ok(["FAILED", "IN_DOUBT", "RECOVERY_REQUIRED"].includes(target.app.state.phase));
    const state = target.app.state; const id = target.app.requestIdHighWater;
    const requests = target.shells[0].requests.length; const events = target.events.length;
    const disposed = target.shells[0].disposed; const terminated = target.workers[0].terminated;
    assert.strictEqual(target.app.acceptReceipt(receipt), state);
    assert.strictEqual(target.app.selectInputs(inputs()), state);
    assert.strictEqual(await target.app.bootstrapToPaused(), state);
    assert.strictEqual(await target.app.resume(), state);
    assert.strictEqual(await target.app.pause(), state);
    assert.strictEqual(await target.app.layoutChanged(), state);
    assert.strictEqual(await target.app.releaseInput(), state);
    await assert.rejects(target.app.submitInput("keyboard-down", { code: "KeyQ" }), /input is fenced/);
    assert.strictEqual(target.app.stop("after-terminal"), state);
    assert.strictEqual(target.app.state, state); assert.equal(target.app.requestIdHighWater, id);
    assert.equal(target.shells[0].requests.length, requests); assert.equal(target.events.length, events);
    assert.equal(target.shells[0].disposed, disposed); assert.equal(target.workers[0].terminated, terminated);
  }
}

async function testStaleReplyCannotRearm() {
  let resolveStart;
  const start = new Promise(resolve => { resolveStart = resolve; });
  const { app, shells, workers } = configured({ shellOptions: { replies: new Map([
    ["machine-start", async () => start],
  ]) } });
  app.acceptReceipt(receipt); app.selectInputs(inputs()); await app.bootstrapToPaused();
  const resume = app.resume();
  for (let index = 0; index < 8 && shells[0].requests.at(-1)?.op !== "machine-start"; index += 1) await Promise.resolve();
  assert.equal(shells[0].requests.at(-1).op, "machine-start");
  app.stop("during-start"); resolveStart({ status: 0 });
  assert.equal((await resume).phase, "STOPPED");
  assert.equal(app.state.inputEnabled, false); assert.equal(shells[0].restoreCount, 1);
  assert.equal(workers[0].terminated, 1, "late reply cannot create a replacement worker");
}

async function testMountPublicationAndResumeSingleFlight() {
  let resolveMount;
  const mountReply = new Promise(resolve => { resolveMount = resolve; });
  const mounting = configured({ shellOptions: { replies: new Map([
    ["base-media-mount", async () => mountReply],
  ]) } });
  mounting.app.acceptReceipt(receipt); mounting.app.selectInputs(inputs());
  const boot = mounting.app.bootstrapToPaused();
  for (let index = 0; index < 16 && mounting.shells[0]?.requests.at(-1)?.op !== "base-media-mount"; index += 1) await Promise.resolve();
  assert.equal(mounting.shells[0].requests.at(-1).op, "base-media-mount");
  assert.equal(mounting.app.state.phase, "BASE_IMPORTING",
    "MEDIA_MOUNTED must not be observable while the mount acknowledgement is pending");
  resolveMount({ status: 0 }); assert.equal((await boot).phase, "PAUSED");

  let resolveRestore; let reentrantResume = null; let app;
  const restoreGate = new Promise(resolve => { resolveRestore = resolve; });
  const target = configured({ shellOptions: { restore() {
    reentrantResume = app.resume();
    return restoreGate;
  } } });
  app = target.app; app.acceptReceipt(receipt); app.selectInputs(inputs()); await app.bootstrapToPaused();
  const first = app.resume(); const duplicate = app.resume();
  assert.strictEqual(duplicate, first, "duplicate resume calls share one coordinator flight");
  for (let index = 0; index < 8 && reentrantResume === null; index += 1) await Promise.resolve();
  assert.strictEqual(reentrantResume, first, "a restore callback's reentrant resume shares the same flight");
  resolveRestore(true);
  assert.equal((await first).phase, "RUNNING"); assert.equal(app.state.phase, "RUNNING");
  assert.equal(target.shells[0].restoreCount, 1);
  assert.equal(target.shells[0].requests.filter(item => item.op === "machine-start").length, 1);
}

async function testRealShellNeutralizationRace() {
  const worker = new RealShellWorker(); const controller = cleanController();
  controller.commitWrites = async () => {};
  controller.readBlock = async () => new Uint8Array(1024);
  controller.invalidateAfterAmbiguousGuest = async () => {};
  let shell; let reentrantRestore = null;
  shell = new CadrM13Shell({ worker, sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x31),
    m10Controller: controller,
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    releaseIngress() {}, restoreIngress() { reentrantRestore = shell.restoreInputIngress(); },
  });
  shell.releaseInput("real-shell-race");
  assert.equal(await shell.restoreInputIngress(), false,
    "an immediate restore must not race past the pending neutral acknowledgement");
  assert.equal(worker.requests.length, 1); assert.equal(worker.requests[0].op, "pointer-neutralize");
  let settled = false;
  const ready = shell.awaitInputNeutralization().then(value => { settled = true; return value; });
  await Promise.resolve(); assert.equal(settled, false, "neutral-ready remains pending with the real shell");
  worker.reply(worker.requests[0], { lifecycle: "PAUSED" });
  assert.equal(await ready, true);
  const restored = shell.restoreInputIngress();
  assert.strictEqual(shell.restoreInputIngress(), restored,
    "the real shell coalesces duplicate restore calls while the full frame is pending");
  for (let index = 0; index < 8 && worker.requests.length < 2; index += 1) await Promise.resolve();
  assert.equal(worker.requests[1].op, "display-full");
  worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
  assert.equal(await restored, true, "neutral acknowledgement plus full frame closes the real shell rearm gate");
  assert.strictEqual(reentrantRestore, restored, "the real restore callback cannot start a second restore flight");
  assert.equal(worker.requests.filter(item => item.op === "display-full").length, 1);
  shell.dispose(); assert.equal(worker.terminated, 1);
}

async function testRealShellWorkerLossComposition() {
  for (const [stage, fault] of [["instantiate", "error"], ["base-import", "messageerror"],
    ["mount", "error"], ["m10-reopen", "messageerror"]]) {
    const target = realCompositionFixture({ holdStage: stage });
    target.app.acceptReceipt(receipt); target.app.selectInputs(selectedInputs());
    const boot = target.app.bootstrapToPaused();
    if (stage === "instantiate") {
      await eventually(() => target.worker.requests.at(-1)?.op === "instantiate");
      assert.equal(target.worker.requests.at(-1).op, "instantiate");
    } else await bounded(target.reached[stage].promise);
    const postsAtLoss = target.worker.requests.length; target.worker.fault(fault);
    const result = await bounded(boot);
    assert.equal(result.phase, "FAILED", `${stage} loss precedes durable M10 uncertainty`);
    assert.equal(result.reason, `worker-${fault}`); assert.equal(result.inputEnabled, false);
    assertCoordinatorLossCleanup(target, `${stage} ${fault}`);
    if (stage !== "instantiate") {
      target.reached[stage].continue(); await flushTurns();
      assert.equal(target.worker.requests.length, postsAtLoss,
        `${stage} continuation cannot post after terminal cleanup`);
    }
    const stable = target.app.state; assert.strictEqual(await target.app.resume(), stable);
    assert.equal(target.worker.terminated, 1); assert.equal(target.app.state.inputEnabled, false);
  }

  for (const disposition of ["CLEAN", "IN_DOUBT", "RECOVERY_REQUIRED"]) {
    const target = realCompositionFixture();
    target.app.acceptReceipt(receipt); target.app.selectInputs(selectedInputs());
    assert.equal((await bounded(target.app.bootstrapToPaused())).phase, "PAUSED");
    assert.equal((await bounded(target.app.resume())).phase, "RUNNING");
    target.controller.setDisposition(disposition); target.worker.fault("error");
    const expected = disposition === "IN_DOUBT" ? "IN_DOUBT" :
      (disposition === "RECOVERY_REQUIRED" ? "RECOVERY_REQUIRED" : "FAILED");
    assert.equal(target.app.state.phase, expected);
    assert.equal(target.app.state.reason, "worker-error"); assert.equal(target.worker.terminated, 1);
    assert.equal(target.app.state.inputEnabled, false);
    assertCoordinatorLossCleanup(target, `running ${disposition}`);
  }

  const pending = realCompositionFixture({ holdStage: "pending-input" });
  pending.app.acceptReceipt(receipt); pending.app.selectInputs(selectedInputs());
  await bounded(pending.app.bootstrapToPaused()); await bounded(pending.app.resume());
  const input = pending.app.submitInput("keyboard-down", { code: "KeyQ", repeat: false });
  await eventually(() => pending.worker.requests.at(-1)?.op === "keyboard-down");
  assert.equal(pending.worker.requests.at(-1).op, "keyboard-down");
  pending.worker.fault("messageerror");
  assert.equal((await bounded(input)).phase, "FAILED");
  assert.equal(pending.app.state.reason, "worker-messageerror");
  assert.equal(pending.worker.terminated, 1); assert.equal(pending.app.state.inputEnabled, false);
  assertCoordinatorLossCleanup(pending, "pending input");
}

async function testPendingAudioWorkerLossGenerationFence() {
  for (const fault of ["error", "messageerror"]) {
    await withoutUnhandledRejection(async () => {
      const worker = new ProductionFaultWorker();
      const audio = pendingAudioBoundary(); const losses = [];
      const shell = new CadrM13Shell({ worker, audioBoundary: audio.boundary,
        sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x51),
        onWorkerLoss(loss) { losses.push(loss); },
      });
      worker.audioEvent({ ordinal: 1 });
      await eventually(() => audio.observations.accepted === 1);
      const postsAtLoss = worker.requests.length;
      worker.fault(fault);
      assert.deepEqual(losses.map(loss => loss.reason), [`worker-${fault}`],
        `standalone ${fault} retains the original worker-loss cause`);
      assert.equal(worker.terminated, 1, `standalone ${fault} terminates its worker exactly once`);
      assert.equal(audio.observations.closed, 1, `standalone ${fault} closes audio exactly once`);
      audio.release(true);
      await bounded(flushTurns());
      worker.audioEvent({ ordinal: 2 });
      await bounded(flushTurns());
      assert.equal(audio.observations.accepted, 1,
        `standalone ${fault} cannot accept a later audio event`);
      assert.equal(worker.requests.length, postsAtLoss,
        `standalone ${fault} cannot post after terminal loss`);
      assert.equal(worker.terminated, 1);
      shell.dispose();
      assert.equal(worker.terminated, 1, `standalone ${fault} disposal cannot terminate twice`);
    }, `standalone pending audio + ${fault}`);

    await withoutUnhandledRejection(async () => {
      const audio = pendingAudioBoundary();
      const target = realCompositionFixture({ audioBoundary: audio.boundary });
      target.app.acceptReceipt(receipt); target.app.selectInputs(selectedInputs());
      assert.equal((await bounded(target.app.bootstrapToPaused())).phase, "PAUSED");
      assert.equal((await bounded(target.app.resume())).phase, "RUNNING");
      target.worker.audioEvent({ ordinal: 1 });
      await eventually(() => audio.observations.accepted === 1);
      const postsAtLoss = target.worker.requests.length;
      target.worker.fault(fault);
      assert.equal(target.app.state.phase, "FAILED");
      assert.equal(target.app.state.reason, `worker-${fault}`,
        `external ${fault} retains the original worker-loss cause`);
      assert.equal(target.worker.terminated, 1,
        `external ${fault} leaves exactly one coordinator-owned termination`);
      assert.equal(audio.observations.closed, 1, `external ${fault} closes shell audio exactly once`);
      audio.release(true);
      await bounded(flushTurns());
      target.worker.audioEvent({ ordinal: 2 });
      await bounded(flushTurns());
      assert.equal(audio.observations.accepted, 1,
        `external ${fault} cannot accept a later audio event`);
      assert.equal(target.worker.requests.length, postsAtLoss,
        `external ${fault} cannot post after terminal loss`);
      assert.equal(target.worker.terminated, 1);
      assertCoordinatorLossCleanup(target, `pending audio ${fault}`);
    }, `external pending audio + ${fault}`);
  }
}

async function testRealShellPreDispatchGenerationFence() {
  for (const [seam, fault] of [["canonicalizer", "error"], ["hash", "messageerror"], ["compiler", "error"]]) {
    const target = realCompositionFixture({ preDispatch: seam });
    target.app.acceptReceipt(receipt); target.app.selectInputs(selectedInputs());
    const boot = target.app.bootstrapToPaused(); await bounded(target.reached[seam].promise);
    assert.equal(target.worker.requests.length, 0, `${seam} precedes the first lower post`);
    target.worker.fault(fault);
    const state = await bounded(boot);
    assert.equal(state.phase, "FAILED"); assert.equal(state.reason, `worker-${fault}`);
    assertCoordinatorLossCleanup(target, `pre-dispatch ${seam}`);
    target.reached[seam].continue(); await flushTurns();
    assert.equal(target.worker.requests.length, 0, `${seam} continuation is fenced before instantiate`);
    assert.equal(target.worker.terminated, 1); assert.strictEqual(target.app.state, state);
  }

  for (const action of ["stop", "release"]) {
    const target = realCompositionFixture({ preDispatch: "compiler" });
    target.app.acceptReceipt(receipt); target.app.selectInputs(selectedInputs());
    const boot = target.app.bootstrapToPaused(); await bounded(target.reached.compiler.promise);
    const terminal = action === "stop" ? target.app.stop("pre-dispatch-stop") : await target.app.releaseInput();
    assert.equal(terminal.phase, action === "stop" ? "STOPPED" : "FAILED");
    assert.equal(target.worker.terminated, 1);
    const postsAtTerminal = target.worker.requests.length;
    assert.deepEqual(target.worker.requests.map(item => item.op), ["pointer-neutralize"],
      `${action} may issue only its synchronous pre-disposal neutralization`);
    target.reached.compiler.continue(); assert.strictEqual(await bounded(boot), terminal);
    await flushTurns(); assert.equal(target.worker.requests.length, postsAtTerminal,
      "the delayed compiler cannot post after terminal cleanup");
    assert.equal(target.worker.terminated, 1);
  }
}

async function testFencedInputCancellation() {
  let resolveInput;
  const delayed = new Promise(resolve => { resolveInput = resolve; });
  const { app, shells } = configured({ shellOptions: { replies: new Map([
    ["keyboard-down", async () => delayed],
  ]) } });
  app.acceptReceipt(receipt); app.selectInputs(inputs()); await app.bootstrapToPaused(); await app.resume();
  const pending = app.submitInput("keyboard-down", { code: "KeyQ", repeat: false });
  for (let index = 0; index < 8 && shells[0].requests.at(-1)?.op !== "keyboard-down"; index += 1) await Promise.resolve();
  const layout = app.layoutChanged();
  assert.equal(app.state.phase, "RUNNING"); assert.equal(app.state.inputEnabled, false);
  resolveInput({ status: 0 });
  assert.notEqual((await pending).phase, "FAILED", "a stale accepted input reply is a harmless cancellation");
  assert.equal((await layout).phase, "PAUSED");

  const before = configured();
  before.app.acceptReceipt(receipt); before.app.selectInputs(inputs());
  await before.app.bootstrapToPaused(); await before.app.resume();
  assert.equal((await before.app.submitInput("keyboard-up", { code: "KeyQ" })).status, 0,
    "a reply completed before release remains an ordinary accepted response");
  assert.equal((await before.app.releaseInput()).phase, "PAUSED");
}

async function testPartialConstructionCleanup() {
  for (const mode of ["throw", "incompatible"]) {
    const events = []; const worker = new WorkerDouble(events);
    const app = new CadrM13ProductionApp({ workerFactory() { return worker; }, m10Controller: cleanController(),
      detachIngress({ reason }) { events.push(`detach:${reason}`); }, ...{
        audioHandle: cleanupHandles(events).audio, debuggerHandle: cleanupHandles(events).debugger,
        storageHandle: cleanupHandles(events).storage,
      },
      shellFactory() { if (mode === "throw") throw new Error("factory failed"); return Object.freeze({}); } });
    app.acceptReceipt(receipt); app.selectInputs(inputs());
    assert.equal((await app.bootstrapToPaused()).phase, "FAILED");
    assert.equal(worker.terminated, 1, `${mode} shell acquisition terminates the acquired worker exactly once`);
    assertTerminalCleanupOrder(events, { shell: false });
  }

  const workerReentrant = new WorkerDouble(); let workerApp;
  workerApp = new CadrM13ProductionApp({ m10Controller: cleanController(),
    workerFactory() { workerApp.stop("worker-factory-reentrant-stop"); return workerReentrant; } });
  workerApp.acceptReceipt(receipt); workerApp.selectInputs(inputs());
  assert.equal((await workerApp.bootstrapToPaused()).phase, "STOPPED");
  assert.equal(workerReentrant.terminated, 1, "worker-factory reentrant stop disposes the returned worker once");

  const shellReentrantWorker = new WorkerDouble(); let shellApp; let candidate;
  shellApp = new CadrM13ProductionApp({ m10Controller: cleanController(),
    workerFactory() { return shellReentrantWorker; },
    shellFactory({ worker }) { shellApp.stop("shell-factory-reentrant-stop"); candidate = new ShellDouble(worker); return candidate; } });
  shellApp.acceptReceipt(receipt); shellApp.selectInputs(inputs());
  assert.equal((await shellApp.bootstrapToPaused()).phase, "STOPPED");
  assert.equal(shellReentrantWorker.terminated, 1); assert.equal(candidate.disposed, 1,
    "a shell returned after reentrant stop is detached without a second worker termination");
}

async function testStaticClosure() {
  const entry = new URL("../cadr-web/browser/cadr-m13-production-app.mjs", import.meta.url);
  const source = await readFile(entry, "utf8");
  const html = await readFile(new URL("../cadr-web/browser/cadr-m13-production-shell.html", import.meta.url), "utf8");
  for (const forbidden of ["cadr-m8-m9-worker-channel", "createCadrM10Controller", "createCadrM10WorkerDiskBridge"]) {
    assert.equal(source.includes(forbidden), false, `P1 source must not introduce ${forbidden}`);
  }
  const pending = [entry]; const seen = new Map();
  while (pending.length > 0) {
    const url = pending.pop();
    if (seen.has(url.href)) continue;
    const moduleSource = await readFile(url, "utf8"); seen.set(url.href, moduleSource);
    const imports = moduleSource.matchAll(/\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["'](\.[^"']+)["']/g);
    for (const match of imports) pending.push(new URL(match[1], url));
    const dynamicImports = moduleSource.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g);
    for (const match of dynamicImports) pending.push(new URL(match[1], url));
  }
  assert.ok([...seen.keys()].some(value => value.endsWith("/cadr-m13-shell.mjs")),
    "the closure scanner must reach the real shell transitively");
  const networkAuthority = /\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|EventSource\b|Worker\s*\(|SharedWorker\s*\(|serviceWorker\b)/;
  for (const [url, moduleSource] of seen) assert.doesNotMatch(moduleSource, networkAuthority,
    `transitive P1 module ${new URL(url).pathname} must not contain dormant network/worker construction`);
  assert.match(source, /CadrM13Shell/); assert.match(source, /CadrM13ProductionApp/);
  assert.match(html, /type="module" src="\.\/cadr-m13-production-app\.mjs"/);
  assert.match(html, /disabled>Machine unavailable/);
  assert.doesNotMatch(html, /fetch\(|WebSocket|serviceWorker|selected runtime/i);
}

testReducerClosure();
await testOneWorkerOneFifoAndHappyLifecycle();
await testRequestAuthorityAdmission();
await testFailureClassificationAndSynchronousStop();
await testAbsorbingPublicSurface();
await testStaleReplyCannotRearm();
await testMountPublicationAndResumeSingleFlight();
await testRealShellNeutralizationRace();
await testRealShellWorkerLossComposition();
await testPendingAudioWorkerLossGenerationFence();
await testRealShellPreDispatchGenerationFence();
await testFencedInputCancellation();
await testPartialConstructionCleanup();
await testStaticClosure();
console.log("cadr M13 production-composition P1 reducer, lifecycle, and closure tests passed");
