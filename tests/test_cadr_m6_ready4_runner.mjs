import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  executeReady4,
  parseReady4Arguments,
  preflightReady4Inputs,
} from "../scripts/run-cadr-m6-ready4-fast.mjs";

assert.throws(() => parseReady4Arguments([]), /inert without --execute/);
assert.throws(() => parseReady4Arguments([
  "--execute", "--artifact-root", ".", "--output", "x", "--execute",
]), /duplicate --execute/);

const root = await mkdtemp(resolve(tmpdir(), "cadr-m6-ready4-runner-"));
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
{
  const direct = resolve(repository, "scripts/run-cadr-m6-ready4-fast.mjs");
  const spoof = spawnSync(process.execPath, [direct, "--execute", "--no-build",
    "--artifact-root", root, "--output", resolve(root, "spoof.json"),
    "--wasm-identity", resolve(root, "identity.json"),
  ], { encoding: "utf8", env: { M6_READY4_SYSTEMD_CHILD: "1" } });
  assert.notEqual(spoof.status, 0);
  assert.match(spoof.stderr, /inert without --execute/,
    "the direct READY4 child rejects an environment-only spoof");
}
const badRelease = resolve(root, "bad-release.json");
const truncatedRoot = resolve(root, "truncated");
const nonce = resolve(root, "invocation.nonce");
await writeFile(nonce, Buffer.alloc(32, 7), { mode: 0o400 });
await writeFile(badRelease, "{}", { mode: 0o600 });
await mkdir(truncatedRoot, { mode: 0o700 });
await mkdir(resolve(truncatedRoot, "cadr-web/profiles"), { recursive: true, mode: 0o700 });
await writeFile(resolve(truncatedRoot, "cadr-web/profiles/cadr-web-303.ini.in"), "", { mode: 0o600 });

const base = Object.freeze({ execute: true, artifactRoot: truncatedRoot,
  output: resolve(root, "output.json"), releaseRecord: badRelease,
  wasm: resolve(root, "unused.wasm"), invocationNonceFile: nonce,
  selectedImageNegativeReceiptSha256: "11".repeat(32),
  build: false });
for (const [label, options] of [
  ["wrong release", base],
  ["truncated input", { ...base,
    releaseRecord: resolve(repository, "cadr-web/oracle/cadr-m6-release-record.json") }],
]) {
  let buildCalls = 0; let clientCalls = 0;
  await assert.rejects(() => executeReady4(options, {
    preflight: preflightReady4Inputs,
    build: async () => { buildCalls += 1; throw new Error("build must not run"); },
    createClient: async () => { clientCalls += 1; throw new Error("worker must not run"); },
  }), /compiled canonical identity|required regular byte count/,
  `${label} must fail in source preflight`);
  assert.equal(buildCalls, 0, `${label} never builds or touches a worker after failed preflight`);
  assert.equal(clientCalls, 0, `${label} does not create a worker before failure`);
}

await rm(root, { recursive: true, force: true });
console.log("cadr M6 READY4 direct runner preflight passed");
