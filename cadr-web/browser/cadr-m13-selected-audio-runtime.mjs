/* Runtime evidence harness. The selected ABI1.11 worker/core owns session epochs,
 * but the two PCM records below are explicitly synthetic downstream fixtures:
 * this harness never claims that the selected guest generated them. */
import { CADR_M13_AUDIO_PROFILE, encodeCdrPcm1, sha256Hex } from
  "./cadr-m13-audio-record.mjs";
import { CADR_M13_PROTOCOL_VERSION, CadrM13Shell } from "./cadr-m13-shell.mjs";
import { BrowserAudioFactory } from "./cadr-m13-browser-audio-factory.mjs";

const status = document.querySelector("#status");
const realWorker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), {
  type: "module", name: "cadr-m13-selected-audio-runtime",
});

function publicValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof ArrayBuffer) return { byteLength: value.byteLength };
  if (Array.isArray(value)) return value.map(publicValue);
  if (value !== null && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, publicValue(item)]));
  return value;
}

class TracedWorker {
  listeners = new Map(); requests = []; responses = [];
  constructor(worker) {
    this.worker = worker;
    for (const type of ["message", "messageerror", "error"]) worker.addEventListener(type, event => {
      if (type === "message") this.responses.push(publicValue(event.data));
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    });
  }
  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== listener));
  }
  postMessage(value, transfer) { this.requests.push(publicValue(value)); this.worker.postMessage(value, transfer ?? []); }
  terminate() { this.worker.terminate(); }
  inject(value) {
    const event = { data: value };
    for (const listener of this.listeners.get("message") ?? []) listener(event);
  }
}

const worker = new TracedWorker(realWorker);
const audioFactory = new BrowserAudioFactory();
const shellStatuses = [];
const shell = new CadrM13Shell({ worker, audioFactory, timeoutMs: 10000,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x29),
  statusSink: text => { shellStatuses.push(text); } });
let publicId = 1; let fixtureIndex = 0;
const publicResults = []; const injected = [];
const request = (op, fields = {}) => Object.freeze({ type: "cadr-request",
  version: CADR_M13_PROTOCOL_VERSION, sessionId: shell.sessionId,
  id: publicId++, op, ...fields });

async function bootstrap() {
  const response = await fetch(new URL("../build/cadr-web-m13-audio-O2.wasm", import.meta.url),
    { cache: "no-store" });
  if (!response.ok) throw new Error(`selected ABI1.11 fetch failed: ${response.status}`);
  const wasmBytes = await response.arrayBuffer();
  const wasmSha256 = await sha256Hex(wasmBytes);
  const result = await shell.submit(request("bootstrap", { wasmBytes, wasmSha256 }));
  publicResults.push(publicValue(result));
  if (result.status !== 0) throw new Error(`selected ABI1.11 bootstrap status ${result.status}`);
  status.textContent = "Selected ABI1.11 worker ready; audio has not been opened.";
  return { wasmSha256, wasmBytes: wasmBytes.byteLength };
}
const ready = bootstrap();

async function startAudio(op) {
  await ready;
  if (!shell.prepareAudioActivation()) throw new Error("synchronous audio preparation refused");
  const result = await shell.submit(request(op, op === "audio-open" ?
    { rendererProfile: CADR_M13_AUDIO_PROFILE } : {}));
  publicResults.push(publicValue(result));
  status.textContent = `${op} status ${result.status}, epoch ${result.audio?.consumerEpoch ?? "none"}`;
  return result;
}

document.querySelector("#start-audio").addEventListener("click", () => { void startAudio("audio-open"); });
document.querySelector("#pause-audio").addEventListener("click", async () => {
  const result = await shell.submit(request("audio-pause")); publicResults.push(publicValue(result));
  status.textContent = `audio-pause status ${result.status}`;
});
document.querySelector("#resume-audio").addEventListener("click", () => { void startAudio("audio-resume"); });

document.querySelector("#inject-audio").addEventListener("click", async () => {
  const state = publicResults.at(-1)?.audio;
  if (state?.state !== "READY") throw new Error("synthetic injection requires READY audio");
  if (fixtureIndex >= 2) throw new Error("all synthetic fixtures have already been injected");
  const generation = BigInt(state.generation), consumerEpoch = BigInt(state.consumerEpoch);
  const packets = [new Int16Array(512), new Int16Array(88)];
  packets[0][0] = 0x1234; packets[0][511] = -0x1234;
  packets[1][0] = 0x2345; packets[1][87] = -0x2345;
  const index = fixtureIndex++;
  const record = encodeCdrPcm1({ generation, consumerEpoch,
    sequence: BigInt(10 + index), frameOffset: 0, samples: packets[index] });
  const recordSha256 = await sha256Hex(record);
  const pcmSha256 = await sha256Hex(packets[index].buffer);
  injected.push(Object.freeze({ origin: "synthetic-downstream-fixture",
    frames: packets[index].length, sequence: String(10 + index),
    generation: String(generation), consumerEpoch: String(consumerEpoch),
    recordSha256, pcmSha256 }));
  worker.inject({ type: "cadr-event", version: 8, sessionId: shell.sessionId,
    event: "audio-pcm", eventOrdinal: 1n, consumerEpoch, record, recordSha256 });
  status.textContent = `Injected labelled ${packets[index].length}-frame synthetic record in epoch ${consumerEpoch}.`;
});

function state() {
  return publicValue({ shellState: shell.state, publicResults, injected,
    activationAtPrepare: audioFactory.activation,
    contexts: audioFactory.contexts.map(entry => ({ state: entry.context.state,
      sampleRate: entry.context.sampleRate, disconnected: entry.disconnected })),
    workerRequests: worker.requests, workerResponses: worker.responses, shellStatuses,
    status: status.textContent });
}

globalThis.cadrM13SelectedAudioRuntime = Object.freeze({ ready, state,
  dispose() { shell.dispose(); } });
