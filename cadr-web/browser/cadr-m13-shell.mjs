/*
 * CADR-WEB-303 M13 host shell.
 *
 * This is deliberately a new protocol-v8 trust boundary.  It does not teach
 * the historical v1--v7 worker to accept objects from the page.  Instead it
 * descriptor-validates a caller object, copies every accepted byte body into a
 * null-prototype record, and uses a private lower-protocol envelope only after
 * that admission has succeeded.  The lower worker therefore never receives a
 * File, Blob, URL, storage key, module, DOM object, function, port, or caller
 * ArrayBuffer.
 *
 * The implementation is a shell/conformance foundation, not evidence that the
 * M13 browser, storage, accessibility, or crash campaigns have run.  In
 * particular, `CadrM13StorageBoundary` is an authority-minimising adapter for
 * the already selected M10 service; it is not a replacement durable backend.
 */

export const CADR_M13_PROTOCOL_VERSION = 8;
export const CADR_M13_PROFILE =
  "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2";
export const CADR_M13_METADATA_MAGIC = "M13META1";
export const CADR_M13_MAX_PENDING = 64;
export const CADR_M13_MAX_METADATA_BYTES = 65536;
export const CADR_M13_MAX_METADATA_TOTAL = 4 * 1024 * 1024;
export const CADR_M13_MAX_BODY_BYTES = 16 * 1024 * 1024;
export const CADR_M13_MAX_STREAM_WINDOW_BYTES = 1024 * 1024;
export const CADR_M13_MAX_STREAM_WINDOWS = 2;
export const CADR_M13_MAX_SNAPSHOT_BYTES = 18131492;
/* Public M13 progress is deliberately capped to the exact lower v7 slice.
 * Larger requests would alter the selected worker's control-latency contract. */
export const CADR_M13_SCHEDULER_SLICE_MAX_SLOTS = 4096;
export const CADR_M13_BASE_BYTES = 269562880;
export const CADR_M13_BASE_BLOCKS = 263245;
export const CADR_M13_BASE_SHA256 =
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";

/* These are the four small, selected System 303 inputs which the v7 core
 * admits by copy.  The base image is deliberately absent: it is 269 MiB,
 * stays outside Wasm memory, and is streamed only through CadrM13BaseMediaBinding. */
const M13_SELECTED_BOOT_ARTIFACTS = Object.freeze([
  Object.freeze({ kind: 1, byteCount: 854 }),
  Object.freeze({ kind: 2, byteCount: 20480 }),
  Object.freeze({ kind: 4, byteCount: 3130 }),
  Object.freeze({ kind: 5, byteCount: 83270 }),
]);

export const CADR_M13_STATUS = Object.freeze({
  OK: 0,
  INVALID_REQUEST: 2,
  STALE: 3,
  HOST_FAILURE: 7,
  NOT_READY: 9,
  RESOURCE_LIMIT: 22,
  NO_MEMORY: 23,
  WORKER_LOST: 24,
  PROTOCOL_VIOLATION: 25,
  AUDIO_DEVICE_LOST: 26,
});

const MAX_U32 = 0xffffffff;
const MAX_U64 = 0xffffffffffffffffn;
const COMMON_FIELDS = Object.freeze(["type", "version", "sessionId", "id", "op"]);
const EMPTY = Object.freeze([]);
const UTF8 = new TextEncoder();

class M13AdmissionError extends Error {
  constructor(message, { status = CADR_M13_STATUS.INVALID_REQUEST, common = null } = {}) {
    super(message); this.name = "M13AdmissionError";
    this.status = status; this.common = common;
  }
}

function invariant(condition, message, options = undefined) {
  if (!condition) throw new M13AdmissionError(message, options);
}

