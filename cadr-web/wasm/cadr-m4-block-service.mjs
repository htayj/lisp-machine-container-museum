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
export const CADR_HOST_OPERATION_BLOCK_WRITE = 2;
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

function requestIsWellFormed(request, descriptor, payload) {
  return request !== null && typeof request === "object" &&
    unsigned32(request.operation) && unsigned64(request.generation) &&
    unsigned64(request.requestId) && unsigned64(request.descriptorByteCount) &&
    unsigned64(request.requestPayloadByteCount) &&
    unsigned64(request.completionByteCount) &&
    request.descriptorByteCount === BigInt(descriptor.byteLength) &&
    request.requestPayloadByteCount === BigInt(payload.byteLength);
}

function eventFrom(pending) {
  return {
    issueTick: pending.issueTick,
    dueTick: pending.dueTick,
    generation: pending.request.generation,
    requestId: pending.request.requestId,
    operation: pending.request.operation,
    firstBlock: pending.firstBlock,
    blockCount: pending.blockCount,
    blockBytes: pending.blockBytes,
    completionByteCount: pending.request.completionByteCount,
    requestPayloadByteCount: pending.request.requestPayloadByteCount,
    transactionId: pending.transactionId,
    overlayGeneration: pending.overlayGeneration,
    hostStatus: pending.hostStatus,
  };
}

function configError(code, message) {
  const error = new RangeError(message);
  error.code = code;
  return error;
}

export function createBlobRangeReader(blob) {
  if (blob === null || typeof blob !== "object" ||
      !Number.isSafeInteger(blob.size) || blob.size < 0 ||
      typeof blob.slice !== "function") {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "range reader needs a Blob");
  }
  const byteCount = BigInt(blob.size);
  return Object.freeze({
    byteCount,
    async readRange(byteOffset, rangeByteCount) {
      if (!unsigned64(byteOffset) || !unsigned64(rangeByteCount) ||
          byteOffset > byteCount || rangeByteCount > byteCount - byteOffset ||
          byteOffset > BigInt(Number.MAX_SAFE_INTEGER) ||
          rangeByteCount > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw configError(CADR_STATUS_INVALID_ARGUMENT, "Blob range is out of bounds");
      }
      const end = byteOffset + rangeByteCount;
      if (end > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw configError(CADR_STATUS_INVALID_ARGUMENT, "Blob range exceeds exact JavaScript offsets");
      }
      const part = blob.slice(Number(byteOffset), Number(end));
      const bytes = new Uint8Array(await part.arrayBuffer());
      if (BigInt(bytes.byteLength) !== rangeByteCount) {
        throw configError(CADR_STATUS_ARTIFACT_MISMATCH, "Blob returned a short range");
      }
      return bytes;
    },
  });
}

/*
 * The supplied range reader must return a fresh exact-length byte view or
 * throw.  The image's pinned digest is verified separately by artifact
 * ingress; this helper binds the same expected byte count and never stores a
 * whole-image JavaScript copy.
 */
