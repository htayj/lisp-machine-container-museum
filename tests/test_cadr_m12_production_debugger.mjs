import assert from "node:assert/strict";
import {
  CadrM12ProductionDebugger, CADR_M12_PRODUCTION_DEBUGGER_PROFILE,
  cadrM12ProductionDebuggerReceipt, validateCadrM12ProductionSnapshot,
} from "../cadr-web/browser/cadr-m12-production-debugger.mjs";
import { serializeCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

const debuggerProfile = Uint8Array.from(
  "8c0ef85505485aacfd bf42d4efef416e7a4c0964fbc59037d234b4e499b9f1a0".replaceAll(" ", "").match(/../g),
  value => Number.parseInt(value, 16));
function stop(reason = 1) { return serializeCdrDbgStop1({ reason,
  breakpointIndex: reason === 1 ? 0 : 0xffffffff, generation: 1n,
  boundaryOrdinal: 1n, clockSlot: 1n, microPcBefore: 0, rawLcBefore: 0,
  microPcAfter: 0, rawLcAfter: 0, faultAfter: 0, deviceRequestAfter: 0,
  inhibitedAfter: 0, runOrdinal: 1n, operationSlots: reason === 1 ? 1n : 1048576n,
  profileSha256: debuggerProfile }).buffer; }
const audio = { async joinTail() { return { joined: true }; },
  async pause() { return { status: 0, paused: true }; },
  async reducePause() { return { committed: true, state: "PAUSED" }; } };
const m10Authority = { async acquire() { return { binding: {}, async release() { return { released: true }; } }; },
  revoke() { return { revoked: true }; } };
const transaction = { async save() { return { status: 9, remainder: { lifecycle: "PAUSED" } }; },
  async next() { throw new Error("unreachable"); }, async dispose() { return { disposition: "ABSENT" }; },
  onInvalidating() { return () => {}; }, onDisposition() { return () => {}; } };

assert.equal(cadrM12ProductionDebuggerReceipt().profile, CADR_M12_PRODUCTION_DEBUGGER_PROFILE);
await assert.rejects(validateCadrM12ProductionSnapshot(new ArrayBuffer(384)), /snapshot envelope/,
  "the former zero-filled 384-byte pseudo-snapshot is rejected");
await assert.rejects(validateCadrM12ProductionSnapshot(new ArrayBuffer(18132273)), /bounded bytes/);
{
  const pseudo = new Uint8Array(384); const v = new DataView(pseudo.buffer);
  pseudo.set(new TextEncoder().encode("CDRM12S1")); v.setUint32(8, 2, true); v.setUint32(12, 48, true);
  v.setBigUint64(16, 384n, true); v.setBigUint64(24, 264n, true); v.setUint32(40, 72, true);
  await assert.rejects(validateCadrM12ProductionSnapshot(pseudo, "ab".repeat(32)),
    /section closure/, "zero audio/config and an arbitrary expected digest are rejected");
}

{
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async () => ({ status: 0 }), openSnapshotTransaction: () => transaction, audio, m10Authority });
  await assert.rejects(coordinator.prepareReview(), /STOP_BOUND/,
    "PAUSED with no direct stop cannot reach review");
  assert.equal(coordinator.state, "PAUSED");
}
{
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async () => ({ status: 20, terminal: false, result: { stop: stop(1) } }),
    openSnapshotTransaction: () => transaction, audio, m10Authority });
  await assert.rejects(coordinator.request("debug-macro-step"), /mismatch/);
  assert.equal(coordinator.state, "FAILED", "a malformed lower stop fail-closes without STOP_BOUND");
}

/* The save response may be lost only after the worker has allocated its
 * private snapshot.  P2 receives the terminal disposition before it is
 * permitted to release the opaque M10 pin; the test records that ordering at
 * the coordinator boundary rather than inferring it from a successful final
 * state. */
{
  const events = [];
  let invalidating = null, disposition = null;
  const terminalTransaction = {
    async save() {
      events.push("worker-save-issued");
      await invalidating({ reason: "private-debugger-save-ambiguous" });
      events.push("worker-disposition:WORKER_TERMINATED");
      await disposition({ reason: "private-debugger-save-ambiguous",
        disposition: "WORKER_TERMINATED" });
      throw new Error("synthetic dropped save response after worker allocation");
    },
    async next() { throw new Error("unreachable after terminal save"); },
    async dispose() { throw new Error("worker disposition callback owns this cleanup"); },
    onInvalidating(observer) { invalidating = observer; return () => { invalidating = null; }; },
    onDisposition(observer) { disposition = observer; return () => { disposition = null; }; },
  };
  const terminalAuthority = {
    async acquire() {
      events.push("m10-acquire");
      return { binding: {}, async release() { events.push("m10-release"); return { released: true }; } };
    },
    revoke() { return { revoked: true }; },
  };
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async op => op === "debug-micro-step" ?
      { status: 19, terminal: false, result: { stop: stop(1) } } :
      { type: "cadr-response", version: 8, sessionId: "a".repeat(64), id: 1,
        op: "machine-pause", status: 0, ok: true, terminal: false, lifecycle: "PAUSED" },
    openSnapshotTransaction: () => terminalTransaction,
    audio: { async joinTail() { return { joined: true }; },
      async pause() { return { status: 0, paused: true }; },
      async reducePause() { return { committed: true, state: "PAUSED" }; } },
    m10Authority: terminalAuthority });
  assert.equal((await coordinator.request("debug-micro-step")).status, 19);
  await assert.rejects(coordinator.prepareReview(), /synthetic dropped save response/);
  assert.deepEqual(events, ["m10-acquire", "worker-save-issued",
    "worker-disposition:WORKER_TERMINATED", "m10-release"],
  "M10 release starts only after the known terminal worker disposition");
  assert.equal(coordinator.state, "FAILED");
}

