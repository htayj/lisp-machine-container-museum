import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import {
  CADR_M10_BASE_SHA256,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../cadr-web/wasm/cadr-m10-persistence.mjs";
import {
  CADR_M10_CONTROLLER_IN_DOUBT,
  createCadrM10Controller,
  createCadrM10WorkerDiskBridge,
  parseCadrM10OverlayExport,
} from "../cadr-web/browser/cadr-m10-controller.mjs";

const hash = seed => Uint8Array.from({ length: 32 },
  (_, index) => (seed + index * 17) & 255);
const binding = {
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
  baseSha256: CADR_M10_BASE_SHA256,
  profileSha256: hash(2),
  artifactSetSha256: hash(3),
};
const basePath = process.env.CADR_M10_BASE_IMAGE ??
  new URL("../l/usim/disk-sys-303-0.img", import.meta.url);
const baseFile = await open(basePath, "r");
const observedBaseIdentity = new Uint8Array(await new Promise(
  (resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(basePath);
    stream.on("data", chunk => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(digest.digest()));
  }));
assert.deepEqual(observedBaseIdentity, CADR_M10_BASE_SHA256);
const basePage = async lba => {
  const output = new Uint8Array(1024);
  const result = await baseFile.read(output, 0, output.byteLength,
    Number(lba * 1024n));
  assert.equal(result.bytesRead, output.byteLength);
  return output;
};
const workerFixture = new URL(
  "./fixtures/cadr-m10-worker-channel.mjs", import.meta.url);

async function fakeBackend({ failCommit = false, failStage = false,
  compactGate = null, reopenGate = null } = {}) {
  const zeroChildren = Array.from({ length: 256 }, () => new Uint8Array(32));
  const rootBytes = await serializeCdrOvn1({
    level: 2, prefix: 0n, children: zeroChildren,
  });
  const root = await parseCdrOvn1(rootBytes);
  const genesisBytes = await serializeCdrOvm1({
    generation: 0n, parentGeneration: 0n, entryCount: 0n,
    diskUuid: binding.diskUuid, baseSha256: binding.baseSha256,
    profileSha256: binding.profileSha256,
    artifactSetSha256: binding.artifactSetSha256,
    rootSha256: root.hash,
  });
  let manifest = await parseCdrOvm1(genesisBytes);
  let headSeq = 1n; let writer = 0n; let activeWriter = 0n;
  let pending = 0n; let deleted = false;
  const pages = new Map();
  const nodes = new Map([[Buffer.from(root.hash).toString("hex"), rootBytes]]);
  let stageOrdinal = 0; let commitOrdinal = 0;

  const disk = {
    readOnly: false,
    close() {},
    async active() {
      return { manifest, head: { headSeq } };
    },
    async exportActiveClosure() {
      const reachableNodes = new Map(); const reachablePages = new Map();
      const visit = async (nodeHash, level) => {
        const key = Buffer.from(nodeHash).toString("hex");
        const nodeBytes = nodes.get(key);
        assert.notEqual(nodeBytes, undefined);
        const node = await parseCdrOvn1(nodeBytes);
        reachableNodes.set(key, nodeBytes);
        for (const child of node.children) {
          if (child.every(value => value === 0)) continue;
          if (level === 0) {
            const pageKey = Buffer.from(child).toString("hex");
            reachablePages.set(pageKey, pages.get(pageKey));
          } else await visit(child, level - 1);
        }
      };
      await visit(manifest.rootSha256, 2);
      return {
        generation: manifest.generation, headSeq,
        manifestSha256: manifest.hash.slice(),
        entryCount: manifest.entryCount,
        rootSha256: manifest.rootSha256.slice(),
        pages: [...reachablePages].map(([key, value]) =>
          ({ key, bytes: value.slice() })),
        nodes: [...reachableNodes].map(([key, value]) =>
          ({ key, bytes: value.slice() })),
      };
    },
    async beginWriter() {
      assert.equal(activeWriter, 0n);
      writer += 1n; activeWriter = writer; return writer;
    },
    async reserveGeneration(epoch) {
      assert.equal(epoch, writer); pending = manifest.generation + 1n;
      return pending;
    },
    async closeWriter(epoch) {
      assert.equal(epoch, activeWriter); activeWriter = 0n; pending = 0n;
    },
    async stage(objects) {
      stageOrdinal += 1;
      if (failStage) throw new Error("synthetic pre-guest staging failure");
      for (const page of objects.pages ?? []) {
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", page));
        pages.set(Buffer.from(digest).toString("hex"), page.slice());
      }
      for (const nodeBytes of objects.nodes ?? []) {
        const node = await parseCdrOvn1(nodeBytes);
        nodes.set(Buffer.from(node.hash).toString("hex"), nodeBytes.slice());
      }
    },
    async commit({ manifestBytes, objects }) {
      commitOrdinal += 1;
      if (failCommit) throw new Error("synthetic post-guest publication failure");
      await this.stage(objects);
      const next = await parseCdrOvm1(manifestBytes);
      assert.equal(next.generation, pending);
      manifest = next; headSeq += 1n; pending = 0n;
      activeWriter = 0n;
      return { durable: true, recoveredAfterFault: false,
        generation: manifest.generation, headSeq,
        rootSha256: manifest.rootSha256.slice() };
    },
    async compact({ writerEpoch }) {
      assert.equal(writerEpoch, activeWriter);
      if (compactGate !== null) await compactGate();
      return { removed: { pages: 0, nodes: 0, manifests: 0 },
        retained: { pages: pages.size, nodes: nodes.size, manifests: 1 } };
    },
  };
  return {
    initializeDisk: async () => disk,
    reopenDisk: async () => {
      if (reopenGate !== null) await reopenGate();
      pending = 0n; activeWriter = 0n; return disk;
    },
    deleteDisk: async () => { deleted = true; },
    inspect: () => ({ stageOrdinal, commitOrdinal, manifest, headSeq,
      activeWriter, deleted }),
  };
}

const backend = await fakeBackend();
const states = [];
const wrongBaseController = createCadrM10Controller({
  backend: await fakeBackend(), binding, readBasePage: basePage,
  readBaseIdentity: async () => hash(99),
  replaceWorker: async () => {},
});
await assert.rejects(() => wrongBaseController.open({ initialize: true }),
  /base callback identity differs/);
const controller = createCadrM10Controller({
  backend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
  stateChanged: state => states.push(state),
});
await controller.open({ initialize: true });
let guestCompletedAfterStage = false;
const changed = Uint8Array.from({ length: 1024 },
  (_, index) => (index * 7 + 9) & 255);
const committed = await controller.commitWrites([
  { lba: 1n, bytes: changed },
], { completeGuest: async () => {
  guestCompletedAfterStage = backend.inspect().stageOrdinal > 0 &&
    backend.inspect().commitOrdinal === 0;
} });
assert.equal(committed.changed, true);
assert.equal(guestCompletedAfterStage, true,
  "immutable staging must precede guest completion and activation");
assert.deepEqual(await controller.readBlock(1n), changed);

const archiveBytes = await controller.exportOverlay();
const archive = await parseCadrM10OverlayExport(archiveBytes);
assert.equal(archive.entryCount, 1n);
assert.deepEqual(archive.rootSha256, committed.rootSha256);
const mutated = archiveBytes.slice(); mutated[mutated.length - 2] ^= 1;
await assert.rejects(() => parseCadrM10OverlayExport(mutated),
  /canonical|digest|JSON/);

const discarded = await controller.discard();
assert.equal(discarded.changed, true);
assert.deepEqual(await controller.readBlock(1n), await basePage(1n));
const imported = await controller.importOverlay(archiveBytes);
assert.equal(imported.changed, true);
assert.deepEqual(await controller.readBlock(1n), changed);
assert.equal((await controller.compact()).retained.manifests, 1);

{
  const readDescriptor = new Uint8Array(16);
  const readView = new DataView(readDescriptor.buffer);
  readView.setBigUint64(0, 1n, true);
  readView.setUint32(8, 1, true);
  readView.setUint32(12, 1024, true);
  const writeDescriptor = new Uint8Array(24);
  const writeView = new DataView(writeDescriptor.buffer);
  writeView.setBigUint64(0, 82n, true);
  writeView.setBigUint64(8, 3n, true);
  writeView.setUint32(16, 1, true);
  writeView.setUint32(20, 1024, true);
  const requests = [{
    status: 0, request: {
      operation: 1, generation: 1n, requestId: 81n,
      completionByteCount: 1024n,
    }, descriptor: readDescriptor.buffer,
    requestPayload: new ArrayBuffer(0),
  }, {
    status: 0, request: {
      operation: 2, generation: 1n, requestId: 82n,
      completionByteCount: 0n,
    }, descriptor: writeDescriptor.buffer,
    requestPayload: changed.slice().buffer,
  }];
  const completions = [];
  const bridge = createCadrM10WorkerDiskBridge({
    controller,
    channel: {
      async submit(operation) {
        if (operation.op === "host-next-request") return requests.shift();
        completions.push(operation);
        return { status: 0 };
      },
    },
  });
  assert.equal((await bridge.serviceOnce()).operation, "read");
  assert.deepEqual(new Uint8Array(completions[0].bytes), changed);
  assert.equal((await bridge.serviceOnce()).operation, "write");
  assert.equal(completions[1].requestId, 82n);
  assert.deepEqual(await controller.readBlock(3n), changed);
}

const cloneBackend = await fakeBackend();
const cloneBinding = { ...binding,
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 41) };
await assert.rejects(() => controller.cloneTo({
  backend: cloneBackend, binding: cloneBinding,
}), /replacement callback is required/);
const clone = await controller.cloneTo({
  backend: cloneBackend, binding: cloneBinding,
  replaceWorker: async () => {},
});
assert.deepEqual(await clone.readBlock(1n), changed);
clone.close();

