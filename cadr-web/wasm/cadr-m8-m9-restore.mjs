import { CadrM8KeyboardProtocolSubhandler } from "./cadr-m8-keyboard.mjs";
import { CadrM9PointerController, CadrM9PointerProtocolSubhandler } from
  "./cadr-m9-pointer.mjs";

/* Snapshot replacement must discard every host-owned controller object.  The
 * pointer epoch is the sole host value that survives: it identifies the live
 * browser capture session and is deliberately absent from the native record. */
export function cadrM9InputHostStateNeutral(keyboardProtocol, pointerProtocol) {
  const keyboard = keyboardProtocol?.controller.snapshot();
  const pointer = pointerProtocol?.controller.snapshot();
  return keyboard !== undefined && pointer !== undefined &&
    keyboard.heldCodes.length === 0 && keyboard.queue.length === 0 &&
    pointer.buttons === 0 && pointer.heldButtonNames.length === 0 &&
    pointer.queue.length === 0 && pointer.warp === null && pointer.stalled === false;
}

export function replaceCadrM9InputHostState(keyboardProtocol, pointerProtocol) {
  if (keyboardProtocol?.controller === undefined || pointerProtocol?.controller === undefined) {
    throw new TypeError("M8/M9 restore requires live protocol controllers");
  }
  const generation = pointerProtocol.controller.snapshot().generation;
  return Object.freeze({
    keyboardProtocol: new CadrM8KeyboardProtocolSubhandler(),
    pointerProtocol: new CadrM9PointerProtocolSubhandler({
      controller: new CadrM9PointerController({ generation }),
    }),
  });
}
