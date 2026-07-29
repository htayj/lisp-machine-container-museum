import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  canonicalM6ReadyWitness,
  serializeM6ReadyConformance,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  M6_EVIDENCE_RELATIVE_PATH,
  M6_PROFILE_RELATIVE_PATH,
  M6_RELEASE_RELATIVE_PATH,
  M6_WASM_IDENTITY,
  canonicalJson,
  validateM6WasmEvidenceBytes,
  validateM6WasmEvidenceFile,
} from "../scripts/validate-cadr-m6-wasm-evidence.mjs";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const RELEASE = JSON.parse(await readFile(resolve(ROOT, M6_RELEASE_RELATIVE_PATH), "utf8"));

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function bytes(hexValue) {
  return Uint8Array.from(hexValue.match(/../g), pair => Number.parseInt(pair, 16));
}

async function productionConformance() {
  const releaseHash = hex(CADR_M6_RELEASE_RECORD_SHA256);
  const runs = [];
  for (const run_index of [0, 1, 2]) {
    const run = {
      run_index,
      session_id: `evidence-session-${run_index}`,
      private_disk_instance_id: `evidence-disk-${run_index}`,
      private_disk_base_sha256:
        "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
      artifact_set_sha256:
        "ac8a1617651fa1546e3777c28f276f80d5675aae5da253b4c9e937b6f8019071",
      form_a_boundary: "328623243",
      form_b_boundary: "980313535",
      listener_idle_c_boundary: "982990214",
      listener_idle_settled_boundary: "983990214",
      ready_boundary: "983990278",
      cdrstate5_sha256: "33".repeat(32),
      cdrm5q1_sha256: "44".repeat(32),
      host_transcript_sha256: "55".repeat(32),
      semantic_witness_sha256: "",
      no_pending_or_orphaned_host_request: true,
    };
    run.semantic_witness_sha256 = hex(await canonicalM6ReadyWitness({
      releaseRecord: RELEASE,
      artifactSetSha256: bytes(run.artifact_set_sha256),
      privateDiskBaseSha256: bytes(run.private_disk_base_sha256),
      formABoundary: BigInt(run.form_a_boundary),
      formBBoundary: BigInt(run.form_b_boundary),
      listenerIdleCBoundary: BigInt(run.listener_idle_c_boundary),
      listenerIdleSettledBoundary: BigInt(run.listener_idle_settled_boundary),
      readyBoundary: BigInt(run.ready_boundary),
      cdrstate5Sha256: bytes(run.cdrstate5_sha256),
      cdrm5q1Sha256: bytes(run.cdrm5q1_sha256),
      hostTranscriptSha256: bytes(run.host_transcript_sha256),
    }));
    runs.push(run);
  }
  const result = {
    contract: CADR_M6_READY_CONTRACT,
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6",
    release_record_sha256: releaseHash,
    outcome: "ready",
    runs,
    semantic_witness_sha256: runs[0].semantic_witness_sha256,
  };
  await assert.doesNotReject(() => serializeM6ReadyConformance(result));
  return result;
}

function evidenceArtifact(index) {
  const source = [
    ["cadr-web-303-runnable-template", "cadr-web/profiles/cadr-web-303.ini.in"],
    ["prom-control-store", "l/sys/ubin/promh.mcr"],
    ["prom-symbols", "l/sys/ubin/promh.sym"],
    ["microcode-symbols", "l/sys/ubin/ucadr.sym"],
    ["system-303-0-base-disk", "l/usim/disk-sys-303-0.img"],
  ][index];
  const release = RELEASE.artifacts[index];
  return {
    byte_count: release.byte_count,
    id: source[0],
    kind: release.kind,
    local_path: source[1],
    sha256: release.sha256,
  };
}

async function validEvidence() {
  return {
    artifact_profile: {
      artifacts: RELEASE.artifacts.map((_, index) => evidenceArtifact(index)),
      profile_id: "CADR-WEB-303",
      profile_path: M6_PROFILE_RELATIVE_PATH,
    },
    conformance: await productionConformance(),
    driver: {
      protocol_version: 4,
      repetitions: 3,
      script: "scripts/run-cadr-m6-wasm-conformance.mjs",
      synthetic_entrypoint_used: false,
    },
    negative_preflight: {
      artifact_kind: 1,
      mutation_started: false,
      outcome: "failed",
      reason: "artifact-preflight-mismatch",
      worker_created: false,
      worker_requests: 0,
    },
    release_record: {
      contract: CADR_M6_READY_CONTRACT,
      native_inputs: structuredClone(RELEASE.native_inputs),
      path: M6_RELEASE_RELATIVE_PATH,
      sha256: hex(CADR_M6_RELEASE_RECORD_SHA256),
    },
    schema: "cadr-m6-real-wasm-conformance-evidence-v1",
    wasm: structuredClone(M6_WASM_IDENTITY),
  };
}

