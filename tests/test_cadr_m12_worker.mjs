import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { createHash } from "node:crypto";

import { parseCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const WASM = resolve(ROOT, process.env.CADR_M12_WASM_PATH ??
  "cadr-web/build/cadr-web-m12-O0.wasm");

class Probe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter === undefined) this.messages.push(message); else waiter(message);
    });
  }
  request(value) { this.worker.postMessage(value); return this.next(); }
  next() {
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error("timed out waiting for M12 worker")), 30000);
      this.waiters.push(message => { clearTimeout(timer); resolveNext(message); });
    });
  }
}

const module = await WebAssembly.compile(await readFile(WASM));

function wrapV7(raw, { boundary = 0n } = {}) {
  const bytes = new Uint8Array(raw);
  const wrapped = new Uint8Array(bytes.byteLength + 104);
  wrapped.set(new TextEncoder().encode("CDRM5WK1"), 0);
  const view = new DataView(wrapped.buffer);
  view.setUint32(8, 3, true); view.setBigUint64(16, BigInt(bytes.byteLength), true);
  view.setBigUint64(32, boundary, true); wrapped.set(bytes, 104);
  const digestInput = new Uint8Array(72 + bytes.byteLength);
  digestInput.set(wrapped.slice(0, 72)); digestInput.set(bytes, 72);
  wrapped.set(createHash("sha256").update(digestInput).digest(), 72);
  return wrapped;
}

const direct = (await WebAssembly.instantiate(module, {})).exports;
assert.equal(direct.cadr_wasm_create(), 0);
const sidecarPointer = direct.cadr_wasm_input_reserve(4284) >>> 0;
assert.equal(direct.cadr_wasm_m11_audio_snapshot_save(), 0);
let directMeta = new DataView(direct.memory.buffer, direct.cadr_wasm_meta_pointer() >>> 0, 16);
const directAudio = new Uint8Array(direct.memory.buffer, sidecarPointer,
  Number(directMeta.getBigUint64(0, true))).slice();
assert.equal(direct.cadr_wasm_m12_config_snapshot_save(), 0);
const directConfig = new Uint8Array(direct.memory.buffer, sidecarPointer, 1088).slice();
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m12-worker-"));
const corePath = resolve(fixtureDirectory, "core.cdrsnap1");
const digestPath = resolve(fixtureDirectory, "state5.sha256");
execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/test_cadr_m2_public"]);
execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
  ["--emit-m3-snapshot", corePath]);
const directCore = new Uint8Array(await readFile(corePath));
execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
  ["--emit-state5-digest", digestPath]);
const state5Digest = new Uint8Array(await readFile(digestPath));
await rm(fixtureDirectory, { recursive: true, force: true });
const directRaw = new Uint8Array(48 + directCore.byteLength + 72 +
  directAudio.byteLength + directConfig.byteLength);
const directView = new DataView(directRaw.buffer);
directRaw.set(new TextEncoder().encode("CDRM12S1"));
directView.setUint32(8, 2, true); directView.setUint32(12, 48, true);
directView.setBigUint64(16, BigInt(directRaw.byteLength), true);
directView.setBigUint64(24, BigInt(directCore.byteLength), true);
directView.setUint32(32, directAudio.byteLength, true);
directView.setUint32(36, directConfig.byteLength, true); directView.setUint32(40, 72, true);
directRaw.set(directCore, 48);
const continuationOffset = 48 + directCore.byteLength;
directRaw.set(new TextEncoder().encode("CDRM9D1"), continuationOffset);
directView.setUint32(continuationOffset + 8, 1, true);
directView.setUint32(continuationOffset + 12, 72, true);
directRaw.set(state5Digest, continuationOffset + 16);
directView.setBigUint64(continuationOffset + 48, 1n, true);
directRaw.set(directAudio, continuationOffset + 72);
directRaw.set(directConfig, continuationOffset + 72 + directAudio.byteLength);
const nativeTarget = (await WebAssembly.instantiate(module, {})).exports;
assert.equal(nativeTarget.cadr_wasm_create(), 0);
const nativeInput = nativeTarget.cadr_wasm_snapshot_input_reserve(directRaw.byteLength) >>> 0;
new Uint8Array(nativeTarget.memory.buffer, nativeInput, directRaw.byteLength).set(directRaw);
assert.equal(nativeTarget.cadr_wasm_snapshot_restore_import(directRaw.byteLength), 0,
  "public CDRM12S1-v2 bootstrap is native-valid");
assert.equal(new DataView(directRaw.buffer).getUint32(8, true), 2);
const bootstrap = wrapV7(directRaw);

