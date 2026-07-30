import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const common = [
  "memory:memory",
  "function:cadr_wasm_create", "function:cadr_wasm_input_reserve",
  "function:cadr_wasm_stream_begin", "function:cadr_wasm_stream_chunk",
  "function:cadr_wasm_stream_finish", "function:cadr_wasm_stream_abort",
  "function:cadr_wasm_import", "function:cadr_wasm_cold_power_on",
  "function:cadr_wasm_boot", "function:cadr_wasm_reset",
  "function:cadr_wasm_run", "function:cadr_wasm_schedule_event",
  "function:cadr_wasm_schedule_events",
  "function:cadr_wasm_scheduler_transcript_start",
  "function:cadr_wasm_scheduler_transcript",
  "function:cadr_wasm_scheduler_transcript_finish",
  "function:cadr_wasm_output_pointer", "function:cadr_wasm_meta_pointer",
  "function:cadr_wasm_boundary_digest", "function:cadr_wasm_state_v2_digest",
  "function:cadr_wasm_state_v3_digest", "function:cadr_wasm_host_next_request",
  "function:cadr_wasm_host_complete", "function:cadr_wasm_disk_observation",
  "function:cadr_wasm_boot_media_observation", "function:cadr_wasm_disk_evidence",
];
const tail = [
  "function:cadr_wasm_machine_info", "function:cadr_wasm_trace_start",
  "function:cadr_wasm_trace_header", "function:cadr_wasm_trace_drain",
  "function:cadr_wasm_trace_digest", "function:cadr_wasm_trace_count",
  "function:cadr_wasm_trace_finish", "function:cadr_wasm_snapshot_size",
  "function:cadr_wasm_snapshot_save", "function:cadr_wasm_snapshot_pointer",
  "function:cadr_wasm_snapshot_input_reserve",
  "function:cadr_wasm_snapshot_restore_import",
  "function:cadr_wasm_snapshot_restore", "function:cadr_wasm_portability_probe",
  "function:cadr_wasm_state_v4_digest", "function:cadr_wasm_state_v5_digest",
  "function:cadr_wasm_scheduler_digest",
  "function:cadr_wasm_state_v5_failure_digest",
  "function:cadr_wasm_boot_witness", "function:cadr_wasm_boot_witness_meta",
];

const m6DevidCommon = common.flatMap(entry => entry === "function:cadr_wasm_run" ?
  [entry, "function:cadr_wasm_run_until_event_m6"] : [entry]);

async function exportsOf(name) {
  const module = new WebAssembly.Module(await readFile(resolve(root, "cadr-web/build", name)));
  return WebAssembly.Module.exports(module).map(entry => `${entry.kind}:${entry.name}`);
}

/* Exact public module shape is the reviewed pre-M7 identity.  This avoids
 * comparing unstable native host output.  M5's portable Wasm bytes are also
 * pinned to the reviewed pre-M7 index build under the mandatory Guix toolchain. */
const m5Bytes = await readFile(resolve(root, "cadr-web/build/cadr-web-m5-O0.wasm"));
assert.equal(createHash("sha256").update(m5Bytes).digest("hex"),
  "4b71307d0e299b6d6f55b8265ac9d66f63710099c4aa414154c631eba0475d88");
assert.deepEqual(await exportsOf("cadr-web-m5-O0.wasm"), [...common, ...tail]);
assert.deepEqual(await exportsOf("cadr-web-m6-devid-O0.wasm"), [
  ...m6DevidCommon,
  "function:cadr_wasm_m6_disk_evidence_summary",
  ...tail,
]);
console.log("cadr M7 pre-M7 Wasm profile isolation passed");
