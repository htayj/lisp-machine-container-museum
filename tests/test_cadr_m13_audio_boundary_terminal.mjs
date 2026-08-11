import assert from "node:assert/strict";
import { CADR_M13_AUDIO_PROFILE, encodeCdrPcm1, sha256Hex } from
  "../cadr-web/browser/cadr-m13-audio-record.mjs";
import { CADR_M13_AUDIO_RECEIPT_HISTORY, CadrM13AudioBoundary } from
  "../cadr-web/browser/cadr-m13-audio-boundary.mjs";

class Port {
  messages = []; onmessage = null;
  postMessage(value) { this.messages.push(value); }
  reply(value) { return this.onmessage?.({ data: value }); }
}

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function microtasks(count = 16) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}
function core({ open, ack = async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
  pause = async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
  deviceLost = async () => ({ status: 0, queuePackets: 0, queuedFrames: 0 }),
  terminalRelease = () => true }) {
  return { open, ack, pause, deviceLost, terminalRelease };
}
function opened(epoch = 2n) {
  return { status: 0, generation: 1n, consumerEpoch: epoch, queuePackets: 1, queuedFrames: 1 };
}
function candidate({ start = async () => {}, port = new Port() } = {}) {
  return { port, disconnected: false, start, disconnect() { this.disconnected = true; } };
}

/* Terminal worker loss revokes ownership immediately.  The returned activation
 * promise is cancelled logically even when the browser's start promise cannot
 * be physically cancelled, and the candidate is released exactly once. */
{
  const startGate = deferred(); const value = candidate({ start: () => startGate.promise });
  const boundary = new CadrM13AudioBoundary({ core: core({ open: async () => {
    assert.fail("core.open follows a never-settling start"); } }),
  audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  const activation = boundary.open(CADR_M13_AUDIO_PROFILE);
  await microtasks(); boundary.closeForWorkerLoss();
  assert.equal((await activation).status, 9);
  assert.equal(value.disconnected, true);
  assert.equal(boundary.state().state, "DEVICE_LOST");
}

/* A never-settling private open cannot retain its already-started browser
 * candidate or defer terminal state.  A later valid private result is released
 * through the retired epoch but cannot install the candidate. */
{
  const openGate = deferred(); const releases = []; const value = candidate();
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: () => openGate.promise,
    terminalRelease: request => { releases.push(request); return true; },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  const activation = boundary.open(CADR_M13_AUDIO_PROFILE);
  await microtasks(); boundary.closeForWorkerLoss();
  assert.equal((await activation).status, 9);
  assert.equal(value.disconnected, true);
  assert.equal(boundary.state().state, "DEVICE_LOST");
  openGate.resolve(opened(31n)); await microtasks();
  assert.deepEqual(releases, [{ consumerEpoch: null, cause: "worker-loss" },
    { consumerEpoch: 31n, cause: "terminal-late-open" }]);
}

/* A never-settling acknowledgement must not delay terminal consumer release,
 * waiter settlement, or final state.  Its eventual completion is fenced by the
 * cancelled ownership token and cannot publish a committed receipt. */
{
  const ackGate = deferred(); const releases = []; const value = candidate();
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => opened(),
    ack: () => ackGate.promise,
    terminalRelease: request => { releases.push(request); return true; },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.open(CADR_M13_AUDIO_PROFILE)).status, 0);
  const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 2n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([1, -1]) });
  assert.equal(await boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "terminal", event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 2n,
    record, recordSha256: await sha256Hex(record) }, "terminal"), true);
  const identity = { generation: 1n, consumerEpoch: 2n, sequence: 0n, frameOffset: 0 };
  value.port.reply({ type: "cadr-audio-ack", version: 1, ...identity }); await microtasks();
  const committed = boundary.waitForAckCommitted(identity);
  boundary.closeForWorkerLoss();
  assert.equal((await committed).kind, "stale");
  assert.equal(value.disconnected, true);
  assert.equal(boundary.state().state, "DEVICE_LOST");
  assert.deepEqual(releases, [{ consumerEpoch: 2n, cause: "worker-loss" }]);
  ackGate.resolve({ status: 0, queuePackets: 0, queuedFrames: 0 }); await microtasks();
  assert.equal((await boundary.waitForAckCommitted(identity)).kind, "stale");
}

