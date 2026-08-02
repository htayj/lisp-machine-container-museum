import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = resolve(root, "cadr-web/build");
const fixtureDirectory = await mkdtemp(resolve(tmpdir(), "cdrm9d1-"));
const digestPath = resolve(fixtureDirectory, "booted-state5.sha256");
execFileSync(resolve(build, "test_cadr_m2_public"),
  ["--emit-booted-state5-digest", digestPath]);
const expectedDigest = new Uint8Array(await readFile(digestPath));
await rm(fixtureDirectory, { recursive: true, force: true });

const adapterSource = await readFile(resolve(root,
  "cadr-web/wasm/cadr_wasm_adapter.c"), "utf8");
const gated = adapterSource.match(
  /#if defined\(CADR_M12_SYNTHETIC_TEST_WASM\)([\s\S]*?)#endif/);
assert.notEqual(gated, null); assert.equal(
  adapterSource.match(/CADR_M12_SYNTHETIC_TEST_WASM/g)?.length, 1);
assert.match(gated[1], /cadr_machine_cold_power_on/);
assert.match(gated[1], /cadr_machine_boot/);
assert.doesNotMatch(gated[1], /cadr_[a-z0-9_]*(?:snapshot|restore)/);
const buildSource = await readFile(resolve(root, "cadr-web/wasm/build-wasm.sh"), "utf8");
assert.match(buildSource,
  /if test "\$profile" = m12-synthetic-test; then[\s\S]*-DCADR_M12_SYNTHETIC_TEST_WASM/);

function snapshotSave(e) {
  assert.equal(e.cadr_wasm_snapshot_save() >>> 0, 0);
  const meta = new DataView(e.memory.buffer, e.cadr_wasm_meta_pointer() >>> 0, 16);
  const count = Number(meta.getBigUint64(0, true));
  const pointer = e.cadr_wasm_snapshot_pointer() >>> 0;
  return new Uint8Array(e.memory.buffer, pointer, count).slice();
}

function continuation(snapshot) {
  const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
  assert.equal(new TextDecoder().decode(snapshot.subarray(0, 8)), "CDRM12S1");
  const coreBytes = Number(view.getBigUint64(24, true));
  assert.equal(view.getUint32(40, true), 72);
  return snapshot.slice(48 + coreBytes, 48 + coreBytes + 72);
}

const records = [];
for (const variant of ["O0", "O2"]) {
  const productionModule = await WebAssembly.compile(await readFile(
    resolve(build, `cadr-web-m12-${variant}.wasm`)));
  const syntheticModule = await WebAssembly.compile(await readFile(
    resolve(build, `cadr-web-m12-synthetic-test-${variant}.wasm`)));
  assert.deepEqual(WebAssembly.Module.exports(syntheticModule),
    WebAssembly.Module.exports(productionModule), "test profile adds no export");

  const productionCreate = (await WebAssembly.instantiate(productionModule, {})).exports;
  assert.equal(productionCreate.cadr_wasm_create() >>> 0, 0);
  assert.notEqual(productionCreate.cadr_wasm_output_pointer() >>> 0, 0);
  assert.equal(productionCreate.cadr_wasm_machine_info() >>> 0, 0);
  assert.equal(new DataView(productionCreate.memory.buffer,
    productionCreate.cadr_wasm_output_pointer() >>> 0, 4).getUint32(0, true), 0,
    "production create remains cold");

  const source = (await WebAssembly.instantiate(syntheticModule, {})).exports;
  assert.equal(source.cadr_wasm_create() >>> 0, 0);
  assert.notEqual(source.cadr_wasm_output_pointer() >>> 0, 0);
  assert.equal(source.cadr_wasm_machine_info() >>> 0, 0);
  assert.equal(new DataView(source.memory.buffer,
    source.cadr_wasm_output_pointer() >>> 0, 4).getUint32(0, true), 2,
    "compile-gated test create is booted");
  const fixture = snapshotSave(source);

  const restored = (await WebAssembly.instantiate(productionModule, {})).exports;
  assert.equal(restored.cadr_wasm_create() >>> 0, 0);
  const input = restored.cadr_wasm_snapshot_input_reserve(fixture.byteLength) >>> 0;
  assert.notEqual(input, 0);
  new Uint8Array(restored.memory.buffer, input, fixture.byteLength).set(fixture);
  assert.equal(restored.cadr_wasm_snapshot_restore_import(fixture.byteLength) >>> 0, 0);
  const record = continuation(snapshotSave(restored));
  assert.deepEqual(record, continuation(fixture), `${variant} restore/save retains exact D1`);
  assert.equal(new TextDecoder().decode(record.subarray(0, 7)), "CDRM9D1");
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  assert.equal(view.getUint8(7), 0); assert.equal(view.getUint32(8, true), 1);
  assert.equal(view.getUint32(12, true), 72);
  assert.deepEqual(record.slice(16, 48), expectedDigest);
  assert.equal(view.getBigUint64(48, true), 1n);
  assert.equal(view.getBigUint64(56, true), 0n);
  assert.equal(view.getUint32(64, true), 0);
  assert.equal(view.getUint16(68, true), 0); assert.equal(view.getUint16(70, true), 0);
  records.push(record);
}
assert.deepEqual(records[0], records[1], "O0 and O2 exact 72-byte records agree");
assert.equal(createHash("sha256").update(records[0]).digest("hex"),
  createHash("sha256").update(records[1]).digest("hex"));

console.log("cadr M12 CDRM9D1 O0/O2 restore-save fixture passed");
