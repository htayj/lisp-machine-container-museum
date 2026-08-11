import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import {
  CADR_M10_BASE_SHA256,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../cadr-web/wasm/cadr-m10-persistence.mjs";
import {
  CADR_M10_CONTROLLER_IN_DOUBT,
  createCadrM10Controller,
  createCadrM10WorkerDiskBridge,
  parseCadrM10OverlayExport,
} from "../cadr-web/browser/cadr-m10-controller.mjs";

const hash = seed => Uint8Array.from({ length: 32 },
  (_, index) => (seed + index * 17) & 255);
const binding = {
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
  baseSha256: CADR_M10_BASE_SHA256,
  profileSha256: hash(2),
  artifactSetSha256: hash(3),
};
const basePath = process.env.CADR_M10_BASE_IMAGE ??
  new URL("../l/usim/disk-sys-303-0.img", import.meta.url);
const baseFile = await open(basePath, "r");
const observedBaseIdentity = new Uint8Array(await new Promise(
  (resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(basePath);
    stream.on("data", chunk => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest()));
  }));
assert.deepEqual(observedBaseIdentity, CADR_M10_BASE_SHA256);
const basePage = async lba => {
  const output = new Uint8Array(1024);
  const result = await baseFile.read(output, 0, output.byteLength,
    Number(lba * 1024n));
  assert.equal(result.bytesRead, output.byteLength);
  return output;
};
const workerFixture = new URL(
  "./fixtures/cadr-m10-worker-channel.mjs", import.meta.url);

async function fakeBackend({ failCommit = false, failStage = false,
  compactGate = null, reopenGate = null, pinGate = null, unpinGate = null,
  failFirstUnpin = false, postCommitFirstUnpinFailure = false } = {}) {
  const zeroChildren = Array.from({ length: 256 }, () => new Uint8Array(32));
  const rootBytes = await serializeCdrOvn1({
    level: 2, prefix: 0n, children: zeroChildren,
  });
  const root = await parseCdrOvn1(rootBytes);
  const genesisBytes = await serializeCdrOvm1({
    generation: 0n, parentGeneration: 0n, entryCount: 0n,
    diskUuid: binding.diskUuid, baseSha256: binding.baseSha256,
    profileSha256: binding.profileSha256,
    artifactSetSha256: binding.artifactSetSha256,
    rootSha256: root.hash,
  });
  let manifest = await parseCdrOvm1(genesisBytes);
  let headSeq = 1n; let writer = 0n; let activeWriter = 0n;
  let pending = 0n; let deleted = false; let session = 1n;
  let pinSequence = 0; let unpinAttempts = 0; let reportedPostCommitUnpin = false;
  const pins = new Map(); const issuedPins = new Set();
  const pages = new Map();
  const nodes = new Map([[Buffer.from(root.hash).toString("hex"), rootBytes]]);
  let stageOrdinal = 0; let commitOrdinal = 0;

  const disk = {
    readOnly: false,
    get sessionId() { return session; },
    close() {},
    async active() {
      return { manifest, head: { headSeq } };
    },
    async exportActiveClosure() {
      const reachableNodes = new Map(); const reachablePages = new Map();
      const visit = async (nodeHash, level) => {
        const key = Buffer.from(nodeHash).toString("hex");
        const nodeBytes = nodes.get(key);
        assert.notEqual(nodeBytes, undefined);
        const node = await parseCdrOvn1(nodeBytes);
        reachableNodes.set(key, nodeBytes);
        for (const child of node.children) {
          if (child.every(value => value === 0)) continue;
          if (level === 0) {
            const pageKey = Buffer.from(child).toString("hex");
            reachablePages.set(pageKey, pages.get(pageKey));
          } else await visit(child, level - 1);
        }
      };
      await visit(manifest.rootSha256, 2);
      return {
        generation: manifest.generation, headSeq,
        manifestSha256: manifest.hash.slice(),
        entryCount: manifest.entryCount,
        rootSha256: manifest.rootSha256.slice(),
        pages: [...reachablePages].map(([key, value]) =>
          ({ key, bytes: value.slice() })),
        nodes: [...reachableNodes].map(([key, value]) =>
          ({ key, bytes: value.slice() })),
      };
    },
    async pinRoot(kind, rootSha256) {
      assert.equal(kind, "snapshot");
      assert.deepEqual(rootSha256, manifest.rootSha256);
      if (pinGate !== null) await pinGate();
      const id = `fake:snapshot:${++pinSequence}`;
      pins.set(id, rootSha256.slice()); issuedPins.add(id);
      return id;
    },
    async unpinRoot(id) {
      unpinAttempts += 1;
      if (unpinGate !== null) await unpinGate();
      if (failFirstUnpin && unpinAttempts === 1) {
        throw new Error("synthetic review unpin failure");
      }
      if (postCommitFirstUnpinFailure && !reportedPostCommitUnpin) {
        assert.equal(pins.delete(id), true, "unknown fake review pin");
        reportedPostCommitUnpin = true;
        throw new Error("synthetic review unpin response lost after commit");
      }
      assert.equal(issuedPins.has(id), true, "unknown fake review pin");
      pins.delete(id);
    },
    async beginWriter() {
      assert.equal(activeWriter, 0n);
      writer += 1n; activeWriter = writer; return writer;
    },
    async reserveGeneration(epoch) {
      assert.equal(epoch, writer); pending = manifest.generation + 1n;
      return pending;
    },
    async closeWriter(epoch) {
      assert.equal(epoch, activeWriter); activeWriter = 0n; pending = 0n;
    },
    async stage(objects) {
      stageOrdinal += 1;
      if (failStage) throw new Error("synthetic pre-guest staging failure");
      for (const page of objects.pages ?? []) {
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", page));
        pages.set(Buffer.from(digest).toString("hex"), page.slice());
      }
      for (const nodeBytes of objects.nodes ?? []) {
        const node = await parseCdrOvn1(nodeBytes);
        nodes.set(Buffer.from(node.hash).toString("hex"), nodeBytes.slice());
      }
    },
    async commit({ manifestBytes, objects }) {
      commitOrdinal += 1;
      if (failCommit) throw new Error("synthetic post-guest publication failure");
      await this.stage(objects);
      const next = await parseCdrOvm1(manifestBytes);
      assert.equal(next.generation, pending);
      manifest = next; headSeq += 1n; pending = 0n;
      activeWriter = 0n;
      return { durable: true, recoveredAfterFault: false,
        generation: manifest.generation, headSeq,
        rootSha256: manifest.rootSha256.slice() };
    },
    async compact({ writerEpoch }) {
      assert.equal(writerEpoch, activeWriter);
      if (compactGate !== null) await compactGate();
      return { removed: { pages: 0, nodes: 0, manifests: 0 },
        retained: { pages: pages.size, nodes: nodes.size, manifests: 1 } };
    },
  };
  return {
    initializeDisk: async () => disk,
    reopenDisk: async () => {
      if (reopenGate !== null) await reopenGate();
      pending = 0n; activeWriter = 0n; session += 1n; return disk;
    },
    deleteDisk: async () => { deleted = true; },
    inspect: () => ({ stageOrdinal, commitOrdinal, manifest, headSeq,
      activeWriter, deleted, session, pins: new Map(pins), unpinAttempts }),
  };
}

