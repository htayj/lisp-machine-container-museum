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

function fullFrame() {
  const frame = new Uint8Array(80 + 16 + (24 * 963 * 4));
  const view = new DataView(frame.buffer); frame.set(new TextEncoder().encode("CDRDISP1"), 0);
  view.setUint16(8, 1, true); view.setUint16(10, 80, true); view.setUint32(12, 3, true);
  view.setBigUint64(16, 1n, true); view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true); view.setUint32(36, 963, true); view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true); view.setUint32(48, 23112, true); view.setUint32(52, 0, true);
  view.setUint32(56, 1, true); view.setUint32(60, 23112, true);
  view.setBigUint64(64, 92448n, true); view.setBigUint64(72, BigInt(frame.byteLength), true);
  view.setUint32(80, 0, true); view.setUint32(84, 0, true);
  view.setUint32(88, 768, true); view.setUint32(92, 963, true);
  return frame.buffer;
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
    this.emit("message", { data: { type: "cadr-response", version: 8,
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

  const failedWorker = new ManualWorker(); const failedTimers = new ManualTimers(); const failedStatuses = [];
  const failedShell = shellFor(failedWorker, failedTimers, {
    releaseIngress() { throw new Error("detach failed"); },
    statusSink: value => failedStatuses.push(value),
  });
  failedShell.releaseInput("broken-release-hook");
  assert.equal(failedShell.state, "FAILED");
  assert.equal(failedStatuses.at(-1), "CADR guest ingress fence could not complete",
    "the release-hook failure is not overwritten by a neutralization-pending announcement");
}

async function testIngressFenceAndVerifiedRearm() {
  const worker = new ManualWorker(); const timers = new ManualTimers(); const local = [];
  const m10 = {
    clean: false,
    status() { return { state: this.clean ? "CLEAN" : "RECOVERY_REQUIRED", open: this.clean, readOnly: !this.clean }; },
    async commitWrites() {}, async readBlock() {}, async invalidateAfterAmbiguousGuest() {},
  };
  const shell = shellFor(worker, timers, {
    m10Controller: m10,
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    releaseIngress({ cause }) { local.push(["detach-listeners", cause], ["invalidate-geometry"]); },
    restoreIngress({ frame }) { local.push(["attach-listeners", frame.byteLength]); },
  });

  shell.releaseInput("explicit-release");
  assert.deepEqual(local, [["detach-listeners", "explicit-release"], ["invalidate-geometry"]],
    "the injected listener/geometry fence runs before releaseInput returns");
  await waitForRequests(worker, 1);
  assert.equal(worker.requests[0].op, "pointer-neutralize");

  /* Public keyboard/pointer admission uses the shell's one v8 ID authority,
   * and therefore cannot sneak through a still-attached DOM callback. */
  let reply = await shell.submit(request(1, "keyboard-down", { code: "KeyQ", repeat: false }));
  assert.equal(reply.status, CADR_M13_STATUS.NOT_READY);
  assert.equal(worker.requests.length, 1, "fenced ingress emits no lower worker request");
  assert.equal(await shell.restoreInputIngress(), false, "no rearm before neutral input acknowledgement");

  worker.reply(worker.requests[0], { lifecycle: "PAUSED" }); await settle();
  assert.equal(await shell.restoreInputIngress(), false, "dirty or unopened M10 cannot rearm input");
  assert.equal(worker.requests.length, 1, "a dirty M10 check emits no display request");

  m10.clean = true;
  const restore = shell.restoreInputIngress(); await waitForRequests(worker, 2);
  assert.equal(worker.requests[1].op, "display-full");
  assert.deepEqual(local, [["detach-listeners", "explicit-release"], ["invalidate-geometry"]],
    "listeners remain detached while the full-frame handshake is pending");
  worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
  assert.equal(await restore, true);
  assert.deepEqual(local, [["detach-listeners", "explicit-release"], ["invalidate-geometry"],
    ["attach-listeners", 92544]]);

  const accepted = shell.submit(request(2, "keyboard-down", { code: "KeyQ", repeat: false }));
  await waitForRequests(worker, 3);
  assert.equal(worker.requests[2].op, "keyboard-down");
  worker.reply(worker.requests[2], { result: { accepted: false, reason: "core-not-running" }, reason: "core-not-running" });
  reply = await accepted; assert.equal(reply.status, 0, "the fake lower response proves only that rearmed ingress is dispatched");
}

async function testSecondReleaseInvalidatesPendingRestore() {
  const worker = new ManualWorker(); const timers = new ManualTimers(); const local = [];
  const m10 = {
    status() { return { state: "CLEAN", open: true, readOnly: false }; },
    async commitWrites() {}, async readBlock() {}, async invalidateAfterAmbiguousGuest() {},
  };
  const shell = shellFor(worker, timers, {
    m10Controller: m10,
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    releaseIngress({ cause }) { local.push(["detach", cause]); },
    restoreIngress() { local.push(["attach"]); },
  });

  shell.releaseInput("first-release"); await waitForRequests(worker, 1);
  worker.reply(worker.requests[0], { lifecycle: "PAUSED" }); await settle();
  const staleRestore = shell.restoreInputIngress(); await waitForRequests(worker, 2);
  assert.equal(worker.requests[1].op, "display-full");

  shell.releaseInput("second-release"); await waitForRequests(worker, 3);
  assert.equal(worker.requests[2].op, "pointer-neutralize",
    "a new release generation requires its own neutral acknowledgement");
  worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
  assert.equal(await staleRestore, false, "the old full-frame reply cannot rearm a newer release generation");
  assert.deepEqual(local, [["detach", "first-release"], ["detach", "second-release"]]);
  assert.equal(await shell.restoreInputIngress(), false,
    "the preceding generation's neutral acknowledgement cannot confirm the second release");
  assert.equal(worker.requests.length, 3, "no new full-frame request precedes the current neutral acknowledgement");
}

async function testConcurrentRestoreIsSingleFlight() {
  const worker = new ManualWorker(); const timers = new ManualTimers(); let attachments = 0;
  const m10 = {
    status() { return { state: "CLEAN", open: true, readOnly: false }; },
    async commitWrites() {}, async readBlock() {}, async invalidateAfterAmbiguousGuest() {},
  };
  const shell = shellFor(worker, timers, {
    m10Controller: m10,
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    releaseIngress() {}, restoreIngress() { attachments += 1; },
  });

  shell.releaseInput("single-flight-release"); await waitForRequests(worker, 1);
  worker.reply(worker.requests[0], { lifecycle: "PAUSED" }); await settle();
  const first = shell.restoreInputIngress();
  const second = shell.restoreInputIngress();
  assert.strictEqual(second, first, "concurrent restore callers share one promise");
  await waitForRequests(worker, 2);
  assert.equal(worker.requests.filter(candidate => candidate.op === "display-full").length, 1);
  worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(attachments, 1, "the shared restore attaches listeners once");
}

async function testRestoreHookFailuresAreTerminal() {
  for (const name of ["throw", "fulfilled thenable", "rejected thenable", "never-settling thenable"]) {
    const worker = new ManualWorker(); const timers = new ManualTimers(); const local = []; const statuses = [];
    let attached = false;
    const m10 = {
      status() { return { state: "CLEAN", open: true, readOnly: false }; },
      async commitWrites() {}, async readBlock() {}, async invalidateAfterAmbiguousGuest() {},
    };
    const shell = shellFor(worker, timers, {
      m10Controller: m10,
      m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
      statusSink: value => statuses.push(value),
      releaseIngress({ cause }) { attached = false; local.push(["detach", cause]); },
      restoreIngress() {
        if (name === "fulfilled thenable") {
          return Promise.resolve().then(() => { attached = true; local.push(["late-attach"]); });
        }
        attached = true; local.push(["partial-attach"]);
        if (name === "rejected thenable") return Promise.reject(new Error("async attach failed"));
        if (name === "never-settling thenable") return new Promise(() => {});
        throw new Error("attach failed");
      },
    });

    shell.releaseInput("failure-release"); await waitForRequests(worker, 1);
    worker.reply(worker.requests[0], { lifecycle: "PAUSED" }); await settle();
    const restore = shell.restoreInputIngress(); await waitForRequests(worker, 2);
    worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
    assert.equal(await restore, false, name);
    assert.equal(shell.state, "FAILED", name); assert.equal(worker.terminated, 1, name);
    assert.equal(statuses.at(-1), "CADR worker protocol failure; volatile state lost", `${name}: terminal status remains accurate`);
    await assert.rejects(shell.submit(request(1, "keyboard-down", { code: "KeyQ", repeat: false })),
      /terminal/, `${name}: semantic ingress is closed before any async cleanup`);
    await settle();
    const expected = ["throw", "never-settling thenable"].includes(name) ?
      [["detach", "failure-release"], ["partial-attach"], ["detach", "restore-ingress-failed"]] :
      (name === "fulfilled thenable" ?
        [["detach", "failure-release"], ["detach", "restore-ingress-failed"], ["late-attach"],
          ["detach", "restore-ingress-async-settled"]] :
        [["detach", "failure-release"], ["partial-attach"], ["detach", "restore-ingress-failed"],
          ["detach", "restore-ingress-async-settled"]]);
    assert.deepEqual(local, expected, `${name}: rollback follows every possible attachment phase`);
    assert.equal(attached, false, `${name}: no listener remains attached when restore reports failure`);
    const callsAfterFailure = local.length;
    assert.equal(await shell.restoreInputIngress(), false, `${name}: partial attachment is not retryable`);
    assert.equal(local.length, callsAfterFailure, `${name}: retry cannot duplicate attachment or rollback`);
  }
}

async function testReentrantReleaseDuringRestore() {
  const worker = new ManualWorker(); const timers = new ManualTimers(); const local = []; const statuses = [];
  let attached = false;
  const m10 = {
    status() { return { state: "CLEAN", open: true, readOnly: false }; },
    async commitWrites() {}, async readBlock() {}, async invalidateAfterAmbiguousGuest() {},
  };
  let shell;
  shell = shellFor(worker, timers, {
    m10Controller: m10,
    m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("not reached"); } }),
    statusSink: value => statuses.push(value),
    releaseIngress({ cause }) { attached = false; local.push(["detach", cause]); },
    restoreIngress() {
      shell.releaseInput("reentrant-release");
      attached = true; local.push(["attach-after-release"]);
    },
  });
  shell.releaseInput("initial-release"); await waitForRequests(worker, 1);
  worker.reply(worker.requests[0], { lifecycle: "PAUSED" }); await settle();
  const restore = shell.restoreInputIngress(); await waitForRequests(worker, 2);
  worker.reply(worker.requests[1], { full: true, frame: fullFrame() });
  assert.equal(await restore, false, "a release from inside the attach callback wins the generation race");
  assert.deepEqual(local, [["detach", "initial-release"], ["detach", "reentrant-release"],
    ["attach-after-release"], ["detach", "restore-ingress-reentrant-release"]]);
  assert.equal(attached, false, "the post-hook rollback removes attachment performed after reentrant release");
  assert.equal(shell.state, "FAILED"); assert.equal(worker.terminated, 1);
  assert.equal(statuses.at(-1), "CADR worker protocol failure; volatile state lost");
  await waitForRequests(worker, 3); assert.equal(worker.requests[2].op, "pointer-neutralize");
  const callsAfterFailure = local.length;
  assert.equal(await shell.restoreInputIngress(), false); assert.equal(local.length, callsAfterFailure);
  await assert.rejects(shell.submit(request(1, "keyboard-down", { code: "KeyQ", repeat: false })), /terminal/);
  assert.equal(worker.requests.length, 3, "the reentrant release keeps stale listeners outside worker authority");
}

