#!/usr/bin/env node
/* Build the one-run cause witness from the index, never from an in-progress
 * worktree.  In particular, untracked or unstaged M7 display sources cannot
 * enter this diagnostic module. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATCH = resolve(ROOT,
  "cadr-web/oracle/patches/0004-m6-postterminal-diagnostic.patch");
const TMP_ROOT = "/tmp";
const DELTA_OWNED_CONSTRUCTION_SOURCES = Object.freeze([
  "cadr-web/tests/test_cadr_m6_postterminal_adapter.c",
  "scripts/run-cadr-m6-one-run-diagnostic-stage.mjs",
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.input === undefined ? ["ignore", "pipe", "pipe"] :
      ["pipe", "pipe", "pipe"],
    ...options,
  });
}

/* Kept separately testable so a caller cannot accidentally reintroduce
 * --unsafe-paths while changing the isolated-build plumbing.  git apply's
 * ordinary path validation is intentional: the diagnostic delta may only
 * modify files beneath the archive materialization. */
export function applyM6DiagnosticDelta(stage, patchBytes) {
  const args = ["apply", "--whitespace=error", "-"];
  run("git", ["apply", "--check", "--whitespace=error", "-"], {
    cwd: stage, input: patchBytes,
  });
  run("git", args, { cwd: stage, input: patchBytes });
}

function artifact(path, bytes) {
  return Object.freeze({ path, sha256: sha256(bytes) });
}

export async function revalidateM6DiagnosticIsolated(build) {
  if (build?.schema !== "cadr-m6-isolated-diagnostic-build-v2") {
    throw new TypeError("not an isolated M6 diagnostic build record");
  }
  const paths = [
    ["wasm", build.wasm.path],
    ["worker", build.worker.path],
    ["headless", build.headless.path],
    ["diagnostic_runner", build.diagnostic_runner.path],
    ["launcher", build.launcher.path],
  ];
  for (const [name, path] of paths) {
    const bytes = await readFile(path);
    const expected = build[name].sha256;
    if (sha256(bytes) !== expected) {
      throw new Error(`isolated M6 diagnostic ${name} changed after build`);
    }
    if (name === "wasm" && bytes.byteLength !== build.wasm.byte_count) {
      throw new Error("isolated M6 diagnostic Wasm byte count changed after build");
    }
  }
  return build;
}

export async function buildM6DiagnosticIsolated() {
  const stagedConstructionSources = run("git", ["diff", "--cached", "--name-only", "--",
    ...DELTA_OWNED_CONSTRUCTION_SOURCES]).trim();
  if (stagedConstructionSources !== "") {
    throw new Error("M6 diagnostic construction sources belong only to 0004; " +
      "remove them from the index before building the isolated tree");
  }
  const [patchBytes, builderBytes, launcherBytes] = await Promise.all([
    readFile(PATCH), readFile(fileURLToPath(import.meta.url)),
    readFile(resolve(ROOT, "scripts/run-cadr-m6-one-run-diagnostic.mjs")),
  ]);
  const stagedTree = run("git", ["write-tree"]).trim();
  const stage = await mkdtemp(`${TMP_ROOT}/cadr-m6-diagnostic-`);
  try {
    /* write-tree names an immutable tree object.  Archive that exact object;
     * do not consult the live index again after recording its identity. */
    const archive = execFileSync("git", ["archive", "--format=tar", stagedTree], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 512 * 1024 * 1024,
    });
    execFileSync("tar", ["-xf", "-", "-C", stage], { input: archive });
    applyM6DiagnosticDelta(stage, patchBytes);
    const wasmPath = resolve(stage, "cadr-web/build/cadr-web-m6-diagnostic-O0.wasm");
    execFileSync("sh", [resolve(stage, "cadr-web/wasm/build-wasm.sh"),
      "--m6-diagnostic", "--opt", "O0", wasmPath], {
      cwd: stage,
      stdio: "inherit",
    });
    const [wasm, workerBytes, headlessBytes, diagnosticRunnerBytes] = await Promise.all([
      readFile(wasmPath),
      readFile(resolve(stage, "cadr-web/wasm/cadr-worker.js")),
      readFile(resolve(stage, "cadr-web/wasm/cadr-m6-headless-boot.mjs")),
      readFile(resolve(stage, "scripts/run-cadr-m6-one-run-diagnostic-stage.mjs")),
    ]);
    const module = new WebAssembly.Module(wasm);
    const exports = WebAssembly.Module.exports(module).map(entry => entry.name);
    if (!exports.includes("cadr_wasm_post_terminal_diagnostic") ||
        exports.includes("cadr_wasm_display_full") ||
        exports.includes("cadr_wasm_display_update")) {
      throw new Error("isolated C-M6 diagnostic module has the wrong export surface");
    }
    return Object.freeze({
      builder_sha256: sha256(builderBytes),
      diagnostic_delta_sha256: sha256(patchBytes),
      schema: "cadr-m6-isolated-diagnostic-build-v2",
      staged_tree_git_object: stagedTree,
      stage_directory: stage,
      wasm: Object.freeze({
        byte_count: wasm.byteLength,
        path: wasmPath,
        sha256: sha256(wasm),
      }),
      worker: artifact(resolve(stage, "cadr-web/wasm/cadr-worker.js"), workerBytes),
      headless: artifact(resolve(stage, "cadr-web/wasm/cadr-m6-headless-boot.mjs"), headlessBytes),
      diagnostic_runner: artifact(resolve(stage,
        "scripts/run-cadr-m6-one-run-diagnostic-stage.mjs"), diagnosticRunnerBytes),
      launcher: artifact(resolve(ROOT, "scripts/run-cadr-m6-one-run-diagnostic.mjs"), launcherBytes),
    });
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

if (typeof process.argv[1] === "string" &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildM6DiagnosticIsolated().then(result => {
    process.stdout.write(`${canonicalJson(result)}\n`);
  }).catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
