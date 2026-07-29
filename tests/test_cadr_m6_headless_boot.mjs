import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  CADR_HOST_RESULT_OK,
  CADR_STATUS_NOT_READY,
  CADR_STATUS_OK,
  createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";
import {
  CADR_M6_FORM_A,
  CADR_M6_FORM_B,
  CADR_M6_FORM_C,
  CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES,
  CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  CADR_M6_RELEASE_RECORD_SCHEMA,
  CADR_M6_CADET_MAPPING_SHA256,
  CADR_M6_FORM_A_START_BOUNDARY,
  canonicalM6ReadyWitness,
  canonicalSyntheticM6ReadyWitnessForTest,
  preflightM6Artifacts,
  runM6HeadlessBoot,
  runM6HeadlessBootConformance,
  runSyntheticM6HeadlessBootForTest,
  runSyntheticM6HeadlessBootConformanceForTest,
  serializeM6HostTranscript,
  serializeM6ReadyConformance,
  serializeSyntheticM6ReadyConformanceForTest,
  validateSyntheticM6ReleaseRecord,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

const ZERO = new Uint8Array(32);
const SYNTH_A_BOUNDARY = CADR_M6_FORM_A_START_BOUNDARY + 50002n;
const SYNTH_B_START = CADR_M6_FORM_A_START_BOUNDARY + 50001n + 20000000n;
const SYNTH_B_BOUNDARY = SYNTH_B_START + 50002n;
const SYNTH_C_BOUNDARY = SYNTH_B_BOUNDARY + 50002n;
const SYNTH_SETTLED_BOUNDARY = SYNTH_C_BOUNDARY + 1000000n;
const SYNTH_SUFFIX_FIRST = SYNTH_SETTLED_BOUNDARY + 1n;
const NATIVE_RELEASE_RECORD = JSON.parse(await readFile(
  new URL("../cadr-web/oracle/cadr-m6-release-record.json", import.meta.url),
  "utf8"));
const SEMANTIC_ARTIFACTS = [
  { kind: 1, byte_count: "854",
    sha256: "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f" },
  { kind: 2, byte_count: "20480",
    sha256: "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6" },
  { kind: 4, byte_count: "3130",
    sha256: "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d" },
  { kind: 5, byte_count: "83270",
    sha256: "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a" },
  { kind: 3, byte_count: "269562880",
    sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5" },
];
const OLD_MISLABELED_ARTIFACTS = [
  { kind: 1, byte_count: "20480",
    sha256: "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6" },
  { kind: 2, byte_count: "3130",
    sha256: "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d" },
  { kind: 4, byte_count: "83270",
    sha256: "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a" },
  { kind: 5, byte_count: "262",
    sha256: "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438" },
  SEMANTIC_ARTIFACTS[4],
];

async function digest(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function fixtureArtifacts() {
  const artifacts = [];
  const profileArtifacts = [];
  for (const kind of [1, 2, 4, 5, 3]) {
    const bytes = Uint8Array.from(
      { length: kind === 3 ? 2048 : kind + 3 },
      (_, index) => (kind * 17 + index) & 255);
    artifacts.push({
      kind,
      byteCount: BigInt(bytes.byteLength),
      async readRange(offset, byteCount) {
        return bytes.slice(Number(offset), Number(offset + byteCount));
      },
    });
    profileArtifacts.push({
      kind,
      byteCount: BigInt(bytes.byteLength),
      sha256: await digest(bytes),
    });
  }
  return {
    artifacts,
    profile: { id: "C-M6-TEST", artifacts: profileArtifacts },
    hashArtifact: async artifact =>
      digest(await artifact.readRange(0n, artifact.byteCount)),
  };
}

function machineInfo({
  lifecycle = 2,
  artifactMask = 0x1f,
  boundary = 0n,
  generation = 1n,
  outstanding = 0n,
  lastCompleted = 0n,
} = {}) {
  const bytes = new Uint8Array(64);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, lifecycle, true);
  view.setUint32(4, artifactMask, true);
  view.setBigUint64(8, boundary, true);
  view.setBigUint64(16, boundary, true);
  view.setBigUint64(24, generation, true);
  view.setBigUint64(32, outstanding + 1n, true);
  view.setBigUint64(40, outstanding, true);
  view.setBigUint64(48, lastCompleted, true);
  view.setUint32(60, 1, true);
  return bytes.buffer;
}

function descriptor(firstBlock = 0n) {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, firstBlock, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, 1024, true);
  return bytes;
}

class FakeClient {
  constructor(mode = "ready") {
    this.mode = mode;
    this.calls = [];
    this.artifactMask = 0;
    this.boundary = 0n;
    this.batchTurn = 0;
    this.outstanding = 0n;
    this.lastCompleted = 0n;
    this.lifecycle = "NEW";
    this.coreLifecycle = 0;
    this.scheduledBatches = 0;
    this.machineInfoCalls = 0;
    this.runRanges = [];
    this.digestBuffers = new Map();
  }

  async request(op, fields = {}) {
    this.calls.push({ op, fields });
    if (op === "input" || op === "stream-begin" || op === "stream-chunk" ||
        op === "stream-finish" || op === "stream-abort") return { status: 0 };
    if (op === "import") {
      this.artifactMask |= 1 << (fields.artifactKind === 1 ? 0 :
        fields.artifactKind === 2 ? 1 :
        fields.artifactKind === 3 ? 2 :
        fields.artifactKind === 4 ? 3 : 4);
      return { status: 0 };
    }
    if (op === "machine-info") {
      this.machineInfoCalls += 1;
      if (this.mode === "machine-info-failure" && this.machineInfoCalls >= 3) {
        return { status: 7 };
      }
      return { status: 0, info: machineInfo({
        lifecycle: this.coreLifecycle,
        artifactMask: this.artifactMask,
        boundary: this.boundary,
        outstanding: this.outstanding,
        lastCompleted: this.lastCompleted,
      }) };
    }
    if (op === "cold-power-on") {
      this.coreLifecycle = 1;
      this.lifecycle = "CORE_RESET"; return { status: 0, lifecycle: this.lifecycle };
    }
    if (op === "boot") {
      this.coreLifecycle = 2;
      this.lifecycle = "PAUSED"; return { status: 0, lifecycle: this.lifecycle };
    }
    if (op === "scheduler-visibility") {
      return { status: 0, lifecycle: this.lifecycle, hidden: fields.hidden };
    }
    if (op === "scheduler-start") {
      this.lifecycle = "RUNNING"; return { status: 0, lifecycle: this.lifecycle };
    }
    if (op === "scheduler-pause") {
      this.lifecycle = "PAUSED"; return { status: 0, lifecycle: this.lifecycle };
    }
    if (op === "media-overlay-state") return { status: 0, lifecycle: this.lifecycle };
    if (op === "scheduler-events") {
      this.scheduledBatches += 1;
      return { status: 0, delivered: fields.events.length, lifecycle: this.lifecycle };
    }
    if (op === "boot-witness") {
      let debugInstruction = this.boundary < SYNTH_A_BOUNDARY ? 0n :
        this.boundary < SYNTH_B_BOUNDARY ? CADR_M6_FORM_A :
          this.boundary < SYNTH_C_BOUNDARY ? CADR_M6_FORM_B : CADR_M6_FORM_C;
      if (this.mode === "shifted-wasm" && this.boundary === SYNTH_A_BOUNDARY) {
        debugInstruction = 0n;
      }
      if (this.mode === "missing-c" && this.boundary >= SYNTH_C_BOUNDARY) {
        debugInstruction = CADR_M6_FORM_B;
      }
      if (this.mode === "host-magic" && this.boundary === 0n) {
        debugInstruction = CADR_M6_FORM_A;
      } else if (this.mode === "b-before-a" && this.boundary === 1n) {
        debugInstruction = CADR_M6_FORM_B;
      } else if (this.mode === "partial" && this.boundary === 1n) {
        debugInstruction = 0x41314d36n;
      }
      const sample = new Uint8Array(96);
      sample.set(new TextEncoder().encode("CDRM6I1"));
      const sampleView = new DataView(sample.buffer);
      sampleView.setBigUint64(8, debugInstruction, true);
      sampleView.setUint32(68, 0x18000, true);
      sampleView.setUint32(72, 3, true);
      sampleView.setUint32(84, 1, true);
      if (this.mode === "suffix-plus-one" &&
          this.boundary === SYNTH_SUFFIX_FIRST) {
        sampleView.setBigUint64(16, 1n, true);
      }
      if (this.mode === "suffix-minus-one" &&
          this.boundary === SYNTH_SUFFIX_FIRST + 63n) {
        sampleView.setBigUint64(16, 1n, true);
      }
      sampleView.setUint32(72, 3, true);
      return {
        status: 0, debugInstruction, boundary: this.boundary, generation: 1n,
        wireSchema: "CDRM6I1", sample: sample.buffer,
        coreLifecycle: this.mode === "unsafe-lifecycle" ? 1 : this.coreLifecycle,
        persistentStatus: this.mode === "persistent-residue" ? 7 : 0,
        lastCompletedRequestId: this.lastCompleted,
        outstandingRequestId: this.outstanding,
        schedulerPendingCount: 0, schedulerPhase: 0,
        iobCsr: 0,
        iobFifoCount:
          (this.mode === "residue" && debugInstruction === CADR_M6_FORM_B) ||
          (this.mode === "cleanup-residue" &&
            this.boundary === SYNTH_SETTLED_BOUNDARY) ? 1 : 0,
        iobScancode:
          this.mode === "wrong-retained-scancode" ? 0 :
            this.boundary >= SYNTH_A_BOUNDARY ? 0x18000 : 0,
        outstandingOperation: this.outstanding === 0n ? 0 : 1,
        diskInterruptRequest: 1,
        hostRequestPending: 0,
        hostCompletionQueued: 0,
        diskTransferActive: 0, diskStatus: 3,
        expectedCompletionByteCount:
          this.mode === "completion-residue" ? 1n : 0n,
        completionByteCount:
          this.mode === "completion-residue" ? 1n : 0n,
        boundaryPendingHost: false,
        runActive: false, deferredControlCount: 0,
        mediaBusy: false, mediaDirty: false, mediaSnapshotBlocked: false,
        mediaOverlayGeneration: 0n,
        visibilityInitialized: true, hidden: false,
      };
    }
    if (op === "run-digest-batch-m5") {
      this.batchTurn += 1;
      if (this.mode === "terminal") {
        this.lifecycle = "FAILED";
        this.boundary = 1n;
        return {
          status: 0, terminalStatus: 16, lifecycle: "FAILED",
          boundaryCount: 0, boundaryPendingHost: false,
          lastCompleteBoundary: 1n, digests: new ArrayBuffer(0),
          queueDigest: new Uint8Array(32).fill(0x31).buffer,
          coreStateDigest: new Uint8Array(32).fill(0x32).buffer,
        };
      }
      if (this.mode === "host" && this.batchTurn === 1) {
        this.boundary = 1n;
        this.outstanding = 1n;
        this.lifecycle = "WAITING_FOR_HOST";
        return {
          status: 0, terminalStatus: 8, lifecycle: this.lifecycle,
          boundaryCount: 0, boundaryPendingHost: true,
          digests: new ArrayBuffer(0),
        };
      }
      if (this.mode === "host") {
        if (this.batchTurn > 2) this.boundary += 1n;
        this.lifecycle = "RUNNING";
        return {
          status: 0, terminalStatus: 0, lifecycle: this.lifecycle,
          boundaryCount: 1, boundaryPendingHost: false,
          digests: new Uint8Array(128).fill(0x44).buffer,
        };
      }
      const before = this.boundary;
      this.boundary += BigInt(fields.clockSlots);
      this.runRanges.push([before, this.boundary]);
      let digests = this.digestBuffers.get(fields.clockSlots);
      if (digests === undefined) {
        digests = new Uint8Array(fields.clockSlots * 128).fill(0x44).buffer;
        this.digestBuffers.set(fields.clockSlots, digests);
      }
      return {
        status: 0, terminalStatus: 0, lifecycle: "RUNNING",
        boundaryCount: fields.clockSlots, boundaryPendingHost: false,
        digests,
      };
    }
    if (op === "host-next-request") {
      if (this.outstanding === 0n) return { status: CADR_STATUS_NOT_READY };
      if (this.mode === "malformed-host") {
        return { status: 0, request: null, descriptor: new ArrayBuffer(0),
          requestPayload: new ArrayBuffer(0) };
      }
      const bytes = descriptor();
      return {
        status: 0,
        request: {
          operation: 1, generation: 1n, requestId: 1n,
          descriptorByteCount: 16n, requestPayloadByteCount: 0n,
          completionByteCount: 1024n,
        },
        descriptor: bytes.buffer,
        requestPayload: new ArrayBuffer(0),
      };
    }
    if (op === "host-complete") {
      assert.equal(fields.hostStatus, CADR_HOST_RESULT_OK);
      this.outstanding = 0n;
      this.lastCompleted = fields.requestId;
      this.lifecycle = "RUNNING";
      return { status: 0, lifecycle: this.lifecycle };
    }
    if (op === "scheduler-state") {
      if (this.mode === "terminal") {
        return {
          status: 0, lifecycle: "FAILED", lastCompleteBoundary: 1n,
          queueDigest: new Uint8Array(32).fill(0x31).buffer,
          coreStateDigest: new Uint8Array(32).fill(0x32).buffer,
          controlWitness: ZERO.buffer,
        };
      }
      return {
        status: 0, lifecycle: this.lifecycle, hidden: false,
        visibilityInitialized: true, runActive: false,
        deferredControlCount: 0, pendingBoundaryDigest: false,
        mediaBusy: false, mediaDirty: false, mediaSnapshotBlocked: false,
        mediaOverlayGeneration: 0n, controlWitness: ZERO.buffer,
      };
    }
    if (op === "boundary-digest-v5") {
      return { status: 0, digest: new Uint8Array(32).fill(0x51).buffer };
    }
    if (op === "scheduler-queue-digest") {
      return { status: 0, digest: new Uint8Array(32).fill(0x52).buffer };
    }
    throw new Error(`unexpected fake operation ${op}`);
  }
}

function serviceFor(artifacts) {
  const disk = artifacts.find(item => item.kind === 3);
  return createM4BlockRangeService({
    imageByteCount: disk.byteCount,
    expectedImageByteCount: disk.byteCount,
    readRange: disk.readRange,
  });
}

const fixtures = await fixtureArtifacts();

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function syntheticReleaseRecord(profileArtifacts = fixtures.profile.artifacts) {
  const zero = "00".repeat(32);
  const initialScancodes =
    [0o136, 0x8000, 0o024, 0o054, 0x8001, 0x8000, 0o136, 0x8000,
     0o123, 0x8000, 0o136, 0x8000];
  const initialEvents = initialScancodes.map((scancode, index) => ({
    index, phase: index < 8 ? "boot" : "form-a",
    due_boundary: (index < 2 ?
      25000000n + (BigInt(index) * 1000000n + 59n) / 60n :
      index < 8 ?
        27000000n + (BigInt(index - 2) * 1000000n + 59n) / 60n :
        CADR_M6_FORM_A_START_BOUNDARY +
          [0n, 16667n, 33334n, 50001n][index - 8]
    ).toString(),
    scancode,
  }));
  const formBEvents = [0o114, 0x8000, 0o136, 0x8000].map(
    (scancode, index) => ({
      index: initialEvents.length + index,
      phase: "form-b",
      due_boundary: (
        SYNTH_B_START + [0n, 16667n, 33334n, 50001n][index]
      ).toString(),
      scancode,
    }));
  const schedule = {
    schema: "cadr-m6-raw-cadet-boundary-schedule-v1",
    event_count: 16,
    pre_a_batches: [initialEvents.slice(0, 8), initialEvents.slice(8)],
    post_a_batches: [formBEvents],
  };
  schedule.sha256 = hex(await digest(
    new TextEncoder().encode(canonicalJson(schedule))));
  const sample = new Uint8Array(96);
  sample.set(new TextEncoder().encode("CDRM6I1"));
  const sampleView = new DataView(sample.buffer);
  sampleView.setBigUint64(8, CADR_M6_FORM_C, true);
  sampleView.setUint32(68, 0x18000, true);
  sampleView.setUint32(72, 3, true);
  sampleView.setUint32(84, 1, true);
  const samples = Array.from({ length: 64 }, () => hex(sample));
  const samplesSha = hex(await digest(Uint8Array.from(
    samples.flatMap(item => [...item.matchAll(/../g)].map(match =>
      Number.parseInt(match[0], 16))))));
  const suffixFinal = SYNTH_SUFFIX_FIRST + 63n;
  const clockCount = Number((suffixFinal * 60n) / 1000000n);
  const clockTranscript = new Uint8Array(16 + clockCount * 16);
  clockTranscript.set(new TextEncoder().encode("CDRM6CLK1"));
  const clockView = new DataView(clockTranscript.buffer);
  clockView.setUint32(12, clockCount, true);
  for (let index = 1; index <= clockCount; index += 1) {
    const offset = 16 + (index - 1) * 16;
    clockView.setBigUint64(offset, BigInt(index), true);
    clockView.setBigUint64(offset + 8,
      (BigInt(index) * 1000000n + 59n) / 60n, true);
  }
  return {
    schema: CADR_M6_RELEASE_RECORD_SCHEMA,
    contract: CADR_M6_READY_CONTRACT,
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6",
    identities: {
      system_fossil: zero, usim_fossil: zero,
      oracle_patch_sha256: zero, native_executable_sha256: zero,
      cadet_mapping_sha256: CADR_M6_CADET_MAPPING_SHA256,
    },
    artifacts: [1, 2, 4, 5, 3].map(kind => {
      const artifact = profileArtifacts.find(item => item.kind === kind);
      return {
        kind,
        byte_count: artifact.byteCount.toString(),
        sha256: hex(artifact.sha256),
      };
    }),
    native_inputs: [{
      id: "usite-extra-hosts",
      byte_count: "262",
      sha256: "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
    }],
    execution_environment: {
      policy_id: "cadr-m6-native-minimal-environment-v1",
      inherited: false,
      variables: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
    },
    forms: {
      a: { utf8: "a", utf8_sha256: hex(await digest(new TextEncoder().encode("a"))),
        magic48: CADR_M6_FORM_A.toString(16).padStart(12, "0"),
        words16: [0x4d36, 0x4131, 0xa55a] },
      b: { utf8: "b", utf8_sha256: hex(await digest(new TextEncoder().encode("b"))),
        magic48: CADR_M6_FORM_B.toString(16).padStart(12, "0"),
        words16: [0x4d36, 0x4232, 0x5aa5] },
      c: structuredClone(NATIVE_RELEASE_RECORD.forms.c),
    },
    schedule,
    timing: {
      clock_policy: "ceil(n*1000000/60)",
      initial_return_boundary: "25000000",
      form_a_start_boundary: CADR_M6_FORM_A_START_BOUNDARY.toString(),
      form_b_hold_boundaries: "20000000",
      input_chunk_characters: 16,
      input_chunk_pause_boundaries: "10000000",
      intra_chunk_frame_policy: "ceil(n*1000000/60)",
      listener_idle_c_timeout_boundaries: "100000000",
      listener_idle_c_cleanup_hold_boundaries: "1000000",
    },
    listener_idle_observer: structuredClone(
      NATIVE_RELEASE_RECORD.listener_idle_observer),
    clock_schedule: {
      policy_id: "C-M6-CEIL-N-1000000-OVER-60-GUEST-BOUNDARY-v1",
      formula: "due(n)=ceil(n*1000000/60), n=1..event_count",
      numerator: 1000000,
      denominator: 60,
      event_count: clockCount,
      transcript_sha256: hex(await digest(clockTranscript)),
    },
    idle_oracle: {
      wire_schema: "CDRM6I1", sample_bytes: 96, sample_count: 64,
      first_boundary_delta_from_settled: "1", samples_sha256: samplesSha, samples,
    },
    expected_debug_writes: [
      [0o766000, 0x4d36], [0o766002, 0x4131], [0o766004, 0xa55a],
      [0o766000, 0x4d36], [0o766002, 0x4232], [0o766004, 0x5aa5],
      [0o766000, 0x4d36], [0o766002, 0x4944], [0o766004, 0x4c45],
    ].map(([address, value]) => ({ address, value })),
    native_runs: [0, 1, 2].map(index => ({
      session_id: `native-${index}`,
      private_disk_instance_id: `disk-${index}`,
      capture_sha256: index.toString(16).padStart(64, "0"),
      input_transcript_sha256: zero,
      debug_write_transcript_sha256: zero,
      private_disk_sha256_at_start: zero,
      private_disk_sha256_at_end: zero,
      a_boundary: SYNTH_A_BOUNDARY.toString(),
      b_boundary: SYNTH_B_BOUNDARY.toString(),
      listener_idle_c_boundary: SYNTH_C_BOUNDARY.toString(),
      listener_idle_settled_boundary: SYNTH_SETTLED_BOUNDARY.toString(),
      suffix_first_boundary: SYNTH_SUFFIX_FIRST.toString(),
      suffix_sha256: samplesSha,
      schedule_consumed: true,
      unexpected_input_count: 0,
      forbidden_debug_write_count: 0,
      forced_stop: false,
      state_may_be_incomplete: false,
    })),
  };
}

{
  const verified = await preflightM6Artifacts(fixtures);
  assert.equal(verified.profileId, "C-M6-TEST");
  assert.deepEqual(verified.artifacts.map(item => item.kind), [1, 2, 4, 5, 3]);
}

{
  const original = Uint8Array.from({ length: 4 }, (_, index) => 17 + index);
  const mutable = original.slice();
  const artifacts = fixtures.artifacts.map(item => item.kind === 1 ? {
    kind: 1,
    byteCount: 4n,
    async readRange(offset, byteCount) {
      return mutable.slice(Number(offset), Number(offset + byteCount));
    },
  } : item);
  const verified = await preflightM6Artifacts({
    artifacts,
    profile: fixtures.profile,
    hashArtifact: fixtures.hashArtifact,
  });
  mutable.fill(0xff);
  assert.deepEqual(
    await verified.sources.find(item => item.kind === 1).readRange(0n, 4n),
    original,
    "artifact ingress remains bound to the bytes hashed during preflight");
}

{
  const sourceRecord = await syntheticReleaseRecord();
  sourceRecord.artifacts = structuredClone(SEMANTIC_ARTIFACTS);
  const record = await validateSyntheticM6ReleaseRecord(sourceRecord);
  assert.equal(record.initialEventBatches.flat().find(
    event => event.kind === 3).scancode, 0o136);
  assert.equal(record.native_runs.length, 3);
  const nativeRecord = await validateSyntheticM6ReleaseRecord(NATIVE_RELEASE_RECORD);
  assert.equal(nativeRecord.contract, CADR_M6_READY_CONTRACT);
  assert.deepEqual(CADR_M6_RELEASE_RECORD_SHA256, await digest(
    new TextEncoder().encode(canonicalJson(NATIVE_RELEASE_RECORD))),
  "the compiled M6 release digest pins the strict native ABC record");
  const nativeFormBScancodes = NATIVE_RELEASE_RECORD.schedule.post_a_batches
    .flat().map(event => event.scancode);
  const quoteFrame = [0o024, 0o133, 0x8001, 0x8000];
  const upperMFrame = [0o024, 0o154, 0x8001, 0x8000];
  for (const frame of [quoteFrame, upperMFrame]) {
    assert.notEqual(nativeFormBScancodes.findIndex((value, index) =>
      frame.every((expected, offset) => nativeFormBScancodes[index + offset] === expected)), -1,
    `native Form B retains the exact shifted Cadet ${frame[1].toString(8)} frame`);
  }
  const oldMislabeled = structuredClone(NATIVE_RELEASE_RECORD);
  oldMislabeled.artifacts = structuredClone(OLD_MISLABELED_ARTIFACTS);
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(oldMislabeled),
    /exact ABI semantic identities/,
    "the retired kind mapping is rejected independently of the compiled digest");
  const hostsAsArtifact = structuredClone(NATIVE_RELEASE_RECORD);
  hostsAsArtifact.native_inputs = [];
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(hostsAsArtifact),
    /exact native Chaos hosts input/);
  const hostileEnvironment = structuredClone(NATIVE_RELEASE_RECORD);
  hostileEnvironment.execution_environment.variables.TZ = "America/New_York";
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(hostileEnvironment),
    /different native execution environment/);
  const missingReturn = structuredClone(sourceRecord);
  missingReturn.schedule.pre_a_batches[0][0].scancode = 0o132;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(missingReturn),
    /Return,N,Return/);
  const duplicateSession = structuredClone(sourceRecord);
  duplicateSession.native_runs[2].session_id =
    duplicateSession.native_runs[1].session_id;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(duplicateSession),
    /fresh clean run/);
  const duplicateDue = structuredClone(sourceRecord);
  duplicateDue.schedule.pre_a_batches[0][1].due_boundary =
    duplicateDue.schedule.pre_a_batches[0][0].due_boundary;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(duplicateDue),
    /not canonical/);
  const emptySchedule = structuredClone(sourceRecord);
  emptySchedule.schedule.pre_a_batches = [];
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(emptySchedule),
    /invalid frozen M6 schedule/);
  const extraSchedule = structuredClone(sourceRecord);
  extraSchedule.schedule.post_a_batches[0].push({
    index: 16, phase: "form-b",
    due_boundary: SYNTH_B_BOUNDARY.toString(), scancode: 0o133,
  });
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(extraSchedule),
    /event_count/);
  const busySuffix = structuredClone(sourceRecord);
  const busy = Uint8Array.from(
    busySuffix.idle_oracle.samples[0].match(/../g),
    value => Number.parseInt(value, 16));
  new DataView(busy.buffer).setUint32(76, 1, true);
  busySuffix.idle_oracle.samples[0] = hex(busy);
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(busySuffix),
    /not quiescent Form C/);
  const decimalMagic = structuredClone(sourceRecord);
  decimalMagic.forms.a.magic48 = CADR_M6_FORM_A.toString();
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(decimalMagic),
    /frozen form/);
  const wrongAddress = structuredClone(sourceRecord);
  wrongAddress.expected_debug_writes[0].address = 253952;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(wrongAddress),
    /differs from A then B then C/);
  const boundaryDisagreement = structuredClone(sourceRecord);
  boundaryDisagreement.native_runs[2].a_boundary =
    (SYNTH_A_BOUNDARY + 1n).toString();
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(boundaryDisagreement),
    /disagree on A\/B\/C\/settled boundaries/);
  const changedForm = structuredClone(sourceRecord);
  changedForm.forms.a.utf8 = "c";
  changedForm.forms.a.utf8_sha256 = hex(
    await digest(new TextEncoder().encode("c")));
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(changedForm),
    /do not encode the exact frozen Form/);
  const oversizedBatch = structuredClone(sourceRecord);
  oversizedBatch.schedule.pre_a_batches[0] = Array.from(
    { length: 65 }, () => structuredClone(
      sourceRecord.schedule.pre_a_batches[0][0]));
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(oversizedBatch),
    /not 1..64 events/);
  const shortSuffix = structuredClone(sourceRecord);
  shortSuffix.idle_oracle.samples.pop();
  shortSuffix.idle_oracle.sample_count -= 1;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(shortSuffix),
    /not an exact CDRM6I1 suffix/);
  const longSuffix = structuredClone(sourceRecord);
  longSuffix.idle_oracle.samples.push(
    longSuffix.idle_oracle.samples.at(-1));
  longSuffix.idle_oracle.sample_count += 1;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(longSuffix),
    /not an exact CDRM6I1 suffix/);
  const lateSuffix = structuredClone(sourceRecord);
  lateSuffix.idle_oracle.first_boundary_delta_from_settled = "2";
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(lateSuffix),
    /begin exactly one boundary after settled/);
  const wrongMapping = structuredClone(sourceRecord);
  wrongMapping.identities.cadet_mapping_sha256 = "ff".repeat(32);
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(wrongMapping),
    /different Cadet mapping/);
  const changedDisk = structuredClone(sourceRecord);
  changedDisk.native_runs[0].private_disk_sha256_at_end = "11".repeat(32);
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(changedDisk),
    /changed its private disk/);
  const reusedCapture = structuredClone(sourceRecord);
  reusedCapture.native_runs[1].capture_sha256 =
    reusedCapture.native_runs[0].capture_sha256;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(reusedCapture),
    /reuse one capture transcript/);
  const wallClockPolicy = structuredClone(sourceRecord);
  wallClockPolicy.clock_schedule.policy_id = "host-setitimer-60hz";
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(wallClockPolicy),
    /frozen M5 rational policy/);
  const wrongPacing = structuredClone(sourceRecord);
  wrongPacing.timing.input_chunk_pause_boundaries = "9999999";
  await assert.rejects(
    () => validateSyntheticM6ReleaseRecord(wrongPacing),
    /frozen paced input policy/);
  const missingC = structuredClone(sourceRecord);
  delete missingC.forms.c;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(missingC),
    /missing or unknown fields/);
  const reorderedC = structuredClone(sourceRecord);
  reorderedC.native_runs[0].listener_idle_c_boundary =
    reorderedC.native_runs[0].b_boundary;
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(reorderedC),
    /fresh clean run/);
  const cleanupDrift = structuredClone(sourceRecord);
  cleanupDrift.native_runs[0].listener_idle_settled_boundary =
    (SYNTH_SETTLED_BOUNDARY - 1n).toString();
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(cleanupDrift),
    /fresh clean run/);
  const observerMutation = structuredClone(sourceRecord);
  observerMutation.listener_idle_observer.cleanup.hold_boundaries = "999999";
  await assert.rejects(() => validateSyntheticM6ReleaseRecord(observerMutation),
    /exact Form-C contract/);
  const witness = await canonicalM6ReadyWitness({
    releaseRecord: sourceRecord,
    artifactSetSha256: new Uint8Array(32).fill(4),
    privateDiskBaseSha256: new Uint8Array(32).fill(5),
    formABoundary: SYNTH_A_BOUNDARY,
    formBBoundary: SYNTH_B_BOUNDARY,
    listenerIdleCBoundary: SYNTH_C_BOUNDARY,
    listenerIdleSettledBoundary: SYNTH_SETTLED_BOUNDARY,
    readyBoundary: SYNTH_SETTLED_BOUNDARY + 64n,
    cdrstate5Sha256: new Uint8Array(32).fill(1),
    cdrm5q1Sha256: new Uint8Array(32).fill(2),
    hostTranscriptSha256: new Uint8Array(32).fill(3),
  });
  assert.equal(witness.byteLength, 32);
  {
    const domain = new TextEncoder().encode("CDRM6READY3");
    const expected = new Uint8Array(domain.byteLength + 6 * 32 + 10 * 8);
    expected.set(domain);
    let offset = domain.byteLength;
    for (const item of [
      await digest(new TextEncoder().encode(canonicalJson(sourceRecord))),
      new Uint8Array(32).fill(4),
      new Uint8Array(32).fill(5),
    ]) {
      expected.set(item, offset); offset += 32;
    }
    const expectedView = new DataView(expected.buffer);
    for (const boundary of [
      SYNTH_A_BOUNDARY, SYNTH_B_BOUNDARY, SYNTH_C_BOUNDARY,
      SYNTH_SETTLED_BOUNDARY, SYNTH_SETTLED_BOUNDARY + 64n,
      SYNTH_A_BOUNDARY, SYNTH_B_BOUNDARY, SYNTH_C_BOUNDARY,
      SYNTH_SETTLED_BOUNDARY, SYNTH_SETTLED_BOUNDARY + 64n,
    ]) {
      expectedView.setBigUint64(offset, boundary, true);
      offset += 8;
    }
    for (const item of [
      new Uint8Array(32).fill(1),
      new Uint8Array(32).fill(2),
      new Uint8Array(32).fill(3),
    ]) {
      expected.set(item, offset); offset += 32;
    }
    assert.deepEqual(witness, await digest(expected),
      "semantic witness uses the exact frozen concatenation");
  }
  await assert.rejects(() => canonicalM6ReadyWitness({
    releaseRecord: sourceRecord,
    artifactSetSha256: new Uint8Array(32).fill(4),
    privateDiskBaseSha256: new Uint8Array(32).fill(5),
    formABoundary: SYNTH_A_BOUNDARY,
    formBBoundary: SYNTH_B_BOUNDARY + 1n,
    listenerIdleCBoundary: SYNTH_C_BOUNDARY,
    listenerIdleSettledBoundary: SYNTH_SETTLED_BOUNDARY,
    readyBoundary: SYNTH_SETTLED_BOUNDARY + 64n,
    cdrstate5Sha256: new Uint8Array(32).fill(1),
    cdrm5q1Sha256: new Uint8Array(32).fill(2),
    hostTranscriptSha256: new Uint8Array(32).fill(3),
  }), /invalid canonical/);
}

