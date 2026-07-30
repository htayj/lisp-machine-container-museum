/* Deterministic main-thread reducer for the M13 browser-audio boundary.
 *
 * This module deliberately owns no AudioContext, Worker, DOM, storage, or guest
 * clock.  Its only authority is ordering already-admitted host notifications.  A
 * future M13 application shell must invoke it at the successful MessagePort post,
 * acknowledgement, pause, and device-failure boundaries described in the M13
 * specification.  Keeping that order in a small injected-clock component lets the
 * tie rules be exercised without claiming a browser or System 303 run. */

const DEADLINE_MS = 2000.0;
const HIGH_WATER = 8;
const MAX_U32 = 0xffff_ffff;

function isU32(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_U32;
}

function isPositiveU64(value) {
  return typeof value === "bigint" && value > 0n && value <= 0xffff_ffff_ffff_ffffn;
}

function assertRecordIdentity(record) {
  if (record === null || typeof record !== "object" ||
      !isPositiveU64(record.generation) || !isPositiveU64(record.consumerEpoch) ||
      !isPositiveU64(record.sequence) || !isU32(record.frameOffset)) {
    throw new TypeError("M13 audio record identity is invalid");
  }
  return Object.freeze({ generation: record.generation, consumerEpoch: record.consumerEpoch,
    sequence: record.sequence, frameOffset: record.frameOffset });
}

function recordKey(record) {
  return `${record.generation}:${record.consumerEpoch}:${record.sequence}:${record.frameOffset}`;
}

function sameRecord(left, right) {
  return left.generation === right.generation &&
    left.consumerEpoch === right.consumerEpoch &&
    left.sequence === right.sequence && left.frameOffset === right.frameOffset;
}

/* One reducer owns one current consumer epoch.  An application must call open()
 * only after a direct user activation has created a fresh browser audio consumer.
 * All callbacks in the same JavaScript task join one reducer turn because the first
 * admission schedules one injected microtask.  The microtask closes its watermark
 * before it invokes onAction; reentrant calls therefore enter the following turn. */
export class CadrM13AudioReducer {
  #now; #queueMicrotask; #onAction;
  #epoch = null; #records = new Map(); #items = [];
  #nextOrdinal = 1n; #turnOpen = false; #closed = false;

  constructor({ now, queueMicrotask, onAction = () => {} }) {
    if (typeof now !== "function" || typeof queueMicrotask !== "function" ||
        typeof onAction !== "function") {
      throw new TypeError("M13 audio reducer needs clock, microtask, and action functions");
    }
    this.#now = now;
    this.#queueMicrotask = queueMicrotask;
    this.#onAction = onAction;
  }

