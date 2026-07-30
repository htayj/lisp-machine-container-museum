import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CADR_M10_INDEXEDDB_DURABILITY,
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_STORES,
  CADR_M10_INDEXEDDB_PREFIX,
} from "../cadr-web/browser/cadr-m10-indexeddb.mjs";

assert.deepEqual(CADR_M10_INDEXEDDB_DURABLE_SEAMS, [
  "before-stage", "after-stage", "before-head-activation",
  "after-head-activation", "before-reread-head", "after-reread-head",
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
const runner = await readFile(new URL("../scripts/run-cadr-m10-indexeddb-browser.mjs", import.meta.url), "utf8");
assert.match(runner, /--remote-debugging-port=0/);
assert.match(runner, /exact HTTP allowlist/);
assert.doesNotMatch(runner, /createReadStream|stat\(|9228/);
console.log("cadr_m10_indexeddb_static.mjs: ok");
