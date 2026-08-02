import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, open, readFile, readdir, readlink, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  CADR_M6_DEVID_PROFILE,
  CADR_M6_FORM_C,
  CADR_M6_READY4_CONTRACT,
  appendM6FastCheckpoint,
  appendM6FastHostWait,
  canonicalM6ReadyWitness,
  canonicalM6ReadyWitnessV4,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M7_FORM_C_BOUNDARY,
} from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";
import {
  CADR_M7_READY4_FAST_CONTRACT,
  CADR_M7_READY4_FAST_MINIMUM_SPANS,
  CADR_M7_READY4_FAST_TARGET,
  CadrM7Ready4FastBoundaryClient,
  runM7Ready4FastCheckpointedBootForTest,
  validateM7Ready4FastModuleIdentity,
} from "../cadr-web/wasm/cadr-m7-ready4-fast-checkpoint.mjs";
import {
  M7_P4_FAST_REQUIRED_AUTHORITIES,
  M7_P4_FAST_WORKER_TRANSITIVE_MODULES,
  createM7P4AuthorityRpcForTest,
  createM7P4FastModuleIdentity,
  createM7P4TrustedWorkerSupervisorForTest,
  executeM7P4FastDifferential,
  executeM7P4FastDifferentialForTest,
  parseM7P4FastArguments,
  selectM7P4FrozenExpectedClosure,
  validateM7P4NativeAuthority,
  validateM7P4FastPreparedIdentity,
} from "../scripts/run-cadr-m7-p4-fast-differential.mjs";
import { captureM7P4SignedArchiveForTest, closeM7P4AuthorityRootForTest,
  deriveM7P4SignedArchiveBound, M7_P4_MAX_ARCHIVE_BYTES, M7_P4_MAX_SOURCE_BLOB_BYTES,
  M7_P4_MAX_SOURCE_BYTES, isM7P4UstarHeaderPathRepresentableForTest,
  inspectM7P4AuthorityRootForTest,
  openM7P4AuthorityRootForTest, revalidateM7P4GuixEndpointForTest,
  validateM7P4CheckoutAncestorsForTest, validateM7P4CheckoutTreeForTest,
  validateM7P4ImmediateLauncherParentForTest,
  validateM7P4InitialUserNamespaceForTest,
  validateM7P4InstalledLauncherReceiptForTest,
  validateM7P4ProductionRepositoryConfigForTest } from
  "../scripts/cadr-m7-p4-authority-root.mjs";
import { canonicalJson } from "../scripts/run-cadr-m6-devid-o2-canary.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SLOTS = 1_048_576;
const C_PREFIX_SPANS = 937;
const AUTHORITY_FD_CLEANUP_TIMEOUT_MS = 2000;
const H = value => new Uint8Array(32).fill(value);
const digest = bytes => new Uint8Array(createHash("sha256").update(bytes).digest());

async function boundedAuthorityCleanup(promise, label) {
  let timeout = null;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(
        `M7 authority fd cleanup timed out waiting for ${label}`)),
      AUTHORITY_FD_CLEANUP_TIMEOUT_MS);
    })]);
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
}

async function liveSocketOwnersForTest(socketLink) {
  const owners = [];
  for (const process of await readdir("/proc", { withFileTypes: true })) {
    if (!process.isDirectory() || !/^[0-9]+$/.test(process.name)) continue;
    const directory = `/proc/${process.name}/fd`;
    let descriptors;
    try { descriptors = await readdir(directory); } catch { continue; }
    for (const descriptor of descriptors) {
      try {
        if (await readlink(`${directory}/${descriptor}`) === socketLink) {
          owners.push(`${process.name}/${descriptor}`);
        }
      } catch {
        /* Processes can exit while the /proc scan is in flight. */
      }
    }
  }
  return owners.sort();
}
const runnerSource = await readFile(new URL(
  "../scripts/run-cadr-m7-p4-fast-differential.mjs", import.meta.url), "utf8");
const authorityRootSource = await readFile(new URL(
  "../scripts/cadr-m7-p4-authority-root.mjs", import.meta.url), "utf8");
const M7_DEVID_DIAGNOSTIC_O2 = Object.freeze({
  sha256: "fd8f10188c3c7f45d93083869be42798e7c3bc91d331d908f36d0b42300604a0",
  bytes: 122268,
});
assert.match(authorityRootSource, new RegExp(
  `const M7_P4_FIXED_MODULE_SHA256 =\\s*"${M7_DEVID_DIAGNOSTIC_O2.sha256}";`));
assert.match(authorityRootSource, new RegExp(
  `const M7_P4_FIXED_MODULE_BYTES = ${M7_DEVID_DIAGNOSTIC_O2.bytes};`));
assert.match(runnerSource, /--precommit/);
assert.match(runnerSource,
  /const CLOSED_O2_SCRIPT[\s\S]*?-DCADR_M7_DEVID_WASM \\/,
  "the authoritative P4 compiler enables the diagnostic-bearing M7-DEVID profile");
