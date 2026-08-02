#!/usr/bin/env node
/*
 * C-M8/CW2 paired input campaign.
 *
 * This command is deliberately inert without --execute.  With explicit
 * consent it makes one fresh private ignored 0700 session, materializes the complete
 * 100-key/pointer native schedule, captures that schedule before native IOB
 * mutation, boots a separate protocol-v6 M9-DEVID Wasm machine to frozen M6
 * READY4,
 * and replays the same controller-derived action list there.  It records the
 * distinct native CDRM8N1 and browser CDRINP1 representations; it never
 * calls either half's synthetic fallback or unit-test substitute.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants as FS_SYNC, fstatSync, openSync, readFileSync,
  readdirSync, realpathSync } from "node:fs";
import { constants as FS, chmod, lstat, mkdir, open, readFile, readdir,
  unlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_DEVID_PROFILE,
  CADR_M6_READY_CONTRACT,
  CADR_M6_READY4_CONTRACT,
  appendM6FastCheckpoint,
  appendM6FastHostWait,
  parseM6DevidSummary,
  parseM6FastRunRecord,
  parseM6ZeroLatencyHostTranscript,
  runM6Ready4Fast,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M8_M9_CAMPAIGN_SCHEMA,
  buildCadrM8M9Campaign,
  encodeCdrInp1,
  serializeCadrM8M9NativeScript,
} from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";
import { cadrM8KeyForCode } from "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import { encodeCadrM9Edge32 } from "../cadr-web/wasm/cadr-m9-pointer.mjs";
import {
  CADR_M8_M9_DIRECT_AUTHORITIES,
  CADR_M8_M9_DIRECT_DIRTY_POLICY,
  CADR_M8_M9_SELECTED_NATIVE_PYTHON_PROGRAMS,
  assertCadrM8M9ProvenanceJoin,
  assertCadrM8M9PortableCanaryProvenance,
  captureCadrM8M9NativePythonClosure,
  captureCadrM8M9WorkerClosure,
  collectCadrM8M9ProvenanceJoin,
  collectCadrM8M9PortableCanaryProvenance,
  publicCadrM8M9NativePythonClosure,
} from "./cadr-m8-m9-provenance-join.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-oracle");
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const NATIVE_ORACLE = resolve(ROOT, "scripts/cadr-m8-m9-native-input-oracle.py");
const RUNNER_PATH = fileURLToPath(import.meta.url);
const AUTHORITY_BUILD_SOURCE_PATHS = Object.freeze([
  Object.freeze({ role: "builder-wrapper",
    path: "scripts/build-cadr-m8-m9-python-authority.sh" }),
  Object.freeze({ role: "builder",
    path: "scripts/build-cadr-m8-m9-python-authority.mjs" }),
  Object.freeze({ role: "derivation",
    path: "scripts/cadr-m8-m9-python-seal-authority.scm" }),
  Object.freeze({ role: "launcher-source",
    path: "scripts/cadr-m8-m9-python-seal-launcher.c" }),
  Object.freeze({ role: "guard-source",
    path: "scripts/cadr-m8-m9-prepython-guard.c" }),
  Object.freeze({ role: "bootstrap-source",
    path: "scripts/cadr-m8-m9-captured-python-bootstrap.py" }),
]);
const CAMPAIGN_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-campaign.mjs");
const DEACTIVATION_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-deactivation.mjs");
const TRANSACTION_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-transaction.mjs");
const M6_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m6-headless-boot.mjs");
const PROTOCOL_VERSION = 6;
const REQUEST_TIMEOUT_MS = 120_000;
const CAMPAIGN_SCHEMA = "cadr-m8-m9-input-conformance-result-v3";
const TARGET = "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9-DEVID-READY4-DIRECT-BOUNDARY-NON-CW2";
const ARTIFACT_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, local_path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, local_path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, local_path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, local_path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, local_path: "l/usim/disk-sys-303-0.img" }),
]);

const CAPTURED_WORKER_BOOTSTRAP = `(${(async function capturedWorkerBootstrap() {
  const vm = require("node:vm");
  const { workerData } = require("node:worker_threads");
  const base = "https://cadr-worker.invalid/";
  const byIdentifier = new Map(workerData.modules.map(module =>
    [new URL(module.path, base).href, module.source]));
  const modules = new Map();
  const nodeModules = new Map();
  async function nodeModule(specifier) {
    if (nodeModules.has(specifier)) return nodeModules.get(specifier);
    const namespace = require(specifier);
    const names = Object.keys(namespace);
    const module = new vm.SyntheticModule(names, function initializeNodeModule() {
      for (const name of names) this.setExport(name, namespace[name]);
    }, { identifier: specifier });
    nodeModules.set(specifier, module);
    await module.link(() => { throw new Error("node synthetic module has an unexpected import"); });
    await module.evaluate();
    return module;
  }
  for (const [identifier, source] of byIdentifier) {
    modules.set(identifier, new vm.SourceTextModule(source, {
      identifier,
      importModuleDynamically: async specifier => {
        if (!specifier.startsWith("node:")) {
          throw new Error("captured worker attempted an unbound dynamic import");
        }
        return nodeModule(specifier);
      },
    }));
  }
  const root = new URL(workerData.root, base).href;
  const rootModule = modules.get(root);
  if (rootModule === undefined) throw new Error("captured worker root is absent");
  await rootModule.link(async (specifier, referencingModule) => {
    if (specifier.startsWith("node:")) return nodeModule(specifier);
    const target = new URL(specifier, referencingModule.identifier).href;
    const module = modules.get(target);
    if (module === undefined) throw new Error(`captured worker import is absent: ${target}`);
    return module;
  });
  await rootModule.evaluate();
}).toString()})().catch(error => { setImmediate(() => { throw error; }); });`;

function fail(message) { throw new TypeError(`C-M8/CW2: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function createDescriptorCapturedM8M9Worker({
  captureClosure = captureCadrM8M9WorkerClosure,
  afterCapture = null,
} = {}) {
  if (typeof captureClosure !== "function" ||
      afterCapture !== null && typeof afterCapture !== "function") {
    fail("descriptor-captured worker hooks are malformed");
  }
  const captured = await captureClosure();
  if (captured?.schema !== "cadr-m8-m9-worker-capture-v1" ||
      typeof captured.root !== "string" || !Array.isArray(captured.files) ||
      !Array.isArray(captured.static_imports) || !Array.isArray(captured.captured_modules) ||
      captured.file_count !== captured.files.length ||
      captured.captured_modules.length !== captured.files.length ||
      captured.sha256 !== sha256(`${canonicalJson({ files: captured.files,
        static_imports: captured.static_imports })}\n`)) {
    fail("descriptor-captured worker closure is malformed");
  }
  const identities = new Map(captured.files.map(file => [file.path, file]));
  const modules = captured.captured_modules.map((module, index) => {
    const identity = identities.get(module?.path);
    const encoded = typeof module?.source === "string" ?
      new TextEncoder().encode(module.source) : null;
    if (identity === undefined || module?.identity !== identity || encoded === null ||
        identity.bytes !== encoded.byteLength || identity.sha256 !== sha256(encoded)) {
      fail(`descriptor-captured worker module ${index} differs from its one-shot identity`);
    }
    return Object.freeze({ path: module.path, source: module.source });
  });
  if (!identities.has(captured.root)) fail("descriptor-captured worker root is absent");
  if (afterCapture !== null) await afterCapture(Object.freeze({
    schema: captured.schema, root: captured.root, file_count: captured.file_count,
    sha256: captured.sha256, files: captured.files, static_imports: captured.static_imports,
  }));
  const worker = new Worker(CAPTURED_WORKER_BOOTSTRAP, { eval: true,
    workerData: { root: captured.root, modules },
    execArgv: ["--experimental-vm-modules"] });
  const receipt = Object.freeze({ schema: captured.schema, root: captured.root,
    file_count: captured.file_count, sha256: captured.sha256,
    files: captured.files, static_imports: captured.static_imports,
    execution: "descriptor-captured-in-memory-vm-module-graph-v1" });
  return Object.freeze({ worker, receipt,
    rootIdentity: identities.get(captured.root) });
}
function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}
function cdrinpForJson(value) {
  const bytes = bytesOf(value);
  if (bytes?.byteLength !== 40 ||
      new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRINP1") {
    fail("shared deactivation receipt is not exact CDRINP1");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, true) !== 1 || ![1, 2].includes(view.getUint16(10, true)) ||
      view.getUint32(12, true) !== 0 || view.getUint32(36, true) !== 0) {
    fail("shared deactivation CDRINP1 framing differs");
  }
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes),
    hex: Buffer.from(bytes).toString("hex"), kind: view.getUint16(10, true),
    generation: view.getBigUint64(16, true).toString(),
    ordinal: view.getBigUint64(24, true).toString(),
    payload: view.getUint32(32, true) });
}
function deliveryForJson(delivery) {
  return Object.freeze({ wire_schema: delivery.wireSchema,
    records_delivered: delivery.recordsDelivered,
    first_ingress_ordinal: delivery.firstIngressOrdinal.toString(),
    last_ingress_ordinal: delivery.lastIngressOrdinal.toString(),
    input_sequence: delivery.inputSequence,
    wire_records: delivery.wireRecords.map(cdrinpForJson),
    core_observations: delivery.coreObservations.map(value =>
      stateForJson(parseInputStateBytes(bytesOf(value)))) });
}
function positive(value, label) { if (!Number.isSafeInteger(value) || value < 1) fail(`${label} is not positive`); return value; }
function digest(value, label) { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(`${label} is not SHA-256`); return value; }
function rebuildM9DevidWasmPair() {
  const argv = ["-B", "-C", "cadr-web", "build/cadr-web-m9-devid-O0.wasm",
    "build/cadr-web-m9-devid-O2.wasm"];
  const result = spawnSync("make", argv, { cwd: ROOT, encoding: "utf8",
    timeout: 300_000, killSignal: "SIGKILL" });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    fail(`forced M9-DEVID O0/O2 Wasm build failed: ${(result.stderr ?? "").slice(-2000)}`);
  }
  return Object.freeze({ schema: "cadr-m8-m9-wasm-production-v2", profile: "m9-devid",
    forced: true, argv: ["make", ...argv], stdout_sha256: sha256(result.stdout),
    stderr_sha256: sha256(result.stderr) });
}

export function nativePythonFdIdentity(fd, { fstatSyncImpl = fstatSync, readFileSyncImpl = readFileSync } = {}) {
  const info = fstatSyncImpl(fd, { bigint: true });
  if (!info.isFile()) fail("native-capture Python descriptor is not a regular file");
  /* Linux /proc/self/fd/N opens this already-held file description, so a
   * pathname replacement cannot redirect either the hash or exec target. */
  const bytes = readFileSyncImpl(`/proc/self/fd/${fd}`);
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes),
    device: info.dev.toString(), inode: info.ino.toString() });
}

function currentAuthorityCredentials() {
  const currentUids = new Set([
    ...(typeof process.getuid === "function" ? [process.getuid()] : []),
    ...(typeof process.geteuid === "function" ? [process.geteuid()] : []),
  ]);
  const currentGroups = new Set([
    ...(typeof process.getgroups === "function" ? process.getgroups() : []),
    ...(typeof process.getgid === "function" ? [process.getgid()] : []),
    ...(typeof process.getegid === "function" ? [process.getegid()] : []),
  ]);
  return Object.freeze({ currentUids, currentGroups });
}

function closeDescriptorBinding(value, closeSyncImpl = closeSync) {
  const descriptors = Array.isArray(value?.ownedCleanupDescriptors)
    ? value.ownedCleanupDescriptors : (Array.isArray(value?.descriptors)
      ? value.descriptors : (Number.isInteger(value?.fd) ? [value.fd] : []));
  for (const fd of [...new Set(descriptors)].reverse()) closeSyncImpl(fd);
}

function permitDescriptorSets(entries) {
  const childPassThroughDescriptors = [];
  const ownedCleanupDescriptors = [];
  const owned = new Set();
  for (const entry of entries) {
    if (!Number.isInteger(entry?.fd)) {
      fail("filesystem permit entry omits its child pass-through descriptor");
    }
    const descriptors = Array.isArray(entry.descriptors)
      ? entry.descriptors : [entry.fd];
    if (!descriptors.includes(entry.fd) ||
        descriptors.some(fd => !Number.isInteger(fd))) {
      fail("filesystem permit entry has an invalid owned descriptor set");
    }
    childPassThroughDescriptors.push(entry.fd);
    for (const fd of descriptors) {
      if (!owned.has(fd)) { owned.add(fd); ownedCleanupDescriptors.push(fd); }
    }
  }
  return Object.freeze({
    childPassThroughDescriptors: Object.freeze(childPassThroughDescriptors),
    ownedCleanupDescriptors: Object.freeze(ownedCleanupDescriptors),
  });
}

export function openImmutableDescriptorPath(path, {
  label = "immutable authority path", directory = false, executable = false,
  requiredOwner = null, openSyncImpl = openSync, closeSyncImpl = closeSync,
  fstatSyncImpl = fstatSync, identityForFd = nativePythonFdIdentity,
  credentials = currentAuthorityCredentials(),
} = {}) {
  if (typeof path !== "string" || !path.startsWith("/") ||
      resolve(path) !== path || path.includes("\0")) {
    fail(`${label} is not one canonical absolute path`);
  }
  const segments = path.split("/").filter(Boolean);
  const descriptors = [];
  const ancestry = [];
  let parentFd = null;
  try {
    for (let index = -1; index < segments.length; index += 1) {
      const final = index === segments.length - 1;
      const reference = index < 0 ? "/" : `/${segments.slice(0, index + 1).join("/")}`;
      const locator = index < 0 ? "/" :
        `/proc/self/fd/${parentFd}/${segments[index]}`;
      const wantsDirectory = !final || directory;
      const flags = FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW |
        (wantsDirectory ? FS_SYNC.O_DIRECTORY : 0);
      const fd = openSyncImpl(locator, flags);
      descriptors.push(fd);
      const information = fstatSyncImpl(fd, { bigint: true });
      const uid = Number(information.uid); const gid = Number(information.gid);
      const mode = Number(information.mode);
      if ((wantsDirectory && !information.isDirectory()) ||
          (!wantsDirectory && !information.isFile()) ||
          credentials.currentUids.has(uid) ||
          (credentials.currentGroups.has(gid) && (mode & 0o020) !== 0) ||
          (mode & 0o002) !== 0 ||
          (final && requiredOwner !== null && uid !== requiredOwner) ||
          (final && executable && (mode & 0o111) === 0)) {
        fail(`${label} component ${reference} is mutable or has the wrong type or owner`);
      }
      ancestry.push(Object.freeze({ reference, uid: information.uid.toString(),
        gid: information.gid.toString(), mode: (mode & 0o7777).toString(8),
        device: information.dev.toString(), inode: information.ino.toString() }));
      parentFd = fd;
    }
    const fd = descriptors.at(-1);
    const identity = directory ? null : identityForFd(fd);
    return Object.freeze({ fd, path, identity,
      descriptors: Object.freeze([...descriptors]),
      ancestry: Object.freeze(ancestry) });
  } catch (error) {
    for (const fd of descriptors.reverse()) closeSyncImpl(fd);
    throw error;
  }
}

export function openExecutableFromPath(name, {
  path = process.env.PATH ?? "",
  label = `executable ${name}`, requiredOwner = null,
  openSyncImpl = openSync, closeSyncImpl = closeSync,
  realpathSyncImpl = realpathSync,
  identityForFd = nativePythonFdIdentity,
  openDescriptorPath = openImmutableDescriptorPath,
} = {}) {
  for (const directory of path.split(":")) {
    if (directory.length === 0 || !directory.startsWith("/")) continue;
    let candidateFd;
    try {
      candidateFd = openSyncImpl(resolve(directory, name), FS_SYNC.O_RDONLY);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") continue;
      fail(`${label} cannot be opened before resolution: ${error?.message ?? String(error)}`);
    }
    try {
      /* Resolve only through the already-held descriptor.  The subsequent
       * descriptor walk must identify the same inode and bytes. */
      const executable = realpathSyncImpl(`/proc/self/fd/${candidateFd}`);
      if (typeof executable !== "string" || !executable.startsWith("/") ||
          resolve(executable) !== executable || /[\r\n\0]/.test(executable)) {
        fail(`${label} descriptor resolved to a malformed path`);
      }
      const candidateIdentity = identityForFd(candidateFd);
      const opened = openDescriptorPath(executable, {
        label, executable: true, requiredOwner,
      });
      for (const field of ["bytes", "sha256", "device", "inode"]) {
        if (opened.identity[field] !== candidateIdentity[field]) {
          closeDescriptorBinding(opened, closeSyncImpl);
          fail(`${label} descriptor and immutable ancestry target differ`);
        }
      }
      return opened;
    } finally {
      closeSyncImpl(candidateFd);
    }
  }
  fail(`${label} cannot be found on the absolute PATH`);
}

export function openNativePythonExecutable(options = {}) {
  return openExecutableFromPath("python3", {
    ...options,
    label: "native-capture Python",
  });
}

export function openRootOwnedExecutable(name, options = {}) {
  return openExecutableFromPath(name, {
    ...options,
    label: `root-owned executable ${name}`,
    requiredOwner: 0,
  });
}

const STORE_ITEM_PATTERN = /^\/gnu\/store\/[a-z0-9]{32}-[^/]+$/;
const PREPARED_EXECUTABLES = Object.freeze([
  "source/usim/usim",
  "source/usim/usim-m8-m9-direct",
  "source/usim/usim-m8-m9-x11-witness",
]);
const BWRAP_SYNTHETIC_DEV = Object.freeze({
  schema: "bubblewrap-synthetic-dev-v1",
  option: "--dev /dev",
  entries: Object.freeze([
    "core:symlink:/proc/kcore", "fd:symlink:/proc/self/fd",
    "full:char:0666", "null:char:0666",
    "ptmx:symlink:pts/ptmx", "pts:directory:0755",
    "pts/ptmx:char:0666", "random:char:0666",
    "shm:directory:0755", "stderr:symlink:/proc/self/fd/2",
    "stdin:symlink:/proc/self/fd/0", "stdout:symlink:/proc/self/fd/1",
    "tty:char:0666", "urandom:char:0666", "zero:char:0666",
  ]),
});
const CAPTURED_PYTHON_STARTED = "CDRM8PYBOOT1\n";

function consumeBootstrapStarted(stderr) {
  if (!stderr.startsWith(CAPTURED_PYTHON_STARTED)) {
    fail("captured Python child did not emit the bootstrap-start receipt");
  }
  return stderr.slice(CAPTURED_PYTHON_STARTED.length);
}

