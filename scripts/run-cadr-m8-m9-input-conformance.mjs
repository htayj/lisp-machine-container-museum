#!/usr/bin/env node
/*
 * C-M8/CW2 paired input campaign.
 *
 * This command is deliberately inert without --execute.  With explicit
 * consent it makes one fresh private ignored 0700 session, materializes the complete
 * 100-key/pointer native schedule, captures that schedule before native IOB
 * mutation, boots a separate protocol-v6 M9 Wasm machine to frozen M6 READY,
 * and replays the same controller-derived action list there.  It records the
 * distinct native CDRM8N1 and browser CDRINP1 representations; it never
 * calls either half's synthetic fallback or unit-test substitute.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants as FS_SYNC, fstatSync, openSync, readFileSync } from "node:fs";
import { constants as FS, chmod, lstat, mkdir, open, readFile, readdir, unlink } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_READY_CONTRACT,
  preflightM6Artifacts,
  runM6HeadlessBoot,
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
  assertCadrM8M9ProvenanceJoin,
  collectCadrM8M9ProvenanceJoin,
} from "./cadr-m8-m9-provenance-join.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-oracle");
const WORKER_URL = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const WORKER_PATH = resolve(ROOT, "cadr-web/wasm/cadr-worker.js");
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const NATIVE_ORACLE = resolve(ROOT, "scripts/cadr-m8-m9-native-input-oracle.py");
const RUNNER_PATH = fileURLToPath(import.meta.url);
const CAMPAIGN_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-campaign.mjs");
const DEACTIVATION_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-deactivation.mjs");
const TRANSACTION_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m8-m9-transaction.mjs");
const M6_MODULE_PATH = resolve(ROOT, "cadr-web/wasm/cadr-m6-headless-boot.mjs");
const PROTOCOL_VERSION = 6;
const REQUEST_TIMEOUT_MS = 120_000;
const CAMPAIGN_SCHEMA = "cadr-m8-m9-input-conformance-result-v2";
const TARGET = "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9-DIRECT-BOUNDARY-NON-CW2";
const ARTIFACT_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, local_path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, local_path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, local_path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, local_path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, local_path: "l/usim/disk-sys-303-0.img" }),
]);

function fail(message) { throw new TypeError(`C-M8/CW2: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
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
function rebuildM9WasmPair() {
  const argv = ["-B", "-C", "cadr-web", "build/cadr-web-m9-O0.wasm",
    "build/cadr-web-m9-O2.wasm"];
  const result = spawnSync("make", argv, { cwd: ROOT, encoding: "utf8",
    timeout: 300_000, killSignal: "SIGKILL" });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    fail(`forced M9 O0/O2 Wasm build failed: ${(result.stderr ?? "").slice(-2000)}`);
  }
  return Object.freeze({ schema: "cadr-m8-m9-wasm-production-v1", profile: "m9",
    forced: true, argv: ["make", ...argv], stdout_sha256: sha256(result.stdout),
    stderr_sha256: sha256(result.stderr) });
}

export function resolveNativePythonExecutable({ spawnSyncImpl = spawnSync, path = process.env.PATH ?? "" } = {}) {
  /* Node locates a command before applying `options.env`, while CPython derives
   * sys.executable after startup.  Launching the bare `python3` command with
   * the scrubbed native-runtime environment therefore gives CPython an empty
   * executable name on this host.  Resolve once under the caller's controlled
   * PATH, then execute that exact absolute interpreter under the scrubbed
   * environment.  The launch below binds the opened interpreter descriptor,
   * rather than claiming that a pathname is immutable after this resolution. */
  const result = spawnSyncImpl("python3", ["-c", "import os, sys; print(os.path.realpath(sys.executable))"], {
    cwd: ROOT, encoding: "utf8", env: { LANG: "C", LC_ALL: "C", TZ: "UTC", PATH: path },
  });
  const output = typeof result.stdout === "string" && result.stdout.endsWith("\n")
    ? result.stdout.slice(0, -1) : null;
  const executable = output ?? "";
  if (result.error !== undefined || result.signal !== null || result.status !== 0 ||
      output === null || executable.length === 0 || /[\r\n\0]/.test(executable) ||
      !executable.startsWith("/") || resolve(executable) !== executable) {
    const detail = result.error?.message ?? (typeof result.stderr === "string" ? result.stderr.slice(-1000) : "");
    fail(`cannot resolve an exact Python interpreter for native capture: ${detail || "resolver output is not one canonical absolute line"}`);
  }
  return executable;
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

