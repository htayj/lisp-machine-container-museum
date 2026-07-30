#!/usr/bin/env node
/*
 * C-M13 F06/F07 browser composition probe.
 *
 * This is deliberately an external, disposable-browser integration probe.  It
 * records the real selected M12 Wasm artifact as an independent state witness
 * beside the real M10 IndexedDB adapter, controller, and worker-host bridge.
 * It does not load the M13 shell or its composite dispatch: the M10 bridge uses
 * an exact synthetic M4 request.  The runner never upgrades that lower-layer
 * composition into a C-M13-complete claim.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CadrProcessGroupSupervisor } from "./cadr-process-group-supervisor.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PYTHON = process.env.PYTHON ?? "/usr/bin/python3";
const PDEATH_EXEC = resolve(ROOT, "scripts/cadr-pdeath-exec.py");
const CHROMIUM = process.env.CHROMIUM ?? "/usr/bin/chromium";
const BASE_PATH = resolve(process.env.CADR_M10_BASE_IMAGE ??
  resolve(ROOT, "l/usim/disk-sys-303-0.img"));
const BASE_BYTES = 269562880;
const BASE_SHA256 =
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
const WASM_PATH = resolve(process.env.CADR_M12_SELECTED_WASM ??
  resolve(ROOT, "cadr-web/build/cadr-web-m12-O2.wasm"));
const RUN_SCHEMA = "cadr-m13-f06-f07-composition-v1";
const SOURCE_PATHS = Object.freeze({
  "/cadr-web/browser/cadr-m10-indexeddb.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-controller.mjs":
    ["cadr-web/browser/cadr-m10-controller.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/wasm/cadr-m10-persistence.mjs":
    ["cadr-web/wasm/cadr-m10-persistence.mjs", "text/javascript; charset=utf-8"],
});

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(path) {
  return new Promise((resolveDigest, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", chunk => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveDigest(digest.digest("hex")));
  });
}

function required(value, message) {
  if (!value) throw new Error(`C-M13 F06/F07: ${message}`);
}

function onlyFields(value, fields, label) {
  required(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} is not an object`);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  required(actual.length === expected.length && actual.every((entry, index) => entry === expected[index]),
    `${label} fields are open or noncanonical`);
}

function isHex(value, length) {
  return typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

/* Exported so the companion test checks that an incomplete browser receipt
   cannot accidentally be written as evidence. */
