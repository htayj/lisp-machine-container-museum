import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  CADR_M8_KEYBOARD_PROFILE,
  CADR_M8_ONSCREEN_ROWS,
  CADR_M8_ORDINARY_KEY_COUNT,
  CADR_M8_PHYSICAL_KEY_COUNT,
  CADR_M8_PHYSICAL_KEYS,
  CADR_M8_PHYSICAL_MODIFIER_COUNT,
  CADR_M8_PROTOCOL_VERSION,
  CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS,
  CADR_M8_SEMANTIC_MODIFIER_BITS,
  CADR_M8_STATUS_INVALID_ARGUMENT,
  CADR_M8_STATUS_NOT_READY,
  CADR_M8_STATUS_OK,
  CadrM8KeyboardController,
  CadrM8KeyboardProtocolSubhandler,
  cadrM8KeyForCode,
  cadrM8SemanticModifierMask,
  parseCdrM8Kb1,
  serializeCdrM8Kb1,
} from "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import { createCadrM8OnscreenKeyboard } from "../cadr-web/browser/cadr-m8-onscreen-keyboard.mjs";

const modifiers = CADR_M8_PHYSICAL_KEYS.filter(value => value.modifier !== null);
const ordinary = CADR_M8_PHYSICAL_KEYS.filter(value => value.modifier === null);

