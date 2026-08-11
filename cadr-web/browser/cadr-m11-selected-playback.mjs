/* Browser evidence for selected-Wasm M11 pause/resume continuity.  The
 * CDRAUDS1 input is an independent synthetic fixed-table fixture, not guest
 * output.  A real AudioWorklet consumes the retained selected-core packet. */
import { CadrM13AudioBoundary } from "./cadr-m13-audio-boundary.mjs";
import { BrowserAudioFactory } from "./cadr-m13-browser-audio-factory.mjs";
import { CADR_M13_AUDIO_PROFILE, parseCdrPcm1, sha256Hex } from
  "./cadr-m13-audio-record.mjs";
import { CadrM13AudioSource } from "../wasm/cadr-m13-audio-source.mjs";

const status = document.querySelector("#status");
const sessionId = "31".repeat(32);
const decoder = new TextDecoder();
const u64low = value => Number(value & 0xffffffffn);
const u64high = value => Number((value >> 32n) & 0xffffffffn);

function fromHex(value) {
  if (typeof value !== "string" || value.length < 376 || value.length % 2 !== 0 ||
      !/^[0-9a-f]+$/.test(value)) throw new TypeError("synthetic CDRAUDS1 fixture is invalid");
  return new Uint8Array(value.match(/../g).map(byte => Number.parseInt(byte, 16)));
}

function snapshotState(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (decoder.decode(bytes.subarray(0, 8)) !== "CDRAUDS1" || view.getUint32(8, true) !== 1 ||
      view.getUint32(12, true) !== bytes.byteLength) throw new TypeError("selected snapshot is invalid");
  return Object.freeze({ sha256: null, bytes: bytes.byteLength,
    headSequence: String(view.getBigUint64(24, true)),
    nextSequence: String(view.getBigUint64(32, true)),
    queuedFrames: String(view.getBigUint64(56, true)), packetCount: view.getUint32(88, true) });
}

