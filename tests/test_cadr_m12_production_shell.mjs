import assert from "node:assert/strict";
import { CadrM13Shell } from "../cadr-web/browser/cadr-m13-shell.mjs";
import { CadrM13ProductionP2DebuggerApp,
  CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA } from
  "../cadr-web/browser/cadr-m13-production-app.mjs";
import { cadrM12ProductionDebuggerReceipt } from
  "../cadr-web/browser/cadr-m12-production-debugger.mjs";
import { serializeCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

function stop(reason) {
  return serializeCdrDbgStop1({ reason, breakpointIndex: reason === 1 ? 0 : 0xffffffff,
    generation: 1n, boundaryOrdinal: 1n, clockSlot: 1n, microPcBefore: 1,
    rawLcBefore: 1, microPcAfter: 2, rawLcAfter: 2, faultAfter: 0,
    deviceRequestAfter: 0, inhibitedAfter: 0, runOrdinal: 1n,
    operationSlots: reason === 1 ? 1n : 1048576n,
    profileSha256: Uint8Array.from({ length: 32 }, (_, index) => index + 1) }).buffer;
}

class WorkerDouble {
  listeners = new Map(); terminated = 0;
  constructor(stepReply) { this.stepReply = stepReply; }
  addEventListener(type, listener) { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener)); }
  postMessage(request) {
    const tail = request.op === "instantiate" ? { status: 0, lifecycle: "NEW" } :
      (typeof this.stepReply === "function" ? this.stepReply(request) : this.stepReply);
    queueMicrotask(() => { for (const listener of this.listeners.get("message") ?? []) listener({ data: {
      type: "cadr-response", version: 8, id: request.id, op: request.op,
      ok: tail.status === 0, ...tail,
    } }); });
  }
  terminate() { this.terminated += 1; }
}

async function eventually(predicate, label) {
  for (let turn = 0; turn < 80; turn += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.fail(label);
}

/* The lower worker has allocated its private bytes, but the response has not
 * reached the shell.  It deliberately remains able to send that stale reply
 * after terminate(), modeling a queued browser message rather than treating
 * terminate() as a test-double magic eraser. */
class DeferredSnapshotSaveWorker extends WorkerDouble {
  requests = []; saveRequest = null; allocated = false;
  postMessage(request) {
    this.requests.push(request);
    if (request.op === "m13-debug-snapshot-save") {
      this.saveRequest = request; this.allocated = true; return;
    }
    const tail = { status: 0, lifecycle: "PAUSED", terminal: false };
    queueMicrotask(() => this.deliver(request, tail));
  }
  deliver(request, tail) {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: {
      type: "cadr-response", version: 8, id: request.id, op: request.op,
      ok: tail.status === 0, ...tail,
    } });
  }
  deliverLateSave() {
    assert.notEqual(this.saveRequest, null, "a save must have reached the worker");
    this.deliver(this.saveRequest, { status: 0, lifecycle: "PAUSED", snapshotId: 47n,
      byteCount: 1024, snapshotSha256: "01".repeat(32) });
  }
}

async function run(stepReply) {
  const worker = new WorkerDouble(stepReply);
  const shell = new CadrM13Shell({ worker, wasmCompiler: async () => Object.freeze({}),
    sha256Function: async () => "01".repeat(32),
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 7) });
  let reply = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 1, op: "bootstrap",
    wasmBytes: Uint8Array.of(1).buffer, wasmSha256: "01".repeat(32) });
  assert.equal(reply.status, 0);
  reply = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 2, op: "debug-micro-step" });
  shell.dispose(); return { reply, worker };
}

