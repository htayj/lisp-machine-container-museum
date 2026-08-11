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
  async pause(value) { calls.push(["pause", value]); return { status: 0,
    queuePackets: 0, queuedFrames: 0 }; },
  async deviceLost(value) { calls.push(["loss", value]); return { status: 0,
    queuePackets: 0, queuedFrames: 0 }; },
  terminalRelease(value) { calls.push(["terminal", value]); return true; },
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

/* Terminal revocation rejects new adapter requests but preserves an already
 * in-flight open payload for the boundary's post-settlement epoch tombstone. */
{
  let resolve;
  const gate = new Promise(done => { resolve = done; });
  const adapter = new CadrM13WorkerAudioCore({ request: async () => gate });
  const pending = adapter.open();
  assert.equal(adapter.terminalRelease(), true);
  resolve({ status: 0, remainder: { audio: { generation: 1n, consumerEpoch: 7n,
    queuePackets: 0, queuedFrames: 0 } } });
  assert.deepEqual(await pending, { status: 0, generation: 1n, consumerEpoch: 7n,
    queuePackets: 0, queuedFrames: 0 });
  assert.deepEqual(await adapter.open(), { status: 9 });
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
const stagedPromise = boundary.waitForWorkletStaged({ generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
consumers[0].port.reply({ type: "cadr-audio-staged", version: 1, generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
assert.equal((await stagedPromise).kind, "worklet-staged");
consumers[0].port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
  consumerEpoch: 1n, sequence: 0n, frameOffset: 0 });
await Promise.resolve(); assert.equal(calls.some(value => value[0] === "ack"), false, "stale ack is fenced");
consumers[0].port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
const committedPromise = boundary.waitForAckCommitted({ generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0 });
for (let index = 0; index < 8; index += 1) await Promise.resolve();
assert.equal(calls.filter(value => value[0] === "ack").length, 1);
assert.deepEqual(await committedPromise, { kind: "ack-committed", generation: 1n,
  consumerEpoch: 2n, sequence: 0n, frameOffset: 0, queuePackets: 0,
  queuedFrames: 0 });

reply = await shell.submit(request(3, "audio-pause"));
assert.equal(reply.audio.state, "PAUSED"); assert.equal(consumers[0].disconnected, true);
assert.equal(shell.prepareAudioActivation(), true);
reply = await shell.submit(request(4, "audio-resume"));
assert.equal(reply.audio.consumerEpoch, 3n);
worker.emit("error"); for (let index = 0; index < 12; index += 1) await Promise.resolve();
assert.equal(consumers[1].disconnected, true, "worker loss fences audio before disposal");

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function microtasks(count = 12) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}
async function admitRaceRecord(boundaryValue, consumer, consumerEpoch, sequence = 0n) {
  const bytes = encodeCdrPcm1({ generation: 1n, consumerEpoch, sequence,
    frameOffset: 0, samples: new Int16Array([3, -3]) });
  assert.equal(await boundaryValue.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "race", event: "audio-pcm", eventOrdinal: sequence + 1n,
    consumerEpoch, record: bytes, recordSha256: await sha256Hex(bytes) }, "race"), true);
  const identity = { generation: 1n, consumerEpoch, sequence, frameOffset: 0 };
  consumer.port.reply({ type: "cadr-audio-ack", version: 1, ...identity });
  await microtasks();
  return identity;
}

/* A digest that spans a lifecycle transition retains no authority.  Rechecking
 * the captured consumer, epoch, generation, ordinal, and control admission keeps
 * the old event from posting to or reporting loss against a fresh consumer. */
