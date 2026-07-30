import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createM4BlockRangeService } from
  "../cadr-web/wasm/cadr-m4-block-service.mjs";
import { m6BenchmarkSchedulerResidue, runExactCanaryLoop } from
  "../scripts/run-cadr-m6-devid-o2-canary-stage.mjs";
import { attestBenchmarkCandidate, removeM6BenchmarkSourceStage } from
  "../scripts/collect-cadr-m6-ready4-benchmark.mjs";
import { canonicalJson, sha256Hex } from "../scripts/cadr-m6-ready4-evidence.mjs";
import { ready4SourceClosure, stageM6ExecutableClosure,
  validateStagedM6ExecutableClosure } from
  "../scripts/cadr-m6-wasm-identity.mjs";
import { executeReady4Campaign, parseReady4CampaignArguments } from
  "../scripts/run-cadr-m6-ready4-campaign.mjs";
import { assertBenchmarkMatchesReady4Wasm, checkedProjectedSeconds,
  parseReady4SystemdArguments,
  ready4ObservationSeconds, removeReady4Stage, systemdReady4Command,
  validateReady4SystemdAccounting, validateReady4SystemdPolicy } from
  "../scripts/run-cadr-m6-ready4-systemd.mjs";
import { compareM6FastBenchmark, parseBenchmarkArguments,
  validateBenchmarkRun, validateM6FastBenchmark } from
  "../scripts/benchmark-cadr-m6-ready4-fast.mjs";

assert.throws(() => parseReady4CampaignArguments([]), /inert without --execute/);
assert.throws(() => parseReady4SystemdArguments([]), /inert without --execute/);
assert.throws(() => parseReady4SystemdArguments([
  "--execute", "--artifact-root", ".", "--output", "run.json",
  "--benchmark", "benchmark.json", "--wasm", "arbitrary.wasm",
]), /unsupported/,
"the production wrapper has no arbitrary-Wasm labeling option");
assert.throws(() => checkedProjectedSeconds(43201), /86400/);
assert.equal(ready4ObservationSeconds(3600), 7500,
  "observation deadline is runtime cap plus a bounded five-percent margin");
