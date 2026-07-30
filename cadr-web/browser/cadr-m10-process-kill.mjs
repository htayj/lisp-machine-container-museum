import {
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS,
  createCadrM10IndexedDbBackend,
} from "./cadr-m10-indexeddb.mjs";
import {
  CADR_M10_BASE_SHA256,
  cadrM10Sha256,
  hexBytes,
} from "../wasm/cadr-m10-persistence.mjs";

const query = new URLSearchParams(location.search);
const action = query.get("action");
const seam = query.get("seam");
const prefix = query.get("prefix");
const binding = {
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
  baseSha256: CADR_M10_BASE_SHA256,
  profileSha256: await cadrM10Sha256(
    new TextEncoder().encode("C-M10 process-kill profile")),
  artifactSetSha256: await cadrM10Sha256(
    new TextEncoder().encode("C-M10 process-kill artifacts")),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finish(status, value) {
  document.body.dataset.status = status;
  document.body.textContent = JSON.stringify(value);
}

async function prepare() {
  const allSeams = [...CADR_M10_INDEXEDDB_DURABLE_SEAMS,
    ...CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS];
  assert(allSeams.includes(seam),
    "unknown process-kill seam");
  assert(typeof prefix === "string" && prefix.length > 0,
    "process-kill prefix is missing");
  assert(crossOriginIsolated && typeof SharedArrayBuffer === "function",
    "process-kill barrier requires cross-origin isolation");
  const barrier = new SharedArrayBuffer(4);
  const worker = new Worker("./cadr-m10-process-controller-worker.mjs",
    { type: "module" });
  worker.onerror = event => finish("failed",
    { error: event.error?.stack ?? event.message });
  worker.onmessage = event => {
    if (event.data?.type === "kill-ready") {
      finish("kill-ready", {
        seam: event.data.seam, oldRoot: event.data.oldRoot,
      });
    } else if (event.data?.type === "failed") {
      finish("failed", { error: event.data.error });
    }
  };
  worker.postMessage({ type: "run", seam, prefix, barrier });
}

async function verify() {
  const expectedOld = query.get("old");
  assert(/^[0-9a-f]{64}$/.test(expectedOld ?? ""),
    "process-kill expected old root is missing");
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const disk = await backend.reopenDisk(binding);
  const active = await disk.active();
  const outcome = active.manifest.generation === 0n ? "old" : "new";
  const expected = seam === "head-transaction-outstanding" ?
    ["old", "new"] :
    (CADR_M10_INDEXEDDB_DURABLE_SEAMS.indexOf(seam) >=
      CADR_M10_INDEXEDDB_DURABLE_SEAMS.indexOf("after-head-activation") ?
      ["new"] : ["old"]);
  assert(expected.includes(outcome) &&
    active.head.headSeq === (outcome === "new" ? 2n : 1n) &&
    (outcome === "new" ?
      hexBytes(active.manifest.rootSha256) !== expectedOld :
      hexBytes(active.manifest.rootSha256) === expectedOld),
  "external process kill selected a mixed or wrong generation");
  disk.close();
  finish("ok", {
    seam, outcome,
    generation: active.manifest.generation.toString(),
    headSeq: active.head.headSeq.toString(),
  });
}

try {
  if (action === "prepare") await prepare();
  else if (action === "verify") await verify();
  else throw new Error("process-kill action must be prepare or verify");
} catch (error) {
  finish("failed", { error: error?.stack ?? String(error) });
}
