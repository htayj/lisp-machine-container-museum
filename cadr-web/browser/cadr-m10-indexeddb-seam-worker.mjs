import {
  CADR_M10_BASE_SHA256,
  cadrM10Sha256,
  parseCdrOvn1,
  serializeCdrOvn1,
  serializeCdrOvm1,
} from "../wasm/cadr-m10-persistence.mjs";
import { createCadrM10IndexedDbBackend } from "./cadr-m10-indexeddb.mjs";

let gate = null;

function page(seed) {
  return Uint8Array.from({ length: 1024 }, (_, index) => (seed + index * 29) & 255);
}

function bytes(value) { return Uint8Array.from(value); }

async function candidateFor(disk, binding) {
  const active = await disk.active();
  const writerEpoch = await disk.beginWriter();
  const generation = await disk.reserveGeneration(writerEpoch);
  const replacement = page(71); const pageHash = await cadrM10Sha256(replacement);
  const leafChildren = Array.from({ length: 256 }, () => new Uint8Array(32)); leafChildren[11] = pageHash;
  const leafBytes = await serializeCdrOvn1({ level: 0, prefix: 0n, children: leafChildren });
  const leaf = await parseCdrOvn1(leafBytes);
  const middleChildren = Array.from({ length: 256 }, () => new Uint8Array(32)); middleChildren[0] = leaf.hash;
  const middleBytes = await serializeCdrOvn1({ level: 1, prefix: 0n, children: middleChildren });
  const middle = await parseCdrOvn1(middleBytes);
  const rootChildren = Array.from({ length: 256 }, () => new Uint8Array(32)); rootChildren[0] = middle.hash;
  const rootBytes = await serializeCdrOvn1({ level: 2, prefix: 0n, children: rootChildren });
  const root = await parseCdrOvn1(rootBytes);
  const manifestBytes = await serializeCdrOvm1({ generation, parentGeneration: active.manifest.generation,
    entryCount: 1n, diskUuid: binding.diskUuid, baseSha256: binding.baseSha256,
    profileSha256: binding.profileSha256, artifactSetSha256: binding.artifactSetSha256,
    parentManifestSha256: active.manifest.hash, rootSha256: root.hash });
  return { writerEpoch, generation, active, replacement, root, manifestBytes,
    objects: { pages: [replacement], nodes: [leafBytes, middleBytes, rootBytes] } };
}

async function run(message) {
  const binding = { diskUuid: bytes(message.binding.diskUuid), baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: bytes(message.binding.profileSha256),
    artifactSetSha256: bytes(message.binding.artifactSetSha256) };
  let plan = null;
  const notifyTransaction = event => {
    if (message.seam === event.seam) {
      self.postMessage({ type: "seam", seam: event.seam });
    }
  };
  const backend = createCadrM10IndexedDbBackend({
    databasePrefix: message.databasePrefix,
    transactionHook: notifyTransaction,
    seamHook: async (event) => {
    if (message.mutateCaller === true && event.seam === "before-stage" && plan !== null) plan.objects.pages[0][0] ^= 0xff;
    if (message.seam === null || event.seam !== message.seam) return;
    self.postMessage({ type: "seam", seam: event.seam });
    await new Promise((resolve, reject) => { gate = { resolve, reject }; });
  } });
  try {
    const disk = message.existing === true
      ? await backend.reopenDisk(binding)
      : await backend.initializeDisk(binding);
    plan = await candidateFor(disk, binding);
    self.postMessage({ type: "ready", oldGeneration: plan.active.manifest.generation.toString(),
      oldHeadSeq: plan.active.head.headSeq.toString(), newGeneration: plan.generation.toString(),
      newHeadSeq: (plan.active.head.headSeq + 1n).toString(),
      oldRoot: Array.from(plan.active.manifest.rootSha256), newRoot: Array.from(plan.root.hash) });
    const result = await disk.commit({ writerEpoch: plan.writerEpoch, expectedHeadSeq: plan.active.head.headSeq,
      manifestBytes: plan.manifestBytes, objects: plan.objects });
    self.postMessage({ type: "done", result: { ...result, generation: result.generation.toString(),
      headSeq: result.headSeq.toString(), rootSha256: Array.from(result.rootSha256) } });
  } catch (error) {
    self.postMessage({ type: "done", error: { name: error?.name ?? "Error", message: error?.message ?? String(error) } });
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message?.type === "run") { void run(message); return; }
  if (gate !== null) {
    const current = gate; gate = null;
    if (message?.type === "abort") current.reject(new Error(`C-M10 browser campaign injected abort at ${message.seam}`));
    else current.resolve();
  }
};
