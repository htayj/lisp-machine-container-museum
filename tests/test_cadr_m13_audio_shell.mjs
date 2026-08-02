import assert from "node:assert/strict";
import { CadrM13AudioBoundary, CadrM13WorkerAudioCore } from
  "../cadr-web/browser/cadr-m13-audio-boundary.mjs";
import { CadrM13Shell } from "../cadr-web/browser/cadr-m13-shell.mjs";
import { encodeCdrPcm1, sha256Hex } from "../cadr-web/browser/cadr-m13-audio-record.mjs";
import { CadrM13AudioSource } from "../cadr-web/wasm/cadr-m13-audio-source.mjs";

class Worker {
  listeners = new Map(); requests = []; terminated = 0;
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  removeEventListener() {}
  postMessage(value) { this.requests.push(value); }
  terminate() { this.terminated += 1; }
  emit(type, data) { for (const listener of this.listeners.get(type) ?? []) listener({ data }); }
}
class Port {
  messages = []; onmessage = null;
  postMessage(value) { this.messages.push(value); }
  reply(value) { this.onmessage?.({ data: value }); }
}
let epoch = 1n; const calls = []; const consumers = [];
const core = {
  async open() { calls.push(["open"]); return { status: 0, generation: 1n,
    consumerEpoch: ++epoch, queuePackets: 1, queuedFrames: 2 }; },
  async ack(value) { calls.push(["ack", value]); return { status: 0, queuePackets: 0, queuedFrames: 0 }; },
  async pause(value) { calls.push(["pause", value]); return { status: 0 }; },
  async deviceLost(value) { calls.push(["loss", value]); return { status: 0 }; },
};
const factory = { prepare() { const port = new Port(); const value = { port, disconnected: false,
  async start() {}, disconnect() { this.disconnected = true; } }; consumers.push(value); return value; } };
const boundary = new CadrM13AudioBoundary({ core, audioFactory: factory, now: () => 0,
  queueMicrotaskFn: callback => queueMicrotask(callback) });
const worker = new Worker(); const shell = new CadrM13Shell({ worker, audioBoundary: boundary,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x13) });
const request = (id, op, fields = {}) => ({ type: "cadr-request", version: 8,
  sessionId: shell.sessionId, id, op, ...fields });

/* The private worker reply retains its operation-specific payload beneath
 * `remainder`; the public boundary adapter must flatten exactly that payload. */
{
  const adapter = new CadrM13WorkerAudioCore({ request: async operation => ({
    status: 0, op: operation.op, remainder: { audio: { state: "READY", generation: 1n,
      consumerEpoch: 2n, queuePackets: 0, queuedFrames: 0 } },
  }) });
  assert.deepEqual(await adapter.open(), { status: 0, state: "READY", generation: 1n,
    consumerEpoch: 2n, queuePackets: 0, queuedFrames: 0 });
}

let reply = await shell.submit(request(1, "audio-open", {
  rendererProfile: "USIM-SDL3-SINE-330D8248-CANONICAL-v1" }));
assert.equal(reply.status, 0); assert.equal(reply.audio.state, "BLOCKED_AUTOPLAY");
assert.equal(calls.length, 0, "autoplay refusal precedes core session open");
assert.equal(shell.prepareAudioActivation(), true);
reply = await shell.submit(request(2, "audio-resume"));
assert.equal(reply.audio.consumerEpoch, 2n); assert.equal(consumers[0].port.messages.length, 0,
  "no non-normative Worklet control message is emitted");

const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 2n, sequence: 0n,
  frameOffset: 0, samples: new Int16Array([1, -1]) });
worker.emit("message", { type: "cadr-event", version: 8, sessionId: shell.sessionId,
  event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 2n, record,
  recordSha256: await sha256Hex(record) });
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(consumers[0].port.messages.at(-1).type, "cadr-audio-pcm");
consumers[0].port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
  consumerEpoch: 1n, sequence: 0n, frameOffset: 0 });
