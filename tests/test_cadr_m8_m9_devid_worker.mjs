import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { encodeCdrInp1 } from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerUrl = pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js"));
async function modules(variant) {
  return Object.freeze({ ordinary: new WebAssembly.Module(await readFile(
    resolve(root, `cadr-web/build/cadr-web-m9-${variant}.wasm`),
  )), devid: new WebAssembly.Module(await readFile(
    resolve(root, `cadr-web/build/cadr-web-m9-devid-${variant}.wasm`),
  )) });
}

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
async function expectMalformed(module, policy, label) {
  const { worker, probe } = await newProbe();
  try {
    const reply = await probe.request({ version: 6, id: 1, op: "instantiate", module,
      ...(policy === undefined ? {} : { m6DiskEvidencePolicy: policy }) });
    assert.equal(reply.type, "cadr-error", label);
    assert.equal(reply.code, "malformed-message", label);
  } finally { await worker.terminate(); }
}

for (const variant of ["O0", "O2"]) {
  const { ordinary, devid } = await modules(variant);
  await expectMalformed(ordinary, true,
    `ordinary M9 ${variant} cannot opt into the M6 disk-evidence policy`);
  await expectMalformed(devid, undefined,
    `M9-DEVID ${variant} cannot omit the required disk-evidence policy`);
  await expectMalformed(devid, false,
    `M9-DEVID ${variant} cannot disable the required disk-evidence policy`);

  const { worker, probe } = await newProbe();
  try {
    let reply = await probe.request({ version: 6, id: 1, op: "instantiate", module: devid,
      m6DiskEvidencePolicy: true });
    assert.equal(reply.status, 0);
    reply = await probe.request({ version: 6, id: 2, op: "m6-disk-evidence-summary" });
    assert.equal(reply.status, 0);
    assert.equal(reply.wireSchema, "CDRM6E1");
    assert.equal(reply.policyId, "M6-PREFIX512-TAILSHA256-v1");
    const summary = new Uint8Array(reply.summary);
    assert.equal(summary.byteLength, 512);
    assert.equal(createHash("sha256").update(summary).digest("hex"),
      Buffer.from(reply.summaryDigest).toString("hex"));
    reply = await probe.request({ version: 6, id: 3, op: "input-state" });
    assert.equal(reply.status, 0);
    assert.equal(reply.wireSchema, "CDRIOB91");
    assert.equal(new Uint8Array(reply.observation).byteLength, 64);
    reply = await probe.request({ version: 6, id: 4, op: "snapshot-size" });
    assert.equal(reply.status, 9, "M9-DEVID snapshots remain unavailable through protocol v6");
    for (const [id, clockSlots] of [[5, 0], [6, 1048577]]) {
      reply = await probe.request({ version: 6, id, op: "run-until-event-m6", clockSlots });
      assert.equal(reply.status, 2, "fast READY4 runner enforces its fixed non-interruptible limit");
    }
  } finally { await worker.terminate(); }
}

/* The post-READY4 device crossing is a closed M9 wire protocol.  Its static
 * record form is asserted here beside the combined worker's CDRIOB91 result;
 * the synthetic READY4 stop/host/order execution is exercised by
 * test_cadr_m6_headless_boot.mjs through runSyntheticM6Ready4FastForTest. */
const record = encodeCdrInp1({ kind: 1, generation: 1n, ordinal: 1n, payload: 0x52 });
assert.equal(record.byteLength, 40);
assert.equal(new TextDecoder().decode(record.subarray(0, 7)), "CDRINP1");
assert.equal(new DataView(record.buffer).getUint16(10, true), 1);

console.log("cadr_m8_m9_devid_worker: ok");
