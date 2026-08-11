/*
 * M14's one-shot publication capability for a canonical static-comparison
 * report.  It never publishes an archive.  The only output sequence is:
 *
 *   private temp -> fsync -> ready -> link(final) -> verify(final)
 *       -> unlink(ready) -> fsync(directory)
 *
 * The final link is the linearization point.  Once it exists no failure path
 * unlinks, overwrites, or retries it automatically.
 */
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCadrM14StaticReproductionComparison,
  serializeCadrM14StaticReproductionComparison } from "./cadr-m14-static-reproduction-comparison.mjs";

const APPLY = Reflect.apply;
const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(MODULE_PATH), "..");
const LINK_HELPER = resolve(ROOT, "build/cadr-m14/cadr-m14-link-helper");
const O_TMPFILE = 0o20000000;
const PROFILE = "CADR-WEB-303/CW4-MUSEUM/publication-capability-v3";
const CAPABILITIES = new WeakMap();
const RECEIPTS = new WeakSet();
const TEST_HOOKS = new WeakMap();
/* The production boundary is intentionally unmintable while the policy
 * registry is empty.  Tests exercise the identical state machine, but only
 * below this fixed sibling root: no exported token takes a root or grants
 * access to build/cadr-m14/published. */
const PRODUCTION_BOUNDARY = Object.freeze({ name: "published", testOnly: false });
const TEST_BOUNDARY = Object.freeze({ name: "test-published", testOnly: true });
const SAFE_BASENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

/* Retain native FileHandle operations before this module exposes a public API.
 * New handles are always driven through these descriptors, never through a
 * caller-mutable FileHandle prototype or accessor. */
async function captureFileHandleMethods() {
  const probe = await open(MODULE_PATH, constants.O_RDONLY | constants.O_CLOEXEC | (constants.O_NOFOLLOW ?? 0));
  try {
    const prototype = Object.getPrototypeOf(probe);
    const methods = Object.create(null);
    for (const name of ["chmod", "read", "stat", "write", "sync"]) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (descriptor === undefined || !("value" in descriptor) || typeof descriptor.value !== "function" || descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new TypeError(`C-M14 publication: native FileHandle.${name} is not an own data method`);
      }
      methods[name] = descriptor.value;
    }
    const close = Object.getOwnPropertyDescriptor(probe, "close");
    const fd = Object.getOwnPropertyDescriptor(prototype, "fd");
    if (close === undefined || !("value" in close) || typeof close.value !== "function" || close.get !== undefined || close.set !== undefined ||
        fd === undefined || typeof fd.get !== "function" || fd.set !== undefined) {
      throw new TypeError("C-M14 publication: native FileHandle close/fd descriptor differs");
    }
    return Object.freeze({ ...methods, fd: fd.get });
  } finally { await APPLY(Object.getOwnPropertyDescriptor(probe, "close").value, probe, []); }
}
const FILE_HANDLE = await captureFileHandleMethods();

