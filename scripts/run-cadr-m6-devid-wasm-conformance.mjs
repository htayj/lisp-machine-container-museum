#!/usr/bin/env node
/*
 * M6-DEVID1's release gate is deliberately separate from the frozen M6
 * Listener-ready runner.  There is currently no reviewed READY4 envelope, so
 * this tool performs only its deterministic negative/build checks and refuses
 * to imply a live System 303 boot result.
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wasm = resolve(root, "cadr-web/build/cadr-web-m6-devid-O0.wasm");
const usage = "usage: node scripts/run-cadr-m6-devid-wasm-conformance.mjs [--no-build] --negative-only";
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  console.log("Checks the isolated M6-DEVID1 build; no READY4 claim is emitted.");
  process.exit(0);
}
const noBuild = args.includes("--no-build");
if (args.filter(arg => arg !== "--no-build" && arg !== "--negative-only").length !== 0 ||
    !args.includes("--negative-only")) {
  throw new Error(`${usage}\nA reviewed M6-DEVID1 release envelope is not yet tracked.`);
}
if (!noBuild) execFileSync("make", ["-C", resolve(root, "cadr-web"),
  "build/cadr-web-m6-devid-O0.wasm"], { stdio: "inherit" });
const module = new WebAssembly.Module(await readFile(wasm));
const names = WebAssembly.Module.exports(module).map(entry => entry.name);
if (!names.includes("cadr_wasm_m6_disk_evidence_summary") ||
    names.includes("cadr_wasm_display_full")) {
  throw new Error("M6-DEVID1 export isolation failed");
}
console.log(JSON.stringify({
  outcome: "not-ready",
  profile: "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1",
  policy: "M6-PREFIX512-TAILSHA256-v1",
  reason: "no-reviewed-ready4-release-envelope",
}));
