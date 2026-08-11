/* Shared shipped browser-audio candidate factory.  Disconnect is deliberately
 * repeatable for a node published after the first terminal pass, while context
 * close is requested at most once and every rejection is consumed. */
export class BrowserAudioFactory {
  contexts = []; activation = []; starts = 0;
  #beforeModule; #afterModule; #afterNode; #startMode; #onNode; #closeDeadlineMs;
  constructor({ beforeModule = null, afterModule = null, afterNode = null, startMode = "resume",
    onNode = null, closeDeadlineMs = 50 } = {}) {
    if (![beforeModule, afterModule, afterNode, onNode].every(value => value === null || typeof value === "function") ||
        !Number.isSafeInteger(closeDeadlineMs) || closeDeadlineMs < 1 ||
        !["resume", "suspend-first"].includes(startMode)) throw new TypeError("invalid browser audio factory options");
    this.#beforeModule = beforeModule; this.#afterModule = afterModule; this.#afterNode = afterNode;
    this.#startMode = startMode; this.#onNode = onNode; this.#closeDeadlineMs = closeDeadlineMs;
  }
  #close(entry) {
    if (entry.closeStarted) return;
    entry.closeStarted = true; entry.closeCalls += 1;
    try { Promise.resolve(entry.context.close()).catch(() => { entry.closeRejections += 1; }); }
    catch { entry.closeRejections += 1; }
  }
  prepare() {
    const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (Constructor === undefined) throw new Error("AudioContext unavailable");
    this.activation.push(globalThis.navigator.userActivation?.isActive === true);
    const context = new Constructor();
    const entry = { context, node: null, disconnected: false, disconnectPasses: 0,
      nodeDisconnects: 0, nodeAllocatedAfterFirstDisconnect: false, starting: false,
      closeRequested: false, closeTimer: null, closeStarted: false,
      closeCalls: 0, closeRejections: 0 };
    this.contexts.push(entry);
    const port = { onmessage: null, postMessage(value, transfer) {
      if (entry.node === null) throw new Error("AudioWorklet port used before start");
      entry.node.port.postMessage(value, transfer ?? []);
    } };
    const factory = this;
    return { port, async start() {
      entry.starting = true;
      try {
        await factory.#beforeModule?.(entry);
        await context.audioWorklet.addModule("./cadr-m13-audio-worklet.mjs");
        await factory.#afterModule?.(entry);
        entry.node = new AudioWorkletNode(context, "cadr-m13-audio", {
          numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
        });
        entry.nodeAllocatedAfterFirstDisconnect = entry.disconnectPasses > 0;
        entry.node.port.onmessage = event => port.onmessage?.(event);
        factory.#onNode?.(entry, port);
        entry.node.connect(context.destination);
        await factory.#afterNode?.(entry);
        const startIndex = factory.starts++;
        if (factory.#startMode === "suspend-first") {
          if (startIndex === 0) await context.suspend(); else await context.resume();
        } else await context.resume();
      } finally {
        entry.starting = false;
        if (entry.closeTimer !== null) { clearTimeout(entry.closeTimer); entry.closeTimer = null; }
        if (entry.closeRequested) factory.#close(entry);
      }
    }, disconnect() {
      entry.disconnected = true; entry.disconnectPasses += 1;
      if (entry.node !== null) {
        try { entry.node.port.onmessage = null; entry.node.disconnect(); entry.nodeDisconnects += 1; }
        catch { /* Late terminal cleanup remains bounded. */ }
      }
      if (entry.starting) {
        entry.closeRequested = true;
        if (entry.closeTimer === null) entry.closeTimer = setTimeout(() => factory.#close(entry),
          factory.#closeDeadlineMs);
      } else factory.#close(entry);
    } };
  }
}
