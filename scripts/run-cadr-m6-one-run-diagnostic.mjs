#!/usr/bin/env node
/* Prepare one closed /tmp M6 diagnostic build, then execute only the runner
 * inside that build.  This wrapper never imports the mutable worktree's
 * worker, headless driver, or receipt publisher. */
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildM6DiagnosticIsolated,
  revalidateM6DiagnosticIsolated,
} from "./build-cadr-m6-diagnostic-isolated.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseInvocation(argv) {
  const options = { artifactRoot: ROOT, output: null, receiptBase: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("usage: node scripts/run-cadr-m6-one-run-diagnostic.mjs --receipt-base FULL-COMMIT --output PATH [--artifact-root ROOT]\n");
      process.exit(0);
    }
    if (!["--artifact-root", "--output", "--receipt-base"].includes(argument)) {
      throw new TypeError(`unsupported diagnostic argument ${JSON.stringify(argument)}`);
    }
    if (seen.has(argument)) throw new TypeError(`${argument} was supplied twice`);
    seen.add(argument);
    const value = argv[++index];
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${argument} requires a path`);
    }
    if (argument === "--artifact-root") options.artifactRoot = resolve(process.cwd(), value);
    else if (argument === "--receipt-base") options.receiptBase = value;
    else options.output = resolve(process.cwd(), value);
  }
  if (options.output === null || options.receiptBase === null) {
    throw new TypeError("--receipt-base and --output are required");
  }
  return Object.freeze(options);
}

function childExit(command, args) {
  return new Promise((resolveExit, rejectExit) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", rejectExit);
    child.once("exit", (code, signal) => {
      if (signal !== null) rejectExit(new Error(`staged M6 diagnostic terminated by ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

async function main() {
  const options = parseInvocation(process.argv.slice(2));
  const build = await buildM6DiagnosticIsolated({ receiptBase: options.receiptBase });
  let primary = null;
  try {
    await revalidateM6DiagnosticIsolated(build);
    const code = await childExit(process.execPath, [build.diagnostic_runner.path,
      "--build-record", JSON.stringify(build),
      "--artifact-root", options.artifactRoot,
      "--output", options.output]);
    /* The child has independently checked the same identities before receipt
     * publication.  This check detects a post-child mutation before cleanup. */
    await revalidateM6DiagnosticIsolated(build);
    if (code !== 0) throw new Error(`staged M6 diagnostic exited ${code}`);
  } catch (error) {
    primary = error;
    throw error;
  } finally {
    try {
      await rm(build.stage_directory, { recursive: true, force: true });
    } catch (cleanup) {
      if (primary !== null) throw new AggregateError([primary, cleanup],
        "M6 diagnostic failed and its staged build could not be removed");
      throw cleanup;
    }
  }
}

if (typeof process.argv[1] === "string" &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
