import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  acquireM7P4PinnedFileForTest,
  composeM7P4PhaseADescriptorsForTest,
  consumeM7P4AuthorityReadyForTest,
  decodeM7P4HostResultForTest,
  encodeM7P4DropperConfigForTest,
  runM7P4PhaseASupervisorForTest,
  validateM7P4PhaseASelectionForTest,
  validateM7P4ServiceDescriptorsForTest,
  validateM7P4ServiceAccountPolicyForTest,
} from "../scripts/cadr-m7-p4-host-supervisor.mjs";

const H = "a".repeat(64);
const commits = ["1".repeat(40), "2".repeat(40)];
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function rootSnapshot() {
  return { initial_user_namespace: true,
    uid_map: "         0          0 4294967295\n",
    gid_map: "         0          0 4294967295\n",
    status: ["Uid:\t0 0 0 0", "Gid:\t0 0 0 0", "Groups:\t0",
      "CapInh:\t0", "CapPrm:\t1", "CapEff:\t1", "CapBnd:\t1", "CapAmb:\t0", ""].join("\n") };
}
function accountSnapshot() {
  const user = { name: "cadr-m7-p4", uid: 611, gid: 612, password: "!",
    home: "/var/empty", shell: "/usr/bin/nologin" };
  const group = { name: "cadr-m7-p4", gid: 612, password: "!", members: [] };
  return { schema: "cadr-m7-p4-nss-snapshot-v1", user_forward: user,
    user_reverse: { ...user }, group_forward: group,
    group_reverse: { ...group, members: [] }, uid_matches: [{ ...user }],
    gid_matches: [{ ...group, members: [] }], supplementary_groups: [] };
}
function artifact(path) { return { path, bytes: 7, sha256: H, mode: 0o555 }; }
function selection() {
  const output = "/gnu/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-m7-p4";
  const nodeOutput = "/gnu/store/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-node";
  return { schema: "cadr-m7-p4-phase-a-selection-v1",
    source_a: { commit: commits[0], tree: "3".repeat(40),
      signature_status: "good-trusted-primary", clean: true },
    release_b: { commit: commits[1], tree: "4".repeat(40), parent: commits[0],
      signature_status: "good-trusted-primary", clean: true },
    guix: { output, node_output: nodeOutput, closure_sha256: H,
      artifacts: { authority: artifact(`${output}/bin/authority`),
        descriptor_runner: artifact(`${output}/libexec/runner`),
        dropper: artifact(`${output}/libexec/dropper`),
        supervisor: artifact(`${output}/bin/supervisor`),
        node: artifact(`${nodeOutput}/bin/node`) } } };
}
const bindingNames = ["artifacts", "comparison", "execution_accounting", "execution_budget",
  "m6_release_record", "native", "native_inputs", "patches", "portable", "prepared",
  "schedule", "source", "summary"];
function bindings() { return Object.fromEntries(bindingNames.map((name, index) =>
  [name, index.toString(16).padStart(64, "0")])); }
function moduleInput() { return { schema: "cadr-m7-fixed-module-input-v1",
  module_sha256: "b".repeat(64), module_bytes: 122268,
  prepared_identity: { schema: "prepared-v1", digest: "c".repeat(64) },
  launcher: { output_sha256: "d".repeat(64) } }; }
function identities() {
  const names = ["node", "descriptor_runner", "wasm", "module_identity", "manifest",
    "native", "m6_release", "artifact_1", "artifact_2", "artifact_4", "artifact_5", "artifact_3"];
  return names.map((name, index) => ({ fd: index < 2 ? 4 + index : 5 + index,
    role: index + 1, name, dev: 10n, ino: BigInt(100 + index), bytes: 10 + index,
    sha256: (index + 1).toString(16).padStart(64, "0") }));
}
function resultFrame(value, disposition = 0) {
  const payload = Buffer.from(canonicalJson(value)); const header = Buffer.alloc(56);
  Buffer.from("M7HDRS2\0", "ascii").copy(header); header.writeUInt32LE(2, 8);
  header.writeUInt32LE(disposition, 12); header.writeBigUInt64LE(BigInt(payload.length), 16);
  createHash("sha256").update(payload).digest().copy(header, 24);
  return Buffer.concat([header, payload]);
}
function rejectOnAbort(signal, label = "aborted boundary operation") {
  return new Promise((_, reject) => {
    if (signal.aborted) { reject(new Error(label)); return; }
    signal.addEventListener("abort", () => reject(new Error(label)), { once: true });
  });
}

