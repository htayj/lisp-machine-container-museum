/* Bounded protocol-v3 lifecycle matrix.  Rich running/host-wait fixtures are
 * intentionally separate from this terminal-state contract test. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { m5SlotAdvanceAllowed, runM5DigestBatch } from "../cadr-web/wasm/cadr-m5-batch.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM = resolve(ROOT, "cadr-web/build/cadr-web-m5-O0.wasm");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const TIMEOUT_MS = 30000;

async function fakeM5Batch(sequence, state, { failure = null, digest = null } = {}) {
  let current = null;
  let digestCalls = 0;
  const result = await runM5DigestBatch({
    clockSlots: 1, state,
    runOne: () => { current = sequence.shift(); return current.status; },
    metadata: () => current.meta,
    outputDigest: () => {
      digestCalls += 1;
      if (digest === null) throw new Error("unexpected ordinary digest");
      return { status: 0, digests: digest.slice() };
    },
    isFailure: status => status === 7 || status === 12 || status === 13 || status === 16,
    collectFailure: status => failure === null ? null : failure(status),
    statusOk: 0, statusWaiting: 8, waitingLifecycle: "WAITING_FOR_HOST",
  });
  return { result, digestCalls };
}

/* The helper is the production batch state machine used by the worker.  These
 * deterministic turns cover the cases no public quiescent snapshot can stage:
 * a just-completed boundary, a chained completion, and a terminal slot. */
{
  assert.equal(m5SlotAdvanceAllowed({ visibilityInitialized: true, lifecycle: "RUNNING",
    hidden: false, pendingBoundaryDigest: false }, "RUNNING"), true);
  for (const state of [
    { visibilityInitialized: false, lifecycle: "RUNNING", hidden: false, pendingBoundaryDigest: false },
    { visibilityInitialized: true, lifecycle: "PAUSED", hidden: false, pendingBoundaryDigest: false },
    { visibilityInitialized: true, lifecycle: "RUNNING", hidden: true, pendingBoundaryDigest: false },
    { visibilityInitialized: true, lifecycle: "RUNNING", hidden: false, pendingBoundaryDigest: true },
  ]) assert.equal(m5SlotAdvanceAllowed(state, "RUNNING"), false);
  assert.equal(m5SlotAdvanceAllowed({ visibilityInitialized: true, lifecycle: "PAUSED",
    hidden: false, pendingBoundaryDigest: true }, "PAUSED"), false,
  "an owed boundary fences PAUSED single-step just as it fences RUNNING batches");
  const row = new Uint8Array(128).fill(0x5a);
  const state = { pendingBoundaryDigest: false, lifecycle: "RUNNING" };
  let fake = await fakeM5Batch([{ meta: [1n, 1n], status: 8 }], state, { digest: row });
  assert.equal(fake.result.boundaryCount, 0); assert.equal(fake.result.boundaryPendingHost, true);
  assert.equal(fake.digestCalls, 0); assert.equal(state.pendingBoundaryDigest, true);
  /* A queued completion can synchronously issue a second request.  It still
   * owns the original guest boundary and publishes no intermediate digest. */
  state.lifecycle = "RUNNING";
  fake = await fakeM5Batch([{ meta: [0n, 0n], status: 8 }], state, { digest: row });
  assert.equal(fake.result.boundaryCount, 0); assert.equal(fake.result.boundaryPendingHost, true);
  assert.equal(fake.digestCalls, 0); assert.equal(state.pendingBoundaryDigest, true);
  state.lifecycle = "RUNNING";
  fake = await fakeM5Batch([{ meta: [0n, 0n], status: 0 }], state, { digest: row });
  assert.equal(fake.result.boundaryCount, 1); assert.equal(fake.result.rows.length, 1);
  assert.deepEqual(fake.result.rows[0], row); assert.equal(state.pendingBoundaryDigest, false);
  /* An initially outstanding request has no completed guest slot to owe. */
  const initial = { pendingBoundaryDigest: false, lifecycle: "RUNNING" };
  fake = await fakeM5Batch([{ meta: [0n, 0n], status: 8 }], initial, { digest: row });
  assert.equal(fake.result.boundaryCount, 0); assert.equal(fake.result.boundaryPendingHost, false);
  assert.equal(initial.pendingBoundaryDigest, false);
  const queueDigest = new Uint8Array(32).fill(0x11);
  const coreStateDigest = new Uint8Array(32).fill(0x22);
  const failedState = { pendingBoundaryDigest: false, lifecycle: "RUNNING" };
  fake = await fakeM5Batch([{ meta: [1n, 1n], status: 12 }], failedState, {
    failure: status => {
      failedState.lifecycle = "FAILED";
      return { status, lastCompleteBoundary: 17n, queueDigest: queueDigest.buffer,
        coreStateDigest: coreStateDigest.buffer };
    },
  });
  assert.equal(fake.result.boundaryCount, 0); assert.equal(fake.digestCalls, 0,
    "terminal staged-write evidence is collected before any ordinary digest");
  assert.equal(failedState.lifecycle, "FAILED");
  assert.equal(fake.result.failure.lastCompleteBoundary, 17n);
  assert.deepEqual(new Uint8Array(fake.result.failure.queueDigest), queueDigest);
  assert.deepEqual(new Uint8Array(fake.result.failure.coreStateDigest), coreStateDigest);
  console.log("cadr_m5_worker_protocol_batch_helper: ok");
}

