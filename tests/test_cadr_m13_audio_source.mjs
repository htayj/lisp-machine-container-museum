import assert from "node:assert/strict";
import { CadrM13AudioSource } from "../cadr-web/wasm/cadr-m13-audio-source.mjs";
import { parseCdrPcm1 } from "../cadr-web/browser/cadr-m13-audio-record.mjs";

function openRecord(epoch) {
  const bytes = new Uint8Array(48); bytes.set(new TextEncoder().encode("CDRM11O1"));
  const view = new DataView(bytes.buffer); view.setUint32(8, 1, true); view.setUint32(12, 48, true);
  view.setBigUint64(16, 1n, true); view.setBigUint64(24, epoch, true);
  view.setBigUint64(32, 2n, true); view.setUint32(40, 2, true); view.setUint32(44, 2, true);
  return bytes.buffer;
}
let epoch = 1n; let peeks = 0; const calls = []; const events = [];
const invoke = async operation => {
  calls.push(operation);
  if (operation.op === "audio-open-private") return { status: 0, record: openRecord(++epoch) };
  if (operation.op === "audio-peek") return peeks++ === 0 ?
    { status: 0, generation: 1n, sequence: 0n, frameOffset: 0, framesRemaining: 0 } :
    { status: 0, generation: 1n, sequence: 1n, frameOffset: 0, framesRemaining: 2 };
  if (operation.op === "audio-render") return { status: 0, frames: 2,
    pcmS16Le: new Int16Array([1, -1]).buffer };
  if (operation.op === "audio-ack") return { status: 0, queuePackets: 1, queuedFrames: 2 };
  return { status: 9 };
};
const source = new CadrM13AudioSource({ invoke, emit: event => events.push(event) });
assert.equal((await source.open()).consumerEpoch, 2n);
assert.equal(await source.pump("aa".repeat(32)), true);
assert.equal(events.length, 1, "zero-frame semantic UART produces no Worklet cell");
assert.deepEqual(calls.find(value => value.op === "audio-ack"), { op: "audio-ack",
  generation: 1n, sequence: 0n, frameOffset: 0, frames: 0 });
const pcm = parseCdrPcm1(events[0].record); assert.equal(pcm.sequence, 1n);
assert.equal((await source.ack({ generation: 1n, consumerEpoch: 1n, sequence: 1n, frameOffset: 0 })).status, 3);
assert.equal((await source.ack(pcm)).status, 0);
assert.deepEqual(calls.filter(value => value.op === "audio-ack").at(-1), { op: "audio-ack",
  generation: 1n, sequence: 1n, frameOffset: 0, frames: 2 }, "private source restores exact frame count");
assert.deepEqual(await source.pause({ consumerEpoch: 2n }),
  { status: 0, queuePackets: 1, queuedFrames: 2 },
  "pause returns the authoritative counts used by the public lifecycle boundary");
assert.equal((await source.open()).consumerEpoch, 3n, "resume obtains a fresh core epoch");
assert.deepEqual(await source.deviceLost({ consumerEpoch: 3n }),
  { status: 0, queuePackets: 2, queuedFrames: 2 },
  "device loss returns the same authoritative core snapshot");

let sequence = 0n; const heldEvents = [];
const held = new CadrM13AudioSource({ emit: event => heldEvents.push(event), invoke: async operation => {
  if (operation.op === "audio-open-private") return { status: 0, record: openRecord(10n) };
  if (operation.op === "audio-peek") return { status: 0, generation: 1n, sequence: sequence++,
    frameOffset: 0, framesRemaining: 1 };
  if (operation.op === "audio-render") return { status: 0, frames: 1,
    pcmS16Le: new Int16Array([1]).buffer };
  throw new Error("unexpected acknowledgement");
} });
await held.open();
for (let index = 0; index < 8; index += 1) assert.equal(await held.pump("bb".repeat(32)), true);
assert.equal(await held.pump("bb".repeat(32)), false);
assert.equal(held.inFlightRecords, 8); assert.equal(heldEvents.length, 8);

let partialHead = 0; const partialEvents = []; const partialCalls = [];
const partial = new CadrM13AudioSource({ emit: event => partialEvents.push(event), invoke: async operation => {
  partialCalls.push(operation);
  if (operation.op === "audio-open-private") return { status: 0, record: openRecord(20n) };
  if (operation.op === "audio-peek") return partialHead === 0 ?
    { status: 0, generation: 1n, sequence: 10n, frameOffset: 0, framesRemaining: 512 } :
    { status: 0, generation: 1n, sequence: 11n, frameOffset: 0, framesRemaining: 88 };
  if (operation.op === "audio-render") return { status: 0, frames: operation.requestedFrames,
    pcmS16Le: new Int16Array(operation.requestedFrames).buffer };
  if (operation.op === "audio-ack") { partialHead += 1; return { status: 0,
    queuePackets: partialHead === 1 ? 1 : 0, queuedFrames: partialHead === 1 ? 88 : 0 }; }
  return { status: 9 };
} });
await partial.open(); await partial.pump("cc".repeat(32));
let partialRecord = parseCdrPcm1(partialEvents[0].record); assert.equal(partialRecord.frameCount, 512);
assert.equal((await partial.ack(partialRecord)).status, 0);
await partial.pump("cc".repeat(32));
partialRecord = parseCdrPcm1(partialEvents[1].record); assert.equal(partialRecord.frameCount, 88);
assert.equal(partialCalls.filter(value => value.op === "audio-render").length, 2,
  "a greater-than-512-frame job is repumped as bounded packet records");

let noProgressPeeks = 0;
const bounded = new CadrM13AudioSource({ emit: () => { throw new Error("zero-frame record emitted"); },
  invoke: async operation => {
    if (operation.op === "audio-open-private") return { status: 0, record: openRecord(30n) };
    if (operation.op === "audio-peek") { noProgressPeeks += 1; return {
      status: 0, generation: 1n, sequence: 30n, frameOffset: 0, framesRemaining: 0 }; }
    if (operation.op === "audio-ack") return { status: 0, queuePackets: 2, queuedFrames: 2 };
    return { status: 9 };
  } });
await bounded.open(); assert.equal(await bounded.pump("dd".repeat(32)), false);
assert.equal(noProgressPeeks, 64, "automatic pump is bounded by the frozen core packet capacity");
console.log("cadr M13 private source zero-frame/frame-authority/epoch tests passed");
