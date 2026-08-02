/*
 * C-M6 headless boot orchestration.
 *
 * The driver composes the frozen ABI1.4/protocol-v4 M6 transport profile with
 * the M4 block service. READY is never caller-defined: release builds must
 * pin one native-derived record digest in this module. The compiled digest is
 * the strict verifier's accepted three-capture ABC record; any other record
 * fails before artifact ingress or guest mutation.
 */
import {
  CADR_HOST_OPERATION_BLOCK_READ,
  CADR_HOST_OPERATION_BLOCK_WRITE,
  CADR_HOST_RESULT_FAILED,
  CADR_HOST_RESULT_OK,
  CADR_M4_BLOCK_BYTES,
  CADR_M4_MAX_COMPLETION_BYTES,
  CADR_STATUS_OK,
  CADR_STATUS_NOT_READY,
  createM4BlockRangeService,
} from "./cadr-m4-block-service.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  createM7EffectivePageIdentityAcknowledgement,
  createM7EffectivePageIdentityStream,
  parseM7EffectivePageIdentityPolicy,
} from "./cadr-m7-effective-page-identity.mjs";
import { CADR_STATUS_UNIMPLEMENTED_DEVICE,
  parseCadrM7UnimplementedDiagnostic } from "./cadr-m7-devid-failure.mjs";

export const CADR_M6_SCHEMA = "CDRM6BOOT1";
export const CADR_M6_READY_CONTRACT =
  "C-M6-DEBUG-IR-LISTENER-READY-ABC-v1";
/* M6-DEVID1 is a separate evidence continuation profile.  It has no
 * production READY claim until its own reviewed release envelope exists. */
export const CADR_M6_DEVID_PROFILE =
  "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1";
export const CADR_M6_DEVID_POLICY_ID = "M6-PREFIX512-TAILSHA256-v1";
export const CADR_M6_READY4_CONTRACT =
  "C-M6-DISK-EVIDENCE-READY4-BINDING-v1";
export const CADR_M6_PROTOCOL_VERSION = 4;
export const CADR_M6_RELEASE_RECORD_SCHEMA =
  "cadr-m6-native-debug-ir-release-record-v1";
/* Native verifier accepted the exact three-capture ABC record. The driver
 * still requires caller-supplied canonical record bytes, but accepts only this
 * digest; no caller callback can define READY. */
export const CADR_M6_RELEASE_RECORD_SHA256 = hexBytes(
  "5e90866967905acb22c21abb1dc40ada01e134ef6ce1be372e1a6bae63546c4a");
export const CADR_M6_CADET_MAPPING_SHA256 =
  "2881102e8a8883379cf7da06251501b3c75f453d8fe0bff0d7e9f649198e1cd8";
export const CADR_M6_FORM_A_START_BOUNDARY = 50000000n;
export const CADR_M6_INPUT_CHUNK_CHARACTERS = 16;
export const CADR_M6_INPUT_CHUNK_PAUSE_BOUNDARIES = 10000000n;
export const CADR_M6_FORM_B_HOLD_BOUNDARIES = 20000000n;
export const CADR_M6_FORM_A = 0xa55a41314d36n;
export const CADR_M6_FORM_B = 0x5aa542324d36n;
export const CADR_M6_FORM_C = 0x4c4549444d36n;
export const CADR_M6_LISTENER_IDLE_C_TIMEOUT_BOUNDARIES = 100000000n;
export const CADR_M6_LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES = 1000000n;
export const CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES = 64;
export const CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES = 256;
export const CADR_M6_REQUIRED_ARTIFACT_KINDS = Object.freeze([1, 2, 4, 5, 3]);
const CADR_M6_PINNED_READY_BOUNDARIES = Object.freeze({
  formA: 328623243n,
  formB: 980313535n,
  listenerIdleC: 982990214n,
  listenerIdleSettled: 983990214n,
  ready: 983990278n,
});
const CADR_M6_PINNED_ARTIFACT_SET_SHA256 =
  "ac8a1617651fa1546e3777c28f276f80d5675aae5da253b4c9e937b6f8019071";
const CADR_M6_PINNED_PRIVATE_DISK_BASE_SHA256 =
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
export const CADR_M6_DEFAULT_BATCH_SLOTS = 4096;
export const CADR_M6_FAST_RUN_MAX_SLOTS = 1048576;
export const CADR_M6_DEFAULT_LAST_TRANSACTIONS = 16;
export const CADR_M6_HARD_MAX_HOST_TRANSACTIONS = 1024;
export const CADR_M6_HARD_MAX_REPORT_TRANSACTIONS = 32;

const STATUS_INVALID_ARGUMENT = 2;
const STATUS_HOST_FAILURE = 7;
const STATUS_WAITING_FOR_HOST = 8;
const STATUS_ARTIFACT_MISMATCH = 11;
const TERMINAL_STATUSES = new Set([7, 12, 13, 16]);
const TRANSFER_LIMIT = 1048576n;
const CADR_M6_FORM_C_UTF8_SHA256 =
  "046c90e9d5421ef2d23d9483889659066f9e71e8dd8aa1be31e0f5a413cc2969";
