import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  CADR_M8_M9_NATIVE_SCRIPT_SCHEMA,
  buildCadrM8M9Campaign,
  encodeCdrInp1,
  serializeCadrM8M9NativeScript,
} from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";

const campaign = buildCadrM8M9Campaign({ generation: 9n, nativeStartBoundary: 1000n });
assert.equal(campaign.keyCount, 100);
assert.equal(campaign.nativeRows.length, 207);
assert.equal(campaign.records.length, 208);
assert.equal(campaign.nativeRows.filter(row => row.type === "keyboard").length, 200);
assert.deepEqual(campaign.nativeRows.slice(0, 2).map(row => [row.boundary, row.type, row.second, row.third]),
  [[1000n, "keyboard", 1, 0], [1001n, "keyboard", 0, 0]]);
assert.deepEqual(campaign.nativeRows.slice(-7).map(row => row.third), [0, 1, 1, 2, 2, 3, 3]);
assert.equal(campaign.records.at(-1).kind, 1, "capture loss emits the M8 all-up record");
assert.equal(campaign.records.at(-1).payload, 0x8000);
for (const [index, record] of campaign.records.entries()) {
  assert.equal(record.bytes.byteLength, 40);
  const view = new DataView(record.bytes.buffer, record.bytes.byteOffset, record.bytes.byteLength);
  assert.equal(new TextDecoder().decode(record.bytes.subarray(0, 7)), "CDRINP1");
  assert.equal(view.getUint16(8, true), 1); assert.equal(view.getUint16(10, true), record.kind);
  assert.equal(view.getBigUint64(16, true), 9n); assert.equal(view.getBigUint64(24, true), BigInt(index + 1));
  assert.equal(view.getUint32(32, true), record.payload);
}
assert.throws(() => encodeCdrInp1({ kind: 3, generation: 0n, ordinal: 1n, payload: 0 }), /kind/);
const script = serializeCadrM8M9NativeScript(campaign);
assert.ok(script.startsWith(`${CADR_M8_M9_NATIVE_SCRIPT_SCHEMA}\n`));
assert.equal(script.trimEnd().split("\n").length, 208);
assert.match(createHash("sha256").update(script).digest("hex"), /^[0-9a-f]{64}$/);
console.log("cadr M8/M9 campaign materialization tests passed");
