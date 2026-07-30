#!/usr/bin/env node
/*
 * Outer authority boundary for the M6 selected-image negative gate.  It
 * stages only reviewed source code, never the selected disk: the transient
 * child receives the exact kind-3 pathname read-only and emits a private
 * receipt containing identities only.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants, watch } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, realpath, rm, stat,
  writeFile } from
  "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256Hex } from "./cadr-m6-ready4-evidence.mjs";
import { readCanonicalSelectedImageRelease,
  M6_SELECTED_IMAGE_AUTHORITY_DERIVATION,
  M6_SELECTED_IMAGE_AUTHORITY_FILES,
  M6_SELECTED_IMAGE_GUIX_ENVIRONMENT,
  M6_SELECTED_IMAGE_PINNED_GUIX,
  M6_SELECTED_IMAGE_PINNED_NODE,
  M6_SELECTED_IMAGE_PINNED_TOOLCHAIN,
  M6_SELECTED_IMAGE_STATIC_LAUNCHER_SCHEMA,
  pinSelectedImageNegativeReceipt,
  readSelectedImageNegativeRun, selectedImageNegativeFailure,
  selectedImageLauncherSourceBinding,
  selectedImageSystemdClientsSourceBinding,
  selectedImageNegativeEffectiveEnvironment,
  validatePinnedSelectedImageNegativeReceipt,
  validateSelectedImageStaticLauncherBuildIdentity,
  validateSelectedImageNegativeRun,
  M6_SELECTED_IMAGE_NEGATIVE_SUPERVISED_SCHEMA,
  writeCanonicalNoReplace } from "./cadr-m6-selected-image-negative-evidence.mjs";
import { stageM6ExecutableClosure, validateStagedM6ExecutableClosure } from
  "./cadr-m6-wasm-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIRECT_RELATIVE = "scripts/run-cadr-m6-selected-image-negative.mjs";
const RELEASE_RELATIVE = "cadr-web/oracle/cadr-m6-release-record.json";
const UNIT_PREFIX = "cadr-m6-selected-image-negative-";
const RUNTIME_SECONDS = 600;
const SYSTEMD_CLIENT_PATHS = Object.freeze({
  systemdRun: "/usr/bin/systemd-run",
  systemctl: "/usr/bin/systemctl",
});
const SYSTEMD_CONTROL_ENVIRONMENT = Object.freeze({
  DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${process.getuid()}/bus`,
  LANG: "C",
  LC_ALL: "C",
  SYSTEMD_COLORS: "0",
  SYSTEMD_PAGER: "",
  TZ: "UTC",
  XDG_RUNTIME_DIR: `/run/user/${process.getuid()}`,
});
const EXECUTED_STAGED_FILES = Object.freeze([
  M6_SELECTED_IMAGE_AUTHORITY_DERIVATION,
  "scripts/cadr-m6-selected-image-static-launcher.c",
  "scripts/run-cadr-m6-selected-image-negative.mjs",
  "scripts/cadr-m6-selected-image-negative-evidence.mjs",
  "scripts/cadr-m6-ready4-evidence.mjs",
  RELEASE_RELATIVE,
]);
const EXECUTED_SUPERVISED_RECEIPTS = new WeakSet();
const EXECUTED_READY4_TOKENS = new WeakMap();
const PRODUCTION_DEPENDENCIES = Object.freeze(Object.create(null));

export function pinExecutedSelectedImageNegativeReceipt(receipt) {
  if (!EXECUTED_SUPERVISED_RECEIPTS.has(receipt)) {
    throw new TypeError("selected-image prerequisite was not minted by this process execution");
  }
  const bytes = Buffer.from(canonicalJson(receipt));
  const pinned = pinSelectedImageNegativeReceipt(Object.freeze({
    bytes, sha256: sha256Hex(bytes), value: receipt,
  }));
  const token = Object.freeze({});
  EXECUTED_READY4_TOKENS.set(token, pinned);
  return token;
}

export function validateExecutedSelectedImageNegativeToken(token) {
  const pinned = EXECUTED_READY4_TOKENS.get(token);
  if (pinned === undefined) {
    throw new TypeError("READY4 token was not minted by selected-image execution");
  }
  return validatePinnedSelectedImageNegativeReceipt(pinned);
}

function usage() {
  return "usage: node scripts/run-cadr-m6-selected-image-negative-systemd.mjs --execute --artifact-root ROOT --output RECEIPT.json";
}

function pathValue(value, option) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${option} needs a pathname`);
  }
  return resolve(process.cwd(), value);
}

export function parseSelectedImageNegativeSystemdArguments(argv) {
  const result = { execute: false, artifactRoot: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") {
      if (result.execute) throw new TypeError("duplicate --execute");
      result.execute = true;
    } else if (["--artifact-root", "--output"].includes(option)) {
      const key = option === "--artifact-root" ? "artifactRoot" : "output";
      if (result[key] !== null) throw new TypeError(`duplicate ${option}`);
      result[key] = pathValue(argv[++index], option);
    } else throw new TypeError(`unsupported selected-image negative systemd argument ${JSON.stringify(option)}`);
  }
  if (!result.execute || result.artifactRoot === null || result.output === null) {
    throw new TypeError(`${usage()}\nThe selected-image negative supervisor is inert without --execute.`);
  }
  return Object.freeze(result);
}

function capture(command, args, options = {}) {
  return new Promise(resolveRun => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"], ...options,
    });
    const stdout = []; const stderr = [];
    child.stdout.on("data", value => stdout.push(value));
    child.stderr.on("data", value => stderr.push(value));
    child.once("error", failure => resolveRun({ code: null, signal: null, failure,
      stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
    child.once("exit", (code, signal) => resolveRun({ code, signal, failure: null,
      stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
  });
}

function portableMode(metadata) {
  return `0${Number(metadata.mode & 0o777n).toString(8).padStart(3, "0")}`;
}

async function trustedRootOwnedPath(path, directory) {
  const metadata = await lstat(path, { bigint: true });
  if ((directory ? !metadata.isDirectory() : !metadata.isFile()) ||
      metadata.isSymbolicLink() || metadata.uid !== 0n ||
      (metadata.mode & 0o022n) !== 0n ||
      (!directory && (metadata.mode & 0o111n) === 0n)) {
    throw new TypeError(
      `selected-image systemd client ${directory ? "ancestor" : "binary"} is not root-owned and non-user-writable`);
  }
  return metadata;
}

async function systemdClientAncestors(path) {
  const ancestors = [];
  let cursor = dirname(path);
  while (true) {
    const metadata = await trustedRootOwnedPath(cursor, true);
    ancestors.push(Object.freeze({ dev: String(metadata.dev),
      gid: String(metadata.gid), ino: String(metadata.ino), path: cursor,
      uid: String(metadata.uid), mode: portableMode(metadata) }));
    if (cursor === "/") break;
    cursor = dirname(cursor);
  }
  return Object.freeze(ancestors.reverse());
}

async function pinSystemdClient(path, label) {
  if (process.getuid() === 0 || typeof path !== "string" ||
      !path.startsWith("/") || await realpath(path) !== path) {
    throw new TypeError(
      `${label} must be an exact absolute non-root-caller system binary`);
  }
  const ancestors = await systemdClientAncestors(path);
  const before = await trustedRootOwnedPath(path, false);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameBigintIdentity(before, opened)) {
      throw new TypeError(`${label} changed while it was retained`);
    }
    const bytes = await readHandleAtZero(handle, opened.size, label);
    const after = await handle.stat({ bigint: true });
    if (!sameBigintIdentity(opened, after)) {
      throw new TypeError(`${label} changed while it was hashed`);
    }
    return Object.freeze({ handle,
      descriptorPath: `/proc/${process.pid}/fd/${handle.fd}`,
      identity: Object.freeze({
        ancestry: ancestors,
        byte_count: String(bytes.byteLength),
        dev: String(opened.dev),
        gid: String(opened.gid),
        ino: String(opened.ino),
        mode: portableMode(opened),
        path,
        real_path: path,
        sha256: sha256Hex(bytes),
        uid: String(opened.uid),
      }),
      retained: Object.freeze(opened) });
  } catch (error) {
    await handle.close();
    throw error;
  }
}

export async function pinSelectedImageSystemdClients(paths =
  SYSTEMD_CLIENT_PATHS) {
  if (paths === null || typeof paths !== "object" ||
      Object.keys(paths).sort().join("\0") !==
        Object.keys(SYSTEMD_CLIENT_PATHS).sort().join("\0")) {
    throw new TypeError("selected-image systemd client paths are incomplete");
  }
  const systemdRun = await pinSystemdClient(paths.systemdRun, "systemd-run");
  try {
    const systemctl = await pinSystemdClient(paths.systemctl, "systemctl");
    return Object.freeze({
      identity: Object.freeze({
        environment: SYSTEMD_CONTROL_ENVIRONMENT,
        systemd_run: systemdRun.identity,
        systemctl: systemctl.identity,
      }),
      systemdRun, systemctl,
    });
  } catch (error) {
    await systemdRun.handle.close();
    throw error;
  }
}

async function verifySystemdClient(client, label) {
  const descriptor = await client.handle.stat({ bigint: true });
  if (!sameBigintIdentity(descriptor, client.retained) ||
      descriptor.uid !== client.retained.uid ||
      descriptor.gid !== client.retained.gid ||
      descriptor.mode !== client.retained.mode) {
    throw new TypeError(`retained ${label} identity changed`);
  }
  const bytes = await readHandleAtZero(client.handle, descriptor.size, label);
  if (String(bytes.byteLength) !== client.identity.byte_count ||
      sha256Hex(bytes) !== client.identity.sha256) {
    throw new TypeError(`retained ${label} bytes changed`);
  }
  const current = await trustedRootOwnedPath(client.identity.path, false);
  if (!sameBigintIdentity(current, client.retained) ||
      current.uid !== client.retained.uid ||
      current.gid !== client.retained.gid ||
      current.mode !== client.retained.mode ||
      await realpath(client.identity.path) !== client.identity.real_path ||
      canonicalJson(await systemdClientAncestors(client.identity.path)) !==
        canonicalJson(client.identity.ancestry)) {
    throw new TypeError(`${label} installed identity or ancestry changed`);
  }
}

function dispatchedSystemdFailure(error) {
  const failure = error instanceof Error && Object.isExtensible(error) ? error :
    new Error(String(error?.message ?? error), { cause: error });
  Object.defineProperty(failure, "dispatchBegan", {
    value: true, enumerable: false,
  });
  return failure;
}

export async function verifySelectedImageSystemdClients(clients) {
  await verifySystemdClient(clients?.systemdRun, "systemd-run");
  await verifySystemdClient(clients?.systemctl, "systemctl");
  return clients.identity;
}

export async function closeSelectedImageSystemdClients(clients) {
  const failures = [];
  for (const client of [clients?.systemdRun, clients?.systemctl]) {
    try { await client?.handle?.close(); }
    catch (error) { failures.push(error); }
  }
  if (failures.length > 0) throw failures[0];
}

async function captureSystemdClient(clients, name, args,
  captureFn = capture) {
  const client = clients[name];
  const label = name === "systemdRun" ? "systemd-run" : "systemctl";
  await verifySystemdClient(client, label);
  let result; let commandFailure = null;
  let validationFailure = null;
  try {
    try {
      result = await captureFn(client.descriptorPath, args, {
        cwd: "/",
        env: SYSTEMD_CONTROL_ENVIRONMENT,
      });
    } catch (error) {
      commandFailure = error instanceof Error ? error :
        new Error(String(error));
    }
  } finally {
    try {
      await verifySystemdClient(client, label);
    } catch (error) {
      validationFailure = error instanceof Error ? error :
        new Error(String(error));
    }
  }
  if (commandFailure !== null && validationFailure !== null) {
    const combined = new AggregateError([commandFailure, validationFailure],
      "selected-image systemd command and post-validation both failed");
    throw dispatchedSystemdFailure(combined);
  }
  if (commandFailure !== null) {
    throw dispatchedSystemdFailure(commandFailure);
  }
  if (validationFailure !== null) {
    throw dispatchedSystemdFailure(validationFailure);
  }
  return result;
}

async function captureSystemdClientOrTestSeam(clients, name, args,
  captureFn) {
  if (clients !== null && clients !== undefined) {
    return captureSystemdClient(clients, name, args, captureFn);
  }
  if (captureFn === capture) {
    throw new TypeError(
      "selected-image production systemd command lacks pinned client authority");
  }
  try {
    return await captureFn(SYSTEMD_CLIENT_PATHS[name], args, {
      cwd: "/",
      env: SYSTEMD_CONTROL_ENVIRONMENT,
    });
  } catch (error) {
    throw dispatchedSystemdFailure(error);
  }
}

export function selectedImageNegativeSystemdCommand(childArguments,
  nonce = randomBytes(16).toString("hex"), readOnlyRoots = null,
  readWriteRoot = null, launcherPath = null) {
  if (!/^[0-9a-f]{32}$/.test(nonce) || !Array.isArray(childArguments) ||
      childArguments.some(value => typeof value !== "string" ||
        /[\s\x00-\x1f\x7f]/.test(value))) {
    throw new TypeError("invalid selected-image negative systemd command");
  }
  const unit = `${UNIT_PREFIX}${nonce}.service`;
  const args = ["--user", "--no-block", "--service-type=exec", `--unit=${unit}`,
    `--property=RuntimeMaxSec=${RUNTIME_SECONDS}s`, "--property=TimeoutStopSec=30s",
    "--property=MemoryMax=536870912", "--property=MemorySwapMax=0",
    "--property=CPUQuota=100%", "--property=TasksMax=32", "--property=UMask=0077",
    "--property=LimitCORE=0",
    "--property=NoNewPrivileges=yes", "--property=PrivateNetwork=yes",
    "--property=RestrictAddressFamilies=AF_UNIX", "--property=KillMode=control-group",
    "--property=ExitType=cgroup", "--property=Restart=no", "--property=OOMPolicy=kill",
    "--property=RemainAfterExit=yes", "--property=MemoryAccounting=yes",
    "--property=TasksAccounting=yes", "--property=IOAccounting=yes", "--property=IPAccounting=yes",
    "--property=ProtectSystem=strict", "--property=ProtectHome=read-only",
    "--property=ProtectControlGroups=yes",
    "--property=ProtectKernelTunables=yes", "--property=ProtectKernelModules=yes",
    "--property=LockPersonality=yes", "--property=RestrictSUIDSGID=yes"];
  if (!Array.isArray(readOnlyRoots) || readOnlyRoots.length !== 2 ||
      readOnlyRoots.some(root => typeof root !== "string" || root.length === 0 ||
        /[\s\x00-\x1f\x7f]/.test(root))) {
    throw new TypeError("selected-image negative command needs exact authority and artifact read-only roots");
  }
  if (typeof readWriteRoot !== "string" || readWriteRoot.length === 0 ||
      /[\s\x00-\x1f\x7f]/.test(readWriteRoot)) {
    throw new TypeError("selected-image negative command needs one private write root");
  }
  if (typeof launcherPath !== "string" || !launcherPath.startsWith("/") ||
      /[\s\x00-\x1f\x7f]/.test(launcherPath)) {
    throw new TypeError("selected-image negative command needs an absolute static launcher");
  }
  const effectiveEnvironment = selectedImageNegativeEffectiveEnvironment(unit);
  const execStart = Object.freeze([launcherPath, unit,
    M6_SELECTED_IMAGE_PINNED_NODE.path, ...childArguments]);
  const fragmentPath =
    `/run/user/${process.getuid()}/systemd/transient/${unit}`;
  args.push(`--property=ReadOnlyPaths=${readOnlyRoots.join(" ")}`,
    `--property=ReadWritePaths=${readWriteRoot}`,
    `:${launcherPath}`, unit, M6_SELECTED_IMAGE_PINNED_NODE.path, ...childArguments);
  return Object.freeze({ command: SYSTEMD_CLIENT_PATHS.systemdRun, unit,
    args: Object.freeze(args),
    effectiveEnvironment, execStart, fragmentPath });
}

export function parseExactSelectedImageSystemdShow(text, expectedNames,
  label = "systemd show") {
  if (typeof text !== "string" || /[\x00\r]/.test(text) ||
      !text.endsWith("\n") || !Array.isArray(expectedNames) ||
      expectedNames.length === 0 || new Set(expectedNames).size !==
        expectedNames.length) {
    throw new TypeError(`malformed selected-image ${label} response`);
  }
  const result = Object.create(null);
  const lines = text.slice(0, -1).split("\n");
  if (lines.some(line => line.length === 0)) {
    throw new TypeError(`empty record in selected-image ${label} response`);
  }
  const expected = new Set(expectedNames);
  for (const line of lines) {
    const index = line.indexOf("=");
    if (index <= 0 || !/^[A-Za-z][A-Za-z0-9]*$/.test(line.slice(0, index))) {
      throw new TypeError(`malformed line in selected-image ${label} response`);
    }
    const name = line.slice(0, index);
    if (!expected.has(name)) {
      throw new TypeError(`unexpected selected-image ${label} property ${name}`);
    }
    if (Object.hasOwn(result, name)) {
      throw new TypeError(`duplicate selected-image ${label} property ${name}`);
    }
    result[name] = line.slice(index + 1);
  }
  for (const name of expectedNames) {
    if (!Object.hasOwn(result, name)) {
      throw new TypeError(`missing selected-image ${label} property ${name}`);
    }
  }
  return Object.freeze(result);
}

export function validateSelectedImageNegativeExecStart(value, expected) {
  if (typeof value !== "string" || !Array.isArray(expected) ||
      expected.length === 0) {
    throw new TypeError("invalid selected-image negative ExecStart identity");
  }
  const fixed = `{ path=${expected[0]} ; argv[]=${expected.join(" ")} ; ` +
    "ignore_errors=no ; ";
  if (!value.startsWith(fixed)) {
    throw new Error("selected-image negative ExecStart command differs");
  }
  const dynamic = value.slice(fixed.length);
  const match =
    /^start_time=(\[[^\]\r\n]+\]) ; stop_time=(\[[^\]\r\n]+\]) ; pid=(0|[1-9][0-9]*) ; code=(\(null\)|exited|killed|dumped) ; status=(0|[1-9][0-9]*)\/(0|[1-9][0-9]*) \}$/.exec(
      dynamic);
  if (match === null) {
    throw new Error(
      "selected-image negative ExecStart is not one complete command record");
  }
  return Object.freeze({
    start_time: match[1],
    stop_time: match[2],
    pid: match[3],
    code: match[4],
    status_signal: match[5],
    status_code: match[6],
  });
}

const POLICY = Object.freeze({ TimeoutStopUSec: "30s",
  MemoryMax: "536870912", MemorySwapMax: "0",
  CPUQuotaPerSecUSec: "1s", TasksMax: "32", UMask: "0077",
  LimitCORE: "0",
  NoNewPrivileges: "yes", PrivateNetwork: "yes", RestrictAddressFamilies: "AF_UNIX",
  KillMode: "control-group", ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes", ProtectSystem: "strict",
  ProtectHome: "read-only", ProtectControlGroups: "yes",
  ProtectKernelTunables: "yes", ProtectKernelModules: "yes", LockPersonality: "yes",
  RestrictSUIDSGID: "yes" });

function exactWordSet(value, expected, label) {
  const words = typeof value === "string" && value.length > 0 ?
    value.split(/\s+/).filter(Boolean) : [];
  const actual = new Set(words); const desired = new Set(expected);
  if (actual.size !== words.length || actual.size !== desired.size ||
      ![...desired].every(item => actual.has(item))) {
    throw new Error(`selected-image negative effective systemd ${label} differs`);
  }
  return Object.freeze([...actual].sort());
}

const DURATION_FACTORS_US = Object.freeze({
  us: 1n, ms: 1000n, s: 1000000n, min: 60000000n, h: 3600000000n,
});

export function parseSelectedImageNegativeDurationUSec(value) {
  const match = /^([1-9][0-9]{0,15})(us|ms|s|min|h)$/.exec(value ?? "");
  if (match === null) {
    throw new TypeError("selected-image negative systemd duration is not a bounded single-unit value");
  }
  const amount = BigInt(match[1]);
  const result = amount * DURATION_FACTORS_US[match[2]];
  if (result > 86400000000n) {
    throw new TypeError("selected-image negative systemd duration exceeds one day");
  }
  return result;
}

export function validateSelectedImageNegativeSystemdPolicy(value, authorityRoot,
  artifactRoot, privateRoot, unit) {
  for (const [field, expected] of Object.entries(POLICY)) {
    if (value?.[field] !== expected) {
      throw new Error(`selected-image negative effective systemd policy differs at ${field}`);
    }
  }
  if (parseSelectedImageNegativeDurationUSec(value?.RuntimeMaxUSec) !==
      BigInt(RUNTIME_SECONDS) * 1000000n) {
    throw new Error("selected-image negative effective systemd policy differs at RuntimeMaxUSec");
  }
  exactWordSet(value?.ReadOnlyPaths, [authorityRoot, artifactRoot], "read-only paths");
  exactWordSet(value?.ReadWritePaths, [privateRoot], "read-write paths");
  exactWordSet(value?.Environment, [], "unit environment assignments");
  return value;
}

export function validateSelectedImageNegativeSystemdAccounting(value) {
  for (const field of ["MemoryPeak", "CPUUsageNSec"]) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(value?.[field] ?? "")) {
      throw new Error(`selected-image negative systemd accounting is unavailable at ${field}`);
    }
  }
  for (const field of ["TasksCurrent", "IOReadBytes", "IOWriteBytes",
    "IPIngressBytes", "IPEgressBytes"]) {
    if (!/^(?:0|[1-9][0-9]*|\[not set\]|\[no data\])$/.test(value?.[field] ?? "")) {
      throw new Error(`selected-image negative systemd accounting is malformed at ${field}`);
    }
  }
  return value;
}

const WAIT_PROPERTIES = Object.freeze([
  "ActiveState", "SubState", "Result", "ExecMainCode", "ExecMainStatus",
]);
const RECOVERY_PROPERTIES = Object.freeze([
  "LoadState", "Transient", "FragmentPath", "Type", "ExecStart",
]);
const ABSENCE_PROPERTIES = Object.freeze(["LoadState"]);
const ACCOUNTING_PROPERTIES = Object.freeze([
  "Result", "ExecMainCode", "ExecMainStatus", "MemoryPeak", "CPUUsageNSec",
  "TasksCurrent", "IOReadBytes", "IOWriteBytes", "IPIngressBytes",
  "IPEgressBytes", "RuntimeMaxUSec", "TimeoutStopUSec", "MemoryMax",
  "MemorySwapMax", "CPUQuotaPerSecUSec", "TasksMax", "UMask", "LimitCORE",
  "NoNewPrivileges", "PrivateNetwork", "RestrictAddressFamilies", "KillMode",
  "ExitType", "Restart", "OOMPolicy", "RemainAfterExit", "MemoryAccounting",
  "TasksAccounting", "IOAccounting", "IPAccounting", "ProtectSystem",
  "ProtectHome", "ProtectControlGroups", "ProtectKernelTunables",
  "ProtectKernelModules", "LockPersonality", "RestrictSUIDSGID",
  "ReadOnlyPaths", "ReadWritePaths", "Environment",
]);

async function waitForResult(unit, clients) {
  for (let second = 0; second < RUNTIME_SECONDS + 30; second += 1) {
    const result = await captureSystemdClient(clients, "systemctl",
      ["--user", "--no-pager", "show", unit,
        `--property=${WAIT_PROPERTIES.join(",")}`]);
    if (result.code === 0 && result.signal === null) {
      const state = parseExactSelectedImageSystemdShow(
        result.stdout.toString("utf8"), WAIT_PROPERTIES,
        "wait-state");
      if ((state.ActiveState === "active" && state.SubState === "exited") ||
          state.ActiveState === "failed") return;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000));
  }
  throw new Error("selected-image negative systemd worker exceeded bounded observation");
}

/* Returning a unit name is the ownership commit.  A systemd-run refusal has
 * no owned unit, so cleanup must never issue stop/reset against a coincident
 * pre-existing name. */
