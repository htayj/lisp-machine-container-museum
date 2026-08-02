import assert from "node:assert/strict";

import {
  CADR_HOST_OPERATION_BLOCK_READ,
  CADR_HOST_OPERATION_BLOCK_WRITE,
  CADR_HOST_RESULT_FAILED,
  CADR_HOST_RESULT_OK,
  CADR_M4_BLOCK_FAULT_STATUS_FAILED,
  CADR_STATUS_ARTIFACT_MISMATCH,
  CADR_STATUS_NOT_READY,
  CADR_STATUS_OK,
  createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";
import { serializeM6HostTranscript } from
  "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  CADR_M7_P4_IDENTITY_REQUEST,
  createM7EffectivePageIdentityAcknowledgement,
  createM7EffectivePageIdentityStream,
  parseM7EffectivePageIdentityPolicy,
  serializeM7EffectivePageIdentityStream,
  validateM7EffectivePageIdentityStream,
} from "../cadr-web/wasm/cadr-m7-effective-page-identity.mjs";

const BLOCK_BYTES = 1024;
const EMPTY = new Uint8Array(0);
const H = value => new Uint8Array(32).fill(value);
const originalCrypto = crypto;
const realDigest = crypto.subtle.digest.bind(crypto.subtle);
const selectedPage = new Uint8Array(BLOCK_BYTES).fill(0xa5);
const secondPage = new Uint8Array(BLOCK_BYTES).fill(0x5a);

/* The licensed selected page is not a tracked test fixture.  This narrow test
 * oracle supplies only its already-public digest for a synthetic marker page;
 * all other SHA-256 operations use the platform implementation. */
const testCrypto = Object.freeze({ subtle: Object.freeze({
  async digest(algorithm, value) {
    const bytes = new Uint8Array(value);
    if (bytes.byteLength === BLOCK_BYTES && bytes.every(byte => byte === 0xa5)) {
      return CADR_M7_P4_IDENTITY_REQUEST.payload_sha256.slice().buffer;
    }
    return realDigest(algorithm, value);
  },
}) });
Object.defineProperty(globalThis, "crypto", { configurable: true, value: testCrypto });

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

function readDescriptor(firstBlock) {
  const bytes = new Uint8Array(16); const view = new DataView(bytes.buffer);
  view.setBigUint64(0, firstBlock, true); view.setUint32(8, 1, true);
  view.setUint32(12, BLOCK_BYTES, true); return bytes;
}

function writeDescriptor(id, firstBlock, blockCount = 1) {
  const bytes = new Uint8Array(24); const view = new DataView(bytes.buffer);
  view.setBigUint64(0, id, true); view.setBigUint64(8, firstBlock, true);
  view.setUint32(16, blockCount, true); view.setUint32(20, BLOCK_BYTES, true);
  return bytes;
}

function hostRequest(operation, id, descriptor, payload, completionByteCount) {
  return { status: CADR_STATUS_OK, request: { operation, generation: 1n,
    requestId: id, descriptorByteCount: BigInt(descriptor.byteLength),
    requestPayloadByteCount: BigInt(payload.byteLength),
    completionByteCount: BigInt(completionByteCount) }, descriptor,
    requestPayload: payload };
}

function readRequest(id, firstBlock) {
  return hostRequest(CADR_HOST_OPERATION_BLOCK_READ, id,
    readDescriptor(firstBlock), EMPTY, BLOCK_BYTES);
}

function writeRequest(id, firstBlock, payload, blockCount = 1) {
  return hostRequest(CADR_HOST_OPERATION_BLOCK_WRITE, id,
    writeDescriptor(id, firstBlock, blockCount), payload, 0);
}

function readerFixture(hooks = {}) {
  const pages = new Map([
    [1299n, selectedPage], [1300n, secondPage],
    [187956n, selectedPage], [187957n, secondPage],
  ]);
  return { imageByteCount: CADR_M7_P4_IDENTITY_REQUEST.selected_base_byte_count,
    async readRange(offset, count) {
      assert.equal(count, 1024n);
      const block = offset / 1024n;
      const ordinary = pages.get(block) ??
        Uint8Array.from({ length: BLOCK_BYTES }, (_, index) =>
          Number((block + BigInt(index * 17)) & 255n));
      const supplied = hooks.read === undefined ? ordinary :
        await hooks.read(block, ordinary.slice());
      if (supplied instanceof Error) throw supplied;
      return supplied;
    } };
}

async function poll(service, tick, next, events, completionStatus = CADR_STATUS_OK) {
  const result = await service.poll({ tick, nextRequest: async () => next,
    complete: async () => ({ status: completionStatus }) });
  events.push(...result.events); return result;
}

