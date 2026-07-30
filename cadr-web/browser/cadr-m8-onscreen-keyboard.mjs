/* Accessible M8 physical-key view.  It does not install global keyboard
 * listeners or send guest events; its caller owns that later integration. */

import {
  CADR_M8_ONSCREEN_ROWS,
  CADR_M8_PROTOCOL_VERSION,
  CADR_M8_STATUS_INVALID_ARGUMENT,
  CadrM8KeyboardController,
} from "../wasm/cadr-m8-keyboard.mjs";

function element(documentObject, name, className) {
  const value = documentObject.createElement(name);
  value.className = className;
  return value;
}

function thenable(value) {
  return value !== null && typeof value === "object" && typeof value.then === "function";
}

function acceptance(value) {
  if (value !== null && typeof value === "object" && typeof value.accepted === "boolean") {
    return { known: true, accepted: value.accepted, reason: value.reason ?? null };
  }
  if (value !== null && typeof value === "object" && value.type === "cadr-response" &&
      typeof value.ok === "boolean") {
    if (value.result !== null && typeof value.result === "object" &&
        typeof value.result.accepted === "boolean") {
      return { known: true, accepted: value.result.accepted,
        reason: value.result.reason ?? value.reason ?? null };
    }
    return { known: true, accepted: value.ok, reason: value.reason ?? null };
  }
  return { known: false, accepted: false, reason: "unknown-operation-result" };
}

function canonicalKeyboardUpNotHeld(value) {
  return value !== null && typeof value === "object" &&
    value.type === "cadr-response" &&
    value.version === CADR_M8_PROTOCOL_VERSION &&
    Number.isInteger(value.id) && value.id >= 1 && value.id <= 0xffffffff &&
    value.op === "keyboard-up" &&
    value.status === CADR_M8_STATUS_INVALID_ARGUMENT &&
    value.ok === false &&
    value.reason === "not-held" &&
    value.result !== null && typeof value.result === "object" &&
    value.result.accepted === false &&
    value.result.reason === "not-held";
}

/** Render all 100 M8 physical descriptors. A real host supplies
 * submitKeyboardOperation(), which posts host-originated operations to the
 * worker. `controller` is an isolated synchronous test/demo seam only. */
