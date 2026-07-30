import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  assertSelectiveM7Patch, boundedM7GateStream, parseM7Invocation,
  validateM7ClosedManifest,
  validateM7DevidCanaryChildReceipt, validateM7DevidCanaryReceipt,
} from "../scripts/run-cadr-m7-devid-o2-canary.mjs";
import { validateM7DevidCanaryStageReceipt } from
  "../scripts/run-cadr-m7-devid-o2-canary-stage.mjs";
import { createM7ClosedManifest } from
  "../scripts/build-cadr-m7-devid-o2-canary-manifest.mjs";
import { Client } from
  "../scripts/run-cadr-m6-devid-o2-canary-stage.mjs";
import { systemdCommand, validateResultEnvelope } from
  "../scripts/run-cadr-m6-devid-o2-canary-systemd.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const launcher = resolve(root, "scripts/run-cadr-m7-devid-o2-canary.mjs");
assert.match(execFileSync(process.execPath, [launcher, "--help"], { encoding: "utf8" }),
  /--m7-patch PAYLOAD\.patch/);
assert.throws(() => parseM7Invocation([]), /No M7-DEVID canary is implicit/);
assert.throws(() => parseM7Invocation([
  "--execute", "--receipt-base", "a".repeat(40), "--candidate-commit", "b".repeat(40),
  "--m7-patch", "one", "--m7-patch", "two", "--artifact-root", ".", "--output", "receipt.json",
]), /duplicate/);
assert.throws(() => parseM7Invocation([
  "--execute", "--receipt-base", "a".repeat(40), "--candidate-commit", "b".repeat(40),
  "--m7-patch", "payload", "--artifact-root", ".", "--output", "receipt.json", "--stage-root", "staged",
]), /supervised/);

assert.doesNotThrow(() => assertSelectiveM7Patch([
  "cadr-web/core/cadr_display.c", "cadr-web/wasm/cadr-worker.js",
]));
assert.doesNotThrow(() => assertSelectiveM7Patch([
  "scripts/run-cadr-m7-devid-o2-canary-stage.mjs",
]), "the bootstrap candidate may add its M7 control plane only under the closed manifest");
assert.throws(() => assertSelectiveM7Patch([
  "cadr-web/browser/cadr-m13-shell.mjs",
]), /unapproved/);
assert.doesNotThrow(() => assertSelectiveM7Patch([
  "scripts/run-cadr-m7-frame-conformance.mjs",
  "scripts/build-cadr-m7-devid-o2-canary-manifest.mjs",
]));
const p4Source = await readFile(resolve(root,
  "scripts/run-cadr-m7-frame-conformance.mjs"), "utf8");
assert.match(p4Source, /cadr-web-m7-devid-\$\{options\.variant\}\.wasm/,
  "P4 defaults to the distinct M7-DEVID Wasm output");
assert.match(p4Source, /module, m6DiskEvidencePolicy: true/,
  "P4 instantiation explicitly enables the M6-DEVID policy");

/* Exercise the real protocol-v5 worker response correlation, not only receipt
 * grammar.  m7-unit builds this exact profile before invoking this test. */
const workerClient = new Client(new Worker(pathToFileURL(resolve(root,
  "cadr-web/wasm/cadr-worker.js")), { type: "module" }), 5);
try {
  const module = await WebAssembly.compile(await readFile(resolve(root,
    "cadr-web/build/cadr-web-m7-devid-O0.wasm")));
  const instantiated = await workerClient.request("instantiate", {
    module, m6DiskEvidencePolicy: true,
  });
  assert.equal(instantiated.version, 5);
  assert.equal(instantiated.status, 0);
  const display = await workerClient.request("display-full");
  assert.equal(display.version, 5);
  assert.equal(display.status, 0);
  assert.equal(display.wireSchema, "CDRDISP1");
  assert.ok(display.frame instanceof ArrayBuffer);
  const snapshot = await workerClient.request("snapshot-size");
  assert.equal(snapshot.version, 5);
  assert.equal(snapshot.status, 9);
} finally {
  await workerClient.close();
}