assert.doesNotMatch(runnerSource,
  /spawn\(["'](?:git|guix|tar|sh)["']/,
  "the direct M7 P4 command has no ambient tool launch primitive");
assert.match(runnerSource, /function trustedWorkerSupervisor\(testDomain = false\)/,
  "production execution owns one concrete worker supervisor rather than accepting a caller object");
assert.match(runnerSource, /spawn\("\/proc\/self\/fd\/3"/,
  "Git and Guix execute only through the inherited root-owned descriptor");
assert.doesNotMatch(runnerSource, /\["ls-tree"/,
  "post-snapshot staging uses only the signed archive inventory and never live Git");
assert.ok(deriveM7P4SignedArchiveBound([
  { path: "exact-boundary.bin", bytes: M7_P4_MAX_SOURCE_BLOB_BYTES },
]).archive_bytes > M7_P4_MAX_SOURCE_BLOB_BYTES,
"the exact selected-profile blob boundary has a finite derived archive bound");
assert.throws(() => deriveM7P4SignedArchiveBound([
  { path: "one-byte-oversize.bin", bytes: M7_P4_MAX_SOURCE_BLOB_BYTES + 1 },
]), /oversized/,
"one byte over the selected-profile blob boundary is rejected before archive creation");
const exactAggregateInventory = Array.from({ length: M7_P4_MAX_SOURCE_BYTES /
  M7_P4_MAX_SOURCE_BLOB_BYTES }, (_, index) =>
  ({ path: `aggregate-${index}.bin`, bytes: M7_P4_MAX_SOURCE_BLOB_BYTES }));
assert.equal(deriveM7P4SignedArchiveBound(exactAggregateInventory).source_bytes,
  M7_P4_MAX_SOURCE_BYTES,
"the exact selected-profile aggregate source boundary is accepted");
assert.throws(() => deriveM7P4SignedArchiveBound([
  ...exactAggregateInventory, { path: "aggregate-plus-one.bin", bytes: 1 },
]), /aggregate byte bound/,
"one byte over the aggregate source boundary is rejected before archive creation");
assert.doesNotThrow(() => deriveM7P4SignedArchiveBound([
  { path: `${"d".repeat(99)}/file`, bytes: 1 },
]), "a 99-byte root directory plus emitted slash remains ustar-representable");
for (const length of [100, 101]) {
  assert.throws(() => deriveM7P4SignedArchiveBound([
    { path: `${"d".repeat(length)}/file`, bytes: 1 },
  ]), /directory requires unsupported PAX/,
  `${length}-byte root directory plus emitted slash is rejected before archive creation`);
}
const nestedPrefix = `${"p".repeat(54)}/${"q".repeat(99)}`;
assert.equal(isM7P4UstarHeaderPathRepresentableForTest(
  `${nestedPrefix}/${"n".repeat(99)}/`), true,
"nested ustar directory header accepts Git's 154-byte prefix boundary");
assert.equal(isM7P4UstarHeaderPathRepresentableForTest(
  `${nestedPrefix}/${"n".repeat(100)}/`), false,
"nested ustar directory header rejects a slash-terminated 100-byte name");
assert.equal(isM7P4UstarHeaderPathRepresentableForTest(
  `${"p".repeat(55)}/${"q".repeat(99)}/${"n".repeat(99)}/`), false,
"nested ustar directory header rejects Git's 155-byte prefix overflow");
assert.doesNotThrow(() => deriveM7P4SignedArchiveBound([
  { path: `p/${"n".repeat(99)}/file`, bytes: 1 },
]), "nested signed path keeps both slash-terminated directory and child file representable");
assert.throws(() => deriveM7P4SignedArchiveBound([
  { path: `p/${"n".repeat(100)}/file`, bytes: 1 },
]), /directory requires unsupported PAX/,
"nested signed path isolates directory trailing-slash overflow while child file remains representable");
assert.doesNotThrow(() => deriveM7P4SignedArchiveBound([
  { path: `${nestedPrefix}/${"n".repeat(95)}/file`, bytes: 1 },
]), "nested signed file accepts the exact total-255 prefix-154 and suffix-100 boundary");
assert.throws(() => execFileSync(process.execPath,
  [resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs"), "--serve-inherited"],
  { cwd: ROOT, stdio: "pipe" }), /Command failed/,
"an unprivileged caller cannot spawn a production authority server even with the right mode flag");
assert.throws(() => execFileSync(process.execPath,
  [resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs"), "--serve-inherited-test"],
  { cwd: ROOT, stdio: "pipe" }), /Command failed/,
"the synthetic topology also rejects omitted inherited descriptors");

{
  const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-root-preflight-test-"));
  try {
    const actualNamespace = await validateM7P4InitialUserNamespaceForTest({
      selfNamespace: "/proc/self/ns/user", initNamespace: "/proc/self/ns/user",
      uidMap: "/proc/self/uid_map", gidMap: "/proc/self/gid_map" });
    assert.ok(actualNamespace.namespace.dev > 0 && actualNamespace.namespace.ino > 0,
      "the host exposes user namespace descriptors with stable fstat identity semantics");
    assert.deepEqual([actualNamespace.uid_map.inside, actualNamespace.uid_map.outside,
      actualNamespace.uid_map.length], ["0", "0", "4294967295"],
    "this host's actual uid_map is the complete initial range");
    const namespace = resolve(fixture, "initial-user-namespace");
    const otherNamespace = resolve(fixture, "other-user-namespace");
    const uidMap = resolve(fixture, "uid_map"); const gidMap = resolve(fixture, "gid_map");
    await writeFile(namespace, "namespace\n"); await writeFile(otherNamespace, "other\n");
    await writeFile(uidMap, "         0          0 4294967295\n");
    await writeFile(gidMap, "0 0 4294967295\n");
    const initial = await validateM7P4InitialUserNamespaceForTest({
      selfNamespace: namespace, initNamespace: namespace, uidMap, gidMap });
    assert.equal(initial.namespace.ino, (await stat(namespace)).ino,
      "the initial-user-namespace seam retains the descriptor identity");
    await assert.rejects(validateM7P4InitialUserNamespaceForTest({
      selfNamespace: namespace, initNamespace: otherNamespace, uidMap, gidMap }),
    /PID 1's initial user namespace/,
    "uid 0 in a distinct user namespace is rejected");
    await writeFile(uidMap, "0 1000 1\n");
    await assert.rejects(validateM7P4InitialUserNamespaceForTest({
      selfNamespace: namespace, initNamespace: namespace, uidMap, gidMap }),
    /complete initial-user-namespace identity map/,
    "a remapped uid 0 range is rejected");

    const trust = resolve(fixture, "trusted-root");
    const parent = resolve(trust, "parent"); const checkout = resolve(parent, "checkout");
    await mkdir(checkout, { recursive: true });
    await chmod(trust, 0o700); await chmod(parent, 0o700); await chmod(checkout, 0o700);
    const ancestors = await validateM7P4CheckoutAncestorsForTest(
      checkout, trust, process.getuid());
    assert.equal(ancestors.length, 3,
      "descriptor walk pins its trust root, each ancestor, and the checkout");
    await chmod(parent, 0o722);
    await assert.rejects(validateM7P4CheckoutAncestorsForTest(
      checkout, trust, process.getuid()), /non-writable directory/,
    "a group/other-writable checkout ancestor is rejected");
    await chmod(parent, 0o700);
    await assert.rejects(validateM7P4CheckoutAncestorsForTest(
      checkout, trust, process.getuid() + 1), /owner-pinned/,
    "an ancestor owned by a different uid is rejected");
    const linked = resolve(trust, "linked-checkout"); await symlink(checkout, linked);
    await assert.rejects(validateM7P4CheckoutAncestorsForTest(
      linked, trust, process.getuid()), /ELOOP|symbolic link|not a directory/i,
    "a symlink checkout component is rejected by the descriptor walk");

    const tree = resolve(fixture, "tree-checkout");
    await mkdir(resolve(tree, ".git/objects/info"), { recursive: true });
    await writeFile(resolve(tree, ".git/HEAD"), "ref: refs/heads/main\n", { mode: 0o600 });
    await writeFile(resolve(tree, "tracked.txt"), "tracked\n", { mode: 0o600 });
    for (const directory of [tree, resolve(tree, ".git"), resolve(tree, ".git/objects"),
      resolve(tree, ".git/objects/info")]) await chmod(directory, 0o700);
    assert.ok((await validateM7P4CheckoutTreeForTest(tree, process.getuid()))
      .some(identity => identity.path === ".git/objects"),
    "complete checkout validation retains the in-tree object-store descriptor");
    await chmod(resolve(tree, ".git/HEAD"), 0o622);
    await assert.rejects(validateM7P4CheckoutTreeForTest(tree, process.getuid()),
      /non-writable regular file/,
    "group/other-writable Git metadata is rejected");
    await chmod(resolve(tree, ".git/HEAD"), 0o600);
    await writeFile(resolve(tree, ".git/objects/info/alternates"), "/untrusted/objects\n",
      { mode: 0o600 });
    await assert.rejects(validateM7P4CheckoutTreeForTest(tree, process.getuid()),
      /forbidden external or nested Git dependency/,
    "Git alternates are rejected instead of recursively trusting an external object store");
    await unlink(resolve(tree, ".git/objects/info/alternates"));
    await symlink("tracked.txt", resolve(tree, "tracked-link"));
    await assert.rejects(validateM7P4CheckoutTreeForTest(tree, process.getuid()),
      /symlink or special file/,
    "symlinks are rejected throughout the retained checkout dependency closure");
    await unlink(resolve(tree, "tracked-link"));
    const fifo = resolve(tree, "blocking-fifo");
    execFileSync("/usr/bin/mkfifo", [fifo]);
    const fifoStarted = Date.now();
    await assert.rejects(validateM7P4CheckoutTreeForTest(tree, process.getuid()),
      /non-writable regular file|symlink or special file/,
    "a FIFO is rejected without blocking the descriptor-safe checkout traversal");
    assert.ok(Date.now() - fifoStarted < 2000,
      "O_NONBLOCK prevents an unknown FIFO entry from hanging authority selection");
    await unlink(fifo);
    await assert.rejects(validateM7P4CheckoutTreeForTest(
      tree, process.getuid(), { maxEntries: 2, maxDepth: 128 }),
    /exceeds its bounded policy/,
    "the entry immediately beyond the selected traversal cap is refused before opening");

    /* This reader emits one name per read.  The fourth is a FIFO: the tree
     * pin must refuse on the exact global cap after four reads, without asking
     * for another name or opening that excess special entry.  A materializing
     * readdir(...).sort() implementation cannot satisfy this reader contract. */
    const boundedTree = resolve(fixture, "bounded-enumeration");
    await mkdir(boundedTree);
    for (const name of ["safe-one", "safe-two", "safe-three"]) {
      await writeFile(resolve(boundedTree, name), `${name}\n`, { mode: 0o600 });
    }
    const excessFifo = resolve(boundedTree, "must-not-open-fifo");
    execFileSync("/usr/bin/mkfifo", [excessFifo]);
    const boundedNames = ["safe-one", "safe-two", "safe-three", "must-not-open-fifo"];
    let directoryFactoryCalls = 0; let directoryReadCalls = 0; let directoryCloseCalls = 0;
    await assert.rejects(validateM7P4CheckoutTreeForTest(
      boundedTree, process.getuid(), {
        maxEntries: 3, maxDepth: 128,
        openDirectoryForTest: async path => {
          assert.match(path, /^\/proc\/self\/fd\/[0-9]+$/);
          directoryFactoryCalls += 1;
          return {
            read: async () => {
              directoryReadCalls += 1;
              return directoryReadCalls <= boundedNames.length ?
                { name: boundedNames[directoryReadCalls - 1] } : null;
            },
            close: async () => { directoryCloseCalls += 1; },
          };
        },
      }), /exceeds its bounded policy/,
    "streaming enumeration refuses the first excess name before opening its FIFO");
    assert.equal(directoryFactoryCalls, 1);
    assert.equal(directoryReadCalls, 4,
      "the bounded reader retains only three admitted names and one refusal probe");
    assert.equal(directoryCloseCalls, 1,
      "the one-at-a-time directory reader closes on partial traversal failure");
  } finally { await rm(fixture, { recursive: true, force: true }); }
}

{
  const minimal = Buffer.from("core.repositoryformatversion\n0\0core.filemode\ntrue\0" +
    "core.bare\nfalse\0core.logallrefupdates\ntrue\0");
  assert.deepEqual(validateM7P4ProductionRepositoryConfigForTest(minimal),
    ["core.bare", "core.filemode", "core.logallrefupdates", "core.repositoryformatversion"],
  "production accepts only its exact minimal local Git configuration");
  await assert.rejects(async () => validateM7P4ProductionRepositoryConfigForTest(
    Buffer.concat([minimal, Buffer.from("core.fsmonitor\n/usr/bin/id\0")])),
  /not hermetic \(core.fsmonitor\)/,
  "production rejects a repository-local fsmonitor command");
}

{
  const sourceA = "a".repeat(40); const other = "b".repeat(40);
  const rawCommit = parents => Buffer.from(`tree ${"c".repeat(40)}\n${
    parents.map(parent => `parent ${parent}\n`).join("")}author Test <test@example.invalid> 0 +0000\n` +
    `committer Test <test@example.invalid> 0 +0000\n\nrelease\n`);
  const oid = bytes => createHash("sha1").update(Buffer.from(`commit ${bytes.byteLength}\0`))
    .update(bytes).digest("hex");
  const immediate = rawCommit([sourceA]);
  assert.equal(validateM7P4ImmediateLauncherParentForTest(
    immediate, oid(immediate), sourceA), sourceA,
  "release B accepts receipt source A only as its sole immediate parent");
  const descendant = rawCommit([other]);
  assert.throws(() => validateM7P4ImmediateLauncherParentForTest(
    descendant, oid(descendant), sourceA), /exact single immediate parent/,
  "a non-immediate descendant cannot reuse an older receipt source");
  const merge = rawCommit([sourceA, other]);
  assert.throws(() => validateM7P4ImmediateLauncherParentForTest(
    merge, oid(merge), sourceA), /exact single immediate parent/,
  "a merge release cannot satisfy the exact A-to-B policy");
}

function nativeRecord() {
  const activeWords = 23_112;
  const bytes = new Uint8Array(64 + activeWords * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM7N1"));
  view.setUint32(8, 1, true); view.setUint32(12, 64, true);
  view.setBigUint64(16, CADR_M7_FORM_C_BOUNDARY, true);
  view.setUint32(24, 768, true); view.setUint32(28, 963, true);
  view.setUint32(32, 4, true); view.setUint32(36, 1, true);
  view.setUint32(40, 32_768, true); view.setUint32(44, activeWords, true);
  view.setUint32(48, activeWords * 4, true);
  return bytes;
}

function displayRecord() {
  const activeWords = 23_112;
  const bytes = new Uint8Array(96 + activeWords * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRDISP1"));
  view.setUint16(8, 1, true); view.setUint16(10, 80, true);
  view.setUint32(12, 1, true); view.setBigUint64(16, 1n, true);
  view.setBigUint64(24, 1n, true); view.setUint32(32, 768, true);
  view.setUint32(36, 963, true); view.setUint32(40, 24, true);
  view.setUint32(44, 32_768, true); view.setUint32(48, activeWords, true);
  view.setUint32(52, 4, true); view.setUint32(56, 1, true);
  view.setUint32(60, activeWords, true);
  view.setBigUint64(64, BigInt(activeWords * 4), true);
  view.setBigUint64(72, BigInt(bytes.byteLength), true);
  view.setUint32(88, 768, true); view.setUint32(92, 963, true);
  return bytes;
}

function witnessRecord() {
  const bytes = new Uint8Array(96); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6I1"));
  view.setBigUint64(8, CADR_M6_FORM_C, true);
  view.setUint32(68, 0x18_000, true); view.setUint32(72, 3, true);
  view.setUint32(84, 1, true);
  return bytes;
}

function evidenceSummary() {
  const bytes = new Uint8Array(512); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6E1"));
  view.setUint32(8, 1, true); view.setUint32(12, 512, true);
  view.setUint32(16, 1, true); view.setUint32(20, 1, true);
  view.setUint32(24, 512, true); view.setUint32(28, 512, true);
  view.setBigUint64(32, 0x7fff_ffff_ffff_ffffn, true);
  view.setBigUint64(40, 513n, true); view.setBigUint64(48, 1n, true);
  view.setBigUint64(56, 512n, true); view.setBigUint64(88, 513n, true);
  bytes.fill(0x11, 240, 272); bytes.fill(0x22, 272, 304);
  return bytes;
}

function fastRecord({ before, after, reason, debugBefore, debugAfter,
  requestedSlots = Number(after - before), terminalStatus = 0,
  outstandingRequestId = 0n }) {
  const bytes = new Uint8Array(128); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6FAST1"));
  view.setUint32(16, 1, true); view.setUint32(20, 128, true);
  view.setUint32(24, reason, true); view.setUint32(28, terminalStatus, true);
  view.setUint32(32, requestedSlots, true);
  view.setBigUint64(40, after - before, true); view.setBigUint64(48, after - before, true);
  view.setBigUint64(56, before, true); view.setBigUint64(64, after, true);
  view.setBigUint64(72, debugBefore, true); view.setBigUint64(80, debugAfter, true);
  view.setUint32(88, 0, true); view.setUint32(92, 2, true);
  view.setBigUint64(96, outstandingRequestId, true);
  return Object.freeze({ status: 0, wireSchema: "CDRM6FAST1", fastRun: bytes,
    reason, terminalStatus, requestedSlots,
    completedSlots: after - before, microinstructionDelta: after - before,
    preBoundary: before, postBoundary: after, debugBefore, debugAfter,
    persistentStatus: 0, coreLifecycle: 2, outstandingRequestId });
}

function machineInfo(boundary) {
  const bytes = new Uint8Array(64);
  new DataView(bytes.buffer).setBigUint64(8, boundary, true);
  return { status: 0, info: bytes };
}

class FastClient {
  constructor({ crossBoundary = false, badDisplay = false, hostWait = false,
    consecutiveHostWait = false, boundaryHostWait = false,
    wrongPreSettlementStatus = false, reuseHostWaitId = false } = {}) {
    this.boundary = 0n; this.crossBoundary = crossBoundary;
    this.badDisplay = badDisplay; this.operations = [];
    this.hostWait = hostWait; this.hostWaitDelivered = 0;
    this.consecutiveHostWait = consecutiveHostWait;
    this.boundaryHostWait = boundaryHostWait;
    this.awaitingHostSettlement = false; this.settledRuns = 0;
    this.wrongPreSettlementStatus = wrongPreSettlementStatus;
    this.reuseHostWaitId = reuseHostWaitId;
  }

  async request(op, fields = {}) {
    this.operations.push(op);
    if (op === "machine-info") return machineInfo(this.boundary);
    if (op === "boundary-digest-v5" || op === "scheduler-queue-digest") {
      if (this.awaitingHostSettlement) {
        return { status: this.wrongPreSettlementStatus ? 0 : 9,
          digest: this.wrongPreSettlementStatus ? H(9) : undefined };
      }
      return { status: 0, digest: op === "boundary-digest-v5" ? H(6) : H(7) };
    }
    if (op === "run-until-event-m6") {
      const before = this.boundary;
      let after; let reason = 1; let debugBefore = 0n; let debugAfter = 0n;
      if (this.hostWait && (this.hostWaitDelivered === 0 ||
          (this.consecutiveHostWait && this.hostWaitDelivered === 1))) {
        this.hostWaitDelivered += 1; this.awaitingHostSettlement = true;
        return fastRecord({ before, after: before, reason: 3,
          debugBefore: 0n, debugAfter: 0n, requestedSlots: fields.clockSlots,
          terminalStatus: 8, outstandingRequestId: this.reuseHostWaitId ? 1n :
            BigInt(this.hostWaitDelivered) });
      }
      this.awaitingHostSettlement = false;
      if (this.settledRuns < C_PREFIX_SPANS) {
        after = before + BigInt(SLOTS);
      } else if (this.boundaryHostWait) {
        this.awaitingHostSettlement = true;
        return fastRecord({ before, after: CADR_M7_FORM_C_BOUNDARY, reason: 3,
          debugBefore: 0n, debugAfter: 0n, requestedSlots: fields.clockSlots,
          terminalStatus: 8, outstandingRequestId: 2n });
      } else {
        after = CADR_M7_FORM_C_BOUNDARY + (this.crossBoundary ? 1n : 0n);
        reason = 2; debugBefore = 0x5aa549444d36n; debugAfter = CADR_M6_FORM_C;
      }
      assert.ok(Number.isSafeInteger(fields.clockSlots) && fields.clockSlots > 0,
        "test driver receives a bounded requested fast span");
      this.settledRuns += 1;
      this.boundary = after;
      return fastRecord({ before, after, reason, debugBefore, debugAfter });
    }
    if (op === "boot-witness") {
      return { status: 0, wireSchema: "CDRM6I1", boundary: this.boundary,
        debugInstruction: CADR_M6_FORM_C, sample: witnessRecord() };
    }
    if (op === "display-full") {
      const frame = displayRecord();
      if (this.badDisplay) frame[96] = 1;
      return { status: 0, full: true, updated: true, width: 768, height: 963,
        blackOnWhite: true, frame };
    }
    throw new Error(`unexpected fast client operation ${op}`);
  }
}

const wasm = new Uint8Array(await readFile(resolve(
  ROOT, "cadr-web/build/cadr-web-m7-devid-O2.wasm")));
assert.equal(wasm.byteLength, M7_DEVID_DIAGNOSTIC_O2.bytes,
  "the closed M7-DEVID O2 builder output retains its fixed byte count");
assert.equal(createHash("sha256").update(wasm).digest("hex"), M7_DEVID_DIAGNOSTIC_O2.sha256,
  "the authority root pins the exact closed M7-DEVID O2 builder output");
assert.ok(WebAssembly.Module.exports(new WebAssembly.Module(wasm)).some(
  entry => entry.name === "cadr_wasm_m7_unimplemented_diagnostic"),
"the fixed O2 builder output exports the strict M7-DEVID diagnostic boundary");
const authorityPaths = [...new Set([
  ...M7_P4_FAST_REQUIRED_AUTHORITIES,
  "cadr-web/core/cadr_core.c",
  "cadr-web/include/cadr_machine.h",
  "cadr-web/trace/cadr_trace.c",
])].sort();
const authorityFiles = authorityPaths.map((path, index) => Object.freeze({
  path, bytes: index + 1, sha256: (index + 1).toString(16).padStart(64, "0"),
}));
const closure = Object.freeze({
  schema: "cadr-m6-stage-source-closure-v1",
  file_count: authorityFiles.length,
  total_byte_count: authorityFiles.reduce((sum, file) => sum + file.bytes, 0),
  sha256: "1".repeat(64),
});
const authority = Object.freeze({
  schema: "cadr-m7-p4-fast-authority-v2",
  full_tree_file_count: authorityFiles.length,
  files: authorityFiles,
  prefix_counts: Object.freeze({ core: 1, include: 1, trace: 1 }),
});
const toolchain = Object.freeze({
  schema: "cadr-m7-p4-fast-toolchain-v4",
  build_environment: Object.freeze({ HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC" }),
  guix: Object.freeze({ channel_commit: "230aa373f315f247852ee07dff34146e9b480aec",
    descriptor_bytes: 1, descriptor_sha256: "2".repeat(64),
    daemon_socket: Object.freeze({ dev: 36, ino: 4806452, uid: 944, gid: 954, mode: 438 }),
    store: Object.freeze({ dev: 36, ino: 389021, uid: 944, gid: 954, mode: 1021 }) }),
  toolchain: Object.freeze({
    clang: Object.freeze({ derivation: "/gnu/store/rfrk3x0n4x8br7jgknfanvy3rpn2vmgs-clang-toolchain-21.1.5.drv",
      output: "/gnu/store/k240495dfcfwkmlpqjf3dl8zxl9h9r82-clang-toolchain-21.1.5",
      requisites_count: 52, requisites_sha256: "1f301306191b398518e80a11788c9f36f5e63ddf4bd5298bfe3c06fc35dd0bfa" }),
    lld: Object.freeze({
      derivation: "/gnu/store/lwl823kr8gr4n4j919gj4kvsmy255lfm-lld-21.1.5.drv",
      output: "/gnu/store/1hlqi2fs7fwkmyvks462n55bj6d936r0-lld-21.1.5",
      requisites_count: 7, requisites_sha256: "25776ef1c8f2464672895728c541c4245806e4e35451278855c839e329821598",
    }),
    bash: Object.freeze({ derivation: "/gnu/store/l49zk72wc49jm6dkmchafhfp4ybb28xc-bash-minimal-5.2.37.drv",
      output: "/gnu/store/9pi8kah55s964qfik4cqysjdq74ll4sv-bash-minimal-5.2.37",
      requisites_count: 4, requisites_sha256: "cd64ad45ac89616a5e194da62af23b7769164c24c10523473d6249fb03394f49" }),
    coreutils: Object.freeze({ derivation: "/gnu/store/lbwyr39f1913h5rjb8i934ss020hyv9n-coreutils-9.1.drv",
      output: "/gnu/store/92x5q45dgl6qynlxy66vyxdz6rk7ammd-coreutils-9.1",
      requisites_count: 8, requisites_sha256: "d5d8908793ff09c02f3ced999a002993b8e9d1d19545caab661d4bfafc8e6415" }),
    sed: Object.freeze({ derivation: "/gnu/store/3x01309604iiw4594habpavcrc0v6j51-sed-4.9.drv",
      output: "/gnu/store/2c3ikfc9h1ghl9fx765mdiwsx1nnpr0f-sed-4.9",
      requisites_count: 4, requisites_sha256: "ada3e663e0cc32528b2f55d537eb791733a3fb0bfd5a504167406b31b70f2937" }),
  }),
});
const wasmIdentity = Object.freeze({
  path: "cadr-web/build/cadr-web-m7-devid-O2.wasm",
  bytes: wasm.byteLength,
  sha256: createHash("sha256").update(wasm).digest("hex"),
});
const moduleIdentity = createM7P4FastModuleIdentity({
  sourceCommit: "a".repeat(40), sourceTree: "b".repeat(40),
  signature: Object.freeze({
    policy: "gpgv-validsig-v4-ed25519-sha512-subkey-997e-primary-3ea3-v1",
    signing_subkey: "997E2BA6B52340268A3987E3D94F0A11ACD78333",
    primary_key: "3EA36B492D7E76450D2C59267B55A97A62F6D6C0",
    status_sha256: "3".repeat(64),
  }),
  closureBefore: closure, closureAfter: { ...closure },
  authorityBefore: authority, authorityAfter: {
    ...authority, files: [...authority.files],
  }, toolchain, wasm: wasmIdentity,
});
{
  const concrete = createM7P4TrustedWorkerSupervisorForTest();
  const cleanup = Object.freeze({ schema: "cadr-m7-p4-runner-cleanup-capability-v1",
    nonce: "9".repeat(64) });
  const acquired = await concrete.open(cleanup);
  const compiled = new WebAssembly.Module(wasm);
  const instantiated = await concrete.instantiate(acquired.lease, { module: compiled,
    request: Object.freeze({ version: 5, op: "instantiate", m6DiskEvidencePolicy: true }) });
  assert.equal(instantiated.instantiated_module, compiled);
  assert.equal(instantiated.response.status, 0);
  const disposed = await concrete.dispose(acquired.lease);
  assert.deepEqual(disposed, { schema: "cadr-m7-p4-fast-disposal-test-v1",
    session_id: `m7-${cleanup.nonce}`, pending_requests: 0, terminated: true });
}
assert.equal(Object.isFrozen(moduleIdentity.source.authority_after.files), true);
assert.throws(() => {
  moduleIdentity.source.authority_after.files[0].sha256 = "f".repeat(64);
}, /read only/,
"the accepted preparation receipt cannot mutate between validation and instantiation");
assert.throws(() => validateM7P4FastPreparedIdentity({ ...moduleIdentity,
  source: { ...moduleIdentity.source, signature: { ...moduleIdentity.source.signature,
    signing_subkey: "0".repeat(40) } },
}), /signed source policy differs/,
"a valid-looking receipt signed by any other subkey is rejected");
assert.throws(() => validateM7P4FastPreparedIdentity({ ...moduleIdentity,
  build: { ...moduleIdentity.build, toolchain: { ...moduleIdentity.build.toolchain,
    toolchain: { ...moduleIdentity.build.toolchain.toolchain,
      clang: { ...moduleIdentity.build.toolchain.toolchain.clang,
        output: `/gnu/store/${"a".repeat(32)}-clang-toolchain-21.1.5` } } } },
}), /frozen time-machine plan/,
"an equal-version current-channel output cannot substitute for the pinned derivation output");
const frozenRelease = new Uint8Array(await readFile(resolve(
  ROOT, "cadr-web/oracle/cadr-m6-release-record.json")));
const frozenReleaseRecord = JSON.parse(new TextDecoder("utf-8", { fatal: true })
  .decode(frozenRelease));
const nativeBoundaries = frozenReleaseRecord.native_runs[0];
const formABoundary = BigInt(nativeBoundaries.a_boundary);
const formBBoundary = BigInt(nativeBoundaries.b_boundary);
const listenerIdleCBoundary = BigInt(nativeBoundaries.listener_idle_c_boundary);
const listenerIdleSettledBoundary = BigInt(
  nativeBoundaries.listener_idle_settled_boundary);
const readyBoundary = listenerIdleSettledBoundary + BigInt(
  frozenReleaseRecord.idle_oracle.first_boundary_delta_from_settled) +
  BigInt(frozenReleaseRecord.idle_oracle.sample_count - 1);

async function resultFor(client, bridge, checkpointCount = undefined) {
  const summary = evidenceSummary();
  const cdrstate5 = H(6); const cdrm5q1 = H(7); const artifactSet = H(1);
  const privateDisk = H(2); const hostTranscript = H(8);
  const ready3 = await canonicalM6ReadyWitness({
    releaseRecord: frozenReleaseRecord, artifactSetSha256: artifactSet,
    privateDiskBaseSha256: privateDisk, formABoundary, formBBoundary,
    listenerIdleCBoundary, listenerIdleSettledBoundary, readyBoundary,
    cdrstate5Sha256: cdrstate5, cdrm5q1Sha256: cdrm5q1,
    hostTranscriptSha256: hostTranscript,
  });
  let checkpointChain = digest(new TextEncoder().encode("CDRM6FASTCHAIN1\0"));
  for (const [index, checkpoint] of bridge.settledCheckpoints.entries()) {
    checkpointChain = await appendM6FastCheckpoint(checkpointChain, index,
      checkpoint.fast, checkpoint.cdrstate5, checkpoint.cdrm5q1);
  }
  let hostWaitChain = digest(new TextEncoder().encode("CDRM6FASTHOSTWAIT1\0"));
  for (const [index, record] of bridge.hostWaitRecords.entries()) {
    hostWaitChain = await appendM6FastHostWait(hostWaitChain, index, record);
  }
  const ready4 = await canonicalM6ReadyWitnessV4({ ready3Witness: ready3,
    selectedMaximum: 0x7fff_ffff_ffff_ffffn,
    cdrm6e1Sha256: digest(summary),
    checkpointCount: checkpointCount ?? bridge.settledCheckpointCount,
    checkpointChainSha256: checkpointChain,
    hostWaitCount: bridge.reason3StopCount,
    hostWaitChainSha256: hostWaitChain });
  return Object.freeze({ outcome: "ready4", target: CADR_M6_DEVID_PROFILE,
    contract: CADR_M6_READY4_CONTRACT, boundary: readyBoundary,
    checkpointCount: checkpointCount ?? bridge.settledCheckpointCount,
    hostWaitCount: bridge.reason3StopCount,
    hostWaitRecords: bridge.hostWaitRecords.map(record => record.slice()),
    hostWaitChainSha256: hostWaitChain,
    ready: { formABoundary, formBBoundary,
      listenerIdleCBoundary, listenerIdleSettledBoundary,
      ready3Witness: ready3, ready4Witness: ready4 },
    preflight: { artifactSetSha256: artifactSet },
    runEvidence: { privateDiskBaseSha256: privateDisk },
    hostTranscriptSha256: hostTranscript,
    checkpointChainSha256: checkpointChain,
    cdrstate5Sha256: cdrstate5, cdrm5q1Sha256: cdrm5q1,
    cdrm6e1: summary, cdrm6e1Sha256: digest(summary),
    cdrm6e1SelectedMaximum: 0x7fff_ffff_ffff_ffffn,
    cdrm6e1TotalAccepted: 513n, cdrm6e1TailEventCount: 1n });
}

async function completeFastBoot({ client, checkpointCount, resultTransform } = {}) {
  const selected = client ?? new FastClient();
  return runM7Ready4FastCheckpointedBootForTest({ client: selected,
    nativeCapture: nativeRecord(), moduleIdentity,
    ready: { releaseRecord: frozenRelease }, fastSlots: SLOTS }, async ({ client: bridge }) => {
    await bridge.request("machine-info");
    for (let index = 0; index < C_PREFIX_SPANS; index += 1) {
      const response = await bridge.request("run-until-event-m6",
        { clockSlots: SLOTS });
      if (response.reason === 3) {
        await bridge.request("boundary-digest-v5");
        await bridge.request("scheduler-queue-digest");
        index -= 1;
        continue;
      }
      await bridge.request("boundary-digest-v5");
      await bridge.request("scheduler-queue-digest");
    }
    await bridge.request("run-until-event-m6", {
      clockSlots: Number(CADR_M7_FORM_C_BOUNDARY - BigInt(C_PREFIX_SPANS * SLOTS)),
    });
    await bridge.request("boundary-digest-v5");
    await bridge.request("scheduler-queue-digest");
    const result = await resultFor(selected, bridge, checkpointCount);
    return resultTransform === undefined ? result : resultTransform(result);
  });
}

function status13Failure() {
  return Object.freeze({ outcome: "failed",
    preflight: { profileId: "CADR-WEB-303", artifactSetSha256: H(1),
      artifacts: [1, 2, 4, 5, 3].map((kind, index) =>
        ({ kind, byteCount: BigInt(index + 1), sha256: H(index + 2) })) },
    runEvidence: { sessionId: "m7-p4-status13", privateDiskInstanceId: "status13-disk",
      privateDiskBaseSha256: H(9) },
    transcriptTail: [],
    report: { schema: "CDRM6BOOT1", schemaVersion: 2, outcome: "failed",
      reason: "terminal-machine-status", phase: "run", status: 13,
      boundary: 1352885n, lifecycle: "FAILED", cdrstate5Sha256: H(10),
      cdrm5q1Sha256: H(11), outstandingRequest: null, machineInfo: null,
      transcriptCount: 0, lastHostTransactions: [], hostTranscriptSha256: H(12),
      runFraming: { operation: "run-digest-batch-m5", requestedClockSlots: 4096,
        returnedBoundaryCount: 1559, terminalStatus: 13, preCallBoundary: 1351325n,
        cachedLastCompleteBoundary: 1352885n, postCallAttemptedBoundary: null },
      unimplementedDevice: { schema: "cadr-m7-unimplemented-device-v1", site: 4,
        siteName: "guarded-bus-write", direction: 2, address: 0o76543,
        value: 0x12345678, result: 0, status: 13, boundary: 1352885n,
        microinstructions: 1263000n, wireSha256: H(13) },
    },
  });
}

async function runEarlyFailure(result) {
  return runM7Ready4FastCheckpointedBootForTest({ client: new FastClient(),
    nativeCapture: nativeRecord(), moduleIdentity,
    ready: { releaseRecord: frozenRelease }, fastSlots: SLOTS,
    requireM7DevidFailureDiagnostic: true }, async () => result);
}

await assert.rejects(runEarlyFailure(status13Failure()), error => {
  if (error?.name !== "CadrM7UnderlyingM6Failure" || error.checkpoint !== null ||
      !(error.m6FailureDiagnostic instanceof Uint8Array)) return false;
  const report = JSON.parse(new TextDecoder().decode(error.m6FailureDiagnostic)).failure.report;
  return report.status === 13 && report.schemaVersion === 2 &&
    report.unimplementedDevice?.siteName === "guarded-bus-write";
}, "a pre-Form-C status-13 result preserves its complete canonical diagnostic");

const downgradedStatus13 = structuredClone(status13Failure());
delete downgradedStatus13.report.unimplementedDevice;
downgradedStatus13.report.schemaVersion = 1;
await assert.rejects(runEarlyFailure(downgradedStatus13), /required M7-DEVID diagnostic/,
  "a malformed status-13 result cannot bypass Form-C by posing as a failure receipt");

await assert.rejects(runEarlyFailure({ outcome: "ready4" }),
  /READY4 completed without a Form-C/,
  "only a successful READY4 result must supply the exact Form-C checkpoint");

const complete = await completeFastBoot();
assert.equal(complete.target, CADR_M7_READY4_FAST_TARGET);
assert.equal(complete.contract, CADR_M7_READY4_FAST_CONTRACT);
assert.equal(complete.checkpoint.boundary, CADR_M7_FORM_C_BOUNDARY);
assert.equal(complete.checkpoint.captured_before_next_boundary, true);
assert.equal(complete.fast.total_stops_to_form_c,
  CADR_M7_READY4_FAST_MINIMUM_SPANS);
assert.equal(complete.fast.total_stops, CADR_M7_READY4_FAST_MINIMUM_SPANS);
assert.equal(complete.fast.settled_checkpoints,
  CADR_M7_READY4_FAST_MINIMUM_SPANS);
assert.equal(complete.fast.fast_record_bytes_to_form_c,
  CADR_M7_READY4_FAST_MINIMUM_SPANS * 128);
assert.equal(complete.fast.settled_digest_bytes,
  CADR_M7_READY4_FAST_MINIMUM_SPANS * 64);
assert.equal(complete.fast.bulk_m5_digest_batches, 0);
assert.equal(complete.comparison.outcome, "identical");

const orderedClient = new FastClient();
await completeFastBoot({ client: orderedClient });
const lastRun = orderedClient.operations.lastIndexOf("run-until-event-m6");
assert.deepEqual(orderedClient.operations.slice(lastRun + 1),
  ["boot-witness", "display-full", "boundary-digest-v5",
    "scheduler-queue-digest"],
  "CDRM6I1 and CDRDISP1 are captured while the Form-C fast reply is suspended");
assert.equal(orderedClient.operations.includes("run-digest-batch-m5"), false);

const hostWait = await completeFastBoot({ client: new FastClient({ hostWait: true }) });
assert.equal(hostWait.fast.total_stops,
  CADR_M7_READY4_FAST_MINIMUM_SPANS + 1);
assert.equal(hostWait.fast.reason3_stops, 1);
assert.equal(hostWait.fast.settled_checkpoints,
  CADR_M7_READY4_FAST_MINIMUM_SPANS);
assert.equal(hostWait.evidence.status9BeforeSettlementCount, 2,
  "both pre-settlement digest probes record the required protocol status 9");
await assert.rejects(completeFastBoot({ client: new FastClient({
  hostWait: true, wrongPreSettlementStatus: true,
}) }), /pre-settlement digest query did not fail with protocol status 9/,
"a reason-3 stop cannot publish a settled digest before its next C-owned run");
const sameBoundaryDistinctWaits = await completeFastBoot({ client: new FastClient({
  hostWait: true, consecutiveHostWait: true,
}) });
assert.equal(sameBoundaryDistinctWaits.fast.reason3_stops, 2,
  "distinct host request ids may validly stop at one unchanged C-owned boundary");
await assert.rejects(completeFastBoot({ client: new FastClient({ hostWait: true,
  consecutiveHostWait: true, reuseHostWaitId: true,
}) }), /reused a request id/,
"a same-boundary reason-3 stop is rejected only when it reuses the request id");
await assert.rejects(completeFastBoot({ client: new FastClient({
  boundaryHostWait: true,
}) }), /reason-3 host wait.*(?:Form-C|boundary)/,
"a reason-3 stop cannot replace the exact Form-C checkpoint");
await assert.rejects(completeFastBoot({ client: new FastClient({ hostWait: true }),
  resultTransform: value => ({ ...value,
    hostWaitChainSha256: H(0) }) }), /CDRM6FASTHOSTWAIT1 differs/,
"the host-wait chain is independent from the settled checkpoint chain");
await assert.rejects(completeFastBoot({ client: new FastClient({ hostWait: true }),
  resultTransform: value => {
    const records = value.hostWaitRecords.map(record => record.slice());
    records[0][24] ^= 1;
    return { ...value, hostWaitRecords: records };
  } }), /host-wait records differ/,
"a retained reason-3 record cannot mutate after interception");

await assert.rejects(completeFastBoot({ client: new FastClient({ crossBoundary: true }) }),
  /crossed the exact Form-C capture boundary/,
  "a span cannot cross Form C and be presented as an exact checkpoint");
await assert.rejects(completeFastBoot({ client: new FastClient({ badDisplay: true }) }),
  /raw framebuffer words differ/,
  "the differential witness rejects the first portable display difference");
await assert.rejects(completeFastBoot({ checkpointCount: 937 }),
  /checkpoint-chain span count differs/,
  "READY4 cannot bind a shorter chain than the intercepted fast spans");
await assert.rejects(completeFastBoot({ resultTransform: value => ({ ...value,
  target: "CADR-WEB-303/ABI1.4/protocol-v4/M6" }) }),
  /selected READY4 contract\/profile/,
  "a mismatched M6 target cannot be relabelled as the selected M7-DEVID witness");
await assert.rejects(completeFastBoot({ resultTransform: value => ({ ...value,
  ready: { ...value.ready, ready4Witness: H(0) } }) }),
  /READY4 witness differs/,
  "READY4 is independently rebound to READY3 and CDRM6E1");
await assert.rejects(completeFastBoot({ resultTransform: value => ({ ...value,
  cdrm6e1Sha256: H(0) }) }), /CDRM6E1 bytes and digest differ/,
  "CDRM6E1 cannot be detached from its exact digest");

const directBridge = new CadrM7Ready4FastBoundaryClient({
  request: async () => { throw new Error("must not dispatch M5"); },
}, nativeRecord());
await assert.rejects(directBridge.request("run-digest-batch-m5"), /forbidden/,
  "the wrapper rejects the old bulk per-boundary digest operation before dispatch");
assert.throws(() => validateM7Ready4FastModuleIdentity({ ...moduleIdentity,
  profile: "m7" }), /profile\/contract differs/,
"an ordinary M7 module cannot stand in for m7-devid");
assert.throws(() => validateM7Ready4FastModuleIdentity({
  ...moduleIdentity, optimization: "O0",
}), /profile\/contract differs/,
"an O0 build cannot stand in for the selected O2 artifact");
assert.throws(() => validateM7Ready4FastModuleIdentity({
  ...moduleIdentity,
  source: { ...moduleIdentity.source,
    closure_after: { ...moduleIdentity.source.closure_after,
      sha256: "3".repeat(64) } },
}), /closure changed/,
"a source closure race is rejected");
assert.throws(() => validateM7Ready4FastModuleIdentity({
  ...moduleIdentity,
  source: { ...moduleIdentity.source,
    authority_after: { ...moduleIdentity.source.authority_after,
      files: moduleIdentity.source.authority_after.files.filter(
        file => file.path !== M7_P4_FAST_WORKER_TRANSITIVE_MODULES[0]) } },
}), /authority paths are incomplete|authority changed/,
"the worker's transitive module closure is mandatory");
assert.throws(() => validateM7Ready4FastModuleIdentity({
  ...moduleIdentity,
  source: { ...moduleIdentity.source,
    authority_after: { ...moduleIdentity.source.authority_after,
      files: moduleIdentity.source.authority_after.files.map((file, index) =>
        index === 0 ? { ...file, sha256: "4".repeat(64) } : file) } },
}), /authority changed/,
"an authority-byte identity mutation is rejected");

assert.throws(() => parseM7P4FastArguments([]), /only --precommit/);
assert.throws(() => parseM7P4FastArguments(["--execute"]), /only --precommit/);
await assert.rejects(executeM7P4FastDifferential({}),
  /INVALID_FD_TYPE|EINVAL|EBADF|socket|file descriptor|fd/i,
  "the command surface adopts and requires inherited fd3 before examining caller data");

{
  const eofDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m7-rpc-eof-test-"));
  try {
    for (const op of ["revalidate", "close"]) {
      const socketPath = resolve(eofDirectory, `${op}.sock`);
      const server = createServer(connection => connection.once("data", () => connection.end()));
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen); server.listen(socketPath, resolveListen);
      });
      const client = createConnection(socketPath);
      await new Promise((resolveConnect, rejectConnect) => {
        client.once("connect", resolveConnect); client.once("error", rejectConnect);
      });
      const request = createM7P4AuthorityRpcForTest(client, 250);
      const started = Date.now();
      await assert.rejects(request({ op }), /ended|closed/,
        `orderly EOF rejects the pending ${op} waiter`);
      assert.ok(Date.now() - started < 1000, `${op} EOF rejection is bounded`);
      client.destroy();
      await new Promise(resolveClose => server.close(resolveClose));
    }
  } finally {
    await rm(eofDirectory, { recursive: true, force: true });
  }
}
{
  const errorDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m7-rpc-error-test-"));
  try {
    const socketPath = resolve(errorDirectory, "error.sock");
    const server = createServer(connection => connection.once("data", () => {}));
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen); server.listen(socketPath, resolveListen);
    });
    const client = createConnection(socketPath);
    await new Promise((resolveConnect, rejectConnect) => {
      client.once("connect", resolveConnect); client.once("error", rejectConnect);
    });
    const request = createM7P4AuthorityRpcForTest(client, 1000);
    const pending = [request({ op: "revalidate" }), request({ op: "close" })];
    client.destroy(new Error("synthetic permanent fd3 failure"));
    const settled = await Promise.allSettled(pending);
    assert.ok(settled.every(result => result.status === "rejected" &&
      /synthetic permanent/.test(result.reason.message)),
    "permanent fd3 error rejects every pending waiter with the terminal cause");
    await assert.rejects(request({ op: "revalidate" }), /synthetic permanent/,
      "subsequent requests retain the permanent terminal policy");
    await new Promise(resolveClose => server.close(resolveClose));
  } finally {
    await rm(errorDirectory, { recursive: true, force: true });
  }
}
{
  const timeoutDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m7-rpc-timeout-test-"));
  try {
    const socketPath = resolve(timeoutDirectory, "timeout.sock");
    const server = createServer(connection => connection.once("data", () => {}));
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen); server.listen(socketPath, resolveListen);
    });
    const client = createConnection(socketPath);
    await new Promise((resolveConnect, rejectConnect) => {
      client.once("connect", resolveConnect); client.once("error", rejectConnect);
    });
    const request = createM7P4AuthorityRpcForTest(client, 50); const started = Date.now();
    const settled = await Promise.allSettled([
      request({ op: "revalidate" }), request({ op: "close" }),
    ]);
    assert.ok(settled.every(result => result.status === "rejected"),
      "timeout and resulting terminal close reject every pending waiter");
    assert.ok(Date.now() - started < 1000, "multi-waiter timeout cleanup is bounded");
    await assert.rejects(request({ op: "revalidate" }), /closed|timed out/,
      "requests after timeout remain forbidden by terminal policy");
    client.destroy(); await new Promise(resolveClose => server.close(resolveClose));
  } finally {
    await rm(timeoutDirectory, { recursive: true, force: true });
  }
}

const native = nativeRecord();
const nativeManifest = {
  expected_closure_token: "closed-p4",
  native: {
    frame_file: {
      path: "private/form-c.cdrm7n1", bytes: native.byteLength,
      sha256: createHash("sha256").update(native).digest("hex"),
    },
    capture: {
      boundary: CADR_M7_FORM_C_BOUNDARY.toString(),
      tv_mode: 4, black_on_white: true,
    },
  },
};
const manifestBytes = new TextEncoder().encode(canonicalJson(nativeManifest));
const nativeAuthority = Object.freeze({
  schema: "cadr-m7-p4-native-authority-v2",
  manifest_bytes: manifestBytes,
  manifest_identity: Object.freeze({
    path: "private/p4-manifest.json", bytes: manifestBytes.byteLength,
    sha256: createHash("sha256").update(manifestBytes).digest("hex"),
  }),
  native_frame: native,
});
const authorityDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m7-p4-authority-test-"));
const authorityCheckout = resolve(authorityDirectory, "checkout");
execFileSync("git", ["clone", "--no-local", "--no-checkout", ROOT, authorityCheckout], {
  cwd: ROOT, stdio: "ignore",
});
execFileSync("git", ["checkout", "--detach", "HEAD"], { cwd: authorityCheckout,
  stdio: "ignore" });
const launcherReceiptPath = resolve(authorityCheckout,
  "scripts/cadr-m7-p4-guix-launcher-receipt.json");
const sourceHasLauncherReceipt = await stat(launcherReceiptPath).then(
  () => true, error => {
    if (error?.code === "ENOENT") return false;
    throw error;
  });
const fsmonitorMarker = resolve(authorityDirectory, "fsmonitor-ran");
const fsmonitorHelper = resolve(authorityDirectory, "fsmonitor-helper.sh");
await writeFile(fsmonitorHelper, `#!/bin/sh\n/usr/bin/touch '${fsmonitorMarker}'\nexit 1\n`,
  { mode: 0o700 });
execFileSync("git", ["config", "core.fsmonitor", fsmonitorHelper], {
  cwd: authorityCheckout, stdio: "ignore",
});
const expectedClosurePath = resolve(authorityDirectory, "expected-closure.json");
const keyringPath = resolve(authorityDirectory, "trusted-keyring.gpg");
await writeFile(expectedClosurePath, canonicalJson({ token: "closed-p4" }));
await writeFile(keyringPath, execFileSync("gpg", ["--export",
  "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"]));
const expectedClosureHandle = await open(expectedClosurePath);
const gitHandle = await open("/usr/bin/git");
const guixHandle = await open("/usr/local/bin/guix");
const gpgvHandle = await open("/usr/bin/gpgv");
const keyringHandle = await open(keyringPath);
const trustedAuthorityRoot = await openM7P4AuthorityRootForTest({
  expectedClosure: expectedClosureHandle, git: gitHandle, guix: guixHandle,
  gpgv: gpgvHandle, keyring: keyringHandle, checkout: authorityCheckout,
});
await assert.rejects(readFile(fsmonitorMarker), /ENOENT/,
  "authority selection disables a repository-configured fsmonitor executable");
const fixedModulePath = resolve(authorityDirectory, "fixed-module.json");
await writeFile(fixedModulePath, canonicalJson({
  schema: "cadr-m7-fixed-module-identity-test-v1", module_sha256: wasmIdentity.sha256,
  module_bytes: wasmIdentity.bytes,
  identity_sha256: createHash("sha256").update(canonicalJson(moduleIdentity)).digest("hex"),
  launcher: inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).launcherAuthority,
}));
{
  const socketPath = resolve(authorityDirectory, "authority.sock");
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen); server.listen(socketPath, resolveListen);
  });
  const acceptedPromise = new Promise((resolveAccepted, rejectAccepted) => {
    server.once("connection", resolveAccepted); server.once("error", rejectAccepted);
  });
  const client = createConnection(socketPath);
  await new Promise((resolveConnect, rejectConnect) => {
    client.once("connect", resolveConnect); client.once("error", rejectConnect);
  });
  const accepted = await acceptedPromise;
  const topologyHandles = await Promise.all([expectedClosurePath, "/usr/bin/git",
    "/usr/local/bin/guix", "/usr/bin/gpgv", keyringPath, fixedModulePath]
    .map(path => open(path, "r")));
  const child = spawn(process.execPath,
    [resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs"), "--serve-inherited-test"], {
      cwd: authorityCheckout,
      stdio: ["ignore", "pipe", "pipe", accepted._handle.fd,
        ...topologyHandles.map(handle => handle.fd)],
    });
  const childClosed = new Promise((resolveClose, rejectClose) => {
    child.once("close", (...args) => resolveClose(args)); child.once("error", rejectClose);
  });
  const acceptedClosed = new Promise(resolveClose => accepted.once("close", resolveClose));
  accepted.destroy();
  await boundedAuthorityCleanup(acceptedClosed, "the parent copy of the inherited fd3 peer");
  let response = ""; const responseLines = []; let responseWake = null;
  client.setEncoding("utf8"); client.on("data", chunk => {
    response += chunk;
    for (;;) {
      const newline = response.indexOf("\n"); if (newline < 0) break;
      responseLines.push(JSON.parse(response.slice(0, newline)));
      response = response.slice(newline + 1); responseWake?.(); responseWake = null;
    }
  });
  const clientEnded = new Promise((resolveEnd, rejectEnd) => {
    client.once("end", resolveEnd); client.once("error", rejectEnd);
  });
  const nextResponse = async () => {
    if (responseLines.length === 0) await new Promise(resolveLine => { responseWake = resolveLine; });
    return responseLines.shift();
  };
  const changedWasm = wasm.slice(); changedWasm[0] ^= 1;
  client.write(`${canonicalJson({ op: "revalidate", identity: moduleIdentity,
    module_b64: Buffer.from(changedWasm).toString("base64") })}\n`);
  assert.equal((await nextResponse()).ok, false,
    "caller module bytes cannot differ from the fixed fd9 authority");
  client.write(`${canonicalJson({ op: "revalidate", identity: moduleIdentity,
    module_b64: Buffer.from(wasm).toString("base64") })}\n`);
  const revalidated = await nextResponse();
  assert.equal(revalidated.ok, true);
  assert.equal(revalidated.provenance.schema, "cadr-m7-p4-fixed-revalidation-test-v1");
  const authoritySocket = await readlink(`/proc/${child.pid}/fd/3`);
  assert.match(authoritySocket, /^socket:\[\d+\]$/,
    "the positive authority child owns the expected inherited fd3 socket");
  assert.deepEqual(await liveSocketOwnersForTest(authoritySocket), [`${child.pid}/3`],
    "no accessible Guix client or other descendant inherits the authority fd3 endpoint");
  client.write('{"op":"close"}\n');
  const closed = await nextResponse();
  /* Do not rely on allowHalfOpen defaults to return the peer's final EOF.  An
   * inherited copy in a descendant would otherwise make this test wait forever
   * after a valid close acknowledgement. */
  client.end();
  await boundedAuthorityCleanup(clientEnded, "the reciprocal fd3 EOF");
  const [code] = await boundedAuthorityCleanup(childClosed, "authority child exit");
  await Promise.all(topologyHandles.map(handle => handle.close()));
  assert.deepEqual(await liveSocketOwnersForTest(authoritySocket), [],
    "no accessible process retains the authority fd3 endpoint after exit");
  await boundedAuthorityCleanup(new Promise((resolveClose, rejectClose) => {
    server.close(error => error === undefined ? resolveClose() : rejectClose(error));
  }), "authority listener cleanup");
  await unlink(socketPath).catch(() => {});
  assert.equal(code, 0, "the positive inherited-fd test-domain server exits after close/EOF");
  assert.deepEqual(closed, { closed: true, ok: true });
}
for (const phase of ["after-fds", "after-fd9", "forged-launcher", "pin-after-connect",
  "after-root", "after-daemon-recheck"]) {
  const socketPath = resolve(authorityDirectory, `failure-${phase}.sock`);
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen); server.listen(socketPath, resolveListen);
  });
  const acceptedPromise = new Promise(resolveAccepted => server.once("connection", resolveAccepted));
  const client = createConnection(socketPath);
  await new Promise((resolveConnect, rejectConnect) => {
    client.once("connect", resolveConnect); client.once("error", rejectConnect);
  });
  const accepted = await acceptedPromise;
  if (phase === "forged-launcher") {
    const forged = JSON.parse(await readFile(fixedModulePath, "utf8"));
    forged.launcher.output_sha256 = "0".repeat(64);
    await writeFile(fixedModulePath, canonicalJson(forged));
  }
  const handles = await Promise.all([expectedClosurePath, "/usr/bin/git", "/usr/local/bin/guix",
    "/usr/bin/gpgv", keyringPath, fixedModulePath].map(path => open(path, "r")));
  const child = spawn(process.execPath,
    [resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs"), "--serve-inherited-test"], {
      cwd: authorityCheckout, env: { ...process.env, M7_TEST_FAIL_SETUP: phase },
      stdio: ["ignore", "pipe", "pipe", accepted._handle.fd, ...handles.map(handle => handle.fd)],
    });
  accepted.destroy();
  await new Promise((resolveEnd, rejectEnd) => {
    client.once("end", resolveEnd); client.once("error", rejectEnd);
  });
  const code = await new Promise((resolveClose, rejectClose) => {
    child.once("close", resolveClose); child.once("error", rejectClose);
  });
  await Promise.all(handles.map(handle => handle.close()));
  if (phase === "forged-launcher") {
    await writeFile(fixedModulePath, canonicalJson({
      schema: "cadr-m7-fixed-module-identity-test-v1", module_sha256: wasmIdentity.sha256,
      module_bytes: wasmIdentity.bytes,
      identity_sha256: createHash("sha256").update(canonicalJson(moduleIdentity)).digest("hex"),
      launcher: inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).launcherAuthority,
    }));
  }
  await new Promise(resolveClose => server.close(resolveClose));
  await unlink(socketPath).catch(() => {});
  assert.notEqual(code, 0, `${phase} must exit failed after terminal fd3 EOF`);
}
assert.equal((await readdir(tmpdir())).some(name => name.startsWith("cadr-m7-root-program-")),
  false, "post-connect daemon failure removes the real constructAuthority program capture");
