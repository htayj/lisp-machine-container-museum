/* Browser-facing C-M9 transform, capture, and accessibility input adapter.
 * It deliberately does not request Pointer Lock or move an operating-system
 * cursor.  The only warp behavior is the generation-tagged logical rebase. */

import {
  CADR_M9_HEIGHT,
  CADR_M9_POINTER_PROFILE,
  CADR_M9_PROTOCOL_VERSION,
  CADR_M9_WIDTH,
  CadrM9PointerController,
  cadrM9ButtonForDom,
  cadrM9ButtonForName,
  cadrM9ClampPoint,
} from "../wasm/cadr-m9-pointer.mjs";
import { CadrM9InteractiveLifecycle } from "../wasm/cadr-m9-interactive-lifecycle.mjs";

function invariant(condition, message) {
  if (!condition) throw new TypeError(`C-M9 adapter: ${message}`);
}

function u32(value, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, `${name} must be uint32`);
  return value;
}

function finite(value, name) {
  invariant(typeof value === "number" && Number.isFinite(value), `${name} must be finite`);
  return value;
}

function thenable(value) { return value !== null && typeof value === "object" && typeof value.then === "function"; }

function accepted(value) {
  if (value !== null && typeof value === "object" && typeof value.accepted === "boolean") return value;
  if (value !== null && typeof value === "object" && value.result !== null &&
      typeof value.result === "object" && typeof value.result.accepted === "boolean") return value.result;
  if (value !== null && typeof value === "object" && typeof value.ok === "boolean") {
    return Object.freeze({ accepted: value.ok, reason: value.reason ?? (value.ok ? "accepted" : "rejected") });
  }
  return Object.freeze({ accepted: false, reason: "unknown-operation-result" });
}

function hostFocusAccepted(value) {
  if (value === false) return false;
  return !(value !== null && typeof value === "object" && value.accepted === false);
}

/**
 * Create the only accepted transform for this profile.  Scale and extents are
 * integral; devicePixelRatio, CSS rotation, and clamp-to-edge are excluded.
 */
export function createCadrM9PointerTransform({ contentLeft, contentTop, letterboxLeft = 0,
  letterboxTop = 0, scale, epoch }) {
  finite(contentLeft, "contentLeft"); finite(contentTop, "contentTop");
  invariant(Number.isInteger(letterboxLeft) && letterboxLeft >= 0, "letterboxLeft must be a nonnegative integer");
  invariant(Number.isInteger(letterboxTop) && letterboxTop >= 0, "letterboxTop must be a nonnegative integer");
  invariant(Number.isInteger(scale) && scale >= 1, "scale must be a positive integer");
  return Object.freeze({ contentLeft, contentTop, letterboxLeft, letterboxTop, scale,
    epoch: u32(epoch, "epoch"), width: CADR_M9_WIDTH * scale, height: CADR_M9_HEIGHT * scale });
}

/** Half-open test and floor-only mapping; null represents outside without clamp. */
export function cadrM9ClientToLogical(transform, { clientX, clientY, epoch = transform?.epoch } = {}) {
  invariant(transform !== null && typeof transform === "object", "transform must be current");
  invariant(u32(epoch, "epoch") === transform.epoch, "stale transform epoch");
  finite(clientX, "clientX"); finite(clientY, "clientY");
  const px = clientX - transform.contentLeft - transform.letterboxLeft;
  const py = clientY - transform.contentTop - transform.letterboxTop;
  if (px < 0 || py < 0 || px >= transform.width || py >= transform.height) return null;
  return Object.freeze({ x: Math.floor(px / transform.scale), y: Math.floor(py / transform.scale),
    epoch: transform.epoch });
}

/**
 * A narrow DOM adapter. `controller` is a synthetic test seam. Production
 * callers provide `submitPointerOperation`, which posts a dedicated v6 host
 * operation and preserves generic worker request sequencing outside M9.
 */
