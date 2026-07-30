import assert from "node:assert/strict";

import {
  CADR_M10_BASE_BLOCKS,
  CADR_M10_BASE_SHA256,
  CADR_M10_COMPLETE,
  CADR_M10_HEAD_BYTES,
  CADR_M10_MANIFEST_BYTES,
  CADR_M10_MANIFEST_LAYOUT_CANDIDATE,
  CADR_M10_MAX_ACTIVATION_RECORDS,
  CADR_M10_MAX_LBA,
  CADR_M10_NODE_BYTES,
  CADR_M10_STATE_CLEAN,
  CADR_M10_STATE_RECOVERY_REQUIRED,
  CADR_M10_STATE_SAVE_FAILED,
  CADR_M10_TRANSACTION_SEAMS,
  CadrM10ConflictError,
  CadrM10RecoveryError,
  cadrM10Sha256,
  createCadrM10MemoryBackend,
  parseCdrOvh1,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvh1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../cadr-web/wasm/cadr-m10-persistence.mjs";

const UUID = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
const UUID_TWO = Uint8Array.from({ length: 16 }, (_, index) => index + 21);
const PROFILE = await cadrM10Sha256(new TextEncoder().encode("test C-M10 profile"));
const ARTIFACTS = await cadrM10Sha256(new TextEncoder().encode("test C-M10 artifacts"));
const ZERO = new Uint8Array(32);
const MAX_U64 = 0xffffffffffffffffn;

function basePage(lba) {
  return Uint8Array.from({ length: 1024 }, (_, index) => Number((lba * 17n + BigInt(index)) & 255n));
}

function config(uuid = UUID) {
  return { diskUuid: uuid, profileSha256: PROFILE, artifactSetSha256: ARTIFACTS,
    readBasePage: async (lba) => basePage(lba) };
}

function page(seed) { return Uint8Array.from({ length: 1024 }, (_, index) => (seed + index * 19) & 255); }

async function testFixedCodecsAndCandidateManifestTable() {
  const children = Array.from({ length: 256 }, () => ZERO);
  children[5] = await cadrM10Sha256(page(5));
  const nodeBytes = await serializeCdrOvn1({ level: 0, prefix: 0x1200n, children });
  assert.equal(nodeBytes.byteLength, CADR_M10_NODE_BYTES);
  const node = await parseCdrOvn1(nodeBytes);
  assert.equal(node.level, 0); assert.equal(node.prefix, 0x1200n);
  assert.deepEqual(node.children[5], children[5]);
  const badNode = nodeBytes.slice(); badNode[32] = 1;
  await assert.rejects(parseCdrOvn1(badNode), /reserved fields/);
  const changedNode = nodeBytes.slice(); changedNode[40] ^= 1;
  assert.notDeepEqual((await parseCdrOvn1(changedNode)).hash, node.hash,
    "a node's immutable address covers every child byte");

  assert.deepEqual(CADR_M10_MANIFEST_LAYOUT_CANDIDATE, {
    magic: 0, schema: 8, headerBytes: 12, manifestBytes: 16, flags: 20,
    generation: 24, parentGeneration: 32, baseBytes: 40, baseBlocks: 48,
    blockBytes: 56, reserved0: 60, entryCount: 64, fanout: 72, depth: 76,
    diskUuid: 80, baseSha256: 96, profileSha256: 128, artifactSetSha256: 160,
    parentManifestSha256: 192, rootSha256: 224, reservedTail: 256, digest: 320,
  });
  const manifestBytes = await serializeCdrOvm1({ generation: 1n, parentGeneration: 0n, entryCount: 1n,
    diskUuid: UUID, baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE, artifactSetSha256: ARTIFACTS,
    parentManifestSha256: await cadrM10Sha256(new TextEncoder().encode("synthetic parent")), rootSha256: node.hash });
  assert.equal(manifestBytes.byteLength, CADR_M10_MANIFEST_BYTES);
  const manifest = await parseCdrOvm1(manifestBytes);
  assert.equal(manifest.flags, CADR_M10_COMPLETE); assert.equal(manifest.generation, 1n);
  const badReserved = manifestBytes.slice(); badReserved[256] = 1;
  await assert.rejects(parseCdrOvm1(badReserved), /reserved byte/);
  await assert.rejects(serializeCdrOvm1({ generation: 1n, parentGeneration: 1n, entryCount: 0n,
    diskUuid: UUID, baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE,
    artifactSetSha256: ARTIFACTS, parentManifestSha256: ZERO, rootSha256: node.hash }), /lineage/);
  await assert.rejects(serializeCdrOvm1({ generation: 0n, parentGeneration: 0n,
    entryCount: CADR_M10_BASE_BLOCKS + 1n, diskUuid: UUID,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE,
    artifactSetSha256: ARTIFACTS, rootSha256: node.hash }), /entry count/);
  await assert.rejects(serializeCdrOvm1({ generation: 0n, parentGeneration: 0n,
    entryCount: 0n, diskUuid: UUID, baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: PROFILE, artifactSetSha256: ARTIFACTS, rootSha256: ZERO }),
  /real root/);
  await assert.rejects(serializeCdrOvm1({ generation: 0n, parentGeneration: 0n,
    entryCount: 0n, diskUuid: UUID, baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: PROFILE, artifactSetSha256: ARTIFACTS,
    parentManifestSha256: node.hash, rootSha256: node.hash }), /parent hash/);
  const parsedBadManifest = manifestBytes.slice();
  new DataView(parsedBadManifest.buffer).setBigUint64(64, CADR_M10_BASE_BLOCKS + 1n, true);
  parsedBadManifest.set(await cadrM10Sha256(parsedBadManifest.subarray(0, 320)), 320);
  await assert.rejects(parseCdrOvm1(parsedBadManifest), /entry count/,
    "the parser and serializer share canonical manifest validation");

  const headBytes = await serializeCdrOvh1({ headSeq: 9n, writerEpoch: 8n, diskUuid: UUID,
    activeGeneration: 1n, activeManifestSha256: manifest.hash, activeRootSha256: node.hash,
    previousGeneration: 0n, baseSha256: manifest.baseSha256, profileSha256: PROFILE });
  assert.equal(headBytes.byteLength, CADR_M10_HEAD_BYTES);
  const head = await parseCdrOvh1(headBytes);
  assert.equal(head.headSeq, 9n); assert.equal(head.writerEpoch, 8n);
  const badHead = headBytes.slice(); badHead[20] = 1;
  await assert.rejects(parseCdrOvh1(badHead), /header/);
  await assert.rejects(serializeCdrOvh1({ headSeq: 0n, writerEpoch: 0n,
    diskUuid: UUID, activeGeneration: 1n, activeManifestSha256: manifest.hash,
    activeRootSha256: node.hash, previousGeneration: 0n,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE }), /sequence zero/);
  await assert.rejects(serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n,
    diskUuid: UUID, activeGeneration: 1n, activeManifestSha256: ZERO,
    activeRootSha256: node.hash, previousGeneration: 0n,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE }), /active manifest/);
  await assert.rejects(serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n,
    diskUuid: UUID, activeGeneration: 1n, activeManifestSha256: manifest.hash,
    activeRootSha256: node.hash, previousGeneration: 0n,
    previousManifestSha256: manifest.hash, previousRootSha256: ZERO,
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: PROFILE }), /partial previous/);
  const parsedBadHead = headBytes.slice();
  new DataView(parsedBadHead.buffer).setBigUint64(24, 0n, true);
  parsedBadHead.set(await cadrM10Sha256(parsedBadHead.subarray(0, 264)), 264);
  await assert.rejects(parseCdrOvh1(parsedBadHead), /sequence zero/,
    "the parser and serializer share canonical head validation");
}

