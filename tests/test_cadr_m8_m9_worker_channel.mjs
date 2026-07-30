import assert from "node:assert/strict";

import { CadrM9PointerAdapter, createCadrM9PointerTransform } from
  "../cadr-web/browser/cadr-m9-pointer-adapter.mjs";
import {
  bindCadrM8PhysicalKeyboard,
  bindCadrM9PointerEvents,
  createCadrM8M9WorkerChannel,
} from "../cadr-web/browser/cadr-m8-m9-worker-channel.mjs";

class FakeWorker {
  #listeners = new Map();
  posts = [];

  addEventListener(name, listener) {
    const listeners = this.#listeners.get(name) ?? [];
    listeners.push(listener); this.#listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.#listeners.set(name, (this.#listeners.get(name) ?? []).filter(value => value !== listener));
  }

  postMessage(value) { this.posts.push(value); }

  emit(name, value) {
    for (const listener of this.#listeners.get(name) ?? []) listener(value);
  }

  reply(id, op, result = { accepted: true, reason: "accepted" }) {
    this.emit("message", { data: { type: "cadr-response", version: 6, id, op,
      status: result.accepted ? 0 : 2, ok: result.accepted, result,
      ...(result.accepted ? {} : { reason: result.reason }) } });
  }
}

class FakeTarget {
  #listeners = new Map();

  addEventListener(name, listener) {
    const listeners = this.#listeners.get(name) ?? [];
    listeners.push(listener); this.#listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.#listeners.set(name, (this.#listeners.get(name) ?? []).filter(value => value !== listener));
  }

  emit(name, event = {}) {
    for (const listener of this.#listeners.get(name) ?? []) listener(event);
  }
}

const worker = new FakeWorker();
const channel = createCadrM8M9WorkerChannel({ worker });

const first = channel.submit({ op: "keyboard-down", code: "KeyQ", repeat: false });
assert.deepEqual(worker.posts[0], { version: 6, id: 1, op: "keyboard-down", code: "KeyQ", repeat: false });
worker.reply(1, "keyboard-down", { accepted: true, reason: "down", emitted: 0o122 });
assert.equal((await first).result.emitted, 0o122);

const adapter = new CadrM9PointerAdapter({
  submitPointerOperation: request => channel.submit(request),
  allocateRequestId: () => channel.allocateRequestId(),
  captureTarget: { setPointerCapture() {}, releasePointerCapture() {} },
});
adapter.setTransform(createCadrM9PointerTransform({ contentLeft: 10, contentTop: 20,
  scale: 1, epoch: 0 }));
const pointerDown = adapter.pointerDown({ pointerType: "mouse", isPrimary: true, pointerId: 8,
  button: 0, clientX: 11, clientY: 21 });
assert.equal(worker.posts[1].id, 2, "M9 consumes the channel's shared next request ID");
assert.equal(worker.posts[1].op, "pointer-down");
worker.reply(2, "pointer-down", { accepted: true, reason: "edge" });
assert.equal((await pointerDown).accepted, true);

const third = channel.submit({ op: "keyboard-up", code: "KeyQ" });
assert.equal(worker.posts[2].id, 3, "M8 cannot reuse M9's worker request ID");
worker.reply(3, "keyboard-up", { accepted: true, reason: "all-up", emitted: 0x8000 });
assert.equal((await third).ok, true);
assert.throws(() => channel.submit({ id: 9, op: "keyboard-state" }), /not allocated/);

const keyboardTarget = new FakeTarget();
const keyboardCalls = [];
const keyboard = bindCadrM8PhysicalKeyboard({ target: keyboardTarget,
  submitKeyboardOperation: request => { keyboardCalls.push(request); return { ok: true }; } });
let prevented = false;
keyboardTarget.emit("keydown", { code: "KeyQ", repeat: false, preventDefault() { prevented = true; } });
keyboardTarget.emit("keyup", { code: "KeyQ", preventDefault() { prevented = true; } });
keyboardTarget.emit("keydown", { code: "Unidentified", preventDefault() { throw new Error("unmapped key must fall through"); } });
keyboardTarget.emit("blur");
assert.equal(prevented, true);
assert.deepEqual(keyboardCalls, [
  { op: "keyboard-down", code: "KeyQ", repeat: false },
  { op: "keyboard-up", code: "KeyQ" },
  { op: "keyboard-focus-lost" },
]);
keyboard.dispose();

const pointerTarget = new FakeTarget();
const pointerCalls = [];
const pointerBinding = bindCadrM9PointerEvents({ target: pointerTarget, adapter: {
  pointerDown(event) { pointerCalls.push(["down", event]); },
  pointerMove(event) { pointerCalls.push(["move", event]); },
  pointerUp(event) { pointerCalls.push(["up", event]); },
  lostPointerCapture(event) { pointerCalls.push(["lost", event]); },
} });
pointerTarget.emit("pointerdown", { pointerId: 1 });
pointerTarget.emit("pointermove", { pointerId: 1 });
pointerTarget.emit("pointerup", { pointerId: 1 });
pointerTarget.emit("lostpointercapture", { pointerId: 1 });
assert.deepEqual(pointerCalls.map(([kind]) => kind), ["down", "move", "up", "lost"]);
pointerBinding.dispose(); channel.close();

console.log("cadr M8/M9 worker channel tests passed");
