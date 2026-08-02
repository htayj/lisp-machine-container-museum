/* ABI1.11 M13 Worklet queue.  It accepts exactly eight complete CDRPCM1-derived
 * records and acknowledges only after the final sample reaches an output block. */
export const CADR_M13_WORKLET_MAX_RECORDS = 8;

const positiveU64 = value => typeof value === "bigint" && value > 0n && value <= 0xffff_ffff_ffff_ffffn;
const sequence = value => typeof value === "bigint" && value >= 0n && value <= 0xffff_ffff_ffff_ffffn;
const u32 = value => Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

export class CadrM13PcmQueue {
  #entries = [];
  #epoch = null;
  #closed = false;
  get queuedRecords() { return this.#entries.length; }
  open(consumerEpoch) {
    if (this.#closed || !positiveU64(consumerEpoch)) return false;
    this.#epoch = consumerEpoch; this.#entries.length = 0; return true;
  }
  close() { this.#closed = true; this.#epoch = null; this.#entries.length = 0; }
  enqueue(message) {
    if (this.#closed || message?.type !== "cadr-audio-pcm" || message.version !== 1 ||
        !positiveU64(message.generation) || !positiveU64(message.consumerEpoch) ||
        !sequence(message.sequence) || !u32(message.frameOffset) ||
        !(message.samples instanceof ArrayBuffer) || message.samples.byteLength < 2 ||
        message.samples.byteLength > 1024 || message.samples.byteLength % 2 !== 0 ||
        this.#entries.length >= CADR_M13_WORKLET_MAX_RECORDS) return false;
    if (this.#epoch === null) this.#epoch = message.consumerEpoch;
    if (message.consumerEpoch !== this.#epoch) return false;
    const samples = new Int16Array(message.samples.slice(0));
    this.#entries.push({ generation: message.generation, consumerEpoch: message.consumerEpoch,
      sequence: message.sequence, frameOffset: message.frameOffset, samples, at: 0 });
    return true;
  }
  render(output) {
    if (!(output instanceof Float32Array)) throw new TypeError("output must be Float32Array");
    output.fill(0); let at = 0; const acknowledgements = [];
    while (at < output.length && this.#entries.length > 0) {
      const entry = this.#entries[0]; const count = Math.min(output.length - at, entry.samples.length - entry.at);
      for (let index = 0; index < count; index += 1) output[at + index] = entry.samples[entry.at + index] / 32768;
      at += count; entry.at += count;
      if (entry.at === entry.samples.length) {
        this.#entries.shift(); acknowledgements.push(Object.freeze({ type: "cadr-audio-ack", version: 1,
          generation: entry.generation, consumerEpoch: entry.consumerEpoch,
          sequence: entry.sequence, frameOffset: entry.frameOffset }));
      }
    }
    return Object.freeze(acknowledgements);
  }
}

if (typeof AudioWorkletProcessor !== "undefined" && typeof registerProcessor !== "undefined") {
  class CadrM13AudioProcessor extends AudioWorkletProcessor {
    constructor() {
      super(); this.queue = new CadrM13PcmQueue();
      this.port.onmessage = event => {
        /* The reply grammar is closed to whole-record acknowledgements.  An
         * invalid post is a shell defect and cannot invent a second message
         * type or acknowledge any sample. */
        this.queue.enqueue(event.data);
      };
    }
    process(_inputs, outputs) {
      const output = outputs[0]?.[0]; if (output === undefined) return true;
      for (const acknowledgement of this.queue.render(output)) this.port.postMessage(acknowledgement);
      return true;
    }
  }
  registerProcessor("cadr-m13-audio", CadrM13AudioProcessor);
}
