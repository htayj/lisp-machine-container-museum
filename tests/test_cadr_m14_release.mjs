import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertM14ConfinedRepoFile,
  assertNoNamedDefaultExternalPrimitive,
  buildCadrM14,
  validateM14PolicyDocuments,
  verifyCadrM14,
  verifyCadrM14Archive,
} from "../scripts/build-cadr-m14-release.mjs";

const repo = resolve(import.meta.dirname, "..");
const root = resolve(repo, "build/cadr-m14");
const first = resolve(root, `test-a-${process.pid}`);
const second = resolve(root, `test-b-${process.pid}`);
const schemaFixture = resolve(root, `test-schema-${process.pid}`);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` :
  value && typeof value === "object" ? `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const canonicalFile = value => Buffer.from(`${canonical(value)}\n`);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const reject = async (promise, expression) => assert.rejects(promise, expression);

const [policy, rights, matrixPolicy, gates] = await Promise.all([
  readFile(resolve(repo, "cadr-web/release/cadr-m14-package-policy.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-rights-policy.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-browser-matrix.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-gates.json"), "utf8").then(JSON.parse),
]);
validateM14PolicyDocuments(policy, rights, matrixPolicy, gates);
assert.deepEqual(matrixPolicy.registeredAdapters, []);
for (const mutate of [
  value => { value.entries[0].source = "/etc/passwd"; },
  value => { value.entries[0].source = "cadr-web/../outside"; },
  value => { value.entries[0].output = "profiles//cadr.json"; },
  value => { value.entries[0].output = "../escape.json"; },
  value => { value.entries[0].url = "//example.invalid/asset"; },
  value => { value.entries[0].url = "/profiles/../escape"; },
]) {
  const altered = structuredClone(policy); mutate(altered);
  assert.throws(() => validateM14PolicyDocuments(altered, rights, matrixPolicy, gates));
}
const badMatrix = structuredClone(matrixPolicy); badMatrix.privatePlanPath = "/tmp/anything";
assert.throws(() => validateM14PolicyDocuments(policy, rights, badMatrix, gates));
for (const absoluteToken of ["/root/secret", "/etc/passwd", "note:(/home/tay/private)",
  "C:\\Users\\tay\\private", "\\\\server\\share\\private", "\\Windows\\System32",
  "file:///home/tay/private", "~/private-world", "~tay/private-world"]) {
  const alteredRights = structuredClone(rights);
  alteredRights.records[0].sourceNotice = absoluteToken;
  assert.throws(() => validateM14PolicyDocuments(policy, alteredRights, matrixPolicy, gates),
    /private or machine absolute path/, absoluteToken);
}
for (const sample of [
  'import "https://example.invalid/mod.mjs";',
  'export { value } from "//example.invalid/mod.mjs";',
  '@import url("https://example.invalid/style.css");',
  'new Worker("https://example.invalid/worker.js");',
  'new URL("https://example.invalid/asset", import.meta.url);',
  'AudioWorklet.addModule("https://example.invalid/worklet.js");',
]) assert.throws(() => assertNoNamedDefaultExternalPrimitive(sample, "scanner fixture"));
assert.doesNotThrow(() => assertNoNamedDefaultExternalPrimitive('new Worker("./worker.js");', "local worker"));

const confinement = resolve(root, `confinement-${process.pid}`);
try {
  await mkdir(resolve(confinement, "target"), { recursive: true });
  await writeFile(resolve(confinement, "target/source.txt"), "safe");
  await symlink(resolve(confinement, "target"), resolve(confinement, "ancestor"));
  await reject(assertM14ConfinedRepoFile(relative(repo, resolve(confinement, "ancestor/source.txt"))),
    /symbolic-link component/);
} finally { await rm(confinement, { recursive: true, force: true }); }

