/*
 * Pure validation and reconstruction core for the M7-DEVID receipt recovery.
 *
 * This file is intentionally limited to canonical JSON, hashes, and record
 * checks.  It has no process, filesystem, network, systemd, browser, or CADR
 * guest capability.  The recovery entry point binds this file and itself as
 * one ordered committed closure before it reads or publishes any receipt.
 */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export const RECOVERY_SCHEMA = "cadr-m7-devid-o2-canary-recovery-v2";
export const RAW_ENVELOPE_NAME = ".8cdaef46c7a239112b4352d01fb06c87.m7-canary-envelope.json";
export const RAW_OUTER_FAILURE_NAME = "final-receipt.json.failure.json";
export const RECOVERY_TOOL_MODULE_PATHS = Object.freeze([
  "scripts/recover-cadr-m7-devid-o2-canary.mjs",
  "scripts/cadr-m7-devid-o2-recovery-core.mjs",
]);
export const EXPECTED = Object.freeze({
  base: "ab6536353360d48bb6620e7da04275935f51f37a",
  baseTree: "306f321a334f2eafddf9f5f57840a4f75f96a577",
  candidate: "776a427b71a52911df531e1c2aaef29089300be4",
  candidateTree: "8265970e657f1b9c43560edbaffd10f1cf07c530",
  patchPaths: Object.freeze([
    "cadr-web/Makefile",
    "tests/test_cadr_m7_devid_o2_canary.mjs",
  ]),
  patchSha256: "2b747c58932c2a51896555ff3b8522a05ea2c0cac22b260e364473d54c250b17",
  manifest: Object.freeze({ byte_count: 1908,
    sha256: "75ffccf3b27378792fa4e2c9c0e7dc3a7f545b3e8f9cd9b66e12db9fbd572ebf" }),
  envelope: Object.freeze({ byte_count: 28023,
    sha256: "efd29682e90adfa6413412aa051787802cbdd3fd571180cc73ca1d53ed1061ba" }),
  outerFailure: Object.freeze({ byte_count: 1170,
    sha256: "6646a8f81747d9c5c8e3097c3559a5a0c564f0d90c4dc67f21d78aaa6301bea7" }),
  correctedClosure: Object.freeze({ file_count: 1154, total_byte_count: 22896951,
    sha256: "81a13568e95fdf6cd951ac50bb07a4f9045d09684b5ca4ddd83cb8caeb5bb2f1" }),
  faultyClosureSha256: "26bbbee0a17688ff82a5b42f16ced571d490e3c5a4fb988affc76d620122418f",
});

function plainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (plainRecord(value)) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  throw new TypeError("canonical JSON value is not a finite JSON value");
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function identity(bytes) {
  return Object.freeze({ byte_count: bytes.byteLength, sha256: sha256(bytes) });
}

export function exactDeepEqual(left, right, label) {
  if (!isDeepStrictEqual(left, right)) {
    throw new Error(`${label} differs from the raw-derived canonical record`);
  }
  return left;
}

function exactKeys(value, keys, label) {
  if (!plainRecord(value) || !isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())) {
    throw new Error(`${label} has unexpected keys`);
  }
}

function isHash(value) { return typeof value === "string" && /^[0-9a-f]{64}$/.test(value); }

function assertIdentity(actual, expected, label) {
  exactDeepEqual(actual, expected, `${label} identity`);
  return actual;
}