export function openNativePythonExecutable({ resolvePythonExecutable = resolveNativePythonExecutable,
  openSyncImpl = openSync, closeSyncImpl = closeSync, identityForFd = nativePythonFdIdentity } = {}) {
  const executable = resolvePythonExecutable();
  let fd;
  try { fd = openSyncImpl(executable, FS_SYNC.O_RDONLY | FS_SYNC.O_NOFOLLOW); }
  catch (error) { fail(`cannot open resolved Python interpreter for native capture: ${error?.message ?? String(error)}`); }
  try { return Object.freeze({ fd, identity: identityForFd(fd) }); }
  catch (error) { closeSyncImpl(fd); throw error; }
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
export function assertFdBoundPythonIdentity(value, expected, label = "native M8/M9 Python identity") {
  exactObject(value, ["schema", "inherited_fd", "bytes", "sha256", "device", "inode",
    "sys_executable", "proc_self_exe", "version", "implementation"], label);
  if (value.schema !== "cadr-m8-m9-python-identity-v1" || value.inherited_fd !== 3 ||
      !Number.isSafeInteger(value.bytes) || value.bytes <= 0 || typeof value.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(value.sha256) || typeof value.version !== "string" ||
      typeof value.implementation !== "string") {
    fail(`${label} is incomplete`);
  }
  decimalString(value.device, `${label} device`); decimalString(value.inode, `${label} inode`, { zero: false });
  for (const [field, reference] of [["sys_executable", "sys-executable"], ["proc_self_exe", "proc-self-exe"]]) {
    exactObject(value[field], ["reference", "bytes", "sha256", "device", "inode"], `${label} ${field}`);
    if (value[field].reference !== reference || value[field].bytes !== value.bytes ||
        value[field].sha256 !== value.sha256 || value[field].device !== value.device ||
        value[field].inode !== value.inode) {
      fail(`${label} ${field} differs from inherited descriptor 3`);
    }
  }
  for (const field of ["bytes", "sha256", "device", "inode"]) {
    if (value[field] !== expected[field]) fail(`${label} differs from the inherited descriptor`);
  }
  return value;
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
  try { return Object.freeze({ bytes: new Uint8Array(bytes), value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) }); }
  catch (error) { fail(`${label} is not UTF-8 JSON: ${error.message}`); }
}

function parseArgs(argv) {
  const options = { artifactRoot: ROOT, execute: false, nativeConfig: null,
    prepared: "build/cadr-oracle/m8-m9-x11-prepared-v4", sessionRoot: "build/cadr-oracle",
    variant: "O0", wasm: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs --execute --native-config PATH [--prepared REPO_REL] [--artifact-root ROOT] [--session-root build/cadr-oracle] [--variant O0|O2] [--wasm PATH]\\n");
      process.stdout.write("Without --execute this command refuses to create or launch a private CADR runtime.\\n");
      process.exit(0);
    }
    if (argument === "--execute") { if (seen.has(argument)) fail("--execute was supplied twice"); seen.add(argument); options.execute = true; continue; }
    if (!["--native-config", "--prepared", "--artifact-root", "--session-root", "--variant", "--wasm"].includes(argument) || seen.has(argument)) fail(`unknown or repeated argument ${JSON.stringify(argument)}`);
    seen.add(argument); const value = argv[++index]; if (typeof value !== "string" || value.length === 0) fail(`${argument} requires a value`);
    if (argument === "--artifact-root") options.artifactRoot = resolve(value);
    else if (argument === "--wasm") options.wasm = resolve(value);
    else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!["O0", "O2"].includes(options.variant)) fail("--variant must be O0 or O2");
  if (options.wasm === null) options.wasm = resolve(ROOT, `cadr-web/build/cadr-web-m9-${options.variant}.wasm`);
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
  closeSyncImpl = closeSync, spawnImpl = spawn,
} = {}) {
  const args = [NATIVE_ORACLE, "native-capture", "--prepared", prepared, "--config", nativeConfig, "--output", output, "--session-id", sessionId, "--private-disk-instance-id", diskId, "--input-script", inputScript, "--campaign", campaign, "--execute"];
  const nativePython = openPythonExecutable();
  try { return await new Promise((resolveRun, rejectRun) => {
    const child = spawnImpl("/proc/self/fd/3", args, { cwd: ROOT,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdio: ["ignore", "pipe", "pipe", nativePython.fd] }); const stdout = []; const stderr = [];
    child.stdout.on("data", chunk => stdout.push(chunk)); child.stderr.on("data", chunk => stderr.push(chunk)); child.once("error", rejectRun);
    child.once("close", async (code, signal) => { try {
      const text = Buffer.concat(stdout).toString("utf8").trim(); let response = null; try { response = JSON.parse(text); } catch { /* reported below */ }
      const nativePythonAfter = identityForFd(nativePython.fd);
      for (const field of ["bytes", "sha256", "device", "inode"]) {
        if (nativePythonAfter[field] !== nativePython.identity[field]) {
          throw new Error("native M8/M9 capture Python descriptor changed during child execution");
        }
      }
      if (code !== 0 || response?.status !== "captured") {
        rejectRun(new Error(`native M8/M9 capture failed (code=${code}, signal=${signal ?? "none"}): ${response?.error ?? Buffer.concat(stderr).toString("utf8").slice(-2000)}`));
        return;
      }
      const reportedPython = response?.metadata?.runtime_provenance?.python;
      assertFdBoundPythonIdentity(reportedPython, nativePython.identity,
        "native M8/M9 capture Python provenance");
      resolveRun(Object.freeze({ response, oracle_process: Object.freeze({ returncode: code, signal: signal ?? null }) }));
    } catch (error) { rejectRun(error); }
    });
  }); } finally { closeSyncImpl(nativePython.fd); }
}

