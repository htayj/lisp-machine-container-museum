import { CadrM13AudioReducer } from "./cadr-m13-audio-reducer.mjs";
import { CADR_M13_AUDIO_PROFILE, parseCdrPcm1, sha256Hex } from "./cadr-m13-audio-record.mjs";

const OK = 0, INVALID = 2, STALE = 3, NOT_READY = 9, DEVICE_LOST = 26;
export const CADR_M13_AUDIO_RECEIPT_HISTORY = 8;
const MAX_U32 = 0xffff_ffffn, MAX_U64 = 0xffff_ffff_ffff_ffffn;
const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Reflect.ownKeys(value).every(key => typeof key === "string" && keys.includes(key)) &&
  keys.every(key => Object.hasOwn(value, key));
const audioCounts = value => Number.isInteger(value?.queuePackets) && value.queuePackets >= 0 && value.queuePackets <= 64 &&
  Number.isInteger(value?.queuedFrames) && value.queuedFrames >= 0 && value.queuedFrames <= 32768;
const receiptFields = value =>
  typeof value.generation === "bigint" && value.generation > 0n && value.generation <= MAX_U64 &&
  typeof value.consumerEpoch === "bigint" && value.consumerEpoch > 0n && value.consumerEpoch <= MAX_U64 &&
  typeof value.sequence === "bigint" && value.sequence >= 0n && value.sequence <= MAX_U64 &&
  Number.isSafeInteger(value.frameOffset) && value.frameOffset >= 0 && BigInt(value.frameOffset) <= MAX_U32;
const receiptIdentity = value => exactKeys(value, ["generation", "consumerEpoch", "sequence", "frameOffset"]) &&
  receiptFields(value);

