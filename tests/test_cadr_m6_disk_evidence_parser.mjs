import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "cadr-web/wasm/cadr-worker.js"), "utf8");
function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1); assert.notEqual(end, -1);
  return source.slice(start, end);
}
const h0 = section("const CADR_M6_DEVID_TAIL_H0", "const CADR_M4_ONLY_OPERATIONS");
const zeroWitness = section("function zeroWitness", "async function noteVisibilityControl");
const sameBytes = section("function sameBytes", "/* The worker needs a digest");
const parser = section("function parseCdrM6DiskEvidenceSummary", "function m6DevidFailureSummary");
const context = { Uint8Array, DataView, TextDecoder, Object, Number, BigInt };
vm.createContext(context);
vm.runInContext(`${h0}\n${zeroWitness}\n${sameBytes}\n${parser}\nthis.parse = parseCdrM6DiskEvidenceSummary;`, context);

function validSummary() {
  const bytes = new Uint8Array(512);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6E1"), 0);
  view.setUint32(8, 1, true);
  view.setUint32(12, 512, true);
  view.setUint32(16, 1, true);
  view.setUint32(24, 512, true);
  view.setBigUint64(32, 0x7fffffffffffffffn, true);
  bytes.fill(1, 240, 272);
  bytes.set(new Uint8Array([
    0x9b,0x02,0x08,0xc0,0x42,0xfe,0xba,0x70,
    0xdf,0x85,0x04,0xc3,0xf2,0x52,0xf0,0x65,
    0xff,0x0d,0xee,0x56,0xd5,0x07,0x85,0xc4,
    0x0e,0x94,0x39,0xce,0xfe,0x04,0x79,0x82,
  ]), 272);
  return bytes;
}

const summary = validSummary();
assert.notEqual(context.parse(summary), null);
const badMaximum = summary.slice();
new DataView(badMaximum.buffer).setBigUint64(32, 512n, true);
assert.equal(context.parse(badMaximum), null);
const badH0 = summary.slice(); badH0[272] ^= 1;
assert.equal(context.parse(badH0), null);
const badEmptyTuple = summary.slice(); badEmptyTuple[160] = 1;
assert.equal(context.parse(badEmptyTuple), null);
console.log("cadr_m6_disk_evidence_parser: ok");
