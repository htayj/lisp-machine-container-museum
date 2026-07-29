#!/usr/bin/env node
/* Run a selected CADR-WEB input set in the M3 worker and emit CDRM3TR1. */
import { createReadStream, createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CHUNK = 1048576;
const HEADER = 32;
const FOOTER = 32;
const BATCH = 4096;

function usage() {
  throw new Error("usage: cadr-m3-wasm-runner.mjs WASM CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK SLOTS OUTPUT");
}

function u64le(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

export function cadrM3TranscriptHeader(slots) {
  const out = Buffer.alloc(HEADER);
  out.write("CDRM3TR1", 0, "ascii");
  out.writeUInt32LE(96, 8);
  u64le(slots + 1).copy(out, 12);
  u64le(slots).copy(out, 20);
  return out;
}

function footer(count, status) {
  const out = Buffer.alloc(FOOTER);
  out.write("CDRM3END", 0, "ascii");
  u64le(count).copy(out, 8);
  out.writeUInt32LE(status >>> 0, 16);
  return out;
}

function waitForWrite(stream, bytes) {
  return new Promise((resolveWrite, reject) => {
    const onError = (error) => {
      stream.off("drain", onDrain);
      reject(error);
    };
    const onDrain = () => {
      stream.off("error", onError);
      resolveWrite();
    };
    stream.once("error", onError);
    if (stream.write(bytes)) {
      stream.off("error", onError);
      resolveWrite();
    } else {
      stream.once("drain", onDrain);
    }
  });
}

class Client {
  constructor(worker) {
    this.worker = worker;
    this.id = 1;
    this.waiters = new Map();
    worker.on("message", (message) => {
      const waiter = this.waiters.get(message?.id);
      if (waiter !== undefined) {
        this.waiters.delete(message.id);
        waiter.resolve(message);
      }
    });
    worker.on("error", (error) => this.failAll(error));
    worker.on("exit", (code) => {
      if (code !== 0) this.failAll(new Error(`M3 worker exited ${code}`));
    });
  }

  failAll(error) {
    for (const waiter of this.waiters.values()) waiter.reject(error);
    this.waiters.clear();
  }

  request(op, fields = {}, transfer = []) {
    const id = this.id++;
    return new Promise((resolveRequest, reject) => {
      this.waiters.set(id, { resolve: resolveRequest, reject });
      this.worker.postMessage({ version: 1, id, op, ...fields }, transfer);
    });
  }

  async ok(op, fields = {}, transfer = []) {
    const result = await this.request(op, fields, transfer);
    if (result.type !== "cadr-response" || result.status !== 0) {
      throw new Error(`${op} failed: ${JSON.stringify(result)}`);
    }
    return result;
  }
}

async function sendArtifact(client, kind, path) {
  const bytes = await readFile(path);
  if (bytes.byteLength > CHUNK) throw new Error(`${path} exceeds non-streamed input limit`);
  const transferable = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await client.ok("input", { bytes: transferable }, [transferable]);
  await client.ok("import", { artifactKind: kind, byteCount: bytes.byteLength });
}

async function streamDisk(client, path) {
  const { size } = await (await import("node:fs/promises")).stat(path);
  await client.ok("stream-begin", { artifactKind: 3, byteCount: BigInt(size) });
  let offset = 0n;
  for await (const part of createReadStream(path, { highWaterMark: CHUNK })) {
    const bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
    const transferable = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await client.ok("stream-chunk", { offset, bytes: transferable }, [transferable]);
    offset += BigInt(bytes.byteLength);
  }
  if (offset !== BigInt(size)) throw new Error(`streamed ${offset} bytes; disk has ${size}`);
  await client.ok("stream-finish");
}

async function main(argv) {
  if (argv.length !== 8) usage();
  const [wasm, config, prom, promSymbols, ucodeSymbols, disk, slotsText, output] = argv;
  const slots = Number(slotsText);
  if (!Number.isSafeInteger(slots) || slots <= 0) usage();
  const module = await WebAssembly.compile(await readFile(wasm));
  const worker = new Worker(pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
  const client = new Client(worker);
  let terminal = 0;
  let count = 0;
  const out = createWriteStream(output, { flags: "w" });
  try {
    await client.ok("instantiate", { module });
    await sendArtifact(client, 1, config);
    await sendArtifact(client, 2, prom);
    await sendArtifact(client, 4, promSymbols);
    await sendArtifact(client, 5, ucodeSymbols);
    await streamDisk(client, disk);
    const machineInfo = await client.ok("machine-info");
    if ((new DataView(machineInfo.info).getUint32(4, true) & 4) === 0) {
      throw new Error("streamed base disk was not atomically published");
    }
    await client.ok("cold-power-on");
    await client.ok("boot");
    await waitForWrite(out, cadrM3TranscriptHeader(slots));
    let result = await client.ok("boundary-digests-v3");
    await waitForWrite(out, Buffer.from(result.digests));
    count = 1;
    for (let ordinal = 1; ordinal <= slots; ) {
      const requested = Math.min(BATCH, slots - ordinal + 1);
      result = await client.ok("run-digest-batch-v3", { clockSlots: requested });
      const batch = Buffer.from(result.digests);
      terminal = result.terminalStatus >>> 0;
      if (!Number.isSafeInteger(result.boundaryCount) || result.boundaryCount < 0 ||
          result.boundaryCount > requested || batch.byteLength !== result.boundaryCount * 96) {
        throw new Error("malformed worker batch framing");
      }
      if (result.boundaryCount === 0 && terminal === 0) {
        throw new Error("zero-progress worker batch without terminal status");
      }
      await waitForWrite(out, batch);
      count += result.boundaryCount;
      ordinal += result.boundaryCount;
      if (terminal !== 0) break;
    }
    await waitForWrite(out, footer(count, terminal));
    await new Promise((resolveFinish, reject) => {
      out.once("error", reject);
      out.end(resolveFinish);
    });
    if (terminal !== 0 || count !== slots + 1) {
      throw new Error(`terminal status ${terminal} after ${count} boundaries`);
    }
  } finally {
    out.destroy();
    await worker.terminate();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
