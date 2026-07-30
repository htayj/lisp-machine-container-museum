#!/usr/bin/env node
/*
 * Offline, no-replace reconstruction of the final M7-DEVID O2 canary
 * receipt. This is not a retry. It reads the two retained 776a427 records,
 * derives a receipt from their raw canonical bytes, and publishes only that
 * exact derivation after independent pre- and post-publication rereads.
 */
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EXPECTED, RAW_ENVELOPE_NAME, RAW_OUTER_FAILURE_NAME,
  RECOVERY_TOOL_MODULE_PATHS, assertRecoveredM7ReceiptMatchesRawBuffers,
  canonicalJson, deriveM7RecoveryReceiptFromRawBuffers, exactDeepEqual,
  identity, parseCanonicalJson, sha256, validateRecoveryToolClosure,
} from "./cadr-m7-devid-o2-recovery-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOL_PATH = "scripts/recover-cadr-m7-devid-o2-canary.mjs";
const CORE_PATH = "scripts/cadr-m7-devid-o2-recovery-core.mjs";
const LOCAL_MODULES = Object.freeze([
  Object.freeze({ path: TOOL_PATH, file: fileURLToPath(import.meta.url) }),
  Object.freeze({ path: CORE_PATH,
    file: fileURLToPath(new URL("./cadr-m7-devid-o2-recovery-core.mjs", import.meta.url)) }),
]);
exactDeepEqual(LOCAL_MODULES.map(module => module.path), RECOVERY_TOOL_MODULE_PATHS,
  "M7 recovery local ESM closure order");
const RECOVERY_DIRECTORY = resolve(ROOT, "build/cadr-oracle/m7-devid-p4-776a427");
const ORDINARY_FINAL_NAME = "final-receipt.json";
const usage = "usage: node scripts/recover-cadr-m7-devid-o2-canary.mjs --execute --recovery-tool-commit COMMIT --output build/cadr-oracle/m7-devid-p4-776a427/RECOVERY.json";

function git(args, options = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"] });
}

function revision(revisionName) {
  return git(["rev-parse", "--verify", `${revisionName}^{commit}`]).trim();
}

function expectDirectRecoveryChild(path, label) {
  if (dirname(path) !== RECOVERY_DIRECTORY || relative(RECOVERY_DIRECTORY, path).startsWith("..")) {
    throw new Error(`${label} must be directly contained by the private M7 recovery directory`);
  }
}

async function assertPrivateDirectory(path) {
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== process.geteuid() ||
      (metadata.mode & 0o777) !== 0o700) {
    throw new Error("M7 recovery directory must be an euid-owned nonsymlink mode-0700 directory");
  }
}

async function secureRead(path, expected, label) {
  /* O_NOFOLLOW and fstat bind the bytes to the opened regular inode, rather
   * than merely trusting a prior pathname lstat. The post-read fstat catches
   * truncation of that inode during the read. */
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.uid !== process.geteuid() ||
        (before.mode & 0o777) !== 0o600) {
      throw new Error(`${label} must be an euid-owned mode-0600 regular file`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs) {
      throw new Error(`${label} changed while it was read`);
    }
    const actual = identity(bytes);
    exactDeepEqual(actual, expected, `${label} identity`);
    return Object.freeze({ bytes, identity: actual });
  } finally {
    await handle?.close();
  }
}

