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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LAUNCHER = resolve(ROOT, "scripts/run-cadr-m6-devid-o2-canary.mjs");
const UNIT_PREFIX = "cadr-m6-devid-o2-canary-";

export function systemdCommand(argv, nonce = randomBytes(16).toString("hex")) {
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw new TypeError("systemd canary nonce must be 128-bit lowercase hex");
  const unit = `${UNIT_PREFIX}${nonce}.service`;
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
      "--property=TasksMax=64",
      "--property=UMask=0077",
      "--property=NoNewPrivileges=yes",
      "--property=RemainAfterExit=yes",
      "--property=KillMode=control-group",
      "--property=ExitType=cgroup",
      "--property=Restart=no",
      "--property=OOMPolicy=kill",
      "--property=PrivateNetwork=yes",
      "--property=RestrictAddressFamilies=AF_UNIX",
      "--property=CPUAccounting=yes",
      "--property=MemoryAccounting=yes",
      "--property=TasksAccounting=yes",
      "--property=IOAccounting=yes",
      "--property=IPAccounting=yes",
      `--setenv=M6_DEVID_SYSTEMD_UNIT=${unit}`,
      "--setenv=M6_DEVID_SYSTEMD_CHILD=1",
      "--setenv=LANG=C", "--setenv=LC_ALL=C", "--setenv=TZ=UTC",
      process.execPath, LAUNCHER, "--systemd-child", ...argv,
    ]),
  });
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
  for (const key of ["MemoryPeak", "CPUUsageNSec", "TasksCurrent", "TasksPeak",
    "IOReadBytes", "IOWriteBytes", "IPIngressBytes", "IPEgressBytes",
    "Result", "ExecMainCode", "ExecMainStatus"]) {
    if (!(key in result)) throw new Error(`systemd omitted ${key}`);
  }
  return Object.freeze(result);
}

export function validateSystemdSuccess(waited, accounting) {
  const counters = ["MemoryPeak", "CPUUsageNSec", "TasksCurrent", "TasksPeak",
    "IOReadBytes", "IOWriteBytes", "IPIngressBytes", "IPEgressBytes"];
  if (waited?.Result !== "success" || waited.ExecMainCode !== "1" ||
      waited.ExecMainStatus !== "0" || accounting?.Result !== "success" ||
      accounting.ExecMainCode !== "1" || accounting.ExecMainStatus !== "0" ||
      counters.some(key => !/^[0-9]+$/.test(accounting?.[key] ?? ""))) {
    throw new Error("systemd terminal result or accounting values are not successful and numeric");
  }
  return accounting;
}

export function validateEffectiveSystemdPolicy(value) {
  const expected = Object.freeze({
    RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
    MemoryMax: "3221225472", MemorySwapMax: "0",
    CPUQuotaPerSecUSec: "2s", TasksMax: "64", UMask: "0077",
    NoNewPrivileges: "yes", PrivateNetwork: "yes",
    RestrictAddressFamilies: "AF_UNIX", KillMode: "control-group",
    ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
    RemainAfterExit: "yes", CPUAccounting: "yes",
    MemoryAccounting: "yes", TasksAccounting: "yes",
    IOAccounting: "yes", IPAccounting: "yes",
  });
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value?.[key] !== expectedValue) {
      throw new Error(`systemd effective policy differs at ${key}`);
    }
  }
  return value;
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