export class CadrM9PointerAdapter {
  #controller;
  #submit;
  #lifecycle;
  #focusGuest;
  #captureTarget;
  #transform = null;
  #lastInBounds = null;
  #capturedPointerId = null;
  #physicalButtons = 0;
  #accessibleButtons = 0;
  #acceptedButtons = 0;
  #acceptedButtonOrder = [];
  #pendingFirstDown = null;
  #pendingDeactivation = null;
  #pendingPhysicalButtons = new Map();
  #pendingAccessibleButtons = new Map();
  #terminalFailure = null;
  #rebase = null;
  #allocateRequestId;
  #nextId = 1;
  #disposed = false;

  constructor({ controller = null, submitPointerOperation = null, lifecycle = null,
    focusGuest = null, captureTarget = null, allocateRequestId = null } = {}) {
    invariant((controller instanceof CadrM9PointerController) !== (submitPointerOperation !== null),
      "supply exactly one controller or pointer operation submitter");
    invariant(submitPointerOperation === null || typeof submitPointerOperation === "function",
      "submitPointerOperation must be a function");
    invariant(lifecycle === null || lifecycle instanceof CadrM9InteractiveLifecycle,
      "lifecycle must be CadrM9InteractiveLifecycle");
    invariant(focusGuest === null || typeof focusGuest === "function", "focusGuest must be a function");
    invariant(allocateRequestId === null || typeof allocateRequestId === "function",
      "allocateRequestId must be a function");
    this.#controller = controller; this.#submit = submitPointerOperation; this.#lifecycle = lifecycle;
    this.#focusGuest = focusGuest; this.#captureTarget = captureTarget;
    this.#allocateRequestId = allocateRequestId;
  }

