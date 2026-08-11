#!/usr/bin/env node
/* Descriptor-only unprivileged M7 P4 production entry. */
import { createHash } from "node:crypto";
import { closeSync, fstatSync, openSync, readFileSync, readSync, writeSync } from "node:fs";
import { executeM7P4FastDifferential } from "./run-cadr-m7-p4-fast-differential.mjs";
import { CADR_M6_READY_CONTRACT } from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

const INPUTS = Object.freeze([
  Object.freeze({ fd: 7, name: "wasm", limit: 4 * 1024 * 1024 }),
  Object.freeze({ fd: 8, name: "module identity", limit: 1024 * 1024 }),
  Object.freeze({ fd: 9, name: "P4 manifest", limit: 1024 * 1024 }),
  Object.freeze({ fd: 10, name: "CDRM7N1", limit: 16 * 1024 * 1024 }),
  Object.freeze({ fd: 11, name: "M6 release", limit: 1024 * 1024 }),
  ...[12, 13, 14, 15, 16].map((fd, index) => Object.freeze({
    fd, name: `artifact ${[1, 2, 4, 5, 3][index]}`, limit: 512 * 1024 * 1024,
  })),
]);
const ARTIFACT_KINDS = Object.freeze([1, 2, 4, 5, 3]);
const RESULT_FD = 17;
const RESULT_MAX_BYTES = 1024 * 1024;
const CLOSED_ENVIRONMENT = Object.freeze({
  HOME: "/var/empty", LANG: "C", LC_ALL: "C", PATH: "/var/empty", TZ: "UTC",
});
export const CADR_M7_P4_RESULT_DECODER_STATUS = Object.freeze({
  schema: "cadr-m7-p4-result-decoder-status-v1",
  implementation: "later-supervisor-slice",
  production_go: false,
});

