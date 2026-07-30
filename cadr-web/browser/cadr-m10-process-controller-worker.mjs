import {
  CADR_M10_BASE_SHA256,
  cadrM10Sha256,
  hexBytes,
} from "../wasm/cadr-m10-persistence.mjs";
import {
  createCadrM10Controller,
  createCadrM10WorkerDiskBridge,
} from "./cadr-m10-controller.mjs";
import { createCadrM10IndexedDbBackend } from "./cadr-m10-indexeddb.mjs";

let armed = false;
let selectedSeam = null;
let oldRoot = null;
let barrier = null;

function blockAt(event) {
  if (!armed || event.seam !== selectedSeam) return;
  self.postMessage({ type: "kill-ready", seam: event.seam, oldRoot });
  /* This dedicated worker blocks before returning to IndexedDB. For the two
   * transaction probes, the transaction still owns an outstanding request.
   * Only the external process-group SIGKILL releases this barrier. */
  Atomics.wait(barrier, 0, 0);
  throw new Error("C-M10 process-kill barrier unexpectedly released");
}

async function run(message) {
  selectedSeam = message.seam;
  barrier = new Int32Array(message.barrier);
  const binding = {
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
    baseSha256: CADR_M10_BASE_SHA256,
    profileSha256: await cadrM10Sha256(
      new TextEncoder().encode("C-M10 process-kill profile")),
    artifactSetSha256: await cadrM10Sha256(
      new TextEncoder().encode("C-M10 process-kill artifacts")),
  };
  const backend = createCadrM10IndexedDbBackend({
    databasePrefix: message.prefix,
    seamHook: async event => blockAt(event),
    transactionHook: blockAt,
  });
  let guest = null; let nextId = 0;
  const pending = new Map();
  const attachGuest = target => {
    target.onmessage = event => {
      const waiter = pending.get(event.data.id);
      if (waiter !== undefined) {
        pending.delete(event.data.id); waiter.resolve(event.data.result);
      }
    };
    target.onerror = event => {
      for (const waiter of pending.values()) {
        waiter.reject(event.error ?? new Error(event.message));
      }
      pending.clear();
    };
  };
  const newGuest = () => {
    const target = new Worker("./cadr-m10-process-guest-worker.mjs",
      { type: "module" });
    attachGuest(target);
    return target;
  };
  guest = newGuest();
  const channel = {
    submit(operation) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        guest.postMessage({ id, operation });
      });
    },
  };
  const controller = createCadrM10Controller({
    backend, binding,
    readBaseIdentity: async () => {
      const response = await fetch("/cadr-m10-base-identity.json",
        { cache: "no-store" });
      if (!response.ok) throw new Error("base identity endpoint failed");
      const identity = await response.json();
      if (identity.byteLength !== 269562880 ||
          identity.sha256 !== hexBytes(CADR_M10_BASE_SHA256)) {
        throw new Error("base identity endpoint differs from selected base");
      }
      return CADR_M10_BASE_SHA256;
    },
    readBasePage: async lba => {
      const start = Number(lba * 1024n);
      const response = await fetch("/cadr-m10-base.img", {
        cache: "no-store", headers: { Range: `bytes=${start}-${start + 1023}` },
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (response.status !== 206 || bytes.byteLength !== 1024) {
        throw new Error("selected base range response is invalid");
      }
      return bytes;
    },
    replaceWorker: async () => {
      guest.terminate();
      guest = newGuest();
    },
  });
  await controller.open({ initialize: true });
  const exported = await controller.exportOverlay();
  oldRoot = JSON.parse(new TextDecoder().decode(exported)).body.root_sha256;
  armed = true;
  const bridge = createCadrM10WorkerDiskBridge({ controller, channel });
  await bridge.serviceOnce();
  self.postMessage({ type: "failed",
    error: "controller passed requested process-kill barrier" });
}

self.onmessage = event => {
  if (event.data?.type === "run") {
    void run(event.data).catch(error => self.postMessage({
      type: "failed", error: error?.stack ?? String(error),
    }));
  }
};
