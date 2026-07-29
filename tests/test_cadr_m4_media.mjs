import assert from "node:assert/strict";

import {
  M4_ACTOR_APPLY, M4_ACTOR_CAPTURE, M4_ACTOR_DELIVERY, M4_ACTOR_ISSUE,
  M4_ACTOR_STABLE, M4_DISPOSITION_COMMIT, m4EmptyTurn, m4OverlayRoot,
  m4Sha256, serializeM4Media,
} from "../cadr-web/wasm/cadr-m4-media.mjs";

const hex = (bytes) => Buffer.from(bytes).toString("hex");
const emptyHash = await m4Sha256();
assert.equal(hex(emptyHash),
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const emptyRoot = await m4OverlayRoot(new Map());
assert.equal(hex(emptyRoot),
  "28ef32b296ae7347afda8b0e2f8b4bca4073165d3525cc517ff437ba40f6462a");

const payload = Uint8Array.from({ length: 1024 }, (_, index) => index);
const pageHash = await m4Sha256(payload);
const committedRoot = await m4OverlayRoot(new Map([[1n, pageHash]]));
assert.equal(hex(committedRoot),
  "b4edd769c63950baadb9f6f67dbbb40e77de5127dee500115363b6ab0285f4f0");

const descriptor = new Uint8Array(24);
const descriptorView = new DataView(descriptor.buffer);
descriptorView.setBigUint64(0, 3n, true);
descriptorView.setBigUint64(8, 1n, true);
descriptorView.setUint32(16, 1, true);
descriptorView.setUint32(20, 1024, true);
const descriptorHash = await m4Sha256(descriptor);

function requestTurn(ordinal, actor) {
  return {
    ...m4EmptyTurn(), ordinal: BigInt(ordinal), actor,
    operation: 2, guestTick: BigInt(100 + ordinal), generation: 17n,
    requestId: 3n, descriptor: descriptor.slice(),
    requestPayloadByteCount: 1024n,
    descriptorSha256: descriptorHash,
    requestPayloadSha256: pageHash, pageSha256: pageHash,
    overlayRootSha256: emptyRoot,
  };
}

const turns = [
  requestTurn(0, M4_ACTOR_ISSUE),
  requestTurn(1, M4_ACTOR_CAPTURE),
  requestTurn(2, M4_ACTOR_DELIVERY),
  requestTurn(3, M4_ACTOR_APPLY),
];
for (const turn of turns.slice(2)) {
  turn.disposition = M4_DISPOSITION_COMMIT;
  turn.overlayGeneration = 1n;
  turn.overlayRootSha256 = committedRoot;
}
const stable = m4EmptyTurn();
stable.ordinal = 4n;
stable.actor = M4_ACTOR_STABLE;
stable.guestTick = 104n;
stable.descriptorSha256 = emptyHash;
stable.requestPayloadSha256 = emptyHash;
stable.pageSha256 = emptyHash;
stable.overlayGeneration = 1n;
stable.overlayRootSha256 = committedRoot;
stable.stabilizedStateSha256 = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
turns.push(stable);

const serialized = serializeM4Media(turns);
assert.equal(serialized.byteLength, 64 + 5 * 352);
assert.equal(new TextDecoder().decode(serialized.subarray(0, 11)), "CDRM4MEDIA1");
assert.equal(new DataView(serialized.buffer).getBigUint64(16, true), 269562880n);
assert.equal(new DataView(serialized.buffer).getUint32(64 + 2 * 352 + 12, true),
  M4_DISPOSITION_COMMIT);

assert.throws(() => serializeM4Media(turns.slice(0, -1)), /end stable/);
const badOrdinal = turns.map((turn) => ({ ...turn }));
badOrdinal[1].ordinal = 8n;
assert.throws(() => serializeM4Media(badOrdinal), /ordinal/);

console.log("cadr M4 JavaScript media tests passed");
