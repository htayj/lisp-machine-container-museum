import assert from "node:assert/strict";

import {
  CADR_M6_FORM_C,
  CADR_M6_RELEASE_RECORD_SHA256,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_DISPLAY_ACTIVE_WORDS,
  CADR_DISPLAY_FLAG_FULL,
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_FLAG_ZERO_IS_BLACK,
  CADR_DISPLAY_WIDTH,
} from "../cadr-web/wasm/cadr-display-renderer.mjs";
import {
  CADR_M7_NATIVE_FRAME_HEADER_BYTES,
  CadrM7CBoundaryClient,
  CadrM7FrameMismatch,
  compareM7FrameCheckpoint,
  parseCdrM7N1,
  runM7CheckpointedM6BootForTest,
} from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";

const BOUNDARY = 982990214n;

function nativeRecord({ boundary = BOUNDARY, tvMode = 4, words } = {}) {
  const payload = words ?? Uint32Array.from({ length: CADR_DISPLAY_ACTIVE_WORDS },
    (_, index) => (index * 0x10204081) >>> 0);
  const bytes = new Uint8Array(CADR_M7_NATIVE_FRAME_HEADER_BYTES + payload.byteLength);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM7N1"));
  view.setUint32(8, 1, true); view.setUint32(12, 64, true);
  view.setBigUint64(16, boundary, true);
  view.setUint32(24, 768, true); view.setUint32(28, 963, true);
  view.setUint32(32, tvMode, true); view.setUint32(36, (tvMode >>> 2) & 1, true);
  view.setUint32(40, 32768, true); view.setUint32(44, CADR_DISPLAY_ACTIVE_WORDS, true);
  view.setUint32(48, payload.byteLength, true); view.setUint32(52, 0, true);
  new Uint32Array(bytes.buffer, CADR_M7_NATIVE_FRAME_HEADER_BYTES, payload.length).set(payload);
  return bytes;
}

function portableRecord({ tvMode = 4, words } = {}) {
  const payload = words ?? Uint32Array.from({ length: CADR_DISPLAY_ACTIVE_WORDS },
    (_, index) => (index * 0x10204081) >>> 0);
  const bytes = new Uint8Array(80 + 16 + payload.byteLength);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRDISP1"));
  view.setUint16(8, 1, true); view.setUint16(10, 80, true);
  view.setUint32(12, CADR_DISPLAY_FLAG_FULL |
    ((tvMode & 4) === 0 ? CADR_DISPLAY_FLAG_ZERO_IS_BLACK : 0), true);
  view.setBigUint64(16, 1n, true); view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true); view.setUint32(36, 963, true);
  view.setUint32(40, 24, true); view.setUint32(44, 32768, true);
  view.setUint32(48, CADR_DISPLAY_ACTIVE_WORDS, true); view.setUint32(52, tvMode, true);
  view.setUint32(56, 1, true); view.setUint32(60, payload.length, true);
  view.setBigUint64(64, BigInt(payload.byteLength), true);
  view.setBigUint64(72, BigInt(bytes.byteLength), true);
  view.setUint32(80, 0, true); view.setUint32(84, 0, true);
  view.setUint32(88, CADR_DISPLAY_WIDTH, true); view.setUint32(92, CADR_DISPLAY_HEIGHT, true);
  new Uint32Array(bytes.buffer, 96, payload.length).set(payload);
  return bytes;
}

function machineInfo(boundary) {
  const info = new Uint8Array(64);
  new DataView(info.buffer).setBigUint64(8, boundary, true);
  return { status: 0, info };
}

function m6Witness(boundary, debugInstruction = CADR_M6_FORM_C) {
  const sample = new Uint8Array(96);
  sample.set(new TextEncoder().encode("CDRM6I1"));
  const view = new DataView(sample.buffer);
  view.setBigUint64(8, debugInstruction, true);
  view.setUint32(68, 0x18000, true);
  view.setUint32(72, 3, true);
  view.setUint32(84, 1, true);
  return { status: 0, wireSchema: "CDRM6I1", boundary, debugInstruction, sample };
}

function portableCheckpoint(display_record, boundary = BOUNDARY) {
  return {
    boundary,
    witness_sample: m6Witness(boundary).sample,
    display_record,
    m6_release_record_sha256: CADR_M6_RELEASE_RECORD_SHA256.slice(),
  };
}

class CheckpointClient {
  constructor({ boundary, batches, frame, wrongC = false }) {
    this.boundary = boundary;
    this.batches = [...batches];
    this.frame = frame;
    this.wrongC = wrongC;
    this.calls = [];
  }

