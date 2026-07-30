#!/usr/bin/env node
/*
 * Supervised production collector for the fixed 1,130,000-input M6
 * legacy-M5, fast-O0, and fast-O2 comparison.  The outer process owns builds,
 * transient units, private artifact copies, cleanup, and public receipts.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile }
  from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeCanonicalNoReplace } from
  "./aggregate-cadr-m6-ready4-campaign.mjs";
import { compareM6FastBenchmark, M6_FAST_BENCHMARK_CHILD_SCHEMA,
  M6_FAST_BENCHMARK_RUN_SCHEMA, releaseRecordBenchmarkIdentity,
  validateBenchmarkChildRun, validateBenchmarkRun } from
  "./benchmark-cadr-m6-ready4-fast.mjs";
import { canonicalJson, parseCanonicalJson, sha256Hex } from
  "./cadr-m6-ready4-evidence.mjs";
import { createM6WasmIdentityFromClosure, stageM6ExecutableClosure,
  validateM6WasmIdentity, validateStagedM6ExecutableClosure } from
  "./cadr-m6-wasm-identity.mjs";
import { executeControlledBenchmarkCandidate } from
  "./run-cadr-m6-devid-o2-canary-stage.mjs";
import { parseSystemdShow, systemdReady4Command,
  validateReady4SystemdAccounting, validateReady4SystemdPolicy } from
  "./run-cadr-m6-ready4-systemd.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF = fileURLToPath(import.meta.url);
const CANDIDATES = Object.freeze(["legacy-m5", "fast-o0", "fast-o2"]);
const RUNTIME_PROJECTION_SECONDS = 7200;

function usage() {
  return "usage: node scripts/collect-cadr-m6-ready4-benchmark.mjs --execute --artifact-root ROOT --output-dir DIR";
}

function capture(command, args) {
  return new Promise(resolveRun => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    child.stdout.on("data", bytes => stdout.push(bytes));
    child.stderr.on("data", bytes => stderr.push(bytes));
    child.once("error", error => resolveRun({
      code: null, signal: null, error,
      stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr),
    }));
    child.once("exit", (code, signal) => resolveRun({
      code, signal, error: null,
      stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr),
    }));
  });
}

function parse(argv) {
  const result = { execute: false, systemdChild: false, artifactRoot: null,
    outputDir: null, candidate: null, privateRoot: null, envelope: null,
    wasm: null, wasmIdentity: null, invocationNonceFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") {
      if (result.execute) throw new TypeError("duplicate --execute");
      result.execute = true;
    } else if (option === "--systemd-child") {
      if (result.systemdChild) throw new TypeError("duplicate --systemd-child");
      result.systemdChild = true;
    } else if (["--artifact-root", "--output-dir", "--candidate",
      "--private-root", "--envelope", "--wasm", "--wasm-identity",
      "--invocation-nonce-file"].includes(option)) {
      const key = option.slice(2).replace(/-([a-z])/g,
        (_, character) => character.toUpperCase());
      if (result[key] !== null) throw new TypeError(`duplicate ${option}`);
      const value = argv[++index];
      if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${option} needs a value`);
      }
      result[key] = ["candidate"].includes(key) ? value :
        resolve(process.cwd(), value);
    } else throw new TypeError(`unsupported benchmark collector option ${option}`);
  }
  if (!result.execute || result.artifactRoot === null ||
      (result.systemdChild ?
        (!CANDIDATES.includes(result.candidate) ||
         result.privateRoot === null || result.envelope === null ||
         result.wasm === null || result.wasmIdentity === null ||
         result.invocationNonceFile === null) :
        result.outputDir === null)) {
    throw new TypeError(`${usage()}\nThe production collector is inert without --execute.`);
  }
  return Object.freeze(result);
}

async function requireAbsent(path, label) {
  try { await lstat(path); }
  catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} remains present`);
}

async function cleanupUnit(unit) {
  await capture("systemctl", ["--user", "stop", unit]);
  await capture("systemctl", ["--user", "reset-failed", unit]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await capture("systemctl", ["--user", "list-units",
      "--all", "--plain", "--no-legend", unit]);
    if (result.code === 0 && result.signal === null &&
        result.stdout.toString("utf8").trim() === "") return;
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error("benchmark transient unit absence is unverified");
}

async function waitUnit(unit) {
  for (let attempt = 0; attempt < 14430; attempt += 1) {
    const shown = await capture("systemctl", ["--user", "show", unit,
      "--property=ActiveState,SubState,Result,ExecMainCode,ExecMainStatus"]);
    if (shown.code === 0 && shown.signal === null) {
      const values = Object.fromEntries(shown.stdout.toString("utf8").trim()
        .split("\n").map(line => line.split(/=(.*)/s).slice(0, 2)));
      if ((values.ActiveState === "active" && values.SubState === "exited") ||
          values.ActiveState === "failed") {
        if (values.Result !== "success" || values.ExecMainCode !== "1" ||
            values.ExecMainStatus !== "0") {
          throw new Error("benchmark supervised candidate failed");
        }
        return;
      }
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
  }
  throw new Error("benchmark supervised candidate exceeded RuntimeMaxSec");
}

async function child(options) {
  if (process.env.M6_READY4_SYSTEMD_CHILD !== "1") {
    throw new Error("benchmark child refuses unsupervised execution");
  }
  const nonce = await readFile(options.invocationNonceFile);
  const nonceInfo = await lstat(options.invocationNonceFile);
  if (!nonceInfo.isFile() || nonceInfo.isSymbolicLink() ||
      nonceInfo.size !== 32 || (nonceInfo.mode & 0o077) !== 0) {
    throw new Error("benchmark child lacks its outer-private invocation nonce");
  }
  const optimization = options.candidate === "fast-o2" ? "O2" : "O0";
  const wasm = options.wasm;
  const identity = await validateM6WasmIdentity(parseCanonicalJson(
    await readFile(options.wasmIdentity), "benchmark Wasm identity"),
  wasm, optimization);
  const measured = await executeControlledBenchmarkCandidate({
    candidate: options.candidate,
    artifactRoot: options.artifactRoot,
    wasm,
    privateRoot: options.privateRoot,
  });
  if (measured.wasm_sha256 !== identity.wasm_sha256 ||
      measured.wasm_byte_count !== identity.wasm_byte_count) {
    throw new Error("benchmark executed Wasm differs from its build identity");
  }
  const inputIdentity = releaseRecordBenchmarkIdentity(await readFile(
    resolve(ROOT,
      "cadr-web/oracle/cadr-m6-release-record.json")));
  if (measured.input_schedule_sha256 !==
      inputIdentity.input_schedule_sha256) {
    throw new Error("benchmark executed schedule differs from its release record");
  }
  const receipt = validateBenchmarkChildRun(Object.freeze({
    schema: M6_FAST_BENCHMARK_CHILD_SCHEMA,
    candidate: options.candidate,
    completed_boundary: measured.completed_boundary,
    elapsed_nanoseconds: measured.elapsed_nanoseconds,
    input_schedule_sha256: measured.input_schedule_sha256,
    release_record_sha256: inputIdentity.release_record_sha256,
    invocation_nonce_sha256: sha256Hex(nonce),
    wasm_byte_count: identity.wasm_byte_count,
    wasm_optimization: identity.wasm_optimization,
    wasm_profile: identity.wasm_profile,
    wasm_sha256: identity.wasm_sha256,
    source_closure_sha256: identity.source_closure_sha256,
    source_commit: identity.source_commit,
    cdrstate5_sha256: measured.cdrstate5_sha256,
    cdrm5q1_sha256: measured.cdrm5q1_sha256,
    host_transcript_sha256: measured.host_transcript_sha256,
    cdrm6e1_sha256: measured.cdrm6e1_sha256,
    overlay_sha256: measured.overlay_sha256,
    base_disk_sha256: measured.base_disk_sha256,
    residue_sha256: measured.residue_sha256,
  }));
  await writeCanonicalNoReplace(options.envelope, receipt);
}

export function attestBenchmarkCandidate({
  childRun, candidate, identity, command, nonce, systemdShow,
  projectedSeconds, readOnlyRoot, readWriteRoot,
  unitAbsent, privateRootRemoved,
}) {
  const run = validateBenchmarkChildRun(childRun);
  validateReady4SystemdPolicy(systemdShow, projectedSeconds,
    readOnlyRoot, readWriteRoot);
  validateReady4SystemdAccounting(systemdShow);
  const childIndex = command.args.indexOf(process.execPath);
  const expectedChild = command.args[childIndex + 1];
  const expectedNonce = command.args[
    command.args.indexOf("--invocation-nonce-file") + 1];
  const expectedEnvelope = command.args[
    command.args.indexOf("--envelope") + 1];
  if (unitAbsent !== true || privateRootRemoved !== true ||
      systemdShow.Id !== command.unit ||
      !/^[0-9a-f]{32}$/.test(systemdShow.InvocationID ?? "") ||
      ![process.execPath, expectedChild, expectedNonce, expectedEnvelope]
        .every(value => typeof value === "string" &&
          String(systemdShow.ExecStart ?? "").includes(value)) ||
      run.candidate !== candidate ||
      run.wasm_sha256 !== identity.wasm_sha256 ||
      run.wasm_byte_count !== identity.wasm_byte_count ||
      run.wasm_optimization !== identity.wasm_optimization ||
      run.wasm_profile !== identity.wasm_profile ||
      run.source_closure_sha256 !== identity.source_closure_sha256 ||
      run.source_commit !== identity.source_commit ||
      !(nonce instanceof Uint8Array) || nonce.byteLength !== 32 ||
      run.invocation_nonce_sha256 !== sha256Hex(nonce)) {
    throw new Error("benchmark child is not bound to its outer systemd invocation");
  }
  return Object.freeze({
    run,
    accounting_sha256: sha256Hex(Buffer.from(canonicalJson(Object.freeze({
      MemoryPeak: systemdShow.MemoryPeak,
      CPUUsageNSec: systemdShow.CPUUsageNSec,
      TasksCurrent: systemdShow.TasksCurrent,
      IOReadBytes: systemdShow.IOReadBytes,
      IOWriteBytes: systemdShow.IOWriteBytes,
      IPIngressBytes: systemdShow.IPIngressBytes,
      IPEgressBytes: systemdShow.IPEgressBytes,
    })))),
    policy_sha256: sha256Hex(Buffer.from(canonicalJson(Object.freeze({
      RuntimeMaxUSec: systemdShow.RuntimeMaxUSec,
      TimeoutStopUSec: systemdShow.TimeoutStopUSec,
      MemoryMax: systemdShow.MemoryMax,
      MemorySwapMax: systemdShow.MemorySwapMax,
      CPUQuotaPerSecUSec: systemdShow.CPUQuotaPerSecUSec,
      TasksMax: systemdShow.TasksMax,
      UMask: systemdShow.UMask,
      NoNewPrivileges: systemdShow.NoNewPrivileges,
      PrivateNetwork: systemdShow.PrivateNetwork,
      RestrictAddressFamilies: systemdShow.RestrictAddressFamilies,
    })))),
    invocation_sha256: sha256Hex(Buffer.from(canonicalJson(Object.freeze({
      unit: systemdShow.Id, invocation_id: systemdShow.InvocationID,
      exec_start: systemdShow.ExecStart,
      expected_command: command.command, expected_args: command.args,
      nonce_sha256: sha256Hex(nonce),
    })))),
  });
}

async function collectOne(options, candidate, identity, sourceStage) {
  const root = await mkdtemp(resolve(tmpdir(), `cadr-m6-benchmark-${candidate}-`));
  await chmod(root, 0o700);
  const envelope = resolve(root, "candidate.json");
  const noncePath = resolve(sourceStage.nonceRoot, `${candidate}.nonce`);
  const nonce = randomBytes(32);
  await writeFile(noncePath, nonce, { flag: "wx", mode: 0o400 });
  let unit = null; let absent = false;
  try {
    const childArguments = [
      sourceStage.collector, "--execute", "--systemd-child", "--artifact-root",
      options.artifactRoot, "--candidate", candidate,
      "--private-root", root, "--envelope", envelope,
      "--wasm", identity.wasmPath, "--wasm-identity", identity.identityPath,
      "--invocation-nonce-file", noncePath];
    await validateStagedM6ExecutableClosure(
      sourceStage.root, sourceStage.closure);
    const command = systemdReady4Command(
      childArguments, RUNTIME_PROJECTION_SECONDS,
      randomBytes(16).toString("hex"),
      [sourceStage.root, options.artifactRoot], root);
    unit = command.unit;
    const started = await capture(command.command, command.args);
    if (started.code !== 0 || started.signal !== null) {
      throw new Error("systemd-run refused benchmark candidate");
    }
    await waitUnit(unit);
    const policyResult = await capture("systemctl", ["--user", "show", unit,
      "--property=Id,InvocationID,ExecStart,MemoryPeak,CPUUsageNSec,TasksCurrent,IOReadBytes,IOWriteBytes,IPIngressBytes,IPEgressBytes,RuntimeMaxUSec,TimeoutStopUSec,MemoryMax,MemorySwapMax,CPUQuotaPerSecUSec,TasksMax,UMask,NoNewPrivileges,PrivateNetwork,RestrictAddressFamilies,KillMode,ExitType,Restart,OOMPolicy,RemainAfterExit,MemoryAccounting,TasksAccounting,IOAccounting,IPAccounting,ReadOnlyPaths,ReadWritePaths,Environment"]);
    if (policyResult.code !== 0 || policyResult.signal !== null) {
      throw new Error("benchmark systemd policy/accounting is unavailable");
    }
    const policy = parseSystemdShow(policyResult.stdout.toString("utf8"));
    validateReady4SystemdPolicy(policy, RUNTIME_PROJECTION_SECONDS,
      options.artifactRoot, root);
    validateReady4SystemdAccounting(policy);
    const value = parseCanonicalJson(
      await readFile(envelope), "private benchmark candidate");
    const receipt = validateBenchmarkChildRun(value);
    if (receipt.candidate !== candidate ||
        receipt.wasm_sha256 !== identity.wasm_sha256 ||
        receipt.wasm_byte_count !== identity.wasm_byte_count ||
        receipt.wasm_optimization !== identity.wasm_optimization ||
        receipt.wasm_profile !== identity.wasm_profile ||
        receipt.source_closure_sha256 !== identity.source_closure_sha256 ||
        receipt.source_commit !== identity.source_commit) {
      throw new Error("benchmark candidate changed its outer-owned build identity");
    }
    await cleanupUnit(unit); absent = true; unit = null;
    await rm(root, { recursive: true });
    await requireAbsent(root, "benchmark private root");
    return attestBenchmarkCandidate({
      childRun: receipt, candidate, identity, command, nonce,
      systemdShow: policy, projectedSeconds: RUNTIME_PROJECTION_SECONDS,
      readOnlyRoot: [sourceStage.root, options.artifactRoot],
      readWriteRoot: root,
      unitAbsent: true, privateRootRemoved: true,
    });
  } catch (error) {
    if (unit !== null) {
      try { await cleanupUnit(unit); absent = true; unit = null; }
      catch { /* Preserve the private root when absence is unverified. */ }
    }
    if (absent) await rm(root, { recursive: true }).catch(() => undefined);
    throw error;
  }
}

