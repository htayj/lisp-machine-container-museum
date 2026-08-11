#!/usr/bin/env node
/*
 * M7 P4 READY4 fast authority seam.
 *
 * The command never accepts a commit, an expected P4 closure, a tool path, or
 * selected-media input.  A root supervisor must first bind retained Git,
 * Guix, and P4-closure descriptors through cadr-m7-p4-authority-root.mjs.
 * This process then selects the root's clean, trusted HEAD itself.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as FS, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { Socket } from "node:net";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_M7_READY4_FAST_CONTRACT,
  CADR_M7_READY4_FAST_BUILD_ARGV,
  CADR_M7_READY4_FAST_MODULE_SCHEMA,
  CADR_M7_READY4_FAST_REQUIRED_AUTHORITIES,
  CADR_M7_READY4_FAST_TARGET,
  CADR_M7_READY4_FAST_WORKER_TRANSITIVE_MODULES,
  runM7Ready4FastCheckpointedBoot,
  validateM7Ready4FastModuleIdentity,
} from "../cadr-web/wasm/cadr-m7-ready4-fast-checkpoint.mjs";
import { parseCdrM7N1 } from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";
import { CADR_M7_EFFECTIVE_PAGE_IDENTITY_MAX_HOST_TRANSACTIONS } from
  "../cadr-web/wasm/cadr-m7-effective-page-identity.mjs";
import { p4Bindings, validateP4Manifest } from "./run-cadr-m7-frame-conformance.mjs";
import {
  inspectM7P4AuthorityRootForTest,
  revalidateM7P4GuixEndpointForTest,
  M7_P4_TRUSTED_LINEAGE_FLOOR,
} from "./cadr-m7-p4-authority-root.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_STAGE_PARENT = resolve(ROOT, "build/cadr-oracle");
const OUTPUT_RELATIVE = "cadr-web/build/cadr-web-m7-devid-O2.wasm";
const STATUS_OK = 0;
const WORKER_URL = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const NO_LEASE = Symbol("no M7 supervisor lease");
/* Captured once in the supervisor-controlled realm, before any execution
 * caller is admitted. */
const IntrinsicArrayBuffer = globalThis.ArrayBuffer;
const IntrinsicUint8Array = globalThis.Uint8Array;
const intrinsicUint8ArraySet = Function.prototype.call.bind(
  Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(IntrinsicUint8Array.prototype), "set").value);

/* This is a lineage floor, not approval for arbitrary descendants.  The
 * authority root additionally selects its own clean, signed HEAD and verifies
 * the object ancestry itself with replacement objects disabled. */
export { M7_P4_TRUSTED_LINEAGE_FLOOR };
export const M7_P4_GUIX_CHANNEL_COMMIT =
  "230aa373f315f247852ee07dff34146e9b480aec";
const M7_P4_EXACT_GUIX_PLAN = Object.freeze({
  clang: Object.freeze({
    derivation: "/gnu/store/rfrk3x0n4x8br7jgknfanvy3rpn2vmgs-clang-toolchain-21.1.5.drv",
    output: "/gnu/store/k240495dfcfwkmlpqjf3dl8zxl9h9r82-clang-toolchain-21.1.5",
    requisites_count: 52, requisites_sha256: "1f301306191b398518e80a11788c9f36f5e63ddf4bd5298bfe3c06fc35dd0bfa",
  }),
  lld: Object.freeze({
    derivation: "/gnu/store/lwl823kr8gr4n4j919gj4kvsmy255lfm-lld-21.1.5.drv",
    output: "/gnu/store/1hlqi2fs7fwkmyvks462n55bj6d936r0-lld-21.1.5",
    requisites_count: 7, requisites_sha256: "25776ef1c8f2464672895728c541c4245806e4e35451278855c839e329821598",
  }),
  bash: Object.freeze({
    derivation: "/gnu/store/l49zk72wc49jm6dkmchafhfp4ybb28xc-bash-minimal-5.2.37.drv",
    output: "/gnu/store/9pi8kah55s964qfik4cqysjdq74ll4sv-bash-minimal-5.2.37",
    requisites_count: 4, requisites_sha256: "cd64ad45ac89616a5e194da62af23b7769164c24c10523473d6249fb03394f49",
  }),
  coreutils: Object.freeze({
    derivation: "/gnu/store/lbwyr39f1913h5rjb8i934ss020hyv9n-coreutils-9.1.drv",
    output: "/gnu/store/92x5q45dgl6qynlxy66vyxdz6rk7ammd-coreutils-9.1",
    requisites_count: 8, requisites_sha256: "d5d8908793ff09c02f3ced999a002993b8e9d1d19545caab661d4bfafc8e6415",
  }),
  sed: Object.freeze({
    derivation: "/gnu/store/3x01309604iiw4594habpavcrc0v6j51-sed-4.9.drv",
    output: "/gnu/store/2c3ikfc9h1ghl9fx765mdiwsx1nnpr0f-sed-4.9",
    requisites_count: 4, requisites_sha256: "ada3e663e0cc32528b2f55d537eb791733a3fb0bfd5a504167406b31b70f2937",
  }),
});
export const M7_P4_FAST_WORKER_TRANSITIVE_MODULES =
  CADR_M7_READY4_FAST_WORKER_TRANSITIVE_MODULES;
export const M7_P4_FAST_REQUIRED_AUTHORITIES =
  CADR_M7_READY4_FAST_REQUIRED_AUTHORITIES;

