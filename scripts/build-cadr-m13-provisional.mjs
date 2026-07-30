#!/usr/bin/env node
/* Produce the M13 build-local policy harness and a separate provenance report.
 * This is not an M14 release manifest and does not claim a runnable CADR image. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = resolve(ROOT, "build/cadr-m13");
const argument = process.argv.indexOf("--output");
const output = argument === -1 ? resolve(OUTPUT_ROOT, "provisional") : resolve(ROOT, process.argv[argument + 1] ?? "");
const outputName = relative(OUTPUT_ROOT, output);
/* An M13 artifact must be a newly-created ignored leaf.  In particular, this
 * builder does not clean, replace, or recursively delete any caller path. */
if (!outputName || outputName.startsWith("..") || outputName.includes(sep)) {
  throw new Error("--output must be a direct new child of build/cadr-m13/");
}
try { await stat(output); throw new Error(`refusing to replace existing output: ${relative(ROOT, output)}`); }
catch (error) { if (error?.code !== "ENOENT") throw error; }
const reportPath = resolve(OUTPUT_ROOT, `${basename(output)}.inventory.json`);
try { await stat(reportPath); throw new Error(`refusing to replace existing inventory: ${relative(ROOT, reportPath)}`); }
catch (error) { if (error?.code !== "ENOENT") throw error; }
const inputs = Object.freeze([
  ["/index.html", "cadr-web/browser/cadr-m13-shell.html", "index.html", "generated-public-output", ["DOM", "CSP document"]],
  ["/cadr-shell.mjs", "cadr-web/browser/cadr-m13-artifact-shell.mjs", "cadr-shell.mjs", "generated-public-output", ["DOM", "module script"]],
  ["/cadr-shell.css", "cadr-web/browser/cadr-m13-shell.css", "cadr-shell.css", "generated-public-output", ["CSS"]],
  ["/cadr-worker.js", "cadr-web/browser/cadr-m13-artifact-worker.mjs", "cadr-worker.js", "generated-public-output", ["dedicated-worker"]],
]);
const hash = value => createHash("sha256").update(value).digest("hex");
const nonce = value => createHash("sha256").update(value).digest("base64");
await mkdir(OUTPUT_ROOT, { recursive: true });
const outputRootInfo = await lstat(OUTPUT_ROOT);
if (!outputRootInfo.isDirectory() || outputRootInfo.isSymbolicLink()) {
  throw new Error("build/cadr-m13 must be a real directory");
}
await mkdir(output);
const files = [];
const sourceContents = new Map();
for (const [, source] of inputs) sourceContents.set(source, await readFile(resolve(ROOT, source)));
/* The nonce is deterministic for this named build input set.  It is not a
 * release signature or a secret; it is an exact-CSP capability that prevents
 * an unlisted same-origin script URL from becoming executable in this closed
 * policy harness. */
const policyNonce = nonce(Buffer.concat([
  sourceContents.get("cadr-web/browser/cadr-m13-artifact-shell.mjs"),
  sourceContents.get("cadr-web/browser/cadr-m13-shell.css"),
]));
for (const [url, source, name, provenance, capabilities] of inputs) {
  const destination = resolve(output, name); const content = sourceContents.get(source);
  const outputContent = name === "index.html" ? Buffer.from(content.toString("utf8").replaceAll("__CADR_M13_NONCE__", policyNonce), "utf8") : content;
  if (name === "index.html" && outputContent.toString("utf8").includes("__CADR_M13_NONCE__")) throw new Error("M13 HTML nonce replacement was incomplete");
  await writeFile(destination, outputContent, { flag: "wx" });
  const sourceSha256 = hash(content);
  files.push({ url, source, output: name, byteCount: content.byteLength,
    sourceSha256, outputSha256: hash(outputContent), provenance, capabilities });
}
let revision = "unavailable";
try { revision = (await exec("git", ["rev-parse", "HEAD"], { cwd: ROOT })).stdout.trim(); } catch { /* report the missing source identity explicitly */ }
let trackedSourceDirty = "unavailable";
try {
  const { stdout } = await exec("git", ["status", "--porcelain=v1", "--untracked-files=no"], { cwd: ROOT });
  trackedSourceDirty = stdout.length !== 0;
} catch { /* Preserve a missing VCS observation as unavailable, not clean. */ }
const closure = files.map(({ url, source, output: outputNameValue, sourceSha256, outputSha256 }) =>
  ({ url, source, output: outputNameValue, sourceSha256, outputSha256 }));
const report = {
  schema: "cadr-m13-provisional-inventory-v1", profile: "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2",
  purpose: "build-local CSP and offline policy harness; not an M14 release manifest",
  sourceRevision: revision, trackedSourceDirty,
  outputDirectory: relative(ROOT, output),
  buildCommand: `node scripts/build-cadr-m13-provisional.mjs --output ${relative(ROOT, output)}`,
  toolchain: { node: process.version }, bootstrap: files,
  contentClosureSha256: hash(JSON.stringify(closure)),
  cspNonceSha256: hash(Buffer.from(policyNonce, "utf8")),
  absentOptionalCapabilities: ["cadr.wasm", "cadr-audio-worklet.mjs"],
  excluded: ["user-supplied System 303 disk", "private M10 overlay", "licensed or local-only media"],
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
process.stdout.write(`${JSON.stringify({ artifact: relative(ROOT, output), report: relative(ROOT, reportPath), files: files.length })}\n`);
