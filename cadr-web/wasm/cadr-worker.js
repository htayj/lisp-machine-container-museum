import { m5SlotAdvanceAllowed, runM5DigestBatch } from "./cadr-m5-batch.mjs";
import { parseCdrDisp1 } from "./cadr-display-renderer.mjs";
import { CadrM8KeyboardProtocolSubhandler } from "./cadr-m8-keyboard.mjs";
import { CadrM9PointerProtocolSubhandler } from "./cadr-m9-pointer.mjs";
import { cadrM9InputHostStateNeutral, replaceCadrM9InputHostState } from
  "./cadr-m8-m9-restore.mjs";
import { encodeCdrInp1 } from "./cadr-m8-m9-campaign.mjs";
import { commitCadrM8M9SharedDeactivation,
  prepareCadrM8M9SharedDeactivation } from "./cadr-m8-m9-deactivation.mjs";
import { commitCadrM8M9CoreDelivery } from "./cadr-m8-m9-transaction.mjs";
import { CadrM11AudioProtocolSubhandler } from "./cadr-m11-audio.mjs";
import { CadrM13AudioSource } from "./cadr-m13-audio-source.mjs";
import { CadrM12ProtocolSubhandler, CADR_M12_STATUS_OK,
  CADR_M12_STATUS_DEBUG_STOP,
  CADR_M12_STATUS_LIMIT_REACHED,
  CADR_M12_CONFIG_SNAPSHOT_BYTES, parseCdrDbgStop1 } from "./cadr-m12-debugger.mjs";
import { parseCadrM7UnimplementedDiagnostic } from
  "./cadr-m7-devid-failure.mjs";
import { copyRequestForStrictVersion } from "./cadr-worker-request-adapter.mjs";

/*
 * CADR-WEB versioned dedicated-worker protocols.
 *
 * This is an ES module dedicated worker.  The one WebAssembly.Module supplied
 * by the host is structured-cloned into this worker, instantiated once, and
 * never shared with a second machine.  Its request sequence is deliberately
 * boring: callers start at id 1 and issue consecutive integers.  A rejected
 * operation still consumes its well-formed id, so retries cannot accidentally
 * replay a side-effecting request.  Protocol v1 freezes the M3 request tree;
 * protocol v2 adds the M4 media operations and request-payload framing.  The
 * protocol-v3 tree is the frozen M5 scheduler, protocol v4 adds M6's queue
 * digest and CDRM6I1 observation, protocol v5 adds M7's display transfer,
 * and protocol v6 adds the dedicated M8/M9 host-input branches.  Protocol v7
 * composes those same CDRINP1 branches with M11 audio and M12 debugger controls.
 * Neither input version widens generic scheduler ingress.
 * The first well-formed, in-order request selects one version for the session.
 */
const CADR_M3_PROTOCOL_VERSION = 1;
const CADR_M4_PROTOCOL_VERSION = 2;
const CADR_M5_PROTOCOL_VERSION = 3;
const CADR_M6_PROTOCOL_VERSION = 4;
const CADR_M7_PROTOCOL_VERSION = 5;
const CADR_M8_M9_PROTOCOL_VERSION = 6;
const CADR_M12_PROTOCOL_VERSION = 7;
const CADR_M13_PRIVATE_PROTOCOL_VERSION = 8;
const CADR_STATUS_OK = 0;
const CADR_STATUS_INVALID_ARGUMENT = 2;
const CADR_STATUS_HOST_FAILURE = 7;
const CADR_STATUS_WAITING_FOR_HOST = 8;
const CADR_STATUS_NOT_READY = 9;
const CADR_STATUS_GUEST_FAULT = 12;
const CADR_STATUS_UNIMPLEMENTED_DEVICE = 13;
const CADR_STATUS_HALTED = 16;
const CADR_STATUS_QUEUE_FULL = 17;
const CADR_TRANSFER_LIMIT = 1048576;
const CADR_DIGEST_BATCH_MAX = 4096;
/* This is not an M5-family fast-run.  It is the maximum non-interruptible
 * protocol-v7 scheduler slice admitted solely by the selected M13 shell. */
const CADR_M12_SCHEDULER_SLICE_MAX_SLOTS = 4096;
const CADR_M6_FAST_RUN_MAX_SLOTS = 1048576;
const CADR_HOST_DESCRIPTOR_LIMIT = 64;
const CADR_HOST_REQUEST_PAYLOAD_LIMIT = 1024;
const CADR_M6_DEVID_TAIL_H0 = new Uint8Array([
  0x9b,0x02,0x08,0xc0,0x42,0xfe,0xba,0x70,
  0xdf,0x85,0x04,0xc3,0xf2,0x52,0xf0,0x65,
  0xff,0x0d,0xee,0x56,0xd5,0x07,0x85,0xc4,
  0x0e,0x94,0x39,0xce,0xfe,0x04,0x79,0x82,
]);
const CADR_M4_ONLY_OPERATIONS = new Set([
  "media-overlay-state", "run-digest-batch-m4", "boundary-digest-v4",
  "boot-media-observation", "disk-evidence",
]);
const CADR_M5_ONLY_OPERATIONS = new Set([
  "scheduler-events", "scheduler-start", "scheduler-run", "scheduler-pause",
  "scheduler-single-step", "scheduler-reset", "scheduler-stop", "scheduler-shutdown",
  "scheduler-state", "scheduler-visibility",
  "scheduler-transcript-start", "scheduler-transcript-drain", "scheduler-transcript-finish",
  "boundary-digest-v5", "run-digest-batch-m5",
]);
/* Protocol v4 is an additive M6 transport profile over the frozen M5 ABI.
 * These observations are intentionally absent from the closed protocol-v3
 * request tree. */
const CADR_M6_ONLY_OPERATIONS = new Set([
  "scheduler-queue-digest", "boot-witness",
]);
const CADR_M6_DIAGNOSTIC_ONLY_OPERATIONS = new Set([
  "post-terminal-diagnostic",
]);
/* This policy is deliberately opt-in within protocol v4.  Protocol v5/M7
 * never receives it merely by being a later protocol version. */
const CADR_M6_DEVID_ONLY_OPERATIONS = new Set([
  "m6-disk-evidence-summary", "run-until-event-m6",
]);
const CADR_M7_ONLY_OPERATIONS = new Set([
  "display-update", "display-full",
]);
const CADR_M8_M9_ONLY_OPERATIONS = new Set([
  "keyboard-down", "keyboard-up", "keyboard-focus-lost", "keyboard-drain", "keyboard-state",
  "pointer-motion", "pointer-down", "pointer-up", "pointer-neutralize", "pointer-warp-request",
  "pointer-drain", "pointer-state", "input-state",
]);
const CADR_M11_ONLY_OPERATIONS = new Set([
  "audio-state", "audio-peek", "audio-render", "audio-ack",
  "audio-snapshot-size", "audio-snapshot-save", "audio-snapshot-restore",
]);
/* Deliberately separate from the frozen M5 scheduler operation set.  The
 * selected M13 composition needs a bounded progress turn, but it must not
 * weaken the per-slot control-yield semantics of `scheduler-run`. */
const CADR_M12_ONLY_OPERATIONS = new Set([
  "scheduler-run-v7-slice",
]);
const CADR_SCHED_EVENT_SEQUENCE_BREAK = 1;
const CADR_SCHED_EVENT_CLOCK = 2;
const CADR_SCHED_EVENT_KEYBOARD = 3;
const CADR_WORKER_PAUSED = "PAUSED";
const CADR_WORKER_NEW = "NEW";
const CADR_WORKER_CORE_RESET = "CORE_RESET";
const CADR_WORKER_RUNNING = "RUNNING";
const CADR_WORKER_WAITING = "WAITING_FOR_HOST";
const CADR_WORKER_STOPPED = "STOPPED";
const CADR_WORKER_FAILED = "FAILED";

let port;
let instance = null;
let expectedId = 1;
let protocolVersion = null;
let mediaBusy = false;
let mediaDirty = false;
let mediaSnapshotBlocked = false;
let mediaOverlayGeneration = 0n;
let workerLifecycle = CADR_WORKER_NEW;
let hidden = false;
let visibilityInitialized = false;
let snapshotHidden = false;
let controlOrdinal = 0n;
let controlWitness = new Uint8Array(32);
let controlBoundary = 0n;
let snapshotControlOrdinal = 0n;
let snapshotControlWitness = new Uint8Array(32);
let snapshotControlBoundary = 0n;
let snapshotVisibilityInitialized = false;
let runActive = false;
let deferredControls = [];
/* A marker, not pre-completion bytes: completion can mutate guest state. */
let pendingBoundaryDigest = false;
let lastFailureEvidence = null;
let diagnosticModule = false;
let m6DevidModule = false;
let m7DevidDiagnosticModule = false;
let m8KeyboardProtocol = null;
let m9PointerProtocol = null;
let m11AudioProtocol = null;
let m12DebuggerProtocol = null;
let m13AudioSource = null;
let m13SessionId = null;
let m13DebuggerSnapshot = null;
let m13DebuggerSnapshotId = 0n;
let m13DebuggerSnapshotOffset = 0;

function isM5ProtocolVersion(version) {
  return version === CADR_M5_PROTOCOL_VERSION ||
    version === CADR_M6_PROTOCOL_VERSION ||
    version === CADR_M7_PROTOCOL_VERSION ||
    version === CADR_M8_M9_PROTOCOL_VERSION ||
    version === CADR_M12_PROTOCOL_VERSION ||
    version === CADR_M13_PRIVATE_PROTOCOL_VERSION;
}

function isM6ProtocolVersion(version) {
  return version === CADR_M6_PROTOCOL_VERSION ||
    version === CADR_M7_PROTOCOL_VERSION ||
    version === CADR_M8_M9_PROTOCOL_VERSION ||
    version === CADR_M12_PROTOCOL_VERSION ||
    version === CADR_M13_PRIVATE_PROTOCOL_VERSION;
}

function isM7ProtocolVersion(version) {
  return version === CADR_M7_PROTOCOL_VERSION ||
    version === CADR_M8_M9_PROTOCOL_VERSION ||
    version === CADR_M12_PROTOCOL_VERSION ||
    version === CADR_M13_PRIVATE_PROTOCOL_VERSION;
}

function isM8M9ProtocolVersion(version) {
  return version === CADR_M8_M9_PROTOCOL_VERSION ||
    version === CADR_M12_PROTOCOL_VERSION ||
    version === CADR_M13_PRIVATE_PROTOCOL_VERSION;
}

function isM6DevidProtocolVersion(version) {
  return isM6ProtocolVersion(version);
}

const isNode = typeof process !== "undefined" &&
  process.versions !== undefined && process.versions.node !== undefined;

if (isNode) {
  const workerThreads = await import("node:worker_threads");
  port = workerThreads.parentPort;
} else {
  port = self;
}

function send(value, transfers = []) {
  port.postMessage(value, transfers);
}

function error(id, code, message) {
  send({
    type: "cadr-error",
    version: protocolVersion ?? CADR_M3_PROTOCOL_VERSION,
    id, code, message,
  });
}

function response(id, op, status, extra = {}, transfers = []) {
  send({
    type: "cadr-response",
    version: protocolVersion ?? CADR_M3_PROTOCOL_VERSION,
    id,
    op,
    status: status >>> 0,
    ok: (status >>> 0) === CADR_STATUS_OK,
    ...(isM5ProtocolVersion(protocolVersion) ? { lifecycle: workerLifecycle } : {}),
    ...extra,
  }, transfers);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff;
}

function unsigned32(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function unsigned64(value) {
  return typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn;
}

function uint8Bytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function exportsOrStatus(id, op) {
  if (instance === null) {
    response(id, op, CADR_STATUS_NOT_READY);
    return null;
  }
  return instance.exports;
}

function copyInput(e, bytes) {
  if (bytes.byteLength === 0 || bytes.byteLength > CADR_TRANSFER_LIMIT) return 0;
  const pointer = e.cadr_wasm_input_reserve(bytes.byteLength) >>> 0;
  if (pointer === 0 || pointer + bytes.byteLength > e.memory.buffer.byteLength) return 0;
  new Uint8Array(e.memory.buffer, pointer, bytes.byteLength).set(bytes);
  return pointer;
}

function split64(value) {
  if (typeof value !== "bigint" || value < 0n || value > 0xffffffffffffffffn) return null;
  return [Number(value & 0xffffffffn), Number(value >> 32n)];
}

async function workerSnapshotSha256(bytes) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) return null;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

function coreClockBoundary(e) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + 16 > e.memory.buffer.byteLength ||
      (e.cadr_wasm_machine_info() >>> 0) !== CADR_STATUS_OK) return null;
  return new DataView(e.memory.buffer, pointer, 16).getBigUint64(8, true);
}

function zeroWitness(value) {
  return value.every(byte => byte === 0);
}

async function noteVisibilityControl(e, nextHidden, controlId) {
  if (nextHidden === hidden) return true;
  const boundary = coreClockBoundary(e);
  if (boundary === null) return false;
  const bytes = new Uint8Array(7 + 32 + 8 + 8 + 4 + 4);
  bytes.set([0x43, 0x44, 0x52, 0x4d, 0x35, 0x43, 0x31], 0);
  bytes.set(controlWitness, 7);
  new DataView(bytes.buffer).setBigUint64(39, controlOrdinal + 1n, true);
  new DataView(bytes.buffer).setBigUint64(47, boundary, true);
  new DataView(bytes.buffer).setUint32(55, nextHidden ? 1 : 0, true);
  new DataView(bytes.buffer).setUint32(59, controlId >>> 0, true);
  const next = await workerSnapshotSha256(bytes);
  if (next === null) throw new Error("worker control witness unavailable");
  controlWitness = next;
  controlOrdinal += 1n;
  controlBoundary = boundary;
  hidden = nextHidden;
  return true;
}