const patchPaths = ["cadr-web/core/cadr_display.c"];
const identity = { byte_count: 1, sha256: "a".repeat(64) };
const closedManifest = {
  schema: "cadr-m7-devid-o2-canary-action-manifest-v2",
  base_commit: "b".repeat(40), base_tree: "c".repeat(40),
  payload_patch_sha256: "d".repeat(64),
  files: [{ path: patchPaths[0], action: "modify", mode: "100644",
    preimage: identity, postimage: identity }],
  execution: {
    build: { profile: "m7-devid", optimization: "O2",
      output: "cadr-web/build/cadr-web-m7-devid-O2.wasm", wasm: identity },
    inputs: [
      ["runner", "scripts/run-cadr-m7-devid-o2-canary-stage.mjs"],
      ["worker", "cadr-web/wasm/cadr-worker.js"],
      ["headless", "cadr-web/wasm/cadr-m6-headless-boot.mjs"],
      ["builder", "cadr-web/wasm/build-wasm.sh"],
    ].map(([name, path]) => ({ name, path, identity })),
    source_closure: { file_count: 1, total_byte_count: 1, sha256: "e".repeat(64) },
  },
};
assert.equal(validateM7ClosedManifest(closedManifest, patchPaths).files.length, 1);
assert.equal(validateM7ClosedManifest(createM7ClosedManifest({
  baseCommit: closedManifest.base_commit, baseTree: closedManifest.base_tree,
  patchBytes: Buffer.from("payload"), files: closedManifest.files,
  inputs: closedManifest.execution.inputs,
  sourceClosure: { schema: "cadr-m6-stage-source-closure-v1", ...closedManifest.execution.source_closure },
  wasm: identity,
}), patchPaths).execution.build.profile, "m7-devid");
assert.throws(() => validateM7ClosedManifest({ ...closedManifest, execution: {
  ...closedManifest.execution, build: { ...closedManifest.execution.build, profile: "m7" },
}}, patchPaths), /wrong build/);
assert.throws(() => validateM7ClosedManifest({ ...closedManifest, execution: {
  ...closedManifest.execution, inputs: closedManifest.execution.inputs.slice(1),
}}, patchPaths), /four execution inputs/);

const artifacts = [
  [1, "cadr-web/profiles/cadr-web-303.ini.in"],
  [2, "l/sys/ubin/promh.mcr"],
  [4, "l/sys/ubin/promh.sym"],
  [5, "l/sys/ubin/ucadr.sym"],
  [3, "l/usim/disk-sys-303-0.img"],
].map(([kind, path]) => ({
  kind, path, byte_count: String(kind), sha256: "f".repeat(64),
}));
const stage = {
  schema: "cadr-m7-devid-o2-canary-stage-v1", completed_guest_boundary: "1130000",
  nonterminal: true, base_disk_unchanged: true,
  machine: { lifecycle: 2, clock_slots_completed: "1130000", outstanding_request_id: "0", persistentStatus: 0, profile: 1 },
  exact_loop: { batches: 1, candidate: "legacy-m5", host_transactions: 0 },
  m6_disk_evidence: { accepted_events: "513", tail_events: "1", sha256: "0".repeat(64) },
  artifacts_before: artifacts, artifacts_after: structuredClone(artifacts),
  private_artifacts_before: structuredClone(artifacts), private_artifacts_after: structuredClone(artifacts),
  frozen_input_schedule: { event_count: 3118, events_due_through_target: 0, first_due_boundary: "25000000" },
  private_disk: { base_sha256: "f".repeat(64), base_write_authority: false, fresh: true,
    instance_id: "m6-private-disk-00000000-0000-0000-0000-000000000000",
    overlay_final_generation: "1", overlay_initial_generation: "0", overlay_kind: "fresh-in-memory-m4-block-one-overlay" },
  wasm: identity,
  transport: { protocol_version: 5, run_operation: "run-digest-batch-m5" },
  display: { wire_schema: "CDRDISP1", byte_count: 1, sha256: "1".repeat(64), width: 768, height: 963 },
  snapshot: { operation: "snapshot-size", status: 9 },
};
assert.equal(validateM7DevidCanaryStageReceipt(stage), stage);
assert.throws(() => validateM7DevidCanaryStageReceipt({ ...stage,
  transport: { protocol_version: 4, run_operation: "run-until-event-m6" },
}), /P4 protocol-v5 path/);

