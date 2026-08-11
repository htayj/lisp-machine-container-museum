/*
 * M13's narrow M10 review/export adapter.
 *
 * This module composes the current C-M10 controller's branded snapshot-review
 * authority with a byte cursor for its existing generic overlay archive.  It
 * deliberately does not define the M13 pinned-object export record, adopt a
 * restored archive, pause/reset a worker, or expose an M10 disk handle or
 * root-reference identifier.  Those are separate, still-open M13 work.
 *
 * The adapter exists to make three boundaries explicit at the M13 seam:
 *
 * - capture the binding synchronously, before the controller's first await;
 * - retain and release M10's opaque review lease across lifecycle loss; and
 * - hash an immutable cursor chunk before advancing its cursor.
 */
import {
  createCadrM10Controller,
  parseCadrM10OverlayExport,
} from "./cadr-m10-controller.mjs";
import { hexBytes } from "../wasm/cadr-m10-persistence.mjs";

export const CADR_M13_M10_REVIEW_ADAPTER_PROFILE =
  "CADR-WEB-303/M13-M10-REVIEW-ADAPTER-v1";

export const CADR_M13_M10_REVIEW_ADAPTER_STATES = Object.freeze([
  "NEW", "OPENING", "OPEN", "ACQUIRING", "REVIEWING",
  "RELEASING", "RECOVERY_REQUIRED", "INVALIDATED", "DISPOSING", "DISPOSED",
  "UNKNOWN", "FAILED",
]);

const MAX_CHUNK_BYTES = 1024 * 1024;

class CadrM13M10ReviewAdapterError extends Error {
  constructor(message) {
    super(`M13 M10 review adapter: ${message}`);
    this.name = "CadrM13M10ReviewAdapterError";
  }
}

function required(condition, message) {
  if (!condition) throw new CadrM13M10ReviewAdapterError(message);
}

function exactBytes(value, length, label) {
  let bytes = null;
  if (value instanceof Uint8Array) bytes = value;
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (ArrayBuffer.isView(value)) {
    bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  required(bytes !== null && bytes.byteLength === length,
    `${label} must be exactly ${length} bytes`);
  return bytes.slice();
}

/* Do not enumerate an attacker-owned prototype or invoke a getter after any
 * asynchronous step.  The retained object has private byte copies; it is
 * never returned to callers or handed back to the mutable source binding. */
function copiedBinding(value) {
  required(value !== null && typeof value === "object" &&
    !Array.isArray(value), "binding must be a plain record");
  const prototype = Object.getPrototypeOf(value);
  required(prototype === null || prototype === Object.prototype,
    "binding has an inherited prototype");
  const expected = ["diskUuid", "baseSha256", "profileSha256", "artifactSetSha256"];
  const keys = Reflect.ownKeys(value);
  required(keys.length === expected.length &&
    expected.every(key => keys.includes(key)), "binding fields differ");
  const fields = Object.create(null);
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    required(descriptor !== undefined && Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined && descriptor.set === undefined,
    `binding.${key} must be a data field`);
    fields[key] = descriptor.value;
  }
  return Object.freeze({
    diskUuid: exactBytes(fields.diskUuid, 16, "disk UUID"),
    baseSha256: exactBytes(fields.baseSha256, 32, "base SHA-256"),
    profileSha256: exactBytes(fields.profileSha256, 32, "profile SHA-256"),
    artifactSetSha256: exactBytes(fields.artifactSetSha256, 32,
      "artifact-set SHA-256"),
  });
}