for (const transition of ["pause-resume", "loss-resume", "close"]) {
  const digestEntered = deferred(); const digestGate = deferred(); const digestCalls = [];
  const digestConsumers = []; let digestEpoch = 100n;
  const digestCore = {
    async open() { digestCalls.push("open"); return { status: 0, generation: 1n,
      consumerEpoch: ++digestEpoch, queuePackets: 1, queuedFrames: 2 }; },
    async ack() { digestCalls.push("ack"); return { status: 0, queuePackets: 0, queuedFrames: 0 }; },
    async pause() { digestCalls.push("pause"); return { status: 0, queuePackets: 1, queuedFrames: 2 }; },
    async deviceLost() { digestCalls.push("loss"); return { status: 0, queuePackets: 1, queuedFrames: 2 }; },
    terminalRelease() { digestCalls.push("terminal"); return true; },
  };
  const digestBoundary = new CadrM13AudioBoundary({ core: digestCore, audioFactory: {
    prepare() { const port = new Port(); const consumer = { port, disconnected: false,
      async start() {}, disconnect() { this.disconnected = true; } };
      digestConsumers.push(consumer); return consumer; } }, now: () => 0,
    sha256Fn: async () => { digestEntered.resolve(); return digestGate.promise; } });
  digestBoundary.prepareActivation();
  await digestBoundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const bytes = encodeCdrPcm1({ generation: 1n, consumerEpoch: 101n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([8, -8]) });
  const expectedDigest = await sha256Hex(bytes);
  const admission = digestBoundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "digest-race", event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 101n,
    record: bytes, recordSha256: expectedDigest }, "digest-race");
  await digestEntered.promise;
  if (transition === "pause-resume") {
    assert.equal((await digestBoundary.pause()).status, 0);
    assert.equal(digestBoundary.prepareActivation(), true);
    assert.equal((await digestBoundary.resume()).audio.consumerEpoch, 102n);
  } else if (transition === "loss-resume") {
    assert.equal(digestBoundary.deviceLost(), true);
    for (let index = 0; index < 30 && digestBoundary.state().state !== "DEVICE_LOST"; index += 1) {
      await Promise.resolve();
    }
    assert.equal(digestBoundary.prepareActivation(), true);
    assert.equal((await digestBoundary.resume()).audio.consumerEpoch, 102n);
  } else { digestBoundary.closeForWorkerLoss(); await microtasks(); }
  digestGate.resolve(expectedDigest);
  assert.equal(await admission, false, `${transition} fences an old event after its awaited digest`);
  assert.equal(digestConsumers.flatMap(value => value.port.messages).length, 0,
    `${transition} old bytes never reach a Worklet`);
  assert.equal(digestCalls.filter(value => value === "loss").length,
    transition === "loss-resume" ? 1 : 0, `${transition} uses ordinary loss only when nonterminal`);
  assert.equal(digestCalls.filter(value => value === "terminal").length,
    transition === "close" ? 1 : 0, `${transition} uses terminal release only on close`);
}

