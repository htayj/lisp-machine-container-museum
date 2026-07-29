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
 * first well-formed, in-order request selects one version for the session.
 */
const CADR_M3_PROTOCOL_VERSION = 1;
const CADR_M4_PROTOCOL_VERSION = 2;
const CADR_STATUS_OK = 0;
const CADR_STATUS_INVALID_ARGUMENT = 2;
const CADR_STATUS_WAITING_FOR_HOST = 8;
const CADR_STATUS_NOT_READY = 9;
const CADR_TRANSFER_LIMIT = 1048576;
const CADR_DIGEST_BATCH_MAX = 4096;
const CADR_HOST_DESCRIPTOR_LIMIT = 64;
const CADR_HOST_REQUEST_PAYLOAD_LIMIT = 1024;
const CADR_M4_ONLY_OPERATIONS = new Set([
  "media-overlay-state", "run-digest-batch-m4", "boundary-digest-v4",
  "boot-media-observation", "disk-evidence",
]);

let port;
let instance = null;
let expectedId = 1;
let protocolVersion = null;
let mediaBusy = false;
let mediaDirty = false;
let mediaSnapshotBlocked = false;
let mediaOverlayGeneration = 0n;

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

function metadata(e) {
  const pointer = e.cadr_wasm_meta_pointer() >>> 0;
  if (pointer === 0 || pointer + 16 > e.memory.buffer.byteLength) return null;
  const view = new DataView(e.memory.buffer, pointer, 16);
  return [view.getBigUint64(0, true), view.getBigUint64(8, true)];
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

async function handle(request) {
  const { id, op } = request;
  if (op === "instantiate") {
    if (instance !== null || !(request.module instanceof WebAssembly.Module)) {
      response(id, op, CADR_STATUS_INVALID_ARGUMENT);
      return;
    }
    instance = await WebAssembly.instantiate(request.module, {});
    mediaBusy = false;
    mediaDirty = false;
    mediaSnapshotBlocked = false;
    mediaOverlayGeneration = 0n;
    response(id, op, instance.exports.cadr_wasm_create() >>> 0);
    return;
  }

  if (protocolVersion === CADR_M3_PROTOCOL_VERSION &&
      CADR_M4_ONLY_OPERATIONS.has(op)) {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
    return;
  }

  const e = exportsOrStatus(id, op);
  if (e === null) return;
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
    response(id, op, e.cadr_wasm_cold_power_on() >>> 0);
  } else if (op === "boot") {
    response(id, op, e.cadr_wasm_boot() >>> 0);
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
    response(id, op, status, { byteCount: bytes.byteLength });
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
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const status = e.cadr_wasm_snapshot_size() >>> 0;
    const meta = status === CADR_STATUS_OK ? metadata(e) : null;
    if (meta === null) response(id, op, status === CADR_STATUS_OK ? CADR_STATUS_NOT_READY : status);
    else response(id, op, status, { byteCount: meta[0] });
  } else if (op === "snapshot-save") {
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked) {
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
    const snapshot = new Uint8Array(e.memory.buffer, pointer, byteCount).slice();
    response(id, op, status, { snapshot: snapshot.buffer }, [snapshot.buffer]);
  } else if (op === "snapshot-restore") {
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    response(id, op, e.cadr_wasm_snapshot_restore() >>> 0);
  } else if (op === "snapshot-restore-import") {
    if (mediaBusy || mediaDirty || mediaSnapshotBlocked) {
      response(id, op, CADR_STATUS_NOT_READY);
      return;
    }
    const bytes = uint8Bytes(request.snapshot);
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
    response(id, op, e.cadr_wasm_snapshot_restore_import(bytes.byteLength) >>> 0);
  } else {
    response(id, op, CADR_STATUS_INVALID_ARGUMENT);
  }
}

async function receive(event) {
  const request = event.data;
  if (!isRecord(request) ||
      ![CADR_M3_PROTOCOL_VERSION, CADR_M4_PROTOCOL_VERSION]
        .includes(request.version) ||
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
let receive_tail = Promise.resolve();
function enqueue_receive(event) {
  receive_tail = receive_tail.then(() => receive(event), () => receive(event));
}

if (isNode) port.on("message", (data) => { enqueue_receive({ data }); });
else port.onmessage = (event) => { enqueue_receive(event); };
