#!/usr/bin/env node
/*
 * Direct, deliberately inert-until-confirmed READY4 runner.  Its phase-one
 * artifact preflight snapshots and hashes every source before it creates a
 * worker; the M6 driver then consumes only those private in-memory snapshots
 * and its own fresh M4 overlay.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M6_DEVID_PROFILE,
  CADR_M6_PROTOCOL_VERSION,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  preflightM6Artifacts,
  runM6Ready4Fast,
  validateSyntheticM6ReleaseRecord,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import { writeCanonicalNoReplace } from "./aggregate-cadr-m6-ready4-campaign.mjs";
import { canonicalJson, M6_READY4_CONTRACT, M6_READY4_RUN_SCHEMA,
  M6_READY4_TARGET, sha256Hex } from "./cadr-m6-ready4-evidence.mjs";
import { readReady4WasmIdentity } from "./cadr-m6-wasm-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_RELATIVE = "cadr-web/oracle/cadr-m6-release-record.json";
const WASM_RELATIVE = "cadr-web/build/cadr-web-m6-devid-O2.wasm";
const WORKER_URL = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const SOURCE_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, path: "l/usim/disk-sys-303-0.img" }),
]);
const REQUEST_TIMEOUT_MS = 120_000;

function usage() {
  return "usage: node scripts/run-cadr-m6-ready4-fast.mjs --execute --artifact-root ROOT --output PRIVATE.json --wasm-identity IDENTITY.json --invocation-nonce-file PATH --selected-image-negative-receipt-sha256 SHA256 [--release-record PATH] [--wasm PATH] --no-build";
}

function bytesHex(bytes) { return Buffer.from(bytes).toString("hex"); }

function checkedPath(value, option) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${option} needs a pathname`);
  }
  return resolve(process.cwd(), value);
}

export function parseReady4Arguments(argv) {
  const result = { execute: false, artifactRoot: null, output: null,
    releaseRecord: resolve(ROOT, RELEASE_RELATIVE), wasm: resolve(ROOT, WASM_RELATIVE),
    wasmIdentity: null, invocationNonceFile: null,
    selectedImageNegativeReceiptSha256: null, build: true };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") {
      if (result.execute) throw new TypeError("duplicate --execute");
      result.execute = true;
    } else if (option === "--no-build") {
      if (!result.build) throw new TypeError("duplicate --no-build");
      result.build = false;
    } else if (option === "--selected-image-negative-receipt-sha256") {
      if (result.selectedImageNegativeReceiptSha256 !== null) {
        throw new TypeError(`duplicate ${option}`);
      }
      const value = argv[++index];
      if (!/^[0-9a-f]{64}$/.test(value ?? "")) {
        throw new TypeError(`${option} needs a lowercase SHA-256`);
      }
      result.selectedImageNegativeReceiptSha256 = value;
    } else if (["--artifact-root", "--output", "--release-record", "--wasm",
      "--wasm-identity", "--invocation-nonce-file"].includes(option)) {
      const value = checkedPath(argv[++index], option);
      const key = option.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      if (result[key] !== null && !["releaseRecord", "wasm"].includes(key)) {
        throw new TypeError(`duplicate ${option}`);
      }
      result[key] = value;
    } else {
      throw new TypeError(`unsupported READY4 argument ${JSON.stringify(option)}`);
    }
  }
  if (!result.execute || result.artifactRoot === null || result.output === null ||
      result.wasmIdentity === null || result.build ||
      result.invocationNonceFile === null ||
      result.selectedImageNegativeReceiptSha256 === null ||
      process.env.M6_READY4_SYSTEMD_CHILD !== "1") {
    throw new TypeError(`${usage()}\nThe direct READY4 runner is inert without --execute.`);
  }
  return Object.freeze(result);
}

async function verifyInvocationNonce(path) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() ||
      metadata.size !== 32 || (metadata.mode & 0o077) !== 0) {
    throw new TypeError("READY4 invocation nonce is not an outer-private 32-byte file");
  }
  const bytes = await readFile(path);
  if (bytes.byteLength !== 32) {
    throw new TypeError("READY4 invocation nonce changed while reading");
  }
  return sha256Hex(bytes);
}

async function hashArtifact(artifact) {
  const hash = createHash("sha256");
  for (let offset = 0n; offset < artifact.byteCount;) {
    const count = artifact.byteCount - offset > 1048576n ? 1048576n : artifact.byteCount - offset;
    const chunk = await artifact.readRange(offset, count);
    if (!(chunk instanceof Uint8Array) || BigInt(chunk.byteLength) !== count) {
      throw new TypeError("READY4 source returned a short read");
    }
    hash.update(chunk); offset += count;
  }
  return new Uint8Array(hash.digest());
}

async function openArtifactSources(artifactRoot, releaseRecord) {
  const byKind = new Map((releaseRecord.artifacts ?? []).map(item => [item.kind, item]));
  const opened = [];
  try {
    for (const layout of SOURCE_LAYOUT) {
      const expected = byKind.get(layout.kind);
      if (!/^[1-9][0-9]*$/.test(expected?.byte_count ?? "") ||
          !/^[0-9a-f]{64}$/.test(expected?.sha256 ?? "")) {
        throw new TypeError(`release record lacks artifact identity for kind ${layout.kind}`);
      }
      const path = resolve(artifactRoot, layout.path);
      const before = await lstat(path);
      if (!before.isFile() || before.isSymbolicLink() || BigInt(before.size) !== BigInt(expected.byte_count)) {
        throw new TypeError(`artifact kind ${layout.kind} is not the required regular byte count`);
      }
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const after = await handle.stat();
      if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino ||
          after.size !== before.size) {
        await handle.close();
        throw new TypeError(`artifact kind ${layout.kind} changed while opening`);
      }
      const byteCount = BigInt(expected.byte_count);
      opened.push(Object.freeze({ handle, artifact: Object.freeze({
        kind: layout.kind, byteCount,
        async readRange(offset, count) {
          if (typeof offset !== "bigint" || typeof count !== "bigint" || offset < 0n ||
              count < 0n || offset > byteCount || count > byteCount - offset ||
              count > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("artifact range is invalid");
          const output = Buffer.allocUnsafe(Number(count));
          const { bytesRead } = await handle.read(output, 0, output.byteLength, Number(offset));
          return new Uint8Array(output.buffer, output.byteOffset, bytesRead).slice();
        },
      }) }));
    }
    return opened;
  } catch (error) {
    await Promise.all(opened.map(item => item.handle.close().catch(() => undefined)));
    throw error;
  }
}

function readyLimit(record) {
  const first = record?.native_runs?.[0]?.suffix_first_boundary;
  const samples = record?.idle_oracle?.sample_count;
  if (!/^[1-9][0-9]*$/.test(first ?? "") || !Number.isSafeInteger(samples) || samples <= 0 ||
      !record.native_runs.every(run => run.suffix_first_boundary === first)) {
    throw new TypeError("release record cannot provide a stable READY4 limit");
  }
  return BigInt(first) + BigInt(samples - 1);
}

/* This function deliberately takes no worker factory.  A successful return
 * means every release and artifact byte was checked and privately spooled,
 * while a failure proves no worker could have been created by this runner. */