export function canonicalGuixRuntimeClosure(pythonBinding, guixBinding, {
  spawnSyncImpl = spawnSync,
} = {}) {
  const match = /^\/gnu\/store\/[^/]+/.exec(pythonBinding?.path ?? "");
  if (match === null || !STORE_ITEM_PATTERN.test(match[0])) {
    fail("captured Python must be selected from one canonical Guix store item");
  }
  const result = spawnSyncImpl("/proc/self/fd/3",
    ["gc", "--requisites", match[0]], {
      cwd: ROOT, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe", guixBinding.fd],
    });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    fail(`Guix runtime closure query failed: ${(result.stderr ?? "").slice(-2000)}`);
  }
  const paths = [...new Set(result.stdout.split("\n").filter(Boolean))].sort();
  if (paths.length === 0 || !paths.includes(match[0]) ||
      paths.some(path => !STORE_ITEM_PATTERN.test(path) || /[\r\0]/.test(path))) {
    fail("Guix runtime closure query returned malformed or incomplete store paths");
  }
  return Object.freeze({ schema: "cadr-m8-m9-guix-runtime-closure-v1",
    seed: match[0], paths: Object.freeze(paths),
    sha256: sha256(`${canonicalJson({ seed: match[0], paths })}\n`) });
}

function exactIdentityEqual(actual, expected, label) {
  for (const field of ["bytes", "sha256", "device", "inode"]) {
    if (actual?.[field] !== expected?.[field]) {
      fail(`${label} differs from the canonical build receipt`);
    }
  }
}

export function authorityBuildSourceClosure() {
  const files = AUTHORITY_BUILD_SOURCE_PATHS.map(item => {
    const bytes = readFileSync(resolve(ROOT, item.path));
    return Object.freeze({ ...item, bytes: bytes.byteLength, sha256: sha256(bytes) });
  });
  return Object.freeze({ schema: "cadr-m8-m9-python-authority-source-closure-v1",
    files: Object.freeze(files),
    sha256: sha256(`${canonicalJson({ files })}\n`) });
}

export function elfIdentityForFd(fd, {
  readFileSyncImpl = readFileSync,
} = {}) {
  const bytes = readFileSyncImpl(`/proc/self/fd/${fd}`);
  if (bytes.byteLength < 64 || bytes[0] !== 0x7f ||
      bytes.subarray(1, 4).toString("ascii") !== "ELF" ||
      bytes[4] !== 2 || bytes[5] !== 1 || bytes[6] !== 1) {
    fail("authority artifact is not ELF64 little-endian version 1");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = view.getUint16(16, true);
  const machine = view.getUint16(18, true);
  const entry = view.getBigUint64(24, true);
  const programOffset = view.getBigUint64(32, true);
  const headerSize = view.getUint16(52, true);
  const programEntrySize = view.getUint16(54, true);
  const programCount = view.getUint16(56, true);
  if (machine !== 62 || headerSize !== 64 || programEntrySize < 56 ||
      programOffset > BigInt(Number.MAX_SAFE_INTEGER) ||
      programOffset + BigInt(programEntrySize) * BigInt(programCount) >
        BigInt(bytes.byteLength)) {
    fail("authority artifact ELF header is unsupported or truncated");
  }
  const programHeaderTypes = [];
  for (let index = 0; index < programCount; index += 1) {
    programHeaderTypes.push(view.getUint32(
      Number(programOffset) + index * programEntrySize, true));
  }
  return Object.freeze({ elf_class: "ELF64", data: "little-endian",
    version: 1, osabi: bytes[7], type, machine: "x86-64",
    entry: entry.toString(),
    program_header_types: Object.freeze(programHeaderTypes),
    has_pt_interp: programHeaderTypes.includes(3),
    has_pt_dynamic: programHeaderTypes.includes(2) });
}

function assertLauncherElf(value, label) {
  exactObject(value, ["elf_class", "data", "version", "osabi", "type",
    "machine", "entry", "program_header_types", "has_pt_interp",
    "has_pt_dynamic"], label);
  if (value.elf_class !== "ELF64" || value.data !== "little-endian" ||
      value.version !== 1 || value.type !== 2 || value.machine !== "x86-64" ||
      value.has_pt_interp !== false || value.has_pt_dynamic !== false ||
      typeof value.entry !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value.entry) ||
      !Array.isArray(value.program_header_types) ||
      value.program_header_types.some(item => !Number.isSafeInteger(item))) {
    fail(`${label} is not the reviewed static launcher ELF profile`);
  }
}

function assertGuardElf(value, label) {
  exactObject(value, ["elf_class", "data", "version", "osabi", "type",
    "machine", "entry", "program_header_types", "has_pt_interp",
    "has_pt_dynamic"], label);
  if (value.elf_class !== "ELF64" || value.data !== "little-endian" ||
      value.version !== 1 || value.type !== 3 || value.machine !== "x86-64" ||
      value.has_pt_interp !== false || value.has_pt_dynamic !== true ||
      typeof value.entry !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value.entry) ||
      !Array.isArray(value.program_header_types) ||
      value.program_header_types.some(item => !Number.isSafeInteger(item))) {
    fail(`${label} is not the reviewed guard shared-object ELF profile`);
  }
}

export function canonicalAuthorityBuildReceiptBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, "utf8");
}

function oneGuixStorePath(result, pattern, label) {
  if (result.error !== undefined || result.signal !== null ||
      result.status !== 0) {
    fail(`${label} failed: ${(result.stderr ?? "").slice(-2000)}`);
  }
  const lines = result.stdout.split("\n").filter(Boolean);
  if (lines.length !== 1 || !pattern.test(lines[0]) ||
      /[\0\r]/.test(lines[0])) {
    fail(`${label} did not return one exact store path`);
  }
  return lines[0];
}

export function recomputeCanonicalAuthoritySelection(guix, {
  spawnSyncImpl = spawnSync,
  expectedSourceClosure = authorityBuildSourceClosure(),
  openSyncImpl = openSync,
  closeSyncImpl = closeSync,
} = {}) {
  const buildInputs = [
    { role: "derivation",
      path: resolve(ROOT, "scripts/cadr-m8-m9-python-seal-authority.scm") },
    { role: "launcher-source",
      path: resolve(ROOT, "scripts/cadr-m8-m9-python-seal-launcher.c") },
    { role: "guard-source",
      path: resolve(ROOT, "scripts/cadr-m8-m9-prepython-guard.c") },
    { role: "bootstrap-source",
      path: resolve(ROOT, "scripts/cadr-m8-m9-captured-python-bootstrap.py") },
  ];
  const descriptors = [];
  try {
    for (const item of buildInputs) {
      descriptors.push(openSyncImpl(item.path,
        FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW));
    }
    const expectedByRole = new Map(expectedSourceClosure.files.map(item =>
      [item.role, item]));
    for (const [index, input] of buildInputs.entries()) {
      const identity = nativePythonFdIdentity(descriptors[index]);
      const expected = expectedByRole.get(input.role);
      if (identity.bytes !== expected?.bytes ||
          identity.sha256 !== expected?.sha256) {
        fail(`independent authority ${input.role} descriptor differs from its receipt`);
      }
    }
    const environment = {
      CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
      CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
      CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
      LANG: "C", LC_ALL: "C", TZ: "UTC",
    };
    const derivationResult = spawnSyncImpl("/proc/self/fd/3",
      ["build", "--derivations", "-f", "/proc/self/fd/4"], {
        cwd: ROOT, env: environment, encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe", guix.fd, ...descriptors],
      });
    const derivation = oneGuixStorePath(derivationResult,
      /^\/gnu\/store\/[a-z0-9]+-[^/]+\.drv$/,
      "independent authority derivation evaluation");
    const outputResult = spawnSyncImpl("/proc/self/fd/3",
      ["build", "--dry-run", derivation], {
        cwd: ROOT, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe", guix.fd],
      });
    const output = oneGuixStorePath(outputResult,
      /^\/gnu\/store\/[a-z0-9]+-cadr-m8-m9-python-seal-authority$/,
      "independent authority output evaluation");
    return Object.freeze({ derivation, output });
  } finally {
    for (const fd of descriptors.reverse()) closeSyncImpl(fd);
  }
}

function readCanonicalAuthorityBuildReceipt(path, {
  openSyncImpl = openSync, closeSyncImpl = closeSync,
  readFileSyncImpl = readFileSync,
} = {}) {
  if (typeof path !== "string" || !path.startsWith("/") ||
      resolve(path) !== path || path.includes("\0")) {
    fail("authority build receipt must be one canonical absolute path");
  }
  const fd = openSyncImpl(path, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW);
  try {
    const bytes = readFileSyncImpl(`/proc/self/fd/${fd}`);
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); }
    catch { fail("authority build receipt is not JSON"); }
    if (!bytes.equals(canonicalAuthorityBuildReceiptBytes(value))) {
      fail("authority build receipt is not canonical JSON");
    }
    return Object.freeze({ value, sha256: sha256(bytes),
      bytes: bytes.byteLength });
  } finally { closeSyncImpl(fd); }
}

export function openCapturedPythonAuthority({
  receiptPath = process.env.CADR_M8_M9_PYTHON_AUTHORITY_RECEIPT ?? "",
  legacyAuthorityRoot = process.env.CADR_M8_M9_PYTHON_AUTHORITY ?? "",
  receipt = null, expectedYamaPtraceScope = null,
  readReceipt = readCanonicalAuthorityBuildReceipt,
  closeSyncImpl = closeSync,
  openDescriptorPath = openImmutableDescriptorPath,
  openGuixExecutable = path => openDescriptorPath(path, {
    label: "authority-build Guix client", executable: true,
  }),
  recomputeSelection = recomputeCanonicalAuthoritySelection,
  elfForFd = elfIdentityForFd,
} = {}) {
  if (legacyAuthorityRoot.length !== 0) {
    fail("caller-selected CADR_M8_M9_PYTHON_AUTHORITY store items are prohibited");
  }
  const receiptRecord = receipt === null ? readReceipt(receiptPath) :
    Object.freeze({ value: receipt,
      sha256: sha256(canonicalAuthorityBuildReceiptBytes(receipt)),
      bytes: canonicalAuthorityBuildReceiptBytes(receipt).byteLength });
  const build = receiptRecord.value;
  exactObject(build, ["schema", "yama_ptrace_scope", "guix_client",
    "build_environment", "source_closure", "derivation", "output",
    "authority"], "authority build receipt");
  if (build.schema !== "cadr-m8-m9-python-authority-build-v1" ||
      build.yama_ptrace_scope !== 3 ||
      (expectedYamaPtraceScope !== null &&
       build.yama_ptrace_scope !== expectedYamaPtraceScope) ||
      typeof build.derivation !== "string" ||
      !/^\/gnu\/store\/[a-z0-9]+-[^/]+\.drv$/.test(build.derivation) ||
      typeof build.output !== "string" ||
      !/^\/gnu\/store\/[a-z0-9]+-cadr-m8-m9-python-seal-authority$/.test(build.output)) {
    fail("authority build receipt has the wrong profile or store paths");
  }
  const expectedEnvironment = {
    CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
    CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
    CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
    LANG: "C", LC_ALL: "C", TZ: "UTC",
  };
  if (canonicalJson(build.build_environment) !==
      canonicalJson(expectedEnvironment) ||
      canonicalJson(build.source_closure) !==
      canonicalJson(authorityBuildSourceClosure())) {
    fail("authority build receipt does not bind the exact reviewed source closure");
  }
  exactObject(build.guix_client, ["path", "identity", "ancestry"],
    "authority build Guix client");
  const guix = openGuixExecutable(build.guix_client.path);
  const opened = [guix];
  let launcher; let guard;
  try {
    exactIdentityEqual(guix.identity, build.guix_client.identity,
      "authority build Guix client");
    if (canonicalJson(guix.ancestry) !==
        canonicalJson(build.guix_client.ancestry)) {
      fail("authority build Guix client ancestry differs from its receipt");
    }
    const independentSelection = recomputeSelection(guix, {
      expectedSourceClosure: build.source_closure,
    });
    if (independentSelection.derivation !== build.derivation ||
        independentSelection.output !== build.output) {
      fail("caller-selected authority differs from the independently evaluated derivation");
    }
    const authorityRoot = build.output;
    if (authorityRoot.length === 0 || !authorityRoot.startsWith("/gnu/store/") ||
        resolve(authorityRoot) !== authorityRoot) {
      fail("authority build receipt output is not a canonical Guix store item");
    }
    exactObject(build.authority, ["bootstrap", "launcher", "guard"],
      "authority build output");
    exactObject(build.authority.launcher, ["identity", "elf"],
      "authority build launcher");
    exactObject(build.authority.guard, ["identity", "elf"],
      "authority build guard");
    assertLauncherElf(build.authority.launcher.elf,
      "authority build launcher ELF");
    assertGuardElf(build.authority.guard.elf,
      "authority build guard ELF");
    const bootstrap = openDescriptorPath(resolve(authorityRoot,
      "share/cadr-m8-m9/captured-python-bootstrap.py"), {
      executable: false, label: "captured Python bootstrap",
    }); opened.push(bootstrap);
    launcher = openDescriptorPath(resolve(authorityRoot,
      "bin/cadr-m8-m9-python-seal-launcher"), {
      executable: true, label: "pre-Python seal launcher",
    }); opened.push(launcher);
    guard = openDescriptorPath(resolve(authorityRoot,
      "lib/cadr-m8-m9-prepython-guard.so"), {
      executable: false, label: "pre-Python guard",
    }); opened.push(guard);
    if (bootstrap.identity.sha256 !==
        CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256) {
      fail("immutable authority bootstrap differs from the reviewed source");
    }
    exactIdentityEqual(bootstrap.identity, build.authority.bootstrap,
      "authority build bootstrap");
    exactIdentityEqual(launcher.identity, build.authority.launcher.identity,
      "authority build launcher");
    exactIdentityEqual(guard.identity, build.authority.guard.identity,
      "authority build guard");
    const launcherElf = elfForFd(launcher.fd);
    const guardElf = elfForFd(guard.fd);
    assertLauncherElf(launcherElf, "selected authority launcher ELF");
    assertGuardElf(guardElf, "selected authority guard ELF");
    if (canonicalJson(launcherElf) !==
          canonicalJson(build.authority.launcher.elf) ||
        canonicalJson(guardElf) !== canonicalJson(build.authority.guard.elf)) {
      fail("selected authority ELF identities differ from the canonical receipt");
    }
    const ancestry = new Map();
    for (const item of [bootstrap, launcher, guard]) {
      for (const component of item.ancestry) {
        const prior = ancestry.get(component.reference);
        if (prior !== undefined && canonicalJson(prior) !== canonicalJson(component)) {
          fail("immutable authority ancestry changed between descriptor walks");
        }
        ancestry.set(component.reference, component);
      }
    }
    return Object.freeze({ root: authorityRoot,
      build_receipt: Object.freeze({ schema: build.schema,
        bytes: receiptRecord.bytes, sha256: receiptRecord.sha256,
        derivation: build.derivation, output: build.output,
        independent_selection: independentSelection,
        yama_ptrace_scope: build.yama_ptrace_scope,
        build_environment: build.build_environment,
        source_closure: build.source_closure,
        guix_client: build.guix_client,
        authority: build.authority }),
      ancestry: Object.freeze([...ancestry.values()]),
      descriptors: Object.freeze(opened.flatMap(item => item.descriptors)),
      guix, bootstrap, launcher, guard });
  } catch (error) {
    for (const item of opened.reverse()) {
      closeDescriptorBinding(item, closeSyncImpl);
    }
    throw error;
  }
}

function requireHostPtraceScopeThree(value) {
  if (value !== 3) {
    fail("host Yama ptrace_scope must be exactly 3 before captured Python may start");
  }
  return value;
}

export function readHostPtraceScope({
  readFileSyncImpl = readFileSync,
  path = "/proc/sys/kernel/yama/ptrace_scope",
} = {}) {
  let text;
  try { text = readFileSyncImpl(path, "ascii"); }
  catch (error) {
    fail(`cannot read host Yama ptrace policy: ${error?.message ?? String(error)}`);
  }
  if (!/^[0-3]\n?$/.test(text)) fail("host Yama ptrace policy is malformed");
  const value = Number.parseInt(text, 10);
  return requireHostPtraceScopeThree(value);
}

