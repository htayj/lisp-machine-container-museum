/*
 * M7-only acknowledgement for a new write whose bytes already equal one
 * effective block.  M4's LBA-1 COMMIT and exact replay remain frozen; M6 owns
 * the public receipt because only M6 can bind the service decision to the
 * serialized CDRM6HS1 issue/completion records and a fresh effective read.
 */
import { m4OverlayRootForBase } from "./cadr-m4-media.mjs";

export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE =
  "CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v2";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_ARM_SCHEMA =
  "cadr-m7-effective-page-identity-arm-v2";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_CANDIDATE_SCHEMA =
  "cadr-m7-effective-page-identity-candidate-v3";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_EVIDENCE_SCHEMA =
  "cadr-m7-effective-page-identity-evidence-v4";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_SCHEMA =
  "cadr-m7-effective-page-identity-stream-v1";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISPOSITION = "IDENTITY_ACK";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION =
  "IDENTITY_ACK_STREAM";
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY = 1030044n;
export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_MAX_HOST_TRANSACTIONS = 2048;

export const CADR_M7_P4_IDENTITY_REQUEST = Object.freeze({
  generation: 1n,
  request_id: 135n,
  transaction_id: 135n,
  first_block: 1299n,
  boundary: 1366722n,
  payload_sha256: Uint8Array.from(
    "ba1b1cc2228edbe5028760e47687c6889023fc72221bd5c5f5be85c4cfbb6a00"
      .match(/../g), value => Number.parseInt(value, 16)),
  selected_base_byte_count: 269562880n,
  selected_base_sha256: Uint8Array.from(
    "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
      .match(/../g), value => Number.parseInt(value, 16)),
});

export const CADR_M7_P4_IDENTITY_ARM = Object.freeze({
  initial_commit: Object.freeze({ generation: 1n, request_id: 1n,
    transaction_id: 1n, first_block: 1n }),
  comparison_read: Object.freeze({ generation: 1n, request_id: 2n,
    transaction_id: 0n, first_block: 1n }),
  base_read: Object.freeze({ generation: 1n, request_id: 3n,
    transaction_id: 0n, first_block: 0n }),
  quiet_suffix: Object.freeze({ boundary: 1030044n, reason: 1,
    persistent_status: 0, outstanding_request_id: 0n }),
});

const BLOCK_BYTES = 1024;
const SHA256_BYTES = 32;
const HOST_TRANSCRIPT_HEADER_BYTES = 64;
const HOST_TRANSCRIPT_RECORD_BYTES = 256;
const EMPTY_SHA256 = Uint8Array.from(
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    .match(/../g), value => Number.parseInt(value, 16));

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function plainRecord(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) {
    throw new TypeError(`${label} has the wrong shape`);
  }
  return value;
}

