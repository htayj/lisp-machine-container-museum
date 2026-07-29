/* The standalone Wasm runner must use the same CDRM3TR1 framing as native. */
import assert from "node:assert/strict";
import { cadrM3TranscriptHeader } from "../scripts/cadr-m3-wasm-runner.mjs";

const header = cadrM3TranscriptHeader(17);
assert.equal(header.byteLength, 32);
assert.equal(header.subarray(0, 8).toString("ascii"), "CDRM3TR1");
assert.equal(header.readUInt32LE(8), 96, "one CDRSTATE1/2/3 record is 96 bytes");
assert.equal(header.readBigUInt64LE(12), 18n);
assert.equal(header.readBigUInt64LE(20), 17n);
console.log("cadr_m3_wasm_runner_framing: ok");
