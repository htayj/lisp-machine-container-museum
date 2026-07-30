#!/usr/bin/env node
/*
 * Receipt-bound launcher for the unrun M6-DEVID O2 canary.  It materializes
 * only a named Git tree and a selective M6 patch; the live checkout is never
 * copied, imported, or used as a driver source.
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, open, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAGED_DRIVER = "scripts/run-cadr-m6-devid-o2-canary-stage.mjs";
const SYSTEMD_WRAPPER = "scripts/run-cadr-m6-devid-o2-canary-systemd.mjs";
const CLOSED_MANIFEST = "cadr-web/oracle/cadr-m6-devid-o2-canary-manifest.json";
const CONTROL_PLANE = Object.freeze([STAGED_DRIVER, SYSTEMD_WRAPPER,
  "scripts/run-cadr-m6-devid-o2-canary.mjs",
  "tests/test_cadr_m6_devid_o2_canary_runner.mjs"]);
const COMPLETED_GUEST_BOUNDARY = 1_130_000n;
const MAX_WALL_MS = 14_400 * 1000;
const NODE_OLD_SPACE_MIB = 1024;
const MAX_DRIVER_STDOUT_BYTES = 64 * 1024;
const LAUNCHER_PATH = fileURLToPath(import.meta.url);
const usage = "usage: node scripts/run-cadr-m6-devid-o2-canary-systemd.mjs --execute --receipt-base COMMIT1 --candidate-commit COMMIT2 --m6-patch PAYLOAD.patch --artifact-root ROOT --output RECEIPT.json";
const FROZEN_GATE_COMMANDS = Object.freeze([
  Object.freeze(["make", "-B", "-C", "cadr-web", "m3-wasm"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m4-unit"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m4-browser"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m5-unit"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m6-devid-wasm"]),
]);

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

export function parseInvocation(argv) {
  const result = { execute: false, systemdChild: false, receiptBase: null, candidateCommit: null, patch: null, artifactRoot: null, output: null, resultEnvelope: null, stageRoot: null, privateRoot: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return Object.freeze({ help: true });
    if (argument === "--execute") { if (seen.has(argument)) throw new TypeError("--execute was supplied twice"); seen.add(argument); result.execute = true; continue; }
    if (argument === "--systemd-child") { if (seen.has(argument)) throw new TypeError("--systemd-child was supplied twice"); seen.add(argument); result.systemdChild = true; continue; }
    if (!['--receipt-base', '--candidate-commit', '--m6-patch', '--artifact-root', '--output', '--result-envelope', '--stage-root', '--private-root'].includes(argument) || seen.has(argument)) {
      throw new TypeError(`unsupported or duplicate canary argument ${JSON.stringify(argument)}`);
    }
    seen.add(argument); const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${argument} needs a nonempty value`);
    if (argument === "--receipt-base") result.receiptBase = value;
    else if (argument === "--candidate-commit") result.candidateCommit = value;
    else if (argument === "--m6-patch") result.patch = resolve(process.cwd(), value);
    else if (argument === "--artifact-root") result.artifactRoot = resolve(process.cwd(), value);
    else if (argument === "--output") result.output = resolve(process.cwd(), value);
    else if (argument === "--result-envelope") result.resultEnvelope = resolve(process.cwd(), value);
    else if (argument === "--stage-root") result.stageRoot = resolve(process.cwd(), value);
    else result.privateRoot = resolve(process.cwd(), value);
  }
  if (!result.execute || result.receiptBase === null || result.patch === null ||
      result.candidateCommit === null || result.artifactRoot === null ||
      result.output === null) {
    throw new TypeError(`${usage}\nNo M6-DEVID canary is implicit; --execute and every identity-bearing input are required.`);
  }
  const completeInternal = result.resultEnvelope !== null &&
    result.stageRoot !== null && result.privateRoot !== null;
  const anyInternal = result.resultEnvelope !== null ||
    result.stageRoot !== null || result.privateRoot !== null;
  if ((result.systemdChild && !completeInternal) ||
      (!result.systemdChild && anyInternal)) {
    throw new TypeError("supervised child requires its outer-owned envelope and roots");
  }
  return Object.freeze(result);
}

export function command(name, args, options = {}) {
  const stdio = options.stdio ??
    [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"];
  return execFileSync(name, args, { cwd: options.cwd, input: options.input,
    encoding: options.encoding ?? "utf8", stdio });
}

export async function archiveRevision(revision, stage) {
  await new Promise((resolveArchive, rejectArchive) => {
    const archive = spawn("git", ["archive", "--format=tar", revision], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
    const extract = spawn("tar", ["-xf", "-", "-C", stage], { stdio: ["pipe", "inherit", "inherit"] });
    archive.stdout.pipe(extract.stdin);
    let left = null; let right = null; let settled = false;
    const finish = () => { if (!settled && left !== null && right !== null) { settled = true; left === 0 && right === 0 ? resolveArchive() : rejectArchive(new Error(`receipt-base archive failed (git=${left}, tar=${right})`)); } };
    archive.once("error", rejectArchive); extract.once("error", rejectArchive);
    archive.once("exit", code => { left = code ?? 1; finish(); }); extract.once("exit", code => { right = code ?? 1; finish(); });
  });
}

export function patchPaths(patchBytes) {
  const output = command("git", ["apply", "--numstat", "--summary", "-"],
    { cwd: ROOT, input: patchBytes });
  const paths = [];
  for (const line of output.split("\n")) { const match = /^[-0-9]+\t[-0-9]+\t(.+)$/.exec(line); if (match !== null) paths.push(match[1]); }
  if (paths.length === 0) throw new Error("selective M6 patch has no parseable changes");
  return Object.freeze([...new Set(paths)].sort());
}

export function assertTextualPayloadPatch(patchBytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(patchBytes);
  if (/(^|\n)(?:deleted file mode|old mode|new mode|rename from|rename to|copy from|copy to|GIT binary patch|Binary files )/m.test(text)) {
    throw new Error("payload patch contains a delete, rename, copy, mode change, or binary delta");
  }
  for (const line of text.split("\n").filter(item => item.startsWith("diff --git "))) {
    const match = /^diff --git a\/([A-Za-z0-9_./-]+) b\/([A-Za-z0-9_./-]+)$/.exec(line);
    if (match === null || match[1] !== match[2] || match[1].includes("..")) {
      throw new Error("payload patch has a non-modification diff header");
    }
  }
}

export function assertSingleParentLine(line, candidate, base) {
  const ancestry = String(line).trim().split(/\s+/);
  if (ancestry.length !== 2 || ancestry[0] !== candidate ||
      ancestry[1] !== base) {
    throw new Error("candidate must have exactly one parent equal to the receipt base");
  }
}

export function assertSelectiveM6Patch(paths) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("selective M6 patch is empty");
  const immutable = new Set([STAGED_DRIVER, SYSTEMD_WRAPPER,
    "scripts/run-cadr-m6-devid-o2-canary.mjs",
    "tests/test_cadr_m6_devid_o2_canary_runner.mjs"]);
  const controlChanges = paths.filter(path => immutable.has(path));
  if (controlChanges.length !== 0) {
    throw new Error(`selective M6 patch modifies immutable commit1 control plane: ${controlChanges.join(", ")}`);
  }
  const forbidden = /(^|\/)(?:[^/]*m7[^/]*|[^/]*display[^/]*|cadr_machine\.h|cadr_host_api\.h)$/i;
  const blocked = paths.filter(path => forbidden.test(path));
  if (blocked.length !== 0) throw new Error(`M7/display contamination in selective M6 patch: ${blocked.join(", ")}`);
  const allowed = /^(?:\.gitignore|cadr-web\/(?:Makefile|core\/(?:cadr_core\.c|cadr_state\.h|cadr_m6_disk_evidence\.[ch]|usim-port\/(?:bus-adaptor|disk-controller)\.c)|wasm\/(?:build-wasm\.sh|cadr-worker\.js|cadr_wasm_adapter\.[ch]|cadr-m6-headless-boot\.mjs)|tests\/(?:cadr_m6_tail_fixture\.c|test_cadr_m6_[a-z0-9_]+\.c))|docs\/(?:index\.md|mit-cadr\/(?:index\.md|cadr-m6-disk-evidence-continuation-policy\.md|cadr-system-303-headless-listener-boot-oracle-reimplementation-specification\.md|cadr-browser-webassembly-implementation-roadmap\.md))|scripts\/(?:build-cadr-m6-diagnostic-isolated|run-cadr-m6-one-run-diagnostic|run-cadr-m6-devid-(?!o2-canary)[a-z0-9-]+)\.mjs|tests\/test_cadr_m6_(?!devid_o2_canary_runner)[a-z0-9_]+\.mjs)$/;
  const outside = paths.filter(path => !allowed.test(path));
  if (outside.length !== 0) throw new Error(`selective M6 patch changes an unapproved path: ${outside.join(", ")}`);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new Error(`${label} has unexpected keys`);
  }
}

export function validateClosedManifest(manifest, patchPaths_) {
  exactKeys(manifest, ["schema", "base_commit", "base_tree",
    "payload_patch_sha256", "files"], "closed canary manifest");
  if (manifest.schema !== "cadr-m6-devid-o2-canary-action-manifest-v1" ||
      !/^[0-9a-f]{40}$/.test(manifest.base_commit) ||
      !/^[0-9a-f]{40}$/.test(manifest.base_tree) ||
      !/^[0-9a-f]{64}$/.test(manifest.payload_patch_sha256) ||
      !Array.isArray(manifest.files)) throw new Error("closed canary manifest has the wrong schema");
  const expectedPaths = [...patchPaths_].sort();
  const seen = new Set();
  const files = manifest.files.map((record, index) => {
    exactKeys(record, ["path", "action", "mode", "preimage", "postimage"],
      `closed canary manifest file ${index}`);
    exactKeys(record.postimage, ["byte_count", "sha256"],
      `closed canary manifest postimage ${index}`);
    if (record.preimage !== null) {
      exactKeys(record.preimage, ["byte_count", "sha256"],
        `closed canary manifest preimage ${index}`);
    }
    if (typeof record.path !== "string" || seen.has(record.path) ||
        !["add", "modify"].includes(record.action) ||
        !["100644", "100755"].includes(record.mode) ||
        !Number.isSafeInteger(record.postimage.byte_count) ||
        record.postimage.byte_count <= 0 ||
        !/^[0-9a-f]{64}$/.test(record.postimage.sha256) ||
        (record.action === "add" ? record.preimage !== null :
          record.preimage === null ||
          !Number.isSafeInteger(record.preimage.byte_count) ||
          !/^[0-9a-f]{64}$/.test(record.preimage.sha256 ?? ""))) {
      throw new Error("closed canary manifest contains a malformed or duplicate file");
    }
    seen.add(record.path);
    return record;
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (canonicalJson(files.map(record => record.path)) !== canonicalJson(expectedPaths)) {
    throw new Error("closed canary manifest does not exactly cover post-patch executable content");
  }
  return Object.freeze(files);
}

export async function verifyClosedManifest(stage, patchPaths_, manifestBytes,
  patchBytes, identities) {
  const files = validateClosedManifest(JSON.parse(manifestBytes.toString("utf8")), patchPaths_);
  const parsed = JSON.parse(manifestBytes.toString("utf8"));
  if (parsed.payload_patch_sha256 !== sha256(patchBytes) ||
      parsed.base_commit !== identities.baseCommit ||
      parsed.base_tree !== identities.baseTree) {
    throw new Error("action manifest does not bind the supplied patch bytes");
  }
  for (const record of files) {
    const actual = await identity(resolve(stage, record.path));
    if (actual.byte_count !== record.postimage.byte_count ||
        actual.sha256 !== record.postimage.sha256) {
      throw new Error(`post-patch identity differs from closed manifest: ${record.path}`);
    }
    const candidateBytes = command("git", ["show",
      `${identities.candidateCommit}:${record.path}`],
    { cwd: ROOT, encoding: "buffer" });
    if (candidateBytes.byteLength !== record.postimage.byte_count ||
        sha256(candidateBytes) !== record.postimage.sha256) {
      throw new Error(`candidate commit differs from action manifest: ${record.path}`);
    }
    const treeLine = command("git", ["ls-tree", identities.candidateCommit,
      "--", record.path], { cwd: ROOT }).trim();
    if (!treeLine.startsWith(`${record.mode} blob `)) {
      throw new Error(`candidate mode differs from action manifest: ${record.path}`);
    }
    if (record.action === "modify") {
      const baseBytes = command("git", ["show",
        `${identities.baseCommit}:${record.path}`],
      { cwd: ROOT, encoding: "buffer" });
      if (baseBytes.byteLength !== record.preimage.byte_count ||
          sha256(baseBytes) !== record.preimage.sha256) {
        throw new Error(`base preimage differs from action manifest: ${record.path}`);
      }
    } else {
      const exists = spawnSync("git", ["cat-file", "-e",
        `${identities.baseCommit}:${record.path}`], { cwd: ROOT });
      if (exists.status === 0) throw new Error(`manifest add already exists in base: ${record.path}`);
    }
  }
  return Object.freeze({ byte_count: manifestBytes.byteLength,
    sha256: sha256(manifestBytes), files });
}

export async function sourceClosureIdentity(stage, revision, patchPaths_) {
  const tracked = command("git", ["ls-tree", "-r", "--name-only", revision],
    { cwd: ROOT }).trim().split("\n").filter(Boolean);
  const paths = [...new Set([...tracked, ...patchPaths_])].sort();
  const digest = createHash("sha256");
  let totalBytes = 0;
  for (const path of paths) {
    const bytes = await readFile(resolve(stage, path));
    const pathBytes = Buffer.from(path, "utf8");
    const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(pathBytes.byteLength), 0);
    header.writeBigUInt64LE(BigInt(bytes.byteLength), 8);
    digest.update(header).update(pathBytes).update(Buffer.from(sha256(bytes), "hex"));
    totalBytes += bytes.byteLength;
  }
  return Object.freeze({ schema: "cadr-m6-stage-source-closure-v1",
    file_count: paths.length, total_byte_count: totalBytes,
    sha256: digest.digest("hex") });
}

async function verifyCommit1ControlPlane(revision) {
  const records = [];
  for (const path of CONTROL_PLANE) {
    const live = await readFile(resolve(ROOT, path));
    const committed = command("git", ["show", `${revision}:${path}`],
      { cwd: ROOT, encoding: "buffer" });
    if (Buffer.compare(live, committed) !== 0) {
      throw new Error(`live canary control plane differs from commit1: ${path}`);
    }
    records.push(Object.freeze({ path, byte_count: live.byteLength,
      sha256: sha256(live) }));
  }
  return Object.freeze(records);
}

export function assertSystemdSupervision(environment, cgroupText) {
  const unit = environment.M6_DEVID_SYSTEMD_UNIT;
  if (environment.M6_DEVID_SYSTEMD_CHILD !== "1" ||
      !/^[0-9a-f]{32}$/.test(environment.INVOCATION_ID ?? "") ||
      !/^cadr-m6-devid-o2-canary-[0-9a-f]{32}\.service$/.test(unit ?? "") ||
      typeof cgroupText !== "string" || !cgroupText.includes(unit)) {
    throw new Error("live M6-DEVID canary refuses unsupervised execution");
  }
  return Object.freeze({ invocation_id: environment.INVOCATION_ID, unit });
}

function runFrozenGates(stage) {
  return Object.freeze(FROZEN_GATE_COMMANDS.map(commandLine => {
    const result = spawnSync(commandLine[0], commandLine.slice(1), {
      cwd: stage, encoding: "buffer", maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error !== undefined) throw result.error;
    const stdout = result.stdout ?? Buffer.alloc(0);
    const stderr = result.stderr ?? Buffer.alloc(0);
    const record = Object.freeze({ command: commandLine, exit_code: result.status,
      signal: result.signal, stdout: Object.freeze({ byte_count: stdout.byteLength, sha256: sha256(stdout) }),
      stderr: Object.freeze({ byte_count: stderr.byteLength, sha256: sha256(stderr) }) });
    if (result.status !== 0 || result.signal !== null) {
      throw Object.assign(new Error(`frozen staged gate failed: ${commandLine.join(" ")}`), { gate: record });
    }
    return record;
  }));
}

export async function identity(path) { const bytes = await readFile(path); return Object.freeze({ byte_count: bytes.byteLength, sha256: sha256(bytes) }); }
async function stagedIdentities(stage, wasmPath) {
  const paths = Object.freeze({ driver: resolve(stage, STAGED_DRIVER), worker: resolve(stage, "cadr-web/wasm/cadr-worker.js"),
    headless: resolve(stage, "cadr-web/wasm/cadr-m6-headless-boot.mjs"), builder: resolve(stage, "cadr-web/wasm/build-wasm.sh"), wasm: wasmPath });
  const result = {}; for (const [name, path] of Object.entries(paths)) result[name] = await identity(path);
  return Object.freeze(result);
}

export function runSupervisedChild({ script, args, cwd, wallMs = MAX_WALL_MS,
  stdoutLimit = MAX_DRIVER_STDOUT_BYTES }) {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    const chunks = []; let total = 0; let timedOut = false; let oversized = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, wallMs);
    child.stdout.on("data", chunk => { total += chunk.byteLength; if (total > stdoutLimit && !oversized) { oversized = true; child.kill("SIGKILL"); } else if (!oversized) chunks.push(chunk); });
    child.once("error", error => { clearTimeout(timer); rejectResult(error); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return rejectResult(new Error(`canary exceeded supervised ${wallMs}ms wall limit`));
      if (oversized) return rejectResult(new Error(`staged canary exceeded ${stdoutLimit}-byte stdout limit`));
      if (signal !== null || code !== 0) return rejectResult(new Error(`staged canary failed (code=${code}, signal=${signal})`));
      resolveResult(Buffer.concat(chunks));
    });
  });
}

async function runSupervisedDriver(stage, options, wasmPath) {
  const output = await runSupervisedChild({ script: resolve(stage, STAGED_DRIVER), cwd: stage,
    args: [`--max-old-space-size=${NODE_OLD_SPACE_MIB}`, resolve(stage, STAGED_DRIVER),
      "--artifact-root", options.artifactRoot, "--wasm", wasmPath,
      "--private-root", options.privateRoot,
      "--completed-boundary", COMPLETED_GUEST_BOUNDARY.toString()] });
  try { return JSON.parse(output.toString("utf8")); } catch (error) { throw new Error(`staged canary emitted non-JSON evidence: ${error.message}`); }
}

export function validateDriverResult(result) {
  if (result?.schema !== "cadr-m6-devid-o2-canary-stage-v1" || result.completed_guest_boundary !== COMPLETED_GUEST_BOUNDARY.toString() || result.nonterminal !== true ||
      result.machine?.clock_slots_completed !== COMPLETED_GUEST_BOUNDARY.toString() ||
      result.machine?.outstanding_request_id !== "0" ||
      result.machine?.lifecycle !== 2 || result.machine?.persistentStatus !== 0 ||
      result.private_disk?.fresh !== true || !/^[0-9a-f]{64}$/.test(result.private_disk?.base_sha256 ?? "") ||
      typeof result.private_disk?.instance_id !== "string" || result.private_disk.instance_id.length === 0 ||
      result.private_disk?.overlay_kind !== "fresh-in-memory-m4-block-one-overlay" ||
      result.private_disk?.overlay_initial_generation !== "0" ||
      !/^[0-9]+$/.test(result.private_disk?.overlay_final_generation ?? "") ||
      result.private_disk?.base_write_authority !== false ||
      !Number.isSafeInteger(result.exact_loop?.batches) || result.exact_loop.batches <= 0 ||
      !Number.isSafeInteger(result.exact_loop?.host_transactions) ||
      result.exact_loop.host_transactions < 0 ||
      result.frozen_input_schedule?.events_due_through_target !== 0 ||
      !/^[1-9][0-9]*$/.test(result.frozen_input_schedule?.first_due_boundary ?? "") ||
      BigInt(result.frozen_input_schedule.first_due_boundary) <=
        COMPLETED_GUEST_BOUNDARY ||
      !/^[1-9][0-9]*$/.test(result.m6_disk_evidence?.accepted_events ?? "") || BigInt(result.m6_disk_evidence.accepted_events) <= 512n ||
      BigInt(result.m6_disk_evidence?.tail_events ?? "-1") !== BigInt(result.m6_disk_evidence.accepted_events) - 512n ||
      !/^[0-9a-f]{64}$/.test(result.m6_disk_evidence?.sha256 ?? "") || !Array.isArray(result.artifacts_before) ||
      canonicalJson(result.artifacts_before) !== canonicalJson(result.artifacts_after) ||
      !Array.isArray(result.private_artifacts_before) ||
      canonicalJson(result.private_artifacts_before) !==
        canonicalJson(result.private_artifacts_after) ||
      result.base_disk_unchanged !== true ||
      !result.artifacts_before.some(item => item?.kind === 3 && /^[0-9a-f]{64}$/.test(item.sha256 ?? ""))) {
    throw new Error("staged canary did not prove an exact nonterminal guest boundary and >512 M6 tail");
  }
  return result;
}

export function boundedCanaryFailure(error) {
  const text = String(error?.message ?? error);
  const reason = /gate/.test(text) ? "frozen-gate-failed" :
    /manifest|patch|candidate|control plane|source closure/.test(text) ?
      "candidate-identity-failed" :
    /timeout|wall limit/.test(text) ? "child-time-limit" :
    /stdout limit|non-JSON|staged canary/.test(text) ? "stage-protocol-failed" :
    "canary-execution-failed";
  return Object.freeze({ reason,
    diagnostic_sha256: sha256(Buffer.from(
      `${error?.name ?? "Error"}\0${text}`, "utf8")) });
}

async function syncFile(path) { const handle = await open(path, "r"); try { await handle.sync(); } finally { await handle.close(); } }
export async function requirePrivateReceiptDirectory(path) {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
      metadata.uid !== process.geteuid() || (metadata.mode & 0o777) !== 0o700) {
    throw new Error("canary receipt directory must preexist, be euid-owned, nonsymlink, and mode 0700");
  }
}
export async function writeCanonicalNoReplaceReceipt(path, value) {
  const directory = dirname(path); const temporary = resolve(directory, `.${randomUUID()}.cadr-m6-devid-canary.tmp`); const bytes = new TextEncoder().encode(canonicalJson(value));
  await requirePrivateReceiptDirectory(directory); let linked = false;
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 }); await syncFile(temporary); await link(temporary, path); linked = true; await unlink(temporary); await syncFile(directory);
    return Object.freeze({ byte_count: bytes.byteLength, sha256: sha256(bytes) });
  } catch (error) {
    if (linked) { try { await unlink(path); await syncFile(directory); } catch (cleanup) { throw new AggregateError([error, cleanup], "canary receipt rollback failed"); } }
    throw error;
  } finally { await unlink(temporary).catch(() => undefined); }
}

export async function removeCanaryStage(path) {
  await rm(path, { recursive: true, force: true });
}

export function minimalFailureEnvelope(error) {
  return Object.freeze({
    schema: "cadr-m6-devid-o2-canary-result-envelope-v1",
    outcome: "canary-failed",
    receipt: Object.freeze({
      schema: "cadr-m6-devid-o2-canary-failure-v1",
      outer_cleanup_required: true,
      failure: boundedCanaryFailure(error),
    }),
  });
}

export async function publishFailureEnvelopeIfAbsent(path, error) {
  try {
    await lstat(path);
    return false;
  } catch (inspection) {
    if (inspection?.code !== "ENOENT") throw inspection;
  }
  await writeCanonicalNoReplaceReceipt(path, minimalFailureEnvelope(error));
  return true;
}

async function runCanary(options) {
  const supervision = assertSystemdSupervision(process.env,
    await readFile("/proc/self/cgroup", "utf8"));
  await requirePrivateReceiptDirectory(dirname(options.output));
  const revision = command("git", ["rev-parse", "--verify", `${options.receiptBase}^{commit}`], { cwd: ROOT }).trim();
  const candidateCommit = command("git", ["rev-parse", "--verify",
    `${options.candidateCommit}^{commit}`], { cwd: ROOT }).trim();
  assertSingleParentLine(command("git", ["rev-list", "--parents", "-n", "1",
    candidateCommit], { cwd: ROOT }), candidateCommit, revision);
  const baseTree = command("git", ["rev-parse", `${revision}^{tree}`], { cwd: ROOT }).trim();
  const candidateTree = command("git", ["rev-parse", `${candidateCommit}^{tree}`], { cwd: ROOT }).trim();
  const manifestBytes = command("git", ["show", `${candidateCommit}:${CLOSED_MANIFEST}`],
    { cwd: ROOT, encoding: "buffer" });
  const patch = await readFile(options.patch); assertTextualPayloadPatch(patch);
  const paths = patchPaths(patch); assertSelectiveM6Patch(paths);
  const commitPaths = command("git", ["diff", "--name-only", revision,
    candidateCommit], { cwd: ROOT }).trim().split("\n").filter(Boolean).sort();
  if (canonicalJson(commitPaths) !==
      canonicalJson([...paths, CLOSED_MANIFEST].sort())) {
    throw new Error("candidate commit differs from payload patch plus fixed manifest");
  }
  const manifestIdentities = Object.freeze({ baseCommit: revision, baseTree,
    candidateCommit, candidateTree });
  const controlPlane = await verifyCommit1ControlPlane(revision);
  const stage = options.stageRoot;
  const stageMetadata = await lstat(stage);
  if (!stageMetadata.isDirectory() || stageMetadata.isSymbolicLink() ||
      stageMetadata.uid !== process.geteuid() ||
      (stageMetadata.mode & 0o777) !== 0o700 ||
      (await readdir(stage)).length !== 0) {
    throw new Error("outer-owned stage root is invalid");
  }
  const wasmPath = resolve(stage, "cadr-web/build/cadr-web-m6-devid-O2.wasm");
  const launcherAtStart = await identity(LAUNCHER_PATH);
  const toolchain = Object.freeze({ node: process.version, guix_channels: command("guix", ["describe", "-f", "channels"], { cwd: ROOT }).trim() });
  let checked; let before = null; let after = null;
  let closedManifest = null; let frozenGates = null;
  let sourceClosure = null;
  try {
    await archiveRevision(revision, stage);
    command("git", ["apply", "--check", "--whitespace=error", "-"],
      { cwd: stage, input: patch });
    command("git", ["apply", "--whitespace=error", "-"],
      { cwd: stage, input: patch });
    closedManifest = await verifyClosedManifest(stage, paths, manifestBytes,
      patch, manifestIdentities);
    sourceClosure = await sourceClosureIdentity(stage, revision, paths);
    frozenGates = runFrozenGates(stage);
    if (canonicalJson(closedManifest) !==
        canonicalJson(await verifyClosedManifest(stage, paths, manifestBytes,
          patch, manifestIdentities))) {
      throw new Error("closed post-patch content changed during frozen gates");
    }
    if (canonicalJson(sourceClosure) !==
        canonicalJson(await sourceClosureIdentity(stage, revision, paths))) {
      throw new Error("staged source closure changed during frozen gates");
    }
    command("sh", ["wasm/build-wasm.sh", "--m6-devid", "--opt", "O2", wasmPath], {
      cwd: resolve(stage, "cadr-web"),
    });
    before = await stagedIdentities(stage, wasmPath); checked = validateDriverResult(await runSupervisedDriver(stage, options, wasmPath)); after = await stagedIdentities(stage, wasmPath);
    if (canonicalJson(before) !== canonicalJson(after)) throw new Error("staged build identities changed during canary execution");
    if (canonicalJson(closedManifest) !==
        canonicalJson(await verifyClosedManifest(stage, paths, manifestBytes,
          patch, manifestIdentities))) {
      throw new Error("closed post-patch content changed during O2 build or canary");
    }
    if (canonicalJson(sourceClosure) !==
        canonicalJson(await sourceClosureIdentity(stage, revision, paths))) {
      throw new Error("staged source closure changed during O2 build or canary");
    }
    const launcherAtEnd = await identity(LAUNCHER_PATH);
    if (canonicalJson(launcherAtStart) !== canonicalJson(launcherAtEnd)) throw new Error("outer canary launcher changed during execution");
    const receipt = Object.freeze({ schema: "cadr-m6-devid-o2-canary-receipt-v1", receipt_bound_base: revision,
      candidate_commit: candidateCommit, base_tree: baseTree,
      candidate_tree: candidateTree,
      patch: Object.freeze({ paths, sha256: sha256(patch) }), policy_id: "M6-PREFIX512-TAILSHA256-v1", optimization: "O2",
      completed_guest_boundary: COMPLETED_GUEST_BOUNDARY.toString(),
      supervision: Object.freeze({ ...supervision, node_old_space_mib: NODE_OLD_SPACE_MIB,
        wall_limit_ms: MAX_WALL_MS, stdout_limit_bytes: MAX_DRIVER_STDOUT_BYTES,
        cpu_accounting: true, memory_accounting: true, tasks_accounting: true }),
      closed_post_patch_manifest: closedManifest,
      commit1_control_plane: controlPlane,
      staged_source_closure: sourceClosure, frozen_stage_gates: frozenGates,
      outer_launcher_at_start: launcherAtStart, outer_launcher_at_end: launcherAtEnd, toolchain,
      staged_artifacts_before: before, staged_artifacts_after: after,
      outer_cleanup_required: true, canary: checked });
    const written = await writeCanonicalNoReplaceReceipt(options.resultEnvelope,
      Object.freeze({ schema: "cadr-m6-devid-o2-canary-result-envelope-v1",
        outcome: "canary-complete", receipt }));
    process.stdout.write(`${canonicalJson(Object.freeze({ outcome: "canary-child-complete",
      envelope: written }))}\n`);
  } catch (error) {
    const launcherAtEnd = await identity(LAUNCHER_PATH);
    const failure = Object.freeze({ schema: "cadr-m6-devid-o2-canary-failure-v1", receipt_bound_base: revision,
      candidate_commit: candidateCommit, base_tree: baseTree,
      candidate_tree: candidateTree,
      patch: Object.freeze({ paths, sha256: sha256(patch) }),
      outer_cleanup_required: true, failure: boundedCanaryFailure(error),
      outer_launcher_at_start: launcherAtStart, outer_launcher_at_end: launcherAtEnd, toolchain,
      closed_post_patch_manifest: closedManifest,
      commit1_control_plane: controlPlane,
      staged_source_closure: sourceClosure, frozen_stage_gates: frozenGates,
      staged_artifacts_before: before, staged_artifacts_after: after });
    try { await writeCanonicalNoReplaceReceipt(options.resultEnvelope,
      Object.freeze({ schema: "cadr-m6-devid-o2-canary-result-envelope-v1",
        outcome: "canary-failed", receipt: failure })); }
    catch (publication) { throw new AggregateError([error, publication], "canary failed and its private failure receipt was not published"); }
    throw error;
  }
}

async function main() {
  const options = parseInvocation(process.argv.slice(2));
  if (options.help === true) {
    process.stdout.write(`${usage}\nStages only the receipt-bound base and selective M6 patch. It supervises a tracked staged driver at 1,130,000 completed guest boundaries, with a 1 GiB Node heap cap and a 4-hour wall limit. Without --execute it never runs.\n`); return;
  }
  try {
    await runCanary(options);
  } catch (error) {
    try {
      await publishFailureEnvelopeIfAbsent(options.resultEnvelope, error);
    } catch (publication) {
      throw new AggregateError([error, publication],
        "canary failed and its private failure envelope was not published");
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
