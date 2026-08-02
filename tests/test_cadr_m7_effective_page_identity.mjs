import assert from "node:assert/strict";

import {
  CADR_HOST_OPERATION_BLOCK_READ,
  CADR_HOST_OPERATION_BLOCK_WRITE,
  CADR_HOST_RESULT_FAILED,
  CADR_HOST_RESULT_OK,
  CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK,
  CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
  CADR_M4_BLOCK_FAULT_STATUS_FAILED,
  CADR_STATUS_NOT_READY,
  CADR_STATUS_OK,
  createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";
import { serializeM6HostTranscript } from
  "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  createM7EffectivePageIdentityAcknowledgement,
  parseM7EffectivePageIdentityPolicy,
  validateM7EffectivePageIdentityAcknowledgement,
} from "../cadr-web/wasm/cadr-m7-effective-page-identity.mjs";

const BLOCK_BYTES = 1024;
const IMAGE_BLOCKS = 4n;
const H = value => new Uint8Array(32).fill(value);

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

function readDescriptor(firstBlock, blockCount = 1, blockBytes = BLOCK_BYTES) {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, firstBlock, true);
  view.setUint32(8, blockCount, true);
  view.setUint32(12, blockBytes, true);
  return bytes;
}

function writeDescriptor(transactionId, firstBlock, blockCount = 1,
                         blockBytes = BLOCK_BYTES) {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, transactionId, true);
  view.setBigUint64(8, firstBlock, true);
  view.setUint32(16, blockCount, true);
  view.setUint32(20, blockBytes, true);
  return bytes;
}

function request(descriptor, requestId, { generation = 1n, operation,
  payload = new Uint8Array(0), completionByteCount } = {}) {
  return { operation, generation, requestId,
    descriptorByteCount: BigInt(descriptor.byteLength),
    requestPayloadByteCount: BigInt(payload.byteLength),
    completionByteCount: BigInt(completionByteCount) };
}

function writeRequest(id, firstBlock, payload, options = {}) {
  const descriptor = options.descriptor ?? writeDescriptor(
    options.transactionId ?? id, firstBlock,
    options.blockCount ?? 1, options.blockBytes ?? BLOCK_BYTES);
  return { status: CADR_STATUS_OK,
    request: request(descriptor, id, { generation: options.generation ?? 1n,
      operation: CADR_HOST_OPERATION_BLOCK_WRITE, payload,
      completionByteCount: options.completionByteCount ?? 0 }),
    descriptor, requestPayload: payload };
}

function readRequest(id, firstBlock) {
  const descriptor = readDescriptor(firstBlock);
  return { status: CADR_STATUS_OK,
    request: request(descriptor, id, { operation: CADR_HOST_OPERATION_BLOCK_READ,
      completionByteCount: BLOCK_BYTES }), descriptor,
    requestPayload: new Uint8Array(0) };
}

function imageFixture() {
  return Uint8Array.from({ length: Number(IMAGE_BLOCKS) * BLOCK_BYTES },
    (_, index) => (index * 19 + 7) & 255);
}

function pageFixture() {
  return Uint8Array.from({ length: BLOCK_BYTES },
    (_, index) => (index * 37 + 11) & 255);
}

function createReader(image, hooks = {}) {
  return { imageByteCount: BigInt(image.byteLength),
    async readRange(offset, count) {
      if (hooks.onRead !== undefined) await hooks.onRead(offset, count);
      if (hooks.throwRead === true) throw new Error("injected range failure");
      const start = Number(offset); const end = start + Number(count);
      const bytes = image.slice(start, end);
      return hooks.shortRead === true ? bytes.subarray(0, bytes.byteLength - 1) : bytes;
    } };
}

async function poll(service, tick, next, events, completeStatus = CADR_STATUS_OK) {
  const result = await service.poll({ tick,
    nextRequest: async () => next,
    complete: async () => ({ status: completeStatus }) });
  events.push(...result.events);
  return result;
}

