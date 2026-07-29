#!/usr/bin/env node
/* Private C-M5 source-oracle Wasm producer.  It bypasses neither scheduler
 * ingress nor the compile-guarded oracle latch; it uses no worker operation
 * because the latch/observation exports must be absent from production Wasm. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, stat, writeFile } from "node:fs/promises";

const CHUNK = 1048576;
const DUE = 500000;
const LAST = 565536;
const OK = 0;

function usage() { throw new Error("usage: WASM CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK 500000 565536 OUTPUT DISK-SHA256"); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function requireOk(status, what) { if ((status >>> 0) !== OK) throw new Error(`${what} status ${status}`); }

function input(exports, bytes) {
  const pointer = exports.cadr_wasm_input_reserve(bytes.byteLength) >>> 0;
  if (pointer === 0) throw new Error("Wasm input allocation failed");
  new Uint8Array(exports.memory.buffer, pointer, bytes.byteLength).set(bytes);
  return pointer;
}

async function importSmall(exports, kind, path) {
  const bytes = await readFile(path);
  if (bytes.byteLength === 0 || bytes.byteLength > CHUNK) throw new Error(`${path} needs streamed ingress`);
  input(exports, bytes);
  requireOk(exports.cadr_wasm_import(kind, bytes.byteLength), `import ${path}`);
}

async function importDisk(exports, path) {
  const identity = await stat(path, { bigint: true });
  if (!identity.isFile() || identity.size <= 0n) throw new Error("base disk must be a nonempty regular file");
  requireOk(exports.cadr_wasm_stream_begin(3, Number(identity.size & 0xffffffffn), Number(identity.size >> 32n)), "disk stream begin");
  let offset = 0n;
  for await (const part of createReadStream(path, { highWaterMark: CHUNK })) {
    const bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
    input(exports, bytes);
    requireOk(exports.cadr_wasm_stream_chunk(Number(offset & 0xffffffffn), Number(offset >> 32n), bytes.byteLength), "disk stream chunk");
    offset += BigInt(bytes.byteLength);
  }
  if (offset !== identity.size) throw new Error("short disk stream");
  requireOk(exports.cadr_wasm_stream_finish(), "disk stream finish");
}

function schedule(exports, kind, value) {
  requireOk(exports.cadr_wasm_schedule_event(kind, 0, DUE, 0, 1, 0, value, 0), `scheduler event ${kind}`);
}

function observation(exports) {
  const pointer = exports.cadr_wasm_output_pointer() >>> 0;
  requireOk(exports.cadr_wasm_m5_oracle_observation(), "oracle observation");
  const view = new DataView(exports.memory.buffer, pointer, 68);
  return { slots: view.getBigUint64(0, true), interruptControl: view.getUint32(8, true),
    interruptPending: view.getUint32(20, true), scancode: view.getUint32(44, true) };
}

function stateV5(exports) {
  const pointer = exports.cadr_wasm_output_pointer() >>> 0;
  /* M5's additive digest contains CDRSTATE4.  Initialize the existing
   * CDRSTATE2 cache through its public digest boundary before asking the
   * read-only V5 serializer for the first post-boot value. */
  requireOk(exports.cadr_wasm_state_v2_digest(), "CDRSTATE2 cache warmup");
  requireOk(exports.cadr_wasm_state_v5_digest(), "CDRSTATE5");
  return Buffer.from(new Uint8Array(exports.memory.buffer, pointer, 32)).toString("hex");
}

function run(exports, slots) {
  requireOk(exports.cadr_wasm_run(slots), `run ${slots} slots`);
}

async function main(argv) {
  if (argv.length !== 10 || argv[6] !== String(DUE) || argv[7] !== String(LAST) || !/^[0-9a-f]{64}$/.test(argv[9])) usage();
  const [wasm, config, prom, promSymbols, ucodeSymbols, disk, , , output, diskSha] = argv;
  const module = await WebAssembly.compile(await readFile(wasm));
  const instance = await WebAssembly.instantiate(module, {});
  const e = instance.exports;
  for (const name of ["cadr_wasm_m5_oracle_latch_disk_result", "cadr_wasm_m5_oracle_observation"]) {
    if (typeof e[name] !== "function") throw new Error(`${name} is absent: build with --m5-oracle`);
  }
  requireOk(e.cadr_wasm_create(), "create");
  await importSmall(e, 1, config); await importSmall(e, 2, prom);
  await importSmall(e, 4, promSymbols); await importSmall(e, 5, ucodeSymbols);
  await importDisk(e, disk); requireOk(e.cadr_wasm_cold_power_on(), "cold power on"); requireOk(e.cadr_wasm_boot(), "boot");
  for (let done = 0; done < DUE; ) { const batch = Math.min(4096, DUE - done); run(e, batch); done += batch; }
  requireOk(e.cadr_wasm_scheduler_transcript_start(), "CDRM5TR1 start");
  schedule(e, 2, 1); schedule(e, 3, 1); schedule(e, 1, 0);
  requireOk(e.cadr_wasm_m5_oracle_latch_disk_result(), "source-oracle disk/Xbus latch");
  run(e, 1);
  const transcriptPointer = e.cadr_wasm_input_reserve(CHUNK) >>> 0;
  if (transcriptPointer === 0) throw new Error("CDRM5TR1 scratch allocation failed");
  requireOk(e.cadr_wasm_scheduler_transcript(), "CDRM5TR1 drain");
  const transcript = new Uint8Array(e.memory.buffer, transcriptPointer, 376).slice();
  if (Buffer.from(transcript.subarray(0, 8)).toString("ascii") !== "CDRM5TR1") throw new Error("bad CDRM5TR1 frame");
  await writeFile(`${output}.cdrm5tr1`, transcript);
  const transcriptSha = digest(transcript);
  const rows = [{ schema: "CDRM5D1", schema_version: 1, target: "CADR-WEB-303/ABI1.4/C-M5-SCHED-v1", producer: "wasm", due_boundary: DUE, final_boundary: LAST, schedule: "INF-M5-PRE-SLOT-v1", hook: "source-oracle-disk-xbus-result-latch-v1", ingress: { clock: "scheduler-event", keyboard: "scheduler-event", sequence_break: "scheduler-event", disk_xbus: "test-only-post-acceptance-latch" }, cdrm5tr1_schema: "CDRM5TR1", cdrm5tr1_version: 4, cdrm5tr1_record_bytes: 120, projected_markers: { sequence_break_clear_boundary: 502997, external_interrupt_clear_boundary: 505102 }, disk_sha256_before: diskSha, disk_sha256_after: diskSha, keyboard_scheduler_value: 1, projected_keyboard_scancode: 0x10001 }];
  for (let boundary = DUE; boundary <= LAST; boundary += 1) {
    if (boundary !== DUE) run(e, 1);
    const observed = observation(e);
    if (observed.scancode !== 0x10001) throw new Error(`IOB projection lost at S${boundary}`);
    rows.push({ boundary, cdrstate5_sha256: stateV5(e), cdrm5tr1_current_sha256: transcriptSha,
      sequence_break_pending: (observed.interruptControl & (1 << 26)) !== 0,
      external_interrupt_pending: observed.interruptPending !== 0 });
  }
  await writeFile(output, rows.map(row => `${JSON.stringify(row)}\n`).join(""), "ascii");
}

await main(process.argv.slice(2));
