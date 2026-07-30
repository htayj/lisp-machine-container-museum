#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReady4Runs, canonicalJson, readRegularCanonical } from
  "./cadr-m6-ready4-evidence.mjs";
import { pinSelectedImageNegativeReceipt, readSelectedImageNegativeReceipt,
  validatePinnedSelectedImageNegativeReceipt } from
  "./cadr-m6-selected-image-negative-evidence.mjs";

const usage = "usage: node scripts/validate-cadr-m6-ready4-evidence.mjs --structural-only --run RUN1 --run RUN2 --run RUN3 --selected-image-negative-receipt RECEIPT.json [--campaign CAMPAIGN]";

export async function validateReady4Evidence({ runs, campaign = null,
  selectedImageNegativeReceipt, structuralOnly = false }) {
  if (structuralOnly !== true) {
    throw new TypeError("external JSON can establish structural consistency only, never READY4 gate success");
  }
  if (!Array.isArray(runs) || runs.length !== 3) throw new TypeError("validator requires exactly three paths");
  const records = await Promise.all(runs.map((path, index) =>
    readRegularCanonical(path, `READY4 run ${index}`)));
  const prerequisite = validatePinnedSelectedImageNegativeReceipt(
    pinSelectedImageNegativeReceipt(await readSelectedImageNegativeReceipt(
      selectedImageNegativeReceipt, "READY4 selected-image negative prerequisite")));
  const aggregate = aggregateReady4Runs(records.map(record => record.value),
    prerequisite.token);
  if (campaign !== null) {
    const candidate = await readRegularCanonical(campaign, "READY4 campaign");
    if (canonicalJson(candidate.value) !== canonicalJson(aggregate)) {
      throw new TypeError("campaign envelope differs from independently aggregated evidence");
    }
  }
  return Object.freeze({ mode: "structural-consistency-only",
    gate_success_established: false, aggregate });
}

export function parseArguments(argv) {
  const result = { runs: [], campaign: null, selectedImageNegativeReceipt: null,
    structuralOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--structural-only") {
      if (result.structuralOnly) throw new TypeError("duplicate --structural-only");
      result.structuralOnly = true;
      continue;
    }
    const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a path`);
    if (option === "--run") result.runs.push(resolve(process.cwd(), value));
    else if (option === "--campaign" && result.campaign === null) result.campaign = resolve(process.cwd(), value);
    else if (option === "--selected-image-negative-receipt" &&
        result.selectedImageNegativeReceipt === null) {
      result.selectedImageNegativeReceipt = resolve(process.cwd(), value);
    }
    else throw new TypeError(`unsupported validator argument ${JSON.stringify(option)}`);
  }
  if (result.runs.length !== 3 || new Set(result.runs).size !== 3 ||
      result.selectedImageNegativeReceipt === null ||
      !result.structuralOnly) throw new TypeError(usage);
  return Object.freeze(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) console.log(usage);
  else await validateReady4Evidence(parseArguments(process.argv.slice(2)))
    .then(() => process.stderr.write(
      "structural consistency only; READY4 gate success was not established\n"));
}