export async function startSelectedImageNegativeUnit(command,
  { captureFn = capture, clients = null } = {}) {
  let started = null; let dispatchFailure = null;
  try {
    started = await captureSystemdClientOrTestSeam(clients,
      "systemdRun", command.args, captureFn);
  } catch (error) {
    if (error?.dispatchBegan !== true) throw error;
    dispatchFailure = error;
  }
  if (started !== null && started.code === 0 && started.signal === null &&
      started.failure === null) {
    return command.unit;
  }
  let shown;
  try {
    shown = await captureSystemdClientOrTestSeam(clients, "systemctl",
      ["--user", "--no-pager", "show", command.unit,
        `--property=${RECOVERY_PROPERTIES.join(",")}`], captureFn);
  } catch (error) {
    const failure = new Error(
      "ambiguous systemd-run outcome could not be recovered with retained systemctl",
    { cause: dispatchFailure ?? error });
    failure.preserveStage = true;
    failure.recoveryFailure = error;
    throw failure;
  }
  if (shown.code === 0 && shown.signal === null && shown.failure === null) {
    try {
      const state = parseExactSelectedImageSystemdShow(
        shown.stdout.toString("utf8"), RECOVERY_PROPERTIES,
        "ambiguous-recovery");
      if (state.LoadState === "not-found") {
        if (dispatchFailure !== null) {
          dispatchFailure.absenceProved = true;
          throw dispatchFailure;
        }
        throw Object.assign(new Error(
          "systemd-run refused selected-image negative worker and unit absence was proved"),
        { absenceProved: true });
      }
      if (state.LoadState === "loaded" && state.Transient === "yes" &&
          state.FragmentPath === command.fragmentPath && state.Type === "exec") {
        validateSelectedImageNegativeExecStart(state.ExecStart,
          command.execStart);
        return command.unit;
      }
    } catch (error) {
      if (error?.absenceProved === true) throw error;
    }
  }
  const failure = new Error(
    "ambiguous systemd-run outcome has an absent-or-wrong-identity unit");
  if (dispatchFailure !== null) failure.cause = dispatchFailure;
  failure.preserveStage = true;
  throw failure;
}