async function createSelectedCore() {
  const [wasmResponse, fixtureResponse] = await Promise.all([
    fetch(new URL("../build/cadr-web-m13-audio-O2.wasm", import.meta.url), { cache: "no-store" }),
    fetch("/m11-selected-fixture.json", { cache: "no-store" }),
  ]);
  if (!wasmResponse.ok || !fixtureResponse.ok) throw new Error("selected input fetch failed");
  const wasmBytes = await wasmResponse.arrayBuffer();
  const fixture = await fixtureResponse.json();
  const snapshot = fromHex(fixture.initial_snapshot_cdrauds1_hex);
  const instantiated = await WebAssembly.instantiate(wasmBytes, {});
  const e = instantiated.instance.exports;
  if (e.cadr_wasm_create() !== 0) throw new Error("selected Wasm create failed");
  const output = e.cadr_wasm_output_pointer() >>> 0;
  const meta = e.cadr_wasm_meta_pointer() >>> 0;
  const input = e.cadr_wasm_input_reserve(4284) >>> 0;
  if (output === 0 || meta === 0 || input === 0) throw new Error("selected M11 buffers unavailable");
  new Uint8Array(e.memory.buffer, input, snapshot.byteLength).set(snapshot);
  if (e.cadr_wasm_m11_audio_snapshot_restore(snapshot.byteLength) !== 0) {
    throw new Error("selected CDRAUDS1 restore failed");
  }
  const calls = []; const cursors = [];
  const save = async () => {
    if (e.cadr_wasm_m11_audio_snapshot_save() !== 0) throw new Error("selected snapshot save failed");
    const length = Number(new DataView(e.memory.buffer, meta, 16).getBigUint64(0, true));
    const bytes = new Uint8Array(e.memory.buffer, input, length).slice();
    return Object.freeze({ ...snapshotState(bytes), sha256: await sha256Hex(bytes) });
  };
  const invoke = async operation => {
    calls.push(Object.freeze({ ...operation }));
    if (operation.op === "audio-open-private") {
      const code = e.cadr_wasm_m13_audio_open();
      return { status: code, record: code === 0 ?
        new Uint8Array(e.memory.buffer, output, 48).slice().buffer : null };
    }
    if (operation.op === "audio-peek") {
      const code = e.cadr_wasm_m11_audio_peek();
      if (code !== 0) return { status: code };
      const cursor = new Uint8Array(e.memory.buffer, output, 88).slice();
      const view = new DataView(cursor.buffer, cursor.byteOffset, cursor.byteLength);
      cursors.push(Object.freeze({ sha256: await sha256Hex(cursor), bytes: cursor.byteLength }));
      return { status: 0, generation: view.getBigUint64(64, true),
        sequence: view.getBigUint64(72, true), frameOffset: view.getUint32(80, true),
        framesRemaining: view.getUint32(84, true) };
    }
    if (operation.op === "audio-render") {
      const code = e.cadr_wasm_m11_audio_render(u64low(operation.generation),
        u64high(operation.generation), u64low(operation.sequence), u64high(operation.sequence),
        operation.frameOffset, operation.requestedFrames);
      const frames = code === 0 ? Number(new DataView(e.memory.buffer, meta, 16)
        .getBigUint64(0, true)) : 0;
      return { status: code, frames, pcmS16Le: code === 0 ?
        new Uint8Array(e.memory.buffer, output, frames * 2).slice().buffer : null };
    }
    if (operation.op === "audio-ack") {
      const code = e.cadr_wasm_m11_audio_ack(u64low(operation.generation),
        u64high(operation.generation), u64low(operation.sequence), u64high(operation.sequence),
        operation.frameOffset, operation.frames);
      const saved = await save();
      return { status: code, queuePackets: saved.packetCount,
        queuedFrames: Number(saved.queuedFrames) };
    }
    return { status: 9 };
  };
  return Object.freeze({ e, fixture: Object.freeze({ name: fixture.name,
    snapshotBytes: snapshot.byteLength, snapshotSha256: await sha256Hex(snapshot),
    oracleSourceIdentities: fixture.oracle_source_identities }), invoke, calls, cursors, save,
    wasm: Object.freeze({ bytes: wasmBytes.byteLength, sha256: await sha256Hex(wasmBytes) }) });
}


const selected = await createSelectedCore();
const audioFactory = new BrowserAudioFactory({ startMode: "suspend-first", onNode: (entry, port) => {
  entry.staged = []; entry.acknowledgements = [];
  entry.node.port.onmessage = event => {
    if (event.data?.type === "cadr-audio-staged") entry.staged.push(event.data);
    if (event.data?.type === "cadr-audio-ack") entry.acknowledgements.push(event.data);
    port.onmessage?.(event);
  };
} });
const emitted = []; const deliveries = []; const statuses = [];
let boundary;
const source = new CadrM13AudioSource({ invoke: selected.invoke,
  emit: event => emitted.push(event) });
const core = Object.freeze({ open: () => source.open(), ack: record => source.ack(record),
  pause: value => source.pause(value), deviceLost: value => source.deviceLost(value),
  terminalRelease: value => source.terminalRelease(value) });
boundary = new CadrM13AudioBoundary({ core, audioFactory,
  onStatus: value => statuses.push(value) });
const observations = { initial: null, staged: null, paused: null, resumed: null,
  committed: null, final: null };

async function bounded(receipt, label) {
  let timer;
  try {
    return await Promise.race([receipt, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), 5000);
    })]);
  } finally { clearTimeout(timer); }
}
const receiptIdentity = delivery => ({ generation: BigInt(delivery.generation),
  consumerEpoch: BigInt(delivery.consumerEpoch), sequence: BigInt(delivery.sequence),
  frameOffset: delivery.frameOffset });