class Probe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", (message) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter.resolve(message); else this.messages.push(message);
    });
  }
  send(message) { this.worker.postMessage(message); }
  next(label) {
    if (this.messages.length) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error(`timeout waiting for ${label}`)), TIMEOUT_MS);
      this.waiters.push({ resolve: (value) => { clearTimeout(timer); resolveNext(value); } });
    });
  }
}

const module = await WebAssembly.compile(await readFile(WASM));
const worker = new Worker(WORKER, { type: "module" });
const probe = new Probe(worker);
try {
  probe.send({ version: 3, id: 1, op: "instantiate", module });
  let reply = await probe.next("instantiate");
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "NEW");
  for (const [id, op, request] of [
    [2, "scheduler-pause", {}],
    [3, "scheduler-start", {}],
    [4, "scheduler-single-step", {}],
    [5, "scheduler-reset", {}],
    [6, "scheduler-transcript-start", {}],
  ]) {
    probe.send({ version: 3, id, op, ...request });
    reply = await probe.next(op);
    assert.equal(reply.status, 9, `${op} is unavailable in NEW`);
    assert.equal(reply.lifecycle, "NEW");
  }
  probe.send({ version: 3, id: 7, op: "scheduler-run", clockSlots: 1 });
  reply = await probe.next("run in NEW");
  assert.equal(reply.status, 9, "valid run request is lifecycle-gated");
  probe.send({ version: 3, id: 8, op: "scheduler-run", clockSlots: 0 });
  reply = await probe.next("zero run budget");
  assert.equal(reply.status, 2, "zero run budget is malformed independent of lifecycle");
  probe.send({ version: 3, id: 9, op: "run", clockSlots: 1 });
  reply = await probe.next("legacy run in v3");
  assert.equal(reply.status, 2, "legacy execution surface is unavailable in v3");
  probe.send({ version: 3, id: 10, op: "scheduler-stop" });
  reply = await probe.next("stop");
  assert.equal(reply.status, 9); assert.equal(reply.lifecycle, "NEW");
  probe.send({ version: 3, id: 11, op: "scheduler-visibility", hidden: true });
  reply = await probe.next("visibility after stop");
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "NEW");
  console.log("cadr_m5_worker_protocol: ok");
} finally {
  await worker.terminate();
}

