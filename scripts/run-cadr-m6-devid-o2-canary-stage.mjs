#!/usr/bin/env node
/*
 * Staged-only executor for the M6-DEVID O2 canary.  The launcher verifies this
 * file before and after execution; it must not be run from a mutable checkout.
 */
import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  preflightM6Artifacts,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import { createM4BlockRangeService } from
  "../cadr-web/wasm/cadr-m4-block-service.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = Object.freeze([
  [1, "cadr-web-303-runnable-template", "cadr-web/profiles/cadr-web-303.ini.in"],
  [2, "prom-control-store", "l/sys/ubin/promh.mcr"],
  [4, "prom-symbols", "l/sys/ubin/promh.sym"],
  [5, "microcode-symbols", "l/sys/ubin/ucadr.sym"],
  [3, "system-303-0-base-disk", "l/usim/disk-sys-303-0.img"],
]);
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_BOUNDARY = 1_130_000n;
const BATCH_SLOTS = 4096;
const MAX_HOST_TRANSACTIONS = 2_260_000;
const CADR_M6_DEVID_POLICY_ID = "M6-PREFIX512-TAILSHA256-v1";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function parseArgs(argv) {
  const result = { artifactRoot: null, wasm: null, completedBoundary: null,
    privateRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: staged M6-DEVID canary --artifact-root ROOT --wasm PATH --completed-boundary 1130000\n");
      process.exit(0);
    }
    if (!['--artifact-root', '--wasm', '--completed-boundary', '--private-root'].includes(argument) ||
        result[argument.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] !== null) {
      throw new TypeError(`invalid staged canary argument ${JSON.stringify(argument)}`);
    }
    const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${argument} needs a value`);
    }
    if (argument === "--artifact-root") result.artifactRoot = resolve(value);
    else if (argument === "--wasm") result.wasm = resolve(value);
    else if (argument === "--private-root") result.privateRoot = resolve(value);
    else result.completedBoundary = BigInt(value);
  }
  if (result.artifactRoot === null || result.wasm === null ||
      result.privateRoot === null ||
      result.completedBoundary !== MAX_BOUNDARY) {
    throw new TypeError("staged canary needs exact artifact root, Wasm path, and boundary 1130000");
  }
  return Object.freeze(result);
}

function asBytes(value, label) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError(`${label} must be bytes`);
}

async function fileIdentity(path) {
  const bytes = await readFile(path);
  return Object.freeze({ byte_count: bytes.byteLength, sha256: hash(bytes) });
}

async function sourceIdentity(path, expectedBytes) {
  const handle = await open(path, fsConstants.O_RDONLY |
    (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || BigInt(metadata.size) !== expectedBytes) {
      throw new Error("artifact has an unexpected type or byte count");
    }
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1_048_576);
    for (let offset = 0n; offset < expectedBytes;) {
      const want = Number(expectedBytes - offset > BigInt(buffer.byteLength) ?
        BigInt(buffer.byteLength) : expectedBytes - offset);
      const { bytesRead } = await handle.read(buffer, 0, want, Number(offset));
      if (bytesRead !== want) throw new Error(`artifact ${path} short read`);
      digest.update(buffer.subarray(0, bytesRead));
      offset += BigInt(bytesRead);
    }
    return Object.freeze({ byte_count: expectedBytes.toString(), sha256: digest.digest("hex") });
  } finally { await handle.close(); }
}

export async function copyRegularNoFollow(source, target) {
  const input = await open(source, fsConstants.O_RDONLY |
    (fsConstants.O_NOFOLLOW ?? 0));
  const output = await open(target, "wx", 0o600);
  try {
    const metadata = await input.stat();
    if (!metadata.isFile()) throw new Error("artifact source is not a regular file");
    const buffer = Buffer.allocUnsafe(1_048_576);
    let offset = 0;
    for (;;) {
      const { bytesRead } = await input.read(buffer, 0, buffer.byteLength, offset);
      if (bytesRead === 0) break;
      await output.write(buffer, 0, bytesRead, offset);
      offset += bytesRead;
    }
    if (offset !== metadata.size) throw new Error("artifact source changed during private copy");
    await output.sync();
    return Object.freeze({ byte_count: offset });
  } finally {
    await output.close(); await input.close();
  }
}

async function snapshotArtifacts(artifactRoot, sessionRoot) {
  await chmod(sessionRoot, 0o700);
  for (const [, , relativePath] of REQUIRED) {
    const source = resolve(artifactRoot, relativePath);
    const target = resolve(sessionRoot, relativePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyRegularNoFollow(source, target);
  }
}

class ArtifactSet {
  constructor(items) { this.items = items; }
  get artifacts() { return this.items.map(item => item.artifact); }
  async close() { await Promise.all(this.items.map(item => item.handle.close())); }
}

async function loadArtifacts(artifactRoot) {
  const [releaseBytes, profileText] = await Promise.all([
    readFile(resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json")),
    readFile(resolve(ROOT, "cadr-web/profiles/cadr-web-303.json"), "utf8"),
  ]);
  const release = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(releaseBytes));
  const scheduled = [];
  const collectSchedule = value => {
    if (Array.isArray(value)) value.forEach(collectSchedule);
    else if (value !== null && typeof value === "object") {
      if (typeof value.due_boundary === "string") {
        scheduled.push(BigInt(value.due_boundary));
      }
      Object.values(value).forEach(collectSchedule);
    }
  };
  collectSchedule(release.schedule);
  if (scheduled.length !== release.schedule?.event_count ||
      scheduled.some(boundary => boundary <= MAX_BOUNDARY)) {
    throw new Error("frozen M6 input schedule is not empty through the canary target");
  }
  const profileJson = JSON.parse(profileText);
  const recordByKind = new Map(release.artifacts.map(record => [record.kind, record]));
  const declaredById = new Map(profileJson.artifacts.map(record => [record.id, record]));
  const expected = REQUIRED.map(([kind, id, relativePath]) => {
    const record = recordByKind.get(kind); const declared = declaredById.get(id);
    if (!/^[1-9][0-9]*$/.test(record?.byte_count ?? "") ||
        !/^[0-9a-f]{64}$/.test(record?.sha256 ?? "") ||
        BigInt(declared?.bytes ?? -1) !== BigInt(record.byte_count) ||
        declared?.sha256 !== record.sha256) throw new Error(`release/profile mismatch for kind ${kind}`);
    return Object.freeze({ kind, relativePath, byteCount: BigInt(record.byte_count), sha256: record.sha256 });
  });
  const items = [];
  try {
    for (const source of expected) {
      const path = resolve(artifactRoot, source.relativePath);
      const identity = await sourceIdentity(path, source.byteCount);
      if (identity.sha256 !== source.sha256) throw new Error(`artifact digest mismatch: ${source.relativePath}`);
      const handle = await open(path, "r");
      items.push(Object.freeze({ source, handle, artifact: Object.freeze({
        kind: source.kind, byteCount: source.byteCount,
        async readRange(offset, count) {
          if (typeof offset !== "bigint" || typeof count !== "bigint" || offset < 0n ||
              count < 0n || offset > source.byteCount || count > source.byteCount - offset ||
              count > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("artifact range out of bounds");
          const bytes = Buffer.allocUnsafe(Number(count));
          const { bytesRead } = await handle.read(bytes, 0, bytes.byteLength, Number(offset));
          return new Uint8Array(bytes.buffer, bytes.byteOffset, bytesRead).slice();
        },
      }) }));
    }
    return Object.freeze({
      artifacts: new ArtifactSet(items), expected,
      profile: Object.freeze({ id: profileJson.profile.id, artifacts: expected.map(source => Object.freeze({
        kind: source.kind, byteCount: source.byteCount, sha256: Buffer.from(source.sha256, "hex"),
      })) }),
      releaseBytes: new Uint8Array(releaseBytes),
      schedule: Object.freeze({ event_count: scheduled.length,
        first_due_boundary: scheduled.reduce((left, right) =>
          left < right ? left : right).toString(),
        events_due_through_target: 0 }),
    });
  } catch (error) {
    await Promise.all(items.map(item => item.handle.close().catch(() => undefined))); throw error;
  }
}

class Client {
  constructor(worker) {
    this.worker = worker; this.nextId = 1; this.closed = false; this.pending = new Map();
    worker.on("message", message => this.receive(message));
    worker.on("error", error => this.rejectAll(error));
    worker.on("exit", code => { if (!this.closed && code !== 0) this.rejectAll(new Error(`worker exited ${code}`)); });
  }
  receive(message) {
    const pending = this.pending.get(message?.id);
    if (pending === undefined) return this.rejectAll(new Error("unsolicited worker response"));
    this.pending.delete(message.id); clearTimeout(pending.timeout);
    if (message.type !== "cadr-response" || message.version !== 4 || message.op !== pending.op ||
        !Number.isSafeInteger(message.status)) pending.reject(new Error(`malformed ${pending.op} response`));
    else pending.resolve(message);
  }
  rejectAll(error) { for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); } this.pending.clear(); }
  request(op, fields = {}, transfer = []) {
    const id = this.nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timeout = setTimeout(() => { this.pending.delete(id); rejectRequest(new Error(`${op} timed out`)); }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { op, timeout, resolve: resolveRequest, reject: rejectRequest });
      this.worker.postMessage({ version: 4, id, op, ...fields }, transfer);
    });
  }
  async close() { if (!this.closed) { this.closed = true; this.rejectAll(new Error("worker closed")); await this.worker.terminate(); } }
}

function machineInfo(reply) {
  if (reply.status !== 0 || !(reply.info instanceof ArrayBuffer) || reply.info.byteLength !== 64) throw new Error("missing machine-info");
  const view = new DataView(reply.info);
  return Object.freeze({ lifecycle: view.getUint32(0, true),
    clockSlotsCompleted: view.getBigUint64(8, true),
    outstandingRequestId: view.getBigUint64(40, true),
    persistentStatus: view.getUint32(56, true), profile: view.getUint32(60, true) });
}

async function ok(client, op, fields = {}, transfer = []) {
  const response = await client.request(op, fields, transfer);
  if (response?.status !== 0) throw new Error(`${op} failed with status ${response?.status}`);
  return response;
}

async function importArtifact(client, artifact) {
  const chunkBytes = 1_048_576n;
  if (artifact.byteCount <= chunkBytes) {
    const bytes = await artifact.readRange(0n, artifact.byteCount);
    const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await ok(client, "input", { bytes: input }, [input]);
    await ok(client, "import", { artifactKind: artifact.kind,
      byteCount: Number(artifact.byteCount) });
    return;
  }
  await ok(client, "stream-begin", { artifactKind: artifact.kind,
    byteCount: artifact.byteCount });
  try {
    for (let offset = 0n; offset < artifact.byteCount; offset += chunkBytes) {
      const count = artifact.byteCount - offset < chunkBytes ?
        artifact.byteCount - offset : chunkBytes;
      const bytes = await artifact.readRange(offset, count);
      const input = bytes.buffer.slice(bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength);
      await ok(client, "stream-chunk", { offset, bytes: input }, [input]);
    }
    await ok(client, "stream-finish");
  } catch (error) {
    await client.request("stream-abort").catch(() => undefined);
    throw error;
  }
}

async function initializeMachine(client, module, artifacts) {
  await ok(client, "instantiate", { module, m6DiskEvidencePolicy: true });
  const blank = machineInfo(await ok(client, "machine-info"));
  if (blank.lifecycle !== 0 || blank.clockSlotsCompleted !== 0n ||
      blank.outstandingRequestId !== 0n) throw new Error("canary worker is not fresh");
  for (const kind of [1, 2, 3, 4, 5]) {
    await importArtifact(client, artifacts.find(artifact => artifact.kind === kind));
  }
  await ok(client, "cold-power-on");
  await ok(client, "boot");
  await ok(client, "scheduler-visibility", { hidden: false });
  await ok(client, "scheduler-start");
}

async function serviceWaiting(client, service, clockSlotsCompleted) {
  const before = service.overlayGeneration();
  await ok(client, "media-overlay-state", { busy: true, dirty: before !== 0n,
    snapshotBlocked: service.snapshotBlocked(), overlayGeneration: before });
  let result;
  try {
    result = await service.poll({
      tick: clockSlotsCompleted,
      nextRequest: () => client.request("host-next-request"),
      complete: async ({ request, hostStatus, bytes }) => {
        const supplied = asBytes(bytes, "host completion");
        const input = supplied.buffer.slice(supplied.byteOffset,
          supplied.byteOffset + supplied.byteLength);
        return client.request("host-complete", {
          operation: request.operation, hostStatus,
          generation: request.generation, requestId: request.requestId,
          bytes: input,
        }, [input]);
      },
    });
  } finally {
    const after = service.overlayGeneration();
    await ok(client, "media-overlay-state", { busy: false, dirty: after !== 0n,
      snapshotBlocked: service.snapshotBlocked(), overlayGeneration: after });
  }
  if (result?.status !== 0 || service.hasPendingRequest() ||
      !Array.isArray(result.events) || result.events.length === 0) {
    throw new Error("exact-boundary host service did not complete one request");
  }
  return result.events.filter(event => event.requestSeen === true).length;
}

export async function runExactCanaryLoop(client, service,
  exactBoundary = MAX_BOUNDARY) {
  let info = machineInfo(await ok(client, "machine-info"));
  if (info.clockSlotsCompleted !== 0n || info.lifecycle !== 2 ||
      info.persistentStatus !== 0) throw new Error("canary did not begin at runnable slot zero");
  let batches = 0; let hostTransactions = 0;
  while (info.clockSlotsCompleted < exactBoundary) {
    const before = info.clockSlotsCompleted;
    const remaining = exactBoundary - before;
    const requested = Number(remaining < BigInt(BATCH_SLOTS) ?
      remaining : BigInt(BATCH_SLOTS));
    const batch = await ok(client, "run-digest-batch-m5", { clockSlots: requested });
    if (!Number.isSafeInteger(batch.boundaryCount) || batch.boundaryCount < 0 ||
        batch.boundaryCount > requested ||
        typeof batch.boundaryPendingHost !== "boolean" ||
        !Number.isSafeInteger(batch.terminalStatus) ||
        [7, 12, 13, 16].includes(batch.terminalStatus)) {
      throw new Error("malformed or terminal exact-boundary batch");
    }
    info = machineInfo(await ok(client, "machine-info"));
    if (info.clockSlotsCompleted < before ||
        info.clockSlotsCompleted > before + BigInt(requested) ||
        info.persistentStatus !== 0) {
      throw new Error("machine-info clock_slots_completed escaped the requested interval");
    }
    if (batch.terminalStatus === 8) {
      if (info.outstandingRequestId === 0n) {
        throw new Error("WAITING_FOR_HOST has no machine-info outstanding request");
      }
      const waitingState = await ok(client, "scheduler-state");
      hostTransactions += await serviceWaiting(client, service,
        info.clockSlotsCompleted);
      if (hostTransactions > MAX_HOST_TRANSACTIONS) {
        throw new Error("host transaction safety limit exceeded");
      }
      if (waitingState.pendingBoundaryDigest === true) {
        if (batch.boundaryPendingHost !== true) {
          throw new Error("worker framing hid a pending boundary digest");
        }
        const settled = await ok(client, "run-digest-batch-m5", { clockSlots: 1 });
        const afterSettle = machineInfo(await ok(client, "machine-info"));
        if (settled.terminalStatus !== 0 || settled.boundaryCount !== 1 ||
            settled.boundaryPendingHost !== false ||
            afterSettle.clockSlotsCompleted !== info.clockSlotsCompleted ||
            afterSettle.outstandingRequestId !== 0n) {
          throw new Error("completion-only digest settlement advanced a guest slot");
        }
        info = afterSettle;
      } else if (info.clockSlotsCompleted === exactBoundary) {
        throw new Error("exact-boundary host wait has no tested completion-only settlement");
      } else if (batch.boundaryPendingHost !== false) {
        throw new Error("worker framing invented a pending boundary digest");
      }
    } else if (batch.boundaryPendingHost !== false ||
        batch.terminalStatus !== 0 ||
        info.clockSlotsCompleted !== before + BigInt(requested)) {
      throw new Error("non-waiting batch did not complete its exact requested slots");
    }
    if (info.clockSlotsCompleted === before && batch.terminalStatus !== 8) {
      throw new Error("exact-boundary loop made no progress");
    }
    batches += 1;
  }
  await ok(client, "scheduler-pause");
  info = machineInfo(await ok(client, "machine-info"));
  if (info.clockSlotsCompleted !== exactBoundary ||
      info.outstandingRequestId !== 0n || info.persistentStatus !== 0) {
    throw new Error("canary did not quiesce at the exact clock_slots_completed value");
  }
  const state = await ok(client, "scheduler-state");
  if (state.lifecycle !== "PAUSED" || state.runActive !== false ||
      state.pendingBoundaryDigest !== false ||
      state.deferredControlCount !== 0 || service.hasPendingRequest()) {
    throw new Error("canary scheduler or media service is not quiescent");
  }
  if ((await client.request("host-next-request")).status !== 9) {
    throw new Error("canary retained an observable host request");
  }
  return Object.freeze({ info, batches, hostTransactions,
    overlayGeneration: service.overlayGeneration() });
}

function summary(reply) {
  const bytes = asBytes(reply?.summary, "summary"); const digest = asBytes(reply?.summaryDigest, "summary digest");
  if (reply?.status !== 0 || reply.policyId !== CADR_M6_DEVID_POLICY_ID || reply.wireSchema !== "CDRM6E1" ||
      bytes.byteLength !== 512 || digest.byteLength !== 32 || hash(bytes) !== Buffer.from(digest).toString("hex")) throw new Error("bad CDRM6E1 response");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (Buffer.from(bytes.subarray(0, 7)).toString("ascii") !== "CDRM6E1" ||
      view.getBigUint64(32, true) !== 0x7fffffffffffffffn || view.getBigUint64(40, true) <= 512n ||
      view.getBigUint64(48, true) !== view.getBigUint64(40, true) - 512n || view.getBigUint64(56, true) !== 512n ||
      (view.getUint32(20, true) & 3) !== 1) throw new Error("CDRM6E1 is not a non-limit tail beyond 512");
  return Object.freeze({ accepted_events: view.getBigUint64(40, true).toString(),
    tail_events: view.getBigUint64(48, true).toString(), sha256: hash(bytes) });
}

async function artifactIdentities(expected, root) {
  const result = [];
  for (const source of expected) result.push(Object.freeze({ kind: source.kind, path: source.relativePath,
    ...(await sourceIdentity(resolve(root, source.relativePath), source.byteCount)) }));
  return Object.freeze(result);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let client = null; let loaded = null; let service = null;
  const privateRoot = options.privateRoot;
  try {
    const metadata = await lstat(privateRoot);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        metadata.uid !== process.geteuid() ||
        (metadata.mode & 0o777) !== 0o700 ||
        (await readdir(privateRoot)).length !== 0) {
      throw new Error("outer-owned private root is invalid");
    }
    await snapshotArtifacts(options.artifactRoot, privateRoot);
    loaded = await loadArtifacts(privateRoot);
    const sourceBefore = await artifactIdentities(loaded.expected, options.artifactRoot);
    const privateBefore = await artifactIdentities(loaded.expected, privateRoot);
    const verified = await preflightM6Artifacts({ artifacts: loaded.artifacts.artifacts,
      profile: loaded.profile, hashArtifact: async artifact => Buffer.from((await sourceIdentity(
        resolve(privateRoot, loaded.expected.find(item => item.kind === artifact.kind).relativePath),
        artifact.byteCount)).sha256, "hex") });
    const moduleBytes = await readFile(options.wasm); const module = await WebAssembly.compile(moduleBytes);
    const exports = new Set(WebAssembly.Module.exports(module).map(entry => entry.name));
    if (WebAssembly.Module.imports(module).length !== 0 ||
        !exports.has("cadr_wasm_m6_disk_evidence_summary") ||
        exports.has("cadr_wasm_display_full") ||
        exports.has("cadr_wasm_display_update") ||
        exports.has("cadr_wasm_post_terminal_diagnostic")) {
      throw new Error("O2 module is not the isolated M6-DEVID export profile");
    }
    client = new Client(new Worker(pathToFileURL(resolve(ROOT, "cadr-web/wasm/cadr-worker.js")), { type: "module" }));
    const disk = verified.sources.find(artifact => artifact.kind === 3);
    service = createM4BlockRangeService({ imageByteCount: disk.byteCount,
      expectedImageByteCount: disk.byteCount, readRange: disk.readRange });
    await initializeMachine(client, module, verified.sources);
    const result = await runExactCanaryLoop(client, service);
    const info = result.info;
    if (info.clockSlotsCompleted !== MAX_BOUNDARY || info.outstandingRequestId !== 0n ||
        info.lifecycle !== 2 || info.persistentStatus !== 0) {
      throw new Error("canary did not finish at the exact nonterminal completed guest boundary");
    }
    const evidence = summary(await client.request("m6-disk-evidence-summary"));
    const sourceAfter = await artifactIdentities(loaded.expected, options.artifactRoot);
    const privateAfter = await artifactIdentities(loaded.expected, privateRoot);
    if (canonicalJson(sourceBefore) !== canonicalJson(sourceAfter) ||
        canonicalJson(privateBefore) !== canonicalJson(privateAfter)) {
      throw new Error("source or private artifact copy changed during canary");
    }
    const baseDisk = privateBefore.find(item => item.kind === 3);
    if (baseDisk === undefined || baseDisk.sha256 !==
        privateAfter.find(item => item.kind === 3)?.sha256) {
      throw new Error("base disk identity changed during canary");
    }
    process.stdout.write(`${canonicalJson(Object.freeze({ schema: "cadr-m6-devid-o2-canary-stage-v1",
      completed_guest_boundary: MAX_BOUNDARY.toString(), nonterminal: true, machine: Object.freeze({
        lifecycle: info.lifecycle,
        clock_slots_completed: info.clockSlotsCompleted.toString(),
        outstanding_request_id: info.outstandingRequestId.toString(),
        persistentStatus: info.persistentStatus, profile: info.profile,
      }),
      private_disk: Object.freeze({ fresh: true,
        instance_id: `m6-private-disk-${randomUUID()}`,
        base_sha256: baseDisk.sha256,
        overlay_kind: "fresh-in-memory-m4-block-one-overlay",
        overlay_initial_generation: "0",
        overlay_final_generation: result.overlayGeneration.toString(),
        base_write_authority: false }),
      exact_loop: Object.freeze({ batches: result.batches,
        host_transactions: result.hostTransactions }),
      frozen_input_schedule: loaded.schedule,
      artifacts_before: sourceBefore, artifacts_after: sourceAfter,
      private_artifacts_before: privateBefore,
      private_artifacts_after: privateAfter, m6_disk_evidence: evidence,
      base_disk_unchanged: true,
      wasm: Object.freeze({ byte_count: moduleBytes.byteLength, sha256: hash(moduleBytes) }),
    }))}\n`);
  } finally {
    const errors = []; if (client !== null) try { await client.close(); } catch (error) { errors.push(error); }
    if (service !== null) try { await service.discard(); } catch (error) { errors.push(error); }
    if (loaded !== null) try { await loaded.artifacts.close(); } catch (error) { errors.push(error); }
    if (errors.length === 1) throw errors[0]; if (errors.length > 1) throw new AggregateError(errors, "canary cleanup failed");
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch(error => { process.stderr.write(`${error?.stack ?? String(error)}\n`); process.exitCode = 1; });
}
