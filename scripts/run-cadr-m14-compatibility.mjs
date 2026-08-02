#!/usr/bin/env node
/*
 * Bounded collector for private, untrusted browser-adapter attestations.
 *
 * This scaffold has no registered browser adapters.  Therefore an execution
 * record can say only that an adapter was run in a Bubblewrap network namespace;
 * it cannot advance the browser matrix or any CW gate.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_ROOT = resolve(ROOT, "build/cadr-m14");
const MATRIX_PATH = resolve(ROOT, "cadr-web/release/cadr-m14-browser-matrix.json");
const COLLECTOR = fileURLToPath(import.meta.url);
const BWRAP_PATH = "/usr/bin/bwrap";
const ENGINES = ["Blink", "Gecko", "WebKit"];

function fail(message) { throw new TypeError(`C-M14 matrix: ${message}`); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(
    key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    fail(`${label} has missing or extra fields`);
  }
}
function nonemptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a nonempty string`);
  return value;
}
function validateEvidenceAuthority(value, label) {
  exactKeys(value, ["receiptAdmission", "manualStatus", "freeFormEvidence"], label);
  if (value.receiptAdmission !== "not-implemented-no-receipts-accepted" ||
      value.manualStatus !== "cannot-advance" || value.freeFormEvidence !== "cannot-advance") {
    fail(`${label} permits unqualified evidence`);
  }
}
function canonicalAbsolute(value, label) {
  nonemptyString(value, label);
  if (!isAbsolute(value) || value !== resolve(value) || value.includes("//") || value.includes("/./") ||
      value.includes("/../") || value.endsWith("/..") || value.endsWith("/.")) {
    fail(`${label} must be a canonical absolute path`);
  }
  return value;
}
function relativeComponents(value, label) {
  nonemptyString(value, label);
  if (isAbsolute(value) || value.includes("\\") || value.includes("//")) {
    fail(`${label} must be a canonical relative slash path`);
  }
  const parts = value.split("/");
  if (parts.some(part => part.length === 0 || part === "." || part === "..")) {
    fail(`${label} escapes its confinement`);
  }
  return parts;
}
async function directoryNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`${label} must be a non-symlink directory`);
}
async function fileNonSymlink(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} must be a non-symlink regular file`);
}
async function confined(root, absolute, label, finalKind) {
  canonicalAbsolute(absolute, label);
  await directoryNonSymlink(root, `${label} confinement root`);
  const rel = relative(root, absolute);
  const parts = relativeComponents(rel, label);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link component: ${part}`);
    if (index + 1 < parts.length && !info.isDirectory()) fail(`${label} has a non-directory ancestor`);
    if (index + 1 === parts.length &&
        ((finalKind === "file" && !info.isFile()) || (finalKind === "directory" && !info.isDirectory()))) {
      fail(`${label} has the wrong final entry type`);
    }
  }
  return current;
}
async function repoFile(path, label) { return confined(ROOT, path, label, "file"); }
async function privateDirectDirectory(path, label) {
  canonicalAbsolute(path, label);
  if (dirname(path) !== PRIVATE_ROOT) fail(`${label} must be a direct child of build/cadr-m14`);
  return confined(PRIVATE_ROOT, path, label, "directory");
}
async function privateDirectFile(path, home, label, mustBeAbsent = false) {
  canonicalAbsolute(path, label);
  if (dirname(path) !== home || basename(path) === "." || basename(path) === "..") {
    fail(`${label} must be a direct private-home child`);
  }
  if (mustBeAbsent) {
    try { await lstat(path); fail(`${label} already exists`); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
    return path;
  }
  return confined(home, path, label, "file");
}
function parseCanonicalJson(bytes, label) {
  if (!bytes.toString("utf8").endsWith("\n")) fail(`${label} lacks a terminal LF`);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch { fail(`${label} is not JSON`); }
  if (!Buffer.from(`${canonical(value)}\n`).equals(bytes)) fail(`${label} is not canonical JSON`);
  return value;
}
async function matrixPolicy() {
  await repoFile(MATRIX_PATH, "browser matrix policy");
  const matrix = JSON.parse((await readFile(MATRIX_PATH)).toString("utf8"));
  exactKeys(matrix, ["schema", "evidenceStatus", "evidenceAuthority", "closedInventoryStatus", "offlineRuntimeStatus",
    "registeredAdapters", "required", "checks"],
    "browser matrix policy");
  validateEvidenceAuthority(matrix.evidenceAuthority, "browser matrix policy evidence authority");
  if (matrix.schema !== "cadr-m14-browser-matrix-v2" || matrix.evidenceStatus !== "not-evaluated" ||
      matrix.closedInventoryStatus !== "closed-static-inventory" || matrix.offlineRuntimeStatus !== "not-evaluated" ||
      !Array.isArray(matrix.registeredAdapters) || matrix.registeredAdapters.length !== 0 ||
      !Array.isArray(matrix.required) || matrix.required.length !== 3) {
    fail("browser matrix policy is not the bounded unevaluated scaffold");
  }
  for (const [index, row] of matrix.required.entries()) {
    exactKeys(row, ["id", "engine", "adapter", "networkMode"], `browser matrix row ${index}`);
    if (!ENGINES.includes(row.engine) || row.adapter !== null || row.networkMode !== "denied") {
      fail("browser matrix row is not a denied-network unconfigured row");
    }
  }
  if (new Set(matrix.required.map(row => row.engine)).size !== ENGINES.length) {
    fail("browser matrix policy lacks a required engine");
  }
  return matrix;
}
async function runtimeMounts() {
  const mounts = [];
  for (const path of ["/usr", "/nix", "/gnu"]) {
    try {
      const info = await lstat(path);
      if (info.isDirectory() && !info.isSymbolicLink()) mounts.push(path);
    } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  return mounts;
}
async function parsePlan(planPath, outputPath, packagePath) {
  await confined(PRIVATE_ROOT, planPath, "private attestation plan", "file");
  const planBytes = await readFile(planPath); const plan = parseCanonicalJson(planBytes, "private attestation plan");
  exactKeys(plan, ["schema", "privateHome", "adapters"], "private attestation plan");
  if (plan.schema !== "cadr-m14-private-browser-adapter-attestations-v2" ||
      !Array.isArray(plan.adapters) || plan.adapters.length !== 3) {
    fail("private attestation plan has the wrong schema");
  }
  canonicalAbsolute(plan.privateHome, "private attestation plan privateHome");
  const home = await privateDirectDirectory(plan.privateHome, "private attestation plan privateHome");
  if (dirname(planPath) !== home || basename(planPath) !== "plan.json") {
    fail("private attestation plan must be the private home's plan.json");
  }
  await privateDirectFile(outputPath, home, "attestation output", true);
  await confined(PRIVATE_ROOT, packagePath, "package", "directory");
  const packageManifest = await confined(packagePath, resolve(packagePath, "logical-build-manifest.json"),
    "package manifest", "file");
  const logicalBytes = await readFile(packageManifest);
  const logical = parseCanonicalJson(logicalBytes, "package manifest");
  if (logical.schema !== "cadr-m14-logical-build-manifest-v2" || logical.status !== "scaffold-only" ||
      logical.closedInventoryStatus !== "closed-static-inventory" || logical.offlineRuntimeStatus !== "not-evaluated" ||
      logical.releaseClaim !== "none") fail("package manifest is nonconforming");
  const executable = await realpath(process.execPath);
  await fileNonSymlink(executable, "collector runtime executable");
  const executableSha256 = hash(await readFile(executable));
  const matrix = await matrixPolicy();
  const adapters = [];
  for (const [index, item] of plan.adapters.entries()) {
    exactKeys(item, ["rowId", "adapterId", "engine", "toolId", "executableSha256", "script"],
      `private adapter ${index}`);
    nonemptyString(item.rowId, `private adapter ${index} rowId`);
    nonemptyString(item.adapterId, `private adapter ${index} adapterId`);
    nonemptyString(item.engine, `private adapter ${index} engine`);
    nonemptyString(item.toolId, `private adapter ${index} toolId`);
    nonemptyString(item.executableSha256, `private adapter ${index} executableSha256`);
    if (!ENGINES.includes(item.engine) || item.adapterId.startsWith("registered-") ||
        item.executableSha256 !== executableSha256 || !/^[0-9a-f]{64}$/u.test(item.executableSha256)) {
      fail("private adapter has an unpinned or falsely registered executable identity");
    }
    const row = matrix.required.find(value => value.id === item.rowId && value.engine === item.engine);
    if (row === undefined) fail("private adapter does not match a required matrix row");
    const scriptParts = relativeComponents(item.script, `private adapter ${index} script`);
    if (scriptParts.length !== 1) fail("private adapter script must be a direct private-home file");
    const script = await privateDirectFile(resolve(home, scriptParts[0]), home,
      `private adapter ${index} script`);
    adapters.push({ ...item, script });
  }
  if (new Set(adapters.map(item => item.engine)).size !== ENGINES.length ||
      new Set(adapters.map(item => item.rowId)).size !== ENGINES.length ||
      new Set(adapters.map(item => item.adapterId)).size !== ENGINES.length) {
    fail("private attestation plan duplicates or omits a required adapter row");
  }
  return { adapters, executable, executableSha256, home, logicalBytes, planBytes };
}
function validateUntrustedAttestation(bytes, adapter, logicalManifestSha256) {
  const evidence = parseCanonicalJson(Buffer.from(bytes), `${adapter.engine} adapter attestation`);
  exactKeys(evidence, ["schema", "adapterId", "engine", "toolId", "executableSha256",
    "logicalManifestSha256", "observations"], `${adapter.engine} adapter attestation`);
  exactKeys(evidence.observations, ["networkRequests", "networkNamespaceObserved",
    "nonLoopbackInterfaces", "packageInventoryClosed"], `${adapter.engine} adapter observations`);
  if (evidence.schema !== "cadr-m14-untrusted-adapter-attestation-v2" ||
      evidence.adapterId !== adapter.adapterId || evidence.engine !== adapter.engine ||
      evidence.toolId !== adapter.toolId || evidence.executableSha256 !== adapter.executableSha256 ||
      evidence.logicalManifestSha256 !== logicalManifestSha256 || evidence.observations.networkRequests !== 0 ||
      evidence.observations.networkNamespaceObserved !== true || evidence.observations.packageInventoryClosed !== true ||
      !Array.isArray(evidence.observations.nonLoopbackInterfaces) ||
      evidence.observations.nonLoopbackInterfaces.some(value => typeof value !== "string") ||
      evidence.observations.nonLoopbackInterfaces.length !== 0) {
    fail(`${adapter.engine} adapter attestation is malformed or mismatched`);
  }
  return evidence;
}
async function runAdapter(adapter, packagePath, home, executable, logicalManifestSha256) {
  const bwrap = await realpath(BWRAP_PATH);
  await fileNonSymlink(bwrap, "Bubblewrap executable");
  const argv = ["--die-with-parent", "--new-session", "--unshare-net", "--tmpfs", "/",
    "--dir", "/package", "--ro-bind", packagePath, "/package",
    "--dir", "/private", "--ro-bind", home, "/private", "--proc", "/proc", "--dev", "/dev"];
  for (const mount of await runtimeMounts()) argv.push("--dir", mount, "--ro-bind", mount, mount);
  /* The host's /lib and /lib64 are symlinks into /usr.  Recreate only those
   * loader aliases inside the otherwise empty sandbox root; do not mount /. */
  argv.push("--symlink", "/usr/lib", "/lib", "--symlink", "/usr/lib", "/lib64");
  argv.push("--chdir", "/package", "--", executable, `/private/${adapter.script.split("/").at(-1)}`,
    adapter.engine, logicalManifestSha256, adapter.executableSha256);
  const run = spawnSync(bwrap, argv, { cwd: ROOT, encoding: "utf8", timeout: 180_000,
    killSignal: "SIGKILL", env: { LANG: "C", LC_ALL: "C", TZ: "UTC", HOME: "/private", TMPDIR: "/tmp" } });
  if (run.error || run.signal || run.status !== 0 || run.stderr.length !== 0) {
    fail(`${adapter.engine} adapter failed: ${run.error?.message ?? (run.stderr.trim() || run.signal || run.status)}`);
  }
  return validateUntrustedAttestation(run.stdout, adapter, logicalManifestSha256);
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  process.stdout.write(`${canonical({ schema: "cadr-m14-compatibility-plan-v2", outcome: "blocked",
    runtimeExecutionPerformed: false, reason: "explicit---execute-required", requiredEngines: ENGINES,
    browserMatrixEvidenceStatus: "not-evaluated", closedInventoryStatus: "closed-static-inventory",
    offlineRuntimeStatus: "not-evaluated" })}\n`); process.exitCode = 2;
} else {
  if (argv.length !== 7 || argv[0] !== "--execute" || argv[1] !== "--plan" ||
      argv[3] !== "--package" || argv[5] !== "--output") {
    fail("--execute requires exactly --plan, --package, and --output");
  }
  const planPath = canonicalAbsolute(argv[2], "--plan");
  const packagePath = canonicalAbsolute(argv[4], "--package");
  const outputPath = canonicalAbsolute(argv[6], "--output");
  const prepared = await parsePlan(planPath, outputPath, packagePath);
  const logicalManifestSha256 = hash(prepared.logicalBytes);
  const attestations = [];
  for (const adapter of prepared.adapters) {
    attestations.push(await runAdapter(adapter, packagePath, prepared.home, prepared.executable,
      logicalManifestSha256));
  }
  const collectorBytes = await readFile(COLLECTOR);
  const report = { schema: "cadr-m14-untrusted-adapter-attestations-v2", releaseClaim: "none",
    browserMatrixEvidenceStatus: "not-evaluated", disposition:
      "untrusted-attestations-only-no-registered-pinned-real-browser-adapters",
    closedInventoryStatus: "closed-static-inventory", offlineRuntimeStatus: "not-evaluated",
    planSha256: hash(prepared.planBytes), logicalManifestSha256,
    sandboxRuntimeDenial: "bubblewrap-unshare-net",
    collector: { path: "scripts/run-cadr-m14-compatibility.mjs", sha256: hash(collectorBytes) },
    runtime: { toolId: "node-collector-runtime", executableSha256: prepared.executableSha256 },
    attestations: attestations.sort((a, b) => a.engine.localeCompare(b.engine)) };
  await writeFile(outputPath, `${canonical(report)}\n`, { flag: "wx", mode: 0o600 });
  process.stdout.write(`${canonical({ outcome: "untrusted-attestations-recorded", releaseClaim: "none",
    browserMatrixEvidenceStatus: "not-evaluated", closedInventoryStatus: "closed-static-inventory",
    offlineRuntimeStatus: "not-evaluated", output: relative(ROOT, outputPath) })}\n`);
}
