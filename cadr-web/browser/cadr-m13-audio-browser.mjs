/* Browser-only component probe for M13's future audio boundary.  It has no
 * CADR machine, v8 shell, storage, or synthetic fallback; PCM is a fixed test
 * fixture and the bridge still waits for the real AudioWorklet acknowledgement.
 * Its narrow purpose is to observe a direct user gesture, AudioContext/
 * AudioWorklet lifecycle, and browser microtask reducer turns. */
import { CadrM11AudioBridge } from "./cadr-m11-audio-bridge.mjs";
import { CadrM13AudioReducer } from "./cadr-m13-audio-reducer.mjs";

const start = document.querySelector("#cadr-m13-audio-start");
const startClose = document.querySelector("#cadr-m13-audio-start-close");
const startFault = document.querySelector("#cadr-m13-audio-start-fault");
const status = document.querySelector("#cadr-m13-audio-status");
const fixture = new Int16Array(128);
fixture[0] = 16384; fixture[1] = -16384;

let context = null;
let node = null;
let bridge = null;
let epoch = 0n;
let offered = false;
const trace = [];
const setStatus = value => { status.textContent = value; };

function publicTrace() {
  return trace.map(entry => Object.freeze({ ...entry,
    generation: entry.generation?.toString(), consumerEpoch: entry.consumerEpoch?.toString(),
    sequence: entry.sequence?.toString() }));
}

async function startAudio({ fault = false } = {}) {
  if (context !== null) throw new Error("audio context is already open");
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (AudioContextConstructor === undefined) throw new Error("AudioContext is unavailable");
  epoch += 1n; offered = true;
  context = new AudioContextConstructor();
  await context.audioWorklet.addModule(fault ? "./cadr-m13-audio-fault-worklet.mjs" : "./cadr-m11-audio-worklet.mjs");
  node = new AudioWorkletNode(context, fault ? "cadr-m13-audio-fault" : "cadr-m11-audio", { numberOfInputs: 0, numberOfOutputs: 1,
    outputChannelCount: [1] });
  const generation = epoch;
  bridge = new CadrM11AudioBridge({ port: node.port, request: async request => {
    trace.push(Object.freeze({ ...request, generation: request.generation, consumerEpoch: epoch,
      sequence: request.sequence }));
    if (request.op === "audio-peek") {
      if (!offered) return Object.freeze({ status: 9 });
      offered = false;
      return Object.freeze({ status: 0, generation, sequence: 1n, frameOffset: 0, framesRemaining: fixture.length });
    }
    if (request.op === "audio-render") {
      return Object.freeze({ status: 0, frames: fixture.length, pcmS16Le: fixture.slice().buffer });
    }
    if (request.op === "audio-ack") return Object.freeze({ status: 0 });
    return Object.freeze({ status: 9 });
  } });
  const processorError = () => {
    bridge.close();
    trace.push(Object.freeze({ op: "processorerror", consumerEpoch: epoch }));
    setStatus("CADR AudioWorklet processor failed; no guest acknowledgement was invented.");
  };
  /* Keep both standard event spellings: Chromium's AudioWorkletNode exposes
   * the EventTarget listener and the explicit handler property. */
  node.addEventListener("processorerror", processorError);
  node.onprocessorerror = processorError;
  node.connect(context.destination);
  await context.resume();
  const pumped = await bridge.pump(fixture.length);
  if (!pumped || context.state !== "running") throw new Error("direct user gesture did not start the AudioContext");
  setStatus("CADR audio context running; awaiting AudioWorklet acknowledgement.");
  return state();
}

async function closeAudio() {
  if (context === null) return state();
  bridge.close(); node.disconnect(); await context.close();
  context = null; node = null; bridge = null;
  setStatus("CADR audio context closed; no guest acknowledgement was invented.");
  return state();
}

function state() {
  const acknowledgements = trace.filter(entry => entry.op === "audio-ack").length;
  return Object.freeze({ epoch: epoch.toString(), contextState: context?.state ?? "closed",
    acknowledgements, trace: publicTrace(), status: status.textContent });
}

/* Exercise the real M11 AudioWorklet queue at its native 8,192-frame limit.
 * This does not pretend to be a CADR core queue: the two records are synthetic
 * diagnostic PCM sent straight to a second real Worklet port.  The first fills
 * the queue; even if rendering begins before it receives the second record,
 * fewer than 8,192 cells can have drained, so the second full record must be
 * rejected.  The test therefore observes actual Worklet backpressure without
 * relying on a timing-sensitive burst of tiny records. */
