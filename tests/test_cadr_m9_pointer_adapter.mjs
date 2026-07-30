import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CadrM9InteractiveLifecycle } from "../cadr-web/wasm/cadr-m9-interactive-lifecycle.mjs";
import {
  CadrM9PointerController,
  CadrM9PointerProtocolSubhandler,
} from "../cadr-web/wasm/cadr-m9-pointer.mjs";
import {
  CadrM9PointerAdapter,
  cadrM9ClientToLogical,
  createCadrM9PointerTransform,
} from "../cadr-web/browser/cadr-m9-pointer-adapter.mjs";
import { createCadrM9PointerControls } from "../cadr-web/browser/cadr-m9-pointer-controls.mjs";

const transform = createCadrM9PointerTransform({ contentLeft: 101.25, contentTop: 77.5,
  letterboxLeft: 9, letterboxTop: 11, scale: 1, epoch: 0 });
const mouseEvent = fields => ({ pointerType: "mouse", isPrimary: true, pointerId: 1, ...fields });

/* Every logical EDGE32 coordinate maps back through the half-open unrotated
 * rectangle.  No device-pixel-ratio and no edge clamp enter this test. */
for (let y = 0; y < 963; y += 1) {
  for (let x = 0; x < 768; x += 1) {
    assert.deepEqual(cadrM9ClientToLogical(transform, { clientX: 110.25 + x, clientY: 88.5 + y }),
      { x, y, epoch: 0 });
  }
}
assert.equal(cadrM9ClientToLogical(transform, { clientX: 110.249999, clientY: 88.5 }), null);
assert.equal(cadrM9ClientToLogical(transform, { clientX: 878.25, clientY: 88.5 }), null);
assert.equal(cadrM9ClientToLogical(transform, { clientX: 110.25, clientY: 1051.5 }), null);
const scaleThree = createCadrM9PointerTransform({ contentLeft: 0, contentTop: 0, scale: 3, epoch: 7 });
assert.deepEqual(cadrM9ClientToLogical(scaleThree, { clientX: 2303.999, clientY: 2888.999, epoch: 7 }),
  { x: 767, y: 962, epoch: 7 });
assert.throws(() => cadrM9ClientToLogical(scaleThree, { clientX: 0, clientY: 0, epoch: 6 }), /stale/);
for (const bad of [
  { contentLeft: 0, contentTop: 0, scale: 0, epoch: 0 },
  { contentLeft: 0, contentTop: 0, scale: 1.5, epoch: 0 },
  { contentLeft: NaN, contentTop: 0, scale: 1, epoch: 0 },
  { contentLeft: 0, contentTop: 0, scale: 1, epoch: -1 },
]) assert.throws(() => createCadrM9PointerTransform(bad));