function canonicalBytes(value) {
  return encoder.encode(canonicalJson(value));
}

async function isolatedRoot() {
  const root = await mkdtemp(resolve(tmpdir(), "cadr-m6-evidence-"));
  for (const relative of [M6_RELEASE_RELATIVE_PATH, M6_PROFILE_RELATIVE_PATH]) {
    const destination = resolve(root, relative);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(ROOT, relative), destination);
  }
  return root;
}

const fixture = await validEvidence();
const root = await isolatedRoot();
try {
  const fixtureBytes = canonicalBytes(fixture);
  const evidencePath = resolve(root, M6_EVIDENCE_RELATIVE_PATH);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, fixtureBytes);
  const receipt = await validateM6WasmEvidenceFile(evidencePath, { repoRoot: root });
  assert.equal(receipt.schema, "cadr-m6-real-wasm-conformance-evidence-validation-v1");
  assert.equal(receipt.release_record_sha256, hex(CADR_M6_RELEASE_RECORD_SHA256));
  assert.deepEqual(receipt.wasm_verification, {
    mode: "structural",
    local_wasm_checked: false,
    reason: "local-wasm-verification-not-requested",
  });

  const rejectMutation = async (label, mutate) => {
    const candidate = structuredClone(fixture);
    mutate(candidate);
    await assert.rejects(
      () => validateM6WasmEvidenceBytes(canonicalBytes(candidate), { repoRoot: root }),
      TypeError,
      label,
    );
  };

  /* Each outer evidence family has a semantically material negative. */
  await rejectMutation("schema", value => { value.schema = "wrong"; });
  await rejectMutation("artifact profile", value => { value.artifact_profile.profile_id = "wrong"; });
  await rejectMutation("conformance", value => { value.conformance.runs[0].ready_boundary = "1"; });
  await rejectMutation("driver", value => { value.driver.script = "synthetic.mjs"; });
  await rejectMutation("negative preflight", value => { value.negative_preflight.worker_created = true; });
  await rejectMutation("release record", value => { value.release_record.native_inputs[0].byte_count = "1"; });
  await rejectMutation("Wasm", value => { value.wasm.sha256 = "00".repeat(32); });

  /* Every envelope object is closed, including the nested production summary. */
  for (const [label, mutate] of [
    ["outer", value => { value.unreviewed = true; }],
    ["artifact profile", value => { value.artifact_profile.unreviewed = true; }],
    ["conformance", value => { value.conformance.unreviewed = true; }],
    ["driver", value => { value.driver.unreviewed = true; }],
    ["negative preflight", value => { value.negative_preflight.unreviewed = true; }],
    ["release record", value => { value.release_record.unreviewed = true; }],
    ["Wasm", value => { value.wasm.unreviewed = true; }],
  ]) await rejectMutation(`${label} extra key`, mutate);

  const canonical = decoder.decode(canonicalBytes(fixture));
  const duplicateRoot = canonical.replace("{\"artifact_profile\"",
    "{\"schema\":\"duplicate\",\"schema\":\"duplicate\",\"artifact_profile\"");
  await assert.rejects(
    () => validateM6WasmEvidenceBytes(encoder.encode(duplicateRoot), { repoRoot: root }),
    /duplicate JSON member/,
  );
  const duplicateNested = canonical.replace("\"wasm\":{\"byte_count\":192819,",
    "\"wasm\":{\"byte_count\":192819,\"byte_count\":192819,");
  await assert.rejects(
    () => validateM6WasmEvidenceBytes(encoder.encode(duplicateNested), { repoRoot: root }),
    /duplicate JSON member/,
  );
  await assert.rejects(
    () => validateM6WasmEvidenceBytes(encoder.encode(`${canonical}\n`), { repoRoot: root }),
    /canonical JSON bytes/,
  );
  await assert.rejects(
    () => validateM6WasmEvidenceBytes(encoder.encode(canonical.replace("\"repetitions\":3", "\"repetitions\":3.0")),
      { repoRoot: root }),
    /canonical JSON bytes/,
  );
  await assert.rejects(
    () => validateM6WasmEvidenceBytes(canonicalBytes(fixture), {
      repoRoot: root,
      verifyLocalWasm: true,
    }),
    /fixed M6 module is unavailable/,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("C-M6 outer Wasm evidence validator tests passed");
