/*
 * C-M10 browser persistence controller.
 *
 * The IndexedDB adapter owns durable selection.  This controller owns the
 * copy-on-write planner, guest-completion ordering, recovery fencing, and the
 * selected synthetic interchange/maintenance operations.
 */

import {
  CADR_M10_BASE_BLOCKS,
  CADR_M10_BASE_SHA256,
  CADR_M10_BLOCK_BYTES,
  CadrM10ConflictError,
  CadrM10RecoveryError,
  cadrM10Sha256,
  hexBytes,
  parseCdrOvn1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../wasm/cadr-m10-persistence.mjs";

export const CADR_M10_CONTROLLER_PROFILE =
  "CADR-WEB-303/C-M10-CONTROLLER-v1";
export const CADR_M10_EXPORT_SCHEMA = "cadr-m10-overlay-export-v1";
export const CADR_M10_CONTROLLER_CLEAN = "CLEAN";
export const CADR_M10_CONTROLLER_IN_DOUBT = "IN_DOUBT";
export const CADR_M10_CONTROLLER_RECOVERY_REQUIRED = "RECOVERY_REQUIRED";

const ZERO = new Uint8Array(32);
const MAX_ARCHIVE_BYTES = 320 * 1024 * 1024;
const MAX_HOST_TRANSFER_BYTES = 1024 * 1024;
const TEXT = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });

/*
 * Snapshot-review capability state is intentionally not represented on either
 * the controller, authority, or lease objects.  The objects are public API
 * values, so an expando, clone, Proxy receiver, or authority obtained from a
 * different controller must not become a route to a disk handle or a durable
 * root-reference identifier.
 */
const SNAPSHOT_REVIEW_AUTHORITIES = new WeakMap();
const SNAPSHOT_REVIEW_LEASES = new WeakMap();
const SNAPSHOT_REVIEW_LEASE_BRANDS = new WeakSet();
const MAX_U64 = 0xffffffffffffffffn;

function required(condition, message, ErrorType = TypeError) {
  if (!condition) throw new ErrorType(`C-M10 controller: ${message}`);
}

function bytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function exact(value, size, label) {
  const result = bytes(value);
  required(result !== null && result.byteLength === size,
    `${label} must be ${size} bytes`);
  return result.slice();
}