export async function stopAndRemoveSelectedImageNegativeUnit(unit, clients,
  { captureFn = capture, delayFn = async milliseconds =>
    new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) } = {}) {
  await captureSystemdClient(clients, "systemctl",
    ["--user", "--no-pager", "stop", unit], captureFn);
  await captureSystemdClient(clients, "systemctl",
    ["--user", "--no-pager", "reset-failed", unit], captureFn);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const left = await captureSystemdClient(clients, "systemctl",
      ["--user", "--no-pager", "show", unit,
        `--property=${ABSENCE_PROPERTIES.join(",")}`], captureFn);
    if (left.code === 0 && left.signal === null && left.failure === null) {
      try {
        const state = parseExactSelectedImageSystemdShow(
          left.stdout.toString("utf8"), ABSENCE_PROPERTIES,
          "unit-absence");
        if (state.LoadState === "not-found") return;
      } catch {
        // Malformed or non-exact output never proves absence.
      }
    }
    await delayFn(100);
  }
  throw new Error("selected-image negative transient unit absence is unverified");
}

async function requireAbsent(path, label) {
  try { await lstat(path); }
  catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${label} absence is unverified`);
}

export async function removeSelectedImageNegativeStage(root) {
  await rm(root, { recursive: true });
  await requireAbsent(root, "selected-image negative stage");
}

async function readStableRegular(path, label, executable = false) {
  const metadata = await lstat(path, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() ||
      (executable && (metadata.mode & 0o111n) === 0n)) {
    throw new TypeError(`${label} is not a regular non-symlink${executable ? " executable" : " file"}`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== metadata.dev ||
        opened.ino !== metadata.ino || opened.size !== metadata.size ||
        opened.ctimeNs !== metadata.ctimeNs || opened.mtimeNs !== metadata.mtimeNs) {
      throw new TypeError(`${label} changed while opening`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.byteLength) !== metadata.size || after.dev !== metadata.dev ||
        after.ino !== metadata.ino || after.size !== metadata.size ||
        after.ctimeNs !== metadata.ctimeNs || after.mtimeNs !== metadata.mtimeNs) {
      throw new TypeError(`${label} changed while reading`);
    }
    return Object.freeze({ bytes, metadata: Object.freeze({
      dev: metadata.dev, ino: metadata.ino, size: metadata.size,
      ctimeNs: metadata.ctimeNs, mtimeNs: metadata.mtimeNs,
      mode: metadata.mode, uid: metadata.uid,
    }) });
  } finally { await handle.close(); }
}

async function readRetainedDescriptor(path, label) {
  if (!/^\/proc\/[1-9][0-9]*\/fd\/[0-9]+$/.test(path)) {
    throw new TypeError(`${label} is not a retained descriptor path`);
  }
  const handle = await open(path, constants.O_RDONLY);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new TypeError(`${label} descriptor is not a bounded regular file`);
    }
    const bytes = await readHandleAtZero(handle, before.size, label);
    const after = await handle.stat({ bigint: true });
    if (!sameBigintIdentity(before, after)) {
      throw new TypeError(`${label} descriptor changed while reading`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

export function parseStaticLauncherElf(bytes) {
  if (bytes.byteLength < 64 || bytes[0] !== 0x7f || bytes[1] !== 0x45 ||
      bytes[2] !== 0x4c || bytes[3] !== 0x46 || bytes[4] !== 2 ||
      bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62) {
    throw new TypeError("selected-image launcher is not the reviewed ELF64 x86-64 image");
  }
  const programOffset = Number(bytes.readBigUInt64LE(32));
  const entrySize = bytes.readUInt16LE(54);
  const entryCount = bytes.readUInt16LE(56);
  if (entrySize < 56 || !Number.isSafeInteger(programOffset) ||
      programOffset + entrySize * entryCount > bytes.byteLength) {
    throw new TypeError("selected-image launcher has an invalid program-header table");
  }
  let ptInterp = false; let ptDynamic = false; let dtNeeded = false;
  for (let index = 0; index < entryCount; index += 1) {
    const offset = programOffset + index * entrySize;
    const type = bytes.readUInt32LE(offset);
    if (type === 3) ptInterp = true;
    if (type === 2) {
      ptDynamic = true;
      const dynamicOffset = Number(bytes.readBigUInt64LE(offset + 8));
      const dynamicSize = Number(bytes.readBigUInt64LE(offset + 32));
      if (!Number.isSafeInteger(dynamicOffset) ||
          !Number.isSafeInteger(dynamicSize) ||
          dynamicOffset + dynamicSize > bytes.byteLength ||
          dynamicSize % 16 !== 0) {
        throw new TypeError("selected-image launcher has an invalid dynamic segment");
      }
      for (let cursor = dynamicOffset; cursor < dynamicOffset + dynamicSize;
        cursor += 16) {
        const tag = bytes.readBigInt64LE(cursor);
        if (tag === 1n) dtNeeded = true;
        if (tag === 0n) break;
      }
    }
  }
  if (ptInterp || ptDynamic || dtNeeded) {
    throw new TypeError("selected-image launcher has PT_INTERP, PT_DYNAMIC, or DT_NEEDED");
  }
  return Object.freeze({ class: "ELF64", endian: "little",
    machine: "x86-64", pt_interp: false, pt_dynamic: false,
    dt_needed: Object.freeze([]) });
}

function exactLauncherBuildIdentity(identity) {
  return validateSelectedImageStaticLauncherBuildIdentity(identity);
}

function authoritySourcePath(entry) {
  if (entry.role === "entry") return DIRECT_RELATIVE;
  if (entry.role === "release-record") return RELEASE_RELATIVE;
  if (entry.relative_path.endsWith("/cadr-m6-selected-image-negative-evidence.mjs")) {
    return "scripts/cadr-m6-selected-image-negative-evidence.mjs";
  }
  if (entry.relative_path.endsWith("/cadr-m6-ready4-evidence.mjs")) {
    return "scripts/cadr-m6-ready4-evidence.mjs";
  }
  return null;
}

function retainedAuthorityInput(sourceAuthority, relativePath) {
  const name = Object.entries(AUTHORITY_INPUT_PATHS).find(([, path]) =>
    path === relativePath)?.[0];
  if (name === undefined || typeof sourceAuthority?.[name] !== "string") {
    throw new TypeError(`selected-image retained authority input is missing ${relativePath}`);
  }
  return sourceAuthority[name];
}

function currentProcessCanMutate(metadata) {
  const groups = new Set(process.getgroups().map(value => BigInt(value)));
  return metadata.uid === BigInt(process.geteuid()) ||
    (metadata.mode & 0o002n) !== 0n ||
    ((metadata.mode & 0o020n) !== 0n && groups.has(metadata.gid));
}

async function trustedGuixAncestry(path, finalDirectory = false) {
  if (typeof path !== "string" || !path.startsWith("/") ||
      await realpath(path) !== path) {
    throw new TypeError("selected-image Guix path is not exact and absolute");
  }
  const components = path === "/" ? ["/"] :
    ["/", ...path.slice(1).split("/").map((_, index, parts) =>
      `/${parts.slice(0, index + 1).join("/")}`)];
  const identities = [];
  for (const [index, component] of components.entries()) {
    const metadata = await lstat(component, { bigint: true });
    const directory = index < components.length - 1 || finalDirectory;
    if (metadata.isSymbolicLink() ||
        (directory ? !metadata.isDirectory() : !metadata.isFile()) ||
        currentProcessCanMutate(metadata)) {
      throw new TypeError(
        "selected-image Guix path or ancestor is caller-writable or has the wrong type");
    }
    identities.push(Object.freeze({
      dev: String(metadata.dev), gid: String(metadata.gid),
      ino: String(metadata.ino), mode: portableMode(metadata),
      path: component, uid: String(metadata.uid),
    }));
  }
  return Object.freeze(identities);
}

async function pinGuixClient() {
  const ancestry = await trustedGuixAncestry(
    M6_SELECTED_IMAGE_PINNED_GUIX.path);
  const handle = await open(M6_SELECTED_IMAGE_PINNED_GUIX.path,
    constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const retained = await handle.stat({ bigint: true });
    const bytes = await readHandleAtZero(handle, retained.size,
      "selected-image pinned Guix client");
    if (String(bytes.byteLength) !== M6_SELECTED_IMAGE_PINNED_GUIX.byte_count ||
        sha256Hex(bytes) !== M6_SELECTED_IMAGE_PINNED_GUIX.sha256) {
      throw new TypeError(
        "selected-image Guix client differs from the reviewed identity");
    }
    return Object.freeze({ ancestry, handle,
      descriptorPath: `/proc/${process.pid}/fd/${handle.fd}`,
      retained: Object.freeze(retained) });
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function verifyGuixClient(client) {
  const descriptor = await client.handle.stat({ bigint: true });
  if (!sameBigintIdentity(descriptor, client.retained) ||
      descriptor.uid !== client.retained.uid ||
      descriptor.gid !== client.retained.gid ||
      descriptor.mode !== client.retained.mode) {
    throw new TypeError("selected-image retained Guix client identity changed");
  }
  const bytes = await readHandleAtZero(client.handle, descriptor.size,
    "selected-image retained Guix client");
  if (String(bytes.byteLength) !== M6_SELECTED_IMAGE_PINNED_GUIX.byte_count ||
      sha256Hex(bytes) !== M6_SELECTED_IMAGE_PINNED_GUIX.sha256 ||
      canonicalJson(await trustedGuixAncestry(
        M6_SELECTED_IMAGE_PINNED_GUIX.path)) !==
        canonicalJson(client.ancestry)) {
    throw new TypeError(
      "selected-image installed Guix client or ancestry changed");
  }
}

async function capturePinnedGuix(client, args, options, captureFn) {
  await verifyGuixClient(client);
  let result; let commandFailure = null;
  let validationFailure = null;
  try {
    try {
      result = await captureFn(client.descriptorPath, args, options);
    } catch (error) {
      commandFailure = error instanceof Error ? error : new Error(String(error));
    }
  } finally {
    try { await verifyGuixClient(client); }
    catch (error) {
      validationFailure = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (commandFailure !== null && validationFailure !== null) {
    throw new AggregateError([commandFailure, validationFailure],
      "selected-image Guix command and post-validation both failed");
  }
  if (commandFailure !== null) throw commandFailure;
  if (validationFailure !== null) throw validationFailure;
  return result;
}

export async function buildSelectedImageGuixAuthority(sourceAuthority,
  sourceClosure,
  { captureFn = capture } = {}) {
  const guix = await pinGuixClient();
  try {
  const derivationPath = retainedAuthorityInput(sourceAuthority,
    M6_SELECTED_IMAGE_AUTHORITY_DERIVATION);
  const guixEnvironment = Object.freeze({
    ...M6_SELECTED_IMAGE_GUIX_ENVIRONMENT,
    M6_AUTHORITY_LAUNCHER_SOURCE: retainedAuthorityInput(sourceAuthority,
      "scripts/cadr-m6-selected-image-static-launcher.c"),
    M6_AUTHORITY_CHILD_SOURCE: retainedAuthorityInput(sourceAuthority,
      DIRECT_RELATIVE),
    M6_AUTHORITY_SELECTED_EVIDENCE: retainedAuthorityInput(sourceAuthority,
      "scripts/cadr-m6-selected-image-negative-evidence.mjs"),
    M6_AUTHORITY_READY4_EVIDENCE: retainedAuthorityInput(sourceAuthority,
      "scripts/cadr-m6-ready4-evidence.mjs"),
    M6_AUTHORITY_RELEASE_RECORD: retainedAuthorityInput(sourceAuthority,
      RELEASE_RELATIVE),
  });
  const built = await capturePinnedGuix(guix,
    ["build", "-f", derivationPath,
    "--no-grafts"], { cwd: "/",
      env: guixEnvironment }, captureFn);
  if (built.code !== 0 || built.signal !== null || built.failure !== null) {
    throw new TypeError("selected-image immutable Guix authority build failed");
  }
  const lines = built.stdout.toString("utf8").trim().split("\n").filter(Boolean);
  if (lines.length !== 1 ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-cadr-m6-selected-image-authority$/
        .test(lines[0])) {
    throw new TypeError("selected-image Guix build returned an unexpected output");
  }
  const outputPath = lines[0];
  const derived = await capturePinnedGuix(guix,
    ["build", "-f", derivationPath,
    "--no-grafts", "--derivations"],
  { cwd: "/", env: guixEnvironment }, captureFn);
  const derivations = derived.stdout.toString("utf8").trim().split("\n")
    .filter(Boolean);
  if (derived.code !== 0 || derived.signal !== null ||
      derived.failure !== null || derivations.length !== 1 ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-cadr-m6-selected-image-authority\.drv$/
        .test(derivations[0])) {
    throw new TypeError("selected-image Guix authority derivation is unavailable");
  }
  await trustedGuixAncestry(derivations[0]);
  await trustedGuixAncestry(M6_SELECTED_IMAGE_PINNED_NODE.derivation);
  await trustedGuixAncestry(M6_SELECTED_IMAGE_PINNED_TOOLCHAIN.derivation);
  await trustedGuixAncestry(M6_SELECTED_IMAGE_PINNED_TOOLCHAIN.path, true);
  const derivationReferences = await capturePinnedGuix(guix,
    ["gc", "--references", derivations[0]],
  { cwd: "/", env: M6_SELECTED_IMAGE_GUIX_ENVIRONMENT }, captureFn);
  const derivationReferenceSet = new Set(derivationReferences.stdout
    .toString("utf8").trim().split("\n").filter(Boolean));
  if (derivationReferences.code !== 0 ||
      derivationReferences.signal !== null ||
      derivationReferences.failure !== null ||
      !derivationReferenceSet.has(M6_SELECTED_IMAGE_PINNED_NODE.derivation) ||
      !derivationReferenceSet.has(M6_SELECTED_IMAGE_PINNED_TOOLCHAIN.derivation)) {
    throw new TypeError("selected-image Guix derivation lacks the reviewed Node or toolchain");
  }
  if (await realpath(outputPath) !== outputPath) {
    throw new TypeError("selected-image Guix authority output is a symbolic link");
  }
  await trustedGuixAncestry("/gnu", true);
  await trustedGuixAncestry("/gnu/store", true);
  await trustedGuixAncestry(outputPath, true);
  await trustedGuixAncestry(M6_SELECTED_IMAGE_PINNED_NODE.path);
  const store = await stat("/gnu/store", { bigint: true });
  const output = await lstat(outputPath, { bigint: true });
  if (!store.isDirectory() || (store.mode & 0o1000n) === 0n ||
      !output.isDirectory() || output.isSymbolicLink() ||
      output.uid !== store.uid || (output.mode & 0o222n) !== 0n) {
    throw new TypeError("selected-image Guix authority is outside the immutable daemon-owned store");
  }
  const files = [];
  for (const expected of M6_SELECTED_IMAGE_AUTHORITY_FILES) {
    const path = resolve(outputPath, expected.relative_path);
    await trustedGuixAncestry(path);
    const opened = await readStableRegular(path,
      `selected-image Guix authority ${expected.role}`,
      expected.role === "launcher");
    const mode = `0${(Number(opened.metadata.mode & 0o777n)).toString(8)}`;
    if (mode !== expected.mode) {
      throw new TypeError("selected-image Guix authority file mode differs");
    }
    const sourcePath = authoritySourcePath(expected);
    if (sourcePath !== null) {
      const source = await readRetainedDescriptor(retainedAuthorityInput(
        sourceAuthority, sourcePath),
      `selected-image authority source ${sourcePath}`);
      if (!opened.bytes.equals(source)) {
        throw new TypeError("selected-image Guix authority copied bytes differ from reviewed source");
      }
    }
    files.push(Object.freeze({ ...expected,
      byte_count: String(opened.bytes.byteLength),
      sha256: sha256Hex(opened.bytes) }));
  }
  const launcher = files.find(entry => entry.role === "launcher");
  const launcherBytes = await readFile(resolve(outputPath,
    launcher.relative_path));
  const references = await capturePinnedGuix(guix,
    ["gc", "--references", outputPath],
  { cwd: "/", env: M6_SELECTED_IMAGE_GUIX_ENVIRONMENT }, captureFn);
  if (references.code !== 0 || references.signal !== null ||
      references.failure !== null ||
      !references.stdout.toString("utf8").split("\n")
        .includes(dirname(dirname(M6_SELECTED_IMAGE_PINNED_NODE.path)))) {
    throw new TypeError("selected-image Guix authority lacks the reviewed Node closure");
  }
  return exactLauncherBuildIdentity(Object.freeze({
    schema: M6_SELECTED_IMAGE_STATIC_LAUNCHER_SCHEMA,
    kind: "guix-store-execution-authority",
    derivation: M6_SELECTED_IMAGE_AUTHORITY_DERIVATION,
    guix: M6_SELECTED_IMAGE_PINNED_GUIX,
    guix_environment: M6_SELECTED_IMAGE_GUIX_ENVIRONMENT,
    guix_arguments: Object.freeze(["build", "-f",
      M6_SELECTED_IMAGE_AUTHORITY_DERIVATION, "--no-grafts"]),
    output_path: outputPath,
    source_closure_sha256: sourceClosure.source_closure_sha256,
    node: M6_SELECTED_IMAGE_PINNED_NODE,
    toolchain: M6_SELECTED_IMAGE_PINNED_TOOLCHAIN,
    files: Object.freeze(files),
    elf: parseStaticLauncherElf(launcherBytes),
  }));
  } finally {
    await guix.handle.close();
  }
}

async function verifyGuixAuthority(identity) {
  const authority = exactLauncherBuildIdentity(identity);
  await trustedGuixAncestry(authority.output_path, true);
  await trustedGuixAncestry(authority.node.path);
  for (const expected of authority.files) {
    const path = resolve(authority.output_path, expected.relative_path);
    await trustedGuixAncestry(path);
    const current = await readStableRegular(path,
      `selected-image current Guix authority ${expected.role}`,
    expected.role === "launcher");
    if (String(current.bytes.byteLength) !== expected.byte_count ||
        sha256Hex(current.bytes) !== expected.sha256) {
      throw new TypeError("selected-image immutable Guix authority identity changed");
    }
  }
  return authority;
}

const STAGED_JAVASCRIPT_PINS = new WeakMap();

function sameBigintIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino &&
    left.size === right.size && left.ctimeNs === right.ctimeNs &&
    left.mtimeNs === right.mtimeNs;
}

async function readHandleAtZero(handle, size, label) {
  if (size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TypeError(`${label} is too large to retain`);
  }
  const bytes = Buffer.alloc(Number(size)); let offset = 0;
  while (offset < bytes.byteLength) {
    const result = await handle.read(bytes, offset, bytes.byteLength - offset,
      offset);
    if (result.bytesRead === 0) throw new TypeError(`${label} returned a short read`);
    offset += result.bytesRead;
  }
  return bytes;
}

export async function pinSelectedImageStagedExecutionClosure(sourceRoot,
  relativePaths = EXECUTED_STAGED_FILES, { watchFactory = watch } = {}) {
  if (!Array.isArray(relativePaths) || relativePaths.length === 0 ||
      new Set(relativePaths).size !== relativePaths.length ||
      relativePaths.some(path => typeof path !== "string" ||
        path.startsWith("/") || path.includes("..")) ||
      typeof watchFactory !== "function") {
    throw new TypeError("selected-image staged execution-file pin paths are invalid");
  }
  const audit = { dirty: false, error: null, unexpectedClose: false,
    intentionalClose: false };
  const files = []; const directories = []; const watchers = new Map();

  const identityOf = metadata => Object.freeze({
    dev: metadata.dev, ino: metadata.ino, size: metadata.size,
    ctimeNs: metadata.ctimeNs, mtimeNs: metadata.mtimeNs,
  });

  const addWatch = (directory, name) => {
    let retained = watchers.get(directory);
    if (retained === undefined) {
      const names = new Set();
      const watcher = watchFactory(directory, { persistent: false },
        (_event, filename) => {
          if (filename === null || names.has(String(filename))) audit.dirty = true;
        });
      watcher.on("error", error => { audit.error = error; });
      watcher.on("close", () => {
        if (!audit.intentionalClose) audit.unexpectedClose = true;
      });
      retained = { watcher, names };
      watchers.set(directory, retained);
    }
    retained.names.add(name);
  };

  const openDirectoryEntry = async (parent, name, relativePath,
    { trusted = false } = {}) => {
    const path = parent === null ? relativePath :
      `/proc/self/fd/${parent.handle.fd}/${name}`;
    if (parent !== null) addWatch(`/proc/self/fd/${parent.handle.fd}`, name);
    const metadata = await lstat(path, { bigint: true });
    if (trusted && (metadata.uid !== 0n ||
        ((metadata.mode & 0o022n) !== 0n &&
          (metadata.mode & 0o1000n) === 0n))) {
      throw new TypeError("selected-image trusted stage parent is not root-owned and immutable-or-sticky");
    }
    const handle = await open(path, constants.O_RDONLY |
      constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const opened = await handle.stat({ bigint: true });
    if (!metadata.isDirectory() || !opened.isDirectory() ||
        !sameBigintIdentity(metadata, opened)) {
      await handle.close();
      throw new TypeError(`selected-image staged directory changed while opening: ${relativePath}`);
    }
    const record = Object.freeze({ path, relativePath, name, parent, handle,
      trusted, identity: identityOf(opened) });
    directories.push(record);
    return record;
  };

  try {
    const stageRoot = dirname(sourceRoot);
    const trustedParentPath = dirname(stageRoot);
    const trustedParent = await openDirectoryEntry(null, null,
      trustedParentPath, { trusted: true });
    const stage = await openDirectoryEntry(trustedParent, basename(stageRoot),
      basename(stageRoot));
    const source = await openDirectoryEntry(stage, basename(sourceRoot),
      basename(sourceRoot));
    const byRelativeDirectory = new Map([["", source]]);

    const ensureDirectory = async relativeDirectory => {
      if (byRelativeDirectory.has(relativeDirectory)) {
        return byRelativeDirectory.get(relativeDirectory);
      }
      const components = relativeDirectory.split("/"); let current = source;
      let prefix = "";
      for (const component of components) {
        prefix = prefix === "" ? component : `${prefix}/${component}`;
        if (!byRelativeDirectory.has(prefix)) {
          byRelativeDirectory.set(prefix, await openDirectoryEntry(current,
            component, prefix));
        }
        current = byRelativeDirectory.get(prefix);
      }
      return current;
    };

    for (const relativePath of relativePaths) {
      const relativeDirectory = dirname(relativePath) === "." ? "" :
        dirname(relativePath);
      const parent = await ensureDirectory(relativeDirectory);
      const name = basename(relativePath);
      addWatch(`/proc/self/fd/${parent.handle.fd}`, name);
      const path = `/proc/self/fd/${parent.handle.fd}/${name}`;
      const metadata = await lstat(path, { bigint: true });
      if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new TypeError(`selected-image staged execution file is not regular: ${relativePath}`);
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || !sameBigintIdentity(metadata, opened)) {
        await handle.close();
        throw new TypeError(`selected-image staged execution file changed while opening: ${relativePath}`);
      }
      const bytes = await readHandleAtZero(handle, opened.size,
        `selected-image staged execution file ${relativePath}`);
      const after = await handle.stat({ bigint: true });
      if (!sameBigintIdentity(opened, after)) {
        await handle.close();
        throw new TypeError(`selected-image staged execution file changed while pinning: ${relativePath}`);
      }
      files.push(Object.freeze({ path, name, parent, relativePath, handle,
        identity: identityOf(opened),
        bytes, sha256: sha256Hex(bytes) }));
    }
    if (audit.dirty || audit.error !== null || audit.unexpectedClose) {
      throw audit.error ?? new TypeError("selected-image staged execution file changed while pinning");
    }
    const token = Object.freeze({ paths: Object.freeze([...relativePaths]),
      closure_sha256: sha256Hex(Buffer.from(canonicalJson(files.map(entry => ({
        path: entry.relativePath, byte_count: String(entry.bytes.byteLength),
        sha256: entry.sha256,
      }))))) });
    STAGED_JAVASCRIPT_PINS.set(token, Object.freeze({
      audit, files: Object.freeze(files), directories: Object.freeze(directories),
      watchers: Object.freeze([...watchers.values()]),
      descriptorSourceRoot: `/proc/${process.pid}/fd/${source.handle.fd}`,
    }));
    return token;
  } catch (error) {
    audit.intentionalClose = true;
    for (const entry of files) await entry.handle.close().catch(() => undefined);
    for (const retained of watchers.values()) retained.watcher.close();
    for (const directory of directories.reverse()) {
      await directory.handle.close().catch(() => undefined);
    }
    throw error;
  }
}

function retainedSelectedImageStage(token) {
  const retained = STAGED_JAVASCRIPT_PINS.get(token);
  if (retained === undefined) {
    throw new TypeError("selected-image staged execution-file pin is not retained");
  }
  return retained;
}

export function selectedImagePinnedSourceRoot(token) {
  return retainedSelectedImageStage(token).descriptorSourceRoot;
}

export function selectedImagePinnedFile(token, relativePath) {
  const retained = retainedSelectedImageStage(token);
  const entry = retained.files.find(candidate =>
    candidate.relativePath === relativePath);
  if (entry === undefined) {
    throw new TypeError("selected-image staged file was not retained");
  }
  return Object.freeze({ bytes: Buffer.from(entry.bytes),
    byte_count: String(entry.bytes.byteLength), sha256: entry.sha256 });
}

const AUTHORITY_INPUT_PATHS = Object.freeze({
  derivation: M6_SELECTED_IMAGE_AUTHORITY_DERIVATION,
  launcherSource: "scripts/cadr-m6-selected-image-static-launcher.c",
  childSource: DIRECT_RELATIVE,
  selectedEvidence: "scripts/cadr-m6-selected-image-negative-evidence.mjs",
  ready4Evidence: "scripts/cadr-m6-ready4-evidence.mjs",
  releaseRecord: RELEASE_RELATIVE,
});

export function selectedImagePinnedAuthorityInputs(token) {
  const retained = retainedSelectedImageStage(token);
  const output = {};
  for (const [name, relativePath] of Object.entries(AUTHORITY_INPUT_PATHS)) {
    const entry = retained.files.find(candidate =>
      candidate.relativePath === relativePath);
    if (entry === undefined) {
      throw new TypeError(`selected-image retained authority lacks ${relativePath}`);
    }
    output[name] = `/proc/${process.pid}/fd/${entry.handle.fd}`;
  }
  return Object.freeze(output);
}

export async function verifyPinnedSelectedImageStagedExecutionClosure(token) {
  const retained = retainedSelectedImageStage(token);
  await new Promise(resolveTurn => setImmediate(resolveTurn));
  if (retained.audit.error !== null || retained.audit.dirty ||
      retained.audit.unexpectedClose) {
    throw retained.audit.error ??
      new TypeError("selected-image staged execution-file watcher observed mutation");
  }
  for (const directory of retained.directories) {
    const descriptor = await directory.handle.stat({ bigint: true });
    if (!descriptor.isDirectory() ||
        (!directory.trusted &&
          !sameBigintIdentity(descriptor, directory.identity)) ||
        (directory.trusted &&
          (descriptor.dev !== directory.identity.dev ||
            descriptor.ino !== directory.identity.ino))) {
      throw new TypeError("selected-image staged execution-file directory identity drift");
    }
    if (directory.trusted) {
      const currentTrusted = await lstat(directory.path, { bigint: true });
      if (!currentTrusted.isDirectory() ||
          currentTrusted.dev !== directory.identity.dev ||
          currentTrusted.ino !== directory.identity.ino) {
        throw new TypeError("selected-image trusted stage ancestor identity drift");
      }
    }
    if (directory.parent !== null) {
      const currentHandle = await open(
        `/proc/self/fd/${directory.parent.handle.fd}/${directory.name}`,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        const current = await currentHandle.stat({ bigint: true });
        if (!current.isDirectory() ||
            !sameBigintIdentity(current, directory.identity)) {
          throw new TypeError("selected-image staged execution-file ancestor entry drift");
        }
      } finally { await currentHandle.close(); }
    }
  }
  for (const entry of retained.files) {
    const descriptor = await entry.handle.stat({ bigint: true });
    if (!sameBigintIdentity(descriptor, entry.identity)) {
      throw new TypeError(`selected-image staged execution-file descriptor drift: ${entry.relativePath}`);
    }
    const descriptorBytes = await readHandleAtZero(entry.handle, entry.identity.size,
      `selected-image staged execution file ${entry.relativePath}`);
    if (!descriptorBytes.equals(entry.bytes) ||
        sha256Hex(descriptorBytes) !== entry.sha256) {
      throw new TypeError(`selected-image staged execution-file byte drift: ${entry.relativePath}`);
    }
    const currentHandle = await open(
      `/proc/self/fd/${entry.parent.handle.fd}/${entry.name}`,
      constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const current = await currentHandle.stat({ bigint: true });
      const currentBytes = await readHandleAtZero(currentHandle, current.size,
        `selected-image current staged execution file ${entry.relativePath}`);
      if (!current.isFile() || !sameBigintIdentity(current, entry.identity) ||
          !currentBytes.equals(entry.bytes) ||
          sha256Hex(currentBytes) !== entry.sha256) {
        throw new TypeError(`selected-image staged execution-file directory-entry drift: ${entry.relativePath}`);
      }
    } finally { await currentHandle.close(); }
  }
  await new Promise(resolveTurn => setImmediate(resolveTurn));
  if (retained.audit.error !== null || retained.audit.dirty ||
      retained.audit.unexpectedClose) {
    throw retained.audit.error ??
      new TypeError("selected-image staged execution-file watcher observed mutation");
  }
  return token;
}

export async function closePinnedSelectedImageStagedExecutionClosure(token) {
  const retained = STAGED_JAVASCRIPT_PINS.get(token);
  if (retained === undefined) return;
  STAGED_JAVASCRIPT_PINS.delete(token);
  retained.audit.intentionalClose = true;
  for (const entry of retained.files) await entry.handle.close();
  for (const retainedWatcher of retained.watchers) retainedWatcher.watcher.close();
  for (const directory of [...retained.directories].reverse()) {
    await directory.handle.close();
  }
}

async function stageSelectedImageNegativeSource() {
    const root = await mkdtemp(resolve(tmpdir(), "cadr-m6-selected-image-negative-"));
  try {
    const sourceRoot = resolve(root, "source");
    const sourceClosure = await stageM6ExecutableClosure(ROOT, sourceRoot);
    const privateRoot = resolve(root, "private");
    await mkdir(privateRoot, { mode: 0o700 });
    const nonce = resolve(root, "invocation.nonce");
    await writeFile(nonce, randomBytes(32), { flag: "wx", mode: 0o400 });
    await chmod(nonce, 0o400);
    await validateStagedM6ExecutableClosure(sourceRoot, sourceClosure);
    return Object.freeze({ root, sourceRoot, sourceClosure,
      privateRoot, nonce,
      release: resolve(sourceRoot, RELEASE_RELATIVE),
      envelope: resolve(privateRoot, "result.json") });
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

function compactPolicy(accounting) {
  const output = { RuntimeMaxUSec:
    `${parseSelectedImageNegativeDurationUSec(accounting.RuntimeMaxUSec)}us` };
  for (const key of Object.keys(POLICY)) output[key] = accounting[key];
  output.ReadOnlyPaths = exactWordSet(accounting.ReadOnlyPaths,
    String(accounting.ReadOnlyPaths ?? "").split(/\s+/).filter(Boolean),
  "read-only paths");
  output.ReadWritePaths = exactWordSet(accounting.ReadWritePaths,
    String(accounting.ReadWritePaths ?? "").split(/\s+/).filter(Boolean),
  "read-write paths");
  output.Environment = exactWordSet(accounting.Environment,
    String(accounting.Environment ?? "").split(/\s+/).filter(Boolean), "environment");
  return Object.freeze(output);
}

export async function executeSelectedImageNegativeSystemd(options,
  dependencies = undefined) {
  const productionExecution = arguments.length === 1;
  const overrides = productionExecution ? PRODUCTION_DEPENDENCIES : dependencies;
  if (overrides === null || typeof overrides !== "object") {
    throw new TypeError("selected-image dependency seam must be an object");
  }
  const stageSource = overrides.stageSource ?? stageSelectedImageNegativeSource;
  const validateClosure = overrides.validateClosure ??
    validateStagedM6ExecutableClosure;
  const pinStaged = overrides.pinStaged ??
    pinSelectedImageStagedExecutionClosure;
  const verifyPinned = overrides.verifyPinned ??
    verifyPinnedSelectedImageStagedExecutionClosure;
  const closePinned = overrides.closePinned ??
    closePinnedSelectedImageStagedExecutionClosure;
  const pinnedSourceRoot = overrides.pinnedSourceRoot ??
    selectedImagePinnedSourceRoot;
  const pinnedFile = overrides.pinnedFile ?? selectedImagePinnedFile;
  const pinnedAuthority = overrides.pinnedAuthority ??
    selectedImagePinnedAuthorityInputs;
  const buildAuthority = overrides.buildAuthority ??
    buildSelectedImageGuixAuthority;
  const pinSystemdClients = overrides.pinSystemdClients ??
    pinSelectedImageSystemdClients;
  const verifySystemdClients = overrides.verifySystemdClients ??
    verifySelectedImageSystemdClients;
  const closeSystemdClients = overrides.closeSystemdClients ??
    closeSelectedImageSystemdClients;
  const startUnit = overrides.startUnit ?? startSelectedImageNegativeUnit;
  const waitUnit = overrides.waitUnit ?? waitForResult;
  const captureUnit = overrides.captureUnit ?? capture;
  const readRun = overrides.readRun ?? readSelectedImageNegativeRun;
  const verifyLauncher = overrides.verifyLauncher ?? verifyGuixAuthority;
  const stopUnit = overrides.stopUnit ??
    stopAndRemoveSelectedImageNegativeUnit;
  const removeStage = overrides.removeStage ??
    removeSelectedImageNegativeStage;
  const publish = overrides.publish ?? writeCanonicalNoReplace;
  let stage = null; let unit = null; let unitAbsent = false;
  let systemdClients = null; let systemdClientIdentity = null;
  let stagedPin = null; let retainedLauncherIdentity = null;
  let preserveStage = false;
  try {
    systemdClients = await pinSystemdClients();
    systemdClientIdentity = await verifySystemdClients(systemdClients);
    stage = await stageSource();
    stagedPin = await pinStaged(stage.sourceRoot);
    const descriptorSourceRoot = pinnedSourceRoot(stagedPin);
    const retainedRelease = pinnedFile(stagedPin, RELEASE_RELATIVE);
    const release = readCanonicalSelectedImageRelease(retainedRelease.bytes);
    await validateClosure(descriptorSourceRoot, stage.sourceClosure);
    await verifyPinned(stagedPin);
    retainedLauncherIdentity = await buildAuthority(pinnedAuthority(stagedPin),
      stage.sourceClosure);
    await verifyPinned(stagedPin);
    if (retainedLauncherIdentity.source_closure_sha256 !==
        stage.sourceClosure.source_closure_sha256) {
      throw new TypeError("selected-image Guix authority lost its source-closure binding");
    }
    const authorityRoot = retainedLauncherIdentity.output_path;
    const launcherFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "launcher");
    const childFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "entry");
    const releaseFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "release-record");
    const child = resolve(authorityRoot, childFile.relative_path);
    const releasePath = resolve(authorityRoot, releaseFile.relative_path);
    const launcher = resolve(authorityRoot, launcherFile.relative_path);
    const command = selectedImageNegativeSystemdCommand([
      child, "--execute", "--systemd-child", "--artifact-root", options.artifactRoot,
      "--release-record", releasePath, "--source-commit", stage.sourceClosure.source_commit,
      "--source-closure-sha256", stage.sourceClosure.source_closure_sha256,
      "--invocation-nonce-file", stage.nonce, "--output", stage.envelope,
    ], undefined, [authorityRoot, options.artifactRoot], stage.privateRoot,
    launcher);
    try {
      unit = await startUnit(command, { clients: systemdClients });
    } catch (error) {
      preserveStage = error?.preserveStage === true;
      throw error;
    }
    await waitUnit(unit, systemdClients);
    const accountingArguments = ["--user", "--no-pager", "show", unit,
      `--property=${ACCOUNTING_PROPERTIES.join(",")}`];
    const shown = captureUnit === capture ?
      await captureSystemdClient(systemdClients, "systemctl",
        accountingArguments) :
      await captureUnit(SYSTEMD_CLIENT_PATHS.systemctl,
        accountingArguments, { cwd: "/", env: SYSTEMD_CONTROL_ENVIRONMENT });
    if (shown.code !== 0 || shown.signal !== null) {
      throw new Error("could not read selected-image negative systemd accounting");
    }
    const accounting = parseExactSelectedImageSystemdShow(
      shown.stdout.toString("utf8"), ACCOUNTING_PROPERTIES, "accounting");
    validateSelectedImageNegativeSystemdPolicy(accounting, authorityRoot,
      options.artifactRoot, stage.privateRoot, unit);
    validateSelectedImageNegativeSystemdAccounting(accounting);
    if (accounting.Result !== "success" || accounting.ExecMainCode !== "1" ||
        accounting.ExecMainStatus !== "0") {
      throw new Error("selected-image negative systemd worker failed");
    }
    const childReceipt = await readRun(stage.envelope,
      "private selected-image negative child receipt");
    const run = validateSelectedImageNegativeRun(childReceipt.value);
    if (run.source_commit !== stage.sourceClosure.source_commit ||
        run.source_closure_sha256 !== stage.sourceClosure.source_closure_sha256 ||
        run.release_record.byte_count !== release.identity.byte_count ||
        run.release_record.sha256 !== release.identity.sha256 ||
        run.selected_disk.byte_count !== release.selected_disk.byte_count ||
        run.selected_disk.sha256 !== release.selected_disk.sha256 ||
        canonicalJson(run.effective_environment) !==
          canonicalJson(command.effectiveEnvironment)) {
      throw new Error("selected-image negative child changed its staged source or release identity");
    }
    await verifyPinned(stagedPin);
    await verifyLauncher(retainedLauncherIdentity);
    systemdClientIdentity = await verifySystemdClients(systemdClients);
    await stopUnit(unit, systemdClients); unitAbsent = true; unit = null;
    systemdClientIdentity = await verifySystemdClients(systemdClients);
    await closeSystemdClients(systemdClients); systemdClients = null;
    await closePinned(stagedPin); stagedPin = null;
    await removeStage(stage.root); stage = null;
    const receipt = Object.freeze({
      schema: M6_SELECTED_IMAGE_NEGATIVE_SUPERVISED_SCHEMA,
      outcome: "selected-image-negative-supervised",
      run,
      launcher: retainedLauncherIdentity,
      launcher_source_binding_sha256:
        selectedImageLauncherSourceBinding(run, retainedLauncherIdentity),
      systemd_clients: systemdClientIdentity,
      systemd_clients_source_binding_sha256:
        selectedImageSystemdClientsSourceBinding(run, systemdClientIdentity),
      accounting_sha256: sha256Hex(Buffer.from(canonicalJson(accounting))),
      policy_sha256: sha256Hex(Buffer.from(canonicalJson(compactPolicy(accounting)))),
      transient_unit_absent: true,
      source_stage_removed: true,
      private_root_removed: true,
    });
    await publish(options.output, receipt);
    if (productionExecution) EXECUTED_SUPERVISED_RECEIPTS.add(receipt);
    return receipt;
  } catch (error) {
    let cleanupError = null;
    if (unit !== null) {
      try {
        await stopUnit(unit, systemdClients); unitAbsent = true; unit = null;
      }
      catch (failure) { cleanupError = failure; }
    }
    if (systemdClients !== null && (unitAbsent || unit === null)) {
      try {
        await closeSystemdClients(systemdClients); systemdClients = null;
      } catch (failure) { cleanupError ??= failure; }
    }
    if (!preserveStage && stagedPin !== null && (unitAbsent || unit === null)) {
      try { await closePinned(stagedPin); stagedPin = null; }
      catch (failure) { cleanupError ??= failure; }
    }
    if (!preserveStage && stage !== null && (unitAbsent || unit === null)) {
      try { await removeStage(stage.root); stage = null; }
      catch (failure) { cleanupError ??= failure; }
    }
    const authoritative = cleanupError ?? error;
    await publish(`${options.output}.failure.json`,
      selectedImageNegativeFailure(cleanupError === null ?
        "selected-image-negative-systemd-failed" :
        "selected-image-negative-systemd-cleanup-failed",
      sha256Hex(Buffer.from(String(authoritative?.message ?? authoritative)))))
      .catch(() => undefined);
    throw authoritative;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
  } else executeSelectedImageNegativeSystemd(
    parseSelectedImageNegativeSystemdArguments(process.argv.slice(2))).catch(error => {
      process.stderr.write(`selected-image negative supervisor failed: ${error.message}\n`);
      process.exitCode = 1;
    });
}
