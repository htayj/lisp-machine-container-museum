/* Accessible host controls for the M9 pointer profile.  These controls are
 * outside the guest framebuffer and invoke the adapter's ordinary M9 paths. */

import { CADR_M9_BUTTONS, CADR_M9_POINTER_PROFILE } from "../wasm/cadr-m9-pointer.mjs";
import { CadrM9PointerAdapter } from "./cadr-m9-pointer-adapter.mjs";

function element(documentObject, name, className) {
  const value = documentObject.createElement(name);
  value.className = className;
  return value;
}

function thenable(value) { return value !== null && typeof value === "object" && typeof value.then === "function"; }

function readableOutcome(value) {
  if (value !== null && typeof value === "object" && typeof value.accepted === "boolean") return value;
  if (value !== null && typeof value === "object" && value.result !== null &&
      typeof value.result === "object" && typeof value.result.accepted === "boolean") return value.result;
  return { accepted: false, reason: "unknown-operation-result" };
}

/**
 * Render tail/middle/head toggles, single-logical-pixel directions, coordinates,
 * status, Release All, Focus Guest, and a polite live region.  It installs no
 * global listeners and does not retain guest input state itself.
 */
export function createCadrM9PointerControls({ root, adapter }) {
  if (root === null || typeof root !== "object" || root.ownerDocument === null) {
    throw new TypeError("C-M9 controls: root must belong to a document");
  }
  if (!(adapter instanceof CadrM9PointerAdapter)) {
    throw new TypeError("C-M9 controls: adapter must be CadrM9PointerAdapter");
  }
  const documentObject = root.ownerDocument;
  const group = element(documentObject, "section", "cadr-m9-pointer-controls");
  group.setAttribute("role", "group"); group.setAttribute("aria-label", "CADR pointer controls");
  group.dataset.cadrM9Profile = CADR_M9_POINTER_PROFILE;
  const state = element(documentObject, "output", "cadr-m9-pointer-state");
  state.setAttribute("aria-label", "CADR pointer coordinates and buttons");
  const live = element(documentObject, "div", "cadr-m9-pointer-live");
  live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  const buttonControls = new Map();
  let disposed = false;

  const read = () => adapter.snapshot();
  const refresh = (announcement = null) => {
    const snapshot = read(); const pointer = snapshot.controller;
    const x = pointer?.cursor?.x ?? snapshot.lastInBounds?.x ?? 0;
    const y = pointer?.cursor?.y ?? snapshot.lastInBounds?.y ?? 0;
    const buttons = snapshot.acceptedButtons;
    state.textContent = `x ${x}, y ${y}, buttons ${buttons}`;
    state.dataset.x = String(x); state.dataset.y = String(y); state.dataset.buttons = String(buttons);
    for (const descriptor of CADR_M9_BUTTONS) {
      buttonControls.get(descriptor.name).setAttribute("aria-pressed", String((buttons & descriptor.bit) !== 0));
    }
    if (announcement !== null) live.textContent = announcement;
  };

  const settle = (value, successText) => {
    const done = item => {
      const outcome = readableOutcome(item);
      refresh(outcome.accepted ? successText : `Pointer operation not accepted: ${outcome.reason ?? "unknown"}`);
      return outcome;
    };
    return thenable(value) ? Promise.resolve(value).then(done,
      error => done({ accepted: false, reason: error?.message ?? "operation-rejected" })) : done(value);
  };

  const buttons = element(documentObject, "div", "cadr-m9-pointer-buttons");
  buttons.setAttribute("aria-label", "CADR mouse buttons");
  for (const descriptor of CADR_M9_BUTTONS) {
    const control = element(documentObject, "button", "cadr-m9-pointer-button");
    control.type = "button"; control.textContent = descriptor.name;
    control.dataset.button = descriptor.name; control.setAttribute("aria-pressed", "false");
    control.setAttribute("aria-label", `${descriptor.name} CADR mouse button toggle`);
    control.addEventListener("click", () => { if (!disposed) settle(adapter.accessibleButton(descriptor.name),
      `${descriptor.name} pointer button changed`); });
    buttonControls.set(descriptor.name, control); buttons.append(control);
  }

  const directions = element(documentObject, "div", "cadr-m9-pointer-directions");
  directions.setAttribute("aria-label", "Move CADR pointer one logical pixel");
  for (const [name, dx, dy] of [["up", 0, -1], ["left", -1, 0], ["right", 1, 0], ["down", 0, 1]]) {
    const control = element(documentObject, "button", "cadr-m9-pointer-direction");
    control.type = "button"; control.textContent = name; control.dataset.direction = name;
    control.setAttribute("aria-label", `Move CADR pointer ${name} one logical pixel`);
    control.addEventListener("click", () => { if (!disposed) settle(adapter.accessibleMove(dx, dy),
      `Pointer moved ${name} one logical pixel`); });
    directions.append(control);
  }

  const release = element(documentObject, "button", "cadr-m9-pointer-release-all");
  release.type = "button"; release.textContent = "Release All";
  release.setAttribute("aria-label", "Release all CADR pointer and keyboard input");
  release.addEventListener("click", () => { if (!disposed) settle(adapter.releaseAll(), "All input released"); });
  const focus = element(documentObject, "button", "cadr-m9-pointer-focus-guest");
  focus.type = "button"; focus.textContent = "Focus Guest";
  focus.setAttribute("aria-label", "Focus the CADR guest without sending a mouse click");
  focus.addEventListener("click", () => { if (!disposed) settle(adapter.focus(), "CADR guest focused"); });
  group.append(buttons, directions, state, release, focus, live); root.replaceChildren(group); refresh("CADR pointer controls ready");

  return Object.freeze({
    element: group,
    refresh,
    async dispose() {
      if (!disposed) {
        disposed = true;
        const released = adapter.releaseAll();
        if (thenable(released)) await released;
      }
      adapter.dispose(); root.replaceChildren();
    },
  });
}
