/*
 * Compare two M14 scaffold reproductions without admitting either as evidence.
 *
 * Every selected logical-manifest input is held through an O_NOFOLLOW
 * descriptor, required to have nlink==1, and reread through that descriptor
 * after its pathname and parent directory are revalidated.  This is a static byte comparison only:
 * it neither authenticates a package for distribution nor advances CW4.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CADR_M14_EVIDENCE_ENGINE_EVALUATION_SHA256, deriveM14EvidenceCandidate,
  validateM14EvidencePolicy } from "./cadr-m14-evidence.mjs";

const APPLY = Reflect.apply;
const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), "..");
const BUILD_ROOT = resolve(ROOT, "build/cadr-m14");
const EVIDENCE_POLICY = resolve(ROOT, "cadr-web/release/cadr-m14-evidence-policy.json");
const EVIDENCE_ENGINE = resolve(ROOT, "scripts/cadr-m14-evidence.mjs");
const COMPARATOR = fileURLToPath(import.meta.url);
const PROFILE = "CADR-WEB-303/CW4-MUSEUM";
const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA1 = /^[0-9a-f]{40}$/u;
const COMPARISONS = new WeakSet();
const TEST_HOOKS = new WeakMap();

/* This is intentionally evaluated by the executing module, rather than
 * derived from a pathname during a later comparison.  The comparison below
 * still retains and rereads that pathname, so a caller pin must agree with
 * both identities. */
async function evaluationSha256(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_CLOEXEC | (constants.O_NOFOLLOW ?? 0));
  try { return createHash("sha256").update(await handle.readFile()).digest("hex"); }
  finally { await handle.close(); }
}
export const CADR_M14_COMPARATOR_EVALUATION_SHA256 = await evaluationSha256(MODULE_PATH);

/* FileHandle instances expose an own `close`, while read/stat/write/sync and
 * the fd accessor live on the native prototype.  Retain exact descriptors at
 * module evaluation, before a caller can replace that prototype. */
async function captureFileHandleMethods() {
  const probe = await open(MODULE_PATH, constants.O_RDONLY | constants.O_CLOEXEC | (constants.O_NOFOLLOW ?? 0));
  try {
    const prototype = Object.getPrototypeOf(probe);
    const methods = Object.create(null);
    for (const name of ["read", "stat", "write", "sync"]) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "function" || descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new TypeError(`C-M14 static comparison: native FileHandle.${name} is not an own data method`);
      }
      methods[name] = descriptor.value;
    }
    const close = Object.getOwnPropertyDescriptor(probe, "close");
    const fd = Object.getOwnPropertyDescriptor(prototype, "fd");
    if (close === undefined || !("value" in close) || typeof close.value !== "function" || close.get !== undefined || close.set !== undefined ||
        fd === undefined || typeof fd.get !== "function" || fd.set !== undefined) {
      throw new TypeError("C-M14 static comparison: native FileHandle close/fd descriptor differs");
    }
    return Object.freeze({ ...methods, fd: fd.get });
  } finally { await APPLY(Object.getOwnPropertyDescriptor(probe, "close").value, probe, []); }
}
const FILE_HANDLE = await captureFileHandleMethods();

