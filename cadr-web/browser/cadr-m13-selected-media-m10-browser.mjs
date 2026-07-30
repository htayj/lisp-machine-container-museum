/*
 * Browser-only composition witness for the selected M12/v7 worker, verified
 * System 303 media ingress, and real C-M10 IndexedDB bridge.  Its sources are
 * fixed local preservation inputs; no media bytes are bundled or tracked by
 * this probe.
 */
import {
  CADR_M13_PROTOCOL_VERSION,
  CADR_M13_SCHEDULER_SLICE_MAX_SLOTS,
  CadrM13BaseMediaBinding,
  CadrM13Shell,
  CadrM13StorageBoundary,
} from "./cadr-m13-shell.mjs";
import { createCadrM10Controller, createCadrM10WorkerDiskBridge } from "./cadr-m10-controller.mjs";
import { createCadrM10IndexedDbBackend } from "./cadr-m10-indexeddb.mjs";
import { CADR_M10_BASE_SHA256 } from "../wasm/cadr-m10-persistence.mjs";

const BASE_BYTES = 269562880;
const BASE_BLOCKS = 263245;
const BASE_SHA256 = "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
const status = document.querySelector("#cadr-m13-selected-media-m10-status");
const text = new TextEncoder();

const artifacts = Object.freeze([
  Object.freeze({ kind: 1, role: "cadr-web-303-profile", url: new URL("../profiles/cadr-web-303.ini.in", import.meta.url) }),
  Object.freeze({ kind: 2, role: "promh-microcode", url: new URL("../../l/sys/ubin/promh.mcr", import.meta.url) }),
  Object.freeze({ kind: 4, role: "promh-symbols", url: new URL("../../l/sys/ubin/promh.sym", import.meta.url) }),
  Object.freeze({ kind: 5, role: "ucadr-symbols", url: new URL("../../l/sys/ubin/ucadr.sym", import.meta.url) }),
]);
const baseUrl = new URL("../../l/usim/disk-sys-303-0.img", import.meta.url);
const wasmUrl = new URL("../build/cadr-web-m12-O2.wasm", import.meta.url);
const SELECTED_WASM_ROLE = "cadr-web-m12-o2-wasm";
const PROFILE_ID_MAGIC = text.encode("CADR-M13-SELECTED-PROFILE-v1\0");
const ARTIFACT_SET_ID_MAGIC = text.encode("CADR-M13-SELECTED-ARTIFACT-SET-v1\0");

