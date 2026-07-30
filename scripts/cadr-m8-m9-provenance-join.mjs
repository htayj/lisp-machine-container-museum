/*
 * Shared M8/M9 X11/browser provenance binding.
 *
 * A byte-identical CDRINP1 capture is not by itself evidence that the browser
 * worker, the two M9 Wasm variants, and the native X11 witness describe the
 * same selected CADR-WEB-303 closure.  This module records exactly that
 * closure.  It deliberately hashes source and selected input bytes; it does
 * not assert that a Wasm compiler is reproducible from those bytes.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CADR_M8_M9_JOIN_SCHEMA = "cadr-m8-m9-x11-browser-provenance-v1";
export const CADR_M8_M9_WASM_VARIANTS = Object.freeze(["O0", "O2"]);
export const CADR_M8_M9_DIRECT_DIRTY_POLICY =
  "exact file hashes and scoped status are retained; no clean-checkout claim";
export const CADR_M8_M9_DIRECT_AUTHORITIES = Object.freeze([
  "scripts/run-cadr-m8-m9-input-conformance.mjs",
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
  "cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
  "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-worker.js",
  "cadr-web/wasm/cadr-m8-keyboard.mjs",
  "cadr-web/wasm/cadr-m9-pointer.mjs",
  "scripts/cadr-m8-m9-provenance-join.mjs",
  "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch",
]);

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const PREPARE_MARKER = "m8-m9-input-prepare.json";
const BUILD_MARKER = "m8-m9-input-build.json";
const M8_M9_PATCH = "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch";
const ARTIFACT_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, path: "l/usim/disk-sys-303-0.img" }),
]);
/* These roots cover both the exact direct worker/replay route and its exposed
 * M8/M9 browser seams.  `sourceClosure` follows every literal local ESM
 * import from each root; this list therefore declares the boundary without
 * becoming an error-prone second list of transitive modules. */
const STATIC_IMPORT_ROOTS = Object.freeze([
  "cadr-web/Makefile",
  "cadr-web/browser/cadr-m8-m9-worker-channel.mjs",
  "cadr-web/browser/cadr-m8-onscreen-keyboard.mjs",
  "cadr-web/browser/cadr-m9-pointer-adapter.mjs",
  "cadr-web/browser/cadr-m9-pointer-controls.mjs",
  "cadr-web/wasm/build-wasm.sh",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-m8-keyboard.mjs",
  "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
  "cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
  "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
  "cadr-web/wasm/cadr-m9-interactive-lifecycle.mjs",
  "cadr-web/wasm/cadr-m9-pointer.mjs",
  "cadr-web/wasm/cadr-worker.js",
  "cadr-web/wasm/cadr_wasm_adapter.c",
  "cadr-web/wasm/cadr_wasm_adapter.h",
  "cadr-web/wasm/cadr_wasm_memory.h",
  "cadr-web/wasm/cadr_wasm_runtime.c",
  "cadr-web/wasm/cadr_wasm_runtime.h",
  "scripts/cadr-computer-use.py",
  "scripts/cadr-computer-use.sh",
  "scripts/cadr-m6-witness-schedule.py",
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "scripts/cadr-m8-m9-provenance-join.mjs",
  "scripts/run-cadr-m8-m9-input-conformance.mjs",
  "scripts/run-cadr-m8-m9-x11-campaign.mjs",
  M8_M9_PATCH,
]);

