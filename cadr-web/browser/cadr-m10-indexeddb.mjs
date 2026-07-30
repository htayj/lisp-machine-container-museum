/*
 * C-M10-IDB-v1: a browser-only durable selection adapter.
 *
 * The worker/core owns COW planning.  This module owns only immutable-object
 * staging and the durable, all-or-nothing head plus activation publication.
 * It deliberately has one IndexedDB database per disk UUID, so a handle cannot
 * name or mutate another disk's control namespace.
 */

import {
  CADR_M10_BASE_SHA256,
  CADR_M10_HEAD_BYTES,
  CADR_M10_MAX_ACTIVATION_RECORDS,
  CADR_M10_NODE_BYTES,
  CADR_M10_MANIFEST_BYTES,
  CadrM10ConflictError,
  CadrM10FormatError,
  CadrM10RecoveryError,
  cadrM10Sha256,
  hexBytes,
  parseCdrOvh1,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvh1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../wasm/cadr-m10-persistence.mjs";

export const CADR_M10_INDEXEDDB_PROFILE = "C-M10-IDB-v1";
export const CADR_M10_INDEXEDDB_SCHEMA = 1;
export const CADR_M10_INDEXEDDB_DURABILITY = "strict";
export const CADR_M10_INDEXEDDB_PREFIX = "cadr-m10-indexeddb-v1";
export const CADR_M10_INDEXEDDB_STORES = Object.freeze({
  meta: "m10-meta", pages: "m10-pages", nodes: "m10-nodes",
  manifests: "m10-manifests", heads: "m10-heads", activations: "m10-activations",
  quarantine: "m10-quarantine",
});
export const CADR_M10_INDEXEDDB_DURABLE_SEAMS = Object.freeze([
  "before-stage", "after-stage", "before-head-activation",
  "after-head-activation", "before-reread-head", "after-reread-head",
]);
export const CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS = Object.freeze([
  "stage-transaction-outstanding", "head-transaction-outstanding",
]);

const ZERO_HASH = new Uint8Array(32);
const TEXT = new TextEncoder();
const MAX_U64 = 0xffffffffffffffffn;
const MAX_OBJECTS = 300000;
const META_KEY = "control";
const HEAD_KEY = "head";
const META_FIELDS = Object.freeze([
  "key", "schema", "phase", "diskKey", "baseSha256", "profileSha256",
  "artifactSetSha256", "generationHighWater", "writerHighWater",
  "sessionHighWater", "activeSession", "activeWriterEpoch",
  "pendingGeneration", "pendingSession",
]);

export class CadrM10IndexedDbError extends Error {
  constructor(message, cause = undefined) {
    super(`C-M10-IDB: ${message}`, cause === undefined ? undefined : { cause });
    this.name = "CadrM10IndexedDbError";
  }
}

export class CadrM10IndexedDbQuotaError extends CadrM10IndexedDbError {
  constructor(message, cause = undefined) { super(message, cause); this.name = "CadrM10IndexedDbQuotaError"; }
}

export class CadrM10IndexedDbVersionChangeError extends CadrM10IndexedDbError {
  constructor(message, cause = undefined) { super(message, cause); this.name = "CadrM10IndexedDbVersionChangeError"; }
}

function required(condition, message, ErrorType = CadrM10IndexedDbError) {
  if (!condition) throw new ErrorType(message);
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

function copyExact(value, length, label) {
  const bytes = bytesOf(value);
  required(bytes !== null && bytes.byteLength === length, `${label} must be exactly ${length} bytes`, CadrM10FormatError);
  return bytes.slice();
}

function equalBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function checkedU64(value, label, { nonzero = false } = {}) {
  required(typeof value === "bigint" && value >= 0n && value <= MAX_U64 && (!nonzero || value !== 0n),
    `${label} must be a canonical ${nonzero ? "nonzero " : ""}u64`, CadrM10FormatError);
  return value;
}

function u64Text(value, label, options = {}) { return checkedU64(value, label, options).toString(); }

function parseU64Text(value, label, { nonzero = false } = {}) {
  required(typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value),
    `${label} must be canonical decimal u64`, CadrM10FormatError);
  let number;
  try { number = BigInt(value); } catch { throw new CadrM10FormatError(`C-M10-IDB: ${label} is not u64`); }
  required(number <= MAX_U64 && (!nonzero || number !== 0n), `${label} is outside u64`, CadrM10FormatError);
  return number;
}

function diskKey(value) { return hexBytes(copyExact(value, 16, "disk UUID")); }

function activationKey(key, sequence) { return `${key}:${u64Text(sequence, "activation sequence", { nonzero: true })}`; }

function checkedPrefix(value) {
  required(typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(value),
    "databasePrefix must be 1..48 lowercase ASCII letters, digits, or hyphens", CadrM10FormatError);
  return value;
}

function onlyFields(value, fields, label) {
  required(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`, CadrM10FormatError);
  const actual = Object.keys(value).sort(); const expected = [...fields].sort();
  required(actual.length === expected.length && actual.every((field, index) => field === expected[index]),
    `${label} has an open or noncanonical schema`, CadrM10FormatError);
}

function binaryRecord(value, label) {
  onlyFields(value, ["key", "bytes"], label);
  required(typeof value.key === "string" && /^[0-9a-f]{64}$/.test(value.key), `${label} key`, CadrM10FormatError);
  required(value.bytes instanceof ArrayBuffer, `${label} bytes must be ArrayBuffer`, CadrM10FormatError);
  return { key: value.key, bytes: new Uint8Array(value.bytes).slice() };
}

function headRecord(value, key) {
  onlyFields(value, ["key", "headBytes"], "head record");
  required(value.key === HEAD_KEY && key === HEAD_KEY && value.headBytes instanceof ArrayBuffer,
    "head record binding", CadrM10FormatError);
  return new Uint8Array(value.headBytes).slice();
}

function activationRecord(value, expectedKey = null, expectedDiskKey = null) {
  onlyFields(value, ["key", "diskKey", "headSeq", "headBytes"], "activation record");
  required(typeof value.key === "string" && typeof value.diskKey === "string" && /^[0-9a-f]{32}$/.test(value.diskKey),
    "activation namespace", CadrM10FormatError);
  const sequence = parseU64Text(value.headSeq, "activation sequence", { nonzero: true });
  required(value.key === activationKey(value.diskKey, sequence) && (expectedKey === null || value.key === expectedKey),
    "activation key", CadrM10FormatError);
  required(expectedDiskKey === null || value.diskKey === expectedDiskKey,
    "activation disk namespace", CadrM10FormatError);
  required(value.headBytes instanceof ArrayBuffer && value.headBytes.byteLength === CADR_M10_HEAD_BYTES,
    "activation bytes", CadrM10FormatError);
  const headBytes = new Uint8Array(value.headBytes).slice();
  const headView = new DataView(headBytes.buffer);
  required(headView.getBigUint64(24, true) === sequence &&
    hexBytes(headBytes.subarray(40, 56)) === value.diskKey,
  "activation outer fields differ from encoded head", CadrM10FormatError);
  return { key: value.key, diskKey: value.diskKey, headSeq: sequence, headBytes };
}

function metaRecord(value, binding) {
  onlyFields(value, META_FIELDS, "meta record");
  required(value.key === META_KEY && value.schema === CADR_M10_INDEXEDDB_SCHEMA && value.phase === "OPEN" &&
    value.diskKey === binding.key && value.baseSha256 === hexBytes(binding.baseSha256) &&
    value.profileSha256 === hexBytes(binding.profileSha256) && value.artifactSetSha256 === hexBytes(binding.artifactSetSha256),
  "meta binding", CadrM10RecoveryError);
  const result = { ...value };
  for (const field of ["generationHighWater", "writerHighWater", "sessionHighWater", "activeSession",
    "activeWriterEpoch", "pendingGeneration", "pendingSession"]) result[field] = parseU64Text(value[field], `meta ${field}`);
  required(result.activeSession <= result.sessionHighWater && result.activeWriterEpoch <= result.writerHighWater &&
    result.pendingGeneration <= result.generationHighWater && result.pendingSession <= result.sessionHighWater,
  "meta monotonic bounds", CadrM10RecoveryError);
  return result;
}

function storedMeta(binding, values) {
  return Object.freeze({ key: META_KEY, schema: CADR_M10_INDEXEDDB_SCHEMA, phase: "OPEN", diskKey: binding.key,
    baseSha256: hexBytes(binding.baseSha256), profileSha256: hexBytes(binding.profileSha256),
    artifactSetSha256: hexBytes(binding.artifactSetSha256),
    generationHighWater: u64Text(values.generationHighWater, "generation high-water"),
    writerHighWater: u64Text(values.writerHighWater, "writer high-water"),
    sessionHighWater: u64Text(values.sessionHighWater, "session high-water"),
    activeSession: u64Text(values.activeSession, "active session"),
    activeWriterEpoch: u64Text(values.activeWriterEpoch, "active writer epoch"),
    pendingGeneration: u64Text(values.pendingGeneration, "pending generation"),
    pendingSession: u64Text(values.pendingSession, "pending session"),
  });
}

function asStoredBinary(key, bytes) { return Object.freeze({ key, bytes: bytes.slice().buffer }); }

function asStoredHead(bytes) { return Object.freeze({ key: HEAD_KEY, headBytes: bytes.slice().buffer }); }

function asStoredActivation(key, sequence, bytes) {
  return Object.freeze({ key: activationKey(key, sequence), diskKey: key, headSeq: sequence.toString(), headBytes: bytes.slice().buffer });
}

function asStoredQuarantine(key, reason) {
  required(typeof key === "string" && key.length > 0 && key.length <= 512 && typeof reason === "string" && reason.length > 0 && reason.length <= 256,
    "quarantine record", CadrM10FormatError);
  return Object.freeze({ key, reason });
}

function boundedQuarantineKey(value) {
  const textValue = typeof value === "string" ? value : JSON.stringify(value);
  const text = textValue ?? "undefined"; let left = 0x811c9dc5; let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    left = Math.imul(left ^ text.charCodeAt(index), 0x01000193) >>> 0;
    right = Math.imul(right ^ text.charCodeAt(text.length - index - 1), 0x85ebca6b) >>> 0;
  }
  return `activation:${text.length}:${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
}

function errorFor(event, fallback) {
  const error = event?.target?.error ?? event?.target?.transaction?.error ?? fallback;
  if (error?.name === "QuotaExceededError") return new CadrM10IndexedDbQuotaError("IndexedDB quota prevented a complete transaction", error);
  if (error?.name === "VersionError" || error?.name === "InvalidStateError") return new CadrM10IndexedDbVersionChangeError("IndexedDB version changed or was closed", error);
  return error instanceof Error ? error : new CadrM10IndexedDbError("IndexedDB transaction aborted", error);
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(errorFor(event, request.error));
  });
}

function openDatabase(indexedDB, name) {
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDB.open(name, CADR_M10_INDEXEDDB_SCHEMA); }
    catch (error) { reject(errorFor(null, error)); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const namePart of Object.values(CADR_M10_INDEXEDDB_STORES)) {
        if (!db.objectStoreNames.contains(namePart)) db.createObjectStore(namePart, { keyPath: "key" });
      }
    };
    request.onerror = (event) => reject(errorFor(event, request.error));
    request.onblocked = () => reject(new CadrM10IndexedDbVersionChangeError("database upgrade is blocked"));
    request.onsuccess = () => {
      const db = request.result;
      const actual = [...db.objectStoreNames];
      const expected = Object.values(CADR_M10_INDEXEDDB_STORES).sort();
      if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
        db.close();
        reject(new CadrM10IndexedDbVersionChangeError(
          `database schema stores differ: expected ${expected.join(",")}; received ${actual.join(",")}`));
        return;
      }
      const schemaTransaction = db.transaction(expected, "readonly");
      for (const storeName of expected) {
        const store = schemaTransaction.objectStore(storeName);
        if (store.keyPath !== "key" || store.autoIncrement || store.indexNames.length !== 0) {
          db.close();
          reject(new CadrM10IndexedDbVersionChangeError(
            `database schema for ${storeName} must have keyPath "key", autoIncrement false, and zero indexes`));
          return;
        }
      }
      resolve(db);
    };
  });
}

