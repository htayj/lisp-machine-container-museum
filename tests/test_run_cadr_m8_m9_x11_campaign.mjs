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
  witnessRecords,
  writeX11FailureManifest,
} from "../scripts/run-cadr-m8-m9-x11-campaign.mjs";
import { deriveCadrM8M9DeactivationProducer } from "../scripts/run-cadr-m8-m9-input-conformance.mjs";
import {
  collectCadrM8M9ProvenanceJoin,
  collectCadrM8M9StaticImportClosure,
} from "../scripts/cadr-m8-m9-provenance-join.mjs";
import { createHash } from "node:crypto";
import { buildCadrM8M9Campaign, serializeCadrM8M9NativeScript } from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";
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
  Object.freeze({ path: "cadr-web/build/cadr-web-m9-O0.wasm", kind: "file" }),
  Object.freeze({ path: "cadr-web/build/cadr-web-m9-O2.wasm", kind: "file" }),
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
  async function privateDirectory(path) {
    await mkdir(path, { recursive: true, mode: 0o700 }); await chmod(path, 0o700);
  }
  async function privateFile(path, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    await writeFile(path, bytes, { mode: 0o600 }); await chmod(path, 0o600);
    return bytes;
  }
  const localReceipt = (path, bytes) => ({ path, bytes: bytes.byteLength, sha256: digest(bytes) });
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

  async function makeDirectFixture(rootPath, variant, suffix) {
    await privateDirectory(rootPath); await privateDirectory(resolve(rootPath, "native"));
    await privateDirectory(resolve(rootPath, "portable"));
    const nativeSession = `native-${suffix}`; const portableSession = `portable-${suffix}`;
    const diskId = `disk-${suffix}`; const sessionId = `m8-cw2-${suffix}`;
    assert.equal(resolve(rootPath).split("/").at(-1), sessionId,
      "fixture root is the exact fresh outer-session identifier");
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
    workerOperations.push("pointer-state", "keyboard-down", "pointer-down", "pointer-neutralize", "keyboard-state", "pointer-state", "input-state");
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
      runtime_provenance: { python: { schema: "cadr-m8-m9-python-identity-v1", inherited_fd: 3,
          bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1",
          sys_executable: { reference: "sys-executable", bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1" },
          proc_self_exe: { reference: "proc-self-exe", bytes: 1, sha256: "a".repeat(64), device: "1", inode: "1" },
          version: "synthetic", implementation: "cpython" },
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
    const directRunnerFiles = ["scripts/run-cadr-m8-m9-input-conformance.mjs",
      "scripts/cadr-m8-m9-native-input-oracle.py", "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
      "cadr-web/wasm/cadr-m8-m9-deactivation.mjs", "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
      "cadr-web/wasm/cadr-m6-headless-boot.mjs", "cadr-web/wasm/cadr-worker.js",
      "cadr-web/wasm/cadr-m8-keyboard.mjs", "cadr-web/wasm/cadr-m9-pointer.mjs",
      "scripts/cadr-m8-m9-provenance-join.mjs", "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch"].map(path =>
      structuredClone(join.source_closure.files.find(item => item.path === path)));
    const manifest = { schema: "cadr-m8-m9-input-conformance-result-v2",
      target: "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9-DIRECT-BOUNDARY-NON-CW2",
      outcome: "worker-core-payloads-identical-to-expected", runtime_execution_performed: true,
      source_binding: { schema: "cadr-m8-m9-direct-source-binding-v1",
        repository: structuredClone(join.repository), source_closure: structuredClone(join.source_closure),
        direct_runner: { revision: join.repository.candidate_commit, closure_dirty: false,
          dirty_policy: "exact file hashes and scoped status are retained; no clean-checkout claim",
          status_sha256: digest(Buffer.from("")), status: "", files: directRunnerFiles } },
      provenance_join_start: structuredClone(join), provenance_join_end: structuredClone(join), wasm_production: { schema: "cadr-m8-m9-wasm-production-v1", profile: "m9",
        forced: true, argv: ["make", "-B", "-C", "cadr-web", "build/cadr-web-m9-O0.wasm", "build/cadr-web-m9-O2.wasm"],
        stdout_sha256: "d".repeat(64), stderr_sha256: "e".repeat(64),
        outputs: structuredClone(join.m9_wasm) }, session: { id: sessionId, mode: "0700" },
      campaign: { script: { path: "input-script.txt", ...localReceipt("input-script.txt", scriptBytes) },
        manifest: { path: "campaign.json", ...localReceipt("campaign.json", campaignBytes) } },
      native: { session_id: nativeSession, private_disk_instance_id: diskId,
        oracle_process: { returncode: 0, signal: null }, witness, files: nativeFiles, metadata: nativeMetadata },
      portable: { session_id: portableSession, runtime: { node: "test", v8: "test",
          executable: { bytes: 1, sha256: "1".repeat(64) }, environment: { LANG: "C", LC_ALL: "C", TZ: "UTC" } },
        module: structuredClone(join.m9_wasm[variant]), worker: structuredClone(worker),
        expected_cdrinp_file: { path: "portable/expected-input.cdrinp1", ...localReceipt("portable/expected-input.cdrinp1", expectedBytes) },
        observed_cdrinp_file: { path: "portable/observed-input.cdrinp1", ...localReceipt("portable/observed-input.cdrinp1", observedBytes) },
        expected_state_file: { path: "portable/expected-input-states.json", ...localReceipt("portable/expected-input-states.json", expectedStatesBytes) },
        observed_state_file: { path: "portable/observed-input-states.json", ...localReceipt("portable/observed-input-states.json", observedStatesBytes) },
        worker_log_file: { path: "portable/worker.ndjson", ...localReceipt("portable/worker.ndjson", workerLogBytes) },
        consumption_boundaries: consumption,
        shared_deactivation_file: { path: "portable/shared-deactivation.json", ...localReceipt("portable/shared-deactivation.json", deactivationBytes) },
        shared_deactivation: deactivationValue, termination: { pending_requests: 0, terminated: true },
        browser_state: { generation: "1", first_ingress_ordinal: "1", last_ingress_ordinal: "208",
          input_sequence_before: 0, input_sequence_after: 208 }, m6_ready_boundary: "983990278" },
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
    ["Wasm end", manifest => { manifest.provenance_join_end.m9_wasm.O0.sha256 = "0".repeat(64); }],
  ]) {
    const drift = structuredClone(validO0.manifest); mutate(drift); await privateFile(validO0.manifestPath, drift);
    await assert.rejects(browserAll100Evidence(validO0.manifestPath, join, "O0"), /provenance binding differs/,
      `${name} drift between direct-run start and end rejects`);
  }
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
