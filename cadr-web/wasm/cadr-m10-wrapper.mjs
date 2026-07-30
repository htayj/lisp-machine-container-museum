/* CDRM10W1: C-M10 binding wrapper around a complete CDRM5WK1 snapshot. */
import {
  CADR_M10_BASE_BYTES,
  CADR_M10_BLOCK_BYTES,
  CADR_M10_BASE_SHA256,
  cadrM10Sha256,
  hexBytes,
} from "./cadr-m10-persistence.mjs";

export const CADR_M10_WRAPPER_BYTES = 256;
export const CADR_M10_WRAPPER_BINDING_REQUIRED = 1;

const TEXT = new TextEncoder();
const MAGIC = TEXT.encode("CDRM10W1");
const M5_MAGIC = TEXT.encode("CDRM5WK1");
const SNAP_MAGIC = TEXT.encode("CDRSNAP1");
const ZERO_HASH = new Uint8Array(32);
const SNAP_PROFILE_SHA256 = Uint8Array.from(
  "1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a"
    .match(/../g), (value) => Number.parseInt(value, 16));
const SNAP_ARTIFACT_SHA256 = Uint8Array.from(
  "e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941"
    .match(/../g), (value) => Number.parseInt(value, 16));

function required(condition, message) {
  if (!condition) throw new TypeError(`C-M10 wrapper: ${message}`);
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

function exact(value, count, label) {
  const bytes = bytesOf(value);
  required(bytes !== null && bytes.byteLength === count, `${label} must be ${count} bytes`);
  return bytes.slice();
}

function same(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function u64(value, label) {
  required(typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn, `${label} must be u64`);
  return value;
}

function isZero(value) { return same(value, ZERO_HASH); }

/**
 * Wire-structural validation for the selected M5 CDRSNAP1 minor-2 envelope.
 * Semantic chunk decoding remains a mandatory injected worker/core validator.
 */
export async function validateCdrSnap1Structure(value) {
  const supplied = bytesOf(value);
  required(supplied !== null && supplied.byteLength >= 264 + 10 * 64 + 32,
    "inner CDRSNAP1 is too short");
  const bytes = supplied.slice();
  required(same(bytes.subarray(0, 8), SNAP_MAGIC), "inner CDRSNAP1 magic");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkCount = view.getUint32(20, true);
  required(view.getUint16(8, true) === 1 && view.getUint16(10, true) === 2 &&
    view.getUint32(12, true) === 264 && view.getUint32(16, true) === 0 &&
    chunkCount >= 10 && chunkCount <= 1024 && view.getUint32(24, true) === 64 &&
    view.getUint32(28, true) === 0, "inner CDRSNAP1 version/header");
  const directoryBytes = BigInt(chunkCount) * 64n;
  const payloadOffset = 264n + directoryBytes;
  required(view.getBigUint64(32, true) === BigInt(bytes.byteLength) &&
    view.getBigUint64(40, true) === 264n &&
    view.getBigUint64(48, true) === directoryBytes &&
    view.getBigUint64(56, true) === payloadOffset, "inner CDRSNAP1 extent fields");
  required(view.getUint32(64, true) === 1 && (view.getUint32(68, true) & ~31) === 0 &&
    view.getUint32(72, true) <= 3 && view.getUint32(76, true) === 0 &&
    view.getBigUint64(80, true) === 0n, "inner CDRSNAP1 profile/state fields");
  required(same(bytes.subarray(104, 136), SNAP_PROFILE_SHA256) &&
    same(bytes.subarray(136, 168), SNAP_ARTIFACT_SHA256),
  "inner CDRSNAP1 profile/artifact binding");
  const directory = bytes.subarray(264, Number(payloadOffset));
  required(same(await cadrM10Sha256(directory), bytes.subarray(232, 264)),
    "inner CDRSNAP1 directory hash");
  required(same(await cadrM10Sha256(bytes.subarray(0, bytes.byteLength - 32)),
    bytes.subarray(bytes.byteLength - 32)), "inner CDRSNAP1 body hash");
  let havePrevious = false; let previousType = 0;
  let nextOffset = payloadOffset; const seen = new Set();
  for (let index = 0; index < chunkCount; index += 1) {
    const offset = 264 + index * 64;
    const type = view.getUint32(offset, true); const flags = view.getUint32(offset + 4, true);
    const payloadAt = view.getBigUint64(offset + 8, true);
    const length = view.getBigUint64(offset + 16, true);
    const reserved = view.getBigUint64(offset + 24, true);
    required((!havePrevious || type > previousType) &&
      reserved === 0n && payloadAt === nextOffset,
      "inner CDRSNAP1 directory order/offset/reserved fields");
    const end = payloadAt + length;
    required(end >= payloadAt && end <= BigInt(bytes.byteLength - 32),
      "inner CDRSNAP1 chunk range");
    if (type >= 1 && type <= 10) {
      required(flags === 1 && !seen.has(type), "inner CDRSNAP1 required chunk flags/duplication");
      seen.add(type);
    } else required(flags === 0, "inner CDRSNAP1 unknown required chunk");
    const payload = bytes.subarray(Number(payloadAt), Number(end));
    required(same(await cadrM10Sha256(payload), bytes.subarray(offset + 32, offset + 64)),
      "inner CDRSNAP1 chunk hash");
    havePrevious = true; previousType = type; nextOffset = end;
  }
  required(nextOffset === BigInt(bytes.byteLength - 32) && seen.size === 10,
    "inner CDRSNAP1 missing chunk or trailing bytes");
  return Object.freeze({ bytes: bytes.slice(), clockSlotsCompleted: view.getBigUint64(88, true),
    chunkCount, payloadOffset });
}

async function validM5Envelope(value, validateInnerSnapshot) {
  required(typeof validateInnerSnapshot === "function",
    "a mandatory worker/core inner snapshot validator was not supplied");
  const supplied = bytesOf(value);
  required(supplied !== null && supplied.byteLength >= 104,
    "inner must be a complete CDRM5WK1 envelope");
  /* Freeze the exact candidate before the first async hash or semantic callback. */
  const bytes = supplied.slice();
  required(same(bytes.subarray(0, 8), M5_MAGIC), "inner magic");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint32(12, true);
  required(view.getUint32(8, true) === 3 && (flags & ~3) === 0, "inner version or flags");
  const rawLength = view.getBigUint64(16, true);
  required(rawLength === BigInt(bytes.byteLength - 104), "inner raw length");
  const ordinal = view.getBigUint64(24, true); const boundary = view.getBigUint64(32, true);
  const witness = bytes.subarray(40, 72); const initialized = (flags & 2) !== 0;
  const witnessIsZero = isZero(witness);
  required(ordinal !== 0xffffffffffffffffn &&
    ((ordinal === 0n) === witnessIsZero) &&
    (ordinal !== 0n || boundary === 0n) &&
    ((flags & 1) === 0 || ordinal !== 0n) &&
    (initialized || ((flags & 1) === 0 && ordinal === 0n && boundary === 0n && witnessIsZero)),
  "inner control witness/flags");
  const digestInput = new Uint8Array(72 + bytes.byteLength - 104);
  digestInput.set(bytes.subarray(0, 72)); digestInput.set(bytes.subarray(104), 72);
  required(same(await cadrM10Sha256(digestInput), bytes.subarray(72, 104)), "inner immutable hash mismatch");
  const raw = bytes.slice(104);
  const structure = await validateCdrSnap1Structure(raw);
  required(boundary <= structure.clockSlotsCompleted, "inner control boundary exceeds snapshot");
  required(await validateInnerSnapshot(raw.slice(), Object.freeze({
    flags, ordinal, boundary, witness: witness.slice(), structure,
  })) === true, "worker/core rejected inner CDRSNAP1 semantics");
  return bytes.slice();
}

function fields(value) {
  required(value !== null && typeof value === "object", "wrapper fields must be an object");
  const flags = value.flags ?? CADR_M10_WRAPPER_BINDING_REQUIRED;
  required(Number.isSafeInteger(flags) && flags === CADR_M10_WRAPPER_BINDING_REQUIRED, "wrapper flags must require binding");
  const result = {
    flags, diskUuid: exact(value.diskUuid, 16, "disk UUID"), snapshotUuid: exact(value.snapshotUuid, 16, "snapshot UUID"),
    durableGeneration: u64(value.durableGeneration, "durable generation"), headSeq: u64(value.headSeq, "head sequence"),
    manifestSha256: exact(value.manifestSha256, 32, "manifest hash"), rootSha256: exact(value.rootSha256, 32, "root hash"),
    baseSha256: exact(value.baseSha256 ?? CADR_M10_BASE_SHA256, 32, "base hash"),
    profileSha256: exact(value.profileSha256, 32, "profile hash"), inner: value.inner,
  };
  required(!isZero(result.manifestSha256) && !isZero(result.rootSha256),
    "manifest and root hashes must be nonzero");
  required(result.headSeq !== 0n, "head sequence zero is reserved");
  return result;
}

export async function serializeCdrM10W1(value, { validateInnerSnapshot } = {}) {
  const item = fields(value); const inner = await validM5Envelope(item.inner, validateInnerSnapshot);
  required(same(item.baseSha256, CADR_M10_BASE_SHA256), "wrong C-M10 base hash");
  const bytes = new Uint8Array(CADR_M10_WRAPPER_BYTES + inner.byteLength); const view = new DataView(bytes.buffer);
  bytes.set(MAGIC, 0); view.setUint32(8, 1, true); view.setUint32(12, CADR_M10_WRAPPER_BYTES, true);
  view.setUint32(16, item.flags, true); view.setUint32(20, 0, true); view.setBigUint64(24, BigInt(inner.byteLength), true);
  view.setBigUint64(32, CADR_M10_BASE_BYTES, true); view.setUint32(40, CADR_M10_BLOCK_BYTES, true); view.setUint32(44, 0, true);
  bytes.set(item.diskUuid, 48); bytes.set(item.snapshotUuid, 64); view.setBigUint64(80, item.durableGeneration, true); view.setBigUint64(88, item.headSeq, true);
  bytes.set(item.manifestSha256, 96); bytes.set(item.rootSha256, 128); bytes.set(item.baseSha256, 160); bytes.set(item.profileSha256, 192);
  const digestInput = new Uint8Array(224 + inner.byteLength); digestInput.set(bytes.subarray(0, 224)); digestInput.set(inner, 224);
  bytes.set(await cadrM10Sha256(digestInput), 224); bytes.set(inner, 256);
  return bytes;
}

export async function parseCdrM10W1(value, { validateInnerSnapshot } = {}) {
  const supplied = bytesOf(value);
  required(supplied !== null && supplied.byteLength >= CADR_M10_WRAPPER_BYTES + 104,
    "wrapper is too short");
  const bytes = supplied.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  required(same(bytes.subarray(0, 8), MAGIC) && view.getUint32(8, true) === 1 &&
    view.getUint32(12, true) === 256 && view.getUint32(16, true) === CADR_M10_WRAPPER_BINDING_REQUIRED,
  "wrapper magic/version/header/flags");
  required(view.getUint32(20, true) === 0 && view.getBigUint64(32, true) === CADR_M10_BASE_BYTES &&
    view.getUint32(40, true) === CADR_M10_BLOCK_BYTES && view.getUint32(44, true) === 0,
  "wrapper resource or reserved fields");
  const innerLength = view.getBigUint64(24, true);
  required(innerLength === BigInt(bytes.byteLength - 256), "wrapper inner length");
  const digestInput = new Uint8Array(224 + Number(innerLength)); digestInput.set(bytes.subarray(0, 224)); digestInput.set(bytes.subarray(256), 224);
  required(same(await cadrM10Sha256(digestInput), bytes.subarray(224, 256)), "wrapper immutable hash mismatch");
  const item = fields({ flags: view.getUint32(16, true), diskUuid: bytes.subarray(48, 64), snapshotUuid: bytes.subarray(64, 80),
    durableGeneration: view.getBigUint64(80, true), headSeq: view.getBigUint64(88, true), manifestSha256: bytes.subarray(96, 128),
    rootSha256: bytes.subarray(128, 160), baseSha256: bytes.subarray(160, 192), profileSha256: bytes.subarray(192, 224), inner: bytes.subarray(256) });
  required(same(item.baseSha256, CADR_M10_BASE_SHA256), "wrong C-M10 base hash");
  const inner = await validM5Envelope(item.inner, validateInnerSnapshot);
  return Object.freeze({ ...item, inner, bytes: bytes.slice(), sha256: hexBytes(await cadrM10Sha256(bytes)) });
}
