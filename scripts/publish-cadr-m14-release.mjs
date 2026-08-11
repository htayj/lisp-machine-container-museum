#!/usr/bin/env node
/*
 * Deliberately authority-less M14 comparison-report publication entrypoint.
 * It computes a canonical two-reproduction static comparison under caller
 * supplied independent pins, then stops at the empty production authority
 * registry.  It cannot publish an archive, release package, or evidence.
 */
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCadrM14StaticReproductions } from "./cadr-m14-static-reproduction-comparison.mjs";
import { createCadrM14PublicationCapability, publishCadrM14ComparisonReport,
  serializeCadrM14PublicationReceipt } from "./cadr-m14-publication.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_ROOT = resolve(ROOT, "build/cadr-m14");
const SAFE_BASENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
function fail(message) { throw new TypeError(`C-M14 publish CLI: ${message}`); }
function packagePath(value, label) {
  if (typeof value !== "string" || isAbsolute(value) || value.includes("\\") || value.includes("//")) fail(`${label} must be build/cadr-m14/<direct-child>`);
  const parts = value.split("/");
  if (parts.length !== 3 || parts[0] !== "build" || parts[1] !== "cadr-m14" || parts.some(part => part.length === 0 || part === "." || part === "..")) {
    fail(`${label} must be build/cadr-m14/<direct-child>`);
  }
  const path = resolve(ROOT, ...parts); if (dirname(path) !== BUILD_ROOT || basename(path) !== parts[2]) fail(`${label} must be a direct child`);
  return path;
}
function name(value) {
  if (typeof value !== "string" || !SAFE_BASENAME.test(value) || value === "." || value === ".." || value !== basename(value)) {
    fail("--name must be one safe basename of at most 128 ASCII characters");
  }
  return value;
}
function sha(value, label) { if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be SHA-256`); return value; }
function argumentsFor(argv) {
  if (argv.length !== 12 || argv[0] !== "--left-package" || argv[2] !== "--right-package" || argv[4] !== "--name" ||
      argv[6] !== "--evidence-policy-sha256" || argv[8] !== "--comparator-sha256" || argv[10] !== "--evidence-engine-sha256") {
    fail("usage: publish-cadr-m14-release.mjs --left-package build/cadr-m14/<child> --right-package build/cadr-m14/<child> --name <safe-basename> --evidence-policy-sha256 <sha256> --comparator-sha256 <sha256> --evidence-engine-sha256 <sha256>");
  }
  return { left: packagePath(argv[1], "--left-package"), right: packagePath(argv[3], "--right-package"), name: name(argv[5]),
    expectedEvidencePolicySha256: sha(argv[7], "--evidence-policy-sha256"), expectedComparatorSha256: sha(argv[9], "--comparator-sha256"), expectedEvidenceEngineSha256: sha(argv[11], "--evidence-engine-sha256") };
}
async function main() {
  const args = argumentsFor(process.argv.slice(2));
  const comparison = await compareCadrM14StaticReproductions({ expectedComparatorSha256: args.expectedComparatorSha256,
    expectedEvidenceEngineSha256: args.expectedEvidenceEngineSha256,
    expectedEvidencePolicySha256: args.expectedEvidencePolicySha256,
    reproductions: [{ packagePath: args.left }, { packagePath: args.right }] });
  /* No token is accepted by argv, environment, or a file.  The checked policy
   * registry is empty, so this rejects before a capability/final-report link. */
  const capability = await createCadrM14PublicationCapability({ comparison });
  const receipt = await publishCadrM14ComparisonReport(capability, { name: args.name });
  process.stdout.write(serializeCadrM14PublicationReceipt(receipt));
  if (receipt.disposition !== "published-durable") process.exitCode = 1;
}
main().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
