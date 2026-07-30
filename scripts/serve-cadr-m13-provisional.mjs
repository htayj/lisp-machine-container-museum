#!/usr/bin/env node
/* Small deliberately closed local server for the M13 CSP test harness. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export async function cadrM13ProvisionalCsp(root) {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const nonces = [...html.matchAll(/\bnonce="([A-Za-z0-9+/]+={0,2})"/g)].map(match => match[1]);
  if (nonces.length !== 2 || nonces[0] !== nonces[1]) throw new Error("M13 provisional HTML has no single canonical CSP nonce");
  const nonce = nonces[0];
  return `default-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; style-src 'nonce-${nonce}'; img-src 'none'; font-src 'none'; worker-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
}
export function createCadrM13ProvisionalServer(root) {
  const files = new Map([["/", "index.html"], ["/index.html", "index.html"], ["/cadr-shell.mjs", "cadr-shell.mjs"], ["/cadr-shell.css", "cadr-shell.css"], ["/cadr-worker.js", "cadr-worker.js"]]);
  const mime = Object.freeze({ ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" });
  return createServer(async (request, response) => {
    let csp;
    try { csp = await cadrM13ProvisionalCsp(root); }
    catch { response.writeHead(500, { "Cache-Control": "no-store" }); response.end(); return; }
    const name = files.get(new URL(request.url, "http://localhost").pathname);
    if (request.method !== "GET" || name === undefined) { response.writeHead(404, { "Content-Security-Policy": csp, "Cache-Control": "no-store" }); response.end(); return; }
    const path = resolve(root, name);
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(404); response.end(); return; }
    try { const body = await readFile(path); response.writeHead(200, { "Content-Type": mime[name.slice(name.lastIndexOf("."))], "Content-Security-Policy": csp, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(body); }
    catch { response.writeHead(404, { "Content-Security-Policy": csp, "Cache-Control": "no-store" }); response.end(); }
  });
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootArgument = process.argv.indexOf("--root"); const portArgument = process.argv.indexOf("--port");
  const root = resolve(process.cwd(), rootArgument === -1 ? "build/cadr-m13/provisional" : process.argv[rootArgument + 1] ?? "");
  const port = portArgument === -1 ? 0 : Number.parseInt(process.argv[portArgument + 1] ?? "", 10);
  const server = createCadrM13ProvisionalServer(root);
  server.listen(port, "127.0.0.1", () => process.stdout.write(`${JSON.stringify({ port: server.address().port })}\n`));
}
