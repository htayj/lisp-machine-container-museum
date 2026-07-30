import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const M7_WASM = resolve(ROOT, "cadr-web/build/cadr-web-m7-O0.wasm");
const M9_WASM = resolve(ROOT, `cadr-web/build/cadr-web-m9-${process.env.CADR_M9_WASM_VARIANT ?? "O0"}.wasm`);

const workerSource = await readFile(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"), "utf8");
const deliverAt = workerSource.indexOf("consumeM9InputEntries(entries);");
assert.ok(deliverAt >= 0 && workerSource.lastIndexOf(
  "commitCadrM8M9SharedDeactivation", workerSource.length) > deliverAt,
  "shared M8 clear must remain after successful worker/core delivery");

class Probe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", message => {
      const next = this.waiters.shift();
      if (next === undefined) this.messages.push(message); else next(message);
    });
  }

  send(value) { this.worker.postMessage(value); }

  next() {
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error("timed out waiting for M8/M9 worker response")), 10000);
      this.waiters.push(message => { clearTimeout(timer); resolveNext(message); });
    });
  }

  async request(value) { this.send(value); return this.next(); }
}

const m7Module = await WebAssembly.compile(await readFile(M7_WASM));
const m9Module = await WebAssembly.compile(await readFile(M9_WASM));

{
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    assert.equal((await probe.request({ version: 5, id: 1, op: "instantiate", module: m7Module })).status, 0);
    const rejected = await probe.request({ version: 5, id: 2, op: "keyboard-state" });
    assert.equal(rejected.status, 2, "v5 cannot acquire v6 host input state");
  } finally {
    await worker.terminate();
  }
}

{
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    let reply = await probe.request({ version: 6, id: 1, op: "instantiate", module: m9Module });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version: 6, id: 2, op: "input-state" });
    assert.equal(reply.status, 0);
    assert.equal(new TextDecoder().decode(new Uint8Array(reply.observation).subarray(0, 8)), "CDRIOB91");
    reply = await probe.request({ version: 6, id: 3, op: "snapshot-size" });
    assert.equal(reply.status, 9, "M9 input state has no snapshot ABI");
    reply = await probe.request({ version: 6, id: 4, op: "keyboard-down", code: "KeyQ", repeat: false });
    assert.equal(reply.status, 9, "v6 must not retain a merely host-visible key before core delivery");
    assert.equal(reply.reason, "core-not-running");
    reply = await probe.request({ version: 6, id: 5, op: "keyboard-state" });
    assert.deepEqual(reply.result.heldCodes, []);
    reply = await probe.request({ version: 6, id: 6, op: "pointer-motion", x: 1, y: 2,
      tick: 0n, generation: 0, cause: "physical" });
    assert.equal(reply.status, 9);
    reply = await probe.request({ version: 6, id: 7, op: "pointer-state" });
    assert.equal(reply.result.queue.length, 0);

    reply = await probe.request({ version: 6, id: 8, op: "scheduler-events", events: [{ kind: 3 }] });
    assert.equal(reply.status, 2);
    assert.equal(reply.reason, "v6-keyboard-is-host-only");
    reply = await probe.request({ version: 6, id: 9, op: "scheduler-events", events: [{ kind: 4 }] });
    assert.equal(reply.status, 2);
    assert.equal(reply.reason, "v6-input-is-host-only");
  } finally {
    await worker.terminate();
  }
}

console.log("cadr M8/M9 worker integration tests passed");