function exactObject(value, fields, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key))) {
    fail(`${label} has an unexpected shape`);
  }
}
function decimalString(value, label, { zero = true } = {}) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value) || (!zero && value === "0")) {
    fail(`${label} is not a canonical unsigned decimal`);
  }
}
function assertImmutableAncestry(value, label) {
  if (!Array.isArray(value) || value.length < 1) {
    fail(`${label} ancestry is absent`);
  }
  const credentials = currentAuthorityCredentials();
  for (const component of value) {
    exactObject(component, ["reference", "uid", "gid", "mode", "device",
      "inode"], `${label} component`);
    if (typeof component.reference !== "string" ||
        !component.reference.startsWith("/") ||
        typeof component.mode !== "string" ||
        !/^[0-7]{3,4}$/.test(component.mode)) {
      fail(`${label} component is malformed`);
    }
    for (const field of ["uid", "gid", "device", "inode"]) {
      decimalString(component[field], `${label} ${field}`,
        { zero: field !== "inode" });
    }
    const uid = Number(component.uid); const gid = Number(component.gid);
    const mode = Number.parseInt(component.mode, 8);
    if (credentials.currentUids.has(uid) ||
        (credentials.currentGroups.has(gid) && (mode & 0o020) !== 0) ||
        (mode & 0o002) !== 0) {
      fail(`${label} component is mutable by the current credentials`);
    }
  }
}
export function assertFdBoundPythonIdentity(value, expected, label = "native M8/M9 Python identity") {
  exactObject(value, ["schema", "source_fd", "transport", "bytes", "sha256",
    "device", "inode",
    "sys_executable", "proc_self_exe", "version", "implementation",
    "executable_ancestry", "prepython_seal"], label);
  if (value.schema !== "cadr-m8-m9-python-identity-v3" || value.source_fd !== 3 ||
      value.transport !== "bwrap-ro-bind-fd" ||
      !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || typeof value.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(value.sha256) || typeof value.version !== "string" ||
      typeof value.implementation !== "string") {
    fail(`${label} is incomplete`);
  }
  decimalString(value.device, `${label} device`); decimalString(value.inode, `${label} inode`, { zero: false });
  for (const [field, reference] of [["sys_executable", "sys-executable"], ["proc_self_exe", "proc-self-exe"]]) {
    exactObject(value[field], ["reference", "bytes", "sha256", "device", "inode"], `${label} ${field}`);
    if (value[field].reference !== reference || value[field].bytes !== value.bytes ||
        value[field].sha256 !== value.sha256) {
      fail(`${label} ${field} differs from the read-only bound executable`);
    }
  }
  for (const field of ["bytes", "sha256", "device", "inode"]) {
    if (value[field] !== expected[field]) fail(`${label} differs from the inherited descriptor`);
  }
  assertImmutableAncestry(value.executable_ancestry,
    `${label} executable`);
  if (canonicalJson(value.executable_ancestry) !==
      canonicalJson(expected.executable_ancestry)) {
    fail(`${label} executable ancestry differs from the parent descriptors`);
  }
  exactObject(value.prepython_seal, ["dumpable", "no_new_privileges",
    "core_soft", "core_hard", "yama_ptrace_scope",
    "authority_build_receipt", "filesystem_permit", "importer_isolation",
    "stdlib_roots", "loader_files", "bootstrap", "launcher", "guard"],
  `${label} pre-Python seal`);
  if (value.prepython_seal.dumpable !== 0 ||
      value.prepython_seal.no_new_privileges !== 1 ||
      value.prepython_seal.core_soft !== 0 ||
      value.prepython_seal.core_hard !== 0 ||
      value.prepython_seal.yama_ptrace_scope !== 3 ||
      value.prepython_seal.yama_ptrace_scope !== expected.yama_ptrace_scope) {
    fail(`${label} did not inherit the native pre-Python controls`);
  }
  if (canonicalJson(value.prepython_seal.authority_build_receipt) !==
      canonicalJson(expected.prepython_seal.authority_build_receipt)) {
    fail(`${label} authority build receipt differs from the parent decision`);
  }
  if (canonicalJson(value.prepython_seal.filesystem_permit) !==
      canonicalJson(expected.prepython_seal.filesystem_permit)) {
    fail(`${label} filesystem permit differs from the parent decision`);
  }
  exactObject(value.prepython_seal.importer_isolation,
    ["sys_path", "meta_path", "path_hooks",
      "approved_non_file_importers", "archive_paths"],
    `${label} importer isolation`);
  const importer = value.prepython_seal.importer_isolation;
  if (!Array.isArray(importer.sys_path) ||
      importer.sys_path.length < 1 ||
      importer.sys_path.some(path => typeof path !== "string" ||
        !path.startsWith("/") || /\.(?:zip|egg|whl)$/i.test(path)) ||
      canonicalJson(importer.meta_path) !== canonicalJson([
        "_frozen_importlib.BuiltinImporter",
        "_frozen_importlib.FrozenImporter",
        "_frozen_importlib_external.PathFinder",
      ]) ||
      canonicalJson(importer.path_hooks) !== canonicalJson([
        "_frozen_importlib_external.FileFinder.path_hook.<locals>.path_hook_for_FileFinder",
      ]) ||
      canonicalJson(importer.approved_non_file_importers) !== canonicalJson([
        "_frozen_importlib.BuiltinImporter",
        "_frozen_importlib.FrozenImporter",
      ]) ||
      canonicalJson(importer.archive_paths) !== "[]") {
    fail(`${label} does not retain the isolated non-archive importer surface`);
  }
  for (const field of ["bootstrap", "launcher", "guard"]) {
    exactObject(value.prepython_seal[field], ["bytes", "sha256", "device",
      "inode"], `${label} ${field}`);
    for (const identityField of ["bytes", "sha256", "device", "inode"]) {
      if (value.prepython_seal[field][identityField] !==
          expected.prepython_seal[field][identityField]) {
        fail(`${label} ${field} differs from the immutable authority`);
      }
    }
  }
  if (!Array.isArray(value.prepython_seal.stdlib_roots) ||
      value.prepython_seal.stdlib_roots.length < 1) {
    fail(`${label} has no immutable standard-library root`);
  }
  for (const root of value.prepython_seal.stdlib_roots) {
    exactObject(root, ["path", "ancestry"],
      `${label} standard-library root`);
    if (typeof root.path !== "string" || !root.path.startsWith("/")) {
      fail(`${label} standard-library root is malformed`);
    }
    assertImmutableAncestry(root.ancestry,
      `${label} standard-library root`);
  }
  if (canonicalJson(value.prepython_seal.stdlib_roots.map(root => root.path)) !==
      canonicalJson(importer.sys_path)) {
    fail(`${label} sys.path differs from its immutable stdlib roots`);
  }
  if (!Array.isArray(value.prepython_seal.loader_files) ||
      value.prepython_seal.loader_files.length < 1) {
    fail(`${label} has no bound standard-library file closure`);
  }
  for (const file of value.prepython_seal.loader_files) {
    exactObject(file, ["path", "ancestry", "file"],
      `${label} standard-library file`);
    if (typeof file.path !== "string" || !file.path.startsWith("/")) {
      fail(`${label} standard-library file path is malformed`);
    }
    assertImmutableAncestry(file.ancestry,
      `${label} standard-library file`);
    exactObject(file.file, ["bytes", "sha256", "uid", "gid", "mode",
      "device", "inode"], `${label} standard-library file identity`);
    if (!Number.isSafeInteger(file.file.bytes) || file.file.bytes < 0 ||
        typeof file.file.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/.test(file.file.sha256)) {
      fail(`${label} standard-library file identity is malformed`);
    }
  }
  return value;
}

export function assertFdBoundPythonProgramIdentity(value, expected,
  label = "native M8/M9 Python program identity") {
  exactObject(value, ["schema", "inherited_fd", "transport", "bytes",
    "sha256", "closure_sha256"], label);
  if (value.schema !== "cadr-m8-m9-python-program-identity-v2" ||
      value.inherited_fd !== 4 ||
      value.transport !== "bwrap-ro-bind-data-from-one-shot-pipe" ||
      value.closure_sha256 !== expected.closure_sha256) {
    fail(`${label} is incomplete`);
  }
  for (const field of ["bytes", "sha256"]) {
    if (value[field] !== expected[field]) fail(`${label} differs from inherited pipe 4`);
  }
  return value;
}

const CAPTURED_PYTHON_PROGRAM_ROOT = "/__cadr_m8_m9_captured_python__";
const CAPTURED_PYTHON_HELPER_FD = 10;
const CAPTURED_PYTHON_BOOTSTRAP = readFileSync(resolve(
  ROOT, "scripts/cadr-m8-m9-captured-python-bootstrap.py"));
export const CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256 =
  sha256(CAPTURED_PYTHON_BOOTSTRAP);
export function capturedPythonBootstrapBytes() {
  return Buffer.from(CAPTURED_PYTHON_BOOTSTRAP);
}

export function assertSelectedNativePythonPermit(closure) {
  const paths = closure?.captured_programs?.map(item => item.path).sort();
  if (canonicalJson(paths) !==
      canonicalJson(CADR_M8_M9_SELECTED_NATIVE_PYTHON_PROGRAMS) ||
      closure.root !== "scripts/cadr-m8-m9-native-input-oracle.py") {
    fail("native execution requires the exact reviewed seven-file Python permit");
  }
}

function canonicalRuntimePath(path, label) {
  if (typeof path !== "string" || path.length === 0 || path.includes("\0")) {
    fail(`${label} is not a usable path`);
  }
  return resolve(isAbsolute(path) ? path : resolve(ROOT, path));
}

function parseNativeConfigPermitPaths(bytes) {
  const values = new Map(); let section = "";
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch !== null) { section = sectionMatch[1].trim().toLowerCase(); continue; }
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values.set(`${section}.${line.slice(0, separator).trim().toLowerCase()}`,
      line.slice(separator + 1).trim());
  }
  const fields = ["ucode.prommcr_filename", "ucode.promsym_filename",
    "ucode.mcrsym_filename", "chaos.hosts", "disk.disk0"];
  const result = fields.map(field => {
    const value = values.get(field);
    if (typeof value !== "string" || value.length === 0) {
      fail(`native configuration omits ${field}`);
    }
    return field === "disk.disk0" ? value.slice(value.indexOf(",") + 1) : value;
  });
  if (!values.get("disk.disk0").includes(",") || result.some(path => path.length === 0)) {
    fail("native configuration disk0 is malformed");
  }
  return result.map((path, index) => canonicalRuntimePath(path,
    `native configuration input ${fields[index]}`));
}

function openPermitEntry(path, { directory = false, writable = false,
  label, openSyncImpl = openSync, closeSyncImpl = closeSync,
  fstatSyncImpl = fstatSync } = {}) {
  const destination = canonicalRuntimePath(path, label);
  const fd = openSyncImpl(destination, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW |
    (directory ? FS_SYNC.O_DIRECTORY : 0));
  try {
    const info = fstatSyncImpl(fd, { bigint: true });
    if ((directory && !info.isDirectory()) || (!directory && !info.isFile())) {
      fail(`${label} has the wrong descriptor type`);
    }
    if (writable && (!directory || info.uid !== BigInt(process.getuid()) ||
        (info.mode & 0o7777n) !== 0o700n)) {
      fail(`${label} must be a current-owner exact 0700 output directory`);
    }
    const identity = directory
      ? Object.freeze({ device: info.dev.toString(), inode: info.ino.toString() })
      : nativePythonFdIdentity(fd);
    return Object.freeze({ fd, destination, directory, writable, identity,
      descriptors: Object.freeze([fd]) });
  } catch (error) {
    closeSyncImpl(fd);
    throw error;
  }
}

export function openPreparedFileEntries(rootPath, {
  closeSyncImpl = closeSync, openSyncImpl = openSync,
  readdirSyncImpl = readdirSync, fstatSyncImpl = fstatSync,
} = {}) {
  const root = canonicalRuntimePath(rootPath, "prepared native closure");
  const directories = [];
  const files = [];
  const walk = (directoryFd, relativePath) => {
    const names = readdirSyncImpl(`/proc/self/fd/${directoryFd}`, {
      withFileTypes: true,
    }).map(entry => entry.name).sort();
    for (const name of names) {
      if (name === "." || name === ".." || name.includes("/") || name.includes("\0")) {
        fail("prepared closure contains a malformed entry name");
      }
      const relativeName = relativePath.length === 0 ? name : `${relativePath}/${name}`;
      const locator = `/proc/self/fd/${directoryFd}/${name}`;
      let fd; let directoryFdCandidate;
      try {
        directoryFdCandidate = openSyncImpl(locator, FS_SYNC.O_RDONLY |
          FS_SYNC.O_NOFOLLOW | FS_SYNC.O_DIRECTORY);
      } catch (error) {
        if (!["ENOTDIR", "EINVAL"].includes(error?.code)) throw error;
      }
      if (directoryFdCandidate !== undefined) {
        directories.push(directoryFdCandidate);
        walk(directoryFdCandidate, relativeName);
        continue;
      }
      fd = openSyncImpl(locator, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW);
      const information = fstatSyncImpl(fd, { bigint: true });
      if (!information.isFile()) {
        closeSyncImpl(fd);
        fail(`prepared closure ${relativeName} is not a regular file`);
      }
      const executable = (Number(information.mode) & 0o111) !== 0;
      if (executable !== PREPARED_EXECUTABLES.includes(relativeName)) {
        closeSyncImpl(fd);
        fail(`prepared closure has an unapproved executable set at ${relativeName}`);
      }
      const identity = nativePythonFdIdentity(fd);
      files.push(Object.freeze({ fd, descriptors: Object.freeze([fd]),
        destination: resolve(root, relativeName), directory: false,
        writable: false, role: `prepared-file:${relativeName}`, identity,
        prepared_relative_path: relativeName, executable }));
    }
  };
  const rootFd = openSyncImpl(root, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW |
    FS_SYNC.O_DIRECTORY);
  directories.push(rootFd);
  try {
    walk(rootFd, "");
    for (const expected of PREPARED_EXECUTABLES) {
      if (!files.some(file => file.prepared_relative_path === expected)) {
        fail(`prepared closure omits required executable ${expected}`);
      }
    }
    const receiptFiles = files.map(file => Object.freeze({
      path: file.prepared_relative_path, destination: file.destination,
      executable: file.executable, ...file.identity,
    }));
    return Object.freeze({ entries: Object.freeze(files), receipt: Object.freeze({
      schema: "cadr-m8-m9-prepared-file-closure-v1", root,
      executable_paths: PREPARED_EXECUTABLES,
      files: Object.freeze(receiptFiles), file_count: receiptFiles.length,
      sha256: sha256(`${canonicalJson({ files: receiptFiles })}\n`),
    }) });
  } catch (error) {
    for (const file of files.reverse()) closeDescriptorBinding(file, closeSyncImpl);
    throw error;
  } finally {
    for (const fd of directories.reverse()) closeSyncImpl(fd);
  }
}

export function openRuntimeStoreEntries(runtimeStore, {
  openDescriptorPath = openImmutableDescriptorPath,
  closeSyncImpl = closeSync,
} = {}) {
  if (runtimeStore?.schema !== "cadr-m8-m9-guix-runtime-closure-v1" ||
      !Array.isArray(runtimeStore.paths) || runtimeStore.paths.length === 0) {
    fail("native filesystem permit requires a canonical Guix runtime closure");
  }
  const entries = [];
  try {
    for (const path of runtimeStore.paths) {
      const binding = openDescriptorPath(path, {
        label: `Guix runtime store item ${path}`, directory: true,
      });
      entries.push(Object.freeze({ fd: binding.fd, descriptors: binding.descriptors,
        destination: path, directory: true, writable: false,
        role: `guix-runtime-store:${path.slice("/gnu/store/".length)}`,
        identity: Object.freeze({
          device: binding.ancestry.at(-1).device,
          inode: binding.ancestry.at(-1).inode,
        }) }));
    }
    return Object.freeze(entries);
  } catch (error) {
    for (const entry of entries.reverse()) {
      closeDescriptorBinding(entry, closeSyncImpl);
    }
    throw error;
  }
}

function openHostProbeFilesystemPermit(runtimeStore, closure, options = {}) {
  const entries = openRuntimeStoreEntries(runtimeStore, options);
  const descriptorSets = permitDescriptorSets(entries);
  return Object.freeze({ entries, ...descriptorSets,
    summary: Object.freeze({
      schema: "cadr-m8-m9-host-probe-filesystem-permit-v1",
      repository_root_visible: false,
      selected_python_programs: Object.freeze(
        closure.captured_programs.map(program => program.path).sort()),
      guix_runtime_closure: runtimeStore,
      prepared_file_closure: null,
      synthetic_dev: BWRAP_SYNTHETIC_DEV,
      mounts: Object.freeze(entries.map(entry => Object.freeze({
        role: entry.role, destination: entry.destination,
        access: "read-only", type: "directory", identity: entry.identity,
      }))),
    }),
  });
}

export function openNativeFilesystemPermit({
  prepared, nativeConfig, output, inputScript, campaign, runtimeStore,
}, {
  openEntry = openPermitEntry,
  openPreparedClosure = openPreparedFileEntries,
  openStoreEntries = openRuntimeStoreEntries,
  readFileSyncImpl = readFileSync,
  closeSyncImpl = closeSync,
} = {}) {
  const opened = [];
  try {
    const add = (path, options) => {
      const entry = openEntry(path, { ...options, closeSyncImpl });
      opened.push(Object.freeze({ ...entry, role: options.role }));
      return entry;
    };
    const config = add(nativeConfig, {
      label: "native configuration", role: "native-configuration", directory: false,
    });
    const configInputs = parseNativeConfigPermitPaths(
      readFileSyncImpl(`/proc/self/fd/${config.fd}`));
    const preparedClosure = openPreparedClosure(prepared, { closeSyncImpl });
    for (const entry of preparedClosure.entries) opened.push(entry);
    const storeEntries = openStoreEntries(runtimeStore, { closeSyncImpl });
    for (const entry of storeEntries) opened.push(entry);
    add(output, { label: "isolated native output", directory: true,
      writable: true, role: "isolated-native-output" });
    add(inputScript, { label: "native input script",
      role: "native-input-script", directory: false });
    add(campaign, { label: "native campaign", role: "native-campaign",
      directory: false });
    for (const [index, path] of configInputs.entries()) {
      add(path, { label: `native configuration input ${index}`,
        role: `native-configuration-input-${index}`, directory: false });
    }
    for (const [role, label, path] of [
      ["selected-profile", "selected profile", PROFILE_PATH],
      ["selected-configuration-template", "selected configuration template",
        resolve(ROOT, "cadr-web/profiles/cadr-web-303.ini.in")],
      ["selected-m6-release-record", "selected M6 release record", RELEASE_PATH],
      ["selected-m8-m9-patch", "selected M8/M9 patch", resolve(ROOT,
        "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch")],
      ["selected-cadet-mapping", "selected Cadet mapping", resolve(ROOT,
        "l/usim/cadet.defs")],
    ]) {
      add(path, { label, role, directory: false });
    }
    const byDestination = new Map();
    for (const entry of opened) {
      const prior = byDestination.get(entry.destination);
      if (prior !== undefined) {
        if (canonicalJson(prior.identity) !== canonicalJson(entry.identity) ||
            prior.directory !== entry.directory ||
            prior.writable !== entry.writable || prior.role !== entry.role) {
          fail(`filesystem permit destination ${entry.destination} is ambiguous`);
        }
        closeDescriptorBinding(entry, closeSyncImpl);
        opened.splice(opened.indexOf(entry), 1);
      } else {
        byDestination.set(entry.destination, entry);
      }
    }
    const entries = Object.freeze([...byDestination.values()]);
    const descriptorSets = permitDescriptorSets(entries);
    return Object.freeze({
      entries, ...descriptorSets,
      summary: Object.freeze({
        schema: "cadr-m8-m9-native-filesystem-permit-v1",
        repository_root_visible: false,
        selected_python_programs: CADR_M8_M9_SELECTED_NATIVE_PYTHON_PROGRAMS,
        guix_runtime_closure: runtimeStore,
        prepared_file_closure: preparedClosure.receipt,
        synthetic_dev: BWRAP_SYNTHETIC_DEV,
        mounts: Object.freeze(entries.map(entry => Object.freeze({
          role: entry.role, destination: entry.destination,
          access: entry.writable ? "read-write-output" : "read-only",
          type: entry.directory ? "directory" : "file",
          identity: entry.identity,
        }))),
      }),
    });
  } catch (error) {
    for (const entry of opened.reverse()) {
      closeDescriptorBinding(entry, closeSyncImpl);
    }
    throw error;
  }
}

function nativePythonPipeBundle(closure, pythonBinding, authority,
  yamaPtraceScope, filesystemPermit) {
  if (filesystemPermit?.summary === undefined) {
    fail("captured Python requires one descriptor-held filesystem permit");
  }
  const rootProgram = closure.captured_programs.find(item =>
    item.path === closure.root);
  if (rootProgram === undefined) fail("captured Python closure omits its root");
  const programs = closure.captured_programs.map(item => ({
    path: item.path, bytes: item.identity.bytes, sha256: item.identity.sha256,
  }));
  const helpers = closure.captured_programs.filter(item => item.path !== closure.root)
    .map(item => Object.freeze({ path: item.path, bytes: Buffer.from(item.bytes),
      identity: item.identity }));
  if (programs.some(item => !item.path.endsWith(".py") || item.path.startsWith("/") ||
      item.path.split("/").some(part => part === "" || part === "." || part === ".."))) {
    fail("captured Python program mounts are malformed");
  }
  const bundle = Buffer.from(JSON.stringify({
    schema: "cadr-m8-m9-python-pipe-bundle-v2",
    program_root: CAPTURED_PYTHON_PROGRAM_ROOT,
    root: closure.root,
    closure_sha256: closure.sha256,
    bootstrap_sha256: CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
    python_identity: pythonBinding.identity,
    python_path: pythonBinding.path,
    python_ancestry: pythonBinding.ancestry,
    prepython_authority: {
      build_receipt: authority.build_receipt,
      bootstrap: authority.bootstrap.identity,
      launcher: authority.launcher.identity,
      guard: authority.guard.identity,
    },
    yama_ptrace_scope: yamaPtraceScope,
    filesystem_permit: filesystemPermit.summary,
    programs,
  }), "ascii");
  return Object.freeze({ root: Buffer.from(rootProgram.bytes), root_path: rootProgram.path,
    helpers: Object.freeze(helpers), bundle,
    programIdentity: Object.freeze({
      bytes: rootProgram.identity.bytes, sha256: rootProgram.identity.sha256,
      closure_sha256: closure.sha256,
    }),
    bootstrapSha256: CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
  });
}