{
  const python = String.raw`
import tempfile
from pathlib import Path
from tests import test_cadr_m6_native_witness as fixture
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    case = fixture.WitnessTests()
    record = fixture.m6w.verify(case.bundles(root))
    print(fixture.m6w.canonical(record).decode("utf-8"))
`;
  const releaseRecord = JSON.parse(execFileSync(
    "python3", ["-c", python],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));
  const validated = await validateSyntheticM6ReleaseRecord(releaseRecord);
  const firstFormA = validated.releaseRecord.schedule.pre_a_batches
    .flat().find(event => event.phase === "form-a");
  assert.equal(firstFormA.due_boundary,
    CADR_M6_FORM_A_START_BOUNDARY.toString(),
    "Python and JavaScript share the selected 50M Form-A anchor");
}

{
  const client = new FakeClient();
  const result = await runM6HeadlessBoot({
    ...fixtures, client, blockService: serviceFor(fixtures.artifacts),
    maxBoundaries: 4n, maxHostTransactions: 2,
    ready: {
      contract: CADR_M6_READY_CONTRACT,
      releaseRecord: new TextEncoder().encode(canonicalJson(NATIVE_RELEASE_RECORD)),
    },
  });
  assert.equal(result.outcome, "failed");
  assert.equal(result.report.reason, "artifact-preflight-mismatch",
    "the production digest accepts the ABC record before rejecting mismatched inputs");
  assert.equal(result.report.mutationStarted, false);
  assert.equal(client.calls.length, 0);
}

