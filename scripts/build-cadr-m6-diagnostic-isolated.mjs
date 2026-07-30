#!/usr/bin/env node
/* Build the one-run cause witness from an explicitly named commit, never from
 * the mutable index or worktree. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIAGNOSTIC_DELTA_PATHS = Object.freeze([
  "cadr-web/oracle/patches/0004-m6-postterminal-diagnostic.patch",
  "cadr-web/oracle/patches/0005-m6-receipt-bound-diagnostic.patch",
]);
const FROZEN_M6_POSTTERMINAL_DIAGNOSTIC_SHA256 =
  "35d690d33a4ee815f476b7893c31276f50f7f34c90709fb61aca65b418d5d2fd";
export const CADR_M6_DIAGNOSTIC_RECEIPT_BASE =
  "de0aab1ec913a0587cf7a6e24b93353d1f16dc12";
const TMP_ROOT = "/tmp";

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

function receiptBoundFile(revision, path) {
  try {
    return execFileSync("git", ["show", `${revision}:${path}`], {
      cwd: ROOT,
      encoding: "buffer",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`M6 receipt base does not own ${path}`, { cause: error });
  }
}

function resolveReceiptBoundBase(revision) {
  let resolved;
  try {
    resolved = run("git", ["rev-parse", "--verify", `${revision}^{commit}`]).trim();
  } catch (error) {
    throw new Error("M6 diagnostic receipt base does not resolve to a commit", { cause: error });
  }
  if (resolved !== revision) {
    throw new Error("M6 diagnostic receipt base did not resolve to the supplied full commit");
  }
  return resolved;
}

function receiptBoundDiagnosticDeltas(revision) {
  const deltas = DIAGNOSTIC_DELTA_PATHS.map(path => {
    const bytes = receiptBoundFile(revision, path);
    return Object.freeze({ path, sha256: sha256(bytes), bytes });
  });
  if (deltas[0].sha256 !== FROZEN_M6_POSTTERMINAL_DIAGNOSTIC_SHA256) {
    throw new Error("M6 receipt base changed the frozen 0004 diagnostic delta");
  }
  return Object.freeze(deltas);
}

function revalidateReceiptBoundDiagnosticDeltas(build) {
  if (typeof build?.receipt_bound_base !== "string" ||
      !/^[0-9a-f]{40}$/.test(build.receipt_bound_base) ||
      !Array.isArray(build.diagnostic_deltas) ||
      build.diagnostic_deltas.length !== DIAGNOSTIC_DELTA_PATHS.length) {
    throw new TypeError("isolated M6 diagnostic build has no receipt-bound delta identities");
  }
  const resolvedBase = resolveReceiptBoundBase(build.receipt_bound_base);
  if (run("git", ["rev-parse", `${resolvedBase}^{tree}`]).trim() !==
        build.staged_tree_git_object) {
    throw new Error("isolated M6 diagnostic receipt base no longer resolves to its staged tree");
  }
  const expected = receiptBoundDiagnosticDeltas(resolvedBase);
  for (let index = 0; index < expected.length; index += 1) {
    const actual = build.diagnostic_deltas[index];
    if (actual === null || typeof actual !== "object" || Array.isArray(actual) ||
        Object.keys(actual).sort().join(",") !== "path,sha256" ||
        actual.path !== expected[index].path || actual.sha256 !== expected[index].sha256) {
      throw new Error("isolated M6 diagnostic delta identities changed after build");
    }
  }
  return expected;
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
  if (build?.schema !== "cadr-m6-isolated-diagnostic-build-v3") {
    throw new TypeError("not an isolated M6 diagnostic build record");
  }
  revalidateReceiptBoundDiagnosticDeltas(build);
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

export async function buildM6DiagnosticIsolated({ receiptBase } = {}) {
  if (typeof receiptBase !== "string" || !/^[0-9a-f]{40}$/.test(receiptBase)) {
    throw new TypeError("M6 diagnostic build requires --receipt-base as a full commit");
  }
  const resolvedBase = resolveReceiptBoundBase(receiptBase);
  const [builderBytes, launcherBytes] = await Promise.all([
    readFile(fileURLToPath(import.meta.url)),
    readFile(resolve(ROOT, "scripts/run-cadr-m6-one-run-diagnostic.mjs")),
  ]);
  const stagedTree = run("git", ["rev-parse", `${resolvedBase}^{tree}`]).trim();
  const diagnosticDeltas = receiptBoundDiagnosticDeltas(resolvedBase);
  const stage = await mkdtemp(`${TMP_ROOT}/cadr-m6-diagnostic-`);
  try {
    const archive = execFileSync("git", ["archive", "--format=tar", resolvedBase], {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: 512 * 1024 * 1024,
    });
    execFileSync("tar", ["-xf", "-", "-C", stage], { input: archive });
    for (const delta of diagnosticDeltas) applyM6DiagnosticDelta(stage, delta.bytes);
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
      diagnostic_deltas: Object.freeze(diagnosticDeltas.map(delta => Object.freeze({
        path: delta.path, sha256: delta.sha256,
      }))),
      schema: "cadr-m6-isolated-diagnostic-build-v3",
      receipt_bound_base: resolvedBase,
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
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--receipt-base") {
    process.stderr.write("usage: node scripts/build-cadr-m6-diagnostic-isolated.mjs --receipt-base FULL-COMMIT\n");
    process.exitCode = 1;
  } else buildM6DiagnosticIsolated({ receiptBase: args[1] }).then(result => {
    process.stdout.write(`${canonicalJson(result)}\n`);
  }).catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