{
  const controller = new CadrM9PointerController(); const lifecycle = new CadrM9InteractiveLifecycle({ pointer: controller });
  lifecycle.enable({ visible: true, layoutValid: true, focused: false });
  const order = [];
  const target = {
    setPointerCapture(id) { order.push(`capture-${id}`); },
    releasePointerCapture(id) { order.push(`release-${id}`); },
  };
  const adapter = new CadrM9PointerAdapter({ controller, lifecycle, captureTarget: target,
    focusGuest() { order.push("focus"); return true; } });
  adapter.setTransform(transform);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 4, button: 0, clientX: 120.25, clientY: 108.5, tick: 1n })).accepted, true);
  assert.deepEqual(order, ["focus", "capture-4"], "focus/capture precede the first guest edge");
  assert.equal(lifecycle.browserState, "CAPTURED");
  assert.equal(controller.snapshot().queue.length, 1, "focus does not consume or invent a pointer motion");
  assert.equal(controller.snapshot().queue[0].edge.x, 10);
  assert.equal(adapter.pointerMove(mouseEvent({ pointerId: 4, clientX: 878.25, clientY: 200, tick: 1n })).reason,
    "outside-or-stale-layout", "outside captured motion is not delivered");
  assert.equal(controller.snapshot().queue.length, 1);
  assert.equal(adapter.pointerMove(mouseEvent({ pointerId: 4, clientX: 130.25, clientY: 118.5, tick: 1n })).accepted, true);
  assert.equal(adapter.pointerUp(mouseEvent({ pointerId: 4, button: 0, clientX: 9999, clientY: 9999, tick: 1n })).accepted, true,
    "outside release uses the last in-bounds coordinate");
  assert.deepEqual(order, ["focus", "capture-4", "release-4"]);
  assert.equal(lifecycle.browserState, "ACTIVE");
  const edges = controller.drain();
  assert.equal(edges.at(-1).edge.x, 20); assert.equal(edges.at(-1).edge.y, 30);

  /* Exhaust all DOM mappings through the adapter rather than merely through
   * the controller.  A held button preserves capture until its own up. */
  for (const domButton of [0, 1, 2]) {
    assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 8, button: domButton, clientX: 111.25, clientY: 89.5 })).accepted, true);
    assert.equal(controller.buttons, 1 << domButton);
    assert.equal(adapter.pointerUp(mouseEvent({ pointerId: 8, button: domButton, clientX: 111.25, clientY: 89.5 })).accepted, true);
  }

  adapter.pointerDown(mouseEvent({ pointerId: 9, button: 0, clientX: 115.25, clientY: 93.5 }));
  assert.equal(adapter.lostPointerCapture(mouseEvent({ pointerId: 9, tick: 22n })).accepted, true);
  assert.equal(lifecycle.workerState, "PAUSED");
  assert.equal(adapter.pointerMove(mouseEvent({ pointerId: 9, clientX: 116.25, clientY: 94.5 })).reason,
    "lifecycle-not-active", "a prior-epoch transform cannot deliver after deactivation");
  assert.equal(controller.drain().at(-1).type, "keyboard-all-up");
  adapter.dispose();
}

{
  const controller = new CadrM9PointerController();
  const adapter = new CadrM9PointerAdapter({ controller }); adapter.setTransform(transform);
  assert.equal(adapter.pointerMove(mouseEvent({ clientX: 130.25, clientY: 108.5, tick: 1n })).accepted, true);
  assert.equal(controller.requestWarp({ cursorState: 3, x: 700, y: 900 }).accepted, true);
  assert.equal(adapter.consumeWarpRebase().accepted, true);
  assert.equal(adapter.pointerMove(mouseEvent({ clientX: 131.25, clientY: 108.5, tick: 2n })).accepted, true);
  assert.deepEqual(controller.snapshot().queue.at(-1).edge, { x: 701, y: 900, buttonsAfter: 0,
    changedMask: 0, cause: "physical" });
  assert.equal(adapter.invalidateTransform().accepted, true);
  assert.equal(adapter.pointerMove(mouseEvent({ clientX: 131.25, clientY: 108.5 })).reason, "outside-or-stale-layout");
}

function deferred() {
  let resolve; let reject;
  const promise = new Promise((accept, deny) => { resolve = accept; reject = deny; });
  return { promise, resolve, reject };
}

function protocolSubmit({ responses = null, calls = [] } = {}) {
  const handler = new CadrM9PointerProtocolSubhandler();
  return {
    calls,
    handler,
    submit(request) {
      calls.push(request);
      if (responses !== null && responses.length > 0) return responses.shift();
      return handler.handle(request);
    },
  };
}

