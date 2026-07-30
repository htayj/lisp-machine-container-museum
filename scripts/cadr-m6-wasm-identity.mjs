import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, parseCanonicalJson, sha256Hex } from
  "./cadr-m6-ready4-evidence.mjs";

export const M6_WASM_IDENTITY_SCHEMA = "cadr-m6-executable-build-identity-v2";
export const M6_WASM_PROFILE = "M6-DEVID1-O2";
export const M6_WASM_PROFILE_O0 = "M6-DEVID1-O0";

export const M6_EXECUTABLE_CONTROL_PATHS = Object.freeze([
  "scripts/aggregate-cadr-m6-ready4-campaign.mjs",
  "scripts/benchmark-cadr-m6-ready4-fast.mjs",
  "scripts/cadr-m6-ready4-evidence.mjs",
  "scripts/cadr-m6-wasm-identity.mjs",
  "scripts/collect-cadr-m6-ready4-benchmark.mjs",
  "scripts/run-cadr-m6-devid-o2-canary-stage.mjs",
  "scripts/run-cadr-m6-ready4-campaign.mjs",
  "scripts/run-cadr-m6-ready4-fast.mjs",
  "scripts/run-cadr-m6-ready4-systemd.mjs",
  "scripts/validate-cadr-m6-ready4-evidence.mjs",
  "cadr-web/wasm/cadr-m4-block-service.mjs",
  "cadr-web/wasm/cadr-m5-batch.mjs",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-display-renderer.mjs",
  "cadr-web/wasm/cadr-worker.js",
  "cadr-web/wasm/package.json",
  "cadr-web/oracle/cadr-m6-release-record.json",
  "cadr-web/profiles/cadr-web-303.json",
]);

