import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, symlink,
  writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { canonicalJson } from "../scripts/cadr-m6-ready4-evidence.mjs";
import { deriveSelectedImageNegativeViews, readCanonicalSelectedImageRelease,
  selectedDiskPath, validateSelectedImageNegativeRun,
  validateSelectedImageNegativeSupervised, writeCanonicalNoReplace,
  assertSelectedImageNegativePrerequisite,
  M6_SELECTED_IMAGE_AUTHORITY_FILES,
  M6_SELECTED_IMAGE_PINNED_NODE,
  M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY,
  selectedImageLauncherSourceBinding,
  selectedImageSystemdClientsSourceBinding,
  selectedImageNegativeEffectiveEnvironment } from
  "../scripts/cadr-m6-selected-image-negative-evidence.mjs";
import { executeSelectedImageNegative, parseSelectedImageNegativeArguments,
  verifySelectedImageNegativeSupervision } from
  "../scripts/run-cadr-m6-selected-image-negative.mjs";
import { parseSelectedImageNegativeSystemdArguments,
  closePinnedSelectedImageStagedExecutionClosure,
  executeSelectedImageNegativeSystemd,
  buildSelectedImageGuixAuthority,
  parseStaticLauncherElf,
  parseExactSelectedImageSystemdShow,
  parseSelectedImageNegativeDurationUSec,
  pinSelectedImageSystemdClients,
  pinExecutedSelectedImageNegativeReceipt,
  pinSelectedImageStagedExecutionClosure,
  removeSelectedImageNegativeStage, selectedImageNegativeSystemdCommand,
  selectedImagePinnedFile,
  selectedImagePinnedSourceRoot,
  startSelectedImageNegativeUnit,
  stopAndRemoveSelectedImageNegativeUnit,
  closeSelectedImageSystemdClients,
  verifySelectedImageSystemdClients,
  verifyPinnedSelectedImageStagedExecutionClosure,
  validateSelectedImageNegativeSystemdAccounting,
  validateSelectedImageNegativeSystemdPolicy } from
  "../scripts/run-cadr-m6-selected-image-negative-systemd.mjs";
import { parseReady4CampaignArguments } from
  "../scripts/run-cadr-m6-ready4-campaign.mjs";
import { parseArguments as parseReady4AggregateArguments } from
  "../scripts/aggregate-cadr-m6-ready4-campaign.mjs";