const failedCloneBackend = await fakeBackend({ failStage: true });
await assert.rejects(() => controller.cloneTo({
  backend: failedCloneBackend,
  binding: { ...cloneBinding,
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 61) },
  replaceWorker: async () => {},
}), /staging failure/);
assert.equal(failedCloneBackend.inspect().deleted, true,
  "failed clone must delete its partially initialized destination");

let discardedWorker = 0;
const stagingBackend = await fakeBackend({ failStage: true });
const stagingFailure = createCadrM10Controller({
  backend: stagingBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { discardedWorker += 1; },
});
await stagingFailure.open({ initialize: true });
await assert.rejects(() => stagingFailure.commitWrites([
  { lba: 2n, bytes: changed },
], { completeGuest: async () => {
  throw new Error("guest must not advance after failed staging");
} }), /staging failure/);
assert.equal(stagingFailure.state, "CLEAN");
assert.equal(discardedWorker, 0,
  "pre-guest staging failure reopens durable state without discarding worker");

const failingBackend = await fakeBackend({ failCommit: true });
const uncertain = createCadrM10Controller({
  backend: failingBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { discardedWorker += 1; },
});
await uncertain.open({ initialize: true });
await assert.rejects(() => uncertain.commitWrites([
  { lba: 2n, bytes: changed },
], { completeGuest: async () => {} }), /publication failure/);
assert.equal(uncertain.state, CADR_M10_CONTROLLER_IN_DOUBT);
assert.equal(discardedWorker, 1);
await uncertain.recover();

