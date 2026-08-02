import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { buildCadrM14 } from "../scripts/build-cadr-m14-release.mjs";
import {
  CADR_M14_PRODUCTION_ADAPTER_REGISTRY,
  admitM14EvidenceReceipts,
  aggregateM14Evidence,
  cadrM14EvidenceCanonical as canonical,
  cadrM14EvidenceSha256 as sha256,
  deriveM14EvidenceCandidate,
  validateM14EvidenceGates,
  validateM14EvidencePolicy,
} from "../scripts/cadr-m14-evidence.mjs";

const repo = resolve(import.meta.dirname, "..");
const run = (command, args, cwd, env = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stderr}`);
  return result;
};
const bytes = value => Buffer.from(`${canonical(value)}\n`);
const h = value => sha256(Buffer.from(value));
const hex = character => character.repeat(64);

async function cleanExtraction() {
  const target = await mkdtemp(resolve(tmpdir(), "cadr-m14-evidence-extraction-"));
  const listed = [...new Set([
    ...run("git", ["ls-files", "-z"], repo).stdout.split("\0"),
    ...run("git", ["diff", "--name-only", "-z"], repo).stdout.split("\0"),
    ...run("git", ["ls-files", "--others", "--exclude-standard", "-z"], repo).stdout.split("\0"),
  ].filter(Boolean))].sort();
  for (const path of listed) {
    const destination = resolve(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(repo, path), destination, { verbatimSymlinks: true });
  }
  run("git", ["init", "--quiet"], target); run("git", ["add", "--all"], target);
  run("git", ["-c", "user.name=M14 evidence test", "-c", "user.email=m14-evidence@example.invalid",
    "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-gpg-sign", "-m", "M14 evidence test"], target,
  { GIT_AUTHOR_DATE: "2026-08-02T16:00:00+0000", GIT_COMMITTER_DATE: "2026-08-02T16:00:00+0000" });
  return target;
}

if (process.env.CADR_M14_EVIDENCE_COMMITTED !== "1") {
  const extraction = await cleanExtraction();
  try { run("node", ["tests/test_cadr_m14_evidence.mjs"], extraction, { CADR_M14_EVIDENCE_COMMITTED: "1" }); }
  finally { await rm(extraction, { recursive: true, force: true }); }
  console.log("cadr M14 evidence admission tests passed"); process.exit(0);
}

const root = resolve(repo, "build/cadr-m14");
const candidateHome = resolve(root, `evidence-candidate-${process.pid}`);
const receiptHome = resolve(root, `evidence-receipts-${process.pid}`);
const cliHome = resolve(root, `evidence-cli-${process.pid}`);
const policyBytes = await readFile(resolve(repo, "cadr-web/release/cadr-m14-evidence-policy.json"));
const policy = JSON.parse(policyBytes); const policySha256 = sha256(policyBytes);
const gates = JSON.parse(await readFile(resolve(repo, "cadr-web/release/cadr-m14-gates.json")));
validateM14EvidencePolicy(policy); validateM14EvidenceGates(gates, policy, policySha256);
assert.deepEqual(CADR_M14_PRODUCTION_ADAPTER_REGISTRY, new Map());

for (const mutate of [
  value => { value.definitionOfDone.find(record => record.id === "CW4-DOD-07").requiredCases.pop(); },
  value => { value.definitionOfDone.find(record => record.id === "CW4-DOD-07").requiredCases.push("M6-READY4-THREE-BOOTS"); },
  value => { value.cases.find(record => record.id === "M14-FINAL-RUNTIME-OFFLINE").supportsDoD = ["CW4-DOD-09"]; },
  value => { value.definitionOfDone.find(record => record.id === "CW4-DOD-07").requiredBlockers.pop(); },
  value => { value.definitionOfDone.find(record => record.id === "CW4-DOD-07").requiredBlockers.push("M6-B01"); },
  value => { value.blockers.find(record => record.id === "M14-B01").blocks = ["CW4-DOD-09"]; },
]) {
  const forged = structuredClone(policy); mutate(forged);
  assert.throws(() => validateM14EvidencePolicy(forged), /mappings disagree/);
}
for (const mutate of [
  value => { value.gates.find(record => record.id === "CW4").requiredDoD = []; },
  value => { value.gates.find(record => record.id === "CW4").requiredDoD.pop(); },
  value => { value.gates.find(record => record.id === "CW4").requiredDoD.push("CW4-DOD-01"); },
]) {
  const forged = structuredClone(policy); mutate(forged);
  assert.throws(() => validateM14EvidencePolicy(forged), /gate mapping differs/);
}
for (const mutate of [
  value => {
    const record = value.cases.find(item => item.id === "M14-FINAL-RUNTIME-OFFLINE");
    record.id = "M14-NOT-THE-STABLE-CASE";
    value.blockers.find(item => item.id === "M14-B01").caseIds = [record.id];
    value.definitionOfDone.find(item => item.id === "CW4-DOD-07").requiredCases =
      value.definitionOfDone.find(item => item.id === "CW4-DOD-07").requiredCases.map(id => id === "M14-FINAL-RUNTIME-OFFLINE" ? record.id : id);
  },
  value => {
    value.blockers.find(item => item.id === "M14-B01").id = "M14-B99";
    value.cases.find(item => item.id === "M14-FINAL-RUNTIME-OFFLINE").resolvesBlockers = ["M14-B99"];
    value.definitionOfDone.find(item => item.id === "CW4-DOD-07").requiredBlockers = ["M13-B01", "M13-B02", "M14-B99"];
  },
  value => { value.cases.find(item => item.id === "M14-FINAL-RUNTIME-OFFLINE").milestoneProfile = "M14/FORGED"; },
  value => { value.cases.find(item => item.id === "M14-FINAL-RUNTIME-OFFLINE").resultSchema = "cadr-m14-forged-result-v1"; },
]) {
  const forged = structuredClone(policy); mutate(forged);
  assert.throws(() => validateM14EvidencePolicy(forged), /exact stable M6-M14 registry/);
}

function syntheticPolicy() {
  const value = structuredClone(policy);
  value.authorities = [];
  for (const [index, record] of value.cases.entries()) {
    const producerId = `test-producer-${String(index).padStart(2, "0")}`;
    const verifierId = `test-verifier-${String(index).padStart(2, "0")}`;
    value.authorities.push(
      { id: producerId, programSha256: hex("a"), executableSha256: hex("b"), programClosureSha256: hex("c") },
      { id: verifierId, programSha256: hex("d"), executableSha256: hex("e"), programClosureSha256: hex("f") },
    );
    record.adapterId = `test-adapter-${String(index).padStart(2, "0")}`;
    record.producerAuthorityId = producerId; record.verifierAuthorityId = verifierId;
  }
  validateM14EvidencePolicy(value); return value;
}
function syntheticRegistry(value) {
  return new Map(value.cases.map(record => [record.id, { validate: ({ envelope, result, cleanup }) => {
    assert.deepEqual(Object.keys(result).sort(), ["outcome", "schema", "witness"]);
    assert.equal(result.schema, record.resultSchema); assert.equal(result.outcome, envelope.verifier.outcome);
    assert.deepEqual(cleanup, { schema: "cadr-m14-test-cleanup-v1", state: envelope.cleanup.state });
    return { outcome: result.outcome };
  } }]));
}
function receiptFor(value, derived, caseId, { outcome = "pass", cleanupState = "verified-clean", mutate = undefined } = {}) {
  const record = value.cases.find(item => item.id === caseId);
  const producer = value.authorities.find(item => item.id === record.producerAuthorityId);
  const verifier = value.authorities.find(item => item.id === record.verifierAuthorityId);
  const resultBytes = bytes({ schema: record.resultSchema, outcome, witness: "synthetic-public-data" });
  const cleanupBytes = bytes({ schema: "cadr-m14-test-cleanup-v1", state: cleanupState });
  const envelope = { schema: "cadr-m14-evidence-receipt-v1", caseId, milestoneProfile: record.milestoneProfile,
    candidate: { logicalManifestSha256: derived.candidate.logicalManifestSha256, sourceClosureSha256: derived.candidate.source.closureSha256,
      artifactSetSha256: derived.candidate.artifacts.setSha256, toolchainSetSha256: derived.candidate.toolchain.setSha256 },
    producer: { authorityId: producer.id, programSha256: producer.programSha256, executableSha256: producer.executableSha256 },
    result: { schema: record.resultSchema, byteCount: resultBytes.byteLength, sha256: sha256(resultBytes) },
    verifier: { authorityId: verifier.id, programSha256: verifier.programSha256, executableSha256: verifier.executableSha256,
      resultSha256: sha256(resultBytes), outcome }, cleanup: { state: cleanupState, receiptSha256: sha256(cleanupBytes) } };
  mutate?.(envelope, resultBytes, cleanupBytes);
  return { id: caseId.toLowerCase(), receiptBytes: bytes(envelope), resultBytes, cleanupBytes };
}
async function admit(value, derived, receipts, registry = syntheticRegistry(value)) {
  return admitM14EvidenceReceipts({ policy: value, policySha256: sha256(bytes(value)), candidate: derived.candidate,
    candidateSha256: derived.candidateSha256, registry, receipts });
}

try {
  const built = await buildCadrM14(candidateHome);
  const manifestBytes = await readFile(resolve(candidateHome, "logical-build-manifest.json"));
  const derived = deriveM14EvidenceCandidate(manifestBytes, policy);
  assert.equal(derived.candidate.logicalManifestSha256, sha256(manifestBytes));
  assert.equal(derived.candidate.source.revision, built.manifest.buildProvenance.git.revision);
  assert.equal(derived.candidate.artifacts.records.length, built.manifest.files.length);
  assert.equal(derived.candidate.toolchain.records.length, 2);

  const zero = aggregateM14Evidence({ policy, policySha256, candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: [] });
  assert.equal(zero.releaseClaim, "none"); assert.equal(zero.outcome, "not-evaluated");
  assert.ok(zero.cases.every(item => item.state === "not-evaluated")); assert.ok(zero.gates.every(item => item.state === "not-evaluated"));
  assert.ok(zero.blockers.every(item => item.state === "unresolved"));

  const rejectedProduction = receiptFor(syntheticPolicy(), derived, "M6-READY4-THREE-BOOTS");
  await assert.rejects(admitM14EvidenceReceipts({ policy, policySha256, candidate: derived.candidate,
    candidateSha256: derived.candidateSha256, receipts: [rejectedProduction] }), /not registered/);

  const fixture = syntheticPolicy(); const pass = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  for (const [label, policyValue, policyDigest, candidateValue, candidateDigest] of [
    ["wrong policy digest", fixture, hex("0"), derived.candidate, derived.candidateSha256],
    ["wrong candidate digest", fixture, sha256(bytes(fixture)), derived.candidate, hex("9")],
    ["malformed candidate", fixture, sha256(bytes(fixture)), {}, derived.candidateSha256],
    ["candidate with extra state", fixture, sha256(bytes(fixture)), { ...derived.candidate, arbitrary: true }, derived.candidateSha256],
  ]) {
    await assert.rejects(admitM14EvidenceReceipts({ policy: policyValue, policySha256: policyDigest,
      candidate: candidateValue, candidateSha256: candidateDigest, registry: syntheticRegistry(fixture), receipts: [pass] }),
    /digest differs|missing or extra|candidate.*profile/, label);
    assert.throws(() => aggregateM14Evidence({ policy: policyValue, policySha256: policyDigest,
      candidate: candidateValue, candidateSha256: candidateDigest, admitted: [] }),
    /digest differs|missing or extra|candidate.*profile/, label);
  }
  const one = await admit(fixture, derived, [pass]);
  assert.throws(() => { one[0].result.outcome = "conformance-failure"; }, TypeError);
  assert.throws(() => { one[0].cleanupState = "failed"; }, TypeError);
  const forgedAdmitted = policy.cases.map((record, index) => ({ schema: "cadr-m14-admitted-evidence-v1",
    admissionPolicySha256: policySha256, candidateSha256: derived.candidateSha256, receiptSha256: h(`forged-${index}`),
    caseId: record.id, milestone: record.milestone, milestoneProfile: record.milestoneProfile, evidenceClass: record.evidenceClass,
    producerAuthorityId: null, verifierAuthorityId: null,
    result: { schema: record.resultSchema, byteCount: 1, sha256: h(`result-${index}`), outcome: "pass" },
    cleanupState: "verified-clean", supportsDoD: [...record.supportsDoD], resolvesBlockers: [...record.resolvesBlockers] }));
  assert.throws(() => aggregateM14Evidence({ policy, policySha256, candidate: derived.candidate,
    candidateSha256: derived.candidateSha256, admitted: forgedAdmitted }), /not created by this process admission boundary/);
  const partial = aggregateM14Evidence({ policy: fixture, policySha256: sha256(bytes(fixture)), candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: one });
  assert.equal(partial.cases.find(item => item.caseId === pass.id.toUpperCase()).state, "passed");
  assert.equal(partial.gates.find(item => item.id === "CW0").state, "partial");

  const mutationReceipt = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { outcome: "conformance-failure", cleanupState: "failed" });
  const mutationRegistry = syntheticRegistry(fixture);
  mutationRegistry.set("M6-READY4-THREE-BOOTS", { validate: input => {
    for (const mutate of [
      () => { input.envelope.verifier.outcome = "pass"; },
      () => { input.envelope.cleanup.state = "verified-clean"; },
      () => { input.envelope.result.sha256 = hex("0"); },
      () => { input.candidate.source.closureSha256 = hex("0"); },
    ]) assert.throws(mutate, TypeError);
    return { outcome: "pass" };
  } });
  await assert.rejects(admit(fixture, derived, [mutationReceipt], mutationRegistry), /adapter outcome differs from verifier outcome/);

  for (const [outcome, expected] of [["infrastructure-failure", "not-evaluated"], ["incomplete", "not-evaluated"], ["conformance-failure", "failed"]]) {
    const records = await admit(fixture, derived, [receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { outcome })]);
    const aggregation = aggregateM14Evidence({ policy: fixture, policySha256: sha256(bytes(fixture)), candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: records });
    assert.equal(aggregation.cases.find(item => item.caseId === "M6-READY4-THREE-BOOTS").state, expected);
  }
  const cleanupFailure = await admit(fixture, derived, [receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { cleanupState: "failed" })]);
  assert.equal(aggregateM14Evidence({ policy: fixture, policySha256: sha256(bytes(fixture)), candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: cleanupFailure }).cases[0].state, "failed");
  await assert.rejects(admit(fixture, derived, [receiptFor(fixture, derived, "M14-FINAL-RUNTIME-OFFLINE",
    { cleanupState: "verified-forced-test-termination" })]), /cleanup state is not permitted by its case policy/);

  for (const candidateField of ["logicalManifestSha256", "sourceClosureSha256", "artifactSetSha256", "toolchainSetSha256"]) {
    const forged = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { mutate: envelope => { envelope.candidate[candidateField] = hex("0"); } });
    await assert.rejects(admit(fixture, derived, [forged]), /candidate binding differs/);
  }
  for (const mutate of [
    envelope => { envelope.producer.authorityId = "forged"; },
    envelope => { envelope.producer.programSha256 = hex("0"); },
    envelope => { envelope.verifier.executableSha256 = hex("0"); },
    envelope => { envelope.result.schema = "wrong-schema"; },
  ]) await assert.rejects(admit(fixture, derived, [receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { mutate })]), /identity differs|profile or result schema differs/);
  const dependent = syntheticPolicy(); dependent.authorities.find(item => item.id === dependent.cases[0].verifierAuthorityId).programClosureSha256 = hex("c");
  await assert.rejects(admit(dependent, derived, [receiptFor(dependent, derived, "M6-READY4-THREE-BOOTS")]), /not independent/);

  const mutatedResult = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  mutatedResult.resultBytes = bytes({ schema: fixture.cases[0].resultSchema, outcome: "pass", witness: "mutated" });
  await assert.rejects(admit(fixture, derived, [mutatedResult]), /retained result bytes differ/);
  await assert.rejects(admit(fixture, derived, [pass, { ...pass, id: "same-bytes" }]), /duplicates an exact receipt/);
  await assert.rejects(admit(fixture, derived, [pass, receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { outcome: "conformance-failure" })]), /conflicting attempts/);
  const extra = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  extra.receiptBytes = bytes({ ...JSON.parse(extra.receiptBytes), extra: true });
  await assert.rejects(admit(fixture, derived, [extra]), /missing or extra/);
  const noncanonical = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  noncanonical.receiptBytes = Buffer.from(`${JSON.stringify(JSON.parse(noncanonical.receiptBytes), null, 2)}\n`);
  await assert.rejects(admit(fixture, derived, [noncanonical]), /canonical JSON/);
  const getter = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  Object.defineProperty(getter, "id", { enumerable: true, get: () => "getter" });
  await assert.rejects(admit(fixture, derived, [getter]), /ordinary enumerable data property/);
  const privateLeak = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS", { mutate: envelope => { envelope.caseId = "/private/receipt"; } });
  await assert.rejects(admit(fixture, derived, [privateLeak]), /private or machine absolute path/);

  const allPass = await admit(fixture, derived, fixture.cases.map(record => receiptFor(fixture, derived, record.id)));
  const allPassAggregation = aggregateM14Evidence({ policy: fixture, policySha256: sha256(bytes(fixture)), candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: allPass });
  assert.equal(allPassAggregation.outcome, "all-gates-passed-release-claim-disabled"); assert.equal(allPassAggregation.releaseClaim, "none"); assert.equal(allPassAggregation.browserRows, "not-evaluated");
  assert.deepEqual(allPassAggregation, aggregateM14Evidence({ policy: fixture, policySha256: sha256(bytes(fixture)), candidate: derived.candidate, candidateSha256: derived.candidateSha256, admitted: [...allPass].reverse() }));

  await mkdir(receiptHome, { recursive: true }); await mkdir(cliHome, { recursive: true });
  const zeroCli = spawnSync("node", ["scripts/cadr-m14-evidence.mjs", "--manifest", resolve(candidateHome, "logical-build-manifest.json"),
    "--receipts", receiptHome, "--output", resolve(cliHome, "zero.json")], { cwd: repo, encoding: "utf8" });
  assert.equal(zeroCli.status, 0, zeroCli.stderr); assert.equal(JSON.parse(await readFile(resolve(cliHome, "zero.json"))).releaseClaim, "none");
  const supplied = receiptFor(fixture, derived, "M6-READY4-THREE-BOOTS");
  await writeFile(resolve(receiptHome, "sample.receipt.json"), supplied.receiptBytes); await writeFile(resolve(receiptHome, "sample.result.json"), supplied.resultBytes); await writeFile(resolve(receiptHome, "sample.cleanup.json"), supplied.cleanupBytes);
  const productionCli = spawnSync("node", ["scripts/cadr-m14-evidence.mjs", "--manifest", resolve(candidateHome, "logical-build-manifest.json"),
    "--receipts", receiptHome, "--output", resolve(cliHome, "rejected.json")], { cwd: repo, encoding: "utf8" });
  assert.notEqual(productionCli.status, 0); assert.match(productionCli.stderr, /not registered/);
  await rm(resolve(receiptHome, "sample.receipt.json")); await rm(resolve(receiptHome, "sample.result.json")); await rm(resolve(receiptHome, "sample.cleanup.json"));
  await symlink("/tmp", resolve(receiptHome, "escape.receipt.json"));
  const symlinkCli = spawnSync("node", ["scripts/cadr-m14-evidence.mjs", "--manifest", resolve(candidateHome, "logical-build-manifest.json"),
    "--receipts", receiptHome, "--output", resolve(cliHome, "symlink.json")], { cwd: repo, encoding: "utf8" });
  assert.notEqual(symlinkCli.status, 0); assert.match(symlinkCli.stderr, /regular receipt/);
  await rm(resolve(receiptHome, "escape.receipt.json"));
  const traversalCli = spawnSync("node", ["scripts/cadr-m14-evidence.mjs", "--manifest", "/tmp/not-a-manifest", "--receipts", receiptHome,
    "--output", resolve(cliHome, "traversal.json")], { cwd: repo, encoding: "utf8" });
  assert.notEqual(traversalCli.status, 0); assert.match(traversalCli.stderr, /confinement|escapes|private/);
} finally {
  await rm(candidateHome, { recursive: true, force: true }); await rm(`${candidateHome}.cdrm14`, { force: true });
  await rm(receiptHome, { recursive: true, force: true }); await rm(cliHome, { recursive: true, force: true });
}
