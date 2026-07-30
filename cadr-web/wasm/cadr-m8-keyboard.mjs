/*
 * C-M8 browser keyboard contract.
 *
 * This is intentionally a worker-owned controller contract.  It has no
 * dependency on the CADR core, ABI, scheduler, or dirty worker: a later
 * integration installs this state machine in the worker behind dedicated v6
 * host-originated keyboard operations.
 */

export const CADR_M8_CONTROLLER_VERSION = "C-M8.1";
export const CADR_M8_CORE_ABI = "ABI1.8";
export const CADR_M8_KEYBOARD_PROFILE =
  `CADR-WEB-303/controller-${CADR_M8_CONTROLLER_VERSION}/core-${CADR_M8_CORE_ABI}/protocol-v6/KBD-X11-INFO16-v1`;
export const CADR_M8_PROTOCOL_VERSION = 6;
export const CADR_M8_STATUS_OK = 0;
export const CADR_M8_STATUS_INVALID_ARGUMENT = 2;
export const CADR_M8_STATUS_NOT_READY = 9;
export const CADR_M8_PHYSICAL_KEY_COUNT = 100;
export const CADR_M8_ORDINARY_KEY_COUNT = 82;
export const CADR_M8_PHYSICAL_MODIFIER_COUNT = 18;
export const CADR_M8_SEMANTIC_MODIFIER_BITS = Object.freeze({
  shift: 1 << 0,
  greek: 1 << 1,
  top: 1 << 2,
  capsLock: 1 << 3,
  control: 1 << 4,
  meta: 1 << 5,
  super: 1 << 6,
  hyper: 1 << 7,
  altLock: 1 << 8,
  modeLock: 1 << 9,
  repeat: 1 << 10,
});
export const CADR_M8_SEMANTIC_MODIFIER_MASK = 0x07ff;

/* This frozen profile corrects two values in the maintained SDL3 alternative.
 * It is evidence about that alternate profile, not a runtime fallback. */
export const CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS = Object.freeze({
  profile: "USIM-SDL3-330d8248-alternate-source",
  macro: 0o100,
  call: 0o100,
  repeat: 0o000,
});

const bit = CADR_M8_SEMANTIC_MODIFIER_BITS;

function key(id, code, label, scancode, row, modifier = null) {
  return { id, code, label, scancode, row, modifier };
}

/* The six rows describe the 100 physical Space Cadet keys.  Each descriptor
 * selects host hardware solely through KeyboardEvent.code.  The seven right
 * hand modifier descriptors deliberately retain their distinct physical
 * identity while sharing a semantic modifier bit with their left counterpart. */
