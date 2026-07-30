import assert from "node:assert/strict";

import {
  CADR_M13_PROTOCOL_VERSION,
  CADR_M13_STATUS,
  CadrM13Shell,
} from "../cadr-web/browser/cadr-m13-shell.mjs";

const sessionBytes = () => Uint8Array.from({ length: 32 }, () => 0x13);

function request(id, op, fields = {}) {
  return { type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
    sessionId: "13".repeat(32), id, op, ...fields };
}

class ManualWorker {
  #listeners = new Map();
  requests = [];
  terminated = 0;
  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? [];
    listeners.push(listener); this.#listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.#listeners.set(type, (this.#listeners.get(type) ?? []).filter(item => item !== listener));
  }
  postMessage(value) { this.requests.push(value); }
  terminate() { this.terminated += 1; }
  emit(type, event = {}) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
  reply(requestValue, fields = {}) {
    this.emit("message", { data: { type: "cadr-response", version: 7,
      id: requestValue.id, op: requestValue.op, status: 0, ok: true, ...fields } });
  }
}

class ManualTimers {
  values = [];
  set(callback, milliseconds) {
    const value = { callback, milliseconds, cleared: false };
    this.values.push(value); return value;
  }
  clear(value) { value.cleared = true; }
  fire(milliseconds) {
    const value = this.values.find(candidate => !candidate.cleared && candidate.milliseconds === milliseconds);
    assert.notEqual(value, undefined, `missing ${milliseconds}ms timer`);
    value.cleared = true; value.callback();
  }
}

class ChordTarget {
  registrations = [];
  addEventListener(type, listener, capture) { this.registrations.push({ type, listener, capture }); }
  removeEventListener(type, listener, capture) {
    this.registrations = this.registrations.filter(item =>
      item.type !== type || item.listener !== listener || item.capture !== capture);
  }
}

async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

async function waitForRequests(worker, count) {
  for (let index = 0; index < 32; index += 1) {
    if (worker.requests.length >= count) return;
    await Promise.resolve();
  }
  assert.equal(worker.requests.length >= count, true, `expected ${count} worker requests`);
}

function shellFor(worker, timers, options = {}) {
  return new CadrM13Shell({ worker, sessionRandom: sessionBytes,
    timeoutMs: 10, setTimeoutFn: timers.set.bind(timers), clearTimeoutFn: timers.clear.bind(timers), ...options });
}

async function testSynchronousReleaseAndChord() {
  const worker = new ManualWorker(); const timers = new ManualTimers();
  const calls = [];
  const guestSurface = {
    releasePointerCapture(pointerId) { calls.push(["release", pointerId]); },
    blur() { calls.push(["blur"]); },
  };
  const releaseControl = { focus() { calls.push(["focus"]); } };
  const statuses = [];
  const shell = shellFor(worker, timers, { guestSurface, releaseControl, statusSink: value => statuses.push(value) });
  shell.setCapturedPointer(17);
  assert.deepEqual(shell.releaseInput(), { released: true, guestNeutralization: "pending" });
  assert.deepEqual(calls, [["release", 17], ["blur"], ["focus"]]);
  assert.equal(statuses.at(-1), "CADR guest input released; guest neutralization is pending");
  await waitForRequests(worker, 1);
  assert.equal(worker.requests[0].op, "pointer-neutralize");
  assert.equal(timers.values[0].milliseconds, 250);
  worker.reply(worker.requests[0], { lifecycle: "PAUSED" });
  await settle();
  assert.equal(shell.state, "NEW");

  const chordWorker = new ManualWorker(); const chordTimers = new ManualTimers();
  const chordShell = shellFor(chordWorker, chordTimers, { guestSurface, releaseControl });
  const target = new ChordTarget(); const detach = chordShell.bindReleaseChord(target);
  assert.equal(target.registrations.length, 1);
  assert.equal(target.registrations[0].capture, true);
  let prevented = 0; let stopped = 0;
  target.registrations[0].listener({ code: "KeyR", ctrlKey: true, altKey: true, shiftKey: true,
    metaKey: false, repeat: false, preventDefault() { prevented += 1; }, stopImmediatePropagation() { stopped += 1; } });
  assert.equal(prevented, 1); assert.equal(stopped, 1);
  await waitForRequests(chordWorker, 1);
  assert.equal(chordWorker.requests[0].op, "pointer-neutralize");
  chordWorker.reply(chordWorker.requests[0], { lifecycle: "PAUSED" });
  detach(); assert.equal(target.registrations.length, 0);
}

