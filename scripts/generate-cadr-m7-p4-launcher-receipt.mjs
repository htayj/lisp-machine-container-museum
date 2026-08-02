#!/usr/bin/env node
/* Generate commit B's receipt from an already signed, clean commit-A checkout. */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, fstatSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { link, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { validateM7P4SignedArchive } from "./cadr-m7-p4-authority-root.mjs";

const GUIX = "/usr/local/bin/guix";
const GIT = "/usr/bin/git";
const GPGV = "/usr/bin/gpgv";
const CHANNEL = "230aa373f315f247852ee07dff34146e9b480aec";
const RECEIPT = "scripts/cadr-m7-p4-guix-launcher-receipt.json";
const BUILDER = "scripts/build-cadr-m7-p4-launcher.scm";
const ENTRYPOINT = "scripts/cadr-m7-p4-authority-root.mjs";
const GIT_SHA256 = "93473c28694fd72bd889364107cd2770514de59780885a6a4aafca4d602e30ad";
const GUIX_SHA256 = "e64f344b31d0c3289ad849abbb1545624cf112094b1107f8c0e4ea49e4aa62ce";
const GPGV_SHA256 = "cecf4c8938ac0cb45fb06ab2116b1efc4ec60f29b33de06c11e29c0468968f1e";
const KEYRING_SHA256 = "34ec05d1e5cfd4da9d3a354895a42c9df34a827284ec1b88c6008b3b784eec1b";
const KEYRING_BYTES = 918;
const SIGNING_SUBKEY = "997E2BA6B52340268A3987E3D94F0A11ACD78333";
const SIGNING_PRIMARY = "3EA36B492D7E76450D2C59267B55A97A62F6D6C0";
const GUIX_HOME = mkdtempSync(join(tmpdir(), "cadr-m7-receipt-guix-home-"));
process.on("exit", () => rmSync(GUIX_HOME, { recursive: true, force: true }));

function fail(message) { throw new TypeError(`M7 launcher receipt: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function command(path, args, cwd, env = {}, inherited = []) {
  return execFileSync(path, args, { cwd, encoding: "utf8",
    env: { HOME: GUIX_HOME, XDG_CONFIG_HOME: `${GUIX_HOME}/.config`,
      XDG_CACHE_HOME: `${GUIX_HOME}/.cache`, LANG: "C", LC_ALL: "C", TZ: "UTC", ...env },
    stdio: ["ignore", "pipe", "pipe", ...inherited] }).trim();
}
function exactStore(value, drv = false) {
  const suffix = drv ? "\\.drv" : "";
  if (!new RegExp(`^/gnu/store/[0-9a-df-np-sv-z]{32}-.+${suffix}$`).test(value)) {
    fail("Guix returned a non-store identity");
  }
  return value;
}
function gitObjectId(type, bytes) {
  return createHash("sha1").update(Buffer.from(`${type} ${bytes.byteLength}\0`))
    .update(bytes).digest("hex");
}
function treeIdentity(files) {
  const root = new Map();
  for (const file of files) {
    const parts = file.path.split("/"); let directory = root;
    for (const part of parts.slice(0, -1)) {
      if (!directory.has(part)) directory.set(part, new Map());
      const child = directory.get(part);
      if (!(child instanceof Map)) fail("Git tree has a file/directory collision");
      directory = child;
    }
    const name = parts.at(-1);
    if (directory.has(name)) fail("Git tree has a duplicate member");
    directory.set(name, file);
  }
  const hashTree = directory => {
    const entries = [...directory.entries()].sort(([left, leftValue], [right, rightValue]) =>
      Buffer.compare(Buffer.from(`${left}${leftValue instanceof Map ? "/" : ""}`),
        Buffer.from(`${right}${rightValue instanceof Map ? "/" : ""}`)));
    const bytes = [];
    for (const [name, value] of entries) {
      const directoryEntry = value instanceof Map;
      const mode = directoryEntry ? "40000" : value.mode;
      const oid = directoryEntry ? hashTree(value) : gitObjectId("blob", value.bytes);
      bytes.push(Buffer.from(`${mode} ${name}\0`), Buffer.from(oid, "hex"));
    }
    return gitObjectId("tree", Buffer.concat(bytes));
  };
  return hashTree(root);
}
function signedCommitPayload(commitBytes, expectedCommit, expectedTree) {
  if (gitObjectId("commit", commitBytes) !== expectedCommit) fail("commit bytes differ from Git identity");
  const textValue = commitBytes.toString("utf8");
  if (!Buffer.from(textValue, "utf8").equals(commitBytes)) fail("commit is not exact UTF-8");
  const lines = textValue.split("\n"); const payload = []; const signature = []; let found = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("gpgsig ")) {
      if (found) fail("commit contains multiple signatures");
      found = true; signature.push(line.slice(7));
      while (index + 1 < lines.length && lines[index + 1].startsWith(" ")) {
        signature.push(lines[++index].slice(1));
      }
    } else payload.push(line);
  }
  if (!found || payload[0] !== `tree ${expectedTree}` ||
      signature[0] !== "-----BEGIN PGP SIGNATURE-----" ||
      signature.at(-1) !== "-----END PGP SIGNATURE-----") {
    fail("commit tree or canonical detached signature is invalid");
  }
  return { payload: Buffer.from(payload.join("\n")),
    signature: Buffer.from(`${signature.join("\n")}\n`) };
}
async function verifyPinnedSignature(commitBytes, commit, tree, gpgvFd, keyringFd) {
  const signed = signedCommitPayload(commitBytes, commit, tree);
  const signaturePath = join(GUIX_HOME, "commit.sig");
  const payloadPath = join(GUIX_HOME, "commit.payload");
  await writeFile(signaturePath, signed.signature, { mode: 0o600, flag: "wx" });
  await writeFile(payloadPath, signed.payload, { mode: 0o600, flag: "wx" });
  const status = command("/proc/self/fd/3",
    ["--homedir", "/var/empty", "--status-fd=1", "--keyring", "/proc/self/fd/4",
      signaturePath, payloadPath], GUIX_HOME, {}, [gpgvFd, keyringFd]);
  const records = status.split("\n").filter(line => line.startsWith("[GNUPG:] "));
  if (records.some(line => /\b(?:BADSIG|ERRSIG|EXPSIG|EXPKEYSIG|REVKEYSIG|NO_PUBKEY)\b/.test(line))) {
    fail("gpgv emitted a forbidden signature status");
  }
  const valid = records.filter(line => line.startsWith("[GNUPG:] VALIDSIG "));
  const fields = valid.length === 1 ? valid[0].split(/\s+/) : [];
  if (fields[2] !== SIGNING_SUBKEY || fields.at(-1) !== SIGNING_PRIMARY ||
      fields.length !== 12 || fields[6] !== "4" || fields[7] !== "0" ||
      fields[8] !== "22" || fields[9] !== "10" || fields[10] !== "00") {
    fail("commit signature differs from pinned subkey/primary policy");
  }
}
async function publishReceipt(outputFile, bytes) {
  const directory = dirname(outputFile);
  const temporary = join(directory, `.${outputFile.split("/").at(-1)}.${process.pid}.${randomUUID()}.tmp`);
  let installed = false;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await link(temporary, outputFile); installed = true;
    const directoryHandle = await open(directory, "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    await unlink(temporary);
    const finalDirectoryHandle = await open(directory, "r");
    try { await finalDirectoryHandle.sync(); } finally { await finalDirectoryHandle.close(); }
  } catch (error) {
    await unlink(temporary).catch(cleanup => { if (cleanup.code !== "ENOENT") throw cleanup; });
    if (installed) await unlink(outputFile).catch(() => {});
    throw error;
  }
}

const argv = process.argv.slice(2);
if (argv.length !== 6 || argv[0] !== "--source-a" || argv[2] !== "--keyring" ||
    argv[4] !== "--output") {
  fail("usage: --source-a CLEAN-SIGNED-A-CHECKOUT --keyring PINNED.gpg --output RECEIPT.json");
}
const source = resolve(argv[1]); const keyring = resolve(argv[3]); const outputFile = resolve(argv[5]);
const pinnedFiles = [[GIT, GIT_SHA256, null], [GUIX, GUIX_SHA256, null],
  [GPGV, GPGV_SHA256, null], [keyring, KEYRING_SHA256, KEYRING_BYTES]];
const pinnedFds = pinnedFiles.map(([path, expectedHash, expectedBytes]) => {
  const fd = openSync(path, "r"); const before = fstatSync(fd); const bytes = readFileSync(fd);
  const after = fstatSync(fd);
  if (!before.isFile() || before.dev !== after.dev || before.ino !== after.ino ||
      before.size !== after.size || sha256(bytes) !== expectedHash ||
      (expectedBytes !== null && bytes.byteLength !== expectedBytes)) {
    closeSync(fd); fail(`${path} differs from pinned receipt-generation authority`);
  }
  return fd;
});
process.on("exit", () => { for (const fd of pinnedFds) { try { closeSync(fd); } catch {} } });
const [gitFd, guixFd, gpgvFd, keyringFd] = pinnedFds;
const git = args => command("/proc/self/fd/3", args, source, {}, [gitFd]);
const gitBytes = args => execFileSync("/proc/self/fd/3", args, {
  cwd: source, env: { HOME: GUIX_HOME, LANG: "C", LC_ALL: "C", TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_NO_REPLACE_OBJECTS: "1" },
  stdio: ["ignore", "pipe", "pipe", gitFd],
});
const guix = (args, env = {}) => command("/proc/self/fd/3", args, source, env, [guixFd]);
const commit = git(["--no-replace-objects", "rev-parse", "--verify", "HEAD^{commit}"]);
const tree = git(["--no-replace-objects", "rev-parse", "HEAD^{tree}"]);
const commitBytes = gitBytes(["--no-replace-objects", "cat-file", "commit", commit]);
await verifyPinnedSignature(commitBytes, commit, tree, gpgvFd, keyringFd);
const records = gitBytes(["--no-replace-objects", "ls-tree", "-r", "-z", "--full-tree", commit])
  .toString("utf8").split("\0").filter(Boolean);
const files = []; const seen = new Set();
for (const record of records) {
  const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/.exec(record);
  if (match === null) fail("signed tree contains a symlink, submodule, or nonregular mode");
  const [, mode, oid, path] = match;
  if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith("/") ||
      path.split("/").includes("..") || seen.has(path)) fail("signed tree path is unsafe or duplicate");
  seen.add(path);
  const bytes = gitBytes(["--no-replace-objects", "cat-file", "blob", oid]);
  if (gitObjectId("blob", bytes) !== oid) fail("signed blob bytes differ from object identity");
  files.push(Object.freeze({ path, mode, bytes: Buffer.from(bytes) }));
}
files.sort((left, right) => left.path.localeCompare(right.path));
if (files.length === 0 || treeIdentity(files) !== tree) {
  fail("reconstructed signed files do not reproduce the commit tree");
}
const archive = gitBytes(["--no-replace-objects", "archive", "--format=tar", commit]);
const archiveFiles = validateM7P4SignedArchive(archive, tree)
  .slice().sort((left, right) => left.path.localeCompare(right.path));
if (archiveFiles.length !== files.length || archiveFiles.some((file, index) =>
  file.path !== files[index].path || file.gitMode !== files[index].mode ||
  !file.bytes.equals(files[index].bytes))) {
  fail("descriptor-bound archive differs from reconstructed signed Git objects");
}
const paths = files.map(file => file.path);
if (!paths.includes(BUILDER) || !paths.includes(ENTRYPOINT)) {
  fail("commit A lacks builder or complete launcher entrypoint");
}
if (paths.includes(RECEIPT)) fail("commit A already contains the commit-B receipt");
const snapshot = mkdtempSync(join(tmpdir(), "cadr-m7-receipt-source-a-"));
process.on("exit", () => rmSync(snapshot, { recursive: true, force: true }));
const closure = createHash("sha256"); const inventory = [];
for (const file of files) {
  const target = resolve(snapshot, file.path);
  if (!target.startsWith(`${snapshot}/`)) fail("signed snapshot path escapes its private root");
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, file.bytes, { flag: "wx", mode: file.mode === "100755" ? 0o555 : 0o444 });
  closure.update(Buffer.from(`${file.path}\0${file.bytes.byteLength}\0`)); closure.update(file.bytes);
  inventory.push({ path: file.path, bytes: file.bytes.byteLength, sha256: sha256(file.bytes) });
}
const guixArgs = ["time-machine", `--commit=${CHANNEL}`, "--", "build"];
const env = { M7_P4_SOURCE: snapshot };
const derivation = exactStore(guix(
  [...guixArgs, "--derivations", "-f", resolve(snapshot, BUILDER)], env), true);
const builtOutput = exactStore(guix([...guixArgs, "-f", resolve(snapshot, BUILDER)], env));
const drv = await readFile(derivation, "utf8");
if (!drv.includes(`(\"out\",\"${builtOutput}\",\"\",\"\")`)) {
  fail("evaluated derivation does not declare the realized output");
}
const launcherPath = `${builtOutput}/bin/cadr-m7-p4-authority.mjs`;
const launcherBytes = await readFile(launcherPath);
const firstLine = launcherBytes.toString("utf8").split("\n", 1)[0];
const nodePath = firstLine.startsWith("#!/gnu/store/") ? firstLine.slice(2) : null;
if (nodePath === null || !nodePath.endsWith("/bin/node")) fail("launcher lacks exact Guix Node shebang");
const probe = spawnSync(launcherPath, [], { encoding: "utf8", timeout: 5000,
  env: { HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC" } });
if (probe.error !== undefined || probe.status === 0 ||
    !probe.stderr.includes("M7 P4 authority supervisor: direct privileged use requires")) {
  fail("realized launcher did not execute the authority entrypoint through its exact Node");
}
const nodeOutput = exactStore(nodePath.slice(0, -9));
const nodeDerivation = exactStore(guix(
  ["time-machine", `--commit=${CHANNEL}`, "--", "build", "--derivations",
    "--expression=(@@ (gnu packages node) node-lts)"]), true);
const nodeDrv = await readFile(nodeDerivation, "utf8");
if (!nodeDrv.includes(`(\"out\",\"${nodeOutput}\",\"\",\"\")`)) {
  fail("node-lts derivation does not declare the wrapper's Node output");
}
const requisites = guix(["gc", "--requisites", builtOutput])
  .split("\n").filter(Boolean).sort();
if (!requisites.includes(nodeOutput)) fail("launcher output closure omits exact Node output");
const receipt = {
  schema: "cadr-m7-guix-launcher-authority-v1", source_commit: commit,
  source_tree: tree, source_closure_sha256: closure.digest("hex"),
  program_inventory_sha256: sha256(Buffer.from(canonical(inventory))),
  builder_sha256: sha256(files.find(file => file.path === BUILDER).bytes),
  derivation, derivation_sha256: sha256(await readFile(derivation)),
  output: builtOutput, requisite_closure_sha256: sha256(Buffer.from(`${requisites.join("\n")}\n`)),
  node_derivation: nodeDerivation, node_output: nodeOutput,
  node_sha256: sha256(await readFile(nodePath)), entrypoint_path: launcherPath,
  entrypoint_sha256: sha256(launcherBytes), guix_channel_commit: CHANNEL,
};
await publishReceipt(outputFile, canonical(receipt));
process.stdout.write(`${canonical(receipt)}\n`);