const backend = await fakeBackend();
const states = [];
const wrongBaseController = createCadrM10Controller({
  backend: await fakeBackend(), binding, readBasePage: basePage,
  readBaseIdentity: async () => hash(99),
  replaceWorker: async () => {},
});
await assert.rejects(() => wrongBaseController.open({ initialize: true }),
  /base callback identity differs/);
const controller = createCadrM10Controller({
  backend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
  stateChanged: state => states.push(state),
});
await controller.open({ initialize: true });
let guestCompletedAfterStage = false;
const changed = Uint8Array.from({ length: 1024 },
  (_, index) => (index * 7 + 9) & 255);
const committed = await controller.commitWrites([
  { lba: 1n, bytes: changed },
], { completeGuest: async () => {
  guestCompletedAfterStage = backend.inspect().stageOrdinal > 0 &&
    backend.inspect().commitOrdinal === 0;
} });
assert.equal(committed.changed, true);
assert.equal(guestCompletedAfterStage, true,
  "immutable staging must precede guest completion and activation");
assert.deepEqual(await controller.readBlock(1n), changed);

const archiveBytes = await controller.exportOverlay();
const archive = await parseCadrM10OverlayExport(archiveBytes);
assert.equal(archive.entryCount, 1n);
assert.deepEqual(archive.rootSha256, committed.rootSha256);
const mutated = archiveBytes.slice(); mutated[mutated.length - 2] ^= 1;
await assert.rejects(() => parseCadrM10OverlayExport(mutated),
  /canonical|digest|JSON/);

const discarded = await controller.discard();
assert.equal(discarded.changed, true);
assert.deepEqual(await controller.readBlock(1n), await basePage(1n));
const imported = await controller.importOverlay(archiveBytes);
assert.equal(imported.changed, true);
assert.deepEqual(await controller.readBlock(1n), changed);
assert.equal((await controller.compact()).retained.manifests, 1);

