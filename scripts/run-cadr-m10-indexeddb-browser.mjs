#!/usr/bin/env node
/* Run the disposable real-Chromium M10 IndexedDB seam campaign without npm packages. */

import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { CadrProcessGroupSupervisor } from "./cadr-process-group-supervisor.mjs";
import { connectBoundedCdp } from "./cadr-cdp-client.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const chromium = process.env.CHROMIUM ?? "/usr/bin/chromium";
const headed = process.argv.includes("--headed");
const campaignTimeoutMs = Number(process.env.CADR_M10_INDEXEDDB_CAMPAIGN_TIMEOUT_MS ?? "240000");
if (!Number.isSafeInteger(campaignTimeoutMs) || campaignTimeoutMs < 1000 || campaignTimeoutMs > 240000) {
  throw new Error("CADR_M10_INDEXEDDB_CAMPAIGN_TIMEOUT_MS must be an integer from 1000 through 240000");
}
const campaignStorageKey = "cadr-m10-indexeddb-campaign-v2";
const sources = Object.freeze({
  "/cadr-web/browser/cadr-m10-indexeddb-campaign.html":
    ["cadr-web/browser/cadr-m10-indexeddb-campaign.html", "text/html; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb-campaign.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb-campaign.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb-foreign.html":
    ["cadr-web/browser/cadr-m10-indexeddb-foreign.html", "text/html; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb-foreign.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb-foreign.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb-seam-worker.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb-seam-worker.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-controller.mjs":
    ["cadr-web/browser/cadr-m10-controller.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/wasm/cadr-m10-persistence.mjs":
    ["cadr-web/wasm/cadr-m10-persistence.mjs", "text/javascript; charset=utf-8"],
});
const allowlist = new Map(await Promise.all(Object.entries(sources).map(async ([url, [path, type]]) =>
  [url, { bytes: await readFile(resolve(root, path)), type }])));

function serve() {
  let expectedHost = null;
  const server = createServer((request, response) => {
    try {
      if (request.headers.host !== expectedHost) {
        response.writeHead(421, { "content-type": "text/plain; charset=utf-8" });
        response.end("misdirected request");
        return;
      }
      const pathname = new URL(request.url, `http://${expectedHost}`).pathname;
      const entry = allowlist.get(pathname);
      if ((request.method !== "GET" && request.method !== "HEAD") || entry === undefined) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      response.writeHead(200, {
        "content-type": entry.type, "content-length": entry.bytes.byteLength,
        "cache-control": "no-store", "x-content-type-options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : entry.bytes);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
  return { server, setExpectedHost(host) { expectedHost = host; } };
}

function listen(endpoint) {
  return new Promise((resolveListen, reject) => {
    endpoint.server.once("error", reject);
    endpoint.server.listen(0, "127.0.0.1", () => {
      const port = endpoint.server.address().port;
      endpoint.setExpectedHost(`127.0.0.1:${port}`);
      resolveListen(port);
    });
  });
}

function rawStatus(port, path, method = "GET", host = `127.0.0.1:${port}`) {
  return new Promise((resolveStatus, reject) => {
    const request = httpRequest({ host: "127.0.0.1", port, path, method, headers: { host } },
      (response) => { response.resume(); response.on("end", () => resolveStatus(response.statusCode)); });
    request.on("error", reject);
    request.end();
  });
}

async function proveServerIsolation(port) {
  const privatePaths = [
    "/AGENTS.md", "/.git/config", "/build/private.vlod",
    "/docs/mit-cadr/cadr-private-disk-overlay-reimplementation-specification.md",
    "/cadr-web/browser/m7-demo.html", "/%2e%2e/%2e%2e/etc/passwd",
  ];
  for (const path of privatePaths) {
    for (const method of ["GET", "HEAD"]) {
      const status = await rawStatus(port, path, method);
      if (status !== 404) throw new Error(`${method} ${path} escaped the exact HTTP allowlist: ${status}`);
    }
  }
  if (await rawStatus(port, "/cadr-web/browser/cadr-m10-indexeddb-campaign.html", "HEAD") !== 200) {
    throw new Error("allowlisted HEAD request failed");
  }
  if (await rawStatus(port, "/cadr-web/browser/cadr-m10-indexeddb-campaign.html", "GET", "evil.invalid") !== 421) {
    throw new Error("HTTP Host validation failed");
  }
}

const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

function debuggerEndpoint(browser, stderrState) {
  return new Promise((resolveEndpoint, reject) => {
    const deadline = setTimeout(() => reject(new Error(`Chromium DevTools endpoint did not appear:\n${stderrState.text}`)), 10000);
    const inspect = (data) => {
      stderrState.text += data;
      const match = stderrState.text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match !== null) {
        clearTimeout(deadline);
        browser.stderr.off("data", inspect);
        browser.stderr.on("data", (chunk) => { stderrState.text += chunk; });
        resolveEndpoint(match[1]);
      }
    };
    browser.stderr.on("data", inspect);
    browser.once("exit", (code) => {
      clearTimeout(deadline);
      reject(new Error(`Chromium exited before DevTools was ready (${code}):\n${stderrState.text}`));
    });
  });
}

const first = serve();
const second = serve();
const processGroups = new CadrProcessGroupSupervisor();
const userData = await mkdtemp(join(tmpdir(), "cadr-m10-idb-chromium-"));
try {
  const firstPort = await listen(first);
  const secondPort = await listen(second);
  await proveServerIsolation(firstPort);
  await proveServerIsolation(secondPort);
  const target = `http://127.0.0.1:${firstPort}/cadr-web/browser/cadr-m10-indexeddb-campaign.html?foreign=${secondPort}`;
  const browser = processGroups.track(spawn(chromium, [
    ...(headed ? [] : ["--headless=new"]), "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-background-networking",
    "--remote-allow-origins=*", "--remote-debugging-port=0",
    `--user-data-dir=${userData}`, "about:blank",
  ], { detached: true, stdio: ["ignore", "ignore", "pipe"] }));
  const stderrState = { text: "" };
  let debuggerClient;
  try {
    const browserEndpoint = await debuggerEndpoint(browser, stderrState);
    const debugOrigin = new URL(browserEndpoint);
    const tab = await (await fetch(`http://127.0.0.1:${debugOrigin.port}/json/new?about:blank`,
      { method: "PUT" })).json();
    /* All calls, including setup, share the campaign's one deadline.  A
     * closed/erroring DevTools socket rejects every pending call immediately. */
    const deadline = Date.now() + campaignTimeoutMs;
    debuggerClient = await connectBoundedCdp(tab.webSocketDebuggerUrl, { deadline });
    await debuggerClient.call("Page.enable");
    await debuggerClient.call("Runtime.enable");
    await debuggerClient.call("Page.navigate", { url: target });
    let result = null; let lastObservation = null; let lastProgress = null;
    while (Date.now() < deadline) {
      await pause(100);
      const evaluated = await debuggerClient.call("Runtime.evaluate", {
        expression: `document.body === null ? null : JSON.stringify({status:document.body.dataset.status,text:document.body.textContent,campaign:sessionStorage.getItem(${JSON.stringify(campaignStorageKey)})})`,
        returnByValue: true,
      });
      /* A newly-created DevTools target may answer one evaluate while its
       * initial execution context is being replaced by navigation.  That is
       * not a campaign result; wait for the stable page context rather than
       * treating CDP's undefined value as malformed campaign JSON. */
      if (evaluated.exceptionDetails !== undefined) {
        throw new Error(`campaign status evaluation failed: ${evaluated.exceptionDetails.text ?? "unknown exception"}\n` +
          JSON.stringify(evaluated.exceptionDetails));
      }
      if (typeof evaluated.result?.value !== "string") continue;
      result = JSON.parse(evaluated.result.value);
      lastObservation = result;
      try {
        const progress = JSON.parse(result.campaign ?? "null")?.index;
        if (Number.isInteger(progress) && progress !== lastProgress) {
          lastProgress = progress;
          console.log(`Chromium campaign progress: durable scenario ${progress}/18`);
        }
      } catch { /* nonterminal diagnostic output must not change test semantics */ }
      if (result.status === "ok" || result.status === "failed") break;
    }
    if (result?.status !== "ok" && result?.status !== "failed") {
      throw new Error(`Chromium campaign exceeded ${campaignTimeoutMs} ms without a terminal page status:\n` +
        JSON.stringify(lastObservation));
    }
    if (result?.status !== "ok" || !/"results":18/.test(result.text) ||
      !/"followups":9/.test(result.text) || !/"activationBoundary":4096/.test(result.text) ||
      !/"opaqueReferenceMigration":true/.test(result.text) ||
      !/"crossKindReferenceForgery":true/.test(result.text) ||
      !/"reviewAuthority":true/.test(result.text) || !/"lax":0/.test(result.text)) {
      throw new Error(`Chromium campaign failed: ${result?.text ?? "completion timeout"}\n${stderrState.text}`);
    }
  } finally {
    debuggerClient?.close();
    /* The group supervisor gives SIGTERM bounded grace, then SIGKILL, and
     * refuses a campaign that cannot prove the detached browser exited. */
    await processGroups.stop(browser, "SIGTERM");
  }
  console.log(`cadr_m10_indexeddb_browser.mjs: ok (Chromium ${headed ? "headed" : "headless"}; exact HTTP allowlist; 6 seams x abort/terminate/reload)`);
} finally {
  const cleanupFailures = [];
  for (const cleanup of [
    () => processGroups.stopAll("SIGKILL"),
    () => new Promise((resolveClose, rejectClose) =>
      first.server.close(error => error ? rejectClose(error) : resolveClose())),
    () => new Promise((resolveClose, rejectClose) =>
      second.server.close(error => error ? rejectClose(error) : resolveClose())),
    () => rm(userData, { recursive: true, force: true }),
  ]) {
    try { await cleanup(); } catch (error) { cleanupFailures.push(error); }
  }
  if (cleanupFailures.length === 1) throw cleanupFailures[0];
  if (cleanupFailures.length > 1) {
    throw new AggregateError(cleanupFailures,
      "C-M10 Chromium campaign cleanup failed");
  }
}
