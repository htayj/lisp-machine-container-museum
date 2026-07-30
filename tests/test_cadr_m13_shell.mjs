import assert from "node:assert/strict";

import {
  CADR_M13_MAX_METADATA_BYTES,
  CADR_M13_PROFILE,
  CADR_M13_PROTOCOL_VERSION,
  CADR_M13_STATUS,
  CadrM13Shell,
  CadrM13StorageBoundary,
  canonicalizeCadrM13Request,
  encodeCadrM13Meta1,
  validateCadrM13PostCloneRequest,
} from "../cadr-web/browser/cadr-m13-shell.mjs";

const session = "12".repeat(32);
assert.equal(CADR_M13_PROFILE, "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2");
const request = (id, op, fields = {}) => ({
  type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION, sessionId: session, id, op, ...fields,
});

class FakeWorker {
  #listeners = new Map();
  requests = [];
  addEventListener(type, listener) {
    const values = this.#listeners.get(type) ?? []; values.push(listener); this.#listeners.set(type, values);
  }
  removeEventListener(type, listener) {
    this.#listeners.set(type, (this.#listeners.get(type) ?? []).filter(value => value !== listener));
  }
  postMessage(value) {
    this.requests.push(value);
    queueMicrotask(() => this.emit("message", { data: {
      type: "cadr-response", version: 7, id: value.id, op: value.op, status: 0, ok: true, lifecycle: "PAUSED",
    } }));
  }
  emit(type, event) { for (const listener of this.#listeners.get(type) ?? []) listener(event); }
  terminate() { this.terminated = true; }
}

const shell = new CadrM13Shell({ worker: new FakeWorker(), sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
assert.equal(shell.sessionId, session);

/* The getter must be rejected without running.  This is source-side evidence;
 * structured clone cannot preserve the original getter for worker inspection. */
let getterCalled = false;
const accessor = request(1, "keyboard-state");
Object.defineProperty(accessor, "unexpected", { enumerable: true, get() { getterCalled = true; return 1; } });
let reply = await shell.submit(accessor);
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);
assert.equal(getterCalled, false);

/* A syntactically admitted M8 unknown key remains an M8 semantic request. */
reply = await shell.submit(request(2, "keyboard-down", { code: "x".repeat(64), repeat: false }));
assert.equal(reply.status, 0);
assert.equal(shell.ledger.pending, 0);
reply = await shell.submit(request(3, "keyboard-down", { code: "x".repeat(65) }));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);

/* The outer record accepted post-clone is closed independently of source
 * accessor/prototype history. */
const canonical = await canonicalizeCadrM13Request(request(4, "keyboard-up", { code: "KeyQ" }), { sessionId: session });
assert.equal(Object.getPrototypeOf(canonical.request), null);
assert.equal(validateCadrM13PostCloneRequest(canonical.request), true);
assert.equal(validateCadrM13PostCloneRequest({ ...canonical.request, extra: 1 }), false);
assert.equal(validateCadrM13PostCloneRequest(Object.create(canonical.request)), false);

const withSymbol = request(4, "keyboard-state");
withSymbol[Symbol("not-wire")] = 1;
reply = await shell.submit(withSymbol);
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);

/* M13META1 counts canonical bytes, rather than using JSON or engine object
 * size.  The test exercises the independent encoding path and its hard cap. */
const metadata = await encodeCadrM13Meta1(canonical.request);
assert.equal(new TextDecoder().decode(metadata.subarray(0, 8)), "M13META1");
assert.ok(metadata.byteLength < CADR_M13_MAX_METADATA_BYTES);

/* A duplicate id is a correlated, terminal protocol failure, not an accidental
 * replay of a previously accepted keyboard edge. */
reply = await shell.submit(request(4, "keyboard-state"));
assert.equal(reply.status, CADR_M13_STATUS.PROTOCOL_VIOLATION);
assert.equal(reply.terminal, true);

/* Storage calls are a closed named-method surface.  No user-controlled key or
 * pathname reaches it, and the worker was never handed the storage object. */
const storageCalls = [];
const boundary = new CadrM13StorageBoundary({
  async readBaseRange(value) { storageCalls.push(value); return Object.freeze({ bytes: new ArrayBuffer(1024) }); },
});
const storageShell = new CadrM13Shell({ worker: new FakeWorker(), storage: boundary,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await storageShell.submit(request(1, "base-range-read", { importId: 1, firstBlock: 0, blockCount: 1 }));
assert.equal(reply.status, 0); assert.equal(storageCalls.length, 1);
assert.deepEqual(Object.keys(storageCalls[0]).sort(), ["blockCount", "firstBlock", "id", "importId", "op", "sessionId", "type", "version"]);
reply = await storageShell.submit(request(2, "base-range-read", { importId: 1, firstBlock: 0, blockCount: 1, key: "outside-m10" }));
assert.equal(reply.status, CADR_M13_STATUS.INVALID_REQUEST);
assert.equal(storageCalls.length, 1);

/* The final uint32 ID has one ordinary response and then closes the session;
 * it has no synthetic exhaustion response. */
const finalWorker = new FakeWorker();
const finalShell = new CadrM13Shell({ worker: finalWorker, initialId: 0xffffffff,
  sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await finalShell.submit(request(0xffffffff, "keyboard-state"));
assert.equal(reply.status, 0); assert.equal(reply.terminal, true); assert.equal(finalWorker.terminated, true);
await assert.rejects(() => finalShell.submit(request(1, "keyboard-state")), /terminal/);

/* The M12-only lower status 21 has no v8 mapping and is therefore a terminal
 * protocol violation, rather than an accidental new public status code. */
class Status21Worker extends FakeWorker {
  postMessage(value) { this.requests.push(value); queueMicrotask(() => this.emit("message", { data: {
    type: "cadr-response", version: 7, id: value.id, op: value.op, status: 21, ok: false,
  } })); }
}
const status21Shell = new CadrM13Shell({ worker: new Status21Worker(), sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x12) });
reply = await status21Shell.submit(request(1, "keyboard-state"));
assert.equal(reply.status, CADR_M13_STATUS.PROTOCOL_VIOLATION); assert.equal(reply.terminal, true);

console.log("cadr M13 shell admission and isolation tests passed");