function mapDigest() {
  const canonical = CADR_M8_PHYSICAL_KEYS.map(({ id, code, scancode, row, modifier }) =>
    [id, code, scancode, row, modifier]);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function testProfileAndEveryPhysicalRow() {
  assert.equal(CADR_M8_KEYBOARD_PROFILE, "CADR-WEB-303/ABI1.5/protocol-v6/C-M8-KBD-X11-INFO16-v1");
  assert.equal(CADR_M8_PHYSICAL_KEYS.length, CADR_M8_PHYSICAL_KEY_COUNT);
  assert.equal(ordinary.length, CADR_M8_ORDINARY_KEY_COUNT);
  assert.equal(modifiers.length, CADR_M8_PHYSICAL_MODIFIER_COUNT);
  assert.deepEqual(CADR_M8_ONSCREEN_ROWS.map(row => row.length), [12, 21, 21, 18, 19, 9]);
  assert.equal(new Set(CADR_M8_ONSCREEN_ROWS.flat()).size, CADR_M8_PHYSICAL_KEY_COUNT);
  assert.equal(mapDigest(), "20fedd72bcd51d9e9726e03f41ce5e315f7c9b6a2bee1b1dd9d65a62f05a0e70", "the complete 100-key golden table is stable");

  /* Exhaust every physical descriptor through its DOM-code lookup and edge
   * transition. Each independent release is an all-up without modifiers. */
  for (const descriptor of CADR_M8_PHYSICAL_KEYS) {
    assert.equal(cadrM8KeyForCode(descriptor.code), descriptor, descriptor.id);
    const controller = new CadrM8KeyboardController({ queueCapacity: 2 });
    assert.deepEqual(controller.keyDown({ code: descriptor.code }),
      { accepted: true, reason: "down", emitted: descriptor.scancode }, descriptor.id);
    assert.deepEqual(controller.keyUp({ code: descriptor.code }),
      { accepted: true, reason: "all-up", emitted: 0x8000 }, descriptor.id);
    assert.deepEqual(controller.drain(), [descriptor.scancode, 0x8000], descriptor.id);
  }
}

function testGoldenAndAlternateSourceDefects() {
  const byId = new Map(CADR_M8_PHYSICAL_KEYS.map(value => [value.id, value]));
  assert.equal(byId.get("macro").scancode, 0o100);
  assert.equal(byId.get("call").scancode, 0o107);
  assert.equal(byId.get("repeat").scancode, 0o115);
  assert.equal(CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS.macro, 0o100);
  assert.equal(CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS.call, 0o100);
  assert.equal(CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS.repeat, 0o000);
  assert.notEqual(byId.get("call").scancode, CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS.call,
    "the selected X11/System-46 profile must not inherit SDL3's Macro/Call collision");
  assert.notEqual(byId.get("repeat").scancode, CADR_M8_SDL3_ALTERNATE_SOURCE_DEFECTS.repeat,
    "the selected X11/System-46 profile must not inherit SDL3 Repeat zero");

  const keyboardSource = readFileSync(new URL("../cadr-web/wasm/cadr-m8-keyboard.mjs", import.meta.url), "utf8");
  const onscreenSource = readFileSync(new URL("../cadr-web/browser/cadr-m8-onscreen-keyboard.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(keyboardSource, /event\.key/);
  assert.doesNotMatch(onscreenSource, /event\.key/);
  assert.doesNotMatch(keyboardSource, /event\s*\[\s*["']key["']\s*\]/);
  assert.doesNotMatch(onscreenSource, /event\s*\[\s*["']key["']\s*\]/);

  const codeWins = new CadrM8KeyboardController({ queueCapacity: 1 });
  assert.equal(codeWins.keyDown({ code: "KeyQ", key: "KeyZ", repeat: false }).emitted, 0o122,
    "physical selection uses code even when a conflicting computed key field is present");
}

class FakeElement {
  constructor(ownerDocument, name) {
    this.ownerDocument = ownerDocument; this.name = name; this.dataset = {}; this.children = [];
    this.listeners = new Map(); this.attributes = new Map(); this.className = "";
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? []; listeners.push(listener); this.listeners.set(type, listeners);
  }
}

async function testOnscreenKeyboardRepresentsEveryPhysicalKeyAndRetainsReleaseOwnership() {
  const documentObject = { createElement(name) { return new FakeElement(documentObject, name); } };
  const root = new FakeElement(documentObject, "root");
  const controller = new CadrM8KeyboardController({ queueCapacity: 4 });
  const view = createCadrM8OnscreenKeyboard({ root, controller });
  assert.equal(root.children.length, 1);
  assert.equal(view.element.dataset.cadrM8PhysicalKeyCount, "100");
  const rows = view.element.children;
  assert.deepEqual(rows.map(row => row.children.length), [12, 21, 21, 18, 19, 9]);
  const buttons = rows.flatMap(row => row.children);
  assert.equal(buttons.length, 100);
  assert.equal(new Set(buttons.map(button => button.dataset.code)).size, 100);
  const q = buttons.find(button => button.dataset.code === "KeyQ");
  q.listeners.get("pointerdown")[0]({ preventDefault() {} });
  q.listeners.get("pointerup")[0]();
  assert.deepEqual(controller.drain(), [0o122, 0x8000]);
  await view.dispose(); assert.deepEqual(root.children, []);

  const fullRoot = new FakeElement(documentObject, "root");
  const fullController = new CadrM8KeyboardController({ queueCapacity: 1 });
  const fullView = createCadrM8OnscreenKeyboard({ root: fullRoot, controller: fullController });
  const fullQ = fullView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  fullQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  fullQ.listeners.get("pointerup")[0]();
  assert.deepEqual(fullView.pendingReleaseCodes(), ["KeyQ"],
    "queue-full up retains onscreen ownership");
  assert.deepEqual(fullController.snapshot().heldCodes, ["KeyQ"]);
  assert.deepEqual(fullController.drain(), [0o122]);
  await fullView.dispose();
  assert.deepEqual(fullController.snapshot().heldCodes, [],
    "dispose retries the retained release after capacity becomes available");
  assert.deepEqual(fullController.drain(), [0x8000]);
  assert.deepEqual(fullView.pendingReleaseCodes(), []);

  const asyncRoot = new FakeElement(documentObject, "root");
  const asyncController = new CadrM8KeyboardController({ queueCapacity: 4 });
  const asyncProtocol = new CadrM8KeyboardProtocolSubhandler({ controller: asyncController });
  let asyncId = 1;
  const asyncView = createCadrM8OnscreenKeyboard({
    root: asyncRoot,
    submitKeyboardOperation(operation) {
      return Promise.resolve(asyncProtocol.handle(
        { version: 6, id: asyncId++, ...operation }));
    },
  });
  const asyncQ = asyncView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  asyncQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  asyncQ.listeners.get("pointerup")[0]();
  await asyncView.retryPendingReleases();
  assert.deepEqual(asyncController.snapshot().heldCodes, [],
    "an up requested before asynchronous down acceptance is eventually confirmed");
  assert.deepEqual(asyncController.drain(), [0o122, 0x8000]);
  await asyncView.dispose();

  const asyncFullRoot = new FakeElement(documentObject, "root");
  const asyncFullController = new CadrM8KeyboardController({ queueCapacity: 1 });
  const asyncFullProtocol = new CadrM8KeyboardProtocolSubhandler({
    controller: asyncFullController,
  });
  let asyncFullId = 1;
  const asyncFullView = createCadrM8OnscreenKeyboard({
    root: asyncFullRoot,
    submitKeyboardOperation(operation) {
      return Promise.resolve(asyncFullProtocol.handle(
        { version: 6, id: asyncFullId++, ...operation }));
    },
  });
  const asyncFullQ = asyncFullView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  asyncFullQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  asyncFullQ.listeners.get("pointerup")[0]();
  await asyncFullView.retryPendingReleases();
  assert.deepEqual(asyncFullView.pendingReleaseCodes(), ["KeyQ"],
    "an asynchronous queue-full response also retains release ownership");
  asyncFullController.drain();
  await asyncFullView.retryPendingReleases();
  assert.deepEqual(asyncFullController.snapshot().heldCodes, []);
  assert.deepEqual(asyncFullController.drain(), [0x8000]);
  await asyncFullView.dispose();

  const focusRoot = new FakeElement(documentObject, "root");
  const focusController = new CadrM8KeyboardController({ queueCapacity: 6 });
  const focusProtocol = new CadrM8KeyboardProtocolSubhandler({
    controller: focusController,
  });
  let focusId = 1;
  const focusView = createCadrM8OnscreenKeyboard({
    root: focusRoot,
    submitKeyboardOperation(operation) {
      return focusProtocol.handle({ version: 6, id: focusId++, ...operation });
    },
  });
  const focusQ = focusView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  focusQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  const focusLost = focusProtocol.handle({
    version: 6, id: focusId++, op: "keyboard-focus-lost",
  });
  assert.equal(focusLost.result.accepted, true);
  assert.deepEqual(focusController.snapshot().heldCodes, []);
  focusQ.listeners.get("pointerup")[0]();
  assert.deepEqual(focusView.pendingReleaseCodes(), [],
    "canonical not-held after atomic focus recovery converges onscreen ownership");
  focusQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  assert.deepEqual(focusController.snapshot().heldCodes, ["KeyQ"],
    "the converged physical code can be pressed again");
  focusQ.listeners.get("pointerup")[0]();
  assert.deepEqual(focusController.drain(), [0o122, 0x8000, 0o122, 0x8000]);
  await focusView.dispose();

  const unknownRoot = new FakeElement(documentObject, "root");
  const unknownController = new CadrM8KeyboardController({ queueCapacity: 4 });
  const unknownProtocol = new CadrM8KeyboardProtocolSubhandler({
    controller: unknownController,
  });
  let unknownId = 1;
  let loseFirstDownResult = true;
  const unknownView = createCadrM8OnscreenKeyboard({
    root: unknownRoot,
    submitKeyboardOperation(operation) {
      if (loseFirstDownResult && operation.op === "keyboard-down") {
        loseFirstDownResult = false;
        throw new Error("simulated unknown down transport");
      }
      return unknownProtocol.handle({ version: 6, id: unknownId++, ...operation });
    },
  });
  const unknownQ = unknownView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  unknownQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  unknownQ.listeners.get("pointerup")[0]();
  assert.deepEqual(unknownView.pendingReleaseCodes(), [],
    "definitive canonical not-held reconciles an unknown down transport outcome");
  unknownQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  assert.deepEqual(unknownController.snapshot().heldCodes, ["KeyQ"],
    "unknown-down reconciliation permits a later press");
  unknownQ.listeners.get("pointerup")[0]();
  assert.deepEqual(unknownController.drain(), [0o122, 0x8000]);
  await unknownView.dispose();

  const rawRoot = new FakeElement(documentObject, "root");
  const rawController = new CadrM8KeyboardController({ queueCapacity: 4 });
  const rawView = createCadrM8OnscreenKeyboard({ root: rawRoot, controller: rawController });
  const rawQ = rawView.element.children.flatMap(row => row.children)
    .find(button => button.dataset.code === "KeyQ");
  rawQ.listeners.get("pointerdown")[0]({ preventDefault() {} });
  assert.equal(rawController.focusLost().accepted, true);
  rawQ.listeners.get("pointerup")[0]();
  assert.deepEqual(rawView.pendingReleaseCodes(), ["KeyQ"],
    "a raw not-held subresult is not the exact canonical convergence proof");
  await rawView.dispose();
}

function testAllPhysicalModifierSubsets() {
  const count = 1 << modifiers.length;
  for (let subset = 0; subset < count; subset += 1) {
    const ids = [];
    let expected = 0;
    for (let position = 0; position < modifiers.length; position += 1) {
      if ((subset & (1 << position)) === 0) continue;
      ids.push(modifiers[position].id);
      expected |= modifiers[position].modifier;
    }
    assert.equal(cadrM8SemanticModifierMask(ids), expected, `modifier subset ${subset}`);
  }
}

function testEveryOrdinaryTargetUnderEverySemanticModifierMask() {
  const semanticBits = Object.values(CADR_M8_SEMANTIC_MODIFIER_BITS);
  const representatives = semanticBits.map((value) => modifiers.find(key => key.modifier === value));
  assert.equal(representatives.length, 11);
  assert.ok(representatives.every(Boolean));
  for (let semanticMask = 0; semanticMask < (1 << semanticBits.length); semanticMask += 1) {
    const active = representatives.filter((_, index) => (semanticMask & (1 << index)) !== 0);
    for (const target of ordinary) {
      const controller = new CadrM8KeyboardController({ queueCapacity: 16 });
      for (const modifier of active) assert.equal(controller.keyDown({ code: modifier.code }).accepted, true);
      assert.equal(controller.keyDown({ code: target.code }).emitted, target.scancode);
      const release = controller.keyUp({ code: target.code });
      assert.deepEqual(release, { accepted: true, reason: "all-up", emitted: 0x8000 | semanticMask },
        `${target.id} under semantic modifiers ${semanticMask.toString(8)}`);
    }
  }
}

function testRolloverOrderingAndFailures() {
  const controller = new CadrM8KeyboardController({ queueCapacity: 8 });
  const q = cadrM8KeyForCode("KeyQ"); const w = cadrM8KeyForCode("KeyW");
  const shift = cadrM8KeyForCode("ShiftLeft"); const control = cadrM8KeyForCode("ControlLeft");
  assert.equal(controller.keyDown({ code: q.code }).emitted, q.scancode);
  assert.equal(controller.keyDown({ code: w.code }).emitted, w.scancode);
  assert.equal(controller.keyUp({ code: q.code }).emitted, 0x0100 | q.scancode,
    "releasing one of two ordinary keys emits an up/down-up word");
  assert.equal(controller.keyDown({ code: control.code }).emitted, control.scancode);
  assert.equal(controller.keyUp({ code: control.code }).emitted, 0x0100 | control.scancode,
    "a modifier released while an ordinary key remains held is an up/down-up word");
  assert.equal(controller.keyDown({ code: shift.code }).emitted, shift.scancode);
  assert.equal(controller.keyUp({ code: w.code }).emitted,
    0x8000 | CADR_M8_SEMANTIC_MODIFIER_BITS.shift,
    "last ordinary release emits an all-up semantic modifier mask");
  assert.deepEqual(controller.snapshot().heldCodes, [shift.code]);
  assert.equal(controller.keyUp({ code: shift.code }).emitted, 0x8000);

  const duplicate = new CadrM8KeyboardController({ queueCapacity: 2 });
  assert.equal(duplicate.keyDown({ code: q.code }).accepted, true);
  assert.equal(duplicate.keyDown({ code: q.code }).reason, "already-held");
  assert.equal(duplicate.keyDown({ code: w.code, repeat: true }).reason, "dom-repeat");
  assert.equal(duplicate.keyDown({ code: "Unidentified" }).reason, "unmapped");
  assert.equal(duplicate.keyUp({ code: w.code }).reason, "not-held");
  assert.equal(duplicate.keyDown({ code: w.code, repeat: "true" }).reason, "invalid-repeat");

  const capacity = new CadrM8KeyboardController({ queueCapacity: 1 });
  assert.equal(capacity.keyDown({ code: q.code }).accepted, true);
  const beforeFailedUp = capacity.snapshot();
  assert.equal(capacity.keyUp({ code: q.code }).reason, "queue-full");
  assert.deepEqual(capacity.snapshot(), beforeFailedUp, "full release leaves held state and queue unchanged");
  assert.equal(capacity.keyDown({ code: w.code }).reason, "queue-full");
  assert.deepEqual(capacity.snapshot(), beforeFailedUp, "full down leaves held state and queue unchanged");
  capacity.drain();
  assert.equal(capacity.keyUp({ code: q.code }).emitted, 0x8000);
}

function testFocusLossAtomicity() {
  const q = cadrM8KeyForCode("KeyQ"); const control = cadrM8KeyForCode("ControlLeft");
  const controller = new CadrM8KeyboardController({ queueCapacity: 4 });
  controller.keyDown({ code: control.code }); controller.keyDown({ code: q.code });
  const lost = controller.focusLost();
  assert.deepEqual(lost, { accepted: true, reason: "focus-all-up", emitted: 0x8000 });
  assert.deepEqual(controller.snapshot().heldCodes, []);
  assert.deepEqual(controller.drain(), [control.scancode, q.scancode, 0x8000],
    "focus loss appends exactly one final zero-modifier all-up word");

  const full = new CadrM8KeyboardController({ queueCapacity: 1 });
  full.keyDown({ code: q.code });
  const before = full.snapshot();
  assert.equal(full.focusLost().reason, "queue-full");
  assert.deepEqual(full.snapshot(), before, "focus loss reserves output capacity before clearing held state");
  full.drain();
  assert.equal(full.focusLost().emitted, 0x8000);
  assert.deepEqual(full.drain(), [0x8000], "no-key focus loss still emits exactly the final all-up word");
}

function testCanonicalSerialization() {
  const first = { queueCapacity: 4, heldCodes: ["ShiftRight", "ControlLeft", "ShiftLeft"], queue: [0o24, 0x8003] };
  const second = { queueCapacity: 4, heldCodes: ["ControlLeft", "ShiftLeft", "ShiftRight"], queue: [0o24, 0x8003] };
  const encoded = serializeCdrM8Kb1(first);
  assert.deepEqual(encoded, serializeCdrM8Kb1(second), "held insertion order has no serialized representation");
  const decoded = parseCdrM8Kb1(encoded);
  assert.equal(decoded.profile, CADR_M8_KEYBOARD_PROFILE);
  assert.deepEqual(decoded.heldCodes, ["ShiftLeft", "ShiftRight", "ControlLeft"]);
  assert.deepEqual(serializeCdrM8Kb1(decoded), encoded, "parser only accepts/re-emits the canonical state form");
  const restored = CadrM8KeyboardController.fromSerialized(encoded);
  assert.deepEqual(restored.snapshot(), decoded);
  const noncanonicalPadding = encoded.slice(); noncanonicalPadding[28] |= 0x80;
  assert.throws(() => parseCdrM8Kb1(noncanonicalPadding), /padding/);
  const malformedLength = encoded.slice(0, -1);
  assert.throws(() => parseCdrM8Kb1(malformedLength), /length or queue count/);
}

function testV6HostOnlyProtocol() {
  const protocol = new CadrM8KeyboardProtocolSubhandler({
    controller: new CadrM8KeyboardController({ queueCapacity: 4 }),
  });
  const generic = protocol.handle({ version: CADR_M8_PROTOCOL_VERSION, id: 1, op: "scheduler-events",
    events: [{ kind: 3, value: 1 }] });
  assert.deepEqual(generic, { type: "cadr-response", version: 6, id: 1, op: "scheduler-events",
    status: CADR_M8_STATUS_INVALID_ARGUMENT, ok: false, reason: "v6-keyboard-is-host-only" });
  assert.equal(protocol.handle({ version: 6, id: 2, op: "scheduler-events",
    events: [{ kind: 1, value: 0 }] }), null, "sequence break stays on the generic scheduler path");
  assert.equal(protocol.handle({ version: 6, id: 3, op: "scheduler-events",
    events: [{ kind: 2, value: 1 }] }), null, "clock stays on the generic scheduler path");
  assert.equal(protocol.handle({ version: 6, id: 4, op: "scheduler-events",
    events: [{ kind: 1, value: 0 }, { kind: 2, value: 1 }] }), null,
  "mixed non-keyboard events stay on the generic scheduler path");
  const mixed = protocol.handle({ version: 6, id: 5, op: "scheduler-events",
    events: [{ kind: 1, value: 0 }, { kind: 3, value: 0o122 }, { kind: 2, value: 1 }] });
  assert.equal(mixed.status, CADR_M8_STATUS_INVALID_ARGUMENT);
  assert.equal(mixed.ok, false);
  const down = protocol.handle({ version: 6, id: 2, op: "keyboard-down", code: "KeyQ" });
  assert.equal(down.type, "cadr-response"); assert.equal(down.status, CADR_M8_STATUS_OK);
  assert.equal(down.ok, true); assert.equal(down.result.emitted, 0o122);
  const state = protocol.handle({ version: 6, id: 3, op: "keyboard-state" });
  assert.equal(state.result.profile, CADR_M8_KEYBOARD_PROFILE);
  const drain = protocol.handle({ version: 6, id: 4, op: "keyboard-drain", maxEvents: 1 });
  assert.deepEqual(drain.result.events, [0o122]);
  const malformedId = protocol.handle({ version: 6, id: 6, op: "keyboard-focus-lost" });
  assert.equal(malformedId.status, CADR_M8_STATUS_OK,
    "global request ordering is outside the M8 sub-handler");

  const strict = new CadrM8KeyboardProtocolSubhandler();
  const extra = strict.handle({ version: 6, id: 1, op: "keyboard-focus-lost", stray: true });
  assert.equal(extra.status, CADR_M8_STATUS_INVALID_ARGUMENT);
  assert.equal(extra.reason, "invalid-keyboard-focus-lost", "v6 operations reject unframed extra fields");
  const capacity = new CadrM8KeyboardProtocolSubhandler({
    controller: new CadrM8KeyboardController({ queueCapacity: 1 }),
  });
  assert.equal(capacity.handle({ version: 6, id: 1, op: "keyboard-down", code: "KeyQ" }).status,
    CADR_M8_STATUS_OK);
  const fullUp = capacity.handle({ version: 6, id: 2, op: "keyboard-up", code: "KeyQ" });
  assert.equal(fullUp.status, CADR_M8_STATUS_NOT_READY);
  assert.equal(fullUp.ok, false);
}

testProfileAndEveryPhysicalRow();
testGoldenAndAlternateSourceDefects();
await testOnscreenKeyboardRepresentsEveryPhysicalKeyAndRetainsReleaseOwnership();
testAllPhysicalModifierSubsets();
testEveryOrdinaryTargetUnderEverySemanticModifierMask();
testRolloverOrderingAndFailures();
testFocusLossAtomicity();
testCanonicalSerialization();
testV6HostOnlyProtocol();
console.log("cadr M8 keyboard tests passed");
