#!/usr/bin/env node
/*
 * Privileged M7 P4 authority supervisor.
 *
 * Production authority is created only by the direct supervisor process from
 * inherited descriptors.  The execution caller never supplies a commit,
 * expected closure, executable, keyring, or Guix package name.  The exported
 * constructor is explicitly test-only and is not used by the production
 * execution entry point.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import { Socket } from "node:net";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT_REGISTRY = Symbol.for("cadr.m7.p4.root.registry.v1");
const roots = globalThis[ROOT_REGISTRY] ?? new WeakMap();
if (globalThis[ROOT_REGISTRY] === undefined) {
  Object.defineProperty(globalThis, ROOT_REGISTRY, { value: roots,
    configurable: false, enumerable: false, writable: false });
}
const GUIX_DAEMON_SOCKET = "/var/guix/daemon-socket/socket";
const GUIX_STORE = "/gnu/store";
const M7_P4_GUIX_CHANNEL = "230aa373f315f247852ee07dff34146e9b480aec";
const M7_P4_LAUNCHER_RELATIVE = "bin/cadr-m7-p4-authority.mjs";
export const M7_P4_TRUSTED_LINEAGE_FLOOR =
  "9dbfe42dd66a7e92dc6cc1f59b44d622381fc7d1";
export const M7_P4_SIGNING_SUBKEY =
  "997E2BA6B52340268A3987E3D94F0A11ACD78333";
export const M7_P4_SIGNING_PRIMARY =
  "3EA36B492D7E76450D2C59267B55A97A62F6D6C0";
export const M7_P4_GIT_SHA256 =
  "93473c28694fd72bd889364107cd2770514de59780885a6a4aafca4d602e30ad";
export const M7_P4_GUIX_SHA256 =
  "e64f344b31d0c3289ad849abbb1545624cf112094b1107f8c0e4ea49e4aa62ce";
export const M7_P4_GPGV_SHA256 =
  "cecf4c8938ac0cb45fb06ab2116b1efc4ec60f29b33de06c11e29c0468968f1e";
export const M7_P4_KEYRING_SHA256 =
  "34ec05d1e5cfd4da9d3a354895a42c9df34a827284ec1b88c6008b3b784eec1b";
export const M7_P4_KEYRING_BYTES = 918;
export const M7_P4_SIGNATURE_POLICY =
  "gpgv-validsig-v4-ed25519-sha512-subkey-997e-primary-3ea3-v1";
const M7_P4_FIXED_MODULE_SHA256 =
  "a3537ccaa6e8c953060f2354c8f8678734fdd583e2bf635afc52a247bf42f986";
const M7_P4_FIXED_MODULE_BYTES = 121138;

function fail(message) {
  throw new TypeError(`M7 P4 authority supervisor: ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitObjectId(type, bytes) {
  return createHash("sha1").update(Buffer.from(`${type} ${bytes.byteLength}\0`))
    .update(bytes).digest("hex");
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

function descriptorFd(value, label) {
  if (value === null || typeof value !== "object" ||
      !Number.isSafeInteger(value.fd) || value.fd < 0 ||
      typeof value.stat !== "function" || typeof value.readFile !== "function" ||
      typeof value.close !== "function") fail(`${label} is not an open FileHandle`);
  return value.fd;
}

async function pinGuixDaemonAuthority(failAfterConnect = false) {
  const [socketBefore, store] = await Promise.all([
    lstat(GUIX_DAEMON_SOCKET), lstat(GUIX_STORE),
  ]);
  if (!socketBefore.isSocket() || socketBefore.dev !== 36 || socketBefore.ino !== 4806452 ||
      socketBefore.uid !== 944 || socketBefore.gid !== 954 ||
      (socketBefore.mode & 0o7777) !== 0o666 || !store.isDirectory() || store.dev !== 36 ||
      store.ino !== 389021 || store.uid !== 944 || store.gid !== 954 ||
      (store.mode & 0o7777) !== 0o1775) {
    fail("Guix daemon socket or store differs from the pinned host authority");
  }
  const capability = new Socket();
  await new Promise((resolveConnection, rejectConnection) => {
    capability.once("connect", resolveConnection);
    capability.once("error", rejectConnection);
    capability.connect(GUIX_DAEMON_SOCKET);
  });
  let socketAfter;
  try { socketAfter = await lstat(GUIX_DAEMON_SOCKET); }
  catch (error) { capability.destroy(); throw error; }
  if (failAfterConnect) {
    capability.destroy();
    fail("synthetic post-connect Guix daemon endpoint failure");
  }
  if (socketAfter.dev !== socketBefore.dev || socketAfter.ino !== socketBefore.ino ||
      socketAfter.uid !== socketBefore.uid || socketAfter.gid !== socketBefore.gid ||
      socketAfter.mode !== socketBefore.mode) {
    capability.destroy();
    fail("Guix daemon socket changed while its capability was connected");
  }
  return Object.freeze({ capability, identity: Object.freeze({
    socket: Object.freeze({ dev: socketBefore.dev, ino: socketBefore.ino,
      uid: socketBefore.uid, gid: socketBefore.gid, mode: socketBefore.mode & 0o7777 }),
    store: Object.freeze({ dev: store.dev, ino: store.ino,
      uid: store.uid, gid: store.gid, mode: store.mode & 0o7777 }),
  }) });
}

async function regularDescriptorIdentity(handle, label) {
  const before = await handle.stat();
  if (!before.isFile() || before.size < 1) fail(`${label} is not a nonempty regular file`);
  const bytes = new Uint8Array(await handle.readFile());
  const after = await handle.stat();
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
      bytes.byteLength !== after.size) fail(`${label} changed while its descriptor was read`);
  return Object.freeze({ fd: handle.fd, bytes,
    identity: Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) }) });
}

function exactOneLine(value, label) {
  const line = String(value).trim();
  if (line.length === 0 || /\s/.test(line)) fail(`${label} has no exact one-line value`);
  return line;
}

function closedEnvironment(extra = {}) {
  return Object.freeze({ HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_NO_REPLACE_OBJECTS: "1", ...extra });
}

async function runDescriptor(fd, args, cwd, extraEnvironment = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn("/proc/self/fd/3", args, {
      cwd, env: closedEnvironment(extraEnvironment),
      stdio: ["ignore", "pipe", "pipe", { fd, readable: true, writable: false }],
    });
    const out = []; const err = [];
    child.stdout.on("data", chunk => out.push(chunk));
    child.stderr.on("data", chunk => err.push(chunk));
    child.once("error", rejectCommand);
    child.once("close", code => {
      if (code === 0) resolveCommand(Buffer.concat(out));
      else rejectCommand(new Error(`descriptor-bound command failed (${code}): ${
        Buffer.concat(err).toString("utf8").trim()}`));
    });
  });
}

function parseSignedCommit(commitBytes, expectedCommit) {
  if (gitObjectId("commit", commitBytes) !== expectedCommit) {
    fail("raw signed commit bytes do not hash to selected HEAD");
  }
  const text = Buffer.from(commitBytes).toString("utf8");
  if (!Buffer.from(text, "utf8").equals(Buffer.from(commitBytes))) {
    fail("signed commit is not exact UTF-8");
  }
  const lines = text.split("\n");
  const signed = []; const signature = []; let found = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("gpgsig ")) {
      if (found) fail("selected HEAD contains multiple gpgsig headers");
      found = true; signature.push(line.slice(7));
      while (index + 1 < lines.length && lines[index + 1].startsWith(" ")) {
        signature.push(lines[++index].slice(1));
      }
    } else signed.push(line);
  }
  if (!found || signature[0] !== "-----BEGIN PGP SIGNATURE-----" ||
      signature.at(-1) !== "-----END PGP SIGNATURE-----") {
    fail("selected HEAD lacks one canonical detached OpenPGP signature");
  }
  return Object.freeze({ payload: Buffer.from(signed.join("\n"), "utf8"),
    signature: Buffer.from(`${signature.join("\n")}\n`, "utf8") });
}

async function verifySignature(gpgvRecord, keyringRecord, signed) {
  const privateDirectory = await mkdtemp("/tmp/cadr-m7-gpgv-");
  const signaturePath = `${privateDirectory}/signature.asc`;
  const payloadPath = `${privateDirectory}/payload`;
  await writeFile(signaturePath, signed.signature, { mode: 0o600, flag: "wx" });
  await writeFile(payloadPath, signed.payload, { mode: 0o600, flag: "wx" });
  const signatureHandle = await open(signaturePath, "r");
  const payloadHandle = await open(payloadPath, "r");
  await unlink(signaturePath); await unlink(payloadPath);
  await rmdir(privateDirectory);
  let status;
  try {
    status = await new Promise((resolveStatus, rejectStatus) => {
    const child = spawn("/proc/self/fd/3", ["--homedir", "/var/empty",
      "--status-fd=1", "--keyring", "/proc/self/fd/4", "/proc/self/fd/5",
      "/proc/self/fd/6"], {
      env: closedEnvironment(),
      stdio: ["ignore", "pipe", "pipe",
        { fd: gpgvRecord.fd, readable: true, writable: false },
        { fd: keyringRecord.fd, readable: true, writable: false },
        { fd: signatureHandle.fd, readable: true, writable: false },
        { fd: payloadHandle.fd, readable: true, writable: false }],
    });
    const out = []; const err = [];
    child.stdout.on("data", chunk => out.push(chunk));
    child.stderr.on("data", chunk => err.push(chunk));
    child.once("error", rejectStatus);
    child.once("close", code => {
      if (code === 0) resolveStatus(Buffer.concat(out).toString("utf8"));
      else rejectStatus(new Error(`descriptor-bound gpgv failed (${code}): ${
        Buffer.concat(err).toString("utf8").trim()}`));
    });
    });
  } finally {
    await Promise.all([signatureHandle.close(), payloadHandle.close()]);
  }
  const records = status.split("\n").filter(line => line.startsWith("[GNUPG:] "));
  const forbidden = /\b(?:BADSIG|ERRSIG|EXPSIG|EXPKEYSIG|REVKEYSIG|NO_PUBKEY)\b/;
  if (records.some(line => forbidden.test(line))) fail("gpgv emitted a forbidden signature status");
  const valid = records.filter(line => line.startsWith("[GNUPG:] VALIDSIG "));
  if (valid.length !== 1) fail("gpgv did not emit exactly one VALIDSIG");
  const fields = valid[0].split(/\s+/);
  if (fields[2] !== M7_P4_SIGNING_SUBKEY || fields.at(-1) !== M7_P4_SIGNING_PRIMARY ||
      fields.length !== 12 || fields[6] !== "4" || fields[7] !== "0" ||
      fields[8] !== "22" || fields[9] !== "10" || fields[10] !== "00") {
    fail(`VALIDSIG differs from the explicit Ed25519 subkey/primary policy: ${valid[0]}`);
  }
  return Object.freeze({ policy: M7_P4_SIGNATURE_POLICY,
    signing_subkey: fields[2], primary_key: fields.at(-1), status_sha256: sha256(status) });
}

async function verifyLineage(git, head) {
  const pending = [head]; const visited = new Set(); let floorReached = false;
  while (pending.length > 0 && visited.size < 10000) {
    const commit = pending.pop();
    if (visited.has(commit)) continue;
    visited.add(commit);
    if (commit === M7_P4_TRUSTED_LINEAGE_FLOOR) floorReached = true;
    const bytes = await git(["cat-file", "commit", commit]);
    if (gitObjectId("commit", bytes) !== commit) fail("lineage commit object hash differs");
    const header = bytes.toString("utf8").split("\n\n", 1)[0];
    for (const line of header.split("\n")) {
      const match = /^parent ([0-9a-f]{40})$/.exec(line);
      if (match !== null) pending.push(match[1]);
    }
  }
  if (!floorReached) fail("signed HEAD does not descend from the pinned lineage floor");
  if (pending.length !== 0) fail("signed HEAD ancestry exceeds the bounded policy");
}

function tarFiles(tarBytes) {
  const files = []; let offset = 0;
  const field = (header, start, length) => {
    const raw = header.subarray(start, start + length); const end = raw.indexOf(0);
    return Buffer.from(raw.subarray(0, end < 0 ? length : end)).toString("utf8");
  };
  while (offset < tarBytes.byteLength) {
    const header = tarBytes.subarray(offset, offset + 512);
    if (header.byteLength !== 512) fail("Git archive is truncated");
    if (header.every(byte => byte === 0)) return Object.freeze(files);
    const name = field(header, 0, 100); const prefix = field(header, 345, 155);
    const path = `${prefix.length === 0 ? "" : `${prefix}/`}${name}`;
    const size = Number.parseInt(field(header, 124, 12).trim() || "0", 8);
    const mode = Number.parseInt(field(header, 100, 8).trim() || "0", 8);
    const type = header[156]; const start = offset + 512; const end = start + size;
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith("/") ||
        path.split("/").includes("..") || !Number.isSafeInteger(size) || size < 0 ||
        !Number.isSafeInteger(mode) || end > tarBytes.byteLength) fail("Git archive member is unsafe");
    if (type === 0 || type === 48) {
      const gitMode = (mode & 0o111) !== 0 ? "100755" : "100644";
      files.push(Object.freeze({ path, mode, gitMode,
        bytes: Buffer.from(tarBytes.subarray(start, end)) }));
    }
    else if (type !== 53 && type !== 103) fail("Git archive contains a non-regular member");
    offset = start + Math.ceil(size / 512) * 512;
  }
  fail("Git archive lacks a terminal block");
}

function treeIdentity(files) {
  const root = new Map();
  for (const file of files) {
    const parts = file.path.split("/"); let directory = root;
    for (const part of parts.slice(0, -1)) {
      if (!directory.has(part)) directory.set(part, new Map());
      const child = directory.get(part);
      if (!(child instanceof Map)) fail("Git archive has a file/directory collision");
      directory = child;
    }
    const name = parts.at(-1);
    if (directory.has(name)) fail("Git archive has a duplicate member");
    directory.set(name, file);
  }
  const hashTree = directory => {
    const entries = [...directory.entries()].sort(([left, leftValue], [right, rightValue]) =>
      Buffer.compare(Buffer.from(`${left}${leftValue instanceof Map ? "/" : ""}`),
        Buffer.from(`${right}${rightValue instanceof Map ? "/" : ""}`)));
    const bytes = [];
    for (const [name, value] of entries) {
      const directoryEntry = value instanceof Map;
      const mode = directoryEntry ? "40000" : value.gitMode;
      const oid = directoryEntry ? hashTree(value) : gitObjectId("blob", value.bytes);
      bytes.push(Buffer.from(`${mode} ${name}\0`), Buffer.from(oid, "hex"));
    }
    return gitObjectId("tree", Buffer.concat(bytes));
  };
  return hashTree(root);
}

/** Canonical signed-archive language shared by production and receipt generation. */
export function validateM7P4SignedArchive(archive, expectedTree) {
  const bytes = Buffer.from(archive); const files = tarFiles(bytes);
  if (!/^[0-9a-f]{40}$/.test(expectedTree) || treeIdentity(files) !== expectedTree) {
    fail("Git archive does not reconstruct its declared signed tree");
  }
  return files;
}