function descriptorRecord(value, label, { allowed, required = EMPTY, maximumKeys = 32 } = {}) {
  invariant(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be a record`);
  const prototype = Object.getPrototypeOf(value);
  invariant(prototype === null || prototype === Object.prototype, `${label} must not have an inherited prototype`);
  const keys = Reflect.ownKeys(value);
  invariant(keys.length <= maximumKeys, `${label} has too many own keys`);
  invariant(keys.every(key => typeof key === "string"), `${label} has a symbol key`);
  const output = Object.create(null);
  for (const key of keys) {
    invariant(key.length <= 64 && ascii(key), `${label}.${key} key is not bounded ASCII`);
    invariant(allowed.includes(key), `${label}.${key} is not an allowed field`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    invariant(descriptor !== undefined && Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined && descriptor.set === undefined, `${label}.${key} is an accessor`);
    output[key] = descriptor.value;
  }
  for (const key of required) invariant(Object.hasOwn(output, key), `${label}.${key} is required`);
  return output;
}

function ascii(value) {
  return typeof value === "string" && /^[\x20-\x7e]*$/.test(value);
}

function hex(value, digits, label) {
  invariant(typeof value === "string" && new RegExp(`^[0-9a-f]{${digits}}$`).test(value),
    `${label} is not canonical lowercase hexadecimal`);
  return value;
}

function u32(value, label, { nonzero = false } = {}) {
  invariant(typeof value === "number" && Number.isSafeInteger(value) && value >= (nonzero ? 1 : 0) &&
    value <= MAX_U32 && !Object.is(value, -0), `${label} is not a uint32`);
  return value;
}

function u64(value, label) {
  invariant(typeof value === "bigint" && value >= 0n && value <= MAX_U64, `${label} is not a uint64`);
  return value;
}

function boolean(value, label) {
  invariant(typeof value === "boolean", `${label} is not a boolean`);
  return value;
}

function scalarString(value, label, { min = 0, max = 4096, asciiOnly = false } = {}) {
  invariant(typeof value === "string" && value.length >= min && value.length <= max,
    `${label} has an invalid UTF-16 length`);
  if (asciiOnly) invariant(ascii(value), `${label} is not ASCII`);
  let byteCount = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      invariant(index + 1 < value.length, `${label} has an unpaired surrogate`);
      const next = value.charCodeAt(index + 1);
      invariant(next >= 0xdc00 && next <= 0xdfff, `${label} has an unpaired surrogate`);
      byteCount += 4; index += 1;
    } else {
      invariant(code < 0xdc00 || code > 0xdfff, `${label} has an unpaired surrogate`);
      byteCount += code <= 0x7f ? 1 : (code <= 0x7ff ? 2 : 3);
    }
    invariant(byteCount <= max, `${label} exceeds its UTF-8 limit`);
  }
  return value;
}

function bytes(value, label, { min = 0, max = CADR_M13_MAX_BODY_BYTES, exact = null } = {}) {
  invariant(value instanceof ArrayBuffer, `${label} must be an ArrayBuffer`);
  const count = value.byteLength;
  invariant(count >= min && count <= max && (exact === null || count === exact), `${label} has an invalid byte length`);
  /* This copy is deliberately made before any postMessage transfer. */
  return value.slice(0);
}

async function sha256Hex(value) {
  const digest = await sha256Bytes(value);
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(value) {
  invariant(globalThis.crypto?.subtle?.digest !== undefined,
    "SHA-256 is unavailable for the selected base binding", { status: CADR_M13_STATUS.NOT_READY });
  const source = value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", source));
}

function equalBytes(left, right) {
  return left instanceof Uint8Array && right instanceof Uint8Array &&
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function hexBytes(value, label) {
  const source = hex(value, 64, label);
  const output = new Uint8Array(32);
  for (let index = 0; index < output.byteLength; index += 1) {
    output[index] = Number.parseInt(source.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function operationSchema(fields = EMPTY, options = {}) {
  return Object.freeze({ fields: Object.freeze(fields), ...options });
}

/* Exact M13 v8 external names.  `internal` members never admit a caller copy.
 * Field validation below intentionally stays at the v8 boundary; the selected
 * lower M8/M9/M11/M12 parsers retain their semantic validation afterwards. */
export const CADR_M13_OPERATION_SCHEMAS = Object.freeze({
  "base-import-begin": operationSchema(["role", "byteCount", "sha256"], { shell: true }),
  "base-import-chunk": operationSchema(["importId", "offset", "bytes", "chunkSha256"], { shell: true, body: "bytes", streaming: true }),
  "base-import-finish": operationSchema(["importId"], { shell: true }),
  /* This is the public v8 transition from an already adopted exact base to
   * the selected v7 artifact ingress.  It owns no pathname, Blob, File, or
   * storage key; importId names only the shell's adopted candidate. */
  "base-media-mount": operationSchema(["importId"], { mediaMount: true }),
  "base-range-read": operationSchema(["importId", "firstBlock", "blockCount"], { shell: true }),
  "m10-reopen": operationSchema(["diskUuid", "baseSha256", "profileSha256", "artifactSetSha256", "createIfMissing"], { shell: true }),
  "m10-writer-open": operationSchema(["sessionToken"], { shell: true }),
  "m10-writer-close": operationSchema(["sessionToken", "writerEpoch"], { shell: true }),
  "m10-export-open": operationSchema(["sessionToken", "expectedHeadSeq"], { shell: true }),
  "m10-export-next": operationSchema(["exportId", "maxBytes"], { shell: true }),
  "m10-export-close": operationSchema(["exportId"], { shell: true }),
  "snapshot-export-open": operationSchema(EMPTY, { shell: true }),
  "snapshot-export-next": operationSchema(["snapshotId", "offset", "maxBytes"], { shell: true }),
  "snapshot-export-close": operationSchema(["snapshotId"], { shell: true }),
  "snapshot-restore-begin": operationSchema(["byteCount", "snapshotSha256"], { shell: true }),
  "snapshot-restore-chunk": operationSchema(["restoreId", "offset", "bytes", "chunkSha256"], { shell: true, body: "bytes", streaming: true }),
  "snapshot-restore-finish": operationSchema(["restoreId"], { shell: true }),
  "snapshot-restore-abort": operationSchema(["restoreId"], { shell: true }),
  "m10-commit": operationSchema(["sessionToken", "writerEpoch", "expectedHeadSeq", "operation", "generation", "requestId", "lba", "page", "pageSha256"], { internal: true, body: "page" }),
  "host-next-request": operationSchema(EMPTY, { internal: true }),
  "host-complete": operationSchema(["operation", "hostStatus", "generation", "requestId", "bytes"], { internal: true, body: "bytes" }),
  bootstrap: operationSchema(["wasmBytes", "wasmSha256"], { worker: true, body: "wasmBytes" }),
  "machine-cold-power-on": operationSchema(EMPTY, { worker: true }),
  "machine-boot": operationSchema(EMPTY, { worker: true }),
  "machine-visibility": operationSchema(["hidden"], { worker: true }),
  "machine-start": operationSchema(EMPTY, { worker: true }),
  "machine-run": operationSchema(["clockSlots"], { worker: true }),
  "machine-pause": operationSchema(EMPTY, { worker: true }),
  "machine-reset": operationSchema(EMPTY, { worker: true }),
  "machine-stop": operationSchema(EMPTY, { worker: true }),
  "display-update": operationSchema(EMPTY, { worker: true }),
  "display-full": operationSchema(EMPTY, { worker: true }),
  "keyboard-down": operationSchema(["code", "repeat"], { worker: true }),
  "keyboard-up": operationSchema(["code"], { worker: true }),
  "keyboard-focus-lost": operationSchema(EMPTY, { worker: true }),
  "keyboard-drain": operationSchema(["maxEvents"], { worker: true }),
  "keyboard-state": operationSchema(EMPTY, { worker: true }),
  "pointer-motion": operationSchema(["x", "y", "cause", "tick", "generation", "ingressOrdinal"], { worker: true }),
  "pointer-down": operationSchema(["domButton", "x", "y", "cause", "tick", "generation", "ingressOrdinal"], { worker: true }),
  "pointer-up": operationSchema(["domButton", "x", "y", "cause", "tick", "generation", "ingressOrdinal"], { worker: true }),
  "pointer-neutralize": operationSchema(["cause", "tick", "generation"], { worker: true }),
  "pointer-warp-request": operationSchema(["cursorState", "x", "y", "generation"], { worker: true }),
  "pointer-state": operationSchema(EMPTY, { worker: true }),
  "pointer-drain": operationSchema(["maxEntries"], { worker: true }),
  "audio-open": operationSchema(["rendererProfile", "consumerEpoch"], { composite: true }),
  "audio-pause": operationSchema(EMPTY, { composite: true }),
  "audio-resume": operationSchema(EMPTY, { composite: true }),
  "audio-ack": operationSchema(["generation", "consumerEpoch", "sequence", "frameOffset"], { internal: true }),
  "audio-device-lost": operationSchema(["generation", "consumerEpoch", "sequence", "frameOffset", "cause"], { internal: true }),
  "debug-inspect-read": operationSchema(["arrayKind", "index"], { worker: true }),
  "debug-breakpoint-set": operationSchema(["slot", "breakpoint"], { worker: true }),
  "debug-breakpoint-clear": operationSchema(["slot"], { worker: true }),
  "debug-resume-one-boundary": operationSchema(EMPTY, { worker: true }),
  "debug-trace-filter": operationSchema(["filter"], { worker: true }),
  "debug-micro-step": operationSchema(EMPTY, { worker: true }),
  "debug-macro-step": operationSchema(EMPTY, { worker: true }),
  "debug-stop-record": operationSchema(EMPTY, { worker: true }),
});

function validateOperationFields(op, source) {
  const schema = CADR_M13_OPERATION_SCHEMAS[op];
  invariant(schema !== undefined, "operation is not part of the closed v8 surface");
  const fields = descriptorRecord(source, "request", {
    allowed: [...COMMON_FIELDS, ...schema.fields],
    required: [...COMMON_FIELDS],
  });
  const output = Object.create(null);
  for (const key of COMMON_FIELDS) output[key] = fields[key];
  for (const key of schema.fields) if (Object.hasOwn(fields, key)) output[key] = fields[key];

  switch (op) {
    case "base-import-begin":
      invariant(output.role === "system-303-base" && output.byteCount === CADR_M13_BASE_BYTES &&
        output.sha256 === CADR_M13_BASE_SHA256, "base import does not name the selected profile"); break;
    case "base-import-chunk":
      output.importId = u32(output.importId, "importId", { nonzero: true }); output.offset = u64(output.offset, "offset");
      output.bytes = bytes(output.bytes, "base chunk", { min: 1, max: CADR_M13_MAX_STREAM_WINDOW_BYTES });
      output.chunkSha256 = hex(output.chunkSha256, 64, "chunkSha256"); break;
    case "base-import-finish":
      output.importId = u32(output.importId, "importId", { nonzero: true }); break;
    case "base-media-mount":
      output.importId = u32(output.importId, "importId", { nonzero: true }); break;
    case "base-range-read":
      output.importId = u32(output.importId, "importId", { nonzero: true }); output.firstBlock = u32(output.firstBlock, "firstBlock");
      output.blockCount = u32(output.blockCount, "blockCount", { nonzero: true });
      invariant(output.blockCount <= 1024 && output.firstBlock + output.blockCount <= CADR_M13_BASE_BLOCKS, "base range is outside the selected image"); break;
    case "snapshot-restore-begin":
      output.byteCount = u32(output.byteCount, "snapshot byte count", { nonzero: true });
      invariant(output.byteCount <= CADR_M13_MAX_SNAPSHOT_BYTES, "snapshot exceeds M13 stream ceiling");
      output.snapshotSha256 = hex(output.snapshotSha256, 64, "snapshotSha256"); break;
    case "snapshot-restore-chunk":
      output.restoreId = u64(output.restoreId, "restoreId"); output.offset = u32(output.offset, "offset");
      output.bytes = bytes(output.bytes, "snapshot chunk", { min: 1, max: CADR_M13_MAX_STREAM_WINDOW_BYTES });
      output.chunkSha256 = hex(output.chunkSha256, 64, "chunkSha256"); break;
    case "m10-commit":
      for (const key of ["sessionToken", "writerEpoch", "expectedHeadSeq", "generation", "requestId", "lba"]) output[key] = u64(output[key], key);
      output.operation = u32(output.operation, "operation"); output.page = bytes(output.page, "overlay page", { exact: 1024 });
      output.pageSha256 = hex(output.pageSha256, 64, "pageSha256"); break;
    case "host-complete":
      output.operation = u32(output.operation, "operation"); output.hostStatus = u32(output.hostStatus, "hostStatus");
      output.generation = u64(output.generation, "generation"); output.requestId = u64(output.requestId, "requestId");
      output.bytes = bytes(output.bytes, "host completion", { max: CADR_M13_MAX_STREAM_WINDOW_BYTES }); break;
    case "bootstrap":
      output.wasmBytes = bytes(output.wasmBytes, "Wasm module", { min: 1, max: CADR_M13_MAX_BODY_BYTES });
      output.wasmSha256 = hex(output.wasmSha256, 64, "wasmSha256"); break;
    case "machine-visibility": output.hidden = boolean(output.hidden, "hidden"); break;
    case "machine-run":
      output.clockSlots = u32(output.clockSlots, "clockSlots", { nonzero: true });
      invariant(output.clockSlots <= CADR_M13_SCHEDULER_SLICE_MAX_SLOTS,
        "machine-run exceeds the selected v7 scheduler slice"); break;
    case "keyboard-down":
      output.code = scalarString(output.code, "keyboard code", { min: 1, max: 64, asciiOnly: true });
      if (Object.hasOwn(output, "repeat")) output.repeat = boolean(output.repeat, "repeat"); break;
    case "keyboard-up": output.code = scalarString(output.code, "keyboard code", { min: 1, max: 64, asciiOnly: true }); break;
    case "keyboard-drain": if (Object.hasOwn(output, "maxEvents")) output.maxEvents = u32(output.maxEvents, "maxEvents"); break;
    case "pointer-motion":
      output.x = u32(output.x, "x"); output.y = u32(output.y, "y");
      validatePointerIngress(output, { needsButton: false }); break;
    case "pointer-down":
      output.domButton = u32(output.domButton, "domButton"); output.x = u32(output.x, "x"); output.y = u32(output.y, "y");
      validatePointerIngress(output, { needsButton: true }); break;
    case "pointer-up":
      output.domButton = u32(output.domButton, "domButton");
      invariant((Object.hasOwn(output, "x") && Object.hasOwn(output, "y")) ||
        (!Object.hasOwn(output, "x") && !Object.hasOwn(output, "y")), "pointer-up coordinates must be paired");
      if (Object.hasOwn(output, "x")) { output.x = u32(output.x, "x"); output.y = u32(output.y, "y"); }
      validatePointerIngress(output, { needsButton: true }); break;
    case "pointer-neutralize":
      if (Object.hasOwn(output, "cause")) output.cause = scalarString(output.cause, "pointer cause", { min: 1, max: 64, asciiOnly: true });
      if (Object.hasOwn(output, "tick")) output.tick = u64(output.tick, "tick");
      if (Object.hasOwn(output, "generation")) output.generation = u32(output.generation, "generation"); break;
    case "pointer-warp-request":
      output.cursorState = u32(output.cursorState, "cursorState"); output.x = u32(output.x, "x"); output.y = u32(output.y, "y"); output.generation = u32(output.generation, "generation"); break;
    case "pointer-drain": if (Object.hasOwn(output, "maxEntries")) output.maxEntries = u32(output.maxEntries, "maxEntries"); break;
    case "audio-open": output.rendererProfile = scalarString(output.rendererProfile, "renderer profile", { min: 1, max: 256, asciiOnly: true }); output.consumerEpoch = u64(output.consumerEpoch, "consumerEpoch"); break;
    case "audio-ack": for (const key of ["generation", "consumerEpoch", "sequence"]) output[key] = u64(output[key], key); output.frameOffset = u32(output.frameOffset, "frameOffset"); break;
    case "audio-device-lost":
      output.generation = u64(output.generation, "generation"); output.consumerEpoch = u64(output.consumerEpoch, "consumerEpoch");
      invariant(output.sequence === null || typeof output.sequence === "bigint", "sequence is invalid");
      invariant(output.frameOffset === null || (Number.isSafeInteger(output.frameOffset) && output.frameOffset >= 0), "frameOffset is invalid");
      output.cause = scalarString(output.cause, "audio loss cause", { min: 1, max: 64, asciiOnly: true }); break;
    case "debug-inspect-read":
      output.arrayKind = u32(output.arrayKind, "inspector array kind");
      invariant(output.arrayKind >= 1 && output.arrayKind <= 5, "inspector array kind");
      output.index = u32(output.index, "inspector index"); break;
    case "debug-breakpoint-set": output.slot = u32(output.slot, "slot"); output.breakpoint = nestedRecord(output.breakpoint, "breakpoint", 1); break;
    case "debug-breakpoint-clear": output.slot = u32(output.slot, "slot"); break;
    case "debug-trace-filter": output.filter = nestedRecord(output.filter, "filter", 1); break;
    default:
      for (const key of schema.fields) {
        if (Object.hasOwn(output, key) && /(Id|Token|Epoch|Seq|generation|headSeq|offset|lba|requestId)$/.test(key)) output[key] = u64(output[key], key);
        else if (Object.hasOwn(output, key) && /(sha256|Sha256)$/.test(key)) output[key] = hex(output[key], 64, key);
        else if (Object.hasOwn(output, key) && key === "diskUuid") output[key] = hex(output[key], 32, key);
        else if (Object.hasOwn(output, key) && key === "createIfMissing") output[key] = boolean(output[key], key);
        else if (Object.hasOwn(output, key) && /(maxBytes|byteCount)$/.test(key)) output[key] = u32(output[key], key, { nonzero: true });
      }
  }
  return Object.freeze(output);
}

function validatePointerIngress(output, { needsButton }) {
  invariant(output.x < 768 && output.y < 963, "pointer coordinate is outside EDGE32");
  if (needsButton) invariant(output.domButton <= 2, "pointer button is outside CADR tail/middle/head");
  if (Object.hasOwn(output, "cause")) output.cause = scalarString(output.cause, "pointer cause", { min: 1, max: 64, asciiOnly: true });
  if (Object.hasOwn(output, "tick")) output.tick = u64(output.tick, "tick");
  if (Object.hasOwn(output, "generation")) output.generation = u32(output.generation, "generation");
  if (Object.hasOwn(output, "ingressOrdinal")) output.ingressOrdinal = u64(output.ingressOrdinal, "ingressOrdinal");
}

function nestedRecord(value, label, depth) {
  invariant(depth <= 16, `${label} nesting exceeds M13 limit`);
  const record = descriptorRecord(value, label, { allowed: Reflect.ownKeys(value).filter(key => typeof key === "string"), maximumKeys: 32 });
  const copy = Object.create(null);
  for (const [key, item] of Object.entries(record)) {
    invariant(key.length <= 64, `${label}.${key} key is too long`);
    if (item !== null && typeof item === "object") copy[key] = nestedRecord(item, `${label}.${key}`, depth + 1);
    else if (typeof item === "string") copy[key] = scalarString(item, `${label}.${key}`);
    else if (typeof item === "number") copy[key] = u32(item, `${label}.${key}`);
    else if (typeof item === "bigint") copy[key] = u64(item, `${label}.${key}`);
    else if (typeof item === "boolean" || item === null) copy[key] = item;
    else invariant(false, `${label}.${key} has a forbidden value`);
  }
  return Object.freeze(copy);
}

function validateCommon(source, sessionId) {
  /* Do not fetch an unknown field's descriptor value.  The operation pass
   * below rejects its name before it reaches the value traversal. */
  invariant(source !== null && typeof source === "object" && !Array.isArray(source), "request must be a record");
  const prototype = Object.getPrototypeOf(source);
  invariant(prototype === null || prototype === Object.prototype, "request must not have an inherited prototype");
  const fields = Object.create(null);
  for (const key of COMMON_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    invariant(descriptor !== undefined && Object.hasOwn(descriptor, "value") && descriptor.get === undefined && descriptor.set === undefined,
      `request.${key} is missing or an accessor`);
    fields[key] = descriptor.value;
  }
  invariant(fields.type === "cadr-request" && fields.version === CADR_M13_PROTOCOL_VERSION, "request is not a v8 envelope");
  const common = Object.create(null);
  common.type = fields.type; common.version = fields.version;
  common.sessionId = hex(fields.sessionId, 64, "sessionId");
  common.id = u32(fields.id, "id", { nonzero: true });
  common.op = scalarString(fields.op, "op", { min: 1, max: 64, asciiOnly: true });
  invariant(common.sessionId === sessionId, "request session does not match this shell", { common });
  return common;
}

/* M13META1 field tags.  The specification names the wire accounting format,
 * but does not assign tag numbers; these numbers are frozen by this module's
 * profile string and exercised by the independent encoder fixture tests. */
const META_TAG = Object.freeze({ BOOLEAN: 1, U32: 2, U64: 3, NULL: 4, STRING: 5, ARRAY: 6, RECORD: 7, BUFFER: 8 });
function pushU16(output, value) { output.push(value & 255, (value >>> 8) & 255); }
function pushU32(output, value) { output.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); }
function pushU64(output, value) { for (let index = 0n; index < 8n; index += 1n) output.push(Number((value >> (index * 8n)) & 255n)); }

async function encodeValue(output, value, depth = 0) {
  invariant(depth <= 16, "metadata nesting exceeds M13 limit");
  if (value === null) { output.push(META_TAG.NULL); return; }
  if (typeof value === "boolean") { output.push(META_TAG.BOOLEAN, value ? 1 : 0); return; }
  if (typeof value === "number") { output.push(META_TAG.U32); pushU32(output, u32(value, "metadata uint32")); return; }
  if (typeof value === "bigint") { output.push(META_TAG.U64); pushU64(output, u64(value, "metadata uint64")); return; }
  if (typeof value === "string") {
    const checked = scalarString(value, "metadata string"); const encoded = UTF8.encode(checked);
    output.push(META_TAG.STRING); pushU32(output, encoded.byteLength); output.push(...encoded); return;
  }
  if (value instanceof ArrayBuffer) {
    output.push(META_TAG.BUFFER); pushU64(output, BigInt(value.byteLength));
    output.push(...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", value))); return;
  }
  if (Array.isArray(value)) {
    invariant(value.length <= 256, "metadata array exceeds M13 limit"); output.push(META_TAG.ARRAY); pushU32(output, value.length);
    for (const item of value) await encodeValue(output, item, depth + 1); return;
  }
  invariant(value !== null && typeof value === "object", "metadata value is unsupported");
  const keys = Object.keys(value);
  invariant(keys.length <= 32, "metadata record exceeds M13 limit"); output.push(META_TAG.RECORD); pushU32(output, keys.length);
  for (const key of keys) { const encoded = UTF8.encode(key); pushU16(output, encoded.byteLength); output.push(...encoded); await encodeValue(output, value[key], depth + 1); }
}

export async function encodeCadrM13Meta1(request) {
  const output = [...UTF8.encode(CADR_M13_METADATA_MAGIC)];
  const keys = Object.keys(request);
  pushU32(output, keys.length);
  for (const key of keys) {
    const encoded = UTF8.encode(key); pushU16(output, encoded.byteLength); output.push(...encoded);
    await encodeValue(output, request[key]);
    invariant(output.length <= CADR_M13_MAX_METADATA_BYTES, "M13META1 exceeds one-record ceiling");
  }
  return Uint8Array.from(output);
}

export async function canonicalizeCadrM13Request(candidate, { sessionId } = {}) {
  const common = validateCommon(candidate, sessionId);
  const canonical = validateOperationFields(common.op, candidate);
  const metadata = await encodeCadrM13Meta1(canonical);
  return Object.freeze({ request: canonical, metadata, metadataBytes: metadata.byteLength });
}

/** The worker-side half intentionally checks only what structured clone keeps. */
export function validateCadrM13PostCloneRequest(value) {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) return false;
    const candidateKeys = Reflect.ownKeys(value);
    if (candidateKeys.length > 32 || !candidateKeys.every(key => typeof key === "string")) return false;
    const common = Object.create(null);
    for (const key of COMMON_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || descriptor.get !== undefined || descriptor.set !== undefined) return false;
      common[key] = descriptor.value;
    }
    if (common.type !== "cadr-request" || common.version !== CADR_M13_PROTOCOL_VERSION ||
        !/^[0-9a-f]{64}$/.test(common.sessionId) || !Number.isSafeInteger(common.id) ||
        common.id < 1 || common.id > MAX_U32 || typeof common.op !== "string") return false;
    if (CADR_M13_OPERATION_SCHEMAS[common.op] === undefined) return false;
    validateOperationFields(common.op, value);
    return true;
  } catch { return false; }
}

export class CadrM13AdmissionLedger {
  #pending = new Map();
  #metadataBytes = 0;
  #regularBodyLive = false;
  #streamWindows = 0;
  #allocation;
  constructor({ allocation = null } = {}) {
    invariant(allocation === null || typeof allocation === "function", "allocation injector must be a function");
    this.#allocation = allocation;
  }
  reserve(id, { metadataBytes, bodyBytes = 0, streaming = false } = {}) {
    invariant(!this.#pending.has(id), "request reservation already exists");
    invariant(this.#pending.size < CADR_M13_MAX_PENDING, "pending request ceiling", { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    invariant(Number.isSafeInteger(metadataBytes) && metadataBytes >= 0 && metadataBytes <= CADR_M13_MAX_METADATA_BYTES,
      "metadata reservation ceiling", { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    invariant(this.#metadataBytes + metadataBytes <= CADR_M13_MAX_METADATA_TOTAL, "aggregate metadata ceiling", { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    invariant(typeof streaming === "boolean" && Number.isSafeInteger(bodyBytes) && bodyBytes >= 0,
      "body reservation is invalid", { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    if (streaming) {
      invariant(bodyBytes <= CADR_M13_MAX_STREAM_WINDOW_BYTES && !this.#regularBodyLive &&
        (bodyBytes === 0 || this.#streamWindows < CADR_M13_MAX_STREAM_WINDOWS),
      "stream window reservation ceiling", { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    } else {
      invariant(bodyBytes <= CADR_M13_MAX_BODY_BYTES && !this.#regularBodyLive &&
        (bodyBytes === 0 || this.#streamWindows === 0), "non-stream body reservation ceiling",
      { status: CADR_M13_STATUS.RESOURCE_LIMIT });
    }
    /* This hook represents only a deterministic allocation failure after all
     * limits are checked and before any counter changes.  It is deliberately
     * distinct from browser OOM/process-loss testing. */
    for (const point of bodyBytes === 0 ? ["metadata"] : ["metadata", streaming ? "stream-window" : "body"]) {
      if (this.#allocation?.(Object.freeze({ point, id, metadataBytes, bodyBytes, streaming })) === false) {
        throw new M13AdmissionError(`injected allocation failure at ${point}`, { status: CADR_M13_STATUS.NO_MEMORY });
      }
    }
    this.#pending.set(id, { metadataBytes, bodyBytes, streaming }); this.#metadataBytes += metadataBytes;
    if (bodyBytes !== 0) {
      if (streaming) this.#streamWindows += 1;
      else this.#regularBodyLive = true;
    }
  }
  release(id) {
    const reservation = this.#pending.get(id); if (reservation === undefined) return;
    this.#pending.delete(id); this.#metadataBytes -= reservation.metadataBytes;
    if (reservation.bodyBytes !== 0) {
      if (reservation.streaming) this.#streamWindows -= 1;
      else this.#regularBodyLive = false;
    }
  }
  snapshot() { return Object.freeze({ pending: this.#pending.size, metadataBytes: this.#metadataBytes,
    bodyLive: this.#regularBodyLive || this.#streamWindows !== 0, regularBodyLive: this.#regularBodyLive,
    streamWindows: this.#streamWindows }); }
}

function randomSession(randomBytes) {
  const bytesValue = randomBytes === undefined ? globalThis.crypto.getRandomValues(new Uint8Array(32)) : randomBytes();
  invariant(bytesValue instanceof Uint8Array && bytesValue.byteLength === 32, "session source must produce 32 random bytes");
  return [...bytesValue].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function response(request, status, tail = Object.create(null), { terminal = false } = {}) {
  const result = Object.create(null);
  result.type = "cadr-response"; result.version = CADR_M13_PROTOCOL_VERSION; result.sessionId = request.sessionId;
  result.id = request.id; result.op = request.op; result.status = status; result.ok = status === CADR_M13_STATUS.OK; result.terminal = terminal;
  for (const [key, value] of Object.entries(tail)) result[key] = value;
  return Object.freeze(result);
}

function terminalizeResponse(value) {
  if (value.terminal === true) return value;
  const result = Object.assign(Object.create(null), value);
  result.terminal = true;
  return Object.freeze(result);
}

function shellReason(status) {
  return Object.freeze({
    [CADR_M13_STATUS.INVALID_REQUEST]: "invalid-request", [CADR_M13_STATUS.STALE]: "stale",
    [CADR_M13_STATUS.HOST_FAILURE]: "host-failure", [CADR_M13_STATUS.NOT_READY]: "not-ready",
    [CADR_M13_STATUS.RESOURCE_LIMIT]: "resource-limit", [CADR_M13_STATUS.NO_MEMORY]: "no-memory",
    [CADR_M13_STATUS.WORKER_LOST]: "worker-lost", [CADR_M13_STATUS.PROTOCOL_VIOLATION]: "protocol-violation",
    [CADR_M13_STATUS.AUDIO_DEVICE_LOST]: "audio-device-lost",
  })[status] ?? "host-failure";
}

const LOWER_OPERATION = Object.freeze({
  "machine-cold-power-on": "cold-power-on", "machine-boot": "boot", "machine-visibility": "scheduler-visibility",
  "machine-start": "scheduler-start", "machine-run": "scheduler-run-v7-slice", "machine-pause": "scheduler-pause",
  "machine-reset": "scheduler-reset", "machine-stop": "scheduler-stop",
});
const LOWER_REMAINDER = new Set(["lifecycle", "hidden", "completedSlots", "microinstructionsExecuted",
  "discardedUnsavedState", "updated", "frame", "result", "reason", "audio", "state", "byteCount",
  "coreSha256", "lastFailureEvidence", "terminal", "queuePackets", "queuedFrames"]);
const M10_HOST_DESCRIPTOR_BYTES = 64;
const M10_HOST_REQUEST_PAYLOAD_BYTES = 1024;
const M10_HOST_COMPLETION_BYTES = 1024 * 1024;
const M10_CONTROLLER_IN_DOUBT = "IN_DOUBT";

function copiedInternalBytes(value, label, maximum) {
  const source = value instanceof ArrayBuffer ? new Uint8Array(value) :
    (ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null);
  invariant(source !== null && source.byteLength <= maximum, `${label} has an invalid byte length`);
  return source.slice().buffer;
}

function safeM10HostRequest(value) {
  const fields = descriptorRecord(value, "M10 host request", {
    allowed: ["operation", "generation", "requestId", "descriptorByteCount", "completionByteCount", "requestPayloadByteCount"],
    required: ["operation", "generation", "requestId", "descriptorByteCount", "completionByteCount", "requestPayloadByteCount"],
    maximumKeys: 6,
  });
  const result = Object.create(null);
  result.operation = u32(fields.operation, "M10 host operation");
  result.generation = u64(fields.generation, "M10 host generation");
  result.requestId = u64(fields.requestId, "M10 host request ID");
  result.descriptorByteCount = u64(fields.descriptorByteCount, "M10 descriptor byte count");
  result.completionByteCount = u64(fields.completionByteCount, "M10 completion byte count");
  result.requestPayloadByteCount = u64(fields.requestPayloadByteCount, "M10 request payload byte count");
  invariant(result.descriptorByteCount <= BigInt(M10_HOST_DESCRIPTOR_BYTES) &&
    result.requestPayloadByteCount <= BigInt(M10_HOST_REQUEST_PAYLOAD_BYTES) &&
    result.completionByteCount <= BigInt(M10_HOST_COMPLETION_BYTES),
  "M10 host request exceeds its lower protocol ceiling");
  return Object.freeze(result);
}

function safeWorkerResponse(value, expectedId, expectedOp) {
  const hostNext = expectedOp === "host-next-request";
  const allowed = ["type", "version", "id", "op", "status", "ok", ...LOWER_REMAINDER,
    ...(hostNext ? ["request", "descriptor", "requestPayload"] : [])];
  const fields = descriptorRecord(value, "worker response", { allowed, required: ["type", "version", "id", "op", "status", "ok"] });
  invariant(fields.type === "cadr-response" && fields.version === 7 && fields.id === expectedId && fields.op === expectedOp &&
    Number.isSafeInteger(fields.status) && fields.status >= 0 && fields.status <= MAX_U32 && fields.ok === (fields.status === 0),
    "worker response does not correlate to the private request");
  const result = Object.create(null);
  for (const key of LOWER_REMAINDER) if (Object.hasOwn(fields, key)) result[key] = fields[key];
  if (hostNext && fields.status === CADR_M13_STATUS.OK) {
    invariant(Object.hasOwn(fields, "request") && Object.hasOwn(fields, "descriptor") && Object.hasOwn(fields, "requestPayload"),
      "successful M10 host request is incomplete");
    const request = safeM10HostRequest(fields.request);
    const descriptor = copiedInternalBytes(fields.descriptor, "M10 host descriptor", M10_HOST_DESCRIPTOR_BYTES);
    const requestPayload = copiedInternalBytes(fields.requestPayload, "M10 host payload", M10_HOST_REQUEST_PAYLOAD_BYTES);
    invariant(BigInt(descriptor.byteLength) === request.descriptorByteCount &&
      BigInt(requestPayload.byteLength) === request.requestPayloadByteCount,
    "M10 host request lengths do not match its byte bodies");
    result.request = request; result.descriptor = descriptor; result.requestPayload = requestPayload;
  } else if (hostNext) {
    invariant(!Object.hasOwn(fields, "request") && !Object.hasOwn(fields, "descriptor") && !Object.hasOwn(fields, "requestPayload"),
      "unsuccessful M10 host request leaks a body");
  }
  return Object.freeze({ status: fields.status, remainder: result });
}

function attach(worker, type, listener) {
  if (typeof worker.addEventListener === "function") { worker.addEventListener(type, listener); return () => worker.removeEventListener(type, listener); }
  if (typeof worker.on === "function") { worker.on(type, listener); return () => worker.off?.(type, listener); }
  throw new TypeError("M13 shell worker lacks an event listener API");
}

/**
 * Strict named-method adapter.  A supplied M10 implementation may be complex,
 * but it cannot obtain an unchecked caller pathname/key through this boundary.
 */
export class CadrM13StorageBoundary {
  #service;
  constructor(service) { invariant(service !== null && typeof service === "object", "M13 storage service is required"); this.#service = service; }
  async invoke(op, request) {
    const method = ({
      "base-import-begin": "beginBaseImport", "base-import-chunk": "appendBaseImport", "base-import-finish": "finishBaseImport",
      "base-range-read": "readBaseRange", "m10-reopen": "reopenDisk", "m10-writer-open": "openWriter",
      "m10-writer-close": "closeWriter", "m10-export-open": "openExport", "m10-export-next": "nextExport",
      "m10-export-close": "closeExport", "snapshot-export-open": "openSnapshotExport",
      "snapshot-export-next": "nextSnapshotExport", "snapshot-export-close": "closeSnapshotExport",
      "snapshot-restore-begin": "beginSnapshotRestore", "snapshot-restore-chunk": "appendSnapshotRestore",
      "snapshot-restore-finish": "finishSnapshotRestore", "snapshot-restore-abort": "abortSnapshotRestore",
      "m10-commit": "commitGuestPage",
    })[op];
    invariant(method !== undefined && typeof this.#service[method] === "function", "storage operation is not available", { status: CADR_M13_STATUS.NOT_READY });
    /* Canonical records have neither prototype properties nor caller buffers. */
    return this.#service[method](request);
  }
}

/*
 * A single-purpose binding between an M13-owned base-media store and the two
 * consumers which must see exactly the same immutable bytes: the v7 artifact
 * verifier during mount and C-M10 after mount.  It exposes no pathname, URL,
 * File, Blob, storage key, or bulk base buffer to the guest worker.
 *
 * `readBlock` is intentionally unavailable until the selected v7 verifier has
 * accepted the complete stream.  A C-M10 controller should receive this bound
 * method as its `readBasePage` callback; using an independent fetch callback
 * would not establish a same-base composition claim.
 */
export class CadrM13BaseMediaBinding {
  #storage; #phase = "IDLE"; #importId = null; #nextMountBlock = 0; #mountChunkHashes = [];

  constructor({ storage } = {}) {
    invariant(storage instanceof CadrM13StorageBoundary,
      "M13 base media needs a storage boundary");
    this.#storage = storage;
  }

  get state() { return this.#phase; }
  get importId() { return this.#importId; }

  /* The shell must never finish an import in one capability and then read its
   * nominal import ID through another.  This identity check intentionally
   * reveals neither a backing-store key nor the backing-store object. */
  usesStorage(storage) { return storage === this.#storage; }

  beginMount(importId) {
    invariant(this.#phase === "IDLE", "M13 base media is already mounted");
    this.#importId = u32(importId, "M13 base import ID", { nonzero: true });
    this.#nextMountBlock = 0; this.#mountChunkHashes = [];
    this.#phase = "MOUNTING";
  }

  abortMount() {
    if (this.#phase === "MOUNTING") {
      this.#importId = null; this.#nextMountBlock = 0; this.#mountChunkHashes = [];
      this.#phase = "IDLE";
    }
  }

  finishMount() {
    invariant(this.#phase === "MOUNTING" && this.#importId !== null,
      "M13 base media mount is not active");
    invariant(this.#nextMountBlock === CADR_M13_BASE_BLOCKS &&
      this.#mountChunkHashes.length === Math.ceil(CADR_M13_BASE_BLOCKS / 1024),
    "M13 base media mount did not retain every verified range");
    this.#phase = "MOUNTED";
  }

  async readMountRange(firstBlock, blockCount) {
    invariant(this.#phase === "MOUNTING" && this.#importId !== null,
      "M13 base media mount is not active");
    const first = u32(firstBlock, "M13 base mount first block");
    const count = u32(blockCount, "M13 base mount block count", { nonzero: true });
    const expectedCount = Math.min(1024, CADR_M13_BASE_BLOCKS - this.#nextMountBlock);
    invariant(first === this.#nextMountBlock && count === expectedCount,
      "M13 base media mount range is not the fixed canonical stream");
    const body = await this.#readRange(this.#importId, first, count);
    this.#mountChunkHashes.push(await sha256Bytes(body));
    this.#nextMountBlock += count;
    return body;
  }

  async readBlock(firstBlock) {
    invariant(this.#phase === "MOUNTED" && this.#importId !== null,
      "M13 base media has not passed v7 verification");
    const first = u32(firstBlock, "M13 base block");
    invariant(first < CADR_M13_BASE_BLOCKS, "M13 base block is outside the selected image");
    /* Re-read and verify the entire canonical mount chunk.  A later M10 page
     * therefore cannot silently come from a mutable File/Blob/storage view
     * that changed after the v7 full-stream verifier accepted it. */
    const chunkIndex = Math.floor(first / 1024);
    const chunkFirstBlock = chunkIndex * 1024;
    const chunkBlockCount = Math.min(1024, CADR_M13_BASE_BLOCKS - chunkFirstBlock);
    const expected = this.#mountChunkHashes[chunkIndex];
    invariant(expected instanceof Uint8Array && expected.byteLength === 32,
      "M13 base media has no retained verification witness");
    const chunk = await this.#readRange(this.#importId, chunkFirstBlock, chunkBlockCount);
    const observed = await sha256Bytes(chunk);
    invariant(equalBytes(observed, expected),
      "M13 base media changed after v7 verification", { status: CADR_M13_STATUS.HOST_FAILURE });
    const offset = (first - chunkFirstBlock) * 1024;
    return chunk.slice(offset, offset + 1024);
  }

  verifiedBaseIdentity() {
    invariant(this.#phase === "MOUNTED" && this.#importId !== null &&
      this.#nextMountBlock === CADR_M13_BASE_BLOCKS &&
      this.#mountChunkHashes.length === Math.ceil(CADR_M13_BASE_BLOCKS / 1024),
    "M13 base media has not passed the selected verification stream");
    /* This selected digest is exposed only after all retained chunk witnesses
     * were fed to and accepted by the independent v7 full-stream verifier. */
    return hexBytes(CADR_M13_BASE_SHA256, "selected base SHA-256");
  }

  async #readRange(importId, firstBlock, blockCount) {
    const first = u32(firstBlock, "M13 base first block");
    const count = u32(blockCount, "M13 base block count", { nonzero: true });
    invariant(count <= 1024 && first + count <= CADR_M13_BASE_BLOCKS,
      "M13 base range is outside the selected image");
    const request = Object.freeze(Object.assign(Object.create(null), {
      importId, firstBlock: first, blockCount: count,
    }));
    const response = await this.#storage.invoke("base-range-read", request);
    const fields = descriptorRecord(response, "M13 base range response", {
      allowed: ["bytes"], required: ["bytes"], maximumKeys: 1,
    });
    const body = copiedInternalBytes(fields.bytes, "M13 base range bytes",
      CADR_M13_MAX_STREAM_WINDOW_BYTES);
    invariant(body.byteLength === count * 1024,
      "M13 base range response has the wrong length");
    return new Uint8Array(body);
  }
}

function selectedBootArtifacts(value) {
  invariant(Array.isArray(value) && value.length === M13_SELECTED_BOOT_ARTIFACTS.length,
    "M13 selected boot artifacts are incomplete");
  const byKind = new Map();
  for (const candidate of value) {
    const fields = descriptorRecord(candidate, "M13 selected boot artifact", {
      allowed: ["kind", "bytes"], required: ["kind", "bytes"], maximumKeys: 2,
    });
    const kind = u32(fields.kind, "M13 selected boot artifact kind", { nonzero: true });
    invariant(!byKind.has(kind), "M13 selected boot artifact is duplicated");
    byKind.set(kind, copiedInternalBytes(fields.bytes, "M13 selected boot artifact bytes",
      CADR_M13_MAX_STREAM_WINDOW_BYTES));
  }
  const result = [];
  for (const expected of M13_SELECTED_BOOT_ARTIFACTS) {
    const body = byKind.get(expected.kind);
    invariant(body !== undefined && body.byteLength === expected.byteCount,
      "M13 selected boot artifact has the wrong length");
    result.push(Object.freeze({ kind: expected.kind, bytes: body }));
  }
  return Object.freeze(result);
}

/* The storage implementation owns streaming/import persistence.  The v8 shell
 * owns the transition that makes its returned import ID eligible for the v7
 * selected-media mount, and verifies that it is the one fixed profile rather
 * than a merely successful arbitrary import. */
function assertSelectedBaseImportResult(value) {
  const fields = descriptorRecord(value, "M13 selected base import result", {
    allowed: ["role", "byteCount", "sha256", "blockBytes", "blockCount"],
    required: ["role", "byteCount", "sha256", "blockBytes", "blockCount"],
    maximumKeys: 5,
  });
  invariant(fields.role === "system-303-base" && u64(fields.byteCount, "M13 selected base byte count") === BigInt(CADR_M13_BASE_BYTES) &&
    hex(fields.sha256, 64, "M13 selected base SHA-256") === CADR_M13_BASE_SHA256 &&
    u32(fields.blockBytes, "M13 selected base block bytes") === 1024 &&
    u32(fields.blockCount, "M13 selected base block count") === CADR_M13_BASE_BLOCKS,
  "M13 completed base import is not the selected System 303 base", { status: CADR_M13_STATUS.INVALID_REQUEST });
}

function assertSelectedM10Ready(controller) {
  invariant(controller !== null && typeof controller.status === "function",
    "M13 selected media has no M10 controller status", { status: CADR_M13_STATUS.NOT_READY });
  const fields = descriptorRecord(controller.status(), "M13 selected M10 controller status", {
    allowed: ["state", "open", "readOnly"], required: ["state", "open", "readOnly"], maximumKeys: 3,
  });
  invariant(fields.state === "CLEAN" && fields.open === true && fields.readOnly === false,
    "M13 selected M10 controller is not a clean writable session", { status: CADR_M13_STATUS.NOT_READY });
}

export class CadrM13Shell {
  #worker; #storage; #ledger = new CadrM13AdmissionLedger(); #sessionId; #expectedId = 1; #workerId = 1;
  #pending = new Map(); #terminal = false; #state = "NEW"; #releaseTarget; #releaseControl; #guestSurface; #statusSink;
  #workerDetach = []; #timeoutMs; #setTimeout; #clearTimeout; #wasmCompiler; #capturedPointerId = null; #ingressEnabled = true;
  #lastStatus = null; #m10Controller = null; #m10Bridge = null;
  #baseMediaBinding = null; #selectedBootArtifacts = null; #mediaMounted = false;
  #selectedWasmSha256 = null; #bootstrapped = false; #adoptedBaseImportId = null; #m10Ready = false;

  constructor({ worker, storage = null, sessionRandom = undefined, releaseTarget = null, releaseControl = null,
    guestSurface = null, statusSink = null, timeoutMs = 10000,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis), m10Controller = null, m10BridgeFactory = null,
    baseMediaBinding = null, selectedBootArtifacts: configuredBootArtifacts = null,
    selectedWasmSha256 = null,
    wasmCompiler = globalThis.WebAssembly?.compile.bind(globalThis.WebAssembly), initialId = 1 } = {}) {
    invariant(worker !== null && typeof worker === "object" && typeof worker.postMessage === "function", "M13 shell needs a dedicated worker");
    invariant(typeof timeoutMs === "number" && timeoutMs > 0, "worker timeout must be positive");
    this.#worker = worker; this.#storage = storage === null ? null : (storage instanceof CadrM13StorageBoundary ? storage : new CadrM13StorageBoundary(storage));
    invariant(Number.isSafeInteger(initialId) && initialId >= 1 && initialId <= MAX_U32, "initial v8 request ID is invalid"); this.#expectedId = initialId;
    this.#sessionId = randomSession(sessionRandom); this.#releaseTarget = releaseTarget; this.#releaseControl = releaseControl;
    this.#guestSurface = guestSurface; this.#statusSink = statusSink; this.#timeoutMs = timeoutMs; this.#setTimeout = setTimeoutFn; this.#clearTimeout = clearTimeoutFn; this.#wasmCompiler = wasmCompiler;
    if (m10Controller !== null) {
      invariant(typeof m10Controller === "object" && typeof m10Controller.commitWrites === "function" &&
        typeof m10Controller.readBlock === "function" && typeof m10Controller.invalidateAfterAmbiguousGuest === "function",
      "M13 M10 controller is incomplete");
      invariant(typeof m10BridgeFactory === "function", "M13 M10 bridge factory is required");
      this.#m10Controller = m10Controller;
      this.#m10Bridge = m10BridgeFactory(Object.freeze({ controller: m10Controller,
        channel: Object.freeze({ submit: request => this.#submitM10Internal(request) }) }));
      invariant(this.#m10Bridge !== null && typeof this.#m10Bridge.serviceOnce === "function",
        "M13 M10 bridge factory returned an incomplete bridge");
    }
    if (baseMediaBinding !== null || configuredBootArtifacts !== null) {
      invariant(baseMediaBinding instanceof CadrM13BaseMediaBinding &&
        configuredBootArtifacts !== null && this.#storage !== null &&
        baseMediaBinding.usesStorage(this.#storage) && selectedWasmSha256 !== null,
      "M13 selected media needs one storage boundary, its base binding, boot artifacts, and selected Wasm identity");
      this.#baseMediaBinding = baseMediaBinding;
      this.#selectedBootArtifacts = selectedBootArtifacts(configuredBootArtifacts);
      this.#selectedWasmSha256 = hex(selectedWasmSha256, 64, "M13 selected Wasm SHA-256");
    }
    this.#workerDetach.push(attach(worker, "message", event => this.#onWorkerMessage(event?.data ?? event)));
    this.#workerDetach.push(attach(worker, "error", () => this.#workerLost("worker-error")));
    this.#workerDetach.push(attach(worker, "messageerror", () => this.#workerLost("worker-messageerror")));
  }
  get sessionId() { return this.#sessionId; }
  get state() { return this.#state; }
  get ledger() { return this.#ledger.snapshot(); }
  setCapturedPointer(pointerId) { this.#capturedPointerId = Number.isInteger(pointerId) ? pointerId : null; }
  announce(text) { if (text !== this.#lastStatus) { this.#lastStatus = text; this.#statusSink?.(text); } }

  bindReleaseChord(target = this.#releaseTarget) {
    invariant(target !== null && typeof target.addEventListener === "function", "release-chord target is unavailable");
    const listener = event => {
      if (event?.code === "KeyR" && event.ctrlKey === true && event.altKey === true && event.shiftKey === true &&
          event.metaKey === false && event.repeat === false) {
        event.preventDefault?.(); event.stopImmediatePropagation?.(); this.releaseInput("release-chord");
      }
    };
    target.addEventListener("keydown", listener, true);
    return () => target.removeEventListener("keydown", listener, true);
  }

  releaseInput(cause = "release-input") {
    /* This entire local half completes synchronously in the current DOM task. */
    this.#ingressEnabled = false;
    const pointer = this.#capturedPointerId; this.#capturedPointerId = null;
    if (pointer !== null) { try { this.#guestSurface?.releasePointerCapture?.(pointer); } catch { /* release is still complete locally */ } }
    try { this.#guestSurface?.blur?.(); } catch { /* no DOM authority required */ }
    try { this.#releaseControl?.focus?.(); } catch { /* focus failure does not re-enable input */ }
    this.announce("CADR guest input released; guest neutralization is pending");
    void this.#bestEffortNeutralize(cause);
    return Object.freeze({ released: true, guestNeutralization: "pending" });
  }

  async #bestEffortNeutralize(cause) {
    if (this.#terminal) return;
    const id = this.#nextInternalRequestId();
    const request = { version: 7, id, op: "pointer-neutralize", cause: "capture-loss" };
    try { await this.#postLower(request, { external: null, timeoutMs: 250 }); }
    catch { this.#state = "FAILED"; this.announce(`CADR guest input release could not be confirmed (${cause})`); }
  }

  async submit(candidate) {
    if (this.#terminal) throw new M13AdmissionError("M13 session is terminal");
    let common;
    try { common = validateCommon(candidate, this.#sessionId); }
    catch (error) {
      /* No response may invent an unreadable or wrong session/id. */
      this.#terminal = true; this.#state = "FAILED"; this.releaseInput("malformed-common-envelope");
      throw error;
    }
    if (common.id !== this.#expectedId) return this.#terminalResponse(common, CADR_M13_STATUS.PROTOCOL_VIOLATION);
    this.#expectedId = common.id === MAX_U32 ? null : common.id + 1;
    try {
      const canonical = await canonicalizeCadrM13Request(candidate, { sessionId: this.#sessionId });
      const schema = CADR_M13_OPERATION_SCHEMAS[canonical.request.op];
      if (schema.internal) throw new M13AdmissionError("internal M13 operation cannot be caller-issued");
      const field = schema.body; const bodyBytes = field === undefined ? 0 : canonical.request[field].byteLength;
      this.#ledger.reserve(common.id, { metadataBytes: canonical.metadataBytes, bodyBytes, streaming: schema.streaming === true });
      let result;
      try { result = await this.#dispatch(canonical.request, schema); }
      finally { this.#ledger.release(common.id); }
      return this.#completePublicResponse(common, result);
    } catch (error) {
      const result = error instanceof M13AdmissionError ?
        response(common, error.status, { reason: shellReason(error.status) }) :
        response(common, CADR_M13_STATUS.HOST_FAILURE, { reason: shellReason(CADR_M13_STATUS.HOST_FAILURE) });
      return this.#completePublicResponse(common, result);
    }
  }

  #completePublicResponse(request, result) {
    if (request.id !== MAX_U32) return result;
    /* ID exhaustion is terminal for every correlated public result, including
     * shell-local validation/precondition results.  Preserve a prior FAILED
     * disposition instead of relabelling worker loss as clean exhaustion. */
    if (!this.#terminal) {
      this.#terminal = true; this.#state = "TERMINATED";
      try { this.#worker.terminate?.(); } catch { /* process disposal is best effort */ }
    }
    return terminalizeResponse(result);
  }

  async #dispatch(request, schema) {
    if (schema.mediaMount === true) return this.#mountPublicBaseMedia(request);
    if (schema.shell) {
      invariant(this.#storage !== null, "M13 storage boundary is not configured", { status: CADR_M13_STATUS.NOT_READY });
      try {
        if (this.#selectedMediaConfigured() &&
            ["base-import-begin", "base-import-chunk", "base-import-finish"].includes(request.op)) {
          invariant(this.#bootstrapped,
            "M13 selected base import requires successful worker bootstrap",
          { status: CADR_M13_STATUS.NOT_READY });
          invariant(!this.#mediaMounted,
            "M13 selected media permits no replacement import in this worker session",
          { status: CADR_M13_STATUS.NOT_READY });
        }
        if (this.#selectedMediaConfigured() && request.op === "m10-reopen") {
          invariant(this.#mediaMounted && this.#m10Controller !== null,
            "M13 M10 reopen requires selected media mount", { status: CADR_M13_STATUS.NOT_READY });
        }
        const result = await this.#storage.invoke(request.op, request);
        if (this.#selectedMediaConfigured() && request.op === "base-import-finish") {
          assertSelectedBaseImportResult(result);
          this.#adoptedBaseImportId = request.importId;
          this.#m10Ready = false;
        }
        if (this.#selectedMediaConfigured() && request.op === "m10-reopen") {
          assertSelectedM10Ready(this.#m10Controller);
          this.#m10Ready = true;
        }
        return response(request, 0, { result });
      }
      catch (error) { const status = error instanceof M13AdmissionError ? error.status : CADR_M13_STATUS.HOST_FAILURE; return response(request, status, { reason: shellReason(status) }); }
    }
    if (schema.composite) return response(request, CADR_M13_STATUS.NOT_READY, { reason: "not-ready" });
    if (request.op === "bootstrap") {
      if (this.#selectedMediaConfigured()) {
        invariant(!this.#bootstrapped && !this.#mediaMounted,
          "M13 selected media worker is already bootstrapped", { status: CADR_M13_STATUS.NOT_READY });
      }
      const observed = await sha256Hex(request.wasmBytes);
      if (observed !== request.wasmSha256) return response(request, 2, { reason: "invalid-request" });
      if (this.#selectedMediaConfigured() && observed !== this.#selectedWasmSha256) {
        return response(request, CADR_M13_STATUS.INVALID_REQUEST, { reason: "invalid-request" });
      }
      try {
        invariant(typeof this.#wasmCompiler === "function", "Wasm compiler is unavailable", { status: CADR_M13_STATUS.NOT_READY });
        const module = await this.#wasmCompiler(request.wasmBytes.slice(0));
        const lower = await this.#postLower({ version: 7, id: this.#nextInternalRequestId(), op: "instantiate", module }, { external: request });
        if (lower.status === CADR_M13_STATUS.OK && this.#selectedMediaConfigured()) this.#bootstrapped = true;
        return response(request, lower.status, lower.remainder, { terminal: request.id === MAX_U32 || lower.status === 24 || lower.status === 25 });
      } catch { return response(request, CADR_M13_STATUS.HOST_FAILURE, { reason: "host-failure" }); }
    }
    if (this.#selectedMediaConfigured()) {
      invariant(this.#mediaMounted && this.#m10Ready,
        "M13 guest operation requires mounted media and a clean M10 session",
      { status: CADR_M13_STATUS.NOT_READY });
      assertSelectedM10Ready(this.#m10Controller);
    }
    const lowerOp = LOWER_OPERATION[request.op] ?? request.op;
    const lower = Object.create(null); lower.version = 7; lower.id = this.#nextInternalRequestId(); lower.op = lowerOp;
    for (const [key, value] of Object.entries(request)) if (!COMMON_FIELDS.includes(key)) lower[key] = value;
    try {
      const result = await this.#postLower(lower, { external: request });
      if (result.status === 21) return this.#terminalResponse(request, CADR_M13_STATUS.PROTOCOL_VIOLATION);
      if (result.status === 8 && this.#m10Bridge !== null) {
        const failure = await this.#serviceM10WaitingRequest(request);
        if (failure !== null) return failure;
      }
      const terminal = request.id === MAX_U32 || result.status === CADR_M13_STATUS.WORKER_LOST || result.status === CADR_M13_STATUS.PROTOCOL_VIOLATION;
      return response(request, result.status, result.remainder, { terminal });
    } catch (error) {
      if (error instanceof M13AdmissionError && error.status === CADR_M13_STATUS.PROTOCOL_VIOLATION) return this.#terminalResponse(request, 25);
      return this.#terminalResponse(request, 24);
    }
  }

  #selectedMediaConfigured() {
    return this.#baseMediaBinding !== null && this.#selectedBootArtifacts !== null;
  }

  async #mountPublicBaseMedia(request) {
    if (!this.#selectedMediaConfigured() || this.#m10Controller === null ||
        typeof this.#m10Controller.status !== "function") {
      return response(request, CADR_M13_STATUS.NOT_READY, { reason: "not-ready" });
    }
    if (!this.#bootstrapped || this.#mediaMounted || this.#adoptedBaseImportId !== request.importId) {
      return response(request, CADR_M13_STATUS.NOT_READY, { reason: "not-ready" });
    }
    const mounted = await this.#mountSelectedMedia(request.importId);
    return response(request, mounted.status,
      mounted.status === CADR_M13_STATUS.OK ? { result: mounted.result } :
        { reason: shellReason(mounted.status) },
      { terminal: mounted.status === CADR_M13_STATUS.WORKER_LOST });
  }

  async #mountSelectedMedia(importId) {
    if (this.#mediaMounted || this.#baseMediaBinding === null ||
        this.#selectedBootArtifacts === null) {
      return Object.freeze({ status: CADR_M13_STATUS.NOT_READY, result: null });
    }
    /* Every one of these lower messages can mutate the v7 media state.  There
     * is no verified atomic rollback in the preserved worker, so a failure
     * after the first attempted lower mutation discards that worker rather than
     * exposing a potentially partial import for retry. */
    let lowerMutationIssued = false;
    try {
      this.#baseMediaBinding.beginMount(importId);
      for (const artifact of this.#selectedBootArtifacts) {
        const input = artifact.bytes.slice(0);
        lowerMutationIssued = true;
        let lower = await this.#postLower({ version: 7,
          id: this.#nextInternalRequestId(), op: "input", bytes: input },
        { external: null });
        if (lower.status !== CADR_M13_STATUS.OK) throw new M13AdmissionError(
          "selected boot-artifact input was rejected", { status: lower.status });
        lowerMutationIssued = true;
        lower = await this.#postLower({ version: 7,
          id: this.#nextInternalRequestId(), op: "import", artifactKind: artifact.kind,
          byteCount: artifact.bytes.byteLength }, { external: null });
        if (lower.status !== CADR_M13_STATUS.OK) throw new M13AdmissionError(
          "selected boot-artifact import was rejected", { status: lower.status });
      }
      lowerMutationIssued = true;
      let lower = await this.#postLower({ version: 7,
        id: this.#nextInternalRequestId(), op: "stream-begin", artifactKind: 3,
        byteCount: BigInt(CADR_M13_BASE_BYTES) }, { external: null });
      if (lower.status !== CADR_M13_STATUS.OK) throw new M13AdmissionError(
        "selected base stream was rejected", { status: lower.status });
      for (let firstBlock = 0; firstBlock < CADR_M13_BASE_BLOCKS;) {
        const blockCount = Math.min(1024, CADR_M13_BASE_BLOCKS - firstBlock);
        const body = await this.#baseMediaBinding.readMountRange(firstBlock, blockCount);
        lowerMutationIssued = true;
        lower = await this.#postLower({ version: 7,
          id: this.#nextInternalRequestId(), op: "stream-chunk",
          offset: BigInt(firstBlock) * 1024n, bytes: body.buffer }, { external: null });
        if (lower.status !== CADR_M13_STATUS.OK) throw new M13AdmissionError(
          "selected base stream chunk was rejected", { status: lower.status });
        firstBlock += blockCount;
      }
      lowerMutationIssued = true;
      lower = await this.#postLower({ version: 7,
        id: this.#nextInternalRequestId(), op: "stream-finish" }, { external: null });
      if (lower.status !== CADR_M13_STATUS.OK) throw new M13AdmissionError(
        "selected base stream did not verify", { status: lower.status });
      this.#baseMediaBinding.finishMount(); this.#mediaMounted = true;
      return Object.freeze({ status: CADR_M13_STATUS.OK,
        result: Object.freeze({ baseBytes: CADR_M13_BASE_BYTES,
          baseSha256: CADR_M13_BASE_SHA256, bootArtifactCount: this.#selectedBootArtifacts.length }) });
    } catch (error) {
      this.#baseMediaBinding.abortMount();
      if (lowerMutationIssued) {
        this.#workerLost("selected-media-mount-failed");
        return Object.freeze({ status: CADR_M13_STATUS.WORKER_LOST, result: null });
      }
      const status = error instanceof M13AdmissionError ? error.status : CADR_M13_STATUS.HOST_FAILURE;
      return Object.freeze({ status, result: null });
    }
  }

  #nextInternalRequestId() { const value = this.#workerId; this.#workerId = value === 0x7fffffff ? 1 : value + 1; return value; }
  async #submitM10Internal(candidate) {
    const fields = descriptorRecord(candidate, "M10 bridge request", {
      allowed: ["op", "operation", "hostStatus", "generation", "requestId", "bytes"], required: ["op"], maximumKeys: 6,
    });
    invariant(fields.op === "host-next-request" || fields.op === "host-complete", "M10 bridge operation is not closed");
    const lower = Object.create(null); lower.version = 7; lower.id = this.#nextInternalRequestId(); lower.op = fields.op;
    if (fields.op === "host-next-request") {
      invariant(Object.keys(fields).length === 1, "M10 host-next request has extra fields");
    } else {
      invariant(Object.hasOwn(fields, "operation") && Object.hasOwn(fields, "hostStatus") &&
        Object.hasOwn(fields, "generation") && Object.hasOwn(fields, "requestId") && Object.hasOwn(fields, "bytes"),
      "M10 host completion is incomplete");
      lower.operation = u32(fields.operation, "M10 completion operation");
      lower.hostStatus = u32(fields.hostStatus, "M10 completion status");
      lower.generation = u64(fields.generation, "M10 completion generation");
      lower.requestId = u64(fields.requestId, "M10 completion request ID");
      lower.bytes = copiedInternalBytes(fields.bytes, "M10 completion bytes", M10_HOST_COMPLETION_BYTES);
    }
    const result = await this.#postLower(lower, { external: null });
    return Object.freeze({ status: result.status, ...result.remainder });
  }
  async #serviceM10WaitingRequest(request) {
    try {
      const outcome = await this.#m10Bridge.serviceOnce();
      if (outcome?.serviced !== true) return this.#terminalResponse(request, CADR_M13_STATUS.PROTOCOL_VIOLATION);
      return null;
    } catch {
      if (this.#m10Controller?.state === M10_CONTROLLER_IN_DOUBT) return this.#m10UncertainFailure(request);
      return response(request, CADR_M13_STATUS.HOST_FAILURE, { reason: shellReason(CADR_M13_STATUS.HOST_FAILURE) });
    }
  }
  #m10UncertainFailure(request) {
    if (!this.#terminal) {
      this.#terminal = true; this.#state = "FAILED"; this.releaseInput("m10-in-doubt");
      for (const [id, pending] of this.#pending) {
        this.#pending.delete(id); this.#clearTimeout(pending.timer);
        pending.reject(new M13AdmissionError("M10 durable state is uncertain", { status: CADR_M13_STATUS.HOST_FAILURE }));
      }
      try { this.#worker.terminate?.(); } catch { /* process disposal is best effort */ }
      this.announce("CADR durable state is uncertain; volatile state lost");
    }
    return response(request, CADR_M13_STATUS.HOST_FAILURE,
      { reason: shellReason(CADR_M13_STATUS.HOST_FAILURE) }, { terminal: true });
  }
  #postLower(request, { external, timeoutMs = this.#timeoutMs }) {
    return new Promise((resolve, reject) => {
      const timer = this.#setTimeout(() => { this.#pending.delete(request.id); reject(new Error("lower worker response timeout")); }, timeoutMs);
      this.#pending.set(request.id, { expectedOp: request.op, external, resolve, reject, timer });
      /* Browser structured clone canonically exposes ordinary records.  Send a
       * fresh ordinary own-property envelope instead of relying on a browser's
       * treatment of an internal null-prototype helper object; no caller object
       * or caller buffer is used here. */
      try { this.#worker.postMessage({ ...request }); }
      catch (error) { this.#pending.delete(request.id); this.#clearTimeout(timer); reject(error); }
    });
  }
  #onWorkerMessage(value) {
    const id = value?.id; const pending = this.#pending.get(id);
    if (pending === undefined) { this.#workerLost("uncorrelated-worker-response", true); return; }
    this.#pending.delete(id); this.#clearTimeout(pending.timer);
    try { pending.resolve(safeWorkerResponse(value, id, pending.expectedOp)); }
    catch {
      /* This reply was correlated to a live request but violates the private
       * response grammar.  Preserve that distinction for the waiting public
       * request: it is a status-25 protocol violation, not an indistinguishable
       * worker disappearance. */
      pending.reject(new M13AdmissionError("malformed-worker-response", {
        status: CADR_M13_STATUS.PROTOCOL_VIOLATION,
      }));
      this.#workerLost("malformed-worker-response", true);
    }
  }
  #terminalResponse(request, status) { this.#workerLost(status === 25 ? "protocol-violation" : "worker-lost", status === 25); return response(request, status, { reason: shellReason(status) }, { terminal: true }); }
  #workerLost(reason, protocol = false) {
    if (this.#terminal) return;
    this.#terminal = true; this.#state = "FAILED"; this.releaseInput(reason);
    for (const [id, pending] of this.#pending) { this.#pending.delete(id); this.#clearTimeout(pending.timer); pending.reject(new M13AdmissionError(reason, { status: protocol ? 25 : 24 })); }
    try { this.#worker.terminate?.(); } catch { /* termination is best effort */ }
    this.announce(protocol ? "CADR worker protocol failure; volatile state lost" : "CADR worker lost; volatile state lost");
  }
  dispose() { for (const detach of this.#workerDetach.splice(0)) detach?.(); this.#workerLost("shell-disposed"); }
}

/** Build DOM controls without assigning historical key meanings to host keys. */
export function mountCadrM13AccessibilityShell({ documentObject = globalThis.document, root, submit = null } = {}) {
  invariant(documentObject?.createElement !== undefined && root !== undefined && root !== null, "M13 accessibility shell needs a document root");
  const make = (name, label) => { const item = documentObject.createElement("button"); item.type = "button"; item.textContent = label; item.setAttribute("aria-label", label); item.dataset.cadrM13Operation = name; if (submit !== null) item.addEventListener("click", () => submit(name)); return item; };
  const skip = documentObject.createElement("a"); skip.href = "#cadr-m13-controls"; skip.textContent = "Skip to CADR controls";
  const description = documentObject.createElement("p"); description.id = "cadr-m13-guest-description"; description.textContent = "CADR guest framebuffer. Its pixels are historical output and are not transcribed as modern text.";
  const canvas = documentObject.createElement("canvas"); canvas.width = 768; canvas.height = 963; canvas.tabIndex = 0; canvas.setAttribute("aria-describedby", description.id); canvas.setAttribute("aria-label", "CADR guest framebuffer; use the separate controls and Space Cadet keyboard.");
  const controls = documentObject.createElement("section"); controls.id = "cadr-m13-controls"; controls.setAttribute("aria-label", "CADR host controls");
  for (const [name, label] of [["machine-start", "Start"], ["machine-pause", "Pause"], ["audio-resume", "Resume"], ["machine-reset", "Reset"], ["base-import-begin", "Import"], ["save-commit", "Save/Commit"], ["m10-export-open", "Export"], ["fullscreen", "Fullscreen"], ["release-input", "Release Input"], ["open-keyboard", "Open Keyboard"], ["open-pointer-controls", "Open Pointer Controls"], ["open-debugger", "Open Debugger"], ["help", "Help"]]) controls.append(make(name, label));
  const release = controls.querySelector?.('[data-cadr-m13-operation="release-input"]') ?? null;
  if (release !== null) release.setAttribute("aria-description", "Also press Control Alt Shift R using physical Key R to release input immediately.");
  const status = documentObject.createElement("output"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.setAttribute("aria-atomic", "true"); status.textContent = "CADR shell ready; machine state is volatile until a confirmed save.";
  root.replaceChildren(skip, description, canvas, controls, status);
  return Object.freeze({ canvas, controls, releaseControl: release, status, announce(value) { if (status.textContent !== value) status.textContent = value; } });
}