function fail(message) {
  throw new TypeError(`M7 P4 fast: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function frozenCanonicalCopy(value) {
  const copy = JSON.parse(canonicalJson(value));
  const freeze = item => {
    if (item !== null && typeof item === "object") {
      for (const child of Object.values(item)) freeze(child);
      Object.freeze(item);
    }
    return item;
  };
  return freeze(copy);
}

function recursivelySnapshotData(value, label) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value;
  }
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const indexes = Object.keys(descriptors).filter(key => key !== "length").sort(
      (left, right) => Number(left) - Number(right));
    if (indexes.length !== value.length ||
        indexes.some((key, index) => key !== String(index)) ||
        Reflect.ownKeys(value).some(key => typeof key === "symbol")) {
      fail(`${label} is not a dense plain data array`);
    }
    const copy = indexes.map(key => {
      const descriptor = descriptors[key];
      if (descriptor.get !== undefined || descriptor.set !== undefined ||
          descriptor.enumerable !== true) fail(`${label}[${key}] is not a data property`);
      return recursivelySnapshotData(descriptor.value, `${label}[${key}]`);
    });
    return Object.freeze(copy);
  }
  if (typeof value !== "object" ||
      (Object.getPrototypeOf(value) !== Object.prototype &&
       Object.getPrototypeOf(value) !== null)) {
    fail(`${label} is not recursively plain data`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(key => typeof key === "symbol")) {
    fail(`${label} has symbol properties`);
  }
  const copy = Object.create(null);
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (descriptor.get !== undefined || descriptor.set !== undefined ||
        descriptor.enumerable !== true) fail(`${label}.${key} is not a data property`);
    Object.defineProperty(copy, key, {
      value: recursivelySnapshotData(descriptor.value, `${label}.${key}`),
      enumerable: true, configurable: false, writable: false,
    });
  }
  return Object.freeze(copy);
}

function canonicalDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

let inheritedAuthorityRpc = null;
let inheritedAuthoritySocket = null;
function makeAuthorityRpc(socket, timeoutMs) {
  socket.setEncoding("utf8");
  let pending = ""; const waiters = []; let terminalError = null;
  const rejectAll = error => {
    if (terminalError === null) terminalError = error;
    while (waiters.length > 0) {
      const waiter = waiters.shift(); clearTimeout(waiter.timeout); waiter.reject(terminalError);
    }
  };
  socket.on("data", chunk => {
    pending += chunk;
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
      const waiter = waiters.shift();
      if (waiter === undefined) { socket.destroy(new Error("unsolicited M7 authority response")); break; }
      clearTimeout(waiter.timeout);
      try { waiter.resolve(JSON.parse(line)); } catch (error) { waiter.reject(error); }
    }
  });
  socket.once("error", error => rejectAll(error));
  socket.once("end", () => rejectAll(new Error("privileged M7 authority ended before replying")));
  socket.once("close", () => rejectAll(new Error("privileged M7 authority closed before replying")));
  return request => new Promise((resolveRequest, rejectRequest) => {
    if (terminalError !== null || socket.destroyed) {
      rejectRequest(terminalError ?? new Error("privileged M7 authority socket is closed")); return;
    }
    const waiter = { resolve: resolveRequest, reject: rejectRequest, timeout: null };
    waiter.timeout = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      rejectRequest(new Error("privileged M7 authority response timed out"));
      socket.destroy();
    }, timeoutMs);
    waiters.push(waiter);
    socket.write(`${canonicalJson(request)}\n`, error => {
      if (error !== null && error !== undefined) {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        clearTimeout(waiter.timeout); rejectRequest(error);
      }
    });
  }).then(response => {
    const snapshot = recursivelySnapshotData(response, "privileged M7 authority response");
    if (snapshot.ok !== true) fail(`privileged authority rejected request: ${snapshot.error?.message}`);
    return snapshot;
  });
}

/** Test seam for orderly-EOF behavior; production alone adopts inherited fd3. */
export function createM7P4AuthorityRpcForTest(socket, timeoutMs = 250) {
  if (!(socket instanceof Socket) || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    fail("test RPC requires a Socket and positive integer timeout");
  }
  return makeAuthorityRpc(socket, timeoutMs);
}

function productionAuthorityRpc() {
  if (inheritedAuthorityRpc !== null) return inheritedAuthorityRpc;
  const socket = new Socket({ fd: 3, readable: true, writable: true });
  inheritedAuthoritySocket = socket;
  inheritedAuthorityRpc = makeAuthorityRpc(socket, 30000);
  return inheritedAuthorityRpc;
}

async function closeProductionAuthorityRpc() {
  if (inheritedAuthorityRpc === null) {
    inheritedAuthoritySocket?.destroy(); inheritedAuthoritySocket = null; return;
  }
  const request = inheritedAuthorityRpc;
  const socket = inheritedAuthoritySocket;
  try {
    const response = await request({ op: "close" });
    if (response.closed !== true) fail("privileged authority close was not acknowledged");
  } finally {
    socket?.destroy();
    inheritedAuthorityRpc = null;
    inheritedAuthoritySocket = null;
  }
}

async function revalidateWithPrivilegedAuthority(identity, moduleBytes) {
  const response = await productionAuthorityRpc()({ op: "revalidate", identity,
    module_b64: Buffer.from(moduleBytes).toString("base64") });
  return response.provenance;
}

async function validateNativeWithPrivilegedAuthority(value) {
  const authority = plainDataRecord(value, ["manifest_bytes", "manifest_identity",
    "native_frame", "schema"], "M7 caller native authority request");
  if (authority.schema !== "cadr-m7-p4-native-authority-v2" ||
      !(authority.manifest_bytes instanceof IntrinsicUint8Array) ||
      !(authority.native_frame instanceof IntrinsicUint8Array)) {
    fail("M7 caller native authority request is incomplete");
  }
  const response = await productionAuthorityRpc()({ op: "validate-native",
    manifest_b64: Buffer.from(authority.manifest_bytes).toString("base64"),
    manifest_identity: recursivelySnapshotData(authority.manifest_identity,
      "M7 caller manifest identity"),
    native_b64: Buffer.from(authority.native_frame).toString("base64") });
  return Object.freeze({ nativeFrame: new IntrinsicUint8Array(
    Buffer.from(response.native_frame_b64, "base64")), receipt: response.receipt });
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length ||
      actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has missing or unknown fields`);
  }
  return value;
}

/* A supervisor transcript is data, never a live object with getter side
 * effects.  Read descriptors once and reconstruct a null-prototype snapshot
 * before validation or receipt construction. */