assert.throws(() => parseBenchmarkArguments([]), /inert without --execute/);
{
  const stage = await mkdtemp(resolve(tmpdir(), "m6-ready4-protected-stage-"));
  const artifacts = resolve(stage, "artifacts");
  await mkdir(resolve(artifacts, "cadr-web/profiles"), {
    recursive: true, mode: 0o700,
  });
  await writeFile(resolve(artifacts, "cadr-web/profiles/profile.json"), "{}",
    { mode: 0o400 });
  await chmod(artifacts, 0o500);
  await removeReady4Stage(stage);
  await assert.rejects(lstat(stage), error => error?.code === "ENOENT",
    "READY4 cleanup removes a protected artifact tree");
}
{
  const semantic = {
    lifecycle: "PAUSED", hidden: false, visibilityInitialized: true,
    snapshotVisibilityInitialized: false, controlOrdinal: 3n,
    controlBoundary: 4096n,
    controlWitness: new Uint8Array([1, 2, 3]).buffer,
    runActive: false, deferredControlCount: 0,
    pendingBoundaryDigest: false, mediaBusy: false, mediaDirty: false,
    mediaSnapshotBlocked: false, mediaOverlayGeneration: 1n,
    lastCompleteBoundary: 4095n,
    queueDigest: new Uint8Array([4, 5, 6]).buffer,
    coreStateDigest: new Uint8Array([7, 8, 9]).buffer,
  };
  const schedulerResponse = (id, fields = {}) => ({
    type: "cadr-response", version: 4, id, op: "scheduler-state",
    status: 0, ok: true, ...semantic, ...fields,
  });
  const baseline = m6BenchmarkSchedulerResidue(schedulerResponse(17));
  assert.deepEqual(
    baseline,
    m6BenchmarkSchedulerResidue(schedulerResponse(9001)),
    "transport correlation ordinals do not make scheduler state unequal");
  assert.deepEqual(Object.keys(baseline).sort(), Object.keys(semantic).sort(),
    "normalization removes exactly the six fixed envelope fields");
  const mutations = {
    lifecycle: "FAILED", hidden: true, visibilityInitialized: false,
    snapshotVisibilityInitialized: true, controlOrdinal: 4n,
    controlBoundary: 4097n,
    controlWitness: new Uint8Array([1, 2, 4]).buffer,
    runActive: true, deferredControlCount: 1,
    pendingBoundaryDigest: true, mediaBusy: true, mediaDirty: true,
    mediaSnapshotBlocked: true, mediaOverlayGeneration: 2n,
    lastCompleteBoundary: 4094n,
    queueDigest: new Uint8Array([4, 5, 7]).buffer,
    coreStateDigest: new Uint8Array([7, 8, 10]).buffer,
  };
  for (const [field, value] of Object.entries(mutations)) {
    assert.notEqual(canonicalJson(baseline), canonicalJson(
      m6BenchmarkSchedulerResidue(schedulerResponse(17, { [field]: value }))),
    `${field} remains part of the semantic scheduler residue`);
  }
  assert.equal(m6BenchmarkSchedulerResidue(schedulerResponse(
    17, { futurePayloadField: "retained" })).futurePayloadField, "retained",
  "unknown future scheduler payload fields fail comparison conservatively");
  const malformed = [
    { type: undefined }, { type: "wrong" }, { version: 5 }, { id: undefined },
    { id: 0 }, { id: 1.5 }, { id: Number.MAX_SAFE_INTEGER + 1 },
    { op: "machine-info" }, { status: 1 }, { ok: false }, { ok: undefined },
  ];
  for (const fields of malformed) {
    assert.throws(() => m6BenchmarkSchedulerResidue({
      ...schedulerResponse(17), ...fields,
    }), /envelope/, "only a validated scheduler-state envelope is normalized");
  }
}
{
  const parent = await mkdtemp(resolve(tmpdir(), "m6-protected-stage-"));
  const source = resolve(parent, "source");
  const identities = resolve(source, ".m6-build-identities");
  await mkdir(identities, { recursive: true, mode: 0o700 });
  await writeFile(resolve(identities, "O0.json"), "immutable\n", {
    mode: 0o400,
  });
  await chmod(identities, 0o500);
  await removeM6BenchmarkSourceStage(parent, identities);
  await assert.rejects(() => lstat(parent), error => error?.code === "ENOENT",
    "protected identity directories are made removable after unit collection");
}
{
  const repository = await mkdtemp(resolve(tmpdir(), "m6-closure-repo-"));
  const stage = resolve(repository, "stage-outside-repository");
  const source = resolve(repository, "source");
  await mkdir(source);
  execFileSync("git", ["init", "-q"], { cwd: source });
  execFileSync("git", ["config", "user.name", "M6 test"], { cwd: source });
  execFileSync("git", ["config", "user.email", "m6@example.invalid"],
    { cwd: source });
  await writeFile(resolve(source, "runner.mjs"), "export const value = 1;\n");
  execFileSync("git", ["add", "runner.mjs"], { cwd: source });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: source });
  await writeFile(resolve(source, "runner.mjs"), "export const value = 2;\n");
  await assert.rejects(() => ready4SourceClosure(
    source, null, ["runner.mjs"]), /differs from commit/,
  "a pre-stage executable edit fails closed");
  await writeFile(resolve(source, "runner.mjs"), "export const value = 1;\n");
  const closure = await stageM6ExecutableClosure(
    source, stage, ["runner.mjs"]);
  await writeFile(resolve(stage, "runner.mjs"), "export const value = 3;\n");
  await assert.rejects(() =>
    validateStagedM6ExecutableClosure(stage, closure), /digest changed/,
  "a staged executable race fails before launch");
  await rm(repository, { recursive: true, force: true });
}
{
  const collector = resolve(dirname(fileURLToPath(import.meta.url)),
    "../scripts/collect-cadr-m6-ready4-benchmark.mjs");
  const help = execFileSync(process.execPath, [collector, "--help"], {
    encoding: "utf8",
  });
  assert.match(help, /--artifact-root ROOT --output-dir DIR/);
  const source = await readFile(collector, "utf8");
  assert.match(source, /systemdReady4Command/);
  assert.doesNotMatch(source, /\bcollectFinalIdentities\b|\brun:\s*async\b/,
    "production collector has no injectable final-identity shell");
  const directChild = spawnSync(process.execPath, [
    collector, "--execute", "--systemd-child", "--artifact-root", process.cwd(),
    "--candidate", "fast-o2", "--private-root", process.cwd(),
    "--envelope", resolve(process.cwd(), "private.json"),
    "--wasm", resolve(process.cwd(), "fake.wasm"),
    "--wasm-identity", resolve(process.cwd(), "fake-identity.json"),
    "--invocation-nonce-file", resolve(process.cwd(), "missing.nonce"),
  ], { encoding: "utf8", env: { M6_READY4_SYSTEMD_CHILD: "1" } });
  assert.notEqual(directChild.status, 0);
  assert.match(directChild.stderr, /invocation nonce|ENOENT/,
    "the environment marker cannot authorize a benchmark child");
}