/* Core operations form one lifecycle tail.  An older admitted acknowledgement
 * publishes its authoritative mutation and receipt before a later pause runs. */
{
  const ackGate = deferred(); const order = []; const raceConsumers = []; let raceEpoch = 40n;
  const raceCore = {
    async open() { return { status: 0, generation: 1n, consumerEpoch: ++raceEpoch,
      queuePackets: 7, queuedFrames: 99 }; },
    async ack() { order.push("ack-start"); const result = await ackGate.promise;
      order.push("ack-end"); return result; },
    async pause() { order.push("pause"); return { status: 0,
      queuePackets: 6, queuedFrames: 97 }; },
    async deviceLost() { order.push("loss"); return { status: 0,
      queuePackets: 6, queuedFrames: 97 }; },
    terminalRelease() { order.push("terminal"); return true; },
  };
  const raceBoundary = new CadrM13AudioBoundary({ core: raceCore, audioFactory: {
    prepare() { const port = new Port(); const consumer = { port, async start() {}, disconnect() {} };
      raceConsumers.push(consumer); return consumer; } }, now: () => 0 });
  assert.equal(raceBoundary.prepareActivation(), true);
  assert.equal((await raceBoundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1")).status, 0);
  const oldIdentity = await admitRaceRecord(raceBoundary, raceConsumers[0], 41n);
  const committed = raceBoundary.waitForAckCommitted(oldIdentity);
  const neverStaged = raceBoundary.waitForWorkletStaged(oldIdentity);
  let pauseSettled = false;
  let commitSettled = false; committed.then(() => { commitSettled = true; });
  const pauseResult = raceBoundary.pause().then(value => { pauseSettled = true; return value; });
  await microtasks();
  assert.equal(pauseSettled, false, "pause must wait behind the older core ack");
  assert.equal(commitSettled, false, "an executing ack receipt is not retired by later pause admission");
  ackGate.resolve({ status: 0, queuePackets: 6, queuedFrames: 97 });
  assert.deepEqual(await committed, { kind: "ack-committed", generation: 1n,
    consumerEpoch: 41n, sequence: 0n, frameOffset: 0,
    queuePackets: 6, queuedFrames: 97 });
  assert.equal((await pauseResult).status, 0);
  assert.equal((await neverStaged).kind, "stale");
  assert.deepEqual(order, ["ack-start", "ack-end", "pause"]);
  assert.deepEqual(raceBoundary.state(), { state: "PAUSED", generation: 1n,
    consumerEpoch: 41n, queuePackets: 6, queuedFrames: 97 },
  "pause publishes the same authoritative counts retained by the core");
  assert.equal(raceBoundary.prepareActivation(), true);
  assert.equal((await raceBoundary.resume()).audio.consumerEpoch, 42n);
  const newIdentity = await admitRaceRecord(raceBoundary, raceConsumers[1], 42n);
  const newCommitted = await raceBoundary.waitForAckCommitted(newIdentity);
  assert.equal(newCommitted.kind, "ack-committed", "fresh epoch commits after old epoch retirement");
}

for (const control of ["device-loss", "worker-close"]) {
  const ackGate = deferred(); const raceConsumers = [];
  const raceBoundary = new CadrM13AudioBoundary({ core: {
    async open() { return { status: 0, generation: 1n, consumerEpoch: 51n,
      queuePackets: 3, queuedFrames: 6 }; },
    async ack() { return ackGate.promise; }, async pause() { return { status: 0,
      queuePackets: 0, queuedFrames: 0 }; },
    async deviceLost() { return { status: 0, queuePackets: 0, queuedFrames: 0 }; },
    terminalRelease() { return true; },
  }, audioFactory: { prepare() { const port = new Port(); const consumer = { port,
    async start() {}, disconnect() {} }; raceConsumers.push(consumer); return consumer; } }, now: () => 0 });
  raceBoundary.prepareActivation(); await raceBoundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const identity = await admitRaceRecord(raceBoundary, raceConsumers[0], 51n);
  const committed = raceBoundary.waitForAckCommitted(identity);
  const staged = raceBoundary.waitForWorkletStaged(identity);
  if (control === "device-loss") assert.equal(raceBoundary.deviceLost(), true);
  else raceBoundary.closeForWorkerLoss();
  await microtasks();
  ackGate.resolve({ status: 0, queuePackets: 0, queuedFrames: 0 });
  await microtasks();
  assert.equal((await committed).kind, control === "device-loss" ? "ack-committed" : "stale",
    `${control} preserves only nonterminal older acknowledgement evidence`);
  assert.equal((await staged).kind, "stale", `${control} settles staging waiter`);
  assert.equal(raceBoundary.state().queuePackets, control === "device-loss" ? 0 : 3,
    `${control} retains only counts settled before terminal revocation`);
  assert.equal(raceBoundary.state().queuedFrames, control === "device-loss" ? 0 : 6,
    `${control} retains only frames settled before terminal revocation`);
}

function lifecycleHarness(methods) {
  const order = []; const raceConsumers = []; let active = 0; let maximumActive = 0;
  const invoke = async (name, operation) => {
    order.push(`${name}-start`); active += 1; maximumActive = Math.max(maximumActive, active);
    try { return await operation(); }
    finally { active -= 1; order.push(`${name}-end`); }
  };
  const core = {
    open: () => invoke("open", methods.open), ack: value => invoke("ack", () => methods.ack(value)),
    pause: value => invoke("pause", () => methods.pause(value)),
    deviceLost: value => invoke("loss", () => methods.deviceLost(value)),
    terminalRelease: value => methods.terminalRelease?.(value) ?? true,
  };
  const boundaryValue = new CadrM13AudioBoundary({ core, audioFactory: {
    prepare() { const port = new Port(); const consumer = { port, disconnected: false,
      async start() {}, disconnect() { this.disconnected = true; } };
      raceConsumers.push(consumer); return consumer; } }, now: () => 0 });
  return { boundary: boundaryValue, consumers: raceConsumers, order,
    get maximumActive() { return maximumActive; } };
}

for (const failure of ["throw", "rejected", "invalid"]) {
  let attempts = 0; let live = 0; let maximumLive = 0; const activationConsumers = [];
  const activationBoundary = new CadrM13AudioBoundary({ core: {
    async open() {
      attempts += 1;
      if (attempts === 1 && failure === "throw") throw new Error("injected open failure");
      if (attempts === 1 && failure === "rejected") return { status: 7 };
      if (attempts === 1 && failure === "invalid") return { status: 0, generation: 0n,
        consumerEpoch: 1n, queuePackets: 0, queuedFrames: 0 };
      return { status: 0, generation: 1n, consumerEpoch: 121n,
        queuePackets: 2, queuedFrames: 20 };
    },
    async ack() { assert.fail("unexpected ack"); },
    async pause() { return { status: 0, queuePackets: 2, queuedFrames: 20 }; },
    async deviceLost() { return { status: 0, queuePackets: 2, queuedFrames: 20 }; },
    terminalRelease() { return true; },
  }, audioFactory: { prepare() { live += 1; maximumLive = Math.max(maximumLive, live);
    const port = new Port(); const consumer = { port, disconnected: false, starts: 0,
      async start() { this.starts += 1; }, disconnect() {
        if (!this.disconnected) { this.disconnected = true; live -= 1; }
      } }; activationConsumers.push(consumer); return consumer; } }, now: () => 0 });
  assert.equal(activationBoundary.prepareActivation(), true);
  const failed = await activationBoundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  assert.equal(failed.status, failure === "rejected" ? 7 : 9);
  assert.equal(activationConsumers[0].starts, 1, `${failure} follows successful candidate.start`);
  assert.equal(activationConsumers[0].disconnected, true, `${failure} disconnects rejected candidate`);
  assert.equal(live, 0); assert.equal(activationBoundary.state().state, "PAUSED");
  assert.equal(activationBoundary.prepareActivation(), true, `${failure} permits an explicit fresh retry`);
  assert.equal((await activationBoundary.resume()).status, 0);
  assert.equal(live, 1); assert.equal(maximumLive, 1, `${failure} leaks no overlapping context`);
  activationBoundary.closeForWorkerLoss(); await microtasks(); assert.equal(live, 0);
}

/* Terminal close admitted while core.open is unresolved fences that completion:
 * it cannot install a consumer or leave the successfully started context live. */
{
  const openGate = deferred(); let live = 0; let maximumLive = 0; let openStarted = false;
  const activationConsumers = [];
  const activationBoundary = new CadrM13AudioBoundary({ core: {
    async open() { openStarted = true; return openGate.promise; },
    async ack() { assert.fail("unexpected ack"); }, async pause() { assert.fail("unexpected pause"); },
    async deviceLost() { assert.fail("unexpected loss"); },
    terminalRelease() { return true; },
  }, audioFactory: { prepare() { live += 1; maximumLive = Math.max(maximumLive, live);
    const port = new Port(); const consumer = { port, disconnected: false,
      async start() {}, disconnect() { if (!this.disconnected) { this.disconnected = true; live -= 1; } } };
    activationConsumers.push(consumer); return consumer; } }, now: () => 0 });
  activationBoundary.prepareActivation();
  const opening = activationBoundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  for (let index = 0; index < 20 && !openStarted; index += 1) await Promise.resolve();
  assert.equal(openStarted, true); activationBoundary.closeForWorkerLoss();
  openGate.resolve({ status: 0, generation: 1n, consumerEpoch: 131n,
    queuePackets: 1, queuedFrames: 10 });
  assert.equal((await opening).status, 9, "close epoch-fences unresolved open completion");
  await microtasks();
  assert.equal(activationConsumers[0].disconnected, true); assert.equal(live, 0);
  assert.equal(maximumLive, 1); assert.equal(activationBoundary.state().state, "DEVICE_LOST");
  assert.equal(activationBoundary.prepareActivation(), false, "terminal close denies retry");
}

/* pause -> ack: the pause reducer action retires the epoch before the later ack
 * can enter the lifecycle queue, so the stale ack never mutates the core. */
{
  const h = lifecycleHarness({
    async open() { return { status: 0, generation: 1n, consumerEpoch: 61n,
      queuePackets: 7, queuedFrames: 99 }; },
    async ack() { assert.fail("pause-ordered-first ack reached core"); },
    async pause() { return { status: 0, queuePackets: 7, queuedFrames: 99 }; },
    async deviceLost() { assert.fail("unexpected loss"); },
  });
  h.boundary.prepareActivation(); await h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const bytes = encodeCdrPcm1({ generation: 1n, consumerEpoch: 61n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([5]) });
  assert.equal(await h.boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "pause-first", event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 61n,
    record: bytes, recordSha256: await sha256Hex(bytes) }, "pause-first"), true);
  const paused = h.boundary.pause();
  h.consumers[0].port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
    consumerEpoch: 61n, sequence: 0n, frameOffset: 0 });
  assert.equal((await paused).status, 0);
  assert.deepEqual(h.order, ["open-start", "open-end", "pause-start", "pause-end"]);
  assert.deepEqual(h.boundary.state(), { state: "PAUSED", generation: 1n,
    consumerEpoch: 61n, queuePackets: 7, queuedFrames: 99 });
  assert.equal(h.maximumActive, 1);
}