/* Invalid candidates are disconnected whenever they carry a cleanup method.
 * A frozen onmessage setter is a post-core-open installation failure: it rolls
 * back the reducer epoch, releases both browser candidate and private core, and
 * leaves a deterministic retryable PAUSED state. */
{
  const malformed = { port: null, disconnected: false,
    disconnect() { this.disconnected = true; } };
  const malformedBoundary = new CadrM13AudioBoundary({ core: core({ open: async () => opened() }),
    audioFactory: { prepare: () => malformed }, now: () => 0 });
  assert.equal(malformedBoundary.prepareActivation(), false);
  assert.equal(malformed.disconnected, true);

  const releases = []; const frozen = candidate({ port: Object.freeze({ onmessage: null, postMessage() {} }) });
  const recovery = candidate(); let attempts = 0;
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => opened(attempts++ === 0 ? 41n : 42n),
    terminalRelease: request => { releases.push(request); return true; },
  }), audioFactory: { prepare: () => attempts === 0 ? frozen : recovery }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.open(CADR_M13_AUDIO_PROFILE)).status, 9);
  await microtasks();
  assert.equal(frozen.disconnected, true);
  assert.deepEqual(releases, [{ consumerEpoch: 41n, cause: "browser-install-failure" }]);
  assert.equal(boundary.state().state, "PAUSED");
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.resume()).status, 0);
  assert.equal(recovery.disconnected, false);
}

/* Receipt evidence has a fixed per-kind history cap.  It cannot grow with
 * indefinite playback; eviction only removes already-settled evidence, while
 * live duplicate and acknowledgement ordering remain owned by posted records
 * and the reducer. */
{
  const value = candidate(); let acknowledgements = 0;
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => opened(61n),
    ack: async () => { acknowledgements += 1; return { status: 0, queuePackets: 1, queuedFrames: 1 }; },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.open(CADR_M13_AUDIO_PROFILE)).status, 0);
  const identities = [];
  for (let index = 0; index < CADR_M13_AUDIO_RECEIPT_HISTORY + 5; index += 1) {
    const sequence = BigInt(index);
    const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 61n, sequence,
      frameOffset: 0, samples: new Int16Array([index, -index]) });
    assert.equal(await boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
      sessionId: "retention", event: "audio-pcm", eventOrdinal: sequence + 1n, consumerEpoch: 61n,
      record, recordSha256: await sha256Hex(record) }, "retention"), true);
    const identity = { generation: 1n, consumerEpoch: 61n, sequence, frameOffset: 0 };
    identities.push(identity);
    value.port.reply({ type: "cadr-audio-staged", version: 1, ...identity });
    value.port.reply({ type: "cadr-audio-ack", version: 1, ...identity });
    await microtasks();
    assert.equal((await boundary.waitForAckCommitted(identity)).kind, "ack-committed");
  }
  assert.equal(acknowledgements, identities.length);
  assert.deepEqual(boundary.receiptEvidenceState(), { posted: 0,
    staged: CADR_M13_AUDIO_RECEIPT_HISTORY, committed: CADR_M13_AUDIO_RECEIPT_HISTORY,
    capacity: CADR_M13_AUDIO_RECEIPT_HISTORY });
  assert.equal((await boundary.waitForAckCommitted(identities[0])).kind, "stale");
  assert.equal((await boundary.waitForAckCommitted(identities.at(-1))).kind, "ack-committed");
  value.port.reply({ type: "cadr-audio-ack", version: 1, ...identities[0] }); await microtasks();
  assert.equal(acknowledgements, identities.length, "evicted evidence cannot re-admit a duplicate ack");
}

/* A cancelled start can allocate only after its promise settles.  Terminal
 * cancellation disconnects once immediately and repeats cleanup on both a late
 * resolve and a late reject, so neither path keeps browser-audio authority. */
