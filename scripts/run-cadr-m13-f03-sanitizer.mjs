#!/usr/bin/env node
/*
 * M13-F03 native sanitizer/allocation-failure campaign.
 *
 * This is intentionally a narrow ABI1.10 C-core campaign.  Browser v8, M10,
 * and other JavaScript-only parsers have no native allocation sites for ASan
 * or UBSan to observe; the evidence report names them as uncovered rather
 * than expanding this result into a C-M13 claim.
 */
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const SCHEMA = "cadr-m13-f03-sanitizer-report-v1";
const PROFILE = "CADR-WEB-303/ABI1.10/protocol-v8/M13-HARDENING-v2";
const PROBE_SCHEMA = "cadr-m13-f03-native-probe-v1";
const DEFAULT_OUTPUT = "build/cadr-m13-f03";
const SCENARIOS = Object.freeze([
  "machine-create", "host-completion", "snapshot-restore", "media-compare",
  "media-root", "trace-start", "audio-snapshot", "m12-config",
]);
const ALLOCATING_SCENARIOS = new Set([
  "machine-create", "host-completion", "snapshot-restore", "media-compare", "media-root", "trace-start",
]);
const SELECTED_ALLOCATION_SOURCES = Object.freeze([
  "cadr-web/core/cadr_core.c",
  "cadr-web/core/cadr_snapshot.c",
  "cadr-web/core/cadr_state_v2.c",
  "cadr-web/core/cadr_m4_media.c",
  "cadr-web/trace/cadr_trace_engine.c",
]);
const SOURCE_CLOSURE = Object.freeze([
  "tests/cadr_m13_f03_alloc_shim.h",
  "tests/test_cadr_m13_f03_sanitizer.c",
  ...SELECTED_ALLOCATION_SOURCES,
  "cadr-web/core/cadr_audio_model.c",
  "cadr-web/core/cadr_m12_debugger.c",
  "cadr-web/core/cadr_m12_machine_adapter.c",
  "cadr-web/core/cadr_state_v3.c",
  "cadr-web/core/cadr_state_v4.c",
  "cadr-web/core/cadr_state_v5.c",
  "cadr-web/core/cadr_display.c",
  "cadr-web/core/cadr_disk_evidence.c",
  "cadr-web/core/cadr_m4_controller_transcript.c",
  "cadr-web/core/usim-port/cadr_processor_memory.c",
  "cadr-web/core/usim-port/bus-adaptor.c",
  "cadr-web/core/usim-port/bus-interface.c",
  "cadr-web/core/usim-port/unibus-mapping.c",
  "cadr-web/core/usim-port/diagnostic-interface.c",
  "cadr-web/core/usim-port/tv.c",
  "cadr-web/core/usim-port/colortv.c",
  "cadr-web/core/usim-port/iob.c",
  "cadr-web/core/usim-port/disk-controller.c",
  "cadr-web/core/usim-port/tape-controller.c",
  "cadr-web/core/usim-port/uch11.c",
]);
const COMPILE_SOURCES = Object.freeze(SOURCE_CLOSURE.filter(path => path.endsWith(".c")));
/* These are the exact core feature defines for the ABI1.10 M13 native probe.
 * The same list controls both the sanitizer binary and the active-source
 * allocation expectation below.  Do not source-grep an inactive #if branch:
 * M11/M12 intentionally change several allocation paths. */
const PROFILE_DEFINES = Object.freeze([
  "-DCADR_M7_CORE", "-DCADR_M9_CORE", "-DCADR_M11_CORE", "-DCADR_M12_CORE",
]);
const INCLUDE_FLAGS = Object.freeze([
  "-Icadr-web/include", "-Icadr-web/core", "-Icadr-web/core/usim-port",
  "-Icadr-web/trace", "-Icadr-web/host",
]);

