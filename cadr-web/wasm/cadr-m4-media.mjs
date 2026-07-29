export const M4_ACTOR_ISSUE = 1;
export const M4_ACTOR_CAPTURE = 2;
export const M4_ACTOR_DELIVERY = 3;
export const M4_ACTOR_APPLY = 4;
export const M4_ACTOR_STABLE = 5;
export const M4_DISPOSITION_NONE = 0;
export const M4_DISPOSITION_COMMIT = 1;
export const M4_DISPOSITION_ABORT = 2;
export const M4_MEDIA_HEADER_BYTES = 64;
export const M4_MEDIA_TURN_BYTES = 352;
export const M4_SELECTED_BASE_BYTES = 269562880n;

const BASE_SHA256 = Uint8Array.from(
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
    .match(/../g), (byte) => Number.parseInt(byte, 16));
const OVERLAY_DOMAIN = new TextEncoder().encode("CDRM4OVERLAY1\0");

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("M4 media field must be bytes");
}

function copyHash(value) {
  const bytes = bytesOf(value);
  if (bytes.byteLength !== 32) throw new RangeError("expected SHA-256");
  return bytes.slice();
}

export async function m4Sha256(value = new Uint8Array(0)) {
  const bytes = bytesOf(value);
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256", bytes.buffer.slice(
      bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}

export async function m4OverlayRoot(entries) {
  const ordered = [...entries.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0);
  const bytes = new Uint8Array(
    OVERLAY_DOMAIN.byteLength + 32 + 8 + ordered.length * 40);
  const view = new DataView(bytes.buffer);
  bytes.set(OVERLAY_DOMAIN, 0);
  bytes.set(BASE_SHA256, OVERLAY_DOMAIN.byteLength);
  view.setBigUint64(OVERLAY_DOMAIN.byteLength + 32,
    BigInt(ordered.length), true);
  let offset = OVERLAY_DOMAIN.byteLength + 40;
  for (const [firstBlock, pageHash] of ordered) {
    view.setBigUint64(offset, firstBlock, true);
    bytes.set(copyHash(pageHash), offset + 8);
    offset += 40;
  }
  return m4Sha256(bytes);
}

export function m4EmptyTurn() {
  return {
    ordinal: 0n, actor: 0, disposition: 0, operation: 0,
    actorStatus: 0, guestTick: 0n, generation: 0n, requestId: 0n,
    descriptor: new Uint8Array(0), requestPayloadByteCount: 0n,
    expectedCompletionByteCount: 0n,
    deliveredCompletionByteCount: 0n,
    descriptorSha256: new Uint8Array(32),
    requestPayloadSha256: new Uint8Array(32),
    pageSha256: new Uint8Array(32), overlayGeneration: 0n,
    overlayRootSha256: new Uint8Array(32),
    stabilizedStateSha256: new Uint8Array(32),
  };
}

function writeTurn(output, offset, turn) {
  const descriptor = bytesOf(turn.descriptor);
  if (descriptor.byteLength > 64) throw new RangeError("descriptor too large");
  const view = new DataView(output.buffer, output.byteOffset + offset, 352);
  view.setBigUint64(0, turn.ordinal, true);
  view.setUint32(8, turn.actor, true);
  view.setUint32(12, turn.disposition, true);
  view.setUint32(16, turn.operation, true);
  view.setUint32(20, turn.actorStatus, true);
  view.setBigUint64(24, turn.guestTick, true);
  view.setBigUint64(32, turn.generation, true);
  view.setBigUint64(40, turn.requestId, true);
  view.setBigUint64(48, BigInt(descriptor.byteLength), true);
  view.setBigUint64(56, turn.requestPayloadByteCount, true);
  view.setBigUint64(64, turn.expectedCompletionByteCount, true);
  view.setBigUint64(72, turn.deliveredCompletionByteCount, true);
  output.set(descriptor, offset + 80);
  output.set(copyHash(turn.descriptorSha256), offset + 144);
  output.set(copyHash(turn.requestPayloadSha256), offset + 176);
  output.set(copyHash(turn.pageSha256), offset + 208);
  view.setBigUint64(240, turn.overlayGeneration, true);
  output.set(copyHash(turn.overlayRootSha256), offset + 248);
  output.set(copyHash(turn.stabilizedStateSha256), offset + 280);
}

export function serializeM4Media(turns) {
  if (!Array.isArray(turns) || turns.length === 0 ||
      turns.at(-1)?.actor !== M4_ACTOR_STABLE) {
    throw new RangeError("M4 media transcript must end stable");
  }
  const output = new Uint8Array(
    M4_MEDIA_HEADER_BYTES + turns.length * M4_MEDIA_TURN_BYTES);
  output.set(new TextEncoder().encode("CDRM4MEDIA1"), 0);
  const header = new DataView(output.buffer, 0, M4_MEDIA_HEADER_BYTES);
  header.setUint32(12, 1, true);
  header.setBigUint64(16, M4_SELECTED_BASE_BYTES, true);
  output.set(BASE_SHA256, 24);
  turns.forEach((turn, index) => {
    if (turn.ordinal !== BigInt(index)) {
      throw new RangeError("noncanonical M4 actor ordinal");
    }
    writeTurn(output,
      M4_MEDIA_HEADER_BYTES + index * M4_MEDIA_TURN_BYTES, turn);
  });
  return output;
}
