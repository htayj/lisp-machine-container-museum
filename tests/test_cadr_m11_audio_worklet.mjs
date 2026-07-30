import assert from "node:assert/strict";

import { CadrM11PcmQueue } from "../cadr-web/browser/cadr-m11-audio-worklet.mjs";

const queue = new CadrM11PcmQueue();
const pcm = new Int16Array([0, 16384, -16384]).buffer;
assert.equal(queue.enqueue({ type: "pcm", generation: 1n, sequence: 2n,
  frameOffset: 4, frames: 3, pcmS16Le: pcm }), true);
assert.equal(queue.queuedFrames, 3);
let output = new Float32Array(2);
assert.deepEqual(queue.render(output), []);
assert.deepEqual([...output], [0, 0.5]);
assert.equal(queue.queuedFrames, 1);
output = new Float32Array(2);
const acknowledgements = queue.render(output);
assert.deepEqual([...output], [-0.5, 0]);
assert.deepEqual(acknowledgements, [{ type: "ack", generation: 1n, sequence: 2n,
  frameOffset: 4, frames: 3 }]);
assert.equal(queue.enqueue({ type: "pcm", generation: 1n, sequence: 3n,
  frameOffset: 0, frames: 2, pcmS16Le: new Int16Array([1, 2]).buffer }), true);
assert.equal(queue.clearGeneration(2n), true);
assert.equal(queue.queuedFrames, 0, "generation replacement discards stale PCM before playback");

console.log("cadr M11 AudioWorklet queue tests passed");
