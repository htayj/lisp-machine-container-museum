/* C-M9 host-interaction lifecycle.  This is a future worker/core bridge
 * contract, not an implementation of a CADR scheduler transition. */

import {
  CADR_M9_HEIGHT,
  CADR_M9_POINTER_PROFILE,
  CADR_M9_WIDTH,
  CadrM9PointerController,
} from "./cadr-m9-pointer.mjs";

export const CADR_M9_INTERACTIVE_PROFILE = CADR_M9_POINTER_PROFILE;
export const CADR_M9_CDRSTATE6_BYTES = 24;
export const CADR_M9_BROWSER_STATES = Object.freeze({
  DISABLED: "DISABLED", IDLE: "IDLE", ACTIVE: "ACTIVE", CAPTURED: "CAPTURED",
  SUSPENDED: "SUSPENDED", TERMINAL: "TERMINAL",
});
export const CADR_M9_WORKER_STATES = Object.freeze({
  NEUTRAL: "NEUTRAL", ACTIVE: "ACTIVE", DEACTIVATING: "DEACTIVATING",
  PAUSED: "PAUSED", FAILED: "FAILED", STOPPED: "STOPPED",
});

const MAX_U32 = 0xffffffff;

function invariant(condition, message) {
  if (!condition) throw new TypeError(`C-M9 lifecycle: ${message}`);
}

function u16(value, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= 0xffff, `${name} must be uint16`);
  return value;
}

function u32(value, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= MAX_U32, `${name} must be uint32`);
  return value;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

function frozen(value) { return Object.freeze(value); }

/**
 * CDRSTATE6 pointer block proposed for a future ABI minor.  This module only
 * defines and validates the 24-byte payload; M9 Phase 1 does not claim it is
 * present in the current core snapshot, nor does it serialize browser DOM
 * focus/capture/layout/rebase state.
 */
export function serializeCdrState6Pointer(value) {
  invariant(value !== null && typeof value === "object", "pointer state must be an object");
  const legacyY = u16(value.legacyY, "legacyY"); const legacyX = u16(value.legacyX, "legacyX");
  const buttons = value.buttons ?? 0; const warpPending = value.warpPending ?? false;
  invariant(Number.isInteger(buttons) && buttons >= 0 && buttons <= 7, "buttons must be three bits");
  invariant(typeof warpPending === "boolean", "warpPending must be boolean");
  const previousCursorState = u32(value.previousCursorState ?? 0, "previousCursorState");
  const warpX = u16(value.warpX ?? 0, "warpX"); const warpY = u16(value.warpY ?? 0, "warpY");
  const warpGeneration = u32(value.warpGeneration ?? 0, "warpGeneration");
  const bytes = new Uint8Array(CADR_M9_CDRSTATE6_BYTES); const view = new DataView(bytes.buffer);
  view.setUint16(0, legacyY, true); view.setUint16(2, legacyX, true); bytes[4] = buttons;
  bytes[5] = warpPending ? 1 : 0; view.setUint32(8, previousCursorState, true);
  view.setUint16(12, warpX, true); view.setUint16(14, warpY, true);
  view.setUint32(16, warpGeneration, true);
  return bytes;
}

export function parseCdrState6Pointer(value) {
  const bytes = asBytes(value);
  invariant(bytes !== null && bytes.byteLength === CADR_M9_CDRSTATE6_BYTES, "CDRSTATE6 pointer length");
  invariant(bytes[5] <= 1 && bytes[4] <= 7, "CDRSTATE6 pointer flags");
  for (const index of [6, 7, 20, 21, 22, 23]) invariant(bytes[index] === 0, "CDRSTATE6 reserved byte");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parsed = frozen({ legacyY: view.getUint16(0, true), legacyX: view.getUint16(2, true),
    buttons: bytes[4], warpPending: bytes[5] === 1,
    previousCursorState: view.getUint32(8, true), warpX: view.getUint16(12, true),
    warpY: view.getUint16(14, true), warpGeneration: view.getUint32(16, true) });
  if (parsed.warpPending) {
    invariant(parsed.warpX < CADR_M9_WIDTH && parsed.warpY < CADR_M9_HEIGHT,
      "CDRSTATE6 pending warp is outside EDGE32");
  }
  return parsed;
}

