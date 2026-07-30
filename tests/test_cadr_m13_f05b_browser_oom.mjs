import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CADR_M13_F05B_SCHEMA,
  validateCadrM13F05bReport,
} from "../scripts/run-cadr-m13-f05b-browser-oom.mjs";

const base = Object.freeze({
  path: "l/usim/disk-sys-303-0.img", byteCount: 269562880,
  sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
});
const fixture = Object.freeze({ path: "generated/durable-synthetic-fixture.bin", byteCount: 65536, sha256: "a".repeat(64) });
const wasm = Object.freeze({ path: "cadr-web/build/cadr-web-m12-O2.wasm", byteCount: 1, sha256: "b".repeat(64) });
const source = Object.freeze({ path: "scripts/example.mjs", byteCount: 1, sha256: "c".repeat(64) });

function caseRecord(caseId, operation, requestedCap, selectedWasmServed) {
  return {
    caseId, origin: "http://127.0.0.1:1", operation, requestedCap,
    browser: { executable: "chromium", version: "Chromium test", launchArguments: ["--headless=new"], profile: "new-disposable-profile" },
    outcome: { classification: caseId === "M13-F05B-WASM-FIXED" ? "fixed-wasm-capacity-refusal" : "browser-oom-exception", injectedNoMemory: false, detail: null, pageObservation: null },
    process: { browserExitCode: null, browserExitSignal: null, devtoolsDisconnected: false, targetCrashed: false, cleanup: "terminated", terminationInitiator: "host-cleanup", processGroupClean: true },
    fixtureIntegrity: { baseBefore: base, baseAfter: base, durableSyntheticFixtureBefore: fixture, durableSyntheticFixtureAfter: fixture, unchanged: true },
    sourceReachability: { selectedWasmServed, selectedBaseServed: false, durableSyntheticFixtureServed: false, deniedPaths: [] },
  };
}

const report = {
  schema: CADR_M13_F05B_SCHEMA, profile: "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2",
  purpose: "focused probe", sourceRevision: "unavailable", trackedSourceDirty: "unavailable",
  command: "node scripts/run-cadr-m13-f05b-browser-oom.mjs --execute", outputDirectory: "build/cadr-m13/f05b-test",
  toolchain: { node: "vtest", platform: "test", architecture: "test", chromiumRequested: "chromium" },
  inputIdentities: { selectedBase: base, durableSyntheticFixture: fixture, selectedWasm: wasm, sources: [source, source, source, source] },
  cases: [
    caseRecord("M13-F05B-JS-HEAP", "js-heap-grow", { jsHeapMiB: 64, targetEstimatedBytes: 268435456 }, false),
    caseRecord("M13-F05B-WASM-FIXED", "wasm-grow-past-fixed-maximum", { wasmInitialBytes: 134217728, wasmMaximumBytes: 134217728, attemptedGrowPages: 1 }, true),
  ],
  portabilityGaps: ["a", "b", "c"],
  cleanup: { temporaryOriginsRemoved: true, temporaryProfilesRemoved: true, allProcessGroupsStopped: true },
  cM13Claim: { passes: false, reason: "focused probe only" },
};

assert.equal(validateCadrM13F05bReport(structuredClone(report)), true);
const extraKey = structuredClone(report); extraKey.cases[0].outcome.reclassifiedAsNoMemory = true;
assert.throws(() => validateCadrM13F05bReport(extraKey), /keys are not closed/);
const mutableFixture = structuredClone(report); mutableFixture.cases[0].fixtureIntegrity.baseAfter = { ...base, sha256: "d".repeat(64) };
assert.throws(() => validateCadrM13F05bReport(mutableFixture), /fixture integrity did not hold/);
const injected = structuredClone(report); injected.cases[0].outcome.injectedNoMemory = true;
assert.throws(() => validateCadrM13F05bReport(injected), /outcome is invalid/);
const wrongRoute = structuredClone(report); wrongRoute.cases[1].sourceReachability.selectedWasmServed = false;
assert.throws(() => validateCadrM13F05bReport(wrongRoute), /reachability differs/);

const runner = await readFile(new URL("../scripts/run-cadr-m13-f05b-browser-oom.mjs", import.meta.url), "utf8");
assert.match(runner, /requires --execute/);
assert.match(runner, /CadrProcessGroupSupervisor/);
assert.match(runner, /cadr-pdeath-exec\.py/);
assert.match(runner, /--js-flags=--max-old-space-size=/);
assert.match(runner, /memory\.grow\(1\)/);
assert.match(runner, /browser-process-loss/);
assert.match(runner, /renderer-process-loss/);
assert.match(runner, /watchdog-terminated-cap-stress/);
assert.match(runner, /injectedNoMemory: false/);
assert.match(runner, /selectedBaseServed: false, durableSyntheticFixtureServed: false/);
assert.match(runner, /refusing to replace existing output/);
assert.match(runner, /flag: "wx"/);

console.log("cadr M13-F05b browser OOM report-schema and isolation tests passed");
