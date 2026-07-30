import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { parseCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const WASM = resolve(ROOT, "cadr-web/build/cadr-web-m12-O0.wasm");

class Probe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter === undefined) this.messages.push(message); else waiter(message);
    });
  }
  request(value) { this.worker.postMessage(value); return this.next(); }
  next() {
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error("timed out waiting for M12 worker")), 10000);
      this.waiters.push(message => { clearTimeout(timer); resolveNext(message); });
    });
  }
}

const module = await WebAssembly.compile(await readFile(WASM));

/* The selected progress operation is an M12/v7-only extension.  It is not a
 * backdoor into the v4--v6 scheduler trees, even though this composed module
 * exports the lower profile facilities needed to instantiate those profiles. */
for (const version of [4, 5, 6]) {
  const olderWorker = new Worker(WORKER, { type: "module" });
  const olderProbe = new Probe(olderWorker);
  try {
    let reply = await olderProbe.request({ version, id: 1, op: "instantiate", module });
    assert.equal(reply.status, 0, `v${version} selected module instantiates for rejection test`);
    reply = await olderProbe.request({ version, id: 2, op: "scheduler-run-v7-slice", clockSlots: 1 });
    assert.equal(reply.status, 2, `v${version} cannot acquire the v7 scheduler slice`);
  } finally {
    await olderWorker.terminate();
  }
}

const worker = new Worker(WORKER, { type: "module" });
const probe = new Probe(worker);
try {
  let reply = await probe.request({ version: 7, id: 1, op: "instantiate", module });
  assert.equal(reply.status, 0); assert.equal(reply.lifecycle, "NEW");

  /* v7 composes the existing CDRINP1 branch.  The cold core refuses delivery
     before either browser controller mutates; that rejection is distinct from
     a v6-only operation rejection. */
  reply = await probe.request({ version: 7, id: 2, op: "input-state" });
  assert.equal(reply.status, 0);
  assert.equal(new TextDecoder().decode(new Uint8Array(reply.observation).subarray(0, 8)), "CDRIOB91");
  reply = await probe.request({ version: 7, id: 3, op: "keyboard-down", code: "KeyQ", repeat: false });
  assert.equal(reply.status, 9); assert.equal(reply.reason, "core-not-running");
  reply = await probe.request({ version: 7, id: 4, op: "keyboard-state" });
  assert.deepEqual(reply.result.heldCodes, []);
  reply = await probe.request({ version: 7, id: 5, op: "snapshot-size" });
  assert.equal(reply.status, 9, "composed CDRINP1 remains outside generic snapshot ABI");

  reply = await probe.request({ version: 7, id: 6, op: "audio-state" });
  assert.equal(reply.status, 0); assert.equal(reply.state.packetCount, 0);
  reply = await probe.request({ version: 7, id: 7, op: "audio-snapshot-size" });
  assert.equal(reply.status, 0); assert.equal(reply.byteCount, 188n);
  reply = await probe.request({ version: 7, id: 8, op: "audio-snapshot-save" });
  assert.equal(reply.status, 0); assert.equal(new Uint8Array(reply.snapshot).byteLength, 188);
  reply = await probe.request({ version: 7, id: 9, op: "audio-snapshot-restore",
    snapshot: reply.snapshot });
  assert.equal(reply.status, 0);

  reply = await probe.request({ version: 7, id: 10, op: "debug-breakpoint-set", slot: 3,
    breakpoint: { kind: 1, value: 0n } });
  assert.equal(reply.status, 0); assert.equal(reply.result.slot, 3);
  reply = await probe.request({ version: 7, id: 11, op: "debug-config-snapshot-save" });
  assert.equal(reply.status, 0);
  assert.equal(new Uint8Array(reply.result.snapshot).byteLength, 1088);
  const configSnapshot = reply.result.snapshot;
  reply = await probe.request({ version: 7, id: 12, op: "debug-breakpoint-clear", slot: 3 });
  assert.equal(reply.status, 0);
  reply = await probe.request({ version: 7, id: 13, op: "debug-config-snapshot-restore",
    snapshot: configSnapshot });
  assert.equal(reply.status, 0);

  reply = await probe.request({ version: 7, id: 14, op: "debug-micro-step" });
  assert.equal(reply.status, 19); assert.equal(reply.terminal, true);
  const stopped = parseCdrDbgStop1(reply.result.stop);
  assert.equal(stopped.breakpointIndex, 3);
  assert.equal(stopped.microPcBefore, 0);

  reply = await probe.request({ version: 7, id: 15, op: "debug-stop-record" });
  assert.equal(reply.status, 0);
  assert.equal(parseCdrDbgStop1(reply.result.stop).breakpointIndex, 3);

  reply = await probe.request({ version: 7, id: 16, op: "debug-resume-one-boundary" });
  assert.equal(reply.status, 0); assert.equal(reply.result.suppressionArmed, true);
  reply = await probe.request({ version: 7, id: 17, op: "debug-micro-step" });
  assert.equal(reply.status, 9, "cold core reports not-ready without partial debugger state");
  reply = await probe.request({ version: 7, id: 18, op: "debug-trace-filter", filter: {
    flags: 0, microPc: 0, firstClockSlot: 0n, lastClockSlot: 0xffffffffffffffffn,
  } });
  assert.equal(reply.status, 0);
  reply = await probe.request({ version: 7, id: 19, op: "debug-macro-step" });
  assert.equal(reply.status, 2, "the macro oracle rejects non-QMLP/DMLP start PCs");
  reply = await probe.request({ version: 7, id: 20, op: "debug-inspect-read", arrayKind: 1, index: 0 });
  assert.equal(reply.status, 0);
  assert.deepEqual(reply.result, { generation: 1n, arrayKind: 1, index: 0, value: 0 });

  /* `scheduler-run` retains its M5-family control-yield semantics.  The new
   * v7 operation is a separate exact-field, 4,096-outer-slot contract: these
   * malformed values reject before lifecycle admission, while the maximum
   * shaped request reaches the normal RUNNING/visibility fence. */
  for (const [id, fields] of [
    [21, {}],
    [22, { clockSlots: 1, unexpected: true }],
    [23, { clockSlots: 0 }],
    [24, { clockSlots: 4097 }],
  ]) {
    reply = await probe.request({ version: 7, id, op: "scheduler-run-v7-slice", ...fields });
    assert.equal(reply.status, 2, "v7 slice rejects malformed fields or an over-cap budget");
  }
  reply = await probe.request({ version: 7, id: 25, op: "scheduler-run-v7-slice", clockSlots: 4096 });
  assert.equal(reply.status, 9, "well-formed v7 slice reaches the normal lifecycle fence");
} finally {
  await worker.terminate();
}

console.log("cadr M12 worker integration tests passed");
