import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  CADR_DISPLAY_ACTIVE_WORDS,
  CADR_DISPLAY_FLAG_ZERO_IS_BLACK,
  CADR_DISPLAY_FLAG_FULL,
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_WIDTH,
  CadrMonochromeFramebuffer,
  integerPresentation,
  parseCdrDisp1,
  renderFramebufferIntoCanvas,
} from "../cadr-web/wasm/cadr-display-renderer.mjs";

function record({ machine = 1n, framebuffer = 1n, tvMode = 0, full = true, rectangles, words }) {
  const fields = rectangles ?? [{ x: 0, y: 0, width: CADR_DISPLAY_WIDTH, height: CADR_DISPLAY_HEIGHT }];
  const expectedWords = fields.reduce((total, rectangle) => total + rectangle.width / 32 * rectangle.height, 0);
  const payload = words ?? new Uint32Array(expectedWords);
  assert.equal(payload.length, expectedWords);
  const bytes = new Uint8Array(80 + fields.length * 16 + payload.length * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRDISP1"));
  view.setUint16(8, 1, true); view.setUint16(10, 80, true);
  view.setUint32(12, (full ? CADR_DISPLAY_FLAG_FULL : 0) |
    ((tvMode & 4) === 0 ? CADR_DISPLAY_FLAG_ZERO_IS_BLACK : 0), true);
  view.setBigUint64(16, machine, true); view.setBigUint64(24, framebuffer, true);
  view.setUint32(32, CADR_DISPLAY_WIDTH, true); view.setUint32(36, CADR_DISPLAY_HEIGHT, true);
  view.setUint32(40, 24, true); view.setUint32(44, 32768, true);
  view.setUint32(48, CADR_DISPLAY_ACTIVE_WORDS, true); view.setUint32(52, tvMode, true);
  view.setUint32(56, fields.length, true); view.setUint32(60, payload.length, true);
  view.setBigUint64(64, BigInt(payload.length * 4), true); view.setBigUint64(72, BigInt(bytes.byteLength), true);
  let offset = 80;
  for (const rectangle of fields) {
    view.setUint32(offset, rectangle.x, true); view.setUint32(offset + 4, rectangle.y, true);
    view.setUint32(offset + 8, rectangle.width, true); view.setUint32(offset + 12, rectangle.height, true);
    offset += 16;
  }
  for (const word of payload) { view.setUint32(offset, word, true); offset += 4; }
  return bytes;
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function testNativeBitOrderCheckpointAndRawScreenshot() {
  const words = new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS);
  words[0] = 0x80000001;
  words[24 + 1] = 0x00000002;
  const frame = new CadrMonochromeFramebuffer();
  const first = record({ words });
  assert.equal(parseCdrDisp1(first).wordCount, CADR_DISPLAY_ACTIVE_WORDS);
  assert.deepEqual(frame.apply(first).dirtyRectangles,
    [{ x: 0, y: 0, width: CADR_DISPLAY_WIDTH, height: CADR_DISPLAY_HEIGHT }]);
  // The upstream native tv.c screenshot loop selects bit i % 32 for x=i.
  assert.equal(frame.rawBit(0, 0), true);
  assert.equal(frame.rawBit(1, 0), false);
  assert.equal(frame.rawBit(31, 0), true);
  assert.equal(frame.rawBit(32, 0), false);
  assert.equal(frame.rawBit(33, 1), true);
  assert.equal(frame.displayedIsBlack(0, 0), false);
  assert.equal(frame.displayedIsBlack(1, 0), true);
  const raw = frame.rawFramebufferPbm();
  const header = new TextEncoder().encode("P4\n768 963\n");
  assert.deepEqual(raw.slice(0, header.byteLength), header);
  assert.equal(raw[header.byteLength], 0x80);
  assert.equal(raw[header.byteLength + 3], 0x01);
  // This hash pins the native-source fixture's meaningful raw checkpoint,
  // rather than a browser canvas or CSS interpolation artifact.
  assert.equal(digest(raw), "4678dccd53a10366de4c06c6b42a54c0e751da8b80f6a755252e1048532b4d52");
  const displayed = frame.displayedPixelsPpm();
  assert.equal(digest(displayed), "d8e9cc998368ca5560584cc40acc55c8b38200a2ab2bd470ba6eda783cd28ec1");
}

function testDirtyTransferAndPolarity() {
  const frame = new CadrMonochromeFramebuffer();
  frame.apply(record({ words: new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS) }));
  const dirty = record({ framebuffer: 2n, full: false,
    rectangles: [{ x: 0, y: 0, width: 32, height: 1 }], words: new Uint32Array([1]) });
  assert.deepEqual(frame.apply(dirty).dirtyRectangles, [{ x: 0, y: 0, width: 32, height: 1 }]);
  assert.equal(frame.rawBit(0, 0), true);
  assert.equal(frame.rawBit(1, 0), false);
  assert.equal(frame.displayedIsBlack(0, 0), false);
  assert.throws(() => frame.apply(dirty), /stale framebuffer generation/);
  assert.throws(() => frame.apply(record({ machine: 2n, framebuffer: 3n, full: false,
    rectangles: [{ x: 0, y: 0, width: 32, height: 1 }], words: new Uint32Array([0]) })),
  /machine generation change requires full framebuffer/);
  frame.apply(record({ machine: 2n, framebuffer: 3n, tvMode: 4,
    words: new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS) }));
  assert.equal(frame.displayedIsBlack(0, 0), false);
  assert.equal(frame.displayedIsBlack(1, 0), false);
  const ppm = frame.displayedPixelsPpm(1);
  assert.equal(digest(ppm), "f0e173288b733a98ce65804cbabd1f73b2f638328b2e57227be4f48e728c201c");
}