const signedSnapshotTree = inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).snapshot.tree;
const signedArchiveHash = digest(
  inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).snapshot.archive);
await writeFile(resolve(authorityCheckout, "cadr-web/wasm/cadr-m6-headless-boot.mjs"),
  "\nthrow new Error('ambient transitive mutation reached');\n", { flag: "a" });
assert.deepEqual(digest(inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).snapshot.archive),
  signedArchiveHash,
  "post-capture mutation of an import-transitive ambient file cannot alter captured bytes");
execFileSync("git", ["replace", "HEAD", "HEAD^"], { cwd: authorityCheckout, stdio: "ignore" });
assert.equal(inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).snapshot.tree,
  signedSnapshotTree,
  "a replace ref created after snapshot cannot alter the retained signed archive or inventory");
execFileSync("git", ["replace", "-d", "HEAD"], { cwd: authorityCheckout, stdio: "ignore" });
const validateSyntheticManifest = (manifest, expected) => {
  assert.equal(manifest.expected_closure_token, expected.token);
  assert.deepEqual(expected, { token: "closed-p4" });
  return manifest;
};
const mutableNativeBindingEcho = { closed: true, nested: { marker: "bound" } };
const boundNative = validateM7P4NativeAuthority(nativeAuthority, trustedAuthorityRoot,
  validateSyntheticManifest, () => mutableNativeBindingEcho);
