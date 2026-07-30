import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSelectiveM6Patch,
  assertSingleParentLine,
  assertTextualPayloadPatch,
  boundedCanaryFailure,
  assertSystemdSupervision,
  minimalFailureEnvelope,
  patchPaths,
  parseInvocation,
  publishFailureEnvelopeIfAbsent,
  removeCanaryStage,
  runSupervisedChild,
  validateClosedManifest,
  validateDriverResult,
  writeCanonicalNoReplaceReceipt,
} from "../scripts/run-cadr-m6-devid-o2-canary.mjs";
import { cleanupTransientUnit, normalizeOuterInvocation, parseSystemdShow,
  outerFailureReceipt, removeOwnedCanaryRoots, requireVacantReceiptPaths, systemdCommand,
  validateResultEnvelope, validateUnitAbsent,
  validateEffectiveSystemdPolicy, validateSystemdSuccess } from
  "../scripts/run-cadr-m6-devid-o2-canary-systemd.mjs";
import { copyRegularNoFollow, runExactCanaryLoop } from
  "../scripts/run-cadr-m6-devid-o2-canary-stage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = execFileSync(process.execPath, [
  resolve(root, "scripts/run-cadr-m6-devid-o2-canary.mjs"), "--help",
], { encoding: "utf8" });
assert.match(output, /--receipt-base COMMIT1/);
assert.match(output, /--candidate-commit COMMIT2/);
assert.match(output, /--m6-patch PAYLOAD\.patch/);
assert.match(output, /--artifact-root ROOT/);
assert.match(output, /--output RECEIPT\.json/);
assert.match(output, /1,130,000 completed guest boundaries/);
assert.match(output, /Without --execute it never runs/);

assert.throws(() => parseInvocation([]), /No M6-DEVID canary is implicit/,
  "default invocation cannot start a live run");
const bounded = boundedCanaryFailure(new Error(
  "/private/licensed/path/disk.img failed"));
assert.deepEqual(Object.keys(bounded).sort(), ["diagnostic_sha256", "reason"]);
assert.doesNotMatch(JSON.stringify(bounded), /private|licensed|disk\.img/);
assert.doesNotThrow(() => assertSingleParentLine(
  `${"a".repeat(40)} ${"b".repeat(40)}`, "a".repeat(40), "b".repeat(40)));
assert.throws(() => assertSingleParentLine(
  `${"a".repeat(40)} ${"b".repeat(40)} ${"c".repeat(40)}`,
  "a".repeat(40), "b".repeat(40)), /exactly one parent/);
assert.throws(() => assertSelectiveM6Patch([
  "cadr-web/core/cadr_m6_disk_evidence.c",
  "cadr-web/core/cadr_display.c",
]), /M7\/display contamination/,
  "display work cannot enter the selective M6 patch");
assert.doesNotThrow(() => assertSelectiveM6Patch([
  "cadr-web/core/cadr_m6_disk_evidence.c"]));
assert.doesNotThrow(() => assertSelectiveM6Patch([
  "scripts/build-cadr-m6-diagnostic-isolated.mjs",
  "scripts/run-cadr-m6-one-run-diagnostic.mjs",
  "tests/test_cadr_m6_diagnostic_launcher.mjs",
]));
assert.throws(() => assertSelectiveM6Patch([
  "scripts/build-cadr-m6-diagnostic-experimental.mjs",
]), /unapproved path/,
  "the receipt-bound diagnostic exception is literal rather than a wildcard");
assert.doesNotThrow(() => assertTextualPayloadPatch(Buffer.from(
  "diff --git a/cadr-web/core/cadr_core.c b/cadr-web/core/cadr_core.c\n")));
assert.throws(() => assertTextualPayloadPatch(Buffer.from(
  "diff --git a/a b/a\ndeleted file mode 100644\n")), /delete/);
assert.throws(() => assertSelectiveM6Patch([
  "scripts/run-cadr-m6-devid-o2-canary-stage.mjs"]),
  /immutable commit1 control plane/);
