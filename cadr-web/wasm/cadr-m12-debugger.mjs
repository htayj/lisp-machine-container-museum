/*
 * C-M12 protocol-v7 and canonical record reference implementation.
 *
 * This module has no worker, core, snapshot, PCM, or Worklet import.  It is a
 * protocol branch and byte-format oracle only.  The compiled core owns paused
 * direct-array leases; a browser endpoint never receives such a lease.
 */

export const CADR_M12_DEBUGGER_PROFILE =
  "CADR-WEB-303/ABI1.10/protocol-v7/C-M12-DBG-v1";
/* This is deliberately duplicated from the C public ABI header: importing C
 * constants into a browser protocol oracle would make the checked byte record
 * depend on a build layout.  The C/JS cross-format tests keep the two values
 * honest. */
export const CADR_M12_ABI_MINOR = 10;
export const CADR_M12_PROTOCOL_VERSION = 7;
export const CADR_M12_STATUS_OK = 0;
export const CADR_M12_STATUS_INVALID_ARGUMENT = 2;
export const CADR_M12_STATUS_STALE_GENERATION = 3;
export const CADR_M12_STATUS_NOT_READY = 9;
export const CADR_M12_STATUS_ORACLE_UNAVAILABLE = 13;
export const CADR_M12_STATUS_DEBUG_STOP = 19;
export const CADR_M12_STATUS_LIMIT_REACHED = 20;
export const CADR_M12_MAX_BREAKPOINTS = 64;
export const CADR_M12_MACRO_SLOT_LIMIT = 1048576n;
export const CADR_M12_STOP_BYTES = 136;
export const CADR_M12_CONFIG_SNAPSHOT_BYTES = 1088;
export const CADR_M12_PROVENANCE_BYTES = 128;
export const CADR_M12_BUG_HEADER_BYTES = 304;
export const CADR_M12_BUG_MAX_BYTES = 1048576;

export const CADR_M12_BREAKPOINT_MICRO_PC_BEFORE = 1;
export const CADR_M12_BREAKPOINT_RAW_LC_BEFORE = 2;
export const CADR_M12_BREAKPOINT_CLOCK_SLOT_AFTER = 3;
export const CADR_M12_BREAKPOINT_FAULT_AFTER = 4;
export const CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER = 5;
export const CADR_M12_STOP_BREAKPOINT = 1;
export const CADR_M12_STOP_MACRO_LIMIT = 2;
export const CADR_M12_ARRAY_A_MEMORY = 1;
export const CADR_M12_ARRAY_M_MEMORY = 2;
export const CADR_M12_ARRAY_DISPATCH_MEMORY = 3;
export const CADR_M12_ARRAY_PDL = 4;
export const CADR_M12_ARRAY_MICRO_STACK = 5;

export const CADR_M12_TRACE_FILTER_MICRO_PC = 1;
export const CADR_M12_TRACE_FILTER_CLOCK_RANGE = 2;
export const CADR_M12_TRACE_FILTER_FAULT = 4;
export const CADR_M12_TRACE_FILTER_DEVICE_REQUEST = 8;
export const CADR_M12_TRACE_FILTER_KNOWN = 15;

const TEXT = new TextEncoder();
const STOP_MAGIC = TEXT.encode("CDRDBGSTOP1\0");
const PROVENANCE_MAGIC = TEXT.encode("CDRPROV1");
const BUG_MAGIC = TEXT.encode("CDRBUG1\0");
const NO_BREAKPOINT = 0xffffffff;
const MAX_U64 = 0xffffffffffffffffn;

export class CadrM12FormatError extends Error {
  constructor(message) { super(`C-M12: ${message}`); }
}

