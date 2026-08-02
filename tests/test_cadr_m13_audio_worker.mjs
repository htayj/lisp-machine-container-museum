import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { parseCdrDisp1 } from "../cadr-web/wasm/cadr-display-renderer.mjs";
import { copyRequestForStrictVersion } from
  "../cadr-web/wasm/cadr-worker-request-adapter.mjs";

/* Same-realm proof: unlike worker_threads structured cloning, this exercises
 * the exact pure adapter and can observe reference identity and mutation. */
const callerInput = { version: 8, id: 41, op: "keyboard-state", marker: { retained: true } };
const strictInput = copyRequestForStrictVersion(callerInput, 6);
assert.notStrictEqual(strictInput, callerInput); assert.equal(strictInput.version, 6);
assert.equal(strictInput.id, callerInput.id); assert.strictEqual(strictInput.marker, callerInput.marker);
assert.equal(callerInput.version, 8); assert.equal(Object.isFrozen(strictInput), true);
const callerDebug = { version: 8, id: 42, op: "debug-state" };
const strictDebug = copyRequestForStrictVersion(callerDebug, 7);
assert.notStrictEqual(strictDebug, callerDebug); assert.equal(strictDebug.version, 7);
assert.equal(callerDebug.version, 8);
assert.strictEqual(copyRequestForStrictVersion(strictInput, 6), strictInput,
  "an already-strict request needs no copy or mutation");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = await WebAssembly.compile(await readFile(
  resolve(root, "cadr-web/build/cadr-web-m13-audio-O0.wasm")));
const worker = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
const messages = []; const waiters = [];
worker.on("message", value => { const waiter = waiters.shift(); if (waiter) waiter(value); else messages.push(value); });
const next = () => messages.length ? Promise.resolve(messages.shift()) : new Promise((resolveNext, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out waiting for M13 audio worker")), 10000);
  waiters.push(value => { clearTimeout(timer); resolveNext(value); });
});
const request = async value => { worker.postMessage(value); return next(); };
try {
  let reply = await request({ version: 8, id: 1, op: "instantiate", module,
    sessionId: "13".repeat(32) });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8);

  /* ABI 1.11's private v8 worker composition must retain the caller's v8
   * response while exercising the selected M7 display implementation. */
  reply = await request({ version: 8, id: 2, op: "display-full" });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8); assert.equal(reply.full, true);
  assert.equal(parseCdrDisp1(reply.frame).full, true);

  /* M8/M9 are strict v6 subhandlers.  The v8 worker must copy/re-version the
   * request internally, then re-version the result without changing the
   * caller's object. */
  reply = await request({ version: 8, id: 3, op: "input-state" });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8);
  assert.equal(new TextDecoder().decode(new Uint8Array(reply.observation).subarray(0, 8)), "CDRIOB91");
  const input = { version: 8, id: 4, op: "keyboard-down", code: "KeyQ", repeat: false };
  reply = await request(input);
  assert.equal(input.version, 8, "worker adaptation never mutates caller input");
  assert.equal(reply.status, 9); assert.equal(reply.version, 8); assert.equal(reply.reason, "core-not-running");
  reply = await request({ version: 8, id: 5, op: "keyboard-state" });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8); assert.deepEqual(reply.result.heldCodes, []);

  /* M12 remains strict v7 internally even when reached through the ABI 1.11
   * v8 composition envelope. */
  reply = await request({ version: 8, id: 6, op: "debug-breakpoint-set", slot: 3,
    breakpoint: { kind: 1, value: 0n } });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8); assert.equal(reply.result.slot, 3);

  /* A wrong-version message is not silently delegated to a lower parser and
   * does not consume the next valid v8 ID. */
  reply = await request({ version: 7, id: 7, op: "debug-breakpoint-clear", slot: 3 });
  assert.equal(reply.type, "cadr-error"); assert.equal(reply.version, 8);
  assert.equal(reply.id, 7); assert.equal(reply.code, "malformed-message");
  reply = await request({ version: 8, id: 7, op: "debug-breakpoint-clear", slot: 3 });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8);

  reply = await request({ version: 8, id: 8, op: "debug-breakpoint-clear", slot: -1 });
  assert.equal(reply.status, 2); assert.equal(reply.version, 8,
    "a v8 invalid debugger shape remains a v8 response after strict-v7 rejection");

  reply = await request({ version: 8, id: 9, op: "m13-audio-open" });
  assert.equal(reply.status, 0); assert.deepEqual(reply.audio, { state: "READY", generation: 1n,
    consumerEpoch: 2n, queuePackets: 0, queuedFrames: 0 });
  assert.equal(messages.length, 0, "empty actual core emits no fabricated PCM event");
  reply = await request({ version: 8, id: 10, op: "m13-audio-pause", consumerEpoch: 2n });
  assert.equal(reply.status, 0); assert.equal(reply.audio.state, "PAUSED");
  reply = await request({ version: 8, id: 11, op: "m13-audio-resume" });
  assert.equal(reply.status, 0); assert.equal(reply.audio.consumerEpoch, 3n,
    "real worker calls the actual core-issued epoch export on resume");
} finally { await worker.terminate(); }
console.log("cadr M13 real worker/ABI1.11 audio source ownership test passed");