  async request(op) {
    this.calls.push(op);
    if (op === "machine-info") return machineInfo(this.boundary);
    if (op === "run-digest-batch-m5") {
      assert.ok(this.batches.length > 0, "test client has a scheduled batch");
      const boundaryCount = this.batches.shift();
      this.boundary += BigInt(boundaryCount);
      return { status: 0, boundaryCount };
    }
    if (op === "boot-witness") {
      return m6Witness(this.boundary, this.wrongC ? 0x42314d36n : CADR_M6_FORM_C);
    }
    if (op === "display-full") return {
      status: 0, full: true, updated: true, width: 768, height: 963,
      blackOnWhite: true, frame: this.frame,
    };
    assert.fail(`unexpected underlying operation ${op}`);
  }
}

async function testStrictRecordAndFirstDifference() {
  const native = nativeRecord();
  const parsed = parseCdrM7N1(native);
  assert.equal(parsed.boundary, BOUNDARY);
  assert.equal(parsed.tvMode, 4);
  assert.equal(parsed.words.byteLength, CADR_DISPLAY_ACTIVE_WORDS * 4);
  const identical = await compareM7FrameCheckpoint(native, portableCheckpoint(portableRecord()));
  assert.equal(identical.outcome, "identical");
  assert.equal(identical.boundary, BOUNDARY.toString());

  const words = Uint32Array.from({ length: CADR_DISPLAY_ACTIVE_WORDS },
    (_, index) => (index * 0x10204081) >>> 0);
  words[25] ^= 0x80000003;
  await assert.rejects(compareM7FrameCheckpoint(native, portableCheckpoint(portableRecord({ words }))), error => {
    assert.ok(error instanceof CadrM7FrameMismatch);
    assert.equal(error.report.first_word_index, 25);
    assert.equal(error.report.x_word, 1);
    assert.equal(error.report.y, 1);
    assert.deepEqual(error.report.differing_bits, [
      { x: 32, y: 1, bit: 0 }, { x: 33, y: 1, bit: 1 }, { x: 63, y: 1, bit: 31 },
    ]);
    return true;
  });

  await assert.rejects(compareM7FrameCheckpoint(native,
    portableCheckpoint(portableRecord(), BOUNDARY + 1n)),
  /portable checkpoint boundary differs from native C boundary/);

  const wrongRelease = portableCheckpoint(portableRecord());
  wrongRelease.m6_release_record_sha256[0] ^= 1;
  await assert.rejects(compareM7FrameCheckpoint(native, wrongRelease),
    /not bound to the frozen M6 release record/);

  for (const mutation of ["zero", "magic", "form-c", "fifo", "scancode", "disk-status",
    "transfer", "outstanding", "irq", "host-pending", "completion", "iob-cclk"]) {
    const malformedSample = portableCheckpoint(portableRecord());
    if (mutation === "zero") malformedSample.witness_sample = new Uint8Array(96);
    if (mutation === "magic") malformedSample.witness_sample[0] ^= 1;
    if (mutation === "form-c") {
      new DataView(malformedSample.witness_sample.buffer).setBigUint64(8, 0n, true);
    }
    const mutationView = new DataView(malformedSample.witness_sample.buffer);
    if (mutation === "fifo") mutationView.setUint32(64, 1, true);
    if (mutation === "scancode") mutationView.setUint32(68, 0, true);
    if (mutation === "disk-status") mutationView.setUint32(72, 0, true);
    if (mutation === "transfer") mutationView.setUint32(76, 1, true);
    if (mutation === "outstanding") mutationView.setUint32(80, 1, true);
    if (mutation === "irq") mutationView.setUint32(84, 0, true);
    if (mutation === "host-pending") mutationView.setUint32(88, 1, true);
    if (mutation === "completion") mutationView.setUint32(92, 1, true);
    if (mutation === "iob-cclk") mutationView.setUint32(60, 1 << 5, true);
    await assert.rejects(compareM7FrameCheckpoint(native, malformedSample),
      /portable CDRM6I1 sample/);
  }

  const malformed = native.slice();
  malformed[7] = 1;
  assert.throws(() => parseCdrM7N1(malformed), /native capture magic/);
}

async function testCheckpointExactStopAndConsecutiveBatches() {
  const rawClient = new CheckpointClient({
    boundary: BOUNDARY - 15n, batches: [5, 5, 5], frame: portableRecord(),
  });
  const client = new CadrM7CBoundaryClient(rawClient, nativeRecord());
  await client.request("machine-info");
  await client.request("run-digest-batch-m5");
  await client.request("run-digest-batch-m5");
  assert.equal(client.checkpoint, null, "the first two batches remain before C");
  await client.request("run-digest-batch-m5");
  assert.ok(client.checkpoint !== null, "third consecutive batch stops exactly at C");
  assert.deepEqual(rawClient.calls, [
    "machine-info", "run-digest-batch-m5", "run-digest-batch-m5",
    "run-digest-batch-m5", "boot-witness", "display-full",
  ]);
  /* This is the next underlying request, and cannot precede the capture pair. */
  await client.request("machine-info");
  assert.equal(rawClient.calls.at(-1), "machine-info");
  assert.equal(rawClient.calls.indexOf("boot-witness"), 4);
  assert.equal(rawClient.calls.indexOf("display-full"), 5);
  assert.equal(client.lastBoundary, BOUNDARY);
}

