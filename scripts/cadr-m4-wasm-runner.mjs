#!/usr/bin/env node
/* Run M4-D0 in the dedicated worker, servicing every host boundary in guest time. */
import { createWriteStream } from "node:fs";
import { open, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CADR_HOST_OPERATION_BLOCK_WRITE, CADR_HOST_RESULT_FAILED,
  CADR_STATUS_NOT_READY, CADR_STATUS_OK, createM4BlockRangeService,
} from "../cadr-web/wasm/cadr-m4-block-service.mjs";
import {
  M4_ACTOR_APPLY, M4_ACTOR_CAPTURE, M4_ACTOR_DELIVERY, M4_ACTOR_ISSUE,
  M4_ACTOR_STABLE, M4_DISPOSITION_ABORT, M4_DISPOSITION_COMMIT,
  M4_DISPOSITION_NONE, m4EmptyTurn, m4OverlayRoot, m4Sha256,
  serializeM4Media,
} from "../cadr-web/wasm/cadr-m4-media.mjs";
import {
  M4_CONTROLLER_FINAL_BOUNDARY, serializeM4ControllerTranscript,
} from "../cadr-web/wasm/cadr-m4-controller-transcript.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK = 1048576;
const BATCH = 4096;
const BOOT_MEDIA_TERMINAL_BOUNDARY = 1029996;

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
      this.worker.postMessage({ version: 2, id, op, ...fields }, transfer);
    });
  }
  async ok(op, fields = {}, transfer = []) {
    const result = await this.request(op, fields, transfer);
    if (result.type !== "cadr-response" || result.version !== 2 ||
        result.status !== CADR_STATUS_OK) {
      throw new Error(`${op} failed: ${JSON.stringify(result)}`);
    }
    return result;
  }
}

function usage() { throw new Error("usage: WASM CONFIG PROM PROM-SYMBOLS UCODE-SYMBOLS DISK SLOTS OUTPUT MEDIA EVIDENCE"); }
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
function batchLines(firstBoundary, digestBuffer, interruptBuffer) {
  const digests = new Uint8Array(digestBuffer);
  const interrupts = new Uint8Array(interruptBuffer);
  if (digests.byteLength !== interrupts.byteLength * 96) {
    throw new Error("malformed M4 batch digest/interrupt framing");
  }
  const lines = new Array(interrupts.byteLength);
  for (let index = 0; index < interrupts.byteLength; index += 1) {
    lines[index] = line(firstBoundary + index,
      digests.subarray(index * 96, (index + 1) * 96),
      `-;Q,${interrupts[index]}`);
  }
  return lines.join("");
}
async function writeOutput(stream, bytes) {
  if (stream.write(bytes)) return;
  await once(stream, "drain");
}
async function importSmall(client, kind, path) {
  const bytes = await readFile(path);
  if (bytes.byteLength === 0 || bytes.byteLength > CHUNK) throw new Error(`${path} needs streamed or nonempty ingress`);
  const transfer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await client.ok("input", { bytes: transfer }, [transfer]);
  await client.ok("import", { artifactKind: kind, byteCount: bytes.byteLength });
}
async function readExact(handle, byteOffset, byteCount) {
  if (typeof byteOffset !== "bigint" || typeof byteCount !== "bigint" ||
      byteOffset < 0n || byteCount < 0n ||
      byteOffset + byteCount > BigInt(Number.MAX_SAFE_INTEGER) ||
      byteCount > BigInt(CHUNK)) {
    throw new RangeError("disk range exceeds exact bounded Node offsets");
  }
  const bytes = new Uint8Array(Number(byteCount));
  let completed = 0;
  while (completed < bytes.byteLength) {
    const result = await handle.read(
      bytes, completed, bytes.byteLength - completed,
      Number(byteOffset) + completed);
    if (result.bytesRead === 0) throw new Error("short disk range");
    completed += result.bytesRead;
  }
  return bytes;
}
async function importDisk(client, handle, byteCount) {
  await client.ok("stream-begin", { artifactKind: 3, byteCount });
  for (let offset = 0n; offset < byteCount; offset += BigInt(CHUNK)) {
    const count = byteCount - offset < BigInt(CHUNK) ? byteCount - offset : BigInt(CHUNK);
    const chunk = await readExact(handle, offset, count);
    const transfer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
    await client.ok("stream-chunk", { offset, bytes: transfer }, [transfer]);
  }
  await client.ok("stream-finish");
}

