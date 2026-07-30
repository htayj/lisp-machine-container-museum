import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyM6DiagnosticDelta,
  buildM6DiagnosticIsolated,
  revalidateM6DiagnosticIsolated,
} from "../scripts/build-cadr-m6-diagnostic-isolated.mjs";

const receiptBase = process.env.CADR_M6_DIAGNOSTIC_RECEIPT_BASE ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
await assert.rejects(() => buildM6DiagnosticIsolated(), /requires --receipt-base/,
  "the diagnostic builder cannot archive the mutable index");
const build = await buildM6DiagnosticIsolated({ receiptBase });
try {
  assert.equal(build.receipt_bound_base, receiptBase);
  assert.equal(build.schema, "cadr-m6-isolated-diagnostic-build-v3");
  assert.deepEqual(build.diagnostic_deltas.map(delta => delta.path), [
    "cadr-web/oracle/patches/0004-m6-postterminal-diagnostic.patch",
    "cadr-web/oracle/patches/0005-m6-receipt-bound-diagnostic.patch",
  ], "the base-owned diagnostic deltas are recorded in apply order");
  assert.equal(build.diagnostic_deltas[0].sha256,
    "35d690d33a4ee815f476b7893c31276f50f7f34c90709fb61aca65b418d5d2fd",
    "the historical postterminal delta retains its frozen evidence identity");
  await revalidateM6DiagnosticIsolated(build);
  const escaped = resolve(build.stage_directory, "..", "cadr-m6-delta-escaped-sentinel");
  const traversalPatch = Buffer.from("diff --git a/../cadr-m6-delta-escaped-sentinel b/../cadr-m6-delta-escaped-sentinel\n" +
    "new file mode 100644\nindex 0000000..587be6b\n--- /dev/null\n" +
    "+++ b/../cadr-m6-delta-escaped-sentinel\n@@ -0,0 +1 @@\n+unsafe\n");
  await assert.rejects(() => Promise.resolve().then(() =>
    applyM6DiagnosticDelta(build.stage_directory, traversalPatch)), /unsafe path|outside a repository|invalid path/i,
  "the isolated delta seam rejects a valid traversal patch without --unsafe-paths");
  await assert.rejects(() => stat(escaped), /ENOENT/,
    "the rejected traversal patch did not create its outside sentinel");

  for (const name of ["wasm", "worker", "headless", "diagnostic_runner"]) {
    const path = build[name].path;
    const original = await readFile(path);
    await writeFile(path, Buffer.concat([original, Buffer.from([0])]), { flag: "w" });
    await assert.rejects(() => revalidateM6DiagnosticIsolated(build), /changed after build/,
      `revalidation detects a mutated ${name}`);
    await writeFile(path, original, { flag: "w" });
    await revalidateM6DiagnosticIsolated(build);
  }
  const launcherCopy = resolve(build.stage_directory, "private-launcher.mjs");
  const launcherBytes = await readFile(build.launcher.path);
  const launcherRecord = Object.freeze({ ...build, launcher: Object.freeze({
    path: launcherCopy, sha256: build.launcher.sha256,
  }) });
  await writeFile(launcherCopy, launcherBytes, { flag: "wx" });
  await revalidateM6DiagnosticIsolated(launcherRecord);
  await writeFile(launcherCopy, Buffer.concat([launcherBytes, Buffer.from([0])]), { flag: "w" });
  await assert.rejects(() => revalidateM6DiagnosticIsolated(launcherRecord), /changed after build/,
    "revalidation detects a mutated launcher copy");
  await writeFile(launcherCopy, launcherBytes, { flag: "w" });

  const staged = await import(pathToFileURL(build.diagnostic_runner.path).href);
  const rehashed = await staged.rehashClosedBuild(build);
  assert.deepEqual(Object.keys(rehashed).sort(),
    ["diagnostic_runner", "headless", "wasm", "worker"],
    "the actual staged runner accepts and revalidates the v3 receipt-bound record");
  const { diagnostic_deltas, receipt_bound_base, ...legacyFields } = build;
  await assert.rejects(() => staged.rehashClosedBuild(Object.freeze({
    ...legacyFields,
    diagnostic_delta_sha256: diagnostic_deltas[0].sha256,
    schema: "cadr-m6-isolated-diagnostic-build-v2",
  })), /closed build record/,
  "the staged runner refuses the pre-receipt v2 key set instead of silently weakening it");
  await assert.rejects(() => staged.rehashClosedBuild(Object.freeze({
    ...build, receipt_bound_base: "0".repeat(39),
  })), /closed build record/,
  "the staged runner rejects a malformed receipt-bound base");
  await assert.rejects(() => staged.rehashClosedBuild(Object.freeze({
    ...build, diagnostic_deltas: Object.freeze([...diagnostic_deltas].reverse()),
  })), /ordered diagnostic delta identities/,
  "the staged runner rejects reordered otherwise-valid delta identities");
  await assert.rejects(() => revalidateM6DiagnosticIsolated(Object.freeze({
    ...build, receipt_bound_base: "0".repeat(40),
  })), /receipt base/,
  "outer revalidation resolves the named receipt base and rejects a substituted full hash");
  const report = Object.freeze({
    reason: "terminal-machine-status", status: 12,
    runFraming: Object.freeze({ operation: "run-digest-batch-m5", terminalStatus: 12,
      cachedLastCompleteBoundary: 9n }),
  });
  const post = Object.freeze({ lastCompleteBoundary: 9n });
  const diagnostic = Object.freeze({
    attempted_boundary: "9", canonical_overflowed: false, completion_queued: 0,
    cpu_guest_fault: false, current_bus_irq: 5, current_disk_status: 77,
    current_transfer_reset_enables: 14,
    disk_evidence: Object.freeze({ capacity: 512, count: 512, overflowed: true,
      have_last: true, last_observed_attempt_slot: "9", next_sequence: "512",
      observed_after: Object.freeze({ bus_irq: 5, completion_queued: 0,
        operation: 0, status: 13, transfer_reset_enables: 14 }) }),
    lifecycle: 3, outstanding_operation: 0, persistent_status: 12,
    trace: Object.freeze({ active: false }), unexpected_bus_operation: 0,
  });
  assert.equal(staged.overflowDisposition(report, post, diagnostic),
    "disk-evidence-capacity-exhaustion-guest-fault-observed");
  const variants = [
    ["canonical overflow", { canonical_overflowed: true }],
    ["cpu fault", { cpu_guest_fault: true }],
    ["unexpected bus", { unexpected_bus_operation: 1 }],
    ["missing last", { disk_evidence: { ...diagnostic.disk_evidence, have_last: false } }],
    ["sequence mismatch", { disk_evidence: { ...diagnostic.disk_evidence, next_sequence: "513" } }],
    ["boundary mismatch", { attempted_boundary: "8" }],
    ["last slot mismatch", { disk_evidence: { ...diagnostic.disk_evidence, last_observed_attempt_slot: "8" } }],
    ["outstanding mismatch", { outstanding_operation: 1 }],
    ["completion mismatch", { completion_queued: 1 }],
    ["observed operation mismatch", { disk_evidence: { ...diagnostic.disk_evidence,
      observed_after: { ...diagnostic.disk_evidence.observed_after, operation: 1 } } }],
    ["observed completion mismatch", { disk_evidence: { ...diagnostic.disk_evidence,
      observed_after: { ...diagnostic.disk_evidence.observed_after, completion_queued: 1 } } }],
    ["overflow missing", { disk_evidence: { ...diagnostic.disk_evidence, overflowed: false } }],
    ["capacity count mismatch", { disk_evidence: { ...diagnostic.disk_evidence, count: 511 } }],
    ["lifecycle mismatch", { lifecycle: 2 }],
    ["persistent mismatch", { persistent_status: 13 }],
    ["disk status mismatch", { current_disk_status: 76 }],
    ["transfer mismatch", { current_transfer_reset_enables: 2 }],
    ["irq mismatch", { current_bus_irq: 6 }],
    ["trace active", { trace: { active: true } }],
  ];
  for (const [name, change] of variants) {
    const candidate = Object.freeze({ ...diagnostic, ...change });
    assert.equal(staged.overflowDisposition(report, post, candidate),
      "terminal-cause-not-attributed", name);
  }
  for (const [name, changedReport] of [
    ["reason", { ...report, reason: "other" }],
    ["operation", { ...report, runFraming: { ...report.runFraming, operation: "other" } }],
    ["status", { ...report, status: 13 }],
    ["framing status", { ...report, runFraming: { ...report.runFraming, terminalStatus: 13 } }],
  ]) {
    assert.equal(staged.overflowDisposition(changedReport, post, diagnostic),
      "terminal-cause-not-attributed", name);
  }

  const closed = [];
  await assert.rejects(() => staged.disposeDiagnosticResources({
    client: { async close() { closed.push("worker"); throw new Error("worker close"); } },
    artifacts: { async close() { closed.push("artifacts"); } },
    removeStage: async () => { closed.push("stage"); },
  }), /worker close/);
  assert.deepEqual(closed, ["worker", "artifacts", "stage"],
    "cleanup continues through artifact close and stage removal after worker close fails");
  console.log("cadr_m6_diagnostic_launcher: ok");
} finally {
  await rm(build.stage_directory, { recursive: true, force: true });
}
