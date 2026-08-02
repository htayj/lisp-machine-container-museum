import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = name => resolve(root, "cadr-web/build", name);
/* These pins are rebuilt from retained signed HEAD 51d5426 plus the complete
 * M8/M9 source-A patch. M9 is an additive M7-core profile, so these bytes
 * include both CDRM7U1's exact guarded IOB-CSR read route and CDRM7TV1's
 * source-defined TV range; do not regenerate from a worktree that rolls
 * either inherited route back. */
const m9ProfileArtifacts = Object.freeze({
  O0: Object.freeze({
    ordinary: Object.freeze({ bytes: 204402,
      sha256: "f65c08e50aa3440f014016adc3ae252cdf7ca626323276f7deaac338c718b9b1" }),
    devid: Object.freeze({ bytes: 167232,
      sha256: "ac32ee309ca6f10368dd3317fb31ef70c5642896eda441306169b5fe21e325d8" }),
  }),
  O2: Object.freeze({
    ordinary: Object.freeze({ bytes: 182384,
      sha256: "c1b4c70c20317bd156b7e79e35ea4d245f1fdde46143727f5600c0da58c09570" }),
    devid: Object.freeze({ bytes: 122282,
      sha256: "f5accbe7fa33c8208b3d5a4874a75b90c59ea4bec721741ff3b84196e762a62a" }),
  }),
});
const ordinaryM9Exports = Object.freeze([
  "memory", "cadr_wasm_create", "cadr_wasm_input_reserve",
  "cadr_wasm_m9_input_deliver", "cadr_wasm_m9_input_state",
  "cadr_wasm_stream_begin", "cadr_wasm_stream_chunk", "cadr_wasm_stream_finish",
  "cadr_wasm_stream_abort", "cadr_wasm_import", "cadr_wasm_cold_power_on",
  "cadr_wasm_boot", "cadr_wasm_reset", "cadr_wasm_run",
  "cadr_wasm_schedule_event", "cadr_wasm_schedule_events",
  "cadr_wasm_scheduler_transcript_start", "cadr_wasm_scheduler_transcript",
  "cadr_wasm_scheduler_transcript_finish", "cadr_wasm_output_pointer",
  "cadr_wasm_meta_pointer", "cadr_wasm_boundary_digest",
  "cadr_wasm_state_v2_digest", "cadr_wasm_state_v3_digest",
  "cadr_wasm_host_next_request", "cadr_wasm_host_complete",
  "cadr_wasm_disk_observation", "cadr_wasm_boot_media_observation",
  "cadr_wasm_disk_evidence", "cadr_wasm_machine_info",
  "cadr_wasm_display_update", "cadr_wasm_display_full", "cadr_wasm_trace_start",
  "cadr_wasm_trace_header", "cadr_wasm_trace_drain", "cadr_wasm_trace_digest",
  "cadr_wasm_trace_count", "cadr_wasm_trace_finish", "cadr_wasm_snapshot_size",
  "cadr_wasm_snapshot_save", "cadr_wasm_snapshot_pointer",
  "cadr_wasm_snapshot_input_reserve", "cadr_wasm_snapshot_restore_import",
  "cadr_wasm_snapshot_restore", "cadr_wasm_portability_probe",
  "cadr_wasm_state_v4_digest", "cadr_wasm_state_v5_digest",
  "cadr_wasm_scheduler_digest", "cadr_wasm_state_v5_failure_digest",
  "cadr_wasm_boot_witness", "cadr_wasm_boot_witness_meta",
]);
const m9DevidExports = Object.freeze(ordinaryM9Exports.flatMap(name => {
  if (name === "cadr_wasm_run") return [name, "cadr_wasm_run_until_event_m6"];
  if (name === "cadr_wasm_disk_evidence") {
    return [name, "cadr_wasm_m6_disk_evidence_summary"];
  }
  return [name];
}));

async function moduleFor(name) {
  return new WebAssembly.Module(await readFile(build(name)));
}
function exportsOf(module) {
  return WebAssembly.Module.exports(module).map(entry => entry.name);
}

