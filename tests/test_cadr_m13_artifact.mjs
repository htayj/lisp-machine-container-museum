import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

import { cadrM13ProvisionalCsp } from "../scripts/serve-cadr-m13-provisional.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactName = `artifact-test-${process.pid}`;
const output = resolve(ROOT, "build/cadr-m13", artifactName);
const reportPath = resolve(ROOT, "build/cadr-m13", `${artifactName}.inventory.json`);

function run(command, argumentsValue) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, argumentsValue, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", value => { stdout += value; }); child.stderr.on("data", value => { stderr += value; });
    child.on("error", reject); child.on("close", code => code === 0 ? resolveRun({ stdout, stderr }) : reject(new Error(`${command} failed (${code}): ${stderr}`)));
  });
}

try {
  const protectedName = `protected-test-${process.pid}`;
  const protectedOutput = resolve(ROOT, "build/cadr-m13", protectedName);
  await mkdir(protectedOutput, { recursive: true });
  await writeFile(resolve(protectedOutput, "must-survive"), "M13 builder must not delete this\n");
  await assert.rejects(
    run(process.execPath, ["scripts/build-cadr-m13-provisional.mjs", "--output", protectedOutput]),
    /refusing to replace existing output/,
  );
  assert.equal(await readFile(resolve(protectedOutput, "must-survive"), "utf8"), "M13 builder must not delete this\n");
  await rm(protectedOutput, { recursive: true, force: true });
  await assert.rejects(
    run(process.execPath, ["scripts/build-cadr-m13-provisional.mjs", "--output", resolve(ROOT, "docs")]),
    /direct new child of build\/cadr-m13/,
  );
  await run(process.execPath, ["scripts/build-cadr-m13-provisional.mjs", "--output", output]);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(report.schema, "cadr-m13-provisional-inventory-v1");
  assert.equal(report.profile, "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2");
  assert.deepEqual(report.bootstrap.map(item => item.url), ["/index.html", "/cadr-shell.mjs", "/cadr-shell.css", "/cadr-worker.js"]);
  assert.ok(report.bootstrap.every(item => item.byteCount > 0 && /^[0-9a-f]{64}$/.test(item.sourceSha256) && /^[0-9a-f]{64}$/.test(item.outputSha256)));
  assert.ok(report.bootstrap.every(item => !item.source.startsWith("/")), "provenance has portable source paths only");
  assert.equal(report.outputDirectory, `build/cadr-m13/${artifactName}`);
  assert.match(report.contentClosureSha256, /^[0-9a-f]{64}$/);
  assert.ok(report.trackedSourceDirty === true || report.trackedSourceDirty === false || report.trackedSourceDirty === "unavailable");
  assert.match(report.cspNonceSha256, /^[0-9a-f]{64}$/);

  const html = await readFile(resolve(output, "index.html"), "utf8");
  const script = await readFile(resolve(output, "cadr-shell.mjs"), "utf8");
  assert.match(html, /<script type="module" src="\/cadr-shell\.mjs" nonce="[A-Za-z0-9+/]+={0,2}"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="\/cadr-shell\.css" nonce="[A-Za-z0-9+/]+={0,2}">/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\bon\w+\s*=/i);
  assert.doesNotMatch(`${html}\n${script}`, /serviceWorker|fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval\(|new Function/);

  const verified = await run(process.execPath, ["scripts/verify-cadr-m13-provisional.mjs", "--artifact",
    output, "--inventory", reportPath]);
  const verification = JSON.parse(verified.stdout);
  assert.equal(verification.schema, "cadr-m13-provisional-verify-v1");
  assert.equal(verification.files, 4);
  await writeFile(resolve(output, "cadr-shell.mjs"), `${script}\n/* test-only tamper */\n`);
  await assert.rejects(run(process.execPath, ["scripts/verify-cadr-m13-provisional.mjs", "--artifact",
    output, "--inventory", reportPath]), /output hash mismatch/);

  const server = spawn(process.execPath, ["scripts/serve-cadr-m13-provisional.mjs", "--root", output, "--port", "0"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let line = ""; server.stdout.on("data", value => { line += value; });
  await Promise.race([once(server.stdout, "data"), once(server, "error").then(([error]) => { throw error; })]);
  const port = JSON.parse(line.trim()).port;
  try {
    const csp = await cadrM13ProvisionalCsp(output);
    const page = await fetch(`http://127.0.0.1:${port}/index.html`);
    assert.equal(page.status, 200); assert.equal(page.headers.get("content-security-policy"), csp);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    const denied = await fetch(`http://127.0.0.1:${port}/outside-the-inventory`);
    assert.equal(denied.status, 404); assert.equal(denied.headers.get("content-security-policy"), csp);
  } finally { server.kill("SIGTERM"); await once(server, "close"); }
} finally {
  await rm(output, { recursive: true, force: true });
  await rm(reportPath, { force: true });
}

console.log("cadr M13 provisional artifact and CSP boundary tests passed");