const parsedPatch = Buffer.from([
  "diff --git a/cadr-web/core/cadr_core.c b/cadr-web/core/cadr_core.c",
  "index 257cc91..5716ca5 100644",
  "--- a/cadr-web/core/cadr_core.c",
  "+++ b/cadr-web/core/cadr_core.c",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n"));
assert.deepEqual(patchPaths(parsedPatch), ["cadr-web/core/cadr_core.c"],
  "the launcher pipes the supplied patch bytes to git apply");

const manifestPaths = [
  "cadr-web/core/cadr_m6_disk_evidence.c",
];
const closedManifest = {
  schema: "cadr-m6-devid-o2-canary-action-manifest-v1",
  base_commit: "1".repeat(40), base_tree: "2".repeat(40),
  payload_patch_sha256: "3".repeat(64),
  files: manifestPaths.map(path => ({
    path, action: "modify", mode: "100644",
    preimage: { byte_count: 1, sha256: "aa".repeat(32) },
    postimage: { byte_count: 2, sha256: "bb".repeat(32) },
  })),
};
assert.equal(validateClosedManifest(closedManifest, manifestPaths).length, 1);
const bytewiseOrderingPaths = [
  "cadr-web/Makefile",
  "cadr-web/core/cadr_core.c",
];
assert.deepEqual(validateClosedManifest({
  ...closedManifest,
  files: bytewiseOrderingPaths.map(path => ({
    ...closedManifest.files[0],
    path,
  })).reverse(),
}, [...bytewiseOrderingPaths].reverse()).map(record => record.path),
bytewiseOrderingPaths,
"manifest and patch paths use the same locale-independent bytewise ordering");
assert.equal(validateClosedManifest({
  ...closedManifest,
  files: closedManifest.files.map(record => ({ ...record, mode: "100755" })),
}, manifestPaths).length, 1,
"the closed manifest preserves an executable payload mode");
assert.throws(() => validateClosedManifest({
  ...closedManifest,
  files: closedManifest.files.map(record => ({ ...record, mode: "100664" })),
}, manifestPaths), /malformed/,
"the closed manifest rejects modes outside regular and executable files");
assert.throws(() => validateClosedManifest({ ...closedManifest,
  files: closedManifest.files.slice(1) }, manifestPaths), /exactly cover/,
  "a shared post-patch file cannot evade the closed identity manifest");
assert.throws(() => assertSystemdSupervision({}, ""), /refuses unsupervised/,
  "the live launcher rejects a direct child");
const systemdUnit = `cadr-m6-devid-o2-canary-${"ab".repeat(16)}.service`;
assert.equal(assertSystemdSupervision({
  M6_DEVID_SYSTEMD_CHILD: "1", M6_DEVID_SYSTEMD_UNIT: systemdUnit,
  INVOCATION_ID: "cd".repeat(16),
}, `0::/user.slice/${systemdUnit}\n`).unit, systemdUnit);
const transient = systemdCommand(["--help"], "12".repeat(16));
assert.equal(transient.command, "systemd-run");
const systemdWrapperSource = await readFile(resolve(root,
  "scripts/run-cadr-m6-devid-o2-canary-systemd.mjs"), "utf8");
assert.doesNotMatch(systemdWrapperSource, /\b(?:CPUAccounting|TasksPeak)\b/,
  "removed systemd 261 properties cannot silently return to policy or queries");
for (const property of [
  "--property=MemoryMax=3221225472", "--property=MemorySwapMax=0",
  "--property=CPUQuota=200%", "--property=TasksMax=128",
  "--property=MemoryAccounting=yes", "--property=TasksAccounting=yes",
  "--property=PrivateNetwork=yes",
  "--property=RestrictAddressFamilies=AF_UNIX AF_INET",
  "--property=IOAccounting=yes", "--property=IPAccounting=yes",
  "--property=RuntimeMaxSec=14400", "--property=RemainAfterExit=yes",
  "--property=KillMode=control-group", "--property=ExitType=cgroup",
  "--property=Restart=no", "--property=OOMPolicy=kill",
]) assert.ok(transient.args.includes(property), property);
assert.ok(transient.args.includes("--systemd-child"));
assert.equal(transient.args.includes("--collect"), false,
  "the unit remains queryable until the outer wrapper records accounting");
assert.equal(transient.args.includes("--wait"), false,
  "RemainAfterExit is polled by the outer wrapper rather than deadlocking systemd-run --wait");
const normalizedInvocation = normalizeOuterInvocation([
  "--execute",
  "--m6-patch", "payload.patch",
  "--artifact-root", ".",
  "--output", "build/receipt.json",
], "/museum");
assert.deepEqual(normalizedInvocation, [
  "--execute",
  "--m6-patch", "/museum/payload.patch",
  "--artifact-root", "/museum",
  "--output", "/museum/build/receipt.json",
], "outer paths are resolved before systemd changes the child working directory");
assert.throws(() => parseInvocation(normalizeOuterInvocation([
  "--execute", "--receipt-base", "1".repeat(40),
  "--candidate-commit", "2".repeat(40),
  "--m6-patch", "a", "--m6-patch", "b",
  "--artifact-root", ".", "--output", "receipt.json",
], "/museum")), /duplicate canary argument/);
assert.throws(() => normalizeOuterInvocation([
  "--execute", "--output",
], "/museum"), /needs a value/);
assert.throws(() => parseInvocation(normalizeOuterInvocation([
  "--execute", "--unknown-option", "value",
], "/museum")), /unsupported or duplicate/);
assert.deepEqual(normalizeOuterInvocation([
  "--execute", "--m6-patch", "--leading-dash.patch",
], "/museum"), [
  "--execute", "--m6-patch", "/museum/--leading-dash.patch",
], "a path value beginning with a dash is not parsed as another option");
assert.equal(validateUnitAbsent({
  code: 0, signal: null, stdout: Buffer.from(""),
}), true);
assert.throws(() => validateUnitAbsent({
  code: 1, signal: null, stdout: Buffer.from(""),
}), /absence is unverified/,
"a failed systemctl query is not evidence that the transient unit is absent");
assert.throws(() => validateUnitAbsent({
  code: 0, signal: null, stdout: Buffer.from(`${systemdUnit} loaded failed\n`),
}), /remains loaded/,
"an exact listed unit prevents a successful cleanup claim");
{
  const calls = [];
  let removed = false;
  await cleanupTransientUnit({
    unit: systemdUnit, roots: ["/stage"],
    captureFn: async (command, args) => {
      calls.push([command, ...args]);
      return { code: 0, signal: null, stdout: Buffer.alloc(0) };
    },
    removeRoots: async () => { removed = true; },
  });
  assert.deepEqual(calls.map(call => call.slice(1, 3)), [
    ["--user", "stop"], ["--user", "reset-failed"],
    ["--user", "list-units"],
  ], "a successful stop does not issue a redundant kill");
  assert.equal(removed, true);
}
{
  const calls = [];
  let removed = false;
  const results = [
    { code: 1, signal: null, stdout: Buffer.alloc(0) },
    { code: 1, signal: null, stdout: Buffer.alloc(0) },
    { code: 1, signal: null, stdout: Buffer.alloc(0) },
    { code: 1, signal: null, stdout: Buffer.alloc(0) },
    { code: 0, signal: null, stdout: Buffer.alloc(0) },
  ];
  await cleanupTransientUnit({
    unit: systemdUnit, roots: ["/stage", "/private"],
    captureFn: async (command, args) => {
      calls.push([command, ...args]); return results.shift();
    },
    removeRoots: async paths => {
      assert.deepEqual(paths, ["/stage", "/private"]); removed = true;
    },
  });
  assert.deepEqual(calls.map(call => call.slice(1, 3)), [
    ["--user", "stop"], ["--user", "kill"], ["--user", "stop"],
    ["--user", "reset-failed"], ["--user", "list-units"],
  ], "cleanup attempts stop, kill, stop, reset, then proves absence");
  assert.equal(removed, true,
    "a never-created unit may release roots only after exact absence proof");
}
{
  let removed = false;
  await assert.rejects(() => cleanupTransientUnit({
    unit: systemdUnit, roots: ["/stage"],
    captureFn: async (command, args) => {
      if (args.includes("list-units")) {
        return { code: 1, signal: null, stdout: Buffer.alloc(0) };
      }
      return { code: 0, signal: null, stdout: Buffer.alloc(0) };
    },
    removeRoots: async () => { removed = true; },
  }), /absence is unverified/);
  assert.equal(removed, false,
    "unverified or live units retain their private roots for safe cleanup");
}
{
  let removed = false;
  await assert.rejects(() => cleanupTransientUnit({
    unit: systemdUnit, roots: ["/stage"],
    captureFn: async (command, args) => args.includes("list-units") ?
      { code: 0, signal: "SIGTERM", stdout: Buffer.alloc(0) } :
      { code: 0, signal: null, stdout: Buffer.alloc(0) },
    removeRoots: async () => { removed = true; },
  }), /absence is unverified/);
  assert.equal(removed, false,
    "a signaled absence query cannot authorize root removal");
}
{
  const childFailure = {
    reason: "frozen-gate-failed", diagnostic_sha256: "ab".repeat(32),
  };
  const failedEnvelope = validateResultEnvelope({
    schema: "cadr-m6-devid-o2-canary-result-envelope-v1",
    outcome: "canary-failed",
    receipt: {
      schema: "cadr-m6-devid-o2-canary-failure-v1",
      failure: childFailure,
    },
  });
  assert.equal(failedEnvelope.receipt.failure, childFailure);
  assert.throws(() => validateResultEnvelope({
    ...failedEnvelope,
    receipt: { ...failedEnvelope.receipt,
      failure: { reason: "unsafe", diagnostic_sha256: "/private/path" } },
  }), /malformed/);
  assert.throws(() => validateResultEnvelope({
    ...failedEnvelope,
    receipt: { ...failedEnvelope.receipt,
      failure: { ...childFailure, private_path: "/private/path" } },
  }), /malformed/,
  "a child failure witness cannot smuggle extra durable evidence fields");
  const receipt = outerFailureReceipt({
    reason: "canary-and-unit-cleanup-failed", unit: systemdUnit,
    run: { code: 7, signal: null },
    primary: new Error("/private/input primary"),
    cleanupFailure: new Error("/private/root cleanup"),
    childFailure,
  });
  assert.equal(receipt.reason, "canary-and-unit-cleanup-failed");
  assert.deepEqual(Object.keys(receipt.failures.primary).sort(),
    ["diagnostic_sha256", "reason"]);
  assert.deepEqual(Object.keys(receipt.failures.cleanup).sort(),
    ["diagnostic_sha256", "reason"]);
  assert.notEqual(receipt.failures.primary.diagnostic_sha256,
    receipt.failures.cleanup.diagnostic_sha256);
  assert.deepEqual(receipt.failures.child, childFailure,
    "the outer failure retains the child's already bounded failure category");
  assert.deepEqual(Object.keys(outerFailureReceipt({
    reason: "canary-child-failed", unit: systemdUnit,
    childFailure: { ...childFailure, private_path: "/private/path" },
  }).failures.child).sort(), ["diagnostic_sha256", "reason"],
  "outer serialization reconstructs the two-field witness defensively");
  assert.doesNotMatch(JSON.stringify(receipt), /\/private|input|root/);
}
const accountingFixture = parseSystemdShow([
  "MemoryPeak=10", "CPUUsageNSec=20", "TasksCurrent=[not set]",
  "IOReadBytes=4", "IOWriteBytes=5", "IPIngressBytes=6", "IPEgressBytes=7",
  "Result=success", "ExecMainCode=1", "ExecMainStatus=0",
].join("\n"));
assert.equal(accountingFixture.TasksCurrent, "[not set]");
assert.equal(validateSystemdSuccess({ Result: "success", ExecMainCode: "1",
  ExecMainStatus: "0" }, accountingFixture), accountingFixture);
assert.equal(validateSystemdSuccess({ Result: "success", ExecMainCode: "1",
  ExecMainStatus: "0" }, {
    ...accountingFixture, IOReadBytes: "[not set]",
    IOWriteBytes: "[not set]", IPIngressBytes: "[no data]",
    IPEgressBytes: "[no data]",
  }).MemoryPeak, "10",
"systemd 261 unavailable-counter sentinels remain explicit evidence");
assert.throws(() => validateSystemdSuccess({ Result: "oom-kill",
  ExecMainCode: "2", ExecMainStatus: "9" }, accountingFixture), /invalid/);
assert.throws(() => validateSystemdSuccess({ Result: "success",
  ExecMainCode: "1", ExecMainStatus: "0" },
{ ...accountingFixture, MemoryPeak: "[not set]" }), /invalid/);
assert.throws(() => validateSystemdSuccess({ Result: "success",
  ExecMainCode: "1", ExecMainStatus: "0" },
{ ...accountingFixture, IOReadBytes: "[no data]" }), /invalid/,
"IO accounting accepts only its own exact unavailable sentinel");
assert.throws(() => validateSystemdSuccess({ Result: "success",
  ExecMainCode: "1", ExecMainStatus: "0" },
{ ...accountingFixture, IPIngressBytes: "[not set]" }), /invalid/,
"IP accounting accepts only its own exact unavailable sentinel");
const effectivePolicy = {
  RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
  MemoryMax: "3221225472", MemorySwapMax: "0",
  CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
  NoNewPrivileges: "yes", PrivateNetwork: "yes",
  RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
  ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes",
};
assert.equal(validateEffectiveSystemdPolicy(effectivePolicy), effectivePolicy);
assert.throws(() => validateEffectiveSystemdPolicy({
  ...effectivePolicy, MemoryMax: "infinity" }), /MemoryMax/);

const valid = Object.freeze({
  schema: "cadr-m6-devid-o2-canary-stage-v1",
  completed_guest_boundary: "1130000",
  nonterminal: true,
  machine: Object.freeze({ clock_slots_completed: "1130000",
    outstanding_request_id: "0", lifecycle: 2, persistentStatus: 0 }),
  private_disk: Object.freeze({ fresh: true, instance_id: "fresh-private-disk",
    base_sha256: "ab".repeat(32),
    overlay_kind: "fresh-in-memory-m4-block-one-overlay",
    overlay_initial_generation: "0", overlay_final_generation: "1",
    base_write_authority: false }),
  exact_loop: Object.freeze({ batches: 277, host_transactions: 1 }),
  frozen_input_schedule: Object.freeze({ event_count: 3118,
    first_due_boundary: "25000000", events_due_through_target: 0 }),
  artifacts_before: Object.freeze([{ kind: 3, path: "l/usim/disk-sys-303-0.img", sha256: "ef".repeat(32) }]),
  artifacts_after: Object.freeze([{ kind: 3, path: "l/usim/disk-sys-303-0.img", sha256: "ef".repeat(32) }]),
  private_artifacts_before: Object.freeze([{ kind: 3, sha256: "ef".repeat(32) }]),
  private_artifacts_after: Object.freeze([{ kind: 3, sha256: "ef".repeat(32) }]),
  base_disk_unchanged: true,
  m6_disk_evidence: Object.freeze({ accepted_events: "513", tail_events: "1", sha256: "cd".repeat(32) }),
});
assert.equal(validateDriverResult(valid), valid);
for (const [label, change] of [
  ["turn count", { completed_guest_boundary: "1129999" }],
  ["terminal", { nonterminal: false }],
  ["machine boundary", { machine: { ...valid.machine, clock_slots_completed: "1129999" } }],
  ["pending exact-boundary host", { machine: { ...valid.machine, outstanding_request_id: "1" } }],
  ["no tail", { m6_disk_evidence: { ...valid.m6_disk_evidence, accepted_events: "512", tail_events: "0" } }],
  ["artifact mutation", { artifacts_after: [{ kind: 3, sha256: "changed" }] }],
  ["base disk missing", { base_disk_unchanged: false }],
]) {
  assert.throws(() => validateDriverResult({ ...valid, ...change }),
    /exact nonterminal guest boundary and >512 M6 tail/, label);
}

{
  const info = (boundary, outstanding = 0n) => {
    const bytes = new ArrayBuffer(64); const view = new DataView(bytes);
    view.setUint32(0, 2, true); view.setBigUint64(8, boundary, true);
    view.setBigUint64(40, outstanding, true);
    return bytes;
  };
  let boundary = 0n; let outstanding = 0n; let pending = false;
  let runs = 0; let serviced = false;
  const client = { async request(op) {
    if (op === "machine-info") return { status: 0, info: info(boundary, outstanding) };
    if (op === "run-digest-batch-m5") {
      runs += 1;
      if (runs === 1) {
        boundary = 1n; outstanding = 1n; pending = true;
        return { status: 0, boundaryCount: 0, boundaryPendingHost: true,
          terminalStatus: 8 };
      }
      pending = false;
      return { status: 0, boundaryCount: 1, boundaryPendingHost: false,
        terminalStatus: 0 };
    }
    if (op === "scheduler-state") return { status: 0, lifecycle: "PAUSED",
      runActive: false, pendingBoundaryDigest: pending, deferredControlCount: 0 };
    if (op === "scheduler-pause") return { status: 0 };
    if (op === "media-overlay-state") return { status: 0 };
    if (op === "host-next-request") return { status: 9 };
    throw new Error(`unexpected ${op}`);
  } };
  const service = { async poll() { serviced = true; outstanding = 0n;
      return { status: 0, events: [{ requestSeen: true }] }; },
    overlayGeneration() { return 0n; },
    snapshotBlocked() { return false; }, hasPendingRequest() { return false; } };
  const result = await runExactCanaryLoop(client, service, 1n);
  assert.equal(result.info.clockSlotsCompleted, 1n);
  assert.equal(serviced, true);
  assert.equal(runs, 2,
    "the final wait uses one tested completion-only digest settlement");
}

function pendingFalseFixture() {
  let boundary = 0n; let outstanding = 0n; let runs = 0; let serviced = 0;
  const info = () => {
    const bytes = new ArrayBuffer(64); const view = new DataView(bytes);
    view.setUint32(0, 2, true); view.setBigUint64(8, boundary, true);
    view.setBigUint64(40, outstanding, true); return bytes;
  };
  const client = { async request(op) {
    if (op === "machine-info") return { status: 0, info: info() };
    if (op === "run-digest-batch-m5") {
      runs += 1;
      if (runs === 1) {
        boundary = 1n; outstanding = 1n;
        return { status: 0, boundaryCount: 0,
          boundaryPendingHost: false, terminalStatus: 8 };
      }
      boundary += 1n;
      return { status: 0, boundaryCount: 1,
        boundaryPendingHost: false, terminalStatus: 0 };
    }
    if (op === "scheduler-state") return { status: 0, lifecycle: "PAUSED",
      runActive: false, pendingBoundaryDigest: false, deferredControlCount: 0 };
    if (op === "scheduler-pause" || op === "media-overlay-state") {
      return { status: 0 };
    }
    if (op === "host-next-request") return { status: 9 };
    throw new Error(`unexpected ${op}`);
  } };
  const service = { async poll() { serviced += 1; outstanding = 0n;
      return { status: 0, events: [{ requestSeen: true }] }; },
    overlayGeneration() { return 0n; }, snapshotBlocked() { return false; },
    hasPendingRequest() { return false; } };
  return { client, service, serviced: () => serviced };
}
{
  const fixture = pendingFalseFixture();
  const result = await runExactCanaryLoop(fixture.client, fixture.service, 2n);
  assert.equal(result.info.clockSlotsCompleted, 2n);
  assert.equal(fixture.serviced(), 1,
    "a pending-false wait below target is serviced then normal running continues");
}
{
  const fixture = pendingFalseFixture();
  await assert.rejects(() => runExactCanaryLoop(
    fixture.client, fixture.service, 1n), /no tested completion-only settlement/);
  assert.equal(fixture.serviced(), 1,
    "a pending-false wait at target is serviced before failing closed");
}

const directory = await mkdtemp(resolve(tmpdir(), "cadr-m6-devid-canary-test-"));
try {
  await chmod(directory, 0o700);
  const receipt = resolve(directory, "receipt.json");
  const earlyEnvelope = resolve(directory, "early-envelope.json");
  assert.equal(await publishFailureEnvelopeIfAbsent(earlyEnvelope,
    new Error("patch parser rejected malformed input")), true);
  const earlyResult = validateResultEnvelope(JSON.parse(
    await readFile(earlyEnvelope, "utf8")));
  assert.equal(earlyResult.outcome, "canary-failed");
  assert.equal(earlyResult.receipt.failure.reason, "candidate-identity-failed",
    "a pre-stage patchPaths failure publishes a bounded child witness");
  assert.equal(await publishFailureEnvelopeIfAbsent(earlyEnvelope,
    new Error("replacement")), false,
  "a full later failure boundary preserves an already published envelope");
  const stagedEnvelope = minimalFailureEnvelope(
    new Error("staged canary returned non-JSON"));
  assert.equal(validateResultEnvelope(stagedEnvelope).receipt.failure.reason,
    "stage-protocol-failed",
  "a later staged-driver failure uses the same closed bounded envelope");
  const vacantReceipt = resolve(directory, "vacant.json");
  await requireVacantReceiptPaths(vacantReceipt);
  await writeCanonicalNoReplaceReceipt(vacantReceipt, { schema: "fixture" });
  await assert.rejects(() => requireVacantReceiptPaths(vacantReceipt),
    /already exists/, "the outer wrapper refuses a pre-existing success receipt");
  const vacantFailureBase = resolve(directory, "vacant-failure.json");
  await writeCanonicalNoReplaceReceipt(`${vacantFailureBase}.failure.json`,
    { schema: "fixture" });
  await assert.rejects(() => requireVacantReceiptPaths(vacantFailureBase),
    /already exists/, "the outer wrapper refuses a pre-existing failure receipt");
  const tinySource = resolve(directory, "tiny-source");
  const tinyCopy = resolve(directory, "tiny-copy");
  await writeFile(tinySource, "tiny");
  assert.equal((await copyRegularNoFollow(tinySource, tinyCopy)).byte_count, 4);
  const tinyLink = resolve(directory, "tiny-link");
  await symlink(tinySource, tinyLink);
  await assert.rejects(() => copyRegularNoFollow(tinyLink,
    resolve(directory, "linked-copy")), /ELOOP|symbolic link/i,
  "private snapshot copy rejects symlink sources with O_NOFOLLOW");
  const first = await writeCanonicalNoReplaceReceipt(receipt, { schema: "fixture", value: 1 });
  assert.equal((await stat(receipt)).mode & 0o777, 0o600);
  assert.equal((await readFile(receipt, "utf8")).length, first.byte_count);
  await assert.rejects(() => writeCanonicalNoReplaceReceipt(receipt, { schema: "replacement" }),
    error => error?.code === "EEXIST", "receipt publication never replaces an earlier receipt");
  const failureReceipt = `${receipt}.failure.json`;
  await writeCanonicalNoReplaceReceipt(failureReceipt, {
    schema: "cadr-m6-devid-o2-canary-failure-v1", stage_removed: true,
    error: { class: "FixtureError", message: "fixture child failed" },
  });
  assert.equal((await stat(failureReceipt)).mode & 0o777, 0o600,
    "failure evidence is also a private no-replace receipt");

  const fixture = resolve(directory, "fixture.mjs");
  await writeFile(fixture, "process.stdout.write(process.argv[2]);\n");
  await assert.rejects(() => runSupervisedChild({ script: fixture, args: [fixture, "x".repeat(128)], cwd: directory, stdoutLimit: 64, wallMs: 1000 }), /stdout limit/,
    "oversized child output fails before JSON parsing");
  await writeFile(fixture, "setInterval(() => {}, 1000);\n");
  await assert.rejects(() => runSupervisedChild({ script: fixture, args: [fixture], cwd: directory, wallMs: 20 }), /wall limit/,
    "supervisor kills a timeout fixture");
  await writeFile(fixture, "process.exit(7);\n");
  await assert.rejects(() => runSupervisedChild({ script: fixture, args: [fixture], cwd: directory, wallMs: 1000 }), /code=7/,
    "nonzero fixture exits fail closed");
  await writeFile(fixture, "process.kill(process.pid, 'SIGTERM');\n");
  await assert.rejects(() => runSupervisedChild({ script: fixture, args: [fixture], cwd: directory, wallMs: 1000 }), /signal=SIGTERM/,
    "signaled fixture exits fail closed");
  const failedStage = await mkdtemp(resolve(directory, "failed-stage-"));
  const failedChild = resolve(failedStage, "child.mjs");
  await writeFile(failedChild, "process.exit(1);\n");
  await assert.rejects(() => runSupervisedChild({ script: failedChild, args: [failedChild], cwd: failedStage, wallMs: 1000 }), /code=1/);
  await removeCanaryStage(failedStage);
  await assert.rejects(() => stat(failedStage), /ENOENT/,
    "failure cleanup removes the isolated staged tree after its child exits");
  const outerStage = await mkdtemp(resolve(directory, "outer-stage-"));
  const outerPrivate = await mkdtemp(resolve(directory, "outer-private-"));
  await writeFile(resolve(outerPrivate, "partial"), "abnormal child residue");
  await removeOwnedCanaryRoots([outerStage, outerPrivate]);
  await assert.rejects(() => stat(outerStage), /ENOENT/);
  await assert.rejects(() => stat(outerPrivate), /ENOENT/,
    "outer cleanup removes private residue left by an abnormal child");
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log("cadr_m6_devid_o2_canary_runner: ok");