assert.equal(boundNative.receipt.schema, "cadr-m7-p4-native-authority-test-v1",
  "test authority emits a domain-separated receipt that production validation cannot accept");
assert.equal(canonicalJson(boundNative.receipt.bindings),
  canonicalJson({ closed: true, nested: { marker: "bound" } }));
assert.equal(Object.isFrozen(boundNative.receipt.bindings), true,
  "native P4 bindings are copied before the supervisor seam observes them");
mutableNativeBindingEcho.closed = false;
mutableNativeBindingEcho.nested.marker = "mutated";
assert.equal(canonicalJson(boundNative.receipt.bindings),
  canonicalJson({ closed: true, nested: { marker: "bound" } }),
"post-validation mutation of a native binding echo cannot alter the sealed receipt");
assert.equal(selectM7P4FrozenExpectedClosure(trustedAuthorityRoot).expected.token,
  "closed-p4", "the real selector reads the separate trusted-input boundary");
assert.throws(() => selectM7P4FrozenExpectedClosure({
  expected_closure_bytes: new TextEncoder().encode(canonicalJson({ token: "forged-p4" })),
}), /privileged capability/,
"matching closure bytes cannot construct the root-owned P4 authority capability");
assert.throws(() => validateM7P4NativeAuthority({
  ...nativeAuthority,
  native_frame: Uint8Array.from(native, (byte, index) =>
    index === native.byteLength - 1 ? byte ^ 1 : byte),
}, trustedAuthorityRoot, validateSyntheticManifest, () => ({})), /raw CDRM7N1 differs/,
"raw native substitution is rejected after the closed manifest validates");
assert.throws(() => validateM7P4NativeAuthority({
  ...nativeAuthority,
  manifest_bytes: Uint8Array.from(manifestBytes, (byte, index) =>
    index === manifestBytes.byteLength - 2 ? byte ^ 1 : byte),
}, trustedAuthorityRoot, validateSyntheticManifest, () => ({})), /manifest bytes differ/,
"manifest substitution is rejected by its independent identity");
const forgedNativeManifest = {
  ...nativeManifest, expected_closure_token: "forged-p4",
};
const forgedManifestBytes = new TextEncoder().encode(canonicalJson(forgedNativeManifest));
const forgedNativeAuthority = Object.freeze({
  ...nativeAuthority,
  manifest_bytes: forgedManifestBytes,
  manifest_identity: Object.freeze({
    path: "private/p4-manifest.json", bytes: forgedManifestBytes.byteLength,
    sha256: createHash("sha256").update(forgedManifestBytes).digest("hex"),
  }),
});
assert.throws(() => validateM7P4NativeAuthority(forgedNativeAuthority,
  trustedAuthorityRoot, validateSyntheticManifest, () => ({})), /strict|Expected values|closed-p4/,
"a coordinated manifest/expected-closure substitution is rejected through the real frozen selector");
assert.throws(() => validateM7P4NativeAuthority({
  ...forgedNativeAuthority, expected_closure: { token: "forged-p4" },
}, trustedAuthorityRoot, validateSyntheticManifest, () => ({})), /missing or unknown fields/,
"native authority cannot smuggle a caller-controlled expected closure beside its manifest");

