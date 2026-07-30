import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "build", `cadr-m13-f03-runner-${process.pid}`);
assert.equal(existsSync(output), false, "the exact disposable build child must be absent");
try {
  const result = spawnSync("guix", ["shell", "clang-toolchain", "--", "node",
    "scripts/run-cadr-m13-f03-sanitizer.mjs", "--execute", "--output", output],
    { cwd: root, encoding: "utf8", timeout: 240000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(resolve(output, "report.json"), "utf8"));
  assert.equal(report.schema, "cadr-m13-f03-sanitizer-report-v1");
  assert.equal(report.disposition, "passed-native-f03-only");
  assert.equal(report.claim.c_m13, "open");
  assert.ok(report.campaign.scenarios.every(entry =>
    entry.scenario === "audio-snapshot" || entry.scenario === "m12-config" || entry.injections.length === entry.allocation_count));
  assert.ok(report.source.native_allocation_points.length > 0);
  assert.deepEqual(report.source.native_allocation_expectation, {
    mode: "clang-E-active-profile-source-locations-v1",
    profile_defines: ["-DCADR_M7_CORE", "-DCADR_M9_CORE", "-DCADR_M11_CORE", "-DCADR_M12_CORE"],
    selected_sources: [
      "cadr-web/core/cadr_core.c", "cadr-web/core/cadr_snapshot.c",
      "cadr-web/core/cadr_state_v2.c", "cadr-web/core/cadr_m4_media.c",
      "cadr-web/trace/cadr_trace_engine.c",
    ],
  });
  process.stdout.write("M13-F03 sanitizer runner tests passed\n");
} finally {
  rmSync(output, { recursive: true, force: true });
}
