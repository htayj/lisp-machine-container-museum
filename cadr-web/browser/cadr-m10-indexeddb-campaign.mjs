import {
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_STORES,
  createCadrM10IndexedDbBackend,
} from "./cadr-m10-indexeddb.mjs";
import {
  CADR_M10_BASE_SHA256,
  CADR_M10_MAX_ACTIVATION_RECORDS,
  cadrM10Sha256,
  hexBytes,
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
function save(state) { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null"); }
function initialState() {
  return { version: 2, run: crypto.randomUUID(), index: 0, results: [], pending: null, foreign: null };
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
    const request = indexedDB.open(name, 2);
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
      rejected = /database schema (?:stores differ|for )/.test(error?.message ?? "");
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

async function main() {
  let state = load();
  if (state === null || state.version !== 2) { state = initialState(); save(state); }
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
  assert(durability.strict > 0 && durability.lax === 0,
    `readwrite durability instrumentation failed: ${JSON.stringify(durability)}`);
  document.body.dataset.status = "ok";
  document.body.textContent = JSON.stringify({
    status: "ok", seams: CADR_M10_INDEXEDDB_DURABLE_SEAMS, modes,
    results: state.results.length, followups: state.results.filter((result) => result.followup).length,
    foreignOrigin: state.foreign !== null, versionChange: state.versionChange === true,
    staleClose: true, schemaRejection: true, recoveryQuarantine: true,
    activationBoundary: CADR_M10_MAX_ACTIVATION_RECORDS,
    activeClosureCompaction: true, durability,
  });
  sessionStorage.removeItem(STORAGE_KEY);
}

main().catch(fail);