function validInnerM5Snapshot(raw, boundary) {
  const bytes = new Uint8Array(raw);
  const magic = [0x43, 0x44, 0x52, 0x53, 0x4e, 0x41, 0x50, 0x31];
  if (bytes.byteLength < 264 || !magic.every((value, index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint16(8, true) === 1 && view.getUint16(10, true) === 2 &&
    view.getUint32(12, true) === 264 &&
    view.getBigUint64(32, true) === BigInt(bytes.byteLength) &&
    boundary <= view.getBigUint64(88, true);
}

function validNestedCdrsnap1(raw, boundary) {
  const bytes = new Uint8Array(raw);
  const magic = [0x43,0x44,0x52,0x53,0x4e,0x41,0x50,0x31];
  if (bytes.byteLength < 264 || !magic.every((value, index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minor = view.getUint16(10, true);
  return view.getUint16(8, true) === 1 && (minor === 1 || minor === 2) &&
    view.getUint32(12, true) === 264 &&
    view.getBigUint64(32, true) === BigInt(bytes.byteLength) &&
    boundary <= view.getBigUint64(88, true);
}

/* Protocol v7 has one exact inner format: CDRM12S1 v2 containing a complete
 * frozen CDRSNAP1 whose clock boundary covers the worker control boundary.
 * This is checked before any native reserve/copy/adoption operation. */
function validInnerM12Snapshot(raw, boundary) {
  const bytes = new Uint8Array(raw);
  const magic = [0x43,0x44,0x52,0x4d,0x31,0x32,0x53,0x31];
  if (bytes.byteLength < 48 || !magic.every((value, index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== 2 || view.getUint32(12, true) !== 48 ||
      view.getBigUint64(16, true) !== BigInt(bytes.byteLength) ||
      view.getUint32(40, true) !== 72 || view.getUint32(44, true) !== 0) return false;
  const coreLength = view.getBigUint64(24, true);
  const audioLength = BigInt(view.getUint32(32, true));
  const configLength = BigInt(view.getUint32(36, true));
  if (coreLength === 0n || coreLength > BigInt(bytes.byteLength - 48) ||
      48n + coreLength + 72n + audioLength + configLength !== BigInt(bytes.byteLength)) return false;
  const coreEnd = 48 + Number(coreLength);
  const continuation = new DataView(bytes.buffer, bytes.byteOffset + coreEnd, 72);
  const continuationMagic = [0x43,0x44,0x52,0x4d,0x39,0x44,0x31,0x00];
  if (!continuationMagic.every((value, index) => bytes[coreEnd + index] === value) ||
      continuation.getUint32(8, true) !== 1 || continuation.getUint32(12, true) !== 72 ||
      continuation.getUint32(64, true) !==
        Number(continuation.getBigUint64(56, true) & 0xffffffffn)) return false;
  return validNestedCdrsnap1(bytes.slice(48, coreEnd), boundary);
}

async function wrapM5WorkerSnapshot(snapshot) {
  const raw = new Uint8Array(snapshot);
  if (protocolVersion === CADR_M12_PROTOCOL_VERSION &&
      !validInnerM12Snapshot(raw, controlBoundary)) return null;
  const wrapped = new Uint8Array(raw.byteLength + 104);
  wrapped.set([0x43, 0x44, 0x52, 0x4d, 0x35, 0x57, 0x4b, 0x31], 0);
  const view = new DataView(wrapped.buffer);
  view.setUint32(8, 3, true);
  view.setUint32(12, (hidden ? 1 : 0) | (visibilityInitialized ? 2 : 0), true);
  view.setBigUint64(16, BigInt(raw.byteLength), true);
  view.setBigUint64(24, controlOrdinal, true);
  view.setBigUint64(32, controlBoundary, true);
  wrapped.set(controlWitness, 40);
  wrapped.set(raw, 104);
  const digestInput = new Uint8Array(72 + raw.byteLength);
  digestInput.set(wrapped.slice(0, 72), 0); digestInput.set(raw, 72);
  const digest = await workerSnapshotSha256(digestInput);
  if (digest === null) return null;
  wrapped.set(digest, 72);
  return wrapped;
}

async function unwrapM5WorkerSnapshot(snapshot) {
  const bytes = new Uint8Array(snapshot);
  const magic = [0x43, 0x44, 0x52, 0x4d, 0x35, 0x57, 0x4b, 0x31];
  if (bytes.byteLength < 8 || !magic.every((value, index) => bytes[index] === value)) return { legacy: true };
  if (bytes.byteLength < 104) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(8, true);
  const flags = view.getUint32(12, true);
  const length = view.getBigUint64(16, true);
  if (version !== 3 || (flags & ~3) !== 0 || length !== BigInt(bytes.byteLength - 104)) return null;
  const ordinal = view.getBigUint64(24, true);
  const boundary = view.getBigUint64(32, true);
  const witness = bytes.slice(40, 72);
  const initialized = (flags & 2) !== 0;
  const witnessIsZero = zeroWitness(witness);
  if (ordinal === 0xffffffffffffffffn ||
      ((ordinal === 0n) !== witnessIsZero) ||
      (ordinal === 0n && boundary !== 0n) ||
      ((flags & 1) !== 0 && ordinal === 0n) ||
      (!initialized && ((flags & 1) !== 0 || ordinal !== 0n || boundary !== 0n || !witnessIsZero))) return null;
  const digestInput = new Uint8Array(72 + bytes.byteLength - 104);
  digestInput.set(bytes.slice(0, 72), 0); digestInput.set(bytes.slice(104), 72);
  const expected = await workerSnapshotSha256(digestInput);
  if (expected === null) return null;
  for (let index = 0; index < expected.byteLength; index += 1) {
    if (expected[index] !== bytes[72 + index]) return null;
  }
  const raw = bytes.slice(104);
  if (!(protocolVersion === CADR_M12_PROTOCOL_VERSION ?
      validInnerM12Snapshot(raw, boundary) : validInnerM5Snapshot(raw, boundary))) return null;
  return { raw, hidden: (flags & 1) !== 0, visibilityInitialized: initialized,
    controlOrdinal: ordinal, controlBoundary: boundary, controlWitness: witness, legacy: false };
}

function metadata(e) {
  const pointer = e.cadr_wasm_meta_pointer() >>> 0;
  if (pointer === 0 || pointer + 16 > e.memory.buffer.byteLength) return null;
  const view = new DataView(e.memory.buffer, pointer, 16);
  return [view.getBigUint64(0, true), view.getBigUint64(8, true)];
}

function coreIsRunning(e) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + 4 > e.memory.buffer.byteLength ||
      (e.cadr_wasm_machine_info() >>> 0) !== CADR_STATUS_OK) return false;
  return new DataView(e.memory.buffer, pointer, 4).getUint32(0, true) === 2;
}

function discardWorkerState() {
  instance = null; mediaBusy = false; mediaDirty = false;
  mediaSnapshotBlocked = false; mediaOverlayGeneration = 0n;
  diagnosticModule = false; m6DevidModule = false; m7DevidDiagnosticModule = false;
  m8KeyboardProtocol = null; m9PointerProtocol = null;
  m11AudioProtocol = null; m12DebuggerProtocol = null;
  m13AudioSource = null; m13SessionId = null;
  if (m13DebuggerSnapshot !== null) m13DebuggerSnapshot.fill(0);
  m13DebuggerSnapshot = null;
  m13DebuggerSnapshotOffset = 0;
}

function m9InputCoreState(e) {
  if (typeof e.cadr_wasm_m9_input_state !== "function" ||
      typeof e.cadr_wasm_m9_input_deliver !== "function") return null;
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + 64 > e.memory.buffer.byteLength ||
      (e.cadr_wasm_m9_input_state() >>> 0) !== CADR_STATUS_OK) return null;
  const bytes = new Uint8Array(e.memory.buffer, pointer, 64);
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRIOB91") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 64) return null;
  const sequence = view.getUint32(32, true);
  const ordinal = view.getBigUint64(40, true);
  if (sequence !== Number(ordinal & 0xffffffffn)) return null;
  return Object.freeze({ csr: view.getUint32(16, true), scancode: view.getUint32(20, true),
    mouseX: view.getUint32(24, true), mouseY: view.getUint32(28, true),
    inputSequence: sequence, keyboardFifoCount: view.getUint32(36, true),
    ingressOrdinal: ordinal, generation: view.getBigUint64(48, true),
    lifecycle: view.getUint32(56, true), bytes: bytes.slice() });
}

function m9InputEntries(result) {
  if (result?.result?.emitted !== undefined) {
    return Object.freeze([{ kind: 1, value: result.result.emitted >>> 0, source: "keyboard" }]);
  }
  if (result?.result?.entry !== undefined) {
    return Object.freeze([{ kind: 2, value: result.result.entry.value >>> 0, source: "pointer" }]);
  }
  if (Array.isArray(result?.result?.entries)) {
    return Object.freeze(result.result.entries.map(entry => Object.freeze({
      kind: entry.type === "keyboard-all-up" ? 1 : 2, value: entry.value >>> 0, source: "pointer",
    })));
  }
  return Object.freeze([]);
}

function m9InputPreflight(e, request) {
  const state = m9InputCoreState(e);
  if (state === null || state.lifecycle !== 2) {
    return Object.freeze({ status: CADR_STATUS_NOT_READY, reason: "core-not-running" });
  }
  if (state.ingressOrdinal === 0xffffffffffffffffn) {
    return Object.freeze({ status: CADR_STATUS_NOT_READY, reason: "input-ingress-ordinal-exhausted" });
  }
  const deactivation = request.op === "keyboard-focus-lost" || request.op === "pointer-neutralize";
  const required = deactivation ?
    BigInt(m9PointerProtocol.controller.snapshot().heldButtonNames.length + 1) : 1n;
  if (state.ingressOrdinal > 0xffffffffffffffffn - required) {
    return Object.freeze({ status: CADR_STATUS_NOT_READY,
      reason: "input-ingress-ordinal-exhausted" });
  }
  const potentiallyKeyboard = request.op === "keyboard-down" || request.op === "keyboard-up" ||
    request.op === "keyboard-focus-lost" || request.op === "pointer-neutralize";
  if (potentiallyKeyboard && (state.csr & (1 << 5)) !== 0 && state.keyboardFifoCount >= 10) {
    return Object.freeze({ status: CADR_STATUS_QUEUE_FULL, reason: "iob-keyboard-fifo-full" });
  }
  return Object.freeze({ status: CADR_STATUS_OK, state });
}

function m9InputDeliver(e, state, entries) {
  let ordinal = state.ingressOrdinal;
  const wireRecords = [];
  const coreObservations = [];
  for (const entry of entries) {
    ordinal += 1n;
    const record = encodeCdrInp1({ kind: entry.kind, generation: state.generation,
      ordinal, payload: entry.value });
    if (copyInput(e, record) === 0 || (e.cadr_wasm_m9_input_deliver(40) >>> 0) !== CADR_STATUS_OK) {
      return null;
    }
    const observation = m9InputCoreState(e);
    if (observation === null || observation.ingressOrdinal !== ordinal ||
        observation.inputSequence !== Number(ordinal & 0xffffffffn)) return null;
    wireRecords.push(record.slice());
    coreObservations.push(observation.bytes.slice());
  }
  return Object.freeze({ wireSchema: "CDRINP1", recordsDelivered: entries.length,
    firstIngressOrdinal: entries.length === 0 ? state.ingressOrdinal : state.ingressOrdinal + 1n,
    lastIngressOrdinal: ordinal, inputSequence: Number(ordinal & 0xffffffffn),
    wireRecords: Object.freeze(wireRecords.map(bytes => bytes.buffer)),
    coreObservations: Object.freeze(coreObservations.map(bytes => bytes.buffer)) });
}

function consumeM9InputEntries(entries) {
  const keyboardCount = entries.filter(entry => entry.source === "keyboard").length;
  const pointerCount = entries.filter(entry => entry.source === "pointer").length;
  if (keyboardCount !== 0) m8KeyboardProtocol.controller.drain(keyboardCount);
  if (pointerCount !== 0) m9PointerProtocol.controller.drain(pointerCount);
}

function m9InputHostStateNeutral() {
  return cadrM9InputHostStateNeutral(m8KeyboardProtocol, m9PointerProtocol);
}

function replaceM9InputHostStatePreservingEpoch() {
  const replacement = replaceCadrM9InputHostState(m8KeyboardProtocol, m9PointerProtocol);
  m8KeyboardProtocol = replacement.keyboardProtocol;
  m9PointerProtocol = replacement.pointerProtocol;
}

/* M8 and M9 accept only physical edges which have crossed CDRINP1 into a
 * running M9 IOB profile.  This preserves native device ordering and rejects
 * an input before controller mutation when the guest cannot accept it. */
function v6InputSubhandlerResult(e, request) {
  if (!isM8M9ProtocolVersion(protocolVersion)) return null;
  const ingressOperation = ["keyboard-down", "keyboard-up", "keyboard-focus-lost",
    "pointer-motion", "pointer-down", "pointer-up", "pointer-neutralize"].includes(request.op);
  const preflight = ingressOperation ? m9InputPreflight(e, request) : null;
  if (preflight !== null && preflight.status !== CADR_STATUS_OK) {
    return Object.freeze({ id: request.id, op: request.op, status: preflight.status,
      reason: preflight.reason });
  }
  /* M8/M9 keep their frozen v6 codec and controller contract.  Both later
     envelopes are adapters, not a widening of the v6 handler: copy the
     private request before changing its version.  `response` below retains
     the caller's v7/v8 contract, id, and operation. */
  const inputRequest = copyRequestForStrictVersion(request, CADR_M8_M9_PROTOCOL_VERSION);
  const sharedDeactivation = inputRequest.op === "keyboard-focus-lost" ||
    inputRequest.op === "pointer-neutralize";
  const keyboard = sharedDeactivation ? null : (m8KeyboardProtocol?.handle(inputRequest) ?? null);
  const result = sharedDeactivation ? prepareCadrM8M9SharedDeactivation({
    pointerProtocol: m9PointerProtocol, request: inputRequest }) :
    (keyboard ?? (m9PointerProtocol?.handle(inputRequest) ?? null));
  if (result === null || preflight === null || result.status !== CADR_STATUS_OK) return result;
  const entries = m9InputEntries(result);
  if (entries.length === 0) return result;
  const delivery = m9InputDeliver(e, preflight.state, entries);
  let deactivation = null;
  commitCadrM8M9CoreDelivery({ delivery,
    failClosed() {
      m8KeyboardProtocol = null;
      m9PointerProtocol = null;
      workerLifecycle = CADR_WORKER_FAILED;
    },
    commit() {
      consumeM9InputEntries(entries);
      deactivation = sharedDeactivation ? commitCadrM8M9SharedDeactivation({
        keyboardProtocol: m8KeyboardProtocol }) : null;
    } });
  return Object.freeze({ ...result, delivery, ...(deactivation === null ? {} : { deactivation }) });
}

function sendV6InputSubhandlerResult(result) {
  const { id, op, status, type: _type, version: _version, ok: _ok, ...extra } = result;
  response(id, op, status, extra);
}

function m12OutputBytes(e, byteCount) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + byteCount > e.memory.buffer.byteLength) return null;
  return new Uint8Array(e.memory.buffer, pointer, byteCount);
}

function m12DebugStateResult(e) {
  const bytes = m12OutputBytes(e, 24);
  if (bytes === null) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { generation: view.getBigUint64(0, true), clockSlot: view.getBigUint64(8, true),
    microPc: view.getUint32(16, true), rawLc: view.getUint32(20, true) };
}

function m12StopResult(e) {
  const bytes = m12OutputBytes(e, 136);
  return bytes === null ? null : { stop: bytes.slice() };
}

function m12InspectorReadResult(e) {
  const bytes = m12OutputBytes(e, 24);
  if (bytes === null) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { generation: view.getBigUint64(0, true), arrayKind: view.getUint32(8, true),
    index: view.getUint32(12, true), value: view.getUint32(16, true) };
}

function m11OutputBytes(e, byteCount) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + byteCount > e.memory.buffer.byteLength) return null;
  return new Uint8Array(e.memory.buffer, pointer, byteCount);
}

function invokeM13AudioWasm(e, operation) {
  if (operation.op !== "audio-open-private" ||
      typeof e.cadr_wasm_m13_audio_open !== "function") return { status: CADR_STATUS_INVALID_ARGUMENT };
  const bytes = m11OutputBytes(e, 48);
  if (bytes === null) return { status: CADR_STATUS_NOT_READY };
  const status = e.cadr_wasm_m13_audio_open() >>> 0;
  return status === CADR_STATUS_OK ? { status, record: bytes.slice().buffer } : { status };
}

function invokeM11Wasm(e, operation) {
  if (operation.op === "audio-state") {
    const bytes = m11OutputBytes(e, 40);
    if (bytes === null) return { status: CADR_STATUS_NOT_READY };
    const status = e.cadr_wasm_m11_audio_state() >>> 0;
    if (status !== CADR_STATUS_OK) return { status };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRM11A1" ||
        view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 40) {
      return { status: CADR_STATUS_INVALID_ARGUMENT };
    }
    return { status, state: Object.freeze({ generation: view.getBigUint64(16, true),
      queuedFrames: view.getBigUint64(24, true), packetCount: view.getUint32(32, true),
      rendererProfile: view.getUint32(36, true) }) };
  }
  if (operation.op === "audio-peek") {
    const bytes = m11OutputBytes(e, 88);
    if (bytes === null) return { status: CADR_STATUS_NOT_READY };
    const status = e.cadr_wasm_m11_audio_peek() >>> 0;
    if (status !== CADR_STATUS_OK) return { status };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { status, event: bytes.slice(0, 64).buffer, generation: view.getBigUint64(64, true),
      sequence: view.getBigUint64(72, true), frameOffset: view.getUint32(80, true),
      framesRemaining: view.getUint32(84, true) };
  }
  if (operation.op === "audio-render" || operation.op === "audio-ack") {
    const generation = split64(operation.generation); const sequence = split64(operation.sequence);
    if (generation === null || sequence === null) return { status: CADR_STATUS_INVALID_ARGUMENT };
    if (operation.op === "audio-ack") {
      return { status: e.cadr_wasm_m11_audio_ack(generation[0], generation[1], sequence[0],
        sequence[1], operation.frameOffset, operation.frames) >>> 0 };
    }
    const status = e.cadr_wasm_m11_audio_render(generation[0], generation[1], sequence[0],
      sequence[1], operation.frameOffset, operation.requestedFrames) >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (status !== CADR_STATUS_OK || meta === null || meta[0] === 0n || meta[0] > 512n ||
        meta[1] !== meta[0] * 2n) return { status: status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status };
    const bytes = m11OutputBytes(e, Number(meta[1]));
    return bytes === null ? { status: CADR_STATUS_NOT_READY } :
      { status, frames: Number(meta[0]), pcmS16Le: bytes.slice().buffer };
  }
  if (operation.op === "audio-snapshot-size") {
    const status = e.cadr_wasm_m11_audio_snapshot_size() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    return meta === null ? { status: status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status } :
      { status, byteCount: meta[0] };
  }
  if (operation.op === "audio-snapshot-save") {
    const pointer = e.cadr_wasm_input_reserve(4284) >>> 0;
    if (pointer === 0 || pointer + 4284 > e.memory.buffer.byteLength) return { status: CADR_STATUS_NOT_READY };
    const status = e.cadr_wasm_m11_audio_snapshot_save() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (status !== CADR_STATUS_OK || meta === null || meta[0] === 0n || meta[0] > 4284n) {
      return { status: status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status };
    }
    return { status, snapshot: new Uint8Array(e.memory.buffer, pointer, Number(meta[0])).slice().buffer };
  }
  if (operation.op === "audio-snapshot-restore") {
    if (operation.snapshot.byteLength === 0 || copyInput(e, operation.snapshot) === 0) {
      return { status: CADR_STATUS_INVALID_ARGUMENT };
    }
    return { status: e.cadr_wasm_m11_audio_snapshot_restore(operation.snapshot.byteLength) >>> 0 };
  }
  return { status: CADR_STATUS_INVALID_ARGUMENT };
}

