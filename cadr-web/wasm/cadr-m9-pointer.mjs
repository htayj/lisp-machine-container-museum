/*
 * C-M9 browser pointer contract.
 *
 * This is deliberately a host-owned, protocol-v6 seam.  It does not add an
 * ABI entrypoint, scheduler kind, or CADR core mutation.  A later bridge must
 * consume the typed entries at complete machine boundaries.
 */

export const CADR_M9_CONTROLLER_VERSION = "C-M9.1";
export const CADR_M9_CORE_ABI = "ABI1.8";
export const CADR_M9_POINTER_PROFILE =
  `CADR-WEB-303/controller-${CADR_M9_CONTROLLER_VERSION}/core-${CADR_M9_CORE_ABI}/protocol-v6/PTR-X11-EDGE32-v1`;
export const CADR_M9_PROTOCOL_VERSION = 6;
export const CADR_M9_STATUS_OK = 0;
export const CADR_M9_STATUS_INVALID_ARGUMENT = 2;
export const CADR_M9_STATUS_NOT_READY = 9;
export const CADR_M9_WIDTH = 768;
export const CADR_M9_HEIGHT = 963;
export const CADR_M9_POINTER_QUEUE_CAPACITY = 64;
export const CADR_M9_POINTER_ORDINARY_CAPACITY = 60;
export const CADR_M9_SCHEDULER_KIND_POINTER = 4;
export const CADR_M9_KEYBOARD_ALL_UP = 0x8000;
export const CADR_M9_COALESCING_BARRIER_KINDS = Object.freeze([
  "edge", "warp", "keyboard", "clock", "lifecycle", "tick", "generation",
]);

export const CADR_M9_BUTTONS = Object.freeze([
  Object.freeze({ name: "tail", bit: 1, x11: 1, dom: 0 }),
  Object.freeze({ name: "middle", bit: 2, x11: 2, dom: 1 }),
  Object.freeze({ name: "head", bit: 4, x11: 3, dom: 2 }),
]);

export const CADR_M9_EDGE_CAUSES = Object.freeze({
  physical: 0,
  "capture-loss": 1,
  lifecycle: 2,
  accessibility: 3,
});

const BUTTON_BY_DOM = new Map(CADR_M9_BUTTONS.map(button => [button.dom, button]));
const BUTTON_BY_NAME = new Map(CADR_M9_BUTTONS.map(button => [button.name, button]));
const MAX_U32 = 0xffffffff;
const MAX_U64 = 0xffffffffffffffffn;

function invariant(condition, message) {
  if (!condition) throw new TypeError(`C-M9: ${message}`);
}

function u32(value, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= MAX_U32, `${name} must be uint32`);
  return value;
}

function u64(value, name) {
  invariant(typeof value === "bigint" && value >= 0n && value <= MAX_U64, `${name} must be uint64`);
  return value;
}

function coordinate(value, maximum, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= maximum, `${name} is outside EDGE32`);
  return value;
}

function causeNumber(value) {
  if (typeof value === "string" && Object.hasOwn(CADR_M9_EDGE_CAUSES, value)) {
    return CADR_M9_EDGE_CAUSES[value];
  }
  invariant(Number.isInteger(value) && value >= 0 && value <= 3, "edge cause is invalid");
  return value;
}

function causeName(value) {
  return Object.entries(CADR_M9_EDGE_CAUSES).find(([, number]) => number === value)[0];
}

function canonicalCause(value) { return causeName(causeNumber(value)); }

function point(value) {
  invariant(value !== null && typeof value === "object", "point must be an object");
  return Object.freeze({ x: coordinate(value.x, CADR_M9_WIDTH - 1, "x"),
    y: coordinate(value.y, CADR_M9_HEIGHT - 1, "y") });
}

function sharedIngress(value, generation, nextOrdinal) {
  const tick = value.tick ?? 0n;
  const suppliedGeneration = value.generation ?? generation;
  const ordinal = value.ingressOrdinal ?? nextOrdinal;
  return Object.freeze({ tick: u64(tick, "tick"), generation: u32(suppliedGeneration, "generation"),
    ingressOrdinal: u64(ordinal, "ingressOrdinal") });
}

function result(accepted, reason, extra = {}) {
  return Object.freeze({ accepted, reason, ...extra });
}

