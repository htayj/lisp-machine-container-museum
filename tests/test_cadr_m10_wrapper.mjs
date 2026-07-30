import assert from "node:assert/strict";

import { CADR_M10_BASE_SHA256, cadrM10Sha256 } from "../cadr-web/wasm/cadr-m10-persistence.mjs";
import {
  parseCdrM10W1,
  serializeCdrM10W1,
  validateCdrSnap1Structure,
} from "../cadr-web/wasm/cadr-m10-wrapper.mjs";

const TEXT = new TextEncoder();
const UUID = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
const SNAPSHOT = Uint8Array.from({ length: 16 }, (_, index) => index + 17);
const PROFILE = await cadrM10Sha256(TEXT.encode("M10 wrapper profile"));
const MANIFEST = await cadrM10Sha256(TEXT.encode("M10 wrapper manifest"));
const ROOT = await cadrM10Sha256(TEXT.encode("M10 wrapper root"));
const ZERO = new Uint8Array(32);
const SNAP_PROFILE = Uint8Array.from(
  "1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a"
    .match(/../g), (value) => Number.parseInt(value, 16));
const SNAP_ARTIFACTS = Uint8Array.from(
  "e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941"
    .match(/../g), (value) => Number.parseInt(value, 16));

async function structuralSnapshot({ optionalTypeZero = false } = {}) {
  const types = optionalTypeZero
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const directoryOffset = 264;
  const directoryBytes = types.length * 64;
  const payloadOffset = directoryOffset + directoryBytes;
  const bytes = new Uint8Array(payloadOffset + 32);
  const view = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRSNAP1"), 0);
  view.setUint16(8, 1, true); view.setUint16(10, 2, true);
  view.setUint32(12, 264, true); view.setUint32(16, 0, true);
  view.setUint32(20, types.length, true); view.setUint32(24, 64, true);
  view.setUint32(28, 0, true); view.setBigUint64(32, BigInt(bytes.byteLength), true);
  view.setBigUint64(40, 264n, true); view.setBigUint64(48, BigInt(directoryBytes), true);
  view.setBigUint64(56, BigInt(payloadOffset), true);
  view.setUint32(64, 1, true); view.setUint32(68, 0, true);
  view.setUint32(72, 0, true); view.setUint32(76, 0, true);
  view.setBigUint64(80, 0n, true); view.setBigUint64(88, 7n, true);
  bytes.set(SNAP_PROFILE, 104); bytes.set(SNAP_ARTIFACTS, 136);
  const emptyHash = await cadrM10Sha256(new Uint8Array());
  for (let index = 0; index < types.length; index += 1) {
    const offset = directoryOffset + index * 64;
    view.setUint32(offset, types[index], true);
    view.setUint32(offset + 4, types[index] === 0 ? 0 : 1, true);
    view.setBigUint64(offset + 8, BigInt(payloadOffset), true);
    view.setBigUint64(offset + 16, 0n, true);
    view.setBigUint64(offset + 24, 0n, true);
    bytes.set(emptyHash, offset + 32);
  }
  bytes.set(await cadrM10Sha256(bytes.subarray(directoryOffset, payloadOffset)), 232);
  bytes.set(await cadrM10Sha256(bytes.subarray(0, bytes.byteLength - 32)),
    bytes.byteLength - 32);
  return bytes;
}

async function m5Envelope(raw, { flags = 0, ordinal = 0n, boundary = 0n,
  witness = ZERO } = {}) {
  const bytes = new Uint8Array(104 + raw.byteLength); const view = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRM5WK1"), 0); view.setUint32(8, 3, true);
  view.setUint32(12, flags, true); view.setBigUint64(16, BigInt(raw.byteLength), true);
  view.setBigUint64(24, ordinal, true); view.setBigUint64(32, boundary, true);
  bytes.set(witness, 40); bytes.set(raw, 104);
  const input = new Uint8Array(72 + raw.byteLength);
  input.set(bytes.subarray(0, 72)); input.set(raw, 72);
  bytes.set(await cadrM10Sha256(input), 72);
  return bytes;
}

const semanticValidator = async (raw, control) => {
  const structure = await validateCdrSnap1Structure(raw);
  assert.ok(structure.chunkCount === 10 || structure.chunkCount === 11);
  assert.equal(control.structure.clockSlotsCompleted, 7n);
  return true;
};