for (const lateKind of ["resolve", "reject"]) {
  const gate = deferred();
  const value = {
    port: new Port(), allocated: false, disconnects: 0, cleaned: false,
    async start() {
      await gate.promise; this.allocated = true;
      if (lateKind === "reject") throw new Error("late start rejection");
    },
    disconnect() { this.disconnects += 1; if (this.allocated) this.cleaned = true; },
  };
  const boundary = new CadrM13AudioBoundary({ core: core({ open: async () => {
    assert.fail("cancelled late start must not open private core");
  } }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  const opening = boundary.open(CADR_M13_AUDIO_PROFILE);
  await microtasks(); boundary.closeForWorkerLoss();
  assert.equal((await opening).status, 9);
  assert.equal(value.disconnects, 1);
  gate.resolve(); await microtasks();
  assert.equal(value.allocated, true, lateKind + " allocated after terminal close");
  assert.equal(value.cleaned, true, lateKind + " late allocation is disconnected");
  assert.equal(value.disconnects, 2, lateKind + " repeats idempotent cleanup after settlement");
  assert.equal(boundary.state().state, "DEVICE_LOST");
}

/* Nonterminal operations remain serialized.  Terminal release may run while a
 * request is stuck, but is a synchronous tombstone only: it cannot enter the
 * non-reentrant core.  A late open releases only after the open call exits. */
{
  const openGate = deferred(); let active = 0; const trace = [];
  const value = candidate();
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => {
      assert.equal(active, 0); active += 1; trace.push("open-start");
      await openGate.promise; trace.push("open-end"); active -= 1;
      return opened(71n);
    },
    terminalRelease: request => {
      trace.push("terminal-" + request.cause + "-active-" + active);
      return true;
    },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  const opening = boundary.open(CADR_M13_AUDIO_PROFILE);
  await microtasks(); boundary.closeForWorkerLoss();
  assert.equal((await opening).status, 9);
  assert.deepEqual(trace, ["open-start", "terminal-worker-loss-active-1"]);
  openGate.resolve(); await microtasks();
  assert.deepEqual(trace, ["open-start", "terminal-worker-loss-active-1",
    "open-end", "terminal-terminal-late-open-active-0"]);
  assert.equal(value.disconnected, true);
}

{
  const ackGate = deferred(); let active = 0; const trace = []; const value = candidate();
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => opened(72n),
    ack: async () => {
      assert.equal(active, 0); active += 1; trace.push("ack-start");
      await ackGate.promise; trace.push("ack-end"); active -= 1;
      return { status: 0, queuePackets: 0, queuedFrames: 0 };
    },
    terminalRelease: request => {
      trace.push("terminal-" + request.cause + "-active-" + active);
      return true;
    },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.open(CADR_M13_AUDIO_PROFILE)).status, 0);
  const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 72n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([2, -2]) });
  assert.equal(await boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "nonreentrant", event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 72n,
    record, recordSha256: await sha256Hex(record) }, "nonreentrant"), true);
  value.port.reply({ type: "cadr-audio-ack", version: 1, generation: 1n,
    consumerEpoch: 72n, sequence: 0n, frameOffset: 0 });
  await microtasks(); assert.deepEqual(trace, ["ack-start"]);
  boundary.closeForWorkerLoss();
  assert.deepEqual(trace, ["ack-start", "terminal-worker-loss-active-1"]);
  assert.equal(boundary.state().state, "DEVICE_LOST");
  ackGate.resolve(); await microtasks();
  assert.deepEqual(trace, ["ack-start", "terminal-worker-loss-active-1", "ack-end"]);
}

/* Receipt keys are made only after the full identity has exact primitive types,
 * closed keys, u64 BigInt ranges, and a safe u32 frame offset. */
{
  const value = candidate(); let acks = 0;
  const boundary = new CadrM13AudioBoundary({ core: core({
    open: async () => opened(81n),
    ack: async () => { acks += 1; return { status: 0, queuePackets: 0, queuedFrames: 0 }; },
  }), audioFactory: { prepare: () => value }, now: () => 0 });
  assert.equal(boundary.prepareActivation(), true);
  assert.equal((await boundary.open(CADR_M13_AUDIO_PROFILE)).status, 0);
  const record = encodeCdrPcm1({ generation: 1n, consumerEpoch: 81n, sequence: 0n,
    frameOffset: 0, samples: new Int16Array([3, -3]) });
  assert.equal(await boundary.acceptWorkerEvent({ type: "cadr-event", version: 8,
    sessionId: "types", event: "audio-pcm", eventOrdinal: 1n, consumerEpoch: 81n,
    record, recordSha256: await sha256Hex(record) }, "types"), true);
  const identity = { generation: 1n, consumerEpoch: 81n, sequence: 0n, frameOffset: 0 };
  const invalid = [
    { ...identity, generation: 1 }, { ...identity, consumerEpoch: "81" },
    { ...identity, sequence: Object(0n) }, { ...identity, frameOffset: 0.5 },
    { ...identity, frameOffset: Number.MAX_SAFE_INTEGER + 1 },
    { ...identity, extra: true },
  ];
  for (const mutant of invalid) {
    assert.equal(value.port.reply({ type: "cadr-audio-staged", version: 1, ...mutant }), false);
    assert.equal(value.port.reply({ type: "cadr-audio-ack", version: 1, ...mutant }), false);
    assert.equal((await boundary.waitForAckCommitted(mutant)).kind, "stale");
  }
  assert.equal(value.port.reply({ type: "cadr-audio-staged", version: 1, ...identity }), true);
  assert.equal(value.port.reply({ type: "cadr-audio-ack", version: 1, ...identity }), true);
  await microtasks();
  assert.equal((await boundary.waitForAckCommitted(identity)).kind, "ack-committed");
  assert.equal(acks, 1);
}

console.log("cadr M13 terminal ownership, install cleanup, and receipt retention tests passed");