/* The v7 branch receives validated scalar requests from CadrM12ProtocolSubhandler.
 * It never opens the core's process-local direct-array lease, moves media, or
 * accepts a generic scheduler substitute for debugger execution. */
function invokeM12Wasm(e, operation) {
  if (operation.op === "debug-inspect-read") {
    if (m12OutputBytes(e, 24) === null) return { status: CADR_STATUS_NOT_READY };
    const status = e.cadr_wasm_m12_inspect_read(operation.arrayKind, operation.index) >>> 0;
    if (status !== CADR_M12_STATUS_OK) return { status };
    const result = m12InspectorReadResult(e);
    return result === null ? { status: CADR_STATUS_NOT_READY } : { status, result };
  }
  if (operation.op === "debug-breakpoint-set") {
    const value = split64(operation.breakpoint.value);
    if (value === null) return { status: CADR_STATUS_INVALID_ARGUMENT };
    return { status: e.cadr_wasm_m12_breakpoint_set(operation.slot,
      operation.breakpoint.kind, value[0], value[1]) >>> 0 };
  }
  if (operation.op === "debug-breakpoint-clear") {
    return { status: e.cadr_wasm_m12_breakpoint_clear(operation.slot) >>> 0 };
  }
  if (operation.op === "debug-resume-one-boundary") {
    return { status: e.cadr_wasm_m12_resume_one_boundary() >>> 0 };
  }
  if (operation.op === "debug-trace-filter") {
    const first = split64(operation.filter.firstClockSlot);
    const last = split64(operation.filter.lastClockSlot);
    if (first === null || last === null) return { status: CADR_STATUS_INVALID_ARGUMENT };
    return { status: e.cadr_wasm_m12_trace_filter(operation.filter.flags,
      operation.filter.microPc, first[0], first[1], last[0], last[1]) >>> 0 };
  }
  if (operation.op === "debug-micro-step" || operation.op === "debug-macro-step") {
    /* The export writes either a closed state record for success or a closed
     * CDRDBGSTOP1 record for a debugger terminal result. */
    if (m12OutputBytes(e, 136) === null) return { status: CADR_STATUS_NOT_READY };
    const status = (operation.op === "debug-micro-step" ?
      e.cadr_wasm_m12_micro_step() : e.cadr_wasm_m12_macro_step()) >>> 0;
    if (status === CADR_M12_STATUS_OK) {
      const result = m12DebugStateResult(e);
      return result === null ? { status: CADR_STATUS_NOT_READY } : { status, result };
    }
    if (status === CADR_M12_STATUS_DEBUG_STOP || status === CADR_M12_STATUS_LIMIT_REACHED) {
      const result = m12StopResult(e);
      return result === null ? { status: CADR_STATUS_NOT_READY } : { status, result };
    }
    return { status };
  }
  if (operation.op === "debug-stop-record") {
    if (m12OutputBytes(e, 136) === null) return { status: CADR_STATUS_NOT_READY };
    const status = e.cadr_wasm_m12_stop_record() >>> 0;
    if (status !== CADR_M12_STATUS_OK) return { status };
    const result = m12StopResult(e);
    return result === null ? { status: CADR_STATUS_NOT_READY } : { status, result };
  }
  if (operation.op === "debug-config-snapshot-save") {
    const pointer = e.cadr_wasm_input_reserve(CADR_M12_CONFIG_SNAPSHOT_BYTES) >>> 0;
    if (pointer === 0 || pointer + CADR_M12_CONFIG_SNAPSHOT_BYTES > e.memory.buffer.byteLength) {
      return { status: CADR_STATUS_NOT_READY };
    }
    const status = e.cadr_wasm_m12_config_snapshot_save() >>> 0;
    if (status !== CADR_STATUS_OK) return { status };
    return { status, result: { snapshot: new Uint8Array(e.memory.buffer, pointer,
      CADR_M12_CONFIG_SNAPSHOT_BYTES).slice().buffer } };
  }
  if (operation.op === "debug-config-snapshot-restore") {
    if (operation.snapshot.byteLength !== CADR_M12_CONFIG_SNAPSHOT_BYTES ||
        copyInput(e, operation.snapshot) === 0) {
      return { status: CADR_STATUS_INVALID_ARGUMENT };
    }
    return { status: e.cadr_wasm_m12_config_snapshot_restore(
      CADR_M12_CONFIG_SNAPSHOT_BYTES) >>> 0 };
  }
  return { status: CADR_STATUS_INVALID_ARGUMENT };
}

function v7M12SubhandlerResult(request) {
  if (![CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) || m12DebuggerProtocol === null) return null;
  /* The debugger parser is deliberately strict v7.  Protocol v8 is only a
     private composition envelope, so adapt a copied request rather than
     mutating the worker message or teaching the v7 parser a second version. */
  const debuggerRequest = copyRequestForStrictVersion(request, CADR_M12_PROTOCOL_VERSION);
  return m12DebuggerProtocol.handle(debuggerRequest);
}

function v7M11SubhandlerResult(request) {
  if (![CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) || m11AudioProtocol === null) return null;
  return m11AudioProtocol.handle(request);
}

function sendV7M12SubhandlerResult(result) {
  const { id, op, status, type: _type, version: _version, ok: _ok, ...extra } = result;
  response(id, op, status, extra);
}

function closeWorkerSoon() {
  setTimeout(() => {
    if (isNode) process.exit(0);
    else self.close();
  }, 0);
}

async function applyDeferredControls() {
  let terminal = false;
  let acceptedShutdown = false;
  while (deferredControls.length !== 0) {
    const control = deferredControls.shift();
    if (terminal || workerLifecycle === CADR_WORKER_FAILED) {
      response(control.id, control.op, CADR_STATUS_NOT_READY,
        { lifecycle: workerLifecycle, hidden, discardedUnsavedState: false });
      continue;
    }
    if (control.op === "scheduler-visibility") {
      if (!await noteVisibilityControl(instance.exports, control.hidden, control.id)) {
        response(control.id, control.op, CADR_STATUS_NOT_READY,
          { lifecycle: workerLifecycle, hidden, discardedUnsavedState: false });
        continue;
      }
      visibilityInitialized = true;
      if (hidden && (workerLifecycle === CADR_WORKER_RUNNING || workerLifecycle === CADR_WORKER_WAITING)) workerLifecycle = CADR_WORKER_PAUSED;
    } else if (control.op === "scheduler-pause") {
      if (workerLifecycle === CADR_WORKER_RUNNING || workerLifecycle === CADR_WORKER_WAITING) workerLifecycle = CADR_WORKER_PAUSED;
    } else {
      workerLifecycle = CADR_WORKER_STOPPED;
      terminal = true;
      acceptedShutdown = control.op === "scheduler-shutdown";
    }
    response(control.id, control.op, CADR_STATUS_OK,
      { lifecycle: workerLifecycle, hidden,
        discardedUnsavedState: control.op === "scheduler-shutdown" });
  }
  if (acceptedShutdown) { discardWorkerState(); closeWorkerSoon(); }
}

function transferResult(e, status, firstName, secondName = null) {
  if (status !== CADR_STATUS_OK) return { status };
  const meta = metadata(e);
  if (meta === null || meta[0] > BigInt(CADR_TRANSFER_LIMIT) ||
      (secondName !== null && meta[1] > 0xffffffffn)) return { status: CADR_STATUS_INVALID_ARGUMENT };
  const pointer = e.cadr_wasm_input_reserve(CADR_TRANSFER_LIMIT) >>> 0;
  const byteCount = Number(meta[0]);
  if (pointer === 0 || pointer + byteCount > e.memory.buffer.byteLength) return { status: CADR_STATUS_NOT_READY };
  const bytes = new Uint8Array(e.memory.buffer, pointer, byteCount).slice();
  const result = { status: CADR_STATUS_OK, [firstName]: bytes.buffer };
  if (secondName !== null) result[secondName] = Number(meta[1]);
  return result;
}

function outputDigests(e) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + 64 > e.memory.buffer.byteLength) return null;
  const out = new Uint8Array(e.memory.buffer, pointer, 64);
  const state1 = e.cadr_wasm_boundary_digest() >>> 0;
  const state2 = state1 === CADR_STATUS_OK ? (e.cadr_wasm_state_v2_digest() >>> 0) : state1;
  if (state1 !== CADR_STATUS_OK || state2 !== CADR_STATUS_OK) return { status: state1 || state2 };
  const digests = out.slice();
  return { status: CADR_STATUS_OK, digests };
}

function outputDigestsV3(e) {
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (pointer === 0 || pointer + 96 > e.memory.buffer.byteLength) return null;
  const state1 = e.cadr_wasm_boundary_digest() >>> 0;
  const state2 = state1 === CADR_STATUS_OK ? (e.cadr_wasm_state_v2_digest() >>> 0) : state1;
  const state3 = state2 === CADR_STATUS_OK ? (e.cadr_wasm_state_v3_digest() >>> 0) : state2;
  if (state1 !== CADR_STATUS_OK || state2 !== CADR_STATUS_OK || state3 !== CADR_STATUS_OK) {
    return { status: state1 || state2 || state3 };
  }
  return { status: CADR_STATUS_OK, digests: new Uint8Array(e.memory.buffer, pointer, 96).slice() };
}

function outputDigestsM5(e) {
  const v3 = outputDigestsV3(e);
  const pointer = e.cadr_wasm_output_pointer() >>> 0;
  if (v3 === null || v3.status !== CADR_STATUS_OK || pointer === 0 ||
      pointer + 32 > e.memory.buffer.byteLength) return v3;
  const status = e.cadr_wasm_state_v5_digest() >>> 0;
  if (status !== CADR_STATUS_OK) return { status };
  const bytes = new Uint8Array(128);
  bytes.set(v3.digests, 0);
  bytes.set(new Uint8Array(e.memory.buffer, pointer, 32), 96);
  return { status: CADR_STATUS_OK, digests: bytes };
}

function schedulerEventWire(events) {
  if (!Array.isArray(events) || events.length === 0 || events.length > 64) return null;
  const bytes = new Uint8Array(events.length * 32);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!isRecord(event) || !unsigned32(event.kind) || !unsigned32(event.flags) ||
        !unsigned64(event.dueTick) || !unsigned64(event.generation) ||
        !unsigned32(event.value) || !unsigned32(event.reserved0) ||
        ![CADR_SCHED_EVENT_SEQUENCE_BREAK, CADR_SCHED_EVENT_CLOCK, CADR_SCHED_EVENT_KEYBOARD]
          .includes(event.kind) ||
        (event.kind === CADR_SCHED_EVENT_SEQUENCE_BREAK && event.value !== 0) ||
        (event.kind === CADR_SCHED_EVENT_CLOCK && event.value !== 1)) return null;
    const offset = index * 32;
    view.setUint32(offset, event.kind, true); view.setUint32(offset + 4, event.flags, true);
    view.setBigUint64(offset + 8, event.dueTick, true);
    view.setBigUint64(offset + 16, event.generation, true);
    view.setUint32(offset + 24, event.value, true); view.setUint32(offset + 28, event.reserved0, true);
  }
  return bytes;
}

function failureEvidence(e, status) {
  if ([CADR_STATUS_HOST_FAILURE, CADR_STATUS_GUEST_FAULT, CADR_STATUS_UNIMPLEMENTED_DEVICE, CADR_STATUS_HALTED].includes(status)) {
    workerLifecycle = CADR_WORKER_FAILED;
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    if (pointer !== 0 && pointer + 32 <= e.memory.buffer.byteLength &&
        (e.cadr_wasm_scheduler_digest() >>> 0) === CADR_STATUS_OK) {
      const queueDigest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
      if ((e.cadr_wasm_state_v5_failure_digest() >>> 0) === CADR_STATUS_OK) {
        const coreStateDigest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
        const diskEvidence = m6DevidFailureSummary(e);
        const unimplemented = m7UnimplementedFailure(e, status);
        if (status === CADR_STATUS_UNIMPLEMENTED_DEVICE &&
            m7DevidDiagnosticModule && unimplemented === null) {
          return null;
        }
        lastFailureEvidence = { lastCompleteBoundary: coreClockBoundary(e) ?? 0n,
          queueDigest: queueDigest.buffer, coreStateDigest: coreStateDigest.buffer,
          ...(diskEvidence ?? {}), ...(unimplemented ?? {}) };
        return { lastCompleteBoundary: lastFailureEvidence.lastCompleteBoundary,
          queueDigest: lastFailureEvidence.queueDigest.slice(0),
          coreStateDigest: lastFailureEvidence.coreStateDigest.slice(0),
          ...(diskEvidence === null ? {} : {
            diskEvidenceSummary: diskEvidence.diskEvidenceSummary.slice(0),
            diskEvidenceSummaryDigest: diskEvidence.diskEvidenceSummaryDigest.slice(0),
          }), ...(unimplemented === null ? {} : {
            unimplementedDiagnostic: unimplemented.unimplementedDiagnostic.slice(0),
            unimplementedDiagnosticDigest:
              unimplemented.unimplementedDiagnosticDigest.slice(0),
          }) };
      }
    }
  }
  return null;
}