function plainDataRecord(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not a plain data object`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Object.keys(descriptors).sort();
  const expected = [...keys].sort();
  if (Reflect.ownKeys(value).length !== actual.length ||
      actual.length !== expected.length ||
      actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has missing or unknown fields`);
  }
  const copy = Object.create(null);
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || descriptor.get !== undefined ||
        descriptor.set !== undefined || descriptor.enumerable !== true) {
      fail(`${label}.${key} is not an own enumerable data property`);
    }
    Object.defineProperty(copy, key, { value: descriptor.value,
      enumerable: true, configurable: false, writable: false });
  }
  return Object.freeze(copy);
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a lowercase SHA-256`);
  }
  return value;
}

function identityShape(value, label, expectedPath = null) {
  exactKeys(value, ["bytes", "path", "sha256"], label);
  if (typeof value.path !== "string" || value.path.length === 0 ||
      value.path.startsWith("/") || value.path.split("/").includes("..") ||
      (expectedPath !== null && value.path !== expectedPath) ||
      !Number.isSafeInteger(value.bytes) || value.bytes < 1) {
    fail(`${label} has an invalid path or byte count`);
  }
  digest(value.sha256, `${label} hash`);
  return value;
}

function storePath(value, suffix, label) {
  if (typeof value !== "string" || !new RegExp(
    `^/gnu/store/[0-9a-df-np-sv-z]{32}-${suffix}$`).test(value)) {
    fail(`${label} is not an exact Guix store path`);
  }
  return value;
}

function exactOneLine(value, label) {
  const line = String(value).trim();
  if (line.length === 0 || /\s/.test(line)) fail(`${label} has no exact one-line value`);
  return line;
}

async function fileIdentity(path, root = ROOT) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1) {
    fail(`${relative(root, path)} is not a nonempty regular non-symlink file`);
  }
  const bytes = await readFile(path);
  const after = await lstat(path);
  if (after.dev !== info.dev || after.ino !== info.ino || after.size !== info.size ||
      after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs ||
      bytes.byteLength !== info.size) {
    fail(`${relative(root, path)} changed while reading`);
  }
  return Object.freeze({ path: relative(root, path), bytes: bytes.byteLength,
    sha256: sha256(bytes) });
}

function moduleExports(wasmBytes) {
  let module;
  try {
    module = new WebAssembly.Module(wasmBytes);
  } catch {
    fail("selected staged Wasm is not a valid module");
  }
  const names = new Set(WebAssembly.Module.exports(module).map(entry => entry.name));
  for (const name of ["cadr_wasm_boot_witness", "cadr_wasm_display_full",
    "cadr_wasm_display_update", "cadr_wasm_m6_disk_evidence_summary",
    "cadr_wasm_run_until_event_m6", "cadr_wasm_m7_unimplemented_diagnostic"]) {
    if (!names.has(name)) fail(`staged m7-devid Wasm lacks ${name}`);
  }
  for (const name of ["cadr_wasm_m9_input_deliver", "cadr_wasm_m12_debug_state"]) {
    if (names.has(name)) fail(`staged Wasm is a later profile (${name})`);
  }
  return module;
}

function sourceClosure(value, label) {
  exactKeys(value, ["file_count", "schema", "sha256", "total_byte_count"], label);
  if (value.schema !== "cadr-m6-stage-source-closure-v1" ||
      !Number.isSafeInteger(value.file_count) || value.file_count < 1 ||
      !Number.isSafeInteger(value.total_byte_count) || value.total_byte_count < 1) {
    fail(`${label} is not the established staged M6 closure`);
  }
  digest(value.sha256, `${label} hash`);
  return value;
}

function stagedAuthority(value) {
  exactKeys(value, ["files", "full_tree_file_count", "prefix_counts", "schema"],
    "M7 staged authority");
  if (value.schema !== "cadr-m7-p4-fast-authority-v2" ||
      !Number.isSafeInteger(value.full_tree_file_count) ||
      !Array.isArray(value.files)) fail("M7 staged authority is incomplete");
  const paths = value.files.map((file, index) =>
    identityShape(file, `M7 staged authority file ${index}`).path);
  if (!paths.every((path, index) => index === 0 || paths[index - 1] < path) ||
      !CADR_M7_READY4_FAST_REQUIRED_AUTHORITIES.every(path => paths.includes(path)) ||
      value.full_tree_file_count < paths.length) {
    fail("M7 staged authority paths are incomplete or noncanonical");
  }
  exactKeys(value.prefix_counts, ["core", "include", "trace"],
    "M7 staged authority prefix counts");
  for (const prefix of ["core", "include", "trace"]) {
    const count = value.prefix_counts[prefix];
    if (!Number.isSafeInteger(count) || count < 1 ||
        paths.filter(path => path.startsWith(`cadr-web/${prefix}/`)).length !== count) {
      fail(`M7 staged ${prefix} coverage differs`);
    }
  }
  return value;
}

function buildToolchain(value) {
  exactKeys(value, ["build_environment", "guix", "schema", "toolchain"],
    "M7 build toolchain");
  if (value.schema !== "cadr-m7-p4-fast-toolchain-v4") {
    fail("M7 build toolchain receipt is incomplete");
  }
  exactKeys(value.build_environment, ["HOME", "LANG", "LC_ALL", "TZ"],
    "M7 closed build environment");
  if (value.build_environment.HOME !== "/var/empty" ||
      value.build_environment.LANG !== "C" || value.build_environment.LC_ALL !== "C" ||
      value.build_environment.TZ !== "UTC") fail("M7 build environment is not closed");
  exactKeys(value.guix, ["channel_commit", "daemon_socket", "descriptor_bytes",
    "descriptor_sha256", "store"],
    "M7 descriptor-bound Guix");
  if (value.guix.channel_commit !== M7_P4_GUIX_CHANNEL_COMMIT ||
      !Number.isSafeInteger(value.guix.descriptor_bytes) ||
      value.guix.descriptor_bytes < 1) fail("M7 Guix channel or descriptor differs");
  digest(value.guix.descriptor_sha256, "M7 Guix descriptor hash");
  const exactGuixAuthority = { daemon_socket: { dev: 37, ino: 5528344,
    uid: 944, gid: 954, mode: 0o666 }, store: { dev: 37, ino: 389021,
    uid: 944, gid: 954, mode: 0o1775 } };
  if (canonicalJson(value.guix.daemon_socket) !== canonicalJson(exactGuixAuthority.daemon_socket) ||
      canonicalJson(value.guix.store) !== canonicalJson(exactGuixAuthority.store)) {
    fail("M7 Guix daemon/store authority differs from the pinned host capability");
  }
  exactKeys(value.toolchain, ["bash", "clang", "coreutils", "lld", "sed"], "M7 Guix toolchain");
  for (const name of ["bash", "clang", "coreutils", "lld", "sed"]) {
    exactKeys(value.toolchain[name], ["derivation", "output", "requisites_count",
      "requisites_sha256"],
      `M7 ${name} toolchain`);
    storePath(value.toolchain[name].derivation, "[^/]+\\.drv",
      `M7 ${name} derivation`);
    storePath(value.toolchain[name].output, "[^/]+",
      `M7 ${name} output`);
    if (value.toolchain[name].derivation !== M7_P4_EXACT_GUIX_PLAN[name].derivation ||
        value.toolchain[name].output !== M7_P4_EXACT_GUIX_PLAN[name].output ||
        value.toolchain[name].requisites_count !== M7_P4_EXACT_GUIX_PLAN[name].requisites_count ||
        value.toolchain[name].requisites_sha256 !== M7_P4_EXACT_GUIX_PLAN[name].requisites_sha256) {
      fail(`M7 ${name} differs from the frozen time-machine plan`);
    }
  }
  return value;
}

export function createM7P4FastModuleIdentity({ sourceCommit, sourceTree,
  signature, closureBefore, closureAfter, authorityBefore, authorityAfter,
  toolchain, wasm }) {
  return validateM7Ready4FastModuleIdentity({
    schema: CADR_M7_READY4_FAST_MODULE_SCHEMA,
    contract: CADR_M7_READY4_FAST_CONTRACT,
    target: CADR_M7_READY4_FAST_TARGET,
    profile: "m7-devid", optimization: "O2", protocol_version: 5,
    run_operation: "run-until-event-m6",
    source: { commit: sourceCommit, tree: sourceTree, signature,
      closure_before: closureBefore,
      closure_after: closureAfter, authority_before: authorityBefore,
      authority_after: authorityAfter },
    build: { argv: [...CADR_M7_READY4_FAST_BUILD_ARGV], toolchain, wasm },
  });
}

export function validateM7P4FastPreparedIdentity(value) {
  return validateM7Ready4FastModuleIdentity(recursivelySnapshotData(value,
    "M7 prepared module identity"));
}

function closedEnvironment() {
  return Object.freeze({ HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC" });
}

/* Execute only an already opened executable descriptor.  The child receives
 * it as fd 3 and opens its own /proc/self/fd/3; no PATH lookup occurs. */
async function runDescriptor(fd, args, cwd) {
  if (!Number.isSafeInteger(fd) || fd < 0 || !Array.isArray(args) ||
      !args.every(item => typeof item === "string")) fail("root command descriptor is invalid");
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn("/proc/self/fd/3", args, {
      cwd, env: closedEnvironment(),
      stdio: ["ignore", "pipe", "pipe", { fd, readable: true, writable: false }],
    });
    const out = []; const err = [];
    child.stdout.on("data", chunk => out.push(chunk));
    child.stderr.on("data", chunk => err.push(chunk));
    child.once("error", rejectCommand);
    child.once("close", code => {
      const stdout = Buffer.concat(out); const stderr = Buffer.concat(err);
      if (code !== 0) {
        rejectCommand(new Error(`descriptor-bound command failed (${code}): ${stderr.toString("utf8").trim()}`));
      } else resolveCommand(stdout);
    });
  });
}

async function selectTrustedHead(authorityRoot) {
  const root = inspectM7P4AuthorityRootForTest(authorityRoot);
  return Object.freeze({ commit: root.snapshot.commit, tree: root.snapshot.tree,
    signature: root.snapshot.signature });
}

async function stageAuthority(stage, trackedPaths) {
  const selected = trackedPaths.filter(path =>
    M7_P4_FAST_REQUIRED_AUTHORITIES.includes(path) ||
    path.startsWith("cadr-web/core/") || path.startsWith("cadr-web/include/") ||
    path.startsWith("cadr-web/trace/")).sort();
  for (const required of M7_P4_FAST_REQUIRED_AUTHORITIES) {
    if (!selected.includes(required)) fail(`root-selected source omits ${required}`);
  }
  const files = [];
  for (const path of selected) files.push(await fileIdentity(resolve(stage, path), stage));
  return Object.freeze({ schema: "cadr-m7-p4-fast-authority-v2",
    full_tree_file_count: trackedPaths.length, files: Object.freeze(files),
    prefix_counts: Object.freeze({
      core: selected.filter(path => path.startsWith("cadr-web/core/")).length,
      include: selected.filter(path => path.startsWith("cadr-web/include/")).length,
      trace: selected.filter(path => path.startsWith("cadr-web/trace/")).length,
    }) });
}

async function sourceClosureIdentity(stage, trackedPaths) {
  const digest = createHash("sha256"); let totalByteCount = 0;
  for (const path of trackedPaths) {
    const bytes = await readFile(resolve(stage, path));
    const pathBytes = Buffer.from(path, "utf8"); const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(pathBytes.byteLength), 0);
    header.writeBigUInt64LE(BigInt(bytes.byteLength), 8);
    digest.update(header).update(pathBytes).update(Buffer.from(sha256(bytes), "hex"));
    totalByteCount += bytes.byteLength;
  }
  return Object.freeze({ schema: "cadr-m6-stage-source-closure-v1",
    file_count: trackedPaths.length, total_byte_count: totalByteCount,
    sha256: digest.digest("hex") });
}

async function extractGitArchive(tarBytes, stage) {
  let offset = 0;
  while (offset < tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512);
    if (header.byteLength !== 512) fail("descriptor-bound Git archive is truncated");
    if (header.every(byte => byte === 0)) return;
    const field = (start, length) => {
      const raw = header.subarray(start, start + length);
      const end = raw.indexOf(0); return Buffer.from(raw.subarray(0, end < 0 ? length : end)).toString("utf8");
    };
    const name = field(0, 100); const prefix = field(345, 155);
    const path = `${prefix.length === 0 ? "" : `${prefix}/`}${name}`;
    const sizeText = field(124, 12).trim();
    const size = sizeText.length === 0 ? 0 : Number.parseInt(sizeText, 8);
    const type = header[156];
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith("/") ||
        path.split("/").includes("..") || !Number.isSafeInteger(size) || size < 0) {
      fail("descriptor-bound Git archive has an unsafe member");
    }
    const dataStart = offset + 512; const dataEnd = dataStart + size;
    if (dataEnd > tarBytes.byteLength) fail("descriptor-bound Git archive member is truncated");
    const output = resolve(stage, path);
    if (!output.startsWith(`${stage}/`) && output !== stage) fail("Git archive escapes its private stage");
    if (type === 53 /* directory */) {
      if (size !== 0) fail("Git archive directory has data");
      await mkdir(output, { recursive: true, mode: 0o700 });
    } else if (type === 0 || type === 48 /* regular */) {
      await mkdir(dirname(output), { recursive: true, mode: 0o700 });
      await writeFile(output, tarBytes.subarray(dataStart, dataEnd),
        { flag: FS.O_CREAT | FS.O_EXCL | FS.O_WRONLY, mode: 0o600 });
    } else {
      fail("descriptor-bound Git archive has a non-regular member");
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  fail("descriptor-bound Git archive lacks its terminal block");
}

async function stageTrustedSource(authorityRoot, selection) {
  const root = inspectM7P4AuthorityRootForTest(authorityRoot);
  const trackedPaths = [...root.snapshot.inventory];
  if (trackedPaths.length === 0 || new Set(trackedPaths).size !== trackedPaths.length ||
      trackedPaths.some(path => !/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith("/") ||
        path.split("/").includes(".."))) fail("root-selected Git tree is not a canonical file list");
  await mkdir(PRIVATE_STAGE_PARENT, { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(resolve(PRIVATE_STAGE_PARENT, "m7-p4-fast-root-"));
  try {
    await extractGitArchive(root.snapshot.archive, stage);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return Object.freeze({ stage, trackedPaths: Object.freeze(trackedPaths) });
}

async function collectDescriptorBoundToolchain(authorityRoot) {
  const root = inspectM7P4AuthorityRootForTest(authorityRoot);
  const guix = async args => {
    await revalidateM7P4GuixEndpointForTest(authorityRoot);
    const output = await runDescriptor(root.guix.fd, args, ROOT);
    await revalidateM7P4GuixEndpointForTest(authorityRoot);
    return output;
  };
  const channels = String(await guix(["describe", "-f", "channels"]));
  const commits = [...channels.matchAll(/[0-9a-f]{40}/g)].map(match => match[0]);
  if (!commits.includes(M7_P4_GUIX_CHANNEL_COMMIT)) {
    fail("descriptor-bound Guix is not at the pinned channel commit");
  }
  const resolvedText = String(await guix(["time-machine",
    `--commit=${M7_P4_GUIX_CHANNEL_COMMIT}`, "--", "build", "--derivations",
    "clang-toolchain", "lld", "bash-minimal", "coreutils", "sed"], ROOT));
  const resolvedDerivations = resolvedText.trim().split("\n").filter(Boolean).sort();
  const exactDerivations = Object.values(M7_P4_EXACT_GUIX_PLAN)
    .map(item => item.derivation).sort();
  if (canonicalJson(resolvedDerivations) !== canonicalJson(exactDerivations)) {
    fail("pinned Guix time-machine package resolution differs from the frozen derivations");
  }
  /* Package names are never accepted here.  This exact plan was resolved at
   * the pinned time-machine commit and is now policy data; store objects are
   * checked directly, so a changed channel/package selection fails closed. */
  for (const [name, item] of Object.entries(M7_P4_EXACT_GUIX_PLAN)) {
    const drvBytes = await readFile(item.derivation);
    const declared = [...drvBytes.toString("utf8").matchAll(
      /\("out","(\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^"\\]+)","",""\)/g)];
    if (declared.length !== 1 || declared[0][1] !== item.output) {
      fail(`M7 ${name} output is not the exact pinned derivation's declared out`);
    }
    await fileIdentity(item.derivation, "/gnu/store");
    const executable = `${item.output}/bin/${name === "lld" ? "wasm-ld" :
      name === "bash" ? "bash" : name === "coreutils" ? "env" : name}`;
    await fileIdentity(await realpath(executable), "/gnu/store");
    const requisites = String(await guix(
      ["gc", "--requisites", item.output])).trim().split("\n").filter(Boolean).sort();
    if (requisites.length !== item.requisites_count ||
        sha256(Buffer.from(`${requisites.join("\n")}\n`, "utf8")) !== item.requisites_sha256) {
      fail(`M7 ${name} exact output requisites differ from the frozen pinned closure`);
    }
  }
  return Object.freeze({ schema: "cadr-m7-p4-fast-toolchain-v4",
    build_environment: closedEnvironment(),
    guix: Object.freeze({ channel_commit: M7_P4_GUIX_CHANNEL_COMMIT,
      descriptor_bytes: root.guix.identity.bytes,
      descriptor_sha256: root.guix.identity.sha256,
      daemon_socket: root.guix.daemon.socket, store: root.guix.daemon.store }),
    toolchain: M7_P4_EXACT_GUIX_PLAN });
}

