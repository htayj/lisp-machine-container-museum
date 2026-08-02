import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";

import {
  CADR_M6_HARD_MAX_HOST_TRANSACTIONS,
  CADR_M6_RELEASE_RECORD_SHA256,
  probeM6ProductionHostTransactionCapForTest,
  runM6HeadlessBootWithM7EffectivePageIdentity,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_MAX_HOST_TRANSACTIONS,
} from "../cadr-web/wasm/cadr-m7-effective-page-identity.mjs";
import {
  P4_EXECUTION_BUDGET_SCHEMA,
  P4_EXPECTED_CLOSURE_SCHEMA,
  P4_MAX_HOST_TRANSACTIONS,
  P4_PORTABLE_WALL_TIME_MS,
  P4_REQUEST_TIMEOUT_MS,
  P4PortableExecutionDeadline,
  ProtocolV5Client,
  failureExecutionEvidence,
  matchesCanonicalJsonBytes,
  parseP4HostTranscript,
  p4Bindings,
  runNativeCapture,
  stageM7WorkerClosure,
  validateP4FailureReceipts,
  validateP4FailureTranscriptBinding,
  validateP4Manifest,
  writeP4PortableFailureEvidence,
} from "../scripts/run-cadr-m7-frame-conformance.mjs";

const runnerSource = await readFile(new URL(
  "../scripts/run-cadr-m7-frame-conformance.mjs", import.meta.url), "utf8");
assert.match(runnerSource, /cadr-m7-portable-failure-v4/);
assert.equal(P4_MAX_HOST_TRANSACTIONS, 2048);
assert.equal(CADR_M6_HARD_MAX_HOST_TRANSACTIONS, 1024,
  "ordinary M6 retains its frozen cap");
assert.equal(CADR_M7_EFFECTIVE_PAGE_IDENTITY_MAX_HOST_TRANSACTIONS, 2048,
  "only the selected P4 identity wrapper receives the larger cap");
await assert.rejects(
  runM6HeadlessBootWithM7EffectivePageIdentity({ maxHostTransactions: 1024 }),
  /P4 host-transaction cap is fixed/);
const ordinaryCap = probeM6ProductionHostTransactionCapForTest({});
assert.equal(ordinaryCap.completed_host_transactions, 1024);
assert.equal(ordinaryCap.transcript_record_count, 2048);
assert.equal(ordinaryCap.last_completed_request_id, 1024);
assert.equal(ordinaryCap.outstanding_request_id, 1025);
assert.equal(ordinaryCap.host_complete_request_ids.includes(1025), false,
  "ordinary request 1025 is never admitted to host-complete");
const p4Cap = probeM6ProductionHostTransactionCapForTest({ selectedM7: true });
assert.equal(p4Cap.completed_host_transactions, 2048);
assert.equal(p4Cap.transcript_record_count, 4096);
assert.equal(p4Cap.last_completed_request_id, 2048);
assert.equal(p4Cap.outstanding_request_id, 2049);
assert.equal(p4Cap.host_complete_request_ids.includes(2049), false,
  "P4 request 2049 is never admitted to host-complete");
assert.throws(() => probeM6ProductionHostTransactionCapForTest({
  selectedM7: true, requestedMaxHostTransactions: 1024,
}), /P4 host-transaction cap is fixed/);
assert.throws(() => probeM6ProductionHostTransactionCapForTest({
  selectedM7: true, requestedMaxHostTransactions: 2049,
}), /P4 host-transaction cap is fixed/);
await assert.rejects(
  runM6HeadlessBootWithM7EffectivePageIdentity({ maxHostTransactions: 2049 }),
  /P4 host-transaction cap is fixed/);
assert.equal(P4_PORTABLE_WALL_TIME_MS, 10_800_000);
assert.equal(P4_REQUEST_TIMEOUT_MS, 120_000);
assert.equal(runnerSource.includes(
  'resolve(portableDirectory, "worker.ndjson")'), true);
assert.equal(runnerSource.includes(
  'await unlink(resolve(session.path, "manifest.json"))'), true);

const canonicalFixture = new TextEncoder().encode('{"a":1}\n');
assert.equal(matchesCanonicalJsonBytes(canonicalFixture, { a: 1 }, true), true);
assert.equal(matchesCanonicalJsonBytes(canonicalFixture, { a: 1 }), false,
  "the parent-marker LF is accepted only when explicitly selected");
assert.equal(matchesCanonicalJsonBytes(
  new TextEncoder().encode('{"a":1}\\n'), { a: 1 }, true), false);
assert.equal(matchesCanonicalJsonBytes(
  new TextEncoder().encode('{ "a": 1 }\n'), { a: 1 }, true), false,
  "arbitrary JSON whitespace is not accepted as canonical");