const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m5-pending-"));
const fixturePath = resolve(fixtureDirectory, "pending.cdrsnap1");
const pendingWorker = new Worker(WORKER, { type: "module" });
const pendingProbe = new Probe(pendingWorker);
try {
  execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/test_cadr_m2_public"], { stdio: "inherit" });
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
    ["--emit-m5-pending-snapshot", fixturePath]);
  const fixture = await readFile(fixturePath);
  pendingProbe.send({ version: 3, id: 1, op: "instantiate", module });
  let reply = await pendingProbe.next("pending instantiate"); assert.equal(reply.status, 0);
  pendingProbe.send({ version: 3, id: 2, op: "snapshot-restore-import",
    snapshot: fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength),
    allowLegacyNativeImport: true });
  reply = await pendingProbe.next("pending restore"); assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
  pendingProbe.send({ version: 3, id: 3, op: "scheduler-visibility", hidden: false });
  reply = await pendingProbe.next("initial visibility"); assert.equal(reply.status, 0);
  pendingProbe.send({ version: 3, id: 4, op: "scheduler-start" });
  reply = await pendingProbe.next("pending start"); assert.equal(reply.status, 0);
  pendingProbe.send({ version: 3, id: 5, op: "run-digest-batch-m5", clockSlots: 1 });
  reply = await pendingProbe.next("pending M5 batch");
  assert.equal(reply.status, 0); assert.equal(reply.boundaryCount, 0);
  assert.equal(reply.terminalStatus, 8); assert.equal(reply.boundaryPendingHost, false); assert.equal(reply.lifecycle, "WAITING_FOR_HOST");
  assert.equal(new Uint8Array(reply.digests).byteLength, 0,
    "host-wait boundary is not prematurely hashed");
  pendingProbe.send({ version: 3, id: 6, op: "scheduler-pause" });
  reply = await pendingProbe.next("pause while waiting");
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
  pendingProbe.send({ version: 3, id: 7, op: "host-next-request" });
  reply = await pendingProbe.next("pending request"); assert.equal(reply.status, 0);
  const hostRequest = reply.request;
  pendingProbe.send({ version: 3, id: 8, op: "host-complete", operation: hostRequest.operation,
    hostStatus: 0, generation: hostRequest.generation, requestId: hostRequest.requestId,
    bytes: new ArrayBuffer(0) });
  reply = await pendingProbe.next("pending complete"); assert.equal(reply.status, 0);
  pendingProbe.send({ version: 3, id: 9, op: "scheduler-start" });
  reply = await pendingProbe.next("resume after completion"); assert.equal(reply.status, 0);
  pendingProbe.send({ version: 3, id: 10, op: "run-digest-batch-m5", clockSlots: 1 });
  reply = await pendingProbe.next("deferred completion batch");
  assert.equal(reply.status, 0); assert.equal(reply.boundaryCount, 0);
  assert.equal(new Uint8Array(reply.digests).byteLength, 0,
    "NETWORK fixture completion has no guest device boundary to hash");
  console.log("cadr_m5_worker_protocol_pending: ok");
} finally {
  await pendingWorker.terminate();
  await rm(fixtureDirectory, { recursive: true, force: true });
}

const fatalDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m5-fatal-"));
const fatalPath = resolve(fatalDirectory, "fatal.cdrsnap1");
const fatalWorker = new Worker(WORKER, { type: "module" });
const fatalProbe = new Probe(fatalWorker);
try {
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
    ["--emit-m5-fatal-snapshot", fatalPath]);
  const fixture = await readFile(fatalPath);
  fatalProbe.send({ version: 3, id: 1, op: "instantiate", module });
  let reply = await fatalProbe.next("fatal instantiate"); assert.equal(reply.status, 0);
  fatalProbe.send({ version: 3, id: 2, op: "snapshot-restore-import",
    snapshot: fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength),
    allowLegacyNativeImport: true });
  reply = await fatalProbe.next("fatal restore");
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
  /* Establish actual CDRM5C1 policy records before the terminal boundary. */
  fatalProbe.send({ version: 3, id: 3, op: "scheduler-visibility", hidden: true });
  reply = await fatalProbe.next("fatal hide"); assert.equal(reply.status, 0); assert.equal(reply.hidden, true);
  fatalProbe.send({ version: 3, id: 4, op: "scheduler-visibility", hidden: false });
  reply = await fatalProbe.next("fatal show"); assert.equal(reply.status, 0); assert.equal(reply.hidden, false);
  fatalProbe.send({ version: 3, id: 5, op: "scheduler-start" });
  reply = await fatalProbe.next("fatal start"); assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "RUNNING");
  fatalProbe.send({ version: 3, id: 6, op: "run-digest-batch-m5", clockSlots: 1 });
  reply = await fatalProbe.next("fatal terminal batch");
  assert.equal(reply.status, 0); assert.equal(reply.terminalStatus, 16);
  assert.equal(reply.lifecycle, "FAILED"); assert.equal(reply.boundaryCount, 0);
  assert.equal(reply.lastCompleteBoundary, 1n);
  assert.equal(new Uint8Array(reply.queueDigest).byteLength, 32);
  assert.equal(new Uint8Array(reply.coreStateDigest).byteLength, 32);
  const failedQueueDigest = new Uint8Array(reply.queueDigest);
  const failedCoreStateDigest = new Uint8Array(reply.coreStateDigest);
  fatalProbe.send({ version: 3, id: 7, op: "scheduler-state" });
  reply = await fatalProbe.next("fatal state");
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "FAILED");
  assert.equal(reply.lastCompleteBoundary, 1n);
  assert.equal(reply.controlOrdinal, 2n); assert.equal(reply.controlBoundary, 0n);
  assert.notDeepEqual([...new Uint8Array(reply.controlWitness)], Array(32).fill(0));
  assert.deepEqual(new Uint8Array(reply.queueDigest), failedQueueDigest);
  assert.deepEqual(new Uint8Array(reply.coreStateDigest), failedCoreStateDigest);
  let rejectId = 8;
  for (const op of ["scheduler-start", "scheduler-pause", "scheduler-single-step",
    "scheduler-reset", "scheduler-stop", "scheduler-visibility", "scheduler-events",
    "scheduler-run", "run-digest-batch-m5", "boundary-digest-v5", "host-next-request",
    "snapshot-save", "snapshot-restore-import"]) {
    const request = { version: 3, id: rejectId++, op };
    if (op === "scheduler-visibility") request.hidden = false;
    if (op === "scheduler-events") request.events = [clockEvent(0n)];
    if (op === "scheduler-run" || op === "run-digest-batch-m5") request.clockSlots = 1;
    if (op === "snapshot-restore-import") request.snapshot = new ArrayBuffer(1);
    fatalProbe.send(request);
    reply = await fatalProbe.next(`fatal ${op} rejection`);
    assert.equal(reply.status, 9, `${op} rejects after FAILED`);
    assert.equal(reply.lifecycle, "FAILED");
  }
  console.log("cadr_m5_worker_protocol_fatal: ok");
} finally {
  await fatalWorker.terminate();
  await rm(fatalDirectory, { recursive: true, force: true });
}

/* The public M3 snapshot is deliberately the only ordinary runnable fixture
 * used below.  It enters v3 through the legacy-import fence, then every
 * scheduler transition is driven through the public worker protocol. */
const runnableDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m5-runnable-"));
const runnablePath = resolve(runnableDirectory, "runnable.cdrsnap1");
execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
  ["--emit-m3-snapshot", runnablePath]);
const runnableFixture = await readFile(runnablePath);

function clockEvent(dueTick) {
  return { kind: 2, flags: 0, dueTick, generation: 0n, value: 1, reserved0: 0 };
}

async function schedulerCoordinates(local, label) {
  local.probe.send({ version: 3, id: local.nextId++, op: "machine-info" });
  const reply = await local.probe.next(`${label} machine info`);
  assert.equal(reply.status, 0);
  const view = new DataView(reply.info);
  return { clock: view.getBigUint64(8, true), generation: view.getBigUint64(24, true) };
}

async function scheduleClocks(local, count, label) {
  const { clock, generation } = await schedulerCoordinates(local, label);
  const events = Array.from({ length: count }, (_, index) => {
    const event = clockEvent(clock + BigInt(index));
    event.generation = generation;
    return event;
  });
  local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-events", events });
  const reply = await local.probe.next(`${label} events`);
  assert.equal(reply.status, 0); assert.equal(reply.delivered, count);
}

async function newRunnableProbe(label, { visible = true } = {}) {
  const localWorker = new Worker(WORKER, { type: "module" });
  const localProbe = new Probe(localWorker);
  localProbe.send({ version: 3, id: 1, op: "instantiate", module });
  let reply = await localProbe.next(`${label} instantiate`);
  assert.equal(reply.status, 0);
  localProbe.send({ version: 3, id: 2, op: "snapshot-restore-import",
    snapshot: runnableFixture.buffer.slice(runnableFixture.byteOffset,
      runnableFixture.byteOffset + runnableFixture.byteLength),
    allowLegacyNativeImport: true });
  reply = await localProbe.next(`${label} restore`);
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
  if (visible) {
    localProbe.send({ version: 3, id: 3, op: "scheduler-visibility", hidden: false });
    reply = await localProbe.next(`${label} visibility`);
    assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
  }
  return { worker: localWorker, probe: localProbe, nextId: visible ? 4 : 3 };
}

