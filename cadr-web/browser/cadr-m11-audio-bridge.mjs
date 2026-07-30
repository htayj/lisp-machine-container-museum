/* Main-thread half of M11 audio.  It serializes one cursor from the worker to
 * the AudioWorklet and sends the core acknowledgement only after the Worklet
 * reports consumption.  This preserves queue backpressure and never lets a
 * browser callback manufacture PCM or advance the CADR cursor. */
export class CadrM11AudioBridge {
  #request; #port; #pumping = false; #inFlight = null; #closed = false;
  #acknowledging = false; #acknowledgedCursors = new Set();
  constructor({ request, port }) {
    if (typeof request !== "function" || port === null || typeof port.postMessage !== "function") {
      throw new TypeError("M11 bridge requires a request function and AudioWorklet port");
    }
    this.#request = request; this.#port = port;
    /* Returning the promise is useful to test the asynchronous Worklet
     * boundary.  Browser MessagePort ignores that return value. */
    this.#port.onmessage = event => this.#acknowledge(event.data);
  }
  async pump(maxFrames = 512) {
    if (this.#closed || this.#pumping || this.#inFlight !== null || !Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > 512) return false;
    this.#pumping = true;
    try {
      const next = await this.#request({ op: "audio-peek" });
      if (next?.status !== 0) return false;
      const cursor = Object.freeze({ generation: next.generation, sequence: next.sequence,
        frameOffset: next.frameOffset, frames: next.framesRemaining });
      /* Votrax/UART events are semantic zero-frame records.  They must not be
       * fabricated into silent PCM or queued in the Worklet; acknowledge their
       * exact zero-length cursor once through the normal core authority. */
      if (cursor.frames === 0) {
        this.#inFlight = cursor;
        await this.#acknowledgeCursor(cursor);
        return this.#inFlight === null;
      }
      const rendered = await this.#request({ op: "audio-render", generation: next.generation,
        sequence: next.sequence, frameOffset: next.frameOffset,
        requestedFrames: Math.min(maxFrames, next.framesRemaining) });
      if (rendered?.status !== 0 || rendered.frames < 1 ||
          !(rendered.pcmS16Le instanceof ArrayBuffer)) return false;
      this.#inFlight = Object.freeze({ generation: next.generation, sequence: next.sequence,
        frameOffset: next.frameOffset, frames: rendered.frames });
      try {
        this.#port.postMessage({ type: "pcm", ...this.#inFlight, pcmS16Le: rendered.pcmS16Le },
          [rendered.pcmS16Le]);
      } catch {
        /* The transferred buffer cannot be replayed safely.  Retain the core
         * cursor and fail closed instead of pumping the same record again. */
        this.#closed = true;
        return false;
      }
      return true;
    } finally { this.#pumping = false; }
  }
  async #acknowledge(message) {
    if (this.#closed || message?.type !== "ack" || this.#inFlight === null || this.#acknowledging) return false;
    const cursor = this.#inFlight;
    if (message.generation !== cursor.generation || message.sequence !== cursor.sequence ||
        message.frameOffset !== cursor.frameOffset || message.frames !== cursor.frames) return false;
    return this.#acknowledgeCursor(cursor);
  }
  async #acknowledgeCursor(cursor) {
    const cursorKey = `${cursor.generation}:${cursor.sequence}:${cursor.frameOffset}:${cursor.frames}`;
    if (this.#closed || this.#inFlight !== cursor || this.#acknowledging || this.#acknowledgedCursors.has(cursorKey)) return false;
    this.#acknowledging = true;
    let reply;
    try {
      reply = await this.#request({ op: "audio-ack", generation: cursor.generation,
        sequence: cursor.sequence, frameOffset: cursor.frameOffset, frames: cursor.frames });
    } catch { this.#closed = true; this.#acknowledging = false; return false; }
    if (reply?.status !== 0) { this.#closed = true; this.#acknowledging = false; return false; }
    if (this.#inFlight !== cursor) { this.#acknowledging = false; return false; }
    /* Sequence is monotonic within an audio generation; retain a bounded
     * recently-acknowledged fence so stale duplicate Worklet callbacks cannot
     * become a second acknowledgement if a faulty lower layer repeats a
     * cursor.  This is not unbounded browser-session state. */
    if (this.#acknowledgedCursors.size === 1024) {
      this.#acknowledgedCursors.delete(this.#acknowledgedCursors.values().next().value);
    }
    this.#acknowledgedCursors.add(cursorKey);
    this.#inFlight = null;
    this.#acknowledging = false;
    await this.pump();
    return true;
  }
  close() { this.#closed = true; this.#inFlight = null; this.#acknowledgedCursors.clear(); this.#port.onmessage = null; }
}
