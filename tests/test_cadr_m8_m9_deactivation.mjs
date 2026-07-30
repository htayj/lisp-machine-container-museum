import assert from "node:assert/strict";
import {
  CadrM8KeyboardController,
  CadrM8KeyboardProtocolSubhandler,
} from "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import {
  CadrM9PointerController,
  CadrM9PointerProtocolSubhandler,
} from "../cadr-web/wasm/cadr-m9-pointer.mjs";
import {
  commitCadrM8M9SharedDeactivation,
  prepareCadrM8M9SharedDeactivation,
} from "../cadr-web/wasm/cadr-m8-m9-deactivation.mjs";
import { commitCadrM8M9CoreDelivery } from
  "../cadr-web/wasm/cadr-m8-m9-transaction.mjs";

function fixture() {
  const keyboardProtocol = new CadrM8KeyboardProtocolSubhandler({
    controller: new CadrM8KeyboardController(),
  });
  const pointerProtocol = new CadrM9PointerProtocolSubhandler({
    controller: new CadrM9PointerController(),
  });
  return { keyboardProtocol, pointerProtocol };
}

for (const order of ["key-pointer-blur", "pointer-key-capture-loss"]) {
  const state = fixture();
  if (order === "key-pointer-blur") {
    state.keyboardProtocol.handle({ version: 6, id: 1, op: "keyboard-down",
      code: "KeyQ", repeat: false });
    state.pointerProtocol.handle({ version: 6, id: 2, op: "pointer-down",
      domButton: 0, x: 10, y: 20, tick: 1n, generation: 0 });
  } else {
    state.pointerProtocol.handle({ version: 6, id: 1, op: "pointer-down",
      domButton: 2, x: 30, y: 40, tick: 1n, generation: 0 });
    state.keyboardProtocol.handle({ version: 6, id: 2, op: "keyboard-down",
      code: "ShiftLeft", repeat: false });
  }
  const request = order === "key-pointer-blur" ?
    { version: 6, id: 3, op: "keyboard-focus-lost" } :
    { version: 6, id: 3, op: "pointer-neutralize", cause: "capture-loss",
      tick: 2n, generation: 0 };
  const prepared = prepareCadrM8M9SharedDeactivation({
    pointerProtocol: state.pointerProtocol, request });
  assert.equal(prepared.status, 0);
  assert.deepEqual(prepared.result.entries.map(entry => entry.type),
    ["pointer-edge", "keyboard-all-up"], order);
  assert.equal(prepared.result.entries.filter(entry =>
    entry.type === "keyboard-all-up").length, 1, order);
  assert.equal(state.keyboardProtocol.controller.snapshot().heldCodes.length, 1,
    "M8 clear waits for the worker/core delivery commit");
  assert.deepEqual(commitCadrM8M9SharedDeactivation({
    keyboardProtocol: state.keyboardProtocol }), { heldKeysCleared: 1 });
  assert.deepEqual(state.keyboardProtocol.controller.snapshot().heldCodes, []);
  assert.deepEqual(state.pointerProtocol.controller.snapshot().heldButtonNames, []);
}

let committed = false; let failedClosed = false;
assert.throws(() => commitCadrM8M9CoreDelivery({
  delivery: null,
  commit() { committed = true; },
  failClosed() { failedClosed = true; },
}), /violated a successful preflight/);
assert.equal(committed, false,
  "post-preflight core failure must not commit controller delivery");
assert.equal(failedClosed, true,
  "post-preflight core failure must terminally close the input endpoint");

console.log("cadr M8/M9 shared deactivation interleaving tests passed");