function u32(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function u64(value) {
  return typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn;
}

function copyHash(value, label) {
  const bytes = bytesOf(value);
  if (bytes === null || bytes.byteLength !== SHA256_BYTES) {
    throw new TypeError(`${label} is not a SHA-256 value`);
  }
  return bytes.slice();
}

function copyBytes(value, count, label) {
  const bytes = bytesOf(value);
  if (bytes === null || bytes.byteLength !== count) {
    throw new TypeError(`${label} has the wrong byte count`);
  }
  return bytes.slice();
}

function sameBytes(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

async function sha256(value) {
  const bytes = bytesOf(value);
  if (bytes === null) throw new TypeError("SHA-256 input must be bytes");
  return new Uint8Array(await crypto.subtle.digest("SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
}

function freezeBootRequest(value, label, expectedBlock, write = false) {
  const record = plainRecord(value,
    ["completion_boundary", "first_block", "generation", "issue_boundary", "page_sha256",
      "request_id", "transaction_id"], label);
  if (!u64(record.generation) || !u64(record.request_id) ||
      !u64(record.transaction_id) ||
      (write ? record.transaction_id !== record.request_id :
        record.transaction_id !== 0n) ||
      !u64(record.first_block) || record.first_block !== expectedBlock ||
      !u64(record.issue_boundary) || !u64(record.completion_boundary) ||
      record.completion_boundary < record.issue_boundary) {
    throw new TypeError(`${label} is invalid`);
  }
  return Object.freeze({ generation: record.generation,
    request_id: record.request_id, transaction_id: record.transaction_id,
    issue_boundary: record.issue_boundary,
    completion_boundary: record.completion_boundary,
    first_block: record.first_block,
    page_sha256: copyHash(record.page_sha256, `${label} page`) });
}

function freezeArm(value) {
  const arm = plainRecord(value,
    ["base_read", "comparison_read", "initial_commit", "profile",
      "quiet_suffix", "schema"], "M7 effective-page identity arm");
  if (arm.schema !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_ARM_SCHEMA ||
      arm.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE) {
    throw new TypeError("M7 effective-page identity arm has the wrong identity");
  }
  const initial = freezeBootRequest(arm.initial_commit,
    "M7 effective-page initial commit", 1n, true);
  const comparison = freezeBootRequest(arm.comparison_read,
    "M7 effective-page comparison read", 1n);
  const baseRead = freezeBootRequest(arm.base_read,
    "M7 effective-page base read", 0n);
  const suffix = plainRecord(arm.quiet_suffix,
    ["boundary", "outstanding_request_id", "persistent_status", "reason"],
    "M7 effective-page quiet suffix");
  if (!u64(suffix.boundary) ||
      suffix.boundary < CADR_M7_EFFECTIVE_PAGE_IDENTITY_MIN_QUIET_BOUNDARY ||
      suffix.reason !== 1 || suffix.persistent_status !== 0 ||
      !u64(suffix.outstanding_request_id) || suffix.outstanding_request_id !== 0n ||
      comparison.issue_boundary < initial.completion_boundary ||
      baseRead.issue_boundary < comparison.completion_boundary ||
      suffix.boundary < baseRead.completion_boundary ||
      !sameBytes(initial.page_sha256, comparison.page_sha256)) {
    throw new TypeError("M7 effective-page identity arm is not the selected M4 suffix");
  }
  return Object.freeze({ schema: arm.schema, profile: arm.profile,
    initial_commit: initial, comparison_read: comparison, base_read: baseRead,
    quiet_suffix: Object.freeze({ boundary: suffix.boundary, reason: suffix.reason,
      persistent_status: suffix.persistent_status,
      outstanding_request_id: suffix.outstanding_request_id }) });
}

export const CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED = Object.freeze({
  enabled: false,
  profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
});

export function parseM7EffectivePageIdentityPolicy(value = undefined) {
  if (value === undefined) return CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED;
  const policy = plainRecord(value, ["enabled", "profile"],
    "M7 effective-page identity policy");
  if (typeof policy.enabled !== "boolean" ||
      policy.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE) {
    throw new TypeError("M7 effective-page identity policy is invalid");
  }
  return policy.enabled ? Object.freeze({ enabled: true, profile: policy.profile }) :
    CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED;
}

export function createM7EffectivePageIdentityArm(value) {
  return freezeArm(value);
}

function freezeMediaState(value, label) {
  const state = plainRecord(value,
    ["dirty", "overlay_generation", "overlay_root_sha256", "persistent", "staged"],
    label);
  if (typeof state.dirty !== "boolean" || !u64(state.overlay_generation) ||
      typeof state.persistent !== "boolean" || typeof state.staged !== "boolean") {
    throw new TypeError(`${label} is invalid`);
  }
  return Object.freeze({ dirty: state.dirty,
    overlay_generation: state.overlay_generation,
    overlay_root_sha256: copyHash(state.overlay_root_sha256, `${label} root`),
    persistent: state.persistent, staged: state.staged });
}

function freezePrecedingRead(value) {
  if (value === null) return null;
  const read = plainRecord(value,
    ["completion_boundary", "first_block", "generation", "issue_boundary",
      "page_sha256", "request_id"],
    "M7 effective-page preceding read");
  if (!u64(read.generation) || !u64(read.request_id) ||
      !u64(read.first_block) || !u64(read.issue_boundary) ||
      !u64(read.completion_boundary) ||
      read.completion_boundary < read.issue_boundary) {
    throw new TypeError("M7 effective-page preceding read is invalid");
  }
  return Object.freeze({ generation: read.generation,
    request_id: read.request_id, first_block: read.first_block,
    issue_boundary: read.issue_boundary,
    completion_boundary: read.completion_boundary,
    page_sha256: copyHash(read.page_sha256,
      "M7 effective-page preceding-read hash") });
}

function freezeCandidate(value) {
  const candidate = plainRecord(value,
    ["acknowledgement_ordinal", "arm", "completion_boundary", "descriptor", "due_boundary",
      "effective_page_sha256", "effective_source", "first_block", "generation",
      "host_status", "issue_boundary", "media_after", "media_before", "profile",
      "post_completion_target_sha256", "preceding_read", "pre_success_target_sha256",
      "request_id", "schema", "transaction_id"],
    "M7 effective-page identity candidate");
  if (candidate.schema !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_CANDIDATE_SCHEMA ||
      candidate.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE ||
      !u32(candidate.acknowledgement_ordinal) ||
      !u64(candidate.generation) || !u64(candidate.request_id) ||
      !u64(candidate.transaction_id) || candidate.transaction_id !== candidate.request_id ||
      !u64(candidate.first_block) || !u64(candidate.issue_boundary) ||
      !u64(candidate.due_boundary) || !u64(candidate.completion_boundary) ||
      candidate.due_boundary < candidate.issue_boundary ||
      candidate.completion_boundary < candidate.due_boundary ||
      candidate.host_status !== 0 || !["base", "overlay"].includes(candidate.effective_source)) {
    throw new TypeError("M7 effective-page identity candidate is invalid");
  }
  const effectiveHash = copyHash(candidate.effective_page_sha256,
    "M7 effective-page candidate hash");
  const preHash = copyHash(candidate.pre_success_target_sha256,
    "M7 effective-page pre-success target hash");
  const postHash = copyHash(candidate.post_completion_target_sha256,
    "M7 effective-page post-completion target hash");
  if (!sameBytes(effectiveHash, preHash) || !sameBytes(effectiveHash, postHash)) {
    throw new TypeError("M7 effective-page target rereads differ");
  }
  const descriptor = copyBytes(candidate.descriptor, 24,
    "M7 effective-page identity descriptor");
  const descriptorView = new DataView(descriptor.buffer, descriptor.byteOffset,
    descriptor.byteLength);
  if (descriptorView.getBigUint64(0, true) !== candidate.transaction_id ||
      descriptorView.getBigUint64(8, true) !== candidate.first_block ||
      descriptorView.getUint32(16, true) !== 1 ||
      descriptorView.getUint32(20, true) !== BLOCK_BYTES ||
      (candidate.first_block === 1n) !== (candidate.effective_source === "overlay")) {
    throw new TypeError("M7 effective-page identity descriptor or source differs");
  }
  return Object.freeze({ schema: candidate.schema, profile: candidate.profile,
    acknowledgement_ordinal: candidate.acknowledgement_ordinal,
    arm: freezeArm(candidate.arm), generation: candidate.generation,
    request_id: candidate.request_id, transaction_id: candidate.transaction_id,
    first_block: candidate.first_block, descriptor,
    effective_source: candidate.effective_source,
    effective_page_sha256: effectiveHash,
    pre_success_target_sha256: preHash,
    post_completion_target_sha256: postHash,
    preceding_read: freezePrecedingRead(candidate.preceding_read),
    issue_boundary: candidate.issue_boundary, due_boundary: candidate.due_boundary,
    completion_boundary: candidate.completion_boundary,
    host_status: candidate.host_status,
    media_before: freezeMediaState(candidate.media_before,
      "M7 effective-page media before"),
    media_after: freezeMediaState(candidate.media_after,
      "M7 effective-page media after") });
}

function parseHostTranscript(value) {
  const bytes = bytesOf(value);
  if (bytes === null || bytes.byteLength < HOST_TRANSCRIPT_HEADER_BYTES ||
      new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRM6HS1") {
    throw new TypeError("M7 effective-page evidence lacks CDRM6HS1 bytes");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset,
    HOST_TRANSCRIPT_HEADER_BYTES);
  const count = header.getUint32(20, true);
  if (header.getUint32(8, true) !== 1 ||
      header.getUint32(12, true) !== HOST_TRANSCRIPT_HEADER_BYTES ||
      header.getUint32(16, true) !== HOST_TRANSCRIPT_RECORD_BYTES ||
      bytes.byteLength !== HOST_TRANSCRIPT_HEADER_BYTES +
        count * HOST_TRANSCRIPT_RECORD_BYTES) {
    throw new TypeError("M7 effective-page CDRM6HS1 framing differs");
  }
  return Object.freeze({ bytes: bytes.slice(), count,
    artifact_set_sha256: bytes.slice(24, 56) });
}

function parseHostRecord(transcript, ordinal) {
  if (!u32(ordinal) || ordinal >= transcript.count) {
    throw new TypeError("M7 effective-page host ordinal is out of range");
  }
  const offset = HOST_TRANSCRIPT_HEADER_BYTES + ordinal * HOST_TRANSCRIPT_RECORD_BYTES;
  const bytes = transcript.bytes.slice(offset, offset + HOST_TRANSCRIPT_RECORD_BYTES);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getBigUint64(0, true) !== BigInt(ordinal) ||
      bytes.subarray(200).some(value => value !== 0)) {
    throw new TypeError("M7 effective-page CDRM6HS1 record is noncanonical");
  }
  return Object.freeze({ bytes, ordinal, actor: view.getUint32(8, true),
    operation: view.getUint32(12, true), guest_boundary: view.getBigUint64(16, true),
    due_boundary: view.getBigUint64(24, true), generation: view.getBigUint64(32, true),
    request_id: view.getBigUint64(40, true), host_status: view.getUint32(48, true),
    block_count: view.getUint32(52, true),
    descriptor_byte_count: view.getBigUint64(56, true),
    request_payload_byte_count: view.getBigUint64(64, true),
    completion_byte_count: view.getBigUint64(72, true),
    first_block: view.getBigUint64(80, true), block_bytes: view.getUint32(88, true),
    overlay_generation: view.getBigUint64(96, true),
    descriptor_sha256: bytes.slice(104, 136),
    request_payload_sha256: bytes.slice(136, 168),
    completion_sha256: bytes.slice(168, 200) });
}

function recordsMatchCandidate(issue, completion, candidate, descriptorSha256) {
  return issue.actor === 1 && completion.actor === 2 &&
    issue.operation === 2 && completion.operation === 2 &&
    completion.ordinal === issue.ordinal + 1 &&
    issue.guest_boundary === candidate.issue_boundary &&
    completion.guest_boundary === candidate.completion_boundary &&
    issue.due_boundary === candidate.due_boundary &&
    completion.due_boundary === candidate.due_boundary &&
    issue.generation === candidate.generation &&
    completion.generation === candidate.generation &&
    issue.request_id === candidate.request_id &&
    completion.request_id === candidate.request_id &&
    issue.host_status === candidate.host_status &&
    completion.host_status === candidate.host_status &&
    issue.block_count === 1 && completion.block_count === 1 &&
    issue.descriptor_byte_count === 24n && completion.descriptor_byte_count === 24n &&
    issue.request_payload_byte_count === BigInt(BLOCK_BYTES) &&
    completion.request_payload_byte_count === BigInt(BLOCK_BYTES) &&
    issue.completion_byte_count === 0n && completion.completion_byte_count === 0n &&
    issue.first_block === candidate.first_block &&
    completion.first_block === candidate.first_block &&
    issue.block_bytes === BLOCK_BYTES && completion.block_bytes === BLOCK_BYTES &&
    issue.overlay_generation === candidate.media_before.overlay_generation &&
    completion.overlay_generation === candidate.media_before.overlay_generation &&
    sameBytes(issue.descriptor_sha256, descriptorSha256) &&
    sameBytes(completion.descriptor_sha256, descriptorSha256) &&
    sameBytes(issue.request_payload_sha256, candidate.effective_page_sha256) &&
    sameBytes(completion.request_payload_sha256, candidate.effective_page_sha256) &&
    sameBytes(issue.completion_sha256, EMPTY_SHA256) &&
    sameBytes(completion.completion_sha256, EMPTY_SHA256);
}

function recordsMatchPrecedingRead(issue, completion, read) {
  return issue.actor === 1 && completion.actor === 2 &&
    issue.operation === 1 && completion.operation === 1 &&
    completion.ordinal === issue.ordinal + 1 &&
    issue.guest_boundary === read.issue_boundary &&
    completion.guest_boundary === read.completion_boundary &&
    issue.generation === read.generation && completion.generation === read.generation &&
    issue.request_id === read.request_id && completion.request_id === read.request_id &&
    issue.host_status === 0 && completion.host_status === 0 &&
    issue.block_count === 1 && completion.block_count === 1 &&
    issue.request_payload_byte_count === 0n &&
    completion.request_payload_byte_count === 0n &&
    issue.completion_byte_count === 1024n && completion.completion_byte_count === 1024n &&
    issue.first_block === read.first_block && completion.first_block === read.first_block &&
    issue.block_bytes === BLOCK_BYTES && completion.block_bytes === BLOCK_BYTES &&
    sameBytes(issue.completion_sha256, EMPTY_SHA256) &&
    sameBytes(completion.completion_sha256, read.page_sha256);
}

function validatePrecedingReadLink(transcript, candidatePair, read) {
  if (read === null) return;
  if (candidatePair.issue.ordinal < 2) {
    throw new TypeError("M7 effective-page preceding read is not adjacent");
  }
  const issue = parseHostRecord(transcript, candidatePair.issue.ordinal - 2);
  const completion = parseHostRecord(transcript, candidatePair.issue.ordinal - 1);
  if (!recordsMatchPrecedingRead(issue, completion, read)) {
    throw new TypeError("M7 effective-page preceding read differs from CDRM6HS1");
  }
}

function armDescriptor(record, write) {
  const bytes = new Uint8Array(write ? 24 : 16);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  if (write) {
    view.setBigUint64(0, record.transaction_id, true);
    offset = 8;
  }
  view.setBigUint64(offset, record.first_block, true);
  view.setUint32(offset + 8, 1, true);
  view.setUint32(offset + 12, BLOCK_BYTES, true);
  return bytes;
}

function recordsMatchArm(issue, completion, armRequest, write,
                         descriptorSha256) {
  const descriptorBytes = write ? 24n : 16n;
  const operation = write ? 2 : 1;
  return issue.actor === 1 && completion.actor === 2 &&
    issue.operation === operation && completion.operation === operation &&
    completion.ordinal === issue.ordinal + 1 &&
    issue.guest_boundary === armRequest.issue_boundary &&
    completion.guest_boundary === armRequest.completion_boundary &&
    issue.due_boundary === armRequest.completion_boundary &&
    completion.due_boundary === armRequest.completion_boundary &&
    issue.generation === armRequest.generation &&
    completion.generation === armRequest.generation &&
    issue.request_id === armRequest.request_id &&
    completion.request_id === armRequest.request_id &&
    issue.host_status === 0 && completion.host_status === 0 &&
    issue.block_count === 1 && completion.block_count === 1 &&
    issue.descriptor_byte_count === descriptorBytes &&
    completion.descriptor_byte_count === descriptorBytes &&
    issue.request_payload_byte_count === (write ? 1024n : 0n) &&
    completion.request_payload_byte_count === (write ? 1024n : 0n) &&
    issue.completion_byte_count === (write ? 0n : 1024n) &&
    completion.completion_byte_count === (write ? 0n : 1024n) &&
    issue.first_block === armRequest.first_block &&
    completion.first_block === armRequest.first_block &&
    issue.block_bytes === BLOCK_BYTES && completion.block_bytes === BLOCK_BYTES &&
    issue.overlay_generation === (write ? 0n : 1n) &&
    completion.overlay_generation === 1n &&
    sameBytes(issue.descriptor_sha256, descriptorSha256) &&
    sameBytes(completion.descriptor_sha256, descriptorSha256) &&
    sameBytes(issue.request_payload_sha256,
      write ? armRequest.page_sha256 : EMPTY_SHA256) &&
    sameBytes(completion.request_payload_sha256,
      write ? armRequest.page_sha256 : EMPTY_SHA256) &&
    sameBytes(issue.completion_sha256, EMPTY_SHA256) &&
    sameBytes(completion.completion_sha256,
      write ? EMPTY_SHA256 : armRequest.page_sha256);
}

function uniqueRecordPair(transcript, matches, label) {
  const pairs = [];
  for (let ordinal = 0; ordinal + 1 < transcript.count; ordinal += 1) {
    const issue = parseHostRecord(transcript, ordinal);
    const completion = parseHostRecord(transcript, ordinal + 1);
    if (matches(issue, completion)) pairs.push(Object.freeze({ issue, completion }));
  }
  if (pairs.length !== 1) {
    throw new TypeError(`M7 effective-page ${label} does not have one authoritative CDRM6HS1 pair`);
  }
  return pairs[0];
}

async function recordPairLink(pair) {
  const [issueSha256, completionSha256] = await Promise.all([
    sha256(pair.issue.bytes), sha256(pair.completion.bytes),
  ]);
  return Object.freeze({ issue_ordinal: pair.issue.ordinal,
    issue_record_sha256: issueSha256,
    completion_ordinal: pair.completion.ordinal,
    completion_record_sha256: completionSha256 });
}

async function authoritativeArmLinks(transcript, arm) {
  const definitions = [
    ["initial_commit", arm.initial_commit, true],
    ["comparison_read", arm.comparison_read, false],
    ["base_read", arm.base_read, false],
  ];
  const links = {};
  for (const [name, request, write] of definitions) {
    const descriptorSha256 = await sha256(armDescriptor(request, write));
    const pair = uniqueRecordPair(transcript,
      (issue, completion) => recordsMatchArm(issue, completion, request,
        write, descriptorSha256), `arm ${name}`);
    links[name] = await recordPairLink(pair);
  }
  const ordinals = Object.values(links).flatMap(link =>
    [link.issue_ordinal, link.completion_ordinal]);
  if (new Set(ordinals).size !== ordinals.length) {
    throw new TypeError("M7 effective-page arm record pairs overlap");
  }
  return Object.freeze(links);
}

function freezeRecordPairLink(value, label) {
  const link = plainRecord(value,
    ["completion_ordinal", "completion_record_sha256", "issue_ordinal",
      "issue_record_sha256"], label);
  if (!u32(link.issue_ordinal) || !u32(link.completion_ordinal) ||
      link.completion_ordinal !== link.issue_ordinal + 1) {
    throw new TypeError(`${label} is invalid`);
  }
  return Object.freeze({ issue_ordinal: link.issue_ordinal,
    issue_record_sha256: copyHash(link.issue_record_sha256, `${label} issue`),
    completion_ordinal: link.completion_ordinal,
    completion_record_sha256: copyHash(link.completion_record_sha256,
      `${label} completion`) });
}

function freezeArmLinks(value) {
  const links = plainRecord(value,
    ["base_read", "comparison_read", "initial_commit"],
    "M7 effective-page arm transcript links");
  return Object.freeze({
    initial_commit: freezeRecordPairLink(links.initial_commit,
      "M7 initial-commit transcript link"),
    comparison_read: freezeRecordPairLink(links.comparison_read,
      "M7 comparison-read transcript link"),
    base_read: freezeRecordPairLink(links.base_read,
      "M7 base-read transcript link"),
  });
}

function sameRecordPairLink(left, right) {
  return left.issue_ordinal === right.issue_ordinal &&
    left.completion_ordinal === right.completion_ordinal &&
    sameBytes(left.issue_record_sha256, right.issue_record_sha256) &&
    sameBytes(left.completion_record_sha256, right.completion_record_sha256);
}

function sameArmLinks(left, right) {
  return sameRecordPairLink(left.initial_commit, right.initial_commit) &&
    sameRecordPairLink(left.comparison_read, right.comparison_read) &&
    sameRecordPairLink(left.base_read, right.base_read);
}

function stableMedia(before, after) {
  return before.dirty && !before.staged && !before.persistent &&
    before.overlay_generation !== 0n &&
    before.dirty === after.dirty && before.staged === after.staged &&
    before.persistent === after.persistent &&
    before.overlay_generation === after.overlay_generation &&
    sameBytes(before.overlay_root_sha256, after.overlay_root_sha256);
}

export async function createM7EffectivePageIdentityAcknowledgement(value) {
  const input = plainRecord(value,
    ["candidate", "completion_ordinal", "effective_page_witness", "host_transcript",
      "issue_ordinal", "selected_base"],
    "M7 effective-page acknowledgement input");
  const candidate = freezeCandidate(input.candidate);
  const selectedBase = plainRecord(input.selected_base, ["byte_count", "sha256"],
    "M7 effective-page selected base");
  const witness = plainRecord(input.effective_page_witness,
    ["bytes", "effective_source", "first_block", "media"],
    "M7 effective-page trusted reread");
  if (!u64(selectedBase.byte_count) || !u32(input.issue_ordinal) ||
      !u32(input.completion_ordinal) ||
      input.completion_ordinal !== input.issue_ordinal + 1 ||
      !u64(witness.first_block) || witness.first_block !== candidate.first_block ||
      witness.effective_source !== candidate.effective_source) {
    throw new TypeError("M7 effective-page acknowledgement inputs differ");
  }
  const baseSha256 = copyHash(selectedBase.sha256, "M7 selected base hash");
  const witnessBytes = copyBytes(witness.bytes, BLOCK_BYTES,
    "M7 effective-page trusted reread bytes");
  const witnessMedia = freezeMediaState(witness.media,
    "M7 effective-page trusted reread media");
  const offset = candidate.first_block * BigInt(BLOCK_BYTES);
  const expectedOverlayRoot = await m4OverlayRootForBase(baseSha256,
    new Map([[1n, candidate.arm.initial_commit.page_sha256]]));
  if (offset > selectedBase.byte_count ||
      BigInt(BLOCK_BYTES) > selectedBase.byte_count - offset ||
      !stableMedia(candidate.media_before, candidate.media_after) ||
      !sameBytes(candidate.media_before.overlay_root_sha256,
        expectedOverlayRoot) ||
      candidate.media_after.overlay_generation !== witnessMedia.overlay_generation ||
      !sameBytes(candidate.media_after.overlay_root_sha256,
        witnessMedia.overlay_root_sha256)) {
    throw new TypeError("M7 effective-page acknowledgement changed or escaped media");
  }
  const [effectiveSha256, descriptorSha256] = await Promise.all([
    sha256(witnessBytes), sha256(candidate.descriptor),
  ]);
  if (!sameBytes(effectiveSha256, candidate.effective_page_sha256)) {
    throw new TypeError("M7 effective-page trusted reread differs from the write payload");
  }
  const transcript = parseHostTranscript(input.host_transcript);
  const candidatePair = uniqueRecordPair(transcript,
    (issue, completion) => recordsMatchCandidate(issue, completion, candidate,
      descriptorSha256), "candidate");
  validatePrecedingReadLink(transcript, candidatePair, candidate.preceding_read);
  const { issue, completion } = candidatePair;
  if (issue.ordinal !== input.issue_ordinal ||
      completion.ordinal !== input.completion_ordinal) {
    throw new TypeError("M7 effective-page candidate differs from CDRM6HS1");
  }
  const armRecords = await authoritativeArmLinks(transcript, candidate.arm);
  if (Object.values(armRecords).some(link =>
    link.completion_ordinal >= issue.ordinal) ||
      candidate.issue_boundary <= candidate.arm.quiet_suffix.boundary) {
    throw new TypeError("M7 effective-page candidate does not follow its authoritative arm");
  }
  const [transcriptSha256, candidateLink] = await Promise.all([
    sha256(transcript.bytes), recordPairLink(candidatePair),
  ]);
  return Object.freeze({
    schema: CADR_M7_EFFECTIVE_PAGE_IDENTITY_EVIDENCE_SCHEMA,
    profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
    disposition: CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISPOSITION,
    acknowledgement_ordinal: candidate.acknowledgement_ordinal,
    arm: candidate.arm,
    selected_base: Object.freeze({ byte_count: selectedBase.byte_count,
      sha256: baseSha256 }),
    request: Object.freeze({ generation: candidate.generation,
      request_id: candidate.request_id, transaction_id: candidate.transaction_id,
      first_block: candidate.first_block, block_count: 1,
      block_bytes: BLOCK_BYTES, issue_boundary: candidate.issue_boundary,
      due_boundary: candidate.due_boundary,
      completion_boundary: candidate.completion_boundary,
      descriptor: candidate.descriptor.slice(), descriptor_sha256: descriptorSha256,
      payload_sha256: effectiveSha256, host_status: candidate.host_status }),
    effective_page: Object.freeze({ source: candidate.effective_source,
      first_block: candidate.first_block, byte_offset: offset,
      byte_count: BLOCK_BYTES, sha256: effectiveSha256 }),
    target_rereads: Object.freeze({
      pre_success_sha256: candidate.pre_success_target_sha256,
      post_completion_sha256: candidate.post_completion_target_sha256,
    }),
    preceding_read: candidate.preceding_read,
    media_before: candidate.media_before,
    media_after: candidate.media_after,
    transcript: Object.freeze({ schema: "CDRM6HS1", sha256: transcriptSha256,
      artifact_set_sha256: transcript.artifact_set_sha256,
      issue_ordinal: candidateLink.issue_ordinal,
      issue_record_sha256: candidateLink.issue_record_sha256,
      completion_ordinal: candidateLink.completion_ordinal,
      completion_record_sha256: candidateLink.completion_record_sha256,
      arm_records: armRecords }),
  });
}

function freezeEvidence(value) {
  const evidence = plainRecord(value,
    ["acknowledgement_ordinal", "arm", "disposition", "effective_page",
      "media_after", "media_before", "profile", "request", "schema",
      "preceding_read", "selected_base", "target_rereads", "transcript"],
    "M7 effective-page acknowledgement evidence");
  if (evidence.schema !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_EVIDENCE_SCHEMA ||
      evidence.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE ||
      evidence.disposition !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISPOSITION ||
      !u32(evidence.acknowledgement_ordinal)) {
    throw new TypeError("M7 effective-page acknowledgement evidence identity differs");
  }
  const request = plainRecord(evidence.request,
    ["block_bytes", "block_count", "completion_boundary", "descriptor",
      "descriptor_sha256", "due_boundary", "first_block", "generation", "host_status",
      "issue_boundary", "payload_sha256", "request_id", "transaction_id"],
    "M7 effective-page evidence request");
  const page = plainRecord(evidence.effective_page,
    ["byte_count", "byte_offset", "first_block", "sha256", "source"],
    "M7 effective-page evidence page");
  const base = plainRecord(evidence.selected_base, ["byte_count", "sha256"],
    "M7 effective-page evidence base");
  const transcript = plainRecord(evidence.transcript,
    ["arm_records", "artifact_set_sha256", "completion_ordinal", "completion_record_sha256",
      "issue_ordinal", "issue_record_sha256", "schema", "sha256"],
    "M7 effective-page transcript link");
  const targetRereads = plainRecord(evidence.target_rereads,
    ["post_completion_sha256", "pre_success_sha256"],
    "M7 effective-page target rereads");
  if (!u64(request.generation) || !u64(request.request_id) ||
      !u64(request.transaction_id) || request.transaction_id !== request.request_id ||
      !u64(request.first_block) || request.block_count !== 1 ||
      request.block_bytes !== BLOCK_BYTES || !u64(request.issue_boundary) ||
      !u64(request.due_boundary) || !u64(request.completion_boundary) ||
      request.host_status !== 0 || !u64(page.first_block) ||
      page.first_block !== request.first_block || page.byte_count !== BLOCK_BYTES ||
      !u64(page.byte_offset) ||
      page.byte_offset !== request.first_block * BigInt(BLOCK_BYTES) ||
      !["base", "overlay"].includes(page.source) ||
      (request.first_block === 1n) !== (page.source === "overlay") ||
      !u64(base.byte_count) || transcript.schema !== "CDRM6HS1" ||
      !u32(transcript.issue_ordinal) || !u32(transcript.completion_ordinal) ||
      transcript.completion_ordinal !== transcript.issue_ordinal + 1) {
    throw new TypeError("M7 effective-page acknowledgement evidence is malformed");
  }
  const effectiveHash = copyHash(page.sha256, "M7 evidence effective hash");
  const preHash = copyHash(targetRereads.pre_success_sha256,
    "M7 evidence pre-success target hash");
  const postHash = copyHash(targetRereads.post_completion_sha256,
    "M7 evidence post-completion target hash");
  if (!sameBytes(effectiveHash, preHash) || !sameBytes(effectiveHash, postHash)) {
    throw new TypeError("M7 effective-page evidence target rereads differ");
  }
  return Object.freeze({ schema: evidence.schema, profile: evidence.profile,
    disposition: evidence.disposition,
    acknowledgement_ordinal: evidence.acknowledgement_ordinal,
    arm: freezeArm(evidence.arm),
    selected_base: Object.freeze({ byte_count: base.byte_count,
      sha256: copyHash(base.sha256, "M7 evidence selected base") }),
    request: Object.freeze({ generation: request.generation,
      request_id: request.request_id, transaction_id: request.transaction_id,
      first_block: request.first_block, block_count: request.block_count,
      block_bytes: request.block_bytes, issue_boundary: request.issue_boundary,
      due_boundary: request.due_boundary,
      completion_boundary: request.completion_boundary,
      descriptor: copyBytes(request.descriptor, 24, "M7 evidence descriptor"),
      descriptor_sha256: copyHash(request.descriptor_sha256,
        "M7 evidence descriptor hash"),
      payload_sha256: copyHash(request.payload_sha256,
        "M7 evidence payload hash"), host_status: request.host_status }),
    effective_page: Object.freeze({ source: page.source,
      first_block: page.first_block, byte_offset: page.byte_offset,
      byte_count: page.byte_count,
      sha256: effectiveHash }),
    target_rereads: Object.freeze({ pre_success_sha256: preHash,
      post_completion_sha256: postHash }),
    preceding_read: freezePrecedingRead(evidence.preceding_read),
    media_before: freezeMediaState(evidence.media_before,
      "M7 evidence media before"),
    media_after: freezeMediaState(evidence.media_after,
      "M7 evidence media after"),
    transcript: Object.freeze({ schema: transcript.schema,
      sha256: copyHash(transcript.sha256, "M7 evidence transcript hash"),
      artifact_set_sha256: copyHash(transcript.artifact_set_sha256,
        "M7 evidence artifact-set hash"), issue_ordinal: transcript.issue_ordinal,
      issue_record_sha256: copyHash(transcript.issue_record_sha256,
        "M7 evidence issue hash"), completion_ordinal: transcript.completion_ordinal,
      completion_record_sha256: copyHash(transcript.completion_record_sha256,
        "M7 evidence completion hash"),
      arm_records: freezeArmLinks(transcript.arm_records) }) });
}

export async function validateM7EffectivePageIdentityAcknowledgement(value, trusted) {
  const evidence = freezeEvidence(value);
  const authority = plainRecord(trusted,
    ["effective_page_bytes", "expected_base", "expected_effective_page_sha256",
      "host_transcript"],
    "M7 effective-page validation authority");
  const expectedBase = plainRecord(authority.expected_base,
    ["byte_count", "sha256"], "M7 trusted expected base");
  if (!u64(expectedBase.byte_count)) {
    throw new TypeError("M7 trusted expected base is invalid");
  }
  const expectedBaseSha256 = copyHash(expectedBase.sha256,
    "M7 trusted expected base hash");
  const offset = evidence.effective_page.byte_offset;
  if (evidence.selected_base.byte_count !== expectedBase.byte_count ||
      !sameBytes(evidence.selected_base.sha256, expectedBaseSha256) ||
      offset > expectedBase.byte_count ||
      BigInt(BLOCK_BYTES) > expectedBase.byte_count - offset) {
    throw new TypeError("M7 effective-page receipt differs from trusted base bounds");
  }
  const transcript = parseHostTranscript(authority.host_transcript);
  const descriptorSha256 = await sha256(evidence.request.descriptor);
  const candidate = Object.freeze({ schema: CADR_M7_EFFECTIVE_PAGE_IDENTITY_CANDIDATE_SCHEMA,
    profile: evidence.profile, acknowledgement_ordinal: evidence.acknowledgement_ordinal,
    arm: evidence.arm,
    generation: evidence.request.generation, request_id: evidence.request.request_id,
    transaction_id: evidence.request.transaction_id,
    first_block: evidence.request.first_block, descriptor: evidence.request.descriptor,
    effective_source: evidence.effective_page.source,
    effective_page_sha256: evidence.effective_page.sha256,
    pre_success_target_sha256: evidence.target_rereads.pre_success_sha256,
    post_completion_target_sha256: evidence.target_rereads.post_completion_sha256,
    preceding_read: evidence.preceding_read,
    issue_boundary: evidence.request.issue_boundary,
    due_boundary: evidence.request.due_boundary,
    completion_boundary: evidence.request.completion_boundary,
    host_status: evidence.request.host_status,
    media_before: evidence.media_before, media_after: evidence.media_after });
  const candidatePair = uniqueRecordPair(transcript,
    (issue, completion) => recordsMatchCandidate(issue, completion, candidate,
      descriptorSha256), "candidate");
  validatePrecedingReadLink(transcript, candidatePair, evidence.preceding_read);
  const [transcriptSha256, candidateLink, trustedArmLinks,
    expectedOverlayRoot] = await Promise.all([
      sha256(transcript.bytes), recordPairLink(candidatePair),
      authoritativeArmLinks(transcript, evidence.arm),
      m4OverlayRootForBase(expectedBaseSha256,
        new Map([[1n, evidence.arm.initial_commit.page_sha256]])),
    ]);
  if (candidateLink.issue_ordinal !== evidence.transcript.issue_ordinal ||
      candidateLink.completion_ordinal !== evidence.transcript.completion_ordinal ||
      !sameBytes(candidateLink.issue_record_sha256,
        evidence.transcript.issue_record_sha256) ||
      !sameBytes(candidateLink.completion_record_sha256,
        evidence.transcript.completion_record_sha256) ||
      !sameArmLinks(trustedArmLinks, evidence.transcript.arm_records) ||
      Object.values(trustedArmLinks).some(link =>
        link.completion_ordinal >= candidateLink.issue_ordinal) ||
      evidence.request.issue_boundary <= evidence.arm.quiet_suffix.boundary ||
      !sameBytes(descriptorSha256, evidence.request.descriptor_sha256) ||
      !sameBytes(evidence.request.payload_sha256, evidence.effective_page.sha256) ||
      !stableMedia(evidence.media_before, evidence.media_after) ||
      !sameBytes(evidence.media_before.overlay_root_sha256,
        expectedOverlayRoot) ||
      !sameBytes(transcriptSha256, evidence.transcript.sha256) ||
      !sameBytes(transcript.artifact_set_sha256,
        evidence.transcript.artifact_set_sha256)) {
    throw new TypeError("M7 effective-page acknowledgement differs from trusted evidence");
  }
  const expected = authority.expected_effective_page_sha256 === null ? null :
    copyHash(authority.expected_effective_page_sha256,
      "M7 trusted expected effective-page hash");
  const pageBytes = authority.effective_page_bytes === null ? null :
    copyBytes(authority.effective_page_bytes, BLOCK_BYTES,
      "M7 trusted effective-page bytes");
  if ((expected === null) === (pageBytes === null)) {
    throw new TypeError("M7 validation needs exactly one independent page authority");
  }
  const trustedHash = expected ?? await sha256(pageBytes);
  if (!sameBytes(trustedHash, evidence.effective_page.sha256)) {
    throw new TypeError("M7 effective-page receipt differs from independent page authority");
  }
  return evidence;
}

export async function validateSelectedM7P4EffectivePageIdentityAcknowledgement(
  value, hostTranscript) {
  const evidence = await validateM7EffectivePageIdentityAcknowledgement(value, {
    host_transcript: hostTranscript,
    effective_page_bytes: null,
    expected_effective_page_sha256: CADR_M7_P4_IDENTITY_REQUEST.payload_sha256,
    expected_base: { byte_count: CADR_M7_P4_IDENTITY_REQUEST.selected_base_byte_count,
      sha256: CADR_M7_P4_IDENTITY_REQUEST.selected_base_sha256 },
  });
  const selected = CADR_M7_P4_IDENTITY_REQUEST;
  const selectedArm = CADR_M7_P4_IDENTITY_ARM;
  const arm = evidence.arm;
  if (evidence.acknowledgement_ordinal !== 0 ||
      evidence.request.generation !== selected.generation ||
      evidence.request.request_id !== selected.request_id ||
      evidence.request.transaction_id !== selected.transaction_id ||
      evidence.request.first_block !== selected.first_block ||
      evidence.request.issue_boundary !== selected.boundary ||
      evidence.request.due_boundary !== selected.boundary ||
      evidence.request.completion_boundary !== selected.boundary ||
      evidence.effective_page.source !== "base" ||
      !sameBytes(evidence.request.payload_sha256, selected.payload_sha256) ||
      evidence.selected_base.byte_count !== selected.selected_base_byte_count ||
      !sameBytes(evidence.selected_base.sha256, selected.selected_base_sha256) ||
      evidence.media_before.overlay_generation !== 1n ||
      evidence.media_after.overlay_generation !== 1n ||
      arm.initial_commit.generation !== selectedArm.initial_commit.generation ||
      arm.initial_commit.request_id !== selectedArm.initial_commit.request_id ||
      arm.initial_commit.transaction_id !== selectedArm.initial_commit.transaction_id ||
      arm.initial_commit.first_block !== selectedArm.initial_commit.first_block ||
      arm.comparison_read.generation !== selectedArm.comparison_read.generation ||
      arm.comparison_read.request_id !== selectedArm.comparison_read.request_id ||
      arm.comparison_read.transaction_id !== selectedArm.comparison_read.transaction_id ||
      arm.comparison_read.first_block !== selectedArm.comparison_read.first_block ||
      arm.base_read.generation !== selectedArm.base_read.generation ||
      arm.base_read.request_id !== selectedArm.base_read.request_id ||
      arm.base_read.transaction_id !== selectedArm.base_read.transaction_id ||
      arm.base_read.first_block !== selectedArm.base_read.first_block ||
      arm.quiet_suffix.boundary !== selectedArm.quiet_suffix.boundary ||
      arm.quiet_suffix.reason !== selectedArm.quiet_suffix.reason ||
      arm.quiet_suffix.persistent_status !== selectedArm.quiet_suffix.persistent_status ||
      arm.quiet_suffix.outstanding_request_id !==
        selectedArm.quiet_suffix.outstanding_request_id) {
    throw new TypeError("M7 effective-page acknowledgement is not the selected P4 request");
  }
  return evidence;
}

function sameArm(left, right) {
  return canonicalEvidence(freezeArm(left)) === canonicalEvidence(freezeArm(right));
}

function freezeStream(value) {
  const stream = plainRecord(value,
    ["acknowledgements", "count", "disposition", "first", "host_transcript",
      "profile", "schema"], "M7 effective-page identity stream");
  if (stream.schema !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_SCHEMA ||
      stream.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE ||
      stream.disposition !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION ||
      !u32(stream.count) || stream.count === 0 ||
      !Array.isArray(stream.acknowledgements) ||
      stream.acknowledgements.length !== stream.count) {
    throw new TypeError("M7 effective-page identity stream has the wrong shape");
  }
  const first = plainRecord(stream.first,
    ["boundary", "first_block", "generation", "request_id", "transaction_id"],
    "M7 effective-page identity stream first tuple");
  const transcript = plainRecord(stream.host_transcript,
    ["artifact_set_sha256", "byte_count", "record_count", "schema", "sha256"],
    "M7 effective-page identity stream transcript");
  if (!u64(first.boundary) || !u64(first.first_block) ||
      !u64(first.generation) || !u64(first.request_id) ||
      !u64(first.transaction_id) || transcript.schema !== "CDRM6HS1" ||
      !u64(transcript.byte_count) || !u32(transcript.record_count)) {
    throw new TypeError("M7 effective-page identity stream metadata is invalid");
  }
  const acknowledgements = stream.acknowledgements.map(freezeEvidence);
  for (let index = 0; index < acknowledgements.length; index += 1) {
    const current = acknowledgements[index];
    if (current.acknowledgement_ordinal !== index ||
        !sameArm(current.arm, acknowledgements[0].arm) ||
        !sameBytes(current.selected_base.sha256,
          acknowledgements[0].selected_base.sha256) ||
        current.selected_base.byte_count !== acknowledgements[0].selected_base.byte_count ||
        !sameBytes(current.transcript.sha256, transcript.sha256) ||
        !sameBytes(current.transcript.artifact_set_sha256,
          transcript.artifact_set_sha256) ||
        (index !== 0 &&
          (current.request.generation !== 1n ||
           current.request.request_id <= acknowledgements[index - 1].request.request_id ||
           current.request.issue_boundary <
             acknowledgements[index - 1].request.completion_boundary ||
           current.transcript.issue_ordinal <=
             acknowledgements[index - 1].transcript.completion_ordinal))) {
      throw new TypeError("M7 effective-page identity stream ordering differs");
    }
  }
  const selected = acknowledgements[0].request;
  if (first.boundary !== selected.issue_boundary ||
      first.first_block !== selected.first_block ||
      first.generation !== selected.generation ||
      first.request_id !== selected.request_id ||
      first.transaction_id !== selected.transaction_id) {
    throw new TypeError("M7 effective-page identity stream first tuple differs");
  }
  return Object.freeze({ schema: stream.schema, profile: stream.profile,
    disposition: stream.disposition, count: stream.count,
    first: Object.freeze({ boundary: first.boundary, first_block: first.first_block,
      generation: first.generation, request_id: first.request_id,
      transaction_id: first.transaction_id }),
    host_transcript: Object.freeze({ schema: transcript.schema,
      byte_count: transcript.byte_count, record_count: transcript.record_count,
      sha256: copyHash(transcript.sha256, "M7 stream transcript hash"),
      artifact_set_sha256: copyHash(transcript.artifact_set_sha256,
        "M7 stream artifact-set hash") }),
    acknowledgements: Object.freeze(acknowledgements) });
}

export async function createM7EffectivePageIdentityStream(value) {
  const input = plainRecord(value, ["acknowledgements", "host_transcript"],
    "M7 effective-page identity stream input");
  if (!Array.isArray(input.acknowledgements) || input.acknowledgements.length === 0) {
    throw new TypeError("M7 effective-page identity stream needs acknowledgements");
  }
  const transcript = parseHostTranscript(input.host_transcript);
  const transcriptSha256 = await sha256(transcript.bytes);
  const first = freezeEvidence(input.acknowledgements[0]);
  const stream = freezeStream({ schema: CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_SCHEMA,
    profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
    disposition: CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION,
    count: input.acknowledgements.length,
    first: { boundary: first.request.issue_boundary,
      first_block: first.request.first_block, generation: first.request.generation,
      request_id: first.request.request_id,
      transaction_id: first.request.transaction_id },
    host_transcript: { schema: "CDRM6HS1", byte_count: BigInt(transcript.bytes.byteLength),
      record_count: transcript.count, sha256: transcriptSha256,
      artifact_set_sha256: transcript.artifact_set_sha256 },
    acknowledgements: input.acknowledgements });
  await validateSelectedM7P4EffectivePageIdentityAcknowledgement(
    stream.acknowledgements[0], transcript.bytes);
  return stream;
}

export async function validateM7EffectivePageIdentityStream(value, trusted) {
  const stream = freezeStream(value);
  const authority = plainRecord(trusted, ["expected_base", "host_transcript"],
    "M7 effective-page stream validation authority");
  const transcript = parseHostTranscript(authority.host_transcript);
  const transcriptSha256 = await sha256(transcript.bytes);
  if (stream.host_transcript.byte_count !== BigInt(transcript.bytes.byteLength) ||
      stream.host_transcript.record_count !== transcript.count ||
      !sameBytes(stream.host_transcript.sha256, transcriptSha256) ||
      !sameBytes(stream.host_transcript.artifact_set_sha256,
        transcript.artifact_set_sha256)) {
    throw new TypeError("M7 effective-page stream transcript differs");
  }
  const expectedBase = plainRecord(authority.expected_base,
    ["byte_count", "sha256"], "M7 effective-page stream trusted base");
  for (const acknowledgement of stream.acknowledgements) {
    await validateM7EffectivePageIdentityAcknowledgement(acknowledgement, {
      host_transcript: transcript.bytes, effective_page_bytes: null,
      expected_effective_page_sha256: acknowledgement.effective_page.sha256,
      expected_base: expectedBase,
    });
  }
  await validateSelectedM7P4EffectivePageIdentityAcknowledgement(
    stream.acknowledgements[0], transcript.bytes);
  return stream;
}

function canonicalEvidence(value) {
  const bytes = bytesOf(value);
  if (bytes !== null) {
    return JSON.stringify({ bytes: [...bytes].map(item =>
      item.toString(16).padStart(2, "0")).join("") });
  }
  if (typeof value === "bigint") return JSON.stringify({ u64: value.toString() });
  if (Array.isArray(value)) return `[${value.map(canonicalEvidence).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalEvidence(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function m7EffectivePageIdentityAcknowledgementSha256(value) {
  const bytes = new TextEncoder().encode(canonicalEvidence(freezeEvidence(value)));
  return sha256(bytes);
}

export function serializeM7EffectivePageIdentityStream(value) {
  return new TextEncoder().encode(`${canonicalEvidence(freezeStream(value))}\n`);
}

export async function m7EffectivePageIdentityStreamSha256(value) {
  return sha256(serializeM7EffectivePageIdentityStream(value));
}