function testDisposeFencesIngressSynchronously() {
  const worker = new ManualWorker(); const timers = new ManualTimers(); const local = [];
  const shell = shellFor(worker, timers, {
    releaseIngress({ cause }) { local.push(["detach-listeners", cause], ["invalidate-geometry"]); },
  });
  shell.dispose();
  assert.deepEqual(local, [["detach-listeners", "shell-disposed"], ["invalidate-geometry"]],
    "dispose closes ingress and runs the listener/geometry fence before returning");
  assert.equal(shell.state, "FAILED"); assert.equal(worker.terminated, 1);
  assert.equal(worker.requests.length, 0, "terminal close does not claim guest neutralization");
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
  const result = await shell.submit(request(1, "audio-open", {
    rendererProfile: "USIM-SDL3-SINE-330D8248-CANONICAL-v1" }));
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
await testIngressFenceAndVerifiedRearm();
await testSecondReleaseInvalidatesPendingRestore();
await testConcurrentRestoreIsSingleFlight();
await testRestoreHookFailuresAreTerminal();
await testReentrantReleaseDuringRestore();
testDisposeFencesIngressSynchronously();
await testWorkerLossMatrix();
await testProtocolMessageErrorAndTimeoutMatrix();
console.log("cadr M13 lifecycle/crash source matrix passed");