function idbTransaction(db, names, mode) {
  try {
    return mode === "readwrite"
      ? db.transaction(names, mode, { durability: CADR_M10_INDEXEDDB_DURABILITY })
      : db.transaction(names, mode);
  } catch (error) {
    if (mode === "readwrite" && error instanceof TypeError) {
      throw new CadrM10IndexedDbError("strict IndexedDB transaction durability is unavailable", error);
    }
    throw error;
  }
}

function txPromise(db, names, mode, schedule) {
  return new Promise((resolve, reject) => {
    let transaction; let settled = false; let result;
    try { transaction = idbTransaction(db, names, mode); }
    catch (error) { reject(errorFor(null, error)); return; }
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { transaction.abort(); } catch { /* already completing */ }
      reject(errorFor(null, error));
    };
    transaction.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
    transaction.onerror = (event) => { if (!settled) { settled = true; reject(errorFor(event, transaction.error)); } };
    transaction.onabort = (event) => { if (!settled) { settled = true; reject(errorFor(event, transaction.error)); } };
    try { result = schedule(transaction, fail); } catch (error) { fail(error); }
  });
}

function requestChain(items, visit, done, fail) {
  let index = 0;
  const next = () => {
    if (index === items.length) { done(); return; }
    const item = items[index++];
    try { visit(item, next); } catch (error) { fail(error); }
  };
  next();
}

function checkedBinding(value) {
  required(value !== null && typeof value === "object", "disk binding must be an object", CadrM10FormatError);
  const baseSha256 = copyExact(value.baseSha256 ?? CADR_M10_BASE_SHA256, 32, "base SHA-256");
  required(equalBytes(baseSha256, CADR_M10_BASE_SHA256), "base SHA-256 differs from selected C-M10 base", CadrM10FormatError);
  const diskUuid = copyExact(value.diskUuid, 16, "disk UUID");
  return Object.freeze({ diskUuid, key: diskKey(diskUuid), baseSha256,
    profileSha256: copyExact(value.profileSha256, 32, "profile SHA-256"),
    artifactSetSha256: copyExact(value.artifactSetSha256, 32, "artifact-set SHA-256") });
}