export async function preflightReady4Inputs({ artifactRoot, releaseRecord }) {
  const releaseBytes = await readFile(releaseRecord);
  let record;
  try { record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(releaseBytes)); }
  catch { throw new TypeError("READY4 release record is not UTF-8 JSON"); }
  const canonical = Buffer.from(canonicalJson(record));
  if (!Buffer.from(releaseBytes).equals(canonical) ||
      bytesHex(createHash("sha256").update(releaseBytes).digest()) !==
        bytesHex(CADR_M6_RELEASE_RECORD_SHA256)) {
    throw new TypeError("READY4 release record is not the compiled canonical identity");
  }
  const ready = await validateSyntheticM6ReleaseRecord(record);
  const opened = await openArtifactSources(artifactRoot, ready);
  try {
    const artifacts = opened.map(item => item.artifact);
    const profile = Object.freeze({ id: "CADR-WEB-303", artifacts: artifacts.map(artifact => {
      const matching = ready.artifacts.find(item => item.kind === artifact.kind);
      return Object.freeze({ kind: artifact.kind, byteCount: artifact.byteCount,
        sha256: Buffer.from(matching.sha256, "hex") });
    }) });
    const preflight = await preflightM6Artifacts({ artifacts, profile, hashArtifact });
    return Object.freeze({ ready, releaseBytes: new Uint8Array(releaseBytes),
      profile, sources: preflight.sources, maxBoundaries: readyLimit(ready) });
  } finally {
    await Promise.all(opened.map(item => item.handle.close().catch(() => undefined)));
  }
}

class Client {
  constructor(worker) {
    this.worker = worker; this.nextId = 1; this.closed = false; this.pending = new Map();
    worker.on("message", value => this.receive(value));
    worker.on("error", error => this.rejectAll(error));
    worker.on("exit", code => { if (!this.closed && code !== 0) this.rejectAll(new Error(`READY4 worker exited ${code}`)); });
  }
  receive(value) {
    const pending = this.pending.get(value?.id);
    if (pending === undefined) return this.rejectAll(new Error("READY4 worker sent an unsolicited response"));
    this.pending.delete(value.id); clearTimeout(pending.timeout);
    if (value.type !== "cadr-response" || value.version !== CADR_M6_PROTOCOL_VERSION ||
        value.op !== pending.operation || !Number.isSafeInteger(value.status)) {
      pending.reject(new Error(`malformed READY4 ${pending.operation} response`));
    } else pending.resolve(value);
  }
  rejectAll(error) { for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); } this.pending.clear(); }
  request(operation, fields = {}, transfer = []) {
    if (this.closed) return Promise.reject(new Error("READY4 request after worker close"));
    const id = this.nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => { this.pending.delete(id); rejectRequest(new Error(`READY4 ${operation} timed out`)); }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { operation, timeout, resolve: resolveRequest, reject: rejectRequest });
      try { this.worker.postMessage({ version: CADR_M6_PROTOCOL_VERSION, id, op: operation, ...fields }, transfer); }
      catch (error) { this.pending.delete(id); clearTimeout(timeout); rejectRequest(error); }
    });
  }
  async close() { if (!this.closed) { this.closed = true; this.rejectAll(new Error("READY4 worker closed")); await this.worker.terminate(); } }
}