function fail(message) { throw new TypeError(`C-M14 static comparison: ${message}`); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function freeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function ownData(value, label, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain object`);
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string") || actual.sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    fail(`${label} has missing or extra fields`);
  }
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) fail(`${label}.${key} must be an enumerable data field`);
    result[key] = descriptor.value;
  }
  return result;
}
function optionalData(value, label, keys) {
  if (value === undefined) return Object.create(null);
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain object`);
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string") || actual.some(key => !keys.includes(key))) fail(`${label} has unsupported fields`);
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) { result[key] = undefined; continue; }
    if (!("value" in descriptor) || !descriptor.enumerable) fail(`${label}.${key} must be an enumerable data field`);
    result[key] = descriptor.value;
  }
  return result;
}
function sha256(value, label) { if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be SHA-256`); return value; }
function git(value, label) { if (typeof value !== "string" || !GIT_SHA1.test(value)) fail(`${label} must be Git SHA-1`); return value; }
function safeBuildPath(packagePath, index) {
  if (typeof packagePath !== "string" || dirname(packagePath) !== BUILD_ROOT || basename(packagePath).length === 0) {
    fail(`reproduction ${index} must be one direct build/cadr-m14 package`);
  }
}
function fdPath(fd, name = undefined) {
  if (process.platform !== "linux" || !Number.isSafeInteger(fd) || fd < 0) fail("comparison requires Linux retained /proc/self/fd descriptors");
  return name === undefined ? `/proc/self/fd/${fd}` : `/proc/self/fd/${fd}/${name}`;
}
function fileIdentity(info, label) {
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n) fail(`${label} must be a one-link regular non-symlink file`);
  return freeze({ dev: info.dev, ino: info.ino, nlink: info.nlink, size: info.size, ctimeNs: info.ctimeNs,
    mtimeNs: info.mtimeNs, mode: info.mode & 0o777n });
}
function directoryIdentity(info, label) {
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`${label} must be a non-symlink directory`);
  return freeze({ dev: info.dev, ino: info.ino, ctimeNs: info.ctimeNs, mtimeNs: info.mtimeNs });
}
function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size &&
    left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs && left.mode === right.mode;
}
function sameDirectory(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs;
}
async function noFollow(path, label, directory = false) {
  const flags = constants.O_RDONLY | constants.O_CLOEXEC | (constants.O_NOFOLLOW ?? 0) | (directory ? constants.O_DIRECTORY : 0);
  try { return await open(path, flags); } catch (error) { fail(`${label} cannot be opened without following a symlink: ${error?.code ?? "unknown"}`); }
}
function operations(handle, label) {
  const fd = APPLY(FILE_HANDLE.fd, handle, []);
  const close = Object.getOwnPropertyDescriptor(handle, "close");
  if (!Number.isSafeInteger(fd) || fd < 0 || close === undefined || !("value" in close) || typeof close.value !== "function") fail(`${label} lacks a valid descriptor`);
  /* Native FileHandle methods consult `this.fd`; shadow the prototype accessor
   * with the captured data value before returning control to any caller. */
  Object.defineProperty(handle, "fd", { value: fd, configurable: false, enumerable: false, writable: false });
  return freeze({ close: (...args) => APPLY(close.value, handle, args), fd,
    read: (...args) => APPLY(FILE_HANDLE.read, handle, args), stat: (...args) => APPLY(FILE_HANDLE.stat, handle, args) });
}
async function capturedFile(path, label) {
  const before = fileIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
  let ops = null;
  try {
    ops = operations(await noFollow(path, label), label);
    const descriptor = fileIdentity(await ops.stat({ bigint: true }), `${label} descriptor`);
    const after = fileIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
    if (!sameFile(before, descriptor) || !sameFile(before, after)) fail(`${label} changed while it was opened`);
    return { label, path, identity: descriptor, ops };
  } catch (error) { if (ops !== null) try { await ops.close(); } catch {} throw error; }
}
async function capturedDirectory(path, label) {
  const before = directoryIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
  let ops = null;
  try {
    ops = operations(await noFollow(path, label, true), label);
    const descriptor = directoryIdentity(await ops.stat({ bigint: true }), `${label} descriptor`);
    const after = directoryIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
    if (!sameDirectory(before, descriptor) || !sameDirectory(before, after)) fail(`${label} changed while it was opened`);
    return { label, path, identity: descriptor, ops };
  } catch (error) { if (ops !== null) try { await ops.close(); } catch {} throw error; }
}
async function capturedDirectoryAt(parent, name, label) { return capturedDirectory(fdPath(parent.ops.fd, name), label); }
async function readCaptured(record, directory = undefined) {
  if (directory !== undefined) {
    const descriptor = directoryIdentity(await directory.ops.stat({ bigint: true }), "reproduction package directory descriptor");
    if (!sameDirectory(directory.identity, descriptor)) fail("reproduction package directory became stale");
    if (directory.path !== null) {
      const pathname = directoryIdentity(await lstat(directory.path, { bigint: true }), "reproduction package directory pathname");
      if (!sameDirectory(directory.identity, pathname)) fail("reproduction package directory became stale");
    }
  }
  const before = fileIdentity(await record.ops.stat({ bigint: true }), "comparison input descriptor");
  const pathname = fileIdentity(await lstat(record.path, { bigint: true }), "comparison input pathname");
  if (!sameFile(record.identity, before) || !sameFile(record.identity, pathname)) fail("comparison input became stale");
  if (record.identity.size > BigInt(Number.MAX_SAFE_INTEGER)) fail("comparison input exceeds exact JavaScript byte range");
  const bytes = Buffer.alloc(Number(record.identity.size)); let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesRead } = await record.ops.read(bytes, offset, bytes.byteLength - offset, offset);
    if (bytesRead <= 0) fail("comparison input changed while read"); offset += bytesRead;
  }
  const extra = Buffer.alloc(1); if ((await record.ops.read(extra, 0, 1, offset)).bytesRead !== 0) fail("comparison input grew while read");
  const after = fileIdentity(await record.ops.stat({ bigint: true }), "comparison input descriptor");
  const afterPath = fileIdentity(await lstat(record.path, { bigint: true }), "comparison input pathname");
  if (!sameFile(record.identity, after) || !sameFile(record.identity, afterPath)) fail("comparison input changed while read");
  return bytes;
}
async function closeAll(records, hooks = null) {
  let failure = null;
  for (const record of records.reverse()) if (record !== null) {
    try { if (hooks?.beforeClose !== undefined) await hooks.beforeClose(record.label); } catch (error) { failure ??= error; }
    try { await record.ops.close(); } catch (error) { failure ??= error; }
  }
  if (failure !== null) throw failure;
}
function inputFromDerived(derived, sourceMapSha256) {
  const candidate = derived.candidate;
  return freeze({ retainedEvidenceCandidateSha256: derived.candidateSha256, logicalManifestSha256: candidate.logicalManifestSha256, sourceMapSha256,
    sourceRevision: candidate.source.revision, sourceTree: candidate.source.tree, sourceClosureSha256: candidate.source.closureSha256,
    artifactSetSha256: candidate.artifacts.setSha256, toolchainSetSha256: candidate.toolchain.setSha256 });
}
function sameAxis(inputs, key) { return inputs.every(input => input[key] === inputs[0][key]); }
function sortInput(left, right) { return canonical(left).localeCompare(canonical(right)); }

async function capturePackageDirectory(packagePath, index) {
  const root = await capturedDirectory(ROOT, "comparison repository root"); let build = null; let cadr = null; let directory = null;
  try {
    build = await capturedDirectoryAt(root, "build", "comparison build root");
    cadr = await capturedDirectoryAt(build, "cadr-m14", "comparison CADR build root");
    directory = await capturedDirectoryAt(cadr, basename(packagePath), `reproduction ${index} package directory`);
    directory.path = null;
    const ancestry = freeze({ root: root.identity, build: build.identity, cadr: cadr.identity, package: directory.identity });
    await closeAll([root, build, cadr]); return { directory, ancestry };
  } catch (error) { await closeAll([root, build, cadr, directory].filter(Boolean)); throw error; }
}
async function revalidatePackageDirectory(record, packagePath, index) {
  const current = await capturePackageDirectory(packagePath, index);
  try {
    for (const key of ["root", "build", "cadr", "package"]) {
      const left = record.ancestry[key]; const right = current.ancestry[key];
      if (left.dev !== right.dev || left.ino !== right.ino) fail(`reproduction ${index} ancestor ${key} became stale`);
    }
    const held = directoryIdentity(await record.directory.ops.stat({ bigint: true }), `reproduction ${index} held package descriptor`);
    if (held.dev !== record.ancestry.package.dev || held.ino !== record.ancestry.package.ino) fail(`reproduction ${index} held package became stale`);
  } finally { await closeAll([current.directory]); }
}
async function captureReproduction(value, index) {
  const fields = ownData(value, `reproduction ${index}`, ["packagePath"]);
  safeBuildPath(fields.packagePath, index);
  const packageCapture = await capturePackageDirectory(fields.packagePath, index); const directory = packageCapture.directory;
  let manifest = null; let sourceMap = null;
  try {
    manifest = await capturedFile(fdPath(directory.ops.fd, "logical-build-manifest.json"), `reproduction ${index} logical manifest`);
    sourceMap = await capturedFile(fdPath(directory.ops.fd, "source-map.json"), `reproduction ${index} source map`);
    return { directory, manifest, sourceMap, ancestry: packageCapture.ancestry, packagePath: fields.packagePath };
  } catch (error) { await closeAll([sourceMap, manifest, directory].filter(Boolean)); throw error; }
}

async function loadReproduction(value, index, policy, hooks = null) {
  const captured = await captureReproduction(value, index);
  try {
    if (hooks?.afterInputsOpen !== undefined) await hooks.afterInputsOpen(index);
    await revalidatePackageDirectory(captured, captured.packagePath, index);
    const [manifestBytes, sourceMapBytes] = await Promise.all([readCaptured(captured.manifest, captured.directory), readCaptured(captured.sourceMap, captured.directory)]);
    await revalidatePackageDirectory(captured, captured.packagePath, index);
    let manifest;
    try { manifest = JSON.parse(manifestBytes.toString("utf8")); } catch { fail(`reproduction ${index} logical manifest is not JSON`); }
    const sourceMapSha256 = hash(sourceMapBytes);
    if (manifest.sourceMapSha256 !== sourceMapSha256) fail(`reproduction ${index} source map differs from its retained logical manifest binding`);
    let derived; try { derived = deriveM14EvidenceCandidate(manifestBytes, policy); } catch (error) { fail(`reproduction ${index} is not an exact M14 evidence candidate: ${error?.message ?? "unknown"}`); }
    return { input: inputFromDerived(derived, sourceMapSha256),
      identities: [captured.directory.identity, captured.manifest.identity, captured.sourceMap.identity] };
  } finally { await closeAll([captured.sourceMap, captured.manifest, captured.directory], hooks); }
}

function comparisonFields(value) {
  const fields = ownData(value, "static comparison", ["comparator", "cw4Status", "evidenceDisposition", "evidenceEngine", "evidencePolicySha256",
    "independentProductionStatus", "inputs", "m14FinalReproductionStatus", "matches", "outcome", "profile", "releaseClaim", "schema"]);
  if (fields.schema !== "cadr-m14-static-reproduction-comparison-v1" || fields.profile !== PROFILE || fields.releaseClaim !== "none" ||
      fields.evidenceDisposition !== "unadmitted-static-comparison" || fields.independentProductionStatus !== "not-evaluated" ||
      fields.m14FinalReproductionStatus !== "not-evaluated" || fields.cw4Status !== "not-evaluated" ||
      !["exact-static-candidate-match", "static-difference-observed"].includes(fields.outcome)) fail("static comparison has an invalid nonclaim status");
  sha256(fields.evidencePolicySha256, "comparison evidence policy SHA-256");
  const comparator = ownData(fields.comparator, "comparison comparator", ["evaluationSha256", "path", "sha256"]);
  if (comparator.path !== "scripts/cadr-m14-static-reproduction-comparison.mjs") fail("comparison comparator path differs");
  sha256(comparator.sha256, "comparison comparator SHA-256");
  if (comparator.evaluationSha256 !== comparator.sha256) fail("comparison comparator evaluation identity differs");
  const evidenceEngine = ownData(fields.evidenceEngine, "comparison evidence engine", ["evaluationSha256", "path", "sha256"]);
  if (evidenceEngine.path !== "scripts/cadr-m14-evidence.mjs") fail("comparison evidence engine path differs");
  sha256(evidenceEngine.sha256, "comparison evidence engine SHA-256");
  if (evidenceEngine.evaluationSha256 !== evidenceEngine.sha256) fail("comparison evidence engine evaluation identity differs");
  if (!Array.isArray(fields.inputs) || fields.inputs.length !== 2) fail("comparison must contain exactly two inputs");
  const inputs = [];
  for (const [index, input] of fields.inputs.entries()) {
    const entry = ownData(input, `comparison input ${index}`, ["artifactSetSha256", "logicalManifestSha256", "retainedEvidenceCandidateSha256", "sourceMapSha256",
      "sourceClosureSha256", "sourceRevision", "sourceTree", "toolchainSetSha256"]);
    for (const key of ["artifactSetSha256", "logicalManifestSha256", "retainedEvidenceCandidateSha256", "sourceMapSha256", "sourceClosureSha256", "toolchainSetSha256"]) sha256(entry[key], `comparison input ${index} ${key}`);
    git(entry.sourceRevision, `comparison input ${index} source revision`); git(entry.sourceTree, `comparison input ${index} source tree`);
    inputs.push(entry);
  }
  if (canonical(inputs[0]) > canonical(inputs[1])) fail("comparison inputs are not canonically sorted");
  const matches = ownData(fields.matches, "comparison matches", ["artifactSet", "logicalManifest", "sourceClosure", "sourceIdentity", "toolchainSet"]);
  if (Object.values(matches).some(value => typeof value !== "boolean")) fail("comparison matches must be booleans");
  const expected = { logicalManifest: sameAxis(inputs, "logicalManifestSha256"),
    sourceIdentity: sameAxis(inputs, "sourceRevision") && sameAxis(inputs, "sourceTree"), sourceClosure: sameAxis(inputs, "sourceClosureSha256"),
    artifactSet: sameAxis(inputs, "artifactSetSha256"), toolchainSet: sameAxis(inputs, "toolchainSetSha256") };
  if (canonical(matches) !== canonical(expected)) fail("comparison match axes disagree with its inputs");
  const allMatch = Object.values(matches).every(Boolean);
  if ((allMatch && fields.outcome !== "exact-static-candidate-match") || (!allMatch && fields.outcome !== "static-difference-observed")) {
    fail("comparison outcome disagrees with its match axes");
  }
  return fields;
}

function assertDistinctDescriptors(records) {
  const seen = new Set();
  for (const record of records) {
    const key = `${record.dev}:${record.ino}`;
    if (seen.has(key)) fail("captured comparison descriptors must have pairwise distinct device/inode identities");
    seen.add(key);
  }
}

/** Validate the exact ordinary-data report accepted as future publication payload. */
export function assertCadrM14StaticReproductionComparison(value) {
  if (value === null || typeof value !== "object" || !Object.isFrozen(value) || !COMPARISONS.has(value)) {
    fail("comparison is not an exact module-created report");
  }
  comparisonFields(value); return value;
}

/** Compare exactly two independently captured M14 packages. */
export async function compareCadrM14StaticReproductions(options) {
  const fields = optionalData(options, "comparison options", ["expectedComparatorSha256", "expectedEvidenceEngineSha256", "expectedEvidencePolicySha256", "reproductions", "testHooks"]);
  if (fields.expectedComparatorSha256 === undefined || fields.expectedEvidenceEngineSha256 === undefined || fields.expectedEvidencePolicySha256 === undefined || fields.reproductions === undefined) fail("comparison options has missing fields");
  const expectedComparatorSha256 = sha256(fields.expectedComparatorSha256, "expected comparator SHA-256");
  const expectedEvidenceEngineSha256 = sha256(fields.expectedEvidenceEngineSha256, "expected evidence engine SHA-256");
  const expectedEvidencePolicySha256 = sha256(fields.expectedEvidencePolicySha256, "expected evidence policy SHA-256");
  if (new Set([expectedComparatorSha256, expectedEvidenceEngineSha256, expectedEvidencePolicySha256]).size !== 3) fail("independent policy, comparator, and evidence-engine pins must differ");
  if (expectedComparatorSha256 !== CADR_M14_COMPARATOR_EVALUATION_SHA256) fail("comparator caller pin differs from the executing module identity");
  if (expectedEvidenceEngineSha256 !== CADR_M14_EVIDENCE_ENGINE_EVALUATION_SHA256) fail("evidence engine caller pin differs from the executing module identity");
  if (!Array.isArray(fields.reproductions) || fields.reproductions.length !== 2) fail("comparison requires exactly two reproductions");
  const hooks = fields.testHooks === undefined ? null : TEST_HOOKS.get(fields.testHooks);
  if (fields.testHooks !== undefined && hooks === undefined) fail("comparison test hooks are not recognized");
  let policy = null; let comparator = null; let engine = null;
  try {
    policy = await capturedFile(EVIDENCE_POLICY, "evidence policy"); comparator = await capturedFile(COMPARATOR, "comparator"); engine = await capturedFile(EVIDENCE_ENGINE, "evidence engine");
    const [policyBytes, comparatorBytes, engineBytes] = await Promise.all([readCaptured(policy), readCaptured(comparator), readCaptured(engine)]);
    if (hash(policyBytes) !== expectedEvidencePolicySha256) fail("evidence policy differs from caller's independent pin");
    if (hash(comparatorBytes) !== expectedComparatorSha256) fail("comparator differs from caller's independent pin");
    if (hash(engineBytes) !== expectedEvidenceEngineSha256) fail("evidence engine differs from caller's independent pin");
    let evidencePolicy; try { evidencePolicy = JSON.parse(policyBytes.toString("utf8")); validateM14EvidencePolicy(evidencePolicy); }
    catch (error) { fail(`evidence policy is not exact: ${error?.message ?? "unknown"}`); }
    const [left, right] = await Promise.all([loadReproduction(fields.reproductions[0], 0, evidencePolicy, hooks),
      loadReproduction(fields.reproductions[1], 1, evidencePolicy, hooks)]);
    assertDistinctDescriptors([policy.identity, comparator.identity, engine.identity, ...left.identities, ...right.identities]);
    const inputs = [left.input, right.input].sort(sortInput);
    const matches = freeze({ logicalManifest: sameAxis(inputs, "logicalManifestSha256"),
      sourceIdentity: sameAxis(inputs, "sourceRevision") && sameAxis(inputs, "sourceTree"),
      sourceClosure: sameAxis(inputs, "sourceClosureSha256"), artifactSet: sameAxis(inputs, "artifactSetSha256"),
      toolchainSet: sameAxis(inputs, "toolchainSetSha256") });
    const report = freeze({ schema: "cadr-m14-static-reproduction-comparison-v1", profile: PROFILE, releaseClaim: "none",
      evidenceDisposition: "unadmitted-static-comparison", independentProductionStatus: "not-evaluated",
      m14FinalReproductionStatus: "not-evaluated", cw4Status: "not-evaluated", evidencePolicySha256: expectedEvidencePolicySha256,
      comparator: freeze({ path: "scripts/cadr-m14-static-reproduction-comparison.mjs", sha256: expectedComparatorSha256,
        evaluationSha256: CADR_M14_COMPARATOR_EVALUATION_SHA256 }),
      evidenceEngine: freeze({ path: "scripts/cadr-m14-evidence.mjs", sha256: expectedEvidenceEngineSha256,
        evaluationSha256: CADR_M14_EVIDENCE_ENGINE_EVALUATION_SHA256 }),
      inputs, matches, outcome: Object.values(matches).every(Boolean) ? "exact-static-candidate-match" : "static-difference-observed" });
    COMPARISONS.add(report); return report;
  } finally { await closeAll([engine, comparator, policy].filter(Boolean), hooks); }
}

export function serializeCadrM14StaticReproductionComparison(value) {
  assertCadrM14StaticReproductionComparison(value); return `${canonical(value)}\n`;
}

/** Synthetic race hooks; production callers cannot forge their opaque token. */
export function createCadrM14StaticReproductionComparisonTestHooks(options = undefined) {
  const fields = optionalData(options, "comparison test hook options", ["afterInputsOpen", "beforeClose"]);
  for (const [name, value] of Object.entries(fields)) if (value !== undefined && typeof value !== "function") fail(`comparison test hook ${name} must be a function`);
  const token = Object.freeze(Object.create(null)); TEST_HOOKS.set(token, freeze(fields)); return token;
}