const CLOSED_O2_SCRIPT = String.raw`set -eu
test "$LANG" = C; test "$LC_ALL" = C; test "$TZ" = UTC
test "$(clang --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5
test "$(wasm-ld --version | sed -n "1s/.* \([0-9][0-9.]*\).*/\1/p")" = 21.1.5
cd "$1/cadr-web"
clang --target=wasm32-unknown-unknown -std=c11 -O2 -ffreestanding \
  -Wall -Wextra -Werror -Wpedantic -Wconversion -Wshadow -Wstrict-prototypes \
  -Wmissing-prototypes -Wformat=2 -fno-builtin -fno-stack-protector \
  -DCADR_M5_WASM -DCADR_M6_DEVID_WASM -DCADR_M7_WASM -DCADR_M7_CORE \
  -DCADR_M7_DEVID_WASM \
  -fno-fast-math -fno-strict-overflow -fvisibility=hidden -nostdinc \
  -Iwasm/include -Iinclude -Icore -Icore/usim-port -Itrace \
  wasm/cadr_wasm_runtime.c wasm/cadr_wasm_adapter.c \
  core/cadr_m6_disk_evidence.c core/cadr_m6_fast_run.c core/cadr_display.c \
  core/cadr_core.c core/cadr_state_v2.c core/cadr_state_v3.c core/cadr_state_v4.c \
  core/cadr_state_v5.c core/cadr_m4_media.c core/cadr_disk_evidence.c core/cadr_snapshot.c \
  trace/cadr_trace_engine.c core/usim-port/cadr_processor_memory.c \
  core/usim-port/bus-adaptor.c core/usim-port/bus-interface.c core/usim-port/unibus-mapping.c \
  core/usim-port/diagnostic-interface.c core/usim-port/tv.c core/usim-port/colortv.c \
  core/usim-port/iob.c core/usim-port/disk-controller.c core/usim-port/tape-controller.c \
  core/usim-port/uch11.c -nostdlib -Wl,--no-entry -Wl,--export-memory \
  -Wl,--initial-memory=134217728 -Wl,--max-memory=134217728 -Wl,-z,stack-size=1048576 \
  -Wl,--gc-sections -Wl,--strip-all -o "$2"`;