async function selectedArmedService(options = {}) {
  const image = options.image ?? imageFixture();
  const overlayPage = pageFixture();
  const reader = createReader(image, options.hooks);
  const service = createM4BlockRangeService({ ...reader,
    expectedImageByteCount: reader.imageByteCount,
    selectedBaseSha256: await sha256(image),
    m7EffectivePageIdentityPolicy: { enabled: true,
      profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE },
    ...options.service });
  const events = [];
  const latency = options.service?.latencyTicks ?? 0n;
  async function issueAndFinish(tick, next) {
    let result = await poll(service, tick, next, events);
    if (!result.events.some(event => event.completionDelivered === true)) {
      result = await poll(service, tick + latency,
        { status: CADR_STATUS_NOT_READY }, events);
    }
    return { result, nextTick: tick + latency + 1n };
  }
  let step = await issueAndFinish(1n, writeRequest(1n, 1n, overlayPage));
  assert.equal(step.result.events.at(-1).overlayCommitted, true,
    "the initial LBA-1 write remains the frozen M4 COMMIT");
  step = await issueAndFinish(step.nextTick, readRequest(2n, 1n));
  await issueAndFinish(step.nextTick, readRequest(3n, 0n));
  const arm = await service.observeM7EffectivePageIdentityQuietSuffix(
    options.quietSuffix ?? { boundary: 1030044n, reason: 1,
      persistentStatus: 0, outstandingRequestId: 0n });
  assert.notEqual(arm, null);
  return { service, image, overlayPage, events, hooks: options.hooks ?? {}, arm };
}

async function transcriptRecord(event, ordinal) {
  const descriptor = event.descriptor ?? new Uint8Array(0);
  const requestPayload = event.requestPayload ?? new Uint8Array(0);
  const page = event.pageBytes ?? new Uint8Array(0);
  const completion = event.completionDelivered &&
    event.operation !== CADR_HOST_OPERATION_BLOCK_WRITE ? page : new Uint8Array(0);
  return { ordinal, actor: event.requestSeen ? "issue" : "completion",
    guestBoundary: event.requestSeen ? event.issueTick : event.deliveryTick,
    dueBoundary: event.dueTick, generation: event.generation,
    requestId: event.requestId, operation: event.operation,
    hostStatus: event.hostStatus,
    descriptorByteCount: BigInt(descriptor.byteLength),
    requestPayloadByteCount: event.requestPayloadByteCount,
    completionByteCount: event.completionByteCount,
    descriptorSha256: await sha256(descriptor),
    requestPayloadSha256: await sha256(requestPayload),
    completionSha256: await sha256(completion),
    firstBlock: event.firstBlock, blockCount: event.blockCount,
    blockBytes: event.blockBytes, overlayGeneration: event.overlayGeneration };
}

async function receiptFor(selected, candidateRequestId) {
  const records = await Promise.all(selected.events.map(transcriptRecord));
  const hostTranscript = serializeM6HostTranscript(records, H(0x55));
  const completionOrdinal = selected.events.findIndex(event =>
    event.completionDelivered && event.requestId === candidateRequestId &&
    event.identityAcknowledgementCandidate !== undefined);
  assert.ok(completionOrdinal > 0, "the service delivered one internal candidate");
  const candidate = selected.events[completionOrdinal].identityAcknowledgementCandidate;
  const witness = await selected.service.m7EffectivePageIdentityWitness();
  assert.notEqual(witness, null, "the service supplies a fresh effective-page reread");
  const selectedBase = { byte_count: BigInt(selected.image.byteLength),
    sha256: await sha256(selected.image) };
  const evidence = await createM7EffectivePageIdentityAcknowledgement({ candidate,
    issue_ordinal: completionOrdinal - 1, completion_ordinal: completionOrdinal,
    host_transcript: hostTranscript, selected_base: selectedBase,
    effective_page_witness: witness });
  return { evidence, hostTranscript, witness, selectedBase };
}

