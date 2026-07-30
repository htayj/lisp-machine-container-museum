#!/usr/bin/env node
/* Run the disposable real-Chromium M10 IndexedDB seam campaign without npm packages. */

import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const chromium = process.env.CHROMIUM ?? "/usr/bin/chromium";
const headed = process.argv.includes("--headed");
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

async function connectDebugger(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  let sequence = 0;
  await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter !== undefined) {
      pending.delete(message.id);
      message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
    }
  };
  return {
    call(method, params = {}) {
      const id = ++sequence;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

const first = serve();
const second = serve();
const userData = await mkdtemp(join(tmpdir(), "cadr-m10-idb-chromium-"));
try {
  const firstPort = await listen(first);
  const secondPort = await listen(second);
  await proveServerIsolation(firstPort);
  await proveServerIsolation(secondPort);
  const target = `http://127.0.0.1:${firstPort}/cadr-web/browser/cadr-m10-indexeddb-campaign.html?foreign=${secondPort}`;
  const browser = spawn(chromium, [
    ...(headed ? [] : ["--headless=new"]), "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-background-networking",
    "--remote-allow-origins=*", "--remote-debugging-port=0",
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const stderrState = { text: "" };
  let debuggerClient;
  try {
    const browserEndpoint = await debuggerEndpoint(browser, stderrState);
    const debugOrigin = new URL(browserEndpoint);
    const tab = await (await fetch(`http://127.0.0.1:${debugOrigin.port}/json/new?about:blank`,
      { method: "PUT" })).json();
    debuggerClient = await connectDebugger(tab.webSocketDebuggerUrl);
    await debuggerClient.call("Page.enable");
    await debuggerClient.call("Runtime.enable");
    await debuggerClient.call("Page.navigate", { url: target });
    let result = null;
    for (let attempt = 0; attempt < 1800; attempt += 1) {
      await pause(100);
      const evaluated = await debuggerClient.call("Runtime.evaluate", {
        expression: "JSON.stringify({status:document.body.dataset.status,text:document.body.textContent})",
        returnByValue: true,
      });
      result = JSON.parse(evaluated.result.value);
      if (result.status === "ok" || result.status === "failed") break;
    }
    if (result?.status !== "ok" || !/"results":18/.test(result.text) ||
      !/"followups":9/.test(result.text) || !/"activationBoundary":4096/.test(result.text) ||
      !/"lax":0/.test(result.text)) {
      throw new Error(`Chromium campaign failed: ${result?.text ?? "completion timeout"}\n${stderrState.text}`);
    }
  } finally {
    debuggerClient?.close();
    if (browser.exitCode === null) {
      browser.kill("SIGTERM");
      await new Promise((resolveClose) => browser.once("close", resolveClose));
    }
  }
  console.log(`cadr_m10_indexeddb_browser.mjs: ok (Chromium ${headed ? "headed" : "headless"}; exact HTTP allowlist; 6 seams x abort/terminate/reload)`);
} finally {
  await new Promise((resolveClose) => first.server.close(resolveClose));
  await new Promise((resolveClose) => second.server.close(resolveClose));
  await rm(userData, { recursive: true, force: true });
}
