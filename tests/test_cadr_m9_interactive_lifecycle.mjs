import assert from "node:assert/strict";
import {
  CADR_M9_BROWSER_STATES,
  CADR_M9_CDRSTATE6_BYTES,
  CADR_M9_WORKER_STATES,
  CadrM9InteractiveLifecycle,
  parseCdrState6Pointer,
  serializeCdrState6Pointer,
} from "../cadr-web/wasm/cadr-m9-interactive-lifecycle.mjs";
import { CADR_M9_KEYBOARD_ALL_UP, CadrM9PointerController } from "../cadr-web/wasm/cadr-m9-pointer.mjs";

{
  const bytes = serializeCdrState6Pointer({ legacyY: 962, legacyX: 767, buttons: 7,
    warpPending: true, previousCursorState: 3, warpX: 20, warpY: 30, warpGeneration: 99 });
  assert.equal(bytes.byteLength, CADR_M9_CDRSTATE6_BYTES);
  assert.deepEqual(parseCdrState6Pointer(bytes), { legacyY: 962, legacyX: 767, buttons: 7,
    warpPending: true, previousCursorState: 3, warpX: 20, warpY: 30, warpGeneration: 99 });
  for (const offset of [6, 7, 20, 21, 22, 23]) {
    const mutant = bytes.slice(); mutant[offset] = 1;
    assert.throws(() => parseCdrState6Pointer(mutant), /reserved/);
  }
  const badWarp = bytes.slice(); new DataView(badWarp.buffer).setUint16(12, 768, true);
  assert.throws(() => parseCdrState6Pointer(badWarp), /outside EDGE32/);
}

function activeLifecycle() {
  const pointer = new CadrM9PointerController();
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer });
  assert.equal(lifecycle.enable({ visible: true, layoutValid: true, focused: true }).accepted, true);
  assert.equal(lifecycle.activate().accepted, true);
  return { pointer, lifecycle };
}

{
  const { lifecycle } = activeLifecycle();
  const before = lifecycle.snapshot();
  assert.equal(lifecycle.enable({ visible: true, layoutValid: true, focused: true }).reason,
    "enable-requires-disabled-neutral");
  assert.deepEqual(lifecycle.snapshot(), before, "enable cannot rewrite an active lifecycle");
}

/* Each trigger produces exactly one atomic deactivation tail, and a repeated
 * event is idempotent rather than inventing more mouse-up/all-up input. */
for (const trigger of ["blur", "focusOutGroup", "visibilityHidden", "lostCapture", "pause", "layoutInvalidated"]) {
  const { pointer, lifecycle } = activeLifecycle();
  pointer.buttonDown({ domButton: 0, x: 9, y: 9 }); pointer.buttonDown({ domButton: 2, x: 9, y: 9 });
  assert.equal(lifecycle.captureAcquired().accepted, true);
  const result = lifecycle[trigger]({ tick: 33n });
  assert.equal(result.accepted, true, trigger); assert.equal(lifecycle.browserState, CADR_M9_BROWSER_STATES.SUSPENDED);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.PAUSED);
  assert.equal(result.noGuestInstructionBetween, true);
  const entries = pointer.drain();
  assert.deepEqual(entries.slice(-3).map(entry => entry.type), ["pointer-edge", "pointer-edge", "keyboard-all-up"]);
  assert.deepEqual(entries.slice(-3, -1).map(entry => entry.edge.changedMask), [4, 1]);
  assert.equal(entries.at(-1).value, CADR_M9_KEYBOARD_ALL_UP);
  assert.equal(lifecycle[trigger]({ tick: 34n }).reason, "already-deactivated", trigger);
}

{
  const { pointer, lifecycle } = activeLifecycle();
  pointer.buttonDown({ domButton: 0, x: 3, y: 4 });
  const result = lifecycle.setLayout({ valid: false, visible: true, focused: true, tick: 8n });
  assert.equal(result.accepted, true);
  assert.equal(lifecycle.browserState, CADR_M9_BROWSER_STATES.SUSPENDED);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.PAUSED);
  assert.deepEqual(pointer.snapshot().queue.slice(-2).map(entry => entry.type),
    ["pointer-edge", "keyboard-all-up"], "invalid layout uses the atomic deactivation tail");
}