{
  const client = new FakeClient();
  const result = await runM6HeadlessBoot({
    ...fixtures,
    client,
    maxBoundaries: 1n,
    maxHostTransactions: 1025,
    ready: { contract: CADR_M6_READY_CONTRACT },
  });
  assert.equal(result.report.reason, "invalid-boot-configuration");
  assert.equal(client.calls.length, 0);
}

{
  const releaseRecord = await syntheticReleaseRecord();
  const client = new FakeClient();
  const result = await runSyntheticM6HeadlessBootForTest({
    ...fixtures,
    client,
    maxBoundaries: 225000000n,
    maxHostTransactions: 2,
  }, releaseRecord);
  assert.equal(result.outcome, "ready",
    `${result.report?.reason}: ${result.report?.detail ?? ""}`);
  assert.equal(result.ready.formABoundary, SYNTH_A_BOUNDARY);
  assert.equal(result.ready.formBBoundary, SYNTH_B_BOUNDARY);
  assert.equal(result.ready.listenerIdleCBoundary, SYNTH_C_BOUNDARY);
  assert.equal(result.ready.listenerIdleSettledBoundary, SYNTH_SETTLED_BOUNDARY);
  assert.equal(result.ready.semanticWitness.byteLength, 32);
  const deliveredEvents = client.calls.filter(
    call => call.op === "scheduler-events").flatMap(
      call => call.fields.events);
  const deliveredClocks = deliveredEvents.filter(event => event.kind === 2);
  assert.equal(deliveredClocks.length,
    releaseRecord.clock_schedule.event_count);
  deliveredClocks.forEach((event, index) => {
    assert.equal(event.dueTick,
      (BigInt(index + 1) * 1000000n + 59n) / 60n);
    assert.equal(event.value, 1);
  });
  for (let index = 1; index < deliveredEvents.length; index += 1) {
    if (deliveredEvents[index - 1].dueTick === deliveredEvents[index].dueTick) {
      assert.equal(deliveredEvents[index - 1].kind, 2,
        "clock dispatch precedes coincident keyboard input");
    }
  }
  assert.equal(client.calls.filter(
    call => call.op === "run-digest-batch-m5").every(
      call => call.fields.clockSlots > 0 &&
        call.fields.clockSlots <= 4096), true);
  assert.equal(client.runRanges.some(([before, after]) =>
    before < SYNTH_A_BOUNDARY && after > SYNTH_A_BOUNDARY), false,
  "the driver cannot overshoot native Form A observation");
  assert.equal(client.runRanges.some(([before, after]) =>
    before < SYNTH_B_START && after > SYNTH_B_START), false,
  "the driver cannot overshoot first Form B input");
}