async function acknowledgeBlock(firstBlock, options = {}) {
  const selected = await selectedArmedService(options);
  const payload = firstBlock === 1n ? selected.overlayPage :
    selected.image.slice(Number(firstBlock) * BLOCK_BYTES,
      Number(firstBlock + 1n) * BLOCK_BYTES);
  const result = await poll(selected.service, 1030045n,
    writeRequest(4n, firstBlock, payload), selected.events);
  assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_OK);
  assert.equal(result.events.at(-1).identityAcknowledged, true);
  assert.equal(result.events.at(-1).overlayCommitted, undefined);
  assert.equal(selected.service.overlayGeneration(), 1n);
  return { ...selected, payload, result,
    receipt: await receiptFor(selected, 4n) };
}

async function testPolicyCommitReplayAndArming() {
  assert.strictEqual(parseM7EffectivePageIdentityPolicy(),
    CADR_M7_EFFECTIVE_PAGE_IDENTITY_DISABLED);
  assert.throws(() => parseM7EffectivePageIdentityPolicy({ enabled: true,
    profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE, lba: 1299n }), /wrong shape/);

  const image = imageFixture(); const reader = createReader(image);
  const defaultService = createM4BlockRangeService({ ...reader,
    expectedImageByteCount: reader.imageByteCount });
  const events = [];
  const forbidden = await poll(defaultService, 10n,
    writeRequest(135n, 2n, image.slice(2 * BLOCK_BYTES, 3 * BLOCK_BYTES)), events);
  assert.equal(forbidden.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED,
    "the actual arbitrary-LBA request is unavailable when the M7 flag is off");
  assert.equal(defaultService.overlayGeneration(), 0n);

  const selected = await selectedArmedService();
  const replay = await poll(selected.service, 1030045n,
    writeRequest(1n, 1n, selected.overlayPage), selected.events);
  assert.equal(replay.events.at(-1).overlayReplayed, true,
    "the exact M4 LBA-1 replay is resolved before the armed fallback");
  assert.equal(replay.events.at(-1).identityAcknowledgementCandidate, undefined);

  for (const suffix of [
    { boundary: 1030043n, reason: 1, persistentStatus: 0, outstandingRequestId: 0n },
    { boundary: 1030044n, reason: 2, persistentStatus: 0, outstandingRequestId: 0n },
    { boundary: 1030044n, reason: 1, persistentStatus: 1, outstandingRequestId: 0n },
    { boundary: 1030044n, reason: 1, persistentStatus: 0, outstandingRequestId: 1n },
  ]) {
    const image2 = imageFixture();
    const overlayPage = pageFixture();
    const reader2 = createReader(image2);
    const service = createM4BlockRangeService({ ...reader2,
      expectedImageByteCount: reader2.imageByteCount,
      selectedBaseSha256: await sha256(image2),
      m7EffectivePageIdentityPolicy: { enabled: true,
        profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE } });
    const armEvents = [];
    await poll(service, 1n, writeRequest(1n, 1n, overlayPage), armEvents);
    await poll(service, 2n, readRequest(2n, 1n), armEvents);
    await poll(service, 3n, readRequest(3n, 0n), armEvents);
    assert.equal(await service.observeM7EffectivePageIdentityQuietSuffix(suffix), null);
  }
}

