#!/usr/bin/env node
/*
 * Inert host-root foundation for the M7 P4 authority boundary.
 *
 * This module deliberately does not acquire fd 4, select a P4 closure, read
 * a checkout, or invoke the native dropper.  Those actions require an
 * independently recomputed Phase-A authority, which does not exist yet.  The
 * small amount of executable policy here is therefore limited to validating
 * the host-root preconditions that a future supervisor must retain, beginning
 * cleanup before its first acquisition, and refusing normal launch.
 */
import { createHash } from "node:crypto";
import { constants as FS, lstat, open, readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const CADR_M7_P4_HOST_FOUNDATION = Object.freeze({
  schema: "cadr-m7-p4-host-supervisor-foundation-v2",
  production_evidence: false,
  phase_a_recomputation: "synthetic-core-only",
  launch: "refuse-until-live-unit-caps-cgroup-evidence",
});

const HEX256 = /^[0-9a-f]{64}$/;
const SERVICE_NAME = "cadr-m7-p4";
const SERVICE_UID = 611;
const SERVICE_GID = 612;
const SERVICE_HOME = "/var/empty";
const SERVICE_SHELL = "/usr/bin/nologin";
const RESULT_MAX_BYTES = 1024 * 1024;
const EXPECTED_BINDING_KEYS = Object.freeze([
  "artifacts", "comparison", "execution_accounting", "execution_budget",
  "m6_release_record", "native", "native_inputs", "patches", "portable",
  "prepared", "schedule", "source", "summary",
]);
const DROPPER_FILES = Object.freeze([
  Object.freeze({ fd: 4, role: 1, name: "node" }),
  Object.freeze({ fd: 5, role: 2, name: "descriptor_runner" }),
  Object.freeze({ fd: 7, role: 3, name: "wasm" }),
  Object.freeze({ fd: 8, role: 4, name: "module_identity" }),
  Object.freeze({ fd: 9, role: 5, name: "manifest" }),
  Object.freeze({ fd: 10, role: 6, name: "native" }),
  Object.freeze({ fd: 11, role: 7, name: "m6_release" }),
  Object.freeze({ fd: 12, role: 8, name: "artifact_1" }),
  Object.freeze({ fd: 13, role: 9, name: "artifact_2" }),
  Object.freeze({ fd: 14, role: 10, name: "artifact_4" }),
  Object.freeze({ fd: 15, role: 11, name: "artifact_5" }),
  Object.freeze({ fd: 16, role: 12, name: "artifact_3" }),
]);

const CLOSED_ENVIRONMENT = Object.freeze({
  HOME: "/var/empty",
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
  PATH: "/var/empty",
});
const DANGEROUS_ENVIRONMENT = Object.freeze([
  "BASH_ENV", "ENV", "LD_AUDIT", "LD_LIBRARY_PATH", "LD_PRELOAD",
  "NODE_OPTIONS", "NODE_PATH", "NODE_REPL_EXTERNAL_MODULE",
]);

function fail(message) {
  throw new TypeError(`M7 P4 host supervisor: ${message}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalRecord(value) {
  const bytes = Buffer.from(canonicalJson(value));
  return Object.freeze({ value: Object.freeze(value), bytes,
    sha256: sha256Hex(bytes) });
}

function safeId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) {
    fail(`${label} is not a fixed non-root numeric identity`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== "string" || !HEX256.test(value)) fail(`${label} is not SHA-256`);
  return value;
}

function exactObject(value, fields, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== fields.length ||
      fields.some(field => !Object.hasOwn(value, field))) {
    fail(`${label} has an invalid shape`);
  }
  return value;
}

function exactStoreOutput(value, label, storePrefix) {
  if (typeof value !== "string" || !value.startsWith(`${storePrefix}/`) ||
      value.includes("//") || value.endsWith("/") ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) {
    fail(`${label} is not a normalized receipt-bound store output`);
  }
  return value;
}

function insideOutput(path, output, label) {
  if (path !== output && !path.startsWith(`${output}/`)) {
    fail(`${label} is outside its receipt-bound immutable output`);
  }
  return path;
}

function parseIdentityMap(text, label) {
  const match = /^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)\s*\n$/.exec(text);
  if (match === null || match[1] !== "0" || match[2] !== "0" ||
      match[3] !== "4294967295") {
    fail(`${label} is not the complete initial-user-namespace identity map`);
  }
  return Object.freeze({ inside: match[1], outside: match[2], length: match[3] });
}

function statusLine(status, label) {
  const match = new RegExp(`^${label}:\\s*(.*)$`, "m").exec(status);
  if (match === null) fail(`/proc/self/status lacks ${label}`);
  return match[1].trim();
}

function exactRootQuad(value, label) {
  if (value !== "0 0 0 0") fail(`/proc/self/status ${label} is not exact host root`);
}

/** Pure test seam for the live /proc checks. */
export function validateM7P4HostRootSnapshotForTest(snapshot) {
  exactObject(snapshot, ["initial_user_namespace", "status", "uid_map", "gid_map"],
    "host-root snapshot");
  if (typeof snapshot.initial_user_namespace !== "boolean" || typeof snapshot.status !== "string" ||
      typeof snapshot.uid_map !== "string" || typeof snapshot.gid_map !== "string") {
    fail("host-root snapshot has invalid values");
  }
  if (snapshot.initial_user_namespace !== true) fail("host root is not in the initial user namespace");
  parseIdentityMap(snapshot.uid_map, "uid_map");
  parseIdentityMap(snapshot.gid_map, "gid_map");
  exactRootQuad(statusLine(snapshot.status, "Uid"), "Uid");
  exactRootQuad(statusLine(snapshot.status, "Gid"), "Gid");
  if (statusLine(snapshot.status, "Groups") !== "0") {
    fail("/proc/self/status Groups is not exact host-root group 0");
  }
  /* The host root may retain capabilities until the native dropper runs.  The
   * value is nevertheless parsed now so a malformed proc view cannot become
   * an authority source. */
  for (const field of ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"]) {
    if (!/^[0-9a-f]+$/.test(statusLine(snapshot.status, field))) {
      fail(`/proc/self/status ${field} is malformed`);
    }
  }
  return Object.freeze({
    initial_user_namespace: true,
    uid_map: Object.freeze({ inside: 0, outside: 0, length: 4294967295 }),
    gid_map: Object.freeze({ inside: 0, outside: 0, length: 4294967295 }),
  });
}

async function readBoundedProcFile(path, label) {
  const handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (!before.isFile() || before.dev !== after.dev || before.ino !== after.ino ||
        bytes.byteLength > 4096) {
      fail(`${label} changed while it was read`);
    }
    return new TextDecoder("ascii", { fatal: true }).decode(bytes);
  } finally {
    await handle.close();
  }
}

async function liveHostRootSnapshot() {
  let selfHandle = null;
  let initHandle = null;
  try {
    /* Linux namespace entries are procfs magic symlinks.  O_NOFOLLOW would
     * reject the object we must fstat; the opened descriptor pins its actual
     * namespace identity for the comparison below. */
    selfHandle = await open("/proc/self/ns/user", FS.O_RDONLY);
    initHandle = await open("/proc/1/ns/user", FS.O_RDONLY);
    const [uidMap, gidMap, status, selfNamespace, initNamespace] = await Promise.all([
      readBoundedProcFile("/proc/self/uid_map", "uid_map"),
      readBoundedProcFile("/proc/self/gid_map", "gid_map"),
      readBoundedProcFile("/proc/self/status", "status"),
      selfHandle.stat(), initHandle.stat(),
    ]);
    if (!selfNamespace.isFile() || !initNamespace.isFile() ||
        selfNamespace.dev !== initNamespace.dev || selfNamespace.ino !== initNamespace.ino) {
      fail("host root is not in PID 1's initial user namespace");
    }
    return Object.freeze({ initial_user_namespace: true, uid_map: uidMap, gid_map: gidMap, status });
  } finally {
    await Promise.allSettled([selfHandle?.close(), initHandle?.close()].filter(Boolean));
  }
}

/** Verifies the actual host-root process before any future descriptor acquisition. */
export async function validateM7P4LiveHostRootForTest() {
  return validateM7P4HostRootSnapshotForTest(await liveHostRootSnapshot());
}

function expectedReceiptShape(receipt) {
  exactObject(receipt, ["schema", "production_evidence", "output", "node_output", "node",
    "host_supervisor", "host_dropper", "compiler"], "host launch receipt");
  if (receipt.schema !== "cadr-m7-p4-host-launch-receipt-v1" ||
      receipt.production_evidence !== false) {
    fail("host launch receipt is not the explicit non-production foundation schema");
  }
  for (const label of ["node", "host_supervisor", "host_dropper"]) {
    exactObject(receipt[label], ["path", "sha256", "mode"], `receipt ${label}`);
    if (typeof receipt[label].path !== "string" ||
        !/^[0-9a-f]{64}$/.test(receipt[label].sha256) || receipt[label].mode !== 0o555) {
      fail(`receipt ${label} metadata is invalid`);
    }
  }
  exactObject(receipt.compiler, ["output", "closure_sha256"], "receipt compiler");
  if (typeof receipt.compiler.output !== "string" ||
      !/^[0-9a-f]{64}$/.test(receipt.compiler.closure_sha256)) {
    fail("receipt compiler closure metadata is invalid");
  }
  return receipt;
}

async function verifyReceiptArtifact(record, output, label) {
  const [path, info, bytes] = await Promise.all([
    realpath(record.path), lstat(record.path), readFile(record.path),
  ]);
  if (path !== record.path || !info.isFile() || (info.mode & 0o7777) !== record.mode ||
      createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
    fail(`receipt ${label} artifact differs from its immutable metadata`);
  }
  insideOutput(path, output, label);
  return path;
}

/**
 * Test seam for receipt-bound path policy.  Production deliberately has no
 * receipt reader until Phase A can independently recompute and authenticate a
 * receipt over inherited fd 4; a pathname receipt must not become authority.
 */
export async function validateM7P4ReceiptBoundRuntimeForTest(receipt, paths,
  { storePrefix = "/gnu/store" } = {}) {
  expectedReceiptShape(receipt);
  exactObject(paths, ["supervisor", "node", "dropper"], "runtime path set");
  if (typeof storePrefix !== "string" || !storePrefix.startsWith("/") ||
      storePrefix.endsWith("/") || storePrefix.includes("//")) {
    fail("store prefix is invalid");
  }
  const output = exactStoreOutput(receipt.output, "receipt output", storePrefix);
  const nodeOutput = exactStoreOutput(receipt.node_output, "receipt node output", storePrefix);
  exactStoreOutput(receipt.compiler.output, "receipt compiler output", storePrefix);
  const [supervisor, node, dropper] = await Promise.all([
    verifyReceiptArtifact(receipt.host_supervisor, output, "host supervisor"),
    verifyReceiptArtifact(receipt.node, nodeOutput, "Guix Node"),
    verifyReceiptArtifact(receipt.host_dropper, output, "host dropper"),
  ]);
  if (paths.supervisor !== supervisor || paths.node !== node || paths.dropper !== dropper) {
    fail("runtime realpath differs from receipt-bound immutable runtime");
  }
  return Object.freeze({ output, node_output: nodeOutput, supervisor, node, dropper });
}

/** A child environment is never derived from the caller's environment. */
export function closedM7P4HostEnvironmentForTest() {
  return CLOSED_ENVIRONMENT;
}

export function validateM7P4ClosedEnvironmentForTest(environment) {
  if (environment === null || typeof environment !== "object" || Array.isArray(environment) ||
      Object.keys(environment).length !== Object.keys(CLOSED_ENVIRONMENT).length ||
      Object.entries(CLOSED_ENVIRONMENT).some(([key, value]) => environment[key] !== value)) {
    fail("host supervisor environment is not the exact closed environment");
  }
  return true;
}

export function rejectM7P4DangerousEnvironmentForTest(environment) {
  if (environment === null || typeof environment !== "object" || Array.isArray(environment)) {
    fail("environment is not a plain mapping");
  }
  for (const key of DANGEROUS_ENVIRONMENT) {
    if (Object.hasOwn(environment, key)) fail(`ambient ${key} is forbidden before root launch`);
  }
  return true;
}

/** The service entry itself accepts no systemd socket/file-descriptor store. */
export function validateM7P4ServiceDescriptorsForTest(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.some(fd => !Number.isSafeInteger(fd)) ||
      descriptors.slice().sort((a, b) => a - b).join(",") !== "0,1,2") {
    fail("service inherited descriptors are not exactly standard input/output/error");
  }
  return true;
}

/**
 * Begin cleanup before acquisition and retain it across every partial failure.
 * `cleanup` is intentionally a tiny protocol so its failure ordering can be
 * tested without granting a test caller a production authority object.
 */
export async function runM7P4HostCleanupScopeForTest({ cleanup, acquire }) {
  if (cleanup === null || typeof cleanup !== "object" ||
      typeof cleanup.begin !== "function" || typeof cleanup.finish !== "function" ||
      typeof acquire !== "function") {
    fail("cleanup scope is invalid");
  }
  let started = false;
  let originalError = null;
  try {
    await cleanup.begin();
    started = true;
    return await acquire();
  } catch (error) {
    originalError = error;
    throw error;
  } finally {
    if (started) {
      try {
        await cleanup.finish();
      } catch (cleanupError) {
        if (originalError !== null) {
          throw new AggregateError([originalError, cleanupError],
            "host acquisition and cleanup both failed");
        }
        throw cleanupError;
      }
    }
  }
}

function validateUserRecord(value, label) {
  exactObject(value, ["name", "uid", "gid", "password", "home", "shell"], label);
  if (value.name !== SERVICE_NAME || value.password !== "!" ||
      value.uid !== SERVICE_UID || value.gid !== SERVICE_GID ||
      value.home !== SERVICE_HOME || value.shell !== SERVICE_SHELL) {
    fail(`${label} differs from the literal locked nologin service account`);
  }
  safeId(value.uid, `${label} uid`); safeId(value.gid, `${label} gid`);
  return value;
}

function validateGroupRecord(value, label) {
  exactObject(value, ["name", "gid", "password", "members"], label);
  if (value.name !== SERVICE_NAME || value.password !== "!" ||
      value.gid !== SERVICE_GID ||
      !Array.isArray(value.members) || value.members.length !== 0) {
    fail(`${label} differs from the literal locked empty service group`);
  }
  safeId(value.gid, `${label} gid`);
  return value;
}

/** Independently fixes the complete NSS account policy consumed only by fd6. */
export function validateM7P4ServiceAccountPolicyForTest(snapshot) {
  exactObject(snapshot, ["schema", "user_forward", "user_reverse", "group_forward",
    "group_reverse", "uid_matches", "gid_matches", "supplementary_groups"],
  "service account snapshot");
  if (snapshot.schema !== "cadr-m7-p4-nss-snapshot-v1") fail("NSS snapshot schema is invalid");
  const user = validateUserRecord(snapshot.user_forward, "forward user");
  const reverseUser = validateUserRecord(snapshot.user_reverse, "reverse user");
  const group = validateGroupRecord(snapshot.group_forward, "forward group");
  const reverseGroup = validateGroupRecord(snapshot.group_reverse, "reverse group");
  if (canonicalJson(user) !== canonicalJson(reverseUser) ||
      canonicalJson(group) !== canonicalJson(reverseGroup) || user.gid !== group.gid) {
    fail("forward and reverse NSS identities do not agree");
  }
  if (!Array.isArray(snapshot.uid_matches) || snapshot.uid_matches.length !== 1 ||
      canonicalJson(snapshot.uid_matches[0]) !== canonicalJson(user) ||
      !Array.isArray(snapshot.gid_matches) || snapshot.gid_matches.length !== 1 ||
      canonicalJson(snapshot.gid_matches[0]) !== canonicalJson(group)) {
    fail("NSS numeric identity has a collision or incomplete reverse enumeration");
  }
  if (!Array.isArray(snapshot.supplementary_groups) ||
      snapshot.supplementary_groups.length !== 0) {
    fail("service account has supplementary groups");
  }
  const record = Object.freeze({
    schema: "cadr-m7-p4-account-policy-v1", name: SERVICE_NAME,
    uid: SERVICE_UID, gid: SERVICE_GID, password_lock: "!", home: SERVICE_HOME,
    shell: SERVICE_SHELL, supplementary_groups: Object.freeze([]),
  });
  return canonicalRecord(record);
}

function validateSignedRevision(value, fields, label) {
  exactObject(value, fields, label);
  if (!/^[0-9a-f]{40}$/.test(value.commit) || !/^[0-9a-f]{40}$/.test(value.tree) ||
      value.signature_status !== "good-trusted-primary" || value.clean !== true) {
    fail(`${label} is not a clean authenticated revision`);
  }
  return value;
}

function validateImmutableArtifact(value, label, output) {
  exactObject(value, ["path", "bytes", "sha256", "mode"], label);
  if (typeof value.path !== "string" || !value.path.startsWith(`${output}/`) ||
      value.path.includes("//") || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value.path) ||
      !Number.isSafeInteger(value.bytes) || value.bytes < 1 ||
      !HEX256.test(value.sha256) || value.mode !== 0o555) {
    fail(`${label} is not an exact immutable Guix artifact`);
  }
  return value;
}

/** Validates the clean signed A/B selection and closed Guix launcher output. */
export function validateM7P4PhaseASelectionForTest(selection) {
  exactObject(selection, ["schema", "source_a", "release_b", "guix"], "Phase-A selection");
  if (selection.schema !== "cadr-m7-p4-phase-a-selection-v1") {
    fail("Phase-A selection schema is invalid");
  }
  const a = validateSignedRevision(selection.source_a,
    ["commit", "tree", "signature_status", "clean"], "signed source A");
  const b = validateSignedRevision(selection.release_b,
    ["commit", "tree", "parent", "signature_status", "clean"], "signed release B");
  if (b.parent !== a.commit || b.commit === a.commit || b.tree === a.tree) {
    fail("signed A/B lineage is not the exact two-revision selection");
  }
  exactObject(selection.guix, ["output", "node_output", "closure_sha256", "artifacts"],
    "Guix output selection");
  const output = exactStoreOutput(selection.guix.output, "Guix output", "/gnu/store");
  const nodeOutput = exactStoreOutput(selection.guix.node_output, "Guix Node output", "/gnu/store");
  if (!/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(output) ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(nodeOutput)) {
    fail("Guix outputs do not have exact store-item identities");
  }
  digest(selection.guix.closure_sha256, "Guix closure digest");
  exactObject(selection.guix.artifacts,
    ["authority", "descriptor_runner", "dropper", "node", "supervisor"], "Guix artifacts");
  for (const name of ["authority", "descriptor_runner", "dropper", "supervisor"]) {
    validateImmutableArtifact(selection.guix.artifacts[name], `Guix ${name}`, output);
  }
  validateImmutableArtifact(selection.guix.artifacts.node, "Guix node", nodeOutput);
  return canonicalRecord(selection);
}

function safeRelativeSegments(relativePath) {
  if (typeof relativePath !== "string" || relativePath.startsWith("/") ||
      relativePath.endsWith("/") || relativePath.includes("//")) {
    fail("descriptor-walk path is not normalized relative input");
  }
  const segments = relativePath.split("/");
  if (segments.length < 1 || segments.some(part => part === "" || part === "." || part === "..")) {
    fail("descriptor-walk path has a forbidden component");
  }
  return segments;
}

/** Pins every ancestor and the leaf through procfs descriptor-relative opens. */
export async function acquireM7P4PinnedFileForTest(rootPath, relativePath,
  { expected_sha256 = null, max_bytes = RESULT_MAX_BYTES } = {}) {
  if (typeof rootPath !== "string" || !rootPath.startsWith("/") ||
      !Number.isSafeInteger(max_bytes) || max_bytes < 1) fail("descriptor-walk policy is invalid");
  if (expected_sha256 !== null) digest(expected_sha256, "pinned file expected digest");
  const segments = safeRelativeSegments(relativePath); const handles = [];
  try {
    let parent = await open(rootPath, FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW);
    handles.push(parent);
    const rootBefore = await parent.stat({ bigint: true });
    if (!rootBefore.isDirectory()) fail("descriptor-walk root is not a directory");
    for (const segment of segments.slice(0, -1)) {
      const child = await open(`/proc/self/fd/${parent.fd}/${segment}`,
        FS.O_RDONLY | FS.O_DIRECTORY | FS.O_NOFOLLOW);
      const info = await child.stat({ bigint: true });
      if (!info.isDirectory()) fail("descriptor-walk ancestor is not a directory");
      handles.push(child); parent = child;
    }
    const leaf = await open(`/proc/self/fd/${parent.fd}/${segments.at(-1)}`,
      FS.O_RDONLY | FS.O_NOFOLLOW);
    handles.push(leaf);
    const before = await leaf.stat({ bigint: true });
    if (!before.isFile() || before.size < 1n || before.size > BigInt(max_bytes) ||
        before.size > BigInt(Number.MAX_SAFE_INTEGER)) fail("pinned file has invalid type or size");
    const bytes = await leaf.readFile(); const after = await leaf.stat({ bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      fail("pinned file changed while copied");
    }
    const actual = sha256Hex(bytes);
    if (expected_sha256 !== null && actual !== expected_sha256) fail("pinned file digest differs");
    const identity = Object.freeze({ dev: before.dev, ino: before.ino,
      bytes: Number(before.size), sha256: actual });
    await Promise.all(handles.slice(0, -1).map(handle => handle.close()));
    return Object.freeze({ handle: leaf, bytes, identity });
  } catch (error) {
    await Promise.allSettled(handles.map(handle => handle.close()));
    throw error;
  }
}

/** Independently serializes fd4 closure-v2 and fd9 fixed-module identity. */
export function composeM7P4PhaseADescriptorsForTest({ bindings, module }) {
  exactObject(bindings, EXPECTED_BINDING_KEYS, "expected closure bindings");
  for (const key of EXPECTED_BINDING_KEYS) digest(bindings[key], `closure binding ${key}`);
  exactObject(module, ["schema", "module_sha256", "module_bytes", "prepared_identity",
    "launcher"], "fixed module input");
  if (module.schema !== "cadr-m7-fixed-module-input-v1" ||
      !Number.isSafeInteger(module.module_bytes) || module.module_bytes < 1) {
    fail("fixed module input is invalid");
  }
  digest(module.module_sha256, "fixed module digest");
  const closure = canonicalRecord(Object.freeze({ bindings: Object.freeze({ ...bindings }),
    schema: "cadr-m7-frame-expected-closure-v2" }));
  const fixed = Object.freeze({ schema: "cadr-m7-fixed-module-identity-v1",
    module_sha256: module.module_sha256, module_bytes: module.module_bytes,
    identity_sha256: sha256Hex(Buffer.from(canonicalJson(module.prepared_identity))),
    launcher: module.launcher });
  return Object.freeze({ fd4: closure, fd9: canonicalRecord(fixed) });
}

export function consumeM7P4AuthorityReadyForTest(bytes, expectedClosureSha256) {
  digest(expectedClosureSha256, "expected closure digest");
  const raw = bytes instanceof Uint8Array ? Buffer.from(bytes) : null;
  if (raw === null || raw.byteLength < 2 || raw.at(-1) !== 0x0a ||
      raw.subarray(0, -1).includes(0x0a)) fail("authority READY is not exactly one LF record");
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw.subarray(0, -1))); }
  catch { fail("authority READY is not UTF-8 JSON"); }
  exactObject(value, ["expected_closure_sha256", "schema", "status"], "authority READY");
  if (value.schema !== "cadr-m7-p4-authority-ready-v1" || value.status !== "ready" ||
      value.expected_closure_sha256 !== expectedClosureSha256 ||
      !Buffer.from(canonicalJson(value)).equals(raw.subarray(0, -1))) {
    fail("authority READY differs from the selected closure");
  }
  return Object.freeze({ value: Object.freeze(value), sha256: sha256Hex(raw) });
}

function u64(buffer, offset, value, label) {
  if (typeof value !== "bigint" || value < 0n || value > 0xffffffffffffffffn) {
    fail(`${label} is not an unsigned 64-bit identity`);
  }
  buffer.writeBigUInt64LE(value, offset);
}

/** Constructs the exact inherited M7HDPV2 fd6 record for fds 7 through 17. */
export function encodeM7P4DropperConfigForTest(input) {
  exactObject(input, ["target_uid", "target_gid", "user_namespace", "authority_socket",
    "result_pipe", "account_policy_sha256", "signed_capture_metadata_sha256",
    "ready_sha256", "files"], "dropper configuration input");
  if (input.target_uid !== SERVICE_UID || input.target_gid !== SERVICE_GID) {
    fail("dropper uid and gid are not the fixed site identities");
  }
  for (const name of ["user_namespace", "authority_socket", "result_pipe"]) {
    exactObject(input[name], ["dev", "ino"], name);
  }
  for (const name of ["account_policy_sha256", "signed_capture_metadata_sha256", "ready_sha256"]) {
    digest(input[name], name);
    if (/^0+$/.test(input[name])) fail(`${name} is the forbidden zero digest`);
  }
  if (!Array.isArray(input.files) || input.files.length !== DROPPER_FILES.length) {
    fail("dropper file table is not exact");
  }
  const output = Buffer.alloc(952); Buffer.from("M7HDPV2\0", "ascii").copy(output, 0);
  output.writeUInt32LE(2, 8); output.writeUInt32LE(0, 12);
  output.writeUInt32LE(952, 16); output.writeUInt32LE(12, 20);
  u64(output, 24, BigInt(input.target_uid), "target uid");
  u64(output, 32, BigInt(input.target_gid), "target gid");
  let offset = 40;
  for (const name of ["user_namespace", "authority_socket", "result_pipe"]) {
    u64(output, offset, input[name].dev, `${name} dev`);
    u64(output, offset + 8, input[name].ino, `${name} ino`); offset += 16;
  }
  Buffer.from(input.account_policy_sha256, "hex").copy(output, 88);
  Buffer.from(input.signed_capture_metadata_sha256, "hex").copy(output, 120);
  Buffer.from(input.ready_sha256, "hex").copy(output, 152);
  input.files.forEach((file, index) => {
    const expected = DROPPER_FILES[index];
    exactObject(file, ["fd", "role", "name", "dev", "ino", "bytes", "sha256"],
      `dropper file ${index}`);
    if (file.fd !== expected.fd || file.role !== expected.role || file.name !== expected.name ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 1) fail(`dropper file ${index} differs`);
    digest(file.sha256, `dropper file ${index} digest`);
    if (/^0+$/.test(file.sha256) || input.files.slice(0, index).some(previous =>
      previous.dev === file.dev && previous.ino === file.ino)) {
      fail(`dropper file ${index} has a zero digest or aliases another authority object`);
    }
    const base = 184 + index * 64;
    output.writeUInt32LE(file.fd, base); output.writeUInt32LE(file.role, base + 4);
    u64(output, base + 8, file.dev, `dropper file ${index} dev`);
    u64(output, base + 16, file.ino, `dropper file ${index} ino`);
    u64(output, base + 24, BigInt(file.bytes), `dropper file ${index} bytes`);
    Buffer.from(file.sha256, "hex").copy(output, base + 32);
  });
  return output;
}

function rejectPaths(value, label = "result") {
  if (Array.isArray(value)) return value.forEach(item => rejectPaths(item, label));
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/path/i.test(key)) fail(`${label} contains a path-bearing field`);
      rejectPaths(child, label);
    }
  } else if (typeof value === "string" && (value.startsWith("/") ||
      value.includes("/tmp/") || value.includes("/home/") || value.includes("/gnu/store/"))) {
    fail(`${label} contains a host path`);
  }
}

/** Decodes exactly one complete M7HDRS2 frame, including terminal EOF semantics. */
export function decodeM7P4HostResultForTest(bytes) {
  const raw = bytes instanceof Uint8Array ? Buffer.from(bytes) : null;
  if (raw === null || raw.byteLength < 57 ||
      !raw.subarray(0, 8).equals(Buffer.from("M7HDRS2\0", "ascii")) ||
      raw.readUInt32LE(8) !== 2) fail("result has an invalid M7HDRS2 header");
  const disposition = raw.readUInt32LE(12);
  const length = raw.readBigUInt64LE(16);
  if (disposition > 1 || length < 1n || length > BigInt(RESULT_MAX_BYTES) ||
      length > BigInt(Number.MAX_SAFE_INTEGER) || raw.byteLength !== 56 + Number(length)) {
    fail("result frame count, disposition, or bound is invalid");
  }
  const payload = raw.subarray(56);
  if (!raw.subarray(24, 56).equals(createHash("sha256").update(payload).digest())) {
    fail("result payload digest differs");
  }
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)); }
  catch { fail("result payload is not UTF-8 JSON"); }
  if (!payload.equals(Buffer.from(canonicalJson(value)))) fail("result payload is not canonical JSON");
  rejectPaths(value);
  if (disposition === 0) {
    exactObject(value, ["execution_receipt", "schema", "status"], "successful result");
    if (value.schema !== "cadr-m7-p4-host-result-v2" || value.status !== "ok" ||
        value.execution_receipt === null || typeof value.execution_receipt !== "object" ||
        Array.isArray(value.execution_receipt)) fail("successful result payload is invalid");
  } else {
    exactObject(value, ["error", "schema", "status"], "failed result");
    exactObject(value.error, ["code", "message"], "failed result error");
    if (value.schema !== "cadr-m7-p4-host-result-v2" || value.status !== "error" ||
        value.error.code !== "M7_P4_EXECUTION_FAILED" ||
        value.error.message !== "M7 P4 execution failed") fail("failed result payload is invalid");
  }
  return Object.freeze({ disposition, value: Object.freeze(value),
    frame_sha256: sha256Hex(raw), payload_sha256: sha256Hex(payload) });
}

export async function readM7P4HostResultForTest(stream) {
  if (stream === null || typeof stream?.[Symbol.asyncIterator] !== "function") {
    fail("result stream is not async iterable");
  }
  const chunks = []; let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk); total += bytes.byteLength;
    if (total > 56 + RESULT_MAX_BYTES) fail("result stream exceeds its fixed bound");
    chunks.push(bytes);
  }
  return decodeM7P4HostResultForTest(Buffer.concat(chunks));
}

function exactExit(value, label) {
  exactObject(value, ["code", "signal"], label);
  if (value.code !== 0 || value.signal !== null) fail(`${label} was not successful`);
  return value;
}

/* Every process-like resource is recorded before the boundary is allowed to
 * return control to us.  A deadline may abandon a JavaScript promise, but it
 * must never abandon an OS resource acquired by that promise. */
function createOwnershipDomain(boundary) {
  const owned = new Set(); let escalated = false; let revoked = false;
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const snapshot = () => Object.freeze([...owned]);
  return Object.freeze({
    lease(label) {
      return Object.freeze({ label, create(factory, ...argumentsToFactory) {
        if (revoked) fail(`${label} ownership lease is revoked before factory invocation`);
        if (typeof factory !== "function") fail(`${label} child factory is not callable`);
        /* A factory that is declared async starts executing before it returns
         * its promise, so it could create an unregistered child before this
         * synthetic ownership boundary observes a handle.  Refuse it before
         * invocation: test-only factories must synchronously hand over the
         * resource that the common cleanup path will reap. */
        if (factory instanceof AsyncFunction) {
          fail(`${label} child factory must synchronously return a handle`);
        }
        const resource = factory(...argumentsToFactory);
        if (resource === null || resource === undefined || typeof resource?.then === "function") {
          fail(`${label} child factory did not synchronously return a handle`);
        }
        owned.add(resource); return resource;
      }, owns: resource => owned.has(resource) });
    },
    snapshot,
    force(label, reason) {
      if (escalated) return;
      revoked = true;
      escalated = true;
      const result = boundary.forceTerminateOwned(Object.freeze({ label, reason, resources: snapshot() }));
      if (result !== undefined) fail("owned-resource escalation is not synchronous");
    },
    get escalated() { return escalated; }, get revoked() { return revoked; },
  });
}

async function boundedBoundaryOperation(boundary, ownership, label, operation) {
  const deadline = boundary.deadline(label);
  if (deadline === null || typeof deadline !== "object" ||
      typeof deadline.promise?.then !== "function" || typeof deadline.cancel !== "function") {
    fail(`${label} deadline is not cancelable`);
  }
  const controller = new AbortController();
  let operationPromise; let value; let primary = null;
  try {
    const lease = ownership.lease(label);
    operationPromise = Promise.resolve().then(() => operation(controller.signal, lease));
    const settled = await Promise.race([operationPromise.then(result => ({ value: result }),
      error => ({ error })), deadline.promise.then(() => ({ timeout: true }),
      error => ({ deadlineError: error }))]);
    if (settled.timeout === true || Object.hasOwn(settled, "deadlineError")) {
      primary = settled.timeout === true ?
        new TypeError(`M7 P4 host supervisor: ${label} exceeded its fixed bound`) :
        settled.deadlineError;
      controller.abort(primary);
      /* The losing promise may ignore AbortSignal forever.  Its only permitted
       * side effects are resources atomically entered in ownership; synchronously
       * killing that domain makes detachment bounded and leaves final reaping
       * responsible for the registered children. */
      try { ownership.force(label, primary); } catch (error) { primary = new AggregateError([primary, error],
        `${primary.message}; owned-resource escalation also failed`); }
      void operationPromise.catch(() => {});
    } else if (Object.hasOwn(settled, "error")) primary = settled.error;
    else value = settled.value;
  } catch (error) { primary = error; }
  let cancellation = null;
  try {
    const cancellationResult = deadline.cancel();
    if (cancellationResult !== undefined) {
      if (typeof cancellationResult?.catch === "function") cancellationResult.catch(() => {});
      fail(`${label} deadline cancellation is not synchronous and bounded`);
    }
  } catch (error) { cancellation = error; }
  if (primary !== null && cancellation !== null) {
    throw new AggregateError([primary, cancellation],
      `${primary.message}; deadline cancellation also failed`);
  }
  if (primary !== null) throw primary;
  if (cancellation !== null) throw cancellation;
  return value;
}

/**
 * Synthetic orchestration seam.  The injected boundary owns native socketpair
 * and spawn syscalls; this function fixes descriptor maps, READY ordering,
 * first-terminal semantics, cleanup, and the hashes-only Phase-A receipt.
 */
export async function runM7P4PhaseASupervisorForTest(boundary) {
  const methods = ["cleanupBegin", "cleanupFinish", "captureRootSnapshot",
    "recomputePhaseASelection", "resolveServiceAccount", "deriveClosureBindings",
    "deriveFixedModule", "acquireDescriptors", "socketPair", "createAuthority", "startAuthority",
    "readAuthorityReady", "captureDropperKernelState", "createDropper", "startDropper", "readResult",
    "closeResultWriter", "waitAuthority", "waitDropper", "deadline", "terminateAndReap",
    "forceTerminateOwned"];
  if (boundary === null || typeof boundary !== "object" ||
      methods.some(name => typeof boundary[name] !== "function")) fail("supervisor boundary is incomplete");
  let began = false; let outcome = null; let authority = null; let dropper = null;
  const ownership = createOwnershipDomain(boundary);
  const errors = [];
  try {
    await boundary.cleanupBegin(); began = true;
    validateM7P4HostRootSnapshotForTest(await boundedBoundaryOperation(
      boundary, ownership, "root-snapshot", signal => boundary.captureRootSnapshot(signal)));
    const selection = validateM7P4PhaseASelectionForTest(
      await boundedBoundaryOperation(boundary, ownership, "phase-a-selection",
        signal => boundary.recomputePhaseASelection(signal)));
    const account = validateM7P4ServiceAccountPolicyForTest(
      await boundedBoundaryOperation(boundary, ownership, "service-account",
        signal => boundary.resolveServiceAccount(SERVICE_NAME, signal)));
    const descriptors = composeM7P4PhaseADescriptorsForTest({
      bindings: await boundedBoundaryOperation(boundary, ownership, "closure-bindings",
        signal => boundary.deriveClosureBindings(selection, signal)),
      module: await boundedBoundaryOperation(boundary, ownership, "fixed-module",
        signal => boundary.deriveFixedModule(selection, signal)),
    });
    const acquired = await boundedBoundaryOperation(boundary, ownership, "descriptor-acquisition",
      signal => boundary.acquireDescriptors(Object.freeze({ selection, descriptors, signal })));
    const pair = await boundedBoundaryOperation(boundary, ownership, "authority-socketpair",
      signal => boundary.socketPair(signal));
    exactObject(pair, ["supervisor", "authority"], "authority socketpair");
    const ready = await boundedBoundaryOperation(boundary, ownership, "authority-ready", async (signal, lease) => {
      authority = lease.create(boundary.createAuthority.bind(boundary), Object.freeze({ argv: ["--serve-inherited"],
        environment: CLOSED_ENVIRONMENT,
        fds: Object.freeze({ 3: pair.authority, 4: acquired.fd4,
          5: acquired.git, 6: acquired.guix, 7: acquired.gpgv, 8: acquired.keyring,
          9: acquired.module_identity }) }));
      if (!lease.owns(authority)) fail("authority spawn returned an unregistered child");
      await boundary.startAuthority(authority, signal);
      return consumeM7P4AuthorityReadyForTest(
        await boundary.readAuthorityReady(pair.supervisor, signal),
        descriptors.fd4.sha256);
    });
    const kernelState = await boundedBoundaryOperation(boundary, ownership, "dropper-kernel-state",
      signal => boundary.captureDropperKernelState(Object.freeze({ acquired, pair, ready, signal })));
    const config = encodeM7P4DropperConfigForTest({ ...kernelState,
      target_uid: account.value.uid, target_gid: account.value.gid,
      account_policy_sha256: account.sha256, ready_sha256: ready.sha256,
      files: acquired.dropper_files });
    if (!Array.isArray(acquired.dropper_handles) ||
        acquired.dropper_handles.length !== DROPPER_FILES.length) {
      fail("acquired dropper descriptor handles are not exact");
    }
    dropper = await boundedBoundaryOperation(boundary, ownership, "dropper-spawn",
      (signal, lease) => { dropper = lease.create(boundary.createDropper.bind(boundary), Object.freeze({ argv: ["--inherited-v2"],
      environment: CLOSED_ENVIRONMENT, fds: Object.freeze({ 3: pair.supervisor,
        4: acquired.node, 5: acquired.descriptor_runner, 6: config,
        7: acquired.dropper_handles[2], 8: acquired.dropper_handles[3],
        9: acquired.dropper_handles[4], 10: acquired.dropper_handles[5],
        11: acquired.dropper_handles[6], 12: acquired.dropper_handles[7],
        13: acquired.dropper_handles[8], 14: acquired.dropper_handles[9],
        15: acquired.dropper_handles[10], 16: acquired.dropper_handles[11],
        17: acquired.result_write }) }));
        return Promise.resolve(boundary.startDropper(dropper, signal)).then(() => dropper); });
    if (!ownership.snapshot().includes(dropper)) fail("dropper spawn returned an unregistered child");
    await boundedBoundaryOperation(boundary, ownership, "result-writer-close",
      signal => boundary.closeResultWriter(acquired.result_write, signal));
    /* fd17 EOF, not child-exit callback scheduling, is the result boundary.
     * Both child waits begin immediately so exits are observed and reaped, but
     * a normal authority fd3 close may causally precede result publication. */
    const decoded = await boundedBoundaryOperation(boundary, ownership, "result-eof", signal =>
      readM7P4HostResultForTest(boundary.readResult(acquired.result_read, signal)));
    if (decoded.disposition !== 0) fail("descriptor runner returned the fixed failure disposition");
    const [authorityExit, dropperExit] = await boundedBoundaryOperation(boundary, ownership, "child-exit",
      signal => Promise.all([boundary.waitAuthority(authority, signal),
        boundary.waitDropper(dropper, signal)]));
    exactExit(authorityExit, "authority"); exactExit(dropperExit, "dropper");
    const receipt = Object.freeze({ schema: "cadr-m7-p4-phase-a-supervisor-receipt-v1",
      production_evidence: false, selection_sha256: selection.sha256,
      account_policy_sha256: account.sha256, expected_closure_sha256: descriptors.fd4.sha256,
      module_identity_sha256: descriptors.fd9.sha256, ready_sha256: ready.sha256,
      result_frame_sha256: decoded.frame_sha256, result_payload_sha256: decoded.payload_sha256,
      authority_exit_sha256: sha256Hex(Buffer.from(canonicalJson(authorityExit))),
      dropper_exit_sha256: sha256Hex(Buffer.from(canonicalJson(dropperExit))) });
    rejectPaths(receipt, "Phase-A receipt");
    outcome = canonicalRecord(receipt);
  } catch (error) { errors.push(error); }
  finally {
    if (errors.length !== 0 && !ownership.escalated) {
      try { ownership.force("terminal-failure", errors[0]); } catch (forceError) { errors.push(forceError); }
    }
    if (ownership.snapshot().length !== 0) {
      try {
        await boundedBoundaryOperation(boundary, ownership, "child-reap",
          signal => boundary.terminateAndReap(Object.freeze({ authority, dropper,
            resources: ownership.snapshot(), signal })));
      } catch (reapError) { errors.push(reapError); }
    }
    if (began) {
      try { await boundary.cleanupFinish(); } catch (cleanupError) { errors.push(cleanupError); }
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors,
    "Phase-A supervision, child reaping, or cleanup failed");
  return outcome;
}

export function parseM7P4HostSupervisorArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    fail("direct host supervisor takes no caller arguments");
  }
  return Object.freeze([]);
}

export async function main(argv = process.argv.slice(2)) {
  /* There is intentionally no production supervisor in Phase A.  In
   * particular, do not parse a caller selector, inspect host state, open a
   * receipt, or invoke the synthetic orchestration seam from this entrypoint.
   * A future, separately reviewed Phase-B entrypoint will own that authority. */
  void argv;
  fail("refuses launch: Phase-A lacks live effective-unit, capability, and cgroup evidence");
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