function fail(message) { throw new TypeError(`C-M8/M9 provenance: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function repositoryPath(path, label) {
  const result = relative(ROOT, resolve(path)).split("\\").join("/");
  if (result.length === 0 || result === ".." || result.startsWith("../")) {
    fail(`${label} is outside the repository`);
  }
  return result;
}
function relativeInput(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") ||
      isAbsolute(value) || value.split(/[\\/]/).some(part => part === "" || part === "." || part === "..")) {
    fail(`${label} must be a nonempty repository-relative non-traversing path`);
  }
  return value;
}
/**
 * A lexical `resolve` check is insufficient for an evidence locator: a
 * symlinked parent can redirect a seemingly confined child after validation.
 * All repository and prepared-root inputs that this join opens therefore walk
 * every component with lstat before reading the terminal object.
 */
async function liveRepositoryPath(path, label, { directory = false } = {}) {
  const absolute = resolve(path);
  const relativePath = repositoryPath(absolute, label);
  const rootInfo = await lstat(ROOT);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail("repository root is not a non-symlink directory");
  }
  let cursor = ROOT;
  for (const [index, component] of relativePath.split("/").entries()) {
    cursor = resolve(cursor, component);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link component ${component}`);
    const terminal = index === relativePath.split("/").length - 1;
    if (!terminal && !info.isDirectory()) fail(`${label} has a non-directory ancestor ${component}`);
    if (terminal && (directory ? !info.isDirectory() : !info.isFile())) {
      fail(`${label} is not a ${directory ? "directory" : "regular file"}`);
    }
  }
  return Object.freeze({ path: absolute, relativePath });
}
async function regularIdentity(path, label) {
  const live = await liveRepositoryPath(path, label);
  const bytes = await readFile(live.path);
  return Object.freeze({ path: live.relativePath, bytes: bytes.byteLength,
    sha256: sha256(bytes) });
}
async function jsonFile(path, label) {
  const identity = await regularIdentity(path, label);
  try {
    return Object.freeze({ identity, value: JSON.parse((await readFile(path)).toString("utf8")) });
  } catch (error) {
    fail(`${label} is not UTF-8 JSON: ${error.message}`);
  }
}
async function collectCSourcePaths(directory, entries) {
  await liveRepositoryPath(directory, "M9 C source closure", { directory: true });
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) fail(`M9 C source closure contains symlink ${repositoryPath(path, "source")}`);
    if (info.isDirectory()) await collectCSourcePaths(path, entries);
    else if (info.isFile() && [".c", ".h"].includes(extname(name))) entries.push(path);
  }
}
function localStaticImports(source, label) {
  /* The selected files use ordinary literal ESM imports.  Do not guess at a
   * computed import: a computed local module cannot be made part of this
   * static provenance contract until it has an explicit, separately pinned
   * resolver.  Package and `node:` imports are runtime/toolchain surfaces, not
   * repository files. */
  const imports = new Set();
  const staticPattern = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/gm;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gm;
  for (const match of source.matchAll(/\bimport\s*\(([^)]*)\)/gm)) {
    if (!/^\s*["'][^"']+["']\s*$/.test(match[1])) {
      fail(`${label} has a computed dynamic import outside the static closure`);
    }
  }
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier.startsWith(".")) imports.add(specifier);
      else if (!specifier.startsWith("node:")) {
        fail(`${label} has an unpinned non-local static import ${JSON.stringify(specifier)}`);
      }
    }
  }
  return [...imports].sort();
}

function localImportPath(importer, specifier, label) {
  if (specifier.includes("\\0") || !specifier.startsWith(".")) {
    fail(`${label} has an invalid local import`);
  }
  const candidate = resolve(dirname(importer), specifier);
  /* A local module may use ../ within the repository, but it may never escape
   * it.  `repositoryPath` also makes the stored spelling deterministic. */
  repositoryPath(candidate, `${label} import ${specifier}`);
  return candidate;
}

/**
 * Collect literal local ESM modules recursively.  The optional roots and
 * reader are deliberately injectable for adversarial tests: changing any
 * reachable imported byte must change the closure identity.
 */
export async function collectCadrM8M9StaticImportClosure({ roots, readSource = readFile } = {}) {
  if (!Array.isArray(roots) || roots.length === 0) fail("static import roots are required");
  const pending = [...roots];
  const paths = new Map();
  const imports = new Map();
  while (pending.length !== 0) {
    const path = pending.pop();
    const relativePath = repositoryPath(path, "static import module");
    if (paths.has(relativePath)) continue;
    const identity = await regularIdentity(path, `static import module ${relativePath}`);
    paths.set(relativePath, path);
    if (![".mjs", ".js"].includes(extname(path))) continue;
    const source = (await readSource(path)).toString("utf8");
    const children = localStaticImports(source, relativePath).map(specifier =>
      localImportPath(path, specifier, relativePath));
    imports.set(relativePath, Object.freeze(children.map(child =>
      repositoryPath(child, `static import child of ${relativePath}`))));
    pending.push(...children);
  }
  const files = await Promise.all([...paths.entries()].sort(([left], [right]) =>
    left.localeCompare(right)).map(([, path]) => regularIdentity(path, "M8/M9 static import")));
  const edges = [...imports.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([path, children]) => Object.freeze({ path, imports: children }));
  return Object.freeze({ files: Object.freeze(files), static_imports: Object.freeze(edges) });
}

