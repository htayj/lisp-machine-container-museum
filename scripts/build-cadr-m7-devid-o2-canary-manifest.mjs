#!/usr/bin/env node
/*
 * Materialize the closed manifest for one M7-DEVID canary candidate.  This is
 * a preparation tool, never a runner: it stages only the named base plus the
 * supplied textual patch, builds the declared O2 Wasm there, and writes the
 * manifest as the one candidate file intentionally absent from that patch.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as FS } from "node:fs";
import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  archiveRevision, assertTextualPayloadPatch, canonicalJson, command, identity,
  patchPaths, sourceClosureIdentity,
} from "./run-cadr-m6-devid-o2-canary.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = "cadr-web/oracle/cadr-m7-devid-o2-canary-manifest.json";
const EXECUTION_INPUTS = Object.freeze([
  Object.freeze(["runner", "scripts/run-cadr-m7-devid-o2-canary-stage.mjs"]),
  Object.freeze(["worker", "cadr-web/wasm/cadr-worker.js"]),
  Object.freeze(["headless", "cadr-web/wasm/cadr-m6-headless-boot.mjs"]),
  Object.freeze(["builder", "cadr-web/wasm/build-wasm.sh"]),
]);

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function exactTreeMode(metadata) {
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("manifest payload contains a non-regular file");
  }
  const mode = metadata.mode & 0o777;
  if (mode === 0o644) return "100644";
  if (mode === 0o755) return "100755";
  throw new Error("manifest payload has an unsupported file mode");
}

function parseArgs(argv) {
  const result = { base: null, patch: null, output: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return Object.freeze({ help: true });
    if (!["--receipt-base", "--m7-patch", "--output"].includes(argument) || seen.has(argument)) {
      throw new TypeError(`unsupported or duplicate manifest argument ${JSON.stringify(argument)}`);
    }
    seen.add(argument); const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${argument} needs a nonempty value`);
    if (argument === "--receipt-base") result.base = value;
    else if (argument === "--m7-patch") result.patch = resolve(process.cwd(), value);
    else result.output = resolve(process.cwd(), value);
  }
  if (result.base === null || result.patch === null || result.output === null) {
    throw new TypeError("usage: node scripts/build-cadr-m7-devid-o2-canary-manifest.mjs --receipt-base COMMIT --m7-patch PAYLOAD.patch --output cadr-web/oracle/cadr-m7-devid-o2-canary-manifest.json");
  }
  if (result.output !== resolve(ROOT, MANIFEST)) {
    throw new TypeError(`manifest output must be ${MANIFEST}`);
  }
  return Object.freeze(result);
}

export function createM7ClosedManifest({ baseCommit, baseTree, patchBytes,
  files, inputs, sourceClosure, wasm }) {
  if (!/^[0-9a-f]{40}$/.test(baseCommit) || !/^[0-9a-f]{40}$/.test(baseTree)) {
    throw new TypeError("manifest needs exact Git commit and tree ids");
  }
  return Object.freeze({ schema: "cadr-m7-devid-o2-canary-action-manifest-v2",
    base_commit: baseCommit, base_tree: baseTree, payload_patch_sha256: sha256(patchBytes),
    files: Object.freeze(files), execution: Object.freeze({
      build: Object.freeze({ profile: "m7-devid", optimization: "O2",
        output: "cadr-web/build/cadr-web-m7-devid-O2.wasm", wasm }),
      inputs: Object.freeze(inputs),
      source_closure: Object.freeze({ file_count: sourceClosure.file_count,
        total_byte_count: sourceClosure.total_byte_count, sha256: sourceClosure.sha256 }),
    }) });
}

async function pathRecord(stage, baseCommit, path) {
  const target = resolve(stage, path); const metadata = await lstat(target);
  const mode = exactTreeMode(metadata);
  const postimage = await identity(target);
  const exists = spawnSync("git", ["cat-file", "-e", `${baseCommit}:${path}`], { cwd: ROOT }).status === 0;
  if (!exists) return Object.freeze({ path, action: "add", mode, preimage: null, postimage });
  const base = command("git", ["show", `${baseCommit}:${path}`], { cwd: ROOT, encoding: "buffer" });
  return Object.freeze({ path, action: "modify", mode,
    preimage: Object.freeze({ byte_count: base.byteLength, sha256: sha256(base) }), postimage });
}

async function writeNew(path, value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL |
    (FS.O_NOFOLLOW ?? 0), 0o644);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  return Object.freeze({ byte_count: bytes.byteLength, sha256: sha256(bytes) });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help === true) {
    process.stdout.write("Stages the named base plus one textual M7 patch, builds m7-devid O2, and creates the candidate-only closed manifest. It never launches a canary.\n");
    return;
  }
  const baseCommit = command("git", ["rev-parse", "--verify", `${options.base}^{commit}`], { cwd: ROOT }).trim();
  const baseTree = command("git", ["rev-parse", `${baseCommit}^{tree}`], { cwd: ROOT }).trim();
  const patch = await readFile(options.patch); assertTextualPayloadPatch(patch);
  const paths = patchPaths(patch);
  if (paths.includes(MANIFEST)) throw new Error("M7 payload patch must exclude the candidate-only manifest");
  const stage = await mkdtemp(resolve(tmpdir(), "cadr-m7-manifest-stage-"));
  try {
    await archiveRevision(baseCommit, stage);
    command("git", ["apply", "--check", "--whitespace=error", "-"], { cwd: stage, input: patch });
    command("git", ["apply", "--whitespace=error", "-"], { cwd: stage, input: patch });
    const files = [];
    for (const path of [...paths].sort()) files.push(await pathRecord(stage, baseCommit, path));
    const inputs = [];
    for (const [name, path] of EXECUTION_INPUTS) {
      inputs.push(Object.freeze({ name, path, identity: await identity(resolve(stage, path)) }));
    }
    const closure = await sourceClosureIdentity(stage, baseCommit, paths);
    const wasm = resolve(stage, "cadr-web/build/cadr-web-m7-devid-O2.wasm");
    command("sh", ["wasm/build-wasm.sh", "--m7-devid", "--opt", "O2", wasm], { cwd: resolve(stage, "cadr-web") });
    const manifest = createM7ClosedManifest({ baseCommit, baseTree, patchBytes: patch,
      files, inputs, sourceClosure: closure, wasm: await identity(wasm) });
    const written = await writeNew(options.output, manifest);
    process.stdout.write(`${canonicalJson({ outcome: "manifest-created", receipt_base: baseCommit,
      payload_paths: paths, manifest: written })}\n`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
