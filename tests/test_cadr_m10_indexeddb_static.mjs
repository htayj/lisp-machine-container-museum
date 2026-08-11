import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CADR_M10_INDEXEDDB_DURABILITY,
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_SCHEMA,
  CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS,
  CADR_M10_INDEXEDDB_STORES,
  CADR_M10_INDEXEDDB_PREFIX,
} from "../cadr-web/browser/cadr-m10-indexeddb.mjs";

assert.deepEqual(CADR_M10_INDEXEDDB_DURABLE_SEAMS, [
  "before-stage", "after-stage", "before-head-activation",
  "after-head-activation", "before-reread-head", "after-reread-head",
]);
assert.deepEqual(CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS, [
  "stage-transaction-outstanding", "head-transaction-outstanding",
]);
assert.equal(CADR_M10_INDEXEDDB_PREFIX, "cadr-m10-indexeddb-v1");
assert.equal(CADR_M10_INDEXEDDB_SCHEMA, 3);
assert.equal(CADR_M10_INDEXEDDB_DURABILITY, "strict");
assert.deepEqual(Object.keys(CADR_M10_INDEXEDDB_STORES), [
  "meta", "pages", "nodes", "manifests", "heads", "activations", "quarantine", "refs",
]);
const adapter = await readFile(new URL("../cadr-web/browser/cadr-m10-indexeddb.mjs", import.meta.url), "utf8");
assert.match(adapter, /one IndexedDB database per disk UUID/);
assert.match(adapter, /head plus activation/);
assert.match(adapter, /QuotaExceededError/);
assert.match(adapter, /onversionchange/);
assert.match(adapter, /getAll\(undefined, CADR_M10_MAX_ACTIVATION_RECORDS \+ 1\)/);
assert.match(adapter, /database schema stores differ/);
assert.match(adapter, /keyPath "key", autoIncrement false, and zero indexes/);
assert.match(adapter, /pendingGeneration: 0n, pendingSession: 0n/);
assert.match(adapter, /refHighWater: 0n/);
assert.match(adapter, /stores differ before migration/);
assert.match(adapter, /migrateV1Meta/);
assert.match(adapter, /migrateV2Meta/);
assert.match(adapter, /schema-2 root reference/);
assert.match(adapter, /creatorSession/);
assert.match(adapter, /function rootReferenceKey\(key, sequence\)/);
assert.match(adapter, /function rootReferenceV2Key\(key, kind, sequence\)/);
assert.match(adapter, /kind-bearing cleanup IDs/);
assert.match(adapter, /schema-2 root references require explicit owner reconciliation/);
assert.match(adapter, /sequence collides across kinds/);
assert.match(adapter, /beginReopenSession/);
assert.match(adapter, /Purge every older-session snapshot/);
assert.match(adapter, /durable idempotence key/);
assert.match(adapter, /assertIssuedRootReference/);
assert.match(adapter, /async pinRoot\(kind, exactRoot = undefined\)/);
assert.match(adapter, /async unpinRoot\(id\)/);
assert.match(adapter, /root references changed after compaction mark/);
assert.match(adapter, /CADR_M10_INDEXEDDB_STORES\.refs/);
assert.match(adapter, /compaction writer epoch changed after mark/);
assert.match(adapter, /active head\/root changed after compaction mark/);
assert.match(adapter, /activation outer fields differ from encoded head/);
assert.match(adapter, /strict IndexedDB transaction durability is unavailable/);
assert.equal((adapter.match(/\bdb\.transaction\(/g) ?? []).length, 3,
  "adapter may bypass the strict-durability factory only for schema inspection");
assert.match(adapter, /const schemaTransaction = db\.transaction\(expected, "readonly"\)/);
const campaign = await readFile(new URL("../cadr-web/browser/cadr-m10-indexeddb-campaign.mjs", import.meta.url), "utf8");
assert.match(campaign, /\["abort", "terminate", "reload"\]/);
assert.match(campaign, /state\.version !== 4/);
assert.match(campaign, /same-origin foreign UUID full-store inventory changed/);
assert.match(campaign, /foreign-origin IndexedDB reopened state changed/);
assert.match(campaign, /follow-up writer did not safely clear and replace/);
assert.match(campaign, /closed handle changed durable writer\/generation metadata/);
assert.match(campaign, /\["missing", "extra", "wrong-keypath", "auto-increment", "indexed"\]/);
assert.match(campaign, /malformed high-sequence activation was not quarantined exactly/);
assert.match(campaign, /4096-record boundary/);
assert.match(campaign, /durable compaction did not remove only unreachable/);
assert.match(campaign, /compaction did not reject a head changed after mark/);
assert.match(campaign, /schema-1 migration changed the selected overlay/);
assert.match(campaign, /empty schema-2 migration did not preserve exact controls without manufacturing refs/);
assert.match(campaign, /empty schema-2 migration changed the selected immutable overlay closure/);
assert.match(campaign, /schema-2 mixed retained refs were silently rewritten and orphaned owner IDs/);
assert.match(campaign, /schema-2 duplicate cross-kind sequence was not rejected before any key-space collapse/);
assert.match(campaign, /schema-2 malformed root-reference key was accepted during upgrade/);
assert.match(campaign, /a kind-forged missing root-reference ID was accepted as an idempotent release/);
assert.match(campaign, /durable root-reference identifier was reused after release/);
assert.match(campaign, /fresh session retained a process-lost transient snapshot reference/);
assert.match(campaign, /future root-reference identifier was accepted as an idempotent release/);
assert.match(campaign, /failed root-reference publication committed its high-water update/);
assert.match(campaign, /review acquisition accepted root\/session change after await/);
assert.match(campaign, /concurrent review release calls did not share a flight/);
assert.match(campaign, /failed review release did not remain release-required/);
assert.match(campaign, /idempotent durable unpin did not close a post-commit report-loss retry/);
assert.match(campaign, /branded authority recovery did not issue exactly one replacement snapshot pin/);
assert.match(campaign, /opaqueReferenceMigration: true/);
assert.match(campaign, /crossKindReferenceForgery: true/);
const runner = await readFile(new URL("../scripts/run-cadr-m10-indexeddb-browser.mjs", import.meta.url), "utf8");
assert.match(runner, /--remote-debugging-port=0/);
assert.match(runner, /exact HTTP allowlist/);
assert.match(runner, /initial execution context is being replaced by navigation/);
assert.match(runner, /typeof evaluated\.result\?\.value !== "string"/);
assert.match(runner, /opaqueReferenceMigration/);
assert.match(runner, /crossKindReferenceForgery/);
assert.match(runner, /connectBoundedCdp/);
assert.match(runner, /CadrProcessGroupSupervisor/);
assert.match(runner, /detached: true/);
assert.match(runner, /processGroups\.stop\(browser, "SIGTERM"\)/);
assert.match(runner, /processGroups\.stopAll\("SIGKILL"\)/);
assert.doesNotMatch(runner, /createReadStream|stat\(|9228/);
const cdpClient = await readFile(new URL(
  "../scripts/cadr-cdp-client.mjs", import.meta.url), "utf8");
assert.match(cdpClient, /rejectAll\(disconnectedError\("failed"\)\)/);
assert.match(cdpClient, /rejectAll\(disconnectedError\("closed"\)\)/);
assert.match(cdpClient, /deadline - now\(\)/);
assert.match(cdpClient, /C-M10 CDP call exceeded the campaign deadline/);
const controller = await readFile(new URL(
  "../cadr-web/browser/cadr-m10-controller.mjs", import.meta.url), "utf8");
assert.match(controller,
  /await disk\.stage\(objects\);[\s\S]*?await completeGuest\(\);[\s\S]*?await disk\.commit\(\{/,
  "controller must stage, advance the guest, then publish");
assert.match(controller, /CADR_M10_CONTROLLER_IN_DOUBT/);
assert.match(controller, /await disk\.beginWriter\(\);[\s\S]*?disk\.exportActiveClosure\(\)/);
assert.match(controller, /await replaceWorker\(\)/);
assert.match(controller, /ambiguousInvalidationFlight/);
assert.match(controller, /ambiguousInvalidationEpoch/);
assert.match(controller, /snapshotReviewReleaseFence/);
assert.match(controller, /refreshed\?\.close\?\./);
assert.match(controller, /releaseRequiresFreshSession/);
assert.match(controller, /releaseAttempt/);
assert.doesNotMatch(controller,
  /async function invalidateAfterAmbiguousGuest\(\) \{\s*assertNoSnapshotReviewLease\(\)/);
assert.match(controller, /await targetBackend\.deleteDisk\(targetBinding\)/);
assert.match(controller, /createCadrM10WorkerDiskBridge/);
assert.match(controller, /claimSnapshotReviewAuthority/);
assert.match(controller, /SNAPSHOT_REVIEW_AUTHORITIES = new WeakMap/);
assert.match(controller, /SNAPSHOT_REVIEW_LEASE_BRANDS = new WeakSet/);
assert.match(controller, /await record\.disk\.pinRoot\("snapshot"/);
assert.match(controller, /await rollbackSnapshotReviewPin\(record\)/);
assert.match(controller, /resumeSnapshotReviewAcquire/);
assert.match(controller, /authority itself is\s+\* the only safe branded recovery route/);
assert.match(controller, /snapshot review lease is active/);
const processKill = await readFile(new URL(
  "../scripts/run-cadr-m10-process-kill-browser.mjs", import.meta.url), "utf8");
assert.match(processKill, /"SIGKILL"/);
assert.match(processKill, /CadrProcessGroupSupervisor/);
assert.match(processKill, /processGroups\.track\(spawn/);
assert.match(processKill, /processGroups\.stopAll\("SIGKILL"\)/);
assert.match(processKill, /cadr-pdeath-exec\.py/);
assert.match(processKill, /process-kill-not-os-power-removal/);
assert.match(processKill, /CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS/);
assert.match(processKill, /createHash\("sha256"\)/);
assert.match(processKill, /269562880/);
assert.match(processKill,
  /bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5/);
assert.match(processKill, /cross-origin-opener-policy/);
const processPage = await readFile(new URL(
  "../cadr-web/browser/cadr-m10-process-kill.mjs", import.meta.url), "utf8");
assert.match(processPage, /SharedArrayBuffer/);
assert.match(processPage, /cadr-m10-process-controller-worker\.mjs/);
const processController = await readFile(new URL(
  "../cadr-web/browser/cadr-m10-process-controller-worker.mjs",
  import.meta.url), "utf8");
assert.match(processController, /createCadrM10Controller/);
assert.match(processController, /createCadrM10WorkerDiskBridge/);
assert.match(processController, /Atomics\.wait\(barrier, 0, 0\)/);
assert.match(processController, /cadr-m10-process-guest-worker\.mjs/);
console.log("cadr_m10_indexeddb_static.mjs: ok");