function m7UnimplementedFailure(e, status) {
  if (status !== CADR_STATUS_UNIMPLEMENTED_DEVICE) return null;
  if (!m7DevidDiagnosticModule ||
      typeof e.cadr_wasm_m7_unimplemented_diagnostic !== "function") return null;
  const result = transferResult(e,
    e.cadr_wasm_m7_unimplemented_diagnostic() >>> 0, "diagnostic");
  if (result.status !== CADR_STATUS_OK) return null;
  const diagnostic = new Uint8Array(result.diagnostic);
  if (parseCadrM7UnimplementedDiagnostic(diagnostic) === null) return null;
  return { unimplementedDiagnostic: diagnostic.buffer,
    unimplementedDiagnosticDigest: sha256Fixed(diagnostic).buffer };
}

function failureTransferables(failed) {
  if (failed === null) return [];
  return [failed.queueDigest, failed.coreStateDigest,
    ...(failed.diskEvidenceSummary === undefined ? [] :
      [failed.diskEvidenceSummary, failed.diskEvidenceSummaryDigest]),
    ...(failed.unimplementedDiagnostic === undefined ? [] :
      [failed.unimplementedDiagnostic, failed.unimplementedDiagnosticDigest])];
}

function sameBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) ||
      left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/* The worker needs a digest in a terminal response before it may yield the
 * message transaction.  WebCrypto is asynchronous, so use this small local
 * SHA-256 only for the fixed 512-byte CDRM6E1 record. */
function sha256Fixed(bytes) {
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const paddedLength = Math.ceil((bytes.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes); padded[bytes.byteLength] = 0x80;
  const bitLength = BigInt(bytes.byteLength) * 8n;
  const padView = new DataView(padded.buffer);
  padView.setBigUint64(paddedLength - 8, bitLength, false);
  const words = new Uint32Array(64);
  const state = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  const rotate = (value, count) => (value >>> count) | (value << (32 - count));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const view = new DataView(padded.buffer, offset, 64);
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15]; const y = words[index - 2];
      const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3);
      const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choose = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choose + constants[index] + words[index]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
  }
  const digest = new Uint8Array(32); const out = new DataView(digest.buffer);
  for (let index = 0; index < 8; index += 1) out.setUint32(index * 4, state[index], false);
  return digest;
}

/* Closed parser for M6-DEVID1's fixed, evidence-only continuation summary.
 * It intentionally accepts neither extension bytes nor a different policy. */
function parseCdrM6DiskEvidenceSummary(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 512 ||
      new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRM6E1" ||
      bytes[7] !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(8, true);
  const recordBytes = view.getUint32(12, true);
  const policyCode = view.getUint32(16, true);
  const flags = view.getUint32(20, true);
  const prefixCapacity = view.getUint32(24, true);
  const prefixCount = view.getUint32(28, true);
  const selectedMaximum = view.getBigUint64(32, true);
  const totalAccepted = view.getBigUint64(40, true);
  const tailEventCount = view.getBigUint64(48, true);
  const firstOmittedSequence = view.getBigUint64(56, true);
  const lastSequence = view.getBigUint64(64, true);
  const lastPostSlot = view.getBigUint64(72, true);
  const lastIntraSlot = view.getUint32(80, true);
  const haveLast = view.getUint32(84, true);
  const tailStarted = (flags & 1) !== 0;
  const limitExceeded = (flags & 2) !== 0;
  const perKind = [];
  let kindSum = 0n;
  for (let index = 0; index < 9; index += 1) {
    const count = view.getBigUint64(88 + index * 8, true);
    perKind.push(count); kindSum += count;
  }
  const observedReserved = view.getUint32(236, true);
  const prefixSha256 = bytes.slice(240, 272);
  const tailSha256 = bytes.slice(272, 304);
  const limitAttemptPostSlot = view.getBigUint64(304, true);
  const limitAttemptIntraSlot = view.getUint32(312, true);
  const limitReason = view.getUint32(316, true);
  const rejectedEventSha256 = bytes.slice(320, 352);
  if (version !== 1 || recordBytes !== 512 || policyCode !== 1 ||
      (flags & ~3) !== 0 || prefixCapacity !== 512 || prefixCount > 512 ||
      selectedMaximum !== 0x7fffffffffffffffn ||
      totalAccepted > selectedMaximum || kindSum !== totalAccepted ||
      haveLast > 1 || observedReserved !== 0 || !zeroWitness(bytes.subarray(352)) ||
      zeroWitness(prefixSha256) || zeroWitness(tailSha256)) return null;
  if (tailStarted) {
    if (prefixCount !== 512 || totalAccepted <= 512n ||
        tailEventCount !== totalAccepted - 512n ||
        firstOmittedSequence !== 512n) return null;
  } else if (prefixCount !== Number(totalAccepted) || totalAccepted > 512n ||
             tailEventCount !== 0n || firstOmittedSequence !== 0n ||
             !sameBytes(tailSha256, CADR_M6_DEVID_TAIL_H0)) return null;
  if (totalAccepted === 0n) {
    if (haveLast !== 0 || lastSequence !== 0n || lastPostSlot !== 0n ||
        lastIntraSlot !== 0 || !zeroWitness(bytes.subarray(160, 240))) return null;
  } else if (haveLast !== 1 || lastSequence !== totalAccepted - 1n) return null;
  if (limitExceeded) {
    if (limitReason !== 1 || totalAccepted !== selectedMaximum ||
        zeroWitness(rejectedEventSha256)) return null;
  } else if (limitAttemptPostSlot !== 0n || limitAttemptIntraSlot !== 0 ||
             limitReason !== 0 || !zeroWitness(rejectedEventSha256)) return null;
  return Object.freeze({
    firstOmittedSequence, haveLast: haveLast === 1, lastIntraSlot,
    lastPostSlot, lastSequence, limitAttemptIntraSlot, limitAttemptPostSlot,
    limitExceeded, limitReason, perKind: Object.freeze(perKind), policyCode,
    prefixCapacity, prefixCount, prefixSha256, rejectedEventSha256,
    selectedMaximum, tailEventCount, tailSha256, tailStarted, totalAccepted,
  });
}

/* CDRM6FAST1 is intentionally a closed C-owned stop record.  The worker
 * rejects framing drift before publishing it, so the READY4 driver never
 * treats host-side timer batching as equivalent evidence. */
function parseCdrM6FastRun(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 128 ||
      new TextDecoder().decode(bytes.subarray(0, 10)) !== "CDRM6FAST1" ||
      !zeroWitness(bytes.subarray(10, 16))) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const schema = view.getUint32(16, true);
  const recordBytes = view.getUint32(20, true);
  const reason = view.getUint32(24, true);
  const terminalStatus = view.getUint32(28, true);
  const requestedSlots = view.getUint32(32, true);
  const completedSlots = view.getBigUint64(40, true);
  const microinstructionDelta = view.getBigUint64(48, true);
  const preBoundary = view.getBigUint64(56, true);
  const postBoundary = view.getBigUint64(64, true);
  const debugBefore = view.getBigUint64(72, true);
  const debugAfter = view.getBigUint64(80, true);
  const persistentStatus = view.getUint32(88, true);
  const coreLifecycle = view.getUint32(92, true);
  const outstandingRequestId = view.getBigUint64(96, true);
  if (schema !== 1 || recordBytes !== 128 || reason < 1 || reason > 4 ||
      requestedSlots === 0 || requestedSlots > CADR_M6_FAST_RUN_MAX_SLOTS ||
      completedSlots > BigInt(requestedSlots) || postBoundary < preBoundary ||
      postBoundary - preBoundary !== completedSlots ||
      debugBefore > 0xffffffffffffn || debugAfter > 0xffffffffffffn ||
      !zeroWitness(bytes.subarray(104)) || !unsigned32(terminalStatus) ||
      !unsigned32(persistentStatus) || !unsigned32(coreLifecycle)) return null;
  if (reason === 1 && (terminalStatus !== CADR_STATUS_OK ||
      completedSlots !== BigInt(requestedSlots) || debugBefore !== debugAfter)) return null;
  if (reason === 2 && (terminalStatus !== CADR_STATUS_OK ||
      debugBefore === debugAfter || outstandingRequestId !== 0n ||
      persistentStatus !== CADR_STATUS_OK)) return null;
  if (reason === 3 && (terminalStatus !== CADR_STATUS_WAITING_FOR_HOST ||
      persistentStatus !== CADR_STATUS_OK || outstandingRequestId === 0n)) return null;
  if (reason === 4 && (terminalStatus === CADR_STATUS_OK ||
      terminalStatus === CADR_STATUS_WAITING_FOR_HOST)) return null;
  return Object.freeze({
    completedSlots, coreLifecycle, debugAfter, debugBefore, microinstructionDelta,
    outstandingRequestId, persistentStatus, postBoundary, preBoundary,
    reason, requestedSlots, terminalStatus,
  });
}

function m6DevidFailureSummary(e) {
  if (!m6DevidModule ||
      typeof e.cadr_wasm_m6_disk_evidence_summary !== "function") return null;
  const result = transferResult(e, e.cadr_wasm_m6_disk_evidence_summary() >>> 0,
    "summary");
  if (result.status !== CADR_STATUS_OK) return null;
  const summary = new Uint8Array(result.summary);
  if (parseCdrM6DiskEvidenceSummary(summary) === null) return null;
  const digest = sha256Fixed(summary);
  return {
    diskEvidenceSummary: summary.buffer,
    diskEvidenceSummaryDigest: digest.buffer,
  };
}

/* Closed parser for the diagnostic-only CDRM6D1 record.  It deliberately
 * accepts no trace or evidence payload: the diagnostic module reports only
 * fixed-width state already retained by the terminated worker. */
function parsePostTerminalDiagnostic(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 320 ||
      new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRM6D1" ||
      bytes[7] !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(8, true);
  const recordBytes = view.getUint32(12, true);
  const flags = view.getUint32(16, true);
  const reserved0 = view.getUint32(20, true);
  const lifecycle = view.getUint32(24, true);
  const persistentStatus = view.getUint32(28, true);
  const diskEvidenceCount = view.getUint32(32, true);
  const diskEvidenceCapacity = view.getUint32(36, true);
  const currentDiskStatus = view.getUint32(40, true);
  const outstandingOperation = view.getUint32(44, true);
  const completionQueued = view.getUint32(48, true);
  const unexpectedBusOperation = view.getUint32(52, true);
  const currentTransferResetEnables = view.getUint32(56, true);
  const currentBusIrq = view.getUint32(60, true);
  const traceObservationReserved2 = view.getUint32(64, true);
  const packedIntraSlot = view.getUint32(68, true);
  const attemptedBoundary = view.getBigUint64(72, true);
  const microinstructions = view.getBigUint64(80, true);
  const nextSequence = view.getBigUint64(88, true);
  const lastSlot = view.getBigUint64(96, true);
  const lba = view.getBigUint64(104, true);
  const generation = view.getBigUint64(112, true);
  const requestId = view.getBigUint64(120, true);
  const expectedCompletion = view.getBigUint64(128, true);
  const command = view.getUint32(136, true);
  const clp = view.getUint32(140, true);
  const da = view.getUint32(144, true);
  const lma = view.getUint32(148, true);
  const ccwAddress = view.getUint32(152, true);
  const ccwIndex = view.getUint32(156, true);
  const observedDiskStatus = view.getUint32(160, true);
  const transferResetEnables = view.getUint32(164, true);
  const busIrq = view.getUint32(168, true);
  const observedOperation = view.getUint32(172, true);
  const observedCompletionQueued = view.getUint32(176, true);
  const observedReserved = view.getUint32(180, true);
  const stateDigest = bytes.slice(184, 216);
  const reservedTail = bytes.subarray(216, 320);
  const knownFlags = 0x1f;
  if (version !== 1 || recordBytes !== 320 || (flags & ~knownFlags) !== 0 ||
      (flags & 0x10) === 0 || reserved0 !== 0 ||
      traceObservationReserved2 !== 0 || observedReserved !== 0 ||
      !zeroWitness(reservedTail) ||
      lifecycle > 3 || diskEvidenceCapacity !== 512 ||
      diskEvidenceCount > diskEvidenceCapacity) return null;
  return Object.freeze({
    attemptedBoundary,
    canonicalOverflowed: (flags & 0x02) !== 0,
    completionQueued,
    cpuGuestFault: (flags & 0x04) !== 0,
    currentDiskStatus,
    currentTransferResetEnables,
    currentBusIrq,
    diskEvidence: Object.freeze({
      capacity: diskEvidenceCapacity,
      count: diskEvidenceCount,
      overflowed: (flags & 0x01) !== 0,
    }),
    lifecycle,
    microinstructions,
    outstandingOperation,
    persistentStatus,
    stateDigest,
    trace: Object.freeze({
      active: (flags & 0x08) !== 0,
      failureLedgerUnavailable: true,
      failureIndication: null,
      quiescent: (flags & 0x08) === 0,
    }),
    unexpectedBusOperation,
    evidence: Object.freeze({
      haveLast: (packedIntraSlot & 0x80000000) !== 0,
      intraSlot: packedIntraSlot & 0x7fffffff,
      lastSlot,
      nextSequence,
      observedAfter: Object.freeze({
        busIrq,
        ccwAddress,
        ccwIndex,
        clp,
        command,
        completionQueued: observedCompletionQueued,
        da,
        expectedCompletion,
        generation,
        lba,
        lma,
        operation: observedOperation,
        requestId,
        status: observedDiskStatus,
        transferResetEnables,
      }),
    }),
  });
}

function schedulerResult(e, id, op, status, totals = null) {
  const failed = failureEvidence(e, status);
  const meta = totals ?? metadata(e);
  response(id, op, status, { lifecycle: workerLifecycle,
    completedSlots: meta === null ? 0n : meta[0],
    microinstructionsExecuted: meta === null ? 0n : meta[1], ...(failed ?? {}) },
  failureTransferables(failed));
}