const account = validateM7P4ServiceAccountPolicyForTest(accountSnapshot());
assert.equal(account.value.name, "cadr-m7-p4");
assert.equal(account.sha256, hash(account.bytes));
for (const mutation of [
  snapshot => { snapshot.user_forward.uid = 613; snapshot.user_reverse.uid = 613;
    snapshot.uid_matches[0].uid = 613; },
  snapshot => { snapshot.user_forward.gid = 613; snapshot.user_reverse.gid = 613;
    snapshot.group_forward.gid = 613; snapshot.group_reverse.gid = 613;
    snapshot.gid_matches[0].gid = 613; },
  snapshot => { snapshot.user_reverse.uid = 999; },
  snapshot => { snapshot.uid_matches.push({ ...snapshot.user_forward, name: "collision" }); },
  snapshot => { snapshot.user_forward.password = "x"; },
  snapshot => { snapshot.user_forward.shell = "/bin/sh"; },
  snapshot => { snapshot.supplementary_groups.push("wheel"); },
]) {
  const bad = accountSnapshot(); mutation(bad);
  assert.throws(() => validateM7P4ServiceAccountPolicyForTest(bad),
    /NSS|locked|supplementary|agree/);
}
assert.equal(validateM7P4ServiceDescriptorsForTest([0, 1, 2]), true);
assert.throws(() => validateM7P4ServiceDescriptorsForTest([0, 1, 2, 3]), /exactly/);

const selected = validateM7P4PhaseASelectionForTest(selection());
assert.equal(selected.sha256, hash(selected.bytes));
assert.throws(() => validateM7P4PhaseASelectionForTest({ ...selection(),
  source_a: { ...selection().source_a, clean: false } }), /clean authenticated/);
assert.throws(() => validateM7P4PhaseASelectionForTest({ ...selection(),
  release_b: { ...selection().release_b, parent: "9".repeat(40) } }), /lineage/);

const composed = composeM7P4PhaseADescriptorsForTest({ bindings: bindings(), module: moduleInput() });
assert.equal(JSON.parse(composed.fd4.bytes).schema, "cadr-m7-frame-expected-closure-v2");
assert.equal(JSON.parse(composed.fd9.bytes).schema, "cadr-m7-fixed-module-identity-v1");
assert.throws(() => composeM7P4PhaseADescriptorsForTest({
  bindings: { ...bindings(), ambient: H }, module: moduleInput() }), /invalid shape/);

const readyValue = { expected_closure_sha256: composed.fd4.sha256,
  schema: "cadr-m7-p4-authority-ready-v1", status: "ready" };
const readyBytes = Buffer.from(`${canonicalJson(readyValue)}\n`);
const ready = consumeM7P4AuthorityReadyForTest(readyBytes, composed.fd4.sha256);
assert.equal(ready.sha256, hash(readyBytes));
assert.throws(() => consumeM7P4AuthorityReadyForTest(Buffer.concat([readyBytes, readyBytes]),
  composed.fd4.sha256), /exactly one/);
assert.throws(() => consumeM7P4AuthorityReadyForTest(Buffer.from(` ${canonicalJson(readyValue)}\n`),
  composed.fd4.sha256), /differs/);

