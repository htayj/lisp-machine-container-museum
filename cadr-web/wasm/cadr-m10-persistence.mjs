/*
 * C-M10-PERSIST-v1 private-overlay substrate.
 *
 * This file is intentionally independent of the worker and of real disk media.
 * Its only base-image input is an exact 1024-byte callback result.  The backend
 * stores content-addressed synthetic pages and canonical metadata in memory.
 */

export const CADR_M10_PROFILE = "CADR-WEB-303/ABI1.5/protocol-v6/C-M10-PERSIST-v1";
export const CADR_M10_BASE_BYTES = 269562880n;
export const CADR_M10_BLOCK_BYTES = 1024;
export const CADR_M10_BASE_BLOCKS = 263245n;
export const CADR_M10_MAX_LBA = CADR_M10_BASE_BLOCKS - 1n;
export const CADR_M10_SHA256_BYTES = 32;
export const CADR_M10_DISK_UUID_BYTES = 16;

export const CADR_M10_NODE_BYTES = 8232;
export const CADR_M10_NODE_HEADER_BYTES = 40;
export const CADR_M10_NODE_CHILDREN = 256;
export const CADR_M10_MANIFEST_BYTES = 352;
export const CADR_M10_MANIFEST_HEADER_BYTES = 320;
export const CADR_M10_HEAD_BYTES = 296;
export const CADR_M10_HEAD_HASH_OFFSET = 264;

export const CADR_M10_COMPLETE = 1;
export const CADR_M10_STATE_CLEAN = "CLEAN";
export const CADR_M10_STATE_DIRTY = "DIRTY";
export const CADR_M10_STATE_SAVE_FAILED = "SAVE_FAILED";
export const CADR_M10_STATE_RECOVERY_REQUIRED = "RECOVERY_REQUIRED";
export const CADR_M10_MAX_ACTIVATION_RECORDS = 4096;

export const CADR_M10_BASE_SHA256 = Uint8Array.from(
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
    .match(/../g), (value) => Number.parseInt(value, 16));

/* Every public transition has a before/after power-loss test seam. */
export const CADR_M10_TRANSACTION_SEAMS = Object.freeze([
  "before-validate", "after-validate",
  "before-base-compare", "after-base-compare",
  "before-build-private", "after-build-private",
  "before-page-cas", "after-page-cas",
  "before-core-completion", "after-core-completion",
  "before-publish-dirty", "after-publish-dirty",
  "before-reserve-generation", "after-reserve-generation",
  "before-manifest-cas", "after-manifest-cas",
  "before-head-activation", "after-head-activation",
  "before-reread-head", "after-reread-head",
  "before-clean", "after-clean",
]);

const TEXT = new TextEncoder();
const ZERO_HASH = new Uint8Array(CADR_M10_SHA256_BYTES);
const MAX_U64 = 0xffffffffffffffffn;
const NODE_MAGIC = TEXT.encode("CDROVN1\0");
const MANIFEST_MAGIC = TEXT.encode("CDROVM1\0");
const HEAD_MAGIC = TEXT.encode("CDROVH1\0");
const RECORD_PHASE_INITIALIZING = "INITIALIZING";
const RECORD_PHASE_OPEN = "OPEN";

export class CadrM10FormatError extends Error {
  constructor(message) { super(message); this.name = "CadrM10FormatError"; }
}

export class CadrM10ConflictError extends Error {
  constructor(message) { super(message); this.name = "CadrM10ConflictError"; }
}

export class CadrM10RecoveryError extends Error {
  constructor(message) { super(message); this.name = "CadrM10RecoveryError"; }
}

export class CadrM10InjectedFault extends Error {
  constructor(seam) {
    super(`C-M10 injected fault at ${seam}`);
    this.name = "CadrM10InjectedFault";
    this.seam = seam;
  }
}

