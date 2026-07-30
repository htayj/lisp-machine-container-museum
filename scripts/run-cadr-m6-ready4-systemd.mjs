#!/usr/bin/env node
/* Systemd boundary for one READY4 worker.  The outer process owns a read-only
 * staged copy of all selected inputs and removes it only after the transient
 * unit has stopped and its accounting/policy were recorded. */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, rm, writeFile }
  from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canonicalJson, M6_READY4_SUPERVISED_RUN_SCHEMA, readRegularCanonical,
  sha256Hex, validateReady4Run } from "./cadr-m6-ready4-evidence.mjs";
import { writeCanonicalNoReplace } from "./aggregate-cadr-m6-ready4-campaign.mjs";
import { createM6WasmIdentityFromClosure, stageM6ExecutableClosure,
  validateStagedM6ExecutableClosure } from
  "./cadr-m6-wasm-identity.mjs";
import { releaseRecordBenchmarkIdentity, validateM6FastBenchmark } from
  "./benchmark-cadr-m6-ready4-fast.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRECT = resolve(ROOT, "scripts/run-cadr-m6-ready4-fast.mjs");
const SOURCES = Object.freeze([
  "cadr-web/profiles/cadr-web-303.ini.in", "l/sys/ubin/promh.mcr",
  "l/sys/ubin/promh.sym", "l/sys/ubin/ucadr.sym", "l/usim/disk-sys-303-0.img",
]);
const UNIT_PREFIX = "cadr-m6-ready4-";

function usage() {
  return "usage: node scripts/run-cadr-m6-ready4-systemd.mjs --execute --artifact-root ROOT --output RUN.json --benchmark BENCHMARK.json [--release-record PATH]";
}

function capture(command, args) {
  return new Promise(resolveRun => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const output = []; const error = [];
    child.stdout.on("data", value => output.push(value)); child.stderr.on("data", value => error.push(value));
    child.once("error", failure => resolveRun({ code: null, signal: null, failure, stdout: Buffer.concat(output), stderr: Buffer.concat(error) }));
    child.once("exit", (code, signal) => resolveRun({ code, signal, failure: null, stdout: Buffer.concat(output), stderr: Buffer.concat(error) }));
  });
}