const staged = {
  runner: identity, worker: identity, headless: identity, builder: identity,
  wasm: stage.wasm,
};
const controlPaths = [
  "scripts/run-cadr-m6-devid-o2-canary.mjs",
  "scripts/run-cadr-m6-devid-o2-canary-systemd.mjs",
  "scripts/run-cadr-m6-devid-o2-canary-stage.mjs",
  "scripts/run-cadr-m7-devid-o2-canary-stage.mjs",
  "scripts/run-cadr-m7-devid-o2-canary.mjs",
  "scripts/build-cadr-m7-devid-o2-canary-manifest.mjs",
  "scripts/run-cadr-m7-frame-conformance.mjs",
  "tests/test_cadr_m7_devid_o2_canary.mjs",
];
const gateCommands = [
  ["make", "-B", "-C", "cadr-web", "m3-wasm"],
  ["make", "-B", "-C", "cadr-web", "m4-unit"],
  ["make", "-B", "-C", "cadr-web", "m4-browser"],
  ["make", "-B", "-C", "cadr-web", "m5-unit"],
  ["make", "-B", "-C", "cadr-web", "m6-devid-wasm"],
  ["make", "-B", "-C", "cadr-web", "m7-unit"],
];
const toolchain = {
  node_version: process.version,
  node_executable: identity,
  guix_channels: "test-channel",
  gate_environment: {
    names: ["AR", "CC", "GUIX_LOCPATH", "HOME", "LANG", "LC_ALL",
      "MAKEFLAGS", "MFLAGS", "NM", "NODE_OPTIONS", "PATH", "TMPDIR", "TZ",
      "XDG_CACHE_HOME"],
    sha256: "8".repeat(64),
  },
  gate_executables: ["make", "guix", "cc", "ar", "nm", "python3"].map(name => ({
    name, path_sha256: "9".repeat(64), executable: identity,
    version: identity,
  })),
};
const finalReceipt = {
  schema: "cadr-m7-devid-o2-canary-receipt-v1",
  receipt_bound_base: "0".repeat(40), candidate_commit: "1".repeat(40),
  base_tree: "2".repeat(40), candidate_tree: "3".repeat(40),
  patch: { paths: patchPaths, sha256: "4".repeat(64) },
  policy_id: "M6-PREFIX512-TAILSHA256-v1", optimization: "O2",
  completed_guest_boundary: "1130000", outer_cleanup_required: true,
  build: { profile: "m7-devid", optimization: "O2", protocol_version: 5,
    run_operation: "run-digest-batch-m5", output: "cadr-web/build/cadr-web-m7-devid-O2.wasm", wasm: stage.wasm },
  supervision: {
    invocation_id: "5".repeat(32),
    unit: `cadr-m7-devid-o2-canary-${"5".repeat(32)}.service`,
    node_old_space_mib: 1024, wall_limit_ms: 14400000,
    stdout_limit_bytes: 65536, cpu_accounting: true,
    memory_accounting: true, tasks_accounting: true,
  },
  closed_post_patch_manifest: { path: "cadr-web/oracle/cadr-m7-devid-o2-canary-manifest.json", ...identity },
  candidate_control_plane: controlPaths.map(path => ({ path, ...identity })),
  staged_source_closure: { schema: "cadr-m6-stage-source-closure-v1",
    file_count: 1, total_byte_count: 1, sha256: "6".repeat(64) },
  frozen_stage_gates: gateCommands.map(command => ({
    command, elapsed_ns: "1", exit_code: 0, signal: null,
    spawn_error_code: null,
    stdout: { ...identity, tail: null },
    stderr: { byte_count: 0, sha256: "7".repeat(64), tail: null },
  })),
  frozen_release: { release_record: identity, profile: identity, artifacts },
  outer_launcher_at_start: identity, outer_launcher_at_end: identity,
  toolchain_at_start: toolchain, toolchain_at_end: structuredClone(toolchain),
  staged_artifacts_before: staged, staged_artifacts_after: structuredClone(staged), canary: stage,
};
assert.equal(validateM7DevidCanaryChildReceipt(finalReceipt), finalReceipt);
assert.throws(() => validateM7DevidCanaryChildReceipt({ ...finalReceipt,
  build: { ...finalReceipt.build, run_operation: "run-until-event-m6" },
}), /wrong closed profile identity/);
assert.throws(() => validateM7DevidCanaryChildReceipt({ ...finalReceipt,
  build: { ...finalReceipt.build, optimization: "O0" },
}), /wrong closed profile identity/);
const accounting = {
  RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
  MemoryMax: "3221225472", MemorySwapMax: "0",
  CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
  NoNewPrivileges: "yes", PrivateNetwork: "yes",
  RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
  ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes",
  MemoryPeak: "1", CPUUsageNSec: "1", TasksCurrent: "0",
  IOReadBytes: "0", IOWriteBytes: "0",
  IPIngressBytes: "0", IPEgressBytes: "0",
  Result: "success", ExecMainCode: "1", ExecMainStatus: "0",
};
const publishedReceipt = { ...finalReceipt, systemd_accounting: accounting,
  unit_cleanup_verified: true, outer_roots_removed: true };