async function sourceClosure() {
  const paths = STATIC_IMPORT_ROOTS.map(path => resolve(ROOT, path));
  await Promise.all([
    collectCSourcePaths(resolve(ROOT, "cadr-web/core"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/include"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/trace"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/wasm/include"), paths),
  ]);
  const closure = await collectCadrM8M9StaticImportClosure({ roots: paths });
  const files = closure.files;
  return Object.freeze({ file_count: files.length,
    sha256: sha256(`${canonicalJson({ files, static_imports: closure.static_imports })}\n`),
    files, static_imports: closure.static_imports });
}
function git(args, label) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (result.error !== undefined || result.status !== 0 || result.signal !== null) {
    fail(`cannot resolve ${label}`);
  }
  return result.stdout.trim();
}
function gitBinding(relativePaths) {
  const candidate = git(["rev-parse", "HEAD"], "candidate commit");
  const candidateTree = git(["rev-parse", "HEAD^{tree}"], "candidate tree");
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"], "candidate parents")
    .split(/\s+/).slice(1);
  if (parents.length !== 1 || !/^[0-9a-f]{40}$/.test(parents[0])) {
    fail("candidate must have exactly one base parent");
  }
  const base = parents[0];
  const baseTree = git(["rev-parse", `${base}^{tree}`], "base tree");
  const status = spawnSync("git", ["status", "--porcelain=v1", "--", ...relativePaths],
    { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (status.error !== undefined || status.status !== 0 || status.signal !== null) {
    fail("cannot inspect M8/M9 source closure status");
  }
  return Object.freeze({ candidate_commit: candidate, candidate_tree: candidateTree,
    base_commit: base, base_tree: baseTree, candidate_parent_count: 1,
    closure_dirty: status.stdout.length !== 0,
    dirty_policy: "exact source hashes and scoped status bind a staged/current closure; no clean-checkout claim follows from a dirty closure",
    status_sha256: sha256(status.stdout), status: status.stdout });
}

function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) {
    fail(`${label} has an unexpected shape`);
  }
  return value;
}
function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a SHA-256 digest`);
  }
  return value;
}
function sourcePins(value) {
  const pins = exactObject(value, ["lm3_l", "sys", "usim", "chaos", "usite"],
    "CADR-WEB source pins");
  for (const [name, pin] of Object.entries(pins)) {
    exactObject(pin, ["vcs", "hash_algorithm", "revision"], `CADR-WEB source pin ${name}`);
    if (pin.vcs !== "fossil" || pin.hash_algorithm !== "sha3-256" ||
        typeof pin.revision !== "string" || !/^[0-9a-f]{64}$/.test(pin.revision)) {
      fail(`CADR-WEB source pin ${name} is malformed`);
    }
  }
  return Object.freeze(structuredClone(pins));
}
function releaseArtifactRecords(value) {
  if (!Array.isArray(value) || value.length !== 5) fail("frozen M6 release has no exact five-artifact closure");
  const byKind = new Map();
  for (const record of value) {
    exactObject(record, ["byte_count", "kind", "sha256"], "frozen M6 artifact record");
    if (!Number.isSafeInteger(record.kind) || ![1, 2, 3, 4, 5].includes(record.kind) ||
        typeof record.byte_count !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(record.byte_count)) {
      fail("frozen M6 artifact record is malformed");
    }
    digest(record.sha256, "frozen M6 artifact digest");
    if (byKind.has(record.kind)) fail("frozen M6 artifact closure has duplicate kind");
    byKind.set(record.kind, Object.freeze({ ...record }));
  }
  if (byKind.size !== 5) fail("frozen M6 artifact closure is incomplete");
  /* Preserve the frozen release record's ABI order (1, 2, 4, 5, 3).  It is
   * part of the native capture evidence, while the map above enforces that
   * the logical closure itself is complete. */
  return Object.freeze(value.map(record => Object.freeze({ ...record })));
}
function releaseNativeInputs(value) {
  if (!Array.isArray(value) || value.length !== 1) fail("frozen M6 release has no exact native-input closure");
  const record = value[0];
  exactObject(record, ["byte_count", "id", "sha256"], "frozen M6 native input");
  if (record.id !== "usite-extra-hosts" || typeof record.byte_count !== "string" ||
      !/^(?:0|[1-9][0-9]*)$/.test(record.byte_count)) fail("frozen M6 native input is malformed");
  digest(record.sha256, "frozen M6 native input digest");
  return Object.freeze([{ ...record }]);
}
async function selectedInputs() {
  const [profile, release, artifacts] = await Promise.all([
    jsonFile(PROFILE_PATH, "CADR-WEB profile"),
    jsonFile(RELEASE_PATH, "frozen M6 release record"),
    Promise.all(ARTIFACT_LAYOUT.map(async item => {
      const identity = await regularIdentity(resolve(ROOT, item.path), `selected artifact ${item.path}`);
      return Object.freeze({ kind: item.kind, ...identity });
    })),
  ]);
  if (profile.value?.schema !== "cadr-web-profile" || profile.value?.schema_version !== 1 ||
      profile.value?.profile?.id !== "CADR-WEB-303" ||
      release.value?.schema !== "cadr-m6-native-debug-ir-release-record-v1" ||
      release.value?.target !== "CADR-WEB-303/ABI1.4/protocol-v4/M6" ||
      release.value?.contract !== "C-M6-DEBUG-IR-LISTENER-READY-ABC-v1") {
    fail("selected profile or frozen M6 release differs");
  }
  const pins = sourcePins(profile.value.source_pins);
  const releaseArtifacts = releaseArtifactRecords(release.value.artifacts);
  const releaseByKind = new Map(releaseArtifacts.map(item => [item.kind, item]));
  const nativeInputs = releaseNativeInputs(release.value.native_inputs);
  exactObject(release.value.identities, ["cadet_mapping_sha256", "native_executable_sha256",
    "oracle_patch_sha256", "system_fossil", "usim_fossil"], "frozen M6 release identities");
  for (const key of Object.keys(release.value.identities)) digest(release.value.identities[key],
    `frozen M6 release identity ${key}`);
  if (release.value.identities.system_fossil !== pins.sys.revision ||
      release.value.identities.usim_fossil !== pins.usim.revision) {
    fail("frozen M6 release source pins differ from CADR-WEB profile");
  }
  exactObject(release.value.schedule, ["event_count", "post_a_batches", "pre_a_batches", "schema", "sha256"],
    "frozen M6 release schedule");
  if (release.value.schedule.schema !== "cadr-m6-raw-cadet-boundary-schedule-v1" ||
      !Number.isSafeInteger(release.value.schedule.event_count) ||
      release.value.schedule.event_count < 1) fail("frozen M6 release schedule is malformed");
  digest(release.value.schedule.sha256, "frozen M6 release schedule digest");
  exactObject(release.value.execution_environment, ["inherited", "policy_id", "variables"],
    "frozen M6 release execution environment");
  if (release.value.execution_environment.inherited !== false ||
      release.value.execution_environment.policy_id !== "cadr-m6-native-minimal-environment-v1" ||
      canonicalJson(release.value.execution_environment.variables) !== canonicalJson({ LANG: "C", LC_ALL: "C", TZ: "UTC" })) {
    fail("frozen M6 release execution environment differs");
  }
  for (const artifact of artifacts) {
    const releaseArtifact = releaseByKind.get(artifact.kind);
    if (releaseArtifact?.sha256 !== artifact.sha256 ||
        releaseArtifact?.byte_count !== String(artifact.bytes)) {
      fail(`selected artifact ${artifact.path} differs from frozen release identity`);
    }
  }
  return Object.freeze({ profile: Object.freeze({ ...profile.identity, id: profile.value.profile.id,
      source_pins: pins }),
    release: Object.freeze({ ...release.identity, schema: release.value.schema, target: release.value.target,
      contract: release.value.contract, identities: Object.freeze({ ...release.value.identities }),
      schedule: Object.freeze({ schema: release.value.schedule.schema,
        sha256: release.value.schedule.sha256, event_count: release.value.schedule.event_count }),
      execution_environment: Object.freeze(structuredClone(release.value.execution_environment)),
      artifacts: releaseArtifacts, native_inputs: nativeInputs }),
    artifacts: Object.freeze(artifacts) });
}
async function nativePreparedBinding(prepared) {
  const preparedInput = relativeInput(prepared, "prepared native closure");
  const preparedLive = await liveRepositoryPath(resolve(ROOT, preparedInput), "prepared native closure",
    { directory: true });
  const root = preparedLive.path;
  const [prepare, build, patch] = await Promise.all([
    jsonFile(resolve(root, PREPARE_MARKER), "M8/M9 preparation marker"),
    jsonFile(resolve(root, BUILD_MARKER), "M8/M9 build marker"),
    regularIdentity(resolve(ROOT, M8_M9_PATCH), "M8/M9 native patch"),
  ]);
  if (prepare.value?.schema !== "cadr-m8-m9-input-prepare-v1" || prepare.value?.schema_version !== 1 ||
      build.value?.schema !== "cadr-m8-m9-input-build-v1" || build.value?.schema_version !== 1 ||
      prepare.value?.prepared_source_tree_sha256 !== build.value?.prepared_source_tree_sha256 ||
      prepare.value?.prepared_source_file_count !== build.value?.prepared_source_file_count ||
      build.value?.m8_m9_patch_sha256 !== patch.sha256 ||
      prepare.value?.m8_m9_patch?.sha256 !== patch.sha256) {
    fail("prepared native X11 closure marker is incomplete or mismatched");
  }
  if (!Number.isSafeInteger(build.value.prepared_source_file_count) ||
      build.value.prepared_source_file_count < 1 ||
      !/^[0-9a-f]{64}$/.test(build.value.prepared_source_tree_sha256) ||
      !Array.isArray(prepare.value.m8_m9_native_support) ||
      prepare.value.m8_m9_native_support.length !== 4 ||
      build.value.forbidden_undefined_symbol_count !== 0 ||
      !build.value?.x11_witness?.build_command?.includes("USIM_BACKEND=m8-m9-x11-witness")) {
    fail("prepared native X11 closure marker has no complete M8/M9 witness contract");
  }
  async function boundExecutable(marker, label) {
    if (typeof marker?.path !== "string" || !Number.isSafeInteger(marker.bytes) ||
        !/^[0-9a-f]{64}$/.test(marker.sha256)) {
      fail(`prepared native closure has no exact ${label} executable marker`);
    }
    const expected = `${preparedLive.relativePath}/source/usim/usim-m8-m9-${label === "direct" ? "direct" : "x11-witness"}`;
    if (marker.path !== expected) {
      fail(`prepared ${label} witness executable path is not the exact prepared source/usim output`);
    }
    const identity = await regularIdentity(resolve(ROOT, marker.path), `prepared ${label} witness executable`);
    if (identity.bytes !== marker.bytes || identity.sha256 !== marker.sha256) {
      fail(`prepared ${label} witness executable differs from its build marker`);
    }
    return identity;
  }
  const [direct, x11] = await Promise.all([
    boundExecutable(build.value, "direct"),
    boundExecutable(build.value?.x11_witness, "X11"),
  ]);
  return Object.freeze({ prepared_root: preparedLive.relativePath,
    prepare_marker: prepare.identity, build_marker: build.identity,
    /* These records are evidence-only metadata.  They contain paths observed at
     * preparation time; consumers compare their bytes but never dereference a
     * path embedded in them. */
    prepare_record: Object.freeze(structuredClone(prepare.value)),
    build_record: Object.freeze(structuredClone(build.value)),
    prepared_source_tree_sha256: build.value.prepared_source_tree_sha256,
    prepared_source_file_count: build.value.prepared_source_file_count,
    patch, direct_witness: direct, x11_witness: x11 });
}
async function m9WasmPair() {
  const entries = await Promise.all(CADR_M8_M9_WASM_VARIANTS.map(async variant => {
    const identity = await regularIdentity(resolve(ROOT,
      `cadr-web/build/cadr-web-m9-${variant}.wasm`), `M9 ${variant} Wasm`);
    const bytes = await readFile(resolve(ROOT, identity.path));
    if (!WebAssembly.validate(bytes)) fail(`M9 ${variant} Wasm is not structurally valid`);
    return [variant, identity];
  }));
  return Object.freeze(Object.fromEntries(entries));
}

/**
 * Returns one canonical record that both browser direct campaigns and an X11
 * campaign must carry byte-for-byte.  The optional `prepared` root must have
 * been produced by the native M8/M9 preparer; no native machine is launched.
 */
export async function collectCadrM8M9ProvenanceJoin({ prepared } = {}) {
  if (typeof prepared !== "string" || prepared.length === 0) {
    fail("a prepared M8/M9 native closure is required");
  }
  const [sources, inputs, native, wasm] = await Promise.all([
    sourceClosure(), selectedInputs(), nativePreparedBinding(prepared), m9WasmPair(),
  ]);
  const gitState = gitBinding(sources.files.map(file => file.path));
  return Object.freeze({ schema: CADR_M8_M9_JOIN_SCHEMA,
    repository: gitState, source_closure: sources, selected_inputs: inputs,
    native_x11_closure: native, m9_wasm: wasm });
}

export function canonicalCadrM8M9ProvenanceJoin(value) { return canonicalJson(value); }

export function assertCadrM8M9ProvenanceJoin(actual, expected, label = "provenance binding") {
  if (actual?.schema !== CADR_M8_M9_JOIN_SCHEMA ||
      canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} differs from the staged/current M8/M9 closure`);
  }
  return actual;
}
