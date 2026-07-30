import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

export const M6_READY4_RUN_SCHEMA = "cadr-m6-ready4-fast-run-v1";
export const M6_READY4_SUPERVISED_RUN_SCHEMA =
  "cadr-m6-ready4-supervised-run-v1";
export const M6_READY4_CAMPAIGN_SCHEMA = "cadr-m6-ready4-campaign-v1";
export const M6_READY4_FAILURE_SCHEMA = "cadr-m6-ready4-campaign-failure-v1";
export const M6_READY4_TARGET = "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1";
export const M6_READY4_CONTRACT = "C-M6-DISK-EVIDENCE-READY4-BINDING-v1";

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite JSON number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("unsupported canonical JSON value");
}

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${label} is not a lowercase SHA-256`);
  }
}

function u64(value, label) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`${label} is not a canonical u64 decimal`);
  }
  const parsed = BigInt(value);
  if (parsed > 0xffffffffffffffffn) throw new TypeError(`${label} exceeds u64`);
  return parsed;
}

export function parseCanonicalJson(bytes, label = "JSON") {
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new TypeError(`${label} is not UTF-8 JSON`); }
  const canonical = new TextEncoder().encode(canonicalJson(value));
  if (Buffer.compare(Buffer.from(bytes), Buffer.from(canonical)) !== 0) {
    throw new TypeError(`${label} is not recursively canonical JSON`);
  }
  return value;
}

const RUN_KEYS = Object.freeze([
  "boundary", "cdrm5q1_sha256", "cdrm6e1_hex", "cdrm6e1_sha256", "cdrstate5_sha256",
  "checkpoint_chain_sha256", "checkpoint_count", "contract", "outcome",
  "private_disk_instance_id", "ready3_witness_sha256", "ready4_witness_sha256",
  "schema", "selected_maximum", "session_id", "source_closure_sha256",
  "source_commit", "target", "wasm_byte_count", "wasm_optimization",
  "wasm_profile", "wasm_sha256",
]);

function nonzero(bytes) { return bytes.some(value => value !== 0); }

/* Independent CDRM6E1 validator: this deliberately does not import the
 * worker parser that produced the record. READY4 requires the tail case, no
 * limit witness, the frozen selected maximum, and a complete 512-event prefix. */
export function validateClosedM6EvidenceHex(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{1024}$/.test(value)) {
    throw new TypeError("READY4 CDRM6E1 is not 512 lowercase hex bytes");
  }
  const bytes = Buffer.from(value, "hex"); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.subarray(0, 7).toString("utf8") !== "CDRM6E1" || bytes[7] !== 0 ||
      view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 512 ||
      view.getUint32(16, true) !== 1 || view.getUint32(20, true) !== 1 ||
      view.getUint32(24, true) !== 512 || view.getUint32(28, true) !== 512 ||
      view.getBigUint64(32, true) !== 0x7fffffffffffffffn ||
      !nonzero(bytes.subarray(240, 272)) || !nonzero(bytes.subarray(272, 304)) ||
      bytes.subarray(352).some(byte => byte !== 0)) {
    throw new TypeError("READY4 CDRM6E1 has an invalid fixed or reserved field");
  }
  const total = view.getBigUint64(40, true); const tail = view.getBigUint64(48, true);
  let kinds = 0n; for (let index = 0; index < 9; index += 1) kinds += view.getBigUint64(88 + index * 8, true);
  if (total <= 512n || tail !== total - 512n || view.getBigUint64(56, true) !== 512n ||
      kinds !== total || view.getUint32(84, true) !== 1 ||
      view.getBigUint64(64, true) !== total - 1n || view.getUint32(236, true) !== 0 ||
      view.getBigUint64(304, true) !== 0n || view.getUint32(312, true) !== 0 ||
      view.getUint32(316, true) !== 0 || bytes.subarray(320, 352).some(byte => byte !== 0)) {
    throw new TypeError("READY4 CDRM6E1 lacks the required closed tail relation");
  }
  return bytes;
}

export function validateReady4Run(value) {
  exactKeys(value, RUN_KEYS, "READY4 run");
  if (value.schema !== M6_READY4_RUN_SCHEMA || value.outcome !== "ready4" ||
      value.target !== M6_READY4_TARGET || value.contract !== M6_READY4_CONTRACT ||
      typeof value.session_id !== "string" || !/^m6-ready4-session-[0-9a-f]{32}$/.test(value.session_id) ||
      typeof value.private_disk_instance_id !== "string" ||
      !/^m6-ready4-private-disk-[0-9a-f]{32}$/.test(value.private_disk_instance_id) ||
      !Number.isSafeInteger(value.checkpoint_count) || value.checkpoint_count <= 0 ||
      u64(value.boundary, "READY4 boundary") === 0n ||
      u64(value.selected_maximum, "READY4 selected maximum") !== 0x7fffffffffffffffn ||
      u64(value.wasm_byte_count, "READY4 Wasm byte count") === 0n ||
      value.wasm_optimization !== "O2" || value.wasm_profile !== "M6-DEVID1-O2" ||
      !/^[0-9a-f]{40}$/.test(value.source_commit ?? "")) {
    throw new TypeError("READY4 run has an invalid identity or bound");
  }
  for (const field of ["cdrm5q1_sha256", "cdrm6e1_sha256", "cdrstate5_sha256",
    "checkpoint_chain_sha256", "ready3_witness_sha256", "ready4_witness_sha256"]) {
    digest(value[field], `READY4 ${field}`);
  }
  digest(value.wasm_sha256, "READY4 wasm_sha256");
  digest(value.source_closure_sha256, "READY4 source_closure_sha256");
  const summary = validateClosedM6EvidenceHex(value.cdrm6e1_hex);
  if (sha256Hex(summary) !== value.cdrm6e1_sha256) {
    throw new TypeError("READY4 CDRM6E1 bytes and digest disagree");
  }
  return Object.freeze({ ...value });
}

const SUPERVISED_KEYS = Object.freeze([
  "accounting_sha256", "benchmark_sha256", "observation_deadline_seconds",
  "outcome", "policy_sha256", "projected_seconds", "run",
  "runtime_max_seconds", "schema", "staged_root_removed",
  "transient_unit_absent",
]);

export function validateSupervisedReady4Run(value) {
  exactKeys(value, SUPERVISED_KEYS, "supervised READY4 run");
  if (value.schema !== M6_READY4_SUPERVISED_RUN_SCHEMA ||
      value.outcome !== "ready4-supervised" ||
      value.staged_root_removed !== true ||
      value.transient_unit_absent !== true ||
      !Number.isSafeInteger(value.observation_deadline_seconds) ||
      value.observation_deadline_seconds <= 0 ||
      !Number.isSafeInteger(value.projected_seconds) ||
      value.projected_seconds <= 0 ||
      value.runtime_max_seconds !== value.projected_seconds * 2) {
    throw new TypeError("READY4 run lacks completed outer supervision");
  }
  const margin = Math.min(300, Math.max(
    30, Math.ceil(value.runtime_max_seconds / 20)));
  if (value.observation_deadline_seconds !==
      value.runtime_max_seconds + margin) {
    throw new TypeError("READY4 supervision deadline is not projection-derived");
  }
  digest(value.accounting_sha256, "READY4 accounting_sha256");
  digest(value.benchmark_sha256, "READY4 benchmark_sha256");
  digest(value.policy_sha256, "READY4 policy_sha256");
  return Object.freeze({ ...value, run: validateReady4Run(value.run) });
}

export async function readRegularCanonical(path, label) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new TypeError(`${label} is not a regular non-symlink file`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino ||
        opened.size !== metadata.size) throw new TypeError(`${label} changed while opening`);
    const bytes = await handle.readFile();
    if (bytes.byteLength !== metadata.size) throw new TypeError(`${label} changed while reading`);
    return Object.freeze({ bytes, value: parseCanonicalJson(bytes, label),
      sha256: sha256Hex(bytes) });
  } finally {
    await handle.close();
  }
}

export function aggregateReady4Runs(values) {
  if (!Array.isArray(values) || values.length !== 3) {
    throw new TypeError("READY4 aggregation requires exactly three runs");
  }
  const supervised = values.map(validateSupervisedReady4Run);
  const runs = supervised.map(value => value.run);
  const sessions = new Set(runs.map(run => run.session_id));
  const disks = new Set(runs.map(run => run.private_disk_instance_id));
  if (sessions.size !== 3 || disks.size !== 3) {
    throw new TypeError("READY4 campaign did not use three fresh workers and overlays");
  }
  const first = runs[0];
  const firstSupervised = supervised[0];
  for (const record of supervised.slice(1)) {
    for (const field of ["benchmark_sha256", "projected_seconds",
      "runtime_max_seconds", "observation_deadline_seconds"]) {
      if (record[field] !== firstSupervised[field]) {
        throw new TypeError("READY4 three-run supervision input mismatch");
      }
    }
  }
  const comparable = ["boundary", "cdrm5q1_sha256", "cdrm6e1_sha256",
    "cdrstate5_sha256", "checkpoint_chain_sha256", "checkpoint_count",
    "ready3_witness_sha256", "ready4_witness_sha256", "selected_maximum"];
  comparable.push("wasm_byte_count", "wasm_optimization", "wasm_profile",
    "wasm_sha256", "source_closure_sha256", "source_commit");
  if (!runs.slice(1).every(run => comparable.every(field => run[field] === first[field]))) {
    throw new TypeError("READY4 three-run witness mismatch");
  }
  return Object.freeze({
    schema: M6_READY4_CAMPAIGN_SCHEMA,
    outcome: "ready4",
    target: M6_READY4_TARGET,
    contract: M6_READY4_CONTRACT,
    boundary: first.boundary,
    selected_maximum: first.selected_maximum,
    ready3_witness_sha256: first.ready3_witness_sha256,
    ready4_witness_sha256: first.ready4_witness_sha256,
    cdrm6e1_sha256: first.cdrm6e1_sha256,
    cdrstate5_sha256: first.cdrstate5_sha256,
    cdrm5q1_sha256: first.cdrm5q1_sha256,
    checkpoint_chain_sha256: first.checkpoint_chain_sha256,
    checkpoint_count: first.checkpoint_count,
    wasm_byte_count: first.wasm_byte_count,
    wasm_optimization: first.wasm_optimization,
    wasm_profile: first.wasm_profile,
    wasm_sha256: first.wasm_sha256,
    source_closure_sha256: first.source_closure_sha256,
    source_commit: first.source_commit,
    benchmark_sha256: firstSupervised.benchmark_sha256,
    projected_seconds: firstSupervised.projected_seconds,
    runtime_max_seconds: firstSupervised.runtime_max_seconds,
    observation_deadline_seconds:
      firstSupervised.observation_deadline_seconds,
    runs: Object.freeze(runs.map((run, index) => Object.freeze({
      run_index: index, session_id: run.session_id,
      private_disk_instance_id: run.private_disk_instance_id,
      accounting_sha256: supervised[index].accounting_sha256,
      policy_sha256: supervised[index].policy_sha256,
    }))),
  });
}

export function ready4CampaignFailure(reason, completedRuns, diagnostics) {
  if (typeof reason !== "string" || !/^[a-z0-9-]{1,64}$/.test(reason) ||
      !Number.isSafeInteger(completedRuns) || completedRuns < 0 || completedRuns > 3 ||
      !Array.isArray(diagnostics) || diagnostics.length !== completedRuns) {
    throw new TypeError("invalid bounded READY4 campaign failure");
  }
  return Object.freeze({ schema: M6_READY4_FAILURE_SCHEMA, outcome: "failed", reason,
    completed_runs: completedRuns,
    diagnostic_sha256: diagnostics.map((value, index) => {
      digest(value, `READY4 failure diagnostic ${index}`); return value;
    }) });
}