async function assertAbsent(path, label) {
  try {
    await lstat(path);
    throw new Error(`${label} already exists`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function committedRecoveryToolClosure(commitName) {
  const commit = revision(commitName);
  const modules = [];
  for (const module of LOCAL_MODULES) {
    const [committed, local] = await Promise.all([
      Promise.resolve(git(["show", `${commit}:${module.path}`], { encoding: "buffer" })),
      readFile(module.file),
    ]);
    const committedIdentity = identity(committed);
    exactDeepEqual(committedIdentity, identity(local),
      `recovery closure module ${module.path}`);
    modules.push(Object.freeze({ path: module.path, identity: committedIdentity }));
  }
  const closure = Object.freeze({ commit, modules: Object.freeze(modules) });
  validateRecoveryToolClosure(closure);
  return closure;
}

function sourceClosureFromGit(base, candidate, patchPaths) {
  const tracked = git(["ls-tree", "-r", "--name-only", base]).trim().split("\n").filter(Boolean);
  const paths = [...new Set([...tracked, ...patchPaths])].sort();
  const patched = new Set(patchPaths);
  const accumulator = requireHash();
  let totalByteCount = 0;
  for (const path of paths) {
    const bytes = git(["show", `${patched.has(path) ? candidate : base}:${path}`], { encoding: "buffer" });
    const pathBytes = Buffer.from(path, "utf8");
    const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(pathBytes.byteLength), 0);
    header.writeBigUInt64LE(BigInt(bytes.byteLength), 8);
    accumulator.update(header).update(pathBytes).update(Buffer.from(sha256(bytes), "hex"));
    totalByteCount += bytes.byteLength;
  }
  return Object.freeze({ schema: "cadr-m6-stage-source-closure-v1", file_count: paths.length,
    total_byte_count: totalByteCount, sha256: accumulator.digest("hex") });
}

function requireHash() {
  /* The pure core owns SHA-256 values. This tiny local accumulator uses the
   * same Node primitive without importing a canary or guest-capable module. */
  const chunks = [];
  return {
    update(chunk) { chunks.push(Buffer.from(chunk)); return this; },
    digest() { return sha256(Buffer.concat(chunks)); },
  };
}

function faultyCandidateClosure(base, candidate, patchPaths) {
  const tracked = git(["ls-tree", "-r", "--name-only", base]).trim().split("\n").filter(Boolean);
  const paths = [...new Set([...tracked, ...patchPaths])].sort();
  const accumulator = requireHash();
  let totalByteCount = 0;
  for (const path of paths) {
    const bytes = git(["show", `${candidate}:${path}`], { encoding: "buffer" });
    const pathBytes = Buffer.from(path, "utf8");
    const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(pathBytes.byteLength), 0);
    header.writeBigUInt64LE(BigInt(bytes.byteLength), 8);
    accumulator.update(header).update(pathBytes).update(Buffer.from(sha256(bytes), "hex"));
    totalByteCount += bytes.byteLength;
  }
  return Object.freeze({ schema: "cadr-m6-stage-source-closure-v1", file_count: paths.length,
    total_byte_count: totalByteCount, sha256: accumulator.digest("hex") });
}

/* Read-only audit hook. It cannot publish anything and still requires the
 * exact retained paths and raw identities. The executable recovery path first
 * obtains a committed closure before calling it. */
export async function deriveM7RecoveryReceiptFromRetainedRaw(recoveryTool) {
  const [envelope, outerFailure] = await Promise.all([
    secureRead(resolve(RECOVERY_DIRECTORY, RAW_ENVELOPE_NAME), EXPECTED.envelope,
      "retained M7 child envelope"),
    secureRead(resolve(RECOVERY_DIRECTORY, RAW_OUTER_FAILURE_NAME), EXPECTED.outerFailure,
      "retained M7 outer failure"),
  ]);
  const corrected = sourceClosureFromGit(EXPECTED.base, EXPECTED.candidate, EXPECTED.patchPaths);
  const faulty = faultyCandidateClosure(EXPECTED.base, EXPECTED.candidate, EXPECTED.patchPaths);
  if (!Object.is(corrected.sha256, EXPECTED.correctedClosure.sha256) ||
      !Object.is(faulty.sha256, EXPECTED.faultyClosureSha256) ||
      Object.is(corrected.sha256, faulty.sha256) ||
      !Object.is(corrected.file_count, EXPECTED.correctedClosure.file_count) ||
      !Object.is(corrected.total_byte_count, EXPECTED.correctedClosure.total_byte_count)) {
    throw new Error("M7 recovery cannot reproduce the exact validator defect and correction");
  }
  return Object.freeze({ raw: Object.freeze({ envelopeBytes: envelope.bytes,
    outerFailureBytes: outerFailure.bytes }),
    receipt: assertRecoveredM7ReceiptMatchesRawBuffers(
      /* Derive first; the second call is the explicit exact comparison against
       * the same raw records, not acceptance of a caller-embedded structure. */
      deriveM7RecoveryReceiptFromRawBuffers({ envelopeBytes: envelope.bytes,
        outerFailureBytes: outerFailure.bytes, recoveryTool }),
      { envelopeBytes: envelope.bytes, outerFailureBytes: outerFailure.bytes }, recoveryTool),
  });
}

export function parseRecoveryInvocation(argv) {
  const result = { execute: false, recoveryToolCommit: null, output: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return Object.freeze({ help: true });
    if (argument === "--execute") {
      if (seen.has(argument)) throw new TypeError("--execute was supplied twice");
      seen.add(argument); result.execute = true; continue;
    }
    if (!["--recovery-tool-commit", "--output"].includes(argument) || seen.has(argument)) {
      throw new TypeError(`unsupported or duplicate recovery argument ${JSON.stringify(argument)}`);
    }
    seen.add(argument);
    const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${argument} needs a nonempty value`);
    if (argument === "--recovery-tool-commit") result.recoveryToolCommit = value;
    else result.output = resolve(process.cwd(), value);
  }
  if (!result.execute || result.recoveryToolCommit === null || result.output === null) {
    throw new TypeError(`${usage}\nNo recovery is implicit; explicit execution, a committed tool closure, and a new output are required.`);
  }
  return Object.freeze(result);
}

export async function validateRecoveredM7DevidCanaryReceipt(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("M7 recovery receipt must be an object");
  }
  validateRecoveryToolClosure(value.recovery_tool);
  return verifyRecoveredM7DevidCanaryReceipt(value);
}

export async function verifyRecoveredM7DevidCanaryReceipt(value) {
  validateRecoveryToolClosure(value?.recovery_tool);
  const recoveryTool = await committedRecoveryToolClosure(value.recovery_tool.commit);
  const derived = await deriveM7RecoveryReceiptFromRetainedRaw(recoveryTool);
  exactDeepEqual(value, derived.receipt, "M7 recovery receipt");
  return derived.receipt;
}

async function writeCanonicalNoReplaceReceipt(path, value) {
  const bytes = Buffer.from(canonicalJson(value), "utf8");
  let handle;
  try {
    handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
      constants.O_NOFOLLOW, 0o600);
    await handle.chmod(0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle?.close();
  }
  return identity(bytes);
}

export async function recoverM7DevidCanaryReceipt({ output, recoveryToolCommit }) {
  expectDirectRecoveryChild(output, "recovery output");
  if (output === resolve(RECOVERY_DIRECTORY, ORDINARY_FINAL_NAME)) {
    throw new Error("recovery refuses to publish an ordinary final-receipt path");
  }
  await assertPrivateDirectory(RECOVERY_DIRECTORY);
  await assertAbsent(resolve(RECOVERY_DIRECTORY, ORDINARY_FINAL_NAME), "ordinary M7 final receipt");
  await assertAbsent(output, "recovery receipt output");
  if ([RAW_ENVELOPE_NAME, RAW_OUTER_FAILURE_NAME].includes(relative(RECOVERY_DIRECTORY, output))) {
    throw new Error("recovery output must not name either retained raw witness");
  }
  const recoveryTool = await committedRecoveryToolClosure(recoveryToolCommit);
  const beforePublication = await deriveM7RecoveryReceiptFromRetainedRaw(recoveryTool);
  /* A second independently opened pair prevents a validated, then replaced,
   * witness from being named by the publication. */
  const immediatelyBeforePublication = await deriveM7RecoveryReceiptFromRetainedRaw(recoveryTool);
  exactDeepEqual(beforePublication.receipt, immediatelyBeforePublication.receipt,
    "M7 recovery pre-publication derivation");
  const written = await writeCanonicalNoReplaceReceipt(output, beforePublication.receipt);
  const published = await secureRead(output, written, "published M7 recovery receipt");
  const publishedValue = parseCanonicalJson(published.bytes, "published M7 recovery receipt");
  const afterPublication = await deriveM7RecoveryReceiptFromRetainedRaw(recoveryTool);
  exactDeepEqual(publishedValue, afterPublication.receipt,
    "published M7 recovery receipt after raw reread");
  return Object.freeze({ receipt: afterPublication.receipt, identity: written });
}

async function main() {
  const options = parseRecoveryInvocation(process.argv.slice(2));
  if (options.help === true) {
    process.stdout.write(`${usage}\nThis tool reads only the retained 776a427 M7 envelope/failure pair; it has no retry, system manager, guest, browser, or native CADR execution path.\n`);
    return;
  }
  const recovered = await recoverM7DevidCanaryReceipt(options);
  process.stdout.write(`${canonicalJson({ outcome: "recovered-final-receipt",
    receipt: recovered.identity, receipt_path: relative(ROOT, options.output) })}\n`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
