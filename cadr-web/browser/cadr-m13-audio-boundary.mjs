import { CadrM13AudioReducer } from "./cadr-m13-audio-reducer.mjs";
import { CADR_M13_AUDIO_PROFILE, parseCdrPcm1, sha256Hex } from "./cadr-m13-audio-record.mjs";

const OK = 0, INVALID = 2, STALE = 3, NOT_READY = 9, DEVICE_LOST = 26;
const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Reflect.ownKeys(value).every(key => typeof key === "string" && keys.includes(key)) &&
  keys.every(key => Object.hasOwn(value, key));
const audioCounts = value => Number.isInteger(value?.queuePackets) && value.queuePackets >= 0 && value.queuePackets <= 64 &&
  Number.isInteger(value?.queuedFrames) && value.queuedFrames >= 0 && value.queuedFrames <= 32768;

export class CadrM13WorkerAudioCore {
  #request;
  constructor({ request }) {
    if (typeof request !== "function") throw new TypeError("M13 worker audio core needs request");
    this.#request = request;
  }
  async #invoke(op, fields = {}) {
    const result = await this.#request({ op, ...fields });
    return result?.status === OK && result.audio !== undefined ?
      Object.freeze({ status: OK, ...result.audio }) : Object.freeze({ status: result?.status ?? NOT_READY });
  }
  open() { return this.#invoke("m13-audio-open"); }
  ack(record) { return this.#invoke("m13-audio-ack", record); }
  pause(fields) { return this.#invoke("m13-audio-pause", fields); }
  deviceLost({ consumerEpoch, cause, record }) {
    return this.#invoke("m13-audio-device-lost", { consumerEpoch, cause,
      generation: record?.generation ?? null, sequence: record?.sequence ?? null,
      frameOffset: record?.frameOffset ?? null });
  }
}

/* Authority-minimising M13 coordinator.  audioFactory.prepare() is the only
 * method permitted to create an AudioContext and is deliberately synchronous,
 * so callers can invoke it directly in a user-activation task. */
