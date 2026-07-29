import assert from "node:assert/strict";
import test from "node:test";
import {
  CADR_M5_PROTOCOL_VERSION,
  bindM5VisibilityAdapter,
} from "../cadr-web/wasm/cadr-m5-visibility-adapter.mjs";

class FakeDocument {
  #listeners = new Map();

  constructor(hidden = false) {
    this.hidden = hidden;
  }

  addEventListener(type, listener) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.#listeners.get(type)?.delete(listener);
  }

  setHidden(hidden) {
    this.hidden = hidden;
    for (const listener of this.#listeners.get("visibilitychange") ?? []) listener();
  }

  listenerCount(type) {
    return this.#listeners.get(type)?.size ?? 0;
  }
}

function fixture(hidden = false, send = undefined) {
  const document = new FakeDocument(hidden);
  const requests = [];
  let nextId = 1;
  const adapter = bindM5VisibilityAdapter({
    document,
    allocateRequestId: () => nextId++,
    transport: send ?? ((request) => { requests.push(request); }),
  });
  return { adapter, document, requests };
}

function visibility(id, hidden) {
  return {
    version: CADR_M5_PROTOCOL_VERSION,
    id,
    op: "scheduler-visibility",
    hidden,
  };
}

test("initial visible state is an explicit protocol-v3 delivery", async () => {
  const { adapter, document, requests } = fixture(false);
  assert.equal(adapter.initialHidden, false);
  assert.equal(document.listenerCount("visibilitychange"), 1);
  /* Binding synchronously spends the caller's first id and invokes transport:
   * a host cannot submit scheduler-start between binding and this delivery. */
  assert.deepEqual(requests, [visibility(1, false)]);
  await adapter.drain();
  assert.deepEqual(requests, [visibility(1, false)]);
});

test("initial hidden state is an explicit protocol-v3 delivery", async () => {
  const { adapter, requests } = fixture(true);
  assert.equal(adapter.initialHidden, true);
  await adapter.drain();
  assert.deepEqual(requests, [visibility(1, true)]);
});

test("visibility toggles preserve observed order and caller allocated ids", async () => {
  const { adapter, document, requests } = fixture(false);
  document.setHidden(true);
  document.setHidden(false);
  document.setHidden(true);
  await adapter.drain();
  assert.deepEqual(requests, [
    visibility(1, false), visibility(2, true), visibility(3, false), visibility(4, true),
  ]);
});

test("asynchronous transport cannot reorder initial delivery and toggles", async () => {
  const document = new FakeDocument(false);
  const sent = [];
  const gates = [];
  const sentWaiters = [];
  let nextId = 10;
  const waitForSent = (count) => sent.length >= count ? Promise.resolve() :
    new Promise((resolve) => sentWaiters.push([count, resolve]));
  const adapter = bindM5VisibilityAdapter({
    document,
    allocateRequestId: () => nextId++,
    transport: {
      send(request) {
        sent.push(request);
        while (sentWaiters.length !== 0 && sentWaiters[0][0] <= sent.length) {
          sentWaiters.shift()[1]();
        }
        return new Promise((resolve) => gates.push(resolve));
      },
    },
  });
  await waitForSent(1);
  document.setHidden(true);
  document.setHidden(false);
  assert.deepEqual(sent, [visibility(10, false)]);
  gates.shift()();
  await waitForSent(2);
  assert.deepEqual(sent, [visibility(10, false), visibility(11, true)]);
  gates.shift()();
  await waitForSent(3);
  assert.deepEqual(sent, [visibility(10, false), visibility(11, true), visibility(12, false)]);
  gates.shift()();
  await adapter.drain();
});

test("dispose removes the exact listener and prevents later deliveries", async () => {
  const { adapter, document, requests } = fixture(false);
  await adapter.drain();
  adapter.dispose();
  adapter.dispose();
  assert.equal(adapter.disposed, true);
  assert.equal(document.listenerCount("visibilitychange"), 0);
  document.setHidden(true);
  await adapter.drain();
  assert.deepEqual(requests, [visibility(1, false)]);
});

test("invalid host surfaces are rejected without consulting browser globals", () => {
  const allocateRequestId = () => 1;
  const transport = () => {};
  assert.throws(() => bindM5VisibilityAdapter({ allocateRequestId, transport }), /document must be an object/);
  assert.throws(() => bindM5VisibilityAdapter({
    document: { hidden: "no", addEventListener() {}, removeEventListener() {} },
    allocateRequestId, transport,
  }), /document\.hidden must be boolean/);
  assert.throws(() => bindM5VisibilityAdapter({
    document: { hidden: false, addEventListener() {} }, allocateRequestId, transport,
  }), /removeEventListener/);
  assert.throws(() => bindM5VisibilityAdapter({
    document: new FakeDocument(), transport,
  }), /allocateRequestId/);
  assert.throws(() => bindM5VisibilityAdapter({
    document: new FakeDocument(), allocateRequestId,
  }), /transport/);
});

test("allocator and transport failures are reported by drain and stop later ids", async () => {
  const document = new FakeDocument(false);
  const requests = [];
  let nextId = 1;
  const boom = new Error("transport failed");
  const adapter = bindM5VisibilityAdapter({
    document,
    allocateRequestId: () => nextId++,
    transport(request) {
      requests.push(request);
      throw boom;
    },
  });
  document.setHidden(true);
  await assert.rejects(adapter.drain(), boom);
  assert.strictEqual(adapter.failure, boom);
  assert.deepEqual(requests, [visibility(1, false)]);
  assert.equal(nextId, 2);
});

test("nonmonotonic caller ids fail before an invalid worker request is sent", async () => {
  const document = new FakeDocument(false);
  const requests = [];
  const ids = [7, 7];
  const adapter = bindM5VisibilityAdapter({
    document,
    allocateRequestId: () => ids.shift(),
    transport: (request) => { requests.push(request); },
  });
  document.setHidden(true);
  await assert.rejects(adapter.drain(), /invalid M5 visibility request id: 7/);
  assert.deepEqual(requests, [visibility(7, false)]);
});