async function captureSignedProgram(snapshot, requireRunner = true) {
  const directory = await mkdtemp("/tmp/cadr-m7-root-program-");
  try {
    const files = validateM7P4SignedArchive(snapshot.archive, snapshot.tree);
    for (const file of files) {
      const target = resolve(directory, file.path);
      if (!target.startsWith(`${directory}/`)) fail("captured program path escapes root");
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, file.bytes, { flag: "wx",
        mode: file.gitMode === "100755" ? 0o555 : 0o444 });
    }
    const directories = new Set([directory]);
    for (const file of files) {
      let path = dirname(resolve(directory, file.path));
      while (path.startsWith(directory)) {
        directories.add(path);
        if (path === directory) break;
        path = dirname(path);
      }
    }
    const runner = resolve(directory, "scripts/run-cadr-m7-p4-fast-differential.mjs");
    if (requireRunner) {
      const identity = await lstat(runner);
      if (!identity.isFile() || !snapshot.inventory.includes(
        "scripts/run-cadr-m7-p4-fast-differential.mjs")) {
        fail("signed program capture lacks the M7 runner");
      }
    }
    return Object.freeze({ directory, directories: Object.freeze([...directories]), runner,
      url: `${pathToFileURL(runner).href}?signed_tree=${snapshot.tree}` });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

/** Test seam for proving production capture preserves the signed Git/NAR mode identity. */
export async function captureM7P4SignedArchiveForTest(archive, expectedTree) {
  const bytes = Buffer.from(archive); const files = validateM7P4SignedArchive(bytes, expectedTree);
  return captureSignedProgram(Object.freeze({ archive: bytes, tree: expectedTree,
    inventory: Object.freeze(files.map(file => file.path).sort()) }), false);
}

async function deriveLauncherAuthority(snapshot, domain) {
  const releaseFiles = validateM7P4SignedArchive(snapshot.archive, snapshot.tree);
  const receiptPath = "scripts/cadr-m7-p4-guix-launcher-receipt.json";
  if (domain === "production" && snapshot.launcherSource === null) {
    fail("release commit lacks a commit-A launcher source reference");
  }
  const files = domain === "production" ?
    validateM7P4SignedArchive(snapshot.launcherSource.archive,
      snapshot.launcherSource.tree) : releaseFiles;
  const closureHash = createHash("sha256");
  for (const file of files.filter(file => file.path !== receiptPath)
    .sort((left, right) => left.path.localeCompare(right.path))) {
    closureHash.update(Buffer.from(`${file.path}\0${file.bytes.byteLength}\0`, "utf8"));
    closureHash.update(file.bytes);
  }
  const independentlyDerivedSourceClosure = closureHash.digest("hex");
  const programInventorySha256 = sha256(Buffer.from(canonicalJson(files
    .filter(file => file.path !== receiptPath).sort((a, b) => a.path.localeCompare(b.path))
    .map(file => ({ path: file.path, bytes: file.bytes.byteLength,
      sha256: sha256(file.bytes) })))));
  if (domain === "test") {
    const entry = files.find(file => file.path === "README.md");
    if (entry === undefined) fail("test signed launcher fixture lacks README entrypoint");
    const sourceClosure = independentlyDerivedSourceClosure;
    const derivation = "/gnu/store/3dmpza190pjx2qyg8xq801glyxcb4fi9-node-22.14.0.drv";
    const output = "/gnu/store/ja8lzccpgxrr5s3f00kq4i3b83d1l8lp-node-22.14.0";
    const nodeHash = sha256(await readFile(`${output}/bin/node`));
    const entryHash = sha256(entry.bytes);
    const derivationHash = sha256(await readFile(derivation));
    if (!(await readFile(derivation, "utf8")).includes(`(\"out\",\"${output}\",\"\",\"\")`)) {
      fail("test Guix derivation does not declare its fixed output");
    }
    return frozenCanonicalCopy({ schema: "cadr-m7-guix-launcher-authority-test-v1",
      source_commit: snapshot.commit, source_tree: snapshot.tree,
      source_closure_sha256: sourceClosure, entrypoint_path: entry.path,
      entrypoint_sha256: entryHash, node_sha256: nodeHash,
      derivation, output, derivation_sha256: derivationHash,
      program_inventory_sha256: programInventorySha256,
      requisite_closure_sha256: "35263298726f7d35e045a8ba78d7ec77fca84064c598aa5e612cea4cb6504638" });
  }
  const receipt = releaseFiles.find(file =>
    file.path === receiptPath);
  const builder = files.find(file => file.path === "scripts/build-cadr-m7-p4-launcher.scm");
  if (receipt === undefined || builder === undefined) {
    fail("signed source lacks the canonical Guix launcher derivation receipt");
  }
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(receipt.bytes)); }
  catch { fail("signed Guix launcher receipt is not UTF-8 JSON"); }
  const receiptFields = ["builder_sha256", "derivation", "derivation_sha256",
    "entrypoint_path", "entrypoint_sha256", "guix_channel_commit", "node_derivation",
    "node_output", "node_sha256", "output", "program_inventory_sha256",
    "requisite_closure_sha256", "schema", "source_closure_sha256", "source_commit",
    "source_tree"];
  if (!Buffer.from(receipt.bytes).equals(Buffer.from(canonicalJson(value))) ||
      Object.keys(value).sort().join(",") !== receiptFields.sort().join(",") ||
      value.schema !== "cadr-m7-guix-launcher-authority-v1" ||
      value.source_commit !== snapshot.launcherSource?.commit ||
      value.source_tree !== snapshot.launcherSource?.tree ||
      value.source_closure_sha256 !== independentlyDerivedSourceClosure ||
      value.program_inventory_sha256 !== programInventorySha256 ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+\.drv$/.test(value.derivation ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(value.output ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+\.drv$/.test(value.node_derivation ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(value.node_output ?? "") ||
      value.builder_sha256 !== sha256(builder.bytes) ||
      value.guix_channel_commit !== M7_P4_GUIX_CHANNEL ||
      value.entrypoint_path !== `${value.output}/${M7_P4_LAUNCHER_RELATIVE}` ||
      !/^[0-9a-f]{64}$/.test(value.derivation_sha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(value.node_sha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(value.requisite_closure_sha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(value.entrypoint_sha256 ?? "")) {
    fail("signed Guix launcher derivation receipt is incomplete or inconsistent");
  }
  await validateInstalledLauncherReceipt(value);
  return frozenCanonicalCopy(value);
}

async function validateInstalledLauncherReceipt(value) {
  const exactFields = ["builder_sha256", "derivation", "derivation_sha256",
    "entrypoint_path", "entrypoint_sha256", "guix_channel_commit", "node_derivation",
    "node_output", "node_sha256", "output", "program_inventory_sha256",
    "requisite_closure_sha256", "schema", "source_closure_sha256", "source_commit",
    "source_tree"];
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== exactFields.sort().join(",") ||
      value.schema !== "cadr-m7-guix-launcher-authority-v1" ||
      value.guix_channel_commit !== M7_P4_GUIX_CHANNEL ||
      value.entrypoint_path !== `${value.output}/${M7_P4_LAUNCHER_RELATIVE}` ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+\.drv$/.test(value.derivation ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(value.output ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+\.drv$/.test(value.node_derivation ?? "") ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-[^/]+$/.test(value.node_output ?? "") ||
      [value.derivation_sha256, value.entrypoint_sha256, value.node_sha256,
        value.requisite_closure_sha256].some(hash => !/^[0-9a-f]{64}$/.test(hash ?? ""))) {
    fail("signed launcher receipt fields or store relationships are invalid");
  }
  const [drvBytes, nodeDrvBytes, launcherBytes, nodeBytes, launcherStat] = await Promise.all([
    readFile(value.derivation), readFile(value.node_derivation), readFile(value.entrypoint_path),
    readFile(`${value.node_output}/bin/node`), lstat(value.entrypoint_path),
  ]);
  const firstLine = launcherBytes.toString("utf8").split("\n", 1)[0];
  if (sha256(drvBytes) !== value.derivation_sha256 ||
      !drvBytes.toString("utf8").includes(`(\"out\",\"${value.output}\",\"\",\"\")`) ||
      !nodeDrvBytes.toString("utf8").includes(
        `(\"out\",\"${value.node_output}\",\"\",\"\")`) ||
      firstLine !== `#!${value.node_output}/bin/node` ||
      sha256(nodeBytes) !== value.node_sha256 || sha256(launcherBytes) !== value.entrypoint_sha256 ||
      !launcherStat.isFile() || (launcherStat.mode & 0o7777) !== 0o555) {
    fail("signed launcher receipt differs from installed derivation, Node, or entrypoint");
  }
  return true;
}

/** Test seam for shape-valid receipt-field forgery checks. */
export async function validateM7P4InstalledLauncherReceiptForTest(value) {
  return validateInstalledLauncherReceipt(frozenCanonicalCopy(value));
}

async function selectSignedSnapshot(gitRecord, gpgvRecord, keyringRecord, checkout) {
  const git = args => runDescriptor(gitRecord.fd,
    ["--no-replace-objects", "-c", "core.hooksPath=/dev/null", ...args], checkout);
  const head = exactOneLine(await git(["rev-parse", "--verify", "HEAD^{commit}"]),
    "root-selected signed HEAD");
  const tree = exactOneLine(await git(["rev-parse", `${head}^{tree}`]),
    "root-selected source tree");
  if (!/^[0-9a-f]{40}$/.test(head) || !/^[0-9a-f]{40}$/.test(tree)) {
    fail("root-selected Git object identity is invalid");
  }
  if (String(await git(["status", "--porcelain=v1", "--untracked-files=all"])).trim() !== "") {
    fail("root-owned checkout is not clean");
  }
  if (String(await git(["for-each-ref", "--format=%(refname)", "refs/replace/"])).trim() !== "") {
    fail("root-owned repository contains replace objects");
  }
  if (String(await git(["rev-parse", "--is-shallow-repository"])).trim() !== "false") {
    fail("root-owned repository is shallow");
  }
  const commitBytes = await git(["cat-file", "commit", head]);
  const signed = parseSignedCommit(commitBytes, head);
  const signature = await verifySignature(gpgvRecord, keyringRecord, signed);
  await verifyLineage(git, head);
  const archive = await git(["archive", "--format=tar", head]);
  const files = validateM7P4SignedArchive(archive, tree);
  const inventory = Object.freeze(files.map(file => file.path).sort());
  if (inventory.length === 0 || new Set(inventory).size !== inventory.length) {
    fail("signed archive inventory is empty or noncanonical");
  }
  let launcherSource = null;
  const receiptFile = files.find(file =>
    file.path === "scripts/cadr-m7-p4-guix-launcher-receipt.json");
  if (receiptFile !== undefined) {
    let receipt;
    try { receipt = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(receiptFile.bytes)); }
    catch { fail("release launcher receipt is not UTF-8 JSON"); }
    const sourceCommit = receipt.source_commit;
    if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? "")) fail("receipt lacks commit-A identity");
    const sourceCommitBytes = await git(["cat-file", "commit", sourceCommit]);
    const sourceSigned = parseSignedCommit(sourceCommitBytes, sourceCommit);
    const sourceSignature = await verifySignature(gpgvRecord, keyringRecord, sourceSigned);
    await verifyLineage(git, sourceCommit);
    const sourceTree = exactOneLine(await git(["rev-parse", `${sourceCommit}^{tree}`]),
      "commit-A tree");
    const sourceArchive = await git(["archive", "--format=tar", sourceCommit]);
    const sourceFiles = validateM7P4SignedArchive(sourceArchive, sourceTree);
    launcherSource = Object.freeze({ commit: sourceCommit, tree: sourceTree,
      archive: Buffer.from(sourceArchive),
      inventory: Object.freeze(sourceFiles.map(file => file.path).sort()),
      signature: sourceSignature });
  }
  return Object.freeze({ commit: head, tree, archive: Buffer.from(archive), inventory,
    signature, launcherSource });
}

async function constructAuthority({ expectedClosure, git, guix, gpgv, keyring, checkout,
  fixedModule = null, fixedModuleIdentity = null },
  domain) {
  if (domain !== "production" && domain !== "test") fail("authority domain is invalid");
  const handles = [expectedClosure, git, guix, gpgv, keyring];
  for (const [index, handle] of handles.entries()) descriptorFd(handle,
    ["expected closure", "Git", "Guix", "gpgv", "minimal keyring"][index]);
  if (new Set(handles.map(handle => handle.fd)).size !== handles.length) {
    fail("authority descriptors must be distinct");
  }
  if (typeof checkout !== "string" || checkout.length === 0) fail("root-owned checkout path is absent");
  let programCapture = null; let guixHome = null; let daemon = null; let transferred = false;
  try {
    const [expectedRecord, gitRecord, guixRecord, gpgvRecord, keyringRecord] =
      await Promise.all(handles.map((handle, index) => regularDescriptorIdentity(handle,
        ["expected closure", "Git", "Guix", "gpgv", "minimal keyring"][index])));
    if (gitRecord.identity.sha256 !== M7_P4_GIT_SHA256 ||
        guixRecord.identity.sha256 !== M7_P4_GUIX_SHA256 ||
        gpgvRecord.identity.sha256 !== M7_P4_GPGV_SHA256 ||
        keyringRecord.identity.sha256 !== M7_P4_KEYRING_SHA256 ||
        keyringRecord.identity.bytes !== M7_P4_KEYRING_BYTES) {
      fail("Git, Guix, gpgv, or minimal keyring descriptor differs from pinned policy");
    }
    let expected;
    try {
      expected = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(expectedRecord.bytes));
    } catch {
      fail("expected closure descriptor is not UTF-8 JSON");
    }
    if (expected === null || typeof expected !== "object" || Array.isArray(expected) ||
        !Buffer.from(expectedRecord.bytes).equals(Buffer.from(canonicalJson(expected)))) {
      fail("expected closure descriptor is not canonical JSON");
    }
    if (domain === "production" && (expected.schema !== "cadr-m7-frame-expected-closure-v1" ||
        expected.bindings === null || typeof expected.bindings !== "object" ||
        Array.isArray(expected.bindings))) {
      fail("privileged launcher did not supply the independently identified P4 closure");
    }
    const snapshot = await selectSignedSnapshot(gitRecord, gpgvRecord, keyringRecord, checkout);
    programCapture = domain === "production" ?
      await captureSignedProgram(snapshot.launcherSource ?? snapshot) :
      (process.env.M7_TEST_FAIL_SETUP === "pin-after-connect" ?
        await captureSignedProgram(snapshot, false) : null);
    const launcherAuthority = await deriveLauncherAuthority(snapshot, domain);
    if (fixedModule !== null && canonicalJson(fixedModule.launcher) !==
        canonicalJson(launcherAuthority)) {
      fail("fd9 launcher reference differs from independently derived signed authority");
    }
    daemon = await pinGuixDaemonAuthority(domain === "test" &&
      process.env.M7_TEST_FAIL_SETUP === "pin-after-connect");
    if (domain === "production") {
      guixHome = await mkdtemp("/tmp/cadr-m7-root-guix-home-");
      const evaluated = String(await runDescriptor(guixRecord.fd, ["time-machine",
        `--commit=${M7_P4_GUIX_CHANNEL}`, "--", "build",
        "--derivations", "-f", resolve(programCapture.directory,
          "scripts/build-cadr-m7-p4-launcher.scm")], programCapture.directory,
      { HOME: guixHome, XDG_CONFIG_HOME: resolve(guixHome, ".config"),
        XDG_CACHE_HOME: resolve(guixHome, ".cache"),
        M7_P4_SOURCE: programCapture.directory })).trim();
      if (evaluated !== launcherAuthority.derivation) {
        fail("retained Guix evaluation differs from signed launcher derivation receipt");
      }
      const drv = await readFile(evaluated, "utf8");
      if (sha256(Buffer.from(drv)) !== launcherAuthority.derivation_sha256 ||
          !drv.includes(`(\"out\",\"${launcherAuthority.output}\",\"\",\"\")`)) {
        fail("evaluated launcher derivation output differs from signed receipt");
      }
      const nodeDrv = await readFile(launcherAuthority.node_derivation, "utf8");
      if (!nodeDrv.includes(`(\"out\",\"${launcherAuthority.node_output}\",\"\",\"\")`) ||
          sha256(await readFile(`${launcherAuthority.node_output}/bin/node`)) !==
            launcherAuthority.node_sha256) {
        fail("exact Node derivation/output/path/hash differs from signed receipt");
      }
      const requisites = String(await runDescriptor(guixRecord.fd,
        ["gc", "--requisites", launcherAuthority.output], programCapture.directory))
        .trim().split("\n").filter(Boolean).sort();
      if (!requisites.includes(launcherAuthority.node_output) ||
          sha256(Buffer.from(`${requisites.join("\n")}\n`)) !==
            launcherAuthority.requisite_closure_sha256) {
        fail("launcher requisite closure differs from exact Node/output receipt");
      }
      await rm(guixHome, { recursive: true, force: true }); guixHome = null;
    }
    const root = Object.freeze({});
    roots.set(root, { closed: false, domain, expected: frozenCanonicalCopy(expected),
      fixedModule: fixedModule === null ? null : frozenCanonicalCopy(fixedModule),
      fixedModuleIdentity,
      launcherAuthority,
      expectedIdentity: Object.freeze(expectedRecord.identity), snapshot,
      git: Object.freeze({ fd: gitRecord.fd, identity: gitRecord.identity }),
      guix: Object.freeze({ fd: guixRecord.fd, identity: guixRecord.identity,
        daemon: daemon.identity }),
      gpgv: Object.freeze({ fd: gpgvRecord.fd, identity: gpgvRecord.identity }),
      keyring: Object.freeze({ fd: keyringRecord.fd, identity: keyringRecord.identity }),
      handles: [git, guix, gpgv, keyring], daemonCapability: daemon.capability,
      programCapture });
    transferred = true;
    return root;
  } finally {
    if (!transferred) {
      daemon?.capability.destroy();
      await Promise.allSettled([
        ...(programCapture === null ? [] : [rm(programCapture.directory,
          { recursive: true, force: true })]),
        ...(guixHome === null ? [] : [rm(guixHome, { recursive: true, force: true })]),
        ...handles.slice(1).map(handle => handle.close()),
      ]);
    }
    await expectedClosure.close();
  }
}

/** Test seam only. Production constructs authority in the direct supervisor. */
export async function openM7P4AuthorityRootForTest(descriptors) {
  return constructAuthority(descriptors, "test");
}

export function inspectM7P4AuthorityRootForTest(root) {
  const record = roots.get(root);
  if (record === undefined || record.closed) fail("not a live privileged capability");
  return record;
}

export async function revalidateM7P4GuixEndpointForTest(root) {
  const record = inspectM7P4AuthorityRootForTest(root);
  if (record.daemonCapability.destroyed) fail("retained Guix daemon capability is closed");
  const current = await lstat(GUIX_DAEMON_SOCKET);
  const expected = record.guix.daemon.socket;
  if (!current.isSocket() || current.dev !== expected.dev || current.ino !== expected.ino ||
      current.uid !== expected.uid || current.gid !== expected.gid ||
      (current.mode & 0o7777) !== expected.mode) {
    fail("Guix daemon endpoint changed during the privileged operation");
  }
  return expected;
}

export async function closeM7P4AuthorityRootForTest(root) {
  const record = roots.get(root);
  if (record === undefined || record.closed) fail("not a live privileged capability");
  record.closed = true;
  record.daemonCapability.destroy();
  await Promise.all(record.handles.map(handle => handle.close()));
  const makeRemovable = async path => {
    await chmod(path, 0o700);
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isDirectory()) await makeRemovable(resolve(path, entry.name));
    }
  };
  if (record.programCapture !== null) {
    await makeRemovable(record.programCapture.directory);
    await rm(record.programCapture.directory, { recursive: true, force: true });
  }
}