async function requestTurn(event, actor, ordinal, overlayGeneration,
  overlayRoot, emptyHash) {
  const descriptor = new Uint8Array(event.descriptor);
  const payload = new Uint8Array(event.requestPayload);
  const turn = m4EmptyTurn();
  turn.ordinal = BigInt(ordinal);
  turn.actor = actor;
  turn.operation = event.operation;
  turn.actorStatus = CADR_STATUS_OK;
  turn.guestTick = event.issueTick;
  turn.generation = event.generation;
  turn.requestId = event.requestId;
  turn.descriptor = descriptor;
  turn.requestPayloadByteCount = event.requestPayloadByteCount;
  turn.expectedCompletionByteCount = event.completionByteCount;
  turn.descriptorSha256 = await m4Sha256(descriptor);
  turn.requestPayloadSha256 = await m4Sha256(payload);
  turn.pageSha256 = event.operation === CADR_HOST_OPERATION_BLOCK_WRITE ?
    await m4Sha256(payload) : emptyHash;
  turn.overlayGeneration = overlayGeneration;
  turn.overlayRootSha256 = overlayRoot;
  return turn;
}

async function appendMediaEvent(turns, event, mediaState, emptyHash) {
  if (event.requestSeen) {
    const issue = await requestTurn(event, M4_ACTOR_ISSUE, turns.length,
      mediaState.generation, mediaState.root, emptyHash);
    turns.push(issue);
    turns.push({
      ...issue, ordinal: BigInt(turns.length), actor: M4_ACTOR_CAPTURE,
      descriptor: issue.descriptor.slice(),
    });
  }
  if (!event.completionDelivered) return null;
  const delivery = await requestTurn(event, M4_ACTOR_DELIVERY, turns.length,
    mediaState.generation, mediaState.root, emptyHash);
  delivery.guestTick = event.deliveryTick;
  delivery.actorStatus = event.hostStatus;
  delivery.deliveredCompletionByteCount = event.completionByteCount;
  delivery.pageSha256 = await m4Sha256(new Uint8Array(event.pageBytes));
  if (event.hostStatus === CADR_HOST_RESULT_FAILED) {
    delivery.disposition = M4_DISPOSITION_ABORT;
  } else if (event.operation === CADR_HOST_OPERATION_BLOCK_WRITE) {
    if (!event.overlayCommitted) {
      throw new Error("successful write delivery did not commit its overlay");
    }
    delivery.disposition = M4_DISPOSITION_COMMIT;
    mediaState.entries.set(event.firstBlock, delivery.pageSha256);
    mediaState.generation += 1n;
    mediaState.root = await m4OverlayRoot(mediaState.entries);
    delivery.overlayGeneration = mediaState.generation;
    delivery.overlayRootSha256 = mediaState.root;
  } else {
    delivery.disposition = M4_DISPOSITION_NONE;
  }
  turns.push(delivery);
  return delivery;
}

