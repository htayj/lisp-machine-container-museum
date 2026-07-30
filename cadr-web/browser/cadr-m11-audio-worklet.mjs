/* M11's AudioWorklet consumes only deterministic PCM prepared by the Wasm
 * core.  It does not synthesize oscillator samples, inspect CADR state, or
 * acknowledge a packet until its final frame has reached the output block. */
export const CADR_M11_WORKLET_MAX_QUEUED_FRAMES = 8192;

function u32(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff; }
function u64(value) { return typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn; }
function pcm(value) {
  if (value instanceof ArrayBuffer) return new Int16Array(value.slice(0));
  if (ArrayBuffer.isView(value) && value.BYTES_PER_ELEMENT === 2) {
    return new Int16Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return null;
}

export class CadrM11PcmQueue {
  #entries = [];
  #queuedFrames = 0;
  get queuedFrames() { return this.#queuedFrames; }

  enqueue(message) {
    if (message?.type !== "pcm" || !u64(message.generation) || !u64(message.sequence) ||
        !u32(message.frameOffset) || !u32(message.frames) || message.frames === 0) {
      return false;
    }
    const samples = pcm(message.pcmS16Le);
    if (samples === null || samples.length !== message.frames ||
        this.#queuedFrames + samples.length > CADR_M11_WORKLET_MAX_QUEUED_FRAMES) return false;
    this.#entries.push({ generation: message.generation, sequence: message.sequence,
      frameOffset: message.frameOffset, frames: message.frames, samples, at: 0 });
    this.#queuedFrames += samples.length;
    return true;
  }

  clearGeneration(generation) {
    if (!u64(generation)) return false;
    this.#entries = this.#entries.filter(entry => entry.generation === generation);
    this.#queuedFrames = this.#entries.reduce((total, entry) => total + entry.samples.length - entry.at, 0);
    return true;
  }

  render(output) {
    if (!(output instanceof Float32Array)) throw new TypeError("output must be Float32Array");
    output.fill(0);
    let frame = 0; const acknowledgements = [];
    while (frame < output.length && this.#entries.length !== 0) {
      const entry = this.#entries[0];
      const count = Math.min(output.length - frame, entry.samples.length - entry.at);
      for (let index = 0; index < count; index += 1) output[frame + index] = entry.samples[entry.at + index] / 32768;
      frame += count; entry.at += count; this.#queuedFrames -= count;
      if (entry.at === entry.samples.length) {
        this.#entries.shift();
        acknowledgements.push(Object.freeze({ type: "ack", generation: entry.generation,
          sequence: entry.sequence, frameOffset: entry.frameOffset, frames: entry.frames }));
      }
    }
    return Object.freeze(acknowledgements);
  }
}

/* Kept behind the AudioWorklet global so importing this source in Node tests
 * neither tries to register a processor nor borrows a host audio fallback. */
if (typeof AudioWorkletProcessor !== "undefined" && typeof registerProcessor !== "undefined") {
  class CadrM11AudioProcessor extends AudioWorkletProcessor {
    constructor() {
      super(); this.queue = new CadrM11PcmQueue();
      this.port.onmessage = event => {
        const message = event.data;
        if (message?.type === "clear-generation") this.queue.clearGeneration(message.generation);
        else if (!this.queue.enqueue(message)) this.port.postMessage({ type: "rejected" });
      };
    }
    process(_inputs, outputs) {
      const channels = outputs[0] ?? [];
      if (channels.length === 0) return true;
      const acknowledgements = this.queue.render(channels[0]);
      for (let channel = 1; channel < channels.length; channel += 1) channels[channel].set(channels[0]);
      for (const acknowledgement of acknowledgements) this.port.postMessage(acknowledgement);
      return true;
    }
  }
  registerProcessor("cadr-m11-audio", CadrM11AudioProcessor);
}
