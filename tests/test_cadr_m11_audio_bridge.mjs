import assert from "node:assert/strict";

import { CadrM11AudioBridge } from "../cadr-web/browser/cadr-m11-audio-bridge.mjs";

const calls = [];
const port = { posted: [], onmessage: null, postMessage(value) { this.posted.push(value); } };
let audioAvailable = true;
const request = async operation => {
  calls.push(operation);
  if (operation.op === "audio-peek" && audioAvailable) {
    audioAvailable = false;
    return { status: 0, generation: 1n, sequence: 9n, frameOffset: 0, framesRemaining: 2 };
  }
  if (operation.op === "audio-render") return { status: 0, frames: 2, pcmS16Le: new Int16Array([1, -1]).buffer };
  if (operation.op === "audio-ack") return { status: 0 };
  return { status: 9 };
};
const bridge = new CadrM11AudioBridge({ request, port });
assert.equal(await bridge.pump(), true);
assert.equal(await bridge.pump(), false, "a Worklet-held cursor cannot be rendered twice");
assert.equal(port.posted.length, 1);
await port.onmessage({ data: { type: "ack", generation: 1n, sequence: 9n, frameOffset: 0, frames: 2 } });
assert.equal(calls.filter(value => value.op === "audio-ack").length, 1);
assert.equal(port.posted.length, 1, "the next pump cannot replay an already consumed cursor");
await port.onmessage({ data: { type: "ack", generation: 1n, sequence: 9n, frameOffset: 0, frames: 2 } });
assert.equal(calls.filter(value => value.op === "audio-ack").length, 1, "duplicate Worklet acknowledgement is fenced");

/* Two Worklet callbacks can arrive before the asynchronous core acknowledgement
 * resolves.  Exactly one is permitted to cross that authority boundary. */
let releaseAck;
const heldAck = new Promise(resolve => { releaseAck = resolve; });
let raceAckCalls = 0;
const racePort = { posted: [], onmessage: null, postMessage(value) { this.posted.push(value); } };
let raceAvailable = true;
const raceBridge = new CadrM11AudioBridge({ port: racePort, request: async operation => {
  if (operation.op === "audio-peek" && raceAvailable) {
    raceAvailable = false;
    return { status: 0, generation: 3n, sequence: 11n, frameOffset: 0, framesRemaining: 1 };
  }
  if (operation.op === "audio-render") return { status: 0, frames: 1, pcmS16Le: new Int16Array([2]).buffer };
  if (operation.op === "audio-ack") { raceAckCalls += 1; await heldAck; return { status: 0 }; }
  return { status: 9 };
} });
assert.equal(await raceBridge.pump(), true);
const firstAck = racePort.onmessage({ data: { type: "ack", generation: 3n, sequence: 11n, frameOffset: 0, frames: 1 } });
const duplicateAck = racePort.onmessage({ data: { type: "ack", generation: 3n, sequence: 11n, frameOffset: 0, frames: 1 } });
await Promise.resolve();
assert.equal(raceAckCalls, 1, "only one concurrent Worklet callback may call audio-ack");
releaseAck();
await Promise.all([firstAck, duplicateAck]);
assert.equal(raceAckCalls, 1);

const uartCalls = []; const uartPort = { posted: [], onmessage: null, postMessage(value) { this.posted.push(value); } };
let peeked = false;
const uart = new CadrM11AudioBridge({ port: uartPort, request: async operation => {
  uartCalls.push(operation);
  if (operation.op === "audio-peek" && !peeked) { peeked = true; return { status: 0, generation: 2n, sequence: 10n, frameOffset: 0, framesRemaining: 0 }; }
  if (operation.op === "audio-ack") return { status: 0 };
  return { status: 9 };
} });
assert.equal(await uart.pump(), true);
assert.deepEqual(uartCalls.filter(value => value.op === "audio-ack").at(0),
  { op: "audio-ack", generation: 2n, sequence: 10n, frameOffset: 0, frames: 0 });
assert.equal(uartPort.posted.length, 0, "UART metadata is not invented as PCM");

console.log("cadr M11 bridge cursor and UART acknowledgement tests passed");
