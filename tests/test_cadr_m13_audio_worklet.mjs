import assert from "node:assert/strict";
import { CadrM13PcmQueue } from "../cadr-web/browser/cadr-m13-audio-worklet.mjs";

const queue = new CadrM13PcmQueue(); assert.equal(queue.open(2n), true);
const message = sequence => ({ type: "cadr-audio-pcm", version: 1, generation: 1n,
  consumerEpoch: 2n, sequence: BigInt(sequence), frameOffset: 0,
  samples: new Int16Array([32767, -32768]).buffer });
for (let index = 0; index < 8; index += 1) assert.equal(queue.enqueue(message(index)), true);
assert.equal(queue.enqueue(message(8)), false, "ninth whole record is backpressured");
assert.equal(queue.enqueue({ ...message(8), consumerEpoch: 1n }), false, "stale epoch is fenced");
let acknowledgements = queue.render(new Float32Array(1));
assert.equal(acknowledgements.length, 0, "partial render cannot acknowledge");
acknowledgements = queue.render(new Float32Array(1));
assert.deepEqual(acknowledgements[0], { type: "cadr-audio-ack", version: 1,
  generation: 1n, consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
queue.close(); assert.equal(queue.queuedRecords, 0); assert.equal(queue.enqueue(message(9)), false);

let Processor = null; const posted = [];
globalThis.AudioWorkletProcessor = class { constructor() { this.port = {
  onmessage: null, postMessage(value) { posted.push(value); } }; } };
globalThis.registerProcessor = (_name, implementation) => { Processor = implementation; };
await import(`../cadr-web/browser/cadr-m13-audio-worklet.mjs?processor-test=${Date.now()}`);
const processor = new Processor();
processor.port.onmessage({ data: message(20) });
assert.deepEqual(posted, [{ type: "cadr-audio-staged", version: 1,
  generation: 1n, consumerEpoch: 2n, sequence: 20n, frameOffset: 0 }],
"processor reports staging only after enqueue owns the record");
processor.process([], [[new Float32Array(2)]]);
assert.deepEqual(posted[1], { type: "cadr-audio-ack", version: 1,
  generation: 1n, consumerEpoch: 2n, sequence: 20n, frameOffset: 0 },
"render acknowledgement remains distinct from staging");
delete globalThis.AudioWorkletProcessor; delete globalThis.registerProcessor;
console.log("cadr M13 Worklet whole-record/backpressure/epoch tests passed");
