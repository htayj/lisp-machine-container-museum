import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { canonicalM6FailureDiagnostic } from
  "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import { parseCadrM7UnimplementedDiagnostic } from
  "../cadr-web/wasm/cadr-m7-devid-failure.mjs";

function wire({ site = 4, direction = 2, address = 0o76543,
  value = 0x12345678, result = 0, boundary = 1352885n,
  microinstructions = 1263000n } = {}) {
  const bytes = new Uint8Array(64); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM7U1"));
  view.setUint32(8, 1, true); view.setUint32(12, site, true);
  view.setUint32(16, direction, true); view.setUint32(20, 13, true);
  view.setUint32(24, address, true); view.setUint32(28, value, true);
  view.setUint32(32, result, true); view.setBigUint64(40, boundary, true);
  view.setBigUint64(48, microinstructions, true); return bytes;
}

const bytes = wire(); const parsed = parseCadrM7UnimplementedDiagnostic(bytes);
assert.deepEqual(parsed, {
  schema: "CDRM7U1", version: 1, site: 4, siteName: "guarded-bus-write",
  direction: 2, address: 0o76543, value: 0x12345678, result: 0, status: 13,
  boundary: 1352885n, microinstructions: 1263000n,
});
for (const mutate of [
  value => { value[0] ^= 1; },
  value => { new DataView(value.buffer).setUint32(20, 12, true); },
  value => { new DataView(value.buffer).setUint32(16, 1, true); },
  value => { value[63] = 1; },
]) {
  const candidate = bytes.slice(); mutate(candidate);
  assert.equal(parseCadrM7UnimplementedDiagnostic(candidate), null);
}

const digest = value => new Uint8Array(32).fill(value);
const conformance = {
  schema: "cadr-m6-wasm-ready-conformance-v1", outcome: "failed",
  completed_runs: 0, failed_run: 0,
  failure: {
    preflight: { profileId: "CADR-WEB-303", artifactSetSha256: digest(1),
      artifacts: [1, 2, 4, 5, 3].map((kind, index) =>
        ({ kind, byteCount: BigInt(index + 1), sha256: digest(index + 2) })) },
    run_evidence: { sessionId: "status13-session", privateDiskInstanceId: "status13-disk",
      privateDiskBaseSha256: digest(9) },
    transcript_tail: [],
    report: { schema: "CDRM6BOOT1", schemaVersion: 2, outcome: "failed",
      reason: "terminal-machine-status", phase: "run", status: 13,
      boundary: 1352885n, lifecycle: "FAILED", cdrstate5Sha256: digest(10),
      cdrm5q1Sha256: digest(11), outstandingRequest: null, machineInfo: null,
      transcriptCount: 0, lastHostTransactions: [], hostTranscriptSha256: digest(12),
      runFraming: { operation: "run-digest-batch-m5", requestedClockSlots: 4096,
        returnedBoundaryCount: 1559, terminalStatus: 13, preCallBoundary: 1351325n,
        cachedLastCompleteBoundary: 1352885n, postCallAttemptedBoundary: null },
      unimplementedDevice: { schema: "cadr-m7-unimplemented-device-v1", site: parsed.site,
        siteName: parsed.siteName, direction: parsed.direction, address: parsed.address,
        value: parsed.value, result: parsed.result, status: parsed.status,
        boundary: parsed.boundary, microinstructions: parsed.microinstructions,
        wireSha256: digest(13) },
    },
  },
};
const canonical = canonicalM6FailureDiagnostic(conformance);
assert.equal(canonical.failure.report.schemaVersion, 2);
assert.equal(canonical.failure.report.unimplementedDevice.siteName, "guarded-bus-write");
assert.equal(canonical.failure.report.unimplementedDevice.boundary, "1352885");
assert.equal(canonical.failure.report.unimplementedDevice.wireSha256, "0d".repeat(32));
const missing = structuredClone(conformance); delete missing.failure.report.unimplementedDevice;
assert.throws(() => canonicalM6FailureDiagnostic(missing), /missing or unknown fields/);
const downgraded = structuredClone(conformance);
delete downgraded.failure.report.unimplementedDevice;
downgraded.failure.report.schemaVersion = 1;
const legacy = canonicalM6FailureDiagnostic(downgraded);
assert.equal(legacy.failure.report.status, 13);
assert.equal(legacy.failure.report.schemaVersion, 1);
assert.equal(legacy.failure.report.unimplementedDevice, undefined,
  "legacy M6 schema v1 retains its historical status-13 meaning");
const v2Non13 = structuredClone(conformance);
v2Non13.failure.report.status = 12;
assert.throws(() => canonicalM6FailureDiagnostic(v2Non13), /schema version/,
  "schema v2 remains reserved for status-13 diagnostic receipts");

/* These modules exercise the real worker's status-13 response path without
 * making a physical-device result dependent on a particular preserved boot
 * image.  The strict fixture advertises the M7-DEVID export but refuses to
 * provide a record; the legacy fixture has no such selected-profile export. */
function wasmU32(value) {
  const bytes = [];
  do { const byte = value & 0x7f; value >>>= 7; bytes.push(byte | (value === 0 ? 0 : 0x80)); }
  while (value !== 0);
  return bytes;
}

function wasmName(value) {
  const bytes = new TextEncoder().encode(value);
  return [...wasmU32(bytes.byteLength), ...bytes];
}

function wasmSection(id, bytes) {
  return [id, ...wasmU32(bytes.length), ...bytes];
}