function required(condition, message) {
  if (!condition) throw new CadrM12FormatError(message);
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function onlyFields(value, fields) {
  return Object.keys(value).every(key => fields.includes(key));
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

function exactBytes(value, length, label) {
  const bytes = bytesOf(value);
  required(bytes !== null && bytes.byteLength === length, `${label} must be ${length} bytes`);
  return bytes.slice();
}

function equalBytes(a, b) {
  return a.byteLength === b.byteLength && a.every((value, index) => value === b[index]);
}

function isZero(bytes) { return bytes.every(value => value === 0); }

function u32(value, label) {
  required(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, `${label} must be uint32`);
  return value;
}

function u64(value, label) {
  required(typeof value === "bigint" && value >= 0n && value <= MAX_U64,
    `${label} must be uint64 bigint`);
  return value;
}

function booleanWord(value, label) {
  required(value === 0 || value === 1, `${label} must be 0 or 1`);
  return value;
}

function magicAt(bytes, expected, label) {
  required(equalBytes(bytes.subarray(0, expected.byteLength), expected), `${label} magic`);
}

function breakpointKind(kind) {
  return kind >= CADR_M12_BREAKPOINT_MICRO_PC_BEFORE &&
    kind <= CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER;
}

function isTerminalStatus(status) {
  return status === CADR_M12_STATUS_DEBUG_STOP || status === CADR_M12_STATUS_LIMIT_REACHED;
}

function recordParts(value) {
  required(plainRecord(value), "debug-stop record must be an object");
  const result = {
    reason: u32(value.reason, "reason"),
    breakpointIndex: u32(value.breakpointIndex, "breakpointIndex"),
    generation: u64(value.generation, "generation"),
    boundaryOrdinal: u64(value.boundaryOrdinal, "boundaryOrdinal"),
    clockSlot: u64(value.clockSlot, "clockSlot"),
    microPcBefore: u32(value.microPcBefore, "microPcBefore"),
    rawLcBefore: u32(value.rawLcBefore, "rawLcBefore"),
    microPcAfter: u32(value.microPcAfter, "microPcAfter"),
    rawLcAfter: u32(value.rawLcAfter, "rawLcAfter"),
    faultAfter: booleanWord(value.faultAfter, "faultAfter"),
    deviceRequestAfter: booleanWord(value.deviceRequestAfter, "deviceRequestAfter"),
    inhibitedAfter: booleanWord(value.inhibitedAfter, "inhibitedAfter"),
    runOrdinal: u64(value.runOrdinal, "runOrdinal"),
    operationSlots: u64(value.operationSlots, "operationSlots"),
    profileSha256: exactBytes(value.profileSha256, 32, "profileSha256"),
  };
  required(result.generation !== 0n && !isZero(result.profileSha256),
    "debug-stop generation and profile hash must be nonzero");
  required((result.reason === CADR_M12_STOP_BREAKPOINT &&
    result.breakpointIndex < CADR_M12_MAX_BREAKPOINTS) ||
    (result.reason === CADR_M12_STOP_MACRO_LIMIT &&
      result.breakpointIndex === NO_BREAKPOINT &&
      result.operationSlots === CADR_M12_MACRO_SLOT_LIMIT),
  "debug-stop reason and breakpoint index disagree");
  return result;
}

/** Canonical fixed 136-byte CDRDBGSTOP1, little-endian. */
export function serializeCdrDbgStop1(value) {
  const record = recordParts(value);
  const bytes = new Uint8Array(CADR_M12_STOP_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(STOP_MAGIC, 0);
  view.setUint32(12, 1, true); view.setUint32(16, CADR_M12_STOP_BYTES, true);
  view.setUint32(24, record.reason, true); view.setUint32(28, record.breakpointIndex, true);
  view.setBigUint64(32, record.generation, true); view.setBigUint64(40, record.boundaryOrdinal, true);
  view.setBigUint64(48, record.clockSlot, true);
  view.setUint32(56, record.microPcBefore, true); view.setUint32(60, record.rawLcBefore, true);
  view.setUint32(64, record.microPcAfter, true); view.setUint32(68, record.rawLcAfter, true);
  view.setUint32(72, record.faultAfter, true); view.setUint32(76, record.deviceRequestAfter, true);
  view.setUint32(80, record.inhibitedAfter, true);
  view.setBigUint64(88, record.runOrdinal, true); view.setBigUint64(96, record.operationSlots, true);
  bytes.set(record.profileSha256, 104);
  return bytes;
}

export function parseCdrDbgStop1(value) {
  const bytes = exactBytes(value, CADR_M12_STOP_BYTES, "CDRDBGSTOP1");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  magicAt(bytes, STOP_MAGIC, "CDRDBGSTOP1");
  required(view.getUint32(12, true) === 1 && view.getUint32(16, true) === CADR_M12_STOP_BYTES,
    "CDRDBGSTOP1 schema or size");
  required(view.getUint32(20, true) === 0 && view.getUint32(84, true) === 0,
    "CDRDBGSTOP1 reserved fields");
  const record = recordParts({
    reason: view.getUint32(24, true), breakpointIndex: view.getUint32(28, true),
    generation: view.getBigUint64(32, true), boundaryOrdinal: view.getBigUint64(40, true),
    clockSlot: view.getBigUint64(48, true), microPcBefore: view.getUint32(56, true),
    rawLcBefore: view.getUint32(60, true), microPcAfter: view.getUint32(64, true),
    rawLcAfter: view.getUint32(68, true), faultAfter: view.getUint32(72, true),
    deviceRequestAfter: view.getUint32(76, true), inhibitedAfter: view.getUint32(80, true),
    runOrdinal: view.getBigUint64(88, true), operationSlots: view.getBigUint64(96, true),
    profileSha256: bytes.subarray(104, 136),
  });
  return Object.freeze({ ...record, bytes });
}

function provenanceParts(value) {
  required(plainRecord(value), "provenance must be an object");
  const result = {
    profileSha256: exactBytes(value.profileSha256, 32, "profileSha256"),
    coreSha256: exactBytes(value.coreSha256, 32, "coreSha256"),
    snapshotSha256: exactBytes(value.snapshotSha256, 32, "snapshotSha256"),
  };
  required(!isZero(result.profileSha256) && !isZero(result.coreSha256) && !isZero(result.snapshotSha256),
    "provenance digest cannot be zero");
  return result;
}

/** CDRPROV1 identifies selected implementation inputs without local paths. */
export function serializeCdrProv1(value) {
  const provenance = provenanceParts(value);
  const bytes = new Uint8Array(CADR_M12_PROVENANCE_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(PROVENANCE_MAGIC, 0); view.setUint32(8, 1, true);
  view.setUint32(12, CADR_M12_PROVENANCE_BYTES, true);
  view.setUint32(20, 1, true); view.setUint32(24, CADR_M12_ABI_MINOR, true);
  view.setUint32(28, CADR_M12_PROTOCOL_VERSION, true);
  bytes.set(provenance.profileSha256, 32); bytes.set(provenance.coreSha256, 64);
  bytes.set(provenance.snapshotSha256, 96);
  return bytes;
}

export function parseCdrProv1(value) {
  const bytes = exactBytes(value, CADR_M12_PROVENANCE_BYTES, "CDRPROV1");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  magicAt(bytes, PROVENANCE_MAGIC, "CDRPROV1");
  required(view.getUint32(8, true) === 1 && view.getUint32(12, true) === CADR_M12_PROVENANCE_BYTES &&
    view.getUint32(16, true) === 0 && view.getUint32(20, true) === 1 &&
    view.getUint32(24, true) === CADR_M12_ABI_MINOR &&
    view.getUint32(28, true) === CADR_M12_PROTOCOL_VERSION,
  "CDRPROV1 schema, version, or reserved field");
  const provenance = provenanceParts({ profileSha256: bytes.subarray(32, 64),
    coreSha256: bytes.subarray(64, 96), snapshotSha256: bytes.subarray(96, 128) });
  return Object.freeze({ ...provenance, bytes });
}

function summaryBytes(value) {
  required(typeof value === "string", "summary must be a string");
  const bytes = TEXT.encode(value);
  required(bytes.byteLength === value.length && bytes.every(byte => byte >= 0x20 && byte <= 0x7e &&
    byte !== 0x2f && byte !== 0x5c && byte !== 0x3a),
  "summary must be printable ASCII without path separators or drive marker");
  return bytes;
}

function bugRecordsAgree(status, stop, provenance) {
  required((status === CADR_M12_STATUS_DEBUG_STOP &&
      stop.reason === CADR_M12_STOP_BREAKPOINT) ||
    (status === CADR_M12_STATUS_LIMIT_REACHED &&
      stop.reason === CADR_M12_STOP_MACRO_LIMIT &&
      stop.operationSlots === CADR_M12_MACRO_SLOT_LIMIT),
  "CDRBUG1 status and stop reason disagree");
  required(equalBytes(stop.profileSha256, provenance.profileSha256),
    "CDRBUG1 stop and provenance profile digests disagree");
}

/**
 * CDRBUG1 is bounded to one MiB and contains only canonical stop/provenance
 * records plus a short, path-free ASCII summary.  Its shape cannot carry disk,
 * raw-array, screen, or input payloads.
 */
export function serializeCdrBug1(value) {
  required(plainRecord(value) &&
    onlyFields(value, ["terminalStatus", "stop", "provenance", "summary"]),
  "CDRBUG1 fields");
  const terminalStatus = u32(value.terminalStatus, "terminalStatus");
  required(isTerminalStatus(terminalStatus),
    "terminal status must be transient debug-stop or limit-reached");
  required(typeof value.summary === "string", "summary must be a string");
  /* Establish a conservative bound before reading/cloning either embedded
   * record. Encoding happens next because non-ASCII can expand. */
  required(value.summary.length <=
    CADR_M12_BUG_MAX_BYTES - CADR_M12_BUG_HEADER_BYTES,
  "CDRBUG1 exceeds one MiB");
  const text = summaryBytes(value.summary);
  const total = CADR_M12_BUG_HEADER_BYTES + text.byteLength;
  required(total <= CADR_M12_BUG_MAX_BYTES, "CDRBUG1 exceeds one MiB");
  const stopBytes = exactBytes(value.stop, CADR_M12_STOP_BYTES, "CDRDBGSTOP1");
  const provenanceBytes = exactBytes(value.provenance,
    CADR_M12_PROVENANCE_BYTES, "CDRPROV1");
  const stop = parseCdrDbgStop1(stopBytes);
  const provenance = parseCdrProv1(provenanceBytes);
  bugRecordsAgree(terminalStatus, stop, provenance);
  const bytes = new Uint8Array(total); const view = new DataView(bytes.buffer);
  bytes.set(BUG_MAGIC, 0); view.setUint32(8, 1, true); view.setUint32(12, CADR_M12_BUG_HEADER_BYTES, true);
  view.setBigUint64(16, BigInt(total), true); view.setUint32(24, terminalStatus, true);
  view.setUint32(28, text.byteLength, true); bytes.set(stopBytes, 40); bytes.set(provenanceBytes, 176);
  bytes.set(text, CADR_M12_BUG_HEADER_BYTES);
  return bytes;
}

export function parseCdrBug1(value) {
  const supplied = bytesOf(value);
  required(supplied !== null &&
    supplied.byteLength >= CADR_M12_BUG_HEADER_BYTES &&
    supplied.byteLength <= CADR_M12_BUG_MAX_BYTES,
    "CDRBUG1 size");
  /* Clone only after the public bound is known. */
  const bytes = supplied.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  magicAt(bytes, BUG_MAGIC, "CDRBUG1");
  const total = view.getBigUint64(16, true); const summaryLength = view.getUint32(28, true);
  required(view.getUint32(8, true) === 1 && view.getUint32(12, true) === CADR_M12_BUG_HEADER_BYTES &&
    total === BigInt(bytes.byteLength) && isTerminalStatus(view.getUint32(24, true)) &&
    summaryLength === bytes.byteLength - CADR_M12_BUG_HEADER_BYTES &&
    view.getBigUint64(32, true) === 0n, "CDRBUG1 header");
  const stop = parseCdrDbgStop1(bytes.subarray(40, 176));
  const provenance = parseCdrProv1(bytes.subarray(176, 304));
  bugRecordsAgree(view.getUint32(24, true), stop, provenance);
  const summary = new TextDecoder("ascii", { fatal: true }).decode(bytes.subarray(304));
  summaryBytes(summary);
  return Object.freeze({ terminalStatus: view.getUint32(24, true), stop, provenance, summary, bytes });
}

export function validateCadrM12TraceFilter(value) {
  required(plainRecord(value) && onlyFields(value, ["flags", "microPc", "firstClockSlot", "lastClockSlot"]),
    "trace filter fields");
  const filter = { flags: u32(value.flags, "flags"), microPc: u32(value.microPc ?? 0, "microPc"),
    firstClockSlot: u64(value.firstClockSlot ?? 0n, "firstClockSlot"),
    lastClockSlot: u64(value.lastClockSlot ?? MAX_U64, "lastClockSlot") };
  required((filter.flags & ~CADR_M12_TRACE_FILTER_KNOWN) === 0 &&
    ((filter.flags & CADR_M12_TRACE_FILTER_CLOCK_RANGE) === 0 ||
      filter.firstClockSlot <= filter.lastClockSlot), "trace filter flags or range");
  return Object.freeze(filter);
}

function protocolId(value) { return Number.isInteger(value) && value >= 1 && value <= 0xffffffff; }

function protocolBreakpoint(value) {
  required(plainRecord(value) && onlyFields(value, ["kind", "value"]), "breakpoint fields");
  const kind = u32(value.kind, "breakpoint kind");
  required(breakpointKind(kind), "breakpoint kind");
  const breakpointValue = u64(value.value, "breakpoint value");
  if (kind === CADR_M12_BREAKPOINT_MICRO_PC_BEFORE || kind === CADR_M12_BREAKPOINT_RAW_LC_BEFORE) {
    required(breakpointValue <= 0xffffffffn, "pre-boundary breakpoint value");
  }
  if (kind === CADR_M12_BREAKPOINT_FAULT_AFTER || kind === CADR_M12_BREAKPOINT_DEVICE_REQUEST_AFTER) {
    required(breakpointValue === 1n, "boolean post-boundary breakpoint value");
  }
  return Object.freeze({ kind, value: breakpointValue });
}

function canonicalBackendEnvelope(value) {
  required(plainRecord(value) && onlyFields(value, ["status", "result"]),
    "backend envelope fields");
  return Object.freeze({ status: u32(value.status, "backend status"),
    hasResult: Object.prototype.hasOwnProperty.call(value, "result"),
    result: value.result });
}

function statusAllowedForOperation(op, status) {
  if (op === "debug-breakpoint-set" || op === "debug-breakpoint-clear") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_NOT_READY;
  }
  if (op === "debug-resume-one-boundary") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_STALE_GENERATION;
  }
  if (op === "debug-trace-filter") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT;
  }
  if (op === "debug-inspect-read") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_STALE_GENERATION ||
      status === CADR_M12_STATUS_NOT_READY;
  }
  if (op === "debug-micro-step") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_NOT_READY ||
      status === CADR_M12_STATUS_DEBUG_STOP;
  }
  if (op === "debug-macro-step") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_NOT_READY ||
      status === CADR_M12_STATUS_ORACLE_UNAVAILABLE ||
      status === CADR_M12_STATUS_DEBUG_STOP ||
      status === CADR_M12_STATUS_LIMIT_REACHED;
  }
  if (op === "debug-stop-record") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_STALE_GENERATION ||
      status === CADR_M12_STATUS_NOT_READY;
  }
  if (op === "debug-config-snapshot-save" || op === "debug-config-snapshot-restore") {
    return status === CADR_M12_STATUS_OK ||
      status === CADR_M12_STATUS_INVALID_ARGUMENT ||
      status === CADR_M12_STATUS_NOT_READY;
  }
  return false;
}

