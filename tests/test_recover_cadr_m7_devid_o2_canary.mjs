import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EXPECTED, RECOVERY_TOOL_MODULE_PATHS,
  assertRecoveredM7ReceiptMatchesRawBuffers, canonicalJson,
  deriveM7RecoveryReceiptFromRawBuffers, identity,
} from "../scripts/cadr-m7-devid-o2-recovery-core.mjs";
import {
  deriveM7RecoveryReceiptFromRetainedRaw, parseRecoveryInvocation,
  verifyRecoveredM7DevidCanaryReceipt,
} from "../scripts/recover-cadr-m7-devid-o2-canary.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const recoveryDirectory = resolve(root, "build/cadr-oracle/m7-devid-p4-776a427");
const rawEnvelopePath = resolve(recoveryDirectory,
  ".8cdaef46c7a239112b4352d01fb06c87.m7-canary-envelope.json");
const rawFailurePath = resolve(recoveryDirectory, "final-receipt.json.failure.json");
const recoveryTool = resolve(root, "scripts/recover-cadr-m7-devid-o2-canary.mjs");
const recoveryCore = resolve(root, "scripts/cadr-m7-devid-o2-recovery-core.mjs");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const rawEnvelopeBytes = await readFile(rawEnvelopePath);
const rawFailureBytes = await readFile(rawFailurePath);
const raw = Object.freeze({ envelopeBytes: rawEnvelopeBytes,
  outerFailureBytes: rawFailureBytes });
assert.deepEqual(identity(rawEnvelopeBytes), EXPECTED.envelope);
assert.deepEqual(identity(rawFailureBytes), EXPECTED.outerFailure);

assert.throws(() => parseRecoveryInvocation([]), /No recovery is implicit/);
assert.throws(() => parseRecoveryInvocation(["--execute", "--output", "x"]), /No recovery is implicit/);
assert.throws(() => parseRecoveryInvocation([
  "--execute", "--recovery-tool-commit", "0".repeat(40),
  "--recovery-tool-commit", "1".repeat(40), "--output", "x",
]), /duplicate/);

const syntheticTool = Object.freeze({
  commit: EXPECTED.candidate,
  modules: Object.freeze(RECOVERY_TOOL_MODULE_PATHS.map((path, index) => Object.freeze({ path,
    identity: Object.freeze({ byte_count: index + 1, sha256: String(index).repeat(64) }),
  }))),
});
const recovered = deriveM7RecoveryReceiptFromRawBuffers({ ...raw, recoveryTool: syntheticTool });
assert.equal(recovered.outcome, "recovered-final-receipt");
assert.deepEqual(assertRecoveredM7ReceiptMatchesRawBuffers(recovered, raw, syntheticTool), recovered,
  "a recovery receipt is accepted only when it exactly equals a raw derivation");
assert.equal(canonicalJson(recovered), canonicalJson(deriveM7RecoveryReceiptFromRawBuffers({
  ...raw, recoveryTool: syntheticTool,
})), "the raw derivation is canonical and deterministic");
const retainedDerivation = await deriveM7RecoveryReceiptFromRetainedRaw(syntheticTool);
assert.deepEqual(retainedDerivation.receipt, recovered,
  "the secure retained-read path recomputes the corrected 81a closure and faulty 26bb closure before returning");

function rawDerivedRejects(label, mutate) {
  const candidate = structuredClone(recovered);
  mutate(candidate);
  assert.throws(() => assertRecoveredM7ReceiptMatchesRawBuffers(candidate, raw, syntheticTool),
    /raw-derived canonical record/, label);
}

/* Every mutation below remains internally coordinated where the receipt
 * repeats the fact. Exact comparison to a fresh raw derivation rejects the
 * synchronized forgery rather than merely relying on one cross-field check. */
rawDerivedRejects("unit mutations in both copies are rejected", value => {
  const unit = `cadr-m7-devid-o2-canary-${"a".repeat(32)}.service`;
  value.source_evidence.unit = unit;
  value.reconstructed_final_receipt.supervision.unit = unit;
});
rawDerivedRejects("accounting mutations in both copies are rejected", value => {
  value.source_evidence.systemd_accounting.MemoryMax = "1";
  value.reconstructed_final_receipt.systemd_accounting.MemoryMax = "1";
});
rawDerivedRejects("guest completion mutations are rejected", value => {
  value.reconstructed_final_receipt.canary.machine.persistentStatus = 12;
  value.reconstructed_final_receipt.canary.machine.lifecycle = 3;
});
rawDerivedRejects("all gate copies cannot be rewritten", value => {
  for (const gate of value.reconstructed_final_receipt.frozen_stage_gates) {
    gate.elapsed_ns = "1";
  }
});
rawDerivedRejects("both launcher identities cannot be coordinated away", value => {
  const changed = "f".repeat(64);
  value.reconstructed_final_receipt.outer_launcher_at_start.sha256 = changed;
  value.reconstructed_final_receipt.outer_launcher_at_end.sha256 = changed;
});
rawDerivedRejects("both toolchain copies cannot be coordinated away", value => {
  const changed = "e".repeat(64);
  for (const toolchain of [value.reconstructed_final_receipt.toolchain_at_start,
    value.reconstructed_final_receipt.toolchain_at_end]) {
    toolchain.node_executable.sha256 = changed;
  }
});
rawDerivedRejects("candidate control-plane mutations are rejected", value => {
  value.reconstructed_final_receipt.candidate_control_plane[0].sha256 = "d".repeat(64);
});
rawDerivedRejects("all frozen-release artifact copies cannot be rewritten", value => {
  for (const artifacts of [value.reconstructed_final_receipt.frozen_release.artifacts,
    value.reconstructed_final_receipt.canary.artifacts_before,
    value.reconstructed_final_receipt.canary.artifacts_after,
    value.reconstructed_final_receipt.canary.private_artifacts_before,
    value.reconstructed_final_receipt.canary.private_artifacts_after]) {
    artifacts[0].sha256 = "c".repeat(64);
  }
});
rawDerivedRejects("a pure helper mutation is bound even when the top module is unchanged", value => {
  assert.equal(value.recovery_tool.modules[0].path, RECOVERY_TOOL_MODULE_PATHS[0]);
  value.recovery_tool.modules[1].identity.sha256 = "b".repeat(64);
});