function parentDirectories(paths) {
  const directories = new Set();
  for (const path of paths) {
    let cursor = dirname(path);
    while (cursor !== "/") {
      if (!cursor.startsWith("/gnu/store")) directories.add(cursor);
      cursor = dirname(cursor);
    }
  }
  return [...directories].sort((left, right) =>
    left.split("/").length - right.split("/").length ||
    left.localeCompare(right));
}

function capturedProgramDestination(path, label) {
  if (typeof path !== "string" || path.length === 0 || path.startsWith("/") ||
      path.includes("\0") || path.split("/").some(part =>
        part === "" || part === "." || part === "..")) {
    fail(`${label} is not a safe captured Python relative path`);
  }
  const destination = resolve(CAPTURED_PYTHON_PROGRAM_ROOT, path);
  if (!destination.startsWith(`${CAPTURED_PYTHON_PROGRAM_ROOT}/`)) {
    fail(`${label} escapes the captured Python root`);
  }
  return destination;
}

function capturedPythonBwrapArguments(argv, filesystemPermit, pipeProgram) {
  if (!Array.isArray(filesystemPermit?.entries) ||
      filesystemPermit.entries.length === 0 ||
      !Array.isArray(pipeProgram?.helpers)) {
    fail("captured Python requires a nonempty filesystem permit");
  }
  const mountArguments = [];
  const rootDestination = capturedProgramDestination(pipeProgram.root_path,
    "captured Python root");
  const sitecustomizeDestination = "/tmp/cadr-captured/sitecustomize.py";
  const helperDestinations = pipeProgram.helpers.map(item =>
    capturedProgramDestination(item.path, "captured Python helper"));
  if (new Set([rootDestination, ...helperDestinations]).size !== 1 + helperDestinations.length) {
    fail("captured Python mount destinations are ambiguous");
  }
  const destinations = [rootDestination, ...helperDestinations,
    ...filesystemPermit.entries.map(entry => entry.destination)];
  for (const directory of parentDirectories(destinations)) {
    mountArguments.push("--dir", directory);
  }
  mountArguments.push("--ro-bind-data", "4", rootDestination,
    "--ro-bind-fd", "6", sitecustomizeDestination);
  for (const [index, helper] of pipeProgram.helpers.entries()) {
    mountArguments.push("--ro-bind-data", String(CAPTURED_PYTHON_HELPER_FD + index),
      helperDestinations[index]);
  }
  const permitFdStart = CAPTURED_PYTHON_HELPER_FD + pipeProgram.helpers.length;
  for (const [index, entry] of filesystemPermit.entries.entries()) {
    mountArguments.push(entry.writable ? "--bind-fd" : "--ro-bind-fd",
      String(permitFdStart + index), entry.destination);
  }
  return [
    "--unshare-user", "--unshare-pid", "--unshare-ipc", "--unshare-uts",
    "--unshare-net", "--unshare-cgroup-try", "--disable-userns", "--new-session",
    "--die-with-parent",
    "--tmpfs", "/", "--dir", "/gnu", "--dir", "/gnu/store",
    "--proc", "/proc", "--dev", "/dev",
    "--tmpfs", "/tmp", "--perms", "0555", "--dir", "/tmp/cadr-captured",
    "--ro-bind-fd", "3", "/tmp/cadr-captured/python",
    "--ro-bind-data", "5", "/tmp/cadr-captured/bundle.json",
    "--ro-bind-fd", "7", "/tmp/cadr-captured/inner-launcher",
    "--ro-bind-fd", "8", "/tmp/cadr-captured/prepython-guard.so",
    ...mountArguments,
    "--chdir", "/tmp/cadr-captured", "--clearenv",
    "--setenv", "LANG", "C", "--setenv", "LC_ALL", "C",
    "--setenv", "TZ", "UTC",
    "--setenv", "CADR_M8_M9_PYTHON_PROGRAM_ROOT",
    CAPTURED_PYTHON_PROGRAM_ROOT,
    "--", "/tmp/cadr-captured/inner-launcher", rootDestination, ...argv,
  ];
}

function permitDestination(filesystemPermit, path, label) {
  const destination = canonicalRuntimePath(path, label);
  const entry = filesystemPermit.entries.find(item =>
    item.destination === destination);
  if (entry === undefined) {
    fail(`${label} is absent from the filesystem permit`);
  }
  return entry.destination;
}

export function assertPermitDescriptorsUnchanged(filesystemPermit, {
  identityForFd = nativePythonFdIdentity, fstatSyncImpl = fstatSync,
} = {}) {
  for (const entry of filesystemPermit.entries) {
    if (entry.directory) {
      const information = fstatSyncImpl(entry.fd, { bigint: true });
      if (!information.isDirectory() ||
          information.dev.toString() !== entry.identity.device ||
          information.ino.toString() !== entry.identity.inode) {
        fail(`filesystem permit directory ${entry.role} changed during child execution`);
      }
      continue;
    }
    const actual = identityForFd(entry.fd);
    for (const field of ["bytes", "sha256", "device", "inode"]) {
      if (actual[field] !== entry.identity[field]) {
        fail(`filesystem permit file ${entry.role} changed during child execution`);
      }
    }
  }
}

/* The parent keeps every authority artifact open across child execution.  A
 * second descriptor read binds the outer receipt to the bytes that were still
 * mounted when the child exited; checking only the child's self-report would
 * not close a replacement/restoration race in the parent. */
function assertAuthorityDescriptorsUnchanged(authority, {
  identityForFd = nativePythonFdIdentity,
  elfForFd = elfIdentityForFd,
} = {}) {
  const receipt = authority?.build_receipt;
  if (receipt === undefined || authority?.guix === undefined ||
      authority?.bootstrap === undefined || authority?.launcher === undefined ||
      authority?.guard === undefined) {
    fail("captured Python authority is incomplete before post-child rehash");
  }
  const bindings = [
    ["Guix client", authority.guix, receipt.guix_client.identity],
    ["bootstrap", authority.bootstrap, receipt.authority.bootstrap],
    ["launcher", authority.launcher, receipt.authority.launcher.identity],
    ["guard", authority.guard, receipt.authority.guard.identity],
  ];
  for (const [label, binding, expected] of bindings) {
    const actual = identityForFd(binding.fd);
    assertDescriptorUnchanged(actual, binding.identity,
      `native M8/M9 capture ${label} descriptor`);
    exactIdentityEqual(actual, expected,
      `native M8/M9 capture ${label} receipt artifact`);
  }
  if (canonicalJson(elfForFd(authority.launcher.fd)) !==
        canonicalJson(receipt.authority.launcher.elf) ||
      canonicalJson(elfForFd(authority.guard.fd)) !==
        canonicalJson(receipt.authority.guard.elf)) {
    fail("native M8/M9 capture authority ELF profiles changed during child execution");
  }
}

function assertDescriptorUnchanged(actual, expected, label) {
  for (const field of ["bytes", "sha256", "device", "inode"]) {
    if (actual?.[field] !== expected?.[field]) {
      fail(`${label} changed during child execution`);
    }
  }
}

export async function runCapturedPythonClosureHostProbe(closure, {
  argv = [], filesystemPermit = null, afterProgramPipes = null,
  openPythonExecutable = openNativePythonExecutable,
  openPythonAuthority = openCapturedPythonAuthority,
  hostPtraceScope = readHostPtraceScope,
  openLauncherExecutable = () => openRootOwnedExecutable("bwrap"),
  identityForFd = nativePythonFdIdentity, elfForFd = elfIdentityForFd,
  fstatSyncImpl = fstatSync,
  closeSyncImpl = closeSync,
  spawnImpl = spawn, makePipeBundle = nativePythonPipeBundle,
  computeRuntimeClosure = canonicalGuixRuntimeClosure,
  openProbePermit = openHostProbeFilesystemPermit,
} = {}) {
  let nativePython; let authority; let launcher; let ownedPermit = null;
  try {
    nativePython = openPythonExecutable();
    const yamaPtraceScope = requireHostPtraceScopeThree(hostPtraceScope());
    authority = openPythonAuthority({
      expectedYamaPtraceScope: yamaPtraceScope,
    });
    if (filesystemPermit === null) {
      ownedPermit = openProbePermit(computeRuntimeClosure(nativePython,
        authority.guix), closure);
      filesystemPermit = ownedPermit;
    }
    launcher = openLauncherExecutable();
    const pipeProgram = makePipeBundle(closure, nativePython,
      authority, yamaPtraceScope, filesystemPermit);
    return await new Promise((resolveProbe, rejectProbe) => {
      const child = spawnImpl("/proc/self/fd/9",
        capturedPythonBwrapArguments(argv, filesystemPermit, pipeProgram), {
          cwd: ROOT,
          env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
          stdio: ["ignore", "pipe", "pipe", nativePython.fd, "pipe",
            "pipe", authority.bootstrap.fd, authority.launcher.fd,
            authority.guard.fd, launcher.fd,
            ...pipeProgram.helpers.map(() => "pipe"),
            ...filesystemPermit.childPassThroughDescriptors],
        });
      const stdout = []; const stderr = [];
      child.stdout.on("data", chunk => stdout.push(chunk));
      child.stderr.on("data", chunk => stderr.push(chunk));
      child.once("error", rejectProbe);
      child.stdio[4].end(pipeProgram.root);
      child.stdio[5].end(pipeProgram.bundle);
      for (const [index, helper] of pipeProgram.helpers.entries()) {
        child.stdio[CAPTURED_PYTHON_HELPER_FD + index].end(helper.bytes);
      }
      const adversary = Promise.resolve(afterProgramPipes?.());
      child.once("close", async (code, signal) => {
        try {
          await adversary;
          assertDescriptorUnchanged(identityForFd(nativePython.fd), nativePython.identity,
            "host probe Python descriptor");
          assertDescriptorUnchanged(identityForFd(launcher.fd), launcher.identity,
            "host probe launcher descriptor");
          assertAuthorityDescriptorsUnchanged(authority, { identityForFd, elfForFd });
          assertPermitDescriptorsUnchanged(filesystemPermit, {
            identityForFd, fstatSyncImpl,
          });
          const childStderr = consumeBootstrapStarted(
            Buffer.concat(stderr).toString("utf8"));
          resolveProbe(Object.freeze({ code, signal: signal ?? null,
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: childStderr, bootstrap_started: true }));
        } catch (error) { rejectProbe(error); }
      });
    });
  } finally {
    closeDescriptorBinding(nativePython, closeSyncImpl);
    closeDescriptorBinding(launcher, closeSyncImpl);
    closeDescriptorBinding(authority, closeSyncImpl);
    closeDescriptorBinding(ownedPermit, closeSyncImpl);
  }
}

async function assertPrivateDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
      (info.mode & 0o7777) !== 0o700) fail(`${label} must be a current-owner exact 0700 directory`);
}
async function assertPrivateFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.nlink !== 1 ||
      (info.mode & 0o7777) !== 0o600) fail(`${label} must be a current-owner singly linked 0600 file`);
}
async function writePrivateNew(path, value) {
  await assertPrivateDirectory(dirname(path), "private result parent");
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(canonicalJson(value));
  const handle = await open(path, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL | FS.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  await chmod(path, 0o600); await assertPrivateFile(path, "private result");
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
}
async function fileIdentity(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} is not a regular non-symlink file`);
  const bytes = await readFile(path);
  return Object.freeze({ path: repositoryPath(path, label), bytes: bytes.byteLength, sha256: sha256(bytes) });
}
/**
 * The compiled module is bound to the bytes read from one already-open regular
 * file.  The post-compile descriptor and pathname checks make a replacement
 * of either the artifact or its final locator a hard failure, rather than
 * letting a later `readFile(path)` silently execute different Wasm bytes.
 */
export async function compileBoundM9DevidWasm(path, label = "M9-DEVID Wasm module") {
  const repositoryRelative = repositoryPath(path, label);
  let fd;
  try { fd = openSync(path, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW); }
  catch (error) { fail(`cannot open ${label} without following links: ${error?.message ?? String(error)}`); }
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) fail(`${label} descriptor is not a regular file`);
    const bytes = new Uint8Array(readFileSync(`/proc/self/fd/${fd}`));
    const identity = Object.freeze({ path: repositoryRelative, bytes: bytes.byteLength,
      sha256: sha256(bytes) });
    const module = await WebAssembly.compile(bytes);
    const after = fstatSync(fd, { bigint: true });
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino ||
        after.size !== before.size) {
      fail(`${label} descriptor changed during read/compile`);
    }
    const named = await lstat(path, { bigint: true });
    if (!named.isFile() || named.isSymbolicLink() || named.dev !== before.dev ||
        named.ino !== before.ino || named.size !== before.size) {
      fail(`${label} pathname changed during read/compile`);
    }
    return Object.freeze({ identity, bytes, module,
      execution: Object.freeze({ ...identity, device: before.dev.toString(),
        inode: before.ino.toString() }) });
  } finally { closeSync(fd); }
}
async function toolIdentity(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} is not a regular non-symlink file`);
  const bytes = await readFile(path);
  /* A host tool is not a repository sidecar.  Retaining an absolute (or
   * ../../-spelled) pathname would make a receipt both non-portable and an
   * unsafe path authority for its verifier. */
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
}
function repositoryPath(path, label) {
  const result = relative(ROOT, resolve(path)).split("\\").join("/");
  if (result.length === 0 || result === ".." || result.startsWith("../")) {
    fail(`${label} is outside the repository`);
  }
  return result;
}
async function sourceProvenance(join) {
  const byPath = new Map(join.source_closure.files.map(file => [file.path, file]));
  const identities = CADR_M8_M9_DIRECT_AUTHORITIES.map(path => {
    const identity = byPath.get(path);
    if (identity === undefined) fail(`provenance join omitted direct source authority ${path}`);
    return identity;
  });
  const revision = spawnSync("git", ["rev-parse", "HEAD"],
    { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  const status = spawnSync("git", ["status", "--porcelain=v1", "--", ...CADR_M8_M9_DIRECT_AUTHORITIES],
    { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (revision.error || revision.status !== 0 || status.error || status.status !== 0) {
    fail("cannot bind direct campaign source control");
  }
  return Object.freeze({ revision: revision.stdout.trim(),
    closure_dirty: status.stdout.length !== 0,
    dirty_policy: CADR_M8_M9_DIRECT_DIRTY_POLICY,
    status_sha256: sha256(Buffer.from(status.stdout)), status: status.stdout,
    files: Object.freeze(identities.map(identity => Object.freeze({ ...identity }))) });
}
async function readJson(path, label) {
  const bytes = await readFile(path);
  try { return Object.freeze({ bytes: new Uint8Array(bytes),
    identity: Object.freeze({ path: repositoryPath(path, label), bytes: bytes.byteLength,
      sha256: sha256(bytes) }),
    value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }); }
  catch (error) { fail(`${label} is not UTF-8 JSON: ${error.message}`); }
}

export async function captureNativeMetadata(path, responseMetadata, {
  afterDescriptorOpen = null,
} = {}) {
  const namedBefore = await lstat(path, { bigint: true });
  if (!namedBefore.isFile() || namedBefore.isSymbolicLink() ||
      namedBefore.uid !== BigInt(process.getuid()) ||
      (namedBefore.mode & 0o7777n) !== 0o600n || namedBefore.nlink !== 1n) {
    fail("native metadata must be a current-owner singly linked 0600 file");
  }
  let fd;
  try { fd = openSync(path, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW); }
  catch (error) { fail(`cannot descriptor-open native metadata: ${error?.message ?? String(error)}`); }
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== namedBefore.dev ||
        opened.ino !== namedBefore.ino) {
      fail("native metadata changed while being opened");
    }
    if (afterDescriptorOpen !== null) await afterDescriptorOpen();
    const bytes = new Uint8Array(readFileSync(`/proc/self/fd/${fd}`));
    const after = fstatSync(fd, { bigint: true });
    if (!after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino ||
        after.size !== opened.size) {
      fail("native metadata descriptor changed while being read");
    }
    const namedAfter = await lstat(path, { bigint: true });
    if (!namedAfter.isFile() || namedAfter.isSymbolicLink() ||
        namedAfter.dev !== opened.dev || namedAfter.ino !== opened.ino ||
        namedAfter.size !== opened.size) {
      fail("native metadata pathname changed while being read");
    }
    let value;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error) {
      fail(`native metadata is not UTF-8 JSON: ${error.message}`);
    }
    const expectedBytes = new TextEncoder().encode(
      `${canonicalJson(responseMetadata)}\n`);
    if (!sameBytes(bytes, expectedBytes) ||
        canonicalJson(value) !== canonicalJson(responseMetadata)) {
      fail("native metadata file differs from the descriptor-bound child response");
    }
    return Object.freeze({ bytes,
      identity: Object.freeze({ path: repositoryPath(path, "native metadata"),
        bytes: bytes.byteLength, sha256: sha256(bytes) }),
      value: Object.freeze(value) });
  } finally { closeSync(fd); }
}

function parseArgs(argv) {
  const options = { artifactRoot: ROOT, execute: false, nativeConfig: null,
    prepared: "build/cadr-oracle/m8-m9-x11-prepared-v4", sessionRoot: "build/cadr-oracle",
    variant: "O0", wasm: null, portableCanary: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs --execute --native-config PATH [--prepared REPO_REL] [--artifact-root ROOT] [--session-root build/cadr-oracle] [--variant O0|O2] [--wasm PATH]\n");
      process.stdout.write("       guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs --execute --portable-canary --variant O2 [--artifact-root ROOT] [--session-root build/cadr-oracle] [--wasm PATH]\n");
      process.stdout.write("Without --execute this command refuses to create or launch a private CADR runtime.\n");
      process.exit(0);
    }
    if (argument === "--execute") { if (seen.has(argument)) fail("--execute was supplied twice"); seen.add(argument); options.execute = true; continue; }
    if (argument === "--portable-canary") { if (seen.has(argument)) fail("--portable-canary was supplied twice"); seen.add(argument); options.portableCanary = true; continue; }
    if (!["--native-config", "--prepared", "--artifact-root", "--session-root", "--variant", "--wasm"].includes(argument) || seen.has(argument)) fail(`unknown or repeated argument ${JSON.stringify(argument)}`);
    seen.add(argument); const value = argv[++index]; if (typeof value !== "string" || value.length === 0) fail(`${argument} requires a value`);
    if (argument === "--artifact-root") options.artifactRoot = resolve(value);
    else if (argument === "--wasm") options.wasm = resolve(value);
    else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!["O0", "O2"].includes(options.variant)) fail("--variant must be O0 or O2");
  if (options.portableCanary && options.variant !== "O2") {
    fail("--portable-canary is deliberately limited to the selected O2 M9-DEVID build");
  }
  if (options.wasm === null) options.wasm = resolve(ROOT, `cadr-web/build/cadr-web-m9-devid-${options.variant}.wasm`);
  return Object.freeze(options);
}

