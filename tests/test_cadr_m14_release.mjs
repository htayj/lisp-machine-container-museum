import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, relative } from "node:path";
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

const run = (command, args, cwd, extraEnv = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...extraEnv } });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stderr}`);
  return result;
};
async function cleanExtraction() {
  const target = await mkdtemp(resolve(tmpdir(), "cadr-m14-clean-extraction-"));
  const listed = run("git", ["ls-files", "-z"], repo).stdout.split("\0").filter(Boolean);
  for (const path of listed) {
    const destination = resolve(target, path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(resolve(repo, path), destination, { verbatimSymlinks: true });
  }
  run("git", ["init", "--quiet"], target);
  run("git", ["add", "--all"], target);
  run("git", ["-c", "user.name=M14 test", "-c", "user.email=m14-test@example.invalid",
    "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-gpg-sign", "-m", "clean M14 test extraction"], target,
  { GIT_AUTHOR_DATE: "2026-08-02T12:00:00+0000", GIT_COMMITTER_DATE: "2026-08-02T12:00:00+0000" });
  return target;
}
if (process.env.CADR_M14_CLEAN_EXTRACTION !== "1") {
  const firstExtraction = await cleanExtraction();
  const secondExtraction = await cleanExtraction();
  const ignoredExtraction = await cleanExtraction();
  const symlinkExtraction = await cleanExtraction();
  const executableExtraction = await cleanExtraction();
  const shimDirectory = await mkdtemp(resolve(tmpdir(), "cadr-m14-path-shim-"));
  try {
    await writeFile(resolve(shimDirectory, "git"), "#!/bin/sh\nexit 91\n");
    await chmod(resolve(shimDirectory, "git"), 0o755);
    run("node", ["scripts/build-cadr-m14-release.mjs", "--output", "build/cadr-m14/independent"],
      firstExtraction, { PATH: `${shimDirectory}:${process.env.PATH ?? ""}` });
    run("node", ["scripts/build-cadr-m14-release.mjs", "--output", "build/cadr-m14/independent"],
      secondExtraction);
    assert.deepEqual(
      await readFile(resolve(firstExtraction, "build/cadr-m14/independent/logical-build-manifest.json")),
      await readFile(resolve(secondExtraction, "build/cadr-m14/independent/logical-build-manifest.json")),
      "two independent clean source extractions must produce the same logical manifest",
    );
    assert.deepEqual(
      await readFile(resolve(firstExtraction, "build/cadr-m14/independent.cdrm14")),
      await readFile(resolve(secondExtraction, "build/cadr-m14/independent.cdrm14")),
      "two independent clean source extractions must produce the same deterministic archive",
    );
    for (const extraction of [firstExtraction, secondExtraction]) {
      run("node", ["tests/test_cadr_m14_release.mjs"], extraction, { CADR_M14_CLEAN_EXTRACTION: "1" });
    }
    const ignoredPolicyPath = resolve(ignoredExtraction, "cadr-web/release/cadr-m14-package-policy.json");
    const ignoredPolicy = JSON.parse(await readFile(ignoredPolicyPath, "utf8"));
    ignoredPolicy.entries[0].source = "ignored/substituted-input.html";
    await writeFile(ignoredPolicyPath, `${JSON.stringify(ignoredPolicy, null, 2)}\n`);
    run("git", ["add", "cadr-web/release/cadr-m14-package-policy.json"], ignoredExtraction);
    run("git", ["-c", "user.name=M14 test", "-c", "user.email=m14-test@example.invalid",
      "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-gpg-sign", "-m", "ignored input attack"],
    ignoredExtraction, { GIT_AUTHOR_DATE: "2026-08-02T12:01:00+0000", GIT_COMMITTER_DATE: "2026-08-02T12:01:00+0000" });
    await writeFile(resolve(ignoredExtraction, ".git/info/exclude"), "ignored/\n", { flag: "a" });
    await mkdir(resolve(ignoredExtraction, "ignored"), { recursive: true });
    await writeFile(resolve(ignoredExtraction, "ignored/substituted-input.html"), "<!doctype html>\n");
    const ignoredResult = spawnSync("node", ["scripts/build-cadr-m14-release.mjs", "--output",
      "build/cadr-m14/ignored-substitution"], { cwd: ignoredExtraction, encoding: "utf8" });
    assert.notEqual(ignoredResult.status, 0, "ignored untracked substituted input must reject");
    assert.match(ignoredResult.stderr, /does not have exactly one HEAD tree entry/);
    const symlinkSource = resolve(symlinkExtraction, "cadr-web/browser/cadr-m13-shell.css");
    await rm(symlinkSource);
    await symlink("substituted-target", symlinkSource);
    run("git", ["add", "cadr-web/browser/cadr-m13-shell.css"], symlinkExtraction);
    run("git", ["-c", "user.name=M14 test", "-c", "user.email=m14-test@example.invalid",
      "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-gpg-sign", "-m", "tracked symlink attack"],
    symlinkExtraction, { GIT_AUTHOR_DATE: "2026-08-02T12:02:00+0000", GIT_COMMITTER_DATE: "2026-08-02T12:02:00+0000" });
    await rm(symlinkSource);
    await writeFile(symlinkSource, "substituted-target");
    const symlinkResult = spawnSync("node", ["scripts/build-cadr-m14-release.mjs", "--output",
      "build/cadr-m14/tracked-symlink-substitution"], { cwd: symlinkExtraction, encoding: "utf8" });
    assert.notEqual(symlinkResult.status, 0, "tracked symlink replaced by its blob bytes must reject");
    assert.match(symlinkResult.stderr, /HEAD tree entry is not a permitted regular blob mode/);
    const executableSource = resolve(executableExtraction, "cadr-web/browser/cadr-m13-shell.css");
    await chmod(executableSource, 0o755);
    const executableResult = spawnSync("node", ["scripts/build-cadr-m14-release.mjs", "--output",
      "build/cadr-m14/executable-mode-divergence"], { cwd: executableExtraction, encoding: "utf8" });
    assert.notEqual(executableResult.status, 0, "current executable-mode divergence must reject");
    assert.match(executableResult.stderr, /executable bits differ from HEAD mode 100644/);
  } finally {
    await rm(firstExtraction, { recursive: true, force: true });
    await rm(secondExtraction, { recursive: true, force: true });
    await rm(ignoredExtraction, { recursive: true, force: true });
    await rm(symlinkExtraction, { recursive: true, force: true });
    await rm(executableExtraction, { recursive: true, force: true });
    await rm(shimDirectory, { recursive: true, force: true });
  }
  console.log("cadr M14 independent clean-extraction release tests passed");
  process.exit(0);
}

const [policy, rights, matrixPolicy, gates] = await Promise.all([
  readFile(resolve(repo, "cadr-web/release/cadr-m14-package-policy.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-rights-policy.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-browser-matrix.json"), "utf8").then(JSON.parse),
  readFile(resolve(repo, "cadr-web/release/cadr-m14-gates.json"), "utf8").then(JSON.parse),
]);
validateM14PolicyDocuments(policy, rights, matrixPolicy, gates);
assert.deepEqual(matrixPolicy.registeredAdapters, []);
for (const forge of [
  value => { value.gates[0].state = "closed"; },
  value => { value.gates[0].evidence = ["manual pass"]; },
  value => { value.evidenceAuthority.manualStatus = "can-advance"; },
  value => { value.unresolvedMilestoneBlockers.pop(); },
  value => { value.cw4DefinitionOfDone[9].id = "CW4-DOD-11"; },
  value => { value.cw4DefinitionOfDone[6].clause = "the default build has no traffic"; },
  value => { value.gates[4].requiredDoD.pop(); },
  value => { value.unresolvedMilestoneBlockers[7].blocks = ["CW4-DOD-07"]; },
  value => { value.cw4DefinitionOfDone[6].blockingMilestones = ["M14"]; },
]) {
  const forged = structuredClone(gates); forge(forged);
  assert.throws(() => validateM14PolicyDocuments(policy, rights, matrixPolicy, forged),
    /unevaluated|missing|extra|permits|incomplete|malformed|differ|disagree/);
}
for (const forge of [
  value => { value.evidenceAuthority.freeFormEvidence = "can-advance"; },
  value => { value.registeredAdapters = [{ id: "manual-browser" }]; },
]) {
  const forged = structuredClone(matrixPolicy); forge(forged);
  assert.throws(() => validateM14PolicyDocuments(policy, rights, forged, gates));
}
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
  const directInputPath = resolve(repo, "cadr-web/profiles/cadr-web-303.json");
  const directInputBytes = await readFile(directInputPath);
  try {
    await writeFile(directInputPath, Buffer.concat([directInputBytes, Buffer.from("\n")]));
    await reject(buildCadrM14(resolve(root, `dirty-direct-input-${process.pid}`)),
      /differs byte-for-byte from its HEAD blob/);
  } finally { await writeFile(directInputPath, directInputBytes); }
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
  assert.equal(manifest.closedInventoryStatus, "closed-static-inventory");
  assert.equal(manifest.offlineRuntimeStatus, "not-evaluated");
  assert.ok(manifest.unresolvedComponents.includes("cadr.wasm"));
  assert.match(manifest.buildProvenance.git.revision, /^[0-9a-f]{40}$/u);
  assert.match(manifest.buildProvenance.git.tree, /^[0-9a-f]{40}$/u);
  assert.match(manifest.buildProvenance.git.version, /^git version /u);
  assert.match(manifest.buildProvenance.git.executableSha256, /^[0-9a-f]{64}$/u);
  assert.equal(manifest.buildProvenance.git.executableSha256,
    sha256(await readFile(await realpath("/usr/bin/git"))),
    "Git provenance must bind the fixed absolute executable, not PATH");
  assert.equal(manifest.buildProvenance.node.runtime, "node");
  assert.match(manifest.buildProvenance.node.version, /^v\d+/u);
  assert.match(manifest.buildProvenance.node.executableSha256, /^[0-9a-f]{64}$/u);
  assert.ok(manifest.buildProvenance.directInputs.some(entry =>
    entry.path === "scripts/build-cadr-m14-release.mjs"));
  assert.ok(manifest.buildProvenance.directInputs.every(entry => /^[0-9a-f]{40}$/u.test(entry.gitBlob)));
  assert.ok(manifest.buildProvenance.directInputs.every(entry => ["100644", "100755"].includes(entry.gitMode)));
  assert.deepEqual(manifest.buildProvenance.directInputs.map(entry => entry.path), [
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
  ], "build provenance must close over every direct byte-generating source and policy");
  const sourceMap = JSON.parse(await readFile(resolve(first, "source-map.json")));
  assert.deepEqual(sourceMap.mappings.map(mapping => mapping.output).sort(),
    [...manifest.files.map(file => file.path), "logical-build-manifest.json"].sort());
  assert.deepEqual(sourceMap.provenance, manifest.buildProvenance);
  assert.equal(sourceMap.provenance.generator.path, "scripts/build-cadr-m14-release.mjs");
  for (const rootName of ["source-map.json", "logical-build-manifest.json"]) {
    const root = sourceMap.mappings.find(mapping => mapping.output === rootName);
    assert.deepEqual(root.sources, manifest.buildProvenance.directInputs,
      `${rootName} must list every direct input`);
  }
  for (const file of [...manifest.files.map(item => item.path), "logical-build-manifest.json"]) {
    assert.equal((await lstat(resolve(first, file))).mode & 0o777, 0o644);
  }
  const rightsOutput = JSON.parse(await readFile(resolve(first, "rights-provenance.json")));
  assert.ok(rightsOutput.forbiddenBundleClasses.some(value => value.includes("Symbolics or Open Genera")));
  assert.deepEqual(rightsOutput.assignments.map(item => item.path).sort(),
    [...manifest.files.map(item => item.path), "logical-build-manifest.json"].sort());
  assert.match(await readFile(resolve(first, "USER-GUIDE.md"), "utf8"), /Runtime\noffline behavior is \*\*not evaluated\*\*/);
  assert.match(await readFile(resolve(first, "CONFORMANCE-REPORT.md"), "utf8"), /Release claim: \*\*none\*\*/);
  assert.match(await readFile(resolve(first, "CONFORMANCE-REPORT.md"), "utf8"), /no receipt, manual status, or free-form evidence/);
  const generatedMatrix = JSON.parse(await readFile(resolve(first, "browser-compatibility-matrix.json")));
  assert.equal(generatedMatrix.evidenceStatus, "not-evaluated");
  assert.equal(generatedMatrix.closedInventoryStatus, "closed-static-inventory");
  assert.equal(generatedMatrix.offlineRuntimeStatus, "not-evaluated");
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
  await mutateGeneratedJson("logical-build-manifest.json", value => {
    value.buildProvenance.directInputs[0].gitMode = "120000";
  }, canonicalFile, /gitMode is invalid/);
  await mutateGeneratedJson("logical-build-manifest.json", value => {
    delete value.buildProvenance.directInputs[0].gitMode;
  });
  await mutateGeneratedJson("rights-provenance.json", value => {
    value.records[0].privatePath = "/home/tay/private-rights";
  });
  await mutateGeneratedJson("source-map.json", value => {
    value.mappings[0].sources[0].path = "/home/tay/private-source";
  });
  await mutateGeneratedJson("source-map.json", value => {
    value.mappings[0].sources[0].gitMode = "160000";
  }, canonicalFile, /gitMode is invalid/);
  {
    const sourceMapPath = resolve(schemaFixture, "source-map.json");
    const manifestPath = resolve(schemaFixture, "logical-build-manifest.json");
    const originalSourceMap = await readFile(sourceMapPath);
    const originalManifest = await readFile(manifestPath);
    try {
      const alteredSourceMap = JSON.parse(originalSourceMap);
      alteredSourceMap.mappings.find(mapping => mapping.output === "source-map.json").sources.pop();
      const alteredSourceMapBytes = canonicalFile(alteredSourceMap);
      await writeFile(sourceMapPath, alteredSourceMapBytes);
      const alteredManifest = JSON.parse(originalManifest);
      alteredManifest.sourceMapSha256 = sha256(alteredSourceMapBytes);
      await writeFile(manifestPath, canonicalFile(alteredManifest));
      await reject(verifyCadrM14(schemaFixture), /does not list every direct input/);
    } finally {
      await writeFile(sourceMapPath, originalSourceMap);
      await writeFile(manifestPath, originalManifest);
    }
  }
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
console.log("cadr M14 deterministic static-inventory release scaffold tests passed");
