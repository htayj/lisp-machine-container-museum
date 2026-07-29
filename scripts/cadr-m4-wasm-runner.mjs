#!/usr/bin/env node
/* Run M4-D0 in the dedicated worker, servicing every host boundary in guest time. */
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CADR_STATUS_NOT_READY, CADR_STATUS_OK, createM4BlockRangeService } from "../cadr-web/wasm/cadr-m4-block-service.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK = 1048576;

class Client {
  constructor(worker) {
    this.worker = worker; this.id = 1; this.pending = new Map();
    worker.on("message", (message) => {
      const waiter = this.pending.get(message?.id);
      if (waiter !== undefined) { this.pending.delete(message.id); waiter.resolve(message); }
    });
    worker.on("error", (error) => this.fail(error));
  }
  fail(error) { for (const waiter of this.pending.values()) waiter.reject(error); this.pending.clear(); }
  request(op, fields = {}, transfer = []) {
    const id = this.id++;
    return new Promise((resolveRequest, reject) => {
      this.pending.set(id, { resolve: resolveRequest, reject });
      this.worker.postMessage({ version: 1, id, op, ...fields }, transfer);
    });
  }
  async ok(op, fields = {}, transfer = []) {
    const result = await this.request(op, fields, transfer);
    if (result.type !== "cadr-response" || result.status !== CADR_STATUS_OK) {
      throw new Error(`${op} failed: ${JSON.stringify(result)}`);
    }
    return result;
  }
}

function usage() { throw new Error("usage: WASM CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK SLOTS OUTPUT"); }
function schedule(events, diskStatus) {
  const pieces = [];
  for (const event of events) {
    if (event.requestSeen) pieces.push(`I,${event.issueTick},${event.dueTick},${event.generation},${event.requestId},${event.firstBlock},${event.blockCount},${event.blockBytes},${event.completionByteCount}`);
    if (event.completionDelivered) pieces.push(`C,${event.deliveryTick},${event.hostStatus}`);
  }
  if (pieces.length === 0) pieces.push("-");
  pieces.push(`Q,${(diskStatus & 8n) !== 0n ? 1 : 0}`);
  return pieces.join(";");
}
function line(boundary, digests, scheduleToken) {
  const hex = Buffer.from(digests).toString("hex");
  if (hex.length !== 192) throw new Error("expected a 96-byte digest record");
  return `S ${boundary} ${hex.slice(0, 64)} ${hex.slice(64, 128)} ${hex.slice(128, 192)} ${scheduleToken}\n`;
}
async function importSmall(client, kind, path) {
  const bytes = await readFile(path);
  if (bytes.byteLength === 0 || bytes.byteLength > CHUNK) throw new Error(`${path} needs streamed or nonempty ingress`);
  const transfer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await client.ok("input", { bytes: transfer }, [transfer]);
  await client.ok("import", { artifactKind: kind, byteCount: bytes.byteLength });
}
async function importDisk(client, bytes) {
  await client.ok("stream-begin", { artifactKind: 3, byteCount: BigInt(bytes.byteLength) });
  for (let offset = 0; offset < bytes.byteLength; offset += CHUNK) {
    const chunk = bytes.subarray(offset, Math.min(bytes.byteLength, offset + CHUNK));
    const transfer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
    await client.ok("stream-chunk", { offset: BigInt(offset), bytes: transfer }, [transfer]);
  }
  await client.ok("stream-finish");
}

async function main(argv) {
  if (argv.length !== 8) usage();
  const [wasm, config, prom, promSymbols, ucodeSymbols, disk, slotsText, output] = argv;
  const slots = Number(slotsText);
  if (!Number.isSafeInteger(slots) || slots <= 0) usage();
  const diskBytes = await readFile(disk);
  const module = await WebAssembly.compile(await readFile(wasm));
  const worker = new Worker(pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
  const client = new Client(worker);
  const out = createWriteStream(output, { flags: "w" });
  let terminal = CADR_STATUS_OK;
  try {
    await client.ok("instantiate", { module });
    await importSmall(client, 1, config); await importSmall(client, 2, prom);
    await importSmall(client, 4, promSymbols); await importSmall(client, 5, ucodeSymbols);
    await importDisk(client, diskBytes);
    await client.ok("cold-power-on"); await client.ok("boot");
    const service = createM4BlockRangeService({ image: diskBytes, expectedImageByteCount: BigInt(diskBytes.byteLength) });
    const initial = await client.ok("boundary-digests-v3");
    const initialObservation = await client.ok("disk-observation");
    out.write("CDRM4TX1\n"); out.write(line(0, initial.digests, schedule([], initialObservation.diskStatus)));
    for (let boundary = 1; boundary <= slots; boundary += 1) {
      let run; let polled; const polledEvents = [];
      /* Applying a queued completion is a host-only transition.  Keep running
       * until a guest slot completes or a terminal result occurs, so one
       * transcript boundary always denotes exactly one completed guest slot. */
      for (;;) {
        run = await client.request("run", { clockSlots: 1 });
        if (run.type !== "cadr-response") throw new Error("malformed run response");
        const info = await client.ok("machine-info");
        const tick = new DataView(info.info).getBigUint64(8, true);
        polled = await service.poll({
          tick,
          nextRequest: async () => {
            const next = await client.request("host-next-request");
            return next.status === CADR_STATUS_NOT_READY ? { status: CADR_STATUS_NOT_READY } : next;
          },
          complete: async ({ request, hostStatus, bytes }) => {
            const transfer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            const completed = await client.request("host-complete", {
              operation: request.operation, hostStatus, generation: request.generation,
              requestId: request.requestId, bytes: transfer,
            }, [transfer]);
            return completed;
          },
        });
        if (polled.status !== CADR_STATUS_OK) throw new Error(`host poll failed: ${polled.status}`);
        polledEvents.push(...polled.events);
        terminal = run.status >>> 0;
        if (terminal === 8 && polled.events.some((event) => event.completionDelivered)) terminal = CADR_STATUS_OK;
        if (run.completedSlots !== 0n || terminal !== CADR_STATUS_OK) break;
      }
      if (run.completedSlots === 0n) break;
      const digests = await client.ok("boundary-digests-v3");
      const observation = await client.ok("disk-observation");
      out.write(line(boundary, digests.digests, schedule(polledEvents, observation.diskStatus)));
      if (terminal !== CADR_STATUS_OK) break;
    }
    await new Promise((resolveFinish, reject) => { out.once("error", reject); out.end(resolveFinish); });
    if (terminal !== CADR_STATUS_OK) throw new Error(`terminal status ${terminal}`);
  } finally {
    out.destroy(); await worker.terminate();
  }
}

await main(process.argv.slice(2));
