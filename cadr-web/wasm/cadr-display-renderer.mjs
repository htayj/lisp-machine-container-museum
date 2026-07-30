/*
 * CADR-WEB M7 monochrome display presentation.
 *
 * CDRDISP1 is a core-owned transfer record.  This module owns only the
 * browser-side copy and presentation of that record: no canvas, CSS, or host
 * time influences the 768 by 963 logical framebuffer.  In particular, the
 * CADR's least-significant-bit-first words are converted explicitly instead
 * of relying on a browser image-data byte order.
 */

export const CADR_DISPLAY_WIDTH = 768;
export const CADR_DISPLAY_HEIGHT = 963;
export const CADR_DISPLAY_STRIDE_WORDS = 24;
export const CADR_DISPLAY_ACTIVE_WORDS = 23112;
export const CADR_DISPLAY_FLAG_FULL = 1;
export const CADR_DISPLAY_FLAG_ZERO_IS_BLACK = 2;

const CDRDISP1_HEADER_BYTES = 80;
const CDRDISP1_RECT_BYTES = 16;
const CDRDISP1_VERSION = 1;
const MAX_U32 = 0xffffffff;

function asBytes(record) {
  if (record instanceof Uint8Array) return record;
  if (record instanceof ArrayBuffer) return new Uint8Array(record);
  if (ArrayBuffer.isView(record)) {
    return new Uint8Array(record.buffer, record.byteOffset, record.byteLength);
  }
  throw new TypeError("CDRDISP1 record must be bytes");
}

function fail(message) {
  throw new RangeError(`invalid CDRDISP1 record: ${message}`);
}

function isUnsignedInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function putBigEndianBit(bytes, pixel, one) {
  if (one) bytes[pixel >>> 3] |= 0x80 >>> (pixel & 7);
}

