#!/usr/bin/env node
/*
 * Deterministic logical M14 package scaffold.
 *
 * It packages only the closed declarative inventory. It does not bundle a
 * machine, consume private media, or claim any CW gate.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { validateM14EvidenceGates, validateM14EvidencePolicy } from "./cadr-m14-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = resolve(ROOT, "build/cadr-m14");
const GENERATED_RIGHTS_ID = "generated-release-metadata";
const TRUSTED_GIT = "/usr/bin/git";
const GENERATED = new Set(["logical-build-manifest.json", "source-map.json",
  "rights-provenance.json", "browser-compatibility-matrix.json",
  "USER-GUIDE.md", "CONFORMANCE-REPORT.md"]);
/* Public prose may contain ordinary relative slash names such as
 * "Symbolics/Open Genera", but it may not embed any path token rooted in a
 * host filesystem.  Match a POSIX root after any non-name punctuation (not a
 * directory allowlist), Windows drive roots, file URIs, and shell-home forms. */
const PRIVATE_OR_MACHINE_ABSOLUTE = /(?:^|[^A-Za-z0-9_~-])(?:\/|\\)+(?=\S)|[A-Za-z]:[\\/]+|\bfile:\/\/+|~(?:[A-Za-z0-9_.-]+)?[\\/]/iu;
const NAMED_DEFAULT_EXTERNAL_PRIMITIVES = [
  /\bhttps?:\/\//iu, /\bwss?:\/\//iu, /\bfetch\s*\(/u,
  /\bWebSocket\s*\(/u, /\bEventSource\s*\(/u, /\bsendBeacon\s*\(/u,
  /\bXMLHttpRequest\b/u, /\bimportScripts\s*\(\s*["'](?:https?|\/\/)/u,
  /\b(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//iu,
  /\burl\s*\(\s*["']?\s*(?:https?:)?\/\//iu,
  /\bimport\s*\(\s*["']\s*(?:https?:)?\/\//u,
  /\b(?:import|export)\s+(?:[\s\S]{0,256}?\s+from\s+)?["']\s*(?:https?:)?\/\//iu,
  /@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\//iu,
  /\b(?:new\s+)?(?:Worker|SharedWorker)\s*\(\s*["']\s*(?:https?:)?\/\//iu,
  /\b(?:new\s+URL|Request|AudioWorklet\.addModule|serviceWorker\.register)\s*\(\s*["']\s*(?:https?:)?\/\//iu,
  /\bRTCPeerConnection\b/u, /\bWebTransport\b/u,
];
const exec = promisify(execFile);

function fail(message) { throw new TypeError(`C-M14: ${message}`); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    fail(`${label} has missing, extra, or non-object fields`);
  }
}
function nonemptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a nonempty string`);
  return value;
}
function publicText(value, label, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    fail(`${label} must be ${allowEmpty ? "a string" : "a nonempty string"}`);
  }
  if (PRIVATE_OR_MACHINE_ABSOLUTE.test(value)) fail(`${label} contains a private or machine absolute path`);
  return value;
}
function sha256Text(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) fail(`${label} must be SHA-256`);
  return value;
}
function relativeComponents(value, label) {
  nonemptyString(value, label);
  if (isAbsolute(value) || value.includes("\\") || value.includes("//")) {
    fail(`${label} must be a canonical relative slash path`);
  }
  const parts = value.split("/");
  if (parts.some(part => part.length === 0 || part === "." || part === "..")) {
    fail(`${label} escapes or is not a canonical relative path`);
  }
  return parts;
}
async function regularNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} must be a regular non-symlink file`);
  return info;
}
async function directoryNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`${label} must be a directory, never a symlink`);
  return info;
}
async function existingConfined(root, relativePath, label, finalKind) {
  const parts = relativeComponents(relativePath, label);
  await directoryNonSymlink(root, `${label} confinement root`);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link component: ${part}`);
    if (index + 1 < parts.length && !info.isDirectory()) fail(`${label} has a non-directory ancestor: ${part}`);
    if (index + 1 === parts.length &&
        ((finalKind === "file" && !info.isFile()) || (finalKind === "directory" && !info.isDirectory()))) {
      fail(`${label} has the wrong final entry type`);
    }
  }
  return current;
}
async function ensureConfinedDirectory(root, relativePath, label) {
  const parts = relativeComponents(relativePath, label);
  await directoryNonSymlink(root, `${label} confinement root`);
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    try {
      await directoryNonSymlink(current, `${label} component ${part}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o755 });
      await directoryNonSymlink(current, `${label} component ${part}`);
    }
  }
  return current;
}
async function repoFile(relativePath, label) {
  return existingConfined(ROOT, relativePath, label, "file");
}
export async function assertM14ConfinedRepoFile(relativePath) {
  return repoFile(relativePath, "M14 confined repository source");
}
async function outputDirectory(output, label, mustExist) {
  if (typeof output !== "string" || !isAbsolute(output) || dirname(output) !== OUTPUT_ROOT ||
      basename(output) === "." || basename(output) === "..") {
    fail(`${label} must be one direct child below build/cadr-m14/`);
  }
  await ensureConfinedDirectory(ROOT, "build/cadr-m14", "M14 output root");
  if (mustExist) return existingConfined(OUTPUT_ROOT, basename(output), label, "directory");
  try { await lstat(output); fail(`${label} already exists; replacement is forbidden`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  return output;
}
function packageUrl(value, output, label) {
  nonemptyString(value, label);
  if (value === "/") {
    if (output !== "index.html") fail(`${label} may map to / only for index.html`);
    return value;
  }
  if (!value.startsWith("/") || value.includes("//") || value.includes("\\") ||
      value.includes("?") || value.includes("#") || value !== `/${output}`) {
    fail(`${label} must be the canonical absolute package URL for its output`);
  }
  relativeComponents(value.slice(1), label);
  return value;
}
export function assertNoNamedDefaultExternalPrimitive(bytes, label) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : nonemptyString(bytes, label);
  if (NAMED_DEFAULT_EXTERNAL_PRIMITIVES.some(pattern => pattern.test(text))) {
    fail(`${label} contains a named default external primitive`);
  }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function json(path, schema, canonicalBytes = false) {
  await regularNonSymlink(path, relative(ROOT, path));
  const bytes = await readFile(path);
  const value = canonicalBytes ? canonicalJsonLine(bytes, relative(ROOT, path)) : JSON.parse(bytes.toString("utf8"));
  if (value?.schema !== schema) fail(`${relative(ROOT, path)} has wrong schema`);
  return { value, bytes };
}
function jsonBytes(bytes, label, schema, canonicalBytes = false) {
  let value;
  try { value = canonicalBytes ? canonicalJsonLine(bytes, label) : JSON.parse(bytes.toString("utf8")); }
  catch (error) { if (error?.message?.startsWith("C-M14:")) throw error; fail(`${label} is not JSON`); }
  if (value?.schema !== schema) fail(`${label} has wrong schema`);
  return { value, bytes };
}
function outputArgument(argv) {
  if (argv.length === 0) return resolve(OUTPUT_ROOT, "release");
  if (argv.length !== 2 || argv[0] !== "--output") fail("only --output <direct-child> is accepted");
  const parts = relativeComponents(argv[1], "--output");
  if (parts.length !== 3 || parts[0] !== "build" || parts[1] !== "cadr-m14") {
    fail("--output must be a canonical build/cadr-m14/<direct-child> path");
  }
  return resolve(ROOT, ...parts);
}
async function writeCanonical(path, value) {
  const bytes = Buffer.from(`${canonical(value)}\n`);
  await writeFile(path, bytes, { flag: "wx" });
  await chmod(path, 0o644);
  return { byteCount: bytes.byteLength, sha256: hash(bytes) };
}
async function buildProvenance(paths, generatorPath) {
  const rels = [...new Set(paths.map(path => relative(ROOT, path)))].sort();
  const env = { LANG: "C", LC_ALL: "C" };
  let revision; let tree; let gitVersion; let gitExecutable;
  try {
    gitExecutable = await realpath(TRUSTED_GIT);
    await regularNonSymlink(gitExecutable, "trusted Git executable");
    revision = (await exec(gitExecutable, ["rev-parse", "HEAD"], { cwd: ROOT, env })).stdout.trim();
    tree = (await exec(gitExecutable, ["rev-parse", `${revision}^{tree}`], { cwd: ROOT, env })).stdout.trim();
    gitVersion = (await exec(gitExecutable, ["--version"], { cwd: ROOT, env })).stdout.trim();
  } catch { fail("M14 requires a readable Git source extraction"); }
  if (!/^[0-9a-f]{40}$/u.test(revision) || !/^[0-9a-f]{40}$/u.test(tree)) {
    fail("M14 requires an exact committed Git source identity");
  }
  const directInputs = []; const captures = new Map();
  for (const rel of rels) {
    const path = resolve(ROOT, rel);
    const currentInfo = await regularNonSymlink(path, `direct input ${rel}`);
    let gitMode; let gitBlob; let bytes;
    try {
      const listing = (await exec(gitExecutable,
        ["ls-tree", "-z", "--full-tree", revision, "--", rel],
        { cwd: ROOT, env, encoding: "buffer" })).stdout;
      const records = listing.subarray(0, Math.max(0, listing.byteLength - 1)).toString("utf8").split("\0");
      if (listing.byteLength === 0 || listing[listing.byteLength - 1] !== 0 || records.length !== 1) {
        fail(`direct input ${rel} does not have exactly one HEAD tree entry`);
      }
      const tab = records[0].indexOf("\t");
      const header = records[0].slice(0, tab).split(" ");
      const listedPath = records[0].slice(tab + 1);
      if (tab < 0 || header.length !== 3 || listedPath !== rel) {
        fail(`direct input ${rel} does not have exactly one HEAD tree entry`);
      }
      [gitMode, , gitBlob] = header;
      if (!(["100644", "100755"].includes(gitMode)) || header[1] !== "blob" ||
          !/^[0-9a-f]{40}$/u.test(gitBlob)) {
        fail(`direct input ${rel} HEAD tree entry is not a permitted regular blob mode`);
      }
      bytes = (await exec(gitExecutable, ["cat-file", "blob", gitBlob],
        { cwd: ROOT, env, encoding: "buffer", maxBuffer: 32 * 1024 * 1024 })).stdout;
    } catch (error) {
      if (error?.message?.startsWith("C-M14:")) throw error;
      fail(`direct input ${rel} is not a tracked HEAD blob`);
    }
    const executableBits = currentInfo.mode & 0o111;
    if ((gitMode === "100644" && executableBits !== 0) ||
        (gitMode === "100755" && executableBits !== 0o111)) {
      fail(`direct input ${rel} executable bits differ from HEAD mode ${gitMode}`);
    }
    const current = await readFile(path);
    if (!current.equals(bytes)) fail(`direct input ${rel} differs byte-for-byte from its HEAD blob`);
    captures.set(rel, bytes);
    directInputs.push({ path: rel, byteCount: bytes.byteLength, sha256: hash(bytes), gitBlob, gitMode });
  }
  const generator = directInputs.find(entry => entry.path === relative(ROOT, generatorPath));
  if (generator === undefined) fail("release generator identity is absent from direct inputs");
  const executable = await realpath(process.execPath);
  await regularNonSymlink(executable, "Node runtime executable");
  return { provenance: { git: { revision, tree, version: publicText(gitVersion, "Git version"),
      executableSha256: hash(await readFile(gitExecutable)) },
    node: { runtime: "node", version: publicText(process.version, "Node version"),
      executableSha256: hash(await readFile(executable)) },
    generator, directInputs }, captures };
}
async function deterministicArchive(output) {
  const archivePath = `${output}.cdrm14`;
  try { await lstat(archivePath); fail("deterministic archive path already exists"); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const parts = [Buffer.from("CDRM14PKG1\n")];
  const files = await treeFiles(output);
  for (const path of files) {
    const bytes = await readFile(resolve(output, path));
    const header = Buffer.from(`${canonical({ path, mode: "0644",
      byteCount: bytes.byteLength, sha256: hash(bytes) })}\n`);
    const length = Buffer.alloc(4); length.writeUInt32LE(header.byteLength);
    parts.push(length, header, bytes);
  }
  const archive = Buffer.concat(parts);
  await writeFile(archivePath, archive, { flag: "wx", mode: 0o644 });
  await chmod(archivePath, 0o644);
  await verifyCadrM14Archive(archivePath, output);
  return { path: archivePath, format: "CDRM14PKG1", fileCount: files.length,
    byteCount: archive.byteLength, sha256: hash(archive) };
}
function canonicalJsonLine(bytes, label) {
  if (!bytes.toString("utf8").endsWith("\n")) fail(`${label} lacks its canonical terminal LF`);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { fail(`${label} is not JSON`); }
  if (!Buffer.from(`${canonical(value)}\n`).equals(bytes)) fail(`${label} is not canonical JSON`);
  return value;
}
export async function verifyCadrM14Archive(archivePath, output) {
  const packageRoot = await outputDirectory(output, "archive package output", true);
  await regularNonSymlink(archivePath, "CDRM14PKG1 archive");
  const archive = await readFile(archivePath);
  const magic = Buffer.from("CDRM14PKG1\n");
  if (archive.byteLength < magic.byteLength || !archive.subarray(0, magic.byteLength).equals(magic)) {
    fail("CDRM14PKG1 archive magic differs");
  }
  const expected = await treeFiles(packageRoot);
  const seen = new Set(); let offset = magic.byteLength;
  while (offset < archive.byteLength) {
    if (archive.byteLength - offset < 4) fail("CDRM14PKG1 archive has a truncated header length");
    const headerLength = archive.readUInt32LE(offset); offset += 4;
    if (headerLength === 0 || headerLength > archive.byteLength - offset) {
      fail("CDRM14PKG1 archive has an invalid header length");
    }
    const header = canonicalJsonLine(archive.subarray(offset, offset + headerLength), "CDRM14PKG1 header");
    offset += headerLength;
    exactKeys(header, ["path", "mode", "byteCount", "sha256"], "CDRM14PKG1 header");
    relativeComponents(header.path, "CDRM14PKG1 header path");
    if (header.mode !== "0644" || !Number.isSafeInteger(header.byteCount) || header.byteCount < 0 ||
        !/^[0-9a-f]{64}$/u.test(header.sha256) || seen.has(header.path) ||
        header.byteCount > archive.byteLength - offset) fail("CDRM14PKG1 header is malformed");
    const payload = archive.subarray(offset, offset + header.byteCount); offset += header.byteCount;
    if (hash(payload) !== header.sha256) fail(`CDRM14PKG1 payload hash differs for ${header.path}`);
    const packagePath = await existingConfined(packageRoot, header.path,
      `CDRM14PKG1 package path ${header.path}`, "file");
    if (!payload.equals(await readFile(packagePath))) fail(`CDRM14PKG1 payload differs for ${header.path}`);
    seen.add(header.path);
  }
  if (offset !== archive.byteLength || seen.size !== expected.length || expected.some(path => !seen.has(path))) {
    fail("CDRM14PKG1 archive inventory differs from package");
  }
  return { files: seen.size, sha256: hash(archive) };
}
function userGuide(policy) {
  return `# CADR-WEB-303 museum package user guide

This scaffold is not a runnable CW4 release. It contains a policy shell,
profile metadata, and generated release documents, but deliberately omits the
Wasm machine and unresolved M10–M13 joined evidence. The visible shell is a
non-runnable policy harness and its worker is intentionally inert.

## Import and rights boundary

Load bands, disk images, overlays, exports, screenshots, and licensed media are
user-controlled private inputs. They are not bundled. Import only material you
are entitled to use; the package does not grant redistribution rights.

## Controls and state

The visible Start, Pause, Reset, Save/Commit, Export, Release Input, keyboard,
pointer, debugger, fullscreen, and Help controls are placeholders that report
unavailable; they do not operate a machine in this scaffold. In a future
runnable release, pause or reset must not be presented as a save. Only a
positively acknowledged durable commit may be described as saved, and exported
state must remain bound to its immutable base/profile identities.

## Static inventory and runtime-network boundary

The closed inventory contains ${policy.entries.length} copied resources and
${policy.generated.length} generated documents. The verifier finds no named
default external primitive from its bounded static scanner. Its
closed-inventory status applies only to those declared package bytes. Runtime
offline behavior is **not evaluated**: this scaffold does not prove that a
browser issues no network traffic or enforces CSP. Missing declared resources
are fatal and must not be fetched.
`;
}
function conformanceReport(gates, matrix) {
  const rows = gates.gates.map(gate =>
    `| ${gate.id} | ${gate.state} | ${gate.requiredDoD.join(", ")} |`).join("\n");
  const blockers = gates.unresolvedMilestoneBlockers.map(record =>
    `| ${record.milestone} | ${record.state} | ${record.blocks.join(", ")} | ${record.blockers.join("; ")} |`).join("\n");
  const done = gates.cw4DefinitionOfDone.map(record =>
    `| ${record.id} | ${record.clause} | ${record.blockingMilestones.join(", ")} |`).join("\n");
  return `# CADR-WEB-303 release conformance report

Release claim: **none**. This deterministic scaffold does not close CW4.
Only a case adapter registered in the tracked evidence policy may admit a receipt;
the production adapter registry is empty. Manual status and free-form evidence
cannot advance a gate.

| Gate | State | Required CW4 definition-of-done clauses |
| --- | --- | --- |
${rows}

| Milestone blocker | State | Blocks | Unresolved blocker |
| --- | --- | --- | --- |
${blockers}

| CW4 definition-of-done clause | Requirement | Blocking milestones |
| --- | --- | --- |
${done}

Browser matrix status: **${matrix.evidenceStatus}**; static inventory:
**${matrix.closedInventoryStatus}**; runtime offline behavior:
**${matrix.offlineRuntimeStatus}**. Required engines:
${matrix.required.map(item => `- ${item.id} (${item.engine}), network test disposition ${item.networkMode}, adapter ${item.adapter ?? "not configured"}`).join("\n")}

CW4 may be claimed only after every required gate and browser row has validated
evidence from registered, pinned browser adapters and an evidence-qualified
runtime no-network workflow. Static packaging and untrusted adapter attestations
are insufficient.
`;
}
function stringArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array of nonempty strings`);
  for (const [index, item] of value.entries()) publicText(item, `${label}[${index}]`);
}
export function validateM14PolicyDocuments(policy, rights, matrix, gates, evidencePolicy, evidencePolicySha256) {
  exactKeys(policy, ["schema", "profile", "status", "closedInventoryStatus", "offlineRuntimeStatus", "canonicalJson", "logicalEpoch",
    "entries", "generated", "excludedPrivateInputs", "unresolvedComponents"], "package policy");
  if (policy.schema !== "cadr-m14-package-policy-v2" || policy.status !== "scaffold-only" ||
      policy.closedInventoryStatus !== "closed-static-inventory" || policy.offlineRuntimeStatus !== "not-evaluated" ||
      policy.profile !== "CADR-WEB-303/CW4-MUSEUM" || !Number.isSafeInteger(policy.logicalEpoch) ||
      policy.logicalEpoch !== 1) {
    fail("package policy is not the closed scaffold profile");
  }
  if (policy.canonicalJson !== "UTF-8, sorted object keys, no insignificant whitespace, LF") {
    fail("package policy canonicalJson declaration differs");
  }
  stringArray(policy.generated, "package policy generated");
  stringArray(policy.excludedPrivateInputs, "package policy excludedPrivateInputs");
  stringArray(policy.unresolvedComponents, "package policy unresolvedComponents");
  if (!Array.isArray(policy.entries) || policy.entries.length === 0 ||
      new Set(policy.generated).size !== GENERATED.size || policy.generated.length !== GENERATED.size ||
      policy.generated.some(name => !GENERATED.has(name))) fail("package policy generated inventory differs");
  const outputs = new Set(); const urls = new Set();
  for (const [index, entry] of policy.entries.entries()) {
    exactKeys(entry, ["url", "output", "source", "mediaType", "rightsId"], `package entry ${index}`);
    relativeComponents(entry.output, `package entry ${index} output`);
    relativeComponents(entry.source, `package entry ${index} source`);
    packageUrl(entry.url, entry.output, `package entry ${index} url`);
    publicText(entry.mediaType, `package entry ${index} mediaType`);
    publicText(entry.rightsId, `package entry ${index} rightsId`);
    if (outputs.has(entry.output) || urls.has(entry.url)) fail("package policy has duplicate output or URL");
    outputs.add(entry.output); urls.add(entry.url);
  }
  exactKeys(rights, ["schema", "records", "forbiddenBundleClasses"], "rights policy");
  if (rights.schema !== "cadr-m14-rights-policy-v1" || !Array.isArray(rights.records) ||
      rights.records.length === 0) fail("rights policy is malformed");
  stringArray(rights.forbiddenBundleClasses, "rights policy forbiddenBundleClasses");
  const rightsIds = new Set();
  for (const [index, record] of rights.records.entries()) {
    exactKeys(record, ["id", "classification", "distributionStatus", "licenseExpression", "sourceNotice"],
      `rights record ${index}`);
    for (const key of Object.keys(record)) publicText(record[key], `rights record ${index} ${key}`);
    if (rightsIds.has(record.id)) fail("rights policy has duplicate records");
    rightsIds.add(record.id);
  }
  if (!rightsIds.has(GENERATED_RIGHTS_ID) ||
      policy.entries.some(entry => !rightsIds.has(entry.rightsId))) {
    fail("rights policy omits a package rights record");
  }
  exactKeys(matrix, ["schema", "evidenceStatus", "evidenceAuthority", "closedInventoryStatus", "offlineRuntimeStatus",
    "registeredAdapters", "required", "checks"],
    "browser matrix");
  validateEvidenceAuthority(matrix.evidenceAuthority, "browser matrix evidence authority");
  if (matrix.schema !== "cadr-m14-browser-matrix-v2" || matrix.evidenceStatus !== "not-evaluated" ||
      matrix.closedInventoryStatus !== "closed-static-inventory" || matrix.offlineRuntimeStatus !== "not-evaluated" ||
      !Array.isArray(matrix.registeredAdapters) || matrix.registeredAdapters.length !== 0 ||
      !Array.isArray(matrix.required) || matrix.required.length !== 3) {
    fail("browser matrix must remain an unevaluated scaffold without registered adapters");
  }
  stringArray(matrix.checks, "browser matrix checks");
  const matrixEngines = ["Blink", "Gecko", "WebKit"];
  for (const [index, row] of matrix.required.entries()) {
    exactKeys(row, ["id", "engine", "adapter", "networkMode"], `browser matrix row ${index}`);
    if (!matrixEngines.includes(row.engine) || row.adapter !== null || row.networkMode !== "denied") {
      fail("browser matrix row is not an unevaluated denied-network requirement");
    }
    publicText(row.id, `browser matrix row ${index} id`);
  }
  if (new Set(matrix.required.map(row => row.engine)).size !== matrixEngines.length) {
    fail("browser matrix must contain exactly one row per required engine");
  }
  validateM14EvidencePolicy(evidencePolicy);
  validateM14EvidenceGates(gates, evidencePolicy, evidencePolicySha256);
}
function validateEvidenceAuthority(value, label) {
  exactKeys(value, ["receiptAdmission", "manualStatus", "freeFormEvidence"], label);
  if (value.receiptAdmission !== "registered-case-adapters-required-production-registry-empty" ||
      value.manualStatus !== "cannot-advance" || value.freeFormEvidence !== "cannot-advance") {
    fail(`${label} permits unqualified evidence`);
  }
}
function publicStringArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  for (const [index, item] of value.entries()) publicText(item, `${label}[${index}]`);
}
function validateManifestFile(file, index) {
  exactKeys(file, ["url", "path", "mediaType", "mode", "byteCount", "sha256", "rightsId"],
    `logical manifest file ${index}`);
  relativeComponents(file.path, `logical manifest file ${index} path`);
  packageUrl(file.url, file.path, `logical manifest file ${index} url`);
  publicText(file.mediaType, `logical manifest file ${index} mediaType`);
  publicText(file.rightsId, `logical manifest file ${index} rightsId`);
  if (file.mode !== "0644" || !Number.isSafeInteger(file.byteCount) || file.byteCount < 0) {
    fail(`logical manifest file ${index} has invalid mode or length`);
  }
  sha256Text(file.sha256, `logical manifest file ${index} sha256`);
}
function validateProvenanceInput(value, label) {
  exactKeys(value, ["path", "byteCount", "sha256", "gitBlob", "gitMode"], label);
  relativeComponents(value.path, `${label} path`);
  if (!Number.isSafeInteger(value.byteCount) || value.byteCount < 0) fail(`${label} byteCount is invalid`);
  sha256Text(value.sha256, `${label} sha256`);
  if (!/^[0-9a-f]{40}$/u.test(value.gitBlob)) fail(`${label} gitBlob is invalid`);
  if (!(["100644", "100755"].includes(value.gitMode))) fail(`${label} gitMode is invalid`);
}
function validateBuildProvenance(value) {
  exactKeys(value, ["git", "node", "generator", "directInputs"], "build provenance");
  exactKeys(value.git, ["revision", "tree", "version", "executableSha256"], "build provenance Git");
  if (!/^[0-9a-f]{40}$/u.test(value.git.revision) || !/^[0-9a-f]{40}$/u.test(value.git.tree)) {
    fail("build provenance Git revision or tree is invalid");
  }
  publicText(value.git.version, "build provenance Git version");
  sha256Text(value.git.executableSha256, "build provenance Git executableSha256");
  exactKeys(value.node, ["runtime", "version", "executableSha256"], "build provenance Node");
  if (value.node.runtime !== "node") fail("build provenance runtime is not Node");
  publicText(value.node.version, "build provenance Node version");
  sha256Text(value.node.executableSha256, "build provenance Node executableSha256");
  validateProvenanceInput(value.generator, "build provenance generator");
  if (!Array.isArray(value.directInputs) || value.directInputs.length === 0) {
    fail("build provenance direct inputs are absent");
  }
  const inputs = new Map();
  for (const [index, input] of value.directInputs.entries()) {
    validateProvenanceInput(input, `build provenance direct input ${index}`);
    if (inputs.has(input.path)) fail("build provenance direct input is duplicate");
    inputs.set(input.path, input);
  }
  const generator = inputs.get(value.generator.path);
  if (generator === undefined || canonical(generator) !== canonical(value.generator)) {
    fail("build provenance generator is not one complete direct input");
  }
  return inputs;
}
function validateRightsProvenance(value) {
  exactKeys(value, ["schema", "releaseClaim", "policySha256", "records", "forbiddenBundleClasses", "assignments"],
    "rights provenance");
  if (value.schema !== "cadr-m14-rights-provenance-v1" || value.releaseClaim !== "none" ||
      !Array.isArray(value.records) || value.records.length === 0 || !Array.isArray(value.assignments)) {
    fail("rights provenance is malformed");
  }
  sha256Text(value.policySha256, "rights provenance policySha256");
  publicStringArray(value.forbiddenBundleClasses, "rights provenance forbiddenBundleClasses");
  const records = new Set();
  for (const [index, record] of value.records.entries()) {
    exactKeys(record, ["id", "classification", "distributionStatus", "licenseExpression", "sourceNotice"],
      `rights provenance record ${index}`);
    for (const key of Object.keys(record)) publicText(record[key], `rights provenance record ${index} ${key}`);
    if (records.has(record.id)) fail("rights provenance has duplicate record IDs");
    records.add(record.id);
  }
  const assignments = new Set();
  for (const [index, assignment] of value.assignments.entries()) {
    exactKeys(assignment, ["path", "rightsId"], `rights provenance assignment ${index}`);
    relativeComponents(assignment.path, `rights provenance assignment ${index} path`);
    publicText(assignment.rightsId, `rights provenance assignment ${index} rightsId`);
    if (assignments.has(assignment.path) || !records.has(assignment.rightsId)) {
      fail("rights provenance assignment is duplicate or unresolved");
    }
    assignments.add(assignment.path);
  }
  return { records, assignments };
}
function validateSourceMap(value) {
  exactKeys(value, ["schema", "provenance", "rule", "mappings"], "source map");
  if (value.schema !== "cadr-m14-source-map-v2" || !Array.isArray(value.mappings)) fail("source map is malformed");
  const directInputs = validateBuildProvenance(value.provenance);
  publicText(value.rule, "source map rule");
  const outputs = new Set(); const mappingSources = new Map();
  const generatorTransforms = new Set(["deterministic-generator-v2", "canonical-source-map-root-v2",
    "canonical-logical-manifest-root-v2"]);
  for (const [index, mapping] of value.mappings.entries()) {
    if (mapping === null || typeof mapping !== "object" || Array.isArray(mapping)) fail(`source map mapping ${index} is malformed`);
    const byteCopy = mapping.transform === "byte-for-byte-copy";
    const generated = generatorTransforms.has(mapping.transform);
    exactKeys(mapping, (generated || byteCopy) ? ["output", "sources", "transform"] : [], `source map mapping ${index}`);
    if (!byteCopy && !generated) fail(`source map mapping ${index} transform is unknown`);
    relativeComponents(mapping.output, `source map mapping ${index} output`);
    if (outputs.has(mapping.output) || !Array.isArray(mapping.sources) || mapping.sources.length === 0) {
      fail("source map mapping is duplicate or has no sources");
    }
    outputs.add(mapping.output);
    const sources = new Set();
    for (const [sourceIndex, source] of mapping.sources.entries()) {
      validateProvenanceInput(source, `source map mapping ${index} source ${sourceIndex}`);
      const direct = directInputs.get(source.path);
      if (sources.has(source.path) || direct === undefined || canonical(direct) !== canonical(source)) {
        fail("source map mapping source is duplicate or not an exact direct input");
      }
      sources.add(source.path);
    }
    if (byteCopy && mapping.sources.length !== 1) fail("byte copy source map mapping must have one source");
    mappingSources.set(mapping.output, sources);
  }
  const directInputPaths = new Set(directInputs.keys());
  for (const root of ["source-map.json", "logical-build-manifest.json"]) {
    const sources = mappingSources.get(root);
    if (sources === undefined || sources.size !== directInputPaths.size ||
        [...directInputPaths].some(path => !sources.has(path))) {
      fail(`source map root ${root} does not list every direct input`);
    }
  }
  return { outputs, directInputs };
}
function validateGeneratedBrowserMatrix(value) {
  exactKeys(value, ["schema", "evidenceStatus", "evidenceAuthority", "closedInventoryStatus", "offlineRuntimeStatus",
    "registeredAdapters", "required", "checks", "policySha256", "adapterAttestationStatus"], "generated browser matrix");
  validateEvidenceAuthority(value.evidenceAuthority, "generated browser matrix evidence authority");
  if (value.schema !== "cadr-m14-browser-matrix-v2" || value.evidenceStatus !== "not-evaluated" ||
      value.closedInventoryStatus !== "closed-static-inventory" || value.offlineRuntimeStatus !== "not-evaluated" ||
      value.adapterAttestationStatus !== "none-recorded" || !Array.isArray(value.registeredAdapters) ||
      value.registeredAdapters.length !== 0 || !Array.isArray(value.required) || value.required.length !== 3) {
    fail("generated browser matrix overclaims or is malformed");
  }
  sha256Text(value.policySha256, "generated browser matrix policySha256");
  publicStringArray(value.checks, "generated browser matrix checks");
  const engines = new Set();
  for (const [index, row] of value.required.entries()) {
    exactKeys(row, ["id", "engine", "adapter", "networkMode"], `generated browser matrix row ${index}`);
    publicText(row.id, `generated browser matrix row ${index} id`);
    publicText(row.engine, `generated browser matrix row ${index} engine`);
    if (!(["Blink", "Gecko", "WebKit"].includes(row.engine)) || row.adapter !== null || row.networkMode !== "denied") {
      fail("generated browser matrix row is invalid");
    }
    engines.add(row.engine);
  }
  if (engines.size !== 3) fail("generated browser matrix lacks an engine");
}
export function validateM14GeneratedJson(manifest, rights, sourceMap, browserMatrix) {
  exactKeys(manifest, ["schema", "profile", "status", "releaseClaim", "logicalEpoch", "closedInventoryStatus",
    "offlineRuntimeStatus", "fileModePolicy", "buildProvenance", "sourceMapSha256", "unresolvedComponents",
    "excludedPrivateInputs", "files"], "logical manifest");
  if (manifest.schema !== "cadr-m14-logical-build-manifest-v2" ||
      manifest.profile !== "CADR-WEB-303/CW4-MUSEUM" || manifest.status !== "scaffold-only" ||
      manifest.releaseClaim !== "none" || manifest.logicalEpoch !== 1 ||
      manifest.closedInventoryStatus !== "closed-static-inventory" || manifest.offlineRuntimeStatus !== "not-evaluated" ||
      manifest.fileModePolicy !== "directories 0755; regular files 0644; no executable or symbolic-link package entries" ||
      !Array.isArray(manifest.files)) fail("logical manifest overclaims or is malformed");
  sha256Text(manifest.sourceMapSha256, "logical manifest sourceMapSha256");
  publicStringArray(manifest.unresolvedComponents, "logical manifest unresolvedComponents");
  publicStringArray(manifest.excludedPrivateInputs, "logical manifest excludedPrivateInputs");
  const manifestDirectInputs = validateBuildProvenance(manifest.buildProvenance);
  const files = new Set();
  for (const [index, file] of manifest.files.entries()) {
    validateManifestFile(file, index);
    if (files.has(file.path)) fail("logical manifest has duplicate file paths");
    files.add(file.path);
  }
  const rightsValidation = validateRightsProvenance(rights);
  const sourceMapValidation = validateSourceMap(sourceMap);
  if (canonical(manifest.buildProvenance) !== canonical(sourceMap.provenance) ||
      manifestDirectInputs.size !== sourceMapValidation.directInputs.size ||
      [...manifestDirectInputs].some(([path, input]) => canonical(input) !== canonical(sourceMapValidation.directInputs.get(path)))) {
    fail("logical manifest and source map provenance differ");
  }
  validateGeneratedBrowserMatrix(browserMatrix);
  return { files, rightsValidation, sourceMapOutputs: sourceMapValidation.outputs,
    directInputs: sourceMapValidation.directInputs };
}
async function treeFiles(root, prefix = "") {
  const result = [];
  for (const name of (await readdir(resolve(root, prefix))).sort()) {
    const rel = prefix ? `${prefix}/${name}` : name; const path = resolve(root, rel);
    const info = await lstat(path);
    if (info.isSymbolicLink()) fail(`package contains symlink ${rel}`);
    if (info.isDirectory()) result.push(...await treeFiles(root, rel));
    else if (info.isFile()) result.push(rel);
    else fail(`package contains non-regular entry ${rel}`);
  }
  return result;
}

export async function buildCadrM14(output) {
  const [policyPath, rightsPath, matrixPath, gatesPath, evidencePolicyPath, generatorPath, evidenceEnginePath] = await Promise.all([
    repoFile("cadr-web/release/cadr-m14-package-policy.json", "package policy"),
    repoFile("cadr-web/release/cadr-m14-rights-policy.json", "rights policy"),
    repoFile("cadr-web/release/cadr-m14-browser-matrix.json", "browser matrix"),
    repoFile("cadr-web/release/cadr-m14-gates.json", "conformance gates"),
    repoFile("cadr-web/release/cadr-m14-evidence-policy.json", "evidence policy"),
    repoFile("scripts/build-cadr-m14-release.mjs", "release generator"),
    repoFile("scripts/cadr-m14-evidence.mjs", "evidence admission engine"),
  ]);
  let [policyRecord, rightsRecord, matrixRecord, gatesRecord, evidencePolicyRecord] = await Promise.all([
    json(policyPath, "cadr-m14-package-policy-v2"),
    json(rightsPath, "cadr-m14-rights-policy-v1"),
    json(matrixPath, "cadr-m14-browser-matrix-v2"),
    json(gatesPath, "cadr-m14-evidence-qualified-gates-v3"),
    json(evidencePolicyPath, "cadr-m14-evidence-policy-v1", true),
  ]);
  let policy = policyRecord.value; let rights = rightsRecord.value;
  let matrix = matrixRecord.value; let gates = gatesRecord.value; let evidencePolicy = evidencePolicyRecord.value;
  validateM14PolicyDocuments(policy, rights, matrix, gates, evidencePolicy, hash(evidencePolicyRecord.bytes));
  await outputDirectory(output, "output", false);
  if (await lstat(`${output}.cdrm14`).then(() => true, error =>
    error?.code === "ENOENT" ? false : Promise.reject(error))) fail("archive already exists; replacement is forbidden");
  await mkdir(output, { mode: 0o755 }); await chmod(output, 0o755);
  await directoryNonSymlink(output, "new output");
  const sourcePaths = await Promise.all(policy.entries.map(entry =>
    repoFile(entry.source, `package source ${entry.source}`)));
  const closurePaths = [policyPath, rightsPath, matrixPath, gatesPath, evidencePolicyPath, generatorPath, evidenceEnginePath, ...sourcePaths];
  const captured = await buildProvenance(closurePaths, generatorPath);
  const provenance = captured.provenance;
  const capturedRecord = (path, schema, canonicalBytes = false) => jsonBytes(captured.captures.get(relative(ROOT, path)),
    relative(ROOT, path), schema, canonicalBytes);
  policyRecord = capturedRecord(policyPath, "cadr-m14-package-policy-v2");
  rightsRecord = capturedRecord(rightsPath, "cadr-m14-rights-policy-v1");
  matrixRecord = capturedRecord(matrixPath, "cadr-m14-browser-matrix-v2");
  gatesRecord = capturedRecord(gatesPath, "cadr-m14-evidence-qualified-gates-v3");
  evidencePolicyRecord = capturedRecord(evidencePolicyPath, "cadr-m14-evidence-policy-v1", true);
  policy = policyRecord.value; rights = rightsRecord.value;
  matrix = matrixRecord.value; gates = gatesRecord.value; evidencePolicy = evidencePolicyRecord.value;
  validateM14PolicyDocuments(policy, rights, matrix, gates, evidencePolicy, hash(evidencePolicyRecord.bytes));
  if (canonical(policy.entries.map(entry => entry.source).sort()) !==
      canonical(sourcePaths.map(path => relative(ROOT, path)).sort())) {
    fail("captured package policy source closure differs from discovered closure");
  }
  const directInput = path => {
    const input = provenance.directInputs.find(entry => entry.path === relative(ROOT, path));
    if (input === undefined) fail("source map direct input is absent from build provenance");
    return input;
  };
  const directInputsFor = paths => paths.map(directInput).sort((a, b) => a.path.localeCompare(b.path));
  const outputs = new Set(); const urls = new Set(); const sourceMap = []; const files = [];
  for (const entry of policy.entries) {
    if (outputs.has(entry.output) || urls.has(entry.url)) fail("package entry is duplicate");
    outputs.add(entry.output); urls.add(entry.url);
    const bytes = captured.captures.get(entry.source);
    if (bytes === undefined) fail(`captured package source ${entry.source} is absent`);
    assertNoNamedDefaultExternalPrimitive(bytes, entry.source);
    const components = relativeComponents(entry.output, `package output ${entry.output}`);
    if (components.length > 1) await ensureConfinedDirectory(output,
      components.slice(0, -1).join("/"), `package output ${entry.output}`);
    const destination = resolve(output, ...components);
    await writeFile(destination, bytes, { flag: "wx", mode: 0o644 });
    await chmod(destination, 0o644);
    files.push({ url: entry.url, path: entry.output, mediaType: entry.mediaType,
      mode: "0644", byteCount: bytes.byteLength, sha256: hash(bytes), rightsId: entry.rightsId });
    sourceMap.push({ output: entry.output, sources: [directInput(resolve(ROOT, entry.source))],
      transform: "byte-for-byte-copy" });
  }
  const rightsOutput = { schema: "cadr-m14-rights-provenance-v1",
    releaseClaim: "none", policySha256: hash(rightsRecord.bytes),
    records: rights.records, forbiddenBundleClasses: rights.forbiddenBundleClasses,
    assignments: [
      ...files.map(file => ({ path: file.path, rightsId: file.rightsId })),
      ...policy.generated.map(path => ({ path, rightsId: GENERATED_RIGHTS_ID })),
    ].sort((a, b) => a.path.localeCompare(b.path)) };
  const compatibility = { ...matrix, policySha256: hash(matrixRecord.bytes),
    adapterAttestationStatus: "none-recorded" };
  const generatedContent = new Map([
    ["rights-provenance.json", Buffer.from(`${canonical(rightsOutput)}\n`)],
    ["browser-compatibility-matrix.json", Buffer.from(`${canonical(compatibility)}\n`)],
    ["USER-GUIDE.md", Buffer.from(userGuide(policy))],
    ["CONFORMANCE-REPORT.md", Buffer.from(conformanceReport(gates, matrix))],
  ]);
  for (const [name, bytes] of generatedContent) {
    await writeFile(resolve(output, name), bytes, { flag: "wx" });
    await chmod(resolve(output, name), 0o644);
    sourceMap.push({ output: name, sources: name.startsWith("rights") ?
      directInputsFor([rightsPath, policyPath, generatorPath, ...sourcePaths]) :
      name.startsWith("browser") ? directInputsFor([matrixPath, generatorPath]) :
      name.startsWith("USER") ? directInputsFor([policyPath, generatorPath]) :
      directInputsFor([gatesPath, matrixPath, evidencePolicyPath, evidenceEnginePath, generatorPath]),
      transform: "deterministic-generator-v2" });
  }
  sourceMap.push({ output: "source-map.json",
    sources: provenance.directInputs,
    transform: "canonical-source-map-root-v2" });
  sourceMap.push({ output: "logical-build-manifest.json",
    sources: provenance.directInputs,
    transform: "canonical-logical-manifest-root-v2" });
  const sourceMapValue = { schema: "cadr-m14-source-map-v2", provenance,
    rule: "Every package file, including both canonical roots, maps to exact tracked HEAD blobs captured before output. The provenance binds the committed Git tree, Git and Node versions and executable hashes, and generator identity; no absolute paths or source text are embedded.",
    mappings: sourceMap.sort((a, b) => a.output.localeCompare(b.output)) };
  const sourceMapReceipt = await writeCanonical(resolve(output, "source-map.json"), sourceMapValue);
  const manifest = { schema: "cadr-m14-logical-build-manifest-v2",
    profile: policy.profile, status: "scaffold-only", releaseClaim: "none",
    logicalEpoch: policy.logicalEpoch, closedInventoryStatus: policy.closedInventoryStatus,
    offlineRuntimeStatus: policy.offlineRuntimeStatus,
    fileModePolicy: "directories 0755; regular files 0644; no executable or symbolic-link package entries",
    buildProvenance: provenance,
    sourceMapSha256: sourceMapReceipt.sha256,
    unresolvedComponents: policy.unresolvedComponents,
    excludedPrivateInputs: policy.excludedPrivateInputs,
    files: [...files, ...[...generatedContent].map(([path, bytes]) => ({
      url: `/${path}`, path, mediaType: path.endsWith(".json") ? "application/json" : "text/markdown",
      mode: "0644", byteCount: bytes.byteLength, sha256: hash(bytes),
      rightsId: GENERATED_RIGHTS_ID })),
      { url: "/source-map.json", path: "source-map.json", mediaType: "application/json",
        mode: "0644", byteCount: sourceMapReceipt.byteCount, sha256: sourceMapReceipt.sha256,
        rightsId: GENERATED_RIGHTS_ID }]
      .sort((a, b) => a.path.localeCompare(b.path)) };
  await writeCanonical(resolve(output, "logical-build-manifest.json"), manifest);
  await verifyCadrM14(output);
  return { manifest, archive: await deterministicArchive(output) };
}

export async function verifyCadrM14(output) {
  const packageRoot = await outputDirectory(output, "package output", true);
  const manifestRecord = await json(resolve(packageRoot, "logical-build-manifest.json"),
    "cadr-m14-logical-build-manifest-v2", true);
  const rightsRecord = await json(resolve(packageRoot, "rights-provenance.json"),
    "cadr-m14-rights-provenance-v1", true);
  const sourceMapRecord = await json(resolve(packageRoot, "source-map.json"),
    "cadr-m14-source-map-v2", true);
  const browserMatrixRecord = await json(resolve(packageRoot, "browser-compatibility-matrix.json"),
    "cadr-m14-browser-matrix-v2", true);
  const manifest = manifestRecord.value; const rights = rightsRecord.value;
  const sourceMap = sourceMapRecord.value; const browserMatrix = browserMatrixRecord.value;
  const generated = validateM14GeneratedJson(manifest, rights, sourceMap, browserMatrix);
  if (manifest.sourceMapSha256 !== hash(sourceMapRecord.bytes)) fail("logical manifest source-map identity differs");
  const expected = new Set(["logical-build-manifest.json"]);
  for (const file of manifest.files) {
    if (expected.has(file.path)) fail("logical manifest has duplicate file paths");
    expected.add(file.path);
  }
  if (generated.sourceMapOutputs.size !== expected.size ||
      [...expected].some(path => !generated.sourceMapOutputs.has(path))) {
    fail("source map does not cover the closed package inventory");
  }
  const actual = await treeFiles(packageRoot);
  if (expected.size !== actual.length || actual.some(path => !expected.has(path))) {
    fail("package inventory is not closed");
  }
  const assignments = new Map();
  for (const assignment of rights.assignments) {
    if (assignments.has(assignment.path) || !expected.has(assignment.path) ||
        !generated.rightsValidation.records.has(assignment.rightsId)) {
      fail("rights assignments are duplicate, outside the inventory, or unresolved");
    }
    assignments.set(assignment.path, assignment.rightsId);
  }
  if (assignments.size !== expected.size ||
      [...expected].some(path => !assignments.has(path))) {
    fail("rights assignments do not cover the closed package inventory");
  }
  for (const file of manifest.files) {
    const path = await existingConfined(packageRoot, file.path, `package file ${file.path}`, "file");
    const bytes = await readFile(path);
    const info = await lstat(path);
    if (bytes.byteLength !== file.byteCount || hash(bytes) !== file.sha256) {
      fail(`package identity differs for ${file.path}`);
    }
    if ((info.mode & 0o777) !== 0o644 || file.mode !== "0644") {
      fail(`package mode differs for ${file.path}`);
    }
    if (assignments.get(file.path) !== file.rightsId) {
      fail(`package rights assignment differs for ${file.path}`);
    }
    assertNoNamedDefaultExternalPrimitive(bytes, `packaged ${file.path}`);
  }
  return { files: actual.length, logicalManifestSha256:
    hash(await readFile(resolve(packageRoot, "logical-build-manifest.json"))) };
}

const main = import.meta.url === new URL(`file://${resolve(process.argv[1] ?? "")}`).href;
if (main) {
  const output = outputArgument(process.argv.slice(2));
  buildCadrM14(output).then(async result => {
    process.stdout.write(`${canonical({ artifact: relative(ROOT, output),
      archive: { ...result.archive, path: relative(ROOT, result.archive.path) },
      ...await verifyCadrM14(output), releaseClaim: "none" })}\n`);
  }).catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