const fakeNative = () => Object.freeze({
  nativeFrame: native.slice(),
  receipt: Object.freeze({ schema: "test-native-authority",
    manifest: Object.freeze({ sha256: "3".repeat(64) }),
    expected_closure_sha256: "4".repeat(64) }),
});
const fakeResult = async () => Object.freeze({
  target: CADR_M7_READY4_FAST_TARGET,
  contract: CADR_M7_READY4_FAST_CONTRACT,
  checkpoint: Object.freeze({ boundary: CADR_M7_FORM_C_BOUNDARY }),
});
function executionConfig(supervisor, moduleBytes = wasm, identity = moduleIdentity) {
  return {
    moduleIdentity: identity, moduleBytes, supervisor,
    nativeAuthority: Object.freeze({ test: true }),
    authorityRoot: trustedAuthorityRoot,
    ready: { releaseRecord: frozenRelease }, artifacts: [], profile: {},
    maxBoundaries: readyBoundary,
  };
}
function validAcquisition(lease = Object.freeze({ lease: "synthetic" })) {
  return { lease, session_id: "synthetic-session" };
}
function validInstantiation(module, client = {
  request: async () => ({ status: 0 }),
}) {
  return {
    instantiated_module: module, client,
    response: { status: 0 },
  };
}
function validDisposal() {
  return {
    schema: "cadr-m7-p4-fast-disposal-test-v1",
    session_id: "synthetic-session", pending_requests: 0, terminated: true,
  };
}
const revalidatedExecutionProvenance = async () => Object.freeze({
  schema: "cadr-m7-p4-fast-execution-provenance-test-v1",
  source_commit: moduleIdentity.source.commit,
  source_tree: moduleIdentity.source.tree,
  module_identity_sha256: createHash("sha256").update(
    canonicalJson(moduleIdentity)).digest("hex"),
  module_sha256: moduleIdentity.build.wasm.sha256,
  trusted_lineage_floor: "9dbfe42dd66a7e92dc6cc1f59b44d622381fc7d1",
  signature: moduleIdentity.source.signature,
});
const testExecutionDependencies = Object.freeze({
  validateNative: fakeNative, run: fakeResult,
  revalidatePreparation: revalidatedExecutionProvenance,
});
{
  let openCalls = 0;
  const callerSupervisor = { open: async () => { openCalls += 1; },
    instantiate: async () => {}, dispose: async () => validDisposal() };
  const callerSupervisorAttempt = executionConfig(callerSupervisor);
  delete callerSupervisorAttempt.authorityRoot;
  await assert.rejects(executeM7P4FastDifferential(callerSupervisorAttempt),
    /EINVAL|EBADF|socket|file descriptor|fd/i,
  "production adopts only inherited fd3 and never reaches a caller-spawned supervisor");
  assert.equal(openCalls, 0);
}
{
  const supervisor = { open: async () => { throw new Error("must not open"); },
    instantiate: async () => {}, dispose: async () => validDisposal() };
  const productionAttempt = executionConfig(supervisor);
  delete productionAttempt.authorityRoot;
  delete productionAttempt.supervisor;
  await assert.rejects(executeM7P4FastDifferential(productionAttempt),
    /EINVAL|EBADF|socket|file descriptor|fd/i,
  "the production client requires the inherited privileged IPC descriptor and cannot fall back to test authority");
}
{
  const wrongWasm = wasm.slice(); wrongWasm[0] ^= 1;
  let openCalls = 0;
  const supervisor = {
    open: async () => { openCalls += 1; return validAcquisition(); },
    instantiate: async () => {},
    dispose: async () => validDisposal(),
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor, wrongWasm),
    testExecutionDependencies),
  /Wasm differs from its preparation receipt/,
  "the private supervisor is reached only after exact module bytes bind");
  assert.equal(openCalls, 0);
}
{
  let openCalls = 0;
  const mutableWasm = wasm.slice();
  const supervisor = {
    open: async () => { openCalls += 1; return validAcquisition(); },
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async () => validDisposal(),
  };
  const mutatingRevalidation = async (_identity, received) => {
    await Promise.resolve();
    received[0] ^= 1;
    return revalidatedExecutionProvenance();
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor, mutableWasm), {
      ...testExecutionDependencies, revalidatePreparation: mutatingRevalidation,
    }), /Wasm changed before compilation/,
  "a caller cannot alter the Wasm after awaited revalidation but before compilation");
  assert.equal(openCalls, 0,
    "post-await Wasm mutation is rejected before an opaque runtime lease is acquired");
}
{
  let cleanupHandle = null; let disposed = false;
  const supervisor = {
    open: async runnerCleanupHandle => {
      cleanupHandle = runnerCleanupHandle;
      throw new Error("open rejected after hidden allocation");
    },
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async received => {
      assert.equal(received, cleanupHandle); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies),
  /open rejected after hidden allocation/,
  "a rejected open cannot hide allocation from the runner-owned cleanup capability");
  assert.equal(disposed, true,
    "the cleanup capability on an open rejection is terminated and drained");
}
{
  const lease = Object.freeze({ lease: "malformed-acquisition" });
  let disposed = false;
  const supervisor = {
    open: async () => ({ lease, session_id: 7 }),
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies), /acquisition is incomplete/,
  "a fulfilled but malformed acquisition is rejected");
  assert.equal(disposed, true,
    "a lease exposed by a malformed fulfilled acquisition is still disposed");
}
{
  const lease = Object.freeze({ lease: "malformed-nonterminal" });
  const supervisor = {
    open: async () => ({ lease, session_id: 7 }),
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async () => ({ ...validDisposal(), pending_requests: 1, terminated: false }),
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies),
  /execution failed and mandatory supervisor cleanup failed/,
  "a malformed acquisition cannot hide a nonterminal or nonempty cleanup failure");
}
{
  const lease = Object.freeze({ lease: "getter-response" });
  let disposed = false;
  const getterResponse = {};
  Object.defineProperty(getterResponse, "status", {
    enumerable: true, get: () => 0,
  });
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) => ({ instantiated_module: module,
      client: { request: async () => ({ status: 0 }) }, response: getterResponse }),
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies), /response\.status is not an own enumerable data property/,
  "getter-backed protocol transcripts are rejected before the receipt can observe a drifting value");
  assert.equal(disposed, true,
    "a getter-backed transcript failure remains inside the acquisition cleanup region");
}
{
  const supervisor = {
    open: async () => validAcquisition(),
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async () => validDisposal(),
  };
  const callerForgedConfig = { ...executionConfig(supervisor),
    frozenP4Inputs: { expected_closure_bytes: new Uint8Array(),
      expected_closure_identity: { bytes: 0, path: "forged", sha256: "0".repeat(64) } },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(callerForgedConfig,
    testExecutionDependencies), /private differential input has missing or unknown fields/,
  "a caller cannot coordinate a native manifest with a second expected-closure envelope");
}
{
  const forgedClosure = { ...moduleIdentity.source.closure_before,
    sha256: "5".repeat(64) };
  const coordinatedForgedIdentity = {
    ...moduleIdentity,
    source: { ...moduleIdentity.source,
      closure_before: forgedClosure, closure_after: { ...forgedClosure } },
  };
  let openCalls = 0;
  const supervisor = {
    open: async () => { openCalls += 1; return validAcquisition(); },
    instantiate: async () => { throw new Error("must not instantiate"); },
    dispose: async () => validDisposal(),
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor, wasm, coordinatedForgedIdentity),
    testExecutionDependencies), /independently rooted staged M7-DEVID O2 provenance differs/,
  "a coordinated forged before/after module receipt cannot pass execution-time revalidation");
  assert.equal(openCalls, 0);
}
{
  let disposed = false;
  const lease = Object.freeze({ lease: "module-substitution" });
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) =>
      validInstantiation(new WebAssembly.Module(wasm)),
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor),
    testExecutionDependencies),
  /ignored or substituted/,
  "the supervisor must return the exact compiled module object");
  assert.equal(disposed, true,
    "module substitution still triggers mandatory disposal");
}
{
  let disposed = false;
  const lease = Object.freeze({ lease: "invalid-client" });
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) => validInstantiation(module, {}),
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor),
    testExecutionDependencies),
  /protocol-v5 client\.request is absent/,
  "an invalid client is rejected");
  assert.equal(disposed, true,
    "an invalid returned client still triggers mandatory disposal");
}
{
  const lease = Object.freeze({ lease: "instantiation-rejection" });
  let disposed = false;
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async received => {
      assert.equal(received, lease);
      throw new Error("rejected after private worker acquisition");
    },
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies),
  /rejected after private worker acquisition/,
  "an instantiation rejection follows the acquisition-level cleanup path");
  assert.equal(disposed, true,
    "a worker/process acquired before instantiation rejection is disposed exactly through its lease");
}
{
  const lease = Object.freeze({ lease: "attestation-echo" });
  let disposed = false;
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) => ({
      ...validInstantiation(module),
      attestation: { request: { version: 5, op: "instantiate" },
        response: { status: 0 }, module: moduleIdentity.build.wasm },
    }),
    dispose: async received => {
      assert.equal(received, lease); disposed = true; return validDisposal();
    },
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor), testExecutionDependencies),
  /instantiation response has missing or unknown fields/,
  "a mutable supervisor attestation echo cannot stand in for the owned transcript");
  assert.equal(disposed, true);
}
{
  const lease = Object.freeze({ lease: "transcript-copy" });
  const responseEcho = { status: 0 };
  let requestEcho = null;
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module, request }) => {
      requestEcho = request;
      return { instantiated_module: module,
        client: { request: async () => ({ status: 0 }) }, response: responseEcho };
    },
    dispose: async received => {
      assert.equal(received, lease); return validDisposal();
    },
  };
  const result = await executeM7P4FastDifferentialForTest(executionConfig(supervisor), {
    validateNative: fakeNative,
    revalidatePreparation: revalidatedExecutionProvenance,
    run: async () => {
      responseEcho.status = 7;
      assert.throws(() => { requestEcho.version = 4; }, /read only/,
        "the request handed to the supervisor is already immutable");
      return fakeResult();
    },
  });
  assert.equal(result.supervisor.instantiation.response.status, 0,
    "post-validation response mutation cannot alter the owned transcript");
  assert.equal(Object.isFrozen(result.supervisor.instantiation), true);
  assert.equal(Object.isFrozen(result.supervisor.instantiation.request), true);
}
{
  const original = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "set");
  Object.defineProperty(Uint8Array.prototype, "set", { configurable: true,
    value: () => { throw new Error("caller monkeypatch reached"); } });
  const lease = Object.freeze({ lease: "captured-intrinsic" });
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) => validInstantiation(module),
    dispose: async () => validDisposal(),
  };
  try {
    await executeM7P4FastDifferentialForTest(executionConfig(supervisor),
      testExecutionDependencies);
  } finally {
    if (original === undefined) delete Uint8Array.prototype.set;
    else Object.defineProperty(Uint8Array.prototype, "set", original);
  }
}
{
  const lease = Object.freeze({ lease: "bad-disposal" });
  const supervisor = {
    open: async () => validAcquisition(lease),
    instantiate: async (_lease, { module }) => validInstantiation(module),
    dispose: async () => ({ ...validDisposal(), pending_requests: 1 }),
  };
  await assert.rejects(executeM7P4FastDifferentialForTest(
    executionConfig(supervisor),
    testExecutionDependencies),
  /disposal is incomplete/,
  "success is withheld until pending requests are zero and termination is attested");
}
{
  const supervisor = createM7P4TrustedWorkerSupervisorForTest();
  const result = await executeM7P4FastDifferentialForTest(
    executionConfig(supervisor),
    testExecutionDependencies);
  assert.equal(result.supervisor.instantiation.request.m6DiskEvidencePolicy, true);
  assert.equal(result.supervisor.disposal.pending_requests, 0);
  assert.equal(result.supervisor.disposal.terminated, true);
  assert.equal(result.supervisor.disposal.schema, "cadr-m7-p4-fast-disposal-test-v1");
  assert.equal(result.executionReceipt.provenance.schema,
    "cadr-m7-p4-fast-execution-provenance-test-v1");
  assert.equal(result.nativeAuthority.schema, "test-native-authority");
  assert.equal(result.executionReceipt.p4_expected_closure_sha256, "4".repeat(64));
}