/** Parse and completely validate the fixed M7 core-to-renderer record. */
export function parseCdrDisp1(record) {
  const bytes = asBytes(record);
  if (bytes.byteLength < CDRDISP1_HEADER_BYTES) fail("short header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = new TextDecoder().decode(bytes.slice(0, 8));
  if (magic !== "CDRDISP1") fail("magic");
  if (view.getUint16(8, true) !== CDRDISP1_VERSION ||
      view.getUint16(10, true) !== CDRDISP1_HEADER_BYTES) fail("version or header length");
  const flags = view.getUint32(12, true);
  const machineGeneration = view.getBigUint64(16, true);
  const framebufferGeneration = view.getBigUint64(24, true);
  const width = view.getUint32(32, true);
  const height = view.getUint32(36, true);
  const strideWords = view.getUint32(40, true);
  const backingWords = view.getUint32(44, true);
  const activeWords = view.getUint32(48, true);
  const tvMode = view.getUint32(52, true);
  const rectCount = view.getUint32(56, true);
  const wordCount = view.getUint32(60, true);
  const payloadByteCount = view.getBigUint64(64, true);
  const encodedByteCount = view.getBigUint64(72, true);
  const bow = ((tvMode >>> 2) & 1) !== 0;
  if ((flags & ~(CADR_DISPLAY_FLAG_FULL | CADR_DISPLAY_FLAG_ZERO_IS_BLACK)) !== 0 ||
      machineGeneration === 0n || framebufferGeneration === 0n ||
      width !== CADR_DISPLAY_WIDTH || height !== CADR_DISPLAY_HEIGHT ||
      strideWords !== CADR_DISPLAY_STRIDE_WORDS || backingWords !== 32768 ||
      activeWords !== CADR_DISPLAY_ACTIVE_WORDS || rectCount > CADR_DISPLAY_HEIGHT ||
      payloadByteCount !== BigInt(wordCount) * 4n ||
      encodedByteCount !== BigInt(bytes.byteLength) ||
      ((flags & CADR_DISPLAY_FLAG_ZERO_IS_BLACK) !== 0) !== !bow) {
    fail("header fields");
  }
  const rectangleBytes = BigInt(rectCount) * BigInt(CDRDISP1_RECT_BYTES);
  if (BigInt(bytes.byteLength) < BigInt(CDRDISP1_HEADER_BYTES) + rectangleBytes ||
      BigInt(bytes.byteLength) - BigInt(CDRDISP1_HEADER_BYTES) - rectangleBytes !== payloadByteCount ||
      ((flags & CADR_DISPLAY_FLAG_FULL) !== 0 && rectCount !== 1)) fail("encoded size");
  const rectangles = [];
  let previousEnd = 0;
  let previousX = 0;
  let previousWidth = 0;
  let words = 0;
  let offset = CDRDISP1_HEADER_BYTES;
  for (let index = 0; index < rectCount; index += 1) {
    const x = view.getUint32(offset, true);
    const y = view.getUint32(offset + 4, true);
    const rectangleWidth = view.getUint32(offset + 8, true);
    const rectangleHeight = view.getUint32(offset + 12, true);
    if (rectangleWidth === 0 || rectangleHeight === 0 || x % 32 !== 0 ||
        rectangleWidth % 32 !== 0 || x >= CADR_DISPLAY_WIDTH || y >= CADR_DISPLAY_HEIGHT ||
        rectangleWidth > CADR_DISPLAY_WIDTH - x || rectangleHeight > CADR_DISPLAY_HEIGHT - y ||
        y < previousEnd ||
        (y === previousEnd && x === previousX && rectangleWidth === previousWidth)) {
      fail("rectangle order or extent");
    }
    if ((flags & CADR_DISPLAY_FLAG_FULL) !== 0 &&
        (x !== 0 || y !== 0 || rectangleWidth !== CADR_DISPLAY_WIDTH ||
         rectangleHeight !== CADR_DISPLAY_HEIGHT)) fail("full rectangle");
    words += (rectangleWidth / 32) * rectangleHeight;
    if (words > MAX_U32) fail("word count overflow");
    rectangles.push({ x, y, width: rectangleWidth, height: rectangleHeight });
    previousEnd = y + rectangleHeight;
    previousX = x;
    previousWidth = rectangleWidth;
    offset += CDRDISP1_RECT_BYTES;
  }
  if (words !== wordCount) fail("word count");
  return {
    bytes, view, flags, machineGeneration, framebufferGeneration, tvMode,
    full: (flags & CADR_DISPLAY_FLAG_FULL) !== 0, bow,
    rectangles, payloadOffset: offset, wordCount,
  };
}

/** Largest integral scale that leaves every source pixel a source-pixel-sized rectangle. */
export function integerPresentation(viewportWidth, viewportHeight) {
  if (!isUnsignedInteger(viewportWidth) || !isUnsignedInteger(viewportHeight) ||
      viewportWidth === 0 || viewportHeight === 0) {
    throw new TypeError("viewport dimensions must be positive safe integers");
  }
  const scale = Math.min(Math.floor(viewportWidth / CADR_DISPLAY_WIDTH),
    Math.floor(viewportHeight / CADR_DISPLAY_HEIGHT));
  if (scale < 1) {
    return { scale: 0, width: 0, height: 0, left: 0, top: 0, fits: false };
  }
  const width = CADR_DISPLAY_WIDTH * scale;
  const height = CADR_DISPLAY_HEIGHT * scale;
  return {
    scale, width, height,
    left: Math.floor((viewportWidth - width) / 2),
    top: Math.floor((viewportHeight - height) / 2),
    fits: true,
  };
}

export class CadrMonochromeFramebuffer {
  #words = new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS);
  #machineGeneration = 0n;
  #framebufferGeneration = 0n;
  #bow = false;
  #initialized = false;

  get machineGeneration() { return this.#machineGeneration; }
  get framebufferGeneration() { return this.#framebufferGeneration; }
  get blackOnWhite() { return this.#bow; }
  get initialized() { return this.#initialized; }

  /**
   * Atomically apply a transfer.  The host-instance framebuffer generation is
   * strictly increasing for every accepted record, including a full recovery
   * or lifecycle replacement.  A machine-generation change additionally
   * requires a full record.  A rejected record leaves pixels and generations
   * unchanged.
   */
  apply(record) {
    const parsed = parseCdrDisp1(record);
    if (!this.#initialized && !parsed.full) throw new RangeError("initial display transfer must be full");
    if (this.#initialized && parsed.framebufferGeneration <= this.#framebufferGeneration) {
      throw new RangeError("stale framebuffer generation");
    }
    if (this.#initialized && parsed.machineGeneration !== this.#machineGeneration && !parsed.full) {
      throw new RangeError("machine generation change requires full framebuffer");
    }
    const replacement = parsed.full ? new Uint32Array(CADR_DISPLAY_ACTIVE_WORDS) : this.#words.slice();
    let payloadOffset = parsed.payloadOffset;
    for (const rectangle of parsed.rectangles) {
      const firstWord = rectangle.x / 32;
      const wordsPerRow = rectangle.width / 32;
      for (let row = rectangle.y; row < rectangle.y + rectangle.height; row += 1) {
        const base = row * CADR_DISPLAY_STRIDE_WORDS + firstWord;
        for (let word = 0; word < wordsPerRow; word += 1) {
          replacement[base + word] = parsed.view.getUint32(payloadOffset, true);
          payloadOffset += 4;
        }
      }
    }
    this.#words = replacement;
    this.#machineGeneration = parsed.machineGeneration;
    this.#framebufferGeneration = parsed.framebufferGeneration;
    this.#bow = parsed.bow;
    this.#initialized = true;
    return {
      machineGeneration: parsed.machineGeneration,
      framebufferGeneration: parsed.framebufferGeneration,
      full: parsed.full,
      dirtyRectangles: parsed.rectangles.map(rectangle => ({ ...rectangle })),
    };
  }

  rawBit(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
        x >= CADR_DISPLAY_WIDTH || y >= CADR_DISPLAY_HEIGHT) {
      throw new RangeError("logical pixel is outside the CADR screen");
    }
    const word = this.#words[y * CADR_DISPLAY_STRIDE_WORDS + Math.floor(x / 32)];
    return ((word >>> (x & 31)) & 1) !== 0;
  }

  /** Bit one is foreground.  In BOW it is black; otherwise zero is black. */
  displayedIsBlack(x, y) {
    const bit = this.rawBit(x, y);
    return this.#bow ? bit : !bit;
  }

  rawFramebufferPbm() {
    if (!this.#initialized) throw new RangeError("framebuffer has no full transfer");
    const header = new TextEncoder().encode(`P4\n${CADR_DISPLAY_WIDTH} ${CADR_DISPLAY_HEIGHT}\n`);
    const rowBytes = CADR_DISPLAY_WIDTH / 8;
    const result = new Uint8Array(header.byteLength + rowBytes * CADR_DISPLAY_HEIGHT);
    result.set(header, 0);
    for (let y = 0; y < CADR_DISPLAY_HEIGHT; y += 1) {
      const destination = header.byteLength + y * rowBytes;
      for (let x = 0; x < CADR_DISPLAY_WIDTH; x += 1) {
        putBigEndianBit(result.subarray(destination, destination + rowBytes), x, this.rawBit(x, y));
      }
    }
    return result;
  }

  /** A deterministic, uncompressed displayed-pixel PPM screenshot. */
  displayedPixelsPpm(scale = 1) {
    if (!this.#initialized) throw new RangeError("framebuffer has no full transfer");
    if (!Number.isInteger(scale) || scale < 1) throw new RangeError("scale must be an integer at least one");
    const width = CADR_DISPLAY_WIDTH * scale;
    const height = CADR_DISPLAY_HEIGHT * scale;
    const header = new TextEncoder().encode(`P6\n${width} ${height}\n255\n`);
    const result = new Uint8Array(header.byteLength + width * height * 3);
    result.set(header, 0);
    const pixels = result.subarray(header.byteLength);
    for (let sourceY = 0; sourceY < CADR_DISPLAY_HEIGHT; sourceY += 1) {
      for (let sourceX = 0; sourceX < CADR_DISPLAY_WIDTH; sourceX += 1) {
        const component = this.displayedIsBlack(sourceX, sourceY) ? 0 : 255;
        for (let dy = 0; dy < scale; dy += 1) {
          const row = (sourceY * scale + dy) * width;
          for (let dx = 0; dx < scale; dx += 1) {
            const offset = (row + sourceX * scale + dx) * 3;
            pixels[offset] = component;
            pixels[offset + 1] = component;
            pixels[offset + 2] = component;
          }
        }
      }
    }
    return result;
  }

  /** Return RGBA pixels for a letterboxed integral presentation viewport. */
  presentationRgba(viewportWidth, viewportHeight) {
    if (!this.#initialized) throw new RangeError("framebuffer has no full transfer");
    const plan = integerPresentation(viewportWidth, viewportHeight);
    if (!plan.fits) throw new RangeError("viewport cannot fit a complete integral CADR display");
    const pixels = new Uint8ClampedArray(viewportWidth * viewportHeight * 4);
    for (let index = 3; index < pixels.byteLength; index += 4) pixels[index] = 255;
    for (let sourceY = 0; sourceY < CADR_DISPLAY_HEIGHT; sourceY += 1) {
      for (let sourceX = 0; sourceX < CADR_DISPLAY_WIDTH; sourceX += 1) {
        const component = this.displayedIsBlack(sourceX, sourceY) ? 0 : 255;
        for (let dy = 0; dy < plan.scale; dy += 1) {
          const row = plan.top + sourceY * plan.scale + dy;
          for (let dx = 0; dx < plan.scale; dx += 1) {
            const column = plan.left + sourceX * plan.scale + dx;
            const offset = (row * viewportWidth + column) * 4;
            pixels[offset] = component;
            pixels[offset + 1] = component;
            pixels[offset + 2] = component;
          }
        }
      }
    }
    return { ...plan, pixels };
  }
}

/**
 * Render a complete, integral, letterboxed frame into a normal 2D canvas.
 * Callers must keep CSS dimensions equal to its backing dimensions (or an
 * integer multiple) to avoid a second, fractional browser resample.
 */
export function renderFramebufferIntoCanvas(framebuffer, canvas, viewportWidth, viewportHeight) {
  if (!(framebuffer instanceof CadrMonochromeFramebuffer) || canvas === null ||
      typeof canvas.getContext !== "function") throw new TypeError("framebuffer and canvas are required");
  const presentation = framebuffer.presentationRgba(viewportWidth, viewportHeight);
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null || typeof context.createImageData !== "function" ||
      typeof context.putImageData !== "function") throw new TypeError("2D canvas context is required");
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
  if (canvas.style !== undefined) {
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    canvas.style.imageRendering = "pixelated";
  }
  context.imageSmoothingEnabled = false;
  const image = context.createImageData(viewportWidth, viewportHeight);
  image.data.set(presentation.pixels);
  context.putImageData(image, 0, 0);
  return {
    scale: presentation.scale, left: presentation.left, top: presentation.top,
    width: presentation.width, height: presentation.height,
  };
}