{
  const readDescriptor = new Uint8Array(16);
  const readView = new DataView(readDescriptor.buffer);
  readView.setBigUint64(0, 1n, true);
  readView.setUint32(8, 1, true);
  readView.setUint32(12, 1024, true);
  const writeDescriptor = new Uint8Array(24);
  const writeView = new DataView(writeDescriptor.buffer);
  writeView.setBigUint64(0, 82n, true);
  writeView.setBigUint64(8, 3n, true);
  writeView.setUint32(16, 1, true);
  writeView.setUint32(20, 1024, true);
  const requests = [{
    status: 0, request: {
      operation: 1, generation: 1n, requestId: 81n,
      completionByteCount: 1024n,
    }, descriptor: readDescriptor.buffer,
    requestPayload: new ArrayBuffer(0),
  }, {
    status: 0, request: {
      operation: 2, generation: 1n, requestId: 82n,
      completionByteCount: 0n,
    }, descriptor: writeDescriptor.buffer,
    requestPayload: changed.slice().buffer,
  }];
  const completions = [];
  const bridge = createCadrM10WorkerDiskBridge({
    controller,
    channel: {
      async submit(operation) {
        if (operation.op === "host-next-request") return requests.shift();
        completions.push(operation);
        return { status: 0 };
      },
    },
  });
  assert.equal((await bridge.serviceOnce()).operation, "read");
  assert.deepEqual(new Uint8Array(completions[0].bytes), changed);
  assert.equal((await bridge.serviceOnce()).operation, "write");
  assert.equal(completions[1].requestId, 82n);
  assert.deepEqual(await controller.readBlock(3n), changed);
}

const cloneBackend = await fakeBackend();
const cloneBinding = { ...binding,
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 41) };
await assert.rejects(() => controller.cloneTo({
  backend: cloneBackend, binding: cloneBinding,
}), /replacement callback is required/);
const clone = await controller.cloneTo({
  backend: cloneBackend, binding: cloneBinding,
  replaceWorker: async () => {},
});
assert.deepEqual(await clone.readBlock(1n), changed);
clone.close();

const failedCloneBackend = await fakeBackend({ failStage: true });
await assert.rejects(() => controller.cloneTo({
  backend: failedCloneBackend,
  binding: { ...cloneBinding,
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 61) },
  replaceWorker: async () => {},
}), /staging failure/);
assert.equal(failedCloneBackend.inspect().deleted, true,
  "failed clone must delete its partially initialized destination");

let discardedWorker = 0;
const stagingBackend = await fakeBackend({ failStage: true });
const stagingFailure = createCadrM10Controller({
  backend: stagingBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { discardedWorker += 1; },
});
await stagingFailure.open({ initialize: true });
await assert.rejects(() => stagingFailure.commitWrites([
  { lba: 2n, bytes: changed },
], { completeGuest: async () => {
  throw new Error("guest must not advance after failed staging");
} }), /staging failure/);
assert.equal(stagingFailure.state, "CLEAN");
assert.equal(discardedWorker, 0,
  "pre-guest staging failure reopens durable state without discarding worker");

const failingBackend = await fakeBackend({ failCommit: true });
const uncertain = createCadrM10Controller({
  backend: failingBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { discardedWorker += 1; },
});
await uncertain.open({ initialize: true });
await assert.rejects(() => uncertain.commitWrites([
  { lba: 2n, bytes: changed },
], { completeGuest: async () => {} }), /publication failure/);
assert.equal(uncertain.state, CADR_M10_CONTROLLER_IN_DOUBT);
assert.equal(discardedWorker, 1);
await uncertain.recover();

let responseLossReplacements = 0;
const responseLossBackend = await fakeBackend();
const responseLoss = createCadrM10Controller({
  backend: responseLossBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { responseLossReplacements += 1; },
});
await responseLoss.open({ initialize: true });
await assert.rejects(() => responseLoss.commitWrites([
  { lba: 4n, bytes: changed },
], { completeGuest: async () => {
  throw new Error("synthetic lost host-complete response");
} }), /lost host-complete/);
assert.equal(responseLoss.state, CADR_M10_CONTROLLER_IN_DOUBT);
assert.equal(responseLossReplacements, 1,
  "ambiguous host-complete response loss must replace the worker");
await responseLoss.recover();