function sameBinding(left, right) {
  return left.key === right.key && equalBytes(left.baseSha256, right.baseSha256) &&
    equalBytes(left.profileSha256, right.profileSha256) && equalBytes(left.artifactSetSha256, right.artifactSetSha256);
}

async function parseImmutable(kind, input) {
  const bytes = copyExact(input, kind === "pages" ? 1024 : (kind === "nodes" ? CADR_M10_NODE_BYTES : CADR_M10_MANIFEST_BYTES), `${kind} object`);
  if (kind === "pages") return { key: hexBytes(await cadrM10Sha256(bytes)), bytes };
  const parsed = kind === "nodes" ? await parseCdrOvn1(bytes) : await parseCdrOvm1(bytes);
  return { key: hexBytes(parsed.hash), bytes };
}

function snapshotObjects(objects = {}) {
  required(objects !== null && typeof objects === "object" && !Array.isArray(objects), "objects must be an object", CadrM10FormatError);
  const unknown = Object.keys(objects).filter((key) => !["pages", "nodes", "manifests"].includes(key));
  required(unknown.length === 0, "objects has an unknown store", CadrM10FormatError);
  const output = { pages: [], nodes: [], manifests: [] };
  for (const kind of ["pages", "nodes", "manifests"]) {
    const entries = objects[kind] ?? [];
    required(Array.isArray(entries), `${kind} must be an array`, CadrM10FormatError);
    const length = kind === "pages" ? 1024 : (kind === "nodes" ? CADR_M10_NODE_BYTES : CADR_M10_MANIFEST_BYTES);
    for (const entry of entries) output[kind].push(copyExact(entry, length, `${kind} object`));
  }
  return output;
}

async function normalizeObjects(objects = {}) {
  const copied = snapshotObjects(objects); const output = [];
  for (const kind of ["pages", "nodes", "manifests"]) {
    for (const entry of copied[kind]) output.push({ kind, ...(await parseImmutable(kind, entry)) });
  }
  return output;
}

function verifySchemaSynchronous(kind, value, expectedKey) {
  const record = binaryRecord(value, `${kind} record`);
  required(record.key === expectedKey, `${kind} record key mismatch`, CadrM10FormatError);
  return record.bytes;
}

async function decodeImmutable(kind, value, expectedKey) {
  const bytes = verifySchemaSynchronous(kind, value, expectedKey);
  const parsed = await parseImmutable(kind, bytes);
  required(parsed.key === expectedKey, `${kind} content key/hash mismatch`, CadrM10FormatError);
  return parsed.bytes;
}

function isZeroHash(bytes) { return equalBytes(bytes, ZERO_HASH); }

async function getImmutable(db, kind, key) {
  const record = await requestAsPromise(idbTransaction(db, CADR_M10_INDEXEDDB_STORES[kind], "readonly")
    .objectStore(CADR_M10_INDEXEDDB_STORES[kind]).get(key));
  required(record !== undefined, `${kind} object ${key} is missing`, CadrM10RecoveryError);
  return decodeImmutable(kind, record, key);
}

async function verifyClosure(db, manifest, sessionCheck) {
  const queue = [{ type: "nodes", hash: manifest.rootSha256, level: 2, prefix: 0n }];
  const nodes = new Set(); const manifests = new Set([hexBytes(manifest.hash)]); let pages = 0;
  while (queue.length) {
    required(nodes.size + manifests.size + pages < MAX_OBJECTS, "reachable overlay closure exceeds C-M10-IDB bound", CadrM10RecoveryError);
    const current = queue.pop(); const key = hexBytes(current.hash);
    if (nodes.has(key)) throw new CadrM10RecoveryError("reachable overlay contains a repeated node");
    nodes.add(key);
    const node = await parseCdrOvn1(await getImmutable(db, "nodes", key));
    await sessionCheck();
    required(node.level === current.level && node.prefix === current.prefix, "node level/prefix differs from radix edge", CadrM10RecoveryError);
    for (let index = 0; index < 256; index += 1) {
      const child = node.children[index]; if (isZeroHash(child)) continue;
      if (node.level === 0) {
        const lba = node.prefix | BigInt(index);
        required(lba <= 263244n, "node refers outside the immutable base", CadrM10RecoveryError);
        const page = await getImmutable(db, "pages", hexBytes(child));
        await sessionCheck();
        required(page.byteLength === 1024, "stored page length", CadrM10RecoveryError);
        pages += 1;
      } else {
        const prefix = node.prefix | (BigInt(index) << BigInt(node.level * 8));
        queue.push({ type: "nodes", hash: child, level: node.level - 1, prefix });
      }
    }
  }
  required(BigInt(pages) === manifest.entryCount, "manifest entry count differs from reachable overlay", CadrM10RecoveryError);
}

/* A transaction-based snapshot avoids a mixed control pair; parsing happens after its bytes are copied. */
async function atomicControlSnapshot(db, binding) {
  const values = await new Promise((resolve, reject) => {
    let transaction;
    try { transaction = idbTransaction(db, [CADR_M10_INDEXEDDB_STORES.meta, CADR_M10_INDEXEDDB_STORES.heads, CADR_M10_INDEXEDDB_STORES.activations], "readonly"); }
    catch (error) { reject(errorFor(null, error)); return; }
    let meta; let headBytes; let activation;
    const fail = (error) => { try { transaction.abort(); } catch {} reject(errorFor(null, error)); };
    transaction.onerror = (event) => reject(errorFor(event, transaction.error));
    transaction.onabort = (event) => reject(errorFor(event, transaction.error));
    transaction.oncomplete = () => resolve({ meta, headBytes, activation });
    const metaRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get(META_KEY);
    metaRequest.onerror = () => fail(metaRequest.error);
    metaRequest.onsuccess = () => {
      try {
        meta = metaRecord(metaRequest.result, binding);
        const headRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).get(HEAD_KEY);
        headRequest.onerror = () => fail(headRequest.error);
        headRequest.onsuccess = () => {
          try {
            headBytes = headRecord(headRequest.result, HEAD_KEY);
            const sequence = new DataView(headBytes.buffer).getBigUint64(24, true);
            const activationRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).get(activationKey(binding.key, sequence));
            activationRequest.onerror = () => fail(activationRequest.error);
            activationRequest.onsuccess = () => {
              try { activation = activationRecord(activationRequest.result, activationKey(binding.key, sequence), binding.key); }
              catch (error) { fail(error); }
            };
          } catch (error) { fail(error); }
        };
      } catch (error) { fail(error); }
    };
  });
  const head = await parseCdrOvh1(values.headBytes);
  return { ...values, head };
}

