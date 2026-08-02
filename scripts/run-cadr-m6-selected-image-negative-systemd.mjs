#!/usr/bin/env node
/*
 * Outer authority boundary for the M6 selected-image negative gate.  It
 * stages only reviewed source code, never the selected disk: the transient
 * child receives the exact kind-3 pathname read-only and emits a private
 * receipt containing identities only.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
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
  M6_SELECTED_IMAGE_PEER_CONNECT_SOURCE,
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
const CAPTURE_OUTPUT_LIMIT = 65536;
const FAILURE_TEXT_LIMIT = 2048;
const FAILURE_OUTPUT_COUNT_LIMIT = 1048576;
const SYSTEMD_CLIENT_PATHS = Object.freeze({
  busctl: "/usr/bin/busctl",
  systemdRun: "/usr/bin/systemd-run",
  systemctl: "/usr/bin/systemctl",
});
const SYSTEM_BUS_PATH = "/run/dbus/system_bus_socket";
const SYSTEM_BUS_ENVIRONMENT = Object.freeze({
  DBUS_SYSTEM_BUS_ADDRESS: `unix:path=${SYSTEM_BUS_PATH}`,
  LANG: "C", LC_ALL: "C", SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "", TZ: "UTC",
});
const SYSTEMD_CONTROL_ENVIRONMENT = Object.freeze({
  // The selected control clients inherit a preconnected AF_UNIX stream at
  // fd 3.  They therefore never resolve the mutable bus pathname themselves.
  DBUS_SESSION_BUS_ADDRESS: "unix:fd=3",
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
  "scripts/cadr-m6-systemd-peer-connect.c",
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

export function createSelectedImageFailureOutputCollector() {
  const state = { chunks: [], count: 0, hash: createHash("sha256"),
    overflow: false, retained: 0 };
  return Object.freeze({
    add(value) {
      const bytes = Buffer.from(value);
      state.hash.update(bytes);
      if (!state.overflow) {
        if (bytes.length > FAILURE_OUTPUT_COUNT_LIMIT - state.count) {
          state.overflow = true;
        } else state.count += bytes.length;
      }
      const remaining = CAPTURE_OUTPUT_LIMIT - state.retained;
      if (remaining > 0) {
        const kept = bytes.subarray(0, remaining);
        state.chunks.push(kept); state.retained += kept.length;
      }
    },
    finish() {
      return Object.freeze({
        bytes: Buffer.concat(state.chunks),
        identity: Object.freeze({
          byte_count: state.overflow ? null : String(state.count),
          overflow: state.overflow,
          sha256: state.hash.digest("hex"),
        }),
      });
    },
  });
}

function capture(command, args, options = {}) {
  return new Promise(resolveRun => {
    const { controlPeerConnector = null, controlPeer = null,
      ...childOptions } = options;
    if ((controlPeerConnector === null) !== (controlPeer === null)) {
      resolveRun({ code: null, signal: null, failure: new TypeError(
        "selected-image systemd control peer binding is incomplete"),
      stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
      return;
    }
    const boundCommand = controlPeerConnector === null ? command :
      controlPeerConnector.descriptorPath;
    const boundArgs = controlPeerConnector === null ? args : [
      "--socket", controlPeerConnector.busPath,
      "--peer-uid", controlPeer.uid,
      "--peer-gid", controlPeer.gid,
      "--peer-pid", controlPeer.pid,
      "--peer-ppid", controlPeer.ppid,
      "--peer-start-time", controlPeer.start_time,
      "--boot-id", controlPeer.boot_id,
      "--peer-comm", controlPeer.comm,
      "--peer-argv-byte-count", controlPeer.argv.byte_count,
      "--peer-argv-count", controlPeer.argv.count,
      "--peer-argv-sha256", controlPeer.argv.sha256,
      "--peer-cgroup-byte-count", controlPeer.cgroup.byte_count,
      "--peer-cgroup-sha256", controlPeer.cgroup.sha256,
      "--", command, ...args,
    ];
    const child = spawn(boundCommand, boundArgs, {
      stdio: ["ignore", "pipe", "pipe"], ...childOptions,
    });
    const stdout = createSelectedImageFailureOutputCollector();
    const stderr = createSelectedImageFailureOutputCollector();
    child.stdout.on("data", value => stdout.add(value));
    child.stderr.on("data", value => stderr.add(value));
    let settled = false;
    const finish = (code, signal, failure) => {
      if (settled) return; settled = true;
      const capturedStdout = stdout.finish();
      const capturedStderr = stderr.finish();
      resolveRun({ code, signal, failure,
        stdout: capturedStdout.bytes, stderr: capturedStderr.bytes,
        stdoutIdentity: capturedStdout.identity,
        stderrIdentity: capturedStderr.identity });
    };
    let spawnFailure = null;
    child.once("error", failure => { spawnFailure = failure; });
    child.once("close", (code, signal) => finish(
      spawnFailure === null ? code : null,
      spawnFailure === null ? signal : null, spawnFailure));
  });
}

function boundedUtf8(bytes, limit = FAILURE_TEXT_LIMIT, complete = false) {
  const end = Math.min(bytes.length, limit);
  try {
    // Streaming decode rejects malformed complete sequences but deliberately
    // withholds an incomplete final code point.  That is exactly the boundary
    // distinction needed when the retained or diagnostic prefix cuts UTF-8.
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, end), { stream: !(complete && end === bytes.length) });
  } catch { return null; }
}

function boundedFailureText(value) {
  const bytes = Buffer.from(String(value ?? ""));
  return boundedUtf8(bytes, 512, true) ?? "invalid-error-text";
}

function refusalOutput(result, name) {
  const bytes = result?.[name];
  if (!Buffer.isBuffer(bytes)) {
    throw new TypeError(`selected-image refused ${name} is not bytes`);
  }
  const supplied = result?.[`${name}Identity`];
  let byteCount; let digest; let overflow = false;
  if (supplied !== undefined) {
    if (typeof supplied?.overflow !== "boolean" ||
        (!supplied.overflow &&
          !/^(?:0|[1-9][0-9]*)$/.test(supplied?.byte_count ?? "")) ||
        (supplied.overflow && supplied.byte_count !== null) ||
        !/^[0-9a-f]{64}$/.test(supplied?.sha256 ?? "") ||
        (!supplied.overflow &&
          BigInt(supplied.byte_count) < BigInt(bytes.length)) ||
        bytes.length > CAPTURE_OUTPUT_LIMIT) {
      throw new TypeError(`selected-image refused ${name} identity is invalid`);
    }
    byteCount = supplied.byte_count; digest = supplied.sha256;
    overflow = supplied.overflow;
  } else {
    byteCount = String(bytes.length); digest = sha256Hex(bytes);
  }
  const fullyRetained = !overflow &&
    BigInt(byteCount) === BigInt(bytes.length);
  const diagnosticText = boundedUtf8(bytes, FAILURE_TEXT_LIMIT,
    fullyRetained);
  const diagnosticBytes = diagnosticText === null ? null :
    Buffer.from(diagnosticText);
  return Object.freeze({ byte_count: byteCount,
    diagnostic_byte_count: diagnosticBytes === null ? null :
      String(diagnosticBytes.length),
    diagnostic_sha256: diagnosticBytes === null ? null :
      sha256Hex(diagnosticBytes),
    diagnostic_text: diagnosticText, overflow, sha256: digest,
    retained_byte_count: String(bytes.length),
    retained_sha256: sha256Hex(bytes),
    truncated: overflow || BigInt(byteCount) > BigInt(CAPTURE_OUTPUT_LIMIT) });
}

function selectedImageRefusalEvidence(command, result, absence) {
  if (!command.args.includes("--no-block") ||
      command.args.some(value => ["--pipe", "--pty", "--pty-late", "--wait"]
        .includes(value))) {
    throw new TypeError(
      "selected-image refusal diagnostic is not isolated from child output");
  }
  let stage; let spawnError = null;
  if (result.failure !== null) {
    stage = "connector-spawn-failure";
    spawnError = Object.freeze({
      name: boundedFailureText(result.failure?.name ?? "Error"),
      message: boundedFailureText(result.failure?.message ?? result.failure),
    });
  } else if (result.signal !== null) stage = "completed-client-signal";
  else if (Number.isSafeInteger(result.code) && result.code > 0) {
    stage = "completed-client-nonzero";
  } else {
    throw new TypeError("selected-image refusal result is not classifiable");
  }
  const preChild = stage === "connector-spawn-failure";
  return Object.freeze({ absence_proof: absence === null ? null :
    Object.freeze({ FragmentPath: absence.FragmentPath,
      LoadState: absence.LoadState, Transient: absence.Transient,
      Type: absence.Type, ordering: "connector-process-not-spawned-v1" }),
  child_output_possible: !preChild,
  client: "pinned-systemd-run-via-peer-connector",
  code: result.code, signal: result.signal, spawn_error: spawnError, stage,
  dispatch_terminality: preChild ? "pre-child-spawn-failure" :
    "unknown-after-client-start",
  stderr: refusalOutput(result, "stderr"),
  stdout: refusalOutput(result, "stdout"), unit: command.unit });
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

function filesystemIdentity(path, metadata, kind) {
  return Object.freeze({ dev: String(metadata.dev), gid: String(metadata.gid),
    ino: String(metadata.ino), kind, mode: portableMode(metadata), path,
    uid: String(metadata.uid) });
}

async function systemBusEndpointIdentity() {
  const metadata = await lstat(SYSTEM_BUS_PATH, { bigint: true });
  if (!metadata.isSocket() || metadata.isSymbolicLink() || metadata.uid !== 0n ||
      metadata.gid !== 0n || (metadata.mode & 0o777n) !== 0o666n) {
    throw new TypeError("selected-image root system bus socket is untrusted");
  }
  return Object.freeze({
    ancestry: await systemdClientAncestors(SYSTEM_BUS_PATH),
    socket: filesystemIdentity(SYSTEM_BUS_PATH, metadata, "socket"),
  });
}

async function verifySystemBusEndpoint(identity) {
  const current = await systemBusEndpointIdentity();
  if (canonicalJson(current) !== canonicalJson(identity)) {
    throw new TypeError("selected-image root system bus identity changed");
  }
  return current;
}

async function pinSystemBusEndpointAuthority(watchFactory) {
  const authority = { closed: new Set(), failure: null,
    intentionalClose: false, watchers: [] };
  try {
    configureEndpointWatcher(authority, watchFactory(dirname(SYSTEM_BUS_PATH),
      { persistent: false }, (_event, filename) => {
        const name = filename === null ? null : filename.toString();
        if (name === null || name === basename(SYSTEM_BUS_PATH)) {
          endpointWatchFailure(authority, name === null ?
            "root bus directory event filename unavailable" :
            "root system bus entry mutation");
        }
      }), "root-bus-directory");
    configureEndpointWatcher(authority, watchFactory(SYSTEM_BUS_PATH,
      { persistent: false }, event => endpointWatchFailure(authority,
        `root system bus ${String(event)} mutation`)), "root-bus-socket");
    authority.identity = await systemBusEndpointIdentity();
    if (authority.failure !== null) throw authority.failure;
    return authority;
  } catch (error) {
    await closeSystemBusEndpointAuthority(authority, { allowFailed: true })
      .catch(() => undefined);
    throw error;
  }
}

async function verifySystemBusEndpointAuthority(authority) {
  await synchronizeSystemdControlEndpointWatch();
  if (authority?.failure !== null && authority?.failure !== undefined) {
    throw authority.failure;
  }
  if (authority?.intentionalClose === true || authority?.closed?.size !== 0) {
    throw new Error("selected-image root system bus watch is not active");
  }
  return verifySystemBusEndpoint(authority.identity);
}

async function closeSystemBusEndpointAuthority(authority,
  { allowFailed = false } = {}) {
  if (!allowFailed) await verifySystemBusEndpointAuthority(authority);
  authority.intentionalClose = true;
  const closed = authority.watchers.map(({ role, watcher }) =>
    new Promise(resolveClose => {
      if (authority.closed.has(role)) resolveClose();
      else watcher.once("close", resolveClose);
      watcher.close();
    }));
  await Promise.all(closed);
  if (!allowFailed) {
    if (authority.failure !== null) throw authority.failure;
    await verifySystemBusEndpoint(authority.identity);
  }
}

export function parseSelectedImageRootMainPID(text) {
  const match = /^\{"type":"u","data":([1-9][0-9]*)\}\n$/.exec(text ?? "");
  if (match === null || !Number.isSafeInteger(Number(match[1])) ||
      BigInt(match[1]) > 4294967295n) {
    throw new TypeError("selected-image root MainPID reply is not exact typed uint32 JSON");
  }
  return match[1];
}

function rootMainPIDArguments(uid = process.getuid()) {
  if (!Number.isSafeInteger(uid) || uid <= 0) {
    throw new TypeError("selected-image root MainPID UID is invalid");
  }
  return Object.freeze(["--system", "--no-pager", "--json=short",
    "get-property", "org.freedesktop.systemd1",
    `/org/freedesktop/systemd1/unit/user_40${uid}_2eservice`,
    "org.freedesktop.systemd1.Service", "MainPID"]);
}

async function processIdentity(pidText) {
  if (!/^[1-9][0-9]*$/.test(pidText ?? "")) {
    throw new TypeError("selected-image root-selected process PID is invalid");
  }
  const pid = Number(pidText);
  if (!Number.isSafeInteger(pid)) {
    throw new TypeError("selected-image root-selected process PID is too large");
  }
  const procPath = `/proc/${pidText}`;
  const proc = await lstat(procPath, { bigint: true });
  const statBytes = await readFile(`${procPath}/stat`);
  const statText = statBytes.toString("utf8");
  const close = statText.lastIndexOf(")");
  if (close <= 0 || statText[close + 1] !== " " || !statText.endsWith("\n")) {
    throw new TypeError("selected-image root-selected process stat is malformed");
  }
  const fields = statText.slice(close + 2, -1).split(" ");
  const ppid = fields[1]; const startTime = fields[19];
  if (!/^[1-9][0-9]*$/.test(ppid ?? "") ||
      !/^[1-9][0-9]*$/.test(startTime ?? "")) {
    throw new TypeError("selected-image root-selected process stat identity differs");
  }
  const bootBytes = await readFile("/proc/sys/kernel/random/boot_id");
  const bootMatch = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\n$/.exec(
    bootBytes.toString("ascii"));
  const commBytes = await readFile(`${procPath}/comm`);
  if (bootMatch === null || commBytes.length < 2 ||
      commBytes.at(-1) !== 0x0a || commBytes.subarray(0, -1).includes(0x0a) ||
      commBytes.includes(0x00)) {
    throw new TypeError("selected-image root-selected boot or comm identity is malformed");
  }
  const argv = await readFile(`${procPath}/cmdline`);
  const cgroup = await readFile(`${procPath}/cgroup`);
  if (argv.length === 0 || argv.at(-1) !== 0 || cgroup.length === 0 ||
      cgroup.at(-1) !== 0x0a) {
    throw new TypeError("selected-image root-selected argv or cgroup is malformed");
  }
  const argvCount = argv.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0);
  if (argvCount === 0) {
    throw new TypeError("selected-image root-selected argv is empty");
  }
  const after = await lstat(procPath, { bigint: true });
  if (!proc.isDirectory() || !sameBigintIdentity(proc, after) ||
      proc.uid !== BigInt(process.getuid())) {
    throw new TypeError("selected-image root-selected process identity changed");
  }
  return Object.freeze({ boot_id: bootMatch[1],
    cgroup: Object.freeze({ byte_count: String(cgroup.length),
      sha256: sha256Hex(cgroup), value: cgroup.toString("utf8") }),
    comm: commBytes.subarray(0, -1).toString("utf8"),
    gid: String(proc.gid), pid: pidText, ppid, start_time: startTime,
    uid: String(proc.uid), proc: Object.freeze({ dev: String(proc.dev),
      gid: String(proc.gid), ino: String(proc.ino), mode: portableMode(proc),
      path: procPath, uid: String(proc.uid) }),
    argv: Object.freeze({ byte_count: String(argv.length),
      count: String(argvCount), sha256: sha256Hex(argv) }) });
}

function validateRootSelectedProcessProfile(identity) {
  const uid = String(process.getuid());
  const expectedCgroup =
    `0::/user.slice/user-${uid}.slice/user@${uid}.service/init.scope\n`;
  if (identity?.uid !== uid || identity?.comm !== "systemd" ||
      identity?.ppid !== "1" || identity?.argv?.count !== "2" ||
      identity?.cgroup?.value !== expectedCgroup ||
      identity.cgroup.byte_count !== String(Buffer.byteLength(expectedCgroup)) ||
      identity.cgroup.sha256 !== sha256Hex(Buffer.from(expectedCgroup))) {
    throw new TypeError("selected-image root MainPID process profile differs");
  }
  return identity;
}

async function verifyProcessIdentity(identity) {
  const current = await processIdentity(identity.pid);
  if (canonicalJson(current) !== canonicalJson(identity)) {
    throw new TypeError("selected-image root-selected user manager process drifted");
  }
  return current;
}

async function systemdControlEndpointIdentity() {
  const uid = process.getuid();
  if (!Number.isSafeInteger(uid) || uid <= 0) {
    throw new TypeError("selected-image systemd control UID is invalid");
  }
  const runtimePath = `/run/user/${uid}`;
  const busPath = `${runtimePath}/bus`;
  if (SYSTEMD_CONTROL_ENVIRONMENT.XDG_RUNTIME_DIR !== runtimePath ||
      SYSTEMD_CONTROL_ENVIRONMENT.DBUS_SESSION_BUS_ADDRESS !== "unix:fd=3") {
    throw new TypeError("selected-image systemd control environment path differs");
  }
  const ancestry = await systemdClientAncestors(runtimePath);
  const runtime = await lstat(runtimePath, { bigint: true });
  const bus = await lstat(busPath, { bigint: true });
  if (!runtime.isDirectory() || runtime.isSymbolicLink() ||
      runtime.uid !== BigInt(uid) || (runtime.mode & 0o777n) !== 0o700n ||
      !bus.isSocket() || bus.isSymbolicLink() || bus.uid !== BigInt(uid) ||
      (bus.mode & 0o777n) !== 0o666n) {
    throw new TypeError(
      "selected-image systemd runtime directory or AF_UNIX bus is untrusted");
  }
  return Object.freeze({ ancestry,
    bus_socket: filesystemIdentity(busPath, bus, "socket"),
    runtime_directory: filesystemIdentity(runtimePath, runtime, "directory"),
    uid: String(uid) });
}

async function verifySystemdControlEndpoint(identity) {
  const current = await systemdControlEndpointIdentity();
  if (canonicalJson(current) !== canonicalJson(identity)) {
    throw new TypeError(
      "selected-image systemd runtime directory or AF_UNIX bus identity changed");
  }
  return current;
}

function endpointWatchFailure(authority, reason) {
  authority.failure ??= new Error(
    `selected-image systemd endpoint watch failed: ${reason}`);
}

function configureEndpointWatcher(authority, watcher, role) {
  watcher.on("error", error => endpointWatchFailure(authority,
    `${role} error ${String(error?.message ?? error)}`));
  watcher.on("close", () => {
    authority.closed.add(role);
    if (!authority.intentionalClose) {
      endpointWatchFailure(authority, `${role} closed unexpectedly`);
    }
  });
  authority.watchers.push(Object.freeze({ role, watcher }));
  return watcher;
}

async function pinSystemdControlEndpointAuthority(watchFactory) {
  const uid = process.getuid();
  const runtimePath = `/run/user/${uid}`;
  const busPath = `${runtimePath}/bus`;
  const authority = {
    closed: new Set(), failure: null, intentionalClose: false, watchers: [],
  };
  try {
    configureEndpointWatcher(authority, watchFactory(runtimePath,
      { persistent: false }, (_event, filename) => {
        const name = filename === null ? null : filename.toString();
        if (name === null || name === "bus") {
          // Node's fs.watch does not expose Linux IN_Q_OVERFLOW as a
          // separately decoded event.  A missing filename is therefore not
          // claimed to be a decoded overflow; it is an equally fatal loss of
          // event attribution for the watched bus directory.
          endpointWatchFailure(authority,
            name === null ? "runtime directory event filename unavailable" :
              "runtime directory bus-entry mutation");
        }
      }), "runtime-directory");
    configureEndpointWatcher(authority, watchFactory(busPath,
      { persistent: false }, event => endpointWatchFailure(authority,
        `bus socket ${String(event)} mutation`)), "bus-socket");
    const identity = await systemdControlEndpointIdentity();
    if (authority.failure !== null) throw authority.failure;
    authority.identity = identity;
    return authority;
  } catch (error) {
    await closeSystemdControlEndpointAuthority(authority,
      { allowFailed: true }).catch(() => undefined);
    throw error;
  }
}

async function synchronizeSystemdControlEndpointWatch() {
  // A child-process completion and an fs.watch callback can become runnable in
  // either order.  Cross a complete check -> timers -> poll -> check sequence
  // before accepting the command result, so callbacks already queued through
  // libuv cannot remain behind the child completion that we just observed.
  await new Promise(resolveImmediate => setImmediate(resolveImmediate));
  await new Promise(resolveTimer => setTimeout(resolveTimer, 0));
  await new Promise(resolveImmediate => setImmediate(resolveImmediate));
}

async function verifySystemdControlEndpointAuthority(authority) {
  await synchronizeSystemdControlEndpointWatch();
  if (authority?.failure !== null && authority?.failure !== undefined) {
    throw authority.failure;
  }
  if (authority?.intentionalClose === true ||
      authority?.closed?.size !== 0) {
    throw new Error("selected-image systemd endpoint watch is not active");
  }
  return verifySystemdControlEndpoint(authority.identity);
}

async function closeSystemdControlEndpointAuthority(authority,
  { allowFailed = false } = {}) {
  if (!allowFailed) await verifySystemdControlEndpointAuthority(authority);
  authority.intentionalClose = true;
  const closed = authority.watchers.map(({ role, watcher }) =>
    new Promise(resolveClose => {
      if (authority.closed.has(role)) resolveClose();
      else watcher.once("close", resolveClose);
      watcher.close();
    }));
  await Promise.all(closed);
  if (!allowFailed) {
    if (authority.failure !== null) throw authority.failure;
    await verifySystemdControlEndpoint(authority.identity);
  }
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

function parseSystemdPeerProbe(text) {
  if (text !== "pidfd_profile=so-peerpidfd-v1\n") {
    throw new TypeError("selected-image systemd peer pidfd profile is malformed");
  }
  return "so-peerpidfd-v1";
}

function peerConnectorArguments(socketPath, peer) {
  return ["--socket", socketPath, "--peer-uid", peer.uid,
    "--peer-gid", peer.gid, "--peer-pid", peer.pid,
    "--peer-ppid", peer.ppid, "--peer-start-time", peer.start_time,
    "--boot-id", peer.boot_id, "--peer-comm", peer.comm,
    "--peer-argv-byte-count", peer.argv.byte_count,
    "--peer-argv-count", peer.argv.count,
    "--peer-argv-sha256", peer.argv.sha256,
    "--peer-cgroup-byte-count", peer.cgroup.byte_count,
    "--peer-cgroup-sha256", peer.cgroup.sha256];
}

async function pinSystemdPeerConnector(input, endpoint) {
  if (input === null || typeof input !== "object" ||
      typeof input.path !== "string" || !input.path.startsWith("/") ||
      input.expected === null || typeof input.expected !== "object" ||
      input.source === null || typeof input.source !== "object" ||
      typeof endpoint?.bus_socket?.path !== "string") {
    throw new TypeError("selected-image systemd peer connector bus path is invalid");
  }
  const { path, expected, source } = input;
  if (expected.role !== "peer-connector" || expected.mode !== "0555" ||
      !/^[1-9][0-9]*$/.test(expected.byte_count ?? "") ||
      !/^[0-9a-f]{64}$/.test(expected.sha256 ?? "") ||
      source.role !== "peer-connector-source" ||
      !/^[0-9a-f]{64}$/.test(source.sha256 ?? "")) {
    throw new TypeError("selected-image systemd peer connector authority is invalid");
  }
  let handle = null;
  try {
    await trustedGuixAncestry(path);
    const binary = await readStableRegular(path,
      "selected-image systemd peer connector", true);
    if (String(binary.bytes.byteLength) !== expected.byte_count ||
        sha256Hex(binary.bytes) !== expected.sha256) {
      throw new TypeError("selected-image systemd peer connector differs from authority build");
    }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const retained = await handle.stat({ bigint: true });
    if (!retained.isFile() || !sameBigintIdentity(retained, binary.metadata)) {
      throw new TypeError("selected-image systemd peer connector changed while retained");
    }
    return Object.freeze({ descriptorPath: `/proc/${process.pid}/fd/${handle.fd}`,
      handle,
      identity: Object.freeze({ byte_count: String(binary.bytes.byteLength),
        dev: String(retained.dev), gid: String(retained.gid), ino: String(retained.ino),
        mode: portableMode(retained), path, real_path: path,
        sha256: sha256Hex(binary.bytes), source_sha256: source.sha256,
        uid: String(retained.uid) }),
      busPath: endpoint.bus_socket.path, retained: Object.freeze(retained) });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    throw error;
  }
}

async function verifySystemdPeerConnector(connector) {
  if (connector?.testSeam === true) return connector;
  const descriptor = await connector?.handle?.stat({ bigint: true });
  if (!sameBigintIdentity(descriptor, connector?.retained)) {
    throw new TypeError("selected-image retained systemd peer connector identity changed");
  }
  const bytes = await readHandleAtZero(connector.handle, descriptor.size,
    "selected-image retained systemd peer connector");
  if (String(bytes.byteLength) !== connector.identity.byte_count ||
      sha256Hex(bytes) !== connector.identity.sha256) {
    throw new TypeError("selected-image retained systemd peer connector bytes changed");
  }
  await trustedGuixAncestry(connector.identity.path);
  const current = await readStableRegular(connector.identity.path,
    "selected-image installed systemd peer connector", true);
  if (!sameBigintIdentity(current.metadata, connector.retained) ||
      sha256Hex(current.bytes) !== connector.identity.sha256) {
    throw new TypeError("selected-image installed systemd peer connector changed");
  }
}

async function closeSystemdPeerConnector(connector) {
  if (connector?.testSeam === true) return;
  await connector?.handle?.close();
}

async function pinSystemdControlPeer(connector, endpoint, authority, peer,
  rootAnchor, rootCaptureFn) {
  if (connector.busPath !== endpoint.bus_socket.path) {
    throw new TypeError("selected-image systemd peer connector bus path changed");
  }
  await verifyRootAnchor(rootAnchor, rootCaptureFn);
  await verifySystemdControlEndpointAuthority(authority);
  const result = await capture(connector.descriptorPath,
    [...peerConnectorArguments(connector.busPath, peer), "--probe"],
    { cwd: "/", env: SYSTEMD_CONTROL_ENVIRONMENT });
  await verifySystemdPeerConnector(connector);
  await verifySystemdControlEndpointAuthority(authority);
  await verifyRootAnchor(rootAnchor, rootCaptureFn);
  if (result.code !== 0 || result.signal !== null || result.failure !== null) {
    if (result.code === 124) {
      throw new TypeError(
        "selected-image systemd SO_PEERPIDFD profile is unavailable");
    }
    throw new TypeError("selected-image systemd SO_PEERCRED probe failed");
  }
  return Object.freeze({ ...peer,
    pidfd_profile: parseSystemdPeerProbe(result.stdout.toString("utf8")) });
}

export async function pinSelectedImageSystemdClients(paths =
  SYSTEMD_CLIENT_PATHS, { captureFn = capture, watchFactory = watch,
    peerConnector = null, rootCaptureFn = capture,
    rootProcessFn = processIdentity } = {}) {
  if (paths === null || typeof paths !== "object" ||
      Object.keys(paths).sort().join("\0") !==
        Object.keys(SYSTEMD_CLIENT_PATHS).sort().join("\0")) {
    throw new TypeError("selected-image systemd client paths are incomplete");
  }
  const systemdRun = await pinSystemdClient(paths.systemdRun, "systemd-run");
  let systemctl = null; let busctl = null; let rootEndpointAuthority = null;
  let rootAnchor = null;
  let controlEndpointAuthority = null;
  let controlPeerConnector = null;
  try {
    systemctl = await pinSystemdClient(paths.systemctl, "systemctl");
    busctl = await pinSystemdClient(paths.busctl, "busctl");
    if (peerConnector === null || typeof peerConnector !== "object") {
      throw new TypeError("selected-image systemd peer connector authority is required");
    }
    if (peerConnector.testSeam === true && captureFn === capture) {
      throw new TypeError("selected-image systemd test connector cannot execute production clients");
    }
    rootEndpointAuthority = await pinSystemBusEndpointAuthority(watchFactory);
    rootAnchor = await selectRootAnchor(busctl, rootEndpointAuthority,
      rootCaptureFn, rootProcessFn);
    controlEndpointAuthority =
      await pinSystemdControlEndpointAuthority(watchFactory);
    if (peerConnector.testSeam === true) {
      const peer = rootAnchor.process;
      if (peer === null || typeof peer !== "object" ||
          peer.uid !== controlEndpointAuthority.identity.uid ||
          !/^[1-9][0-9]*$/.test(peer.pid ?? "") ||
          !/^[1-9][0-9]*$/.test(peer.start_time ?? "") ||
          !/^(?:0|[1-9][0-9]*)$/.test(peer.gid ?? "")) {
        throw new TypeError("selected-image systemd test peer is invalid");
      }
      controlPeerConnector = Object.freeze({ testSeam: true,
        identity: peerConnector.identity });
    } else {
      controlPeerConnector = await pinSystemdPeerConnector(peerConnector,
        controlEndpointAuthority.identity);
    }
    const peer = controlPeerConnector.testSeam ?
      Object.freeze({ ...rootAnchor.process,
        pidfd_profile: "so-peerpidfd-v1" }) :
      await pinSystemdControlPeer(controlPeerConnector,
        controlEndpointAuthority.identity, controlEndpointAuthority,
        rootAnchor.process, rootAnchor, rootCaptureFn);
    const controlEndpoint = Object.freeze({
      ...controlEndpointAuthority.identity, peer,
    });
    const clients = Object.freeze({
      controlEndpoint,
      controlEndpointAuthority,
      controlPeerConnector,
      controlPeer: peer,
      rootAnchor,
      rootCaptureFn,
      identity: Object.freeze({
        control_connector: controlPeerConnector.identity,
        control_endpoint: controlEndpoint,
        environment: SYSTEMD_CONTROL_ENVIRONMENT,
        root_anchor: rootAnchor.identity,
        systemd_run: systemdRun.identity,
        systemctl: systemctl.identity,
      }),
      systemdRun, systemctl,
    });
    const preflight = await captureSystemdClient(clients, "systemctl",
      ["--user", "--no-pager", "show", "--property=Version"], captureFn);
    if (preflight.code !== 0 || preflight.signal !== null ||
        preflight.failure !== null) {
      throw new TypeError(
        "selected-image systemd read-only connectivity preflight failed");
    }
    const version = parseExactSelectedImageSystemdShow(
      preflight.stdout.toString("utf8"), ["Version"],
      "control-connectivity");
    if (!/^[A-Za-z0-9][A-Za-z0-9.+:~_-]{0,127}$/.test(version.Version)) {
      throw new TypeError(
        "selected-image systemd connectivity version is malformed");
    }
    return clients;
  } catch (error) {
    const cleanupFailures = [];
    if (controlEndpointAuthority !== null) {
      await closeSystemdControlEndpointAuthority(controlEndpointAuthority,
        { allowFailed: true }).catch(failure => cleanupFailures.push(failure));
    }
    if (rootEndpointAuthority !== null) {
      await closeSystemBusEndpointAuthority(rootEndpointAuthority,
        { allowFailed: true }).catch(failure => cleanupFailures.push(failure));
    }
    if (controlPeerConnector !== null) {
      await closeSystemdPeerConnector(controlPeerConnector)
        .catch(failure => cleanupFailures.push(failure));
    }
    await systemdRun.handle.close().catch(failure => cleanupFailures.push(failure));
    await systemctl?.handle?.close().catch(failure => cleanupFailures.push(failure));
    await busctl?.handle?.close().catch(failure => cleanupFailures.push(failure));
    if (cleanupFailures.length > 0) {
      throw new AggregateError([error, ...cleanupFailures],
        "selected-image systemd client pinning and cleanup both failed");
    }
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

async function captureRootBusClient(rootAnchor, captureFn = capture) {
  await verifySystemdClient(rootAnchor.busctl, "busctl");
  await verifySystemBusEndpointAuthority(rootAnchor.endpointAuthority);
  let result; let commandFailure = null; let validationFailure = null;
  try {
    try {
      result = await captureFn(rootAnchor.busctl.descriptorPath,
        rootAnchor.queryArguments, { cwd: "/", env: SYSTEM_BUS_ENVIRONMENT });
    } catch (error) {
      commandFailure = error instanceof Error ? error : new Error(String(error));
    }
  } finally {
    try {
      await verifySystemdClient(rootAnchor.busctl, "busctl");
      await verifySystemBusEndpointAuthority(rootAnchor.endpointAuthority);
    } catch (error) {
      validationFailure = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (commandFailure !== null && validationFailure !== null) {
    throw new AggregateError([commandFailure, validationFailure],
      "selected-image root query and post-validation both failed");
  }
  if (commandFailure !== null) throw commandFailure;
  if (validationFailure !== null) throw validationFailure;
  if (result.code !== 0 || result.signal !== null || result.failure !== null) {
    throw new TypeError("selected-image root MainPID query failed");
  }
  return parseSelectedImageRootMainPID(result.stdout.toString("utf8"));
}

async function selectRootAnchor(busctl, endpointAuthority, captureFn,
  processFn = processIdentity) {
  const rootAnchor = { busctl, endpointAuthority,
    processFn, queryArguments: rootMainPIDArguments() };
  const pid = await captureRootBusClient(rootAnchor, captureFn);
  const processIdentityValue = validateRootSelectedProcessProfile(
    await processFn(pid));
  if (processIdentityValue.uid !== String(process.getuid())) {
    throw new TypeError("selected-image root MainPID selected another UID");
  }
  return Object.freeze({ ...rootAnchor, process: processIdentityValue,
    identity: Object.freeze({ busctl: busctl.identity,
      environment: SYSTEM_BUS_ENVIRONMENT,
      endpoint: endpointAuthority.identity,
      main_pid_query: rootAnchor.queryArguments,
      process: processIdentityValue }) });
}

async function verifyRootAnchor(rootAnchor, captureFn = capture) {
  const pid = await captureRootBusClient(rootAnchor, captureFn);
  if (pid !== rootAnchor.process.pid) {
    throw new TypeError("selected-image root MainPID changed");
  }
  const current = await rootAnchor.processFn(rootAnchor.process.pid);
  if (canonicalJson(current) !== canonicalJson(rootAnchor.process)) {
    throw new TypeError("selected-image root MainPID process identity changed");
  }
  return rootAnchor.identity;
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
  await verifyRootAnchor(clients?.rootAnchor, clients?.rootCaptureFn);
  await verifySystemdControlEndpointAuthority(
    clients?.controlEndpointAuthority);
  await verifySystemdPeerConnector(clients?.controlPeerConnector);
  await verifySystemdClient(clients?.systemdRun, "systemd-run");
  await verifySystemdClient(clients?.systemctl, "systemctl");
  return clients.identity;
}

export async function closeSelectedImageSystemdClients(clients) {
  const failures = [];
  try { await verifyRootAnchor(clients?.rootAnchor, clients?.rootCaptureFn); }
  catch (error) { failures.push(error); }
  try {
    await closeSystemdControlEndpointAuthority(
      clients?.controlEndpointAuthority);
  } catch (error) {
    failures.push(error);
    await closeSystemdControlEndpointAuthority(
      clients?.controlEndpointAuthority, { allowFailed: true })
      .catch(closeError => failures.push(closeError));
  }
  try { await closeSystemdPeerConnector(clients?.controlPeerConnector); }
  catch (error) { failures.push(error); }
  for (const client of [clients?.systemdRun, clients?.systemctl]) {
    try { await client?.handle?.close(); }
    catch (error) { failures.push(error); }
  }
  try {
    await closeSystemBusEndpointAuthority(clients?.rootAnchor?.endpointAuthority);
  } catch (error) {
    failures.push(error);
    await closeSystemBusEndpointAuthority(
      clients?.rootAnchor?.endpointAuthority, { allowFailed: true })
      .catch(closeError => failures.push(closeError));
  }
  try { await clients?.rootAnchor?.busctl?.handle?.close(); }
  catch (error) { failures.push(error); }
  if (failures.length > 0) {
    throw new AggregateError(failures,
      "selected-image systemd client cleanup failed");
  }
}

async function captureSystemdClient(clients, name, args,
  captureFn = capture) {
  const client = clients[name];
  const label = name === "systemdRun" ? "systemd-run" : "systemctl";
  await verifySystemdClient(client, label);
  await verifyRootAnchor(clients.rootAnchor, clients.rootCaptureFn);
  await verifySystemdControlEndpointAuthority(
    clients.controlEndpointAuthority);
  let result; let commandFailure = null;
  let validationFailure = null;
  try {
    try {
      const options = {
        cwd: "/",
        env: SYSTEMD_CONTROL_ENVIRONMENT,
      };
      // The injected capture seam only checks command construction.  The
      // production path invokes the retained SO_PEERCRED connector, which
      // creates one fresh stream and installs it exactly at fd 3 before the
      // pinned systemd client starts.
      if (captureFn === capture) {
        await verifySystemdPeerConnector(clients.controlPeerConnector);
        options.controlPeerConnector = clients.controlPeerConnector;
        options.controlPeer = clients.controlPeer;
      }
      result = await captureFn(client.descriptorPath, args, options);
    } catch (error) {
      commandFailure = error instanceof Error ? error :
        new Error(String(error));
    }
  } finally {
    try {
      await verifySystemdClient(client, label);
      await verifySystemdControlEndpointAuthority(
        clients.controlEndpointAuthority);
      await verifyRootAnchor(clients.rootAnchor, clients.rootCaptureFn);
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
    "--job-mode=fail",
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
const ABSENT_RECOVERY_PROPERTIES = Object.freeze([
  "LoadState", "Transient", "FragmentPath", "Type",
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

function classifyRecoveredSelectedImageUnit(command, shown) {
  const text = shown.stdout.toString("utf8");
  try {
    const state = parseExactSelectedImageSystemdShow(text, RECOVERY_PROPERTIES,
      "ambiguous-recovery");
    if (state.LoadState !== "loaded" || state.Transient !== "yes" ||
        state.FragmentPath !== command.fragmentPath || state.Type !== "exec") {
      return Object.freeze({ kind: "mismatch", state });
    }
    try {
      validateSelectedImageNegativeExecStart(state.ExecStart,
        command.execStart);
      return Object.freeze({ kind: "original", state });
    } catch { return Object.freeze({ kind: "mismatch", state }); }
  } catch (loadedParseError) {
    try {
      const state = parseExactSelectedImageSystemdShow(text,
        ABSENT_RECOVERY_PROPERTIES, "ambiguous-absence");
      if (state.LoadState === "not-found" && state.Transient === "no" &&
          state.FragmentPath === "" && state.Type === "") {
        return Object.freeze({ kind: "absent", state });
      }
    } catch { /* Preserve the loaded parse failure below. */ }
    throw loadedParseError;
  }
}

