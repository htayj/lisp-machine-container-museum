/* Exact source-only ABI1.11 audio records.  These helpers own no AudioContext,
 * Worker, guest clock, or media authority. */
export const CADR_M13_AUDIO_PROFILE =
  "USIM-SDL3-SINE-330D8248-CANONICAL-v1";
export const CADR_M13_PCM_MAGIC = "CDRPCM1\0";
export const CADR_M13_PCM_HEADER_BYTES = 64;
export const CADR_M13_PCM_MAX_FRAMES = 512;
export const CADR_M13_PCM_RATE = 8000;
export const CADR_M13_PCM_CHANNELS = 1;
export const CADR_M13_PCM_FORMAT_S16LE = 1;
export const CADR_M13_PCM_RENDERER_PROFILE = 2;

const MAX_U64 = 0xffff_ffff_ffff_ffffn;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const u64 = value => typeof value === "bigint" && value > 0n && value <= MAX_U64;
const sequence = value => typeof value === "bigint" && value >= 0n && value <= MAX_U64;
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

function bytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

export function parseCdrM11Open1(value) {
  const source = bytes(value);
  if (source === null || source.byteLength !== 48) return null;
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  if (decoder.decode(source.subarray(0, 8)) !== "CDRM11O1" ||
      view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 48) return null;
  const queuedFrames64 = view.getBigUint64(32, true);
  const result = Object.freeze({ generation: view.getBigUint64(16, true),
    consumerEpoch: view.getBigUint64(24, true), queuePackets: view.getUint32(40, true),
    queuedFrames: Number(queuedFrames64), rendererProfile: view.getUint32(44, true) });
  return u64(result.generation) && u64(result.consumerEpoch) &&
    result.queuePackets <= 64 && queuedFrames64 <= 64n * 512n &&
    result.rendererProfile === CADR_M13_PCM_RENDERER_PROFILE ? result : null;
}

export function encodeCdrPcm1({ generation, consumerEpoch, sequence: sequenceValue,
  frameOffset, samples }) {
  const sampleBytes = bytes(samples);
  if (!u64(generation) || !u64(consumerEpoch) || !sequence(sequenceValue) ||
      !u32(frameOffset) || sampleBytes === null || sampleBytes.byteLength < 2 ||
      sampleBytes.byteLength > CADR_M13_PCM_MAX_FRAMES * 2 ||
      sampleBytes.byteLength % 2 !== 0) throw new TypeError("invalid CDRPCM1 fields");
  const frameCount = sampleBytes.byteLength / 2;
  if (frameOffset > 512 || frameOffset + frameCount > 512) {
    throw new TypeError("CDRPCM1 frame range exceeds one M11 packet");
  }
  const output = new Uint8Array(CADR_M13_PCM_HEADER_BYTES + sampleBytes.byteLength);
  output.set(encoder.encode(CADR_M13_PCM_MAGIC), 0);
  const view = new DataView(output.buffer);
  view.setUint16(8, 1, true); view.setUint16(10, CADR_M13_PCM_HEADER_BYTES, true);
  view.setUint32(12, 0, true); view.setUint32(16, output.byteLength, true);
  view.setUint32(20, CADR_M13_PCM_RATE, true); view.setBigUint64(24, generation, true);
  view.setBigUint64(32, consumerEpoch, true); view.setBigUint64(40, sequenceValue, true);
  view.setUint32(48, frameOffset, true); view.setUint32(52, frameCount, true);
  view.setUint16(56, CADR_M13_PCM_CHANNELS, true);
  view.setUint16(58, CADR_M13_PCM_FORMAT_S16LE, true);
  view.setUint32(60, CADR_M13_PCM_RENDERER_PROFILE, true);
  output.set(sampleBytes, CADR_M13_PCM_HEADER_BYTES);
  return output.buffer;
}

export function parseCdrPcm1(value) {
  const source = bytes(value);
  if (source === null || source.byteLength < 66 || source.byteLength > 1088) return null;
  const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const generation = view.getBigUint64(24, true);
  const consumerEpoch = view.getBigUint64(32, true);
  const sequenceValue = view.getBigUint64(40, true);
  const frameOffset = view.getUint32(48, true);
  const frameCount = view.getUint32(52, true);
  if (decoder.decode(source.subarray(0, 8)) !== CADR_M13_PCM_MAGIC ||
      view.getUint16(8, true) !== 1 || view.getUint16(10, true) !== 64 ||
      view.getUint32(12, true) !== 0 || view.getUint32(16, true) !== source.byteLength ||
      view.getUint32(20, true) !== CADR_M13_PCM_RATE || !u64(generation) ||
      !u64(consumerEpoch) || !sequence(sequenceValue) || frameCount < 1 ||
      frameCount > CADR_M13_PCM_MAX_FRAMES || source.byteLength !== 64 + frameCount * 2 ||
      frameOffset > 512 || frameOffset + frameCount > 512 ||
      view.getUint16(56, true) !== CADR_M13_PCM_CHANNELS ||
      view.getUint16(58, true) !== CADR_M13_PCM_FORMAT_S16LE ||
      view.getUint32(60, true) !== CADR_M13_PCM_RENDERER_PROFILE) return null;
  return Object.freeze({ generation, consumerEpoch, sequence: sequenceValue, frameOffset,
    frameCount, samples: source.slice(64).buffer });
}

export async function sha256Hex(value, subtle = globalThis.crypto?.subtle) {
  const source = bytes(value);
  if (source === null || subtle?.digest === undefined) throw new TypeError("SHA-256 unavailable");
  const digest = new Uint8Array(await subtle.digest("SHA-256", source));
  return [...digest].map(item => item.toString(16).padStart(2, "0")).join("");
}