async function main() {
  const original = process.argv.slice(2);
  const output = outputPath(original);
  const stageRoot = await mkdtemp("/tmp/cadr-m6-devid-stage-");
  let privateRoot;
  try {
    privateRoot = await mkdtemp("/tmp/cadr-m6-devid-private-");
  } catch (error) {
    await removeOwnedCanaryRoots([stageRoot]);
    throw error;
  }
  const envelope = resolve(dirname(output), `.${randomBytes(16).toString("hex")}.m6-canary-envelope.json`);
  const command = systemdCommand([...original, "--result-envelope", envelope,
    "--stage-root", stageRoot, "--private-root", privateRoot]);
  let run; let accounting; let result; let primary = null;
  try {
    run = await capture(command.command, command.args);
    if (run.code !== 0 || run.signal !== null) {
      throw new Error("systemd-run refused the transient canary unit");
    }
    const waited = await waitForUnitResult(command.unit);
    const shown = await capture("systemctl", ["--user", "show", command.unit,
      "--property=MemoryPeak,CPUUsageNSec,TasksCurrent,TasksPeak,IOReadBytes,IOWriteBytes,IPIngressBytes,IPEgressBytes,Result,ExecMainCode,ExecMainStatus,RuntimeMaxUSec,TimeoutStopUSec,MemoryMax,MemorySwapMax,CPUQuotaPerSecUSec,TasksMax,UMask,NoNewPrivileges,PrivateNetwork,RestrictAddressFamilies,KillMode,ExitType,Restart,OOMPolicy,RemainAfterExit,CPUAccounting,MemoryAccounting,TasksAccounting,IOAccounting,IPAccounting"]);
    if (shown.code !== 0 || shown.signal !== null) {
      throw new Error(`could not query transient unit accounting: ${shown.stderr}`);
    }
    accounting = parseSystemdShow(shown.stdout.toString("utf8"));
    validateSystemdSuccess(waited, accounting);
    validateEffectiveSystemdPolicy(accounting);
    result = JSON.parse(await readFile(envelope, "utf8"));
    if (result?.schema !== "cadr-m6-devid-o2-canary-result-envelope-v1") {
      throw new Error("supervised child did not publish the closed result envelope");
    }
  } catch (error) {
    primary = error;
  }
  let cleanupFailure = null;
  try {
    await unlink(envelope).catch(() => undefined);
    const reset = await capture("systemctl", ["--user", "reset-failed", command.unit]);
    let stopped = await capture("systemctl", ["--user", "stop", command.unit]);
    if (stopped.code !== 0 || stopped.signal !== null) {
      await capture("systemctl", ["--user", "kill", "--kill-whom=all",
        "--signal=SIGKILL", command.unit]).catch(() => undefined);
      stopped = await capture("systemctl", ["--user", "stop", command.unit]);
    }
    const verify = await capture("systemctl", ["--user", "show", command.unit,
      "--property=LoadState"]).catch(() => null);
    await removeOwnedCanaryRoots([stageRoot, privateRoot]);
    if (stopped.code !== 0 || reset.code !== 0 ||
        (verify !== null && verify.code === 0 &&
        !verify.stdout.toString("utf8").includes("LoadState=not-found"))) {
      cleanupFailure = new Error("transient canary unit was not collected after accounting");
    }
  } catch (error) {
    cleanupFailure = error;
  }
  if (primary !== null || cleanupFailure !== null ||
      run?.code !== 0 || run?.signal !== null ||
      result?.outcome !== "canary-complete") {
    const reason = cleanupFailure !== null ? "unit-cleanup-failed" :
      primary !== null ? "supervision-evidence-failed" : "canary-child-failed";
    await writeCanonicalNoReplaceReceipt(`${output}.failure.json`, Object.freeze({
      schema: "cadr-m6-devid-o2-canary-outer-failure-v1", reason,
      unit: command.unit, systemd_accounting: accounting ?? null,
      child: Object.freeze({ exit_code: run?.code ?? null,
        signal: run?.signal ?? null }),
    }));
    throw cleanupFailure ?? primary ?? new Error(reason);
  }
  const final = Object.freeze({ ...result.receipt,
    systemd_accounting: accounting, unit_cleanup_verified: true,
    outer_roots_removed: true });
  const written = await writeCanonicalNoReplaceReceipt(output, final);
  process.stdout.write(`${canonicalJson(Object.freeze({
    outcome: "canary-complete", receipt: written, receipt_path: output }))}\n`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