{
  const { reply } = await run({ status: 19, lifecycle: "PAUSED",
    result: { stop: stop(1) }, terminal: false });
  assert.equal(reply.status, 19); assert.equal(reply.terminal, false);
}
{
  const { reply, worker } = await run({ status: 19, lifecycle: "PAUSED",
    result: { stop: stop(2) }, terminal: false });
  assert.equal(reply.status, 25); assert.equal(reply.terminal, true);
  assert.equal(worker.terminated, 1, "mismatched direct stop fail-stops the owned worker");
}
{
  const { reply, worker } = await run({ status: 19, lifecycle: "PAUSED",
    result: { stop: stop(1) }, terminal: false, hostileExtra: true });
  assert.equal(reply.status, 25); assert.equal(reply.terminal, true);
  assert.equal(worker.terminated, 1, "operation-inappropriate lower extras fail-stop");
}
{
  const order = [];
  const worker = new WorkerDouble(request => {
    order.push(request.op);
    if (request.op === "m13-debug-snapshot-save") return { status: 0, lifecycle: "PAUSED",
      snapshotId: 1n, byteCount: 1024, snapshotSha256: "01".repeat(32) };
    if (request.op === "m13-debug-snapshot-release") return { status: 0, lifecycle: "PAUSED", released: true };
    return { status: 0, lifecycle: "PAUSED", terminal: false };
  });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 5) });
  const transaction = shell.openDebuggerHostTransaction();
  assert.equal((await transaction.save()).status, 0);
  const reset = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 1, op: "machine-reset" });
  assert.equal(reset.status, 0);
  assert.deepEqual(order.slice(-3), ["m13-debug-snapshot-save", "m13-debug-snapshot-release", "scheduler-reset"],
    "reset releases worker snapshot before issuing the lower reset");
  await assert.rejects(transaction.save(), /invalid/, "reset invalidates the private host capability");
  const fresh = shell.openDebuggerHostTransaction();
  assert.equal((await fresh.save()).status, 0, "a successful reset admits only a fresh review capability");
  await fresh.dispose("test-fresh-dispose");
  shell.dispose();
}
{
  const order = [];
  const worker = new WorkerDouble(request => {
    if (request.op === "m13-debug-snapshot-save") return { status: 0, lifecycle: "PAUSED",
      snapshotId: 42n, byteCount: 1024, snapshotSha256: "01".repeat(32) };
    return { status: 0, lifecycle: "PAUSED", terminal: false };
  });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 13) });
  const transaction = shell.openDebuggerHostTransaction(); await transaction.save();
  transaction.onInvalidating(() => { order.push("invalidating"); });
  transaction.onDisposition(({ disposition }) => { order.push(`disposition:${disposition}`); });
  for (const listener of worker.listeners.get("error") ?? []) listener(new Error("lost"));
  for (let turn = 0; turn < 20 && order.length !== 2; turn += 1) await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(order, ["invalidating", "disposition:WORKER_TERMINATED"],
    "worker loss reports a terminal disposition after P2's invalidating fence");
  shell.dispose();
}
/* Snapshot disposal has one idempotent flight: host invalidation first, then
 * lower worker erasure, then the disposition which permits durable unpin. */
{
  const order = [];
  let nextSnapshotId = 40n;
  const worker = new WorkerDouble(request => {
    order.push(request.op);
    if (request.op === "m13-debug-snapshot-save") return { status: 0, lifecycle: "PAUSED",
      snapshotId: ++nextSnapshotId, byteCount: 1024, snapshotSha256: "01".repeat(32) };
    if (request.op === "m13-debug-snapshot-release") return { status: 0, lifecycle: "PAUSED", released: true };
    return { status: 0, lifecycle: "PAUSED", terminal: false };
  });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 12) });
  const transaction = shell.openDebuggerHostTransaction();
  await transaction.save();
  transaction.onInvalidating(({ reason }) => { order.push(`invalidating:${reason}`); });
  transaction.onDisposition(({ disposition }) => { order.push(`disposition:${disposition}`); });
  const first = transaction.dispose("explicit-discard"), second = transaction.dispose("ignored-later-reason");
  assert.strictEqual(first, second, "all disposal callers share one transaction flight");
  assert.deepEqual(await first, { disposition: "RELEASED" });
  assert.deepEqual(order, ["m13-debug-snapshot-save", "invalidating:explicit-discard",
    "m13-debug-snapshot-release", "disposition:RELEASED"],
  "the transaction never releases M10-eligible state before its worker disposition");
  const fresh = shell.openDebuggerHostTransaction();
  assert.equal((await fresh.save()).status, 0,
    "a fully released first cycle permits a fresh independently allocated snapshot");
  assert.equal((await fresh.dispose("second-cycle")).disposition, "RELEASED",
    "the second cycle releases its own worker snapshot rather than reusing cycle one state");
  assert.deepEqual(order, ["m13-debug-snapshot-save", "invalidating:explicit-discard",
    "m13-debug-snapshot-release", "disposition:RELEASED", "m13-debug-snapshot-save",
    "m13-debug-snapshot-release"], "two review cycles have separate save/release lifetimes");
  shell.dispose();
}
/* A private save may allocate in the worker immediately before the browser
 * drops or times out its response.  That is never the empty transaction case:
 * the shell must terminate the owned worker, notify P2 of the terminal
 * disposition, and reject a subsequently delivered stale success. */
{
  const worker = new DeferredSnapshotSaveWorker();
  const shell = new CadrM13Shell({ worker, timeoutMs: 5,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 14) });
  const transaction = shell.openDebuggerHostTransaction();
  const order = [];
  transaction.onInvalidating(({ reason }) => { order.push(`invalidating:${reason}`); });
  transaction.onDisposition(({ disposition }) => { order.push(`disposition:${disposition}`); });
  const saving = transaction.save();
  await eventually(() => worker.allocated, "private save was not delivered to the worker");
  await assert.rejects(saving, /lower worker response timeout/,
    "the synthetic response loss must reach the private transaction");
  await eventually(() => order.length === 2, "terminal transaction disposition was not delivered");
  assert.equal(worker.terminated, 1,
    "an ambiguous allocated save fail-stops the worker owned by this shell");
  assert.deepEqual(order, ["invalidating:private-debugger-save-ambiguous",
    "disposition:WORKER_TERMINATED"],
  "M10-facing cleanup receives a known terminal worker disposition, not ABSENT");
  assert.deepEqual(await transaction.dispose("post-timeout-dispose"),
    { disposition: "WORKER_TERMINATED" },
  "the same terminal transaction flight is reused by subsequent disposal");
  worker.deliverLateSave(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(worker.terminated, 1,
    "a stale successful save response cannot resurrect or re-terminate the transaction");
  await assert.rejects(transaction.next(0, 1), /invalid/,
    "a stale response cannot install a usable snapshot identifier after fail-stop");
  assert.throws(() => shell.openDebuggerHostTransaction(), /unavailable/,
    "the terminal shell cannot allocate a second transaction after ambiguous save");
  shell.dispose();
}
{
  const worker = new WorkerDouble({ status: 0, lifecycle: "PAUSED", snapshotId: 1n,
    byteCount: 1024, snapshotSha256: "01".repeat(32), hostileExtra: true });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 2) });
  await assert.rejects(shell.openDebuggerHostTransaction().save(), /malformed-worker-response/,
    "hostile private snapshot extras are rejected by the per-operation grammar");
  assert.equal(worker.terminated, 1); shell.dispose();
}
/* No spelling of the private snapshot operations is part of caller-issued
 * protocol v8, and malformed terminal signalling fail-stops the worker. */
{
  const worker = new WorkerDouble({ status: 0, lifecycle: "PAUSED", terminal: false });
  const shell = new CadrM13Shell({ worker, wasmCompiler: async () => Object.freeze({}),
    sha256Function: async () => "01".repeat(32),
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 8) });
  for (const [index, op] of ["debug-snapshot-save", "debug-snapshot-next", "debug-snapshot-release"].entries()) {
    const reply = await shell.submit({ type: "cadr-request", version: 8,
      sessionId: shell.sessionId, id: index + 1, op });
    assert.equal(reply.status, 2, `${op} is absent from the external schema`);
  }
  assert.equal(worker.listeners.get("message")?.length, 1);
  shell.dispose();
}
{
  const order = [];
  const worker = new WorkerDouble(request => {
    order.push(request.op);
    if (request.op === "m13-debug-snapshot-save") return { status: 0, lifecycle: "PAUSED",
      snapshotId: 2n, byteCount: 1024, snapshotSha256: "01".repeat(32) };
    if (request.op === "m13-debug-snapshot-release") return { status: 0, lifecycle: "PAUSED", released: true };
    if (request.op === "scheduler-reset") return { status: 9, lifecycle: "PAUSED", terminal: false };
    return { status: 0, lifecycle: "PAUSED", terminal: false };
  });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 10) });
  const transaction = shell.openDebuggerHostTransaction(); await transaction.save();
  const reset = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 1, op: "machine-reset" });
  assert.equal(reset.status, 9); assert.equal(reset.terminal, false,
    "a lower reset rejection is returned only after private snapshot erasure");
  assert.deepEqual(order, ["m13-debug-snapshot-save", "m13-debug-snapshot-release", "scheduler-reset"]);
  await assert.rejects(transaction.next(0, 1), /invalid/,
    "failed reset does not revive the erased pre-reset snapshot capability");
  assert.ok(shell.openDebuggerHostTransaction(), "failed reset permits only a fresh empty transaction");
  shell.dispose();
}
{
  const worker = new WorkerDouble(request => request.op === "m13-debug-snapshot-save" ?
    { status: 0, lifecycle: "PAUSED", snapshotId: 3n, byteCount: 1024,
      snapshotSha256: "01".repeat(32) } : { status: 9, lifecycle: "PAUSED", terminal: false });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 11) });
  const transaction = shell.openDebuggerHostTransaction(); await transaction.save();
  const reset = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 1, op: "machine-reset" });
  assert.equal(reset.status, 25); assert.equal(reset.terminal, true);
  assert.equal(worker.terminated, 1, "unconfirmed worker snapshot erasure fail-stops the owned worker");
  await assert.rejects(transaction.next(0, 1), /invalid/);
  shell.dispose();
}
{
  const worker = new WorkerDouble({ status: 0, lifecycle: "PAUSED", terminal: false });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 5) });
  const transaction = shell.openDebuggerHostTransaction();
  const reset = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 1, op: "machine-reset" });
  assert.equal(reset.status, 0);
  await assert.rejects(transaction.save(), /invalid/, "reset invalidates the private host capability");
  shell.dispose();
}
{
  const worker = new WorkerDouble({ status: 0, lifecycle: "PAUSED", terminal: false });
  const shell = new CadrM13Shell({ worker,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 3) });
  const transaction = shell.openDebuggerHostTransaction();
  for (const listener of worker.listeners.get("error") ?? []) listener(new Error("lost"));
  await assert.rejects(transaction.save(), /invalid/, "worker loss invalidates the private host capability");
  assert.equal(worker.terminated, 1); shell.dispose();
}
{
  const worker = new WorkerDouble({ status: 25, lifecycle: "PAUSED", terminal: false });
  const shell = new CadrM13Shell({ worker, wasmCompiler: async () => Object.freeze({}),
    sha256Function: async () => "01".repeat(32),
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 9) });
  await shell.submit({ type: "cadr-request", version: 8, sessionId: shell.sessionId,
    id: 1, op: "bootstrap", wasmBytes: Uint8Array.of(1).buffer, wasmSha256: "01".repeat(32) });
  const reply = await shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: 2, op: "debug-micro-step" });
  assert.equal(reply.status, 25); assert.equal(reply.terminal, true);
  assert.equal(worker.terminated, 1, "hostile status25 terminal false cannot leave the worker live");
}
{
  const worker = new WorkerDouble({ status: 19, lifecycle: "PAUSED",
    result: { stop: stop(1) }, terminal: false });
  const shell = new CadrM13Shell({ worker, sha256Function: async () => "01".repeat(32),
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 6) });
  assert.throws(() => new CadrM13ProductionP2DebuggerApp({ shell,
    receipt: { schema: CADR_M13_PRODUCTION_P2_DEBUGGER_SCHEMA,
      profile: cadrM12ProductionDebuggerReceipt().profile, disposition: "source-only" } }),
  /created by P1 handoffDebugger/,
  "P2 cannot be built from a raw shell or allocate a second public request path");
  shell.dispose();
}
console.log("cadr m12 production shell stop-binding tests passed");