async function testFullMapUpdateRemovalAndFencing() {
  const backend = createCadrM10MemoryBackend(); const disk = await backend.initializeDisk(config());
  assert.equal(disk.generation, 0n); assert.equal(disk.headSeq, 1n);
  assert.deepEqual(await disk.readBlock(0n), basePage(0n));
  const writer = disk.beginWriter();
  const replacement = page(61);
  const committed = await disk.commit({ writerEpoch: writer, writes: [
    { lba: 0n, bytes: replacement }, { lba: 1n, bytes: page(62) },
  ] });
  assert.equal(committed.changed, true); assert.equal(committed.generation, 1n); assert.equal(disk.headSeq, 2n);
  assert.deepEqual(await disk.readBlock(0n), replacement);
  assert.deepEqual(await disk.readBlock(1n), page(62));
  const high = page(88);
  await disk.commit({ writerEpoch: writer, writes: [{ lba: CADR_M10_MAX_LBA, bytes: high }] });
  assert.deepEqual(await disk.readBlock(CADR_M10_MAX_LBA), high);
  const removed = await disk.commit({ writerEpoch: writer, writes: [{ lba: 0n, bytes: basePage(0n) }] });
  assert.equal(removed.changed, true); assert.deepEqual(await disk.readBlock(0n), basePage(0n));
  const noChange = await disk.commit({ writerEpoch: writer, writes: [{ lba: 0n, bytes: basePage(0n) }] });
  assert.equal(noChange.changed, false);
  disk.closeWriter(writer);
  assert.throws(() => disk.closeWriter(writer), CadrM10ConflictError);
  const second = disk.beginWriter(); assert.notEqual(second, writer);
  await assert.rejects(disk.commit({ writerEpoch: writer, writes: [{ lba: 2n, bytes: page(2) }] }), CadrM10ConflictError);
  await assert.rejects(disk.commit({ writerEpoch: second, writes: [{ lba: CADR_M10_BASE_BLOCKS, bytes: page(2) }] }), /outside/);
  await assert.rejects(disk.commit({ writerEpoch: second, writes: [{ lba: 3n, bytes: page(3) }, { lba: 2n, bytes: page(2) }] }), /increasing/);
}