async function verifyManifestLineage(db, binding, manifest, sessionCheck) {
  let current = manifest; const seen = new Set();
  while (true) {
    const key = hexBytes(current.hash);
    required(!seen.has(key), "manifest lineage contains a cycle", CadrM10RecoveryError);
    seen.add(key);
    required(equalBytes(current.diskUuid, binding.diskUuid) && equalBytes(current.baseSha256, binding.baseSha256) &&
      equalBytes(current.profileSha256, binding.profileSha256) && equalBytes(current.artifactSetSha256, binding.artifactSetSha256),
    "manifest lineage binding differs from open disk", CadrM10RecoveryError);
    if (current.generation === 0n) {
      required(current.parentGeneration === 0n && isZeroHash(current.parentManifestSha256),
        "genesis manifest parent", CadrM10RecoveryError);
      return;
    }
    const parent = await parseCdrOvm1(await getImmutable(db, "manifests", hexBytes(current.parentManifestSha256)));
    await sessionCheck();
    required(parent.generation === current.parentGeneration && parent.generation < current.generation,
      "manifest parent generation differs", CadrM10RecoveryError);
    current = parent;
  }
}

function updateMetaTransaction(db, binding, mutate) {
  return new Promise((resolve, reject) => {
    let transaction;
    try { transaction = idbTransaction(db, CADR_M10_INDEXEDDB_STORES.meta, "readwrite"); }
    catch (error) { reject(errorFor(null, error)); return; }
    let result;
    const fail = (error) => { try { transaction.abort(); } catch {} reject(errorFor(null, error)); };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = (event) => reject(errorFor(event, transaction.error));
    transaction.onabort = (event) => reject(errorFor(event, transaction.error));
    const request = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get(META_KEY);
    request.onerror = () => fail(request.error);
    request.onsuccess = () => {
      try {
        const meta = metaRecord(request.result, binding); const next = mutate(meta);
        required(next !== null && typeof next === "object" && "values" in next, "meta mutation result", CadrM10IndexedDbError);
        transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).put(storedMeta(binding, next.values));
        result = next.result;
      } catch (error) { fail(error); }
    };
  });
}

