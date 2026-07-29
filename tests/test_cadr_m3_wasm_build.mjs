/* M3 build is byte-reproducible and exposes precisely the browser ABI. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = resolve(ROOT, "cadr-web/build/m3-build-audit");
const EXPECTED = [
  "memory", "cadr_wasm_create", "cadr_wasm_input_reserve", "cadr_wasm_stream_begin",
  "cadr_wasm_stream_chunk", "cadr_wasm_stream_finish", "cadr_wasm_stream_abort", "cadr_wasm_import",
  "cadr_wasm_cold_power_on", "cadr_wasm_boot", "cadr_wasm_run",
  "cadr_wasm_output_pointer", "cadr_wasm_meta_pointer", "cadr_wasm_boundary_digest",
  "cadr_wasm_state_v2_digest", "cadr_wasm_state_v3_digest", "cadr_wasm_host_next_request",
  "cadr_wasm_host_complete", "cadr_wasm_disk_observation",
  "cadr_wasm_boot_media_observation", "cadr_wasm_disk_evidence",
  "cadr_wasm_machine_info", "cadr_wasm_trace_start", "cadr_wasm_trace_header",
  "cadr_wasm_trace_drain", "cadr_wasm_trace_digest", "cadr_wasm_trace_count",
  "cadr_wasm_trace_finish",
  "cadr_wasm_snapshot_size", "cadr_wasm_snapshot_save", "cadr_wasm_snapshot_pointer",
  "cadr_wasm_snapshot_input_reserve", "cadr_wasm_snapshot_restore_import",
  "cadr_wasm_snapshot_restore", "cadr_wasm_portability_probe",
  "cadr_wasm_state_v4_digest",
];

function build(opt, label) {
  const output = resolve(BUILD, `${opt}-${label}.wasm`);
  execFileSync("sh", ["cadr-web/wasm/build-wasm.sh", "--opt", opt, output], {
    cwd: ROOT, stdio: "inherit",
  });
  return output;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readUleb(bytes, at) {
  let value = 0; let shift = 0; let index = at;
  for (;;) {
    const byte = bytes[index++]; value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value >>> 0, index];
    shift += 7; assert.ok(shift <= 28, "oversized WASM LEB");
  }
}

function fixedMemoryPages(bytes) {
  let at = 8;
  while (at < bytes.length) {
    const section = bytes[at++]; let size; [size, at] = readUleb(bytes, at);
    const end = at + size;
    if (section === 5) {
      let count; [count, at] = readUleb(bytes, at); assert.equal(count, 1);
      const flags = bytes[at++]; let minimum; [minimum, at] = readUleb(bytes, at);
      let maximum; [maximum, at] = readUleb(bytes, at);
      assert.equal(flags, 1, "memory must declare a maximum");
      assert.equal(at, end); return [minimum, maximum];
    }
    at = end;
  }
  throw new Error("no WASM memory section");
}

try {
  await rm(BUILD, { recursive: true, force: true });
  for (const opt of ["O0", "O2"]) {
    const a = await readFile(build(opt, "a"));
    const b = await readFile(build(opt, "b"));
    assert.equal(sha256(a), sha256(b), `${opt} build is not reproducible`);
    const module = new WebAssembly.Module(a);
    assert.deepEqual(WebAssembly.Module.imports(module), [], `${opt} module imports host capability`);
    assert.deepEqual(WebAssembly.Module.exports(module).map((item) => item.name), EXPECTED,
      `${opt} export allowlist drift`);
    assert.deepEqual(fixedMemoryPages(a), [2048, 2048], `${opt} fixed 128 MiB memory contract`);
    const instance = await WebAssembly.instantiate(module, {});
    assert.equal(instance.exports.memory.buffer.byteLength, 128 * 1024 * 1024);
    assert.equal(instance.exports.cadr_wasm_snapshot_input_reserve(0xffffffff), 0,
      `${opt} rejects an over-bound snapshot allocation`);
  }
  console.log("cadr_m3_wasm_build: ok");
} finally {
  await rm(BUILD, { recursive: true, force: true });
}
