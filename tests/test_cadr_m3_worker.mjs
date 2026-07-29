/* Node worker_threads exercise of the same M3 dedicated-worker module. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM = resolve(ROOT, "cadr-web/build/cadr-web-m3-O0.wasm");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m3-wasm-snapshot-"));
const fixturePath = resolve(fixtureDirectory, "m3.cdrsnap1");

class Probe {
  constructor(worker) {
    this.worker = worker;
    this.messages = [];
    this.pending = [];
    worker.on("message", (value) => {
      const waiter = this.pending.shift();
      if (waiter) waiter(value); else this.messages.push(value);
    });
  }
  send(value, transfer = []) { this.worker.postMessage(value, transfer); }
  next() {
    if (this.messages.length) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext) => this.pending.push(resolveNext));
  }
}

const module = await WebAssembly.compile(await readFile(WASM));
const worker = new Worker(WORKER, { type: "module" });
const probe = new Probe(worker);
try {
  /* A malformed envelope does not consume id 1. */
  probe.send({ version: 1, id: 1, op: 7 });
  let result = await probe.next();
  assert.equal(result.type, "cadr-error");
  assert.equal(result.code, "malformed-message");
  probe.send({ version: 2, id: 1, op: "instantiate", module });
  result = await probe.next();
  assert.equal(result.code, "malformed-message");
  /* Out of order does not consume the expected request. */
  probe.send({ version: 1, id: 2, op: "instantiate", module });
  result = await probe.next();
  assert.equal(result.code, "non-monotonic-id");
  probe.send({ version: 1, id: 1, op: "instantiate", module });
  result = await probe.next();
  assert.equal(result.status, 0);
  /* One module has one machine: a second instantiate is a rejected operation. */
  probe.send({ version: 1, id: 2, op: "instantiate", module });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 3, op: "portability-probe" });
  result = await probe.next();
  assert.equal(result.status, 0);
  assert.equal(new Uint8Array(result.bytes).byteLength, 32);
  /* M3 64-bit ingress fields are BigInt, never lossy Number values. */
  probe.send({ version: 1, id: 4, op: "stream-begin", artifactKind: 3, byteCount: 9007199254740992 });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 5, op: "stream-begin", artifactKind: 3, byteCount: -1n });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 6, op: "stream-begin", artifactKind: 3, byteCount: 18446744073709551616n });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 7, op: "stream-chunk", offset: 0n, bytes: new ArrayBuffer(0) });
  result = await probe.next();
  assert.equal(result.status, 9);
  probe.send({ version: 1, id: 8, op: "boundary-digests" });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 9, op: "boundary-digests-v3" });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 10, op: "host-complete", operation: 1,
    hostStatus: 0, generation: 1n, requestId: 1n, bytes: new ArrayBuffer(0) });
  result = await probe.next();
  assert.equal(result.status, 5);
  probe.send({ version: 1, id: 11, op: "host-next-request" });
  result = await probe.next();
  assert.equal(result.status, 9);
  probe.send({ version: 1, id: 12, op: "run-digest-batch", clockSlots: 4097 });
  result = await probe.next();
  assert.equal(result.status, 2);
  /* A terminal/non-ready core causes zero complete boundary records, never a padded batch. */
  probe.send({ version: 1, id: 13, op: "run-digest-batch", clockSlots: 4 });
  result = await probe.next();
  assert.equal(result.status, 0);
  assert.equal(result.boundaryCount, 0);
  assert.equal(result.terminalStatus, 9);
  assert.equal(new Uint8Array(result.digests).byteLength, 0);
  probe.send({ version: 1, id: 14, op: "stream-begin", artifactKind: 3, byteCount: 269562880n });
  result = await probe.next();
  assert.equal(result.status, 0);
  probe.send({ version: 1, id: 15, op: "stream-chunk", offset: 0n, bytes: new ArrayBuffer(0) });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 16, op: "stream-begin", artifactKind: 3, byteCount: 269562880n });
  result = await probe.next();
  assert.equal(result.status, 0);
  probe.send({ version: 1, id: 17, op: "stream-chunk", offset: 0n,
    bytes: new ArrayBuffer(1048577) });
  result = await probe.next();
  assert.equal(result.status, 2);
  probe.send({ version: 1, id: 18, op: "stream-begin", artifactKind: 3,
    byteCount: 269562880n });
  result = await probe.next();
  assert.equal(result.status, 0);
  /* Clear the deliberately incomplete ingress before snapshotting ABI1.2 state. */
  probe.send({ version: 1, id: 19, op: "stream-abort" });
  result = await probe.next();
  assert.equal(result.status, 0);
  probe.send({ version: 1, id: 20, op: "disk-observation" });
  result = await probe.next();
  assert.equal(result.status, 0);
  execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/test_cadr_m2_public"], { stdio: "inherit" });
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"), ["--emit-m3-snapshot", fixturePath]);
  const fixture = await readFile(fixturePath);
  probe.send({ version: 1, id: 21, op: "snapshot-restore-import", snapshot: fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength) });
  result = await probe.next();
  assert.equal(result.status, 0);
  probe.send({ version: 1, id: 22, op: "snapshot-save" });
  result = await probe.next();
  assert.equal(result.status, 0);
  const header = new DataView(result.snapshot);
  assert.equal(new TextDecoder().decode(new Uint8Array(result.snapshot, 0, 8)), "CDRSNAP1");
  assert.equal(header.getUint16(10, true), 1, "ABI1.2 selects CDRSNAP1 minor 1");
  assert.equal(header.getUint32(20, true), 9, "ABI1.2 snapshot has required disk chunk");
  probe.send({ version: 1, id: 23, op: "disk-observation" });
  result = await probe.next();
  assert.equal(result.status, 0);
  assert.deepEqual([result.diskStatus, result.interruptPending], [5n, 0n],
    "ABI1.2 snapshot restore retains the fixture's nondefault D0 disk state");
  console.log("cadr_m3_worker: ok");
} finally {
  await worker.terminate();
  await rm(fixtureDirectory, { recursive: true, force: true });
}

/* Requests 1 and 2 are intentionally posted without awaiting 1.  The worker
 * must serialize asynchronous instantiation before the later use operation. */
const racingWorker = new Worker(WORKER, { type: "module" });
const racingProbe = new Probe(racingWorker);
try {
  racingProbe.send({ version: 1, id: 1, op: "instantiate", module });
  racingProbe.send({ version: 1, id: 2, op: "portability-probe" });
  const instantiated = await racingProbe.next();
  const used = await racingProbe.next();
  assert.equal(instantiated.status, 0);
  assert.equal(used.status, 0);
  assert.equal(new Uint8Array(used.bytes).byteLength, 32);
} finally {
  await racingWorker.terminate();
}