const command = systemdReady4Command(["runner", "--execute"], 3600, "ab".repeat(16), "/stage");
for (const property of [
  "--property=RuntimeMaxSec=7200s", "--property=MemoryMax=3221225472",
  "--property=MemorySwapMax=0", "--property=CPUQuota=200%", "--property=TasksMax=128",
  "--property=UMask=0077", "--property=PrivateNetwork=yes",
  "--property=RestrictAddressFamilies=AF_UNIX AF_INET", "--property=ReadOnlyPaths=/stage",
  "--property=MemoryAccounting=yes", "--property=TasksAccounting=yes",
  "--property=IOAccounting=yes", "--property=IPAccounting=yes",
]) assert.ok(command.args.includes(property), property);
assert.throws(() => validateReady4SystemdPolicy({}, 3600), /differs/);
assert.equal(validateReady4SystemdPolicy({
  RuntimeMaxUSec: "7200s", TimeoutStopUSec: "30s", MemoryMax: "3221225472",
  MemorySwapMax: "0", CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
  NoNewPrivileges: "yes", PrivateNetwork: "yes", RestrictAddressFamilies: "AF_INET AF_UNIX",
  KillMode: "control-group", ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes",
}, 3600).RuntimeMaxUSec, "7200s");
assert.equal(validateReady4SystemdPolicy({
  RuntimeMaxUSec: "7200s", TimeoutStopUSec: "30s", MemoryMax: "3221225472",
  MemorySwapMax: "0", CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
  NoNewPrivileges: "yes", PrivateNetwork: "yes",
  RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
  ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes", ReadOnlyPaths: "/stage",
  ReadWritePaths: "/stage/private",
  Environment: "M6_READY4_SYSTEMD_CHILD=1 UMASK=0077",
}, 3600, "/stage", "/stage/private").ReadWritePaths, "/stage/private");
assert.equal(validateReady4SystemdAccounting({
  MemoryPeak: "830337024", CPUUsageNSec: "434323130000",
  TasksCurrent: "[not set]", IOReadBytes: "[not set]",
  IOWriteBytes: "0", IPIngressBytes: "[no data]", IPEgressBytes: "[no data]",
}).MemoryPeak, "830337024");
assert.throws(() => validateReady4SystemdAccounting({
  MemoryPeak: "", CPUUsageNSec: "1", TasksCurrent: "0",
  IOReadBytes: "0", IOWriteBytes: "0", IPIngressBytes: "0", IPEgressBytes: "0",
}), /unavailable/);