function testMonotonicLifecycleAndAdversarialRecords() {
  const frame = new CadrMonochromeFramebuffer();
  const delta = (machine, framebuffer, word) => record({ machine, framebuffer, full: false,
    rectangles: [{ x: 0, y: 0, width: 32, height: 1 }], words: new Uint32Array([word]) });
  const full = (machine, framebuffer, word) => {
    const words = new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS);
    words[0] = word;
    return record({ machine, framebuffer, words });
  };

  frame.apply(full(7n, 9n, 1));
  frame.apply(delta(7n, 10n, 2));
  assert.equal(frame.rawBit(1, 0), true);

  assert.throws(() => frame.apply(full(7n, 10n, 4)), /stale framebuffer generation/,
    "equal-generation full is stale");
  assert.throws(() => frame.apply(full(7n, 9n, 4)), /stale framebuffer generation/,
    "older full is stale");
  assert.throws(() => frame.apply(delta(6n, 99n, 4)), /machine generation change requires full/,
    "an old-machine delta remains invalid even with a high framebuffer generation");
  assert.throws(() => frame.apply(full(6n, 8n, 4)), /stale framebuffer generation/,
    "an old-machine full cannot replay an old framebuffer generation");

  /* Same-worker restore keeps the host-instance generation monotonic while
   * requiring a full replacement.  Machine generation may itself be restored. */
  frame.apply(full(6n, 11n, 4));
  assert.equal(frame.rawBit(2, 0), true);

  frame.apply(full(6n, 12n, 8));
  assert.equal(frame.rawBit(3, 0), true);

  frame.apply(full(8n, 13n, 16));
  assert.equal(frame.rawBit(4, 0), true);
  frame.apply(delta(8n, 14n, 32));
  assert.equal(frame.rawBit(5, 0), true);
  assert.throws(() => frame.apply(delta(8n, 14n, 64)), /stale framebuffer generation/);
}