async function makeFreshSession(sessionRoot) {
  const root = resolve(ROOT, sessionRoot);
  if (root !== PRIVATE_ROOT && !root.startsWith(`${PRIVATE_ROOT}/`)) fail("session root must stay below ignored build/cadr-oracle");
  await mkdir(root, { recursive: true, mode: 0o700 }); await chmod(root, 0o700); await assertPrivateDirectory(root, "C-M8/CW2 session root");
  const id = `m8-cw2-${randomUUID().replaceAll("-", "")}`; const path = resolve(root, id);
  await mkdir(path, { mode: 0o700 }); await chmod(path, 0o700); await assertPrivateDirectory(path, "C-M8/CW2 session");
  for (const name of ["native", "portable"]) { const child = resolve(path, name); await mkdir(child, { mode: 0o700 }); await chmod(child, 0o700); await assertPrivateDirectory(child, `C-M8/CW2 ${name}`); }
  return Object.freeze({ id, path });
}

class ProtocolV6Client {
  constructor(worker, sessionId) {
    this.worker = worker; this.sessionId = sessionId; this.nextId = 1; this.pending = new Map(); this.closed = false;
    this.log = [Object.freeze({ schema: "cadr-m8-m9-portable-session-v1", session_id: sessionId })];
    worker.on("message", message => this.#onMessage(message));
    worker.on("error", error => this.#fail(error));
    worker.on("exit", code => { if (!this.closed && code !== 0) this.#fail(new Error(`protocol-v6 worker exited ${code}`)); });
  }
  #onMessage(message) {
    const pending = this.pending.get(message?.id);
    if (pending === undefined) { this.#fail(new Error("protocol-v6 received an unsolicited response")); return; }
    this.pending.delete(message.id); clearTimeout(pending.timeout);
    this.log.push(Object.freeze({ session_id: this.sessionId, id: message.id, op: pending.op,
      status: Number.isSafeInteger(message?.status) ? message.status : null, lifecycle: typeof message?.lifecycle === "string" ? message.lifecycle : null }));
    if (message?.type !== "cadr-response" || message.version !== PROTOCOL_VERSION || message.op !== pending.op || !Number.isSafeInteger(message.status)) { pending.reject(new Error(`protocol-v6 malformed ${pending.op} response`)); return; }
    pending.resolve(message);
  }
  #fail(error) { for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); } this.pending.clear(); }
  request(op, fields = {}, transfer = []) {
    if (this.closed) return Promise.reject(new Error("protocol-v6 request after close"));
    const id = this.nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => { this.pending.delete(id); rejectRequest(new Error(`protocol-v6 ${op} timed out after ${REQUEST_TIMEOUT_MS}ms`)); }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { timeout, op, resolve: resolveRequest, reject: rejectRequest });
      try { this.worker.postMessage({ version: PROTOCOL_VERSION, id, op, ...fields }, transfer); }
      catch (error) { this.pending.delete(id); clearTimeout(timeout); rejectRequest(error); }
    });
  }
  async close() { if (this.closed) return Object.freeze({ pending_requests: 0, terminated: true }); if (this.pending.size !== 0) fail("portable worker has pending requests at termination"); this.closed = true; await this.worker.terminate(); return Object.freeze({ pending_requests: 0, terminated: true }); }
}

export function serializeProtocolV6Log(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    fail("protocol-v6 NDJSON log is empty");
  }
  return new TextEncoder().encode(`${entries.map(entry => canonicalJson(entry)).join("\n")}\n`);
}

class LocalArtifacts {
  constructor(items) { this.items = items; }
  get artifacts() { return this.items.map(item => item.artifact); }
  async close() { await Promise.all(this.items.map(item => item.handle.close().catch(() => {}))); }
}
async function openArtifacts(expected, artifactRoot) {
  const items = [];
  try {
    for (const item of expected) {
      const path = resolve(artifactRoot, item.local_path); const [info, handle] = await Promise.all([lstat(path), open(path, "r")]);
      if (!info.isFile() || info.isSymbolicLink() || BigInt(info.size) !== BigInt(item.byte_count)) { await handle.close(); fail(`local ${item.local_path} differs from its release identity`); }
      items.push(Object.freeze({ item, handle, artifact: Object.freeze({ kind: item.kind, byteCount: BigInt(item.byte_count),
        async readRange(offset, length) {
          if (offset < 0n || length < 0n || offset > BigInt(item.byte_count) || length > BigInt(item.byte_count) - offset || length > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("artifact range is outside source bytes");
          const buffer = Buffer.allocUnsafe(Number(length)); const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, Number(offset)); return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead).slice();
        },
      }) }));
    }
    return new LocalArtifacts(items);
  } catch (error) { await Promise.all(items.map(item => item.handle.close().catch(() => {}))); throw error; }
}
async function hashArtifact(artifact) {
  const digest = createHash("sha256");
  for (let offset = 0n; offset < artifact.byteCount; offset += 1_048_576n) { const length = artifact.byteCount - offset < 1_048_576n ? artifact.byteCount - offset : 1_048_576n; const bytes = await artifact.readRange(offset, length); if (!(bytes instanceof Uint8Array) || BigInt(bytes.byteLength) !== length) fail("artifact source returned a short range"); digest.update(bytes); }
  return new Uint8Array(digest.digest());
}
function readyLimit(release) {
  const samples = release.idle_oracle?.sample_count; const first = release.native_runs?.[0]?.suffix_first_boundary;
  if (!Number.isSafeInteger(samples) || samples < 1 || typeof first !== "string" || !/^[1-9][0-9]*$/.test(first) || !Array.isArray(release.native_runs) || release.native_runs.length !== 3 || !release.native_runs.every(run => run?.suffix_first_boundary === first)) fail("M6 release does not provide a stable bounded READY limit");
  return BigInt(first) + BigInt(samples - 1);
}

function exactDigestBytes(value, label) {
  const bytes = bytesOf(value);
  if (bytes?.byteLength !== 32) fail(`${label} is not an exact 32-byte digest`);
  return Object.freeze({ bytes: 32, sha256: Buffer.from(bytes).toString("hex") });
}

function ready4MachineInfo(value) {
  const keys = ["lifecycle", "artifactMask", "boundary", "microinstructions", "generation",
    "nextRequestId", "outstandingRequestId", "lastCompletedRequestId", "persistentStatus", "profile"];
  if (value === null || typeof value !== "object" || Object.keys(value).sort().join("\0") !== keys.sort().join("\0") ||
      value.lifecycle !== 2 || value.artifactMask !== 0x1f || value.persistentStatus !== 0 ||
      typeof value.boundary !== "bigint" || typeof value.microinstructions !== "bigint" ||
      typeof value.generation !== "bigint" || typeof value.nextRequestId !== "bigint" ||
      typeof value.outstandingRequestId !== "bigint" || typeof value.lastCompletedRequestId !== "bigint" ||
      !Number.isSafeInteger(value.profile) || value.outstandingRequestId !== 0n) {
    fail("READY4 machine-info is incomplete or nonquiescent");
  }
  return Object.freeze({ lifecycle: value.lifecycle, artifact_mask: value.artifactMask,
    boundary: value.boundary.toString(), microinstructions: value.microinstructions.toString(),
    generation: value.generation.toString(), next_request_id: value.nextRequestId.toString(),
    outstanding_request_id: value.outstandingRequestId.toString(),
    last_completed_request_id: value.lastCompletedRequestId.toString(),
    persistent_status: value.persistentStatus, profile: value.profile });
}

function ready4Quiescence(value) {
  const keys = ["machineInfo", "scheduler"];
  const schedulerKeys = ["lifecycle", "runActive", "deferredControlCount", "pendingBoundaryDigest",
    "mediaBusy", "mediaSnapshotBlocked", "visibilityInitialized", "hidden",
    "blockServicePending", "hostNextRequestStatus"];
  if (value === null || typeof value !== "object" || Object.keys(value).sort().join("\0") !== keys.sort().join("\0") ||
      value.scheduler === null || typeof value.scheduler !== "object" ||
      Object.keys(value.scheduler).sort().join("\0") !== schedulerKeys.sort().join("\0") ||
      value.scheduler.lifecycle !== "PAUSED" || value.scheduler.runActive !== false ||
      value.scheduler.deferredControlCount !== 0 || value.scheduler.pendingBoundaryDigest !== false ||
      value.scheduler.mediaBusy !== false || value.scheduler.mediaSnapshotBlocked !== false ||
      value.scheduler.visibilityInitialized !== true || value.scheduler.hidden !== false ||
      value.scheduler.blockServicePending !== false || value.scheduler.hostNextRequestStatus !== 9) {
    fail("READY4 worker quiescence evidence is incomplete or nonquiescent");
  }
  return Object.freeze({ scheduler_lifecycle: value.scheduler.lifecycle,
    run_active: value.scheduler.runActive,
    deferred_control_count: value.scheduler.deferredControlCount,
    pending_boundary_digest: value.scheduler.pendingBoundaryDigest,
    media_busy: value.scheduler.mediaBusy,
    media_snapshot_blocked: value.scheduler.mediaSnapshotBlocked,
    visibility_initialized: value.scheduler.visibilityInitialized,
    hidden: value.scheduler.hidden,
    block_service_pending: value.scheduler.blockServicePending,
    host_next_request_status: value.scheduler.hostNextRequestStatus });
}

/* The full failure report can contain byte witnesses.  The canary retains
 * only bounded control-flow facts needed to reproduce a stopped READY4 boot,
 * never an artifact range, payload, or transcript body. */
function ready4FailureSummary(boot) {
  const report = boot?.report;
  const framing = report?.runFraming;
  const outstanding = report?.outstandingRequest;
  const decimalOrNull = value => typeof value === "bigint" ? value.toString() : null;
  return Object.freeze({ outcome: boot?.outcome ?? null, reason: report?.reason ?? null,
    phase: report?.phase ?? null, status: report?.status ?? null,
    boundary: decimalOrNull(report?.boundary), lifecycle: report?.lifecycle ?? null,
    transcript_count: Number.isSafeInteger(report?.transcriptCount) ? report.transcriptCount : null,
    run_framing: framing === null || framing === undefined ? null : Object.freeze({
      operation: framing.operation ?? null,
      requested_clock_slots: Number.isSafeInteger(framing.requestedClockSlots) ?
        framing.requestedClockSlots : null,
      completed_slots: decimalOrNull(framing.completedSlots),
      terminal_status: framing.terminalStatus ?? null, reason: framing.reason ?? null,
      pre_boundary: decimalOrNull(framing.preBoundary),
      post_boundary: decimalOrNull(framing.postBoundary),
    }),
    outstanding_request: outstanding === null || outstanding === undefined ? null : Object.freeze({
      generation: decimalOrNull(outstanding.generation), request_id: decimalOrNull(outstanding.requestId),
      operation: outstanding.operation ?? null,
      descriptor_bytes: decimalOrNull(outstanding.descriptorByteCount),
      request_payload_bytes: decimalOrNull(outstanding.requestPayloadByteCount),
      completion_bytes: decimalOrNull(outstanding.completionByteCount),
    }) });
}

async function exactReady4Receipt(boot, releaseRecord) {
  if (boot?.outcome !== "ready4" || boot.target !== CADR_M6_DEVID_PROFILE ||
      boot.contract !== CADR_M6_READY4_CONTRACT || boot.boundary !== 983990278n ||
      boot.noPendingOrOrphanedHostRequest !== true || boot?.machineInfo?.boundary !== boot.boundary ||
      boot?.machineInfo?.outstandingRequestId !== 0n) {
    const detail = Object.freeze({ target: boot?.target ?? null,
      contract: boot?.contract ?? null,
      boundary: typeof boot?.boundary === "bigint" ? boot.boundary.toString() : null,
      no_pending: boot?.noPendingOrOrphanedHostRequest ?? null,
      machine_boundary: typeof boot?.machineInfo?.boundary === "bigint" ?
        boot.machineInfo.boundary.toString() : null,
      outstanding_request_id: typeof boot?.machineInfo?.outstandingRequestId === "bigint" ?
        boot.machineInfo.outstandingRequestId.toString() : null,
      failure: ready4FailureSummary(boot) });
    const error = new TypeError(`C-M8/CW2: M9-DEVID portable boot did not reach exact quiescent READY4: ${canonicalJson(detail)}`);
    error.ready4Failure = detail;
    throw error;
  }
  const cdrm6e1 = bytesOf(boot.cdrm6e1);
  if (cdrm6e1?.byteLength !== 512 || sha256(cdrm6e1) !== Buffer.from(
    bytesOf(boot.cdrm6e1Sha256) ?? []).toString("hex") ||
      boot.cdrm6e1SelectedMaximum !== 0x7fffffffffffffffn ||
      typeof boot.cdrm6e1TotalAccepted !== "bigint" ||
      typeof boot.cdrm6e1TailEventCount !== "bigint" ||
      boot.cdrm6e1TailEventCount !== boot.cdrm6e1TotalAccepted - 512n ||
      boot.cdrm6e1TotalAccepted > boot.cdrm6e1SelectedMaximum ||
      !Number.isSafeInteger(boot.checkpointCount) || boot.checkpointCount < 1 ||
      !Number.isSafeInteger(boot.hostWaitCount) || boot.hostWaitCount < 0) {
    fail("M9-DEVID READY4 CDRM6E1 or checkpoint evidence differs");
  }
  const hostTranscript = bytesOf(boot.hostTranscript);
  if (hostTranscript === null || sha256(hostTranscript) !== Buffer.from(
    bytesOf(boot.hostTranscriptSha256) ?? []).toString("hex")) {
    fail("M9-DEVID READY4 host transcript differs from its digest");
  }
  const ready3 = exactDigestBytes(boot?.ready?.ready3Witness, "READY4 ready3 witness");
  const ready4 = exactDigestBytes(boot?.ready?.ready4Witness, "READY4 ready4 witness");
  const checkpoint = exactDigestBytes(boot.checkpointChainSha256, "READY4 checkpoint chain");
  const hostWait = exactDigestBytes(boot.hostWaitChainSha256, "READY4 host-wait chain");
  if (!Array.isArray(boot.checkpointRecords) ||
      boot.checkpointRecords.length !== boot.checkpointCount) {
    fail("M9-DEVID READY4 settled-checkpoint materials differ from their count");
  }
  let expectedCheckpoint = new Uint8Array(createHash("sha256").update(
    "CDRM6FASTCHAIN1\0").digest());
  const checkpointRecords = [];
  for (const [index, record] of boot.checkpointRecords.entries()) {
    const fast = bytesOf(record?.fastRun);
    const stateDigest = bytesOf(record?.cdrstate5Sha256);
    const queueDigest = bytesOf(record?.cdrm5q1Sha256);
    const parsed = parseM6FastRunRecord(fast);
    if (parsed.reason === 3 || stateDigest?.byteLength !== 32 || queueDigest?.byteLength !== 32) {
      fail(`M9-DEVID READY4 settled checkpoint ${index} is incomplete`);
    }
    expectedCheckpoint = await appendM6FastCheckpoint(expectedCheckpoint, index,
      fast, stateDigest, queueDigest);
    checkpointRecords.push(Object.freeze({
      fast_run: Object.freeze({ bytes: 128, sha256: sha256(fast),
        hex: Buffer.from(fast).toString("hex") }),
      cdrstate5: exactDigestBytes(stateDigest, `READY4 checkpoint ${index} CDRSTATE5`),
      cdrm5q1: exactDigestBytes(queueDigest, `READY4 checkpoint ${index} CDRM5Q1`),
    }));
  }
  if (Buffer.from(expectedCheckpoint).toString("hex") !== checkpoint.sha256) {
    fail("M9-DEVID READY4 checkpoint chain differs from its settled materials");
  }
  if (!Array.isArray(boot.hostWaitRecords) || boot.hostWaitRecords.length !== boot.hostWaitCount) {
    fail("M9-DEVID READY4 host-wait record count differs from its commitment");
  }
  let expectedHostWait = new Uint8Array(createHash("sha256").update(
    "CDRM6FASTHOSTWAIT1\0").digest());
  const hostWaitRecords = [];
  for (const [index, record] of boot.hostWaitRecords.entries()) {
    const bytes = bytesOf(record);
    if (parseM6FastRunRecord(bytes).reason !== 3) {
      fail(`M9-DEVID READY4 host-wait record ${index} is not an exact reason-3 CDRM6FAST1`);
    }
    expectedHostWait = await appendM6FastHostWait(expectedHostWait, index, bytes);
    hostWaitRecords.push(Object.freeze({ bytes: bytes.byteLength,
      sha256: sha256(bytes), hex: Buffer.from(bytes).toString("hex") }));
  }
  if (Buffer.from(expectedHostWait).toString("hex") !== hostWait.sha256) {
    fail("M9-DEVID READY4 host-wait chain differs from its exact records");
  }
  const state = exactDigestBytes(boot.cdrstate5Sha256, "READY4 CDRSTATE5");
  const queue = exactDigestBytes(boot.cdrm5q1Sha256, "READY4 CDRM5Q1");
  const lastCheckpoint = checkpointRecords.at(-1);
  if (lastCheckpoint?.cdrstate5.sha256 !== state.sha256 ||
      lastCheckpoint?.cdrm5q1.sha256 !== queue.sha256) {
    fail("M9-DEVID READY4 terminal state/queue differ from the last settled checkpoint");
  }
  const artifactSet = exactDigestBytes(boot?.preflight?.artifactSetSha256,
    "READY4 artifact set");
  await parseM6ZeroLatencyHostTranscript(hostTranscript, {
    artifactSetSha256: bytesOf(boot?.preflight?.artifactSetSha256),
    hostWaitRecords: boot.hostWaitRecords,
  });
  const base = exactDigestBytes(boot?.runEvidence?.privateDiskBaseSha256,
    "READY4 private disk base");
  if (releaseRecord === null || typeof releaseRecord !== "object" ||
      typeof releaseRecord.path !== "string" || !Number.isSafeInteger(releaseRecord.bytes) ||
      !/^[0-9a-f]{64}$/.test(releaseRecord.sha256) ||
      typeof boot.runEvidence?.sessionId !== "string" ||
      !/^m6-ready4-session-[0-9a-f]{32}$/.test(boot.runEvidence.sessionId) ||
      typeof boot.runEvidence?.privateDiskInstanceId !== "string" ||
      !/^m6-ready4-private-disk-[0-9a-f]{32}$/.test(boot.runEvidence.privateDiskInstanceId)) {
    fail("M9-DEVID READY4 release or fresh run evidence is incomplete");
  }
  const machineInfo = ready4MachineInfo(boot.machineInfo);
  const quiescence = ready4Quiescence(boot.quiescence);
  if (machineInfo.boundary !== boot.boundary.toString()) {
    fail("M9-DEVID READY4 machine-info boundary differs from the READY boundary");
  }
  return Object.freeze({ schema: "cadr-m8-m9-ready4-evidence-v1",
    outcome: "ready4", target: boot.target, contract: boot.contract,
    boundary: boot.boundary.toString(), quiescent: true,
    release_record: Object.freeze({ ...releaseRecord }),
    run_evidence: Object.freeze({ session_id: boot.runEvidence.sessionId,
      private_disk_instance_id: boot.runEvidence.privateDiskInstanceId,
      private_disk_base: base }),
    machine_info: machineInfo, quiescence,
    ready3_witness: ready3, ready4_witness: ready4,
    cdrm6e1: Object.freeze({ bytes: cdrm6e1.byteLength,
      sha256: Buffer.from(bytesOf(boot.cdrm6e1Sha256)).toString("hex"),
      hex: Buffer.from(cdrm6e1).toString("hex"),
      selected_maximum: boot.cdrm6e1SelectedMaximum.toString(),
      total_accepted: boot.cdrm6e1TotalAccepted.toString(),
      tail_event_count: boot.cdrm6e1TailEventCount.toString() }),
    checkpoint_chain: Object.freeze({ count: boot.checkpointCount, ...checkpoint,
      records: Object.freeze(checkpointRecords) }),
    host_wait_chain: Object.freeze({ count: boot.hostWaitCount, ...hostWait, records: hostWaitRecords }),
    cdrstate5: state, cdrm5q1: queue,
    artifact_set: artifactSet,
    host_transcript: Object.freeze({ bytes: hostTranscript.byteLength,
      sha256: Buffer.from(bytesOf(boot.hostTranscriptSha256)).toString("hex"),
      hex: Buffer.from(hostTranscript).toString("hex") }),
    post_208_summary: null });
}