async function showRecoveredSelectedImageUnit(command, clients, captureFn) {
  const shown = await captureSystemdClientOrTestSeam(clients, "systemctl",
    ["--user", "--no-pager", "show", command.unit,
      `--property=${RECOVERY_PROPERTIES.join(",")}`], captureFn);
  if (shown.code !== 0 || shown.signal !== null || shown.failure !== null) {
    throw new Error("selected-image exact-unit recovery query failed");
  }
  return classifyRecoveredSelectedImageUnit(command, shown);
}

/* Returning a unit name is the ownership commit.  A completed nonzero may be
 * a local refusal, a manager error reply, or a transport loss after dispatch;
 * therefore only an already visible exact ExecStart grants ownership, while
 * observed absence remains nonterminal.  A Node spawn error created no
 * connector process.  Signals and thrown post-dispatch errors likewise
 * preserve the stage without absence or cleanup claims. */
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
  if (dispatchFailure !== null) {
    const failure = new Error(
      "ambiguous systemd-run dispatch has no ordered completion proof",
    { cause: dispatchFailure ?? undefined });
    failure.preserveStage = true;
    failure.ambiguousDispatch = true;
    throw failure;
  }
  if (started.signal !== null) {
    const failure = new Error(
      "signaled systemd-run dispatch has unknown terminality");
    failure.preserveStage = true;
    failure.ambiguousDispatch = true;
    failure.refusalEvidence = selectedImageRefusalEvidence(command, started,
      null);
    throw failure;
  }
  try {
    const recovered = await showRecoveredSelectedImageUnit(command, clients,
      captureFn);
    if (recovered.kind === "original" && started.failure === null) {
      return command.unit;
    }
    if (recovered.kind === "absent") {
      const refusalEvidence = selectedImageRefusalEvidence(command, started,
        started.failure === null ? null : recovered.state);
      if (started.failure === null) {
        throw Object.assign(new Error(
          "nonzero systemd-run dispatch has unknown terminality"),
        { ambiguousDispatch: true, preserveStage: true, refusalEvidence });
      }
      throw Object.assign(new Error(
        "connector process was not spawned and exact unit absence was proved"),
      { absenceProved: true, refusalEvidence });
    }
    throw new Error("selected-image exact unit name has mismatched identity");
  } catch (error) {
    if (error?.absenceProved === true || error?.preserveStage === true) {
      throw error;
    }
    const failure = new Error(
      "completed systemd-run refusal has an unverified exact unit state",
    { cause: error });
    failure.preserveStage = true;
    failure.recoveryFailure = error;
    throw failure;
  }
}

