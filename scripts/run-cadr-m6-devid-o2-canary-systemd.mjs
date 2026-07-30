#!/usr/bin/env node
/*
 * The only live entry point for the M6-DEVID O2 canary.  It creates a
 * transient user service with fixed limits and accounting; the child launcher
 * independently refuses execution without the service identity.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { lstat, mkdtemp, readFile, rm, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, writeCanonicalNoReplaceReceipt } from
  "./run-cadr-m6-devid-o2-canary.mjs";
import { boundedCanaryFailure } from "./run-cadr-m6-devid-o2-canary.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCHER = resolve(ROOT, "scripts/run-cadr-m6-devid-o2-canary.mjs");
const M7_LAUNCHER = resolve(ROOT, "scripts/run-cadr-m7-devid-o2-canary.mjs");
const UNIT_PREFIX = "cadr-m6-devid-o2-canary-";
const M7_UNIT_PREFIX = "cadr-m7-devid-o2-canary-";

function profileConfig(profile) {
  if (profile === "m6-devid") return Object.freeze({ launcher: LAUNCHER,
    unitPrefix: UNIT_PREFIX, environmentPrefix: "M6_DEVID",
    envelopeSchema: "cadr-m6-devid-o2-canary-result-envelope-v1",
    receiptSchema: "cadr-m6-devid-o2-canary-receipt-v1", temporaryStem: "m6" });
  if (profile === "m7-devid") return Object.freeze({ launcher: M7_LAUNCHER,
    unitPrefix: M7_UNIT_PREFIX, environmentPrefix: "M7_DEVID",
    envelopeSchema: "cadr-m7-devid-o2-canary-result-envelope-v1",
    receiptSchema: "cadr-m7-devid-o2-canary-receipt-v1", temporaryStem: "m7" });
  throw new TypeError("unknown receipt-bound canary profile");
}

export function systemdCommand(argv, nonce = randomBytes(16).toString("hex"),
  profile = "m6-devid") {
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw new TypeError("systemd canary nonce must be 128-bit lowercase hex");
  const config = profileConfig(profile);
  const unit = `${config.unitPrefix}${nonce}.service`;
  return Object.freeze({
    command: "systemd-run",
    unit,
    args: Object.freeze([
      "--user", "--no-block", "--service-type=exec",
      `--unit=${unit}`,
      "--property=RuntimeMaxSec=14400",
      "--property=TimeoutStopSec=30s",
      "--property=MemoryMax=3221225472",
      "--property=MemorySwapMax=0",
      "--property=CPUQuota=200%",
      "--property=TasksMax=128",
      "--property=UMask=0077",
      "--property=NoNewPrivileges=yes",
      "--property=RemainAfterExit=yes",
      "--property=KillMode=control-group",
      "--property=ExitType=cgroup",
      "--property=Restart=no",
      "--property=OOMPolicy=kill",
      "--property=PrivateNetwork=yes",
      "--property=RestrictAddressFamilies=AF_UNIX AF_INET",
      "--property=MemoryAccounting=yes",
      "--property=TasksAccounting=yes",
      "--property=IOAccounting=yes",
      "--property=IPAccounting=yes",
      `--setenv=${config.environmentPrefix}_SYSTEMD_UNIT=${unit}`,
      `--setenv=${config.environmentPrefix}_SYSTEMD_CHILD=1`,
      "--setenv=LANG=C", "--setenv=LC_ALL=C", "--setenv=TZ=UTC",
      process.execPath, config.launcher, "--systemd-child", ...argv,
    ]),
  });
}

export function normalizeOuterInvocation(argv, cwd = process.cwd()) {
  const normalized = [...argv];
  for (let index = 0; index < normalized.length; index += 1) {
    if (["--m6-patch", "--m7-patch", "--artifact-root", "--output"].includes(normalized[index])) {
      if (typeof normalized[index + 1] !== "string" ||
          normalized[index + 1].length === 0) {
        throw new TypeError(`${normalized[index]} needs a value`);
      }
      normalized[index + 1] = resolve(cwd, normalized[index + 1]);
      index += 1;
    }
  }
  return Object.freeze(normalized);
}

function outputPath(argv) {
  const positions = argv.reduce((found, value, index) =>
    value === "--output" ? [...found, index] : found, []);
  if (positions.length !== 1 || typeof argv[positions[0] + 1] !== "string") {
    throw new TypeError("systemd canary wrapper requires exactly one --output");
  }
  return resolve(process.cwd(), argv[positions[0] + 1]);
}

async function capture(command, args) {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(command, args, { cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    child.stdout.on("data", bytes => stdout.push(bytes));
    child.stderr.on("data", bytes => stderr.push(bytes));
    child.once("error", rejectChild);
    child.once("exit", (code, signal) => resolveChild(Object.freeze({
      code: code ?? 1, signal, stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    })));
  });
}

async function waitForUnitResult(unit) {
  const deadline = Date.now() + 14_430_000;
  while (Date.now() < deadline) {
    const state = await capture("systemctl", ["--user", "show", unit,
      "--property=SubState,Result,ExecMainCode,ExecMainStatus"]);
    if (state.code === 0) {
      const properties = Object.fromEntries(state.stdout.toString("utf8").trim()
        .split("\n").map(line => {
          const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)];
        }));
      if (["exited", "failed", "dead"].includes(properties.SubState)) return properties;
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  throw new Error("transient canary unit did not reach an accounted terminal state");
}

export function parseSystemdShow(text) {
  const result = {};
  for (const line of text.trim().split("\n")) {
    const split = line.indexOf("=");
    if (split <= 0) throw new Error("malformed systemd accounting property");
    result[line.slice(0, split)] = line.slice(split + 1);
  }
  for (const key of ["MemoryPeak", "CPUUsageNSec", "TasksCurrent",
    "IOReadBytes", "IOWriteBytes", "IPIngressBytes", "IPEgressBytes",
    "Result", "ExecMainCode", "ExecMainStatus"]) {
    if (!(key in result)) throw new Error(`systemd omitted ${key}`);
  }
  return Object.freeze(result);
}

export function validateSystemdSuccess(waited, accounting) {
  const counters = ["MemoryPeak", "CPUUsageNSec"];
  const ioCounters = ["IOReadBytes", "IOWriteBytes"];
  const ipCounters = ["IPIngressBytes", "IPEgressBytes"];
  if (waited?.Result !== "success" || waited.ExecMainCode !== "1" ||
      waited.ExecMainStatus !== "0" || accounting?.Result !== "success" ||
      accounting.ExecMainCode !== "1" || accounting.ExecMainStatus !== "0" ||
      counters.some(key => !/^[0-9]+$/.test(accounting?.[key] ?? "")) ||
      ioCounters.some(key => !(/^[0-9]+$/.test(accounting?.[key] ?? "") ||
        accounting?.[key] === "[not set]")) ||
      ipCounters.some(key => !(/^[0-9]+$/.test(accounting?.[key] ?? "") ||
        accounting?.[key] === "[no data]")) ||
      !(/^[0-9]+$/.test(accounting?.TasksCurrent ?? "") ||
        accounting?.TasksCurrent === "[not set]")) {
    throw new Error("systemd terminal result or accounting evidence is invalid");
  }
  return accounting;
}

export function validateEffectiveSystemdPolicy(value) {
  const expected = Object.freeze({
    RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
    MemoryMax: "3221225472", MemorySwapMax: "0",
    CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
    NoNewPrivileges: "yes", PrivateNetwork: "yes",
    RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
    ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
    RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
    IOAccounting: "yes", IPAccounting: "yes",
  });
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value?.[key] !== expectedValue) {
      throw new Error(`systemd effective policy differs at ${key}`);
    }
  }
  return value;
}

export function validateUnitAbsent(result) {
  if (result?.code !== 0 || result.signal !== null ||
      result.stdout.toString("utf8").trim() !== "") {
    throw new Error("transient canary unit remains loaded or absence is unverified");
  }
  return true;
}

export async function requireVacantReceiptPaths(output) {
  for (const path of [output, `${output}.failure.json`]) {
    try {
      await lstat(path);
      throw new Error("canary receipt path already exists");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

export async function removeOwnedCanaryRoots(paths) {
  for (const path of paths) {
    await rm(path, { recursive: true, force: true });
    try {
      await lstat(path);
      throw new Error("outer-owned canary root still exists");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

export async function cleanupTransientUnit({
  unit, roots, captureFn = capture, removeRoots = removeOwnedCanaryRoots,
}) {
  const stopArgs = ["--user", "stop", unit];
  let stopped = await captureFn("systemctl", stopArgs);
  if (stopped.code !== 0 || stopped.signal !== null) {
    await captureFn("systemctl", ["--user", "kill", "--kill-whom=all",
      "--signal=SIGKILL", unit]).catch(() => undefined);
    stopped = await captureFn("systemctl", stopArgs);
  }
  await captureFn("systemctl", ["--user", "reset-failed", unit])
    .catch(() => undefined);
  const verify = await captureFn("systemctl", ["--user", "list-units", "--all",
    "--plain", "--no-legend", "--no-pager", unit]);
  validateUnitAbsent(verify);
  await removeRoots(roots);
  return Object.freeze({ unit_absent: true, roots_removed: true });
}

export function outerFailureReceipt({
  reason, unit, accounting = null, run = null, primary = null,
  cleanupFailure = null, childFailure = null, childEnvelopeRetained = false,
  profile = "m6-devid",
}) {
  const boundedChildFailure = childFailure === null ? null : Object.freeze({
    reason: childFailure.reason,
    diagnostic_sha256: childFailure.diagnostic_sha256,
  });
  return Object.freeze({
    schema: `${profileConfig(profile).receiptSchema.replace("-receipt-v1", "-outer-failure-v1")}`, reason, unit,
    systemd_accounting: accounting,
    child: Object.freeze({ exit_code: run?.code ?? null,
      signal: run?.signal ?? null }),
    failures: Object.freeze({
      primary: primary === null ? null : boundedCanaryFailure(primary),
      cleanup: cleanupFailure === null ? null :
        boundedCanaryFailure(cleanupFailure),
      child: boundedChildFailure,
    }),
    ...(childEnvelopeRetained ? { child_envelope_retained: true } : {}),
  });
}

export function validateResultEnvelope(value, profile = "m6-devid") {
  const config = profileConfig(profile);
  if (value?.schema !== config.envelopeSchema ||
      !["canary-complete", "canary-failed"].includes(value?.outcome) ||
      value?.receipt === null || typeof value?.receipt !== "object") {
    throw new Error("supervised child did not publish the closed result envelope");
  }
  if (value.outcome === "canary-complete") {
    if (value.receipt.schema !== config.receiptSchema) {
      throw new Error("supervised child success envelope is malformed");
    }
  } else {
    const failure = value.receipt.failure;
    if (value.receipt.schema !== `${config.receiptSchema.replace("-receipt-v1", "-failure-v1")}` ||
        failure === null || typeof failure !== "object" ||
        Object.keys(failure).sort().join(",") !==
          "diagnostic_sha256,reason" ||
        !["reason", "diagnostic_sha256"].every(key =>
          typeof failure[key] === "string") ||
        !/^[a-z0-9-]{1,64}$/.test(failure.reason) ||
        !/^[0-9a-f]{64}$/.test(failure.diagnostic_sha256)) {
      throw new Error("supervised child failure envelope is malformed");
    }
  }
  return value;
}

export async function runSystemdCanary(profile = "m6-devid",
  argv = process.argv.slice(2), finalValidator = null) {
  const config = profileConfig(profile);
  if (finalValidator !== null && typeof finalValidator !== "function") {
    throw new TypeError("final canary validator must be a function");
  }
  const original = normalizeOuterInvocation(argv);
  const output = outputPath(original);
  await requireVacantReceiptPaths(output);
  const stageRoot = await mkdtemp(`/tmp/cadr-${config.temporaryStem}-devid-stage-`);
  let privateRoot;
  try {
    privateRoot = await mkdtemp(`/tmp/cadr-${config.temporaryStem}-devid-private-`);
  } catch (error) {
    await removeOwnedCanaryRoots([stageRoot]);
    throw error;
  }
  const envelope = resolve(dirname(output), `.${randomBytes(16).toString("hex")}.${config.temporaryStem}-canary-envelope.json`);
  const command = systemdCommand([...original, "--result-envelope", envelope,
    "--stage-root", stageRoot, "--private-root", privateRoot], undefined, profile);
  let run; let accounting; let result; let primary = null;
  try {
    run = await capture(command.command, command.args);
    if (run.code !== 0 || run.signal !== null) {
      throw new Error("systemd-run refused the transient canary unit");
    }
    const waited = await waitForUnitResult(command.unit);
    result = validateResultEnvelope(JSON.parse(await readFile(envelope, "utf8")), profile);
    if (result.outcome === "canary-complete" &&
        result.receipt?.supervision?.unit !== command.unit) {
      throw new Error("child receipt names a different transient canary unit");
    }
    const shown = await capture("systemctl", ["--user", "show", command.unit,
      "--property=MemoryPeak,CPUUsageNSec,TasksCurrent,IOReadBytes,IOWriteBytes,IPIngressBytes,IPEgressBytes,Result,ExecMainCode,ExecMainStatus,RuntimeMaxUSec,TimeoutStopUSec,MemoryMax,MemorySwapMax,CPUQuotaPerSecUSec,TasksMax,UMask,NoNewPrivileges,PrivateNetwork,RestrictAddressFamilies,KillMode,ExitType,Restart,OOMPolicy,RemainAfterExit,MemoryAccounting,TasksAccounting,IOAccounting,IPAccounting"]);
    if (shown.code !== 0 || shown.signal !== null) {
      throw new Error(`could not query transient unit accounting: ${shown.stderr}`);
    }
    accounting = parseSystemdShow(shown.stdout.toString("utf8"));
    validateEffectiveSystemdPolicy(accounting);
    validateSystemdSuccess(waited, accounting);
  } catch (error) {
    primary = error;
  }
  let cleanupFailure = null;
  try {
    await cleanupTransientUnit({ unit: command.unit,
      roots: [stageRoot, privateRoot] });
  } catch (error) {
    cleanupFailure = error;
  }
  if (primary !== null || cleanupFailure !== null ||
      run?.code !== 0 || run?.signal !== null ||
      result?.outcome !== "canary-complete") {
    const reason = primary !== null && cleanupFailure !== null ?
      "canary-and-unit-cleanup-failed" :
      cleanupFailure !== null ? "unit-cleanup-failed" :
      primary !== null ? "supervision-evidence-failed" : "canary-child-failed";
    await writeCanonicalNoReplaceReceipt(`${output}.failure.json`,
      outerFailureReceipt({ reason, unit: command.unit, accounting, run,
        primary, cleanupFailure,
        childFailure: result?.outcome === "canary-failed" ?
          result.receipt.failure : null, profile }));
    await unlink(envelope).catch(() => undefined);
    if (primary !== null && cleanupFailure !== null) {
      throw new AggregateError([primary, cleanupFailure], reason);
    }
    throw primary ?? cleanupFailure ?? new Error(reason);
  }
  const final = Object.freeze({ ...result.receipt,
    systemd_accounting: accounting, unit_cleanup_verified: true,
    outer_roots_removed: true });
  try {
    if (finalValidator !== null) finalValidator(final);
    const written = await writeCanonicalNoReplaceReceipt(output, final);
    await unlink(envelope).catch(() => undefined);
    process.stdout.write(`${canonicalJson(Object.freeze({
      outcome: "canary-complete", receipt: written, receipt_path: output }))}\n`);
  } catch (publication) {
    try {
      await writeCanonicalNoReplaceReceipt(`${output}.failure.json`,
        outerFailureReceipt({
          reason: "final-receipt-publication-failed", unit: command.unit,
          accounting, run, primary: publication, childEnvelopeRetained: true,
          profile,
        }));
    } catch (failurePublication) {
      throw new AggregateError([publication, failurePublication],
        "final and failure receipt publication failed");
    }
    throw publication;
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runSystemdCanary().catch(error => {
    process.stderr.write(`${canonicalJson(Object.freeze({
      outcome: "canary-wrapper-failed",
      failure: boundedCanaryFailure(error),
    }))}\n`);
    process.exitCode = 1;
  });
}
