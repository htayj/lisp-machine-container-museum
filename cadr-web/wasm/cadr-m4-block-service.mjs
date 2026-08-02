import { m4OverlayRootForBase, m4Sha256 } from "./cadr-m4-media.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_CANDIDATE_SCHEMA,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_ARM_SCHEMA,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY,
  createM7EffectivePageIdentityArm,
  parseM7EffectivePageIdentityPolicy,
} from "./cadr-m7-effective-page-identity.mjs";

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
  let effectivePageIdentity;
  try {
    effectivePageIdentity = parseM7EffectivePageIdentityPolicy(
      config.m7EffectivePageIdentityPolicy);
  } catch {
    throw configError(CADR_STATUS_INVALID_ARGUMENT,
      "invalid M7 effective-page identity policy");
  }
  const selectedBaseInput = config.selectedBaseSha256 === undefined ? null :
    bytesOf(config.selectedBaseSha256);
  const selectedBaseSha256 = selectedBaseInput === null ? null :
    selectedBaseInput.slice();
  if (typeof readRange !== "function" || !unsigned64(imageByteCount) ||
      !unsigned64(expectedByteCount) || expectedByteCount !== imageByteCount) {
    throw configError(CADR_STATUS_ARTIFACT_MISMATCH, "wrong immutable image byte count");
  }
  if (!unsigned64(latencyTicks) || blockBytes !== CADR_M4_BLOCK_BYTES ||
      !unsigned32(faultMask) || (faultMask & ~CADR_M4_BLOCK_FAULT_KNOWN) !== 0) {
    throw configError(CADR_STATUS_INVALID_ARGUMENT, "invalid M4 block-service configuration");
  }
  if (effectivePageIdentity.enabled &&
      (selectedBaseSha256 === null || selectedBaseSha256.byteLength !== 32)) {
    throw configError(CADR_STATUS_INVALID_ARGUMENT,
      "M7 effective-page identity needs the trusted selected-base hash");
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
  const identity = {
    policy: effectivePageIdentity,
    phase: effectivePageIdentity.enabled ? "await-initial-commit" : "disabled",
    initialCommit: null,
    comparisonRead: null,
    baseRead: null,
    arm: null,
    candidates: [],
  };

  function sameBytes(left, right) {
    return left.byteLength === right.byteLength &&
      left.every((value, index) => value === right[index]);
  }

  function blockReadIs(pending, firstBlock) {
    return pending.request.operation === CADR_HOST_OPERATION_BLOCK_READ &&
      pending.firstBlock === firstBlock && pending.blockCount === 1 &&
      pending.blockBytes === blockBytes &&
      pending.request.requestPayloadByteCount === 0n &&
      pending.request.completionByteCount === BigInt(blockBytes) &&
      pending.hostStatus === CADR_HOST_RESULT_OK &&
      pending.bytes.byteLength === blockBytes;
  }

  async function bootRequestRecord(pending, page, completionBoundary) {
    return Object.freeze({ generation: pending.request.generation,
      request_id: pending.request.requestId,
      transaction_id: pending.transactionId,
      first_block: pending.firstBlock,
      issue_boundary: pending.issueTick,
      completion_boundary: completionBoundary,
      page_sha256: await m4Sha256(page) });
  }

  async function identityBootDelivery(pending, overlayCommitted,
                                      completionBoundary) {
    if (!identity.policy.enabled || identity.phase === "blocked" ||
        identity.phase === "acknowledged") return;
    if (identity.phase === "await-initial-commit") {
      if (pending.request.operation !== CADR_HOST_OPERATION_BLOCK_WRITE ||
          pending.hostStatus !== CADR_HOST_RESULT_OK || !overlayCommitted ||
          pending.firstBlock !== 1n || pending.blockCount !== 1 ||
          pending.blockBytes !== blockBytes || pending.transactionId === 0n ||
          pending.transactionId !== pending.request.requestId ||
          overlayGeneration !== 1n || overlay === null) {
        identity.phase = "blocked";
        return;
      }
      identity.initialCommit = await bootRequestRecord(pending,
        pending.requestPayload, completionBoundary);
      identity.phase = "await-lba1-compare";
      return;
    }
    if (identity.phase === "await-lba1-compare") {
      if (!blockReadIs(pending, 1n) || overlay === null ||
          !sameBytes(pending.bytes, overlay)) {
        identity.phase = "blocked";
        return;
      }
      identity.comparisonRead = await bootRequestRecord(pending, pending.bytes,
        completionBoundary);
      identity.phase = "await-lba0-read";
      return;
    }
    if (identity.phase === "await-lba0-read") {
      if (!blockReadIs(pending, 0n)) {
        identity.phase = "blocked";
        return;
      }
      identity.baseRead = await bootRequestRecord(pending, pending.bytes,
        completionBoundary);
      identity.phase = "await-quiet-suffix";
    }
  }

  async function overlayRootSnapshot() {
    if (overlay === null) return m4OverlayRootForBase(selectedBaseSha256, new Map());
    const pageSha256 = await m4Sha256(overlay);
    return m4OverlayRootForBase(selectedBaseSha256,
      new Map([[1n, pageSha256]]));
  }

  function parseSingleBlockWrite(request, descriptor, payload) {
    if (request.operation !== CADR_HOST_OPERATION_BLOCK_WRITE ||
        descriptor.byteLength !== 24) return null;
    const view = new DataView(descriptor.buffer, descriptor.byteOffset,
      descriptor.byteLength);
    const transactionId = view.getBigUint64(0, true);
    const firstBlock = view.getBigUint64(8, true);
    const blockCount = view.getUint32(16, true);
    const requestBlockBytes = view.getUint32(20, true);
    const offset = firstBlock * BigInt(blockBytes);
    if (transactionId === 0n || transactionId !== request.requestId ||
        blockCount !== 1 || requestBlockBytes !== blockBytes ||
        request.requestPayloadByteCount !== BigInt(blockBytes) ||
        request.completionByteCount !== 0n || payload.byteLength !== blockBytes ||
        offset > imageByteCount || BigInt(blockBytes) > imageByteCount - offset) {
      return null;
    }
    return Object.freeze({ transactionId, firstBlock, blockCount,
      requestBlockBytes, offset });
  }

  function requestIsNewer(request, transactionId) {
    return committed !== null && transactionId === request.requestId &&
      (request.generation > committed.generation ||
       (request.generation === committed.generation &&
        request.requestId > committed.requestId));
  }

  async function identityAcknowledgementCandidate(request, descriptor, payload,
                                                  parsed, tick) {
    if (!identity.policy.enabled || identity.phase !== "armed" ||
        identity.candidates.length !== 0 ||
        !requestIsNewer(request, parsed.transactionId)) {
      return null;
    }
    let effective;
    let effectiveSource;
    if (parsed.firstBlock === 1n && overlay !== null) {
      effective = overlay.slice();
      effectiveSource = "overlay";
    } else {
      try {
        const supplied = bytesOf(await readRange(parsed.offset,
          BigInt(blockBytes)));
        if (supplied === null || supplied.byteLength !== blockBytes) return false;
        effective = supplied.slice();
        effectiveSource = "base";
      } catch {
        return false;
      }
    }
    if (!sameBytes(payload, effective)) return false;
    const root = await overlayRootSnapshot();
    return Object.freeze({
      schema: CADR_M7_EFFECTIVE_PAGE_IDENTITY_CANDIDATE_SCHEMA,
      profile: identity.policy.profile, arm: identity.arm,
      generation: request.generation, request_id: request.requestId,
      transaction_id: parsed.transactionId, first_block: parsed.firstBlock,
      descriptor: descriptor.slice(), effective_source: effectiveSource,
      effective_page_sha256: await m4Sha256(effective),
      issue_boundary: tick, due_boundary: tick + latencyTicks,
      host_status: CADR_HOST_RESULT_OK,
      media_before: Object.freeze({ dirty: overlay !== null,
        overlay_generation: overlayGeneration, overlay_root_sha256: root,
        persistent: false, staged: false }),
    });
  }

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
    let identityAcknowledgement = null;
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
      const parsed = parseSingleBlockWrite(request, descriptor, payload);
      if (parsed !== null) {
        ({ transactionId, firstBlock, blockCount, requestBlockBytes } = parsed);
        if (committed !== null &&
            committed.generation === request.generation &&
            committed.requestId === request.requestId &&
            committed.transactionId === transactionId &&
            sameBytes(committed.descriptor, descriptor)) {
          if (overlay !== null && overlay.byteLength === payload.byteLength &&
              overlay.every((value, index) => value === payload[index])) {
            bytes = new Uint8Array(0);
            hostStatus = CADR_HOST_RESULT_OK;
            replay = true;
          }
        } else if (identity.policy.enabled &&
                   identity.phase !== "await-initial-commit") {
          const candidate = await identityAcknowledgementCandidate(request,
            descriptor, payload, parsed, tick);
          if (candidate !== null && candidate !== false) {
            identityAcknowledgement = candidate;
            bytes = new Uint8Array(0);
            hostStatus = CADR_HOST_RESULT_OK;
          } else {
            /* Once the M7 policy is selected, a post-boot write has no
             * fallback mutation path.  An unarmed, changed, malformed, or
             * unreadable candidate is a failed host completion. */
            bytes = new Uint8Array(0);
            hostStatus = CADR_HOST_RESULT_FAILED;
          }
        } else if (firstBlock === 1n &&
                   overlayGeneration < 0xffffffffffffffffn &&
                   (committed === null || requestIsNewer(request, transactionId))) {
          staged = payload.slice();
          bytes = new Uint8Array(0);
          hostStatus = CADR_HOST_RESULT_OK;
          event.overlayPrepared = true;
        }
      }
    }
    const activeFaultMask = selectedFaultMask(request, firstBlock);
    if (bytes === null) bytes = new Uint8Array(Number(request.completionByteCount));
    if (identityAcknowledgement !== null &&
        activeFaultMask !== CADR_M4_BLOCK_FAULT_NONE) {
      identityAcknowledgement = null;
      hostStatus = CADR_HOST_RESULT_FAILED;
      bytes.fill(0);
    } else if ((activeFaultMask & CADR_M4_BLOCK_FAULT_STATUS_FAILED) !== 0) {
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
      replay, identityAcknowledgement, activeFaultMask,
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
        if (identity.policy.enabled && identity.phase !== "acknowledged") {
          identity.phase = "blocked";
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
          if (identity.policy.enabled && identity.phase !== "acknowledged") {
            identity.phase = "blocked";
          }
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
        let overlayCommitted = false;
        if (pending.request.operation === CADR_HOST_OPERATION_BLOCK_WRITE &&
            pending.hostStatus === CADR_HOST_RESULT_OK &&
            pending.staged !== null) {
          overlay = pending.staged;
          overlayGeneration += 1n;
          committed = {
            generation: pending.request.generation,
            requestId: pending.request.requestId,
            transactionId: pending.transactionId,
            descriptor: pending.descriptor.slice(),
          };
          delivered.overlayCommitted = true;
          delivered.overlayGeneration = overlayGeneration;
          overlayCommitted = true;
        } else if (pending.request.operation ===
                     CADR_HOST_OPERATION_BLOCK_WRITE &&
                   pending.hostStatus === CADR_HOST_RESULT_OK &&
                   pending.replay) {
          delivered.overlayReplayed = true;
        }
        await identityBootDelivery(pending, overlayCommitted, tick);
        if (pending.identityAcknowledgement !== null &&
            pending.hostStatus === CADR_HOST_RESULT_OK) {
          const currentRoot = await overlayRootSnapshot();
          const candidate = Object.freeze({ ...pending.identityAcknowledgement,
            completion_boundary: tick,
            media_after: Object.freeze({ dirty: overlay !== null,
              overlay_generation: overlayGeneration,
              overlay_root_sha256: currentRoot,
              persistent: false, staged: false }) });
          delivered.identityAcknowledged = true;
          delivered.identityAcknowledgementCandidate = candidate;
          identity.candidates.push(candidate);
          identity.phase = "acknowledged";
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
    m7EffectivePageIdentityEnabled() {
      return identity.policy.enabled;
    },
    m7EffectivePageIdentityCandidates() {
      return Object.freeze(identity.candidates.map(value => value));
    },
    m7EffectivePageIdentityArm() {
      return identity.arm;
    },
    observeM7EffectivePageIdentityQuietSuffix(observation) {
      if (!identity.policy.enabled || detaching) return Promise.resolve(null);
      const result = lifecycleTail.then(async () => {
        if (detaching || identity.phase !== "await-quiet-suffix") return null;
        if (observation === null || typeof observation !== "object" ||
            Object.getPrototypeOf(observation) !== Object.prototype ||
            Object.keys(observation).sort().join(",") !==
              "boundary,outstandingRequestId,persistentStatus,reason" ||
            !unsigned64(observation.boundary) || observation.reason !== 1 ||
            !unsigned32(observation.persistentStatus) ||
            observation.persistentStatus !== 0 ||
            !unsigned64(observation.outstandingRequestId) ||
            observation.outstandingRequestId !== 0n ||
            observation.boundary < CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY ||
            identity.initialCommit === null || identity.comparisonRead === null ||
            identity.baseRead === null ||
            overlay === null || overlayGeneration !== 1n || pending !== null) {
          identity.phase = "blocked";
          return null;
        }
        identity.arm = createM7EffectivePageIdentityArm({
          schema: CADR_M7_EFFECTIVE_PAGE_IDENTITY_ARM_SCHEMA,
          profile: identity.policy.profile,
          initial_commit: identity.initialCommit,
          comparison_read: identity.comparisonRead,
          base_read: identity.baseRead,
          quiet_suffix: { boundary: observation.boundary, reason: observation.reason,
            persistent_status: observation.persistentStatus,
            outstanding_request_id: observation.outstandingRequestId },
        });
        identity.phase = "armed";
        return identity.arm;
      });
      lifecycleTail = result.then(() => undefined, () => undefined);
      return result;
    },
    m7EffectivePageIdentityWitness() {
      if (!identity.policy.enabled || detaching || identity.phase !== "acknowledged" ||
          identity.candidates.length !== 1) return Promise.resolve(null);
      const result = lifecycleTail.then(async () => {
        if (detaching || pending !== null || identity.phase !== "acknowledged") return null;
        const candidate = identity.candidates[0];
        let bytes;
        if (candidate.first_block === 1n && overlay !== null) {
          bytes = overlay.slice();
        } else {
          const offset = candidate.first_block * BigInt(blockBytes);
          let supplied;
          try {
            supplied = bytesOf(await readRange(offset, BigInt(blockBytes)));
          } catch {
            return null;
          }
          if (supplied === null || supplied.byteLength !== blockBytes) return null;
          bytes = supplied.slice();
        }
        return Object.freeze({ first_block: candidate.first_block,
          effective_source: candidate.effective_source, bytes,
          media: Object.freeze({ dirty: overlay !== null,
            overlay_generation: overlayGeneration,
            overlay_root_sha256: await overlayRootSnapshot(),
            persistent: false, staged: false }) });
      });
      lifecycleTail = result.then(() => undefined, () => undefined);
      return result;
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
        identity.phase = identity.policy.enabled ? "blocked" : "disabled";
        identity.initialCommit = null;
        identity.comparisonRead = null;
        identity.baseRead = null;
        identity.arm = null;
        identity.candidates.length = 0;
        attachmentEpoch += 1n;
      }).finally(() => {
        detaching = false;
      });
      lifecycleTail = result.then(() => undefined, () => undefined);
      return result;
    },
  });
}
