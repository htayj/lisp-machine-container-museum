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

/* The production binding hashes real 1 MiB ranges.  The fault matrix below
 * only needs to reach every shell emission ordinal, so this in-memory subclass
 * preserves its canonical range state machine while avoiding 258 copies times
 * 258 injected failures.  It is not used as base-identity evidence. */
class MountFailureBinding extends CadrM13BaseMediaBinding {
  #state = "IDLE"; #nextBlock = 0; #body = new Uint8Array(1); #readOrdinal = 0;
  #failReadOrdinal; #failFinish;
  constructor({ failReadOrdinal = null, failFinish = false } = {}) {
    super({ storage: new CadrM13StorageBoundary({
      async readBaseRange() { throw new Error("fault binding never reads storage"); },
    }) });
    this.#failReadOrdinal = failReadOrdinal; this.#failFinish = failFinish;
  }
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

function makeMountFailureShell(worker, binding) {
  return new CadrM13Shell({ worker, baseMediaBinding: binding,
    selectedBootArtifacts: [
      { kind: 1, bytes: new ArrayBuffer(854) }, { kind: 2, bytes: new ArrayBuffer(20480) },
      { kind: 4, bytes: new ArrayBuffer(3130) }, { kind: 5, bytes: new ArrayBuffer(83270) },
    ], sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
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
let mountedSourceMutated = false;
const mountedBoundary = new CadrM13StorageBoundary({
  async readBaseRange(value) {
    mountedRangeCalls.push(value);
    const result = new Uint8Array(value.blockCount * 1024);
    for (let block = 0; block < value.blockCount; block += 1) {
      result.fill(mountedSourceMutated ? 0xa5 : ((value.firstBlock + block) & 255),
        block * 1024, (block + 1) * 1024);
    }
    return Object.freeze({ bytes: result.buffer });
  },
});
const mountedBinding = new CadrM13BaseMediaBinding({ storage: mountedBoundary });
const mountedWorker = new FakeWorker();
const mountedShell = new CadrM13Shell({ worker: mountedWorker,
  baseMediaBinding: mountedBinding,
  selectedBootArtifacts: [
    { kind: 1, bytes: new ArrayBuffer(854) },
    { kind: 2, bytes: new ArrayBuffer(20480) },
    { kind: 4, bytes: new ArrayBuffer(3130) },
    { kind: 5, bytes: new ArrayBuffer(83270) },
  ], sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
assert.equal(Object.hasOwn(CADR_M13_OPERATION_SCHEMAS, "machine-base-media-mount"), false);
reply = await mountedShell.submit(request(1, "machine-base-media-mount", { importId: 9 }));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);
const mount = await mountedShell.mountSelectedMediaWitness(9);
assert.equal(mount.baseBytes, 269562880);
assert.equal(mountedBinding.state, "MOUNTED");
assert.equal(mountedRangeCalls.length, Math.ceil(269562880 / (1024 * 1024)));
assert.deepEqual(mountedWorker.requests.slice(0, 8).map(value => value.op),
  ["input", "import", "input", "import", "input", "import", "input", "import"]);
assert.equal(mountedWorker.requests[8].op, "stream-begin");
assert.equal(mountedWorker.requests.at(-1).op, "stream-finish");
assert.deepEqual([...await mountedBinding.readBlock(17)], new Array(1024).fill(17));
assert.equal(mountedBinding.verifiedBaseIdentity().byteLength, 32);
mountedSourceMutated = true;
await assert.rejects(() => mountedBinding.readBlock(17), /changed after v7 verification/);
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
  await assert.rejects(() => failedShell.mountSelectedMediaWitness(1), /selected-media witness mount failed/);
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
  await assert.rejects(() => failedShell.mountSelectedMediaWitness(1), /selected-media witness mount failed/);
  assert.equal(failedShell.state, "FAILED", `base read ${failReadOrdinal} must terminally fail the shell`);
  assert.equal(worker.terminated, true, `base read ${failReadOrdinal} must discard the worker`);
  assert.equal(binding.state, "IDLE", `base read ${failReadOrdinal} must discard retained mount state`);
}
{
  const worker = new FakeWorker(); const binding = new MountFailureBinding({ failFinish: true });
  const failedShell = makeMountFailureShell(worker, binding);
  await assert.rejects(() => failedShell.mountSelectedMediaWitness(1), /selected-media witness mount failed/);
  assert.equal(failedShell.state, "FAILED"); assert.equal(worker.terminated, true);
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