async function main(argv) {
  if (argv.length !== 10) usage();
  const [wasm, config, prom, promSymbols, ucodeSymbols, disk, slotsText,
    output, mediaOutput, evidenceOutput] = argv;
  const semanticOnly = output === "-";
  const slots = Number(slotsText);
  if (!Number.isSafeInteger(slots) ||
      BigInt(slots) !== M4_CONTROLLER_FINAL_BOUNDARY) usage();
  const diskHandle = await open(disk, "r");
  const diskStat = await diskHandle.stat({ bigint: true });
  if (!diskStat.isFile() || diskStat.size <= 0n ||
      diskStat.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    await diskHandle.close();
    throw new Error("disk must be a nonempty exact-offset regular file");
  }
  const diskByteCount = diskStat.size;
  const module = await WebAssembly.compile(await readFile(wasm));
  const worker = new Worker(pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
  const client = new Client(worker);
  const out = semanticOnly ? null : createWriteStream(output, { flags: "w" });
  let terminal = CADR_STATUS_OK;
  let terminalWitness = null;
  try {
    await client.ok("instantiate", { module });
    await importSmall(client, 1, config); await importSmall(client, 2, prom);
    await importSmall(client, 4, promSymbols); await importSmall(client, 5, ucodeSymbols);
    await importDisk(client, diskHandle, diskByteCount);
    await client.ok("cold-power-on"); await client.ok("boot");
    const service = createM4BlockRangeService({
      readRange: async (offset, byteCount) => readExact(diskHandle, offset, byteCount),
      imageByteCount: diskByteCount,
      expectedImageByteCount: diskByteCount,
    });
    const emptyHash = await m4Sha256();
    const mediaState = {
      entries: new Map(), generation: 0n,
      root: await m4OverlayRoot(new Map()),
    };
    const mediaTurns = [];
    const initial = await client.ok("boundary-digests-v3");
    const initialObservation = await client.ok("disk-observation");
    if (!semanticOnly) {
      await writeOutput(out, "CDRM4TX1\n");
      await writeOutput(out, line(0, initial.digests,
        schedule([], initialObservation.diskStatus)));
    }
    for (let boundary = 1; boundary <= slots; ) {
      const toTerminal = boundary <= BOOT_MEDIA_TERMINAL_BOUNDARY ?
        BOOT_MEDIA_TERMINAL_BOUNDARY - boundary + 1 : BATCH;
      const requested = Math.min(
        BATCH, slots - boundary + 1, toTerminal);
      const batch = await client.ok("run-digest-batch-m4", {
        clockSlots: requested,
      });
      if (!Number.isSafeInteger(batch.boundaryCount) ||
          batch.boundaryCount < 0 || batch.boundaryCount > requested ||
          typeof batch.boundaryPendingHost !== "boolean") {
        throw new Error("malformed M4 worker batch response");
      }
      if (!semanticOnly) {
        await writeOutput(out, batchLines(boundary, batch.digests,
          batch.interrupts));
      }
      boundary += batch.boundaryCount;
      if (boundary === BOOT_MEDIA_TERMINAL_BOUNDARY + 1) {
        const terminalObservation =
          await client.ok("boot-media-observation");
        if (terminalObservation.p0Pc !== 0o355n ||
            terminalObservation.p1Pc !== 0o356n ||
            terminalObservation.nextMicroPc !== 0o357n ||
            terminalObservation.outstandingRequestId !== 0n) {
          throw new Error(`selected boot-media terminal predicate mismatch: ` +
            `p0=${terminalObservation.p0Pc.toString(8)} ` +
            `p1=${terminalObservation.p1Pc.toString(8)} ` +
            `next=${terminalObservation.nextMicroPc.toString(8)} ` +
            `request=${terminalObservation.outstandingRequestId}`);
        }
        terminalWitness = terminalObservation;
      }
      terminal = batch.terminalStatus >>> 0;
      if (!batch.boundaryPendingHost) {
        if (batch.boundaryCount === 0 && terminal === CADR_STATUS_OK) {
          throw new Error("zero-progress M4 batch without a host boundary");
        }
        if (terminal !== CADR_STATUS_OK) break;
        continue;
      }
      if (terminal !== 8 || boundary > slots) {
        throw new Error("host boundary has inconsistent terminal state");
      }

      const polledEvents = [];
      let pendingApply = null;
      for (;;) {
        const info = await client.ok("machine-info");
        const tick = new DataView(info.info).getBigUint64(8, true);
        const polled = await service.poll({
          tick,
          nextRequest: async () => {
            const next = await client.request("host-next-request");
            if (next.status === CADR_STATUS_NOT_READY) {
              return { status: CADR_STATUS_NOT_READY };
            }
            if (next.status === CADR_STATUS_OK) {
              const generation = service.overlayGeneration();
              await client.ok("media-overlay-state", {
                busy: true, dirty: generation !== 0n,
                snapshotBlocked: service.snapshotBlocked(),
                overlayGeneration: generation,
              });
            }
            return next;
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
        {
          const generation = service.overlayGeneration();
          await client.ok("media-overlay-state", {
            busy: false, dirty: generation !== 0n,
            snapshotBlocked: service.snapshotBlocked(),
            overlayGeneration: generation,
          });
        }
        if (polled.status !== CADR_STATUS_OK) throw new Error(`host poll failed: ${polled.status}`);
        polledEvents.push(...polled.events);
        for (const event of polled.events) {
          const delivered = await appendMediaEvent(
            mediaTurns, event, mediaState, emptyHash);
          if (delivered !== null) {
            if (pendingApply !== null) {
              throw new Error("second delivery preceded completion application");
            }
            pendingApply = delivered;
          }
        }
        if (!polled.events.some((event) => event.completionDelivered)) {
          if (service.hasPendingRequest()) {
            throw new Error("positive guest-tick latency cannot advance while the core waits");
          }
          break;
        }
        const applied = await client.request("run", { clockSlots: 1 });
        if (applied.type !== "cadr-response" ||
            applied.completedSlots !== 0n ||
            (applied.status !== CADR_STATUS_OK && applied.status !== 8)) {
          throw new Error(`invalid zero-slot completion application status ${applied?.status}`);
        }
        if (pendingApply === null || applied.status !== CADR_STATUS_OK) {
          throw new Error("completion did not apply at the selected boundary");
        }
        mediaTurns.push({
          ...pendingApply, ordinal: BigInt(mediaTurns.length),
          actor: M4_ACTOR_APPLY, actorStatus: CADR_STATUS_OK,
          guestTick: BigInt(boundary),
          descriptor: pendingApply.descriptor.slice(),
        });
        pendingApply = null;
      }
      const digests = await client.ok("boundary-digests-v3");
      const observation = await client.ok("disk-observation");
      if (!semanticOnly) {
        await writeOutput(out, line(boundary, digests.digests,
          schedule(polledEvents, observation.diskStatus)));
      }
      boundary += 1;
      terminal = CADR_STATUS_OK;
    }
    const stableDigest = await client.ok("boundary-digest-v4");
    const stable = m4EmptyTurn();
    stable.ordinal = BigInt(mediaTurns.length);
    stable.actor = M4_ACTOR_STABLE;
    stable.guestTick = BigInt(slots);
    stable.descriptorSha256 = emptyHash;
    stable.requestPayloadSha256 = emptyHash;
    stable.pageSha256 = emptyHash;
    stable.overlayGeneration = mediaState.generation;
    stable.overlayRootSha256 = mediaState.root;
    stable.stabilizedStateSha256 = new Uint8Array(stableDigest.digest);
    mediaTurns.push(stable);
    await writeFile(mediaOutput, serializeM4Media(mediaTurns));
    const evidence = await client.ok("disk-evidence");
    if (terminalWitness === null) {
      throw new Error("M4 controller terminal was not observed");
    }
    await writeFile(evidenceOutput, await serializeM4ControllerTranscript({
      coreEvidence: evidence.bytes,
      finalBoundary: BigInt(slots),
      finalStateSha256: stableDigest.digest,
      terminalObservation: terminalWitness,
    }));
    if (!semanticOnly) {
      await new Promise((resolveFinish, reject) => {
        out.once("error", reject);
        out.end(resolveFinish);
      });
    }
    if (terminal !== CADR_STATUS_OK) throw new Error(`terminal status ${terminal}`);
  } finally {
    if (out !== null) out.destroy();
    await worker.terminate();
    await diskHandle.close();
  }
}

await main(process.argv.slice(2));