function canonicalDebugState(value) {
  required(plainRecord(value) &&
    onlyFields(value, ["generation", "clockSlot", "microPc", "rawLc"]),
  "debug state fields");
  const result = {
    generation: u64(value.generation, "state generation"),
    clockSlot: u64(value.clockSlot, "state clockSlot"),
    microPc: u32(value.microPc, "state microPc"),
    rawLc: u32(value.rawLc, "state rawLc"),
  };
  required(result.generation !== 0n, "state generation must be nonzero");
  return Object.freeze(result);
}

function canonicalInspectorRead(value, operation) {
  required(plainRecord(value) && onlyFields(value, ["generation", "arrayKind", "index", "value"]),
    "inspector result fields");
  const result = {
    generation: u64(value.generation, "inspector generation"),
    arrayKind: u32(value.arrayKind, "inspector array kind"),
    index: u32(value.index, "inspector index"),
    value: u32(value.value, "inspector value"),
  };
  required(result.generation !== 0n && result.arrayKind === operation.arrayKind && result.index === operation.index,
    "inspector result correlation");
  return Object.freeze(result);
}

function canonicalProtocolStop(value, expectedStatus = null) {
  required(plainRecord(value) && onlyFields(value, ["stop"]),
    "stop result fields");
  const parsed = parseCdrDbgStop1(exactBytes(value.stop,
    CADR_M12_STOP_BYTES, "protocol CDRDBGSTOP1"));
  if (expectedStatus !== null) {
    required((expectedStatus === CADR_M12_STATUS_DEBUG_STOP &&
        parsed.reason === CADR_M12_STOP_BREAKPOINT) ||
      (expectedStatus === CADR_M12_STATUS_LIMIT_REACHED &&
        parsed.reason === CADR_M12_STOP_MACRO_LIMIT &&
        parsed.operationSlots === CADR_M12_MACRO_SLOT_LIMIT),
    "protocol terminal status and stop reason disagree");
  }
  return Object.freeze({ stop: parsed.bytes.slice() });
}