function testMalformedTransferIsRejectedBeforeFramebufferMutation() {
  const frame = new CadrMonochromeFramebuffer();
  const words = new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS);
  words[0] = 1;
  frame.apply(record({ words }));
  const before = frame.rawFramebufferPbm();

  /* Two records claiming the same source row are neither the core's canonical
   * row-disjoint encoding nor a valid replacement.  The parser must reject
   * this before apply() replaces any pixels. */
  const overlapping = record({ framebuffer: 2n, full: false,
    rectangles: [
      { x: 0, y: 0, width: 32, height: 1 },
      { x: 32, y: 0, width: 32, height: 1 },
    ],
    words: new Uint32Array([0, 0]),
  });
  assert.throws(() => parseCdrDisp1(overlapping), /rectangle order or extent/);
  assert.throws(() => frame.apply(overlapping), /rectangle order or extent/);
  assert.deepEqual(frame.rawFramebufferPbm(), before);
  assert.equal(frame.rawBit(0, 0), true);

  const polarityMismatch = record({ framebuffer: 2n, full: false,
    rectangles: [{ x: 0, y: 1, width: 32, height: 1 }],
    words: new Uint32Array([0]),
  });
  new DataView(polarityMismatch.buffer).setUint32(12, 0, true);
  assert.throws(() => parseCdrDisp1(polarityMismatch), /header fields/);
  assert.throws(() => frame.apply(polarityMismatch), /header fields/);
  assert.deepEqual(frame.rawFramebufferPbm(), before);
}

function testIntegerLetterboxAndPixelRectangles() {
  assert.deepEqual(integerPresentation(1920, 1080), {
    scale: 1, width: 768, height: 963, left: 576, top: 58, fits: true,
  });
  assert.deepEqual(integerPresentation(1600, 2000), {
    scale: 2, width: 1536, height: 1926, left: 32, top: 37, fits: true,
  });
  assert.deepEqual(integerPresentation(767, 963), {
    scale: 0, width: 0, height: 0, left: 0, top: 0, fits: false,
  });
  const frame = new CadrMonochromeFramebuffer();
  const words = new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS);
  words[0] = 1;
  frame.apply(record({ words }));
  const image = frame.presentationRgba(1600, 2000);
  const pixelAt = (x, y) => image.pixels.slice((y * 1600 + x) * 4, (y * 1600 + x) * 4 + 4);
  assert.deepEqual(pixelAt(0, 0), new Uint8ClampedArray([0, 0, 0, 255]));
  // BOW false: raw one is white.  Two output pixels in both directions prove
  // nearest-neighbor integral replication rather than filtered scaling.
  assert.deepEqual(pixelAt(32, 37), new Uint8ClampedArray([255, 255, 255, 255]));
  assert.deepEqual(pixelAt(33, 38), new Uint8ClampedArray([255, 255, 255, 255]));
  assert.deepEqual(pixelAt(34, 37), new Uint8ClampedArray([0, 0, 0, 255]));
  assert.equal(digest(image.pixels), "6c62722276ca2a3bb13178114954133b66cd796a979bb1a3b7d1f2bca5a5a230");
}

function testCanvasPresentation() {
  const frame = new CadrMonochromeFramebuffer();
  frame.apply(record({ words: new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS) }));
  const writes = [];
  const context = {
    imageSmoothingEnabled: true,
    createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData(image, x, y) { writes.push({ image, x, y }); },
  };
  const canvas = { width: 0, height: 0, style: {}, getContext(kind, options) {
    assert.equal(kind, "2d"); assert.deepEqual(options, { alpha: false }); return context;
  } };
  assert.deepEqual(renderFramebufferIntoCanvas(frame, canvas, 768, 963),
    { scale: 1, left: 0, top: 0, width: 768, height: 963 });
  assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(canvas.style.imageRendering, "pixelated");
  assert.equal(writes.length, 1);
  assert.equal(digest(writes[0].image.data), "3f36319aa1b0a909c30af25a923e0032b1ae7f438afd32099dc142245ae2615f");
}

testNativeBitOrderCheckpointAndRawScreenshot();
testDirtyTransferAndPolarity();
testMonotonicLifecycleAndAdversarialRecords();
testMalformedTransferIsRejectedBeforeFramebufferMutation();
testIntegerLetterboxAndPixelRectangles();
testCanvasPresentation();
console.log("cadr M7 renderer tests passed");
