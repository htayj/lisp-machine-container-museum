import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = await WebAssembly.compile(await readFile(
  resolve(root, "cadr-web/build/cadr-web-m13-audio-O0.wasm")));
const worker = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
const messages = []; const waiters = [];
worker.on("message", value => { const waiter = waiters.shift(); if (waiter) waiter(value); else messages.push(value); });
const next = () => messages.length ? Promise.resolve(messages.shift()) : new Promise((resolveNext, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out waiting for M13 audio worker")), 10000);
  waiters.push(value => { clearTimeout(timer); resolveNext(value); });
});
const request = async value => { worker.postMessage(value); return next(); };
try {
  let reply = await request({ version: 8, id: 1, op: "instantiate", module,
    sessionId: "13".repeat(32) });
  assert.equal(reply.status, 0); assert.equal(reply.version, 8);
  reply = await request({ version: 8, id: 2, op: "m13-audio-open" });
  assert.equal(reply.status, 0); assert.deepEqual(reply.audio, { state: "READY", generation: 1n,
    consumerEpoch: 2n, queuePackets: 0, queuedFrames: 0 });
  assert.equal(messages.length, 0, "empty actual core emits no fabricated PCM event");
  reply = await request({ version: 8, id: 3, op: "m13-audio-pause", consumerEpoch: 2n });
  assert.equal(reply.status, 0); assert.equal(reply.audio.state, "PAUSED");
  reply = await request({ version: 8, id: 4, op: "m13-audio-resume" });
  assert.equal(reply.status, 0); assert.equal(reply.audio.consumerEpoch, 3n,
    "real worker calls the actual core-issued epoch export on resume");
} finally { await worker.terminate(); }
console.log("cadr M13 real worker/ABI1.11 audio source ownership test passed");
