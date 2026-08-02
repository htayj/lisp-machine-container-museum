import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { parseCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const variant = process.env.CADR_M12_WASM_VARIANT ?? "O0";
assert.ok(["O0", "O2"].includes(variant), "M12 Wasm variant");
const wasm = await WebAssembly.compile(await readFile(
  resolve(ROOT, `cadr-web/build/cadr-web-m12-${variant}.wasm`)));
const names = new Set(WebAssembly.Module.exports(wasm).map(entry => entry.name));
assert.equal(names.has("cadr_wasm_m13_audio_open"), false,
  "frozen ABI1.10/M12 does not acquire the ABI1.11 audio session export");
for (const name of [
  "cadr_wasm_m12_debug_state", "cadr_wasm_m12_inspect_read", "cadr_wasm_m12_breakpoint_set",
  "cadr_wasm_m12_breakpoint_clear", "cadr_wasm_m12_resume_one_boundary",
  "cadr_wasm_m12_micro_step", "cadr_wasm_m12_macro_step",
  "cadr_wasm_m12_stop_record", "cadr_wasm_m12_trace_filter",
  "cadr_wasm_m12_config_snapshot_save", "cadr_wasm_m12_config_snapshot_restore",
  "cadr_wasm_m11_audio_state", "cadr_wasm_m11_audio_peek",
  "cadr_wasm_m11_audio_render", "cadr_wasm_m11_audio_ack",
  "cadr_wasm_m11_audio_snapshot_size", "cadr_wasm_m11_audio_snapshot_save",
  "cadr_wasm_m11_audio_snapshot_restore",
  "cadr_wasm_m9_input_deliver", "cadr_wasm_m9_input_state",
]) assert.ok(names.has(name), `M12 Wasm exports ${name}`);

const { exports: e } = await WebAssembly.instantiate(wasm, {});
assert.equal(e.cadr_wasm_create(), 0);
const pointer = e.cadr_wasm_output_pointer() >>> 0;
assert.notEqual(pointer, 0);
assert.equal(e.cadr_wasm_m12_debug_state(), 0);
let view = new DataView(e.memory.buffer, pointer, 24);
assert.equal(view.getBigUint64(0, true), 1n);
assert.equal(view.getBigUint64(8, true), 0n);
assert.equal(view.getUint32(16, true), 0);
assert.equal(view.getUint32(20, true), 0);
assert.equal(e.cadr_wasm_m12_inspect_read(1, 0), 0,
  "a paused scalar inspector read never exports a lease or array view");
view = new DataView(e.memory.buffer, pointer, 24);
assert.equal(view.getBigUint64(0, true), 1n);
assert.equal(view.getUint32(8, true), 1);
assert.equal(view.getUint32(12, true), 0);
assert.equal(view.getUint32(16, true), 0);

assert.equal(e.cadr_wasm_m11_audio_state(), 0);
view = new DataView(e.memory.buffer, pointer, 40);
assert.equal(new TextDecoder().decode(new Uint8Array(e.memory.buffer, pointer, 8)), "CDRM11A1");
assert.equal(view.getUint32(8, true), 1);
assert.equal(view.getUint32(12, true), 40);
assert.equal(view.getUint32(32, true), 0);
assert.equal(e.cadr_wasm_m11_audio_peek(), 9, "empty audio queue is not-ready");
assert.notEqual(e.cadr_wasm_meta_pointer(), 0);
assert.equal(e.cadr_wasm_m11_audio_snapshot_size(), 0);
let meta = new DataView(e.memory.buffer, e.cadr_wasm_meta_pointer() >>> 0, 16);
assert.equal(meta.getBigUint64(0, true), 188n);
const audioInput = e.cadr_wasm_input_reserve(4284) >>> 0;
assert.notEqual(audioInput, 0);
assert.equal(e.cadr_wasm_m11_audio_snapshot_save(), 0);
meta = new DataView(e.memory.buffer, e.cadr_wasm_meta_pointer() >>> 0, 16);
assert.equal(meta.getBigUint64(0, true), 188n);
assert.equal(e.cadr_wasm_m11_audio_snapshot_restore(188), 0,
  "CDRAUDS1 rebinds a fresh local consumer session");

/* A before-PC breakpoint must stop before the cold core can advance. */
assert.equal(e.cadr_wasm_m12_breakpoint_set(3, 1, 0, 0), 0);
assert.equal(e.cadr_wasm_m12_micro_step(), 19);
let stop = new Uint8Array(e.memory.buffer, pointer, 136).slice();
let parsed = parseCdrDbgStop1(stop);
assert.equal(parsed.breakpointIndex, 3);
assert.equal(parsed.microPcBefore, 0);
assert.equal(parsed.clockSlot, 0n);
assert.equal(e.cadr_wasm_m12_stop_record(), 0);
stop = new Uint8Array(e.memory.buffer, pointer, 136).slice();
parsed = parseCdrDbgStop1(stop);
assert.equal(parsed.breakpointIndex, 3);

assert.equal(e.cadr_wasm_m12_resume_one_boundary(), 0);
assert.equal(e.cadr_wasm_m12_micro_step(), 9,
  "the debugger must not manufacture a cold-machine slot completion");
assert.equal(e.cadr_wasm_m12_breakpoint_clear(3), 0);
assert.equal(e.cadr_wasm_m12_macro_step(), 2,
  "only public System 303 QMLP/DMLP entry PCs begin a macro step");
assert.equal(e.cadr_wasm_m12_trace_filter(0, 0, 0, 0, 0xffffffff, 0xffffffff), 0);
assert.equal(e.cadr_wasm_m12_trace_filter(16, 0, 0, 0, 0, 0), 2);
const configInput = e.cadr_wasm_input_reserve(1088) >>> 0;
assert.notEqual(configInput, 0);
assert.equal(e.cadr_wasm_m12_config_snapshot_save(), 0);
assert.equal(e.cadr_wasm_m12_config_snapshot_restore(1088), 0);

/* Build an independent composed fixture from the public native CDRSNAP1
   emitter and this module's pointer-free sidecars. */
assert.equal(e.cadr_wasm_m12_breakpoint_set(4, 1, 0, 0), 0);
assert.equal(e.cadr_wasm_m11_audio_snapshot_save(), 0);
meta = new DataView(e.memory.buffer, e.cadr_wasm_meta_pointer() >>> 0, 16);
const audio = new Uint8Array(e.memory.buffer, audioInput,
  Number(meta.getBigUint64(0, true))).slice();
assert.equal(e.cadr_wasm_m12_config_snapshot_save(), 0);
const config = new Uint8Array(e.memory.buffer, configInput, 1088).slice();
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m12-composed-"));
try {
  const corePath = resolve(fixtureDirectory, "core.cdrsnap1");
  const digestPath = resolve(fixtureDirectory, "state5.sha256");
  execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/test_cadr_m2_public"],
    { stdio: "inherit" });
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
    ["--emit-m3-snapshot", corePath]);
  const core = new Uint8Array(await readFile(corePath));
  execFileSync(resolve(ROOT, "cadr-web/build/test_cadr_m2_public"),
    ["--emit-state5-digest", digestPath]);
  const state5Digest = new Uint8Array(await readFile(digestPath));
  const continuation = new Uint8Array(72);
  const continuationView = new DataView(continuation.buffer);
  continuation.set(new TextEncoder().encode("CDRM9D1"), 0);
  continuationView.setUint32(8, 1, true); continuationView.setUint32(12, 72, true);
  continuation.set(state5Digest, 16); continuationView.setBigUint64(48, 1n, true);
  const composed = new Uint8Array(48 + core.byteLength + continuation.byteLength +
    audio.byteLength + config.byteLength);
  const composedView = new DataView(composed.buffer);
  composed.set(new TextEncoder().encode("CDRM12S1"), 0);
  composedView.setUint32(8, 2, true); composedView.setUint32(12, 48, true);
  composedView.setBigUint64(16, BigInt(composed.byteLength), true);
  composedView.setBigUint64(24, BigInt(core.byteLength), true);
  composedView.setUint32(32, audio.byteLength, true);
  composedView.setUint32(36, config.byteLength, true);
  composedView.setUint32(40, continuation.byteLength, true);
  composed.set(core, 48); composed.set(continuation, 48 + core.byteLength);
  composed.set(audio, 48 + core.byteLength + continuation.byteLength);
  composed.set(config, 48 + core.byteLength + continuation.byteLength + audio.byteLength);

  const { exports: target } = await WebAssembly.instantiate(wasm, {});
  assert.equal(target.cadr_wasm_create(), 0);
  const targetOutput = target.cadr_wasm_output_pointer() >>> 0;
  const targetSidecar = target.cadr_wasm_input_reserve(4284) >>> 0;
  assert.notEqual(targetSidecar, 0);
  assert.equal(target.cadr_wasm_m12_breakpoint_set(6, 1, 0, 0), 0);
  const targetInput = target.cadr_wasm_snapshot_input_reserve(composed.byteLength) >>> 0;
  assert.notEqual(targetInput, 0);
  const copyTargetOutput = byteCount => new Uint8Array(
    target.memory.buffer, targetOutput, byteCount).slice();
  const captureLiveTargetState = () => {
    /* These four views cover the public core status, M12 debugger state,
     * M11 queue/cursor status, and both pointer-free sidecars.  A failed
     * CDRM12S1 import must leave all of them byte-identical. */
    assert.equal(target.cadr_wasm_machine_info(), 0);
    const machine = copyTargetOutput(64);
    assert.equal(target.cadr_wasm_m12_debug_state(), 0);
    const debuggerState = copyTargetOutput(24);
    assert.equal(target.cadr_wasm_m11_audio_state(), 0);
    const audioState = copyTargetOutput(40);
    assert.equal(target.cadr_wasm_m11_audio_peek(), 9,
      "this public fixture has no pending audio cursor");
    assert.equal(target.cadr_wasm_m11_audio_snapshot_save(), 0);
    const sidecarMeta = new DataView(target.memory.buffer,
      target.cadr_wasm_meta_pointer() >>> 0, 16);
    const audioBytes = Number(sidecarMeta.getBigUint64(0, true));
    const audio = new Uint8Array(target.memory.buffer, targetSidecar, audioBytes).slice();
    assert.equal(target.cadr_wasm_m12_config_snapshot_save(), 0);
    const config = new Uint8Array(target.memory.buffer, targetSidecar, 1088).slice();
    return { machine, debuggerState, audioState, audio, config };
  };
  const assertLiveTargetState = (before, label) => {
    const after = captureLiveTargetState();
    for (const key of ["machine", "debuggerState", "audioState", "audio", "config"]) {
      assert.deepEqual(after[key], before[key], `${label} preserves ${key}`);
    }
  };
  const preflightState = captureLiveTargetState();
  const assertRollback = (offset, replacement, label) => {
    const original = composed[offset];
    composed[offset] = replacement;
    new Uint8Array(target.memory.buffer, targetInput, composed.byteLength).set(composed);
    assert.notEqual(target.cadr_wasm_snapshot_restore_import(composed.byteLength), 0, label);
    assert.equal(target.cadr_wasm_m12_micro_step(), 19);
    assert.equal(parseCdrDbgStop1(
      new Uint8Array(target.memory.buffer, targetOutput, 136).slice()).breakpointIndex, 6,
    `${label} preserves the live debugger`);
    assertLiveTargetState(preflightState, label);
    composed[offset] = original;
  };
  assertRollback(8, 1, "CDRM12S1 v1 rejection");
  assertRollback(44, 1, "envelope validation failure");
  assertRollback(48, "X".charCodeAt(0), "CDRSNAP1 staging failure");
  assertRollback(48 + core.byteLength, "X".charCodeAt(0), "CDRM9D1 adoption failure");
  assertRollback(48 + core.byteLength + 16, state5Digest[0] ^ 1, "CDRM9D1 digest mismatch");
  assertRollback(48 + core.byteLength + 48, 2, "CDRM9D1 generation mismatch");
  assertRollback(48 + core.byteLength + 56, 1, "CDRM9D1 ordinal/sequence mismatch");
  assertRollback(48 + core.byteLength + 64, 1, "CDRM9D1 sequence/ordinal mismatch");
  assertRollback(48 + core.byteLength + 69, 3, "CDRM9D1 hostile X coordinate");
  assertRollback(48 + core.byteLength + 71, 4, "CDRM9D1 hostile Y coordinate");
  assertRollback(48 + core.byteLength + 71, 0x80, "CDRM9D1 reserved button bit");
  assertRollback(48 + core.byteLength + continuation.byteLength,
    "X".charCodeAt(0), "CDRAUDS1 adoption failure");
  assertRollback(48 + core.byteLength + continuation.byteLength + audio.byteLength + 60, 1,
    "CDRM12C1 preflight failure");

  new Uint8Array(target.memory.buffer, targetInput, composed.byteLength).set(composed);
  assert.equal(target.cadr_wasm_snapshot_restore_import(composed.byteLength), 0);
  assert.equal(target.cadr_wasm_m12_micro_step(), 19);
  assert.equal(parseCdrDbgStop1(
    new Uint8Array(target.memory.buffer, targetOutput, 136).slice()).breakpointIndex, 4,
  "successful publication adopts CDRM12C1 after core and audio staging");
  assert.equal(target.cadr_wasm_snapshot_save(), 0);
  const savedPointer = target.cadr_wasm_snapshot_pointer() >>> 0;
  assert.equal(new TextDecoder().decode(
    new Uint8Array(target.memory.buffer, savedPointer, 8)), "CDRM12S1");
} finally {
  await rm(fixtureDirectory, { recursive: true, force: true });
}

console.log(`cadr M12 ${variant} Wasm export tests passed`);