export function m6ExecutableSourcePaths(root) {
  const tracked = execFileSync("git", ["ls-files", "--",
    "cadr-web/core", "cadr-web/include", "cadr-web/trace",
    "cadr-web/wasm/include"], { cwd: root, encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  return Object.freeze([...new Set([
    "cadr-web/Makefile",
    "cadr-web/wasm/build-wasm.sh",
    "cadr-web/wasm/cadr_wasm_runtime.c",
    "cadr-web/wasm/cadr_wasm_runtime.h",
    "cadr-web/wasm/cadr_wasm_adapter.c",
    "cadr-web/wasm/cadr_wasm_adapter.h",
    "cadr-web/core/cadr_m6_disk_evidence.c",
    "cadr-web/core/cadr_m6_disk_evidence.h",
    "cadr-web/core/cadr_m6_fast_run.c",
    "cadr-web/core/cadr_m6_fast_run.h",
    ...M6_EXECUTABLE_CONTROL_PATHS,
    ...tracked,
  ])].sort());
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}

function committedBytes(root, commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function ready4SourceClosure(root, commit = null,
  paths = m6ExecutableSourcePaths(root)) {
  const resolved = commit ?? execFileSync(
    "git", ["rev-parse", "--verify", "HEAD^{commit}"],
    { cwd: root, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(resolved)) {
    throw new TypeError("READY4 source commit is not a full Git commit");
  }
  const hash = createHash("sha256");
  hash.update("CADRM6EXECUTABLESOURCE2\0");
  for (const path of paths) {
    const expected = committedBytes(root, resolved, path);
    const actualPath = resolve(root, path);
    const metadata = await lstat(actualPath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`M6 executable closure path is not a regular file: ${path}`);
    }
    const actual = await readFile(actualPath);
    if (!actual.equals(expected)) {
      throw new Error(`READY4 Wasm source closure differs from commit at ${path}`);
    }
    hash.update(path); hash.update("\0"); hash.update(expected);
  }
  return Object.freeze({ source_commit: resolved,
    source_closure_sha256: hash.digest("hex"),
    paths: Object.freeze([...paths]) });
}

export async function validateStagedM6ExecutableClosure(
  stagedRoot, expected) {
  if (!/^[0-9a-f]{40}$/.test(expected?.source_commit ?? "") ||
      !/^[0-9a-f]{64}$/.test(expected?.source_closure_sha256 ?? "") ||
      !Array.isArray(expected?.paths)) {
    throw new TypeError("invalid expected M6 executable closure");
  }
  const hash = createHash("sha256");
  hash.update("CADRM6EXECUTABLESOURCE2\0");
  for (const path of expected.paths) {
    const target = resolve(stagedRoot, path);
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`staged M6 executable path is not regular: ${path}`);
    }
    const bytes = await readFile(target);
    hash.update(path); hash.update("\0"); hash.update(bytes);
  }
  const digest = hash.digest("hex");
  if (digest !== expected.source_closure_sha256) {
    throw new Error("staged M6 executable closure digest changed");
  }
  return expected;
}

export async function stageM6ExecutableClosure(root, stagedRoot,
  paths = m6ExecutableSourcePaths(root)) {
  /* Refuse a dirty executable before using the commit archive.  The archive
   * then removes the check/copy race: its bytes come from the verified commit,
   * not from paths which another process can change after verification. */
  const expected = await ready4SourceClosure(root, null, paths);
  await mkdir(stagedRoot, { recursive: false, mode: 0o700 });
  const archive = execFileSync("git", ["archive", "--format=tar",
    expected.source_commit], {
    cwd: root, encoding: "buffer", maxBuffer: 512 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", stagedRoot], { input: archive });
  /* Staged children receive the manifest and never resolve mutable Git state. */
  const hash = createHash("sha256");
  hash.update("CADRM6EXECUTABLESOURCE2\0");
  for (const path of expected.paths) {
    const bytes = await readFile(resolve(stagedRoot, path));
    hash.update(path); hash.update("\0"); hash.update(bytes);
  }
  if (hash.digest("hex") !== expected.source_closure_sha256) {
    throw new Error("new M6 executable stage differs from its commit closure");
  }
  return Object.freeze(expected);
}

export async function createM6WasmIdentityFromClosure(
  stagedRoot, wasmPath, optimization, closure) {
  if (!["O0", "O2"].includes(optimization)) {
    throw new TypeError("M6 Wasm optimization must be O0 or O2");
  }
  await validateStagedM6ExecutableClosure(stagedRoot, closure);
  const bytes = await readFile(wasmPath);
  if (bytes.byteLength === 0) throw new TypeError("READY4 Wasm is empty");
  return Object.freeze({
    schema: M6_WASM_IDENTITY_SCHEMA,
    wasm_profile: optimization === "O2" ? M6_WASM_PROFILE :
      M6_WASM_PROFILE_O0,
    wasm_optimization: optimization,
    wasm_byte_count: String(bytes.byteLength),
    wasm_sha256: sha256Hex(bytes),
    source_closure_sha256: closure.source_closure_sha256,
    source_commit: closure.source_commit,
  });
}

export async function createM6WasmIdentity(root, wasmPath, optimization) {
  if (!["O0", "O2"].includes(optimization)) {
    throw new TypeError("M6 Wasm optimization must be O0 or O2");
  }
  const source = await ready4SourceClosure(root);
  const bytes = await readFile(wasmPath);
  if (bytes.byteLength === 0) throw new TypeError("READY4 O2 Wasm is empty");
  return Object.freeze({
    schema: M6_WASM_IDENTITY_SCHEMA,
    wasm_profile: optimization === "O2" ? M6_WASM_PROFILE :
      M6_WASM_PROFILE_O0,
    wasm_optimization: optimization,
    wasm_byte_count: String(bytes.byteLength),
    wasm_sha256: sha256Hex(bytes),
    source_closure_sha256: source.source_closure_sha256,
    source_commit: source.source_commit,
  });
}

export async function createReady4WasmIdentity(root, wasmPath) {
  return createM6WasmIdentity(root, wasmPath, "O2");
}

export async function validateM6WasmIdentity(
  value, wasmPath, expectedOptimization) {
  exactKeys(value, ["schema", "source_closure_sha256", "source_commit",
    "wasm_byte_count", "wasm_optimization", "wasm_profile", "wasm_sha256"],
  "M6 Wasm identity");
  if (!["O0", "O2"].includes(expectedOptimization)) {
    throw new TypeError("expected M6 Wasm optimization is invalid");
  }
  if (value.schema !== M6_WASM_IDENTITY_SCHEMA ||
      value.wasm_profile !== (expectedOptimization === "O2" ?
        M6_WASM_PROFILE : M6_WASM_PROFILE_O0) ||
      value.wasm_optimization !== expectedOptimization ||
      !/^[1-9][0-9]*$/.test(value.wasm_byte_count) ||
      !/^[0-9a-f]{64}$/.test(value.wasm_sha256) ||
      !/^[0-9a-f]{64}$/.test(value.source_closure_sha256) ||
      !/^[0-9a-f]{40}$/.test(value.source_commit)) {
    throw new TypeError("M6 Wasm identity is not the exact build profile");
  }
  const metadata = await stat(wasmPath);
  const bytes = await readFile(wasmPath);
  if (!metadata.isFile() || String(bytes.byteLength) !== value.wasm_byte_count ||
      sha256Hex(bytes) !== value.wasm_sha256) {
    throw new TypeError("READY4 Wasm bytes differ from the O2 build identity");
  }
  return Object.freeze({ ...value });
}

export async function validateReady4WasmIdentity(value, wasmPath) {
  return validateM6WasmIdentity(value, wasmPath, "O2");
}

export function serializeReady4WasmIdentity(value) {
  return Buffer.from(canonicalJson(value));
}

export async function readReady4WasmIdentity(path, wasmPath) {
  return validateReady4WasmIdentity(
    parseCanonicalJson(await readFile(path), "READY4 Wasm identity"), wasmPath);
}