import { parseArguments as parseReady4ValidatorArguments } from
  "../scripts/validate-cadr-m6-ready4-evidence.mjs";

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const EXPECTED = Object.freeze({
  base: "db8e82fcacaeceb336ecb8be90fad31da698c72a6c10fd1ea68a2e5874b78b17",
  xor: "5576f1ca5173b8e7f0e81a396b6134d43dd4e50494226d7c003b5df7f8100c80",
  truncated: "dc404a613fedaeb54034514bc6505f56b933caa5250299ba7d094377a51caa46",
  xorOffset: "4096",
});
const supervisedUnit = `cadr-m6-selected-image-negative-${"34".repeat(16)}.service`;
const exactEnvironment = selectedImageNegativeEffectiveEnvironment(supervisedUnit);
const systemdControlEnvironment = Object.freeze({
  DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${process.getuid()}/bus`,
  LANG: "C", LC_ALL: "C", SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "",
  TZ: "UTC", XDG_RUNTIME_DIR: `/run/user/${process.getuid()}`,
});
const syntheticSystemdClientIdentity = Object.freeze({
  environment: systemdControlEnvironment,
  systemd_run: Object.freeze({ ancestry: Object.freeze([
    Object.freeze({ dev: "1", gid: "0", ino: "1", path: "/", uid: "0", mode: "0755" }),
    Object.freeze({ dev: "1", gid: "0", ino: "2", path: "/usr", uid: "0", mode: "0755" }),
    Object.freeze({ dev: "1", gid: "0", ino: "3", path: "/usr/bin", uid: "0", mode: "0755" }),
  ]), byte_count: "1", dev: "1", gid: "0", ino: "4", mode: "0755",
  path: "/usr/bin/systemd-run", real_path: "/usr/bin/systemd-run",
  sha256: "71".repeat(32), uid: "0" }),
  systemctl: Object.freeze({ ancestry: Object.freeze([
    Object.freeze({ dev: "1", gid: "0", ino: "1", path: "/", uid: "0", mode: "0755" }),
    Object.freeze({ dev: "1", gid: "0", ino: "2", path: "/usr", uid: "0", mode: "0755" }),
    Object.freeze({ dev: "1", gid: "0", ino: "3", path: "/usr/bin", uid: "0", mode: "0755" }),
  ]), byte_count: "1", dev: "1", gid: "0", ino: "5", mode: "0755",
  path: "/usr/bin/systemctl", real_path: "/usr/bin/systemctl",
  sha256: "72".repeat(32), uid: "0" }),
});
const syntheticSystemdClients = Object.freeze({
  identity: syntheticSystemdClientIdentity,
});
const releaseFor = disk => Buffer.from(canonicalJson({ artifacts: [
  { kind: 3, byte_count: String(disk.byteLength), sha256: sha256(disk) },
] }));

assert.throws(() => parseSelectedImageNegativeArguments([]), /inert/);
assert.throws(() => parseSelectedImageNegativeSystemdArguments([]), /inert/);
assert.equal(parseReady4CampaignArguments([
  "--execute", "--artifact-root", ".", "--output-dir", "out", "--benchmark", "b.json",
]).execute, true,
"READY4 itself owns selected-image-negative execution");
assert.throws(() => parseReady4CampaignArguments([
  "--execute", "--artifact-root", ".", "--output-dir", "out", "--benchmark",
  "b.json", "--selected-image-negative-receipt", "forged.json",
]), /unsupported/, "READY4 rejects caller-supplied selected-image authority");
assert.throws(() => parseReady4AggregateArguments([
  "--execute", "--run", "a", "--run", "b", "--run", "c", "--output", "out",
]), /in-process|opaque/,
"standalone READY4 aggregation cannot mint selected-image-negative authority");
assert.throws(() => parseReady4ValidatorArguments([
  "--run", "a", "--run", "b", "--run", "c",
]), /selected-image-negative-receipt/, "independent READY4 validation requires the same prerequisite");
{
  const hidden = Object.create(null);
  Object.defineProperty(hidden, "stageSource", {
    enumerable: false,
    value: async () => { throw new Error("non-enumerable test seam"); },
  });
  const proxied = new Proxy(Object.create(null), {
    get: (_target, name) => name === "stageSource" ?
      async () => { throw new Error("proxy test seam"); } : undefined,
    ownKeys: () => [],
  });
  for (const [label, dependencies] of [["non-enumerable", hidden],
    ["proxy", proxied]]) {
    await assert.rejects(() => executeSelectedImageNegativeSystemd({
      artifactRoot: "/never-used", output: "/never-created",
    }, dependencies), new RegExp(`${label} test seam`),
    `${label} supplied dependencies are never treated as production`);
  }
  await assert.rejects(() => executeSelectedImageNegativeSystemd({
    artifactRoot: "/never-used", output: "/never-created",
  }, undefined), /dependency seam/,
  "an explicitly supplied undefined argument is not the omitted production sentinel");
}

const directory = await mkdtemp(resolve(tmpdir(), "cadr-m6-selected-image-negative-"));
try {
  const artifactRoot = resolve(directory, "artifacts");
  const diskPath = resolve(artifactRoot, "l/usim/disk-sys-303-0.img");
  await mkdir(resolve(artifactRoot, "l/usim"), { recursive: true, mode: 0o700 });
  const disk = Buffer.from(Array.from({ length: 8193 }, (_, index) => index & 0xff));
  await writeFile(diskPath, disk, { mode: 0o400 });
  const releaseBytes = releaseFor(disk);
  const release = readCanonicalSelectedImageRelease(releaseBytes);
  const beforeNames = await readdir(resolve(artifactRoot, "l/usim"));
  const views = await deriveSelectedImageNegativeViews({ artifactRoot,
    selectedDisk: release.selected_disk });
  assert.deepEqual(views.base_before, { byte_count: String(disk.byteLength),
    sha256: EXPECTED.base });
  assert.deepEqual(views.base_after, views.base_before,
    "the exact selected image remains unchanged before and after both views");
  assert.equal(views.negative_views.length, 2);
  assert.equal(views.negative_views[0].kind, "same-length-xor-v1");
  assert.equal(views.negative_views[0].byte_count, String(disk.byteLength));
  assert.equal(views.negative_views[0].sha256, EXPECTED.xor,
    "the XOR identity is independently fixed, not only unequal to base");
  assert.equal(views.negative_views[0].xor_byte_offset, EXPECTED.xorOffset);
  assert.equal(views.negative_views[1].kind, "truncated-by-one-v1");
  assert.equal(views.negative_views[1].byte_count, String(disk.byteLength - 1));
  assert.equal(views.negative_views[1].sha256, EXPECTED.truncated,
    "the truncated identity is independently fixed, not only unequal to base");
  assert.deepEqual(await readdir(resolve(artifactRoot, "l/usim")), beforeNames,
    "the view operation creates no image derivative beside the exact source");
  assert.deepEqual(await readFile(diskPath), disk,
    "the selected disk bytes are never modified by negative derivation");
  const mutationRoot = resolve(directory, "mutation-artifacts");
  const mutationPath = resolve(mutationRoot, "l/usim/disk-sys-303-0.img");
  const mutationDisk = Buffer.from(Array.from({ length: 1024 * 1024 + 17 },
    (_, index) => index & 0xff));
  await mkdir(resolve(mutationRoot, "l/usim"), { recursive: true, mode: 0o700 });
  await writeFile(mutationPath, mutationDisk, { mode: 0o600 });
  const mutationRelease = readCanonicalSelectedImageRelease(releaseFor(mutationDisk));
  let mutated = false;
  await assert.rejects(() => deriveSelectedImageNegativeViews({ artifactRoot: mutationRoot,
    selectedDisk: mutationRelease.selected_disk, afterChunkForTest: async offset => {
      if (offset === 1024 * 1024 && !mutated) {
        mutated = true;
        const replacement = Buffer.from(mutationDisk); replacement[replacement.length - 1] ^= 1;
        await writeFile(mutationPath, replacement);
      }
    } }), /SHA-256/, "a concurrent write between chunks changes the same-pass base hash");
  const alreadyReadRoot = resolve(directory, "already-read-mutation-artifacts");
  const alreadyReadPath = resolve(alreadyReadRoot, "l/usim/disk-sys-303-0.img");
  await mkdir(resolve(alreadyReadRoot, "l/usim"), { recursive: true, mode: 0o700 });
  await writeFile(alreadyReadPath, mutationDisk, { mode: 0o600 });
  let alreadyReadMutated = false;
  await assert.rejects(() => deriveSelectedImageNegativeViews({
    artifactRoot: alreadyReadRoot, selectedDisk: mutationRelease.selected_disk,
    afterChunkForTest: async offset => {
      if (offset === 1024 * 1024 && !alreadyReadMutated) {
        alreadyReadMutated = true;
        const replacement = Buffer.from(mutationDisk); replacement[0] ^= 1;
        await writeFile(alreadyReadPath, replacement);
      }
    },
  }), /changed/, "metadata drift rejects mutation of a byte already hashed");
  const finalCallbackRoot = resolve(directory, "final-callback-mutation-artifacts");
  const finalCallbackPath = resolve(finalCallbackRoot, "l/usim/disk-sys-303-0.img");
  await mkdir(resolve(finalCallbackRoot, "l/usim"), { recursive: true, mode: 0o700 });
  await writeFile(finalCallbackPath, disk, { mode: 0o600 });
  let finalCallbackMutated = false;
  await assert.rejects(() => deriveSelectedImageNegativeViews({
    artifactRoot: finalCallbackRoot, selectedDisk: release.selected_disk,
    afterChunkForTest: async offset => {
      if (offset === disk.byteLength && !finalCallbackMutated) {
        finalCallbackMutated = true;
        const replacement = Buffer.from(disk); replacement[0] ^= 1;
        await writeFile(finalCallbackPath, replacement);
      }
    },
  }), /changed/, "metadata drift immediately after the final chunk is rejected");

  const sourceCommit = "ab".repeat(20); const sourceClosure = "cd".repeat(32);
  const direct = await executeSelectedImageNegative({ artifactRoot,
    releaseRecord: resolve(directory, "staged-release.json"), sourceCommit,
    sourceClosureSha256: sourceClosure, invocationNonceFile: resolve(directory, "nonce"),
    output: resolve(directory, "private.json") }, {
    supervise: async () => ({ effective_environment: exactEnvironment }),
    verifyNonce: async () => undefined,
    readRelease: async () => releaseBytes,
  });
  assert.equal(direct.materialized_image_bytes, "0");
  assert.equal(direct.worker_constructed, false);
  assert.equal(direct.wasm_build_attempted, false);
  assert.equal(direct.guest_execution_attempted, false);
  assert.deepEqual(validateSelectedImageNegativeRun(direct), direct);

  const supervisedLauncher = Object.freeze({
    ...M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY,
    source_closure_sha256: sourceClosure,
  });
  const supervised = { schema: "cadr-m6-selected-image-negative-supervised-v1",
    outcome: "selected-image-negative-supervised", run: direct,
    launcher: supervisedLauncher,
    launcher_source_binding_sha256:
      selectedImageLauncherSourceBinding(direct, supervisedLauncher),
    systemd_clients: syntheticSystemdClientIdentity,
    systemd_clients_source_binding_sha256:
      selectedImageSystemdClientsSourceBinding(direct,
        syntheticSystemdClientIdentity),
    accounting_sha256: "01".repeat(32), policy_sha256: "02".repeat(32),
    transient_unit_absent: true, source_stage_removed: true,
    private_root_removed: true };
  assert.equal(validateSelectedImageNegativeSupervised(supervised).run.source_commit,
    sourceCommit);
  assert.throws(() => pinExecutedSelectedImageNegativeReceipt(supervised),
    /not minted/, "synthetic canonical JSON cannot mint the READY4 capability");
  const selfReportedLauncher = structuredClone(supervised);
  selfReportedLauncher.launcher.files[0].sha256 = "g4".repeat(32);
  assert.throws(() => validateSelectedImageNegativeSupervised(
    selfReportedLauncher), /manifest|profile/,
  "an arbitrary store output cannot self-report itself into launcher authority");
  const changedCompiler = structuredClone(supervised);
  changedCompiler.launcher.toolchain.path = "/gnu/store/hostile-gcc";
  assert.throws(() => validateSelectedImageNegativeSupervised(
    changedCompiler), /exact reviewed profile/,
  "launcher authority is closed over the independently reviewed toolchain");
  const changedSystemctl = structuredClone(supervised);
  changedSystemctl.systemd_clients.systemctl.mode = "0777";
  assert.throws(() => validateSelectedImageNegativeSupervised(
    changedSystemctl), /root-owned immutable/,
  "the supervised receipt binds a non-user-writable systemctl identity");
  const ambientSystemdEnvironment = structuredClone(supervised);
  ambientSystemdEnvironment.systemd_clients.environment.PATH = "/tmp/hostile";
  assert.throws(() => validateSelectedImageNegativeSupervised(
    ambientSystemdEnvironment), /unknown fields/,
  "the supervised receipt rejects ambient control-process environment");
  const mismatchedLauncher = structuredClone(supervised);
  mismatchedLauncher.launcher.source_closure_sha256 = "ef".repeat(32);
  mismatchedLauncher.launcher_source_binding_sha256 =
    selectedImageLauncherSourceBinding(direct, mismatchedLauncher.launcher);
  assert.throws(() => validateSelectedImageNegativeSupervised(
    mismatchedLauncher), /launcher.*source closure/,
  "a launcher identity from another source closure cannot unlock READY4");
  const clientMutations = [
    receipt => {
      receipt.systemd_clients.systemd_run =
        structuredClone(receipt.systemd_clients.systemctl);
    },
    receipt => { receipt.systemd_clients.systemctl.path = "/usr/bin/other"; },
    receipt => { receipt.systemd_clients.systemctl.ancestry.pop(); },
    receipt => { receipt.systemd_clients.systemctl.ancestry.reverse(); },
    receipt => {
      receipt.systemd_clients.systemctl.ancestry[2].path = "/opt/bin";
    },
    receipt => { receipt.systemd_clients.systemctl.mode = "0644"; },
    receipt => { receipt.systemd_clients.systemctl.byte_count = "0"; },
  ];
  for (const mutate of clientMutations) {
    const changed = structuredClone(supervised);
    mutate(changed);
    assert.throws(() => validateSelectedImageNegativeSupervised(changed),
      /systemd-run|systemctl|identity|ancestor/,
    "durable receipts reject swapped, arbitrary, incomplete, reordered, disconnected, non-executable, and zero-byte clients");
  }
  assert.equal(assertSelectedImageNegativePrerequisite(supervised, {
    source_commit: sourceCommit, source_closure_sha256: sourceClosure,
  }).run.selected_disk.sha256, sha256(disk));
  assert.throws(() => assertSelectedImageNegativePrerequisite(supervised, {
    source_commit: sourceCommit, source_closure_sha256: "ef".repeat(32),
  }), /closure/, "a receipt from another source closure cannot unlock READY4");
  const extraView = structuredClone(direct); extraView.negative_views.push({});
  assert.throws(() => validateSelectedImageNegativeRun(extraView), /closed capability/,
    "only the two declared negative views are accepted");
  const materialized = structuredClone(direct); materialized.materialized_image_bytes = "1";
  assert.throws(() => validateSelectedImageNegativeRun(materialized), /capability/,
    "a claimed derivative image cannot be admitted");

  const output = resolve(directory, "no-replace.json");
  await writeCanonicalNoReplace(output, supervised);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  await assert.rejects(() => writeCanonicalNoReplace(output, supervised), /EEXIST/,
    "a receipt cannot replace prior evidence");

  const linkedRoot = resolve(directory, "linked-artifacts");
  await symlink(artifactRoot, linkedRoot);
  await assert.rejects(() => selectedDiskPath(linkedRoot), /real directory/,
    "a symlink artifact root cannot redirect selected-media authority");
  const linkedComponentRoot = resolve(directory, "linked-component-artifacts");
  await mkdir(linkedComponentRoot, { mode: 0o700 });
  await symlink(resolve(artifactRoot, "l"), resolve(linkedComponentRoot, "l"));
  await assert.rejects(() => selectedDiskPath(linkedComponentRoot), /symbolic link/,
    "a symlink path component cannot redirect selected-media authority");
  const wrong = { ...release.selected_disk, sha256: "03".repeat(32) };
  await assert.rejects(() => deriveSelectedImageNegativeViews({ artifactRoot,
    selectedDisk: wrong }), /SHA-256/, "wrong kind-3 media is rejected before a view is accepted");
  const oneByte = Buffer.from([0]);
  const tinyRoot = resolve(directory, "tiny-artifacts");
  await mkdir(resolve(tinyRoot, "l/usim"), { recursive: true, mode: 0o700 });
  await writeFile(resolve(tinyRoot, "l/usim/disk-sys-303-0.img"), oneByte);
  await assert.rejects(() => deriveSelectedImageNegativeViews({ artifactRoot: tinyRoot,
    selectedDisk: { kind: 3, byte_count: "1", sha256: sha256(oneByte) } }), /out of supported range/,
    "the truncated-by-one gate refuses an image without a nonempty truncated view");
} finally {
  await rm(directory, { recursive: true, force: true });
}

await assert.rejects(() => verifySelectedImageNegativeSupervision({
  M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD: "1",
}), /unsupervised/);
await verifySelectedImageNegativeSupervision(exactEnvironment,
  `0::${supervisedUnit}`);
for (const name of ["OPENSSL_CONF", "OPENSSL_MODULES", "NODE_OPTIONS",
  "LD_PRELOAD", "PATH", "UNREVIEWED_AMBIENT_KEY"]) {
  await assert.rejects(() => verifySelectedImageNegativeSupervision({
    ...exactEnvironment, [name]: "host-controlled",
  }, `0::${supervisedUnit}`), /unexpected environment key/,
  `${name} is eliminated rather than maintained in a denylist`);
}
await assert.rejects(() => verifySelectedImageNegativeSupervision({
  M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD: "1",
  M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT:
    "cadr-m6-selected-image-negative-34".repeat(16) + ".service",
}, "not-the-unit"), /unsupervised|outside/);

async function stagedJavaScriptFixture(prefix) {
  const root = await mkdtemp(resolve(tmpdir(), prefix));
  await mkdir(resolve(root, "scripts"), { mode: 0o700 });
  await mkdir(resolve(root, "cadr-web/oracle"), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root,
    "cadr-web/oracle/cadr-m6-release-record.json"), "{}\n", { mode: 0o400 });
  for (const name of ["run-cadr-m6-selected-image-negative.mjs",
    "cadr-m6-selected-image-negative-evidence.mjs",
    "cadr-m6-ready4-evidence.mjs",
    "cadr-m6-selected-image-authority.scm",
    "cadr-m6-selected-image-static-launcher.c"]) {
    await writeFile(resolve(root, "scripts", name), `// ${name}\n`,
      { mode: 0o400 });
  }
  return root;
}