export async function main() {
  if (process.argv.length !== 3 || !["--serve-inherited", "--serve-inherited-test"].includes(process.argv[2])) {
    fail("direct privileged use requires --serve-inherited and fds 4 through 9");
  }
  const socket = new Socket({ fd: 3, readable: true, writable: true });
  socket.setEncoding("utf8");
  let acceptedHandles = []; let root = null;
  try {
  const domain = process.argv[2] === "--serve-inherited" ? "production" : "test";
  let launcherEntry = null;
  if (domain === "production") {
    launcherEntry = await realpath(process.argv[1]);
    if (!launcherEntry.startsWith("/gnu/store/") ||
        (((await lstat(launcherEntry)).mode & 0o022) !== 0)) {
      fail("production authority entrypoint is not an immutable Guix-store launcher artifact");
    }
  }
  if (domain === "production" && (process.getuid?.() !== 0 || process.geteuid?.() !== 0)) {
    fail("production authority requires the privileged launcher identity");
  }
  acceptedHandles = await Promise.all(
    [4, 5, 6, 7, 8, 9].map(fd => open(`/proc/self/fd/${fd}`, "r")));
  if (domain === "test" && process.env.M7_TEST_FAIL_SETUP === "after-fds") {
    fail("synthetic setup failure after fd adoption");
  }
  const [expectedClosure, git, guix, gpgv, keyring, moduleIdentity] = acceptedHandles;
  const moduleRecord = await regularDescriptorIdentity(moduleIdentity,
    "independently fixed module identity");
  await moduleIdentity.close();
  let fixedModule;
  try { fixedModule = JSON.parse(new TextDecoder("utf-8", { fatal: true })
    .decode(moduleRecord.bytes)); } catch { fail("fixed module identity is not UTF-8 JSON"); }
  const fixedSchema = domain === "production" ? "cadr-m7-fixed-module-identity-v1" :
    "cadr-m7-fixed-module-identity-test-v1";
  if (fixedModule?.schema !== fixedSchema ||
      !/^[0-9a-f]{64}$/.test(fixedModule?.module_sha256 ?? "") ||
      !/^[0-9a-f]{64}$/.test(fixedModule?.identity_sha256 ?? "") ||
      !Number.isSafeInteger(fixedModule?.module_bytes) || fixedModule.module_bytes < 1 ||
      fixedModule.module_sha256 !== M7_P4_FIXED_MODULE_SHA256 ||
      fixedModule.module_bytes !== M7_P4_FIXED_MODULE_BYTES ||
      !Buffer.from(moduleRecord.bytes).equals(Buffer.from(canonicalJson(fixedModule)))) {
    fail("independently fixed module identity differs from the authority domain");
  }
  if (domain === "test" && process.env.M7_TEST_FAIL_SETUP === "after-fd9") {
    fail("synthetic setup failure after fd9 validation");
  }
  root = await constructAuthority({ expectedClosure, git, guix, gpgv, keyring,
    checkout: process.cwd(), fixedModule, fixedModuleIdentity: moduleRecord.identity }, domain);
  if (inspectM7P4AuthorityRootForTest(root).domain !== domain) {
    fail("IPC authority domain mismatch");
  }
  if (domain === "production") {
    const launcher = inspectM7P4AuthorityRootForTest(root).launcherAuthority;
    if (!launcherEntry.startsWith(`${launcher.output}/`) ||
        launcherEntry !== launcher.entrypoint_path ||
        sha256(await readFile(launcherEntry)) !== launcher.entrypoint_sha256 ||
        process.execPath !== `${launcher.node_output}/bin/node` ||
        sha256(await readFile(process.execPath)) !== launcher.node_sha256) {
      fail("running Node/entrypoint differs from independently derived Guix launcher authority");
    }
  }
  if (domain === "test" && process.env.M7_TEST_FAIL_SETUP === "after-root") {
    fail("synthetic setup failure after signed root construction");
  }
  await revalidateM7P4GuixEndpointForTest(root);
  if (domain === "test" && process.env.M7_TEST_FAIL_SETUP === "after-daemon-recheck") {
    fail("synthetic setup failure after daemon recheck");
  }
  let pending = ""; let chain = Promise.resolve();
  const reply = value => socket.write(`${canonicalJson(value)}\n`);
  const handle = async line => {
    let request;
    try {
      request = JSON.parse(line);
      if (request === null || typeof request !== "object" || Array.isArray(request)) {
        fail("IPC request is not an object");
      }
      if (request.op === "close" && Object.keys(request).join(",") === "op") {
        reply({ ok: true, closed: true });
        socket.end();
      } else if (request.op === "revalidate" && Object.keys(request).sort().join(",") ===
          "identity,module_b64,op") {
        const fixed = inspectM7P4AuthorityRootForTest(root).fixedModule;
        const moduleBytes = new Uint8Array(Buffer.from(request.module_b64, "base64"));
        if (fixed === null || sha256(Buffer.from(canonicalJson(request.identity), "utf8")) !==
            fixed.identity_sha256 || moduleBytes.byteLength !== fixed.module_bytes ||
            sha256(moduleBytes) !== fixed.module_sha256) {
          fail("revalidate request differs from the independently fixed fd9 module authority");
        }
        let provenance;
        if (domain === "test") {
          provenance = Object.freeze({ schema: "cadr-m7-p4-fixed-revalidation-test-v1",
            module_identity_sha256: fixed.identity_sha256,
            module_sha256: fixed.module_sha256,
            source_commit: inspectM7P4AuthorityRootForTest(root).snapshot.commit,
            source_tree: inspectM7P4AuthorityRootForTest(root).snapshot.tree });
        } else {
          const runner = await import(inspectM7P4AuthorityRootForTest(root).programCapture.url);
          provenance = await runner.revalidateM7P4FastPreparation(
            request.identity, moduleBytes, root);
        }
        reply({ id: request.id ?? null, ok: true, provenance });
      } else if (request.op === "validate-native" &&
          Object.keys(request).sort().join(",") ===
            "manifest_b64,manifest_identity,native_b64,op") {
        const runner = await import(inspectM7P4AuthorityRootForTest(root).programCapture.url);
        const native = runner.validateM7P4NativeAuthority({
          schema: "cadr-m7-p4-native-authority-v2",
          manifest_bytes: new Uint8Array(Buffer.from(request.manifest_b64, "base64")),
          manifest_identity: request.manifest_identity,
          native_frame: new Uint8Array(Buffer.from(request.native_b64, "base64")),
        }, root);
        reply({ ok: true, native_frame_b64: Buffer.from(native.nativeFrame).toString("base64"),
          receipt: native.receipt });
      } else {
        fail("IPC operation or fields differ from the permit-only protocol");
      }
    } catch (error) {
      reply({ ok: false, error: { name: error?.name ?? "Error",
        message: error?.message ?? String(error) } });
    }
  };
  socket.on("data", chunk => {
    pending += chunk;
    if (Buffer.byteLength(pending, "utf8") > 64 * 1024 * 1024) {
      socket.destroy(new Error("M7 authority IPC frame exceeds limit")); return;
    }
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
      chain = chain.then(() => handle(line));
    }
  });
  try {
    await new Promise((resolveSocket, rejectSocket) => {
      socket.once("end", resolveSocket); socket.once("close", resolveSocket);
      socket.once("error", rejectSocket);
    });
    await chain;
  } finally {}
  } finally {
    if (!socket.destroyed) socket.end();
    socket.destroy();
    if (root !== null) {
      const record = roots.get(root);
      if (record !== undefined && !record.closed) await closeM7P4AuthorityRootForTest(root);
    }
    await Promise.allSettled(acceptedHandles.map(handle => handle.close()));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`); process.exitCode = 1;
  });
}