export class CadrM13AudioBoundary {
  #core; #factory; #prepared = null; #consumer = null; #reducer; #state = "PAUSED";
  #generation = 0n; #epoch = 0n; #queuePackets = 0; #queuedFrames = 0;
  #eventOrdinal = 0n; #closed = false; #pendingControl = null; #onStatus; #lossCause = "device-loss";
  #setTimeout; #clearTimeout; #deadlineTimers = new Map();
  constructor({ core, audioFactory, now = () => performance.now(),
    queueMicrotaskFn = globalThis.queueMicrotask.bind(globalThis), onStatus = () => {},
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis) }) {
    if (core === null || typeof core !== "object" || typeof core.open !== "function" ||
        typeof core.ack !== "function" || typeof core.pause !== "function" ||
        typeof core.deviceLost !== "function" || audioFactory === null ||
        typeof audioFactory.prepare !== "function") throw new TypeError("incomplete M13 audio authority");
    this.#core = core; this.#factory = audioFactory; this.#onStatus = onStatus;
    this.#setTimeout = setTimeoutFn; this.#clearTimeout = clearTimeoutFn;
    this.#reducer = new CadrM13AudioReducer({ now, queueMicrotask: queueMicrotaskFn,
      onAction: action => { void this.#handleAction(action); } });
  }
  prepareActivation() {
    if (this.#closed || this.#prepared !== null || this.#consumer !== null) return false;
    const prepared = this.#factory.prepare();
    if (prepared === null || typeof prepared !== "object" || prepared.port === null ||
        typeof prepared.port?.postMessage !== "function" || typeof prepared.start !== "function" ||
        typeof prepared.disconnect !== "function") return false;
    this.#prepared = prepared; return true;
  }
  state() { return Object.freeze({ state: this.#state, generation: this.#generation,
    consumerEpoch: this.#epoch, queuePackets: this.#queuePackets,
    queuedFrames: this.#queuedFrames }); }
  async open(rendererProfile) {
    if (rendererProfile !== CADR_M13_AUDIO_PROFILE) return { status: INVALID };
    return this.#activate();
  }
  async resume() { return this.#activate(); }
  async #activate() {
    if (this.#closed || this.#consumer !== null) return { status: NOT_READY };
    if (this.#prepared === null) {
      this.#state = "BLOCKED_AUTOPLAY"; this.#onStatus("CADR audio blocked pending user activation");
      return { status: OK, audio: this.state() };
    }
    const candidate = this.#prepared; this.#prepared = null;
    try { await candidate.start(); }
    catch { candidate.disconnect(); this.#state = "BLOCKED_AUTOPLAY"; return { status: OK, audio: this.state() }; }
    const opened = await this.#core.open();
    if (opened?.status !== OK || typeof opened.generation !== "bigint" || opened.generation <= 0n ||
        typeof opened.consumerEpoch !== "bigint" || opened.consumerEpoch <= 0n || !audioCounts(opened)) {
      candidate.disconnect(); return { status: opened?.status ?? NOT_READY };
    }
    this.#consumer = candidate; this.#generation = opened.generation; this.#epoch = opened.consumerEpoch;
    this.#queuePackets = opened.queuePackets; this.#queuedFrames = opened.queuedFrames;
    this.#eventOrdinal = 0n; this.#state = "READY";
    if (!this.#reducer.open(this.#epoch)) { candidate.disconnect(); this.#consumer = null; return { status: NOT_READY }; }
    candidate.port.onmessage = event => this.#onWorklet(event?.data ?? event);
    this.#onStatus("CADR audio ready"); return { status: OK, audio: this.state() };
  }
  async pause() {
    if (this.#consumer === null || this.#pendingControl !== null) return { status: NOT_READY };
    return new Promise(resolve => {
      this.#pendingControl = resolve;
      if (!this.#reducer.pause()) { this.#pendingControl = null; resolve({ status: NOT_READY }); }
    });
  }
  async acceptWorkerEvent(value, sessionId) {
    if (!exactKeys(value, ["type", "version", "sessionId", "event", "eventOrdinal",
      "consumerEpoch", "record", "recordSha256"]) || value.type !== "cadr-event" ||
        value.version !== 8 || value.sessionId !== sessionId || value.event !== "audio-pcm" ||
        value.eventOrdinal !== this.#eventOrdinal + 1n || value.consumerEpoch !== this.#epoch ||
        typeof value.recordSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.recordSha256)) return false;
    const record = parseCdrPcm1(value.record);
    if (record === null || record.generation !== this.#generation ||
        record.consumerEpoch !== this.#epoch ||
        await sha256Hex(value.record) !== value.recordSha256 || this.#consumer === null) return false;
    const message = { type: "cadr-audio-pcm", version: 1, generation: record.generation,
      consumerEpoch: record.consumerEpoch, sequence: record.sequence,
      frameOffset: record.frameOffset, samples: record.samples };
    if (this.#reducer.queuedRecords >= 8) return false;
    try { this.#consumer.port.postMessage(message, [message.samples]); }
    catch { this.deviceLost("device-loss"); return false; }
    if (!this.#reducer.post(record)) { this.deviceLost("device-loss"); return false; }
    const timerKey = this.#recordKey(record);
    this.#deadlineTimers.set(timerKey, this.#setTimeout(() => {
      this.#deadlineTimers.delete(timerKey); this.#reducer.deadlineTick();
    }, 2000));
    this.#eventOrdinal = value.eventOrdinal;
    if (this.#reducer.queuedRecords === 8) this.#state = "BACKPRESSURE";
    return true;
  }
  #onWorklet(message) {
    if (!exactKeys(message, ["type", "version", "generation", "consumerEpoch", "sequence", "frameOffset"]) ||
        message.type !== "cadr-audio-ack" || message.version !== 1) return false;
    return this.#reducer.acknowledge(message);
  }
  deviceLost(cause = "device-loss") {
    if (!["processorerror", "context-closed", "device-loss"].includes(cause) || this.#consumer === null) return false;
    this.#lossCause = cause; return this.#reducer.deviceLost();
  }
  async #handleAction(action) {
    if (action.kind === "ack") {
      this.#clearRecordTimer(action.record);
      let result;
      try { result = await this.#core.ack(action.record); }
      catch { this.deviceLost("device-loss"); return; }
      if (result?.status === OK && audioCounts(result)) {
        this.#queuePackets = result.queuePackets; this.#queuedFrames = result.queuedFrames;
        this.#state = this.#reducer.queuedRecords === 8 ? "BACKPRESSURE" : "READY";
      } else this.deviceLost("device-loss");
      return;
    }
    const consumer = this.#consumer; this.#consumer = null;
    this.#clearAllTimers();
    if (consumer !== null) { consumer.port.onmessage = null; consumer.disconnect(); }
    const epoch = this.#epoch;
    if (action.kind === "paused") {
      let result;
      try { result = await this.#core.pause({ consumerEpoch: epoch }); }
      catch { result = { status: NOT_READY }; }
      this.#state = "PAUSED";
      const resolve = this.#pendingControl; this.#pendingControl = null;
      resolve?.(result?.status === OK ? { status: OK, audio: this.state() } : { status: result?.status ?? NOT_READY });
      return;
    }
    const cause = action.cause === "reply-timeout" ? "reply-timeout" : this.#lossCause;
    try { await this.#core.deviceLost({ consumerEpoch: epoch, cause, record: action.record ?? null }); }
    catch { /* loss remains closed even if the private notification fails */ }
    this.#state = "DEVICE_LOST";
    const resolve = this.#pendingControl; this.#pendingControl = null;
    resolve?.({ status: DEVICE_LOST });
    this.#onStatus("CADR audio device lost; unacknowledged audio retained");
  }
  closeForWorkerLoss() {
    if (this.#closed) return;
    this.#closed = true; this.#reducer.close(); this.#clearAllTimers();
    this.#prepared?.disconnect(); this.#prepared = null;
    if (this.#consumer !== null) { this.#consumer.port.onmessage = null; this.#consumer.disconnect(); this.#consumer = null; }
  }
  #recordKey(record) { return `${record.generation}:${record.consumerEpoch}:${record.sequence}:${record.frameOffset}`; }
  #clearRecordTimer(record) {
    const key = this.#recordKey(record); const timer = this.#deadlineTimers.get(key);
    if (timer !== undefined) { this.#deadlineTimers.delete(key); this.#clearTimeout(timer); }
  }
  #clearAllTimers() {
    for (const timer of this.#deadlineTimers.values()) this.#clearTimeout(timer);
    this.#deadlineTimers.clear();
  }
}
