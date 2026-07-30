#!/usr/bin/env node
/*
 * Native XTEST -> X11 -> Cadet -> pre-IOB witness campaign.
 *
 * This is distinct from the direct-boundary oracle.  It uses the established
 * computer-use harness and its full run.json/screenshot/shutdown provenance.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CADR_M8_PHYSICAL_KEYS } from "../cadr-web/wasm/cadr-m8-keyboard.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS = resolve(ROOT, "scripts/cadr-computer-use.sh");
const IS_MAIN = resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
let prepared = resolve(ROOT, "build/cadr-oracle/m8-m9-x11-prepared-v4");
let browserManifest = null;
for (let index = 0; IS_MAIN && index < process.argv.length; index += 1) {
  if (process.argv[index] === "--prepared") {
    if (typeof process.argv[index + 1] !== "string") fail("--prepared requires a path");
    prepared = resolve(ROOT, process.argv[index + 1]);
  }
  if (process.argv[index] === "--browser-manifest") {
    if (typeof process.argv[index + 1] !== "string") fail("--browser-manifest requires a path");
    browserManifest = resolve(ROOT, process.argv[index + 1]);
  }
}

function fail(message) { throw new TypeError(`C-M8/M9 X11: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function run(args, env) {
  const result = spawnSync(HARNESS, args, { cwd: ROOT, env, encoding: "utf8",
    timeout: 300_000, killSignal: "SIGKILL" });
  if (result.error !== undefined) fail(`${args.join(" ")} spawn failed: ${result.error.message}`);
  if (result.signal !== null) fail(`${args.join(" ")} terminated by ${result.signal}`);
  if (result.status !== 0) fail(`${args.join(" ")} failed: ${(result.stderr ?? "").slice(-2000)}`);
  return JSON.parse(result.stdout);
}
async function countWitness(path) {
  try {
    const size = (await stat(path)).size;
    if (size % 64 !== 0) fail("CDRM8N1 witness has a partial record");
    return size / 64;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}
export async function settledWitnessCount(path, { timeoutMs = 2_000, stablePolls = 4 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let prior = await countWitness(path);
  let stable = 0;
  while (Date.now() < deadline) {
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50));
    const current = await countWitness(path);
    if (current === prior) {
      stable += 1;
      if (stable >= stablePolls) return current;
    } else {
      prior = current;
      stable = 0;
    }
  }
  fail(`CDRM8N1 witness did not quiesce within ${timeoutMs} ms`);
}
export async function witnessRecords(path, first, last) {
  if (last === first) return [];
  const bytes = new Uint8Array(await readFile(path));
  const records = [];
  for (let ordinal = first; ordinal < last; ordinal += 1) {
    const at = ordinal * 64;
    const view = new DataView(bytes.buffer, bytes.byteOffset + at, 64);
    const magic = Buffer.from(bytes.subarray(at, at + 8));
    if (!magic.equals(Buffer.from([0x43, 0x44, 0x52, 0x4d, 0x38, 0x4e, 0x31, 0x00])) ||
        view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 64 ||
        view.getUint32(20, true) !== 0 || view.getUint32(52, true) !== ordinal ||
        view.getUint32(56, true) !== 0 || view.getUint32(60, true) !== 0) {
      fail(`CDRM8N1 record ${ordinal} has invalid framing, reserved bytes, or ordinal`);
    }
    records.push({ ordinal, kind: view.getUint32(16, true),
      boundary: view.getBigUint64(24, true).toString(),
      csr_before: view.getUint32(32, true), first: view.getUint32(36, true),
      second: view.getUint32(40, true), x: view.getUint32(44, true),
      y: view.getUint32(48, true) });
  }
  return records;
}
export async function preparedClosureIdentity(preparedRoot) {
  const source = resolve(preparedRoot, "source");
  const entries = [];
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = resolve(directory, name);
      const info = await lstat(path);
      if (info.isSymbolicLink()) fail("prepared source closure contains a symlink");
      if (info.isDirectory()) {
        await visit(path);
      } else if (info.isFile() && ([".c", ".h", ".defs"].includes(extname(name)) ||
          ["Makefile.usim", "COPYING.md", "Makefile"].includes(name) ||
          basename(name).startsWith("Makefile."))) {
        const bytes = await readFile(path);
        entries.push({ bytes: bytes.byteLength,
          path: relative(source, path).split("\\").join("/"), sha256: sha256(bytes) });
      }
    }
  }
  await visit(source);
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return { sha256: sha256(`${JSON.stringify(entries)}\n`), count: entries.length };
}
async function validatePreparedBinding(preparedRoot, build) {
  const identity = await preparedClosureIdentity(preparedRoot);
  if (identity.sha256 !== build.prepared_source_tree_sha256 ||
      identity.count !== build.prepared_source_file_count) {
    fail("prepared source closure differs from the executable build marker");
  }
  const patch = await fileIdentity(resolve(ROOT,
    "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch"));
  if (patch.sha256 !== build.m8_m9_patch_sha256) {
    fail("tracked M8/M9 native patch differs from the executable build marker");
  }
  return { preparedSource: identity, patch };
}
export function classifyNativeCandidates(sourceCandidates, liveKeysyms) {
  const liveSourceCandidates = sourceCandidates.filter(keysym => liveKeysyms.has(keysym));
  const directCandidates = sourceCandidates.filter(keysym =>
    liveKeysyms.get(keysym)?.some(mapping => mapping.column === 0));
  if (directCandidates.length !== 0) {
    return { disposition: "direct", liveSourceCandidates, directCandidates };
  }
  return { disposition: liveSourceCandidates.length !== 0 ?
    "native-modifier-chord-not-exercised" : "not-applicable-native-source-unmapped",
  liveSourceCandidates, directCandidates };
}
export async function writeX11FailureManifest(path, value) {
  await writeFile(path, `${JSON.stringify({ schema: "cadr-m8-m9-x11-failure-v1",
    outcome: "nonconforming", ...value }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}
export async function sourceReachability(preparedRoot) {
  const kbdPath = resolve(preparedRoot, "source/usim/kbd.c");
  const defsPath = resolve(preparedRoot, "source/usim/cadet.defs");
  const lmchPath = resolve(preparedRoot, "source/usim/lmch.defs");
  const x11Path = resolve(preparedRoot, "source/usim/x11.c");
  const mousePath = resolve(preparedRoot, "source/usim/mouse.c");
  const [kbdBytes, defsBytes, lmchBytes, x11Bytes, mouseBytes] = await Promise.all([
    readFile(kbdPath), readFile(defsPath), readFile(lmchPath),
    readFile(x11Path), readFile(mousePath)]);
  if (!/mouse_event\(e\.xbutton\.x,\s*e\.xbutton\.y,\s*e\.xbutton\.button\);/
      .test(x11Bytes.toString("utf8")) ||
      !/if \(buttons == 1\)\s*\n\s*mouse_tail \^= 1;/.test(mouseBytes.toString("utf8")) ||
      !/if \(buttons == 2\)\s*\n\s*mouse_middle \^= 1;/.test(mouseBytes.toString("utf8")) ||
      !/if \(buttons == 3\)\s*\n\s*mouse_head \^= 1;/.test(mouseBytes.toString("utf8"))) {
    fail("selected X11/mouse source does not implement the pinned changed-button selector");
  }
  const lmchValues = new Map();
  for (const match of lmchBytes.toString("utf8").matchAll(
    /^X\(([A-Za-z0-9_]+),\s*(0[0-7]+)\)/gm)) {
    lmchValues.set(match[1], Number.parseInt(match[2], 8));
  }
  const lmchValueToX = new Map();
  for (const match of kbdBytes.toString("utf8").matchAll(
    /kbd_map\[XK_([A-Za-z0-9_]+)\]\s*=\s*LMCH_([A-Za-z0-9_]+)\s*;/g)) {
    const value = lmchValues.get(match[2]);
    if (value === undefined) continue;
    const values = lmchValueToX.get(value) ?? [];
    values.push(match[1]);
    lmchValueToX.set(value, values);
  }
  const scanToX = new Map();
  for (const match of defsBytes.toString("utf8").matchAll(
    /^X\(([A-Za-z0-9_]+),\s*(0[0-7]+),\s*CADET_IX_([A-Z]+)\)$/gm)) {
    if (match[3] !== "UNSHIFT") continue;
    const lmchValue = lmchValues.get(match[1]);
    for (const keysym of lmchValueToX.get(lmchValue) ?? []) {
      const scan = Number.parseInt(match[2], 8);
      const values = scanToX.get(scan) ?? []; values.push(keysym); scanToX.set(scan, values);
    }
  }
  /* X11 modifier indices collapse physical sides to the selected left Cadet
   * codes. Only default Shift/Lock/Control/Mod1/Mod4 bindings are reachable. */
  /* This profile explicitly selects the standard System 303 Mod4=Super
   * override in its rendered config. X11 modifier indices select the left
   * Cadet codes because the native modifier map collapses physical sides. */
  for (const [scan, key] of [[0o024, "Shift_L"], [0o125, "Caps_Lock"],
    [0o020, "Control_L"], [0o045, "Alt_L"], [0o005, "Super_L"]]) scanToX.set(scan, [key]);
  return { scanToX, evidence: { parser: "kbd-map-to-unshifted-cadet-defs-v1",
    kbd: { path: "source/usim/kbd.c", bytes: kbdBytes.byteLength, sha256: sha256(kbdBytes) },
    cadetDefs: { path: "source/usim/cadet.defs", bytes: defsBytes.byteLength,
      sha256: sha256(defsBytes) },
    lmchDefs: { path: "source/usim/lmch.defs", bytes: lmchBytes.byteLength,
      sha256: sha256(lmchBytes) },
    nativePointerSelector: {
      contract: "x11 e.xbutton.button -> mouse_event selector; 0 motion, 1 tail, 2 middle, 3 head; press and release use the same selector",
      x11: { path: "source/usim/x11.c", bytes: x11Bytes.byteLength,
        sha256: sha256(x11Bytes) },
      mouse: { path: "source/usim/mouse.c", bytes: mouseBytes.byteLength,
        sha256: sha256(mouseBytes) } } } };
}
export async function browserAll100Evidence(path) {
  if (path === null) fail("--execute requires --browser-manifest from the separate all-100 worker/core campaign");
  const manifestIdentity = await fileIdentity(path);
  const manifest = JSON.parse((await readFile(path)).toString("utf8"));
  const root = dirname(path);
  const comparisonPath = resolve(root, manifest?.comparison?.path ?? "");
  const campaignPath = resolve(root, manifest?.campaign?.manifest?.path ?? "");
  const comparisonIdentity = await fileIdentity(comparisonPath);
  const campaignIdentity = await fileIdentity(campaignPath);
  const comparison = JSON.parse((await readFile(comparisonPath)).toString("utf8"));
  const campaign = JSON.parse((await readFile(campaignPath)).toString("utf8"));
  const expectedPath = resolve(root, manifest?.portable?.expected_cdrinp_file?.path ?? "");
  const observedPath = resolve(root, manifest?.portable?.observed_cdrinp_file?.path ?? "");
  const deactivationPath = resolve(root,
    manifest?.portable?.shared_deactivation_file?.path ?? "");
  const observedStatesPath = resolve(root,
    manifest?.portable?.observed_state_file?.path ?? "");
  const [expected, observed, observedStatesIdentity] = await Promise.all([
    fileIdentity(expectedPath), fileIdentity(observedPath), fileIdentity(observedStatesPath)]);
  const deactivationIdentity = await fileIdentity(deactivationPath);
  const deactivation = JSON.parse((await readFile(deactivationPath)).toString("utf8"));
  const observedStates = JSON.parse((await readFile(observedStatesPath)).toString("utf8"));
  const expectedReceipt = manifest?.portable?.expected_cdrinp_file;
  const observedReceipt = manifest?.portable?.observed_cdrinp_file;
  const observedStatesReceipt = manifest?.portable?.observed_state_file;
  const deactivationReceipt = manifest?.portable?.shared_deactivation_file;
  const comparisonReceipt = manifest?.comparison;
  const campaignReceipt = manifest?.campaign?.manifest;
  if (manifest?.outcome !== "worker-core-payloads-identical-to-expected" ||
      manifest?.native?.metadata?.campaign?.key_count !== 100 ||
      manifest?.native?.metadata?.campaign?.native_row_count !== 207 ||
      manifest?.native?.metadata?.campaign?.browser_record_count !== 208 ||
      campaign?.schema !== "cadr-m8-m9-input-campaign-v1" ||
      campaign?.key_count !== 100 || campaign?.native_row_count !== 207 ||
      campaign?.browser_record_count !== 208 ||
      campaignIdentity.bytes !== campaignReceipt?.bytes ||
      campaignIdentity.sha256 !== campaignReceipt?.sha256 ||
      manifest?.portable?.consumption_boundaries?.length !== 100 ||
      manifest.portable.consumption_boundaries.some(item =>
        item.outcome !== "keyboard-iob-quiescent" ||
        item.final?.csr === undefined || (item.final.csr & (1 << 5)) !== 0 ||
        item.final?.keyboard_fifo_count !== 0) ||
      deactivation?.outcome !== "held-key-and-pointer-cleared-after-core-delivery" ||
      comparisonIdentity.bytes !== comparisonReceipt?.bytes ||
      comparisonIdentity.sha256 !== comparisonReceipt?.sha256 ||
      expected.bytes !== expectedReceipt?.bytes ||
      expected.sha256 !== expectedReceipt?.sha256 ||
      observed.bytes !== observedReceipt?.bytes ||
      observed.sha256 !== observedReceipt?.sha256 ||
      observedStatesIdentity.bytes !== observedStatesReceipt?.bytes ||
      observedStatesIdentity.sha256 !== observedStatesReceipt?.sha256 ||
      deactivationIdentity.bytes !== deactivationReceipt?.bytes ||
      deactivationIdentity.sha256 !== deactivationReceipt?.sha256 ||
      expected.bytes !== 208 * 40 || observed.bytes !== expected.bytes ||
      comparison?.browser?.record_count !== 208 ||
      comparison?.browser?.record_bytes !== 40 ||
      comparison?.native?.record_count !== 207 ||
      comparison?.common_campaign?.key_count !== 100 ||
      comparison?.common_campaign?.native_row_count !== 207 ||
      comparison?.common_campaign?.browser_record_count !== 208 ||
      observedStates?.schema !== "cadr-m8-m9-observed-input-states-v1" ||
      observedStates?.states?.length !== 208 ||
      observedStates.states.some(state => state.lifecycle !== 2 ||
        state.generation !== comparison.browser.generation) ||
      observedStates?.consumption_boundaries?.length !== 100 ||
      comparison?.outcome !== "worker-core-payloads-identical-to-expected" ||
      comparison?.browser?.exact_worker_boundary_match !== true ||
      expected.sha256 !== observed.sha256 ||
      expected.sha256 !== comparison.browser.expected_sha256 ||
      observed.sha256 !== comparison.browser.observed_sha256) {
    fail("separate browser all-100 evidence is incomplete or nonconforming");
  }
  return { manifest: manifestIdentity, campaign: campaignIdentity,
    comparison: comparisonIdentity,
    expected, observed, deactivation: deactivationIdentity,
    observedStates: observedStatesIdentity,
    consumptionBoundaryCount: 100, keyCount: 100 };
}
async function fileIdentity(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${path} is not a regular file`);
  const bytes = await readFile(path);
  return { path, bytes: bytes.byteLength, sha256: sha256(bytes) };
}
async function sourceProvenance(paths) {
  const identities = await Promise.all(paths.map(fileIdentity));
  const relativePaths = paths.map(path => relative(ROOT, path));
  const revisionRun = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  const statusRun = spawnSync("git", ["status", "--porcelain=v1", "--", ...relativePaths], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (revisionRun.error || revisionRun.status !== 0 ||
      statusRun.error || statusRun.status !== 0) fail("cannot bind X11 runner source control");
  return { revision: revisionRun.stdout.trim(), closure_dirty: statusRun.stdout.length !== 0,
    dirty_policy: "exact file hashes and scoped status are retained; no clean-checkout claim",
    status_sha256: sha256(statusRun.stdout), status: statusRun.stdout,
    files: identities.map((identity, index) => ({
      ...identity, path: relativePaths[index] })) };
}
async function findExecutable(name) {
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (directory.length === 0) continue;
    const candidate = resolve(directory, name);
    try {
      const info = await lstat(candidate);
      if (info.isFile() && !info.isSymbolicLink()) return candidate;
      if (info.isSymbolicLink()) {
        const resolved = resolve(await realpath(candidate));
        if ((await lstat(resolved)).isFile()) return resolved;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  fail(`${name} is not available for controlled result-text verification`);
}
function controlledCommand(executable, args, env) {
  const result = spawnSync(executable, args, { encoding: "utf8", env,
    timeout: 30_000, killSignal: "SIGKILL" });
  if (result.error || result.signal || result.status !== 0) {
    fail(`${executable} ${args.join(" ")} failed while recording the live X map`);
  }
  return result.stdout;
}
async function liveXMap(stateRoot, session) {
  const sessionState = JSON.parse(await readFile(
    resolve(stateRoot, session, "run.json"), "utf8"));
  const xmodmap = await findExecutable("xmodmap");
  const xinput = await findExecutable("xinput");
  const [tool, xinputTool] = await Promise.all([
    fileIdentity(xmodmap), fileIdentity(xinput)]);
  const env = { ...process.env, DISPLAY: sessionState.display,
    XAUTHORITY: sessionState.xauthority };
  const keysymsText = controlledCommand(xmodmap, ["-pke"], env);
  const modifiersText = controlledCommand(xmodmap, ["-pm"], env);
  const devicesText = controlledCommand(xinput, ["--list", "--short"], env);
  const keyboardId = devicesText.match(
    /Virtual core keyboard\s+id=(\d+)\s+\[master keyboard/)?.[1];
  if (keyboardId === undefined) fail("live X map omitted the Virtual core keyboard");
  const keyStateText = controlledCommand(xinput, ["--query-state", keyboardId], env);
  if (/=down$/m.test(keyStateText)) {
    fail("live X keyboard baseline has a held key");
  }
  const liveKeysyms = new Map();
  for (const line of keysymsText.split("\n")) {
    const match = line.match(/^keycode\s+(\d+)\s+=\s*(.*)$/);
    if (match === null) continue;
    for (const keysym of match[2].trim().split(/\s+/).filter(value =>
      value.length !== 0 && value !== "NoSymbol")) {
      const mappings = liveKeysyms.get(keysym) ?? [];
      mappings.push({ keycode: Number.parseInt(match[1], 10),
        column: match[2].trim().split(/\s+/).indexOf(keysym) });
      liveKeysyms.set(keysym, mappings);
    }
  }
  const configPath = sessionState.runtime?.config;
  if (typeof configPath !== "string") fail("session omitted its rendered config path");
  const configBytes = await readFile(configPath);
  const modifierSection = configBytes.toString("utf8").match(
    /\[kbd\.modifiers\]\n(?:[^\[].*(?:\n|$))*/)?.[0] ?? "";
  if (!/^Mod4 = Super$/m.test(modifierSection)) {
    fail("rendered native profile does not explicitly bind Mod4 to Super");
  }
  return { liveKeysyms, evidence: { tool, xinputTool,
    argv: [[xmodmap, "-pke"], [xmodmap, "-pm"],
      [xinput, "--list", "--short"], [xinput, "--query-state", keyboardId]],
    display: sessionState.display,
    keycode_keysym_map: { sha256: sha256(keysymsText), text: keysymsText },
    modifier_map: { sha256: sha256(modifiersText), text: modifiersText },
    zero_held_baseline: { device_id: keyboardId,
      device_list_sha256: sha256(devicesText), query_state_sha256: sha256(keyStateText),
      held_key_count: 0, query_state: keyStateText },
    rendered_config: { path: configPath, bytes: configBytes.byteLength,
      sha256: sha256(configBytes), kbd_modifiers: modifierSection.trim() } } };
}
async function ocrScreenshot(path) {
  const executable = await findExecutable("tesseract");
  const identity = await fileIdentity(executable);
  const version = spawnSync(executable, ["--version"], { encoding: "utf8",
    timeout: 30_000 });
  const result = spawnSync(executable, [path, "stdout", "--psm", "6"], {
    encoding: "utf8", timeout: 60_000, killSignal: "SIGKILL" });
  if (version.error || version.status !== 0 || result.error || result.signal ||
      result.status !== 0) fail("controlled screenshot OCR failed");
  return { tool: { ...identity, version: version.stdout.split("\n")[0] },
    argv: [executable, path, "stdout", "--psm", "6"], text: result.stdout };
}
async function validateStoppedSession(stateRoot, session, expectedSha, labels) {
  const directory = resolve(stateRoot, session);
  const runState = JSON.parse(await readFile(resolve(directory, "run.json"), "utf8"));
  if (runState.usim_sha256_at_start !== expectedSha ||
      runState.usim_sha256_at_exec !== expectedSha ||
      runState.status !== "stopped" || runState.forced_stop !== false ||
      runState.state_may_be_incomplete !== false) {
    fail(`${session} has nonconforming executable or shutdown provenance`);
  }
  const screenshotDirectory = resolve(directory, "screenshots");
  const sidecars = (await readdir(screenshotDirectory)).filter(name => name.endsWith(".json"));
  const screenshots = [];
  for (const label of labels) {
    const name = sidecars.find(candidate => candidate.includes(`-${label}.json`));
    if (name === undefined) fail(`${session} omitted screenshot ${label}`);
    const value = JSON.parse(await readFile(resolve(screenshotDirectory, name), "utf8"));
    const identity = await fileIdentity(value.path);
    if (identity.sha256 !== value.png_sha256 || value.usim_sha256_at_start !== expectedSha ||
        value.width !== 768 || value.height !== 963) fail(`${session} screenshot ${label} drifted`);
    screenshots.push({ label, sidecar: name, ...value });
  }
  return { run: runState, screenshots };
}

const execute = IS_MAIN && process.argv.includes("--execute");
if (IS_MAIN && !execute) {
  process.stdout.write(`${JSON.stringify({ schema: "cadr-m8-m9-x11-plan-v1",
    outcome: "blocked", runtime_execution_performed: false,
    reason: "explicit---execute-required", physical_descriptor_count: 100,
    path: "XTEST->X11->Cadet->kbd_event/mouse_event->CDRM8N1" })}\n`);
  process.exitCode = 2;
} else if (IS_MAIN) {
  const build = JSON.parse(await readFile(resolve(prepared, "m8-m9-input-build.json"), "utf8"));
  const preparedBinding = await validatePreparedBinding(prepared, build);
  const sourceBinding = await sourceProvenance([
    fileURLToPath(import.meta.url),
    resolve(ROOT, "cadr-web/wasm/cadr-m8-keyboard.mjs"),
    resolve(ROOT, "scripts/cadr-computer-use.py"),
    HARNESS,
    resolve(ROOT, "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch"),
  ]);
  const x11 = resolve(ROOT, build?.x11_witness?.path ?? "");
  if (build?.x11_witness?.sha256 === undefined) fail("prepared build has no X11 witness executable");
  const selected = await fileIdentity(x11);
  if (selected.bytes !== build.x11_witness.bytes ||
      selected.sha256 !== build.x11_witness.sha256) {
    fail("selected X11 executable differs from its canonical build marker");
  }
  const reachability = await sourceReachability(prepared);
  const browserEvidence = await browserAll100Evidence(browserManifest);
  const token = randomUUID().replaceAll("-", "");
  const stateRoot = resolve(ROOT, "build/cadr-computer-use");
  const mapSession = `m8-m9-x11-map-${token}`;
  const workflowSession = `m8-m9-x11-workflow-${token}`;
  const env = { ...process.env, CADR_COMPUTER_USE_USIM: x11 };
  const common = ["--state-root", stateRoot];
  const calls = [];
  let dispositions = [];
  let pointerDispositions = [];
  let liveMappingEvidence = null;
  function call(args) { const value = run([...common, ...args], env); calls.push({ args, value }); return value; }
  function reachListener(session) {
    call(["wait", "--session", session, "--seconds", "25"]);
    call(["key", "--session", session, "Return"]);
    call(["wait", "--session", session, "--seconds", "2"]);
    call(["type", "--session", session, "--delay-ms", "25", "--enter", "N"]);
    call(["wait", "--session", session, "--seconds", "6"]);
  }
  let active = null;
  try {
    call(["start", "--session", mapSession, "--fresh", "--timeout", "180"]); active = mapSession;
    call(["screenshot", "--session", mapSession, "--label", "all-100-baseline"]);
    const witness = resolve(stateRoot, mapSession, "x11-input.cdrm8n1");
    /* Establish focus and a known pointer position before the measured ranges.
     * EnterNotify and focus transitions may legitimately emit native records. */
    call(["mouse", "--session", mapSession, "move", "99", "119"]);
    await settledWitnessCount(witness);
    const xMap = await liveXMap(stateRoot, mapSession);
    liveMappingEvidence = xMap.evidence;
    for (const descriptor of CADR_M8_PHYSICAL_KEYS) {
      const sourceCandidates = reachability.scanToX.get(descriptor.scancode) ?? [];
      const classification = classifyNativeCandidates(sourceCandidates, xMap.liveKeysyms);
      const liveSourceCandidates = classification.liveSourceCandidates;
      const candidates = classification.directCandidates;
      if (candidates.length === 0) {
        const chordOnly = classification.disposition ===
          "native-modifier-chord-not-exercised";
        dispositions.push({ id: descriptor.id, code: descriptor.code,
          candidate_x_keysyms: sourceCandidates,
          live_candidate_keysyms: candidates,
          expected_scancode: descriptor.scancode, witness_records: 0, observed: [],
          disposition: chordOnly ? "native-modifier-chord-not-exercised" :
            "not-applicable-native-source-unmapped",
          reason: chordOnly ?
            "selected-source keysym exists only in a shifted live Xvfb column; exact modifier-chord sequence remains open" :
            sourceCandidates.length === 0 ?
            "no selected-source X keysym maps to this Cadet scancode" :
            "selected-source keysym is absent from the unmodified live Xvfb keymap" });
        continue;
      }
      const selectedXKey = candidates[0];
      const before = await settledWitnessCount(witness);
      call(["key", "--session", mapSession, "--delay-ms", "10", selectedXKey]);
      const after = await settledWitnessCount(witness);
      const observed = await witnessRecords(witness, before, after);
      const exact = observed.length === 2 &&
        observed[0].kind === 1 &&
        observed[0].first === descriptor.scancode &&
        observed[0].second === 1 &&
        observed[0].x === 0 && observed[0].y === 0 &&
        observed[1].kind === 1 &&
        observed[1].first === 0x8000 &&
        observed[1].second === 2 &&
        observed[1].x === 0 && observed[1].y === 0;
      dispositions.push({ id: descriptor.id, code: descriptor.code,
        x_key: selectedXKey, candidate_x_keysyms: sourceCandidates,
        live_candidate_keysyms: candidates,
        live_x_mappings: xMap.liveKeysyms.get(selectedXKey),
        expected_scancode: descriptor.scancode,
        witness_records: after - before, observed,
        expected_records: [
          { kind: 1, first: descriptor.scancode, second: 1, x: 0, y: 0 },
          { kind: 1, first: 0x8000, second: 2, x: 0, y: 0 },
        ],
        disposition: exact ? "exact-down-and-all-up-observed" : "observed-divergence" });
    }
    for (const [action, button] of [["move", null], ["down", "1"], ["up", "1"],
      ["down", "2"], ["up", "2"], ["down", "3"], ["up", "3"]]) {
      const before = await settledWitnessCount(witness);
      const args = ["mouse", "--session", mapSession, action];
      if (action === "move") args.push("100", "120"); else args.push(button);
      call(args);
      const after = await settledWitnessCount(witness);
      const observed = await witnessRecords(witness, before, after);
      const expectedButton = action === "move" ? 0 : Number.parseInt(button, 10);
      const exact = observed.length === 1 && observed[0].kind === 2 &&
        observed[0].x === 100 && observed[0].y === 120 &&
        observed[0].first === expectedButton &&
        observed[0].second === 0;
      pointerDispositions.push({ action, button: expectedButton,
        witness_records: after - before, observed,
        disposition: exact ? "exact-native-pointer-record-observed" :
          "observed-divergence" });
    }
    call(["screenshot", "--session", mapSession, "--label", "all-100-complete"]);
    call(["stop", "--session", mapSession]); active = null;

    call(["start", "--session", workflowSession, "--fresh", "--timeout", "180"]); active = workflowSession;
    reachListener(workflowSession);
    call(["screenshot", "--session", workflowSession, "--label", "listener-ready"]);
    call(["type", "--session", workflowSession, "--delay-ms", "25", "--enter",
      "(LIST (INTERN (COERCE (MAPCAR #'CODE-CHAR '(67 87 50 45 78 65 84 73 86 69)) 'STRING)) (+ 20 22))"]);
    call(["wait", "--session", workflowSession, "--seconds", "3"]);
    call(["screenshot", "--session", workflowSession, "--label", "listener-result"]);
    call(["type", "--session", workflowSession, "--delay-ms", "25", "--enter", "(ED T)"]);
    call(["wait", "--session", workflowSession, "--seconds", "5"]);
    call(["screenshot", "--session", workflowSession, "--label", "zmacs-window"]);
    call(["type", "--session", workflowSession, "--delay-ms", "25",
      "(DEFUN CW2-EDITOR-NATIVE () 314159)"]);
    call(["wait", "--session", workflowSession, "--seconds", "2"]);
    call(["screenshot", "--session", workflowSession, "--label", "zmacs-editor-input"]);
    call(["stop", "--session", workflowSession]); active = null;

    const mapEvidence = await validateStoppedSession(stateRoot, mapSession,
      selected.sha256, ["all-100-baseline", "all-100-complete"]);
    const workflowEvidence = await validateStoppedSession(stateRoot, workflowSession,
      selected.sha256, ["listener-ready", "listener-result", "zmacs-window",
        "zmacs-editor-input"]);
    const witnessIdentity = await fileIdentity(resolve(stateRoot, mapSession,
      "x11-input.cdrm8n1"));
    if (dispositions.length !== 100 ||
        dispositions.some(item => item.disposition === "observed-divergence") ||
        dispositions.some(item => item.disposition === "not-applicable-native-source-unmapped" &&
          item.observed.length !== 0) ||
        dispositions.some(item => item.disposition === "native-modifier-chord-not-exercised" &&
          item.observed.length !== 0) ||
        dispositions.some(item => item.disposition === "exact-down-and-all-up-observed" &&
          item.live_candidate_keysyms.length === 0) ||
        pointerDispositions.length !== 7 ||
        pointerDispositions.some(item => item.disposition === "observed-divergence") ||
        witnessIdentity.bytes % 64 !== 0) fail("all-100 witness disposition validation failed");
    if (workflowEvidence.screenshots[0].pixel_sha256 ===
        workflowEvidence.screenshots[1].pixel_sha256) {
      fail("Listener result framebuffer did not change");
    }
    const listenerOcr = await ocrScreenshot(workflowEvidence.screenshots.find(
      item => item.label === "listener-result").path);
    const zmacsOcr = await ocrScreenshot(workflowEvidence.screenshots.find(
      item => item.label === "zmacs-window").path);
    const zmacsEditorOcr = await ocrScreenshot(workflowEvidence.screenshots.find(
      item => item.label === "zmacs-editor-input").path);
    const listenerText = listenerOcr.text.toUpperCase();
    const editorText = zmacsEditorOcr.text.toUpperCase();
    if (!listenerText.includes("CW2") || !listenerText.includes("NATIVE") ||
        !listenerText.includes("42") || !zmacsOcr.text.toUpperCase().includes("ZMACS") ||
        !editorText.includes("CW2") || !editorText.includes("EDITOR") ||
        !editorText.includes("NATIVE") || !editorText.includes("314159")) {
      fail("OCR did not verify the evaluated Listener result, Zmacs window, and editor input");
    }
    const manifestPath = resolve(stateRoot, mapSession, "m8-m9-x11-campaign.json");
    await writeFile(manifestPath, `${JSON.stringify({ schema: "cadr-m8-m9-x11-campaign-v1",
      x11_witness: { marker: build.x11_witness, selected },
      prepared_binding: preparedBinding,
      source_binding: sourceBinding,
      source_reachability: reachability.evidence,
      live_x_mapping: xMap.evidence,
      browser_all_100_evidence: browserEvidence,
      descriptor_count: dispositions.length,
      native_descriptor_closure: false,
      native_descriptor_closure_reason:
        "source-unmapped browser descriptors and shifted modifier chords remain explicit exceptions; joined browser evidence covers all 100 descriptors",
      dispositions, pointer_transition_count: pointerDispositions.length,
      pointer_dispositions: pointerDispositions, workflow_session: workflowSession,
      listener_result: {
        submitted_form: "(LIST (INTERN (COERCE (MAPCAR #'CODE-CHAR '(67 87 50 45 78 65 84 73 86 69)) 'STRING)) (+ 20 22))",
        expected_text: "(CW2-NATIVE 42)",
        anti_echo_basis: "the expected CW2-NATIVE and 42 tokens do not occur literally in the submitted form",
        verification: "controlled-ocr-ancillary-to-required-human-screenshot-review",
        visual_review_required: true, cw2_closed: false, listener_ocr: listenerOcr,
        zmacs_ocr: zmacsOcr, zmacs_editor_ocr: zmacsEditorOcr },
      witness: witnessIdentity, map_evidence: mapEvidence,
      workflow_evidence: workflowEvidence,
      evidence_boundary: "native XTEST/X11/Cadet only; browser matching remains separate",
      calls }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ outcome: "native-x11-campaign-recorded",
      map_session: mapSession, workflow_session: workflowSession, manifest: manifestPath })}\n`);
  } catch (error) {
    const failurePath = resolve(stateRoot, mapSession, "m8-m9-x11-failure.json");
    await writeX11FailureManifest(failurePath, {
      error: error instanceof Error ? error.message : String(error),
      x11_witness: { marker: build.x11_witness, selected },
      prepared_binding: preparedBinding, source_reachability: reachability.evidence,
      source_binding: sourceBinding,
      live_x_mapping: liveMappingEvidence,
      browser_all_100_evidence: browserEvidence,
      dispositions, pointer_dispositions: pointerDispositions,
      workflow_session: workflowSession, calls,
      evidence_boundary: "failure record only; no native X11 or CW2 closure claim",
    }).catch(() => {});
    throw error;
  } finally {
    if (active !== null) spawnSync(HARNESS, [...common, "stop", "--session", active],
      { cwd: ROOT, env, encoding: "utf8" });
  }
}