for (const injected of ["throw", "reject"]) {
  const { pointer, lifecycle } = activeLifecycle();
  pointer.buttonDown({ domButton: 0, x: 5, y: 6 });
  pointer.neutralize = injected === "throw" ? (() => { throw new Error("injected neutralization"); }) :
    (() => Object.freeze({ accepted: false, reason: "injected-neutralization-rejection" }));
  const result = lifecycle.pause({ tick: 17n });
  assert.equal(result.accepted, false);
  assert.equal(result.action, "fail-stop");
  assert.equal(lifecycle.browserState, CADR_M9_BROWSER_STATES.TERMINAL);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.FAILED);
  assert.equal(pointer.queueLength, 0);
  assert.equal(pointer.buttons, 0);
  assert.equal(lifecycle.stop().reason, "already-terminal");
  assert.equal(lifecycle.crash().reason, "already-terminal");
  assert.equal(lifecycle.enable().reason, "terminal");
  assert.equal(lifecycle.setLayout({ valid: true }).reason, "terminal");
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.FAILED,
    "terminal failure is absorbing and cannot be relabeled stopped");
}

{
  const { pointer, lifecycle } = activeLifecycle();
  pointer.buttonDown({ domButton: 1, x: 2, y: 2 }); lifecycle.captureAcquired();
  lifecycle.blur(); pointer.drain();
  assert.equal(lifecycle.acknowledgeNeutralization().accepted, true);
  lifecycle.setLayout({ valid: true, visible: true, focused: true });
  assert.equal(lifecycle.resume().accepted, true);
  assert.equal(lifecycle.browserState, CADR_M9_BROWSER_STATES.ACTIVE);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.ACTIVE);
  assert.equal(pointer.buttonDown({ domButton: 0, x: 2, y: 2, generation: 0 }).reason, "stale-generation");
}

{
  const pointer = new CadrM9PointerController({ generation: 0xffffffff });
  const lifecycle = new CadrM9InteractiveLifecycle({ pointer });
  lifecycle.enable({ visible: true, layoutValid: true, focused: true }); lifecycle.activate();
  assert.equal(lifecycle.pause().reason, "epoch-exhausted");
  assert.equal(pointer.queueLength, 0, "generation exhaustion fails before a neutralization mutation");
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.FAILED);
}

{
  const { pointer, lifecycle } = activeLifecycle();
  lifecycle.pause();
  assert.equal(lifecycle.snapshotEligibility().eligible, false, "queued neutralization is not snapshot eligible");
  pointer.drain(); assert.equal(lifecycle.acknowledgeNeutralization().accepted, true);
  assert.deepEqual(lifecycle.snapshotEligibility(), { eligible: true, reason: "host-dom-state-excluded" });
  const calls = [];
  assert.equal(lifecycle.reset({ coreReset: () => calls.push("reset"), fullRefresh: () => calls.push("refresh") }).accepted, true);
  assert.deepEqual(calls, ["reset", "refresh"]);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.PAUSED);
  assert.equal(lifecycle.reset({ coreReset: () => { throw new Error("synthetic"); } }).accepted, false);
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.FAILED);
  assert.equal(lifecycle.browserState, CADR_M9_BROWSER_STATES.TERMINAL);
}

{
  const { pointer, lifecycle } = activeLifecycle();
  pointer.buttonDown({ domButton: 0, x: 0, y: 0 });
  lifecycle.stop();
  assert.equal(pointer.queueLength, 0, "terminal stop discards rather than invents guest releases");
  assert.equal(lifecycle.workerState, CADR_M9_WORKER_STATES.STOPPED);
  assert.equal(lifecycle.shouldWarnBeforeUnload("DIRTY"), true);
  for (const state of ["CLEAN", "SAVE_FAILED", "RECOVERY_REQUIRED", "unknown", null]) {
    assert.equal(lifecycle.shouldWarnBeforeUnload(state), false, `only M10 DIRTY warns (${state})`);
  }
}

{
  const { pointer, lifecycle } = activeLifecycle();
  lifecycle.pause(); pointer.drain(); lifecycle.acknowledgeNeutralization();
  const before = lifecycle.epoch;
  assert.equal(lifecycle.restoreNeutral().accepted, true);
  assert.equal(lifecycle.epoch, before + 1);
  lifecycle.setLayout({ valid: true, visible: true, focused: true });
  assert.equal(lifecycle.acknowledgeNeutralization().accepted, true);
  assert.equal(lifecycle.resume().accepted, false, "restore requires fresh warp handshake");
  assert.equal(lifecycle.acknowledgeRestoreWarpHandshake().accepted, true);
  assert.equal(lifecycle.resume().accepted, true);
}

console.log("cadr M9 interactive lifecycle tests passed");