for (const mode of [
  "shifted-wasm", "suffix-plus-one", "suffix-minus-one", "persistent-residue",
  "completion-residue", "unsafe-lifecycle", "machine-info-failure",
  "wrong-retained-scancode", "missing-c", "cleanup-residue",
]) {
  const result = await runSyntheticM6HeadlessBootForTest({
    ...fixtures,
    client: new FakeClient(mode),
    maxBoundaries: 225000000n,
    maxHostTransactions: 2,
  }, await syntheticReleaseRecord());
  assert.equal(result.outcome, "failed", mode);
}

{
  const releaseRecord = await syntheticReleaseRecord();
  const createdRuns = [];
  const disposedRuns = [];
  const completedRuns = [];
  const lifecycle = [];
  const result = await runSyntheticM6HeadlessBootConformanceForTest({
    createRun() {
      const run = {
        ...fixtures,
        client: new FakeClient(),
        maxBoundaries: 225000000n,
        maxHostTransactions: 2,
      };
      createdRuns.push(run);
      lifecycle.push(`create-${createdRuns.length - 1}`);
      return run;
    },
    disposeRun(run, index) {
      disposedRuns.push({ run, index });
      lifecycle.push(`dispose-${index}`);
    },
    onRunCompleted(progress) {
      completedRuns.push(progress);
      lifecycle.push(`complete-${progress.runIndex}`);
    },
  }, releaseRecord);
  assert.deepEqual(Object.keys(result).sort(), [
    "contract", "outcome", "release_record_sha256", "runs",
    "semantic_witness_sha256", "target",
  ]);
  assert.equal(result.outcome, "ready");
  assert.equal(result.runs.length, 3);
  const runKeys = [
    "artifact_set_sha256", "cdrm5q1_sha256", "cdrstate5_sha256",
    "form_a_boundary", "form_b_boundary", "host_transcript_sha256",
    "listener_idle_c_boundary", "listener_idle_settled_boundary",
    "no_pending_or_orphaned_host_request", "private_disk_base_sha256",
    "private_disk_instance_id", "ready_boundary", "run_index",
    "semantic_witness_sha256", "session_id",
  ];
  result.runs.forEach(run =>
    assert.deepEqual(Object.keys(run).sort(), runKeys));
  assert.equal(new Set(result.runs.map(item => item.session_id)).size, 3);
  assert.equal(new Set(result.runs.map(
    item => item.private_disk_instance_id)).size, 3);
  assert.deepEqual(disposedRuns.map(item => item.index), [0, 1, 2],
    "every ready run is disposed once before the next run can accumulate");
  assert.deepEqual(disposedRuns.map(item => item.run), createdRuns,
    "each ready run disposes the exact factory-owned configuration once");
  assert.deepEqual(completedRuns, [
    { completedRuns: 1, runIndex: 0 },
    { completedRuns: 2, runIndex: 1 },
    { completedRuns: 3, runIndex: 2 },
  ], "progress follows validated ready runs only");
  assert.deepEqual(lifecycle, [
    "create-0", "dispose-0", "complete-0",
    "create-1", "dispose-1", "complete-1",
    "create-2", "dispose-2", "complete-2",
  ], "each next factory waits for disposal and validated progress of its predecessor");
  assert.equal(result.release_record_sha256, hex(await digest(
    new TextEncoder().encode(canonicalJson(releaseRecord)))));
  assert.doesNotThrow(() => JSON.stringify(result),
    "canonical conformance contains no BigInt or typed arrays");
  const serialized = await serializeSyntheticM6ReadyConformanceForTest(result);
  assert.deepEqual(serialized,
    new TextEncoder().encode(canonicalJson(result)));
  const bytesFromHex = value => Uint8Array.from(value.match(/../g),
    byte => Number.parseInt(byte, 16));
  async function recomputeSummaryWitnesses(summary, record, synthetic = false) {
    for (const run of summary.runs) {
      const witness = synthetic ?
        canonicalSyntheticM6ReadyWitnessForTest : canonicalM6ReadyWitness;
      run.semantic_witness_sha256 = hex(await witness({
        releaseRecord: record,
        artifactSetSha256: bytesFromHex(run.artifact_set_sha256),
        privateDiskBaseSha256: bytesFromHex(run.private_disk_base_sha256),
        formABoundary: BigInt(run.form_a_boundary),
        formBBoundary: BigInt(run.form_b_boundary),
        listenerIdleCBoundary: BigInt(run.listener_idle_c_boundary),
        listenerIdleSettledBoundary: BigInt(run.listener_idle_settled_boundary),
        readyBoundary: BigInt(run.ready_boundary),
        cdrstate5Sha256: bytesFromHex(run.cdrstate5_sha256),
        cdrm5q1Sha256: bytesFromHex(run.cdrm5q1_sha256),
        hostTranscriptSha256: bytesFromHex(run.host_transcript_sha256),
      }));
    }
    summary.semantic_witness_sha256 = summary.runs[0].semantic_witness_sha256;
  }
  const extra = structuredClone(result);
  extra.unbounded_results = [];
  await assert.rejects(() => serializeSyntheticM6ReadyConformanceForTest(extra),
    /missing or unknown fields/);
  const wrongWitness = structuredClone(result);
  wrongWitness.runs[0].semantic_witness_sha256 = "ff".repeat(32);
  await assert.rejects(() => serializeSyntheticM6ReadyConformanceForTest(wrongWitness),
    /does not bind/);
  for (const [field, value] of [
    ["private_disk_base_sha256", "11".repeat(32)],
    ["artifact_set_sha256", "22".repeat(32)],
    ["cdrstate5_sha256", "33".repeat(32)],
    ["cdrm5q1_sha256", "44".repeat(32)],
    ["host_transcript_sha256", "55".repeat(32)],
    ["form_a_boundary", "1"],
    ["form_b_boundary", "2"],
    ["listener_idle_c_boundary", "3"],
    ["listener_idle_settled_boundary", "4"],
    ["ready_boundary", "3"],
  ]) {
    const changed = structuredClone(result);
    changed.runs[0][field] = value;
    await assert.rejects(() => serializeSyntheticM6ReadyConformanceForTest(changed),
      /does not bind|not strictly ordered/);
  }
  for (const field of ["session_id", "private_disk_instance_id"]) {
    const duplicate = structuredClone(result);
    duplicate.runs[1][field] = duplicate.runs[0][field];
    await assert.rejects(() => serializeSyntheticM6ReadyConformanceForTest(duplicate),
      /three fresh runs/);
  }
  const syntheticFlexible = structuredClone(result);
  for (const run of syntheticFlexible.runs) run.artifact_set_sha256 = "aa".repeat(32);
  await recomputeSummaryWitnesses(syntheticFlexible, releaseRecord, true);
  await assert.doesNotReject(
    () => serializeSyntheticM6ReadyConformanceForTest(syntheticFlexible),
    "the synthetic serializer keeps arbitrary test identities available");
  const productionSummary = {
    contract: CADR_M6_READY_CONTRACT,
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6",
    release_record_sha256: hex(CADR_M6_RELEASE_RECORD_SHA256),
    outcome: "ready",
    runs: [0, 1, 2].map(run_index => ({
      run_index,
      session_id: `production-session-${run_index}`,
      private_disk_instance_id: `production-disk-${run_index}`,
      private_disk_base_sha256:
        "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
      artifact_set_sha256:
        "ac8a1617651fa1546e3777c28f276f80d5675aae5da253b4c9e937b6f8019071",
      form_a_boundary: "328623243",
      form_b_boundary: "980313535",
      listener_idle_c_boundary: "982990214",
      listener_idle_settled_boundary: "983990214",
      ready_boundary: "983990278",
      cdrstate5_sha256: "33".repeat(32),
      cdrm5q1_sha256: "44".repeat(32),
      host_transcript_sha256: "55".repeat(32),
      semantic_witness_sha256: "",
      no_pending_or_orphaned_host_request: true,
    })),
    semantic_witness_sha256: "",
  };
  await recomputeSummaryWitnesses(productionSummary, NATIVE_RELEASE_RECORD);
  await assert.doesNotReject(() => serializeM6ReadyConformance(productionSummary));
  const forgedArtifactSet = structuredClone(productionSummary);
  for (const run of forgedArtifactSet.runs) run.artifact_set_sha256 = "11".repeat(32);
  await recomputeSummaryWitnesses(forgedArtifactSet, NATIVE_RELEASE_RECORD);
  await assert.rejects(() => serializeM6ReadyConformance(forgedArtifactSet),
    /pinned artifact or private-disk identity/);
  const forgedPrivateDisk = structuredClone(productionSummary);
  for (const run of forgedPrivateDisk.runs) run.private_disk_base_sha256 = "22".repeat(32);
  await recomputeSummaryWitnesses(forgedPrivateDisk, NATIVE_RELEASE_RECORD);
  await assert.rejects(() => serializeM6ReadyConformance(forgedPrivateDisk),
    /pinned artifact or private-disk identity/);
  const forgedRelease = structuredClone(result);
  forgedRelease.release_record_sha256 = "09".repeat(32);
  await assert.rejects(() => serializeM6ReadyConformance(forgedRelease),
    /compiled release digest/);
  const forgedBoundaries = structuredClone(productionSummary);
  for (const run of forgedBoundaries.runs) {
    run.form_a_boundary = "1";
    run.form_b_boundary = "2";
    run.listener_idle_c_boundary = "3";
    run.listener_idle_settled_boundary = "4";
    run.ready_boundary = "5";
  }
  await assert.rejects(() => serializeM6ReadyConformance(forgedBoundaries),
    /pinned native boundaries/);
}

