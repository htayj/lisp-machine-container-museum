#!/usr/bin/env node
/*
 * External Chromium process-kill oracle for C-M10.  This is deliberately a
 * host supervisor: the page cannot turn its own termination into a success.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS,
} from
  "../cadr-web/browser/cadr-m10-indexeddb.mjs";
import { CadrProcessGroupSupervisor } from
  "./cadr-process-group-supervisor.mjs";
const KILL_SEAMS = Object.freeze([
  ...CADR_M10_INDEXEDDB_DURABLE_SEAMS,
  ...CADR_M10_INDEXEDDB_TRANSACTION_KILL_SEAMS,
]);

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const PYTHON = process.env.PYTHON ?? "/usr/bin/python3";
const PDEATH_EXEC = resolve(ROOT, "scripts/cadr-pdeath-exec.py");
const processGroups = new CadrProcessGroupSupervisor();
for (const [signal, status] of [["SIGINT", 130], ["SIGTERM", 143],
  ["SIGHUP", 129]]) {
  process.once(signal, () => {
    processGroups.killAll("SIGKILL");
    process.exit(status);
  });
}
const CHROMIUM = process.env.CHROMIUM ?? "/usr/bin/chromium";
const BASE_PATH = resolve(process.env.CADR_M10_BASE_IMAGE ??
  resolve(ROOT, "l/usim/disk-sys-303-0.img"));
const BASE_BYTES = 269562880;
const BASE_SHA256 =
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5";
const baseStat = await stat(BASE_PATH);
if (baseStat.size !== BASE_BYTES) {
  throw new Error(`C-M10 selected base size differs: ${baseStat.size}`);
}
const baseDigest = await new Promise((resolveDigest, rejectDigest) => {
  const digest = createHash("sha256");
  const stream = createReadStream(BASE_PATH);
  stream.on("data", chunk => digest.update(chunk));
  stream.on("error", rejectDigest);
  stream.on("end", () => resolveDigest(digest.digest("hex")));
});
if (baseDigest !== BASE_SHA256) {
  throw new Error(`C-M10 selected base SHA-256 differs: ${baseDigest}`);
}
const baseFile = await open(BASE_PATH, "r");
const baseIdentity = Buffer.from(JSON.stringify({
  byteLength: BASE_BYTES, sha256: BASE_SHA256,
}));
const sources = Object.freeze({
  "/cadr-web/browser/cadr-m10-process-kill.html":
    ["cadr-web/browser/cadr-m10-process-kill.html", "text/html; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-process-kill.mjs":
    ["cadr-web/browser/cadr-m10-process-kill.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-controller.mjs":
    ["cadr-web/browser/cadr-m10-controller.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-process-controller-worker.mjs":
    ["cadr-web/browser/cadr-m10-process-controller-worker.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-process-guest-worker.mjs":
    ["cadr-web/browser/cadr-m10-process-guest-worker.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/browser/cadr-m10-indexeddb.mjs":
    ["cadr-web/browser/cadr-m10-indexeddb.mjs", "text/javascript; charset=utf-8"],
  "/cadr-web/wasm/cadr-m10-persistence.mjs":
    ["cadr-web/wasm/cadr-m10-persistence.mjs", "text/javascript; charset=utf-8"],
});
const allowlist = new Map(await Promise.all(
  Object.entries(sources).map(async ([url, [path, type]]) =>
    [url, { bytes: await readFile(resolve(ROOT, path)), type }])));

function listen() {
  const endpoint = { host: null };
  endpoint.server = createServer((request, response) => {
    const pathname = (() => {
      try { return new URL(request.url, `http://${endpoint.host}`).pathname; }
      catch { return ""; }
    })();
    const validHost = request.headers.host === endpoint.host;
    const commonHeaders = {
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
      "cross-origin-resource-policy": "same-origin",
      "x-content-type-options": "nosniff",
    };
    if (validHost && request.method === "GET" &&
        pathname === "/cadr-m10-base-identity.json") {
      response.writeHead(200, {
        ...commonHeaders, "content-type": "application/json",
        "content-length": baseIdentity.byteLength, "cache-control": "no-store",
      });
      response.end(baseIdentity);
      return;
    }
    if (validHost && request.method === "GET" &&
        pathname === "/cadr-m10-base.img") {
      const match = /^bytes=([0-9]+)-([0-9]+)$/.exec(
        request.headers.range ?? "");
      if (match === null) {
        response.writeHead(416, commonHeaders); response.end(); return;
      }
      const start = Number(match[1]); const end = Number(match[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
          start < 0 || end < start || end >= BASE_BYTES ||
          end - start + 1 > 1024) {
        response.writeHead(416, commonHeaders); response.end(); return;
      }
      const output = Buffer.alloc(end - start + 1);
      void baseFile.read(output, 0, output.byteLength, start).then(result => {
        if (result.bytesRead !== output.byteLength) {
          response.destroy(new Error("short selected-base read")); return;
        }
        response.writeHead(206, {
          ...commonHeaders, "content-type": "application/octet-stream",
          "content-length": output.byteLength,
          "content-range": `bytes ${start}-${end}/${BASE_BYTES}`,
          "cache-control": "no-store",
        });
        response.end(output);
      }, error => response.destroy(error));
      return;
    }
    const entry = validHost &&
      ["GET", "HEAD"].includes(request.method) ?
      allowlist.get(pathname) : undefined;
    if (entry === undefined) {
      response.writeHead(validHost ? 404 : 421,
        { ...commonHeaders, "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      ...commonHeaders,
      "content-type": entry.type, "content-length": entry.bytes.byteLength,
      "cache-control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : entry.bytes);
  });
  return new Promise((resolveListen, reject) => {
    endpoint.server.once("error", reject);
    endpoint.server.listen(0, "127.0.0.1", () => {
      endpoint.host = `127.0.0.1:${endpoint.server.address().port}`;
      resolveListen(endpoint);
    });
  });
}

function debuggerEndpoint(browser, stderr) {
  return new Promise((resolveEndpoint, reject) => {
    const timeout = setTimeout(() =>
      reject(new Error(`Chromium DevTools endpoint timed out:\n${stderr.text}`)),
    15000);
    const inspect = chunk => {
      stderr.text += chunk;
      const match = stderr.text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match !== null) {
        clearTimeout(timeout); browser.stderr.off("data", inspect);
        browser.stderr.on("data", value => { stderr.text += value; });
        resolveEndpoint(match[1]);
      }
    };
    browser.stderr.on("data", inspect);
    browser.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`Chromium exited before DevTools (${code}):\n${stderr.text}`));
    });
  });
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map(); let next = 0;
  await new Promise((resolveOpen, reject) => {
    socket.onopen = resolveOpen; socket.onerror = reject;
  });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (waiter !== undefined) {
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    }
  };
  return {
    call(method, params = {}) {
      const id = ++next;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function launch(userData) {
  const browser = processGroups.track(spawn(PYTHON, [
    PDEATH_EXEC, String(process.pid), CHROMIUM,
    "--headless=new", "--disable-gpu", "--no-first-run",
    "--no-default-browser-check", "--disable-background-networking",
    "--remote-allow-origins=*", "--remote-debugging-port=0",
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], detached: true }));
  const stderr = { text: "" };
  try {
    const endpoint = await debuggerEndpoint(browser, stderr);
    const origin = new URL(endpoint);
    const tab = await (await fetch(
      `http://127.0.0.1:${origin.port}/json/new?about:blank`,
      { method: "PUT" })).json();
    const client = await connect(tab.webSocketDebuggerUrl);
    await client.call("Page.enable"); await client.call("Runtime.enable");
    return { browser, client, stderr };
  } catch (error) {
    await processGroups.stop(browser, "SIGKILL");
    throw error;
  }
}

const pause = milliseconds => new Promise(resolvePause =>
  setTimeout(resolvePause, milliseconds));

async function navigateAndWait(instance, url, wanted) {
  await instance.client.call("Page.navigate", { url });
  let state = null;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    await pause(100);
    try {
      const result = await instance.client.call("Runtime.evaluate", {
        expression: "JSON.stringify({status:document.body.dataset.status,text:document.body.textContent})",
        returnByValue: true,
      });
      state = JSON.parse(result.result.value);
      if (state.status === wanted || state.status === "failed") break;
    } catch { /* navigation execution context changed */ }
  }
  if (state?.status !== wanted) {
    throw new Error(`C-M10 page did not reach ${wanted}: ${state?.text ??
      "timeout"}\n${instance.stderr.text}`);
  }
  return JSON.parse(state.text);
}

