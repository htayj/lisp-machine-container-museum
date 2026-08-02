import assert from "node:assert/strict";
import { mountCadrM13AccessibilityShell } from "../cadr-web/browser/cadr-m13-shell.mjs";

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.textContent = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  append(value) { this.children.push(value); }
  querySelector(selector) {
    const match = selector.match(/data-cadr-m13-operation="([^"]+)"/);
    return match === null ? null : this.children.find(value => value.dataset.cadrM13Operation === match[1]) ?? null;
  }
  click() { this.listeners.click?.(); }
}
const documentObject = { createElement: tag => new Element(tag) };
const root = new Element("root"); root.replaceChildren = (...values) => { root.children = values; };
const calls = [];
const mounted = mountCadrM13AccessibilityShell({ documentObject, root,
  prepareAudioActivation: () => calls.push("prepare"), submit: op => calls.push(op) });
const controls = mounted.controls.children.map(value => [value.dataset.cadrM13Operation, value.textContent]);
assert.ok(controls.some(value => value[0] === "audio-open" && value[1] === "Start Audio"));
assert.ok(controls.some(value => value[0] === "audio-pause" && value[1] === "Pause Audio"));
assert.ok(controls.some(value => value[0] === "audio-resume" && value[1] === "Resume Audio"));
mounted.controls.children.find(value => value.dataset.cadrM13Operation === "audio-open").click();
assert.deepEqual(calls, ["prepare", "audio-open"], "activation remains synchronous before async submit");
mounted.controls.children.find(value => value.dataset.cadrM13Operation === "audio-pause").click();
assert.deepEqual(calls.slice(-1), ["audio-pause"], "pause creates no audio authority");
mounted.announce("CADR audio paused"); assert.equal(mounted.status.textContent, "CADR audio paused");
console.log("cadr M13 accessible audio controls and activation order passed");
