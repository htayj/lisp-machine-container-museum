#!/usr/bin/env node
/*
 * Receipt-bound outer launcher for the M7 display + M6-DEVID P4 canary.
 * Its only executable guest driver is copied from a named Git tree; this
 * mutable checkout supplies only the separately verified outer control plane.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  archiveRevision, assertSingleParentLine, assertTextualPayloadPatch,
  boundedCanaryFailure, canonicalJson, command, identity, patchPaths,
  requirePrivateReceiptDirectory, runSupervisedChild, sourceClosureIdentity,
  writeCanonicalNoReplaceReceipt,
} from "./run-cadr-m6-devid-o2-canary.mjs";
import {
  runSystemdCanary, validateEffectiveSystemdPolicy, validateSystemdSuccess,
} from "./run-cadr-m6-devid-o2-canary-systemd.mjs";
import {
  validateM7DevidCanaryStageReceipt,
} from "./run-cadr-m7-devid-o2-canary-stage.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STAGED_RUNNER = "scripts/run-cadr-m7-devid-o2-canary-stage.mjs";
const M6_STAGE = "scripts/run-cadr-m6-devid-o2-canary-stage.mjs";
const CLOSED_MANIFEST = "cadr-web/oracle/cadr-m7-devid-o2-canary-manifest.json";
const CONTROL_PLANE = Object.freeze([
  "scripts/run-cadr-m6-devid-o2-canary.mjs",
  "scripts/run-cadr-m6-devid-o2-canary-systemd.mjs",
  M6_STAGE, STAGED_RUNNER,
  "scripts/run-cadr-m7-devid-o2-canary.mjs",
  "scripts/build-cadr-m7-devid-o2-canary-manifest.mjs",
  "scripts/run-cadr-m7-frame-conformance.mjs",
  "tests/test_cadr_m7_devid_o2_canary.mjs",
]);
const BOUNDARY = 1_130_000n;
const NODE_OLD_SPACE_MIB = 1024;
const MAX_WALL_MS = 14_400_000;
const MAX_DRIVER_STDOUT_BYTES = 64 * 1024;
const LAUNCHER_PATH = fileURLToPath(import.meta.url);
const usage = "usage: node scripts/run-cadr-m7-devid-o2-canary.mjs --execute --receipt-base COMMIT1 --candidate-commit COMMIT2 --m7-patch PAYLOAD.patch --artifact-root ROOT --output RECEIPT.json";
const FROZEN_GATE_COMMANDS = Object.freeze([
  Object.freeze(["make", "-B", "-C", "cadr-web", "m3-wasm"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m4-unit"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m4-browser"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m5-unit"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m6-devid-wasm"]),
  Object.freeze(["make", "-B", "-C", "cadr-web", "m7-unit"]),
]);

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new Error(`${label} has unexpected keys`);
  }
}
function isHash(value) { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }
function equal(left, right) { return canonicalJson(left) === canonicalJson(right); }

export function boundedM7GateStream(bytes, redactions) {
  const tailLimit = 2048;
  const startByte = Math.max(0, bytes.byteLength - tailLimit);
  let text = null;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(startByte));
    const controls = [...text].filter(character => {
      const code = character.codePointAt(0);
      return (code < 0x20 && !["\n", "\r", "\t"].includes(character)) ||
        code === 0x7f;
    }).length;
    if (controls !== 0) text = null;
  } catch {
    text = null;
  }
  if (text !== null) {
    for (const [source, replacement] of redactions) {
      if (typeof source === "string" && source.length > 0) {
        text = text.split(source).join(replacement);
      }
    }
  }
  return Object.freeze({
    byte_count: bytes.byteLength, sha256: sha256(bytes),
    tail: text === null ? null : Object.freeze({
      start_byte: startByte, text,
    }),
  });
}

function gateRecord(line, result, elapsedNs, redactions) {
  return Object.freeze({
    command: line, elapsed_ns: elapsedNs.toString(),
    exit_code: result.status, signal: result.signal,
    spawn_error_code: result.error?.code ?? null,
    stdout: boundedM7GateStream(result.stdout ?? Buffer.alloc(0), redactions),
    stderr: boundedM7GateStream(result.stderr ?? Buffer.alloc(0), redactions),
  });
}

export function parseM7Invocation(argv) {
  const result = { execute: false, systemdChild: false, receiptBase: null,
    candidateCommit: null, patch: null, artifactRoot: null, output: null,
    resultEnvelope: null, stageRoot: null, privateRoot: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return Object.freeze({ help: true });
    if (argument === "--execute" || argument === "--systemd-child") {
      if (seen.has(argument)) throw new TypeError(`${argument} was supplied twice`);
      seen.add(argument); result[argument === "--execute" ? "execute" : "systemdChild"] = true; continue;
    }
    if (!["--receipt-base", "--candidate-commit", "--m7-patch", "--artifact-root",
      "--output", "--result-envelope", "--stage-root", "--private-root"].includes(argument) ||
        seen.has(argument)) throw new TypeError(`unsupported or duplicate M7 canary argument ${JSON.stringify(argument)}`);
    seen.add(argument); const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${argument} needs a nonempty value`);
    if (argument === "--receipt-base") result.receiptBase = value;
    else if (argument === "--candidate-commit") result.candidateCommit = value;
    else if (argument === "--m7-patch") result.patch = resolve(process.cwd(), value);
    else if (argument === "--artifact-root") result.artifactRoot = resolve(process.cwd(), value);
    else if (argument === "--output") result.output = resolve(process.cwd(), value);
    else if (argument === "--result-envelope") result.resultEnvelope = resolve(process.cwd(), value);
    else if (argument === "--stage-root") result.stageRoot = resolve(process.cwd(), value);
    else result.privateRoot = resolve(process.cwd(), value);
  }
  if (!result.execute || result.receiptBase === null || result.candidateCommit === null ||
      result.patch === null || result.artifactRoot === null || result.output === null) {
    throw new TypeError(`${usage}\nNo M7-DEVID canary is implicit; --execute and every identity-bearing input are required.`);
  }
  const completeInternal = result.resultEnvelope !== null && result.stageRoot !== null && result.privateRoot !== null;
  const anyInternal = result.resultEnvelope !== null || result.stageRoot !== null || result.privateRoot !== null;
  if ((result.systemdChild && !completeInternal) || (!result.systemdChild && anyInternal)) {
    throw new TypeError("supervised M7 child requires its outer-owned envelope and roots");
  }
  return Object.freeze(result);
}

export function assertSelectiveM7Patch(paths) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("selective M7 patch is empty");
  const allowed = /^(?:cadr-web\/(?:Makefile|core\/(?:cadr_(?:core|state(?:_v[2345])?|display|m6_(?:disk_evidence|fast_run))\.[ch]|usim-port\/(?:bus-adaptor|disk-controller)\.c)|wasm\/(?:build-wasm\.sh|cadr-worker\.js|cadr-m6-headless-boot\.mjs|cadr-m4-block-service\.mjs|cadr_wasm_(?:adapter|runtime)\.[ch])|tests\/test_cadr_m[67]_[a-z0-9_]+\.c)|docs\/mit-cadr\/cadr-browser-webassembly-implementation-roadmap\.md|scripts\/(?:cadr-m7-p4-authority-root|run-cadr-m6-devid-o2-canary(?:-stage|-systemd)?|run-cadr-m7-devid-o2-canary(?:-stage)?|run-cadr-m7-frame-conformance|build-cadr-m7-devid-o2-canary-manifest)\.mjs|tests\/test_cadr_m[67]_[a-z0-9_]+\.mjs)$/;
  const outside = paths.filter(path => !allowed.test(path));
  if (outside.length !== 0) throw new Error(`selective M7 patch changes an unapproved path: ${outside.join(", ")}`);
}

function identityShape(value, label) {
  exactKeys(value, ["byte_count", "sha256"], label);
  if (!Number.isSafeInteger(value.byte_count) || value.byte_count < 1 || !isHash(value.sha256)) {
    throw new Error(`${label} identity is malformed`);
  }
  return value;
}

export function validateM7ClosedManifest(manifest, expectedPatchPaths) {
  exactKeys(manifest, ["base_commit", "base_tree", "execution", "files",
    "payload_patch_sha256", "schema"], "closed M7 canary manifest");
  if (manifest.schema !== "cadr-m7-devid-o2-canary-action-manifest-v2" ||
      !/^[0-9a-f]{40}$/.test(manifest.base_commit) ||
      !/^[0-9a-f]{40}$/.test(manifest.base_tree) || !isHash(manifest.payload_patch_sha256) ||
      !Array.isArray(manifest.files)) throw new Error("closed M7 canary manifest has the wrong schema");
  const paths = []; const files = manifest.files.map((record, index) => {
    exactKeys(record, ["action", "mode", "path", "postimage", "preimage"], `closed M7 manifest file ${index}`);
    exactKeys(record.postimage, ["byte_count", "sha256"], `closed M7 postimage ${index}`);
    if (record.preimage !== null) exactKeys(record.preimage, ["byte_count", "sha256"], `closed M7 preimage ${index}`);
    if (typeof record.path !== "string" || paths.includes(record.path) ||
        !["add", "modify"].includes(record.action) || !["100644", "100755"].includes(record.mode) ||
        !Number.isSafeInteger(record.postimage.byte_count) || record.postimage.byte_count < 1 ||
        !isHash(record.postimage.sha256) ||
        (record.action === "add" ? record.preimage !== null :
          record.preimage === null || !Number.isSafeInteger(record.preimage.byte_count) ||
          record.preimage.byte_count < 1 || !isHash(record.preimage.sha256))) {
      throw new Error("closed M7 canary manifest contains a malformed file identity");
    }
    paths.push(record.path); return record;
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (!equal(paths.sort(), [...expectedPatchPaths].sort())) throw new Error("closed M7 manifest does not exactly cover the payload patch");
  exactKeys(manifest.execution, ["build", "inputs", "source_closure"], "closed M7 execution identity");
  exactKeys(manifest.execution.build, ["optimization", "output", "profile", "wasm"], "closed M7 build identity");
  const build = manifest.execution.build;
  if (build.profile !== "m7-devid" || build.optimization !== "O2" ||
      build.output !== "cadr-web/build/cadr-web-m7-devid-O2.wasm") throw new Error("closed M7 manifest names the wrong build");
  identityShape(build.wasm, "closed M7 Wasm");
  if (!Array.isArray(manifest.execution.inputs) || manifest.execution.inputs.length !== 4) throw new Error("closed M7 manifest needs four execution inputs");
  const required = new Map([["runner", STAGED_RUNNER], ["worker", "cadr-web/wasm/cadr-worker.js"],
    ["headless", "cadr-web/wasm/cadr-m6-headless-boot.mjs"], ["builder", "cadr-web/wasm/build-wasm.sh"]]);
  for (const record of manifest.execution.inputs) {
    exactKeys(record, ["identity", "name", "path"], "closed M7 execution input");
    if (required.get(record.name) !== record.path) throw new Error("closed M7 manifest names an unexpected execution input");
    identityShape(record.identity, `closed M7 ${record.name}`); required.delete(record.name);
  }
  if (required.size !== 0) throw new Error("closed M7 manifest omits an execution input");
  exactKeys(manifest.execution.source_closure, ["file_count", "sha256", "total_byte_count"], "closed M7 source closure");
  const closure = manifest.execution.source_closure;
  if (!Number.isSafeInteger(closure.file_count) || closure.file_count < 1 ||
      !Number.isSafeInteger(closure.total_byte_count) || closure.total_byte_count < 1 || !isHash(closure.sha256)) {
    throw new Error("closed M7 source closure is malformed");
  }
  return Object.freeze({ files: Object.freeze(files), execution: manifest.execution });
}

async function verifyM7Manifest(stage, paths, bytes, patch, identities) {
  const manifest = JSON.parse(bytes.toString("utf8"));
  const parsed = validateM7ClosedManifest(manifest, paths);
  if (manifest.base_commit !== identities.baseCommit || manifest.base_tree !== identities.baseTree ||
      manifest.payload_patch_sha256 !== sha256(patch)) throw new Error("closed M7 manifest does not bind the supplied tree and patch");
  for (const record of parsed.files) {
    const actual = await identity(resolve(stage, record.path));
    if (!equal(actual, record.postimage)) throw new Error(`staged M7 postimage differs from manifest: ${record.path}`);
    const candidate = command("git", ["show", `${identities.candidateCommit}:${record.path}`], { cwd: ROOT, encoding: "buffer" });
    if (!equal({ byte_count: candidate.byteLength, sha256: sha256(candidate) }, record.postimage)) throw new Error(`candidate M7 postimage differs from manifest: ${record.path}`);
    const treeLine = command("git", ["ls-tree", identities.candidateCommit, "--", record.path], { cwd: ROOT }).trim();
    if (!treeLine.startsWith(`${record.mode} blob `)) throw new Error(`candidate M7 mode differs from manifest: ${record.path}`);
    if (record.action === "modify") {
      const base = command("git", ["show", `${identities.baseCommit}:${record.path}`], { cwd: ROOT, encoding: "buffer" });
      if (!equal({ byte_count: base.byteLength, sha256: sha256(base) }, record.preimage)) throw new Error(`base M7 preimage differs from manifest: ${record.path}`);
    } else if (spawnSync("git", ["cat-file", "-e", `${identities.baseCommit}:${record.path}`], { cwd: ROOT }).status === 0) {
      throw new Error(`M7 manifest add already exists in base: ${record.path}`);
    }
  }
  for (const input of parsed.execution.inputs) {
    const actual = await identity(resolve(stage, input.path));
    if (!equal(actual, input.identity)) throw new Error(`staged M7 execution input differs from manifest: ${input.name}`);
    const candidate = command("git", ["show", `${identities.candidateCommit}:${input.path}`], { cwd: ROOT, encoding: "buffer" });
    if (!equal({ byte_count: candidate.byteLength, sha256: sha256(candidate) }, input.identity)) throw new Error(`candidate M7 execution input differs from manifest: ${input.name}`);
  }
  return Object.freeze({ parsed, bytes: Object.freeze({ byte_count: bytes.byteLength, sha256: sha256(bytes) }) });
}

async function verifyControlPlane(revision) {
  const records = [];
  for (const path of CONTROL_PLANE) {
    const live = await readFile(resolve(ROOT, path));
    const committed = command("git", ["show", `${revision}:${path}`], { cwd: ROOT, encoding: "buffer" });
    if (Buffer.compare(live, committed) !== 0) throw new Error(`live M7 canary control plane differs from the candidate commit: ${path}`);
    records.push(Object.freeze({ path, ...(await identity(resolve(ROOT, path))) }));
  }
  return Object.freeze(records);
}

function runFrozenGates(stage, redactions) {
  const records = [];
  for (const line of FROZEN_GATE_COMMANDS) {
    const started = process.hrtime.bigint();
    const result = spawnSync(line[0], line.slice(1), { cwd: stage, encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    const record = gateRecord(line, result, process.hrtime.bigint() - started,
      redactions);
    if (record.exit_code !== 0 || record.signal !== null ||
        record.spawn_error_code !== null) {
      throw Object.assign(
        new Error(`frozen staged M7 gate failed: ${line.join(" ")}`),
        { gate: record, completedGates: Object.freeze([...records]) },
      );
    }
    records.push(record);
  }
  return Object.freeze(records);
}

async function stagedIdentities(stage, wasmPath) {
  const paths = Object.freeze({ runner: resolve(stage, STAGED_RUNNER), worker: resolve(stage, "cadr-web/wasm/cadr-worker.js"),
    headless: resolve(stage, "cadr-web/wasm/cadr-m6-headless-boot.mjs"), builder: resolve(stage, "cadr-web/wasm/build-wasm.sh"), wasm: wasmPath });
  const records = {};
  for (const [name, path] of Object.entries(paths)) records[name] = await identity(path);
  return Object.freeze(records);
}

async function currentToolchainIdentity() {
  const executables = [];
  for (const name of ["make", "guix", "cc", "ar", "nm", "python3"]) {
    const path = command("which", [name], { cwd: ROOT }).trim();
    const version = spawnSync(path, ["--version"], {
      cwd: ROOT, encoding: "buffer", maxBuffer: 1024 * 1024,
    });
    if (version.error !== undefined || version.status !== 0 ||
        version.signal !== null) {
      throw new Error(`could not identify M7 gate executable ${name}`);
    }
    const versionBytes = Buffer.concat([
      version.stdout ?? Buffer.alloc(0), version.stderr ?? Buffer.alloc(0),
    ]);
    executables.push(Object.freeze({
      name, path_sha256: sha256(Buffer.from(path, "utf8")),
      executable: await identity(path),
      version: Object.freeze({
        byte_count: versionBytes.byteLength, sha256: sha256(versionBytes),
      }),
    }));
  }
  const environmentNames = Object.freeze([
    "AR", "CC", "GUIX_LOCPATH", "HOME", "LANG", "LC_ALL", "MAKEFLAGS",
    "MFLAGS", "NM", "NODE_OPTIONS", "PATH", "TMPDIR", "TZ",
    "XDG_CACHE_HOME",
  ]);
  const environment = Object.fromEntries(environmentNames.map(name =>
    [name, process.env[name] ?? null]));
  return Object.freeze({
    node_version: process.version,
    node_executable: await identity(process.execPath),
    guix_channels: command("guix", ["describe", "-f", "channels"],
      { cwd: ROOT }).trim(),
    gate_environment: Object.freeze({
      names: environmentNames,
      sha256: sha256(Buffer.from(canonicalJson(environment), "utf8")),
    }),
    gate_executables: Object.freeze(executables),
  });
}

const FROZEN_ARTIFACTS = Object.freeze([
  Object.freeze({ kind: 1, id: "cadr-web-303-runnable-template", path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, id: "prom-control-store", path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, id: "prom-symbols", path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, id: "microcode-symbols", path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, id: "system-303-0-base-disk", path: "l/usim/disk-sys-303-0.img" }),
]);

async function frozenReleaseIdentity(stage) {
  const [releaseBytes, profileBytes] = await Promise.all([
    readFile(resolve(stage, "cadr-web/oracle/cadr-m6-release-record.json")),
    readFile(resolve(stage, "cadr-web/profiles/cadr-web-303.json")),
  ]);
  const release = JSON.parse(releaseBytes); const profile = JSON.parse(profileBytes);
  const byKind = new Map(release.artifacts?.map(record => [record.kind, record]));
  const byId = new Map(profile.artifacts?.map(record => [record.id, record]));
  const artifacts = FROZEN_ARTIFACTS.map(source => {
    const releaseRecord = byKind.get(source.kind); const profileRecord = byId.get(source.id);
    if (!/^[1-9][0-9]*$/.test(releaseRecord?.byte_count ?? "") || !isHash(releaseRecord?.sha256) ||
        String(profileRecord?.bytes) !== releaseRecord.byte_count || profileRecord?.sha256 !== releaseRecord.sha256) {
      throw new Error(`five-artifact frozen release identity disagrees at kind ${source.kind}`);
    }
    return Object.freeze({ kind: source.kind, path: source.path, byte_count: releaseRecord.byte_count, sha256: releaseRecord.sha256 });
  });
  return Object.freeze({ release_record: Object.freeze({ byte_count: releaseBytes.byteLength, sha256: sha256(releaseBytes) }),
    profile: Object.freeze({ byte_count: profileBytes.byteLength, sha256: sha256(profileBytes) }), artifacts: Object.freeze(artifacts) });
}

const M7_CHILD_RECEIPT_KEYS = Object.freeze([
  "base_tree", "build", "canary", "candidate_commit", "candidate_tree",
    "candidate_control_plane", "closed_post_patch_manifest", "completed_guest_boundary",
    "frozen_release", "frozen_stage_gates", "optimization", "outer_cleanup_required",
    "outer_launcher_at_end", "outer_launcher_at_start", "patch", "policy_id",
    "receipt_bound_base", "schema", "staged_artifacts_after", "staged_artifacts_before",
    "staged_source_closure", "supervision", "toolchain_at_end",
    "toolchain_at_start",
]);

function validateIdentity(value, label, { allowEmpty = false } = {}) {
  exactKeys(value, ["byte_count", "sha256"], label);
  if (!Number.isSafeInteger(value.byte_count) ||
      value.byte_count < (allowEmpty ? 0 : 1) ||
      !isHash(value.sha256)) {
    throw new Error(`${label} is malformed`);
  }
}

function validateStagedIdentities(value) {
  exactKeys(value, ["builder", "headless", "runner", "wasm", "worker"],
    "M7 staged identities");
  for (const [name, record] of Object.entries(value)) {
    validateIdentity(record, `M7 staged ${name}`);
  }
}

export function validateM7DevidCanaryChildReceipt(value) {
  exactKeys(value, M7_CHILD_RECEIPT_KEYS, "M7-DEVID child receipt");
  if (value.schema !== "cadr-m7-devid-o2-canary-receipt-v1" || value.optimization !== "O2" ||
      value.completed_guest_boundary !== BOUNDARY.toString() || value.outer_cleanup_required !== true ||
      value.build?.profile !== "m7-devid" ||
      value.build?.optimization !== "O2" ||
      value.build?.protocol_version !== 5 ||
      value.build?.run_operation !== "run-digest-batch-m5" ||
      !/^[0-9a-f]{40}$/.test(value.receipt_bound_base) ||
      !/^[0-9a-f]{40}$/.test(value.candidate_commit) ||
      !/^[0-9a-f]{40}$/.test(value.base_tree) ||
      !/^[0-9a-f]{40}$/.test(value.candidate_tree) ||
      value.receipt_bound_base === value.candidate_commit ||
      value.base_tree === value.candidate_tree ||
      value.policy_id !== "M6-PREFIX512-TAILSHA256-v1") {
    throw new Error("M7-DEVID receipt has the wrong closed profile identity");
  }
  exactKeys(value.patch, ["paths", "sha256"], "M7 payload patch");
  if (!Array.isArray(value.patch.paths) || value.patch.paths.length === 0 ||
      new Set(value.patch.paths).size !== value.patch.paths.length ||
      !isHash(value.patch.sha256)) {
    throw new Error("M7 payload patch binding is malformed");
  }
  assertSelectiveM7Patch(value.patch.paths);
  exactKeys(value.build, ["optimization", "output", "profile",
    "protocol_version", "run_operation", "wasm"], "M7 build");
  if (value.build.output !==
      "cadr-web/build/cadr-web-m7-devid-O2.wasm") {
    throw new Error("M7 build output identity is wrong");
  }
  validateIdentity(value.build.wasm, "M7 build Wasm");
  exactKeys(value.closed_post_patch_manifest, ["byte_count", "path", "sha256"],
    "M7 closed manifest receipt binding");
  if (value.closed_post_patch_manifest.path !== CLOSED_MANIFEST ||
      !Number.isSafeInteger(value.closed_post_patch_manifest.byte_count) ||
      value.closed_post_patch_manifest.byte_count < 1 ||
      !isHash(value.closed_post_patch_manifest.sha256)) {
    throw new Error("M7-DEVID receipt has an invalid closed manifest binding");
  }
  exactKeys(value.supervision, ["cpu_accounting", "invocation_id",
    "memory_accounting", "node_old_space_mib", "stdout_limit_bytes",
    "tasks_accounting", "unit", "wall_limit_ms"], "M7 supervision");
  if (!/^[0-9a-f]{32}$/.test(value.supervision.invocation_id) ||
      !/^cadr-m7-devid-o2-canary-[0-9a-f]{32}\.service$/.test(
        value.supervision.unit) ||
      value.supervision.node_old_space_mib !== NODE_OLD_SPACE_MIB ||
      value.supervision.wall_limit_ms !== MAX_WALL_MS ||
      value.supervision.stdout_limit_bytes !== MAX_DRIVER_STDOUT_BYTES ||
      value.supervision.cpu_accounting !== true ||
      value.supervision.memory_accounting !== true ||
      value.supervision.tasks_accounting !== true) {
    throw new Error("M7 supervision binding is malformed");
  }
  if (!Array.isArray(value.candidate_control_plane) ||
      value.candidate_control_plane.length !== CONTROL_PLANE.length) {
    throw new Error("M7 candidate control plane is incomplete");
  }
  for (let index = 0; index < CONTROL_PLANE.length; index += 1) {
    const record = value.candidate_control_plane[index];
    exactKeys(record, ["byte_count", "path", "sha256"],
      `M7 control-plane record ${index}`);
    if (record.path !== CONTROL_PLANE[index]) {
      throw new Error("M7 candidate control-plane order or path is wrong");
    }
    validateIdentity({ byte_count: record.byte_count, sha256: record.sha256 },
      `M7 control-plane identity ${index}`);
  }
  exactKeys(value.staged_source_closure, ["file_count", "schema", "sha256",
    "total_byte_count"], "M7 staged source closure");
  if (value.staged_source_closure.schema !==
        "cadr-m6-stage-source-closure-v1" ||
      !Number.isSafeInteger(value.staged_source_closure.file_count) ||
      value.staged_source_closure.file_count < 1 ||
      !Number.isSafeInteger(value.staged_source_closure.total_byte_count) ||
      value.staged_source_closure.total_byte_count < 1 ||
      !isHash(value.staged_source_closure.sha256)) {
    throw new Error("M7 staged source closure is malformed");
  }
  if (!Array.isArray(value.frozen_stage_gates) ||
      value.frozen_stage_gates.length !== FROZEN_GATE_COMMANDS.length) {
    throw new Error("M7 frozen stage gates are incomplete");
  }
  for (let index = 0; index < FROZEN_GATE_COMMANDS.length; index += 1) {
    const gate = value.frozen_stage_gates[index];
    exactKeys(gate, ["command", "elapsed_ns", "exit_code", "signal",
      "spawn_error_code", "stderr", "stdout"],
      `M7 frozen gate ${index}`);
    if (!equal(gate.command, FROZEN_GATE_COMMANDS[index]) ||
        gate.exit_code !== 0 || gate.signal !== null ||
        gate.spawn_error_code !== null ||
        !/^[1-9][0-9]*$/.test(gate.elapsed_ns)) {
      throw new Error("M7 frozen stage gate did not pass exactly");
    }
    for (const [name, stream] of [["stdout", gate.stdout],
      ["stderr", gate.stderr]]) {
      exactKeys(stream, ["byte_count", "sha256", "tail"],
        `M7 frozen gate ${index} ${name}`);
      validateIdentity({ byte_count: stream.byte_count, sha256: stream.sha256 },
        `M7 frozen gate ${index} ${name}`, { allowEmpty: true });
      if (stream.tail !== null) {
        exactKeys(stream.tail, ["start_byte", "text"],
          `M7 frozen gate ${index} ${name} tail`);
        if (!Number.isSafeInteger(stream.tail.start_byte) ||
            stream.tail.start_byte < 0 ||
            typeof stream.tail.text !== "string" ||
            Buffer.byteLength(stream.tail.text, "utf8") > 4096) {
          throw new Error("M7 frozen gate tail is malformed");
        }
      }
    }
  }
  for (const [when, toolchain] of [["start", value.toolchain_at_start],
    ["end", value.toolchain_at_end]]) {
    exactKeys(toolchain, ["gate_environment", "gate_executables",
      "guix_channels", "node_executable", "node_version"],
    `M7 toolchain at ${when}`);
    if (typeof toolchain.node_version !== "string" ||
        !/^v[0-9]+\./.test(toolchain.node_version) ||
        typeof toolchain.guix_channels !== "string" ||
        toolchain.guix_channels.length === 0) {
      throw new Error(`M7 toolchain identity at ${when} is malformed`);
    }
    validateIdentity(toolchain.node_executable,
      `M7 Node executable at ${when}`);
    exactKeys(toolchain.gate_environment, ["names", "sha256"],
      `M7 gate environment at ${when}`);
    if (!equal(toolchain.gate_environment.names,
      ["AR", "CC", "GUIX_LOCPATH", "HOME", "LANG", "LC_ALL", "MAKEFLAGS",
        "MFLAGS", "NM", "NODE_OPTIONS", "PATH", "TMPDIR", "TZ",
        "XDG_CACHE_HOME"]) ||
        !isHash(toolchain.gate_environment.sha256) ||
        !Array.isArray(toolchain.gate_executables) ||
        toolchain.gate_executables.length !== 6) {
      throw new Error(`M7 gate environment or executable set at ${when} is malformed`);
    }
    for (const [index, name] of
      ["make", "guix", "cc", "ar", "nm", "python3"].entries()) {
      const executable = toolchain.gate_executables[index];
      exactKeys(executable, ["executable", "name", "path_sha256", "version"],
        `M7 gate executable ${name} at ${when}`);
      if (executable.name !== name || !isHash(executable.path_sha256)) {
        throw new Error(`M7 gate executable ${name} at ${when} is malformed`);
      }
      validateIdentity(executable.executable,
        `M7 gate executable ${name} bytes at ${when}`);
      validateIdentity(executable.version,
        `M7 gate executable ${name} version at ${when}`,
        { allowEmpty: true });
    }
  }
  if (!equal(value.toolchain_at_start, value.toolchain_at_end)) {
    throw new Error("M7 toolchain changed during execution");
  }
  validateIdentity(value.outer_launcher_at_start,
    "M7 outer launcher at start");
  validateIdentity(value.outer_launcher_at_end, "M7 outer launcher at end");
  if (!equal(value.outer_launcher_at_start, value.outer_launcher_at_end)) {
    throw new Error("M7 outer launcher changed during execution");
  }
  validateStagedIdentities(value.staged_artifacts_before);
  validateStagedIdentities(value.staged_artifacts_after);
  validateM7DevidCanaryStageReceipt(value.canary);
  exactKeys(value.frozen_release, ["artifacts", "profile", "release_record"],
    "M7 frozen release");
  validateIdentity(value.frozen_release.profile, "M7 frozen profile");
  validateIdentity(value.frozen_release.release_record,
    "M7 frozen release record");
  if (!Array.isArray(value.frozen_release?.artifacts) || value.frozen_release.artifacts.length !== 5 ||
      !equal(value.canary?.artifacts_before, value.frozen_release.artifacts) ||
      !equal(value.canary?.artifacts_after, value.frozen_release.artifacts) ||
      !equal(value.canary?.private_artifacts_before, value.frozen_release.artifacts) ||
      !equal(value.canary?.private_artifacts_after, value.frozen_release.artifacts) ||
      value.canary?.transport?.protocol_version !== 5 ||
      value.canary?.transport?.run_operation !== "run-digest-batch-m5" ||
      value.canary?.display?.wire_schema !== "CDRDISP1" ||
      value.canary?.snapshot?.operation !== "snapshot-size" || value.canary?.snapshot?.status !== 9 ||
      !equal(value.canary?.wasm, value.staged_artifacts_before?.wasm) ||
      !equal(value.build.wasm, value.staged_artifacts_before?.wasm) ||
      !equal(value.staged_artifacts_before, value.staged_artifacts_after)) {
    throw new Error("M7-DEVID receipt does not bind P4 execution and its frozen identities");
  }
  return value;
}

export function validateM7DevidCanaryReceipt(value) {
  exactKeys(value, [...M7_CHILD_RECEIPT_KEYS, "outer_roots_removed",
    "systemd_accounting", "unit_cleanup_verified"], "M7-DEVID final receipt");
  const child = Object.fromEntries(M7_CHILD_RECEIPT_KEYS.map(
    key => [key, value[key]]));
  validateM7DevidCanaryChildReceipt(child);
  validateEffectiveSystemdPolicy(value.systemd_accounting);
  validateSystemdSuccess(value.systemd_accounting, value.systemd_accounting);
  if (value.unit_cleanup_verified !== true ||
      value.outer_roots_removed !== true) {
    throw new Error("M7-DEVID final receipt lacks verified outer cleanup");
  }
  return value;
}

export function sourceClosureFromGit(base, candidate, patchPaths_) {
  const tracked = command("git", ["ls-tree", "-r", "--name-only", base],
    { cwd: ROOT }).trim().split("\n").filter(Boolean);
  const paths = [...new Set([...tracked, ...patchPaths_])].sort();
  const patched = new Set(patchPaths_);
  const digest = createHash("sha256");
  let totalBytes = 0;
  for (const path of paths) {
    /* The staged tree is precisely the base tree overlaid with the textual
     * payload patch.  A candidate commit is allowed to add only the fixed
     * closed manifest alongside that payload; its manifest bytes therefore
     * MUST NOT enter the staged-source closure.  Read candidate bytes only
     * for a patched path, and base bytes for every other tracked path. */
    const revision = patched.has(path) ? candidate : base;
    const bytes = command("git", ["show", `${revision}:${path}`],
      { cwd: ROOT, encoding: "buffer" });
    const pathBytes = Buffer.from(path, "utf8");
    const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(pathBytes.byteLength), 0);
    header.writeBigUInt64LE(BigInt(bytes.byteLength), 8);
    digest.update(header).update(pathBytes).update(
      Buffer.from(sha256(bytes), "hex"));
    totalBytes += bytes.byteLength;
  }
  return Object.freeze({ schema: "cadr-m6-stage-source-closure-v1",
    file_count: paths.length, total_byte_count: totalBytes,
    sha256: digest.digest("hex") });
}