  get consumerEpoch() { return this.#epoch; }
  get queuedRecords() { return this.#records.size; }

  open(consumerEpoch) {
    if (this.#closed || !isPositiveU64(consumerEpoch) || this.#epoch !== null) return false;
    this.#epoch = consumerEpoch;
    return true;
  }

  close() {
    this.#closed = true;
    this.#epoch = null;
    this.#records.clear();
    this.#items.length = 0;
    this.#turnOpen = false;
  }

  /* Called immediately after a successful Worklet-port post.  The deadline is
   * latent until the next callback samples the monotonic clock, exactly as the
   * profile requires. */
  post(record) {
    let identity;
    try { identity = assertRecordIdentity(record); } catch { return false; }
    if (this.#closed || this.#epoch === null || identity.consumerEpoch !== this.#epoch ||
        this.#records.size >= HIGH_WATER || this.#records.has(recordKey(identity))) return false;
    const time = this.#sampleNow();
    this.#records.set(recordKey(identity), Object.freeze({ ...identity,
      dueAt: time + DEADLINE_MS, postOrdinal: this.#nextOrdinal++, duePromoted: false }));
    return true;
  }

  acknowledge(record) { return this.#admit("ack", record); }
  pause() { return this.#admit("pause", null); }
  deviceLost() { return this.#admit("device-error", null); }

  /* The real browser timer/device callback must call this entry at an overdue
   * boundary.  It has no direct reducer event: sampling promotes the exact latent
   * deadline(s), preserving deadline timestamp and post ordinal. */
  deadlineTick() { return this.#admit("tick", null); }

  #sampleNow() {
    const value = this.#now();
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new TypeError("M13 audio clock must return a finite nonnegative millisecond value");
    }
    return value;
  }

  #admit(kind, input) {
    if (this.#closed || this.#epoch === null) return false;
    let identity = null;
    if (kind === "ack") {
      try { identity = assertRecordIdentity(input); } catch { return false; }
      if (identity.consumerEpoch !== this.#epoch) return false;
    }
    const timestamp = this.#sampleNow();
    this.#promoteDue(timestamp);
    if (kind !== "tick") this.#items.push(Object.freeze({ kind, timestamp,
      ordinal: this.#nextOrdinal++, identity }));
    this.#scheduleTurn();
    return true;
  }

  #promoteDue(timestamp) {
    for (const [key, record] of this.#records) {
      if (!record.duePromoted && record.dueAt <= timestamp) {
        this.#records.set(key, Object.freeze({ ...record, duePromoted: true }));
        this.#items.push(Object.freeze({ kind: "deadline", timestamp: record.dueAt,
          ordinal: this.#nextOrdinal++, identity: record }));
      }
    }
  }

  #scheduleTurn() {
    if (this.#turnOpen) return;
    this.#turnOpen = true;
    this.#queueMicrotask(() => this.#reduceTurn());
  }

  #reduceTurn() {
    if (this.#closed) return;
    /* Close before callbacks.  An onAction callback may be reentrant but its
     * admission must become a later turn, never change this turn's ordering. */
    const watermark = this.#nextOrdinal - 1n;
    const selected = [];
    const retained = [];
    for (const item of this.#items) {
      if (item.ordinal <= watermark) selected.push(item);
      else retained.push(item);
    }
    this.#items = retained;
    this.#turnOpen = false;
    selected.sort((left, right) => left.timestamp - right.timestamp ||
      this.#priority(left.kind) - this.#priority(right.kind) ||
      (left.ordinal < right.ordinal ? -1 : left.ordinal > right.ordinal ? 1 : 0));

    const actions = [];
    for (const item of selected) this.#reduceItem(item, actions);
    /* Mutations above all precede notifications.  The notification loop is after
     * turn closure so reentrancy is necessarily a new reducer turn. */
    for (const action of actions) this.#onAction(Object.freeze(action));
    if (this.#items.length > 0) this.#scheduleTurn();
  }

  #priority(kind) {
    if (kind === "device-error") return 0;
    if (kind === "pause") return 1;
    if (kind === "deadline") return 2;
    if (kind === "ack") return 3;
    return 4; /* tick is never enqueued; retain a defensive total order. */
  }

  #reduceItem(item, actions) {
    if (this.#epoch === null) return;
    if (item.kind === "device-error") {
      const epoch = this.#epoch;
      this.#retire();
      actions.push({ kind: "device-lost", cause: "device-error", consumerEpoch: epoch });
      return;
    }
    if (item.kind === "pause") {
      const epoch = this.#epoch;
      this.#retire();
      actions.push({ kind: "paused", consumerEpoch: epoch });
      return;
    }
    if (item.identity === null || item.identity.consumerEpoch !== this.#epoch) return;
    const key = recordKey(item.identity);
    const live = this.#records.get(key);
    if (live === undefined || !sameRecord(live, item.identity)) return;
    if (item.kind === "deadline") {
      const epoch = this.#epoch;
      this.#retire();
      actions.push({ kind: "device-lost", cause: "reply-timeout", consumerEpoch: epoch,
        record: this.#publicRecord(live) });
      return;
    }
    if (item.kind === "ack") {
      this.#records.delete(key);
      actions.push({ kind: "ack", consumerEpoch: this.#epoch, record: this.#publicRecord(live) });
    }
  }

  #publicRecord(record) {
    return Object.freeze({ generation: record.generation, consumerEpoch: record.consumerEpoch,
      sequence: record.sequence, frameOffset: record.frameOffset });
  }

  #retire() {
    this.#epoch = null;
    this.#records.clear();
  }
}

export const CADR_M13_AUDIO_DEADLINE_MS = DEADLINE_MS;
export const CADR_M13_AUDIO_HIGH_WATER = HIGH_WATER;