{
  const client = new FakeClient();
  const result = await runM6HeadlessBoot({
    ...fixtures, client, blockService: serviceFor(fixtures.artifacts),
    maxBoundaries: 4n, maxHostTransactions: 2,
    ready: { contract: CADR_M6_READY_CONTRACT },
  });
  assert.equal(result.outcome, "failed");
  assert.equal(result.report.reason, "invalid-boot-configuration");
  assert.equal(result.report.phase, "preflight");
  assert.equal(result.report.mutationStarted, false);
  assert.equal(client.calls.length, 0);
}

{
  let called = false;
  const client = new FakeClient();
  const result = await runM6HeadlessBoot({
    ...fixtures, client, blockService: serviceFor(fixtures.artifacts),
    maxBoundaries: 4n, maxHostTransactions: 2,
    ready: {
      contract: CADR_M6_READY_CONTRACT,
      idleSuffix() { called = true; },
    },
  });
  assert.equal(result.outcome, "failed");
  assert.equal(result.report.reason, "invalid-boot-configuration");
  assert.equal(called, false, "caller code must never decide M6 READY");
  assert.equal(client.calls.length, 0);
}

{
  const client = new FakeClient();
  const result = await runM6HeadlessBoot({
    ...fixtures, client, blockService: serviceFor(fixtures.artifacts),
    maxBoundaries: 1n, maxHostTransactions: 1,
    ready: null,
  });
  assert.equal(result.outcome, "failed");
  assert.equal(result.report.phase, "preflight");
  assert.equal(result.report.mutationStarted, false);
  assert.equal(client.calls.length, 0);
}

