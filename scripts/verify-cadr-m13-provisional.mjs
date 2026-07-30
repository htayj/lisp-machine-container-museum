#!/usr/bin/env node
/* Read-only verifier for one M13 build-local policy artifact.  It deliberately
 * verifies the named ignored build leaf rather than discovering a convenient
 * neighbouring artifact.  This is M13 inventory evidence, not an M14 release
 * reproduction or a claim that any guest media was packaged. */
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = resolve(ROOT, "build/cadr-m13");
const PROFILE = "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2";
const argument = name => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
};
const artifactArgument = argument("--artifact");
const inventoryArgument = argument("--inventory");
if (artifactArgument === null || inventoryArgument === null) {
  throw new Error("usage: verify-cadr-m13-provisional.mjs --artifact <direct build/cadr-m13 child> --inventory <matching inventory JSON>");
}
const artifact = resolve(ROOT, artifactArgument);
const inventoryPath = resolve(ROOT, inventoryArgument);
const artifactName = relative(OUTPUT_ROOT, artifact);
if (!artifactName || artifactName.startsWith("..") || artifactName.includes(sep) || basename(inventoryPath) !== `${artifactName}.inventory.json`) {
  throw new Error("artifact/inventory must name one direct build/cadr-m13 child and matching report");
}
const artifactInfo = await lstat(artifact);
const inventoryInfo = await lstat(inventoryPath);
if (!artifactInfo.isDirectory() || artifactInfo.isSymbolicLink() || !inventoryInfo.isFile() || inventoryInfo.isSymbolicLink()) {
  throw new Error("artifact and inventory must be regular non-symlink build-local objects");
}
const report = JSON.parse(await readFile(inventoryPath, "utf8"));
if (report.schema !== "cadr-m13-provisional-inventory-v1" || report.profile !== PROFILE ||
    report.outputDirectory !== relative(ROOT, artifact)) throw new Error("M13 inventory identity/profile mismatch");
if (!Array.isArray(report.bootstrap) || report.bootstrap.length !== 4) throw new Error("M13 bootstrap inventory is not closed");
const expected = new Map([
  ["index.html", "/index.html"], ["cadr-shell.mjs", "/cadr-shell.mjs"],
  ["cadr-shell.css", "/cadr-shell.css"], ["cadr-worker.js", "/cadr-worker.js"],
]);
const actualNames = (await readdir(artifact, { withFileTypes: true })).map(entry => {
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("M13 artifact contains a nonregular or symlink entry");
  return entry.name;
}).sort();
if (JSON.stringify(actualNames) !== JSON.stringify([...expected.keys()].sort())) throw new Error("M13 artifact has unlisted or missing bytes");
const hash = value => createHash("sha256").update(value).digest("hex");
const closure = [];
for (const entry of report.bootstrap) {
  if (entry === null || typeof entry !== "object" || expected.get(entry.output) !== entry.url ||
      typeof entry.source !== "string" || entry.source.startsWith("/") || entry.source.includes("..") ||
      !/^[0-9a-f]{64}$/.test(entry.sourceSha256) || !/^[0-9a-f]{64}$/.test(entry.outputSha256)) {
    throw new Error("M13 bootstrap entry is malformed");
  }
  const bytes = await readFile(resolve(artifact, entry.output));
  if (hash(bytes) !== entry.outputSha256) throw new Error(`M13 output hash mismatch: ${entry.output}`);
  const text = bytes.toString("utf8");
  /* Narrow deterministic disclosure/capability scan.  It does not make a legal
   * privacy conclusion; it prevents a known private path, credential marker, or
   * network-scheme capability from silently entering this policy artifact. */
  if (/\/home\/|file:\/\/|BEGIN [A-Z ]*PRIVATE KEY|password\s*=|authorization\s*:/i.test(text) ||
      /\b(?:https?|wss?):/i.test(text)) throw new Error(`M13 forbidden path, secret marker, or URL capability: ${entry.output}`);
  closure.push({ url: entry.url, source: entry.source, output: entry.output,
    sourceSha256: entry.sourceSha256, outputSha256: entry.outputSha256 });
}
const closureHash = hash(JSON.stringify(closure));
if (closureHash !== report.contentClosureSha256) throw new Error("M13 content closure hash mismatch");
const html = await readFile(resolve(artifact, "index.html"), "utf8");
const nonce = [...html.matchAll(/\bnonce="([A-Za-z0-9+/]+={0,2})"/g)].map(match => match[1]);
if (nonce.length !== 2 || nonce[0] !== nonce[1] || hash(Buffer.from(nonce[0], "utf8")) !== report.cspNonceSha256) {
  throw new Error("M13 CSP nonce/inventory mismatch");
}
process.stdout.write(`${JSON.stringify({ schema: "cadr-m13-provisional-verify-v1", artifact: relative(ROOT, artifact), inventory: relative(ROOT, inventoryPath), contentClosureSha256: closureHash, files: actualNames.length })}\n`);