/* ack -> loss: the older acknowledgement commits first; the loss then adopts
 * the core's post-ack snapshot without overlapping either operation. */
{
  const ackGate = deferred(); let coreCounts = { queuePackets: 7, queuedFrames: 99 };
  const h = lifecycleHarness({
    async open() { return { status: 0, generation: 1n, consumerEpoch: 71n, ...coreCounts }; },
    async ack() { const result = await ackGate.promise; coreCounts = result; return { status: 0, ...coreCounts }; },
    async pause() { assert.fail("unexpected pause"); },
    async deviceLost() { return { status: 0, ...coreCounts }; },
  });
  h.boundary.prepareActivation(); await h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  const identity = await admitRaceRecord(h.boundary, h.consumers[0], 71n);
  const committed = h.boundary.waitForAckCommitted(identity);
  assert.equal(h.boundary.deviceLost(), true); await microtasks();
  ackGate.resolve({ queuePackets: 6, queuedFrames: 97 });
  assert.equal((await committed).kind, "ack-committed");
  for (let index = 0; index < 30 && h.boundary.state().state !== "DEVICE_LOST"; index += 1) await Promise.resolve();
  assert.deepEqual(h.order, ["open-start", "open-end", "ack-start", "ack-end", "loss-start", "loss-end"]);
  assert.deepEqual({ queuePackets: h.boundary.state().queuePackets,
    queuedFrames: h.boundary.state().queuedFrames }, coreCounts);
  assert.equal(h.maximumActive, 1);
}

