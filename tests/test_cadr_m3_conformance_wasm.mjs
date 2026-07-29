/* CADR-U01..U05 as a bare, zero-import Wasm corpus at both optimization levels. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "cadr-web/build/m3-conformance-wasm");
try {
  for (const opt of ["O0", "O2"]) {
    const path = resolve(OUT, `${opt}.wasm`);
    execFileSync("sh", ["cadr-web/wasm/build-wasm.sh", "--conformance", "--opt", opt, path],
      { cwd: ROOT, stdio: "inherit" });
    const module = new WebAssembly.Module(await readFile(path));
    assert.deepEqual(WebAssembly.Module.imports(module), []);
    assert.deepEqual(WebAssembly.Module.exports(module).map((item) => item.name),
      ["memory", "cadr_m3_conformance_failures"]);
    const instance = new WebAssembly.Instance(module, {});
    assert.equal(instance.exports.cadr_m3_conformance_failures(), 0, `${opt} CADR-U failure`);
  }
  console.log("cadr_m3_conformance_wasm: ok");
} finally {
  await rm(OUT, { recursive: true, force: true });
}