/**
 * The browser owns capture/focus/layout; the future worker owns machine state.
 * The shared controller queues only typed host ingress.  A caller must drain
 * and apply that queue at a complete boundary before acknowledging pause.
 */
export class CadrM9InteractiveLifecycle {
  #pointer;
  #browser = CADR_M9_BROWSER_STATES.DISABLED;
  #worker = CADR_M9_WORKER_STATES.NEUTRAL;
  #epoch;
  #layoutValid = false;
  #visible = false;
  #focused = false;
  #neutralAcknowledged = false;
  #restoreNeedsWarpHandshake = false;
  #failure = null;

  constructor({ pointer = new CadrM9PointerController(), epoch = pointer.generation } = {}) {
    invariant(pointer instanceof CadrM9PointerController, "pointer must be CadrM9PointerController");
    this.#pointer = pointer; this.#epoch = u32(epoch, "epoch");
    invariant(pointer.generation === this.#epoch, "pointer generation must equal lifecycle epoch");
  }

  get pointer() { return this.#pointer; }
  get browserState() { return this.#browser; }
  get workerState() { return this.#worker; }
  get epoch() { return this.#epoch; }

  enable({ visible = true, layoutValid = true, focused = false } = {}) {
    invariant(typeof visible === "boolean" && typeof layoutValid === "boolean" &&
      typeof focused === "boolean", "enable state must be boolean");
    if (this.#browser !== CADR_M9_BROWSER_STATES.DISABLED ||
        this.#worker !== CADR_M9_WORKER_STATES.NEUTRAL) {
      return frozen({ accepted: false, reason: this.#browser === CADR_M9_BROWSER_STATES.TERMINAL ?
        "terminal" : "enable-requires-disabled-neutral" });
    }
    this.#visible = visible; this.#layoutValid = layoutValid; this.#focused = focused;
    this.#browser = this.#visible && this.#layoutValid ? CADR_M9_BROWSER_STATES.IDLE :
      CADR_M9_BROWSER_STATES.DISABLED;
    this.#worker = CADR_M9_WORKER_STATES.NEUTRAL; this.#neutralAcknowledged = false;
    return frozen({ accepted: true, browser: this.#browser, worker: this.#worker });
  }

  focusAcquired() {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) return frozen({ accepted: false, reason: "terminal" });
    this.#focused = true;
    return frozen({ accepted: true, reason: "focused" });
  }

  activate() {
    if (this.#browser !== CADR_M9_BROWSER_STATES.IDLE || this.#worker !== CADR_M9_WORKER_STATES.NEUTRAL) {
      return frozen({ accepted: false, reason: "not-idle-neutral" });
    }
    if (!this.#visible || !this.#layoutValid || !this.#focused) {
      return frozen({ accepted: false, reason: "visible-layout-focus-required" });
    }
    this.#browser = CADR_M9_BROWSER_STATES.ACTIVE; this.#worker = CADR_M9_WORKER_STATES.ACTIVE;
    return frozen({ accepted: true, reason: "active" });
  }

  captureAcquired({ hostButtons = this.#pointer.buttons } = {}) {
    if (this.#browser !== CADR_M9_BROWSER_STATES.ACTIVE || this.#worker !== CADR_M9_WORKER_STATES.ACTIVE ||
        !Number.isInteger(hostButtons) || hostButtons <= 0 || hostButtons > 7) {
      return frozen({ accepted: false, reason: "capture-precondition" });
    }
    this.#browser = CADR_M9_BROWSER_STATES.CAPTURED;
    return frozen({ accepted: true, reason: "captured" });
  }

  captureReleased({ hostButtons = this.#pointer.buttons } = {}) {
    if (this.#browser === CADR_M9_BROWSER_STATES.CAPTURED && hostButtons === 0) {
      this.#browser = CADR_M9_BROWSER_STATES.ACTIVE;
      return frozen({ accepted: true, reason: "capture-released" });
    }
    return frozen({ accepted: false, reason: "capture-still-held" });
  }

  #terminalFailure(failure, error = null, reason = failure) {
    this.#pointer.discardForTerminal();
    this.#failure = failure;
    this.#browser = CADR_M9_BROWSER_STATES.TERMINAL;
    this.#worker = CADR_M9_WORKER_STATES.FAILED;
    return frozen({ accepted: false, reason, action: "fail-stop", ...(error === null ? {} : { error }) });
  }

  /** Absorbing host-side fail-stop for an already rejected external transaction. */
  failStop(reason = "external-fail-stop", error = null) {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "already-terminal", action: "fail-stop" });
    }
    invariant(typeof reason === "string" && reason.length > 0, "fail-stop reason must be nonempty");
    return this.#terminalFailure(reason, error);
  }

  /**
   * Complete a neutralization already accepted by the production worker.
   * This local lifecycle owns no copy of the remote ingress queue; it advances
   * only after the caller has the positive remote commit response.
   */
  externalNeutralizationAccepted({ trigger = "external-neutralization",
    priorGeneration, nextGeneration } = {}) {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "terminal", action: "fail-stop" });
    }
    if (this.#worker !== CADR_M9_WORKER_STATES.ACTIVE ||
        ![CADR_M9_BROWSER_STATES.ACTIVE, CADR_M9_BROWSER_STATES.CAPTURED].includes(this.#browser)) {
      return this.#terminalFailure(`external-${trigger}-invalid-lifecycle`, null,
        "external-neutralization-invalid-lifecycle");
    }
    if (this.#pointer.buttons !== 0 || this.#pointer.queueLength !== 0) {
      return this.#terminalFailure(`external-${trigger}-local-state-not-neutral`, null,
        "external-neutralization-local-state-not-neutral");
    }
    if (this.#epoch === MAX_U32) {
      return this.#terminalFailure(`external-${trigger}-epoch-exhausted`, null, "epoch-exhausted");
    }
    let committedPrior; let committedNext;
    try {
      committedPrior = u32(priorGeneration, "priorGeneration");
      committedNext = u32(nextGeneration, "nextGeneration");
    } catch (error) {
      return this.#terminalFailure(`external-${trigger}-invalid-generation-result`, error,
        "external-neutralization-invalid-generation-result");
    }
    if (committedPrior !== this.#epoch || committedNext !== this.#epoch + 1) {
      return this.#terminalFailure(`external-${trigger}-generation-mismatch`, null,
        "external-neutralization-generation-mismatch");
    }
    this.#worker = CADR_M9_WORKER_STATES.DEACTIVATING;
    try {
      this.#epoch = this.#pointer.advanceGeneration(committedNext);
      invariant(this.#epoch === committedNext, "adopted epoch differs from remote commit");
    } catch (error) {
      return this.#terminalFailure(`external-${trigger}-epoch-advance-threw`, error,
        "epoch-advance-threw");
    }
    this.#neutralAcknowledged = false;
    this.#browser = CADR_M9_BROWSER_STATES.SUSPENDED;
    this.#worker = CADR_M9_WORKER_STATES.PAUSED;
    return frozen({ accepted: true, reason: "external-neutralization-accepted", trigger,
      entries: Object.freeze([]), priorGeneration: committedPrior, nextEpoch: committedNext,
      noGuestInstructionBetween: true });
  }

  #deactivate({ trigger, cause, tick = 0n } = {}) {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL ||
        [CADR_M9_WORKER_STATES.FAILED, CADR_M9_WORKER_STATES.STOPPED].includes(this.#worker)) {
      return frozen({ accepted: false, reason: "terminal" });
    }
    if (this.#worker === CADR_M9_WORKER_STATES.PAUSED && this.#browser === CADR_M9_BROWSER_STATES.SUSPENDED) {
      return frozen({ accepted: true, reason: "already-deactivated", entries: Object.freeze([]) });
    }
    if (this.#epoch === MAX_U32) {
      return this.#terminalFailure(`deactivate-${trigger}-epoch-exhausted`, null, "epoch-exhausted");
    }
    this.#worker = CADR_M9_WORKER_STATES.DEACTIVATING;
    let neutralized;
    try {
      neutralized = this.#pointer.neutralize({ cause, tick, generation: this.#epoch });
    } catch (error) {
      return this.#terminalFailure(`deactivate-${trigger}-neutralization-threw`, error, "neutralization-threw");
    }
    if (!neutralized.accepted) {
      /* Do not synthesize a subset of releases.  A future integration must
       * stop before the next guest instruction and surface recovery. */
      return this.#terminalFailure(`deactivate-${trigger}-${neutralized.reason}`, null, neutralized.reason);
    }
    try {
      this.#epoch = this.#pointer.advanceGeneration();
    } catch (error) {
      return this.#terminalFailure(`deactivate-${trigger}-epoch-advance-threw`, error, "epoch-advance-threw");
    }
    this.#neutralAcknowledged = false;
    this.#browser = CADR_M9_BROWSER_STATES.SUSPENDED; this.#worker = CADR_M9_WORKER_STATES.PAUSED;
    return frozen({ accepted: true, reason: "deactivated", trigger, entries: neutralized.entries,
      priorGeneration: neutralized.entries[0]?.generation ?? this.#epoch - 1, nextEpoch: this.#epoch,
      noGuestInstructionBetween: true });
  }

  blur(options = {}) { this.#focused = false; return this.#deactivate({ ...options, trigger: "blur", cause: "lifecycle" }); }
  focusOutGroup(options = {}) { this.#focused = false; return this.#deactivate({ ...options, trigger: "focus-out-group", cause: "lifecycle" }); }
  visibilityHidden(options = {}) { this.#visible = false; return this.#deactivate({ ...options, trigger: "hidden", cause: "lifecycle" }); }
  lostCapture(options = {}) { return this.#deactivate({ ...options, trigger: "lostcapture", cause: "capture-loss" }); }
  pause(options = {}) { return this.#deactivate({ ...options, trigger: "manual-pause", cause: "lifecycle" }); }
  layoutInvalidated(options = {}) {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "terminal" });
    }
    this.#layoutValid = false;
    return this.#deactivate({ ...options, trigger: "layout-invalidation", cause: "lifecycle" });
  }

  acknowledgeNeutralization() {
    if (this.#worker !== CADR_M9_WORKER_STATES.PAUSED || this.#pointer.buttons !== 0 ||
        this.#pointer.queueLength !== 0) return frozen({ accepted: false, reason: "neutral-queue-not-drained" });
    this.#neutralAcknowledged = true;
    return frozen({ accepted: true, reason: "neutral-acknowledged" });
  }

  setLayout({ valid, visible = this.#visible, focused = this.#focused, tick = 0n } = {}) {
    invariant(typeof valid === "boolean" && typeof visible === "boolean" && typeof focused === "boolean",
      "layout state must be boolean");
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "terminal" });
    }
    this.#layoutValid = valid; this.#visible = visible; this.#focused = focused;
    if (!valid) {
      if (this.#browser === CADR_M9_BROWSER_STATES.DISABLED &&
          this.#worker === CADR_M9_WORKER_STATES.NEUTRAL) {
        return frozen({ accepted: true, browser: this.#browser, reason: "layout-disabled" });
      }
      return this.#deactivate({ trigger: "layout-invalidation", cause: "lifecycle", tick });
    }
    if (this.#browser === CADR_M9_BROWSER_STATES.DISABLED && valid && visible) {
      this.#browser = CADR_M9_BROWSER_STATES.IDLE;
    }
    return frozen({ accepted: true, browser: this.#browser });
  }

  resume() {
    if (this.#browser !== CADR_M9_BROWSER_STATES.SUSPENDED || this.#worker !== CADR_M9_WORKER_STATES.PAUSED) {
      return frozen({ accepted: false, reason: "not-paused" });
    }
    if (!this.#visible || !this.#layoutValid || !this.#focused || this.#pointer.buttons !== 0 ||
        !this.#neutralAcknowledged || this.#restoreNeedsWarpHandshake) {
      return frozen({ accepted: false, reason: "visible-layout-focus-neutral-ack-required" });
    }
    this.#browser = CADR_M9_BROWSER_STATES.ACTIVE; this.#worker = CADR_M9_WORKER_STATES.ACTIVE;
    this.#neutralAcknowledged = false;
    return frozen({ accepted: true, reason: "resumed" });
  }

  /** Reset remains paused; failure after a partial future-core reset is terminal. */
  reset({ coreReset = null, fullRefresh = null } = {}) {
    if (this.#worker !== CADR_M9_WORKER_STATES.PAUSED || this.#browser !== CADR_M9_BROWSER_STATES.SUSPENDED) {
      return frozen({ accepted: false, reason: "reset-requires-paused" });
    }
    invariant(coreReset === null || typeof coreReset === "function", "coreReset must be a function");
    invariant(fullRefresh === null || typeof fullRefresh === "function", "fullRefresh must be a function");
    try {
      if (coreReset !== null) coreReset();
      if (fullRefresh !== null) fullRefresh();
    } catch (error) {
      return this.#terminalFailure("reset-or-refresh-failed", error);
    }
    try {
      this.#epoch = this.#pointer.advanceGeneration(); this.#pointer.clearHostState({ generation: this.#epoch });
    } catch (error) {
      return this.#terminalFailure("reset-host-state-failed", error);
    }
    this.#neutralAcknowledged = false; this.#restoreNeedsWarpHandshake = false;
    return frozen({ accepted: true, reason: "reset-paused", epoch: this.#epoch });
  }

  stop(reason = "stopped") {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "already-terminal" });
    }
    this.#pointer.discardForTerminal(); this.#browser = CADR_M9_BROWSER_STATES.TERMINAL;
    this.#worker = CADR_M9_WORKER_STATES.STOPPED; this.#failure = reason;
    return frozen({ accepted: true, reason: "stopped" });
  }

  crash(reason = "worker-crash") {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "already-terminal" });
    }
    this.#pointer.discardForTerminal(); this.#browser = CADR_M9_BROWSER_STATES.TERMINAL;
    this.#worker = CADR_M9_WORKER_STATES.FAILED; this.#failure = reason;
    return frozen({ accepted: true, reason: "failed" });
  }

  snapshotEligibility() {
    if (this.#worker !== CADR_M9_WORKER_STATES.PAUSED || this.#browser !== CADR_M9_BROWSER_STATES.SUSPENDED) {
      return frozen({ eligible: false, reason: "snapshot-requires-paused" });
    }
    if (this.#pointer.buttons !== 0 || this.#pointer.queueLength !== 0 || this.#pointer.warpRequest() !== null) {
      return frozen({ eligible: false, reason: "snapshot-requires-neutral-queues" });
    }
    return frozen({ eligible: true, reason: "host-dom-state-excluded" });
  }

  restoreNeutral() {
    if (this.#worker !== CADR_M9_WORKER_STATES.PAUSED) return frozen({ accepted: false, reason: "restore-requires-paused" });
    try {
      this.#epoch = this.#pointer.advanceGeneration(); this.#pointer.clearHostState({ generation: this.#epoch });
    } catch (error) {
      return this.#terminalFailure("restore-host-state-failed", error);
    }
    this.#browser = CADR_M9_BROWSER_STATES.SUSPENDED; this.#neutralAcknowledged = false;
    this.#restoreNeedsWarpHandshake = true;
    return frozen({ accepted: true, reason: "restored-neutral-fresh-epoch", epoch: this.#epoch });
  }

  acknowledgeRestoreWarpHandshake() {
    if (this.#browser === CADR_M9_BROWSER_STATES.TERMINAL) {
      return frozen({ accepted: false, reason: "terminal" });
    }
    if (!this.#restoreNeedsWarpHandshake) return frozen({ accepted: false, reason: "no-warp-handshake-pending" });
    this.#restoreNeedsWarpHandshake = false;
    return frozen({ accepted: true, reason: "warp-handshake-acknowledged" });
  }

  shouldWarnBeforeUnload(m10State) { return m10State === "DIRTY"; }

  snapshot() {
    return frozen({ profile: CADR_M9_INTERACTIVE_PROFILE, browser: this.#browser, worker: this.#worker,
      epoch: this.#epoch, visible: this.#visible, layoutValid: this.#layoutValid, focused: this.#focused,
      neutralAcknowledged: this.#neutralAcknowledged, restoreNeedsWarpHandshake: this.#restoreNeedsWarpHandshake,
      failure: this.#failure, pointer: this.#pointer.snapshot() });
  }
}
