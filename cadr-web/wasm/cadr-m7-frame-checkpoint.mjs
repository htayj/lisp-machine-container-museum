/*
 * M7's real-frame checkpoint bridge.  This deliberately wraps the frozen M6
 * driver instead of copying its Listener-ready state machine: an intercepted
 * `run-digest-batch-m5` response is still inside the driver's await, so this
 * module can request `display-full` before M6 dispatches any later boundary.
 */
import {
  CADR_M6_FORM_C,
  CADR_M6_RELEASE_RECORD_SHA256,
  runM6HeadlessBoot,
} from "./cadr-m6-headless-boot.mjs";
import {
  CADR_DISPLAY_ACTIVE_WORDS,
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_STRIDE_WORDS,
  CADR_DISPLAY_WIDTH,
  parseCdrDisp1,
} from "./cadr-display-renderer.mjs";

export const CADR_M7_NATIVE_FRAME_SCHEMA = "CDRM7N1";
export const CADR_M7_NATIVE_FRAME_HEADER_BYTES = 64;
export const CADR_M7_NATIVE_FRAME_BACKING_WORDS = 32768;
export const CADR_M7_NATIVE_FRAME_PAYLOAD_BYTES = CADR_DISPLAY_ACTIVE_WORDS * 4;
export const CADR_M7_FORM_C_BOUNDARY = 982990214n;

const STATUS_OK = 0;

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function required(condition, message) {
  if (!condition) throw new TypeError(`M7 frame checkpoint: ${message}`);
}

function sameBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function is60HzDue(boundary) {
  const candidate = (boundary * 60n) / 1000000n;
  for (const ordinal of [candidate - 1n, candidate, candidate + 1n]) {
    if (ordinal > 0n && (ordinal * 1000000n + 59n) / 60n === boundary) return true;
  }
  return false;
}

required(!is60HzDue(CADR_M7_FORM_C_BOUNDARY),
  "frozen C boundary must not be a 60 Hz due boundary");

function wordAt(bytes, index) {
  return new DataView(bytes.buffer, bytes.byteOffset + index * 4, 4)
    .getUint32(0, true);
}

function rawWordsFromFullCdrDisp1(record) {
  const parsed = parseCdrDisp1(record);
  required(parsed.full && parsed.rectangles.length === 1 && parsed.wordCount === CADR_DISPLAY_ACTIVE_WORDS,
    "portable record is not one full logical frame");
  const rectangle = parsed.rectangles[0];
  required(rectangle.x === 0 && rectangle.y === 0 &&
    rectangle.width === CADR_DISPLAY_WIDTH && rectangle.height === CADR_DISPLAY_HEIGHT,
  "portable full rectangle has wrong extent");
  const payload = parsed.bytes.slice(parsed.payloadOffset);
  required(payload.byteLength === CADR_M7_NATIVE_FRAME_PAYLOAD_BYTES,
    "portable full payload length");
  return { parsed, payload };
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hexBytes(new Uint8Array(digest));
}