for (const control of ["pause", "loss"]) {
  const gate = deferred(); let nextEpoch = 80n;
  const h = lifecycleHarness({
    async open() { return { status: 0, generation: 1n, consumerEpoch: ++nextEpoch,
      queuePackets: 4, queuedFrames: 40 }; },
    async ack() { assert.fail("unexpected ack"); },
    async pause() { return gate.promise; }, async deviceLost() { return gate.promise; },
  });
  h.boundary.prepareActivation(); await h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1");
  let pausePromise = null;
  if (control === "pause") pausePromise = h.boundary.pause();
  else assert.equal(h.boundary.deviceLost(), true);
  await microtasks();
  assert.equal(h.boundary.prepareActivation(), false, `${control} pending fences preparation`);
  assert.equal((await h.boundary.resume()).status, 9, `${control} pending fences reopen`);
  gate.resolve({ status: 0, queuePackets: 4, queuedFrames: 40 });
  if (pausePromise !== null) assert.equal((await pausePromise).status, 0);
  else for (let index = 0; index < 30 && h.boundary.state().state !== "DEVICE_LOST"; index += 1) await Promise.resolve();
  assert.equal(h.boundary.prepareActivation(), true);
  assert.equal((await h.boundary.resume()).audio.consumerEpoch, 82n);
  assert.deepEqual(h.order, ["open-start", "open-end", `${control}-start`, `${control}-end`,
    "open-start", "open-end"]);
  assert.equal(h.maximumActive, 1, `${control} and reopen never overlap`);
}