const RAW_PHYSICAL_KEYS = [
  key("macro", "F1", "Macro", 0o100, "function"),
  key("terminal", "F2", "Terminal", 0o040, "function"),
  key("quote", "F3", "Quote", 0o120, "function"),
  key("over-strike", "F4", "Overstrike", 0o160, "function"),
  key("clear-input", "F5", "Clear Input", 0o110, "function"),
  key("clear-screen", "F6", "Clear Screen", 0o050, "function"),
  key("hold-output", "F7", "Hold Output", 0o030, "function"),
  key("stop-output", "F8", "Stop Output", 0o170, "function"),
  key("abort", "F9", "Abort", 0o067, "function"),
  key("break", "F10", "Break", 0o167, "function"),
  key("resume", "F11", "Resume", 0o047, "function"),
  key("call", "F12", "Call", 0o107, "function"),

  key("roman-i", "F13", "Roman I", 0o101, "numbers"),
  key("roman-ii", "F14", "Roman II", 0o001, "numbers"),
  key("system", "F15", "System", 0o141, "numbers"),
  key("colon", "F16", "Colon", 0o021, "numbers"),
  key("1", "Digit1", "1", 0o121, "numbers"),
  key("2", "Digit2", "2", 0o061, "numbers"),
  key("3", "Digit3", "3", 0o161, "numbers"),
  key("4", "Digit4", "4", 0o011, "numbers"),
  key("5", "Digit5", "5", 0o111, "numbers"),
  key("6", "Digit6", "6", 0o051, "numbers"),
  key("7", "Digit7", "7", 0o151, "numbers"),
  key("8", "Digit8", "8", 0o031, "numbers"),
  key("9", "Digit9", "9", 0o071, "numbers"),
  key("0", "Digit0", "0", 0o171, "numbers"),
  key("minus", "Minus", "−", 0o131, "numbers"),
  key("equal", "Equal", "=", 0o126, "numbers"),
  key("brace-left", "NumpadDivide", "{", 0o166, "numbers"),
  key("brace-right", "NumpadMultiply", "}", 0o146, "numbers"),
  key("status", "F17", "Status", 0o046, "numbers"),
  key("hand-up", "ArrowUp", "Hand ↑", 0o106, "numbers"),
  key("hand-down", "ArrowDown", "Hand ↓", 0o176, "numbers"),

  key("roman-iii", "F18", "Roman III", 0o102, "upper"),
  key("roman-iv", "F19", "Roman IV", 0o002, "upper"),
  key("network", "F20", "Network", 0o042, "upper"),
  key("tab", "Tab", "Tab", 0o022, "upper"),
  key("q", "KeyQ", "Q", 0o122, "upper"),
  key("w", "KeyW", "W", 0o062, "upper"),
  key("e", "KeyE", "E", 0o162, "upper"),
  key("r", "KeyR", "R", 0o012, "upper"),
  key("t", "KeyT", "T", 0o112, "upper"),
  key("y", "KeyY", "Y", 0o052, "upper"),
  key("u", "KeyU", "U", 0o152, "upper"),
  key("i", "KeyI", "I", 0o032, "upper"),
  key("o", "KeyO", "O", 0o072, "upper"),
  key("p", "KeyP", "P", 0o172, "upper"),
  key("paren-left", "Numpad7", "(", 0o132, "upper"),
  key("paren-right", "Numpad9", ")", 0o137, "upper"),
  key("grave", "Backquote", "`", 0o077, "upper"),
  key("backslash", "Backslash", "\\", 0o037, "upper"),
  key("delete", "Delete", "Delete", 0o157, "upper"),
  key("hand-left", "ArrowLeft", "Hand ←", 0o117, "upper"),
  key("hand-right", "ArrowRight", "Hand →", 0o017, "upper"),

  key("mode-lock", "ScrollLock", "Mode Lock", 0o003, "home", bit.modeLock),
  key("alt-mode", "Escape", "Alt Mode", 0o143, "home"),
  key("rubout", "Backspace", "Rubout", 0o023, "home"),
  key("a", "KeyA", "A", 0o123, "home"),
  key("s", "KeyS", "S", 0o063, "home"),
  key("d", "KeyD", "D", 0o163, "home"),
  key("f", "KeyF", "F", 0o013, "home"),
  key("g", "KeyG", "G", 0o113, "home"),
  key("h", "KeyH", "H", 0o053, "home"),
  key("j", "KeyJ", "J", 0o153, "home"),
  key("k", "KeyK", "K", 0o033, "home"),
  key("l", "KeyL", "L", 0o073, "home"),
  key("semicolon", "Semicolon", ";", 0o173, "home"),
  key("apostrophe", "Quote", "'", 0o133, "home"),
  key("return", "Enter", "Return", 0o136, "home"),
  key("line", "NumpadEnter", "Line", 0o036, "home"),
  key("end", "End", "End", 0o156, "home"),
  key("help", "F21", "Help", 0o116, "home"),

  key("caps-lock", "CapsLock", "Caps Lock", 0o125, "lower", bit.capsLock),
  key("top-left", "F22", "Top", 0o104, "lower", bit.top),
  key("greek-left", "F24", "Greek", 0o044, "lower", bit.greek),
  key("shift-left", "ShiftLeft", "Shift", 0o024, "lower", bit.shift),
  key("z", "KeyZ", "Z", 0o124, "lower"),
  key("x", "KeyX", "X", 0o064, "lower"),
  key("c", "KeyC", "C", 0o164, "lower"),
  key("v", "KeyV", "V", 0o014, "lower"),
  key("b", "KeyB", "B", 0o114, "lower"),
  key("n", "KeyN", "N", 0o054, "lower"),
  key("m", "KeyM", "M", 0o154, "lower"),
  key("comma", "Comma", ",", 0o034, "lower"),
  key("period", "Period", ".", 0o074, "lower"),
  key("slash", "Slash", "/", 0o174, "lower"),
  key("repeat", "Numpad0", "Repeat", 0o115, "lower", bit.repeat),
  key("alt-lock", "NumLock", "Alt Lock", 0o015, "lower", bit.altLock),
  key("top-right", "F23", "Top", 0o155, "lower", bit.top),
  key("greek-right", "NumpadDecimal", "Greek", 0o035, "lower", bit.greek),
  key("shift-right", "ShiftRight", "Shift", 0o025, "lower", bit.shift),

  key("hyper-left", "Numpad4", "Hyper", 0o145, "modifiers", bit.hyper),
  key("super-left", "MetaLeft", "Super", 0o005, "modifiers", bit.super),
  key("meta-left", "AltLeft", "Meta", 0o045, "modifiers", bit.meta),
  key("control-left", "ControlLeft", "Control", 0o020, "modifiers", bit.control),
  key("space", "Space", "Space", 0o134, "modifiers"),
  key("control-right", "ControlRight", "Control", 0o026, "modifiers", bit.control),
  key("meta-right", "AltRight", "Meta", 0o165, "modifiers", bit.meta),
  key("super-right", "MetaRight", "Super", 0o065, "modifiers", bit.super),
  key("hyper-right", "Numpad6", "Hyper", 0o175, "modifiers", bit.hyper),
];

