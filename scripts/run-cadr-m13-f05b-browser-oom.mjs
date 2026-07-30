#!/usr/bin/env node
/*
 * M13-F05b destructive browser resource-limit evidence.
 *
 * This deliberately does not turn a browser OOM into the deterministic
 * CADR_STATUS_NO_MEMORY result.  Each one-shot page uses a new local origin,
 * profile, and detached Chromium process.  The host, rather than that page,
 * owns process-loss classification and integrity checks for the selected
 * immutable System 303 base and a read-only synthetic durable fixture.
 *
 * It is a focused component probe, not a composed M13 application run and not
 * a C-M13 completion claim.  Chromium/V8 is the currently executable engine;
 * the report makes its resource-limit portability limitations explicit.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  chmod, lstat, mkdir, mkdtemp, readFile, rm, stat, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { CadrProcessGroupSupervisor } from "./cadr-process-group-supervisor.mjs";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = resolve(ROOT, "build/cadr-m13");
const PROFILE = "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2";
export const CADR_M13_F05B_SCHEMA = "cadr-m13-f05b-browser-oom-v1";
const PAGE_SCHEMA = "cadr-m13-f05b-page-v1";
const BASE_BYTES = 269562880;
const BASE_SHA256 = "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
const WASM_BYTES = 134217728;
const WASM_PAGES = WASM_BYTES / 65536;
const PYTHON = process.env.PYTHON ?? "/usr/bin/python3";
const PDEATH_EXEC = resolve(ROOT, "scripts/cadr-pdeath-exec.py");
const DEFAULT_CHROMIUM = process.env.CHROMIUM ?? "/usr/bin/chromium";
const DEFAULT_WASM = resolve(ROOT, "cadr-web/build/cadr-web-m12-O2.wasm");
const HASH = value => createHash("sha256").update(value).digest("hex");
const pause = milliseconds => new Promise(resolvePause => setTimeout(resolvePause, milliseconds));

function fail(message) { throw new Error(`M13-F05b: ${message}`); }

function object(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${name} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, name) {
  const actual = Object.keys(object(value, name)).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${name} keys are not closed`);
  }
}

function string(value, name) {
  if (typeof value !== "string" || value.length === 0) fail(`${name} must be a nonempty string`);
  return value;
}

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${name} must be a nonnegative safe integer`);
  return value;
}

function relativePortable(path) {
  const result = relative(ROOT, path);
  if (!result || result.startsWith("..") || result.includes(".." + sep)) {
    fail("report identity escapes repository root");
  }
  return result.split(sep).join("/");
}

async function fileIdentity(path) {
  const info = await stat(path);
  if (!info.isFile()) fail(`${relativePortable(path)} is not a regular file`);
  const bytes = await readFile(path);
  return Object.freeze({
    path: relativePortable(path), byteCount: bytes.byteLength, sha256: HASH(bytes),
  });
}

async function arbitraryFileIdentity(path, displayPath) {
  const info = await stat(path);
  if (!info.isFile()) fail(`${displayPath} is not a regular file`);
  const bytes = await readFile(path);
  return Object.freeze({ path: displayPath, byteCount: bytes.byteLength, sha256: HASH(bytes) });
}

function parseArguments(argv) {
  const options = {
    execute: false, output: null, wasm: DEFAULT_WASM, chromium: DEFAULT_CHROMIUM,
    jsHeapMiB: 64, jsTargetMiB: 256, timeoutMs: 30000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") options.execute = true;
    else if (["--output", "--wasm", "--chromium", "--js-heap-mib", "--js-target-mib", "--timeout-ms"].includes(argument)) {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) fail(`${argument} needs one value`);
      if (argument === "--output") options.output = resolve(ROOT, value);
      else if (argument === "--wasm") options.wasm = resolve(ROOT, value);
      else if (argument === "--chromium") options.chromium = resolve(value);
      else if (argument === "--js-heap-mib") options.jsHeapMiB = Number(value);
      else if (argument === "--js-target-mib") options.jsTargetMiB = Number(value);
      else options.timeoutMs = Number(value);
    } else if (argument === "--help") {
      process.stdout.write("usage: run-cadr-m13-f05b-browser-oom.mjs --execute [--wasm PATH] [--output build/cadr-m13/LEAF] [--chromium PATH] [--js-heap-mib N] [--js-target-mib N] [--timeout-ms N]\n");
      process.exit(0);
    } else fail(`unknown argument ${argument}`);
  }
  for (const [value, name, minimum, maximum] of [
    [options.jsHeapMiB, "--js-heap-mib", 16, 1024],
    [options.jsTargetMiB, "--js-target-mib", options.jsHeapMiB + 1, 2048],
    [options.timeoutMs, "--timeout-ms", 1000, 120000],
  ]) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      fail(`${name} must be an integer in ${minimum}..${maximum}`);
    }
  }
  if (!options.execute) fail("destructive browser probe requires --execute");
  options.output ??= resolve(OUTPUT_ROOT, `f05b-${process.pid}`);
  return Object.freeze(options);
}

async function newOutput(path) {
  const leaf = relative(OUTPUT_ROOT, path);
  if (!leaf || leaf.startsWith("..") || leaf.includes(sep)) {
    fail("--output must be a direct new child of build/cadr-m13/");
  }
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const rootInfo = await lstat(OUTPUT_ROOT);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail("build/cadr-m13 must be a real directory");
  }
  try { await lstat(path); fail(`refusing to replace existing output: ${relativePortable(path)}`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  await mkdir(path, { mode: 0o700 });
  return leaf;
}

function normalisePageReport(candidate, expected) {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const value = candidate;
  const required = ["schema", "caseId", "operation", "classification", "stage", "errorName", "errorMessage", "initialBytes", "targetEstimatedBytes", "injectedNoMemory"];
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...required].sort()) ||
      value.schema !== PAGE_SCHEMA || value.caseId !== expected.caseId ||
      value.operation !== expected.operation || value.injectedNoMemory !== false ||
      typeof value.classification !== "string" || typeof value.stage !== "string" ||
      (value.errorName !== null && typeof value.errorName !== "string") ||
      (value.errorMessage !== null && typeof value.errorMessage !== "string") ||
      (value.initialBytes !== null && !Number.isSafeInteger(value.initialBytes)) ||
      (value.targetEstimatedBytes !== null && !Number.isSafeInteger(value.targetEstimatedBytes))) return null;
  return Object.freeze({
    classification: value.classification, stage: value.stage,
    errorName: value.errorName, errorMessage: value.errorMessage,
    initialBytes: value.initialBytes, targetEstimatedBytes: value.targetEstimatedBytes,
  });
}

function pageHtml(config) {
  const encoded = JSON.stringify(config).replaceAll("<", "\\u003c");
  return `<!doctype html><meta charset="utf-8"><title>CADR M13-F05b disposable OOM probe</title><p id="status">Preparing destructive one-operation probe.</p><script type="module">
const config = Object.freeze(${encoded});
const status = document.querySelector("#status");
const set = text => { status.textContent = text; document.body.dataset.status = text; };
const text = error => error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512);
async function report(classification, stage, error, initialBytes = null, targetEstimatedBytes = null) {
  const record = { schema: "${PAGE_SCHEMA}", caseId: config.caseId, operation: config.operation,
    classification, stage, errorName: error instanceof Error ? error.name : null,
    errorMessage: error === null ? null : text(error), initialBytes, targetEstimatedBytes,
    injectedNoMemory: false };
  set(classification);
  try { await fetch("/result", { method: "POST", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(record) }); }
  catch { /* a process-loss result belongs to the host supervisor */ }
}
function heapChunk(serial) {
  const count = 2097152; const result = new Array(count);
  for (let index = 0; index < count; index += 1) {
    /* A retained ordinary Array has V8 managed-heap elements, rather than an
       ArrayBuffer backing store outside old-space accounting. */
    result[index] = serial * count + index;
  }
  return result;
}
async function stressJsHeap() {
  const retained = []; let estimated = 0; let serial = 0;
  const perChunk = 2097152 * 8;
  try {
    while (estimated < config.jsTargetEstimatedBytes) {
      retained.push(heapChunk(serial++)); estimated += perChunk;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await report("unexpected-completion", "js-heap-grow", null, null, estimated);
  } catch (error) {
    await report("browser-oom-exception", "js-heap-grow", error, null, estimated);
  }
}
async function stressFixedWasm() {
  try {
    const bytes = await (await fetch("/selected.wasm", { cache: "no-store" })).arrayBuffer();
    const instance = await WebAssembly.instantiate(bytes, {});
    const memory = instance.instance.exports.memory;
    const initialBytes = memory?.buffer?.byteLength;
    if (!(memory instanceof WebAssembly.Memory) || initialBytes !== config.wasmBytes) {
      throw new Error("selected Wasm did not export the configured fixed memory");
    }
    try {
      memory.grow(1);
      await report("unexpected-completion", "wasm-grow-past-fixed-maximum", null, initialBytes, null);
    } catch (error) {
      await report("fixed-wasm-capacity-refusal", "wasm-grow-past-fixed-maximum", error, initialBytes, null);
    }
  } catch (error) {
    await report("browser-oom-exception", "wasm-instantiate-or-validate", error, null, null);
  }
}
set("running");
setTimeout(() => { void (config.operation === "js-heap-grow" ? stressJsHeap() : stressFixedWasm()); }, 100);
</script>`;
}

async function listenCase(config, wasmBytes) {
  const result = { pageRecord: null, forbiddenRequests: [], servedPaths: [] };
  const html = Buffer.from(pageHtml(config), "utf8");
  const endpoint = { host: null, server: null, result };
  endpoint.server = createServer((request, response) => {
    const pathname = (() => {
      try { return new URL(request.url, `http://${endpoint.host}`).pathname; }
      catch { return ""; }
    })();
    const common = {
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "same-origin",
      "x-content-type-options": "nosniff", "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
    };
    if (request.headers.host !== endpoint.host) {
      response.writeHead(421, common); response.end(); return;
    }
    if (request.method === "POST" && pathname === "/result") {
      const chunks = []; let byteLength = 0;
      request.on("data", chunk => { byteLength += chunk.byteLength; if (byteLength <= 8192) chunks.push(chunk); });
      request.on("end", () => {
        try {
          if (byteLength > 8192) throw new Error("page report is too large");
          result.pageRecord = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          response.writeHead(204, common); response.end();
        } catch { response.writeHead(400, common); response.end(); }
      });
      return;
    }
    const entry = request.method === "GET" || request.method === "HEAD" ?
      pathname === "/oom.html" ? { bytes: html, type: "text/html; charset=utf-8" } :
      pathname === "/selected.wasm" ? { bytes: wasmBytes, type: "application/wasm" } : null : null;
    if (entry === null) {
      result.forbiddenRequests.push(pathname);
      response.writeHead(404, { ...common, "content-type": "text/plain; charset=utf-8" });
      response.end("not found"); return;
    }
    result.servedPaths.push(pathname);
    response.writeHead(200, { ...common, "content-type": entry.type, "content-length": entry.bytes.byteLength });
    response.end(request.method === "HEAD" ? undefined : entry.bytes);
  });
  await new Promise((resolveListen, reject) => {
    endpoint.server.once("error", reject);
    endpoint.server.listen(0, "127.0.0.1", () => {
      endpoint.host = `127.0.0.1:${endpoint.server.address().port}`;
      resolveListen();
    });
  });
  return endpoint;
}

