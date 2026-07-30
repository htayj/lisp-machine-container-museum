#!/usr/bin/env node
/*
 * Execute the two M7-P4 halves only after an operator explicitly opts into a
 * private campaign.  This program never has a synthetic fallback: it binds a
 * fresh native CDRM7N1 capture and a fresh protocol-v5 CDRDISP1 checkpoint to
 * the same pinned System 303 inputs, then retains raw bytes only below the
 * ignored 0700 session directory.
 */
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  constants as FS,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  unlink,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_PROTOCOL_VERSION,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  preflightM6Artifacts,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_FORM_C_BOUNDARY,
  runM7CheckpointedM6Boot,
} from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-oracle");
const WORKER_URL = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const NATIVE_ORACLE = resolve(ROOT, "scripts/cadr-m7-native-frame-oracle.py");
const WORKER_PATH = resolve(ROOT, "cadr-web/wasm/cadr-worker.js");
const ADAPTER_PATHS = Object.freeze([
  resolve(ROOT, "cadr-web/wasm/cadr_wasm_adapter.c"),
  resolve(ROOT, "cadr-web/wasm/cadr_wasm_adapter.h"),
]);
const M6_PATCH_PATH = resolve(ROOT, "cadr-web/oracle/patches/0002-m6-debug-ir-witness.patch");
const M7_PATCH_PATH = resolve(ROOT, "cadr-web/oracle/patches/0003-m7-frame-witness.patch");
const M7_SUPPORT_PATHS = Object.freeze([
  resolve(ROOT, "cadr-web/oracle/native/cadr_m7_frame_witness.c"),
  resolve(ROOT, "cadr-web/oracle/native/cadr_m7_frame_witness.h"),
]);
const M7_PROTOCOL_VERSION = 5;
const REQUEST_TIMEOUT_MS = 120_000;
const P4_SCHEMA = "cadr-m7-frame-conformance-result-v1";
const P4_TARGET = "CADR-WEB-303/ABI1.5/protocol-v5/M7";
export const P4_EXPECTED_CLOSURE_SCHEMA = "cadr-m7-frame-expected-closure-v1";
const ARTIFACT_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, id: "cadr-web-303-runnable-template", local_path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, id: "prom-control-store", local_path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, id: "prom-symbols", local_path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, id: "microcode-symbols", local_path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, id: "system-303-0-base-disk", local_path: "l/usim/disk-sys-303-0.img" }),
]);

function fail(message) {
  throw new TypeError(`C-M7 P4: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} is not an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has missing or unknown fields`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(`${label} is not a lowercase SHA-256`);
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${label} is not a positive safe integer`);
  return value;
}

function byteIdentity(value, label) {
  exactKeys(value, ["bytes", "path", "sha256"], label);
  if (typeof value.path !== "string" || value.path.length === 0 || value.path.startsWith("/") || value.path.includes("..")) {
    fail(`${label}.path is not repository-relative`);
  }
  positiveInteger(value.bytes, `${label}.bytes`);
  digest(value.sha256, `${label}.sha256`);
  return value;
}

function privateFileIdentity(value, label, expectedPath = null) {
  exactKeys(value, ["bytes", "path", "sha256"], label);
  if (typeof value.path !== "string" || value.path.length === 0 || value.path.startsWith("/") || value.path.includes("..")) {
    fail(`${label}.path is not a private relative path`);
  }
  if (expectedPath !== null && value.path !== expectedPath) fail(`${label}.path differs from the required session layout`);
  positiveInteger(value.bytes, `${label}.bytes`); digest(value.sha256, `${label}.sha256`);
  return value;
}

function canonicalU64(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail(`${label} is not a canonical decimal u64`);
  if (BigInt(value) > 0xffffffffffffffffn) fail(`${label} exceeds u64`);
  return value;
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function matchesCanonicalJsonBytes(bytes, value, terminalLf = false) {
  if (!(bytes instanceof Uint8Array) || typeof terminalLf !== "boolean") {
    throw new TypeError("canonical JSON byte matcher received invalid input");
  }
  const suffix = terminalLf ? "\n" : "";
  return Buffer.from(bytes).equals(
    Buffer.from(`${canonicalJson(value)}${suffix}`));
}

async function readCanonicalJson(path, label, canonicalRequired = true,
  terminalLf = false) {
  const bytes = await readFile(path);
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    fail(`${label} is not UTF-8 JSON: ${error.message}`);
  }
  if (canonicalRequired && !matchesCanonicalJsonBytes(
    new Uint8Array(bytes), value, terminalLf)) {
    fail(`${label} is not canonical JSON bytes`);
  }
  return Object.freeze({ bytes: new Uint8Array(bytes), value });
}

async function fileIdentity(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} is not a regular non-symlink file`);
  const bytes = await readFile(path);
  return Object.freeze({ path: relative(ROOT, path), bytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function assertPrivateDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
      (info.mode & 0o7777) !== 0o700) {
    fail(`${label} must be a current-owner non-symlink directory with exact mode 0700`);
  }
}

async function assertPrivateFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() ||
      info.nlink !== 1 || (info.mode & 0o7777) !== 0o600) {
    fail(`${label} must be a current-owner singly linked regular file with exact mode 0600`);
  }
}

