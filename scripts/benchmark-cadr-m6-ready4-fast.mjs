#!/usr/bin/env node
/*
 * Strict comparator for a controlled 1,130,000-boundary M6 benchmark.  The
 * Collector entrypoints below time the actual bounded driver invocation and
 * publish no-replace receipts.  The comparator accepts only those three
 * canonical receipts and refuses to turn a speed result
 * into a compatibility claim unless all terminal and provenance identities
 * agree byte-for-byte.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, parseCanonicalJson, readRegularCanonical, sha256Hex }
  from "./cadr-m6-ready4-evidence.mjs";
import { writeCanonicalNoReplace } from "./aggregate-cadr-m6-ready4-campaign.mjs";

export const M6_FAST_BENCHMARK_CHILD_SCHEMA =
  "cadr-m6-fast-benchmark-child-v1";
export const M6_FAST_BENCHMARK_RUN_SCHEMA =
  "cadr-m6-fast-benchmark-attested-run-v1";
export const M6_FAST_BENCHMARK_SCHEMA = "cadr-m6-fast-benchmark-v1";
export const M6_BENCHMARK_BOUNDARY = "1130000";
export const M6_READY_BOUNDARY = 983990278n;
const RUN_KEYS = Object.freeze([
  "base_disk_sha256", "candidate", "cdrm6e1_sha256", "cdrm5q1_sha256",
  "cdrstate5_sha256", "completed_boundary", "elapsed_nanoseconds",
  "host_transcript_sha256", "overlay_sha256", "residue_sha256", "schema",
  "input_schedule_sha256", "release_record_sha256",
  "invocation_nonce_sha256", "source_closure_sha256", "source_commit",
  "wasm_byte_count", "wasm_optimization", "wasm_profile", "wasm_sha256",
]);
const CANDIDATES = Object.freeze(["legacy-m5", "fast-o0", "fast-o2"]);
function candidateOptimization(candidate) {
  return candidate === "fast-o2" ? "O2" : "O0";
}
function candidateWasmProfile(candidate) {
  return candidate === "fast-o2" ? "M6-DEVID1-O2" : "M6-DEVID1-O0";
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}
function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${label} is not SHA-256`);
}
function decimal(value, label) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) throw new TypeError(`${label} is not a canonical decimal`);
  return BigInt(value);
}

const ATTESTED_KEYS = Object.freeze([
  "accounting_sha256", "invocation_sha256", "outcome",
  "policy_sha256", "private_root_removed", "run", "schema",
  "source_stage_removed", "transient_unit_absent",
]);

export function validateBenchmarkChildRun(value) {
  exactKeys(value, RUN_KEYS, "M6 benchmark run");
  if (value.schema !== M6_FAST_BENCHMARK_CHILD_SCHEMA || !CANDIDATES.includes(value.candidate) ||
      value.completed_boundary !== M6_BENCHMARK_BOUNDARY || decimal(value.elapsed_nanoseconds, "elapsed nanoseconds") === 0n) {
    throw new TypeError("M6 benchmark run has invalid identity or boundary");
  }
  for (const field of RUN_KEYS.filter(field => field.endsWith("_sha256"))) digest(value[field], field);
  const expectedOptimization = candidateOptimization(value.candidate);
  if (value.wasm_optimization !== expectedOptimization ||
      value.wasm_profile !== candidateWasmProfile(value.candidate) ||
      decimal(value.wasm_byte_count, "Wasm byte count") === 0n ||
      !/^[0-9a-f]{40}$/.test(value.source_commit ?? "")) {
    throw new TypeError("M6 benchmark Wasm profile is mislabeled");
  }
  return Object.freeze({ ...value });
}

export function validateBenchmarkRun(value) {
  exactKeys(value, ATTESTED_KEYS, "attested M6 benchmark run");
  if (value.schema !== M6_FAST_BENCHMARK_RUN_SCHEMA ||
      value.outcome !== "systemd-attested" ||
      value.transient_unit_absent !== true ||
      value.private_root_removed !== true ||
      value.source_stage_removed !== true) {
    throw new TypeError("M6 benchmark receipt is not outer-attested");
  }
  for (const field of ["accounting_sha256", "invocation_sha256",
    "policy_sha256"]) digest(value[field], field);
  return Object.freeze({ ...value, run: validateBenchmarkChildRun(value.run) });
}

export function releaseRecordBenchmarkIdentity(bytes) {
  const record = parseCanonicalJson(bytes, "M6 release record");
  const schedule = record?.schedule;
  if (schedule === undefined) {
    throw new TypeError("M6 release record lacks its canonical input schedule");
  }
  const due = [];
  const visit = value => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === "object") {
      if (typeof value.due_boundary === "string" &&
          /^[1-9][0-9]*$/.test(value.due_boundary)) {
        due.push(BigInt(value.due_boundary));
      }
      Object.values(value).forEach(visit);
    }
  };
  visit(schedule);
  if (!Number.isSafeInteger(schedule.event_count) ||
      schedule.event_count !== due.length || due.length === 0 ||
      due.some(boundary => boundary <= BigInt(M6_BENCHMARK_BOUNDARY))) {
    throw new TypeError("M6 release record schedule is invalid at the benchmark boundary");
  }
  const normalized = Object.freeze({
    event_count: due.length,
    first_due_boundary: due.reduce((left, right) =>
      left < right ? left : right).toString(),
    events_due_through_target: 0,
    completed_boundary: M6_BENCHMARK_BOUNDARY,
  });
  return Object.freeze({
    release_record_sha256: sha256Hex(bytes),
    input_schedule_sha256: sha256Hex(Buffer.from(canonicalJson(normalized))),
  });
}

function slotsPerSecond(run) {
  return (BigInt(M6_BENCHMARK_BOUNDARY) * 1000000000n) / decimal(run.elapsed_nanoseconds, "elapsed nanoseconds");
}

export function compareM6FastBenchmark(values) {
  if (!Array.isArray(values) || values.length !== 3) throw new TypeError("benchmark requires exactly legacy, O0, and O2 receipts");
  const attestations = values.map(validateBenchmarkRun);
  const runs = attestations.map(value => value.run);
  if (new Set(runs.map(run => run.candidate)).size !== 3 ||
      !CANDIDATES.every(candidate => runs.some(run => run.candidate === candidate))) {
    throw new TypeError("benchmark candidates must be exactly legacy-m5, fast-o0, and fast-o2");
  }
  const legacy = runs.find(run => run.candidate === "legacy-m5");
  const o0 = runs.find(run => run.candidate === "fast-o0");
  const o2 = runs.find(run => run.candidate === "fast-o2");
  const comparable = ["cdrstate5_sha256", "cdrm5q1_sha256", "host_transcript_sha256",
    "cdrm6e1_sha256", "overlay_sha256", "base_disk_sha256", "residue_sha256",
    "input_schedule_sha256", "release_record_sha256",
    "source_closure_sha256", "source_commit"];
  if (![o0, o2].every(run => comparable.every(field => run[field] === legacy[field]))) {
    throw new TypeError("legacy and fast controlled runs disagree on final state, queue, host, disk evidence, or residue");
  }
  if (!comparable.every(field => o0[field] === o2[field])) {
    throw new TypeError("O0 and O2 fast runs are not identity-equivalent");
  }
  const fastO2SlotsPerSecond = slotsPerSecond(o2);
  if (fastO2SlotsPerSecond < 25000n) throw new RangeError("fast O2 rate is below 25,000 slots per second");
  const projectedSeconds = (M6_READY_BOUNDARY + fastO2SlotsPerSecond - 1n) / fastO2SlotsPerSecond;
  if (projectedSeconds > 43200n) throw new RangeError("fast O2 READY4 projection exceeds twelve hours");
  return Object.freeze({ schema: M6_FAST_BENCHMARK_SCHEMA, outcome: "compatible-fast-run",
    completed_boundary: M6_BENCHMARK_BOUNDARY, fast_o2_slots_per_second: fastO2SlotsPerSecond.toString(),
    ready4_projected_seconds: projectedSeconds.toString(),
    runs: Object.freeze(CANDIDATES.map(candidate => {
      const run = runs.find(item => item.candidate === candidate);
      return Object.freeze({ candidate, elapsed_nanoseconds: run.elapsed_nanoseconds });
    })),
    cdrstate5_sha256: legacy.cdrstate5_sha256, cdrm5q1_sha256: legacy.cdrm5q1_sha256,
    host_transcript_sha256: legacy.host_transcript_sha256, cdrm6e1_sha256: legacy.cdrm6e1_sha256,
    overlay_sha256: legacy.overlay_sha256, base_disk_sha256: legacy.base_disk_sha256,
    residue_sha256: legacy.residue_sha256,
    input_schedule_sha256: o2.input_schedule_sha256,
    release_record_sha256: o2.release_record_sha256,
    fast_o2_wasm_sha256: o2.wasm_sha256,
    fast_o2_wasm_byte_count: o2.wasm_byte_count,
    fast_o2_wasm_profile: o2.wasm_profile,
    fast_o2_wasm_optimization: o2.wasm_optimization,
    fast_o2_source_closure_sha256: o2.source_closure_sha256,
    fast_o2_source_commit: o2.source_commit });
}

const BENCHMARK_KEYS = Object.freeze([
  "base_disk_sha256", "cdrm5q1_sha256", "cdrm6e1_sha256",
  "cdrstate5_sha256", "completed_boundary", "fast_o2_slots_per_second",
  "fast_o2_source_closure_sha256", "fast_o2_source_commit",
  "fast_o2_wasm_byte_count", "fast_o2_wasm_optimization",
  "fast_o2_wasm_profile", "fast_o2_wasm_sha256",
  "host_transcript_sha256", "input_schedule_sha256", "outcome", "overlay_sha256",
  "release_record_sha256",
  "ready4_projected_seconds", "residue_sha256", "runs", "schema",
]);

export function validateM6FastBenchmark(value) {
  exactKeys(value, BENCHMARK_KEYS, "M6 benchmark");
  if (value.schema !== M6_FAST_BENCHMARK_SCHEMA ||
      value.outcome !== "compatible-fast-run" ||
      value.completed_boundary !== M6_BENCHMARK_BOUNDARY ||
      !Array.isArray(value.runs) || value.runs.length !== 3) {
    throw new TypeError("not a controlled compatible M6 benchmark");
  }
  for (const field of BENCHMARK_KEYS.filter(field => field.endsWith("_sha256"))) {
    digest(value[field], field);
  }
  if (value.fast_o2_wasm_profile !== "M6-DEVID1-O2" ||
      value.fast_o2_wasm_optimization !== "O2" ||
      decimal(value.fast_o2_wasm_byte_count, "fast O2 Wasm byte count") === 0n ||
      !/^[0-9a-f]{40}$/.test(value.fast_o2_source_commit ?? "")) {
    throw new TypeError("M6 benchmark lost its exact fast-O2 build identity");
  }
  const expectedRunKeys = ["candidate", "elapsed_nanoseconds"];
  for (let index = 0; index < CANDIDATES.length; index += 1) {
    exactKeys(value.runs[index], expectedRunKeys, "M6 benchmark timing");
    if (value.runs[index].candidate !== CANDIDATES[index] ||
        decimal(value.runs[index].elapsed_nanoseconds, "benchmark elapsed") === 0n) {
      throw new TypeError("M6 benchmark timings are reordered or invalid");
    }
  }
  const o2 = value.runs[2];
  const rate = (BigInt(M6_BENCHMARK_BOUNDARY) * 1000000000n) /
    BigInt(o2.elapsed_nanoseconds);
  const projection = (M6_READY_BOUNDARY + rate - 1n) / rate;
  if (rate < 25000n || projection > 43200n ||
      value.fast_o2_slots_per_second !== rate.toString() ||
      value.ready4_projected_seconds !== projection.toString()) {
    throw new TypeError("M6 benchmark projection does not match its measured O2 timing");
  }
  return Object.freeze({ ...value });
}

export function parseBenchmarkArguments(argv) {
  const result = { execute: false, receipts: [], output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") { if (result.execute) throw new TypeError("duplicate --execute"); result.execute = true; }
    else if (["--receipt", "--output"].includes(option)) {
      const value = argv[++index]; if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a pathname`);
      if (option === "--receipt") result.receipts.push(resolve(process.cwd(), value));
      else if (result.output === null) result.output = resolve(process.cwd(), value); else throw new TypeError("duplicate --output");
    } else throw new TypeError(`unsupported benchmark argument ${JSON.stringify(option)}`);
  }
  if (!result.execute || result.receipts.length !== 3 || result.output === null || new Set(result.receipts).size !== 3) {
    throw new TypeError("usage: node scripts/benchmark-cadr-m6-ready4-fast.mjs --execute --receipt LEGACY --receipt FAST-O0 --receipt FAST-O2 --output BENCHMARK.json\nThe comparator is inert without --execute.");
  }
  return Object.freeze(result);
}

export async function executeBenchmark(options) {
  const receipts = await Promise.all(options.receipts.map((path, index) => readRegularCanonical(path, `benchmark receipt ${index}`)));
  const result = compareM6FastBenchmark(receipts.map(receipt => receipt.value));
  await writeCanonicalNoReplace(options.output, result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write("usage: node scripts/benchmark-cadr-m6-ready4-fast.mjs --execute --receipt LEGACY --receipt FAST-O0 --receipt FAST-O2 --output BENCHMARK.json\n");
  } else executeBenchmark(parseBenchmarkArguments(process.argv.slice(2))).catch(error => {
    process.stderr.write(`M6 fast benchmark failed: ${error.message}\n`); process.exitCode = 1;
  });
}