export const CADR_M8_PHYSICAL_KEYS = Object.freeze(RAW_PHYSICAL_KEYS.map((value, index) =>
  Object.freeze({ ...value, index, modifier: value.modifier ?? null })));
export const CADR_M8_ONSCREEN_ROWS = Object.freeze(["function", "numbers", "upper", "home", "lower", "modifiers"].map(row =>
  Object.freeze(CADR_M8_PHYSICAL_KEYS.filter(value => value.row === row))));

const BY_CODE = new Map(CADR_M8_PHYSICAL_KEYS.map(value => [value.code, value]));
const BY_ID = new Map(CADR_M8_PHYSICAL_KEYS.map(value => [value.id, value]));

function invariant(condition, message) {
  if (!condition) throw new TypeError(`C-M8: ${message}`);
}

function u16(value, name) {
  invariant(Number.isInteger(value) && value >= 0 && value <= 0xffff, `${name} must be uint16`);
  return value;
}

function positiveU16(value, name) {
  invariant(Number.isInteger(value) && value >= 1 && value <= 0xffff, `${name} must be 1..65535`);
  return value;
}

function nonModifierHeld(held) {
  for (const id of held) if (BY_ID.get(id).modifier === null) return true;
  return false;
}

export function cadrM8SemanticModifierMask(physicalIds) {
  invariant(physicalIds != null && typeof physicalIds[Symbol.iterator] === "function",
    "physicalIds must be iterable");
  let mask = 0;
  const seen = new Set();
  for (const id of physicalIds) {
    invariant(typeof id === "string" && BY_ID.has(id), "unknown physical key");
    invariant(!seen.has(id), "physical key occurs more than once");
    seen.add(id);
    const modifier = BY_ID.get(id).modifier;
    if (modifier !== null) mask |= modifier;
  }
  return mask;
}

export function cadrM8KeyForCode(code) {
  return typeof code === "string" ? (BY_CODE.get(code) ?? null) : null;
}

function canonicalHeldCodes(heldCodes) {
  invariant(Array.isArray(heldCodes), "heldCodes must be an array");
  const ids = new Set();
  for (const code of heldCodes) {
    const descriptor = cadrM8KeyForCode(code);
    invariant(descriptor !== null, "heldCodes contains an unmapped code");
    invariant(!ids.has(descriptor.id), "heldCodes contains a duplicate code");
    ids.add(descriptor.id);
  }
  return CADR_M8_PHYSICAL_KEYS.filter(value => ids.has(value.id)).map(value => value.code);
}