function rawMutationRejects(label, mutateEnvelope, mutateFailure) {
  const envelope = JSON.parse(rawEnvelopeBytes.toString("utf8"));
  const failure = JSON.parse(rawFailureBytes.toString("utf8"));
  mutateEnvelope?.(envelope); mutateFailure?.(failure);
  assert.throws(() => deriveM7RecoveryReceiptFromRawBuffers({
    envelopeBytes: Buffer.from(canonicalJson(envelope), "utf8"),
    outerFailureBytes: Buffer.from(canonicalJson(failure), "utf8"), recoveryTool: syntheticTool,
  }), /identity differs/, label);
}
rawMutationRejects("raw coordinated unit mutation is identity-bound", value => {
  value.receipt.supervision.unit = `cadr-m7-devid-o2-canary-${"f".repeat(32)}.service`;
}, value => { value.unit = `cadr-m7-devid-o2-canary-${"f".repeat(32)}.service`; });
rawMutationRejects("raw coordinated accounting mutation is identity-bound", null, value => {
  value.systemd_accounting.MemoryMax = "1";
});

await assert.rejects(verifyRecoveredM7DevidCanaryReceipt(recovered),
  /recovery closure module|Command failed/,
  "the uncommitted closure cannot perform recovery before an exact commit exists");

const sourceText = await readFile(recoveryTool, "utf8");
const coreText = await readFile(recoveryCore, "utf8");
assert.doesNotMatch(sourceText, /from "\.\/run-cadr-|systemd-run|systemctl|runSystemdCanary|run-cadr-m7-frame-conformance/,
  "the recovery entry point imports no canary, systemd, or guest driver");
assert.match(sourceText, /from "\.\/cadr-m7-devid-o2-recovery-core\.mjs"/,
  "the only local ESM dependency is the pure recovery core");
assert.doesNotMatch(coreText, /from "node:(?:child_process|fs|net|http)"|from "\.\//,
  "the recovery core has no process, filesystem, network, or local executable-module capability");
assert.deepEqual(RECOVERY_TOOL_MODULE_PATHS, [
  "scripts/recover-cadr-m7-devid-o2-canary.mjs",
  "scripts/cadr-m7-devid-o2-recovery-core.mjs",
], "the immutable local ESM closure has an explicit order");

const spyDirectory = resolve(recoveryDirectory, ".m7-recovery-command-spy");
const spyLog = resolve(spyDirectory, "called.log");
await rm(spyDirectory, { recursive: true, force: true });
await mkdir(spyDirectory, { mode: 0o700 }); await chmod(spyDirectory, 0o700);
for (const name of ["systemd-run", "systemctl", "usim", "vlm", "Xvfb"]) {
  await writeFile(resolve(spyDirectory, name), `#!/bin/sh\necho ${name} >> ${JSON.stringify(spyLog)}\nexit 97\n`,
    { mode: 0o700 });
}
try {
  const probe = [
    "import { readFile } from 'node:fs/promises';",
    `import { deriveM7RecoveryReceiptFromRawBuffers } from ${JSON.stringify(pathToFileURL(recoveryCore).href)};`,
    `const e = await readFile(${JSON.stringify(rawEnvelopePath)});`,
    `const f = await readFile(${JSON.stringify(rawFailurePath)});`,
    `const tool = ${JSON.stringify(syntheticTool)};`,
    "const r = deriveM7RecoveryReceiptFromRawBuffers({ envelopeBytes: e, outerFailureBytes: f, recoveryTool: tool });",
    "if (r.outcome !== 'recovered-final-receipt') process.exit(99);",
  ].join("\n");
  const run = spawnSync(process.execPath, ["--input-type=module", "--eval", probe], {
    cwd: root, encoding: "utf8", env: { ...process.env, PATH: `${spyDirectory}:${process.env.PATH}` },
  });
  assert.equal(run.status, 0, run.stderr);
  await assert.rejects(lstat(spyLog), error => error?.code === "ENOENT",
    "a successful raw-derived recovery probe invokes no system manager or guest executable");
} finally {
  await rm(spyDirectory, { recursive: true, force: true });
}
assert.deepEqual([sha256(await readFile(rawEnvelopePath)), sha256(await readFile(rawFailurePath))],
  [EXPECTED.envelope.sha256, EXPECTED.outerFailure.sha256],
  "all pre/post raw-derived and mutation checks leave the retained witnesses byte-identical");

console.log("offline M7-DEVID recovery validation tests passed");