export function createM4BlockRangeService(config) {
  if (config === null || typeof config !== "object") {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "block service needs a config object");
  }
  const readRange = config.readRange;
  const imageByteCount = config.imageByteCount;
  const expectedByteCount = config.expectedImageByteCount;
  const latencyTicks = config.latencyTicks ?? 0n;
  const blockBytes = config.blockBytes ?? CADR_M4_BLOCK_BYTES;
  const faultMask = config.faultMask ?? CADR_M4_BLOCK_FAULT_NONE;
  const faultOperation = config.faultOperation ?? 0;
  const faultFirstBlock = config.faultFirstBlock ?? null;
  const faultOccurrence = config.faultOccurrence ?? 0n;
  if (typeof readRange !== "function" || !unsigned64(imageByteCount) ||
      !unsigned64(expectedByteCount) || expectedByteCount !== imageByteCount) {
    throw configError(CADR_STATUS_ARTIFACT_MISMATCH, "wrong immutable image byte count");
  }
  if (!unsigned64(latencyTicks) || blockBytes !== CADR_M4_BLOCK_BYTES ||
      !unsigned32(faultMask) || (faultMask & ~CADR_M4_BLOCK_FAULT_KNOWN) !== 0) {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "invalid M4 block-service configuration");
  }
  if (![0, CADR_HOST_OPERATION_BLOCK_READ,
        CADR_HOST_OPERATION_BLOCK_WRITE].includes(faultOperation) ||
      (faultFirstBlock !== null && !unsigned64(faultFirstBlock)) ||
      !unsigned64(faultOccurrence)) {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "invalid M4 fault selector");
  }
  let pending = null;
  let lifecycleTail = Promise.resolve();
  let queuedPolls = 0;
  let detaching = false;
  let attachmentEpoch = 1n;
  let overlay = null;
  let overlayGeneration = 0n;
  let faultMatchCount = 0n;
  let committed = null;

  function selectedFaultMask(request, firstBlock) {
    if ((faultOperation !== 0 && faultOperation !== request.operation) ||
        (faultFirstBlock !== null && faultFirstBlock !== firstBlock)) {
      return CADR_M4_BLOCK_FAULT_NONE;
    }
    faultMatchCount += 1n;
    if (faultOccurrence !== 0n && faultOccurrence !== faultMatchCount) {
      return CADR_M4_BLOCK_FAULT_NONE;
    }
    return faultMask;
  }

  function faultProgressBlocksSnapshot() {
    return faultMask !== CADR_M4_BLOCK_FAULT_NONE &&
      faultOccurrence !== 0n && faultMatchCount !== 0n;
  }

  async function capture(request, descriptor, payload, tick) {
    if (request.completionByteCount >
          BigInt(CADR_M4_MAX_COMPLETION_BYTES) ||
        request.requestPayloadByteCount > BigInt(CADR_M4_BLOCK_BYTES)) {
      return { status: CADR_STATUS_INVALID_ARGUMENT, event: null };
    }
    const event = {
      requestSeen: true,
      completionDelivered: false,
      descriptor: descriptor.slice(),
      requestPayload: payload.slice(),
      ...eventFrom({
        request,
        issueTick: tick,
        dueTick: tick,
        firstBlock: 0n,
        blockCount: 0,
        blockBytes: 0,
        hostStatus: CADR_HOST_RESULT_FAILED,
        transactionId: 0n,
        overlayGeneration,
      }),
    };
    let hostStatus = CADR_HOST_RESULT_FAILED;
    let bytes = null;
    let firstBlock = 0n;
    let blockCount = 0;
    let requestBlockBytes = 0;
    let transactionId = 0n;
    let staged = null;
    let replay = false;
    if (request.operation === CADR_HOST_OPERATION_BLOCK_READ &&
        descriptor.byteLength === 16 && request.completionByteCount <= BigInt(CADR_M4_MAX_COMPLETION_BYTES)) {
      const view = new DataView(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);
      firstBlock = view.getBigUint64(0, true);
      blockCount = view.getUint32(8, true);
      requestBlockBytes = view.getUint32(12, true);
      const rangeBytes = BigInt(blockCount) * BigInt(requestBlockBytes);
      const offset = firstBlock * BigInt(requestBlockBytes);
      if (requestBlockBytes === blockBytes && blockCount !== 0 &&
          request.requestPayloadByteCount === 0n &&
          rangeBytes === request.completionByteCount &&
          offset <= imageByteCount && rangeBytes <= imageByteCount - offset) {
        if (firstBlock === 1n && blockCount === 1 && overlay !== null) {
          bytes = overlay.slice();
          hostStatus = CADR_HOST_RESULT_OK;
        } else {
          try {
            const supplied = bytesOf(await readRange(offset, rangeBytes));
            if (supplied !== null && BigInt(supplied.byteLength) === rangeBytes) {
              bytes = supplied.slice();
              hostStatus = CADR_HOST_RESULT_OK;
            }
          } catch {
            hostStatus = CADR_HOST_RESULT_FAILED;
          }
        }
      }
    } else if (request.operation === CADR_HOST_OPERATION_BLOCK_WRITE &&
               descriptor.byteLength === 24) {
      const view = new DataView(descriptor.buffer, descriptor.byteOffset, descriptor.byteLength);
      transactionId = view.getBigUint64(0, true);
      firstBlock = view.getBigUint64(8, true);
      blockCount = view.getUint32(16, true);
      requestBlockBytes = view.getUint32(20, true);
      if (transactionId !== 0n && firstBlock === 1n && blockCount === 1 &&
          transactionId === request.requestId &&
          requestBlockBytes === blockBytes &&
          request.requestPayloadByteCount === BigInt(blockBytes) &&
          request.completionByteCount === 0n &&
          payload.byteLength === blockBytes &&
          overlayGeneration < 0xffffffffffffffffn) {
        if (committed !== null &&
            committed.generation === request.generation &&
            committed.requestId === request.requestId &&
            committed.transactionId === transactionId) {
          if (overlay !== null && overlay.byteLength === payload.byteLength &&
              overlay.every((value, index) => value === payload[index])) {
            bytes = new Uint8Array(0);
            hostStatus = CADR_HOST_RESULT_OK;
            replay = true;
          }
        } else if (committed === null ||
                   request.generation > committed.generation ||
                   (request.generation === committed.generation &&
                    request.requestId > committed.requestId)) {
          staged = payload.slice();
          bytes = new Uint8Array(0);
          hostStatus = CADR_HOST_RESULT_OK;
          event.overlayPrepared = true;
        }
      }
    }
    const activeFaultMask = selectedFaultMask(request, firstBlock);
    if (bytes === null) bytes = new Uint8Array(Number(request.completionByteCount));
    if ((activeFaultMask & CADR_M4_BLOCK_FAULT_STATUS_FAILED) !== 0) {
      hostStatus = CADR_HOST_RESULT_FAILED;
      bytes.fill(0);
      if (staged !== null) {
        staged = null;
        event.overlayDiscarded = true;
      }
    } else if (hostStatus === CADR_HOST_RESULT_OK &&
               bytes.byteLength !== 0 &&
               (activeFaultMask & CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE) !== 0) {
      bytes[0] ^= 1;
    }
    const extraTick =
      (activeFaultMask & CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) !== 0 ? 1n : 0n;
    if (tick > 0xffffffffffffffffn - latencyTicks - extraTick) {
      return { status: CADR_STATUS_INVALID_ARGUMENT, event: null };
    }
    pending = {
      request, descriptor: descriptor.slice(),
      requestPayload: payload.slice(),
      bytes, hostStatus, firstBlock, blockCount, transactionId, staged,
      replay, activeFaultMask,
      blockBytes: requestBlockBytes, issueTick: tick,
      dueTick: tick + latencyTicks + extraTick,
      overlayGeneration,
    };
    Object.assign(event, eventFrom(pending));
    event.faultMask = activeFaultMask;
    return { status: CADR_STATUS_OK, event };
  }

  async function pollOnce({ tick, nextRequest, complete }, epoch) {
      const attachmentIsCurrent = () =>
        !detaching && epoch === attachmentEpoch;
      const discardPending = () => {
        if (pending?.staged !== null && pending?.staged !== undefined) {
          pending.staged.fill(0);
        }
        pending = null;
      };
      if (!attachmentIsCurrent()) {
        return { status: CADR_STATUS_NOT_READY, events: [] };
      }
      if (!unsigned64(tick) || typeof nextRequest !== "function" || typeof complete !== "function") {
        return { status: CADR_STATUS_INVALID_ARGUMENT, events: [] };
      }
      const events = [];
      if (pending === null) {
        const next = await nextRequest();
        if (!attachmentIsCurrent()) {
          return { status: CADR_STATUS_NOT_READY, events: [] };
        }
        if (next === null || typeof next !== "object" || !unsigned32(next.status)) {
          return { status: CADR_STATUS_INVALID_ARGUMENT, events };
        }
        if (next.status !== CADR_STATUS_NOT_READY) {
          const descriptor = bytesOf(next.descriptor);
          const payload = bytesOf(next.requestPayload);
          if (next.status !== CADR_STATUS_OK || descriptor === null ||
              payload === null ||
              !requestIsWellFormed(next.request, descriptor, payload)) {
            return { status: next.status === CADR_STATUS_OK ? CADR_STATUS_INVALID_ARGUMENT : next.status, events };
          }
          const captured = await capture(next.request, descriptor, payload, tick);
          if (!attachmentIsCurrent()) {
            discardPending();
            return { status: CADR_STATUS_NOT_READY, events: [] };
          }
          if (captured.status !== CADR_STATUS_OK) return { status: captured.status, events };
          events.push(captured.event);
        }
      }
      if (pending !== null && tick >= pending.dueTick) {
        if (!attachmentIsCurrent()) {
          discardPending();
          return { status: CADR_STATUS_NOT_READY, events: [] };
        }
        const completion = await complete({
          request: pending.request, hostStatus: pending.hostStatus, bytes: pending.bytes.slice(),
        });
        if (completion === null || typeof completion !== "object" || !unsigned32(completion.status)) {
          return { status: CADR_STATUS_INVALID_ARGUMENT, events };
        }
        if (completion.status !== CADR_STATUS_OK) {
          pending = null;
          return { status: completion.status, events };
        }
        const delivered = {
          requestSeen: false, completionDelivered: true,
          deliveryTick: tick, ...eventFrom(pending),
          faultMask: pending.activeFaultMask,
          descriptor: pending.descriptor.slice(),
          requestPayload: pending.requestPayload.slice(),
          pageBytes: pending.request.operation ===
            CADR_HOST_OPERATION_BLOCK_WRITE ?
            pending.requestPayload.slice() : pending.bytes.slice(),
        };
        if (pending.request.operation === CADR_HOST_OPERATION_BLOCK_WRITE &&
            pending.hostStatus === CADR_HOST_RESULT_OK &&
            pending.staged !== null) {
          overlay = pending.staged;
          overlayGeneration += 1n;
          committed = {
            generation: pending.request.generation,
            requestId: pending.request.requestId,
            transactionId: pending.transactionId,
          };
          delivered.overlayCommitted = true;
          delivered.overlayGeneration = overlayGeneration;
        } else if (pending.request.operation ===
                     CADR_HOST_OPERATION_BLOCK_WRITE &&
                   pending.hostStatus === CADR_HOST_RESULT_OK &&
                   pending.replay) {
          delivered.overlayReplayed = true;
        }
        events.push(delivered);
        pending = null;
      }
      return { status: CADR_STATUS_OK, events };
  }

  return Object.freeze({
    poll(arguments_) {
      if (detaching) {
        return Promise.resolve({
          status: CADR_STATUS_NOT_READY, events: [],
        });
      }
      const epoch = attachmentEpoch;
      queuedPolls += 1;
      const result = lifecycleTail.then(() => pollOnce(arguments_, epoch))
        .finally(() => {
          queuedPolls -= 1;
        });
      lifecycleTail = result.then(() => undefined, () => undefined);
      return result;
    },
    overlayGeneration() {
      return overlayGeneration;
    },
    snapshotStatus() {
      return detaching || queuedPolls !== 0 || pending !== null ||
        overlay !== null || faultProgressBlocksSnapshot() ?
        CADR_STATUS_NOT_READY : CADR_STATUS_OK;
    },
    snapshotBlocked() {
      return faultProgressBlocksSnapshot();
    },
    hasPendingRequest() {
      return pending !== null;
    },
    discard() {
      if (detaching) {
        return Promise.reject(configError(
          CADR_STATUS_NOT_READY, "media detach already pending"));
      }
      detaching = true;
      const result = lifecycleTail.then(() => {
        if (pending !== null) {
          if (pending.staged !== null) pending.staged.fill(0);
          pending = null;
        }
        if (overlay !== null) overlay.fill(0);
        overlay = null;
        overlayGeneration = 0n;
        committed = null;
        faultMatchCount = 0n;
        attachmentEpoch += 1n;
      }).finally(() => {
        detaching = false;
      });
      lifecycleTail = result.then(() => undefined, () => undefined);
      return result;
    },
  });
}