/* The review capability is object-identity branded.  Its public surface is
 * deliberately data-only binding plus release; neither the controller disk
 * nor a durable root-reference identifier can be reached from it. */
{
  const reviewBackend = await fakeBackend();
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await reviewController.open({ initialize: true });
  const authority = reviewController.claimSnapshotReviewAuthority();
  assert.deepEqual(Object.keys(authority), ["acquire", "revoke"]);
  assert.deepEqual(Object.getOwnPropertyNames(authority), ["acquire", "revoke"]);
  assert.equal(Object.isFrozen(authority), true);
  assert.throws(() => reviewController.claimSnapshotReviewAuthority(), /already been claimed/);
  assert.throws(() => ({ ...authority }).acquire(), /not recognized/);
  assert.throws(() => new Proxy(authority, {}).acquire(), /not recognized/);
  assert.throws(() => authority.acquire.call({}), /not recognized/);

  const lease = await authority.acquire();
  assert.equal(Object.isFrozen(lease), true);
  assert.deepEqual(Object.keys(lease), ["binding", "release"]);
  assert.equal(Object.isFrozen(lease.binding), true);
  assert.deepEqual(Object.keys(lease.binding), [
    "generation", "headSeq", "manifestSha256", "rootSha256",
  ]);
  assert.equal(lease.binding.generation, "0");
  assert.equal(lease.binding.headSeq, "1");
  assert.match(lease.binding.manifestSha256, /^[0-9a-f]{64}$/);
  assert.match(lease.binding.rootSha256, /^[0-9a-f]{64}$/);
  assert.throws(() => { lease.binding.rootSha256 = "forged"; }, TypeError);
  assert.throws(() => authority.revoke("held"), /cannot be revoked/);
  await assert.rejects(() => reviewController.commitWrites([
    { lba: 9n, bytes: changed },
  ]), /snapshot review lease is active/);
  await assert.rejects(() => reviewController.exportOverlay(), /snapshot review lease is active/);
  await assert.rejects(() => reviewController.compact(), /snapshot review lease is active/);
  await assert.rejects(() => reviewController.recover(), /snapshot review lease is active/);
  await assert.rejects(() => reviewController.open(), /snapshot review lease is active/);
  assert.throws(() => reviewController.close(), /snapshot review lease is active/);
  const receipt = await lease.release();
  assert.deepEqual(receipt, { binding: lease.binding, released: true, alreadyReleased: false });
  assert.deepEqual(await lease.release(), {
    binding: lease.binding, released: true, alreadyReleased: true,
  });
  assert.equal(reviewBackend.inspect().pins.size, 0);
  const revoked = authority.revoke("review complete");
  assert.deepEqual(revoked, { revoked: true, reason: "review complete" });
  assert.throws(() => authority.acquire(), /not recognized/);
  reviewController.close();
}

/* An ambiguity is an emergency fence, not an ordinary operation.  The three
 * host-complete variants below retain a live opaque review lease, prove that
 * the bridge does not emit a second failure completion, and then prove that
 * the sole branded release reopens before removing the durable root pin. */
async function assertActiveReviewLeaseCompletionLoss({ label, request,
  postGuestWrite = false }) {
  const reviewBackend = await fakeBackend();
  let replacements = 0; let completions = 0; let injectedWrites = 0;
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => { replacements += 1; },
  });
  await reviewController.open({ initialize: true });
  const authority = reviewController.claimSnapshotReviewAuthority();
  const lease = await authority.acquire();
  const heldSession = reviewBackend.inspect().session;
  const bridgeController = postGuestWrite ? Object.freeze({
    get state() { return reviewController.state; },
    readBlock: target => reviewController.readBlock(target),
    invalidateAfterAmbiguousGuest: () =>
      reviewController.invalidateAfterAmbiguousGuest(),
    /* A real controller rejects a new write before it reaches this callback
     * while a review lease is live (covered above).  This deliberately narrow
     * injection represents a completion already accepted by the guest before
     * an independently discovered lease must be preserved. */
    async commitWrites(_writes, { completeGuest }) {
      injectedWrites += 1;
      await completeGuest();
    },
  }) : reviewController;
  const bridge = createCadrM10WorkerDiskBridge({
    controller: bridgeController,
    channel: {
      async submit(operation) {
        if (operation.op === "host-next-request") return request();
        assert.equal(operation.op, "host-complete");
        completions += 1;
        throw new Error(`${label}: lost host-complete response`);
      },
    },
  });
  await assert.rejects(() => bridge.serviceOnce(), /lost host-complete response/);
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT,
    `${label}: ambiguity did not outrank its review lease`);
  assert.equal(replacements, 1, `${label}: ambiguity replaced the worker more than once`);
  assert.equal(completions, 1, `${label}: bridge emitted a second completion after loss`);
  assert.equal(injectedWrites, postGuestWrite ? 1 : 0,
    `${label}: write completion injection did not take its exact path`);
  assert.equal(reviewBackend.inspect().pins.size, 1,
    `${label}: ambiguity released the opaque review root without its lease`);
  const receipt = await lease.release();
  assert.equal(receipt.alreadyReleased, false);
  assert.equal(reviewController.state, "CLEAN",
    `${label}: release did not reopen a clean durable session`);
  assert.ok(reviewBackend.inspect().session > heldSession,
    `${label}: release did not reopen after closing the ambiguous session`);
  assert.equal(reviewBackend.inspect().pins.size, 0,
    `${label}: explicit release did not remove its retained root pin`);
  await lease.release();
  assert.equal(reviewBackend.inspect().unpinAttempts, 1,
    `${label}: idempotent release repeated the unpin`);
  authority.revoke(`${label} complete`);
  reviewController.close();
}