function fail(message) { throw new TypeError(`M7 descriptor runner: ${message}`); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest(); }
function exactJson(bytes, label) {
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail(`${label} is not UTF-8 JSON`); }
  if (!Buffer.from(canonicalJson(value)).equals(bytes)) fail(`${label} is not canonical JSON`);
  return value;
}
function readOnlyFlags(fd) {
  const text = readFileSync(`/proc/self/fdinfo/${fd}`, "ascii");
  const match = /^flags:\s*([0-7]+)$/m.exec(text);
  if (match === null || (Number.parseInt(match[1], 8) & 3) !== 0) {
    fail(`fd${fd} is not read-only`);
  }
}
function readStable(input) {
  const before = fstatSync(input.fd, { bigint: true });
  readOnlyFlags(input.fd);
  if (!before.isFile() || before.size < 1n || before.size > BigInt(input.limit) ||
      before.size > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${input.name} has invalid type or size`);
  const bytes = Buffer.alloc(Number(before.size));
  let offset = 0;
  while (offset < bytes.byteLength) {
    const count = readSync(input.fd, bytes, offset, bytes.byteLength - offset, offset);
    if (count < 1) fail(`${input.name} returned a short read`);
    offset += count;
  }
  const after = fstatSync(input.fd, { bigint: true });
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
    fail(`${input.name} changed while copied`);
  }
  closeSync(input.fd);
  return Object.freeze({ bytes: new Uint8Array(bytes), sha256: sha256(bytes) });
}
function statusLine(status, name) {
  const match = new RegExp(`^${name}:\\s*(.*)$`, "m").exec(status);
  return match?.[1].trim() ?? null;
}
export function validateM7P4DescriptorIdentityStatusForTest(status) {
  if (typeof status !== "string") fail("process status is not text");
  for (const [name, expected] of [["Uid", 611], ["Gid", 612]]) {
    const value = statusLine(status, name);
    const fields = value?.split(/\s+/) ?? [];
    if (fields.length !== 4 || fields.some(field => field !== String(expected))) {
      fail(`${name} is not the literal M7 P4 service identity`);
    }
  }
  return true;
}
export function validateM7P4DescriptorEnvironmentForTest(environment) {
  if (environment === null || typeof environment !== "object" || Array.isArray(environment)) {
    fail("environment is not closed");
  }
  const actual = Object.keys(environment).sort();
  const expected = Object.keys(CLOSED_ENVIRONMENT).sort();
  if (actual.length !== expected.length ||
      actual.some((key, index) => key !== expected[index]) ||
      expected.some(key => environment[key] !== CLOSED_ENVIRONMENT[key])) {
    fail("environment is not closed");
  }
  return true;
}
function verifyProcessBoundary() {
  if (process.argv.length !== 3 || process.argv[2] !== "--inherited-v2") {
    fail("argv is not the literal inherited-v2 ABI");
  }
  validateM7P4DescriptorEnvironmentForTest(process.env);
  const status = readFileSync("/proc/self/status", "ascii");
  validateM7P4DescriptorIdentityStatusForTest(status);
  if (statusLine(status, "Groups") !== "" ||
      !["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].every(
        name => /^0+$/.test(statusLine(status, name) ?? "")) ||
      statusLine(status, "NoNewPrivs") !== "1") fail("drop state differs from policy");
  const selfFd = openSync("/proc/self/ns/user", "r");
  const initFd = openSync("/proc/1/ns/user", "r");
  const self = fstatSync(selfFd, { bigint: true });
  const init = fstatSync(initFd, { bigint: true });
  closeSync(selfFd); closeSync(initFd);
  if (self.dev !== init.dev || self.ino !== init.ino) fail("not in the initial user namespace");
}
function readyLimit(release) {
  const samples = release?.idle_oracle?.sample_count;
  const first = release?.native_runs?.[0]?.suffix_first_boundary;
  if (!Number.isSafeInteger(samples) || samples < 1 ||
      typeof first !== "string" || !/^[1-9][0-9]*$/.test(first) ||
      !Array.isArray(release.native_runs) || release.native_runs.length !== 3 ||
      !release.native_runs.every(run => run?.suffix_first_boundary === first)) {
    fail("M6 release does not provide the fixed READY bound");
  }
  return BigInt(first) + BigInt(samples - 1);
}
function artifactSource(kind, record) {
  const bytes = record.bytes;
  return Object.freeze({ kind, byteCount: BigInt(bytes.byteLength),
    async readRange(offset, count) {
      if (typeof offset !== "bigint" || typeof count !== "bigint" || offset < 0n ||
          count < 0n || offset + count > BigInt(bytes.byteLength) ||
          count > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("artifact range is invalid");
      return bytes.slice(Number(offset), Number(offset + count));
    } });
}
export function encodeM7P4HostResultFrameForTest(disposition, value) {
  if (!Number.isSafeInteger(disposition) || disposition < 0 || disposition > 1) {
    fail("result disposition is invalid");
  }
  const payload = Buffer.from(canonicalJson(value));
  if (payload.byteLength < 1 || payload.byteLength > RESULT_MAX_BYTES) fail("result is oversized");
  const header = Buffer.alloc(56);
  Buffer.from("M7HDRS2\0", "ascii").copy(header, 0);
  header.writeUInt32LE(2, 8); header.writeUInt32LE(disposition, 12);
  header.writeBigUInt64LE(BigInt(payload.byteLength), 16); sha256(payload).copy(header, 24);
  return Buffer.concat([header, payload]);
}
export function createM7P4HostResultWriterForTest(fd = RESULT_FD) {
  if (!Number.isSafeInteger(fd) || fd < 0) fail("result descriptor is invalid");
  let attempted = false;
  return Object.freeze({ send(disposition, value) {
    if (attempted) fail("terminal result was already attempted");
    attempted = true;
    const frame = encodeM7P4HostResultFrameForTest(disposition, value);
    try {
      let offset = 0;
      while (offset < frame.byteLength) {
        const count = writeSync(fd, frame, offset, frame.byteLength - offset);
        if (count < 1) fail("result channel returned a short write");
        offset += count;
      }
      return frame.byteLength;
    } finally { closeSync(fd); }
  } });
}
const productionResultWriter = createM7P4HostResultWriterForTest();

export async function runM7P4DescriptorEntryForTest(execute = executeM7P4FastDifferential) {
  verifyProcessBoundary(); closeSync(5);
  const records = new Map(INPUTS.map(input => [input.fd, readStable(input)]));
  const moduleIdentity = exactJson(Buffer.from(records.get(8).bytes), "module identity");
  const manifest = exactJson(Buffer.from(records.get(9).bytes), "P4 manifest");
  const release = exactJson(Buffer.from(records.get(11).bytes), "M6 release");
  const artifacts = ARTIFACT_KINDS.map((kind, index) =>
    artifactSource(kind, records.get(12 + index)));
  if (!Array.isArray(manifest?.artifacts) || manifest.artifacts.length !== 5) {
    fail("P4 manifest has no exact artifact identity table");
  }
  const manifestArtifacts = new Map(manifest.artifacts.map(item => {
    if (item === null || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).sort().join(",") !== "byte_count,kind,sha256" ||
        !ARTIFACT_KINDS.includes(item.kind) || typeof item.byte_count !== "string" ||
        !/^[1-9][0-9]*$/.test(item.byte_count) ||
        typeof item.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(item.sha256)) {
      fail("P4 manifest artifact identity is malformed");
    }
    return [item.kind, item];
  }));
  if (manifestArtifacts.size !== 5 || artifacts.some((artifact, index) => {
    const expected = manifestArtifacts.get(artifact.kind);
    return expected === undefined || BigInt(expected.byte_count) !== artifact.byteCount ||
      expected.sha256 !== records.get(12 + index).sha256.toString("hex");
  })) fail("artifact descriptors differ from the P4 manifest");
  const profile = Object.freeze({ id: "CADR-WEB-303", artifacts: Object.freeze(
    artifacts.map(artifact => Object.freeze({ kind: artifact.kind,
      byteCount: artifact.byteCount,
      sha256: Buffer.from(manifestArtifacts.get(artifact.kind).sha256, "hex") }))) });
  const result = await execute(Object.freeze({
    artifacts, maxBoundaries: readyLimit(release), moduleBytes: records.get(7).bytes,
    moduleIdentity, nativeAuthority: Object.freeze({
      schema: "cadr-m7-p4-native-authority-v2",
      manifest_bytes: records.get(9).bytes,
      manifest_identity: Object.freeze({ path: "manifest.json",
        bytes: records.get(9).bytes.byteLength,
        sha256: records.get(9).sha256.toString("hex") }),
      native_frame: records.get(10).bytes,
    }), profile, ready: Object.freeze({ contract: CADR_M6_READY_CONTRACT,
      releaseRecord: records.get(11).bytes }),
  }));
  productionResultWriter.send(0, Object.freeze({ execution_receipt: result.executionReceipt,
    schema: "cadr-m7-p4-host-result-v2", status: "ok" }));
}

export async function main() {
  try {
    return await runM7P4DescriptorEntryForTest();
  } catch {
    try { productionResultWriter.send(1, Object.freeze({ error: Object.freeze({
      code: "M7_P4_EXECUTION_FAILED", message: "M7 P4 execution failed" }),
      schema: "cadr-m7-p4-host-result-v2", status: "error" })); } catch {}
    process.exitCode = 1;
  }
}