{
  const root = await stagedJavaScriptFixture("cadr-m6-staged-entry-race-");
  const target = resolve(root, "scripts/run-cadr-m6-selected-image-negative.mjs");
  const displaced = `${target}.original`;
  const pin = await pinSelectedImageStagedExecutionClosure(root);
  await verifyPinnedSelectedImageStagedExecutionClosure(pin);
  await rename(target, displaced);
  await writeFile(target, "// replacement\n", { mode: 0o400 });
  await assert.rejects(() => verifyPinnedSelectedImageStagedExecutionClosure(pin),
    /mutation|drift/, "a current directory-entry replacement is rejected");
  await closePinnedSelectedImageStagedExecutionClosure(pin);
  await rm(root, { recursive: true, force: true });
}

{
  const root = await stagedJavaScriptFixture("cadr-m6-staged-restore-race-");
  const target = resolve(root, "scripts/cadr-m6-selected-image-negative-evidence.mjs");
  const displaced = `${target}.original`;
  const pin = await pinSelectedImageStagedExecutionClosure(root);
  await rename(target, displaced);
  await writeFile(target, "// transient attacker bytes\n", { mode: 0o400 });
  await rm(target);
  await rename(displaced, target);
  await assert.rejects(() => verifyPinnedSelectedImageStagedExecutionClosure(pin),
    /mutation|drift/, "replace-and-restore is retained as an in-scope mutation");
  await closePinnedSelectedImageStagedExecutionClosure(pin);
  await rm(root, { recursive: true, force: true });
}

{
  const root = await stagedJavaScriptFixture("cadr-m6-whole-source-race-");
  const displaced = `${root}.original`;
  class SilentWatcher extends EventEmitter {
    on(event, listener) { return super.on(event, listener); }
    close() { this.emit("close"); }
  }
  const pin = await pinSelectedImageStagedExecutionClosure(root, undefined, {
    watchFactory: () => new SilentWatcher(),
  });
  const descriptorRoot = selectedImagePinnedSourceRoot(pin);
  const originalEntry = await readFile(resolve(descriptorRoot,
    "scripts/run-cadr-m6-selected-image-negative.mjs"), "utf8");
  await rename(root, displaced);
  await mkdir(resolve(root, "scripts"), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root,
    "scripts/run-cadr-m6-selected-image-negative.mjs"),
  "// replacement tree executable\n", { mode: 0o400 });
  assert.equal(await readFile(resolve(descriptorRoot,
    "scripts/run-cadr-m6-selected-image-negative.mjs"), "utf8"), originalEntry,
  "the unit-start source pathname is rooted in the retained directory descriptor");
  await rm(root, { recursive: true, force: true });
  await rename(displaced, root);
  await assert.rejects(() =>
    verifyPinnedSelectedImageStagedExecutionClosure(pin), /mutation|drift/,
  "directory identities reject whole-sourceRoot restore even if watch coalesces");
  await closePinnedSelectedImageStagedExecutionClosure(pin);
  await rm(root, { recursive: true, force: true });
}