/* UNKNOWN is not permission to unpin.  Only a later disposition callback for
 * the same captured transaction may monotonically prove owner termination and
 * replace the memoized rejection. */
{
  let invalidating = null, disposition = null, releases = 0;
  const unknownTransaction = {
    async save() {
      await invalidating({ reason: "lost-save" });
      await assert.rejects(disposition({ reason: "lost-save", disposition: "UNKNOWN" }),
        /snapshot disposal is unknown/);
      throw new Error("lost save");
    },
    async next() { throw new Error("unreachable"); },
    async dispose() { return { disposition: "UNKNOWN" }; },
    onInvalidating(observer) { invalidating = observer; return () => {}; },
    onDisposition(observer) { disposition = observer; return () => {}; },
  };
  const authority = { async acquire() { return { binding: {}, async release() {
    releases += 1; return { released: true };
  } }; }, revoke() { return { revoked: true }; } };
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async op => op === "debug-micro-step" ?
      ({ status: 19, terminal: false, result: { stop: stop(1) } }) :
      ({ type: "cadr-response", version: 8, sessionId: "a".repeat(64), id: 1,
        op: "machine-pause", status: 0, ok: true, terminal: false, lifecycle: "PAUSED" }),
    openSnapshotTransaction: () => unknownTransaction, audio, m10Authority: authority });
  await coordinator.request("debug-micro-step");
  await assert.rejects(coordinator.prepareReview(), /lost save/);
  assert.equal(coordinator.state, "RELEASE_REQUIRED"); assert.equal(releases, 0);
  await disposition({ reason: "exact-owner-terminated", disposition: "WORKER_TERMINATED" });
  assert.equal(releases, 1); assert.equal(coordinator.state, "FAILED");
  await disposition({ reason: "replayed", disposition: "WORKER_TERMINATED" });
  assert.equal(releases, 1, "replayed terminal disposition cannot unpin twice");
}

/* A known disposition whose first durable unpin response is lost must need
 * exactly one explicit retry, independent of how many cleanup calls were
 * already admitted before the failure epoch. */
{
  let disposition = null, releases = 0, disposals = 0;
  const releasedTransaction = {
    async save() { throw new Error("synthetic save rejection"); },
    async next() { throw new Error("unreachable"); },
    async dispose(reason) { disposals += 1;
      await disposition({ reason, disposition: "RELEASED" });
      return { disposition: "RELEASED" }; },
    onInvalidating() { return () => {}; },
    onDisposition(observer) { disposition = observer; return () => {}; },
  };
  const authority = { async acquire() { return { binding: {}, async release() {
    releases += 1;
    if (releases === 1) throw new Error("synthetic committed unpin response loss");
    return { released: true };
  } }; }, revoke() { return { revoked: true }; } };
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async op => op === "debug-micro-step" ?
      ({ status: 19, terminal: false, result: { stop: stop(1) } }) :
      ({ type: "cadr-response", version: 8, sessionId: "a".repeat(64), id: 1,
        op: "machine-pause", status: 0, ok: true, terminal: false, lifecycle: "PAUSED" }),
    openSnapshotTransaction: () => releasedTransaction, audio, m10Authority: authority });
  await coordinator.request("debug-micro-step");
  await assert.rejects(coordinator.prepareReview(), /synthetic save rejection/);
  assert.equal(coordinator.state, "RELEASE_REQUIRED");
  assert.equal(releases, 1); assert.equal(disposals, 1);
  assert.equal(await coordinator.discardReview(), "STOP_BOUND");
  assert.equal(releases, 2); assert.equal(disposals, 1,
    "one explicit retry repeats only the idempotent unpin");
}

{
  let disposition = null, releases = 0, releaseEntered, releaseContinue;
  const entered = new Promise(resolve => { releaseEntered = resolve; });
  const held = new Promise(resolve => { releaseContinue = resolve; });
  const heldTransaction = {
    async save() { throw new Error("held cleanup seed"); }, async next() { throw new Error("unreachable"); },
    async dispose(reason) { await disposition({ reason, disposition: "RELEASED" }); },
    onInvalidating() { return () => {}; }, onDisposition(observer) { disposition = observer; return () => {}; },
  };
  const heldAuthority = { async acquire() { return { binding: {}, async release() {
    releases += 1;
    if (releases === 1) { releaseEntered(); await held; throw new Error("held unpin response loss"); }
    return { released: true };
  } }; }, revoke() { return { revoked: true }; } };
  const coordinator = new CadrM12ProductionDebugger({ receipt: cadrM12ProductionDebuggerReceipt(),
    request: async op => op === "debug-micro-step" ?
      ({ status: 19, terminal: false, result: { stop: stop(1) } }) :
      ({ type: "cadr-response", version: 8, sessionId: "a".repeat(64), id: 1,
        op: "machine-pause", status: 0, ok: true, terminal: false, lifecycle: "PAUSED" }),
    openSnapshotTransaction: () => heldTransaction, audio, m10Authority: heldAuthority });
  await coordinator.request("debug-micro-step");
  const preparing = coordinator.prepareReview();
  await entered;
  const preadmitted = coordinator.invalidate("queued-before-release-failure");
  releaseContinue();
  await assert.rejects(preparing, /held cleanup seed/);
  await assert.rejects(preadmitted, /held unpin response loss/);
  assert.equal(releases, 1, "a pre-admitted cleanup cannot silently retry a later failure");
  assert.equal(await coordinator.discardReview(), "FAILED");
  assert.equal(releases, 2, "the first post-failure admission performs the one retry");
}

console.log("cadr m12 production debugger tests passed");