async function portableReplay({ wasmPath, artifactRoot, pinned, portableDirectory, sessionId, initialCampaign }) {
  const [wasmIdentity, workerIdentity, nodeIdentity, wasmBytes] = await Promise.all([
    fileIdentity(wasmPath, "M9 Wasm module"),
    fileIdentity(WORKER_PATH, "M9 worker"),
    toolIdentity(resolve(process.execPath), "Node executable"),
    readFile(wasmPath),
  ]);
  const module = await WebAssembly.compile(wasmBytes); const artifacts = await openArtifacts(pinned.expected, artifactRoot); const client = new ProtocolV6Client(new Worker(WORKER_URL, { type: "module" }), sessionId); let termination = null;
  try {
    const instantiated = await client.request("instantiate", { module }); if (instantiated.status !== 0) fail(`protocol-v6 Wasm instantiation failed with status ${instantiated.status}`);
    const profile = profileForM6(pinned.profile, pinned.expected); const checked = await preflightM6Artifacts({ artifacts: artifacts.artifacts, profile, hashArtifact });
    const boot = await runM6HeadlessBoot({ client, artifacts: checked.sources, profile, hashArtifact, maxBoundaries: readyLimit(pinned.release.value), maxHostTransactions: 1024, ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT, releaseRecord: pinned.release.bytes.slice() }) });
    if (boot.outcome !== "ready") fail(`protocol-v6 M6 boot did not reach frozen READY: ${boot.outcome}`);
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
    const sharedDeactivationFile = await writePrivateNew(
      resolve(portableDirectory, "shared-deactivation.json"), sharedDeactivation);
    termination = await client.close(); const workerLog = await writePrivateNew(resolve(portableDirectory, "worker.ndjson"), new TextEncoder().encode(`${client.log.map(entry => canonicalJson(entry)).join("\n")}\n`));
    return Object.freeze({ campaign, boot, module: wasmIdentity, worker: workerIdentity,
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
        input_sequence_before: before.inputSequence, input_sequence_after: observed.inputSequence } });
  } finally { if (termination === null) { try { await client.close(); } catch { /* retain original failure */ } } await artifacts.close(); }
}

