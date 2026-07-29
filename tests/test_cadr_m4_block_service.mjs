import assert from "node:assert/strict";
import {
  CADR_HOST_RESULT_FAILED,
  CADR_HOST_RESULT_OK,
  CADR_HOST_OPERATION_BLOCK_WRITE,
  CADR_M4_BLOCK_FAULT_NONE,
  CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK,
  CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
  CADR_STATUS_ARTIFACT_MISMATCH,
  CADR_STATUS_NOT_READY,
  CADR_STATUS_OK,
  createBlobRangeReader,
  createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";

function memorySource(input) {
  const image = input.slice();
  return {
    imageByteCount: BigInt(image.byteLength),
    async readRange(offset, byteCount) {
      return image.slice(Number(offset), Number(offset + byteCount));
    },
  };
}

function descriptor(firstBlock, blockCount, blockBytes) {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, firstBlock, true);
  view.setUint32(8, blockCount, true);
  view.setUint32(12, blockBytes, true);
  return bytes;
}

function writeDescriptor(transactionId, firstBlock) {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, transactionId, true);
  view.setBigUint64(8, firstBlock, true);
  view.setUint32(16, 1, true);
  view.setUint32(20, 1024, true);
  return bytes;
}

function request(bytes, id = 1n, payloadByteCount = 0n,
                 operation = 1, completionByteCount = 1024n,
                 generation = 1n) {
  return {
    operation, generation, requestId: id,
    descriptorByteCount: BigInt(bytes.byteLength),
    requestPayloadByteCount: payloadByteCount,
    completionByteCount,
  };
}

async function oneRequest(service, tick, next, observed) {
  if (next?.status === CADR_STATUS_OK && next.requestPayload === undefined) {
    next = { ...next, requestPayload: new Uint8Array(0) };
  }
  return service.poll({
    tick,
    nextRequest: async () => next,
    complete: async (completion) => {
      observed.push(completion);
      return { status: CADR_STATUS_OK };
    },
  });
}

async function testZeroTickAndImmutableSnapshot() {
  const image = Uint8Array.from({ length: 2048 }, (_, index) => index & 255);
  const service = createM4BlockRangeService({
    ...memorySource(image), expectedImageByteCount: 2048n,
  });
  const observed = [];
  const result = await oneRequest(service, 77n,
    { status: CADR_STATUS_OK, request: request(descriptor(1n, 1, 1024)), descriptor: descriptor(1n, 1, 1024) }, observed);
  assert.equal(result.status, CADR_STATUS_OK);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].issueTick, 77n);
  assert.equal(result.events[1].deliveryTick, 77n);
  assert.equal(observed[0].hostStatus, CADR_HOST_RESULT_OK);
  assert.equal(observed[0].bytes[0], image[1024]);
  image[1024] ^= 255;
  assert.notEqual(observed[0].bytes[0], image[1024]);
}

async function testNegativeRangeStatusBytesAndTiming() {
  const image = new Uint8Array(1024);
  const observed = [];
  const service = createM4BlockRangeService({
    ...memorySource(image), expectedImageByteCount: 1024n,
    faultMask: CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK,
  });
  const bad = descriptor(0n, 1, 512);
  let result = await oneRequest(service, 9n,
    { status: CADR_STATUS_OK, request: request(bad), descriptor: bad }, observed);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].dueTick, 10n);
  assert.equal(observed.length, 0);
  result = await oneRequest(service, 10n, { status: CADR_STATUS_NOT_READY }, observed);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].deliveryTick, 10n);
  assert.equal(observed[0].hostStatus, CADR_HOST_RESULT_FAILED);
  assert.deepEqual([...observed[0].bytes], new Array(1024).fill(0));
}

async function testByteFaultAndWrongImage() {
  assert.throws(() => createM4BlockRangeService({
    ...memorySource(new Uint8Array(1024)), expectedImageByteCount: 1025n,
  }), (error) => error.code === CADR_STATUS_ARTIFACT_MISMATCH);
  const observed = [];
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(1024)), expectedImageByteCount: 1024n,
    faultMask: CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
  });
  const valid = descriptor(0n, 1, 1024);
  await oneRequest(service, 2n,
    { status: CADR_STATUS_OK, request: request(valid), descriptor: valid }, observed);
  assert.equal(observed[0].hostStatus, CADR_HOST_RESULT_OK);
  assert.equal(observed[0].bytes[0], 1);
}

