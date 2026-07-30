import assert from "node:assert/strict";

import { createSyntheticCdrDisp1 } from
  "../cadr-web/browser/m7-synthetic-record.mjs";
import { parseCdrDisp1 } from
  "../cadr-web/wasm/cadr-display-renderer.mjs";

const MAX_U64 = 0xffffffffffffffffn;

for (const field of ["machineGeneration", "framebufferGeneration"]) {
  assert.throws(() => createSyntheticCdrDisp1({ [field]: 0n }),
    /positive u64 bigint/,
    `${field} rejects zero`);
  assert.throws(() => createSyntheticCdrDisp1({ [field]: MAX_U64 + 1n }),
    /positive u64 bigint/,
    `${field} rejects values which DataView would wrap`);
}

const maximum = parseCdrDisp1(createSyntheticCdrDisp1({
  machineGeneration: MAX_U64,
  framebufferGeneration: MAX_U64,
}));
assert.equal(maximum.machineGeneration, MAX_U64);
assert.equal(maximum.framebufferGeneration, MAX_U64);

console.log("cadr_m7_browser_static: ok");