const configInput = { target_uid: 611, target_gid: 612,
  user_namespace: { dev: 1n, ino: 2n }, authority_socket: { dev: 3n, ino: 4n },
  result_pipe: { dev: 5n, ino: 6n }, account_policy_sha256: account.sha256,
  signed_capture_metadata_sha256: "e".repeat(64), ready_sha256: ready.sha256,
  files: identities() };
const config = encodeM7P4DropperConfigForTest(configInput);
assert.equal(config.length, 952); assert.equal(config.subarray(0, 8).toString("ascii"), "M7HDPV2\0");
assert.equal(config.readUInt32LE(16), 952); assert.equal(config.readUInt32LE(20), 12);
assert.equal(config.readUInt32LE(184), 4); assert.equal(config.readUInt32LE(188), 1);
assert.equal(config.readUInt32LE(184 + 11 * 64), 16);
assert.throws(() => encodeM7P4DropperConfigForTest({ ...configInput,
  files: identities().reverse() }), /differs/);
assert.throws(() => encodeM7P4DropperConfigForTest({ ...configInput,
  target_uid: 1001, target_gid: 1002 }), /fixed site identities/);
{
  const aliases = identities(); aliases[1] = { ...aliases[1], ino: aliases[0].ino };
  assert.throws(() => encodeM7P4DropperConfigForTest({ ...configInput, files: aliases }),
    /aliases/);
}

const okValue = { execution_receipt: { summary_sha256: "f".repeat(64) },
  schema: "cadr-m7-p4-host-result-v2", status: "ok" };
const frame = resultFrame(okValue);
assert.equal(decodeM7P4HostResultForTest(frame).disposition, 0);
assert.throws(() => decodeM7P4HostResultForTest(Buffer.concat([frame, Buffer.from([0])])),
  /frame count/);
const corrupt = Buffer.from(frame); corrupt[24] ^= 1;
assert.throws(() => decodeM7P4HostResultForTest(corrupt), /digest/);
assert.throws(() => decodeM7P4HostResultForTest(resultFrame({ execution_receipt: {
  output_path: "/gnu/store/forbidden" }, schema: "cadr-m7-p4-host-result-v2", status: "ok" })),
  /path/);
const failed = { error: { code: "M7_P4_EXECUTION_FAILED", message: "M7 P4 execution failed" },
  schema: "cadr-m7-p4-host-result-v2", status: "error" };
assert.equal(decodeM7P4HostResultForTest(resultFrame(failed, 1)).disposition, 1);

const fixture = await mkdtemp(resolve(tmpdir(), "m7-p4-supervisor-walk-"));
try {
  await mkdir(resolve(fixture, "a")); await writeFile(resolve(fixture, "a/input"), "pinned\n");
  const pinned = await acquireM7P4PinnedFileForTest(fixture, "a/input",
    { expected_sha256: hash(Buffer.from("pinned\n")) });
  assert.equal(pinned.bytes.toString(), "pinned\n"); await pinned.handle.close();
  await symlink("input", resolve(fixture, "a/link"));
  await assert.rejects(acquireM7P4PinnedFileForTest(fixture, "a/link"), /ELOOP|symbolic/i);
  await assert.rejects(acquireM7P4PinnedFileForTest(fixture, "../escape"), /forbidden/);
} finally { await rm(fixture, { recursive: true, force: true }); }

