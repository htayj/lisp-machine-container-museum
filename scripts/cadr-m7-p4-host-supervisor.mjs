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
import { dirname, resolve } from "node:path";

export const CADR_M7_P4_HOST_FOUNDATION = Object.freeze({
  schema: "cadr-m7-p4-host-supervisor-foundation-v1",
  production_evidence: false,
  phase_a_recomputation: "not-implemented",
  launch: "refuse",
});

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

export function parseM7P4HostSupervisorArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    fail("direct host supervisor takes no caller arguments");
  }
  return Object.freeze([]);
}

async function refuseBeforePhaseA() {
  const [thisModule, node] = await Promise.all([
    realpath(fileURLToPath(import.meta.url)), realpath(process.execPath),
  ]);
  const packageRoot = resolve(dirname(thisModule), "..", "..", "..");
  /* This is a location assertion only.  It does not open a checkout or read a
   * receipt pathname as root.  Receipt binding remains a test seam until fd4
   * is independently recomputed and authenticated. */
  if (!thisModule.startsWith(`${packageRoot}/`) || !node.startsWith("/gnu/store/")) {
    fail("host supervisor or Node is not executing from an immutable Guix output");
  }
  fail("refuses launch: independent fd4 Phase-A recomputation is not implemented");
}

export async function main(argv = process.argv.slice(2)) {
  parseM7P4HostSupervisorArguments(argv);
  validateM7P4ClosedEnvironmentForTest(process.env);
  return runM7P4HostCleanupScopeForTest({
    cleanup: Object.freeze({ begin: async () => {}, finish: async () => {} }),
    acquire: async () => {
      await validateM7P4LiveHostRootForTest();
      return refuseBeforePhaseA();
    },
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