await Promise.resolve(); assert.equal(calls.some(value => value[0] === "ack"), false, "stale ack is fenced");
consumers[0].port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
for (let index = 0; index < 8; index += 1) await Promise.resolve();
assert.equal(calls.filter(value => value[0] === "ack").length, 1);

reply = await shell.submit(request(3, "audio-pause"));
assert.equal(reply.audio.state, "PAUSED"); assert.equal(consumers[0].disconnected, true);
assert.equal(shell.prepareAudioActivation(), true);
reply = await shell.submit(request(4, "audio-resume"));
assert.equal(reply.audio.consumerEpoch, 3n);
worker.emit("error"); assert.equal(consumers[1].disconnected, true, "worker loss fences audio before disposal");

/* End-to-end synthetic source -> unsolicited worker envelope -> public shell ->
 * Worklet ack -> private exact-frame lower acknowledgement. */
{
  const lower = []; const events = []; const integrationWorker = new Worker();
  const openBytes = new Uint8Array(48); openBytes.set(new TextEncoder().encode("CDRM11O1"));
  const openView = new DataView(openBytes.buffer); openView.setUint32(8, 1, true); openView.setUint32(12, 48, true);
  openView.setBigUint64(16, 1n, true); openView.setBigUint64(24, 7n, true);
  openView.setBigUint64(32, 2n, true); openView.setUint32(40, 1, true); openView.setUint32(44, 2, true);
  let offered = true;
  const source = new CadrM13AudioSource({ emit: event => { events.push(event); integrationWorker.emit("message", event); },
    invoke: async operation => {
      lower.push(operation);
      if (operation.op === "audio-open-private") return { status: 0, record: openBytes.buffer.slice(0) };
      if (operation.op === "audio-peek" && offered) { offered = false; return { status: 0,
        generation: 1n, sequence: 0n, frameOffset: 0, framesRemaining: 2 }; }
      if (operation.op === "audio-render") return { status: 0, frames: 2,
        pcmS16Le: new Int16Array([2, -2]).buffer };
      if (operation.op === "audio-ack") return { status: 0, queuePackets: 0, queuedFrames: 0 };
      return { status: 9 };
    } });
  const integrationConsumers = [];
  const integrationBoundary = new CadrM13AudioBoundary({ core: source,
    audioFactory: { prepare() { const port = new Port(); const consumer = { port,
      async start() {}, disconnect() {} }; integrationConsumers.push(consumer); return consumer; } }, now: () => 0 });
  const integrationShell = new CadrM13Shell({ worker: integrationWorker, audioBoundary: integrationBoundary,
    sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x24) });
  const integrationRequest = (id, op, fields = {}) => ({ type: "cadr-request", version: 8,
    sessionId: integrationShell.sessionId, id, op, ...fields });
  integrationShell.prepareAudioActivation();
  assert.equal((await integrationShell.submit(integrationRequest(1, "audio-open", {
    rendererProfile: "USIM-SDL3-SINE-330D8248-CANONICAL-v1" }))).audio.consumerEpoch, 7n);
  assert.equal(await source.pump(integrationShell.sessionId), true);
  await new Promise(resolve => setTimeout(resolve, 10));
  const delivered = integrationConsumers[0].port.messages.at(-1);
  integrationConsumers[0].port.reply({ type: "cadr-audio-ack", version: 1,
    generation: delivered.generation, consumerEpoch: delivered.consumerEpoch,
    sequence: delivered.sequence, frameOffset: delivered.frameOffset });
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  assert.deepEqual(lower.filter(value => value.op === "audio-ack").at(-1), { op: "audio-ack",
    generation: 1n, sequence: 0n, frameOffset: 0, frames: 2 });
  integrationShell.dispose();
}
console.log("cadr M13 public shell autoplay/epoch/ack/pause/resume/loss tests passed");