const digest = "ab".repeat(32);
const summaryBytes = new Uint8Array(512); {
  const view = new DataView(summaryBytes.buffer); summaryBytes.set(new TextEncoder().encode("CDRM6E1"));
  view.setUint32(8, 1, true); view.setUint32(12, 512, true); view.setUint32(16, 1, true);
  view.setUint32(20, 1, true); view.setUint32(24, 512, true); view.setUint32(28, 512, true);
  view.setBigUint64(32, 0x7fffffffffffffffn, true); view.setBigUint64(40, 513n, true);
  view.setBigUint64(48, 1n, true); view.setBigUint64(56, 512n, true); view.setBigUint64(64, 512n, true);
  view.setUint32(84, 1, true); view.setBigUint64(88, 513n, true); summaryBytes.fill(1, 240, 304);
}
const summaryHex = Buffer.from(summaryBytes).toString("hex");
function run(index) {
  return Object.freeze({ schema: "cadr-m6-ready4-fast-run-v1", outcome: "ready4",
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1", contract: "C-M6-DISK-EVIDENCE-READY4-BINDING-v1",
    session_id: `m6-ready4-session-${index.toString(16).padStart(32, "0")}`,
    private_disk_instance_id: `m6-ready4-private-disk-${(index + 10).toString(16).padStart(32, "0")}`,
    boundary: "983990278", checkpoint_count: 4, selected_maximum: "9223372036854775807",
    cdrstate5_sha256: digest, cdrm5q1_sha256: digest, checkpoint_chain_sha256: digest,
    cdrm6e1_hex: summaryHex, cdrm6e1_sha256: sha256Hex(summaryBytes),
    ready3_witness_sha256: digest, ready4_witness_sha256: digest,
    wasm_byte_count: "123456", wasm_optimization: "O2",
    wasm_profile: "M6-DEVID1-O2", wasm_sha256: digest,
    source_closure_sha256: digest, source_commit: "ab".repeat(20) });
}
function supervised(index) {
  return Object.freeze({ schema: "cadr-m6-ready4-supervised-run-v1",
    outcome: "ready4-supervised", run: run(index), accounting_sha256: digest,
    policy_sha256: digest, benchmark_sha256: digest,
    projected_seconds: 3600, runtime_max_seconds: 7200,
    observation_deadline_seconds: 7500,
    transient_unit_absent: true, staged_root_removed: true });
}
const root = await mkdtemp(resolve(tmpdir(), "cadr-m6-ready4-campaign-"));
const campaignOptions = Object.freeze({ execute: true, artifactRoot: root, outputDir: root,
  releaseRecord: null, benchmark: resolve(root, "benchmark.json") });
let child = 0;
const result = await executeReady4Campaign(campaignOptions, { run: async (_command, args) => {
  const output = args[args.indexOf("--output") + 1];
  assert.match(args[0], /run-cadr-m6-ready4-systemd\.mjs$/,
    "campaign may invoke only the systemd supervisor");
  await writeFile(output, canonicalJson(supervised(child++)), { mode: 0o600 });
  return { code: 0, signal: null, error: null };
} });
assert.equal(child, 3, "campaign creates exactly three sequential children");
assert.equal(JSON.parse(await readFile(result.campaign, "utf8")).runs.length, 3);