function required(condition, message, ErrorType = CadrM10FormatError) {
  if (!condition) throw new ErrorType(`C-M10: ${message}`);
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function copyExact(value, length, label) {
  const bytes = bytesOf(value);
  required(bytes !== null && bytes.byteLength === length, `${label} must be ${length} bytes`);
  return bytes.slice();
}

function equalBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function isZeroHash(value) { return equalBytes(value, ZERO_HASH); }

function hashKey(value) { return hexBytes(copyExact(value, 32, "hash")); }

function uuidKey(value) { return hexBytes(copyExact(value, 16, "disk UUID")); }

function uint64(value, label) {
  required(typeof value === "bigint" && value >= 0n && value <= MAX_U64,
    `${label} must be an unsigned u64`);
  return value;
}

function uint32(value, label) {
  required(Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff,
    `${label} must be an unsigned u32`);
  return value;
}

function exactLba(value) {
  uint64(value, "LBA");
  required(value <= CADR_M10_MAX_LBA, "LBA is outside the selected immutable base");
  return value;
}

function magicAt(bytes, offset, expected, label) {
  required(equalBytes(bytes.subarray(offset, offset + expected.byteLength), expected), `${label} magic`);
}

function reservedZero(bytes, from, to, label) {
  for (let index = from; index < to; index += 1) {
    required(bytes[index] === 0, `${label} reserved byte ${index} is nonzero`);
  }
}

function childArray(value) {
  required(Array.isArray(value) && value.length === CADR_M10_NODE_CHILDREN,
    "node must have exactly 256 children");
  return value.map((hash, index) => copyExact(hash, 32, `node child ${index}`));
}

function nodePrefixIsCanonical(level, prefix) {
  if (level === 2) return prefix === 0n;
  if (level === 1) return (prefix & 0xffffn) === 0n && prefix <= 0xff0000n;
  return (prefix & 0xffn) === 0n && prefix <= 0xffff00n;
}

function nodeChildPrefix(level, prefix, child) {
  return prefix | (BigInt(child) << BigInt(level * 8));
}

function lbaByte(lba, level) {
  return Number((lba >> BigInt(level * 8)) & 0xffn);
}

function allZero(children) { return children.every(isZeroHash); }

export function hexBytes(value) {
  return [...bytesOf(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cadrM10Sha256(value) {
  const bytes = bytesOf(value);
  required(bytes !== null, "hash input must be bytes");
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
}

async function canonicalHash(bytes, byteCount) {
  return cadrM10Sha256(bytes.subarray(0, byteCount));
}

/** Canonical `CDROVN1` node serialization.  Its address is SHA-256 of all 8232 bytes. */
export async function serializeCdrOvn1({ level, prefix, children }) {
  required(Number.isInteger(level) && level >= 0 && level <= 2, "node level is outside 0..2");
  uint64(prefix, "node prefix");
  required(nodePrefixIsCanonical(level, prefix), "node prefix is not canonical for level");
  const entries = childArray(children);
  const output = new Uint8Array(CADR_M10_NODE_BYTES);
  const view = new DataView(output.buffer);
  output.set(NODE_MAGIC, 0);
  view.setUint16(8, 1, true);
  view.setUint8(10, level);
  view.setUint8(11, 0);
  view.setUint32(12, CADR_M10_NODE_HEADER_BYTES, true);
  view.setUint32(16, CADR_M10_NODE_BYTES, true);
  view.setUint32(20, CADR_M10_NODE_CHILDREN, true);
  view.setBigUint64(24, prefix, true);
  view.setBigUint64(32, 0n, true);
  entries.forEach((hash, index) => output.set(hash, 40 + index * 32));
  return output;
}

/** Strictly parse and re-hash a `CDROVN1`; its external map key carries the digest. */
export async function parseCdrOvn1(value) {
  const bytes = copyExact(value, CADR_M10_NODE_BYTES, "CDROVN1 node");
  const view = new DataView(bytes.buffer);
  magicAt(bytes, 0, NODE_MAGIC, "CDROVN1");
  required(view.getUint16(8, true) === 1, "CDROVN1 schema");
  const level = view.getUint8(10);
  required(level <= 2 && view.getUint8(11) === 0, "CDROVN1 level or flags");
  required(view.getUint32(12, true) === CADR_M10_NODE_HEADER_BYTES &&
    view.getUint32(16, true) === CADR_M10_NODE_BYTES &&
    view.getUint32(20, true) === CADR_M10_NODE_CHILDREN, "CDROVN1 size fields");
  const prefix = view.getBigUint64(24, true);
  required(nodePrefixIsCanonical(level, prefix) && view.getBigUint64(32, true) === 0n,
    "CDROVN1 prefix or reserved fields");
  const digest = await canonicalHash(bytes, CADR_M10_NODE_BYTES);
  const children = Array.from({ length: 256 }, (_, index) => bytes.slice(40 + index * 32, 72 + index * 32));
  return Object.freeze({ bytes, hash: digest, level, prefix, children: Object.freeze(children) });
}

/*
 * Frozen Phase 1 candidate manifest offset table.  The selected fields and total
 * size did not supply offsets; changing this table requires a new schema/profile.
 */
export const CADR_M10_MANIFEST_LAYOUT_CANDIDATE = Object.freeze({
  magic: 0, schema: 8, headerBytes: 12, manifestBytes: 16, flags: 20,
  generation: 24, parentGeneration: 32, baseBytes: 40, baseBlocks: 48,
  blockBytes: 56, reserved0: 60, entryCount: 64, fanout: 72, depth: 76,
  diskUuid: 80, baseSha256: 96, profileSha256: 128, artifactSetSha256: 160,
  parentManifestSha256: 192, rootSha256: 224, reservedTail: 256,
  digest: 320,
});

function manifestInput(value) {
  required(value !== null && typeof value === "object", "manifest must be an object");
  const flags = uint32(value.flags ?? CADR_M10_COMPLETE, "manifest flags");
  required(flags === CADR_M10_COMPLETE, "manifest flags must be COMPLETE only");
  const generation = uint64(value.generation, "manifest generation");
  const parentGeneration = uint64(value.parentGeneration, "manifest parent generation");
  required((generation === 0n && parentGeneration === 0n) ||
    (generation > 0n && parentGeneration < generation), "manifest lineage is not monotonic");
  const result = {
    flags, generation, parentGeneration,
    baseBytes: uint64(value.baseBytes ?? CADR_M10_BASE_BYTES, "manifest base byte count"),
    baseBlocks: uint64(value.baseBlocks ?? CADR_M10_BASE_BLOCKS, "manifest base block count"),
    blockBytes: uint32(value.blockBytes ?? CADR_M10_BLOCK_BYTES, "manifest block byte count"),
    entryCount: uint64(value.entryCount, "manifest entry count"),
    diskUuid: copyExact(value.diskUuid, 16, "manifest disk UUID"),
    baseSha256: copyExact(value.baseSha256, 32, "manifest base SHA-256"),
    profileSha256: copyExact(value.profileSha256, 32, "manifest profile SHA-256"),
    artifactSetSha256: copyExact(value.artifactSetSha256, 32, "manifest artifact-set SHA-256"),
    parentManifestSha256: copyExact(value.parentManifestSha256 ?? ZERO_HASH, 32, "manifest parent hash"),
    rootSha256: copyExact(value.rootSha256, 32, "manifest root hash"),
  };
  required(result.baseBytes === CADR_M10_BASE_BYTES && result.baseBlocks === CADR_M10_BASE_BLOCKS &&
    result.blockBytes === CADR_M10_BLOCK_BYTES, "manifest resource binding differs from C-M10 profile");
  required(equalBytes(result.baseSha256, CADR_M10_BASE_SHA256),
    "manifest base hash differs from C-M10 profile");
  required(result.entryCount <= CADR_M10_BASE_BLOCKS,
    "manifest entry count exceeds the selected base");
  required(!isZeroHash(result.rootSha256), "manifest requires a real root node hash");
  required((result.generation === 0n) === isZeroHash(result.parentManifestSha256),
    "manifest parent hash does not match genesis/non-genesis lineage");
  return result;
}

export async function serializeCdrOvm1(value) {
  const item = manifestInput(value);
  const output = new Uint8Array(CADR_M10_MANIFEST_BYTES);
  const view = new DataView(output.buffer);
  const o = CADR_M10_MANIFEST_LAYOUT_CANDIDATE;
  output.set(MANIFEST_MAGIC, o.magic);
  view.setUint32(o.schema, 1, true); view.setUint32(o.headerBytes, CADR_M10_MANIFEST_HEADER_BYTES, true);
  view.setUint32(o.manifestBytes, CADR_M10_MANIFEST_BYTES, true); view.setUint32(o.flags, item.flags, true);
  view.setBigUint64(o.generation, item.generation, true); view.setBigUint64(o.parentGeneration, item.parentGeneration, true);
  view.setBigUint64(o.baseBytes, item.baseBytes, true); view.setBigUint64(o.baseBlocks, item.baseBlocks, true);
  view.setUint32(o.blockBytes, item.blockBytes, true); view.setUint32(o.reserved0, 0, true);
  view.setBigUint64(o.entryCount, item.entryCount, true); view.setUint32(o.fanout, 256, true); view.setUint32(o.depth, 3, true);
  output.set(item.diskUuid, o.diskUuid); output.set(item.baseSha256, o.baseSha256);
  output.set(item.profileSha256, o.profileSha256); output.set(item.artifactSetSha256, o.artifactSetSha256);
  output.set(item.parentManifestSha256, o.parentManifestSha256); output.set(item.rootSha256, o.rootSha256);
  output.set(await canonicalHash(output, CADR_M10_MANIFEST_HEADER_BYTES), o.digest);
  return output;
}

export async function parseCdrOvm1(value) {
  const bytes = copyExact(value, CADR_M10_MANIFEST_BYTES, "CDROVM1 manifest");
  const view = new DataView(bytes.buffer); const o = CADR_M10_MANIFEST_LAYOUT_CANDIDATE;
  magicAt(bytes, o.magic, MANIFEST_MAGIC, "CDROVM1");
  required(view.getUint32(o.schema, true) === 1 && view.getUint32(o.headerBytes, true) === 320 &&
    view.getUint32(o.manifestBytes, true) === 352 && view.getUint32(o.flags, true) === CADR_M10_COMPLETE,
  "CDROVM1 header");
  required(view.getUint32(o.reserved0, true) === 0 && view.getUint32(o.fanout, true) === 256 &&
    view.getUint32(o.depth, true) === 3, "CDROVM1 structural fields");
  reservedZero(bytes, o.reservedTail, o.digest, "CDROVM1");
  const digest = await canonicalHash(bytes, o.digest);
  required(equalBytes(digest, bytes.subarray(o.digest)), "CDROVM1 immutable hash mismatch");
  const result = manifestInput({
    flags: view.getUint32(o.flags, true), generation: view.getBigUint64(o.generation, true),
    parentGeneration: view.getBigUint64(o.parentGeneration, true), baseBytes: view.getBigUint64(o.baseBytes, true),
    baseBlocks: view.getBigUint64(o.baseBlocks, true), blockBytes: view.getUint32(o.blockBytes, true),
    entryCount: view.getBigUint64(o.entryCount, true), diskUuid: bytes.slice(o.diskUuid, o.diskUuid + 16),
    baseSha256: bytes.slice(o.baseSha256, o.baseSha256 + 32), profileSha256: bytes.slice(o.profileSha256, o.profileSha256 + 32),
    artifactSetSha256: bytes.slice(o.artifactSetSha256, o.artifactSetSha256 + 32),
    parentManifestSha256: bytes.slice(o.parentManifestSha256, o.parentManifestSha256 + 32),
    rootSha256: bytes.slice(o.rootSha256, o.rootSha256 + 32),
  });
  return Object.freeze({ ...result, bytes, hash: digest });
}

function headInput(value) {
  required(value !== null && typeof value === "object", "head must be an object");
  const activeGeneration = uint64(value.activeGeneration, "head active generation");
  const previousGeneration = uint64(value.previousGeneration ?? 0n, "head previous generation");
  const result = {
    headSeq: uint64(value.headSeq, "head sequence"), writerEpoch: uint64(value.writerEpoch, "writer epoch"),
    diskUuid: copyExact(value.diskUuid, 16, "head disk UUID"), activeGeneration,
    activeManifestSha256: copyExact(value.activeManifestSha256, 32, "head active manifest"),
    activeRootSha256: copyExact(value.activeRootSha256, 32, "head active root"), previousGeneration,
    previousManifestSha256: copyExact(value.previousManifestSha256 ?? ZERO_HASH, 32, "head previous manifest"),
    previousRootSha256: copyExact(value.previousRootSha256 ?? ZERO_HASH, 32, "head previous root"),
    baseSha256: copyExact(value.baseSha256, 32, "head base SHA-256"),
    profileSha256: copyExact(value.profileSha256, 32, "head profile SHA-256"),
  };
  required(result.headSeq !== 0n, "head sequence zero is reserved");
  required(!isZeroHash(result.activeManifestSha256) && !isZeroHash(result.activeRootSha256),
    "head requires active manifest and root");
  required(equalBytes(result.baseSha256, CADR_M10_BASE_SHA256),
    "head base hash differs from C-M10 profile");
  const manifestAbsent = isZeroHash(result.previousManifestSha256);
  const rootAbsent = isZeroHash(result.previousRootSha256);
  required(manifestAbsent === rootAbsent, "head has a partial previous tuple");
  required(manifestAbsent
    ? result.previousGeneration === 0n
    : result.previousGeneration < result.activeGeneration,
  "head previous fields are not canonical");
  required(!(result.activeGeneration === 0n && !manifestAbsent), "genesis head cannot have a previous tuple");
  return result;
}

export async function serializeCdrOvh1(value) {
  const item = headInput(value);
  const output = new Uint8Array(CADR_M10_HEAD_BYTES); const view = new DataView(output.buffer);
  output.set(HEAD_MAGIC, 0); view.setUint32(8, 1, true); view.setUint32(12, 296, true);
  view.setUint32(16, 0, true); view.setUint32(20, 0, true); view.setBigUint64(24, item.headSeq, true);
  view.setBigUint64(32, item.writerEpoch, true); output.set(item.diskUuid, 40);
  view.setBigUint64(56, item.activeGeneration, true); output.set(item.activeManifestSha256, 64); output.set(item.activeRootSha256, 96);
  view.setBigUint64(128, item.previousGeneration, true); output.set(item.previousManifestSha256, 136); output.set(item.previousRootSha256, 168);
  output.set(item.baseSha256, 200); output.set(item.profileSha256, 232);
  output.set(await canonicalHash(output, CADR_M10_HEAD_HASH_OFFSET), CADR_M10_HEAD_HASH_OFFSET);
  return output;
}

export async function parseCdrOvh1(value) {
  const bytes = copyExact(value, CADR_M10_HEAD_BYTES, "CDROVH1 head"); const view = new DataView(bytes.buffer);
  magicAt(bytes, 0, HEAD_MAGIC, "CDROVH1");
  required(view.getUint32(8, true) === 1 && view.getUint32(12, true) === 296 &&
    view.getUint32(16, true) === 0 && view.getUint32(20, true) === 0, "CDROVH1 header");
  const digest = await canonicalHash(bytes, CADR_M10_HEAD_HASH_OFFSET);
  required(equalBytes(digest, bytes.subarray(CADR_M10_HEAD_HASH_OFFSET)), "CDROVH1 immutable hash mismatch");
  const result = headInput({
    headSeq: view.getBigUint64(24, true), writerEpoch: view.getBigUint64(32, true), diskUuid: bytes.slice(40, 56),
    activeGeneration: view.getBigUint64(56, true), activeManifestSha256: bytes.slice(64, 96), activeRootSha256: bytes.slice(96, 128),
    previousGeneration: view.getBigUint64(128, true), previousManifestSha256: bytes.slice(136, 168), previousRootSha256: bytes.slice(168, 200),
    baseSha256: bytes.slice(200, 232), profileSha256: bytes.slice(232, 264),
  });
  return Object.freeze({ ...result, bytes, hash: digest });
}

function cloneActivation(value) {
  return Object.freeze({ diskUuid: value.diskUuid.slice(), headSeq: value.headSeq,
    headBytes: value.headBytes.slice() });
}

function parseActivationKey(key) {
  if (typeof key !== "string") return null;
  const match = /^([0-9a-f]{32}):([1-9][0-9]*)$/.exec(key);
  if (match === null) return null;
  let sequence;
  try { sequence = BigInt(match[2]); } catch { return null; }
  if (sequence > MAX_U64 || sequence.toString() !== match[2]) return null;
  return Object.freeze({ diskKey: match[1], sequence });
}

function activationRecordIsCanonical(keyInfo, activation) {
  if (keyInfo === null || activation === null || typeof activation !== "object") return false;
  try {
    const diskUuid = copyExact(activation.diskUuid, 16, "activation disk UUID");
    const headBytes = copyExact(activation.headBytes, CADR_M10_HEAD_BYTES, "activation head");
    return uuidKey(diskUuid) === keyInfo.diskKey &&
      uint64(activation.headSeq, "activation head sequence") === keyInfo.sequence &&
      headBytes.byteLength === CADR_M10_HEAD_BYTES;
  } catch { return false; }
}

function prepareActivationPublication(store, nextKey) {
  required(store.activations.size <= CADR_M10_MAX_ACTIVATION_RECORDS,
    "activation volume exceeds the bounded publication limit",
  CadrM10ConflictError);
  for (const [key, activation] of [...store.activations.entries()]) {
    if (!activationRecordIsCanonical(parseActivationKey(key), activation)) {
      store.activations.delete(key);
      store.activation_quarantine.set(key, activation);
    }
  }
  required(!store.activations.has(nextKey), "next activation slot already exists",
    CadrM10ConflictError);
  const protectedKeys = new Set();
  for (const record of store.disks.values()) {
    const head = record.runtime?.head;
    if (head === undefined) continue;
    protectedKeys.add(`${record.key}:${head.headSeq}`);
    if (head.headSeq > 1n) protectedKeys.add(`${record.key}:${head.headSeq - 1n}`);
  }
  const disposable = [];
  for (const key of store.activations.keys()) {
    if (protectedKeys.has(key)) continue;
    const keyInfo = parseActivationKey(key);
    if (keyInfo !== null) disposable.push({ key, sequence: keyInfo.sequence });
  }
  disposable.sort((left, right) => left.sequence === right.sequence
    ? left.key.localeCompare(right.key) : (left.sequence < right.sequence ? -1 : 1));
  const pruneCount = Math.max(0,
    store.activations.size - (CADR_M10_MAX_ACTIVATION_RECORDS - 1));
  required(disposable.length >= pruneCount,
    "activation log has no safely prunable publication slot",
  CadrM10ConflictError);
  for (let index = 0; index < pruneCount; index += 1) {
    store.activations.delete(disposable[index].key);
  }
}

function checkedConfig(value) {
  required(value !== null && typeof value === "object", "disk config must be an object");
  required(typeof value.readBasePage === "function", "disk config needs readBasePage(lba)");
  const baseSha256 = copyExact(value.baseSha256 ?? CADR_M10_BASE_SHA256, 32, "base SHA-256");
  required(equalBytes(baseSha256, CADR_M10_BASE_SHA256), "unexpected immutable base SHA-256");
  const baseBytes = uint64(value.baseBytes ?? CADR_M10_BASE_BYTES, "base bytes");
  const baseBlocks = uint64(value.baseBlocks ?? CADR_M10_BASE_BLOCKS, "base blocks");
  const blockBytes = uint32(value.blockBytes ?? CADR_M10_BLOCK_BYTES, "block bytes");
  required(baseBytes === CADR_M10_BASE_BYTES && baseBlocks === CADR_M10_BASE_BLOCKS && blockBytes === CADR_M10_BLOCK_BYTES,
    "disk config differs from selected C-M10 resource limits");
  return Object.freeze({ diskUuid: copyExact(value.diskUuid, 16, "disk UUID"), baseSha256,
    profileSha256: copyExact(value.profileSha256, 32, "profile SHA-256"),
    artifactSetSha256: copyExact(value.artifactSetSha256, 32, "artifact-set SHA-256"),
    readBasePage: value.readBasePage, baseBytes, baseBlocks, blockBytes });
}

async function exactBasePage(config, lba) {
  const supplied = bytesOf(await config.readBasePage(lba));
  required(supplied !== null && supplied.byteLength === CADR_M10_BLOCK_BYTES,
    "base reader returned a non-page result");
  return supplied.slice();
}

function mapGetVerified(map, hash, label) {
  const key = hashKey(hash); const bytes = map.get(key);
  required(bytes instanceof Uint8Array, `${label} ${key} is missing`);
  return bytes.slice();
}

function mapCas(map, bytes, hash, label) {
  const key = hashKey(hash); const current = map.get(key);
  if (current !== undefined) {
    required(equalBytes(current, bytes), `${label} CAS collision for ${key}`);
  } else map.set(key, bytes.slice());
  const reread = map.get(key);
  required(reread !== undefined && equalBytes(reread, bytes), `${label} CAS reread mismatch`);
}

function recordFor(store, diskKey) {
  const record = store.disks.get(diskKey);
  required(record !== undefined, "disk is not initialized", CadrM10RecoveryError);
  return record;
}

async function parseStoredNode(store, hash) {
  const bytes = mapGetVerified(store.nodes, hash, "node");
  const parsed = await parseCdrOvn1(bytes);
  required(equalBytes(parsed.hash, hash), "node map key does not equal immutable hash");
  return parsed;
}

async function parseStoredManifest(store, hash) {
  const bytes = mapGetVerified(store.manifests, hash, "manifest");
  const parsed = await parseCdrOvm1(bytes);
  required(equalBytes(parsed.hash, hash), "manifest map key does not equal immutable hash");
  return parsed;
}

async function verifyTree(store, rootHash, expectedLevel = 2, expectedPrefix = 0n,
  interleaveGuard = null) {
  const queue = [{ hash: rootHash, level: expectedLevel, prefix: expectedPrefix }];
  const seen = new Set(); let entries = 0n;
  while (queue.length) {
    const current = queue.pop(); const key = hashKey(current.hash);
    if (seen.has(key)) throw new CadrM10FormatError("C-M10: tree has a repeated node reference");
    seen.add(key);
    const node = await parseStoredNode(store, current.hash);
    if (interleaveGuard !== null) interleaveGuard();
    required(node.level === current.level && node.prefix === current.prefix, "tree level/prefix edge mismatch");
    for (let index = 0; index < 256; index += 1) {
      const child = node.children[index]; if (isZeroHash(child)) continue;
      if (node.level === 0) {
        const lba = node.prefix | BigInt(index);
        required(lba <= CADR_M10_MAX_LBA, "tree references an out-of-range LBA");
        const page = mapGetVerified(store.pages, child, "page");
        const pageHash = await cadrM10Sha256(page);
        if (interleaveGuard !== null) interleaveGuard();
        required(page.byteLength === 1024 && equalBytes(pageHash, child), "page immutable hash mismatch");
        entries += 1n;
      } else queue.push({ hash: child, level: node.level - 1, prefix: nodeChildPrefix(node.level, node.prefix, index) });
    }
  }
  return entries;
}

async function validateManifestBinding(store, manifestHash, config) {
  const manifest = await parseStoredManifest(store, manifestHash); let lineage = manifest; const seen = new Set();
  while (true) {
    const key = hashKey(lineage.hash); required(!seen.has(key), "manifest parent lineage has a cycle"); seen.add(key);
    required(equalBytes(lineage.diskUuid, config.diskUuid) && equalBytes(lineage.baseSha256, config.baseSha256) &&
      equalBytes(lineage.profileSha256, config.profileSha256) && equalBytes(lineage.artifactSetSha256, config.artifactSetSha256),
    "manifest binding differs from opened disk");
    if (lineage.generation === 0n) {
      required(lineage.parentGeneration === 0n && isZeroHash(lineage.parentManifestSha256), "genesis manifest parent");
      break;
    }
    const parent = await parseStoredManifest(store, lineage.parentManifestSha256);
    required(parent.generation === lineage.parentGeneration && parent.generation < lineage.generation,
      "manifest parent generation mismatch");
    lineage = parent;
  }
  const entries = await verifyTree(store, manifest.rootSha256);
  required(entries === manifest.entryCount, "manifest entry count does not equal reachable map");
  return manifest;
}

async function validateHeadCandidate(store, config, headBytes, requireActivation) {
  const head = await parseCdrOvh1(headBytes);
  required(equalBytes(head.diskUuid, config.diskUuid) && equalBytes(head.baseSha256, config.baseSha256) &&
    equalBytes(head.profileSha256, config.profileSha256), "head binding differs from opened disk");
  if (requireActivation) {
    const activationKey = `${uuidKey(config.diskUuid)}:${head.headSeq}`;
    const active = store.activations.get(activationKey);
    required(activationRecordIsCanonical(parseActivationKey(activationKey), active) &&
      equalBytes(active.headBytes, head.bytes), "head lacks identical activation record");
  }
  const activeManifest = await validateManifestBinding(store, head.activeManifestSha256, config);
  required(activeManifest.generation === head.activeGeneration && equalBytes(activeManifest.rootSha256, head.activeRootSha256),
    "head active fields do not bind active manifest");
  return Object.freeze({ head, manifest: activeManifest });
}

async function recoverRecord(store, record) {
  const config = record.config; const diskKey = record.key; const candidates = [];
  required(store.activations.size <= CADR_M10_MAX_ACTIVATION_RECORDS,
    "activation volume exceeds the bounded recovery scan", CadrM10RecoveryError);
  const current = store.heads.get(diskKey);
  if (current !== undefined) candidates.push({ bytes: current, requireActivation: true, source: "head" });
  /* The current head's redundant previous binding is tried before older activations. */
  try {
    if (current !== undefined) {
      const parsed = await parseCdrOvh1(current);
      if (!isZeroHash(parsed.previousManifestSha256)) {
        const previousManifest = await parseStoredManifest(store, parsed.previousManifestSha256);
        const fallback = await serializeCdrOvh1({
          headSeq: parsed.headSeq, writerEpoch: parsed.writerEpoch, diskUuid: parsed.diskUuid,
          activeGeneration: parsed.previousGeneration, activeManifestSha256: parsed.previousManifestSha256,
          activeRootSha256: parsed.previousRootSha256, previousGeneration: 0n,
          baseSha256: parsed.baseSha256, profileSha256: parsed.profileSha256,
        });
        /* Preserve the candidate even if its untrusted head has a broken active half. */
        candidates.push({ bytes: fallback, requireActivation: false, source: "previous" });
        void previousManifest;
      }
    }
  } catch { /* corrupt current head simply has no previous hint */ }
  const activations = [];
  for (const [key, activation] of [...store.activations.entries()]) {
    const keyInfo = parseActivationKey(key);
    if (!activationRecordIsCanonical(keyInfo, activation)) {
      store.activations.delete(key);
      store.activation_quarantine.set(key, activation);
      continue;
    }
    if (keyInfo.diskKey === diskKey) activations.push({ key, sequence: keyInfo.sequence, activation });
  }
  activations.sort((left, right) => left.sequence === right.sequence ? 0 :
    (left.sequence > right.sequence ? -1 : 1));
  for (const item of activations) {
    candidates.push({ bytes: item.activation.headBytes, requireActivation: true, source: "activation" });
  }
  let firstError = null;
  for (const candidate of candidates) {
    try {
      const accepted = await validateHeadCandidate(store, config, candidate.bytes, candidate.requireActivation);
      const recovered = candidate.source !== "head";
      record.runtime = { state: recovered ? CADR_M10_STATE_RECOVERY_REQUIRED : CADR_M10_STATE_CLEAN,
        paused: false, readOnly: recovered, head: accepted.head, manifest: accepted.manifest,
        workingRootSha256: accepted.manifest.rootSha256, activeWriterEpoch: null };
      return record.runtime;
    } catch (error) { firstError ??= error; }
  }
  throw new CadrM10RecoveryError(`C-M10: no valid activated generation (${firstError?.message ?? "no activation"})`);
}

async function makeEmptyRoot(store) {
  const bytes = await serializeCdrOvn1({ level: 2, prefix: 0n,
    children: Array.from({ length: 256 }, () => ZERO_HASH) });
  const parsed = await parseCdrOvn1(bytes); mapCas(store.nodes, bytes, parsed.hash, "node");
  return parsed.hash;
}

async function insertPrivate(store, privatePages, privateNodes) {
  for (const [key, bytes] of privatePages) {
    const hash = await cadrM10Sha256(bytes); required(key === hashKey(hash), "private page key/hash mismatch");
    mapCas(store.pages, bytes, hash, "page");
  }
  for (const [key, bytes] of privateNodes) {
    const parsed = await parseCdrOvn1(bytes); required(key === hashKey(parsed.hash), "private node key/hash mismatch");
    mapCas(store.nodes, bytes, parsed.hash, "node");
  }
}

async function privateNode(store, privateNodes, hash, level, prefix) {
  if (isZeroHash(hash)) return { level, prefix, children: Array.from({ length: 256 }, () => ZERO_HASH) };
  const key = hashKey(hash); const local = privateNodes.get(key);
  const parsed = local === undefined ? await parseStoredNode(store, hash) : await parseCdrOvn1(local);
  required(parsed.level === level && parsed.prefix === prefix, "map update encountered malformed path node");
  return { level: parsed.level, prefix: parsed.prefix, children: parsed.children.map((child) => child.slice()) };
}

async function makePrivateNode(privateNodes, level, prefix, children) {
  const bytes = await serializeCdrOvn1({ level, prefix, children }); const parsed = await parseCdrOvn1(bytes);
  privateNodes.set(hashKey(parsed.hash), bytes); return parsed.hash;
}

async function updatePath(store, rootHash, lba, pageHash, emptyRootHash, privateNodes) {
  async function update(hash, level, prefix) {
    const node = await privateNode(store, privateNodes, hash, level, prefix);
    const index = lbaByte(lba, level); const previous = node.children[index];
    const next = level === 0 ? pageHash : await update(previous, level - 1, nodeChildPrefix(level, prefix, index));
    if (equalBytes(previous, next)) return hash;
    node.children[index] = next;
    if (allZero(node.children)) return level === 2 ? emptyRootHash : ZERO_HASH;
    return makePrivateNode(privateNodes, level, prefix, node.children);
  }
  return update(rootHash, 2, 0n);
}

async function lookupPage(store, rootHash, lba, privateNodes = null, interleaveGuard = null) {
  let hash = rootHash;
  for (let level = 2; level >= 0; level -= 1) {
    const local = privateNodes?.get(hashKey(hash));
    const node = local === undefined ? await parseStoredNode(store, hash) : await parseCdrOvn1(local);
    if (interleaveGuard !== null) interleaveGuard();
    const child = node.children[lbaByte(lba, level)];
    if (isZeroHash(child)) return ZERO_HASH;
    if (level === 0) return child;
    hash = child;
  }
  return ZERO_HASH;
}

function gcRoots(store) {
  const roots = [];
  for (const record of store.disks.values()) {
    const head = record.runtime?.head;
    if (head !== undefined) {
      roots.push({ type: "manifest", hash: head.activeManifestSha256 });
      if (!isZeroHash(head.previousManifestSha256)) roots.push({ type: "manifest", hash: head.previousManifestSha256 });
    }
  }
  for (const reference of store.refs.values()) roots.push({ type: "node", hash: reference.rootSha256 });
  return roots;
}

function beginRootMutation(coordinator, store) {
  coordinator.rootEpoch += 1n;
  coordinator.rootMutations += 1;
  coordinator.state = null;
  store.gc_marks.clear();
}

function endRootMutation(coordinator) {
  required(coordinator.rootMutations > 0, "global root-mutation accounting underflow");
  coordinator.rootMutations -= 1;
}

async function collectGarbage(store, coordinator, budget) {
  required(Number.isSafeInteger(budget) && budget > 0, "GC budget must be a positive safe integer");
  if (coordinator.rootMutations !== 0) {
    return Object.freeze({ complete: false, steps: 0, phase: "blocked", invalidated: true });
  }
  required(!coordinator.invocationActive, "another backend-global GC invocation is active",
    CadrM10ConflictError);
  coordinator.invocationActive = true;
  try {
    if (coordinator.state === null) {
      const epoch = coordinator.rootEpoch;
      store.gc_marks.clear();
      coordinator.state = { epoch, phase: "mark", queue: gcRoots(store), sweep: null };
    }
    const gc = coordinator.state; let steps = 0;
    const invalidated = () => coordinator.rootMutations !== 0 ||
      coordinator.rootEpoch !== gc.epoch || coordinator.state !== gc;
    while (steps < budget && coordinator.state === gc) {
      if (invalidated()) {
        coordinator.state = null;
        store.gc_marks.clear();
        return Object.freeze({ complete: false, steps, phase: "invalidated", invalidated: true });
      }
      if (gc.phase === "mark") {
        const item = gc.queue.pop();
        if (item === undefined) {
          gc.phase = "sweep"; gc.sweep = { kind: 0, keys: [...store.pages.keys()], index: 0 };
          continue;
        }
        const markKey = `${item.type}:${hashKey(item.hash)}`;
        if (store.gc_marks.has(markKey)) { steps += 1; continue; }
        store.gc_marks.add(markKey);
        if (item.type === "manifest") {
          const manifest = await parseStoredManifest(store, item.hash);
          if (invalidated()) continue;
          gc.queue.push({ type: "node", hash: manifest.rootSha256 });
          if (!isZeroHash(manifest.parentManifestSha256)) {
            gc.queue.push({ type: "manifest", hash: manifest.parentManifestSha256 });
          }
        } else if (item.type === "node") {
          const node = await parseStoredNode(store, item.hash);
          if (invalidated()) continue;
          for (const child of node.children) if (!isZeroHash(child)) {
            gc.queue.push({ type: node.level === 0 ? "page" : "node", hash: child });
          }
        }
        steps += 1;
      } else {
        const tables = [store.pages, store.nodes, store.manifests];
        const labels = ["page", "node", "manifest"];
        const current = gc.sweep;
        if (current.kind >= tables.length) { coordinator.state = null; break; }
        if (current.index >= current.keys.length) {
          current.kind += 1;
          current.keys = current.kind < tables.length ? [...tables[current.kind].keys()] : [];
          current.index = 0;
          continue;
        }
        if (invalidated()) continue;
        const key = current.keys[current.index++];
        if (!store.gc_marks.has(`${labels[current.kind]}:${key}`)) tables[current.kind].delete(key);
        steps += 1;
      }
    }
    if (coordinator.rootMutations !== 0 || coordinator.rootEpoch !== gc.epoch) {
      coordinator.state = null;
      store.gc_marks.clear();
      return Object.freeze({ complete: false, steps, phase: "invalidated", invalidated: true });
    }
    return Object.freeze({ complete: coordinator.state === null, steps,
      phase: coordinator.state?.phase ?? "idle", invalidated: false });
  } finally {
    coordinator.invocationActive = false;
  }
}

/**
 * A deterministic, test-only persistence backend.  It deliberately exposes its
 * maps so a test can model torn writes, but those maps are never a disk image.
 */
export function createCadrM10MemoryBackend({ faultInjector = null } = {}) {
  required(faultInjector === null || typeof faultInjector === "function", "fault injector must be a function");
  const store = Object.freeze({ meta: new Map(), disks: new Map(), pages: new Map(), nodes: new Map(),
    manifests: new Map(), heads: new Map(), activations: new Map(), activation_quarantine: new Map(),
    refs: new Map(), gc_marks: new Set() });
  const gcCoordinator = {
    rootEpoch: 0n, rootMutations: 0, state: null, invocationActive: false,
  };

  async function withRootMutation(operation) {
    beginRootMutation(gcCoordinator, store);
    try { return await operation(); } finally { endRootMutation(gcCoordinator); }
  }

  function issueSession(record) {
    required(record.sessionHighWater < MAX_U64, "open-session token exhausted",
      CadrM10RecoveryError);
    record.sessionHighWater += 1n;
    record.activeSession = record.sessionHighWater;
    if (record.runtime !== null) record.runtime.activeWriterEpoch = null;
    return record.activeSession;
  }

  async function fault(seam, context) {
    const result = faultInjector === null ? undefined : await faultInjector({ seam, ...context });
    if (result === true || result === "fail") throw new CadrM10InjectedFault(seam);
  }

  async function initializeDisk(configValue) {
    const config = checkedConfig(configValue); const key = uuidKey(config.diskUuid);
    required(!store.disks.has(key), "disk UUID is already initialized", CadrM10ConflictError);
    /*
     * Reserve the canonical record before the first await.  A concurrent caller
     * must observe this exact record rather than build a detached same-UUID disk.
     */
    const record = { key, config, phase: RECORD_PHASE_INITIALIZING,
      emptyRootHash: null, highWater: 0n, writerHighWater: 0n,
      sessionHighWater: 0n, refHighWater: 0n, activeSession: 0n,
      commitInFlight: false, runtime: null };
    store.disks.set(key, record);
    store.meta.set(key, { schema: "cadr-m10-memory-meta-v1",
      phase: RECORD_PHASE_INITIALIZING, highWater: 0n,
      writerHighWater: 0n, sessionHighWater: 0n, refHighWater: 0n });
    return withRootMutation(async () => {
      try {
        required(store.disks.get(key) === record, "disk initialization reservation changed",
          CadrM10ConflictError);
        const emptyRootHash = await makeEmptyRoot(store);
        record.emptyRootHash = emptyRootHash;
        const genesisBytes = await serializeCdrOvm1({ generation: 0n, parentGeneration: 0n, entryCount: 0n,
          diskUuid: config.diskUuid, baseSha256: config.baseSha256, profileSha256: config.profileSha256,
          artifactSetSha256: config.artifactSetSha256, rootSha256: emptyRootHash });
        const genesis = await parseCdrOvm1(genesisBytes); mapCas(store.manifests, genesisBytes, genesis.hash, "manifest");
        const headBytes = await serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n, diskUuid: config.diskUuid,
          activeGeneration: 0n, activeManifestSha256: genesis.hash, activeRootSha256: emptyRootHash,
          previousGeneration: 0n, baseSha256: config.baseSha256, profileSha256: config.profileSha256 });
        store.heads.set(key, headBytes.slice());
        store.activations.set(`${key}:1`, cloneActivation({ diskUuid: config.diskUuid, headSeq: 1n, headBytes }));
        await recoverRecord(store, record);
        const sessionToken = issueSession(record);
        const metadata = store.meta.get(key);
        required(metadata !== undefined, "initialization metadata disappeared",
          CadrM10RecoveryError);
        metadata.sessionHighWater = sessionToken;
        metadata.phase = RECORD_PHASE_OPEN;
        record.phase = RECORD_PHASE_OPEN;
        return diskApi(record, sessionToken);
      } catch (error) {
        if (store.disks.get(key) === record &&
          record.phase === RECORD_PHASE_INITIALIZING) {
          record.runtime = null;
          record.activeSession = 0n;
          store.disks.delete(key); store.meta.delete(key); store.heads.delete(key);
          for (const activationKey of [...store.activations.keys()]) {
            if (activationKey.startsWith(`${key}:`)) store.activations.delete(activationKey);
          }
          for (const [referenceId, reference] of [...store.refs.entries()]) {
            if (reference !== null && typeof reference === "object" &&
              bytesOf(reference.diskUuid) !== null &&
              equalBytes(bytesOf(reference.diskUuid), config.diskUuid)) {
              store.refs.delete(referenceId);
            }
          }
        }
        throw error;
      }
    });
  }

  async function reopenDisk(configValue) {
    const config = checkedConfig(configValue); const record = recordFor(store, uuidKey(config.diskUuid));
    required(record.phase === RECORD_PHASE_OPEN,
      "disk initialization has not committed", CadrM10ConflictError);
    required(equalBytes(record.config.baseSha256, config.baseSha256) && equalBytes(record.config.profileSha256, config.profileSha256) &&
      equalBytes(record.config.artifactSetSha256, config.artifactSetSha256), "reopen binding differs from initialized disk", CadrM10RecoveryError);
    required(!record.commitInFlight, "cannot reopen during an active commit", CadrM10ConflictError);
    return withRootMutation(async () => {
      const sessionToken = issueSession(record); /* Invalidates old handles before the first await. */
      store.meta.get(record.key).sessionHighWater = sessionToken;
      record.config = config; /* base reader is a deliberate nonpersistent host binding. */
      if (record.writerHighWater === MAX_U64) throw new CadrM10RecoveryError("C-M10: writer epoch exhausted");
      record.writerHighWater += 1n; store.meta.get(record.key).writerHighWater = record.writerHighWater;
      await recoverRecord(store, record);
      return diskApi(record, sessionToken);
    });
  }

  function diskApi(record, sessionToken) {
    const ensureSession = () => {
      required(record.activeSession === sessionToken, "stale open-session handle",
        CadrM10ConflictError);
    };
    const runtime = () => {
      ensureSession();
      required(record.runtime !== null, "disk is not open", CadrM10RecoveryError);
      return record.runtime;
    };
    const requireLease = (epoch) => {
      const current = runtime();
      required(!current.readOnly && current.state !== CADR_M10_STATE_RECOVERY_REQUIRED, "recovered disk is read-only", CadrM10RecoveryError);
      uint64(epoch, "writer epoch");
      required(current.activeWriterEpoch === epoch && epoch === record.writerHighWater, "stale writer epoch", CadrM10ConflictError);
      return current;
    };
    return Object.freeze({
      get diskUuid() { ensureSession(); return record.config.diskUuid.slice(); },
      get state() { return runtime().state; }, get readOnly() { return runtime().readOnly; },
      get paused() { return runtime().paused; },
      get generation() { return runtime().manifest.generation; }, get headSeq() { return runtime().head.headSeq; },
      get writerEpoch() { return runtime().head.writerEpoch; }, get rootSha256() { return runtime().manifest.rootSha256.slice(); },
      get workingRootSha256() { return runtime().workingRootSha256.slice(); },
      beginWriter() {
        const current = runtime();
        required(!current.readOnly && current.state !== CADR_M10_STATE_RECOVERY_REQUIRED, "recovered disk is read-only", CadrM10RecoveryError);
        required(current.state === CADR_M10_STATE_CLEAN && !current.paused,
          "disk is not clean for a writer", CadrM10ConflictError);
        required(current.activeWriterEpoch === null, "another writer epoch is active", CadrM10ConflictError);
        required(record.writerHighWater < MAX_U64, "writer epoch exhausted", CadrM10ConflictError);
        record.writerHighWater += 1n; store.meta.get(record.key).writerHighWater = record.writerHighWater;
        current.activeWriterEpoch = record.writerHighWater; return record.writerHighWater;
      },
      closeWriter(epoch) { const current = requireLease(epoch); current.activeWriterEpoch = null; },
      async readBlock(lba) {
        exactLba(lba);
        const current = runtime(); const sessionConfig = record.config;
        const pageHash = await lookupPage(store, current.manifest.rootSha256, lba,
          null, ensureSession);
        ensureSession();
        if (isZeroHash(pageHash)) {
          const base = await exactBasePage(sessionConfig, lba);
          ensureSession();
          return base;
        }
        const page = mapGetVerified(store.pages, pageHash, "page");
        const verifiedHash = await cadrM10Sha256(page);
        ensureSession();
        required(equalBytes(verifiedHash, pageHash), "page immutable hash mismatch");
        ensureSession();
        return page;
      },
      async commit({ writerEpoch, writes, expectedHeadSeq = runtime().head.headSeq, onCoreCompletion = null } = {}) {
        const current = requireLease(writerEpoch);
        required(current.state === CADR_M10_STATE_CLEAN && !current.paused,
          "disk is not clean for commit", CadrM10ConflictError);
        required(!record.commitInFlight, "another commit is already active", CadrM10ConflictError);
        uint64(expectedHeadSeq, "expected head sequence");
        required(expectedHeadSeq === current.head.headSeq, "head sequence conflict", CadrM10ConflictError);
        required(Array.isArray(writes) && writes.length > 0, "writes must be a nonempty array");
        required(onCoreCompletion === null || typeof onCoreCompletion === "function", "core completion callback must be a function");
        const context = { diskUuid: record.config.diskUuid.slice(), writerEpoch, expectedHeadSeq };
        let target = null; let activationPublished = false; let coreCompleted = false;
        let pendingRootHash = null;
        const assertStillCurrent = () => {
          ensureSession();
          required(record.commitInFlight && current.activeWriterEpoch === writerEpoch &&
            writerEpoch === record.writerHighWater, "writer/session changed during commit",
          CadrM10ConflictError);
          required(current.head.headSeq === expectedHeadSeq, "head changed during commit",
            CadrM10ConflictError);
          const storedHead = store.heads.get(record.key);
          required(storedHead instanceof Uint8Array && equalBytes(storedHead, current.head.bytes),
            "stored head changed during commit", CadrM10ConflictError);
          const activation = store.activations.get(`${record.key}:${current.head.headSeq}`);
          required(activationRecordIsCanonical(
            parseActivationKey(`${record.key}:${current.head.headSeq}`), activation) &&
            equalBytes(activation.headBytes, current.head.bytes),
          "active activation changed during commit", CadrM10ConflictError);
        };
        record.commitInFlight = true;
        beginRootMutation(gcCoordinator, store);
        try {
          try {
            await fault("before-validate", context);
            assertStillCurrent();
            required(current.head.headSeq < MAX_U64, "head sequence is exhausted",
              CadrM10ConflictError);
            let prior = -1n;
            const normalized = writes.map((write, index) => {
              required(write !== null && typeof write === "object", `write ${index} must be an object`);
              const lba = exactLba(write.lba); required(lba > prior, "writes must be in strictly increasing LBA order"); prior = lba;
              return { lba, bytes: copyExact(write.bytes, 1024, `write ${index} page`) };
            });
            await fault("after-validate", context); await fault("before-base-compare", context);
            const prepared = [];
            for (const write of normalized) prepared.push({ ...write, base: await exactBasePage(record.config, write.lba) });
            await fault("after-base-compare", context); await fault("before-build-private", context);
            let rootHash = current.manifest.rootSha256; let entryCount = current.manifest.entryCount;
            const privatePages = new Map(); const privateNodes = new Map();
            for (const write of prepared) {
              const oldHash = await lookupPage(store, rootHash, write.lba, privateNodes);
              const nextHash = equalBytes(write.bytes, write.base) ? ZERO_HASH : await cadrM10Sha256(write.bytes);
              if (equalBytes(oldHash, nextHash)) continue;
              if (!isZeroHash(nextHash)) privatePages.set(hashKey(nextHash), write.bytes);
              rootHash = await updatePath(store, rootHash, write.lba, nextHash, record.emptyRootHash, privateNodes);
              if (isZeroHash(oldHash) && !isZeroHash(nextHash)) entryCount += 1n;
              if (!isZeroHash(oldHash) && isZeroHash(nextHash)) entryCount -= 1n;
            }
            pendingRootHash = rootHash.slice();
            await fault("after-build-private", context);
            if (equalBytes(rootHash, current.manifest.rootSha256)) {
              return Object.freeze({ changed: false, generation: current.manifest.generation, headSeq: current.head.headSeq,
                rootSha256: rootHash.slice(), durable: true, recoveredAfterFault: false });
            }
            await fault("before-page-cas", context); await insertPrivate(store, privatePages, privateNodes); await fault("after-page-cas", context);
            await fault("before-core-completion", context);
            if (onCoreCompletion !== null) await onCoreCompletion();
            coreCompleted = true;
            await fault("after-core-completion", context);
            await fault("before-publish-dirty", context);
            current.state = CADR_M10_STATE_DIRTY;
            current.paused = true; current.workingRootSha256 = rootHash.slice(); await fault("after-publish-dirty", context);
            await fault("before-reserve-generation", context); required(record.highWater < MAX_U64, "generation high-water is exhausted", CadrM10ConflictError);
            const generation = ++record.highWater; store.meta.get(record.key).highWater = generation; await fault("after-reserve-generation", context);
            const manifestBytes = await serializeCdrOvm1({ generation, parentGeneration: current.manifest.generation, entryCount,
              diskUuid: record.config.diskUuid, baseSha256: record.config.baseSha256, profileSha256: record.config.profileSha256,
              artifactSetSha256: record.config.artifactSetSha256, parentManifestSha256: current.manifest.hash, rootSha256: rootHash });
            const manifest = await parseCdrOvm1(manifestBytes);
            await fault("before-manifest-cas", context); mapCas(store.manifests, manifestBytes, manifest.hash, "manifest");
            await parseStoredManifest(store, manifest.hash); await fault("after-manifest-cas", context);
            assertStillCurrent();
            const nextHeadBytes = await serializeCdrOvh1({ headSeq: current.head.headSeq + 1n, writerEpoch,
              diskUuid: record.config.diskUuid, activeGeneration: generation, activeManifestSha256: manifest.hash, activeRootSha256: rootHash,
              previousGeneration: current.head.activeGeneration, previousManifestSha256: current.head.activeManifestSha256,
              previousRootSha256: current.head.activeRootSha256, baseSha256: record.config.baseSha256, profileSha256: record.config.profileSha256 });
            const nextHead = await parseCdrOvh1(nextHeadBytes); target = { manifest, head: nextHead };
            await fault("before-head-activation", context);
            assertStillCurrent();
            const nextActivationKey = `${record.key}:${nextHead.headSeq}`;
            prepareActivationPublication(store, nextActivationKey);
            /* No await or external callback separates these two visible map updates. */
            store.heads.set(record.key, nextHeadBytes.slice());
            store.activations.set(nextActivationKey, cloneActivation({
              diskUuid: record.config.diskUuid,
              headSeq: nextHead.headSeq,
              headBytes: nextHeadBytes,
            }));
            activationPublished = true;
            await fault("after-head-activation", context); await fault("before-reread-head", context);
            const accepted = await validateHeadCandidate(store, record.config, store.heads.get(record.key), true);
            required(equalBytes(accepted.head.bytes, nextHead.bytes), "head reread differs from committed head");
            current.head = accepted.head; current.manifest = accepted.manifest; current.workingRootSha256 = accepted.manifest.rootSha256;
            await fault("after-reread-head", context); await fault("before-clean", context);
            current.state = CADR_M10_STATE_CLEAN; current.paused = false; await fault("after-clean", context);
            return Object.freeze({ changed: true, generation, headSeq: nextHead.headSeq, rootSha256: rootHash.slice(), durable: true, recoveredAfterFault: false });
          } catch (error) {
            /* A fault after the all-or-nothing publication is an uncertain result, not a failed save. */
            if (activationPublished && target !== null) {
              try {
                const accepted = await validateHeadCandidate(store, record.config, store.heads.get(record.key), true);
                if (equalBytes(accepted.head.activeManifestSha256, target.manifest.hash)) {
                  current.head = accepted.head; current.manifest = accepted.manifest; current.workingRootSha256 = accepted.manifest.rootSha256;
                  current.state = CADR_M10_STATE_CLEAN; current.paused = false;
                  return Object.freeze({ changed: true, generation: accepted.manifest.generation, headSeq: accepted.head.headSeq,
                    rootSha256: accepted.manifest.rootSha256.slice(), durable: true, recoveredAfterFault: true });
                }
              } catch { /* preserve original error below */ }
            }
            if (coreCompleted) {
              current.state = CADR_M10_STATE_SAVE_FAILED;
              current.paused = true;
              current.workingRootSha256 = pendingRootHash ?? current.workingRootSha256;
            } else {
              current.state = CADR_M10_STATE_CLEAN;
              current.paused = false;
              current.workingRootSha256 = current.manifest.rootSha256;
            }
            throw error;
          }
        } finally {
          endRootMutation(gcCoordinator);
          record.commitInFlight = false;
        }
      },
      async pinRoot(kind, rootSha256 = runtime().manifest.rootSha256) {
        ensureSession();
        required(["snapshot", "clone", "export"].includes(kind), "reference kind must be snapshot, clone, or export");
        const hash = copyExact(rootSha256, 32, "pinned root");
        const id = await withRootMutation(async () => {
          ensureSession();
          await verifyTree(store, hash, 2, 0n, ensureSession);
          ensureSession();
          required(record.refHighWater < MAX_U64, "root-reference identifier exhausted",
            CadrM10ConflictError);
          record.refHighWater += 1n;
          store.meta.get(record.key).refHighWater = record.refHighWater;
          const id = `${record.key}:${kind}:${record.refHighWater}`;
          ensureSession();
          const reference = Object.freeze({
            id, diskUuid: record.config.diskUuid.slice(), kind, rootSha256: hash,
          });
          try {
            store.refs.set(id, reference);
          } catch (error) {
            if (store.refs.get(id) === reference) store.refs.delete(id);
            throw error;
          }
          if (record.activeSession !== sessionToken) {
            if (store.refs.get(id) === reference) store.refs.delete(id);
            ensureSession();
          }
          return id;
        });
        /*
         * Publication is the linearization point.  A reopen after it cannot make
         * the successfully returned identifier into an unreachable leaked root.
         */
        return id;
      },
      async unpinRoot(id) {
        ensureSession();
        return withRootMutation(async () => {
          ensureSession();
          required(typeof id === "string", "unknown root reference");
          const reference = store.refs.get(id);
          required(reference !== undefined, "unknown root reference");
          required(reference !== null && typeof reference === "object" &&
            reference.id === id && equalBytes(copyExact(reference.diskUuid, 16,
              "root reference disk UUID"), record.config.diskUuid) &&
            ["snapshot", "clone", "export"].includes(reference.kind),
          "root reference is not owned by this disk", CadrM10ConflictError);
          ensureSession();
          required(store.refs.delete(id), "unknown root reference");
        });
      },
      collectGarbage({ budget = 1024 } = {}) {
        ensureSession();
        return collectGarbage(store, gcCoordinator, budget);
      },
      async reopen() { ensureSession(); return reopenDisk(record.config); },
    });
  }

  return Object.freeze({ store, initializeDisk, reopenDisk });
}