await assertActiveReviewLeaseCompletionLoss({
  label: "read completion", request: () => {
    const descriptor = new Uint8Array(16);
    const view = new DataView(descriptor.buffer);
    view.setBigUint64(0, 1n, true); view.setUint32(8, 1, true);
    view.setUint32(12, 1024, true);
    return { status: 0, request: {
      operation: 1, generation: 1n, requestId: 501n,
      completionByteCount: 1024n,
    }, descriptor: descriptor.buffer, requestPayload: new ArrayBuffer(0) };
  },
});

await assertActiveReviewLeaseCompletionLoss({
  label: "unsupported completion", request: () => ({
    status: 0, request: {
      operation: 99, generation: 1n, requestId: 502n,
      completionByteCount: 0n,
    }, descriptor: new ArrayBuffer(0), requestPayload: new ArrayBuffer(0),
  }),
});

await assertActiveReviewLeaseCompletionLoss({
  label: "write completion", postGuestWrite: true, request: () => {
    const descriptor = new Uint8Array(24);
    const view = new DataView(descriptor.buffer);
    view.setBigUint64(0, 503n, true); view.setBigUint64(8, 7n, true);
    view.setUint32(16, 1, true); view.setUint32(20, 1024, true);
    return { status: 0, request: {
      operation: 2, generation: 1n, requestId: 503n,
      completionByteCount: 0n,
    }, descriptor: descriptor.buffer, requestPayload: changed.slice().buffer };
  },
});

{
  let releaseUnpin;
  const reviewBackend = await fakeBackend({
    unpinGate: async () => new Promise(resolve => { releaseUnpin = resolve; }),
  });
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await reviewController.open({ initialize: true });
  const lease = await reviewController.claimSnapshotReviewAuthority().acquire();
  const first = lease.release();
  const second = lease.release();
  assert.strictEqual(first, second, "concurrent release calls share one unpin flight");
  while (releaseUnpin === undefined) await new Promise(resolve => setTimeout(resolve, 0));
  releaseUnpin();
  await first;
  assert.equal(reviewBackend.inspect().unpinAttempts, 1);
  reviewController.close();
}

/* Invalidation must not inherit an unbounded release.  First interleave while
 * release is paused at its initial microtask; then leave an old-session unpin
 * permanently pending and prove the independently branded retry can reopen
 * and finish after the worker has been replaced. */
{
  const reviewBackend = await fakeBackend();
  let replacements = 0;
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => { replacements += 1; },
  });
  await reviewController.open({ initialize: true });
  const lease = await reviewController.claimSnapshotReviewAuthority().acquire();
  const staleRelease = lease.release();
  await reviewController.invalidateAfterAmbiguousGuest();
  await assert.rejects(staleRelease, /release was interrupted by ambiguous guest completion/);
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT);
  assert.equal(replacements, 1);
  assert.equal(reviewBackend.inspect().pins.size, 1);
  await lease.release();
  assert.equal(reviewBackend.inspect().pins.size, 0);
  reviewController.close();
}

{
  let firstUnpin = true;
  const reviewBackend = await fakeBackend({
    unpinGate: async () => {
      if (firstUnpin) {
        firstUnpin = false;
        await new Promise(() => {});
      }
    },
  });
  let replacements = 0;
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => { replacements += 1; },
  });
  await reviewController.open({ initialize: true });
  const lease = await reviewController.claimSnapshotReviewAuthority().acquire();
  void lease.release();
  while (reviewBackend.inspect().unpinAttempts !== 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  let timeout;
  try {
    await Promise.race([
      reviewController.invalidateAfterAmbiguousGuest(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(
          "ambiguous invalidation waited for a never-settling release")), 200);
      }),
    ]);
  } finally { clearTimeout(timeout); }
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT);
  assert.equal(replacements, 1,
    "never-settling old unpin blocked or duplicated worker replacement");
  assert.equal(reviewBackend.inspect().pins.size, 1,
    "never-settling old unpin lost the opaque review pin");
  await lease.release();
  assert.equal(reviewBackend.inspect().unpinAttempts, 2,
    "fresh-session retry did not bypass the stale unpin flight");
  assert.equal(reviewBackend.inspect().pins.size, 0);
  reviewController.close();
}