async function testArbitraryRangeAndIndependentReceipt() {
  for (const firstBlock of [0n, 1n, 2n, IMAGE_BLOCKS - 1n]) {
    const acknowledged = await acknowledgeBlock(firstBlock);
    const { evidence, hostTranscript, witness, selectedBase } = acknowledged.receipt;
    const trusted = (overrides = {}) => ({ host_transcript: hostTranscript,
      effective_page_bytes: witness.bytes, expected_effective_page_sha256: null,
      expected_base: selectedBase, ...overrides });
    assert.equal(evidence.disposition, "IDENTITY_ACK");
    assert.equal(evidence.request.first_block, firstBlock);
    assert.equal(evidence.effective_page.source,
      firstBlock === 1n ? "overlay" : "base");
    assert.equal("bytes" in evidence.effective_page, false);
    assert.deepEqual(evidence.media_before, evidence.media_after);
    await assert.doesNotReject(() =>
      validateM7EffectivePageIdentityAcknowledgement(evidence, trusted()));

    const forged = structuredClone(evidence);
    forged.request.request_id += 1n;
    await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
      forged, trusted()), /malformed|trusted evidence/);
    const forgedTranscript = hostTranscript.slice();
    forgedTranscript[64 + 136] ^= 1;
    await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
      evidence, trusted({ host_transcript: forgedTranscript })),
      /authoritative|trusted evidence/);
    await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
      evidence, trusted({ host_transcript: hostTranscript.subarray(0,
        hostTranscript.byteLength - 1) })), /framing|lacks/);
    const wrongPage = witness.bytes.slice(); wrongPage[0] ^= 1;
    await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
      evidence, trusted({ effective_page_bytes: wrongPage })),
      /independent page authority/);
    if (firstBlock === 0n) {
      const missingArmRecord = hostTranscript.slice();
      new DataView(missingArmRecord.buffer, missingArmRecord.byteOffset)
        .setUint32(64 + 8, 0, true);
      await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
        evidence, trusted({ host_transcript: missingArmRecord })),
        /authoritative|trusted evidence/);

      const forgedArmLink = structuredClone(evidence);
      forgedArmLink.transcript.arm_records.initial_commit
        .issue_record_sha256[0] ^= 1;
      await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
        forgedArmLink, trusted()), /trusted evidence/);

      const falseRoot = structuredClone(evidence);
      falseRoot.media_before.overlay_root_sha256 = H(0);
      falseRoot.media_after.overlay_root_sha256 = H(0);
      await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
        falseRoot, trusted()), /trusted evidence/);

      const substitutedBase = structuredClone(evidence);
      substitutedBase.selected_base.sha256[0] ^= 1;
      await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
        substitutedBase, trusted()), /trusted base/);

      const outOfBase = structuredClone(evidence);
      outOfBase.selected_base.byte_count = 1023n;
      await assert.rejects(() => validateM7EffectivePageIdentityAcknowledgement(
        outOfBase, trusted({ expected_base: {
          byte_count: 1023n, sha256: selectedBase.sha256 } })), /base bounds/);
    }
  }
}

async function testActualSelectedRequestShapeFlagOffAndOn() {
  const image = Uint8Array.from({ length: 1300 * BLOCK_BYTES },
    (_, index) => (index * 13 + 5) & 255);
  const selectedPage = image.slice(1299 * BLOCK_BYTES, 1300 * BLOCK_BYTES);
  const offReader = createReader(image);
  const off = createM4BlockRangeService({ ...offReader,
    expectedImageByteCount: offReader.imageByteCount });
  const offResult = await poll(off, 1366722n,
    writeRequest(135n, 1299n, selectedPage), []);
  assert.equal(offResult.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED,
    "the actual selected request shape is unavailable with the policy off");

  const on = await selectedArmedService({ image });
  const onResult = await poll(on.service, 1366722n,
    writeRequest(135n, 1299n, selectedPage), on.events);
  const candidate = onResult.events.at(-1).identityAcknowledgementCandidate;
  assert.equal(onResult.events.at(-1).identityAcknowledged, true);
  assert.equal(candidate.request_id, 135n);
  assert.equal(candidate.first_block, 1299n);
  assert.equal(candidate.issue_boundary, 1366722n);
  assert.equal(candidate.media_after.overlay_generation, 1n);
}

async function testMalformedStaleChangedAndRangeFailures() {
  const cases = [
    selected => writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
      3 * BLOCK_BYTES), { blockCount: 2 }),
    selected => writeRequest(4n, IMAGE_BLOCKS,
      selected.image.slice(0, BLOCK_BYTES)),
    selected => writeRequest(4n, 0xffffffffffffffffn,
      selected.image.slice(0, BLOCK_BYTES)),
    selected => writeRequest(1n, 2n, selected.image.slice(2 * BLOCK_BYTES,
      3 * BLOCK_BYTES)),
    selected => writeRequest(1n, 2n, selected.overlayPage),
    selected => writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
      3 * BLOCK_BYTES), { generation: 0n }),
    selected => { const changed = selected.image.slice(2 * BLOCK_BYTES,
      3 * BLOCK_BYTES); changed[7] ^= 1; return writeRequest(4n, 2n, changed); },
    selected => writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
      3 * BLOCK_BYTES), { transactionId: 5n }),
  ];
  for (const makeRequest of cases) {
    const selected = await selectedArmedService();
    const result = await poll(selected.service, 1030045n,
      makeRequest(selected), selected.events);
    assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
    assert.equal(result.events.at(-1).identityAcknowledgementCandidate, undefined);
    assert.equal(selected.service.overlayGeneration(), 1n);
  }
}

