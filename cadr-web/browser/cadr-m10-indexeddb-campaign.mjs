import {
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_SCHEMA,
  CADR_M10_INDEXEDDB_STORES,
  createCadrM10IndexedDbBackend,
} from "./cadr-m10-indexeddb.mjs";
import { createCadrM10Controller } from "./cadr-m10-controller.mjs";
import {
  CADR_M10_BASE_SHA256,
  CADR_M10_MAX_ACTIVATION_RECORDS,
  cadrM10Sha256,
  hexBytes,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvm1,
  serializeCdrOvn1,
  serializeCdrOvh1,
} from "../wasm/cadr-m10-persistence.mjs";

const STORAGE_KEY = "cadr-m10-indexeddb-campaign-v2";
const query = new URLSearchParams(location.search);
const channel = crypto.randomUUID();
const modes = ["abort", "terminate", "reload"];
const storeNames = Object.values(CADR_M10_INDEXEDDB_STORES).sort();
const binding = {
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
  profileSha256: await cadrM10Sha256(new TextEncoder().encode("C-M10 browser campaign profile")),
  artifactSetSha256: await cadrM10Sha256(new TextEncoder().encode("C-M10 browser campaign artifacts")),
};
const foreignUuid = Uint8Array.from({ length: 16 }, (_, index) => index + 33);
const ZERO_HASH = new Uint8Array(32);
const legacyStoreNames = Object.values(CADR_M10_INDEXEDDB_STORES)
  .filter(name => name !== CADR_M10_INDEXEDDB_STORES.refs).sort();

/* Instrument the page realm. Worker transactions are independently covered by
 * the static single-factory assertion. Every explicit page RW transaction also
 * opts into strict durability. */
const nativeTransaction = IDBDatabase.prototype.transaction;
const durability = { strict: 0, lax: 0 };
IDBDatabase.prototype.transaction = function transaction(names, mode, options) {
  if (mode === "readwrite") {
    if (options?.durability === "strict") durability.strict += 1;
    else durability.lax += 1;
  }
  return Reflect.apply(nativeTransaction, this, [names, mode, options]);
};

function fail(error) {
  document.body.dataset.status = "failed";
  document.body.textContent = `C-M10 IndexedDB browser campaign failed: ${error?.stack ?? error}`;
  throw error;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
async function rejects(operation, expression, message) {
  let failure = null;
  try { await operation(); } catch (error) { failure = error; }
  assert(failure !== null && expression.test(`${failure?.name ?? ""} ${failure?.message ?? ""}`),
    `${message}: ${failure?.name ?? "no error"} ${failure?.message ?? ""}`);
}
function save(state) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null"); }
function initialState() {
  return { version: 4, run: crypto.randomUUID(), index: 0, results: [], pending: null, foreign: null };
}
function scenarioFor(index) {
  const seam = CADR_M10_INDEXEDDB_DURABLE_SEAMS[Math.floor(index / modes.length)];
  return { seam, mode: modes[index % modes.length], index };
}
function prefixFor(state, scenario) { return `cadr-m10-campaign-${state.run.slice(0, 16)}-${scenario.index}`; }
function workerBinding(value = binding) {
  return { diskUuid: Array.from(value.diskUuid), profileSha256: Array.from(value.profileSha256),
    artifactSetSha256: Array.from(value.artifactSetSha256) };
}

function strictTransaction(db, names, mode = "readwrite") {
  return db.transaction(names, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openExisting(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => {
      request.transaction.abort();
      reject(new Error(`inventory unexpectedly created ${name}`));
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function canonicalValue(value) {
  if (value instanceof ArrayBuffer) return { bytes: hexBytes(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) {
    return { bytes: hexBytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

async function databaseInventory(name) {
  const db = await openExisting(name);
  try {
    assert(JSON.stringify([...db.objectStoreNames].sort()) === JSON.stringify(storeNames),
      `${name}: inventory store schema changed`);
    const transaction = strictTransaction(db, storeNames, "readonly");
    const records = {};
    await Promise.all(storeNames.map((store) => new Promise((resolve, reject) => {
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => { records[store] = request.result.map(canonicalValue)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))); resolve(); };
      request.onerror = () => reject(request.error);
    })));
    await transactionDone(transaction);
    return hexBytes(await cadrM10Sha256(new TextEncoder().encode(JSON.stringify(canonicalValue(records)))));
  } finally { db.close(); }
}

function storedBinary(key, bytes) { return { key, bytes: bytes.slice().buffer }; }

async function standaloneTree(seed, slot = 11) {
  const page = Uint8Array.from({ length: 1024 }, (_, index) => (seed + index * 29) & 255);
  const pageHash = await cadrM10Sha256(page);
  const leafChildren = Array.from({ length: 256 }, () => ZERO_HASH); leafChildren[slot] = pageHash;
  const leafBytes = await serializeCdrOvn1({ level: 0, prefix: 0n, children: leafChildren });
  const leaf = await parseCdrOvn1(leafBytes);
  const middleChildren = Array.from({ length: 256 }, () => ZERO_HASH); middleChildren[0] = leaf.hash;
  const middleBytes = await serializeCdrOvn1({ level: 1, prefix: 0n, children: middleChildren });
  const middle = await parseCdrOvn1(middleBytes);
  const rootChildren = Array.from({ length: 256 }, () => ZERO_HASH); rootChildren[0] = middle.hash;
  const rootBytes = await serializeCdrOvn1({ level: 2, prefix: 0n, children: rootChildren });
  const root = await parseCdrOvn1(rootBytes);
  return Object.freeze({ page, pageHash, root, bytes: Object.freeze({
    pages: Object.freeze([page]), nodes: Object.freeze([leafBytes, middleBytes, rootBytes]),
  }) });
}

async function legacyV1Records() {
  const emptyRootBytes = await serializeCdrOvn1({ level: 2, prefix: 0n,
    children: Array.from({ length: 256 }, () => ZERO_HASH) });
  const emptyRoot = await parseCdrOvn1(emptyRootBytes);
  const genesisBytes = await serializeCdrOvm1({ generation: 0n, parentGeneration: 0n,
    entryCount: 0n, diskUuid: binding.diskUuid, baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: binding.profileSha256, artifactSetSha256: binding.artifactSetSha256,
    rootSha256: emptyRoot.hash });
  const genesis = await parseCdrOvm1(genesisBytes);
  const overlay = await standaloneTree(71);
  const manifestBytes = await serializeCdrOvm1({ generation: 1n, parentGeneration: 0n,
    entryCount: 1n, diskUuid: binding.diskUuid, baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: binding.profileSha256, artifactSetSha256: binding.artifactSetSha256,
    parentManifestSha256: genesis.hash, rootSha256: overlay.root.hash });
  const manifest = await parseCdrOvm1(manifestBytes);
  const genesisHead = await serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n,
    diskUuid: binding.diskUuid, activeGeneration: 0n, activeManifestSha256: genesis.hash,
    activeRootSha256: emptyRoot.hash, previousGeneration: 0n,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: binding.profileSha256 });
  const head = await serializeCdrOvh1({ headSeq: 2n, writerEpoch: 1n,
    diskUuid: binding.diskUuid, activeGeneration: 1n, activeManifestSha256: manifest.hash,
    activeRootSha256: overlay.root.hash, previousGeneration: 0n,
    previousManifestSha256: genesis.hash, previousRootSha256: emptyRoot.hash,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: binding.profileSha256 });
  const diskKey = hexBytes(binding.diskUuid);
  const nodes = await Promise.all([emptyRootBytes, ...overlay.bytes.nodes].map(async (bytes) => {
    const node = await parseCdrOvn1(bytes); return storedBinary(hexBytes(node.hash), bytes);
  }));
  return Object.freeze({ diskKey, overlay, meta: Object.freeze({ key: "control", schema: 1,
    phase: "OPEN", diskKey, baseSha256: hexBytes(CADR_M10_BASE_SHA256),
    profileSha256: hexBytes(binding.profileSha256), artifactSetSha256: hexBytes(binding.artifactSetSha256),
    generationHighWater: "1", writerHighWater: "1", sessionHighWater: "1", activeSession: "1",
    activeWriterEpoch: "0", pendingGeneration: "0", pendingSession: "0" }),
  pages: Object.freeze([storedBinary(hexBytes(overlay.pageHash), overlay.page)]),
  nodes: Object.freeze(nodes), manifests: Object.freeze([
    storedBinary(hexBytes(genesis.hash), genesisBytes), storedBinary(hexBytes(manifest.hash), manifestBytes),
  ]), genesis, manifest, genesisHead, head });
}

async function installLegacyV1Database(name) {
  const legacy = await legacyV1Records();
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      try {
        for (const storeName of legacyStoreNames) request.result.createObjectStore(storeName, { keyPath: "key" });
        const transaction = request.transaction;
        transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).put(legacy.meta);
        for (const record of legacy.pages) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.pages).put(record);
        for (const record of legacy.nodes) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.nodes).put(record);
        for (const record of legacy.manifests) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.manifests).put(record);
        transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put({ key: "head", headBytes: legacy.head.slice().buffer });
        const activations = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations);
        activations.put({ key: `${legacy.diskKey}:1`, diskKey: legacy.diskKey, headSeq: "1",
          headBytes: legacy.genesisHead.slice().buffer });
        activations.put({ key: `${legacy.diskKey}:2`, diskKey: legacy.diskKey, headSeq: "2",
          headBytes: legacy.head.slice().buffer });
      } catch (error) { try { request.transaction.abort(); } catch {} reject(error); }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  return legacy;
}