/* Production submission mode maintains only accepted local host state.  DOM
 * capture follows the remote response, including rollback on rejected down. */
{
  const capture = [];
  const target = {
    setPointerCapture(id) { capture.push(`capture-${id}`); },
    releasePointerCapture(id) { capture.push(`release-${id}`); },
  };
  const remote = protocolSubmit();
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    captureTarget: target });
  adapter.setTransform(transform);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 31, button: 0,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  assert.equal(adapter.acceptedButtons, 1);
  assert.equal(adapter.capturedPointerId, 31);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 31, button: 2,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  assert.equal(adapter.acceptedButtons, 5);
  assert.equal(adapter.pointerUp(mouseEvent({ pointerId: 31, button: 0,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  assert.equal(adapter.acceptedButtons, 4);
  assert.equal(adapter.capturedPointerId, 31, "capture remains while one accepted button is held");
  assert.equal(adapter.pointerUp(mouseEvent({ pointerId: 31, button: 2,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  assert.equal(adapter.acceptedButtons, 0);
  assert.equal(adapter.capturedPointerId, null);
  assert.deepEqual(capture, ["capture-31", "release-31"]);
}

{
  const capture = [];
  const remote = protocolSubmit({ responses: [
    Object.freeze({ ok: false, reason: "synthetic-worker-rejection" }),
  ] });
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    captureTarget: {
      setPointerCapture(id) { capture.push(`capture-${id}`); },
      releasePointerCapture(id) { capture.push(`release-${id}`); },
    } });
  adapter.setTransform(transform);
  const rejected = adapter.pointerDown(mouseEvent({ pointerId: 32, button: 0,
    clientX: 111.25, clientY: 89.5 }));
  assert.equal(rejected.accepted, false);
  assert.equal(adapter.acceptedButtons, 0);
  assert.equal(adapter.capturedPointerId, null);
  assert.deepEqual(capture, ["capture-32", "release-32"]);
}

/* Submitted capture loss commits remote neutralization before bridging the
 * local lifecycle to a fresh paused epoch and invalidating the old transform. */
{
  const lifecyclePointer = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer: lifecyclePointer });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  const remote = protocolSubmit();
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    lifecycle, captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 51, button: 0,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  assert.equal(lifecycle.browserState, "CAPTURED");
  const lost = adapter.lostPointerCapture(mouseEvent({ pointerId: 51, tick: 8n }));
  assert.equal(lost.accepted, true);
  assert.equal(lost.priorGeneration, 0);
  assert.equal(lost.nextGeneration, 1);
  assert.equal(remote.handler.controller.buttons, 0);
  assert.equal(remote.handler.controller.snapshot().queue.at(-1).type, "keyboard-all-up");
  assert.equal(remote.handler.controller.generation, 1);
  assert.equal(lifecycle.browserState, "SUSPENDED");
  assert.equal(lifecycle.workerState, "PAUSED");
  assert.equal(lifecycle.epoch, 1);
  assert.equal(lifecycle.pointer.generation, 1);
  assert.equal(adapter.transform, null);
  assert.equal(adapter.acceptedButtons, 0);
  assert.equal(adapter.pointerMove(mouseEvent({ pointerId: 51,
    clientX: 112.25, clientY: 90.5 })).reason, "lifecycle-not-active");
  const drained = remote.handler.handle({ version: 6, id: 90, op: "pointer-drain" });
  assert.equal(drained.ok, true);
  assert.deepEqual(drained.result.entries.slice(-2).map(entry => entry.type),
    ["pointer-edge", "keyboard-all-up"]);
  assert.equal(lifecycle.acknowledgeNeutralization().accepted, true);
  assert.equal(lifecycle.resume().accepted, true);
  const epochOneTransform = createCadrM9PointerTransform({ contentLeft: 101.25, contentTop: 77.5,
    letterboxLeft: 9, letterboxTop: 11, scale: 1, epoch: 1 });
  adapter.setTransform(epochOneTransform);
  const resumedMotion = adapter.pointerMove(mouseEvent({ pointerId: 51,
    clientX: 112.25, clientY: 90.5, tick: 9n }));
  assert.equal(resumedMotion.accepted, true);
  assert.equal(remote.handler.controller.generation, lifecycle.epoch);
  assert.equal(remote.handler.controller.snapshot().queue.at(-1).generation, 1);
}

{
  const lifecyclePointer = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer: lifecyclePointer });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  const remote = protocolSubmit({ responses: [
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "edge" }) }),
    Object.freeze({ ok: false, reason: "synthetic-neutralization-rejection" }),
  ] });
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    lifecycle, captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 52, button: 0,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  const rejected = adapter.lostPointerCapture(mouseEvent({ pointerId: 52, tick: 9n }));
  assert.equal(rejected.accepted, false); assert.equal(rejected.action, "fail-stop");
  assert.equal(lifecycle.browserState, "TERMINAL");
  assert.equal(lifecycle.workerState, "FAILED");
  assert.equal(adapter.transform, null);
  assert.equal(adapter.accessibleMove(1, 0).reason, "terminal");
}

