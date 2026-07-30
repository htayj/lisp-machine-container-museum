import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateCompositionReport } from "../scripts/run-cadr-m13-f06-f07-composition.mjs";

const hash = "a".repeat(64);
const receipt = Object.freeze({ archive_sha256: hash, generation: "0",
  entry_count: "0", root_sha256: hash });
const caseRecord = (name, {
  after = "CLEAN", replacement = 0, statuses = [], lost = false,
} = {}) => Object.freeze({ name, error: "injected fault", cleanup: "deleted-disposable-indexeddb-disk",
  state: { before: "CLEAN", after, recovered: "CLEAN" },
  active_receipt: { before: receipt, after: receipt, recovered: receipt },
  completion: { accepted_count: statuses.length, pending_after: false,
    response_lost: lost, statuses }, replace_worker_count: replacement });

const report = Object.freeze({
  schema: "cadr-m13-f06-f07-composition-v1",
  profile: "CADR-WEB-303 selected M12 O2 plus C-M10-IDB-v1",
  limitation: "This is not a C-M13 completion claim.",
  base: { bytes: 269562880,
    sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
    pre_sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
    post_sha256: "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5" },
  browser: { product: "Chromium", user_agent: "test" },
  selected_wasm: { sha256: hash,
    exports: ["cadr_wasm_host_next_request", "cadr_wasm_m12_config_snapshot_save"],
    pre: { machine_sha256: hash, debug_sha256: hash, audio_sha256: hash,
      config_sha256: hash, host_next_status: 9 },
    post: { machine_sha256: hash, debug_sha256: hash, audio_sha256: hash,
      config_sha256: hash, host_next_status: 9 } },
  source_artifacts: { indexeddb_sha256: hash, controller_sha256: hash,
    persistence_sha256: hash },
  worker_protocol: { bridge: "createCadrM10WorkerDiskBridge",
    request_kind: "one exact M4 block-write request" },
  cases: [
    caseRecord("f06-pre-guest-stage-failure", { statuses: [1] }),
    caseRecord("f06-post-completion-publication-failure", { after: "IN_DOUBT", replacement: 1, statuses: [0] }),
    caseRecord("f07-host-completion-response-loss", { after: "IN_DOUBT", replacement: 1, statuses: [0], lost: true }),
    caseRecord("f07-foreign-binding-rejected"),
  ],
});

assert.equal(validateCompositionReport(report, { selectedWasmSha256: hash }), true);
const altered = structuredClone(report);
altered.cases[1].active_receipt.after = { ...receipt, generation: "1" };
assert.throws(() => validateCompositionReport(altered, { selectedWasmSha256: hash }),
  /partially changed its active durable receipt/);

const runner = await readFile(new URL("../scripts/run-cadr-m13-f06-f07-composition.mjs", import.meta.url), "utf8");
for (const text of [
  "before-stage", "before-head-activation", "createCadrM10WorkerDiskBridge",
  "synthetic host-complete response lost after guest acceptance",
  "does not load the M13 shell or its composite dispatch",
  "not a C-M13 completion claim", "--execute",
]) assert.match(runner, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(runner, /cadr-m13-shell\.mjs/,
  "the isolated composition probe must not rewrite or load the incomplete shared M13 shell");

process.stdout.write("C-M13 F06/F07 composition runner static receipt tests passed\n");