async function buildModule(options) {
  if (options.build) throw new TypeError("READY4 child cannot build outside the outer supervisor");
  const identity = await readReady4WasmIdentity(options.wasmIdentity, options.wasm);
  const bytes = await readFile(options.wasm);
  if (bytes.byteLength === 0) throw new TypeError("READY4 Wasm module is empty");
  return Object.freeze({ module: await WebAssembly.compile(bytes), identity });
}

function resultRecord(result, identity, selectedImageNegativeReceiptSha256) {
  if (result?.outcome !== "ready4" || result.target !== CADR_M6_DEVID_PROFILE ||
      result.contract !== CADR_M6_READY4_CONTRACT) throw new TypeError("READY4 driver did not prove READY4");
  return Object.freeze({ schema: M6_READY4_RUN_SCHEMA, outcome: "ready4", target: M6_READY4_TARGET,
    contract: M6_READY4_CONTRACT, session_id: result.runEvidence.sessionId,
    private_disk_instance_id: result.runEvidence.privateDiskInstanceId,
    boundary: result.boundary.toString(), checkpoint_count: result.checkpointCount,
    selected_maximum: "9223372036854775807",
    cdrstate5_sha256: bytesHex(result.cdrstate5Sha256),
    cdrm5q1_sha256: bytesHex(result.cdrm5q1Sha256),
    checkpoint_chain_sha256: bytesHex(result.checkpointChainSha256),
    cdrm6e1_hex: bytesHex(result.cdrm6e1),
    cdrm6e1_sha256: bytesHex(result.cdrm6e1Sha256),
    ready3_witness_sha256: bytesHex(result.ready.ready3Witness),
    ready4_witness_sha256: bytesHex(result.ready.ready4Witness),
    wasm_byte_count: identity.wasm_byte_count,
    wasm_optimization: identity.wasm_optimization,
    wasm_profile: identity.wasm_profile,
    wasm_sha256: identity.wasm_sha256,
    selected_image_negative_receipt_sha256:
      selectedImageNegativeReceiptSha256,
    source_closure_sha256: identity.source_closure_sha256,
    source_commit: identity.source_commit });
}

function boundedFailure(error) {
  return Object.freeze({ schema: "cadr-m6-ready4-fast-run-failure-v1", outcome: "failed",
    reason: "ready4-run-failed", diagnostic_sha256: sha256Hex(Buffer.from(String(error?.message ?? error))) });
}

export async function executeReady4(options, { preflight = preflightReady4Inputs,
  build = buildModule, createClient = async module => {
    const client = new Client(new Worker(WORKER_URL, { type: "module" }));
    const response = await client.request("instantiate", { module,
      m6DiskEvidencePolicy: true });
    if (response.status !== 0) { await client.close(); throw new Error(`M6-DEVID instantiate returned ${response.status}`); }
    return client;
  } } = {}) {
  await verifyInvocationNonce(options.invocationNonceFile);
  /* This await is intentionally before build/Worker construction. */
  const inputs = await preflight({ artifactRoot: options.artifactRoot, releaseRecord: options.releaseRecord });
  const built = await build(options);
  const client = await createClient(built.module);
  try {
    return resultRecord(await runM6Ready4Fast({ client, artifacts: inputs.sources,
      profile: inputs.profile, maxBoundaries: inputs.maxBoundaries, maxHostTransactions: 1024,
      ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT, releaseRecord: inputs.releaseBytes }) }),
    built.identity, options.selectedImageNegativeReceiptSha256);
  } finally { await client.close(); }
}

async function main() {
  const options = parseReady4Arguments(process.argv.slice(2));
  try {
    const record = await executeReady4(options);
    await writeCanonicalNoReplace(options.output, record);
  } catch (error) {
    await writeCanonicalNoReplace(`${options.output}.failure.json`, boundedFailure(error));
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) process.stdout.write(`${usage()}\n`);
  else main().catch(error => { process.stderr.write(`READY4 fast run failed: ${error.message}\n`); process.exitCode = 1; });
}