function legacyV2Reference(legacy, kind, sequence, overrides = {}) {
  return Object.freeze({ key: `${legacy.diskKey}:${kind}:${sequence}`, diskKey: legacy.diskKey,
    kind, rootSha256: legacy.overlay.root.hash.slice().buffer, ...overrides });
}

async function installLegacyV2Database(name, {
  refHighWater = "3", rootReferences = undefined,
} = {}) {
  const legacy = await legacyV1Records();
  const defaultReferences = [
    legacyV2Reference(legacy, "snapshot", 1),
    legacyV2Reference(legacy, "clone", 2),
    legacyV2Reference(legacy, "export", 3),
  ];
  const references = typeof rootReferences === "function"
    ? rootReferences(legacy) : (rootReferences ?? defaultReferences);
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 2);
    request.onupgradeneeded = () => {
      try {
        for (const storeName of storeNames) request.result.createObjectStore(storeName, { keyPath: "key" });
        const transaction = request.transaction;
        transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).put({
          ...legacy.meta, schema: 2, refHighWater,
        });
        for (const record of legacy.pages) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.pages).put(record);
        for (const record of legacy.nodes) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.nodes).put(record);
        for (const record of legacy.manifests) transaction.objectStore(CADR_M10_INDEXEDDB_STORES.manifests).put(record);
        transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put({ key: "head", headBytes: legacy.head.slice().buffer });
        const activations = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations);
        activations.put({ key: `${legacy.diskKey}:1`, diskKey: legacy.diskKey, headSeq: "1",
          headBytes: legacy.genesisHead.slice().buffer });
        activations.put({ key: `${legacy.diskKey}:2`, diskKey: legacy.diskKey, headSeq: "2",
          headBytes: legacy.head.slice().buffer });
        const refs = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.refs);
        for (const reference of references) refs.put(reference);
      } catch (error) { try { request.transaction.abort(); } catch {} reject(error); }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { request.result.close(); resolve(); };
  });
  return legacy;
}

async function readStores(name, names) {
  const db = await openExisting(name);
  try {
    const transaction = strictTransaction(db, names, "readonly");
    const values = await Promise.all(names.map((storeName) => new Promise((resolve, reject) => {
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    await transactionDone(transaction);
    return Object.fromEntries(names.map((namePart, index) => [namePart, values[index]]));
  } finally { db.close(); }
}

function executeWorker({ prefix, seam = null, existing = false, mutateCaller = true, onSeam = null }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./cadr-m10-indexeddb-seam-worker.mjs", { type: "module" });
    let ready = null;
    worker.onerror = (event) => { worker.terminate(); reject(event.error ?? new Error(event.message)); };
    worker.onmessage = async (event) => {
      try {
        if (event.data.type === "ready") { ready = event.data; return; }
        if (event.data.type === "seam") {
          assert(ready !== null && event.data.seam === seam, "worker seam ledger order mismatch");
          await onSeam(worker, ready);
          return;
        }
        if (event.data.type === "done") {
          worker.terminate();
          resolve({ ready, done: event.data });
        }
      } catch (error) { worker.terminate(); reject(error); }
    };
    worker.postMessage({ type: "run", seam, existing, mutateCaller, databasePrefix: prefix,
      binding: workerBinding() });
  });
}

async function proveFollowupWriter(prefix) {
  const { done } = await executeWorker({ prefix, existing: true });
  assert(done.error === undefined, `follow-up writer failed: ${done.error?.name} ${done.error?.message}`);
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.reopenDisk(binding);
  const active = await disk.active();
  assert(active.manifest.generation === 2n && active.head.headSeq === 2n,
    `follow-up writer did not safely clear and replace the abandoned reservation: ${active.manifest.generation}/${active.head.headSeq}`);
  disk.close();
}

async function verifyScenario(state, pending) {
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: pending.prefix });
  const disk = await backend.reopenDisk(binding);
  const active = await disk.active();
  const expectNew = CADR_M10_INDEXEDDB_DURABLE_SEAMS.indexOf(pending.seam) >=
    CADR_M10_INDEXEDDB_DURABLE_SEAMS.indexOf("after-head-activation");
  const expectedGeneration = expectNew ? 1n : 0n;
  const expectedHead = expectNew ? 2n : 1n;
  assert(active.manifest.generation === expectedGeneration && active.head.headSeq === expectedHead &&
    hexBytes(active.manifest.rootSha256) === (expectNew ? pending.newRoot : pending.oldRoot),
  `${pending.mode}/${pending.seam}: mixed or wrong durable state ${active.manifest.generation}/${active.head.headSeq}`);
  const records = await disk.collectActivationRecords();
  assert(records.length === Number(expectedHead) && records.every((record) => record.diskKey === hexBytes(binding.diskUuid)),
    `${pending.mode}/${pending.seam}: activation collection was noncanonical`);
  disk.close();
  if (!expectNew) await proveFollowupWriter(pending.prefix);
  state.results.push({ ...pending, generation: active.manifest.generation.toString(),
    headSeq: active.head.headSeq.toString(), followup: !expectNew });
  state.pending = null;
  save(state);
}