for (const required of [
  "selectTrustedHead",
  "stageTrustedSource",
  "collectDescriptorBoundToolchain",
  "copyAndCompileModuleAfterAwait",
  "revalidateM7P4FastPreparation",
  "selectM7P4FrozenExpectedClosure",
  "supervisor.open(preallocationCleanupHandle)",
  "leaseFromMalformedAcquisition",
  "m6DiskEvidencePolicy: true",
]) {
  assert.ok(runnerSource.includes(required),
    `runner retains required precommit/supervisor control: ${required}`);
}
for (const required of [
  "selectSignedSnapshot", "verifySignature", "verifyLineage", "treeIdentity",
  "--no-replace-objects", "--porcelain=v1", "M7_P4_TRUSTED_LINEAGE_FLOOR",
  "M7_P4_SIGNING_SUBKEY", "M7_P4_SIGNING_PRIMARY", "--serve-inherited",
]) {
  assert.ok(authorityRootSource.includes(required),
    `opaque authority root retains trusted-head selection control: ${required}`);
}

inspectM7P4AuthorityRootForTest(trustedAuthorityRoot).daemonCapability.destroy();
await assert.rejects(revalidateM7P4GuixEndpointForTest(trustedAuthorityRoot),
  /retained Guix daemon capability is closed/,
"loss or replacement of the retained daemon capability invalidates further Guix authority");
await closeM7P4AuthorityRootForTest(trustedAuthorityRoot);
assert.throws(() => selectM7P4FrozenExpectedClosure(trustedAuthorityRoot),
  /live privileged capability/,
  "a closed root capability cannot be replayed after its descriptors are released");
