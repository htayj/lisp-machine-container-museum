import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  browserAll100Evidence,
  classifyNativeCandidates,
  sourceReachability,
  witnessRecords,
  writeX11FailureManifest,
} from "../scripts/run-cadr-m8-m9-x11-campaign.mjs";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/run-cadr-m8-m9-x11-campaign.mjs");
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
  assert.match(execute.stderr, /m8-m9-input-build\.json|ENOENT/);
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

  const paired = resolve(fixture, "paired");
  await mkdir(resolve(paired, "portable"), { recursive: true });
  const payload = Buffer.alloc(208 * 40, 7);
  const digest = value => createHash("sha256").update(value).digest("hex");
  const receipt = value => ({ bytes: value.byteLength, sha256: digest(value) });
  const expectedPath = resolve(paired, "portable/expected-input.cdrinp1");
  const observedPath = resolve(paired, "portable/observed-input.cdrinp1");
  await writeFile(expectedPath, payload); await writeFile(observedPath, payload);
  const consumption = Array.from({ length: 100 }, (_, index) => ({
    label: `key-${index}`, outcome: "keyboard-iob-quiescent",
    final: { csr: 4, keyboard_fifo_count: 0 },
  }));
  const statesValue = { schema: "cadr-m8-m9-observed-input-states-v1",
    states: Array.from({ length: 208 },
      () => ({ lifecycle: 2, generation: "1" })),
    consumption_boundaries: consumption };
  const statesBytes = Buffer.from(JSON.stringify(statesValue));
  const statesPath = resolve(paired, "portable/observed-input-states.json");
  await writeFile(statesPath, statesBytes);
  const deactivationBytes = Buffer.from(JSON.stringify({
    outcome: "held-key-and-pointer-cleared-after-core-delivery" }));
  const deactivationPath = resolve(paired, "portable/shared-deactivation.json");
  await writeFile(deactivationPath, deactivationBytes);
  const comparisonValue = { outcome: "worker-core-payloads-identical-to-expected",
    native: { record_count: 207 },
    browser: { record_count: 208, record_bytes: 40,
      exact_worker_boundary_match: true,
      expected_sha256: digest(payload), observed_sha256: digest(payload),
      generation: "1" },
    common_campaign: { key_count: 100, native_row_count: 207,
      browser_record_count: 208 } };
  const comparisonBytes = Buffer.from(JSON.stringify(comparisonValue));
  await writeFile(resolve(paired, "comparison.json"), comparisonBytes);
  const campaignValue = { schema: "cadr-m8-m9-input-campaign-v1",
    key_count: 100, native_row_count: 207, browser_record_count: 208 };
  const campaignBytes = Buffer.from(JSON.stringify(campaignValue));
  await writeFile(resolve(paired, "campaign.json"), campaignBytes);
  const manifest = {
    outcome: "worker-core-payloads-identical-to-expected",
    campaign: { manifest: { path: "campaign.json", ...receipt(campaignBytes) } },
    native: { metadata: { campaign: campaignValue } },
    comparison: { path: "comparison.json", ...receipt(comparisonBytes) },
    portable: {
      consumption_boundaries: consumption,
      expected_cdrinp_file: { path: "portable/expected-input.cdrinp1",
        ...receipt(payload) },
      observed_cdrinp_file: { path: "portable/observed-input.cdrinp1",
        ...receipt(payload) },
      observed_state_file: { path: "portable/observed-input-states.json",
        ...receipt(statesBytes) },
      shared_deactivation_file: { path: "portable/shared-deactivation.json",
        ...receipt(deactivationBytes) },
    },
  };
  const manifestPath = resolve(paired, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.equal((await browserAll100Evidence(manifestPath)).consumptionBoundaryCount, 100);
  const badCountComparison = structuredClone(comparisonValue);
  badCountComparison.browser.record_count = 207;
  const badCountBytes = Buffer.from(JSON.stringify(badCountComparison));
  await writeFile(resolve(paired, "bad-count-comparison.json"), badCountBytes);
  const badCountManifest = structuredClone(manifest);
  badCountManifest.comparison = {
    path: "bad-count-comparison.json", ...receipt(badCountBytes) };
  await writeFile(resolve(paired, "bad-count-manifest.json"),
    JSON.stringify(badCountManifest));
  await assert.rejects(browserAll100Evidence(
    resolve(paired, "bad-count-manifest.json")), /incomplete or nonconforming/);
  manifest.portable.observed_state_file.sha256 = "0".repeat(64);
  await writeFile(resolve(paired, "bad-manifest.json"), JSON.stringify(manifest));
  await assert.rejects(browserAll100Evidence(resolve(paired, "bad-manifest.json")),
    /incomplete or nonconforming/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}
console.log("cadr M8/M9 X11 campaign refuses runtime without explicit consent");