async function testOvershootFailsClosedAndWrongCIsRejected() {
  const overshootRaw = new CheckpointClient({
    boundary: BOUNDARY - 1n, batches: [2], frame: portableRecord(),
  });
  const overshoot = new CadrM7CBoundaryClient(overshootRaw, nativeRecord());
  await overshoot.request("machine-info");
  await assert.rejects(overshoot.request("run-digest-batch-m5"), /crossed the native C boundary/);
  assert.deepEqual(overshootRaw.calls, ["machine-info", "run-digest-batch-m5"]);
  await assert.rejects(overshoot.request("machine-info"), /crossed the native C boundary/);

  const wrongCRaw = new CheckpointClient({
    boundary: BOUNDARY - 1n, batches: [1], frame: portableRecord(), wrongC: true,
  });
  const wrongC = new CadrM7CBoundaryClient(wrongCRaw, nativeRecord());
  await wrongC.request("machine-info");
  await assert.rejects(wrongC.request("run-digest-batch-m5"), /lacks the complete Form-C/);
  assert.deepEqual(wrongCRaw.calls, [
    "machine-info", "run-digest-batch-m5", "boot-witness",
  ]);

  const embeddedWrongRaw = new CheckpointClient({
    boundary: BOUNDARY - 1n, batches: [1], frame: portableRecord(),
  });
  embeddedWrongRaw.request = async function request(op) {
    const response = await CheckpointClient.prototype.request.call(this, op);
    if (op === "boot-witness") {
      new DataView(response.sample.buffer).setBigUint64(8, 0n, true);
    }
    return response;
  };
  const embeddedWrong = new CadrM7CBoundaryClient(embeddedWrongRaw, nativeRecord());
  await embeddedWrong.request("machine-info");
  await assert.rejects(embeddedWrong.request("run-digest-batch-m5"),
    /lacks the complete Form-C/);
}

async function testFullM7ControlFlowUsesFrozenReleaseBinding() {
  const rawClient = new CheckpointClient({
    boundary: BOUNDARY - 1n, batches: [1], frame: portableRecord(),
  });
  const fakeFrozenM6 = async config => {
    await config.client.request("machine-info");
    await config.client.request("run-digest-batch-m5");
    assert.ok(config.client.checkpoint !== null,
      "M7 capture completes while the wrapped M6 run request remains suspended");
    return { outcome: "ready", releaseRecordSha256: CADR_M6_RELEASE_RECORD_SHA256.slice() };
  };
  const result = await runM7CheckpointedM6BootForTest({
    nativeCapture: nativeRecord(), client: rawClient,
  }, fakeFrozenM6);
  assert.equal(result.comparison.outcome, "identical");
  assert.equal(result.comparison.m6_release_record_sha256,
    Buffer.from(CADR_M6_RELEASE_RECORD_SHA256).toString("hex"));
  assert.equal(result.comparison.m6_witness_sample_sha256.length, 64);

  await assert.rejects(runM7CheckpointedM6BootForTest({
    nativeCapture: nativeRecord(), client: new CheckpointClient({
      boundary: BOUNDARY - 1n, batches: [1], frame: portableRecord(),
    }),
  }, async config => {
    await config.client.request("machine-info");
    await config.client.request("run-digest-batch-m5");
    return { outcome: "ready", releaseRecordSha256: new Uint8Array(32) };
  }), /not bound to the frozen release record/);

  await assert.rejects(runM7CheckpointedM6BootForTest({
    nativeCapture: nativeRecord(), client: new CheckpointClient({
      boundary: BOUNDARY - 1n, batches: [1], frame: portableRecord(),
    }),
  }, async config => {
    await config.client.request("machine-info");
    await config.client.request("run-digest-batch-m5");
    return { outcome: "failed", report: {
      reason: "ready-observation-mismatch", phase: "ready-observation",
      status: 2, boundary: BOUNDARY + 64n,
    } };
  }), /ready-observation-mismatch; phase=ready-observation; status=2; boundary=982990278/);
}

await testStrictRecordAndFirstDifference();
await testCheckpointExactStopAndConsecutiveBatches();
await testOvershootFailsClosedAndWrongCIsRejected();
await testFullM7ControlFlowUsesFrozenReleaseBinding();
console.log("cadr M7 frame-checkpoint tests passed");
