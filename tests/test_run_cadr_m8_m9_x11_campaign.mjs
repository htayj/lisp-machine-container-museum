import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { chmod, lstat, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDistinctDirectVariants,
  browserAll100Evidence,
  classifyNativeCandidates,
  sourceReachability,
  validateFilesystemPermit,
  witnessRecords,
  writeX11FailureManifest,
} from "../scripts/run-cadr-m8-m9-x11-campaign.mjs";
import { CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
  authorityBuildSourceClosure, canonicalAuthorityBuildReceiptBytes, openNativeFilesystemPermit,
  deriveCadrM8M9DeactivationProducer } from
  "../scripts/run-cadr-m8-m9-input-conformance.mjs";
import {
  CADR_M8_M9_DIRECT_AUTHORITIES,
  captureCadrM8M9WorkerClosure,
  collectCadrM8M9ProvenanceJoin,
  collectCadrM8M9StaticImportClosure,
} from "../scripts/cadr-m8-m9-provenance-join.mjs";
import { createHash } from "node:crypto";
import { buildCadrM8M9Campaign, serializeCadrM8M9NativeScript } from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";
import { CADR_M6_DEVID_POLICY_ID, CADR_M6_DEVID_PROFILE,
  CADR_M6_READY4_CONTRACT, appendM6FastCheckpoint, appendM6FastHostWait,
  canonicalM6ReadyWitness,
  canonicalM6ReadyWitnessV4 } from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import { materializeSyntheticM6Producer } from "./fixtures/cadr-m8-m9-synthetic-m6-producer.mjs";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/run-cadr-m8-m9-x11-campaign.mjs");
/* This test has both self-contained helper assertions and a deliberately
 * provisioned integration subtest.  The latter needs the public source trees,
 * the CADR-WEB-303 selected artifacts, and the two generated M9 modules; a
 * fresh clone is not implicitly equipped with those local preservation inputs. */
const provisionedIntegrationRequirements = Object.freeze([
  Object.freeze({ path: "l/usim", kind: "directory" }),
  Object.freeze({ path: "l/chaos", kind: "directory" }),
  Object.freeze({ path: "l/sys/ubin/promh.mcr", kind: "file" }),
  Object.freeze({ path: "l/sys/ubin/promh.sym", kind: "file" }),
  Object.freeze({ path: "l/sys/ubin/ucadr.sym", kind: "file" }),
  Object.freeze({ path: "l/usim/disk-sys-303-0.img", kind: "file" }),
  Object.freeze({ path: "cadr-web/build/cadr-web-m9-devid-O0.wasm", kind: "file" }),
  Object.freeze({ path: "cadr-web/build/cadr-web-m9-devid-O2.wasm", kind: "file" }),
]);

async function provisionedM8M9Prerequisites(rootPath) {
  const missing = [];
  for (const requirement of provisionedIntegrationRequirements) {
    try {
      const entry = await lstat(resolve(rootPath, requirement.path));
      const valid = requirement.kind === "directory" ? entry.isDirectory() : entry.isFile();
      if (!valid) missing.push({ ...requirement, observed: "wrong-kind-or-symlink" });
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      missing.push({ ...requirement, observed: "absent" });
    }
  }
  return missing.length === 0
    ? { disposition: "ready", requirements: provisionedIntegrationRequirements }
    : { disposition: "skipped-missing-provisioned-inputs", requirements: provisionedIntegrationRequirements, missing };
}

const result = spawnSync("node", [script], { cwd: root, encoding: "utf8" });
assert.equal(result.status, 2, result.stderr);
const plan = JSON.parse(result.stdout);
assert.equal(plan.physical_descriptor_count, 100);
assert.equal(plan.path, "XTEST->X11->Cadet->kbd_event/mouse_event->CDRM8N1");

const missing = resolve(root, `build/cadr-oracle/m8-m9-x11-test-missing-${process.pid}`);
mkdirSync(missing, { recursive: true, mode: 0o700 });
const stateRoot = resolve(root, "build/cadr-computer-use");
const before = (() => { try { return readdirSync(stateRoot).sort(); } catch { return []; } })();
try {
  const execute = spawnSync("node", [script, "--execute", "--prepared", missing,
    "--browser-manifest", resolve(missing, "missing-browser-manifest.json")],
  { cwd: root, encoding: "utf8" });
  assert.notEqual(execute.status, 0);
  assert.match(execute.stderr, /superseded/);
  const after = (() => { try { return readdirSync(stateRoot).sort(); } catch { return []; } })();
  assert.deepEqual(after, before, "failed execute preflight must not start a harness session");
} finally {
  rmSync(missing, { recursive: true, force: true });
}

const source = await import("node:fs/promises").then(fs => fs.readFile(script, "utf8"));
assert.match(source, /not-applicable-native-source-unmapped/);
assert.doesNotMatch(source, /candidates\[0\] \?\? xkey/);
assert.match(source, /settledWitnessCount/);
assert.match(source, /m8-m9-x11-failure-v1/);
assert.match(source,
  /process\.getuid[\s\S]*process\.geteuid[\s\S]*uids\.has\(Number\(component\.uid\)\)/,
  "result verification rejects both real- and effective-UID-owned authority ancestry");