/* A completed replacement remains a requirement of the opaque lease, not a
 * controller-global convenience.  Pause the retry after it has captured that
 * first replacement but before its reopen returns; a second ambiguous guest
 * completion must supersede the release attempt and start exactly one second
 * replacement.  The stale reopened handle is closed, no root reference is
 * removed before the second replacement, and only a new release attempt may
 * reopen, unpin, and return the controller to CLEAN. */
{
  const rawBackend = await fakeBackend();
  let reopenCalls = 0; let releaseFirstReopen;
  const firstReopenEntered = new Promise(resolve => { releaseFirstReopen = resolve; });
  let releaseSecondReplacement;
  const secondReplacementEntered = new Promise(resolve => {
    releaseSecondReplacement = resolve;
  });
  let allowFirstReopen; let allowSecondReplacement;
  const firstReopenGate = new Promise(resolve => { allowFirstReopen = resolve; });
  const secondReplacementGate = new Promise(resolve => {
    allowSecondReplacement = resolve;
  });
  const closedHandles = [];
  const handles = new Map();
  const wrap = (disk, label) => {
    let closed = false;
    const handle = Object.freeze({
      get sessionId() { return disk.sessionId; },
      get readOnly() { return disk.readOnly; },
      close() {
        if (!closed) { closed = true; closedHandles.push(label); }
        return disk.close();
      },
      async active() { return disk.active(); },
      async exportActiveClosure() { return disk.exportActiveClosure(); },
      async pinRoot(...args) { return disk.pinRoot(...args); },
      async unpinRoot(...args) { return disk.unpinRoot(...args); },
    });
    handles.set(label, handle);
    return handle;
  };
  const reviewBackend = Object.freeze({
    initializeDisk: async current => wrap(await rawBackend.initializeDisk(current), "initial"),
    reopenDisk: async current => {
      const call = ++reopenCalls;
      if (call === 1) {
        releaseFirstReopen();
        await firstReopenGate;
      }
      return wrap(await rawBackend.reopenDisk(current), `reopen-${call}`);
    },
  });
  let replacements = 0;
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {
      replacements += 1;
      if (replacements === 2) {
        releaseSecondReplacement();
        await secondReplacementGate;
      }
    },
  });
  await reviewController.open({ initialize: true });
  const lease = await reviewController.claimSnapshotReviewAuthority().acquire();
  await reviewController.invalidateAfterAmbiguousGuest();
  assert.equal(replacements, 1, "initial ambiguity did not replace the worker once");

  const staleRetry = lease.release();
  await firstReopenEntered;
  const overtake = reviewController.invalidateAfterAmbiguousGuest();
  await secondReplacementEntered;
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT,
    "overtaking ambiguity escaped the recovery fence");
  assert.equal(replacements, 2,
    "the overtaking ambiguity did not start exactly one additional replacement");
  assert.equal(rawBackend.inspect().unpinAttempts, 0,
    "a release unpinned before the replacement completed");
  assert.equal(rawBackend.inspect().pins.size, 1,
    "an overtaking ambiguity released the opaque root pin");

  allowFirstReopen();
  await assert.rejects(staleRetry, /release was interrupted by ambiguous guest completion/);
  assert.deepEqual(closedHandles.filter(label => label === "reopen-1"), ["reopen-1"],
    "the stale reopened session was retained after its release attempt was superseded");
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT,
    "a stale reopen changed the controller to CLEAN");
  assert.equal(rawBackend.inspect().unpinAttempts, 0,
    "the stale retry unpinned after it was superseded");

  const finalRetry = lease.release();
  await Promise.resolve();
  assert.equal(reopenCalls, 1,
    "the final retry reopened before its exact replacement flight completed");
  assert.equal(rawBackend.inspect().unpinAttempts, 0,
    "the final retry unpinned before its exact replacement flight completed");
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT,
    "the final retry cleared IN_DOUBT before durable unpin");
  allowSecondReplacement();
  await overtake;
  await finalRetry;
  assert.equal(reopenCalls, 2,
    "the fresh release did not reopen after the replacement completed");
  assert.equal(rawBackend.inspect().unpinAttempts, 1,
    "the fresh release did not perform exactly one durable unpin");
  assert.equal(rawBackend.inspect().pins.size, 0,
    "the fresh release left the opaque root pin behind");
  assert.equal(reviewController.state, "CLEAN",
    "the controller did not become CLEAN after the fresh unpin boundary");
  assert.equal(handles.get("reopen-2") !== undefined, true,
    "the successful retry did not retain its fresh session");
  await reviewController.invalidateAfterAmbiguousGuest();
  assert.equal(replacements, 3,
    "a later clean-state ambiguity joined an obsolete completed replacement");
  await reviewController.recover();
  assert.equal(reviewController.state, "CLEAN",
    "recovery after the later ambiguity did not restore CLEAN");
  reviewController.close();
}