export function createCadrM10IndexedDbBackend({
  databasePrefix = CADR_M10_INDEXEDDB_PREFIX,
  indexedDB = globalThis.indexedDB,
  seamHook = null,
  transactionHook = null,
  compactMarkHook = null,
} = {}) {
  const prefix = checkedPrefix(databasePrefix);
  required(indexedDB !== undefined && indexedDB !== null && typeof indexedDB.open === "function",
    "IndexedDB is unavailable", CadrM10IndexedDbError);
  required(seamHook === null || typeof seamHook === "function", "seamHook must be a function", CadrM10FormatError);
  required(transactionHook === null || typeof transactionHook === "function",
    "transactionHook must be a function", CadrM10FormatError);
  required(compactMarkHook === null || typeof compactMarkHook === "function",
    "compactMarkHook must be a function", CadrM10FormatError);
  const databases = new Map(); const closedByVersionChange = new Set(); const commits = new Set();

  const nameFor = (binding) => `${prefix}-${binding.key}`;
  const ensureLive = (binding) => {
    if (closedByVersionChange.has(binding.key)) throw new CadrM10IndexedDbVersionChangeError("database closed by versionchange");
  };
  const open = async (binding) => {
    ensureLive(binding); const existing = databases.get(binding.key);
    if (existing !== undefined) return existing;
    const db = await openDatabase(indexedDB, nameFor(binding));
    db.onversionchange = () => { closedByVersionChange.add(binding.key); databases.delete(binding.key); db.close(); };
    databases.set(binding.key, db); return db;
  };
  const seam = async (name, context) => {
    required(CADR_M10_INDEXEDDB_DURABLE_SEAMS.includes(name), `unknown durable seam ${name}`, CadrM10IndexedDbError);
    if (seamHook !== null) await seamHook(Object.freeze({ seam: name, diskUuid: context.binding.diskUuid.slice(), ...context }));
  };

  async function stage(db, objects) {
    const entries = await normalizeObjects(objects);
    if (entries.length === 0) return Object.freeze({ staged: 0 });
    await txPromise(db, Object.values(CADR_M10_INDEXEDDB_STORES).slice(1, 4), "readwrite", (transaction, fail) => {
      requestChain(entries, (entry, next) => {
        const store = transaction.objectStore(CADR_M10_INDEXEDDB_STORES[entry.kind]);
        const request = store.get(entry.key);
        request.onerror = () => fail(request.error);
        request.onsuccess = () => {
          try {
            if (request.result === undefined) store.put(asStoredBinary(entry.key, entry.bytes));
            else required(equalBytes(verifySchemaSynchronous(entry.kind, request.result, entry.key), entry.bytes),
              `${entry.kind} immutable CAS collision`, CadrM10RecoveryError);
            next();
          } catch (error) { fail(error); }
        };
      }, () => {}, fail);
      if (transactionHook !== null) {
        required(transactionHook(Object.freeze({
          seam: "stage-transaction-outstanding",
        })) === undefined, "transactionHook must be synchronous",
        CadrM10FormatError);
      }
      return undefined;
    });
    return Object.freeze({ staged: entries.length });
  }

  async function createGenesis(binding) {
    const emptyRootBytes = await serializeCdrOvn1({ level: 2, prefix: 0n,
      children: Array.from({ length: 256 }, () => ZERO_HASH) });
    const root = await parseCdrOvn1(emptyRootBytes);
    const manifestBytes = await serializeCdrOvm1({ generation: 0n, parentGeneration: 0n, entryCount: 0n,
      diskUuid: binding.diskUuid, baseSha256: binding.baseSha256, profileSha256: binding.profileSha256,
      artifactSetSha256: binding.artifactSetSha256, rootSha256: root.hash });
    const manifest = await parseCdrOvm1(manifestBytes);
    const headBytes = await serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n, diskUuid: binding.diskUuid,
      activeGeneration: 0n, activeManifestSha256: manifest.hash, activeRootSha256: root.hash,
      previousGeneration: 0n, baseSha256: binding.baseSha256, profileSha256: binding.profileSha256 });
    return { root, emptyRootBytes, manifest, manifestBytes, headBytes };
  }

  async function initializeDisk(bindingValue) {
    const binding = checkedBinding(bindingValue); const db = await open(binding); const genesis = await createGenesis(binding);
    await stage(db, { nodes: [genesis.emptyRootBytes], manifests: [genesis.manifestBytes] });
    await new Promise((resolve, reject) => {
      let transaction;
      try { transaction = idbTransaction(db, [CADR_M10_INDEXEDDB_STORES.meta, CADR_M10_INDEXEDDB_STORES.heads, CADR_M10_INDEXEDDB_STORES.activations], "readwrite"); }
      catch (error) { reject(errorFor(null, error)); return; }
      const fail = (error) => { try { transaction.abort(); } catch {} reject(errorFor(null, error)); };
      transaction.oncomplete = resolve;
      transaction.onerror = (event) => reject(errorFor(event, transaction.error));
      transaction.onabort = (event) => reject(errorFor(event, transaction.error));
      const metaStore = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta);
      const request = metaStore.get(META_KEY);
      request.onerror = () => fail(request.error);
      request.onsuccess = () => {
        try {
          required(request.result === undefined, "disk UUID is already initialized", CadrM10ConflictError);
          const initial = { generationHighWater: 0n, writerHighWater: 0n, sessionHighWater: 1n,
            activeSession: 1n, activeWriterEpoch: 0n, pendingGeneration: 0n, pendingSession: 0n };
          metaStore.put(storedMeta(binding, initial));
          transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put(asStoredHead(genesis.headBytes));
          transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).put(asStoredActivation(binding.key, 1n, genesis.headBytes));
        } catch (error) { fail(error); }
      };
    });
    return makeHandle(binding, db, 1n, false);
  }

  async function reopenDisk(bindingValue) {
    const binding = checkedBinding(bindingValue); const db = await open(binding);
    required(!commits.has(binding.key), "cannot reopen during an active commit", CadrM10ConflictError);
    const session = await updateMetaTransaction(db, binding, (meta) => {
      required(meta.sessionHighWater < MAX_U64, "session token exhausted", CadrM10RecoveryError);
      const next = { ...meta, sessionHighWater: meta.sessionHighWater + 1n, activeSession: meta.sessionHighWater + 1n,
        activeWriterEpoch: 0n, pendingGeneration: 0n, pendingSession: 0n };
      return { values: next, result: next.activeSession };
    });
    const recovered = await recoverActive({ binding, db, session, readOnly: false });
    return makeHandle(binding, db, session, recovered.recovered, recovered.recovered ? {
      headBytes: recovered.headBytes.slice(), manifestBytes: recovered.manifestBytes.slice(),
    } : null);
  }

  async function assertSession(handle) {
    assertHandleOpen(handle);
    ensureLive(handle.binding); const record = metaRecord(await requestAsPromise(idbTransaction(handle.db, CADR_M10_INDEXEDDB_STORES.meta, "readonly")
      .objectStore(CADR_M10_INDEXEDDB_STORES.meta).get(META_KEY)), handle.binding);
    assertHandleOpen(handle);
    required(record.activeSession === handle.session, "stale open-session handle", CadrM10ConflictError);
    return record;
  }

  function assertHandleOpen(handle) {
    required(handle.closed !== true, "closed handle", CadrM10ConflictError);
  }

  async function readActive(handle) {
    await assertSession(handle);
    const snapshot = await atomicControlSnapshot(handle.db, handle.binding);
    await assertSession(handle);
    required(snapshot.meta.activeSession === handle.session, "stale open-session handle", CadrM10ConflictError);
    const { head, activation } = snapshot;
    required(equalBytes(head.diskUuid, handle.binding.diskUuid) && equalBytes(head.baseSha256, handle.binding.baseSha256) &&
      equalBytes(head.profileSha256, handle.binding.profileSha256), "head binding differs from open disk", CadrM10RecoveryError);
    required(activation.diskKey === handle.binding.key && activation.headSeq === head.headSeq && equalBytes(activation.headBytes, snapshot.headBytes),
      "head has no identical activation", CadrM10RecoveryError);
    const manifestBytes = await getImmutable(handle.db, "manifests", hexBytes(head.activeManifestSha256));
    await assertSession(handle);
    const manifest = await parseCdrOvm1(manifestBytes);
    required(equalBytes(manifest.diskUuid, handle.binding.diskUuid) && equalBytes(manifest.baseSha256, handle.binding.baseSha256) &&
      equalBytes(manifest.profileSha256, handle.binding.profileSha256) && equalBytes(manifest.artifactSetSha256, handle.binding.artifactSetSha256) &&
      manifest.generation === head.activeGeneration && equalBytes(manifest.rootSha256, head.activeRootSha256),
    "active manifest binding differs from head", CadrM10RecoveryError);
    await verifyManifestLineage(handle.db, handle.binding, manifest, () => assertSession(handle));
    await verifyClosure(handle.db, manifest, () => assertSession(handle));
    await assertSession(handle);
    return Object.freeze({ head, headBytes: snapshot.headBytes.slice(), manifest,
      manifestBytes: manifestBytes.slice(), recovered: handle.readOnly });
  }

  async function readRecoveredActive(handle) {
    await assertSession(handle);
    const head = await parseCdrOvh1(handle.recoveredSnapshot.headBytes.slice());
    await assertSession(handle);
    const manifest = await parseCdrOvm1(handle.recoveredSnapshot.manifestBytes.slice());
    await assertSession(handle);
    return Object.freeze({ head, headBytes: handle.recoveredSnapshot.headBytes.slice(), manifest,
      manifestBytes: handle.recoveredSnapshot.manifestBytes.slice(), recovered: true });
  }

  async function recoverActive(handle) {
    try { return { ...(await readActive(handle)), recovered: false }; }
    catch (headFailure) {
      await assertSession(handle);
      const activations = await new Promise((resolve, reject) => {
        let transaction;
        try { transaction = idbTransaction(handle.db, CADR_M10_INDEXEDDB_STORES.activations, "readonly"); }
        catch (error) { reject(errorFor(null, error)); return; }
        const request = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).getAll(undefined, CADR_M10_MAX_ACTIVATION_RECORDS + 1);
        request.onerror = (event) => reject(errorFor(event, request.error));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = (event) => reject(errorFor(event, transaction.error));
        transaction.onabort = (event) => reject(errorFor(event, transaction.error));
      });
      required(activations.length <= CADR_M10_MAX_ACTIVATION_RECORDS, "activation scan exceeds C-M10-IDB bound", CadrM10RecoveryError);
      const candidates = []; const malformed = [];
      for (const raw of activations) {
        try { candidates.push(activationRecord(raw, null, handle.binding.key)); }
        catch (error) { malformed.push({ raw, reason: error.message }); }
      }
      await quarantineActivationRecords(handle, malformed);
      candidates.sort((left, right) => left.headSeq === right.headSeq ? 0 : (left.headSeq > right.headSeq ? -1 : 1));
      for (const candidate of candidates) {
        try {
          const exactRaw = await requestAsPromise(idbTransaction(handle.db,
            CADR_M10_INDEXEDDB_STORES.activations, "readonly")
            .objectStore(CADR_M10_INDEXEDDB_STORES.activations).get(candidate.key));
          const exact = activationRecord(exactRaw, candidate.key, handle.binding.key);
          required(equalBytes(exact.headBytes, candidate.headBytes),
            "activation changed during recovery", CadrM10ConflictError);
          const head = await parseCdrOvh1(exact.headBytes); await assertSession(handle);
          required(head.headSeq === exact.headSeq, "activation sequence differs from parsed head", CadrM10RecoveryError);
          required(equalBytes(head.diskUuid, handle.binding.diskUuid) && equalBytes(head.baseSha256, handle.binding.baseSha256) &&
            equalBytes(head.profileSha256, handle.binding.profileSha256), "activation head binding", CadrM10RecoveryError);
          const manifestBytes = await getImmutable(handle.db, "manifests", hexBytes(head.activeManifestSha256));
          const manifest = await parseCdrOvm1(manifestBytes);
          await assertSession(handle);
          required(manifest.generation === head.activeGeneration && equalBytes(manifest.rootSha256, head.activeRootSha256),
            "activation manifest binding", CadrM10RecoveryError);
          await verifyManifestLineage(handle.db, handle.binding, manifest, () => assertSession(handle));
          await verifyClosure(handle.db, manifest, () => assertSession(handle));
          return { head, headBytes: exact.headBytes.slice(), manifest,
            manifestBytes: manifestBytes.slice(), recovered: true };
        } catch { /* keep searching the bounded candidate set */ }
      }
      throw new CadrM10RecoveryError(`C-M10-IDB: no valid activated generation (${headFailure.message})`);
    }
  }

  async function quarantineActivationRecords(handle, malformed) {
    if (malformed.length === 0) return;
    const entries = [];
    for (const item of malformed) {
      const rawKey = item.raw?.key;
      const keyText = typeof rawKey === "string" ? rawKey : JSON.stringify(rawKey);
      const digest = hexBytes(await cadrM10Sha256(TEXT.encode(keyText ?? "undefined")));
      entries.push({ rawKey, quarantineKey: `activation:${digest}`,
        reason: String(item.reason).slice(0, 256) || "noncanonical activation record" });
    }
    await assertSession(handle);
    await txPromise(handle.db,
      [CADR_M10_INDEXEDDB_STORES.activations, CADR_M10_INDEXEDDB_STORES.quarantine],
      "readwrite", (transaction) => {
        const activations = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations);
        const quarantine = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.quarantine);
        for (const entry of entries) {
          if (entry.rawKey !== undefined) activations.delete(entry.rawKey);
          quarantine.put(asStoredQuarantine(entry.quarantineKey, entry.reason));
        }
      });
    await assertSession(handle);
  }

  async function prepareActivationSlot(handle, nextSequence) {
    const db = handle.db; const binding = handle.binding; const current = await readActive(handle);
    await assertSession(handle);
    await new Promise((resolve, reject) => {
      let transaction;
      try { transaction = idbTransaction(db, [CADR_M10_INDEXEDDB_STORES.activations, CADR_M10_INDEXEDDB_STORES.quarantine], "readwrite"); }
      catch (error) { reject(errorFor(null, error)); return; }
      const fail = (error) => { try { transaction.abort(); } catch {} reject(errorFor(null, error)); };
      transaction.oncomplete = resolve;
      transaction.onerror = (event) => reject(errorFor(event, transaction.error));
      transaction.onabort = (event) => reject(errorFor(event, transaction.error));
      const activations = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations);
      const all = activations.getAll(undefined, CADR_M10_MAX_ACTIVATION_RECORDS + 1);
      all.onerror = () => fail(all.error);
      all.onsuccess = () => {
        try {
          required(all.result.length <= CADR_M10_MAX_ACTIVATION_RECORDS, "activation publication exceeds C-M10-IDB bound", CadrM10ConflictError);
          const protectedKeys = new Set([activationKey(binding.key, current.head.headSeq)]);
          if (current.head.headSeq > 1n) protectedKeys.add(activationKey(binding.key, current.head.headSeq - 1n));
          const disposable = []; const canonical = [];
          for (const raw of all.result) {
            try {
              const record = activationRecord(raw, null, binding.key);
              canonical.push(record);
              if (!protectedKeys.has(record.key)) disposable.push(record);
            } catch {
              /* This per-disk database contains no foreign UUID namespace. */
              const key = raw?.key;
              if (key !== undefined) activations.delete(key);
              transaction.objectStore(CADR_M10_INDEXEDDB_STORES.quarantine).put(
                asStoredQuarantine(boundedQuarantineKey(key), "noncanonical activation record"));
            }
          }
          required(!canonical.some((record) => record.key === activationKey(binding.key, nextSequence)),
            "activation sequence is already present", CadrM10ConflictError);
          if (canonical.length >= CADR_M10_MAX_ACTIVATION_RECORDS) {
            disposable.sort((left, right) => left.headSeq === right.headSeq ? left.key.localeCompare(right.key) :
              (left.headSeq < right.headSeq ? -1 : 1));
            required(disposable.length > 0, "activation log has no safely prunable record", CadrM10ConflictError);
            activations.delete(disposable[0].key);
          }
        } catch (error) { fail(error); }
      };
    });
  }

  async function publishHeadAndActivation(handle, writerEpoch, expected, nextHeadBytes) {
    const binding = handle.binding; const nextHead = await parseCdrOvh1(nextHeadBytes);
    return new Promise((resolve, reject) => {
      let transaction;
      try { transaction = idbTransaction(handle.db, [CADR_M10_INDEXEDDB_STORES.meta, CADR_M10_INDEXEDDB_STORES.heads, CADR_M10_INDEXEDDB_STORES.activations], "readwrite"); }
      catch (error) { reject(errorFor(null, error)); return; }
      let published = false;
      const fail = (error) => { try { transaction.abort(); } catch {} reject(errorFor(null, error)); };
      transaction.oncomplete = () => resolve(published);
      transaction.onerror = (event) => reject(errorFor(event, transaction.error));
      transaction.onabort = (event) => reject(errorFor(event, transaction.error));
      const metaRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get(META_KEY);
      if (transactionHook !== null) {
        try {
          required(transactionHook(Object.freeze({
            seam: "head-transaction-outstanding",
            diskUuid: binding.diskUuid.slice(), writerEpoch,
          })) === undefined, "transactionHook must be synchronous",
          CadrM10FormatError);
        } catch (error) { fail(error); return; }
      }
      metaRequest.onerror = () => fail(metaRequest.error);
      metaRequest.onsuccess = () => {
        try {
          const meta = metaRecord(metaRequest.result, binding);
          required(meta.activeSession === handle.session && meta.activeWriterEpoch === writerEpoch,
            "stale open-session or writer epoch", CadrM10ConflictError);
          required(meta.pendingGeneration === nextHead.activeGeneration && meta.pendingSession === handle.session,
            "generation was not reserved by this session", CadrM10ConflictError);
          const headRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).get(HEAD_KEY);
          headRequest.onerror = () => fail(headRequest.error);
          headRequest.onsuccess = () => {
            try {
              const oldHead = headRecord(headRequest.result, HEAD_KEY);
              required(equalBytes(oldHead, expected.headBytes), "stored head changed before activation", CadrM10ConflictError);
              const activationRequest = transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).get(activationKey(binding.key, expected.head.headSeq));
              activationRequest.onerror = () => fail(activationRequest.error);
              activationRequest.onsuccess = () => {
                try {
                  const oldActivation = activationRecord(activationRequest.result,
                    activationKey(binding.key, expected.head.headSeq), binding.key);
                  required(equalBytes(oldActivation.headBytes, expected.headBytes), "stored activation changed before activation", CadrM10ConflictError);
                  const nextMeta = { ...meta, activeWriterEpoch: 0n,
                    pendingGeneration: 0n, pendingSession: 0n };
                  /* These three writes are queued in one IDB transaction; no await or callback separates head/activation. */
                  transaction.objectStore(CADR_M10_INDEXEDDB_STORES.heads).put(asStoredHead(nextHeadBytes));
                  transaction.objectStore(CADR_M10_INDEXEDDB_STORES.activations).put(asStoredActivation(binding.key, nextHead.headSeq, nextHeadBytes));
                  transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).put(storedMeta(binding, nextMeta));
                  published = true;
                } catch (error) { fail(error); }
              };
            } catch (error) { fail(error); }
          };
        } catch (error) { fail(error); }
      };
    });
  }

  function makeHandle(binding, db, session, readOnly, recoveredSnapshot = null) {
    const handle = { binding, db, session, readOnly, recoveredSnapshot, closed: false };

    async function collectTree(rootHash, pages, nodes, sessionCheck) {
      const visit = async (hash, level) => {
        const key = hexBytes(hash);
        if (nodes.has(key)) return;
        const nodeBytes = await getImmutable(db, "nodes", key);
        const node = await parseCdrOvn1(nodeBytes);
        await sessionCheck();
        required(node.level === level, "overlay tree level changed during closure walk",
          CadrM10RecoveryError);
        nodes.set(key, nodeBytes.slice());
        for (const child of node.children) {
          if (isZeroHash(child)) continue;
          if (level === 0) {
            const pageKey = hexBytes(child);
            if (!pages.has(pageKey)) {
              const page = await getImmutable(db, "pages", pageKey);
              await sessionCheck();
              pages.set(pageKey, page.slice());
            }
          } else {
            await visit(child, level - 1);
          }
        }
      };
      await visit(rootHash, 2);
    }

    async function activeClosure({ includeLineage = false } = {}) {
      await assertSession(handle);
      const active = recoveredSnapshot === null ?
        await readActive(handle) : await readRecoveredActive(handle);
      const pages = new Map(); const nodes = new Map();
      const manifests = new Map();
      let manifest = active.manifest;
      for (;;) {
        const key = hexBytes(manifest.hash);
        if (manifests.has(key)) break;
        manifests.set(key, manifest.bytes.slice());
        await collectTree(manifest.rootSha256, pages, nodes,
          () => assertSession(handle));
        if (!includeLineage || manifest.generation === 0n) break;
        manifest = await parseCdrOvm1(await getImmutable(
          db, "manifests", hexBytes(manifest.parentManifestSha256)));
        await assertSession(handle);
      }
      await assertSession(handle);
      return Object.freeze({
        active,
        pages: Object.freeze([...pages.entries()].map(([key, bytes]) =>
          Object.freeze({ key, bytes: bytes.slice() }))),
        nodes: Object.freeze([...nodes.entries()].map(([key, bytes]) =>
          Object.freeze({ key, bytes: bytes.slice() }))),
        manifests: Object.freeze([...manifests.entries()].map(([key, bytes]) =>
          Object.freeze({ key, bytes: bytes.slice() }))),
      });
    }

    return Object.freeze({
      get diskUuid() { return binding.diskUuid.slice(); },
      get sessionId() { return session; },
      get databaseName() { return nameFor(binding); },
      get readOnly() { return readOnly; },
      async active() { return recoveredSnapshot === null ? readActive(handle) : readRecoveredActive(handle); },
      async exportActiveClosure() {
        const closure = await activeClosure();
        return Object.freeze({
          generation: closure.active.manifest.generation,
          headSeq: closure.active.head.headSeq,
          manifestSha256: closure.active.manifest.hash.slice(),
          entryCount: closure.active.manifest.entryCount,
          rootSha256: closure.active.manifest.rootSha256.slice(),
          pages: closure.pages,
          nodes: closure.nodes,
        });
      },
      async compact({ writerEpoch } = {}) {
        required(!readOnly, "recovered disk is read-only",
          CadrM10RecoveryError);
        checkedU64(writerEpoch, "writer epoch", { nonzero: true });
        const lease = await assertSession(handle);
        required(lease.activeWriterEpoch === writerEpoch &&
          lease.pendingGeneration === 0n,
        "compaction does not own the writer lease", CadrM10ConflictError);
        const closure = await activeClosure({ includeLineage: true });
        if (compactMarkHook !== null) {
          required(compactMarkHook(Object.freeze({
            writerEpoch, headBytes: closure.active.headBytes.slice(),
          })) === undefined,
          "compactMarkHook must be synchronous", CadrM10FormatError);
        }
        const retained = {
          pages: new Set(closure.pages.map(item => item.key)),
          nodes: new Set(closure.nodes.map(item => item.key)),
          manifests: new Set(closure.manifests.map(item => item.key)),
        };
        const removed = { pages: 0, nodes: 0, manifests: 0 };
        await assertSession(handle);
        await txPromise(db, [
          CADR_M10_INDEXEDDB_STORES.meta,
          CADR_M10_INDEXEDDB_STORES.heads,
          CADR_M10_INDEXEDDB_STORES.pages,
          CADR_M10_INDEXEDDB_STORES.nodes,
          CADR_M10_INDEXEDDB_STORES.manifests,
        ], "readwrite", (transaction, fail) => {
          const metaRequest = transaction.objectStore(
            CADR_M10_INDEXEDDB_STORES.meta).get(META_KEY);
          metaRequest.onerror = () => fail(metaRequest.error);
          metaRequest.onsuccess = () => {
            try {
              const meta = metaRecord(metaRequest.result, binding);
              required(meta.activeSession === session &&
                meta.activeWriterEpoch === writerEpoch &&
                meta.pendingGeneration === 0n,
              "compaction writer epoch changed after mark",
              CadrM10ConflictError);
              const headRequest = transaction.objectStore(
                CADR_M10_INDEXEDDB_STORES.heads).get(HEAD_KEY);
              headRequest.onerror = () => fail(headRequest.error);
              headRequest.onsuccess = () => {
                try {
                  const headBytes = headRecord(headRequest.result, HEAD_KEY);
                  required(equalBytes(headBytes, closure.active.headBytes),
                    "active head/root changed after compaction mark",
                  CadrM10ConflictError);
                  const kinds = ["pages", "nodes", "manifests"];
                  requestChain(kinds, (kind, next) => {
                    const store = transaction.objectStore(
                      CADR_M10_INDEXEDDB_STORES[kind]);
                    const request = store.getAllKeys();
                    request.onerror = () => fail(request.error);
                    request.onsuccess = () => {
                      try {
                        for (const key of request.result) {
                          if (!retained[kind].has(key)) {
                            store.delete(key); removed[kind] += 1;
                          }
                        }
                        next();
                      } catch (error) { fail(error); }
                    };
                  }, () => {}, fail);
                } catch (error) { fail(error); }
              };
            } catch (error) { fail(error); }
          };
        });
        await assertSession(handle);
        return Object.freeze({ removed: Object.freeze({ ...removed }),
          retained: Object.freeze({
            pages: retained.pages.size, nodes: retained.nodes.size,
            manifests: retained.manifests.size,
          }) });
      },
      async beginWriter() {
        await assertSession(handle);
        required(!readOnly, "recovered disk is read-only", CadrM10RecoveryError);
        return updateMetaTransaction(db, binding, (meta) => {
          assertHandleOpen(handle);
          required(meta.activeSession === session && meta.activeWriterEpoch === 0n && meta.pendingGeneration === 0n,
            "writer lease is unavailable", CadrM10ConflictError);
          required(meta.writerHighWater < MAX_U64, "writer epoch exhausted", CadrM10ConflictError);
          const epoch = meta.writerHighWater + 1n;
          return { values: { ...meta, writerHighWater: epoch, activeWriterEpoch: epoch }, result: epoch };
        });
      },
      async closeWriter(writerEpoch) {
        await assertSession(handle);
        checkedU64(writerEpoch, "writer epoch", { nonzero: true });
        required(!commits.has(binding.key), "cannot close writer during an active commit", CadrM10ConflictError);
        await updateMetaTransaction(db, binding, (meta) => {
          assertHandleOpen(handle);
          required(meta.activeSession === session && meta.activeWriterEpoch === writerEpoch, "stale writer epoch", CadrM10ConflictError);
          return { values: { ...meta, activeWriterEpoch: 0n }, result: undefined };
        });
      },
      async reserveGeneration(writerEpoch) {
        await assertSession(handle);
        required(!readOnly, "recovered disk is read-only", CadrM10RecoveryError); checkedU64(writerEpoch, "writer epoch", { nonzero: true });
        required(!commits.has(binding.key), "cannot reserve generation during an active commit", CadrM10ConflictError);
        return updateMetaTransaction(db, binding, (meta) => {
          assertHandleOpen(handle);
          required(meta.activeSession === session && meta.activeWriterEpoch === writerEpoch && meta.pendingGeneration === 0n,
            "generation reservation is unavailable", CadrM10ConflictError);
          required(meta.generationHighWater < MAX_U64, "generation high-water exhausted", CadrM10ConflictError);
          const generation = meta.generationHighWater + 1n;
          return { values: { ...meta, generationHighWater: generation, pendingGeneration: generation, pendingSession: session }, result: generation };
        });
      },
      async stage(objects) { await assertSession(handle); const result = await stage(db, objects); await assertSession(handle); return result; },
      async collectActivationRecords({ limit = CADR_M10_MAX_ACTIVATION_RECORDS } = {}) {
        required(Number.isSafeInteger(limit) && limit > 0 && limit <= CADR_M10_MAX_ACTIVATION_RECORDS,
          "activation collection limit is outside C-M10-IDB bound", CadrM10FormatError);
        await assertSession(handle);
        const records = await requestAsPromise(idbTransaction(db, CADR_M10_INDEXEDDB_STORES.activations, "readonly")
          .objectStore(CADR_M10_INDEXEDDB_STORES.activations).getAll(undefined, limit + 1));
        await assertSession(handle);
        required(records.length <= limit, "activation collection reached its bound", CadrM10RecoveryError);
        return Object.freeze(records.map((record) => activationRecord(record, null, binding.key))
          .sort((left, right) => left.headSeq === right.headSeq ? 0 : (left.headSeq < right.headSeq ? -1 : 1)));
      },
      async commit({ writerEpoch, expectedHeadSeq, manifestBytes, objects = {} } = {}) {
        let ownsCommit = false;
        try {
          await assertSession(handle);
          required(!commits.has(binding.key), "another commit is already active", CadrM10ConflictError);
          commits.add(binding.key); ownsCommit = true;
          required(!readOnly, "recovered disk is read-only", CadrM10RecoveryError);
          checkedU64(writerEpoch, "writer epoch", { nonzero: true }); checkedU64(expectedHeadSeq, "expected head sequence", { nonzero: true });
          /* Freeze every caller byte before the first parse/hash await or seam callback. */
          const copiedObjects = snapshotObjects(objects);
          const candidateBytes = copyExact(manifestBytes, CADR_M10_MANIFEST_BYTES, "candidate manifest");
          const candidate = await parseCdrOvm1(candidateBytes); await assertSession(handle);
          let published = false; let expected = null;
          try {
            expected = await readActive(handle);
          required(expected.head.headSeq === expectedHeadSeq && candidate.generation > expected.manifest.generation &&
            candidate.parentGeneration === expected.manifest.generation && equalBytes(candidate.parentManifestSha256, expected.manifest.hash) &&
            equalBytes(candidate.diskUuid, binding.diskUuid) && equalBytes(candidate.baseSha256, binding.baseSha256) &&
            equalBytes(candidate.profileSha256, binding.profileSha256) && equalBytes(candidate.artifactSetSha256, binding.artifactSetSha256),
          "candidate manifest does not extend the active head", CadrM10ConflictError);
          const meta = await assertSession(handle);
          required(meta.activeWriterEpoch === writerEpoch && meta.pendingGeneration === candidate.generation && meta.pendingSession === session,
            "writer/session does not own the candidate generation", CadrM10ConflictError);
          await seam("before-stage", { binding, writerEpoch, expectedHeadSeq });
          await stage(db, { ...copiedObjects, manifests: [...copiedObjects.manifests, candidateBytes] });
          await seam("after-stage", { binding, writerEpoch, expectedHeadSeq });
          await assertSession(handle);
          await verifyClosure(db, candidate, () => assertSession(handle));
          await assertSession(handle);
          const nextHeadBytes = await serializeCdrOvh1({ headSeq: expected.head.headSeq + 1n, writerEpoch,
            diskUuid: binding.diskUuid, activeGeneration: candidate.generation, activeManifestSha256: candidate.hash,
            activeRootSha256: candidate.rootSha256, previousGeneration: expected.head.activeGeneration,
            previousManifestSha256: expected.head.activeManifestSha256, previousRootSha256: expected.head.activeRootSha256,
            baseSha256: binding.baseSha256, profileSha256: binding.profileSha256 });
          await seam("before-head-activation", { binding, writerEpoch, expectedHeadSeq });
          await prepareActivationSlot(handle, expected.head.headSeq + 1n);
          await assertSession(handle);
          published = await publishHeadAndActivation(handle, writerEpoch, expected, nextHeadBytes);
          await seam("after-head-activation", { binding, writerEpoch, expectedHeadSeq });
          await seam("before-reread-head", { binding, writerEpoch, expectedHeadSeq });
          const active = await readActive(handle);
          required(equalBytes(active.headBytes, nextHeadBytes), "active head reread differs from published head", CadrM10RecoveryError);
          await seam("after-reread-head", { binding, writerEpoch, expectedHeadSeq });
          return Object.freeze({ durable: true, recoveredAfterFault: false, generation: active.manifest.generation,
            headSeq: active.head.headSeq, rootSha256: active.manifest.rootSha256.slice() });
          } catch (error) {
            if (published && expected !== null) {
              try {
                const active = await readActive(handle);
                if (active.manifest.generation > expected.manifest.generation) return Object.freeze({ durable: true,
                  recoveredAfterFault: true, generation: active.manifest.generation, headSeq: active.head.headSeq,
                  rootSha256: active.manifest.rootSha256.slice() });
              } catch { /* Preserve the original post-publication error. */ }
            }
            throw error;
          }
        } finally { if (ownsCommit) commits.delete(binding.key); }
      },
      async reopen() { await assertSession(handle); required(!commits.has(binding.key), "cannot reopen during an active commit", CadrM10ConflictError); return reopenDisk(binding); },
      close() { handle.closed = true; },
    });
  }

  return Object.freeze({
    profile: CADR_M10_INDEXEDDB_PROFILE,
    databaseNameFor(diskUuid) { const binding = checkedBinding({ diskUuid, profileSha256: new Uint8Array(32), artifactSetSha256: new Uint8Array(32) }); return nameFor(binding); },
    initializeDisk,
    reopenDisk,
    async deleteDisk(bindingValue) {
      const binding = checkedBinding(bindingValue); const db = databases.get(binding.key);
      if (db !== undefined) { databases.delete(binding.key); db.close(); }
      return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(nameFor(binding));
        request.onsuccess = () => resolve(); request.onerror = (event) => reject(errorFor(event, request.error));
        request.onblocked = () => reject(new CadrM10IndexedDbVersionChangeError("database deletion is blocked"));
      });
    },
  });
}