async function post208Ready4Summary(client, ready4, afterOrdinal) {
  if (afterOrdinal !== 208) fail("M9-DEVID post-208 summary has the wrong input ordinal");
  const response = await client.request("m6-disk-evidence-summary");
  if (response.status !== 0) fail("M9-DEVID post-208 CDRM6E1 summary is unavailable");
  const summary = parseM6DevidSummary(response);
  const digestHex = Buffer.from(summary.digest).toString("hex");
  if (sha256(summary.bytes) !== digestHex ||
      summary.selectedMaximum !== 0x7fffffffffffffffn ||
      summary.tailEventCount !== summary.totalAccepted - 512n ||
      summary.totalAccepted > summary.selectedMaximum ||
      summary.selectedMaximum.toString() !== ready4.cdrm6e1.selected_maximum ||
      summary.totalAccepted < BigInt(ready4.cdrm6e1.total_accepted)) {
    fail("M9-DEVID post-208 CDRM6E1 limit evidence is invalid");
  }
  return Object.freeze({ outcome: "limit-not-exceeded", after_input_ordinal: afterOrdinal,
    cdrm6e1: Object.freeze({
    bytes: summary.bytes.byteLength, sha256: digestHex,
    hex: Buffer.from(summary.bytes).toString("hex"),
    selected_maximum: summary.selectedMaximum.toString(),
    total_accepted: summary.totalAccepted.toString(),
    tail_event_count: summary.tailEventCount.toString() }) });
}
async function loadPinnedInputs() {
  const [profile, release] = await Promise.all([readJson(PROFILE_PATH, "CADR-WEB profile"), readJson(RELEASE_PATH, "frozen M6 release record")]);
  if (profile.value?.profile?.id !== "CADR-WEB-303" || release.value?.contract !== CADR_M6_READY_CONTRACT) fail("profile or M6 release identity is not selected CADR-WEB-303/M6");
  const records = new Map((release.value.artifacts ?? []).map(item => [item.kind, item]));
  const expected = ARTIFACT_LAYOUT.map(layout => { const item = records.get(layout.kind); if (typeof item?.byte_count !== "string" || !/^[1-9][0-9]*$/.test(item.byte_count) || !/^[0-9a-f]{64}$/.test(item.sha256)) fail(`M6 release has no exact artifact ${layout.kind}`); return Object.freeze({ ...layout, byte_count: item.byte_count, sha256: item.sha256 }); });
  return Object.freeze({ profile, release, expected });
}
function profileForM6(profile, expected) { return Object.freeze({ id: profile.value.profile.id, artifacts: expected.map(item => Object.freeze({ kind: item.kind, byteCount: BigInt(item.byte_count), sha256: Buffer.from(item.sha256, "hex") })) }); }

function parseInputState(response) {
  const bytes = bytesOf(response?.observation); if (response?.status !== 0 || response?.wireSchema !== "CDRIOB91" || bytes?.byteLength !== 64 || new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRIOB91") fail("worker did not return exact CDRIOB91 input state");
  return parseInputStateBytes(bytes);
}
function parseInputStateBytes(bytes) {
  if (bytes?.byteLength !== 64 || new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRIOB91") fail("worker receipt is not exact CDRIOB91");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 64 ||
      view.getUint32(56, true) !== 2 || view.getUint32(60, true) !== 0) fail("CDRIOB91 header, lifecycle, or reserved field differs");
  return Object.freeze({ bytes: bytes.slice(), csr: view.getUint32(16, true),
    scancode: view.getUint32(20, true), mouseX: view.getUint32(24, true),
    mouseY: view.getUint32(28, true), inputSequence: view.getUint32(32, true),
    keyboardFifoCount: view.getUint32(36, true),
    ingressOrdinal: view.getBigUint64(40, true),
    generation: view.getBigUint64(48, true), lifecycle: view.getUint32(56, true) });
}
function expectedInputState(prior, record) {
  const next = { ...prior, bytes: undefined, inputSequence: (prior.inputSequence + 1) >>> 0,
    ingressOrdinal: record.ordinal };
  if (record.kind === 1) {
    if ((prior.csr & (1 << 5)) === 0) {
      next.scancode = (0x10000 | record.payload) >>> 0;
      if ((prior.csr & (1 << 2)) !== 0) next.csr = (prior.csr | (1 << 5)) >>> 0;
    } else {
      next.keyboardFifoCount = (prior.keyboardFifoCount + 1) >>> 0;
    }
  } else if (record.kind === 2) {
    next.mouseX = record.payload & 0x3ff;
    next.mouseY = ((record.payload >>> 10) & 0x3ff) |
      (((record.payload >>> 20) & 7) << 12);
    next.csr = (prior.csr | (1 << 4)) >>> 0;
  } else fail("campaign contains an unknown input kind");
  return Object.freeze(next);
}

/* These are producer commands, not a second table of wire literals.  Their
 * CDRINP1 payloads are re-derived below from the frozen physical KeyQ mapping
 * and the EDGE32 encoder on every direct run. */
export const CADR_M8_M9_DEACTIVATION_COMMANDS = Object.freeze({
  keyboard_down: Object.freeze({ code: "KeyQ", repeat: false }),
  pointer_down: Object.freeze({ domButton: 0, x: 60, y: 70, tick: 8n }),
  neutralize: Object.freeze({ cause: "capture-loss", tick: 9n }),
});

/**
 * Derive the four exact post-campaign producer records.  `pointerGeneration`
 * belongs to the M9 controller (which advances after the campaign's capture
 * loss); CDRINP1 itself retains the current core generation.
 */
export function deriveCadrM8M9DeactivationProducer({ coreState, pointerGeneration }) {
  if (coreState === null || typeof coreState !== "object" ||
      typeof coreState.generation !== "bigint" || typeof coreState.ingressOrdinal !== "bigint" ||
      !Number.isSafeInteger(coreState.inputSequence) ||
      !Number.isSafeInteger(pointerGeneration) || pointerGeneration < 0 || pointerGeneration > 0xffffffff) {
    fail("cannot derive deactivation producer from the running controller/core state");
  }
  const key = cadrM8KeyForCode(CADR_M8_M9_DEACTIVATION_COMMANDS.keyboard_down.code);
  if (key === null || key.scancode !== 0x52) {
    fail("the selected KeyQ physical mapping is not exact scancode 0x52");
  }
  const pointerDownPayload = encodeCadrM9Edge32({
    x: CADR_M8_M9_DEACTIVATION_COMMANDS.pointer_down.x,
    y: CADR_M8_M9_DEACTIVATION_COMMANDS.pointer_down.y,
    buttonsAfter: 1, changedMask: 1, cause: "physical",
  });
  const pointerReleasePayload = encodeCadrM9Edge32({
    x: CADR_M8_M9_DEACTIVATION_COMMANDS.pointer_down.x,
    y: CADR_M8_M9_DEACTIVATION_COMMANDS.pointer_down.y,
    buttonsAfter: 0, changedMask: 1, cause: CADR_M8_M9_DEACTIVATION_COMMANDS.neutralize.cause,
  });
  const records = [
    Object.freeze({ stage: "keyboard_down", kind: 1, payload: key.scancode }),
    Object.freeze({ stage: "pointer_down", kind: 2, payload: pointerDownPayload }),
    Object.freeze({ stage: "neutralize", kind: 2, payload: pointerReleasePayload }),
    Object.freeze({ stage: "neutralize", kind: 1, payload: 0x8000 }),
  ].map((record, index) => {
    const ordinal = coreState.ingressOrdinal + BigInt(index + 1);
    return Object.freeze({ ...record, generation: coreState.generation, ordinal,
      bytes: encodeCdrInp1({ kind: record.kind, generation: coreState.generation, ordinal,
        payload: record.payload }) });
  });
  return Object.freeze({
    commands: Object.freeze({
      keyboard_down: CADR_M8_M9_DEACTIVATION_COMMANDS.keyboard_down,
      pointer_down: Object.freeze({ ...CADR_M8_M9_DEACTIVATION_COMMANDS.pointer_down,
        generation: pointerGeneration }),
      neutralize: Object.freeze({ ...CADR_M8_M9_DEACTIVATION_COMMANDS.neutralize,
        generation: pointerGeneration }),
    }),
    keyboard_down: Object.freeze([records[0]]),
    pointer_down: Object.freeze([records[1]]),
    neutralize: Object.freeze(records.slice(2)),
  });
}

function verifyCoreDelivery(delivery, records, initial, label) {
  if (delivery?.wireSchema !== "CDRINP1" || delivery.recordsDelivered !== records.length ||
      delivery.firstIngressOrdinal !== records[0]?.ordinal ||
      delivery.lastIngressOrdinal !== records.at(-1)?.ordinal ||
      delivery.inputSequence !== initial.inputSequence + records.length ||
      !Array.isArray(delivery.wireRecords) || delivery.wireRecords.length !== records.length ||
      !Array.isArray(delivery.coreObservations) || delivery.coreObservations.length !== records.length) {
    fail(`${label} delivery does not retain its complete CDRINP1/CDRIOB91 transition`);
  }
  let expected = initial;
  for (const [index, record] of records.entries()) {
    const wire = bytesOf(delivery.wireRecords[index]);
    if (wire === null || !sameBytes(wire, record.bytes)) {
      fail(`${label} CDRINP1 record ${index} is not derived from its producer command`);
    }
    expected = expectedInputState(expected, record);
    const observation = parseInputStateBytes(bytesOf(delivery.coreObservations[index]));
    for (const field of ["csr", "scancode", "mouseX", "mouseY", "inputSequence",
      "keyboardFifoCount", "ingressOrdinal", "generation", "lifecycle"]) {
      if (observation[field] !== expected[field]) {
        fail(`${label} CDRIOB91 transition ${index} differs from its exact CDRINP1 effect at ${field}`);
      }
    }
  }
  return expected;
}
function stateForJson(state) {
  return Object.freeze({ csr: state.csr, scancode: state.scancode,
    mouse_x: state.mouseX, mouse_y: state.mouseY,
    input_sequence: state.inputSequence, keyboard_fifo_count: state.keyboardFifoCount,
    ingress_ordinal: state.ingressOrdinal.toString(),
    generation: state.generation.toString(), lifecycle: state.lifecycle });
}
export async function quiesceKeyboardInput(client, initial, label,
  { maxRuns = 128, clockSlots = 8192,
    allowedScancodes = [initial.scancode] } = {}) {
  const allowed = new Set(allowedScancodes);
  if (allowed.size === 0 || [...allowed].some(value =>
    !Number.isInteger(value) || value < 0 || value > 0xffffffff)) {
    fail(`${label} has invalid allowed keyboard scancodes`);
  }
  let state = initial;
  const runs = [];
  let schedulerStarted = false;
  for (let attempt = 0; attempt <= maxRuns; attempt += 1) {
    if ((state.csr & (1 << 5)) === 0 && state.keyboardFifoCount === 0) {
      if (schedulerStarted) {
        const paused = await client.request("scheduler-pause");
        if (paused.status !== 0) fail(`${label} could not pause after keyboard consumption`);
      }
      return Object.freeze({ state, evidence: Object.freeze({
        label, outcome: "keyboard-iob-quiescent", run_count: runs.length,
        scheduler_started: schedulerStarted, scheduler_paused: schedulerStarted,
        allowed_scancodes: Object.freeze([...allowed]),
        allowed_mutations: Object.freeze([
          "csr keyboard-ready bit", "keyboard FIFO count",
          "scancode within the just-delivered down/all-up pair",
        ]),
        initial: stateForJson(initial), final: stateForJson(state),
        runs: Object.freeze(runs) }) });
    }
    if (attempt === maxRuns) break;
    if (!schedulerStarted) {
      const started = await client.request("scheduler-start");
      if (started.status !== 0) fail(`${label} could not start bounded guest consumption`);
      schedulerStarted = true;
    }
    const response = await client.request("scheduler-run", { clockSlots });
    if (response.status !== 0) {
      fail(`${label} guest consumption run failed with status ${response.status}`);
    }
    const next = parseInputState(await client.request("input-state"));
    for (const field of ["generation", "ingressOrdinal", "inputSequence", "lifecycle"]) {
      if (next[field] !== initial[field]) {
        fail(`${label} guest consumption changed invariant input field ${field}`);
      }
    }
    if (next.mouseX !== initial.mouseX || next.mouseY !== initial.mouseY) {
      fail(`${label} guest keyboard consumption changed mouse state`);
    }
    if ((next.csr & ~(1 << 5)) !== (initial.csr & ~(1 << 5))) {
      fail(`${label} guest keyboard consumption changed a non-READY CSR bit`);
    }
    if (!allowed.has(next.scancode)) {
      fail(`${label} guest keyboard consumption produced an unexpected scancode`);
    }
    runs.push(Object.freeze({ attempt: attempt + 1, requested_clock_slots: clockSlots,
      status: response.status,
      completed_slots: response.completedSlots?.toString() ?? null,
      microinstructions_executed: response.microinstructionsExecuted?.toString() ?? null,
      state: stateForJson(next) }));
    state = next;
  }
  fail(`${label} keyboard IOB did not quiesce after ${maxRuns} bounded runs`);
}
function sameBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}
function parseNativeScript(bytes) {
  const lines = new TextDecoder("ascii", { fatal: true }).decode(bytes).split("\n");
  if (lines.pop() !== "" || lines.shift() !== "CADR-M8-M9-INPUT-v1" || lines.length !== 207) fail("native campaign script has wrong shape");
  let prior = -1n; return lines.map((line, ordinal) => { const fields = line.split(" "); if (fields.length !== 5 || !/^[0-9]+$/.test(fields[0]) || !["keyboard", "pointer"].includes(fields[1])) fail("native campaign script has a malformed row"); const row = { boundary: BigInt(fields[0]), type: fields[1], first: Number(fields[2]), second: Number(fields[3]), third: Number(fields[4]), ordinal }; if (row.boundary <= prior) fail("native campaign boundaries are not strict"); prior = row.boundary; return Object.freeze(row); });
}
function parseNativeWitness(bytes, rows) {
  if (bytes.byteLength !== rows.length * 64) fail("native CDRM8N1 witness row count differs from script");
  for (const row of rows) {
    const record = bytes.subarray(row.ordinal * 64, row.ordinal * 64 + 64); const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
    if (new TextDecoder().decode(record.subarray(0, 7)) !== "CDRM8N1" || record[7] !== 0 || view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 64 || view.getUint32(16, true) !== (row.type === "keyboard" ? 1 : 2) || view.getUint32(20, true) !== 0 || view.getBigUint64(24, true) !== row.boundary || view.getUint32(52, true) !== row.ordinal || !record.subarray(56).every(byte => byte === 0)) fail("native CDRM8N1 header/order differs from input script");
    const actual = [view.getUint32(36, true), view.getUint32(40, true), view.getUint32(44, true), view.getUint32(48, true)]; const expected = row.type === "keyboard" ? [row.first, row.second, 0, 0] : [row.third, 0, row.first, row.second];
    if (actual.some((value, index) => value !== expected[index])) fail("native pre-IOB witness differs from the frozen row");
  }
  return Object.freeze({ schema: "CDRM8N1", record_bytes: 64, record_count: rows.length, sha256: sha256(bytes) });
}