function frozenReleaseFromGit(candidate) {
  const releaseBytes = command("git", ["show",
    `${candidate}:cadr-web/oracle/cadr-m6-release-record.json`],
  { cwd: ROOT, encoding: "buffer" });
  const profileBytes = command("git", ["show",
    `${candidate}:cadr-web/profiles/cadr-web-303.json`],
  { cwd: ROOT, encoding: "buffer" });
  const release = JSON.parse(releaseBytes.toString("utf8"));
  const profile = JSON.parse(profileBytes.toString("utf8"));
  const byKind = new Map(release.artifacts?.map(record =>
    [record.kind, record]));
  const byId = new Map(profile.artifacts?.map(record => [record.id, record]));
  const artifacts = FROZEN_ARTIFACTS.map(source => {
    const releaseRecord = byKind.get(source.kind);
    const profileRecord = byId.get(source.id);
    if (!/^[1-9][0-9]*$/.test(releaseRecord?.byte_count ?? "") ||
        !isHash(releaseRecord?.sha256) ||
        String(profileRecord?.bytes) !== releaseRecord.byte_count ||
        profileRecord?.sha256 !== releaseRecord.sha256) {
      throw new Error(`candidate frozen release disagrees at kind ${source.kind}`);
    }
    return Object.freeze({ kind: source.kind, path: source.path,
      byte_count: releaseRecord.byte_count, sha256: releaseRecord.sha256 });
  });
  return Object.freeze({
    release_record: Object.freeze({ byte_count: releaseBytes.byteLength,
      sha256: sha256(releaseBytes) }),
    profile: Object.freeze({ byte_count: profileBytes.byteLength,
      sha256: sha256(profileBytes) }),
    artifacts: Object.freeze(artifacts),
  });
}