async function testActivationRecoveryAndNoEmptyFallback() {
  const backend = createCadrM10MemoryBackend(); let disk = await backend.initializeDisk(config());
  const writer = disk.beginWriter(); await disk.commit({ writerEpoch: writer, writes: [{ lba: 3n, bytes: page(3) }] });
  const key = [...backend.store.disks.keys()][0]; backend.store.heads.set(key, new Uint8Array(296));
  disk = await backend.reopenDisk(config());
  assert.equal(disk.state, CADR_M10_STATE_RECOVERY_REQUIRED); assert.equal(disk.readOnly, true);
  assert.deepEqual(await disk.readBlock(3n), page(3));
  assert.throws(() => disk.beginWriter(), CadrM10RecoveryError);

  const prior = createCadrM10MemoryBackend(); let priorDisk = await prior.initializeDisk(config(UUID_TWO));
  const priorWriter = priorDisk.beginWriter();
  await priorDisk.commit({ writerEpoch: priorWriter, writes: [{ lba: 5n, bytes: page(5) }] });
  await priorDisk.commit({ writerEpoch: priorWriter, writes: [{ lba: 6n, bytes: page(6) }] });
  const priorKey = [...prior.store.disks.keys()][0];
  const latest = prior.store.heads.get(priorKey); const latestHead = await parseCdrOvh1(latest);
  prior.store.activations.get(`${priorKey}:${latestHead.headSeq}`).headBytes.fill(0);
  priorDisk = await prior.reopenDisk(config(UUID_TWO));
  assert.equal(priorDisk.state, CADR_M10_STATE_RECOVERY_REQUIRED);
  assert.deepEqual(await priorDisk.readBlock(5n), page(5), "previous binding is recoverable before activation scan");
  assert.deepEqual(await priorDisk.readBlock(6n), basePage(6n));

  const broken = createCadrM10MemoryBackend(); await broken.initializeDisk(config(UUID_TWO));
  const brokenKey = [...broken.store.disks.keys()][0]; broken.store.heads.set(brokenKey, new Uint8Array(296));
  for (const [activationKey, activation] of broken.store.activations) {
    if (activationKey.startsWith(`${brokenKey}:`)) activation.headBytes.fill(0);
  }
  await assert.rejects(broken.reopenDisk(config(UUID_TWO)), CadrM10RecoveryError);
}

async function testFaultsAtEveryTransactionSeam() {
  for (const seam of CADR_M10_TRANSACTION_SEAMS) {
    const backend = createCadrM10MemoryBackend({ faultInjector: ({ seam: current }) => current === seam });
    const disk = await backend.initializeDisk(config()); const writer = disk.beginWriter();
    const durableRoot = disk.rootSha256; let completions = 0;
    const result = await disk.commit({ writerEpoch: writer,
      writes: [{ lba: 4n, bytes: page(4) }],
      onCoreCompletion: async () => { completions += 1; },
    }).catch((error) => error);
    const atOrAfterCoreCompletion = CADR_M10_TRANSACTION_SEAMS.indexOf(seam) >=
      CADR_M10_TRANSACTION_SEAMS.indexOf("after-core-completion");
    const postPublication = CADR_M10_TRANSACTION_SEAMS.indexOf(seam) >=
      CADR_M10_TRANSACTION_SEAMS.indexOf("after-head-activation");
    if (postPublication) {
      assert.equal(result.durable, true, `${seam} re-reads durable head`);
      assert.equal(completions, 1); assert.equal(disk.state, CADR_M10_STATE_CLEAN);
      assert.equal(disk.paused, false);
      assert.deepEqual(await disk.readBlock(4n), page(4));
    } else if (atOrAfterCoreCompletion) {
      assert.equal(result.seam, seam); assert.equal(completions, 1);
      assert.equal(disk.state, CADR_M10_STATE_SAVE_FAILED, seam);
      assert.equal(disk.paused, true, seam);
      assert.deepEqual(disk.rootSha256, durableRoot, "durable root remains old");
      assert.notDeepEqual(disk.workingRootSha256, durableRoot, "failed save retains working root");
      assert.deepEqual(await disk.readBlock(4n), basePage(4n));
    } else {
      assert.equal(result.seam, seam);
      assert.equal(completions, seam === "before-core-completion" ? 0 :
        (CADR_M10_TRANSACTION_SEAMS.indexOf(seam) >
          CADR_M10_TRANSACTION_SEAMS.indexOf("before-core-completion") ? 1 : 0));
      assert.equal(disk.state, CADR_M10_STATE_CLEAN); assert.equal(disk.paused, false);
      assert.deepEqual(disk.workingRootSha256, durableRoot);
      assert.deepEqual(await disk.readBlock(4n), basePage(4n));
    }
  }
}

