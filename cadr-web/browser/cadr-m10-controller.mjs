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

  const setState = next => {
    state = next; stateChanged(next);
  };

  async function invalidateAfterAmbiguousGuest() {
    if (state === CADR_M10_CONTROLLER_IN_DOUBT) return;
    setState(CADR_M10_CONTROLLER_IN_DOUBT);
    try { disk?.close(); } catch {}
    disk = null;
    await replaceWorker();
  }

  async function open({ initialize = false } = {}) {
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

  return Object.freeze({
    profile: CADR_M10_CONTROLLER_PROFILE,
    get state() { return state; },
    status, open,
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
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      busy = true;
      try {
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
        setState(disk.readOnly ? CADR_M10_CONTROLLER_RECOVERY_REQUIRED :
          CADR_M10_CONTROLLER_CLEAN);
        return status();
      } finally {
        busy = false;
      }
    },
    close() {
      required(!busy, "another persistence operation is active",
        CadrM10ConflictError);
      busy = true;
      try {
        if (disk !== null) disk.close();
        disk = null;
      } finally { busy = false; }
    },
  });
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