const H = index => index.toString(16).padStart(64, "0");
const executionBudget = () => ({
  schema: P4_EXECUTION_BUDGET_SCHEMA,
  max_host_transactions: 2048,
  portable_wall_time_ms: 10_800_000,
  request_timeout_ms: 120_000,
  disk_byte_count: "269562880",
  block_bytes: 1024,
  disk_block_count: "263245",
  extension_policy: "none",
  resume_policy: "fresh-session-only",
});
const executionAccounting = (hostTranscriptSha256 = H(36), overrides = {}) => ({
  completed_host_transactions: "2",
  transcript_record_count: "4",
  host_transcript_sha256: hostTranscriptSha256,
  elapsed_monotonic_ms: "1",
  final_boundary: "982990278",
  last_completed_request_id: "2",
  outstanding_request_id: "0",
  limit_hit: null,
  ...overrides,
});
const failureHostTranscript = artifactSetSha256 => {
  const bytes = new Uint8Array(64 + 2 * 256);
  bytes.set(new TextEncoder().encode("CDRM6HS1"));
  bytes.set(Buffer.from(artifactSetSha256, "hex"), 24);
  const header = new DataView(bytes.buffer);
  header.setUint32(8, 1, true);
  header.setUint32(12, 64, true);
  header.setUint32(16, 256, true);
  header.setUint32(20, 2, true);
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    const offset = 64 + ordinal * 256;
    const view = new DataView(bytes.buffer, offset, 256);
    view.setBigUint64(0, BigInt(ordinal), true);
    view.setUint32(8, ordinal === 0 ? 1 : 2, true);
    view.setUint32(12, 1, true);
    view.setBigUint64(16, 10n, true);
    view.setBigUint64(24, 10n, true);
    view.setBigUint64(32, 1n, true);
    view.setBigUint64(40, 1n, true);
    view.setUint32(48, 0, true);
    view.setUint32(52, 1, true);
    view.setBigUint64(56, 16n, true);
    view.setBigUint64(64, 0n, true);
    view.setBigUint64(72, 1024n, true);
    view.setBigUint64(80, 7n, true);
    view.setUint32(88, 1024, true);
    view.setBigUint64(96, 0n, true);
    bytes.set(Buffer.from(H(141), "hex"), offset + 104);
    bytes.set(Buffer.from(H(142), "hex"), offset + 136);
    bytes.set(Buffer.from(H(143), "hex"), offset + 168);
  }
  return bytes;
};
const file = (path, index) => ({ path, bytes: index + 1, sha256: H(index) });
const support = (path, installedAs, index) => ({ path, installed_as: installedAs, bytes: index + 1, sha256: H(index) });
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const m7NativeRecord = () => {
  const activeWords = 23112;
  const bytes = new Uint8Array(64 + activeWords * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM7N1"));
  view.setUint32(8, 1, true);
  view.setUint32(12, 64, true);
  view.setBigUint64(16, 982990214n, true);
  view.setUint32(24, 768, true);
  view.setUint32(28, 963, true);
  view.setUint32(32, 4, true);
  view.setUint32(36, 1, true);
  view.setUint32(40, 32768, true);
  view.setUint32(44, activeWords, true);
  view.setUint32(48, activeWords * 4, true);
  return bytes;
};
const m7PortableCheckpoint = releaseSha256 => {
  const activeWords = 23112;
  const display = new Uint8Array(96 + activeWords * 4);
  const view = new DataView(display.buffer);
  display.set(new TextEncoder().encode("CDRDISP1"));
  view.setUint16(8, 1, true);
  view.setUint16(10, 80, true);
  view.setUint32(12, 1, true);
  view.setBigUint64(16, 1n, true);
  view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true);
  view.setUint32(36, 963, true);
  view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true);
  view.setUint32(48, activeWords, true);
  view.setUint32(52, 4, true);
  view.setUint32(56, 1, true);
  view.setUint32(60, activeWords, true);
  view.setBigUint64(64, BigInt(activeWords * 4), true);
  view.setBigUint64(72, BigInt(display.byteLength), true);
  view.setUint32(88, 768, true);
  view.setUint32(92, 963, true);
  const witness = new Uint8Array(96);
  witness.set(new TextEncoder().encode("CDRM6I1"));
  const witnessView = new DataView(witness.buffer);
  witnessView.setBigUint64(8, 0x4c4549444d36n, true);
  witnessView.setUint32(68, 0x18000, true);
  witnessView.setUint32(72, 3, true);
  witnessView.setUint32(84, 1, true);
  return {
    boundary: 982990214n,
    display_record: display,
    witness_sample: witness,
    m6_release_record_sha256: Buffer.from(releaseSha256, "hex"),
  };
};
const workerClosure = (entry, files) => {
  const builtins = ["node:worker_threads"];
  const node = {
    version: process.version,
    executable_bytes: 123,
    executable_sha256: H(119),
  };
  return {
    schema: "cadr-m7-worker-source-closure-v1",
    entry,
    files,
    builtins,
    node,
    tree_sha256: createHash("sha256").update(canonical({
      builtins, files, node,
    })).digest("hex"),
  };
};