async function testBlobReaderAndReadFailures() {
  const contents = Uint8Array.from({ length: 2048 }, (_, index) => (index * 3) & 255);
  const reader = createBlobRangeReader(new Blob([contents]));
  const observed = [];
  const service = createM4BlockRangeService({
    readRange: reader.readRange,
    imageByteCount: reader.byteCount,
    expectedImageByteCount: 2048n,
  });
  const valid = descriptor(1n, 1, 1024);
  await oneRequest(service, 4n,
    { status: CADR_STATUS_OK, request: request(valid), descriptor: valid }, observed);
  assert.equal(observed[0].hostStatus, CADR_HOST_RESULT_OK);
  assert.deepEqual(observed[0].bytes, contents.slice(1024));

  const failed = [];
  const failedService = createM4BlockRangeService({
    readRange: async () => { throw new Error("injected read failure"); },
    imageByteCount: 1024n,
    expectedImageByteCount: 1024n,
  });
  const first = descriptor(0n, 1, 1024);
  await oneRequest(failedService, 5n,
    { status: CADR_STATUS_OK, request: request(first), descriptor: first }, failed);
  assert.equal(failed[0].hostStatus, CADR_HOST_RESULT_FAILED);
  assert.deepEqual([...failed[0].bytes], new Array(1024).fill(0));
}

async function testConcurrentPollsAreSerialized() {
  let activeReads = 0;
  let maximumReads = 0;
  const completions = [];
  const service = createM4BlockRangeService({
    imageByteCount: 2048n,
    expectedImageByteCount: 2048n,
    readRange: async (_offset, byteCount) => {
      activeReads += 1;
      maximumReads = Math.max(maximumReads, activeReads);
      await Promise.resolve();
      activeReads -= 1;
      return new Uint8Array(Number(byteCount));
    },
  });
  const first = descriptor(0n, 1, 1024);
  const second = descriptor(1n, 1, 1024);
  const [a, b] = await Promise.all([
    oneRequest(service, 6n,
      { status: CADR_STATUS_OK, request: request(first, 1n), descriptor: first }, completions),
    oneRequest(service, 6n,
      { status: CADR_STATUS_OK, request: request(second, 2n), descriptor: second }, completions),
  ]);
  assert.equal(a.status, CADR_STATUS_OK);
  assert.equal(b.status, CADR_STATUS_OK);
  assert.equal(maximumReads, 1);
  assert.deepEqual(completions.map(({ request: item }) => item.requestId), [1n, 2n]);
}

async function testBootScratchWriteCommitsAndShadowsBase() {
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
  });
  const payload = Uint8Array.from({ length: 1024 }, (_, index) => (index ^ 0x5a) & 255);
  const write = writeDescriptor(3n, 1n);
  const completions = [];
  let result = await oneRequest(service, 10n, {
    status: CADR_STATUS_OK,
    request: request(write, 3n, 1024n, CADR_HOST_OPERATION_BLOCK_WRITE, 0n),
    descriptor: write,
    requestPayload: payload,
  }, completions);
  assert.equal(result.status, CADR_STATUS_OK);
  assert.equal(result.events[0].overlayPrepared, true);
  assert.equal(result.events[1].overlayCommitted, true);
  assert.equal(result.events[1].overlayGeneration, 1n);
  assert.equal(service.overlayGeneration(), 1n);
  assert.equal(service.snapshotStatus(), CADR_STATUS_NOT_READY);
  assert.equal(completions[0].bytes.byteLength, 0);

  const read = descriptor(1n, 1, 1024);
  result = await oneRequest(service, 11n, {
    status: CADR_STATUS_OK,
    request: request(read, 4n),
    descriptor: read,
  }, completions);
  assert.equal(result.status, CADR_STATUS_OK);
  assert.deepEqual(completions[1].bytes, payload);
  await service.discard();
  assert.equal(service.overlayGeneration(), 0n);
  assert.equal(service.snapshotStatus(), CADR_STATUS_OK);
}

