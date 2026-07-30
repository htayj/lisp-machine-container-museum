#!/usr/bin/env node
import { link, mkdir, open, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReady4Runs, canonicalJson, readRegularCanonical,
  ready4CampaignFailure, sha256Hex } from "./cadr-m6-ready4-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const usage = "usage: node scripts/aggregate-cadr-m6-ready4-campaign.mjs --execute --run RUN1 --run RUN2 --run RUN3 --output OUTPUT [--failure-output OUTPUT.failure.json]";

export function parseArguments(argv) {
  const result = { execute: false, runs: [], output: null, failureOutput: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") { if (result.execute) throw new TypeError("duplicate --execute"); result.execute = true; }
    else if (["--run", "--output", "--failure-output"].includes(option)) {
      const value = argv[++index];
      if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a path`);
      if (option === "--run") result.runs.push(resolve(process.cwd(), value));
      else if (option === "--output") { if (result.output !== null) throw new TypeError("duplicate --output"); result.output = resolve(process.cwd(), value); }
      else { if (result.failureOutput !== null) throw new TypeError("duplicate --failure-output"); result.failureOutput = resolve(process.cwd(), value); }
    } else throw new TypeError(`unsupported aggregate argument ${JSON.stringify(option)}`);
  }
  if (!result.execute || result.runs.length !== 3 || result.output === null) {
    throw new TypeError(`${usage}\nAggregation is inert unless --execute names exactly three regular run records.`);
  }
  if (new Set(result.runs).size !== 3) throw new TypeError("three READY4 inputs must have distinct paths");
  result.failureOutput ??= `${result.output}.failure.json`;
  if (result.failureOutput === result.output) throw new TypeError("failure and success outputs must differ");
  return Object.freeze(result);
}

export async function writeCanonicalNoReplace(path, value, mode = 0o600) {
  const directory = dirname(path); await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = resolve(directory, `.${sha256Hex(Buffer.from(path))}.tmp-${process.pid}`);
  const bytes = Buffer.from(canonicalJson(value));
  let handle;
  try {
    handle = await open(temporary, "wx", mode); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
    await link(temporary, path);
    const parent = await open(directory, "r"); try { await parent.sync(); } finally { await parent.close(); }
    await rm(temporary, { force: true });
    return Object.freeze({ byteCount: bytes.byteLength, sha256: sha256Hex(bytes) });
  } catch (error) {
    if (handle !== undefined && handle !== null) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined); throw error;
  }
}

export async function aggregate(options) {
  const loaded = await Promise.all(options.runs.map((path, index) =>
    readRegularCanonical(path, `READY4 run ${index}`)));
  try {
    const output = aggregateReady4Runs(loaded.map(item => item.value));
    await writeCanonicalNoReplace(options.output, output);
    return output;
  } catch (error) {
    const diagnostics = loaded.map(item => item.sha256);
    await writeCanonicalNoReplace(options.failureOutput, ready4CampaignFailure(
      "three-run-witness-mismatch", loaded.length, diagnostics));
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) console.log(usage);
  else await aggregate(parseArguments(process.argv.slice(2))).then(() => undefined);
}