/* A failed replacement is not evidence that the old worker became safe.  Its
 * rejected exact flight keeps the pin and IN_DOUBT fence intact; a later
 * replacement notification may establish a new flight, after which the
 * branded release uses only that new session. */
{
  const reviewBackend = await fakeBackend();
  let failReplacement = true; let replacements = 0;
  const reviewController = createCadrM10Controller({
    backend: reviewBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {
      replacements += 1;
      if (failReplacement) throw new Error("synthetic replacement failure");
    },
  });
  await reviewController.open({ initialize: true });
  const lease = await reviewController.claimSnapshotReviewAuthority().acquire();
  await assert.rejects(() => reviewController.invalidateAfterAmbiguousGuest(),
    /synthetic replacement failure/);
  assert.equal(reviewController.state, CADR_M10_CONTROLLER_IN_DOUBT);
  await assert.rejects(() => lease.release(), /synthetic replacement failure/);
  assert.equal(reviewBackend.inspect().unpinAttempts, 0,
    "a failed replacement permitted an opaque root unpin");
  assert.equal(reviewBackend.inspect().pins.size, 1,
    "a failed replacement dropped the opaque root pin");
  failReplacement = false;
  await reviewController.invalidateAfterAmbiguousGuest();
  assert.equal(replacements, 2,
    "replacement failure did not require exactly one later replacement retry");
  await lease.release();
  assert.equal(reviewBackend.inspect().unpinAttempts, 1,
    "the post-failure fresh replacement did not permit one opaque unpin");
  assert.equal(reviewController.state, "CLEAN",
    "a recovered replacement did not restore CLEAN after unpin");
  reviewController.close();
}

