#!/usr/bin/env node
/*
 * Child half of the authoritative selected-image negative gate.  It has no
 * CADR execution import: after supervisor attestation it can only read the
 * staged release record and the fixed kind-3 image descriptor.
 */
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveSelectedImageNegativeViews, M6_SELECTED_IMAGE_NEGATIVE_CONTRACT,
  M6_SELECTED_IMAGE_NEGATIVE_RUN_SCHEMA, M6_SELECTED_IMAGE_NEGATIVE_TARGET,
  readCanonicalSelectedImageRelease, selectedImageNegativeFailure,
  selectedImageNegativeEffectiveEnvironment,
  writeCanonicalNoReplace } from "./cadr-m6-selected-image-negative-evidence.mjs";

const RELEASE_RELATIVE = "cadr-web/oracle/cadr-m6-release-record.json";

function usage() {
  return "usage: node scripts/run-cadr-m6-selected-image-negative.mjs --execute --systemd-child --artifact-root ROOT --release-record RECORD.json --source-commit COMMIT --source-closure-sha256 SHA256 --invocation-nonce-file NONCE --output PRIVATE.json";
}

function absolutePath(value, option) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${option} needs a pathname`);
  }
  return resolve(process.cwd(), value);
}

export function parseSelectedImageNegativeArguments(argv) {
  const result = { execute: false, systemdChild: false, artifactRoot: null,
    releaseRecord: null, sourceCommit: null, sourceClosureSha256: null,
    invocationNonceFile: null, output: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute" || option === "--systemd-child") {
      if (seen.has(option)) throw new TypeError(`duplicate ${option}`);
      seen.add(option); result[option === "--execute" ? "execute" : "systemdChild"] = true;
      continue;
    }
    if (!["--artifact-root", "--release-record", "--source-commit",
      "--source-closure-sha256", "--invocation-nonce-file", "--output"].includes(option) ||
        seen.has(option)) {
      throw new TypeError(`unsupported or duplicate selected-image negative argument ${JSON.stringify(option)}`);
    }
    seen.add(option); const value = argv[++index];
    if (option === "--source-commit") result.sourceCommit = value;
    else if (option === "--source-closure-sha256") result.sourceClosureSha256 = value;
    else {
      const key = option.slice(2).replace(/-([a-z])/g,
        (_, character) => character.toUpperCase());
      result[key] = absolutePath(value, option);
    }
  }
  if (!result.execute || !result.systemdChild || result.artifactRoot === null ||
      result.releaseRecord === null || result.invocationNonceFile === null ||
      result.output === null || !/^[0-9a-f]{40}$/.test(result.sourceCommit ?? "") ||
      !/^[0-9a-f]{64}$/.test(result.sourceClosureSha256 ?? "")) {
    throw new TypeError(`${usage()}\nThe selected-image negative child is inert without every supervisor-owned identity.`);
  }
  return Object.freeze(result);
}

async function readRegularNoFollow(path, label) {
  const metadata = await lstat(path, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new TypeError(`${label} is not a regular non-symlink file`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== metadata.dev || opened.ino !== metadata.ino ||
        opened.size !== metadata.size || opened.ctimeNs !== metadata.ctimeNs ||
        opened.mtimeNs !== metadata.mtimeNs) {
      throw new TypeError(`${label} changed while opening`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.byteLength) !== metadata.size || after.dev !== metadata.dev ||
        after.ino !== metadata.ino || after.size !== metadata.size ||
        after.ctimeNs !== metadata.ctimeNs || after.mtimeNs !== metadata.mtimeNs) {
      throw new TypeError(`${label} changed while reading`);
    }
    return bytes;
  } finally { await handle.close(); }
}

export async function verifySelectedImageNegativeSupervision(environment = process.env,
  cgroup = null) {
  const unit = environment.M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT;
  if (environment.M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD !== "1" ||
      !/^cadr-m6-selected-image-negative-[0-9a-f]{32}\.service$/.test(unit ?? "")) {
    throw new TypeError("selected-image negative child refuses unsupervised execution");
  }
  const observed = cgroup ?? await readFile("/proc/self/cgroup", "utf8");
  if (typeof observed !== "string" || !observed.includes(unit)) {
    throw new TypeError("selected-image negative child is outside its transient unit");
  }
  const expectedEnvironment = selectedImageNegativeEffectiveEnvironment(unit);
  const actualKeys = Object.keys(environment).sort();
  const expectedKeys = Object.keys(expectedEnvironment).sort();
  if (actualKeys.length !== expectedKeys.length ||
      actualKeys.some((name, index) => name !== expectedKeys[index])) {
    throw new TypeError("selected-image negative child inherited an unexpected environment key");
  }
  for (const [name, expected] of Object.entries(expectedEnvironment)) {
    if (environment[name] !== expected) {
      throw new TypeError(`selected-image negative child environment differs at ${name}`);
    }
  }
  return Object.freeze({ unit, effective_environment: expectedEnvironment });
}

async function verifyInvocationNonce(path) {
  const metadata = await lstat(path, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== 32n ||
      (metadata.mode & 0o077n) !== 0n) {
    throw new TypeError("selected-image negative nonce is not a private 32-byte file");
  }
  const bytes = await readRegularNoFollow(path, "selected-image negative nonce");
  if (bytes.byteLength !== 32) throw new TypeError("selected-image negative nonce changed while reading");
}

function resultRecord(options, release, views, supervision) {
  return Object.freeze({
    schema: M6_SELECTED_IMAGE_NEGATIVE_RUN_SCHEMA,
    outcome: "selected-image-negative",
    contract: M6_SELECTED_IMAGE_NEGATIVE_CONTRACT,
    target: M6_SELECTED_IMAGE_NEGATIVE_TARGET,
    source_commit: options.sourceCommit,
    source_closure_sha256: options.sourceClosureSha256,
    effective_environment: supervision.effective_environment,
    release_record: release.identity,
    selected_disk: release.selected_disk,
    base_before: views.base_before,
    base_after: views.base_after,
    negative_views: views.negative_views,
    materialized_image_bytes: "0",
    worker_constructed: false,
    wasm_build_attempted: false,
    guest_execution_attempted: false,
  });
}

/* The injectable checks are test seams around authority verification only; the
 * data operation itself has no external execution callback. */
export async function executeSelectedImageNegative(options, {
  supervise = verifySelectedImageNegativeSupervision,
  verifyNonce = verifyInvocationNonce,
  readRelease = readRegularNoFollow,
  derive = deriveSelectedImageNegativeViews,
} = {}) {
  const supervision = await supervise();
  if (supervision === null || typeof supervision !== "object" ||
      supervision.effective_environment === undefined) {
    throw new TypeError("selected-image negative supervision did not bind the effective environment");
  }
  await verifyNonce(options.invocationNonceFile);
  const release = readCanonicalSelectedImageRelease(await readRelease(
    options.releaseRecord, "selected-image staged release record"));
  const views = await derive({ artifactRoot: options.artifactRoot,
    selectedDisk: release.selected_disk });
  return resultRecord(options, release, views, supervision);
}

async function main() {
  const options = parseSelectedImageNegativeArguments(process.argv.slice(2));
  try {
    await writeCanonicalNoReplace(options.output,
      await executeSelectedImageNegative(options));
  } catch (error) {
    await writeCanonicalNoReplace(`${options.output}.failure.json`,
      selectedImageNegativeFailure("selected-image-negative-failed",
        createHash("sha256").update(String(error?.message ?? error)).digest("hex")))
      .catch(() => undefined);
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
  } else main().catch(error => {
    process.stderr.write(`selected-image negative gate failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export const SELECTED_IMAGE_RELEASE_RELATIVE = RELEASE_RELATIVE;
