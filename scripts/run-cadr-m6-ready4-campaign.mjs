#!/usr/bin/env node
/* Three sequential READY4 runs.  Each child owns a fresh Worker and the M6
 * driver's private M4 overlay; the parent never retries, averages, or reuses
 * a successful run. */
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, writeCanonicalNoReplace } from
  "./aggregate-cadr-m6-ready4-campaign.mjs";
import { readRegularCanonical, ready4CampaignFailure } from "./cadr-m6-ready4-evidence.mjs";
import { executeSelectedImageNegativeSystemd,
  pinExecutedSelectedImageNegativeReceipt,
  validateExecutedSelectedImageNegativeToken } from
  "./run-cadr-m6-selected-image-negative-systemd.mjs";
import { ready4SourceClosure } from "./cadr-m6-wasm-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SYSTEMD = resolve(ROOT, "scripts/run-cadr-m6-ready4-systemd.mjs");

function usage() {
  return "usage: node scripts/run-cadr-m6-ready4-campaign.mjs --execute --artifact-root ROOT --output-dir DIR --benchmark BENCHMARK.json [--release-record PATH]";
}

function requiredPath(value, option) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a pathname`);
  return resolve(process.cwd(), value);
}

export function parseReady4CampaignArguments(argv) {
  const result = { execute: false, artifactRoot: null, outputDir: null,
    releaseRecord: null, benchmark: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") {
      if (result.execute) throw new TypeError("duplicate --execute"); result.execute = true;
    } else if (["--artifact-root", "--output-dir", "--release-record",
      "--benchmark"].includes(option)) {
      const key = option.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
      if (result[key] !== null) throw new TypeError(`duplicate ${option}`);
      result[key] = requiredPath(argv[++index], option);
    } else throw new TypeError(`unsupported READY4 campaign argument ${JSON.stringify(option)}`);
  }
  if (!result.execute || result.artifactRoot === null || result.outputDir === null ||
      result.benchmark === null) {
    throw new TypeError(`${usage()}\nThe three-run campaign is inert without --execute.`);
  }
  return Object.freeze(result);
}

function runChild(command, args) {
  return new Promise(resolveRun => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", error => resolveRun({ code: null, signal: null, error }));
    child.once("exit", (code, signal) => resolveRun({ code, signal, error: null }));
  });
}

async function requireVacant(path) {
  try { await lstat(path); throw new Error(`READY4 campaign output exists: ${path}`); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
}

function childArguments(options, output, prerequisite) {
  const args = [SYSTEMD, "--execute", "--artifact-root", options.artifactRoot,
    "--output", output, "--benchmark", options.benchmark,
    "--selected-image-negative-receipt-sha256",
    prerequisite.receipt_sha256];
  if (options.releaseRecord !== null) args.push("--release-record", options.releaseRecord);
  return args;
}

export async function validateReady4SelectedImagePrerequisite(options,
  { sourceClosure = ready4SourceClosure,
    executeNegative = executeSelectedImageNegativeSystemd,
    pinExecuted = pinExecutedSelectedImageNegativeReceipt,
    validateExecuted = validateExecutedSelectedImageNegativeToken } = {}) {
  const closure = await sourceClosure(ROOT);
  const root = await mkdtemp(resolve(tmpdir(),
    "cadr-m6-ready4-selected-prerequisite-"));
  try {
    const receipt = await executeNegative(Object.freeze({
      artifactRoot: options.artifactRoot,
      output: resolve(root, "selected-image-negative.json"),
    }));
    const token = pinExecuted(receipt);
    const prerequisite = validateExecuted(token);
    if (prerequisite.token.source_commit !== closure.source_commit ||
        prerequisite.token.source_closure_sha256 !==
          closure.source_closure_sha256) {
      throw new TypeError("READY4 selected-image negative prerequisite differs from current executable closure");
    }
    return Object.freeze({ prerequisite: token,
      prerequisiteIdentity: prerequisite.token, closure });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const PRODUCTION_CAMPAIGN_DEPENDENCIES =
  Object.freeze(Object.create(null));

export async function executeReady4Campaign(options, dependencies = undefined) {
  const productionExecution = arguments.length === 1;
  const overrides = productionExecution ? PRODUCTION_CAMPAIGN_DEPENDENCIES :
    dependencies;
  if (overrides === null || typeof overrides !== "object") {
    throw new TypeError("READY4 campaign dependency seam must be an object");
  }
  const run = overrides.run ?? runChild;
  const validatePrerequisite = overrides.validatePrerequisite ??
    validateReady4SelectedImagePrerequisite;
  const aggregateRuns = overrides.aggregateRuns ?? aggregate;
  /* Validate before directory creation or any child launch.  The aggregator
   * repeats the cross-binding against the three actual staged O2 receipts. */
  const retained = await validatePrerequisite(options);
  await mkdir(options.outputDir, { recursive: true, mode: 0o700 });
  const runs = [0, 1, 2].map(index => resolve(options.outputDir, `ready4-run-${index}.json`));
  const campaign = resolve(options.outputDir, productionExecution ?
    "ready4-campaign.json" : "ready4-campaign.test-only.json");
  const failure = resolve(options.outputDir, "ready4-campaign.failure.json");
  await Promise.all([...runs, campaign, failure, ...runs.map(path => `${path}.failure.json`)].map(requireVacant));
  const completed = [];
  try {
    for (const output of runs) {
      const result = await run(process.execPath, childArguments(options, output,
        retained.prerequisiteIdentity));
      if (result.error !== null || result.code !== 0 || result.signal !== null) {
        throw new Error("READY4 child run failed");
      }
      completed.push(output);
    }
    await aggregateRuns(Object.freeze({ execute: true, runs, output: campaign,
      failureOutput: failure,
      pinnedSelectedImageNegativeReceipt: retained.prerequisite }));
    return Object.freeze({ runs: Object.freeze(runs), campaign,
      mode: productionExecution ? "production" : "test-only",
      gate_success_established: productionExecution });
  } catch (error) {
    const diagnostics = [];
    for (const path of completed) diagnostics.push((await readRegularCanonical(
      path, "completed READY4 run")).sha256);
    await writeCanonicalNoReplace(failure, ready4CampaignFailure(
      completed.length === 3 ? "three-run-witness-mismatch" : "run-failed",
      completed.length, diagnostics)).catch(() => undefined);
    throw error;
  }
}

async function main() { await executeReady4Campaign(parseReady4CampaignArguments(process.argv.slice(2))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) process.stdout.write(`${usage()}\n`);
  else main().catch(error => { process.stderr.write(`READY4 campaign failed: ${error.message}\n`); process.exitCode = 1; });
}