function pathValue(value, option) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a pathname`);
  return resolve(process.cwd(), value);
}

export function checkedProjectedSeconds(value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value * 2 > 86400) {
    throw new RangeError("READY4 projection must be positive and permit a worker runtime at most 86400 seconds");
  }
  return value;
}

export function parseReady4SystemdArguments(argv) {
  const result = { execute: false, artifactRoot: null, output: null,
    benchmark: null,
    releaseRecord: resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json"),
    wasm: resolve(ROOT, "cadr-web/build/cadr-web-m6-devid-O2.wasm") };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") { if (result.execute) throw new TypeError("duplicate --execute"); result.execute = true; }
    else if (["--artifact-root", "--output", "--release-record",
      "--benchmark"].includes(option)) {
      const key = option.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      if (result[key] !== null && !["releaseRecord", "wasm"].includes(key)) throw new TypeError(`duplicate ${option}`);
      result[key] = pathValue(argv[++index], option);
    } else throw new TypeError(`unsupported READY4 systemd argument ${JSON.stringify(option)}`);
  }
  if (!result.execute || result.artifactRoot === null || result.output === null ||
      result.benchmark === null) {
    throw new TypeError(`${usage()}\nThe systemd READY4 worker is inert without --execute.`);
  }
  return Object.freeze(result);
}

export function systemdReady4Command(childArguments, projectedSeconds,
  nonce = randomBytes(16).toString("hex"), readOnlyRoot = null,
  readWriteRoot = null) {
  checkedProjectedSeconds(projectedSeconds);
  if (!/^[0-9a-f]{32}$/.test(nonce) || !Array.isArray(childArguments) ||
      childArguments.some(value => typeof value !== "string")) throw new TypeError("invalid READY4 systemd command");
  const unit = `${UNIT_PREFIX}${nonce}.service`;
  const args = ["--user", "--no-block", "--service-type=exec", `--unit=${unit}`,
    `--property=RuntimeMaxSec=${projectedSeconds * 2}s`, "--property=TimeoutStopSec=30s",
    "--property=MemoryMax=3221225472", "--property=MemorySwapMax=0",
    "--property=CPUQuota=200%", "--property=TasksMax=128", "--property=UMask=0077",
    "--property=NoNewPrivileges=yes", "--property=PrivateNetwork=yes",
    "--property=RestrictAddressFamilies=AF_UNIX AF_INET", "--property=KillMode=control-group",
    "--property=ExitType=cgroup", "--property=Restart=no", "--property=OOMPolicy=kill",
    "--property=RemainAfterExit=yes", "--property=MemoryAccounting=yes",
    "--property=TasksAccounting=yes", "--property=IOAccounting=yes", "--property=IPAccounting=yes",
    "--setenv=M6_READY4_SYSTEMD_CHILD=1", "--setenv=UMASK=0077"];
  if (readOnlyRoot !== null) {
    const roots = Array.isArray(readOnlyRoot) ? readOnlyRoot : [readOnlyRoot];
    if (roots.length === 0 || roots.some(root =>
      typeof root !== "string" || root.length === 0)) {
      throw new TypeError("invalid READY4 read-only roots");
    }
    args.push(`--property=ReadOnlyPaths=${roots.join(" ")}`);
  }
  if (readWriteRoot !== null) args.push(`--property=ReadWritePaths=${readWriteRoot}`);
  args.push(process.execPath, ...childArguments);
  return Object.freeze({ command: "systemd-run", unit, args: Object.freeze(args) });
}

export function parseSystemdShow(text) {
  const result = Object.create(null);
  for (const line of text.split("\n")) {
    const index = line.indexOf("=");
    if (index > 0) result[line.slice(0, index)] = line.slice(index + 1);
  }
  return Object.freeze(result);
}

export function validateReady4SystemdPolicy(value, projectedSeconds,
  readOnlyRoot = null, readWriteRoot = null) {
  const runtimeSeconds = checkedProjectedSeconds(projectedSeconds) * 2;
  const acceptedRuntime = new Set([
    `${runtimeSeconds}s`, `${runtimeSeconds * 1000000}`,
    ...(runtimeSeconds % 3600 === 0 ? [`${runtimeSeconds / 3600}h`] : []),
    ...(runtimeSeconds % 60 === 0 ? [`${runtimeSeconds / 60}min`] : []),
  ]);
  const expected = Object.freeze({ TimeoutStopUSec: "30s", MemoryMax: "3221225472", MemorySwapMax: "0",
    CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077", NoNewPrivileges: "yes",
    PrivateNetwork: "yes", RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
    ExitType: "cgroup", Restart: "no", OOMPolicy: "kill", RemainAfterExit: "yes",
    MemoryAccounting: "yes", TasksAccounting: "yes", IOAccounting: "yes", IPAccounting: "yes" });
  if (!acceptedRuntime.has(value?.RuntimeMaxUSec)) {
    throw new Error("READY4 effective systemd policy differs at RuntimeMaxUSec");
  }
  for (const [name, expectedValue] of Object.entries(expected)) {
    if (value?.[name] !== expectedValue) throw new Error(`READY4 effective systemd policy differs at ${name}`);
  }
  if (readOnlyRoot !== null) {
    const expectedRoots = Array.isArray(readOnlyRoot) ?
      readOnlyRoot : [readOnlyRoot];
    const actualRoots = String(value?.ReadOnlyPaths ?? "").split(/\s+/);
    if (!expectedRoots.every(root => actualRoots.includes(root))) {
      throw new Error("READY4 effective systemd policy differs at ReadOnlyPaths");
    }
  }
  if (readWriteRoot !== null &&
      !String(value?.ReadWritePaths ?? "").split(/\s+/).includes(readWriteRoot)) {
    throw new Error("READY4 effective systemd policy differs at ReadWritePaths");
  }
  const environment = String(value?.Environment ?? "");
  if (readOnlyRoot !== null &&
      (!environment.includes("M6_READY4_SYSTEMD_CHILD=1") ||
       !environment.includes("UMASK=0077"))) {
    throw new Error("READY4 effective systemd child environment differs");
  }
  return value;
}

export function validateReady4SystemdAccounting(value) {
  for (const field of ["MemoryPeak", "CPUUsageNSec"]) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(value?.[field] ?? "")) {
      throw new Error(`READY4 systemd accounting is unavailable at ${field}`);
    }
  }
  for (const field of ["TasksCurrent", "IOReadBytes", "IOWriteBytes",
    "IPIngressBytes", "IPEgressBytes"]) {
    if (!/^(?:0|[1-9][0-9]*|\[not set\]|\[no data\])$/.test(
      value?.[field] ?? "")) {
      throw new Error(`READY4 systemd accounting is malformed at ${field}`);
    }
  }
  return value;
}

async function copyRegularNoFollow(source, target) {
  const before = await lstat(source);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("READY4 stage source is not a regular non-symlink");
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await input.stat();
    if (!info.isFile() || info.dev !== before.dev || info.ino !== before.ino ||
        info.size !== before.size) throw new Error("READY4 stage source changed while opening");
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const output = await open(target, "wx", 0o600);
    try {
      const buffer = Buffer.allocUnsafe(1048576); let offset = 0;
      for (;;) { const { bytesRead } = await input.read(buffer, 0, buffer.length, offset); if (bytesRead === 0) break; await output.write(buffer, 0, bytesRead, offset); offset += bytesRead; }
      if (offset !== info.size) throw new Error("READY4 stage source changed during copy");
      await output.sync();
    } finally { await output.close(); }
    await chmod(target, 0o400);
  } finally { await input.close(); }
}

async function stageInputs(options) {
  const root = await mkdtemp(resolve(tmpdir(), "cadr-m6-ready4-stage-"));
  try {
    const sourceRoot = resolve(root, "source");
    const sourceClosure = await stageM6ExecutableClosure(ROOT, sourceRoot);
    for (const relative of SOURCES) await copyRegularNoFollow(resolve(options.artifactRoot, relative), resolve(root, "artifacts", relative));
    await copyRegularNoFollow(options.releaseRecord, resolve(root, "release.json"));
    await mkdir(resolve(root, "private"), { mode: 0o700 });
    return Object.freeze({ root, sourceRoot, sourceClosure,
      artifactRoot: resolve(root, "artifacts"),
      release: resolve(root, "release.json"),
      wasm: resolve(sourceRoot, "cadr-web/build/cadr-web-m6-devid-O2.wasm"),
      identity: resolve(root, "identity.json"),
      nonce: resolve(root, "invocation.nonce"),
      privateRoot: resolve(root, "private"),
      envelope: resolve(root, "private", "result.json") });
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

async function finishStagedBuild(stage) {
    execFileSync("make", ["-C", resolve(stage.sourceRoot, "cadr-web"),
      "build/cadr-web-m6-devid-O2.wasm"], { stdio: "inherit" });
    const wasmIdentity = await createM6WasmIdentityFromClosure(
      stage.sourceRoot, stage.wasm, "O2", stage.sourceClosure);
    await writeCanonicalNoReplace(stage.identity, wasmIdentity);
    await chmod(stage.identity, 0o400);
    await writeFile(stage.nonce, randomBytes(32), { flag: "wx", mode: 0o400 });
    await chmod(resolve(stage.root, "artifacts"), 0o500);
    await validateStagedM6ExecutableClosure(
      stage.sourceRoot, stage.sourceClosure);
    return wasmIdentity;
}

export function ready4ObservationSeconds(projectedSeconds) {
  const runtime = checkedProjectedSeconds(projectedSeconds) * 2;
  const margin = Math.min(300, Math.max(30, Math.ceil(runtime / 20)));
  return runtime + margin;
}

export function assertBenchmarkMatchesReady4Wasm(
  benchmark, wasmIdentity, inputIdentity) {
  if (BigInt(benchmark.fast_o2_slots_per_second) < 25000n ||
      benchmark.fast_o2_wasm_sha256 !== wasmIdentity.wasm_sha256 ||
      benchmark.fast_o2_wasm_byte_count !== wasmIdentity.wasm_byte_count ||
      benchmark.fast_o2_wasm_profile !== wasmIdentity.wasm_profile ||
      benchmark.fast_o2_wasm_optimization !== wasmIdentity.wasm_optimization ||
      benchmark.fast_o2_source_closure_sha256 !==
        wasmIdentity.source_closure_sha256 ||
      benchmark.fast_o2_source_commit !== wasmIdentity.source_commit) {
    throw new Error("READY4 current O2 build differs from the measured benchmark");
  }
  if (benchmark.input_schedule_sha256 !==
        inputIdentity?.input_schedule_sha256 ||
      benchmark.release_record_sha256 !==
        inputIdentity?.release_record_sha256) {
    throw new Error("READY4 release record or input schedule differs from the measured benchmark");
  }
  return benchmark;
}

async function waitForResult(unit, projectedSeconds) {
  const attempts = ready4ObservationSeconds(projectedSeconds);
  for (let index = 0; index < attempts; index += 1) {
    const result = await capture("systemctl", ["--user", "show", unit,
      "--property=ActiveState,SubState,Result,ExecMainCode,ExecMainStatus"]);
    if (result.code === 0 && result.signal === null) {
      const state = parseSystemdShow(result.stdout.toString("utf8"));
      if ((state.ActiveState === "active" && state.SubState === "exited") ||
          state.ActiveState === "failed") return;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
  }
  throw new Error("READY4 systemd worker did not complete within its bounded observation period");
}

async function stopAndRemove(unit) {
  await capture("systemctl", ["--user", "stop", unit]);
  await capture("systemctl", ["--user", "reset-failed", unit]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const left = await capture("systemctl", ["--user", "list-units", "--all",
      "--plain", "--no-legend", unit]);
    if (left.code === 0 && left.signal === null &&
        left.stdout.toString("utf8").trim() === "") return;
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error("READY4 transient unit absence is unverified");
}

async function requireAbsent(path, label) {
  try { await lstat(path); }
  catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} absence is unverified`);
}