export async function stopAndRemoveSelectedImageNegativeUnit(unit, clients,
  { captureFn = capture, delayFn = async milliseconds =>
    new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)) } = {}) {
  await captureSystemdClientOrTestSeam(clients, "systemctl",
    ["--user", "--no-pager", "stop", unit], captureFn);
  await captureSystemdClientOrTestSeam(clients, "systemctl",
    ["--user", "--no-pager", "reset-failed", unit], captureFn);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const left = await captureSystemdClientOrTestSeam(clients, "systemctl",
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
  if (entry.role === "peer-connector-source") {
    return M6_SELECTED_IMAGE_PEER_CONNECT_SOURCE;
  }
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
    M6_AUTHORITY_PEER_CONNECT_SOURCE: retainedAuthorityInput(sourceAuthority,
      M6_SELECTED_IMAGE_PEER_CONNECT_SOURCE),
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
  const connector = files.find(entry => entry.role === "peer-connector");
  const launcherBytes = await readFile(resolve(outputPath,
    launcher.relative_path));
  const connectorBytes = await readFile(resolve(outputPath,
    connector.relative_path));
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
    connector_elf: parseStaticLauncherElf(connectorBytes),
  }));
  } finally {
    await guix.handle.close();
  }
}

export async function buildSelectedImagePeerConnectorTestAuthority({
  derivation, source,
}, { captureFn = capture } = {}) {
  if (typeof derivation !== "string" || typeof source !== "string") {
    throw new TypeError("connector test authority needs retained descriptor inputs");
  }
  const sourceBytes = await readRetainedDescriptor(source,
    "selected-image connector test source");
  const guix = await pinGuixClient();
  try {
    const environment = Object.freeze({ ...M6_SELECTED_IMAGE_GUIX_ENVIRONMENT,
      M6_PEER_CONNECT_TEST_SOURCE: source });
    const built = await capturePinnedGuix(guix,
      ["build", "-f", derivation, "--no-grafts"],
      { cwd: "/", env: environment }, captureFn);
    if (built.code !== 0 || built.signal !== null || built.failure !== null) {
      throw new TypeError("connector test Guix authority build failed");
    }
    const outputs = built.stdout.toString("utf8").trim().split("\n")
      .filter(Boolean);
    if (outputs.length !== 1 ||
        !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-cadr-m6-systemd-peer-connect-test-authority$/
          .test(outputs[0])) {
      throw new TypeError("connector test Guix output identity differs");
    }
    const outputPath = outputs[0];
    await trustedGuixAncestry(outputPath, true);
    const programPath = resolve(outputPath, "bin/cadr-m6-systemd-peer-connect-test");
    const copiedSourcePath = resolve(outputPath,
      "share/cadr-m6-systemd-peer-connect.c");
    const program = await readStableRegular(programPath,
      "connector test Guix binary", true);
    const copiedSource = await readStableRegular(copiedSourcePath,
      "connector test Guix source", false);
    if (!copiedSource.bytes.equals(sourceBytes) ||
        portableMode(program.metadata) !== "0555" ||
        portableMode(copiedSource.metadata) !== "0444") {
      throw new TypeError("connector test Guix source or modes differ");
    }
    const derivationResult = await capturePinnedGuix(guix,
      ["build", "-f", derivation, "--no-grafts", "--derivations"],
      { cwd: "/", env: environment }, captureFn);
    const derivations = derivationResult.stdout.toString("utf8").trim()
      .split("\n").filter(Boolean);
    if (derivationResult.code !== 0 || derivationResult.signal !== null ||
        derivationResult.failure !== null || derivations.length !== 1 ||
        !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-cadr-m6-systemd-peer-connect-test-authority\.drv$/
          .test(derivations[0])) {
      throw new TypeError("connector test Guix derivation identity differs");
    }
    const references = await capturePinnedGuix(guix,
      ["gc", "--references", derivations[0]],
      { cwd: "/", env: M6_SELECTED_IMAGE_GUIX_ENVIRONMENT }, captureFn);
    const referenceSet = new Set(references.stdout.toString("utf8").trim()
      .split("\n").filter(Boolean));
    if (references.code !== 0 || references.signal !== null ||
        references.failure !== null ||
        !referenceSet.has(M6_SELECTED_IMAGE_PINNED_TOOLCHAIN.derivation)) {
      throw new TypeError("connector test derivation lacks reviewed compiler");
    }
    return Object.freeze({ derivation: derivations[0],
      output_path: outputPath,
      source: Object.freeze({ byte_count: String(sourceBytes.byteLength),
        sha256: sha256Hex(sourceBytes) }),
      binary: Object.freeze({ byte_count: String(program.bytes.byteLength),
        elf: parseStaticLauncherElf(program.bytes), path: programPath,
        sha256: sha256Hex(program.bytes) }),
      toolchain: M6_SELECTED_IMAGE_PINNED_TOOLCHAIN });
  } finally {
    await guix.handle.close();
  }
}

