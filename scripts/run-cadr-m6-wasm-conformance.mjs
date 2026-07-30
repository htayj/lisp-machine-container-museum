#!/usr/bin/env node
/*
 * Execute the production C-M6 driver against three fresh protocol-v4 Wasm
 * workers.  This is deliberately not a fixture runner: it admits only the
 * exact tracked native-release JSON bytes which the production driver hashes
 * against its compiled digest, and it reads the five local System 303 inputs
 * named by the CADR-WEB-303 profile.
 *
 * The runner never writes a disk image or snapshot.  The M6 driver snapshots
 * each verified artifact in memory and gives each run its own M4 overlay.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  link,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_PROTOCOL_VERSION,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  canonicalM6FailureDiagnostic,
  preflightM6Artifacts,
  runM6HeadlessBootConformance,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_RELATIVE_PATH = "cadr-web/build/cadr-web-m5-O0.wasm";
const WORKER_URL = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const PROFILE_RELATIVE_PATH = "cadr-web/profiles/cadr-web-303.json";
const RELEASE_RELATIVE_PATH = "cadr-web/oracle/cadr-m6-release-record.json";
const DEFAULT_OUTPUT_RELATIVE_PATH =
  "cadr-web/oracle/cadr-m6-wasm-conformance.json";
const REQUEST_TIMEOUT_MS = 120_000;
const REQUIRED_KINDS = Object.freeze([1, 2, 4, 5, 3]);
const SOURCE_LAYOUT = Object.freeze([
  { kind: 1, id: "cadr-web-303-runnable-template", localPath: "cadr-web/profiles/cadr-web-303.ini.in" },
  { kind: 2, id: "prom-control-store", localPath: "l/sys/ubin/promh.mcr" },
  { kind: 4, id: "prom-symbols", localPath: "l/sys/ubin/promh.sym" },
  { kind: 5, id: "microcode-symbols", localPath: "l/sys/ubin/ucadr.sym" },
  { kind: 3, id: "system-303-0-base-disk", localPath: "l/usim/disk-sys-303-0.img" },
]);

function fail(message) {
  throw new Error(`C-M6 Wasm conformance: ${message}`);
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function sha256Hex(bytes) {
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

function parseArguments(argv) {
  const options = {
    artifactRoot: ROOT,
    build: true,
    negativeOnly: false,
    output: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--no-build") {
      options.build = false;
    } else if (argument === "--artifact-root") {
      const value = argv[++index];
      if (typeof value !== "string" || value.length === 0) {
        fail("--artifact-root requires a repository root pathname");
      }
      options.artifactRoot = resolve(value);
    } else if (argument === "--negative-only") {
      options.negativeOnly = true;
    } else if (argument === "--output") {
      const value = argv[++index];
      if (typeof value !== "string" || value.length === 0) {
        fail("--output requires a pathname");
      }
      options.output = resolve(ROOT, value);
    } else if (argument === "--help" || argument === "-h") {
      console.log("usage: node scripts/run-cadr-m6-wasm-conformance.mjs [--artifact-root ROOT] [--no-build] [--negative-only] [--output PATH]");
      console.log("\nRuns the production M6 driver against three fresh Wasm workers and writes canonical evidence.");
      process.exit(0);
    } else {
      fail(`unknown argument ${JSON.stringify(argument)}`);
    }
  }
  return options;
}

function protocolError(label, message) {
  return new Error(`protocol-v4 ${label}: ${message}`);
}

class ProtocolV4Client {
  constructor(worker, label) {
    this.worker = worker;
    this.label = label;
    this.nextId = 1;
    this.requests = [];
    this.responses = [];
    this.pending = new Map();
    this.closed = false;
    worker.on("message", message => this.onMessage(message));
    worker.on("error", error => this.failPending(error));
    worker.on("exit", code => {
      if (!this.closed && code !== 0) {
        this.failPending(protocolError(this.label, `worker exited with ${code}`));
      }
    });
  }

  onMessage(message) {
    const pending = this.pending.get(message?.id);
    if (pending === undefined) {
      this.failPending(protocolError(this.label, "received an unsolicited response"));
      return;
    }
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    this.responses.push(Object.freeze({
      id: message.id,
      op: pending.op,
      status: Number.isSafeInteger(message?.status) ? message.status : null,
    }));
    if (message?.type !== "cadr-response" || message.version !== CADR_M6_PROTOCOL_VERSION ||
        message.op !== pending.op || !Number.isSafeInteger(message.status)) {
      pending.reject(protocolError(this.label, `malformed response for ${pending.op}`));
      return;
    }
    pending.resolve(message);
  }

  failPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(op, fields = {}, transfer = []) {
    if (this.closed) return Promise.reject(protocolError(this.label, "request after close"));
    const id = this.nextId++;
    this.requests.push(Object.freeze({ id, op }));
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectRequest(protocolError(this.label, `${op} timed out after ${REQUEST_TIMEOUT_MS} ms`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { op, timeout, resolve: resolveRequest, reject: rejectRequest });
      try {
        this.worker.postMessage({
          version: CADR_M6_PROTOCOL_VERSION,
          id,
          op,
          ...fields,
        }, transfer);
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        rejectRequest(error);
      }
    });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.failPending(protocolError(this.label, "worker closed"));
    await this.worker.terminate();
  }
}

class LocalArtifactSet {
  constructor(items) {
    this.items = items;
  }

  get artifacts() {
    return this.items.map(item => item.artifact);
  }

  async close() {
    await Promise.all(this.items.map(async item => {
      try {
        await item.handle.close();
      } catch (error) {
        if (error?.code !== "EBADF") throw error;
      }
    }));
  }
}

async function hashArtifact(artifact) {
  const hash = createHash("sha256");
  const limit = 1_048_576n;
  for (let offset = 0n; offset < artifact.byteCount; offset += limit) {
    const byteCount = artifact.byteCount - offset < limit ?
      artifact.byteCount - offset : limit;
    const chunk = await artifact.readRange(offset, byteCount);
    if (!(chunk instanceof Uint8Array) || BigInt(chunk.byteLength) !== byteCount) {
      fail("artifact source returned a short range while hashing");
    }
    hash.update(chunk);
  }
  return new Uint8Array(hash.digest());
}

async function loadReleaseAndProfile() {
  const [releaseBytes, profileText] = await Promise.all([
    readFile(resolve(ROOT, RELEASE_RELATIVE_PATH)),
    readFile(resolve(ROOT, PROFILE_RELATIVE_PATH), "utf8"),
  ]);
  let releaseRecord;
  let profile;
  try {
    releaseRecord = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(releaseBytes));
    profile = JSON.parse(profileText);
  } catch (error) {
    fail(`cannot parse tracked release/profile JSON: ${error.message}`);
  }
  const canonicalBytes = new TextEncoder().encode(canonicalJson(releaseRecord));
  if (!Buffer.from(releaseBytes).equals(Buffer.from(canonicalBytes))) {
    fail("tracked release record is not recursively canonical JSON bytes");
  }
  const releaseSha256 = sha256Hex(releaseBytes);
  if (releaseSha256 !== hex(CADR_M6_RELEASE_RECORD_SHA256)) {
    fail("tracked release record does not match the production compiled digest");
  }
  if (releaseRecord.contract !== CADR_M6_READY_CONTRACT ||
      releaseRecord.target !== "CADR-WEB-303/ABI1.4/protocol-v4/M6" ||
      profile?.profile?.id !== "CADR-WEB-303") {
    fail("tracked release record or CADR-WEB-303 profile has the wrong identity");
  }
  const recordArtifacts = new Map((releaseRecord.artifacts ?? []).map(item => [item.kind, item]));
  if (recordArtifacts.size !== REQUIRED_KINDS.length ||
      REQUIRED_KINDS.some(kind => !recordArtifacts.has(kind))) {
    fail("release record does not name the exact five M6 artifact kinds");
  }
  const profileArtifacts = new Map((profile.artifacts ?? []).map(item => [item.id, item]));
  const nativeInputs = releaseRecord.native_inputs;
  if (!Array.isArray(nativeInputs) || nativeInputs.length !== 1 ||
      Object.keys(nativeInputs[0] ?? {}).sort().join("\0") !==
        ["byte_count", "id", "sha256"].join("\0") ||
      nativeInputs[0].id !== "usite-extra-hosts" ||
      nativeInputs[0].byte_count !== "262" ||
      nativeInputs[0].sha256 !==
        "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438") {
    fail("release record does not bind the closed native-only hosts input");
  }
  const expected = SOURCE_LAYOUT.map(source => {
    const fromRelease = recordArtifacts.get(source.kind);
    const fromProfile = profileArtifacts.get(source.id);
    if (typeof fromRelease?.byte_count !== "string" ||
        !/^[1-9][0-9]*$/.test(fromRelease.byte_count) ||
        !/^[0-9a-f]{64}$/.test(fromRelease.sha256) ||
        typeof fromProfile?.bytes !== "number" ||
        typeof fromProfile?.sha256 !== "string" ||
        BigInt(fromProfile.bytes) !== BigInt(fromRelease.byte_count) ||
        fromProfile.sha256 !== fromRelease.sha256) {
      fail(`release/profile disagreement for artifact kind ${source.kind}`);
    }
    return Object.freeze({
      ...source,
      byteCount: BigInt(fromRelease.byte_count),
      sha256: fromRelease.sha256,
    });
  });
  return Object.freeze({
    releaseBytes: new Uint8Array(releaseBytes), releaseRecord, releaseSha256,
    profile, expected, nativeInputs: Object.freeze(nativeInputs.map(Object.freeze)),
  });
}

async function openLocalArtifacts(expected, artifactRoot) {
  const items = [];
  try {
    for (const source of expected) {
      const absolutePath = resolve(artifactRoot, source.localPath);
      const [metadata, handle] = await Promise.all([stat(absolutePath), open(absolutePath, "r")]);
      if (!metadata.isFile() || BigInt(metadata.size) !== source.byteCount) {
        await handle.close();
        fail(`local ${source.localPath} does not have the release-record byte count`);
      }
      const artifact = Object.freeze({
        kind: source.kind,
        byteCount: source.byteCount,
        async readRange(offset, byteCount) {
          if (typeof offset !== "bigint" || typeof byteCount !== "bigint" ||
              offset < 0n || byteCount < 0n || offset > source.byteCount ||
              byteCount > source.byteCount - offset || byteCount > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new RangeError("local artifact range is out of bounds");
          }
          const output = Buffer.allocUnsafe(Number(byteCount));
          const { bytesRead } = await handle.read(output, 0, output.byteLength, Number(offset));
          return new Uint8Array(output.buffer, output.byteOffset, bytesRead).slice();
        },
      });
      items.push(Object.freeze({ source, handle, artifact }));
    }
    return new LocalArtifactSet(items);
  } catch (error) {
    await Promise.all(items.map(item => item.handle.close().catch(() => {})));
    throw error;
  }
}

async function createClient(module, label) {
  const client = new ProtocolV4Client(new Worker(WORKER_URL, { type: "module" }), label);
  try {
    const response = await client.request("instantiate", { module });
    if (response.status !== 0) {
      fail(`${label} protocol-v4 instantiate failed with status ${response.status}`);
    }
    return client;
  } catch (error) {
    await client.close();
    throw error;
  }
}

function m6Profile(loaded) {
  return Object.freeze({
    id: loaded.profile.profile.id,
    artifacts: loaded.expected.map(item => Object.freeze({
      kind: item.kind,
      byteCount: item.byteCount,
      sha256: Buffer.from(item.sha256, "hex"),
    })),
  });
}

function readyLimit(record) {
  const nativeRuns = record.native_runs;
  const samples = record.idle_oracle?.sample_count;
  if (!Array.isArray(nativeRuns) || nativeRuns.length !== 3 ||
      !Number.isSafeInteger(samples) || samples <= 0 ||
      !/^[1-9][0-9]*$/.test(nativeRuns[0]?.suffix_first_boundary ?? "")) {
    fail("release record cannot supply the bounded M6 READY limit");
  }
  const first = BigInt(nativeRuns[0].suffix_first_boundary);
  if (!nativeRuns.every(run => run.suffix_first_boundary === nativeRuns[0].suffix_first_boundary)) {
    fail("release record has no stable three-capture suffix boundary");
  }
  return first + BigInt(samples - 1);
}

function bootConfig({ loaded, artifacts, client }) {
  return {
    client,
    artifacts,
    profile: m6Profile(loaded),
    hashArtifact,
    maxBoundaries: readyLimit(loaded.releaseRecord),
    maxHostTransactions: 1024,
    ready: Object.freeze({
      contract: CADR_M6_READY_CONTRACT,
      releaseRecord: loaded.releaseBytes.slice(),
    }),
  };
}

async function preflightLocalArtifacts(loaded, artifactRoot, transform = artifacts => artifacts) {
  const local = await openLocalArtifacts(loaded.expected, artifactRoot);
  try {
    return await preflightM6Artifacts({
      artifacts: transform(local.artifacts),
      profile: m6Profile(loaded),
      hashArtifact,
    });
  } finally {
    await local.close();
  }
}

async function runTruncatedPreflight(loaded, artifactRoot) {
  let failure;
  try {
    await preflightLocalArtifacts(loaded, artifactRoot, artifacts => artifacts.map(artifact =>
      artifact.kind === 1 ? Object.freeze({
      ...artifact,
      async readRange(offset, byteCount) {
        const bytes = await artifact.readRange(offset, byteCount);
        return bytes.byteLength === 0 ? bytes : bytes.slice(0, -1);
      },
    }) : artifact));
  } catch (error) {
    failure = error;
  }
  if (failure?.status !== 11) {
    fail("truncated artifact did not fail in source preflight");
  }
  return Object.freeze({
    artifact_kind: 1,
    mutation_started: false,
    outcome: "failed",
    reason: "artifact-preflight-mismatch",
    worker_created: false,
    worker_requests: 0,
  });
}

async function runProductionConformance(loaded, module, artifactRoot) {
  const conformance = await runM6HeadlessBootConformance({
    repetitions: 3,
    createRun: async runIndex => {
      /* All local source reads, immutable snapshots, and digest checks occur
       * before the Node worker exists. The driver repeats the preflight over
       * these private snapshots as defense in depth; it cannot read the
       * original local sources after this point. */
      const verified = await preflightLocalArtifacts(loaded, artifactRoot);
      const client = await createClient(module, `m6-conformance-${runIndex}`);
      try {
        return bootConfig({ loaded, artifacts: verified.sources, client });
      } catch (error) {
        await client.close();
        throw error;
      }
    },
    async disposeRun(run) {
      await run.client.close();
    },
    onRunCompleted({ completedRuns }) {
      console.log(`C-M6 Wasm conformance: completed run ${completedRuns}/3`);
    },
  });
  return conformance;
}

