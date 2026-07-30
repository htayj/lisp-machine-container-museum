#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateReady4Runs, canonicalJson, readRegularCanonical } from
  "./cadr-m6-ready4-evidence.mjs";

const usage = "usage: node scripts/validate-cadr-m6-ready4-evidence.mjs --run RUN1 --run RUN2 --run RUN3 [--campaign CAMPAIGN]";

export async function validateReady4Evidence({ runs, campaign = null }) {
  if (!Array.isArray(runs) || runs.length !== 3) throw new TypeError("validator requires exactly three paths");
  const records = await Promise.all(runs.map((path, index) =>
    readRegularCanonical(path, `READY4 run ${index}`)));
  const aggregate = aggregateReady4Runs(records.map(record => record.value));
  if (campaign !== null) {
    const candidate = await readRegularCanonical(campaign, "READY4 campaign");
    if (canonicalJson(candidate.value) !== canonicalJson(aggregate)) {
      throw new TypeError("campaign envelope differs from independently aggregated evidence");
    }
  }
  return aggregate;
}

export function parseArguments(argv) {
  const result = { runs: [], campaign: null };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index]; const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) throw new TypeError(`${option} needs a path`);
    if (option === "--run") result.runs.push(resolve(process.cwd(), value));
    else if (option === "--campaign" && result.campaign === null) result.campaign = resolve(process.cwd(), value);
    else throw new TypeError(`unsupported validator argument ${JSON.stringify(option)}`);
  }
  if (result.runs.length !== 3 || new Set(result.runs).size !== 3) throw new TypeError(usage);
  return Object.freeze(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) console.log(usage);
  else await validateReady4Evidence(parseArguments(process.argv.slice(2))).then(() => undefined);
}