assert.equal(validateM7DevidCanaryReceipt(publishedReceipt), publishedReceipt);
assert.throws(() => validateM7DevidCanaryReceipt({
  ...publishedReceipt, outer_roots_removed: false,
}), /verified outer cleanup/);

const command = systemdCommand(["--execute"], "12".repeat(16), "m7-devid");
assert.match(command.unit, /^cadr-m7-devid-o2-canary-/);
assert.ok(command.args.includes("--setenv=M7_DEVID_SYSTEMD_CHILD=1"));
assert.ok(command.args.some(value => String(value).endsWith("run-cadr-m7-devid-o2-canary.mjs")));

const failedGate = {
  ...finalReceipt.frozen_stage_gates[4], exit_code: 2,
};
const failedEnvelope = {
  schema: "cadr-m7-devid-o2-canary-result-envelope-v1",
  outcome: "canary-failed",
  receipt: {
    schema: "cadr-m7-devid-o2-canary-failure-v1",
    failure: {
      reason: "frozen-gate-failed", diagnostic_sha256: "a".repeat(64),
    },
    frozen_stage_gates: finalReceipt.frozen_stage_gates.slice(0, 4),
    failed_stage_gate: failedGate,
  },
};
assert.equal(validateResultEnvelope(failedEnvelope, "m7-devid"),
  failedEnvelope);
assert.throws(() => validateResultEnvelope({
  ...failedEnvelope, receipt: { ...failedEnvelope.receipt,
    failed_stage_gate: { ...failedGate, command: ["arbitrary-command"] } },
}, "m7-devid"), /next failed command/);
assert.throws(() => validateResultEnvelope({
  ...failedEnvelope, receipt: { ...failedEnvelope.receipt,
    failed_stage_gate: { ...failedGate, exit_code: 0 } },
}, "m7-devid"), /next failed command/);
assert.throws(() => validateResultEnvelope({
  ...failedEnvelope, receipt: { ...failedEnvelope.receipt,
    failed_stage_gate: { ...failedGate,
      stderr: { ...failedGate.stderr, tail: {
        start_byte: failedGate.stderr.byte_count + 1, text: "bad",
      } } } },
}, "m7-devid"), /malformed/);

const redacted = boundedM7GateStream(
  Buffer.from(`before /private/secret after`),
  [["/private/secret", "<PRIVATE>"]],
);
assert.equal(redacted.tail.text, "before <PRIVATE> after");
assert.doesNotMatch(JSON.stringify(redacted), /private\/secret/);
assert.equal(boundedM7GateStream(
  Buffer.from([0xff, 0xfe, 0xfd]), []).tail, null);
assert.ok(boundedM7GateStream(Buffer.alloc(8192, 0x61), [])
  .tail.text.length <= 2048);

const makefile = await readFile(resolve(root, "cadr-web/Makefile"), "utf8");
assert.match(makefile,
  /^m6-devid-wasm:.*build\/test_cadr_m2_public.*\$\(M5_WASM_O0\).*\$\(M6_DEVID_WASM_O0\).*\$\(M6_DEVID_WASM_O2\)$/m,
  "the independently runnable frozen M6 gate declares every binary used by its worker tests");
const m6HeadlessTest = await readFile(resolve(root,
  "tests/test_cadr_m6_headless_boot.mjs"), "utf8");
assert.doesNotMatch(m6HeadlessTest,
  /from tests import test_cadr_m6_native_witness/,
  "the archived frozen gate must not depend on the ignored native source checkout");
const m6GateRecipe = makefile.slice(
  makefile.indexOf("m6-devid-wasm:"),
  makefile.indexOf("m6-diagnostic-receipt-unit:"),
);
assert.doesNotMatch(m6GateRecipe, /test_cadr_m6_diagnostic_worker/,
  "the clean archived M6 gate must not attempt a nested historical Git archive");
assert.match(makefile,
  /^test:.*m6-devid-wasm.*m6-diagnostic-receipt-unit.*m7-unit/m,
  "the checkout-only diagnostic integration remains mandatory in the full suite");
console.log("receipt-bound M7-DEVID O2 canary tests passed");
