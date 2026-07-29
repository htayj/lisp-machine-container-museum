import assert from "node:assert/strict";
import {
  CADR_HOST_RESULT_FAILED,
  CADR_HOST_RESULT_OK,
  CADR_M4_BLOCK_FAULT_DELAY_ONE_TICK,
  CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
  CADR_STATUS_ARTIFACT_MISMATCH,
  CADR_STATUS_NOT_READY,
  CADR_STATUS_OK,
  createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";

function descriptor(firstBlock, blockCount, blockBytes) {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, firstBlock, true);
  view.setUint32(8, blockCount, true);
  view.setUint32(12, blockBytes, true);
  return bytes;
}

function request(bytes, id = 1n) {
  return {
    operation: 1, generation: 1n, requestId: id,
    descriptorByteCount: BigInt(bytes.byteLength), completionByteCount: 1024n,
  };
}

async function oneRequest(service, tick, next, observed) {
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
  const service = createM4BlockRangeService({ image, expectedImageByteCount: 2048n });
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
    image, expectedImageByteCount: 1024n,
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
    image: new Uint8Array(1024), expectedImageByteCount: 1025n,
  }), (error) => error.code === CADR_STATUS_ARTIFACT_MISMATCH);
  const observed = [];
  const service = createM4BlockRangeService({
    image: new Uint8Array(1024), expectedImageByteCount: 1024n,
    faultMask: CADR_M4_BLOCK_FAULT_FLIP_FIRST_BYTE,
  });
  const valid = descriptor(0n, 1, 1024);
  await oneRequest(service, 2n,
    { status: CADR_STATUS_OK, request: request(valid), descriptor: valid }, observed);
  assert.equal(observed[0].hostStatus, CADR_HOST_RESULT_OK);
  assert.equal(observed[0].bytes[0], 1);
}

await testZeroTickAndImmutableSnapshot();
await testNegativeRangeStatusBytesAndTiming();
await testByteFaultAndWrongImage();
console.log("cadr_m4_block_service.mjs: ok");