async function pumpOne() {
  const before = emitted.length;
  if (!await source.pump(sessionId) || emitted.length !== before + 1) {
    throw new Error("selected source did not emit one bounded packet");
  }
  const envelope = emitted.at(-1);
  if (!await boundary.acceptWorkerEvent(envelope, sessionId)) {
    throw new Error("selected packet was not admitted to the Worklet");
  }
  const record = parseCdrPcm1(envelope.record);
  const delivery = Object.freeze({ generation: String(record.generation),
    consumerEpoch: String(record.consumerEpoch), sequence: String(record.sequence),
    frameOffset: record.frameOffset, frames: record.frameCount,
    pcmSha256: await sha256Hex(record.samples), cursorSha256: selected.cursors.at(-1).sha256 });
  const staged = await bounded(boundary.waitForWorkletStaged(receiptIdentity(delivery)),
    "real Worklet staging receipt");
  deliveries.push(delivery); return Object.freeze({ delivery, staged });
}

document.querySelector("#open").addEventListener("click", async () => {
  if (!boundary.prepareActivation()) throw new Error("initial audio preparation failed");
  const opened = await boundary.open(CADR_M13_AUDIO_PROFILE);
  if (opened.status !== 0) throw new Error(`selected open failed: ${opened.status}`);
  observations.initial = await selected.save();
  observations.staged = await pumpOne();
  status.textContent = "One selected-core packet staged in a suspended real Worklet.";
});

document.querySelector("#pause").addEventListener("click", async () => {
  const paused = await boundary.pause();
  if (paused.status !== 0) throw new Error(`selected pause failed: ${paused.status}`);
  if (selected.calls.some(call => call.op === "audio-ack")) {
    throw new Error("suspended Worklet rendered before pause");
  }
  observations.paused = await selected.save();
  status.textContent = "Paused before acknowledgement; selected core retained the packet.";
});

document.querySelector("#resume").addEventListener("click", async () => {
  if (!boundary.prepareActivation()) throw new Error("resume audio preparation failed");
  const resumed = await boundary.resume();
  if (resumed.status !== 0) throw new Error(`selected resume failed: ${resumed.status}`);
  observations.resumed = await pumpOne();
  const committed = await bounded(boundary.waitForAckCommitted(
    receiptIdentity(observations.resumed.delivery)), "selected-core committed acknowledgement");
  observations.committed = Object.freeze({ receipt: committed,
    sourceInFlightRecords: source.inFlightRecords, boundary: boundary.state() });
  observations.final = await selected.save();
  status.textContent = "Resumed packet consumed and acknowledged exactly once.";
});

function state() {
  return { wasm: selected.wasm, fixture: selected.fixture, observations,
    deliveries, calls: selected.calls.map(value => Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, typeof item === "bigint" ? String(item) : item]))),
    contexts: audioFactory.contexts.map(entry => ({ state: entry.context.state,
      sampleRate: entry.context.sampleRate, disconnected: entry.disconnected,
      staged: entry.staged?.length ?? 0, acknowledgements: entry.acknowledgements?.length ?? 0 })),
    activation: audioFactory.activation, statuses, boundary: boundary.state(),
    claimBoundary: { selectedWasm: true, syntheticCdrauds1: true,
      realAudioWorklet: true, guestGeneratedPcm: false, physicalDevice: false,
      votrax: false, cM11Closed: false } };
}