function waitForDebugger(browser, stderr) {
  return new Promise((resolveEndpoint, reject) => {
    const timeout = setTimeout(() => reject(new Error(`DevTools endpoint timed out: ${stderr.text}`)), 15000);
    const observe = chunk => {
      stderr.text += chunk.toString("utf8");
      const matched = stderr.text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (matched !== null) {
        clearTimeout(timeout); browser.stderr.off("data", observe);
        browser.stderr.on("data", value => { stderr.text += value.toString("utf8"); });
        resolveEndpoint(matched[1]);
      }
    };
    browser.stderr.on("data", observe);
    browser.once("exit", (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`Chromium exited before DevTools (${code ?? signal ?? "unknown"}): ${stderr.text}`));
    });
  });
}

async function connectDebugger(endpoint) {
  const socket = new WebSocket(endpoint); const pending = new Map(); const events = [];
  let next = 0; let disconnected = false;
  await new Promise((resolveOpen, rejectOpen) => { socket.onopen = resolveOpen; socket.onerror = rejectOpen; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      }
    } else events.push(message);
  };
  socket.onclose = () => {
    disconnected = true;
    for (const waiter of pending.values()) waiter.reject(new Error("DevTools connection closed"));
    pending.clear();
  };
  return Object.freeze({
    call(method, params = {}) {
      if (disconnected) return Promise.reject(new Error("DevTools connection closed"));
      const id = ++next;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    events: () => [...events],
    disconnected: () => disconnected,
    close: () => socket.close(),
  });
}