async function seedForeignUuid(prefix) {
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const foreignBinding = { ...binding, diskUuid: foreignUuid };
  const disk = await backend.initializeDisk(foreignBinding);
  await disk.active();
  disk.close();
  const name = backend.databaseNameFor(foreignUuid);
  return { name, inventory: await databaseInventory(name) };
}

async function assertForeignUuid(expected) {
  assert(await databaseInventory(expected.name) === expected.inventory,
    "same-origin foreign UUID full-store inventory changed");
}

async function runScenario(state, scenario, prefix, foreignFingerprint) {
  let pending = null;
  const result = await executeWorker({
    prefix, seam: scenario.seam,
    onSeam: async (worker, ready) => {
      pending = { seam: scenario.seam, mode: scenario.mode, prefix,
        oldRoot: hexBytes(Uint8Array.from(ready.oldRoot)),
        newRoot: hexBytes(Uint8Array.from(ready.newRoot)), foreignFingerprint };
      state.pending = pending;
      save(state);
      if (scenario.mode === "abort") worker.postMessage({ type: "abort", seam: scenario.seam });
      else if (scenario.mode === "terminate") await worker.terminate();
      else location.reload();
    },
  });
  if (scenario.mode === "terminate") {
    /* terminate() prevents a done message, so executeWorker cannot resolve. */
    return;
  }
  assert(result.done !== undefined && pending !== null, `${scenario.mode}/${scenario.seam}: missing completion`);
  await verifyScenario(state, pending);
  await assertForeignUuid(foreignFingerprint);
}

/* Termination needs its own completion rule because a terminated worker emits no
 * further message. */
function runTerminateScenario(state, scenario, prefix, foreignFingerprint) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./cadr-m10-indexeddb-seam-worker.mjs", { type: "module" });
    let ready = null;
    worker.onerror = (event) => reject(event.error ?? new Error(event.message));
    worker.onmessage = async (event) => {
      try {
        if (event.data.type === "ready") { ready = event.data; return; }
        if (event.data.type !== "seam") throw new Error("termination worker completed before its target seam");
        assert(ready !== null && event.data.seam === scenario.seam, "termination seam ledger order mismatch");
        const pending = { seam: scenario.seam, mode: scenario.mode, prefix,
          oldRoot: hexBytes(Uint8Array.from(ready.oldRoot)), newRoot: hexBytes(Uint8Array.from(ready.newRoot)),
          foreignFingerprint };
        state.pending = pending;
        save(state);
        await worker.terminate();
        await verifyScenario(state, pending);
        await assertForeignUuid(foreignFingerprint);
        resolve();
      } catch (error) { reject(error); }
    };
    worker.postMessage({ type: "run", seam: scenario.seam, mutateCaller: true,
      databasePrefix: prefix, binding: workerBinding() });
  });
}

async function proveForeignOrigin(state) {
  const foreignPort = query.get("foreign");
  if (foreignPort === null) throw new Error("campaign needs the foreign-origin port");
  const frame = document.createElement("iframe");
  frame.src = `http://127.0.0.1:${foreignPort}/cadr-web/browser/cadr-m10-indexeddb-foreign.html?channel=${channel}`;
  document.body.append(frame);
  const receive = (type, timeoutMessage) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), 5000);
    addEventListener("message", function listener(event) {
      if (event.data?.type === "cadr-m10-foreign-error") {
        removeEventListener("message", listener); clearTimeout(timer);
        reject(new Error(`foreign-origin fixture failed: ${event.data.message}`));
      } else if (event.data?.type === type && event.data.channel === channel) {
        removeEventListener("message", listener); clearTimeout(timer); resolve(event.data.fingerprint);
      }
    });
  });
  const first = await receive("cadr-m10-foreign-ready", "foreign-origin fixture timed out");
  const pending = receive("cadr-m10-foreign-check", "foreign-origin reopen timed out");
  frame.contentWindow.postMessage({ type: "cadr-m10-foreign-check", channel }, "*");
  const second = await pending;
  assert(first === second, "foreign-origin IndexedDB reopened state changed");
  state.foreign = first;
  save(state);
}