  get transform() { return this.#transform; }
  get capturedPointerId() { return this.#capturedPointerId; }
  get physicalButtons() { return this.#physicalButtons; }
  get accessibleButtons() { return this.#accessibleButtons; }
  get acceptedButtons() { return this.#acceptedButtons; }

  setTransform(transform) {
    invariant(transform !== null && typeof transform === "object", "transform must be an object");
    invariant(transform.width === CADR_M9_WIDTH * transform.scale && transform.height === CADR_M9_HEIGHT * transform.scale,
      "transform extent differs from EDGE32 profile");
    if (this.#lifecycle !== null && transform.epoch !== this.#lifecycle.epoch) {
      throw new RangeError("C-M9 adapter: stale lifecycle transform epoch");
    }
    this.#transform = transform; this.#rebase = null;
    return transform;
  }

  invalidateTransform() {
    this.#transform = null; this.#lastInBounds = null; this.#rebase = null;
    return this.#lifecycle === null ? Object.freeze({ accepted: true, reason: "transform-invalidated" }) :
      this.#lifecycle.layoutInvalidated();
  }

  #generation() { return this.#lifecycle?.epoch ?? this.#controller?.generation ?? 0; }

  #lifecycleAcceptsInput() {
    return this.#terminalFailure === null && this.#pendingDeactivation === null &&
      (this.#lifecycle === null ||
      (this.#lifecycle.workerState === "ACTIVE" &&
       ["ACTIVE", "CAPTURED"].includes(this.#lifecycle.browserState)));
  }

  #terminalRejection() {
    return this.#terminalFailure === null ? null :
      Object.freeze({ accepted: false, reason: "terminal", action: "fail-stop",
        failure: this.#terminalFailure.reason });
  }

  #failStop(reason, error = null) {
    if (this.#terminalFailure === null) {
      this.#terminalFailure = Object.freeze({ reason, error });
      this.#releaseCapture(); this.#clearAcceptedButtons();
      this.#transform = null; this.#lastInBounds = null; this.#rebase = null;
      if (this.#lifecycle !== null) {
        try { this.#lifecycle.failStop(reason, error); } catch { /* adapter state remains terminal */ }
      }
    }
    return Object.freeze({ accepted: false, reason, action: "fail-stop",
      ...(error === null ? {} : { error }) });
  }

  #operate(operation) {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#disposed) return Object.freeze({ accepted: false, reason: "disposed" });
    if (this.#controller !== null) {
      if (operation.op === "pointer-motion") return this.#controller.motion(operation);
      if (operation.op === "pointer-down") return this.#controller.buttonDown(operation);
      if (operation.op === "pointer-up") return this.#controller.buttonUp(operation);
      if (operation.op === "pointer-neutralize") return this.#controller.neutralize(operation);
      throw new TypeError(`C-M9 adapter: unsupported direct operation ${operation.op}`);
    }
    const id = this.#allocateRequestId === null ? this.#nextId++ : this.#allocateRequestId();
    invariant(Number.isInteger(id) && id >= 1 && id <= 0xffffffff,
      "allocated request id must be a positive uint32");
    return this.#submit({ version: CADR_M9_PROTOCOL_VERSION, id, ...operation });
  }

  #deliver(operation, after = null) {
    let supplied;
    try { supplied = this.#operate(operation); }
    catch (error) { return Object.freeze({ accepted: false, reason: "submit-threw", error }); }
    const finish = value => {
      const outcome = accepted(value);
      if (outcome.accepted && after !== null) after(outcome);
      return outcome;
    };
    return thenable(supplied) ? Promise.resolve(supplied).then(finish,
      error => Object.freeze({ accepted: false, reason: "submit-rejected", error })) : finish(supplied);
  }

  #capture(pointerId) {
    if (this.#captureTarget === null) return true;
    try {
      if (typeof this.#captureTarget.setPointerCapture === "function") this.#captureTarget.setPointerCapture(pointerId);
      return true;
    } catch { return false; }
  }

  #releaseCapture(pointerId = this.#capturedPointerId) {
    if (pointerId !== null && this.#captureTarget !== null &&
        typeof this.#captureTarget.releasePointerCapture === "function") {
      try { this.#captureTarget.releasePointerCapture(pointerId); } catch { /* external loss is benign */ }
    }
    this.#capturedPointerId = null;
  }

  #pointerIdentity(event, { requireCapture = false } = {}) {
    if (event.pointerType !== "mouse" || event.isPrimary !== true) {
      return Object.freeze({ accepted: false, reason: "non-primary-mouse-pointer" });
    }
    if (!Number.isInteger(event.pointerId) || event.pointerId < 0) {
      return Object.freeze({ accepted: false, reason: "invalid-pointer-id" });
    }
    if (this.#capturedPointerId !== null && event.pointerId !== this.#capturedPointerId) {
      return Object.freeze({ accepted: false, reason: "capture-owned-by-other-pointer" });
    }
    if (requireCapture && this.#capturedPointerId === null) {
      return Object.freeze({ accepted: false, reason: "no-capture-owner" });
    }
    return Object.freeze({ accepted: true, pointerId: event.pointerId });
  }

  #acceptSourceDown(source, button) {
    invariant(["physical", "accessibility"].includes(source), "unknown button source");
    const sourceMask = source === "physical" ? this.#physicalButtons : this.#accessibleButtons;
    invariant((sourceMask & button.bit) === 0, "accepted source down contradicts local button mirror");
    const aggregateWasHeld = (this.#acceptedButtons & button.bit) !== 0;
    if (source === "physical") this.#physicalButtons |= button.bit;
    else this.#accessibleButtons |= button.bit;
    this.#acceptedButtons = this.#physicalButtons | this.#accessibleButtons;
    if (!aggregateWasHeld) this.#acceptedButtonOrder.push(button.name);
  }

  #acceptSourceUp(source, button) {
    invariant(["physical", "accessibility"].includes(source), "unknown button source");
    const sourceMask = source === "physical" ? this.#physicalButtons : this.#accessibleButtons;
    invariant((sourceMask & button.bit) !== 0, "accepted source up contradicts local button mirror");
    if (source === "physical") this.#physicalButtons &= ~button.bit;
    else this.#accessibleButtons &= ~button.bit;
    this.#acceptedButtons = this.#physicalButtons | this.#accessibleButtons;
    if ((this.#acceptedButtons & button.bit) === 0) {
      this.#acceptedButtonOrder = this.#acceptedButtonOrder.filter(name => name !== button.name);
    }
  }

  #clearAcceptedButtons() {
    this.#physicalButtons = 0; this.#accessibleButtons = 0; this.#acceptedButtons = 0;
    this.#acceptedButtonOrder = [];
  }

  #afterFirstDown(operation) {
    if (this.#pendingFirstDown === null) return operation();
    return this.#pendingFirstDown.then(operation, operation);
  }

  #trackFirstDown(value) {
    if (!thenable(value)) return value;
    let guarded;
    guarded = Promise.resolve(value).finally(() => {
      if (this.#pendingFirstDown === guarded) this.#pendingFirstDown = null;
    });
    this.#pendingFirstDown = guarded;
    return guarded;
  }

  #trackButtonTransition(pendingMap, name, value) {
    if (!thenable(value)) return value;
    let guarded;
    guarded = Promise.resolve(value).finally(() => {
      if (pendingMap.get(name) === guarded) pendingMap.delete(name);
    });
    pendingMap.set(name, guarded);
    return guarded;
  }

  #afterButtonTransitions(operation) {
    const pending = [...this.#pendingPhysicalButtons.values(), ...this.#pendingAccessibleButtons.values()];
    return pending.length === 0 ? operation() :
      Promise.allSettled(pending).then(operation);
  }

  #map(event) {
    if (this.#transform === null) return null;
    if (this.#lifecycle !== null && this.#transform.epoch !== this.#lifecycle.epoch) return null;
    let mapped;
    try { mapped = cadrM9ClientToLogical(this.#transform, { clientX: event.clientX, clientY: event.clientY,
      epoch: this.#transform.epoch }); }
    catch { return null; }
    if (mapped === null) return null;
    if (this.#rebase !== null) {
      if (this.#rebase.generation !== this.#generation()) return null;
      return Object.freeze({ ...cadrM9ClampPoint({ x: this.#rebase.target.x + mapped.x - this.#rebase.basis.x,
        y: this.#rebase.target.y + mapped.y - this.#rebase.basis.y }), epoch: mapped.epoch });
    }
    return mapped;
  }

  #prepareFocus() {
    const activate = () => {
      if (this.#lifecycle !== null) {
        const focus = this.#lifecycle.focusAcquired();
        if (!focus.accepted) return focus;
        if (this.#lifecycle.browserState === "IDLE") {
          const activation = this.#lifecycle.activate();
          if (!activation.accepted) return activation;
        }
        if (!["ACTIVE", "CAPTURED"].includes(this.#lifecycle.browserState) ||
            this.#lifecycle.workerState !== "ACTIVE") {
          return Object.freeze({ accepted: false, reason: "lifecycle-not-active" });
        }
      }
      return Object.freeze({ accepted: true, reason: "focused" });
    };
    if (this.#focusGuest === null) return activate();
    let outcome;
    try { outcome = this.#focusGuest(); } catch (error) { return Object.freeze({ accepted: false, reason: "focus-threw", error }); }
    if (!thenable(outcome)) return hostFocusAccepted(outcome) ? activate() :
      Object.freeze({ accepted: false, reason: "focus-rejected" });
    return Promise.resolve(outcome).then(value => hostFocusAccepted(value) ? activate() :
      Object.freeze({ accepted: false, reason: "focus-rejected" }),
    error => Object.freeze({ accepted: false, reason: "focus-rejected", error }));
  }

  #prepareFirstDown(pointerId) {
    const capture = focused => {
      if (!focused.accepted) return focused;
      if (!this.#capture(pointerId)) return Object.freeze({ accepted: false, reason: "capture-failed" });
      this.#capturedPointerId = pointerId;
      return Object.freeze({ accepted: true, reason: "focused-captured" });
    };
    const focused = this.#prepareFocus();
    return thenable(focused) ? Promise.resolve(focused).then(capture) : capture(focused);
  }

  pointerDown(event) {
    invariant(event !== null && typeof event === "object", "pointer down event must be an object");
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    if (this.#pendingFirstDown !== null) return this.#afterFirstDown(() => this.pointerDown(event));
    const identity = this.#pointerIdentity(event);
    if (!identity.accepted) return identity;
    const at = this.#map(event); const { pointerId } = identity;
    if (at === null) return Object.freeze({ accepted: false, reason: "outside-or-stale-layout" });
    const button = cadrM9ButtonForDom(event.button);
    if (button === null) return Object.freeze({ accepted: false, reason: "unmapped-button" });
    if (this.#pendingAccessibleButtons.has(button.name)) {
      return this.#pendingAccessibleButtons.get(button.name).then(() => this.pointerDown(event));
    }
    if ((this.#physicalButtons & button.bit) !== 0) {
      return Object.freeze({ accepted: false, reason: "duplicate-physical-down-local" });
    }
    const firstPhysicalDown = this.#physicalButtons === 0 && this.#capturedPointerId === null;
    const requiresGuestDown = (this.#acceptedButtons & button.bit) === 0;
    const commit = () => {
      this.#acceptSourceDown("physical", button);
      this.#lastInBounds = at;
      if (firstPhysicalDown && this.#lifecycle !== null) {
        const capture = this.#lifecycle.captureAcquired({ hostButtons: this.#physicalButtons });
        invariant(capture.accepted, "lifecycle rejected accepted physical capture");
      }
    };
    const send = () => requiresGuestDown ?
      this.#deliver({ op: "pointer-down", domButton: event.button, x: at.x, y: at.y,
        tick: event.tick ?? 0n, generation: this.#generation(), cause: "physical" }, commit) :
      (commit(), Object.freeze({ accepted: true, reason: "physical-source-acquired-no-edge" }));
    const prepared = firstPhysicalDown ? this.#prepareFirstDown(pointerId) :
      Object.freeze({ accepted: true, reason: "already-captured" });
    const complete = prep => {
      if (!prep.accepted) return prep;
      const delivered = send();
      const rejected = outcome => {
        if (!outcome.accepted && firstPhysicalDown && this.#physicalButtons === 0) {
          this.#releaseCapture(pointerId);
        }
        return outcome;
      };
      return thenable(delivered) ? Promise.resolve(delivered).then(rejected) : rejected(delivered);
    };
    const completed = thenable(prepared) ? Promise.resolve(prepared).then(complete) : complete(prepared);
    const tracked = this.#trackButtonTransition(this.#pendingPhysicalButtons, button.name, completed);
    return firstPhysicalDown ? this.#trackFirstDown(tracked) : tracked;
  }

  pointerMove(event) {
    invariant(event !== null && typeof event === "object", "pointer move event must be an object");
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingFirstDown !== null) return this.#afterFirstDown(() => this.pointerMove(event));
    if (!this.#lifecycleAcceptsInput()) return Object.freeze({ accepted: false, reason: "lifecycle-not-active" });
    const identity = this.#pointerIdentity(event);
    if (!identity.accepted) return identity;
    const at = this.#map(event);
    if (at === null) return Object.freeze({ accepted: false, reason: "outside-or-stale-layout" });
    this.#lastInBounds = at;
    return this.#deliver({ op: "pointer-motion", x: at.x, y: at.y, tick: event.tick ?? 0n,
      generation: this.#generation(), cause: "physical" });
  }

  pointerUp(event) {
    invariant(event !== null && typeof event === "object", "pointer up event must be an object");
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingFirstDown !== null) return this.#afterFirstDown(() => this.pointerUp(event));
    if (!this.#lifecycleAcceptsInput()) return Object.freeze({ accepted: false, reason: "lifecycle-not-active" });
    const identity = this.#pointerIdentity(event, { requireCapture: true });
    if (!identity.accepted) return identity;
    const { pointerId } = identity;
    const button = cadrM9ButtonForDom(event.button);
    if (button === null) return Object.freeze({ accepted: false, reason: "unmapped-button" });
    if (this.#pendingAccessibleButtons.has(button.name)) {
      return this.#pendingAccessibleButtons.get(button.name).then(() => this.pointerUp(event));
    }
    if ((this.#physicalButtons & button.bit) === 0) {
      return Object.freeze({ accepted: false, reason: "physical-not-held-local" });
    }
    const at = this.#map(event) ?? this.#lastInBounds;
    if (at === null) return Object.freeze({ accepted: false, reason: "outside-without-last-in-bounds" });
    const requiresGuestUp = (this.#accessibleButtons & button.bit) === 0;
    const commit = () => {
      this.#acceptSourceUp("physical", button);
      if (this.#physicalButtons === 0) {
        this.#releaseCapture(pointerId);
        if (this.#lifecycle !== null) this.#lifecycle.captureReleased({ hostButtons: 0 });
      }
    };
    const completed = requiresGuestUp ?
      this.#deliver({ op: "pointer-up", domButton: event.button, x: at.x, y: at.y, tick: event.tick ?? 0n,
        generation: this.#generation(), cause: "physical" }, commit) :
      (commit(), Object.freeze({ accepted: true, reason: "physical-source-released-no-edge" }));
    return this.#trackButtonTransition(this.#pendingPhysicalButtons, button.name, completed);
  }

  lostPointerCapture(event = {}) {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    if (this.#pendingFirstDown !== null) return this.#afterFirstDown(() => this.lostPointerCapture(event));
    if (this.#pendingPhysicalButtons.size > 0 || this.#pendingAccessibleButtons.size > 0) {
      return this.#afterButtonTransitions(() => this.lostPointerCapture(event));
    }
    const identity = this.#pointerIdentity(event, { requireCapture: true });
    if (!identity.accepted) return identity;
    const tick = event.tick ?? 0n;
    this.#capturedPointerId = null;
    const delivered = this.#controller === null || this.#lifecycle === null ?
      this.#deliver({ op: "pointer-neutralize", cause: "capture-loss", tick,
        generation: this.#generation() }) : this.#lifecycle.lostCapture({ tick });
    const finish = outcome => {
      const value = accepted(outcome);
      if (!value.accepted) {
        return this.#failStop(`lostcapture-neutralization-${value.reason ?? "rejected"}`, value.error ?? null);
      }
      if (this.#controller === null && this.#lifecycle !== null) {
        let bridged;
        try {
          bridged = this.#lifecycle.externalNeutralizationAccepted({ trigger: "lostcapture",
            priorGeneration: value.priorGeneration, nextGeneration: value.nextGeneration });
        } catch (error) {
          return this.#failStop("lostcapture-lifecycle-bridge-threw", error);
        }
        if (!bridged.accepted) {
          return this.#failStop(`lostcapture-lifecycle-${bridged.reason ?? "rejected"}`,
            bridged.error ?? null);
        }
      }
      this.#clearAcceptedButtons();
      this.#transform = null; this.#lastInBounds = null; this.#rebase = null;
      return value;
    };
    if (!thenable(delivered)) return finish(delivered);
    let guarded;
    guarded = Promise.resolve(delivered).then(finish,
      error => this.#failStop("lostcapture-neutralization-rejected", error)).finally(() => {
      if (this.#pendingDeactivation === guarded) this.#pendingDeactivation = null;
    });
    this.#pendingDeactivation = guarded;
    return guarded;
  }

  /** Apply a future cursor-state=3 request as a logical, clamped rebase only. */
  consumeWarpRebase() {
    if (this.#controller === null) return Object.freeze({ accepted: false, reason: "worker-warp-bridge-required" });
    const request = this.#controller.warpRequest();
    if (request === null) return Object.freeze({ accepted: false, reason: "no-warp-request" });
    if (request.generation !== this.#generation() || this.#transform === null) {
      this.#controller.clearWarpRequest();
      return Object.freeze({ accepted: false, reason: "stale-warp-request" });
    }
    const basis = this.#lastInBounds ?? this.#controller.cursor;
    this.#rebase = Object.freeze({ generation: request.generation, basis,
      target: Object.freeze({ x: request.x, y: request.y }) });
    this.#controller.clearWarpRequest();
    return Object.freeze({ accepted: true, reason: "logical-rebase", rebase: this.#rebase });
  }

  accessibleButton(name, { tick = 0n } = {}) {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    if (this.#pendingFirstDown !== null) {
      return this.#afterFirstDown(() => this.accessibleButton(name, { tick }));
    }
    const button = cadrM9ButtonForName(name);
    if (button === null) return Object.freeze({ accepted: false, reason: "unknown-accessible-button" });
    if (this.#pendingPhysicalButtons.has(name)) {
      return this.#pendingPhysicalButtons.get(name).then(() => this.accessibleButton(name, { tick }));
    }
    if (this.#pendingAccessibleButtons.has(name)) {
      return this.#pendingAccessibleButtons.get(name).then(() => this.accessibleButton(name, { tick }));
    }
    if (this.#lifecycle !== null && (this.#lifecycle.workerState !== "ACTIVE" ||
        !["ACTIVE", "CAPTURED"].includes(this.#lifecycle.browserState))) {
      return Object.freeze({ accepted: false, reason: "lifecycle-not-active" });
    }
    const at = this.#controller?.cursor ?? this.#lastInBounds ?? Object.freeze({ x: 0, y: 0 });
    const held = (this.#accessibleButtons & button.bit) !== 0;
    const requiresGuestEdge = (this.#physicalButtons & button.bit) === 0;
    const commit = () => held ? this.#acceptSourceUp("accessibility", button) :
      this.#acceptSourceDown("accessibility", button);
    const delivered = requiresGuestEdge ?
      this.#deliver({ op: held ? "pointer-up" : "pointer-down", domButton: button.dom, x: at.x, y: at.y, tick,
        generation: this.#generation(), cause: "accessibility" }, commit) :
      (commit(), Object.freeze({ accepted: true,
        reason: held ? "accessibility-source-released-no-edge" : "accessibility-source-acquired-no-edge" }));
    if (!thenable(delivered)) return delivered;
    return this.#trackButtonTransition(this.#pendingAccessibleButtons, name, delivered);
  }

  accessibleMove(dx, dy, { tick = 0n } = {}) {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    if (this.#lifecycle !== null && this.#lifecycle.workerState !== "ACTIVE") {
      return Object.freeze({ accepted: false, reason: "lifecycle-not-active" });
    }
    invariant(Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) <= 1 && Math.abs(dy) <= 1 &&
      (dx !== 0 || dy !== 0), "accessible move must be a nonzero one-pixel vector");
    const cursor = this.#controller?.cursor ?? this.#lastInBounds ?? Object.freeze({ x: 0, y: 0 });
    const target = cadrM9ClampPoint({ x: cursor.x + dx, y: cursor.y + dy });
    return this.#deliver({ op: "pointer-motion", x: target.x, y: target.y, tick,
      generation: this.#generation(), cause: "accessibility" }, () => { this.#lastInBounds = target; });
  }

  releaseAll({ tick = 0n } = {}) {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    if (this.#pendingPhysicalButtons.size > 0 || this.#pendingAccessibleButtons.size > 0) {
      return this.#afterButtonTransitions(() => this.releaseAll({ tick }));
    }
    const delivered = this.#deliver({ op: "pointer-neutralize", cause: "accessibility", tick,
      generation: this.#generation() });
    const finish = outcome => {
      const value = accepted(outcome);
      if (!value.accepted) {
        return this.#failStop(`release-all-neutralization-${value.reason ?? "rejected"}`,
          value.error ?? null);
      }
      this.#clearAcceptedButtons(); this.#releaseCapture();
      if (this.#lifecycle !== null) this.#lifecycle.captureReleased({ hostButtons: 0 });
      return value;
    };
    return thenable(delivered) ? Promise.resolve(delivered).then(finish,
      error => this.#failStop("release-all-neutralization-rejected", error)) : finish(delivered);
  }

  focus() {
    const terminal = this.#terminalRejection();
    if (terminal !== null) return terminal;
    if (this.#pendingDeactivation !== null) {
      return Object.freeze({ accepted: false, reason: "deactivation-pending" });
    }
    return this.#prepareFocus();
  }

  snapshot() {
    return Object.freeze({ profile: CADR_M9_POINTER_PROFILE, transform: this.#transform,
      lastInBounds: this.#lastInBounds, capturedPointerId: this.#capturedPointerId, rebase: this.#rebase,
      physicalButtons: this.#physicalButtons, accessibleButtons: this.#accessibleButtons,
      acceptedButtons: this.#acceptedButtons, acceptedButtonOrder: Object.freeze(this.#acceptedButtonOrder.slice()),
      firstDownPending: this.#pendingFirstDown !== null, deactivationPending: this.#pendingDeactivation !== null,
      physicalButtonTransitionsPending: this.#pendingPhysicalButtons.size,
      accessibleButtonTransitionsPending: this.#pendingAccessibleButtons.size,
      terminalFailure: this.#terminalFailure,
      controller: this.#controller?.snapshot() ?? null, lifecycle: this.#lifecycle?.snapshot() ?? null });
  }

  dispose() {
    this.#releaseCapture(); this.#clearAcceptedButtons(); this.#disposed = true;
    this.#transform = null; this.#rebase = null;
  }
}