export function createCadrM8OnscreenKeyboard({ root, submitKeyboardOperation = null,
  controller = null }) {
  if (root === null || typeof root !== "object" || root.ownerDocument === null) {
    throw new TypeError("C-M8: root must belong to a document");
  }
  if (submitKeyboardOperation !== null && typeof submitKeyboardOperation !== "function") {
    throw new TypeError("C-M8: submitKeyboardOperation must be a function");
  }
  if (controller !== null && !(controller instanceof CadrM8KeyboardController)) {
    throw new TypeError("C-M8: controller must be CadrM8KeyboardController");
  }
  if (submitKeyboardOperation === null && controller === null) {
    throw new TypeError("C-M8: a worker operation submitter is required");
  }
  const documentObject = root.ownerDocument;
  const keyboard = element(documentObject, "section", "cadr-m8-onscreen-keyboard");
  keyboard.setAttribute("aria-label", "CADR Space Cadet keyboard");
  keyboard.dataset.cadrM8PhysicalKeyCount = "100";
  const ownership = new Map();
  let disposed = false;

  const submit = (operation) => {
    if (submitKeyboardOperation !== null) return submitKeyboardOperation(operation);
    if (operation.op === "keyboard-down") return controller.keyDown({ code: operation.code });
    if (operation.op === "keyboard-up") return controller.keyUp({ code: operation.code });
    throw new TypeError("C-M8: unknown onscreen operation");
  };

  const finishRelease = (entry, value) => {
    const outcome = acceptance(value);
    entry.lastOutcome = outcome;
    /* A canonical not-held up proves the worker is already converged after
     * focus recovery or an uncertain down transport. No other rejection does. */
    const converged = outcome.known &&
      (outcome.accepted || canonicalKeyboardUpNotHeld(value));
    if (converged && ownership.get(entry.code) === entry) {
      ownership.delete(entry.code);
    }
    return outcome;
  };

  const attemptRelease = (entry) => {
    if (ownership.get(entry.code) !== entry || !entry.releaseRequested) {
      return { known: true, accepted: true, reason: "no-pending-release" };
    }
    if (entry.downState === "pending") return entry.downPromise;
    if (entry.downState === "rejected") {
      ownership.delete(entry.code);
      return { known: true, accepted: true, reason: "down-not-accepted" };
    }
    if (entry.releaseInFlight !== null) return entry.releaseInFlight;
    let submitted;
    try {
      submitted = submit({ op: "keyboard-up", code: entry.code });
    } catch (error) {
      entry.lastError = error;
      return { known: false, accepted: false, reason: "submit-threw" };
    }
    if (!thenable(submitted)) return finishRelease(entry, submitted);
    entry.releaseInFlight = Promise.resolve(submitted).then(
      value => finishRelease(entry, value),
      error => {
        entry.lastError = error;
        return { known: false, accepted: false, reason: "submit-rejected" };
      },
    ).finally(() => { entry.releaseInFlight = null; });
    return entry.releaseInFlight;
  };

  const finishDown = (entry, value) => {
    const outcome = acceptance(value);
    entry.lastOutcome = outcome;
    if (outcome.known && !outcome.accepted) {
      entry.downState = "rejected";
      if (ownership.get(entry.code) === entry) ownership.delete(entry.code);
      return outcome;
    }
    /* An unknown transport outcome is conservatively treated as possibly
     * accepted. A later up remains pending until the worker confirms it. */
    entry.downState = outcome.known ? "accepted" : "unknown";
    if (entry.releaseRequested) return attemptRelease(entry);
    return outcome;
  };

  const press = (code) => {
    if (disposed || ownership.has(code)) return;
    const entry = { code, downState: "pending", downPromise: null,
      releaseRequested: false, releaseInFlight: null, lastOutcome: null,
      lastError: null };
    ownership.set(code, entry);
    let submitted;
    try {
      submitted = submit({ op: "keyboard-down", code });
    } catch (error) {
      entry.downState = "unknown"; entry.lastError = error;
      return;
    }
    if (!thenable(submitted)) {
      finishDown(entry, submitted);
      return;
    }
    entry.downPromise = Promise.resolve(submitted).then(
      value => finishDown(entry, value),
      error => {
        entry.downState = "unknown"; entry.lastError = error;
        if (entry.releaseRequested) return attemptRelease(entry);
        return { known: false, accepted: false, reason: "submit-rejected" };
      },
    );
  };

  const release = (code) => {
    const entry = ownership.get(code);
    if (entry === undefined) return { known: true, accepted: true, reason: "not-owned" };
    entry.releaseRequested = true;
    if (entry.downState === "pending") return entry.downPromise;
    return attemptRelease(entry);
  };
  for (const row of CADR_M8_ONSCREEN_ROWS) {
    const rowElement = element(documentObject, "div", "cadr-m8-keyboard-row");
    rowElement.dataset.row = row[0].row;
    for (const descriptor of row) {
      const button = element(documentObject, "button", "cadr-m8-key");
      button.type = "button";
      button.textContent = descriptor.label;
      button.dataset.code = descriptor.code;
      button.dataset.scancode = descriptor.scancode.toString(8);
      button.dataset.modifier = String(descriptor.modifier !== null);
      button.setAttribute("aria-label", `${descriptor.label}, CADR octal ${descriptor.scancode.toString(8)}`);
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        press(descriptor.code);
      });
      button.addEventListener("pointerup", () => release(descriptor.code));
      button.addEventListener("pointercancel", () => release(descriptor.code));
      button.addEventListener("pointerleave", () => release(descriptor.code));
      rowElement.append(button);
    }
    keyboard.append(rowElement);
  }
  root.replaceChildren(keyboard);
  return Object.freeze({
    controller,
    element: keyboard,
    pendingReleaseCodes() {
      return Object.freeze([...ownership.values()].filter(entry => entry.releaseRequested)
        .map(entry => entry.code));
    },
    retryPendingReleases() {
      return Promise.all([...ownership.values()].filter(entry => entry.releaseRequested)
        .map(entry => Promise.resolve(attemptRelease(entry))));
    },
    dispose() {
      disposed = true;
      const attempts = [];
      for (const entry of ownership.values()) {
        entry.releaseRequested = true;
        attempts.push(Promise.resolve(attemptRelease(entry)));
      }
      root.replaceChildren();
      return Promise.all(attempts);
    },
  });
}