async function buildExactO2(authorityRoot, stage) {
  inspectM7P4AuthorityRootForTest(authorityRoot);
  const output = resolve(stage, OUTPUT_RELATIVE);
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  const plan = M7_P4_EXACT_GUIX_PLAN;
  const path = [plan.clang.output, plan.lld.output, plan.coreutils.output,
    plan.sed.output].map(item => `${item}/bin`).join(":");
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(`${plan.bash.output}/bin/bash`, ["-eu", "-c",
      CLOSED_O2_SCRIPT, "bash", stage, output], {
      cwd: stage, env: closedEnvironment({ PATH: path }), stdio: ["ignore", "pipe", "pipe"],
    });
    const err = [];
    child.stderr.on("data", chunk => err.push(chunk));
    child.once("error", rejectBuild);
    child.once("close", code => code === 0 ? resolveBuild() : rejectBuild(new Error(
      `exact Guix-plan build failed (${code}): ${Buffer.concat(err).toString("utf8").trim()}`)));
  });
  const bytes = new Uint8Array(await readFile(output));
  const identity = await fileIdentity(output, stage);
  if (identity.bytes !== bytes.byteLength || identity.sha256 !== sha256(bytes)) {
    fail("exact O2 Wasm changed while its output was bound");
  }
  moduleExports(bytes.slice());
  return Object.freeze({ bytes: bytes.slice(), identity });
}

/**
 * Select, stage, and build only the root-owned checkout.  There is
 * intentionally no `sourceCommit`, `exec`, archive, or tool-path parameter.
 */
export async function precommitM7P4Fast({ authorityRoot } = {}) {
  const selection = await selectTrustedHead(authorityRoot);
  const staged = await stageTrustedSource(authorityRoot, selection);
  try {
    const authorityBefore = await stageAuthority(staged.stage, staged.trackedPaths);
    const closureBefore = await sourceClosureIdentity(staged.stage, staged.trackedPaths);
    const toolchain = await collectDescriptorBoundToolchain(authorityRoot);
    const built = await buildExactO2(authorityRoot, staged.stage);
    const closureAfter = await sourceClosureIdentity(staged.stage, staged.trackedPaths);
    const authorityAfter = await stageAuthority(staged.stage, staged.trackedPaths);
    if (canonicalJson(closureBefore) !== canonicalJson(closureAfter) ||
        canonicalJson(authorityBefore) !== canonicalJson(authorityAfter)) {
      fail("root-selected staged closure changed during exact M7-DEVID O2 build");
    }
    return createM7P4FastModuleIdentity({ sourceCommit: selection.commit,
      sourceTree: selection.tree, signature: selection.signature,
      closureBefore, closureAfter, authorityBefore,
      authorityAfter, toolchain, wasm: built.identity });
  } finally {
    await rm(staged.stage, { recursive: true, force: true });
  }
}