async function stop(instance, signal = "SIGTERM") {
  instance.client?.close();
  await processGroups.stop(instance.browser, signal);
}

const endpoint = await listen();
const campaignRoot = await mkdtemp(join(tmpdir(), "cadr-m10-process-kill-"));
try {
  const results = [];
  for (let index = 0; index < KILL_SEAMS.length;
    index += 1) {
    const seam = KILL_SEAMS[index];
    const userData = resolve(campaignRoot, `profile-${index}`);
    const prefix = `cadr-m10-process-kill-${index}`;
    let instance = null;
    try {
      instance = await launch(userData);
      const prepare = new URL(
        `http://${endpoint.host}/cadr-web/browser/cadr-m10-process-kill.html`);
      prepare.searchParams.set("action", "prepare");
      prepare.searchParams.set("seam", seam);
      prepare.searchParams.set("prefix", prefix);
      const roots = await navigateAndWait(instance, prepare.href, "kill-ready");
      await stop(instance, "SIGKILL");
      instance = null;

      instance = await launch(userData);
      const verify = new URL(prepare);
      verify.searchParams.set("action", "verify");
      verify.searchParams.set("old", roots.oldRoot);
      const result = await navigateAndWait(instance, verify.href, "ok");
      results.push(result);
    } finally {
      if (instance !== null) await stop(instance);
    }
  }
  if (results.length !== KILL_SEAMS.length ||
      results.some((result, index) =>
        result.seam !== KILL_SEAMS[index])) {
    throw new Error("external process-kill result ledger is incomplete");
  }
  process.stdout.write(`${JSON.stringify({
    schema: "cadr-m10-external-process-kill-v1",
    outcome: "old-or-new", results,
    limitation: "process-kill-not-os-power-removal",
  })}\n`);
} finally {
  let processGroupError = null;
  try { await processGroups.stopAll("SIGKILL"); }
  catch (error) { processGroupError = error; }
  await new Promise(resolveClose => endpoint.server.close(resolveClose));
  await baseFile.close();
  await rm(campaignRoot, { recursive: true, force: true });
  if (processGroupError !== null) throw processGroupError;
}
