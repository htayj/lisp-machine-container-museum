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
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_PROTOCOL_VERSION,
  CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES,
  CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  preflightM6Artifacts,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_FORM_C_BOUNDARY,
  compareM7FrameCheckpoint,
  runM7CheckpointedM6Boot,
} from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION,
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_SCHEMA,
  serializeM7EffectivePageIdentityStream,
} from "../cadr-web/wasm/cadr-m7-effective-page-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-oracle");
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const NATIVE_ORACLE = resolve(ROOT, "scripts/cadr-m7-native-frame-oracle.py");
const WASM_SOURCE_ROOT = resolve(ROOT, "cadr-web/wasm");
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
export const P4_MAX_HOST_TRANSACTIONS = 2048;
export const P4_PORTABLE_WALL_TIME_MS = 10_800_000;
export const P4_REQUEST_TIMEOUT_MS = 120_000;
export const P4_EXECUTION_BUDGET_SCHEMA = "cadr-m7-p4-execution-budget-v1";
const P4_SCHEMA = "cadr-m7-frame-conformance-result-v3";
const P4_TARGET = "CADR-WEB-303/ABI1.5/protocol-v5/M7";
export const P4_EXPECTED_CLOSURE_SCHEMA = "cadr-m7-frame-expected-closure-v2";
const P4_PORTABLE_FAILURE_SCHEMA = "cadr-m7-portable-failure-v4";
const P4_ROOT_FAILURE_SCHEMA = "cadr-m7-frame-conformance-failure-v3";
const P4_DISK_BYTE_COUNT = "269562880";
const P4_BLOCK_BYTES = 1024;
const P4_DISK_BLOCK_COUNT = "263245";
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

