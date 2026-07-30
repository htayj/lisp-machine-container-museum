import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { closeSync } from "node:fs";
import { chmod, copyFile, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveCadrM8M9DeactivationProducer,
  nativePythonFdIdentity,
  openNativePythonExecutable,
  quiesceKeyboardInput,
  resolveNativePythonExecutable,
  runNativeCapture,
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
const missingPython = Object.assign(new Error("spawn python3 ENOENT"), { code: "ENOENT" });
assert.throws(() => resolveNativePythonExecutable({ path: "", spawnSyncImpl: (_command, _args, options) => {
  assert.equal(options.env.PATH, "", "resolver accepts an explicit missing PATH test seam");
  return { error: missingPython, status: null, signal: null };
} }), /cannot resolve an exact Python interpreter.*ENOENT/,
"a missing python3 reports its spawn error rather than dereferencing absent stdout");
for (const output of ["/trusted/python\nsecond\n", "/trusted/python\r\n", "/trusted/\0python\n", "/trusted/../python\n"]) {
  assert.throws(() => resolveNativePythonExecutable({ spawnSyncImpl: () => ({ stdout: output, stderr: "", status: 0, signal: null }) }),
    /resolver output is not one canonical absolute line/,
    `resolver rejects malformed Python output ${JSON.stringify(output)}`);
}

const pythonFixture = await mkdtemp(resolve(tmpdir(), "cadr-m8-m9-python-fd-"));
try {
  const original = resolve(pythonFixture, "python-original");
  const replacement = resolve(pythonFixture, "python-replacement");
  await copyFile(nativePython, original); await chmod(original, 0o700);
  const held = openNativePythonExecutable({ resolvePythonExecutable: () => original });
  try {
    await writeFile(replacement, "#!/bin/sh\nexit 97\n", { mode: 0o700 }); await chmod(replacement, 0o700);
    await rename(replacement, original);
    const inherited = spawnSync("/proc/self/fd/3", ["-c", `
import importlib.util, json
spec = importlib.util.spec_from_file_location("m8_m9_fd_identity", "${resolve(root, "scripts/cadr-m8-m9-native-input-oracle.py")}")
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
print(json.dumps(module.runtime_python_identity(), sort_keys=True))
`], { cwd: root, encoding: "utf8", env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      stdio: ["ignore", "pipe", "pipe", held.fd] });
    assert.equal(inherited.status, 0, inherited.stderr);
    const reported = JSON.parse(inherited.stdout);
    for (const field of ["bytes", "sha256", "device", "inode"]) {
      assert.equal(reported[field], held.identity[field], `oracle binds ${field} to inherited fd 3`);
      assert.equal(reported.sys_executable[field], held.identity[field], `sys.executable binds ${field} to fd 3`);
      assert.equal(reported.proc_self_exe[field], held.identity[field], `/proc/self/exe binds ${field} to fd 3`);
    }
    assert.equal(reported.inherited_fd, 3);
    assert.equal(reported.sys_executable.reference, "sys-executable");
    assert.equal(reported.proc_self_exe.reference, "proc-self-exe");
    assert.notEqual((await readFile(original)).toString(), (await readFile(`/proc/self/fd/${held.fd}`)).toString(),
      "atomic pathname replacement cannot substitute the descriptor-backed interpreter");
    await copyFile(`/proc/self/fd/${held.fd}`, replacement); await chmod(replacement, 0o700); await rename(replacement, original);
    assert.deepEqual(nativePythonFdIdentity(held.fd), held.identity,
      "restoring the pathname does not alter the open interpreter descriptor");
  } finally { closeSync(held.fd); }
} finally { await rm(pythonFixture, { recursive: true, force: true }); }

const fdIdentity = Object.freeze({ bytes: 123, sha256: "a".repeat(64), device: "7", inode: "11" });
const parentPythonFd = 29;
function capturedPythonIdentity({ version = "test", implementation = "cpython" } = {}) {
  return { schema: "cadr-m8-m9-python-identity-v1", inherited_fd: 3, ...fdIdentity,
    sys_executable: { reference: "sys-executable", ...fdIdentity },
    proc_self_exe: { reference: "proc-self-exe", ...fdIdentity }, version, implementation };
}
function capturedResponse(python = capturedPythonIdentity()) {
  return { status: "captured", metadata: { runtime_provenance: { python } } };
}
function fakeNativeSpawn(response) {
  return (executable, _args, options) => {
    assert.equal(executable, "/proc/self/fd/3", "runner executes the inherited fd rather than a pathname");
    assert.equal(options.env.PATH, undefined, "native child environment remains scrubbed");
    assert.equal(options.stdio[3], parentPythonFd,
      "native child receives a non-3 parent descriptor specifically as child fd 3");
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    queueMicrotask(() => { child.stdout.emit("data", Buffer.from(JSON.stringify(response))); child.emit("close", 0, null); });
    return child;
  };
}
const captureArguments = { prepared: "prepared", nativeConfig: "config", output: "output", sessionId: "session",
  diskId: "disk", inputScript: "script", campaign: "campaign" };
await assert.rejects(runNativeCapture(captureArguments, {
  openPythonExecutable: () => ({ fd: parentPythonFd, identity: fdIdentity }),
  identityForFd: () => ({ ...fdIdentity, sha256: "b".repeat(64) }), closeSyncImpl: () => {},
  spawnImpl: fakeNativeSpawn(capturedResponse()),
}), /descriptor changed during child execution/,
"post-exit descriptor identity drift rejects dynamically");
for (const [label, mutate, pattern] of [
  ["schema", value => { value.schema = "wrong"; }, /is incomplete/],
  ["inherited fd", value => { value.inherited_fd = 4; }, /is incomplete/],
  ["sys reference", value => { value.sys_executable.reference = "wrong"; }, /differs from inherited descriptor 3/],
  ["sys inode", value => { value.sys_executable.inode = "12"; }, /differs from inherited descriptor 3/],
  ["proc hash", value => { value.proc_self_exe.sha256 = "b".repeat(64); }, /differs from inherited descriptor 3/],
  ["version type", value => { value.version = 1; }, /is incomplete/],
  ["top-level inode", value => { value.inode = "12"; }, /differs from inherited descriptor 3/],
]) {
  const altered = capturedPythonIdentity(); mutate(altered);
  await assert.rejects(runNativeCapture(captureArguments, {
    openPythonExecutable: () => ({ fd: parentPythonFd, identity: fdIdentity }), identityForFd: () => fdIdentity,
    closeSyncImpl: () => {}, spawnImpl: fakeNativeSpawn(capturedResponse(altered)),
  }), pattern, `child Python ${label} mutation rejects dynamically`);
}

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