execFileSync("git", ["config", "--unset", "core.fsmonitor"], {
  cwd: authorityCheckout, stdio: "ignore",
});
execFileSync("git", ["restore", "--worktree", "."], { cwd: authorityCheckout,
  stdio: "ignore" });
execFileSync("git", ["config", "user.name", "M7 test"], { cwd: authorityCheckout });
execFileSync("git", ["config", "user.email", "m7-test@example.invalid"],
  { cwd: authorityCheckout });
execFileSync("git", ["config", "user.signingkey", "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"],
  { cwd: authorityCheckout });
if (sourceHasLauncherReceipt) {
  await writeFile(resolve(authorityCheckout, "signed-non-immediate-descendant.txt"),
    "must not reuse commit-A receipt\n");
  execFileSync("git", ["add", "signed-non-immediate-descendant.txt"],
    { cwd: authorityCheckout });
  execFileSync("git", ["commit", "-q", "-S", "-m", "signed non-immediate descendant"],
    { cwd: authorityCheckout });
  await assert.rejects(openM7P4AuthorityRootForTest({
    expectedClosure: await open(expectedClosurePath), git: await open("/usr/bin/git"),
    guix: await open("/usr/local/bin/guix"), gpgv: await open("/usr/bin/gpgv"),
    keyring: await open(keyringPath), checkout: authorityCheckout,
  }), /exact single immediate parent/,
  "a validly signed non-immediate descendant cannot reuse release B's commit-A receipt");
} else {
  assert.equal(sourceHasLauncherReceipt, false,
    "source A intentionally lacks the launcher receipt, so receipt-parent policy is inapplicable");
}
await rm(authorityDirectory, { recursive: true, force: true });

