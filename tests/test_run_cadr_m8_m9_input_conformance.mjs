import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveCadrM8M9DeactivationProducer,
  quiesceKeyboardInput,
  resolveNativePythonExecutable,
} from "../scripts/run-cadr-m8-m9-input-conformance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/run-cadr-m8-m9-input-conformance.mjs");
const refused = spawnSync("node", [script], { cwd: root, encoding: "utf8" });
assert.equal(refused.status, 2, refused.stderr);
assert.deepEqual(JSON.parse(refused.stdout), {
  schema: "cadr-m8-m9-input-conformance-plan-v1",
  outcome: "blocked",
  runtime_execution_performed: false,
  reason: "explicit---execute-required",
});
const source = await readFile(script, "utf8");
for (const needle of ["native-capture", "CDRM8N1", "CDRINP1", "CDRIOB91",
  "runM6HeadlessBoot", "fresh private ignored 0700 session", "synthetic fallback",
  "wireRecords", "coreObservations", "expected-input.cdrinp1",
  "observed-input.cdrinp1", "expected-input-states.json",
  "observed-input-states.json", "worker-core-payloads-identical-to-expected",
  "process.versions.v8", "DIRECT-BOUNDARY-NON-CW2"]) {
  assert.ok(source.includes(needle), `runner omits ${needle}`);
}
assert.ok(source.indexOf("expected-input.cdrinp1") !== source.indexOf("observed-input.cdrinp1"));

const nativePython = resolveNativePythonExecutable();
assert.match(nativePython, /^\//, "native capture binds an absolute Python executable before environment scrubbing");
const scrubbedPython = spawnSync(nativePython, ["-c",
  "import os, pathlib, sys; print(int(bool(sys.executable) and pathlib.Path(sys.executable).is_file()))"], {
  cwd: root, encoding: "utf8", env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
});
assert.equal(scrubbedPython.status, 0, scrubbedPython.stderr);
assert.equal(scrubbedPython.stdout.trim(), "1",
  "the exact interpreter remains self-identifying when the native child has no PATH");
assert.match(source, /spawn\(nativePythonExecutable, args/, "native capture must not launch bare python3 after scrubbing PATH");
assert.match(source, /nativePythonAfter\.sha256 !== nativePythonBefore\.sha256/,
  "native capture re-hashes its exact Python executable after child exit");
assert.match(source, /reportedPython\?\.sha256 !== nativePythonBefore\.sha256/,
  "native capture rejects an oracle Python provenance that differs from the pre-spawn executable");

const deactivation = deriveCadrM8M9DeactivationProducer({ coreState: {
  csr: 0x14, scancode: 0x18000, mouseX: 44, mouseY: 54, inputSequence: 208,
  keyboardFifoCount: 0, ingressOrdinal: 208n, generation: 1n, lifecycle: 2,
}, pointerGeneration: 1 });
assert.equal(deactivation.keyboard_down[0].payload, 0x52,
  "KeyQ derives from the selected physical keyboard mapping, not a literal placeholder");
assert.equal(deactivation.pointer_down[0].payload,
  60 | (70 << 10) | (1 << 20) | (1 << 23),
  "tail-down uses the exact 60,70 EDGE32 producer command");
assert.equal(deactivation.neutralize[0].payload, 60 | (70 << 10) | (1 << 23) | (1 << 26),
  "capture-loss release retains the one-hot changed-mask as well as its cause");
assert.deepEqual(deactivation.neutralize.map(record => record.ordinal), [211n, 212n]);

function observation(state) {
  const bytes = new Uint8Array(64); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRIOB91"));
  view.setUint32(8, 1, true); view.setUint32(12, 64, true);
  view.setUint32(16, state.csr, true); view.setUint32(20, state.scancode, true);
  view.setUint32(24, state.mouseX, true); view.setUint32(28, state.mouseY, true);
  view.setUint32(32, state.inputSequence, true);
  view.setUint32(36, state.keyboardFifoCount, true);
  view.setBigUint64(40, state.ingressOrdinal, true);
  view.setBigUint64(48, state.generation, true);
  view.setUint32(56, 2, true);
  return bytes.buffer;
}

let state = { csr: 4, scancode: 0, mouseX: 0, mouseY: 0, inputSequence: 0,
  keyboardFifoCount: 0, ingressOrdinal: 0n, generation: 1n, lifecycle: 2 };
const client = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") {
    state = { ...state, csr: state.csr & ~(1 << 5), keyboardFifoCount: 0 };
    return { status: 0, completedSlots: 1n, microinstructionsExecuted: 1n };
  }
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91", observation: observation(state) };
} };
for (let pair = 0; pair < 100; pair += 1) {
  state = { ...state, csr: state.csr | (1 << 5), keyboardFifoCount: 1,
    inputSequence: state.inputSequence + 2, ingressOrdinal: state.ingressOrdinal + 2n };
  const result = await quiesceKeyboardInput(client, state, `pair-${pair}`,
    { maxRuns: 2, clockSlots: 1 });
  state = result.state;
  assert.equal(result.evidence.run_count, 1);
  assert.equal(state.csr, 4);
  assert.equal(state.keyboardFifoCount, 0);
}
assert.equal(state.ingressOrdinal, 200n,
  "READY-seeded runtime-like model advances beyond the native ten-entry FIFO limit");

const driftInitial = { ...state, csr: state.csr | (1 << 5), keyboardFifoCount: 1 };
const driftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 4, keyboardFifoCount: 0,
      ingressOrdinal: driftInitial.ingressOrdinal + 1n }) };
} };
await assert.rejects(quiesceKeyboardInput(driftClient, driftInitial, "drift",
  { maxRuns: 2, clockSlots: 1 }), /changed invariant input field ingressOrdinal/);

const mouseDriftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 4, keyboardFifoCount: 0,
      mouseX: driftInitial.mouseX + 1 }) };
} };
await assert.rejects(quiesceKeyboardInput(mouseDriftClient, driftInitial,
  "mouse-drift", { maxRuns: 2, clockSlots: 1 }), /changed mouse state/);

const csrDriftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 0, keyboardFifoCount: 0 }) };
} };
await assert.rejects(quiesceKeyboardInput(csrDriftClient, driftInitial,
  "csr-drift", { maxRuns: 2, clockSlots: 1 }), /changed a non-READY CSR bit/);
console.log("cadr M8/M9 paired campaign refuses runtime without explicit consent");