/* A real v7 native-save -> worker-save -> fresh-worker-import path.  Mutated
 * v1 and boundary records have valid outer hashes, so rejection proves the
 * exact nested validator rather than merely the digest check. */
let savedV7;
for (let pass = 0; pass < 2; pass += 1) {
  const roundWorker = new Worker(WORKER, { type: "module" });
  const roundProbe = new Probe(roundWorker);
  try {
    let result = await roundProbe.request({ version: 7, id: 1, op: "instantiate", module });
    assert.equal(result.status, 0);
    result = await roundProbe.request({ version: 7, id: 2, op: "snapshot-restore-import",
      snapshot: (pass === 0 ? bootstrap : savedV7).buffer });
    assert.equal(result.status, 0, `v7 fresh-worker import pass ${pass}`);
    result = await roundProbe.request({ version: 7, id: 3, op: "pointer-state" });
    assert.equal(result.result.generation, 0, "fresh-worker import has host epoch zero");
    result = await roundProbe.request({ version: 7, id: 4, op: "scheduler-visibility", hidden: false });
    assert.equal(result.status, 0);
    result = await roundProbe.request({ version: 7, id: 5, op: "snapshot-save" });
    assert.equal(result.status, 0); savedV7 = new Uint8Array(result.snapshot).slice();
  } finally { await roundWorker.terminate(); }
}
for (const mutation of ["v1", "boundary", "ordinal", "raw"]) {
  const rejectWorker = new Worker(WORKER, { type: "module" });
  const rejectProbe = new Probe(rejectWorker);
  try {
    let result = await rejectProbe.request({ version: 7, id: 1, op: "instantiate", module });
    assert.equal(result.status, 0);
    let candidate;
    if (mutation === "raw") candidate = directRaw.slice();
    else {
      const altered = directRaw.slice();
      if (mutation === "v1") new DataView(altered.buffer).setUint32(8, 1, true);
      if (mutation === "ordinal") new DataView(altered.buffer).setBigUint64(
        48 + directCore.byteLength + 56, 1n, true);
      candidate = wrapV7(altered, { boundary: mutation === "boundary" ? 1n : 0n });
    }
    result = await rejectProbe.request({ version: 7, id: 2, op: "snapshot-restore-import",
      snapshot: candidate.buffer, allowLegacyNativeImport: true });
    assert.equal(result.status, 2, `v7 rejects ${mutation} without mutation`);
  } finally { await rejectWorker.terminate(); }
}

const terminalRaw = directRaw.slice();
const terminalView = new DataView(terminalRaw.buffer);
terminalView.setBigUint64(48 + directCore.byteLength + 56, 0xffffffffffffffffn, true);
terminalView.setUint32(48 + directCore.byteLength + 64, 0xffffffff, true);
const terminalWorker = new Worker(WORKER, { type: "module" });
const terminalProbe = new Probe(terminalWorker);
try {
  let result = await terminalProbe.request({ version: 7, id: 1, op: "instantiate", module });
  assert.equal(result.status, 0);
  result = await terminalProbe.request({ version: 7, id: 2, op: "snapshot-restore-import",
    snapshot: wrapV7(terminalRaw).buffer });
  assert.equal(result.status, 0);
  const before = await terminalProbe.request({ version: 7, id: 3, op: "keyboard-state" });
  result = await terminalProbe.request({ version: 7, id: 4, op: "keyboard-down",
    code: "KeyQ", repeat: false });
  assert.equal(result.status, 9); assert.equal(result.reason, "input-ingress-ordinal-exhausted");
  const after = await terminalProbe.request({ version: 7, id: 5, op: "keyboard-state" });
  assert.deepEqual(after.result, before.result, "terminal ordinal rejects before controller mutation");
} finally { await terminalWorker.terminate(); }

