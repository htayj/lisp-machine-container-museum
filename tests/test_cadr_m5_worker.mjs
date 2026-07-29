/* M5 protocol-v3 framing and terminal-worker checks. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM = resolve(ROOT, "cadr-web/build/cadr-web-m5-O0.wasm");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m5-worker-"));
const fixturePath = resolve(fixtureDirectory, "m3.cdrsnap1");

function rehashEnvelope(bytes) {
  const digest = createHash("sha256").update(bytes.subarray(0, 72)).update(bytes.subarray(104)).digest();
  bytes.set(digest, 72);
}

class Probe {
  constructor(worker) {
    this.worker = worker; this.waiters = []; this.messages = [];
    worker.on("message", (message) => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(message); else this.messages.push(message);
    });
  }
  send(value) { this.worker.postMessage(value); }
  next() {
    if (this.messages.length) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error("timeout waiting for worker response")), 10000);
      this.waiters.push((message) => { clearTimeout(timer); resolveNext(message); });
    });
  }
}

const module = await WebAssembly.compile(await readFile(WASM));
const worker = new Worker(WORKER, { type: "module" });
const probe = new Probe(worker);
try {
  probe.send({ version: 3, id: 1, op: "instantiate", module });
  let result = await probe.next();
  assert.equal(result.status, 0); assert.equal(result.version, 3);
  probe.send({ version: 3, id: 2, op: "scheduler-state" });
  result = await probe.next(); assert.equal(result.lifecycle, "NEW");
  assert.equal(result.controlOrdinal, 0n); assert.equal(new Uint8Array(result.controlWitness).byteLength, 32);
  /* v3 requires all fixed-width event fields and rejects a removed disk-ready
   * pseudo-event before any batch member can reach the core. */
  probe.send({ version: 3, id: 3, op: "scheduler-events", events: [{
    kind: 4, flags: 0, dueTick: 0n, generation: 1n, value: 0, reserved0: 0,
  }] });
  result = await probe.next(); assert.equal(result.status, 2);
  probe.send({ version: 3, id: 4, op: "scheduler-start" });
  result = await probe.next(); assert.equal(result.status, 9, "COLD core cannot start worker execution");
  execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/test_cadr_m2_public"], { stdio: "inherit" });
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"), ["--emit-m3-snapshot", fixturePath]);
  const fixture = await readFile(fixturePath);
  probe.send({ version: 3, id: 5, op: "snapshot-restore-import",
    snapshot: fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength),
    allowLegacyNativeImport: true });
  result = await probe.next(); assert.equal(result.status, 0); assert.equal(result.lifecycle, "PAUSED");
  probe.send({ version: 3, id: 6, op: "boundary-digest-v5" });
  result = await probe.next(); assert.equal(result.status, 0, "V5 digest is ready directly after restore");
  probe.send({ version: 3, id: 7, op: "scheduler-visibility", hidden: true });
  result = await probe.next(); assert.equal(result.status, 0); assert.equal(result.hidden, true);
  probe.send({ version: 3, id: 8, op: "scheduler-state" });
  result = await probe.next(); assert.equal(result.controlOrdinal, 1n);
  assert.notDeepEqual([...new Uint8Array(result.controlWitness)], Array(32).fill(0));
  probe.send({ version: 3, id: 9, op: "snapshot-save" });
  result = await probe.next(); assert.equal(result.status, 0);
  assert.equal(new TextDecoder().decode(new Uint8Array(result.snapshot, 0, 8)), "CDRM5WK1");
  const hiddenSnapshot = result.snapshot;
  assert.equal(new DataView(hiddenSnapshot).getUint32(12, true), 3,
    "hidden policy is integrity-bound envelope metadata");
  assert.equal(new DataView(hiddenSnapshot).getUint32(8, true), 3);
  const rejectWorker = new Worker(WORKER, { type: "module" });
  const rejectProbe = new Probe(rejectWorker);
  try {
    rejectProbe.send({ version: 3, id: 1, op: "instantiate", module });
    result = await rejectProbe.next(); assert.equal(result.status, 0);
    const corrupt = new Uint8Array(hiddenSnapshot).slice();
    corrupt[12] ^= 1;
    rejectProbe.send({ version: 3, id: 2, op: "snapshot-restore-import", snapshot: corrupt.buffer });
    result = await rejectProbe.next(); assert.equal(result.status, 2, "integrity-bound policy flag rejects tampering");
    rejectProbe.send({ version: 3, id: 3, op: "snapshot-restore-import",
      snapshot: new Uint8Array(hiddenSnapshot).slice(104).buffer });
    result = await rejectProbe.next(); assert.equal(result.status, 2, "bare M5 snapshot cannot downgrade policy");
    const overflowingOrdinal = new Uint8Array(hiddenSnapshot).slice();
    new DataView(overflowingOrdinal.buffer).setBigUint64(24, 0xffffffffffffffffn, true);
    rehashEnvelope(overflowingOrdinal);
    rejectProbe.send({ version: 3, id: 4, op: "snapshot-restore-import", snapshot: overflowingOrdinal.buffer });
    result = await rejectProbe.next(); assert.equal(result.status, 2, "control ordinal cannot overflow on the next toggle");
    const futureBoundary = new Uint8Array(hiddenSnapshot).slice();
    new DataView(futureBoundary.buffer).setBigUint64(32, 0xffffffffffffffffn, true);
    rehashEnvelope(futureBoundary);
    rejectProbe.send({ version: 3, id: 5, op: "snapshot-restore-import", snapshot: futureBoundary.buffer });
    result = await rejectProbe.next(); assert.equal(result.status, 2, "control boundary cannot lie beyond the inner snapshot");
  } finally { await rejectWorker.terminate(); }
  const wrappedWorker = new Worker(WORKER, { type: "module" });
  const wrappedProbe = new Probe(wrappedWorker);
  try {
    wrappedProbe.send({ version: 3, id: 1, op: "instantiate", module });
    result = await wrappedProbe.next(); assert.equal(result.status, 0);
    wrappedProbe.send({ version: 3, id: 2, op: "snapshot-restore-import",
      snapshot: new Uint8Array(hiddenSnapshot).slice().buffer });
    result = await wrappedProbe.next();
    assert.equal(result.status, 0, `fresh wrapped restore failed: ${JSON.stringify({ status: result.status, lifecycle: result.lifecycle })}`);
    assert.equal(result.hidden, true);
    wrappedProbe.send({ version: 3, id: 3, op: "boundary-digest-v5" });
    result = await wrappedProbe.next(); assert.equal(result.status, 0, "wrapped restore needs no V2 warm-up for V5");
    wrappedProbe.send({ version: 3, id: 4, op: "scheduler-state" });
    result = await wrappedProbe.next(); assert.equal(result.controlOrdinal, 1n);
    assert.equal(result.visibilityInitialized, false, "restored tab requires its own visibility handshake");
    assert.equal(result.snapshotVisibilityInitialized, true, "saved policy metadata is retained");
  } finally { await wrappedWorker.terminate(); }
  probe.send({ version: 3, id: 10, op: "scheduler-visibility", hidden: false });
  result = await probe.next(); assert.equal(result.status, 0);
  probe.send({ version: 3, id: 11, op: "scheduler-transcript-start" });
  result = await probe.next(); assert.equal(result.status, 0);
  probe.send({ version: 3, id: 12, op: "scheduler-transcript-drain" });
  result = await probe.next(); assert.equal(result.status, 0); assert.equal(new Uint8Array(result.transcript).byteLength, 16);
  probe.send({ version: 3, id: 13, op: "scheduler-transcript-finish" });
  result = await probe.next(); assert.equal(result.status, 0);
  probe.send({ version: 3, id: 14, op: "scheduler-stop" });
  result = await probe.next(); assert.equal(result.status, 0); assert.equal(result.lifecycle, "STOPPED");
  assert.equal(result.discardedUnsavedState, false, "logical stop retains worker state until shutdown");
  probe.send({ version: 3, id: 15, op: "scheduler-events", events: [] });
  result = await probe.next(); assert.equal(result.status, 9, "stopped worker is terminal");
  console.log("cadr_m5_worker: ok");
} finally {
  await worker.terminate();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