export async function runNativeCapture({ prepared, nativeConfig, output, sessionId, diskId, inputScript, campaign }, {
  openPythonExecutable = openNativePythonExecutable, identityForFd = nativePythonFdIdentity,
  openPythonAuthority = openCapturedPythonAuthority,
  hostPtraceScope = readHostPtraceScope,
  openLauncherExecutable = () => openRootOwnedExecutable("bwrap"),
  openFilesystemPermit = openNativeFilesystemPermit,
  fstatSyncImpl = fstatSync, elfForFd = elfIdentityForFd,
  closeSyncImpl = closeSync, spawnImpl = spawn, nativePythonClosure = null,
  assertPythonPermit = assertSelectedNativePythonPermit,
  afterProgramPipes = null, makePipeBundle = nativePythonPipeBundle,
  computeRuntimeClosure = canonicalGuixRuntimeClosure,
} = {}) {
  const closure = nativePythonClosure ?? await captureCadrM8M9NativePythonClosure();
  assertPythonPermit(closure);
  const publicClosure = publicCadrM8M9NativePythonClosure(closure);
  let nativePython; let authority; let launcher; let filesystemPermit;
  try {
    nativePython = openPythonExecutable();
    const yamaPtraceScope = requireHostPtraceScopeThree(hostPtraceScope());
    authority = openPythonAuthority({
      expectedYamaPtraceScope: yamaPtraceScope,
    });
    const runtimeStore = openFilesystemPermit === openNativeFilesystemPermit
      ? computeRuntimeClosure(nativePython, authority.guix) : null;
    filesystemPermit = openFilesystemPermit({ prepared, nativeConfig, output,
      inputScript, campaign, runtimeStore });
    const preparedRoot = canonicalRuntimePath(prepared, "prepared native closure");
    if (filesystemPermit.summary?.prepared_file_closure?.root !== preparedRoot) {
      fail("prepared native closure root differs from its descriptor-held receipt");
    }
    const args = ["native-capture",
      "--prepared", preparedRoot,
      "--config", permitDestination(filesystemPermit, nativeConfig,
        "native configuration"),
      "--output", permitDestination(filesystemPermit, output,
        "isolated native output"),
      "--session-id", sessionId, "--private-disk-instance-id", diskId,
      "--input-script", permitDestination(filesystemPermit, inputScript,
        "native input script"),
      "--campaign", permitDestination(filesystemPermit, campaign,
        "native campaign"), "--execute"];
    launcher = openLauncherExecutable();
    const pipeProgram = makePipeBundle(closure, nativePython,
      authority, yamaPtraceScope, filesystemPermit);
    return await new Promise((resolveRun, rejectRun) => {
    const child = spawnImpl("/proc/self/fd/9",
      capturedPythonBwrapArguments(args, filesystemPermit, pipeProgram), { cwd: ROOT,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      stdio: ["ignore", "pipe", "pipe", nativePython.fd, "pipe", "pipe",
        authority.bootstrap.fd, authority.launcher.fd, authority.guard.fd,
        launcher.fd, ...pipeProgram.helpers.map(() => "pipe"),
        ...filesystemPermit.childPassThroughDescriptors] });
    const stdout = []; const stderr = [];
    child.stdout.on("data", chunk => stdout.push(chunk));
    child.stderr.on("data", chunk => stderr.push(chunk));
    child.once("error", rejectRun);
    child.stdio[4].end(pipeProgram.root);
    child.stdio[5].end(pipeProgram.bundle);
    for (const [index, helper] of pipeProgram.helpers.entries()) {
      child.stdio[CAPTURED_PYTHON_HELPER_FD + index].end(helper.bytes);
    }
    const afterProgramPipesPromise = Promise.resolve(afterProgramPipes?.({
      child, root: pipeProgram.root, bundle: pipeProgram.bundle,
    }));
    child.once("close", async (code, signal) => { try {
      await afterProgramPipesPromise;
      const text = Buffer.concat(stdout).toString("utf8").trim(); let response = null; try { response = JSON.parse(text); } catch { /* reported below */ }
      const childStderr = consumeBootstrapStarted(
        Buffer.concat(stderr).toString("utf8"));
      assertDescriptorUnchanged(identityForFd(nativePython.fd), nativePython.identity,
        "native M8/M9 capture Python descriptor");
      assertDescriptorUnchanged(identityForFd(launcher.fd), launcher.identity,
        "native M8/M9 capture launcher descriptor");
      assertAuthorityDescriptorsUnchanged(authority, { identityForFd, elfForFd });
      assertPermitDescriptorsUnchanged(filesystemPermit, {
        identityForFd, fstatSyncImpl,
      });
      if (code !== 0 || response?.status !== "captured") {
        rejectRun(new Error(`native M8/M9 capture failed (code=${code}, signal=${signal ?? "none"}): ${response?.error ?? childStderr.slice(-2000)}`));
        return;
      }
      const reportedPython = response?.metadata?.runtime_provenance?.python;
      assertFdBoundPythonIdentity(reportedPython, {
        ...nativePython.identity,
        executable_ancestry: nativePython.ancestry,
        prepython_seal: {
          authority_build_receipt: authority.build_receipt,
          filesystem_permit: filesystemPermit.summary,
          bootstrap: authority.bootstrap.identity,
          launcher: authority.launcher.identity,
          guard: authority.guard.identity,
        },
        yama_ptrace_scope: yamaPtraceScope,
      },
        "native M8/M9 capture Python provenance");
      assertFdBoundPythonProgramIdentity(
        response?.metadata?.runtime_provenance?.program,
        pipeProgram.programIdentity,
        "native M8/M9 capture Python program provenance");
      resolveRun(Object.freeze({ response,
        native_python_closure: publicClosure,
        oracle_process: Object.freeze({ returncode: code,
          signal: signal ?? null,
          bootstrap_sha256: pipeProgram.bootstrapSha256,
          pipe_bundle_sha256: sha256(pipeProgram.bundle),
          launcher: Object.freeze({ reference: "root-owned-bwrap",
            ...launcher.identity }),
          prepython_authority: Object.freeze({
            reference: "canonical-receipt-selected-guix-store-authority",
            root: authority.root,
            ancestry: authority.ancestry,
            build_receipt: authority.build_receipt,
            yama_ptrace_scope: yamaPtraceScope,
            filesystem_permit: filesystemPermit.summary,
            bootstrap: authority.bootstrap.identity,
            launcher: authority.launcher.identity,
            guard: authority.guard.identity,
          }) }) }));
    } catch (error) { rejectRun(error); }
    });
    });
  } finally {
    closeDescriptorBinding(nativePython, closeSyncImpl);
    closeDescriptorBinding(launcher, closeSyncImpl);
    closeDescriptorBinding(authority, closeSyncImpl);
    closeDescriptorBinding(filesystemPermit, closeSyncImpl);
  }
}

async function portableReplay({ wasm, artifactRoot, pinned, portableDirectory, sessionId, initialCampaign }) {
  const nodeIdentity = await toolIdentity(resolve(process.execPath), "Node executable");
  const module = wasm.module; const artifacts = await openArtifacts(pinned.expected, artifactRoot);
  const workerExecution = await createDescriptorCapturedM8M9Worker();
  const workerIdentity = workerExecution.rootIdentity;
  const client = new ProtocolV6Client(workerExecution.worker, sessionId); let termination = null;
  try {
    const instantiated = await client.request("instantiate", { module, m6DiskEvidencePolicy: true }); if (instantiated.status !== 0) fail(`protocol-v6 M9-DEVID Wasm instantiation failed with status ${instantiated.status}`);
    const profile = profileForM6(pinned.profile, pinned.expected);
    const boot = await runM6Ready4Fast({ client, artifacts: artifacts.artifacts, profile, hashArtifact,
      maxBoundaries: readyLimit(pinned.release.value), maxHostTransactions: 1024,
      fastSlots: 1048576,
      ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT,
        releaseRecord: pinned.release.bytes.slice() }) });
    const ready4 = await exactReady4Receipt(boot, pinned.release.identity);
    const before = parseInputState(await client.request("input-state"));
    if ((before.csr & (1 << 2)) === 0 || (before.csr & (1 << 5)) !== 0 ||
        before.keyboardFifoCount !== 0) {
      fail("frozen READY input baseline is not interrupt-enabled, ready-clear, FIFO-empty");
    }
    const campaign = buildCadrM8M9Campaign({ generation: before.generation, nativeStartBoundary: initialCampaign.nativeStartBoundary });
    if (serializeCadrM8M9NativeScript(campaign) !== serializeCadrM8M9NativeScript(initialCampaign)) fail("live browser generation changed the native input schedule");
    let recordIndex = 0; let observed = before; let expectedState = before;
    const observedRecords = []; const observedStates = []; const expectedStates = [];
    const consumptionBoundaries = [];
    for (const operation of campaign.browserOperations) {
      const { label, ...fields } = operation; const response = await client.request(fields.op, Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "op")));
      if (response.status !== 0 || response.delivery?.wireSchema !== "CDRINP1" || !Number.isSafeInteger(response.delivery.recordsDelivered) || response.delivery.recordsDelivered < 1) fail(`${label} was not delivered through CDRINP1`);
      const count = response.delivery.recordsDelivered; const expected = campaign.records.slice(recordIndex, recordIndex + count);
      if (expected.length !== count || response.delivery.firstIngressOrdinal !== expected[0].ordinal || response.delivery.lastIngressOrdinal !== expected.at(-1).ordinal || response.delivery.inputSequence !== observed.inputSequence + count) fail(`${label} has a nonconforming CDRINP1 delivery receipt`);
      if (!Array.isArray(response.delivery.wireRecords) ||
          !Array.isArray(response.delivery.coreObservations) ||
          response.delivery.wireRecords.length !== count ||
          response.delivery.coreObservations.length !== count) fail(`${label} omitted worker/core boundary receipts`);
      for (let index = 0; index < count; index += 1) {
        const actualRecord = bytesOf(response.delivery.wireRecords[index]);
        const actualState = parseInputStateBytes(bytesOf(response.delivery.coreObservations[index]));
        if (actualRecord === null || !sameBytes(actualRecord, expected[index].bytes)) {
          fail(`${label} worker CDRINP1 payload differs at record ${recordIndex + index}`);
        }
        expectedState = expectedInputState(expectedState, expected[index]);
        for (const field of ["csr", "scancode", "mouseX", "mouseY", "inputSequence",
          "keyboardFifoCount", "ingressOrdinal", "generation", "lifecycle"]) {
          if (actualState[field] !== expectedState[field]) {
            fail(`${label} core CDRIOB91 ${field} differs at record ${recordIndex + index}`);
          }
        }
        observedRecords.push(actualRecord.slice());
        observedStates.push(stateForJson(actualState));
        expectedStates.push(stateForJson(expectedState));
      }
      const next = parseInputState(await client.request("input-state"));
      if (next.generation !== before.generation || next.ingressOrdinal !== expected.at(-1).ordinal || next.inputSequence !== observed.inputSequence + count) fail(`${label} CDRIOB91 state did not observe exactly its CDRINP1 records`);
      recordIndex += count; observed = next;
      if (fields.op === "keyboard-up") {
        const pair = campaign.records.slice(recordIndex - 2, recordIndex);
        if (pair.length !== 2 || pair.some(record => record.kind !== 1)) {
          fail(`${label} does not terminate one exact keyboard pair`);
        }
        const quiescent = await quiesceKeyboardInput(client, observed, label, {
          allowedScancodes: [observed.scancode,
            ...pair.map(record => (0x10000 | record.payload) >>> 0)],
        });
        consumptionBoundaries.push(quiescent.evidence);
        observed = quiescent.state;
        expectedState = quiescent.state;
      }
    }
    if (recordIndex !== campaign.records.length || observed.ingressOrdinal !== BigInt(campaign.records.length) || observed.inputSequence !== before.inputSequence + campaign.records.length) fail("browser replay did not deliver complete CDRINP1 campaign");
    const post208 = await post208Ready4Summary(client, ready4, recordIndex);
    const expectedRaw = new Uint8Array(campaign.records.length * 40);
    campaign.records.forEach((record, index) => expectedRaw.set(record.bytes, index * 40));
    const observedRaw = new Uint8Array(observedRecords.length * 40);
    observedRecords.forEach((record, index) => observedRaw.set(record, index * 40));
    if (!sameBytes(expectedRaw, observedRaw)) fail("complete worker boundary capture differs from expected CDRINP1");
    const receipts = campaign.records.map(record => ({ label: record.label, kind: record.kind, ordinal: record.ordinal.toString(), payload: record.payload, sha256: sha256(record.bytes) }));
    const expectedCdrinp = await writePrivateNew(resolve(portableDirectory, "expected-input.cdrinp1"), expectedRaw);
    const observedCdrinp = await writePrivateNew(resolve(portableDirectory, "observed-input.cdrinp1"), observedRaw);
    const expectedStateFile = await writePrivateNew(resolve(portableDirectory, "expected-input-states.json"),
      { schema: "cadr-m8-m9-expected-input-states-v1",
        before: stateForJson(before), after: stateForJson(expectedState),
        records: receipts, states: expectedStates });
    const observedStateFile = await writePrivateNew(resolve(portableDirectory, "observed-input-states.json"),
      { schema: "cadr-m8-m9-observed-input-states-v1",
        before: stateForJson(before), after: stateForJson(observed),
        consumption_boundaries: consumptionBoundaries, states: observedStates });
    /* Exercise the shared worker path with both controllers live and the core
     * running.  The KeyQ and 60,70 EDGE32 payloads are derived from their
     * producer mappings/commands, then every CDRIOB91 post-delivery state is
     * compared rather than merely checking a tail shape. */
    const pointerBefore = await client.request("pointer-state");
    if (pointerBefore.status !== 0 || !Number.isSafeInteger(pointerBefore.result?.generation)) {
      fail("running worker did not expose the selected M9 controller generation");
    }
    const deactivationPlan = deriveCadrM8M9DeactivationProducer({ coreState: observed,
      pointerGeneration: pointerBefore.result.generation });
    const heldKey = await client.request("keyboard-down", deactivationPlan.commands.keyboard_down);
    const heldPointer = await client.request("pointer-down", deactivationPlan.commands.pointer_down);
    const neutralized = await client.request("pointer-neutralize", deactivationPlan.commands.neutralize);
    if (heldKey.status !== 0 || heldKey.delivery?.recordsDelivered !== 1 ||
        heldPointer.status !== 0 || heldPointer.delivery?.recordsDelivered !== 1 ||
        neutralized.status !== 0 || neutralized.delivery?.recordsDelivered !== 2 ||
        neutralized.deactivation?.heldKeysCleared !== 1 ||
        !Array.isArray(neutralized.delivery.wireRecords) ||
        neutralized.delivery.wireRecords.length !== 2) {
      fail("running worker/core shared held-key plus pointer deactivation failed");
    }
    const afterKey = verifyCoreDelivery(heldKey.delivery, deactivationPlan.keyboard_down, observed,
      "shared keyboard-down");
    const afterPointer = verifyCoreDelivery(heldPointer.delivery, deactivationPlan.pointer_down, afterKey,
      "shared pointer-down");
    const afterNeutralize = verifyCoreDelivery(neutralized.delivery, deactivationPlan.neutralize, afterPointer,
      "shared neutralization");
    const [keyboardAfter, pointerAfter, coreAfter] = await Promise.all([
      client.request("keyboard-state"), client.request("pointer-state"),
      client.request("input-state")]);
    if (keyboardAfter.status !== 0 || keyboardAfter.result?.heldCodes?.length !== 0 ||
        pointerAfter.status !== 0 || pointerAfter.result?.heldButtonNames?.length !== 0 ||
        coreAfter.status !== 0) {
      fail("shared deactivation left held worker/core input state");
    }
    const finalCore = parseInputState(coreAfter);
    for (const field of ["csr", "scancode", "mouseX", "mouseY", "inputSequence",
      "keyboardFifoCount", "ingressOrdinal", "generation", "lifecycle"]) {
      if (finalCore[field] !== afterNeutralize[field]) {
        fail(`shared deactivation final CDRIOB91 state differs after core delivery at ${field}`);
      }
    }
    const sharedDeactivation = Object.freeze({
      outcome: "held-key-and-pointer-cleared-after-core-delivery",
      keyboard_down: deliveryForJson(heldKey.delivery),
      pointer_down: deliveryForJson(heldPointer.delivery),
      neutralize: deliveryForJson(neutralized.delivery),
      deactivation: neutralized.deactivation,
      coreAfter: stateForJson(parseInputState(coreAfter)),
    });
    const ready4Evidence = Object.freeze({ ...ready4, post_208_summary: post208 });
    const sharedDeactivationFile = await writePrivateNew(
      resolve(portableDirectory, "shared-deactivation.json"), sharedDeactivation);
    termination = await client.close(); const workerLog = await writePrivateNew(
      resolve(portableDirectory, "worker.ndjson"), serializeProtocolV6Log(client.log));
    return Object.freeze({ campaign, boot, module: wasm.identity, wasm_execution: wasm.execution,
      worker: workerIdentity, worker_closure: workerExecution.receipt,
      runtime: Object.freeze({ node: process.versions.node, v8: process.versions.v8,
        executable: nodeIdentity,
        environment: Object.freeze({ LANG: process.env.LANG ?? null,
          LC_ALL: process.env.LC_ALL ?? null, TZ: process.env.TZ ?? null }) }),
      expectedCdrinp, observedCdrinp, expectedStateFile, observedStateFile,
      workerLog, termination, session_id: sessionId, sharedDeactivation,
      sharedDeactivationFile,
      consumptionBoundaries,
      browser_state: { generation: before.generation.toString(), first_ingress_ordinal: "1",
        last_ingress_ordinal: observed.ingressOrdinal.toString(),
        input_sequence_before: before.inputSequence, input_sequence_after: observed.inputSequence },
      ready4: ready4Evidence });
  } finally { if (termination === null) { try { await client.close(); } catch { /* retain original failure */ } } await artifacts.close(); }
}

/* A live confirmation must not quietly become the full 208-record paired
 * campaign.  This deliberately narrow path boots the selected O2 combined
 * profile to the same frozen READY4 boundary, sends exactly one KeyQ down,
 * one left-button 60,70 EDGE32 down, and the two producer-derived
 * neutralization records, then boundedly drains the keyboard IOB.  It shares
 * the production worker, CDRINP1/CDRIOB91 assertions, and M6 receipt code;
 * it has no X11/native half and makes no all-100 comparison claim. */
