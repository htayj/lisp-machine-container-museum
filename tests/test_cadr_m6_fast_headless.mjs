import assert from "node:assert/strict";
import { appendM6FastCheckpoint, parseM6FastRunResponse } from
  "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

function record(reason = 1) {
  const bytes = new Uint8Array(128); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6FAST1")); view.setUint32(16, 1, true);
  view.setUint32(20, 128, true); view.setUint32(24, reason, true); view.setUint32(32, 3, true);
  view.setBigUint64(40, reason === 3 ? 1n : 3n, true); view.setBigUint64(48, 9n, true);
  view.setBigUint64(56, 10n, true); view.setBigUint64(64, reason === 3 ? 11n : 13n, true);
  if (reason === 1) view.setUint32(28, 0, true);
  else if (reason === 2) { view.setUint32(28, 0, true); view.setBigUint64(80, 1n, true); }
  else if (reason === 3) { view.setUint32(28, 8, true); view.setBigUint64(96, 7n, true); }
  else view.setUint32(28, 12, true);
  return bytes;
}
function response(bytes) {
  const view = new DataView(bytes.buffer);
  return { wireSchema: "CDRM6FAST1", fastRun: bytes.buffer,
    reason: view.getUint32(24, true), terminalStatus: view.getUint32(28, true),
    requestedSlots: view.getUint32(32, true), completedSlots: view.getBigUint64(40, true),
    microinstructionDelta: view.getBigUint64(48, true), preBoundary: view.getBigUint64(56, true),
    postBoundary: view.getBigUint64(64, true), debugBefore: view.getBigUint64(72, true),
    debugAfter: view.getBigUint64(80, true), persistentStatus: view.getUint32(88, true),
    coreLifecycle: view.getUint32(92, true), outstandingRequestId: view.getBigUint64(96, true) };
}

const endpoint = record();
assert.equal(parseM6FastRunResponse(response(endpoint)).completedSlots, 3n);
const partialDebug = record(2);
assert.equal(parseM6FastRunResponse(response(partialDebug)).reason, 2,
  "a low-word-only debug value is a meaningful 48-bit delta");
assert.equal(parseM6FastRunResponse(response(record(3))).reason, 3);
const coincidentWait = record(3);
new DataView(coincidentWait.buffer).setBigUint64(80, 0x4d36n, true);
assert.equal(parseM6FastRunResponse(response(coincidentWait)).reason, 3,
  "a coincident WAIT remains authoritative over the recorded debug delta");
const reserved = record(); reserved[104] = 1;
assert.throws(() => parseM6FastRunResponse(response(reserved)), /malformed/);
const projection = response(record()); projection.postBoundary = 14n;
assert.throws(() => parseM6FastRunResponse(projection), /projection drift/);
const zero = new Uint8Array(32); const one = new Uint8Array(32); one[0] = 1;
const first = await appendM6FastCheckpoint(zero, 0, endpoint, one, one);
const second = await appendM6FastCheckpoint(first, 1, endpoint, one, one);
assert.notDeepEqual(first, second, "checkpoint ordinal and predecessor remain bound");
console.log("cadr M6 fast headless framing passed");