function targetCrashed(client) {
  return client.events().some(event =>
    event.method === "Inspector.targetCrashed" || event.method === "Target.targetCrashed");
}

async function launchCase({ chromium, profile, jsHeapMiB, processGroups }) {
  const argumentsValue = [
    PDEATH_EXEC, String(process.pid), chromium, "--headless=new", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    "--disable-component-update", "--disable-sync", "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ];
  if (jsHeapMiB !== null) argumentsValue.splice(3, 0, `--js-flags=--max-old-space-size=${jsHeapMiB}`);
  const browser = processGroups.track(spawn(PYTHON, argumentsValue,
    { detached: true, stdio: ["ignore", "ignore", "pipe"] }));
  const stderr = { text: "" };
  try {
    const endpoint = await waitForDebugger(browser, stderr);
    const origin = new URL(endpoint);
    const tab = await (await fetch(`http://127.0.0.1:${origin.port}/json/new?about:blank`,
      { method: "PUT" })).json();
    const client = await connectDebugger(tab.webSocketDebuggerUrl);
    await client.call("Page.enable"); await client.call("Runtime.enable");
    const version = await client.call("Browser.getVersion");
    return { browser, client, stderr, version: version.product ?? "unknown", argumentsValue };
  } catch (error) {
    await processGroups.stop(browser, "SIGKILL");
    throw error;
  }
}

async function terminateCase(instance, processGroups) {
  instance?.client?.close();
  if (instance?.browser !== undefined) await processGroups.stop(instance.browser, "SIGTERM");
}

function hostClassification(config, page, instance, timedOut) {
  if (instance?.browser?.exitCode !== null && instance?.browser?.exitCode !== undefined) return "browser-process-loss";
  if (instance?.client?.disconnected() || targetCrashed(instance.client)) return "renderer-process-loss";
  if (page !== null) return page.classification;
  if (timedOut) return "watchdog-terminated-cap-stress";
  return "browser-setup-failure";
}

async function runOneCase({ config, wasmBytes, chromium, jsHeapMiB, timeoutMs, campaignRoot, processGroups, immutable }) {
  const endpoint = await listenCase(config, wasmBytes);
  const profile = resolve(campaignRoot, `profile-${config.caseId.toLowerCase()}`);
  let instance = null; let timedOut = false; let setupError = null;
  try {
    instance = await launchCase({ chromium, profile, jsHeapMiB, processGroups });
    await instance.client.call("Page.navigate", { url: `http://${endpoint.host}/oom.html` });
    const deadline = Date.now() + timeoutMs;
    while (endpoint.result.pageRecord === null && Date.now() < deadline) {
      if (instance.browser.exitCode !== null || instance.client.disconnected() || targetCrashed(instance.client)) break;
      await pause(25);
    }
    timedOut = endpoint.result.pageRecord === null && instance.browser.exitCode === null &&
      !instance.client.disconnected() && !targetCrashed(instance.client);
  } catch (error) { setupError = error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512); }
  const page = normalisePageReport(endpoint.result.pageRecord, config);
  const classification = setupError === null ? hostClassification(config, page, instance, timedOut) : "browser-setup-failure";
  const process = {
    browserExitCode: instance?.browser?.exitCode ?? null,
    browserExitSignal: instance?.browser?.signalCode ?? null,
    devtoolsDisconnected: instance?.client?.disconnected() ?? false,
    targetCrashed: instance?.client === undefined ? false : targetCrashed(instance.client),
    cleanup: "pending", terminationInitiator: timedOut ? "harness-watchdog" : "host-cleanup",
    processGroupClean: false,
  };
  try {
    if (timedOut) await processGroups.stop(instance.browser, "SIGKILL");
    else await terminateCase(instance, processGroups);
    process.cleanup = timedOut ? "watchdog-sigkill" : "terminated";
    process.processGroupClean = !processGroups.size;
  } finally {
    await new Promise(resolveClose => endpoint.server.close(resolveClose));
  }
  const after = {
    base: await fileIdentity(immutable.base.path),
    durableSyntheticFixture: await arbitraryFileIdentity(immutable.fixture.path, immutable.fixture.displayPath),
  };
  const baseUnchanged = after.base.sha256 === immutable.base.identity.sha256 && after.base.byteCount === immutable.base.identity.byteCount;
  const fixtureUnchanged = after.durableSyntheticFixture.sha256 === immutable.fixture.identity.sha256 &&
    after.durableSyntheticFixture.byteCount === immutable.fixture.identity.byteCount;
  return Object.freeze({
    caseId: config.caseId, origin: `http://${endpoint.host}`, operation: config.operation,
    requestedCap: config.requestedCap, browser: {
      executable: basename(chromium), version: instance?.version ?? "unavailable",
      launchArguments: instance?.argumentsValue?.slice(3) ?? [], profile: "new-disposable-profile",
    }, outcome: {
      classification, injectedNoMemory: false,
      detail: setupError ?? page?.errorMessage ?? null,
      pageObservation: page,
    }, process, fixtureIntegrity: {
      baseBefore: immutable.base.identity, baseAfter: after.base,
      durableSyntheticFixtureBefore: immutable.fixture.identity,
      durableSyntheticFixtureAfter: after.durableSyntheticFixture,
      unchanged: baseUnchanged && fixtureUnchanged,
    }, sourceReachability: {
      selectedWasmServed: endpoint.result.servedPaths.includes("/selected.wasm"),
      selectedBaseServed: false, durableSyntheticFixtureServed: false,
      deniedPaths: endpoint.result.forbiddenRequests.filter(path => path !== "/favicon.ico"),
    },
  });
}