async function ensureWasm(build) {
  const wasmPath = resolve(ROOT, WASM_RELATIVE_PATH);
  if (build) {
    execFileSync("make", ["-C", resolve(ROOT, "cadr-web"), "build/cadr-web-m5-O0.wasm"], {
      stdio: "inherit",
    });
  }
  const wasm = await readFile(wasmPath);
  if (wasm.byteLength === 0) fail("M5 Wasm build is empty");
  return Object.freeze({
    module: await WebAssembly.compile(wasm),
    byteCount: wasm.byteLength,
    sha256: sha256Hex(wasm),
  });
}

export async function writeCanonicalAtomically(outputPath, value, mode = 0o644) {
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777) {
    throw new TypeError("canonical output mode must be a Unix permission mask");
  }
  const directory = dirname(outputPath);
  await mkdir(directory, { recursive: true });
  const temporary = resolve(directory, `.${randomUUID()}.cadr-m6-conformance.tmp`);
  const bytes = new TextEncoder().encode(canonicalJson(value));
  try {
    await writeFile(temporary, bytes, { mode });
    await rename(temporary, outputPath);
  } finally {
    await unlink(temporary).catch(error => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
  return { byteCount: bytes.byteLength, sha256: sha256Hex(bytes) };
}

const PRIVATE_PUBLISH_IO = Object.freeze({ mkdir, link, open, unlink, writeFile });

async function syncFile(path, io) {
  const handle = await io.open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path, io) {
  const handle = await io.open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/* Failure diagnostics must never replace an earlier receipt: an existing path
 * is evidence that needs an explicit reviewer decision. link(2) publishes the
 * fully synced same-directory temporary inode without a replace window. */
export async function writeCanonicalNoReplaceAtomically(
  outputPath, value, mode = 0o600, io = PRIVATE_PUBLISH_IO) {
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777) {
    throw new TypeError("canonical output mode must be a Unix permission mask");
  }
  const directory = dirname(outputPath);
  const temporary = resolve(directory,
    `.${randomUUID()}.cadr-m6-failure-diagnostic.tmp`);
  const bytes = new TextEncoder().encode(canonicalJson(value));
  await io.mkdir(directory, { recursive: true });
  let linked = false;
  try {
    /* The random name is a collision avoidance measure, not authority to
     * replace a file.  Exclusive creation makes a collision fail closed. */
    await io.writeFile(temporary, bytes, { flag: "wx", mode });
    await syncFile(temporary, io);
    await io.link(temporary, outputPath);
    linked = true;
    /* The temporary hard link is no longer needed once the final name exists.
     * Its removal is part of publication, not after-the-fact housekeeping:
     * a failure must enter the same rollback path as directory fsync. */
    await io.unlink(temporary);
    await syncDirectory(directory, io);
    return { byteCount: bytes.byteLength, sha256: sha256Hex(bytes) };
  } catch (error) {
    /* A successful link makes the final name visible before the parent
     * directory has acknowledged its metadata.  This function owns that link
     * only when `linked` is true; an EEXIST from link(2) leaves an earlier
     * reviewer-owned receipt untouched. */
    if (!linked) throw error;
    const cleanupErrors = [];
    try {
      await io.unlink(outputPath);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") cleanupErrors.push(cleanupError);
    }
    try {
      await syncDirectory(directory, io);
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length === 0) throw error;
    throw new AggregateError([error, ...cleanupErrors],
      "C-M6 failure diagnostic publication failed and rollback was incomplete");
  } finally {
    /* A prior error has already rolled back the final name when necessary.
     * Do not mask that error with best-effort temporary cleanup. */
    await io.unlink(temporary).catch(error => {
      if (error?.code !== "ENOENT") return undefined;
      return undefined;
    });
  }
}

export function failureOutputPath(outputPath) {
  if (typeof outputPath !== "string" || outputPath.length === 0) {
    throw new TypeError("failure output requires a pathname");
  }
  return `${outputPath}.failure.json`;
}

function evidence({ loaded, wasm, negativePreflight, conformance }) {
  return Object.freeze({
    artifact_profile: Object.freeze({
      artifacts: loaded.expected.map(item => Object.freeze({
        byte_count: item.byteCount.toString(),
        id: item.id,
        kind: item.kind,
        local_path: item.localPath,
        sha256: item.sha256,
      })),
      profile_id: loaded.profile.profile.id,
      profile_path: PROFILE_RELATIVE_PATH,
    }),
    conformance,
    driver: Object.freeze({
      protocol_version: CADR_M6_PROTOCOL_VERSION,
      repetitions: 3,
      script: "scripts/run-cadr-m6-wasm-conformance.mjs",
      synthetic_entrypoint_used: false,
    }),
    negative_preflight: negativePreflight,
    release_record: Object.freeze({
      contract: CADR_M6_READY_CONTRACT,
      native_inputs: loaded.nativeInputs,
      path: RELEASE_RELATIVE_PATH,
      sha256: loaded.releaseSha256,
    }),
    schema: "cadr-m6-real-wasm-conformance-evidence-v1",
    wasm: Object.freeze({
      byte_count: wasm.byteCount,
      path: WASM_RELATIVE_PATH,
      sha256: wasm.sha256,
    }),
  });
}

export function failureEvidence({
  loaded, wasm, negativePreflight, conformance, repetitions = 3,
}) {
  if (!Number.isSafeInteger(repetitions) || ![1, 3].includes(repetitions)) {
    throw new TypeError("failure evidence has an invalid repetition count");
  }
  return Object.freeze({
    artifact_profile: Object.freeze({
      artifacts: loaded.expected.map(item => Object.freeze({
        byte_count: item.byteCount.toString(),
        id: item.id,
        kind: item.kind,
        local_path: item.localPath,
        sha256: item.sha256,
      })),
      profile_id: loaded.profile.profile.id,
      profile_path: PROFILE_RELATIVE_PATH,
    }),
    driver: Object.freeze({
      protocol_version: CADR_M6_PROTOCOL_VERSION,
      repetitions,
      script: "scripts/run-cadr-m6-wasm-conformance.mjs",
      synthetic_entrypoint_used: false,
    }),
    failure_diagnostic: canonicalM6FailureDiagnostic(conformance),
    negative_preflight: negativePreflight,
    release_record: Object.freeze({
      contract: CADR_M6_READY_CONTRACT,
      native_inputs: loaded.nativeInputs,
      path: RELEASE_RELATIVE_PATH,
      sha256: loaded.releaseSha256,
    }),
    schema: "cadr-m6-real-wasm-failure-evidence-v1",
    wasm: Object.freeze({
      byte_count: wasm.byteCount,
      path: WASM_RELATIVE_PATH,
      sha256: wasm.sha256,
    }),
  });
}

function productionFailureMessage(conformance) {
  const report = conformance.failure?.report;
  return "production three-run conformance failed" +
    ` (completed=${conformance.completed_runs ?? "unknown"},` +
    ` failed_run=${conformance.failed_run ?? "unknown"},` +
    ` reason=${report?.reason ?? conformance.reason ?? "unknown"},` +
    ` phase=${report?.phase ?? "unknown"},` +
    ` status=${report?.status ?? "unknown"})`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const loaded = await loadReleaseAndProfile();
  const negativePreflight = await runTruncatedPreflight(loaded, options.artifactRoot);
  if (options.negativeOnly) {
    console.log(canonicalJson(Object.freeze({
      negative_preflight: negativePreflight,
      schema: "cadr-m6-real-wasm-conformance-negative-v1",
    })));
    return;
  }
  const wasm = await ensureWasm(options.build);
  const outputPath = options.output ?? resolve(ROOT, DEFAULT_OUTPUT_RELATIVE_PATH);
  const conformance = await runProductionConformance(
    loaded, wasm.module, options.artifactRoot);
  if (conformance.outcome !== "ready" || conformance.runs?.length !== 3) {
    const diagnosticPath = failureOutputPath(outputPath);
    const receipt = await writeCanonicalNoReplaceAtomically(diagnosticPath,
      failureEvidence({ loaded, wasm, negativePreflight, conformance }), 0o600);
    console.error(`wrote private failure diagnostic ${relative(ROOT, diagnosticPath)}` +
      ` (${receipt.byteCount} bytes, ${receipt.sha256})`);
    fail(productionFailureMessage(conformance));
  }
  const receipt = await writeCanonicalAtomically(outputPath,
    evidence({ loaded, wasm, negativePreflight, conformance }));
  console.log(`wrote ${relative(ROOT, outputPath)} (${receipt.byteCount} bytes, ${receipt.sha256})`);
}

const invokedAsMain = typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsMain) {
  main().catch(error => {
    console.error(error?.stack ?? String(error));
    process.exitCode = 1;
  });
}