function boundary({ early = null } = {}) {
  const events = []; const handles = identities().map((_, index) => `handle-${index}`);
  const delayed = value => new Promise(resolveDelay => setTimeout(() => resolveDelay(value), 5));
  const deadline = label => {
    let timer; let cancelled = false;
    const promise = new Promise(resolveDeadline => {
      timer = setTimeout(() => resolveDeadline(), 50);
    });
    return { promise, cancel: () => {
      if (!cancelled) { cancelled = true; clearTimeout(timer); events.push(`deadline-cancel-${label}`); }
    } };
  };
  return { events,
    cleanupBegin: async () => events.push("cleanup-begin"),
    cleanupFinish: async () => events.push("cleanup-finish"),
    captureRootSnapshot: async () => rootSnapshot(),
    recomputePhaseASelection: async () => { events.push("selection"); return selection(); },
    resolveServiceAccount: async name => { assert.equal(name, "cadr-m7-p4");
      events.push("account"); return accountSnapshot(); },
    deriveClosureBindings: async () => bindings(),
    deriveFixedModule: async () => moduleInput(),
    acquireDescriptors: async () => { events.push("acquire"); return {
      fd4: "closure", git: "git", guix: "guix", gpgv: "gpgv", keyring: "keyring",
      module_identity: "module", node: handles[0], descriptor_runner: handles[1],
      dropper_files: identities(), dropper_handles: handles,
      result_read: "result-read", result_write: "result-write" }; },
    socketPair: async () => { events.push("socketpair"); return {
      supervisor: "socket-supervisor", authority: "socket-authority" }; },
    createAuthority: spec => { events.push("authority-spawn");
      assert.deepEqual(Object.keys(spec.fds).map(Number), [3, 4, 5, 6, 7, 8, 9]); return "authority"; },
    startAuthority: async () => {},
    readAuthorityReady: async () => { events.push("ready"); return readyBytes; },
    captureDropperKernelState: async () => ({ user_namespace: { dev: 1n, ino: 2n },
      authority_socket: { dev: 3n, ino: 4n }, result_pipe: { dev: 5n, ino: 6n },
      signed_capture_metadata_sha256: "e".repeat(64) }),
    createDropper: spec => { events.push("dropper-spawn");
      assert.deepEqual(Object.keys(spec.fds).map(Number),
        [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]); return "dropper"; },
    startDropper: async () => {},
    readResult: (_handle, signal) => { events.push("result-read"); return {
      async *[Symbol.asyncIterator]() {
        if (early !== null) await Promise.race([delayed(), rejectOnAbort(signal)]);
        yield frame;
      },
    }; },
    closeResultWriter: async () => { events.push("result-writer-closed"); },
    waitAuthority: async (_child, signal) => early === "authority" ?
      { code: 0, signal: null } : Promise.race([
        delayed({ code: 0, signal: null }), rejectOnAbort(signal)]),
    waitDropper: async (_child, signal) => early === "dropper" ?
      { code: 0, signal: null } : Promise.race([
        delayed({ code: 0, signal: null }), rejectOnAbort(signal)]),
    deadline,
    forceTerminateOwned: ({ label, resources }) => { events.push(`force-owned-${label}-${resources.length}`); },
    terminateAndReap: async () => { events.push("children-reaped"); },
  };
}
const successfulBoundary = boundary();
const phaseA = await runM7P4PhaseASupervisorForTest(successfulBoundary);
assert.equal(phaseA.value.production_evidence, false);
assert.deepEqual(Object.keys(phaseA.value).sort(), ["account_policy_sha256", "authority_exit_sha256",
  "dropper_exit_sha256", "expected_closure_sha256", "module_identity_sha256",
  "production_evidence", "ready_sha256", "result_frame_sha256", "result_payload_sha256",
  "schema", "selection_sha256"]);
assert.ok(successfulBoundary.events.indexOf("ready") < successfulBoundary.events.indexOf("dropper-spawn"));
assert.ok(successfulBoundary.events.indexOf("children-reaped") <
  successfulBoundary.events.indexOf("cleanup-finish"));