async function writePrivateNew(path, value) {
  const parent = dirname(path);
  await assertPrivateDirectory(parent, "private result parent");
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(canonicalJson(value));
  const handle = await open(path, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL | FS.O_NOFOLLOW, 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600);
  await assertPrivateFile(path, "private result");
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function makeFreshSession(sessionRoot) {
  const root = resolve(ROOT, sessionRoot);
  if (root !== PRIVATE_ROOT && !root.startsWith(`${PRIVATE_ROOT}/`)) {
    fail("session root must stay below ignored build/cadr-oracle");
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  await assertPrivateDirectory(root, "M7 session root");
  const id = `m7-p4-${randomUUID().replaceAll("-", "")}`;
  const path = resolve(root, id);
  await mkdir(path, { mode: 0o700 });
  await chmod(path, 0o700);
  await Promise.all(["native", "portable"].map(async child => {
    const directory = resolve(path, child);
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
    await assertPrivateDirectory(directory, `M7 ${child} directory`);
  }));
  return Object.freeze({ id, path });
}

function parseArgs(argv) {
  const options = {
    artifactRoot: ROOT,
    execute: false,
    nativeConfig: null,
    prepared: "build/cadr-oracle/m7-frame-prepared",
    sessionRoot: "build/cadr-oracle",
    variant: "O0",
    wasm: null,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: node scripts/run-cadr-m7-frame-conformance.mjs --execute --native-config PATH [--prepared REPO_REL] [--artifact-root ROOT] [--session-root build/cadr-oracle] [--variant O0|O2] [--wasm PATH]\n");
      process.stdout.write("Without --execute this tool refuses to start a private CADR runtime.\n");
      process.exit(0);
    }
    if (argument === "--execute") {
      if (seen.has(argument)) fail("--execute was supplied twice");
      seen.add(argument); options.execute = true; continue;
    }
    if (!["--native-config", "--prepared", "--artifact-root", "--session-root", "--variant", "--wasm"].includes(argument)) {
      fail(`unknown argument ${JSON.stringify(argument)}`);
    }
    if (seen.has(argument)) fail(`${argument} was supplied twice`);
    seen.add(argument);
    const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) fail(`${argument} requires a value`);
    if (argument === "--artifact-root") options.artifactRoot = resolve(value);
    else if (argument === "--wasm") options.wasm = resolve(value);
    else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  if (!["O0", "O2"].includes(options.variant)) fail("--variant must be O0 or O2");
  if (options.wasm === null) options.wasm = resolve(ROOT, `cadr-web/build/cadr-web-m7-${options.variant}.wasm`);
  return Object.freeze(options);
}

export async function runNativeCapture({ prepared, nativeConfig, output, sessionId, diskId },
                                       spawnImpl = spawn) {
  const args = [NATIVE_ORACLE, "native-capture", "--prepared", prepared, "--config", nativeConfig,
    "--output", output, "--session-id", sessionId, "--private-disk-instance-id", diskId, "--execute"];
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnImpl("python3", args, { cwd: ROOT, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      stdio: ["ignore", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    child.stdout.on("data", chunk => stdout.push(chunk));
    child.stderr.on("data", chunk => stderr.push(chunk));
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      const outputText = Buffer.concat(stdout).toString("utf8").trim();
      let response;
      try { response = JSON.parse(outputText); } catch { response = null; }
      if (code !== 0 || response?.status !== "captured") {
        rejectRun(new Error(`native M7 capture failed (code=${code}, signal=${signal ?? "none"}): ${response?.error ?? Buffer.concat(stderr).toString("utf8").slice(-2000)}`));
      } else resolveRun(Object.freeze({ response,
        oracle_process: Object.freeze({ returncode: code, signal: signal ?? null }) }));
    });
  });
}