const CADR_M6_SEMANTIC_ARTIFACT_IDENTITIES = Object.freeze([
  Object.freeze({ kind: 1, byte_count: "854",
    sha256: "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f" }),
  Object.freeze({ kind: 2, byte_count: "20480",
    sha256: "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6" }),
  Object.freeze({ kind: 4, byte_count: "3130",
    sha256: "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d" }),
  Object.freeze({ kind: 5, byte_count: "83270",
    sha256: "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a" }),
  Object.freeze({ kind: 3, byte_count: "269562880",
    sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5" }),
]);
const CADR_M6_NATIVE_INPUTS = Object.freeze([
  Object.freeze({
    id: "usite-extra-hosts",
    byte_count: "262",
    sha256: "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
  }),
]);
const CADR_M6_NATIVE_EXECUTION_ENVIRONMENT = Object.freeze({
  policy_id: "cadr-m6-native-minimal-environment-v1",
  inherited: false,
  variables: Object.freeze({ LANG: "C", LC_ALL: "C", TZ: "UTC" }),
});
/* This is data from the native release verifier, not an executable guest
 * callback. Its exact shape binds the Form-C observer's identity checks,
 * wait, scheduling-inhibited write, and deliberately retained nonclaims. */
const CADR_M6_LISTENER_IDLE_OBSERVER = Object.freeze({
  schema: "cadr-m6-listener-idle-observer-v1",
  spawner: "process-run-function",
  wait: "process-wait-for-lisp-listener-idle",
  critical_section: "without-interrupts",
  source_form: "b",
  marker_form: "c",
  identity_checks: [
    "initial-lisp-listener", "selected-window", "lisp-listener-type",
    "exposed", "owner-process", "owner-stack-group", "lisp-listener-idle",
  ],
  nonclaims: [
    "tagged-pointer-identity", "read-for-top-level", "input-empty",
  ],
  cleanup: {
    hold_boundaries: "1000000",
    stable_invariants: [
      "debug-ir-c", "keyboard-all-up", "keyboard-fifo-empty",
      "iob-cclk-clear", "disk-not-busy", "host-no-request",
    ],
    residual_nonclaim: "observer-process-inactivity-not-decoded",
  },
});

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

function sameBytes(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

function freshEvidenceId(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}-${[...bytes].map(
    value => value.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256(value) {
  const bytes = bytesOf(value);
  if (bytes === null) throw new TypeError("SHA-256 input must be bytes");
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}

function failure(reason, phase, status, extra = {}) {
  return {
    schema: CADR_M6_SCHEMA,
    schemaVersion: 1,
    outcome: "failed",
    reason,
    phase,
    status,
    ...extra,
  };
}

function validateLimits(config) {
  const maxBoundaries = config.maxBoundaries;
  const maxHostTransactions = config.maxHostTransactions;
  const batchSlots = config.batchSlots ?? CADR_M6_DEFAULT_BATCH_SLOTS;
  const lastTransactionLimit = config.lastTransactionLimit ??
    Math.min(CADR_M6_DEFAULT_LAST_TRANSACTIONS, maxHostTransactions * 2);
  if (!unsigned64(maxBoundaries) || maxBoundaries === 0n ||
      !Number.isSafeInteger(maxHostTransactions) || maxHostTransactions <= 0 ||
      maxHostTransactions > CADR_M6_HARD_MAX_HOST_TRANSACTIONS ||
      !Number.isSafeInteger(batchSlots) || batchSlots <= 0 ||
      batchSlots > CADR_M6_DEFAULT_BATCH_SLOTS ||
      !Number.isSafeInteger(lastTransactionLimit) ||
      lastTransactionLimit <= 0 ||
      lastTransactionLimit > CADR_M6_HARD_MAX_REPORT_TRANSACTIONS ||
      lastTransactionLimit > maxHostTransactions * 2) {
    throw new RangeError("invalid bounded M6 limits");
  }
  return { maxBoundaries, maxHostTransactions, batchSlots, lastTransactionLimit };
}

function artifactMaps(artifacts, profile) {
  if (!Array.isArray(artifacts) || !Array.isArray(profile?.artifacts) ||
      typeof profile.id !== "string" || profile.id.length === 0) {
    throw new TypeError("M6 needs an explicit artifact profile and sources");
  }
  const actual = new Map();
  for (const artifact of artifacts) {
    if (!unsigned32(artifact?.kind) || !unsigned64(artifact?.byteCount) ||
        artifact.byteCount === 0n || typeof artifact.readRange !== "function" ||
        actual.has(artifact.kind)) {
      throw new TypeError("invalid or duplicate M6 artifact source");
    }
    actual.set(artifact.kind, artifact);
  }
  const expected = new Map();
  for (const artifact of profile.artifacts) {
    const digest = bytesOf(artifact?.sha256);
    if (!unsigned32(artifact?.kind) || !unsigned64(artifact?.byteCount) ||
        artifact.byteCount === 0n || digest === null || digest.byteLength !== 32 ||
        expected.has(artifact.kind)) {
      throw new TypeError("invalid or duplicate M6 artifact profile");
    }
    expected.set(artifact.kind, {
      kind: artifact.kind,
      byteCount: artifact.byteCount,
      sha256: digest.slice(),
    });
  }
  if (actual.size !== CADR_M6_REQUIRED_ARTIFACT_KINDS.length ||
      expected.size !== CADR_M6_REQUIRED_ARTIFACT_KINDS.length ||
      CADR_M6_REQUIRED_ARTIFACT_KINDS.some(
        kind => !actual.has(kind) || !expected.has(kind))) {
    throw new RangeError("M6 fixed profile requires exactly artifact kinds 1,2,3,4,5");
  }
  return { actual, expected };
}

export async function preflightM6Artifacts({ artifacts, profile, hashArtifact }) {
  if (typeof hashArtifact !== "function") {
    throw new TypeError("M6 requires a streaming artifact SHA-256 implementation");
  }
  const { actual, expected } = artifactMaps(artifacts, profile);
  const verified = [];
  for (const kind of CADR_M6_REQUIRED_ARTIFACT_KINDS) {
    const source = actual.get(kind);
    const identity = expected.get(kind);
    if (source.byteCount !== identity.byteCount) {
      const error = new RangeError(`artifact kind ${kind} byte count mismatch`);
      error.status = STATUS_ARTIFACT_MISMATCH;
      throw error;
    }
    /* Snapshot once, then hash, import, and service the disk from these exact
     * private bytes. This removes the hash/read TOCTOU window without relying
     * on a caller's claim that its source is immutable. */
    const chunks = [];
    for (let offset = 0n; offset < source.byteCount; offset += TRANSFER_LIMIT) {
      const count = source.byteCount - offset < TRANSFER_LIMIT ?
        source.byteCount - offset : TRANSFER_LIMIT;
      chunks.push(await readExact(source, offset, count));
    }
    const spooled = Object.freeze({
      kind,
      byteCount: source.byteCount,
      async readRange(offset, byteCount) {
        if (!unsigned64(offset) || !unsigned64(byteCount) ||
            offset > source.byteCount || byteCount > source.byteCount - offset) {
          throw new RangeError("spooled artifact range is out of bounds");
        }
        const output = new Uint8Array(Number(byteCount));
        let destination = 0;
        let cursor = offset;
        while (destination < output.byteLength) {
          const chunkIndex = Number(cursor / TRANSFER_LIMIT);
          const chunkOffset = Number(cursor % TRANSFER_LIMIT);
          const available = chunks[chunkIndex].byteLength - chunkOffset;
          const count = Math.min(available, output.byteLength - destination);
          output.set(chunks[chunkIndex].subarray(chunkOffset, chunkOffset + count),
            destination);
          cursor += BigInt(count);
          destination += count;
        }
        return output;
      },
    });
    const digest = bytesOf(await hashArtifact(spooled));
    if (digest === null || digest.byteLength !== 32 ||
        !sameBytes(digest, identity.sha256)) {
      const error = new RangeError(`artifact kind ${kind} SHA-256 mismatch`);
      error.status = STATUS_ARTIFACT_MISMATCH;
      throw error;
    }
    verified.push(Object.freeze({
      kind,
      byteCount: source.byteCount,
      sha256: digest.slice(),
      source: spooled,
    }));
  }
  const profileId = new TextEncoder().encode(profile.id);
  const identity = new Uint8Array(
    8 + 4 + profileId.byteLength + verified.length * 44);
  identity.set(new TextEncoder().encode("CDRM6AR1"), 0);
  const identityView = new DataView(identity.buffer);
  identityView.setUint32(8, profileId.byteLength, true);
  identity.set(profileId, 12);
  let identityOffset = 12 + profileId.byteLength;
  for (const artifact of verified) {
    identityView.setUint32(identityOffset, artifact.kind, true);
    identityView.setBigUint64(identityOffset + 4, artifact.byteCount, true);
    identity.set(artifact.sha256, identityOffset + 12);
    identityOffset += 44;
  }
  return Object.freeze({
    profileId: profile.id,
    artifactSetSha256: await sha256(identity),
    artifacts: Object.freeze(verified.map(({ source: _source, ...item }) =>
      Object.freeze(item))),
    sources: Object.freeze(verified.map(item => item.source)),
  });
}

async function readExact(artifact, offset, byteCount) {
  if (!unsigned64(offset) || !unsigned64(byteCount) ||
      offset > artifact.byteCount || byteCount > artifact.byteCount - offset) {
    throw new RangeError("artifact range is out of bounds");
  }
  const bytes = bytesOf(await artifact.readRange(offset, byteCount));
  if (bytes === null || BigInt(bytes.byteLength) !== byteCount) {
    const error = new RangeError("artifact source returned a short range");
    error.status = STATUS_ARTIFACT_MISMATCH;
    throw error;
  }
  return bytes.slice();
}

async function workerRequest(client, op, fields = {}, transfer = []) {
  if (typeof client?.request !== "function") {
    throw new TypeError("M6 client must provide request(op, fields, transfer)");
  }
  const response = await client.request(op, fields, transfer);
  if (response === null || typeof response !== "object" ||
      !unsigned32(response.status)) {
    throw new TypeError(`malformed worker response for ${op}`);
  }
  return response;
}

async function workerOk(client, op, fields = {}, transfer = []) {
  const response = await workerRequest(client, op, fields, transfer);
  if (response.status !== CADR_STATUS_OK) {
    const error = new Error(`${op} failed with status ${response.status}`);
    error.status = response.status;
    error.operation = op;
    throw error;
  }
  return response;
}

async function importArtifact(client, artifact) {
  if (artifact.byteCount <= TRANSFER_LIMIT) {
    const bytes = await readExact(artifact, 0n, artifact.byteCount);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await workerOk(client, "input", { bytes: buffer }, [buffer]);
    await workerOk(client, "import", {
      artifactKind: artifact.kind,
      byteCount: Number(artifact.byteCount),
    });
    return;
  }
  await workerOk(client, "stream-begin", {
    artifactKind: artifact.kind,
    byteCount: artifact.byteCount,
  });
  try {
    for (let offset = 0n; offset < artifact.byteCount; offset += TRANSFER_LIMIT) {
      const byteCount = artifact.byteCount - offset < TRANSFER_LIMIT ?
        artifact.byteCount - offset : TRANSFER_LIMIT;
      const bytes = await readExact(artifact, offset, byteCount);
      const buffer = bytes.buffer.slice(
        bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      await workerOk(client, "stream-chunk", { offset, bytes: buffer }, [buffer]);
    }
    await workerOk(client, "stream-finish");
  } catch (error) {
    await workerRequest(client, "stream-abort");
    throw error;
  }
}

function parseMachineInfo(response) {
  const bytes = bytesOf(response?.info);
  if (bytes === null || bytes.byteLength !== 64) {
    throw new TypeError("malformed 64-byte machine-info response");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    lifecycle: view.getUint32(0, true),
    artifactMask: view.getUint32(4, true),
    boundary: view.getBigUint64(8, true),
    microinstructions: view.getBigUint64(16, true),
    generation: view.getBigUint64(24, true),
    nextRequestId: view.getBigUint64(32, true),
    outstandingRequestId: view.getBigUint64(40, true),
    lastCompletedRequestId: view.getBigUint64(48, true),
    persistentStatus: view.getUint32(56, true),
    profile: view.getUint32(60, true),
  };
}

async function transcriptRecord(event, ordinal) {
  const descriptor = bytesOf(event.descriptor) ?? new Uint8Array(0);
  const requestPayload = bytesOf(event.requestPayload) ?? new Uint8Array(0);
  const page = bytesOf(event.pageBytes) ?? new Uint8Array(0);
  const completion = event.completionDelivered &&
    event.operation !== CADR_HOST_OPERATION_BLOCK_WRITE ?
    page : new Uint8Array(0);
  return Object.freeze({
    ordinal,
    actor: event.requestSeen ? "issue" : "completion",
    guestBoundary: event.requestSeen ? event.issueTick : event.deliveryTick,
    dueBoundary: event.dueTick,
    generation: event.generation,
    requestId: event.requestId,
    operation: event.operation,
    hostStatus: event.hostStatus,
    descriptorByteCount: BigInt(descriptor.byteLength),
    requestPayloadByteCount: event.requestPayloadByteCount,
    completionByteCount: event.completionByteCount,
    descriptorSha256: await sha256(descriptor),
    requestPayloadSha256: await sha256(requestPayload),
    completionSha256: await sha256(completion),
    firstBlock: event.firstBlock,
    blockCount: event.blockCount,
    blockBytes: event.blockBytes,
    overlayGeneration: event.overlayGeneration,
  });
}

export function serializeM6HostTranscript(records, artifactSetSha256) {
  const artifactDigest = bytesOf(artifactSetSha256);
  if (!Array.isArray(records) || artifactDigest === null ||
      artifactDigest.byteLength !== 32 || records.length > 0xffffffff) {
    throw new TypeError("invalid M6 host transcript");
  }
  const output = new Uint8Array(
    CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
    records.length * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES);
  output.set(new TextEncoder().encode("CDRM6HS1"), 0);
  const header = new DataView(
    output.buffer, output.byteOffset, CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES);
  header.setUint32(8, 1, true);
  header.setUint32(12, CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES, true);
  header.setUint32(16, CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES, true);
  header.setUint32(20, records.length, true);
  output.set(artifactDigest, 24);
  records.forEach((record, index) => {
    const descriptorDigest = bytesOf(record?.descriptorSha256);
    const payloadDigest = bytesOf(record?.requestPayloadSha256);
    const completionDigest = bytesOf(record?.completionSha256);
    if (record?.ordinal !== index ||
        !["issue", "completion"].includes(record?.actor) ||
        !unsigned64(record?.guestBoundary) || !unsigned64(record?.dueBoundary) ||
        !unsigned64(record?.generation) || !unsigned64(record?.requestId) ||
        !unsigned32(record?.operation) || !unsigned32(record?.hostStatus) ||
        !unsigned64(record?.descriptorByteCount) ||
        !unsigned64(record?.requestPayloadByteCount) ||
        !unsigned64(record?.completionByteCount) ||
        !unsigned64(record?.firstBlock) || !unsigned32(record?.blockCount) ||
        !unsigned32(record?.blockBytes) || !unsigned64(record?.overlayGeneration) ||
        descriptorDigest?.byteLength !== 32 || payloadDigest?.byteLength !== 32 ||
        completionDigest?.byteLength !== 32) {
      throw new TypeError(`invalid M6 host transcript record ${index}`);
    }
    const offset = CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
      index * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES;
    const view = new DataView(
      output.buffer, output.byteOffset + offset,
      CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES);
    view.setBigUint64(0, BigInt(index), true);
    view.setUint32(8, record.actor === "issue" ? 1 : 2, true);
    view.setUint32(12, record.operation, true);
    view.setBigUint64(16, record.guestBoundary, true);
    view.setBigUint64(24, record.dueBoundary, true);
    view.setBigUint64(32, record.generation, true);
    view.setBigUint64(40, record.requestId, true);
    view.setUint32(48, record.hostStatus, true);
    view.setUint32(52, record.blockCount, true);
    view.setBigUint64(56, record.descriptorByteCount, true);
    view.setBigUint64(64, record.requestPayloadByteCount, true);
    view.setBigUint64(72, record.completionByteCount, true);
    view.setBigUint64(80, record.firstBlock, true);
    view.setUint32(88, record.blockBytes, true);
    view.setBigUint64(96, record.overlayGeneration, true);
    output.set(descriptorDigest, offset + 104);
    output.set(payloadDigest, offset + 136);
    output.set(completionDigest, offset + 168);
  });
  return output;
}

/* Parse the selected READY4 host-service transcript without trusting its
 * JavaScript projections.  The fast path selects zero-latency M4 block
 * service: every reason-3 CDRM6FAST1 must therefore correspond to one
 * adjacent issue/completion pair at the same guest boundary and request
 * identity.  CDRM6HS1 is a digest-only receipt, so its operation/count and
 * overlay state machine must be checked here; matching its fixed layout alone
 * would permit a receipt that could not have come from the selected service. */
export async function parseM6ZeroLatencyHostTranscript(value, {
  artifactSetSha256,
  hostWaitRecords,
} = {}) {
  const bytes = bytesOf(value);
  const artifact = bytesOf(artifactSetSha256);
  if (bytes === null || artifact?.byteLength !== 32 || !Array.isArray(hostWaitRecords) ||
      bytes.byteLength < CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES ||
      (bytes.byteLength - CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES) %
        CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES !== 0 ||
      new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRM6HS1") {
    throw new TypeError("invalid selected zero-latency M6 host transcript");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset,
    CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES);
  const count = header.getUint32(20, true);
  if (header.getUint32(8, true) !== 1 ||
      header.getUint32(12, true) !== CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES ||
      header.getUint32(16, true) !== CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES ||
      count !== hostWaitRecords.length * 2 ||
      bytes.byteLength !== CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
        count * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES ||
      !sameBytes(bytes.subarray(24, 56), artifact) ||
      bytes.subarray(56, 64).some(byte => byte !== 0)) {
    throw new TypeError("M6 host transcript header differs from the selected zero-latency structure");
  }
  const emptyDigest = await sha256(new Uint8Array(0));
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const offset = CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
      index * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES;
    const recordBytes = bytes.subarray(offset, offset + CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES);
    const view = new DataView(recordBytes.buffer, recordBytes.byteOffset, recordBytes.byteLength);
    const record = Object.freeze({
      ordinal: view.getBigUint64(0, true), actor: view.getUint32(8, true),
      operation: view.getUint32(12, true), guestBoundary: view.getBigUint64(16, true),
      dueBoundary: view.getBigUint64(24, true), generation: view.getBigUint64(32, true),
      requestId: view.getBigUint64(40, true), hostStatus: view.getUint32(48, true),
      blockCount: view.getUint32(52, true), descriptorByteCount: view.getBigUint64(56, true),
      requestPayloadByteCount: view.getBigUint64(64, true),
      completionByteCount: view.getBigUint64(72, true), firstBlock: view.getBigUint64(80, true),
      blockBytes: view.getUint32(88, true), overlayGeneration: view.getBigUint64(96, true),
      descriptorSha256: recordBytes.slice(104, 136),
      requestPayloadSha256: recordBytes.slice(136, 168),
      completionSha256: recordBytes.slice(168, 200),
    });
    if (record.ordinal !== BigInt(index) || ![1, 2].includes(record.actor) ||
        recordBytes.subarray(200).some(byte => byte !== 0)) {
      throw new TypeError(`invalid selected M6 host transcript record ${index}`);
    }
    records.push(record);
  }
  const identicalFields = ["operation", "dueBoundary", "generation", "requestId", "hostStatus",
    "blockCount", "descriptorByteCount", "requestPayloadByteCount", "completionByteCount",
    "firstBlock", "blockBytes"];
  let overlayGeneration = 0n;
  let lastCommittedWrite = null;
  for (let ordinal = 0; ordinal < hostWaitRecords.length; ordinal += 1) {
    const issue = records[ordinal * 2];
    const completion = records[ordinal * 2 + 1];
    const wait = parseM6FastRunRecord(hostWaitRecords[ordinal]);
    if (wait.reason !== 3 || issue.actor !== 1 || completion.actor !== 2 ||
        issue.guestBoundary !== issue.dueBoundary ||
        completion.guestBoundary !== completion.dueBoundary ||
        completion.guestBoundary !== issue.guestBoundary ||
        wait.postBoundary !== issue.guestBoundary ||
        wait.outstandingRequestId !== issue.requestId ||
        identicalFields.some(field => issue[field] !== completion[field]) ||
        !sameBytes(issue.descriptorSha256, completion.descriptorSha256) ||
        !sameBytes(issue.requestPayloadSha256, completion.requestPayloadSha256) ||
        !sameBytes(issue.completionSha256, emptyDigest) ||
        issue.overlayGeneration !== overlayGeneration ||
        ![CADR_HOST_RESULT_OK, CADR_HOST_RESULT_FAILED].includes(issue.hostStatus)) {
      throw new TypeError(`M6 host wait ${ordinal} differs from its exact zero-latency transcript pair`);
    }
    if (issue.operation === CADR_HOST_OPERATION_BLOCK_READ) {
      const expectedCompletionBytes = BigInt(issue.blockCount) * BigInt(issue.blockBytes);
      if (issue.descriptorByteCount !== 16n || issue.requestPayloadByteCount !== 0n ||
          issue.blockCount === 0 || issue.blockBytes !== CADR_M4_BLOCK_BYTES ||
          expectedCompletionBytes !== issue.completionByteCount ||
          issue.completionByteCount > BigInt(CADR_M4_MAX_COMPLETION_BYTES) ||
          sameBytes(completion.completionSha256, emptyDigest) ||
          completion.overlayGeneration !== overlayGeneration) {
        throw new TypeError(`M6 host wait ${ordinal} violates selected block-read completion semantics`);
      }
      continue;
    }
    if (issue.operation !== CADR_HOST_OPERATION_BLOCK_WRITE ||
        issue.descriptorByteCount !== 24n ||
        issue.requestPayloadByteCount !== BigInt(CADR_M4_BLOCK_BYTES) ||
        issue.completionByteCount !== 0n || issue.firstBlock !== 1n ||
        issue.blockCount !== 1 || issue.blockBytes !== CADR_M4_BLOCK_BYTES ||
        !sameBytes(completion.completionSha256, emptyDigest)) {
      throw new TypeError(`M6 host wait ${ordinal} violates selected block-write completion semantics`);
    }
    if (issue.hostStatus === CADR_HOST_RESULT_FAILED) {
      if (completion.overlayGeneration !== overlayGeneration) {
        throw new TypeError(`M6 host wait ${ordinal} changes the overlay after a failed write`);
      }
      continue;
    }
    if (completion.overlayGeneration === overlayGeneration) {
      if (lastCommittedWrite === null ||
          lastCommittedWrite.generation !== issue.generation ||
          lastCommittedWrite.requestId !== issue.requestId ||
          !sameBytes(lastCommittedWrite.descriptorSha256, issue.descriptorSha256) ||
          !sameBytes(lastCommittedWrite.requestPayloadSha256, issue.requestPayloadSha256)) {
        throw new TypeError(`M6 host wait ${ordinal} accepts a write replay without its last committed request`);
      }
      continue;
    }
    if (overlayGeneration === 0xffffffffffffffffn ||
        completion.overlayGeneration !== overlayGeneration + 1n ||
        (lastCommittedWrite !== null &&
         (issue.generation < lastCommittedWrite.generation ||
          (issue.generation === lastCommittedWrite.generation &&
           issue.requestId <= lastCommittedWrite.requestId)))) {
      throw new TypeError(`M6 host wait ${ordinal} has an invalid overlay commit transition`);
    }
    overlayGeneration = completion.overlayGeneration;
    lastCommittedWrite = Object.freeze({ generation: issue.generation,
      requestId: issue.requestId, descriptorSha256: issue.descriptorSha256,
      requestPayloadSha256: issue.requestPayloadSha256 });
  }
  return Object.freeze({ recordCount: count, transactionCount: hostWaitRecords.length,
    records: Object.freeze(records) });
}

function responseDigest(response, field) {
  const bytes = bytesOf(response?.[field]);
  return bytes !== null && bytes.byteLength === 32 ? bytes.slice() : null;
}

async function terminalUnimplementedDiagnostic(response, boundary, status, required) {
  if (status !== CADR_STATUS_UNIMPLEMENTED_DEVICE) return null;
  const bytes = bytesOf(response?.unimplementedDiagnostic);
  const suppliedDigest = responseDigest(response, "unimplementedDiagnosticDigest");
  if (bytes === null && suppliedDigest === null && required !== true) return null;
  const parsed = bytes === null ? null : parseCadrM7UnimplementedDiagnostic(bytes);
  if (parsed === null || suppliedDigest === null || parsed.boundary !== boundary ||
      !sameBytes(await sha256(bytes), suppliedDigest)) {
    throw new TypeError("terminal status 13 lacks its exact CDRM7U1 source diagnostic");
  }
  return Object.freeze({ schema: "cadr-m7-unimplemented-device-v1",
    site: parsed.site, siteName: parsed.siteName, direction: parsed.direction,
    address: parsed.address, value: parsed.value, result: parsed.result,
    status: parsed.status, boundary: parsed.boundary,
    microinstructions: parsed.microinstructions, wireSha256: suppliedDigest.slice() });
}

async function collectEvidence(client, context) {
  let state = null;
  let machine = context.lastMachineInfo;
  let stateDigest = context.terminalStateDigest;
  let queueDigest = context.terminalQueueDigest;
  try {
    state = await workerRequest(client, "scheduler-state");
  } catch {
    state = null;
  }
  if (state?.status === CADR_STATUS_OK) {
    queueDigest ??= responseDigest(state, "queueDigest");
    stateDigest ??= responseDigest(state, "coreStateDigest");
  }
  if (state?.lifecycle !== "FAILED") {
    try {
      const response = await workerRequest(client, "boundary-digest-v5");
      if (response.status === CADR_STATUS_OK) stateDigest ??= responseDigest(response, "digest");
    } catch {
      // Preserve the rest of the bounded report.
    }
    try {
      const response = await workerRequest(client, "scheduler-queue-digest");
      if (response.status === CADR_STATUS_OK) queueDigest ??= responseDigest(response, "digest");
    } catch {
      // Preserve the rest of the bounded report.
    }
    try {
      const response = await workerRequest(client, "machine-info");
      if (response.status === CADR_STATUS_OK) machine = parseMachineInfo(response);
    } catch {
      // The previous successfully observed machine info remains evidence.
    }
  }
  return {
    boundary: state?.lastCompleteBoundary ?? machine?.boundary ?? context.boundary,
    lifecycle: state?.lifecycle ?? context.lifecycle,
    cdrstate5Sha256: stateDigest,
    cdrm5q1Sha256: queueDigest,
    outstandingRequest: context.outstandingRequest,
    machineInfo: machine,
    runFraming: context.lastRunFraming,
    ...(context.terminalUnimplementedDevice === null ? {} : {
      unimplementedDevice: context.terminalUnimplementedDevice,
    }),
    transcriptCount: context.transcript.length,
    lastHostTransactions:
      context.transcript.slice(-context.lastTransactionLimit),
  };
}

async function failResult(client, context, reason, phase, status) {
  const hostTranscript = context.preflight === null ?
    new Uint8Array(0) :
    serializeM6HostTranscript(
      context.transcript, context.preflight.artifactSetSha256);
  const hostTranscriptSha256 = await sha256(hostTranscript);
  const evidence = await collectEvidence(client, context);
  if (context.requireM7DevidFailureDiagnostic === true &&
      (status === CADR_STATUS_UNIMPLEMENTED_DEVICE) !==
        ((evidence.unimplementedDevice ?? null) !== null)) {
    throw new TypeError("status-13 failure diagnostic identity is inconsistent");
  }
  return {
    outcome: "failed",
    runEvidence: context.runEvidence,
    preflight: publicPreflight(context.preflight),
    transcriptTail: context.transcript.slice(-context.lastTransactionLimit),
    report: failure(reason, phase, status,
      { schemaVersion: (evidence.unimplementedDevice ?? null) === null ? 1 : 2,
        ...evidence, hostTranscriptSha256 }),
  };
}

function publicPreflight(preflight) {
  if (preflight === null) return null;
  return Object.freeze({
    profileId: preflight.profileId,
    artifactSetSha256: preflight.artifactSetSha256.slice(),
    artifacts: preflight.artifacts,
  });
}

async function assertQuiescent(client, blockService) {
  if (blockService.hasPendingRequest()) {
    throw new Error("block service retains a pending request");
  }
  const info = parseMachineInfo(await workerOk(client, "machine-info"));
  if (info.lifecycle !== 2 || info.persistentStatus !== CADR_STATUS_OK ||
      info.outstandingRequestId !== 0n) {
    throw new Error("core retains an outstanding host request");
  }
  const scheduler = await workerOk(client, "scheduler-state");
  if (scheduler.lifecycle !== "PAUSED" || scheduler.runActive !== false ||
      scheduler.deferredControlCount !== 0 ||
      scheduler.pendingBoundaryDigest !== false ||
      scheduler.mediaBusy !== false ||
      scheduler.mediaSnapshotBlocked !== false ||
      scheduler.visibilityInitialized !== true || scheduler.hidden !== false) {
    throw new Error("worker is not fully quiescent at READY");
  }
  const next = await workerRequest(client, "host-next-request");
  if (next.status !== CADR_STATUS_NOT_READY) {
    throw new Error("host request remained observable at READY");
  }
  return Object.freeze({ machineInfo: Object.freeze({ ...info }),
    scheduler: Object.freeze({ lifecycle: scheduler.lifecycle,
      runActive: scheduler.runActive, deferredControlCount: scheduler.deferredControlCount,
      pendingBoundaryDigest: scheduler.pendingBoundaryDigest, mediaBusy: scheduler.mediaBusy,
      mediaSnapshotBlocked: scheduler.mediaSnapshotBlocked,
      visibilityInitialized: scheduler.visibilityInitialized, hidden: scheduler.hidden,
      blockServicePending: false, hostNextRequestStatus: next.status }) });
}

function containsExecutable(value, seen = new Set()) {
  if (typeof value === "function") return true;
  if (value === null || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some(item => containsExecutable(item, seen));
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}

function digestHex(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function hexBytes(value) {
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function hexBytes96(value) {
  const output = new Uint8Array(96);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function bytesHex(value, label = "digest") {
  const bytes = bytesOf(value);
  if (bytes === null || bytes.byteLength !== 32) {
    throw new TypeError(`${label} must be 32 bytes`);
  }
  return [...bytes].map(
    item => item.toString(16).padStart(2, "0")).join("");
}

/*
 * This parser is exported only so unit tests can exercise malformed synthetic
 * records. Production calls hash the exact bytes against the compiled digest
 * before parsing, and that digest is currently absent.
 */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function decimalU64(value, label, allowZero = false) {
  if (typeof value !== "string" ||
      !(allowZero ? /^(0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/).test(value) ||
      BigInt(value) > 0xffffffffffffffffn) {
    throw new TypeError(`${label} is not a canonical u64 decimal string`);
  }
  return BigInt(value);
}

const CADET_SCANCODES = Object.freeze({
  a: 0o123, b: 0o114, c: 0o164, d: 0o163, e: 0o162, f: 0o013,
  g: 0o113, h: 0o053, i: 0o032, j: 0o153, k: 0o033, l: 0o073,
  m: 0o154, n: 0o054, o: 0o072, p: 0o172, q: 0o122, r: 0o012,
  s: 0o063, t: 0o112, u: 0o152, v: 0o014, w: 0o062, x: 0o064,
  y: 0o052, z: 0o124,
  "0": 0o171, "1": 0o121, "2": 0o061, "3": 0o161, "4": 0o011,
  "5": 0o111, "6": 0o051, "7": 0o151, "8": 0o031, "9": 0o071,
  "(": 0o071, ")": 0o171, ":": 0o021, "'": 0o133, "-": 0o131,
  " ": 0o134,
});
const CADR_M6_CLOCK_POLICY =
  "C-M6-CEIL-N-1000000-OVER-60-GUEST-BOUNDARY-v1";

function m6ClockDueBoundary(index) {
  return (BigInt(index) * 1000000n + 59n) / 60n;
}

async function m6ClockScheduleDigest(eventCount) {
  const bytes = new Uint8Array(16 + eventCount * 16);
  bytes.set(new TextEncoder().encode("CDRM6CLK1"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(12, eventCount, true);
  for (let index = 1; index <= eventCount; index += 1) {
    const offset = 16 + (index - 1) * 16;
    view.setBigUint64(offset, BigInt(index), true);
    view.setBigUint64(offset + 8, m6ClockDueBoundary(index), true);
  }
  return sha256(bytes);
}

function combinedEventBatches(events) {
  const sorted = events.slice().sort((left, right) =>
    left.dueBoundary < right.dueBoundary ? -1 :
      left.dueBoundary > right.dueBoundary ? 1 : left.kind - right.kind);
  const batches = [];
  let batch = [];
  let index = 0;
  while (index < sorted.length) {
    const due = sorted[index].dueBoundary;
    const group = [];
    while (index < sorted.length && sorted[index].dueBoundary === due) {
      group.push(sorted[index++]);
    }
    if (batch.length !== 0 && batch.length + group.length > 64) {
      batches.push(Object.freeze(batch));
      batch = [];
    }
    batch.push(...group);
  }
  if (batch.length !== 0) batches.push(Object.freeze(batch));
  return Object.freeze(batches);
}

function cadetTap(code) {
  return [code, 0x8000];
}

function cadetEncodeCharacter(character) {
    if (character === "\r") return cadetTap(0o136);
    const uppercase = /^[A-Z]$/.test(character);
    const shiftedKey = {
      "#": "3", "%": "5", "*": "8", "(": "(", ")": ")", "\"": "'",
    }[character];
    const key = shiftedKey ?? character.toLowerCase();
    const code = CADET_SCANCODES[key];
    if (code === undefined) {
      throw new TypeError(`form contains unmapped Cadet character ${character}`);
    }
    if (shiftedKey !== undefined || uppercase) {
      return [0o024, code, 0x8001, 0x8000];
    }
    return cadetTap(code);
}

function cadetEncodeText(text) {
  const result = [];
  for (const character of text) {
    result.push(...cadetEncodeCharacter(character));
  }
  return result;
}

function pacedCadetText(text, startBoundary) {
  const events = [];
  let characterStart = startBoundary;
  let inChunk = 0;
  [...text].forEach((character, characterIndex, characters) => {
    const frames = cadetEncodeCharacter(character);
    frames.forEach((scancode, frameIndex) => {
      events.push(Object.freeze({
        scancode,
        dueBoundary: characterStart + m6ClockDueBoundary(frameIndex),
      }));
    });
    inChunk += 1;
    if (characterIndex + 1 !== characters.length) {
      characterStart = events.at(-1).dueBoundary +
        (inChunk === CADR_M6_INPUT_CHUNK_CHARACTERS ?
          CADR_M6_INPUT_CHUNK_PAUSE_BOUNDARIES :
          m6ClockDueBoundary(1));
      if (inChunk === CADR_M6_INPUT_CHUNK_CHARACTERS) inChunk = 0;
    }
  });
  return events;
}

async function validateM6ReleaseRecord(record, enforceSemanticArtifacts) {
  exactKeys(record, [
    "schema", "contract", "target", "identities", "artifacts", "native_inputs",
    "execution_environment", "forms",
    "schedule", "timing", "listener_idle_observer", "clock_schedule", "idle_oracle",
    "expected_debug_writes",
    "native_runs",
  ], "M6 release record");
  if (record.schema !== CADR_M6_RELEASE_RECORD_SCHEMA ||
      record.contract !== CADR_M6_READY_CONTRACT ||
      record.target !== "CADR-WEB-303/ABI1.4/protocol-v4/M6") {
    throw new TypeError("wrong M6 release-record identity");
  }
  exactKeys(record.identities, [
    "system_fossil", "usim_fossil", "oracle_patch_sha256",
    "native_executable_sha256", "cadet_mapping_sha256",
  ], "identities");
  for (const field of ["system_fossil", "usim_fossil",
                       "oracle_patch_sha256", "native_executable_sha256",
                       "cadet_mapping_sha256"]) {
    digestHex(record.identities[field], `identities.${field}`);
  }
  if (record.identities.cadet_mapping_sha256 !==
      CADR_M6_CADET_MAPPING_SHA256) {
    throw new TypeError("release record uses a different Cadet mapping");
  }
  if (!Array.isArray(record.artifacts) || record.artifacts.length !== 5 ||
      record.artifacts.some((item, index) => {
        exactKeys(item, ["kind", "byte_count", "sha256"], `artifacts[${index}]`);
        decimalU64(item.byte_count, `artifacts[${index}].byte_count`);
        digestHex(item.sha256, `artifacts[${index}].sha256`);
        return item.kind !== CADR_M6_REQUIRED_ARTIFACT_KINDS[index];
      })) {
    throw new TypeError("artifacts are not exact ordered kinds 1,2,4,5,3");
  }
  if (enforceSemanticArtifacts &&
      canonicalJson(record.artifacts) !==
        canonicalJson(CADR_M6_SEMANTIC_ARTIFACT_IDENTITIES)) {
    throw new TypeError(
      "artifacts do not match the exact ABI semantic identities for kinds 1,2,4,5,3");
  }
  if (canonicalJson(record.native_inputs) !== canonicalJson(CADR_M6_NATIVE_INPUTS)) {
    throw new TypeError(
      "native_inputs must contain only the exact native Chaos hosts input");
  }
  exactKeys(record.execution_environment, ["policy_id", "inherited", "variables"],
    "execution_environment");
  exactKeys(record.execution_environment.variables, ["LANG", "LC_ALL", "TZ"],
    "execution_environment.variables");
  if (canonicalJson(record.execution_environment) !==
      canonicalJson(CADR_M6_NATIVE_EXECUTION_ENVIRONMENT)) {
    throw new TypeError("release record uses a different native execution environment");
  }
  exactKeys(record.forms, ["a", "b", "c"], "forms");
  for (const [name, magic, words] of [
    ["a", CADR_M6_FORM_A, [0x4d36, 0x4131, 0xa55a]],
    ["b", CADR_M6_FORM_B, [0x4d36, 0x4232, 0x5aa5]],
    ["c", CADR_M6_FORM_C, [0x4d36, 0x4944, 0x4c45]],
  ]) {
    const form = record.forms[name];
    exactKeys(form, ["utf8", "utf8_sha256", "magic48", "words16"], `forms.${name}`);
    if (typeof form.utf8 !== "string" || form.utf8.length === 0 ||
        form.magic48 !== magic.toString(16).padStart(12, "0") ||
        !Array.isArray(form.words16) ||
        form.words16.length !== 3 ||
        form.words16.some((value, index) => value !== words[index])) {
      throw new TypeError(`forms.${name} differs from the frozen form`);
    }
    digestHex(form.utf8_sha256, `forms.${name}.utf8_sha256`);
    if (!sameBytes(
      await sha256(new TextEncoder().encode(form.utf8)),
      hexBytes(form.utf8_sha256))) {
      throw new TypeError(`forms.${name}.utf8_sha256 mismatch`);
    }
    if (name === "c" && form.utf8_sha256 !== CADR_M6_FORM_C_UTF8_SHA256) {
      throw new TypeError("forms.c differs from the frozen Listener-idle observer");
    }
  }
  const schedule = record.schedule;
  exactKeys(schedule, [
    "schema", "sha256", "event_count", "pre_a_batches", "post_a_batches",
  ], "schedule");
  if (schedule.schema !== "cadr-m6-raw-cadet-boundary-schedule-v1" ||
      !Number.isSafeInteger(schedule.event_count) || schedule.event_count <= 0 ||
      !Array.isArray(schedule.pre_a_batches) ||
      !Array.isArray(schedule.post_a_batches) ||
      schedule.pre_a_batches.length === 0 || schedule.post_a_batches.length === 0) {
    throw new TypeError("invalid frozen M6 schedule");
  }
  let prior = -1n;
  let expectedIndex = 0;
  const parseBatches = (batches, postA) => Object.freeze(batches.map(
    (batch, batchIndex) => {
      if (!Array.isArray(batch) || batch.length === 0 || batch.length > 64) {
        throw new TypeError(`schedule batch ${batchIndex} is not 1..64 events`);
      }
      return Object.freeze(batch.map(event => {
        exactKeys(event, ["index", "phase", "due_boundary", "scancode"],
          `schedule event ${expectedIndex}`);
        const dueBoundary = decimalU64(
          event.due_boundary, `schedule event ${expectedIndex}.due_boundary`);
        if (event.index !== expectedIndex || dueBoundary <= prior ||
            !unsigned32(event.scancode) || event.scancode > 0xffff ||
            !(postA ? event.phase === "form-b" :
              ["boot", "form-a"].includes(event.phase))) {
          throw new TypeError(`schedule event ${expectedIndex} is not canonical`);
        }
        prior = dueBoundary;
        expectedIndex += 1;
        return Object.freeze({
          dueBoundary,
          scancode: event.scancode,
          phase: event.phase,
          index: event.index,
        });
      }));
    }));
  const keyboardPreABatches = parseBatches(schedule.pre_a_batches, false);
  const keyboardPostABatches = parseBatches(schedule.post_a_batches, true);
  if (expectedIndex !== schedule.event_count) {
    throw new TypeError("schedule event_count does not consume the exact tree");
  }
  exactKeys(record.timing, [
    "clock_policy", "initial_return_boundary", "form_a_start_boundary",
    "form_b_hold_boundaries", "input_chunk_characters",
    "input_chunk_pause_boundaries", "intra_chunk_frame_policy",
    "listener_idle_c_timeout_boundaries",
    "listener_idle_c_cleanup_hold_boundaries",
  ], "timing");
  if (record.timing.clock_policy !== "ceil(n*1000000/60)" ||
      record.timing.initial_return_boundary !== "25000000" ||
      record.timing.form_a_start_boundary !==
        CADR_M6_FORM_A_START_BOUNDARY.toString() ||
      record.timing.form_b_hold_boundaries !==
        CADR_M6_FORM_B_HOLD_BOUNDARIES.toString() ||
      record.timing.input_chunk_characters !==
        CADR_M6_INPUT_CHUNK_CHARACTERS ||
      record.timing.input_chunk_pause_boundaries !==
        CADR_M6_INPUT_CHUNK_PAUSE_BOUNDARIES.toString() ||
      record.timing.intra_chunk_frame_policy !== "ceil(n*1000000/60)" ||
      record.timing.listener_idle_c_timeout_boundaries !==
        CADR_M6_LISTENER_IDLE_C_TIMEOUT_BOUNDARIES.toString() ||
      record.timing.listener_idle_c_cleanup_hold_boundaries !==
        CADR_M6_LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES.toString()) {
    throw new TypeError("timing differs from the frozen paced input policy");
  }
  if (canonicalJson(record.listener_idle_observer) !==
      canonicalJson(CADR_M6_LISTENER_IDLE_OBSERVER)) {
    throw new TypeError("listener_idle_observer differs from the exact Form-C contract");
  }
  const flatInitial = keyboardPreABatches.flat();
  const bootPrefix = [
    0o136, 0x8000,
    0o024, 0o054, 0x8001, 0x8000,
    0o136, 0x8000,
  ];
  if (flatInitial.length < bootPrefix.length ||
      bootPrefix.some((value, index) =>
        flatInitial[index].phase !== "boot" ||
        flatInitial[index].scancode !== value)) {
    throw new TypeError("M6 schedule omits exact Return,N,Return boot prefix");
  }
  const exactPreA = bootPrefix.concat(
    cadetEncodeText(record.forms.a.utf8), cadetTap(0o136));
  const exactPostA = cadetEncodeText(record.forms.b.utf8).concat(cadetTap(0o136));
  const flatPostA = keyboardPostABatches.flat();
  if (flatInitial.length !== exactPreA.length ||
      flatPostA.length !== exactPostA.length ||
      flatInitial.some((event, index) => event.scancode !== exactPreA[index]) ||
      flatPostA.some((event, index) => event.scancode !== exactPostA[index])) {
    throw new TypeError(
      "schedule scancodes do not encode the exact frozen Form A/B UTF-8");
  }
  const scheduleForHash = { ...schedule };
  delete scheduleForHash.sha256;
  const computedSchedule = await sha256(
    new TextEncoder().encode(canonicalJson(scheduleForHash)));
  if (digestHex(schedule.sha256, "schedule.sha256") !==
      [...computedSchedule].map(value => value.toString(16).padStart(2, "0")).join("")) {
    throw new TypeError("schedule.sha256 does not match canonical schedule bytes");
  }
  const clock = record.clock_schedule;
  exactKeys(clock, [
    "policy_id", "formula", "numerator", "denominator",
    "event_count", "transcript_sha256",
  ], "clock_schedule");
  if (clock.policy_id !== CADR_M6_CLOCK_POLICY ||
      clock.formula !== "due(n)=ceil(n*1000000/60), n=1..event_count" ||
      clock.numerator !== 1000000 || clock.denominator !== 60 ||
      !Number.isSafeInteger(clock.event_count) || clock.event_count <= 0 ||
      digestHex(clock.transcript_sha256,
        "clock_schedule.transcript_sha256") !==
        [...await m6ClockScheduleDigest(clock.event_count)].map(
          value => value.toString(16).padStart(2, "0")).join("")) {
    throw new TypeError("clock_schedule differs from the frozen M5 rational policy");
  }
  const idle = record.idle_oracle;
  exactKeys(idle, [
    "wire_schema", "sample_bytes", "sample_count",
    "first_boundary_delta_from_settled", "samples_sha256", "samples",
  ], "idle_oracle");
  if (idle.wire_schema !== "CDRM6I1" || idle.sample_bytes !== 96 ||
      idle.sample_count !== 64 ||
      !Array.isArray(idle.samples) || idle.samples.length !== idle.sample_count ||
      idle.samples.some(sample => typeof sample !== "string" ||
        !/^[0-9a-f]{192}$/.test(sample))) {
    throw new TypeError("idle_oracle is not an exact CDRM6I1 suffix");
  }
  const idleSampleBytes = idle.samples.map((sample, index) => {
    const bytes = hexBytes96(sample);
    const view = new DataView(bytes.buffer);
    if (new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRM6I1" ||
        bytes[7] !== 0 || view.getBigUint64(8, true) !== CADR_M6_FORM_C ||
        (view.getBigUint64(16, true) >> 48n) !== 0n ||
        (view.getBigUint64(24, true) >> 48n) !== 0n ||
        (view.getUint32(60, true) & (1 << 5)) !== 0 ||
        view.getUint32(64, true) !== 0 ||
        view.getUint32(68, true) !== 0x18000 ||
        view.getUint32(72, true) !== 3 ||
        view.getUint32(76, true) !== 0 ||
        view.getUint32(80, true) !== 0 ||
        view.getUint32(84, true) !== 1 ||
        view.getUint32(88, true) !== 0 ||
        view.getUint32(92, true) !== 0) {
      throw new TypeError(`idle_oracle.samples[${index}] is not quiescent Form C`);
    }
    return bytes;
  });
  if (decimalU64(idle.first_boundary_delta_from_settled,
    "idle_oracle.first_boundary_delta_from_settled") !== 1n) {
    throw new TypeError("idle_oracle must begin exactly one boundary after settled");
  }
  digestHex(idle.samples_sha256, "idle_oracle.samples_sha256");
  const sampleBytes = Uint8Array.from(
    idleSampleBytes.flatMap(sample => [...sample]));
  if (!sameBytes(await sha256(sampleBytes), hexBytes(idle.samples_sha256))) {
    throw new TypeError("idle_oracle.samples_sha256 mismatch");
  }
  if (!Array.isArray(record.expected_debug_writes) ||
      record.expected_debug_writes.length !== 9) {
    throw new TypeError("expected_debug_writes must contain nine writes");
  }
  const expectedAddresses = [0o766000, 0o766002, 0o766004,
                             0o766000, 0o766002, 0o766004,
                             0o766000, 0o766002, 0o766004];
  const expectedValues = [0x4d36, 0x4131, 0xa55a, 0x4d36, 0x4232, 0x5aa5,
                          0x4d36, 0x4944, 0x4c45];
  record.expected_debug_writes.forEach((write, index) => {
    exactKeys(write, ["address", "value"], `expected_debug_writes[${index}]`);
    if (write.address !== expectedAddresses[index] ||
        write.value !== expectedValues[index]) {
      throw new TypeError("expected_debug_writes differs from A then B then C");
    }
  });
  if (!Array.isArray(record.native_runs) || record.native_runs.length !== 3) {
    throw new TypeError("native_runs must contain exactly three runs");
  }
  const sessions = new Set();
  const disks = new Set();
  const captures = new Set();
  let nativeABoundary = null;
  let nativeBBoundary = null;
  let nativeListenerIdleCBoundary = null;
  let nativeListenerIdleSettledBoundary = null;
  record.native_runs.forEach((run, index) => {
    exactKeys(run, [
      "session_id", "private_disk_instance_id", "capture_sha256",
      "input_transcript_sha256", "debug_write_transcript_sha256",
      "private_disk_sha256_at_start", "private_disk_sha256_at_end",
      "a_boundary", "b_boundary", "listener_idle_c_boundary",
      "listener_idle_settled_boundary", "suffix_first_boundary", "suffix_sha256",
      "schedule_consumed", "unexpected_input_count",
      "forbidden_debug_write_count", "forced_stop", "state_may_be_incomplete",
    ], `native_runs[${index}]`);
    const a = decimalU64(run.a_boundary, `native_runs[${index}].a_boundary`);
    const b = decimalU64(run.b_boundary, `native_runs[${index}].b_boundary`);
    const c = decimalU64(run.listener_idle_c_boundary,
      `native_runs[${index}].listener_idle_c_boundary`);
    const settled = decimalU64(run.listener_idle_settled_boundary,
      `native_runs[${index}].listener_idle_settled_boundary`);
    const suffix = decimalU64(
      run.suffix_first_boundary, `native_runs[${index}].suffix_first_boundary`);
    if (typeof run.session_id !== "string" || run.session_id.length === 0 ||
        typeof run.private_disk_instance_id !== "string" ||
        run.private_disk_instance_id.length === 0 ||
        sessions.has(run.session_id) || disks.has(run.private_disk_instance_id) ||
        !(a < b && b < c && c < settled && settled < suffix) ||
        c > b + CADR_M6_LISTENER_IDLE_C_TIMEOUT_BOUNDARIES ||
        settled !== c + CADR_M6_LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES ||
        suffix !== settled +
          BigInt(idle.first_boundary_delta_from_settled) ||
        run.schedule_consumed !== true ||
        run.unexpected_input_count !== 0 ||
        run.forbidden_debug_write_count !== 0 || run.forced_stop !== false ||
        run.state_may_be_incomplete !== false ||
        run.suffix_sha256 !== idle.samples_sha256) {
      throw new TypeError(`native_runs[${index}] is not a fresh clean run`);
    }
    sessions.add(run.session_id);
    disks.add(run.private_disk_instance_id);
    if (nativeABoundary === null) {
      nativeABoundary = a;
      nativeBBoundary = b;
      nativeListenerIdleCBoundary = c;
      nativeListenerIdleSettledBoundary = settled;
    } else if (a !== nativeABoundary || b !== nativeBBoundary ||
               c !== nativeListenerIdleCBoundary ||
               settled !== nativeListenerIdleSettledBoundary) {
      throw new TypeError("native runs disagree on A/B/C/settled boundaries");
    }
    for (const field of [
      "capture_sha256", "input_transcript_sha256",
      "debug_write_transcript_sha256", "private_disk_sha256_at_start",
      "private_disk_sha256_at_end", "suffix_sha256",
    ]) digestHex(run[field], `native_runs[${index}].${field}`);
    if (run.private_disk_sha256_at_start !==
          run.private_disk_sha256_at_end) {
      throw new TypeError("native run changed its private disk");
    }
    if (captures.has(run.capture_sha256)) {
      throw new TypeError("native runs reuse one capture transcript");
    }
    captures.add(run.capture_sha256);
  });
  const exactOffset = index => (BigInt(index) * 1000000n + 59n) / 60n;
  const requireOffsets = (events, anchor, label) => {
    events.forEach((event, index) => {
      if (event.dueBoundary !== anchor + exactOffset(index)) {
        throw new TypeError(`${label} does not use frozen rational offsets`);
      }
    });
  };
  requireOffsets(flatInitial.slice(0, 2), 25000000n, "initial Return");
  requireOffsets(flatInitial.slice(2, 8), 27000000n, "N and Return");
  const formAEvents = flatInitial.slice(8);
  const expectedFormA = pacedCadetText(
    `${record.forms.a.utf8}\r`, CADR_M6_FORM_A_START_BOUNDARY);
  const expectedFormB = pacedCadetText(
    `${record.forms.b.utf8}\r`,
    expectedFormA.at(-1).dueBoundary + CADR_M6_FORM_B_HOLD_BOUNDARIES);
  for (const [actual, expected, label] of [
    [formAEvents, expectedFormA, "Form A"],
    [flatPostA, expectedFormB, "Form B"],
  ]) {
    if (actual.length !== expected.length ||
        actual.some((event, index) =>
          event.scancode !== expected[index].scancode ||
          event.dueBoundary !== expected[index].dueBoundary)) {
      throw new TypeError(
        `${label} does not use the frozen 16-character paced schedule`);
    }
  }
  if (formAEvents[formAEvents.length - 1].dueBoundary >= nativeABoundary ||
      nativeABoundary >= flatPostA[0].dueBoundary ||
      flatPostA[flatPostA.length - 1].dueBoundary >= nativeBBoundary ||
      nativeBBoundary >= nativeListenerIdleCBoundary) {
    throw new TypeError("native A/B/C boundary precedes complete form input");
  }
  const suffixFinalBoundary = nativeListenerIdleSettledBoundary +
    BigInt(idle.first_boundary_delta_from_settled) +
    BigInt(idle.sample_count - 1);
  const expectedClockCount = Number(
    (suffixFinalBoundary * 60n) / 1000000n);
  if (clock.event_count !== expectedClockCount) {
    throw new TypeError(
      "clock_schedule count does not cover exactly through the idle suffix");
  }
  const clockEvents = Object.freeze(Array.from(
    { length: clock.event_count }, (_, index) => Object.freeze({
      kind: 2,
      dueBoundary: m6ClockDueBoundary(index + 1),
      value: 1,
    })));
  const keyboardPre = flatInitial.map(event => Object.freeze({
    ...event, kind: 3, value: event.scancode,
  }));
  const keyboardPost = flatPostA.map(event => Object.freeze({
    ...event, kind: 3, value: event.scancode,
  }));
  const initialEventBatches = combinedEventBatches([
    ...clockEvents.filter(event => event.dueBoundary <= nativeABoundary),
    ...keyboardPre,
  ]);
  const formBEventBatches = combinedEventBatches([
    ...clockEvents.filter(event =>
      event.dueBoundary > nativeABoundary &&
      event.dueBoundary <= nativeBBoundary),
    ...keyboardPost,
  ]);
  const idleClockEvents = Object.freeze(clockEvents.filter(event =>
    event.dueBoundary > nativeBBoundary));
  return Object.freeze({
    ...record,
    releaseRecord: record,
    initialEventBatches,
    formBEventBatches,
    idleClockEvents,
    idleSamples: Object.freeze(idleSampleBytes),
    nativeABoundary,
    nativeBBoundary,
    nativeListenerIdleCBoundary,
    nativeListenerIdleSettledBoundary,
    formBFirstDueBoundary: flatPostA[0].dueBoundary,
  });
}

export async function validateSyntheticM6ReleaseRecord(record) {
  return validateM6ReleaseRecord(record, true);
}

export async function canonicalM6ReadyWitness({
  releaseRecord,
  artifactSetSha256,
  privateDiskBaseSha256,
  formABoundary,
  formBBoundary,
  listenerIdleCBoundary,
  listenerIdleSettledBoundary,
  readyBoundary,
  cdrstate5Sha256,
  cdrm5q1Sha256,
  hostTranscriptSha256,
}) {
  const record = await validateSyntheticM6ReleaseRecord(releaseRecord);
  return canonicalM6ReadyWitnessFromValidatedRecord({
    record, releaseRecord, artifactSetSha256, privateDiskBaseSha256,
    formABoundary, formBBoundary, listenerIdleCBoundary,
    listenerIdleSettledBoundary, readyBoundary, cdrstate5Sha256,
    cdrm5q1Sha256, hostTranscriptSha256,
  });
}

/* Synthetic records deliberately admit tiny fixture artifacts. Keep that
 * flexibility behind an explicitly test-only witness entrypoint so production
 * summary serialization cannot inherit it. */
export async function canonicalSyntheticM6ReadyWitnessForTest({
  releaseRecord,
  artifactSetSha256,
  privateDiskBaseSha256,
  formABoundary,
  formBBoundary,
  listenerIdleCBoundary,
  listenerIdleSettledBoundary,
  readyBoundary,
  cdrstate5Sha256,
  cdrm5q1Sha256,
  hostTranscriptSha256,
}) {
  const record = await validateM6ReleaseRecord(releaseRecord, false);
  return canonicalM6ReadyWitnessFromValidatedRecord({
    record, releaseRecord, artifactSetSha256, privateDiskBaseSha256,
    formABoundary, formBBoundary, listenerIdleCBoundary,
    listenerIdleSettledBoundary, readyBoundary, cdrstate5Sha256,
    cdrm5q1Sha256, hostTranscriptSha256,
  });
}

async function canonicalM6ReadyWitnessFromValidatedRecord({
  record,
  releaseRecord,
  artifactSetSha256,
  privateDiskBaseSha256,
  formABoundary,
  formBBoundary,
  listenerIdleCBoundary,
  listenerIdleSettledBoundary,
  readyBoundary,
  cdrstate5Sha256,
  cdrm5q1Sha256,
  hostTranscriptSha256,
}) {
  const release = await sha256(
    new TextEncoder().encode(canonicalJson(releaseRecord)));
  return canonicalM6ReadyWitnessV3({
    releaseRecordSha256: release,
    artifactSetSha256,
    privateDiskBaseSha256,
    formABoundary,
    formBBoundary,
    listenerIdleCBoundary,
    listenerIdleSettledBoundary,
    readyBoundary,
    cdrstate5Sha256,
    cdrm5q1Sha256,
    hostTranscriptSha256,
    nativeABoundary: record.nativeABoundary,
    nativeBBoundary: record.nativeBBoundary,
    nativeListenerIdleCBoundary: record.nativeListenerIdleCBoundary,
    nativeListenerIdleSettledBoundary: record.nativeListenerIdleSettledBoundary,
    nativeReadyBoundary: record.nativeListenerIdleSettledBoundary +
      BigInt(record.idle_oracle.first_boundary_delta_from_settled) +
      BigInt(record.idle_oracle.sample_count) - 1n,
  });
}

async function canonicalM6ReadyWitnessV3({
  releaseRecordSha256,
  artifactSetSha256,
  privateDiskBaseSha256,
  formABoundary,
  formBBoundary,
  listenerIdleCBoundary,
  listenerIdleSettledBoundary,
  readyBoundary,
  cdrstate5Sha256,
  cdrm5q1Sha256,
  hostTranscriptSha256,
  nativeABoundary = formABoundary,
  nativeBBoundary = formBBoundary,
  nativeListenerIdleCBoundary = listenerIdleCBoundary,
  nativeListenerIdleSettledBoundary = listenerIdleSettledBoundary,
  nativeReadyBoundary = readyBoundary,
}) {
  const release = bytesOf(releaseRecordSha256);
  const artifacts = bytesOf(artifactSetSha256);
  const diskBase = bytesOf(privateDiskBaseSha256);
  const state = bytesOf(cdrstate5Sha256);
  const queue = bytesOf(cdrm5q1Sha256);
  const host = bytesOf(hostTranscriptSha256);
  if (release?.byteLength !== 32 ||
      !unsigned64(formABoundary) || !unsigned64(formBBoundary) ||
      !unsigned64(listenerIdleCBoundary) ||
      !unsigned64(listenerIdleSettledBoundary) ||
      !unsigned64(readyBoundary) ||
      formABoundary >= formBBoundary ||
      formBBoundary >= listenerIdleCBoundary ||
      listenerIdleCBoundary >= listenerIdleSettledBoundary ||
      listenerIdleSettledBoundary >= readyBoundary ||
      formABoundary !== nativeABoundary ||
      formBBoundary !== nativeBBoundary ||
      listenerIdleCBoundary !== nativeListenerIdleCBoundary ||
      listenerIdleSettledBoundary !== nativeListenerIdleSettledBoundary ||
      readyBoundary !== nativeReadyBoundary ||
      artifacts?.byteLength !== 32 || diskBase?.byteLength !== 32 ||
      state?.byteLength !== 32 ||
      queue?.byteLength !== 32 ||
      host?.byteLength !== 32) {
    throw new TypeError("invalid canonical M6 READY witness inputs");
  }
  const domain = new TextEncoder().encode("CDRM6READY3");
  const bytes = new Uint8Array(domain.byteLength + 6 * 32 + 10 * 8);
  bytes.set(domain, 0);
  let offset = domain.byteLength;
  for (const digest of [release, artifacts, diskBase]) {
    bytes.set(digest, offset);
    offset += 32;
  }
  const view = new DataView(bytes.buffer);
  for (const boundary of [
    formABoundary, formBBoundary, listenerIdleCBoundary,
    listenerIdleSettledBoundary, readyBoundary,
    nativeABoundary, nativeBBoundary, nativeListenerIdleCBoundary,
    nativeListenerIdleSettledBoundary, nativeReadyBoundary,
  ]) {
    view.setBigUint64(offset, boundary, true);
    offset += 8;
  }
  for (const digest of [state, queue, host]) {
    bytes.set(digest, offset);
    offset += 32;
  }
  return sha256(bytes);
}

/* READY4 is intentionally an additional binding: the existing READY3 digest
 * remains frozen, while this new preimage commits the selected M6 evidence
 * policy, its maximum, one exact CDRM6E1 record, and the independently
 * recomputable settled-checkpoint and reason-3 host-wait chains. */
export async function canonicalM6ReadyWitnessV4({
  ready3Witness,
  target = CADR_M6_DEVID_PROFILE,
  policyId = CADR_M6_DEVID_POLICY_ID,
  selectedMaximum,
  cdrm6e1Sha256,
  checkpointCount,
  checkpointChainSha256,
  hostWaitCount,
  hostWaitChainSha256,
}) {
  const ready3 = bytesOf(ready3Witness);
  const summary = bytesOf(cdrm6e1Sha256);
  const checkpoint = bytesOf(checkpointChainSha256);
  const hostWait = bytesOf(hostWaitChainSha256);
  if (ready3?.byteLength !== 32 || summary?.byteLength !== 32 ||
      checkpoint?.byteLength !== 32 || hostWait?.byteLength !== 32 ||
      target !== CADR_M6_DEVID_PROFILE || policyId !== CADR_M6_DEVID_POLICY_ID ||
      !unsigned64(selectedMaximum) ||
      !Number.isSafeInteger(checkpointCount) || checkpointCount < 1 ||
      !Number.isSafeInteger(hostWaitCount) || hostWaitCount < 0 ||
      selectedMaximum === 0n || selectedMaximum > 0x7fffffffffffffffn) {
    throw new TypeError("invalid M6 READY4 disk-evidence binding");
  }
  const domain = new TextEncoder().encode("CDRM6READY4-CHAINS1");
  const targetBytes = new TextEncoder().encode(`${target}\0`);
  const policy = new TextEncoder().encode(`${policyId}\0`);
  const bytes = new Uint8Array(domain.byteLength + ready3.byteLength +
    targetBytes.byteLength + policy.byteLength + 8 + summary.byteLength + 8 + 32 + 8 + 32);
  bytes.set(domain, 0);
  bytes.set(ready3, domain.byteLength);
  bytes.set(targetBytes, domain.byteLength + ready3.byteLength);
  bytes.set(policy, domain.byteLength + ready3.byteLength + targetBytes.byteLength);
  new DataView(bytes.buffer).setBigUint64(
    domain.byteLength + ready3.byteLength + targetBytes.byteLength + policy.byteLength,
    selectedMaximum, true);
  bytes.set(summary, domain.byteLength + ready3.byteLength + targetBytes.byteLength +
    policy.byteLength + 8);
  let offset = domain.byteLength + ready3.byteLength + targetBytes.byteLength +
    policy.byteLength + 8 + summary.byteLength;
  const view = new DataView(bytes.buffer);
  view.setBigUint64(offset, BigInt(checkpointCount), true); offset += 8;
  bytes.set(checkpoint, offset); offset += 32;
  view.setBigUint64(offset, BigInt(hostWaitCount), true); offset += 8;
  bytes.set(hostWait, offset);
  return sha256(bytes);
}

async function validateReadyContract(ready) {
  if (ready === null || typeof ready !== "object" ||
      ready.contract !== CADR_M6_READY_CONTRACT ||
      containsExecutable(ready)) {
    throw new TypeError("M6 READY requires the fixed ABC Listener-ready semantic contract");
  }
  if (CADR_M6_RELEASE_RECORD_SHA256 === null) {
    const error = new Error(
      "the frozen native-derived M6 release record is not available");
    error.reason = "native-release-record-unavailable";
    throw error;
  }
  const recordBytes = bytesOf(ready.releaseRecord);
  if (recordBytes === null ||
      !sameBytes(await sha256(recordBytes), CADR_M6_RELEASE_RECORD_SHA256)) {
    throw new TypeError("M6 release record differs from the compiled digest");
  }
  let record;
  try {
    record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(recordBytes));
  } catch {
    throw new TypeError("M6 release record is not canonical UTF-8 JSON");
  }
  const canonical = new TextEncoder().encode(canonicalJson(record));
  if (!sameBytes(recordBytes, canonical)) {
    throw new TypeError("M6 release record JSON is not recursively canonical");
  }
  return validateSyntheticM6ReleaseRecord(record);
}

function validateSchedulerBatch(batch, boundary, generation) {
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > 64) {
    throw new TypeError("M6 keyboard batch must contain 1..64 events");
  }
  let priorDue = null;
  let priorKind = null;
  for (const event of batch) {
    if (event === null || typeof event !== "object" ||
        ![2, 3].includes(event.kind) ||
        event.flags !== 0 || event.reserved0 !== 0 ||
        !unsigned64(event.dueTick) || event.dueTick <= boundary ||
        event.generation !== generation || !unsigned32(event.value) ||
        (event.kind === 2 ? event.value !== 1 : event.value > 0xffff) ||
        (priorDue !== null &&
         (event.dueTick < priorDue ||
          (event.dueTick === priorDue && !(priorKind === 2 && event.kind === 3))))) {
      throw new TypeError("M6 input is not the canonical clock/keyboard schedule");
    }
    priorDue = event.dueTick;
    priorKind = event.kind;
  }
}

async function scheduleInputBatch(client, batches, state, witness) {
  if (state.batchIndex >= batches.length || witness.schedulerPendingCount !== 0) {
    return;
  }
  const batch = batches[state.batchIndex].map(event => ({
    kind: event.kind ?? 3,
    flags: 0,
    dueTick: event.dueBoundary ?? event.dueTick,
    generation: witness.generation,
    value: event.value ?? event.scancode,
    reserved0: 0,
  }));
  validateSchedulerBatch(batch, witness.boundary, witness.generation);
  const response = await workerOk(client, "scheduler-events", { events: batch });
  if (response.delivered !== batch.length) {
    throw new Error("worker did not accept the complete M6 keyboard batch");
  }
  state.batchIndex += 1;
}

async function scheduleIdleClocks(client, ready, state, witness, target) {
  const events = [];
  while (state.idleClockIndex < ready.idleClockEvents.length &&
         ready.idleClockEvents[state.idleClockIndex].dueBoundary <= target &&
         events.length < 64) {
    const event = ready.idleClockEvents[state.idleClockIndex++];
    if (event.dueBoundary <= witness.boundary) {
      throw new Error("M6 missed an idle clock event");
    }
    events.push({
      kind: 2, flags: 0, dueTick: event.dueBoundary,
      generation: witness.generation, value: 1, reserved0: 0,
    });
  }
  if (events.length === 0) return;
  validateSchedulerBatch(events, witness.boundary, witness.generation);
  const response = await workerOk(client, "scheduler-events", { events });
  if (response.delivered !== events.length) {
    throw new Error("worker did not accept exact idle clock events");
  }
}

function validBootWitness(value) {
  const sample = bytesOf(value?.sample);
  return value !== null && typeof value === "object" &&
    value.wireSchema === "CDRM6I1" &&
    sample?.byteLength === 96 &&
    unsigned64(value.debugInstruction) &&
    value.debugInstruction <= 0xffffffffffffn &&
    unsigned64(value.boundary) && unsigned64(value.generation) &&
    unsigned32(value.coreLifecycle) &&
    unsigned32(value.persistentStatus) &&
    unsigned64(value.lastCompletedRequestId) &&
    unsigned64(value.outstandingRequestId) &&
    unsigned32(value.schedulerPendingCount) &&
    unsigned32(value.schedulerPhase) &&
    unsigned32(value.iobCsr) && unsigned32(value.iobFifoCount) &&
    unsigned32(value.iobScancode) &&
    unsigned32(value.outstandingOperation) &&
    unsigned32(value.diskInterruptRequest) &&
    unsigned32(value.hostRequestPending) &&
    unsigned32(value.hostCompletionQueued) &&
    unsigned32(value.diskTransferActive) && unsigned32(value.diskStatus) &&
    unsigned64(value.expectedCompletionByteCount) &&
    unsigned64(value.completionByteCount) &&
    typeof value.boundaryPendingHost === "boolean" &&
    typeof value.runActive === "boolean" &&
    unsigned32(value.deferredControlCount) &&
    typeof value.mediaBusy === "boolean" &&
    typeof value.mediaDirty === "boolean" &&
    typeof value.mediaSnapshotBlocked === "boolean" &&
    unsigned64(value.mediaOverlayGeneration) &&
    typeof value.visibilityInitialized === "boolean" &&
    typeof value.hidden === "boolean";
}

function quiescentBootWitness(witness) {
  return witness.schedulerPendingCount === 0 &&
    witness.schedulerPhase === 0 &&
    witness.coreLifecycle === 2 &&
    witness.persistentStatus === CADR_STATUS_OK &&
    (witness.iobCsr & (1 << 5)) === 0 &&
    witness.iobFifoCount === 0 &&
    witness.iobScancode === 0x18000 &&
    witness.outstandingRequestId === 0n &&
    witness.outstandingOperation === 0 &&
    witness.diskInterruptRequest === 1 &&
    witness.hostRequestPending === 0 &&
    witness.hostCompletionQueued === 0 &&
    witness.boundaryPendingHost === false &&
    witness.runActive === false &&
    witness.deferredControlCount === 0 &&
    witness.mediaBusy === false &&
    witness.mediaSnapshotBlocked === false &&
    witness.visibilityInitialized === true &&
    witness.hidden === false &&
    witness.diskTransferActive === 0 &&
    witness.diskStatus === 3 &&
    witness.expectedCompletionByteCount === 0n &&
    witness.completionByteCount === 0n;
}

async function observeReadyContract(ready, context, client) {
  const witness = await workerOk(client, "boot-witness");
  if (!validBootWitness(witness) || witness.boundary !== context.boundary) {
    throw new TypeError("malformed or wrong-boundary M6 boot witness");
  }
  const state = context.readyState;
  if (state.phase === "await-a") {
    if (witness.debugInstruction === 0n) {
      await scheduleInputBatch(
        client, ready.initialEventBatches, state.initial, witness);
      return null;
    }
    if (witness.debugInstruction !== CADR_M6_FORM_A ||
        state.initial.batchIndex !== ready.initialEventBatches.length ||
        witness.boundary !== ready.nativeABoundary ||
        !quiescentBootWitness(witness)) {
      throw new Error("premature, partial, or nonquiescent Form A witness");
    }
    state.formABoundary = witness.boundary;
    state.phase = "await-b";
    await scheduleInputBatch(client, ready.formBEventBatches, state.formB, witness);
    return null;
  }
  if (state.phase === "await-b") {
    if (!state.formBInputBoundaryReached) {
      if (witness.boundary > ready.formBFirstDueBoundary) {
        throw new Error("M6 overshot first Form B input boundary");
      }
      if (witness.boundary === ready.formBFirstDueBoundary) {
        state.formBInputBoundaryReached = true;
      }
    }
    if (witness.debugInstruction === CADR_M6_FORM_A) {
      await scheduleInputBatch(client, ready.formBEventBatches, state.formB, witness);
      return null;
    }
    if (witness.debugInstruction !== CADR_M6_FORM_B ||
        state.formB.batchIndex !== ready.formBEventBatches.length ||
        witness.boundary !== ready.nativeBBoundary ||
        !quiescentBootWitness(witness)) {
      throw new Error("Form B was premature, partial, or nonquiescent");
    }
    state.formBBoundary = witness.boundary;
    state.phase = "await-c";
    await scheduleIdleClocks(
      client, ready, state, witness,
      ready.nativeListenerIdleCBoundary);
    return null;
  }
  if (state.phase === "await-c") {
    if (witness.boundary < ready.nativeListenerIdleCBoundary) {
      if (witness.debugInstruction !== CADR_M6_FORM_B ||
          !quiescentBootWitness(witness)) {
        throw new Error("pre-Form-C observer state was not retained Form B");
      }
      await scheduleIdleClocks(
        client, ready, state, witness, ready.nativeListenerIdleCBoundary);
      return null;
    }
    if (witness.debugInstruction !== CADR_M6_FORM_C ||
        witness.boundary !== ready.nativeListenerIdleCBoundary ||
        !quiescentBootWitness(witness)) {
      throw new Error("Listener-idle Form C was missing, reordered, or nonquiescent");
    }
    state.listenerIdleCBoundary = witness.boundary;
    state.phase = "await-settled";
    await scheduleIdleClocks(
      client, ready, state, witness, ready.nativeListenerIdleSettledBoundary);
    return null;
  }
  if (state.phase === "await-settled") {
    if (witness.boundary < ready.nativeListenerIdleSettledBoundary) {
      if (witness.debugInstruction !== CADR_M6_FORM_C ||
          !quiescentBootWitness(witness)) {
        throw new Error("Form-C cleanup hold did not retain the C witness");
      }
      await scheduleIdleClocks(
        client, ready, state, witness, ready.nativeListenerIdleSettledBoundary);
      return null;
    }
    if (witness.debugInstruction !== CADR_M6_FORM_C ||
        witness.boundary !== ready.nativeListenerIdleSettledBoundary ||
        !quiescentBootWitness(witness)) {
      throw new Error("Listener-idle cleanup hold was missing or nonquiescent");
    }
    state.listenerIdleSettledBoundary = witness.boundary;
    state.phase = "suffix";
    await scheduleIdleClocks(
      client, ready, state, witness,
      witness.boundary +
        BigInt(ready.idle_oracle.first_boundary_delta_from_settled));
    return null;
  }
  if (state.phase !== "suffix" || witness.debugInstruction !== CADR_M6_FORM_C ||
      !quiescentBootWitness(witness)) {
    throw new Error("post-Form-C input or device residue");
  }
  const first = state.listenerIdleSettledBoundary +
    BigInt(ready.idle_oracle.first_boundary_delta_from_settled);
  if (state.idleIndex === 0 && witness.boundary < first) return null;
  const expectedBoundary = state.idleIndex === 0 ?
    first : state.idleLastBoundary + 1n;
  if (witness.boundary !== expectedBoundary ||
      !sameBytes(bytesOf(witness.sample), ready.idleSamples[state.idleIndex])) {
    throw new Error("Wasm CDRM6I1 suffix differs from frozen native bytes");
  }
  state.idleLastBoundary = witness.boundary;
  state.idleIndex += 1;
  if (state.idleIndex !== ready.idleSamples.length) {
    await scheduleIdleClocks(
      client, ready, state, witness, witness.boundary + 1n);
    return null;
  }
  if (state.idleClockIndex !== ready.idleClockEvents.length) {
    throw new Error("M6 READY left unconsumed clock events");
  }
  return Object.freeze({
    contract: ready.contract,
    formA: CADR_M6_FORM_A,
    formB: CADR_M6_FORM_B,
    formC: CADR_M6_FORM_C,
    formABoundary: state.formABoundary,
    formBBoundary: state.formBBoundary,
    listenerIdleCBoundary: state.listenerIdleCBoundary,
    listenerIdleSettledBoundary: state.listenerIdleSettledBoundary,
  });
}

function nextUnscheduledInputBoundary(ready, state) {
  let batches;
  let index;
  if (state.phase === "await-a") {
    batches = ready.initialEventBatches;
    index = state.initial.batchIndex;
  } else if (state.phase === "await-b") {
    batches = ready.formBEventBatches;
    index = state.formB.batchIndex;
  } else {
    const target = state.phase === "await-c" ?
      ready.nativeListenerIdleCBoundary :
      state.phase === "await-settled" ?
        ready.nativeListenerIdleSettledBoundary :
        state.phase === "suffix" ?
          (state.idleIndex === 0 ?
            state.listenerIdleSettledBoundary +
              BigInt(ready.idle_oracle.first_boundary_delta_from_settled) :
            state.idleLastBoundary + 1n) : null;
    const next = ready.idleClockEvents[state.idleClockIndex];
    if (target !== null && next !== undefined && next.dueBoundary <= target) {
      return next.dueBoundary;
    }
    return null;
  }
  if (index >= batches.length) return null;
  return batches[index][0].dueBoundary;
}

function nextNativeObservationBoundary(ready, state) {
  if (state.phase === "await-a" &&
      state.initial.batchIndex === ready.initialEventBatches.length) {
    return ready.nativeABoundary;
  }
  if (state.phase === "await-b" &&
      !state.formBInputBoundaryReached) {
    return ready.formBFirstDueBoundary;
  }
  if (state.phase === "await-b" &&
      state.formB.batchIndex === ready.formBEventBatches.length) {
    return ready.nativeBBoundary;
  }
  if (state.phase === "await-c") {
    return ready.nativeListenerIdleCBoundary;
  }
  if (state.phase === "await-settled") {
    return ready.nativeListenerIdleSettledBoundary;
  }
  return null;
}

const CADR_M6_FORM_A_LOW = 0x000000004d36n;
const CADR_M6_FORM_A_MID = 0x000041314d36n;
const CADR_M6_FORM_B_MID = 0xa55a42324d36n;
const CADR_M6_FORM_C_MID = 0x5aa549444d36n;

function validateM6FastDebugStop(ready, state, fast) {
  if (fast.reason !== 2) return false;
  let sequence;
  let finalBoundary;
  if (state.phase === "await-a") {
    sequence = [0n, CADR_M6_FORM_A_LOW, CADR_M6_FORM_A_MID, CADR_M6_FORM_A];
    finalBoundary = ready.nativeABoundary;
  } else if (state.phase === "await-b") {
    /* The low word of B is also 4d36, so the first B write is not an
     * observable debug-latch delta. */
    sequence = [CADR_M6_FORM_A, CADR_M6_FORM_B_MID, CADR_M6_FORM_B];
    finalBoundary = ready.nativeBBoundary;
  } else if (state.phase === "await-c") {
    /* C likewise retains the low 4d36 word. */
    sequence = [CADR_M6_FORM_B, CADR_M6_FORM_C_MID, CADR_M6_FORM_C];
    finalBoundary = ready.nativeListenerIdleCBoundary;
  } else {
    throw new Error("late CDRM6FAST1 debug delta after the complete ABC marker sequence");
  }
  const index = state.fastDebugIndex ?? 0;
  if (index + 1 >= sequence.length ||
      fast.debugBefore !== sequence[index] ||
      fast.debugAfter !== sequence[index + 1]) {
    throw new Error("wrong or reordered CDRM6FAST1 partial marker");
  }
  const complete = index + 1 === sequence.length - 1;
  if (complete ? fast.postBoundary !== finalBoundary :
      fast.postBoundary >= finalBoundary) {
    throw new Error("early or late CDRM6FAST1 partial marker boundary");
  }
  state.fastDebugIndex = index + 1;
  return complete;
}

async function runM6HeadlessBootInternal(config, testReady = null) {
  let limits;
  const context = {
    boundary: 0n,
    lifecycle: "NEW",
    outstandingRequest: null,
    lastMachineInfo: null,
    terminalStateDigest: null,
    terminalUnimplementedDevice: null,
    requireM7DevidFailureDiagnostic:
      config.requireM7DevidFailureDiagnostic === true,
    terminalQueueDigest: null,
    lastRunFraming: null,
    transcript: [], identityCandidates: [], selectedBase: null,
    preflight: null,
    runEvidence: {
      sessionId: freshEvidenceId("m6-session"),
      privateDiskInstanceId: freshEvidenceId("m6-private-disk"),
      privateDiskBaseSha256: null,
    },
    blockService: null,
    lastTransactionLimit: CADR_M6_DEFAULT_LAST_TRANSACTIONS,
    readyState: {
      phase: "await-a",
      formABoundary: null,
      formBBoundary: null,
      listenerIdleCBoundary: null,
      listenerIdleSettledBoundary: null,
      idleIndex: 0,
      idleLastBoundary: null,
      idleClockIndex: 0,
      formBInputBoundaryReached: false,
      initial: { batchIndex: 0 },
      formB: { batchIndex: 0 },
    },
  };
  try {
    limits = validateLimits(config);
    context.lastTransactionLimit = limits.lastTransactionLimit;
    config.ready = testReady ?? await validateReadyContract(config.ready);
    context.preflight = await preflightM6Artifacts(config);
    context.preflight.artifacts.forEach((artifact, index) => {
      const frozen = config.ready.artifacts[index];
      if (artifact.kind !== frozen.kind ||
          artifact.byteCount !== BigInt(frozen.byte_count) ||
          !sameBytes(artifact.sha256, hexBytes(frozen.sha256))) {
        const error = new Error(
          `artifact kind ${artifact.kind} differs from M6 release record`);
        error.status = STATUS_ARTIFACT_MISMATCH;
        throw error;
      }
    });
    const disk = context.preflight.sources.find(source => source.kind === 3);
    const diskIdentity = context.preflight.artifacts.find(
      artifact => artifact.kind === 3);
    context.runEvidence.privateDiskBaseSha256 = diskIdentity.sha256.slice();
    context.selectedBase = Object.freeze({ byte_count: disk.byteCount,
      sha256: diskIdentity.sha256.slice() });
    context.runEvidence = Object.freeze(context.runEvidence);
    context.blockService = createM4BlockRangeService({
      imageByteCount: disk.byteCount,
      expectedImageByteCount: disk.byteCount,
      readRange: disk.readRange,
      ...(config.m7EffectivePageIdentityPolicy === undefined ? {} : {
        m7EffectivePageIdentityPolicy: config.m7EffectivePageIdentityPolicy,
        selectedBaseSha256: diskIdentity.sha256,
      }),
    });
  } catch (error) {
    return {
      outcome: "failed",
      preflight: null,
      transcript: [],
      report: failure(
        error.status === STATUS_ARTIFACT_MISMATCH ?
          "artifact-preflight-mismatch" :
          (error.reason ?? "invalid-boot-configuration"),
        "preflight",
        error.status ?? STATUS_INVALID_ARGUMENT,
        { detail: String(error.message ?? error), mutationStarted: false }),
    };
  }

  const sources = new Map(
    context.preflight.sources.map(item => [item.kind, item]));
  try {
    const fresh = parseMachineInfo(await workerOk(config.client, "machine-info"));
    if (fresh.lifecycle !== 0 || fresh.artifactMask !== 0 ||
        fresh.boundary !== 0n || fresh.outstandingRequestId !== 0n ||
        fresh.lastCompletedRequestId !== 0n) {
      throw new Error("M6 requires a fresh empty worker machine");
    }
    for (const kind of CADR_M6_REQUIRED_ARTIFACT_KINDS) {
      await importArtifact(config.client, sources.get(kind));
    }
    const info = parseMachineInfo(await workerOk(config.client, "machine-info"));
    if (info.artifactMask !== 0x1f) {
      throw Object.assign(new Error("worker did not publish the complete artifact set"),
        { status: STATUS_ARTIFACT_MISMATCH });
    }
    context.lastMachineInfo = info;
    await workerOk(config.client, "cold-power-on");
    await workerOk(config.client, "boot");
    await workerOk(config.client, "scheduler-visibility", { hidden: false });
    await workerOk(config.client, "scheduler-start");
    context.lifecycle = "RUNNING";
    await observeReadyContract(config.ready, context, config.client);
  } catch (error) {
    return failResult(config.client, context, "cold-boot-start-failed",
      "ingress", error.status ?? STATUS_HOST_FAILURE);
  }

  let hostTransactions = 0;
  const maximumTurns = Number(
    limits.maxBoundaries < BigInt(Number.MAX_SAFE_INTEGER) ?
      limits.maxBoundaries : BigInt(Number.MAX_SAFE_INTEGER)) +
    limits.maxHostTransactions * 4 + 16;
  for (let turn = 0; turn < maximumTurns; turn += 1) {
    if (context.boundary >= limits.maxBoundaries) {
      try {
        await workerOk(config.client, "scheduler-pause");
        context.lifecycle = "PAUSED";
      } catch {
        // Evidence collection records the actual lifecycle.
      }
      return failResult(config.client, context, "boundary-limit-exhausted",
        "run", CADR_STATUS_NOT_READY);
    }
    try {
      const boundaryBeforeTurn = context.boundary;
      const transcriptBeforeTurn = context.transcript.length;
      context.lastMachineInfo =
        parseMachineInfo(await workerOk(config.client, "machine-info"));
      const remaining = limits.maxBoundaries - context.boundary;
      let allowed = remaining < BigInt(limits.batchSlots) ?
        remaining : BigInt(limits.batchSlots);
      if (context.blockService.m7EffectivePageIdentityEnabled() &&
          context.boundary < CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY) {
        const untilQuiet =
          CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY - context.boundary;
        if (untilQuiet < allowed) allowed = untilQuiet;
      }
      if (context.readyState.phase === "suffix" && allowed > 1n) allowed = 1n;
      const nextInput = nextUnscheduledInputBoundary(
        config.ready, context.readyState);
      if (nextInput !== null) {
        if (nextInput <= context.boundary) {
          throw new Error("M6 missed a scheduled input insertion boundary");
        }
        const beforeInsertion = nextInput - context.boundary - 1n;
        if (beforeInsertion < allowed) allowed = beforeInsertion;
      }
      const nextObservation = nextNativeObservationBoundary(
        config.ready, context.readyState);
      if (nextObservation !== null) {
        if (nextObservation <= context.boundary) {
          throw new Error("M6 missed a frozen native observation boundary");
        }
        const untilObservation = nextObservation - context.boundary;
        if (untilObservation < allowed) allowed = untilObservation;
      }
      if (allowed === 0n) {
        const witness = await observeReadyContract(
          config.ready, context, config.client);
        if (witness === null) continue;
        throw new Error("M6 READY emerged outside the canonical run path");
      }
      const requested = Number(allowed);
      const batch = await workerOk(config.client, "run-digest-batch-m5", {
        clockSlots: requested,
      });
      if (!Number.isSafeInteger(batch.boundaryCount) ||
          batch.boundaryCount < 0 || batch.boundaryCount > requested ||
          typeof batch.boundaryPendingHost !== "boolean" ||
          !unsigned32(batch.terminalStatus) ||
          bytesOf(batch.digests)?.byteLength !== batch.boundaryCount * 128) {
        throw Object.assign(new Error("malformed M5 batch framing"),
          { status: STATUS_INVALID_ARGUMENT });
      }
      context.lifecycle = batch.lifecycle;
      if (TERMINAL_STATUSES.has(batch.terminalStatus)) {
        if (unsigned64(batch.lastCompleteBoundary)) {
          context.boundary = batch.lastCompleteBoundary;
        }
        context.terminalQueueDigest = responseDigest(batch, "queueDigest");
        context.terminalStateDigest = responseDigest(batch, "coreStateDigest");
        context.terminalUnimplementedDevice = await terminalUnimplementedDiagnostic(
          batch, context.boundary, batch.terminalStatus,
          context.requireM7DevidFailureDiagnostic);
        context.lastRunFraming = Object.freeze({
          operation: "run-digest-batch-m5",
          requestedClockSlots: requested,
          returnedBoundaryCount: batch.boundaryCount,
          terminalStatus: batch.terminalStatus,
          preCallBoundary: boundaryBeforeTurn,
          cachedLastCompleteBoundary: unsigned64(batch.lastCompleteBoundary) ?
            batch.lastCompleteBoundary : null,
          postCallAttemptedBoundary: null,
        });
        return failResult(config.client, context, "terminal-machine-status",
          "run", batch.terminalStatus);
      }
      context.lastMachineInfo =
        parseMachineInfo(await workerOk(config.client, "machine-info"));
      context.boundary = context.lastMachineInfo.boundary;
      if (context.blockService.m7EffectivePageIdentityEnabled() &&
          context.boundary === CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY) {
        await context.blockService.observeM7EffectivePageIdentityQuietSuffix({
          boundary: context.boundary, reason: 1,
          persistentStatus: context.lastMachineInfo.persistentStatus,
          outstandingRequestId: context.lastMachineInfo.outstandingRequestId,
        });
      }
      if (batch.boundaryPendingHost) {
        if (batch.terminalStatus !== STATUS_WAITING_FOR_HOST ||
            hostTransactions >= limits.maxHostTransactions) {
          return failResult(config.client, context,
            hostTransactions >= limits.maxHostTransactions ?
              "host-transaction-limit-exhausted" : "inconsistent-host-boundary",
            "host-service",
            hostTransactions >= limits.maxHostTransactions ?
              CADR_STATUS_NOT_READY : STATUS_INVALID_ARGUMENT);
        }
        const before = context.transcript.length;
        let polled;
        try {
          {
            const generation = context.blockService.overlayGeneration();
            await workerOk(config.client, "media-overlay-state", {
              busy: true,
              dirty: generation !== 0n,
              snapshotBlocked: context.blockService.snapshotBlocked(),
              overlayGeneration: generation,
            });
          }
          polled = await context.blockService.poll({
            tick: context.boundary,
            nextRequest: async () => {
              const next = await workerRequest(config.client, "host-next-request");
              if (next.status === CADR_STATUS_OK) {
                if (next.request === null || typeof next.request !== "object") {
                  return { status: STATUS_INVALID_ARGUMENT };
                }
                context.outstandingRequest = {
                  generation: next.request.generation,
                  requestId: next.request.requestId,
                  operation: next.request.operation,
                  descriptorByteCount: next.request.descriptorByteCount,
                  requestPayloadByteCount: next.request.requestPayloadByteCount,
                  completionByteCount: next.request.completionByteCount,
                };
              }
              return next;
            },
            complete: async ({ request, hostStatus, bytes }) => {
              const supplied = bytesOf(bytes);
              if (supplied === null) return { status: STATUS_INVALID_ARGUMENT };
              const buffer = supplied.buffer.slice(
                supplied.byteOffset, supplied.byteOffset + supplied.byteLength);
              const response = await workerRequest(config.client, "host-complete", {
                operation: request.operation,
                hostStatus,
                generation: request.generation,
                requestId: request.requestId,
                bytes: buffer,
              }, [buffer]);
              if (response.status === CADR_STATUS_OK) context.outstandingRequest = null;
              return response;
            },
          });
          {
            const generation = context.blockService.overlayGeneration();
            await workerOk(config.client, "media-overlay-state", {
              busy: false,
              dirty: generation !== 0n,
              snapshotBlocked: context.blockService.snapshotBlocked(),
              overlayGeneration: generation,
            });
          }
        } catch (error) {
          try {
            const generation = context.blockService.overlayGeneration();
            await workerRequest(config.client, "media-overlay-state", {
              busy: false,
              dirty: generation !== 0n,
              snapshotBlocked: context.blockService.snapshotBlocked(),
              overlayGeneration: generation,
            });
          } catch {
            // The host-service failure report remains primary.
          }
          return failResult(config.client, context, "host-service-failed",
            "host-service", error.status ?? STATUS_HOST_FAILURE);
        }
        if (polled.status !== CADR_STATUS_OK) {
          return failResult(config.client, context, "host-service-failed",
            "host-service", polled.status);
        }
        for (const event of polled.events) {
          if (event.requestSeen) hostTransactions += 1;
          const ordinal = context.transcript.length;
          context.transcript.push(await transcriptRecord(event, ordinal));
          if (event.identityAcknowledgementCandidate !== undefined) {
            if (!context.blockService.m7EffectivePageIdentityEnabled() || ordinal === 0) {
              throw new TypeError("M7 effective-page candidate appeared outside its profile");
            }
            context.identityCandidates.push(Object.freeze({
              candidate: event.identityAcknowledgementCandidate,
              issueOrdinal: ordinal - 1, completionOrdinal: ordinal,
            }));
          }
        }
        if (context.transcript.length === before ||
            context.blockService.hasPendingRequest()) {
          return failResult(config.client, context,
            context.transcript.length === before ?
              "missing-host-request" : "positive-latency-host-service-is-not-selected",
            "host-service", CADR_STATUS_NOT_READY);
        }
        continue;
      }
      if (batch.terminalStatus !== CADR_STATUS_OK ||
          (context.boundary === boundaryBeforeTurn &&
           context.transcript.length === transcriptBeforeTurn)) {
        return failResult(config.client, context, "zero-progress-run",
          "run", batch.terminalStatus);
      }
      const readyWitness =
        await observeReadyContract(config.ready, context, config.client);
      if (readyWitness !== null) {
        await workerOk(config.client, "scheduler-pause");
        context.lifecycle = "PAUSED";
        context.lastMachineInfo =
          await assertQuiescent(config.client, context.blockService);
        const state = await workerOk(config.client, "boundary-digest-v5");
        const queue = await workerOk(config.client, "scheduler-queue-digest");
        const hostTranscript = serializeM6HostTranscript(
          context.transcript, context.preflight.artifactSetSha256);
        const stateDigest = responseDigest(state, "digest");
        const queueDigest = responseDigest(queue, "digest");
        const hostTranscriptSha256 = await sha256(hostTranscript);
        let m7EffectivePageIdentity = null;
        if (context.blockService.m7EffectivePageIdentityEnabled()) {
          const serviceCandidates =
            context.blockService.m7EffectivePageIdentityCandidates();
          const witnesses =
            context.blockService.m7EffectivePageIdentityWitnesses();
          const identityStatus =
            context.blockService.m7EffectivePageIdentityStatus();
          if (context.identityCandidates.length === 0 ||
              serviceCandidates.length !== context.identityCandidates.length ||
              witnesses.length !== context.identityCandidates.length ||
              identityStatus.phase !== "streaming") {
            throw new Error("selected P4 lacks a complete effective-page stream");
          }
          const acknowledgements = [];
          for (let index = 0; index < context.identityCandidates.length; index += 1) {
            const linked = context.identityCandidates[index];
            if (serviceCandidates[index] !== linked.candidate) {
              throw new Error("M7 effective-page stream order differs");
            }
            acknowledgements.push(
              await createM7EffectivePageIdentityAcknowledgement({
                candidate: linked.candidate,
                issue_ordinal: linked.issueOrdinal,
                completion_ordinal: linked.completionOrdinal,
                host_transcript: hostTranscript,
                selected_base: context.selectedBase,
                effective_page_witness: witnesses[index],
              }));
          }
          const stream = await createM7EffectivePageIdentityStream({
            acknowledgements, host_transcript: hostTranscript,
          });
          m7EffectivePageIdentity = Object.freeze({
            profile: config.m7EffectivePageIdentityPolicy.profile,
            arm: context.blockService.m7EffectivePageIdentityArm(),
            acknowledgements: stream.acknowledgements,
            stream,
          });
        }
        const semanticWitness = await canonicalM6ReadyWitnessFromValidatedRecord({
          record: config.ready,
          releaseRecord: config.ready.releaseRecord,
          artifactSetSha256: context.preflight.artifactSetSha256,
          privateDiskBaseSha256:
            context.runEvidence.privateDiskBaseSha256,
          formABoundary: readyWitness.formABoundary,
          formBBoundary: readyWitness.formBBoundary,
          listenerIdleCBoundary: readyWitness.listenerIdleCBoundary,
          listenerIdleSettledBoundary: readyWitness.listenerIdleSettledBoundary,
          readyBoundary: context.boundary,
          cdrstate5Sha256: stateDigest,
          cdrm5q1Sha256: queueDigest,
          hostTranscriptSha256,
        });
        return {
          outcome: "ready",
          runEvidence: context.runEvidence,
          preflight: publicPreflight(context.preflight),
          ready: Object.freeze({ ...readyWitness, semanticWitness }),
          releaseRecordSha256: await sha256(
            new TextEncoder().encode(canonicalJson(
              config.ready.releaseRecord))),
          target: config.ready.target,
          boundary: context.boundary,
          cdrstate5Sha256: stateDigest,
          cdrm5q1Sha256: queueDigest,
          transcript: context.transcript.slice(),
          hostTranscript,
          hostTranscriptSha256,
          ...(m7EffectivePageIdentity === null ? {} : { m7EffectivePageIdentity }),
          machineInfo: context.lastMachineInfo,
          noPendingOrOrphanedHostRequest: true,
        };
      }
    } catch (error) {
      return failResult(config.client, context, "boot-driver-failure",
        "run", error.status ?? STATUS_HOST_FAILURE);
    }
  }
  return failResult(config.client, context, "turn-limit-exhausted",
    "run", CADR_STATUS_NOT_READY);
}

export async function runM6HeadlessBoot(config) {
  const frozen = { ...config };
  delete frozen.m7EffectivePageIdentityPolicy;
  return runM6HeadlessBootInternal(frozen);
}

/** M7-only exact companion; ordinary M6 callers cannot enable this profile. */
export async function runM6HeadlessBootWithM7EffectivePageIdentity(config) {
  const m7EffectivePageIdentityPolicy = parseM7EffectivePageIdentityPolicy({
    enabled: true, profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  });
  return runM6HeadlessBootInternal({ ...config, m7EffectivePageIdentityPolicy });
}

export function parseM6FastRunRecord(value) {
  const bytes = bytesOf(value);
  if (bytes?.byteLength !== 128 ||
      new TextDecoder().decode(bytes.subarray(0, 10)) !== "CDRM6FAST1" ||
      bytes.subarray(10, 16).some(value => value !== 0) ||
      bytes.subarray(104).some(value => value !== 0)) {
    throw new TypeError("malformed CDRM6FAST1 response");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const record = Object.freeze({
    reason: view.getUint32(24, true), terminalStatus: view.getUint32(28, true),
    requestedSlots: view.getUint32(32, true),
    completedSlots: view.getBigUint64(40, true),
    microinstructionDelta: view.getBigUint64(48, true),
    preBoundary: view.getBigUint64(56, true), postBoundary: view.getBigUint64(64, true),
    debugBefore: view.getBigUint64(72, true), debugAfter: view.getBigUint64(80, true),
    persistentStatus: view.getUint32(88, true), coreLifecycle: view.getUint32(92, true),
    outstandingRequestId: view.getBigUint64(96, true),
  });
  if (view.getUint32(16, true) !== 1 || view.getUint32(20, true) !== 128 ||
      record.reason < 1 || record.reason > 4 || record.requestedSlots === 0 ||
      record.requestedSlots > CADR_M6_FAST_RUN_MAX_SLOTS ||
      record.completedSlots > BigInt(record.requestedSlots) ||
      record.postBoundary < record.preBoundary ||
      record.postBoundary - record.preBoundary !== record.completedSlots ||
      record.debugBefore > 0xffffffffffffn || record.debugAfter > 0xffffffffffffn ||
      !unsigned32(record.terminalStatus) || !unsigned32(record.persistentStatus) ||
      !unsigned32(record.coreLifecycle) ||
      record.reason === 1 && (record.terminalStatus !== CADR_STATUS_OK ||
        record.completedSlots !== BigInt(record.requestedSlots) ||
        record.debugBefore !== record.debugAfter) ||
      record.reason === 2 && (record.terminalStatus !== CADR_STATUS_OK ||
        record.debugBefore === record.debugAfter || record.outstandingRequestId !== 0n ||
        record.persistentStatus !== CADR_STATUS_OK || record.coreLifecycle !== 2) ||
      record.reason === 3 && (record.terminalStatus !== STATUS_WAITING_FOR_HOST ||
        record.outstandingRequestId === 0n || record.persistentStatus !== CADR_STATUS_OK ||
        record.coreLifecycle !== 2) ||
      record.reason === 4 && (record.terminalStatus === CADR_STATUS_OK ||
        record.terminalStatus === STATUS_WAITING_FOR_HOST)) {
    throw new TypeError("invalid CDRM6FAST1 stop semantics");
  }
  return Object.freeze({ ...record, bytes: bytes.slice() });
}

export function parseM6FastRunResponse(response) {
  if (response?.wireSchema !== "CDRM6FAST1") {
    throw new TypeError("malformed CDRM6FAST1 response");
  }
  const record = parseM6FastRunRecord(response.fastRun);
  for (const [field, value] of Object.entries(record)) {
    if (field !== "bytes" && response[field] !== value) {
      throw new TypeError(`CDRM6FAST1 ${field} projection drift`);
    }
  }
  return record;
}

export async function appendM6FastCheckpoint(previous, ordinal, fastRecord,
  cdrstate5Sha256, cdrm5q1Sha256) {
  const state = bytesOf(cdrstate5Sha256);
  const queue = bytesOf(cdrm5q1Sha256);
  if (previous?.byteLength !== 32 || state?.byteLength !== 32 ||
      queue?.byteLength !== 32 || !Number.isSafeInteger(ordinal) || ordinal < 0) {
    throw new TypeError("invalid M6 fast checkpoint inputs");
  }
  const record = bytesOf(fastRecord);
  const parsed = parseM6FastRunRecord(record);
  if (parsed.reason === 3) throw new TypeError("host-wait stop cannot be a settled checkpoint");
  const domain = new TextEncoder().encode("CDRM6FASTCHAIN1\0");
  const recordDigest = await sha256(record);
  const bytes = new Uint8Array(domain.byteLength + 8 + 32 * 4);
  bytes.set(domain, 0);
  new DataView(bytes.buffer).setBigUint64(domain.byteLength, BigInt(ordinal), true);
  let offset = domain.byteLength + 8;
  for (const part of [previous, state, queue, recordDigest]) {
    bytes.set(part, offset); offset += 32;
  }
  return sha256(bytes);
}

/* A reason-3 stop exposes an outstanding request whose payload is deliberately
 * excluded from public CDRSTATE5.  Preserve that exact CDRM6FAST1 in a
 * separate chain, rather than asking the public state endpoint to hash an
 * ineligible payload-bearing state or silently dropping the stop. */
export async function appendM6FastHostWait(previous, ordinal, fastRecord) {
  if (previous?.byteLength !== 32 || !Number.isSafeInteger(ordinal) || ordinal < 0) {
    throw new TypeError("invalid M6 fast host-wait chain inputs");
  }
  const record = bytesOf(fastRecord);
  if (parseM6FastRunRecord(record).reason !== 3) {
    throw new TypeError("host-wait chain requires an exact reason-3 CDRM6FAST1 record");
  }
  const domain = new TextEncoder().encode("CDRM6FASTHOSTWAIT1\0");
  const recordDigest = await sha256(record);
  const bytes = new Uint8Array(domain.byteLength + 8 + 32 * 2);
  bytes.set(domain, 0);
  new DataView(bytes.buffer).setBigUint64(domain.byteLength, BigInt(ordinal), true);
  bytes.set(previous, domain.byteLength + 8);
  bytes.set(recordDigest, domain.byteLength + 8 + 32);
  return sha256(bytes);
}

function validM6DevidSummary(response) {
  const summary = bytesOf(response?.summary);
  const digest = bytesOf(response?.summaryDigest);
  if (response?.wireSchema !== "CDRM6E1" ||
      response?.policyId !== CADR_M6_DEVID_POLICY_ID || summary?.byteLength !== 512 ||
      digest?.byteLength !== 32 || new TextDecoder().decode(summary.subarray(0, 7)) !== "CDRM6E1" ||
      summary[7] !== 0 || summary.subarray(352).some(value => value !== 0)) {
    return null;
  }
  const view = new DataView(summary.buffer, summary.byteOffset, summary.byteLength);
  const flags = view.getUint32(20, true);
  const totalAccepted = view.getBigUint64(40, true);
  const tailEventCount = view.getBigUint64(48, true);
  let kindTotal = 0n;
  for (let index = 0; index < 9; index += 1) {
    kindTotal += view.getBigUint64(88 + index * 8, true);
  }
  if (view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 512 ||
      view.getUint32(16, true) !== 1 || flags !== 1 ||
      view.getUint32(24, true) !== 512 || view.getUint32(28, true) !== 512 ||
      view.getBigUint64(32, true) !== 0x7fffffffffffffffn ||
      totalAccepted <= 512n || tailEventCount !== totalAccepted - 512n ||
      view.getBigUint64(56, true) !== 512n || kindTotal !== totalAccepted ||
      view.getUint32(316, true) !== 0 || view.getBigUint64(304, true) !== 0n ||
      view.getUint32(312, true) !== 0 || summary.subarray(320, 352).some(value => value !== 0) ||
      summary.subarray(272, 304).every(value => value === 0)) return null;
  return Object.freeze({ bytes: summary.slice(), digest: digest.slice(),
    selectedMaximum: view.getBigUint64(32, true), totalAccepted });
}

/* The CDRM6E1 parser is intentionally shared by READY4 consumers outside the
 * boot driver.  It exposes no inferred state: the selected maximum and the
 * two event counts are the fields serialized by the C-owned summary. */
export function parseM6DevidSummary(response) {
  const summary = validM6DevidSummary(response);
  if (summary === null) throw new TypeError("invalid CDRM6E1 evidence summary");
  return Object.freeze({ ...summary,
    tailEventCount: summary.totalAccepted - 512n });
}

async function serviceM6FastHost(client, context, hostTransactions, limits) {
  if (hostTransactions >= limits.maxHostTransactions) {
    return Object.freeze({ failed: "host-transaction-limit-exhausted", status: CADR_STATUS_NOT_READY,
      hostTransactions });
  }
  const before = context.transcript.length;
  let polled;
  try {
    let generation = context.blockService.overlayGeneration();
    await workerOk(client, "media-overlay-state", { busy: true, dirty: generation !== 0n,
      snapshotBlocked: context.blockService.snapshotBlocked(), overlayGeneration: generation });
    polled = await context.blockService.poll({
      tick: context.boundary,
      nextRequest: async () => {
        const next = await workerRequest(client, "host-next-request");
        if (next.status === CADR_STATUS_OK) {
          if (next.request === null || typeof next.request !== "object") {
            return { status: STATUS_INVALID_ARGUMENT };
          }
          context.outstandingRequest = {
            generation: next.request.generation, requestId: next.request.requestId,
            operation: next.request.operation,
            descriptorByteCount: next.request.descriptorByteCount,
            requestPayloadByteCount: next.request.requestPayloadByteCount,
            completionByteCount: next.request.completionByteCount,
          };
        }
        return next;
      },
      complete: async ({ request, hostStatus, bytes }) => {
        const supplied = bytesOf(bytes);
        if (supplied === null) return { status: STATUS_INVALID_ARGUMENT };
        const buffer = supplied.buffer.slice(supplied.byteOffset,
          supplied.byteOffset + supplied.byteLength);
        const response = await workerRequest(client, "host-complete", {
          operation: request.operation, hostStatus, generation: request.generation,
          requestId: request.requestId, bytes: buffer,
        }, [buffer]);
        if (response.status === CADR_STATUS_OK) context.outstandingRequest = null;
        return response;
      },
    });
    generation = context.blockService.overlayGeneration();
    await workerOk(client, "media-overlay-state", { busy: false, dirty: generation !== 0n,
      snapshotBlocked: context.blockService.snapshotBlocked(), overlayGeneration: generation });
  } catch (error) {
    try {
      const generation = context.blockService.overlayGeneration();
      await workerRequest(client, "media-overlay-state", { busy: false, dirty: generation !== 0n,
        snapshotBlocked: context.blockService.snapshotBlocked(), overlayGeneration: generation });
    } catch { /* The original host-service error remains authoritative. */ }
    return Object.freeze({ failed: "host-service-failed", status: error.status ?? STATUS_HOST_FAILURE,
      hostTransactions });
  }
  if (polled.status !== CADR_STATUS_OK || context.transcript.length === before &&
      (!Array.isArray(polled.events) || polled.events.length === 0)) {
    return Object.freeze({ failed: "host-service-failed", status: polled.status,
      hostTransactions });
  }
  for (const event of polled.events) {
    if (event.requestSeen) hostTransactions += 1;
    const ordinal = context.transcript.length;
    context.transcript.push(await transcriptRecord(event, ordinal));
    if (event.identityAcknowledgementCandidate !== undefined) {
      if (!Array.isArray(context.identityCandidates) || ordinal === 0) {
        throw new TypeError("M7 effective-page candidate appeared outside its profile");
      }
      context.identityCandidates.push(Object.freeze({
        candidate: event.identityAcknowledgementCandidate,
        issueOrdinal: ordinal - 1, completionOrdinal: ordinal,
      }));
    }
  }
  if (context.blockService.hasPendingRequest()) {
    return Object.freeze({ failed: "positive-latency-host-service-is-not-selected",
      status: CADR_STATUS_NOT_READY, hostTransactions });
  }
  return Object.freeze({ failed: null, status: CADR_STATUS_OK, hostTransactions });
}

/* READY4 reuses the frozen M6 scheduling and A/B/C proof, but the long spans
 * advance through CDRM6FAST1.  Every fast stop has a CDRSTATE5/CDRM5Q1
 * checkpoint-chain link; no JavaScript loop transfers per-slot digests. */
async function runM6Ready4FastInternal(config, testReady = null) {
  let limits;
  const fastSlots = config.fastSlots ?? CADR_M6_FAST_RUN_MAX_SLOTS;
  const context = {
    boundary: 0n, lifecycle: "NEW", outstandingRequest: null, lastMachineInfo: null,
    terminalStateDigest: null, terminalQueueDigest: null,
    terminalUnimplementedDevice: null, lastRunFraming: null,
    requireM7DevidFailureDiagnostic:
      config.requireM7DevidFailureDiagnostic === true,
    transcript: [], preflight: null, checkpointChain: await sha256(
      new TextEncoder().encode("CDRM6FASTCHAIN1\0")), checkpointCount: 0,
    checkpointRecords: [],
    hostWaitChain: await sha256(new TextEncoder().encode("CDRM6FASTHOSTWAIT1\0")),
    hostWaitCount: 0, hostWaitRecords: [], identityCandidates: [],
    selectedBase: null,
    runEvidence: { sessionId: freshEvidenceId("m6-ready4-session"),
      privateDiskInstanceId: freshEvidenceId("m6-ready4-private-disk"),
      privateDiskBaseSha256: null }, blockService: null,
    lastTransactionLimit: CADR_M6_DEFAULT_LAST_TRANSACTIONS,
    readyState: { phase: "await-a", formABoundary: null, formBBoundary: null,
      listenerIdleCBoundary: null, listenerIdleSettledBoundary: null, idleIndex: 0,
      idleLastBoundary: null, idleClockIndex: 0, formBInputBoundaryReached: false,
      fastDebugIndex: 0, initial: { batchIndex: 0 }, formB: { batchIndex: 0 } },
  };
  if (!Number.isSafeInteger(fastSlots) || fastSlots <= 0 ||
      fastSlots > CADR_M6_FAST_RUN_MAX_SLOTS) {
    throw new RangeError("M6 READY4 fastSlots must be a bounded u32");
  }
  try {
    limits = validateLimits(config); context.lastTransactionLimit = limits.lastTransactionLimit;
    config.ready = testReady ?? await validateReadyContract(config.ready);
    context.preflight = await preflightM6Artifacts(config);
    context.preflight.artifacts.forEach((artifact, index) => {
      const frozen = config.ready.artifacts[index];
      if (artifact.kind !== frozen.kind || artifact.byteCount !== BigInt(frozen.byte_count) ||
          !sameBytes(artifact.sha256, hexBytes(frozen.sha256))) {
        throw Object.assign(new Error("artifact differs from M6 release record"),
          { status: STATUS_ARTIFACT_MISMATCH });
      }
    });
    const disk = context.preflight.sources.find(source => source.kind === 3);
    const diskIdentity = context.preflight.artifacts.find(artifact => artifact.kind === 3);
    context.runEvidence.privateDiskBaseSha256 = diskIdentity.sha256.slice();
    context.selectedBase = Object.freeze({ byte_count: disk.byteCount,
      sha256: diskIdentity.sha256.slice() });
    context.runEvidence = Object.freeze(context.runEvidence);
    context.blockService = createM4BlockRangeService({ imageByteCount: disk.byteCount,
      expectedImageByteCount: disk.byteCount, readRange: disk.readRange,
      ...(config.m7EffectivePageIdentityPolicy === undefined ? {} : {
        m7EffectivePageIdentityPolicy: config.m7EffectivePageIdentityPolicy,
        selectedBaseSha256: diskIdentity.sha256 }),
    });
  } catch (error) {
    return { outcome: "failed", preflight: null, transcript: [], report: failure(
      error.status === STATUS_ARTIFACT_MISMATCH ? "artifact-preflight-mismatch" :
        (error.reason ?? "invalid-boot-configuration"), "preflight",
      error.status ?? STATUS_INVALID_ARGUMENT,
      { detail: String(error.message ?? error), mutationStarted: false }) };
  }
  try {
    const sources = new Map(context.preflight.sources.map(item => [item.kind, item]));
    const fresh = parseMachineInfo(await workerOk(config.client, "machine-info"));
    if (fresh.lifecycle !== 0 || fresh.artifactMask !== 0 || fresh.boundary !== 0n ||
        fresh.outstandingRequestId !== 0n || fresh.lastCompletedRequestId !== 0n) {
      throw new Error("READY4 requires a fresh M6-DEVID worker machine");
    }
    for (const kind of CADR_M6_REQUIRED_ARTIFACT_KINDS) await importArtifact(config.client, sources.get(kind));
    if ((parseMachineInfo(await workerOk(config.client, "machine-info"))).artifactMask !== 0x1f) {
      throw Object.assign(new Error("worker did not publish the complete artifact set"),
        { status: STATUS_ARTIFACT_MISMATCH });
    }
    await workerOk(config.client, "cold-power-on"); await workerOk(config.client, "boot");
    await workerOk(config.client, "scheduler-visibility", { hidden: false });
    await workerOk(config.client, "scheduler-start"); context.lifecycle = "RUNNING";
    await observeReadyContract(config.ready, context, config.client);
  } catch (error) {
    return failResult(config.client, context, "cold-boot-start-failed", "ingress",
      error.status ?? STATUS_HOST_FAILURE);
  }
  let hostTransactions = 0;
  const maximumTurns = Number(limits.maxBoundaries < BigInt(Number.MAX_SAFE_INTEGER) ?
    limits.maxBoundaries : BigInt(Number.MAX_SAFE_INTEGER)) + limits.maxHostTransactions * 4 + 64;
  for (let turn = 0; turn < maximumTurns; turn += 1) {
    if (context.boundary >= limits.maxBoundaries) {
      try { await workerOk(config.client, "scheduler-pause"); context.lifecycle = "PAUSED"; } catch {}
      return failResult(config.client, context, "boundary-limit-exhausted", "run", CADR_STATUS_NOT_READY);
    }
    try {
      const boundaryBefore = context.boundary;
      let allowed = BigInt(Math.min(fastSlots, Number(limits.maxBoundaries - context.boundary)));
      if (context.readyState.phase === "suffix" && allowed > 1n) allowed = 1n;
      const nextInput = nextUnscheduledInputBoundary(config.ready, context.readyState);
      if (nextInput !== null) {
        if (nextInput <= context.boundary) throw new Error("M6 missed a scheduled input insertion boundary");
        allowed = allowed < nextInput - context.boundary - 1n ? allowed : nextInput - context.boundary - 1n;
      }
      const nextObservation = nextNativeObservationBoundary(config.ready, context.readyState);
      if (nextObservation !== null) {
        if (nextObservation <= context.boundary) throw new Error("M6 missed a frozen native observation boundary");
        allowed = allowed < nextObservation - context.boundary ? allowed : nextObservation - context.boundary;
      }
      if (allowed === 0n) {
        const witness = await observeReadyContract(config.ready, context, config.client);
        if (witness === null) continue;
        throw new Error("M6 READY emerged outside the canonical fast-run path");
      }
      const response = await workerOk(config.client, "run-until-event-m6", {
        clockSlots: Number(allowed),
      });
      const fast = parseM6FastRunResponse(response);
      if (fast.preBoundary !== boundaryBefore || fast.requestedSlots !== Number(allowed)) {
        throw new Error("CDRM6FAST1 boundary or request framing drift");
      }
      const completedDebugMarker = validateM6FastDebugStop(
        config.ready, context.readyState, fast);
      /* The worker transitions to WAITING_FOR_HOST as it publishes the
       * reason-3 record.  Its digest operations are intentionally unavailable
       * in that state, so record the C-owned stop first, service the one host
       * request, and only then capture the checkpoint's post-completion
       * CDRSTATE5/CDRM5Q1 pair.  Asking for the pair before service converts a
       * valid fast host stop into an unrelated protocol-status-9 failure. */
      context.lastRunFraming = Object.freeze({ operation: "run-until-event-m6",
        requestedClockSlots: fast.requestedSlots, completedSlots: fast.completedSlots,
        terminalStatus: fast.terminalStatus, reason: fast.reason,
        preBoundary: fast.preBoundary, postBoundary: fast.postBoundary });
      context.boundary = fast.postBoundary;
      if (typeof context.blockService.observeM7EffectivePageIdentityQuietSuffix === "function") {
        await context.blockService.observeM7EffectivePageIdentityQuietSuffix({
          boundary: context.boundary, reason: fast.reason,
          persistentStatus: fast.persistentStatus,
          outstandingRequestId: fast.outstandingRequestId,
        });
      }
      if (fast.reason === 3) {
        context.hostWaitRecords.push(fast.bytes.slice());
        context.hostWaitChain = await appendM6FastHostWait(context.hostWaitChain,
          context.hostWaitCount++, fast.bytes);
        const serviced = await serviceM6FastHost(config.client, context, hostTransactions, limits);
        hostTransactions = serviced.hostTransactions;
        if (serviced.failed !== null) return failResult(config.client, context,
          serviced.failed, "host-service", serviced.status);
        /* Completion is only applied by the next C-owned run.  CDRSTATE5
         * therefore remains intentionally unavailable here; that next stable
         * CDRM6FAST1 becomes the next ordinary checkpoint-chain link. */
        continue;
      }
      let stateDigest; let queueDigest;
      if (fast.reason === 4) {
        stateDigest = responseDigest(response, "coreStateDigest");
        queueDigest = responseDigest(response, "queueDigest");
        if (stateDigest === null || queueDigest === null) {
          throw new Error("terminal CDRM6FAST1 omitted M5 failure digests");
        }
      } else {
        stateDigest = responseDigest(await workerOk(config.client, "boundary-digest-v5"), "digest");
        queueDigest = responseDigest(await workerOk(config.client, "scheduler-queue-digest"), "digest");
        if (stateDigest === null || queueDigest === null) throw new Error("fast stop omitted checkpoint digests");
      }
      context.checkpointChain = await appendM6FastCheckpoint(context.checkpointChain,
        context.checkpointCount++, fast.bytes, stateDigest, queueDigest);
      context.checkpointRecords.push(Object.freeze({ fastRun: fast.bytes.slice(),
        cdrstate5Sha256: stateDigest.slice(), cdrm5q1Sha256: queueDigest.slice() }));
      context.terminalStateDigest = stateDigest; context.terminalQueueDigest = queueDigest;
      context.terminalUnimplementedDevice = await terminalUnimplementedDiagnostic(
        response, context.boundary, fast.terminalStatus,
        context.requireM7DevidFailureDiagnostic);
      if (fast.reason === 4) {
        return failResult(config.client, context, "terminal-machine-status", "run", fast.terminalStatus);
      }
      context.lastMachineInfo = parseMachineInfo(await workerOk(config.client, "machine-info"));
      if (context.lastMachineInfo.boundary !== context.boundary ||
          context.lastMachineInfo.persistentStatus !== fast.persistentStatus ||
          context.lastMachineInfo.outstandingRequestId !== fast.outstandingRequestId) {
        throw new Error("CDRM6FAST1 machine-info projection drift");
      }
      if (context.boundary === boundaryBefore) {
        return failResult(config.client, context, "zero-progress-run", "run", CADR_STATUS_NOT_READY);
      }
      if (fast.reason === 2 && !completedDebugMarker) continue;
      if ((context.readyState.fastDebugIndex ?? 0) !== 0 &&
          fast.reason !== 2) {
        /* A bounded endpoint or host stop may occur between two valid
         * 16-bit writes.  Retain the accepted partial and continue without
         * presenting it to the full-marker observer. */
        continue;
      }
      const phaseBeforeObservation = context.readyState.phase;
      const readyWitness = await observeReadyContract(config.ready, context, config.client);
      if (context.readyState.phase !== phaseBeforeObservation) {
        context.readyState.fastDebugIndex = 0;
      }
      if (readyWitness === null) continue;
      await workerOk(config.client, "scheduler-pause"); context.lifecycle = "PAUSED";
      const quiescence = await assertQuiescent(config.client, context.blockService);
      context.lastMachineInfo = quiescence.machineInfo;
      const summaryResponse = await workerOk(config.client, "m6-disk-evidence-summary");
      const summary = parseM6DevidSummary(summaryResponse);
      if (summary === null || !sameBytes(await sha256(summary.bytes), summary.digest)) {
        throw new Error("closed CDRM6E1 evidence summary mismatch");
      }
      const hostTranscript = serializeM6HostTranscript(context.transcript,
        context.preflight.artifactSetSha256);
      const hostTranscriptSha256 = await sha256(hostTranscript);
      await parseM6ZeroLatencyHostTranscript(hostTranscript, {
        artifactSetSha256: context.preflight.artifactSetSha256,
        hostWaitRecords: context.hostWaitRecords,
      });
      let identityAcknowledgements = Object.freeze([]);
      let identityStream = null;
      if (context.blockService.m7EffectivePageIdentityEnabled()) {
        const serviceCandidates =
          context.blockService.m7EffectivePageIdentityCandidates();
        const witnesses = context.blockService.m7EffectivePageIdentityWitnesses();
        const identityStatus = context.blockService.m7EffectivePageIdentityStatus();
        if (context.identityCandidates.length === 0 ||
            serviceCandidates.length !== context.identityCandidates.length ||
            witnesses.length !== context.identityCandidates.length ||
            identityStatus.phase !== "streaming") {
          throw new Error("selected P4 lacks a complete effective-page stream");
        }
        const acknowledgements = [];
        for (let index = 0; index < context.identityCandidates.length; index += 1) {
          const linked = context.identityCandidates[index];
          if (serviceCandidates[index] !== linked.candidate) {
            throw new Error("M7 effective-page stream order differs");
          }
          acknowledgements.push(
            await createM7EffectivePageIdentityAcknowledgement({
              candidate: linked.candidate,
              issue_ordinal: linked.issueOrdinal,
              completion_ordinal: linked.completionOrdinal,
              host_transcript: hostTranscript,
              selected_base: context.selectedBase,
              effective_page_witness: witnesses[index],
            }));
        }
        identityStream = await createM7EffectivePageIdentityStream({
          acknowledgements, host_transcript: hostTranscript,
        });
        identityAcknowledgements = identityStream.acknowledgements;
      }
      const ready3Witness = await canonicalM6ReadyWitnessFromValidatedRecord({
        record: config.ready, releaseRecord: config.ready.releaseRecord,
        artifactSetSha256: context.preflight.artifactSetSha256,
        privateDiskBaseSha256: context.runEvidence.privateDiskBaseSha256,
        formABoundary: readyWitness.formABoundary, formBBoundary: readyWitness.formBBoundary,
        listenerIdleCBoundary: readyWitness.listenerIdleCBoundary,
        listenerIdleSettledBoundary: readyWitness.listenerIdleSettledBoundary,
        readyBoundary: context.boundary, cdrstate5Sha256: stateDigest,
        cdrm5q1Sha256: queueDigest, hostTranscriptSha256 });
      const ready4Witness = await canonicalM6ReadyWitnessV4({ ready3Witness,
        target: CADR_M6_DEVID_PROFILE, selectedMaximum: summary.selectedMaximum,
        cdrm6e1Sha256: summary.digest,
        checkpointCount: context.checkpointCount,
        checkpointChainSha256: context.checkpointChain,
        hostWaitCount: context.hostWaitCount,
        hostWaitChainSha256: context.hostWaitChain });
      const m7EffectivePageIdentity =
        typeof context.blockService.m7EffectivePageIdentityEnabled === "function" &&
        context.blockService.m7EffectivePageIdentityEnabled() ? Object.freeze({
          profile: config.m7EffectivePageIdentityPolicy.profile,
          arm: context.blockService.m7EffectivePageIdentityArm(),
          acknowledgements: identityAcknowledgements,
          stream: identityStream,
        }) : null;
      return Object.freeze({ outcome: "ready4", target: CADR_M6_DEVID_PROFILE,
        contract: CADR_M6_READY4_CONTRACT, runEvidence: context.runEvidence,
        preflight: publicPreflight(context.preflight), ready: Object.freeze({ ...readyWitness,
          ready3Witness, ready4Witness }), boundary: context.boundary,
        cdrstate5Sha256: stateDigest, cdrm5q1Sha256: queueDigest,
        checkpointChainSha256: context.checkpointChain, checkpointCount: context.checkpointCount,
        checkpointRecords: Object.freeze(context.checkpointRecords.map(record => Object.freeze({
          fastRun: record.fastRun.slice(), cdrstate5Sha256: record.cdrstate5Sha256.slice(),
          cdrm5q1Sha256: record.cdrm5q1Sha256.slice() }))),
        hostWaitChainSha256: context.hostWaitChain, hostWaitCount: context.hostWaitCount,
        hostWaitRecords: Object.freeze(context.hostWaitRecords.map(record => record.slice())),
        cdrm6e1: summary.bytes, cdrm6e1Sha256: summary.digest,
        cdrm6e1SelectedMaximum: summary.selectedMaximum,
        cdrm6e1TotalAccepted: summary.totalAccepted,
        cdrm6e1TailEventCount: summary.tailEventCount,
        transcript: context.transcript.slice(), hostTranscript, hostTranscriptSha256,
        ...(m7EffectivePageIdentity === null ? {} : { m7EffectivePageIdentity }),
        machineInfo: context.lastMachineInfo, quiescence,
        noPendingOrOrphanedHostRequest: true });
    } catch (error) {
      return failResult(config.client, context, "boot-driver-failure", "run",
        error.status ?? STATUS_HOST_FAILURE);
    }
  }
  return failResult(config.client, context, "turn-limit-exhausted", "run", CADR_STATUS_NOT_READY);
}

export async function runM6Ready4Fast(config) {
  return runM6Ready4FastInternal({ ...config });
}

export async function runSyntheticM6Ready4FastForTest(config, releaseRecord) {
  const ready = await validateM6ReleaseRecord(releaseRecord, false);
  return runM6Ready4FastInternal({ ...config, ready }, ready);
}

/* Unit-test entrypoint. It exercises the complete state machine with a strict
 * synthetic record but cannot change the production compiled-digest gate. */
export async function runSyntheticM6HeadlessBootForTest(config, releaseRecord) {
  const ready = await validateM6ReleaseRecord(releaseRecord, false);
  return runM6HeadlessBootInternal({ ...config, ready }, ready);
}

/*
 * Closure requires three independent machines and private disk services. The
 * factory is invoked once per run. Session and private-disk instance ids are
 * generated inside each driver run, never accepted from the factory. A failed
 * inner boot is returned as evidence, never averaged away.
 */
async function runM6HeadlessBootConformanceInternal(
  { createRun, disposeRun = null, onRunCompleted = null, repetitions = 3 },
  runBoot, serialize) {
  if (typeof createRun !== "function" ||
      (disposeRun !== null && typeof disposeRun !== "function") ||
      (onRunCompleted !== null && typeof onRunCompleted !== "function") ||
      repetitions !== 3) {
    throw new TypeError("M6 conformance requires exactly three fresh run factories");
  }
  const results = [];
  const sessionIds = new Set();
  const diskIdentities = new Set();
  for (let index = 0; index < repetitions; index += 1) {
    const run = await createRun(index);
    if (run === null || typeof run !== "object") {
      throw new TypeError("M6 run factory omitted a run configuration");
    }
    let result;
    try {
      result = await runBoot(run);
    } finally {
      /* A real run owns a dedicated worker and must release it before the
       * next factory can allocate another one. Cleanup is deliberately not
       * best-effort: a close failure prevents a success summary/evidence. */
      if (disposeRun !== null) await disposeRun(run, index);
    }
    results.push(result);
    if (result.outcome !== "ready") {
      return Object.freeze({
        schema: "cadr-m6-wasm-ready-conformance-v1",
        outcome: "failed",
        completed_runs: index,
        failed_run: index,
        failure: Object.freeze({
          preflight: result.preflight ?? null,
          report: result.report,
          run_evidence: result.runEvidence ?? null,
          transcript_tail: result.transcriptTail ?? result.transcript ?? [],
        }),
      });
    }
    const sessionId = result.runEvidence?.sessionId;
    const diskId = result.runEvidence?.privateDiskInstanceId;
    if (typeof sessionId !== "string" || typeof diskId !== "string" ||
        sessionIds.has(sessionId) || diskIdentities.has(diskId)) {
      throw new Error("M6 did not produce unique internal run evidence");
    }
    sessionIds.add(sessionId);
    diskIdentities.add(diskId);
    /* Progress is reported only after the ready result has passed the
     * per-run freshness checks. It cannot affect the serialized evidence. */
    if (onRunCompleted !== null) {
      await onRunCompleted(Object.freeze({
        completedRuns: index + 1,
        runIndex: index,
      }));
    }
  }
  const witnesses = results.map(result => bytesOf(result.ready?.semanticWitness));
  if (witnesses.some(item => item === null || item.byteLength !== 32) ||
      !witnesses.slice(1).every(item => sameBytes(item, witnesses[0]))) {
    return Object.freeze({
      schema: "cadr-m6-wasm-ready-conformance-v1",
      outcome: "failed",
      reason: "fresh-run-witness-mismatch",
      completed_runs: 3,
    });
  }
  const releaseDigest = bytesHex(results[0].releaseRecordSha256,
    "release record digest");
  if (!results.every(result =>
    result.ready.contract === results[0].ready.contract &&
    result.target === results[0].target &&
    bytesHex(result.releaseRecordSha256) === releaseDigest)) {
    throw new Error("fresh M6 runs used different release identities");
  }
  const runs = Object.freeze(results.map((result, index) =>
    Object.freeze({
      run_index: index,
      session_id: result.runEvidence.sessionId,
      private_disk_instance_id: result.runEvidence.privateDiskInstanceId,
      private_disk_base_sha256: bytesHex(
        result.runEvidence.privateDiskBaseSha256),
      artifact_set_sha256: bytesHex(result.preflight.artifactSetSha256),
      form_a_boundary: result.ready.formABoundary.toString(),
      form_b_boundary: result.ready.formBBoundary.toString(),
      listener_idle_c_boundary: result.ready.listenerIdleCBoundary.toString(),
      listener_idle_settled_boundary:
        result.ready.listenerIdleSettledBoundary.toString(),
      ready_boundary: result.boundary.toString(),
      cdrstate5_sha256: bytesHex(result.cdrstate5Sha256),
      cdrm5q1_sha256: bytesHex(result.cdrm5q1Sha256),
      host_transcript_sha256: bytesHex(result.hostTranscriptSha256),
      semantic_witness_sha256: bytesHex(result.ready.semanticWitness),
      no_pending_or_orphaned_host_request:
        result.noPendingOrOrphanedHostRequest === true,
    })));
  const output = {
    contract: results[0].ready.contract,
    target: results[0].target,
    release_record_sha256: releaseDigest,
    outcome: "ready",
    runs,
    semantic_witness_sha256: bytesHex(witnesses[0]),
  };
  await serialize(output);
  return Object.freeze(output);
}

const M6_CONFORMANCE_KEYS = Object.freeze([
  "contract", "target", "release_record_sha256", "outcome", "runs",
  "semantic_witness_sha256",
]);
const M6_CONFORMANCE_RUN_KEYS = Object.freeze([
  "run_index", "session_id", "private_disk_instance_id",
  "private_disk_base_sha256", "artifact_set_sha256", "form_a_boundary",
  "form_b_boundary", "listener_idle_c_boundary",
  "listener_idle_settled_boundary", "ready_boundary", "cdrstate5_sha256",
  "cdrm5q1_sha256", "host_transcript_sha256", "semantic_witness_sha256",
  "no_pending_or_orphaned_host_request",
]);

const M6_FAILURE_CONFORMANCE_KEYS = Object.freeze([
  "schema", "outcome", "completed_runs", "failed_run", "failure",
]);
const M6_FAILURE_KEYS = Object.freeze([
  "preflight", "report", "run_evidence", "transcript_tail",
]);
const M6_FAILURE_PREFLIGHT_REPORT_KEYS = Object.freeze([
  "schema", "schemaVersion", "outcome", "reason", "phase", "status",
  "detail", "mutationStarted",
]);
const M6_FAILURE_RUN_REPORT_KEYS = Object.freeze([
  "schema", "schemaVersion", "outcome", "reason", "phase", "status",
  "boundary", "lifecycle", "cdrstate5Sha256", "cdrm5q1Sha256",
  "outstandingRequest", "machineInfo", "transcriptCount",
  "lastHostTransactions", "hostTranscriptSha256", "runFraming",
]);
const M6_FAILURE_RUN_REPORT_V2_KEYS = Object.freeze([
  ...M6_FAILURE_RUN_REPORT_KEYS, "unimplementedDevice",
]);

function failureDigest(value, label, nullable = false) {
  if (value === null && nullable) return null;
  return bytesHex(value, label);
}

function failureU64(value, label) {
  if (!unsigned64(value)) throw new TypeError(`${label} must be a u64`);
  return value.toString();
}

function failureU32(value, label) {
  if (!unsigned32(value)) throw new TypeError(`${label} must be a u32`);
  return value;
}

function normalizeFailureMachineInfo(value) {
  if (value === null) return null;
  exactKeys(value, [
    "lifecycle", "artifactMask", "boundary", "microinstructions", "generation",
    "nextRequestId", "outstandingRequestId", "lastCompletedRequestId",
    "persistentStatus", "profile",
  ], "M6 failure machineInfo");
  return Object.freeze({
    lifecycle: failureU32(value.lifecycle, "machineInfo.lifecycle"),
    artifactMask: failureU32(value.artifactMask, "machineInfo.artifactMask"),
    boundary: failureU64(value.boundary, "machineInfo.boundary"),
    microinstructions: failureU64(value.microinstructions, "machineInfo.microinstructions"),
    generation: failureU64(value.generation, "machineInfo.generation"),
    nextRequestId: failureU64(value.nextRequestId, "machineInfo.nextRequestId"),
    outstandingRequestId: failureU64(
      value.outstandingRequestId, "machineInfo.outstandingRequestId"),
    lastCompletedRequestId: failureU64(
      value.lastCompletedRequestId, "machineInfo.lastCompletedRequestId"),
    persistentStatus: failureU32(value.persistentStatus, "machineInfo.persistentStatus"),
    profile: failureU32(value.profile, "machineInfo.profile"),
  });
}

function normalizeFailureOutstandingRequest(value) {
  if (value === null) return null;
  exactKeys(value, [
    "generation", "requestId", "operation", "descriptorByteCount",
    "requestPayloadByteCount", "completionByteCount",
  ], "M6 failure outstandingRequest");
  return Object.freeze({
    generation: failureU64(value.generation, "outstandingRequest.generation"),
    requestId: failureU64(value.requestId, "outstandingRequest.requestId"),
    operation: failureU32(value.operation, "outstandingRequest.operation"),
    descriptorByteCount: failureU64(
      value.descriptorByteCount, "outstandingRequest.descriptorByteCount"),
    requestPayloadByteCount: failureU64(
      value.requestPayloadByteCount, "outstandingRequest.requestPayloadByteCount"),
    completionByteCount: failureU64(
      value.completionByteCount, "outstandingRequest.completionByteCount"),
  });
}

function normalizeFailureRunFraming(value) {
  if (value === null) return null;
  if (value.operation === "run-until-event-m6") {
    exactKeys(value, [
      "operation", "requestedClockSlots", "completedSlots", "terminalStatus", "reason",
      "preBoundary", "postBoundary",
    ], "M6 fast failure runFraming");
    if (!Number.isSafeInteger(value.requestedClockSlots) ||
        value.requestedClockSlots <= 0 ||
        value.requestedClockSlots > CADR_M6_FAST_RUN_MAX_SLOTS ||
        !unsigned64(value.completedSlots) ||
        value.completedSlots > BigInt(value.requestedClockSlots) ||
        !unsigned32(value.terminalStatus) || !Number.isSafeInteger(value.reason) ||
        value.reason < 1 || value.reason > 4) {
      throw new TypeError("M6 fast failure runFraming is malformed");
    }
    const preBoundary = failureU64(value.preBoundary, "fast runFraming.preBoundary");
    const postBoundary = failureU64(value.postBoundary, "fast runFraming.postBoundary");
    if (postBoundary < preBoundary || postBoundary - preBoundary !== value.completedSlots ||
        value.reason !== 4) {
      throw new TypeError("M6 fast failure runFraming is not a terminal stop");
    }
    return Object.freeze({
      operation: value.operation,
      requestedClockSlots: value.requestedClockSlots,
      completedSlots: value.completedSlots.toString(),
      terminalStatus: value.terminalStatus,
      reason: value.reason,
      preBoundary,
      postBoundary,
    });
  }
  exactKeys(value, [
    "operation", "requestedClockSlots", "returnedBoundaryCount", "terminalStatus",
    "preCallBoundary", "cachedLastCompleteBoundary", "postCallAttemptedBoundary",
  ], "M6 failure runFraming");
  if (value.operation !== "run-digest-batch-m5" ||
      !Number.isSafeInteger(value.requestedClockSlots) ||
      value.requestedClockSlots <= 0 || !Number.isSafeInteger(value.returnedBoundaryCount) ||
      value.returnedBoundaryCount < 0 ||
      value.returnedBoundaryCount > value.requestedClockSlots ||
      !unsigned32(value.terminalStatus)) {
    throw new TypeError("M6 failure runFraming is malformed");
  }
  return Object.freeze({
    operation: value.operation,
    requestedClockSlots: value.requestedClockSlots,
    returnedBoundaryCount: value.returnedBoundaryCount,
    terminalStatus: value.terminalStatus,
    preCallBoundary: failureU64(value.preCallBoundary,
      "runFraming.preCallBoundary"),
    cachedLastCompleteBoundary: value.cachedLastCompleteBoundary === null ? null :
      failureU64(value.cachedLastCompleteBoundary, "runFraming.cachedLastCompleteBoundary"),
    postCallAttemptedBoundary: value.postCallAttemptedBoundary === null ? null :
      failureU64(value.postCallAttemptedBoundary, "runFraming.postCallAttemptedBoundary"),
  });
}

function normalizeFailureTranscript(records, label) {
  if (!Array.isArray(records) || records.length > CADR_M6_HARD_MAX_REPORT_TRANSACTIONS) {
    throw new TypeError(`${label} exceeds the bounded M6 transcript limit`);
  }
  return Object.freeze(records.map((record, index) => {
    exactKeys(record, [
      "ordinal", "actor", "guestBoundary", "dueBoundary", "generation", "requestId",
      "operation", "hostStatus", "descriptorByteCount", "requestPayloadByteCount",
      "completionByteCount", "descriptorSha256", "requestPayloadSha256",
      "completionSha256", "firstBlock", "blockCount", "blockBytes",
      "overlayGeneration",
    ], `${label}[${index}]`);
    if (!unsigned32(record.ordinal) || !["issue", "completion"].includes(record.actor)) {
      throw new TypeError(`${label}[${index}] has an invalid identity`);
    }
    return Object.freeze({
      ordinal: record.ordinal,
      actor: record.actor,
      guestBoundary: failureU64(record.guestBoundary, `${label}[${index}].guestBoundary`),
      dueBoundary: failureU64(record.dueBoundary, `${label}[${index}].dueBoundary`),
      generation: failureU64(record.generation, `${label}[${index}].generation`),
      requestId: failureU64(record.requestId, `${label}[${index}].requestId`),
      operation: failureU32(record.operation, `${label}[${index}].operation`),
      hostStatus: failureU32(record.hostStatus, `${label}[${index}].hostStatus`),
      descriptorByteCount: failureU64(
        record.descriptorByteCount, `${label}[${index}].descriptorByteCount`),
      requestPayloadByteCount: failureU64(
        record.requestPayloadByteCount, `${label}[${index}].requestPayloadByteCount`),
      completionByteCount: failureU64(
        record.completionByteCount, `${label}[${index}].completionByteCount`),
      descriptorSha256: failureDigest(record.descriptorSha256,
        `${label}[${index}].descriptorSha256`),
      requestPayloadSha256: failureDigest(record.requestPayloadSha256,
        `${label}[${index}].requestPayloadSha256`),
      completionSha256: failureDigest(record.completionSha256,
        `${label}[${index}].completionSha256`),
      firstBlock: failureU64(record.firstBlock, `${label}[${index}].firstBlock`),
      blockCount: failureU32(record.blockCount, `${label}[${index}].blockCount`),
      blockBytes: failureU32(record.blockBytes, `${label}[${index}].blockBytes`),
      overlayGeneration: failureU64(
        record.overlayGeneration, `${label}[${index}].overlayGeneration`),
    });
  }));
}

function normalizeFailurePreflight(value) {
  if (value === null) return null;
  exactKeys(value, ["profileId", "artifactSetSha256", "artifacts"],
    "M6 failure preflight");
  if (typeof value.profileId !== "string" || value.profileId.length === 0 ||
      !Array.isArray(value.artifacts) ||
      value.artifacts.length !== CADR_M6_REQUIRED_ARTIFACT_KINDS.length) {
    throw new TypeError("M6 failure preflight is incomplete");
  }
  const artifacts = value.artifacts.map((artifact, index) => {
    exactKeys(artifact, ["kind", "byteCount", "sha256"],
      `M6 failure preflight.artifacts[${index}]`);
    if (artifact.kind !== CADR_M6_REQUIRED_ARTIFACT_KINDS[index]) {
      throw new TypeError("M6 failure preflight changed the required artifact order");
    }
    return Object.freeze({
      kind: artifact.kind,
      byteCount: failureU64(artifact.byteCount,
        `M6 failure preflight.artifacts[${index}].byteCount`),
      sha256: failureDigest(artifact.sha256,
        `M6 failure preflight.artifacts[${index}].sha256`),
    });
  });
  return Object.freeze({
    profileId: value.profileId,
    artifactSetSha256: failureDigest(value.artifactSetSha256,
      "M6 failure preflight.artifactSetSha256"),
    artifacts: Object.freeze(artifacts),
  });
}

function normalizeFailureRunEvidence(value) {
  if (value === null) return null;
  exactKeys(value, ["sessionId", "privateDiskInstanceId", "privateDiskBaseSha256"],
    "M6 failure runEvidence");
  if (typeof value.sessionId !== "string" || value.sessionId.length === 0 ||
      typeof value.privateDiskInstanceId !== "string" ||
      value.privateDiskInstanceId.length === 0) {
    throw new TypeError("M6 failure run evidence is incomplete");
  }
  return Object.freeze({
    sessionId: value.sessionId,
    privateDiskInstanceId: value.privateDiskInstanceId,
    privateDiskBaseSha256: failureDigest(value.privateDiskBaseSha256,
      "M6 failure private disk base digest"),
  });
}

function normalizeUnimplementedDevice(value, reportBoundary) {
  exactKeys(value, ["schema", "site", "siteName", "direction", "address", "value",
    "result", "status", "boundary", "microinstructions", "wireSha256"],
  "M7-DEVID unimplemented-device diagnostic");
  const names = Object.freeze(new Map([[1, "physical-bus-read"],
    [2, "physical-bus-write"], [3, "guarded-bus-read"],
    [4, "guarded-bus-write"], [5, "iob-device-service"],
    [255, "core-unclassified"]]));
  const expectedDirection = [1, 3].includes(value.site) ? 1 :
    ([2, 4].includes(value.site) ? 2 : 0);
  if (value.schema !== "cadr-m7-unimplemented-device-v1" ||
      names.get(value.site) !== value.siteName || value.direction !== expectedDirection ||
      value.status !== CADR_STATUS_UNIMPLEMENTED_DEVICE ||
      !unsigned32(value.address) || !unsigned32(value.value) ||
      !unsigned32(value.result) || !unsigned64(value.boundary) ||
      !unsigned64(value.microinstructions) || value.boundary !== reportBoundary ||
      (value.direction === 0 &&
        (value.address !== 0 || value.value !== 0 || value.result !== 0)) ||
      (value.direction === 1 && value.value !== 0) ||
      (value.direction === 2 && value.result !== 0)) {
    throw new TypeError("M7-DEVID unimplemented-device diagnostic is malformed");
  }
  return Object.freeze({ schema: value.schema, site: value.site,
    siteName: value.siteName, direction: value.direction, address: value.address,
    value: value.value, result: value.result, status: value.status,
    boundary: failureU64(value.boundary, "M7-DEVID diagnostic boundary"),
    microinstructions: failureU64(value.microinstructions,
      "M7-DEVID diagnostic microinstructions"),
    wireSha256: failureDigest(value.wireSha256,
      "M7-DEVID diagnostic wire digest") });
}

function normalizeFailureReport(value, transcriptTail) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      value.schema !== CADR_M6_SCHEMA || ![1, 2].includes(value.schemaVersion) ||
      value.outcome !== "failed" || typeof value.reason !== "string" ||
      value.reason.length === 0 || typeof value.phase !== "string" ||
      value.phase.length === 0 || !unsigned32(value.status)) {
    throw new TypeError("M6 failure report has an invalid identity");
  }
  if (value.phase === "preflight") {
    if (value.schemaVersion !== 1) {
      throw new TypeError("M6 preflight failure cannot use a run-only schema version");
    }
    exactKeys(value, M6_FAILURE_PREFLIGHT_REPORT_KEYS, "M6 preflight failure report");
    if (typeof value.detail !== "string" || typeof value.mutationStarted !== "boolean" ||
        value.mutationStarted !== false) {
      throw new TypeError("M6 preflight failure report is not fail-closed");
    }
    return Object.freeze({
      schema: value.schema,
      schemaVersion: value.schemaVersion,
      outcome: value.outcome,
      reason: value.reason,
      phase: value.phase,
      status: value.status,
      detail: value.detail,
      mutationStarted: value.mutationStarted,
    });
  }
  exactKeys(value, value.schemaVersion === 2 ? M6_FAILURE_RUN_REPORT_V2_KEYS :
    M6_FAILURE_RUN_REPORT_KEYS, "M6 run failure report");
  if (value.schemaVersion === 2 &&
      value.status !== CADR_STATUS_UNIMPLEMENTED_DEVICE) {
    throw new TypeError("M6 failure schema version does not match terminal status");
  }
  const transactions = normalizeFailureTranscript(
    value.lastHostTransactions, "M6 failure report.lastHostTransactions");
  if (canonicalJson(transactions) !== canonicalJson(transcriptTail)) {
    throw new TypeError("M6 failure report transcript tail disagrees with the run evidence");
  }
  if (!Number.isSafeInteger(value.transcriptCount) ||
      value.transcriptCount < transactions.length ||
      typeof value.lifecycle !== "string" || value.lifecycle.length === 0) {
    throw new TypeError("M6 run failure report has invalid bounded state");
  }
  const boundary = failureU64(value.boundary, "M6 failure boundary");
  const unimplementedDevice = value.schemaVersion === 2 ?
    normalizeUnimplementedDevice(value.unimplementedDevice, value.boundary) : null;
  return Object.freeze({
    schema: value.schema,
    schemaVersion: value.schemaVersion,
    outcome: value.outcome,
    reason: value.reason,
    phase: value.phase,
    status: value.status,
    boundary,
    lifecycle: value.lifecycle,
    cdrstate5Sha256: failureDigest(value.cdrstate5Sha256,
      "M6 failure CDRSTATE5 digest", true),
    cdrm5q1Sha256: failureDigest(value.cdrm5q1Sha256,
      "M6 failure CDRM5Q1 digest", true),
    outstandingRequest: normalizeFailureOutstandingRequest(value.outstandingRequest),
    machineInfo: normalizeFailureMachineInfo(value.machineInfo),
    runFraming: normalizeFailureRunFraming(value.runFraming),
    transcriptCount: value.transcriptCount,
    lastHostTransactions: transactions,
    hostTranscriptSha256: failureDigest(value.hostTranscriptSha256,
      "M6 failure host transcript digest"),
    ...(unimplementedDevice === null ? {} : { unimplementedDevice }),
  });
}

/* Convert only the bounded, payload-free diagnostic that an inner failed run
 * already captured before its dedicated worker is disposed.  This is separate
 * from READY serialization: it never turns a failed run into success evidence. */
export function canonicalM6FailureDiagnostic(value) {
  exactKeys(value, M6_FAILURE_CONFORMANCE_KEYS,
    "cadr-m6-wasm-ready-conformance-v1 failure");
  if (value.schema !== "cadr-m6-wasm-ready-conformance-v1" ||
      value.outcome !== "failed" || !Number.isSafeInteger(value.completed_runs) ||
      value.completed_runs < 0 || value.completed_runs > 2 ||
      value.failed_run !== value.completed_runs) {
    throw new TypeError("M6 failure diagnostic is not a first-run conformance failure");
  }
  exactKeys(value.failure, M6_FAILURE_KEYS, "M6 failure diagnostic payload");
  const transcriptTail = normalizeFailureTranscript(
    value.failure.transcript_tail, "M6 failure transcript_tail");
  const report = normalizeFailureReport(value.failure.report, transcriptTail);
  if (report.phase !== "preflight" &&
      (value.failure.preflight === null || value.failure.run_evidence === null)) {
    throw new TypeError("M6 run failure omitted required private-run provenance");
  }
  return Object.freeze({
    schema: "cadr-m6-wasm-failure-diagnostic-v1",
    conformanceSchema: value.schema,
    outcome: value.outcome,
    completedRuns: value.completed_runs,
    failedRun: value.failed_run,
    failure: Object.freeze({
      preflight: normalizeFailurePreflight(value.failure.preflight),
      report,
      runEvidence: normalizeFailureRunEvidence(value.failure.run_evidence),
      transcriptTail,
    }),
  });
}

export function serializeM6FailureDiagnostic(value) {
  return captureM6FailureDiagnostic(value).bytes;
}

/* Keep the normalized object and its canonical bytes in one observation so
 * profile-specific consumers cannot validate one raw view and serialize a
 * later, drifting view. */
export function captureM6FailureDiagnostic(value) {
  const canonical = canonicalM6FailureDiagnostic(value);
  return Object.freeze({ canonical,
    bytes: new TextEncoder().encode(canonicalJson(canonical)) });
}

async function serializeM6ReadyConformanceInternal(value, production) {
  exactKeys(value, M6_CONFORMANCE_KEYS,
    "cadr-m6-wasm-ready-conformance-v1");
  if (value.contract !== CADR_M6_READY_CONTRACT ||
      value.target !== "CADR-WEB-303/ABI1.4/protocol-v4/M6" ||
      value.outcome !== "ready" || !Array.isArray(value.runs) ||
      value.runs.length !== 3) {
    throw new TypeError("invalid cadr-m6-wasm-ready-conformance-v1 identity");
  }
  digestHex(value.release_record_sha256, "release_record_sha256");
  digestHex(value.semantic_witness_sha256, "semantic_witness_sha256");
  if (production &&
      value.release_record_sha256 !== bytesHex(CADR_M6_RELEASE_RECORD_SHA256)) {
    throw new TypeError("production READY summary differs from the compiled release digest");
  }
  const sessionIds = new Set();
  const diskIds = new Set();
  for (const [index, run] of value.runs.entries()) {
    exactKeys(run, M6_CONFORMANCE_RUN_KEYS, `runs[${index}]`);
    if (run.run_index !== index || typeof run.session_id !== "string" ||
        run.session_id.length === 0 ||
        typeof run.private_disk_instance_id !== "string" ||
        run.private_disk_instance_id.length === 0 ||
        typeof run.no_pending_or_orphaned_host_request !== "boolean" ||
        run.no_pending_or_orphaned_host_request !== true) {
      throw new TypeError(`runs[${index}] is not a canonical READY summary`);
    }
    if (sessionIds.has(run.session_id) ||
        diskIds.has(run.private_disk_instance_id)) {
      throw new TypeError("READY summaries do not identify three fresh runs");
    }
    sessionIds.add(run.session_id);
    diskIds.add(run.private_disk_instance_id);
    for (const field of [
      "private_disk_base_sha256", "artifact_set_sha256", "cdrstate5_sha256",
      "cdrm5q1_sha256", "host_transcript_sha256", "semantic_witness_sha256",
    ]) digestHex(run[field], `runs[${index}].${field}`);
    if (production &&
        (run.artifact_set_sha256 !== CADR_M6_PINNED_ARTIFACT_SET_SHA256 ||
         run.private_disk_base_sha256 !== CADR_M6_PINNED_PRIVATE_DISK_BASE_SHA256)) {
      throw new TypeError(
        "production READY summary differs from pinned artifact or private-disk identity");
    }
    const boundaries = [];
    for (const field of [
      "form_a_boundary", "form_b_boundary", "listener_idle_c_boundary",
      "listener_idle_settled_boundary", "ready_boundary",
    ]) boundaries.push(
      decimalU64(run[field], `runs[${index}].${field}`));
    if (!(boundaries[0] < boundaries[1] &&
          boundaries[1] < boundaries[2] &&
          boundaries[2] < boundaries[3] &&
          boundaries[3] < boundaries[4])) {
      throw new TypeError("READY summary boundaries are not strictly ordered");
    }
    if (production &&
        (boundaries[0] !== CADR_M6_PINNED_READY_BOUNDARIES.formA ||
         boundaries[1] !== CADR_M6_PINNED_READY_BOUNDARIES.formB ||
         boundaries[2] !== CADR_M6_PINNED_READY_BOUNDARIES.listenerIdleC ||
         boundaries[3] !== CADR_M6_PINNED_READY_BOUNDARIES.listenerIdleSettled ||
         boundaries[4] !== CADR_M6_PINNED_READY_BOUNDARIES.ready)) {
      throw new TypeError("production READY summary differs from pinned native boundaries");
    }
    const expectedWitness = bytesHex(await canonicalM6ReadyWitnessV3({
      releaseRecordSha256: hexBytes(value.release_record_sha256),
      artifactSetSha256: hexBytes(run.artifact_set_sha256),
      privateDiskBaseSha256: hexBytes(run.private_disk_base_sha256),
      formABoundary: boundaries[0],
      formBBoundary: boundaries[1],
      listenerIdleCBoundary: boundaries[2],
      listenerIdleSettledBoundary: boundaries[3],
      readyBoundary: boundaries[4],
      cdrstate5Sha256: hexBytes(run.cdrstate5_sha256),
      cdrm5q1Sha256: hexBytes(run.cdrm5q1_sha256),
      hostTranscriptSha256: hexBytes(run.host_transcript_sha256),
      ...(production ? {
        nativeABoundary: CADR_M6_PINNED_READY_BOUNDARIES.formA,
        nativeBBoundary: CADR_M6_PINNED_READY_BOUNDARIES.formB,
        nativeListenerIdleCBoundary: CADR_M6_PINNED_READY_BOUNDARIES.listenerIdleC,
        nativeListenerIdleSettledBoundary:
          CADR_M6_PINNED_READY_BOUNDARIES.listenerIdleSettled,
        nativeReadyBoundary: CADR_M6_PINNED_READY_BOUNDARIES.ready,
      } : {}),
    }));
    if (run.semantic_witness_sha256 !== expectedWitness ||
        run.semantic_witness_sha256 !== value.semantic_witness_sha256) {
      throw new TypeError(
        "run semantic witness does not bind its READY summary");
    }
  }
  return new TextEncoder().encode(canonicalJson(value));
}

/* Production evidence has no caller-selectable release identity or observation
 * boundaries. The test-only serializer remains separate so fixture records can
 * exercise the state machine without weakening this gate. */
export async function serializeM6ReadyConformance(value) {
  return serializeM6ReadyConformanceInternal(value, true);
}

export async function serializeSyntheticM6ReadyConformanceForTest(value) {
  return serializeM6ReadyConformanceInternal(value, false);
}

export async function runM6HeadlessBootConformance(config) {
  return runM6HeadlessBootConformanceInternal(
    config, runM6HeadlessBoot, serializeM6ReadyConformance);
}

export async function runSyntheticM6HeadlessBootConformanceForTest(
  config, releaseRecord) {
  const ready = await validateM6ReleaseRecord(releaseRecord, false);
  return runM6HeadlessBootConformanceInternal(
    config,
    run => runM6HeadlessBootInternal({ ...run, ready }, ready),
    serializeSyntheticM6ReadyConformanceForTest);
}
