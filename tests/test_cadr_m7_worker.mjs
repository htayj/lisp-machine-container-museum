import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import {
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_WIDTH,
  CadrMonochromeFramebuffer,
  parseCdrDisp1,
} from "../cadr-web/wasm/cadr-display-renderer.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_VARIANT = process.env.CADR_M7_WASM_VARIANT ?? "O0";
assert.ok(["O0", "O2"].includes(WASM_VARIANT), "M7 Wasm test variant");
const WASM = resolve(ROOT, `cadr-web/build/cadr-web-m7-${WASM_VARIANT}.wasm`);
const WORKER = pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js"));
const FIXTURE = resolve(ROOT, "cadr-web/build/cadr-m7-frame-fixture");
const NATIVE_TV = resolve(ROOT, "cadr-web/build/test_cadr_m7_native_tv");
const WORKER_RESPONSE_TIMEOUT_MS = 30000;

class Probe {
  constructor(worker) {
    this.worker = worker;
    this.messages = [];
    this.waiters = [];
    this.lastRequest = null;
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter) waiter(message); else this.messages.push(message);
    });
  }
  send(message) { this.lastRequest = `${message.op}#${message.id}`; this.worker.postMessage(message); }
  next() {
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => rejectNext(new Error(
        `timeout waiting for M7 worker after ${this.lastRequest ?? "request"}`)),
      WORKER_RESPONSE_TIMEOUT_MS);
      this.waiters.push(message => { clearTimeout(timer); resolveNext(message); });
    });
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function nativePbmPixels(bytes) {
  const text = new TextDecoder().decode(bytes);
  const lines = text.split("\n");
  assert.equal(lines[0], "P1");
  assert.equal(lines[1], `${CADR_DISPLAY_WIDTH} ${CADR_DISPLAY_HEIGHT}`);
  const digits = lines.slice(2).join("").replaceAll(/\s/g, "");
  assert.equal(digits.length, CADR_DISPLAY_WIDTH * CADR_DISPLAY_HEIGHT);
  return Uint8Array.from(digits, digit => {
    assert.ok(digit === "0" || digit === "1");
    return digit === "1" ? 1 : 0;
  });
}

function rendererRawPixels(framebuffer) {
  const pixels = new Uint8Array(CADR_DISPLAY_WIDTH * CADR_DISPLAY_HEIGHT);
  let offset = 0;
  for (let y = 0; y < CADR_DISPLAY_HEIGHT; y += 1) {
    for (let x = 0; x < CADR_DISPLAY_WIDTH; x += 1) {
      pixels[offset++] = framebuffer.rawBit(x, y) ? 1 : 0;
    }
  }
  return pixels;
}

async function rejectedByOlderProtocol(module) {
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    probe.send({ version: 4, id: 1, op: "instantiate", module });
    let reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version: 4, id: 2, op: "display-update" });
    reply = await probe.next();
    assert.equal(reply.status, 2, "M6 protocol cannot acquire M7 display records");
  } finally {
    await worker.terminate();
  }
}

const temporary = await mkdtemp(resolve(tmpdir(), "cadr-m7-worker-"));
const snapshotPath = resolve(temporary, "frame.cdrsnap1");
const nativePbmPath = resolve(temporary, "native.pbm");
const module = await WebAssembly.compile(await readFile(WASM));

try {
  await rejectedByOlderProtocol(module);
  execFileSync(FIXTURE, [snapshotPath]);
  execFileSync(NATIVE_TV, [nativePbmPath]);
  const nativePixels = nativePbmPixels(await readFile(nativePbmPath));
  const snapshotBytes = await readFile(snapshotPath);
  const snapshot = snapshotBytes.buffer.slice(
    snapshotBytes.byteOffset, snapshotBytes.byteOffset + snapshotBytes.byteLength);
  const worker = new Worker(WORKER, { type: "module" });
  const probe = new Probe(worker);
  try {
    probe.send({ version: 5, id: 1, op: "instantiate", module });
    let reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version: 5, id: 2, op: "display-update" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(reply.updated, true);
    assert.equal(reply.full, true);
    assert.equal(reply.wireSchema, "CDRDISP1");
    assert.equal(reply.width, CADR_DISPLAY_WIDTH);
    assert.equal(reply.height, CADR_DISPLAY_HEIGHT);
    assert.equal(parseCdrDisp1(reply.frame).full, true);
    const framebuffer = new CadrMonochromeFramebuffer();
    framebuffer.apply(reply.frame);
    const initialFramebufferGeneration = framebuffer.framebufferGeneration;
    probe.send({ version: 5, id: 3, op: "display-update" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(reply.updated, false);
    assert.equal("frame" in reply, false);
    probe.send({ version: 5, id: 4, op: "snapshot-restore-import",
      snapshot, allowLegacyNativeImport: true });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    probe.send({ version: 5, id: 5, op: "display-update" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(reply.updated, true);
    assert.equal(reply.full, true, "snapshot restore invalidates derived dirty history");
    /* The same renderer instance accepts the mandatory full replacement only
     * because restore advances the non-snapshotted host-instance generation. */
    framebuffer.apply(reply.frame);
    assert.equal(framebuffer.framebufferGeneration, initialFramebufferGeneration + 1n);
    const wasmPixels = rendererRawPixels(framebuffer);
    assert.equal(sha256(wasmPixels), sha256(nativePixels),
      "pinned native TV and Wasm/browser raw logical pixels are identical");
    assert.deepEqual(wasmPixels, nativePixels);
    assert.equal(framebuffer.rawBit(0, 0), true);
    assert.equal(framebuffer.rawBit(31, 0), true);
    assert.equal(framebuffer.rawBit(33, 1), true);
    probe.send({ version: 5, id: 6, op: "display-full" });
    reply = await probe.next();
    assert.equal(reply.status, 0);
    assert.equal(reply.updated, true);
    assert.equal(reply.full, true);
    assert.equal(parseCdrDisp1(reply.frame).wordCount, 23112);
    const beforeRecovery = framebuffer.framebufferGeneration;
    framebuffer.apply(reply.frame);
    assert.equal(framebuffer.framebufferGeneration, beforeRecovery + 1n);
    console.log(`cadr M7 ${WASM_VARIANT} worker tests passed`);
  } finally {
    await worker.terminate();
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