function same(left, right) {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

async function sha256(value) {
  return hex(await sha256Bytes(value));
}

async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

function hex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function u32le(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error("selected-media identity field is not u32");
  }
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concatenate(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

/* These internal M10 binding identities are not historical identifiers. They
 * name this exact witness's loaded profile and five-artifact input closure so
 * a later M10 reopen under the same disk UUID can distinguish changed local
 * preservation input from the original witness binding. */
async function selectedWitnessIdentities(wasmBytes, bootArtifacts) {
  const profile = bootArtifacts.find(artifact => artifact.kind === 1);
  if (profile === undefined) throw new Error("selected-media profile artifact is absent");
  const profileRole = text.encode(profile.role);
  const profileSha256 = await sha256Bytes(concatenate([
    PROFILE_ID_MAGIC, u32le(profile.kind), u32le(profileRole.byteLength), profileRole,
    u32le(profile.bytes.byteLength), new Uint8Array(profile.bytes),
  ]));
  const entries = Object.freeze([
    Object.freeze({ kind: 0, role: SELECTED_WASM_ROLE, bytes: wasmBytes }),
    ...bootArtifacts,
  ]);
  const parts = [ARTIFACT_SET_ID_MAGIC, u32le(entries.length)];
  for (const entry of entries) {
    const role = text.encode(entry.role);
    const body = new Uint8Array(entry.bytes);
    parts.push(u32le(entry.kind), u32le(role.byteLength), role, u32le(body.byteLength),
      await sha256Bytes(body));
  }
  return Object.freeze({ profileSha256, artifactSetSha256: await sha256Bytes(concatenate(parts)) });
}

async function bytesFrom(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`selected artifact fetch failed (${response.status})`);
  return response.arrayBuffer();
}

async function selectedBaseRange(firstBlock, blockCount) {
  const start = firstBlock * 1024;
  const count = blockCount * 1024;
  const response = await fetch(baseUrl, { cache: "no-store",
    headers: { Range: `bytes=${start}-${start + count - 1}` } });
  const body = await response.arrayBuffer();
  if (response.status !== 206 || body.byteLength !== count ||
      response.headers.get("Content-Range") !== `bytes ${start}-${start + count - 1}/${BASE_BYTES}`) {
    throw new Error("selected base range response is not exact");
  }
  return body;
}

function request(shell, id, op, fields = {}) {
  return Object.freeze({ type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
    sessionId: shell.sessionId, id, op, ...fields });
}

async function run() {
  const selectedArtifacts = await Promise.all(artifacts.map(async artifact =>
    Object.freeze({ kind: artifact.kind, role: artifact.role, bytes: await bytesFrom(artifact.url) })));
  const bootArtifacts = Object.freeze(selectedArtifacts.map(artifact =>
    Object.freeze({ kind: artifact.kind, bytes: artifact.bytes })));
  const wasmBytes = await bytesFrom(wasmUrl);
  const identities = await selectedWitnessIdentities(wasmBytes, selectedArtifacts);
  const storage = new CadrM13StorageBoundary({
    async readBaseRange(value) {
      if (value.importId !== 1 || !Number.isSafeInteger(value.firstBlock) ||
          !Number.isSafeInteger(value.blockCount) || value.blockCount < 1 ||
          value.blockCount > 1024 || value.firstBlock + value.blockCount > BASE_BLOCKS) {
        throw new Error("M13 selected-base request is outside its fixed binding");
      }
      return Object.freeze({ bytes: await selectedBaseRange(value.firstBlock, value.blockCount) });
    },
  });
  const baseBinding = new CadrM13BaseMediaBinding({ storage });
  const prefix = `cadr-m13-selected-media-${Date.now().toString(36)}`;
  const backend = createCadrM10IndexedDbBackend({ databasePrefix: prefix });
  const binding = Object.freeze({
    diskUuid: crypto.getRandomValues(new Uint8Array(16)),
    baseSha256: CADR_M10_BASE_SHA256.slice(),
    profileSha256: identities.profileSha256,
    artifactSetSha256: identities.artifactSetSha256,
  });
  const worker = new Worker(new URL("../wasm/cadr-worker.js", import.meta.url), {
    type: "module", name: "cadr-m13-selected-media-m10-probe",
  });
  const lowerOperations = [];
  const postLower = worker.postMessage.bind(worker);
  worker.postMessage = (...argumentsValue) => {
    const [message] = argumentsValue;
    if (typeof message?.op === "string") lowerOperations.push(message.op);
    return postLower(...argumentsValue);
  };
  let replacements = 0;
  const controller = createCadrM10Controller({ backend, binding,
    readBasePage: firstBlock => baseBinding.readBlock(Number(firstBlock)),
    readBaseIdentity: async () => baseBinding.verifiedBaseIdentity(),
    replaceWorker: async () => { replacements += 1; worker.terminate(); },
  });
  const serviced = [];
  let reopenedController = null;
  const shell = new CadrM13Shell({ worker, baseMediaBinding: baseBinding,
    selectedBootArtifacts: bootArtifacts, m10Controller: controller,
    m10BridgeFactory: options => {
      const bridge = createCadrM10WorkerDiskBridge(options);
      return Object.freeze({ async serviceOnce() {
        const result = await bridge.serviceOnce(); serviced.push(result); return result;
      } });
    }, timeoutMs: 30000 });
  try {
    const bootstrap = await shell.submit(request(shell, 1, "bootstrap", {
      wasmBytes, wasmSha256: await sha256(wasmBytes),
    }));
    if (bootstrap.status !== 0) throw new Error(`selected Wasm bootstrap failed (${bootstrap.status})`);
    const mount = await shell.mountSelectedMediaWitness(1);
    if (baseBinding.state !== "MOUNTED" || mount.baseBytes !== BASE_BYTES ||
        mount.baseSha256 !== BASE_SHA256 ||
        !same(baseBinding.verifiedBaseIdentity(), CADR_M10_BASE_SHA256)) {
      throw new Error("selected media witness mount did not reach MOUNTED");
    }
    /* The M10 controller may only bind its selected base identity after the
     * witness retained the v7-accepted per-range verification records. */
    await controller.open({ initialize: true });
    const cold = await shell.submit(request(shell, 2, "machine-cold-power-on"));
    const boot = await shell.submit(request(shell, 3, "machine-boot"));
    if ([cold, boot].some(result => result.status !== 0)) {
      throw new Error("selected worker refused the mounted cold-boot sequence");
    }
    const visibility = await shell.submit(request(shell, 4, "machine-visibility", { hidden: false }));
    const start = await shell.submit(request(shell, 5, "machine-start"));
    if ([visibility, start].some(result => result.status !== 0)) {
      throw new Error("selected worker refused the required M5 visibility/start sequence");
    }
    let hostWaits = 0; let batches = 0; let nextId = 6;
    let waitSlice = null; let waitSliceIndex = -1;
    for (; batches < 300 && hostWaits === 0; batches += 1, nextId += 1) {
      const result = await shell.submit(request(shell, nextId, "machine-run", {
        clockSlots: CADR_M13_SCHEDULER_SLICE_MAX_SLOTS,
      }));
      if (result.status === 8) {
        hostWaits += 1;
        waitSlice = Object.freeze({ lifecycle: result.lifecycle,
          completedSlots: result.completedSlots.toString(),
          microinstructionsExecuted: result.microinstructionsExecuted.toString() });
        waitSliceIndex = lowerOperations.lastIndexOf("scheduler-run-v7-slice");
        continue;
      }
      if (result.status !== 0) throw new Error(`selected media batch failed (${JSON.stringify(result)})`);
    }
    const forbiddenRunOperations = lowerOperations.filter(operation =>
      ["run", "run-digest-batch", "run-digest-batch-v3", "run-digest-batch-m4", "scheduler-run"].includes(operation));
    if (forbiddenRunOperations.length !== 0) {
      throw new Error(`M13 emitted a forbidden lower run operation (${forbiddenRunOperations.join(",")})`);
    }
    if (hostWaits !== 1 || serviced.length !== 1 || replacements !== 0 ||
      controller.state !== "CLEAN" || serviced[0].operation !== "write" ||
      serviced[0].firstBlock !== 1n || serviced[0].blockCount !== 1 ||
      serviced[0].durable !== true || serviced[0].changed !== false) {
      throw new Error("selected M12/M10 host-request composition did not complete one real transaction");
    }
    const beforeReopen = await controller.readBlock(1n);
    const selectedBaseBlock1 = new Uint8Array(await selectedBaseRange(1, 1));
    if (!same(beforeReopen, selectedBaseBlock1)) {
      throw new Error("selected M10 no-change write unexpectedly changed block 1");
    }
    controller.close();
    let reopenReplacements = 0;
    reopenedController = createCadrM10Controller({ backend, binding,
      readBasePage: firstBlock => baseBinding.readBlock(Number(firstBlock)),
      readBaseIdentity: async () => baseBinding.verifiedBaseIdentity(),
      replaceWorker: async () => { reopenReplacements += 1; },
    });
    await reopenedController.open();
    const afterReopen = await reopenedController.readBlock(1n);
    if (reopenedController.state !== "CLEAN" || reopenReplacements !== 0 ||
        !same(beforeReopen, afterReopen)) {
      throw new Error("selected M10 block-1 readback did not survive a fresh-controller reopen");
    }
    const reopenReadback = Object.freeze({
      firstBlock: "1", byteCount: afterReopen.byteLength,
      sha256: await sha256(afterReopen), commitChanged: serviced[0].changed,
      matchesSelectedBase: same(afterReopen, selectedBaseBlock1),
      matchesBeforeClose: same(afterReopen, beforeReopen),
      controllerState: reopenedController.state, replacementCount: reopenReplacements,
    });
    return Object.freeze({ bootstrapStatus: bootstrap.status, mountStatus: 0,
      baseBindingState: baseBinding.state, coldStatus: cold.status, bootStatus: boot.status,
      visibilityStatus: visibility.status, startStatus: start.status,
      batches, hostWaits,
      waitSlice, waitSequence: Object.freeze(lowerOperations.slice(waitSliceIndex, waitSliceIndex + 3)),
      service: Object.freeze({ operation: serviced[0].operation,
        firstBlock: serviced[0].firstBlock.toString(), blockCount: serviced[0].blockCount,
        durable: serviced[0].durable === true, changed: serviced[0].changed }), controllerState: controller.state,
      reopenReadback,
      replacementCount: replacements, baseSha256: BASE_SHA256,
      baseBytes: BASE_BYTES, basePage0: same(await baseBinding.readBlock(0),
        new Uint8Array(await selectedBaseRange(0, 1))),
      baseIdentityBound: same(baseBinding.verifiedBaseIdentity(), CADR_M10_BASE_SHA256),
      profileSha256: hex(binding.profileSha256),
      artifactSetSha256: hex(binding.artifactSetSha256),
      forbiddenRunOperations: Object.freeze(forbiddenRunOperations),
      lowerOperations: Object.freeze(lowerOperations.slice()), });
  } finally {
    shell.dispose();
    try { reopenedController?.close(); } catch { /* reopened observer cleanup remains best effort */ }
    try { controller.close(); } catch { /* terminal controller cleanup remains best effort */ }
    await backend.deleteDisk(binding);
  }
}

try {
  globalThis.cadrM13SelectedMediaM10Harness = await run();
  status.textContent = "Selected M12 media mount and M10 host-request probe passed.";
} catch (error) {
  globalThis.cadrM13SelectedMediaM10Harness = Object.freeze({ error: String(error?.stack ?? error) });
  status.textContent = "Selected M12 media mount and M10 host-request probe failed.";
}