{
  const root = await stagedJavaScriptFixture("cadr-m6-release-baba-race-");
  const releasePath = resolve(root,
    "cadr-web/oracle/cadr-m6-release-record.json");
  const displaced = `${releasePath}.committed`;
  const pin = await pinSelectedImageStagedExecutionClosure(root);
  const retained = selectedImagePinnedFile(pin,
    "cadr-web/oracle/cadr-m6-release-record.json");
  assert.equal(retained.bytes.toString("utf8"), "{}\n");
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await rename(releasePath, displaced);
    await writeFile(releasePath, `{"hostile":${cycle}}\n`, { mode: 0o400 });
    await rm(releasePath);
    await rename(displaced, releasePath);
  }
  assert.equal(selectedImagePinnedFile(pin,
    "cadr-web/oracle/cadr-m6-release-record.json").sha256, retained.sha256,
  "the supervisor retains one release-record read through B/A/B/A");
  await assert.rejects(() =>
    verifyPinnedSelectedImageStagedExecutionClosure(pin), /mutation|drift/,
  "the complete release-record B/A/B/A choreography is rejected");
  await closePinnedSelectedImageStagedExecutionClosure(pin);
  await rm(root, { recursive: true, force: true });
}

for (const failure of ["close", "error", "overflow"]) {
  const root = await stagedJavaScriptFixture(`cadr-m6-watch-${failure}-`);
  const watchers = [];
  class SyntheticWatcher extends EventEmitter {
    constructor(callback) { super(); this.callback = callback; }
    close() { this.emit("close"); }
  }
  const pin = await pinSelectedImageStagedExecutionClosure(root, undefined, {
    watchFactory: (_path, _options, callback) => {
      const watcher = new SyntheticWatcher(callback); watchers.push(watcher);
      return watcher;
    },
  });
  if (failure === "close") watchers[0].emit("close");
  else if (failure === "error") watchers[0].emit("error",
    new Error("synthetic watcher failure"));
  else watchers[0].callback("rename", null);
  await assert.rejects(() =>
    verifyPinnedSelectedImageStagedExecutionClosure(pin),
  /watcher|synthetic/, `fs.watch ${failure} fails closed`);
  await closePinnedSelectedImageStagedExecutionClosure(pin);
  await rm(root, { recursive: true, force: true });
}

{
  const sourceRoot = await stagedJavaScriptFixture(
    "cadr-m6-build-time-substitution-");
  const privateRoot = resolve(dirname(sourceRoot),
    `${basename(sourceRoot)}-private`);
  await mkdir(privateRoot, { mode: 0o700 });
  const selected = { kind: 3, byte_count: "2", sha256: "11".repeat(32) };
  const releaseBytes = Buffer.from(canonicalJson({ artifacts: [selected] }));
  const releasePath = resolve(sourceRoot,
    "cadr-web/oracle/cadr-m6-release-record.json");
  await rm(releasePath);
  await writeFile(releasePath, releaseBytes, { mode: 0o400 });
  const nonce = resolve(dirname(sourceRoot), `${basename(sourceRoot)}.nonce`);
  await writeFile(nonce, Buffer.alloc(32), { mode: 0o400 });
  const output = resolve(dirname(sourceRoot), `${basename(sourceRoot)}.out`);
  const stage = Object.freeze({ root: sourceRoot, sourceRoot, privateRoot,
    release: releasePath, nonce, envelope: resolve(privateRoot, "result.json"),
    sourceClosure: Object.freeze({ source_commit: "ab".repeat(20),
      source_closure_sha256: "cd".repeat(32) }) });
  let started = false;
  await assert.rejects(() => executeSelectedImageNegativeSystemd({
    artifactRoot: "/synthetic/artifacts", output,
  }, {
    stageSource: async () => stage,
    validateClosure: async () => stage.sourceClosure,
    buildAuthority: async () => {
      const entry = resolve(sourceRoot,
        "scripts/run-cadr-m6-selected-image-negative.mjs");
      await rename(entry, `${entry}.reviewed`);
      await writeFile(entry, "// hostile during Guix evaluation\n",
        { mode: 0o400 });
      return syntheticAuthority(stage);
    },
    startUnit: async () => { started = true; throw new Error("must not start"); },
    removeStage: async root => rm(root, { recursive: true, force: true }),
  }), /mutation|drift/,
  "post-build retained-byte revalidation rejects substitution before startUnit");
  assert.equal(started, false);
  await rm(privateRoot, { recursive: true, force: true });
  await rm(nonce, { force: true });
  await rm(`${output}.failure.json`, { force: true });
}

const command = selectedImageNegativeSystemdCommand(["child", "--execute"],
  "12".repeat(16), ["/gnu/store/authority", "/artifacts"], "/private",
  "/gnu/store/authority/bin/cadr-m6-selected-image-static-launcher");
for (const property of [
  "--property=RuntimeMaxSec=600s", "--property=MemoryMax=536870912",
  "--property=MemorySwapMax=0", "--property=CPUQuota=100%", "--property=TasksMax=32",
  "--property=LimitCORE=0",
  "--property=PrivateNetwork=yes", "--property=RestrictAddressFamilies=AF_UNIX",
  "--property=ReadOnlyPaths=/gnu/store/authority /artifacts",
  "--property=ReadWritePaths=/private",
  "--property=ProtectSystem=strict", "--property=ProtectHome=read-only",
]) assert.ok(command.args.includes(property), property);
assert.ok(command.args.some(value =>
  value === ":/gnu/store/authority/bin/cadr-m6-selected-image-static-launcher"),
  "the ExecStart executable disables systemd environment expansion");
const launcherIndex = command.args.indexOf(
  ":/gnu/store/authority/bin/cadr-m6-selected-image-static-launcher");
assert.deepEqual(command.args.slice(launcherIndex + 1, launcherIndex + 4),
  [command.unit, M6_SELECTED_IMAGE_PINNED_NODE.path, "child"],
  "the static launcher directly receives the unit, pinned Node, and child");