async function runCampaign(options) {
  if (!options.execute) fail("refusing to start a private runtime without explicit --execute"); if (options.nativeConfig === null) fail("--native-config is required with --execute");
  repositoryPath(options.wasm, "M9 Wasm module");
  const wasmProduction = rebuildM9WasmPair();
  await Promise.all([fileIdentity(options.wasm, "M9 Wasm module"), fileIdentity(NATIVE_ORACLE, "M8/M9 native oracle")]);
  /* Capture the common closure before either direct leg is launched.  The X11
   * campaign will refuse an otherwise self-consistent browser receipt unless
   * this full object, including both produced Wasm variants, matches again. */
  const joinStart = await collectCadrM8M9ProvenanceJoin({ prepared: options.prepared });
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
    const nativeChild = await runNativeCapture({ prepared: options.prepared, nativeConfig: options.nativeConfig, output: nativeDirectory, sessionId: nativeSessionId, diskId, inputScript: inputScriptPath, campaign: campaignPath });
    for (const name of ["campaign.json", "capture.ndjson", "idle.bin", "input-script.txt", "input.cdrm8n1", "metadata.json"]) await assertPrivateFile(resolve(nativeDirectory, name), `native ${name}`);
    const scriptRows = parseNativeScript(new Uint8Array(await readFile(inputScriptPath))); const witness = parseNativeWitness(new Uint8Array(await readFile(resolve(nativeDirectory, "input.cdrm8n1"))), scriptRows); const nativeMetadata = await readJson(resolve(nativeDirectory, "metadata.json"), "native M8/M9 metadata");
    if (nativeMetadata.value?.schema !== "cadr-m8-m9-native-input-capture-v1" || nativeMetadata.value?.session_id !== nativeSessionId || nativeMetadata.value?.private_disk_instance_id !== diskId || nativeMetadata.value?.campaign?.native_witness?.sha256 !== witness.sha256 || nativeMetadata.value?.campaign?.input_script_sha256 !== inputScript.sha256) fail("native capture metadata is not bound to this fresh script/witness/session");
    const portable = await portableReplay({ wasmPath: options.wasm, artifactRoot: options.artifactRoot, pinned, portableDirectory, sessionId: portableSessionId, initialCampaign });
    const selectedWasm = joinStart.m9_wasm[options.variant];
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
      outputs: joinStart.m9_wasm });
    const comparison = { schema: "cadr-m8-m9-input-comparison-v1", outcome: "worker-core-payloads-identical-to-expected", native: { record_schema: witness.schema, record_bytes: witness.record_bytes, record_count: witness.record_count, sha256: witness.sha256 }, browser: { record_schema: "CDRINP1", record_bytes: 40, record_count: portable.campaign.records.length, expected_sha256: portable.expectedCdrinp.sha256, observed_sha256: portable.observedCdrinp.sha256, exact_worker_boundary_match: portable.expectedCdrinp.sha256 === portable.observedCdrinp.sha256, generation: portable.browser_state.generation, first_ingress_ordinal: portable.browser_state.first_ingress_ordinal, last_ingress_ordinal: portable.browser_state.last_ingress_ordinal }, common_campaign: { input_script_sha256: inputScript.sha256, key_count: initialCampaign.keyCount, native_row_count: initialCampaign.nativeRows.length, browser_record_count: portable.campaign.records.length }, representation_adapter: { native: "keyboard code/keydown and mouse_event changed-button selector", browser: "CDRINP1 keyboard word and EDGE32 post-state/changed-mask", equality_claim: "native and browser encodings intentionally differ; only browser expected versus observed worker/core payloads are byte-equal" } };
    const comparisonReceipt = await writePrivateNew(resolve(session.path, "comparison.json"), comparison);
    const nativeFiles = await Promise.all(["campaign.json", "capture.ndjson", "idle.bin", "input-script.txt", "input.cdrm8n1", "metadata.json"].map(name => fileIdentity(resolve(nativeDirectory, name), `native ${name}`)));
    /* Do not rebuild here.  A second collection after all native and worker
     * activity makes source, prepared closure, and either Wasm output drift a
     * hard failure instead of silently attaching the start identity to an end
     * result. */
    const joinEnd = await collectCadrM8M9ProvenanceJoin({ prepared: options.prepared });
    assertCadrM8M9ProvenanceJoin(joinEnd, joinStart,
      "direct M8/M9 campaign end provenance binding");
    const manifest = { schema: CAMPAIGN_SCHEMA, target: TARGET, outcome: comparison.outcome, runtime_execution_performed: true, source_binding: sourceBinding, provenance_join_start: joinStart, provenance_join_end: joinEnd, wasm_production: completeWasmProduction, session: { id: session.id, mode: "0700" }, campaign: { script: { path: "input-script.txt", ...inputScript }, manifest: { path: "campaign.json", ...campaignReceipt } }, native: { session_id: nativeSessionId, private_disk_instance_id: diskId, oracle_process: nativeChild.oracle_process, witness, files: nativeFiles, metadata: nativeMetadata.value }, portable: { session_id: portable.session_id, runtime: portable.runtime, module: portable.module, worker: portable.worker, expected_cdrinp_file: { path: "portable/expected-input.cdrinp1", ...portable.expectedCdrinp }, observed_cdrinp_file: { path: "portable/observed-input.cdrinp1", ...portable.observedCdrinp }, expected_state_file: { path: "portable/expected-input-states.json", ...portable.expectedStateFile }, observed_state_file: { path: "portable/observed-input-states.json", ...portable.observedStateFile }, worker_log_file: { path: "portable/worker.ndjson", ...portable.workerLog }, consumption_boundaries: portable.consumptionBoundaries, shared_deactivation_file: { path: "portable/shared-deactivation.json", ...portable.sharedDeactivationFile }, shared_deactivation: portable.sharedDeactivation, termination: portable.termination, browser_state: portable.browser_state, m6_ready_boundary: portable.boot.boundary.toString() }, comparison: { path: "comparison.json", ...comparisonReceipt } };
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
  const result = await runCampaign(options); process.stdout.write(`${canonicalJson({
    schema: "cadr-m8-m9-input-conformance-summary-v1",
    outcome: "worker-core-payloads-identical-to-expected", ...result })}\n`);
}
const invokedAsMain = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsMain) main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