const prepared = resolve(root, `build/cadr-oracle/m8-m9-x11-prepared-test-${process.pid}`);
const preparedRelative = relative(root, prepared).split("\\").join("/");
const nativeOracle = resolve(root, "scripts/cadr-m8-m9-native-input-oracle.py");
try {
  const fixture = resolve(root, `build/cadr-oracle/m8-m9-x11-helper-test-${process.pid}`);
  try {
    const usim = resolve(fixture, "source/usim");
  await mkdir(usim, { recursive: true, mode: 0o700 });
  await writeFile(resolve(usim, "lmch.defs"), "X(return, 0215)\nX(cr, 0215)\n");
  await writeFile(resolve(usim, "kbd.c"), "kbd_map[XK_Return] = LMCH_cr;\n");
  await writeFile(resolve(usim, "cadet.defs"), "X(return, 0136, CADET_IX_UNSHIFT)\n");
  await writeFile(resolve(usim, "x11.c"),
    "mouse_event(e.xbutton.x, e.xbutton.y, e.xbutton.button);\n");
  await writeFile(resolve(usim, "mouse.c"),
    "if (buttons == 1)\n mouse_tail ^= 1;\nif (buttons == 2)\n mouse_middle ^= 1;\nif (buttons == 3)\n mouse_head ^= 1;\n");
  const reachability = await sourceReachability(fixture);
  assert.deepEqual(reachability.scanToX.get(0o136), ["Return"],
    "numeric LMCH aliases must join cr to return");
  assert.equal(classifyNativeCandidates(["colon"],
    new Map([["colon", [{ keycode: 47, column: 1 }]]])).disposition,
  "native-modifier-chord-not-exercised");
  assert.equal(classifyNativeCandidates([], new Map()).disposition,
    "not-applicable-native-source-unmapped");
  assert.equal(classifyNativeCandidates(["Return"],
    new Map([["Return", [{ keycode: 36, column: 0 }]]])).disposition, "direct");

  const witness = Buffer.alloc(128);
  for (let ordinal = 0; ordinal < 2; ordinal += 1) {
    const at = ordinal * 64; witness.set(Buffer.from("CDRM8N1"), at);
    witness.writeUInt32LE(1, at + 8); witness.writeUInt32LE(64, at + 12);
    witness.writeUInt32LE(1, at + 16); witness.writeUInt32LE(
      ordinal === 0 ? 0o136 : 0x8000, at + 36);
    witness.writeUInt32LE(ordinal === 0 ? 1 : 2, at + 40);
    witness.writeUInt32LE(ordinal, at + 52);
  }
  const witnessPath = resolve(fixture, "valid.cdrm8n1");
  await writeFile(witnessPath, witness);
  assert.equal((await witnessRecords(witnessPath, 0, 2)).length, 2);
  witness[56] = 1; await writeFile(resolve(fixture, "invalid.cdrm8n1"), witness);
  await assert.rejects(witnessRecords(resolve(fixture, "invalid.cdrm8n1"), 0, 2),
    /invalid framing/);

  const failure = resolve(fixture, "failure.json");
  await writeX11FailureManifest(failure, { error: "synthetic divergence" });
  assert.equal(JSON.parse(await readFile(failure)).outcome, "nonconforming");
  await assert.rejects(writeX11FailureManifest(failure, { error: "replacement" }),
    /EEXIST/);

  const paired = resolve(fixture, `m8-cw2-${"1".repeat(32)}`);
  const digest = value => createHash("sha256").update(value).digest("hex");
  const canonicalJson = value => Array.isArray(value) ?
    `[${value.map(canonicalJson).join(",")}]` :
    value !== null && typeof value === "object" ?
      `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}` :
      JSON.stringify(value);
  async function privateDirectory(path) {
    await mkdir(path, { recursive: true, mode: 0o700 }); await chmod(path, 0o700);
  }
  async function privateFile(path, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    await writeFile(path, bytes, { mode: 0o600 }); await chmod(path, 0o600);
    return bytes;
  }
  const localReceipt = (path, bytes) => ({ path, bytes: bytes.byteLength, sha256: digest(bytes) });

  /* The receipt verifier must consume the exact seven-key schema emitted by
   * the descriptor-owning producer, including variable prepared-file and
   * Guix-runtime mount groups.  Its compact fake descriptors avoid granting
   * this public test access to the host filesystem. */
  const preparedRoot = "/permit/prepared";
  const preparedPaths = ["source/usim/usim", "source/usim/usim-m8-m9-direct",
    "source/usim/usim-m8-m9-x11-witness"];
  const preparedFiles = preparedPaths.map((path, index) => ({ path,
    destination: `${preparedRoot}/${path}`, executable: true, bytes: index + 1,
    sha256: String.fromCharCode(97 + index).repeat(64), device: "1",
    inode: String(index + 10) }));
  const preparedReceipt = { schema: "cadr-m8-m9-prepared-file-closure-v1",
    root: preparedRoot, executable_paths: preparedPaths, files: preparedFiles,
    file_count: preparedFiles.length,
    sha256: digest(Buffer.from(`${canonicalJson({ files: preparedFiles })}\n`)) };
  const storePaths = [
    `/gnu/store/${"a".repeat(32)}-python`,
    `/gnu/store/${"b".repeat(32)}-python-runtime`,
  ];
  const runtimeStore = { schema: "cadr-m8-m9-guix-runtime-closure-v1",
    seed: storePaths[0], paths: storePaths,
    sha256: digest(Buffer.from(`${canonicalJson({ seed: storePaths[0], paths: storePaths })}\n`)) };
  let nextPermitFd = 50;
  const descriptorEntry = (destination, { directory = false, writable = false,
    role = undefined, identity = undefined } = {}) => {
    const fd = nextPermitFd += 1;
    return Object.freeze({ fd, destination, directory, writable, role,
      identity: identity ?? (directory ? { device: "1", inode: String(fd) } :
        { bytes: 1, sha256: "f".repeat(64), device: "1", inode: String(fd) }),
      descriptors: Object.freeze([fd]) });
  };
  const producerPermit = openNativeFilesystemPermit({
    prepared: preparedRoot, nativeConfig: "/permit/native.ini", output: "/permit/output",
    inputScript: "/permit/input-script", campaign: "/permit/campaign",
    runtimeStore,
  }, {
    openEntry: (path, options) => descriptorEntry(path, options),
    openPreparedClosure: () => Object.freeze({
      entries: Object.freeze(preparedFiles.map(file => descriptorEntry(file.destination, {
        role: `prepared-file:${file.path}`, identity: {
          bytes: file.bytes, sha256: file.sha256, device: file.device, inode: file.inode,
        },
      }))),
      receipt: preparedReceipt,
    }),
    openStoreEntries: () => Object.freeze(storePaths.map((path, index) => descriptorEntry(path, {
      directory: true, role: `guix-runtime-store:${path.slice("/gnu/store/".length)}`,
      identity: { device: "1", inode: String(index + 30) },
    }))),
    readFileSyncImpl: () => Buffer.from([
      "[ucode]", "prommcr_filename=/permit/prom.mcr", "promsym_filename=/permit/prom.sym",
      "mcrsym_filename=/permit/mcr.sym", "[chaos]", "hosts=/permit/hosts",
      "[disk]", "disk0=0,/permit/disk.img",
    ].join("\n")),
    closeSyncImpl: () => {},
  });
  assert.equal(Object.keys(producerPermit.summary).length, 7,
    "actual producer summary uses the seven-key native permit schema");
  assert.strictEqual(validateFilesystemPermit(producerPermit.summary), producerPermit.summary,
    "the X11 verifier accepts an unmodified producer receipt with dynamic mount groups");
  const reorderedProducerPermit = structuredClone(producerPermit.summary);
  [reorderedProducerPermit.mounts[1], reorderedProducerPermit.mounts[2]] =
    [reorderedProducerPermit.mounts[2], reorderedProducerPermit.mounts[1]];
  assert.throws(() => validateFilesystemPermit(reorderedProducerPermit),
    /dynamic closure group|noncanonical/,
    "the verifier rejects a reordered prepared-file group rather than accepting a role set");

  await privateDirectory(paired); await privateDirectory(resolve(paired, "native"));
  await privateDirectory(resolve(paired, "portable"));
  const malformedPayload = Buffer.alloc(208 * 40, 7);
  const malformedPath = resolve(paired, "manifest.json");
  await privateFile(malformedPath, { outcome: "worker-core-payloads-identical-to-expected" });
  await assert.rejects(browserAll100Evidence(malformedPath, {}, "O0"),
    /unexpected shape/,
    "the formerly accepted internally consistent 208-record fixture now fails before provenance use");
  await rm(paired, { recursive: true, force: true });

  const missingPrerequisites = await provisionedM8M9Prerequisites(resolve(fixture, "unprovisioned-root"));
  assert.equal(missingPrerequisites.disposition, "skipped-missing-provisioned-inputs");
  assert.deepEqual(missingPrerequisites.missing.map(item => item.path),
    provisionedIntegrationRequirements.map(item => item.path),
    "a missing local preservation input skips only the provisioned integration");

  const runProvisionedM8M9ProvenanceIntegration = async () => {
    for (const [operation, argument] of [["prepare", "--output"], ["build", "--prepared"]]) {
      const preparedResult = spawnSync("python3", [nativeOracle, operation, argument, preparedRelative],
        { cwd: root, encoding: "utf8", timeout: 120_000, killSignal: "SIGKILL" });
      assert.equal(preparedResult.status, 0,
        `${operation} must create the isolated M8/M9 native closure: ${preparedResult.stderr}${preparedResult.stdout}`);
      assert.equal(JSON.parse(preparedResult.stdout).status, "ok");
    }
    const join = await collectCadrM8M9ProvenanceJoin({ prepared: preparedRelative });
  /* Acceptance uses a complete raw M6 producer shape, not a skeletal stream.
   * The materializer expands only the tracked public release record; it never
   * opens an ignored native capture. */
  const publicReleasePath = resolve(root, "cadr-web/oracle/cadr-m6-release-record.json");
  const publicRelease = JSON.parse(await readFile(publicReleasePath, "utf8"));
  assert.equal(publicRelease.schedule.sha256, join.selected_inputs.release.schedule.sha256,
    "synthetic producer starts from the selected tracked release schedule");
  const testSource = await readFile(fileURLToPath(import.meta.url), "utf8");
  const materializerSource = await readFile(resolve(root, "tests/fixtures/cadr-m8-m9-synthetic-m6-producer.mjs"), "utf8");
  const forbiddenCaptureDirectory = ["m6", "captures"].join("-");
  const forbiddenCaptureName = ["abi", "capture", "1"].join("-");
  const forbiddenBuildRoot = ["build", "cadr-oracle"].join("/");
  assert.equal(testSource.includes(forbiddenCaptureDirectory) || testSource.includes(forbiddenCaptureName), false,
    "the public test must not name an ignored producer fixture");
  assert.equal(materializerSource.includes(forbiddenBuildRoot) ||
    materializerSource.includes(forbiddenCaptureDirectory) || materializerSource.includes("abi-capture") ||
    materializerSource.includes("node:fs") || materializerSource.includes("readFile"), false,
  "the synthetic materializer has no filesystem authority to read an ignored capture");
  const worker = join.source_closure.files.find(item => item.path === "cadr-web/wasm/cadr-worker.js");
  assert.ok(worker, "provenance source closure includes the exact worker");
  const workerImports = join.source_closure.static_imports.find(item =>
    item.path === "cadr-web/wasm/cadr-worker.js")?.imports ?? [];
  for (const path of ["cadr-web/wasm/cadr-m5-batch.mjs", "cadr-web/wasm/cadr-display-renderer.mjs",
    "cadr-web/wasm/cadr-m11-audio.mjs", "cadr-web/wasm/cadr-m12-debugger.mjs"]) {
    assert.ok(workerImports.includes(path), `worker import closure omits ${path}`);
  }
  assert.ok(join.source_closure.files.some(item => item.path === "cadr-web/wasm/cadr-m4-block-service.mjs"),
    "M6 replay closure includes the M4 block service");
  const importFixture = resolve(fixture, "static-import-closure");
  await mkdir(importFixture, { recursive: true });
  const importA = resolve(importFixture, "a.mjs"); const importB = resolve(importFixture, "b.mjs");
  const importC = resolve(importFixture, "c.mjs");
  await writeFile(importA, 'import "./b.mjs";\n'); await writeFile(importB, 'export * from "./c.mjs";\n');
  await writeFile(importC, "export const marker = 1;\n");
  const firstImportClosure = await collectCadrM8M9StaticImportClosure({ roots: [importA] });
  await writeFile(importC, "export const marker = 2;\n");
  const driftedImportClosure = await collectCadrM8M9StaticImportClosure({ roots: [importA] });
  const cPath = relative(root, importC).split("\\").join("/");
  assert.notEqual(firstImportClosure.files.find(item => item.path === cPath).sha256,
    driftedImportClosure.files.find(item => item.path === cPath).sha256,
  "transitively imported byte drift changes the static closure");
  await writeFile(importC, 'const path = "./missing.mjs"; import(path);\n');
  await assert.rejects(collectCadrM8M9StaticImportClosure({ roots: [importA] }),
    /computed dynamic import/,
    "a computed import cannot silently escape the static provenance closure");

  async function ready4Fixture() {
    const digestBytes = value => new Uint8Array(Buffer.from(value, "hex"));
    const digestReceipt = value => ({ bytes: 32, sha256: value });
    const artifacts = join.selected_inputs.release.artifacts;
    const profile = new TextEncoder().encode(join.selected_inputs.profile.id);
    const artifactBytes = new Uint8Array(12 + profile.byteLength + artifacts.length * 44);
    artifactBytes.set(new TextEncoder().encode("CDRM6AR1"), 0);
    const artifactView = new DataView(artifactBytes.buffer);
    artifactView.setUint32(8, profile.byteLength, true); artifactBytes.set(profile, 12);
    let artifactOffset = 12 + profile.byteLength;
    for (const artifact of artifacts) {
      artifactView.setUint32(artifactOffset, artifact.kind, true);
      artifactView.setBigUint64(artifactOffset + 4, BigInt(artifact.byte_count), true);
      artifactBytes.set(digestBytes(artifact.sha256), artifactOffset + 12);
      artifactOffset += 44;
    }
    const artifactSet = digest(artifactBytes);
    const base = artifacts.find(item => item.kind === 3).sha256;
    const state = "c".repeat(64); const queue = "d".repeat(64);
    const fastRecord = ({ reason, terminalStatus, requested, completed, pre, post,
      outstanding = 0n }) => {
      const bytes = new Uint8Array(128); const recordView = new DataView(bytes.buffer);
      bytes.set(new TextEncoder().encode("CDRM6FAST1"));
      recordView.setUint32(16, 1, true); recordView.setUint32(20, 128, true);
      recordView.setUint32(24, reason, true); recordView.setUint32(28, terminalStatus, true);
      recordView.setUint32(32, requested, true); recordView.setBigUint64(40, completed, true);
      recordView.setBigUint64(48, completed, true); recordView.setBigUint64(56, pre, true);
      recordView.setBigUint64(64, post, true); recordView.setUint32(88, 0, true);
      recordView.setUint32(92, 2, true); recordView.setBigUint64(96, outstanding, true);
      return bytes;
    };
    const checkpointFast = fastRecord({ reason: 1, terminalStatus: 0, requested: 64,
      completed: 64n, pre: 983990214n, post: 983990278n });
    const hostWaitFast = fastRecord({ reason: 3, terminalStatus: 8, requested: 1024,
      completed: 1n, pre: 100n, post: 101n, outstanding: 1n });
    let checkpointBytes = digestBytes(digest(Buffer.from("CDRM6FASTCHAIN1\0")));
    checkpointBytes = await appendM6FastCheckpoint(checkpointBytes, 0, checkpointFast,
      digestBytes(state), digestBytes(queue));
    const checkpoint = Buffer.from(checkpointBytes).toString("hex");
    let hostWaitBytes = digestBytes(digest(Buffer.from("CDRM6FASTHOSTWAIT1\0")));
    hostWaitBytes = await appendM6FastHostWait(hostWaitBytes, 0, hostWaitFast);
    const hostWait = Buffer.from(hostWaitBytes).toString("hex");
    const hostTranscript = new Uint8Array(64 + 2 * 256);
    hostTranscript.set(new TextEncoder().encode("CDRM6HS1"));
    const hostHeader = new DataView(hostTranscript.buffer);
    hostHeader.setUint32(8, 1, true); hostHeader.setUint32(12, 64, true);
    hostHeader.setUint32(16, 256, true); hostHeader.setUint32(20, 2, true);
    hostTranscript.set(digestBytes(artifactSet), 24);
    const empty = digestBytes(digest(Buffer.alloc(0)));
    const descriptor = digestBytes(digest(Buffer.alloc(16, 0x12)));
    const completion = digestBytes(digest(Buffer.alloc(1024, 0x34)));
    for (let index = 0; index < 2; index += 1) {
      const offset = 64 + index * 256;
      const hostView = new DataView(hostTranscript.buffer, offset, 256);
      hostView.setBigUint64(0, BigInt(index), true); hostView.setUint32(8, index + 1, true);
      hostView.setUint32(12, 1, true); hostView.setBigUint64(16, 101n, true);
      hostView.setBigUint64(24, 101n, true); hostView.setBigUint64(32, 1n, true);
      hostView.setBigUint64(40, 1n, true); hostView.setUint32(48, 0, true);
      hostView.setUint32(52, 1, true); hostView.setBigUint64(56, 16n, true);
      hostView.setBigUint64(64, 0n, true); hostView.setBigUint64(72, 1024n, true);
      hostView.setBigUint64(80, 0n, true); hostView.setUint32(88, 1024, true);
      hostTranscript.set(descriptor, offset + 104); hostTranscript.set(empty, offset + 136);
      hostTranscript.set(index === 0 ? empty : completion, offset + 168);
    }
    const host = digest(hostTranscript);
    const summary = new Uint8Array(512); const view = new DataView(summary.buffer);
    summary.set(new TextEncoder().encode("CDRM6E1"));
    view.setUint32(8, 1, true); view.setUint32(12, 512, true);
    view.setUint32(16, 1, true); view.setUint32(20, 1, true);
    view.setUint32(24, 512, true); view.setUint32(28, 512, true);
    view.setBigUint64(32, 0x7fffffffffffffffn, true);
    view.setBigUint64(40, 513n, true); view.setBigUint64(48, 1n, true);
    view.setBigUint64(56, 512n, true); view.setBigUint64(88, 513n, true);
    summary.fill(0x55, 240, 272); summary.fill(0x11, 272, 304);
    const summaryHash = digest(summary);
    const ready3 = await canonicalM6ReadyWitness({ releaseRecord: publicRelease,
      artifactSetSha256: digestBytes(artifactSet), privateDiskBaseSha256: digestBytes(base),
      formABoundary: 328623243n, formBBoundary: 980313535n,
      listenerIdleCBoundary: 982990214n, listenerIdleSettledBoundary: 983990214n,
      readyBoundary: 983990278n, cdrstate5Sha256: digestBytes(state),
      cdrm5q1Sha256: digestBytes(queue), hostTranscriptSha256: digestBytes(host) });
    const ready4 = await canonicalM6ReadyWitnessV4({ ready3Witness: ready3,
      target: CADR_M6_DEVID_PROFILE, policyId: CADR_M6_DEVID_POLICY_ID,
      selectedMaximum: 0x7fffffffffffffffn, cdrm6e1Sha256: digestBytes(summaryHash),
      checkpointCount: 1, checkpointChainSha256: checkpointBytes,
      hostWaitCount: 1, hostWaitChainSha256: hostWaitBytes });
    const summaryReceipt = () => ({ bytes: 512, sha256: summaryHash,
      hex: Buffer.from(summary).toString("hex"), selected_maximum: "9223372036854775807",
      total_accepted: "513", tail_event_count: "1" });
    return { schema: "cadr-m8-m9-ready4-evidence-v1", outcome: "ready4",
      target: CADR_M6_DEVID_PROFILE, contract: CADR_M6_READY4_CONTRACT,
      boundary: "983990278", quiescent: true,
      release_record: { path: join.selected_inputs.release.path,
        bytes: join.selected_inputs.release.bytes, sha256: join.selected_inputs.release.sha256 },
      run_evidence: { session_id: `m6-ready4-session-${"3".repeat(32)}`,
        private_disk_instance_id: `m6-ready4-private-disk-${"4".repeat(32)}`,
        private_disk_base: digestReceipt(base) },
      machine_info: { lifecycle: 2, artifact_mask: 31, boundary: "983990278",
        microinstructions: "983990278", generation: "1", next_request_id: "1",
        outstanding_request_id: "0", last_completed_request_id: "0",
        persistent_status: 0, profile: 1 },
      quiescence: { scheduler_lifecycle: "PAUSED", run_active: false,
        deferred_control_count: 0, pending_boundary_digest: false, media_busy: false,
        media_snapshot_blocked: false, visibility_initialized: true, hidden: false,
        block_service_pending: false, host_next_request_status: 9 },
      ready3_witness: digestReceipt(Buffer.from(ready3).toString("hex")),
      ready4_witness: digestReceipt(Buffer.from(ready4).toString("hex")),
      cdrm6e1: summaryReceipt(), checkpoint_chain: { count: 1, bytes: 32, sha256: checkpoint,
        records: [{ fast_run: { bytes: 128, sha256: digest(checkpointFast),
          hex: Buffer.from(checkpointFast).toString("hex") },
        cdrstate5: digestReceipt(state), cdrm5q1: digestReceipt(queue) }] },
      host_wait_chain: { count: 1, bytes: 32, sha256: hostWait,
        records: [{ bytes: 128, sha256: digest(hostWaitFast),
          hex: Buffer.from(hostWaitFast).toString("hex") }] },
      cdrstate5: digestReceipt(state), cdrm5q1: digestReceipt(queue),
      artifact_set: digestReceipt(artifactSet), host_transcript: {
        bytes: hostTranscript.byteLength, sha256: host, hex: Buffer.from(hostTranscript).toString("hex") },
      post_208_summary: { outcome: "limit-not-exceeded", after_input_ordinal: 208,
        cdrm6e1: summaryReceipt() } };
  }

  async function makeDirectFixture(rootPath, variant, suffix) {
    await privateDirectory(rootPath); await privateDirectory(resolve(rootPath, "native"));
    await privateDirectory(resolve(rootPath, "portable"));
    const nativeSession = `native-${suffix}`; const portableSession = `portable-${suffix}`;
    const diskId = `disk-${suffix}`; const sessionId = `m8-cw2-${suffix}`;
    assert.equal(resolve(rootPath).split("/").at(-1), sessionId,
      "fixture root is the exact fresh outer-session identifier");
    const capturedWorker = await captureCadrM8M9WorkerClosure();
    const workerClosure = { schema: capturedWorker.schema, root: capturedWorker.root,
      file_count: capturedWorker.file_count, sha256: capturedWorker.sha256,
      files: capturedWorker.files, static_imports: capturedWorker.static_imports,
      execution: "descriptor-captured-in-memory-vm-module-graph-v1" };
    const frozenCampaign = buildCadrM8M9Campaign();
    const inputScript = Buffer.from(serializeCadrM8M9NativeScript(frozenCampaign));
    const browserCampaign = buildCadrM8M9Campaign({ generation: 1n });
    const wire = Buffer.alloc(208 * 40);
    for (const [index, record] of browserCampaign.records.entries()) {
      wire.set(record.bytes, index * 40);
    }
    const nativeWire = Buffer.alloc(207 * 64);
    for (const [index, row] of frozenCampaign.nativeRows.entries()) {
      const at = index * 64; nativeWire.write("CDRM8N1", at, "ascii"); nativeWire.writeUInt32LE(1, at + 8);
      nativeWire.writeUInt32LE(64, at + 12); nativeWire.writeUInt32LE(row.type === "keyboard" ? 1 : 2, at + 16);
      nativeWire.writeBigUInt64LE(row.boundary, at + 24);
      const fields = row.type === "keyboard" ? [row.first, row.second, 0, 0] :
        [row.third, 0, row.first, row.second];
      fields.forEach((value, field) => nativeWire.writeUInt32LE(value, at + 36 + field * 4));
      nativeWire.writeUInt32LE(index, at + 52);
    }
    const scriptBytes = await privateFile(resolve(rootPath, "input-script.txt"), inputScript);
    const campaignValue = { schema: "cadr-m8-m9-input-campaign-v1", key_count: 100,
      native_row_count: 207, browser_record_count: 208, input_script_sha256: digest(scriptBytes) };
    const campaignBytes = await privateFile(resolve(rootPath, "campaign.json"), campaignValue);
    const expectedBytes = await privateFile(resolve(rootPath, "portable/expected-input.cdrinp1"), wire);
    const observedBytes = await privateFile(resolve(rootPath, "portable/observed-input.cdrinp1"), wire);
    const stateJson = value => ({ csr: value.csr, scancode: value.scancode, mouse_x: value.mouseX,
      mouse_y: value.mouseY, input_sequence: value.inputSequence, keyboard_fifo_count: value.keyboardFifoCount,
      ingress_ordinal: String(value.ingressOrdinal), generation: String(value.generation), lifecycle: 2 });
    const applyRecord = (prior, record) => {
      const next = { ...prior, inputSequence: prior.inputSequence + 1, ingressOrdinal: record.ordinal };
      if (record.kind === 1) {
        if ((prior.csr & (1 << 5)) === 0) { next.scancode = (0x10000 | record.payload) >>> 0; next.csr = prior.csr | (1 << 5); }
        else next.keyboardFifoCount = prior.keyboardFifoCount + 1;
      } else { next.mouseX = record.payload & 0x3ff; next.mouseY = ((record.payload >>> 10) & 0x3ff) | (((record.payload >>> 20) & 7) << 12); next.csr = prior.csr | (1 << 4); }
      return next;
    };
    let derived = { csr: 4, scancode: 0, mouseX: 0, mouseY: 0, inputSequence: 0,
      keyboardFifoCount: 0, ingressOrdinal: 0n, generation: 1n };
    const states = []; const consumption = [];
    for (const [index, record] of browserCampaign.records.entries()) {
      derived = applyRecord(derived, record); states.push(stateJson(derived));
      if (index < 200 && index % 2 === 1) {
        const initial = stateJson(derived); const down = browserCampaign.records[index - 1]; const up = record;
        const finalRuntime = { ...derived, csr: derived.csr & ~(1 << 5), keyboardFifoCount: 0 };
        const final = stateJson(finalRuntime); const allowed = [...new Set([initial.scancode,
          (0x10000 | down.payload) >>> 0, (0x10000 | up.payload) >>> 0])];
        consumption.push({ label: up.label, outcome: "keyboard-iob-quiescent", run_count: 1,
          scheduler_started: true, scheduler_paused: true, allowed_scancodes: allowed,
          allowed_mutations: ["csr keyboard-ready bit", "keyboard FIFO count", "scancode within the just-delivered down/all-up pair"],
          initial, final, runs: [{ attempt: 1, requested_clock_slots: 8192, status: 0,
            completed_slots: "1", microinstructions_executed: "1", state: final }] });
        derived = finalRuntime;
      }
    }
    const recordReceipts = browserCampaign.records.map((record, index) => ({ label: record.label,
      kind: record.kind, ordinal: String(index + 1), payload: record.payload,
      sha256: digest(wire.subarray(index * 40, index * 40 + 40)) }));
    const initialState = { csr: 4, scancode: 0, mouseX: 0, mouseY: 0, inputSequence: 0,
      keyboardFifoCount: 0, ingressOrdinal: 0n, generation: 1n };
    const expectedStatesValue = { schema: "cadr-m8-m9-expected-input-states-v1", before: stateJson(initialState),
      after: stateJson(derived), records: recordReceipts, states };
    const observedStatesValue = { schema: "cadr-m8-m9-observed-input-states-v1", before: stateJson(initialState),
      after: stateJson(derived), consumption_boundaries: consumption, states };
    const expectedStatesBytes = await privateFile(resolve(rootPath, "portable/expected-input-states.json"), expectedStatesValue);
    const observedStatesBytes = await privateFile(resolve(rootPath, "portable/observed-input-states.json"), observedStatesValue);
    const workerOperations = ["instantiate", "scheduler-state", "input-state"];
    for (const operation of browserCampaign.browserOperations) {
      workerOperations.push(operation.op, "input-state");
      if (operation.op === "keyboard-up") workerOperations.push("scheduler-start", "scheduler-run", "input-state", "scheduler-pause");
    }
    workerOperations.push("m6-disk-evidence-summary", "pointer-state", "keyboard-down", "pointer-down", "pointer-neutralize", "keyboard-state", "pointer-state", "input-state");
    const workerLogBytes = await privateFile(resolve(rootPath, "portable/worker.ndjson"), Buffer.from([
      JSON.stringify({ schema: "cadr-m8-m9-portable-session-v1", session_id: portableSession }),
      ...workerOperations.map((op, index) => JSON.stringify({ session_id: portableSession,
        id: index + 1, op, status: 0, lifecycle: "RUNNING" })), ""].join("\n")));
    const deactivationPlan = deriveCadrM8M9DeactivationProducer({ coreState: derived,
      pointerGeneration: 1 });
    assert.equal(deactivationPlan.keyboard_down[0].payload, 0x52,
      "KeyQ's deactivation payload comes from the frozen physical mapping");
    const cdrinpJson = record => {
      const bytes = Buffer.from(record.bytes);
      return { bytes: 40, sha256: digest(bytes), hex: bytes.toString("hex"), kind: record.kind,
        generation: record.generation.toString(), ordinal: record.ordinal.toString(), payload: record.payload };
    };
    let deactivationDerived = derived;
    const delivery = records => {
      const wireRecords = records.map(cdrinpJson);
      const coreObservations = records.map(record => {
        deactivationDerived = applyRecord(deactivationDerived, record);
        return stateJson(deactivationDerived);
      });
      return { wire_schema: "CDRINP1", records_delivered: records.length,
        first_ingress_ordinal: records[0].ordinal.toString(),
        last_ingress_ordinal: records.at(-1).ordinal.toString(),
        input_sequence: deactivationDerived.inputSequence, wire_records: wireRecords, core_observations: coreObservations };
    };
    const deactivationValue = { outcome: "held-key-and-pointer-cleared-after-core-delivery",
      keyboard_down: delivery(deactivationPlan.keyboard_down),
      pointer_down: delivery(deactivationPlan.pointer_down),
      neutralize: delivery(deactivationPlan.neutralize),
      deactivation: { heldKeysCleared: 1 }, coreAfter: stateJson(deactivationDerived) };
    const deactivationBytes = await privateFile(resolve(rootPath, "portable/shared-deactivation.json"), deactivationValue);
    const nativeScriptBytes = await privateFile(resolve(rootPath, "native/input-script.txt"), inputScript);
    const nativeCampaignBytes = await privateFile(resolve(rootPath, "native/campaign.json"), campaignValue);
    const nativeWitnessBytes = await privateFile(resolve(rootPath, "native/input.cdrm8n1"), nativeWire);
    const releaseSchedule = join.selected_inputs.release.schedule;
    const syntheticProducer = materializeSyntheticM6Producer({ release: publicRelease, sessionId: nativeSession });
    assert.equal(syntheticProducer.source, "tracked-public-release-record-synthetic-grammar");
    const captureBytes = await privateFile(resolve(rootPath, "native/capture.ndjson"), syntheticProducer.transcript);
    const idleBytes = await privateFile(resolve(rootPath, "native/idle.bin"), syntheticProducer.idle);
    const witness = { schema: "CDRM8N1", record_bytes: 64, record_count: 207, sha256: digest(nativeWitnessBytes) };
    const ancestry = paths => paths.map((reference, index) => ({
      reference, uid: "0", gid: "0", mode: index === paths.length - 1 ? "644" : "755",
      device: "1", inode: String(index + 1),
    }));
    const pythonExecutableAncestry = ancestry(
      ["/", "/usr", "/usr/bin", "/usr/bin/python3"]);
    pythonExecutableAncestry.at(-1).mode = "755";
    const stdlibAncestry = ancestry(
      ["/", "/usr", "/usr/lib", "/usr/lib/python"]);
    stdlibAncestry.at(-1).mode = "755";
    const stdlibFileAncestry = ancestry(
      ["/", "/usr", "/usr/lib", "/usr/lib/python", "/usr/lib/python/os.py"]);
    const authorityRoot =
      "/gnu/store/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-cadr-m8-m9-python-seal-authority";
    const authorityBootstrap = {
      bytes: 1, sha256: "9".repeat(64), device: "1", inode: "1",
    };
    const authorityLauncher = {
      bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1",
    };
    const authorityGuard = {
      bytes: 1, sha256: "b".repeat(64), device: "1", inode: "1",
    };
    const launcherElf = { elf_class: "ELF64", data: "little-endian",
      version: 1, osabi: 0, type: 2, machine: "x86-64", entry: "4096",
      program_header_types: [1], has_pt_interp: false,
      has_pt_dynamic: false };
    const guardElf = { elf_class: "ELF64", data: "little-endian",
      version: 1, osabi: 0, type: 3, machine: "x86-64", entry: "0",
      program_header_types: [1, 2], has_pt_interp: false,
      has_pt_dynamic: true };
    const guixAncestry = ancestry(["/", "/gnu", "/gnu/store",
      "/gnu/store/dddddddddddddddddddddddddddddddd-guix",
      "/gnu/store/dddddddddddddddddddddddddddddddd-guix/bin",
      "/gnu/store/dddddddddddddddddddddddddddddddd-guix/bin/guix"]);
    guixAncestry.at(-1).mode = "755";
    const authorityBuild = {
      schema: "cadr-m8-m9-python-authority-build-v1",
      yama_ptrace_scope: 3,
      guix_client: {
        path: "/gnu/store/dddddddddddddddddddddddddddddddd-guix/bin/guix",
        identity: { bytes: 1, sha256: "8".repeat(64),
          device: "1", inode: "1" },
        ancestry: guixAncestry,
      },
      build_environment: {
        CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
        CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
        CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
        LANG: "C", LC_ALL: "C", TZ: "UTC",
      },
      source_closure: authorityBuildSourceClosure(),
      derivation:
        "/gnu/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-authority.drv",
      output: authorityRoot,
      authority: {
        bootstrap: authorityBootstrap,
        launcher: { identity: authorityLauncher, elf: launcherElf },
        guard: { identity: authorityGuard, elf: guardElf },
      },
    };
    const authorityBuildBytes =
      canonicalAuthorityBuildReceiptBytes(authorityBuild);
    const authorityBuildReceipt = {
      schema: authorityBuild.schema,
      bytes: authorityBuildBytes.byteLength,
      sha256: digest(authorityBuildBytes),
      derivation: authorityBuild.derivation,
      output: authorityBuild.output,
      independent_selection: {
        derivation: authorityBuild.derivation,
        output: authorityBuild.output,
      },
      yama_ptrace_scope: authorityBuild.yama_ptrace_scope,
      build_environment: authorityBuild.build_environment,
      source_closure: authorityBuild.source_closure,
      guix_client: authorityBuild.guix_client,
      authority: authorityBuild.authority,
    };
    /* Keep the reciprocal browser fixture bound to the same actual producer
     * receipt exercised above; do not retain a hand-written obsolete shape. */
    const filesystemPermit = structuredClone(producerPermit.summary);
    const nativeMetadata = { schema: "cadr-m8-m9-native-input-capture-v1",
      target: "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9", session_id: nativeSession,
      private_disk_instance_id: diskId,
      source: { system_fossil: join.selected_inputs.profile.source_pins.sys.revision,
        usim_fossil: join.selected_inputs.profile.source_pins.usim.revision },
      m6_release_record: { path: join.selected_inputs.release.path, bytes: join.selected_inputs.release.bytes,
        sha256: join.selected_inputs.release.sha256 },
      patches: { m7_prepare_sha256: join.native_x11_closure.prepare_record.m7_prepare_sha256,
        m8_m9_sha256: join.native_x11_closure.patch.sha256,
        m8_m9_support: structuredClone(join.native_x11_closure.prepare_record.m8_m9_native_support) },
      prepared: { path: join.native_x11_closure.prepared_root,
        source_tree_sha256: join.native_x11_closure.prepared_source_tree_sha256,
        source_file_count: join.native_x11_closure.prepared_source_file_count,
        executable: structuredClone(join.native_x11_closure.build_record) },
      runtime_provenance: { python: { schema: "cadr-m8-m9-python-identity-v3",
          source_fd: 3, transport: "bwrap-ro-bind-fd",
          bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1",
          sys_executable: { reference: "sys-executable", bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1" },
          proc_self_exe: { reference: "proc-self-exe", bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1" },
          version: "synthetic", implementation: "cpython",
          executable_ancestry: pythonExecutableAncestry,
          prepython_seal: { dumpable: 0, no_new_privileges: 1,
            core_soft: 0, core_hard: 0,
            yama_ptrace_scope: 3,
            authority_build_receipt: authorityBuildReceipt,
            filesystem_permit: filesystemPermit,
            importer_isolation: {
              sys_path: ["/usr/lib/python"],
              meta_path: ["_frozen_importlib.BuiltinImporter",
                "_frozen_importlib.FrozenImporter",
                "_frozen_importlib_external.PathFinder"],
              path_hooks: [
                "_frozen_importlib_external.FileFinder.path_hook.<locals>.path_hook_for_FileFinder",
              ],
              approved_non_file_importers: [
                "_frozen_importlib.BuiltinImporter",
                "_frozen_importlib.FrozenImporter",
              ],
              archive_paths: [],
            },
            stdlib_roots: [{ path: "/usr/lib/python", ancestry: stdlibAncestry }],
            loader_files: [{ path: "/usr/lib/python/os.py",
              ancestry: stdlibFileAncestry,
              file: { bytes: 1, sha256: "c".repeat(64), uid: "0", gid: "0",
                mode: "644", device: "1", inode: "5" } }],
            bootstrap: authorityBootstrap,
            launcher: authorityLauncher,
            guard: authorityGuard } },
        program: { schema: "cadr-m8-m9-python-program-identity-v2",
          inherited_fd: 4,
          transport: "bwrap-ro-bind-data-from-one-shot-pipe",
          bytes: join.native_python_closure.files.find(item =>
            item.path === join.native_python_closure.root).bytes,
          sha256: join.native_python_closure.files.find(item =>
            item.path === join.native_python_closure.root).sha256,
          closure_sha256: join.native_python_closure.sha256 },
        rendered_config: { bytes: 1, sha256: "b".repeat(64) },
        private_executable: { sha256_at_start: join.native_x11_closure.direct_witness.sha256,
          sha256_at_exec: join.native_x11_closure.direct_witness.sha256,
          sha256_at_end: join.native_x11_closure.direct_witness.sha256 },
        child_argv: ["/private/usim", "-c", "/private/usim.ini"],
        child_environment: { LANG: "C", LC_ALL: "C", TZ: "UTC",
          CADR_M6_RAW_SCHEDULE: "/private/schedule.txt", CADR_M6_NATIVE_LOG: "/private/capture.ndjson",
          CADR_M6_IDLE_SAMPLES: "/private/idle.bin", CADR_M6_SESSION_ID: nativeSession,
          CADR_M8_M9_INPUT_SCRIPT: "/private/input-script.txt",
          CADR_M8_M9_INPUT_WITNESS: "/private/input.cdrm8n1" } },
      artifacts: structuredClone(join.selected_inputs.release.artifacts),
      native_inputs: structuredClone(join.selected_inputs.release.native_inputs),
      m6_schedule: { sha256: releaseSchedule.sha256, event_count: releaseSchedule.event_count,
        mapping_sha256: join.selected_inputs.release.identities.cadet_mapping_sha256 },
      campaign: { ...campaignValue, input_script_bytes: scriptBytes.byteLength, native_witness: witness },
      private_disk: { sha256_at_start: join.selected_inputs.release.artifacts.find(item => item.kind === 3).sha256,
        sha256_at_end: join.selected_inputs.release.artifacts.find(item => item.kind === 3).sha256 },
      process: { returncode: 0, timed_out: false, forced_stop: false, state_may_be_incomplete: false,
        pending_host_requests: 0 }, transcript: { sha256: digest(captureBytes), idle_samples_sha256: digest(idleBytes) } };
    const nativeMetadataBytes = await privateFile(resolve(rootPath, "native/metadata.json"), nativeMetadata);
    const comparisonValue = { schema: "cadr-m8-m9-input-comparison-v1",
      outcome: "worker-core-payloads-identical-to-expected", native: { record_count: 207, record_bytes: 64,
        sha256: witness.sha256 }, browser: { record_count: 208, record_bytes: 40,
        exact_worker_boundary_match: true, expected_sha256: digest(expectedBytes), observed_sha256: digest(observedBytes),
        generation: "1" }, common_campaign: { input_script_sha256: digest(scriptBytes), key_count: 100,
        native_row_count: 207, browser_record_count: 208 } };
    const comparisonBytes = await privateFile(resolve(rootPath, "comparison.json"), comparisonValue);
    const repoPath = relative(root, rootPath).split("\\").join("/");
    const nativeFiles = [["campaign.json", nativeCampaignBytes], ["capture.ndjson", captureBytes], ["idle.bin", idleBytes],
      ["input-script.txt", nativeScriptBytes], ["input.cdrm8n1", nativeWitnessBytes], ["metadata.json", nativeMetadataBytes]]
      .map(([name, bytes]) => localReceipt(`${repoPath}/native/${name}`, bytes));
    const directRunnerFiles = CADR_M8_M9_DIRECT_AUTHORITIES.map(path =>
      structuredClone(join.source_closure.files.find(item => item.path === path)));
    const manifest = { schema: "cadr-m8-m9-input-conformance-result-v3",
      target: "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9-DEVID-READY4-DIRECT-BOUNDARY-NON-CW2",
      outcome: "worker-core-payloads-identical-to-expected", runtime_execution_performed: true,
      source_binding: { schema: "cadr-m8-m9-direct-source-binding-v1",
        repository: structuredClone(join.repository), source_closure: structuredClone(join.source_closure),
        direct_runner: { revision: join.repository.candidate_commit, closure_dirty: false,
          dirty_policy: "exact file hashes and scoped status are retained; no clean-checkout claim",
          status_sha256: digest(Buffer.from("")), status: "", files: directRunnerFiles } },
      provenance_join_start: structuredClone(join), provenance_join_end: structuredClone(join), wasm_production: { schema: "cadr-m8-m9-wasm-production-v2", profile: "m9-devid",
        forced: true, argv: ["make", "-B", "-C", "cadr-web", "build/cadr-web-m9-devid-O0.wasm", "build/cadr-web-m9-devid-O2.wasm"],
        stdout_sha256: "d".repeat(64), stderr_sha256: "e".repeat(64),
        outputs: structuredClone(join.m9_devid_wasm) }, session: { id: sessionId, mode: "0700" },
      campaign: { script: { path: "input-script.txt", ...localReceipt("input-script.txt", scriptBytes) },
        manifest: { path: "campaign.json", ...localReceipt("campaign.json", campaignBytes) } },
      native: { session_id: nativeSession, private_disk_instance_id: diskId,
        python_closure: structuredClone(join.native_python_closure),
        oracle_process: { returncode: 0, signal: null,
          bootstrap_sha256: CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
          pipe_bundle_sha256: "7".repeat(64),
          launcher: { reference: "root-owned-bwrap", bytes: 1,
            sha256: "8".repeat(64), device: "1", inode: "1" },
          prepython_authority: {
            reference: "canonical-receipt-selected-guix-store-authority",
            root: authorityRoot,
            ancestry: [
              { reference: "/", uid: "0", gid: "0", mode: "755", device: "1", inode: "1" },
              { reference: "/gnu", uid: "0", gid: "0", mode: "755", device: "1", inode: "1" },
              { reference: "/gnu/store", uid: "944", gid: "954", mode: "1775", device: "1", inode: "2" },
              { reference: authorityRoot,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "3" },
              { reference: `${authorityRoot}/bin`,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "4" },
              { reference: `${authorityRoot}/bin/cadr-m8-m9-python-seal-launcher`,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "5" },
              { reference: `${authorityRoot}/lib`,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "6" },
              { reference: `${authorityRoot}/lib/cadr-m8-m9-prepython-guard.so`,
                uid: "944", gid: "954", mode: "444", device: "1", inode: "7" },
              { reference: `${authorityRoot}/share`,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "8" },
              { reference: `${authorityRoot}/share/cadr-m8-m9`,
                uid: "944", gid: "954", mode: "555", device: "1", inode: "9" },
              { reference: `${authorityRoot}/share/cadr-m8-m9/captured-python-bootstrap.py`,
                uid: "944", gid: "954", mode: "444", device: "1", inode: "10" },
            ],
            build_receipt: authorityBuildReceipt,
            yama_ptrace_scope: 3,
            filesystem_permit: filesystemPermit,
            bootstrap: authorityBootstrap,
            launcher: authorityLauncher,
            guard: authorityGuard } },
        witness, files: nativeFiles, metadata: nativeMetadata },
      portable: { session_id: portableSession, runtime: { node: "test", v8: "test",
          executable: { bytes: 1, sha256: "1".repeat(64) }, environment: { LANG: "C", LC_ALL: "C", TZ: "UTC" } },
        module: structuredClone(join.m9_devid_wasm[variant]),
        wasm_execution: { ...structuredClone(join.m9_devid_wasm[variant]), device: "1", inode: "1" },
        worker: structuredClone(worker),
        worker_closure: structuredClone(workerClosure),
        expected_cdrinp_file: { path: "portable/expected-input.cdrinp1", ...localReceipt("portable/expected-input.cdrinp1", expectedBytes) },
        observed_cdrinp_file: { path: "portable/observed-input.cdrinp1", ...localReceipt("portable/observed-input.cdrinp1", observedBytes) },
        expected_state_file: { path: "portable/expected-input-states.json", ...localReceipt("portable/expected-input-states.json", expectedStatesBytes) },
        observed_state_file: { path: "portable/observed-input-states.json", ...localReceipt("portable/observed-input-states.json", observedStatesBytes) },
        worker_log_file: { path: "portable/worker.ndjson", ...localReceipt("portable/worker.ndjson", workerLogBytes) },
        consumption_boundaries: consumption,
        shared_deactivation_file: { path: "portable/shared-deactivation.json", ...localReceipt("portable/shared-deactivation.json", deactivationBytes) },
        shared_deactivation: deactivationValue, termination: { pending_requests: 0, terminated: true },
        browser_state: { generation: "1", first_ingress_ordinal: "1", last_ingress_ordinal: "208",
          input_sequence_before: 0, input_sequence_after: 208 }, ready4: await ready4Fixture() },
      comparison: { path: "comparison.json", ...localReceipt("comparison.json", comparisonBytes) } };
    const manifestBytes = await privateFile(resolve(rootPath, "manifest.json"), manifest);
    return { manifestPath: resolve(rootPath, "manifest.json"), manifest, manifestBytes };
  }

  const validO0 = await makeDirectFixture(paired, "O0", "1".repeat(32));
  assert.equal((await browserAll100Evidence(validO0.manifestPath, join, "O0")).consumptionBoundaryCount, 100);
  const pairedO2 = resolve(fixture, `m8-cw2-${"2".repeat(32)}`);
  const validO2 = await makeDirectFixture(pairedO2, "O2", "2".repeat(32));
  assert.equal((await browserAll100Evidence(validO2.manifestPath, join, "O2")).variant, "O2");
  const evidenceO0 = await browserAll100Evidence(validO0.manifestPath, join, "O0");
  const evidenceO2 = await browserAll100Evidence(validO2.manifestPath, join, "O2");
  assertDistinctDirectVariants(evidenceO0, evidenceO2);
  for (const field of ["session_id", "session_root", "native_session_id", "portable_session_id",
    "private_disk_instance_id"]) {
    const reused = { ...evidenceO2, [field]: evidenceO0[field] };
    assert.throws(() => assertDistinctDirectVariants(evidenceO0, reused), new RegExp(`reuse ${field}`),
      `O0/O2 ${field} reuse must reject before an X11 session starts`);
  }
  for (let index = 0; index < validO0.manifest.source_binding.direct_runner.files.length; index += 1) {
    const omitted = structuredClone(validO0.manifest);
    omitted.source_binding.direct_runner.files.splice(index, 1);
    await privateFile(validO0.manifestPath, omitted);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /source receipt is incomplete|authorities/,
      `direct authority ${index} cannot be omitted`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  for (const [name, mutate] of [
    ["source end", manifest => { manifest.provenance_join_end.source_closure.files[0].sha256 = "0".repeat(64); }],
    ["prepared end", manifest => { manifest.provenance_join_end.native_x11_closure.build_marker.sha256 = "0".repeat(64); }],
    ["Python end", manifest => { manifest.provenance_join_end.native_python_closure.files[0].sha256 = "0".repeat(64); }],
    ["Wasm end", manifest => { manifest.provenance_join_end.m9_devid_wasm.O0.sha256 = "0".repeat(64); }],
  ]) {
    const drift = structuredClone(validO0.manifest); mutate(drift); await privateFile(validO0.manifestPath, drift);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /provenance binding differs/,
      `${name} drift between direct-run start and end rejects`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const executionClosureDrift = structuredClone(validO0.manifest);
  executionClosureDrift.native.python_closure.sha256 = "0".repeat(64);
  await privateFile(validO0.manifestPath, executionClosureDrift);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /native execution Python closure differs/,
    "native execution must bind the same captured Python closure as start/end");
  await privateFile(validO0.manifestPath, validO0.manifest);
  const alternateAuthority = structuredClone(validO0.manifest);
  alternateAuthority.native.oracle_process.prepython_authority
    .build_receipt.independent_selection.output =
      "/gnu/store/cccccccccccccccccccccccccccccccc-cadr-m8-m9-python-seal-authority";
  await privateFile(validO0.manifestPath, alternateAuthority);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /not independently re-evaluated/,
    "an outer result cannot substitute a caller-selected authority output");
  await privateFile(validO0.manifestPath, validO0.manifest);
  for (const [name, mutate, pattern] of [
    ["outer mode-2 Yama", value => { value.native.oracle_process.prepython_authority.yama_ptrace_scope = 2; },
      /outer, runtime, and receipt Yama policies differ/],
    ["runtime mode-2 Yama", value => { value.native.metadata.runtime_provenance.python.prepython_seal.yama_ptrace_scope = 2; },
      /runtime Yama policy differs from the authority receipt|native metadata receipt is incomplete|authority build receipt digest/],
    ["outer bootstrap", value => { value.native.oracle_process.prepython_authority.bootstrap = {
      ...value.native.oracle_process.prepython_authority.bootstrap, sha256: "0".repeat(64) }; },
      /authority bootstrap differs from child provenance|authority bootstrap differs from its receipt/],
    ["outer launcher", value => { value.native.oracle_process.prepython_authority.launcher = {
      ...value.native.oracle_process.prepython_authority.launcher, sha256: "0".repeat(64) }; },
      /authority launcher differs from child provenance|authority launcher differs from its receipt/],
    ["outer guard", value => { value.native.oracle_process.prepython_authority.guard = {
      ...value.native.oracle_process.prepython_authority.guard, sha256: "0".repeat(64) }; },
      /authority guard differs from child provenance|authority guard differs from its receipt/],
    ["runtime bootstrap", value => { value.native.metadata.runtime_provenance.python.prepython_seal.bootstrap.sha256 = "0".repeat(64); },
      /pre-Python bootstrap differs from the authority receipt|native metadata receipt is incomplete|authority build receipt digest/],
    ["outer permit", value => { value.native.oracle_process.prepython_authority.filesystem_permit = {
      ...value.native.oracle_process.prepython_authority.filesystem_permit,
      mounts: value.native.oracle_process.prepython_authority.filesystem_permit.mounts.map(
        (mount, index) => index === 0 ? { ...mount, destination: "/permit/substitute" } : mount) }; },
      /outer filesystem permit differs from child provenance/],
    ["runtime permit", value => { value.native.metadata.runtime_provenance.python.prepython_seal.filesystem_permit.mounts[0].destination = "/permit/substitute"; },
      /filesystem permit|outer filesystem permit differs from child provenance|native metadata receipt is incomplete|authority build receipt digest/],
  ]) {
    const altered = structuredClone(validO0.manifest); mutate(altered);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern,
      `${name} authority/permit mutation rejects the offline reciprocal receipt`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const childImporter = structuredClone(validO0.manifest);
  childImporter.native.metadata.runtime_provenance.python.prepython_seal
    .importer_isolation.path_hooks.unshift("zipimport.zipimporter");
  await privateFile(validO0.manifestPath, childImporter);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /metadata receipt is incomplete|importer surface is not isolated/,
    "a zip/non-FileLoader importer cannot enter the final result");
  await privateFile(validO0.manifestPath, validO0.manifest);
  for (const [name, mutate, pattern] of [
    ["READY4 boundary", value => { value.boundary = "983990279"; }, /exact quiescent READY4/],
    ["READY4 target", value => { value.target = "wrong"; }, /exact quiescent READY4/],
    ["READY4 contract", value => { value.contract = "wrong"; }, /exact quiescent READY4/],
    ["READY4 CDRM6E1 bytes", value => { value.cdrm6e1.hex = `00${value.cdrm6e1.hex.slice(2)}`; }, /CDRM6E1|receipt hash/],
    ["READY4 artifact evidence", value => { value.artifact_set.sha256 = "0".repeat(64); }, /artifact closure|digest/],
    ["READY4 post-208 limit", value => { value.post_208_summary.cdrm6e1.total_accepted = "9223372036854775808"; }, /projection|exceeds|limit/],
    ["READY4 quiescence", value => { value.quiescence.run_active = true; }, /assertQuiescent|quiescence/],
    ["READY4 host-wait count", value => { value.host_wait_chain.count = -1; }, /host_wait_chain/],
    ["READY4 host-wait commitment", value => { value.host_wait_chain.sha256 = "0".repeat(64); }, /host_wait_chain|digest/],
  ]) {
    const altered = structuredClone(validO0.manifest); mutate(altered.portable.ready4);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern,
      `${name} mutation rejects`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const recomputeHostWaitChain = bytes => {
    const domain = Buffer.from("CDRM6FASTHOSTWAIT1\0");
    const preimage = Buffer.alloc(domain.byteLength + 8 + 64);
    domain.copy(preimage); preimage.writeBigUInt64LE(0n, domain.byteLength);
    Buffer.from(digest(Buffer.from("CDRM6FASTHOSTWAIT1\0")), "hex")
      .copy(preimage, domain.byteLength + 8);
    Buffer.from(digest(bytes), "hex").copy(preimage, domain.byteLength + 40);
    return digest(preimage);
  };
  for (const [name, mutate] of [
    ["schema", bytes => { bytes[0] ^= 1; }],
    ["terminal status", bytes => { bytes.writeUInt32LE(7, 28); }],
    ["requested slots", bytes => { bytes.writeUInt32LE(0, 32); }],
    ["boundary arithmetic", bytes => { bytes.writeBigUInt64LE(99n, 64); }],
    ["persistent status", bytes => { bytes.writeUInt32LE(1, 88); }],
    ["core lifecycle", bytes => { bytes.writeUInt32LE(1, 92); }],
    ["outstanding request", bytes => { bytes.writeBigUInt64LE(0n, 96); }],
  ]) {
    const altered = structuredClone(validO0.manifest);
    const record = altered.portable.ready4.host_wait_chain.records[0];
    const bytes = Buffer.from(record.hex, "hex"); mutate(bytes);
    record.hex = bytes.toString("hex"); record.sha256 = digest(bytes);
    altered.portable.ready4.host_wait_chain.sha256 = recomputeHostWaitChain(bytes);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
      /CDRM6FAST1|host.wait|host_wait|zero-latency/,
      `fully synchronized reason-3 ${name} mutation rejects`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const transcriptCount = structuredClone(validO0.manifest);
  const transcriptBytes = Buffer.from(transcriptCount.portable.ready4.host_transcript.hex, "hex");
  transcriptBytes.writeUInt32LE(1, 20);
  transcriptCount.portable.ready4.host_transcript.hex = transcriptBytes.toString("hex");
  transcriptCount.portable.ready4.host_transcript.sha256 = digest(transcriptBytes);
  await privateFile(validO0.manifestPath, transcriptCount);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /host_transcript|zero-latency/, "host-wait count must equal exact issue/completion transcript pairs");
  await privateFile(validO0.manifestPath, validO0.manifest);
  async function expectHostTranscriptReject(label, mutate, pattern) {
    const altered = structuredClone(validO0.manifest);
    const bytes = Buffer.from(altered.portable.ready4.host_transcript.hex, "hex");
    mutate(bytes);
    altered.portable.ready4.host_transcript.hex = bytes.toString("hex");
    altered.portable.ready4.host_transcript.sha256 = digest(bytes);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern, label);
    await privateFile(validO0.manifestPath, validO0.manifest);
  }
  await expectHostTranscriptReject("a read completion digest cannot be empty", bytes => {
    Buffer.from(digest(Buffer.alloc(0)), "hex").copy(bytes, 64 + 256 + 168);
  }, /host_transcript|zero-latency|block-read/);
  await expectHostTranscriptReject("a read completion count must match its block shape", bytes => {
    bytes.writeBigUInt64LE(1023n, 64 + 72);
    bytes.writeBigUInt64LE(1023n, 64 + 256 + 72);
  }, /host_transcript|zero-latency|block-read/);
  await expectHostTranscriptReject("a block read cannot advance the overlay generation", bytes => {
    bytes.writeBigUInt64LE(1n, 64 + 256 + 96);
  }, /host_transcript|zero-latency|block-read/);
  const checkpointMissing = structuredClone(validO0.manifest);
  checkpointMissing.portable.ready4.checkpoint_chain.records = [];
  await privateFile(validO0.manifestPath, checkpointMissing);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /checkpoint_chain/, "a checkpoint commitment without recomputation materials rejects");
  const checkpointWitness = structuredClone(validO0.manifest);
  const checkpointRecord = checkpointWitness.portable.ready4.checkpoint_chain.records[0];
  const checkpointFast = Buffer.from(checkpointRecord.fast_run.hex, "hex");
  checkpointFast.writeBigUInt64LE(1n, 72); checkpointFast.writeBigUInt64LE(1n, 80);
  checkpointRecord.fast_run.hex = checkpointFast.toString("hex");
  checkpointRecord.fast_run.sha256 = digest(checkpointFast);
  const checkpointDomain = Buffer.from("CDRM6FASTCHAIN1\0");
  const checkpointPreimage = Buffer.alloc(checkpointDomain.byteLength + 8 + 128);
  checkpointDomain.copy(checkpointPreimage); checkpointPreimage.writeBigUInt64LE(0n, checkpointDomain.byteLength);
  let checkpointOffset = checkpointDomain.byteLength + 8;
  for (const value of [digest(Buffer.from("CDRM6FASTCHAIN1\0")), checkpointRecord.cdrstate5.sha256,
    checkpointRecord.cdrm5q1.sha256, checkpointRecord.fast_run.sha256]) {
    Buffer.from(value, "hex").copy(checkpointPreimage, checkpointOffset); checkpointOffset += 32;
  }
  checkpointWitness.portable.ready4.checkpoint_chain.sha256 = digest(checkpointPreimage);
  await privateFile(validO0.manifestPath, checkpointWitness);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /READY3\/READY4 witness differs/, "outer READY4 witness binds checkpoint count and digest");
  const hostWitness = structuredClone(validO0.manifest);
  const hostWitnessRecord = hostWitness.portable.ready4.host_wait_chain.records[0];
  const hostWitnessBytes = Buffer.from(hostWitnessRecord.hex, "hex");
  hostWitnessBytes.writeUInt32LE(1023, 32);
  hostWitnessRecord.hex = hostWitnessBytes.toString("hex");
  hostWitnessRecord.sha256 = digest(hostWitnessBytes);
  hostWitness.portable.ready4.host_wait_chain.sha256 = recomputeHostWaitChain(hostWitnessBytes);
  await privateFile(validO0.manifestPath, hostWitness);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
    /READY3\/READY4 witness differs/, "outer READY4 witness binds host-wait count and digest");
  await privateFile(validO0.manifestPath, validO0.manifest);
  const wasmPathSubstitute = structuredClone(validO0.manifest);
  wasmPathSubstitute.portable.wasm_execution.path = "cadr-web/build/cadr-web-m9-devid-O2.wasm";
  await privateFile(validO0.manifestPath, wasmPathSubstitute);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /descriptor-bound Wasm differs/,
    "a substituted descriptor-bound Wasm path rejects");
  await privateFile(validO0.manifestPath, validO0.manifest);
  const wrongRoot = structuredClone(validO0.manifest); wrongRoot.session.id = `m8-cw2-${"f".repeat(32)}`;
  await privateFile(validO0.manifestPath, wrongRoot);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /does not name its live session root/,
    "session/root mismatch rejects");
  await privateFile(validO0.manifestPath, validO0.manifest);
  const alias = resolve(fixture, `m8-cw2-${"a".repeat(32)}`);
  await symlink(paired, alias);
  await assert.rejects(browserAll100Evidence(resolve(alias, "manifest.json"), join, "O0"), /symbolic-link ancestor/,
    "a real symlinked session ancestor cannot redirect a live receipt locator");
  await rm(alias);

  async function expectNativeMetadataReject(label, mutate, pattern) {
    const alteredMetadata = structuredClone(validO0.manifest.native.metadata);
    mutate(alteredMetadata);
    const metadataBytes = await privateFile(resolve(paired, "native/metadata.json"), alteredMetadata);
    const alteredManifest = structuredClone(validO0.manifest);
    alteredManifest.native.metadata = alteredMetadata;
    const metadataReceipt = alteredManifest.native.files.find(item => item.path.endsWith("/native/metadata.json"));
    metadataReceipt.bytes = metadataBytes.byteLength; metadataReceipt.sha256 = digest(metadataBytes);
    await privateFile(validO0.manifestPath, alteredManifest);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern, label);
    await privateFile(resolve(paired, "native/metadata.json"), validO0.manifest.native.metadata);
    await privateFile(validO0.manifestPath, validO0.manifest);
  }
  await expectNativeMetadataReject("profile source-pin drift rejects the direct result",
    metadata => { metadata.source.system_fossil = "0".repeat(64); }, /source pins differ/);
  await expectNativeMetadataReject("selected artifact drift rejects the direct result",
    metadata => { metadata.artifacts[0].sha256 = "0".repeat(64); }, /artifact\/native-input closure differs/);
  await expectNativeMetadataReject("private-disk drift rejects the direct result",
    metadata => { metadata.private_disk.sha256_at_end = "0".repeat(64); }, /private disk/);
  await expectNativeMetadataReject("rendered-config absence rejects the direct result",
    metadata => { metadata.runtime_provenance.rendered_config.bytes = 0; }, /rendered private config/);
  await expectNativeMetadataReject("Python program descriptor drift rejects the direct result",
    metadata => { metadata.runtime_provenance.program.sha256 = "0".repeat(64); },
    /Python program differs/);
  await expectNativeMetadataReject("M6 schedule drift rejects the direct result",
    metadata => { metadata.m6_schedule.sha256 = "0".repeat(64); }, /selected M6 schedule/);
  await expectNativeMetadataReject("frozen Cadet mapping drift rejects the direct result",
    metadata => { metadata.m6_schedule.mapping_sha256 = "0".repeat(64); }, /selected M6 schedule/);

  async function expectNativePayloadReject(label, name, mutate, pattern) {
    const originalPayload = await readFile(resolve(paired, `native/${name}`));
    const alteredPayload = mutate(Buffer.from(originalPayload));
    const altered = structuredClone(validO0.manifest);
    await privateFile(resolve(paired, `native/${name}`), alteredPayload);
    if (name === "capture.ndjson") altered.native.metadata.transcript.sha256 = digest(alteredPayload);
    if (name === "idle.bin") altered.native.metadata.transcript.idle_samples_sha256 = digest(alteredPayload);
    const alteredMetadata = await privateFile(resolve(paired, "native/metadata.json"), altered.native.metadata);
    const changedReceipt = altered.native.files.find(item => item.path.endsWith(`/native/${name}`));
    changedReceipt.bytes = alteredPayload.byteLength; changedReceipt.sha256 = digest(alteredPayload);
    const metadataReceipt = altered.native.files.find(item => item.path.endsWith("/native/metadata.json"));
    metadataReceipt.bytes = alteredMetadata.byteLength; metadataReceipt.sha256 = digest(alteredMetadata);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern, label);
    await privateFile(resolve(paired, `native/${name}`), originalPayload);
    await privateFile(resolve(paired, "native/metadata.json"), validO0.manifest.native.metadata);
    await privateFile(validO0.manifestPath, validO0.manifest);
  }
  await expectNativePayloadReject("malformed CDRM6I1 idle sample rejects", "idle.bin", bytes => {
    bytes[0] ^= 1; return bytes;
  }, /CDRM6I1/);
  await expectNativePayloadReject("skeletal raw transcript rejects", "capture.ndjson", () => Buffer.from([
    JSON.stringify({ kind: "meta", schema: "cadr-m6-native-raw-v2", schedule_sha256: join.selected_inputs.release.schedule.sha256,
      schedule_events: join.selected_inputs.release.schedule.event_count, session_id: validO0.manifest.native.session_id }),
    JSON.stringify({ kind: "complete", clean_shutdown: true, schedule_consumed: join.selected_inputs.release.schedule.event_count,
      debug_ir_writes: 9 }), ""].join("\n")), /omits|incomplete/);
  await expectNativePayloadReject("reordered raw clocks reject", "capture.ndjson", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); [rows[1], rows[2]] = [rows[2], rows[1]]; return Buffer.from(`${rows.join("\n")}\n`);
  }, /chronology|clock/);
  await expectNativePayloadReject("truncated raw transcript rejects", "capture.ndjson", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); return Buffer.from(`${rows.slice(0, -1).join("\n")}\n`);
  }, /clean completion|incomplete/);
  await expectNativePayloadReject("missing settled row rejects", "capture.ndjson", bytes => Buffer.from(`${bytes.toString("utf8").trimEnd().split("\n").filter(row => !row.includes('"kind":"settled"')).join("\n")}\n`), /settled/);
  await expectNativePayloadReject("missing exact boundary rejects", "capture.ndjson", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); const at = rows.findIndex(row => row.includes('"kind":"boundary"'));
    rows.splice(at, 1); return Buffer.from(`${rows.join("\n")}\n`);
  }, /boundary/);
  async function expectWorkerLogReject(label, mutate, pattern) {
    const original = await readFile(resolve(paired, "portable/worker.ndjson")); const changed = mutate(Buffer.from(original));
    const altered = structuredClone(validO0.manifest); const bytes = await privateFile(resolve(paired, "portable/worker.ndjson"), changed);
    altered.portable.worker_log_file.bytes = bytes.byteLength; altered.portable.worker_log_file.sha256 = digest(bytes);
    await privateFile(validO0.manifestPath, altered);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern, label);
    await privateFile(resolve(paired, "portable/worker.ndjson"), original); await privateFile(validO0.manifestPath, validO0.manifest);
  }
  await expectWorkerLogReject("reordered worker response rejects", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); [rows[4], rows[5]] = [rows[5], rows[4]]; return Buffer.from(`${rows.join("\n")}\n`);
  }, /order/);
  await expectWorkerLogReject("missing worker response rejects", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); rows.splice(4, 1); return Buffer.from(`${rows.join("\n")}\n`);
  }, /order|incomplete/);
  await expectWorkerLogReject("extra worker response rejects", bytes => {
    const rows = bytes.toString("utf8").trimEnd().split("\n"); const last = JSON.parse(rows.at(-1));
    rows.push(JSON.stringify({ ...last, id: last.id + 1, op: "scheduler-run" })); return Buffer.from(`${rows.join("\n")}\n`);
  }, /extra|suffix/);
  const truncatedConsumption = structuredClone(validO0.manifest); truncatedConsumption.portable.consumption_boundaries.pop();
  await privateFile(validO0.manifestPath, truncatedConsumption);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /keyboard-consumption/,
    "truncated keyboard-consumption evidence rejects");
  await privateFile(validO0.manifestPath, validO0.manifest);
  async function expectDeactivationReject(label, mutate, pattern) {
    const alteredDeactivation = structuredClone(validO0.manifest.portable.shared_deactivation);
    mutate(alteredDeactivation);
    const deactivationBytes = await privateFile(resolve(paired, "portable/shared-deactivation.json"), alteredDeactivation);
    const alteredManifest = structuredClone(validO0.manifest);
    alteredManifest.portable.shared_deactivation = alteredDeactivation;
    alteredManifest.portable.shared_deactivation_file.bytes = deactivationBytes.byteLength;
    alteredManifest.portable.shared_deactivation_file.sha256 = digest(deactivationBytes);
    await privateFile(validO0.manifestPath, alteredManifest);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), pattern, label);
    await privateFile(resolve(paired, "portable/shared-deactivation.json"), validO0.manifest.portable.shared_deactivation);
    await privateFile(validO0.manifestPath, validO0.manifest);
  }
  await expectDeactivationReject("KeyQ producer payload mutation rejects", value => {
    value.keyboard_down.wire_records[0].payload = 0x51;
  }, /bytes do not encode|KeyQ\/60,70 producer/);
  await expectDeactivationReject("keyboard-down CDRIOB91 observation mutation rejects", value => {
    value.keyboard_down.core_observations[0].keyboard_fifo_count += 1;
  }, /CDRIOB91 transition/);
  await expectDeactivationReject("pointer-down CDRIOB91 observation mutation rejects", value => {
    value.pointer_down.core_observations[0].mouse_x += 1;
  }, /CDRIOB91 transition/);
  await expectDeactivationReject("neutralize pointer-up CDRIOB91 observation mutation rejects", value => {
    value.neutralize.core_observations[0].mouse_y += 1;
  }, /CDRIOB91 transition/);
  await expectDeactivationReject("neutralize all-up CDRIOB91 observation mutation rejects", value => {
    value.neutralize.core_observations[1].keyboard_fifo_count += 1;
  }, /CDRIOB91 transition/);
  await expectDeactivationReject("post-deactivation CDRIOB91 observation mutation rejects", value => {
    value.coreAfter.input_sequence += 1;
  }, /final CDRIOB91/);
  await expectDeactivationReject("post-core host deactivation mutation rejects", value => {
    value.deactivation.heldKeysCleared = 0;
  }, /shared deactivation/);

  const badManifest = structuredClone(validO0.manifest);
  badManifest.provenance_join_start.source_closure.files[0].sha256 = "0".repeat(64);
  await privateFile(validO0.manifestPath, badManifest);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /provenance binding differs/);
  await privateFile(validO0.manifestPath, validO0.manifest);
  for (const path of ["cadr-web/wasm/cadr-m5-batch.mjs", "cadr-web/wasm/cadr-display-renderer.mjs",
    "cadr-web/wasm/cadr-m11-audio.mjs", "cadr-web/wasm/cadr-m12-debugger.mjs",
    "cadr-web/wasm/cadr-m4-block-service.mjs"]) {
    const importDrift = structuredClone(validO0.manifest);
    importDrift.provenance_join_start.source_closure.files.find(item => item.path === path).sha256 = "0".repeat(64);
    await privateFile(validO0.manifestPath, importDrift);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /provenance binding differs/,
      `per-import drift for ${path} must reject the direct receipt`);
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const pathMutators = [
    manifest => manifest.campaign.script,
    manifest => manifest.campaign.manifest,
    manifest => manifest.comparison,
    manifest => manifest.portable.expected_cdrinp_file,
    manifest => manifest.portable.observed_cdrinp_file,
    manifest => manifest.portable.expected_state_file,
    manifest => manifest.portable.observed_state_file,
    manifest => manifest.portable.worker_log_file,
    manifest => manifest.portable.shared_deactivation_file,
    ...validO0.manifest.native.files.map((_, index) => manifest => manifest.native.files[index]),
  ];
  for (const [index, mutate] of pathMutators.entries()) {
    for (const path of ["../outside", "/absolute/outside"]) {
      const traversalManifest = structuredClone(validO0.manifest);
      mutate(traversalManifest).path = path;
      await privateFile(validO0.manifestPath, traversalManifest);
      await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
        /receipt differs|non-traversing|outside|unexpected shape/, `receipt locator ${index} rejects ${path}`);
    }
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  for (const mutate of [
    manifest => manifest.portable.module,
    manifest => manifest.portable.worker,
    manifest => manifest.wasm_production.outputs.O0,
    manifest => manifest.wasm_production.outputs.O2,
  ]) {
    const pathManifest = structuredClone(validO0.manifest);
    mutate(pathManifest).path = "../outside";
    await privateFile(validO0.manifestPath, pathManifest);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"),
      /direct M8\/M9 run|source closure/, "selected repository identity path rejects traversal");
  }
  await privateFile(validO0.manifestPath, validO0.manifest);
  const badStateManifest = structuredClone(validO0.manifest);
  badStateManifest.portable.observed_state_file.sha256 = "0".repeat(64);
  await privateFile(validO0.manifestPath, badStateManifest);
  await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /receipt differs/);
  };

  const provisioned = await provisionedM8M9Prerequisites(root);
  if (provisioned.disposition === "ready") {
    await runProvisionedM8M9ProvenanceIntegration();
  } else {
    console.log(`cadr M8/M9 provisioned integration skipped: ${provisioned.missing
      .map(item => `${item.path} (${item.observed})`).join(", ")}`);
  }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
} finally {
  rmSync(prepared, { recursive: true, force: true });
}
console.log("cadr M8/M9 X11 campaign refuses runtime without explicit consent");
