/* Private ABI1.11 audio source.  It composes the frozen v7 M11 cursor/render
 * operations without widening them: only this source remembers frame counts,
 * and public/worklet acknowledgements never supply that authority. */
import { encodeCdrPcm1, parseCdrM11Open1, sha256Hex } from
  "../browser/cadr-m13-audio-record.mjs";

const OK = 0, STALE = 3, NOT_READY = 9, RESOURCE_LIMIT = 22;
const key = value => `${value.generation}:${value.consumerEpoch}:${value.sequence}:${value.frameOffset}`;

export class CadrM13AudioSource {
  #invoke; #emit; #epoch = 0n; #generation = 0n; #ordinal = 0n; #records = new Map();
  #queuePackets = 0; #queuedFrames = 0; #open = false; #pumping = false;
  #sessionId = null;
  constructor({ invoke, emit }) {
    if (typeof invoke !== "function" || typeof emit !== "function") throw new TypeError("M13 audio source needs invoke and emit");
    this.#invoke = invoke; this.#emit = emit;
  }
  async open() {
    if (this.#open) return { status: NOT_READY };
    const reply = await this.#invoke({ op: "audio-open-private" });
    const opened = reply?.status === OK ? parseCdrM11Open1(reply.record) : null;
    if (opened === null) return { status: reply?.status ?? NOT_READY };
    this.#epoch = opened.consumerEpoch; this.#generation = opened.generation;
    this.#queuePackets = opened.queuePackets; this.#queuedFrames = opened.queuedFrames;
    this.#ordinal = 0n; this.#records.clear(); this.#open = true;
    return { status: OK, ...opened };
  }
  async pump(sessionId) {
    if (!this.#open || this.#pumping) return false;
    this.#pumping = true; this.#sessionId = sessionId;
    try {
      /* Zero-frame UART is semantic, not an audio cell.  Ack it exactly inside
       * the private source and continue until PCM, empty, or high water.  One
       * invocation examines at most the frozen 64-packet core capacity, even
       * if a broken lower adapter reports a successful non-progressing ack. */
      let examinedPackets = 0;
      while (this.#records.size < 8 && examinedPackets < 64) {
        examinedPackets += 1;
        const next = await this.#invoke({ op: "audio-peek" });
        if (next?.status !== OK) return next?.status === NOT_READY;
        if (next.generation !== this.#generation || !Number.isInteger(next.frameOffset) ||
            !Number.isInteger(next.framesRemaining) || next.frameOffset < 0 ||
            next.framesRemaining < 0 || next.frameOffset > 512) return false;
        if (next.framesRemaining === 0) {
          const ack = await this.#invoke({ op: "audio-ack", generation: next.generation,
            sequence: next.sequence, frameOffset: next.frameOffset, frames: 0 });
          if (ack?.status !== OK) return false;
          this.#queuePackets = ack.queuePackets ?? Math.max(0, this.#queuePackets - 1);
          continue;
        }
        const requestedFrames = Math.min(512, next.framesRemaining);
        if (requestedFrames < 1 || next.frameOffset + requestedFrames > 512) return false;
        const rendered = await this.#invoke({ op: "audio-render", generation: next.generation,
          sequence: next.sequence, frameOffset: next.frameOffset,
          requestedFrames });
        if (rendered?.status !== OK || !Number.isInteger(rendered.frames) || rendered.frames < 1 ||
            rendered.frames > 512 || !(rendered.pcmS16Le instanceof ArrayBuffer) ||
            rendered.pcmS16Le.byteLength !== rendered.frames * 2) return false;
        const identity = Object.freeze({ generation: next.generation, consumerEpoch: this.#epoch,
          sequence: next.sequence, frameOffset: next.frameOffset });
        const identityKey = key(identity);
        if (this.#records.has(identityKey)) return false;
        const record = encodeCdrPcm1({ ...identity, samples: rendered.pcmS16Le });
        const envelope = Object.freeze({ type: "cadr-event", version: 8, sessionId,
          event: "audio-pcm", eventOrdinal: this.#ordinal + 1n, consumerEpoch: this.#epoch,
          record, recordSha256: await sha256Hex(record) });
        this.#records.set(identityKey, Object.freeze({ ...identity, frames: rendered.frames }));
        this.#ordinal += 1n; this.#emit(envelope); return true;
      }
      return false;
    } finally { this.#pumping = false; }
  }
  async ack(identity) {
    if (!this.#open || identity?.consumerEpoch !== this.#epoch) return { status: STALE };
    const retained = this.#records.get(key(identity));
    if (retained === undefined) return { status: STALE };
    const result = await this.#invoke({ op: "audio-ack", generation: retained.generation,
      sequence: retained.sequence, frameOffset: retained.frameOffset, frames: retained.frames });
    if (result?.status !== OK) return { status: result?.status ?? NOT_READY };
    this.#records.delete(key(retained)); this.#queuePackets = result.queuePackets ?? this.#queuePackets;
    this.#queuedFrames = result.queuedFrames ?? this.#queuedFrames;
    return { status: OK, queuePackets: this.#queuePackets, queuedFrames: this.#queuedFrames };
  }
  async pause({ consumerEpoch }) {
    if (!this.#open || consumerEpoch !== this.#epoch) return { status: STALE };
    this.#open = false; this.#records.clear(); this.#sessionId = null; return { status: OK };
  }
  async deviceLost({ consumerEpoch }) {
    if (!this.#open || consumerEpoch !== this.#epoch) return { status: STALE };
    this.#open = false; this.#records.clear(); this.#sessionId = null; return { status: OK };
  }
  get backpressured() { return this.#records.size >= 8; }
  get inFlightRecords() { return this.#records.size; }
  audioState(state) { return Object.freeze({ state, generation: this.#generation,
    consumerEpoch: this.#epoch, queuePackets: this.#queuePackets,
    queuedFrames: this.#queuedFrames }); }
}