export function validateCompositionReport(report, {
  baseSha256 = BASE_SHA256,
  selectedWasmSha256 = null,
} = {}) {
  const reportFields = [
    "base", "browser", "cases", "limitation", "profile", "schema",
    "selected_wasm", "source_artifacts", "worker_protocol",
  ];
  if (Object.prototype.hasOwnProperty.call(report ?? {}, "supervisor")) reportFields.push("supervisor");
  onlyFields(report, reportFields, "report");
  required(report.schema === RUN_SCHEMA, "unexpected report schema");
  required(report.profile === "CADR-WEB-303 selected M12 O2 plus C-M10-IDB-v1", "wrong profile");
  required(typeof report.limitation === "string" && report.limitation.includes("not a C-M13"),
    "missing C-M13 limitation");
  onlyFields(report.base, ["bytes", "post_sha256", "pre_sha256", "sha256"], "base");
  required(report.base.bytes === BASE_BYTES && report.base.sha256 === baseSha256 &&
    report.base.pre_sha256 === baseSha256 && report.base.post_sha256 === baseSha256,
  "base identity or immutability receipt is wrong");
  onlyFields(report.selected_wasm, ["exports", "post", "pre", "sha256"], "selected_wasm");
  required(isHex(report.selected_wasm.sha256, 64), "selected Wasm hash is not SHA-256");
  if (selectedWasmSha256 !== null) required(report.selected_wasm.sha256 === selectedWasmSha256,
    "selected Wasm hash differs from supervised artifact");
  required(Array.isArray(report.selected_wasm.exports) &&
    report.selected_wasm.exports.includes("cadr_wasm_host_next_request") &&
    report.selected_wasm.exports.includes("cadr_wasm_m12_config_snapshot_save"),
  "selected Wasm export witness is incomplete");
  for (const checkpoint of [report.selected_wasm.pre, report.selected_wasm.post]) {
    onlyFields(checkpoint, ["audio_sha256", "config_sha256", "debug_sha256", "host_next_status", "machine_sha256"],
      "selected Wasm checkpoint");
    for (const field of ["audio_sha256", "config_sha256", "debug_sha256", "machine_sha256"])
      required(isHex(checkpoint[field], 64), `selected Wasm ${field} is invalid`);
    required(checkpoint.host_next_status === 9, "selected Wasm witness has a pending host request");
  }
  required(JSON.stringify(report.selected_wasm.pre) === JSON.stringify(report.selected_wasm.post),
    "selected Wasm state changed during isolated persistence probe");
  onlyFields(report.browser, ["product", "user_agent"], "browser");
  required(typeof report.browser.product === "string" && report.browser.product.length > 0 &&
    typeof report.browser.user_agent === "string" && report.browser.user_agent.length > 0,
  "browser receipt is incomplete");
  onlyFields(report.source_artifacts, ["controller_sha256", "indexeddb_sha256", "persistence_sha256"],
    "source artifact receipt");
  for (const value of Object.values(report.source_artifacts)) required(isHex(value, 64), "source artifact hash is invalid");
  onlyFields(report.worker_protocol, ["bridge", "request_kind"], "worker protocol");
  required(report.worker_protocol.bridge === "createCadrM10WorkerDiskBridge" &&
    report.worker_protocol.request_kind === "one exact M4 block-write request", "wrong worker protocol receipt");
  required(Array.isArray(report.cases) && report.cases.length === 4, "case ledger is incomplete");
  const byName = new Map(report.cases.map(item => [item.name, item]));
  const expected = [
    "f06-pre-guest-stage-failure", "f06-post-completion-publication-failure",
    "f07-host-completion-response-loss", "f07-foreign-binding-rejected",
  ];
  required(expected.every(name => byName.has(name)), "case names are incomplete");
  for (const item of report.cases) {
    onlyFields(item, ["active_receipt", "cleanup", "completion", "error", "name", "replace_worker_count", "state"],
      `case ${item?.name ?? "unknown"}`);
    onlyFields(item.active_receipt, ["after", "before", "recovered"], `${item.name} active receipt`);
    required(JSON.stringify(item.active_receipt.before) === JSON.stringify(item.active_receipt.after) &&
      JSON.stringify(item.active_receipt.before) === JSON.stringify(item.active_receipt.recovered),
    `${item.name} partially changed its active durable receipt`);
    required(item.cleanup === "deleted-disposable-indexeddb-disk", `${item.name} cleanup receipt`);
    required(typeof item.error === "string" && item.error.length > 0, `${item.name} missing fault receipt`);
  }
  const pre = byName.get("f06-pre-guest-stage-failure");
  required(pre.state.before === "CLEAN" && pre.state.after === "CLEAN" && pre.state.recovered === "CLEAN" &&
    pre.completion.accepted_count === 1 && pre.completion.pending_after === false &&
    pre.completion.statuses.length === 1 && pre.completion.statuses[0] === 1 &&
    pre.replace_worker_count === 0, "pre-guest failure ordering receipt");
  const post = byName.get("f06-post-completion-publication-failure");
  required(post.state.before === "CLEAN" && post.state.after === "IN_DOUBT" && post.state.recovered === "CLEAN" &&
    post.completion.accepted_count === 1 && post.completion.pending_after === false &&
    post.completion.statuses.length === 1 && post.completion.statuses[0] === 0 &&
    post.replace_worker_count === 1, "post-completion publication receipt");
  const lost = byName.get("f07-host-completion-response-loss");
  required(lost.state.before === "CLEAN" && lost.state.after === "IN_DOUBT" && lost.state.recovered === "CLEAN" &&
    lost.completion.accepted_count === 1 && lost.completion.pending_after === false &&
    lost.completion.response_lost === true && lost.completion.statuses[0] === 0 &&
    lost.replace_worker_count === 1, "completion-response-loss fencing receipt");
  const foreign = byName.get("f07-foreign-binding-rejected");
  required(foreign.state.before === "CLEAN" && foreign.state.after === "CLEAN" && foreign.state.recovered === "CLEAN" &&
    foreign.completion.accepted_count === 0 && foreign.completion.pending_after === false &&
    foreign.replace_worker_count === 0, "foreign binding receipt");
  if (report.supervisor !== undefined) {
    onlyFields(report.supervisor, ["bounded_base_page_reads", "report_payload_sha256", "selected_wasm_sha256"],
      "supervisor receipt");
    required(Array.isArray(report.supervisor.bounded_base_page_reads) &&
      report.supervisor.bounded_base_page_reads.length > 0 &&
      report.supervisor.bounded_base_page_reads.every(value => /^(0|[1-9][0-9]*)$/.test(value)),
    "supervisor base-read receipt");
    required(isHex(report.supervisor.report_payload_sha256, 64) &&
      report.supervisor.selected_wasm_sha256 === report.selected_wasm.sha256,
    "supervisor artifact receipt");
  }
  return true;
}

