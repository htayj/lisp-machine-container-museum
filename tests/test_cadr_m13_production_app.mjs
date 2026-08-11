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
import { CadrM13ProductionP2DebuggerApp,
  CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA } from "../cadr-web/browser/cadr-m13-production-app.mjs";
import { cadrM12ProductionDebuggerReceipt } from "../cadr-web/browser/cadr-m12-production-debugger.mjs";
import { serializeCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";
import { createCadrM10Controller } from "../cadr-web/browser/cadr-m10-controller.mjs";
import {
  CADR_M10_BASE_SHA256 as CONTROLLER_BASE_SHA256,
  parseCdrOvm1, parseCdrOvn1, serializeCdrOvm1, serializeCdrOvn1,
} from "../cadr-web/wasm/cadr-m10-persistence.mjs";

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
  constructor(worker, { replies = null, events = null, restore = null, transaction = null } = {}) {
    this.worker = worker; this.sessionId = "a".repeat(64); this.requests = [];
    this.replies = replies ?? new Map(); this.events = events ?? [];
    this.restore = restore;
    this.transaction = transaction;
    this.releaseCount = 0; this.restoreCount = 0; this.disposed = 0;
    this.state = "PAUSED"; this.transactionOpens = 0;
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
  terminateExternalWorker(reason) {
    this.disposed += 1; this.events.push("dispose");
    this.worker.terminate();
    return Object.freeze({ terminated: true,
      disposition: this.transaction?.terminate?.(reason) ??
        Promise.resolve(Object.freeze({ disposition: "WORKER_TERMINATED" })) });
  }
  openDebuggerHostTransaction() {
    this.transactionOpens += 1;
    if (this.transaction === null) throw new Error("the handoff test must not open a snapshot before prepareReview");
    return this.transaction;
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

function reviewController() {
  const controller = cleanController(); let claimed = false;
  controller.claimSnapshotReviewAuthority = () => {
    if (claimed) throw new Error("review authority already claimed");
    claimed = true;
    return Object.freeze({ async acquire() { throw new Error("not reached before prepareReview"); },
      revoke() { return Object.freeze({ revoked: true }); } });
  };
  return controller;
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

function realCompositionFixture({ holdStage = null, preDispatch = null, audioBoundary = null,
  reviewAuthority = null } = {}) {
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
  if (reviewAuthority !== null) controller.claimSnapshotReviewAuthority = () => reviewAuthority;
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

function configured({ shellOptions = {}, controller = cleanController(), handles = {},
  m10ReviewAuthorityFactory = null } = {}) {
  const workers = []; const shells = []; const events = [];
  const app = new CadrM13ProductionApp({
    workerFactory() { const worker = new WorkerDouble(events); workers.push(worker); return worker; },
    shellFactory({ worker }) { const shell = new ShellDouble(worker, { events, ...shellOptions }); shells.push(shell); return shell; },
    m10Controller: controller, detachIngress({ reason }) { events.push(`detach:${reason}`); },
    audioHandle: handles.audio ?? null, debuggerHandle: handles.debugger ?? null, storageHandle: handles.storage ?? null,
    m10ReviewAuthorityFactory,
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

async function testExternalWorkerTerminationAuthority() {
  const worker = new RealShellWorker();
  const shell = new CadrM13Shell({ worker, workerOwnership: "external" });
  const transaction = shell.openDebuggerHostTransaction();
  const dispositions = [];
  transaction.onInvalidating(() => {});
  transaction.onDisposition(event => { dispositions.push(event.disposition); });
  const receipt = shell.terminateExternalWorker("termination-test");
  assert.equal(receipt.terminated, true);
  assert.deepEqual(await receipt.disposition, { disposition: "WORKER_TERMINATED" });
  assert.equal(worker.terminated, 1, "the shell itself invokes the exact external worker termination");
  assert.deepEqual(dispositions, ["WORKER_TERMINATED"]);
  assert.throws(() => shell.terminateExternalWorker("replay"), /already pending/,
    "the exact termination boundary is single-use");

  const throwingWorker = new RealShellWorker();
  throwingWorker.terminate = () => { throw new Error("termination refused"); };
  const throwingShell = new CadrM13Shell({ worker: throwingWorker, workerOwnership: "external" });
  const throwingTransaction = throwingShell.openDebuggerHostTransaction();
  const throwingDispositions = [];
  throwingTransaction.onInvalidating(() => {});
  throwingTransaction.onDisposition(event => { throwingDispositions.push(event.disposition); });
  assert.throws(() => throwingShell.terminateExternalWorker("throwing"), /termination refused/);
  assert.deepEqual(throwingDispositions, [], "a thrown termination publishes no terminal disposition");
}

async function testThrownTerminationDominatesTerminalCleanup() {
  const events = [];
  class ThrowingWorker extends WorkerDouble {
    terminate() { this.terminated += 1; events.push("worker:terminate-throw"); throw new Error("termination refused"); }
  }
  const worker = new ThrowingWorker(events);
  const app = new CadrM13ProductionApp({
    workerFactory() { return worker; },
    shellFactory({ worker: owned }) { return new ShellDouble(owned, { events }); },
    m10Controller: cleanController(),
  });
  app.acceptReceipt(receipt); app.selectInputs(inputs());
  assert.equal((await app.bootstrapToPaused()).phase, "PAUSED");
  app.stop("throwing-termination");
  assert.equal(worker.terminated, 1);
  assert.equal(app.terminalCleanup.phase, "EXTERNAL_RECOVERY_REQUIRED");
  assert.equal(app.terminalCleanup.retryable, false);
  assert.match(app.terminalCleanup.failure.message, /termination refused/);
  assert.equal((await app.retryTerminalCleanup()).phase, "EXTERNAL_RECOVERY_REQUIRED");
}

async function testProvenTerminationM10ReleaseRetry() {
  let releases = 0, revokes = 0, disposals = 0, disposition = null;
  const authority = Object.freeze({
    async acquire() { return Object.freeze({ binding: Object.freeze({}), async release() {
      releases += 1;
      if (releases === 1) throw new Error("synthetic first durable unpin response loss");
      return Object.freeze({ released: true });
    } }); },
    revoke() { revokes += 1; return Object.freeze({ revoked: true }); },
  });
  const stop = serializeCdrDbgStop1({ reason: 1, breakpointIndex: 0, generation: 1n,
    boundaryOrdinal: 1n, clockSlot: 1n, microPcBefore: 0, rawLcBefore: 0,
    microPcAfter: 0, rawLcAfter: 0, faultAfter: 0, deviceRequestAfter: 0,
    inhibitedAfter: 0, runOrdinal: 1n, operationSlots: 1n,
    profileSha256: Uint8Array.from(
      "8c0ef85505485aacfd bf42d4efef416e7a4c0964fbc59037d234b4e499b9f1a0".replaceAll(" ", "").match(/../g),
      value => Number.parseInt(value, 16)) }).buffer;
  const transaction = {
    async save() { throw new Error("synthetic save response loss"); },
    async next() { throw new Error("unreachable"); },
    async dispose() { disposals += 1; await disposition({ reason: "dispose", disposition: "UNKNOWN" }); },
    async terminate(reason) { await disposition({ reason, disposition: "WORKER_TERMINATED" });
      return Object.freeze({ disposition: "WORKER_TERMINATED" }); },
    onInvalidating() { return () => {}; },
    onDisposition(observer) { disposition = observer; return () => {}; },
  };
  const target = configured({ controller: cleanController(), m10ReviewAuthorityFactory: () => authority,
    shellOptions: { transaction, replies: new Map([
      ["debug-micro-step", async () => ({ status: 19, terminal: false, result: { stop } })],
      ["machine-pause", async request => ({ type: "cadr-response", version: 8,
        sessionId: request.sessionId, id: request.id, op: request.op,
        status: 0, ok: true, terminal: false, lifecycle: "PAUSED" })],
    ]) } });
  target.app.acceptReceipt(receipt); target.app.selectInputs(inputs());
  await target.app.bootstrapToPaused();
  const p2 = await target.app.handoffDebugger(debuggerDeps());
  assert.equal((await p2.request("debug-micro-step")).status, 19);
  await assert.rejects(p2.prepareReview(), /synthetic save response loss|snapshot disposal is unknown/);
  target.app.stop("release-response-loss");
  await flushTurns();
  assert.equal(target.app.terminalCleanup.phase, "M10_RELEASE_RETRY_REQUIRED");
  assert.equal(target.app.terminalCleanup.retryable, true);
  assert.equal(target.workers[0].terminated, 1); assert.equal(releases, 1); assert.equal(revokes, 0);
  const recovered = await target.app.retryTerminalCleanup();
  assert.equal(recovered.phase, "REVOKED");
  assert.equal(target.workers[0].terminated, 1, "durable unpin retry cannot terminate twice");
  assert.equal(releases, 2); assert.equal(revokes, 1); assert.equal(disposals, 1);
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

function debuggerDeps() {
  return Object.freeze({ receipt: Object.freeze({ schema: CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA,
    profile: cadrM12ProductionDebuggerReceipt().profile, disposition: "source-only" }),
  audio: Object.freeze({ async joinTail() { return { joined: true }; },
    async pause() { return { status: 0, paused: true }; },
    async reducePause() { return { committed: true, state: "PAUSED" }; } }) });
}

async function testDebuggerHandoffFencingAndFifo() {
  const target = configured({ controller: reviewController() });
  target.app.acceptReceipt(receipt); target.app.selectInputs(inputs());
  await target.app.bootstrapToPaused();
  const before = target.app.requestIdHighWater;
  const handoff = target.app.handoffDebugger(debuggerDeps());
  assert.throws(() => target.app.resume(), /fenced by debugger handoff/,
    "handoff admission synchronously fences a later P1 resume before FIFO head");
  await assert.rejects(target.app.pause(), /fenced by debugger handoff/);
  const p2 = await handoff;
  assert.equal(target.app.requestIdHighWater, before,
    "the P1-to-P2 linearization itself consumes no public request ID");
  assert.equal(target.shells[0].transactionOpens, 0,
    "handoff does not allocate a snapshot before P2 prepares a review");
  await assert.rejects(target.app.submitInput("keyboard-down", { code: "KeyQ" }), /fenced by debugger handoff/);
  await p2.request("debug-breakpoint-clear", { slot: 0 });
  assert.equal(target.shells[0].requests.at(-1).id, before + 1,
    "P2 uses P1's exact existing request-ID allocator");
  assert.equal(target.shells[0].requests.at(-1).op, "debug-breakpoint-clear");
  assert.throws(() => new CadrM13ProductionP2DebuggerApp({}), /created by P1 handoffDebugger/,
    "a raw shell/controller-shaped object cannot bypass the branded handoff");

  let releasePause; const pauseGate = new Promise(resolve => { releasePause = resolve; });
  let pauseCount = 0;
  const delayed = configured({ controller: reviewController(), shellOptions: { replies: new Map([
    ["machine-pause", async () => { pauseCount += 1; if (pauseCount === 2) await pauseGate; return { status: 0 }; }],
  ]) } });
  delayed.app.acceptReceipt(receipt); delayed.app.selectInputs(inputs());
  await delayed.app.bootstrapToPaused();
  const pendingPause = delayed.app.pause("pre-handoff-pause");
  await eventually(() => delayed.shells[0].requests.at(-1)?.op === "machine-pause" && pauseCount === 2);
  const pendingHandoff = delayed.app.handoffDebugger(debuggerDeps());
  assert.throws(() => delayed.app.resume(), /fenced by debugger handoff/,
    "a delayed earlier P1 request does not leave a later P1 admission window");
  releasePause(); await pendingPause;
  const delayedP2 = await pendingHandoff;
  const highWater = delayed.app.requestIdHighWater;
  await delayedP2.request("debug-stop-record");
  assert.equal(delayed.shells[0].requests.at(-1).id, highWater + 1);
  assert.deepEqual(delayed.shells[0].requests.slice(-2).map(request => request.op),
    ["machine-pause", "debug-stop-record"],
  "all already enqueued P1 work completes before P2 is admitted at the same FIFO head");

  const failed = configured({ controller: Object.freeze({ status() { return { state: "CLEAN", open: true, readOnly: false }; },
    claimSnapshotReviewAuthority() { throw new Error("reentrant authority failure"); } }) });
  failed.app.acceptReceipt(receipt); failed.app.selectInputs(inputs()); await failed.app.bootstrapToPaused();
  await assert.rejects(failed.app.handoffDebugger(debuggerDeps()), /reentrant authority failure/);
  assert.equal((await failed.app.resume()).phase, "RUNNING",
    "a failed P2 construction/authority claim restores P1 admission instead of stranding transfer");
}

/* P1 must retain a real controller's single claimed authority across a
 * constructor-only failure: revoking it here would make retry impossible,
 * because M10 deliberately does not mint a second authority.  The test uses a
 * one-time hostile wrapper solely to make the otherwise prevalidated P2
 * constructor fail after P1 has received the authentic authority. */
async function testSingleClaimReviewAuthorityConstructionRetryAndTerminalCleanup() {
  const hash = seed => Uint8Array.from({ length: 32 }, (_, index) => (seed + index) & 255);
  const binding = { diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
    baseSha256: CONTROLLER_BASE_SHA256, profileSha256: hash(3), artifactSetSha256: hash(7) };
  const root = await parseCdrOvn1(await serializeCdrOvn1({ level: 2, prefix: 0n,
    children: Array.from({ length: 256 }, () => new Uint8Array(32)) }));
  const manifest = await parseCdrOvm1(await serializeCdrOvm1({ generation: 0n,
    parentGeneration: 0n, entryCount: 0n, diskUuid: binding.diskUuid,
    baseSha256: binding.baseSha256, profileSha256: binding.profileSha256,
    artifactSetSha256: binding.artifactSetSha256, rootSha256: root.hash }));
  const disk = { readOnly: false, sessionId: 1n, close() {},
    async active() { return { manifest, head: { headSeq: 1n } }; } };
  const controller = createCadrM10Controller({ binding,
    backend: { async initializeDisk() { return disk; }, async reopenDisk() { return disk; } },
    readBasePage: async () => new Uint8Array(1024),
    readBaseIdentity: async () => CONTROLLER_BASE_SHA256, replaceWorker: async () => {} });
  await controller.open({ initialize: true });
  const actual = controller.claimSnapshotReviewAuthority();
  let factoryCalls = 0, acquireReads = 0, revokeCalls = 0;
  const oneTimeConstructorFault = Object.freeze(Object.defineProperties(Object.create(null), {
    acquire: { enumerable: true, get() {
      acquireReads += 1;
      if (acquireReads === 2) throw new Error("synthetic post-claim P2 constructor failure");
      return actual.acquire;
    } },
    revoke: { enumerable: true, get() { return reason => {
      revokeCalls += 1; return actual.revoke.call(actual, reason);
    }; } },
  }));
  const target = configured({ controller, m10ReviewAuthorityFactory: () => {
    factoryCalls += 1; return oneTimeConstructorFault;
  } });
  target.app.acceptReceipt(receipt); target.app.selectInputs(inputs());
  await target.app.bootstrapToPaused();
  await assert.rejects(target.app.handoffDebugger(debuggerDeps()), /synthetic post-claim P2 constructor failure/);
  assert.equal(factoryCalls, 1, "the real controller authority is claimed only once");
  assert.throws(() => controller.claimSnapshotReviewAuthority(), /already been claimed/,
    "the real M10 controller confirms that a second authority cannot be manufactured");
  const p2 = await target.app.handoffDebugger(debuggerDeps());
  assert.ok(p2 instanceof CadrM13ProductionP2DebuggerApp);
  assert.equal(factoryCalls, 1,
    "P1 retries P2 construction with its retained lease-free authority rather than attempting a second M10 claim");
  target.app.stop("single-claim-terminal-cleanup");
  await eventually(() => revokeCalls === 1);
  assert.throws(() => actual.revoke("second-terminal-cleanup"), /cannot be revoked/,
    "terminal P1/P2 cleanup revokes the active real-controller authority after the retry");
  controller.close();
}

/* This composes the current M10-v5 branded recovery path with the M12 P2
 * terminal path.  The first review acquire pins successfully, loses continuity
 * after that pin, and also loses its first rollback unpin.  P2's prepare path
 * disposes the empty worker transaction, but M10 correctly retains the opaque
 * recovery record.  A P1 terminal loss must therefore retain the same branded
 * authority through a failed recovery retry, then explicitly retry acquire,
 * lease release, and revoke in that order. */
async function testActualM10V5RecoveryThenP1TerminalRetry() {
  const hash = seed => Uint8Array.from({ length: 32 }, (_, index) => (seed + index) & 255);
  const binding = { diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
    baseSha256: CONTROLLER_BASE_SHA256, profileSha256: hash(23), artifactSetSha256: hash(61) };
  const root = await parseCdrOvn1(await serializeCdrOvn1({ level: 2, prefix: 0n,
    children: Array.from({ length: 256 }, () => new Uint8Array(32)) }));
  const manifest = await parseCdrOvm1(await serializeCdrOvm1({ generation: 0n,
    parentGeneration: 0n, entryCount: 0n, diskUuid: binding.diskUuid,
    baseSha256: binding.baseSha256, profileSha256: binding.profileSha256,
    artifactSetSha256: binding.artifactSetSha256, rootSha256: root.hash }));
  const order = []; const pins = new Map(); let pinSequence = 0; let unpinAttempts = 0;
  let breakFirstPostPinContinuity = true; let continuityBroken = false;
  const disk = { readOnly: false, sessionId: 1n, close() {},
    async active() { return { manifest, head: { headSeq: continuityBroken ? 2n : 1n } }; },
    async exportActiveClosure() { return { generation: manifest.generation, headSeq: 1n,
      manifestSha256: manifest.hash.slice(), rootSha256: manifest.rootSha256.slice() }; },
    async pinRoot(kind, rootSha256) {
      assert.equal(kind, "snapshot"); assert.deepEqual(rootSha256, root.hash);
      const id = `fake:snapshot:${++pinSequence}`; pins.set(id, rootSha256.slice()); order.push(`pin:${id}`);
      if (breakFirstPostPinContinuity) {
        breakFirstPostPinContinuity = false; continuityBroken = true;
      }
      return id;
    },
    async unpinRoot(id) {
      unpinAttempts += 1; order.push(`unpin:${id}:${unpinAttempts}`);
      if (unpinAttempts <= 2) throw new Error(`synthetic M10 rollback loss ${unpinAttempts}`);
      assert.equal(pins.delete(id), true, "M10 retry used an unknown opaque review pin");
      continuityBroken = false;
    },
  };
  const controller = createCadrM10Controller({ binding,
    backend: { async initializeDisk() { return disk; }, async reopenDisk() { return disk; } },
    readBasePage: async () => new Uint8Array(1024),
    readBaseIdentity: async () => CONTROLLER_BASE_SHA256, replaceWorker: async () => {} });
  await controller.open({ initialize: true });
  const actual = controller.claimSnapshotReviewAuthority();
  const authority = Object.freeze({
    async acquire() {
      order.push("authority:acquire");
      const lease = await actual.acquire.call(actual);
      return Object.freeze({ binding: lease.binding, async release() {
        order.push("authority:release"); return lease.release.call(lease);
      } });
    },
    revoke(reason) { order.push("authority:revoke"); return actual.revoke.call(actual, reason); },
  });
  const stop = serializeCdrDbgStop1({ reason: 1, breakpointIndex: 0, generation: 1n,
    boundaryOrdinal: 1n, clockSlot: 1n, microPcBefore: 0, rawLcBefore: 0,
    microPcAfter: 0, rawLcAfter: 0, faultAfter: 0, deviceRequestAfter: 0,
    inhibitedAfter: 0, runOrdinal: 1n, operationSlots: 1n,
    profileSha256: Uint8Array.from(
      "8c0ef85505485aacfd bf42d4efef416e7a4c0964fbc59037d234b4e499b9f1a0".replaceAll(" ", "").match(/../g),
      value => Number.parseInt(value, 16)) }).buffer;
  let transactionDisposals = 0;
  let transactionDisposition = null;
  const transaction = {
    async save() { throw new Error("snapshot save must not start after M10 acquire failure"); },
    async next() { throw new Error("snapshot stream must not start after M10 acquire failure"); },
    async dispose(reason) {
      transactionDisposals += 1; order.push(`worker-dispose:${reason}`);
      await transactionDisposition({ reason, disposition: "ABSENT" });
      return { disposition: "ABSENT" };
    },
    onInvalidating() { return () => {}; },
    onDisposition(observer) { transactionDisposition = observer; return () => { transactionDisposition = null; }; },
  };
  const target = configured({ controller, m10ReviewAuthorityFactory: () => authority,
    shellOptions: { transaction, replies: new Map([
      ["debug-micro-step", async () => ({ status: 19, terminal: false, result: { stop } })],
      ["machine-pause", async request => ({ type: "cadr-response", version: 8,
        sessionId: request.sessionId, id: request.id, op: request.op,
        status: 0, ok: true, terminal: false, lifecycle: "PAUSED" })],
    ]) } });
  target.app.acceptReceipt(receipt); target.app.selectInputs(inputs()); await target.app.bootstrapToPaused();
  const p2 = await target.app.handoffDebugger(debuggerDeps());
  assert.equal((await p2.request("debug-micro-step")).status, 19);
  await assert.rejects(p2.prepareReview(), /acquisition failed and pin rollback failed/);
  assert.equal(p2.state, "STOP_BOUND", "empty private transaction cleanup preserves the direct stop");
  assert.equal(transactionDisposals, 1, "the failed prepare disposes its empty worker transaction exactly once");
  assert.throws(() => actual.revoke("pre-terminal-revoke"), /cannot be revoked/,
    "M10 v5 retains its branded RECOVERY_REQUIRED authority after rollback loss");

  await withoutUnhandledRejection(async () => {
    assert.equal(target.app.stop("m10-v5-terminal-loss").phase, "STOPPED");
    await eventually(() => p2.terminalCleanup.phase === "AUTHORITY_RECOVERY_RETRY_REQUIRED");
  }, "M10-v5 P1 terminal recovery failure");
  assert.equal(target.app.terminalCleanup.retryable, true);
  assert.ok(target.app.terminalCleanup.failure instanceof AggregateError,
    "the terminal state retains the exact failed recovery aggregate instead of swallowing it");
  assert.equal(pins.size, 1, "failed terminal recovery keeps the opaque original pin reachable");
  assert.throws(() => actual.revoke("still-recovery-required"), /cannot be revoked/,
    "a failed terminal recovery does not discard or forge a second M10 authority");

  const recovered = await target.app.retryTerminalCleanup();
  assert.equal(recovered.phase, "REVOKED"); assert.equal(p2.terminalCleanup.phase, "REVOKED");
  assert.equal(pins.size, 0, "the explicit retry releases both the recovered and original opaque pins");
  assert.equal(transactionDisposals, 1, "authority recovery cannot dispose the closed worker transaction again");
  assert.deepEqual(order, [
    "authority:acquire", "pin:fake:snapshot:1", "unpin:fake:snapshot:1:1", "worker-dispose:prepare-failed",
    "authority:revoke", "authority:acquire", "unpin:fake:snapshot:1:2",
    "authority:revoke", "authority:acquire", "unpin:fake:snapshot:1:3", "pin:fake:snapshot:2",
    "authority:release", "unpin:fake:snapshot:2:4", "authority:revoke",
  ], "P1 terminal loss retries only the branded M10 acquire/release/revoke route in order");
  assert.throws(() => actual.revoke("after-terminal-retry"), /cannot be revoked/,
    "successful terminal cleanup revokes the one real M10 authority exactly once");
  controller.close();
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
  assert.doesNotMatch(source, /claimDebuggerRequestAuthority|submitAllocatedDebugger/,
    "P2 must not regain a shell-level request allocator");
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
await testExternalWorkerTerminationAuthority();
await testThrownTerminationDominatesTerminalCleanup();
await testProvenTerminationM10ReleaseRetry();
await testRealShellPreDispatchGenerationFence();
await testFencedInputCancellation();
await testPartialConstructionCleanup();
await testDebuggerHandoffFencingAndFifo();
await testSingleClaimReviewAuthorityConstructionRetryAndTerminalCleanup();
await testActualM10V5RecoveryThenP1TerminalRetry();
await testStaticClosure();
console.log("cadr M13 production-composition P1 reducer, lifecycle, and closure tests passed");