const wrapRaw = directRaw.slice();
const wrapView = new DataView(wrapRaw.buffer);
wrapView.setBigUint64(48 + directCore.byteLength + 56, 0xfffffffcn, true);
wrapView.setUint32(48 + directCore.byteLength + 64, 0xfffffffc, true);
const wrapWorker = new Worker(WORKER, { type: "module" });
const wrapProbe = new Probe(wrapWorker);
try {
  let result = await wrapProbe.request({ version: 7, id: 1, op: "instantiate", module });
  assert.equal(result.status, 0);
  result = await wrapProbe.request({ version: 7, id: 2, op: "snapshot-restore-import",
    snapshot: wrapV7(wrapRaw).buffer });
  assert.equal(result.status, 0);
  result = await wrapProbe.request({ version: 7, id: 3, op: "pointer-down",
    domButton: 0, x: 1, y: 2, tick: 1n, generation: 0, ingressOrdinal: 1n });
  assert.equal(result.status, 0);
  result = await wrapProbe.request({ version: 7, id: 4, op: "pointer-down",
    domButton: 1, x: 1, y: 2, tick: 2n, generation: 0, ingressOrdinal: 2n });
  assert.equal(result.status, 0);
  result = await wrapProbe.request({ version: 7, id: 5, op: "pointer-neutralize",
    cause: "capture-loss", tick: 3n, generation: 0 });
  assert.equal(result.status, 0); assert.equal(result.delivery.recordsDelivered, 3);
  assert.equal(result.delivery.inputSequence, 1);
  assert.deepEqual(result.delivery.coreObservations.map(buffer =>
    new DataView(buffer).getUint32(32, true)), [0xffffffff, 0, 1]);
} finally { await wrapWorker.terminate(); }

const epochWorker = new Worker(WORKER, { type: "module" });
const epochProbe = new Probe(epochWorker);
try {
  let result = await epochProbe.request({ version: 7, id: 1, op: "instantiate", module });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 2, op: "snapshot-restore-import",
    snapshot: bootstrap.buffer });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 3, op: "scheduler-visibility", hidden: false });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 4, op: "pointer-neutralize",
    cause: "capture-loss", tick: 1n, generation: 0 });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 5, op: "pointer-motion",
    x: 25, y: 30, cause: "physical", tick: 2n, generation: 1, ingressOrdinal: 2n });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 6, op: "snapshot-save" });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 7, op: "keyboard-down",
    code: "KeyQ", repeat: false });
  assert.equal(result.status, 0);
  const held = await epochProbe.request({ version: 7, id: 8, op: "keyboard-state" });
  result = await epochProbe.request({ version: 7, id: 9, op: "snapshot-restore" });
  assert.equal(result.status, 9);
  assert.deepEqual((await epochProbe.request({ version: 7, id: 10, op: "keyboard-state" })).result,
    held.result, "failed held-key restore preserves the controller");
  result = await epochProbe.request({ version: 7, id: 11, op: "keyboard-up", code: "KeyQ" });
  assert.equal(result.status, 0);
  result = await epochProbe.request({ version: 7, id: 12, op: "pointer-warp-request",
    cursorState: 3, x: 40, y: 50, generation: 1 });
  assert.equal(result.status, 0);
  const warped = await epochProbe.request({ version: 7, id: 13, op: "pointer-state" });
  result = await epochProbe.request({ version: 7, id: 14, op: "snapshot-restore" });
  assert.equal(result.status, 9);
  assert.deepEqual((await epochProbe.request({ version: 7, id: 15, op: "pointer-state" })).result,
    warped.result, "failed warp restore preserves the controller");
} finally { await epochWorker.terminate(); }

/* The selected progress operation is an M12/v7-only extension.  It is not a
 * backdoor into the v4--v6 scheduler trees, even though this composed module
 * exports the lower profile facilities needed to instantiate those profiles. */
for (const version of [4, 5, 6]) {
  const olderWorker = new Worker(WORKER, { type: "module" });
  const olderProbe = new Probe(olderWorker);
  try {
    let reply = await olderProbe.request({ version, id: 1, op: "instantiate", module });
    assert.equal(reply.status, 0, `v${version} selected module instantiates for rejection test`);
    reply = await olderProbe.request({ version, id: 2, op: "scheduler-run-v7-slice", clockSlots: 1 });
    assert.equal(reply.status, 2, `v${version} cannot acquire the v7 scheduler slice`);
  } finally {
    await olderWorker.terminate();
  }
}