assert.equal(command.args.some(value => value.startsWith("--setenv=")), false,
  "no inherited systemd environment assignment is relied upon");
{
  const buildRoot = await mkdtemp(resolve(tmpdir(), "cadr-m6-guix-authority-"));
  for (const relative of [
    "scripts/cadr-m6-selected-image-authority.scm",
    "scripts/cadr-m6-selected-image-static-launcher.c",
    "scripts/run-cadr-m6-selected-image-negative.mjs",
    "scripts/cadr-m6-selected-image-negative-evidence.mjs",
    "scripts/cadr-m6-ready4-evidence.mjs",
    "cadr-web/oracle/cadr-m6-release-record.json",
  ]) {
    await mkdir(dirname(resolve(buildRoot, relative)),
      { recursive: true, mode: 0o700 });
    await writeFile(resolve(buildRoot, relative),
      await readFile(resolve(process.cwd(), relative)), { mode: 0o400 });
  }
  const authoritySourcePaths = Object.freeze({
    derivation: resolve(buildRoot,
      "scripts/cadr-m6-selected-image-authority.scm"),
    launcherSource: resolve(buildRoot,
      "scripts/cadr-m6-selected-image-static-launcher.c"),
    childSource: resolve(buildRoot,
      "scripts/run-cadr-m6-selected-image-negative.mjs"),
    selectedEvidence: resolve(buildRoot,
      "scripts/cadr-m6-selected-image-negative-evidence.mjs"),
    ready4Evidence: resolve(buildRoot,
      "scripts/cadr-m6-ready4-evidence.mjs"),
    releaseRecord: resolve(buildRoot,
      "cadr-web/oracle/cadr-m6-release-record.json"),
  });
  const marker = resolve(buildRoot, "pre-main-marker");
  const retainedHandles = {};
  for (const [name, path] of Object.entries(authoritySourcePaths)) {
    retainedHandles[name] = await open(path, "r");
  }
  const authorityInputs = Object.freeze(Object.fromEntries(
    Object.entries(retainedHandles).map(([name, handle]) =>
      [name, `/proc/${process.pid}/fd/${handle.fd}`])));
  await assert.rejects(() => buildSelectedImageGuixAuthority(authorityInputs, {
    source_closure_sha256: "cd".repeat(32),
  }, { captureFn: () => {
    throw new Error("synchronous Guix client failure");
  } }), /synchronous Guix client failure/,
  "Guix descriptor authority revalidates and closes after a synchronous client throw");
  const duringBuildEntry = authoritySourcePaths.childSource;
  let captureCalls = 0;
  const authority = await buildSelectedImageGuixAuthority(authorityInputs, {
    source_closure_sha256: "cd".repeat(32),
  }, { captureFn: async (program, args, options = {}) => {
    assert.match(program, new RegExp(`^/proc/${process.pid}/fd/[0-9]+$`),
      "every Guix command executes the retained reviewed descriptor");
    assert.equal(Object.hasOwn(options.env ?? {}, "PATH"), false);
    if (captureCalls++ === 0) {
      await rename(duringBuildEntry, `${duringBuildEntry}.reviewed-during-build`);
      await writeFile(duringBuildEntry,
        `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "hostile-guix-evaluation");\n`);
    }
    const result = spawnSync(program, args, { ...options, maxBuffer: 16 * 1024 * 1024 });
    return { code: result.status, signal: result.signal,
      failure: result.error ?? null, stdout: result.stdout ?? Buffer.alloc(0),
      stderr: result.stderr ?? Buffer.alloc(0) };
  } });
  await rm(duringBuildEntry);
  await rename(`${duringBuildEntry}.reviewed-during-build`, duringBuildEntry);
  for (const handle of Object.values(retainedHandles)) await handle.close();
  const launcherEntry = authority.files.find(entry => entry.role === "launcher");
  const childEntry = authority.files.find(entry => entry.role === "entry");
  const launcher = resolve(authority.output_path, launcherEntry.relative_path);
  const immutableChild = resolve(authority.output_path, childEntry.relative_path);
  assert.doesNotMatch(await readFile(immutableChild, "utf8"),
    /hostile-guix-evaluation/,
  "Guix authority inputs come from retained descriptors, not substituted stage paths");
  const preloadSource = resolve(buildRoot, "preload.c");
  const preload = resolve(buildRoot, "preload.so");
  const launcherBytes = await readFile(launcher);
  assert.deepEqual(parseStaticLauncherElf(launcherBytes),
    M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY.elf);
  assert.deepEqual(authority.files.map(({ relative_path, mode, role }) =>
    ({ relative_path, mode, role })), M6_SELECTED_IMAGE_AUTHORITY_FILES);
  const hostileEntry = resolve(buildRoot,
    "scripts/run-cadr-m6-selected-image-negative.mjs");
  await rename(hostileEntry, `${hostileEntry}.reviewed`);
  await writeFile(hostileEntry,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "hostile-stage-executed");\n`);
  const hostilePositive = spawnSync(M6_SELECTED_IMAGE_PINNED_NODE.path,
    ["--input-type=module", "-e",
      `await import(${JSON.stringify(pathToFileURL(hostileEntry).href)})`],
    { encoding: "utf8" });
  assert.equal(hostilePositive.status, 0, hostilePositive.stderr);
  assert.equal((await lstat(marker)).isFile(), true,
    "the hostile B/A replacement has a live code-execution marker");
  await rm(marker);
  await rm(hostileEntry);
  await rename(`${hostileEntry}.reviewed`, hostileEntry);
  await rename(hostileEntry, `${hostileEntry}.reviewed`);
  await writeFile(hostileEntry,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "second-hostile-stage-executed");\n`);
  const immutableImport = spawnSync(launcher,
    [command.unit, M6_SELECTED_IMAGE_PINNED_NODE.path, "--input-type=module", "-e",
      `await import(${JSON.stringify(pathToFileURL(immutableChild).href)})`],
    { encoding: "utf8", env: { NODE_OPTIONS: "--no-warnings" } });
  assert.equal(immutableImport.status, 0, immutableImport.stderr);
  await assert.rejects(lstat(marker), error => error?.code === "ENOENT",
    "the second hostile B in a B/A/B/A path sequence never executes through the store authority");
  await rm(hostileEntry);
  await rename(`${hostileEntry}.reviewed`, hostileEntry);
  await writeFile(preloadSource,
    `#include <fcntl.h>\n#include <unistd.h>\n__attribute__((constructor)) static void probe(void){int fd=open(${JSON.stringify(marker)},O_WRONLY|O_CREAT|O_EXCL,0600);if(fd>=0)close(fd);}\n`);
  const preloadBuilt = spawnSync("/usr/bin/gcc",
    ["-shared", "-fPIC", "-o", preload, preloadSource],
    { encoding: "utf8", env: { LANG: "C", LC_ALL: "C", PATH: "/usr/bin" } });
  assert.equal(preloadBuilt.status, 0, preloadBuilt.stderr);
  const positiveControl = spawnSync("/usr/bin/node", ["-e", ""],
    { encoding: "utf8", env: { LD_PRELOAD: preload } });
  assert.equal(positiveControl.status, 0, positiveControl.stderr);
  assert.equal((await lstat(marker)).isFile(), true,
    "the hostile constructor probe is live against a dynamic Node launch");
  await rm(marker);
  const probe = spawnSync(launcher, [command.unit,
    M6_SELECTED_IMAGE_PINNED_NODE.path, "-e",
    "process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(process.env).sort())))",
  ], { encoding: "utf8", env: {
    OPENSSL_CONF: "/host/openssl.cnf", OPENSSL_MODULES: "/host/modules",
    NODE_OPTIONS: "--no-warnings", LD_PRELOAD: preload,
    UNREVIEWED_AMBIENT_KEY: "host-controlled",
  } });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout), command.effectiveEnvironment,
    "the static execve boundary eliminates OpenSSL and every ambient key");
  await assert.rejects(lstat(marker), error => error?.code === "ENOENT",
    "hostile LD_PRELOAD executes no constructor before the static launcher");
  await rm(buildRoot, { recursive: true, force: true });
}
const unit = command.unit;
const policy = {
  RuntimeMaxUSec: "10min", TimeoutStopUSec: "30s", MemoryMax: "536870912",
  MemorySwapMax: "0", CPUQuotaPerSecUSec: "1s", TasksMax: "32", UMask: "0077",
  LimitCORE: "0",
  NoNewPrivileges: "yes", PrivateNetwork: "yes", RestrictAddressFamilies: "AF_UNIX",
  KillMode: "control-group", ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
  RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
  IOAccounting: "yes", IPAccounting: "yes", ProtectSystem: "strict",
  ProtectHome: "read-only", ProtectControlGroups: "yes", ProtectKernelTunables: "yes",
  ProtectKernelModules: "yes", LockPersonality: "yes", RestrictSUIDSGID: "yes",
  ReadOnlyPaths: "/source /artifacts", ReadWritePaths: "/private",
  Environment: "",
};
for (const [value, expected] of [["600s", 600000000n], ["10min", 600000000n],
  ["600000000us", 600000000n], ["600000ms", 600000000n]]) {
  assert.equal(parseSelectedImageNegativeDurationUSec(value), expected);
}
for (const value of ["9min", "601s", "infinity", "10min 1s",
  "000600s", "9999999999999999h"]) {
  if (value === "9min" || value === "601s") {
    assert.throws(() => validateSelectedImageNegativeSystemdPolicy({
      ...policy, RuntimeMaxUSec: value,
    }, "/source", "/artifacts", "/private", unit), /RuntimeMaxUSec/);
  } else {
    assert.throws(() => parseSelectedImageNegativeDurationUSec(value),
      /duration/);
  }
}
assert.equal(validateSelectedImageNegativeSystemdPolicy(policy, "/source", "/artifacts",
  "/private", unit).ProtectSystem, "strict");
assert.throws(() => validateSelectedImageNegativeSystemdPolicy({ ...policy,
  ReadOnlyPaths: "/source" }, "/source", "/artifacts", "/private", unit), /read-only paths/);
assert.throws(() => validateSelectedImageNegativeSystemdPolicy({ ...policy,
  ReadOnlyPaths: "/source /artifacts /widened" }, "/source", "/artifacts", "/private", unit), /read-only paths/);
