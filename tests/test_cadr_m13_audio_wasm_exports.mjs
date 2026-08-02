import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCdrM11Open1 } from "../cadr-web/browser/cadr-m13-audio-record.mjs";

const variant = process.env.CADR_M13_AUDIO_WASM_VARIANT ?? "O0";
const wasm = await WebAssembly.compile(await readFile(
  new URL(`../cadr-web/build/cadr-web-m13-audio-${variant}.wasm`, import.meta.url)));
const names = new Set(WebAssembly.Module.exports(wasm).map(value => value.name));
assert.equal(names.has("cadr_wasm_m13_audio_open"), true);
const { exports: e } = await WebAssembly.instantiate(wasm, {}); assert.equal(e.cadr_wasm_create(), 0);
const pointer = e.cadr_wasm_output_pointer() >>> 0;
assert.equal(e.cadr_wasm_m13_audio_open(), 0);
const first = parseCdrM11Open1(new Uint8Array(e.memory.buffer, pointer, 48).slice());
assert.equal(first.consumerEpoch, 2n); assert.equal(first.rendererProfile, 2);
assert.equal(e.cadr_wasm_m13_audio_open(), 0);
const second = parseCdrM11Open1(new Uint8Array(e.memory.buffer, pointer, 48).slice());
assert.equal(second.consumerEpoch, 3n); assert.equal(second.generation, first.generation);
console.log(`cadr M13 ABI1.11 ${variant} core-issued audio epoch test passed`);