function hexBytes(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

/** Parse the native, private-only `CDRM7N1` frame capture without retaining it. */
export function parseCdrM7N1(record) {
  const bytes = bytesOf(record);
  required(bytes !== null, "native capture must be bytes");
  required(bytes.byteLength === CADR_M7_NATIVE_FRAME_HEADER_BYTES +
    CADR_M7_NATIVE_FRAME_PAYLOAD_BYTES, "native capture length");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = new TextDecoder().decode(bytes.subarray(0, 7));
  required(magic === CADR_M7_NATIVE_FRAME_SCHEMA && bytes[7] === 0,
    "native capture magic");
  required(view.getUint32(8, true) === 1 &&
    view.getUint32(12, true) === CADR_M7_NATIVE_FRAME_HEADER_BYTES,
  "native capture version/header size");
  const boundary = view.getBigUint64(16, true);
  const width = view.getUint32(24, true);
  const height = view.getUint32(28, true);
  const tvMode = view.getUint32(32, true);
  const blackOnWhite = view.getUint32(36, true);
  const backingWords = view.getUint32(40, true);
  const activeWords = view.getUint32(44, true);
  const payloadBytes = view.getUint32(48, true);
  const flags = view.getUint32(52, true);
  required(boundary === CADR_M7_FORM_C_BOUNDARY && width === CADR_DISPLAY_WIDTH && height === CADR_DISPLAY_HEIGHT &&
    backingWords === CADR_M7_NATIVE_FRAME_BACKING_WORDS &&
    activeWords === CADR_DISPLAY_ACTIVE_WORDS &&
    payloadBytes === CADR_M7_NATIVE_FRAME_PAYLOAD_BYTES && flags === 0 &&
    blackOnWhite <= 1 && (((tvMode >>> 2) & 1) === blackOnWhite),
  "native capture geometry/control header");
  for (let index = 56; index < CADR_M7_NATIVE_FRAME_HEADER_BYTES; index += 1) {
    required(bytes[index] === 0, "native capture reserved bytes");
  }
  return Object.freeze({
    bytes: bytes.slice(),
    boundary, width, height, tvMode, blackOnWhite: blackOnWhite !== 0,
    backingWords, activeWords,
    words: bytes.slice(CADR_M7_NATIVE_FRAME_HEADER_BYTES),
  });
}

/** A mismatch is deliberately a structured error, not a visually ambiguous image. */
export class CadrM7FrameMismatch extends Error {
  constructor(report) {
    super("M7 native and portable raw framebuffer words differ");
    this.name = "CadrM7FrameMismatch";
    this.report = Object.freeze(report);
  }
}

/**
 * Compare native source words with a portable full transfer.  The result is
 * evidence metadata only: callers retain the raw records in ignored storage.
 */
export async function compareM7FrameCheckpoint(nativeRecord, portableCheckpoint) {
  const native = parseCdrM7N1(nativeRecord);
  required(portableCheckpoint !== null && typeof portableCheckpoint === "object",
    "portable checkpoint object");
  required(typeof portableCheckpoint.boundary === "bigint" &&
    portableCheckpoint.boundary === native.boundary,
  "portable checkpoint boundary differs from native C boundary");
  const witnessSample = bytesOf(portableCheckpoint.witness_sample);
  required(witnessSample !== null && witnessSample.byteLength === 96,
    "portable checkpoint lacks its M6 witness sample");
  const parsedWitnessSample = parseM6CWitnessSampleBytes(witnessSample);
  const releaseRecordSha256 = bytesOf(portableCheckpoint.m6_release_record_sha256);
  required(releaseRecordSha256 !== null &&
    sameBytes(releaseRecordSha256, CADR_M6_RELEASE_RECORD_SHA256),
  "portable checkpoint is not bound to the frozen M6 release record");
  const portable = rawWordsFromFullCdrDisp1(portableCheckpoint.display_record);
  required(portable.parsed.tvMode === native.tvMode,
    "native and portable TV mode differ");
  required(portable.parsed.bow === native.blackOnWhite,
    "native and portable BOW differ");
  const [nativeSha256, portableSha256, nativeCaptureSha256, portableRecordSha256,
    m6WitnessSampleSha256] =
    await Promise.all([
      sha256Hex(native.words), sha256Hex(portable.payload),
      sha256Hex(native.bytes), sha256Hex(portable.parsed.bytes),
      sha256Hex(parsedWitnessSample.bytes),
    ]);
  for (let index = 0; index < CADR_DISPLAY_ACTIVE_WORDS; index += 1) {
    const nativeWord = wordAt(native.words, index);
    const portableWord = wordAt(portable.payload, index);
    if (nativeWord === portableWord) continue;
    const differences = [];
    const xor = (nativeWord ^ portableWord) >>> 0;
    for (let bit = 0; bit < 32; bit += 1) {
      if (((xor >>> bit) & 1) !== 0) {
        differences.push(Object.freeze({ x: (index % CADR_DISPLAY_STRIDE_WORDS) * 32 + bit,
          y: Math.floor(index / CADR_DISPLAY_STRIDE_WORDS), bit }));
      }
    }
    throw new CadrM7FrameMismatch({
      schema: "cadr-m7-frame-first-difference-v1",
      native_capture_sha256: nativeCaptureSha256,
      portable_record_sha256: portableRecordSha256,
      m6_release_record_sha256: hexBytes(releaseRecordSha256),
      m6_witness_sample_sha256: m6WitnessSampleSha256,
      first_word_index: index,
      x_word: index % CADR_DISPLAY_STRIDE_WORDS,
      y: Math.floor(index / CADR_DISPLAY_STRIDE_WORDS),
      native_word: nativeWord,
      portable_word: portableWord,
      differing_bits: differences,
    });
  }
  return Object.freeze({
    schema: "cadr-m7-frame-comparison-v1",
    outcome: "identical",
    boundary: native.boundary.toString(),
    portable_checkpoint_boundary: portableCheckpoint.boundary.toString(),
    m6_release_record_sha256: hexBytes(releaseRecordSha256),
    m6_witness_sample_sha256: m6WitnessSampleSha256,
    geometry: Object.freeze({ width: native.width, height: native.height,
      stride_words: CADR_DISPLAY_STRIDE_WORDS, backing_words: native.backingWords,
      active_words: native.activeWords }),
    tv_mode: native.tvMode,
    black_on_white: native.blackOnWhite,
    native_capture_sha256: nativeCaptureSha256,
    portable_record_sha256: portableRecordSha256,
    native_raw_words_sha256: nativeSha256,
    portable_raw_words_sha256: portableSha256,
  });
}

function machineBoundary(response) {
  const bytes = bytesOf(response?.info);
  required(bytes !== null && bytes.byteLength === 64, "machine-info framing");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(8, true);
}

function parseM6CWitnessSampleBytes(value) {
  const sample = bytesOf(value);
  required(sample !== null && sample.byteLength === 96, "portable CDRM6I1 sample length");
  const view = new DataView(sample.buffer, sample.byteOffset, sample.byteLength);
  required(new TextDecoder().decode(sample.subarray(0, 7)) === "CDRM6I1" && sample[7] === 0 &&
    view.getBigUint64(8, true) === CADR_M6_FORM_C &&
    (view.getBigUint64(16, true) >> 48n) === 0n &&
    (view.getBigUint64(24, true) >> 48n) === 0n &&
    (view.getUint32(60, true) & (1 << 5)) === 0 &&
    view.getUint32(64, true) === 0 &&
    view.getUint32(68, true) === 0x18000 &&
    view.getUint32(72, true) === 3 &&
    view.getUint32(76, true) === 0 &&
    view.getUint32(80, true) === 0 &&
    view.getUint32(84, true) === 1 &&
    view.getUint32(88, true) === 0 &&
    view.getUint32(92, true) === 0, "portable CDRM6I1 sample");
  return Object.freeze({
    bytes: sample.slice(), debug_instruction: view.getBigUint64(8, true),
    p0: view.getBigUint64(16, true), p1: view.getBigUint64(24, true),
    p0_pc: view.getUint32(32, true), p1_pc: view.getUint32(36, true),
    next_micro_pc: view.getUint32(40, true), location_counter: view.getUint32(44, true),
    interrupt_control: view.getUint32(48, true), interrupt_status: view.getUint32(52, true),
    interrupt_pending: view.getUint32(56, true), iob_csr: view.getUint32(60, true),
    iob_fifo_count: view.getUint32(64, true), iob_scancode: view.getUint32(68, true),
    disk_status: view.getUint32(72, true), disk_transfer_active: view.getUint32(76, true),
    outstanding_operation: view.getUint32(80, true), disk_interrupt_request: view.getUint32(84, true),
    host_request_pending: view.getUint32(88, true), host_completion_queued: view.getUint32(92, true),
  });
}

function parseM6CWitnessSample(response, boundary) {
  const sample = bytesOf(response?.sample);
  required(response?.status === STATUS_OK && response.wireSchema === "CDRM6I1" &&
    response.boundary === boundary && response.debugInstruction === CADR_M6_FORM_C &&
    sample !== null && sample.byteLength === 96, "portable C witness envelope");
  return parseM6CWitnessSampleBytes(sample);
}

/**
 * Wrap a protocol-v5 client.  M6 calls this generic `request` surface, so its
 * frozen control/state machine remains untouched.  This wrapper must be the
 * only client of its worker; it issues the capture while the outer M6 request
 * remains suspended and therefore cannot observe a later guest boundary.
 */
export class CadrM7CBoundaryClient {
  constructor(client, nativeCapture) {
    this.client = client;
    this.native = parseCdrM7N1(nativeCapture);
    this.lastBoundary = null;
    this.checkpoint = null;
    this.captureError = null;
  }

  async request(op, fields = {}, transfer = []) {
    if (this.captureError !== null) throw this.captureError;
    const response = await this.client.request(op, fields, transfer);
    if (op === "machine-info" && response?.status === STATUS_OK) {
      this.lastBoundary = machineBoundary(response);
      return response;
    }
    if (op !== "run-digest-batch-m5" || response?.status !== STATUS_OK) return response;
    required(this.lastBoundary !== null, "run batch without a preceding machine-info");
    required(Number.isSafeInteger(response.boundaryCount) && response.boundaryCount >= 0,
      "run batch count");
    const completed = this.lastBoundary + BigInt(response.boundaryCount);
    /* M6 normally asks machine-info after each batch.  Keep this independently
     * correct as well: a consecutive batch starts at the boundary just
     * completed, never at a stale earlier machine-info reply. */
    this.lastBoundary = completed;
    if (this.checkpoint !== null) return response;
    if (completed < this.native.boundary) return response;
    if (completed !== this.native.boundary) {
      this.captureError = new RangeError("M7 run crossed the native C boundary without an exact stop");
      throw this.captureError;
    }
    const witness = await this.client.request("boot-witness");
    let parsedWitness;
    try {
      parsedWitness = parseM6CWitnessSample(witness, this.native.boundary);
    } catch {
      this.captureError = new TypeError("M7 portable C checkpoint lacks the complete Form-C M6 witness");
      throw this.captureError;
    }
    const frame = await this.client.request("display-full");
    const bytes = bytesOf(frame?.frame);
    if (frame?.status !== STATUS_OK || !frame.full || !frame.updated ||
        frame.width !== CADR_DISPLAY_WIDTH || frame.height !== CADR_DISPLAY_HEIGHT ||
        frame.blackOnWhite !== this.native.blackOnWhite || bytes === null) {
      this.captureError = new TypeError("M7 portable C checkpoint did not produce a full frame");
      throw this.captureError;
    }
    /* Validate before publishing a private copy to the caller. */
    rawWordsFromFullCdrDisp1(bytes);
    this.checkpoint = Object.freeze({
      boundary: this.native.boundary,
      witness_sample: parsedWitness.bytes,
      display_record: bytes.slice(),
    });
    return response;
  }
}

async function runM7CheckpointedM6BootInternal({ nativeCapture, ...config }, runBoot) {
  const client = new CadrM7CBoundaryClient(config.client, nativeCapture);
  const result = await runBoot({ ...config, client });
  if (result?.outcome !== "ready") {
    const reason = result?.report?.reason ?? "missing-failure-reason";
    const phase = result?.report?.phase ?? "missing-failure-phase";
    const status = Number.isSafeInteger(result?.report?.status) ?
      result.report.status : "missing-failure-status";
    const boundary = typeof result?.report?.boundary === "bigint" ?
      result.report.boundary.toString() :
      (typeof result?.report?.boundary === "number" ||
       typeof result?.report?.boundary === "string" ?
        String(result.report.boundary) : "missing-failure-boundary");
    throw new TypeError(
      `M7 frame checkpoint: underlying frozen M6 boot did not reach READY (${reason}; phase=${phase}; status=${status}; boundary=${boundary})`);
  }
  required(client.checkpoint !== null, "M6 reached READY without an M7 C checkpoint");
  const releaseRecordSha256 = bytesOf(result.releaseRecordSha256);
  required(releaseRecordSha256 !== null &&
    sameBytes(releaseRecordSha256, CADR_M6_RELEASE_RECORD_SHA256),
  "underlying M6 boot is not bound to the frozen release record");
  const checkpoint = Object.freeze({ ...client.checkpoint,
    m6_release_record_sha256: releaseRecordSha256.slice() });
  const comparison = await compareM7FrameCheckpoint(
    nativeCapture, checkpoint);
  return Object.freeze({ m6: result, checkpoint, comparison });
}

/** Execute the frozen production M6 state machine with the M7-only hook. */
export async function runM7CheckpointedM6Boot(config) {
  return runM7CheckpointedM6BootInternal(config, runM6HeadlessBoot);
}

/** Test-only seam: exercises M7 ordering without relaxing production M6. */
export async function runM7CheckpointedM6BootForTest(config, runBoot) {
  required(typeof runBoot === "function", "M7 test boot driver");
  return runM7CheckpointedM6BootInternal(config, runBoot);
}