try {
  const local = await newRunnableProbe("runnable matrix");
  try {
      local.probe.send({ version: 3, id: local.nextId++, op: "boundary-digest-v5" });
      let reply = await local.probe.next("H01 baseline digest");
      assert.equal(reply.status, 0);
      const before = new Uint8Array(reply.digest);
      local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-visibility", hidden: true });
      reply = await local.probe.next("H01 hide");
      assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED"); assert.equal(reply.hidden, true);
      local.probe.send({ version: 3, id: local.nextId++, op: "boundary-digest-v5" });
      reply = await local.probe.next("H01 hidden digest");
      assert.deepEqual(new Uint8Array(reply.digest), before,
        "hide changes the worker policy witness, never a core boundary or queue");
      local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-visibility", hidden: false });
      reply = await local.probe.next("H01 show");
      assert.equal(reply.status, 0); assert.equal(reply.hidden, false);
      local.probe.send({ version: 3, id: local.nextId++, op: "boundary-digest-v5" });
      reply = await local.probe.next("H01 shown digest");
      assert.deepEqual(new Uint8Array(reply.digest), before);
      local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-state" });
      reply = await local.probe.next("H01 state");
      assert.equal(reply.controlOrdinal, 2n); assert.equal(reply.controlBoundary, 0n);
    await scheduleClocks(local, 1, "ordinary");
    local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-start" });
    reply = await local.probe.next("PAUSED to RUNNING");
    assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "RUNNING");
    local.probe.send({ version: 3, id: local.nextId++, op: "run-digest-batch-m5", clockSlots: 1 });
    reply = await local.probe.next("ordinary M5 batch");
    assert.equal(reply.status, 0); assert.equal(reply.boundaryCount, 1);
    assert.equal(reply.terminalStatus, 0); assert.equal(reply.lifecycle, "RUNNING");
    assert.equal(new Uint8Array(reply.digests).byteLength, 128);
    local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-pause" });
    reply = await local.probe.next("ordinary pause");
    assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
    local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-single-step" });
    reply = await local.probe.next("PAUSED single step");
    assert.equal(reply.status, 0); assert.equal(reply.completedSlots, 1n);
    assert.equal(reply.lifecycle, "PAUSED");
    for (const control of ["scheduler-pause", "scheduler-stop"]) {
      await scheduleClocks(local, 4, control);
      local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-start" });
      reply = await local.probe.next(`${control} start`); assert.equal(reply.lifecycle, "RUNNING");
      const runId = local.nextId++;
      const controlId = local.nextId++;
      local.probe.send({ version: 3, id: runId, op: "scheduler-run", clockSlots: 4 });
      local.probe.send({ version: 3, id: controlId, op: control });
      reply = await local.probe.next(`${control} live run`);
      assert.equal(reply.id, runId); assert.equal(reply.status, 0);
      assert(reply.completedSlots > 0n && reply.completedSlots < 4n,
        "live control is observed only after a complete outer boundary");
      reply = await local.probe.next(`${control} live response`);
      assert.equal(reply.id, controlId); assert.equal(reply.status, 0);
      assert.equal(reply.lifecycle, control === "scheduler-stop" ? "STOPPED" : "PAUSED");
      if (control === "scheduler-pause") {
        local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-reset" });
        reply = await local.probe.next("PAUSED reset");
        assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
        local.probe.send({ version: 3, id: local.nextId++, op: "boot" });
        reply = await local.probe.next("reset boot");
        assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "PAUSED");
      } else {
        local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-events",
          events: [clockEvent(0n)] });
        reply = await local.probe.next("STOPPED terminal rejection");
        assert.equal(reply.status, 9); assert.equal(reply.lifecycle, "STOPPED");
        local.probe.send({ version: 3, id: local.nextId++, op: "scheduler-state" });
        reply = await local.probe.next("STOPPED state"); assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "STOPPED");
      }
    }
    console.log("cadr_m5_worker_protocol_runnable_matrix: ok");
  } finally { await local.worker.terminate(); }
} finally {
  await rm(runnableDirectory, { recursive: true, force: true });
}
