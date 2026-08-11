import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, cp, link, lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { cadrM14EvidenceCanonical } from "../scripts/cadr-m14-evidence.mjs";
import { compareCadrM14StaticReproductions,
  createCadrM14StaticReproductionComparisonTestHooks, serializeCadrM14StaticReproductionComparison } from "../scripts/cadr-m14-static-reproduction-comparison.mjs";
import { assertCadrM14PublicationReceipt, closeCadrM14PublicationCapability, createCadrM14PublicationCapability,
  createCadrM14PublicationTestCapability, createCadrM14PublicationTestHooks, publishCadrM14ComparisonReport,
  serializeCadrM14PublicationReceipt } from "../scripts/cadr-m14-publication.mjs";

const repo = resolve(import.meta.dirname, ".."); const root = resolve(repo, "build/cadr-m14"); const published = resolve(root, "test-published"); const productionPublished = resolve(root, "published");
const id = `${process.pid}-${Date.now().toString(36)}`; const left = resolve(root, `publication-left-${id}`); const right = resolve(root, `publication-right-${id}`);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const linkHelper = resolve(root, "cadr-m14-link-helper"); let linkHelperSha256 = null;
const mint = fields => createCadrM14PublicationTestCapability({ expectedLinkHelperSha256: linkHelperSha256, ...fields });
async function reject(value, expression) { await assert.rejects(value, expression); }
async function remove(name) { await rm(resolve(published, name), { force: true }); }
async function privateNames() { return (await readdir(published)).filter(name => name.startsWith(".cadr-m14-") && (name.endsWith(".tmp") || name.endsWith(".ready"))); }
function getter(values, name) { const value = { ...values }; Object.defineProperty(value, name, { enumerable: true, get() { throw new Error("getter ran"); } }); return value; }
function cli(args) { return spawnSync("node", ["scripts/publish-cadr-m14-release.mjs", ...args], { cwd: repo, encoding: "utf8" }); }
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stderr}`); return result;
}
/* The package builder intentionally rejects a dirty source tree.  Publication
 * tests therefore construct disposable commits of the exact current source,
 * as the release test does, then copy only their generated candidate leafs
 * into this test's confined build root.  No generated package becomes a
 * repository publication or a source of authority. */
async function buildCurrentCandidate(destination) {
  const extraction = await mkdtemp(resolve(tmpdir(), "cadr-m14-publication-extraction-"));
  try {
    const listed = [...new Set([
      ...run("git", ["ls-files", "-z"], repo).stdout.split("\0"),
      ...run("git", ["diff", "--name-only", "-z"], repo).stdout.split("\0"),
      ...run("git", ["ls-files", "--others", "--exclude-standard", "-z"], repo).stdout.split("\0"),
    ].filter(Boolean))].sort();
    for (const path of listed) { const target = resolve(extraction, path); await mkdir(dirname(target), { recursive: true }); await cp(resolve(repo, path), target, { verbatimSymlinks: true }); }
    run("git", ["init", "--quiet"], extraction); run("git", ["add", "--all"], extraction);
    const commit = spawnSync("git", ["-c", "user.name=M14 test", "-c", "user.email=m14-test@example.invalid", "-c", "commit.gpgSign=false", "commit", "--quiet", "--no-gpg-sign", "-m", "publication current-source fixture"], {
      cwd: extraction, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: "2026-08-11T12:00:00+0000", GIT_COMMITTER_DATE: "2026-08-11T12:00:00+0000" },
    });
    assert.equal(commit.status, 0, commit.stderr);
    run("node", ["scripts/build-cadr-m14-release.mjs", "--output", "build/cadr-m14/fixture"], extraction);
    await cp(resolve(extraction, "build/cadr-m14/fixture"), destination, { recursive: true, force: true, verbatimSymlinks: true });
  } finally { await rm(extraction, { recursive: true, force: true }); }
}
function receipt(value, fields) {
  assert.equal(assertCadrM14PublicationReceipt(value), value); assert.equal(value.retryPolicy, "never-automatic");
  for (const [key, expected] of Object.entries(fields)) assert.equal(value[key], expected, key);
  assert.equal(value.report.sha256.length, 64); assert.ok(value.report.byteCount > 0);
}

try {
  await mkdir(root, { recursive: true }); const previousUmask = process.umask(0o077); let helperBuild;
  try { helperBuild = spawnSync("cc", ["-static", "-O2", "-std=c11", "-D_GNU_SOURCE", "-Wall", "-Wextra", "-Werror", "-o", linkHelper, "scripts/cadr-m14-link-helper.c"], { cwd: repo, encoding: "utf8" }); }
  finally { process.umask(previousUmask); }
  assert.equal(helperBuild.status, 0, helperBuild.stderr); await chmod(linkHelper, 0o755);
  assert.equal((await lstat(linkHelper, { bigint: true })).mode & 0o777n, 0o755n, "helper build overrides an inherited restrictive umask");
  const dynamic = spawnSync("ldd", [linkHelper], { encoding: "utf8" }); assert.doesNotMatch(`${dynamic.stdout}${dynamic.stderr}`, /=>\s*\//u, "link helper is not dynamically linked"); linkHelperSha256 = hash(await readFile(linkHelper));
  await mkdir(published, { recursive: true }); for (const name of await privateNames()) await rm(resolve(published, name), { force: true });
  await buildCurrentCandidate(left); await buildCurrentCandidate(right);
  const policyHash = hash(await readFile(resolve(repo, "cadr-web/release/cadr-m14-evidence-policy.json")));
  const comparatorHash = hash(await readFile(resolve(repo, "scripts/cadr-m14-static-reproduction-comparison.mjs")));
  const evidenceEnginePath = resolve(repo, "scripts/cadr-m14-evidence.mjs"); const evidenceEngineHash = hash(await readFile(evidenceEnginePath));
  const compareOptions = () => ({ expectedComparatorSha256: comparatorHash, expectedEvidenceEngineSha256: evidenceEngineHash, expectedEvidencePolicySha256: policyHash,
    reproductions: [{ packagePath: left }, { packagePath: right }] });
  await reject(compareCadrM14StaticReproductions({ ...compareOptions(), expectedComparatorSha256: "0".repeat(64) }), /comparator caller pin differs|comparator differs/);
  await reject(compareCadrM14StaticReproductions({ ...compareOptions(), expectedEvidenceEngineSha256: "0".repeat(64) }), /evidence engine caller pin differs|evidence engine differs/);
  const savedEngine = `${evidenceEnginePath}.saved-${id}`;
  await rename(evidenceEnginePath, savedEngine); await writeFile(evidenceEnginePath, "replacement", { flag: "wx" });
  try {
    await reject(compareCadrM14StaticReproductions(compareOptions()), /evidence engine differs/);
    await reject(compareCadrM14StaticReproductions({ ...compareOptions(), expectedEvidenceEngineSha256: hash(Buffer.from("replacement")) }),
      /caller pin differs from the executing module identity/);
  }
  finally { await rm(evidenceEnginePath, { force: true }); await rename(savedEngine, evidenceEnginePath); }
  const comparatorPath = resolve(repo, "scripts/cadr-m14-static-reproduction-comparison.mjs"); const savedComparator = `${comparatorPath}.saved-${id}`;
  await rename(comparatorPath, savedComparator); await writeFile(comparatorPath, "replacement", { flag: "wx" });
  try {
    await reject(compareCadrM14StaticReproductions({ ...compareOptions(), expectedComparatorSha256: hash(Buffer.from("replacement")) }),
      /caller pin differs from the executing module identity/);
  } finally { await rm(comparatorPath, { force: true }); await rename(savedComparator, comparatorPath); }
  await reject(compareCadrM14StaticReproductions(getter(compareOptions(), "reproductions")), /data field/);
  const archiveAlias = resolve(left, "logical-build-manifest.json.alias"); await link(resolve(left, "logical-build-manifest.json"), archiveAlias);
  await reject(compareCadrM14StaticReproductions(compareOptions()), /one-link|pairwise distinct/); await unlink(archiveAlias);
  const sourceAlias = resolve(left, "source-map.json.alias"); await link(resolve(left, "source-map.json"), sourceAlias);
  await reject(compareCadrM14StaticReproductions(compareOptions()), /one-link|pairwise distinct/); await unlink(sourceAlias);
  await reject(compareCadrM14StaticReproductions({ ...compareOptions(), reproductions: [compareOptions().reproductions[0], compareOptions().reproductions[0]] }), /pairwise distinct/);
  const fixtureManifest = resolve(left, "logical-build-manifest.json"); const savedManifest = `${fixtureManifest}.saved`;
  async function malformedManifest(make, expression = /one-link|regular|cannot be opened/) {
    await rename(fixtureManifest, savedManifest);
    try { await make(); await reject(compareCadrM14StaticReproductions(compareOptions()), expression); }
    finally { await rm(fixtureManifest, { recursive: true, force: true }); await rename(savedManifest, fixtureManifest); }
  }
  await malformedManifest(() => symlink(savedManifest, fixtureManifest));
  await malformedManifest(() => mkdir(fixtureManifest));
  await malformedManifest(async () => { const result = spawnSync("mkfifo", [fixtureManifest]); assert.equal(result.status, 0, result.stderr?.toString()); });
  await malformedManifest(async () => {
    /* The checkout pathname exceeds Linux's UNIX-socket limit.  Bind through
     * a short retained /proc descriptor path so lstat still sees a socket at
     * the exact logical-manifest leaf. */
    const result = spawnSync("/usr/bin/python3", ["-c", "import os,socket,sys; d=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY); s=socket.socket(socket.AF_UNIX); s.bind('/proc/self/fd/%d/logical-build-manifest.json'%d)", left]);
    assert.equal(result.status, 0, result.stderr?.toString());
  });
  const leftManifest = resolve(left, "logical-build-manifest.json"); const leftSourceMap = resolve(left, "source-map.json");
  const originalManifest = await readFile(leftManifest); const originalSourceMap = await readFile(leftSourceMap);
  let replacedInput = false;
  const inputReplacement = createCadrM14StaticReproductionComparisonTestHooks({ afterInputsOpen: async index => {
    if (index === 0 && !replacedInput) { replacedInput = true; await rename(leftSourceMap, `${leftSourceMap}.opened`); await writeFile(leftSourceMap, "replacement", { flag: "wx" }); }
  } });
  try { await reject(compareCadrM14StaticReproductions({ ...compareOptions(), testHooks: inputReplacement }), /became stale|one-link/); }
  finally { await rm(leftSourceMap, { force: true }); await rename(`${leftSourceMap}.opened`, leftSourceMap); }
  const incompleteManifest = JSON.parse(originalManifest); incompleteManifest.files = [...incompleteManifest.files, { path: "malformed", sha256: "0".repeat(64) }];
  await writeFile(leftManifest, `${cadrM14EvidenceCanonical(incompleteManifest)}\n`);
  await reject(compareCadrM14StaticReproductions(compareOptions()), /exact M14 evidence candidate/);
  await writeFile(leftManifest, originalManifest);
  let injectedClose = false; const closeFailure = createCadrM14StaticReproductionComparisonTestHooks({ beforeClose: async label => {
    if (!injectedClose && label.includes("source map")) { injectedClose = true; throw new Error("injected comparator close loss"); }
  } });
  await reject(compareCadrM14StaticReproductions({ ...compareOptions(), testHooks: closeFailure }), /injected comparator close loss/); assert.equal(injectedClose, true, "comparison exposes close uncertainty rather than returning a branded report");
  for (const [axis, mutateManifest, mutateSourceMap] of [
    ["sourceIdentity", value => { value.buildProvenance.git.revision = "f".repeat(40); }, value => { value.provenance.git.revision = "f".repeat(40); }],
    ["sourceClosure", value => { value.buildProvenance.directInputs = [...value.buildProvenance.directInputs, { path: "synthetic-input", byteCount: 0, sha256: "0".repeat(64), gitBlob: "0".repeat(40), gitMode: "100644" }]; }, value => { value.provenance.directInputs = [...value.provenance.directInputs, { path: "synthetic-input", byteCount: 0, sha256: "0".repeat(64), gitBlob: "0".repeat(40), gitMode: "100644" }]; }],
    ["artifactSet", value => { value.files = [...value.files, { url: "/synthetic", path: "synthetic", mediaType: "application/octet-stream", mode: "0644", byteCount: 0, sha256: "0".repeat(64), rightsId: "UNRESOLVED" }]; }, () => {}],
    ["toolchainSet", value => { value.buildProvenance.node.version = "v0-synthetic"; }, value => { value.provenance.node.version = "v0-synthetic"; }],
  ]) {
    const altered = JSON.parse(originalManifest); const alteredSourceMap = JSON.parse(originalSourceMap); mutateManifest(altered); mutateSourceMap(alteredSourceMap);
    const alteredSourceMapBytes = Buffer.from(`${cadrM14EvidenceCanonical(alteredSourceMap)}\n`); altered.sourceMapSha256 = hash(alteredSourceMapBytes);
    await writeFile(leftSourceMap, alteredSourceMapBytes); await writeFile(leftManifest, `${cadrM14EvidenceCanonical(altered)}\n`);
    const difference = await compareCadrM14StaticReproductions(compareOptions());
    assert.equal(difference.matches[axis], false, `${axis} is independently compared`); assert.equal(difference.outcome, "static-difference-observed");
    await writeFile(leftSourceMap, originalSourceMap); await writeFile(leftManifest, originalManifest);
  }
  const comparison = await compareCadrM14StaticReproductions(compareOptions());
  const reversed = await compareCadrM14StaticReproductions({ ...compareOptions(), reproductions: [...compareOptions().reproductions].reverse() });
  assert.equal(serializeCadrM14StaticReproductionComparison(comparison), serializeCadrM14StaticReproductionComparison(reversed),
    "canonical comparison sorting makes input order unobservable");
  const inputBuildRoot = resolve(repo, "build"); const savedInputBuildRoot = `${inputBuildRoot}.input-symlink-${id}`;
  await rename(inputBuildRoot, savedInputBuildRoot); await symlink(savedInputBuildRoot, inputBuildRoot);
  try { await reject(compareCadrM14StaticReproductions(compareOptions()), /comparison build root pathname must be a non-symlink directory/); }
  finally { await rm(inputBuildRoot, { force: true }); await rename(savedInputBuildRoot, inputBuildRoot); }
  let inputAncestorReplaced = false; const postCaptureAncestor = createCadrM14StaticReproductionComparisonTestHooks({ afterInputsOpen: async index => {
    if (index === 0 && !inputAncestorReplaced) { inputAncestorReplaced = true; await rename(inputBuildRoot, savedInputBuildRoot); await symlink(savedInputBuildRoot, inputBuildRoot); }
  } });
  try { await reject(compareCadrM14StaticReproductions({ ...compareOptions(), testHooks: postCaptureAncestor }), /ancestor build became stale|comparison build root pathname|comparison repository root changed/); }
  finally { await rm(inputBuildRoot, { force: true }); await rename(savedInputBuildRoot, inputBuildRoot); }

  /* These APIs imported before mutation captured native descriptor operations at
   * module evaluation.  Replacing every inherited operation/accessor cannot
   * redirect comparison, capability capture, or report publication. */
  const probe = await open(leftManifest, "r"); const fileHandlePrototype = Object.getPrototypeOf(probe); await probe.close();
  for (const method of ["read", "stat", "write", "sync", "fd"]) {
    const descriptor = Object.getOwnPropertyDescriptor(fileHandlePrototype, method); assert.ok(descriptor, `${method} descriptor exists`);
    Object.defineProperty(fileHandlePrototype, method, method === "fd" ? { configurable: true, get() { throw new Error(`mutated ${method}`); } } :
      { configurable: true, writable: true, value() { throw new Error(`mutated ${method}`); } });
    const hardenedName = `prototype-${method}-${id}.json`;
    try {
      const hardenedComparison = await compareCadrM14StaticReproductions(compareOptions());
      const hardenedCapability = await mint({ comparison: hardenedComparison });
      const hardenedReceipt = await publishCadrM14ComparisonReport(hardenedCapability, { name: hardenedName });
      receipt(hardenedReceipt, { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true });
    } finally { Object.defineProperty(fileHandlePrototype, method, descriptor); }
    await remove(hardenedName);
  }

  await reject(createCadrM14PublicationCapability({ comparison }), /production publication authority is not registered/);
  await reject(createCadrM14PublicationCapability({ comparison, expectedLinkHelperSha256: linkHelperSha256 }), /production publication authority is not registered/);
  await reject(createCadrM14PublicationTestCapability({ comparison }), /expected link helper SHA-256/);
  await reject(createCadrM14PublicationTestCapability({ comparison, expectedLinkHelperSha256: linkHelperSha256, outputRoot: productionPublished }), /unsupported fields/);
  await reject(lstat(productionPublished), /ENOENT/, "the synthetic test capability never creates the production root");
  await reject(mint({ comparison: structuredClone(comparison) }), /module-created report/);
  await reject(createCadrM14PublicationCapability(getter({ comparison, expectedLinkHelperSha256: linkHelperSha256 }, "comparison")), /data field/);
  await reject(mint({ comparison, expectedLinkHelperSha256: "0".repeat(64) }), /link helper differs/);
  await reject(Promise.resolve().then(() => createCadrM14PublicationTestHooks(getter({}, "afterFinalLink"))), /data field/);

  let sealedSnapshotObserved = false;
  const snapshotProbe = await mint({ comparison, testHooks: createCadrM14PublicationTestHooks({ afterHelperSnapshot: async (operations, identity) => {
    sealedSnapshotObserved = true; assert.equal(identity.nlink, 0n); assert.equal(identity.mode, 0o500n); await reject(operations.write(Buffer.from("x"), 0, 1, 0), /EBADF|bad file descriptor/i);
  } }) });
  await closeCadrM14PublicationCapability(snapshotProbe); assert.equal(sealedSnapshotObserved, true, "only a read/exec anonymous helper snapshot survives minting");

  const successName = `comparison-${id}.json`; await remove(successName);
  const capability = await mint({ comparison });
  assert.deepEqual(Reflect.ownKeys(capability), [], "the capability is opaque and keyless");
  await reject(publishCadrM14ComparisonReport(structuredClone(capability), { name: successName }), /not recognized/);
  await reject(publishCadrM14ComparisonReport(capability, getter({ name: successName }, "name")), /data field/);
  for (const name of ["../escape", "a/b", ".", "..", "", "x".repeat(129)]) await reject(publishCadrM14ComparisonReport(capability, { name }), /safe basename/);
  const success = await publishCadrM14ComparisonReport(capability, { name: successName });
  receipt(success, { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true,
    cleanupDirectorySyncConfirmed: true });
  assert.deepEqual(await readFile(resolve(published, successName)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)),
    "only canonical comparison report bytes are published");
  await reject(publishCadrM14ComparisonReport(capability, { name: `again-${id}` }), /closed/);
  await closeCadrM14PublicationCapability(capability);
  assert.throws(() => assertCadrM14PublicationReceipt(structuredClone(success)), /exact closed receipt/);
  assert.throws(() => assertCadrM14PublicationReceipt({ ...success }), /exact closed receipt/);

  const lifecycleName = `lifecycle-${id}.json`; await remove(lifecycleName); let lifecycleReady = null;
  const lifecycleCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({
      afterTempCreate: async () => { const names = await privateNames(); assert.equal(names.filter(name => name.endsWith(".tmp")).length, 1, "one private temp exists"); },
      afterRenameReady: async () => { const names = await privateNames(); lifecycleReady = names.find(name => name.endsWith(".ready")); assert.ok(lifecycleReady, "ready replaces temp"); assert.equal(names.some(name => name.endsWith(".tmp")), false); assert.equal((await lstat(resolve(published, lifecycleReady), { bigint: true })).nlink, 1n); },
      afterFinalLink: async () => { const finalInfo = await lstat(resolve(published, lifecycleName), { bigint: true }); const readyInfo = await lstat(resolve(published, lifecycleReady), { bigint: true }); assert.equal(finalInfo.nlink, 2n); assert.equal(readyInfo.nlink, 2n); assert.equal(finalInfo.dev, readyInfo.dev); assert.equal(finalInfo.ino, readyInfo.ino); },
      afterReadyUnlink: async () => { const finalInfo = await lstat(resolve(published, lifecycleName), { bigint: true }); assert.equal(finalInfo.nlink, 1n); await reject(lstat(resolve(published, lifecycleReady)), /ENOENT/); },
    }) });
  receipt(await publishCadrM14ComparisonReport(lifecycleCapability, { name: lifecycleName }), { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true });
  assert.deepEqual(await privateNames(), [], "success leaves no private temp or ready names"); await remove(lifecycleName);

  const preLinkSeams = ["afterTempCreate", "beforeTempWrite", "afterTempWrite", "beforeTempSync", "afterTempSync", "beforeTempClose", "afterTempClose", "beforeRenameReady", "afterRenameReady", "beforeReadyOpen", "afterReadyOpen", "beforeFinalLink"];
  for (const seam of preLinkSeams) {
    const name = `pre-${seam}-${id}.json`; await remove(name);
    const hooks = createCadrM14PublicationTestHooks({ [seam]: async () => { throw new Error(`injected ${seam}`); } });
    const seamCapability = await mint({ comparison, testHooks: hooks });
    const seamReceipt = await publishCadrM14ComparisonReport(seamCapability, { name });
    receipt(seamReceipt, { disposition: "not-published", published: false, directorySyncConfirmed: false });
    await reject(lstat(resolve(published, name)), /ENOENT/); assert.deepEqual(await privateNames(), [], `${seam} removes every private pre-link name`);
  }
  const postLinkSeams = ["afterFinalLink", "beforeFinalOpen", "afterFinalOpen", "afterFinalStat", "afterFinalRead", "afterFinalHash", "beforeFinalSync", "afterFinalSync", "beforeReadyUnlink", "afterReadyUnlink", "beforeDirectorySync", "afterDirectorySync"];
  for (const seam of postLinkSeams) {
    const name = `post-${seam}-${id}.json`; await remove(name);
    const hooks = createCadrM14PublicationTestHooks({ [seam]: async () => { throw new Error(`injected ${seam}`); } });
    const seamCapability = await mint({ comparison, testHooks: hooks });
    const seamReceipt = await publishCadrM14ComparisonReport(seamCapability, { name });
    receipt(seamReceipt, { published: true }); assert.ok(serializeCadrM14PublicationReceipt(seamReceipt).endsWith("\n"));
    assert.equal(seamReceipt.published, true, `${seam} is after final link`); assert.notEqual(seamReceipt.disposition, "not-published");
    assert.deepEqual(await readFile(resolve(published, name)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)), `${seam} retains final report`);
    await remove(name); for (const privateName of await privateNames()) await rm(resolve(published, privateName), { force: true });
  }

  const existingName = `existing-${id}.json`; await remove(existingName); await writeFile(resolve(published, existingName), "existing", { flag: "wx" });
  const existingCapability = await mint({ comparison });
  const existing = await publishCadrM14ComparisonReport(existingCapability, { name: existingName });
  receipt(existing, { disposition: "not-published", published: false, cleanupConfirmed: true, directorySyncConfirmed: false,
    cleanupDirectorySyncConfirmed: true });

  const attackerName = `attacker-${id}.json`; await remove(attackerName);
  const attackerCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ beforeFinalLink: async name => { await writeFile(resolve(published, name), "attacker", { flag: "wx" }); } }) });
  const attacker = await publishCadrM14ComparisonReport(attackerCapability, { name: attackerName });
  receipt(attacker, { disposition: "published-identity-indeterminate", published: true, cleanupConfirmed: false, directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false, final: null });
  assert.equal(await readFile(resolve(published, attackerName), "utf8"), "attacker", "insertion before link is never overwritten or removed"); await remove(attackerName);
  for (const privateName of await privateNames()) await rm(resolve(published, privateName), { force: true });

  const completionLossName = `completion-loss-${id}.json`; await remove(completionLossName); let linkCompletions = 0; let completionReady = null;
  const completionLossCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ afterDescriptorLink: async () => { linkCompletions += 1; completionReady = (await privateNames()).find(name => name.endsWith(".ready")); throw new Error("link completion response lost"); } }) });
  const completionLoss = await publishCadrM14ComparisonReport(completionLossCapability, { name: completionLossName });
  receipt(completionLoss, { disposition: "published-cleanup-unconfirmed", published: true, cleanupConfirmed: false, directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
  assert.equal(linkCompletions, 1, "a lost helper completion never triggers a second link attempt"); assert.ok(completionReady, "lost completion retains ready for explicit recovery");
  const completionFinalInfo = await lstat(resolve(published, completionLossName), { bigint: true }); const completionReadyInfo = await lstat(resolve(published, completionReady), { bigint: true });
  assert.equal(completionFinalInfo.nlink, 2n); assert.equal(completionFinalInfo.dev, completionReadyInfo.dev); assert.equal(completionFinalInfo.ino, completionReadyInfo.ino);
  assert.deepEqual(await readFile(resolve(published, completionLossName)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)), "lost completion still retains exact report final");
  await rm(resolve(published, completionReady), { force: true }); await remove(completionLossName);

  const helperReplacementName = `helper-replaced-${id}.json`; const helperReplacementCapability = await mint({ comparison }); const savedHelper = `${linkHelper}.saved-${id}`;
  await rename(linkHelper, savedHelper); await writeFile(linkHelper, "replacement", { flag: "wx" });
  try {
    const helperReplacement = await publishCadrM14ComparisonReport(helperReplacementCapability, { name: helperReplacementName });
    receipt(helperReplacement, { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true, cleanupDirectorySyncConfirmed: true });
  } finally { await remove(helperReplacementName); await rm(linkHelper, { force: true }); await rename(savedHelper, linkHelper); }

  const replacedRoot = `${published}.replaced-${id}`; const parentReplacementCapability = await mint({ comparison });
  await rename(published, replacedRoot); await mkdir(published);
  try {
    const parentReplacement = await publishCadrM14ComparisonReport(parentReplacementCapability, { name: `parent-replaced-${id}.json` });
    receipt(parentReplacement, { disposition: "not-published", published: false, directorySyncConfirmed: false });
    assert.equal((await readdir(replacedRoot)).some(name => name.includes(`parent-replaced-${id}`)), false, "retained directory is not used after its public parent is replaced");
  } finally { await rm(published, { recursive: true, force: true }); await rename(replacedRoot, published); }

  const buildRoot = resolve(repo, "build"); const savedBuildRoot = `${buildRoot}.saved-${id}`;
  await rename(buildRoot, savedBuildRoot); await symlink(savedBuildRoot, buildRoot);
  try { await reject(mint({ comparison }), /M14 build root pathname must be a non-symlink directory/); }
  finally { await rm(buildRoot, { force: true }); await rename(savedBuildRoot, buildRoot); }

  let partialClosed = 0;
  const partialHooks = createCadrM14PublicationTestHooks({ afterDirectoryOpen: async () => { throw new Error("injected directory open loss"); },
    onClosed: async key => { if (key === "directory") partialClosed += 1; } });
  await reject(mint({ comparison, testHooks: partialHooks }), /injected directory open loss/);
  assert.equal(partialClosed, 1, "partial capability capture closes the retained directory handle");

  const tempFailureName = `temp-failure-${id}.json`; await remove(tempFailureName);
  const tempFailureCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ syncTemp: async () => { throw new Error("temp fsync loss"); } }) });
  const tempFailure = await publishCadrM14ComparisonReport(tempFailureCapability, { name: tempFailureName });
  receipt(tempFailure, { disposition: "not-published", published: false, cleanupConfirmed: true, directorySyncConfirmed: false });
  await reject(lstat(resolve(published, tempFailureName)), /ENOENT/);

  const syncFailureName = `sync-failure-${id}.json`; await remove(syncFailureName);
  const syncFailureCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ syncDirectory: async () => { throw new Error("dir sync loss"); } }) });
  const syncFailure = await publishCadrM14ComparisonReport(syncFailureCapability, { name: syncFailureName });
  receipt(syncFailure, { disposition: "published-durability-indeterminate", published: true, cleanupConfirmed: true,
    directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
  assert.deepEqual(await readFile(resolve(published, syncFailureName)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)),
    "post-link directory-sync failure retains the final report");

  const cleanupFailureName = `cleanup-failure-${id}.json`; await remove(cleanupFailureName);
  let strandedReady = null;
  const cleanupFailureCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ unlinkReady: async path => { strandedReady = basename(path); throw new Error("ready cleanup loss"); } }) });
  const cleanupFailure = await publishCadrM14ComparisonReport(cleanupFailureCapability, { name: cleanupFailureName });
  receipt(cleanupFailure, { disposition: "published-cleanup-unconfirmed", published: true, cleanupConfirmed: false,
    directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false });
  assert.deepEqual(await readFile(resolve(published, cleanupFailureName)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)));
  if (strandedReady !== null) await rm(resolve(published, strandedReady), { force: true });

  const identityFailureName = `identity-failure-${id}.json`; const identityPath = resolve(published, identityFailureName); await remove(identityFailureName);
  const identityFailureCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ afterFinalLink: async () => {
      await rename(identityPath, `${identityPath}.saved`); await writeFile(identityPath, "untrusted replacement", { flag: "wx" });
    } }) });
  const identityFailure = await publishCadrM14ComparisonReport(identityFailureCapability, { name: identityFailureName });
  receipt(identityFailure, { disposition: "published-identity-indeterminate", published: true, cleanupConfirmed: false,
    directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false, final: null });
  assert.equal(await readFile(identityPath, "utf8"), "untrusted replacement", "identity uncertainty never removes final");
  await unlink(identityPath); await unlink(`${identityPath}.saved`);

  /* A held descriptor cannot make a silently replaced final look durable.
   * Exercise every post-open seam, including the intervals on each side of
   * READY unlink and the directory fsync acknowledgement. */
  for (const seam of ["afterFinalOpen", "afterFinalHash", "beforeReadyUnlink", "afterReadyUnlink", "beforeDirectorySync", "afterDirectorySync"]) {
    const name = `replaced-${seam}-${id}.json`; const path = resolve(published, name); const saved = `${path}.saved`;
    await remove(name); await rm(saved, { force: true });
    const replacementCapability = await mint({ comparison,
      testHooks: createCadrM14PublicationTestHooks({ [seam]: async () => {
        await rename(path, saved); await writeFile(path, "untrusted replacement", { flag: "wx" });
      } }) });
    const replacement = await publishCadrM14ComparisonReport(replacementCapability, { name });
    receipt(replacement, { disposition: "published-identity-indeterminate", published: true, cleanupConfirmed: false,
      directorySyncConfirmed: false, cleanupDirectorySyncConfirmed: false, final: null });
    assert.equal(await readFile(path, "utf8"), "untrusted replacement", `${seam} preserves the attacker replacement`);
    await unlink(path); await rm(saved, { force: true });
    for (const privateName of await privateNames()) await rm(resolve(published, privateName), { force: true });
  }

  let resume; const gate = new Promise(resolveGate => { resume = resolveGate; }); let finalLinkCount = 0;
  const concurrentName = `concurrent-${id}.json`; await remove(concurrentName);
  const concurrentCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ beforeFinalLink: () => gate, afterFinalLink: () => { finalLinkCount += 1; } }) });
  const first = publishCadrM14ComparisonReport(concurrentCapability, { name: concurrentName }); const second = publishCadrM14ComparisonReport(concurrentCapability, { name: concurrentName });
  assert.strictEqual(first, second, "concurrent publish joins the exact publication flight");
  assert.throws(() => closeCadrM14PublicationCapability(concurrentCapability), /cannot be closed concurrently/);
  resume(); receipt(await first, { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true });
  assert.equal(finalLinkCount, 1, "one final link linearization occurs");

  const closeCapability = await mint({ comparison });
  const firstClose = closeCadrM14PublicationCapability(closeCapability); const secondClose = closeCadrM14PublicationCapability(closeCapability);
  assert.strictEqual(firstClose, secondClose, "concurrent close joins one exact close flight"); await firstClose;
  await reject(publishCadrM14ComparisonReport(closeCapability, { name: `closed-${id}.json` }), /closed/);

  let closeFault = true;
  const retryCloseCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ beforeClose: async key => { if (key === "helper" && closeFault) { closeFault = false; throw new Error("injected close loss"); } } }) });
  await reject(closeCadrM14PublicationCapability(retryCloseCapability), /injected close loss/);
  await closeCadrM14PublicationCapability(retryCloseCapability);
  await reject(publishCadrM14ComparisonReport(retryCloseCapability, { name: `close-retry-${id}.json` }), /closed/);

  let terminalCloseFault = true; const terminalCloseName = `terminal-close-${id}.json`; await remove(terminalCloseName);
  const terminalCloseCapability = await mint({ comparison,
    testHooks: createCadrM14PublicationTestHooks({ beforeClose: async key => { if (key === "helper" && terminalCloseFault) { terminalCloseFault = false; throw new Error("injected terminal close loss"); } } }) });
  let terminalCloseError = null;
  try { await publishCadrM14ComparisonReport(terminalCloseCapability, { name: terminalCloseName }); } catch (error) { terminalCloseError = error; }
  assert.ok(terminalCloseError instanceof Error); assert.match(terminalCloseError.message, /injected terminal close loss/); receipt(terminalCloseError.receipt, { disposition: "published-durable", published: true, cleanupConfirmed: true, directorySyncConfirmed: true, cleanupDirectorySyncConfirmed: true });
  assert.deepEqual(await readFile(resolve(published, terminalCloseName)), Buffer.from(serializeCadrM14StaticReproductionComparison(comparison)), "terminal close loss rejects while retaining the published report");
  await closeCadrM14PublicationCapability(terminalCloseCapability); await remove(terminalCloseName);

  const packageLeft = `build/cadr-m14/${left.split("/").at(-1)}`; const packageRight = `build/cadr-m14/${right.split("/").at(-1)}`;
  const cliName = `cli-${id}.json`; await remove(cliName);
  const denied = cli(["--left-package", packageLeft, "--right-package", packageRight, "--name", cliName,
    "--evidence-policy-sha256", policyHash, "--comparator-sha256", comparatorHash, "--evidence-engine-sha256", evidenceEngineHash]);
  assert.notEqual(denied.status, 0); assert.match(denied.stderr, /production publication authority is not registered/); assert.equal(denied.stdout, "");
  for (const args of [["--package", packageLeft], ["--left-package", packageLeft, "--right-package", packageRight, "--name", "../escape",
    "--evidence-policy-sha256", policyHash, "--comparator-sha256", comparatorHash, "--evidence-engine-sha256", evidenceEngineHash]]) {
    const result = cli(args); assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  }
} finally {
  for (const name of [`comparison-${id}.json`, `existing-${id}.json`, `sync-failure-${id}.json`, `cleanup-failure-${id}.json`,
    `concurrent-${id}.json`, `cli-${id}.json`]) await remove(name);
  await rm(left, { recursive: true, force: true }); await rm(`${left}.cdrm14`, { force: true });
  await rm(right, { recursive: true, force: true }); await rm(`${right}.cdrm14`, { force: true });
  await rm(linkHelper, { force: true });
}
console.log("cadr M14 publication-capability tests passed");