export function verifyM7DevidCanaryReceipt(value) {
  validateM7DevidCanaryReceipt(value);
  const base = command("git", ["rev-parse", "--verify",
    `${value.receipt_bound_base}^{commit}`], { cwd: ROOT }).trim();
  const candidate = command("git", ["rev-parse", "--verify",
    `${value.candidate_commit}^{commit}`], { cwd: ROOT }).trim();
  assertSingleParentLine(command("git", ["rev-list", "--parents", "-n", "1",
    candidate], { cwd: ROOT }), candidate, base);
  if (command("git", ["rev-parse", `${base}^{tree}`],
        { cwd: ROOT }).trim() !== value.base_tree ||
      command("git", ["rev-parse", `${candidate}^{tree}`],
        { cwd: ROOT }).trim() !== value.candidate_tree) {
    throw new Error("M7 final receipt Git tree identities are wrong");
  }
  const changed = command("git", ["diff", "--name-only", base, candidate],
    { cwd: ROOT }).trim().split("\n").filter(Boolean).sort();
  if (!equal(changed, [...value.patch.paths, CLOSED_MANIFEST].sort())) {
    throw new Error("M7 final receipt candidate path set is wrong");
  }
  const patch = command("git", ["diff", "--no-ext-diff", "--no-renames",
    base, candidate, "--", ...value.patch.paths],
  { cwd: ROOT, encoding: "buffer" });
  assertTextualPayloadPatch(patch);
  if (sha256(patch) !== value.patch.sha256) {
    throw new Error("M7 final receipt payload patch hash is wrong");
  }
  const manifestBytes = command("git", ["show", `${candidate}:${CLOSED_MANIFEST}`],
    { cwd: ROOT, encoding: "buffer" });
  if (!equal({ byte_count: manifestBytes.byteLength, sha256: sha256(manifestBytes) },
      { byte_count: value.closed_post_patch_manifest.byte_count,
        sha256: value.closed_post_patch_manifest.sha256 })) {
    throw new Error("M7 final receipt closed manifest identity is wrong");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const parsed = validateM7ClosedManifest(manifest, value.patch.paths);
  if (manifest.base_commit !== base || manifest.base_tree !== value.base_tree ||
      manifest.payload_patch_sha256 !== value.patch.sha256 ||
      !equal(parsed.execution.source_closure, {
        file_count: value.staged_source_closure.file_count,
        total_byte_count: value.staged_source_closure.total_byte_count,
        sha256: value.staged_source_closure.sha256,
      }) ||
      !equal(parsed.execution.build.wasm, value.build.wasm)) {
    throw new Error("M7 final receipt disagrees with its closed manifest");
  }
  for (const record of parsed.files) {
    const candidateBytes = command("git", ["show",
      `${candidate}:${record.path}`], { cwd: ROOT, encoding: "buffer" });
    if (!equal({ byte_count: candidateBytes.byteLength,
      sha256: sha256(candidateBytes) }, record.postimage)) {
      throw new Error(`M7 candidate postimage is wrong at ${record.path}`);
    }
    const treeLine = command("git", ["ls-tree", candidate, "--", record.path],
      { cwd: ROOT }).trim();
    if (!treeLine.startsWith(`${record.mode} blob `)) {
      throw new Error(`M7 candidate mode is wrong at ${record.path}`);
    }
    if (record.action === "modify") {
      const baseBytes = command("git", ["show", `${base}:${record.path}`],
        { cwd: ROOT, encoding: "buffer" });
      if (!equal({ byte_count: baseBytes.byteLength, sha256: sha256(baseBytes) },
          record.preimage)) {
        throw new Error(`M7 base preimage is wrong at ${record.path}`);
      }
    } else if (spawnSync("git", ["cat-file", "-e",
      `${base}:${record.path}`], { cwd: ROOT }).status === 0) {
      throw new Error(`M7 manifest addition exists in base at ${record.path}`);
    }
  }
  if (!equal(sourceClosureFromGit(base, candidate, value.patch.paths),
      value.staged_source_closure)) {
    throw new Error("M7 final receipt source closure is wrong");
  }
  const stagedByName = new Map(Object.entries(value.staged_artifacts_before));
  for (const input of parsed.execution.inputs) {
    const candidateBytes = command("git", ["show", `${candidate}:${input.path}`],
      { cwd: ROOT, encoding: "buffer" });
    if (!equal(input.identity, stagedByName.get(input.name)) ||
        !equal(input.identity, { byte_count: candidateBytes.byteLength,
          sha256: sha256(candidateBytes) })) {
      throw new Error(`M7 final receipt staged ${input.name} identity is wrong`);
    }
  }
  for (let index = 0; index < CONTROL_PLANE.length; index += 1) {
    const path = CONTROL_PLANE[index];
    const bytes = command("git", ["show", `${candidate}:${path}`],
      { cwd: ROOT, encoding: "buffer" });
    const expected = value.candidate_control_plane[index];
    if (!equal({ path, byte_count: bytes.byteLength, sha256: sha256(bytes) },
        expected)) {
      throw new Error(`M7 final receipt candidate control plane differs at ${path}`);
    }
  }
  if (!equal(frozenReleaseFromGit(candidate), value.frozen_release)) {
    throw new Error("M7 final receipt frozen release is wrong");
  }
  return value;
}

function assertM7SystemdSupervision(environment, cgroupText) {
  const unit = environment.M7_DEVID_SYSTEMD_UNIT;
  if (environment.M7_DEVID_SYSTEMD_CHILD !== "1" || !/^[0-9a-f]{32}$/.test(environment.INVOCATION_ID ?? "") ||
      !/^cadr-m7-devid-o2-canary-[0-9a-f]{32}\.service$/.test(unit ?? "") ||
      typeof cgroupText !== "string" || !cgroupText.includes(unit)) {
    throw new Error("live M7-DEVID canary refuses unsupervised execution");
  }
  return Object.freeze({ invocation_id: environment.INVOCATION_ID, unit });
}

async function runStagedM7Driver(stage, options, wasmPath) {
  const stdout = await runSupervisedChild({ cwd: stage, wallMs: MAX_WALL_MS,
    stdoutLimit: MAX_DRIVER_STDOUT_BYTES, args: [`--max-old-space-size=${NODE_OLD_SPACE_MIB}`,
      resolve(stage, STAGED_RUNNER), "--artifact-root", options.artifactRoot,
      "--wasm", wasmPath, "--private-root", options.privateRoot,
      "--completed-boundary", BOUNDARY.toString()] });
  try { return JSON.parse(stdout.toString("utf8")); }
  catch (error) { throw new Error(`staged M7 canary emitted non-JSON evidence: ${error.message}`); }
}

async function runM7Child(options) {
  const supervision = assertM7SystemdSupervision(process.env, await readFile("/proc/self/cgroup", "utf8"));
  await requirePrivateReceiptDirectory(dirname(options.output));
  const revision = command("git", ["rev-parse", "--verify", `${options.receiptBase}^{commit}`], { cwd: ROOT }).trim();
  const candidateCommit = command("git", ["rev-parse", "--verify", `${options.candidateCommit}^{commit}`], { cwd: ROOT }).trim();
  assertSingleParentLine(command("git", ["rev-list", "--parents", "-n", "1", candidateCommit], { cwd: ROOT }), candidateCommit, revision);
  const baseTree = command("git", ["rev-parse", `${revision}^{tree}`], { cwd: ROOT }).trim();
  const candidateTree = command("git", ["rev-parse", `${candidateCommit}^{tree}`], { cwd: ROOT }).trim();
  const manifestBytes = command("git", ["show", `${candidateCommit}:${CLOSED_MANIFEST}`], { cwd: ROOT, encoding: "buffer" });
  const patch = await readFile(options.patch); assertTextualPayloadPatch(patch);
  const paths = patchPaths(patch); assertSelectiveM7Patch(paths);
  const commitPaths = command("git", ["diff", "--name-only", revision, candidateCommit], { cwd: ROOT }).trim().split("\n").filter(Boolean).sort();
  if (!equal(commitPaths, [...paths, CLOSED_MANIFEST].sort())) throw new Error("M7 candidate differs from payload patch plus fixed manifest");
  const controlPlane = await verifyControlPlane(candidateCommit);
  const stageMetadata = await lstat(options.stageRoot);
  if (!stageMetadata.isDirectory() || stageMetadata.isSymbolicLink() || stageMetadata.uid !== process.geteuid() ||
      (stageMetadata.mode & 0o777) !== 0o700 || (await readdir(options.stageRoot)).length !== 0) {
    throw new Error("outer-owned M7 stage root is invalid");
  }
  const launcherAtStart = await identity(LAUNCHER_PATH);
  const toolchainAtStart = await currentToolchainIdentity();
  const identities = Object.freeze({ baseCommit: revision, baseTree, candidateCommit, candidateTree });
  let verifiedManifest = null; let sourceClosure = null; let gates = null; let frozenRelease = null; let before = null; let after = null;
  try {
    await archiveRevision(revision, options.stageRoot);
    command("git", ["apply", "--check", "--whitespace=error", "-"], { cwd: options.stageRoot, input: patch });
    command("git", ["apply", "--whitespace=error", "-"], { cwd: options.stageRoot, input: patch });
    verifiedManifest = await verifyM7Manifest(options.stageRoot, paths, manifestBytes, patch, identities);
    sourceClosure = await sourceClosureIdentity(options.stageRoot, revision, paths);
    if (!equal(sourceClosure, { schema: "cadr-m6-stage-source-closure-v1", ...verifiedManifest.parsed.execution.source_closure })) {
      throw new Error("closed M7 manifest source closure differs from staged tree");
    }
    frozenRelease = await frozenReleaseIdentity(options.stageRoot);
    gates = runFrozenGates(options.stageRoot, Object.freeze([
      Object.freeze([options.stageRoot, "<STAGE>"]),
      Object.freeze([options.privateRoot, "<PRIVATE>"]),
      Object.freeze([options.artifactRoot, "<ARTIFACT_ROOT>"]),
      Object.freeze([ROOT, "<REPOSITORY>"]),
      Object.freeze([process.env.HOME, "<HOME>"]),
    ]));
    if (!equal((await verifyM7Manifest(options.stageRoot, paths, manifestBytes, patch, identities)).parsed, verifiedManifest.parsed) ||
        !equal(await sourceClosureIdentity(options.stageRoot, revision, paths), sourceClosure)) throw new Error("staged M7 sources changed during frozen gates");
    const wasmPath = resolve(options.stageRoot, "cadr-web/build/cadr-web-m7-devid-O2.wasm");
    command("sh", ["wasm/build-wasm.sh", "--m7-devid", "--opt", "O2", wasmPath], { cwd: resolve(options.stageRoot, "cadr-web") });
    before = await stagedIdentities(options.stageRoot, wasmPath);
    if (!equal(before.wasm, verifiedManifest.parsed.execution.build.wasm)) throw new Error("staged M7 Wasm differs from closed build identity");
    const canary = await runStagedM7Driver(options.stageRoot, options, wasmPath);
    after = await stagedIdentities(options.stageRoot, wasmPath);
    if (!equal(before, after)) throw new Error("M7 runner, worker, headless, builder, or Wasm changed during canary execution");
    if (!equal(canary.artifacts_before, frozenRelease.artifacts) || !equal(canary.artifacts_after, frozenRelease.artifacts) ||
        !equal(canary.private_artifacts_before, frozenRelease.artifacts) || !equal(canary.private_artifacts_after, frozenRelease.artifacts) ||
        canary.transport?.protocol_version !== 5 || canary.transport?.run_operation !== "run-digest-batch-m5" ||
        canary.display?.wire_schema !== "CDRDISP1" || canary.snapshot?.status !== 9 || !equal(canary.wasm, before.wasm)) {
      throw new Error("staged M7 result does not bind P4 execution to frozen release and Wasm identities");
    }
    if (!equal((await verifyM7Manifest(options.stageRoot, paths, manifestBytes, patch, identities)).parsed, verifiedManifest.parsed) ||
        !equal(await sourceClosureIdentity(options.stageRoot, revision, paths), sourceClosure)) throw new Error("staged M7 sources changed during build or canary");
    const launcherAtEnd = await identity(LAUNCHER_PATH);
    if (!equal(launcherAtStart, launcherAtEnd)) throw new Error("outer M7 canary launcher changed during execution");
    const toolchainAtEnd = await currentToolchainIdentity();
    if (!equal(toolchainAtStart, toolchainAtEnd)) {
      throw new Error("M7 toolchain changed during execution");
    }
    const receipt = Object.freeze({ schema: "cadr-m7-devid-o2-canary-receipt-v1", receipt_bound_base: revision,
      candidate_commit: candidateCommit, base_tree: baseTree, candidate_tree: candidateTree,
      patch: Object.freeze({ paths, sha256: sha256(patch) }), policy_id: "M6-PREFIX512-TAILSHA256-v1",
      optimization: "O2", completed_guest_boundary: BOUNDARY.toString(),
      build: Object.freeze({ profile: "m7-devid", optimization: "O2", protocol_version: 5,
        run_operation: "run-digest-batch-m5", output: "cadr-web/build/cadr-web-m7-devid-O2.wasm", wasm: before.wasm }),
      supervision: Object.freeze({ ...supervision, node_old_space_mib: NODE_OLD_SPACE_MIB,
        wall_limit_ms: MAX_WALL_MS, stdout_limit_bytes: MAX_DRIVER_STDOUT_BYTES,
        cpu_accounting: true, memory_accounting: true, tasks_accounting: true }),
      closed_post_patch_manifest: Object.freeze({ path: CLOSED_MANIFEST,
        ...verifiedManifest.bytes }), candidate_control_plane: controlPlane,
      staged_source_closure: sourceClosure, frozen_stage_gates: gates, frozen_release: frozenRelease,
      outer_launcher_at_start: launcherAtStart, outer_launcher_at_end: launcherAtEnd,
      toolchain_at_start: toolchainAtStart, toolchain_at_end: toolchainAtEnd,
      staged_artifacts_before: before, staged_artifacts_after: after,
      outer_cleanup_required: true, canary });
    validateM7DevidCanaryChildReceipt(receipt);
    const written = await writeCanonicalNoReplaceReceipt(options.resultEnvelope, Object.freeze({
      schema: "cadr-m7-devid-o2-canary-result-envelope-v1", outcome: "canary-complete", receipt }));
    process.stdout.write(`${canonicalJson({ outcome: "canary-child-complete", envelope: written })}\n`);
  } catch (error) {
    const launcherAtEnd = await identity(LAUNCHER_PATH);
    const toolchainAtEnd = await currentToolchainIdentity();
    const boundedFailure = error?.gate === undefined ?
      boundedCanaryFailure(error) : Object.freeze({
        reason: "frozen-gate-failed",
        diagnostic_sha256: sha256(Buffer.from(canonicalJson(Object.freeze({
          completed_stage_gates: error.completedGates,
          failed_stage_gate: error.gate,
        })), "utf8")),
      });
    const failure = Object.freeze({ schema: "cadr-m7-devid-o2-canary-failure-v1", receipt_bound_base: revision,
      candidate_commit: candidateCommit, base_tree: baseTree, candidate_tree: candidateTree,
      patch: Object.freeze({ paths, sha256: sha256(patch) }), outer_cleanup_required: true,
      failure: boundedFailure, outer_launcher_at_start: launcherAtStart,
      outer_launcher_at_end: launcherAtEnd,
      toolchain_at_start: toolchainAtStart, toolchain_at_end: toolchainAtEnd,
      closed_post_patch_manifest: verifiedManifest?.bytes ?? null,
      candidate_control_plane: controlPlane, staged_source_closure: sourceClosure,
      frozen_stage_gates: gates ?? error?.completedGates ?? null,
      failed_stage_gate: error?.gate ?? null, frozen_release: frozenRelease,
      staged_artifacts_before: before, staged_artifacts_after: after });
    await writeCanonicalNoReplaceReceipt(options.resultEnvelope, Object.freeze({
      schema: "cadr-m7-devid-o2-canary-result-envelope-v1", outcome: "canary-failed", receipt: failure }));
    throw error;
  }
}

async function main() {
  const options = parseM7Invocation(process.argv.slice(2));
  if (options.help === true) {
    process.stdout.write(`${usage}\nStages only a named Git base plus a closed selective M7 patch, builds the M7-DEVID O2 profile, and uses protocol-v5 run-digest-batch-m5 through 1,130,000 completed guest boundaries. Without --execute it never runs.\n`);
  } else if (options.systemdChild) {
    await runM7Child(options);
  } else {
    await runSystemdCanary("m7-devid", process.argv.slice(2),
      verifyM7DevidCanaryReceipt);
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