try {
  await mkdir(root, { recursive: true });
  const firstBuild = await buildCadrM14(first); const secondBuild = await buildCadrM14(second);
  await buildCadrM14(schemaFixture);
  const a = await readFile(resolve(first, "logical-build-manifest.json"));
  const b = await readFile(resolve(second, "logical-build-manifest.json"));
  assert.deepEqual(a, b, "logical manifest is independent of output path and wall clock");
  assert.equal(firstBuild.archive.sha256, secondBuild.archive.sha256,
    "deterministic package archive is independent of output path");
  await verifyCadrM14Archive(firstBuild.archive.path, first);
  const damaged = Buffer.from(await readFile(firstBuild.archive.path));
  damaged[damaged.length - 1] ^= 1;
  await writeFile(firstBuild.archive.path, damaged);
  await reject(verifyCadrM14Archive(firstBuild.archive.path, first), /payload hash differs|payload differs/);
  const manifest = JSON.parse(a);
  assert.equal(manifest.releaseClaim, "none");
  assert.equal(manifest.offline, true);
  assert.ok(manifest.unresolvedComponents.includes("cadr.wasm"));
  assert.equal(manifest.sourceControl.closureStatus,
    manifest.sourceControl.status.length === 0 ? "clean" : "dirty");
  assert.match(manifest.sourceControl.revision, /^(?:[0-9a-f]{40}|unavailable)$/u);
  assert.match(manifest.sourceControl.tree, /^(?:[0-9a-f]{40}|unavailable)$/u);
  assert.match(manifest.sourceControl.releaseEvidenceEligibility,
    /^(?:not-eligible-requires-clean-committed-closure|eligible-for-later-evidence-binding)$/u);
  assert.ok(manifest.sourceControl.entries.some(entry =>
    entry.path === "scripts/build-cadr-m14-release.mjs"));
  assert.deepEqual(manifest.sourceControl.entries.map(entry => entry.path), [
    "cadr-web/browser/cadr-m13-artifact-shell.mjs",
    "cadr-web/browser/cadr-m13-artifact-worker.mjs",
    "cadr-web/browser/cadr-m13-shell.css",
    "cadr-web/browser/cadr-m13-shell.html",
    "cadr-web/profiles/cadr-web-303.ini.in",
    "cadr-web/profiles/cadr-web-303.json",
    "cadr-web/release/cadr-m14-browser-matrix.json",
    "cadr-web/release/cadr-m14-gates.json",
    "cadr-web/release/cadr-m14-package-policy.json",
    "cadr-web/release/cadr-m14-rights-policy.json",
    "scripts/build-cadr-m14-release.mjs",
  ], "package identity must close over every byte-generating source and policy");
  const sourceMap = JSON.parse(await readFile(resolve(first, "source-map.json")));
  assert.deepEqual(sourceMap.mappings.map(mapping => mapping.output).sort(),
    [...manifest.files.map(file => file.path), "logical-build-manifest.json"].sort());
  assert.ok(sourceMap.mappings.filter(mapping => mapping.transform.startsWith("deterministic-"))
    .every(mapping => mapping.generator?.path === "scripts/build-cadr-m14-release.mjs"));
  for (const file of [...manifest.files.map(item => item.path), "logical-build-manifest.json"]) {
    assert.equal((await lstat(resolve(first, file))).mode & 0o777, 0o644);
  }
  const rightsOutput = JSON.parse(await readFile(resolve(first, "rights-provenance.json")));
  assert.ok(rightsOutput.forbiddenBundleClasses.some(value => value.includes("Symbolics or Open Genera")));
  assert.deepEqual(rightsOutput.assignments.map(item => item.path).sort(),
    [...manifest.files.map(item => item.path), "logical-build-manifest.json"].sort());
  assert.match(await readFile(resolve(first, "USER-GUIDE.md"), "utf8"), /self-contained under its closed inventory/);
  assert.match(await readFile(resolve(first, "CONFORMANCE-REPORT.md"), "utf8"), /Release claim: \*\*none\*\*/);
  const generatedMatrix = JSON.parse(await readFile(resolve(first, "browser-compatibility-matrix.json")));
  assert.equal(generatedMatrix.evidenceStatus, "not-evaluated");
  assert.equal(generatedMatrix.browserRuntimeStatus, "open");
  const mutateGeneratedJson = async (name, mutate, encoding = canonicalFile,
    expected = /missing, extra|canonical|private or machine absolute|canonical relative/) => {
    const path = resolve(schemaFixture, name); const original = await readFile(path);
    const value = JSON.parse(original); mutate(value);
    await writeFile(path, encoding(value));
    await reject(verifyCadrM14(schemaFixture), expected);
    await writeFile(path, original);
  };
  await mutateGeneratedJson("logical-build-manifest.json", value => {
    value.privatePath = "/home/tay/private-vlod";
  });
  await mutateGeneratedJson("rights-provenance.json", value => {
    value.records[0].privatePath = "/home/tay/private-rights";
  });
  await mutateGeneratedJson("source-map.json", value => {
    value.mappings[0].sources[0].path = "/home/tay/private-source";
  });
  await mutateGeneratedJson("browser-compatibility-matrix.json", value => {
    value.required[0].privatePath = "/home/tay/private-browser";
  });
  for (const absoluteToken of ["/root/secret", "/etc/passwd", "notice:(/home/tay/private)",
    "C:\\Users\\tay\\private", "\\\\server\\share\\private", "\\Windows\\System32",
    "file:///home/tay/private", "~/private-world", "~tay/private-world"]) {
    await mutateGeneratedJson("rights-provenance.json", value => {
      value.records[0].sourceNotice = absoluteToken;
    }, canonicalFile, /private or machine absolute path/);
  }
  await mutateGeneratedJson("rights-provenance.json", value => value, value =>
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  assert.match(await readFile(resolve(first, "cadr-shell.mjs"), "utf8"),
    /No machine is running in this M13 policy harness/);
  assert.equal(manifest.files.some(item => /wasm|worklet/iu.test(item.path)), false);
  await reject(buildCadrM14(first), /replacement is forbidden|already exists/);
  await reject(buildCadrM14(resolve(root, "nested", "release")), /direct child/);
  await writeFile(resolve(first, "unexpected.bin"), "x");
  await reject(verifyCadrM14(first), /inventory is not closed/);
  await rm(resolve(first, "unexpected.bin"));
  const shellPath = resolve(first, "cadr-shell.mjs");
  const shell = await readFile(shellPath);
  await writeFile(shellPath, `${shell}\nimport "https://example.invalid/remote.mjs";\n`);
  await reject(verifyCadrM14(first), /identity differs|named default external primitive/);

  const rightsPath = resolve(second, "rights-provenance.json");
  const secondManifestPath = resolve(second, "logical-build-manifest.json");
  const incompleteRights = JSON.parse(await readFile(rightsPath));
  incompleteRights.assignments.pop();
  const incompleteBytes = Buffer.from(JSON.stringify(incompleteRights));
  await writeFile(rightsPath, incompleteBytes);
  const secondManifest = JSON.parse(await readFile(secondManifestPath));
  const rightsEntry = secondManifest.files.find(item => item.path === "rights-provenance.json");
  rightsEntry.byteCount = incompleteBytes.byteLength;
  rightsEntry.sha256 = sha256(incompleteBytes);
  await writeFile(secondManifestPath, JSON.stringify(secondManifest));
  await reject(verifyCadrM14(second), /canonical|rights assignments do not cover/);
} finally {
  await rm(first, { recursive: true, force: true });
  await rm(second, { recursive: true, force: true });
  await rm(schemaFixture, { recursive: true, force: true });
  await rm(`${first}.cdrm14`, { force: true });
  await rm(`${second}.cdrm14`, { force: true });
  await rm(`${schemaFixture}.cdrm14`, { force: true });
}

for (const output of ["/tmp/cadr-m14", "build/cadr-m14/../escape", "build/cadr-m14//escape"]) {
  const result = spawnSync("node", ["scripts/build-cadr-m14-release.mjs", "--output", output],
    { cwd: repo, encoding: "utf8" });
  assert.notEqual(result.status, 0, output);
}
const matrix = spawnSync("node", ["scripts/run-cadr-m14-compatibility.mjs"], { cwd: repo, encoding: "utf8" });
assert.equal(matrix.status, 2, matrix.stderr);
assert.equal(JSON.parse(matrix.stdout).releaseClaim, undefined);
assert.deepEqual(JSON.parse(matrix.stdout).requiredEngines, ["Blink", "Gecko", "WebKit"]);

const matrixRoot = resolve(root, `matrix-${process.pid}`);
const matrixPackage = resolve(root, `matrix-package-${process.pid}`);
const matrixPlan = resolve(matrixRoot, "plan.json");
const matrixAdapter = resolve(matrixRoot, "adapter.mjs");
const matrixOutput = resolve(matrixRoot, "evidence.json");
const rowId = { Blink: "chromium-current", Gecko: "firefox-current", WebKit: "webkit-current" };
const writePlan = async alteration => {
  const executable = await realpath(process.execPath);
  const executableSha256 = sha256(await readFile(executable));
  const plan = { schema: "cadr-m14-private-browser-adapter-attestations-v2", privateHome: matrixRoot,
    adapters: ["Blink", "Gecko", "WebKit"].map(engine => ({ rowId: rowId[engine],
      adapterId: `unregistered-${engine.toLowerCase()}-node-attestation`, engine,
      toolId: "test-node-attestation-v1", executableSha256, script: "adapter.mjs" })) };
  alteration?.(plan);
  await writeFile(matrixPlan, canonicalFile(plan));
};
const executeMatrix = () => spawnSync("node", ["scripts/run-cadr-m14-compatibility.mjs", "--execute",
  "--plan", matrixPlan, "--package", matrixPackage, "--output", matrixOutput],
{ cwd: repo, encoding: "utf8" });
try {
  await mkdir(matrixRoot, { recursive: true });
  await buildCadrM14(matrixPackage);
  await writeFile(matrixAdapter, `const c=v=>Array.isArray(v)?\`[\${v.map(c).join(",")}\]\`:v&&typeof v==="object"?\`{\${Object.keys(v).sort().map(k=>\`\${JSON.stringify(k)}:\${c(v[k])}\`).join(",")}}\`:JSON.stringify(v);
const engine=process.argv[2];
process.stdout.write(c({schema:"cadr-m14-untrusted-adapter-attestation-v2",adapterId:\`unregistered-\${engine.toLowerCase()}-node-attestation\`,engine,toolId:"test-node-attestation-v1",executableSha256:process.argv[4],logicalManifestSha256:process.argv[3],observations:{networkRequests:0,networkNamespaceObserved:true,nonLoopbackInterfaces:[],packageInventoryClosed:true}})+"\\n");
`);
  await writePlan(plan => { plan.privateHome = "/tmp/not-private"; });
  assert.notEqual(executeMatrix().status, 0, "arbitrary private-home data must reject");
  await writePlan(plan => { plan.adapters[0].extra = true; });
  assert.notEqual(executeMatrix().status, 0, "extra adapter field must reject");
  await writePlan(plan => { plan.adapters[0].executableSha256 = "0".repeat(64); });
  assert.notEqual(executeMatrix().status, 0, "mismatched executable pin must reject");
  await writePlan();
  const cleanAdapter = await readFile(matrixAdapter, "utf8");
  await writeFile(matrixAdapter, cleanAdapter.replace("packageInventoryClosed:true}})",
    "packageInventoryClosed:true},extra:true})"));
  assert.notEqual(executeMatrix().status, 0, "extra adapter attestation field must reject");
  await writeFile(matrixAdapter, cleanAdapter);
  const executed = executeMatrix();
  assert.equal(executed.status, 0, executed.stderr);
  const attestations = JSON.parse(await readFile(matrixOutput));
  assert.equal(attestations.releaseClaim, "none");
  assert.equal(attestations.browserMatrixEvidenceStatus, "not-evaluated");
  assert.match(attestations.disposition, /untrusted-attestations-only/);
  assert.equal(attestations.sandboxRuntimeDenial, "bubblewrap-unshare-net");
  assert.equal(attestations.attestations.length, 3);
  assert.deepEqual((await readdir(matrixRoot)).sort(), ["adapter.mjs", "evidence.json", "plan.json"]);
} finally {
  await rm(matrixRoot, { recursive: true, force: true });
  await rm(matrixPackage, { recursive: true, force: true });
  await rm(`${matrixPackage}.cdrm14`, { force: true });
}
console.log("cadr M14 deterministic offline release scaffold tests passed");