{
  const lifecyclePointer = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer: lifecyclePointer });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  const remote = protocolSubmit({ responses: [
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "edge" }) }),
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true,
      reason: "neutralized-generation-advanced", priorGeneration: 0, nextGeneration: 2 }) }),
  ] });
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    lifecycle, captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  adapter.pointerDown(mouseEvent({ pointerId: 53, button: 0, clientX: 111.25, clientY: 89.5 }));
  const mismatch = adapter.lostPointerCapture(mouseEvent({ pointerId: 53 }));
  assert.equal(mismatch.accepted, false); assert.equal(mismatch.action, "fail-stop");
  assert.equal(lifecycle.browserState, "TERMINAL");
  assert.equal(lifecycle.workerState, "FAILED");
}

/* A physical hold and an accessibility hold are independent owners of one
 * aggregate guest bit.  Either acquisition order emits exactly one guest down
 * and either release order emits exactly one final guest up. */
for (const firstSource of ["accessibility", "physical"]) {
  const capture = [];
  const remote = protocolSubmit();
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    captureTarget: {
      setPointerCapture(id) { capture.push(`capture-${id}`); },
      releasePointerCapture(id) { capture.push(`release-${id}`); },
    } });
  adapter.setTransform(transform);
  const physicalDown = () => adapter.pointerDown(mouseEvent({ pointerId: 61, button: 0,
    clientX: 111.25, clientY: 89.5 }));
  const physicalUp = () => adapter.pointerUp(mouseEvent({ pointerId: 61, button: 0,
    clientX: 111.25, clientY: 89.5 }));
  if (firstSource === "accessibility") {
    assert.equal(adapter.accessibleButton("tail").accepted, true);
    assert.equal(physicalDown().accepted, true);
    assert.equal(adapter.physicalButtons, 1);
    assert.equal(adapter.accessibleButtons, 1);
    assert.equal(adapter.acceptedButtons, 1);
    assert.equal(physicalUp().accepted, true);
    assert.equal(adapter.acceptedButtons, 1);
    assert.equal(adapter.capturedPointerId, null);
    assert.equal(adapter.accessibleButton("tail").accepted, true);
  } else {
    assert.equal(physicalDown().accepted, true);
    assert.equal(adapter.accessibleButton("tail").accepted, true);
    assert.equal(physicalUp().accepted, true);
    assert.equal(adapter.acceptedButtons, 1);
    assert.equal(adapter.capturedPointerId, null);
    assert.equal(adapter.accessibleButton("tail").accepted, true);
  }
  assert.equal(adapter.physicalButtons, 0);
  assert.equal(adapter.accessibleButtons, 0);
  assert.equal(adapter.acceptedButtons, 0);
  assert.deepEqual(remote.calls.map(call => call.op), ["pointer-down", "pointer-up"]);
  assert.deepEqual(capture, ["capture-61", "release-61"]);
}

for (const firstSource of ["accessibility", "physical"]) {
  const firstAcceptance = deferred(); const calls = [];
  const adapter = new CadrM9PointerAdapter({
    submitPointerOperation(request) {
      calls.push(request.op);
      return calls.length === 1 ? firstAcceptance.promise :
        Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "accepted" }) });
    },
    captureTarget: { setPointerCapture() {}, releasePointerCapture() {} },
  });
  adapter.setTransform(transform);
  const physical = () => adapter.pointerDown(mouseEvent({ pointerId: 62, button: 0,
    clientX: 111.25, clientY: 89.5 }));
  const first = firstSource === "accessibility" ? adapter.accessibleButton("tail") : physical();
  const second = firstSource === "accessibility" ? physical() : adapter.accessibleButton("tail");
  assert.deepEqual(calls, ["pointer-down"], `${firstSource} acquisition remains the sole guest edge`);
  firstAcceptance.resolve(Object.freeze({ ok: true,
    result: Object.freeze({ accepted: true, reason: "edge" }) }));
  assert.equal((await first).accepted, true);
  assert.equal((await second).accepted, true);
  assert.deepEqual(calls, ["pointer-down"], "cross-source async acquisition is serialized");
  assert.equal(adapter.physicalButtons, 1);
  assert.equal(adapter.accessibleButtons, 1);
  assert.equal(adapter.acceptedButtons, 1);
}