for (const label of ["authority-ready", "result-eof", "child-exit", "child-reap"]) {
  assert.ok(successfulBoundary.events.includes(`deadline-cancel-${label}`));
}
assert.equal(successfulBoundary.events.at(-1), "cleanup-finish");
{
  const rejectedDeadline = boundary(); let lateMutations = 0;
  rejectedDeadline.captureRootSnapshot = signal => new Promise((resolveSnapshot, reject) => {
    const timer = setTimeout(() => { lateMutations += 1; resolveSnapshot(rootSnapshot()); }, 100);
    signal.addEventListener("abort", () => {
      clearTimeout(timer); reject(new Error("root snapshot acquisition aborted and joined"));
    }, { once: true });
  });
  const ordinaryDeadline = rejectedDeadline.deadline;
  rejectedDeadline.deadline = label => {
    const deadline = ordinaryDeadline(label);
    if (label !== "root-snapshot") return deadline;
    return { promise: new Promise((_, reject) => setTimeout(
      () => reject(new Error("root-snapshot-deadline-rejected")), 10)),
    cancel: () => {
      deadline.cancel();
      throw new Error("root-snapshot-cancel-failure");
    } };
  };
  await assert.rejects(runM7P4PhaseASupervisorForTest(rejectedDeadline), error =>
    error instanceof AggregateError && error.errors.length === 2 &&
    error.errors[0].message === "root-snapshot-deadline-rejected" &&
    error.errors[1].message === "root-snapshot-cancel-failure");
  assert.equal(lateMutations, 0, "the rejected deadline joins its loser before returning");
  assert.equal(rejectedDeadline.events.at(-1), "cleanup-finish");
  await new Promise(resolveWait => setTimeout(resolveWait, 110));
  assert.equal(lateMutations, 0,
    "the rejected deadline loser cannot mutate after cleanup");
}
{
  const forgedBoundary = boundary();
  forgedBoundary.recomputePhaseASelection = async () => ({ ...selection(),
    source_a: { ...selection().source_a, clean: false } });
  await assert.rejects(runM7P4PhaseASupervisorForTest(forgedBoundary), /clean authenticated/);
  assert.ok(!forgedBoundary.events.includes("acquire"),
    "untrusted selection is rejected before descriptor acquisition");
  assert.equal(forgedBoundary.events.at(-1), "cleanup-finish");
}
{
  const preSpawnStall = boundary(); let lateMutations = 0;
  preSpawnStall.recomputePhaseASelection = signal => new Promise((resolveSelection, reject) => {
    const timer = setTimeout(() => { lateMutations += 1; resolveSelection(selection()); }, 100);
    signal.addEventListener("abort", () => {
      clearTimeout(timer); reject(new Error("selection acquisition aborted and joined"));
    }, { once: true });
  });
  await assert.rejects(runM7P4PhaseASupervisorForTest(preSpawnStall),
    /phase-a-selection exceeded/);
  assert.ok(!preSpawnStall.events.includes("acquire"));
  assert.equal(preSpawnStall.events.at(-1), "cleanup-finish");
  await new Promise(resolveWait => setTimeout(resolveWait, 110));
  assert.equal(lateMutations, 0,
    "an aborted pre-spawn loser is joined and cannot mutate state after cleanup");
}
{
  const cancelFailure = boundary();
  cancelFailure.recomputePhaseASelection = async () => {
    throw new Error("primary-selection-failure");
  };
  const ordinaryDeadline = cancelFailure.deadline;
  cancelFailure.deadline = label => {
    const deadline = ordinaryDeadline(label);
    if (label === "phase-a-selection") deadline.cancel = () => {
      cancelFailure.events.push("deadline-cancel-phase-a-selection");
      throw new Error("deadline-cancel-failure");
    };
    return deadline;
  };
  await assert.rejects(runM7P4PhaseASupervisorForTest(cancelFailure), error =>
    error instanceof AggregateError && error.errors.length === 2 &&
    error.errors[0].message === "primary-selection-failure" &&
    error.errors[1].message === "deadline-cancel-failure");
  assert.equal(cancelFailure.events.at(-1), "cleanup-finish");
}
{
  const hangingCancel = boundary();
  hangingCancel.recomputePhaseASelection = async () => {
    throw new Error("primary-before-hanging-cancel");
  };
  const ordinaryDeadline = hangingCancel.deadline;
  hangingCancel.deadline = label => {
    const deadline = ordinaryDeadline(label);
    if (label === "phase-a-selection") deadline.cancel = () => new Promise(() => {});
    return deadline;
  };
  await assert.rejects(runM7P4PhaseASupervisorForTest(hangingCancel), error =>
    error instanceof AggregateError && error.errors.length === 2 &&
    error.errors[0].message === "primary-before-hanging-cancel" &&
    /not synchronous and bounded/.test(error.errors[1].message));
  assert.equal(hangingCancel.events.at(-1), "cleanup-finish",
    "an asynchronous deadline cancellation cannot hang or replace cleanup");
}
for (const kind of ["authority", "dropper"]) {
  const orderedBoundary = boundary({ early: kind });
  await assert.doesNotReject(runM7P4PhaseASupervisorForTest(orderedBoundary),
    `${kind} exit callback may precede the result-pipe EOF callback`);
  assert.ok(orderedBoundary.events.indexOf("children-reaped") <
    orderedBoundary.events.indexOf("cleanup-finish"));
}
{
  const stalled = boundary();
  stalled.readResult = (_handle, signal) => ({ async *[Symbol.asyncIterator]() {
    await rejectOnAbort(signal);
  } });
  await assert.rejects(runM7P4PhaseASupervisorForTest(stalled), /result-eof exceeded/);
  assert.ok(stalled.events.indexOf("children-reaped") < stalled.events.indexOf("cleanup-finish"));
  const afterCleanup = stalled.events.length;
  await new Promise(resolveWait => setTimeout(resolveWait, 10));
  assert.equal(stalled.events.length, afterCleanup, "no loser remains active after cleanup");
}
{
  const trailing = boundary();
  trailing.readResult = () => ({ async *[Symbol.asyncIterator]() {
    yield frame; yield frame;
  } });
  await assert.rejects(runM7P4PhaseASupervisorForTest(trailing), /frame count/);
  assert.ok(trailing.events.indexOf("children-reaped") < trailing.events.indexOf("cleanup-finish"));
}
{
  const heldOpen = boundary();
  heldOpen.readResult = (_handle, signal) => ({ async *[Symbol.asyncIterator]() {
    yield frame; await rejectOnAbort(signal);
  } });
  await assert.rejects(runM7P4PhaseASupervisorForTest(heldOpen), /result-eof exceeded/);
  assert.ok(heldOpen.events.indexOf("children-reaped") <
    heldOpen.events.indexOf("cleanup-finish"));
}
{
  const neverReaps = boundary();
  neverReaps.terminateAndReap = async ({ signal }) => rejectOnAbort(signal);
  await assert.rejects(runM7P4PhaseASupervisorForTest(neverReaps), /child-reap exceeded/);
  assert.equal(neverReaps.events.at(-1), "cleanup-finish");
  assert.ok(neverReaps.events.includes("deadline-cancel-child-reap"));
}
{
  const uncooperative = boundary(); const started = Date.now();
  uncooperative.recomputePhaseASelection = () => new Promise(() => {});
  await assert.rejects(runM7P4PhaseASupervisorForTest(uncooperative), /phase-a-selection exceeded/);
  assert.ok(Date.now() - started < 500, "a signal-ignoring loser must be detached after escalation");
  assert.ok(uncooperative.events.includes("force-owned-phase-a-selection-0"));
  assert.ok(uncooperative.events.includes("cleanup-finish"), "CLEANUP_RAN");
}
for (const childKind of ["authority", "dropper"]) {
  const partial = boundary(); let reaped = [];
  partial.terminateAndReap = async ({ resources }) => { reaped = resources; partial.events.push("children-reaped"); };
  if (childKind === "authority") {
    partial.createAuthority = () => "authority-side-effect";
    partial.startAuthority = () => new Promise(() => {});
  } else {
    partial.createDropper = () => "dropper-side-effect";
    partial.startDropper = () => Promise.reject(new Error("dropper rejected after side effect"));
  }
  await assert.rejects(runM7P4PhaseASupervisorForTest(partial), childKind === "authority" ?
    /authority-ready exceeded/ : /dropper rejected after side effect/);
  assert.ok(reaped.includes(`${childKind}-side-effect`), `${childKind} partial child was reaped`);
  assert.ok(partial.events.includes("cleanup-finish"), "CLEANUP_RAN");
}
for (const childKind of ["authority", "dropper"]) {
  for (const [kind, makeFactory, expected] of [
    ["async", invoked => async () => { invoked.count += 1; return `${childKind}-late`; },
      /must synchronously return a handle/],
    ["null", invoked => () => { invoked.count += 1; return null; },
      /did not synchronously return a handle/],
    ["throwing", invoked => () => { invoked.count += 1; throw new Error(`${childKind}-factory-failure`); },
      new RegExp(`${childKind}-factory-failure`)],
  ]) {
    const malformed = boundary(); const invoked = { count: 0 };
    if (childKind === "authority") malformed.createAuthority = makeFactory(invoked);
    else malformed.createDropper = makeFactory(invoked);
    await assert.rejects(runM7P4PhaseASupervisorForTest(malformed), expected,
      `${childKind} ${kind} factory fails closed`);
    assert.equal(invoked.count, kind === "async" ? 0 : 1,
      `${childKind} ${kind} factory has no unregistered asynchronous side effect`);
    assert.ok(!malformed.events.includes(childKind === "authority" ? "dropper-spawn" : "result-read"),
      `${childKind} ${kind} factory prevents the next authority stage`);
    const ownedCount = childKind === "authority" ? 0 : 1;
    const forced = `force-owned-terminal-failure-${ownedCount}`;
    assert.equal(malformed.events.filter(event => event === forced).length, 1,
      `${childKind} ${kind} factory forces exactly its owned resource count`);
    assert.equal(malformed.events.filter(event => event === "cleanup-finish").length, 1);
    assert.equal(malformed.events.at(-1), "cleanup-finish",
      `${childKind} ${kind} factory always completes cleanup last`);
    if (childKind === "dropper") {
      assert.ok(malformed.events.indexOf(forced) < malformed.events.indexOf("children-reaped") &&
        malformed.events.indexOf("children-reaped") < malformed.events.indexOf("cleanup-finish"),
      `${childKind} ${kind} factory reaps the authority before final cleanup`);
    }
  }
}
{
  const doubleFailure = boundary();
  doubleFailure.terminateAndReap = async () => { throw new Error("reap-failure"); };
  doubleFailure.cleanupFinish = async () => { doubleFailure.events.push("cleanup-finish");
    throw new Error("cleanup-failure"); };
  await assert.rejects(runM7P4PhaseASupervisorForTest(doubleFailure), error =>
    error instanceof AggregateError && error.errors.length === 2 &&
    error.errors[0].message === "reap-failure" && error.errors[1].message === "cleanup-failure");
  assert.equal(doubleFailure.events.at(-1), "cleanup-finish");
}