async function testBoundedCollectionAndRootPin() {
  const backend = createCadrM10MemoryBackend(); const disk = await backend.initializeDisk(config()); const writer = disk.beginWriter();
  await disk.commit({ writerEpoch: writer, writes: [{ lba: 7n, bytes: page(7) }] });
  const pin = await disk.pinRoot("snapshot");
  await disk.commit({ writerEpoch: writer, writes: [{ lba: 7n, bytes: basePage(7n) }] });
  let report;
  do { report = await disk.collectGarbage({ budget: 1 }); } while (!report.complete);
  assert.ok(backend.store.pages.size >= 1, "pinned snapshot retains its page");
  await disk.unpinRoot(pin);
  do { report = await disk.collectGarbage({ budget: 3 }); } while (!report.complete);
  assert.ok(backend.store.pages.size >= 1, "previous generation remains a mandatory recovery root");
}

async function testCorruptPageNeverSilentlyReads() {
  const backend = createCadrM10MemoryBackend(); const disk = await backend.initializeDisk(config()); const writer = disk.beginWriter();
  await disk.commit({ writerEpoch: writer, writes: [{ lba: 9n, bytes: page(9) }] });
  const [key, stored] = backend.store.pages.entries().next().value; stored[0] ^= 1;
  await assert.rejects(disk.readBlock(9n), /immutable hash mismatch/);
  assert.ok(backend.store.pages.has(key));
}

async function testOpenSessionInvalidatesEveryOldHandle() {
  const backend = createCadrM10MemoryBackend();
  const oldDisk = await backend.initializeDisk(config());
  const oldWriter = oldDisk.beginWriter();
  const disk = await oldDisk.reopen();
  assert.throws(() => oldDisk.beginWriter(), CadrM10ConflictError);
  assert.throws(() => oldDisk.closeWriter(oldWriter), CadrM10ConflictError);
  await assert.rejects(oldDisk.readBlock(0n), CadrM10ConflictError);
  await assert.rejects(oldDisk.pinRoot("snapshot"), CadrM10ConflictError);
  assert.throws(() => oldDisk.collectGarbage(), CadrM10ConflictError);
  const writer = disk.beginWriter();
  await disk.commit({ writerEpoch: writer, writes: [{ lba: 10n, bytes: page(10) }] });
  assert.deepEqual(await disk.readBlock(10n), page(10));
}