async function handle(request) {
  const { id, op } = request;
  if (op === "instantiate") {
    if (instance !== null || !(request.module instanceof WebAssembly.Module)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    instance = await WebAssembly.instantiate(request.module, {});
    diagnosticModule = typeof instance.exports.cadr_wasm_post_terminal_diagnostic === "function";
    m6DevidModule = request.m6DiskEvidencePolicy === true &&
      typeof instance.exports.cadr_wasm_m6_disk_evidence_summary === "function" &&
      typeof instance.exports.cadr_wasm_run_until_event_m6 === "function";
    m7DevidDiagnosticModule = request.m6DiskEvidencePolicy === true &&
      typeof instance.exports.cadr_wasm_m7_unimplemented_diagnostic === "function";
    m8KeyboardProtocol = new CadrM8KeyboardProtocolSubhandler();
    m9PointerProtocol = new CadrM9PointerProtocolSubhandler();
    m11AudioProtocol = [CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) ?
      new CadrM11AudioProtocolSubhandler({ invoke: operation =>
        invokeM11Wasm(instance.exports, operation) }) : null;
    m12DebuggerProtocol = [CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) ?
      new CadrM12ProtocolSubhandler({ invoke: operation =>
        invokeM12Wasm(instance.exports, operation) }) : null;
    if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION) {
      m13SessionId = request.sessionId;
      m13AudioSource = new CadrM13AudioSource({
        invoke: operation => operation.op === "audio-open-private" ?
          invokeM13AudioWasm(instance.exports, operation) : invokeM11Wasm(instance.exports, operation),
        emit: event => send(event, [event.record]),
      });
      m13DebuggerSnapshot = null;
      m13DebuggerSnapshotId = 0n;
      m13DebuggerSnapshotOffset = 0;
    }
    mediaBusy = false;
    mediaDirty = false;
    mediaSnapshotBlocked = false;
    mediaOverlayGeneration = 0n;
    workerLifecycle = CADR_WORKER_NEW;
    hidden = false; visibilityInitialized = false; controlOrdinal = 0n; controlWitness = new Uint8Array(32); controlBoundary = 0n; pendingBoundaryDigest = false; lastFailureEvidence = null;
    const createStatus = instance.exports.cadr_wasm_create() >>> 0;
    /* A module that legitimately creates an already-running core enters the
       worker at PAUSED. Production modules create COLD; the compile-gated
       public synthetic M12 test profile is the only current running creator. */
    if (createStatus === CADR_STATUS_OK && coreIsRunning(instance.exports)) {
      workerLifecycle = CADR_WORKER_PAUSED;
    }
    response(id, op, createStatus, { lifecycle: workerLifecycle });
    return;
  }

  if (protocolVersion === CADR_M3_PROTOCOL_VERSION &&
      CADR_M4_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (!isM5ProtocolVersion(protocolVersion) &&
      CADR_M5_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (!isM6ProtocolVersion(protocolVersion) &&
      CADR_M6_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if ((!isM6ProtocolVersion(protocolVersion) || !diagnosticModule) &&
      CADR_M6_DIAGNOSTIC_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if ((!isM6DevidProtocolVersion(protocolVersion) || !m6DevidModule) &&
      CADR_M6_DEVID_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (!isM7ProtocolVersion(protocolVersion) &&
      CADR_M7_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (!isM8M9ProtocolVersion(protocolVersion) &&
      CADR_M8_M9_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (![CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) && CADR_M11_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }
  if (![CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(protocolVersion) && CADR_M12_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }

  const e = exportsOrStatus(id, op);
  if (e === null) return;
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION &&
      ["m13-debug-micro-step", "m13-debug-macro-step"].includes(op)) {
    if (Object.keys(request).some(key => !["version", "id", "op"].includes(key))) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT); return;
    }
    const lowerOp = op === "m13-debug-micro-step" ? "debug-micro-step" : "debug-macro-step";
    const result = m12DebuggerProtocol.handle(Object.freeze({
      version: CADR_M12_PROTOCOL_VERSION, id, op: lowerOp,
    }));
    if (result === null) { response(id, op, 25, { terminal: true }); return; }
    if ([CADR_M12_STATUS_DEBUG_STOP, CADR_M12_STATUS_LIMIT_REACHED].includes(result.status)) {
      try {
        const stop = parseCdrDbgStop1(result.result?.stop);
        const reason = result.status === CADR_M12_STATUS_DEBUG_STOP ? 1 : 2;
        if (stop.reason !== reason) throw new TypeError("stop/status mismatch");
        const immutable = stop.bytes.slice().buffer;
        response(id, op, result.status, { result: Object.freeze({ stop: immutable }), terminal: false }, [immutable]);
      } catch {
        response(id, op, 25, { terminal: true });
      }
      return;
    }
    response(id, op, result.status, result.status === CADR_STATUS_OK ? { result: result.result, terminal: false } : { terminal: false });
    return;
  }
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION &&
      op === "m13-debug-test-arm-macro-limit") {
    if (Object.keys(request).some(key => !["version", "id", "op"].includes(key)) ||
        typeof e.cadr_wasm_m12_test_arm_macro_limit !== "function") {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT); return;
    }
    response(id, op, e.cadr_wasm_m12_test_arm_macro_limit() >>> 0); return;
  }
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION && op === "m13-debug-snapshot-save") {
    if (Object.keys(request).some(key => !["version", "id", "op"].includes(key)) ||
        workerLifecycle !== CADR_WORKER_PAUSED || !m9InputHostStateNeutral() ||
        m13DebuggerSnapshot !== null || mediaBusy || mediaDirty ||
        mediaSnapshotBlocked || pendingBoundaryDigest) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    const status = e.cadr_wasm_snapshot_save() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (status !== CADR_STATUS_OK || meta === null || meta[0] === 0n || meta[0] > 18132272n) {
      response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_INVALID_ARGUMENT : status); return;
    }
    const pointer = e.cadr_wasm_snapshot_pointer() >>> 0;
    const byteCount = Number(meta[0]);
    if (pointer === 0 || pointer + byteCount > e.memory.buffer.byteLength) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    const raw = new Uint8Array(e.memory.buffer, pointer, byteCount).slice();
    if (!validInnerM12Snapshot(raw, controlBoundary)) {
      response(id, op, 25, { terminal: true }); return;
    }
    const digest = await workerSnapshotSha256(raw);
    if (digest === null || m13DebuggerSnapshotId === 0xffffffffffffffffn) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    m13DebuggerSnapshot = raw;
    m13DebuggerSnapshotId += 1n;
    m13DebuggerSnapshotOffset = 0;
    response(id, op, CADR_STATUS_OK, { snapshotId: m13DebuggerSnapshotId,
      byteCount, snapshotSha256: [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("") });
    return;
  }
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION && op === "m13-debug-snapshot-next") {
    if (Object.keys(request).some(key => !["version", "id", "op", "snapshotId", "offset", "maxBytes"].includes(key)) ||
        typeof request.snapshotId !== "bigint" || request.snapshotId !== m13DebuggerSnapshotId ||
        m13DebuggerSnapshot === null || workerLifecycle !== CADR_WORKER_PAUSED ||
        !Number.isInteger(request.offset) || request.offset !== m13DebuggerSnapshotOffset ||
        !Number.isInteger(request.maxBytes) || request.maxBytes < 1 || request.maxBytes > 1048576) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    const nextOffset = Math.min(m13DebuggerSnapshot.byteLength, request.offset + request.maxBytes);
    const chunk = m13DebuggerSnapshot.slice(request.offset, nextOffset);
    const digest = await workerSnapshotSha256(chunk);
    if (digest === null) { response(id, op, CADR_STATUS_NOT_READY); return; }
    m13DebuggerSnapshotOffset = nextOffset;
    const snapshot = chunk.buffer;
    response(id, op, CADR_STATUS_OK, { snapshotId: m13DebuggerSnapshotId,
      offset: request.offset, nextOffset, done: nextOffset === m13DebuggerSnapshot.byteLength,
      chunkSha256: [...digest].map(byte => byte.toString(16).padStart(2, "0")).join(""),
      snapshot }, [snapshot]); return;
  }
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION && op === "m13-debug-snapshot-release") {
    if (Object.keys(request).some(key => !["version", "id", "op", "snapshotId"].includes(key)) ||
        typeof request.snapshotId !== "bigint" || request.snapshotId !== m13DebuggerSnapshotId ||
        m13DebuggerSnapshot === null) { response(id, op, CADR_STATUS_NOT_READY); return; }
    m13DebuggerSnapshot.fill(0); m13DebuggerSnapshot = null;
    response(id, op, CADR_STATUS_OK, { released: true }); return;
  }
  if (protocolVersion === CADR_M13_PRIVATE_PROTOCOL_VERSION &&
      ["m13-audio-open", "m13-audio-resume", "m13-audio-pause", "m13-audio-ack",
        "m13-audio-device-lost"].includes(op)) {
    if (m13AudioSource === null) { response(id, op, CADR_STATUS_NOT_READY); return; }
    const keys = Object.keys(request);
    let result;
    if (op === "m13-audio-open" || op === "m13-audio-resume") {
      if (keys.some(key => !["version", "id", "op"].includes(key))) {
        response(id, op, CADR_STATUS_INVALID_ARGUMENT); return;
      }
      result = await m13AudioSource.open();
      response(id, op, result.status, result.status === CADR_STATUS_OK ?
        { audio: m13AudioSource.audioState("READY") } : {});
      if (result.status === CADR_STATUS_OK) await m13AudioSource.pump(m13SessionId);
      return;
    }
    if (op === "m13-audio-pause") {
      if (keys.some(key => !["version", "id", "op", "consumerEpoch"].includes(key)) ||
          typeof request.consumerEpoch !== "bigint") { response(id, op, CADR_STATUS_INVALID_ARGUMENT); return; }
      result = await m13AudioSource.pause({ consumerEpoch: request.consumerEpoch });
      response(id, op, result.status, result.status === CADR_STATUS_OK ?
        { audio: m13AudioSource.audioState("PAUSED") } : {}); return;
    }
    if (op === "m13-audio-ack") {
      if (keys.some(key => !["version", "id", "op", "generation", "consumerEpoch", "sequence", "frameOffset"].includes(key)) ||
          ![request.generation, request.consumerEpoch, request.sequence].every(value => typeof value === "bigint") ||
          !Number.isInteger(request.frameOffset)) { response(id, op, CADR_STATUS_INVALID_ARGUMENT); return; }
      result = await m13AudioSource.ack(request);
      response(id, op, result.status, result.status === CADR_STATUS_OK ?
        { audio: m13AudioSource.audioState(m13AudioSource.backpressured ? "BACKPRESSURE" : "READY") } : {});
      if (result.status === CADR_STATUS_OK) await m13AudioSource.pump(m13SessionId);
      return;
    }
    if (keys.some(key => !["version", "id", "op", "consumerEpoch", "cause", "generation", "sequence", "frameOffset"].includes(key)) ||
        typeof request.consumerEpoch !== "bigint" ||
        !["reply-timeout", "processorerror", "context-closed", "device-loss"].includes(request.cause)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT); return;
    }
    result = await m13AudioSource.deviceLost({ consumerEpoch: request.consumerEpoch });
    response(id, op, result.status, result.status === CADR_STATUS_OK ?
      { audio: m13AudioSource.audioState("DEVICE_LOST") } : {}); return;
  }
  if (isM8M9ProtocolVersion(protocolVersion) && op === "input-state") {
    if (Object.keys(request).some(key => !["version", "id", "op"].includes(key))) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const state = m9InputCoreState(e);
    if (state === null) {
      response(id, op, CADR_STATUS_NOT_READY);
    } else {
      response(id, op, CADR_STATUS_OK, { wireSchema: "CDRIOB91", observation: state.bytes.buffer },
        [state.bytes.buffer]);
    }
    return;
  }
  const v6Input = v6InputSubhandlerResult(e, request);
  if (v6Input !== null) {
    sendV6InputSubhandlerResult(v6Input);
    return;
  }
  /* Only public v7 composes the exact CDRM12S1-v2 continuation.  Frozen v6
     and private v8 keep their generic-snapshot prohibition. */
  if (isM8M9ProtocolVersion(protocolVersion) && protocolVersion !== CADR_M12_PROTOCOL_VERSION &&
      ["snapshot-size", "snapshot-save", "snapshot-restore",
    "snapshot-restore-import"].includes(op)) {
    response(id, op, CADR_STATUS_NOT_READY);
    return;
  }
  if (m6DevidModule && ["snapshot-size", "snapshot-save", "snapshot-restore",
    "snapshot-restore-import"].includes(op)) {
    response(id, op, CADR_STATUS_NOT_READY);
    return;
  }
  if ((workerLifecycle === CADR_WORKER_STOPPED || workerLifecycle === CADR_WORKER_FAILED) &&
      op !== "scheduler-state" && op !== "post-terminal-diagnostic" &&
      op !== "m6-disk-evidence-summary") {
    response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle });
    return;
  }
  const v7M12 = v7M12SubhandlerResult(request);
  const v7M11 = v7M11SubhandlerResult(request);
  if (v7M11 !== null) {
    sendV7M12SubhandlerResult(v7M11);
    return;
  }
  if (v7M12 !== null) {
    sendV7M12SubhandlerResult(v7M12);
    return;
  }
  if (isM5ProtocolVersion(protocolVersion) &&
      ["run", "run-digest-batch", "run-digest-batch-v3", "run-digest-batch-m4"].includes(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT, { lifecycle: workerLifecycle });
    return;
  }
  if (op === "post-terminal-diagnostic") {
    if (workerLifecycle !== CADR_WORKER_FAILED || lastFailureEvidence === null) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle });
      return;
    }
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY :
      (e.cadr_wasm_post_terminal_diagnostic() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 320 > e.memory.buffer.byteLength) {
      response(id, op, status);
      return;
    }
    const diagnostic = parsePostTerminalDiagnostic(
      new Uint8Array(e.memory.buffer, pointer, 320).slice());
    if (diagnostic === null) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const queueStatus = e.cadr_wasm_scheduler_digest() >>> 0;
    const queueDigest = queueStatus === CADR_STATUS_OK ?
      new Uint8Array(e.memory.buffer, pointer, 32).slice() : null;
    const stateStatus = e.cadr_wasm_state_v5_failure_digest() >>> 0;
    const stateDigest = stateStatus === CADR_STATUS_OK ?
      new Uint8Array(e.memory.buffer, pointer, 32).slice() : null;
    const expectedQueue = new Uint8Array(lastFailureEvidence.queueDigest);
    const expectedState = new Uint8Array(lastFailureEvidence.coreStateDigest);
    if (!sameBytes(diagnostic.stateDigest, expectedState) ||
        !sameBytes(queueDigest, expectedQueue) || !sameBytes(stateDigest, expectedState)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, CADR_STATUS_OK, {
      diagnostic: Object.freeze({ ...diagnostic, stateDigest: diagnostic.stateDigest.buffer }),
      lastCompleteBoundary: lastFailureEvidence.lastCompleteBoundary,
      terminalCoreDigestVerified: true,
      terminalQueueDigestVerified: true,
      wireSchema: "CDRM6D1",
    }, [diagnostic.stateDigest.buffer]);
    return;
  }
  if (op === "media-overlay-state") {
    if (typeof request.busy !== "boolean" ||
        typeof request.dirty !== "boolean" ||
        typeof request.snapshotBlocked !== "boolean" ||
        !unsigned64(request.overlayGeneration) ||
        (request.dirty && request.overlayGeneration === 0n) ||
        (request.detached !== true &&
         request.overlayGeneration < mediaOverlayGeneration) ||
        (mediaDirty && !request.dirty && request.detached !== true) ||
        (mediaSnapshotBlocked && !request.snapshotBlocked &&
         request.detached !== true) ||
        (request.detached === true &&
         (request.busy || request.dirty || request.snapshotBlocked ||
          request.overlayGeneration !== 0n))) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    mediaBusy = request.busy;
    mediaDirty = request.dirty;
    mediaSnapshotBlocked = request.snapshotBlocked;
    mediaOverlayGeneration = request.overlayGeneration;
    response(id, op, CADR_STATUS_OK);
  } else if (op === "input") {
    const bytes = uint8Bytes(request.bytes);
    if (bytes === null || copyInput(e, bytes) === 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, CADR_STATUS_OK, { byteCount: bytes.byteLength });
  } else if (op === "import") {
    if (!unsigned32(request.artifactKind) || !unsigned32(request.byteCount)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, e.cadr_wasm_import(request.artifactKind, request.byteCount) >>> 0);
  } else if (op === "stream-begin") {
    const size = split64(request.byteCount);
    if (!unsigned32(request.artifactKind) || size === null) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, e.cadr_wasm_stream_begin(request.artifactKind, size[0], size[1]) >>> 0);
  } else if (op === "stream-chunk") {
    const bytes = uint8Bytes(request.bytes);
    const offset = split64(request.offset);
    if (bytes === null || offset === null || bytes.byteLength > CADR_TRANSFER_LIMIT ||
        (bytes.byteLength !== 0 && copyInput(e, bytes) === 0)) {
      e.cadr_wasm_stream_abort();
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, e.cadr_wasm_stream_chunk(offset[0], offset[1], bytes.byteLength) >>> 0,
             { byteCount: bytes.byteLength });
  } else if (op === "stream-finish") {
    response(id, op, e.cadr_wasm_stream_finish() >>> 0);
  } else if (op === "stream-abort") {
    response(id, op, e.cadr_wasm_stream_abort() >>> 0);
  } else if (op === "cold-power-on") {
    const status = e.cadr_wasm_cold_power_on() >>> 0;
    if (status === CADR_STATUS_OK) workerLifecycle = CADR_WORKER_CORE_RESET;
    response(id, op, status, { lifecycle: workerLifecycle });
  } else if (op === "boot") {
    const status = e.cadr_wasm_boot() >>> 0;
    if (status === CADR_STATUS_OK) workerLifecycle = CADR_WORKER_PAUSED;
    response(id, op, status, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-events") {
    const bytes = schedulerEventWire(request.events);
    if (bytes === null || copyInput(e, bytes) === 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const status = e.cadr_wasm_schedule_events(request.events.length, bytes.byteLength) >>> 0;
    response(id, op, status, { delivered: status === CADR_STATUS_OK ? request.events.length : 0,
      lifecycle: workerLifecycle });
  } else if (op === "scheduler-state") {
    const witness = controlWitness.slice();
    const failed = workerLifecycle === CADR_WORKER_FAILED && lastFailureEvidence !== null ?
      { lastCompleteBoundary: lastFailureEvidence.lastCompleteBoundary,
        queueDigest: lastFailureEvidence.queueDigest.slice(0),
        coreStateDigest: lastFailureEvidence.coreStateDigest.slice(0) } : null;
    response(id, op, CADR_STATUS_OK, { lifecycle: workerLifecycle, hidden,
      visibilityInitialized, snapshotVisibilityInitialized, controlOrdinal, controlBoundary,
      controlWitness: witness.buffer, runActive,
      deferredControlCount: deferredControls.length,
      pendingBoundaryDigest, mediaBusy, mediaDirty, mediaSnapshotBlocked,
      mediaOverlayGeneration, ...(failed ?? {}) },
    failed === null ? [witness.buffer] : [witness.buffer, failed.queueDigest, failed.coreStateDigest]);
  } else if (op === "scheduler-transcript-start") {
    if (workerLifecycle !== CADR_WORKER_PAUSED) { response(id, op, CADR_STATUS_NOT_READY); return; }
    const status = e.cadr_wasm_scheduler_transcript_start() >>> 0;
    response(id, op, status, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-transcript-drain") {
    const status = e.cadr_wasm_scheduler_transcript() >>> 0;
    const result = transferResult(e, status, "transcript");
    if (result.status !== CADR_STATUS_OK) response(id, op, result.status);
    else response(id, op, status, result, [result.transcript]);
  } else if (op === "scheduler-transcript-finish") {
    if (workerLifecycle !== CADR_WORKER_PAUSED) { response(id, op, CADR_STATUS_NOT_READY); return; }
    const status = e.cadr_wasm_scheduler_transcript_finish() >>> 0;
    response(id, op, status, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-start") {
    if (visibilityInitialized === false || workerLifecycle !== CADR_WORKER_PAUSED || hidden || !coreIsRunning(e)) { response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return; }
    workerLifecycle = CADR_WORKER_RUNNING;
    response(id, op, CADR_STATUS_OK, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-pause") {
    if (workerLifecycle !== CADR_WORKER_RUNNING && workerLifecycle !== CADR_WORKER_WAITING &&
        workerLifecycle !== CADR_WORKER_PAUSED) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return;
    }
    if (workerLifecycle === CADR_WORKER_RUNNING || workerLifecycle === CADR_WORKER_WAITING) workerLifecycle = CADR_WORKER_PAUSED;
    response(id, op, CADR_STATUS_OK, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-visibility") {
    if (typeof request.hidden !== "boolean") { response(id, op, CADR_STATUS_INVALID_ARGUMENT); return; }
    if (!await noteVisibilityControl(e, request.hidden, id)) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle, hidden }); return;
    }
    visibilityInitialized = true;
    if (hidden && (workerLifecycle === CADR_WORKER_RUNNING || workerLifecycle === CADR_WORKER_WAITING)) workerLifecycle = CADR_WORKER_PAUSED;
    response(id, op, CADR_STATUS_OK, { lifecycle: workerLifecycle, hidden });
  } else if (op === "scheduler-run") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    if (!m5SlotAdvanceAllowed({ visibilityInitialized, lifecycle: workerLifecycle, hidden,
      pendingBoundaryDigest }, CADR_WORKER_RUNNING)) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle });
      return;
    }
    let status = CADR_STATUS_OK;
    let completed = 0n;
    let microinstructions = 0n;
    runActive = true;
    while (completed < request.clockSlots && workerLifecycle === CADR_WORKER_RUNNING) {
      status = e.cadr_wasm_run(1) >>> 0;
      const runMeta = metadata(e);
      if (runMeta !== null) { completed += runMeta[0]; microinstructions += runMeta[1]; }
      if (status !== CADR_STATUS_OK || completed >= BigInt(request.clockSlots)) break;
      /* Yield a worker turn: a directly captured control request is observed
       * only between complete outer slots. */
      await new Promise((resolveYield) => setTimeout(resolveYield, 0));
      if (deferredControls.length !== 0) break;
    }
    runActive = false;
    if (status === CADR_STATUS_WAITING_FOR_HOST) workerLifecycle = CADR_WORKER_WAITING;
    schedulerResult(e, id, op, status, [completed, microinstructions]);
    await applyDeferredControls();
  } else if (op === "scheduler-run-v7-slice") {
    /*
     * Selected M13 progress contract: this is a v7-only, fixed-ceiling
     * non-interruptible slice.  `clockSlots` bounds outer calls, not merely
     * metadata deltas: a queued host completion may report zero completed
     * guest slots but still consumes exactly one outer call.  No live control
     * is observed until the one yield following this bounded loop.
     */
    const expectedFields = ["version", "id", "op", "clockSlots"];
    if (Object.keys(request).length !== expectedFields.length ||
        expectedFields.some(field => !Object.hasOwn(request, field)) ||
        !unsigned32(request.clockSlots) || request.clockSlots === 0 ||
        request.clockSlots > CADR_M12_SCHEDULER_SLICE_MAX_SLOTS) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    if (!m5SlotAdvanceAllowed({ visibilityInitialized, lifecycle: workerLifecycle, hidden,
      pendingBoundaryDigest }, CADR_WORKER_RUNNING)) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle });
      return;
    }
    let status = CADR_STATUS_OK;
    let completed = 0n;
    let microinstructions = 0n;
    runActive = true;
    for (let outerSlots = 0; outerSlots < request.clockSlots; outerSlots += 1) {
      status = e.cadr_wasm_run(1) >>> 0;
      const runMeta = metadata(e);
      if (runMeta === null) {
        status = CADR_STATUS_NOT_READY;
        break;
      }
      completed += runMeta[0];
      microinstructions += runMeta[1];
      if (status !== CADR_STATUS_OK) break;
    }
    if (status === CADR_STATUS_WAITING_FOR_HOST) workerLifecycle = CADR_WORKER_WAITING;
    /* The captured-control path stays active across this sole post-slice
     * yield, so a pause/stop is ordered after, never inside, the slice. */
    await new Promise((resolveYield) => setTimeout(resolveYield, 0));
    runActive = false;
    schedulerResult(e, id, op, status, [completed, microinstructions]);
    await applyDeferredControls();
  } else if (op === "scheduler-single-step") {
    if (!m5SlotAdvanceAllowed({ visibilityInitialized, lifecycle: workerLifecycle, hidden,
      pendingBoundaryDigest }, CADR_WORKER_PAUSED)) { response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return; }
    workerLifecycle = CADR_WORKER_RUNNING;
    let status = e.cadr_wasm_run(1) >>> 0;
    /* Completion-only host turns do not satisfy a requested guest step. */
    while (status === CADR_STATUS_OK && metadata(e) !== null && metadata(e)[0] === 0n) status = e.cadr_wasm_run(1) >>> 0;
    workerLifecycle = status === CADR_STATUS_WAITING_FOR_HOST ? CADR_WORKER_WAITING : CADR_WORKER_PAUSED;
    schedulerResult(e, id, op, status);
  } else if (op === "scheduler-reset") {
    if (workerLifecycle !== CADR_WORKER_PAUSED) { response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return; }
    const status = e.cadr_wasm_reset() >>> 0;
    if (status === CADR_STATUS_OK) pendingBoundaryDigest = false;
    response(id, op, status, { lifecycle: workerLifecycle });
  } else if (op === "scheduler-stop" || op === "scheduler-shutdown") {
    if (workerLifecycle !== CADR_WORKER_RUNNING && workerLifecycle !== CADR_WORKER_PAUSED &&
        workerLifecycle !== CADR_WORKER_WAITING) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return;
    }
    workerLifecycle = CADR_WORKER_STOPPED;
    pendingBoundaryDigest = false;
    const discarded = op === "scheduler-shutdown";
    response(id, op, CADR_STATUS_OK, { lifecycle: workerLifecycle, discardedUnsavedState: discarded });
    if (discarded) { discardWorkerState(); closeWorkerSoon(); }
  } else if (op === "run") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_run(request.clockSlots) >>> 0;
    const meta = metadata(e);
    response(id, op, status, {
      completedSlots: meta === null ? 0n : meta[0],
      microinstructionsExecuted: meta === null ? 0n : meta[1],
    });
  } else if (op === "run-digest-batch") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0 ||
        request.clockSlots > CADR_DIGEST_BATCH_MAX) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const bytes = new Uint8Array(request.clockSlots * 64);
    let boundaryCount = 0;
    let terminalStatus = CADR_STATUS_OK;
    while (boundaryCount < request.clockSlots) {
      if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
        response(id, op, CADR_STATUS_NOT_READY, { boundaryCount, terminalStatus });
        return;
      }
      terminalStatus = e.cadr_wasm_run(1) >>> 0;
      const runMeta = metadata(e);
      if (runMeta === null || runMeta[0] > 1n) {
        response(id, op, CADR_STATUS_INVALID_ARGUMENT, { boundaryCount, terminalStatus });
        return;
      }
      /* A queued host completion is applied between slots and must not spend
       * one requested digest boundary. */
      if (runMeta[0] === 0n) {
        if (terminalStatus === CADR_STATUS_OK) continue;
        break;
      }
      const digest = outputDigests(e);
      if (digest === null || digest.status !== CADR_STATUS_OK) {
        response(id, op, digest === null ? CADR_STATUS_NOT_READY : digest.status,
          { boundaryCount, terminalStatus });
        return;
      }
      bytes.set(digest.digests, boundaryCount * 64);
      boundaryCount += 1;
      if (terminalStatus !== CADR_STATUS_OK) break;
    }
    const returned = bytes.slice(0, boundaryCount * 64);
    response(id, op, CADR_STATUS_OK, { boundaryCount, terminalStatus,
      digests: returned.buffer }, [returned.buffer]);
  } else if (op === "run-digest-batch-v3") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0 ||
        request.clockSlots > CADR_DIGEST_BATCH_MAX) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const bytes = new Uint8Array(request.clockSlots * 96);
    let boundaryCount = 0;
    let terminalStatus = CADR_STATUS_OK;
    while (boundaryCount < request.clockSlots) {
      if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
        response(id, op, CADR_STATUS_NOT_READY, { boundaryCount, terminalStatus });
        return;
      }
      terminalStatus = e.cadr_wasm_run(1) >>> 0;
      const runMeta = metadata(e);
      if (runMeta === null || runMeta[0] > 1n) {
        response(id, op, CADR_STATUS_INVALID_ARGUMENT, { boundaryCount, terminalStatus });
        return;
      }
      if (runMeta[0] === 0n) {
        if (terminalStatus === CADR_STATUS_OK) continue;
        break;
      }
      const digest = outputDigestsV3(e);
      if (digest === null || digest.status !== CADR_STATUS_OK) {
        response(id, op, digest === null ? CADR_STATUS_NOT_READY : digest.status,
          { boundaryCount, terminalStatus });
        return;
      }
      bytes.set(digest.digests, boundaryCount * 96);
      boundaryCount += 1;
      if (terminalStatus !== CADR_STATUS_OK) break;
    }
    const returned = bytes.slice(0, boundaryCount * 96);
    response(id, op, CADR_STATUS_OK, { boundaryCount, terminalStatus,
      digests: returned.buffer }, [returned.buffer]);
  } else if (op === "run-digest-batch-m4") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0 ||
        request.clockSlots > CADR_DIGEST_BATCH_MAX) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const bytes = new Uint8Array(request.clockSlots * 96);
    const interruptBytes = new Uint8Array(request.clockSlots);
    let boundaryCount = 0;
    let terminalStatus = CADR_STATUS_OK;
    let boundaryPendingHost = false;
    runActive = true;
    while (boundaryCount < request.clockSlots) {
      if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
        response(id, op, CADR_STATUS_NOT_READY, {
          boundaryCount, terminalStatus, boundaryPendingHost,
        });
        return;
      }
      terminalStatus = e.cadr_wasm_run(1) >>> 0;
      const runMeta = metadata(e);
      if (runMeta === null || runMeta[0] > 1n) {
        response(id, op, CADR_STATUS_INVALID_ARGUMENT, {
          boundaryCount, terminalStatus, boundaryPendingHost,
        });
        return;
      }
      if (runMeta[0] === 0n) {
        if (terminalStatus === CADR_STATUS_OK) continue;
        break;
      }
      /*
       * A host wait belongs to the just-completed guest slot.  Return without
       * hashing that last boundary so the caller can service and apply the
       * request, then publish the quiescent digest for the same ordinal.
       */
      if (terminalStatus === CADR_STATUS_WAITING_FOR_HOST) {
        boundaryPendingHost = true;
        break;
      }
      const digest = outputDigestsV3(e);
      if (digest === null || digest.status !== CADR_STATUS_OK) {
        response(id, op, digest === null ? CADR_STATUS_NOT_READY : digest.status,
          { boundaryCount, terminalStatus, boundaryPendingHost });
        return;
      }
      bytes.set(digest.digests, boundaryCount * 96);
      if ((e.cadr_wasm_disk_observation() >>> 0) !== CADR_STATUS_OK) {
        response(id, op, CADR_STATUS_NOT_READY, {
          boundaryCount, terminalStatus, boundaryPendingHost,
        });
        return;
      }
      const diskMeta = metadata(e);
      if (diskMeta === null) {
        response(id, op, CADR_STATUS_NOT_READY, {
          boundaryCount, terminalStatus, boundaryPendingHost,
        });
        return;
      }
      interruptBytes[boundaryCount] =
        (diskMeta[0] & 8n) !== 0n ? 1 : 0;
      boundaryCount += 1;
      if (terminalStatus !== CADR_STATUS_OK) break;
    }
    const returned = bytes.slice(0, boundaryCount * 96);
    const returnedInterrupts = interruptBytes.slice(0, boundaryCount);
    response(id, op, CADR_STATUS_OK, {
      boundaryCount, terminalStatus, boundaryPendingHost,
      digests: returned.buffer,
      interrupts: returnedInterrupts.buffer,
    }, [returned.buffer, returnedInterrupts.buffer]);
  } else if (op === "run-digest-batch-m5") {
    if (!unsigned32(request.clockSlots) || request.clockSlots === 0 ||
        request.clockSlots > CADR_DIGEST_BATCH_MAX) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT); return;
    }
    if (visibilityInitialized === false || workerLifecycle !== CADR_WORKER_RUNNING || hidden) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle }); return;
    }
    const batchState = { pendingBoundaryDigest, lifecycle: workerLifecycle };
    runActive = true;
    const batch = await runM5DigestBatch({
      clockSlots: request.clockSlots, state: batchState,
      runOne: () => e.cadr_wasm_run(1) >>> 0,
      metadata: () => metadata(e),
      outputDigest: () => outputDigestsM5(e),
      isFailure: status => [CADR_STATUS_HOST_FAILURE, CADR_STATUS_GUEST_FAULT,
        CADR_STATUS_UNIMPLEMENTED_DEVICE, CADR_STATUS_HALTED].includes(status),
      collectFailure: status => {
        const evidence = failureEvidence(e, status);
        batchState.lifecycle = workerLifecycle;
        return evidence;
      },
      statusOk: CADR_STATUS_OK, statusWaiting: CADR_STATUS_WAITING_FOR_HOST,
      waitingLifecycle: CADR_WORKER_WAITING,
      yieldTurn: () => new Promise((resolveYield) => setTimeout(resolveYield, 0)),
      hasDeferredControl: () => deferredControls.length !== 0,
    });
    runActive = false;
    pendingBoundaryDigest = batchState.pendingBoundaryDigest;
    workerLifecycle = batchState.lifecycle;
    if (batch.invalidMetadata) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT, {
        boundaryCount: batch.boundaryCount, terminalStatus: batch.terminalStatus,
        boundaryPendingHost: batch.boundaryPendingHost,
      });
      return;
    }
    if (batch.digestStatus !== CADR_STATUS_OK) {
      response(id, op, batch.digestStatus === null ? CADR_STATUS_NOT_READY : batch.digestStatus, {
        boundaryCount: batch.boundaryCount, terminalStatus: batch.terminalStatus,
        boundaryPendingHost: batch.boundaryPendingHost,
      });
      return;
    }
    const bytes = new Uint8Array(batch.boundaryCount * 128);
    for (let index = 0; index < batch.rows.length; index += 1) bytes.set(batch.rows[index], index * 128);
    const failed = batch.failure;
    response(id, op, CADR_STATUS_OK, { boundaryCount: batch.boundaryCount,
      terminalStatus: batch.terminalStatus, boundaryPendingHost: batch.boundaryPendingHost,
      lifecycle: workerLifecycle,
      digests: bytes.buffer, ...(failed ?? {}) },
    failed === null ? [bytes.buffer] : [bytes.buffer, ...failureTransferables(failed)]);
    await applyDeferredControls();
  } else if (op === "run-until-event-m6") {
    if (!m6DevidModule || !unsigned32(request.clockSlots) ||
        request.clockSlots === 0 || request.clockSlots > CADR_M6_FAST_RUN_MAX_SLOTS ||
        visibilityInitialized === false || workerLifecycle !== CADR_WORKER_RUNNING || hidden ||
        runActive || deferredControls.length !== 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT, { lifecycle: workerLifecycle });
      return;
    }
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    if (pointer === 0) {
      response(id, op, CADR_STATUS_NOT_READY, { lifecycle: workerLifecycle });
      return;
    }
    runActive = true;
    const status = e.cadr_wasm_run_until_event_m6(request.clockSlots) >>> 0;
    runActive = false;
    if (status !== CADR_STATUS_OK || pointer + 128 > e.memory.buffer.byteLength) {
      response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status,
        { lifecycle: workerLifecycle });
      return;
    }
    const fastRun = new Uint8Array(e.memory.buffer, pointer, 128).slice();
    const parsed = parseCdrM6FastRun(fastRun);
    if (parsed === null) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT, { lifecycle: workerLifecycle });
      return;
    }
    let failure = null;
    if (parsed.reason === 4) {
      workerLifecycle = CADR_WORKER_FAILED;
      pendingBoundaryDigest = false;
      failure = failureEvidence(e, parsed.terminalStatus);
      lastFailureEvidence = failure;
    } else if (parsed.reason === 3) {
      workerLifecycle = CADR_WORKER_WAITING;
      pendingBoundaryDigest = parsed.completedSlots !== 0n;
    } else {
      workerLifecycle = CADR_WORKER_RUNNING;
      pendingBoundaryDigest = false;
    }
    response(id, op, CADR_STATUS_OK, {
      wireSchema: "CDRM6FAST1",
      fastRun: fastRun.buffer,
      reason: parsed.reason,
      terminalStatus: parsed.terminalStatus,
      requestedSlots: parsed.requestedSlots,
      completedSlots: parsed.completedSlots,
      microinstructionDelta: parsed.microinstructionDelta,
      preBoundary: parsed.preBoundary,
      postBoundary: parsed.postBoundary,
      debugBefore: parsed.debugBefore,
      debugAfter: parsed.debugAfter,
      persistentStatus: parsed.persistentStatus,
      coreLifecycle: parsed.coreLifecycle,
      outstandingRequestId: parsed.outstandingRequestId,
      lifecycle: workerLifecycle,
      ...(failure ?? {}),
  }, failure === null ? [fastRun.buffer] :
    [fastRun.buffer, ...failureTransferables(failure)]);
    await applyDeferredControls();
  } else if (op === "boundary-digests") {
    const result = outputDigests(e);
    if (result === null) response(id, op, CADR_STATUS_NOT_READY);
    else if (result.status !== CADR_STATUS_OK) response(id, op, result.status);
    else response(id, op, CADR_STATUS_OK, { digests: result.digests.buffer }, [result.digests.buffer]);
  } else if (op === "boundary-digests-v3") {
    const result = outputDigestsV3(e);
    if (result === null) response(id, op, CADR_STATUS_NOT_READY);
    else if (result.status !== CADR_STATUS_OK) response(id, op, result.status);
    else response(id, op, CADR_STATUS_OK, { digests: result.digests.buffer }, [result.digests.buffer]);
  } else if (op === "boundary-digest-v4") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY :
      (e.cadr_wasm_state_v4_digest() >>> 0);
    if (status !== CADR_STATUS_OK ||
        pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op, status);
      return;
    }
    const digest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
    response(id, op, status, { digest: digest.buffer }, [digest.buffer]);
  } else if (op === "boundary-digest-v5") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY :
      (e.cadr_wasm_state_v5_digest() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op, status); return;
    }
    const digest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
    response(id, op, status, { digest: digest.buffer }, [digest.buffer]);
  } else if (op === "scheduler-queue-digest") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY :
      (e.cadr_wasm_scheduler_digest() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op, status); return;
    }
    const digest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
    response(id, op, status, { digest: digest.buffer }, [digest.buffer]);
  } else if (op === "boot-witness") {
    if (runActive || pendingBoundaryDigest || deferredControls.length !== 0 ||
        mediaBusy || workerLifecycle !== CADR_WORKER_RUNNING ||
        visibilityInitialized !== true || hidden) {
      response(id, op, CADR_STATUS_NOT_READY, {
        lifecycle: workerLifecycle,
      });
      return;
    }
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY :
      (e.cadr_wasm_boot_witness() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 96 > e.memory.buffer.byteLength) {
      response(id, op, status); return;
    }
    const sample = new Uint8Array(e.memory.buffer, pointer, 96).slice();
    const view = new DataView(sample.buffer);
    const magic = new TextDecoder().decode(sample.subarray(0, 7));
    if (magic !== "CDRM6I1" || sample[7] !== 0 ||
        (view.getBigUint64(8, true) >> 48n) !== 0n ||
        (view.getBigUint64(16, true) >> 48n) !== 0n ||
        (view.getBigUint64(24, true) >> 48n) !== 0n ||
        view.getUint32(92, true) !== 0) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    let generation = 0n;
    let boundary = 0n;
    let coreLifecycle = 0;
    let persistentStatus = CADR_STATUS_NOT_READY;
    let outstandingRequestId = 0n;
    let lastCompletedRequestId = 0n;
    const infoStatus = e.cadr_wasm_machine_info() >>> 0;
    if (infoStatus !== CADR_STATUS_OK ||
        pointer + 64 > e.memory.buffer.byteLength) {
      response(id, op, infoStatus === CADR_STATUS_OK ?
        CADR_STATUS_NOT_READY : infoStatus);
      return;
    }
    const info = new DataView(e.memory.buffer, pointer, 64);
    coreLifecycle = info.getUint32(0, true);
    boundary = info.getBigUint64(8, true);
    generation = info.getBigUint64(24, true);
    outstandingRequestId = info.getBigUint64(40, true);
    lastCompletedRequestId = info.getBigUint64(48, true);
    persistentStatus = info.getUint32(56, true);
    const metaStatus = e.cadr_wasm_boot_witness_meta() >>> 0;
    if (metaStatus !== CADR_STATUS_OK ||
        pointer + 28 > e.memory.buffer.byteLength) {
      response(id, op, metaStatus === CADR_STATUS_OK ?
        CADR_STATUS_NOT_READY : metaStatus);
      return;
    }
    const witnessMeta = new DataView(e.memory.buffer, pointer, 28);
    if (coreLifecycle !== 2 || witnessMeta.getUint32(0, true) !== 0) {
      response(id, op, CADR_STATUS_NOT_READY, {
        lifecycle: workerLifecycle,
      });
      return;
    }
    response(id, op, status, {
      wireSchema: "CDRM6I1",
      sample: sample.buffer,
      debugInstruction: view.getBigUint64(8, true),
      p0: view.getBigUint64(16, true),
      p1: view.getBigUint64(24, true),
      p0Pc: view.getUint32(32, true),
      p1Pc: view.getUint32(36, true),
      nextMicroPc: view.getUint32(40, true),
      locationCounter: view.getUint32(44, true),
      interruptControl: view.getUint32(48, true),
      interruptStatus: view.getUint32(52, true),
      interruptPending: view.getUint32(56, true),
      iobCsr: view.getUint32(60, true),
      iobFifoCount: view.getUint32(64, true),
      iobScancode: view.getUint32(68, true),
      diskStatus: view.getUint32(72, true),
      diskTransferActive: view.getUint32(76, true),
      outstandingOperation: view.getUint32(80, true),
      diskInterruptRequest: view.getUint32(84, true),
      hostRequestPending: view.getUint32(88, true),
      hostCompletionQueued: view.getUint32(92, true),
      schedulerPendingCount: witnessMeta.getUint32(24, true),
      boundary,
      generation,
      coreLifecycle,
      persistentStatus,
      lastCompletedRequestId,
      outstandingRequestId,
      schedulerPhase: witnessMeta.getUint32(0, true),
      expectedCompletionByteCount: witnessMeta.getBigUint64(8, true),
      completionByteCount: witnessMeta.getBigUint64(16, true),
      boundaryPendingHost: pendingBoundaryDigest,
      runActive,
      deferredControlCount: deferredControls.length,
      mediaBusy,
      mediaDirty,
      mediaSnapshotBlocked,
      mediaOverlayGeneration,
      visibilityInitialized,
      hidden,
    }, [sample.buffer]);
  } else if (op === "display-update" || op === "display-full") {
    const status = (op === "display-full" ?
      e.cadr_wasm_display_full() : e.cadr_wasm_display_update()) >>> 0;
    const result = transferResult(e, status, "frame");
    if (result.status !== CADR_STATUS_OK) {
      response(id, op, result.status);
      return;
    }
    let parsed;
    try {
      parsed = parseCdrDisp1(result.frame);
    } catch {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    if ((op === "display-full" && !parsed.full) ||
        (parsed.rectangles.length === 0 && parsed.full)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const updated = parsed.rectangles.length !== 0;
    const dirtyRectangles = parsed.rectangles.map(rectangle => ({ ...rectangle }));
    const common = {
      wireSchema: "CDRDISP1",
      updated,
      full: parsed.full,
      machineGeneration: parsed.machineGeneration,
      framebufferGeneration: parsed.framebufferGeneration,
      blackOnWhite: parsed.bow,
      width: 768,
      height: 963,
      dirtyRectangles,
    };
    if (!updated) {
      response(id, op, CADR_STATUS_OK, common);
      return;
    }
    response(id, op, CADR_STATUS_OK,
      { ...common, frame: result.frame }, [result.frame]);
  } else if (op === "host-next-request") {
    const input = e.cadr_wasm_input_reserve(CADR_HOST_DESCRIPTOR_LIMIT + CADR_HOST_REQUEST_PAYLOAD_LIMIT) >>> 0;
    const output = e.cadr_wasm_output_pointer() >>> 0;
    if (input === 0 || output === 0 || input + CADR_HOST_DESCRIPTOR_LIMIT > e.memory.buffer.byteLength ||
        output + 48 > e.memory.buffer.byteLength) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_host_next_request() >>> 0;
    if (status !== CADR_STATUS_OK) {
      response(id, op, status);
      return;
    }
    const view = new DataView(e.memory.buffer, output, 48);
    const operation = view.getUint32(0, true);
    const generation = view.getBigUint64(8, true);
    const requestId = view.getBigUint64(16, true);
    const descriptorByteCount = view.getBigUint64(24, true);
    const completionByteCount = view.getBigUint64(32, true);
    const requestPayloadByteCount = view.getBigUint64(40, true);
    if (!unsigned32(operation) || !unsigned64(generation) || !unsigned64(requestId) ||
        descriptorByteCount > BigInt(CADR_HOST_DESCRIPTOR_LIMIT) ||
        requestPayloadByteCount > BigInt(CADR_HOST_REQUEST_PAYLOAD_LIMIT) ||
        completionByteCount > BigInt(CADR_TRANSFER_LIMIT)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const descriptor = new Uint8Array(e.memory.buffer, input, Number(descriptorByteCount)).slice();
    const requestPayload = new Uint8Array(e.memory.buffer,
      input + CADR_HOST_DESCRIPTOR_LIMIT, Number(requestPayloadByteCount)).slice();
    if (protocolVersion === CADR_M3_PROTOCOL_VERSION) {
      if (requestPayloadByteCount !== 0n) {
        response(id, op, CADR_STATUS_INVALID_ARGUMENT);
        return;
      }
      response(id, op, CADR_STATUS_OK, {
        request: {
          operation, generation, requestId, descriptorByteCount,
          completionByteCount,
        },
        descriptor: descriptor.buffer,
      }, [descriptor.buffer]);
    } else {
      response(id, op, CADR_STATUS_OK, {
        request: {
          operation, generation, requestId, descriptorByteCount,
          completionByteCount, requestPayloadByteCount,
        },
        descriptor: descriptor.buffer,
        requestPayload: requestPayload.buffer,
      }, [descriptor.buffer, requestPayload.buffer]);
    }
  } else if (op === "host-complete") {
    const bytes = uint8Bytes(request.bytes);
    const generation = split64(request.generation);
    const requestId = split64(request.requestId);
    if (bytes === null || bytes.byteLength > CADR_TRANSFER_LIMIT ||
        !unsigned32(request.operation) || !unsigned32(request.hostStatus) ||
        generation === null || requestId === null ||
        (bytes.byteLength !== 0 && copyInput(e, bytes) === 0)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const status = e.cadr_wasm_host_complete(request.operation, request.hostStatus,
      generation[0], generation[1], requestId[0], requestId[1], bytes.byteLength) >>> 0;
    if (status === CADR_STATUS_OK && workerLifecycle === CADR_WORKER_WAITING) {
      workerLifecycle = CADR_WORKER_RUNNING;
    }
    response(id, op, status, { byteCount: bytes.byteLength, lifecycle: workerLifecycle });
  } else if (op === "disk-observation") {
    if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_disk_observation() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (meta === null) response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status);
    else response(id, op, CADR_STATUS_OK, { diskStatus: meta[0], interruptPending: meta[1] });
  } else if (op === "boot-media-observation") {
    if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_boot_media_observation() >>> 0;
    const pointer = e.cadr_wasm_meta_pointer() >>> 0;
    if (status !== CADR_STATUS_OK || pointer === 0 ||
        pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op,
        status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status);
    } else {
      const view = new DataView(e.memory.buffer, pointer, 32);
      response(id, op, CADR_STATUS_OK, {
        p0Pc: view.getBigUint64(0, true),
        p1Pc: view.getBigUint64(8, true),
        nextMicroPc: view.getBigUint64(16, true),
        outstandingRequestId: view.getBigUint64(24, true),
      });
    }
  } else if (op === "disk-evidence") {
    if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_disk_evidence() >>> 0;
    const result = transferResult(e, status, "bytes");
    if (result.status !== CADR_STATUS_OK) {
      response(id, op, result.status);
    } else {
      response(id, op, CADR_STATUS_OK, result, [result.bytes]);
    }
  } else if (op === "m6-disk-evidence-summary") {
    if ((e.cadr_wasm_meta_pointer() >>> 0) === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_m6_disk_evidence_summary() >>> 0;
    const result = transferResult(e, status, "summary");
    if (result.status !== CADR_STATUS_OK) {
      response(id, op, result.status);
      return;
    }
    const summary = new Uint8Array(result.summary);
    const parsed = parseCdrM6DiskEvidenceSummary(summary);
    const summaryDigest = parsed === null ? null : await workerSnapshotSha256(summary);
    if (parsed === null || summaryDigest === null) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, CADR_STATUS_OK, {
      summary: summary.buffer,
      summaryDigest: summaryDigest.buffer,
      policyId: "M6-PREFIX512-TAILSHA256-v1",
      wireSchema: "CDRM6E1",
    }, [summary.buffer, summaryDigest.buffer]);
  } else if (op === "machine-info") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY : (e.cadr_wasm_machine_info() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 64 > e.memory.buffer.byteLength) {
      response(id, op, status);
      return;
    }
    const info = new Uint8Array(e.memory.buffer, pointer, 64).slice();
    response(id, op, status, { info: info.buffer }, [info.buffer]);
  } else if (op === "portability-probe") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY : (e.cadr_wasm_portability_probe() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op, status);
      return;
    }
    const bytes = new Uint8Array(e.memory.buffer, pointer, 32).slice();
    response(id, op, status, { bytes: bytes.buffer }, [bytes.buffer]);
  } else if (op === "trace-start") {
    const selectors = split64(request.selectorMask);
    const events = split64(request.eventMask);
    if (!unsigned32(request.transportMode) || !unsigned32(request.capacity) || request.capacity === 0 ||
        selectors === null || events === null) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, e.cadr_wasm_trace_start(request.transportMode, request.capacity,
      selectors[0], selectors[1], events[0], events[1]) >>> 0);
  } else if (op === "trace-header" || op === "trace-drain") {
    const pointer = e.cadr_wasm_input_reserve(CADR_TRANSFER_LIMIT) >>> 0;
    if (pointer === 0) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = op === "trace-header" ? (e.cadr_wasm_trace_header() >>> 0) :
      (e.cadr_wasm_trace_drain() >>> 0);
    const result = transferResult(e, status, "bytes", op === "trace-drain" ? "recordCount" : null);
    if (result.status !== CADR_STATUS_OK) response(id, op, result.status);
    else response(id, op, CADR_STATUS_OK, result, [result.bytes]);
  } else if (op === "trace-digest") {
    const pointer = e.cadr_wasm_output_pointer() >>> 0;
    const status = pointer === 0 ? CADR_STATUS_NOT_READY : (e.cadr_wasm_trace_digest() >>> 0);
    if (status !== CADR_STATUS_OK || pointer + 32 > e.memory.buffer.byteLength) {
      response(id, op, status);
      return;
    }
    const digest = new Uint8Array(e.memory.buffer, pointer, 32).slice();
    response(id, op, status, { digest: digest.buffer }, [digest.buffer]);
  } else if (op === "trace-count") {
    const status = e.cadr_wasm_trace_count() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (meta === null) response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status);
    else response(id, op, status, { recordCount: meta[0] });
  } else if (op === "trace-finish") {
    if (!unsigned32(request.reason)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    response(id, op, e.cadr_wasm_trace_finish(request.reason) >>> 0);
  } else if (op === "snapshot-size") {
    if (protocolVersion === CADR_M12_PROTOCOL_VERSION && !m9InputHostStateNeutral()) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked || pendingBoundaryDigest) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_snapshot_size() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (meta === null) response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status);
    else response(id, op, status, { byteCount: meta[0] +
      (isM5ProtocolVersion(protocolVersion) ? 104n : 0n) });
  } else if (op === "snapshot-save") {
    if (protocolVersion === CADR_M12_PROTOCOL_VERSION && !m9InputHostStateNeutral()) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (isM5ProtocolVersion(protocolVersion) &&
        (workerLifecycle !== CADR_WORKER_PAUSED || !visibilityInitialized)) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked || pendingBoundaryDigest) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_snapshot_save() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (meta === null || meta[0] > 0xffffffffn) {
      response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_INVALID_ARGUMENT : status);
      return;
    }
    const pointer = e.cadr_wasm_snapshot_pointer() >>> 0;
    const byteCount = Number(meta[0]);
    if (pointer === 0 || pointer + byteCount > e.memory.buffer.byteLength) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const rawSnapshot = new Uint8Array(e.memory.buffer, pointer, byteCount).slice();
    if (isM5ProtocolVersion(protocolVersion)) {
      snapshotHidden = hidden;
      snapshotVisibilityInitialized = visibilityInitialized;
      snapshotControlOrdinal = controlOrdinal;
      snapshotControlWitness = controlWitness.slice();
      snapshotControlBoundary = controlBoundary;
      const snapshot = await wrapM5WorkerSnapshot(rawSnapshot);
      if (snapshot === null) response(id, op, CADR_STATUS_NOT_READY);
      else response(id, op, status, { snapshot: snapshot.buffer }, [snapshot.buffer]);
    } else {
      response(id, op, status, { snapshot: rawSnapshot.buffer }, [rawSnapshot.buffer]);
    }
  } else if (op === "snapshot-restore") {
    if (protocolVersion === CADR_M12_PROTOCOL_VERSION && !m9InputHostStateNeutral()) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (isM5ProtocolVersion(protocolVersion) && workerLifecycle !== CADR_WORKER_PAUSED) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked || pendingBoundaryDigest) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_snapshot_restore() >>> 0;
    if (status === CADR_STATUS_OK && isM5ProtocolVersion(protocolVersion)) {
      hidden = snapshotHidden; controlOrdinal = snapshotControlOrdinal;
      controlWitness = snapshotControlWitness.slice();
      controlBoundary = snapshotControlBoundary;
      visibilityInitialized = snapshotVisibilityInitialized;
      if (protocolVersion === CADR_M12_PROTOCOL_VERSION) replaceM9InputHostStatePreservingEpoch();
    }
    response(id, op, status, { lifecycle: workerLifecycle, hidden });
  } else if (op === "snapshot-restore-import") {
    if (protocolVersion === CADR_M12_PROTOCOL_VERSION && !m9InputHostStateNeutral()) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (isM5ProtocolVersion(protocolVersion) && workerLifecycle !== CADR_WORKER_PAUSED &&
        workerLifecycle !== CADR_WORKER_NEW) {
      response(id, op, CADR_STATUS_NOT_READY); return;
    }
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked || pendingBoundaryDigest) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const supplied = uint8Bytes(request.snapshot);
    let envelope;
    if (isM5ProtocolVersion(protocolVersion) && supplied !== null) {
      envelope = await unwrapM5WorkerSnapshot(supplied);
      if (envelope !== null && envelope.legacy) {
        envelope = protocolVersion !== CADR_M12_PROTOCOL_VERSION && request.allowLegacyNativeImport === true ?
          { raw: supplied, hidden: false, visibilityInitialized: false, legacy: true } : null;
      }
    } else envelope = supplied === null ? null : { raw: supplied, hidden: false };
    const bytes = envelope === null ? null : envelope.raw;
    if (bytes === null || bytes.byteLength === 0 || bytes.byteLength > 0xffffffff) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    const pointer = e.cadr_wasm_snapshot_input_reserve(bytes.byteLength) >>> 0;
    if (pointer === 0 || pointer + bytes.byteLength > e.memory.buffer.byteLength) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    new Uint8Array(e.memory.buffer, pointer, bytes.byteLength).set(bytes);
    const status = e.cadr_wasm_snapshot_restore_import(bytes.byteLength) >>> 0;
    if (status === CADR_STATUS_OK && isM5ProtocolVersion(protocolVersion)) {
      workerLifecycle = CADR_WORKER_PAUSED;
      hidden = envelope.hidden;
      controlOrdinal = envelope.legacy ? 0n : envelope.controlOrdinal;
      controlWitness = envelope.legacy ? new Uint8Array(32) : envelope.controlWitness;
      controlBoundary = envelope.legacy ? 0n : envelope.controlBoundary;
      snapshotControlOrdinal = controlOrdinal;
      snapshotControlWitness = controlWitness.slice();
      snapshotControlBoundary = controlBoundary;
      snapshotVisibilityInitialized = envelope.legacy ? false : envelope.visibilityInitialized;
      /* A wrapped record tells us whether its source tab had established a
       * visibility policy, but a restored worker still needs this tab's
       * explicit handshake before it may advance guest time. */
      visibilityInitialized = false;
      if (protocolVersion === CADR_M12_PROTOCOL_VERSION) replaceM9InputHostStatePreservingEpoch();
      snapshotHidden = hidden;
      pendingBoundaryDigest = false;
    }
    response(id, op, status, { lifecycle: workerLifecycle, hidden });
  } else {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
  }
}