function validateIdentity(value, name) {
  exactKeys(value, ["path", "byteCount", "sha256"], name);
  string(value.path, `${name}.path`); nonnegativeInteger(value.byteCount, `${name}.byteCount`);
  if (!/^[0-9a-f]{64}$/.test(value.sha256)) fail(`${name}.sha256 is invalid`);
}

export function validateCadrM13F05bReport(report) {
  exactKeys(report, ["schema", "profile", "purpose", "sourceRevision", "trackedSourceDirty", "command", "outputDirectory", "toolchain", "inputIdentities", "cases", "portabilityGaps", "cleanup", "cM13Claim"], "report");
  if (report.schema !== CADR_M13_F05B_SCHEMA || report.profile !== PROFILE) fail("report schema/profile differs");
  string(report.purpose, "report.purpose"); string(report.command, "report.command"); string(report.outputDirectory, "report.outputDirectory");
  if (!(typeof report.sourceRevision === "string" && (report.sourceRevision === "unavailable" || /^[0-9a-f]{40}$/.test(report.sourceRevision)))) fail("report.sourceRevision is invalid");
  if (![true, false, "unavailable"].includes(report.trackedSourceDirty)) fail("report.trackedSourceDirty is invalid");
  exactKeys(report.toolchain, ["node", "platform", "architecture", "chromiumRequested"], "report.toolchain");
  for (const key of Object.keys(report.toolchain)) string(report.toolchain[key], `report.toolchain.${key}`);
  exactKeys(report.inputIdentities, ["selectedBase", "durableSyntheticFixture", "selectedWasm", "sources"], "report.inputIdentities");
  validateIdentity(report.inputIdentities.selectedBase, "report.inputIdentities.selectedBase");
  validateIdentity(report.inputIdentities.durableSyntheticFixture, "report.inputIdentities.durableSyntheticFixture");
  validateIdentity(report.inputIdentities.selectedWasm, "report.inputIdentities.selectedWasm");
  if (report.inputIdentities.selectedBase.byteCount !== BASE_BYTES ||
      report.inputIdentities.selectedBase.sha256 !== BASE_SHA256) {
    fail("report selected base identity differs from the selected immutable base");
  }
  if (!Array.isArray(report.inputIdentities.sources) || report.inputIdentities.sources.length < 4) fail("report source identities are incomplete");
  for (const identity of report.inputIdentities.sources) validateIdentity(identity, "report source identity");
  if (!Array.isArray(report.cases) || report.cases.length !== 2) fail("report must contain exactly two one-operation cases");
  const caseIds = new Set();
  for (const item of report.cases) {
    exactKeys(item, ["caseId", "origin", "operation", "requestedCap", "browser", "outcome", "process", "fixtureIntegrity", "sourceReachability"], "report case");
    string(item.caseId, "report case.caseId"); caseIds.add(item.caseId); string(item.origin, "report case.origin"); string(item.operation, "report case.operation");
    exactKeys(item.browser, ["executable", "version", "launchArguments", "profile"], "report case.browser");
    string(item.browser.executable, "report case.browser.executable"); string(item.browser.version, "report case.browser.version"); string(item.browser.profile, "report case.browser.profile");
    if (!Array.isArray(item.browser.launchArguments) || item.browser.launchArguments.some(value => typeof value !== "string")) fail("report case launch arguments are invalid");
    exactKeys(item.outcome, ["classification", "injectedNoMemory", "detail", "pageObservation"], "report case.outcome");
    string(item.outcome.classification, "report case outcome.classification");
    if (!new Set(["browser-oom-exception", "fixed-wasm-capacity-refusal", "renderer-process-loss", "browser-process-loss", "watchdog-terminated-cap-stress", "unexpected-completion", "harness-timeout", "browser-setup-failure"]).has(item.outcome.classification)) {
      fail("report case outcome classification is unknown");
    }
    if (item.outcome.injectedNoMemory !== false || (item.outcome.detail !== null && typeof item.outcome.detail !== "string")) fail("report case outcome is invalid");
    if (item.outcome.pageObservation !== null) {
      exactKeys(item.outcome.pageObservation, ["classification", "stage", "errorName", "errorMessage", "initialBytes", "targetEstimatedBytes"], "report case page observation");
      string(item.outcome.pageObservation.classification, "report case page observation.classification");
      string(item.outcome.pageObservation.stage, "report case page observation.stage");
      if ((item.outcome.pageObservation.errorName !== null && typeof item.outcome.pageObservation.errorName !== "string") ||
          (item.outcome.pageObservation.errorMessage !== null && typeof item.outcome.pageObservation.errorMessage !== "string") ||
          (item.outcome.pageObservation.initialBytes !== null && !Number.isSafeInteger(item.outcome.pageObservation.initialBytes)) ||
          (item.outcome.pageObservation.targetEstimatedBytes !== null && !Number.isSafeInteger(item.outcome.pageObservation.targetEstimatedBytes))) {
        fail("report case page observation values are invalid");
      }
    }
    exactKeys(item.process, ["browserExitCode", "browserExitSignal", "devtoolsDisconnected", "targetCrashed", "cleanup", "terminationInitiator", "processGroupClean"], "report case.process");
    if (item.process.browserExitCode !== null) nonnegativeInteger(item.process.browserExitCode, "report case.process.browserExitCode");
    if (item.process.browserExitSignal !== null) string(item.process.browserExitSignal, "report case.process.browserExitSignal");
    if (typeof item.process.devtoolsDisconnected !== "boolean" || typeof item.process.targetCrashed !== "boolean" || typeof item.process.processGroupClean !== "boolean") fail("report case process boolean is invalid");
    string(item.process.cleanup, "report case.process.cleanup");
    if (!["harness-watchdog", "host-cleanup"].includes(item.process.terminationInitiator)) fail("report case process termination initiator is invalid");
    exactKeys(item.fixtureIntegrity, ["baseBefore", "baseAfter", "durableSyntheticFixtureBefore", "durableSyntheticFixtureAfter", "unchanged"], "report case.fixtureIntegrity");
    for (const key of ["baseBefore", "baseAfter", "durableSyntheticFixtureBefore", "durableSyntheticFixtureAfter"]) validateIdentity(item.fixtureIntegrity[key], `report case.fixtureIntegrity.${key}`);
    if (item.fixtureIntegrity.unchanged !== true ||
        JSON.stringify(item.fixtureIntegrity.baseBefore) !== JSON.stringify(item.fixtureIntegrity.baseAfter) ||
        JSON.stringify(item.fixtureIntegrity.durableSyntheticFixtureBefore) !== JSON.stringify(item.fixtureIntegrity.durableSyntheticFixtureAfter)) fail("report case fixture integrity did not hold");
    exactKeys(item.sourceReachability, ["selectedWasmServed", "selectedBaseServed", "durableSyntheticFixtureServed", "deniedPaths"], "report case.sourceReachability");
    if (typeof item.sourceReachability.selectedWasmServed !== "boolean" || item.sourceReachability.selectedBaseServed !== false || item.sourceReachability.durableSyntheticFixtureServed !== false || !Array.isArray(item.sourceReachability.deniedPaths)) fail("report case source reachability is invalid");
    if (item.sourceReachability.deniedPaths.some(value => typeof value !== "string")) fail("report case denied path is invalid");
    if (item.caseId === "M13-F05B-JS-HEAP") {
      exactKeys(item.requestedCap, ["jsHeapMiB", "targetEstimatedBytes"], "report JS requested cap");
      nonnegativeInteger(item.requestedCap.jsHeapMiB, "report JS requested cap.jsHeapMiB");
      nonnegativeInteger(item.requestedCap.targetEstimatedBytes, "report JS requested cap.targetEstimatedBytes");
    } else if (item.caseId === "M13-F05B-WASM-FIXED") {
      exactKeys(item.requestedCap, ["wasmInitialBytes", "wasmMaximumBytes", "attemptedGrowPages"], "report Wasm requested cap");
      nonnegativeInteger(item.requestedCap.wasmInitialBytes, "report Wasm requested cap.wasmInitialBytes");
      nonnegativeInteger(item.requestedCap.wasmMaximumBytes, "report Wasm requested cap.wasmMaximumBytes");
      nonnegativeInteger(item.requestedCap.attemptedGrowPages, "report Wasm requested cap.attemptedGrowPages");
    } else fail("report case ID is unknown");
    if ((item.caseId === "M13-F05B-WASM-FIXED") !== item.sourceReachability.selectedWasmServed) {
      fail("selected Wasm reachability differs from the one-operation case");
    }
  }
  if (JSON.stringify([...caseIds].sort()) !== JSON.stringify(["M13-F05B-JS-HEAP", "M13-F05B-WASM-FIXED"])) fail("report case IDs differ");
  if (!Array.isArray(report.portabilityGaps) || report.portabilityGaps.length < 3 || report.portabilityGaps.some(value => typeof value !== "string")) fail("report portability gaps are incomplete");
  exactKeys(report.cleanup, ["temporaryOriginsRemoved", "temporaryProfilesRemoved", "allProcessGroupsStopped"], "report.cleanup");
  if (Object.values(report.cleanup).some(value => value !== true)) fail("report cleanup is incomplete");
  exactKeys(report.cM13Claim, ["passes", "reason"], "report.cM13Claim");
  if (report.cM13Claim.passes !== false || typeof report.cM13Claim.reason !== "string") fail("report C-M13 claim is invalid");
  return true;
}