{
  const transcript = serializeM6HostTranscript([], ZERO);
  assert.equal(transcript.byteLength, CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES);
  assert.equal(
    new TextDecoder().decode(transcript.slice(0, 8)), "CDRM6HS1");
  assert.equal(new DataView(transcript.buffer).getUint32(20, true), 0);
}

{
  let factories = 0;
  const disposedRuns = [];
  const completedRuns = [];
  const result = await runM6HeadlessBootConformance({
    createRun(index) {
      factories += 1;
      return {
        ...fixtures,
        client: new FakeClient(),
        maxBoundaries: 4n,
        maxHostTransactions: 2,
        ready: { contract: CADR_M6_READY_CONTRACT },
        sessionId: `session-${index}`,
        privateDiskIdentity: `private-disk-${index}`,
      };
    },
    disposeRun(run, index) {
      disposedRuns.push({ run, index });
    },
    onRunCompleted(progress) {
      completedRuns.push(progress);
    },
  });
  assert.equal(result.outcome, "failed");
  assert.equal(result.failed_run, 0);
  assert.equal(factories, 1, "a failed fresh boot stops the conformance run");
  assert.deepEqual(disposedRuns.map(item => item.index), [0],
    "the failed run is disposed exactly once before conformance returns");
  assert.deepEqual(completedRuns, [],
    "a failed run is never reported as completed progress");
}