function pageSource() {
  return `<!doctype html><meta charset="utf-8"><title>C-M13 F06/F07 composition</title>
<body data-status="running">running
<script type="module">
import { createCadrM10IndexedDbBackend } from "/cadr-web/browser/cadr-m10-indexeddb.mjs";
import {
  CADR_M10_CONTROLLER_CLEAN, CADR_M10_CONTROLLER_IN_DOUBT,
  createCadrM10Controller, createCadrM10WorkerDiskBridge,
  parseCadrM10OverlayExport,
} from "/cadr-web/browser/cadr-m10-controller.mjs";
import { CADR_M10_BASE_SHA256, cadrM10Sha256, hexBytes } from "/cadr-web/wasm/cadr-m10-persistence.mjs";

const text = new TextEncoder();
const context = await (await fetch("/context.json", { cache: "no-store" })).json();
const equal = (left, right) => left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
const hash = async bytes => hexBytes(await cadrM10Sha256(bytes));
const bytesHash = async value => hash(value instanceof Uint8Array ? value : new Uint8Array(value));
const clone = value => new Uint8Array(value).slice();
const expectation = (value, message) => { if (!value) throw new Error(message); };
const errorText = error => String(error?.message ?? error);
const eventuallyRejects = async (thunk, label) => {
  try { await thunk(); } catch (error) { return errorText(error); }
  throw new Error(label + " unexpectedly succeeded");
};

async function readBasePage(lba) {
  expectation(typeof lba === "bigint" && lba >= 0n, "base LBA");
  const response = await fetch("/base-range?lba=" + lba.toString(), { cache: "no-store" });
  expectation(response.status === 206, "base range response");
  const result = new Uint8Array(await response.arrayBuffer());
  expectation(result.byteLength === 1024, "base range length");
  return result;
}

async function makeBinding(name, serial) {
  const profileSha256 = await cadrM10Sha256(text.encode("C-M13 F06/F07 browser composition " + name));
  const artifactSetSha256 = await cadrM10Sha256(text.encode("selected-M12-O2:" + context.selected_wasm_sha256));
  return Object.freeze({
    diskUuid: Uint8Array.from({ length: 16 }, (_, index) => (serial + index * 29) & 255),
    baseSha256: CADR_M10_BASE_SHA256.slice(), profileSha256, artifactSetSha256,
  });
}

async function receipt(controller) {
  const archiveBytes = await controller.exportOverlay();
  const archive = await parseCadrM10OverlayExport(archiveBytes);
  return Object.freeze({
    archive_sha256: await bytesHash(archiveBytes), generation: archive.sourceGeneration.toString(),
    entry_count: archive.entryCount.toString(), root_sha256: hexBytes(archive.rootSha256),
  });
}

function exactWriteChannel({ responseLoss = false } = {}) {
  const descriptor = new Uint8Array(24); const view = new DataView(descriptor.buffer);
  view.setBigUint64(0, 0x514d3133n, true); view.setBigUint64(8, 3n, true);
  view.setUint32(16, 1, true); view.setUint32(20, 1024, true);
  const payload = Uint8Array.from({ length: 1024 }, (_, index) => (index * 37 + 11) & 255);
  let pending = true; const accepted = [];
  const channel = Object.freeze({
    async submit(message) {
      expectation(message !== null && typeof message === "object", "host channel message");
      if (message.op === "host-next-request") {
        if (!pending) return Object.freeze({ status: 9 });
        return Object.freeze({ status: 0, request: Object.freeze({ operation: 2,
          generation: 1n, requestId: 0x514d3133n, completionByteCount: 0n }),
          descriptor: descriptor.slice(), requestPayload: payload.slice() });
      }
      expectation(message.op === "host-complete" && pending, "unexpected host completion");
      expectation(message.operation === 2 && message.generation === 1n &&
        message.requestId === 0x514d3133n && message.bytes instanceof Uint8Array &&
        message.bytes.byteLength === 0 && (message.hostStatus === 0 || message.hostStatus === 1),
      "non-exact host completion");
      pending = false; accepted.push(Object.freeze({ status: message.hostStatus }));
      if (responseLoss) throw new Error("synthetic host-complete response lost after guest acceptance");
      return Object.freeze({ status: 0 });
    },
  });
  return Object.freeze({ channel, payload, inspect: () => Object.freeze({
    accepted_count: accepted.length, pending_after: pending,
    response_lost: responseLoss, statuses: accepted.map(item => item.status),
  }) });
}

async function selectedWasmWitness() {
  const bytes = new Uint8Array(await (await fetch("/selected.wasm", { cache: "no-store" })).arrayBuffer());
  expectation(await bytesHash(bytes) === context.selected_wasm_sha256, "selected Wasm transport hash");
  const module = await WebAssembly.compile(bytes); const exportsList = WebAssembly.Module.exports(module).map(item => item.name).sort();
  const { exports: e } = await WebAssembly.instantiate(module, {});
  expectation(e.cadr_wasm_create() === 0, "selected Wasm create");
  const output = e.cadr_wasm_output_pointer() >>> 0;
  const sidecar = e.cadr_wasm_input_reserve(1088) >>> 0;
  expectation(output !== 0 && sidecar !== 0, "selected Wasm scratch pointers");
  const outputBytes = count => new Uint8Array(e.memory.buffer, output, count).slice();
  const checkpoint = async () => {
    expectation(e.cadr_wasm_machine_info() === 0, "selected Wasm machine info");
    const machine = outputBytes(64);
    expectation(e.cadr_wasm_m12_debug_state() === 0, "selected Wasm debug state");
    const debug = outputBytes(24);
    expectation(e.cadr_wasm_m11_audio_state() === 0, "selected Wasm audio state");
    const audio = outputBytes(40);
    expectation(e.cadr_wasm_m12_config_snapshot_save() === 0, "selected Wasm config snapshot");
    const config = new Uint8Array(e.memory.buffer, sidecar, 1088).slice();
    return Object.freeze({ machine_sha256: await bytesHash(machine), debug_sha256: await bytesHash(debug),
      audio_sha256: await bytesHash(audio), config_sha256: await bytesHash(config),
      host_next_status: e.cadr_wasm_host_next_request() });
  };
  return Object.freeze({ exports: exportsList, pre: await checkpoint(), post: checkpoint,
    finalize: async () => checkpoint() });
}

async function controllerFor({ name, serial, fault = null, failControllerStage = false }) {
  const binding = await makeBinding(name, serial);
  const indexedDbBackend = createCadrM10IndexedDbBackend({
    databasePrefix: "cadr-m13-f06f07-" + context.run_token,
    seamHook: async event => { if (event.seam === fault) throw new Error("injected durable seam " + fault); },
  });
  /* The before-stage adapter seam belongs to its commit replay, which is
     deliberately after the controller has called completeGuest.  F06 also
     needs the distinct controller-to-disk stage failure, so this narrow test
     facade fails only that real handle method and delegates every other M10
     operation to the actual IndexedDB handle. */
  const wrapHandle = handle => {
    if (!failControllerStage) return handle;
    const facade = {};
    for (const key of Object.keys(handle)) facade[key] = key === "stage" ?
      async () => { throw new Error("injected controller-before-guest disk.stage failure"); } : handle[key];
    return Object.freeze(facade);
  };
  const backend = !failControllerStage ? indexedDbBackend : Object.freeze({
    profile: indexedDbBackend.profile,
    initializeDisk: async selectedBinding => wrapHandle(await indexedDbBackend.initializeDisk(selectedBinding)),
    reopenDisk: async selectedBinding => wrapHandle(await indexedDbBackend.reopenDisk(selectedBinding)),
    deleteDisk: selectedBinding => indexedDbBackend.deleteDisk(selectedBinding),
  });
  let replaced = 0;
  const controller = createCadrM10Controller({ backend, binding, readBasePage,
    readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
    replaceWorker: async () => { replaced += 1; },
  });
  await controller.open({ initialize: true });
  return Object.freeze({ binding, backend, controller, replacements: () => replaced });
}

async function closeAndDelete(value) {
  try { value.controller.close(); } catch { /* IN_DOUBT controller can still close. */ }
  await value.backend.deleteDisk(value.binding);
  return "deleted-disposable-indexeddb-disk";
}

async function observeDurableReceipt(value) {
  const observer = createCadrM10Controller({ backend: value.backend, binding: value.binding,
    readBasePage, readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(),
    replaceWorker: async () => {} });
  await observer.open();
  try { return await receipt(observer); }
  finally { observer.close(); }
}

async function preGuestStageFailure() {
  const value = await controllerFor({ name: "pre-guest-stage", serial: 17,
    failControllerStage: true });
  const before = await receipt(value.controller); const channel = exactWriteChannel();
  const bridge = createCadrM10WorkerDiskBridge({ controller: value.controller, channel: channel.channel });
  const error = await eventuallyRejects(() => bridge.serviceOnce(), "before-stage bridge service");
  const after = await receipt(value.controller);
  expectation(value.controller.state === CADR_M10_CONTROLLER_CLEAN, "pre-guest controller not clean");
  const recovered = await receipt(value.controller);
  return Object.freeze({ name: "f06-pre-guest-stage-failure", error,
    state: { before: "CLEAN", after: value.controller.state, recovered: value.controller.state },
    active_receipt: { before, after, recovered }, completion: channel.inspect(),
    replace_worker_count: value.replacements(), cleanup: await closeAndDelete(value) });
}

async function postCompletionPublicationFailure() {
  const value = await controllerFor({ name: "post-completion-publication", serial: 51, fault: "before-head-activation" });
  const before = await receipt(value.controller); const channel = exactWriteChannel();
  const bridge = createCadrM10WorkerDiskBridge({ controller: value.controller, channel: channel.channel });
  const error = await eventuallyRejects(() => bridge.serviceOnce(), "post-completion bridge service");
  /* The controller is intentionally fenced.  An independently reopened M10
     observer reads the active head before the original controller recovers. */
  const after = await observeDurableReceipt(value);
  await value.controller.recover();
  expectation(value.controller.state === CADR_M10_CONTROLLER_CLEAN, "post-completion recovery did not clean controller");
  const recovered = await receipt(value.controller);
  return Object.freeze({ name: "f06-post-completion-publication-failure", error,
    state: { before: "CLEAN", after: "IN_DOUBT", recovered: value.controller.state },
    active_receipt: { before, after, recovered }, completion: channel.inspect(),
    replace_worker_count: value.replacements(), cleanup: await closeAndDelete(value) });
}

async function completionResponseLoss() {
  const value = await controllerFor({ name: "completion-response-loss", serial: 85, fault: null });
  const before = await receipt(value.controller); const channel = exactWriteChannel({ responseLoss: true });
  const bridge = createCadrM10WorkerDiskBridge({ controller: value.controller, channel: channel.channel });
  const error = await eventuallyRejects(() => bridge.serviceOnce(), "lost host-complete response bridge service");
  expectation(value.controller.state === CADR_M10_CONTROLLER_IN_DOUBT, "lost completion did not fence controller");
  const after = await observeDurableReceipt(value);
  await value.controller.recover();
  expectation(value.controller.state === CADR_M10_CONTROLLER_CLEAN, "lost completion recovery did not clean controller");
  const recovered = await receipt(value.controller);
  return Object.freeze({ name: "f07-host-completion-response-loss", error,
    state: { before: "CLEAN", after: "IN_DOUBT", recovered: value.controller.state },
    active_receipt: { before, after, recovered }, completion: channel.inspect(),
    replace_worker_count: value.replacements(), cleanup: await closeAndDelete(value) });
}

async function foreignBindingRejected() {
  const value = await controllerFor({ name: "foreign-binding", serial: 119, fault: null });
  const original = await receipt(value.controller);
  const changed = Uint8Array.from({ length: 1024 }, (_, index) => (index * 13 + 7) & 255);
  await value.controller.commitWrites([{ lba: 3n, bytes: changed }]);
  const before = await receipt(value.controller); expectation(JSON.stringify(before) !== JSON.stringify(original), "foreign binding fixture did not write an active head");
  value.controller.close();
  const foreign = Object.freeze({ ...value.binding, profileSha256: value.binding.profileSha256.map((byte, index) => index === 0 ? byte ^ 1 : byte) });
  const error = await eventuallyRejects(() => value.backend.reopenDisk(foreign), "foreign binding reopen");
  const replacement = createCadrM10Controller({ backend: value.backend, binding: value.binding, readBasePage,
    readBaseIdentity: async () => CADR_M10_BASE_SHA256.slice(), replaceWorker: async () => {} });
  await replacement.open(); const recovered = await receipt(replacement);
  expectation(equal(await replacement.readBlock(3n), changed), "foreign reopen changed selected disk payload");
  replacement.close();
  return Object.freeze({ name: "f07-foreign-binding-rejected", error,
    state: { before: "CLEAN", after: "CLEAN", recovered: "CLEAN" },
    active_receipt: { before, after: before, recovered },
    completion: { accepted_count: 0, pending_after: false, response_lost: false, statuses: [] },
    replace_worker_count: 0, cleanup: await value.backend.deleteDisk(value.binding).then(() => "deleted-disposable-indexeddb-disk") });
}

async function run() {
  const wasm = await selectedWasmWitness();
  const cases = [];
  cases.push(await preGuestStageFailure());
  cases.push(await postCompletionPublicationFailure());
  cases.push(await completionResponseLoss());
  cases.push(await foreignBindingRejected());
  const report = Object.freeze({ schema: "${RUN_SCHEMA}",
    profile: "CADR-WEB-303 selected M12 O2 plus C-M10-IDB-v1",
    limitation: "This records an independent selected M12 Wasm state witness beside real M10 browser durability and an exact synthetic M4 host request. It does not load the M13 shell or its composite dispatch, so this is not a C-M13 completion claim.",
    base: { bytes: ${BASE_BYTES}, sha256: "${BASE_SHA256}", pre_sha256: "${BASE_SHA256}", post_sha256: "${BASE_SHA256}" },
    browser: { product: navigator.userAgentData?.brands?.map(item => item.brand + "/" + item.version).join(" ") ?? navigator.userAgent,
      user_agent: navigator.userAgent },
    selected_wasm: { sha256: context.selected_wasm_sha256, exports: wasm.exports, pre: wasm.pre, post: await wasm.finalize() },
    source_artifacts: context.source_artifacts,
    worker_protocol: { bridge: "createCadrM10WorkerDiskBridge", request_kind: "one exact M4 block-write request" },
    cases });
  const response = await fetch("/result", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) });
  expectation(response.status === 204, "supervisor rejected result receipt");
  document.body.dataset.status = "ok"; document.body.textContent = JSON.stringify({ schema: report.schema, status: "ok" });
}

try { await run(); } catch (error) {
  document.body.dataset.status = "failed"; document.body.textContent = error?.stack ?? String(error);
}
</script>`;
}

