#!/usr/bin/env node
/*
 * M14 receipt admission and aggregation.
 *
 * This is deliberately a pure, fail-closed boundary.  The production registry
 * below contains no adapters: changing a gate requires a later review that
 * adds both a policy registration and a compiled case adapter.  The exported
 * functions accept an injected registry only for synthetic conformance tests.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/* The evaluator records the bytes of this module at its own top level.  A
 * later pathname replacement cannot be blessed merely by changing a caller's
 * requested pin: consumers require their retained descriptor bytes, the
 * caller pin, and this evaluation-time identity to agree. */
const MODULE_PATH = fileURLToPath(import.meta.url);
export const CADR_M14_EVIDENCE_ENGINE_EVALUATION_SHA256 = createHash("sha256")
  .update(await readFile(MODULE_PATH)).digest("hex");
const ROOT = resolve(dirname(MODULE_PATH), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-m14");
const TRUSTED_GIT = "/usr/bin/git";
const exec = promisify(execFile);
export const CADR_M14_EVIDENCE_POLICY_SCHEMA = "cadr-m14-evidence-policy-v1";
export const CADR_M14_EVIDENCE_CANDIDATE_SCHEMA = "cadr-m14-evidence-candidate-v1";
export const CADR_M14_EVIDENCE_RECEIPT_SCHEMA = "cadr-m14-evidence-receipt-v1";
export const CADR_M14_ADMITTED_EVIDENCE_SCHEMA = "cadr-m14-admitted-evidence-v1";
export const CADR_M14_EVIDENCE_AGGREGATION_SCHEMA = "cadr-m14-evidence-aggregation-v1";
export const CADR_M14_PRODUCTION_ADAPTER_REGISTRY = new Map();
const ADMITTED_RECORDS = new WeakSet();

const SHA256 = /^[0-9a-f]{64}$/u;
const GIT_SHA1 = /^[0-9a-f]{40}$/u;
const PRIVATE_OR_MACHINE_ABSOLUTE = /(?:^|[^A-Za-z0-9_~-])(?:\/|\\)+(?=\S)|[A-Za-z]:[\\/]+|\bfile:\/\/+|~(?:[A-Za-z0-9_.-]+)?[\\/]/iu;
const OUTCOMES = new Set(["pass", "conformance-failure", "infrastructure-failure", "incomplete"]);
const CLEANUP = new Set(["verified-clean", "verified-forced-test-termination", "failed", "unknown"]);
const DOD_CLAUSES = new Map([
  ["CW4-DOD-01", "the selected System 303 profile boots reproducibly in a browser worker"],
  ["CW4-DOD-02", "native and WASM processor/device traces pass the declared differential suites"],
  ["CW4-DOD-03", "every CADR key and pointer operation is reachable"],
  ["CW4-DOD-04", "the logical framebuffer is pixel-identical at selected checkpoints"],
  ["CW4-DOD-05", "private disk state is crash-consistent, exportable, and tied to an immutable base"],
  ["CW4-DOD-06", "pause, reset, failure, and worker termination cannot be mistaken for saved state"],
  ["CW4-DOD-07", "the default build performs no network traffic"],
  ["CW4-DOD-08", "all bundled artifacts have established distribution provenance"],
  ["CW4-DOD-09", "the build and conformance report are reproducible"],
  ["CW4-DOD-10", "remaining physical-device or timing gaps are named optional profiles"],
]);
const GATE_DOD = new Map([
  ["CW0", ["CW4-DOD-02"]],
  ["CW1", ["CW4-DOD-01", "CW4-DOD-02"]],
  ["CW2", ["CW4-DOD-03", "CW4-DOD-04", "CW4-DOD-06"]],
  ["CW3", ["CW4-DOD-05", "CW4-DOD-06"]],
  ["CW4", ["CW4-DOD-07", "CW4-DOD-08", "CW4-DOD-09", "CW4-DOD-10"]],
]);
const STABLE_REGISTRY_SHA256 = "0157612196aee478d6c4977a03415fe0498bc22eae0d4ca0ecf54bdeaa7c1321";

function fail(message) { throw new TypeError(`C-M14 evidence: ${message}`); }
export function cadrM14EvidenceSha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function cadrM14EvidenceCanonical(value) {
  if (Array.isArray(value)) return `[${value.map(cadrM14EvidenceCanonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${cadrM14EvidenceCanonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function ownData(value, label, { allowFrozen = false } = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail(`${label} must be a plain object`);
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!("value" in descriptor) || !descriptor.enumerable || (!allowFrozen && (!descriptor.configurable || !descriptor.writable))) {
      fail(`${label}.${key} must be an ordinary enumerable data property`);
    }
  }
  return value;
}
function exactKeys(value, keys, label, options = undefined) {
  ownData(value, label, options);
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    fail(`${label} has missing or extra fields`);
  }
}
function publicText(value, label, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) fail(`${label} must be a ${allowEmpty ? "string" : "nonempty string"}`);
  if (PRIVATE_OR_MACHINE_ABSOLUTE.test(value)) fail(`${label} contains a private or machine absolute path`);
  return value;
}
function sha256(value, label) { if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be SHA-256`); return value; }
function gitSha(value, label) { if (typeof value !== "string" || !GIT_SHA1.test(value)) fail(`${label} must be a Git SHA-1`); return value; }
function stringArray(value, label, { unique = true } = {}) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  for (const [index, item] of value.entries()) publicText(item, `${label}[${index}]`);
  if (unique && new Set(value).size !== value.length) fail(`${label} has duplicates`);
  return value;
}
function canonicalRelative(value, label) {
  publicText(value, label);
  if (isAbsolute(value) || value.includes("\\") || value.includes("//")) fail(`${label} must be a canonical relative slash path`);
  const parts = value.split("/");
  if (parts.some(part => part.length === 0 || part === "." || part === "..")) fail(`${label} escapes its confinement`);
  return parts;
}
function canonicalAbsolute(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a nonempty path string`);
  if (!isAbsolute(value) || value !== resolve(value) || value.includes("//") || value.includes("/./") ||
      value.includes("/../") || value.endsWith("/.") || value.endsWith("/..")) fail(`${label} must be a canonical absolute path`);
  return value;
}
function canonicalJson(bytes, label) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (!bytes.toString("utf8").endsWith("\n")) fail(`${label} lacks a canonical terminal LF`);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); } catch { fail(`${label} is not JSON`); }
  assertJsonData(value, label);
  if (!Buffer.from(`${cadrM14EvidenceCanonical(value)}\n`).equals(bytes)) fail(`${label} is not canonical JSON`);
  return value;
}
function assertJsonData(value, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) fail(`${label} has a non-finite number`); return; }
  if (Array.isArray(value)) { for (const [index, item] of value.entries()) assertJsonData(item, `${label}[${index}]`); return; }
  ownData(value, label);
  for (const [key, item] of Object.entries(value)) assertJsonData(item, `${label}.${key}`);
}
function deepFreezeJson(value) {
  if (value !== null && typeof value === "object") {
    for (const item of Array.isArray(value) ? value : Object.values(value)) deepFreezeJson(item);
    Object.freeze(value);
  }
  return value;
}
async function directoryNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`${label} must be a non-symlink directory`);
  return info;
}
async function fileNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} must be a non-symlink regular file`);
  return info;
}
async function confined(root, absolute, label, finalKind) {
  canonicalAbsolute(absolute, label); await directoryNonSymlink(root, `${label} confinement root`);
  const parts = canonicalRelative(relative(root, absolute), label); let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part); const info = await lstat(current);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link component: ${part}`);
    if (index + 1 < parts.length && !info.isDirectory()) fail(`${label} has a non-directory ancestor`);
    if (index + 1 === parts.length && ((finalKind === "file" && !info.isFile()) ||
      (finalKind === "directory" && !info.isDirectory()))) fail(`${label} has the wrong final entry type`);
  }
  return current;
}
function hashCanonical(value) { return cadrM14EvidenceSha256(Buffer.from(`${cadrM14EvidenceCanonical(value)}\n`)); }
function sorted(value) { return [...value].sort((left, right) => left.localeCompare(right)); }

function validateAuthority(record, index) {
  exactKeys(record, ["id", "programSha256", "executableSha256", "programClosureSha256"], `authority ${index}`);
  publicText(record.id, `authority ${index} id`); sha256(record.programSha256, `authority ${index} programSha256`);
  sha256(record.executableSha256, `authority ${index} executableSha256`);
  sha256(record.programClosureSha256, `authority ${index} programClosureSha256`);
}
function validateCase(record, index, policy) {
  exactKeys(record, ["id", "milestone", "milestoneProfile", "evidenceClass", "resultSchema", "adapterId",
    "producerAuthorityId", "verifierAuthorityId", "supportsDoD", "resolvesBlockers", "cleanupStates"], `case ${index}`);
  for (const key of ["id", "milestone", "milestoneProfile", "evidenceClass", "resultSchema"]) publicText(record[key], `case ${index} ${key}`);
  for (const key of ["adapterId", "producerAuthorityId", "verifierAuthorityId"]) {
    if (record[key] !== null) publicText(record[key], `case ${index} ${key}`);
  }
  stringArray(record.supportsDoD, `case ${index} supportsDoD`); stringArray(record.resolvesBlockers, `case ${index} resolvesBlockers`);
  stringArray(record.cleanupStates, `case ${index} cleanupStates`);
  if (record.cleanupStates.some(state => !CLEANUP.has(state))) fail(`case ${index} has an unknown cleanup state`);
  const futureOnly = policy.authorities.length === 0;
  if (futureOnly && (record.adapterId !== null || record.producerAuthorityId !== null || record.verifierAuthorityId !== null)) {
    fail(`case ${index} must be unregistered while the production authority set is empty`);
  }
}
export function validateM14EvidencePolicy(policy) {
  exactKeys(policy, ["schema", "profile", "releaseClaim", "admissionStatus", "logicalManifestSchema", "authorities",
    "cases", "blockers", "definitionOfDone", "gates"], "evidence policy");
  if (policy.schema !== CADR_M14_EVIDENCE_POLICY_SCHEMA || policy.profile !== "CADR-WEB-303/CW4-MUSEUM" ||
      policy.releaseClaim !== "disabled" || policy.admissionStatus !== "future-cases-only" ||
      policy.logicalManifestSchema !== "cadr-m14-logical-build-manifest-v2" ||
      !Array.isArray(policy.authorities) || !Array.isArray(policy.cases) || !Array.isArray(policy.blockers) ||
      !Array.isArray(policy.definitionOfDone) || !Array.isArray(policy.gates)) fail("evidence policy has the wrong bounded profile");
  const authorities = new Map();
  for (const [index, record] of policy.authorities.entries()) {
    validateAuthority(record, index); if (authorities.has(record.id)) fail("evidence policy has duplicate authority IDs");
    authorities.set(record.id, record);
  }
  const cases = new Map();
  for (const [index, record] of policy.cases.entries()) {
    validateCase(record, index, policy); if (cases.has(record.id)) fail("evidence policy has duplicate case IDs"); cases.set(record.id, record);
  }
  const blockers = new Map();
  for (const [index, record] of policy.blockers.entries()) {
    exactKeys(record, ["id", "milestone", "blocks", "caseIds"], `blocker ${index}`);
    publicText(record.id, `blocker ${index} id`); publicText(record.milestone, `blocker ${index} milestone`);
    stringArray(record.blocks, `blocker ${index} blocks`); stringArray(record.caseIds, `blocker ${index} caseIds`);
    if (blockers.has(record.id) || record.caseIds.some(id => !cases.has(id) || cases.get(id).milestone !== record.milestone)) fail("evidence policy blocker has duplicate or foreign case IDs");
    blockers.set(record.id, record);
  }
  const dod = new Map();
  for (const [index, record] of policy.definitionOfDone.entries()) {
    exactKeys(record, ["id", "requiredCases", "requiredBlockers"], `definition-of-done ${index}`);
    publicText(record.id, `definition-of-done ${index} id`); stringArray(record.requiredCases, `definition-of-done ${index} requiredCases`);
    stringArray(record.requiredBlockers, `definition-of-done ${index} requiredBlockers`);
    if (dod.has(record.id) || record.requiredCases.some(id => !cases.has(id)) ||
        record.requiredBlockers.some(id => !blockers.has(id))) fail("evidence policy definition-of-done is unresolved");
    dod.set(record.id, record);
  }
  const gates = new Map();
  for (const [index, record] of policy.gates.entries()) {
    exactKeys(record, ["id", "requiredDoD"], `policy gate ${index}`); publicText(record.id, `policy gate ${index} id`);
    stringArray(record.requiredDoD, `policy gate ${index} requiredDoD`);
    if (gates.has(record.id) || record.requiredDoD.some(id => !dod.has(id))) fail("evidence policy gate has unresolved definition-of-done");
    gates.set(record.id, record);
  }
  if (cases.size !== 20 || blockers.size !== 20 || dod.size !== 10 || gates.size !== 5 ||
      [...gates.keys()].join("\u0000") !== "CW0\u0000CW1\u0000CW2\u0000CW3\u0000CW4") fail("evidence policy does not retain the full future M6-M14 registry");
  for (const [id, requiredDoD] of GATE_DOD) if (cadrM14EvidenceCanonical(gates.get(id).requiredDoD) !== cadrM14EvidenceCanonical(requiredDoD)) {
    fail("evidence policy gate mapping differs from the normative CW profile");
  }
  for (const record of cases.values()) {
    if (record.supportsDoD.some(id => !dod.has(id)) || record.resolvesBlockers.some(id => !blockers.has(id))) fail("case mapping is unresolved");
    for (const id of record.supportsDoD) if (!dod.get(id).requiredCases.includes(record.id)) {
      fail("case and definition-of-done mappings disagree");
    }
    for (const id of record.resolvesBlockers) if (!blockers.get(id).caseIds.includes(record.id)) fail("case and blocker mappings disagree");
  }
  for (const record of dod.values()) for (const id of record.requiredCases) {
    if (!cases.get(id).supportsDoD.includes(record.id)) fail("definition-of-done and case mappings disagree");
  }
  for (const record of blockers.values()) for (const id of record.caseIds) {
    if (!cases.get(id).resolvesBlockers.includes(record.id)) fail("blocker and case mappings disagree");
  }
  for (const record of blockers.values()) for (const id of record.blocks) {
    if (!dod.get(id).requiredBlockers.includes(record.id)) fail("blocker and definition-of-done mappings disagree");
  }
  for (const record of dod.values()) for (const id of record.requiredBlockers) {
    if (!blockers.get(id).blocks.includes(record.id)) fail("definition-of-done and blocker mappings disagree");
  }
  const stableRegistry = {
    cases: policy.cases.map(({ adapterId: _adapterId, producerAuthorityId: _producerAuthorityId,
      verifierAuthorityId: _verifierAuthorityId, ...record }) => record),
    blockers: policy.blockers, definitionOfDone: policy.definitionOfDone, gates: policy.gates,
  };
  if (hashCanonical(stableRegistry) !== STABLE_REGISTRY_SHA256) fail("evidence policy differs from the exact stable M6-M14 registry");
  return { authorities, cases, blockers, dod, gates };
}
export function validateM14EvidenceGates(gates, policy, policySha256) {
  const parsed = validateM14EvidencePolicy(policy); sha256(policySha256, "evidence policy SHA-256");
  exactKeys(gates, ["schema", "releaseClaim", "evidenceAuthority", "evidencePolicy", "gates", "unresolvedMilestoneBlockers", "cw4DefinitionOfDone"], "conformance gates");
  exactKeys(gates.evidenceAuthority, ["receiptAdmission", "manualStatus", "freeFormEvidence", "releaseClaim"], "conformance-gate evidence authority");
  exactKeys(gates.evidencePolicy, ["schema", "path", "sha256"], "conformance-gate evidence policy identity");
  if (parsed.authorities.size !== 0 || gates.schema !== "cadr-m14-evidence-qualified-gates-v3" || gates.releaseClaim !== "none" ||
      gates.evidenceAuthority.receiptAdmission !== "registered-case-adapters-required-production-registry-empty" ||
      gates.evidenceAuthority.manualStatus !== "cannot-advance" || gates.evidenceAuthority.freeFormEvidence !== "cannot-advance" ||
      gates.evidenceAuthority.releaseClaim !== "disabled-by-policy-v1" ||
      gates.evidencePolicy.schema !== CADR_M14_EVIDENCE_POLICY_SCHEMA ||
      gates.evidencePolicy.path !== "cadr-web/release/cadr-m14-evidence-policy.json" || gates.evidencePolicy.sha256 !== policySha256) {
    fail("conformance gates do not bind the exact evidence policy");
  }
  if (!Array.isArray(gates.gates) || !Array.isArray(gates.cw4DefinitionOfDone) || !Array.isArray(gates.unresolvedMilestoneBlockers) ||
      gates.gates.length !== parsed.gates.size || gates.cw4DefinitionOfDone.length !== parsed.dod.size ||
      gates.unresolvedMilestoneBlockers.length !== 9) fail("conformance gates are incomplete");
  const gateValues = new Map(gates.gates.map((record, index) => {
    exactKeys(record, ["id", "state", "requiredDoD"], `conformance gate ${index}`); stringArray(record.requiredDoD, `conformance gate ${index} requiredDoD`);
    if (record.state !== "not-evaluated" || !parsed.gates.has(record.id) ||
      cadrM14EvidenceCanonical(record.requiredDoD) !== cadrM14EvidenceCanonical(parsed.gates.get(record.id).requiredDoD)) fail("conformance gate differs from policy");
    return [record.id, record];
  }));
  if (gateValues.size !== parsed.gates.size) fail("conformance gates have duplicate IDs");
  const dodValues = new Map(gates.cw4DefinitionOfDone.map((record, index) => {
    exactKeys(record, ["id", "clause", "blockingMilestones"], `definition-of-done ${index}`); publicText(record.clause, `definition-of-done ${index} clause`);
    stringArray(record.blockingMilestones, `definition-of-done ${index} blockingMilestones`);
    if (!parsed.dod.has(record.id) || DOD_CLAUSES.get(record.id) !== record.clause) fail("conformance gate definition-of-done is unknown or differs from the stable clause"); return [record.id, record];
  }));
  if (dodValues.size !== parsed.dod.size) fail("conformance gates duplicate a definition-of-done");
  const blockerIds = new Set();
  for (const [index, milestone] of gates.unresolvedMilestoneBlockers.entries()) {
    exactKeys(milestone, ["milestone", "state", "blocks", "blockers"], `milestone blocker ${index}`);
    publicText(milestone.milestone, `milestone blocker ${index} milestone`); stringArray(milestone.blocks, `milestone blocker ${index} blocks`);
    if (milestone.state !== "unresolved" || !Array.isArray(milestone.blockers) || milestone.blockers.length === 0) fail("milestone blocker is malformed");
    const expected = [...parsed.blockers.values()].filter(record => record.milestone === milestone.milestone);
    if (expected.length !== milestone.blockers.length || milestone.blocks.some(id => !dodValues.has(id))) fail("milestone blocker mapping is incomplete");
    for (const [blockerIndex, blocker] of milestone.blockers.entries()) {
      exactKeys(blocker, ["id", "text"], `milestone blocker ${index} entry ${blockerIndex}`); publicText(blocker.id, `milestone blocker ${index} entry ${blockerIndex} id`); publicText(blocker.text, `milestone blocker ${index} entry ${blockerIndex} text`);
      if (blockerIds.has(blocker.id) || !expected.some(value => value.id === blocker.id)) fail("milestone blocker ID is duplicate or unknown"); blockerIds.add(blocker.id);
    }
    const expectedBlocks = sorted(new Set(expected.flatMap(record => record.blocks)));
    if (cadrM14EvidenceCanonical(sorted(milestone.blocks)) !== cadrM14EvidenceCanonical(expectedBlocks)) fail("milestone blocker definition-of-done mapping differs from policy");
  }
  if (blockerIds.size !== parsed.blockers.size) fail("conformance gates omit a stable blocker ID");
  for (const [id, record] of parsed.dod) {
    const expectedMilestones = [...new Set([...parsed.blockers.values()].filter(blocker => blocker.blocks.includes(id)).map(blocker => blocker.milestone))];
    const actual = dodValues.get(id);
    if (actual === undefined || cadrM14EvidenceCanonical(actual.blockingMilestones) !== cadrM14EvidenceCanonical(expectedMilestones)) fail("definition-of-done inverse milestone mapping differs from policy");
  }
  return parsed;
}

function validateLogicalManifest(manifest, policy) {
  exactKeys(manifest, ["schema", "profile", "status", "releaseClaim", "logicalEpoch", "closedInventoryStatus", "offlineRuntimeStatus", "fileModePolicy", "buildProvenance", "sourceMapSha256", "unresolvedComponents", "excludedPrivateInputs", "files"], "logical manifest");
  if (manifest.schema !== policy.logicalManifestSchema || manifest.profile !== policy.profile ||
      !["scaffold-only", "release-candidate"].includes(manifest.status) || manifest.releaseClaim !== "none" ||
      !Number.isSafeInteger(manifest.logicalEpoch) || !Array.isArray(manifest.files)) fail("logical manifest is not an exact M14 candidate input");
  sha256(manifest.sourceMapSha256, "logical manifest sourceMapSha256");
  exactKeys(manifest.buildProvenance, ["git", "node", "generator", "directInputs"], "logical manifest build provenance");
  exactKeys(manifest.buildProvenance.git, ["revision", "tree", "version", "executableSha256"], "logical manifest Git provenance");
  gitSha(manifest.buildProvenance.git.revision, "logical manifest Git revision"); gitSha(manifest.buildProvenance.git.tree, "logical manifest Git tree");
  publicText(manifest.buildProvenance.git.version, "logical manifest Git version"); sha256(manifest.buildProvenance.git.executableSha256, "logical manifest Git executable");
  exactKeys(manifest.buildProvenance.node, ["runtime", "version", "executableSha256"], "logical manifest Node provenance");
  if (manifest.buildProvenance.node.runtime !== "node") fail("logical manifest Node runtime differs"); publicText(manifest.buildProvenance.node.version, "logical manifest Node version"); sha256(manifest.buildProvenance.node.executableSha256, "logical manifest Node executable");
  if (!Array.isArray(manifest.buildProvenance.directInputs) || manifest.buildProvenance.directInputs.length === 0) fail("logical manifest direct input closure is absent");
  const direct = new Map();
  for (const [index, input] of manifest.buildProvenance.directInputs.entries()) {
    exactKeys(input, ["path", "byteCount", "sha256", "gitBlob", "gitMode"], `logical manifest direct input ${index}`);
    canonicalRelative(input.path, `logical manifest direct input ${index} path`); if (!Number.isSafeInteger(input.byteCount) || input.byteCount < 0) fail("logical manifest direct input length is invalid");
    sha256(input.sha256, `logical manifest direct input ${index} SHA-256`); gitSha(input.gitBlob, `logical manifest direct input ${index} Git blob`);
    if (!(input.gitMode === "100644" || input.gitMode === "100755") || direct.has(input.path)) fail("logical manifest direct input is malformed or duplicate"); direct.set(input.path, input);
  }
  const artifacts = []; const seen = new Set();
  for (const [index, file] of manifest.files.entries()) {
    exactKeys(file, ["url", "path", "mediaType", "mode", "byteCount", "sha256", "rightsId"], `logical manifest file ${index}`);
    canonicalRelative(file.path, `logical manifest file ${index} path`);
    if (file.url !== "/" && (typeof file.url !== "string" || file.url !== `/${file.path}` || file.url.includes("//") || file.url.includes("\\") || file.url.includes("?") || file.url.includes("#"))) fail(`logical manifest file ${index} URL is not canonical`);
    publicText(file.mediaType, `logical manifest file ${index} mediaType`); publicText(file.rightsId, `logical manifest file ${index} rightsId`);
    if (file.mode !== "0644" || !Number.isSafeInteger(file.byteCount) || file.byteCount < 0 || seen.has(file.path)) fail("logical manifest file is malformed or duplicate"); sha256(file.sha256, `logical manifest file ${index} SHA-256`); seen.add(file.path);
    artifacts.push({ role: `package:${file.path}`, byteCount: file.byteCount, sha256: file.sha256 });
  }
  const expectedDirect = ["cadr-web/release/cadr-m14-evidence-policy.json", "scripts/cadr-m14-evidence.mjs"];
  if (expectedDirect.some(path => !direct.has(path))) fail("logical manifest provenance does not bind the M14 evidence policy and engine");
  return { direct, artifacts: artifacts.sort((a, b) => a.role.localeCompare(b.role)) };
}
export function deriveM14EvidenceCandidate(manifestBytes, policy) {
  const value = canonicalJson(manifestBytes, "logical manifest"); const checked = validateLogicalManifest(value, policy);
  const sourceRecords = [...checked.direct.values()].sort((a, b) => a.path.localeCompare(b.path));
  const toolchainRecords = [
    { toolId: "git", version: value.buildProvenance.git.version, executableSha256: value.buildProvenance.git.executableSha256,
      closureSha256: hashCanonical({ revision: value.buildProvenance.git.revision, tree: value.buildProvenance.git.tree }) },
    { toolId: "node", version: value.buildProvenance.node.version, executableSha256: value.buildProvenance.node.executableSha256,
      closureSha256: hashCanonical({ runtime: value.buildProvenance.node.runtime, version: value.buildProvenance.node.version, executableSha256: value.buildProvenance.node.executableSha256 }) },
  ];
  const candidate = { schema: CADR_M14_EVIDENCE_CANDIDATE_SCHEMA, releaseProfile: value.profile, candidateStatus: value.status,
    logicalManifestSha256: cadrM14EvidenceSha256(manifestBytes), source: { revision: value.buildProvenance.git.revision, tree: value.buildProvenance.git.tree, closureSha256: hashCanonical(sourceRecords) },
    artifacts: { setSha256: hashCanonical(checked.artifacts), records: checked.artifacts },
    toolchain: { setSha256: hashCanonical(toolchainRecords), records: toolchainRecords } };
  return { candidate, candidateSha256: hashCanonical(candidate), manifest: value };
}
function validateEnvelope(envelope, label) {
  exactKeys(envelope, ["schema", "caseId", "milestoneProfile", "candidate", "producer", "result", "verifier", "cleanup"], label);
  if (envelope.schema !== CADR_M14_EVIDENCE_RECEIPT_SCHEMA) fail(`${label} schema differs`);
  publicText(envelope.caseId, `${label} caseId`); publicText(envelope.milestoneProfile, `${label} milestoneProfile`);
  exactKeys(envelope.candidate, ["logicalManifestSha256", "sourceClosureSha256", "artifactSetSha256", "toolchainSetSha256"], `${label} candidate`);
  for (const key of Object.keys(envelope.candidate)) sha256(envelope.candidate[key], `${label} candidate ${key}`);
  exactKeys(envelope.producer, ["authorityId", "programSha256", "executableSha256"], `${label} producer`);
  publicText(envelope.producer.authorityId, `${label} producer authorityId`); sha256(envelope.producer.programSha256, `${label} producer programSha256`); sha256(envelope.producer.executableSha256, `${label} producer executableSha256`);
  exactKeys(envelope.result, ["schema", "byteCount", "sha256"], `${label} result`); publicText(envelope.result.schema, `${label} result schema`); if (!Number.isSafeInteger(envelope.result.byteCount) || envelope.result.byteCount < 0) fail(`${label} result length is invalid`); sha256(envelope.result.sha256, `${label} result sha256`);
  exactKeys(envelope.verifier, ["authorityId", "programSha256", "executableSha256", "resultSha256", "outcome"], `${label} verifier`);
  publicText(envelope.verifier.authorityId, `${label} verifier authorityId`); sha256(envelope.verifier.programSha256, `${label} verifier programSha256`); sha256(envelope.verifier.executableSha256, `${label} verifier executableSha256`); sha256(envelope.verifier.resultSha256, `${label} verifier resultSha256`); if (!OUTCOMES.has(envelope.verifier.outcome)) fail(`${label} verifier outcome is invalid`);
  exactKeys(envelope.cleanup, ["state", "receiptSha256"], `${label} cleanup`); if (!CLEANUP.has(envelope.cleanup.state)) fail(`${label} cleanup state is invalid`); sha256(envelope.cleanup.receiptSha256, `${label} cleanup receiptSha256`);
}
function authorityMatches(actual, expected, label) {
  if (actual.authorityId !== expected.id || actual.programSha256 !== expected.programSha256 || actual.executableSha256 !== expected.executableSha256) fail(`${label} identity differs from the registered authority`);
}
function candidateMatches(receipt, candidate, label) {
  if (receipt.logicalManifestSha256 !== candidate.logicalManifestSha256 || receipt.sourceClosureSha256 !== candidate.source.closureSha256 ||
      receipt.artifactSetSha256 !== candidate.artifacts.setSha256 || receipt.toolchainSetSha256 !== candidate.toolchain.setSha256) fail(`${label} candidate binding differs from the canonical logical manifest`);
}
function validateCandidate(candidate) {
  exactKeys(candidate, ["schema", "releaseProfile", "candidateStatus", "logicalManifestSha256", "source", "artifacts", "toolchain"], "evidence candidate");
  if (candidate.schema !== CADR_M14_EVIDENCE_CANDIDATE_SCHEMA || candidate.releaseProfile !== "CADR-WEB-303/CW4-MUSEUM" ||
      !["scaffold-only", "release-candidate"].includes(candidate.candidateStatus)) fail("evidence candidate has the wrong bounded profile");
  sha256(candidate.logicalManifestSha256, "evidence candidate logicalManifestSha256");
  exactKeys(candidate.source, ["revision", "tree", "closureSha256"], "evidence candidate source");
  gitSha(candidate.source.revision, "evidence candidate source revision"); gitSha(candidate.source.tree, "evidence candidate source tree");
  sha256(candidate.source.closureSha256, "evidence candidate source closureSha256");
  exactKeys(candidate.artifacts, ["setSha256", "records"], "evidence candidate artifacts");
  sha256(candidate.artifacts.setSha256, "evidence candidate artifact setSha256");
  if (!Array.isArray(candidate.artifacts.records)) fail("evidence candidate artifact records must be an array");
  for (const [index, record] of candidate.artifacts.records.entries()) {
    exactKeys(record, ["role", "byteCount", "sha256"], `evidence candidate artifact ${index}`);
    publicText(record.role, `evidence candidate artifact ${index} role`);
    if (!Number.isSafeInteger(record.byteCount) || record.byteCount < 0) fail(`evidence candidate artifact ${index} byteCount is invalid`);
    sha256(record.sha256, `evidence candidate artifact ${index} sha256`);
  }
  exactKeys(candidate.toolchain, ["setSha256", "records"], "evidence candidate toolchain");
  sha256(candidate.toolchain.setSha256, "evidence candidate toolchain setSha256");
  if (!Array.isArray(candidate.toolchain.records)) fail("evidence candidate toolchain records must be an array");
  for (const [index, record] of candidate.toolchain.records.entries()) {
    exactKeys(record, ["toolId", "version", "executableSha256", "closureSha256"], `evidence candidate toolchain ${index}`);
    publicText(record.toolId, `evidence candidate toolchain ${index} toolId`); publicText(record.version, `evidence candidate toolchain ${index} version`);
    sha256(record.executableSha256, `evidence candidate toolchain ${index} executableSha256`);
    sha256(record.closureSha256, `evidence candidate toolchain ${index} closureSha256`);
  }
  if (candidate.artifacts.setSha256 !== hashCanonical(candidate.artifacts.records) ||
      candidate.toolchain.setSha256 !== hashCanonical(candidate.toolchain.records)) fail("evidence candidate set digest differs from its records");
  return candidate;
}
function normalizeRegistry(policy, registry) {
  const parsed = validateM14EvidencePolicy(policy);
  if (!(registry instanceof Map)) fail("adapter registry must be a Map");
  for (const [caseId, adapter] of registry) {
    if (!parsed.cases.has(caseId) || adapter === null || typeof adapter !== "object" || typeof adapter.validate !== "function") fail("adapter registry has an unregistered or malformed adapter");
    const record = parsed.cases.get(caseId);
    if (record.adapterId === null || record.producerAuthorityId === null || record.verifierAuthorityId === null) fail("adapter registry cannot activate an unregistered policy case");
  }
  return parsed;
}
export async function admitM14EvidenceReceipts({ policy, policySha256, candidate, candidateSha256, registry = CADR_M14_PRODUCTION_ADAPTER_REGISTRY, receipts }) {
  sha256(policySha256, "admission policy SHA-256"); sha256(candidateSha256, "candidate SHA-256");
  validateCandidate(candidate);
  const parsed = normalizeRegistry(policy, registry);
  if (policySha256 !== hashCanonical(policy) || candidateSha256 !== hashCanonical(candidate)) fail("admission policy or candidate digest differs from its retained value");
  if (!Array.isArray(receipts)) fail("receipt set must be an array");
  const seenHashes = new Set(); const seenCases = new Set(); const admitted = [];
  for (const [index, item] of receipts.entries()) {
    exactKeys(item, ["id", "receiptBytes", "resultBytes", "cleanupBytes"], `receipt input ${index}`); publicText(item.id, `receipt input ${index} id`);
    if (!Buffer.isBuffer(item.receiptBytes) || !Buffer.isBuffer(item.resultBytes) || !Buffer.isBuffer(item.cleanupBytes)) fail(`receipt input ${index} bytes must be retained Buffers`);
    const envelope = canonicalJson(item.receiptBytes, `receipt ${item.id}`); validateEnvelope(envelope, `receipt ${item.id}`);
    const receiptSha256 = cadrM14EvidenceSha256(item.receiptBytes);
    if (seenHashes.has(receiptSha256)) fail("receipt input duplicates an exact receipt"); seenHashes.add(receiptSha256);
    if (envelope.cleanup.receiptSha256 !== cadrM14EvidenceSha256(item.cleanupBytes)) fail(`receipt ${item.id} cleanup does not bind its retained cleanup bytes`);
    const caseRecord = parsed.cases.get(envelope.caseId); const adapter = registry.get(envelope.caseId);
    if (caseRecord === undefined || adapter === undefined) fail(`receipt ${item.id} case is not registered by the compiled production adapter registry`);
    const caseSnapshot = deepFreezeJson(structuredClone(caseRecord));
    if (seenCases.has(envelope.caseId)) fail(`receipt input has conflicting attempts for case ${envelope.caseId}`); seenCases.add(envelope.caseId);
    if (envelope.milestoneProfile !== caseSnapshot.milestoneProfile || envelope.result.schema !== caseSnapshot.resultSchema) fail(`receipt ${item.id} case profile or result schema differs from policy`);
    candidateMatches(envelope.candidate, candidate, `receipt ${item.id}`);
    const producer = parsed.authorities.get(caseSnapshot.producerAuthorityId); const verifier = parsed.authorities.get(caseSnapshot.verifierAuthorityId);
    if (producer === undefined || verifier === undefined) fail(`receipt ${item.id} policy authority is unregistered`);
    authorityMatches(envelope.producer, producer, `receipt ${item.id} producer`); authorityMatches(envelope.verifier, verifier, `receipt ${item.id} verifier`);
    if (producer.id === verifier.id || producer.programClosureSha256 === verifier.programClosureSha256) fail(`receipt ${item.id} producer and verifier are not independent`);
    const expectedProducerId = producer.id; const expectedVerifierId = verifier.id;
    if (item.resultBytes.byteLength !== envelope.result.byteCount || cadrM14EvidenceSha256(item.resultBytes) !== envelope.result.sha256 || envelope.verifier.resultSha256 !== envelope.result.sha256) fail(`receipt ${item.id} retained result bytes differ from the verifier binding`);
    const result = canonicalJson(item.resultBytes, `receipt ${item.id} result`);
    const cleanup = canonicalJson(item.cleanupBytes, `receipt ${item.id} cleanup`);
    const expectedOutcome = envelope.verifier.outcome;
    const expectedCleanupState = envelope.cleanup.state;
    const expectedResultSha256 = envelope.result.sha256;
    const adapterInput = Object.freeze({ candidate: deepFreezeJson(structuredClone(candidate)), envelope: deepFreezeJson(envelope),
      result: deepFreezeJson(result), cleanup: deepFreezeJson(cleanup), resultBytes: Buffer.from(item.resultBytes), cleanupBytes: Buffer.from(item.cleanupBytes) });
    const conclusion = await adapter.validate(adapterInput);
    exactKeys(conclusion, ["outcome"], `receipt ${item.id} adapter conclusion`);
    if (!OUTCOMES.has(conclusion.outcome) || conclusion.outcome !== expectedOutcome) fail(`receipt ${item.id} adapter outcome differs from verifier outcome`);
    if (!caseSnapshot.cleanupStates.includes(expectedCleanupState)) fail(`receipt ${item.id} cleanup state is not permitted by its case policy`);
    const admittedRecord = deepFreezeJson({ schema: CADR_M14_ADMITTED_EVIDENCE_SCHEMA, admissionPolicySha256: policySha256, candidateSha256, receiptSha256,
      caseId: caseSnapshot.id, milestone: caseSnapshot.milestone, milestoneProfile: caseSnapshot.milestoneProfile, evidenceClass: caseSnapshot.evidenceClass,
      producerAuthorityId: expectedProducerId, verifierAuthorityId: expectedVerifierId,
      result: { schema: caseSnapshot.resultSchema, byteCount: item.resultBytes.byteLength, sha256: expectedResultSha256, outcome: expectedOutcome },
      cleanupState: expectedCleanupState, supportsDoD: [...caseSnapshot.supportsDoD], resolvesBlockers: [...caseSnapshot.resolvesBlockers] });
    ADMITTED_RECORDS.add(admittedRecord); admitted.push(admittedRecord);
  }
  return admitted.sort((left, right) => left.caseId.localeCompare(right.caseId));
}
function statusForCase(record) {
  if (record === undefined) return "not-evaluated";
  if (record.result.outcome === "conformance-failure" || record.cleanupState === "failed") return "failed";
  if (record.result.outcome === "pass" && (record.cleanupState === "verified-clean" || record.cleanupState === "verified-forced-test-termination")) return "passed";
  return "not-evaluated";
}
export function aggregateM14Evidence({ policy, policySha256, candidate, candidateSha256, admitted }) {
  sha256(policySha256, "aggregation policy SHA-256"); sha256(candidateSha256, "aggregation candidate SHA-256");
  validateCandidate(candidate);
  const parsed = validateM14EvidencePolicy(policy);
  if (policySha256 !== hashCanonical(policy) || candidateSha256 !== hashCanonical(candidate)) fail("aggregation policy or candidate digest differs from its retained value");
  if (!Array.isArray(admitted)) fail("admitted evidence must be an array");
  const byCase = new Map(); const receiptHashes = [];
  for (const [index, record] of admitted.entries()) {
    if (!ADMITTED_RECORDS.has(record)) fail(`admitted record ${index} was not created by this process admission boundary`);
    exactKeys(record, ["schema", "admissionPolicySha256", "candidateSha256", "receiptSha256", "caseId", "milestone", "milestoneProfile", "evidenceClass", "producerAuthorityId", "verifierAuthorityId", "result", "cleanupState", "supportsDoD", "resolvesBlockers"], `admitted record ${index}`, { allowFrozen: true });
    if (record.schema !== CADR_M14_ADMITTED_EVIDENCE_SCHEMA || record.admissionPolicySha256 !== policySha256 || record.candidateSha256 !== candidateSha256 || byCase.has(record.caseId) || !parsed.cases.has(record.caseId)) fail("admitted evidence is conflicting or from another policy/candidate");
    sha256(record.receiptSha256, `admitted record ${index} receiptSha256`); const expected = parsed.cases.get(record.caseId);
    if (record.milestone !== expected.milestone || record.milestoneProfile !== expected.milestoneProfile || record.evidenceClass !== expected.evidenceClass ||
        record.producerAuthorityId !== expected.producerAuthorityId || record.verifierAuthorityId !== expected.verifierAuthorityId ||
        cadrM14EvidenceCanonical(record.supportsDoD) !== cadrM14EvidenceCanonical(expected.supportsDoD) || cadrM14EvidenceCanonical(record.resolvesBlockers) !== cadrM14EvidenceCanonical(expected.resolvesBlockers) ||
        !CLEANUP.has(record.cleanupState) || !expected.cleanupStates.includes(record.cleanupState)) fail("admitted evidence differs from policy-derived mappings");
    exactKeys(record.result, ["schema", "byteCount", "sha256", "outcome"], `admitted record ${index} result`, { allowFrozen: true }); if (record.result.schema !== expected.resultSchema || !Number.isSafeInteger(record.result.byteCount) || record.result.byteCount < 0 || !OUTCOMES.has(record.result.outcome)) fail("admitted result is malformed"); sha256(record.result.sha256, `admitted record ${index} result sha256`);
    byCase.set(record.caseId, record); receiptHashes.push(record.receiptSha256);
  }
  if (new Set(receiptHashes).size !== receiptHashes.length) fail("admitted evidence duplicates receipt bytes");
  const cases = [...parsed.cases.values()].map(record => ({ caseId: record.id, state: statusForCase(byCase.get(record.id)) }));
  const caseState = new Map(cases.map(record => [record.caseId, record.state]));
  const blockers = [...parsed.blockers.values()].map(record => {
    const states = record.caseIds.map(id => caseState.get(id));
    return { id: record.id, state: states.some(state => state === "failed") ? "failed" : states.every(state => state === "passed") ? "resolved" : "unresolved" };
  });
  const blockerState = new Map(blockers.map(record => [record.id, record.state]));
  const definitionOfDone = [...parsed.dod.values()].map(record => {
    const states = record.requiredCases.map(id => caseState.get(id)); const blockerStates = record.requiredBlockers.map(id => blockerState.get(id));
    const combined = [...states, ...blockerStates];
    const state = combined.some(value => value === "failed") ? "failed" : combined.length > 0 && combined.every(value => value === "passed" || value === "resolved") ? "passed" :
      combined.some(value => value === "passed" || value === "resolved") ? "partial" : "not-evaluated";
    return { id: record.id, state };
  });
  const dodState = new Map(definitionOfDone.map(record => [record.id, record.state]));
  const gates = [...parsed.gates.values()].map(record => {
    const states = record.requiredDoD.map(id => dodState.get(id));
    return { id: record.id, state: states.some(value => value === "failed") ? "failed" : states.every(value => value === "passed") ? "passed" :
      states.some(value => value === "passed" || value === "partial") ? "partial" : "not-evaluated" };
  });
  const gateStates = gates.map(record => record.state);
  const outcome = gateStates.some(state => state === "failed") ? "failed" : gateStates.every(state => state === "passed") ? "all-gates-passed-release-claim-disabled" :
    gateStates.some(state => state === "partial" || state === "passed") ? "partial" : "not-evaluated";
  return { schema: CADR_M14_EVIDENCE_AGGREGATION_SCHEMA, releaseClaim: "none", candidateSha256, policySha256,
    receiptSetSha256: hashCanonical(sorted(receiptHashes)), cases, blockers, definitionOfDone, gates,
    browserRows: "not-evaluated", outcome };
}
async function receiptTriples(directory) {
  await directoryNonSymlink(directory, "receipt directory"); const groups = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) fail("receipt directory must contain only regular receipt/result JSON files");
    const match = /^([a-z0-9][a-z0-9-]{0,127})\.(receipt|result|cleanup)\.json$/u.exec(entry.name);
    if (match === null) fail(`receipt directory entry ${entry.name} is not canonical`);
    const group = groups.get(match[1]) ?? {}; if (group[match[2]] !== undefined) fail(`receipt directory entry ${entry.name} is duplicate`);
    group[match[2]] = resolve(directory, entry.name); groups.set(match[1], group);
  }
  const result = [];
  for (const id of sorted(groups.keys())) {
    const group = groups.get(id); if (group.receipt === undefined || group.result === undefined || group.cleanup === undefined) fail(`receipt ${id} lacks its confined result or cleanup bytes`);
    await fileNonSymlink(group.receipt, `receipt ${id}`); await fileNonSymlink(group.result, `receipt ${id} result`); await fileNonSymlink(group.cleanup, `receipt ${id} cleanup`);
    result.push({ id, receiptBytes: await readFile(group.receipt), resultBytes: await readFile(group.result), cleanupBytes: await readFile(group.cleanup) });
  }
  return result;
}
async function readTrackedPolicy() {
  const path = resolve(ROOT, "cadr-web/release/cadr-m14-evidence-policy.json"); await fileNonSymlink(path, "evidence policy");
  const bytes = await readFile(path); const policy = canonicalJson(bytes, "evidence policy"); validateM14EvidencePolicy(policy);
  return { policy, bytes, sha256: cadrM14EvidenceSha256(bytes) };
}
async function assertCandidateAdmissionInputsAreCurrentHead(manifest) {
  const git = await realpath(TRUSTED_GIT); await fileNonSymlink(git, "trusted Git executable");
  const env = { LANG: "C", LC_ALL: "C" };
  const revision = (await exec(git, ["rev-parse", "HEAD"], { cwd: ROOT, env })).stdout.trim();
  if (revision !== manifest.buildProvenance.git.revision) fail("logical manifest source revision is stale relative to the trusted Git HEAD");
  for (const path of ["cadr-web/release/cadr-m14-evidence-policy.json", "scripts/cadr-m14-evidence.mjs"]) {
    const entry = manifest.buildProvenance.directInputs.find(input => input.path === path);
    if (entry === undefined) fail("logical manifest omits a required admission direct input");
    const current = await readFile(resolve(ROOT, path));
    const listed = (await exec(git, ["ls-tree", "-z", "--full-tree", "HEAD", "--", path], { cwd: ROOT, env, encoding: "buffer" })).stdout;
    const record = listed.toString("utf8"); const expected = `${entry.gitMode} blob ${entry.gitBlob}\t${path}\0`;
    if (!Buffer.from(listed).equals(Buffer.from(expected))) fail(`admission direct input ${path} differs from trusted Git HEAD`);
    const head = (await exec(git, ["cat-file", "blob", entry.gitBlob], { cwd: ROOT, env, encoding: "buffer" })).stdout;
    if (!current.equals(head) || cadrM14EvidenceSha256(current) !== entry.sha256) fail(`admission direct input ${path} differs from its captured trusted blob`);
  }
}
function cliArguments(argv) {
  if (argv.length !== 6 || argv[0] !== "--manifest" || argv[2] !== "--receipts" || argv[4] !== "--output") fail("requires exactly --manifest, --receipts, and --output");
  return { manifest: canonicalAbsolute(argv[1], "--manifest"), receipts: canonicalAbsolute(argv[3], "--receipts"), output: canonicalAbsolute(argv[5], "--output") };
}
async function runCli(argv) {
  const args = cliArguments(argv); await confined(PRIVATE_ROOT, args.manifest, "logical manifest", "file"); await confined(PRIVATE_ROOT, args.receipts, "receipt directory", "directory");
  if (dirname(args.output) === PRIVATE_ROOT || dirname(dirname(args.output)) !== PRIVATE_ROOT) fail("--output must be a new file under one direct build/cadr-m14 home");
  await directoryNonSymlink(dirname(args.output), "aggregation output home");
  try { await lstat(args.output); fail("aggregation output already exists"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const { policy, sha256: policySha256 } = await readTrackedPolicy(); const manifestBytes = await readFile(args.manifest);
  const derived = deriveM14EvidenceCandidate(manifestBytes, policy); await assertCandidateAdmissionInputsAreCurrentHead(derived.manifest);
  const receipts = await receiptTriples(args.receipts);
  const admitted = await admitM14EvidenceReceipts({ policy, policySha256, candidate: derived.candidate, candidateSha256: derived.candidateSha256, receipts });
  const aggregation = aggregateM14Evidence({ policy, policySha256, candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted });
  await writeFile(args.output, `${cadrM14EvidenceCanonical(aggregation)}\n`, { flag: "wx", mode: 0o644 });
  process.stdout.write(`${cadrM14EvidenceCanonical({ outcome: aggregation.outcome, releaseClaim: "none", output: relative(ROOT, args.output) })}\n`);
}

const main = import.meta.url === new URL(`file://${resolve(process.argv[1] ?? "")}`).href;
if (main) runCli(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
