import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = new WebAssembly.Module(await readFile(
  resolve(root, "cadr-web/build/cadr-web-m6-devid-O0.wasm"),
));
const workerUrl = pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js"));

class Probe {
  constructor(worker) {
    this.worker = worker; this.messages = []; this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter === undefined) this.messages.push(message); else waiter(message);
    });
  }
  request(message) {
    this.worker.postMessage(message);
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise(resolveNext => this.waiters.push(resolveNext));
  }
}

async function newProbe() {
  const worker = new Worker(workerUrl, { type: "module" });
  return { worker, probe: new Probe(worker) };
}

{
  const { worker, probe } = await newProbe();
  try {
    let reply = await probe.request({ version: 4, id: 1, op: "instantiate", module,
      m6DiskEvidencePolicy: true });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version: 4, id: 2, op: "machine-info" });
    assert.equal(reply.status, 0);
    assert.equal(new DataView(reply.info).getUint32(4, true), 0,
      "the frozen machine-info artifact mask remains unchanged before ingress");
    reply = await probe.request({ version: 4, id: 3, op: "m6-disk-evidence-summary" });
    assert.equal(reply.status, 0);
    assert.equal(reply.wireSchema, "CDRM6E1");
    assert.equal(reply.policyId, "M6-PREFIX512-TAILSHA256-v1");
    const summary = new Uint8Array(reply.summary);
    assert.equal(summary.byteLength, 512);
    assert.equal(new TextDecoder().decode(summary.subarray(0, 7)), "CDRM6E1");
    assert.equal(new DataView(summary.buffer).getUint32(16, true), 1);
    const expectedDigest = createHash("sha256").update(summary).digest();
    assert.deepEqual(Buffer.from(reply.summaryDigest), expectedDigest);
    reply = await probe.request({ version: 4, id: 4, op: "snapshot-size" });
    assert.equal(reply.status, 9, "M6-DEVID1 never publishes a snapshot");
    reply = await probe.request({ version: 4, id: 5, op: "run-until-event-m6",
      clockSlots: 0 });
    assert.equal(reply.status, 2, "the fast runner rejects a zero slot request");
    reply = await probe.request({ version: 4, id: 6, op: "run-until-event-m6",
      clockSlots: 1048577 });
    assert.equal(reply.status, 2, "the fast runner rejects an over-cap request");
  } finally {
    await worker.terminate();
  }
}

{
  const { worker, probe } = await newProbe();
  try {
    const reply = await probe.request({ version: 4, id: 1, op: "instantiate", module });
    assert.equal(reply.type, "cadr-error");
    assert.equal(reply.code, "malformed-message",
      "a M6-DEVID module cannot masquerade as the ordinary M6 profile");
  } finally {
    await worker.terminate();
  }
}

{
  const { worker, probe } = await newProbe();
  try {
    const reply = await probe.request({ version: 5, id: 1, op: "instantiate", module,
      m6DiskEvidencePolicy: true });
    assert.equal(reply.type, "cadr-error");
    assert.equal(reply.code, "malformed-message");
  } finally {
    await worker.terminate();
  }
}

console.log("cadr_m6_disk_evidence_worker: ok");