async function receive(event) {
  const request = event.data;
  if (!isRecord(request) ||
      ![CADR_M3_PROTOCOL_VERSION, CADR_M4_PROTOCOL_VERSION,
        CADR_M5_PROTOCOL_VERSION, CADR_M6_PROTOCOL_VERSION,
        CADR_M7_PROTOCOL_VERSION, CADR_M8_M9_PROTOCOL_VERSION,
        CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION]
        .includes(request.version) ||
      (isM5ProtocolVersion(request.version) && request.op === "instantiate" &&
       (!(request.module instanceof WebAssembly.Module) ||
        !WebAssembly.Module.exports(request.module).some(
          entry => entry.name === "cadr_wasm_schedule_event"))) ||
      (isM6ProtocolVersion(request.version) &&
       request.op === "instantiate" &&
       (!WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_boot_witness") ||
        !WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_boot_witness_meta"))) ||
      (request.op === "instantiate" &&
       request.m6DiskEvidencePolicy !== undefined &&
       typeof request.m6DiskEvidencePolicy !== "boolean") ||
      (request.op === "instantiate" &&
       request.module instanceof WebAssembly.Module &&
       (WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_m6_disk_evidence_summary") !==
        (request.m6DiskEvidencePolicy === true))) ||
      (request.op === "instantiate" &&
       request.module instanceof WebAssembly.Module &&
       (WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_run_until_event_m6") !==
        (request.m6DiskEvidencePolicy === true))) ||
      (request.op === "instantiate" &&
       request.module instanceof WebAssembly.Module &&
       (WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_m7_unimplemented_diagnostic") !==
        (request.version === CADR_M7_PROTOCOL_VERSION &&
         request.m6DiskEvidencePolicy === true))) ||
      (request.op === "instantiate" &&
       request.m6DiskEvidencePolicy === true &&
       (!isM6DevidProtocolVersion(request.version) ||
        !(request.module instanceof WebAssembly.Module) ||
        !WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_m6_disk_evidence_summary") ||
        !WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_run_until_event_m6"))) ||
      (isM7ProtocolVersion(request.version) &&
       request.op === "instantiate" &&
       (!WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_display_update") ||
        !WebAssembly.Module.exports(request.module).some(
          entry => entry.name === "cadr_wasm_display_full"))) ||
      (isM8M9ProtocolVersion(request.version) &&
       request.op === "instantiate" &&
       (!WebAssembly.Module.exports(request.module).some(
         entry => entry.name === "cadr_wasm_m9_input_deliver") ||
        !WebAssembly.Module.exports(request.module).some(
          entry => entry.name === "cadr_wasm_m9_input_state"))) ||
      ([CADR_M12_PROTOCOL_VERSION, CADR_M13_PRIVATE_PROTOCOL_VERSION].includes(request.version) &&
       request.op === "instantiate" &&
       (!(request.module instanceof WebAssembly.Module) ||
        !["cadr_wasm_m12_debug_state", "cadr_wasm_m12_inspect_read", "cadr_wasm_m12_breakpoint_set",
          "cadr_wasm_m12_breakpoint_clear", "cadr_wasm_m12_resume_one_boundary",
          "cadr_wasm_m12_micro_step", "cadr_wasm_m12_macro_step",
          "cadr_wasm_m12_stop_record", "cadr_wasm_m12_trace_filter",
          "cadr_wasm_m12_config_snapshot_save", "cadr_wasm_m12_config_snapshot_restore",
          "cadr_wasm_m9_input_deliver", "cadr_wasm_m9_input_state",
          "cadr_wasm_m11_audio_state", "cadr_wasm_m11_audio_peek",
          "cadr_wasm_m11_audio_render", "cadr_wasm_m11_audio_ack",
          "cadr_wasm_m11_audio_snapshot_size", "cadr_wasm_m11_audio_snapshot_save",
          "cadr_wasm_m11_audio_snapshot_restore"].every(name =>
          WebAssembly.Module.exports(request.module).some(entry => entry.name === name)))) ||
      (request.version === CADR_M13_PRIVATE_PROTOCOL_VERSION && request.op === "instantiate" &&
       (typeof request.sessionId !== "string" || !/^[0-9a-f]{64}$/.test(request.sessionId) ||
        !WebAssembly.Module.exports(request.module).some(entry => entry.name === "cadr_wasm_m13_audio_open"))) ||
      (protocolVersion !== null && request.version !== protocolVersion) ||
      !validId(request.id) || typeof request.op !== "string") {
    error(isRecord(request) && validId(request.id) ? request.id : null,
          "malformed-message", "expected a versioned request with positive integer id and string op");
    return;
  }
  if (request.id !== expectedId) {
    error(request.id, "non-monotonic-id", `expected request id ${expectedId}`);
    return;
  }
  if (protocolVersion === null) protocolVersion = request.version;
  expectedId += 1;
  try {
    await handle(request);
  } catch (caught) {
    error(request.id, "worker-failure", String(caught));
  }
}

/* Web Worker delivery is ordered, but `handle` awaits module instantiation and
 * host requests.  Serialize the complete request transaction as well, so a
 * later message cannot observe half-completed state from an earlier one. */
function queueLiveControl(event) {
  const request = event.data;
  if (!runActive || !isRecord(request) || !isM5ProtocolVersion(protocolVersion) ||
      request.version !== protocolVersion || request.id !== expectedId ||
      !["scheduler-pause", "scheduler-stop", "scheduler-shutdown", "scheduler-visibility"].includes(request.op) ||
      (request.op === "scheduler-visibility" && typeof request.hidden !== "boolean")) return false;
  expectedId += 1;
  deferredControls.push(request);
  return true;
}

let receive_tail = Promise.resolve();
function enqueue_receive(event) {
  if (queueLiveControl(event)) return;
  receive_tail = receive_tail.then(() => receive(event), () => receive(event));
}

if (isNode) port.on("message", (data) => { enqueue_receive({ data }); });
else port.onmessage = (event) => { enqueue_receive(event); };
