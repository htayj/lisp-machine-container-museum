import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CADR_M10_INDEXEDDB_DURABILITY,
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
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
assert.equal(CADR_M10_INDEXEDDB_DURABILITY, "strict");
assert.deepEqual(Object.keys(CADR_M10_INDEXEDDB_STORES), [
  "meta", "pages", "nodes", "manifests", "heads", "activations", "quarantine",
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
assert.match(adapter, /compaction writer epoch changed after mark/);
assert.match(adapter, /active head\/root changed after compaction mark/);
assert.match(adapter, /activation outer fields differ from encoded head/);
assert.match(adapter, /strict IndexedDB transaction durability is unavailable/);
assert.equal((adapter.match(/\bdb\.transaction\(/g) ?? []).length, 3,
  "adapter may bypass the strict-durability factory only for schema inspection");
assert.match(adapter, /const schemaTransaction = db\.transaction\(expected, "readonly"\)/);
const campaign = await readFile(new URL("../cadr-web/browser/cadr-m10-indexeddb-campaign.mjs", import.meta.url), "utf8");
assert.match(campaign, /\["abort", "terminate", "reload"\]/);
assert.match(campaign, /same-origin foreign UUID full-store inventory changed/);
assert.match(campaign, /foreign-origin IndexedDB reopened state changed/);
assert.match(campaign, /follow-up writer did not safely clear and replace/);
assert.match(campaign, /closed handle changed durable writer\/generation metadata/);
assert.match(campaign, /\["missing", "extra", "wrong-keypath", "auto-increment", "indexed"\]/);
assert.match(campaign, /malformed high-sequence activation was not quarantined exactly/);
assert.match(campaign, /4096-record boundary/);
assert.match(campaign, /durable compaction did not remove only unreachable/);
assert.match(campaign, /compaction did not reject a head changed after mark/);
const runner = await readFile(new URL("../scripts/run-cadr-m10-indexeddb-browser.mjs", import.meta.url), "utf8");
assert.match(runner, /--remote-debugging-port=0/);
assert.match(runner, /exact HTTP allowlist/);
assert.doesNotMatch(runner, /createReadStream|stat\(|9228/);
const controller = await readFile(new URL(
  "../cadr-web/browser/cadr-m10-controller.mjs", import.meta.url), "utf8");
assert.match(controller,
  /await disk\.stage\(objects\);[\s\S]*?await completeGuest\(\);[\s\S]*?await disk\.commit\(\{/,
  "controller must stage, advance the guest, then publish");
assert.match(controller, /CADR_M10_CONTROLLER_IN_DOUBT/);
assert.match(controller, /await disk\.beginWriter\(\);[\s\S]*?disk\.exportActiveClosure\(\)/);
assert.match(controller, /await replaceWorker\(\)/);
assert.match(controller, /await targetBackend\.deleteDisk\(targetBinding\)/);
assert.match(controller, /createCadrM10WorkerDiskBridge/);
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