export class CadrM13WorkerAudioCore {
  #request; #terminal = false;
  constructor({ request }) {
    if (typeof request !== "function") throw new TypeError("M13 worker audio core needs request");
    this.#request = request;
  }
  async #invoke(op, fields = {}) {
    if (this.#terminal) return Object.freeze({ status: NOT_READY });
    const result = await this.#request({ op, ...fields });
    const audio = result?.remainder?.audio;
    /* An in-flight open retains its exact retired epoch even after terminal
     * revocation, so the boundary can tombstone that epoch after open exits. */
    return result?.status === OK && audio !== undefined ?
      Object.freeze({ status: OK, ...audio }) : Object.freeze({ status: result?.status ?? NOT_READY });
  }
  open() { return this.#invoke("m13-audio-open"); }
  ack(record) { return this.#invoke("m13-audio-ack", record); }
  pause(fields) { return this.#invoke("m13-audio-pause", fields); }
  deviceLost({ consumerEpoch, cause, record }) {
    return this.#invoke("m13-audio-device-lost", { consumerEpoch, cause,
      generation: record?.generation ?? null, sequence: record?.sequence ?? null,
      frameOffset: record?.frameOffset ?? null });
  }
  /* Synchronous, request-free revocation. The worker owner terminates its worker
   * after boundary close; this adapter must never issue a concurrent request to
   * a non-reentrant private core merely to clean up a cancelled request. */
  terminalRelease() { this.#terminal = true; return true; }
}

/* Authority-minimising M13 coordinator.  audioFactory.prepare() is the only
 * method permitted to create an AudioContext and is deliberately synchronous,
 * so callers can invoke it directly in a user-activation task. */
export class CadrM13AudioBoundary {
  #core; #factory; #prepared = null; #activationCandidate = null; #consumer = null; #reducer; #state = "PAUSED";
  #generation = 0n; #epoch = 0n; #queuePackets = 0; #queuedFrames = 0;
  #eventOrdinal = 0n; #closed = false; #pendingControl = null; #onStatus; #lossCause = "device-loss";
  #setTimeout; #clearTimeout; #deadlineTimers = new Map();
  #queueMicrotask; #sha256;
  #postedRecords = new Map(); #stagedRecords = new Map(); #committedRecords = new Map();
  #stagedWaiters = new Map(); #committedWaiters = new Map();
  #lifecycleTail = Promise.resolve(); #activationPending = false; #controlPending = false;
  #controlAdmission = 0n; #owners = new Set();
  #coreEpoch = null;
  constructor({ core, audioFactory, now = () => performance.now(),
    queueMicrotaskFn = globalThis.queueMicrotask.bind(globalThis), onStatus = () => {},
    sha256Fn = sha256Hex,
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis) }) {
    if (core === null || typeof core !== "object" || typeof core.open !== "function" ||
        typeof core.ack !== "function" || typeof core.pause !== "function" ||
        typeof core.deviceLost !== "function" || typeof core.terminalRelease !== "function" ||
        typeof sha256Fn !== "function" || audioFactory === null ||
        typeof audioFactory.prepare !== "function") throw new TypeError("incomplete M13 audio authority");
    this.#core = core; this.#factory = audioFactory; this.#onStatus = onStatus;
    this.#setTimeout = setTimeoutFn; this.#clearTimeout = clearTimeoutFn;
    this.#queueMicrotask = queueMicrotaskFn; this.#sha256 = sha256Fn;
    this.#reducer = new CadrM13AudioReducer({ now, queueMicrotask: queueMicrotaskFn,
      onAction: action => { this.#enqueueAction(action); } });
  }
  prepareActivation() {
    if (this.#closed || this.#activationPending || this.#controlPending ||
        this.#prepared !== null || this.#consumer !== null) return false;
    let prepared;
    try { prepared = this.#factory.prepare(); } catch { return false; }
    if (!this.#candidateIsUsable(prepared)) {
      this.#releaseCandidate(prepared);
      return false;
    }
    this.#prepared = prepared; return true;
  }
  state() { return Object.freeze({ state: this.#state, generation: this.#generation,
    consumerEpoch: this.#epoch, queuePackets: this.#queuePackets,
    queuedFrames: this.#queuedFrames }); }
  waitForWorkletStaged(identity) { return this.#waitForReceipt(
    this.#stagedRecords, this.#stagedWaiters, identity); }
  waitForAckCommitted(identity) { return this.#waitForReceipt(
    this.#committedRecords, this.#committedWaiters, identity); }
  receiptEvidenceState() { return Object.freeze({ posted: this.#postedRecords.size,
    staged: this.#stagedRecords.size, committed: this.#committedRecords.size,
    capacity: CADR_M13_AUDIO_RECEIPT_HISTORY }); }
  async open(rendererProfile) {
    if (rendererProfile !== CADR_M13_AUDIO_PROFILE) return { status: INVALID };
    return this.#activate();
  }
  async resume() { return this.#activate(); }
  async #activate() {
    if (this.#closed || this.#activationPending || this.#controlPending || this.#consumer !== null) {
      return { status: NOT_READY };
    }
    const admission = this.#controlAdmission;
    this.#activationPending = true;
    return this.#enqueueLifecycle(async () => {
      let candidate = null;
      const owner = this.#newOwner();
      try {
        if (this.#closed) return { status: NOT_READY };
        if (this.#prepared === null) {
          this.#state = "BLOCKED_AUTOPLAY"; this.#onStatus("CADR audio blocked pending user activation");
          return { status: OK, audio: this.state() };
        }
        candidate = this.#prepared; this.#prepared = null; this.#activationCandidate = candidate;
        const started = await this.#owned(owner, () => candidate.start(),
          () => this.#releaseCandidate(candidate));
        if (started.kind === "cancelled") return { status: NOT_READY };
        if (started.kind === "error") {
          this.#releaseCandidate(candidate); this.#state = "BLOCKED_AUTOPLAY";
          return { status: OK, audio: this.state() };
        }
        if (this.#closed || this.#controlAdmission !== admission) {
          this.#releaseCandidate(candidate); return { status: NOT_READY };
        }
        const openedCall = await this.#owned(owner, () => this.#core.open(),
          value => this.#releaseLateOpen(value));
        if (openedCall.kind === "cancelled") return { status: NOT_READY };
        if (openedCall.kind === "error") {
          this.#releaseCandidate(candidate); this.#state = "PAUSED"; return { status: NOT_READY };
        }
        const opened = openedCall.value;
        if (this.#closed || this.#controlAdmission !== admission) {
          this.#releaseCandidate(candidate); this.#releaseLateOpen(opened); return { status: NOT_READY };
        }
        if (opened?.status !== OK || typeof opened.generation !== "bigint" || opened.generation <= 0n ||
            typeof opened.consumerEpoch !== "bigint" || opened.consumerEpoch <= 0n || !audioCounts(opened)) {
          const status = opened?.status === OK ? NOT_READY : (opened?.status ?? NOT_READY);
          this.#releaseCandidate(candidate); this.#releaseLateOpen(opened);
          this.#state = "PAUSED"; return { status };
        }
        try {
          if (!this.#reducer.open(opened.consumerEpoch)) throw new TypeError("reducer refused fresh epoch");
          candidate.port.onmessage = event => this.#onWorklet(event?.data ?? event);
        } catch {
          this.#reducer.abortEpoch(); this.#releaseCandidate(candidate);
          this.#releaseCore(opened.consumerEpoch, "browser-install-failure");
          this.#state = "PAUSED"; return { status: NOT_READY };
        }
        this.#consumer = candidate; this.#activationCandidate = null; this.#coreEpoch = opened.consumerEpoch;
        this.#generation = opened.generation; this.#epoch = opened.consumerEpoch;
        this.#queuePackets = opened.queuePackets; this.#queuedFrames = opened.queuedFrames;
        this.#eventOrdinal = 0n; this.#state = "READY"; this.#postedRecords.clear();
        this.#stagedRecords.clear(); this.#committedRecords.clear();
        this.#onStatus("CADR audio ready"); return { status: OK, audio: this.state() };
      } finally {
        if (this.#activationCandidate === candidate) this.#activationCandidate = null;
        this.#finishOwner(owner); this.#activationPending = false;
      }
    });
  }
  async pause() {
    if (this.#closed || this.#consumer === null || this.#controlPending) return { status: NOT_READY };
    return new Promise(resolve => {
      this.#pendingControl = resolve; this.#controlPending = true;
      if (!this.#reducer.pause()) {
        this.#pendingControl = null; this.#controlPending = false; resolve({ status: NOT_READY });
      } else this.#controlAdmission += 1n;
    });
  }
  async acceptWorkerEvent(value, sessionId) {
    if (this.#closed || !exactKeys(value, ["type", "version", "sessionId", "event", "eventOrdinal",
      "consumerEpoch", "record", "recordSha256"]) || value.type !== "cadr-event" ||
        value.version !== 8 || value.sessionId !== sessionId || value.event !== "audio-pcm" ||
        value.eventOrdinal !== this.#eventOrdinal + 1n || value.consumerEpoch !== this.#epoch ||
        typeof value.recordSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.recordSha256)) return false;
    const consumer = this.#consumer; const epoch = this.#epoch; const generation = this.#generation;
    const eventOrdinal = this.#eventOrdinal; const controlAdmission = this.#controlAdmission;
    const record = parseCdrPcm1(value.record);
    if (record === null || consumer === null || record.generation !== generation ||
        record.consumerEpoch !== epoch) return false;
    const digest = await this.#sha256(value.record);
    if (digest !== value.recordSha256 || this.#closed || this.#consumer !== consumer ||
        this.#epoch !== epoch || this.#generation !== generation || this.#eventOrdinal !== eventOrdinal ||
        this.#controlAdmission !== controlAdmission) return false;
    const message = { type: "cadr-audio-pcm", version: 1, generation: record.generation,
      consumerEpoch: record.consumerEpoch, sequence: record.sequence,
      frameOffset: record.frameOffset, samples: record.samples };
    if (this.#reducer.queuedRecords >= 8) return false;
    if (!this.#reducer.post(record)) { this.deviceLost("device-loss"); return false; }
    const timerKey = this.#recordKey(record);
    this.#postedRecords.set(timerKey, Object.freeze({ generation: record.generation,
      consumerEpoch: record.consumerEpoch, sequence: record.sequence,
      frameOffset: record.frameOffset }));
    try { this.#consumer.port.postMessage(message, [message.samples]); }
    catch { this.deviceLost("device-loss"); return false; }
    this.#deadlineTimers.set(timerKey, this.#setTimeout(() => {
      this.#deadlineTimers.delete(timerKey); this.#reducer.deadlineTick();
    }, 2000));
    this.#eventOrdinal = value.eventOrdinal;
    if (this.#reducer.queuedRecords === 8) this.#state = "BACKPRESSURE";
    return true;
  }
  #onWorklet(message) {
    if (!exactKeys(message, ["type", "version", "generation", "consumerEpoch", "sequence", "frameOffset"]) ||
        !["cadr-audio-staged", "cadr-audio-ack"].includes(message.type) ||
        message.version !== 1 || !receiptFields(message)) return false;
    const key = this.#recordKey(message);
    const posted = this.#postedRecords.get(key);
    if (posted === undefined || posted.generation !== message.generation ||
        posted.consumerEpoch !== message.consumerEpoch || posted.sequence !== message.sequence ||
        posted.frameOffset !== message.frameOffset) return false;
    if (message.type === "cadr-audio-staged") {
      if (this.#stagedRecords.has(key)) return false;
      const receipt = Object.freeze({ ...posted, kind: "worklet-staged" });
      this.#retainReceipt(this.#stagedRecords, key, receipt);
      this.#resolveReceipt(this.#stagedWaiters, key, receipt);
      return true;
    }
    return this.#reducer.acknowledge(message);
  }
  deviceLost(cause = "device-loss") {
    if (!["processorerror", "context-closed", "device-loss"].includes(cause) ||
        this.#closed || this.#consumer === null || this.#controlPending) return false;
    this.#lossCause = cause; this.#controlPending = true;
    if (this.#reducer.deviceLost()) { this.#controlAdmission += 1n; return true; }
    this.#controlPending = false; return false;
  }
  #enqueueAction(action) {
    this.#enqueueLifecycle(() => this.#handleAction(action));
  }
  #enqueueLifecycle(execute) {
    const result = this.#lifecycleTail.then(execute, execute);
    this.#lifecycleTail = result.then(() => undefined, () => undefined);
    return result;
  }
  async #handleAction(action) {
    if (this.#closed) return;
    if (action.kind === "ack") {
      this.#clearRecordTimer(action.record);
      const key = this.#recordKey(action.record);
      const epoch = this.#epoch;
      const consumer = this.#consumer;
      const posted = this.#postedRecords.get(key);
      if (consumer === null || posted === undefined || action.consumerEpoch !== epoch) return;
      const owner = this.#newOwner();
      const outcome = await this.#owned(owner, () => this.#core.ack(action.record));
      this.#finishOwner(owner);
      if (outcome.kind === "cancelled") return;
      if (outcome.kind === "error") {
        if (this.#consumer === consumer && this.#epoch === epoch && this.#postedRecords.get(key) === posted) {
          this.deviceLost("device-loss");
        }
        return;
      }
      const result = outcome.value;
      const live = this.#consumer === consumer && this.#epoch === epoch &&
        this.#postedRecords.get(key) === posted;
      if (!live) return;
      if (result?.status === OK && audioCounts(result)) {
        this.#queuePackets = result.queuePackets; this.#queuedFrames = result.queuedFrames;
        this.#state = this.#reducer.queuedRecords === 8 ? "BACKPRESSURE" : "READY";
        const receipt = Object.freeze({ ...posted, kind: "ack-committed",
          queuePackets: this.#queuePackets, queuedFrames: this.#queuedFrames });
        this.#postedRecords.delete(key); this.#retainReceipt(this.#committedRecords, key, receipt);
        this.#resolveReceipt(this.#committedWaiters, key, receipt);
      } else this.deviceLost("device-loss");
      return;
    }
    const consumer = this.#consumer; this.#consumer = null;
    this.#clearAllTimers();
    this.#releaseCandidate(consumer);
    const epoch = this.#epoch;
    if (action.kind === "paused") {
      const owner = this.#newOwner();
      const outcome = await this.#owned(owner, () => this.#core.pause({ consumerEpoch: epoch }));
      this.#finishOwner(owner);
      if (outcome.kind === "cancelled") return;
      const result = outcome.kind === "value" ? outcome.value : { status: NOT_READY };
      if (result?.status === OK && audioCounts(result)) {
        this.#queuePackets = result.queuePackets; this.#queuedFrames = result.queuedFrames;
      }
      this.#coreEpoch = null; this.#state = "PAUSED";
      const resolve = this.#pendingControl; this.#pendingControl = null;
      this.#controlPending = false; this.#retireReceipts("epoch-paused");
      resolve?.(result?.status === OK && audioCounts(result) ?
        { status: OK, audio: this.state() } : { status: result?.status ?? NOT_READY });
      return;
    }
    const cause = action.cause === "reply-timeout" ? "reply-timeout" : this.#lossCause;
    const owner = this.#newOwner();
    const outcome = await this.#owned(owner, () => this.#core.deviceLost({
      consumerEpoch: epoch, cause, record: action.record ?? null }));
    this.#finishOwner(owner);
    if (outcome.kind === "cancelled") return;
    const result = outcome.kind === "value" ? outcome.value : null;
    if (result?.status === OK && audioCounts(result)) {
      this.#queuePackets = result.queuePackets; this.#queuedFrames = result.queuedFrames;
    }
    this.#coreEpoch = null; this.#state = "DEVICE_LOST";
    const resolve = this.#pendingControl; this.#pendingControl = null;
    this.#controlPending = false; this.#retireReceipts("epoch-lost");
    resolve?.({ status: DEVICE_LOST });
    this.#onStatus("CADR audio device lost; unacknowledged audio retained");
  }
  closeForWorkerLoss() {
    if (this.#closed) return;
    this.#closed = true; this.#controlPending = true; this.#controlAdmission += 1n;
    /* Terminal loss is an ownership revocation, not another lifecycle action:
     * it must complete even while a browser start, core open, or core ack never
     * settles.  Late values are observed only to release a late-opened core and
     * cannot reinstall a consumer or publish an acknowledgement. */
    this.#reducer.close(); this.#clearAllTimers(); this.#retireReceipts("boundary-closed");
    for (const owner of this.#owners) owner.cancel();
    this.#releaseCandidate(this.#prepared); this.#prepared = null;
    this.#releaseCandidate(this.#activationCandidate); this.#activationCandidate = null;
    this.#releaseCandidate(this.#consumer); this.#consumer = null;
    const coreEpoch = this.#coreEpoch; this.#coreEpoch = null;
    this.#releaseCore(coreEpoch, "worker-loss");
    this.#state = "DEVICE_LOST";
    const resolve = this.#pendingControl; this.#pendingControl = null;
    this.#controlPending = false; resolve?.({ status: DEVICE_LOST });
  }
  #recordKey(record) { return `${record.generation}:${record.consumerEpoch}:${record.sequence}:${record.frameOffset}`; }
  #waitForReceipt(records, waiters, identity) {
    if (!receiptIdentity(identity)) {
      return Promise.resolve(Object.freeze({ kind: "stale", reason: "identity-invalid" }));
    }
    const key = this.#recordKey(identity); const found = records.get(key);
    if (found !== undefined) return Promise.resolve(found);
    if (this.#closed || this.#consumer === null || identity?.consumerEpoch !== this.#epoch ||
        !this.#postedRecords.has(key)) {
      return Promise.resolve(Object.freeze({ kind: "stale", reason: "identity-not-live" }));
    }
    return new Promise(resolve => {
      const values = waiters.get(key) ?? []; values.push(resolve); waiters.set(key, values);
    });
  }
  #resolveReceipt(waiters, key, receipt) {
    for (const resolve of waiters.get(key) ?? []) resolve(receipt);
    waiters.delete(key);
  }
  #retainReceipt(records, key, receipt) {
    records.delete(key); records.set(key, receipt);
    while (records.size > CADR_M13_AUDIO_RECEIPT_HISTORY) {
      records.delete(records.keys().next().value);
    }
  }
  #retireReceipts(reason) {
    const stale = key => {
      const record = this.#postedRecords.get(key) ?? this.#stagedRecords.get(key) ??
        this.#committedRecords.get(key);
      return Object.freeze({ ...(record ?? {}), kind: "stale", reason });
    };
    for (const waiters of [this.#stagedWaiters, this.#committedWaiters]) {
      for (const [key, resolves] of waiters) {
        const receipt = stale(key);
        for (const resolve of resolves) resolve(receipt);
      }
      waiters.clear();
    }
    this.#postedRecords.clear(); this.#stagedRecords.clear(); this.#committedRecords.clear();
  }
  #clearRecordTimer(record) {
    const key = this.#recordKey(record); const timer = this.#deadlineTimers.get(key);
    if (timer !== undefined) { this.#deadlineTimers.delete(key); this.#clearTimeout(timer); }
  }
  #clearAllTimers() {
    for (const timer of this.#deadlineTimers.values()) this.#clearTimeout(timer);
    this.#deadlineTimers.clear();
  }
  #candidateIsUsable(candidate) {
    try {
      return candidate !== null && typeof candidate === "object" && candidate.port !== null &&
        typeof candidate.port === "object" && typeof candidate.port.postMessage === "function" &&
        typeof candidate.start === "function" && typeof candidate.disconnect === "function";
    } catch { return false; }
  }
  #releaseCandidate(candidate) {
    if (candidate === null || typeof candidate !== "object") return;
    try { if (candidate.port !== null && typeof candidate.port === "object") candidate.port.onmessage = null; }
    catch { /* A frozen or malformed port still permits candidate.disconnect(). */ }
    try { if (typeof candidate.disconnect === "function") candidate.disconnect(); }
    catch { /* Terminal release remains deterministic even when disconnect throws. */ }
  }
  #newOwner() {
    let resolve;
    const owner = { cancelled: false, cancelledResult: new Promise(value => { resolve = value; }) };
    owner.cancel = () => {
      if (!owner.cancelled) { owner.cancelled = true; resolve({ kind: "cancelled" }); }
    };
    this.#owners.add(owner); return owner;
  }
  #finishOwner(owner) { this.#owners.delete(owner); }
  async #owned(owner, invoke, onLateValue = () => {}) {
    const settled = Promise.resolve().then(invoke).then(value => {
      if (owner.cancelled) onLateValue(value);
      return { kind: "value", value };
    }, error => {
      if (owner.cancelled) onLateValue(undefined);
      return { kind: "error", error };
    });
    return Promise.race([settled, owner.cancelledResult]);
  }
  #releaseLateOpen(opened) {
    if (opened?.status === OK && typeof opened.consumerEpoch === "bigint" &&
        opened.consumerEpoch > 0n) this.#releaseCore(opened.consumerEpoch, "terminal-late-open");
  }
  #releaseCore(consumerEpoch, cause) {
    try {
      const result = this.#core.terminalRelease({ consumerEpoch, cause });
      if (result !== true) throw new TypeError("terminal release must return true synchronously");
    } catch { /* Terminal boundary state is already fixed; no concurrent core call follows. */ }
  }
}
