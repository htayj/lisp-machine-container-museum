import assert from "node:assert/strict";
import {
  CADR_M6_DEVID_POLICY_ID,
  CADR_M6_READY4_CONTRACT,
  canonicalM6ReadyWitnessV4,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

const ready3 = new Uint8Array(32); ready3[0] = 1;
const summary = new Uint8Array(32); summary[0] = 2;
const checkpoint = new Uint8Array(32); checkpoint[0] = 3;
const hostWait = new Uint8Array(32); hostWait[0] = 4;
const chains = { checkpointCount: 7, checkpointChainSha256: checkpoint,
  hostWaitCount: 2, hostWaitChainSha256: hostWait };
const first = await canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, policyId: CADR_M6_DEVID_POLICY_ID,
  selectedMaximum: 0x7fffffffffffffffn, cdrm6e1Sha256: summary, ...chains,
});
const second = await canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, policyId: CADR_M6_DEVID_POLICY_ID,
  selectedMaximum: 0x7fffffffffffffffn, cdrm6e1Sha256: summary, ...chains,
});
assert.deepEqual(first, second);
summary[0] = 3;
const changed = await canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, selectedMaximum: 0x7fffffffffffffffn,
  cdrm6e1Sha256: summary, ...chains,
});
assert.notDeepEqual(first, changed);
assert.equal(CADR_M6_READY4_CONTRACT,
  "C-M6-DISK-EVIDENCE-READY4-BINDING-v1");
await assert.rejects(canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, selectedMaximum: 0n, cdrm6e1Sha256: summary,
  ...chains,
}), TypeError);
await assert.rejects(canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, target: "CADR-WEB-303/ABI1.4/protocol-v4/M6",
  selectedMaximum: 0x7fffffffffffffffn, cdrm6e1Sha256: summary, ...chains,
}), TypeError, "READY4 is explicitly bound to the M6-DEVID1 target");
const changedChain = await canonicalM6ReadyWitnessV4({
  ready3Witness: ready3, selectedMaximum: 0x7fffffffffffffffn,
  cdrm6e1Sha256: summary, ...chains, checkpointCount: 8,
});
assert.notDeepEqual(first, changedChain,
  "READY4 binds the settled-checkpoint and host-wait counts/digests");
console.log("cadr_m6_ready4_binding: ok");
