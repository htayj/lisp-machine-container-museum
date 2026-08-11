/* Real-browser evidence for the narrow M13 review adapter.  It creates a
 * disposable, synthetic-base M10 namespace in Chromium IndexedDB.  It is not
 * selected System 303 media, a CADR runtime, or an M13 export/restore claim. */
import { CadrM13M10ReviewAdapter } from "./cadr-m13-m10-review-adapter.mjs";
import { createCadrM10Controller } from "./cadr-m10-controller.mjs";
import { createCadrM10IndexedDbBackend, CADR_M10_INDEXEDDB_STORES } from "./cadr-m10-indexeddb.mjs";
import { CADR_M10_BASE_SHA256, hexBytes } from "../wasm/cadr-m10-persistence.mjs";

const status = document.querySelector("#cadr-m13-m10-review-adapter-status");
const TEXT = new TextEncoder();

function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return Object.freeze({ promise, resolve, reject });
}

function same(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

async function sha256(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function fixedBinding(serial) {
  return Object.freeze({
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => (serial + index * 17) & 255),
    baseSha256: CADR_M10_BASE_SHA256.slice(),
    profileSha256: new Uint8Array(await crypto.subtle.digest("SHA-256", TEXT.encode(`M13 review profile ${serial}`))),
    artifactSetSha256: new Uint8Array(await crypto.subtle.digest("SHA-256", TEXT.encode(`M13 review artifacts ${serial}`))),
  });
}

function copiedBinding(binding) {
  return Object.freeze({ diskUuid: binding.diskUuid.slice(), baseSha256: binding.baseSha256.slice(),
    profileSha256: binding.profileSha256.slice(), artifactSetSha256: binding.artifactSetSha256.slice() });
}

function basePage(lba) {
  return Uint8Array.from({ length: 1024 }, (_, index) =>
    Number((lba * 29n + BigInt(index * 13 + 7)) & 255n));
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function inspectReferences(databaseName) {
  const request = indexedDB.open(databaseName);
  const db = await requestAsPromise(request);
  try {
    const transaction = db.transaction([CADR_M10_INDEXEDDB_STORES.refs, CADR_M10_INDEXEDDB_STORES.meta], "readonly");
    const refs = await requestAsPromise(transaction.objectStore(CADR_M10_INDEXEDDB_STORES.refs).getAll());
    const meta = await requestAsPromise(transaction.objectStore(CADR_M10_INDEXEDDB_STORES.meta).get("control"));
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return Object.freeze({ references: refs.length, meta });
  } finally { db.close(); }
}

async function deleteDisposableDisk(backend, binding) {
  let failure = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { await backend.deleteDisk(binding); return; }
    catch (error) {
      failure = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  throw failure;
}

function flakyFirstUnpinBackend(rawBackend, { postCommit = false } = {}) {
  let unpinAttempts = 0;
  const wrap = handle => Object.freeze({
    get sessionId() { return handle.sessionId; },
    get readOnly() { return handle.readOnly; },
    close() { return handle.close(); },
    async active() { return handle.active(); },
    async beginWriter() { return handle.beginWriter(); },
    async closeWriter(epoch) { return handle.closeWriter(epoch); },
    async exportActiveClosure() { return handle.exportActiveClosure(); },
    async pinRoot(kind, root) { return handle.pinRoot(kind, root); },
    async unpinRoot(identifier) {
      unpinAttempts += 1;
      if (unpinAttempts === 1) {
        if (postCommit) {
          await handle.unpinRoot(identifier);
          throw new Error("injected post-commit opaque unpin response loss");
        }
        throw new Error("injected pre-operation opaque unpin response loss");
      }
      return handle.unpinRoot(identifier);
    },
  });
  return Object.freeze({
    backend: Object.freeze({ profile: rawBackend.profile,
      initializeDisk: async binding => wrap(await rawBackend.initializeDisk(binding)),
      reopenDisk: async binding => wrap(await rawBackend.reopenDisk(binding)),
      deleteDisk: binding => rawBackend.deleteDisk(binding) }),
    attempts: () => unpinAttempts,
  });
}

/* Force the real M10 path that pins successfully, loses post-pin continuity,
 * and then loses rollback-unpin responses.  The wrapped handles retain the
 * actual IndexedDB objects; only the two hostile observations are injected. */
function postPinContinuityRollbackLossBackend(rawBackend, lostUnpins,
    { reuseRollbackSession = false, postCommitLoss = false } = {}) {
  let breakContinuity = true;
  let perturbNextActive = false;
  let pinAttempts = 0; let unpinAttempts = 0;
  let initialHandle = null;
  const wrap = handle => Object.freeze({
    get sessionId() { return handle.sessionId; },
    get readOnly() { return handle.readOnly; },
    close() { return handle.close(); },
    async active() {
      const active = await handle.active();
      if (!perturbNextActive) return active;
      perturbNextActive = false;
      return Object.freeze({ ...active, head: Object.freeze({ ...active.head,
        headSeq: BigInt(active.head.headSeq) + 1n }) });
    },
    async beginWriter() { return handle.beginWriter(); },
    async closeWriter(epoch) { return handle.closeWriter(epoch); },
    async exportActiveClosure() { return handle.exportActiveClosure(); },
    async pinRoot(kind, root) {
      const identifier = await handle.pinRoot(kind, root);
      pinAttempts += 1;
      if (breakContinuity) { breakContinuity = false; perturbNextActive = true; }
      return identifier;
    },
    async unpinRoot(identifier) {
      unpinAttempts += 1;
      if (unpinAttempts <= lostUnpins) {
        if (postCommitLoss) {
          await handle.unpinRoot(identifier);
          throw new Error(`injected post-commit rollback response loss ${unpinAttempts}`);
        }
        throw new Error(`injected post-pin rollback response loss ${unpinAttempts}`);
      }
      return handle.unpinRoot(identifier);
    },
  });
  return Object.freeze({
    backend: Object.freeze({ profile: rawBackend.profile,
      initializeDisk: async binding => {
        const handle = wrap(await rawBackend.initializeDisk(binding));
        initialHandle = handle;
        return handle;
      },
      reopenDisk: async binding => reuseRollbackSession && initialHandle !== null ?
        initialHandle : wrap(await rawBackend.reopenDisk(binding)),
      deleteDisk: binding => rawBackend.deleteDisk(binding) }),
    pinAttempts: () => pinAttempts, unpinAttempts: () => unpinAttempts,
  });
}

/* `openOverlayReview()` exports once before it asks M10 for a review lease.
 * Hold the first acquire-only closure read so a replacement can invalidate
 * M10 before any root is pinned. */
function gateAcquireBeforePinBackend(rawBackend) {
  let closureCalls = 0;
  const acquireClosureEntered = deferred();
  const releaseAcquireClosure = deferred();
  const wrap = handle => Object.freeze({
    get sessionId() { return handle.sessionId; },
    get readOnly() { return handle.readOnly; },
    close() { return handle.close(); },
    async active() { return handle.active(); },
    async beginWriter() { return handle.beginWriter(); },
    async closeWriter(epoch) { return handle.closeWriter(epoch); },
    async exportActiveClosure() {
      closureCalls += 1;
      if (closureCalls === 2) {
        acquireClosureEntered.resolve();
        await releaseAcquireClosure.promise;
      }
      return handle.exportActiveClosure();
    },
    async pinRoot(kind, root) { return handle.pinRoot(kind, root); },
    async unpinRoot(identifier) { return handle.unpinRoot(identifier); },
  });
  return Object.freeze({
    backend: Object.freeze({ profile: rawBackend.profile,
      initializeDisk: async binding => wrap(await rawBackend.initializeDisk(binding)),
      reopenDisk: async binding => wrap(await rawBackend.reopenDisk(binding)),
      deleteDisk: binding => rawBackend.deleteDisk(binding) }),
    acquireClosureEntered, releaseAcquireClosure,
    closureCalls: () => closureCalls,
  });
}

function countedAuthorityControllerFactory(counter) {
  return options => {
    const controller = createCadrM10Controller(options);
    return Object.freeze({
      open: values => controller.open.call(controller, values),
      close: () => {
        const receipt = controller.close.call(controller);
        counter.closes = (counter.closes ?? 0) + 1;
        return receipt;
      },
      status: () => controller.status.call(controller),
      exportOverlay: () => controller.exportOverlay.call(controller),
      invalidateAfterAmbiguousGuest: () => controller.invalidateAfterAmbiguousGuest.call(controller),
      claimSnapshotReviewAuthority: () => {
        const authority = controller.claimSnapshotReviewAuthority.call(controller);
        return Object.freeze({
          acquire: () => authority.acquire.call(authority),
          revoke: reason => {
            counter.revokeAttempts = (counter.revokeAttempts ?? 0) + 1;
            if (counter.failFirstRevoke === true && counter.revokeAttempts === 1) {
              throw new Error("injected synchronous authority revocation failure");
            }
            const receipt = authority.revoke.call(authority, reason);
            counter.revokes = (counter.revokes ?? 0) + 1;
            return receipt;
          },
        });
      },
    });
  };
}

async function run() {
  const prefix = `cadr-m13-review-adapter-${Date.now().toString(36)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const mutable = await fixedBinding(61);
  /* This object is deliberately mutable after construction.  The adapter must
   * never observe these mutations after it has copied the binding. */
  const supplied = {
    diskUuid: mutable.diskUuid.slice(), baseSha256: mutable.baseSha256.slice(),
    profileSha256: mutable.profileSha256.slice(), artifactSetSha256: mutable.artifactSetSha256.slice(),
  };
  const retained = copiedBinding(supplied);
  const baseGate = deferred();
  let replacements = 0;
  let holdChunkDigest = false;
  const chunkDigestEntered = deferred();
  const releaseChunkDigest = deferred();
  const digest = async bytes => {
    if (holdChunkDigest) {
      chunkDigestEntered.resolve();
      await releaseChunkDigest.promise;
    }
    return sha256(bytes);
  };
  const adapter = new CadrM13M10ReviewAdapter({ backend, binding: supplied,
    readBasePage: async lba => basePage(lba),
    readBaseIdentity: async () => { await baseGate.promise; return CADR_M10_BASE_SHA256.slice(); },
    replaceWorker: async () => { replacements += 1; }, digest });
  const databaseName = `${prefix}-${hexBytes(retained.diskUuid)}`;
  try {
    const opening = adapter.open({ initialize: true });
    /* The controller has entered readBaseIdentity() but may not yet select its
     * durable namespace.  Mutating every caller-owned field is the TOCTOU
     * adversary; only retained's copied values may be used. */
    supplied.diskUuid.fill(0xee); supplied.baseSha256.fill(0xdd);
    supplied.profileSha256.fill(0xcc); supplied.artifactSetSha256.fill(0xbb);
    baseGate.resolve();
    await opening;
    const openingInspection = await inspectReferences(databaseName);
    if (openingInspection.meta.diskKey !== hexBytes(retained.diskUuid) ||
        openingInspection.meta.baseSha256 !== hexBytes(retained.baseSha256) ||
        openingInspection.meta.profileSha256 !== hexBytes(retained.profileSha256) ||
        openingInspection.meta.artifactSetSha256 !== hexBytes(retained.artifactSetSha256)) {
      throw new Error("mutated caller binding reached the M10 IndexedDB namespace");
    }

    const review = await adapter.openOverlayReview();
    const pinned = await inspectReferences(databaseName);
    if (pinned.references !== 1 || review.byteCount < 1n || !/^[0-9a-f]{64}$/.test(review.sha256)) {
      throw new Error("review export did not create one opaque IndexedDB root pin");
    }
    holdChunkDigest = true;
    const pendingChunk = adapter.nextOverlayChunk({ maxBytes: 257 });
    await chunkDigestEntered.promise;
    const invalidated = adapter.invalidateAfterAmbiguousGuest("gated-digest-loss");
    await invalidated;
    const afterInvalidation = await inspectReferences(databaseName);
    if (afterInvalidation.references !== 0 || adapter.phase !== "INVALIDATED" ||
        adapter.status().cursorOffset !== 0n || replacements !== 1) {
      throw new Error("invalidation retained a pin, advanced a cursor, or skipped replacement");
    }
    releaseChunkDigest.resolve();
    let cursorRejected = false;
    try { await pendingChunk; } catch { cursorRejected = true; }
    if (!cursorRejected) throw new Error("digest continuation advanced an invalidated cursor");
    let reopenRejected = false;
    try { await adapter.open({ initialize: false }); } catch { reopenRejected = true; }
    if (!reopenRejected) throw new Error("invalidated adapter reopened instead of requiring a fresh adapter");

    /* A non-ambiguous unpin failure has a different recovery path: M10 has
     * retained the same opaque lease in RELEASE_REQUIRED.  The adapter retries
     * only that branded release, then resumes OPEN rather than treating it as
     * an invalidation/reopen boundary. */
    const unpinBinding = await fixedBinding(89);
    const unpinDatabaseName = `${prefix}-${hexBytes(unpinBinding.diskUuid)}`;
    const flaky = flakyFirstUnpinBackend(backend);
    const unpinRetry = new CadrM13M10ReviewAdapter({ backend: flaky.backend, binding: unpinBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("ordinary unpin retry should not replace a worker"); } });
    await unpinRetry.open({ initialize: true });
    await unpinRetry.openOverlayReview();
    let unpinRejected = false;
    try { await unpinRetry.closeOverlayReview(); } catch { unpinRejected = true; }
    const retainedAfterUnpinFailure = await inspectReferences(unpinDatabaseName);
    if (!unpinRejected || unpinRetry.phase !== "UNKNOWN" ||
        retainedAfterUnpinFailure.references !== 1 || flaky.attempts() !== 1) {
      throw new Error("ordinary opaque unpin failure did not retain exactly one retryable pin");
    }
    await unpinRetry.retryOpaqueRelease("unpin-retry");
    const releasedAfterUnpinRetry = await inspectReferences(unpinDatabaseName);
    if (unpinRetry.phase !== "OPEN" || releasedAfterUnpinRetry.references !== 0 ||
        flaky.attempts() !== 2) {
      throw new Error("ordinary opaque unpin retry did not release exactly one pin");
    }
    await unpinRetry.dispose("unpin-retry-cleanup");

    /* This distinct completion-loss seam commits the real IndexedDB unpin
     * before the reply disappears.  M10's exact issued reference is
     * idempotent, so the opaque release retry succeeds after the ref is gone. */
    const postCommitBinding = await fixedBinding(91);
    const postCommitDatabaseName = `${prefix}-${hexBytes(postCommitBinding.diskUuid)}`;
    const postCommit = flakyFirstUnpinBackend(backend, { postCommit: true });
    const postCommitRetry = new CadrM13M10ReviewAdapter({ backend: postCommit.backend,
      binding: postCommitBinding, readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("post-commit unpin retry must not replace a worker"); } });
    await postCommitRetry.open({ initialize: true });
    await postCommitRetry.openOverlayReview();
    let postCommitRejected = false;
    try { await postCommitRetry.closeOverlayReview(); } catch { postCommitRejected = true; }
    const releasedBeforePostCommitRetry = await inspectReferences(postCommitDatabaseName);
    if (!postCommitRejected || postCommitRetry.phase !== "UNKNOWN" ||
        releasedBeforePostCommitRetry.references !== 0 || postCommit.attempts() !== 1) {
      throw new Error("post-commit unpin response loss did not retain an idempotent opaque retry");
    }
    await postCommitRetry.retryOpaqueRelease("post-commit-unpin-retry");
    const releasedAfterPostCommitRetry = await inspectReferences(postCommitDatabaseName);
    if (postCommitRetry.phase !== "OPEN" || releasedAfterPostCommitRetry.references !== 0 ||
        postCommit.attempts() !== 2) {
      throw new Error("post-commit unpin retry did not prove idempotent release");
    }
    await postCommitRetry.dispose("post-commit-unpin-retry-cleanup");

    /* A post-pin continuity failure can also roll its unpin back successfully.
     * No lease crossed the failed acquire, but the authority is ACTIVE rather
     * than RECOVERY_REQUIRED.  The adapter must synchronously revoke/close to
     * FAILED instead of manufacturing an opaque recovery record. */
    const successfulRollbackBinding = await fixedBinding(97);
    const successfulRollbackDatabaseName = `${prefix}-${hexBytes(successfulRollbackBinding.diskUuid)}`;
    const successfulRollbackBackend = postPinContinuityRollbackLossBackend(backend, 0,
      { reuseRollbackSession: true });
    const successfulRollbackCounter = { revokes: 0, closes: 0 };
    const successfulRollback = new CadrM13M10ReviewAdapter({
      backend: successfulRollbackBackend.backend, binding: successfulRollbackBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("successful rollback must not replace a worker"); },
      controllerFactory: countedAuthorityControllerFactory(successfulRollbackCounter),
    });
    await successfulRollback.open({ initialize: true });
    let successfulRollbackRejected = false;
    try { await successfulRollback.openOverlayReview(); } catch { successfulRollbackRejected = true; }
    const absentAfterSuccessfulRollback = await inspectReferences(successfulRollbackDatabaseName);
    if (!successfulRollbackRejected || successfulRollback.phase !== "FAILED" ||
        successfulRollback.status().recoveryRequired ||
        absentAfterSuccessfulRollback.references !== 0 ||
        successfulRollbackCounter.revokes !== 1 || successfulRollbackCounter.closes !== 1 ||
        successfulRollbackBackend.unpinAttempts() !== 1) {
      throw new Error("successful post-pin rollback did not synchronously revoke and close");
    }

    /* A loss can arrive before `pinRoot`.  M10 rejects the pending acquire
     * after its replacement but returns the authority to ACTIVE, so the same
     * explicit revoke proves that no recovery record exists. */
    const beforePinBinding = await fixedBinding(99);
    const beforePinDatabaseName = `${prefix}-${hexBytes(beforePinBinding.diskUuid)}`;
    const beforePinBackend = gateAcquireBeforePinBackend(backend);
    let beforePinReplacementCount = 0;
    const beforePinCounter = { revokes: 0, closes: 0 };
    const beforePin = new CadrM13M10ReviewAdapter({ backend: beforePinBackend.backend,
      binding: beforePinBinding, readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { beforePinReplacementCount += 1; },
      controllerFactory: countedAuthorityControllerFactory(beforePinCounter) });
    await beforePin.open({ initialize: true });
    const pendingBeforePin = beforePin.openOverlayReview();
    await beforePinBackend.acquireClosureEntered.promise;
    const invalidatingBeforePin = beforePin.invalidateAfterAmbiguousGuest("invalidation-before-pin");
    beforePinBackend.releaseAcquireClosure.resolve();
    let beforePinRejected = false;
    try { await pendingBeforePin; } catch { beforePinRejected = true; }
    await invalidatingBeforePin;
    const absentAfterBeforePin = await inspectReferences(beforePinDatabaseName);
    if (!beforePinRejected || beforePin.phase !== "INVALIDATED" ||
        beforePin.status().recoveryRequired || absentAfterBeforePin.references !== 0 ||
        beforePinReplacementCount !== 1 || beforePinCounter.revokes !== 1 ||
        beforePinCounter.closes < 1 || beforePinBackend.closureCalls() !== 2) {
      throw new Error("invalidation-before-pin did not synchronously prove terminal cleanup");
    }

    /* `acquire()` can reject after it has already made an opaque M10 pin.  A
     * second injected lost rollback receipt makes the first adapter cleanup
     * retry fail too.  The only safe route is the retained authority's next
     * acquire, its returned lease's release, and one synchronous revoke. */
    const continuityBinding = await fixedBinding(101);
    const continuityDatabaseName = `${prefix}-${hexBytes(continuityBinding.diskUuid)}`;
    /* Reusing the current real IDB handle injects a pre-operation rollback
     * loss before session rollover can purge the transient review reference.
     * Thus this case proves a genuinely retained root and retryable authority. */
    const continuityBackend = postPinContinuityRollbackLossBackend(backend, 2,
      { reuseRollbackSession: true });
    const continuityCounter = { revokes: 0 };
    const continuity = new CadrM13M10ReviewAdapter({
      backend: continuityBackend.backend, binding: continuityBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("post-pin continuity recovery must not replace a worker"); },
      controllerFactory: countedAuthorityControllerFactory(continuityCounter),
    });
    await continuity.open({ initialize: true });
    let continuityRejected = false;
    try { await continuity.openOverlayReview(); } catch { continuityRejected = true; }
    const retainedAfterContinuity = await inspectReferences(continuityDatabaseName);
    let disposeRejected = false;
    try { await continuity.dispose("post-pin-continuity-dispose"); } catch { disposeRejected = true; }
    if (!continuityRejected || !disposeRejected || continuity.phase !== "RECOVERY_REQUIRED" ||
        retainedAfterContinuity.references !== 1 || continuityCounter.revokes !== 0 ||
        continuity.status().reviewOpen || !continuity.status().recoveryRequired) {
      throw new Error("post-pin acquire failure escaped its adapter-owned opaque recovery record");
    }
    let firstCleanupRejected = false;
    try { await continuity.retryAcquisitionCleanup("post-pin-continuity-first-retry"); }
    catch { firstCleanupRejected = true; }
    const retainedAfterCleanupFailure = await inspectReferences(continuityDatabaseName);
    if (!firstCleanupRejected || continuity.phase !== "UNKNOWN" ||
        continuity.status().unknownCause !== "acquisition-recovery-acquire" ||
        retainedAfterCleanupFailure.references !== 1 || continuityCounter.revokes !== 0 ||
        continuityBackend.unpinAttempts() !== 2) {
      throw new Error("failed opaque acquisition cleanup did not remain explicitly retryable");
    }
    const continuityRecovered = await continuity.retryAcquisitionCleanup("post-pin-continuity-final-retry");
    const releasedAfterContinuityRecovery = await inspectReferences(continuityDatabaseName);
    if (continuityRecovered.phase !== "FAILED" || continuity.phase !== "FAILED" ||
        releasedAfterContinuityRecovery.references !== 0 || continuityCounter.revokes !== 1 ||
        continuityBackend.unpinAttempts() !== 4 || continuity.status().recoveryRequired) {
      throw new Error("post-pin opaque recovery did not acquire, release, and revoke exactly once");
    }

    /* The real reopen path purges the old-session snapshot before reporting a
     * lost completion.  The authority is nevertheless RECOVERY_REQUIRED, and
     * its next acquire must tolerate the already-gone issued ID, make/release
     * exactly one temporary recovery pin, and revoke once. */
    const continuityPostCommitBinding = await fixedBinding(103);
    const continuityPostCommitDatabaseName = `${prefix}-${hexBytes(continuityPostCommitBinding.diskUuid)}`;
    const continuityPostCommitBackend = postPinContinuityRollbackLossBackend(backend, 1,
      { postCommitLoss: true });
    const continuityPostCommitCounter = { revokes: 0 };
    const continuityPostCommit = new CadrM13M10ReviewAdapter({
      backend: continuityPostCommitBackend.backend, binding: continuityPostCommitBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("post-commit recovery must not replace a worker"); },
      controllerFactory: countedAuthorityControllerFactory(continuityPostCommitCounter),
    });
    await continuityPostCommit.open({ initialize: true });
    let continuityPostCommitRejected = false;
    try { await continuityPostCommit.openOverlayReview(); } catch { continuityPostCommitRejected = true; }
    const absentAfterContinuityPostCommit = await inspectReferences(continuityPostCommitDatabaseName);
    if (!continuityPostCommitRejected || continuityPostCommit.phase !== "RECOVERY_REQUIRED" ||
        absentAfterContinuityPostCommit.references !== 0 ||
        continuityPostCommitCounter.revokes !== 0) {
      throw new Error("post-commit acquisition loss did not retain its idempotent authority recovery route");
    }
    await continuityPostCommit.retryAcquisitionCleanup("post-commit-acquisition-retry");
    const absentAfterContinuityPostCommitRetry = await inspectReferences(continuityPostCommitDatabaseName);
    if (continuityPostCommit.phase !== "FAILED" ||
        absentAfterContinuityPostCommitRetry.references !== 0 ||
        continuityPostCommitCounter.revokes !== 1 ||
        continuityPostCommitBackend.unpinAttempts() !== 3) {
      throw new Error("post-commit acquisition retry did not prove idempotent recovery and one revoke");
    }

    /* An ambiguity can also fail before any review lease exists.  Retain that
     * lease-free authority in UNKNOWN until a new replacement succeeds, then
     * synchronously revoke and close; it must not require a fabricated lease. */
    const leaseFreeBinding = await fixedBinding(107);
    const leaseFreeDatabaseName = `${prefix}-${hexBytes(leaseFreeBinding.diskUuid)}`;
    let leaseFreeReplacementFails = true;
    let leaseFreeReplacementCount = 0;
    const leaseFreeCounter = { revokes: 0, failFirstRevoke: true };
    const leaseFree = new CadrM13M10ReviewAdapter({ backend, binding: leaseFreeBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => {
        leaseFreeReplacementCount += 1;
        if (leaseFreeReplacementFails) throw new Error("lease-free replacement failure");
      }, controllerFactory: countedAuthorityControllerFactory(leaseFreeCounter) });
    await leaseFree.open({ initialize: true });
    let leaseFreeRejected = false;
    try { await leaseFree.invalidateAfterAmbiguousGuest("lease-free-replacement-failure"); }
    catch { leaseFreeRejected = true; }
    const retainedAfterLeaseFreeFailure = await inspectReferences(leaseFreeDatabaseName);
    if (!leaseFreeRejected || leaseFree.phase !== "UNKNOWN" ||
        leaseFree.status().unknownCause !== "replacement" ||
        retainedAfterLeaseFreeFailure.references !== 0 || leaseFreeCounter.revokes !== 0 ||
        leaseFreeReplacementCount !== 1) {
      throw new Error("lease-free replacement failure was not retained for explicit cleanup");
    }
    leaseFreeReplacementFails = false;
    let leaseFreeCleanupRejected = false;
    try { await leaseFree.retryInvalidatedCleanup("lease-free-replacement-first-retry"); }
    catch { leaseFreeCleanupRejected = true; }
    const retainedAfterLeaseFreeCleanupFailure = await inspectReferences(leaseFreeDatabaseName);
    if (!leaseFreeCleanupRejected || leaseFree.phase !== "UNKNOWN" ||
        leaseFree.status().unknownCause !== "replacement-revoke" ||
        retainedAfterLeaseFreeCleanupFailure.references !== 0 ||
        leaseFreeCounter.revokes !== 0 || leaseFreeCounter.revokeAttempts !== 1 ||
        leaseFreeReplacementCount !== 2) {
      throw new Error("lease-free replacement cleanup failure did not retain its exact retry route");
    }
    await leaseFree.retryInvalidatedCleanup("lease-free-replacement-final-retry");
    const releasedAfterLeaseFreeRetry = await inspectReferences(leaseFreeDatabaseName);
    if (leaseFree.phase !== "INVALIDATED" || releasedAfterLeaseFreeRetry.references !== 0 ||
        leaseFreeCounter.revokes !== 1 || leaseFreeCounter.revokeAttempts !== 2 ||
        leaseFreeReplacementCount !== 2) {
      throw new Error("lease-free replacement retry did not synchronously revoke and close");
    }

    /* A failed replacement leaves the real IndexedDB review root pinned and
     * blocks reopen.  The adapter may retry only after it asks M10 for a new
     * replacement; then the same opaque lease is released exactly once. */
    const failureBinding = await fixedBinding(113);
    const failureDatabaseName = `${prefix}-${hexBytes(failureBinding.diskUuid)}`;
    let failReplacement = true;
    let failedReplacementCount = 0;
    const failedReplacement = new CadrM13M10ReviewAdapter({ backend, binding: failureBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => {
        failedReplacementCount += 1;
        if (failReplacement) throw new Error("gated replacement failure");
      } });
    await failedReplacement.open({ initialize: true });
    await failedReplacement.openOverlayReview();
    let replacementRejected = false;
    try { await failedReplacement.invalidateAfterAmbiguousGuest("replacement-failure"); }
    catch { replacementRejected = true; }
    const retainedAfterFailure = await inspectReferences(failureDatabaseName);
    if (!replacementRejected || failedReplacement.phase !== "UNKNOWN" ||
        retainedAfterFailure.references !== 1 || failedReplacementCount !== 1) {
      throw new Error("failed replacement lost or released its opaque IndexedDB pin");
    }
    failReplacement = false;
    await failedReplacement.retryInvalidatedCleanup("replacement-retry");
    const releasedAfterRetry = await inspectReferences(failureDatabaseName);
    if (failedReplacement.phase !== "INVALIDATED" || releasedAfterRetry.references !== 0 ||
        failedReplacementCount !== 2) {
      throw new Error("fresh replacement did not release the retained opaque IndexedDB pin");
    }

    /* Two retry callers must join one exact replacement-cleanup flight.  Hold
     * the replacement until both have entered: there may be one replacement,
     * revoke, and close, and the same immutable result reaches both callers. */
    const concurrentBinding = await fixedBinding(127);
    const concurrentDatabaseName = `${prefix}-${hexBytes(concurrentBinding.diskUuid)}`;
    const concurrentReplacementEntered = deferred();
    const releaseConcurrentReplacement = deferred();
    let concurrentReplacementCount = 0;
    const concurrentCounter = { revokes: 0, closes: 0 };
    const concurrent = new CadrM13M10ReviewAdapter({ backend, binding: concurrentBinding,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => {
        concurrentReplacementCount += 1;
        if (concurrentReplacementCount === 1) throw new Error("initial concurrent replacement failure");
        if (concurrentReplacementCount === 2) {
          concurrentReplacementEntered.resolve();
          await releaseConcurrentReplacement.promise;
        }
      }, controllerFactory: countedAuthorityControllerFactory(concurrentCounter) });
    await concurrent.open({ initialize: true });
    await concurrent.openOverlayReview();
    let concurrentInitialRejected = false;
    try { await concurrent.invalidateAfterAmbiguousGuest("concurrent-initial-failure"); }
    catch { concurrentInitialRejected = true; }
    if (!concurrentInitialRejected || concurrent.phase !== "UNKNOWN" ||
        concurrentReplacementCount !== 1) {
      throw new Error("concurrent retry fixture did not retain its failed replacement");
    }
    const concurrentFirst = concurrent.retryInvalidatedCleanup("concurrent-first");
    await concurrentReplacementEntered.promise;
    const concurrentSecond = concurrent.retryInvalidatedCleanup("concurrent-second");
    const concurrentPromiseJoined = concurrentFirst === concurrentSecond;
    releaseConcurrentReplacement.resolve();
    const [concurrentFirstResult, concurrentSecondResult] = await Promise.all([
      concurrentFirst, concurrentSecond,
    ]);
    const releasedAfterConcurrent = await inspectReferences(concurrentDatabaseName);
    const concurrentResultJoined = concurrentFirstResult === concurrentSecondResult;
    if (!concurrentPromiseJoined || !concurrentResultJoined ||
        concurrent.phase !== "INVALIDATED" || releasedAfterConcurrent.references !== 0 ||
        concurrentReplacementCount !== 2 || concurrentCounter.revokes !== 1 ||
        concurrentCounter.closes !== 1) {
      throw new Error("concurrent replacement cleanup did not retain one exact terminal flight");
    }

    /* The same join rule applies to a rejected flight.  Both callers receive
     * one failure and the retained record permits exactly one later retry. */
    const concurrentFailureBinding = await fixedBinding(131);
    const concurrentFailureDatabaseName = `${prefix}-${hexBytes(concurrentFailureBinding.diskUuid)}`;
    const concurrentFailureEntered = deferred();
    const releaseConcurrentFailure = deferred();
    let concurrentFailureStage = "initial";
    let concurrentFailureReplacementCount = 0;
    const concurrentFailureCounter = { revokes: 0, closes: 0 };
    const concurrentFailure = new CadrM13M10ReviewAdapter({ backend,
      binding: concurrentFailureBinding, readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => {
        concurrentFailureReplacementCount += 1;
        if (concurrentFailureStage === "initial") throw new Error("initial concurrent failure");
        if (concurrentFailureStage === "joined-failure") {
          concurrentFailureEntered.resolve();
          await releaseConcurrentFailure.promise;
          throw new Error("joined concurrent replacement failure");
        }
      }, controllerFactory: countedAuthorityControllerFactory(concurrentFailureCounter) });
    await concurrentFailure.open({ initialize: true });
    await concurrentFailure.openOverlayReview();
    let concurrentFailureInitialRejected = false;
    try { await concurrentFailure.invalidateAfterAmbiguousGuest("concurrent-failure-initial"); }
    catch { concurrentFailureInitialRejected = true; }
    if (!concurrentFailureInitialRejected || concurrentFailure.phase !== "UNKNOWN" ||
        concurrentFailureReplacementCount !== 1) {
      throw new Error("concurrent failure fixture did not retain its failed replacement");
    }
    concurrentFailureStage = "joined-failure";
    const concurrentFailureFirst = concurrentFailure.retryInvalidatedCleanup("concurrent-failure-first");
    await concurrentFailureEntered.promise;
    const concurrentFailureSecond = concurrentFailure.retryInvalidatedCleanup("concurrent-failure-second");
    const concurrentFailurePromiseJoined = concurrentFailureFirst === concurrentFailureSecond;
    releaseConcurrentFailure.resolve();
    const concurrentFailureResults = await Promise.allSettled([
      concurrentFailureFirst, concurrentFailureSecond,
    ]);
    const retainedAfterConcurrentFailure = await inspectReferences(concurrentFailureDatabaseName);
    const concurrentFailureSameError = concurrentFailureResults[0].status === "rejected" &&
      concurrentFailureResults[1].status === "rejected" &&
      concurrentFailureResults[0].reason === concurrentFailureResults[1].reason;
    if (!concurrentFailurePromiseJoined || !concurrentFailureSameError ||
        concurrentFailure.phase !== "UNKNOWN" ||
        concurrentFailure.status().unknownCause !== "replacement-invalidate" ||
        retainedAfterConcurrentFailure.references !== 1 ||
        concurrentFailureReplacementCount !== 2 || concurrentFailureCounter.revokes !== 0 ||
        concurrentFailureCounter.closes !== 0) {
      throw new Error("concurrent replacement failure did not preserve one exact retry record");
    }
    concurrentFailureStage = "success";
    await concurrentFailure.retryInvalidatedCleanup("concurrent-failure-final-retry");
    const releasedAfterConcurrentFailureRetry = await inspectReferences(concurrentFailureDatabaseName);
    if (concurrentFailure.phase !== "INVALIDATED" ||
        releasedAfterConcurrentFailureRetry.references !== 0 ||
        concurrentFailureReplacementCount !== 3 || concurrentFailureCounter.revokes !== 1 ||
        concurrentFailureCounter.closes !== 1) {
      throw new Error("concurrent replacement failure did not permit exactly one later terminal retry");
    }

    const fresh = new CadrM13M10ReviewAdapter({ backend, binding: retained,
      readBasePage: async lba => basePage(lba),
      readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
      replaceWorker: async () => { throw new Error("fresh adapter should not replace a worker"); } });
    await fresh.open({ initialize: false });
    const freshOpen = fresh.status();
    await fresh.dispose("fresh-cleanup");
    return Object.freeze({ databaseName, openingBindingCopied: true,
      initialReferenceCount: pinned.references,
      invalidatedReferenceCount: afterInvalidation.references,
      cursorRejected, reopenRejected, replacementCount: replacements,
      invalidatedPhase: adapter.phase, freshControllerState: freshOpen.controller.state,
      freshDisposedPhase: fresh.phase, reviewArchiveBytes: review.byteCount.toString(),
      reviewArchiveSha256: review.sha256,
      replacementFailureRejected: replacementRejected,
      replacementFailureReferenceCount: retainedAfterFailure.references,
      replacementRetryReferenceCount: releasedAfterRetry.references,
      replacementRetryCount: failedReplacementCount,
      replacementRetryPhase: failedReplacement.phase,
      unpinFailureRejected: unpinRejected,
      unpinFailureReferenceCount: retainedAfterUnpinFailure.references,
      unpinRetryReferenceCount: releasedAfterUnpinRetry.references,
      unpinRetryCount: flaky.attempts(), unpinRetryPhase: unpinRetry.phase,
      postCommitUnpinRejected: postCommitRejected,
      postCommitUnpinReferenceCount: releasedBeforePostCommitRetry.references,
      postCommitUnpinRetryReferenceCount: releasedAfterPostCommitRetry.references,
      postCommitUnpinRetryCount: postCommit.attempts(),
      postCommitUnpinRetryPhase: postCommitRetry.phase,
      successfulRollbackRejected,
      successfulRollbackReferenceCount: absentAfterSuccessfulRollback.references,
      successfulRollbackUnpinAttempts: successfulRollbackBackend.unpinAttempts(),
      successfulRollbackRevokeCount: successfulRollbackCounter.revokes,
      successfulRollbackCloseCount: successfulRollbackCounter.closes,
      successfulRollbackPhase: successfulRollback.phase,
      beforePinRejected,
      beforePinReferenceCount: absentAfterBeforePin.references,
      beforePinReplacementCount, beforePinRevokeCount: beforePinCounter.revokes,
      beforePinCloseCount: beforePinCounter.closes,
      beforePinPhase: beforePin.phase,
      continuityRejected, continuityDisposeRejected: disposeRejected,
      continuityFailureReferenceCount: retainedAfterContinuity.references,
      continuityCleanupFailureReferenceCount: retainedAfterCleanupFailure.references,
      continuityRecoveredReferenceCount: releasedAfterContinuityRecovery.references,
      continuityCleanupUnpinAttempts: continuityBackend.unpinAttempts(),
      continuityRevokeCount: continuityCounter.revokes,
      continuityPhase: continuity.phase,
      continuityPostCommitRejected,
      continuityPostCommitReferenceCount: absentAfterContinuityPostCommit.references,
      continuityPostCommitRetryReferenceCount: absentAfterContinuityPostCommitRetry.references,
      continuityPostCommitUnpinAttempts: continuityPostCommitBackend.unpinAttempts(),
      continuityPostCommitRevokeCount: continuityPostCommitCounter.revokes,
      continuityPostCommitPhase: continuityPostCommit.phase,
      leaseFreeReplacementRejected: leaseFreeRejected,
      leaseFreeReplacementReferenceCount: retainedAfterLeaseFreeFailure.references,
      leaseFreeReplacementCleanupRejected: leaseFreeCleanupRejected,
      leaseFreeReplacementCleanupFailureReferenceCount: retainedAfterLeaseFreeCleanupFailure.references,
      leaseFreeReplacementRetryReferenceCount: releasedAfterLeaseFreeRetry.references,
      leaseFreeReplacementCount, leaseFreeRevokeCount: leaseFreeCounter.revokes,
      leaseFreeRevokeAttemptCount: leaseFreeCounter.revokeAttempts,
      leaseFreePhase: leaseFree.phase,
      concurrentPromiseJoined, concurrentResultJoined,
      concurrentReferenceCount: releasedAfterConcurrent.references,
      concurrentReplacementCount, concurrentRevokeCount: concurrentCounter.revokes,
      concurrentCloseCount: concurrentCounter.closes, concurrentPhase: concurrent.phase,
      concurrentFailurePromiseJoined, concurrentFailureSameError,
      concurrentFailureReferenceCount: retainedAfterConcurrentFailure.references,
      concurrentFailureRetryReferenceCount: releasedAfterConcurrentFailureRetry.references,
      concurrentFailureReplacementCount,
      concurrentFailureRevokeCount: concurrentFailureCounter.revokes,
      concurrentFailureCloseCount: concurrentFailureCounter.closes,
      concurrentFailurePhase: concurrentFailure.phase });
  } finally {
    await deleteDisposableDisk(backend, retained);
  }
}

try {
  globalThis.cadrM13M10ReviewAdapterHarness = await run();
  status.textContent = "M13 M10 review-adapter probe passed.";
} catch (error) {
  globalThis.cadrM13M10ReviewAdapterHarness = Object.freeze({ error: String(error?.stack ?? error) });
  status.textContent = "M13 M10 review-adapter probe failed.";
}