async function testReadFaultDetachAndCompletionFailures() {
  for (const mode of ["throwRead", "shortRead"]) {
    const hooks = { throwRead: false, shortRead: false };
    const selected = await selectedArmedService({ hooks });
    hooks[mode] = true;
    const payload = selected.image.slice(2 * BLOCK_BYTES, 3 * BLOCK_BYTES);
    const result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, payload), selected.events);
    assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
    assert.equal(selected.service.overlayGeneration(), 1n);
  }

  {
    const hooks = { throwRead: false };
    const selected = await selectedArmedService({ hooks });
    const payload = selected.image.slice(2 * BLOCK_BYTES, 3 * BLOCK_BYTES);
    const result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, payload), selected.events);
    assert.equal(result.events.at(-1).identityAcknowledged, true);
    hooks.throwRead = true;
    assert.equal(await selected.service.m7EffectivePageIdentityWitness(), null,
      "an independent reread failure suppresses the public receipt witness");
  }

  for (const faultMask of [CADR_M4_BLOCK_FAULT_STATUS_FAILED,
    CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
    CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK]) {
    const selected = await selectedArmedService({ service: { faultMask,
      faultOperation: CADR_HOST_OPERATION_BLOCK_WRITE, faultFirstBlock: 2n,
      faultOccurrence: 1n } });
    const payload = selected.image.slice(2 * BLOCK_BYTES, 3 * BLOCK_BYTES);
    let result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, payload), selected.events);
    if (faultMask === CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK) {
      result = await poll(selected.service, 1030046n,
        { status: CADR_STATUS_NOT_READY }, selected.events);
    }
    assert.equal(result.events.at(-1).hostStatus, CADR_HOST_RESULT_FAILED);
    assert.equal(result.events.at(-1).identityAcknowledgementCandidate, undefined);
  }

  {
    const selected = await selectedArmedService();
    const detaching = selected.service.discard();
    const result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
        3 * BLOCK_BYTES)), selected.events);
    await detaching;
    assert.equal(result.status, CADR_STATUS_NOT_READY,
      "detach before dispatch admits no issue or acknowledgement");
  }
  {
    const selected = await selectedArmedService({ service: { latencyTicks: 1n } });
    const result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
        3 * BLOCK_BYTES)), selected.events);
    assert.equal(result.events.length, 1, "the candidate is captured but not delivered");
    await selected.service.discard();
    assert.equal(selected.service.m7EffectivePageIdentityCandidates().length, 0,
      "detach after dispatch discards the unpublished candidate");
  }
  {
    const selected = await selectedArmedService();
    const result = await poll(selected.service, 1030045n,
      writeRequest(4n, 2n, selected.image.slice(2 * BLOCK_BYTES,
        3 * BLOCK_BYTES)), selected.events, CADR_STATUS_NOT_READY);
    assert.equal(result.status, CADR_STATUS_NOT_READY);
    assert.equal(selected.service.m7EffectivePageIdentityCandidates().length, 0,
      "completion rejection cannot publish an acknowledgement candidate");
  }
}

await testPolicyCommitReplayAndArming();
await testArbitraryRangeAndIndependentReceipt();
await testActualSelectedRequestShapeFlagOffAndOn();
await testMalformedStaleChangedAndRangeFailures();
await testReadFaultDetachAndCompletionFailures();
console.log("cadr M7 effective-page identity acknowledgement tests passed");