async function proveVersionChange(state) {
  const prefix = `cadr-m10-version-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.initializeDisk(binding);
  const name = backend.databaseNameFor(binding.diskUuid);
  await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, CADR_M10_INDEXEDDB_SCHEMA + 1);
    request.onupgradeneeded = () => {};
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("version-change fixture was blocked"));
  });
  let fenced = false;
  try { await disk.active(); } catch (error) { fenced = error?.name === "CadrM10IndexedDbVersionChangeError"; }
  assert(fenced, "version change did not fence the old handle");
  state.versionChange = true;
  save(state);
}

async function proveStaleClose(state) {
  const prefix = `cadr-m10-close-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const old = await backend.initializeDisk(binding);
  const current = await old.reopen();
  old.close();
  assert((await current.active()).head.headSeq === 1n, "stale close closed the current shared connection");
  for (const operation of [
    () => old.active(), () => old.beginWriter(), () => old.reserveGeneration(1n),
    () => old.closeWriter(1n), () => old.stage({}), () => old.collectActivationRecords(),
    () => old.commit({}), () => old.reopen(),
  ]) {
    let rejected = false;
    try { await operation(); } catch (error) { rejected = /closed handle/.test(error?.message ?? ""); }
    assert(rejected, "a closed handle operation was not synchronously fenced");
  }
  const firstEpoch = await current.beginWriter();
  assert(firstEpoch === 1n, "closed handle advanced the writer high-water");
  await current.closeWriter(firstEpoch);
  const secondEpoch = await current.beginWriter();
  current.close();
  for (const operation of [
    () => current.reserveGeneration(secondEpoch),
    () => current.closeWriter(secondEpoch),
  ]) {
    let rejected = false;
    try { await operation(); } catch (error) { rejected = /closed handle/.test(error?.message ?? ""); }
    assert(rejected, "closed current handle mutated writer or generation metadata");
  }
  const inspect = await openExisting(backend.databaseNameFor(binding.diskUuid));
  const inspectTx = strictTransaction(inspect, CADR_M10_INDEXEDDB_STORES.meta, "readonly");
  const metadata = await new Promise((resolve, reject) => {
    const request = inspectTx.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get("control");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(inspectTx);
  inspect.close();
  assert(metadata.writerHighWater === "2" && metadata.activeWriterEpoch === "2" &&
    metadata.generationHighWater === "0" && metadata.pendingGeneration === "0",
  "closed handle changed durable writer/generation metadata");
  const fresh = await backend.reopenDisk(binding);
  const thirdEpoch = await fresh.beginWriter();
  assert(thirdEpoch === 3n && await fresh.reserveGeneration(thirdEpoch) === 1n,
    "reopen did not safely recover after closed-handle mutation attempts");
  fresh.close();
}

async function proveSchemaRejection(state) {
  for (const kind of ["missing", "extra", "wrong-keypath", "auto-increment", "indexed"]) {
    const prefix = `cadr-m10-schema-${kind}-${state.run.slice(0, 12)}`;
    const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
    const name = backend.databaseNameFor(binding.diskUuid);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (kind === "missing") request.result.createObjectStore(CADR_M10_INDEXEDDB_STORES.meta, { keyPath: "key" });
        else {
          for (const storeName of storeNames) {
            const options = storeName === CADR_M10_INDEXEDDB_STORES.meta && kind === "wrong-keypath"
              ? { keyPath: "id" }
              : { keyPath: "key", autoIncrement: storeName === CADR_M10_INDEXEDDB_STORES.meta &&
                kind === "auto-increment" };
            const store = request.result.createObjectStore(storeName, options);
            if (storeName === CADR_M10_INDEXEDDB_STORES.meta && kind === "indexed") {
              store.createIndex("unexpected-index", "phase");
            }
          }
          if (kind === "extra") request.result.createObjectStore("unexpected-extra", { keyPath: "key" });
        }
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
    let rejected = false;
    try { await backend.initializeDisk(binding); } catch (error) {
      rejected = /(?:database schema (?:stores differ|for )|schema-1 store)/.test(error?.message ?? "");
    }
    assert(rejected, `${kind} object-store schema was accepted`);
  }
}

async function proveRecoverySnapshotAndQuarantine(state) {
  const prefix = `cadr-m10-recovery-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.initializeDisk(binding);
  const genesis = await disk.active();
  const name = disk.databaseName;
  disk.close();
  const db = await openExisting(name);
  const transaction = strictTransaction(db,
    [CADR_M10_INDEXEDDB_STORES.heads, CADR_M10_INDEXEDDB_STORES.activations]);
  transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads)
    .put({ key: "head", headBytes: new Uint8Array(296).buffer });
  transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).put({
    key: `${hexBytes(binding.diskUuid)}:9999`, diskKey: hexBytes(binding.diskUuid),
    headSeq: "9999", headBytes: genesis.headBytes.slice().buffer,
  });
  await transactionDone(transaction);
  db.close();
  const recovered = await backend.reopenDisk(binding);
  assert(recovered.readOnly, "corrupt current head did not produce a read-only recovery handle");
  for (let pass = 0; pass < 2; pass += 1) {
    const active = await recovered.active();
    assert(active.head.headSeq === 1n && active.manifest.generation === 0n &&
      hexBytes(active.manifest.rootSha256) === hexBytes(genesis.manifest.rootSha256),
    "recovered handle did not preserve the exact validated snapshot");
  }
  const inspect = await openExisting(name);
  const inspectTx = strictTransaction(inspect,
    [CADR_M10_INDEXEDDB_STORES.activations, CADR_M10_INDEXEDDB_STORES.quarantine], "readonly");
  const activations = await new Promise((resolve, reject) => {
    const request = inspectTx.objectStore(CADR_M10_INDEXEDDB_STORES.activations).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const quarantine = await new Promise((resolve, reject) => {
    const request = inspectTx.objectStore(CADR_M10_INDEXEDDB_STORES.quarantine).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await transactionDone(inspectTx);
  inspect.close();
  assert(activations.length === 1 && activations[0].headSeq === "1" && quarantine.length === 1,
    "malformed high-sequence activation was not quarantined exactly");
  recovered.close();
}

async function proveActivationBoundary(state) {
  const prefix = `cadr-m10-bound-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.initializeDisk(binding);
  const active = await disk.active();
  const name = disk.databaseName;
  disk.close();
  const db = await openExisting(name);
  const transaction = strictTransaction(db, CADR_M10_INDEXEDDB_STORES.activations);
  const store = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations);
  for (let sequence = 3n; sequence <= BigInt(CADR_M10_MAX_ACTIVATION_RECORDS) + 1n; sequence += 1n) {
    const headBytes = await serializeCdrOvh1({
      headSeq: sequence, writerEpoch: 0n, diskUuid: binding.diskUuid,
      activeGeneration: 0n, activeManifestSha256: active.manifest.hash,
      activeRootSha256: active.manifest.rootSha256, previousGeneration: 0n,
      baseSha256: CADR_M10_BASE_SHA256, profileSha256: binding.profileSha256,
    });
    store.put({ key: `${hexBytes(binding.diskUuid)}:${sequence}`, diskKey: hexBytes(binding.diskUuid),
      headSeq: sequence.toString(), headBytes: headBytes.buffer });
  }
  await transactionDone(transaction);
  db.close();
  const { done } = await executeWorker({ prefix, existing: true });
  assert(done.error === undefined, `4096-record publication failed: ${done.error?.message}`);
  const reopened = await backend.reopenDisk(binding);
  const records = await reopened.collectActivationRecords();
  assert(records.length === CADR_M10_MAX_ACTIVATION_RECORDS &&
    records.some((record) => record.headSeq === 2n) &&
    !records.some((record) => record.headSeq === 3n),
  "4096-record boundary did not deterministically prune the lowest disposable activation");
  reopened.close();
}

async function proveActiveClosureAndCompaction(state) {
  const prefix = `cadr-m10-compact-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.initializeDisk(binding);
  const closure = await disk.exportActiveClosure();
  assert(closure.entryCount === 0n && closure.pages.length === 0 &&
    closure.nodes.length === 1,
  "empty active closure was not exported exactly");
  const orphanPage = Uint8Array.from({ length: 1024 },
    (_, index) => (index * 19 + 5) & 255);
  const orphanNode = await serializeCdrOvn1({
    level: 0, prefix: 0n,
    children: Array.from({ length: 256 }, () => new Uint8Array(32)),
  });
  await disk.stage({ pages: [orphanPage], nodes: [orphanNode] });
  const compactEpoch = await disk.beginWriter();
  const compacted = await disk.compact({ writerEpoch: compactEpoch });
  await disk.closeWriter(compactEpoch);
  assert(compacted.removed.pages === 1 &&
    compacted.removed.nodes === 1 &&
    compacted.retained.nodes === 1,
  "durable compaction did not remove only unreachable immutable objects");
  assert((await disk.active()).manifest.generation === 0n,
    "compaction changed the active generation");
  disk.close();
}

async function proveCompactionHeadRace(state) {
  const prefix = `cadr-m10-compact-race-${state.run.slice(0, 12)}`;
  let intruder = null; let originalHead = null; let mutation = null;
  const backend = createCadrM10IndexedDbBackend({
    databasePrefix: prefix,
    compactMarkHook: () => {
      const changed = originalHead.headBytes.slice(0);
      new Uint8Array(changed)[0] ^= 1;
      const transaction = strictTransaction(
        intruder, CADR_M10_INDEXEDDB_STORES.heads);
      transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put({
        key: "head", headBytes: changed,
      });
      mutation = transactionDone(transaction);
    },
  });
  const disk = await backend.initializeDisk(binding);
  intruder = await openExisting(disk.databaseName);
  const read = strictTransaction(
    intruder, CADR_M10_INDEXEDDB_STORES.heads, "readonly");
  const request = read.objectStore(CADR_M10_INDEXEDDB_STORES.heads).get("head");
  await transactionDone(read);
  originalHead = request.result;
  const epoch = await disk.beginWriter();
  let rejection = null;
  try { await disk.compact({ writerEpoch: epoch }); }
  catch (error) { rejection = error; }
  assert(rejection !== null &&
    /active head\/root changed after compaction mark/.test(rejection.message),
  "compaction did not reject a head changed after mark");
  await mutation;
  const restore = strictTransaction(
    intruder, CADR_M10_INDEXEDDB_STORES.heads);
  restore.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put(originalHead);
  await transactionDone(restore);
  await disk.closeWriter(epoch);
  assert((await disk.active()).manifest.generation === 0n,
    "rejected stale compaction changed the selected generation");
  intruder.close(); disk.close();
}

async function proveV1ReferenceMigration(state) {
  const prefix = `cadr-m10-refs-migrate-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const name = backend.databaseNameFor(binding.diskUuid);
  const legacy = await installLegacyV1Database(name);
  const disk = await backend.reopenDisk(binding);
  const active = await disk.active();
  const closure = await disk.exportActiveClosure();
  assert(active.manifest.generation === 1n && active.head.headSeq === 2n &&
    hexBytes(active.manifest.rootSha256) === hexBytes(legacy.overlay.root.hash),
  "schema-1 migration changed the selected overlay");
  assert(closure.pages.length === 1 && closure.nodes.length === 3 &&
    hexBytes(closure.pages[0].bytes) === hexBytes(legacy.overlay.page),
  "schema-1 migration did not preserve immutable overlay closure bytes");
  const stored = await readStores(name, [CADR_M10_INDEXEDDB_STORES.meta,
    CADR_M10_INDEXEDDB_STORES.pages, CADR_M10_INDEXEDDB_STORES.nodes,
    CADR_M10_INDEXEDDB_STORES.manifests, CADR_M10_INDEXEDDB_STORES.refs]);
  const meta = stored[CADR_M10_INDEXEDDB_STORES.meta][0];
  assert(meta.schema === 3 && meta.refHighWater === "0" &&
    meta.sessionHighWater === "2" && meta.activeSession === "2",
  "schema-1 metadata was not transactionally migrated with the new ref high-water");
  assert(stored[CADR_M10_INDEXEDDB_STORES.pages].length === legacy.pages.length &&
    stored[CADR_M10_INDEXEDDB_STORES.nodes].length === legacy.nodes.length &&
    stored[CADR_M10_INDEXEDDB_STORES.manifests].length === legacy.manifests.length &&
    stored[CADR_M10_INDEXEDDB_STORES.refs].length === 0,
  "schema-1 migration changed immutable stores or manufactured a reference");
  disk.close();
}

async function proveV2ReferenceUpgradeBoundary(state) {
  /* Schema 2 never escaped the private review branch.  Its public IDs contain
   * a kind, while schema 3's exact IDs deliberately do not.  Prove that an
   * empty candidate upgrades exactly, but an owner-held ref is not silently
   * rewritten into an unusable cleanup token. */
  const emptyPrefix = `cadr-m10-refs-v2-empty-${state.run.slice(0, 16)}`;
  const emptyBackend = createCadrM10IndexedDbBackend({ databasePrefix: emptyPrefix });
  const emptyName = emptyBackend.databaseNameFor(binding.diskUuid);
  const emptyLegacy = await installLegacyV2Database(emptyName, {
    refHighWater: "0", rootReferences: [],
  });
  const emptyDisk = await emptyBackend.reopenDisk(binding);
  const emptyActive = await emptyDisk.active();
  const emptyStored = await readStores(emptyName, [CADR_M10_INDEXEDDB_STORES.meta,
    CADR_M10_INDEXEDDB_STORES.refs]);
  const emptyMeta = emptyStored[CADR_M10_INDEXEDDB_STORES.meta][0];
  assert(emptyMeta.schema === 3 && emptyMeta.refHighWater === "0" &&
    emptyMeta.sessionHighWater === "2" && emptyMeta.activeSession === "2" &&
    emptyStored[CADR_M10_INDEXEDDB_STORES.refs].length === 0,
  "empty schema-2 migration did not preserve exact controls without manufacturing refs");
  assert(emptyActive.manifest.generation === 1n && emptyActive.head.headSeq === 2n &&
    hexBytes(emptyActive.manifest.rootSha256) === hexBytes(emptyLegacy.overlay.root.hash),
  "empty schema-2 migration changed the selected immutable overlay closure");
  emptyDisk.close();

  const mixedPrefix = `cadr-m10-refs-v2-mixed-${state.run.slice(0, 16)}`;
  const mixedBackend = createCadrM10IndexedDbBackend({ databasePrefix: mixedPrefix });
  const mixedName = mixedBackend.databaseNameFor(binding.diskUuid);
  const mixedLegacy = await installLegacyV2Database(mixedName);
  await rejects(() => mixedBackend.reopenDisk(binding),
    /root references require explicit owner reconciliation/,
    "schema-2 mixed retained refs were silently rewritten and orphaned owner IDs");
  const mixedStored = await readStores(mixedName, [CADR_M10_INDEXEDDB_STORES.meta,
    CADR_M10_INDEXEDDB_STORES.refs]);
  assert(mixedStored[CADR_M10_INDEXEDDB_STORES.meta][0].schema === 2 &&
    mixedStored[CADR_M10_INDEXEDDB_STORES.meta][0].refHighWater === "3" &&
    JSON.stringify(mixedStored[CADR_M10_INDEXEDDB_STORES.refs].map(reference => reference.key).sort()) ===
      JSON.stringify(["snapshot", "clone", "export"].map((kind, index) =>
        `${mixedLegacy.diskKey}:${kind}:${index + 1}`).sort()),
  "rejected schema-2 mixed refs did not remain byte-addressable by their original owners");

  const collisionPrefix = `cadr-m10-refs-v2-collision-${state.run.slice(0, 16)}`;
  const collisionBackend = createCadrM10IndexedDbBackend({ databasePrefix: collisionPrefix });
  const collisionName = collisionBackend.databaseNameFor(binding.diskUuid);
  await installLegacyV2Database(collisionName, {
    refHighWater: "1",
    rootReferences: legacy => [
      legacyV2Reference(legacy, "snapshot", 1), legacyV2Reference(legacy, "clone", 1),
    ],
  });
  await rejects(() => collisionBackend.reopenDisk(binding), /sequence collides across kinds/,
    "schema-2 duplicate cross-kind sequence was not rejected before any key-space collapse");

  const malformedPrefix = `cadr-m10-refs-v2-malformed-${state.run.slice(0, 16)}`;
  const malformedBackend = createCadrM10IndexedDbBackend({ databasePrefix: malformedPrefix });
  const malformedName = malformedBackend.databaseNameFor(binding.diskUuid);
  await installLegacyV2Database(malformedName, {
    refHighWater: "1",
    rootReferences: legacy => [legacyV2Reference(legacy, "clone", 1, {
      key: `${legacy.diskKey}:clone:01`,
    })],
  });
  await rejects(() => malformedBackend.reopenDisk(binding), /unknown schema-2 root reference/,
    "schema-2 malformed root-reference key was accepted during upgrade");
}

async function proveDurableRootReferences(state) {
  const prefix = `cadr-m10-refs-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.initializeDisk(binding);
  const retainedTree = await standaloneTree(101, 23);
  const orphanTree = await standaloneTree(151, 29);
  await disk.stage(retainedTree.bytes);
  await disk.stage(orphanTree.bytes);
  const first = await disk.pinRoot("snapshot", retainedTree.root.hash);
  assert(first === `${hexBytes(binding.diskUuid)}:1`,
    "first durable root reference did not receive the canonical identifier");
  await rejects(() => disk.unpinRoot(`${hexBytes(binding.diskUuid)}:clone:1`), /unknown/,
    "a kind-forged missing root-reference ID was accepted as an idempotent release");
  assert(await referenceCount(backend) === 1,
    "a rejected kind-forged root-reference ID changed the owned snapshot pin");
  await rejects(() => disk.pinRoot("snapshot", ZERO_HASH), /missing/,
    "pinning a nonexistent exact root was accepted");

  const foreignBackend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const foreign = await foreignBackend.initializeDisk({ ...binding, diskUuid: foreignUuid });
  await rejects(() => foreign.unpinRoot(first), /not owned/,
    "another disk released a durable root reference");
  foreign.close();

  let writer = await disk.beginWriter();
  const firstCompaction = await disk.compact({ writerEpoch: writer });
  await disk.closeWriter(writer);
  assert(firstCompaction.removed.pages === 1 && firstCompaction.removed.nodes === 3 &&
    firstCompaction.retained.pages === 1 && firstCompaction.retained.nodes === 4,
  "compaction failed to retain exactly the pinned root closure");

  const reopened = await disk.reopen();
  await rejects(() => disk.unpinRoot(first), /stale open-session/,
    "an old session released a root reference after reopen");
  assert(await referenceCount(backend) === 0,
    "a fresh session retained a process-lost transient snapshot reference");
  await reopened.unpinRoot(first);
  await rejects(() => reopened.unpinRoot(`${hexBytes(binding.diskUuid)}:2`), /unknown/,
    "a future root-reference identifier was accepted as an idempotent release");
  const second = await reopened.pinRoot("clone", retainedTree.root.hash);
  assert(second === `${hexBytes(binding.diskUuid)}:2`,
    "durable root-reference identifier was reused after release");
  const later = await reopened.reopen();
  await rejects(() => reopened.unpinRoot(second), /stale open-session/,
    "an old session released a durable clone reference after reopen");
  await later.unpinRoot(second);
  await later.unpinRoot(second);
  writer = await later.beginWriter();
  const releasedCompaction = await later.compact({ writerEpoch: writer });
  await later.closeWriter(writer);
  assert(releasedCompaction.removed.pages === 1 && releasedCompaction.removed.nodes === 3 &&
    releasedCompaction.retained.pages === 0 && releasedCompaction.retained.nodes === 1,
  "a reopened owning session did not release the pinned closure for compaction");
  reopened.close(); later.close();

  const rollbackPrefix = `cadr-m10-refs-rollback-${state.run.slice(0, 16)}`;
  const rollbackBackend = createCadrM10IndexedDbBackend({ databasePrefix: rollbackPrefix });
  const rollbackDisk = await rollbackBackend.initializeDisk(binding);
  const rollbackActive = await rollbackDisk.active();
  const rollbackDb = await openExisting(rollbackDisk.databaseName);
  const rollbackTx = strictTransaction(rollbackDb, [CADR_M10_INDEXEDDB_STORES.meta,
    CADR_M10_INDEXEDDB_STORES.refs]);
  const rollbackMeta = rollbackTx.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get("control");
  rollbackMeta.onsuccess = () => {
    const meta = { ...rollbackMeta.result, refHighWater: "0" };
    rollbackTx.objectStore(CADR_M10_INDEXEDDB_STORES.meta).put(meta);
    rollbackTx.objectStore(CADR_M10_INDEXEDDB_STORES.refs).add({
      key: `${hexBytes(binding.diskUuid)}:1`, diskKey: hexBytes(binding.diskUuid),
      kind: "snapshot", creatorSession: "1",
      rootSha256: rollbackActive.manifest.rootSha256.slice().buffer,
    });
  };
  await transactionDone(rollbackTx);
  rollbackDb.close();
  await rejects(() => rollbackDisk.pinRoot("snapshot"), /ConstraintError/,
    "a failed root-reference publication did not report its duplicate key");
  const failedPublication = await readStores(rollbackDisk.databaseName,
    [CADR_M10_INDEXEDDB_STORES.meta, CADR_M10_INDEXEDDB_STORES.refs]);
  assert(failedPublication[CADR_M10_INDEXEDDB_STORES.meta][0].refHighWater === "0" &&
    failedPublication[CADR_M10_INDEXEDDB_STORES.refs].length === 1,
  "a failed root-reference publication committed its high-water update");
  const cleanupDb = await openExisting(rollbackDisk.databaseName);
  const cleanup = strictTransaction(cleanupDb, CADR_M10_INDEXEDDB_STORES.refs);
  cleanup.objectStore(CADR_M10_INDEXEDDB_STORES.refs).delete(`${hexBytes(binding.diskUuid)}:1`);
  await transactionDone(cleanup); cleanupDb.close();
  const retry = await rollbackDisk.pinRoot("export");
  assert(retry === `${hexBytes(binding.diskUuid)}:1`,
    "a rolled-back root-reference publication consumed an identifier");
  await rollbackDisk.unpinRoot(retry);
  rollbackDisk.close();
}

function reviewBasePage() { return new Uint8Array(1024); }

function reviewController(backend) {
  return createCadrM10Controller({
    backend, binding, readBasePage: async () => reviewBasePage(),
    readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
    replaceWorker: async () => {},
  });
}

function reviewPage(seed) {
  return Uint8Array.from({ length: 1024 }, (_, index) => (seed + index * 31) & 255);
}

function reviewBackendAfterAwait(backend, callNumber, afterAwait,
    { postCommitFirstUnpinFailure = false } = {}) {
  let calls = 0; let reportedPostCommitUnpin = false;
  const wrap = disk => Object.freeze({
    get sessionId() { return disk.sessionId; },
    get readOnly() { return disk.readOnly; },
    close() { return disk.close(); },
    async active() { return disk.active(); },
    async exportActiveClosure() {
      const result = await disk.exportActiveClosure();
      calls += 1;
      if (calls === callNumber) await afterAwait();
      return result;
    },
    async pinRoot(...args) {
      const result = await disk.pinRoot(...args);
      calls += 1;
      if (calls === callNumber) await afterAwait();
      return result;
    },
    async unpinRoot(...args) {
      const result = await disk.unpinRoot(...args);
      if (postCommitFirstUnpinFailure && !reportedPostCommitUnpin) {
        reportedPostCommitUnpin = true;
        throw new Error("synthetic review release response lost after commit");
      }
      return result;
    },
  });
  return Object.freeze({
    initializeDisk: async current => wrap(await backend.initializeDisk(current)),
    reopenDisk: async current => wrap(await backend.reopenDisk(current)),
  });
}

function reviewBackendWithFirstUnpinFailure(backend) {
  let fail = true;
  const wrap = disk => Object.freeze({
    get sessionId() { return disk.sessionId; },
    get readOnly() { return disk.readOnly; },
    close() { return disk.close(); },
    async active() { return disk.active(); },
    async exportActiveClosure() { return disk.exportActiveClosure(); },
    async pinRoot(...args) { return disk.pinRoot(...args); },
    async unpinRoot(...args) {
      if (fail) { fail = false; throw new Error("synthetic review release failure"); }
      return disk.unpinRoot(...args);
    },
  });
  return Object.freeze({
    initializeDisk: async current => wrap(await backend.initializeDisk(current)),
    reopenDisk: async current => wrap(await backend.reopenDisk(current)),
  });
}

function throws(operation, expression, message) {
  let failure = null;
  try { operation(); } catch (error) { failure = error; }
  assert(failure !== null && expression.test(`${failure?.name ?? ""} ${failure?.message ?? ""}`),
    `${message}: ${failure?.name ?? "no error"} ${failure?.message ?? ""}`);
}

async function changeReviewRootAndSession(backend, seed) {
  const writer = reviewController(backend);
  await writer.open();
  await writer.commitWrites([{ lba: 17n, bytes: reviewPage(seed) }]);
  writer.close();
}

async function referenceCount(backend) {
  const records = await readStores(backend.databaseNameFor(binding.diskUuid),
    [CADR_M10_INDEXEDDB_STORES.refs]);
  return records[CADR_M10_INDEXEDDB_STORES.refs].length;
}

async function proveControllerReviewAuthority(state) {
  const prefix = `cadr-m10-review-${state.run.slice(0, 16)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const controller = reviewController(backend);
  await controller.open({ initialize: true });
  const authority = controller.claimSnapshotReviewAuthority();
  assert(Object.isFrozen(authority) && Object.isFrozen(authority.acquire) &&
    Object.isFrozen(authority.revoke) && JSON.stringify(Object.keys(authority)) ===
    JSON.stringify(["acquire", "revoke"]),
  "review authority exposed anything besides frozen acquire and revoke methods");
  throws(() => controller.claimSnapshotReviewAuthority(), /already been claimed/,
    "review authority was claimed twice");
  throws(() => ({ ...authority }).acquire(), /not recognized/,
    "cloned review authority reached durable storage");
  throws(() => new Proxy(authority, {}).acquire(), /not recognized/,
    "proxied review authority reached durable storage");

  const lease = await authority.acquire();
  assert(Object.isFrozen(lease) && Object.isFrozen(lease.binding) &&
    JSON.stringify(Object.keys(lease)) === JSON.stringify(["binding", "release"]) &&
    lease.binding.generation === "0" && lease.binding.headSeq === "1" &&
    /^[0-9a-f]{64}$/.test(lease.binding.manifestSha256) &&
    /^[0-9a-f]{64}$/.test(lease.binding.rootSha256),
  "review lease did not publish only canonical immutable snapshot binding");
  await rejects(() => controller.commitWrites([{ lba: 1n, bytes: reviewPage(21) }]), /review lease/,
    "review lease did not synchronously fence mutation");
  await rejects(() => controller.exportOverlay(), /review lease/,
    "review lease did not fence export");
  await rejects(() => controller.compact(), /review lease/,
    "review lease did not fence compaction");
  await rejects(() => controller.recover(), /review lease/,
    "review lease did not fence recovery");
  await rejects(() => controller.open(), /review lease/,
    "review lease did not fence open");
  throws(() => controller.close(), /review lease/, "review lease did not fence close");
  assert(await referenceCount(backend) === 1, "review lease did not durably pin its root");
  const firstRelease = lease.release();
  const secondRelease = lease.release();
  assert(firstRelease === secondRelease, "concurrent review release calls did not share a flight");
  const receipt = await firstRelease;
  assert(receipt.released === true && receipt.alreadyReleased === false &&
    receipt.binding === lease.binding && (await lease.release()).alreadyReleased === true,
  "review release receipt was not cached canonically");
  assert(await referenceCount(backend) === 0, "review release did not remove its durable root pin");
  authority.revoke("completed real IndexedDB review");
  controller.close();

  const retryPrefix = `cadr-m10-review-retry-${state.run.slice(0, 16)}`;
  const retryRawBackend = createCadrM10IndexedDbBackend({ databasePrefix: retryPrefix });
  const retryController = reviewController(reviewBackendWithFirstUnpinFailure(retryRawBackend));
  await retryController.open({ initialize: true });
  const retryLease = await retryController.claimSnapshotReviewAuthority().acquire();
  await rejects(() => retryLease.release(), /synthetic review release failure/,
    "injected review release failure was accepted");
  await rejects(() => retryController.compact(), /review lease/,
    "failed review release did not remain release-required");
  assert((await retryLease.release()).alreadyReleased === false,
    "failed review release retried without an explicit caller retry");
  assert(await referenceCount(retryRawBackend) === 0,
    "explicit review release retry left a root pin");
  retryController.close();

  const lostReceiptPrefix = `cadr-m10-review-lost-receipt-${state.run.slice(0, 16)}`;
  const lostReceiptRawBackend = createCadrM10IndexedDbBackend({ databasePrefix: lostReceiptPrefix });
  const lostReceiptController = reviewController(reviewBackendAfterAwait(
    lostReceiptRawBackend, -1, async () => {}, { postCommitFirstUnpinFailure: true }));
  await lostReceiptController.open({ initialize: true });
  const lostReceiptLease = await lostReceiptController.claimSnapshotReviewAuthority().acquire();
  await rejects(() => lostReceiptLease.release(), /response lost after commit/,
    "post-commit review unpin report loss was accepted");
  await rejects(() => lostReceiptController.compact(), /review lease/,
    "post-commit review unpin report loss cleared the mutation fence");
  await lostReceiptLease.release();
  assert(await referenceCount(lostReceiptRawBackend) === 0,
    "idempotent durable unpin did not close a post-commit report-loss retry");
  lostReceiptController.close();

  const crossLeftBackend = createCadrM10IndexedDbBackend({
    databasePrefix: `cadr-m10-review-cross-left-${state.run.slice(0, 12)}`,
  });
  const crossRightBackend = createCadrM10IndexedDbBackend({
    databasePrefix: `cadr-m10-review-cross-right-${state.run.slice(0, 12)}`,
  });
  const crossLeft = reviewController(crossLeftBackend);
  const crossRight = reviewController(crossRightBackend);
  await crossLeft.open({ initialize: true }); await crossRight.open({ initialize: true });
  const crossAuthority = crossLeft.claimSnapshotReviewAuthority();
  throws(() => crossAuthority.acquire.call(crossRight), /not recognized/,
    "cross-controller authority reached durable storage");
  assert(await referenceCount(crossLeftBackend) === 0,
    "rejected cross-controller authority mutation made a durable pin");
  const crossLease = await crossAuthority.acquire();
  throws(() => crossLease.release.call(crossRight), /not recognized/,
    "cross-controller lease release reached durable storage");
  await crossLease.release();
  crossLeft.close(); crossRight.close();

  const reopenPrefix = `cadr-m10-review-reopen-${state.run.slice(0, 16)}`;
  const reopenBackend = createCadrM10IndexedDbBackend({ databasePrefix: reopenPrefix });
  const reopenController = reviewController(reopenBackend);
  await reopenController.open({ initialize: true });
  const reopenAuthority = reopenController.claimSnapshotReviewAuthority();
  reopenController.close();
  await reopenController.open();
  const reopenLease = await reopenAuthority.acquire();
  await reopenLease.release();
  reopenController.close();

  for (const callNumber of [1, 2, 3]) {
    const racePrefix = `cadr-m10-review-race-${callNumber}-${state.run.slice(0, 12)}`;
    const raceBackend = createCadrM10IndexedDbBackend({ databasePrefix: racePrefix });
    let changed = false;
    const controllerBackend = reviewBackendAfterAwait(raceBackend, callNumber, async () => {
      changed = true;
      await changeReviewRootAndSession(raceBackend, 80 + callNumber);
    });
    const raceController = reviewController(controllerBackend);
    await raceController.open({ initialize: true });
    await rejects(() => raceController.claimSnapshotReviewAuthority().acquire(),
      /snapshot review (?:changed|active closure)/,
      `review acquisition accepted root/session change after await ${callNumber}`);
    assert(changed, `review root/session race ${callNumber} did not execute`);
    const observed = await raceBackend.reopenDisk(binding);
    const active = await observed.exportActiveClosure();
    assert(active.generation === 1n && active.headSeq === 2n,
      `review root/session race ${callNumber} did not leave the exact intruder root active`);
    observed.close();
    assert(await referenceCount(raceBackend) === 0,
      `review root/session race ${callNumber} leaked a durable root pin`);
    raceController.close();
  }

  /* On a post-pin continuity loss the new session atomically purges the
   * transient snapshot.  Simulate a completion-response loss on that purge;
   * the still-branded authority must recover it before issuing a new lease. */
  const recoveryPrefix = `cadr-m10-review-acquire-recovery-${state.run.slice(0, 12)}`;
  const recoveryRawBackend = createCadrM10IndexedDbBackend({ databasePrefix: recoveryPrefix });
  let continuityBroken = false;
  const recoveryBackend = reviewBackendAfterAwait(recoveryRawBackend, 2, async () => {
    continuityBroken = true;
    await changeReviewRootAndSession(recoveryRawBackend, 199);
  }, { postCommitFirstUnpinFailure: true });
  const recoveryController = reviewController(recoveryBackend);
  await recoveryController.open({ initialize: true });
  const recoveryAuthority = recoveryController.claimSnapshotReviewAuthority();
  await rejects(() => recoveryAuthority.acquire(), /acquisition failed and pin rollback failed/,
    "post-pin continuity failure with lost rollback receipt was accepted");
  assert(continuityBroken, "post-pin recovery fixture did not replace the active session");
  const recoveredLease = await recoveryAuthority.acquire();
  assert(await referenceCount(recoveryRawBackend) === 1,
    "branded authority recovery did not issue exactly one replacement snapshot pin");
  await recoveredLease.release();
  assert(await referenceCount(recoveryRawBackend) === 0,
    "branded authority recovery left a snapshot reference after release");
  recoveryController.close();
}

async function main() {
  let state = load();
  if (state === null || state.version !== 4) { state = initialState(); save(state); }
  if (state.pending !== null) {
    const resumed = state.pending;
    await verifyScenario(state, resumed);
    await assertForeignUuid(resumed.foreignFingerprint);
    state.index += 1;
    save(state);
  }
  while (state.index < CADR_M10_INDEXEDDB_DURABLE_SEAMS.length * modes.length) {
    const scenario = scenarioFor(state.index);
    const prefix = prefixFor(state, scenario);
    const foreignFingerprint = await seedForeignUuid(prefix);
    if (scenario.mode === "terminate") await runTerminateScenario(state, scenario, prefix, foreignFingerprint);
    else await runScenario(state, scenario, prefix, foreignFingerprint);
    state.index += 1;
    save(state);
  }
  await proveForeignOrigin(state);
  await proveVersionChange(state);
  await proveStaleClose(state);
  await proveSchemaRejection(state);
  await proveRecoverySnapshotAndQuarantine(state);
  await proveActivationBoundary(state);
  await proveActiveClosureAndCompaction(state);
  await proveCompactionHeadRace(state);
  await proveV1ReferenceMigration(state);
  await proveV2ReferenceUpgradeBoundary(state);
  await proveDurableRootReferences(state);
  await proveControllerReviewAuthority(state);
  assert(durability.strict > 0 && durability.lax === 0,
    `readwrite durability instrumentation failed: ${JSON.stringify(durability)}`);
  document.body.dataset.status = "ok";
  document.body.textContent = JSON.stringify({
    status: "ok", seams: CADR_M10_INDEXEDDB_DURABLE_SEAMS, modes,
    results: state.results.length, followups: state.results.filter((result) => result.followup).length,
    foreignOrigin: state.foreign !== null, versionChange: state.versionChange === true,
    staleClose: true, schemaRejection: true, recoveryQuarantine: true,
    activationBoundary: CADR_M10_MAX_ACTIVATION_RECORDS,
    activeClosureCompaction: true, referenceMigration: true, opaqueReferenceMigration: true,
    durableRootReferences: true, crossKindReferenceForgery: true,
    reviewReferenceRecovery: true,
    reviewAuthority: true, durability,
  });
  sessionStorage.removeItem(STORAGE_KEY);
}

main().catch(fail);