async function armedService(options = {}) {
  const reader = readerFixture(options.hooks);
  const service = createM4BlockRangeService({ ...reader,
    expectedImageByteCount: reader.imageByteCount,
    selectedBaseSha256: CADR_M7_P4_IDENTITY_REQUEST.selected_base_sha256,
    m7EffectivePageIdentityPolicy: { enabled: true,
      profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE },
    ...options.service });
  const events = []; const overlay = new Uint8Array(BLOCK_BYTES).fill(0x33);
  await poll(service, 1n, writeRequest(1n, 1n, overlay), events);
  await poll(service, 2n, readRequest(2n, 1n), events);
  await poll(service, 3n, readRequest(3n, 0n), events);
  const arm = await service.observeM7EffectivePageIdentityQuietSuffix({
    boundary: 1030044n, reason: 1, persistentStatus: 0,
    outstandingRequestId: 0n });
  assert.notEqual(arm, null); return { service, events, reader, arm, overlay };
}

async function transcriptRecord(event, ordinal) {
  const descriptor = event.descriptor ?? EMPTY;
  const payload = event.requestPayload ?? EMPTY;
  const completion = event.completionDelivered &&
    event.operation === CADR_HOST_OPERATION_BLOCK_READ ? event.pageBytes : EMPTY;
  return { ordinal, actor: event.requestSeen ? "issue" : "completion",
    guestBoundary: event.requestSeen ? event.issueTick : event.deliveryTick,
    dueBoundary: event.dueTick, generation: event.generation,
    requestId: event.requestId, operation: event.operation,
    hostStatus: event.hostStatus,
    descriptorByteCount: BigInt(descriptor.byteLength),
    requestPayloadByteCount: event.requestPayloadByteCount,
    completionByteCount: event.completionByteCount,
    descriptorSha256: await sha256(descriptor),
    requestPayloadSha256: await sha256(payload),
    completionSha256: await sha256(completion), firstBlock: event.firstBlock,
    blockCount: event.blockCount, blockBytes: event.blockBytes,
    overlayGeneration: event.overlayGeneration };
}

async function selectedStream() {
  const selected = await armedService();
  await poll(selected.service, 1366543n, readRequest(134n, 187956n), selected.events);
  await poll(selected.service, 1366722n, writeRequest(135n, 1299n, selectedPage),
    selected.events);
  await poll(selected.service, 1366946n, readRequest(136n, 187957n), selected.events);
  await poll(selected.service, 1367125n, writeRequest(137n, 1300n, secondPage),
    selected.events);
  const records = await Promise.all(selected.events.map(transcriptRecord));
  const transcript = serializeM6HostTranscript(records, H(0x55));
  const candidates = selected.service.m7EffectivePageIdentityCandidates();
  const witnesses = selected.service.m7EffectivePageIdentityWitnesses();
  assert.equal(candidates.length, 2); assert.equal(witnesses.length, 2);
  const acknowledgements = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const completion = selected.events.findIndex(event =>
      event.identityAcknowledgementCandidate === candidates[index]);
    acknowledgements.push(await createM7EffectivePageIdentityAcknowledgement({
      candidate: candidates[index], issue_ordinal: completion - 1,
      completion_ordinal: completion, host_transcript: transcript,
      selected_base: { byte_count: CADR_M7_P4_IDENTITY_REQUEST.selected_base_byte_count,
        sha256: CADR_M7_P4_IDENTITY_REQUEST.selected_base_sha256 },
      effective_page_witness: witnesses[index],
    }));
  }
  const stream = await createM7EffectivePageIdentityStream({ acknowledgements,
    host_transcript: transcript });
  return { ...selected, transcript, stream };
}

async function testDefaultAndSelectedStream() {
  assert.strictEqual(parseM7EffectivePageIdentityPolicy(),
    CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED);
  const selected = await selectedStream();
  assert.equal(selected.stream.disposition, "IDENTITY_ACK_STREAM");
  assert.equal(selected.stream.count, 2);
  assert.deepEqual(selected.stream.acknowledgements.map(value =>
    [value.acknowledgement_ordinal, value.request.request_id,
      value.request.first_block]), [[0, 135n, 1299n], [1, 137n, 1300n]]);
  assert.equal(selected.stream.acknowledgements[0].preceding_read.request_id, 134n);
  assert.equal(selected.stream.acknowledgements[1].preceding_read.request_id, 136n);
  assert.equal(selected.service.overlayGeneration(), 1n);
  await assert.doesNotReject(() => validateM7EffectivePageIdentityStream(
    selected.stream, { host_transcript: selected.transcript,
      expected_base: { byte_count: CADR_M7_P4_IDENTITY_REQUEST.selected_base_byte_count,
        sha256: CADR_M7_P4_IDENTITY_REQUEST.selected_base_sha256 } }));
  assert.equal(serializeM7EffectivePageIdentityStream(selected.stream).at(-1), 10);

  for (const mutate of [
    value => { value.acknowledgements.reverse(); },
    value => { value.count = 1; },
    value => { value.first.request_id = 137n; },
    value => { value.host_transcript.sha256[0] ^= 1; },
    value => { value.acknowledgements[1].transcript.issue_ordinal =
      value.acknowledgements[0].transcript.issue_ordinal; },
  ]) {
    const forged = structuredClone(selected.stream); mutate(forged);
    await assert.rejects(() => validateM7EffectivePageIdentityStream(forged, {
      host_transcript: selected.transcript,
      expected_base: { byte_count: CADR_M7_P4_IDENTITY_REQUEST.selected_base_byte_count,
        sha256: CADR_M7_P4_IDENTITY_REQUEST.selected_base_sha256 } }));
  }
}