async function outer(options) {
  await mkdir(options.outputDir, { recursive: true, mode: 0o700 });
  for (const name of [...CANDIDATES.map(candidate => `${candidate}.json`),
    "benchmark.json"]) {
    await requireAbsent(resolve(options.outputDir, name),
      `benchmark output ${name}`);
  }
  const sourceParent = await mkdtemp(resolve(tmpdir(), "cadr-m6-benchmark-source-"));
  const sourceRoot = resolve(sourceParent, "source");
  const closure = await stageM6ExecutableClosure(ROOT, sourceRoot);
  execFileSync("make", ["-C", resolve(sourceRoot, "cadr-web"),
    "build/cadr-web-m6-devid-O0.wasm",
    "build/cadr-web-m6-devid-O2.wasm"], { stdio: "inherit" });
  const nonceRoot = resolve(sourceRoot, ".m6-invocation-nonces");
  const identityRoot = resolve(sourceRoot, ".m6-build-identities");
  await mkdir(nonceRoot, { mode: 0o700 });
  await mkdir(identityRoot, { mode: 0o700 });
  const O0 = resolve(sourceRoot, "cadr-web/build/cadr-web-m6-devid-O0.wasm");
  const O2 = resolve(sourceRoot, "cadr-web/build/cadr-web-m6-devid-O2.wasm");
  const identities = {
    O0: await createM6WasmIdentityFromClosure(sourceRoot, O0, "O0", closure),
    O2: await createM6WasmIdentityFromClosure(sourceRoot, O2, "O2", closure),
  };
  for (const optimization of ["O0", "O2"]) {
    const path = resolve(identityRoot, `${optimization}.json`);
    await writeCanonicalNoReplace(path, identities[optimization]);
    await chmod(path, 0o400);
    identities[optimization] = Object.freeze({
      ...identities[optimization],
      wasmPath: optimization === "O2" ? O2 : O0, identityPath: path,
    });
  }
  await chmod(identityRoot, 0o500);
  const sourceStage = Object.freeze({ root: sourceRoot, closure,
    collector: resolve(sourceRoot,
      "scripts/collect-cadr-m6-ready4-benchmark.mjs"),
    nonceRoot });
  const pending = [];
  for (const candidate of CANDIDATES) {
    const identity = candidate === "fast-o2" ? identities.O2 : identities.O0;
    pending.push(await collectOne(options, candidate, identity, sourceStage));
  }
  await rm(sourceParent, { recursive: true });
  await requireAbsent(sourceParent, "benchmark source stage");
  const receipts = [];
  for (let index = 0; index < CANDIDATES.length; index += 1) {
    const receipt = validateBenchmarkRun(Object.freeze({
      schema: M6_FAST_BENCHMARK_RUN_SCHEMA,
      outcome: "systemd-attested",
      ...pending[index],
      transient_unit_absent: true,
      private_root_removed: true,
      source_stage_removed: true,
    }));
    await writeCanonicalNoReplace(
      resolve(options.outputDir, `${CANDIDATES[index]}.json`), receipt);
    receipts.push(receipt);
  }
  const benchmark = compareM6FastBenchmark(receipts);
  await writeCanonicalNoReplace(
    resolve(options.outputDir, "benchmark.json"), benchmark);
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (options.systemdChild) await child(options);
  else await outer(options);
}

if (process.argv[1] === SELF) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
  } else main().catch(error => {
    process.stderr.write(`M6 benchmark collector failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