async function testWorkerLossMatrix() {
  const operations = [
    ["run", request(1, "machine-run", { clockSlots: 1 })],
    ["input", request(1, "keyboard-state")],
    ["pause", request(1, "machine-pause")],
    ["debugger", request(1, "debug-inspect-read", { arrayKind: 1, index: 0 })],
  ];
  for (const [name, candidate] of operations) {
    const worker = new ManualWorker(); const timers = new ManualTimers();
    const statuses = [];
    const shell = shellFor(worker, timers, { statusSink: value => statuses.push(value) });
    const pending = shell.submit(candidate);
    await waitForRequests(worker, 1);
    worker.emit("error");
    const result = await pending;
    assert.equal(result.status, CADR_M13_STATUS.WORKER_LOST, `${name} loss status`);
    assert.equal(result.terminal, true, `${name} loss terminal`);
    assert.equal(shell.state, "FAILED", `${name} loss state`);
    assert.equal(worker.terminated, 1, `${name} worker terminated`);
    assert.equal(statuses.at(-1), "CADR worker lost; volatile state lost", `${name} loss announcement`);
    assert.equal(worker.requests.length, 1, `${name} never sends neutralization after terminal loss`);
  }

  /* Audio is not wired to this policy shell yet.  Its public composite request
   * fails before lower dispatch rather than pretending the source matrix is a
   * device-loss test. */
  const worker = new ManualWorker(); const timers = new ManualTimers(); const shell = shellFor(worker, timers);
  const result = await shell.submit(request(1, "audio-open", { rendererProfile: "USIM-SDL3-SINE", consumerEpoch: 1n }));
  assert.equal(result.status, CADR_M13_STATUS.NOT_READY);
  assert.equal(worker.requests.length, 0);
}

async function testProtocolMessageErrorAndTimeoutMatrix() {
  {
    const worker = new ManualWorker(); const timers = new ManualTimers(); const shell = shellFor(worker, timers);
    const pending = shell.submit(request(1, "keyboard-state"));
    await waitForRequests(worker, 1);
    worker.reply(worker.requests[0], { status: 0, ok: true, extra: "forbidden" });
    const result = await pending;
    assert.equal(result.status, CADR_M13_STATUS.PROTOCOL_VIOLATION);
    assert.equal(result.terminal, true); assert.equal(shell.state, "FAILED");
    assert.equal(worker.terminated, 1);
  }
  {
    const worker = new ManualWorker(); const timers = new ManualTimers(); const shell = shellFor(worker, timers);
    const pending = shell.submit(request(1, "keyboard-state"));
    await waitForRequests(worker, 1);
    worker.emit("messageerror");
    const result = await pending;
    assert.equal(result.status, CADR_M13_STATUS.WORKER_LOST);
    assert.equal(result.terminal, true); assert.equal(shell.state, "FAILED");
  }
  {
    const worker = new ManualWorker(); const timers = new ManualTimers(); const shell = shellFor(worker, timers);
    const pending = shell.submit(request(1, "keyboard-state"));
    await waitForRequests(worker, 1);
    timers.fire(10);
    const result = await pending;
    assert.equal(result.status, CADR_M13_STATUS.WORKER_LOST);
    assert.equal(result.terminal, true); assert.equal(shell.state, "FAILED");
    assert.equal(worker.terminated, 1);
  }
}

await testSynchronousReleaseAndChord();
await testWorkerLossMatrix();
await testProtocolMessageErrorAndTimeoutMatrix();
console.log("cadr M13 lifecycle/crash source matrix passed");