const raw = await structuralSnapshot();
const inner = await m5Envelope(raw);
const fields = {
  diskUuid: UUID, snapshotUuid: SNAPSHOT, durableGeneration: 7n, headSeq: 8n,
  manifestSha256: MANIFEST, rootSha256: ROOT, baseSha256: CADR_M10_BASE_SHA256,
  profileSha256: PROFILE, inner,
};
const options = { validateInnerSnapshot: semanticValidator };
const wrapper = await serializeCdrM10W1(fields, options);
assert.equal(wrapper.byteLength, 256 + inner.byteLength);
const parsed = await parseCdrM10W1(wrapper, options);
assert.equal(parsed.durableGeneration, 7n);
assert.equal(parsed.headSeq, 8n);
assert.deepEqual(parsed.inner, inner);

const mutableInner = await m5Envelope(raw);
const frozenInner = mutableInner.slice();
const toctouWrapper = await serializeCdrM10W1({ ...fields, inner: mutableInner }, {
  validateInnerSnapshot: async (validatorBytes) => {
    await Promise.resolve();
    mutableInner[104] ^= 0xff;
    validatorBytes[0] ^= 0xff;
    return true;
  },
});
const toctouParsed = await parseCdrM10W1(toctouWrapper, options);
assert.deepEqual(toctouParsed.inner, frozenInner,
  "serialization emits the exact M5 bytes snapshotted before async validation");
assert.notDeepEqual(mutableInner, frozenInner,
  "the malicious callback did mutate the caller-owned input");

const optionalZeroRaw = await structuralSnapshot({ optionalTypeZero: true });
const optionalZeroStructure = await validateCdrSnap1Structure(optionalZeroRaw);
assert.equal(optionalZeroStructure.chunkCount, 11);
const optionalZeroInner = await m5Envelope(optionalZeroRaw);
const optionalZeroWrapper = await serializeCdrM10W1({
  ...fields, inner: optionalZeroInner,
}, options);
assert.deepEqual((await parseCdrM10W1(optionalZeroWrapper, options)).inner,
  optionalZeroInner,
  "selected-core-compatible first optional type zero precedes required types 1..10");

await assert.rejects(serializeCdrM10W1(fields), /mandatory worker\/core/);
await assert.rejects(parseCdrM10W1(wrapper), /mandatory worker\/core/);
await assert.rejects(
  serializeCdrM10W1({ ...fields, inner: await m5Envelope(Uint8Array.of(1, 2, 3)) },
    { validateInnerSnapshot: async () => true }),
  /CDRSNAP1/,
  "an accepting injection cannot make arbitrary bytes a snapshot",
);
await assert.rejects(
  serializeCdrM10W1(fields, { validateInnerSnapshot: async () => false }),
  /worker\/core rejected/,
);
await assert.rejects(serializeCdrM10W1({ ...fields, manifestSha256: ZERO }, options),
  /nonzero/);
await assert.rejects(serializeCdrM10W1({ ...fields, rootSha256: ZERO }, options),
  /nonzero/);
await assert.rejects(serializeCdrM10W1({ ...fields, headSeq: 0n }, options),
  /sequence zero/);

const corrupt = wrapper.slice(); corrupt[224] ^= 1;
await assert.rejects(parseCdrM10W1(corrupt, options), /immutable hash mismatch/);
const badInner = wrapper.slice(); badInner[256] ^= 1;
await assert.rejects(parseCdrM10W1(badInner, options), /immutable hash mismatch/);
const badFlag = wrapper.slice(); new DataView(badFlag.buffer).setUint32(16, 0, true);
await assert.rejects(parseCdrM10W1(badFlag, options), /flags/);

const invalidWitness = await m5Envelope(raw, {
  flags: 2, ordinal: 0n, boundary: 0n, witness: Uint8Array.from({ length: 32 }, () => 1),
});
await assert.rejects(serializeCdrM10W1({ ...fields, inner: invalidWitness }, options),
  /control witness/);

const badStructure = raw.slice();
new DataView(badStructure.buffer).setUint32(264, 2, true);
await assert.rejects(validateCdrSnap1Structure(badStructure), /directory hash|order/);

console.log("cadr_m10_wrapper.mjs: ok");