async function testPoisoning() {
  for (const issue of [
    selected => writeRequest(135n, 1299n, secondPage),
    selected => writeRequest(135n, 1299n, selectedPage, 2),
  ]) {
    const selected = await armedService();
    const result = await poll(selected.service, 1366722n, issue(selected), selected.events);
    assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
    assert.equal(selected.service.m7EffectivePageIdentityStatus().phase, "poisoned");
  }

  const replay = await selectedStream();
  const replayResult = await poll(replay.service, 1367300n,
    writeRequest(1n, 1n, replay.overlay), replay.events);
  assert.equal(replayResult.events.at(-1).hostStatus, CADR_HOST_RESULT_OK);
  assert.equal(replayResult.events.at(-1).overlayReplayed, true,
    "the sole committed request-1 replay keeps precedence while streaming");
  assert.equal(replay.service.m7EffectivePageIdentityStatus().phase, "streaming");
  assert.equal(replay.service.m7EffectivePageIdentityCandidates().length, 2);
  const streamReplay = await poll(replay.service, 1367400n,
    writeRequest(137n, 1300n, secondPage), replay.events);
  assert.equal(streamReplay.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
  assert.equal(replay.service.m7EffectivePageIdentityStatus().phase, "poisoned",
    "an acknowledgement-stream member is never replayable");

  const faulted = await armedService({ service: { faultMask:
    CADR_M4_BLOCK_FAULT_STATUS_FAILED, faultOperation: CADR_HOST_OPERATION_BLOCK_WRITE,
    faultFirstBlock: 1299n, faultOccurrence: 1n } });
  await poll(faulted.service, 1366722n,
    writeRequest(135n, 1299n, selectedPage), faulted.events);
  assert.equal(faulted.service.m7EffectivePageIdentityStatus().phase, "poisoned");

  let targetReads = 0;
  const drifted = await armedService({ hooks: { async read(block, bytes) {
    if (block === 1299n && ++targetReads === 2) bytes[0] ^= 1;
    return bytes;
  } } });
  const drift = await poll(drifted.service, 1366722n,
    writeRequest(135n, 1299n, selectedPage), drifted.events);
  assert.equal(drift.status, CADR_STATUS_ARTIFACT_MISMATCH);
  assert.equal(drifted.service.m7EffectivePageIdentityStatus().phase, "poisoned");

  const rejected = await armedService();
  const completion = await poll(rejected.service, 1366722n,
    writeRequest(135n, 1299n, selectedPage), rejected.events, CADR_STATUS_NOT_READY);
  assert.equal(completion.status, CADR_STATUS_NOT_READY);
  assert.equal(rejected.service.m7EffectivePageIdentityStatus().phase, "poisoned");

  const detached = await armedService(); await detached.service.discard();
  assert.equal(detached.service.m7EffectivePageIdentityStatus().phase, "poisoned");
  assert.equal(detached.service.m7EffectivePageIdentityWitnesses().length, 0);
}

async function testGlobalHighWaterAndBound() {
  const stale = await armedService();
  await poll(stale.service, 1366000n, readRequest(200n, 50n), stale.events);
  const result = await poll(stale.service, 1366722n,
    writeRequest(135n, 1299n, selectedPage), stale.events);
  assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
  assert.equal(stale.service.m7EffectivePageIdentityStatus().phase, "poisoned");

  const exhausted = await armedService();
  for (let id = 4n; id <= 2049n; id += 1n) {
    await poll(exhausted.service, 1030044n + id, readRequest(id, 50n),
      exhausted.events);
  }
  const status = exhausted.service.m7EffectivePageIdentityStatus();
  assert.equal(status.completed_host_transactions, 2049);
  assert.equal(status.phase, "poisoned");
}

try {
  await testDefaultAndSelectedStream();
  await testPoisoning();
  await testGlobalHighWaterAndBound();
  console.log("cadr M7 effective-page identity stream tests passed");
} finally {
  Object.defineProperty(globalThis, "crypto", { configurable: true,
    value: originalCrypto });
}