/** The root independently repeats source selection, staging, and O2 build. */
export async function revalidateM7P4FastPreparation(identity, moduleBytes, authorityRoot) {
  const authorityDomain = inspectM7P4AuthorityRootForTest(authorityRoot).domain;
  const prepared = validateM7P4FastPreparedIdentity(identity);
  const bytes = moduleBytes instanceof Uint8Array ? moduleBytes : null;
  if (bytes === null || bytes.byteLength !== prepared.build.wasm.bytes ||
      sha256(bytes) !== prepared.build.wasm.sha256) {
    fail("selected staged M7-DEVID Wasm differs from its preparation receipt");
  }
  const independentlyPrepared = await precommitM7P4Fast({ authorityRoot });
  if (canonicalJson(prepared) !== canonicalJson(independentlyPrepared)) {
    fail("independently rooted staged M7-DEVID O2 preparation differs from supplied receipt");
  }
  return Object.freeze({ schema: authorityDomain === "production" ?
    "cadr-m7-p4-fast-execution-provenance-v2" :
    "cadr-m7-p4-fast-execution-provenance-test-v1",
    source_commit: prepared.source.commit, source_tree: prepared.source.tree,
    module_identity_sha256: canonicalDigest(prepared),
    module_sha256: prepared.build.wasm.sha256,
    trusted_lineage_floor: M7_P4_TRUSTED_LINEAGE_FLOOR,
    signature: identity.source.signature });
}

function validateExecutionProvenance(value, identity, testAuthority = false) {
  value = recursivelySnapshotData(value, "M7 P4 independent execution provenance");
  exactKeys(value, ["module_identity_sha256", "module_sha256", "schema", "signature",
    "source_commit", "source_tree", "trusted_lineage_floor"],
  "M7 P4 independent execution provenance");
  const expectedSchema = testAuthority ? "cadr-m7-p4-fast-execution-provenance-test-v1" :
    "cadr-m7-p4-fast-execution-provenance-v2";
  if (value.schema !== expectedSchema ||
      value.source_commit !== identity.source.commit || value.source_tree !== identity.source.tree ||
      value.module_identity_sha256 !== canonicalDigest(identity) ||
      value.module_sha256 !== identity.build.wasm.sha256 ||
      value.trusted_lineage_floor !== M7_P4_TRUSTED_LINEAGE_FLOOR ||
      canonicalJson(value.signature) !== canonicalJson(identity.source.signature)) {
    fail("independently rooted staged M7-DEVID O2 provenance differs from supplied receipt");
  }
  digest(value.module_identity_sha256, "M7 P4 execution module identity");
  digest(value.module_sha256, "M7 P4 execution module");
  return value;
}

/* This function accepts only the opaque authority capability.  The old
 * `{ expected_closure_bytes, expected_closure_identity }` caller envelope is
 * deliberately not supported: it permitted coordinated manifest/closure
 * forgeries at one boundary. */
export function selectM7P4FrozenExpectedClosure(authorityRoot) {
  const root = inspectM7P4AuthorityRootForTest(authorityRoot);
  return Object.freeze({ expected: root.expected,
    sha256: root.expectedIdentity.sha256, domain: root.domain });
}

export function validateM7P4NativeAuthority(value, authorityRoot,
  validateManifest = validateP4Manifest, bindings = p4Bindings) {
  const authority = plainDataRecord(value, ["manifest_bytes", "manifest_identity",
    "native_frame", "schema"], "M7 P4 native authority");
  if (authority.schema !== "cadr-m7-p4-native-authority-v2") fail("M7 P4 native authority schema differs");
  const trusted = selectM7P4FrozenExpectedClosure(authorityRoot);
  const manifestBytes = authority.manifest_bytes instanceof Uint8Array ?
    authority.manifest_bytes.slice() : null;
  const nativeFrame = authority.native_frame instanceof Uint8Array ? authority.native_frame.slice() : null;
  if (manifestBytes === null || nativeFrame === null) fail("M7 P4 native authority lacks exact bytes");
  const manifestIdentity = identityShape(recursivelySnapshotData(
    authority.manifest_identity, "M7 P4 manifest identity"),
  "M7 P4 manifest identity");
  if (manifestIdentity.bytes !== manifestBytes.byteLength ||
      manifestIdentity.sha256 !== sha256(manifestBytes)) {
    fail("M7 P4 manifest bytes differ from their identity");
  }
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
  } catch {
    fail("M7 P4 manifest is not UTF-8 JSON");
  }
  if (Buffer.from(manifestBytes).compare(Buffer.from(canonicalJson(manifest))) !== 0) {
    fail("M7 P4 manifest bytes are not canonical");
  }
  const validated = validateManifest(manifest, trusted.expected);
  const parsed = parseCdrM7N1(nativeFrame);
  if (validated.native?.frame_file?.bytes !== nativeFrame.byteLength ||
      validated.native?.frame_file?.sha256 !== sha256(nativeFrame) ||
      validated.native?.capture?.boundary !== parsed.boundary.toString() ||
      validated.native?.capture?.tv_mode !== parsed.tvMode ||
      validated.native?.capture?.black_on_white !== parsed.blackOnWhite) {
    fail("raw CDRM7N1 differs from the closed P4 native authority");
  }
  return Object.freeze({ nativeFrame,
    receipt: Object.freeze({ schema: trusted.domain === "production" ? authority.schema :
      "cadr-m7-p4-native-authority-test-v1",
      manifest: frozenCanonicalCopy(manifestIdentity),
      expected_closure_sha256: trusted.sha256,
      bindings: recursivelySnapshotData(bindings(validated),
        "M7 P4 validated native bindings") }) });
}

function leaseFromMalformedAcquisition(value) {
  if (value === null || typeof value !== "object") return NO_LEASE;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "lease");
    return descriptor !== undefined && descriptor.get === undefined && descriptor.set === undefined &&
      descriptor.value !== null && descriptor.value !== undefined ? descriptor.value : NO_LEASE;
  } catch {
    return NO_LEASE;
  }
}

function validateAcquisition(value) {
  const acquisition = plainDataRecord(value, ["lease", "session_id"],
    "M7 supervisor acquisition");
  if (acquisition.lease === null || acquisition.lease === undefined ||
      typeof acquisition.session_id !== "string" || acquisition.session_id.length === 0) {
    fail("M7 supervisor acquisition is incomplete");
  }
  return Object.freeze({ lease: acquisition.lease, sessionId: acquisition.session_id });
}

function dataMethod(value, name, label) {
  let cursor = value;
  while (cursor !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(cursor, name);
    if (descriptor !== undefined) {
      if (descriptor.get !== undefined || descriptor.set !== undefined ||
          typeof descriptor.value !== "function") fail(`${label}.${name} is not a data method`);
      return (...args) => Reflect.apply(descriptor.value, value, args);
    }
    cursor = Object.getPrototypeOf(cursor);
  }
  fail(`${label}.${name} is absent`);
}

function validateInstantiation(value, module, request, identity, sessionId) {
  const result = plainDataRecord(value, ["client", "instantiated_module", "response"],
    "M7 supervisor instantiation response");
  if (result.instantiated_module !== module) fail("supervisor ignored or substituted the exact compiled module");
  const response = plainDataRecord(result.response, ["status"],
    "M7 protocol-v5 instantiation response");
  if (response.status !== STATUS_OK) fail("M7 protocol-v5 instantiation response differs");
  const requestMethod = dataMethod(result.client, "request", "M7 protocol-v5 client");
  const client = Object.freeze({ request: (...args) => requestMethod(...args) });
  return Object.freeze({ client, transcript: recursivelySnapshotData({
    schema: "cadr-m7-p4-fast-owned-transcript-v2", session_id: sessionId,
    module: identity.build.wasm, request, response,
  }, "M7 owned protocol transcript") });
}