function workerClosureIdentity(value, label) {
  exactKeys(value, [
    "builtins", "entry", "files", "node", "schema", "tree_sha256",
  ], label);
  if (value.schema !== "cadr-m7-worker-source-closure-v1" ||
      !Array.isArray(value.files) || value.files.length === 0 ||
      !Array.isArray(value.builtins) ||
      !sameJson(value.builtins, ["node:worker_threads"])) {
    fail(`${label} has an invalid identity`);
  }
  exactKeys(value.node, [
    "executable_bytes", "executable_sha256", "version",
  ], `${label}.node`);
  positiveInteger(value.node.executable_bytes,
    `${label}.node executable bytes`);
  digest(value.node.executable_sha256,
    `${label}.node executable hash`);
  if (typeof value.node.version !== "string" ||
      !/^v[1-9][0-9]*\.[0-9]+\.[0-9]+$/u.test(value.node.version)) {
    fail(`${label}.node version is invalid`);
  }
  byteIdentity(value.entry, `${label}.entry`);
  const files = value.files.map((file, index) =>
    byteIdentity(file, `${label}.files[${index}]`));
  const paths = files.map(file => file.path);
  if (paths.some((path, index) =>
    (index > 0 && paths[index - 1] >= path)) ||
      !files.some(file => sameJson(file, value.entry)) ||
      value.tree_sha256 !== sha256(new TextEncoder().encode(canonicalJson({
        builtins: value.builtins, files, node: value.node,
      })))) {
    fail(`${label} is not a canonical closed worker tree`);
  }
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

export function p4ExecutionBudgetRecord() {
  return Object.freeze({
    schema: P4_EXECUTION_BUDGET_SCHEMA,
    max_host_transactions: P4_MAX_HOST_TRANSACTIONS,
    portable_wall_time_ms: P4_PORTABLE_WALL_TIME_MS,
    request_timeout_ms: P4_REQUEST_TIMEOUT_MS,
    disk_byte_count: P4_DISK_BYTE_COUNT,
    block_bytes: P4_BLOCK_BYTES,
    disk_block_count: P4_DISK_BLOCK_COUNT,
    extension_policy: "none",
    resume_policy: "fresh-session-only",
  });
}

function validateExecutionBudget(value, label) {
  exactKeys(value, ["block_bytes", "disk_block_count", "disk_byte_count",
    "extension_policy", "max_host_transactions", "portable_wall_time_ms",
    "request_timeout_ms", "resume_policy", "schema"], label);
  if (!sameJson(value, p4ExecutionBudgetRecord())) {
    fail(`${label} differs from the fixed P4 budget`);
  }
  return value;
}

function validateExecutionAccounting(value, label) {
  exactKeys(value, ["completed_host_transactions", "elapsed_monotonic_ms",
    "final_boundary", "host_transcript_sha256", "last_completed_request_id",
    "limit_hit", "outstanding_request_id", "transcript_record_count"], label);
  for (const field of ["completed_host_transactions", "elapsed_monotonic_ms",
    "final_boundary", "last_completed_request_id", "outstanding_request_id",
    "transcript_record_count"]) canonicalU64(value[field], `${label}.${field}`);
  digest(value.host_transcript_sha256, `${label}.host_transcript_sha256`);
  if (value.limit_hit !== null &&
      !["host-transactions", "portable-wall-time"].includes(value.limit_hit)) {
    fail(`${label}.limit_hit is invalid`);
  }
  if (BigInt(value.transcript_record_count) !==
        BigInt(value.completed_host_transactions) * 2n ||
      BigInt(value.completed_host_transactions) > BigInt(P4_MAX_HOST_TRANSACTIONS)) {
    fail(`${label} transaction accounting is inconsistent`);
  }
  if (value.limit_hit === "host-transactions" &&
      (value.completed_host_transactions !== String(P4_MAX_HOST_TRANSACTIONS) ||
       value.transcript_record_count !== String(P4_MAX_HOST_TRANSACTIONS * 2) ||
       value.last_completed_request_id !== String(P4_MAX_HOST_TRANSACTIONS) ||
       value.outstanding_request_id !== String(P4_MAX_HOST_TRANSACTIONS + 1))) {
    fail(`${label} host transaction limit is not exact`);
  }
  return value;
}

function p4Accounting({ hostTranscript, elapsedMs, finalBoundary,
  lastCompletedRequestId, outstandingRequestId, limitHit }) {
  if (!(hostTranscript instanceof Uint8Array)) {
    fail("P4 accounting host transcript is absent");
  }
  const parsed = parseP4HostTranscript(hostTranscript);
  return Object.freeze({
    completed_host_transactions: String(parsed.recordCount / 2),
    transcript_record_count: String(parsed.recordCount),
    host_transcript_sha256: sha256(hostTranscript),
    elapsed_monotonic_ms: String(Math.max(0, Math.floor(elapsedMs))),
    final_boundary: String(finalBoundary ?? 0),
    last_completed_request_id: String(lastCompletedRequestId ?? 0),
    outstanding_request_id: String(outstandingRequestId ?? 0),
    limit_hit: limitHit,
  });
}

function emptyP4HostTranscript() {
  const bytes = new Uint8Array(CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES);
  bytes.set(new TextEncoder().encode("CDRM6HS1"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 1, true);
  view.setUint32(12, CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES, true);
  view.setUint32(16, CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES, true);
  return bytes;
}

export function failureExecutionEvidence(caught, elapsedMs, terminalCause = null) {
  let hostTranscript = emptyP4HostTranscript();
  let report = null;
  if (caught?.m6FailureDiagnostic instanceof Uint8Array) {
    const diagnostic = parseCanonicalJsonBytes(
      caught.m6FailureDiagnostic, "P4 M6 failure diagnostic").value;
    report = diagnostic?.failure?.report ?? null;
    if (report?.phase !== "preflight") {
      if (!(caught.m6FailureHostTranscript instanceof Uint8Array)) {
        fail("post-preflight P4 M6 failure omitted its full host transcript");
      }
      hostTranscript = caught.m6FailureHostTranscript.slice();
      const parsed = parseP4HostTranscript(hostTranscript,
        diagnostic.failure.preflight.artifactSetSha256);
      if (String(parsed.recordCount) !== String(report.transcriptCount) ||
          sha256(hostTranscript) !== report.hostTranscriptSha256) {
        fail("P4 M6 failure transcript differs from its diagnostic accounting");
      }
      const retainedTail = parsed.records.slice(-diagnostic.failure.transcriptTail.length);
      if (!sameJson(retainedTail, diagnostic.failure.transcriptTail)) {
        fail("P4 M6 failure transcript tail differs from its diagnostic");
      }
    }
  }
  const machine = report?.machineInfo ?? null;
  const explicitCause = terminalCause ?? caught?.p4TerminalCause ?? null;
  const limitHit = explicitCause === "portable-wall-time" ?
    "portable-wall-time" :
    (report?.reason === "host-transaction-limit-exhausted" ?
      "host-transactions" : null);
  return Object.freeze({
    hostTranscript,
    accounting: p4Accounting({
      hostTranscript, elapsedMs,
      finalBoundary: report?.boundary ?? machine?.boundary ?? 0,
      lastCompletedRequestId: machine?.lastCompletedRequestId ?? 0,
      outstandingRequestId: machine?.outstandingRequestId ?? 0,
      limitHit,
    }),
    retainTranscript: report !== null && report.phase !== "preflight",
  });
}

export function parseP4HostTranscript(value, expectedArtifactSetSha256 = null) {
  const bytes = value instanceof Uint8Array ? value : null;
  if (bytes === null || bytes.byteLength < CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES ||
      new TextDecoder().decode(bytes.subarray(0, 8)) !== "CDRM6HS1") {
    fail("P4 host transcript framing is invalid");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset,
    CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES);
  const count = header.getUint32(20, true);
  if (header.getUint32(8, true) !== 1 ||
      header.getUint32(12, true) !== CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES ||
      header.getUint32(16, true) !== CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES ||
      count % 2 !== 0 || count > P4_MAX_HOST_TRANSACTIONS * 2 ||
      bytes.byteLength !== CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
        count * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES ||
      bytes.subarray(56, 64).some(byte => byte !== 0)) {
    fail("P4 host transcript header is invalid");
  }
  const artifactSetSha256 = Buffer.from(bytes.subarray(24, 56)).toString("hex");
  if (expectedArtifactSetSha256 !== null &&
      artifactSetSha256 !== digest(expectedArtifactSetSha256,
        "P4 expected artifact-set hash")) {
    fail("P4 host transcript artifact set differs");
  }
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const offset = CADR_M6_HOST_TRANSCRIPT_HEADER_BYTES +
      index * CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES;
    const raw = bytes.subarray(offset,
      offset + CADR_M6_HOST_TRANSCRIPT_RECORD_BYTES);
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (view.getBigUint64(0, true) !== BigInt(index) ||
        view.getUint32(8, true) !== (index % 2 === 0 ? 1 : 2) ||
        raw.subarray(200).some(byte => byte !== 0)) {
      fail(`P4 host transcript record ${index} is invalid`);
    }
    records.push(Object.freeze({
      ordinal: index,
      actor: index % 2 === 0 ? "issue" : "completion",
      operation: view.getUint32(12, true),
      guestBoundary: view.getBigUint64(16, true).toString(),
      dueBoundary: view.getBigUint64(24, true).toString(),
      generation: view.getBigUint64(32, true).toString(),
      requestId: view.getBigUint64(40, true).toString(),
      hostStatus: view.getUint32(48, true),
      blockCount: view.getUint32(52, true),
      descriptorByteCount: view.getBigUint64(56, true).toString(),
      requestPayloadByteCount: view.getBigUint64(64, true).toString(),
      completionByteCount: view.getBigUint64(72, true).toString(),
      firstBlock: view.getBigUint64(80, true).toString(),
      blockBytes: view.getUint32(88, true),
      overlayGeneration: view.getBigUint64(96, true).toString(),
      descriptorSha256: Buffer.from(raw.subarray(104, 136)).toString("hex"),
      requestPayloadSha256: Buffer.from(raw.subarray(136, 168)).toString("hex"),
      completionSha256: Buffer.from(raw.subarray(168, 200)).toString("hex"),
    }));
  }
  const pairFields = ["operation", "guestBoundary", "dueBoundary", "generation",
    "requestId", "hostStatus", "blockCount", "descriptorByteCount",
    "requestPayloadByteCount", "completionByteCount", "firstBlock", "blockBytes",
    "overlayGeneration", "descriptorSha256", "requestPayloadSha256"];
  for (let index = 0; index < records.length; index += 2) {
    const issue = records[index]; const completion = records[index + 1];
    if (issue.requestId !== String(index / 2 + 1) ||
        pairFields.some(field => issue[field] !== completion[field])) {
      fail(`P4 host transcript pair ${index / 2} is inconsistent`);
    }
  }
  return Object.freeze({ artifactSetSha256, recordCount: count,
    records: Object.freeze(records) });
}

export class P4PortableDeadlineError extends Error {
  constructor() {
    super(`P4 portable wall-time limit exhausted after ${P4_PORTABLE_WALL_TIME_MS}ms`);
    this.name = "P4PortableDeadlineError";
  }
}

export class P4PortableExecutionDeadline {
  #now; #setTimeout; #clearTimeout; #started; #timer; #expired = false;
  #reject; #expiration; #terminator = null; #terminalError = null;
  constructor({ now = performance.now.bind(performance),
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
    wallTimeMs = P4_PORTABLE_WALL_TIME_MS } = {}) {
    if (typeof now !== "function" || typeof setTimeoutFn !== "function" ||
        typeof clearTimeoutFn !== "function" || !Number.isSafeInteger(wallTimeMs) ||
        wallTimeMs < 1 || wallTimeMs > P4_PORTABLE_WALL_TIME_MS) {
      fail("portable deadline test seam is invalid");
    }
    this.#now = now; this.#setTimeout = setTimeoutFn;
    this.#clearTimeout = clearTimeoutFn; this.wallTimeMs = wallTimeMs;
    this.#started = now();
    this.#expiration = new Promise((_, reject) => { this.#reject = reject; });
    void this.#expiration.catch(() => {});
    this.#timer = setTimeoutFn(() => this.#expire(), wallTimeMs);
  }
  #expire() {
    if (this.#expired) return;
    this.#expired = true;
    const error = new P4PortableDeadlineError();
    Object.defineProperty(error, "p4TerminalCause", {
      value: "portable-wall-time", enumerable: true,
    });
    this.#terminalError = error;
    this.#reject(error);
    try { this.#terminator?.(); } catch { /* deadline rejection remains first */ }
  }
  attachTerminator(terminator) {
    if (typeof terminator !== "function" || this.#terminator !== null) {
      fail("portable deadline terminator is invalid");
    }
    this.#terminator = terminator;
    if (this.#expired) terminator();
  }
  remainingMs() {
    return Math.max(0, this.wallTimeMs - Math.floor(this.#now() - this.#started));
  }
  requestTimeoutMs() {
    const remaining = this.remainingMs();
    if (remaining === 0) this.#expire();
    return Math.min(P4_REQUEST_TIMEOUT_MS, remaining);
  }
  race(value) {
    if (this.remainingMs() === 0) this.#expire();
    return Promise.race([Promise.resolve(value), this.#expiration]);
  }
  async join(value) {
    const operation = Promise.resolve(value);
    try {
      const result = await this.race(operation);
      if (this.remainingMs() === 0) this.#expire();
      if (this.#expired) throw this.#terminalError;
      return result;
    } catch (error) {
      if (!this.#expired) throw error;
      await operation.catch(() => {});
      throw this.#terminalError;
    }
  }
  elapsedMs() {
    return Math.max(0, Math.floor(this.#now() - this.#started));
  }
  close() {
    if (this.#timer !== null) this.#clearTimeout(this.#timer);
    this.#timer = null;
    return this.elapsedMs();
  }
  get expired() { return this.#expired; }
  get terminalCause() {
    return this.#expired ? "portable-wall-time" : null;
  }
  terminalError() { return this.#terminalError; }
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

function parseCanonicalJsonBytes(bytes, label, canonicalRequired = true,
  terminalLf = false) {
  if (!(bytes instanceof Uint8Array)) {
    fail(`${label} is not a byte sequence`);
  }
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

async function readCanonicalJson(path, label, canonicalRequired = true,
  terminalLf = false) {
  return parseCanonicalJsonBytes(
    new Uint8Array(await readFile(path)), label, canonicalRequired, terminalLf);
}

async function fileIdentity(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} is not a regular non-symlink file`);
  const bytes = await readFile(path);
  return Object.freeze({ path: relative(ROOT, path), bytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function readBoundRegularFile(path, label) {
  const handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) {
      fail(`${label} is not a regular file`);
    }
    const bytes = new Uint8Array(await handle.readFile());
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs ||
        bytes.byteLength !== after.size) {
      fail(`${label} changed while its bound bytes were read`);
    }
    return Object.freeze({
      bytes,
      identity: Object.freeze({
        path: relative(ROOT, path),
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }),
    });
  } finally {
    await handle.close();
  }
}

function moduleTokens(source, label) {
  const tokens = [];
  const length = source.length;
  let offset = 0;

  const scanString = quote => {
    const start = offset++;
    let escaped = false;
    while (offset < length) {
      const character = source[offset++];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        tokens.push(Object.freeze({
          kind: "string", raw: source.slice(start, offset),
          escaped: source.slice(start + 1, offset - 1).includes("\\"),
          value: source.slice(start + 1, offset - 1),
        }));
        return;
      } else if (character === "\n" || character === "\r") {
        fail(`${label} contains an unterminated string`);
      }
    }
    fail(`${label} contains an unterminated string`);
  };

  const scanTemplate = () => {
    offset += 1;
    let escaped = false;
    while (offset < length) {
      const character = source[offset++];
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "`") {
        return;
      } else if (character === "$" && source[offset] === "{") {
        offset += 1;
        scanCode(true);
      }
    }
    fail(`${label} contains an unterminated template literal`);
  };

  const scanCode = stopAtTemplateBrace => {
    let braceDepth = 0;
    while (offset < length) {
      const character = source[offset];
      if (/\s/u.test(character)) {
        offset += 1;
        continue;
      }
      if (character === "/" && source[offset + 1] === "/") {
        offset += 2;
        while (offset < length && source[offset] !== "\n" &&
               source[offset] !== "\r") offset += 1;
        continue;
      }
      if (character === "/" && source[offset + 1] === "*") {
        const end = source.indexOf("*/", offset + 2);
        if (end < 0) fail(`${label} contains an unterminated comment`);
        offset = end + 2;
        continue;
      }
      if (character === "'" || character === '"') {
        scanString(character);
        continue;
      }
      if (character === "`") {
        scanTemplate();
        continue;
      }
      if (/[A-Za-z_$]/u.test(character)) {
        const start = offset++;
        while (offset < length && /[A-Za-z0-9_$]/u.test(source[offset])) {
          offset += 1;
        }
        tokens.push(Object.freeze({
          kind: "identifier", value: source.slice(start, offset),
        }));
        continue;
      }
      offset += 1;
      if (stopAtTemplateBrace && character === "}") {
        if (braceDepth === 0) return;
        braceDepth -= 1;
      } else if (stopAtTemplateBrace && character === "{") {
        braceDepth += 1;
      }
      tokens.push(Object.freeze({ kind: "punctuator", value: character }));
    }
    if (stopAtTemplateBrace) {
      fail(`${label} contains an unterminated template expression`);
    }
  };

  scanCode(false);
  return Object.freeze(tokens);
}

function staticModuleImports(bytes, label) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not UTF-8 module source`);
  }
  const tokens = moduleTokens(source, label);
  const builtins = new Set();
  const imports = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== "identifier" ||
        (token.value !== "import" && token.value !== "export")) continue;
    if (token.value === "import" &&
        tokens[index + 1]?.kind === "punctuator" &&
        tokens[index + 1].value === ".") {
      continue;
    }
    if (token.value === "import" &&
        tokens[index + 1]?.kind === "punctuator" &&
        tokens[index + 1].value === "(") {
      const specifierToken = tokens[index + 2];
      if (specifierToken?.kind !== "string" || specifierToken.escaped ||
          tokens[index + 3]?.kind !== "punctuator" ||
          tokens[index + 3].value !== ")") {
        fail(`${label} contains a nonliteral dynamic import`);
      }
      if (specifierToken.value !== "node:worker_threads") {
        fail(`${label} contains an unsupported dynamic import`);
      }
      builtins.add(specifierToken.value);
      index += 3;
      continue;
    }
    let specifierToken = null;
    if (token.value === "import" && tokens[index + 1]?.kind === "string") {
      specifierToken = tokens[index + 1];
      index += 1;
    }
    let sawFrom = false;
    for (let cursor = index + 1;
         specifierToken === null && cursor < tokens.length; cursor += 1) {
      if (tokens[cursor].kind === "identifier" &&
          tokens[cursor].value === "from") {
        sawFrom = true;
        continue;
      }
      if (sawFrom && tokens[cursor].kind === "string") {
        specifierToken = tokens[cursor];
        index = cursor;
        break;
      }
      if (tokens[cursor].kind === "punctuator" &&
          tokens[cursor].value === ";") break;
      if (tokens[cursor].kind === "identifier" &&
          (tokens[cursor].value === "import" ||
           tokens[cursor].value === "export")) break;
    }
    if (specifierToken === null || specifierToken.escaped) {
      if (token.value === "import") {
        fail(`${label} contains an unsupported import declaration`);
      }
      continue;
    }
    const specifier = specifierToken.value;
    if ((!specifier.startsWith("./") && !specifier.startsWith("../")) ||
        specifier.includes("\\") || !specifier.endsWith(".mjs")) {
      fail(`${label} imports a nonlocal or unsupported module`);
    }
    imports.add(specifier);
  }
  return Object.freeze({
    builtins: Object.freeze([...builtins].sort()),
    files: Object.freeze([...imports].sort()),
  });
}

export async function stageM7WorkerClosure({
  sourceRoot = WASM_SOURCE_ROOT,
  entryName = "cadr-worker.js",
  stageDirectory,
} = {}) {
  if (typeof stageDirectory !== "string" || stageDirectory.length === 0) {
    fail("worker stage directory is absent");
  }
  const source = resolve(sourceRoot);
  const repositoryLayout = source === resolve(WASM_SOURCE_ROOT);
  const closureRoot = repositoryLayout ? resolve(source, "..") : source;
  const entryRelative = repositoryLayout ? `wasm/${entryName}` : entryName;
  const entry = resolve(closureRoot, entryRelative);
  if (dirname(entry) !== source ||
      (entryName !== "cadr-worker.js" && !entryName.endsWith(".mjs"))) {
    fail("worker entry is outside the selected source directory");
  }
  const pending = [entryRelative];
  const loaded = new Map();
  const builtins = new Set();
  while (pending.length !== 0) {
    const name = pending.shift();
    if (loaded.has(name)) continue;
    if ((name !== entryRelative && !name.endsWith(".mjs")) ||
        name.includes("\\") || name.startsWith("../") ||
        (!repositoryLayout && name.includes("/")) ||
        (repositoryLayout && !name.startsWith("wasm/") &&
         !name.startsWith("browser/")) || name === "." || name === "..") {
      fail("worker closure contains an invalid module name");
    }
    const bound = await readBoundRegularFile(
      resolve(closureRoot, name), `worker closure ${name}`);
    loaded.set(name, bound);
    const dependencies = staticModuleImports(
      bound.bytes, `worker closure ${name}`);
    dependencies.builtins.forEach(value => builtins.add(value));
    for (const dependency of dependencies.files) {
      const dependencyPath = resolve(closureRoot, dirname(name), dependency);
      const dependencyName = relative(closureRoot, dependencyPath);
      if (dependencyPath === closureRoot || dependencyName.startsWith("../") ||
          dependencyName.includes("\\")) {
        fail(`worker closure ${name} imports outside its authority root`);
      }
      if (!loaded.has(dependencyName)) pending.push(dependencyName);
    }
  }
  await mkdir(stageDirectory, { mode: 0o700 });
  await chmod(stageDirectory, 0o700);
  await assertPrivateDirectory(stageDirectory, "M7 worker stage");
  const files = [];
  for (const name of [...loaded.keys()].sort()) {
    const bound = loaded.get(name);
    const parent = dirname(resolve(stageDirectory, name));
    if (parent !== resolve(stageDirectory)) {
      await mkdir(parent, { recursive: true, mode: 0o700 });
      await chmod(parent, 0o700);
    }
    const receipt = await writePrivateNew(
      resolve(stageDirectory, name), bound.bytes);
    if (receipt.bytes !== bound.identity.bytes ||
        receipt.sha256 !== bound.identity.sha256) {
      fail("staged worker bytes differ from their bound source");
    }
    await chmod(resolve(stageDirectory, name), 0o400);
    files.push(bound.identity);
  }
  for (const name of [...loaded.keys()].sort().reverse()) {
    const parent = dirname(resolve(stageDirectory, name));
    if (parent !== resolve(stageDirectory)) await chmod(parent, 0o500);
  }
  await chmod(stageDirectory, 0o500);
  const nodeBound = await readBoundRegularFile(
    process.execPath, "Node worker runtime");
  const node = Object.freeze({
    version: process.version,
    executable_bytes: nodeBound.identity.bytes,
    executable_sha256: nodeBound.identity.sha256,
  });
  const builtinList = Object.freeze([...builtins].sort());
  const closure = Object.freeze({
    schema: "cadr-m7-worker-source-closure-v1",
    entry: loaded.get(entryRelative).identity,
    files: Object.freeze(files),
    builtins: builtinList,
    node,
    tree_sha256: sha256(new TextEncoder().encode(canonicalJson({
      builtins: builtinList, files, node,
    }))),
  });
  return Object.freeze({
    closure,
    entryUrl: pathToFileURL(resolve(stageDirectory, entryRelative)),
  });
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
  if (options.wasm === null) options.wasm = resolve(
    ROOT, `cadr-web/build/cadr-web-m7-devid-${options.variant}.wasm`);
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

export class ProtocolV5Client {
  constructor(worker, sessionId, executionDeadline = null) {
    if (typeof sessionId !== "string" || sessionId.length === 0) fail("portable session ID is absent");
    this.worker = worker;
    this.sessionId = sessionId;
    this.nextId = 1;
    this.pending = new Map();
    this.log = [Object.freeze({ schema: "cadr-m7-portable-session-v1", session_id: sessionId })];
    this.closed = false;
    this.terminated = false;
    this.terminationPromise = null;
    this.workerTerminationPromise = null;
    this.executionDeadline = executionDeadline;
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
    const request = new Promise((resolveRequest, rejectRequest) => {
      const remaining = this.executionDeadline?.remainingMs() ??
        P4_REQUEST_TIMEOUT_MS;
      const timeoutMs = Math.min(P4_REQUEST_TIMEOUT_MS, remaining);
      if (timeoutMs === 0) {
        rejectRequest(new P4PortableDeadlineError()); return;
      }
      const timeout = timeoutMs < remaining || this.executionDeadline === null ?
        setTimeout(() => {
          this.pending.delete(id);
          rejectRequest(new Error(
            `protocol-v5 ${op} timed out after ${timeoutMs}ms`));
        }, timeoutMs) : null;
      this.pending.set(id, { timeout, op, resolve: resolveRequest, reject: rejectRequest });
      try { this.worker.postMessage({ version: M7_PROTOCOL_VERSION, id, op, ...fields }, transfer); }
      catch (error) { this.pending.delete(id); clearTimeout(timeout); rejectRequest(error); }
    });
    return this.executionDeadline === null ? request :
      this.executionDeadline.join(request);
  }

  async terminateWorkerOnce() {
    if (this.workerTerminationPromise === null) {
      this.workerTerminationPromise = Promise.resolve(this.worker.terminate())
        .then(code => { this.terminated = true; return code; });
    }
    return this.workerTerminationPromise;
  }

  async close() {
    if (this.terminated) {
      return Object.freeze({ pending_requests: 0, terminated: true });
    }
    if (this.pending.size !== 0) fail("portable worker has pending requests at termination");
    this.closed = true;
    await this.terminateWorkerOnce();
    return Object.freeze({ pending_requests: 0, terminated: true });
  }

  async terminateFailure() {
    if (this.terminationPromise !== null) return this.terminationPromise;
    if (this.terminated) {
      return Object.freeze({
        pending_requests_at_failure: 0, terminated: true,
        worker_exit_code: null,
      });
    }
    const pending = this.pending.size;
    this.terminationPromise = (async () => {
      this.#failPending(new Error("protocol-v5 worker terminated after failure"));
      this.closed = true;
      const exitCode = await this.terminateWorkerOnce();
      return Object.freeze({
        pending_requests_at_failure: pending,
        terminated: true,
        worker_exit_code: Number.isSafeInteger(exitCode) ? exitCode : null,
      });
    })();
    return this.terminationPromise;
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

function validateP4NativeBinding(value, label) {
  exactKeys(value, [
    "capture", "frame_file", "idle_file", "metadata_file", "oracle_process",
    "private_disk", "private_disk_instance_id", "process", "session_id",
    "transcript_file",
  ], label);
  if (typeof value.session_id !== "string" || value.session_id.length === 0 ||
      typeof value.private_disk_instance_id !== "string" ||
      value.private_disk_instance_id.length === 0) {
    fail(`${label} session/disk identity is absent`);
  }
  exactKeys(value.private_disk, [
    "sha256_at_end", "sha256_at_start",
  ], `${label} private disk`);
  digest(value.private_disk.sha256_at_start, `${label} private disk start`);
  digest(value.private_disk.sha256_at_end, `${label} private disk end`);
  if (value.private_disk.sha256_at_start !==
      value.private_disk.sha256_at_end) {
    fail(`${label} private disk changed`);
  }
  exactKeys(value.process, [
    "forced_stop", "pending_host_requests", "returncode",
    "state_may_be_incomplete", "timed_out",
  ], `${label} process`);
  if (value.process.returncode !== 0 || value.process.timed_out !== false ||
      value.process.forced_stop !== false ||
      value.process.state_may_be_incomplete !== false ||
      value.process.pending_host_requests !== 0) {
    fail(`${label} process did not terminate cleanly`);
  }
  exactKeys(value.oracle_process, [
    "returncode", "signal",
  ], `${label} oracle process`);
  if (value.oracle_process.returncode !== 0 ||
      value.oracle_process.signal !== null) {
    fail(`${label} oracle child did not terminate cleanly`);
  }
  exactKeys(value.capture, [
    "active_words", "backing_words", "black_on_white", "boundary",
    "byte_count", "height", "raw_words_sha256", "schema", "sha256",
    "stride_words", "tv_mode", "width",
  ], `${label} capture`);
  if (value.capture.schema !== "CDRM7N1" ||
      value.capture.boundary !== CADR_M7_FORM_C_BOUNDARY.toString()) {
    fail(`${label} capture has wrong boundary`);
  }
  digest(value.capture.sha256, `${label} capture hash`);
  digest(value.capture.raw_words_sha256, `${label} raw words hash`);
  for (const name of [
    "frame_file", "transcript_file", "idle_file", "metadata_file",
  ]) {
    privateFileIdentity(value[name], `${label} ${name}`);
  }
  if (value.capture.sha256 !== value.frame_file.sha256) {
    fail(`${label} frame identity differs from its capture`);
  }
  return value;
}

/** Validate all P4 bindings before a result can be handed to P5. */
export function validateP4Manifest(value, expected) {
  exactKeys(expected, ["bindings", "schema"], "P4 expected closure");
  if (expected.schema !== P4_EXPECTED_CLOSURE_SCHEMA) fail("P4 expected closure has wrong schema");
  exactKeys(expected.bindings, ["artifacts", "comparison", "execution_accounting",
    "execution_budget", "m6_release_record", "native", "native_inputs",
    "patches", "portable", "prepared", "schedule", "source", "summary"], "P4 expected bindings");
  exactKeys(value, ["artifacts", "comparison", "execution_accounting", "execution_budget",
    "m6_release_record", "native", "native_inputs", "outcome", "patches", "portable",
    "prepared", "runtime_execution_performed", "schedule", "schema", "session", "source",
    "summary", "target"], "P4 manifest");
  if (value.schema !== P4_SCHEMA || value.target !== P4_TARGET || value.outcome !== "identical" || value.runtime_execution_performed !== true) fail("P4 manifest has wrong status");
  validateExecutionBudget(value.execution_budget, "P4 execution budget");
  validateExecutionAccounting(value.execution_accounting, "P4 execution accounting");
  if (value.execution_accounting.limit_hit !== null ||
      value.execution_accounting.outstanding_request_id !== "0") {
    fail("successful P4 execution accounting is terminal");
  }
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
  exactKeys(value.portable, ["cdrdisp_file", "contemporaneous_adapter_observation", "effective_page_identity", "effective_page_identity_file", "execution_accounting", "execution_budget", "framebuffer_checkpoint", "host_transcript_file", "module", "ready_file", "session_evidence", "session_id", "termination", "witness_file", "worker", "worker_closure", "worker_log_file"], "P4 portable");
  validateExecutionBudget(value.portable.execution_budget,
    "P4 portable execution budget");
  validateExecutionAccounting(value.portable.execution_accounting,
    "P4 portable execution accounting");
  if (!sameJson(value.execution_budget, value.portable.execution_budget) ||
      !sameJson(value.execution_accounting, value.portable.execution_accounting)) {
    fail("P4 root and portable execution evidence differ");
  }
  exactKeys(value.portable.session_evidence, ["ready_session_id", "worker_log_session_id"], "P4 portable session evidence");
  exactKeys(value.portable.termination, ["pending_requests", "terminated"], "P4 portable termination");
  if (typeof value.portable.session_id !== "string" || value.portable.session_id.length === 0 ||
      value.portable.session_evidence.ready_session_id !== value.portable.session_id ||
      value.portable.session_evidence.worker_log_session_id !== value.portable.session_id ||
      value.portable.termination.pending_requests !== 0 || value.portable.termination.terminated !== true) {
    fail("P4 portable worker did not terminate cleanly or bind its session");
  }
  exactKeys(value.portable.effective_page_identity,
    ["collection_sha256", "count", "disposition", "first", "host_transcript_sha256", "profile", "schema"],
    "P4 effective-page identity");
  const identitySummary = value.portable.effective_page_identity;
  exactKeys(identitySummary.first,
    ["boundary", "first_block", "generation", "request_id", "transaction_id"],
    "P4 effective-page first tuple");
  digest(identitySummary.collection_sha256, "P4 effective-page collection");
  digest(identitySummary.host_transcript_sha256, "P4 effective-page transcript");
  positiveInteger(identitySummary.count, "P4 effective-page acknowledgement count");
  if (identitySummary.schema !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_SCHEMA ||
      identitySummary.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE ||
      identitySummary.disposition !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION ||
      identitySummary.count > P4_MAX_HOST_TRANSACTIONS ||
      identitySummary.first.boundary !== "1366722" ||
      identitySummary.first.first_block !== "1299" ||
      identitySummary.first.generation !== "1" ||
      identitySummary.first.request_id !== "135" ||
      identitySummary.first.transaction_id !== "135") {
    fail("P4 effective-page stream selection differs");
  }
  byteIdentity(value.portable.module, "P4 Wasm module"); byteIdentity(value.portable.worker, "P4 worker");
  workerClosureIdentity(value.portable.worker_closure,
    "P4 worker closure");
  if (!sameJson(value.portable.worker,
    value.portable.worker_closure.entry)) {
    fail("P4 worker differs from its staged closure entry");
  }
  if (!Array.isArray(value.portable.contemporaneous_adapter_observation) ||
      value.portable.contemporaneous_adapter_observation.length !== 2) {
    fail("P4 contemporaneous adapter observation is incomplete");
  }
  for (const [index, adapter] of
    value.portable.contemporaneous_adapter_observation.entries()) {
    byteIdentity(adapter, `P4 contemporaneous adapter observation ${index}`);
  }
  exactKeys(value.portable.framebuffer_checkpoint, ["boundary", "cdrdisp1_sha256", "cdrm6i1_sha256"], "P4 portable checkpoint");
  if (value.portable.framebuffer_checkpoint.boundary !== CADR_M7_FORM_C_BOUNDARY.toString()) fail("P4 portable checkpoint has wrong boundary");
  digest(value.portable.framebuffer_checkpoint.cdrdisp1_sha256, "P4 portable checkpoint frame"); digest(value.portable.framebuffer_checkpoint.cdrm6i1_sha256, "P4 portable checkpoint witness");
  privateFileIdentity(value.portable.cdrdisp_file, "P4 portable CDRDISP1", "portable/frame.cdrdisp1");
  privateFileIdentity(value.portable.witness_file, "P4 portable witness", "portable/witness.cdrm6i1");
  privateFileIdentity(value.portable.ready_file, "P4 portable ready", "portable/ready.json");
  privateFileIdentity(value.portable.worker_log_file, "P4 portable worker log", "portable/worker.ndjson");
  privateFileIdentity(value.portable.effective_page_identity_file,
    "P4 effective-page identity stream", "portable/effective-page-identity.json");
  privateFileIdentity(value.portable.host_transcript_file,
    "P4 host transcript", "portable/host-transcript.cdrm6hs1");
  if (identitySummary.collection_sha256 !==
        value.portable.effective_page_identity_file.sha256 ||
      identitySummary.host_transcript_sha256 !==
        value.portable.host_transcript_file.sha256 ||
      value.execution_accounting.host_transcript_sha256 !==
        value.portable.host_transcript_file.sha256) {
    fail("P4 effective-page sidecar hashes differ from their summary");
  }
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
    schedule: value.schedule, execution_budget: value.execution_budget,
    execution_accounting: value.execution_accounting,
    native: { session_id: value.native.session_id, private_disk_instance_id: value.native.private_disk_instance_id, private_disk: value.native.private_disk, process: value.native.process, oracle_process: value.native.oracle_process, capture: value.native.capture, frame_file: value.native.frame_file, transcript_file: value.native.transcript_file, idle_file: value.native.idle_file, metadata_file: value.native.metadata_file },
    portable: { session_id: value.portable.session_id, session_evidence: value.portable.session_evidence, module: value.portable.module, worker: value.portable.worker, worker_closure: value.portable.worker_closure, contemporaneous_adapter_observation: value.portable.contemporaneous_adapter_observation, effective_page_identity: value.portable.effective_page_identity, effective_page_identity_file: value.portable.effective_page_identity_file, host_transcript_file: value.portable.host_transcript_file, execution_budget: value.portable.execution_budget, execution_accounting: value.portable.execution_accounting, termination: value.portable.termination, framebuffer_checkpoint: value.portable.framebuffer_checkpoint, cdrdisp_file: value.portable.cdrdisp_file, witness_file: value.portable.witness_file, ready_file: value.portable.ready_file, worker_log_file: value.portable.worker_log_file },
    comparison: value.comparison, summary: value.summary,
  };
}

export function validateP4FailureReceipts(root, portable, expected) {
  exactKeys(expected, ["portable", "root"], "P4 failure expected closure");
  exactKeys(root, [
    "artifacts", "error_message", "error_name", "execution_accounting",
    "execution_budget", "m6_release_record",
    "native", "native_inputs", "outcome", "patches", "portable_failure_file",
    "prepared", "runtime_execution_performed", "schedule", "schema",
    "session", "source", "target",
  ], "P4 root failure");
  exactKeys(portable, [
    "checkpoint", "contemporaneous_adapter_observation", "error_message", "error_name",
    "checkpoint_comparison_file", "execution_accounting", "execution_budget",
    "host_transcript_file", "m6_failure_file", "m6_release_record",
    "module", "schema", "session_id", "target", "termination", "worker",
    "worker_closure", "worker_disposition", "worker_log_file",
  ], "P4 portable failure");
  if (root.schema !== P4_ROOT_FAILURE_SCHEMA ||
      root.target !== P4_TARGET || root.outcome !== "failed" ||
      root.runtime_execution_performed !== true ||
      portable.schema !== P4_PORTABLE_FAILURE_SCHEMA ||
      portable.target !== P4_TARGET ||
      typeof root.error_name !== "string" ||
      typeof root.error_message !== "string" ||
      typeof portable.error_name !== "string" ||
      typeof portable.error_message !== "string" ||
      root.error_name !== portable.error_name ||
      root.error_message !== portable.error_message ||
      !sameJson(root.m6_release_record, portable.m6_release_record)) {
    fail("P4 failure receipts have the wrong status or error binding");
  }
  validateExecutionBudget(root.execution_budget, "P4 root failure budget");
  validateExecutionBudget(portable.execution_budget,
    "P4 portable failure budget");
  validateExecutionAccounting(root.execution_accounting,
    "P4 root failure accounting");
  validateExecutionAccounting(portable.execution_accounting,
    "P4 portable failure accounting");
  if (!sameJson(root.execution_budget, portable.execution_budget) ||
      !sameJson(root.execution_accounting, portable.execution_accounting)) {
    fail("P4 failure execution bindings differ");
  }
  exactKeys(root.session, ["id", "mode"], "P4 failure session");
  if (typeof root.session.id !== "string" || root.session.id.length === 0 ||
      root.session.mode !== "0700" ||
      typeof portable.session_id !== "string" ||
      portable.session_id.length === 0) {
    fail("P4 failure session identity is invalid");
  }
  privateFileIdentity(root.portable_failure_file,
    "P4 portable failure file", "portable/failure.json");
  validateP4NativeBinding(root.native, "P4 failure native");
  if (portable.worker_disposition === "worker-not-started") {
    if (portable.termination !== null ||
        portable.m6_failure_file !== null || portable.host_transcript_file !== null ||
        portable.checkpoint !== null || portable.checkpoint_comparison_file !== null ||
        (portable.module !== null && typeof portable.module !== "object") ||
        (portable.worker !== null && typeof portable.worker !== "object") ||
        (portable.worker_closure !== null && typeof portable.worker_closure !== "object")) {
      fail("P4 setup failure has a forged worker disposition");
    }
    if (portable.module !== null) byteIdentity(portable.module, "P4 setup module");
    if (portable.worker !== null) byteIdentity(portable.worker, "P4 setup worker");
    if (portable.worker_closure !== null) workerClosureIdentity(
      portable.worker_closure, "P4 setup worker closure");
  } else if (portable.worker_disposition === "worker-terminated") {
    byteIdentity(portable.module, "P4 failure module");
    byteIdentity(portable.worker, "P4 failure worker");
    workerClosureIdentity(portable.worker_closure, "P4 failure worker closure");
    if (!sameJson(portable.worker, portable.worker_closure.entry)) {
      fail("P4 failure worker differs from its staged closure entry");
    }
  } else {
    fail("P4 failure worker disposition is invalid");
  }
  if (portable.worker_disposition === "worker-not-started" &&
      portable.contemporaneous_adapter_observation === null) {
    /* The concurrent setup group did not produce this identity. */
  } else if (!Array.isArray(portable.contemporaneous_adapter_observation) ||
      portable.contemporaneous_adapter_observation.length !== 2) {
    fail("P4 failure contemporaneous adapter observation is incomplete");
  }
  portable.contemporaneous_adapter_observation?.forEach((value, index) =>
    byteIdentity(value, `P4 failure contemporaneous adapter observation ${index}`));
  byteIdentity(portable.m6_release_record, "P4 failure release record");
  privateFileIdentity(portable.worker_log_file,
    "P4 failure worker log", "worker.ndjson");
  if (portable.m6_failure_file !== null) {
    privateFileIdentity(portable.m6_failure_file,
      "P4 bounded M6 failure", "m6-failure.json");
  } else if (portable.error_name === "CadrM7UnderlyingM6Failure") {
    fail("P4 underlying M6 failure has no bounded diagnostic");
  }
  if (portable.host_transcript_file !== null) {
    privateFileIdentity(portable.host_transcript_file,
      "P4 full failure host transcript", "failure-host-transcript.cdrm6hs1");
    if (portable.host_transcript_file.sha256 !==
        portable.execution_accounting.host_transcript_sha256) {
      fail("P4 failure host transcript identity differs from accounting");
    }
  }
  if (portable.worker_disposition === "worker-terminated") exactKeys(portable.termination, [
    "pending_requests_at_failure", "terminated", "worker_exit_code",
  ], "P4 failure termination");
  if (portable.worker_disposition === "worker-terminated" &&
      (!Number.isSafeInteger(portable.termination.pending_requests_at_failure) ||
      portable.termination.pending_requests_at_failure < 0 ||
      portable.termination.terminated !== true ||
      (portable.termination.worker_exit_code !== null &&
       !Number.isSafeInteger(portable.termination.worker_exit_code)))) {
    fail("P4 failure worker did not terminate with bounded accounting");
  }
  if (portable.checkpoint !== null) {
    exactKeys(portable.checkpoint, [
      "boundary", "frame_file", "m6_release_record_sha256", "witness_file",
    ], "P4 failure checkpoint");
    canonicalU64(portable.checkpoint.boundary, "P4 failure checkpoint boundary");
    digest(portable.checkpoint.m6_release_record_sha256,
      "P4 failure checkpoint release record");
    if (portable.checkpoint.m6_release_record_sha256 !==
        portable.m6_release_record.sha256) {
      fail("P4 failure checkpoint has the wrong release identity");
    }
    privateFileIdentity(portable.checkpoint.frame_file,
      "P4 failure frame", "failure-frame.cdrdisp1");
    privateFileIdentity(portable.checkpoint.witness_file,
      "P4 failure witness", "failure-witness.cdrm6i1");
  }
  if (portable.checkpoint_comparison_file !== null) {
    privateFileIdentity(portable.checkpoint_comparison_file,
      "P4 failure checkpoint comparison", "failure-comparison.json");
    if (portable.checkpoint === null) {
      fail("P4 failure comparison has no retained checkpoint");
    }
  } else if (portable.checkpoint !== null) {
    fail("P4 failure checkpoint has no retained comparison");
  }
  if (!sameJson(root, expected.root) ||
      !sameJson(portable, expected.portable)) {
    fail("P4 failure receipt differs from the independent expected closure");
  }
  return root;
}

export function validateP4FailureTranscriptBinding(portable,
  m6FailureBytes, hostTranscriptBytes) {
  if (!(m6FailureBytes instanceof Uint8Array)) {
    fail("P4 M6 failure bytes are absent");
  }
  const diagnostic = parseCanonicalJsonBytes(
    m6FailureBytes, "P4 retained M6 failure").value;
  const report = diagnostic?.failure?.report;
  const postPreflight = report?.phase !== "preflight";
  if (portable.m6_failure_file === null ||
      portable.m6_failure_file.bytes !== m6FailureBytes.byteLength ||
      portable.m6_failure_file.sha256 !== sha256(m6FailureBytes)) {
    fail("P4 retained M6 failure identity differs");
  }
  if (!postPreflight) {
    if (portable.host_transcript_file !== null || hostTranscriptBytes !== null) {
      fail("P4 preflight failure invented a host transcript sidecar");
    }
    return diagnostic;
  }
  if (!(hostTranscriptBytes instanceof Uint8Array) ||
      portable.host_transcript_file === null ||
      portable.host_transcript_file.bytes !== hostTranscriptBytes.byteLength ||
      portable.host_transcript_file.sha256 !== sha256(hostTranscriptBytes)) {
    fail("P4 post-preflight failure host transcript identity differs");
  }
  const parsed = parseP4HostTranscript(hostTranscriptBytes,
    diagnostic.failure.preflight.artifactSetSha256);
  if (String(parsed.recordCount) !== String(report.transcriptCount) ||
      sha256(hostTranscriptBytes) !== report.hostTranscriptSha256 ||
      sha256(hostTranscriptBytes) !==
        portable.execution_accounting.host_transcript_sha256 ||
      String(parsed.recordCount) !==
        portable.execution_accounting.transcript_record_count ||
      String(parsed.recordCount / 2) !==
        portable.execution_accounting.completed_host_transactions ||
      !sameJson(parsed.records.slice(-diagnostic.failure.transcriptTail.length),
        diagnostic.failure.transcriptTail)) {
    fail("P4 failure transcript/accounting/tail binding differs");
  }
  const machine = report.machineInfo;
  if (machine !== null &&
      (portable.execution_accounting.final_boundary !== String(report.boundary) ||
       portable.execution_accounting.last_completed_request_id !==
         String(machine.lastCompletedRequestId) ||
       portable.execution_accounting.outstanding_request_id !==
         String(machine.outstandingRequestId))) {
    fail("P4 failure machine accounting differs");
  }
  return diagnostic;
}

export async function writeP4PortableFailureEvidence({
  portableDirectory,
  caught,
  nativeFrame,
  sessionId,
  module,
  worker,
  workerClosure,
  contemporaneousAdapterObservation,
  m6ReleaseRecord,
  executionBudget,
  executionAccounting,
  failureHostTranscript,
  retainFailureHostTranscript,
  termination,
  workerLogBytes,
}) {
  if (!(workerLogBytes instanceof Uint8Array)) {
    fail("P4 failure worker log is not a byte sequence");
  }
  const workerLogFile = await writePrivateNew(
    resolve(portableDirectory, "worker.ndjson"), workerLogBytes);
  let m6FailureFile = null;
  if (caught?.m6FailureDiagnostic instanceof Uint8Array) {
    m6FailureFile = await writePrivateNew(
      resolve(portableDirectory, "m6-failure.json"),
      caught.m6FailureDiagnostic);
  }
  let hostTranscriptFile = null;
  if (retainFailureHostTranscript === true) {
    parseP4HostTranscript(failureHostTranscript);
    if (sha256(failureHostTranscript) !==
        executionAccounting.host_transcript_sha256) {
      fail("P4 failure host transcript differs from execution accounting");
    }
    hostTranscriptFile = await writePrivateNew(
      resolve(portableDirectory, "failure-host-transcript.cdrm6hs1"),
      failureHostTranscript);
  }
  let checkpoint = null;
  let checkpointComparisonFile = null;
  if (caught?.checkpoint !== null && caught?.checkpoint !== undefined) {
    const frameFile = await writePrivateNew(
      resolve(portableDirectory, "failure-frame.cdrdisp1"),
      caught.checkpoint.display_record);
    const witnessFile = await writePrivateNew(
      resolve(portableDirectory, "failure-witness.cdrm6i1"),
      caught.checkpoint.witness_sample);
    checkpoint = Object.freeze({
      boundary: caught.checkpoint.boundary.toString(),
      m6_release_record_sha256:
        Buffer.from(caught.checkpoint.m6_release_record_sha256).toString("hex"),
      frame_file: Object.freeze({
        path: "failure-frame.cdrdisp1", ...frameFile,
      }),
      witness_file: Object.freeze({
        path: "failure-witness.cdrm6i1", ...witnessFile,
      }),
    });
    let comparison;
    try {
      comparison = await compareM7FrameCheckpoint(
        nativeFrame, caught.checkpoint);
    } catch (error) {
      if (error?.name !== "CadrM7FrameMismatch" ||
          error?.report === null || typeof error?.report !== "object") {
        throw error;
      }
      comparison = Object.freeze({
        schema: "cadr-m7-failed-run-frame-comparison-v1",
        outcome: "different",
        first_difference: error.report,
      });
    }
    checkpointComparisonFile = await writePrivateNew(
      resolve(portableDirectory, "failure-comparison.json"), comparison);
  }
  const failure = Object.freeze({
    schema: P4_PORTABLE_FAILURE_SCHEMA,
    target: P4_TARGET,
    session_id: sessionId,
    error_name: typeof caught?.name === "string" ? caught.name : "Error",
    error_message: String(caught?.message ?? caught),
    module: module ?? null,
    worker: worker ?? null,
    worker_closure: workerClosure ?? null,
    contemporaneous_adapter_observation:
      contemporaneousAdapterObservation ?? null,
    m6_release_record: m6ReleaseRecord,
    execution_budget: executionBudget,
    execution_accounting: executionAccounting,
    m6_failure_file: m6FailureFile === null ? null : Object.freeze({
      path: "m6-failure.json", ...m6FailureFile,
    }),
    host_transcript_file: hostTranscriptFile === null ? null : Object.freeze({
      path: "failure-host-transcript.cdrm6hs1", ...hostTranscriptFile,
    }),
    checkpoint,
    checkpoint_comparison_file:
      checkpointComparisonFile === null ? null : Object.freeze({
        path: "failure-comparison.json", ...checkpointComparisonFile,
      }),
    worker_log_file: Object.freeze({
      path: "worker.ndjson", ...workerLogFile,
    }),
    termination,
    worker_disposition: termination === null ? "worker-not-started" : "worker-terminated",
  });
  const failureFile = await writePrivateNew(
    resolve(portableDirectory, "failure.json"), failure);
  const failureInfo = await readCanonicalJson(
    resolve(portableDirectory, "failure.json"), "P4 portable failure");
  if (!sameJson(failureInfo.value, failure)) {
    fail("P4 portable failure bytes differ from the retained receipt");
  }
  if (m6FailureFile !== null) {
    validateP4FailureTranscriptBinding(failureInfo.value,
      caught.m6FailureDiagnostic,
      retainFailureHostTranscript === true ? failureHostTranscript : null);
  }
  return Object.freeze({
    failure: failureInfo.value,
    failureFile: Object.freeze({
      path: "portable/failure.json", ...failureFile,
    }),
  });
}

async function portableCheckpoint({ nativeFrame, pinned, wasmPath, artifactRoot, portableDirectory, sessionId }) {
  /* The fixed budget starts before source staging and compilation.  It is not
   * a CLI option and has no resume or extension path. */
  const executionBudget = p4ExecutionBudgetRecord();
  const deadline = new P4PortableExecutionDeadline();
  let wasmBound; let wasmIdentity; let workerStage; let workerIdentity;
  let contemporaneousAdapterObservation; let module; let artifacts = null;
  let client = null;
  try {
    const wasmPromise = readBoundRegularFile(wasmPath, "M7 Wasm module")
      .then(value => { wasmBound = value; wasmIdentity = value.identity; return value; });
    const stagePromise = stageM7WorkerClosure({
      stageDirectory: resolve(portableDirectory, "worker-stage"),
    }).then(value => { workerStage = value; workerIdentity = value.closure.entry; return value; });
    const adapterPromise = Promise.all(ADAPTER_PATHS.map(path =>
      fileIdentity(path, "M7 contemporaneous Wasm adapter observation")))
      .then(value => { contemporaneousAdapterObservation = value; return value; });
    const setupResults = await deadline.join(Promise.allSettled(
      [wasmPromise, stagePromise, adapterPromise]));
    const rejectedSetup = setupResults.find(result => result.status === "rejected");
    if (rejectedSetup !== undefined) throw rejectedSetup.reason;
    wasmIdentity = wasmBound.identity;
    workerIdentity = workerStage.closure.entry;
    module = await deadline.join(WebAssembly.compile(wasmBound.bytes));
    const artifactsPromise = openArtifacts(pinned.expected, artifactRoot)
      .then(value => { artifacts = value; return value; });
    await deadline.join(artifactsPromise);
    client = new ProtocolV5Client(
      new Worker(workerStage.entryUrl, { type: "module" }), sessionId, deadline);
    deadline.attachTerminator(() => {
      void client.terminateFailure().catch(() => {});
    });
  } catch (error) {
    if (client !== null) await client.terminateFailure().catch(() => {});
    if (artifacts !== null) await artifacts.close();
    const elapsedMs = deadline.close();
    if (client === null) {
      if (error?.p4TerminalCause === undefined) {
        Object.defineProperty(error, "p4TerminalCause", {
          value: deadline.terminalCause, enumerable: true, configurable: true,
        });
      }
      const failureExecution = failureExecutionEvidence(
        error, elapsedMs, deadline.terminalCause);
      const written = await writeP4PortableFailureEvidence({
        portableDirectory, caught: error, nativeFrame, sessionId,
        module: wasmIdentity ?? null, worker: workerIdentity ?? null,
        workerClosure: workerStage?.closure ?? null,
        contemporaneousAdapterObservation,
        m6ReleaseRecord: Object.freeze({
          path: relative(ROOT, RELEASE_PATH),
          bytes: pinned.release.bytes.byteLength,
          sha256: sha256(pinned.release.bytes),
        }),
        executionBudget,
        executionAccounting: failureExecution.accounting,
        failureHostTranscript: failureExecution.hostTranscript,
        retainFailureHostTranscript: false,
        termination: null,
        workerLogBytes: new TextEncoder().encode(
          `${canonicalJson({ schema: "cadr-m7-portable-session-v1", session_id: sessionId })}\n`),
      });
      error.portableFailure = written.failure;
      error.portableFailureFile = written.failureFile;
    }
    throw error;
  }
  let termination = null;
  let caught = null;
  let elapsedMs = null;
  try {
    const instantiate = await client.request("instantiate", {
      module, m6DiskEvidencePolicy: true,
    });
    if (instantiate.status !== 0) fail(`protocol-v5 M7 instantiation failed with status ${instantiate.status}`);
    const profile = profileForM6(pinned.profile, pinned.expected);
    const hashP4Artifact = async artifact => {
      const digest = createHash("sha256");
      for (let offset = 0n; offset < artifact.byteCount; offset += 1_048_576n) {
        const length = artifact.byteCount - offset < 1_048_576n ?
          artifact.byteCount - offset : 1_048_576n;
        const bytes = await deadline.join(artifact.readRange(offset, length));
        if (!(bytes instanceof Uint8Array) || BigInt(bytes.byteLength) !== length) {
          fail("P4 artifact source returned a short range");
        }
        digest.update(bytes);
      }
      return new Uint8Array(digest.digest());
    };
    const checked = await preflightM6Artifacts({
      artifacts: artifacts.artifacts, profile, hashArtifact: hashP4Artifact,
    });
    const result = await runM7CheckpointedM6Boot({
      nativeCapture: nativeFrame,
      client,
      artifacts: checked.sources,
      profile,
      hashArtifact: hashP4Artifact,
      maxBoundaries: readyLimit(pinned.release.value),
      maxHostTransactions: P4_MAX_HOST_TRANSACTIONS,
      ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT, releaseRecord: pinned.release.bytes.slice() }),
    });
    if (result.comparison.outcome !== "identical") fail("M7 portable comparison did not report identity");
    const frame = result.checkpoint.display_record;
    const witness = result.checkpoint.witness_sample;
    const identityStream = result.identityStream;
    const identityStreamSha256 = result.identityStreamSha256;
    const firstAcknowledgement = identityStream?.acknowledgements?.[0];
    if (identityStream?.disposition !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_STREAM_DISPOSITION ||
        identityStream.profile !== CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE ||
        firstAcknowledgement?.request?.request_id !== 135n ||
        firstAcknowledgement.request?.transaction_id !== 135n ||
        firstAcknowledgement.request?.first_block !== 1299n ||
        firstAcknowledgement.request?.issue_boundary !== 1366722n ||
        !(identityStreamSha256 instanceof Uint8Array) ||
        identityStreamSha256.byteLength !== 32) {
      fail("selected P4 effective-page stream differs");
    }
    const identityStreamBytes = serializeM7EffectivePageIdentityStream(identityStream);
    const hostTranscript = result.m6.hostTranscript;
    const effectivePageIdentity = Object.freeze({
      schema: identityStream.schema, profile: identityStream.profile,
      disposition: identityStream.disposition, count: identityStream.count,
      collection_sha256: Buffer.from(identityStreamSha256).toString("hex"),
      host_transcript_sha256: sha256(hostTranscript),
      first: Object.freeze({ generation: "1", request_id: "135",
        transaction_id: "135", first_block: "1299", boundary: "1366722" }),
    });
    const ready = Object.freeze({ session_id: sessionId, outcome: result.m6.outcome,
      boundary: result.checkpoint.boundary.toString(),
      effective_page_identity: effectivePageIdentity,
      m6_release_record_sha256: result.comparison.m6_release_record_sha256,
      m6_witness_sample_sha256: result.comparison.m6_witness_sample_sha256 });
    const frameFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "frame.cdrdisp1"), frame));
    const witnessFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "witness.cdrm6i1"), witness));
    const readyFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "ready.json"), ready));
    const identityStreamFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "effective-page-identity.json"), identityStreamBytes));
    const hostTranscriptFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "host-transcript.cdrm6hs1"), hostTranscript));
    const workerLogFile = await deadline.join(writePrivateNew(
      resolve(portableDirectory, "worker.ndjson"),
      new TextEncoder().encode(`${client.log.map(entry => canonicalJson(entry)).join("\n")}\n`)));
    termination = await deadline.join(client.close());
    elapsedMs = deadline.close();
    const parsedTranscript = parseP4HostTranscript(hostTranscript,
      Buffer.from(checked.artifactSetSha256).toString("hex"));
    if (parsedTranscript.recordCount !== result.m6.transcript.length) {
      fail("P4 successful transcript count differs from the M6 result");
    }
    const executionAccounting = p4Accounting({
      hostTranscript, elapsedMs,
      finalBoundary: result.m6.boundary,
      lastCompletedRequestId: result.m6.machineInfo.lastCompletedRequestId,
      outstandingRequestId: result.m6.machineInfo.outstandingRequestId,
      limitHit: null,
    });
    return Object.freeze({ result, sessionId: ready.session_id, workerLogSessionId: client.sessionId,
      module: wasmIdentity, worker: workerIdentity,
      contemporaneousAdapterObservation,
      workerClosure: workerStage.closure,
      executionBudget, executionAccounting,
      frameFile, witnessFile, readyFile, identityStreamFile, hostTranscriptFile,
      workerLogFile, termination, ready });
  } catch (error) {
    if (deadline.terminalCause !== null &&
        error?.p4TerminalCause === undefined) {
      Object.defineProperty(error, "p4TerminalCause", {
        value: deadline.terminalCause, enumerable: true, configurable: true,
      });
    }
    caught = error;
  } finally {
    if (termination === null) {
      termination = caught === null ?
        await client.close() : await client.terminateFailure();
    }
    await artifacts.close();
    if (elapsedMs === null) elapsedMs = deadline.close();
  }
  const failureExecution = failureExecutionEvidence(
    caught, elapsedMs, caught?.p4TerminalCause ?? deadline.terminalCause);
  const written = await writeP4PortableFailureEvidence({
    portableDirectory,
    caught,
    nativeFrame,
    sessionId,
    module: wasmIdentity,
    worker: workerIdentity,
    workerClosure: workerStage.closure,
    contemporaneousAdapterObservation,
    m6ReleaseRecord: Object.freeze({
      path: relative(ROOT, RELEASE_PATH),
      bytes: pinned.release.bytes.byteLength,
      sha256: sha256(pinned.release.bytes),
    }),
    executionBudget,
    executionAccounting: failureExecution.accounting,
    failureHostTranscript: failureExecution.hostTranscript,
    retainFailureHostTranscript: failureExecution.retainTranscript,
    termination,
    workerLogBytes: new TextEncoder().encode(
      `${client.log.map(entry => canonicalJson(entry)).join("\n")}\n`),
  });
  caught.portableFailure = written.failure;
  caught.portableFailureFile = written.failureFile;
  throw caught;
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
  let failureContext = null;
  try {
    const parentNativeInputs = await loadParentNativeInputs(
      options.prepared, pinned, nativeSessionId, diskId);
    const nativeChild = await runNativeCapture({ prepared: options.prepared, nativeConfig: options.nativeConfig,
      output: nativeDirectory, sessionId: nativeSessionId, diskId });
    for (const name of ["frame.cdrm7n1", "capture.ndjson", "idle.bin", "metadata.json"]) {
      await assertPrivateFile(resolve(nativeDirectory, name), `native ${name}`);
    }
    const nativeNames = [
      "frame.cdrm7n1", "capture.ndjson", "idle.bin", "metadata.json",
    ];
    const nativeBound = await Promise.all(nativeNames.map(name =>
      readBoundRegularFile(
        resolve(nativeDirectory, name), `native ${name}`)));
    const nativeFiles = nativeBound.map(item => item.identity);
    const nativeInfo = parseCanonicalJsonBytes(
      nativeBound[3].bytes, "native M7 metadata");
    const native = nativeMetadata(nativeInfo.value, sha256(pinned.release.bytes));
    const nativeFrame = nativeBound[0].bytes.slice();
    const expectedNativeMetadata = { schema: "cadr-m7-native-frame-capture-v1",
      target: P4_TARGET, ...structuredClone(parentNativeInputs),
      capture: parseNativeFrame(nativeFrame),
      transcript: { sha256: sha256(nativeBound[1].bytes),
        idle_samples_sha256: sha256(nativeBound[2].bytes) } };
    if (!sameJson(native, expectedNativeMetadata) ||
        !sameJson(nativeChild.response.metadata, expectedNativeMetadata)) {
      fail("native child metadata differs from parent-known inputs and fresh receipts");
    }
    const nativeBinding = { session_id: native.session_id,
      private_disk_instance_id: native.private_disk_instance_id,
      private_disk: native.private_disk, process: native.process,
      oracle_process: nativeChild.oracle_process, capture: native.capture,
      frame_file: nativeFiles[0], transcript_file: nativeFiles[1],
      idle_file: nativeFiles[2], metadata_file: nativeFiles[3] };
    failureContext = Object.freeze({
      parentNativeInputs, native, nativeBinding,
    });
    const portable = await portableCheckpoint({ nativeFrame, pinned, wasmPath: options.wasm,
      artifactRoot: options.artifactRoot, portableDirectory, sessionId: portableSessionId });
    const comparison = portable.result.comparison;
    const comparisonFile = await writePrivateNew(resolve(session.path, "comparison.json"), comparison);
    const comparisonInfo = await readCanonicalJson(resolve(session.path, "comparison.json"), "P4 comparison");
    if (!sameJson(comparisonInfo.value, comparison)) fail("fresh P4 comparison bytes differ from the checkpoint result");
    const portableBinding = { session_id: portable.sessionId,
      session_evidence: { ready_session_id: portable.ready.session_id,
        worker_log_session_id: portable.workerLogSessionId },
      module: portable.module, worker: portable.worker,
      worker_closure: portable.workerClosure,
      contemporaneous_adapter_observation:
        portable.contemporaneousAdapterObservation,
      execution_budget: portable.executionBudget,
      execution_accounting: portable.executionAccounting,
      effective_page_identity: portable.ready.effective_page_identity,
      framebuffer_checkpoint: { boundary: comparison.boundary,
        cdrdisp1_sha256: comparison.portable_record_sha256,
        cdrm6i1_sha256: comparison.m6_witness_sample_sha256 },
      cdrdisp_file: { path: "portable/frame.cdrdisp1", ...portable.frameFile },
      witness_file: { path: "portable/witness.cdrm6i1", ...portable.witnessFile },
      ready_file: { path: "portable/ready.json", ...portable.readyFile },
      effective_page_identity_file: { path: "portable/effective-page-identity.json",
        ...portable.identityStreamFile },
      host_transcript_file: { path: "portable/host-transcript.cdrm6hs1",
        ...portable.hostTranscriptFile },
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
        execution_budget: portable.executionBudget,
        execution_accounting: portable.executionAccounting,
        native: expectedNative, portable: expectedPortable,
        comparison: expectedComparison, summary: expectedSummary,
      }),
    };
    const manifest = {
      schema: P4_SCHEMA, target: P4_TARGET, outcome: "identical", runtime_execution_performed: true,
      session: { id: session.id, mode: "0700" }, source: native.source,
      m6_release_record: native.m6_release_record, patches: native.patches, prepared: native.prepared,
      artifacts: native.artifacts, native_inputs: native.native_inputs, schedule: native.schedule,
      execution_budget: portable.executionBudget,
      execution_accounting: portable.executionAccounting,
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
    if (failureContext !== null && error?.portableFailureFile !== undefined) {
      const parent = failureContext.parentNativeInputs;
      const rootFailure = Object.freeze({
        schema: P4_ROOT_FAILURE_SCHEMA,
        target: P4_TARGET,
        outcome: "failed",
        runtime_execution_performed: true,
        session: Object.freeze({ id: session.id, mode: "0700" }),
        source: failureContext.native.source,
        m6_release_record: failureContext.native.m6_release_record,
        patches: failureContext.native.patches,
        prepared: failureContext.native.prepared,
        artifacts: failureContext.native.artifacts,
        native_inputs: failureContext.native.native_inputs,
        schedule: parent.schedule,
        execution_budget: error.portableFailure.execution_budget,
        execution_accounting: error.portableFailure.execution_accounting,
        native: failureContext.nativeBinding,
        portable_failure_file: error.portableFailureFile,
        error_name: typeof error?.name === "string" ? error.name : "Error",
        error_message: String(error?.message ?? error),
      });
      await writePrivateNew(resolve(session.path, "failure.json"), rootFailure);
      const [rootInfo, portableInfo] = await Promise.all([
        readCanonicalJson(
          resolve(session.path, "failure.json"), "P4 root failure"),
        readCanonicalJson(
          resolve(portableDirectory, "failure.json"),
          "P4 portable failure"),
      ]);
      validateP4FailureReceipts(
        rootInfo.value, portableInfo.value,
        Object.freeze({ root: rootFailure, portable: error.portableFailure }));
      const names = (await readdir(session.path)).sort();
      if (!sameJson(names, ["failure.json", "native", "portable"])) {
        fail("P4 failed session has an unexpected top-level sidecar");
      }
    }
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