function fail(message) { throw new Error(`M13-F03: ${message}`); }
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function run(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, ...options.env }, timeout: options.timeout ?? 180000,
  });
  if (result.error) fail(`could not execute ${args.join(" ")}: ${result.error.message}`);
  if (result.status !== 0) fail(`${args.join(" ")} exited ${result.status}: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}
function parseProbe(text, scenario, faultAt) {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length !== 1) fail(`${scenario} produced non-single-line probe output`);
  let value;
  try { value = JSON.parse(lines[0]); } catch { fail(`${scenario} did not produce JSON`); }
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "allocation_count,allocation_points,fault_at,result,scenario,schema" ||
      value.schema !== PROBE_SCHEMA || value.scenario !== scenario || value.fault_at !== faultAt ||
      value.result !== "pass" || !Number.isSafeInteger(value.allocation_count) || value.allocation_count < 0 ||
      !Array.isArray(value.allocation_points) || value.allocation_points.length !== value.allocation_count) {
    fail(`${scenario} probe record does not satisfy its closed schema`);
  }
  for (const point of value.allocation_points) {
    if (Object.keys(point).sort().join(",") !== "file,kind,line" ||
        !["malloc", "calloc", "realloc"].includes(point.kind) || typeof point.file !== "string" ||
        !Number.isSafeInteger(point.line) || point.line <= 0) fail(`${scenario} recorded an invalid allocation point`);
  }
  return value;
}
function activePreprocessedLines(source, text) {
  const lines = [];
  let currentPath = null;
  let currentLine = 0;
  for (const textLine of text.split("\n")) {
    const directive = /^#\s+(\d+)\s+"([^"]+)"(?:\s+.*)?$/.exec(textLine);
    if (directive !== null) {
      const named = directive[2].startsWith("/") ? relative(ROOT, directive[2]) : directive[2];
      currentPath = named.replaceAll("\\", "/").replace(/^\.\//, "");
      currentLine = Number(directive[1]);
      continue;
    }
    if (currentPath === source) lines.push({ line: currentLine, text: textLine });
    if (currentPath !== null) currentLine += 1;
  }
  return lines;
}

function profiledStaticAllocationPoints() {
  const points = new Set();
  for (const source of SELECTED_ALLOCATION_SOURCES) {
    /* The preprocessor resolves profile gates before this source-only scan.
     * It runs without the allocator shim: otherwise malloc/calloc/realloc
     * would already be rewritten and could not be checked against the
     * compiler-observed shim locations. */
    const lines = activePreprocessedLines(source, run([
      "guix", "shell", "clang-toolchain", "--", "clang", "-E",
      ...PROFILE_DEFINES, ...INCLUDE_FLAGS, source,
    ]));
    lines.forEach((record, index) => {
      const line = record.text;
      for (const kind of ["malloc", "calloc", "realloc"]) {
        const match = new RegExp(`\\b${kind}\\s*\\(`).exec(line);
        if (match === null) continue;
        /* __LINE__ inside the allocation shim is expanded at the closing
         * parenthesis of a multiline macro invocation.  Mirror that actual
         * compiler location rather than treating source-line grep as proof. */
        let depth = 0;
        let closingLine = record.line;
        let found = false;
        for (let lineIndex = index; lineIndex < lines.length && !found; lineIndex += 1) {
          if (lineIndex !== index && lines[lineIndex].line !== lines[lineIndex - 1].line + 1) {
            fail(`profiled ${kind} call crossed a preprocessor source boundary in ${source}:${record.line}`);
          }
          const candidate = lines[lineIndex];
          const start = lineIndex === index ? match.index + match[0].length - 1 : 0;
          for (let charIndex = start; charIndex < candidate.text.length; charIndex += 1) {
            const character = candidate.text[charIndex];
            if (character === "(") depth += 1;
            else if (character === ")") {
              depth -= 1;
              if (depth === 0) {
                closingLine = candidate.line;
                found = true;
                break;
              }
            }
          }
        }
        if (!found) fail(`could not determine profiled ${kind} call boundary in ${source}:${record.line}`);
        points.add(`${source}:${closingLine}:${kind}`);
      }
    });
  }
  return [...points].sort();
}
function pointKey(point) {
  const path = point.file.replace(/^\.\//, "");
  return `${path}:${point.line}:${point.kind}`;
}
function exactChildDirectory(path) {
  if (existsSync(path)) fail(`output already exists: ${relative(ROOT, path)}`);
  const parent = resolve(path, "..");
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true, mode: 0o700 });
  mkdirSync(path, { mode: 0o700 });
  if (!statSync(path).isDirectory()) fail("output is not a directory");
  chmodSync(path, 0o700);
}
function options(argv) {
  const parsed = { output: resolve(ROOT, DEFAULT_OUTPUT), execute: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--execute") parsed.execute = true;
    else if (token === "--output") {
      index += 1;
      if (index >= argv.length) fail("--output needs a path");
      parsed.output = resolve(ROOT, argv[index]);
    } else if (token === "--help") {
      process.stdout.write("usage: guix shell clang-toolchain -- node scripts/run-cadr-m13-f03-sanitizer.mjs --execute [--output build/cadr-m13-f03]\n");
      process.exit(0);
    } else fail(`unknown option ${token}`);
  }
  if (!parsed.execute) fail("--execute is required: this campaign builds and runs native sanitizer binaries");
  if (!parsed.output.startsWith(`${resolve(ROOT, "build")}/`)) fail("output must be a new direct child under build/");
  if (resolve(parsed.output, "..") !== resolve(ROOT, "build")) fail("output must be a direct child under build/");
  return parsed;
}

function main() {
  const { output } = options(process.argv);
  exactChildDirectory(output);
  const binary = resolve(output, "cadr-m13-f03-asan-ubsan");
  const flags = [
    "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic", "-Wconversion", "-Wshadow",
    "-Wstrict-prototypes", "-Wmissing-prototypes", "-Wformat=2", "-g", "-O1",
    "-fsanitize=address,undefined", "-fno-omit-frame-pointer",
    ...PROFILE_DEFINES, ...INCLUDE_FLAGS,
    "-include", "tests/cadr_m13_f03_alloc_shim.h", "-o", relative(ROOT, binary), ...COMPILE_SOURCES,
  ];
  const compilerVersion = run(["guix", "shell", "clang-toolchain", "--", "clang", "--version"]).split("\n")[0];
  run(["guix", "shell", "clang-toolchain", "--", "clang", ...flags]);
  const scenarios = [];
  const observed = new Set();
  for (const scenario of SCENARIOS) {
    const normal = parseProbe(run([binary, scenario], { env: { ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" } }), scenario, 0);
    normal.allocation_points.forEach(point => observed.add(pointKey(point)));
    const injections = [];
    if (ALLOCATING_SCENARIOS.has(scenario)) {
      if (normal.allocation_count === 0) fail(`${scenario} did not observe a selected allocation point`);
      for (let faultAt = 1; faultAt <= normal.allocation_count; faultAt += 1) {
        const injected = parseProbe(run([binary, scenario, String(faultAt)], { env: { ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" } }), scenario, faultAt);
        if (injected.allocation_count < faultAt ||
            canonical(injected.allocation_points.slice(0, faultAt)) !==
              canonical(normal.allocation_points.slice(0, faultAt)) ||
            canonical(injected.allocation_points) !==
              canonical(normal.allocation_points.slice(0, injected.allocation_count))) {
          fail(`${scenario} did not execute the expected allocation prefix at fault ${faultAt}`);
        }
        injections.push({ fault_at: faultAt, result: "no-memory-atomic" });
      }
    } else if (normal.allocation_count !== 0) {
      fail(`${scenario} has an unexpected selected dynamic allocation`);
    }
    scenarios.push({ scenario, allocation_count: normal.allocation_count, allocation_points: normal.allocation_points, injections });
  }
  const expected = profiledStaticAllocationPoints();
  const observedSorted = [...observed].sort();
  const missing = expected.filter(point => !observed.has(point));
  const unexpected = observedSorted.filter(point => !expected.includes(point));
  if (missing.length !== 0 || unexpected.length !== 0) {
    fail(`selected allocation coverage drifted; missing=${missing.join("|") || "none"}; unexpected=${unexpected.join("|") || "none"}`);
  }
  const sources = SOURCE_CLOSURE.map(path => ({ path, sha256: sha256(resolve(ROOT, path)) }));
  const report = {
    schema: SCHEMA,
    profile: PROFILE,
    disposition: "passed-native-f03-only",
    claim: {
      c_m13: "open",
      established: "ASan+UBSan and deterministic allocation-failure evidence for the selected native ABI1.10 parser/state-machine slice",
      not_established: ["browser v8 message safety", "M10 IndexedDB/storage behavior", "browser OOM", "full M13 fuzzing", "C-M13"],
    },
    source: {
      dirty_worktree: execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() !== "",
      closure: sources,
      selected_native_parsers_and_state_machines: [
        "CDRSNAP1 parse/restore and copied completion state",
        "CDRM4MEDIA1 parser/compare and overlay-root construction",
        "CDRGTRC1 trace-engine start",
        "CDRAUDS1 snapshot adoption",
        "CDRM12C1 debugger configuration restoration",
      ],
      native_allocation_points: expected,
      native_allocation_expectation: {
        mode: "clang-E-active-profile-source-locations-v1",
        profile_defines: PROFILE_DEFINES,
        selected_sources: SELECTED_ALLOCATION_SOURCES,
      },
      uncovered_or_not_native: [
        "v8 shell descriptor/M13META1 parser is JavaScript",
        "M10 IndexedDB overlay/export/wrapper parser and transaction state machine are JavaScript",
        "browser base-import/range, structured clone, CSP, worker lifecycle, and accessibility paths",
        "Wasm adapter arena allocations and fixed-linear-memory exhaustion: separate M13-F05 campaign",
      ],
    },
    toolchain: {
      compiler: compilerVersion,
      sanitizer: ["address", "undefined"],
      compile_command: ["guix", "shell", "clang-toolchain", "--", "clang", ...flags.map(value => value === relative(ROOT, binary) ? "<output>/cadr-m13-f03-asan-ubsan" : value)],
      environment: { ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1" },
    },
    campaign: { scenarios, observed_native_allocation_points: observedSorted },
  };
  const reportPath = resolve(output, "report.json");
  writeFileSync(reportPath, `${canonical(report)}\n`, { mode: 0o600 });
  chmodSync(binary, 0o700);
  chmodSync(reportPath, 0o600);
  process.stdout.write(`${relative(ROOT, reportPath)}\n`);
}

try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