function validateDisposal(value, sessionId, testAuthority = false) {
  const disposal = plainDataRecord(value, ["pending_requests", "schema", "session_id", "terminated"],
    "M7 supervisor disposal");
  const expectedSchema = testAuthority ? "cadr-m7-p4-fast-disposal-test-v1" :
    "cadr-m7-p4-fast-disposal-v1";
  if (disposal.schema !== expectedSchema ||
      disposal.session_id !== sessionId || disposal.pending_requests !== 0 ||
      disposal.terminated !== true) fail("M7 supervisor disposal is incomplete");
  return recursivelySnapshotData(disposal, "M7 supervisor disposal");
}

function supervisorMethods(value) {
  const supervisor = plainDataRecord(value, ["dispose", "instantiate", "open"],
    "M7 private supervisor");
  for (const name of ["open", "instantiate", "dispose"]) {
    if (typeof supervisor[name] !== "function") fail("M7 private supervisor methods are invalid");
  }
  return supervisor;
}

function trustedWorkerSupervisor(testDomain = false) {
  const sessions = new WeakMap();
  return Object.freeze({
    open: async cleanupHandle => {
      const sessionId = `m7-${cleanupHandle.nonce}`;
      sessions.set(cleanupHandle, { worker: null, pending: new Map(), nextId: 1,
        sessionId, terminated: false });
      return { lease: cleanupHandle, session_id: sessionId };
    },
    instantiate: async (lease, { module, request }) => {
      const session = sessions.get(lease);
      if (session === undefined || session.worker !== null) fail("trusted supervisor lease is invalid");
      const worker = new Worker(WORKER_URL, { type: "module" });
      session.worker = worker;
      const rejectAll = error => {
        for (const waiter of session.pending.values()) {
          clearTimeout(waiter.timeout); waiter.reject(error);
        }
        session.pending.clear();
      };
      worker.on("message", message => {
        const waiter = session.pending.get(message?.id);
        if (waiter === undefined) return rejectAll(new Error("unsolicited trusted-worker response"));
        session.pending.delete(message.id); clearTimeout(waiter.timeout); waiter.resolve(message);
      });
      worker.on("error", rejectAll);
      worker.on("exit", code => {
        if (!session.terminated && code !== 0) rejectAll(new Error(`trusted worker exited ${code}`));
      });
      const client = Object.freeze({ request: (op, fields = {}) =>
        new Promise((resolveRequest, rejectRequest) => {
          const id = session.nextId++;
          const timeout = setTimeout(() => {
            session.pending.delete(id); rejectRequest(new Error(`trusted worker ${op} timed out`));
          }, 120_000);
          session.pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timeout });
          try { worker.postMessage({ version: 5, id, op, ...fields }); }
          catch (error) { session.pending.delete(id); clearTimeout(timeout); rejectRequest(error); }
        }) });
      const response = await client.request(request.op,
        { m6DiskEvidencePolicy: request.m6DiskEvidencePolicy, module });
      if (response?.type !== "cadr-response" || response.version !== 5 ||
          response.op !== request.op || !Number.isSafeInteger(response.status)) {
        fail("trusted worker returned a malformed instantiate response");
      }
      return { instantiated_module: module, client, response: { status: response.status } };
    },
    dispose: async lease => {
      const session = sessions.get(lease);
      if (session === undefined) fail("trusted supervisor cleanup capability is invalid");
      const pending = session.pending.size;
      for (const waiter of session.pending.values()) {
        clearTimeout(waiter.timeout); waiter.reject(new Error("trusted worker disposed"));
      }
      session.pending.clear();
      if (session.worker !== null) await session.worker.terminate();
      session.terminated = true;
      return { schema: testDomain ? "cadr-m7-p4-fast-disposal-test-v1" :
        "cadr-m7-p4-fast-disposal-v1", session_id: session.sessionId,
        pending_requests: pending === 0 ? 0 : session.pending.size, terminated: true };
    },
  });
}

/** Domain-separated test seam for the concrete supervisor implementation. */
export function createM7P4TrustedWorkerSupervisorForTest() {
  return trustedWorkerSupervisor(true);
}

function copyAndCompileModuleAfterAwait(moduleBytes, identity) {
  if (!(moduleBytes instanceof IntrinsicUint8Array)) {
    fail("selected staged M7-DEVID Wasm is not intrinsic bytes");
  }
  /* Copy *after* awaited revalidation and hash the copy immediately before
   * compilation.  No caller-owned ArrayBuffer is ever passed to Wasm. */
  const buffer = new IntrinsicArrayBuffer(moduleBytes.byteLength);
  const copy = new IntrinsicUint8Array(buffer);
  intrinsicUint8ArraySet(copy, moduleBytes);
  if (!(copy.buffer instanceof IntrinsicArrayBuffer) ||
      (typeof SharedArrayBuffer === "function" && copy.buffer instanceof SharedArrayBuffer)) {
    fail("owned M7-DEVID Wasm copy is not an ordinary non-shared buffer");
  }
  if (copy.byteLength !== identity.build.wasm.bytes ||
      sha256(copy) !== identity.build.wasm.sha256) {
    fail("selected staged M7-DEVID Wasm changed before compilation");
  }
  return moduleExports(copy);
}

async function hashProductionArtifact(artifact) {
  if (artifact === null || typeof artifact !== "object" ||
      typeof artifact.byteCount !== "bigint" || artifact.byteCount < 1n ||
      typeof artifact.readRange !== "function") {
    fail("production artifact hashing received an invalid source");
  }
  const hash = createHash("sha256");
  for (let offset = 0n; offset < artifact.byteCount; offset += 1_048_576n) {
    const length = artifact.byteCount - offset < 1_048_576n ?
      artifact.byteCount - offset : 1_048_576n;
    const bytes = await artifact.readRange(offset, length);
    if (!(bytes instanceof IntrinsicUint8Array) || BigInt(bytes.byteLength) !== length) {
      fail("production artifact hashing received a short range");
    }
    hash.update(bytes);
  }
  return new IntrinsicUint8Array(hash.digest());
}

export function addM7P4ProductionRunPolicyForTest(input) {
  return Object.freeze({ ...input,
    maxHostTransactions: CADR_M7_EFFECTIVE_PAGE_IDENTITY_MAX_HOST_TRANSACTIONS,
    hashArtifact: hashProductionArtifact,
  });
}