{
  const throwingRun = {};
  Object.defineProperty(throwingRun, "client", {
    enumerable: true,
    get() {
      throw new Error("intentional throwing run configuration");
    },
  });
  const disposedRuns = [];
  await assert.rejects(() => runM6HeadlessBootConformance({
    createRun() {
      return throwingRun;
    },
    disposeRun(run, index) {
      disposedRuns.push({ run, index });
    },
  }), /intentional throwing run configuration/);
  assert.deepEqual(disposedRuns, [{ run: throwingRun, index: 0 }],
    "a throwing run is disposed exactly once before its error escapes");
}

{
  const releaseRecord = await syntheticReleaseRecord();
  let factories = 0;
  const lifecycle = [];
  await assert.rejects(() => runSyntheticM6HeadlessBootConformanceForTest({
    createRun(index) {
      factories += 1;
      lifecycle.push(`create-${index}`);
      return {
        ...fixtures,
        client: new FakeClient(),
        maxBoundaries: 225000000n,
        maxHostTransactions: 2,
      };
    },
    disposeRun(_run, index) {
      lifecycle.push(`dispose-${index}`);
      throw new Error("intentional dispose failure");
    },
    onRunCompleted({ runIndex }) {
      lifecycle.push(`complete-${runIndex}`);
    },
  }, releaseRecord), /intentional dispose failure/);
  assert.equal(factories, 1,
    "a rejected disposer prevents the next factory and a success serialization");
  assert.deepEqual(lifecycle, ["create-0", "dispose-0"],
    "a rejected disposer emits neither completed progress nor later work");
}