async function testReplayFaultSelectionAndDetachRace() {
  const payload = Uint8Array.from(
    { length: 1024 }, (_, index) => (index * 5) & 255);
  const write = writeDescriptor(1n, 1n);
  const completions = [];
  const replayService = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
  });
  await oneRequest(replayService, 1n, {
    status: CADR_STATUS_OK,
    request: request(write, 1n, 1024n,
      CADR_HOST_OPERATION_BLOCK_WRITE, 0n, 2n),
    descriptor: write,
    requestPayload: payload,
  }, completions);
  const replay = await oneRequest(replayService, 2n, {
    status: CADR_STATUS_OK,
    request: request(write, 1n, 1024n,
      CADR_HOST_OPERATION_BLOCK_WRITE, 0n, 2n),
    descriptor: write,
    requestPayload: payload,
  }, completions);
  assert.equal(replay.events[1].overlayReplayed, true);
  assert.equal(replayService.overlayGeneration(), 1n);
  const stale = await oneRequest(replayService, 3n, {
    status: CADR_STATUS_OK,
    request: request(write, 1n, 1024n,
      CADR_HOST_OPERATION_BLOCK_WRITE, 0n, 1n),
    descriptor: write,
    requestPayload: payload,
  }, completions);
  assert.equal(stale.events[1].hostStatus, CADR_HOST_RESULT_FAILED);
  assert.equal(stale.events[1].overlayCommitted, undefined);
  assert.equal(stale.events[1].overlayReplayed, undefined);
  assert.equal(replayService.overlayGeneration(), 1n);

  const selectedCompletions = [];
  const selected = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
    faultMask: CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
    faultOperation: 1,
    faultFirstBlock: 0n,
    faultOccurrence: 1n,
  });
  const block1 = descriptor(1n, 1, 1024);
  await oneRequest(selected, 3n, {
    status: CADR_STATUS_OK,
    request: request(block1, 1n),
    descriptor: block1,
  }, selectedCompletions);
  assert.equal(selectedCompletions[0].bytes[0], 0);
  const block0 = descriptor(0n, 1, 1024);
  await oneRequest(selected, 4n, {
    status: CADR_STATUS_OK,
    request: request(block0, 2n),
    descriptor: block0,
  }, selectedCompletions);
  assert.equal(selectedCompletions[1].bytes[0], 1);

  const raceService = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
  });
  const raceCompletions = [];
  const racedPoll = oneRequest(raceService, 5n, {
    status: CADR_STATUS_OK,
    request: request(write, 1n, 1024n,
      CADR_HOST_OPERATION_BLOCK_WRITE, 0n),
    descriptor: write,
    requestPayload: payload,
  }, raceCompletions);
  const detached = raceService.discard();
  assert.equal(raceService.snapshotStatus(), CADR_STATUS_NOT_READY);
  const raced = await racedPoll;
  await detached;
  assert.equal(raced.status, CADR_STATUS_NOT_READY);
  assert.equal(raceService.overlayGeneration(), 0n);
  assert.equal(raceCompletions.length, 0);
}

async function testDetachFencesDeferredNextRequest() {
  const payload = Uint8Array.from(
    { length: 1024 }, (_, index) => (index * 7) & 255);
  const write = writeDescriptor(7n, 1n);
  let releaseNext;
  let nextStarted;
  const nextStartedPromise = new Promise((resolve) => {
    nextStarted = resolve;
  });
  const nextGate = new Promise((resolve) => {
    releaseNext = resolve;
  });
  const completions = [];
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
  });
  const poll = service.poll({
    tick: 8n,
    nextRequest: async () => {
      nextStarted();
      await nextGate;
      return {
        status: CADR_STATUS_OK,
        request: request(write, 8n, 1024n,
          CADR_HOST_OPERATION_BLOCK_WRITE, 0n),
        descriptor: write,
        requestPayload: payload,
      };
    },
    complete: async (completion) => {
      completions.push(completion);
      return { status: CADR_STATUS_OK };
    },
  });
  await nextStartedPromise;
  const detached = service.discard();
  releaseNext();
  const result = await poll;
  await detached;
  assert.equal(result.status, CADR_STATUS_NOT_READY);
  assert.deepEqual(result.events, []);
  assert.equal(completions.length, 0);
  assert.equal(service.overlayGeneration(), 0n);
  assert.equal(service.snapshotStatus(), CADR_STATUS_OK);
}