/*
 * The staged artifacts directory is deliberately owner-read/execute-only
 * while a transient unit can see it.  Restore only that directory's
 * owner-write bit before unlinking its children; the immutable files
 * themselves do not need to become writable.
 */
export async function removeReady4Stage(stageRoot) {
  const artifacts = resolve(stageRoot, "artifacts");
  try {
    await chmod(artifacts, 0o700);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await rm(stageRoot, { recursive: true });
  await requireAbsent(stageRoot, "READY4 staged root");
}

export async function executeReady4Systemd(options) {
  /* Build before staging; the child is always --no-build and sees only the
   * copied read-only Wasm input. */
  let stage = null; let unit = null; let unitAbsent = false;
  try {
    const benchmarkReceipt = await readRegularCanonical(
      options.benchmark, "READY4 benchmark projection");
    const benchmark = validateM6FastBenchmark(benchmarkReceipt.value);
    const projectedSeconds = checkedProjectedSeconds(
      Number(benchmark.ready4_projected_seconds));
    if (options.wasm !== resolve(ROOT, "cadr-web/build/cadr-web-m6-devid-O2.wasm")) {
      throw new Error("READY4 supervisor refuses an arbitrary Wasm pathname");
    }
    stage = await stageInputs(options);
    const wasmIdentity = await finishStagedBuild(stage);
    const inputIdentity = releaseRecordBenchmarkIdentity(
      await readFile(stage.release));
    assertBenchmarkMatchesReady4Wasm(benchmark, wasmIdentity, inputIdentity);
    const stagedDirect = resolve(stage.sourceRoot,
      "scripts/run-cadr-m6-ready4-fast.mjs");
    await validateStagedM6ExecutableClosure(
      stage.sourceRoot, stage.sourceClosure);
    const command = systemdReady4Command([stagedDirect, "--execute", "--no-build",
      "--artifact-root", stage.artifactRoot, "--release-record", stage.release,
      "--wasm", stage.wasm, "--wasm-identity", stage.identity,
      "--invocation-nonce-file", stage.nonce,
      "--output", stage.envelope], projectedSeconds,
    undefined, stage.root, stage.privateRoot);
    unit = command.unit;
    const started = await capture(command.command, command.args);
    if (started.code !== 0 || started.signal !== null) throw new Error("systemd-run refused READY4 worker");
    await waitForResult(unit, projectedSeconds);
    const shown = await capture("systemctl", ["--user", "show", unit,
      "--property=Result,ExecMainCode,ExecMainStatus,MemoryPeak,CPUUsageNSec,TasksCurrent,IOReadBytes,IOWriteBytes,IPIngressBytes,IPEgressBytes,RuntimeMaxUSec,TimeoutStopUSec,MemoryMax,MemorySwapMax,CPUQuotaPerSecUSec,TasksMax,UMask,NoNewPrivileges,PrivateNetwork,RestrictAddressFamilies,KillMode,ExitType,Restart,OOMPolicy,RemainAfterExit,MemoryAccounting,TasksAccounting,IOAccounting,IPAccounting,ReadOnlyPaths,ReadWritePaths,Environment"]);
    if (shown.code !== 0 || shown.signal !== null) throw new Error("could not read READY4 systemd accounting");
    const accounting = parseSystemdShow(shown.stdout.toString("utf8"));
    validateReady4SystemdPolicy(
      accounting, projectedSeconds, stage.root, stage.privateRoot);
    validateReady4SystemdAccounting(accounting);
    if (accounting.Result !== "success" || accounting.ExecMainCode !== "1" || accounting.ExecMainStatus !== "0") throw new Error("READY4 systemd worker failed");
    const privateEnvelope = await readRegularCanonical(
      stage.envelope, "private READY4 child envelope");
    const run = validateReady4Run(privateEnvelope.value);
    if (run.wasm_sha256 !== wasmIdentity.wasm_sha256 ||
        run.wasm_byte_count !== wasmIdentity.wasm_byte_count ||
        run.source_closure_sha256 !== wasmIdentity.source_closure_sha256 ||
        run.source_commit !== wasmIdentity.source_commit) {
      throw new Error("READY4 child changed the staged Wasm identity");
    }
    await stopAndRemove(unit); unitAbsent = true; unit = null;
    await removeReady4Stage(stage.root);
    stage = null;
    const policy = {
      RuntimeMaxUSec: accounting.RuntimeMaxUSec,
      TimeoutStopUSec: accounting.TimeoutStopUSec,
      MemoryMax: accounting.MemoryMax,
      MemorySwapMax: accounting.MemorySwapMax,
      CPUQuotaPerSecUSec: accounting.CPUQuotaPerSecUSec,
      TasksMax: accounting.TasksMax,
      UMask: accounting.UMask,
      NoNewPrivileges: accounting.NoNewPrivileges,
      PrivateNetwork: accounting.PrivateNetwork,
      RestrictAddressFamilies: accounting.RestrictAddressFamilies,
      KillMode: accounting.KillMode,
      ExitType: accounting.ExitType,
      Restart: accounting.Restart,
      OOMPolicy: accounting.OOMPolicy,
    };
    const supervised = Object.freeze({
      schema: M6_READY4_SUPERVISED_RUN_SCHEMA,
      outcome: "ready4-supervised",
      run,
      accounting_sha256: sha256Hex(Buffer.from(canonicalJson(accounting))),
      policy_sha256: sha256Hex(Buffer.from(canonicalJson(policy))),
      benchmark_sha256: benchmarkReceipt.sha256,
      projected_seconds: projectedSeconds,
      runtime_max_seconds: projectedSeconds * 2,
      observation_deadline_seconds: ready4ObservationSeconds(projectedSeconds),
      transient_unit_absent: true,
      staged_root_removed: true,
    });
    await writeCanonicalNoReplace(options.output, supervised);
    return supervised;
  } catch (error) {
    let cleanupError = null;
    if (unit !== null) {
      try { await stopAndRemove(unit); unitAbsent = true; unit = null; }
      catch (failure) { cleanupError = failure; }
    }
    if (stage !== null && (unitAbsent || unit === null)) {
      try {
        await removeReady4Stage(stage.root);
        stage = null;
      } catch (failure) { cleanupError ??= failure; }
    }
    const authoritative = cleanupError ?? error;
    await writeCanonicalNoReplace(`${options.output}.failure.json`, Object.freeze({
      schema: "cadr-m6-ready4-systemd-failure-v1", outcome: "failed",
      reason: cleanupError === null ? "systemd-worker-failed" : "systemd-cleanup-failed",
      diagnostic_sha256: sha256Hex(Buffer.from(String(authoritative?.message ?? authoritative))),
      evidence_retained: stage !== null,
    })).catch(() => undefined);
    throw authoritative;
  }
}

async function main() { await executeReady4Systemd(parseReady4SystemdArguments(process.argv.slice(2))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) process.stdout.write(`${usage()}\n`);
  else main().catch(error => { process.stderr.write(`READY4 systemd worker failed: ${error.message}\n`); process.exitCode = 1; });
}
