import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { CadrM8KeyboardProtocolSubhandler } from
  "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import { CadrM9PointerController, CadrM9PointerProtocolSubhandler } from
  "../cadr-web/wasm/cadr-m9-pointer.mjs";
import { replaceCadrM9InputHostState } from
  "../cadr-web/wasm/cadr-m8-m9-restore.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const variant = process.env.CADR_M12_SYNTHETIC_VARIANT ?? "O0";
const module = await WebAssembly.compile(await readFile(resolve(root,
  `cadr-web/build/cadr-web-m12-synthetic-test-${variant}.wasm`)));
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m12-audio-generation-"));
const hostileAudioPath = resolve(fixtureDirectory, "generation-two.cdrauds1");
execFileSync(resolve(root, "cadr-web/build/test_cadr_m12_composed_m8_m11"),
  ["--emit-generation-two-audio", hostileAudioPath]);
const hostileAudio = new Uint8Array(await readFile(hostileAudioPath));
await rm(fixtureDirectory, { recursive: true, force: true });

/* Directly prove the production replacement helper allocates new protocol and
 * controller identities while carrying only the browser capture epoch. */
const oldKeyboard = new CadrM8KeyboardProtocolSubhandler();
const oldPointerController = new CadrM9PointerController();
assert.equal(oldPointerController.neutralizeAndAdvanceGeneration({
  cause: "capture-loss", tick: 1n, generation: 0 }).accepted, true);
oldPointerController.drain();
assert.equal(oldPointerController.motion({
  x: 25, y: 30, tick: 2n, generation: 1, ingressOrdinal: 2n }).accepted, true);
oldPointerController.drain();
const oldPointer = new CadrM9PointerProtocolSubhandler({ controller: oldPointerController });
const replaced = replaceCadrM9InputHostState(oldKeyboard, oldPointer);
assert.notStrictEqual(replaced.keyboardProtocol, oldKeyboard);
assert.notStrictEqual(replaced.keyboardProtocol.controller, oldKeyboard.controller);
assert.notStrictEqual(replaced.pointerProtocol, oldPointer);
assert.notStrictEqual(replaced.pointerProtocol.controller, oldPointer.controller);
assert.equal(replaced.pointerProtocol.controller.snapshot().generation, 1);
assert.deepEqual(replaced.pointerProtocol.controller.snapshot().cursor, { x: 0, y: 0 });
assert.equal(replaced.pointerProtocol.controller.snapshot().nextIngressOrdinal, 1n);
assert.equal(replaced.pointerProtocol.controller.snapshot().coalescingBarrierToken, 0n);
assert.equal(replaced.pointerProtocol.controller.snapshot().lastCoalescingBarrier, null);
const worker = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
let id = 1;
function request(op, fields = {}) {
  return new Promise((resolveReply, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${op}`)), 30000);
    worker.once("message", reply => { clearTimeout(timer); resolveReply(reply); });
    worker.postMessage({ version: 7, id: id++, op, ...fields });
  });
}
function hostileAudioGenerationSnapshot(saved) {
    assert.equal(new DataView(hostileAudio.buffer, hostileAudio.byteOffset,
      hostileAudio.byteLength).getBigUint64(16, true), 2n,
    "hostile sidecar is independently valid generation two");
    const hostile = new Uint8Array(saved).slice();
    const view = new DataView(hostile.buffer);
    const raw = 104; const coreBytes = Number(view.getBigUint64(raw + 24, true));
    const audioBytes = view.getUint32(raw + 32, true);
    const audioOffset = raw + 48 + coreBytes + view.getUint32(raw + 40, true);
    assert.equal(hostileAudio.byteLength, audioBytes);
    assert.equal(view.getBigUint64(audioOffset + 16, true), 1n);
    hostile.set(hostileAudio, audioOffset);
    const digestInput = new Uint8Array(72 + hostile.byteLength - raw);
    digestInput.set(hostile.subarray(0, 72)); digestInput.set(hostile.subarray(raw), 72);
    hostile.set(createHash("sha256").update(digestInput).digest(), 72);
    return hostile;
}
try {
  assert.equal((await request("instantiate", { module })).status, 0);
  assert.equal((await request("scheduler-visibility", { hidden: false })).status, 0);
  assert.equal((await request("pointer-neutralize", {
    cause: "capture-loss", tick: 1n, generation: 0 })).status, 0);
  assert.equal((await request("pointer-motion", {
    x: 25, y: 30, tick: 2n, generation: 1, ingressOrdinal: 2n })).status, 0);
  const beforeSave = (await request("pointer-state")).result;
  assert.equal(beforeSave.generation, 1);
  assert.deepEqual(beforeSave.cursor, { x: 25, y: 30 });
  assert.equal(beforeSave.nextIngressOrdinal, 3n);
  assert.equal(beforeSave.queue.length, 0); assert.equal(beforeSave.buttons, 0);
  assert.ok(beforeSave.coalescingBarrierToken > 0n);
  assert.notEqual(beforeSave.lastCoalescingBarrier, null);
  const saved = await request("snapshot-save");
  assert.equal(saved.status, 0);
  const hostile = hostileAudioGenerationSnapshot(saved.snapshot);
  const beforeMachine = new Uint8Array(saved.snapshot).slice();
  const beforeAudio = new Uint8Array((await request("audio-snapshot-save")).snapshot);
  const beforeDebugger = new Uint8Array(
    (await request("debug-config-snapshot-save")).result.snapshot);
  const beforePointer = (await request("pointer-state")).result;
  const beforeKeyboard = (await request("keyboard-state")).result;
  assert.equal((await request("snapshot-restore-import", {
    snapshot: hostile.buffer })).status, 2,
  "semantically valid audio generation mismatch rejects before publication");
  assert.deepEqual(new Uint8Array((await request("audio-snapshot-save")).snapshot), beforeAudio);
  assert.deepEqual(new Uint8Array(
    (await request("debug-config-snapshot-save")).result.snapshot), beforeDebugger);
  assert.deepEqual((await request("pointer-state")).result, beforePointer);
  assert.deepEqual((await request("keyboard-state")).result, beforeKeyboard);
  const afterRejected = await request("snapshot-save");
  assert.equal(afterRejected.status, 0);
  assert.deepEqual(new Uint8Array(afterRejected.snapshot), beforeMachine);
  assert.equal((await request("pointer-motion", {
    x: 40, y: 50, tick: 3n, generation: 1, ingressOrdinal: 3n })).status, 0);
  assert.equal((await request("snapshot-restore")).status, 0);
  const pointer = (await request("pointer-state")).result;
  assert.equal(pointer.generation, 1); assert.deepEqual(pointer.cursor, { x: 0, y: 0 });
  assert.equal(pointer.nextIngressOrdinal, 1n); assert.equal(pointer.buttons, 0);
  assert.deepEqual(pointer.queue, []); assert.deepEqual(pointer.heldButtonNames, []);
  assert.equal(pointer.warp, null); assert.equal(pointer.stalled, false);
  assert.equal(pointer.coalescingBarrierToken, 0n); assert.equal(pointer.lastCoalescingBarrier, null);
  const keyboard = (await request("keyboard-state")).result;
  assert.deepEqual(keyboard.queue, []); assert.deepEqual(keyboard.heldCodes, []);
} finally { await worker.terminate(); }
console.log(`cadr M12 synthetic ${variant} same-process restore passed`);