{
  const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-launcher-builder-test-"));
  const receiptPath = `${fixture}.receipt.json`;
  const fixtureKeyring = `${fixture}.keyring.gpg`;
  const fixtureGuixHome = `${fixture}.guix-home`;
  let capturedFixture = null;
  try {
    const scripts = resolve(fixture, "scripts"); await mkdir(scripts);
    await writeFile(resolve(scripts, "build-cadr-m7-p4-launcher.scm"),
      await readFile(resolve(ROOT, "scripts/build-cadr-m7-p4-launcher.scm")));
    await writeFile(resolve(scripts, "cadr-m7-p4-authority-root.mjs"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs")));
    await writeFile(resolve(scripts, "cadr-m7-p4-host-supervisor.mjs"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-host-supervisor.mjs")));
    await writeFile(resolve(scripts, "cadr-m7-p4-host-dropper.c"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-host-dropper.c")));
    const executableFixture = resolve(scripts, "signed-executable-mode-fixture.mjs");
    await writeFile(executableFixture, "#!/usr/bin/env node\nprocess.exit(0);\n");
    await chmod(executableFixture, 0o755);
    const ustarBoundaryDirectory = resolve(fixture, "boundary");
    await mkdir(ustarBoundaryDirectory);
    await writeFile(resolve(ustarBoundaryDirectory, "b".repeat(100)), "ustar-boundary\n");
    await writeFile(resolve(ustarBoundaryDirectory, "exact-max-blob.bin"),
      Buffer.alloc(M7_P4_MAX_SOURCE_BLOB_BYTES, 0x41));
    const directoryBoundary = resolve(fixture, "d".repeat(99));
    await mkdir(directoryBoundary); await writeFile(resolve(directoryBoundary, "file"), "dir-99\n");
    const nestedDirectoryBoundary = resolve(fixture, "p", "n".repeat(99));
    await mkdir(nestedDirectoryBoundary, { recursive: true });
    await writeFile(resolve(nestedDirectoryBoundary, "file"), "nested-dir-99\n");
    const prefixBoundaryDirectory = resolve(fixture, ...nestedPrefix.split("/"), "n".repeat(95));
    await mkdir(prefixBoundaryDirectory, { recursive: true });
    await writeFile(resolve(prefixBoundaryDirectory, "file"), "prefix-154-suffix-100\n");
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync("git", ["config", "user.name", "M7 test"], { cwd: fixture });
    execFileSync("git", ["config", "user.email", "m7-test@example.invalid"], { cwd: fixture });
    execFileSync("git", ["config", "user.signingkey", "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"],
      { cwd: fixture });
    execFileSync("git", ["add", "."], { cwd: fixture });
    execFileSync("git", ["commit", "-q", "-S", "-m", "synthetic signed commit A"],
      { cwd: fixture });
    await mkdir(fixtureGuixHome);
    const originalDerivation = execFileSync("/usr/local/bin/guix",
      ["time-machine", "--commit=230aa373f315f247852ee07dff34146e9b480aec", "--",
        "build", "--derivations", "-f", resolve(scripts, "build-cadr-m7-p4-launcher.scm")],
      { cwd: fixture, encoding: "utf8", env: { HOME: fixtureGuixHome,
        XDG_CONFIG_HOME: resolve(fixtureGuixHome, ".config"),
        XDG_CACHE_HOME: resolve(fixtureGuixHome, ".cache"), LANG: "C", LC_ALL: "C", TZ: "UTC",
        M7_P4_SOURCE: fixture } }).trim();
    const signedTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"],
      { cwd: fixture, encoding: "utf8" }).trim();
    capturedFixture = await captureM7P4SignedArchiveForTest(
      execFileSync("git", ["archive", "--format=tar", "HEAD"],
        { cwd: fixture, maxBuffer: M7_P4_MAX_ARCHIVE_BYTES + 1 }), signedTree);
    const capturedDerivation = execFileSync("/usr/local/bin/guix",
      ["time-machine", "--commit=230aa373f315f247852ee07dff34146e9b480aec", "--",
        "build", "--derivations", "-f",
        resolve(capturedFixture.directory, "scripts/build-cadr-m7-p4-launcher.scm")],
      { cwd: capturedFixture.directory, encoding: "utf8", env: { HOME: fixtureGuixHome,
        XDG_CONFIG_HOME: resolve(fixtureGuixHome, ".config"),
        XDG_CACHE_HOME: resolve(fixtureGuixHome, ".cache"), LANG: "C", LC_ALL: "C", TZ: "UTC",
        M7_P4_SOURCE: capturedFixture.directory } }).trim();
    assert.equal(capturedDerivation, originalDerivation,
      "production-equivalent signed archive capture preserves 100644/100755 NAR identity");
    await writeFile(resolve(scripts, "build-cadr-m7-p4-launcher.scm"),
      "(error \"post-sign worktree builder substitution reached\")\n");
    await writeFile(resolve(scripts, "cadr-m7-p4-authority-root.mjs"),
      "throw new Error('post-sign worktree entrypoint substitution reached');\n");
    await writeFile(fixtureKeyring, execFileSync("gpg", ["--export",
      "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"]), { mode: 0o600 });
    await chmod(fixtureKeyring, 0o600);
    assert.equal((await stat(fixtureKeyring)).mode & 0o777, 0o600);
    const generated = JSON.parse(execFileSync(process.execPath,
      [resolve(ROOT, "scripts/generate-cadr-m7-p4-launcher-receipt.mjs"),
        "--source-a", fixture, "--keyring", fixtureKeyring, "--output", receiptPath],
      { cwd: ROOT, encoding: "utf8" }));
    assert.match(generated.derivation, /^\/gnu\/store\/.+\.drv$/);
    assert.match(generated.output, /^\/gnu\/store\//);
    assert.match(generated.node_derivation, /^\/gnu\/store\/.+\.drv$/);
    assert.match(generated.node_output, /^\/gnu\/store\//);
    assert.equal(generated.derivation, originalDerivation,
      "signed checkout and mode-preserving private reconstruction evaluate to the exact same derivation");
    assert.equal(generated.source_commit,
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture, encoding: "utf8" }).trim());
    assert.equal(JSON.parse(await readFile(receiptPath, "utf8")).derivation,
      generated.derivation);
    assert.equal((await stat(receiptPath)).mode & 0o777, 0o600,
      "atomically installed receipt retains restrictive temporary-file mode");
    const probe = spawnSync(generated.entrypoint_path, [], { encoding: "utf8", timeout: 5000,
      env: { HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC" } });
    assert.notEqual(probe.status, 0);
    assert.match(probe.stderr, /M7 P4 authority supervisor: direct privileged use requires/,
      "the real Guix-built launcher executes Node and the authority entrypoint");
    for (const forged of [
      { ...generated, derivation_sha256: "0".repeat(64) },
      { ...generated, guix_channel_commit: "0".repeat(40) },
      { ...generated, entrypoint_path: `${generated.output}/bin/shape-valid-forgery.mjs` },
      { ...generated, entrypoint_sha256: "1".repeat(64) },
    ]) {
      await assert.rejects(validateM7P4InstalledLauncherReceiptForTest(forged),
        /receipt|derivation|entrypoint/,
      "shape-valid signed receipt field forgery is rejected semantically");
    }
    assert.throws(() => execFileSync(process.execPath,
      [resolve(ROOT, "scripts/generate-cadr-m7-p4-launcher-receipt.mjs"),
        "--source-a", fixture, "--keyring", fixtureKeyring, "--output", receiptPath],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" }), /Command failed/,
    "no-replace publication rejects an existing final receipt");
    assert.equal((await readdir(resolve(receiptPath, ".."))).some(name =>
      name.includes(".receipt.json.") && name.endsWith(".tmp")), false,
    "failed no-replace publication leaves no sibling temporary receipt");
  } finally {
    await rm(fixture, { recursive: true, force: true });
    await unlink(receiptPath).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
    await unlink(fixtureKeyring).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
    await rm(fixtureGuixHome, { recursive: true, force: true });
    if (capturedFixture !== null) {
      await rm(capturedFixture.directory, { recursive: true, force: true });
    }
  }
}

{
  const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-launcher-symlink-test-"));
  const fixtureKeyring = `${fixture}.keyring.gpg`;
  const receiptPath = `${fixture}.receipt.json`;
  try {
    const scripts = resolve(fixture, "scripts"); await mkdir(scripts);
    await writeFile(resolve(scripts, "build-cadr-m7-p4-launcher.scm"),
      await readFile(resolve(ROOT, "scripts/build-cadr-m7-p4-launcher.scm")));
    await writeFile(resolve(scripts, "cadr-m7-p4-authority-root.mjs"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs")));
    await symlink("/etc/passwd", resolve(fixture, "signed-outside-link"));
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync("git", ["config", "user.name", "M7 test"], { cwd: fixture });
    execFileSync("git", ["config", "user.email", "m7-test@example.invalid"], { cwd: fixture });
    execFileSync("git", ["config", "user.signingkey", "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"],
      { cwd: fixture });
    execFileSync("git", ["add", "scripts", "signed-outside-link"], { cwd: fixture });
    execFileSync("git", ["commit", "-q", "-S", "-m", "signed symlink attack"], { cwd: fixture });
    await writeFile(fixtureKeyring, execFileSync("gpg", ["--export",
      "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"]), { mode: 0o600 });
    await chmod(fixtureKeyring, 0o600);
    assert.throws(() => execFileSync(process.execPath,
      [resolve(ROOT, "scripts/generate-cadr-m7-p4-launcher-receipt.mjs"),
        "--source-a", fixture, "--keyring", fixtureKeyring, "--output", receiptPath],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" }), /Command failed/,
    "a clean signed symlink to an outside file is rejected before building");
    assert.equal(await readFile(receiptPath).then(() => true, () => false), false);
  } finally {
    await rm(fixture, { recursive: true, force: true });
    await unlink(fixtureKeyring).catch(() => {}); await unlink(receiptPath).catch(() => {});
  }
}

for (const [label, unsafePath] of [
  ["long-basename", `pax/${"l".repeat(101)}`],
  ["long-prefix", `${"p".repeat(80)}/${"q".repeat(80)}/${"r".repeat(80)}/file`],
  ["root-directory-100", `${"d".repeat(100)}/file`],
  ["root-directory-101", `${"d".repeat(101)}/file`],
  ["nested-name-100", `p/${"n".repeat(100)}/file`],
  ["nested-prefix-155-total-256", `${"p".repeat(55)}/${"q".repeat(99)}/${"n".repeat(95)}/file`],
]) {
  const fixture = await mkdtemp(resolve(tmpdir(), `cadr-m7-launcher-pax-${label}-`));
  const fixtureKeyring = `${fixture}.keyring.gpg`; const receiptPath = `${fixture}.receipt.json`;
  try {
    const scripts = resolve(fixture, "scripts"); await mkdir(scripts);
    await writeFile(resolve(scripts, "build-cadr-m7-p4-launcher.scm"),
      await readFile(resolve(ROOT, "scripts/build-cadr-m7-p4-launcher.scm")));
    await writeFile(resolve(scripts, "cadr-m7-p4-authority-root.mjs"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs")));
    const target = resolve(fixture, unsafePath);
    await mkdir(resolve(target, ".."), { recursive: true }); await writeFile(target, "pax-trigger\n");
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync("git", ["config", "user.name", "M7 test"], { cwd: fixture });
    execFileSync("git", ["config", "user.email", "m7-test@example.invalid"], { cwd: fixture });
    execFileSync("git", ["config", "user.signingkey", "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"],
      { cwd: fixture });
    execFileSync("git", ["add", "."], { cwd: fixture });
    execFileSync("git", ["commit", "-q", "-S", "-m", `signed ${label} PAX attack`],
      { cwd: fixture });
    await writeFile(fixtureKeyring, execFileSync("gpg", ["--export",
      "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"]), { mode: 0o600 });
    await chmod(fixtureKeyring, 0o600);
    assert.throws(() => execFileSync(process.execPath,
      [resolve(ROOT, "scripts/generate-cadr-m7-p4-launcher-receipt.mjs"),
        "--source-a", fixture, "--keyring", fixtureKeyring, "--output", receiptPath],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" }), error =>
      /signed source (?:inventory member is unsafe, unsupported, or oversized|directory requires unsupported PAX)/.test(
        String(error.stderr)),
    `${label} PAX archive is rejected by the production parser before Guix build`);
    assert.equal(await readFile(receiptPath).then(() => true, () => false), false);
    assert.equal((await readdir(resolve(receiptPath, ".."))).some(name =>
      name.includes(".receipt.json.") && name.endsWith(".tmp")), false,
    `${label} PAX rejection leaves no receipt temporary`);
  } finally {
    await rm(fixture, { recursive: true, force: true });
    await unlink(fixtureKeyring).catch(() => {}); await unlink(receiptPath).catch(() => {});
  }
}

{
  const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-launcher-oversize-test-"));
  const fixtureKeyring = `${fixture}.keyring.gpg`; const receiptPath = `${fixture}.receipt.json`;
  try {
    const scripts = resolve(fixture, "scripts"); await mkdir(scripts);
    await writeFile(resolve(scripts, "build-cadr-m7-p4-launcher.scm"),
      await readFile(resolve(ROOT, "scripts/build-cadr-m7-p4-launcher.scm")));
    await writeFile(resolve(scripts, "cadr-m7-p4-authority-root.mjs"),
      await readFile(resolve(ROOT, "scripts/cadr-m7-p4-authority-root.mjs")));
    await writeFile(resolve(fixture, "sparse-ish-zero-blob.bin"),
      Buffer.alloc(M7_P4_MAX_SOURCE_BLOB_BYTES + 1));
    execFileSync("git", ["init", "-q"], { cwd: fixture });
    execFileSync("git", ["config", "user.name", "M7 test"], { cwd: fixture });
    execFileSync("git", ["config", "user.email", "m7-test@example.invalid"], { cwd: fixture });
    execFileSync("git", ["config", "user.signingkey", "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"],
      { cwd: fixture });
    execFileSync("git", ["add", "."], { cwd: fixture });
    execFileSync("git", ["commit", "-q", "-S", "-m", "signed one-byte oversize attack"],
      { cwd: fixture });
    await writeFile(fixtureKeyring, execFileSync("gpg", ["--export",
      "3EA36B492D7E76450D2C59267B55A97A62F6D6C0"]), { mode: 0o600 });
    await chmod(fixtureKeyring, 0o600);
    assert.throws(() => execFileSync(process.execPath,
      [resolve(ROOT, "scripts/generate-cadr-m7-p4-launcher-receipt.mjs"),
        "--source-a", fixture, "--keyring", fixtureKeyring, "--output", receiptPath],
      { cwd: ROOT, encoding: "utf8", stdio: "pipe" }), error =>
      /signed source inventory member is unsafe, unsupported, or oversized/.test(
        String(error.stderr)),
    "signed sparse-ish blob one byte over profile maximum is rejected before Guix");
    assert.equal(await readFile(receiptPath).then(() => true, () => false), false);
    assert.equal((await readdir(resolve(receiptPath, ".."))).some(name =>
      name.includes(".receipt.json.") && name.endsWith(".tmp")), false,
    "oversize rejection leaves no receipt temporary");
  } finally {
    await rm(fixture, { recursive: true, force: true });
    await unlink(fixtureKeyring).catch(() => {}); await unlink(receiptPath).catch(() => {});
  }
}

console.log("M7 P4 READY4 fast differential synthetic and adversarial tests passed");