function waitChild(child, abortSignal = null) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolveExit, rejectExit) => {
    const aborted = () => { cleanup(); rejectExit(new Error("child wait aborted")); };
    const failed = error => { cleanup(); rejectExit(error); };
    const exited = (code, signal) => { cleanup(); resolveExit({ code, signal }); };
    const cleanup = () => {
      child.off("error", failed); child.off("exit", exited);
      abortSignal?.removeEventListener("abort", aborted);
    };
    child.once("error", failed); child.once("exit", exited);
    abortSignal?.addEventListener("abort", aborted, { once: true });
    if (abortSignal?.aborted) aborted();
  });
}
function realProcessBoundary({ stall = false, readyStall = false } = {}) {
  const value = boundary(); let authorityChild = null; let dropperChild = null;
  value.createAuthority = spec => {
    value.events.push("authority-spawn-real");
    const source = readyStall ? "setInterval(()=>{},1000)" :
      `require('fs').writeSync(3,Buffer.from('${readyBytes.toString("base64")}',` +
      `'base64'));setTimeout(()=>process.exit(0),5)`;
    authorityChild = spawn(process.execPath, ["-e", source],
      { stdio: ["ignore", "ignore", "ignore", "pipe"], env: { HOME: "/var/empty", LANG: "C", LC_ALL: "C",
        PATH: "/var/empty", TZ: "UTC" } });
    return authorityChild;
  };
  value.startAuthority = async () => {};
  value.readAuthorityReady = async (_socket, signal) => {
    const chunks = [];
    const aborted = () => authorityChild.stdio[3].destroy(new Error("READY read aborted"));
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    try {
    for await (const chunk of authorityChild.stdio[3]) chunks.push(chunk);
    return Buffer.concat(chunks);
    } finally { signal.removeEventListener("abort", aborted); }
  };
  value.createDropper = spec => {
    value.events.push("dropper-spawn-real");
    const source = stall ? "setInterval(()=>{},1000)" :
      `setTimeout(()=>{require('fs').writeSync(3,Buffer.from('${frame.toString("base64")}',` +
      `'base64'));process.exit(0)},30)`;
    dropperChild = spawn(process.execPath, ["-e", source], { stdio: ["ignore", "ignore", "ignore", "pipe"],
      env: { HOME: "/var/empty", LANG: "C", LC_ALL: "C", PATH: "/var/empty", TZ: "UTC" } });
    return dropperChild;
  };
  value.startDropper = async () => {};
  value.readResult = (_handle, signal) => ({ async *[Symbol.asyncIterator]() {
    const aborted = () => dropperChild.stdio[3].destroy(new Error("result read aborted"));
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
    try {
    for await (const chunk of dropperChild.stdio[3]) yield chunk;
    value.events.push("real-result-eof");
    } finally { signal.removeEventListener("abort", aborted); }
  } });
  value.closeResultWriter = async () => value.events.push("real-parent-writer-closed");
  value.waitAuthority = waitChild;
  value.waitDropper = waitChild;
  value.deadline = label => {
    let timer; const promise = new Promise(resolveDeadline => {
      timer = setTimeout(resolveDeadline, 250);
    });
    return { promise, cancel: () => { clearTimeout(timer);
      value.events.push(`real-deadline-cancel-${label}`); } };
  };
  value.forceTerminateOwned = ({ resources }) => {
    for (const child of resources) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    value.events.push("real-force-owned");
  };
  value.terminateAndReap = async ({ authority, dropper, signal }) => {
    assert.equal(signal instanceof AbortSignal, true);
    for (const child of [authority, dropper]) {
      if (child !== null && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    await Promise.all([authority, dropper].filter(Boolean).map(child => waitChild(child)));
    value.events.push("real-children-reaped");
  };
  return value;
}
{
  const real = realProcessBoundary();
  await assert.doesNotReject(runM7P4PhaseASupervisorForTest(real));
  assert.ok(real.events.indexOf("real-result-eof") >= 0);
  assert.ok(real.events.indexOf("real-children-reaped") < real.events.indexOf("cleanup-finish"));
}
{
  const realStall = realProcessBoundary({ stall: true });
  await assert.rejects(runM7P4PhaseASupervisorForTest(realStall), /result-eof exceeded/);
  assert.ok(realStall.events.indexOf("real-children-reaped") <
    realStall.events.indexOf("cleanup-finish"));
}
{
  const realReadyStall = realProcessBoundary({ readyStall: true });
  await assert.rejects(runM7P4PhaseASupervisorForTest(realReadyStall),
    /authority-ready exceeded/);
  assert.ok(!realReadyStall.events.includes("dropper-spawn-real"));
  assert.ok(realReadyStall.events.indexOf("real-children-reaped") <
    realReadyStall.events.indexOf("cleanup-finish"));
  assert.ok(realReadyStall.events.includes("real-deadline-cancel-authority-ready"));
}

console.log("M7 P4 Phase-A supervisor core synthetic matrices passed");