function canonicalConfigSnapshot(value) {
  required(plainRecord(value) && onlyFields(value, ["snapshot"]),
    "configuration snapshot result fields");
  const snapshot = exactBytes(value.snapshot, CADR_M12_CONFIG_SNAPSHOT_BYTES,
    "CDRM12C1");
  const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
  required(new TextDecoder("ascii", { fatal: true }).decode(snapshot.subarray(0, 8)) === "CDRM12C1" &&
    view.getUint32(8, true) === 1 &&
    view.getUint32(12, true) === CADR_M12_CONFIG_SNAPSHOT_BYTES &&
    view.getUint32(56, true) === CADR_M12_MAX_BREAKPOINTS &&
    view.getUint32(60, true) === 0,
  "CDRM12C1 header");
  return Object.freeze({ snapshot: snapshot.buffer });
}

/**
 * Isolated v7 branch.  `invoke` is a future worker-to-core seam.  It receives
 * no host resources, mutable media, direct-array lease, or raw trace payload.
 */
export class CadrM12ProtocolSubhandler {
  constructor({ invoke }) {
    required(typeof invoke === "function", "invoke must be a function");
    this.invoke = invoke;
  }

  #response(id, op, status, extra = {}) {
    return Object.freeze({ type: "cadr-response", version: CADR_M12_PROTOCOL_VERSION,
      id, op, status, ok: status === CADR_M12_STATUS_OK,
      terminal: isTerminalStatus(status), ...extra });
  }

  #call(id, op, operation) {
    let backendValue;
    try { backendValue = this.invoke(operation); }
    catch {
      return this.#response(id, op, CADR_M12_STATUS_INVALID_ARGUMENT,
        { reason: "backend-rejected" });
    }
    try {
      const backend = canonicalBackendEnvelope(backendValue);
      required(statusAllowedForOperation(op, backend.status),
        "backend status is not allowed for operation");
      if (backend.status !== CADR_M12_STATUS_OK &&
          !isTerminalStatus(backend.status)) {
        required(!backend.hasResult, "failed backend response has result");
        return this.#response(id, op, backend.status);
      }
      if (op === "debug-breakpoint-set") {
        required(!backend.hasResult, "breakpoint set backend has result");
        return this.#response(id, op, backend.status, { result: Object.freeze({
          slot: operation.slot, breakpoint: operation.breakpoint,
        }) });
      }
      if (op === "debug-breakpoint-clear") {
        required(!backend.hasResult, "breakpoint clear backend has result");
        return this.#response(id, op, backend.status,
          { result: Object.freeze({ slot: operation.slot }) });
      }
      if (op === "debug-resume-one-boundary") {
        required(!backend.hasResult, "resume backend has result");
        return this.#response(id, op, backend.status,
          { result: Object.freeze({ suppressionArmed: true }) });
      }
      if (op === "debug-trace-filter") {
        required(!backend.hasResult, "filter backend has result");
        return this.#response(id, op, backend.status,
          { result: Object.freeze({ filter: operation.filter }) });
      }
      if (op === "debug-inspect-read") {
        required(backend.hasResult, "inspector backend is missing result");
        return this.#response(id, op, backend.status,
          { result: canonicalInspectorRead(backend.result, operation) });
      }
      if (op === "debug-micro-step" || op === "debug-macro-step") {
        required(backend.hasResult, "step backend is missing result");
        const result = isTerminalStatus(backend.status) ?
          canonicalProtocolStop(backend.result, backend.status) :
          canonicalDebugState(backend.result);
        return this.#response(id, op, backend.status, { result });
      }
      if (op === "debug-stop-record") {
        required(backend.hasResult, "stop-record backend is missing result");
        return this.#response(id, op, backend.status,
          { result: canonicalProtocolStop(backend.result) });
      }
      if (op === "debug-config-snapshot-save") {
        required(backend.hasResult, "configuration save backend is missing result");
        return this.#response(id, op, backend.status,
          { result: canonicalConfigSnapshot(backend.result) });
      }
      if (op === "debug-config-snapshot-restore") {
        required(!backend.hasResult, "configuration restore backend has result");
        return this.#response(id, op, backend.status);
      }
      throw new CadrM12FormatError("unreachable backend operation");
    } catch {
      return this.#response(id, op, CADR_M12_STATUS_INVALID_ARGUMENT,
        { reason: "backend-response" });
    }
  }

  handle(request) {
    if (!plainRecord(request) || request.version !== CADR_M12_PROTOCOL_VERSION ||
      !protocolId(request.id) || typeof request.op !== "string") return null;
    const { id, op } = request;
    try {
      if (op === "debug-breakpoint-set") {
        required(onlyFields(request, ["version", "id", "op", "slot", "breakpoint"]), "set fields");
        const slot = u32(request.slot, "slot"); required(slot < CADR_M12_MAX_BREAKPOINTS, "slot");
        return this.#call(id, op, Object.freeze({ op, slot, breakpoint: protocolBreakpoint(request.breakpoint) }));
      }
      if (op === "debug-breakpoint-clear") {
        required(onlyFields(request, ["version", "id", "op", "slot"]), "clear fields");
        const slot = u32(request.slot, "slot"); required(slot < CADR_M12_MAX_BREAKPOINTS, "slot");
        return this.#call(id, op, Object.freeze({ op, slot }));
      }
      if (op === "debug-micro-step" || op === "debug-macro-step" || op === "debug-resume-one-boundary") {
        required(onlyFields(request, ["version", "id", "op"]), "step fields");
        return this.#call(id, op, Object.freeze({ op }));
      }
      if (op === "debug-trace-filter") {
        required(onlyFields(request, ["version", "id", "op", "filter"]), "filter fields");
        return this.#call(id, op, Object.freeze({ op, filter: validateCadrM12TraceFilter(request.filter) }));
      }
      if (op === "debug-inspect-read") {
        required(onlyFields(request, ["version", "id", "op", "arrayKind", "index"]),
          "inspector fields");
        const arrayKind = u32(request.arrayKind, "inspector array kind");
        required(arrayKind >= CADR_M12_ARRAY_A_MEMORY && arrayKind <= CADR_M12_ARRAY_MICRO_STACK,
          "inspector array kind");
        return this.#call(id, op, Object.freeze({ op, arrayKind, index: u32(request.index, "inspector index") }));
      }
      if (op === "debug-stop-record") {
        required(onlyFields(request, ["version", "id", "op"]), "stop-record fields");
        return this.#call(id, op, Object.freeze({ op }));
      }
      if (op === "debug-config-snapshot-save") {
        required(onlyFields(request, ["version", "id", "op"]), "configuration save fields");
        return this.#call(id, op, Object.freeze({ op }));
      }
      if (op === "debug-config-snapshot-restore") {
        required(onlyFields(request, ["version", "id", "op", "snapshot"]),
          "configuration restore fields");
        return this.#call(id, op, Object.freeze({ op,
          snapshot: exactBytes(request.snapshot, CADR_M12_CONFIG_SNAPSHOT_BYTES, "CDRM12C1") }));
      }
      return null;
    } catch {
      return this.#response(id, op, CADR_M12_STATUS_INVALID_ARGUMENT,
        { reason: "invalid-request" });
    }
  }
}