function snapshotParts(snapshot) {
  invariant(snapshot !== null && typeof snapshot === "object", "snapshot must be an object");
  const queueCapacity = positiveU16(snapshot.queueCapacity, "queueCapacity");
  const heldCodes = canonicalHeldCodes(snapshot.heldCodes);
  invariant(Array.isArray(snapshot.queue), "queue must be an array");
  invariant(snapshot.queue.length <= queueCapacity, "queue exceeds queueCapacity");
  const queue = snapshot.queue.map((value, index) => u16(value, `queue[${index}]`));
  return { queueCapacity, heldCodes, queue };
}

/* CDRM8KB1: a compact, canonical state record for test transport and future
 * worker handoff.  It does not serialize a CADR core object.
 *
 *  0..7 magic, 8..9 schema, 10..11 physical-key count, 12..13 capacity,
 *  14..15 FIFO count, 16..28 physical-held bitset, then FIFO u16 little-endian.
 */
export function serializeCdrM8Kb1(snapshot) {
  const { queueCapacity, heldCodes, queue } = snapshotParts(snapshot);
  const bytes = new Uint8Array(29 + queue.length * 2);
  bytes.set(new TextEncoder().encode("CDRM8KB1"));
  const view = new DataView(bytes.buffer);
  view.setUint16(8, 1, true); view.setUint16(10, CADR_M8_PHYSICAL_KEY_COUNT, true);
  view.setUint16(12, queueCapacity, true); view.setUint16(14, queue.length, true);
  for (const code of heldCodes) {
    const index = cadrM8KeyForCode(code).index;
    bytes[16 + (index >> 3)] |= 1 << (index & 7);
  }
  queue.forEach((value, index) => view.setUint16(29 + index * 2, value, true));
  return bytes;
}