/* Release All rejection is fail-stop in both local-controller and submitted
 * modes. Draining any preexisting queue cannot make the adapter usable again. */
{
  const controller = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer: controller });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  const adapter = new CadrM9PointerAdapter({ controller, lifecycle,
    captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  adapter.pointerDown(mouseEvent({ pointerId: 71, button: 0, clientX: 111.25, clientY: 89.5 }));
  controller.neutralize = () => Object.freeze({ accepted: false, reason: "synthetic-direct-rejection" });
  const failed = adapter.releaseAll();
  assert.equal(failed.accepted, false); assert.equal(failed.action, "fail-stop");
  assert.equal(lifecycle.browserState, "TERMINAL"); assert.equal(lifecycle.workerState, "FAILED");
  controller.drain();
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 71, button: 0,
    clientX: 111.25, clientY: 89.5 })).reason, "terminal");
}

{
  const lifecyclePointer = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer: lifecyclePointer });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  const remote = protocolSubmit();
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    lifecycle, captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  adapter.pointerDown(mouseEvent({ pointerId: 72, button: 0, clientX: 111.25, clientY: 89.5 }));
  remote.submit = request => {
    remote.calls.push(request);
    return request.op === "pointer-neutralize" ?
      Object.freeze({ ok: false, reason: "synthetic-submitted-rejection" }) :
      remote.handler.handle(request);
  };
  const failed = adapter.releaseAll();
  assert.equal(failed.accepted, false); assert.equal(failed.action, "fail-stop");
  assert.equal(lifecycle.browserState, "TERMINAL"); assert.equal(lifecycle.workerState, "FAILED");
  remote.handler.controller.drain();
  assert.equal(adapter.accessibleButton("tail").reason, "terminal");
}

/* Async focus and async remote acceptance form one first-down fence. */
{
  const focus = deferred(); const down = deferred(); const calls = [];
  const adapter = new CadrM9PointerAdapter({
    focusGuest: () => focus.promise,
    submitPointerOperation(request) {
      calls.push(request.op);
      return request.op === "pointer-down" ? down.promise :
        Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "accepted" }) });
    },
    captureTarget: { setPointerCapture() {}, releasePointerCapture() {} },
  });
  adapter.setTransform(transform);
  const downResult = adapter.pointerDown(mouseEvent({ pointerId: 33, button: 0,
    clientX: 111.25, clientY: 89.5 }));
  const moveResult = adapter.pointerMove(mouseEvent({ pointerId: 33,
    clientX: 112.25, clientY: 90.5 }));
  assert.deepEqual(calls, [], "no ingress overtakes unresolved focus");
  focus.resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ["pointer-down"]);
  down.resolve(Object.freeze({ ok: true,
    result: Object.freeze({ accepted: true, reason: "edge" }) }));
  assert.equal((await downResult).accepted, true);
  assert.equal((await moveResult).accepted, true);
  assert.deepEqual(calls, ["pointer-down", "pointer-motion"],
    "motion cannot overtake first-down acceptance");
}

/* Accessible controls use the same production submit seam and update toggles
 * only after acceptance. */
{
  const responses = [
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "edge" }) }),
    Object.freeze({ ok: false, reason: "synthetic-up-rejection" }),
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "edge" }) }),
    Object.freeze({ ok: true, result: Object.freeze({ accepted: true, reason: "motion" }) }),
  ];
  const remote = protocolSubmit({ responses });
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request) });
  assert.equal(adapter.accessibleButton("tail").accepted, true);
  assert.equal(adapter.acceptedButtons, 1);
  assert.equal(adapter.accessibleButton("tail").accepted, false);
  assert.equal(adapter.acceptedButtons, 1, "rejected accessible up leaves toggle held");
  assert.equal(adapter.accessibleButton("tail").accepted, true);
  assert.equal(adapter.acceptedButtons, 0);
  assert.equal(adapter.accessibleMove(1, 0).accepted, true);
  assert.deepEqual(remote.calls.map(call => call.op),
    ["pointer-down", "pointer-up", "pointer-up", "pointer-motion"]);
}

