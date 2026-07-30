import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { PassThrough } from "node:stream";

import {
  P4_EXPECTED_CLOSURE_SCHEMA,
  matchesCanonicalJsonBytes,
  p4Bindings,
  runNativeCapture,
  validateP4Manifest,
} from "../scripts/run-cadr-m7-frame-conformance.mjs";

const runnerSource = await readFile(new URL(
  "../scripts/run-cadr-m7-frame-conformance.mjs", import.meta.url), "utf8");
assert.match(runnerSource, /cadr-m7-portable-failure-v1/);
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
const file = (path, index) => ({ path, bytes: index + 1, sha256: H(index) });
const support = (path, installedAs, index) => ({ path, installed_as: installedAs, bytes: index + 1, sha256: H(index) });

function manifest() {
  return {
    schema: "cadr-m7-frame-conformance-result-v1",
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
      session_evidence: { ready_session_id: "portable-test", worker_log_session_id: "portable-test" },
      module: file("cadr-web/build/cadr-web-m7-O0.wasm", 25),
      worker: file("cadr-web/wasm/cadr-worker.js", 26), adapter: [
        file("cadr-web/wasm/cadr_wasm_adapter.c", 27), file("cadr-web/wasm/cadr_wasm_adapter.h", 28),
      ], termination: { pending_requests: 0, terminated: true },
      framebuffer_checkpoint: { boundary: "982990214", cdrdisp1_sha256: H(29), cdrm6i1_sha256: H(30) },
      cdrdisp_file: file("portable/frame.cdrdisp1", 29), witness_file: file("portable/witness.cdrm6i1", 30),
      ready_file: file("portable/ready.json", 31), worker_log_file: file("portable/worker.ndjson", 32) },
    comparison: { file: file("comparison.json", 33), m6_witness_sample_sha256: H(30), native_capture_sha256: H(20),
      native_raw_words_sha256: H(21), portable_raw_words_sha256: H(34), portable_record_sha256: H(29) },
    summary: { manifest_kind: "hashes-only", comparison_sha256: H(33), native_frame_sha256: H(20), portable_frame_sha256: H(29) },
  };
}

const baseline = manifest();
const independentlyRecorded = manifest();
const expected = { schema: P4_EXPECTED_CLOSURE_SCHEMA, bindings: {
  source: independentlyRecorded.source,
  m6_release_record: independentlyRecorded.m6_release_record,
  patches: independentlyRecorded.patches,
  prepared: independentlyRecorded.prepared,
  artifacts: independentlyRecorded.artifacts,
  native_inputs: independentlyRecorded.native_inputs,
  schedule: independentlyRecorded.schedule,
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
  ["portable adapter", value => { value.portable.adapter[1].sha256 = H(106); }],
  ["portable checkpoint", value => { value.portable.framebuffer_checkpoint.cdrdisp1_sha256 = H(107); }],
  ["redundant portable file hash", value => { value.portable.cdrdisp_file.sha256 = H(107); }],
  ["comparison", value => { value.comparison.portable_record_sha256 = H(108); }],
  ["summary", value => { value.summary.portable_frame_sha256 = H(109); }],
];
for (const [name, mutate] of mutations) {
  const candidate = structuredClone(baseline);
  mutate(candidate);
  assert.throws(() => validateP4Manifest(candidate, expected),
    /P4 binding differs|P4 native private disk changed|P4 native termination failed|bind its session|redundant hashes/, name);
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