function same(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  required(globalThis.crypto?.subtle !== undefined,
    "WebCrypto SHA-256 is unavailable");
  return hexBytes(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function controllerStatus(controller) {
  try {
    const status = controller.status();
    return Object.freeze({ state: status.state, open: status.open,
      readOnly: status.readOnly });
  } catch {
    return Object.freeze({ state: "UNAVAILABLE", open: false, readOnly: true });
  }
}

function terminal(state) {
  return ["RELEASING", "RECOVERY_REQUIRED", "INVALIDATED", "DISPOSING", "DISPOSED",
    "UNKNOWN", "FAILED"].includes(state);
}

/* This is intentionally a non-serializable host object.  In particular, its
 * opaque M10 lease remains private and its public status contains no root id,
 * database name, storage key, or raw binding bytes. */
export class CadrM13M10ReviewAdapter {
  #binding; #controller; #authority = null; #lease = null; #cursor = null;
  #phase = "NEW"; #epoch = 0; #openFlight = null; #acquireFlight = null;
  #invalidationFlight = null; #disposeFlight = null; #unknownCause = null;
  #recovery = null; #recoveryFlight = null; #replacementCleanup = null;
  #replacementCleanupFlight = null; #digest;

  constructor({ backend, binding, readBasePage, readBaseIdentity, replaceWorker,
    stateChanged = () => {}, digest = sha256Hex,
    controllerFactory = createCadrM10Controller } = {}) {
    required(typeof digest === "function", "digest must be a function");
    required(typeof controllerFactory === "function", "controller factory must be a function");
    this.#binding = copiedBinding(binding);
    /* The factory receives only the private snapshot.  All later controller
     * awaits consequently cannot observe mutation of the caller's binding. */
    this.#controller = controllerFactory({ backend, binding: this.#binding,
      readBasePage, readBaseIdentity, replaceWorker, stateChanged });
    required(this.#controller !== null && typeof this.#controller === "object" &&
      typeof this.#controller.open === "function" &&
      typeof this.#controller.close === "function" &&
      typeof this.#controller.status === "function" &&
      typeof this.#controller.exportOverlay === "function" &&
      typeof this.#controller.claimSnapshotReviewAuthority === "function" &&
      typeof this.#controller.invalidateAfterAmbiguousGuest === "function",
    "controller factory returned an incomplete M10 controller");
    this.#digest = digest;
  }

  get phase() { return this.#phase; }

  status() {
    return Object.freeze({ profile: CADR_M13_M10_REVIEW_ADAPTER_PROFILE,
      phase: this.#phase, terminal: terminal(this.#phase),
      reviewOpen: this.#lease !== null, cursorOffset: BigInt(this.#cursor?.offset ?? 0),
      controller: controllerStatus(this.#controller),
      unknownCause: this.#unknownCause, recoveryRequired: this.#recovery !== null });
  }

  #active(epoch, phase = null) {
    return this.#epoch === epoch && !terminal(this.#phase) &&
      (phase === null || this.#phase === phase);
  }

  #closeController() {
    try { this.#controller.close(); } catch { /* terminal cleanup is best effort */ }
  }

  #revokeAuthority(reason) {
    if (this.#authority === null || this.#lease !== null) return;
    try { this.#authority.revoke(reason); } catch { /* a terminal M10 state may retain it */ }
  }

  /* A post-pin acquire can reject without returning a lease: M10 retains the
   * opaque pin in its authority's RECOVERY_REQUIRED record.  Keep an explicit
   * adapter record rather than treating that rejection as an ordinary failed
   * review.  The only recovery route is the same authority's next acquire. */
  #requireAcquisitionRecovery() {
    required(this.#recovery !== null &&
      (this.#phase === "RECOVERY_REQUIRED" || this.#phase === "UNKNOWN"),
    "no acquisition recovery cleanup is available");
    return this.#recovery;
  }

  #enterAcquisitionRecovery(terminalPhase) {
    required(this.#lease === null, "acquisition recovery cannot replace a review lease");
    this.#cursor = null;
    this.#recovery = { step: "ACQUIRE", terminalPhase };
    this.#phase = "RECOVERY_REQUIRED";
    this.#unknownCause = "acquisition-recovery";
  }

  #revokeAuthoritySynchronously(reason) {
    required(this.#authority !== null && this.#lease === null,
      "acquisition recovery authority is unavailable");
    const receipt = this.#authority.revoke(reason);
    required(receipt !== null && typeof receipt === "object" &&
      typeof receipt.then !== "function" && receipt.revoked === true,
    "M10 acquisition recovery authority did not synchronously revoke");
    this.#authority = null;
    return receipt;
  }

  #closeControllerSynchronously() {
    const receipt = this.#controller.close();
    required(receipt === undefined,
      "M10 terminal cleanup close must return synchronously");
  }

  /* An acquire that rejects without returning a lease is not, by itself,
   * proof that M10 retained a post-pin rollback record.  Pre-pin loss and a
   * successful rollback both return the authority to ACTIVE.  A synchronous
   * revocation is the only non-observing probe: success proves there is no
   * opaque recovery record; rejection leaves the same authority as M10's
   * required recovery capability. */
  #finishNoLeaseAcquireFailure(terminalPhase, reason) {
    this.#cursor = null;
    try {
      this.#revokeAuthoritySynchronously(reason);
    } catch {
      this.#enterAcquisitionRecovery(terminalPhase);
      return false;
    }
    try {
      this.#closeControllerSynchronously();
    } catch (error) {
      /* Revocation already established that no opaque pin remains.  A close
       * failure is therefore an ordinary terminal-cleanup uncertainty, never
       * an acquisition-recovery record. */
      this.#phase = "UNKNOWN";
      this.#unknownCause = "acquisition-terminal-close";
      throw error;
    }
    this.#recovery = null;
    this.#unknownCause = null;
    this.#phase = terminalPhase;
    return true;
  }

  async open({ initialize = false } = {}) {
    required(this.#phase === "NEW", "adapter cannot reopen; create a fresh adapter");
    const epoch = this.#epoch;
    this.#phase = "OPENING";
    const flight = (async () => {
      try {
        await this.#controller.open({ initialize });
        required(this.#active(epoch, "OPENING"),
          "adapter was invalidated while its controller opened");
        this.#authority = this.#controller.claimSnapshotReviewAuthority();
        required(this.#authority !== null && typeof this.#authority.acquire === "function" &&
          typeof this.#authority.revoke === "function", "M10 review authority is incomplete");
        this.#phase = "OPEN";
        return this.status();
      } catch (error) {
        this.#closeController();
        if (this.#phase === "OPENING") this.#phase = "FAILED";
        throw error;
      }
    })();
    this.#openFlight = flight;
    try { return await flight; }
    finally { if (this.#openFlight === flight) this.#openFlight = null; }
  }

  async openOverlayReview() {
    required(this.#phase === "OPEN" && this.#acquireFlight === null,
      "overlay review is unavailable");
    const epoch = this.#epoch;
    this.#phase = "ACQUIRING";
    const flight = (async () => {
      let lease = null; let authorityAcquireStarted = false;
      try {
        /* C-M10 serializes this generic overlay archive before acquisition;
         * compare its semantic root/generation to the subsequently pinned
         * review closure before any byte becomes cursor-visible. */
        const archive = new Uint8Array(await this.#controller.exportOverlay()).slice();
        required(this.#active(epoch, "ACQUIRING"),
          "adapter was invalidated while overlay export was prepared");
        const parsed = await parseCadrM10OverlayExport(archive);
        required(this.#active(epoch, "ACQUIRING"),
          "adapter was invalidated while overlay export was parsed");
        authorityAcquireStarted = true;
        lease = await this.#authority.acquire();
        this.#lease = lease;
        const leaseBinding = lease?.binding;
        required(leaseBinding !== null && typeof leaseBinding === "object" &&
          parsed.sourceGeneration === BigInt(leaseBinding.generation) &&
          same(parsed.rootSha256, Uint8Array.from(leaseBinding.rootSha256.match(/../g),
            part => Number.parseInt(part, 16))),
        "M10 overlay archive differs from its pinned review closure");
        required(this.#active(epoch, "ACQUIRING"),
          "adapter was invalidated while review authority was acquired");
        const sha256 = await this.#digest(archive.slice());
        required(typeof sha256 === "string" && /^[0-9a-f]{64}$/.test(sha256),
          "overlay digest is not canonical lowercase SHA-256");
        required(this.#active(epoch, "ACQUIRING"),
          "adapter was invalidated while overlay digest was calculated");
        this.#cursor = { epoch, bytes: archive, offset: 0, sha256 };
        this.#phase = "REVIEWING";
        return Object.freeze({ byteCount: BigInt(archive.byteLength), sha256,
          sourceGeneration: parsed.sourceGeneration.toString(),
          rootSha256: hexBytes(parsed.rootSha256) });
      } catch (error) {
        /* A no-lease rejection can be pre-pin, a successful post-pin rollback,
         * or a post-pin rollback whose response was lost.  Revoke first: only
         * M10's synchronous refusal proves that the same authority retains an
         * opaque recovery record. */
        if (lease === null && authorityAcquireStarted) {
          const terminalPhase = this.#phase === "INVALIDATED" ? "INVALIDATED" : "FAILED";
          try {
            this.#finishNoLeaseAcquireFailure(terminalPhase,
              terminalPhase === "INVALIDATED" ? "invalidation-before-review-lease" :
                "review-acquisition-no-lease");
          } catch (cleanupError) {
            throw new AggregateError([error, cleanupError],
              "M13 no-lease acquisition failure could not close its terminal controller");
          }
          throw error;
        }
        /* invalidateAfterAmbiguousGuest() joins this acquisition so that it
         * alone performs the post-replacement branded release.  Releasing
         * here would race that join and could turn a valid terminal fence
         * into an unrelated UNKNOWN acquisition failure. */
        if (this.#phase === "INVALIDATED") {
          this.#cursor = null;
          throw error;
        }
        if (lease !== null && this.#lease === lease) {
          try { await lease.release(); this.#lease = null; }
          catch (releaseError) {
            this.#phase = "UNKNOWN"; this.#unknownCause = "review-acquisition-release";
            throw new AggregateError([error, releaseError],
              "M13 M10 review acquisition failed and its opaque pin release failed");
          }
        }
        this.#cursor = null;
        if (this.#phase === "ACQUIRING") this.#phase = "OPEN";
        throw error;
      }
    })();
    this.#acquireFlight = flight;
    try { return await flight; }
    finally { if (this.#acquireFlight === flight) this.#acquireFlight = null; }
  }

  async nextOverlayChunk({ maxBytes } = {}) {
    required(this.#phase === "REVIEWING" && this.#cursor !== null,
      "overlay cursor is unavailable");
    required(Number.isSafeInteger(maxBytes) && maxBytes >= 1 &&
      maxBytes <= MAX_CHUNK_BYTES, "overlay chunk bound is invalid");
    const cursor = this.#cursor;
    const epoch = this.#epoch;
    const first = cursor.offset;
    const last = Math.min(cursor.bytes.byteLength, first + maxBytes);
    const bytes = cursor.bytes.slice(first, last);
    /* Crucially, no mutable cursor field changes before this digest and the
     * epoch/identity check both succeed.  A lifecycle loss leaves the exact
     * chunk available for a fresh adapter rather than silently skipping it. */
    const chunkSha256 = await this.#digest(bytes.slice());
    required(typeof chunkSha256 === "string" && /^[0-9a-f]{64}$/.test(chunkSha256),
      "overlay chunk digest is not canonical lowercase SHA-256");
    required(this.#active(epoch, "REVIEWING") && this.#cursor === cursor &&
      cursor.offset === first, "overlay cursor was invalidated during digest");
    cursor.offset = last;
    return Object.freeze({ offset: BigInt(first), bytes: bytes.buffer,
      chunkSha256, nextOffset: BigInt(last), eof: last === cursor.bytes.byteLength });
  }

  async closeOverlayReview() {
    required(this.#phase === "REVIEWING" && this.#lease !== null,
      "overlay review is unavailable");
    const lease = this.#lease;
    this.#cursor = null;
    /* This is a review release, not whole-adapter disposal.  An ambiguous
     * guest report is still admissible while the branded M10 release awaits;
     * it must be able to supersede the old release with M10's exact fence. */
    this.#phase = "RELEASING";
    try {
      await lease.release();
      if (this.#phase !== "RELEASING") {
        if (this.#invalidationFlight !== null) await this.#invalidationFlight;
        throw new CadrM13M10ReviewAdapterError(
          "overlay review release was superseded by invalidation");
      }
      if (this.#lease === lease) this.#lease = null;
      this.#phase = "OPEN";
      return Object.freeze({ closed: true });
    } catch (error) {
      if (this.#invalidationFlight !== null) {
        await this.#invalidationFlight;
        throw error;
      }
      this.#phase = "UNKNOWN"; this.#unknownCause = "review-release";
      throw error;
    }
  }

  async invalidateAfterAmbiguousGuest(reason = "ambiguous-guest") {
    required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
      "invalidation reason is invalid");
    if (this.#invalidationFlight !== null) return this.#invalidationFlight;
    required(!["RECOVERY_REQUIRED", "DISPOSED", "UNKNOWN", "FAILED"].includes(this.#phase),
      "adapter invalidation is unavailable");
    this.#phase = "INVALIDATED"; this.#epoch += 1; this.#cursor = null;
    const acquire = this.#acquireFlight;
    const flight = (async () => {
      let invalidationError = null;
      try { await this.#controller.invalidateAfterAmbiguousGuest(); }
      catch (error) { invalidationError = error; }
      /* If an acquisition began before invalidation, it owns the only possible
       * opaque pin.  Join it before deciding whether cleanup is complete. */
      let acquisitionError = null;
      if (acquire !== null) {
        try { await acquire; } catch (error) { acquisitionError = error; }
      }
      if (this.#recovery !== null) {
        /* Do not close/revoke through M10's retained opaque recovery record.
         * The caller must explicitly drive the same authority to a lease. */
        this.#phase = "RECOVERY_REQUIRED";
        this.#unknownCause = "acquisition-recovery";
        if (invalidationError !== null && acquisitionError !== null) {
          throw new AggregateError([invalidationError, acquisitionError],
            "M13 invalidation requires opaque acquisition recovery");
        }
        throw acquisitionError ?? invalidationError ?? new CadrM13M10ReviewAdapterError(
          "M13 invalidation requires opaque acquisition recovery");
      }
      const lease = this.#lease;
      if (lease !== null) {
        try {
          /* M10 fences this release to the exact replacement flight. */
          await lease.release();
          if (this.#lease === lease) this.#lease = null;
        } catch (error) {
          /* A failed replacement is not a release failure that a stale
           * session may retry.  Retain the opaque lease and require a new
           * replacement notification before retryInvalidatedCleanup() may
           * ask M10 to release it. */
          this.#phase = "UNKNOWN";
          this.#unknownCause = invalidationError === null ? "ambiguous-release" : "replacement";
          throw invalidationError === null ? error : new AggregateError(
            [invalidationError, error], "M13 invalidation and opaque pin release failed");
        }
      }
      if (invalidationError !== null) {
        this.#phase = "UNKNOWN"; this.#unknownCause = "replacement";
        throw invalidationError;
      }
      this.#closeController();
      this.#revokeAuthority(reason);
      return Object.freeze({ invalidated: true, released: lease !== null,
        phase: this.#phase });
    })();
    this.#invalidationFlight = flight;
    return flight;
  }

  /* A failed M10 replacement leaves either a branded lease or a lease-free
   * active authority.  In both cases retain a step record: retry may need a
   * fresh replacement first, then releases the exact returned lease if any,
   * synchronously revokes the authority, and closes.  It never reopens this
   * adapter or manufactures a review capability. */
  retryInvalidatedCleanup(reason = "replacement-retry") {
    required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
      "replacement retry reason is invalid");
    if (this.#replacementCleanupFlight !== null) return this.#replacementCleanupFlight;
    required(this.#phase === "UNKNOWN" &&
      (this.#unknownCause === "replacement" ||
        this.#unknownCause?.startsWith("replacement-")),
    "no failed replacement cleanup is available");
    const record = this.#replacementCleanup ?? { step: "INVALIDATE" };
    this.#replacementCleanup = record;
    let resolveFlight; let rejectFlight;
    const flight = new Promise((resolve, reject) => {
      resolveFlight = resolve; rejectFlight = reject;
    });
    /* Publish the exact joinable promise before any M10 call may synchronously
     * re-enter an adapter callback.  One record/flight owns every transition;
     * another caller cannot reopen INVALIDATE after the first reaches DONE. */
    this.#replacementCleanupFlight = flight;
    void (async () => {
      try {
        if (record.step === "INVALIDATE") {
          await this.#controller.invalidateAfterAmbiguousGuest();
          record.step = this.#lease === null ? "REVOKE" : "RELEASE";
        }
        if (record.step === "RELEASE") {
          const lease = this.#lease;
          required(lease !== null, "replacement cleanup lease was lost");
          const receipt = await lease.release();
          required(receipt?.released === true, "replacement cleanup lease release failed");
          if (this.#lease === lease) this.#lease = null;
          record.step = "REVOKE";
        }
        if (record.step === "REVOKE") {
          this.#revokeAuthoritySynchronously(reason);
          record.step = "CLOSE";
        }
        if (record.step === "CLOSE") {
          this.#closeControllerSynchronously();
          record.step = "DONE";
        }
        required(record.step === "DONE", "replacement cleanup is incomplete");
        this.#replacementCleanup = null; this.#unknownCause = null;
        this.#phase = "INVALIDATED";
        resolveFlight(Object.freeze({ retried: true, phase: this.#phase }));
      } catch (error) {
        this.#phase = "UNKNOWN";
        this.#unknownCause = `replacement-${record.step.toLowerCase()}`;
        rejectFlight(error);
      } finally {
        /* Clear only the flight that still owns this terminal/UNKNOWN state.
         * A rejected flight leaves the record's exact next step for a later,
         * explicit retry; a fulfilled flight has already reached INVALIDATED. */
        if (this.#replacementCleanupFlight === flight &&
            (this.#phase === "UNKNOWN" || this.#phase === "INVALIDATED")) {
          this.#replacementCleanupFlight = null;
        }
      }
    })();
    return flight;
  }

  /* This is deliberately distinct from retryOpaqueRelease().  There is no
   * lease when M10's acquire rejected after pinning, so only the same branded
   * authority can first compensate the old opaque pin and issue the temporary
   * recovery lease.  Retain that lease immediately, release it, then revoke
   * synchronously.  No success path returns this adapter to OPEN or DISPOSED. */
  async retryAcquisitionCleanup(reason = "acquisition-recovery-retry") {
    required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
      "acquisition recovery retry reason is invalid");
    const record = this.#requireAcquisitionRecovery();
    if (this.#recoveryFlight !== null) return this.#recoveryFlight;
    const flight = (async () => {
      try {
        if (record.step === "ACQUIRE") {
          required(this.#authority !== null,
            "acquisition recovery authority is unavailable");
          const lease = await this.#authority.acquire();
          required(lease !== null && typeof lease === "object" &&
            typeof lease.release === "function",
          "M10 acquisition recovery returned an invalid lease");
          this.#lease = lease;
          record.step = "RELEASE";
        }
        if (record.step === "RELEASE") {
          const lease = this.#lease;
          required(lease !== null, "M10 acquisition recovery lease was lost");
          const receipt = await lease.release();
          required(receipt?.released === true,
            "M10 acquisition recovery lease release failed");
          if (this.#lease === lease) this.#lease = null;
          record.step = "REVOKE";
        }
        if (record.step === "REVOKE") {
          this.#revokeAuthoritySynchronously(reason);
          record.step = "CLOSE";
        }
        if (record.step === "CLOSE") {
          this.#closeControllerSynchronously();
          record.step = "DONE";
        }
        required(record.step === "DONE", "acquisition recovery cleanup is incomplete");
        this.#recovery = null; this.#unknownCause = null;
        this.#phase = record.terminalPhase;
        return Object.freeze({ recovered: true, phase: this.#phase });
      } catch (error) {
        this.#phase = "UNKNOWN";
        this.#unknownCause = `acquisition-recovery-${record.step.toLowerCase()}`;
        throw error;
      }
    })();
    this.#recoveryFlight = flight;
    try { return await flight; }
    finally { if (this.#recoveryFlight === flight) this.#recoveryFlight = null; }
  }

  /* Ordinary durable unpin/report failures are not ambiguity: M10 retains the
   * branded lease in RELEASE_REQUIRED and permits the same lease to retry.
   * Keep that recovery internal to this adapter; no raw M10 release capability
   * or pin identifier crosses this boundary.  In particular, ambiguity never
   * returns to OPEN even if its later opaque release succeeds. */
  async retryOpaqueRelease(reason = "opaque-release-retry") {
    required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
      "opaque release retry reason is invalid");
    const cause = this.#unknownCause;
    required(this.#phase === "UNKNOWN" && this.#lease !== null &&
      ["review-release", "review-acquisition-release", "dispose-release", "ambiguous-release"].includes(cause),
    "no opaque release retry is available");
    const lease = this.#lease;
    try {
      await lease.release();
      if (this.#lease === lease) this.#lease = null;
      this.#unknownCause = null;
      if (cause === "review-release" || cause === "review-acquisition-release") {
        this.#phase = "OPEN";
        return Object.freeze({ retried: true, phase: this.#phase });
      }
      this.#closeController(); this.#revokeAuthority(reason);
      this.#phase = cause === "ambiguous-release" ? "INVALIDATED" : "DISPOSED";
      return Object.freeze({ retried: true, phase: this.#phase });
    } catch (error) {
      this.#phase = "UNKNOWN"; this.#unknownCause = cause;
      throw error;
    }
  }

  async dispose(reason = "adapter-dispose") {
    required(typeof reason === "string" && reason.length > 0 && reason.length <= 160,
      "dispose reason is invalid");
    if (this.#disposeFlight !== null) return this.#disposeFlight;
    required(!["RECOVERY_REQUIRED", "INVALIDATED", "DISPOSED", "UNKNOWN", "FAILED"].includes(this.#phase),
      "adapter dispose is unavailable");
    this.#phase = "DISPOSING"; this.#epoch += 1; this.#cursor = null;
    const epoch = this.#epoch;
    const opening = this.#openFlight; const acquiring = this.#acquireFlight;
    const flight = (async () => {
      if (opening !== null) try { await opening; } catch { /* close below */ }
      if (acquiring !== null) try { await acquiring; } catch { /* release below */ }
      const lease = this.#lease;
      if (lease !== null) {
        try {
          await lease.release();
          if (this.#lease === lease) this.#lease = null;
        } catch (error) {
          if (this.#invalidationFlight !== null) {
            await this.#invalidationFlight;
            return Object.freeze({ disposed: false, superseded: true });
          }
          this.#phase = "UNKNOWN"; this.#unknownCause = "dispose-release";
          throw error;
        }
      }
      if (this.#phase !== "DISPOSING" || this.#epoch !== epoch) {
        if (this.#invalidationFlight !== null) await this.#invalidationFlight;
        return Object.freeze({ disposed: false, superseded: true });
      }
      this.#closeController(); this.#revokeAuthority(reason);
      this.#phase = "DISPOSED";
      return Object.freeze({ disposed: true, released: lease !== null });
    })();
    this.#disposeFlight = flight;
    return flight;
  }
}