async function terminalBoundaryScenario(kind) {
  if (kind !== "resolve" && kind !== "reject") throw new TypeError("unknown terminal test kind");
  const trace = []; let release; let entered;
  const gate = new Promise(resolve => { release = resolve; });
  const enteredGate = new Promise(resolve => { entered = resolve; });
  const factory = new BrowserAudioFactory({ startMode: "resume", afterModule: async () => {
    trace.push("start-deferred-before-node"); entered(); await gate;
  }, afterNode: async entry => {
    trace.push(entry.nodeAllocatedAfterFirstDisconnect ? "node-after-first-pass" : "node-before-first-pass");
    if (kind === "reject") throw new Error("intentional late start rejection");
  } });
  const terminalCore = Object.freeze({
    open: async () => ({ status: 0, generation: 1n, consumerEpoch: 91n, queuePackets: 0, queuedFrames: 0 }),
    ack: async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
    pause: async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
    deviceLost: async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
    terminalRelease: () => true,
  });
  const terminal = new CadrM13AudioBoundary({ core: terminalCore, audioFactory: factory, now: () => 0 });
  if (!terminal.prepareActivation()) throw new Error("terminal test preparation failed");
  const opening = terminal.open(CADR_M13_AUDIO_PROFILE); await enteredGate;
  terminal.closeForWorkerLoss(); trace.push("terminal-first-pass");
  release();
  const opened = await bounded(opening, "terminal boundary open");
  await bounded(new Promise(resolve => {
    const poll = () => factory.contexts[0].context.state === "closed" ? resolve() : setTimeout(poll, 0);
    poll();
  }), "terminal boundary context close");
  await Promise.resolve();
  const entry = factory.contexts[0];
  return Object.freeze({ kind, phaseTrace: trace, openStatus: opened.status,
    nodeAllocatedAfterFirstDisconnect: entry.nodeAllocatedAfterFirstDisconnect,
    disconnectPasses: entry.disconnectPasses, nodeDisconnects: entry.nodeDisconnects,
    contextCloseCalls: entry.closeCalls, contextState: entry.context.state,
    closeRejections: entry.closeRejections, terminalState: terminal.state().state });
}

async function terminalNeverScenario(stage) {
  if (!["before-module", "after-module", "after-node"].includes(stage)) {
    throw new TypeError("invalid never-settling scenario");
  }
  let entered; const trace = [];
  const gate = new Promise(() => {});
  const enteredGate = new Promise(resolve => { entered = resolve; });
  const hold = async () => { trace.push(stage + "-entered"); entered(); await gate; };
  const options = { startMode: "resume", closeDeadlineMs: 25 };
  if (stage === "before-module") options.beforeModule = hold;
  if (stage === "after-module") options.afterModule = hold;
  if (stage === "after-node") options.afterNode = hold;
  const factory = new BrowserAudioFactory(options);
  const core = Object.freeze({ open: async () => ({ status: 0, generation: 1n, consumerEpoch: 92n,
    queuePackets: 0, queuedFrames: 0 }), ack: async () => ({ status: 0, queuePackets: 0,
    queuedFrames: 0 }), pause: async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
    deviceLost: async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }), terminalRelease: () => true });
  const terminal = new CadrM13AudioBoundary({ core, audioFactory: factory, now: () => 0 });
  terminal.prepareActivation(); const opening = terminal.open(CADR_M13_AUDIO_PROFILE); await enteredGate;
  terminal.closeForWorkerLoss(); trace.push("terminal-first-pass");
  const opened = await bounded(opening, "never terminal open");
  await bounded(new Promise(resolve => { const poll = () => factory.contexts[0].context.state === "closed" ?
    resolve() : setTimeout(poll, 0); poll(); }), "never terminal context close");
  const entry = factory.contexts[0];
  return Object.freeze({ stage, phaseTrace: trace, openStatus: opened.status,
    startStillPending: entry.starting,
    nodeAllocatedAfterFirstDisconnect: entry.nodeAllocatedAfterFirstDisconnect,
    disconnectPasses: entry.disconnectPasses, nodeDisconnects: entry.nodeDisconnects,
    contextCloseCalls: entry.closeCalls, contextState: entry.context.state,
    closeRejections: entry.closeRejections, terminalState: terminal.state().state });
}

globalThis.cadrM11SelectedPlayback = Object.freeze({ state, terminalBoundaryScenario, terminalNeverScenario });
status.textContent = "Selected ABI1.11 Wasm and independent synthetic fixture ready.";