class ProtocolV5Client {
  constructor(worker, sessionId) {
    if (typeof sessionId !== "string" || sessionId.length === 0) fail("portable session ID is absent");
    this.worker = worker;
    this.sessionId = sessionId;
    this.nextId = 1;
    this.pending = new Map();
    this.log = [Object.freeze({ schema: "cadr-m7-portable-session-v1", session_id: sessionId })];
    this.closed = false;
    worker.on("message", message => this.#onMessage(message));
    worker.on("error", error => this.#failPending(error));
    worker.on("exit", code => { if (!this.closed && code !== 0) this.#failPending(new Error(`protocol-v5 worker exited ${code}`)); });
  }

  #onMessage(message) {
    const pending = this.pending.get(message?.id);
    if (pending === undefined) { this.#failPending(new Error("protocol-v5 received an unsolicited response")); return; }
    this.pending.delete(message.id); clearTimeout(pending.timeout);
    const entry = { session_id: this.sessionId, id: message.id, op: pending.op,
      status: Number.isSafeInteger(message?.status) ? message.status : null };
    if (message?.frame instanceof Uint8Array) entry.frame_sha256 = sha256(message.frame);
    if (message?.sample instanceof Uint8Array) entry.sample_sha256 = sha256(message.sample);
    this.log.push(Object.freeze(entry));
    if (message?.type !== "cadr-response" || message.version !== M7_PROTOCOL_VERSION ||
        message.op !== pending.op || !Number.isSafeInteger(message.status)) {
      pending.reject(new Error(`protocol-v5 malformed ${pending.op} response`)); return;
    }
    pending.resolve(message);
  }

  #failPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); }
    this.pending.clear();
  }

  request(op, fields = {}, transfer = []) {
    if (this.closed) return Promise.reject(new Error("protocol-v5 request after close"));
    const id = this.nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id); rejectRequest(new Error(`protocol-v5 ${op} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { timeout, op, resolve: resolveRequest, reject: rejectRequest });
      try { this.worker.postMessage({ version: M7_PROTOCOL_VERSION, id, op, ...fields }, transfer); }
      catch (error) { this.pending.delete(id); clearTimeout(timeout); rejectRequest(error); }
    });
  }

  async close() {
    if (this.closed) return Object.freeze({ pending_requests: 0, terminated: true });
    if (this.pending.size !== 0) fail("portable worker has pending requests at termination");
    this.closed = true;
    await this.worker.terminate();
    return Object.freeze({ pending_requests: 0, terminated: true });
  }
}

class LocalArtifacts {
  constructor(items) { this.items = items; }
  get artifacts() { return this.items.map(item => item.artifact); }
  async close() { await Promise.all(this.items.map(item => item.handle.close().catch(() => {}))); }
}

async function hashArtifact(artifact) {
  const digest = createHash("sha256");
  for (let offset = 0n; offset < artifact.byteCount; offset += 1_048_576n) {
    const length = artifact.byteCount - offset < 1_048_576n ? artifact.byteCount - offset : 1_048_576n;
    const bytes = await artifact.readRange(offset, length);
    if (!(bytes instanceof Uint8Array) || BigInt(bytes.byteLength) !== length) fail("artifact source returned a short range");
    digest.update(bytes);
  }
  return new Uint8Array(digest.digest());
}

async function openArtifacts(expected, artifactRoot) {
  const items = [];
  try {
    for (const item of expected) {
      const path = resolve(artifactRoot, item.local_path);
      const [info, handle] = await Promise.all([lstat(path), open(path, "r")]);
      if (!info.isFile() || info.isSymbolicLink() || BigInt(info.size) !== BigInt(item.byte_count)) {
        await handle.close(); fail(`local ${item.local_path} differs from its release identity`);
      }
      items.push(Object.freeze({ item, handle, artifact: Object.freeze({ kind: item.kind,
        byteCount: BigInt(item.byte_count),
        async readRange(offset, length) {
          if (offset < 0n || length < 0n || offset > BigInt(item.byte_count) || length > BigInt(item.byte_count) - offset || length > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new RangeError("artifact range is outside source bytes");
          }
          const buffer = Buffer.allocUnsafe(Number(length));
          const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, Number(offset));
          return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead).slice();
        },
      }) }));
    }
    return new LocalArtifacts(items);
  } catch (error) {
    await Promise.all(items.map(item => item.handle.close().catch(() => {})));
    throw error;
  }
}

function readyLimit(release) {
  const samples = release.idle_oracle?.sample_count;
  const first = release.native_runs?.[0]?.suffix_first_boundary;
  if (!Number.isSafeInteger(samples) || samples < 1 || typeof first !== "string" || !/^[1-9][0-9]*$/.test(first) ||
      !Array.isArray(release.native_runs) || release.native_runs.length !== 3 ||
      !release.native_runs.every(run => run?.suffix_first_boundary === first)) {
    fail("M6 release record does not provide a stable bounded READY limit");
  }
  return BigInt(first) + BigInt(samples - 1);
}

async function loadPinnedInputs() {
  const [profile, release] = await Promise.all([
    readCanonicalJson(PROFILE_PATH, "CADR-WEB profile", false),
    readCanonicalJson(RELEASE_PATH, "frozen M6 release record"),
  ]);
  if (profile.value?.profile?.id !== "CADR-WEB-303" || release.value?.contract !== CADR_M6_READY_CONTRACT) {
    fail("profile or M6 release identity is not selected CADR-WEB-303/M6");
  }
  const fromRelease = new Map((release.value.artifacts ?? []).map(item => [item.kind, item]));
  const expected = ARTIFACT_LAYOUT.map(layout => {
    const record = fromRelease.get(layout.kind);
    if (typeof record?.byte_count !== "string" || !/^[1-9][0-9]*$/.test(record.byte_count) || !/^[0-9a-f]{64}$/.test(record.sha256)) {
      fail(`M6 release has no exact artifact ${layout.kind}`);
    }
    return Object.freeze({ ...layout, byte_count: record.byte_count, sha256: record.sha256 });
  });
  const nativeInputs = release.value.native_inputs;
  if (!Array.isArray(nativeInputs) || nativeInputs.length !== 1 || typeof nativeInputs[0]?.sha256 !== "string") {
    fail("M6 release has no exact native-host input");
  }
  return Object.freeze({ profile, release, expected, nativeInputs: Object.freeze(nativeInputs) });
}

function parseNativeFrame(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 64 + 23_112 * 4 ||
      new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRM7N1") {
    fail("fresh native frame has the wrong CDRM7N1 size/magic");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = offset => view.getUint32(offset, true);
  const boundary = view.getBigUint64(16, true);
  if (u32(8) !== 1 || u32(12) !== 64 || boundary !== CADR_M7_FORM_C_BOUNDARY ||
      u32(24) !== 768 || u32(28) !== 963 || u32(36) !== 1 || u32(40) !== 32768 ||
      u32(44) !== 23112 || u32(48) !== 23112 * 4 ||
      !bytes.subarray(52, 64).every(byte => byte === 0)) {
    fail("fresh native frame has a malformed CDRM7N1 header");
  }
  const tvMode = u32(32);
  return Object.freeze({ schema: "CDRM7N1", sha256: sha256(bytes),
    byte_count: String(bytes.byteLength), boundary: boundary.toString(),
    width: 768, height: 963, stride_words: 24, backing_words: 32768,
    active_words: 23112, tv_mode: tvMode, black_on_white: Boolean((tvMode >>> 2) & 1),
    raw_words_sha256: sha256(bytes.subarray(64)) });
}

async function loadParentNativeInputs(preparedValue, pinned, sessionId, diskId) {
  const preparedPath = resolve(ROOT, preparedValue);
  const [prepare, build, m6Patch, m7Patch, ...support] = await Promise.all([
    readCanonicalJson(resolve(preparedPath, "m7-prepare.json"),
      "parent M7 prepare marker", true, true),
    readCanonicalJson(resolve(preparedPath, "m7-build.json"),
      "parent M7 build marker", true, true),
    fileIdentity(M6_PATCH_PATH, "parent M6 patch"),
    fileIdentity(M7_PATCH_PATH, "parent M7 patch"),
    ...M7_SUPPORT_PATHS.map(path => fileIdentity(path, "parent M7 support")),
  ]);
  const marker = prepare.value;
  const executable = { ...build.value };
  delete executable.schema;
  delete executable.schema_version;
  const executableReceipt = await fileIdentity(resolve(ROOT, executable.path), "parent M7 executable");
  const release = pinned.release.value;
  const disk = pinned.expected.find(item => item.kind === 3);
  if (marker.m6_patch_sha256 !== m6Patch.sha256 ||
      marker.m7_patch?.sha256 !== m7Patch.sha256 ||
      executable.sha256 !== executableReceipt.sha256 ||
      executable.bytes !== executableReceipt.bytes ||
      executable.path !== executableReceipt.path || disk === undefined) {
    fail("parent M7 marker inputs differ from tracked/pinned bytes");
  }
  const expectedSupport = support.map(identity => ({
    path: identity.path, installed_as: identity.path.split("/").at(-1),
    bytes: identity.bytes, sha256: identity.sha256,
  }));
  if (!sameJson(marker.m7_native_support, expectedSupport)) fail("parent M7 support marker differs from tracked bytes");
  const source = { system_fossil: release.identities?.system_fossil,
    usim_fossil: release.identities?.usim_fossil };
  digest(source.system_fossil, "parent System Fossil"); digest(source.usim_fossil, "parent usim Fossil");
  const schedule = { sha256: release.schedule?.sha256,
    event_count: release.schedule?.event_count,
    mapping_sha256: release.identities?.cadet_mapping_sha256 };
  digest(schedule.sha256, "parent schedule"); digest(schedule.mapping_sha256, "parent mapping");
  positiveInteger(schedule.event_count, "parent schedule event count");
  return Object.freeze({
    session_id: sessionId, private_disk_instance_id: diskId, source,
    m6_release_record: { path: relative(ROOT, RELEASE_PATH), bytes: pinned.release.bytes.byteLength,
      sha256: sha256(pinned.release.bytes) },
    patches: { m6_sha256: m6Patch.sha256, m7_sha256: m7Patch.sha256,
      m7_support: expectedSupport },
    prepared: { path: relative(ROOT, preparedPath),
      source_tree_sha256: marker.prepared_source_tree_sha256,
      source_file_count: marker.prepared_source_file_count, executable },
    artifacts: pinned.expected.map(item => ({
      kind: item.kind, byte_count: item.byte_count, sha256: item.sha256 })),
    native_inputs: structuredClone(pinned.nativeInputs), schedule,
    private_disk: { sha256_at_start: disk.sha256, sha256_at_end: disk.sha256 },
    process: { returncode: 0, timed_out: false, forced_stop: false,
      state_may_be_incomplete: false, pending_host_requests: 0 },
  });
}

function profileForM6(profile, expected) {
  return Object.freeze({ id: profile.value.profile.id, artifacts: expected.map(item => Object.freeze({
    kind: item.kind, byteCount: BigInt(item.byte_count), sha256: Buffer.from(item.sha256, "hex"),
  })) });
}

function nativeMetadata(value, expectedReleaseSha) {
  exactKeys(value, ["artifacts", "capture", "m6_release_record", "native_inputs", "patches", "prepared", "private_disk", "private_disk_instance_id", "process", "schedule", "schema", "session_id", "source", "target", "transcript"], "native metadata");
  if (value.schema !== "cadr-m7-native-frame-capture-v1" || value.target !== P4_TARGET) fail("native metadata has wrong schema/target");
  if (typeof value.session_id !== "string" || value.session_id.length === 0 ||
      typeof value.private_disk_instance_id !== "string" || value.private_disk_instance_id.length === 0) {
    fail("native metadata has no session/disk instance identity");
  }
  exactKeys(value.source, ["system_fossil", "usim_fossil"], "native source");
  digest(value.source.system_fossil, "native source system fossil"); digest(value.source.usim_fossil, "native source usim fossil");
  byteIdentity(value.m6_release_record, "native M6 release record");
  if (value.m6_release_record.sha256 !== expectedReleaseSha) fail("native capture is not bound to the frozen M6 release record");
  exactKeys(value.patches, ["m6_sha256", "m7_sha256", "m7_support"], "native patches");
  digest(value.patches.m6_sha256, "native M6 patch"); digest(value.patches.m7_sha256, "native M7 patch");
  if (!Array.isArray(value.patches.m7_support) || value.patches.m7_support.length !== 2) fail("native M7 support is incomplete");
  exactKeys(value.prepared, ["executable", "path", "source_file_count", "source_tree_sha256"], "native prepared identity");
  digest(value.prepared.source_tree_sha256, "native prepared tree"); positiveInteger(value.prepared.source_file_count, "native prepared file count");
  exactKeys(value.prepared.executable, ["bytes", "forbidden_undefined_symbol_count", "m6_patch_sha256", "m7_patch_sha256", "path", "prepared_source_file_count", "prepared_source_tree_sha256", "sha256"], "native executable identity");
  positiveInteger(value.prepared.executable.bytes, "native executable bytes"); digest(value.prepared.executable.sha256, "native executable hash");
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== 5 || !Array.isArray(value.native_inputs) || value.native_inputs.length !== 1) fail("native artifact/native-host bindings are incomplete");
  exactKeys(value.schedule, ["event_count", "mapping_sha256", "sha256"], "native schedule"); positiveInteger(value.schedule.event_count, "native schedule event count"); digest(value.schedule.mapping_sha256, "native schedule mapping"); digest(value.schedule.sha256, "native schedule");
  exactKeys(value.private_disk, ["sha256_at_end", "sha256_at_start"], "native private disk"); digest(value.private_disk.sha256_at_start, "native private disk start"); digest(value.private_disk.sha256_at_end, "native private disk end");
  if (value.private_disk.sha256_at_start !== value.private_disk.sha256_at_end) fail("native private disk changed");
  exactKeys(value.process, ["forced_stop", "pending_host_requests", "returncode", "state_may_be_incomplete", "timed_out"], "native process");
  if (value.process.returncode !== 0 || value.process.timed_out !== false || value.process.forced_stop !== false || value.process.state_may_be_incomplete !== false || value.process.pending_host_requests !== 0) fail("native process did not terminate cleanly");
  exactKeys(value.capture, ["active_words", "backing_words", "black_on_white", "boundary", "byte_count", "height", "raw_words_sha256", "schema", "sha256", "stride_words", "tv_mode", "width"], "native CDRM7N1 capture");
  if (value.capture.schema !== "CDRM7N1" || value.capture.boundary !== CADR_M7_FORM_C_BOUNDARY.toString()) fail("native capture has wrong M7 C boundary");
  digest(value.capture.sha256, "native capture hash"); digest(value.capture.raw_words_sha256, "native raw word hash");
  exactKeys(value.transcript, ["idle_samples_sha256", "sha256"], "native transcript"); digest(value.transcript.sha256, "native transcript hash"); digest(value.transcript.idle_samples_sha256, "native idle hash");
  return value;
}

/** Validate all P4 bindings before a result can be handed to P5. */
export function validateP4Manifest(value, expected) {
  exactKeys(expected, ["bindings", "schema"], "P4 expected closure");
  if (expected.schema !== P4_EXPECTED_CLOSURE_SCHEMA) fail("P4 expected closure has wrong schema");
  exactKeys(expected.bindings, ["artifacts", "comparison", "m6_release_record", "native", "native_inputs",
    "patches", "portable", "prepared", "schedule", "source", "summary"], "P4 expected bindings");
  exactKeys(value, ["artifacts", "comparison", "m6_release_record", "native", "native_inputs", "outcome", "patches", "portable", "prepared", "runtime_execution_performed", "schedule", "schema", "session", "source", "summary", "target"], "P4 manifest");
  if (value.schema !== P4_SCHEMA || value.target !== P4_TARGET || value.outcome !== "identical" || value.runtime_execution_performed !== true) fail("P4 manifest has wrong status");
  exactKeys(value.session, ["id", "mode"], "P4 session");
  if (typeof value.session.id !== "string" || value.session.id.length === 0 || value.session.mode !== "0700") fail("P4 session is not private");
  exactKeys(value.source, ["system_fossil", "usim_fossil"], "P4 source"); digest(value.source.system_fossil, "P4 system fossil"); digest(value.source.usim_fossil, "P4 usim fossil");
  byteIdentity(value.m6_release_record, "P4 M6 release");
  exactKeys(value.patches, ["m6_sha256", "m7_sha256", "m7_support"], "P4 patches"); digest(value.patches.m6_sha256, "P4 M6 patch"); digest(value.patches.m7_sha256, "P4 M7 patch");
  if (!Array.isArray(value.patches.m7_support) || value.patches.m7_support.length !== 2) fail("P4 M7 support inventory is incomplete");
  for (const [index, support] of value.patches.m7_support.entries()) {
    exactKeys(support, ["bytes", "installed_as", "path", "sha256"], `P4 M7 support ${index}`);
    positiveInteger(support.bytes, `P4 M7 support ${index} bytes`); digest(support.sha256, `P4 M7 support ${index} hash`);
  }
  exactKeys(value.prepared, ["executable", "path", "source_file_count", "source_tree_sha256"], "P4 prepared"); digest(value.prepared.source_tree_sha256, "P4 prepared tree"); positiveInteger(value.prepared.source_file_count, "P4 prepared count");
  exactKeys(value.prepared.executable, ["bytes", "forbidden_undefined_symbol_count", "m6_patch_sha256", "m7_patch_sha256", "path", "prepared_source_file_count", "prepared_source_tree_sha256", "sha256"], "P4 prepared executable");
  positiveInteger(value.prepared.executable.bytes, "P4 prepared executable bytes"); digest(value.prepared.executable.sha256, "P4 prepared executable hash");
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== 5 || !Array.isArray(value.native_inputs) || value.native_inputs.length !== 1) fail("P4 artifact closure is incomplete");
  for (const [index, artifact] of value.artifacts.entries()) {
    exactKeys(artifact, ["byte_count", "kind", "sha256"], `P4 artifact ${index}`);
    canonicalU64(artifact.byte_count, `P4 artifact ${index} byte count`); positiveInteger(artifact.kind, `P4 artifact ${index} kind`); digest(artifact.sha256, `P4 artifact ${index} hash`);
  }
  exactKeys(value.native_inputs[0], ["byte_count", "id", "sha256"], "P4 native hosts input"); canonicalU64(value.native_inputs[0].byte_count, "P4 native hosts byte count"); digest(value.native_inputs[0].sha256, "P4 native hosts hash");
  exactKeys(value.schedule, ["event_count", "mapping_sha256", "sha256"], "P4 schedule"); positiveInteger(value.schedule.event_count, "P4 schedule event count"); digest(value.schedule.mapping_sha256, "P4 schedule mapping"); digest(value.schedule.sha256, "P4 schedule hash");
  exactKeys(value.native, ["capture", "frame_file", "idle_file", "metadata_file", "oracle_process", "private_disk", "private_disk_instance_id", "process", "session_id", "transcript_file"], "P4 native");
  if (typeof value.native.session_id !== "string" || value.native.session_id.length === 0 ||
      typeof value.native.private_disk_instance_id !== "string" || value.native.private_disk_instance_id.length === 0) {
    fail("P4 native session/disk identity is absent");
  }
  exactKeys(value.native.private_disk, ["sha256_at_end", "sha256_at_start"], "P4 native private disk");
  digest(value.native.private_disk.sha256_at_start, "P4 native private disk start"); digest(value.native.private_disk.sha256_at_end, "P4 native private disk end");
  if (value.native.private_disk.sha256_at_start !== value.native.private_disk.sha256_at_end) fail("P4 native private disk changed");
  exactKeys(value.native.process, ["forced_stop", "pending_host_requests", "returncode", "state_may_be_incomplete", "timed_out"], "P4 native process");
  if (value.native.process.returncode !== 0 || value.native.process.timed_out !== false || value.native.process.forced_stop !== false || value.native.process.state_may_be_incomplete !== false || value.native.process.pending_host_requests !== 0) fail("P4 native termination failed");
  exactKeys(value.native.oracle_process, ["returncode", "signal"], "P4 native oracle process");
  if (value.native.oracle_process.returncode !== 0 || value.native.oracle_process.signal !== null) fail("P4 native oracle child termination failed");
  exactKeys(value.native.capture, ["active_words", "backing_words", "black_on_white", "boundary", "byte_count", "height", "raw_words_sha256", "schema", "sha256", "stride_words", "tv_mode", "width"], "P4 native capture");
  if (value.native.capture.schema !== "CDRM7N1" || value.native.capture.boundary !== CADR_M7_FORM_C_BOUNDARY.toString()) fail("P4 native capture has wrong boundary");
  digest(value.native.capture.sha256, "P4 native capture hash"); digest(value.native.capture.raw_words_sha256, "P4 native words hash");
  for (const [name, expectedPath] of [["frame_file", null], ["transcript_file", null], ["idle_file", null], ["metadata_file", null]]) privateFileIdentity(value.native[name], `P4 native ${name}`, expectedPath);
  exactKeys(value.portable, ["adapter", "cdrdisp_file", "framebuffer_checkpoint", "module", "ready_file", "session_evidence", "session_id", "termination", "witness_file", "worker", "worker_log_file"], "P4 portable");
  exactKeys(value.portable.session_evidence, ["ready_session_id", "worker_log_session_id"], "P4 portable session evidence");
  exactKeys(value.portable.termination, ["pending_requests", "terminated"], "P4 portable termination");
  if (typeof value.portable.session_id !== "string" || value.portable.session_id.length === 0 ||
      value.portable.session_evidence.ready_session_id !== value.portable.session_id ||
      value.portable.session_evidence.worker_log_session_id !== value.portable.session_id ||
      value.portable.termination.pending_requests !== 0 || value.portable.termination.terminated !== true) {
    fail("P4 portable worker did not terminate cleanly or bind its session");
  }
  byteIdentity(value.portable.module, "P4 Wasm module"); byteIdentity(value.portable.worker, "P4 worker");
  if (!Array.isArray(value.portable.adapter) || value.portable.adapter.length !== 2) fail("P4 adapter identity is incomplete");
  for (const [index, adapter] of value.portable.adapter.entries()) byteIdentity(adapter, `P4 adapter ${index}`);
  exactKeys(value.portable.framebuffer_checkpoint, ["boundary", "cdrdisp1_sha256", "cdrm6i1_sha256"], "P4 portable checkpoint");
  if (value.portable.framebuffer_checkpoint.boundary !== CADR_M7_FORM_C_BOUNDARY.toString()) fail("P4 portable checkpoint has wrong boundary");
  digest(value.portable.framebuffer_checkpoint.cdrdisp1_sha256, "P4 portable checkpoint frame"); digest(value.portable.framebuffer_checkpoint.cdrm6i1_sha256, "P4 portable checkpoint witness");
  privateFileIdentity(value.portable.cdrdisp_file, "P4 portable CDRDISP1", "portable/frame.cdrdisp1");
  privateFileIdentity(value.portable.witness_file, "P4 portable witness", "portable/witness.cdrm6i1");
  privateFileIdentity(value.portable.ready_file, "P4 portable ready", "portable/ready.json");
  privateFileIdentity(value.portable.worker_log_file, "P4 portable worker log", "portable/worker.ndjson");
  exactKeys(value.comparison, ["file", "m6_witness_sample_sha256", "native_capture_sha256", "native_raw_words_sha256", "portable_raw_words_sha256", "portable_record_sha256"], "P4 comparison");
  privateFileIdentity(value.comparison.file, "P4 comparison file", "comparison.json");
  for (const field of ["m6_witness_sample_sha256", "native_capture_sha256", "native_raw_words_sha256", "portable_raw_words_sha256", "portable_record_sha256"]) digest(value.comparison[field], `P4 comparison ${field}`);
  exactKeys(value.summary, ["comparison_sha256", "manifest_kind", "native_frame_sha256", "portable_frame_sha256"], "P4 summary");
  if (value.summary.manifest_kind !== "hashes-only") fail("P4 summary is not hashes-only");
  for (const field of ["comparison_sha256", "native_frame_sha256", "portable_frame_sha256"]) digest(value.summary[field], `P4 summary ${field}`);
  if (value.native.capture.sha256 !== value.native.frame_file.sha256 ||
      value.portable.framebuffer_checkpoint.cdrdisp1_sha256 !== value.portable.cdrdisp_file.sha256 ||
      value.portable.framebuffer_checkpoint.cdrm6i1_sha256 !== value.portable.witness_file.sha256 ||
      value.comparison.native_capture_sha256 !== value.native.capture.sha256 ||
      value.comparison.native_raw_words_sha256 !== value.native.capture.raw_words_sha256 ||
      value.comparison.portable_record_sha256 !== value.portable.cdrdisp_file.sha256 ||
      value.comparison.m6_witness_sample_sha256 !== value.portable.witness_file.sha256 ||
      value.summary.comparison_sha256 !== value.comparison.file.sha256 ||
      value.summary.native_frame_sha256 !== value.native.frame_file.sha256 ||
      value.summary.portable_frame_sha256 !== value.portable.cdrdisp_file.sha256) {
    fail("P4 redundant hashes do not describe one captured checkpoint");
  }
  if (!sameJson(p4Bindings(value), expected.bindings)) fail("P4 binding differs from the expected campaign identity");
  return Object.freeze(value);
}

export function p4Bindings(value) {
  return {
    source: value.source, m6_release_record: value.m6_release_record, patches: value.patches,
    prepared: value.prepared, artifacts: value.artifacts, native_inputs: value.native_inputs,
    schedule: value.schedule, native: { session_id: value.native.session_id, private_disk_instance_id: value.native.private_disk_instance_id, private_disk: value.native.private_disk, process: value.native.process, oracle_process: value.native.oracle_process, capture: value.native.capture, frame_file: value.native.frame_file, transcript_file: value.native.transcript_file, idle_file: value.native.idle_file, metadata_file: value.native.metadata_file },
    portable: { session_id: value.portable.session_id, session_evidence: value.portable.session_evidence, module: value.portable.module, worker: value.portable.worker, adapter: value.portable.adapter, termination: value.portable.termination, framebuffer_checkpoint: value.portable.framebuffer_checkpoint, cdrdisp_file: value.portable.cdrdisp_file, witness_file: value.portable.witness_file, ready_file: value.portable.ready_file, worker_log_file: value.portable.worker_log_file },
    comparison: value.comparison, summary: value.summary,
  };
}

async function portableCheckpoint({ nativeFrame, pinned, wasmPath, artifactRoot, portableDirectory, sessionId }) {
  const wasmIdentity = await fileIdentity(wasmPath, "M7 Wasm module");
  const workerIdentity = await fileIdentity(WORKER_PATH, "M7 worker");
  const adapter = await Promise.all(ADAPTER_PATHS.map(path => fileIdentity(path, "M7 Wasm adapter")));
  const wasmBytes = await readFile(wasmPath);
  const module = await WebAssembly.compile(wasmBytes);
  const artifacts = await openArtifacts(pinned.expected, artifactRoot);
  const client = new ProtocolV5Client(new Worker(WORKER_URL, { type: "module" }), sessionId);
  let termination = null;
  try {
    const instantiate = await client.request("instantiate", { module });
    if (instantiate.status !== 0) fail(`protocol-v5 M7 instantiation failed with status ${instantiate.status}`);
    const profile = profileForM6(pinned.profile, pinned.expected);
    const checked = await preflightM6Artifacts({ artifacts: artifacts.artifacts, profile, hashArtifact });
    const result = await runM7CheckpointedM6Boot({
      nativeCapture: nativeFrame,
      client,
      artifacts: checked.sources,
      profile,
      hashArtifact,
      maxBoundaries: readyLimit(pinned.release.value),
      maxHostTransactions: 1024,
      ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT, releaseRecord: pinned.release.bytes.slice() }),
    });
    if (result.comparison.outcome !== "identical") fail("M7 portable comparison did not report identity");
    const frame = result.checkpoint.display_record;
    const witness = result.checkpoint.witness_sample;
    const ready = Object.freeze({ session_id: sessionId, outcome: result.m6.outcome,
      boundary: result.checkpoint.boundary.toString(),
      m6_release_record_sha256: result.comparison.m6_release_record_sha256,
      m6_witness_sample_sha256: result.comparison.m6_witness_sample_sha256 });
    const frameFile = await writePrivateNew(resolve(portableDirectory, "frame.cdrdisp1"), frame);
    const witnessFile = await writePrivateNew(resolve(portableDirectory, "witness.cdrm6i1"), witness);
    const readyFile = await writePrivateNew(resolve(portableDirectory, "ready.json"), ready);
    termination = await client.close();
    const workerLogFile = await writePrivateNew(resolve(portableDirectory, "worker.ndjson"),
      new TextEncoder().encode(`${client.log.map(entry => canonicalJson(entry)).join("\n")}\n`));
    return Object.freeze({ result, sessionId: ready.session_id, workerLogSessionId: client.sessionId,
      module: wasmIdentity, worker: workerIdentity, adapter,
      frameFile, witnessFile, readyFile, workerLogFile, termination, ready });
  } catch (error) {
    const failure = Object.freeze({
      schema: "cadr-m7-portable-failure-v1",
      session_id: sessionId,
      error_name: typeof error?.name === "string" ? error.name : "Error",
      error_message: String(error?.message ?? error),
    });
    await writePrivateNew(resolve(portableDirectory, "failure.json"), failure);
    await writePrivateNew(resolve(portableDirectory, "worker.ndjson"),
      new TextEncoder().encode(
        `${client.log.map(entry => canonicalJson(entry)).join("\n")}\n`));
    throw error;
  } finally {
    if (termination === null) {
      try { await client.close(); } catch { /* preserve original failure */ }
    }
    await artifacts.close();
  }
}

async function runCampaign(options) {
  if (!options.execute) fail("refusing to start a private runtime without explicit --execute");
  if (options.nativeConfig === null) fail("--native-config is required with --execute");
  await Promise.all([fileIdentity(options.wasm, "M7 Wasm module"), fileIdentity(NATIVE_ORACLE, "M7 native oracle")]);
  const pinned = await loadPinnedInputs();
  const session = await makeFreshSession(options.sessionRoot);
  const nativeDirectory = resolve(session.path, "native");
  const portableDirectory = resolve(session.path, "portable");
  const nativeSessionId = `native-${randomUUID().replaceAll("-", "")}`;
  const diskId = `disk-${randomUUID().replaceAll("-", "")}`;
  const portableSessionId = `portable-${randomUUID().replaceAll("-", "")}`;
  try {
    const parentNativeInputs = await loadParentNativeInputs(
      options.prepared, pinned, nativeSessionId, diskId);
    const nativeChild = await runNativeCapture({ prepared: options.prepared, nativeConfig: options.nativeConfig,
      output: nativeDirectory, sessionId: nativeSessionId, diskId });
    for (const name of ["frame.cdrm7n1", "capture.ndjson", "idle.bin", "metadata.json"]) {
      await assertPrivateFile(resolve(nativeDirectory, name), `native ${name}`);
    }
    const nativeInfo = await readCanonicalJson(resolve(nativeDirectory, "metadata.json"), "native M7 metadata");
    const native = nativeMetadata(nativeInfo.value, sha256(pinned.release.bytes));
    const nativeFrame = new Uint8Array(await readFile(resolve(nativeDirectory, "frame.cdrm7n1")));
    const expectedNativeMetadata = { schema: "cadr-m7-native-frame-capture-v1",
      target: P4_TARGET, ...structuredClone(parentNativeInputs),
      capture: parseNativeFrame(nativeFrame),
      transcript: { sha256: sha256(await readFile(resolve(nativeDirectory, "capture.ndjson"))),
        idle_samples_sha256: sha256(await readFile(resolve(nativeDirectory, "idle.bin"))) } };
    if (!sameJson(native, expectedNativeMetadata) ||
        !sameJson(nativeChild.response.metadata, expectedNativeMetadata)) {
      fail("native child metadata differs from parent-known inputs and fresh receipts");
    }
    const portable = await portableCheckpoint({ nativeFrame, pinned, wasmPath: options.wasm,
      artifactRoot: options.artifactRoot, portableDirectory, sessionId: portableSessionId });
    const comparison = portable.result.comparison;
    const comparisonFile = await writePrivateNew(resolve(session.path, "comparison.json"), comparison);
    const comparisonInfo = await readCanonicalJson(resolve(session.path, "comparison.json"), "P4 comparison");
    if (!sameJson(comparisonInfo.value, comparison)) fail("fresh P4 comparison bytes differ from the checkpoint result");
    const nativeFiles = await Promise.all(["frame.cdrm7n1", "capture.ndjson", "idle.bin", "metadata.json"].map(async name =>
      fileIdentity(resolve(nativeDirectory, name), `native ${name}`)));
    const nativeBinding = { session_id: native.session_id,
      private_disk_instance_id: native.private_disk_instance_id,
      private_disk: native.private_disk, process: native.process,
      oracle_process: nativeChild.oracle_process, capture: native.capture,
      frame_file: nativeFiles[0], transcript_file: nativeFiles[1],
      idle_file: nativeFiles[2], metadata_file: nativeFiles[3] };
    const portableBinding = { session_id: portable.sessionId,
      session_evidence: { ready_session_id: portable.ready.session_id,
        worker_log_session_id: portable.workerLogSessionId },
      module: portable.module, worker: portable.worker, adapter: portable.adapter,
      framebuffer_checkpoint: { boundary: comparison.boundary,
        cdrdisp1_sha256: comparison.portable_record_sha256,
        cdrm6i1_sha256: comparison.m6_witness_sample_sha256 },
      cdrdisp_file: { path: "portable/frame.cdrdisp1", ...portable.frameFile },
      witness_file: { path: "portable/witness.cdrm6i1", ...portable.witnessFile },
      ready_file: { path: "portable/ready.json", ...portable.readyFile },
      worker_log_file: { path: "portable/worker.ndjson", ...portable.workerLogFile },
      termination: portable.termination };
    const comparisonBinding = { file: { path: "comparison.json", ...comparisonFile },
      m6_witness_sample_sha256: comparison.m6_witness_sample_sha256,
      native_capture_sha256: comparison.native_capture_sha256,
      native_raw_words_sha256: comparison.native_raw_words_sha256,
      portable_raw_words_sha256: comparison.portable_raw_words_sha256,
      portable_record_sha256: comparison.portable_record_sha256 };
    const summaryBinding = { manifest_kind: "hashes-only",
      comparison_sha256: comparisonFile.sha256,
      native_frame_sha256: comparison.native_capture_sha256,
      portable_frame_sha256: comparison.portable_record_sha256 };
    const pinnedArtifacts = pinned.expected.map(item => ({
      kind: item.kind, byte_count: item.byte_count, sha256: item.sha256,
    }));
    const pinnedReleaseIdentity = { path: relative(ROOT, RELEASE_PATH),
      bytes: pinned.release.bytes.byteLength, sha256: sha256(pinned.release.bytes) };
    const expectedNative = { session_id: parentNativeInputs.session_id,
      private_disk_instance_id: parentNativeInputs.private_disk_instance_id,
      private_disk: parentNativeInputs.private_disk, process: parentNativeInputs.process,
      oracle_process: { returncode: 0, signal: null },
      capture: expectedNativeMetadata.capture, frame_file: nativeFiles[0],
      transcript_file: nativeFiles[1], idle_file: nativeFiles[2], metadata_file: nativeFiles[3] };
    const expectedPortable = structuredClone(portableBinding);
    expectedPortable.framebuffer_checkpoint.cdrdisp1_sha256 = portable.frameFile.sha256;
    expectedPortable.framebuffer_checkpoint.cdrm6i1_sha256 = portable.witnessFile.sha256;
    const expectedComparison = {
      file: { path: "comparison.json", ...comparisonFile },
      m6_witness_sample_sha256: portable.witnessFile.sha256,
      native_capture_sha256: nativeFiles[0].sha256,
      native_raw_words_sha256: expectedNative.capture.raw_words_sha256,
      portable_raw_words_sha256: comparisonInfo.value.portable_raw_words_sha256,
      portable_record_sha256: portable.frameFile.sha256,
    };
    const expectedSummary = { manifest_kind: "hashes-only",
      comparison_sha256: comparisonFile.sha256, native_frame_sha256: nativeFiles[0].sha256,
      portable_frame_sha256: portable.frameFile.sha256 };
    const expectedClosure = {
      schema: P4_EXPECTED_CLOSURE_SCHEMA,
      bindings: structuredClone({
        source: parentNativeInputs.source, m6_release_record: pinnedReleaseIdentity,
        patches: parentNativeInputs.patches, prepared: parentNativeInputs.prepared, artifacts: pinnedArtifacts,
        native_inputs: pinned.nativeInputs, schedule: parentNativeInputs.schedule,
        native: expectedNative, portable: expectedPortable,
        comparison: expectedComparison, summary: expectedSummary,
      }),
    };
    const manifest = {
      schema: P4_SCHEMA, target: P4_TARGET, outcome: "identical", runtime_execution_performed: true,
      session: { id: session.id, mode: "0700" }, source: native.source,
      m6_release_record: native.m6_release_record, patches: native.patches, prepared: native.prepared,
      artifacts: native.artifacts, native_inputs: native.native_inputs, schedule: native.schedule,
      native: nativeBinding, portable: portableBinding,
      comparison: comparisonBinding, summary: summaryBinding,
    };
    validateP4Manifest(manifest, expectedClosure);
    const manifestReceipt = await writePrivateNew(resolve(session.path, "manifest.json"), manifest);
    const names = (await readdir(session.path)).sort();
    if (!sameJson(names, ["comparison.json", "manifest.json", "native", "portable"])) fail("P4 session has an unexpected top-level sidecar");
    return Object.freeze({ session: relative(ROOT, session.path), manifest: { path: "manifest.json", ...manifestReceipt },
      summary: manifest.summary });
  } catch (error) {
    /* A failed campaign remains private for diagnosis, but never produces a
     * manifest that P5 could mistake for a successful checkpoint. */
    await unlink(resolve(session.path, "manifest.json")).catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.execute) {
    process.stdout.write(`${canonicalJson({ schema: "cadr-m7-frame-conformance-plan-v1", outcome: "blocked", runtime_execution_performed: false, reason: "explicit---execute-required" })}\n`);
    process.exitCode = 2;
    return;
  }
  const result = await runCampaign(options);
  process.stdout.write(`${canonicalJson({ schema: "cadr-m7-frame-conformance-summary-v1", outcome: "identical", ...result })}\n`);
}

const invokedAsMain = typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsMain) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