async function portableReady4InputCanary({ wasm, artifactRoot, pinned,
  portableDirectory, sessionId }) {
  const nodeIdentity = await toolIdentity(resolve(process.execPath), "Node executable");
  const artifacts = await openArtifacts(pinned.expected, artifactRoot);
  const workerExecution = await createDescriptorCapturedM8M9Worker();
  const workerIdentity = workerExecution.rootIdentity;
  const client = new ProtocolV6Client(workerExecution.worker, sessionId);
  let termination = null;
  try {
    const instantiated = await client.request("instantiate", { module: wasm.module,
      m6DiskEvidencePolicy: true });
    if (instantiated.status !== 0) {
      fail(`protocol-v6 M9-DEVID O2 canary instantiation failed with status ${instantiated.status}`);
    }
    const boot = await runM6Ready4Fast({ client, artifacts: artifacts.artifacts,
      profile: profileForM6(pinned.profile, pinned.expected), hashArtifact,
      maxBoundaries: readyLimit(pinned.release.value), maxHostTransactions: 1024,
      fastSlots: 1048576,
      ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT,
        releaseRecord: pinned.release.bytes.slice() }) });
    const ready4 = await exactReady4Receipt(boot, pinned.release.identity);
    const before = parseInputState(await client.request("input-state"));
    if ((before.csr & (1 << 2)) === 0 || (before.csr & (1 << 5)) !== 0 ||
        before.keyboardFifoCount !== 0) {
      fail("M9-DEVID O2 canary READY input baseline is not interrupt-enabled, ready-clear, FIFO-empty");
    }
    const pointer = await client.request("pointer-state");
    if (pointer.status !== 0 || !Number.isSafeInteger(pointer.result?.generation)) {
      fail("M9-DEVID O2 canary cannot identify the selected M9 controller generation");
    }
    const producer = deriveCadrM8M9DeactivationProducer({ coreState: before,
      pointerGeneration: pointer.result.generation });
    const key = await client.request("keyboard-down", producer.commands.keyboard_down);
    if (key.status !== 0) fail("M9-DEVID O2 canary KeyQ delivery failed");
    const afterKey = verifyCoreDelivery(key.delivery, producer.keyboard_down, before,
      "M9-DEVID O2 canary KeyQ");
    const pointerDown = await client.request("pointer-down", producer.commands.pointer_down);
    if (pointerDown.status !== 0) fail("M9-DEVID O2 canary pointer delivery failed");
    const afterPointer = verifyCoreDelivery(pointerDown.delivery, producer.pointer_down,
      afterKey, "M9-DEVID O2 canary 60,70 pointer");
    const neutralize = await client.request("pointer-neutralize", producer.commands.neutralize);
    if (neutralize.status !== 0 || neutralize.deactivation?.heldKeysCleared !== 1) {
      fail("M9-DEVID O2 canary producer neutralization failed");
    }
    const afterNeutralize = verifyCoreDelivery(neutralize.delivery, producer.neutralize,
      afterPointer, "M9-DEVID O2 canary neutralization");
    if (afterNeutralize.ingressOrdinal !== before.ingressOrdinal + 4n) {
      fail("M9-DEVID O2 canary did not deliver exactly four CDRINP1 records");
    }
    /* This summary is intentionally adjacent to the four delivery records.
     * The full campaign has its separate, ordinal-208-specific receipt. */
    const evidenceResponse = await client.request("m6-disk-evidence-summary");
    if (evidenceResponse.status !== 0) fail("M9-DEVID O2 canary CDRM6E1 is unavailable");
    const evidence = parseM6DevidSummary(evidenceResponse);
    const evidenceDigest = Buffer.from(evidence.digest).toString("hex");
    if (sha256(evidence.bytes) !== evidenceDigest ||
        evidence.selectedMaximum !== 0x7fffffffffffffffn ||
        evidence.totalAccepted > evidence.selectedMaximum ||
        evidence.tailEventCount !== evidence.totalAccepted - 512n ||
        evidence.totalAccepted < BigInt(ready4.cdrm6e1.total_accepted)) {
      fail("M9-DEVID O2 canary CDRM6E1 limit evidence changed after input");
    }
    const quiescent = await quiesceKeyboardInput(client, afterNeutralize,
      "M9-DEVID O2 canary neutralized keyboard", {
        allowedScancodes: [afterNeutralize.scancode, 0x10000 | 0x52, 0x18000],
      });
    const finalCore = parseInputState(await client.request("input-state"));
    for (const field of ["csr", "scancode", "mouseX", "mouseY", "inputSequence",
      "keyboardFifoCount", "ingressOrdinal", "generation", "lifecycle"]) {
      if (finalCore[field] !== quiescent.state[field]) {
        fail(`M9-DEVID O2 canary final CDRIOB91 differs after bounded cleanup at ${field}`);
      }
    }
    const [keyboard, finalPointer] = await Promise.all([
      client.request("keyboard-state"), client.request("pointer-state"),
    ]);
    if (keyboard.status !== 0 || keyboard.result?.heldCodes?.length !== 0 ||
        finalPointer.status !== 0 || finalPointer.result?.heldButtonNames?.length !== 0) {
      fail("M9-DEVID O2 canary left a held browser-controller input state");
    }
    const record = Object.freeze({ schema: "cadr-m8-m9-devid-ready4-o2-canary-v1",
      target: "CADR-WEB-303/ABI1.8/protocol-v6/M9-DEVID-READY4-O2-KEY-POINTER-CANARY",
      outcome: "ready4-keyq-pointer-verified", module: wasm.identity,
      wasm_execution: wasm.execution, worker: workerIdentity,
      worker_closure: workerExecution.receipt,
      ready4, actions: Object.freeze({
        keyboard_down: deliveryForJson(key.delivery),
        pointer_down: deliveryForJson(pointerDown.delivery),
        neutralize: deliveryForJson(neutralize.delivery),
      }),
      cdrm6e1_after_input: Object.freeze({ bytes: evidence.bytes.byteLength,
        sha256: evidenceDigest, hex: Buffer.from(evidence.bytes).toString("hex"),
        selected_maximum: evidence.selectedMaximum.toString(),
        total_accepted: evidence.totalAccepted.toString(),
        tail_event_count: evidence.tailEventCount.toString(),
        after_input_ordinal: afterNeutralize.ingressOrdinal.toString() }),
      keyboard_quiescence: quiescent.evidence,
      core_before: stateForJson(before), core_after: stateForJson(finalCore),
      controller_after: Object.freeze({ held_codes: keyboard.result.heldCodes,
        held_button_names: finalPointer.result.heldButtonNames }),
      runtime: Object.freeze({ node: process.versions.node, v8: process.versions.v8,
        executable: nodeIdentity }), });
    const receipt = await writePrivateNew(resolve(portableDirectory, "ready4-o2-canary.json"), record);
    termination = await client.close();
    const workerLog = await writePrivateNew(resolve(portableDirectory, "worker.ndjson"),
      serializeProtocolV6Log(client.log));
    return Object.freeze({ record, receipt, workerLog, termination });
  } finally {
    if (termination === null) { try { await client.close(); } catch { /* retain original failure */ } }
    await artifacts.close();
  }
}

async function runPortableCanary(options) {
  if (!options.execute) fail("refusing to start a private runtime without explicit --execute");
  if (!options.portableCanary || options.variant !== "O2") {
    fail("the narrow portable READY4 input canary requires --portable-canary --variant O2");
  }
  repositoryPath(options.wasm, "M9-DEVID O2 Wasm module");
  const wasmProduction = rebuildM9DevidWasmPair();
  const wasm = await compileBoundM9DevidWasm(options.wasm, "M9-DEVID O2 Wasm module");
  const joinStart = await collectCadrM8M9PortableCanaryProvenance();
  const selectedWasm = joinStart.m9_devid_wasm.O2;
  if (selectedWasm === undefined || canonicalJson(wasm.identity) !== canonicalJson(selectedWasm)) {
    fail("M9-DEVID O2 canary module differs from its captured provenance join");
  }
  const pinned = await loadPinnedInputs();
  const session = await makeFreshSession(options.sessionRoot);
  const portableDirectory = resolve(session.path, "portable");
  try {
    const resourceStart = process.resourceUsage();
    const startedAt = process.hrtime.bigint();
    const result = await portableReady4InputCanary({ wasm, artifactRoot: options.artifactRoot,
      pinned, portableDirectory, sessionId: `portable-canary-${randomUUID().replaceAll("-", "")}` });
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
    const resourceEnd = process.resourceUsage();
    const joinEnd = await collectCadrM8M9PortableCanaryProvenance();
    assertCadrM8M9PortableCanaryProvenance(joinEnd, joinStart,
      "M9-DEVID O2 canary end provenance binding");
    const summary = Object.freeze({ schema: "cadr-m8-m9-devid-ready4-o2-canary-summary-v1",
      outcome: result.record.outcome, runtime_execution_performed: true,
      selected_inputs: Object.freeze({ m9_devid_o2: wasm.identity,
        release_record: pinned.release.identity }),
      runtime_measurement: Object.freeze({ wall_nanoseconds: elapsedNanoseconds.toString(),
        resource_usage: Object.freeze({
          user_cpu_microseconds: resourceEnd.userCPUTime - resourceStart.userCPUTime,
          system_cpu_microseconds: resourceEnd.systemCPUTime - resourceStart.systemCPUTime,
          max_rss_kib_at_start: resourceStart.maxRSS,
          max_rss_kib_at_end: resourceEnd.maxRSS,
          voluntary_context_switches: resourceEnd.voluntaryContextSwitches - resourceStart.voluntaryContextSwitches,
          involuntary_context_switches: resourceEnd.involuntaryContextSwitches - resourceStart.involuntaryContextSwitches,
        }) }),
      session: relative(ROOT, session.path), receipt: Object.freeze({
        path: "portable/ready4-o2-canary.json", ...result.receipt }),
      worker_log: Object.freeze({ path: "portable/worker.ndjson", ...result.workerLog }),
      wasm_production: Object.freeze({ ...wasmProduction, outputs: joinStart.m9_devid_wasm }),
      provenance_join_start: joinStart, provenance_join_end: joinEnd });
    const summaryReceipt = await writePrivateNew(resolve(session.path, "canary-summary.json"), summary);
    return Object.freeze({ ...summary, summary: Object.freeze({ path: "canary-summary.json", ...summaryReceipt }) });
  } catch (error) {
    await writePrivateNew(resolve(session.path, "canary-failure.json"), {
      schema: "cadr-m8-m9-devid-ready4-o2-canary-failure-v1", outcome: "nonconforming",
      runtime_execution_performed: true,
      error: error instanceof Error ? error.message : String(error),
      ready4_boot_failure: error?.ready4Failure ?? null,
      provenance_join_start: joinStart,
      evidence_boundary: "bounded READY4 key/pointer canary only; no paired C-M8/X11 claim",
    }).catch(() => {});
    throw error;
  }
}

async function runCampaign(options) {
  if (!options.execute) fail("refusing to start a private runtime without explicit --execute"); if (options.nativeConfig === null) fail("--native-config is required with --execute");
  repositoryPath(options.wasm, "M9-DEVID Wasm module");
  const wasmProduction = rebuildM9DevidWasmPair();
  const boundWasm = await compileBoundM9DevidWasm(options.wasm);
  const nativePythonCapture = await captureCadrM8M9NativePythonClosure();
  /* Capture the common closure before either direct leg is launched.  The X11
   * campaign will refuse an otherwise self-consistent browser receipt unless
   * this full object, including both produced Wasm variants, matches again. */
  const joinStart = await collectCadrM8M9ProvenanceJoin({ prepared: options.prepared,
    nativePythonClosure: publicCadrM8M9NativePythonClosure(nativePythonCapture) });
  const directRunnerSource = await sourceProvenance(joinStart);
  /* A direct receipt repeats the whole staged source closure, not just a
   * convenient list of entry points.  `direct_runner` records the runner's
   * scoped working-tree status; the closure itself names every transitive
   * repository module on which the receipt relies. */
  const sourceBinding = Object.freeze({ schema: "cadr-m8-m9-direct-source-binding-v1",
    repository: joinStart.repository, source_closure: joinStart.source_closure,
    direct_runner: directRunnerSource });
  const pinned = await loadPinnedInputs(); const session = await makeFreshSession(options.sessionRoot); const nativeDirectory = resolve(session.path, "native"); const portableDirectory = resolve(session.path, "portable");
  try {
    const initialCampaign = buildCadrM8M9Campaign(); if (initialCampaign.schema !== CADR_M8_M9_CAMPAIGN_SCHEMA) fail("campaign materializer identity drifted"); const scriptBytes = new TextEncoder().encode(serializeCadrM8M9NativeScript(initialCampaign));
    const inputScriptPath = resolve(session.path, "input-script.txt"); const campaignPath = resolve(session.path, "campaign.json"); const inputScript = await writePrivateNew(inputScriptPath, scriptBytes); const campaignManifest = { schema: "cadr-m8-m9-input-campaign-v1", key_count: initialCampaign.keyCount, native_row_count: initialCampaign.nativeRows.length, browser_record_count: initialCampaign.records.length, input_script_sha256: inputScript.sha256 }; const campaignReceipt = await writePrivateNew(campaignPath, campaignManifest);
    const nativeSessionId = `native-${randomUUID().replaceAll("-", "")}`; const diskId = `disk-${randomUUID().replaceAll("-", "")}`; const portableSessionId = `portable-${randomUUID().replaceAll("-", "")}`;
    const nativeChild = await runNativeCapture({ prepared: options.prepared,
      nativeConfig: options.nativeConfig, output: nativeDirectory,
      sessionId: nativeSessionId, diskId, inputScript: inputScriptPath,
      campaign: campaignPath }, { nativePythonClosure: nativePythonCapture });
    if (JSON.stringify(nativeChild.native_python_closure) !==
        JSON.stringify(joinStart.native_python_closure)) {
      fail("native execution Python closure differs from start provenance");
    }
    for (const name of ["campaign.json", "capture.ndjson", "idle.bin", "input-script.txt", "input.cdrm8n1", "metadata.json"]) await assertPrivateFile(resolve(nativeDirectory, name), `native ${name}`);
    const scriptRows = parseNativeScript(new Uint8Array(await readFile(inputScriptPath))); const witness = parseNativeWitness(new Uint8Array(await readFile(resolve(nativeDirectory, "input.cdrm8n1"))), scriptRows); const nativeMetadata = await captureNativeMetadata(resolve(nativeDirectory, "metadata.json"), nativeChild.response.metadata);
    if (nativeMetadata.value?.schema !== "cadr-m8-m9-native-input-capture-v1" || nativeMetadata.value?.session_id !== nativeSessionId || nativeMetadata.value?.private_disk_instance_id !== diskId || nativeMetadata.value?.campaign?.native_witness?.sha256 !== witness.sha256 || nativeMetadata.value?.campaign?.input_script_sha256 !== inputScript.sha256) fail("native capture metadata is not bound to this fresh script/witness/session");
    const portable = await portableReplay({ wasm: boundWasm, artifactRoot: options.artifactRoot, pinned, portableDirectory, sessionId: portableSessionId, initialCampaign });
    const selectedWasm = joinStart.m9_devid_wasm[options.variant];
    const selectedWorker = joinStart.source_closure.files.find(file =>
      file.path === "cadr-web/wasm/cadr-worker.js");
    if (selectedWasm === undefined || selectedWorker === undefined ||
        portable.module.path !== selectedWasm.path ||
        portable.module.bytes !== selectedWasm.bytes ||
        portable.module.sha256 !== selectedWasm.sha256 ||
        portable.worker.path !== selectedWorker.path ||
        portable.worker.bytes !== selectedWorker.bytes ||
        portable.worker.sha256 !== selectedWorker.sha256) {
      fail("direct M8/M9 browser leg drifted from its captured provenance join");
    }
    const completeWasmProduction = Object.freeze({ ...wasmProduction,
      outputs: joinStart.m9_devid_wasm });
    const comparison = { schema: "cadr-m8-m9-input-comparison-v1", outcome: "worker-core-payloads-identical-to-expected", native: { record_schema: witness.schema, record_bytes: witness.record_bytes, record_count: witness.record_count, sha256: witness.sha256 }, browser: { record_schema: "CDRINP1", record_bytes: 40, record_count: portable.campaign.records.length, expected_sha256: portable.expectedCdrinp.sha256, observed_sha256: portable.observedCdrinp.sha256, exact_worker_boundary_match: portable.expectedCdrinp.sha256 === portable.observedCdrinp.sha256, generation: portable.browser_state.generation, first_ingress_ordinal: portable.browser_state.first_ingress_ordinal, last_ingress_ordinal: portable.browser_state.last_ingress_ordinal }, common_campaign: { input_script_sha256: inputScript.sha256, key_count: initialCampaign.keyCount, native_row_count: initialCampaign.nativeRows.length, browser_record_count: portable.campaign.records.length }, representation_adapter: { native: "keyboard code/keydown and mouse_event changed-button selector", browser: "CDRINP1 keyboard word and EDGE32 post-state/changed-mask", equality_claim: "native and browser encodings intentionally differ; only browser expected versus observed worker/core payloads are byte-equal" } };
    const comparisonReceipt = await writePrivateNew(resolve(session.path, "comparison.json"), comparison);
    const nativeFiles = await Promise.all(["campaign.json", "capture.ndjson",
      "idle.bin", "input-script.txt", "input.cdrm8n1"].map(name =>
      fileIdentity(resolve(nativeDirectory, name), `native ${name}`)));
    nativeFiles.push(nativeMetadata.identity);
    /* Do not rebuild here.  A second collection after all native and worker
     * activity makes source, prepared closure, and either Wasm output drift a
     * hard failure instead of silently attaching the start identity to an end
     * result. */
    const joinEnd = await collectCadrM8M9ProvenanceJoin({ prepared: options.prepared });
    assertCadrM8M9ProvenanceJoin(joinEnd, joinStart,
      "direct M8/M9 campaign end provenance binding");
    const manifest = { schema: CAMPAIGN_SCHEMA, target: TARGET, outcome: comparison.outcome, runtime_execution_performed: true, source_binding: sourceBinding, provenance_join_start: joinStart, provenance_join_end: joinEnd, wasm_production: completeWasmProduction, session: { id: session.id, mode: "0700" }, campaign: { script: { path: "input-script.txt", ...inputScript }, manifest: { path: "campaign.json", ...campaignReceipt } }, native: { session_id: nativeSessionId, private_disk_instance_id: diskId, python_closure: nativeChild.native_python_closure, oracle_process: nativeChild.oracle_process, witness, files: nativeFiles, metadata: nativeMetadata.value }, portable: { session_id: portable.session_id, runtime: portable.runtime, module: portable.module, wasm_execution: portable.wasm_execution, worker: portable.worker, worker_closure: portable.worker_closure, expected_cdrinp_file: { path: "portable/expected-input.cdrinp1", ...portable.expectedCdrinp }, observed_cdrinp_file: { path: "portable/observed-input.cdrinp1", ...portable.observedCdrinp }, expected_state_file: { path: "portable/expected-input-states.json", ...portable.expectedStateFile }, observed_state_file: { path: "portable/observed-input-states.json", ...portable.observedStateFile }, worker_log_file: { path: "portable/worker.ndjson", ...portable.workerLog }, consumption_boundaries: portable.consumptionBoundaries, shared_deactivation_file: { path: "portable/shared-deactivation.json", ...portable.sharedDeactivationFile }, shared_deactivation: portable.sharedDeactivation, termination: portable.termination, browser_state: portable.browser_state, ready4: portable.ready4 }, comparison: { path: "comparison.json", ...comparisonReceipt } };
    const manifestReceipt = await writePrivateNew(resolve(session.path, "manifest.json"), manifest); const names = (await readdir(session.path)).sort(); if (canonicalJson(names) !== canonicalJson(["campaign.json", "comparison.json", "input-script.txt", "manifest.json", "native", "portable"])) fail("paired session has an unexpected top-level sidecar");
    return Object.freeze({ session: relative(ROOT, session.path), manifest: { path: "manifest.json", ...manifestReceipt }, comparison: { path: "comparison.json", ...comparisonReceipt } });
  } catch (error) {
    await unlink(resolve(session.path, "manifest.json")).catch(() => {});
    await writePrivateNew(resolve(session.path, "failure.json"), {
      schema: "cadr-m8-m9-input-conformance-failure-v1",
      outcome: "nonconforming", runtime_execution_performed: true,
      error: error instanceof Error ? error.message : String(error),
      source_binding: sourceBinding, provenance_join_start: joinStart,
      evidence_boundary: "failure record only; no C-M8, native-X11, or CW2 closure claim",
    }).catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.execute) { process.stdout.write(`${canonicalJson({ schema: "cadr-m8-m9-input-conformance-plan-v1", outcome: "blocked", runtime_execution_performed: false, reason: "explicit---execute-required" })}\n`); process.exitCode = 2; return; }
  if (options.portableCanary) {
    const result = await runPortableCanary(options);
    process.stdout.write(`${canonicalJson(result)}\n`);
    return;
  }
  const result = await runCampaign(options); process.stdout.write(`${canonicalJson({
    schema: "cadr-m8-m9-input-conformance-summary-v1",
    outcome: "worker-core-payloads-identical-to-expected", ...result })}\n`);
}
const invokedAsMain = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsMain) main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