assert.throws(() => validateSelectedImageNegativeSystemdPolicy({ ...policy,
  ReadWritePaths: "/private /widened" }, "/source", "/artifacts", "/private", unit), /read-write paths/);
assert.throws(() => validateSelectedImageNegativeSystemdPolicy({ ...policy,
  LimitCORE: "infinity" }, "/source", "/artifacts", "/private", unit), /LimitCORE/);
assert.equal(validateSelectedImageNegativeSystemdAccounting({ MemoryPeak: "1",
  CPUUsageNSec: "2", TasksCurrent: "[not set]", IOReadBytes: "[not set]",
  IOWriteBytes: "0", IPIngressBytes: "[no data]", IPEgressBytes: "[no data]" }).MemoryPeak,
"1");

function syntheticSelectedSystemdShow(sourceRoot, privateRoot) {
  return { ...policy, ReadOnlyPaths: `${sourceRoot} /synthetic/artifacts`,
    ReadWritePaths: privateRoot, Result: "success", ExecMainCode: "1",
    ExecMainStatus: "0", MemoryPeak: "1", CPUUsageNSec: "2",
    TasksCurrent: "0", IOReadBytes: "0", IOWriteBytes: "0",
    IPIngressBytes: "0", IPEgressBytes: "0" };
}

function syntheticSelectedRun(stage, release, selected, environment) {
  return {
    schema: "cadr-m6-selected-image-negative-run-v1",
    outcome: "selected-image-negative",
    contract: "C-M6-SELECTED-IMAGE-NEGATIVE-v1",
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1",
    source_commit: stage.sourceClosure.source_commit,
    source_closure_sha256: stage.sourceClosure.source_closure_sha256,
    effective_environment: environment,
    release_record: release.identity, selected_disk: selected,
    base_before: { byte_count: "2", sha256: selected.sha256 },
    base_after: { byte_count: "2", sha256: selected.sha256 },
    negative_views: [
      { kind: "same-length-xor-v1", disposition: "rejected-hash-mismatch",
        byte_count: "2", sha256: "22".repeat(32),
        xor_byte_offset: "1", xor_mask: "01" },
      { kind: "truncated-by-one-v1",
        disposition: "rejected-byte-count-mismatch",
        byte_count: "1", sha256: "33".repeat(32) },
    ],
    materialized_image_bytes: "0", worker_constructed: false,
    wasm_build_attempted: false, guest_execution_attempted: false,
  };
}

function syntheticAuthority(stage) {
  return Object.freeze({
    ...M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY,
    source_closure_sha256: stage.sourceClosure.source_closure_sha256,
  });
}

{
  const calls = [];
  await assert.rejects(() => startSelectedImageNegativeUnit(command, {
    captureFn: async (...args) => {
      calls.push(args);
      if (calls.length === 1) {
        return { code: 1, signal: null, failure: null,
          stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
      }
      return { code: 0, signal: null, failure: null,
        stdout: Buffer.from("LoadState=not-found\nTransient=no\nFragmentPath=\nType=\nExecStart=\n"),
        stderr: Buffer.alloc(0) };
    },
  }), /refused/);
  assert.equal(calls.length, 2,
    "a creation refusal proves the unique unit name absent");
  assert.equal(calls[0][0], "/usr/bin/systemd-run");
  assert.deepEqual(calls[1][1].slice(-1),
    ["--property=LoadState,Transient,FragmentPath,Type,ExecStart"],
    "ambiguous recovery queries the exact service type and command record");
}

for (const ambiguous of [
  { code: 1, signal: null, failure: null },
  { code: null, signal: "SIGKILL", failure: null },
  { code: null, signal: null, failure: new Error("client reply lost") },
]) {
  let call = 0;
  const recovered = await startSelectedImageNegativeUnit(command, {
    captureFn: async () => {
      if (call++ === 0) return { ...ambiguous,
        stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
      return { code: 0, signal: null, failure: null,
        stdout: Buffer.from([
          "LoadState=loaded", "Transient=yes", "Type=exec",
          `FragmentPath=${command.fragmentPath}`,
          `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=123 ; code=(null) ; status=0/0 }`,
          "",
        ].join("\n")), stderr: Buffer.alloc(0) };
    },
  });
  assert.equal(recovered, command.unit,
    "accepted-but-reply-lost unit ownership is recovered from exact ExecStart");
}

for (const shown of [
  "LoadState=loaded\nTransient=yes\nType=exec\nFragmentPath=\nExecStart={ path=/unrelated ; argv[]=/unrelated ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }\n",
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=/attacker/systemd/transient/${command.unit}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}/malformed`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=oneshot",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }suffix`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 } ; { path=/gnu/store/attacker-node ; argv[]=/gnu/store/attacker-node /tmp/extra.mjs ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=n/a ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    "MALFORMED-TRAILING-BYTES", ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    "Unexpected=value", ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`, ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`,
    ""].join("\n"),
  ["LoadState=loaded", "Transient=yes", "Type=exec",
    `FragmentPath=${command.fragmentPath}`,
    `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }\r`,
    ""].join("\n"),
  null,
]) {
  await assert.rejects(() => startSelectedImageNegativeUnit(command, {
    captureFn: async (program) => program === "/usr/bin/systemd-run" ?
      { code: null, signal: "SIGTERM", failure: null,
        stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) } :
      shown === null ?
        { code: null, signal: null, failure: new Error("manager query lost"),
          stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) } :
        { code: 0, signal: null, failure: null,
          stdout: Buffer.from(shown), stderr: Buffer.alloc(0) },
  }), error => error?.preserveStage === true,
  "wrong-identity or unqueryable ambiguous unit never grants cleanup ownership");
}

{
  assert.throws(() => parseExactSelectedImageSystemdShow(
    "A=1\nTRAILING\n", ["A"], "adversary"), /malformed/);
  assert.throws(() => parseExactSelectedImageSystemdShow(
    "A=1\nB=2\n", ["A"], "adversary"), /unexpected/);
  assert.throws(() => parseExactSelectedImageSystemdShow(
    "A=1\n", ["A", "B"], "adversary"), /missing/);
  assert.throws(() => parseExactSelectedImageSystemdShow(
    "A=1\nA=2\n", ["A"], "adversary"), /duplicate/);
}