export function parseCdrM8Kb1(input) {
  invariant(input instanceof Uint8Array, "CDRM8KB1 input must be Uint8Array");
  invariant(input.byteLength >= 29, "CDRM8KB1 input is truncated");
  const expectedMagic = new TextEncoder().encode("CDRM8KB1");
  for (let index = 0; index < expectedMagic.length; index += 1) {
    invariant(input[index] === expectedMagic[index], "CDRM8KB1 magic is invalid");
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  invariant(view.getUint16(8, true) === 1 && view.getUint16(10, true) === CADR_M8_PHYSICAL_KEY_COUNT,
    "CDRM8KB1 schema is invalid");
  const queueCapacity = positiveU16(view.getUint16(12, true), "CDRM8KB1 queueCapacity");
  const queueCount = view.getUint16(14, true);
  invariant(queueCount <= queueCapacity && input.byteLength === 29 + queueCount * 2,
    "CDRM8KB1 length or queue count is invalid");
  invariant((input[28] & 0xf0) === 0, "CDRM8KB1 held padding is nonzero");
  const heldCodes = [];
  for (const descriptor of CADR_M8_PHYSICAL_KEYS) {
    if ((input[16 + (descriptor.index >> 3)] & (1 << (descriptor.index & 7))) !== 0) {
      heldCodes.push(descriptor.code);
    }
  }
  const queue = [];
  for (let index = 0; index < queueCount; index += 1) queue.push(view.getUint16(29 + index * 2, true));
  return Object.freeze({ profile: CADR_M8_KEYBOARD_PROFILE, queueCapacity,
    heldCodes: Object.freeze(heldCodes), queue: Object.freeze(queue) });
}

export class CadrM8KeyboardController {
  #held = new Set();
  #queue = [];

  /* This state belongs to the v6 worker endpoint. Direct construction is a
   * synthetic-test seam, not permission for a browser main thread to retain
   * guest keyboard state. */
  constructor({ queueCapacity = 64 } = {}) {
    this.queueCapacity = positiveU16(queueCapacity, "queueCapacity");
  }

  get queueLength() { return this.#queue.length; }

  snapshot() {
    return Object.freeze({ profile: CADR_M8_KEYBOARD_PROFILE, queueCapacity: this.queueCapacity,
      heldCodes: Object.freeze(CADR_M8_PHYSICAL_KEYS.filter(value => this.#held.has(value.id)).map(value => value.code)),
      queue: Object.freeze(this.#queue.slice()) });
  }

  serialize() { return serializeCdrM8Kb1(this.snapshot()); }

  static fromSerialized(bytes) {
    const state = parseCdrM8Kb1(bytes);
    const controller = new CadrM8KeyboardController({ queueCapacity: state.queueCapacity });
    for (const code of state.heldCodes) controller.#held.add(cadrM8KeyForCode(code).id);
    controller.#queue.push(...state.queue);
    return controller;
  }

  #result(accepted, reason, emitted = null) {
    return Object.freeze({ accepted, reason, emitted });
  }

  #reserveOne() { return this.#queue.length < this.queueCapacity; }

  keyDown({ code, repeat = false }) {
    const descriptor = cadrM8KeyForCode(code);
    if (descriptor === null) return this.#result(false, "unmapped");
    if (repeat === true) return this.#result(false, "dom-repeat");
    if (repeat !== false) return this.#result(false, "invalid-repeat");
    if (this.#held.has(descriptor.id)) return this.#result(false, "already-held");
    if (!this.#reserveOne()) return this.#result(false, "queue-full");
    this.#held.add(descriptor.id);
    this.#queue.push(descriptor.scancode);
    return this.#result(true, "down", descriptor.scancode);
  }

  keyUp({ code }) {
    const descriptor = cadrM8KeyForCode(code);
    if (descriptor === null) return this.#result(false, "unmapped");
    if (!this.#held.has(descriptor.id)) return this.#result(false, "not-held");
    if (!this.#reserveOne()) return this.#result(false, "queue-full");
    const nextHeld = new Set(this.#held);
    nextHeld.delete(descriptor.id);
    const emitted = nonModifierHeld(nextHeld) ? (0x0100 | descriptor.scancode) :
      (0x8000 | cadrM8SemanticModifierMask(nextHeld));
    this.#held = nextHeld;
    this.#queue.push(emitted);
    return this.#result(true, emitted & 0x8000 ? "all-up" : "up", emitted);
  }

  focusLost() {
    /* Reserve first: a full queue leaves physical state untouched.  Once
     * reserved, exactly one zero-modifier all-up event and the clear commit
     * occur together, regardless of which keys were held. */
    if (!this.#reserveOne()) return this.#result(false, "queue-full");
    this.#held.clear();
    this.#queue.push(0x8000);
    return this.#result(true, "focus-all-up", 0x8000);
  }

  /* The composed M8/M9 worker owns the all-up record during shared
   * deactivation.  Clear only the host-held set after that complete tail has
   * crossed the core boundary, so pointer capture loss and window blur cannot
   * leave stale M8 keys or enqueue two all-up records. */
  clearHeldForSharedDeactivation() {
    const heldKeysCleared = this.#held.size;
    this.#held.clear();
    return Object.freeze({ heldKeysCleared });
  }

  drain(maxEvents = this.#queue.length) {
    invariant(Number.isInteger(maxEvents) && maxEvents >= 0, "maxEvents must be a nonnegative integer");
    return this.#queue.splice(0, Math.min(maxEvents, this.#queue.length));
  }
}

function plainRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function protocolId(value) { return Number.isInteger(value) && value >= 1 && value <= 0xffffffff; }
function onlyFields(value, fields) { return Object.keys(value).every(key => fields.includes(key)); }

function controllerStatus(result) {
  if (result.accepted) return CADR_M8_STATUS_OK;
  return result.reason === "queue-full" ? CADR_M8_STATUS_NOT_READY :
    CADR_M8_STATUS_INVALID_ARGUMENT;
}

export class CadrM8KeyboardProtocolSubhandler {
  /* Models only the M8 branch of the v6 worker endpoint. The real worker owns
   * global request sequencing and all non-M8 dispatch. `handle()` returns null
   * for a request which this branch must preserve for another handler. */
  constructor({ controller = new CadrM8KeyboardController() } = {}) {
    invariant(controller instanceof CadrM8KeyboardController, "controller must be CadrM8KeyboardController");
    this.controller = controller;
  }

  #response(id, op, status, extra = {}) {
    const numericStatus = status >>> 0;
    return Object.freeze({ type: "cadr-response", version: CADR_M8_PROTOCOL_VERSION,
      id, op, status: numericStatus, ok: numericStatus === CADR_M8_STATUS_OK, ...extra });
  }

  handle(request) {
    if (!plainRecord(request) || request.version !== CADR_M8_PROTOCOL_VERSION ||
        !protocolId(request.id) || typeof request.op !== "string") return null;
    const { id, op } = request;
    /* Existing sequence-break and clock scheduler events remain owned by the
     * generic worker path. Only a batch containing kind 3 is an M8 violation. */
    if (op === "scheduler-events") {
      if (!Array.isArray(request.events) ||
          !request.events.some(event => plainRecord(event) && event.kind === 3)) return null;
      return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
        { reason: "v6-keyboard-is-host-only" });
    }
    if (op === "scheduler-keyboard-event") {
      return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
        { reason: "v6-keyboard-is-host-only" });
    }
    if (op === "keyboard-down") {
      if (!onlyFields(request, ["version", "id", "op", "code", "repeat"]) || typeof request.code !== "string" ||
          (request.repeat !== undefined && typeof request.repeat !== "boolean")) {
        return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
          { reason: "invalid-keyboard-down" });
      }
      const result = this.controller.keyDown({ code: request.code, repeat: request.repeat ?? false });
      return this.#response(id, op, controllerStatus(result),
        { result, ...(result.accepted ? {} : { reason: result.reason }) });
    }
    if (op === "keyboard-up") {
      if (!onlyFields(request, ["version", "id", "op", "code"]) || typeof request.code !== "string") {
        return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
          { reason: "invalid-keyboard-up" });
      }
      const result = this.controller.keyUp({ code: request.code });
      return this.#response(id, op, controllerStatus(result),
        { result, ...(result.accepted ? {} : { reason: result.reason }) });
    }
    if (op === "keyboard-focus-lost") {
      if (!onlyFields(request, ["version", "id", "op"])) {
        return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
          { reason: "invalid-keyboard-focus-lost" });
      }
      const result = this.controller.focusLost();
      return this.#response(id, op, controllerStatus(result),
        { result, ...(result.accepted ? {} : { reason: result.reason }) });
    }
    if (op === "keyboard-drain") {
      const maxEvents = request.maxEvents ?? this.controller.queueLength;
      if (!onlyFields(request, ["version", "id", "op", "maxEvents"]) || !Number.isInteger(maxEvents) || maxEvents < 0) {
        return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
          { reason: "invalid-drain-count" });
      }
      return this.#response(id, op, CADR_M8_STATUS_OK,
        { result: Object.freeze({ events: Object.freeze(this.controller.drain(maxEvents)) }) });
    }
    if (op === "keyboard-state") {
      if (!onlyFields(request, ["version", "id", "op"])) {
        return this.#response(id, op, CADR_M8_STATUS_INVALID_ARGUMENT,
          { reason: "invalid-keyboard-state" });
      }
      return this.#response(id, op, CADR_M8_STATUS_OK,
        { result: this.controller.snapshot() });
    }
    return null;
  }
}

