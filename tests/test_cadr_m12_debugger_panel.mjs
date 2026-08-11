import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCadrM12PrivacyBoundDiagnostic,
  cadrM12ProvenanceRows,
  formatCadrM12InspectorValue,
} from "../cadr-web/browser/cadr-m12-debugger-panel.mjs";
import {
  CADR_M12_STATUS_DEBUG_STOP,
  parseCdrBug1,
  serializeCdrDbgStop1,
  serializeCdrProv1,
} from "../cadr-web/wasm/cadr-m12-debugger.mjs";

assert.equal(formatCadrM12InspectorValue(0), "0x00000000");
assert.equal(formatCadrM12InspectorValue(0x10203040), "0x10203040");
assert.throws(() => formatCadrM12InspectorValue(-1), TypeError);
const provenance = serializeCdrProv1({
  profileSha256: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
  coreSha256: Uint8Array.from({ length: 32 }, (_, index) => index + 33),
  snapshotSha256: Uint8Array.from({ length: 32 }, (_, index) => index + 65),
});
const rows = cadrM12ProvenanceRows(provenance);
assert.equal(rows.length, 3);
assert.equal(rows[0].label, "Profile SHA-256");
assert.match(rows[0].value, /^[0-9a-f]{64}$/);
assert.throws(() => cadrM12ProvenanceRows(new Uint8Array(1)), /C-M12/);
const stop = serializeCdrDbgStop1({
  reason: 1, breakpointIndex: 3, generation: 1n, boundaryOrdinal: 2n, clockSlot: 3n,
  microPcBefore: 4, rawLcBefore: 5, microPcAfter: 6, rawLcAfter: 7,
  faultAfter: 0, deviceRequestAfter: 0, inhibitedAfter: 0, runOrdinal: 8n,
  operationSlots: 1n,
  profileSha256: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
});
const bundle = buildCadrM12PrivacyBoundDiagnostic({
  terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance,
});
const parsed = parseCdrBug1(bundle);
assert.equal(parsed.terminalStatus, CADR_M12_STATUS_DEBUG_STOP);
assert.equal(parsed.summary, "C-M12 terminal debugger outcome; raw guest content excluded");
assert.doesNotMatch(parsed.summary, /[\\/:]/,
  "fixed diagnostic summary cannot carry a path or drive marker");
const panelSource = await readFile(new URL(
  "../cadr-web/browser/cadr-m12-debugger-panel.mjs", import.meta.url), "utf8");
for (const label of ["Set breakpoint", "Clear breakpoint", "Micro-step", "Macro-step",
  "Resume one boundary", "Prepare paused review", "Export reviewed snapshot and diagnostic",
  "Discard reviewed snapshot"]) assert.match(panelSource, new RegExp(label));
assert.match(panelSource, /mutating debugger controls are frozen/);
console.log("cadr M12 debugger panel scalar formatting tests passed");