async function workletBackpressureProbe() {
  if (context === null || context.state !== "running") {
    throw new Error("a direct-user-activated audio context is required");
  }
  const probe = new AudioWorkletNode(context, "cadr-m11-audio", {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
  });
  probe.connect(context.destination);
  const result = await new Promise((resolve, reject) => {
    let rejected = 0;
    const timer = setTimeout(() => {
      probe.port.onmessage = null;
      reject(new Error("AudioWorklet did not report bounded queue rejection"));
    }, 3000);
    probe.port.onmessage = event => {
      if (event.data?.type !== "rejected") return;
      rejected += 1;
      clearTimeout(timer);
      probe.port.onmessage = null;
      resolve(Object.freeze({ rejected }));
    };
    for (const sequence of [1n, 2n]) {
      const pcm = new Int16Array(8192);
      probe.port.postMessage({ type: "pcm", generation: 99n, sequence,
        frameOffset: 0, frames: pcm.length, pcmS16Le: pcm.buffer }, [pcm.buffer]);
    }
  });
  probe.disconnect();
  trace.push(Object.freeze({ op: "worklet-backpressure", rejected: result.rejected }));
  return Object.freeze({ rejected: result.rejected, frameLimit: 8192 });
}

async function reducerBrowserTasks() {
  let time = 0;
  const actions = [];
  const reducer = new CadrM13AudioReducer({ now: () => time,
    queueMicrotask: callback => globalThis.queueMicrotask(callback),
    onAction: action => actions.push(action) });
  const record = Object.freeze({ generation: 1n, consumerEpoch: 1n, sequence: 1n, frameOffset: 0 });
  if (!reducer.open(1n) || !reducer.post(record)) throw new Error("reducer setup failed");
  time = 2000;
  /* These three calls intentionally occupy one actual browser task; its queued
   * microtask must sort device-error before pause/deadline/ack. */
  reducer.acknowledge(record); reducer.pause(); reducer.deviceLost();
  await Promise.resolve();
  const sameTask = actions.map(action => ({ kind: action.kind, cause: action.cause ?? null }));

  let laterTime = 0;
  const laterActions = [];
  const later = new CadrM13AudioReducer({ now: () => laterTime,
    queueMicrotask: callback => globalThis.queueMicrotask(callback),
    onAction: action => laterActions.push(action) });
  later.open(2n);
  const laterRecord = Object.freeze({ generation: 1n, consumerEpoch: 2n, sequence: 1n, frameOffset: 0 });
  later.post(laterRecord); laterTime = 2000;
  await new Promise(resolve => setTimeout(() => { later.deadlineTick(); resolve(); }, 0));
  await Promise.resolve();
  await new Promise(resolve => setTimeout(() => { later.deviceLost(); resolve(); }, 0));
  await Promise.resolve();
  const highWater = new CadrM13AudioReducer({ now: () => 0,
    queueMicrotask: callback => globalThis.queueMicrotask(callback), onAction: () => {} });
  highWater.open(3n);
  const accepted = [];
  for (let sequence = 1; sequence <= 9; sequence += 1) {
    accepted.push(highWater.post({ generation: 1n, consumerEpoch: 3n,
      sequence: BigInt(sequence), frameOffset: 0 }));
  }
  return Object.freeze({ sameTask, separateTasks: laterActions.map(action =>
    ({ kind: action.kind, cause: action.cause ?? null })), highWater: Object.freeze({
    accepted, queuedRecords: highWater.queuedRecords,
  }) });
}

start.addEventListener("click", async () => {
  try { await startAudio(); }
  catch (error) { setStatus(`CADR audio start failed: ${error.message}`); }
});
startClose.addEventListener("click", async () => {
  try { await startAudio(); await closeAudio(); }
  catch (error) { setStatus(`CADR audio start/close failed: ${error.message}`); }
});
startFault.addEventListener("click", async () => {
  try { await startAudio({ fault: true }); }
  catch (error) { setStatus(`CADR failing audio start failed: ${error.message}`); }
});
window.cadrM13AudioBrowserHarness = Object.freeze({ state, closeAudio,
  reducerBrowserTasks, workletBackpressureProbe });