function validateProfile() {
  invariant(CADR_M8_PHYSICAL_KEYS.length === CADR_M8_PHYSICAL_KEY_COUNT, "physical key count differs from profile");
  invariant(new Set(CADR_M8_PHYSICAL_KEYS.map(value => value.id)).size === CADR_M8_PHYSICAL_KEY_COUNT,
    "physical ids are not unique");
  invariant(BY_CODE.size === CADR_M8_PHYSICAL_KEY_COUNT, "KeyboardEvent.code values are not unique");
  invariant(CADR_M8_PHYSICAL_KEYS.filter(value => value.modifier === null).length === CADR_M8_ORDINARY_KEY_COUNT,
    "ordinary key count differs from profile");
  invariant(CADR_M8_PHYSICAL_KEYS.filter(value => value.modifier !== null).length === CADR_M8_PHYSICAL_MODIFIER_COUNT,
    "modifier key count differs from profile");
  invariant(CADR_M8_PHYSICAL_KEYS.find(value => value.id === "macro").scancode === 0o100,
    "Macro scancode differs from profile");
  invariant(CADR_M8_PHYSICAL_KEYS.find(value => value.id === "call").scancode === 0o107,
    "Call scancode differs from profile");
  invariant(CADR_M8_PHYSICAL_KEYS.find(value => value.id === "repeat").scancode === 0o115,
    "Repeat scancode differs from profile");
}

validateProfile();