{
  const root = await mkdtemp(resolve(tmpdir(), "cadr-m7-worker-stage-test-"));
  const source = resolve(root, "source");
  const stage = resolve(root, "stage");
  await mkdir(source, { mode: 0o700 });
  try {
    await writeFile(resolve(source, "entry.mjs"),
      'import { value } from "./dependency.mjs"; export { value };\n',
      { mode: 0o600 });
    await writeFile(resolve(source, "dependency.mjs"),
      "export const value = 7;\n", { mode: 0o600 });
    const staged = await stageM7WorkerClosure({
      sourceRoot: source, entryName: "entry.mjs", stageDirectory: stage,
    });
    assert.equal(staged.closure.files.length, 2);
    await writeFile(resolve(source, "dependency.mjs"),
      "export const value = 8;\n");
    assert.equal(await readFile(
      resolve(stage, "dependency.mjs"), "utf8"),
    "export const value = 7;\n",
    "source mutation after staging cannot alter executed worker bytes");
    assert.equal(staged.entryUrl.href.startsWith("file:"), true);
  } finally {
    await chmod(stage, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

async function joinedDeadlineMutation(label) {
  let expire;
  let finish;
  let mutations = 0;
  const deadline = new P4PortableExecutionDeadline({
    setTimeoutFn: callback => { expire = callback; return 1; },
    clearTimeoutFn: () => {}, wallTimeMs: 50,
  });
  const operation = new Promise(resolveOperation => { finish = () => {
    mutations += 1; resolveOperation(label);
  }; });
  const joined = deadline.join(operation);
  expire();
  await Promise.resolve();
  assert.equal(mutations, 0, `${label} remains joined after deadline`);
  finish();
  await assert.rejects(joined, error =>
    error?.p4TerminalCause === "portable-wall-time");
  const atReceipt = mutations;
  await Promise.resolve();
  assert.equal(mutations, atReceipt,
    `${label} cannot mutate after failure receipt eligibility`);
  deadline.close();
}

await joinedDeadlineMutation("staging");
await joinedDeadlineMutation("private write");

{
  let expire; let rejectChild; let finishLate; let lateMutations = 0;
  const deadline = new P4PortableExecutionDeadline({
    setTimeoutFn: callback => { expire = callback; return 1; },
    clearTimeoutFn: () => {}, wallTimeMs: 50,
  });
  const rejected = new Promise((_, reject) => { rejectChild = reject; });
  const late = new Promise(resolveLate => { finishLate = () => {
    lateMutations += 1; resolveLate();
  }; });
  let receiptEligible = false;
  const setup = deadline.join(Promise.allSettled([rejected, late]))
    .finally(() => { receiptEligible = true; });
  expire();
  rejectChild(new Error("concurrent setup rejection"));
  await Promise.resolve();
  assert.equal(receiptEligible, false,
    "deadline plus one rejected child still joins every setup child");
  finishLate();
  await assert.rejects(setup, error =>
    error?.p4TerminalCause === "portable-wall-time");
  assert.equal(lateMutations, 1);
  assert.equal(receiptEligible, true,
    "receipt eligibility begins only after all setup children settle");
  deadline.close();
}

{
  let expire; let finishTerminate;
  class SlowCloseWorker extends EventEmitter {
    constructor() { super(); this.calls = 0; }
    postMessage() {}
    terminate() {
      this.calls += 1;
      return new Promise(resolveTerminate => { finishTerminate = resolveTerminate; });
    }
  }
  const deadline = new P4PortableExecutionDeadline({
    setTimeoutFn: callback => { expire = callback; return 1; },
    clearTimeoutFn: () => {}, wallTimeMs: 50,
  });
  const worker = new SlowCloseWorker();
  const client = new ProtocolV5Client(worker, "slow-close", deadline);
  deadline.attachTerminator(() => { void client.terminateFailure().catch(() => {}); });
  const closing = deadline.join(client.close());
  expire();
  finishTerminate(0);
  await assert.rejects(closing, error =>
    error?.p4TerminalCause === "portable-wall-time");
  await client.terminateFailure();
  assert.equal(worker.calls, 1,
    "deadline arbitration shares the in-flight successful close termination");
  deadline.close();
}

{
  const root = await mkdtemp(resolve(tmpdir(), "cadr-m7-worker-reject-test-"));
  const source = resolve(root, "source");
  await mkdir(source, { mode: 0o700 });
  try {
    await writeFile(resolve(source, "entry.mjs"),
      'await import("./dependency.mjs");\n', { mode: 0o600 });
    await assert.rejects(stageM7WorkerClosure({
      sourceRoot: source, entryName: "entry.mjs",
      stageDirectory: resolve(root, "stage"),
    }), /unsupported dynamic import/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

{
  const cases = [
    {
      name: "commented dynamic builtin bypass",
      source: 'await import/* policy bypass */("node:fs");\n',
      pattern: /unsupported dynamic import/,
    },
    {
      name: "line-commented dynamic builtin bypass",
      source: 'await import// policy bypass\n("node:fs");\n',
      pattern: /unsupported dynamic import/,
    },
    {
      name: "commented static builtin bypass",
      source: 'import fs from/* policy bypass */"node:fs";\n',
      pattern: /nonlocal or unsupported module/,
    },
    {
      name: "nonliteral dynamic import",
      source: 'const name = "node:worker_threads"; await import(name);\n',
      pattern: /nonliteral dynamic import/,
    },
  ];
  for (const testCase of cases) {
    const root = await mkdtemp(resolve(
      tmpdir(), "cadr-m7-worker-token-reject-test-"));
    const source = resolve(root, "source");
    await mkdir(source, { mode: 0o700 });
    try {
      await writeFile(resolve(source, "entry.mjs"), testCase.source,
        { mode: 0o600 });
      await assert.rejects(stageM7WorkerClosure({
        sourceRoot: source, entryName: "entry.mjs",
        stageDirectory: resolve(root, "stage"),
      }), testCase.pattern, testCase.name);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
}

{
  const root = await mkdtemp(resolve(
    tmpdir(), "cadr-m7-worker-token-fake-test-"));
  const source = resolve(root, "source");
  const stage = resolve(root, "stage");
  await mkdir(source, { mode: 0o700 });
  try {
    await writeFile(resolve(source, "entry.mjs"),
      'const text = "import(\\\\"node:fs\\\\")"; ' +
      '/* import("node:fs") */ export const value = text;\n',
      { mode: 0o600 });
    const staged = await stageM7WorkerClosure({
      sourceRoot: source, entryName: "entry.mjs", stageDirectory: stage,
    });
    assert.deepEqual(staged.closure.builtins, []);
    assert.equal(staged.closure.files.length, 1);
  } finally {
    await chmod(stage, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

{
  const root = await mkdtemp(resolve(tmpdir(), "cadr-m7-real-worker-test-"));
  const stage = resolve(root, "stage");
  try {
    const staged = await stageM7WorkerClosure({ stageDirectory: stage });
    assert.deepEqual(staged.closure.builtins, ["node:worker_threads"]);
    assert.equal(staged.closure.files.some(
      file => file.path.endsWith("/cadr-worker.js")), true);
  } finally {
    await chmod(resolve(stage, "browser"), 0o700).catch(() => {});
    await chmod(resolve(stage, "wasm"), 0o700).catch(() => {});
    await chmod(stage, 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

{
  class TerminationWorker extends EventEmitter {
    constructor() { super(); this.calls = 0; }
    postMessage() {}
    async terminate() {
      this.calls += 1;
      if (this.calls === 1) throw new Error("injected terminate rejection");
      return 9;
    }
  }
  const worker = new TerminationWorker();
  const client = new ProtocolV5Client(worker, "termination-test");
  await assert.rejects(client.close(), /injected terminate rejection/);
  await assert.rejects(client.terminateFailure(),
    /injected terminate rejection/);
  assert.equal(worker.calls, 1,
    "all terminal paths share exactly one worker termination attempt");
}

{
  let now = 1000;
  let expire = null;
  let cleared = null;
  let terminationCalls = 0;
  const deadline = new P4PortableExecutionDeadline({
    now: () => now,
    setTimeoutFn: (callback, delay) => {
      assert.equal(delay, 50);
      expire = callback;
      return 77;
    },
    clearTimeoutFn: token => { cleared = token; },
    wallTimeMs: 50,
  });
  deadline.attachTerminator(() => { terminationCalls += 1; });
  assert.equal(deadline.requestTimeoutMs(), 50,
    "a request is bounded by the smaller remaining portable deadline");
  const pending = deadline.race(new Promise(() => {}));
  now = 1050;
  expire();
  expire();
  await assert.rejects(pending, error =>
    error?.name === "P4PortableDeadlineError");
  assert.equal(terminationCalls, 1, "the first terminal deadline wins");
  assert.equal(deadline.elapsedMs(), 50);
  deadline.close();
  assert.equal(cleared, 77, "deadline cleanup clears the active timer");
}

{
  const artifactSetSha256 = H(140);
  const transcript = failureHostTranscript(artifactSetSha256);
  const transcriptSha256 = createHash("sha256").update(transcript).digest("hex");
  const parsed = parseP4HostTranscript(transcript, artifactSetSha256);
  const diagnostic = {
    failure: {
      preflight: { artifactSetSha256 },
      report: {
        phase: "host-service", reason: "synthetic", boundary: "10",
        transcriptCount: 2, hostTranscriptSha256: transcriptSha256,
        machineInfo: { lastCompletedRequestId: "1", outstandingRequestId: "2" },
      },
      transcriptTail: parsed.records,
    },
  };
  const diagnosticBytes = new TextEncoder().encode(canonical(diagnostic));
  const portable = {
    m6_failure_file: {
      path: "m6-failure.json", bytes: diagnosticBytes.byteLength,
      sha256: createHash("sha256").update(diagnosticBytes).digest("hex"),
    },
    host_transcript_file: {
      path: "failure-host-transcript.cdrm6hs1", bytes: transcript.byteLength,
      sha256: transcriptSha256,
    },
    execution_accounting: executionAccounting(transcriptSha256, {
      completed_host_transactions: "1", transcript_record_count: "2",
      final_boundary: "10", last_completed_request_id: "1",
      outstanding_request_id: "2",
    }),
  };
  assert.deepEqual(validateP4FailureTranscriptBinding(
    portable, diagnosticBytes, transcript), diagnostic);
  const corrupt = transcript.slice();
  corrupt[255] = 1;
  assert.throws(() => validateP4FailureTranscriptBinding(
    portable, diagnosticBytes, corrupt), /identity differs|record 0 is invalid/);
  const wrongAccounting = structuredClone(portable);
  wrongAccounting.execution_accounting.transcript_record_count = "4";
  assert.throws(() => validateP4FailureTranscriptBinding(
    wrongAccounting, diagnosticBytes, transcript), /accounting/);
  const wrappedM6Failure = new Error("deadline wrapped by M6 failure");
  wrappedM6Failure.name = "CadrM7UnderlyingM6Failure";
  wrappedM6Failure.m6FailureDiagnostic = diagnosticBytes;
  wrappedM6Failure.m6FailureHostTranscript = transcript;
  const deadlineEvidence = failureExecutionEvidence(
    wrappedM6Failure, 50, "portable-wall-time");
  assert.equal(deadlineEvidence.accounting.limit_hit, "portable-wall-time",
    "explicit deadline terminal state survives M6 failure wrapping");
}

function manifest() {
  return {
    schema: "cadr-m7-frame-conformance-result-v3",
    target: "CADR-WEB-303/ABI1.5/protocol-v5/M7",
    outcome: "identical",
    runtime_execution_performed: true,
    session: { id: "m7-p4-test", mode: "0700" },
    source: { system_fossil: H(1), usim_fossil: H(2) },
    m6_release_record: { path: "cadr-web/oracle/cadr-m6-release-record.json", bytes: 3, sha256: H(3) },
    patches: { m6_sha256: H(4), m7_sha256: H(5), m7_support: [
      support("cadr-web/oracle/native/cadr_m7_frame_witness.c", "cadr_m7_frame_witness.c", 6),
      support("cadr-web/oracle/native/cadr_m7_frame_witness.h", "cadr_m7_frame_witness.h", 7),
    ] },
    prepared: { path: "build/cadr-oracle/m7-frame-prepared", source_tree_sha256: H(8), source_file_count: 9,
      executable: { path: "build/cadr-oracle/m7-frame-prepared/source/usim/usim", bytes: 10, sha256: H(10),
        forbidden_undefined_symbol_count: 0, m6_patch_sha256: H(4), m7_patch_sha256: H(5),
        prepared_source_tree_sha256: H(8), prepared_source_file_count: 9 } },
    artifacts: [1, 2, 4, 5, 3].map((kind, index) => ({ kind, byte_count: String(index + 11), sha256: H(index + 11) })),
    native_inputs: [{ id: "usite-extra-hosts", byte_count: "16", sha256: H(16) }],
    schedule: { event_count: 17, mapping_sha256: H(17), sha256: H(18) },
    execution_budget: executionBudget(),
    execution_accounting: executionAccounting(),
    native: { session_id: "native-test", private_disk_instance_id: "disk-test",
      private_disk: { sha256_at_start: H(19), sha256_at_end: H(19) },
      process: { returncode: 0, timed_out: false, forced_stop: false, state_may_be_incomplete: false, pending_host_requests: 0 },
      oracle_process: { returncode: 0, signal: null },
      capture: { schema: "CDRM7N1", sha256: H(20), byte_count: "92512", boundary: "982990214", width: 768, height: 963,
        stride_words: 24, backing_words: 32768, active_words: 23112, tv_mode: 4, black_on_white: true, raw_words_sha256: H(21) },
      frame_file: file("build/cadr-oracle/m7-p4-test/native/frame.cdrm7n1", 20),
      transcript_file: file("build/cadr-oracle/m7-p4-test/native/capture.ndjson", 22),
      idle_file: file("build/cadr-oracle/m7-p4-test/native/idle.bin", 23),
      metadata_file: file("build/cadr-oracle/m7-p4-test/native/metadata.json", 24) },
    portable: { session_id: "portable-test",
      execution_budget: executionBudget(),
      execution_accounting: executionAccounting(),
      session_evidence: { ready_session_id: "portable-test", worker_log_session_id: "portable-test" },
      module: file("cadr-web/build/cadr-web-m7-O0.wasm", 25),
      worker: file("cadr-web/wasm/cadr-worker.js", 26),
      worker_closure: workerClosure(
        file("cadr-web/wasm/cadr-worker.js", 26), [
          file("cadr-web/wasm/cadr-worker.js", 26),
        ]), contemporaneous_adapter_observation: [
        file("cadr-web/wasm/cadr_wasm_adapter.c", 27), file("cadr-web/wasm/cadr_wasm_adapter.h", 28),
      ], termination: { pending_requests: 0, terminated: true },
      effective_page_identity: {
        schema: "cadr-m7-effective-page-identity-stream-v1",
        profile: "CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v2",
        disposition: "IDENTITY_ACK_STREAM", count: 2,
        collection_sha256: H(35), host_transcript_sha256: H(36),
        first: { generation: "1", request_id: "135", transaction_id: "135",
          first_block: "1299", boundary: "1366722" } },
      framebuffer_checkpoint: { boundary: "982990214", cdrdisp1_sha256: H(29), cdrm6i1_sha256: H(30) },
      cdrdisp_file: file("portable/frame.cdrdisp1", 29), witness_file: file("portable/witness.cdrm6i1", 30),
      ready_file: file("portable/ready.json", 31), worker_log_file: file("portable/worker.ndjson", 32),
      effective_page_identity_file: file("portable/effective-page-identity.json", 35),
      host_transcript_file: file("portable/host-transcript.cdrm6hs1", 36) },
    comparison: { file: file("comparison.json", 33), m6_witness_sample_sha256: H(30), native_capture_sha256: H(20),
      native_raw_words_sha256: H(21), portable_raw_words_sha256: H(34), portable_record_sha256: H(29) },
    summary: { manifest_kind: "hashes-only", comparison_sha256: H(33), native_frame_sha256: H(20), portable_frame_sha256: H(29) },
  };
}

const baseline = manifest();
const portableFailure = {
  schema: "cadr-m7-portable-failure-v4",
  target: "CADR-WEB-303/ABI1.5/protocol-v5/M7",
  session_id: "portable-failure-test",
  error_name: "CadrM7UnderlyingM6Failure",
  error_message: "bounded M6 failure",
  module: file("cadr-web/build/cadr-web-m7-O2.wasm", 120),
  worker: file("cadr-web/wasm/cadr-worker.js", 121),
  worker_closure: workerClosure(
    file("cadr-web/wasm/cadr-worker.js", 121), [
      file("cadr-web/wasm/cadr-worker.js", 121),
    ]),
  contemporaneous_adapter_observation: [
    file("cadr-web/wasm/cadr_wasm_adapter.c", 122),
    file("cadr-web/wasm/cadr_wasm_adapter.h", 123),
  ],
  m6_release_record: structuredClone(baseline.m6_release_record),
  m6_failure_file: file("m6-failure.json", 125),
  host_transcript_file: file("failure-host-transcript.cdrm6hs1", 36),
  execution_budget: executionBudget(),
  execution_accounting: executionAccounting(),
  checkpoint: null,
  checkpoint_comparison_file: null,
  worker_log_file: file("worker.ndjson", 126),
  termination: {
    pending_requests_at_failure: 0,
    terminated: true,
    worker_exit_code: 1,
  },
  worker_disposition: "worker-terminated",
};
const rootFailure = {
  schema: "cadr-m7-frame-conformance-failure-v3",
  target: "CADR-WEB-303/ABI1.5/protocol-v5/M7",
  outcome: "failed",
  runtime_execution_performed: true,
  session: { id: "m7-p4-failure-test", mode: "0700" },
  source: baseline.source,
  m6_release_record: baseline.m6_release_record,
  patches: baseline.patches,
  prepared: baseline.prepared,
  artifacts: baseline.artifacts,
  native_inputs: baseline.native_inputs,
  schedule: baseline.schedule,
  execution_budget: executionBudget(),
  execution_accounting: executionAccounting(),
  native: baseline.native,
  portable_failure_file: file("portable/failure.json", 127),
  error_name: portableFailure.error_name,
  error_message: portableFailure.error_message,
};
const expectedFailure = {
  root: structuredClone(rootFailure),
  portable: structuredClone(portableFailure),
};

for (const retainedCheckpoint of [false, true]) {
  const root = await mkdtemp(resolve(
    tmpdir(), `cadr-m7-failure-writer-${retainedCheckpoint ? "post" : "pre"}-`));
  const portableDirectory = resolve(root, "portable");
  await mkdir(portableDirectory, { mode: 0o700 });
  const caught = new Error(retainedCheckpoint ?
    "post-Form-C retained checkpoint failure" :
    "terminal-machine-status; phase=run; status=12; boundary=1125883");
  caught.name = "SyntheticPortableFailure";
  const writerRelease = {
    ...portableFailure.m6_release_record,
    sha256: Buffer.from(CADR_M6_RELEASE_RECORD_SHA256).toString("hex"),
  };
  caught.checkpoint = retainedCheckpoint ?
    m7PortableCheckpoint(writerRelease.sha256) : null;
  try {
    const written = await writeP4PortableFailureEvidence({
      portableDirectory,
      caught,
      nativeFrame: m7NativeRecord(),
      sessionId: retainedCheckpoint ?
        "post-form-c-failure-writer" : "status12-failure-writer",
      module: portableFailure.module,
      worker: portableFailure.worker,
      workerClosure: portableFailure.worker_closure,
      contemporaneousAdapterObservation:
        portableFailure.contemporaneous_adapter_observation,
      m6ReleaseRecord: writerRelease,
      executionBudget: executionBudget(),
      executionAccounting: executionAccounting(H(0), {
        completed_host_transactions: "0",
        transcript_record_count: "0",
        final_boundary: "0",
        last_completed_request_id: "0",
      }),
      failureHostTranscript: null,
      retainFailureHostTranscript: false,
      termination: portableFailure.termination,
      workerLogBytes: new TextEncoder().encode(
        '{"schema":"cadr-m7-portable-session-v1"}\n'),
    });
    const writtenBytes = await readFile(resolve(portableDirectory, "failure.json"));
    assert.equal(new TextDecoder().decode(writtenBytes),
      canonical(JSON.parse(new TextDecoder().decode(writtenBytes))),
      "the actual failure writer emits canonical receipt bytes");
    assert.equal(written.failure.checkpoint !== null, retainedCheckpoint);
    assert.equal(written.failure.checkpoint_comparison_file !== null,
      retainedCheckpoint);
    if (retainedCheckpoint) {
      assert.equal(written.failure.checkpoint.m6_release_record_sha256,
        writerRelease.sha256);
    }
    const writtenRoot = {
      ...structuredClone(rootFailure),
      error_name: caught.name,
      error_message: caught.message,
      m6_release_record: writerRelease,
      portable_failure_file: written.failureFile,
      execution_budget: executionBudget(),
      execution_accounting: executionAccounting(H(0), {
        completed_host_transactions: "0",
        transcript_record_count: "0",
        final_boundary: "0",
        last_completed_request_id: "0",
      }),
    };
    assert.equal(validateP4FailureReceipts(
      writtenRoot, written.failure, {
        root: structuredClone(writtenRoot),
        portable: structuredClone(written.failure),
      }), writtenRoot);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

assert.equal(validateP4FailureReceipts(
  rootFailure, portableFailure, expectedFailure), rootFailure);
{
  const partial = structuredClone(portableFailure);
  Object.assign(partial, {
    error_name: "P4PortableDeadlineError", error_message: "setup expired",
    module: null, worker: null, worker_closure: null,
    contemporaneous_adapter_observation: null,
    m6_failure_file: null, host_transcript_file: null,
    checkpoint: null, checkpoint_comparison_file: null,
    termination: null, worker_disposition: "worker-not-started",
  });
  const partialRoot = structuredClone(rootFailure);
  partialRoot.error_name = partial.error_name;
  partialRoot.error_message = partial.error_message;
  assert.equal(validateP4FailureReceipts(partialRoot, partial, {
    root: structuredClone(partialRoot), portable: structuredClone(partial),
  }), partialRoot);
  const forged = structuredClone(partial);
  forged.termination = { pending_requests_at_failure: 0,
    terminated: true, worker_exit_code: null };
  assert.throws(() => validateP4FailureReceipts(partialRoot, forged, {
    root: structuredClone(partialRoot), portable: structuredClone(forged),
  }), /forged worker disposition/);
}
{
  const corrupt = structuredClone(portableFailure);
  corrupt.unreviewed = true;
  assert.throws(() => validateP4FailureReceipts(
    rootFailure, corrupt, expectedFailure), /missing or unknown fields/);
}
{
  const corrupt = structuredClone(portableFailure);
  corrupt.termination.terminated = false;
  assert.throws(() => validateP4FailureReceipts(
    rootFailure, corrupt, expectedFailure), /did not terminate/);
}
{
  const retained = structuredClone(portableFailure);
  retained.checkpoint = {
    boundary: "982990214",
    m6_release_record_sha256: retained.m6_release_record.sha256,
    frame_file: file("failure-frame.cdrdisp1", 128),
    witness_file: file("failure-witness.cdrm6i1", 129),
  };
  retained.checkpoint_comparison_file =
    file("failure-comparison.json", 132);
  const retainedExpected = {
    root: structuredClone(rootFailure),
    portable: structuredClone(retained),
  };
  assert.equal(validateP4FailureReceipts(
    rootFailure, retained, retainedExpected), rootFailure);
  const corrupt = structuredClone(retained);
  corrupt.checkpoint.m6_release_record_sha256 = H(130);
  assert.throws(() => validateP4FailureReceipts(
    rootFailure, corrupt, {
      root: structuredClone(rootFailure), portable: structuredClone(corrupt),
    }), /wrong release identity/);
}
{
  const corrupt = structuredClone(portableFailure);
  corrupt.contemporaneous_adapter_observation.pop();
  assert.throws(() => validateP4FailureReceipts(
    rootFailure, corrupt, {
      root: structuredClone(rootFailure), portable: structuredClone(corrupt),
    }), /adapter observation is incomplete/);
}
{
  const corruptRoot = structuredClone(rootFailure);
  corruptRoot.native.frame_file.sha256 = H(131);
  assert.throws(() => validateP4FailureReceipts(
    corruptRoot, portableFailure, {
      root: structuredClone(corruptRoot),
      portable: structuredClone(portableFailure),
    }), /frame identity differs/);
}
const independentlyRecorded = manifest();
const expected = { schema: P4_EXPECTED_CLOSURE_SCHEMA, bindings: {
  source: independentlyRecorded.source,
  m6_release_record: independentlyRecorded.m6_release_record,
  patches: independentlyRecorded.patches,
  prepared: independentlyRecorded.prepared,
  artifacts: independentlyRecorded.artifacts,
  native_inputs: independentlyRecorded.native_inputs,
  schedule: independentlyRecorded.schedule,
  execution_budget: independentlyRecorded.execution_budget,
  execution_accounting: independentlyRecorded.execution_accounting,
  native: independentlyRecorded.native,
  portable: independentlyRecorded.portable,
  comparison: independentlyRecorded.comparison,
  summary: independentlyRecorded.summary,
} };
assert.equal(validateP4Manifest(baseline, expected), baseline);
assert.deepEqual(p4Bindings(baseline), p4Bindings(structuredClone(baseline)));
assert.throws(() => validateP4Manifest(baseline, baseline), /expected closure/);
assert.throws(() => validateP4Manifest(baseline), /expected closure/);

/* Each independently bound P4 identity must reject a substitution, even when
 * the replacement remains syntactically a valid SHA-256 or artifact object. */
const mutations = [
  ["source system", value => { value.source.system_fossil = H(90); }],
  ["source usim", value => { value.source.usim_fossil = H(91); }],
  ["release", value => { value.m6_release_record.sha256 = H(92); }],
  ["m6 patch", value => { value.patches.m6_sha256 = H(93); }],
  ["m7 patch", value => { value.patches.m7_sha256 = H(94); }],
  ["support", value => { value.patches.m7_support[0].sha256 = H(95); }],
  ["prepared tree", value => { value.prepared.source_tree_sha256 = H(96); }],
  ["prepared executable", value => { value.prepared.executable.sha256 = H(97); }],
  ["artifact", value => { value.artifacts[2].sha256 = H(98); }],
  ["native hosts", value => { value.native_inputs[0].sha256 = H(99); }],
  ["schedule", value => { value.schedule.sha256 = H(100); }],
  ["native session", value => { value.native.session_id = "native-swapped"; }],
  ["native disk instance", value => { value.native.private_disk_instance_id = "disk-swapped"; }],
  ["native disk", value => { value.native.private_disk.sha256_at_end = H(101); }],
  ["native termination", value => { value.native.process.pending_host_requests = 1; }],
  ["native words", value => { value.native.capture.raw_words_sha256 = H(102); }],
  ["native frame file", value => { value.native.frame_file.sha256 = H(103); }],
  ["portable session", value => { value.portable.session_id = "portable-swapped"; }],
  ["portable ready session", value => { value.portable.session_evidence.ready_session_id = "portable-swapped"; }],
  ["portable module", value => { value.portable.module.sha256 = H(104); }],
  ["portable worker", value => { value.portable.worker.sha256 = H(105); }],
  ["portable worker closure", value => {
    value.portable.worker_closure.files[0].sha256 = H(106);
  }],
  ["portable adapter observation", value => {
    value.portable.contemporaneous_adapter_observation[1].sha256 = H(106);
  }],
  ["effective-page acknowledgement", value => {
    value.portable.effective_page_identity.collection_sha256 = H(106);
    value.portable.effective_page_identity_file.sha256 = H(106);
  }],
  ["portable checkpoint", value => { value.portable.framebuffer_checkpoint.cdrdisp1_sha256 = H(107); }],
  ["redundant portable file hash", value => { value.portable.cdrdisp_file.sha256 = H(107); }],
  ["comparison", value => { value.comparison.portable_record_sha256 = H(108); }],
  ["summary", value => { value.summary.portable_frame_sha256 = H(109); }],
];
for (const [name, mutate] of mutations) {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  assert.throws(() => validateP4Manifest(candidate, expected),
    /P4 binding differs|P4 native private disk changed|P4 native termination failed|bind its session|redundant hashes|worker differs|worker tree/, name);
}

assert.throws(() => validateP4Manifest({ ...baseline, runtime_execution_performed: false }, expected), /wrong status/);
assert.throws(() => validateP4Manifest({ ...baseline, portable: { ...baseline.portable, termination: { pending_requests: 1, terminated: true } } }, expected), /did not terminate cleanly/);

const fakeSpawn = () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  setImmediate(() => {
    child.emit("exit", 0, null);
    child.stdout.end('{"metadata":{},"operation":"native-capture","status":"captured"}\n');
    child.stderr.end();
    setImmediate(() => child.emit("close", 0, null));
  });
  return child;
};
const drained = await runNativeCapture({
  prepared: "p", nativeConfig: "c", output: "o", sessionId: "s", diskId: "d",
}, fakeSpawn);
assert.deepEqual(drained.oracle_process, { returncode: 0, signal: null });
assert.equal(drained.response.status, "captured");

console.log("cadr M7 P4 conformance schema tests passed");
