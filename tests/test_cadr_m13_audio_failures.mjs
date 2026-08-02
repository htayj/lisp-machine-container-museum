import assert from "node:assert/strict";
import { CadrM13AudioBoundary } from "../cadr-web/browser/cadr-m13-audio-boundary.mjs";
import { encodeCdrPcm1, sha256Hex } from "../cadr-web/browser/cadr-m13-audio-record.mjs";

class Port { messages = []; onmessage = null; postMessage(value) { this.messages.push(value); } }
function harness() {
  let now = 0; const timers = []; const calls = []; const port = new Port();
  const consumer = { port, disconnected: false, async start() {}, disconnect() { this.disconnected = true; } };
  const core = { async open() { return { status: 0, generation: 1n, consumerEpoch: 2n,
    queuePackets: 1, queuedFrames: 1 }; }, async ack(value) { calls.push(["ack", value]); return { status: 0,
    queuePackets: 0, queuedFrames: 0 }; }, async pause(value) { calls.push(["pause", value]); return { status: 0 }; },
  async deviceLost(value) { calls.push(["loss", value]); return { status: 0 }; } };
  const boundary = new CadrM13AudioBoundary({ core, audioFactory: { prepare: () => consumer },
    now: () => now, queueMicrotaskFn: callback => queueMicrotask(callback),
    setTimeoutFn(callback, milliseconds) { const timer = { callback, milliseconds, cleared: false }; timers.push(timer); return timer; },
    clearTimeoutFn(timer) { timer.cleared = true; } });
  return { boundary, calls, consumer, port, timers, set now(value) { now = value; } };
}
async function post(h) {
  h.boundary.prepareActivation(); await h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 2n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([1]) });
  assert.equal(await h.boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "aa".repeat(32), event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 2n,
    record, recordSha256: await sha256Hex(record) }, "aa".repeat(32)), true);
}
{
  const h = harness(); await post(h); h.now = 2000; h.timers[0].callback();
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(h.consumer.disconnected, true); assert.equal(h.calls.some(value => value[0] === "ack"), false);
  assert.equal(h.calls.find(value => value[0] === "loss")[1].cause, "reply-timeout");
}
for (const cause of ["processorerror", "context-closed", "device-loss"]) {
  const h = harness(); await post(h); assert.equal(h.boundary.deviceLost(cause), true);
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.equal(h.calls.find(value => value[0] === "loss")[1].cause, cause);
  assert.equal(h.timers[0].cleared, true); assert.equal(h.consumer.disconnected, true);
}
{
  const h = harness(); h.boundary.prepareActivation();
  await h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const stale = encodeCdrPcm1({ generation: 2n, consumerEpoch: 2n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([1]) });
  assert.equal(await h.boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "aa".repeat(32), event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 2n,
    record: stale, recordSha256: await sha256Hex(stale) }, "aa".repeat(32)), false);
  assert.equal(h.port.messages.length, 0, "wrong-generation PCM never reaches Worklet");
  assert.equal(h.timers.length, 0, "wrong-generation PCM starts no deadline");
}
{
  const h = harness(); await post(h);
  const pending = h.boundary.pause();
  h.port.onmessage({ data: { type: "cadr-audio-ack", version: 1, generation: 1n,
    consumerEpoch: 2n, sequence: 0n, frameOffset: 0 } });
  assert.equal((await pending).status, 0);
  assert.equal(h.calls.some(value => value[0] === "ack"), false, "same-turn pause fences acknowledgement");
}
console.log("cadr M13 timeout/device/pause lifecycle tests passed");