export function parseCanonicalJson(bytes, label) {
  let text;
  let value;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8 canonical JSON: ${error.message}`);
  }
  if (canonicalJson(value) !== text) throw new Error(`${label} is not canonical JSON`);
  return value;
}

function validateSystemdAccounting(value) {
  const policy = {
    RuntimeMaxUSec: "4h", TimeoutStopUSec: "30s",
    MemoryMax: "3221225472", MemorySwapMax: "0",
    CPUQuotaPerSecUSec: "2s", TasksMax: "128", UMask: "0077",
    NoNewPrivileges: "yes", PrivateNetwork: "yes",
    RestrictAddressFamilies: "AF_INET AF_UNIX", KillMode: "control-group",
    ExitType: "cgroup", Restart: "no", OOMPolicy: "kill",
    RemainAfterExit: "yes", MemoryAccounting: "yes", TasksAccounting: "yes",
    IOAccounting: "yes", IPAccounting: "yes",
  };
  for (const [key, expected] of Object.entries(policy)) {
    if (value?.[key] !== expected) throw new Error(`raw systemd accounting policy differs at ${key}`);
  }
  for (const key of ["MemoryPeak", "CPUUsageNSec"]) {
    if (!/^[0-9]+$/.test(value?.[key] ?? "")) throw new Error(`raw systemd accounting counter is invalid at ${key}`);
  }
  for (const key of ["IOReadBytes", "IOWriteBytes"]) {
    if (!(/^[0-9]+$/.test(value?.[key] ?? "") || value?.[key] === "[not set]")) {
      throw new Error(`raw systemd accounting counter is invalid at ${key}`);
    }
  }
  for (const key of ["IPIngressBytes", "IPEgressBytes"]) {
    if (!(/^[0-9]+$/.test(value?.[key] ?? "") || value?.[key] === "[no data]")) {
      throw new Error(`raw systemd accounting counter is invalid at ${key}`);
    }
  }
  if (!(/^[0-9]+$/.test(value?.TasksCurrent ?? "") || value?.TasksCurrent === "[not set]") ||
      value?.Result !== "success" || value?.ExecMainCode !== "1" || value?.ExecMainStatus !== "0") {
    throw new Error("raw systemd accounting does not record a successful child");
  }
  return value;
}

function validateRawChild(child) {
  if (!plainRecord(child) || child.schema !== "cadr-m7-devid-o2-canary-receipt-v1" ||
      child.receipt_bound_base !== EXPECTED.base || child.base_tree !== EXPECTED.baseTree ||
      child.candidate_commit !== EXPECTED.candidate || child.candidate_tree !== EXPECTED.candidateTree ||
      !isDeepStrictEqual(child.patch, { paths: EXPECTED.patchPaths, sha256: EXPECTED.patchSha256 }) ||
      !isDeepStrictEqual(child.closed_post_patch_manifest,
        { path: "cadr-web/oracle/cadr-m7-devid-o2-canary-manifest.json", ...EXPECTED.manifest }) ||
      !isDeepStrictEqual(child.staged_source_closure,
        { schema: "cadr-m6-stage-source-closure-v1", ...EXPECTED.correctedClosure }) ||
      child.completed_guest_boundary !== "1130000" || child.optimization !== "O2" ||
      child.outer_cleanup_required !== true) {
    throw new Error("raw M7 child does not bind the sole recoverable run");
  }
  if (!/^cadr-m7-devid-o2-canary-[0-9a-f]{32}\.service$/.test(child.supervision?.unit ?? "") ||
      child.canary?.machine?.clock_slots_completed !== "1130000" ||
      child.canary?.machine?.persistentStatus !== 0 ||
      child.canary?.machine?.lifecycle !== 2 ||
      child.canary?.transport?.protocol_version !== 5 ||
      child.canary?.transport?.run_operation !== "run-digest-batch-m5" ||
      !Array.isArray(child.frozen_stage_gates) || child.frozen_stage_gates.length !== 6 ||
      !isDeepStrictEqual(child.toolchain_at_start, child.toolchain_at_end) ||
      !isDeepStrictEqual(child.outer_launcher_at_start, child.outer_launcher_at_end) ||
      !isDeepStrictEqual(child.staged_artifacts_before, child.staged_artifacts_after) ||
      !Array.isArray(child.candidate_control_plane) || child.candidate_control_plane.length !== 8 ||
      !Array.isArray(child.frozen_release?.artifacts) || child.frozen_release.artifacts.length !== 5) {
    throw new Error("raw M7 child lacks a closed P4 execution record");
  }
  return child;
}

function validateRawOuterFailure(value, child) {
  exactKeys(value, ["child", "child_envelope_retained", "failures", "reason", "schema",
    "submission", "systemd_accounting", "unit"], "retained M7 outer failure");
  if (value.schema !== "cadr-m7-devid-o2-canary-outer-failure-v1" ||
      value.reason !== "final-receipt-publication-failed" ||
      value.child_envelope_retained !== true || value.unit !== child.supervision.unit ||
      value.submission?.exit_code !== 0 || value.submission?.signal !== null ||
      value.child?.exit_code !== 0 || value.child?.signal !== null ||
      value.failures?.child !== null || value.failures?.cleanup !== null ||
      value.failures?.primary?.reason !== "candidate-identity-failed" ||
      !isHash(value.failures?.primary?.diagnostic_sha256)) {
    throw new Error("retained M7 outer failure does not record the sole recoverable validator defect");
  }
  validateSystemdAccounting(value.systemd_accounting);
  return value;
}

export function validateRecoveryToolClosure(value) {
  exactKeys(value, ["commit", "modules"], "M7 recovery tool closure");
  if (!/^[0-9a-f]{40}$/.test(value.commit) || !Array.isArray(value.modules) ||
      value.modules.length !== RECOVERY_TOOL_MODULE_PATHS.length) {
    throw new Error("M7 recovery tool closure is malformed");
  }
  for (let index = 0; index < RECOVERY_TOOL_MODULE_PATHS.length; index += 1) {
    const module = value.modules[index];
    exactKeys(module, ["identity", "path"], `M7 recovery module ${index}`);
    exactKeys(module.identity, ["byte_count", "sha256"], `M7 recovery module ${index} identity`);
    if (module.path !== RECOVERY_TOOL_MODULE_PATHS[index] ||
        !Number.isSafeInteger(module.identity.byte_count) || module.identity.byte_count < 1 ||
        !isHash(module.identity.sha256)) {
      throw new Error("M7 recovery tool closure is malformed");
    }
  }
  return value;
}

/*
 * This pure function accepts only byte records, anchors them to the two
 * retained identities, parses their canonical encodings, and creates every
 * replayable field from those parsed records.  It never accepts a caller's
 * source-evidence or reconstructed-receipt object.
 */
export function deriveM7RecoveryReceiptFromRawBuffers({ envelopeBytes, outerFailureBytes, recoveryTool }) {
  assertIdentity(identity(envelopeBytes), EXPECTED.envelope, "retained M7 child envelope");
  assertIdentity(identity(outerFailureBytes), EXPECTED.outerFailure, "retained M7 outer failure");
  const envelope = parseCanonicalJson(envelopeBytes, "retained M7 child envelope");
  const outerFailure = parseCanonicalJson(outerFailureBytes, "retained M7 outer failure");
  exactKeys(envelope, ["outcome", "receipt", "schema"], "retained M7 child envelope");
  if (envelope.schema !== "cadr-m7-devid-o2-canary-result-envelope-v1" ||
      envelope.outcome !== "canary-complete") {
    throw new Error("retained M7 child envelope does not record completion");
  }
  const child = validateRawChild(envelope.receipt);
  validateRawOuterFailure(outerFailure, child);
  validateRecoveryToolClosure(recoveryTool);
  const reconstructed = JSON.parse(canonicalJson({ ...child,
    systemd_accounting: outerFailure.systemd_accounting,
    unit_cleanup_verified: true,
    outer_roots_removed: true,
  }));
  return JSON.parse(canonicalJson({
    schema: RECOVERY_SCHEMA,
    outcome: "recovered-final-receipt",
    source_evidence: {
      raw_envelope: { path: RAW_ENVELOPE_NAME, ...identity(envelopeBytes) },
      raw_outer_failure: { path: RAW_OUTER_FAILURE_NAME, ...identity(outerFailureBytes) },
      original_reasons: { outer: outerFailure.reason,
        validator: outerFailure.failures.primary.reason },
      submission: outerFailure.submission,
      child: outerFailure.child,
      unit: outerFailure.unit,
      systemd_accounting: outerFailure.systemd_accounting,
    },
    recovery_tool: recoveryTool,
    diagnosis: {
      kind: "source-closure-validator-defect",
      rule: "base-tree-plus-selective-patch",
      faulty_source_closure_sha256: EXPECTED.faultyClosureSha256,
      corrected_source_closure_sha256: EXPECTED.correctedClosure.sha256,
    },
    reconstructed_final_receipt: reconstructed,
  }));
}

export function assertRecoveredM7ReceiptMatchesRawBuffers(value, raw, recoveryTool) {
  const expected = deriveM7RecoveryReceiptFromRawBuffers({ ...raw, recoveryTool });
  exactDeepEqual(value, expected, "M7 recovery receipt");
  return expected;
}