let responseLossReplacements = 0;
const responseLossBackend = await fakeBackend();
const responseLoss = createCadrM10Controller({
  backend: responseLossBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => { responseLossReplacements += 1; },
});
await responseLoss.open({ initialize: true });
await assert.rejects(() => responseLoss.commitWrites([
  { lba: 4n, bytes: changed },
], { completeGuest: async () => {
  throw new Error("synthetic lost host-complete response");
} }), /lost host-complete/);
assert.equal(responseLoss.state, CADR_M10_CONTROLLER_IN_DOUBT);
assert.equal(responseLossReplacements, 1,
  "ambiguous host-complete response loss must replace the worker");
await responseLoss.recover();

{
  let worker = new Worker(workerFixture, {
    type: "module", workerData: { loseCompletionResponse: true },
  });
  let sequence = 0;
  const pending = new Map();
  const bind = current => {
    current.on("message", message => {
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id); waiter.resolve(message.result);
      }
    });
    current.on("exit", code => {
      for (const waiter of pending.values()) {
        waiter.reject(new Error(`real worker exited before response (${code})`));
      }
      pending.clear();
    });
  };
  bind(worker);
  const channel = {
    submit(operation) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, operation });
      });
    },
  };
  const firstThread = (await channel.submit({ op: "ping" })).threadId;
  let replacements = 0;
  const realWorkerController = createCadrM10Controller({
    backend: await fakeBackend(), binding, readBasePage: basePage,
    readBaseIdentity: async () => observedBaseIdentity,
    replaceWorker: async () => {
      await worker.terminate();
      worker = new Worker(workerFixture, {
        type: "module", workerData: { loseCompletionResponse: false },
      });
      bind(worker); replacements += 1;
    },
  });
  await realWorkerController.open({ initialize: true });
  const realBridge = createCadrM10WorkerDiskBridge({
    controller: realWorkerController, channel,
  });
  await assert.rejects(() => realBridge.serviceOnce(),
    /real worker exited before response/);
  assert.equal(realWorkerController.state, CADR_M10_CONTROLLER_IN_DOUBT);
  assert.equal(replacements, 1);
  const replacementThread = (await channel.submit({ op: "ping" })).threadId;
  assert.notEqual(replacementThread, firstThread,
    "ambiguous completion must use a replacement worker process");
  await realWorkerController.recover();
  realWorkerController.close();
  await worker.terminate();
}