export async function verifyGuixAuthority(identity) {
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
  peerConnectorSource: M6_SELECTED_IMAGE_PEER_CONNECT_SOURCE,
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
    const connectorFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "peer-connector");
    const connectorSourceFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "peer-connector-source");
    const childFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "entry");
    const releaseFile = retainedLauncherIdentity.files.find(entry =>
      entry.role === "release-record");
    const child = resolve(authorityRoot, childFile.relative_path);
    const releasePath = resolve(authorityRoot, releaseFile.relative_path);
    const launcher = resolve(authorityRoot, launcherFile.relative_path);
    const connector = Object.freeze({
      path: resolve(authorityRoot, connectorFile.relative_path),
      expected: connectorFile, source: connectorSourceFile,
    });
    systemdClients = await pinSystemdClients(undefined, {
      peerConnector: connector,
    });
    systemdClientIdentity = await verifySystemdClients(systemdClients);
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
    const cleanupFailures = [];
    if (unit !== null) {
      try {
        await stopUnit(unit, systemdClients); unitAbsent = true; unit = null;
      }
      catch (failure) { cleanupFailures.push(failure); preserveStage = true; }
    }
    if (systemdClients !== null) {
      try {
        await closeSystemdClients(systemdClients); systemdClients = null;
      } catch (failure) { cleanupFailures.push(failure); }
    }
    if (stagedPin !== null) {
      try { await closePinned(stagedPin); stagedPin = null; }
      catch (failure) { cleanupFailures.push(failure); }
    }
    if (!preserveStage && stage !== null && (unitAbsent || unit === null)) {
      try { await removeStage(stage.root); stage = null; }
      catch (failure) { cleanupFailures.push(failure); }
    }
    const authoritative = cleanupFailures.length === 0 ? error :
      new AggregateError([error, ...cleanupFailures],
        "selected-image systemd operation and cleanup failed");
    await publish(`${options.output}.failure.json`,
      selectedImageNegativeFailure(cleanupFailures.length === 0 ?
        "selected-image-negative-systemd-failed" :
        "selected-image-negative-systemd-cleanup-failed",
      sha256Hex(Buffer.from(String(authoritative?.message ?? authoritative))),
      error?.refusalEvidence ?? authoritative?.refusalEvidence ?? null))
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