{
  const releaseRecord = await syntheticReleaseRecord();
  let factories = 0;
  const lifecycle = [];
  await assert.rejects(() => runSyntheticM6HeadlessBootConformanceForTest({
    createRun(index) {
      factories += 1;
      lifecycle.push(`create-${index}`);
      return {
        ...fixtures,
        client: new FakeClient(),
        maxBoundaries: 225000000n,
        maxHostTransactions: 2,
      };
    },
    disposeRun(_run, index) {
      lifecycle.push(`dispose-${index}`);
    },
    onRunCompleted({ runIndex }) {
      lifecycle.push(`complete-${runIndex}`);
      throw new Error("intentional progress failure");
    },
  }, releaseRecord), /intentional progress failure/);
  assert.equal(factories, 1,
    "a rejected progress callback prevents the next factory and a success serialization");
  assert.deepEqual(lifecycle, ["create-0", "dispose-0", "complete-0"],
    "progress rejection follows disposal and prevents all later conformance work");
}

{
  for (const [field, value] of [
    ["disposeRun", true],
    ["onRunCompleted", true],
  ]) {
    let factories = 0;
    await assert.rejects(() => runM6HeadlessBootConformance({
      createRun() {
        factories += 1;
        return {};
      },
      [field]: value,
    }), /requires exactly three fresh run factories/);
    assert.equal(factories, 0,
      `${field} type is rejected before any run factory executes`);
  }
}

console.log("cadr_m6_headless_boot: ok");
