import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM = resolve(ROOT, "cadr-web/build/cadr-web-m5-O0.wasm");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));

class Probe {
  constructor(worker) {
    this.worker = worker;
    this.messages = [];
    this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(message); else this.messages.push(message);
    });
  }
  send(message) { this.worker.postMessage(message); }
  next() {
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise(resolveNext => this.waiters.push(resolveNext));
  }
}

const directory = await mkdtemp(resolve(tmpdir(), "cadr-m6-worker-"));
const snapshotPath = resolve(directory, "pre-halt.cdrsnap1");
const module = await WebAssembly.compile(await readFile(WASM));

async function runVersion(version) {
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    probe.send({ version, id: 1, op: "instantiate", module });
    let reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version, id: 2, op: "scheduler-queue-digest" });
    reply = await probe.next();
    if (version !== 4) {
      assert.equal(reply.status, 2);
      probe.send({ version, id: 3, op: "boot-witness" });
      reply = await probe.next();
      assert.equal(reply.status, 2);
      return;
    }
    assert.equal(reply.status, 0);
    assert.equal(new Uint8Array(reply.digest).byteLength, 32);
    execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
      ["--emit-m5-fatal-snapshot", snapshotPath]);
    const snapshot = await readFile(snapshotPath);
    probe.send({ version, id: 3, op: "snapshot-restore-import",
      snapshot: snapshot.buffer.slice(
        snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength),
      allowLegacyNativeImport: true });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version, id: 4, op: "scheduler-queue-digest" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(new Uint8Array(reply.digest).byteLength, 32);
    probe.send({ version, id: 5, op: "boot-witness" });
    reply = await probe.next();
    assert.equal(reply.status, 9,
      "CDRM6I1 is unavailable from an unsafe paused/uninitialized lifecycle");
    probe.send({ version, id: 6, op: "scheduler-visibility", hidden: false });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version, id: 7, op: "scheduler-start" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version, id: 8, op: "boot-witness" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(reply.wireSchema, "CDRM6I1");
    assert.equal(new TextDecoder().decode(
      new Uint8Array(reply.sample).slice(0, 7)), "CDRM6I1");
    assert.equal(new Uint8Array(reply.sample).byteLength, 96);
    assert.equal(reply.debugInstruction >= 0n, true);
    assert.equal(reply.debugInstruction <= 0xffffffffffffn, true);
    assert.equal(reply.boundary, 0n);
    assert.equal(reply.generation, 1n);
    assert.equal(reply.coreLifecycle, 2);
    assert.equal(reply.persistentStatus, 0);
    assert.equal(reply.schedulerPendingCount, 0);
    assert.equal(reply.schedulerPhase, 0);
    assert.equal(reply.iobFifoCount, 0);
    assert.equal(reply.outstandingRequestId, 0n);
    assert.equal(reply.outstandingOperation, 0);
    assert.equal(reply.diskInterruptRequest, 0);
    assert.equal(reply.hostRequestPending, 0);
    assert.equal(reply.hostCompletionQueued, 0);
    assert.equal(reply.diskTransferActive, 0);
    assert.equal(reply.boundaryPendingHost, false);
    assert.equal(reply.runActive, false);
    assert.equal(reply.deferredControlCount, 0);
    assert.equal(reply.mediaBusy, false);
    assert.equal(reply.mediaDirty, false);
    assert.equal(reply.mediaSnapshotBlocked, false);
    assert.equal(reply.mediaOverlayGeneration, 0n);
    assert.equal(reply.expectedCompletionByteCount, 0n);
    assert.equal(reply.completionByteCount, 0n);
    assert.equal(reply.visibilityInitialized, true);
    assert.equal(reply.hidden, false);
  } finally {
    await worker.terminate();
  }
}

async function assertNormalM6KeepsDiagnosticOperationUnbound() {
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    probe.send({ version: 4, id: 1, op: "instantiate", module });
    let reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version: 4, id: 2, op: "post-terminal-diagnostic" });
    reply = await probe.next();
    assert.equal(reply.status, 2,
      "the normal frozen M6 module keeps the diagnostic-only operation unbound");
  } finally {
    await worker.terminate();
  }
}

try {
  await runVersion(2);
  await runVersion(3);
  await runVersion(4);
  await assertNormalM6KeepsDiagnosticOperationUnbound();
  console.log("cadr_m6_worker: ok");
} finally {
  await rm(directory, { recursive: true, force: true });
}