function status13WorkerModule({ strict }) {
  const typeIndexes = strict ? [0, 0, 0, 0, 1, 0, 0, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0];
  const bodies = [
    [0x00, 0x41, 0x00, 0x0b],                         // create
    [0x00, 0x41, 0x80, 0x08, 0x0b],                   // output pointer 1024
    [0x00, 0x41, 0x80, 0x10, 0x0b],                   // meta pointer 2048
    [0x00, 0x41, 0x80, 0x08, 0x41, 0x02, 0x36, 0x02, 0x00,
      0x41, 0x00, 0x0b],                              // machine-info: RUNNING
    [0x00, 0x41, 0x0d, 0x0b],                         // run: status 13
    [0x00, 0x41, 0x00, 0x0b],                         // scheduler digest
    [0x00, 0x41, 0x00, 0x0b],                         // state-v5 failure digest
    [0x00, 0x41, 0x80, 0x20, 0x0b],                   // input reserve
    [0x00, 0x41, 0x00, 0x0b],                         // scheduler event
    [0x00, 0x41, 0x00, 0x0b], [0x00, 0x41, 0x00, 0x0b], // power on and boot
    ...(strict ? [
      [0x00, 0x41, 0x09, 0x0b],                       // M6 evidence unavailable
      [0x00, 0x41, 0x09, 0x0b],                       // M6 fast runner unavailable
      [0x00, 0x41, 0x09, 0x0b],                       // M7 diagnostic unavailable
      [0x00, 0x41, 0x09, 0x0b], [0x00, 0x41, 0x09, 0x0b], // display
      [0x00, 0x41, 0x09, 0x0b], [0x00, 0x41, 0x09, 0x0b], // boot witness
    ] : []),
  ];
  const names = [
    "cadr_wasm_create", "cadr_wasm_output_pointer", "cadr_wasm_meta_pointer",
    "cadr_wasm_machine_info", "cadr_wasm_run", "cadr_wasm_scheduler_digest",
    "cadr_wasm_state_v5_failure_digest", "cadr_wasm_input_reserve",
    "cadr_wasm_schedule_event", "cadr_wasm_cold_power_on", "cadr_wasm_boot",
    ...(strict ? ["cadr_wasm_m6_disk_evidence_summary", "cadr_wasm_run_until_event_m6",
      "cadr_wasm_m7_unimplemented_diagnostic", "cadr_wasm_display_update",
      "cadr_wasm_display_full", "cadr_wasm_boot_witness", "cadr_wasm_boot_witness_meta"] : []),
  ];
  const exports = [
    ...wasmName("memory"), 0x02, 0x00,
    ...names.flatMap((name, index) => [...wasmName(name), 0x00, ...wasmU32(index)]),
  ];
  return new WebAssembly.Module(new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...wasmSection(1, [0x02, 0x60, 0x00, 0x01, 0x7f,
      0x60, 0x01, 0x7f, 0x01, 0x7f]),
    ...wasmSection(3, [...wasmU32(typeIndexes.length), ...typeIndexes]),
    ...wasmSection(5, [0x01, 0x00, 0x01]),
    ...wasmSection(7, [...wasmU32(strict ? 19 : 12), ...exports]),
    ...wasmSection(10, [...wasmU32(bodies.length), ...bodies.flatMap(body =>
      [...wasmU32(body.length), ...body])]),
  ]));
}

class WorkerProbe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter === undefined) this.messages.push(message); else waiter(message);
    });
  }
  request(message) {
    this.worker.postMessage(message);
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise((resolveReply, rejectReply) => {
      const timer = setTimeout(() => rejectReply(new Error(
        `timeout waiting for ${message.op}`)), 30000);
      this.waiters.push(reply => { clearTimeout(timer); resolveReply(reply); });
    });
  }
}

async function status13WorkerResponse({ strict }) {
  const worker = new Worker(new URL("../cadr-web/wasm/cadr-worker.js", import.meta.url),
    { type: "module" });
  const probe = new WorkerProbe(worker);
  try {
    const version = strict ? 5 : 3;
    let reply = await probe.request({ version, id: 1, op: "instantiate",
      module: status13WorkerModule({ strict }), ...(strict ? { m6DiskEvidencePolicy: true } : {}) });
    assert.equal(reply.status, 0, JSON.stringify(reply));
    reply = await probe.request({ version, id: 2, op: "cold-power-on" });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version, id: 3, op: "boot" });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version, id: 4, op: "scheduler-visibility", hidden: false });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version, id: 5, op: "scheduler-start" });
    assert.equal(reply.status, 0);
    return await probe.request({ version, id: 6, op: "scheduler-run", clockSlots: 1 });
  } finally {
    await worker.terminate();
  }
}

const legacyStatus13 = await status13WorkerResponse({ strict: false });
assert.equal(legacyStatus13.status, 13);
assert.equal(legacyStatus13.lifecycle, "FAILED");
assert.equal(legacyStatus13.lastCompleteBoundary, 0n,
  "legacy status-13 preserves generic terminal boundary evidence");
assert.equal(new Uint8Array(legacyStatus13.queueDigest).byteLength, 32);
assert.equal(new Uint8Array(legacyStatus13.coreStateDigest).byteLength, 32);

const strictMissingDiagnostic = await status13WorkerResponse({ strict: true });
assert.equal(strictMissingDiagnostic.status, 13);
assert.equal(strictMissingDiagnostic.lifecycle, "FAILED");
assert.equal("lastCompleteBoundary" in strictMissingDiagnostic, false,
  "M7-DEVID fails closed when its advertised diagnostic export provides no record");
assert.equal("queueDigest" in strictMissingDiagnostic, false);
assert.equal("coreStateDigest" in strictMissingDiagnostic, false);

console.log("cadr_m7_devid_failure_diagnostic: ok");
