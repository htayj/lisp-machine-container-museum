#!/usr/bin/env node
/*
 * Staged-only P4 executor for the M7 display plus M6-DEVID profile.  The
 * receipt-bound outer launcher archives this file with its named Git base;
 * direct execution from a mutable checkout is not a canary run.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { executeCanaryStage } from "./run-cadr-m6-devid-o2-canary-stage.mjs";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      canonicalJson(Object.keys(value).sort()) !==
      canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}

function isHash(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validateArtifactSet(value, label) {
  const expected = Object.freeze([
    Object.freeze([1, "cadr-web/profiles/cadr-web-303.ini.in"]),
    Object.freeze([2, "l/sys/ubin/promh.mcr"]),
    Object.freeze([4, "l/sys/ubin/promh.sym"]),
    Object.freeze([5, "l/sys/ubin/ucadr.sym"]),
    Object.freeze([3, "l/usim/disk-sys-303-0.img"]),
  ]);
  if (!Array.isArray(value) || value.length !== 5) {
    throw new TypeError(`${label} must contain five frozen artifacts`);
  }
  const kinds = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const artifact = value[index];
    exactKeys(artifact, ["byte_count", "kind", "path", "sha256"],
      `${label} artifact`);
    if (!Number.isSafeInteger(artifact.kind) || artifact.kind < 1 ||
        artifact.kind > 5 || kinds.has(artifact.kind) ||
        !/^[1-9][0-9]*$/.test(artifact.byte_count ?? "") ||
        typeof artifact.path !== "string" || artifact.path.length === 0 ||
        artifact.kind !== expected[index][0] ||
        artifact.path !== expected[index][1] ||
        !isHash(artifact.sha256)) {
      throw new TypeError(`${label} artifact identity is malformed`);
    }
    kinds.add(artifact.kind);
  }
}

export function validateM7DevidCanaryStageReceipt(value) {
  exactKeys(value, [
    "artifacts_after", "artifacts_before", "base_disk_unchanged",
    "completed_guest_boundary", "display", "exact_loop",
    "frozen_input_schedule", "m6_disk_evidence", "machine", "nonterminal",
    "private_artifacts_after", "private_artifacts_before", "private_disk",
    "schema", "snapshot", "transport", "wasm",
  ], "M7-DEVID stage receipt");
  if (value.schema !== "cadr-m7-devid-o2-canary-stage-v1" ||
      value.completed_guest_boundary !== "1130000" ||
      value.nonterminal !== true || value.base_disk_unchanged !== true) {
    throw new TypeError("M7-DEVID stage receipt has the wrong result identity");
  }
  exactKeys(value.machine, ["clock_slots_completed", "lifecycle",
    "outstanding_request_id", "persistentStatus", "profile"],
  "M7-DEVID machine");
  if (value.machine.clock_slots_completed !== "1130000" ||
      value.machine.lifecycle !== 2 || value.machine.outstanding_request_id !== "0" ||
      value.machine.persistentStatus !== 0 || value.machine.profile !== 1) {
    throw new TypeError("M7-DEVID machine did not pass the P4 intervention boundary");
  }
  exactKeys(value.transport, ["protocol_version", "run_operation"],
    "M7-DEVID transport");
  if (value.transport.protocol_version !== 5 ||
      value.transport.run_operation !== "run-digest-batch-m5") {
    throw new TypeError("M7-DEVID canary did not exercise the P4 protocol-v5 path");
  }
  exactKeys(value.exact_loop, ["batches", "candidate", "host_transactions"],
    "M7-DEVID exact loop");
  if (value.exact_loop.candidate !== "legacy-m5" ||
      !Number.isSafeInteger(value.exact_loop.batches) ||
      value.exact_loop.batches < 1 ||
      !Number.isSafeInteger(value.exact_loop.host_transactions) ||
      value.exact_loop.host_transactions < 0) {
    throw new TypeError("M7-DEVID exact loop is malformed");
  }
  exactKeys(value.m6_disk_evidence, ["accepted_events", "sha256", "tail_events"],
    "M7-DEVID continuation evidence");
  if (!/^[1-9][0-9]*$/.test(value.m6_disk_evidence.accepted_events ?? "") ||
      BigInt(value.m6_disk_evidence.accepted_events) <= 512n ||
      value.m6_disk_evidence.tail_events !==
        (BigInt(value.m6_disk_evidence.accepted_events) - 512n).toString() ||
      !isHash(value.m6_disk_evidence.sha256)) {
    throw new TypeError("M7-DEVID continuation evidence is malformed");
  }
  validateArtifactSet(value.artifacts_before, "public artifact");
  validateArtifactSet(value.private_artifacts_before, "private artifact");
  if (canonicalJson(value.artifacts_before) !== canonicalJson(value.artifacts_after) ||
      canonicalJson(value.private_artifacts_before) !==
        canonicalJson(value.private_artifacts_after) ||
      canonicalJson(value.artifacts_before) !==
        canonicalJson(value.private_artifacts_before)) {
    throw new TypeError("M7-DEVID immutable artifact identities changed");
  }
  exactKeys(value.frozen_input_schedule, ["event_count",
    "events_due_through_target", "first_due_boundary"], "M7-DEVID frozen schedule");
  if (value.frozen_input_schedule.event_count !== 3118 ||
      value.frozen_input_schedule.events_due_through_target !== 0 ||
      value.frozen_input_schedule.first_due_boundary !== "25000000") {
    throw new TypeError("M7-DEVID frozen schedule is malformed");
  }
  exactKeys(value.private_disk, ["base_sha256", "base_write_authority",
    "fresh", "instance_id", "overlay_final_generation",
    "overlay_initial_generation", "overlay_kind"], "M7-DEVID private disk");
  const baseDisk = value.artifacts_before.find(artifact => artifact.kind === 3);
  if (value.private_disk.base_sha256 !== baseDisk?.sha256 ||
      value.private_disk.base_write_authority !== false ||
      value.private_disk.fresh !== true ||
      !/^m6-private-disk-[0-9a-f-]{36}$/.test(value.private_disk.instance_id ?? "") ||
      value.private_disk.overlay_initial_generation !== "0" ||
      value.private_disk.overlay_final_generation !== "1" ||
      value.private_disk.overlay_kind !== "fresh-in-memory-m4-block-one-overlay") {
    throw new TypeError("M7-DEVID private disk identity is malformed");
  }
  exactKeys(value.display, ["byte_count", "height", "sha256", "width",
    "wire_schema"], "M7-DEVID display evidence");
  if (value.display.wire_schema !== "CDRDISP1" ||
      !Number.isSafeInteger(value.display.byte_count) ||
      value.display.byte_count < 1 || value.display.width !== 768 ||
      value.display.height !== 963 || !isHash(value.display.sha256)) {
    throw new TypeError("M7-DEVID display evidence is malformed");
  }
  exactKeys(value.snapshot, ["operation", "status"], "M7-DEVID snapshot");
  if (value.snapshot.operation !== "snapshot-size" || value.snapshot.status !== 9) {
    throw new TypeError("M7-DEVID snapshot rejection is missing");
  }
  exactKeys(value.wasm, ["byte_count", "sha256"], "M7-DEVID Wasm");
  if (!Number.isSafeInteger(value.wasm.byte_count) || value.wasm.byte_count < 1 ||
      !isHash(value.wasm.sha256)) {
    throw new TypeError("M7-DEVID Wasm identity is malformed");
  }
  return value;
}

function parseArgs(argv) {
  const result = { artifactRoot: null, wasm: null, completedBoundary: null,
    privateRoot: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: staged M7-DEVID canary --artifact-root ROOT --wasm PATH --private-root EMPTY-0700 --completed-boundary 1130000\n");
      process.exit(0);
    }
    if (!["--artifact-root", "--wasm", "--completed-boundary", "--private-root"].includes(argument) ||
        seen.has(argument)) throw new TypeError(`invalid staged canary argument ${JSON.stringify(argument)}`);
    seen.add(argument);
    const input = argv[++index];
    if (typeof input !== "string" || input.length === 0) {
      throw new TypeError(`${argument} needs a value`);
    }
    if (argument === "--artifact-root") result.artifactRoot = resolve(input);
    else if (argument === "--wasm") result.wasm = resolve(input);
    else if (argument === "--private-root") result.privateRoot = resolve(input);
    else result.completedBoundary = BigInt(input);
  }
  if (result.artifactRoot === null || result.wasm === null ||
      result.privateRoot === null || result.completedBoundary !== 1_130_000n) {
    throw new TypeError("staged M7-DEVID canary needs exact artifact root, Wasm path, private root, and P4 boundary");
  }
  return Object.freeze(result);
}

async function main() {
  const receipt = await executeCanaryStage(parseArgs(process.argv.slice(2)), {
    allowM7Display: true, candidate: "legacy-m5", emit: false,
  });
  validateM7DevidCanaryStageReceipt(receipt);
  process.stdout.write(`${canonicalJson(receipt)}\n`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
