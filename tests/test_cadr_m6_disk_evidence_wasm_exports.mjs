import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = new WebAssembly.Module(await readFile(
  resolve(root, "cadr-web/build/cadr-web-m6-devid-O0.wasm"),
));
const names = WebAssembly.Module.exports(module).map(entry => entry.name);
assert.ok(names.includes("cadr_wasm_m6_disk_evidence_summary"));
assert.ok(names.includes("cadr_wasm_disk_evidence"));
assert.ok(!names.includes("cadr_wasm_post_terminal_diagnostic"));
console.log("cadr_m6_disk_evidence_wasm_exports: ok");