/* close is terminal at admission and epoch-fences an unresolved earlier open;
 * the core call may settle, but its candidate cannot become a live consumer. */
{
  const openGate = deferred();
  const h = lifecycleHarness({
    async open() { await openGate.promise; return { status: 0, generation: 1n,
      consumerEpoch: 91n, queuePackets: 2, queuedFrames: 20 }; },
    async ack() { assert.fail("unexpected ack"); }, async pause() { assert.fail("unexpected pause"); },
    async deviceLost() { assert.fail("unexpected loss"); },
  });
  assert.equal(h.boundary.prepareActivation(), true);
  const opening = h.boundary.open("USIM-SDL3-SINE-330D8248-CANONICAL-v1"); await microtasks();
  h.boundary.closeForWorkerLoss();
  assert.equal((await h.boundary.resume()).status, 9, "terminal close rejects later open");
  assert.equal(h.boundary.prepareActivation(), false, "terminal close rejects later preparation");
  openGate.resolve(); assert.equal((await opening).status, 9); await microtasks();
  assert.deepEqual(h.order, ["open-start", "open-end"]);
  assert.equal(h.consumers[0].disconnected, true);
  assert.equal(h.boundary.state().state, "DEVICE_LOST");
  assert.equal(h.maximumActive, 1);
}

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
  integrationConsumers[0].port.reply({ type: "cadr-audio-staged", version: 1,
    generation: delivered.generation, consumerEpoch: delivered.consumerEpoch,
    sequence: delivered.sequence, frameOffset: delivered.frameOffset });
  await integrationBoundary.waitForWorkletStaged(delivered);
  integrationConsumers[0].port.reply({ type: "cadr-audio-ack", version: 1,
    generation: delivered.generation, consumerEpoch: delivered.consumerEpoch,
    sequence: delivered.sequence, frameOffset: delivered.frameOffset });
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  const committed = await integrationBoundary.waitForAckCommitted({ generation: delivered.generation,
    consumerEpoch: delivered.consumerEpoch, sequence: delivered.sequence,
    frameOffset: delivered.frameOffset });
  assert.equal(committed.queuePackets, 0); assert.equal(source.inFlightRecords, 0);
  assert.deepEqual(lower.filter(value => value.op === "audio-ack").at(-1), { op: "audio-ack",
    generation: 1n, sequence: 0n, frameOffset: 0, frames: 2 });
  integrationShell.dispose();
}
console.log("cadr M13 public shell autoplay/epoch/ack/pause/resume/loss tests passed");