let releaseCompact;
const compactGate = new Promise(resolve => { releaseCompact = resolve; });
const raceBackend = await fakeBackend({
  compactGate: async () => compactGate,
});
const raceController = createCadrM10Controller({
  backend: raceBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
});
await raceController.open({ initialize: true });
const compaction = raceController.compact();
await Promise.resolve();
await assert.rejects(() => raceController.commitWrites([
  { lba: 5n, bytes: changed },
]), /another persistence operation/);
await assert.rejects(() => raceController.recover(),
  /another persistence operation/);
assert.throws(() => raceController.close(),
  /another persistence operation/);
releaseCompact();
await compaction;

let releaseGuest;
const guestGate = new Promise(resolve => { releaseGuest = resolve; });
const racingCommit = raceController.commitWrites([
  { lba: 6n, bytes: changed },
], { completeGuest: async () => guestGate });
while (raceBackend.inspect().stageOrdinal === 0) {
  await new Promise(resolve => setTimeout(resolve, 0));
}
await assert.rejects(() => raceController.compact(),
  /another persistence operation/);
await assert.rejects(() => raceController.recover(),
  /another persistence operation/);
assert.throws(() => raceController.close(),
  /another persistence operation/);
releaseGuest();
await racingCommit;

let releaseRecovery;
const recoveryGate = new Promise(resolve => { releaseRecovery = resolve; });
const recoveringBackend = await fakeBackend({
  reopenGate: async () => recoveryGate,
});
const recoveringController = createCadrM10Controller({
  backend: recoveringBackend, binding, readBasePage: basePage,
  readBaseIdentity: async () => observedBaseIdentity,
  replaceWorker: async () => {},
});
await recoveringController.open({ initialize: true });
const recovery = recoveringController.recover();
await Promise.resolve();
await assert.rejects(() => recoveringController.commitWrites([
  { lba: 8n, bytes: changed },
]), /another persistence operation/);
assert.throws(() => recoveringController.close(),
  /another persistence operation/);
releaseRecovery();
await recovery;

controller.close(); stagingFailure.close(); uncertain.close();
responseLoss.close(); raceController.close();
recoveringController.close();
await baseFile.close();
assert.ok(states.includes("CLEAN"));
console.log("cadr M10 durable controller tests passed");