function fail(message) { throw new TypeError(`C-M14 publication: ${message}`); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function sha256(value, label) { if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be SHA-256`); return value; }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function freeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function optionalData(value, label, keys) {
  if (value === undefined) return Object.create(null);
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(`${label} must be a plain object`);
  const actual = Reflect.ownKeys(value);
  if (actual.some(key => typeof key !== "string") || actual.some(key => !keys.includes(key))) fail(`${label} has unsupported fields`);
  const result = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) { result[key] = undefined; continue; }
    if (!("value" in descriptor) || !descriptor.enumerable) fail(`${label}.${key} must be an enumerable data field`);
    result[key] = descriptor.value;
  }
  return result;
}
function exactData(value, label, keys) {
  const result = optionalData(value, label, keys);
  if (Reflect.ownKeys(result).length !== keys.length || keys.some(key => result[key] === undefined)) fail(`${label} has missing fields`);
  return result;
}
function safeBasename(value) {
  if (typeof value !== "string" || !SAFE_BASENAME.test(value) || value === "." || value === ".." ||
      value !== basename(value) || value.includes("/") || value.includes("\\")) fail("publication name must be one safe basename of at most 128 ASCII characters");
  return value;
}
function fileIdentity(info, label, oneLink = false) {
  if (!info.isFile() || info.isSymbolicLink() || (oneLink && info.nlink !== 1n)) fail(`${label} must be a ${oneLink ? "one-link " : ""}regular non-symlink file`);
  return freeze({ dev: info.dev, ino: info.ino, nlink: info.nlink, size: info.size, ctimeNs: info.ctimeNs,
    mtimeNs: info.mtimeNs, mode: info.mode & 0o777n });
}
function directoryIdentity(info, label) {
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`${label} must be a non-symlink directory`);
  return freeze({ dev: info.dev, ino: info.ino, ctimeNs: info.ctimeNs, mtimeNs: info.mtimeNs });
}
function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size &&
    left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs && left.mode === right.mode;
}
function sameObject(left, right) { return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mode === right.mode; }
function sameDirectory(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs;
}
function sameDirectoryObject(left, right) { return left.dev === right.dev && left.ino === right.ino; }
async function regularDirectory(path, label) { return directoryIdentity(await lstat(path, { bigint: true }), label); }
async function noFollow(path, label, directory = false, write = false, exclusive = false) {
  const flags = (write ? constants.O_WRONLY : constants.O_RDONLY) | constants.O_CLOEXEC | (constants.O_NOFOLLOW ?? 0) |
    (directory ? constants.O_DIRECTORY : 0) | (write ? constants.O_CREAT : 0) | (exclusive ? constants.O_EXCL : 0);
  try { return await open(path, flags, write ? 0o600 : undefined); }
  catch (error) { fail(`${label} could not be opened without following a symlink: ${error?.code ?? "unknown"}`); }
}
function ops(handle, label) {
  const fd = APPLY(FILE_HANDLE.fd, handle, []);
  const close = Object.getOwnPropertyDescriptor(handle, "close");
  if (!Number.isSafeInteger(fd) || fd < 0 || close === undefined || !("value" in close) || typeof close.value !== "function") fail(`${label} lacks a descriptor`);
  /* Native FileHandle methods consult `this.fd`; install an immutable own data
   * field before the captured native methods are exposed to asynchronous work. */
  Object.defineProperty(handle, "fd", { value: fd, configurable: false, enumerable: false, writable: false });
  return freeze({ close: (...args) => APPLY(close.value, handle, args), fd,
    chmod: (...args) => APPLY(FILE_HANDLE.chmod, handle, args), read: (...args) => APPLY(FILE_HANDLE.read, handle, args), stat: (...args) => APPLY(FILE_HANDLE.stat, handle, args),
    sync: (...args) => APPLY(FILE_HANDLE.sync, handle, args), write: (...args) => APPLY(FILE_HANDLE.write, handle, args) });
}
function fdPath(fd, name = undefined) {
  if (process.platform !== "linux" || !Number.isSafeInteger(fd) || fd < 0) fail("publication requires Linux retained /proc/self/fd descriptors");
  return name === undefined ? `/proc/self/fd/${fd}` : `/proc/self/fd/${fd}/${name}`;
}
async function readOps(operations, expectedSize) {
  if (expectedSize > BigInt(Number.MAX_SAFE_INTEGER)) fail("report exceeds exact JavaScript byte range");
  const bytes = Buffer.alloc(Number(expectedSize)); let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesRead } = await operations.read(bytes, offset, bytes.byteLength - offset, offset);
    if (bytesRead <= 0) fail("file changed while it was read"); offset += bytesRead;
  }
  const extra = Buffer.alloc(1); if ((await operations.read(extra, 0, 1, offset)).bytesRead !== 0) fail("file grew while it was read");
  return bytes;
}
async function writeOps(operations, bytes) {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesWritten } = await operations.write(bytes, offset, bytes.byteLength - offset, offset);
    if (bytesWritten <= 0) fail("private temporary report short write"); offset += bytesWritten;
  }
}
async function openChildDirectory(parentOps, name, label) {
  const path = fdPath(parentOps.fd, name); const before = directoryIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
  let childOps = null;
  try {
    childOps = ops(await noFollow(path, label, true), label); const descriptor = directoryIdentity(await childOps.stat({ bigint: true }), `${label} descriptor`);
    const after = directoryIdentity(await lstat(path, { bigint: true }), `${label} pathname`);
    if (!sameDirectory(before, descriptor) || !sameDirectory(before, after)) fail(`${label} changed while captured`);
    return { identity: descriptor, ops: childOps };
  } catch (error) { if (childOps !== null) try { await childOps.close(); } catch {} throw error; }
}
async function closeCaptured(records) { for (const record of records.reverse()) if (record !== null) try { await record.ops.close(); } catch {} }
/* No output authority is obtained through `build/...` path traversal.  Each
 * ancestor is opened O_DIRECTORY|O_NOFOLLOW from the retained repo root and
 * recorded by identity; a later replacement is detected by another walk. */
async function capturePublicationTree(createPublication, boundary) {
  const rootPathIdentity = await regularDirectory(ROOT, "repository root pathname"); let root = null; let build = null; let cadr = null; let publication = null;
  try {
    root = { ops: ops(await noFollow(ROOT, "repository root", true), "repository root") };
    root.identity = directoryIdentity(await root.ops.stat({ bigint: true }), "repository root descriptor");
    const rootAfter = await regularDirectory(ROOT, "repository root pathname");
    if (!sameDirectory(rootPathIdentity, root.identity) || !sameDirectory(rootPathIdentity, rootAfter)) fail("repository root changed while captured");
    build = await openChildDirectory(root.ops, "build", "M14 build root");
    cadr = await openChildDirectory(build.ops, "cadr-m14", "M14 CADR build root");
    if (createPublication) try { await mkdir(fdPath(cadr.ops.fd, boundary.name), { mode: 0o755 }); } catch (error) { if (error?.code !== "EEXIST") throw error; }
    publication = await openChildDirectory(cadr.ops, boundary.name, `M14 ${boundary.testOnly ? "synthetic test" : "production"} publication root`);
    const ancestry = freeze({ root: root.identity, build: build.identity, cadr: cadr.identity, publication: publication.identity });
    await closeCaptured([root, build, cadr]); return { ancestry, directoryIdentity: publication.identity, directoryOps: publication.ops };
  } catch (error) { await closeCaptured([root, build, cadr, publication]); throw error; }
}
function hooksFor(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object" || !TEST_HOOKS.has(value)) fail("publication test hooks are not recognized");
  return TEST_HOOKS.get(value);
}
async function hook(hooks, name, ...args) { if (hooks?.[name] !== undefined) return hooks[name](...args); }
async function sealHelperSnapshot(directoryOps, bytes, expectedLinkHelperSha256, hooks) {
  let writer = null; let sealed = null;
  try {
    writer = ops(await open(fdPath(directoryOps.fd), O_TMPFILE | constants.O_DIRECTORY | constants.O_RDWR | constants.O_CLOEXEC, 0o500), "anonymous link-helper snapshot");
    await writeOps(writer, bytes); await writer.sync(); await writer.chmod(0o500);
    const written = fileIdentity(await writer.stat({ bigint: true }), "anonymous link-helper snapshot descriptor");
    if (written.nlink !== 0n || written.mode !== 0o500n || written.size !== BigInt(bytes.byteLength)) fail("anonymous link-helper snapshot identity differs");
    sealed = ops(await open(fdPath(writer.fd), constants.O_RDONLY | constants.O_CLOEXEC), "sealed link-helper snapshot");
    const reopened = fileIdentity(await sealed.stat({ bigint: true }), "sealed link-helper snapshot descriptor");
    if (!sameObject(written, reopened) || reopened.nlink !== 0n || reopened.mode !== 0o500n || hash(await readOps(sealed, reopened.size)) !== expectedLinkHelperSha256) fail("sealed link-helper snapshot differs");
    await writer.close(); writer = null; await hook(hooks, "afterHelperSnapshot", sealed, reopened);
    return freeze({ helperIdentity: reopened, helperSha256: expectedLinkHelperSha256, helperOps: sealed });
  } catch (error) { if (sealed !== null) try { await sealed.close(); } catch {} if (writer !== null) try { await writer.close(); } catch {} throw error; }
}
async function helperIdentity(directoryOps, expectedLinkHelperSha256, hooks) {
  const before = fileIdentity(await lstat(LINK_HELPER, { bigint: true }), "link helper pathname");
  let helperOps = null;
  try {
    helperOps = ops(await noFollow(LINK_HELPER, "link helper"), "link helper");
    const descriptor = fileIdentity(await helperOps.stat({ bigint: true }), "link helper descriptor");
    const pathname = fileIdentity(await lstat(LINK_HELPER, { bigint: true }), "link helper pathname");
    if (!sameFile(before, descriptor) || !sameFile(before, pathname) || descriptor.nlink !== 1n || descriptor.mode !== 0o755n) fail("link helper changed while captured or has unsafe mode/link count");
    const bytes = await readOps(helperOps, descriptor.size); const after = fileIdentity(await helperOps.stat({ bigint: true }), "link helper descriptor");
    if (!sameFile(descriptor, after) || hash(bytes) !== expectedLinkHelperSha256) fail("link helper differs from caller's independent pin");
    const snapshot = await sealHelperSnapshot(directoryOps, bytes, expectedLinkHelperSha256, hooks); await helperOps.close(); helperOps = null; return snapshot;
  } catch (error) { if (helperOps !== null) try { await helperOps.close(); } catch {} throw error; }
}
async function revalidateHelper(identity) {
  const descriptor = fileIdentity(await identity.helperOps.stat({ bigint: true }), "link helper descriptor");
  if (!sameFile(identity.helperIdentity, descriptor) || descriptor.nlink !== 0n || descriptor.mode !== 0o500n ||
      hash(await readOps(identity.helperOps, descriptor.size)) !== identity.helperSha256) fail("sealed link helper snapshot became stale");
}
async function descriptorLink(record, readyOps, name) {
  await revalidateHelper(record.helper);
  await hook(record.hooks, "beforeFinalLink", name);
  await revalidateDirectory(record);
  await new Promise((resolveFlight, rejectFlight) => {
    const child = spawn(fdPath(record.helper.helperOps.fd), [name], { cwd: "/",
      env: { LANG: "C", LC_ALL: "C" }, stdio: ["ignore", "ignore", "pipe", readyOps.fd, record.directoryOps.fd] });
    let stderr = ""; child.stderr.on("data", bytes => { stderr += bytes.toString("utf8"); });
    child.once("error", rejectFlight); child.once("exit", code => code === 0 ? resolveFlight() : rejectFlight(new Error(`descriptor link helper failed (${code}): ${stderr.trim()}`)));
  });
  await hook(record.hooks, "afterDescriptorLink", name);
}
async function closeOne(record, key) {
  if (record[`${key}Closed`]) return;
  await hook(record.hooks, "beforeClose", key); await record[`${key}Ops`].close(); record[`${key}Closed`] = true; await hook(record.hooks, "onClosed", key);
}
async function closeDescriptors(record) {
  let failure = null; for (const key of ["helper", "directory"]) try { await closeOne(record, key); } catch (error) { failure ??= error; }
  if (failure !== null) throw failure;
}
function recordFor(capability) {
  if (capability === null || typeof capability !== "object" || !CAPABILITIES.has(capability)) fail("publication capability is not recognized");
  return CAPABILITIES.get(capability);
}
async function revalidateDirectory(record) {
  const descriptor = directoryIdentity(await record.directoryOps.stat({ bigint: true }), "publication directory descriptor");
  const current = await capturePublicationTree(false, record.boundary);
  try {
  /* Publication itself changes directory timestamps.  Only retained
   * device/inode identity distinguishes a replacement from those expected
   * mutations, and all child operations remain descriptor-relative. */
    if (!sameDirectoryObject(record.directoryIdentity, descriptor) || !sameDirectoryObject(record.directoryIdentity, current.directoryIdentity) ||
        !sameDirectoryObject(record.ancestry.root, current.ancestry.root) || !sameDirectoryObject(record.ancestry.build, current.ancestry.build) ||
        !sameDirectoryObject(record.ancestry.cadr, current.ancestry.cadr)) fail("publication directory ancestry became stale");
  } finally { try { await current.directoryOps.close(); } catch {} }
}
async function noFinal(record, name) {
  try { await lstat(fdPath(record.directoryOps.fd, name), { bigint: true }); fail("publication destination already exists; overwrite is forbidden"); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}
function finalInfo(identity, sha256) { return freeze({ dev: identity.dev.toString(10), ino: identity.ino.toString(10), sha256, byteCount: Number(identity.size) }); }
async function openReport(record, name, expected = null, oneLink = false) {
  const path = fdPath(record.directoryOps.fd, name); const pathname = fileIdentity(await lstat(path, { bigint: true }), `${name} pathname`, oneLink);
  let handle = null;
  try {
    handle = ops(await noFollow(path, name), name); const descriptor = fileIdentity(await handle.stat({ bigint: true }), `${name} descriptor`, oneLink);
    if (!sameObject(pathname, descriptor) || (expected !== null && (!sameObject(expected, pathname) || !sameObject(expected, descriptor)))) {
      fail(`${name} identity differs from captured report`);
    }
    const bytes = await readOps(handle, descriptor.size); if (hash(bytes) !== record.reportSha256) fail(`${name} bytes differ from captured report`);
    return { identity: descriptor, operations: handle };
  } catch (error) { if (handle !== null) try { await handle.close(); } catch {} throw error; }
}
/* A successful descriptor read is not enough after link(2): the name can be
 * silently replaced while the original descriptor remains readable.  Keep the
 * original final descriptor until the terminal boundary and require both it
 * and a fresh descriptor-relative pathname open to name the same report. */
async function finalBindingIsExact(record, name, expected, heldOps) {
  if (expected === null || heldOps === null) return false;
  try {
    const held = fileIdentity(await heldOps.stat({ bigint: true }), "final report held descriptor");
    if (!sameObject(expected, held) || hash(await readOps(heldOps, held.size)) !== record.reportSha256) return false;
    const pathname = await openReport(record, name, expected);
    try { return sameObject(expected, pathname.identity) && hash(await readOps(pathname.operations, pathname.identity.size)) === record.reportSha256; }
    finally { await pathname.operations.close(); }
  } catch { return false; }
}
/* A helper error is not evidence that link(2) did not linearize: it may have
 * linked and then lost its completion.  Probe only through the retained output
 * directory and accept an exact final/ready inode+hash match as publication. */
async function observeLinkAttempt(record, name, readyIdentity) {
  try {
    const opened = await openReport(record, name, readyIdentity);
    try { return freeze({ state: "exact", final: finalInfo(opened.identity, record.reportSha256) }); }
    finally { await opened.operations.close(); }
  } catch {
    try { await lstat(fdPath(record.directoryOps.fd, name), { bigint: true }); return freeze({ state: "indeterminate" }); }
    catch (error) { return freeze({ state: error?.code === "ENOENT" ? "absent" : "indeterminate" }); }
  }
}
function receipt({ disposition, name, final = null, cleanupConfirmed, directorySyncConfirmed, cleanupDirectorySyncConfirmed }) {
  const published = disposition !== "not-published";
  const value = freeze({ schema: "cadr-m14-publication-receipt-v3", profile: PROFILE, disposition, published, cleanupConfirmed,
    directorySyncConfirmed, cleanupDirectorySyncConfirmed, retryPolicy: "never-automatic", name, report: freeze({ sha256: null, byteCount: null }), final });
  /* The reporting hash is filled by receiptFor so every receipt remains bound
   * to the exact canonical comparison payload, not an archive. */
  return value;
}
function receiptFor(record, fields) {
  const value = receipt(fields); const bound = freeze({ ...value, report: freeze({ sha256: record.reportSha256, byteCount: record.reportBytes.byteLength }) });
  RECEIPTS.add(bound); return bound;
}
async function removePrivate(record, names) {
  let confirmed = true; let sync = false;
  for (const name of names) if (name !== null) {
    try { await hook(record.hooks, "cleanupReady", fdPath(record.directoryOps.fd, name));
      if (record.hooks?.cleanupReady === undefined) await unlink(fdPath(record.directoryOps.fd, name));
    } catch (error) { if (error?.code !== "ENOENT") confirmed = false; }
  }
  if (confirmed) try { await hook(record.hooks, "syncCleanupDirectory", record.directoryOps); if (record.hooks?.syncCleanupDirectory === undefined) await record.directoryOps.sync(); sync = true; } catch { sync = false; }
  return { confirmed, sync };
}
async function terminalClose(record, receipt = undefined) {
  if (record.closeFlight === null) record.closeFlight = closeDescriptors(record);
  try { await record.closeFlight; record.phase = "CLOSED"; }
  catch (error) {
    record.phase = "CLOSE_FAILED";
    if (receipt !== undefined && error !== null && (typeof error === "object" || typeof error === "function")) {
      Object.defineProperty(error, "receipt", { value: receipt, enumerable: true, configurable: false, writable: false });
    }
    throw error;
  }
}
async function publish(record, name) {
  const nonce = randomUUID().replaceAll("-", ""); const temp = `.cadr-m14-${nonce}.tmp`; const ready = `.cadr-m14-${nonce}.ready`;
  let linkAttempted = false; let finalLinked = false; let final = null; let finalOps = null; let finalIdentity = null; let readyOps = null; let readyIdentity = null;
  let readyUnlinkAttempted = false; let readyUnlinked = false;
  try {
    await revalidateDirectory(record); await noFinal(record, name);
    const tempOps = ops(await noFollow(fdPath(record.directoryOps.fd, temp), "private temporary report", false, true, true), "private temporary report");
    try {
      await hook(record.hooks, "afterTempCreate", tempOps);
      await hook(record.hooks, "beforeTempWrite", tempOps); await writeOps(tempOps, record.reportBytes); await hook(record.hooks, "afterTempWrite", tempOps);
      await hook(record.hooks, "beforeTempSync", tempOps); await hook(record.hooks, "syncTemp", tempOps); if (record.hooks?.syncTemp === undefined) await tempOps.sync(); await hook(record.hooks, "afterTempSync", tempOps);
      const tempIdentity = fileIdentity(await tempOps.stat({ bigint: true }), "private temporary report descriptor", true);
      if (tempIdentity.size !== BigInt(record.reportBytes.byteLength)) fail("private temporary report length differs");
    } finally {
      try { await hook(record.hooks, "beforeTempClose", tempOps); await tempOps.close(); await hook(record.hooks, "afterTempClose", tempOps); }
      catch (error) { try { await tempOps.close(); } catch {} throw error; }
    }
    await hook(record.hooks, "beforeRenameReady", temp, ready); await hook(record.hooks, "renameReady", temp, ready); if (record.hooks?.renameReady === undefined) await rename(fdPath(record.directoryOps.fd, temp), fdPath(record.directoryOps.fd, ready)); await hook(record.hooks, "afterRenameReady", temp, ready);
    await hook(record.hooks, "beforeReadyOpen", ready);
    const readyOpened = await openReport(record, ready, null, true);
    readyOps = readyOpened.operations;
    await hook(record.hooks, "afterReadyOpen", readyOps);
    /* `openVerified` needs an inode comparison.  Reopen the ready descriptor
     * after its private creation and bind that exact identity before linking. */
    readyIdentity = fileIdentity(await readyOps.stat({ bigint: true }), "ready report descriptor", true);
    const readyBytes = await readOps(readyOps, readyIdentity.size); if (hash(readyBytes) !== record.reportSha256) fail("ready report bytes differ from canonical comparison");
    await noFinal(record, name); linkAttempted = true; await descriptorLink(record, readyOps, name); finalLinked = true; await hook(record.hooks, "afterFinalLink", name);
    await hook(record.hooks, "beforeFinalOpen", name);
    const finalOpened = await openReport(record, name, readyIdentity, false); finalOps = finalOpened.operations; finalIdentity = finalOpened.identity;
    try { await hook(record.hooks, "afterFinalOpen", finalOpened.operations); await hook(record.hooks, "afterFinalStat", finalOpened.identity); await hook(record.hooks, "afterFinalRead", finalOpened.operations);
      await hook(record.hooks, "afterFinalHash", finalOpened.identity); await hook(record.hooks, "beforeFinalSync", finalOpened.operations); await finalOpened.operations.sync(); await hook(record.hooks, "afterFinalSync", finalOpened.operations); }
    catch (error) { throw error; }
    final = finalInfo(finalOpened.identity, record.reportSha256);
    await readyOps.close(); readyOps = null;
    readyUnlinkAttempted = true; await hook(record.hooks, "beforeReadyUnlink", ready); await hook(record.hooks, "unlinkReady", fdPath(record.directoryOps.fd, ready));
    if (record.hooks?.unlinkReady === undefined) await unlink(fdPath(record.directoryOps.fd, ready)); readyUnlinked = true;
    await hook(record.hooks, "afterReadyUnlink", ready); await hook(record.hooks, "beforeDirectorySync", record.directoryOps); await hook(record.hooks, "syncDirectory", record.directoryOps); if (record.hooks?.syncDirectory === undefined) await record.directoryOps.sync(); await hook(record.hooks, "afterDirectorySync", record.directoryOps);
    await revalidateDirectory(record); const heldFinal = fileIdentity(await finalOps.stat({ bigint: true }), "final report held descriptor");
    if (!sameObject(finalIdentity, heldFinal) || heldFinal.nlink !== 1n || hash(await readOps(finalOps, heldFinal.size)) !== record.reportSha256) fail("final report held identity differs after durability sync");
    const pathnameFinal = await openReport(record, name, finalIdentity); try {
      if (pathnameFinal.identity.nlink !== 1n) fail("final report pathname link count differs after durability sync");
    } finally { await pathnameFinal.operations.close(); }
    await finalOps.close(); finalOps = null;
    return receiptFor(record, { disposition: "published-durable", name, final, cleanupConfirmed: true, directorySyncConfirmed: true, cleanupDirectorySyncConfirmed: true });
  } catch {
    if (readyOps !== null) try { await readyOps.close(); } catch {}
    const exactFinalBinding = finalLinked && finalIdentity !== null && finalOps !== null &&
      await finalBindingIsExact(record, name, finalIdentity, finalOps);
    if (finalOps !== null) try { await finalOps.close(); } catch {}
    if (finalLinked && finalIdentity !== null && !exactFinalBinding) {
      return receiptFor(record, { disposition: "published-identity-indeterminate", name, cleanupConfirmed: false,
        directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
    }
    if (!finalLinked && linkAttempted) {
      const observed = await observeLinkAttempt(record, name, readyIdentity);
      if (observed.state === "exact") {
        /* Do not turn a lost link completion into a cleanup retry.  The exact
         * final is durable enough to be called published, but READY remains
         * intentionally untouched and the receipt exposes that uncertainty. */
        return receiptFor(record, { disposition: "published-cleanup-unconfirmed", name, final: observed.final,
          cleanupConfirmed: false, directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
      }
      if (observed.state === "indeterminate") {
        return receiptFor(record, { disposition: "published-identity-indeterminate", name, cleanupConfirmed: false,
          directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
      }
    }
    if (!finalLinked) {
      const cleanup = await removePrivate(record, [temp, ready]);
      return receiptFor(record, { disposition: "not-published", name, cleanupConfirmed: cleanup.confirmed,
        directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: cleanup.sync });
    }
    if (final === null) {
      try { const opened = await openReport(record, name, readyIdentity);
        try { final = finalInfo(opened.identity, record.reportSha256); } finally { await opened.operations.close(); }
      } catch { return receiptFor(record, { disposition: "published-identity-indeterminate", name, cleanupConfirmed: false,
        directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false }); }
    }
    /* Once cleanup was attempted, never retry it automatically.  A directory
     * sync failure after a confirmed unlink also remains indeterminate rather
     * than becoming a second persistence attempt. */
    if (readyUnlinkAttempted) return receiptFor(record, { disposition: readyUnlinked ? "published-durability-indeterminate" : "published-cleanup-unconfirmed", name, final,
      cleanupConfirmed: readyUnlinked, directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
    const cleanup = await removePrivate(record, [ready]);
    return receiptFor(record, { disposition: cleanup.confirmed ? "published-durability-indeterminate" : "published-cleanup-unconfirmed", name, final,
      cleanupConfirmed: cleanup.confirmed, directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: cleanup.sync });
  }
}

/** Capture exact canonical comparison bytes and one retained fixed-root output directory. */
async function mintBoundaryCapability(options, boundary) {
  const fields = optionalData(options, "capability options", ["comparison", "expectedLinkHelperSha256", "testHooks"]);
  if (!boundary.testOnly) fail("production publication authority is not registered");
  const expectedLinkHelperSha256 = sha256(fields.expectedLinkHelperSha256, "expected link helper SHA-256");
  const hooks = hooksFor(fields.testHooks); assertCadrM14StaticReproductionComparison(fields.comparison);
  const reportBytes = Buffer.from(serializeCadrM14StaticReproductionComparison(fields.comparison));
  const reportSha256 = hash(reportBytes); let directoryOps = null;
  try {
    await hook(hooks, "beforeDirectoryOpen"); const captured = await capturePublicationTree(true, boundary); directoryOps = captured.directoryOps;
    const descriptor = captured.directoryIdentity;
    await hook(hooks, "afterDirectoryOpen");
    const helper = await helperIdentity(directoryOps, expectedLinkHelperSha256, hooks);
    const capability = Object.freeze(Object.create(null)); CAPABILITIES.set(capability, { phase: "READY", reportBytes, reportSha256,
      boundary, ancestry: captured.ancestry, directoryIdentity: descriptor, directoryOps, directoryClosed: false, helper, helperOps: helper.helperOps, helperClosed: false,
      hooks, publishFlight: null, closeFlight: null, name: null });
    return capability;
  } catch (error) { if (directoryOps !== null) try { await directoryOps.close(); await hook(hooks, "onClosed", "directory"); } catch {} throw error; }
}

/**
 * Production minting is deliberately unavailable: the current policy registry
 * has no publication authority.  This stable API exists so the CLI can fail
 * closed before any output authority is acquired.
 */
export async function createCadrM14PublicationCapability(options = undefined) {
  optionalData(options, "capability options", ["comparison", "expectedLinkHelperSha256", "testHooks"]);
  return mintBoundaryCapability(options, PRODUCTION_BOUNDARY);
}

/**
 * Synthetic conformance capability.  It uses the same opaque capability and
 * state machine, but is hard-bound to build/cadr-m14/test-published; it can
 * neither choose nor affect the production published root.
 */
export async function createCadrM14PublicationTestCapability(options = undefined) {
  return mintBoundaryCapability(options, TEST_BOUNDARY);
}

/** Publish once; callers racing the same basename receive the same Promise. */
export function publishCadrM14ComparisonReport(capability, options = undefined) {
  try {
    const { name } = exactData(options, "publish options", ["name"]); const safeName = safeBasename(name); const record = recordFor(capability);
    if (record.phase === "PUBLISHING") { if (record.name !== safeName) fail("concurrent publication must use the same basename"); return record.publishFlight; }
    if (record.phase !== "READY") fail("publication capability is closed");
    record.phase = "PUBLISHING"; record.name = safeName;
    let resolveFlight; let rejectFlight; const flight = new Promise((resolve, reject) => { resolveFlight = resolve; rejectFlight = reject; }); record.publishFlight = flight;
    void (async () => {
      let result;
      try { result = await publish(record, safeName); await terminalClose(record, result); resolveFlight(result); }
      catch (error) {
        if (record.closeFlight === null) try { await terminalClose(record, result); } catch (closeError) { rejectFlight(closeError); return; }
        rejectFlight(error);
      }
    })();
    return flight;
  } catch (error) { return Promise.reject(error); }
}

/** Idempotent close; close while PUBLISHING rejects instead of racing output. */
export function closeCadrM14PublicationCapability(capability) {
  const record = recordFor(capability); if (record.phase === "PUBLISHING") fail("publication capability is publishing and cannot be closed concurrently");
  if (record.phase === "CLOSED" || record.phase === "CLOSING") return record.closeFlight;
  if (record.phase !== "READY" && record.phase !== "CLOSE_FAILED") fail("publication capability is closed");
  record.phase = "CLOSING"; record.closeFlight = closeDescriptors(record).then(() => { record.phase = "CLOSED"; }, error => { record.phase = "CLOSE_FAILED"; throw error; });
  return record.closeFlight;
}

export function createCadrM14PublicationTestHooks(options = undefined) {
  const fields = optionalData(options, "test hook options", ["afterDescriptorLink", "afterDirectoryOpen", "afterDirectorySync", "afterFinalHash", "afterFinalLink", "afterFinalOpen", "afterFinalRead", "afterFinalStat", "afterFinalSync", "afterHelperSnapshot", "afterReadyOpen", "afterReadyUnlink", "afterRenameReady", "afterTempClose", "afterTempCreate", "afterTempSync", "afterTempWrite", "beforeClose", "beforeDirectoryOpen", "beforeDirectorySync", "beforeFinalLink", "beforeFinalOpen", "beforeFinalSync", "beforeReadyOpen", "beforeReadyUnlink", "beforeRenameReady", "beforeTempClose", "beforeTempSync", "beforeTempWrite", "cleanupReady", "onClosed", "renameReady", "syncCleanupDirectory", "syncDirectory", "syncTemp", "unlinkReady"]);
  for (const [name, value] of Object.entries(fields)) if (value !== undefined && typeof value !== "function") fail(`test hook ${name} must be a function`);
  const token = Object.freeze(Object.create(null)); TEST_HOOKS.set(token, freeze(fields)); return token;
}

export function assertCadrM14PublicationReceipt(value) {
  if (value === null || typeof value !== "object" || !RECEIPTS.has(value) || !Object.isFrozen(value)) fail("publication receipt is not an exact closed receipt");
  const expected = ["cleanupConfirmed", "cleanupDirectorySyncConfirmed", "directorySyncConfirmed", "disposition", "final", "name", "profile", "published", "report", "retryPolicy", "schema"];
  if (Object.keys(value).sort().join("\u0000") !== expected.join("\u0000") || value.schema !== "cadr-m14-publication-receipt-v3" || value.profile !== PROFILE ||
      !["published-durable", "not-published", "published-cleanup-unconfirmed", "published-durability-indeterminate", "published-identity-indeterminate"].includes(value.disposition) ||
      value.published !== (value.disposition !== "not-published") || value.retryPolicy !== "never-automatic" || !SAFE_BASENAME.test(value.name) ||
      typeof value.cleanupConfirmed !== "boolean" || typeof value.directorySyncConfirmed !== "boolean" || typeof value.cleanupDirectorySyncConfirmed !== "boolean" ||
      value.report === null || typeof value.report !== "object" || !SHA256.test(value.report.sha256) || !Number.isSafeInteger(value.report.byteCount) || value.report.byteCount < 0) fail("publication receipt fields differ from contract");
  if (value.final !== null && (typeof value.final !== "object" || !/^[0-9]+$/u.test(value.final.dev) || !/^[0-9]+$/u.test(value.final.ino) ||
      !SHA256.test(value.final.sha256) || !Number.isSafeInteger(value.final.byteCount) || value.final.byteCount < 0)) fail("publication receipt final identity differs from contract");
  const rules = {
    "published-durable": [true, true, true, true, true],
    "published-cleanup-unconfirmed": [true, false, false, false, true],
    "published-identity-indeterminate": [true, false, false, false, false],
  }[value.disposition];
  if (value.disposition === "not-published") {
    if (value.published || value.directorySyncConfirmed || value.final !== null) fail("not-published receipt fields differ from contract");
  } else if (value.disposition === "published-durability-indeterminate") {
    /* READY may have been removed and its cleanup directory sync may have
     * completed even though the final durability acknowledgement did not.
     * Keep the facts separate rather than suppressing a true cleanup sync. */
    if (!value.published || !value.cleanupConfirmed || value.directorySyncConfirmed || value.final === null) {
      fail("publication receipt disposition differs from the closed contract");
    }
  } else {
    const [published, cleanupConfirmed, directorySyncConfirmed, cleanupDirectorySyncConfirmed, finalRequired] = rules;
    if (value.published !== published || value.cleanupConfirmed !== cleanupConfirmed ||
        value.directorySyncConfirmed !== directorySyncConfirmed || value.cleanupDirectorySyncConfirmed !== cleanupDirectorySyncConfirmed ||
        (value.final !== null) !== finalRequired) fail("publication receipt disposition differs from the closed contract");
  }
  return value;
}
export function serializeCadrM14PublicationReceipt(value) { return `${canonical(assertCadrM14PublicationReceipt(value))}\n`; }