function frozenQueueEntry(type, fields) {
  return Object.freeze({ type, ...fields });
}

/** Return the selected X11/S46 descriptor for a DOM PointerEvent button. */
export function cadrM9ButtonForDom(domButton) {
  return Number.isInteger(domButton) ? (BUTTON_BY_DOM.get(domButton) ?? null) : null;
}

/** Return a descriptor by the profile's historical tail/middle/head vocabulary. */
export function cadrM9ButtonForName(name) {
  return typeof name === "string" ? (BUTTON_BY_NAME.get(name) ?? null) : null;
}

export function cadrM9ClampPoint(value) {
  invariant(value !== null && typeof value === "object", "point must be an object");
  invariant(Number.isFinite(value.x) && Number.isFinite(value.y), "point must be finite");
  return Object.freeze({ x: Math.min(CADR_M9_WIDTH - 1, Math.max(0, Math.trunc(value.x))),
    y: Math.min(CADR_M9_HEIGHT - 1, Math.max(0, Math.trunc(value.y))) });
}

/**
 * EDGE32 is little-endian-neutral as a JavaScript number: x bits 0..9, y bits
 * 10..19, buttons-after bits 20..22, one-hot changed bit 23..25, cause 26..27.
 */
export function encodeCadrM9Edge32({ x, y, buttonsAfter, changedMask = 0, cause = "physical" }) {
  coordinate(x, CADR_M9_WIDTH - 1, "x"); coordinate(y, CADR_M9_HEIGHT - 1, "y");
  invariant(Number.isInteger(buttonsAfter) && buttonsAfter >= 0 && buttonsAfter <= 7,
    "buttonsAfter must be a three-bit mask");
  invariant(Number.isInteger(changedMask) && changedMask >= 0 && changedMask <= 7,
    "changedMask must be a three-bit mask");
  invariant(changedMask === 0 || (changedMask & (changedMask - 1)) === 0,
    "changedMask must be zero or one-hot");
  const encodedCause = causeNumber(cause);
  return (x | (y << 10) | (buttonsAfter << 20) | (changedMask << 23) |
    (encodedCause << 26)) >>> 0;
}

export function decodeCadrM9Edge32(value) {
  const word = u32(value, "EDGE32 value");
  invariant((word & 0xf0000000) === 0, "EDGE32 reserved bits are nonzero");
  const x = word & 0x3ff; const y = (word >>> 10) & 0x3ff;
  invariant(x < CADR_M9_WIDTH && y < CADR_M9_HEIGHT, "EDGE32 coordinate is outside the selected display");
  const changedMask = (word >>> 23) & 7;
  invariant(changedMask === 0 || (changedMask & (changedMask - 1)) === 0,
    "EDGE32 changed mask is not one-hot");
  return Object.freeze({ x, y,
    buttonsAfter: (word >>> 20) & 7, changedMask, cause: causeName((word >>> 26) & 3) });
}

/**
 * Host-side queue for the future kind-4 ingress bridge.  It reserves exactly
 * four cells: three LIFO pointer releases and one M8 all-up.  The final item
 * is typed instead of pretending that it has already reached the M8 core.
 */
export class CadrM9PointerController {
  #queue = [];
  #buttons = 0;
  #heldOrder = [];
  #cursor = Object.freeze({ x: 0, y: 0 });
  #generation;
  #nextOrdinal = 1n;
  #stalled = false;
  #warp = null;
  #barrierToken = 0n;
  #lastBarrier = null;
  #lastIngressTick = null;
  #lastIngressGeneration = null;

  constructor({ generation = 0 } = {}) {
    this.#generation = u32(generation, "generation");
  }