{
  const retryBackend = await fakeBackend({ failFirstUnpin: true });
  const retryController = createCadrM10Controller({
    backend: retryBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await retryController.open({ initialize: true });
  const lease = await retryController.claimSnapshotReviewAuthority().acquire();
  await assert.rejects(() => lease.release(), /synthetic review unpin failure/);
  await assert.rejects(() => retryController.compact(), /snapshot review lease is active/);
  const retry = await lease.release();
  assert.equal(retry.alreadyReleased, false,
    "a failed release needs an explicit retry rather than an automatic unpin");
  assert.equal(retryBackend.inspect().unpinAttempts, 2);
  retryController.close();
}

/* A strict durable transaction can commit even when the adapter loses its
 * completion response.  The controller's explicit lease retry must then use
 * the same issued idempotence key without stranding its mutation fence. */
{
  const retryBackend = await fakeBackend({ postCommitFirstUnpinFailure: true });
  const retryController = createCadrM10Controller({
    backend: retryBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await retryController.open({ initialize: true });
  const lease = await retryController.claimSnapshotReviewAuthority().acquire();
  await assert.rejects(() => lease.release(), /response lost after commit/);
  await assert.rejects(() => retryController.compact(), /snapshot review lease is active/);
  const retry = await lease.release();
  assert.equal(retry.alreadyReleased, false);
  assert.equal(retryBackend.inspect().unpinAttempts, 2,
    "post-commit report loss did not perform exactly one explicit retry");
  assert.equal(retryBackend.inspect().pins.size, 0,
    "post-commit report loss stranded a fake durable review pin");
  retryController.close();
}

/* If continuity fails after pin publication and the first compensating unpin
 * also fails, no lease was returned.  The same branded authority is the sole
 * recovery capability: its next acquire finishes cleanup before issuing a
 * fresh lease, with no public disk handle or root-reference id. */
{
  let breakContinuity = true; let recoveryBackend;
  recoveryBackend = await fakeBackend({
    failFirstUnpin: true,
    pinGate: async () => {
      if (!breakContinuity) return;
      breakContinuity = false;
      await recoveryBackend.reopenDisk(binding);
    },
  });
  const recoveryController = createCadrM10Controller({
    backend: recoveryBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await recoveryController.open({ initialize: true });
  const authority = recoveryController.claimSnapshotReviewAuthority();
  await assert.rejects(() => authority.acquire(),
    /acquisition failed and pin rollback failed/);
  await assert.rejects(() => recoveryController.compact(), /snapshot review lease is active/);
  const lease = await authority.acquire();
  assert.equal(recoveryBackend.inspect().unpinAttempts, 2,
    "authority recovery did not retry the opaque failed acquisition pin");
  await lease.release();
  assert.equal(recoveryBackend.inspect().pins.size, 0,
    "authority recovery left an unobservable review root pin");
  recoveryController.close();
}

{
  const leftBackend = await fakeBackend();
  const rightBackend = await fakeBackend();
  const left = createCadrM10Controller({
    backend: leftBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  const right = createCadrM10Controller({
    backend: rightBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await left.open({ initialize: true }); await right.open({ initialize: true });
  const authority = left.claimSnapshotReviewAuthority();
  assert.throws(() => authority.acquire.call(right), /not recognized/);
  const lease = await authority.acquire();
  assert.throws(() => lease.release.call(right), /not recognized/);
  await lease.release();
  left.close(); right.close();
}

{
  const reopenBackend = await fakeBackend();
  const reopenController = createCadrM10Controller({
    backend: reopenBackend, binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {},
  });
  await reopenController.open({ initialize: true });
  const authority = reopenController.claimSnapshotReviewAuthority();
  reopenController.close();
  await reopenController.open();
  const lease = await authority.acquire();
  await lease.release();
  reopenController.close();
}

{
  let worker = new Worker(workerFixture, {
    type: "module", workerData: { loseCompletionResponse: true },
  });
  let sequence = 0;
  const pending = new Map();
  const bind = current => {
    current.on("message", message => {
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id); waiter.resolve(message.result);
      }
    });
    current.on("exit", code => {
      for (const waiter of pending.values()) {
        waiter.reject(new Error(`real worker exited before response (${code})`));
      }
      pending.clear();
    });
  };
  bind(worker);
  const channel = {
    submit(operation) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, operation });
      });
    },
  };
  const firstThread = (await channel.submit({ op: "ping" })).threadId;
  let replacements = 0;
  const realWorkerController = createCadrM10Controller({
    backend: await fakeBackend(), binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {
      await worker.terminate();
      worker = new Worker(workerFixture, {
        type: "module", workerData: { loseCompletionResponse: false },
      });
      bind(worker); replacements += 1;
    },
  });
  await realWorkerController.open({ initialize: true });
  const realBridge = createCadrM10WorkerDiskBridge({
    controller: realWorkerController, channel,
  });
  await assert.rejects(() => realBridge.serviceOnce(),
    /real worker exited before response/);
  assert.equal(realWorkerController.state, CADR_M10_CONTROLLER_IN_DOUBT);
  assert.equal(replacements, 1);
  const replacementThread = (await channel.submit({ op: "ping" })).threadId;
  assert.notEqual(replacementThread, firstThread,
    "ambiguous completion must use a replacement worker process");
  await realWorkerController.recover();
  realWorkerController.close();
  await worker.terminate();
}

let releaseCompact;
const compactGate = new Promise(resolve => { releaseCompact = resolve; });
const raceBackend = await fakeBackend({
  compactGate: async () => compactGate,
});
const raceController = createCadrM10Controller({
  backend: raceBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
});
await raceController.open({ initialize: true });
const compaction = raceController.compact();
await Promise.resolve();
await assert.rejects(() => raceController.commitWrites([
  { lba: 5n, bytes: changed },
]), /another persistence operation/);
await assert.rejects(() => raceController.recover(),
  /another persistence operation/);
assert.throws(() => raceController.close(),
  /another persistence operation/);
releaseCompact();
await compaction;

let releaseGuest;
const guestGate = new Promise(resolve => { releaseGuest = resolve; });
const racingCommit = raceController.commitWrites([
  { lba: 6n, bytes: changed },
], { completeGuest: async () => guestGate });
while (raceBackend.inspect().stageOrdinal === 0) {
  await new Promise(resolve => setTimeout(resolve, 0));
}
await assert.rejects(() => raceController.compact(),
  /another persistence operation/);
await assert.rejects(() => raceController.recover(),
  /another persistence operation/);
assert.throws(() => raceController.close(),
  /another persistence operation/);
releaseGuest();
await racingCommit;

let releaseRecovery;
const recoveryGate = new Promise(resolve => { releaseRecovery = resolve; });
const recoveringBackend = await fakeBackend({
  reopenGate: async () => recoveryGate,
});
const recoveringController = createCadrM10Controller({
  backend: recoveringBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
});
await recoveringController.open({ initialize: true });
const recovery = recoveringController.recover();
await Promise.resolve();
await assert.rejects(() => recoveringController.commitWrites([
  { lba: 8n, bytes: changed },
]), /another persistence operation/);
assert.throws(() => recoveringController.close(),
  /another persistence operation/);
releaseRecovery();
await recovery;

controller.close(); stagingFailure.close(); uncertain.close();
responseLoss.close(); raceController.close();
recoveringController.close();
await baseFile.close();
assert.ok(states.includes("CLEAN"));
console.log("cadr M10 durable controller tests passed");