function same(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

function u64Decimal(value, label, { nonzero = false } = {}) {
  required(typeof value === "bigint" && value >= 0n && value <= MAX_U64 &&
    (!nonzero || value !== 0n), `${label} is not a canonical u64`);
  return value.toString();
}

function reviewBinding(closure) {
  required(closure !== null && typeof closure === "object",
    "active review closure is invalid", CadrM10RecoveryError);
  return Object.freeze({
    generation: u64Decimal(closure.generation, "review generation"),
    headSeq: u64Decimal(closure.headSeq, "review head sequence", { nonzero: true }),
    manifestSha256: hexBytes(exact(closure.manifestSha256, 32,
      "review manifest SHA-256")),
    rootSha256: hexBytes(exact(closure.rootSha256, 32,
      "review root SHA-256")),
  });
}

function sameReviewBinding(left, right) {
  return left.generation === right.generation && left.headSeq === right.headSeq &&
    left.manifestSha256 === right.manifestSha256 &&
    left.rootSha256 === right.rootSha256;
}

function zero(value) { return same(value, ZERO); }

function lba(value) {
  required(typeof value === "bigint" && value >= 0n &&
    value < CADR_M10_BASE_BLOCKS, "LBA is outside the selected base");
  return value;
}

function fromHex(value, size, label) {
  required(typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${size * 2}}$`).test(value),
  `${label} is not canonical lowercase hex`);
  return Uint8Array.from(value.match(/../g),
    part => Number.parseInt(part, 16));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sortedObjects(values) {
  return [...values].sort((left, right) => left.key.localeCompare(right.key));
}

async function parsedNodes(closure) {
  const output = new Map();
  for (const item of closure.nodes) {
    const parsed = await parseCdrOvn1(item.bytes);
    required(hexBytes(parsed.hash) === item.key,
      "closure node key does not match its bytes");
    output.set(item.key, parsed);
  }
  return output;
}

async function lookup(nodes, rootHash, target) {
  let hash = rootHash;
  for (let level = 2; level >= 0; level -= 1) {
    const node = nodes.get(hexBytes(hash));
    required(node !== undefined && node.level === level,
      "active closure has a missing or wrong-level node",
    CadrM10RecoveryError);
    hash = node.children[Number((target >> BigInt(level * 8)) & 0xffn)];
    if (zero(hash)) return ZERO;
  }
  return hash;
}

async function planWrites(closure, writes, readBasePage) {
  required(Array.isArray(writes) && writes.length > 0,
    "writes must be a nonempty array");
  required(typeof readBasePage === "function", "base-page reader is required");
  const nodes = await parsedNodes(closure);
  const privateNodes = new Map();
  const privatePages = new Map();
  let rootHash = closure.rootSha256.slice();
  let entryCount = closure.entryCount;
  let prior = -1n;

  async function nodeFor(hash, level, prefix) {
    if (zero(hash)) {
      return { level, prefix,
        children: Array.from({ length: 256 }, () => ZERO.slice()) };
    }
    const key = hexBytes(hash);
    const node = privateNodes.get(key)?.parsed ?? nodes.get(key);
    required(node !== undefined && node.level === level &&
      node.prefix === prefix, "COW path is missing or noncanonical",
    CadrM10RecoveryError);
    return node;
  }

  async function storeNode(level, prefix, children) {
    if (level !== 2 && children.every(zero)) return ZERO;
    const nodeBytes = await serializeCdrOvn1({ level, prefix, children });
    const parsed = await parseCdrOvn1(nodeBytes);
    const key = hexBytes(parsed.hash);
    privateNodes.set(key, { key, bytes: nodeBytes, parsed });
    return parsed.hash;
  }

  async function update(hash, level, prefix, target, pageHash) {
    const node = await nodeFor(hash, level, prefix);
    const children = node.children.map(child => child.slice());
    const index = Number((target >> BigInt(level * 8)) & 0xffn);
    children[index] = level === 0 ? pageHash :
      await update(children[index], level - 1,
        prefix | (BigInt(index) << BigInt(level * 8)), target, pageHash);
    return storeNode(level, prefix, children);
  }

  for (let index = 0; index < writes.length; index += 1) {
    const write = writes[index];
    required(write !== null && typeof write === "object",
      `write ${index} is not an object`);
    const target = lba(write.lba);
    required(target > prior, "writes are not strictly increasing");
    prior = target;
    const page = exact(write.bytes, CADR_M10_BLOCK_BYTES,
      `write ${index} page`);
    const base = exact(await readBasePage(target), CADR_M10_BLOCK_BYTES,
      `base page ${target}`);
    const oldHash = await lookup(new Map([
      ...nodes, ...[...privateNodes].map(([key, value]) => [key, value.parsed]),
    ]), rootHash, target);
    const nextHash = same(page, base) ? ZERO : await cadrM10Sha256(page);
    if (same(oldHash, nextHash)) continue;
    if (!zero(nextHash)) {
      privatePages.set(hexBytes(nextHash),
        { key: hexBytes(nextHash), bytes: page });
    }
    rootHash = await update(rootHash, 2, 0n, target, nextHash);
    if (zero(oldHash) && !zero(nextHash)) entryCount += 1n;
    if (!zero(oldHash) && zero(nextHash)) entryCount -= 1n;
  }
  return Object.freeze({
    changed: !same(rootHash, closure.rootSha256),
    rootSha256: rootHash.slice(), entryCount,
    pages: Object.freeze(sortedObjects(privatePages.values())),
    nodes: Object.freeze(sortedObjects([...privateNodes.values()].map(
      ({ key, bytes: value }) => ({ key, bytes: value })))),
  });
}

async function archiveBody(binding, closure) {
  return {
    schema: CADR_M10_EXPORT_SCHEMA,
    disk_uuid: hexBytes(binding.diskUuid),
    base_sha256: hexBytes(binding.baseSha256 ?? CADR_M10_BASE_SHA256),
    profile_sha256: hexBytes(binding.profileSha256),
    artifact_set_sha256: hexBytes(binding.artifactSetSha256),
    source_generation: closure.generation.toString(),
    entry_count: closure.entryCount.toString(),
    root_sha256: hexBytes(closure.rootSha256),
    pages: sortedObjects(closure.pages).map(item =>
      ({ sha256: item.key, bytes: hexBytes(item.bytes) })),
    nodes: sortedObjects(closure.nodes).map(item =>
      ({ sha256: item.key, bytes: hexBytes(item.bytes) })),
  };
}

export async function serializeCadrM10OverlayExport(binding, closure) {
  const body = await archiveBody(binding, closure);
  const bodyBytes = TEXT.encode(canonical(body));
  const digest = hexBytes(await cadrM10Sha256(bodyBytes));
  const output = TEXT.encode(canonical({ body, sha256: digest }));
  required(output.byteLength <= MAX_ARCHIVE_BYTES,
    "overlay export exceeds 320 MiB");
  return output;
}

export async function parseCadrM10OverlayExport(value) {
  const input = bytes(value);
  required(input !== null && input.byteLength > 0 &&
    input.byteLength <= MAX_ARCHIVE_BYTES, "overlay export size is invalid");
  let envelope;
  try { envelope = JSON.parse(DECODER.decode(input)); }
  catch { throw new TypeError("C-M10 controller: overlay export is not UTF-8 JSON"); }
  required(canonical(envelope) === DECODER.decode(input),
    "overlay export is not canonical");
  required(envelope !== null && typeof envelope === "object" &&
    Object.keys(envelope).sort().join() === "body,sha256",
  "overlay export envelope fields differ");
  const expected = hexBytes(await cadrM10Sha256(
    TEXT.encode(canonical(envelope.body))));
  required(envelope.sha256 === expected, "overlay export digest mismatch");
  const body = envelope.body;
  required(body?.schema === CADR_M10_EXPORT_SCHEMA &&
    /^(?:0|[1-9][0-9]*)$/.test(body.source_generation) &&
    /^(?:0|[1-9][0-9]*)$/.test(body.entry_count) &&
    Array.isArray(body.pages) && Array.isArray(body.nodes),
  "overlay export body is malformed");
  required(Object.keys(body).sort().join() === [
    "artifact_set_sha256", "base_sha256", "disk_uuid", "entry_count",
    "nodes", "pages", "profile_sha256", "root_sha256", "schema",
    "source_generation",
  ].sort().join(), "overlay export body fields differ");
  const pages = [];
  let prior = "";
  for (const item of body.pages) {
    required(item !== null && typeof item === "object" &&
      Object.keys(item).sort().join() === "bytes,sha256" &&
      item.sha256 > prior, "archive pages are not unique and sorted");
    prior = item.sha256;
    const page = fromHex(item?.bytes, CADR_M10_BLOCK_BYTES, "archive page");
    required(item.sha256 === hexBytes(await cadrM10Sha256(page)),
      "archive page hash mismatch");
    pages.push({ key: item.sha256, bytes: page });
  }
  const nodes = [];
  prior = "";
  for (const item of body.nodes) {
    required(item !== null && typeof item === "object" &&
      Object.keys(item).sort().join() === "bytes,sha256" &&
      item.sha256 > prior, "archive nodes are not unique and sorted");
    prior = item.sha256;
    const nodeBytes = fromHex(item?.bytes, 8232, "archive node");
    const node = await parseCdrOvn1(nodeBytes);
    required(item.sha256 === hexBytes(node.hash), "archive node hash mismatch");
    nodes.push({ key: item.sha256, bytes: nodeBytes });
  }
  const rootSha256 = fromHex(body.root_sha256, 32, "archive root");
  const nodeMap = await parsedNodes({ nodes });
  const pageKeys = new Set(pages.map(page => page.key));
  const seenPages = new Set(); const seenNodes = new Set();
  let count = 0n;
  const visit = async (hash, level, prefix) => {
    const key = hexBytes(hash);
    required(!seenNodes.has(key), "archive tree aliases or cycles a node");
    seenNodes.add(key);
    const node = nodeMap.get(key);
    required(node !== undefined && node.level === level &&
      node.prefix === prefix,
      "archive tree closure is incomplete");
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      if (zero(child)) continue;
      if (level === 0) {
        const pageKey = hexBytes(child);
        required(pageKeys.has(pageKey),
          "archive tree references a missing page");
        seenPages.add(pageKey);
        count += 1n;
      } else await visit(child, level - 1,
        prefix | (BigInt(index) << BigInt(level * 8)));
    }
  };
  await visit(rootSha256, 2, 0n);
  required(count === BigInt(body.entry_count) &&
    seenPages.size === pages.length && seenNodes.size === nodes.length,
    "archive entry count differs from its tree");
  return Object.freeze({
    diskUuid: fromHex(body.disk_uuid, 16, "archive disk UUID"),
    baseSha256: fromHex(body.base_sha256, 32, "archive base hash"),
    profileSha256: fromHex(body.profile_sha256, 32, "archive profile hash"),
    artifactSetSha256: fromHex(body.artifact_set_sha256, 32,
      "archive artifact-set hash"),
    sourceGeneration: BigInt(body.source_generation),
    entryCount: count, rootSha256, pages: Object.freeze(pages),
    nodes: Object.freeze(nodes),
  });
}

export function createCadrM10Controller({
  backend, binding, readBasePage, readBaseIdentity, replaceWorker,
  stateChanged = () => {},
} = {}) {
  required(backend !== null && typeof backend === "object" &&
    typeof backend.initializeDisk === "function" &&
    typeof backend.reopenDisk === "function", "durable backend is required");
  required(binding !== null && typeof binding === "object",
    "disk binding is required");
  required(typeof readBasePage === "function", "base reader is required");
  required(typeof readBaseIdentity === "function",
    "base identity reader is required");
  required(typeof replaceWorker === "function" &&
    typeof stateChanged === "function", "controller callbacks are invalid");
  let disk = null;
  let state = CADR_M10_CONTROLLER_CLEAN;
  let busy = false;
  let controller = null;
  let snapshotReviewLease = null;
  /* A guest-completion failure and the replacement it requires are one
   * controller-wide event.  A second observer must join the existing event,
   * rather than replace a newly-created worker a second time. */
  let ambiguousInvalidationFlight = null;
  let ambiguousInvalidationEpoch = 0;
  let ambiguousInvalidationFailed = false;

  const setState = next => {
    state = next; stateChanged(next);
  };

  function clearAmbiguousInvalidation(flight = null) {
    if (flight === null || ambiguousInvalidationFlight === flight) {
      ambiguousInvalidationFlight = null;
      ambiguousInvalidationFailed = false;
    }
  }

  function assertNoSnapshotReviewLease() {
    required(snapshotReviewLease === null,
      "a snapshot review lease is active", CadrM10ConflictError);
  }

  function assertSnapshotReviewAcquireAccess() {
    assertNoSnapshotReviewLease();
    required(!busy, "another persistence operation is active",
      CadrM10ConflictError);
    required(disk !== null && !disk.readOnly &&
      state === CADR_M10_CONTROLLER_CLEAN,
    "snapshot review requires an open writable clean controller",
    CadrM10RecoveryError);
    const session = disk.sessionId;
    required(typeof session === "bigint" && session > 0n && session <= MAX_U64,
      "snapshot review disk session is invalid", CadrM10RecoveryError);
    return Object.freeze({ disk, session });
  }

  function assertSnapshotReviewContinuity(record) {
    required(snapshotReviewLease === record && record.phase === "ACQUIRING" &&
      disk === record.disk && disk !== null && disk.sessionId === record.session &&
      !disk.readOnly && state === CADR_M10_CONTROLLER_CLEAN && !busy,
    "snapshot review changed while authority was acquired", CadrM10ConflictError);
  }

  async function confirmSnapshotReviewContinuity(record, expected = null) {
    assertSnapshotReviewContinuity(record);
    let active;
    try { active = await record.disk.active(); }
    catch {
      throw new CadrM10ConflictError(
        "C-M10 controller: snapshot review changed while authority was acquired");
    }
    assertSnapshotReviewContinuity(record);
    const observed = reviewBinding({
      generation: active?.manifest?.generation, headSeq: active?.head?.headSeq,
      manifestSha256: active?.manifest?.hash,
      rootSha256: active?.manifest?.rootSha256,
    });
    if (expected !== null) required(sameReviewBinding(expected, observed),
      "snapshot review active closure changed before publication",
      CadrM10ConflictError);
    return observed;
  }

  async function rollbackSnapshotReviewPin(record) {
    /* A stale open session cannot remove its own reference.  Reopen privately
     * solely to compensate the just-created durable pin; no cleanup handle or
     * reference identifier is ever exposed through the authority API. */
    await refreshSnapshotReviewReleaseSession(record);
    const cleanup = record.disk;
    await cleanup.unpinRoot(record.pinId);
    record.pinId = null;
  }

  /* A refresh is an asynchronous capability transition.  In particular, a
   * new ambiguous guest completion can arrive while a previous replacement
   * has completed and the release is awaiting backend.reopenDisk().  Capture
   * the release token and the exact replacement it is allowed to follow
   * before the first await, then reject a reopened handle if either has been
   * superseded.  Never recover this check from mutable controller-global
   * state: the lease must remain bound to its own replacement flight. */
  function snapshotReviewReleaseFence(record, attempt = null) {
    const fence = Object.freeze({
      attempt,
      ambiguityEpoch: record.ambiguityEpoch,
      ambiguityFlight: record.ambiguityFlight,
      requiresFreshSession: record.releaseRequiresFreshSession,
    });
    if (fence.requiresFreshSession) {
      required(fence.ambiguityEpoch > 0 &&
        fence.ambiguityFlight !== null,
      "snapshot review release lacks its replacement flight",
      CadrM10RecoveryError);
    }
    return fence;
  }

  function assertSnapshotReviewReleaseFence(record, fence) {
    required((fence.attempt === null || record.releaseAttempt === fence.attempt) &&
      record.ambiguityEpoch === fence.ambiguityEpoch &&
      record.ambiguityFlight === fence.ambiguityFlight &&
      record.releaseRequiresFreshSession === fence.requiresFreshSession,
    "snapshot review release was interrupted by ambiguous guest completion",
    CadrM10RecoveryError);
  }

  function snapshotReviewReceipt(binding, alreadyReleased) {
    return Object.freeze({ binding, released: true, alreadyReleased });
  }

  async function refreshSnapshotReviewReleaseSession(record,
      fence = snapshotReviewReleaseFence(record),
      { preserveInDoubt = false } = {}) {
    /* An active review lease must not turn a lost guest-completion response
     * into a CLEAN controller.  The emergency fence closes the session first
     * and replacement completes before the one opaque unpin is retried from a
     * fresh durable session. */
    if (fence.requiresFreshSession) {
      await fence.ambiguityFlight;
    }
    assertSnapshotReviewReleaseFence(record, fence);
    let refreshed = null;
    try {
      refreshed = await backend.reopenDisk(binding);
      assertSnapshotReviewReleaseFence(record, fence);
      required(refreshed !== null && typeof refreshed === "object" &&
        !refreshed.readOnly && typeof refreshed.unpinRoot === "function" &&
        typeof refreshed.sessionId === "bigint" && refreshed.sessionId > 0n &&
        refreshed.sessionId <= MAX_U64,
      "snapshot review release could not reopen a writable session",
      CadrM10RecoveryError);
    } catch (error) {
      /* A handle returned by an overtake is an old session even though the
       * adapter call itself succeeded.  Closing it is part of the fence: it
       * must never become the controller disk or outlive the rejected retry. */
      try { refreshed?.close?.(); } catch {}
      throw error;
    }
    disk = refreshed;
    record.disk = refreshed;
    record.session = refreshed.sessionId;
    if (!preserveInDoubt) setState(CADR_M10_CONTROLLER_CLEAN);
  }

  function releaseSnapshotReviewLease(lease, receiver) {
    const record = SNAPSHOT_REVIEW_LEASES.get(lease);
    required(receiver === lease && SNAPSHOT_REVIEW_LEASE_BRANDS.has(lease) &&
      record !== undefined && record.controller === controller &&
      record.lease === lease,
    "snapshot review lease is not recognized", CadrM10ConflictError);
    if (record.successReceipt !== null) {
      return Promise.resolve(record.alreadyReleasedReceipt);
    }
    if (record.releaseFlight !== null) return record.releaseFlight;
    required(record.phase === "HELD" || record.phase === "RELEASE_REQUIRED",
      "snapshot review lease is not releasable", CadrM10ConflictError);
    const retrying = record.phase === "RELEASE_REQUIRED";
    const attempt = record.releaseAttempt + 1;
    const pinId = record.pinId;
    record.releaseAttempt = attempt;
    record.phase = "RELEASING";
    const fence = snapshotReviewReleaseFence(record, attempt);
    const flight = (async () => {
      try {
        /* Publish the shared flight before a hostile adapter can throw. */
        await Promise.resolve();
        assertSnapshotReviewReleaseFence(record, fence);
        /* Reopen after a failed unpin and after a guest ambiguity.  Read the
         * latter through the captured lease fence: an ambiguity can interleave
         * with a release that has just claimed its flight. */
        if (retrying || fence.requiresFreshSession) {
          await refreshSnapshotReviewReleaseSession(record, fence, {
            preserveInDoubt: fence.requiresFreshSession,
          });
        }
        assertSnapshotReviewReleaseFence(record, fence);
        await record.disk.unpinRoot(pinId);
        assertSnapshotReviewReleaseFence(record, fence);
        record.pinId = null;
        record.releaseRequiresFreshSession = false;
        record.phase = "RELEASED";
        snapshotReviewLease = null;
        record.authorityRecord.phase = "ACTIVE";
        record.authorityRecord.lease = null;
        if (fence.requiresFreshSession) {
          required(state === CADR_M10_CONTROLLER_IN_DOUBT,
            "snapshot review release lost its recovery fence",
          CadrM10RecoveryError);
          clearAmbiguousInvalidation(fence.ambiguityFlight);
          setState(CADR_M10_CONTROLLER_CLEAN);
        }
        record.successReceipt = snapshotReviewReceipt(record.binding, false);
        record.alreadyReleasedReceipt = snapshotReviewReceipt(record.binding, true);
        return record.successReceipt;
      } catch (error) {
        if (record.releaseAttempt === attempt) {
          record.phase = "RELEASE_REQUIRED";
          record.releaseFlight = null;
        }
        throw error;
      }
    })();
    record.releaseFlight = flight;
    return flight;
  }

  function makeSnapshotReviewLease(record, currentBinding) {
    let lease;
    const release = Object.freeze(function release() {
      return releaseSnapshotReviewLease(lease, this);
    });
    lease = Object.freeze({ binding: currentBinding, release });
    record.lease = lease;
    SNAPSHOT_REVIEW_LEASES.set(lease, record);
    SNAPSHOT_REVIEW_LEASE_BRANDS.add(lease);
    return lease;
  }

  function beginSnapshotReviewAcquire(authorityRecord) {
    const captured = assertSnapshotReviewAcquireAccess();
    const record = {
      controller, authorityRecord, disk: captured.disk, session: captured.session,
      phase: "ACQUIRING", pinId: null, lease: null, binding: null,
      releaseFlight: null, successReceipt: null, alreadyReleasedReceipt: null,
      recoveryFlight: null, releaseRequiresFreshSession: false, releaseAttempt: 0,
      ambiguityEpoch: 0, ambiguityFlight: null,
    };
    snapshotReviewLease = record;
    authorityRecord.phase = "ACQUIRING";

    return (async () => {
      try {
        assertSnapshotReviewContinuity(record);
        const initial = reviewBinding(await record.disk.exportActiveClosure());
        assertSnapshotReviewContinuity(record);
        record.binding = initial;
        await confirmSnapshotReviewContinuity(record, initial);
        record.pinId = await record.disk.pinRoot("snapshot",
          fromHex(initial.rootSha256, 32, "review root SHA-256"));
        required(typeof record.pinId === "string" && record.pinId.length > 0,
          "snapshot review pin did not return an identifier", CadrM10RecoveryError);
        assertSnapshotReviewContinuity(record);
        await confirmSnapshotReviewContinuity(record, initial);
        const reread = reviewBinding(await record.disk.exportActiveClosure());
        assertSnapshotReviewContinuity(record);
        await confirmSnapshotReviewContinuity(record, initial);
        required(sameReviewBinding(initial, reread),
          "snapshot review active closure changed before publication",
          CadrM10ConflictError);
        const lease = makeSnapshotReviewLease(record, initial);
        record.phase = "HELD";
        authorityRecord.phase = "LEASED";
        authorityRecord.lease = lease;
        return lease;
      } catch (error) {
        if (record.pinId !== null) {
          try {
            await rollbackSnapshotReviewPin(record);
          } catch (rollbackError) {
            /* The caller never received a lease, so the authority itself is
             * the only safe branded recovery route.  Retain its opaque record
             * and make the next acquire retry cleanup before a fresh pin. */
            record.phase = "RECOVERY_REQUIRED";
            authorityRecord.phase = "RECOVERY_REQUIRED";
            authorityRecord.recovery = record;
            throw new AggregateError([error, rollbackError],
              "C-M10 snapshot review acquisition failed and pin rollback failed");
          }
        }
        snapshotReviewLease = null;
        authorityRecord.phase = "ACTIVE";
        throw error;
      }
    })();
  }

  function resumeSnapshotReviewAcquire(authorityRecord) {
    const record = authorityRecord.recovery;
    required(record !== null && record !== undefined &&
      snapshotReviewLease === record &&
      (record.phase === "RECOVERY_REQUIRED" || record.phase === "RECOVERING") &&
      record.pinId !== null,
    "snapshot review acquisition recovery is invalid", CadrM10RecoveryError);
    if (record.recoveryFlight !== null) return record.recoveryFlight;
    required(record.phase === "RECOVERY_REQUIRED",
      "snapshot review acquisition recovery is already changing", CadrM10ConflictError);
    record.phase = "RECOVERING";
    authorityRecord.phase = "RECOVERING";
    const flight = (async () => {
      try {
        await rollbackSnapshotReviewPin(record);
        snapshotReviewLease = null;
        authorityRecord.recovery = null;
        authorityRecord.phase = "ACTIVE";
        return await beginSnapshotReviewAcquire(authorityRecord);
      } catch (error) {
        record.phase = "RECOVERY_REQUIRED";
        authorityRecord.phase = "RECOVERY_REQUIRED";
        authorityRecord.recovery = record;
        throw error;
      } finally {
        record.recoveryFlight = null;
      }
    })();
    record.recoveryFlight = flight;
    return flight;
  }

  function invokeSnapshotReviewAcquire(authority, receiver) {
    const authorityRecord = SNAPSHOT_REVIEW_AUTHORITIES.get(authority);
    required(receiver === authority && authorityRecord !== undefined &&
      authorityRecord.controller === controller &&
      authorityRecord.authority === authority,
    "snapshot review authority is not recognized", CadrM10ConflictError);
    if (authorityRecord.phase === "RECOVERY_REQUIRED" ||
      authorityRecord.phase === "RECOVERING") {
      return resumeSnapshotReviewAcquire(authorityRecord);
    }
    required(authorityRecord.phase === "ACTIVE",
      "snapshot review authority is not recognized in its current phase",
      CadrM10ConflictError);
    return beginSnapshotReviewAcquire(authorityRecord);
  }

  function claimSnapshotReviewAuthority() {
    required(this === controller && controller !== null &&
      !SNAPSHOT_REVIEW_AUTHORITIES.has(controller),
    "snapshot review authority has already been claimed", CadrM10ConflictError);
    let authority;
    const acquire = Object.freeze(function acquire() {
      return invokeSnapshotReviewAcquire(authority, this);
    });
    const revoke = Object.freeze(function revoke(reason) {
      const authorityRecord = SNAPSHOT_REVIEW_AUTHORITIES.get(authority);
      required(this === authority && authorityRecord !== undefined &&
        authorityRecord.controller === controller &&
        authorityRecord.authority === authority && authorityRecord.phase === "ACTIVE" &&
        authorityRecord.lease === null,
      "snapshot review authority cannot be revoked", CadrM10ConflictError);
      required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
        "snapshot review revocation reason is invalid");
      authorityRecord.phase = "REVOKED";
      return Object.freeze({ revoked: true, reason });
    });
    authority = Object.freeze({ acquire, revoke });
    SNAPSHOT_REVIEW_AUTHORITIES.set(authority, {
      controller, authority, phase: "ACTIVE", lease: null, recovery: null,
    });
    SNAPSHOT_REVIEW_AUTHORITIES.set(controller, authority);
    return authority;
  }

  async function invalidateAfterAmbiguousGuest() {
    /* The bridge reports one lost completion twice: once at transport loss and
     * once when the enclosing durable publication unwinds.  Keep that event
     * joinable even after its replacement settles.  A later ambiguity can
     * supersede it only while the retained lease is actively reopening from
     * the first replacement; that is the only phase in which a stale refresh
     * handle could otherwise cross the recovery fence. */
    const supersedingRelease = snapshotReviewLease !== null &&
      snapshotReviewLease.phase === "RELEASING" &&
      snapshotReviewLease.releaseFlight !== null &&
      snapshotReviewLease.releaseRequiresFreshSession;
    if (ambiguousInvalidationFlight !== null && !supersedingRelease &&
        !ambiguousInvalidationFailed) {
      return ambiguousInvalidationFlight;
    }
    setState(CADR_M10_CONTROLLER_IN_DOUBT);
    const ambiguityEpoch = ambiguousInvalidationEpoch + 1;
    ambiguousInvalidationEpoch = ambiguityEpoch;
    let resolveFlight; let rejectFlight;
    const flight = new Promise((resolve, reject) => {
      resolveFlight = resolve; rejectFlight = reject;
    });
    /* Keep this replacement joinable for the second report of the same lost
     * completion.  The opaque lease separately retains this exact promise so
     * a superseding release cannot accidentally follow a newer global value. */
    ambiguousInvalidationFlight = flight;
    ambiguousInvalidationFailed = false;
    void flight.catch(() => {});
    /* The lease is deliberately retained, not released or exposed.  Its
     * pinned root is part of the recovery boundary, and only its branded
     * release method may unpin it after the replacement worker exists. */
    if (snapshotReviewLease !== null) {
      snapshotReviewLease.releaseRequiresFreshSession = true;
      snapshotReviewLease.ambiguityEpoch = ambiguityEpoch;
      snapshotReviewLease.ambiguityFlight = flight;
      if (snapshotReviewLease.phase === "HELD" ||
          snapshotReviewLease.phase === "RELEASING") {
        snapshotReviewLease.phase = "RELEASE_REQUIRED";
      }
      /* A pre-fence unpin may never return.  Its token cannot alter state
       * after this bump; a caller can retry the opaque release through the
       * fresh session without waiting for that stale transport promise. */
      if (snapshotReviewLease.releaseFlight !== null) {
        snapshotReviewLease.releaseAttempt += 1;
        snapshotReviewLease.releaseFlight = null;
      }
    }
    /* Publish before either close or replaceWorker can re-enter the
     * controller.  This is the synchronisation point that makes one loss
     * produce exactly one replacement. */
    void (async () => {
      try {
        try { disk?.close(); } catch {}
        disk = null;
        await replaceWorker();
        resolveFlight();
      } catch (error) {
        ambiguousInvalidationFailed = true;
        rejectFlight(error);
      }
    })();
    return flight;
  }

  async function open({ initialize = false } = {}) {
    assertNoSnapshotReviewLease();
    required(disk === null, "controller is already open",
      CadrM10ConflictError);
    const observedBase = exact(await readBaseIdentity(), 32,
      "observed base identity");
    required(same(observedBase,
      binding.baseSha256 ?? CADR_M10_BASE_SHA256),
    "base callback identity differs from the disk binding",
    CadrM10RecoveryError);
    disk = initialize ? await backend.initializeDisk(binding) :
      await backend.reopenDisk(binding);
    setState(disk.readOnly ? CADR_M10_CONTROLLER_RECOVERY_REQUIRED :
      CADR_M10_CONTROLLER_CLEAN);
    return status();
  }

  function status() {
    return Object.freeze({ state, open: disk !== null,
      readOnly: disk?.readOnly ?? true });
  }

  async function publishPlan(plan, closure, epoch,
      { completeGuest = null } = {}) {
    required(disk !== null && !disk.readOnly, "disk is not writable",
      CadrM10RecoveryError);
    required(completeGuest === null || typeof completeGuest === "function",
      "guest completion callback is invalid");
    let guestMayHaveAdvanced = false;
    try {
      if (!plan.changed) {
        if (completeGuest !== null) {
          /* A lost host-complete response is ambiguous: the worker may have
           * consumed the completion before the transport failed. */
          guestMayHaveAdvanced = true;
          await completeGuest();
        }
        await disk.closeWriter(epoch);
        return Object.freeze({ durable: true, changed: false,
          generation: closure.generation,
          headSeq: closure.headSeq,
          rootSha256: closure.rootSha256.slice() });
      }
      const generation = await disk.reserveGeneration(epoch);
      const manifestBytes = await serializeCdrOvm1({
        generation, parentGeneration: closure.generation,
        entryCount: plan.entryCount, diskUuid: binding.diskUuid,
        baseSha256: binding.baseSha256 ?? CADR_M10_BASE_SHA256,
        profileSha256: binding.profileSha256,
        artifactSetSha256: binding.artifactSetSha256,
        parentManifestSha256: closure.manifestSha256,
        rootSha256: plan.rootSha256,
      });
      const objects = {
        pages: plan.pages.map(item => item.bytes),
        nodes: plan.nodes.map(item => item.bytes),
        manifests: [manifestBytes],
      };
      /* Stage and verify all immutable bytes before advancing the guest. */
      await disk.stage(objects);
      if (completeGuest !== null) {
        guestMayHaveAdvanced = true;
        await completeGuest();
      }
      const result = await disk.commit({
        writerEpoch: epoch, expectedHeadSeq: closure.headSeq,
        manifestBytes, objects,
      });
      setState(CADR_M10_CONTROLLER_CLEAN);
      return Object.freeze({ ...result, changed: true });
    } catch (error) {
      if (guestMayHaveAdvanced) {
        await invalidateAfterAmbiguousGuest();
      } else if (epoch !== null && disk !== null) {
        let recoveryFailure = null;
        try { await disk.closeWriter(epoch); } catch {}
        try {
          disk.close(); disk = await backend.reopenDisk(binding);
          setState(disk.readOnly ? CADR_M10_CONTROLLER_RECOVERY_REQUIRED :
            CADR_M10_CONTROLLER_CLEAN);
        } catch (failure) {
          disk = null; setState(CADR_M10_CONTROLLER_RECOVERY_REQUIRED);
          recoveryFailure = failure;
        }
        if (recoveryFailure !== null) {
          throw new AggregateError([error, recoveryFailure],
            "C-M10 pre-guest failure could not reopen durable state");
        }
      }
      throw error;
    }
  }

  async function mutate(planner, options = {}) {
    assertNoSnapshotReviewLease();
    required(!busy, "another persistence operation is active",
      CadrM10ConflictError);
    required(disk !== null, "controller is not open", CadrM10RecoveryError);
    busy = true;
    let epoch = null;
    try {
      /* The durable writer lease precedes the active snapshot and remains
       * owned through planning, staging, guest completion, and publication. */
      epoch = await disk.beginWriter();
      let closure; let plan;
      try {
        closure = await disk.exportActiveClosure();
        plan = await planner(closure);
      } catch (error) {
        try { await disk.closeWriter(epoch); } catch {}
        disk.close(); disk = await backend.reopenDisk(binding);
        setState(disk.readOnly ? CADR_M10_CONTROLLER_RECOVERY_REQUIRED :
          CADR_M10_CONTROLLER_CLEAN);
        throw error;
      }
      return await publishPlan(plan, closure, epoch, options);
    } finally { busy = false; }
  }

  async function commitWrites(writes, options = {}) {
    return mutate(closure => planWrites(
      closure, writes, readBasePage), options);
  }

  async function importArchive(value) {
    const archive = await parseCadrM10OverlayExport(value);
    required(same(archive.baseSha256,
      binding.baseSha256 ?? CADR_M10_BASE_SHA256) &&
      same(archive.profileSha256, binding.profileSha256) &&
      same(archive.artifactSetSha256, binding.artifactSetSha256),
    "overlay archive binding differs");
    return mutate(current => ({
      changed: !same(current.rootSha256, archive.rootSha256),
      rootSha256: archive.rootSha256, entryCount: archive.entryCount,
      pages: archive.pages, nodes: archive.nodes,
    }));
  }

  async function discard() {
    return mutate(async closure => {
      const nodes = await parsedNodes(closure);
      const writes = [];
      const walk = async (hash, level, prefix) => {
        const node = nodes.get(hexBytes(hash));
        required(node !== undefined && node.level === level,
          "discard closure is invalid", CadrM10RecoveryError);
        for (let index = 0; index < 256; index += 1) {
          const child = node.children[index];
          if (zero(child)) continue;
          const next = prefix | (BigInt(index) << BigInt(level * 8));
          if (level === 0) {
            writes.push({ lba: next, bytes: await readBasePage(next) });
          } else await walk(child, level - 1, next);
        }
      };
      await walk(closure.rootSha256, 2, 0n);
      return writes.length === 0 ? {
        changed: false, rootSha256: closure.rootSha256,
        entryCount: closure.entryCount, pages: [], nodes: [],
      } : planWrites(closure, writes, readBasePage);
    });
  }

  controller = Object.freeze({
    profile: CADR_M10_CONTROLLER_PROFILE,
    get state() { return state; },
    status, open, claimSnapshotReviewAuthority,
    invalidateAfterAmbiguousGuest,
    commitWrites,
    async readBlock(target) {
      lba(target); required(disk !== null, "controller is not open",
        CadrM10RecoveryError);
      const closure = await disk.exportActiveClosure();
      const nodes = await parsedNodes(closure);
      const pageHash = await lookup(nodes, closure.rootSha256, target);
      if (zero(pageHash)) return exact(await readBasePage(target),
        CADR_M10_BLOCK_BYTES, "base page");
      const page = closure.pages.find(item => item.key === hexBytes(pageHash));
      required(page !== undefined, "mapped page is absent",
        CadrM10RecoveryError);
      return page.bytes.slice();
    },
    async exportOverlay() {
      assertNoSnapshotReviewLease();
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      required(disk !== null, "controller is not open",
        CadrM10RecoveryError);
      busy = true;
      let epoch = null;
      try {
        epoch = await disk.beginWriter();
        const output = await serializeCadrM10OverlayExport(
          binding, await disk.exportActiveClosure());
        await disk.closeWriter(epoch); epoch = null;
        return output;
      } finally {
        if (epoch !== null && disk !== null) {
          try { await disk.closeWriter(epoch); } catch {}
        }
        busy = false;
      }
    },
    importOverlay: importArchive,
    discard,
    async cloneTo({
      backend: targetBackend, binding: targetBinding,
      replaceWorker: targetReplaceWorker,
    }) {
      required(typeof targetReplaceWorker === "function",
        "clone destination worker replacement callback is required");
      const archive = await this.exportOverlay();
      const clone = createCadrM10Controller({
        backend: targetBackend, binding: targetBinding, readBasePage,
        readBaseIdentity,
        replaceWorker: targetReplaceWorker,
      });
      try {
        await clone.open({ initialize: true });
        await clone.importOverlay(archive);
        return clone;
      } catch (error) {
        try { clone.close(); } catch {}
        try {
          required(typeof targetBackend.deleteDisk === "function",
            "failed clone backend cannot delete its destination");
          await targetBackend.deleteDisk(targetBinding);
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError],
            "C-M10 clone failed and destination cleanup failed");
        }
        throw error;
      }
    },
    async compact() {
      assertNoSnapshotReviewLease();
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      required(disk !== null, "controller is not open",
        CadrM10RecoveryError);
      busy = true;
      let epoch = null;
      try {
        epoch = await disk.beginWriter();
        const result = await disk.compact({ writerEpoch: epoch });
        await disk.closeWriter(epoch); epoch = null;
        return result;
      } finally {
        if (epoch !== null && disk !== null) {
          try { await disk.closeWriter(epoch); } catch {}
        }
        busy = false;
      }
    },
    async recover() {
      assertNoSnapshotReviewLease();
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      busy = true;
      try {
        const recoveryAmbiguityFlight = ambiguousInvalidationFlight;
        if (disk !== null) {
          try { disk.close(); } catch {}
        }
        disk = null;
        try {
          disk = await backend.reopenDisk(binding);
        } catch (error) {
          setState(CADR_M10_CONTROLLER_RECOVERY_REQUIRED);
          throw error;
        }
        if (disk.readOnly) setState(CADR_M10_CONTROLLER_RECOVERY_REQUIRED);
        else {
          clearAmbiguousInvalidation(recoveryAmbiguityFlight);
          setState(CADR_M10_CONTROLLER_CLEAN);
        }
        return status();
      } finally {
        busy = false;
      }
    },
    close() {
      assertNoSnapshotReviewLease();
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      busy = true;
      try {
        if (disk !== null) disk.close();
        disk = null;
      } finally { busy = false; }
    },
  });
  return controller;
}

/*
 * Bind the controller to the existing versioned worker host-request protocol.
 * This is the only guest-completion path: writes stage durable immutable
 * objects first, advance the guest once, then publish the new durable head.
 */
export function createCadrM10WorkerDiskBridge({
  controller, channel, hostStatusOk = 0, hostStatusFailed = 1,
} = {}) {
  required(controller !== null && typeof controller === "object" &&
    typeof controller.commitWrites === "function" &&
    typeof controller.readBlock === "function" &&
    typeof controller.invalidateAfterAmbiguousGuest === "function",
  "controller is required");
  required(channel !== null && typeof channel === "object" &&
    typeof channel.submit === "function", "worker channel is required");
  let busy = false;

  async function complete(request, hostStatus, completionBytes) {
    let result;
    try {
      result = await channel.submit({
        op: "host-complete", operation: request.operation,
        hostStatus, generation: request.generation,
        requestId: request.requestId, bytes: completionBytes,
      });
    } catch (error) {
      await controller.invalidateAfterAmbiguousGuest();
      throw error;
    }
    required(result?.status === 0, "worker rejected host completion",
      CadrM10RecoveryError);
    return result;
  }

  async function serviceOnce() {
    required(!busy, "worker disk bridge is already servicing a request",
      CadrM10ConflictError);
    busy = true;
    let request = null; let guestCompleted = false;
    try {
      const pending = await channel.submit({ op: "host-next-request" });
      if (pending?.status === 9) return Object.freeze({ serviced: false });
      required(pending?.status === 0 && pending.request !== null &&
        typeof pending.request === "object",
      "worker returned a malformed host request");
      request = pending.request;
      required(typeof request.generation === "bigint" &&
        typeof request.requestId === "bigint" &&
        typeof request.completionByteCount === "bigint" &&
        request.completionByteCount >= 0n &&
        request.completionByteCount <= BigInt(MAX_HOST_TRANSFER_BYTES),
      "worker host request numeric framing is invalid");
      const descriptor = bytes(pending.descriptor);
      const payload = bytes(pending.requestPayload);
      required(descriptor !== null && payload !== null,
        "worker request payload framing is malformed");
      if (request.operation === 1) {
        required(descriptor.byteLength === 16 && payload.byteLength === 0,
          "block-read request framing is invalid");
        const view = new DataView(descriptor.buffer,
          descriptor.byteOffset, descriptor.byteLength);
        const first = view.getBigUint64(0, true);
        const count = view.getUint32(8, true);
        required(count > 0 &&
          count <= MAX_HOST_TRANSFER_BYTES / CADR_M10_BLOCK_BYTES &&
          view.getUint32(12, true) ===
          CADR_M10_BLOCK_BYTES &&
          request.completionByteCount ===
            BigInt(count * CADR_M10_BLOCK_BYTES),
        "block-read extent is invalid");
        const output = new Uint8Array(count * CADR_M10_BLOCK_BYTES);
        for (let index = 0; index < count; index += 1) {
          output.set(await controller.readBlock(first + BigInt(index)),
            index * CADR_M10_BLOCK_BYTES);
        }
        await complete(request, hostStatusOk, output);
        guestCompleted = true;
        return Object.freeze({ serviced: true, operation: "read",
          firstBlock: first, blockCount: count, durable: true });
      }
      if (request.operation === 2) {
        required(descriptor.byteLength === 24,
          "block-write request framing is invalid");
        const view = new DataView(descriptor.buffer,
          descriptor.byteOffset, descriptor.byteLength);
        const transactionId = view.getBigUint64(0, true);
        const first = view.getBigUint64(8, true);
        const count = view.getUint32(16, true);
        required(transactionId === request.requestId && count > 0 &&
          count <= MAX_HOST_TRANSFER_BYTES / CADR_M10_BLOCK_BYTES &&
          view.getUint32(20, true) === CADR_M10_BLOCK_BYTES &&
          payload.byteLength === count * CADR_M10_BLOCK_BYTES &&
          request.completionByteCount === 0n,
        "block-write extent is invalid");
        const writes = Array.from({ length: count }, (_, index) => ({
          lba: first + BigInt(index),
          bytes: payload.slice(index * CADR_M10_BLOCK_BYTES,
            (index + 1) * CADR_M10_BLOCK_BYTES),
        }));
        const result = await controller.commitWrites(writes, {
          completeGuest: async () => {
            await complete(request, hostStatusOk, new Uint8Array());
            guestCompleted = true;
          },
        });
        return Object.freeze({ serviced: true, operation: "write",
          firstBlock: first, blockCount: count, ...result });
      }
      await complete(request, hostStatusFailed,
        new Uint8Array(Number(request.completionByteCount ?? 0n)));
      guestCompleted = true;
      return Object.freeze({ serviced: true, operation: "unsupported",
        durable: true });
    } catch (error) {
      if (request !== null && !guestCompleted &&
          controller.state !== CADR_M10_CONTROLLER_IN_DOUBT) {
        try {
          await complete(request, hostStatusFailed,
            new Uint8Array(Number(request.completionByteCount ?? 0n)));
        } catch { /* Original persistence/transport error remains authoritative. */ }
      }
      throw error;
    } finally { busy = false; }
  }

  return Object.freeze({ serviceOnce });
}