{
  const hostileDirectory = await mkdtemp(resolve(tmpdir(),
    "cadr-m6-hostile-systemd-path-"));
  const hostileRun = resolve(hostileDirectory, "systemd-run");
  await writeFile(hostileRun, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await assert.rejects(() => pinSelectedImageSystemdClients({
    systemdRun: hostileRun, systemctl: "/usr/bin/systemctl",
  }), /root-owned|system binary/,
  "a caller-owned altered systemd client cannot become authority");
  const clients = await pinSelectedImageSystemdClients();
  try {
    assert.deepEqual(await verifySelectedImageSystemdClients(clients),
      clients.identity);
    const originalPath = process.env.PATH;
    process.env.PATH = hostileDirectory;
    process.env.M6_HOSTILE_AMBIENT = "must-not-cross";
    const invocations = [];
    try {
      await startSelectedImageNegativeUnit(command, {
        clients,
        captureFn: async (program, args, options) => {
          invocations.push({ program, args, options });
          if (invocations.length === 1) {
            return { code: null, signal: null,
              failure: new Error("reply lost"), stdout: Buffer.alloc(0),
              stderr: Buffer.alloc(0) };
          }
          return { code: 0, signal: null, failure: null,
            stdout: Buffer.from([
              "LoadState=loaded", "Transient=yes", "Type=exec",
              `FragmentPath=${command.fragmentPath}`,
              `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=123 ; code=(null) ; status=0/0 }`,
              "",
            ].join("\n")), stderr: Buffer.alloc(0) };
        },
      });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      delete process.env.M6_HOSTILE_AMBIENT;
    }
    assert.equal(invocations.length, 2);
    for (const invocation of invocations) {
      assert.match(invocation.program,
        new RegExp(`^/proc/${process.pid}/fd/[0-9]+$`));
      assert.deepEqual(invocation.options.env, systemdControlEnvironment);
      assert.equal(Object.hasOwn(invocation.options.env, "PATH"), false);
      assert.equal(Object.hasOwn(invocation.options.env, "M6_HOSTILE_AMBIENT"),
        false);
    }
    assert.notEqual(invocations[0].program, invocations[1].program,
      "systemd-run and systemctl execute their separately retained descriptors");
  } finally {
    await closeSelectedImageSystemdClients(clients);
    await rm(hostileDirectory, { recursive: true, force: true });
  }
}

{
  for (const captureFn of [
    () => { throw new Error("synchronous client failure"); },
    async () => { throw new Error("rejected client failure"); },
  ]) {
    const clients = await pinSelectedImageSystemdClients();
    try {
      let calls = 0;
      await assert.rejects(() => startSelectedImageNegativeUnit(command, {
        clients,
        captureFn: async (...args) => {
          if (calls++ === 0) return captureFn(...args);
          return { code: 0, signal: null, failure: null,
            stdout: Buffer.from(
              "LoadState=not-found\nTransient=no\nFragmentPath=\nType=\nExecStart=\n"),
            stderr: Buffer.alloc(0) };
        },
      }), /client failure/);
      assert.deepEqual(await verifySelectedImageSystemdClients(clients),
        clients.identity,
      "post-validation completes after synchronous throws and rejections");
    } finally {
      await closeSelectedImageSystemdClients(clients);
    }
  }
  const clients = await pinSelectedImageSystemdClients();
  try {
    let calls = 0;
    await assert.rejects(() => startSelectedImageNegativeUnit(command, {
      clients,
      captureFn: async () => {
        if (calls++ === 0) {
          await clients.systemdRun.handle.close();
          throw new Error("command failure before post-check");
        }
        throw new Error("recovery query failed");
      },
    }), error => error?.preserveStage === true &&
      error.cause instanceof AggregateError &&
      error.cause.errors.length === 2 &&
      /command failure/.test(error.cause.errors[0].message) &&
      /identity|closed|file handle/i.test(error.cause.errors[1].message),
    "combined command/post failures retain deterministic order and failed recovery preserves the stage");
  } finally {
    await closeSelectedImageSystemdClients(clients).catch(() => undefined);
  }
  const recoverable = await pinSelectedImageSystemdClients();
  try {
    let calls = 0;
    const recovered = await startSelectedImageNegativeUnit(command, {
      clients: recoverable,
      captureFn: async () => {
        if (calls++ === 0) {
          await recoverable.systemdRun.handle.close();
          return { code: 0, signal: null, failure: null,
            stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
        }
        return { code: 0, signal: null, failure: null,
          stdout: Buffer.from([
            "LoadState=loaded", "Transient=yes", "Type=exec",
            `FragmentPath=${command.fragmentPath}`,
            `ExecStart={ path=${command.execStart[0]} ; argv[]=${command.execStart.join(" ")} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=123 ; code=(null) ; status=0/0 }`,
            "",
          ].join("\n")), stderr: Buffer.alloc(0) };
      },
    });
    assert.equal(recovered, command.unit,
      "a post-success validation failure recovers exact ownership through the independently retained systemctl");
  } finally {
    await closeSelectedImageSystemdClients(recoverable).catch(() => undefined);
  }
}

{
  const clients = await pinSelectedImageSystemdClients();
  try {
    const calls = [];
    await stopAndRemoveSelectedImageNegativeUnit(command.unit, clients, {
      captureFn: async (program, args, options) => {
        calls.push({ program, args, options });
        return { code: 0, signal: null, failure: null,
          stdout: Buffer.from(args.includes("show") ?
            "LoadState=not-found\n" : ""),
          stderr: Buffer.alloc(0) };
      },
      delayFn: async () => undefined,
    });
    assert.deepEqual(calls.at(-1).args.slice(-2),
      [command.unit, "--property=LoadState"],
    "cleanup proves absence with the exact LoadState query");
    for (const malformed of [
      " \n",
      "LoadState=not-found",
      "LoadState=not-found\nTRAILING\n",
      "LoadState=not-found\nLoadState=not-found\n",
      "LoadState=not-found\nUnexpected=value\n",
      "LoadState=not-found\n\n",
    ]) {
      await assert.rejects(() => stopAndRemoveSelectedImageNegativeUnit(
        command.unit, clients, {
          captureFn: async (_program, args) => ({
            code: 0, signal: null, failure: null,
            stdout: Buffer.from(args.includes("show") ? malformed : ""),
            stderr: Buffer.alloc(0),
          }),
          delayFn: async () => undefined,
        }), /absence is unverified/,
      "whitespace, trailing, malformed, duplicate, unexpected, and empty records never prove unit absence");
    }
  } finally {
    await closeSelectedImageSystemdClients(clients);
  }
}

{
  const lifecycleRoot = await mkdtemp(resolve(tmpdir(),
    "cadr-m6-selected-ambiguous-preserve-"));
  const sourceRoot = resolve(lifecycleRoot, "source");
  const privateRoot = resolve(lifecycleRoot, "private");
  const releasePath = resolve(sourceRoot,
    "cadr-web/oracle/cadr-m6-release-record.json");
  const output = resolve(dirname(lifecycleRoot),
    `${basename(lifecycleRoot)}.ambiguous.json`);
  await mkdir(dirname(releasePath), { recursive: true, mode: 0o700 });
  await mkdir(privateRoot, { mode: 0o700 });
  const selected = { kind: 3, byte_count: "2", sha256: "11".repeat(32) };
  const releaseBytes = Buffer.from(canonicalJson({ artifacts: [selected] }));
  await writeFile(releasePath, releaseBytes, { mode: 0o400 });
  await writeFile(resolve(lifecycleRoot, "invocation.nonce"), Buffer.alloc(32),
    { mode: 0o400 });
  const stage = Object.freeze({ root: lifecycleRoot, sourceRoot, privateRoot,
    release: releasePath, nonce: resolve(lifecycleRoot, "invocation.nonce"),
    envelope: resolve(privateRoot, "result.json"),
    sourceClosure: Object.freeze({ source_commit: "ab".repeat(20),
      source_closure_sha256: "cd".repeat(32) }) });
  let removed = false; let closed = false; let dispatchCalls = 0;
  await assert.rejects(() => executeSelectedImageNegativeSystemd({
    artifactRoot: "/synthetic/artifacts", output,
  }, {
    stageSource: async () => stage,
    pinStaged: async () => Object.freeze({ synthetic: true }),
    pinnedSourceRoot: () => sourceRoot,
    pinnedFile: () => ({ bytes: releaseBytes }),
    validateClosure: async () => stage.sourceClosure,
    verifyPinned: async () => undefined,
    pinnedAuthority: () => Object.freeze({}),
    buildAuthority: async () => syntheticAuthority(stage),
    startUnit: async (commandValue, { clients }) =>
      startSelectedImageNegativeUnit(commandValue, {
        clients,
        captureFn: async () => {
          if (dispatchCalls++ === 0) {
            await clients.systemdRun.handle.close();
            return { code: 0, signal: null, failure: null,
              stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
          }
          throw new Error("recovery unavailable");
        },
      }),
    closePinned: async () => { closed = true; },
    removeStage: async () => { removed = true; },
  }), /could not be recovered/);
  assert.equal(dispatchCalls, 2,
    "successful dispatch followed by failed post-check attempts exact recovery");
  assert.equal(closed, false);
  assert.equal(removed, false);
  assert.equal((await lstat(lifecycleRoot)).isDirectory(), true,
    "an unowned ambiguous unit prevents stage and descriptor cleanup");
  await rm(lifecycleRoot, { recursive: true, force: true });
  await rm(`${output}.failure.json`, { force: true });
}

{
  const lifecycleRoot = await mkdtemp(resolve(tmpdir(),
    "cadr-m6-selected-supervisor-lifecycle-"));
  const sourceRoot = resolve(lifecycleRoot, "source");
  const privateRoot = resolve(lifecycleRoot, "private");
  const releasePath = resolve(sourceRoot,
    "cadr-web/oracle/cadr-m6-release-record.json");
  const output = resolve(dirname(lifecycleRoot), `${basename(lifecycleRoot)}.receipt.json`);
  await mkdir(dirname(releasePath), { recursive: true, mode: 0o700 });
  await mkdir(privateRoot, { mode: 0o700 });
  const selected = { kind: 3, byte_count: "2", sha256: "11".repeat(32) };
  const releaseBytes = Buffer.from(canonicalJson({ artifacts: [selected] }));
  const release = readCanonicalSelectedImageRelease(releaseBytes);
  await writeFile(releasePath, releaseBytes, { mode: 0o400 });
  await writeFile(resolve(lifecycleRoot, "invocation.nonce"), Buffer.alloc(32),
    { mode: 0o400 });
  const stage = Object.freeze({ root: lifecycleRoot, sourceRoot, privateRoot,
    release: releasePath, nonce: resolve(lifecycleRoot, "invocation.nonce"),
    envelope: resolve(privateRoot, "result.json"),
    sourceClosure: Object.freeze({ source_commit: "ab".repeat(20),
      source_closure_sha256: "cd".repeat(32) }),
    launcher: Object.freeze({ path: resolve(sourceRoot,
      ".m6-authority/static-execve-env6"),
    identity: M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY }),
  });
  let started = null; let pinChecks = 0; let pinClosed = 0;
  let stopped = 0; let removed = 0;
  const receipt = await executeSelectedImageNegativeSystemd({
    artifactRoot: "/synthetic/artifacts", output,
  }, Object.create({
    stageSource: async () => stage,
    pinStaged: async () => Object.freeze({ synthetic: true }),
    pinnedSourceRoot: () => sourceRoot,
    pinnedFile: () => ({ bytes: releaseBytes }),
    validateClosure: async () => stage.sourceClosure,
    pinnedAuthority: () => Object.freeze({}),
    buildAuthority: async () => syntheticAuthority(stage),
    verifyPinned: async () => { pinChecks += 1; },
    closePinned: async () => { pinClosed += 1; },
    startUnit: async commandValue => {
      started = commandValue; return commandValue.unit;
    },
    waitUnit: async () => undefined,
    captureUnit: async () => {
      const shown = syntheticSelectedSystemdShow(
        syntheticAuthority(stage).output_path, privateRoot);
      return { code: 0, signal: null, failure: null, stderr: Buffer.alloc(0),
        stdout: Buffer.from(Object.entries(shown).map(([key, value]) =>
          `${key}=${value}`).join("\n") + "\n") };
    },
    readRun: async () => ({ value: syntheticSelectedRun(stage, release,
      selected, started.effectiveEnvironment) }),
    verifyLauncher: async value => {
      assert.deepEqual(value, syntheticAuthority(stage));
    },
    stopUnit: async value => {
      assert.equal(value, started.unit); stopped += 1;
    },
    removeStage: async value => {
      assert.equal(value, lifecycleRoot); removed += 1;
      await rm(value, { recursive: true });
    },
  }));
  assert.equal(validateSelectedImageNegativeSupervised(receipt).outcome,
    "selected-image-negative-supervised");
  assert.throws(() => pinExecutedSelectedImageNegativeReceipt(receipt),
    /not minted/,
  "prototype-injected tests cannot mint a production READY4 token");
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), receipt,
    "the full mocked supervisor reaches canonical success publication");
  assert.equal(pinChecks, 3,
    "staged pins bracket the Guix build and span the child");
  assert.equal(pinClosed, 1); assert.equal(stopped, 1); assert.equal(removed, 1);
  await assert.rejects(lstat(lifecycleRoot), error => error?.code === "ENOENT",
    "the successful lifecycle removes its source and private stage");
  await rm(output, { force: true });
}

{
  const lifecycleRoot = await mkdtemp(resolve(tmpdir(),
    "cadr-m6-selected-publish-eexist-"));
  const sourceRoot = resolve(lifecycleRoot, "source");
  const privateRoot = resolve(lifecycleRoot, "private");
  const releasePath = resolve(sourceRoot,
    "cadr-web/oracle/cadr-m6-release-record.json");
  const output = resolve(dirname(lifecycleRoot),
    `${basename(lifecycleRoot)}.occupied.json`);
  await mkdir(dirname(releasePath), { recursive: true, mode: 0o700 });
  await mkdir(privateRoot, { mode: 0o700 });
  const selected = { kind: 3, byte_count: "2", sha256: "11".repeat(32) };
  const releaseBytes = Buffer.from(canonicalJson({ artifacts: [selected] }));
  const release = readCanonicalSelectedImageRelease(releaseBytes);
  await writeFile(releasePath, releaseBytes, { mode: 0o400 });
  await writeFile(resolve(lifecycleRoot, "invocation.nonce"), Buffer.alloc(32),
    { mode: 0o400 });
  await writeFile(output, "occupied", { mode: 0o600 });
  const stage = Object.freeze({ root: lifecycleRoot, sourceRoot, privateRoot,
    release: releasePath, nonce: resolve(lifecycleRoot, "invocation.nonce"),
    envelope: resolve(privateRoot, "result.json"),
    sourceClosure: Object.freeze({ source_commit: "ab".repeat(20),
      source_closure_sha256: "cd".repeat(32) }),
    launcher: Object.freeze({ path: resolve(sourceRoot,
      ".m6-authority/static-execve-env6"),
    identity: M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY }),
  });
  let started = null; let removed = false;
  await assert.rejects(() => executeSelectedImageNegativeSystemd({
    artifactRoot: "/synthetic/artifacts", output,
  }, {
    stageSource: async () => stage,
    pinStaged: async () => Object.freeze({ synthetic: true }),
    pinnedSourceRoot: () => sourceRoot,
    pinnedFile: () => ({ bytes: releaseBytes }),
    validateClosure: async () => stage.sourceClosure,
    pinnedAuthority: () => Object.freeze({}),
    buildAuthority: async () => syntheticAuthority(stage),
    verifyPinned: async () => undefined,
    closePinned: async () => undefined,
    startUnit: async commandValue => {
      started = commandValue; return commandValue.unit;
    },
    waitUnit: async () => undefined,
    captureUnit: async () => {
      const shown = syntheticSelectedSystemdShow(
        syntheticAuthority(stage).output_path, privateRoot);
      return { code: 0, signal: null, failure: null, stderr: Buffer.alloc(0),
        stdout: Buffer.from(Object.entries(shown).map(([key, value]) =>
          `${key}=${value}`).join("\n") + "\n") };
    },
    readRun: async () => ({ value: syntheticSelectedRun(stage, release,
      selected, started.effectiveEnvironment) }),
    verifyLauncher: async () => undefined,
    stopUnit: async () => undefined,
    removeStage: async value => {
      removed = true; await rm(value, { recursive: true });
    },
  }), error => error?.code === "EEXIST",
  "an occupied success receipt fails after cleanup without dereferencing null stage");
  assert.equal(removed, true);
  await assert.rejects(lstat(lifecycleRoot), error => error?.code === "ENOENT");
  assert.equal(await readFile(output, "utf8"), "occupied",
    "success publication remains no-replace");
  const failure = JSON.parse(await readFile(`${output}.failure.json`, "utf8"));
  assert.equal(failure.reason, "selected-image-negative-systemd-failed");
  await rm(output); await rm(`${output}.failure.json`);
}

{
  const protectedStage = await mkdtemp(resolve(tmpdir(), "cadr-m6-selected-image-cleanup-"));
  await mkdir(resolve(protectedStage, "private"), { mode: 0o700 });
  await writeFile(resolve(protectedStage, "private", "receipt"), "x", { mode: 0o400 });
  await removeSelectedImageNegativeStage(protectedStage);
  await assert.rejects(lstat(protectedStage), error => error?.code === "ENOENT");
}

for (const script of ["scripts/run-cadr-m6-selected-image-negative.mjs",
  "scripts/cadr-m6-selected-image-negative-evidence.mjs"]) {
  const source = await readFile(resolve(process.cwd(), script), "utf8");
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(executable, /node:worker_threads|new\s+Worker|WebAssembly\s*\.|cadr-worker|cadr-m6-headless-boot|make\s*\(/,
    `${script} has no worker, Wasm-build, or guest execution capability`);
}

console.log("cadr M6 selected-image negative gate tests passed");
