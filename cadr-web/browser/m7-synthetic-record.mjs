/*
 * Deterministic, non-media M7 display input for the browser host and its
 * tests.  It deliberately contains only a generated one-bit checkerboard;
 * it is not a captured CADR display record.
 */

import {
  CADR_DISPLAY_ACTIVE_WORDS,
  CADR_DISPLAY_FLAG_FULL,
  CADR_DISPLAY_FLAG_ZERO_IS_BLACK,
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_WIDTH,
} from "../wasm/cadr-display-renderer.mjs";

const HEADER_BYTES = 80;
const RECTANGLE_BYTES = 16;
const MAX_U64 = 0xffffffffffffffffn;

/**
 * Return a full CDRDISP1 record whose displayed pixels alternate black and
 * white at every CADR source pixel.  With BOW disabled, zero is black, so
 * (0, 0) is black and its neighbour is white.
 */
export function createSyntheticCdrDisp1({
  machineGeneration = 1n,
  framebufferGeneration = 1n,
} = {}) {
  if (typeof machineGeneration !== "bigint" || machineGeneration < 1n ||
      machineGeneration > MAX_U64 ||
      typeof framebufferGeneration !== "bigint" || framebufferGeneration < 1n ||
      framebufferGeneration > MAX_U64) {
    throw new RangeError("synthetic display generations must be positive u64 bigint values");
  }

  const wordCount = CADR_DISPLAY_ACTIVE_WORDS;
  const bytes = new Uint8Array(HEADER_BYTES + RECTANGLE_BYTES + wordCount * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRDISP1"));
  view.setUint16(8, 1, true);
  view.setUint16(10, HEADER_BYTES, true);
  view.setUint32(12, CADR_DISPLAY_FLAG_FULL | CADR_DISPLAY_FLAG_ZERO_IS_BLACK, true);
  view.setBigUint64(16, machineGeneration, true);
  view.setBigUint64(24, framebufferGeneration, true);
  view.setUint32(32, CADR_DISPLAY_WIDTH, true);
  view.setUint32(36, CADR_DISPLAY_HEIGHT, true);
  view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true);
  view.setUint32(48, CADR_DISPLAY_ACTIVE_WORDS, true);
  view.setUint32(52, 0, true);
  view.setUint32(56, 1, true);
  view.setUint32(60, wordCount, true);
  view.setBigUint64(64, BigInt(wordCount * 4), true);
  view.setBigUint64(72, BigInt(bytes.byteLength), true);
  view.setUint32(80, 0, true);
  view.setUint32(84, 0, true);
  view.setUint32(88, CADR_DISPLAY_WIDTH, true);
  view.setUint32(92, CADR_DISPLAY_HEIGHT, true);

  /* CADR words are least-significant-bit-first.  The alternating constants
   * keep the pixel-grid test simple while exercising that bit ordering. */
  let offset = HEADER_BYTES + RECTANGLE_BYTES;
  for (let y = 0; y < CADR_DISPLAY_HEIGHT; y += 1) {
    const word = (y & 1) === 0 ? 0xaaaaaaaa : 0x55555555;
    for (let xWord = 0; xWord < 24; xWord += 1) {
      view.setUint32(offset, word, true);
      offset += 4;
    }
  }
  return bytes;
}

/** The visible synthetic colour: true is black, false is white. */
export function syntheticPixelIsBlack(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
      x >= CADR_DISPLAY_WIDTH || y >= CADR_DISPLAY_HEIGHT) {
    throw new RangeError("synthetic source coordinate is outside the CADR display");
  }
  return ((x + y) & 1) === 0;
}
