import assert from "node:assert/strict";

import { CADR_M11_PROTOCOL_VERSION, CadrM11AudioProtocolSubhandler } from
  "../cadr-web/wasm/cadr-m11-audio.mjs";

const operations = [];
const handler = new CadrM11AudioProtocolSubhandler({ invoke(operation) {
  operations.push(operation);
  if (operation.op === "audio-state") {
    return { status: 0, state: { generation: 1n, queuedFrames: 0n, packetCount: 0, rendererProfile: 2 } };
  }
  if (operation.op === "audio-snapshot-save") return { status: 0, snapshot: new Uint8Array(188).buffer };
  return { status: 9 };
} });

let reply = handler.handle({ version: 7, id: 1, op: "audio-state" });
assert.equal(reply.status, 0); assert.equal(reply.version, CADR_M11_PROTOCOL_VERSION);
assert.equal(reply.state.rendererProfile, 2);
reply = handler.handle({ version: 7, id: 2, op: "audio-render", generation: 1n,
  sequence: 2n, frameOffset: 0, requestedFrames: 512 });
assert.equal(reply.status, 9);
assert.deepEqual(operations.at(-1), { op: "audio-render", generation: 1n,
  sequence: 2n, frameOffset: 0, requestedFrames: 512 });
reply = handler.handle({ version: 7, id: 3, op: "audio-render", generation: 1n,
  sequence: 2n, frameOffset: 0, requestedFrames: 513 });
assert.equal(reply.status, 2);
reply = handler.handle({ version: 7, id: 31, op: "audio-ack", generation: 1n,
  sequence: 2n, frameOffset: 0, frames: 0 });
assert.equal(reply.status, 9, "zero-frame Votrax/UART acknowledgement reaches the lower model");
reply = handler.handle({ version: 7, id: 4, op: "audio-snapshot-restore",
  snapshot: new Uint8Array(188).buffer });
assert.equal(reply.status, 9);
reply = handler.handle({ version: 7, id: 5, op: "audio-snapshot-restore",
  snapshot: new Uint8Array(0).buffer });
assert.equal(reply.status, 2);
assert.equal(handler.handle({ version: 6, id: 6, op: "audio-state" }), null);

console.log("cadr M11 protocol tests passed");