function benchmark(candidate, elapsedNanoseconds = "45200000000") {
  const optimization = candidate === "fast-o2" ? "O2" : "O0";
  const run = Object.freeze({ schema: "cadr-m6-fast-benchmark-child-v1", candidate,
    completed_boundary: "1130000", elapsed_nanoseconds: elapsedNanoseconds,
    cdrstate5_sha256: digest, cdrm5q1_sha256: digest, host_transcript_sha256: digest,
    cdrm6e1_sha256: digest, overlay_sha256: digest, base_disk_sha256: digest,
    residue_sha256: digest, input_schedule_sha256: digest,
    release_record_sha256: digest, invocation_nonce_sha256: digest,
    wasm_byte_count: "123456", wasm_optimization: optimization,
    wasm_profile: optimization === "O2" ? "M6-DEVID1-O2" : "M6-DEVID1-O0",
    wasm_sha256: digest,
    source_closure_sha256: digest, source_commit: "ab".repeat(20) });
  return Object.freeze({
    schema: "cadr-m6-fast-benchmark-attested-run-v1",
    outcome: "systemd-attested", run,
    accounting_sha256: digest, policy_sha256: digest,
    invocation_sha256: digest, transient_unit_absent: true,
    private_root_removed: true, source_stage_removed: true,
  });
}
{
  const nonce = Buffer.alloc(32, 11);
  const fakeCommand = systemdReady4Command(
    ["staged-collector", "--systemd-child", "--envelope", "/private/result",
      "--invocation-nonce-file", "/stage/nonce"],
    7200, "cd".repeat(16),
    "/stage", "/private");
  const fakeShow = {
    RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
    MemoryMax: "3221225472", MemorySwapMax: "0",
    CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
    NoNewPrivileges: "yes", PrivateNetwork: "yes",
    RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
    ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
    RemainAfterExit: "yes", MemoryAccounting: "yes",
    TasksAccounting: "yes", IOAccounting: "yes", IPAccounting: "yes",
    ReadOnlyPaths: "/stage", ReadWritePaths: "/private",
    Environment: "M6_READY4_SYSTEMD_CHILD=1 UMASK=0077",
    MemoryPeak: "1", CPUUsageNSec: "2", TasksCurrent: "[not set]",
    IOReadBytes: "0", IOWriteBytes: "0", IPIngressBytes: "[no data]",
    IPEgressBytes: "[no data]",
    Id: fakeCommand.unit, InvocationID: "ef".repeat(16),
    ExecStart: `${process.execPath} staged-collector --systemd-child --envelope /private/result --invocation-nonce-file /stage/nonce`,
  };
  const raw = {
    ...benchmark("fast-o2").run,
    invocation_nonce_sha256: sha256Hex(nonce),
  };
  const attested = attestBenchmarkCandidate({
    childRun: raw, candidate: "fast-o2", identity: {
      wasm_sha256: digest, wasm_byte_count: "123456",
      wasm_optimization: "O2", wasm_profile: "M6-DEVID1-O2",
      source_closure_sha256: digest, source_commit: "ab".repeat(20),
    }, command: fakeCommand, nonce, systemdShow: fakeShow,
    projectedSeconds: 7200, readOnlyRoot: "/stage",
    readWriteRoot: "/private", unitAbsent: true, privateRootRemoved: true,
  });
  assert.match(attested.invocation_sha256, /^[0-9a-f]{64}$/,
    "the audited fake-systemd seam exercises outer invocation attestation");
  assert.throws(() => attestBenchmarkCandidate({
    childRun: raw, candidate: "fast-o2", identity: {
      wasm_sha256: digest, wasm_byte_count: "123456",
      wasm_optimization: "O2", wasm_profile: "M6-DEVID1-O2",
      source_closure_sha256: digest, source_commit: "ab".repeat(20),
    }, command: fakeCommand, nonce, systemdShow: fakeShow,
    projectedSeconds: 7200, readOnlyRoot: "/stage",
    readWriteRoot: "/private", unitAbsent: false, privateRootRemoved: true,
  }), /not bound/, "outer attestation refuses unverified unit cleanup");
}
const compared = compareM6FastBenchmark([
  benchmark("legacy-m5"), benchmark("fast-o0"), benchmark("fast-o2"),
]);
assert.throws(() => validateBenchmarkRun(benchmark("fast-o2").run),
  /outer-attested|missing or unknown/,
"a valid-looking raw child record is never benchmark authority");
assert.equal(compared.fast_o2_slots_per_second, "25000");
assert.equal(compared.fast_o2_wasm_byte_count, "123456");
assert.equal(compared.fast_o2_source_commit, "ab".repeat(20));
assert.equal(compared.input_schedule_sha256, digest);
assert.equal(compared.release_record_sha256, digest);
const currentIdentity = {
  wasm_byte_count: "123456", wasm_optimization: "O2",
  wasm_profile: "M6-DEVID1-O2", wasm_sha256: digest,
  source_closure_sha256: digest, source_commit: "ab".repeat(20),
};
assert.equal(assertBenchmarkMatchesReady4Wasm(
  compared, currentIdentity, {
    input_schedule_sha256: digest, release_record_sha256: digest,
  }).fast_o2_wasm_sha256, digest);