const worker = new Worker(WORKER, { type: "module" });
const probe = new Probe(worker);
try {
  let reply = await probe.request({ version: 7, id: 1, op: "instantiate", module });
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "NEW");

  /* v7 composes the existing CDRINP1 branch.  The cold core refuses delivery
     before either browser controller mutates; that rejection is distinct from
     a v6-only operation rejection. */
  reply = await probe.request({ version: 7, id: 2, op: "input-state" });
  assert.equal(reply.status, 0);
  assert.equal(new TextDecoder().decode(new Uint8Array(reply.observation).subarray(0, 8)), "CDRIOB91");
  reply = await probe.request({ version: 7, id: 3, op: "keyboard-down", code: "KeyQ", repeat: false });
  assert.equal(reply.status, 9); assert.equal(reply.reason, "core-not-running");
  reply = await probe.request({ version: 7, id: 4, op: "keyboard-state" });
  assert.deepEqual(reply.result.heldCodes, []);
  reply = await probe.request({ version: 7, id: 5, op: "snapshot-size" });
  assert.equal(reply.status, 2, "v7 reaches native snapshot validation for the cold fixture");

  reply = await probe.request({ version: 7, id: 6, op: "audio-state" });
  assert.equal(reply.status, 0); assert.equal(reply.state.packetCount, 0);
  reply = await probe.request({ version: 7, id: 7, op: "audio-snapshot-size" });
  assert.equal(reply.status, 0); assert.equal(reply.byteCount, 188n);
  reply = await probe.request({ version: 7, id: 8, op: "audio-snapshot-save" });
  assert.equal(reply.status, 0); assert.equal(new Uint8Array(reply.snapshot).byteLength, 188);
  reply = await probe.request({ version: 7, id: 9, op: "audio-snapshot-restore",
    snapshot: reply.snapshot });
  assert.equal(reply.status, 0);

  reply = await probe.request({ version: 7, id: 10, op: "debug-breakpoint-set", slot: 3,
    breakpoint: { kind: 1, value: 0n } });
  assert.equal(reply.status, 0); assert.equal(reply.result.slot, 3);
  reply = await probe.request({ version: 7, id: 11, op: "debug-config-snapshot-save" });
  assert.equal(reply.status, 0);
  assert.equal(new Uint8Array(reply.result.snapshot).byteLength, 1088);
  const configSnapshot = reply.result.snapshot;
  reply = await probe.request({ version: 7, id: 12, op: "debug-breakpoint-clear", slot: 3 });
  assert.equal(reply.status, 0);
  reply = await probe.request({ version: 7, id: 13, op: "debug-config-snapshot-restore",
    snapshot: configSnapshot });
  assert.equal(reply.status, 0);

  reply = await probe.request({ version: 7, id: 14, op: "debug-micro-step" });
  assert.equal(reply.status, 19); assert.equal(reply.terminal, true);
  const stopped = parseCdrDbgStop1(reply.result.stop);
  assert.equal(stopped.breakpointIndex, 3);
  assert.equal(stopped.microPcBefore, 0);

  reply = await probe.request({ version: 7, id: 15, op: "debug-stop-record" });
  assert.equal(reply.status, 0);
  assert.equal(parseCdrDbgStop1(reply.result.stop).breakpointIndex, 3);

  reply = await probe.request({ version: 7, id: 16, op: "debug-resume-one-boundary" });
  assert.equal(reply.status, 0); assert.equal(reply.result.suppressionArmed, true);
  reply = await probe.request({ version: 7, id: 17, op: "debug-micro-step" });
  assert.equal(reply.status, 9, "cold core reports not-ready without partial debugger state");
  reply = await probe.request({ version: 7, id: 18, op: "debug-trace-filter", filter: {
    flags: 0, microPc: 0, firstClockSlot: 0n, lastClockSlot: 0xffffffffffffffffn,
  } });
  assert.equal(reply.status, 0);
  reply = await probe.request({ version: 7, id: 19, op: "debug-macro-step" });
  assert.equal(reply.status, 2, "the macro oracle rejects non-QMLP/DMLP start PCs");
  reply = await probe.request({ version: 7, id: 20, op: "debug-inspect-read", arrayKind: 1, index: 0 });
  assert.equal(reply.status, 0);
  assert.deepEqual(reply.result, { generation: 1n, arrayKind: 1, index: 0, value: 0 });

  /* `scheduler-run` retains its M5-family control-yield semantics.  The new
   * v7 operation is a separate exact-field, 4,096-outer-slot contract: these
   * malformed values reject before lifecycle admission, while the maximum
   * shaped request reaches the normal RUNNING/visibility fence. */
  for (const [id, fields] of [
    [21, {}],
    [22, { clockSlots: 1, unexpected: true }],
    [23, { clockSlots: 0 }],
    [24, { clockSlots: 4097 }],
  ]) {
    reply = await probe.request({ version: 7, id, op: "scheduler-run-v7-slice", ...fields });
    assert.equal(reply.status, 2, "v7 slice rejects malformed fields or an over-cap budget");
  }
  reply = await probe.request({ version: 7, id: 25, op: "scheduler-run-v7-slice", clockSlots: 4096 });
  assert.equal(reply.status, 9, "well-formed v7 slice reaches the normal lifecycle fence");
} finally {
  await worker.terminate();
}

console.log("cadr M12 worker integration tests passed");