async function sourceArtifacts() {
  const entries = await Promise.all(Object.entries(SOURCE_PATHS).map(async ([url, [path, type]]) => {
    const bytes = await readFile(resolve(ROOT, path));
    return [url, Object.freeze({ bytes, type, sha256: sha256Hex(bytes) })];
  }));
  return new Map(entries);
}

async function startServer({ baseFile, baseSha256, wasmBytes, wasmSha256, artifacts, runToken }) {
  const html = Buffer.from(pageSource());
  const context = Buffer.from(JSON.stringify({ selected_wasm_sha256: wasmSha256,
    run_token: runToken, source_artifacts: {
      indexeddb_sha256: artifacts.get("/cadr-web/browser/cadr-m10-indexeddb.mjs").sha256,
      controller_sha256: artifacts.get("/cadr-web/browser/cadr-m10-controller.mjs").sha256,
      persistence_sha256: artifacts.get("/cadr-web/wasm/cadr-m10-persistence.mjs").sha256,
    } }));
  const rangeRequests = []; let received = null; let resolveResult; let rejectResult;
  const result = new Promise((resolveResultPromise, rejectResultPromise) => {
    resolveResult = resolveResultPromise; rejectResult = rejectResultPromise;
  });
  const endpoint = { host: null };
  endpoint.server = createServer((request, response) => {
    const url = (() => { try { return new URL(request.url, `http://${endpoint.host}`); } catch { return null; } })();
    const valid = url !== null && request.headers.host === endpoint.host;
    const headers = { "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "same-origin", "x-content-type-options": "nosniff", "cache-control": "no-store" };
    const send = (status, type, body) => { response.writeHead(status, { ...headers, "content-type": type, "content-length": body.byteLength }); response.end(body); };
    if (!valid) { send(421, "text/plain; charset=utf-8", Buffer.from("wrong host")); return; }
    if (request.method === "POST" && url.pathname === "/result") {
      const chunks = []; let size = 0;
      request.on("data", chunk => { size += chunk.byteLength; if (size > 1024 * 1024) request.destroy(new Error("oversize result")); else chunks.push(chunk); });
      request.on("error", rejectResult);
      request.on("end", () => {
        try {
          required(received === null, "page submitted two result receipts");
          received = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          response.writeHead(204, headers); response.end(); resolveResult(received);
        } catch (error) { response.writeHead(400, headers); response.end(); rejectResult(error); }
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/base-range") {
      const lbaText = url.searchParams.get("lba");
      if (!/^(0|[1-9][0-9]*)$/.test(lbaText ?? "")) { send(416, "text/plain", Buffer.from("bad lba")); return; }
      const lba = BigInt(lbaText); const offset = lba * 1024n;
      if (offset + 1024n > BigInt(BASE_BYTES)) { send(416, "text/plain", Buffer.from("outside base")); return; }
      const bytes = Buffer.alloc(1024);
      void baseFile.read(bytes, 0, bytes.byteLength, Number(offset)).then(({ bytesRead }) => {
        if (bytesRead !== 1024) { response.destroy(new Error("short base read")); return; }
        rangeRequests.push(lba.toString());
        response.writeHead(206, { ...headers, "content-type": "application/octet-stream", "content-length": 1024,
          "content-range": `bytes ${offset}-${offset + 1023n}/${BASE_BYTES}` }); response.end(bytes);
      }, error => response.destroy(error));
      return;
    }
    if (request.method !== "GET") { send(404, "text/plain", Buffer.from("not found")); return; }
    if (url.pathname === "/f06-f07.html") { send(200, "text/html; charset=utf-8", html); return; }
    if (url.pathname === "/context.json") { send(200, "application/json", context); return; }
    if (url.pathname === "/selected.wasm") { send(200, "application/wasm", wasmBytes); return; }
    const item = artifacts.get(url.pathname);
    if (item !== undefined) { send(200, item.type, item.bytes); return; }
    send(404, "text/plain", Buffer.from("not found"));
  });
  await new Promise((resolveListen, reject) => {
    endpoint.server.once("error", reject);
    endpoint.server.listen(0, "127.0.0.1", () => {
      endpoint.host = `127.0.0.1:${endpoint.server.address().port}`; resolveListen();
    });
  });
  return Object.freeze({ endpoint, result, rangeRequests, close: () => new Promise(resolveClose => endpoint.server.close(resolveClose)) });
}

function awaitDevtools(browser, stderr) {
  return new Promise((resolveEndpoint, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Chromium DevTools endpoint timed out:\n${stderr.text}`)), 15000);
    const inspect = chunk => {
      stderr.text += chunk;
      const match = stderr.text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match !== null) { clearTimeout(timeout); browser.stderr.off("data", inspect); resolveEndpoint(match[1]); }
    };
    browser.stderr.on("data", inspect);
    browser.once("exit", code => { clearTimeout(timeout); reject(new Error(`Chromium exited before DevTools (${code}):\n${stderr.text}`)); });
  });
}

async function launchBrowser({ supervisor, userData, url }) {
  const browser = supervisor.track(spawn(PYTHON, [PDEATH_EXEC, String(process.pid), CHROMIUM,
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${userData}`, url,
  ], { stdio: ["ignore", "ignore", "pipe"], detached: true }));
  const stderr = { text: "" };
  try {
    const endpoint = await awaitDevtools(browser, stderr); const port = new URL(endpoint).port;
    const metadata = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    return Object.freeze({ browser, stderr, metadata });
  } catch (error) { await supervisor.stop(browser, "SIGKILL"); throw error; }
}

function parseArgs(argv) {
  const execute = argv.includes("--execute");
  const output = argv.find(argument => argument.startsWith("--output="))?.slice("--output=".length) ?? null;
  for (const argument of argv) required(argument === "--execute" || argument.startsWith("--output="), `unknown argument ${argument}`);
  return { execute, output };
}

export async function executeComposition({ output = null } = {}) {
  const baseStat = await stat(BASE_PATH); required(baseStat.size === BASE_BYTES, `selected base length ${baseStat.size}`);
  const preBase = await sha256File(BASE_PATH); required(preBase === BASE_SHA256, `selected base SHA-256 ${preBase}`);
  const wasmBytes = await readFile(WASM_PATH); const wasmSha256 = sha256Hex(wasmBytes);
  required(wasmBytes.byteLength > 0, "selected M12 Wasm is empty");
  const baseFile = await open(BASE_PATH, "r"); const supervisor = new CadrProcessGroupSupervisor();
  const profile = await mkdtemp(join(tmpdir(), "cadr-m13-f06f07-")); const artifacts = await sourceArtifacts();
  const runToken = `${process.pid}-${Date.now().toString(36)}`;
  let server = null; let browser = null;
  try {
    server = await startServer({ baseFile, baseSha256: BASE_SHA256, wasmBytes, wasmSha256, artifacts, runToken });
    browser = await launchBrowser({ supervisor, userData: profile, url: `http://${server.endpoint.host}/f06-f07.html` });
    const report = await Promise.race([server.result, new Promise((_, reject) => setTimeout(() => reject(new Error(`F06/F07 browser receipt timed out:\n${browser.stderr.text}`)), 60000))]);
    const postBase = await sha256File(BASE_PATH); required(postBase === BASE_SHA256, "selected base changed while mounted read-only");
    report.base.pre_sha256 = preBase; report.base.post_sha256 = postBase;
    report.browser = { product: browser.metadata.Browser ?? report.browser.product, user_agent: browser.metadata["User-Agent"] ?? report.browser.user_agent };
    validateCompositionReport(report, { selectedWasmSha256: wasmSha256 });
    required(server.rangeRequests.length > 0 && server.rangeRequests.every(value => /^(0|[1-9][0-9]*)$/.test(value)),
      "browser did not use bounded base page reads");
    const directory = resolve(output ?? join(ROOT, "build/cadr-m13", `f06-f07-composition-${Date.now()}`));
    required(directory.startsWith(resolve(ROOT, "build/cadr-m13") + "/"), "output must be below build/cadr-m13");
    await mkdir(directory, { recursive: true });
    const finalReport = Object.freeze({ ...report, supervisor: Object.freeze({
      bounded_base_page_reads: [...server.rangeRequests], selected_wasm_sha256: wasmSha256,
      report_payload_sha256: sha256Hex(Buffer.from(JSON.stringify(report))), }), });
    await writeFile(join(directory, "report.json"), `${JSON.stringify(finalReport, null, 2)}\n`, { mode: 0o644 });
    return Object.freeze({ directory, report: finalReport });
  } finally {
    if (browser !== null) await supervisor.stop(browser.browser, "SIGKILL");
    await supervisor.stopAll("SIGKILL");
    if (server !== null) await server.close();
    await baseFile.close(); await rm(profile, { recursive: true, force: true });
  }
}

const invoked = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.execute) {
    process.stdout.write("This probe is inert without --execute; it will create a disposable Chromium/IndexedDB run and write a report under build/cadr-m13.\n");
  } else {
    const result = await executeComposition({ output: args.output });
    process.stdout.write(`${JSON.stringify({ schema: RUN_SCHEMA, report: join(result.directory, "report.json") })}\n`);
  }
}
