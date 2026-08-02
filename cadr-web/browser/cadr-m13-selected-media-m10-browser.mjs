/*
 * Browser-only public-v8 composition probe for the selected M13 ABI1.11 worker,
 * verified System 303 media ingress, and real C-M10 IndexedDB bridge. Its
 * sources are fixed local preservation inputs; no media bytes are bundled or
 * tracked by this probe.
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
import { CADR_M10_BASE_SHA256, cadrM10Sha256 } from "../wasm/cadr-m10-persistence.mjs";
import { parseCdrM10W1, serializeCdrM10W1 } from "../wasm/cadr-m10-wrapper.mjs";

const BASE_BYTES = 269562880;
const BASE_BLOCKS = 263245;
const BASE_SHA256 = "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
const SELECTED_WASM_SHA256 = "11794b191dd355e6577133f293b591f065bb695b07ff0b3c41c2597c8c6bcd35";
const status = document.querySelector("#cadr-m13-selected-media-m10-status");
const text = new TextEncoder();

const artifacts = Object.freeze([
  Object.freeze({ kind: 1, role: "cadr-web-303-profile", url: new URL("../profiles/cadr-web-303.ini.in", import.meta.url) }),
  Object.freeze({ kind: 2, role: "promh-microcode", url: new URL("../../l/sys/ubin/promh.mcr", import.meta.url) }),
  Object.freeze({ kind: 4, role: "promh-symbols", url: new URL("../../l/sys/ubin/promh.sym", import.meta.url) }),
  Object.freeze({ kind: 5, role: "ucadr-symbols", url: new URL("../../l/sys/ubin/ucadr.sym", import.meta.url) }),
]);
const baseUrl = new URL("../../l/usim/disk-sys-303-0.img", import.meta.url);
const wasmUrl = new URL("../build/cadr-web-m13-audio-O2.wasm", import.meta.url);
const SELECTED_WASM_ROLE = "cadr-web-m13-audio-o2-wasm";
const PROFILE_ID_MAGIC = text.encode("CADR-M13-SELECTED-PROFILE-v1\0");
const ARTIFACT_SET_ID_MAGIC = text.encode("CADR-M13-SELECTED-ARTIFACT-SET-v1\0");
const TEST_ADAPTER_PROFILE = "M13-E27-CDRM10W1-DISPATCH-ADAPTER-v1";
const SNAP_PROFILE = Uint8Array.from(
  "1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a"
    .match(/../g), value => Number.parseInt(value, 16));
const SNAP_ARTIFACTS = Uint8Array.from(
  "e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941"
    .match(/../g), value => Number.parseInt(value, 16));

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

async function syntheticCdrM10W1(binding) {
  const directoryOffset = 264; const directoryBytes = 10 * 64;
  const payloadOffset = directoryOffset + directoryBytes;
  const raw = new Uint8Array(payloadOffset + 32); const rawView = new DataView(raw.buffer);
  raw.set(text.encode("CDRSNAP1"), 0);
  rawView.setUint16(8, 1, true); rawView.setUint16(10, 2, true);
  rawView.setUint32(12, 264, true); rawView.setUint32(20, 10, true);
  rawView.setUint32(24, 64, true); rawView.setBigUint64(32, BigInt(raw.byteLength), true);
  rawView.setBigUint64(40, 264n, true); rawView.setBigUint64(48, BigInt(directoryBytes), true);
  rawView.setBigUint64(56, BigInt(payloadOffset), true); rawView.setUint32(64, 1, true);
  rawView.setBigUint64(88, 7n, true); raw.set(SNAP_PROFILE, 104); raw.set(SNAP_ARTIFACTS, 136);
  const emptyHash = await cadrM10Sha256(new Uint8Array());
  for (let index = 0; index < 10; index += 1) {
    const offset = directoryOffset + index * 64;
    rawView.setUint32(offset, index + 1, true); rawView.setUint32(offset + 4, 1, true);
    rawView.setBigUint64(offset + 8, BigInt(payloadOffset), true);
    raw.set(emptyHash, offset + 32);
  }
  raw.set(await cadrM10Sha256(raw.subarray(directoryOffset, payloadOffset)), 232);
  raw.set(await cadrM10Sha256(raw.subarray(0, raw.byteLength - 32)), raw.byteLength - 32);
  const inner = new Uint8Array(104 + raw.byteLength); const innerView = new DataView(inner.buffer);
  inner.set(text.encode("CDRM5WK1"), 0); innerView.setUint32(8, 3, true);
  innerView.setBigUint64(16, BigInt(raw.byteLength), true); inner.set(raw, 104);
  const digestInput = new Uint8Array(72 + raw.byteLength);
  digestInput.set(inner.subarray(0, 72)); digestInput.set(raw, 72);
  inner.set(await cadrM10Sha256(digestInput), 72);
  const semanticValidator = async () => true;
  return serializeCdrM10W1({ diskUuid: binding.diskUuid,
    snapshotUuid: Uint8Array.from({ length: 16 }, (_, index) => index + 1),
    durableGeneration: 7n, headSeq: 8n,
    manifestSha256: await cadrM10Sha256(text.encode("E27 synthetic manifest")),
    rootSha256: await cadrM10Sha256(text.encode("E27 synthetic root")),
    baseSha256: CADR_M10_BASE_SHA256, profileSha256: binding.profileSha256,
    inner }, { validateInnerSnapshot: semanticValidator });
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

function selectedBaseImportResult() {
  return Object.freeze({ role: "system-303-base", byteCount: BigInt(BASE_BYTES),
    sha256: BASE_SHA256, blockBytes: 1024, blockCount: BASE_BLOCKS });
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
  let controller = null;
  let importOpen = false;
  let importNextOffset = 0;
  let exportState = null;
  let restoreState = null;
  let diskInitialized = false;
  const sessionToken = 1n;
  let observedHeadSeq = 0n;
  const storage = new CadrM13StorageBoundary({
    async beginBaseImport(value) {
      if (value.role !== "system-303-base" || value.byteCount !== BASE_BYTES ||
          value.sha256 !== BASE_SHA256 || importOpen) {
        throw new Error("M13 selected-base import begin differs from its fixed profile");
      }
      importOpen = true; importNextOffset = 0;
      return Object.freeze({ importId: 1, nextOffset: 0n });
    },
    async appendBaseImport(value) {
      const expected = await selectedBaseRange(Math.floor(importNextOffset / 1024),
        value.bytes.byteLength / 1024);
      if (!importOpen || value.importId !== 1 || value.offset !== BigInt(importNextOffset) ||
          !same(new Uint8Array(value.bytes), new Uint8Array(expected)) ||
          value.chunkSha256 !== await sha256(value.bytes)) {
        throw new Error("M13 selected-base import chunk differs from its fixed range");
      }
      importNextOffset += value.bytes.byteLength;
      return Object.freeze({ importId: 1, nextOffset: BigInt(importNextOffset),
        acceptedBytes: value.bytes.byteLength });
    },
    async finishBaseImport(value) {
      if (!importOpen || value.importId !== 1 || importNextOffset !== BASE_BYTES) {
        throw new Error("M13 selected-base import did not receive the complete fixed image");
      }
      importOpen = false; return selectedBaseImportResult();
    },
    async readBaseRange(value) {
      if (value.importId !== 1 || !Number.isSafeInteger(value.firstBlock) ||
          !Number.isSafeInteger(value.blockCount) || value.blockCount < 1 ||
          value.blockCount > 1024 || value.firstBlock + value.blockCount > BASE_BLOCKS) {
        throw new Error("M13 selected-base request is outside its fixed binding");
      }
      return Object.freeze({ bytes: await selectedBaseRange(value.firstBlock, value.blockCount) });
    },
    async reopenDisk(value) {
      if (controller === null || value.createIfMissing !== true ||
          value.diskUuid !== hex(binding.diskUuid) || value.baseSha256 !== BASE_SHA256 ||
          value.profileSha256 !== hex(binding.profileSha256) ||
          value.artifactSetSha256 !== hex(binding.artifactSetSha256)) {
        throw new Error("M13 selected M10 reopen differs from its mounted binding");
      }
      await controller.open({ initialize: !diskInitialized });
      diskInitialized = true;
      return Object.freeze({ mounted: "selected-m10-controller", sessionToken,
        state: "CLEAN", readOnly: false, generation: 0n, headSeq: observedHeadSeq });
    },
    async openExport(value) {
      if (value.sessionToken !== sessionToken || value.expectedHeadSeq !== observedHeadSeq ||
          exportState !== null) throw new Error("M13 selected export authority differs");
      /* E27 test adapter only: this is one CDRM10W1 byte stream, not the
       * normative pinned-object m10-export record protocol. */
      const bytes = await syntheticCdrM10W1(binding);
      exportState = { bytes: new Uint8Array(bytes), offset: 0 };
      return Object.freeze({ exportId: 1, byteCount: BigInt(bytes.byteLength),
        sha256: await sha256(bytes) });
    },
    async nextExport(value) {
      if (exportState === null || value.exportId !== 1n || value.maxBytes < 1 ||
          value.maxBytes > 1048576) throw new Error("M13 selected export cursor differs");
      const first = exportState.offset;
      const last = Math.min(exportState.bytes.byteLength, first + value.maxBytes);
      const bytes = exportState.bytes.slice(first, last).buffer;
      exportState.offset = last;
      return Object.freeze({ exportId: 1, offset: BigInt(first), bytes,
        nextOffset: BigInt(last), eof: last === exportState.bytes.byteLength });
    },
    async closeExport(value) {
      if (exportState === null || value.exportId !== 1n) {
        throw new Error("M13 selected export close differs");
      }
      exportState = null; return Object.freeze({ closed: true });
    },
    async beginSnapshotRestore(value) {
      if (restoreState !== null) throw new Error("M13 selected restore is already active");
      restoreState = { byteCount: Number(value.byteCount), sha256: value.snapshotSha256,
        offset: 0, chunks: [] };
      return Object.freeze({ restoreId: 1, nextOffset: 0n });
    },
    async appendSnapshotRestore(value) {
      if (restoreState === null || value.restoreId !== 1n ||
          value.offset !== restoreState.offset ||
          value.chunkSha256 !== await sha256(value.bytes)) {
        throw new Error("M13 selected restore chunk differs");
      }
      const bytes = new Uint8Array(value.bytes).slice();
      restoreState.chunks.push(bytes); restoreState.offset += bytes.byteLength;
      return Object.freeze({ restoreId: 1, nextOffset: BigInt(restoreState.offset) });
    },
    async finishSnapshotRestore(value) {
      if (restoreState === null || value.restoreId !== 1n ||
          restoreState.offset !== restoreState.byteCount) {
        throw new Error("M13 selected restore length differs");
      }
      const candidate = concatenate(restoreState.chunks).buffer;
      const expected = restoreState.sha256; restoreState = null;
      if (await sha256(candidate) !== expected) throw new Error("M13 selected restore digest differs");
      const parsed = await parseCdrM10W1(candidate, {
        validateInnerSnapshot: async () => true,
      });
      return Object.freeze({ roundtrip: true, adopted: false,
        archiveSha256: parsed.sha256 });
    },
    async abortSnapshotRestore(value) {
      if (restoreState === null || value.restoreId !== 1n) {
        throw new Error("M13 selected restore abort differs");
      }
      restoreState = null; return Object.freeze({ aborted: true });
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
  let observedHostCompleteLifecycle = null;
  worker.addEventListener("message", event => {
    if (event.data?.op === "host-complete" && event.data?.status === 0) {
      observedHostCompleteLifecycle = event.data.lifecycle ?? null;
    }
  });
  const lowerOperations = [];
  const postLower = worker.postMessage.bind(worker);
  worker.postMessage = (...argumentsValue) => {
    const [message] = argumentsValue;
    if (typeof message?.op === "string") lowerOperations.push(message.op);
    return postLower(...argumentsValue);
  };
  let replacements = 0;
  controller = createCadrM10Controller({ backend, binding,
    readBasePage: firstBlock => baseBinding.readBlock(Number(firstBlock)),
    readBaseIdentity: async () => baseBinding.verifiedBaseIdentity(),
    replaceWorker: async () => { replacements += 1; worker.terminate(); },
  });
  const serviced = [];
  let reopenedController = null;
  const shell = new CadrM13Shell({ worker, storage, baseMediaBinding: baseBinding,
    selectedBootArtifacts: bootArtifacts, selectedWasmSha256: SELECTED_WASM_SHA256,
    m10Controller: controller,
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
    let nextId = 2;
    const importBegin = await shell.submit(request(shell, nextId++, "base-import-begin", {
      role: "system-303-base", byteCount: BASE_BYTES, sha256: BASE_SHA256,
    }));
    if (importBegin.status !== 0 || importBegin.result?.importId !== 1) {
      throw new Error("public selected-base import did not begin");
    }
    let importChunks = 0;
    for (let firstBlock = 0; firstBlock < BASE_BLOCKS;) {
      const blockCount = Math.min(1024, BASE_BLOCKS - firstBlock);
      const bytes = await selectedBaseRange(firstBlock, blockCount);
      const append = await shell.submit(request(shell, nextId++, "base-import-chunk", {
        importId: 1, offset: BigInt(firstBlock) * 1024n, bytes,
        chunkSha256: await sha256(bytes),
      }));
      if (append.status !== 0) throw new Error(`public selected-base import chunk failed (${append.status})`);
      firstBlock += blockCount; importChunks += 1;
    }
    const importFinish = await shell.submit(request(shell, nextId++, "base-import-finish", { importId: 1 }));
    if (importFinish.status !== 0) throw new Error(`public selected-base import finish failed (${importFinish.status})`);
    const mounted = await shell.submit(request(shell, nextId++, "base-media-mount", { importId: 1 }));
    if (mounted.status !== 0) throw new Error(`public selected media mount failed (${mounted.status})`);
    const mount = mounted.result;
    if (baseBinding.state !== "MOUNTED" || mount.baseBytes !== BASE_BYTES ||
        mount.baseSha256 !== BASE_SHA256 ||
        !same(baseBinding.verifiedBaseIdentity(), CADR_M10_BASE_SHA256)) {
      throw new Error("selected media witness mount did not reach MOUNTED");
    }
    /* A public M10 reopen follows the v7-verified base mount. The storage
     * adapter owns the selected controller, but no caller storage capability
     * crosses the v8 port. */
    const reopened = await shell.submit(request(shell, nextId++, "m10-reopen", {
      diskUuid: hex(binding.diskUuid), baseSha256: BASE_SHA256,
      profileSha256: hex(binding.profileSha256), artifactSetSha256: hex(binding.artifactSetSha256),
      createIfMissing: true,
    }));
    if (reopened.status !== 0 || controller.status().state !== "CLEAN" ||
        controller.status().readOnly) {
      throw new Error("public selected M10 reopen did not create a clean writable session");
    }
    const cold = await shell.submit(request(shell, nextId++, "machine-cold-power-on"));
    const boot = await shell.submit(request(shell, nextId++, "machine-boot"));
    if ([cold, boot].some(result => result.status !== 0)) {
      throw new Error("selected worker refused the mounted cold-boot sequence");
    }
    const visibility = await shell.submit(request(shell, nextId++, "machine-visibility", { hidden: false }));
    const start = await shell.submit(request(shell, nextId++, "machine-start"));
    if ([visibility, start].some(result => result.status !== 0)) {
      throw new Error("selected worker refused the required M5 visibility/start sequence");
    }
    let hostWaits = 0; let batches = 0;
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
    if (observedHostCompleteLifecycle !== "RUNNING") {
      throw new Error("selected worker did not remain RUNNING after host completion");
    }
    const beforeReopen = await controller.readBlock(1n);
    const selectedBaseBlock1 = new Uint8Array(await selectedBaseRange(1, 1));
    if (!same(beforeReopen, selectedBaseBlock1)) {
      throw new Error("selected M10 no-change write unexpectedly changed block 1");
    }
    controller.close();
    const noChangeReopen = await shell.submit(request(shell, nextId++, "m10-reopen", {
      diskUuid: hex(binding.diskUuid), baseSha256: BASE_SHA256,
      profileSha256: hex(binding.profileSha256), artifactSetSha256: hex(binding.artifactSetSha256),
      createIfMissing: true,
    }));
    const afterReopen = await controller.readBlock(1n);
    if (noChangeReopen.status !== 0 || controller.state !== "CLEAN" || replacements !== 0 ||
        !same(beforeReopen, afterReopen)) {
      throw new Error("selected M10 block-1 readback did not survive public reopen");
    }
    const reopenReadback = Object.freeze({
      firstBlock: "1", byteCount: afterReopen.byteLength,
      sha256: await sha256(afterReopen), commitChanged: serviced[0].changed,
      matchesSelectedBase: same(afterReopen, selectedBaseBlock1),
      matchesBeforeClose: same(afterReopen, beforeReopen),
      controllerState: controller.state, replacementCount: replacements,
      publicReopenStatus: noChangeReopen.status,
    });

    /* This write is deliberately synthetic. It does not come from the selected
     * guest: it probes only the already public-mounted controller's changed-
     * overlay read/reopen behavior without modifying the base input. The later
     * public operation names dispatch to a test-only CDRM10W1 roundtrip adapter;
     * they are not normative export or composite restore implementations. */
    const syntheticPage = selectedBaseBlock1.slice(); syntheticPage[0] ^= 0xff;
    const syntheticWrite = await controller.commitWrites([{ lba: 1n, bytes: syntheticPage }]);
    observedHeadSeq = syntheticWrite.headSeq;
    const afterSyntheticWrite = await controller.readBlock(1n);
    if (!syntheticWrite.changed || !same(afterSyntheticWrite, syntheticPage)) {
      throw new Error("synthetic changed overlay write did not read back");
    }
    controller.close();
    const changedReopen = await shell.submit(request(shell, nextId++, "m10-reopen", {
      diskUuid: hex(binding.diskUuid), baseSha256: BASE_SHA256,
      profileSha256: hex(binding.profileSha256), artifactSetSha256: hex(binding.artifactSetSha256),
      createIfMissing: true,
    }));
    const afterChangedReopen = await controller.readBlock(1n);
    if (changedReopen.status !== 0 || !same(afterChangedReopen, syntheticPage)) {
      throw new Error("synthetic changed overlay did not survive public reopen");
    }

    const exportOpen = await shell.submit(request(shell, nextId++, "m10-export-open", {
      sessionToken, expectedHeadSeq: observedHeadSeq,
    }));
    if (exportOpen.status !== 0 || exportOpen.result?.exportId !== 1) {
      throw new Error("public selected overlay export did not open");
    }
    const archiveChunks = []; let exportChunkCount = 0;
    while (true) {
      const part = await shell.submit(request(shell, nextId++, "m10-export-next", {
        exportId: 1n, maxBytes: 1048576,
      }));
      if (part.status !== 0) throw new Error(`public selected overlay export chunk failed (${part.status}:${part.reason})`);
      archiveChunks.push(new Uint8Array(part.result.bytes)); exportChunkCount += 1;
      if (part.result.eof) break;
    }
    const exportClose = await shell.submit(request(shell, nextId++, "m10-export-close", { exportId: 1n }));
    const archive = concatenate(archiveChunks);
    if (exportClose.status !== 0 || await sha256(archive) !== exportOpen.result.sha256) {
      throw new Error("public selected overlay export identity differs");
    }

    const restoreViaShell = async bytes => {
      const digest = await sha256(bytes);
      const begin = await shell.submit(request(shell, nextId++, "snapshot-restore-begin", {
        byteCount: bytes.byteLength, snapshotSha256: digest,
      }));
      if (begin.status !== 0 || begin.result?.restoreId !== 1) return { begin, finish: null };
      let offset = 0;
      while (offset < bytes.byteLength) {
        const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + 1048576));
        const append = await shell.submit(request(shell, nextId++, "snapshot-restore-chunk", {
          restoreId: 1n, offset, bytes: chunk.buffer,
          chunkSha256: await sha256(chunk),
        }));
        if (append.status !== 0) throw new Error("public selected restore chunk failed");
        offset += chunk.byteLength;
      }
      const finish = await shell.submit(request(shell, nextId++, "snapshot-restore-finish", { restoreId: 1n }));
      return { begin, finish };
    };

    const malformedArchive = archive.slice(); malformedArchive[0] ^= 0xff;
    const malformedRestore = await restoreViaShell(malformedArchive);
    const afterMalformedRestore = await controller.readBlock(1n);
    if (malformedRestore.finish?.status !== 7 || controller.state !== "CLEAN" ||
        !same(afterMalformedRestore, syntheticPage)) {
      throw new Error("malformed test-adapter roundtrip changed durable overlay state");
    }
    const validRestore = await restoreViaShell(archive);
    const afterRestore = await controller.readBlock(1n);
    if (validRestore.finish?.status !== 0 || validRestore.finish.result?.roundtrip !== true ||
        validRestore.finish.result?.adopted !== false || !same(afterRestore, syntheticPage)) {
      throw new Error("test-adapter CDRM10W1 roundtrip changed or adopted durable state");
    }
    controller.close();
    const restoredReopen = await shell.submit(request(shell, nextId++, "m10-reopen", {
      diskUuid: hex(binding.diskUuid), baseSha256: BASE_SHA256,
      profileSha256: hex(binding.profileSha256), artifactSetSha256: hex(binding.artifactSetSha256),
      createIfMissing: true,
    }));
    const finalSyntheticRead = await controller.readBlock(1n);
    if (restoredReopen.status !== 0 || !same(finalSyntheticRead, syntheticPage)) {
      throw new Error("synthetic overlay did not survive post-adapter public reopen");
    }
    const syntheticChangedPersistence = Object.freeze({
      origin: "synthetic-controller-write-after-public-mount",
      lba: "1", writeChanged: syntheticWrite.changed,
      baseSha256: await sha256(selectedBaseBlock1), changedSha256: await sha256(syntheticPage),
      immediateReadMatches: same(afterSyntheticWrite, syntheticPage),
      changedPublicReopenStatus: changedReopen.status,
      changedReopenMatches: same(afterChangedReopen, syntheticPage),
      finalPublicReopenStatus: restoredReopen.status,
      finalReadMatches: same(finalSyntheticRead, syntheticPage),
    });
    const testAdapterArchiveRoundtrip = Object.freeze({
      adapterProfile: TEST_ADAPTER_PROFILE,
      archiveFormat: "CDRM10W1",
      publicOperationDispatchOnly: true,
      normativePinnedObjectExportRecords: false,
      compositePausedResetRestore: false,
      workerLifecycleAfterHostComplete: observedHostCompleteLifecycle,
      dispatchExportOpenStatus: exportOpen.status, exportChunkCount,
      archiveBytes: archive.byteLength, archiveSha256: await sha256(archive),
      dispatchExportCloseStatus: exportClose.status,
      malformedRestoreFinishStatus: malformedRestore.finish.status,
      malformedRoundtripPreservedOverlay: same(afterMalformedRestore, syntheticPage),
      validRestoreFinishStatus: validRestore.finish.status,
      validRoundtrip: validRestore.finish.result.roundtrip,
      adopted: validRestore.finish.result.adopted,
      roundtripPreservedOverlay: same(afterRestore, syntheticPage),
      controllerState: controller.state, replacementCount: replacements,
    });
    return Object.freeze({ bootstrapStatus: bootstrap.status, mountStatus: 0,
      baseImport: Object.freeze({ beginStatus: importBegin.status, chunkCount: importChunks,
        finishStatus: importFinish.status, mountStatus: mounted.status,
        m10ReopenStatus: reopened.status }),
      baseBindingState: baseBinding.state, coldStatus: cold.status, bootStatus: boot.status,
      visibilityStatus: visibility.status, startStatus: start.status,
      batches, hostWaits,
      waitSlice, waitSequence: Object.freeze(lowerOperations.slice(waitSliceIndex, waitSliceIndex + 3)),
      service: Object.freeze({ operation: serviced[0].operation,
        firstBlock: serviced[0].firstBlock.toString(), blockCount: serviced[0].blockCount,
        durable: serviced[0].durable === true, changed: serviced[0].changed,
        workerLifecycleAfterHostComplete: observedHostCompleteLifecycle }), controllerState: controller.state,
      reopenReadback,
      syntheticChangedPersistence,
      testAdapterArchiveRoundtrip,
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