async function testConcurrentInitializationHasOneCanonicalRecord() {
  const backend = createCadrM10MemoryBackend();
  const results = await Promise.allSettled([
    backend.initializeDisk(config()),
    backend.initializeDisk(config()),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof CadrM10ConflictError);
  assert.equal(backend.store.disks.size, 1);

  const onlyHandle = fulfilled[0].value;
  const writer = onlyHandle.beginWriter();
  await onlyHandle.commit({
    writerEpoch: writer, writes: [{ lba: 18n, bytes: page(18) }],
  });
  assert.equal(onlyHandle.headSeq, 2n);
  const reopened = await backend.reopenDisk(config());
  assert.equal(reopened.headSeq, 2n);
  assert.deepEqual(await reopened.readBlock(18n), page(18),
    "the sole returned handle commits through the canonical stored record");
  assert.throws(() => onlyHandle.beginWriter(), CadrM10ConflictError);
}

async function testFailedInitializationRollsBackCanonicalReservation() {
  const backend = createCadrM10MemoryBackend();
  const originalActivationSet = backend.store.activations.set;
  const originalDigest = crypto.subtle.digest;
  let enterPostHead;
  let releasePostHead;
  const postHeadEntered = new Promise((resolve) => { enterPostHead = resolve; });
  const postHeadGate = new Promise((resolve) => { releasePostHead = resolve; });
  let gateInstalled = false;
  let gateUsed = false;
  backend.store.activations.set = function installPostHeadGate(key, value) {
    const result = originalActivationSet.call(this, key, value);
    if (!gateInstalled) {
      gateInstalled = true;
      crypto.subtle.digest = async function postHeadDigestGate(...args) {
        if (!gateUsed) {
          gateUsed = true;
          enterPostHead();
          await postHeadGate;
        }
        return originalDigest.apply(this, args);
      };
    }
    return result;
  };
  let reservedKey;
  try {
    const failedInitialization = backend.initializeDisk(config()).catch((error) => error);
    await postHeadEntered;
    [reservedKey] = backend.store.disks.keys();
    assert.ok(reservedKey, "the UUID is reserved synchronously before initialization awaits");
    assert.equal(backend.store.disks.get(reservedKey).phase, "INITIALIZING");
    assert.ok(backend.store.heads.has(reservedKey));
    assert.ok(backend.store.activations.has(`${reservedKey}:1`));
    await assert.rejects(backend.reopenDisk(config()), /initialization has not committed/);
    backend.store.meta.delete(reservedKey);
    releasePostHead();
    const failure = await failedInitialization;
    assert.match(failure.message, /metadata disappeared/);
  } finally {
    releasePostHead();
    crypto.subtle.digest = originalDigest;
    delete backend.store.activations.set;
  }
  assert.equal(backend.store.disks.has(reservedKey), false);
  assert.equal(backend.store.meta.has(reservedKey), false);
  assert.equal(backend.store.heads.has(reservedKey), false);
  assert.equal([...backend.store.activations.keys()].some((key) =>
    key.startsWith(`${reservedKey}:`)), false);

  const retried = await backend.initializeDisk(config());
  assert.equal(backend.store.disks.get(reservedKey).phase, "OPEN");
  assert.equal(backend.store.meta.get(reservedKey).phase, "OPEN");
  assert.equal(retried.headSeq, 1n);
  assert.deepEqual(await retried.readBlock(0n), basePage(0n));
  const reopened = await retried.reopen();
  assert.equal(backend.store.disks.get(reservedKey).phase, "OPEN");
  assert.equal(reopened.headSeq, 1n);
}

async function testRootReferenceOwnershipAndMonotonicIds() {
  const backend = createCadrM10MemoryBackend();
  const diskA = await backend.initializeDisk(config());
  const diskB = await backend.initializeDisk(config(UUID_TWO));
  const first = await diskA.pinRoot("snapshot");
  await diskA.unpinRoot(first);
  const second = await diskA.pinRoot("snapshot");
  assert.notEqual(second, first, "deleted reference identifiers are never reused");
  await assert.rejects(diskB.unpinRoot(second), /not owned by this disk/);
  assert.ok(backend.store.refs.has(second),
    "a cross-disk unpin cannot delete another disk's reference");
  await diskA.unpinRoot(second);
  assert.equal(backend.store.refs.size, 0);
  const diskAKey = [...backend.store.disks.keys()][0];
  backend.store.disks.get(diskAKey).refHighWater = MAX_U64;
  await assert.rejects(diskA.pinRoot("clone"), /identifier exhausted/);
}

async function testPinFinalPublicationSessionRollback() {
  const backend = createCadrM10MemoryBackend();
  const disk = await backend.initializeDisk(config());
  const refs = backend.store.refs;
  const originalSet = refs.set;
  let reopened = null;
  refs.set = function reopenDuringPublication(key, value) {
    const result = originalSet.call(this, key, value);
    reopened = disk.reopen();
    return result;
  };
  try {
    const pin = disk.pinRoot("export").catch((error) => error);
    const failure = await pin;
    assert.match(failure.message, /stale open-session/);
    const reopenedDisk = await reopened;
    assert.equal(refs.size, 0,
      "session invalidation inside the final reference mutation rolls it back");
    refs.set = function throwAfterPublication(key, value) {
      originalSet.call(this, key, value);
      throw new Error("synthetic reference-store failure");
    };
    await assert.rejects(reopenedDisk.pinRoot("clone"), /reference-store failure/);
    assert.equal(refs.size, 0,
      "a throwing reference-store mutation rolls back its exact inserted value");
  } finally {
    delete refs.set;
  }
}

async function testPinResultSeamKeepsPublishedOwnedReference() {
  const backend = createCadrM10MemoryBackend();
  const diskA = await backend.initializeDisk(config());
  const diskB = await backend.initializeDisk(config(UUID_TWO));
  const refs = backend.store.refs;
  const originalSet = refs.set;
  let reopenedPromise = null;
  refs.set = function reopenAfterPublication(key, value) {
    const result = originalSet.call(this, key, value);
    queueMicrotask(() => { reopenedPromise = diskA.reopen(); });
    return result;
  };
  let id;
  try {
    id = await diskA.pinRoot("snapshot");
  } finally {
    delete refs.set;
  }
  assert.ok(reopenedPromise,
    "reopen was scheduled after publication and before the outer result resumed");
  const reopenedA = await reopenedPromise;
  const reference = refs.get(id);
  assert.ok(reference, "the successfully returned pin ID remains retained");
  assert.equal(reference.id, id);
  assert.equal(reference.kind, "snapshot");
  assert.deepEqual(reference.diskUuid, UUID);
  await assert.rejects(diskB.unpinRoot(id), /not owned by this disk/);
  assert.ok(refs.has(id), "a foreign disk cannot release the retained result-seam pin");
  await reopenedA.unpinRoot(id);
  assert.equal(refs.has(id), false,
    "the new session for the owning disk may release its published pin");
}

async function testAwaitingReadAndPinAreSessionFenced() {
  let enterBase;
  let releaseBase;
  const baseEntered = new Promise((resolve) => { enterBase = resolve; });
  const baseGate = new Promise((resolve) => { releaseBase = resolve; });
  let gateBase = true;
  const readBackend = createCadrM10MemoryBackend();
  const oldReadDisk = await readBackend.initializeDisk({
    ...config(),
    readBasePage: async (lba) => {
      if (gateBase) {
        gateBase = false;
        enterBase();
        await baseGate;
      }
      return basePage(lba);
    },
  });
  const staleRead = oldReadDisk.readBlock(19n).catch((error) => error);
  await baseEntered;
  const reopenedRead = oldReadDisk.reopen();
  releaseBase();
  await reopenedRead;
  assert.match((await staleRead).message, /stale open-session/,
    "a base read cannot return after its open session is replaced");

  const pinBackend = createCadrM10MemoryBackend();
  const oldPinDisk = await pinBackend.initializeDisk(config(UUID_TWO));
  const originalDigest = crypto.subtle.digest;
  let enterDigest;
  let releaseDigest;
  const digestEntered = new Promise((resolve) => { enterDigest = resolve; });
  const digestGate = new Promise((resolve) => { releaseDigest = resolve; });
  let gateDigest = true;
  crypto.subtle.digest = async function gatedDigest(...args) {
    if (gateDigest) {
      gateDigest = false;
      enterDigest();
      await digestGate;
    }
    return originalDigest.apply(this, args);
  };
  try {
    const stalePin = oldPinDisk.pinRoot("snapshot").catch((error) => error);
    await digestEntered;
    const reopenedPin = oldPinDisk.reopen();
    releaseDigest();
    await reopenedPin;
    assert.match((await stalePin).message, /stale open-session/,
      "tree validation cannot publish a pin after its session is replaced");
    assert.equal(pinBackend.store.refs.size, 0);
  } finally {
    crypto.subtle.digest = originalDigest;
    releaseDigest();
  }
}

async function testCommitSerializationAndPreActivationRecheck() {
  let releaseBase;
  let enteredBase;
  const baseEntered = new Promise((resolve) => { enteredBase = resolve; });
  const baseGate = new Promise((resolve) => { releaseBase = resolve; });
  const backend = createCadrM10MemoryBackend();
  const disk = await backend.initializeDisk({
    ...config(),
    readBasePage: async (lba) => {
      enteredBase();
      await baseGate;
      return basePage(lba);
    },
  });
  const writer = disk.beginWriter();
  const first = disk.commit({ writerEpoch: writer, writes: [{ lba: 11n, bytes: page(11) }] });
  await baseEntered;
  await assert.rejects(
    disk.commit({ writerEpoch: writer, writes: [{ lba: 12n, bytes: page(12) }] }),
    /another commit/,
  );
  await assert.rejects(disk.reopen(), /active commit/);
  assert.equal((await disk.collectGarbage()).phase, "blocked");
  releaseBase();
  await first;

  let tamperBackend;
  const tampered = createCadrM10MemoryBackend({
    faultInjector: ({ seam }) => {
      if (seam !== "before-head-activation") return false;
      const [key] = tamperBackend.store.disks.keys();
      tamperBackend.store.heads.get(key)[0] ^= 1;
      return false;
    },
  });
  tamperBackend = tampered;
  const tamperedDisk = await tampered.initializeDisk(config(UUID_TWO));
  const tamperedWriter = tamperedDisk.beginWriter();
  const oldRoot = tamperedDisk.rootSha256;
  await assert.rejects(
    tamperedDisk.commit({
      writerEpoch: tamperedWriter,
      writes: [{ lba: 12n, bytes: page(12) }],
      onCoreCompletion: async () => {},
    }),
    /stored head changed/,
  );
  assert.equal(tamperedDisk.state, CADR_M10_STATE_SAVE_FAILED);
  assert.equal(tamperedDisk.paused, true);
  assert.deepEqual(tamperedDisk.rootSha256, oldRoot);
  const key = [...tampered.store.disks.keys()][0];
  assert.equal(tampered.store.activations.size, 1,
    "pre-activation conflict must not publish a new activation");
  assert.ok(tampered.store.activations.has(`${key}:1`));
}

async function testBackendGlobalGcInterleaving() {
  const backend = createCadrM10MemoryBackend();
  const diskA = await backend.initializeDisk(config());
  const diskB = await backend.initializeDisk(config(UUID_TWO));
  const writerA = diskA.beginWriter(); const writerB = diskB.beginWriter();
  await diskA.commit({ writerEpoch: writerA, writes: [{ lba: 13n, bytes: page(13) }] });
  await diskB.commit({ writerEpoch: writerB, writes: [{ lba: 14n, bytes: page(14) }] });

  const collection = diskA.collectGarbage({ budget: 1000 });
  const pin = diskB.pinRoot("snapshot");
  const invalidated = await collection;
  await pin;
  assert.equal(invalidated.invalidated, true,
    "a root mutation on disk B invalidates disk A's backend-global collector");

  const oneCollector = diskA.collectGarbage({ budget: 1 });
  await assert.rejects(diskB.collectGarbage({ budget: 1 }), /backend-global GC/);
  await oneCollector;

  let releaseBase;
  let enteredBase;
  const entered = new Promise((resolve) => { enteredBase = resolve; });
  const gate = new Promise((resolve) => { releaseBase = resolve; });
  const blockingBackend = createCadrM10MemoryBackend();
  const blockingA = await blockingBackend.initializeDisk(config());
  const blockingB = await blockingBackend.initializeDisk({
    ...config(UUID_TWO),
    readBasePage: async (lba) => {
      enteredBase();
      await gate;
      return basePage(lba);
    },
  });
  const blockingWriter = blockingB.beginWriter();
  const commit = blockingB.commit({
    writerEpoch: blockingWriter, writes: [{ lba: 15n, bytes: page(15) }],
  });
  await entered;
  const blocked = await blockingA.collectGarbage({ budget: 100 });
  assert.equal(blocked.phase, "blocked");
  releaseBase();
  await commit;
  let report;
  do { report = await blockingA.collectGarbage({ budget: 3 }); } while (!report.complete);
  assert.deepEqual(await blockingB.readBlock(15n), page(15),
    "collection rooted from disk A cannot delete disk B's live objects");
}

async function testActivationQuarantineAndScanBound() {
  const backend = createCadrM10MemoryBackend();
  let disk = await backend.initializeDisk(config());
  const key = [...backend.store.disks.keys()][0];
  backend.store.activations.set(`${key}:01`, { malformed: true });
  backend.store.activations.set(`${key}:${MAX_U64 + 1n}`, { malformed: true });
  backend.store.activations.set(`${key}:99`, { malformed: true });
  backend.store.activations.set("not-an-activation-key", { malformed: true });
  disk = await backend.reopenDisk(config());
  assert.equal(disk.state, CADR_M10_STATE_CLEAN);
  assert.equal(backend.store.activation_quarantine.size, 4);
  assert.ok(backend.store.activations.has(`${key}:1`),
    "malformed records do not prevent recovery from the valid activation");

  const oversized = createCadrM10MemoryBackend();
  await oversized.initializeDisk(config(UUID_TWO));
  for (let index = 0; oversized.store.activations.size <= CADR_M10_MAX_ACTIVATION_RECORDS;
    index += 1) {
    oversized.store.activations.set(`malformed-${index}`, null);
  }
  await assert.rejects(oversized.reopenDisk(config(UUID_TWO)), /activation volume/);
}

async function testActivationPublicationPrunesAtBound() {
  const backend = createCadrM10MemoryBackend();
  const disk = await backend.initializeDisk(config());
  const diskKey = [...backend.store.disks.keys()][0];
  const currentHeadBytes = backend.store.heads.get(diskKey);
  const currentHead = await parseCdrOvh1(currentHeadBytes);
  for (let sequence = 3n; sequence <= 4097n; sequence += 1n) {
    const fillerHead = await serializeCdrOvh1({
      headSeq: sequence, writerEpoch: currentHead.writerEpoch,
      diskUuid: currentHead.diskUuid,
      activeGeneration: currentHead.activeGeneration,
      activeManifestSha256: currentHead.activeManifestSha256,
      activeRootSha256: currentHead.activeRootSha256,
      previousGeneration: 0n,
      baseSha256: currentHead.baseSha256,
      profileSha256: currentHead.profileSha256,
    });
    backend.store.activations.set(`${diskKey}:${sequence}`, {
      diskUuid: UUID.slice(), headSeq: sequence, headBytes: fillerHead,
    });
  }
  assert.equal(backend.store.activations.size, CADR_M10_MAX_ACTIVATION_RECORDS);
  const writer = disk.beginWriter();
  await disk.commit({
    writerEpoch: writer, writes: [{ lba: 20n, bytes: page(20) }],
  });
  assert.equal(backend.store.activations.size, CADR_M10_MAX_ACTIVATION_RECORDS);
  assert.ok(backend.store.activations.has(`${diskKey}:1`));
  assert.ok(backend.store.activations.has(`${diskKey}:2`));
  assert.equal(backend.store.activations.has(`${diskKey}:3`), false,
    "the oldest unprotected activation is pruned before publication");
  const reopened = await backend.reopenDisk(config());
  assert.equal(reopened.headSeq, 2n);
  assert.deepEqual(await reopened.readBlock(20n), page(20));
}

async function testResourceExhaustionAndPinValidation() {
  const writerBackend = createCadrM10MemoryBackend();
  const writerDisk = await writerBackend.initializeDisk(config());
  const writerKey = [...writerBackend.store.disks.keys()][0];
  writerBackend.store.disks.get(writerKey).writerHighWater = MAX_U64;
  assert.throws(() => writerDisk.beginWriter(), /writer epoch exhausted/);

  const generationBackend = createCadrM10MemoryBackend();
  const generationDisk = await generationBackend.initializeDisk(config(UUID_TWO));
  const generationKey = [...generationBackend.store.disks.keys()][0];
  generationBackend.store.disks.get(generationKey).highWater = MAX_U64;
  const generationWriter = generationDisk.beginWriter();
  let completions = 0;
  await assert.rejects(generationDisk.commit({
    writerEpoch: generationWriter,
    writes: [{ lba: 16n, bytes: page(16) }],
    onCoreCompletion: async () => { completions += 1; },
  }), /generation high-water/);
  assert.equal(completions, 1);
  assert.equal(generationDisk.state, CADR_M10_STATE_SAVE_FAILED);

  const headBackend = createCadrM10MemoryBackend();
  const headDisk = await headBackend.initializeDisk(config());
  const headKey = [...headBackend.store.disks.keys()][0];
  const record = headBackend.store.disks.get(headKey);
  const oldHead = record.runtime.head;
  const exhaustedBytes = await serializeCdrOvh1({
    headSeq: MAX_U64, writerEpoch: oldHead.writerEpoch, diskUuid: oldHead.diskUuid,
    activeGeneration: oldHead.activeGeneration,
    activeManifestSha256: oldHead.activeManifestSha256,
    activeRootSha256: oldHead.activeRootSha256,
    previousGeneration: oldHead.previousGeneration,
    previousManifestSha256: oldHead.previousManifestSha256,
    previousRootSha256: oldHead.previousRootSha256,
    baseSha256: oldHead.baseSha256, profileSha256: oldHead.profileSha256,
  });
  const exhaustedHead = await parseCdrOvh1(exhaustedBytes);
  headBackend.store.heads.set(headKey, exhaustedBytes);
  headBackend.store.activations.delete(`${headKey}:1`);
  headBackend.store.activations.set(`${headKey}:${MAX_U64}`, {
    diskUuid: exhaustedHead.diskUuid, headSeq: MAX_U64, headBytes: exhaustedBytes,
  });
  record.runtime.head = exhaustedHead;
  const headWriter = headDisk.beginWriter();
  await assert.rejects(headDisk.commit({
    writerEpoch: headWriter, writes: [{ lba: 17n, bytes: page(17) }],
    onCoreCompletion: async () => { assert.fail("head exhaustion precedes core completion"); },
  }), /head sequence/);
  assert.equal(headDisk.state, CADR_M10_STATE_CLEAN);

  await headDisk.collectGarbage({ budget: 1 });
  assert.ok(headBackend.store.gc_marks.size > 0);
  await assert.rejects(headDisk.pinRoot("snapshot", ZERO), /missing/);
  assert.equal(headBackend.store.refs.size, 0);
  assert.equal(headBackend.store.gc_marks.size, 0,
    "even a failed pin is a global root mutation that invalidates marks");
}

await testFixedCodecsAndCandidateManifestTable();
await testFullMapUpdateRemovalAndFencing();
await testActivationRecoveryAndNoEmptyFallback();
await testFaultsAtEveryTransactionSeam();
await testBoundedCollectionAndRootPin();
await testCorruptPageNeverSilentlyReads();
await testOpenSessionInvalidatesEveryOldHandle();
await testConcurrentInitializationHasOneCanonicalRecord();
await testFailedInitializationRollsBackCanonicalReservation();
await testRootReferenceOwnershipAndMonotonicIds();
await testPinFinalPublicationSessionRollback();
await testPinResultSeamKeepsPublishedOwnedReference();
await testAwaitingReadAndPinAreSessionFenced();
await testCommitSerializationAndPreActivationRecheck();
await testBackendGlobalGcInterleaving();
await testActivationQuarantineAndScanBound();
await testActivationPublicationPrunesAtBound();
await testResourceExhaustionAndPinValidation();
console.log("cadr_m10_persistence.mjs: ok");