async function executeM7P4FastDifferentialInternal(config, {
  validateNative = validateM7P4NativeAuthority,
  run = runM7Ready4FastCheckpointedBoot,
  revalidatePreparation = revalidateM7P4FastPreparation,
} = {}, testAuthority = false) {
  const fields = ["artifacts", "maxBoundaries", "moduleBytes", "moduleIdentity",
    "nativeAuthority", "profile", "ready"];
  if (testAuthority) fields.push("authorityRoot", "supervisor");
  const input = plainDataRecord(config, fields,
  "M7 private differential input");
  const supervisor = testAuthority ? supervisorMethods(input.supervisor) : trustedWorkerSupervisor();
  const identity = validateM7P4FastPreparedIdentity(input.moduleIdentity);
  const initialBytes = input.moduleBytes instanceof Uint8Array ? input.moduleBytes : null;
  if (initialBytes === null || initialBytes.byteLength !== identity.build.wasm.bytes ||
      sha256(initialBytes) !== identity.build.wasm.sha256) {
    fail("selected staged M7-DEVID Wasm differs from its preparation receipt");
  }
  if (testAuthority) inspectM7P4AuthorityRootForTest(input.authorityRoot);
  const executionProvenance = validateExecutionProvenance(
    await revalidatePreparation(identity, initialBytes,
      testAuthority ? input.authorityRoot : undefined), identity, testAuthority);
  const native = await validateNative(input.nativeAuthority,
    testAuthority ? input.authorityRoot : undefined);
  const module = copyAndCompileModuleAfterAwait(input.moduleBytes, identity);
  const request = frozenCanonicalCopy({ version: 5, op: "instantiate", m6DiskEvidencePolicy: true });
  const preallocationCleanupHandle = Object.freeze({
    schema: "cadr-m7-p4-runner-cleanup-capability-v1",
    nonce: createHash("sha256").update(Buffer.from(identity.build.wasm.sha256, "hex"))
      .update(Buffer.from(String(process.hrtime.bigint()))).digest("hex"),
  });
  let lease = preallocationCleanupHandle; let sessionId = null;
  let primaryError = null; let result = null; let transcript = null;
  try {
    let acquired;
    try {
      acquired = await supervisor.open(preallocationCleanupHandle);
    } catch (openError) {
      /* The runner already owns the cleanup capability before open can
       * allocate.  A rejecting implementation cannot hide that capability. */
      throw openError;
    }
    const exposedLease = leaseFromMalformedAcquisition(acquired);
    if (exposedLease !== NO_LEASE) lease = exposedLease;
    const checkedAcquisition = validateAcquisition(acquired);
    lease = checkedAcquisition.lease; sessionId = checkedAcquisition.sessionId;
    const instantiated = await supervisor.instantiate(lease, { module, request, identity });
    const checked = validateInstantiation(instantiated, module, request, identity, sessionId);
    transcript = checked.transcript;
    const runConfig = { ...input, client: checked.client, nativeCapture: native.nativeFrame };
    result = await run(testAuthority ? runConfig :
      addM7P4ProductionRunPolicyForTest(runConfig));
  } catch (error) {
    primaryError = error;
  }
  let disposal = null;
  if (lease !== NO_LEASE) {
    try {
      const disposed = await supervisor.dispose(lease);
      if (sessionId === null) {
        /* An incomplete acquisition still must be terminated.  It cannot be
         * accepted as a successful disposal receipt without its session id. */
        const cleanup = plainDataRecord(disposed,
          ["pending_requests", "schema", "session_id", "terminated"],
          "M7 supervisor malformed-acquisition disposal");
        const cleanupSchema = testAuthority ? "cadr-m7-p4-fast-disposal-test-v1" :
          "cadr-m7-p4-fast-disposal-v1";
        if (cleanup.schema !== cleanupSchema ||
            typeof cleanup.session_id !== "string" || cleanup.session_id.length === 0 ||
            cleanup.pending_requests !== 0 || cleanup.terminated !== true) {
          fail("M7 malformed acquisition cleanup is not terminal and empty");
        }
      } else disposal = validateDisposal(disposed, sessionId, testAuthority);
    } catch (cleanupError) {
      if (primaryError !== null) throw new AggregateError([primaryError, cleanupError],
        "M7 execution failed and mandatory supervisor cleanup failed");
      throw cleanupError;
    }
  }
  if (primaryError !== null) throw primaryError;
  if (lease === NO_LEASE || disposal === null) fail("M7 supervisor acquired no disposable opaque lease");
  if (result.target !== CADR_M7_READY4_FAST_TARGET || result.contract !== CADR_M7_READY4_FAST_CONTRACT) {
    fail("M7 fast differential result has the wrong target or contract");
  }
  const identityAcknowledgementStreamSha256 =
    result.identityAcknowledgementStreamSha256 instanceof IntrinsicUint8Array ?
      result.identityAcknowledgementStreamSha256 : null;
  if (identityAcknowledgementStreamSha256 === null ||
      identityAcknowledgementStreamSha256.byteLength !== 32) {
    fail("M7 fast differential result lacks its identity stream digest");
  }
  const identityAcknowledgementStreamCount =
    result.identityAcknowledgementStream?.count;
  if (!Number.isSafeInteger(identityAcknowledgementStreamCount) ||
      identityAcknowledgementStreamCount < 1 ||
      identityAcknowledgementStreamCount > 1024 ||
      !Array.isArray(result.identityAcknowledgementStream.acknowledgements) ||
      result.identityAcknowledgementStream.acknowledgements.length !==
        identityAcknowledgementStreamCount) {
    fail("M7 fast differential result lacks its bounded identity stream count");
  }
  return Object.freeze({ ...result, nativeAuthority: native.receipt,
    executionReceipt: Object.freeze({ schema: "cadr-m7-p4-fast-execution-receipt-v4",
      provenance: executionProvenance,
      effective_page_identity_stream_sha256:
        Buffer.from(identityAcknowledgementStreamSha256).toString("hex"),
      effective_page_identity_stream_count: identityAcknowledgementStreamCount,
      p4_expected_closure_sha256: native.receipt.expected_closure_sha256,
      p4_manifest_sha256: native.receipt.manifest.sha256,
      protocol_transcript_sha256: canonicalDigest(transcript) }),
    supervisor: Object.freeze({ instantiation: transcript, disposal }) });
}

export async function executeM7P4FastDifferential(config) {
  /* Adopt fd3 before any caller/config validation so every early failure has
   * one terminal close/EOF path through the privileged peer. */
  try {
    productionAuthorityRpc();
    return await executeM7P4FastDifferentialInternal(config, {
      validateNative: validateNativeWithPrivilegedAuthority,
      revalidatePreparation: revalidateWithPrivilegedAuthority,
      run: runM7Ready4FastCheckpointedBoot,
    }, false);
  } finally {
    await closeProductionAuthorityRpc();
  }
}

export async function executeM7P4FastDifferentialForTest(config, dependencies) {
  return executeM7P4FastDifferentialInternal(config, dependencies, true);
}

export function parseM7P4FastArguments(argv) {
  if (argv.length === 1 && argv[0] === "--help") return Object.freeze({ help: true });
  if (argv.length !== 1 || argv[0] !== "--precommit") {
    fail("only --precommit is available; root-owned descriptors select the source and tools");
  }
  return Object.freeze({ help: false });
}

async function main() {
  const options = parseM7P4FastArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("usage: root-supervisor node scripts/run-cadr-m7-p4-fast-differential.mjs --precommit\n");
    return;
  }
  /* A normal shell has no right to manufacture the descriptor capability. */
  fail("--precommit requires a root-owned M7 P4 descriptor capability");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`M7 P4 fast precommit failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