async function testFaultOccurrenceProgressBlocksSnapshot() {
  const completions = [];
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(1024)),
    expectedImageByteCount: 1024n,
    faultMask: CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
    faultOccurrence: 2n,
  });
  const first = descriptor(0n, 1, 1024);
  const result = await oneRequest(service, 9n, {
    status: CADR_STATUS_OK,
    request: request(first, 1n),
    descriptor: first,
  }, completions);
  assert.equal(result.status, CADR_STATUS_OK);
  assert.equal(result.events[1].faultMask, CADR_M4_BLOCK_FAULT_NONE);
  assert.equal(service.snapshotBlocked(), true);
  assert.equal(service.snapshotStatus(), CADR_STATUS_NOT_READY);
  await service.discard();
  assert.equal(service.snapshotBlocked(), false);
  assert.equal(service.snapshotStatus(), CADR_STATUS_OK);
}

async function testDetachAfterCompletionDispatchPreservesDeliveryEvidence() {
  const payload = Uint8Array.from(
    { length: 1024 }, (_, index) => (index * 11) & 255);
  const write = writeDescriptor(11n, 1n);
  let releaseCompletion;
  let completionStarted;
  const completionStartedPromise = new Promise((resolve) => {
    completionStarted = resolve;
  });
  const completionGate = new Promise((resolve) => {
    releaseCompletion = resolve;
  });
  let accepted = 0;
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
  });
  const poll = service.poll({
    tick: 11n,
    nextRequest: async () => ({
      status: CADR_STATUS_OK,
      request: request(write, 11n, 1024n,
        CADR_HOST_OPERATION_BLOCK_WRITE, 0n),
      descriptor: write,
      requestPayload: payload,
    }),
    complete: async () => {
      accepted += 1;
      completionStarted();
      await completionGate;
      return { status: CADR_STATUS_OK };
    },
  });
  await completionStartedPromise;
  const detached = service.discard();
  assert.equal(service.snapshotStatus(), CADR_STATUS_NOT_READY);
  releaseCompletion();
  const result = await poll;
  assert.equal(result.status, CADR_STATUS_OK);
  assert.equal(accepted, 1);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[1].completionDelivered, true);
  assert.equal(result.events[1].overlayCommitted, true);
  assert.equal(result.events[1].overlayGeneration, 1n);
  await detached;
  assert.equal(service.overlayGeneration(), 0n);
  assert.equal(service.snapshotStatus(), CADR_STATUS_OK);
}

async function testDetachDiscardsReturnedPositiveLatencyStage() {
  const payload = Uint8Array.from(
    { length: 1024 }, (_, index) => (index * 13) & 255);
  const write = writeDescriptor(13n, 1n);
  const completions = [];
  const service = createM4BlockRangeService({
    ...memorySource(new Uint8Array(2048)),
    expectedImageByteCount: 2048n,
    latencyTicks: 1n,
  });
  const result = await oneRequest(service, 13n, {
    status: CADR_STATUS_OK,
    request: request(write, 13n, 1024n,
      CADR_HOST_OPERATION_BLOCK_WRITE, 0n),
    descriptor: write,
    requestPayload: payload,
  }, completions);
  assert.equal(result.status, CADR_STATUS_OK);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].overlayPrepared, true);
  assert.equal(service.hasPendingRequest(), true);
  assert.equal(completions.length, 0);
  await service.discard();
  assert.equal(service.hasPendingRequest(), false);
  assert.equal(service.overlayGeneration(), 0n);
  assert.equal(service.snapshotStatus(), CADR_STATUS_OK);
  assert.equal(completions.length, 0);
}

await testZeroTickAndImmutableSnapshot();
await testNegativeRangeStatusBytesAndTiming();
await testByteFaultAndWrongImage();
await testBlobReaderAndReadFailures();
await testConcurrentPollsAreSerialized();
await testBootScratchWriteCommitsAndShadowsBase();
await testReplayFaultSelectionAndDetachRace();
await testDetachFencesDeferredNextRequest();
await testFaultOccurrenceProgressBlocksSnapshot();
await testDetachAfterCompletionDispatchPreservesDeliveryEvidence();
await testDetachDiscardsReturnedPositiveLatencyStage();
console.log("cadr_m4_block_service.mjs: ok");