async function gitIdentity() {
  let sourceRevision = "unavailable"; let trackedSourceDirty = "unavailable";
  try { sourceRevision = (await exec("git", ["rev-parse", "HEAD"], { cwd: ROOT })).stdout.trim(); } catch { /* explicitly unavailable */ }
  try { trackedSourceDirty = (await exec("git", ["status", "--porcelain=v1", "--untracked-files=no"], { cwd: ROOT })).stdout.trim().length !== 0; } catch { /* explicitly unavailable */ }
  return { sourceRevision, trackedSourceDirty };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const outputName = await newOutput(options.output);
  const reportPath = resolve(options.output, "report.json");
  const basePath = resolve(ROOT, "l/usim/disk-sys-303-0.img");
  const base = await fileIdentity(basePath);
  if (base.byteCount !== BASE_BYTES || base.sha256 !== BASE_SHA256) fail("selected System 303 base identity differs");
  const selectedWasm = await fileIdentity(options.wasm);
  const wasmBytes = await readFile(options.wasm);
  const campaignRoot = await mkdtemp(resolve(tmpdir(), "cadr-m13-f05b-"));
  const fixturePath = resolve(campaignRoot, "durable-synthetic-fixture.bin");
  const fixtureBytes = Buffer.concat([Buffer.from("CDRM13F05BDUR1", "ascii"), Buffer.from([0]), Buffer.alloc(65536 - 15, 0x5a)]);
  await writeFile(fixturePath, fixtureBytes, { flag: "wx", mode: 0o400 }); await chmod(fixturePath, 0o400);
  const fixtureIdentity = await arbitraryFileIdentity(fixturePath, "generated/durable-synthetic-fixture.bin");
  const immutable = Object.freeze({
    base: { path: basePath, identity: base },
    fixture: { path: fixturePath, displayPath: "generated/durable-synthetic-fixture.bin", identity: fixtureIdentity },
  });
  const sources = await Promise.all([
    fileIdentity(resolve(ROOT, "scripts/run-cadr-m13-f05b-browser-oom.mjs")),
    fileIdentity(resolve(ROOT, "scripts/cadr-process-group-supervisor.mjs")),
    fileIdentity(resolve(ROOT, "scripts/cadr-pdeath-exec.py")),
    fileIdentity(resolve(ROOT, "cadr-web/wasm/cadr_wasm_memory.h")),
    fileIdentity(resolve(ROOT, "cadr-web/wasm/build-wasm.sh")),
  ]);
  const processGroups = new CadrProcessGroupSupervisor();
  let cases = []; let cleanup = { temporaryOriginsRemoved: false, temporaryProfilesRemoved: false, allProcessGroupsStopped: false };
  try {
    const definitions = [
      { caseId: "M13-F05B-JS-HEAP", operation: "js-heap-grow",
        requestedCap: { jsHeapMiB: options.jsHeapMiB, targetEstimatedBytes: options.jsTargetMiB * 1024 * 1024 },
        jsTargetEstimatedBytes: options.jsTargetMiB * 1024 * 1024, wasmBytes: WASM_BYTES },
      { caseId: "M13-F05B-WASM-FIXED", operation: "wasm-grow-past-fixed-maximum",
        requestedCap: { wasmInitialBytes: WASM_BYTES, wasmMaximumBytes: WASM_BYTES, attemptedGrowPages: 1 },
        jsTargetEstimatedBytes: 0, wasmBytes: WASM_BYTES },
    ];
    for (const definition of definitions) {
      /* One fresh HTTP listener/origin and detached browser group per admitted operation. */
      cases.push(await runOneCase({ config: definition, wasmBytes, chromium: options.chromium,
        jsHeapMiB: definition.operation === "js-heap-grow" ? options.jsHeapMiB : null,
        timeoutMs: options.timeoutMs, campaignRoot, processGroups, immutable }));
    }
  } finally {
    try { await processGroups.stopAll("SIGKILL"); cleanup.allProcessGroupsStopped = true; }
    finally { await rm(campaignRoot, { recursive: true, force: true }); cleanup.temporaryOriginsRemoved = true; cleanup.temporaryProfilesRemoved = true; }
  }
  const { sourceRevision, trackedSourceDirty } = await gitIdentity();
  const report = {
    schema: CADR_M13_F05B_SCHEMA, profile: PROFILE,
    purpose: "destructive disposable-browser resource-limit probe; not deterministic NO_MEMORY and not C-M13",
    sourceRevision, trackedSourceDirty,
    command: `node scripts/run-cadr-m13-f05b-browser-oom.mjs --execute --wasm ${relativePortable(options.wasm)} --output build/cadr-m13/${outputName} --chromium ${basename(options.chromium)} --js-heap-mib ${options.jsHeapMiB} --js-target-mib ${options.jsTargetMiB} --timeout-ms ${options.timeoutMs}`,
    outputDirectory: `build/cadr-m13/${outputName}`,
    toolchain: { node: process.version, platform: process.platform, architecture: process.arch, chromiumRequested: basename(options.chromium) },
    inputIdentities: { selectedBase: base, durableSyntheticFixture: fixtureIdentity, selectedWasm, sources },
    cases,
    portabilityGaps: [
      "The --js-flags max-old-space-size control is Chromium/V8-specific and is not a portable browser JavaScript-heap limit API.",
      "Browsers expose no standard self-OOM primitive or uniform renderer-versus-browser process-loss observation; this harness records available DevTools evidence only.",
      "WebAssembly memory reservation, commitment, and allocation-failure disposition depend on engine, operating system, address-space policy, and host pressure; fixed maximum refusal is not a portable physical-OOM proof.",
      "A cap-stressing renderer that neither reports a JavaScript allocation exception nor dies before the deadline is killed by the host watchdog and reported as a watchdog action, not as browser-native OOM loss.",
    ],
    cleanup,
    cM13Claim: { passes: false, reason: "M13-F05b is one focused component probe; every M13 conformance requirement and lower C-M11/C-M12 gate remains independently required." },
  };
  validateCadrM13F05bReport(report);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  const expectedWasm = cases.find(item => item.caseId === "M13-F05B-WASM-FIXED")?.outcome.classification;
  const jsOutcome = cases.find(item => item.caseId === "M13-F05B-JS-HEAP")?.outcome.classification;
  process.stdout.write(`${JSON.stringify({ schema: CADR_M13_F05B_SCHEMA, report: `${relativePortable(options.output)}/report.json`, jsOutcome, wasmOutcome: expectedWasm, cM13Passes: false })}\n`);
  if (expectedWasm !== "fixed-wasm-capacity-refusal" || jsOutcome === "unexpected-completion" || jsOutcome === "browser-setup-failure") {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
