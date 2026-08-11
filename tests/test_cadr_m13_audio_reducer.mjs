import assert from "node:assert/strict";

import { CADR_M13_AUDIO_DEADLINE_MS, CADR_M13_AUDIO_HIGH_WATER,
  CadrM13AudioReducer } from "../cadr-web/browser/cadr-m13-audio-reducer.mjs";

function harness() {
  let time = 0;
  const tasks = [];
  const actions = [];
  const reducer = new CadrM13AudioReducer({
    now: () => time,
    queueMicrotask: callback => tasks.push(callback),
    onAction: action => actions.push(action),
  });
  const record = (sequence, epoch = 1n) => ({ generation: 1n, consumerEpoch: epoch,
    sequence: BigInt(sequence), frameOffset: 0 });
  return {
    reducer, actions, record,
    set time(value) { time = value; },
    get time() { return time; },
    flush() { while (tasks.length > 0) tasks.shift()(); },
  };
}

/* Acknowledgement before deadline wins; at the exact deadline, the callback's
 * initial clock sample promotes the older latent deadline first. */
{
  const h = harness();
  assert.equal(h.reducer.open(1n), true);
  assert.equal(h.reducer.post(h.record(1)), true);
  h.time = CADR_M13_AUDIO_DEADLINE_MS - 0.001;
  assert.equal(h.reducer.acknowledge(h.record(1)), true);
  h.flush();
  assert.deepEqual(h.actions.map(action => action.kind), ["ack"]);
}
{
  const h = harness();
  assert.equal(h.reducer.open(1n), true);
  assert.equal(h.reducer.post(h.record(1)), true);
  h.time = CADR_M13_AUDIO_DEADLINE_MS;
  assert.equal(h.reducer.acknowledge(h.record(1)), true);
  h.flush();
  assert.deepEqual(h.actions.map(action => [action.kind, action.cause]),
    [["device-lost", "reply-timeout"]]);
}

/* Every ordering of same-timestamp device-error, pause, acknowledgement, and the
 * promoted deadline produces the fixed reducer priority, not callback order. */
for (const order of [["device", "pause", "ack"], ["device", "ack", "pause"],
  ["pause", "device", "ack"], ["pause", "ack", "device"],
  ["ack", "device", "pause"], ["ack", "pause", "device"]]) {
  const h = harness();
  h.reducer.open(1n); h.reducer.post(h.record(1)); h.time = CADR_M13_AUDIO_DEADLINE_MS;
  for (const item of order) {
    if (item === "device") assert.equal(h.reducer.deviceLost(), true);
    else if (item === "pause") assert.equal(h.reducer.pause(), true);
    else assert.equal(h.reducer.acknowledge(h.record(1)), true);
  }
  h.flush();
  assert.deepEqual(h.actions.map(action => [action.kind, action.cause]),
    [["device-lost", "device-error"]], `four-way tie order ${order.join(",")}`);
}

/* Separate browser tasks cannot retroactively apply a later event's higher
 * priority.  A deadline committed in one task fences an ensuing device callback. */
{
  const h = harness();
  h.reducer.open(1n); h.reducer.post(h.record(1)); h.time = CADR_M13_AUDIO_DEADLINE_MS;
  assert.equal(h.reducer.deadlineTick(), true); h.flush();
  assert.equal(h.reducer.deviceLost(), false); h.flush();
  assert.deepEqual(h.actions.map(action => [action.kind, action.cause]),
    [["device-lost", "reply-timeout"]]);
}

/* Equal latent deadlines retain post order, and reaching high water does not
 * fabricate an acknowledgement or discard the records before their deadline. */
{
  const h = harness();
  h.reducer.open(1n);
  for (let index = 1; index <= CADR_M13_AUDIO_HIGH_WATER; index += 1) {
    assert.equal(h.reducer.post(h.record(index)), true);
  }
  assert.equal(h.reducer.post(h.record(99)), false);
  assert.equal(h.reducer.queuedRecords, CADR_M13_AUDIO_HIGH_WATER);
  h.time = CADR_M13_AUDIO_DEADLINE_MS;
  assert.equal(h.reducer.deadlineTick(), true); h.flush();
  assert.equal(h.actions.length, 1);
  assert.equal(h.actions[0].cause, "reply-timeout");
  assert.equal(h.actions[0].record.sequence, 1n, "oldest equal deadline wins");
}

/* Pause retires instead of suspending an epoch.  A late old-epoch reply cannot
 * affect a fresh direct-user-activated consumer epoch. */
{
  const h = harness();
  h.reducer.open(1n); h.reducer.post(h.record(1));
  assert.equal(h.reducer.acknowledge(h.record(1)), true); h.flush();
  assert.equal(h.reducer.pause(), true); h.flush();
  assert.deepEqual(h.actions.map(action => action.kind), ["ack", "paused"],
    "an older acknowledged turn is emitted before a later pause control");
}
{
  const h = harness();
  h.reducer.open(1n); h.reducer.post(h.record(1));
  assert.equal(h.reducer.pause(), true); h.flush();
  assert.equal(h.reducer.open(2n), true); h.reducer.post(h.record(2, 2n));
  assert.equal(h.reducer.acknowledge(h.record(1)), false, "old epoch is fenced before admission");
  assert.equal(h.reducer.acknowledge(h.record(2, 2n)), true); h.flush();
  assert.deepEqual(h.actions.map(action => action.kind), ["paused", "ack"]);
}

/* The reducer closes its watermark before emitting.  This deliberately reentrant
 * callback joins a later microtask and cannot alter the already committed pause. */
{
  let time = 0;
  const tasks = [];
  const actions = [];
  let reducer;
  const record = { generation: 1n, consumerEpoch: 1n, sequence: 1n, frameOffset: 0 };
  reducer = new CadrM13AudioReducer({ now: () => time, queueMicrotask: fn => tasks.push(fn),
    onAction: action => { actions.push(action); reducer.acknowledge(record); } });
  reducer.open(1n); reducer.post(record); reducer.pause();
  while (tasks.length > 0) tasks.shift()();
  assert.deepEqual(actions.map(action => action.kind), ["paused"]);
  assert.equal(reducer.consumerEpoch, null);
  assert.equal(time, 0);
}

console.log("cadr M13 audio deadline/reducer tie and epoch tests passed");
