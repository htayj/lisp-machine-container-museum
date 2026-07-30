import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { pathToFileURL } from "node:url";
import { buildM6DiagnosticIsolated, CADR_M6_DIAGNOSTIC_RECEIPT_BASE } from
  "../scripts/build-cadr-m6-diagnostic-isolated.mjs";

class Probe {
  constructor(worker) {
    this.worker = worker;
    this.messages = [];
    this.waiters = [];
    worker.on("message", message => {
      const waiter = this.waiters.shift();
      if (waiter !== undefined) waiter(message);
      else this.messages.push(message);
    });
  }

  request(message) {
    this.worker.postMessage(message);
    if (this.messages.length !== 0) return Promise.resolve(this.messages.shift());
    return new Promise(resolveNext => this.waiters.push(resolveNext));
  }
}

function bytes(value) {
  return new Uint8Array(value);
}

const build = await buildM6DiagnosticIsolated({
  receiptBase: CADR_M6_DIAGNOSTIC_RECEIPT_BASE,
});
let worker = null;
try {
  const moduleBytes = await readFile(build.wasm.path);
  const module = new WebAssembly.Module(moduleBytes);
  const exports = WebAssembly.Module.exports(module).map(entry => entry.name);
  assert.ok(exports.includes("cadr_wasm_post_terminal_diagnostic"));
  assert.equal(exports.includes("cadr_wasm_display_full"), false,
    "the staged M6 diagnostic module excludes M7 display exports");

  execFileSync("make", ["-C", resolve(build.stage_directory, "cadr-web"),
    "build/test_cadr_m2_public"], { stdio: "inherit" });
  const cadrWeb = resolve(build.stage_directory, "cadr-web");
  const adapterFixture = resolve(cadrWeb, "build/test_cadr_m6_postterminal_adapter");
  execFileSync(process.env.CC ?? "cc", [
    "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic", "-Wconversion",
    "-Wshadow", "-Wstrict-prototypes", "-Wmissing-prototypes", "-Wformat=2",
    "-Iinclude", "-Icore", "-Icore/usim-port", "-Itrace", "-Ihost",
    "-DCADR_M6_DIAGNOSTIC_WASM", "-DCADR_WASM_NATIVE_TEST", "-o", adapterFixture,
    "tests/test_cadr_m6_postterminal_adapter.c", "build/libcadr_core.a",
  ], { cwd: cadrWeb, stdio: "inherit" });
  execFileSync(resolve(build.stage_directory,
    "cadr-web/build/test_cadr_m6_postterminal_adapter"), [], { stdio: "inherit" });
  const snapshotPath = resolve(build.stage_directory, "fatal.cdrsnap1");
  execFileSync(resolve(build.stage_directory, "cadr-web/build/test_cadr_m2_public"),
    ["--emit-m5-fatal-snapshot", snapshotPath]);
  const snapshot = await readFile(snapshotPath);

  worker = new Worker(pathToFileURL(build.worker.path), { type: "module" });
  const probe = new Probe(worker);
  let id = 1;
  const request = async (op, fields = {}) => probe.request({
    version: 4, id: id++, op, ...fields,
  });
  assert.equal((await request("instantiate", { module })).status, 0);
  assert.equal((await request("snapshot-restore-import", {
    snapshot: snapshot.buffer.slice(snapshot.byteOffset,
      snapshot.byteOffset + snapshot.byteLength),
    allowLegacyNativeImport: true,
  })).status, 0);
  assert.equal((await request("scheduler-visibility", { hidden: false })).status, 0);
  assert.equal((await request("scheduler-start")).status, 0);
  const terminal = await request("scheduler-run", { clockSlots: 1 });
  assert.equal(terminal.status, 16, "the staged fatal snapshot reaches its terminal status");

  const first = await request("post-terminal-diagnostic");
  assert.equal(first.status, 0);
  assert.equal(first.wireSchema, "CDRM6D1");
  assert.equal(first.terminalCoreDigestVerified, true);
  assert.equal(first.terminalQueueDigestVerified, true);
  assert.equal(first.diagnostic.trace.active, false,
    "the exact M6 cause witness excludes a simultaneous trace-engine path");
  assert.equal(first.diagnostic.trace.failureLedgerUnavailable, true);
  assert.equal(first.diagnostic.diskEvidence.capacity, 512);
  assert.equal(first.diagnostic.evidence.nextSequence, 0n);
  assert.equal(first.diagnostic.attemptedBoundary, 1n);
  assert.equal(first.lastCompleteBoundary, 1n);

  const second = await request("post-terminal-diagnostic");
  assert.equal(second.status, 0);
  assert.equal(second.terminalCoreDigestVerified, true);
  assert.equal(second.terminalQueueDigestVerified, true);
  assert.deepEqual(second.diagnostic, first.diagnostic,
    "repeated post-terminal reads leave the complete fixed diagnostic record unchanged");
  console.log("cadr_m6_diagnostic_worker: ok");
} finally {
  if (worker !== null) await worker.terminate();
  await rm(build.stage_directory, { recursive: true, force: true });
}
