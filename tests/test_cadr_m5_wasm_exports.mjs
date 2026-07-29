import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = new WebAssembly.Module(await readFile(resolve(root, "cadr-web/build/cadr-web-m5-O0.wasm")));
const names = WebAssembly.Module.exports(module).map(entry => entry.name);
assert.ok(names.includes("cadr_wasm_state_v5_digest"));
assert.ok(names.includes("cadr_wasm_scheduler_digest"));
assert.ok(names.includes("cadr_wasm_state_v5_failure_digest"));
assert.ok(!names.some(name => name.includes("oracle")), "ordinary M5 build exports no oracle hooks");
console.log("cadr_m5_wasm_exports: ok");