assert.throws(() => assertBenchmarkMatchesReady4Wasm(compared, {
  ...currentIdentity, wasm_sha256: "cd".repeat(32),
}, { input_schedule_sha256: digest, release_record_sha256: digest }),
/differs/, "a current arbitrary or rebuilt O2 module cannot reuse old timing");
assert.throws(() => assertBenchmarkMatchesReady4Wasm(
  compared, currentIdentity, {
    input_schedule_sha256: "cd".repeat(32), release_record_sha256: digest,
  }), /release record|input schedule/,
"an edited current schedule cannot reuse a benchmark");
assert.throws(() => validateM6FastBenchmark({
  ...compared, ready4_projected_seconds: "1",
}), /projection/, "systemd cannot consume a caller-edited projection");
assert.throws(() => compareM6FastBenchmark([
  benchmark("legacy-m5"), benchmark("fast-o0"), {
    ...benchmark("fast-o2"),
    run: { ...benchmark("fast-o2").run, cdrm6e1_sha256: "cd".repeat(32) },
  },
]), /disagree|identity-equivalent/);
assert.throws(() => compareM6FastBenchmark([
  benchmark("legacy-m5"), benchmark("fast-o0"), {
    ...benchmark("fast-o2"),
    run: { ...benchmark("fast-o2").run, residue_sha256: "cd".repeat(32) },
  },
]), /disagree|identity-equivalent/,
"the strict comparator rejects semantic residue differences");
class SyntheticClient {
  constructor(worker) {
    this.worker = worker; this.id = 1; this.pending = new Map();
    worker.on("message", message => {
      const pending = this.pending.get(message.id);
      assert.notEqual(pending, undefined);
      this.pending.delete(message.id); pending.resolve(message);
    });
    worker.on("error", error => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }
  request(op, fields = {}) {
    const id = this.id++;
    return new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
      this.worker.postMessage({ version: 4, id, op, ...fields });
    });
  }
  close() { return this.worker.terminate(); }
}

for (const candidate of ["legacy-m5", "fast-o0", "fast-o2"]) {
  const fixture = resolve(dirname(fileURLToPath(import.meta.url)),
    "fixtures/cadr-m6-benchmark-synthetic-worker.mjs");
  const client = new SyntheticClient(new Worker(pathToFileURL(fixture), {
    type: "module",
  }));
  const disk = new Uint8Array(2048).map((_, index) => index & 255);
  const service = createM4BlockRangeService({
    imageByteCount: BigInt(disk.byteLength),
    expectedImageByteCount: BigInt(disk.byteLength),
    readRange: async (offset, count) =>
      disk.slice(Number(offset), Number(offset + count)),
  });
  try {
    const events = [];
    const loop = await runExactCanaryLoop(
      client, service, 4n, candidate, event => events.push(event));
    assert.equal(loop.info.clockSlotsCompleted, 4n);
    assert.equal(loop.hostTransactions, 1);
    assert.equal(events.some(event => event.requestSeen), true);
    assert.equal(events.some(event => event.completionDelivered), true,
      `${candidate} exercises the real block service rather than fabricated final values`);
  } finally {
    await client.close();
    await service.discard();
  }
}
await rm(root, { recursive: true, force: true });
console.log("cadr M6 READY4 campaign, systemd, and benchmark guards passed");