for (const variant of ["O0", "O2"]) {
  const ordinary = await moduleFor(`cadr-web-m9-${variant}.wasm`);
  const devid = await moduleFor(`cadr-web-m9-devid-${variant}.wasm`);
  const ordinaryBytes = await readFile(build(`cadr-web-m9-${variant}.wasm`));
  const devidBytes = await readFile(build(`cadr-web-m9-devid-${variant}.wasm`));
  const expected = m9ProfileArtifacts[variant];
  for (const [profile, bytes] of [["ordinary", ordinaryBytes], ["devid", devidBytes]]) {
    assert.equal(bytes.byteLength, expected[profile].bytes,
      `${profile} M9 ${variant} byte count is pinned to retained M7 CSR and TV routing`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected[profile].sha256,
      `${profile} M9 ${variant} hash is pinned to retained M7 CSR and TV routing`);
  }
  assert.deepEqual(exportsOf(ordinary), ordinaryM9Exports,
    `ordinary M9 ${variant} exposes the exact M7/M9 ABI surface`);
  assert.deepEqual(exportsOf(devid), m9DevidExports,
    `M9-DEVID ${variant} exposes the exact M6/M7/M9 ABI surface`);

  const { exports: e } = await WebAssembly.instantiate(devid, {});
  assert.equal(e.cadr_wasm_create(), 0);
  const output = e.cadr_wasm_output_pointer() >>> 0;
  assert.notEqual(output, 0);
  assert.equal(e.cadr_wasm_m6_disk_evidence_summary(), 0,
    "M9-DEVID exposes its fixed CDRM6E1 evidence record");
  const summaryInput = e.cadr_wasm_input_reserve(1048576) >>> 0;
  assert.notEqual(summaryInput, 0);
  const summary = new Uint8Array(e.memory.buffer, summaryInput, 512).slice();
  assert.equal(summary.byteLength, 512, "M9-DEVID emits the fixed 512-byte evidence record");
  assert.equal(new TextDecoder().decode(summary.subarray(0, 7)), "CDRM6E1");
  assert.equal(e.cadr_wasm_m9_input_state(), 0,
    "M9 input state remains available in the combined profile");
  const state = new Uint8Array(e.memory.buffer, output, 64).slice();
  assert.equal(new TextDecoder().decode(state.subarray(0, 8)), "CDRIOB91");
  assert.equal(e.cadr_wasm_snapshot_size(), 9,
    "M9-DEVID deliberately publishes no portable snapshot");
  assert.equal(e.cadr_wasm_snapshot_pointer(), 0);
  assert.equal(e.cadr_wasm_snapshot_input_reserve(1), 0);
}

/* The active ABI is established in the adapter at every core request
 * boundary.  Check the M9-DEVID branch directly so a later preprocessor
 * reordering cannot quietly select M5 while preserving the export surface. */
const adapter = await readFile(resolve(root, "cadr-web/wasm/cadr_wasm_adapter.c"), "utf8");
assert.match(adapter, /#if defined\(CADR_M6_DEVID_WASM\) && defined\(CADR_M9_WASM\)\n#define CADR_WASM_SNAPSHOT_ABI_MINOR CADR_ABI_MINOR_M5\n#define CADR_WASM_ACTIVE_ABI_MINOR CADR_ABI_MINOR_M9/);
assert.match(adapter, /#if defined\(CADR_M6_DEVID_WASM\)\n#define CADR_WASM_OUTPUT_BYTES UINT32_C\(512\)/);
const makefile = await readFile(resolve(root, "cadr-web/Makefile"), "utf8");
assert.match(makefile, /^test:.*\bm8-m9-unit\b/m,
  "the authoritative default test target includes the complete M8/M9 unit gate");
assert.match(makefile, /^m8-m9-unit:\s+m8-m9-devid-unit\b/m,
  "the M8/M9 unit gate cannot omit the isolated M9-DEVID O0/O2 tests");
assert.match(makefile,
  /^m8-m9-devid-unit:.*\bbuild\/test_cadr_m9_iob_csr_route\b.*\bbuild\/test_cadr_m9_tv_bus_route\b/m,
  "the M8/M9 DEVID gate compiles both inherited M7 route regressions against M9");
assert.match(makefile, /^\t\.\/build\/test_cadr_m9_iob_csr_route$/m,
  "the M8/M9 DEVID gate executes the inherited M7 CSR route regression");
assert.match(makefile, /^\t\.\/build\/test_cadr_m9_tv_bus_route$/m,
  "the M8/M9 DEVID gate executes the inherited M7 TV route regression");

console.log("cadr_m8_m9_devid_wasm_exports: ok");
