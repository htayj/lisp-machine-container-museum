/*
 * M4-D0 immutable block-range service.
 *
 * This module deliberately knows nothing about Worker messaging or WebAssembly
 * linear-memory pointers.  The caller supplies the two host-ABI leaves:
 * nextRequest() -> {status, request, descriptor} and
 * complete({request, hostStatus, bytes}) -> {status}.  That keeps its ordering
 * identical for a native bridge and the eventual dedicated-worker protocol.
 */
export const CADR_STATUS_OK = 0;
export const CADR_STATUS_INVALID_ARGUMENT = 2;
export const CADR_STATUS_NOT_READY = 9;
export const CADR_STATUS_ARTIFACT_MISMATCH = 11;
export const CADR_HOST_OPERATION_BLOCK_READ = 1;
export const CADR_HOST_RESULT_OK = 0;
export const CADR_HOST_RESULT_FAILED = 1;
export const CADR_M4_BLOCK_BYTES = 1024;
export const CADR_M4_MAX_COMPLETION_BYTES = 1048576;

export const CADR_M4_BLOCK_FAULT_NONE = 0;
export const CADR_M4_BLOCK_FAULT_STATUS_FAILED = 1 << 0;
export const CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE = 1 << 1;
export const CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK = 1 << 2;
export const CADR_M4_BLOCK_FAULT_KNOWN =
  CADR_M4_BLOCK_FAULT_STATUS_FAILED |
  CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE |
  CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK;

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function unsigned32(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function unsigned64(value) {
  return typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn;
}

function requestIsWellFormed(request, descriptor) {
  return request !== null && typeof request === "object" &&
    unsigned32(request.operation) && unsigned64(request.generation) &&
    unsigned64(request.requestId) && unsigned64(request.descriptorByteCount) &&
    unsigned64(request.completionByteCount) &&
    request.descriptorByteCount === BigInt(descriptor.byteLength);
}

function eventFrom(pending) {
  return {
    issueTick: pending.issueTick,
    dueTick: pending.dueTick,
    generation: pending.request.generation,
    requestId: pending.request.requestId,
    firstBlock: pending.firstBlock,
    blockCount: pending.blockCount,
    blockBytes: pending.blockBytes,
    completionByteCount: pending.request.completionByteCount,
    hostStatus: pending.hostStatus,
  };
}

function configError(code, message) {
  const error = new RangeError(message);
  error.code = code;
  return error;
}

/*
 * `image` is copied at construction so a caller cannot alter an accepted
 * range after request issue.  The image's pinned digest is intentionally
 * verified by artifact ingress before this service is constructed; this
 * helper binds the expected byte count and range bounds only.
 */
export function createM4BlockRangeService(config) {
  if (config === null || typeof config !== "object") {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "block service needs a config object");
  }
  const supplied = bytesOf(config.image);
  const expectedByteCount = config.expectedImageByteCount;
  const latencyTicks = config.latencyTicks ?? 0n;
  const blockBytes = config.blockBytes ?? CADR_M4_BLOCK_BYTES;
  const faultMask = config.faultMask ?? CADR_M4_BLOCK_FAULT_NONE;
  if (supplied === null || !unsigned64(expectedByteCount) ||
      expectedByteCount !== BigInt(supplied.byteLength)) {
    throw configError(CADR_STATUS_ARTIFACT_MISMATCH, "wrong immutable image byte count");
  }
  if (!unsigned64(latencyTicks) || blockBytes !== CADR_M4_BLOCK_BYTES ||
      !unsigned32(faultMask) || (faultMask & ~CADR_M4_BLOCK_FAULT_KNOWN) !== 0) {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "invalid M4 block-service configuration");
  }
  const image = supplied.slice();
  let pending = null;

  function capture(request, descriptor, tick) {
    const event = {
      requestSeen: true,
      completionDelivered: false,
      ...eventFrom({
        request,
        issueTick: tick,
        dueTick: tick,
        firstBlock: 0n,
        blockCount: 0,
        blockBytes: 0,
        hostStatus: CADR_HOST_RESULT_FAILED,
      }),
    };
    let hostStatus = CADR_HOST_RESULT_FAILED;
    let bytes = null;
    let firstBlock = 0n;
    let blockCount = 0;
    let requestBlockBytes = 0;
    if (request.operation === CADR_HOST_OPERATION_BLOCK_READ &&
        descriptor.byteLength === 16 && request.completionByteCount <= BigInt(CADR_M4_MAX_COMPLETION_BYTES)) {
      const view = new DataView(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);
      firstBlock = view.getBigUint64(0, true);
      blockCount = view.getUint32(8, true);
      requestBlockBytes = view.getUint32(12, true);
      const rangeBytes = BigInt(blockCount) * BigInt(requestBlockBytes);
      const offset = firstBlock * BigInt(requestBlockBytes);
      if (requestBlockBytes === blockBytes && blockCount !== 0 &&
          rangeBytes === request.completionByteCount &&
          offset <= BigInt(image.byteLength) && rangeBytes <= BigInt(image.byteLength) - offset) {
        bytes = image.slice(Number(offset), Number(offset + rangeBytes));
        hostStatus = CADR_HOST_RESULT_OK;
      }
    }
    if (bytes === null) bytes = new Uint8Array(Number(request.completionByteCount));
    if ((faultMask & CADR_M4_BLOCK_FAULT_STATUS_FAILED) !== 0) {
      hostStatus = CADR_HOST_RESULT_FAILED;
      bytes.fill(0);
    } else if (hostStatus === CADR_HOST_RESULT_OK &&
               (faultMask & CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE) !== 0) {
      bytes[0] ^= 1;
    }
    const extraTick = (faultMask & CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) !== 0 ? 1n : 0n;
    if (tick > 0xffffffffffffffffn - latencyTicks - extraTick) {
      return { status: CADR_STATUS_INVALID_ARGUMENT, event: null };
    }
    pending = {
      request, bytes, hostStatus, firstBlock, blockCount,
      blockBytes: requestBlockBytes, issueTick: tick,
      dueTick: tick + latencyTicks + extraTick,
    };
    Object.assign(event, eventFrom(pending));
    return { status: CADR_STATUS_OK, event };
  }

  return Object.freeze({
    async poll({ tick, nextRequest, complete }) {
      if (!unsigned64(tick) || typeof nextRequest !== "function" || typeof complete !== "function") {
        return { status: CADR_STATUS_INVALID_ARGUMENT, events: [] };
      }
      const events = [];
      if (pending === null) {
        const next = await nextRequest();
        if (next === null || typeof next !== "object" || !unsigned32(next.status)) {
          return { status: CADR_STATUS_INVALID_ARGUMENT, events };
        }
        if (next.status !== CADR_STATUS_NOT_READY) {
          const descriptor = bytesOf(next.descriptor);
          if (next.status !== CADR_STATUS_OK || descriptor === null ||
              !requestIsWellFormed(next.request, descriptor)) {
            return { status: next.status === CADR_STATUS_OK ? CADR_STATUS_INVALID_ARGUMENT : next.status, events };
          }
          const captured = capture(next.request, descriptor, tick);
          if (captured.status !== CADR_STATUS_OK) return { status: captured.status, events };
          events.push(captured.event);
        }
      }
      if (pending !== null && tick >= pending.dueTick) {
        const completion = await complete({
          request: pending.request, hostStatus: pending.hostStatus, bytes: pending.bytes.slice(),
        });
        if (completion === null || typeof completion !== "object" || !unsigned32(completion.status)) {
          return { status: CADR_STATUS_INVALID_ARGUMENT, events };
        }
        if (completion.status !== CADR_STATUS_OK) return { status: completion.status, events };
        events.push({ requestSeen: false, completionDelivered: true, deliveryTick: tick, ...eventFrom(pending) });
        pending = null;
      }
      return { status: CADR_STATUS_OK, events };
    },
  });
}
