import assert from "node:assert/strict";

import {
  CADR_M13_OPERATION_SCHEMAS,
  CADR_M13_BASE_BLOCKS,
  CADR_M13_MAX_METADATA_BYTES,
  CADR_M13_PROFILE,
  CADR_M13_PROTOCOL_VERSION,
  CADR_M13_SCHEDULER_SLICE_MAX_SLOTS,
  CADR_M13_STATUS,
  CadrM13BaseMediaBinding,
  CadrM13Shell,
  CadrM13StorageBoundary,
  canonicalizeCadrM13Request,
  encodeCadrM13Meta1,
  validateCadrM13PostCloneRequest,
} from "../cadr-web/browser/cadr-m13-shell.mjs";

const session = "12".repeat(32);
const SYNTHETIC_WASM_SHA256 = "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d";
assert.equal(CADR_M13_PROFILE, "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2");
const request = (id, op, fields = {}) => ({
  type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION, sessionId: session, id, op, ...fields,
});

class FakeWorker {
  #listeners = new Map();
  requests = [];
  addEventListener(type, listener) {
    const values = this.#listeners.get(type) ?? []; values.push(listener); this.#listeners.set(type, values);
  }
  removeEventListener(type, listener) {
    this.#listeners.set(type, (this.#listeners.get(type) ?? []).filter(value => value !== listener));
  }
  postMessage(value) {
    this.requests.push(value);
    queueMicrotask(() => this.emit("message", { data: {
      type: "cadr-response", version: 7, id: value.id, op: value.op, status: 0, ok: true, lifecycle: "PAUSED",
    } }));
  }
  emit(type, event) { for (const listener of this.#listeners.get(type) ?? []) listener(event); }
  terminate() { this.terminated = true; }
}

class MountStageFailureWorker extends FakeWorker {
  constructor({ failOperation, failOrdinal = 1 } = {}) {
    super(); this.failOperation = failOperation; this.failOrdinal = failOrdinal;
    this.operationOrdinals = new Map();
  }
  postMessage(value) {
    this.requests.push(value);
    const ordinal = (this.operationOrdinals.get(value.op) ?? 0) + 1;
    this.operationOrdinals.set(value.op, ordinal);
    const failed = value.op === this.failOperation && ordinal === this.failOrdinal;
    queueMicrotask(() => this.emit("message", { data: {
      type: "cadr-response", version: 7, id: value.id, op: value.op,
      status: failed ? CADR_M13_STATUS.HOST_FAILURE : 0, ok: !failed,
      lifecycle: "PAUSED",
    } }));
  }
}

class MountStageTransportWorker extends FakeWorker {
  constructor({ fault, failOperation, failOrdinal = 1 } = {}) {
    super(); this.fault = fault; this.failOperation = failOperation;
    this.failOrdinal = failOrdinal; this.operationOrdinals = new Map();
  }
  postMessage(value) {
    this.requests.push(value);
    const ordinal = (this.operationOrdinals.get(value.op) ?? 0) + 1;
    this.operationOrdinals.set(value.op, ordinal);
    if (value.op === this.failOperation && ordinal === this.failOrdinal) {
      if (this.fault === "timeout") return;
      queueMicrotask(() => {
        if (this.fault === "malformed") {
          this.emit("message", { data: {
            type: "cadr-response", version: 7, id: value.id, op: value.op,
            status: 0, ok: false,
          } });
        } else {
          this.emit(this.fault, { error: new Error(`injected ${this.fault}`) });
        }
      });
      return;
    }
    queueMicrotask(() => this.emit("message", { data: {
      type: "cadr-response", version: 7, id: value.id, op: value.op,
      status: 0, ok: true, lifecycle: "PAUSED",
    } }));
  }
}

/* The production binding hashes real 1 MiB ranges.  The fault matrix below
 * only needs to reach every shell emission ordinal, so this in-memory subclass
 * preserves its canonical range state machine while avoiding 258 copies times
 * 258 injected failures.  It is not used as base-identity evidence. */
class MountFailureBinding extends CadrM13BaseMediaBinding {
  #state = "IDLE"; #nextBlock = 0; #body = new Uint8Array(1); #readOrdinal = 0; #boundary;
  #failReadOrdinal; #failFinish;
  constructor({ failReadOrdinal = null, failFinish = false } = {}) {
    const boundary = new CadrM13StorageBoundary({
      async beginBaseImport() { return Object.freeze({ importId: 1, nextOffset: 0n }); },
      async appendBaseImport() { throw new Error("fault binding does not append public bytes"); },
      async finishBaseImport() { return selectedBaseImportResult(); },
      async readBaseRange() { throw new Error("fault binding never reads storage"); },
      async reopenDisk() { return Object.freeze({}); },
    });
    super({ storage: boundary }); this.#boundary = boundary;
    this.#failReadOrdinal = failReadOrdinal; this.#failFinish = failFinish;
  }
  get boundary() { return this.#boundary; }
  get state() { return this.#state; }
  beginMount() { assert.equal(this.#state, "IDLE"); this.#state = "MOUNTING"; this.#nextBlock = 0; }
  abortMount() { this.#state = "IDLE"; this.#nextBlock = 0; }
  finishMount() {
    assert.equal(this.#state, "MOUNTING"); assert.equal(this.#nextBlock, CADR_M13_BASE_BLOCKS);
    if (this.#failFinish) throw new Error("injected finishMount failure");
    this.#state = "MOUNTED";
  }
  async readMountRange(firstBlock, blockCount) {
    assert.equal(this.#state, "MOUNTING"); assert.equal(firstBlock, this.#nextBlock);
    assert.equal(blockCount, Math.min(1024, CADR_M13_BASE_BLOCKS - this.#nextBlock));
    this.#readOrdinal += 1;
    if (this.#readOrdinal === this.#failReadOrdinal) throw new Error("injected base-range failure");
    this.#nextBlock += blockCount;
    return this.#body;
  }
}

function selectedBootArtifactsFixture() {
  return [
    { kind: 1, bytes: new ArrayBuffer(854) }, { kind: 2, bytes: new ArrayBuffer(20480) },
    { kind: 4, bytes: new ArrayBuffer(3130) }, { kind: 5, bytes: new ArrayBuffer(83270) },
  ];
}

function makeMountFailureShell(worker, binding, { timeoutMs = 10000, initialId = 1 } = {}) {
  return new CadrM13Shell({ worker, storage: binding.boundary,
    baseMediaBinding: binding, m10Controller: fakeM10Controller(),
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    selectedBootArtifacts: selectedBootArtifactsFixture(),
    selectedWasmSha256: SYNTHETIC_WASM_SHA256,
    wasmCompiler: async () => Object.freeze({}),
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12),
    timeoutMs, initialId });
}

function selectedBaseImportResult() {
  return Object.freeze({ role: "system-303-base", byteCount: 269562880n,
    sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
    blockBytes: 1024, blockCount: 263245 });
}

function fakeM10Controller({ isOpen = false } = {}) {
  let open = isOpen;
  return Object.freeze({
    get state() { return open ? "CLEAN" : "RECOVERY_REQUIRED"; },
    status: () => Object.freeze({ state: open ? "CLEAN" : "RECOVERY_REQUIRED", open,
      readOnly: !open }),
    setOpen: value => { open = value === true; },
    async commitWrites() { throw new Error("not reached"); },
    async readBlock() { throw new Error("not reached"); },
    async invalidateAfterAmbiguousGuest() { throw new Error("not reached"); },
  });
}

async function requestHash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", value))].map(
    byte => byte.toString(16).padStart(2, "0")).join("");
}

async function preparePublicSelectedMediaMount(shell, { startId = 1 } = {}) {
  const wasmBytes = Uint8Array.of(0).buffer;
  let reply = await shell.submit(request(startId, "bootstrap", {
    wasmBytes, wasmSha256: await requestHash(wasmBytes),
  }));
  assert.equal(reply.status, 0, "synthetic v8 bootstrap must precede selected mount");
  reply = await shell.submit(request(startId + 1, "base-import-begin", {
    role: "system-303-base", byteCount: 269562880,
    sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
  }));
  assert.equal(reply.status, 0);
  reply = await shell.submit(request(startId + 2, "base-import-finish", { importId: 1 }));
  assert.equal(reply.status, 0, "storage fixture adopts only the selected synthetic identity");
  return startId + 3;
}

const shell = new CadrM13Shell({ worker: new FakeWorker(), sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
assert.equal(shell.sessionId, session);

/* The getter must be rejected without running.  This is source-side evidence;
 * structured clone cannot preserve the original getter for worker inspection. */
let getterCalled = false;
const accessor = request(1, "keyboard-state");
Object.defineProperty(accessor, "unexpected", { enumerable: true, get() { getterCalled = true; return 1; } });
let reply = await shell.submit(accessor);
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);
assert.equal(getterCalled, false);

/* A syntactically admitted M8 unknown key remains an M8 semantic request. */
reply = await shell.submit(request(2, "keyboard-down", { code: "x".repeat(64), repeat: false }));
assert.equal(reply.status, 0);
assert.equal(shell.ledger.pending, 0);
reply = await shell.submit(request(3, "keyboard-down", { code: "x".repeat(65) }));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);

/* The outer record accepted post-clone is closed independently of source
 * accessor/prototype history. */
const canonical = await canonicalizeCadrM13Request(request(4, "keyboard-up", { code: "KeyQ" }), { sessionId: session });
assert.equal(Object.getPrototypeOf(canonical.request), null);
assert.equal(validateCadrM13PostCloneRequest(canonical.request), true);
assert.equal(validateCadrM13PostCloneRequest({ ...canonical.request, extra: 1 }), false);
assert.equal(validateCadrM13PostCloneRequest(Object.create(canonical.request)), false);

const withSymbol = request(4, "keyboard-state");
withSymbol[Symbol("not-wire")] = 1;
reply = await shell.submit(withSymbol);
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);

/* M13META1 counts canonical bytes, rather than using JSON or engine object
 * size.  The test exercises the independent encoding path and its hard cap. */
const metadata = await encodeCadrM13Meta1(canonical.request);
assert.equal(new TextDecoder().decode(metadata.subarray(0, 8)), "M13META1");
assert.ok(metadata.byteLength < CADR_M13_MAX_METADATA_BYTES);

/* A duplicate id is a correlated, terminal protocol failure, not an accidental
 * replay of a previously accepted keyboard edge. */
reply = await shell.submit(request(4, "keyboard-state"));
assert.equal(reply.status, CADR_M13_STATUS.PROTOCOL_VIOLATION);
assert.equal(reply.terminal, true);

/* Storage calls are a closed named-method surface.  No user-controlled key or
 * pathname reaches it, and the worker was never handed the storage object. */
const storageCalls = [];
const boundary = new CadrM13StorageBoundary({
  async readBaseRange(value) { storageCalls.push(value); return Object.freeze({ bytes: new ArrayBuffer(1024) }); },
});
const storageShell = new CadrM13Shell({ worker: new FakeWorker(), storage: boundary,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await storageShell.submit(request(1, "base-range-read", { importId: 1, firstBlock: 0, blockCount: 1 }));
assert.equal(reply.status, 0); assert.equal(storageCalls.length, 1);
assert.deepEqual(Object.keys(storageCalls[0]).sort(), ["blockCount", "firstBlock", "id", "importId", "op", "sessionId", "type", "version"]);
reply = await storageShell.submit(request(2, "base-range-read", { importId: 1, firstBlock: 0, blockCount: 1, key: "outside-m10" }));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);
assert.equal(storageCalls.length, 1);

/* M5-family workers reserve generic run* operations.  M13 admits only its
 * bounded v7 slice mapping, including the explicit visibility handshake.
 * This is a lower-operation assertion, not a test of the fake peer's core. */
assert.equal(Object.hasOwn(CADR_M13_OPERATION_SCHEMAS, "machine-run-batch"), false);
class SchedulerWorker extends FakeWorker {
  postMessage(value) {
    this.requests.push(value);
    const lifecycle = value.op === "scheduler-start" || value.op === "scheduler-run-v7-slice" ?
      "RUNNING" : "PAUSED";
    queueMicrotask(() => this.emit("message", { data: {
      type: "cadr-response", version: 7, id: value.id, op: value.op,
      status: 0, ok: true, lifecycle, completedSlots: value.op === "scheduler-run-v7-slice" ? 1n : undefined,
      microinstructionsExecuted: value.op === "scheduler-run-v7-slice" ? 0n : undefined,
    } }));
  }
}
const schedulerWorker = new SchedulerWorker();
const schedulerShell = new CadrM13Shell({ worker: schedulerWorker,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
for (const [id, op, fields] of [
  [1, "machine-visibility", { hidden: false }],
  [2, "machine-start", {}],
  [3, "machine-run", { clockSlots: CADR_M13_SCHEDULER_SLICE_MAX_SLOTS + 1 }],
  [4, "machine-run", { clockSlots: CADR_M13_SCHEDULER_SLICE_MAX_SLOTS }],
]) {
  reply = await schedulerShell.submit(request(id, op, fields));
  assert.equal(reply.status, id === 3 ? CADR_M13_STATUS.INVALID_REQUEST : 0);
}
assert.deepEqual(schedulerWorker.requests.map(value => value.op),
  ["scheduler-visibility", "scheduler-start", "scheduler-run-v7-slice"]);
assert.equal(schedulerWorker.requests.some(value => ["run", "run-digest-batch",
  "run-digest-batch-v3", "run-digest-batch-m4", "scheduler-run"].includes(value.op)), false);
schedulerShell.dispose();

/* The selected base stays in the M13 store.  The shell feeds only bounded
 * copied ranges into the existing v7 stream verifier, then exposes the same
 * verified page reader to the C-M10 constructor.  This fake lower peer is a
 * grammar/order test; the Chromium composition probe exercises real v7/Wasm. */
const mountedRangeCalls = [];
const mountedImportCalls = [];
let mountedSourceMutated = false;
const mountedM10 = fakeM10Controller();
const mountedBoundary = new CadrM13StorageBoundary({
  async beginBaseImport(value) {
    mountedImportCalls.push("begin");
    assert.equal(value.role, "system-303-base");
    return Object.freeze({ importId: 1, nextOffset: 0n });
  },
  async appendBaseImport() { mountedImportCalls.push("chunk"); throw new Error("this synthetic fixture does not retain 269 MiB"); },
  async finishBaseImport(value) {
    mountedImportCalls.push("finish");
    assert.equal(value.importId, 1); return selectedBaseImportResult();
  },
  async readBaseRange(value) {
    mountedRangeCalls.push(value);
    const result = new Uint8Array(value.blockCount * 1024);
    for (let block = 0; block < value.blockCount; block += 1) {
      result.fill(mountedSourceMutated ? 0xa5 : ((value.firstBlock + block) & 255),
        block * 1024, (block + 1) * 1024);
    }
    return Object.freeze({ bytes: result.buffer });
  },
  async reopenDisk(value) {
    assert.equal(value.createIfMissing, true); mountedM10.setOpen(true);
    return Object.freeze({ mounted: "synthetic" });
  },
});
const mountedBinding = new CadrM13BaseMediaBinding({ storage: mountedBoundary });
const mountedWorker = new FakeWorker();
assert.throws(() => new CadrM13Shell({ worker: new FakeWorker(),
  baseMediaBinding: mountedBinding, selectedBootArtifacts: selectedBootArtifactsFixture(),
  selectedWasmSha256: SYNTHETIC_WASM_SHA256,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) }), /one storage boundary/,
"selected constructor must receive the already-bound storage capability");
const mountedShell = new CadrM13Shell({ worker: mountedWorker, storage: mountedBoundary,
  baseMediaBinding: mountedBinding,
  m10Controller: mountedM10,
  m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
  selectedBootArtifacts: selectedBootArtifactsFixture(),
  selectedWasmSha256: SYNTHETIC_WASM_SHA256,
  wasmCompiler: async () => Object.freeze({}),
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
assert.equal(Object.hasOwn(CADR_M13_OPERATION_SCHEMAS, "base-media-mount"), true);
assert.equal(Object.hasOwn(CADR_M13_OPERATION_SCHEMAS, "machine-base-media-mount"), false);
reply = await mountedShell.submit(request(1, "base-media-mount", { importId: 1 }));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY);
reply = await mountedShell.submit(request(2, "base-import-begin", {
  role: "system-303-base", byteCount: 269562880,
  sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
}));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY);
reply = await mountedShell.submit(request(3, "base-import-chunk", {
  importId: 1, offset: 0n, bytes: Uint8Array.of(1).buffer,
  chunkSha256: await requestHash(Uint8Array.of(1)),
}));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY);
reply = await mountedShell.submit(request(4, "base-import-finish", { importId: 1 }));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY);
assert.deepEqual(mountedImportCalls, [], "no selected import method runs before bootstrap");
const wrongWasm = Uint8Array.of(1).buffer;
reply = await mountedShell.submit(request(5, "bootstrap", {
  wasmBytes: wrongWasm, wasmSha256: await requestHash(wrongWasm),
}));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST,
  "a self-consistent but non-selected Wasm module is not bootstrap authority");
assert.equal(mountedWorker.requests.length, 0, "wrong selected Wasm identity never reaches instantiate");
let nextPublicId = await preparePublicSelectedMediaMount(mountedShell, { startId: 6 });
reply = await mountedShell.submit(request(nextPublicId, "m10-reopen", {
  diskUuid: "01".repeat(16), baseSha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
  profileSha256: "02".repeat(32), artifactSetSha256: "03".repeat(32), createIfMissing: true,
}));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY,
  "selected M10 must not reopen before the public media mount");
nextPublicId += 1;
reply = await mountedShell.submit(request(nextPublicId, "machine-cold-power-on"));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY,
  "selected worker must not cold-power before the public media/M10 mount");
nextPublicId += 1;
reply = await mountedShell.submit(request(nextPublicId, "base-media-mount", { importId: 2 }));
assert.equal(reply.status, CADR_M13_STATUS.NOT_READY,
  "only the exact adopted public import ID may mount selected media");
nextPublicId += 1;
reply = await mountedShell.submit(request(nextPublicId, "base-media-mount", { importId: 1 }));
assert.equal(reply.status, 0); const mount = reply.result;
assert.equal(mount.baseBytes, 269562880);
assert.equal(mountedBinding.state, "MOUNTED");
assert.equal(mountedRangeCalls.length, Math.ceil(269562880 / (1024 * 1024)));
for (let index = 0; index < mountedRangeCalls.length; index += 1) {
  assert.equal(mountedRangeCalls[index].firstBlock, index * 1024);
  assert.equal(mountedRangeCalls[index].blockCount,
    Math.min(1024, CADR_M13_BASE_BLOCKS - index * 1024));
}
assert.deepEqual({ firstBlock: mountedRangeCalls.at(-1).firstBlock,
  blockCount: mountedRangeCalls.at(-1).blockCount },
{ firstBlock: 263168, blockCount: 77 });
assert.equal(mountedWorker.requests[0].op, "instantiate");
assert.deepEqual(mountedWorker.requests.slice(1, 9).map(value => value.op),
  ["input", "import", "input", "import", "input", "import", "input", "import"]);
assert.equal(mountedWorker.requests[9].op, "stream-begin");
assert.equal(mountedWorker.requests.at(-1).op, "stream-finish");
const mountRangeCount = mountedRangeCalls.length;
for (let chunkIndex = 0; chunkIndex < mountRangeCount; chunkIndex += 1) {
  const firstBlock = chunkIndex * 1024;
  const block = await mountedBinding.readBlock(firstBlock);
  assert.equal(block.byteLength, 1024);
  assert.equal(block[0], firstBlock & 255);
  const revalidation = mountedRangeCalls[mountRangeCount + chunkIndex];
  assert.equal(revalidation.firstBlock, firstBlock);
  assert.equal(revalidation.blockCount,
    Math.min(1024, CADR_M13_BASE_BLOCKS - firstBlock));
}
assert.deepEqual({ firstBlock: mountedRangeCalls.at(-1).firstBlock,
  blockCount: mountedRangeCalls.at(-1).blockCount },
{ firstBlock: 263168, blockCount: 77 },
"the final retained witness revalidates its exact 77-block containing range");
assert.equal(mountedBinding.verifiedBaseIdentity().byteLength, 32);
nextPublicId += 1;
reply = await mountedShell.submit(request(nextPublicId, "m10-reopen", {
  diskUuid: "01".repeat(16), baseSha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
  profileSha256: "02".repeat(32), artifactSetSha256: "03".repeat(32), createIfMissing: true,
}));
assert.equal(reply.status, 0, "public M10 reopen follows the selected public media mount");
nextPublicId += 1;
reply = await mountedShell.submit(request(nextPublicId, "machine-cold-power-on"));
assert.equal(reply.status, 0);
mountedSourceMutated = true;
await assert.rejects(() => mountedBinding.readBlock(CADR_M13_BASE_BLOCKS - 1),
  /changed after v7 verification/);
mountedShell.dispose();

/* The selected-media mount is an internal witness seam, but its lower v7
 * messages are mutations.  An error after every artifact stage and at every
 * canonical stream-chunk ordinal discards the worker rather than leaving a
 * retryable partial artifact set. */
const mountFailureStages = Object.freeze([
  ["input", 1], ["input", 2], ["input", 3], ["input", 4],
  ["import", 1], ["import", 2], ["import", 3], ["import", 4],
  ["stream-begin", 1],
  ...Array.from({ length: Math.ceil(CADR_M13_BASE_BLOCKS / 1024) }, (_, index) => ["stream-chunk", index + 1]),
  ["stream-finish", 1],
]);
for (const [failOperation, failOrdinal] of mountFailureStages) {
  const worker = new MountStageFailureWorker({ failOperation, failOrdinal });
  const binding = new MountFailureBinding();
  const failedShell = makeMountFailureShell(worker, binding);
  const mountId = await preparePublicSelectedMediaMount(failedShell);
  reply = await failedShell.submit(request(mountId, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, CADR_M13_STATUS.WORKER_LOST);
  assert.equal(reply.terminal, true);
  assert.equal(failedShell.state, "FAILED", `${failOperation}:${failOrdinal} must terminally fail the shell`);
  assert.equal(worker.terminated, true, `${failOperation}:${failOrdinal} must discard the worker`);
  assert.equal(binding.state, "IDLE", `${failOperation}:${failOrdinal} must discard retained mount state`);
  await assert.rejects(() => failedShell.submit(request(1, "keyboard-state")), /terminal/);
}

/* A backing-store failure after `stream-begin` is just as unsafe as a lower
 * rejection: all 258 positions, plus the post-`stream-finish` local adoption
 * check, must discard the already mutated worker. */
for (let failReadOrdinal = 1; failReadOrdinal <= Math.ceil(CADR_M13_BASE_BLOCKS / 1024); failReadOrdinal += 1) {
  const worker = new FakeWorker(); const binding = new MountFailureBinding({ failReadOrdinal });
  const failedShell = makeMountFailureShell(worker, binding);
  const mountId = await preparePublicSelectedMediaMount(failedShell);
  reply = await failedShell.submit(request(mountId, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, CADR_M13_STATUS.WORKER_LOST);
  assert.equal(reply.terminal, true);
  assert.equal(failedShell.state, "FAILED", `base read ${failReadOrdinal} must terminally fail the shell`);
  assert.equal(worker.terminated, true, `base read ${failReadOrdinal} must discard the worker`);
  assert.equal(binding.state, "IDLE", `base read ${failReadOrdinal} must discard retained mount state`);
}
{
  const worker = new FakeWorker(); const binding = new MountFailureBinding({ failFinish: true });
  const failedShell = makeMountFailureShell(worker, binding);
  const mountId = await preparePublicSelectedMediaMount(failedShell);
  reply = await failedShell.submit(request(mountId, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, CADR_M13_STATUS.WORKER_LOST);
  assert.equal(reply.terminal, true);
  assert.equal(failedShell.state, "FAILED"); assert.equal(worker.terminated, true);
  assert.equal(binding.state, "IDLE");
}

/* Browser transport failures and malformed replies are terminal after the
 * first lower mount mutation, at artifact, stream-open, early/final range,
 * and stream-finish boundaries.  Timeout is kept short and synthetic here. */
for (const [fault, failOperation, failOrdinal] of [
  ["malformed", "input", 1],
  ["error", "import", 4],
  ["messageerror", "stream-begin", 1],
  ["timeout", "stream-chunk", 1],
  ["malformed", "stream-chunk", Math.ceil(CADR_M13_BASE_BLOCKS / 1024)],
  ["error", "stream-finish", 1],
]) {
  const worker = new MountStageTransportWorker({ fault, failOperation, failOrdinal });
  const binding = new MountFailureBinding();
  const failedShell = makeMountFailureShell(worker, binding, { timeoutMs: 5 });
  const mountId = await preparePublicSelectedMediaMount(failedShell);
  reply = await failedShell.submit(request(mountId, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, CADR_M13_STATUS.WORKER_LOST,
    `${fault}:${failOperation}:${failOrdinal} maps to terminal worker loss`);
  assert.equal(reply.terminal, true);
  assert.equal(failedShell.state, "FAILED");
  assert.equal(worker.terminated, true);
  assert.equal(binding.state, "IDLE");
}

/* The final uint32 ID has one ordinary response and then closes the session;
 * it has no synthetic exhaustion response. */
const finalWorker = new FakeWorker();
const finalShell = new CadrM13Shell({ worker: finalWorker, initialId: 0xffffffff,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await finalShell.submit(request(0xffffffff, "keyboard-state"));
assert.equal(reply.status, 0); assert.equal(reply.terminal, true); assert.equal(finalWorker.terminated, true);
await assert.rejects(() => finalShell.submit(request(1, "keyboard-state")), /terminal/);

/* Maximum-ID terminalization is centralized above operation dispatch: it is
 * true for a mount precondition result, successful mount, and mount failure,
 * and each outcome closes its session. */
{
  const worker = new FakeWorker();
  const shell = new CadrM13Shell({ worker, initialId: 0xffffffff,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
  reply = await shell.submit(request(0xffffffff, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, CADR_M13_STATUS.NOT_READY); assert.equal(reply.terminal, true);
  assert.equal(shell.state, "TERMINATED"); assert.equal(worker.terminated, true);
  await assert.rejects(() => shell.submit(request(1, "keyboard-state")), /terminal/);
}
for (const fail of [false, true]) {
  const worker = fail ? new MountStageFailureWorker({ failOperation: "stream-finish" }) : new FakeWorker();
  const binding = new MountFailureBinding();
  const shell = makeMountFailureShell(worker, binding, { initialId: 0xfffffffc });
  const mountId = await preparePublicSelectedMediaMount(shell, { startId: 0xfffffffc });
  assert.equal(mountId, 0xffffffff);
  reply = await shell.submit(request(mountId, "base-media-mount", { importId: 1 }));
  assert.equal(reply.status, fail ? CADR_M13_STATUS.WORKER_LOST : CADR_M13_STATUS.OK);
  assert.equal(reply.terminal, true);
  assert.equal(shell.state, fail ? "FAILED" : "TERMINATED");
  assert.equal(worker.terminated, true);
  await assert.rejects(() => shell.submit(request(1, "keyboard-state")), /terminal/);
}

/* The M12-only lower status 21 has no v8 mapping and is therefore a terminal
 * protocol violation, rather than an accidental new public status code. */
class Status21Worker extends FakeWorker {
  postMessage(value) { this.requests.push(value); queueMicrotask(() => this.emit("message", { data: {
    type: "cadr-response", version: 7, id: value.id, op: value.op, status: 21, ok: false,
  } })); }
}
const status21Shell = new CadrM13Shell({ worker: new Status21Worker(), sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await status21Shell.submit(request(1, "keyboard-state"));
assert.equal(reply.status, CADR_M13_STATUS.PROTOCOL_VIOLATION); assert.equal(reply.terminal, true);

console.log("cadr M13 shell admission and isolation tests passed");