/* Touch, pen, non-primary mouse, and non-owner events cannot enter the
 * production submitter or disturb accepted state. */
{
  const remote = protocolSubmit();
  const adapter = new CadrM9PointerAdapter({ submitPointerOperation: request => remote.submit(request),
    captureTarget: { setPointerCapture() {}, releasePointerCapture() {} } });
  adapter.setTransform(transform);
  for (const event of [
    { pointerType: "touch", isPrimary: true, pointerId: 1 },
    { pointerType: "pen", isPrimary: true, pointerId: 1 },
    { pointerType: "mouse", isPrimary: false, pointerId: 1 },
  ]) {
    assert.equal(adapter.pointerDown({ ...event, button: 0, clientX: 111.25, clientY: 89.5 }).accepted, false);
  }
  assert.equal(remote.calls.length, 0);
  assert.equal(adapter.pointerDown(mouseEvent({ pointerId: 40, button: 0,
    clientX: 111.25, clientY: 89.5 })).accepted, true);
  const count = remote.calls.length;
  assert.equal(adapter.pointerMove(mouseEvent({ pointerId: 41,
    clientX: 112.25, clientY: 90.5 })).accepted, false);
  assert.equal(adapter.pointerUp(mouseEvent({ pointerId: 41, button: 0,
    clientX: 112.25, clientY: 90.5 })).accepted, false);
  assert.equal(adapter.lostPointerCapture(mouseEvent({ pointerId: 41 })).accepted, false);
  assert.equal(remote.calls.length, count);
  assert.equal(adapter.acceptedButtons, 1);
  assert.equal(adapter.capturedPointerId, 40);
}

class FakeElement {
  constructor(ownerDocument, name) {
    this.ownerDocument = ownerDocument; this.name = name; this.children = []; this.dataset = {};
    this.attributes = new Map(); this.listeners = new Map(); this.className = ""; this.textContent = "";
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, listener) { const entries = this.listeners.get(name) ?? []; entries.push(listener); this.listeners.set(name, entries); }
}

{
  const documentObject = { createElement(name) { return new FakeElement(documentObject, name); } };
  const root = new FakeElement(documentObject, "root"); const controller = new CadrM9PointerController();
  const adapter = new CadrM9PointerAdapter({ controller }); adapter.setTransform(transform);
  const view = createCadrM9PointerControls({ root, adapter });
  assert.equal(root.children[0], view.element); assert.equal(view.element.attributes.get("role"), "group");
  const [buttonBox, directions, state, release, focus, live] = view.element.children;
  assert.equal(buttonBox.children.length, 3); assert.equal(directions.children.length, 4);
  buttonBox.children[0].listeners.get("click")[0]();
  assert.equal(buttonBox.children[0].attributes.get("aria-pressed"), "true");
  directions.children.find(button => button.dataset.direction === "right").listeners.get("click")[0]();
  assert.equal(state.dataset.x, "1"); assert.match(live.textContent, /Pointer moved right/);
  release.listeners.get("click")[0]();
  assert.equal(buttonBox.children[0].attributes.get("aria-pressed"), "false");
  focus.listeners.get("click")[0]();
  assert.match(live.textContent, /focused/);
  await view.dispose(); assert.deepEqual(root.children, []);
}

const adapterSource = readFileSync(new URL("../cadr-web/browser/cadr-m9-pointer-adapter.mjs", import.meta.url), "utf8");
assert.doesNotMatch(adapterSource, /requestPointerLock|mozRequestPointerLock|webkitRequestPointerLock/);
console.log("cadr M9 pointer adapter tests passed");