  get generation() { return this.#generation; }
  get queueLength() { return this.#queue.length; }
  get buttons() { return this.#buttons; }
  get stalled() { return this.#stalled; }
  get cursor() { return this.#cursor; }
  get heldButtonNames() { return Object.freeze(this.#heldOrder.map(button => button.name)); }

  #prepareIngress(value) {
    const ingress = sharedIngress(value, this.#generation, this.#nextOrdinal);
    if (ingress.generation !== this.#generation) return result(false, "stale-generation");
    if (ingress.ingressOrdinal < this.#nextOrdinal) return result(false, "stale-ingress-ordinal");
    if (ingress.ingressOrdinal === MAX_U64) return result(false, "ingress-ordinal-exhausted");
    return Object.freeze({ accepted: true, ingress });
  }

  #bumpBarrier(kind) {
    invariant(CADR_M9_COALESCING_BARRIER_KINDS.includes(kind), "unknown coalescing barrier");
    this.#barrierToken += 1n;
    this.#lastBarrier = Object.freeze({ kind, token: this.#barrierToken });
  }

  #commitIngress(ingress) {
    if (this.#lastIngressGeneration !== null && ingress.generation !== this.#lastIngressGeneration) {
      this.#bumpBarrier("generation");
    }
    if (this.#lastIngressTick !== null && ingress.tick !== this.#lastIngressTick) {
      this.#bumpBarrier("tick");
    }
    this.#lastIngressGeneration = ingress.generation;
    this.#lastIngressTick = ingress.tick;
    this.#nextOrdinal = ingress.ingressOrdinal + 1n;
  }

  #ordinaryRoom() { return this.#queue.length < CADR_M9_POINTER_ORDINARY_CAPACITY; }

  #edgeEntry(at, buttonsAfter, changedMask, cause, ingress) {
    const value = encodeCadrM9Edge32({ ...at, buttonsAfter, changedMask, cause });
    return frozenQueueEntry("pointer-edge", { kind: CADR_M9_SCHEDULER_KIND_POINTER,
      value, edge: decodeCadrM9Edge32(value), coalescingBarrierToken: this.#barrierToken, ...ingress });
  }

  #motionEntry(at, ingress, cause = "physical") {
    const value = encodeCadrM9Edge32({ ...at, buttonsAfter: this.#buttons, changedMask: 0, cause });
    return frozenQueueEntry("pointer-motion", { kind: CADR_M9_SCHEDULER_KIND_POINTER,
      value, edge: decodeCadrM9Edge32(value), coalescingBarrierToken: this.#barrierToken, ...ingress });
  }

  #pressure(reason = "capacity-pressure") {
    this.#stalled = true;
    return result(false, reason, { action: "pause-stall" });
  }

  #accept(entry, detail = {}) {
    this.#queue.push(entry);
    this.#stalled = false;
    return result(true, entry.type === "pointer-motion" ? "motion" : "edge", { entry, ...detail });
  }

  #eventPoint(value) {
    if (value.x === undefined && value.y === undefined) return this.#cursor;
    invariant(value.x !== undefined && value.y !== undefined, "edge coordinates must be supplied together");
    return point(value);
  }

  motion(value) {
    invariant(value !== null && typeof value === "object", "motion must be an object");
    const at = point(value); const cause = canonicalCause(value.cause ?? "physical");
    const prepared = this.#prepareIngress(value);
    if (!prepared.accepted) return prepared;
    const { ingress } = prepared;
    const last = this.#queue.at(-1);
    const coalescible = last?.type === "pointer-motion" && last.tick === ingress.tick &&
      last.generation === ingress.generation &&
      last.coalescingBarrierToken === this.#barrierToken;
    if (!coalescible && !this.#ordinaryRoom()) return this.#pressure();
    this.#commitIngress(ingress);
    if (coalescible) {
      /* Preserve the first shared ingress ordinal: no keyboard, edge, clock,
       * lifecycle, or warp barrier lay between the two physical motions. */
      const replacement = this.#motionEntry(at, Object.freeze({ ...ingress,
        ingressOrdinal: last.ingressOrdinal }), cause);
      this.#queue[this.#queue.length - 1] = replacement;
      this.#cursor = at; this.#stalled = false;
      return result(true, "motion-coalesced", { entry: replacement });
    }
    this.#cursor = at;
    return this.#accept(this.#motionEntry(at, ingress, cause));
  }

  buttonDown(value) {
    invariant(value !== null && typeof value === "object", "button down must be an object");
    const button = cadrM9ButtonForDom(value.domButton);
    if (button === null) return result(false, "unmapped-button");
    const at = this.#eventPoint(value); const cause = canonicalCause(value.cause ?? "physical");
    const prepared = this.#prepareIngress(value);
    if (!prepared.accepted) return prepared;
    if ((this.#buttons & button.bit) !== 0) return result(false, "duplicate-down");
    if (!this.#ordinaryRoom()) return this.#pressure();
    const { ingress } = prepared;
    this.#commitIngress(ingress); this.#bumpBarrier("edge");
    const after = this.#buttons | button.bit;
    const entry = this.#edgeEntry(at, after, button.bit, cause, ingress);
    this.#buttons = after; this.#heldOrder.push(button); this.#cursor = at;
    return this.#accept(entry, { button: button.name });
  }

  buttonUp(value) {
    invariant(value !== null && typeof value === "object", "button up must be an object");
    const button = cadrM9ButtonForDom(value.domButton);
    if (button === null) return result(false, "unmapped-button");
    const at = this.#eventPoint(value); const cause = canonicalCause(value.cause ?? "physical");
    const prepared = this.#prepareIngress(value);
    if (!prepared.accepted) return prepared;
    if ((this.#buttons & button.bit) === 0) return result(false, "not-held");
    if (!this.#ordinaryRoom()) return this.#pressure();
    const { ingress } = prepared;
    this.#commitIngress(ingress); this.#bumpBarrier("edge");
    const after = this.#buttons & ~button.bit;
    const entry = this.#edgeEntry(at, after, button.bit, cause, ingress);
    this.#buttons = after;
    this.#heldOrder = this.#heldOrder.filter(candidate => candidate !== button);
    this.#cursor = at;
    return this.#accept(entry, { button: button.name });
  }

  /** One logical pixel move for an accessibility control, with intentional clamp. */
  accessibilityMove({ dx, dy, ...ingress } = {}) {
    invariant(Number.isInteger(dx) && Number.isInteger(dy) &&
      Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0),
    "accessibility move must be a nonzero one-pixel vector");
    return this.motion({ ...cadrM9ClampPoint({ x: this.#cursor.x + dx, y: this.#cursor.y + dy }),
      ...ingress, cause: "accessibility" });
  }

  /**
   * Commit the deactivation tail as one mutation.  It never writes a partial
   * release sequence: if the four-cell emergency reservation is unavailable,
   * nothing changes and the caller must fail-stop rather than advance guest
   * execution past a potentially held input state.
   */
  neutralize({ cause = "lifecycle", tick = 0n, generation = this.#generation } = {}) {
    const canonical = canonicalCause(cause);
    const prepared = this.#prepareIngress({ tick, generation });
    if (!prepared.accepted) return prepared;
    const { ingress } = prepared;
    const releaseCount = this.#heldOrder.length;
    const required = releaseCount + 1; /* M8 zero-modifier all-up follows pointer ups. */
    if (ingress.ingressOrdinal + BigInt(required) > MAX_U64) {
      return result(false, "ingress-ordinal-exhausted", { action: "fail-stop" });
    }
    if (this.#queue.length + required > CADR_M9_POINTER_QUEUE_CAPACITY) {
      return result(false, "emergency-reservation-exhausted", { action: "fail-stop" });
    }
    this.#commitIngress(ingress); this.#bumpBarrier("lifecycle");
    const entries = [];
    let after = this.#buttons;
    let ordinal = ingress.ingressOrdinal;
    for (const button of [...this.#heldOrder].reverse()) {
      after &= ~button.bit;
      const edgeIngress = Object.freeze({ ...ingress, ingressOrdinal: ordinal });
      entries.push(this.#edgeEntry(this.#cursor, after, button.bit, canonical, edgeIngress));
      ordinal += 1n;
    }
    this.#bumpBarrier("keyboard");
    entries.push(frozenQueueEntry("keyboard-all-up", { kind: "keyboard-all-up",
      value: CADR_M9_KEYBOARD_ALL_UP, tick: ingress.tick, generation: ingress.generation,
      ingressOrdinal: ordinal, cause: canonical, coalescingBarrierToken: this.#barrierToken }));
    this.#queue.push(...entries); this.#buttons = 0; this.#heldOrder = [];
    this.#stalled = false;
    this.#nextOrdinal = this.#nextOrdinal > ordinal ? this.#nextOrdinal : ordinal + 1n;
    return result(true, "neutralized", { entries: Object.freeze(entries) });
  }

  /**
   * Capture loss is a worker-side epoch transaction: validate the next epoch,
   * commit the complete neutralization tail, then advance generation before
   * returning.  The preflight makes the post-neutralization advance infallible.
   */
  neutralizeAndAdvanceGeneration({ cause = "capture-loss", tick = 0n,
    generation = this.#generation } = {}) {
    canonicalCause(cause); u64(tick, "tick");
    const priorGeneration = u32(generation, "generation");
    if (priorGeneration !== this.#generation) return result(false, "stale-generation");
    if (priorGeneration === MAX_U32) {
      return result(false, "epoch-exhausted", { action: "fail-stop" });
    }
    const nextGeneration = priorGeneration + 1;
    const neutralized = this.neutralize({ cause, tick, generation: priorGeneration });
    if (!neutralized.accepted) return neutralized;
    this.advanceGeneration(nextGeneration);
    return result(true, "neutralized-generation-advanced", {
      entries: neutralized.entries, priorGeneration, nextGeneration,
    });
  }

  /** A cursor-state value of 3 requests a logical rebase; no OS cursor warp. */
  requestWarp({ cursorState, x, y, generation = this.#generation } = {}) {
    if (cursorState !== 3) return result(false, "cursor-state-not-warp");
    if (u32(generation, "generation") !== this.#generation) return result(false, "stale-generation");
    const target = cadrM9ClampPoint({ x, y });
    this.#bumpBarrier("warp");
    this.#warp = Object.freeze({ x: target.x, y: target.y, generation: this.#generation,
      previousCursorState: cursorState });
    return result(true, "warp-rebase-requested", { warp: this.#warp });
  }

  warpRequest() { return this.#warp; }
  clearWarpRequest() { const request = this.#warp; this.#warp = null; return request; }

  coalescingBarrier(kind, { generation = this.#generation } = {}) {
    invariant(["keyboard", "clock", "lifecycle", "warp"].includes(kind),
      "external barrier must be keyboard, clock, lifecycle, or warp");
    if (u32(generation, "generation") !== this.#generation) return result(false, "stale-generation");
    this.#bumpBarrier(kind);
    return result(true, "coalescing-barrier", { kind, token: this.#barrierToken });
  }

  advanceGeneration(generation = this.#generation + 1) {
    const next = u32(generation, "generation");
    if (next !== this.#generation) this.#bumpBarrier("generation");
    this.#generation = next;
    this.#warp = null; this.#stalled = false;
    return this.#generation;
  }

  clearHostState({ generation = this.#generation } = {}) {
    this.#queue = []; this.#buttons = 0; this.#heldOrder = []; this.#cursor = Object.freeze({ x: 0, y: 0 });
    this.#warp = null; this.#stalled = false; this.#generation = u32(generation, "generation");
    this.#lastIngressTick = null; this.#lastIngressGeneration = null;
    this.#bumpBarrier("generation");
  }

  discardForTerminal() {
    this.#queue = []; this.#buttons = 0; this.#heldOrder = []; this.#warp = null; this.#stalled = false;
  }

  drain(maxEntries = this.#queue.length) {
    invariant(Number.isInteger(maxEntries) && maxEntries >= 0, "drain count must be nonnegative");
    return Object.freeze(this.#queue.splice(0, Math.min(maxEntries, this.#queue.length)));
  }

  snapshot() {
    return Object.freeze({ profile: CADR_M9_POINTER_PROFILE, generation: this.#generation,
      queueCapacity: CADR_M9_POINTER_QUEUE_CAPACITY, ordinaryCapacity: CADR_M9_POINTER_ORDINARY_CAPACITY,
      queue: Object.freeze(this.#queue.slice()), buttons: this.#buttons,
      heldButtonNames: this.heldButtonNames, cursor: this.#cursor, stalled: this.#stalled,
      warp: this.#warp, nextIngressOrdinal: this.#nextOrdinal,
      coalescingBarrierToken: this.#barrierToken, lastCoalescingBarrier: this.#lastBarrier });
  }
}

function plainRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function protocolId(value) { return Number.isInteger(value) && value >= 1 && value <= MAX_U32; }
function onlyFields(value, fields) { return Object.keys(value).every(key => fields.includes(key)); }

function controllerStatus(value) {
  if (value.accepted) return CADR_M9_STATUS_OK;
  return ["capacity-pressure", "emergency-reservation-exhausted", "stale-generation"].includes(value.reason) ?
    CADR_M9_STATUS_NOT_READY : CADR_M9_STATUS_INVALID_ARGUMENT;
}

/** Isolated branch of the protocol-v6 worker dispatcher. */
export class CadrM9PointerProtocolSubhandler {
  constructor({ controller = new CadrM9PointerController() } = {}) {
    invariant(controller instanceof CadrM9PointerController, "controller must be CadrM9PointerController");
    this.controller = controller;
  }

  #response(id, op, status, extra = {}) {
    const numericStatus = status >>> 0;
    return Object.freeze({ type: "cadr-response", version: CADR_M9_PROTOCOL_VERSION, id, op,
      status: numericStatus, ok: numericStatus === CADR_M9_STATUS_OK, ...extra });
  }

  #result(id, op, value) {
    const status = controllerStatus(value);
    return this.#response(id, op, status, { result: value, ...(value.accepted ? {} : { reason: value.reason }) });
  }

  handle(request) {
    if (!plainRecord(request) || request.version !== CADR_M9_PROTOCOL_VERSION ||
        !protocolId(request.id) || typeof request.op !== "string") return null;
    const { id, op } = request;
    if (op === "scheduler-events") {
      if (!Array.isArray(request.events) || !request.events.some(event => plainRecord(event) &&
          (event.kind === 3 || event.kind === CADR_M9_SCHEDULER_KIND_POINTER))) return null;
      return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "v6-input-is-host-only" });
    }
    const ingressFields = ["tick", "generation", "ingressOrdinal"];
    if (op === "pointer-motion") {
      if (!onlyFields(request, ["version", "id", "op", "x", "y", "cause", ...ingressFields]) ||
          !Number.isInteger(request.x) || !Number.isInteger(request.y) ||
          (request.cause !== undefined && typeof request.cause !== "string")) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-motion" });
      }
      try { return this.#result(id, op, this.controller.motion(request)); }
      catch { return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-motion" }); }
    }
    if (op === "pointer-down" || op === "pointer-up") {
      if (!onlyFields(request, ["version", "id", "op", "domButton", "x", "y", "cause", ...ingressFields]) ||
          !Number.isInteger(request.domButton) ||
          (op === "pointer-down" && (!Number.isInteger(request.x) || !Number.isInteger(request.y))) ||
          (op === "pointer-up" && !((request.x === undefined && request.y === undefined) ||
            (Number.isInteger(request.x) && Number.isInteger(request.y)))) ||
          (request.cause !== undefined && typeof request.cause !== "string")) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: `invalid-${op}` });
      }
      try { return this.#result(id, op, op === "pointer-down" ?
        this.controller.buttonDown(request) : this.controller.buttonUp(request)); }
      catch { return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: `invalid-${op}` }); }
    }
    if (op === "pointer-neutralize") {
      if (!onlyFields(request, ["version", "id", "op", "cause", "tick", "generation"]) ||
          (request.cause !== undefined && typeof request.cause !== "string")) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-neutralize" });
      }
      try {
        return this.#result(id, op, request.cause === "capture-loss" ?
          this.controller.neutralizeAndAdvanceGeneration(request) :
          this.controller.neutralize(request));
      }
      catch { return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-neutralize" }); }
    }
    if (op === "pointer-warp-request") {
      if (!onlyFields(request, ["version", "id", "op", "cursorState", "x", "y", "generation"]) ||
          !Number.isInteger(request.cursorState) || !Number.isInteger(request.x) || !Number.isInteger(request.y)) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-warp-request" });
      }
      try { return this.#result(id, op, this.controller.requestWarp(request)); }
      catch { return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-warp-request" }); }
    }
    if (op === "pointer-drain") {
      const maxEntries = request.maxEntries ?? this.controller.queueLength;
      if (!onlyFields(request, ["version", "id", "op", "maxEntries"]) ||
          !Number.isInteger(maxEntries) || maxEntries < 0) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-drain" });
      }
      return this.#response(id, op, CADR_M9_STATUS_OK, { result: Object.freeze({ entries: this.controller.drain(maxEntries) }) });
    }
    if (op === "pointer-state") {
      if (!onlyFields(request, ["version", "id", "op"])) {
        return this.#response(id, op, CADR_M9_STATUS_INVALID_ARGUMENT, { reason: "invalid-pointer-state" });
      }
      return this.#response(id, op, CADR_M9_STATUS_OK, { result: this.controller.snapshot() });
    }
    return null;
  }
}
