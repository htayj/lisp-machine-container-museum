#!/usr/bin/env node
/*
 * Native XTEST -> X11 -> Cadet -> pre-IOB witness campaign.
 *
 * This is distinct from the direct-boundary oracle.  It uses the established
 * computer-use harness and its full run.json/screenshot/shutdown provenance.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants as FS } from "node:fs";
import { lstat, open, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CADR_M8_PHYSICAL_KEYS, cadrM8KeyForCode } from "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import { buildCadrM8M9Campaign, serializeCadrM8M9NativeScript } from "../cadr-web/wasm/cadr-m8-m9-campaign.mjs";
import { encodeCadrM9Edge32 } from "../cadr-web/wasm/cadr-m9-pointer.mjs";
import { CADR_M6_DEVID_POLICY_ID, CADR_M6_DEVID_PROFILE,
  CADR_M6_READY4_CONTRACT, appendM6FastCheckpoint, appendM6FastHostWait,
  canonicalM6ReadyWitness, canonicalM6ReadyWitnessV4, parseM6DevidSummary,
  parseM6FastRunRecord, parseM6ZeroLatencyHostTranscript } from
  "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M8_M9_DIRECT_AUTHORITIES,
  CADR_M8_M9_DIRECT_DIRTY_POLICY,
  assertCadrM8M9ProvenanceJoin,
  collectCadrM8M9ProvenanceJoin,
} from "./cadr-m8-m9-provenance-join.mjs";
import { CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256 } from
  "./run-cadr-m8-m9-input-conformance.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS = resolve(ROOT, "scripts/cadr-computer-use.sh");
const DIRECT_RESULT_ROOT = resolve(ROOT, "build/cadr-oracle");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const IS_MAIN = resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
let prepared = resolve(ROOT, "build/cadr-oracle/m8-m9-x11-prepared-v4");
const browserManifests = { O0: null, O2: null };
for (let index = 0; IS_MAIN && index < process.argv.length; index += 1) {
  if (process.argv[index] === "--prepared") {
    if (typeof process.argv[index + 1] !== "string") fail("--prepared requires a path");
    prepared = resolve(ROOT, process.argv[index + 1]);
  }
  if (process.argv[index] === "--browser-manifest") {
    fail("--browser-manifest is superseded; use both --browser-o0-manifest and --browser-o2-manifest");
  }
  for (const variant of ["O0", "O2"]) {
    const option = `--browser-${variant.toLowerCase()}-manifest`;
    if (process.argv[index] === option) {
      if (typeof process.argv[index + 1] !== "string") fail(`${option} requires a path`);
      browserManifests[variant] = resolve(ROOT, process.argv[index + 1]);
    }
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

function record(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, keys, label) {
  if (!record(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) {
    fail(`${label} has an unexpected shape`);
  }
  return value;
}
function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(`${label} is not SHA-256`);
  return value;
}
function decimal(value, label, { zero = true } = {}) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value) ||
      (!zero && value === "0")) fail(`${label} is not a canonical unsigned decimal`);
  return value;
}
function immutableAncestry(value, label) {
  if (!Array.isArray(value) || value.length < 1) {
    fail(`${label} ancestry is absent`);
  }
  const uids = new Set([
    ...(typeof process.getuid === "function" ? [process.getuid()] : []),
    ...(typeof process.geteuid === "function" ? [process.geteuid()] : []),
  ]);
  const groups = new Set([
    ...(typeof process.getgroups === "function" ? process.getgroups() : []),
    ...(typeof process.getgid === "function" ? [process.getgid()] : []),
    ...(typeof process.getegid === "function" ? [process.getegid()] : []),
  ]);
  for (const component of value) {
    exactKeys(component, ["reference", "uid", "gid", "mode", "device",
      "inode"], `${label} component`);
    if (typeof component.reference !== "string" ||
        !component.reference.startsWith("/") ||
        typeof component.mode !== "string" ||
        !/^[0-7]{3,4}$/.test(component.mode) ||
        !decimal(component.uid, `${label} uid`) ||
        !decimal(component.gid, `${label} gid`) ||
        !decimal(component.device, `${label} device`) ||
        !decimal(component.inode, `${label} inode`, { zero: false })) {
      fail(`${label} component is malformed`);
    }
    const mode = Number.parseInt(component.mode, 8);
    if (uids.has(Number(component.uid)) ||
        (groups.has(Number(component.gid)) && (mode & 0o020) !== 0) ||
        (mode & 0o002) !== 0) {
      fail(`${label} component is mutable by the current credentials`);
    }
  }
  return value;
}
function unsigned(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is not an unsigned safe integer`);
  return value;
}
function confinedPath(root, value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") ||
      isAbsolute(value) || value.split(/[\\/]/).some(part => part === "" || part === "." || part === "..")) {
    fail(`${label} must be a nonempty relative non-traversing path`);
  }
  const resolved = resolve(root, value);
  const relativePath = relative(root, resolved).split("\\").join("/");
  if (relativePath !== value || relativePath === ".." || relativePath.startsWith("../")) {
    fail(`${label} escapes its declared root`);
  }
  return resolved;
}
async function liveContainedPath(root, target, label, { directory = false } = {}) {
  const rootAbsolute = resolve(root); const targetAbsolute = resolve(target);
  const relativePath = relative(rootAbsolute, targetAbsolute).split("\\").join("/");
  if (relativePath.length === 0 || relativePath === ".." || relativePath.startsWith("../")) {
    fail(`${label} is outside its declared live root`);
  }
  const rootInfo = await lstat(rootAbsolute);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail(`${label} has a symbolic-link or non-directory root`);
  }
  let cursor = rootAbsolute; const components = relativePath.split("/");
  for (const [index, component] of components.entries()) {
    cursor = resolve(cursor, component); const info = await lstat(cursor);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link ancestor ${component}`);
    const terminal = index === components.length - 1;
    if (!terminal && !info.isDirectory()) fail(`${label} has a non-directory ancestor ${component}`);
    if (terminal && (directory ? !info.isDirectory() : !info.isFile())) {
      fail(`${label} is not a ${directory ? "directory" : "regular file"}`);
    }
  }
  return targetAbsolute;
}
async function confinedLivePath(root, value, label, options) {
  return liveContainedPath(root, confinedPath(root, value, label), label, options);
}
function repositoryRelativePath(path, label) {
  const result = relative(ROOT, resolve(path)).split("\\").join("/");
  if (result.length === 0 || result === ".." || result.startsWith("../")) fail(`${label} is outside the repository`);
  return result;
}
async function privateDirectory(path, label) {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
      (info.mode & 0o7777) !== 0o700) {
    fail(`${label} is not a current-owner exact-0700 non-symlink directory`);
  }
}
async function privateIdentity(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || info.nlink !== 1 ||
      (info.mode & 0o7777) !== 0o600) {
    fail(`${label} is not a current-owner singly-linked exact-0600 non-symlink file`);
  }
  const bytes = await readFile(path);
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes), content: bytes });
}
async function exactDirectoryEntries(path, entries, label) {
  const actual = (await readdir(path)).sort();
  const expected = [...entries].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} has an unexpected sidecar layout`);
}
function receipt(value, path, expectedPath, label) {
  exactKeys(value, ["path", "bytes", "sha256"], `${label} receipt`);
  if (value.path !== expectedPath || unsigned(value.bytes, `${label}.bytes`) !== path.bytes ||
      digest(value.sha256, `${label}.sha256`) !== path.sha256) {
    fail(`${label} receipt differs from its contained file`);
  }
  return value;
}
function jsonBytes(identity, label) {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(identity.content)); }
  catch (error) { fail(`${label} is not UTF-8 JSON: ${error.message}`); }
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sameJson(left, right) { return canonicalJson(left) === canonicalJson(right); }
function hexBytes(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) {
    fail(`${label} is not canonical lowercase hexadecimal`);
  }
  return Uint8Array.from(Buffer.from(value, "hex"));
}
function digestReceipt(value, label) {
  exactKeys(value, ["bytes", "sha256"], label);
  if (value.bytes !== 32 || !digest(value.sha256, `${label}.sha256`)) {
    fail(`${label} is not an exact digest receipt`);
  }
  return hexBytes(value.sha256, `${label}.sha256`);
}
function summaryReceipt(value, label) {
  exactKeys(value, ["bytes", "sha256", "hex", "selected_maximum", "total_accepted",
    "tail_event_count"], label);
  if (value.bytes !== 512 || !digest(value.sha256, `${label}.sha256`) ||
      typeof value.hex !== "string" || value.hex.length !== 1024 ||
      decimal(value.selected_maximum, `${label}.selected_maximum`, { zero: false }) !== "9223372036854775807" ||
      decimal(value.total_accepted, `${label}.total_accepted`, { zero: false }) === "0" ||
      decimal(value.tail_event_count, `${label}.tail_event_count`) === undefined) {
    fail(`${label} has malformed CDRM6E1 receipt fields`);
  }
  const bytes = hexBytes(value.hex, `${label}.hex`);
  if (bytes.byteLength !== 512 || sha256(bytes) !== value.sha256) {
    fail(`${label} CDRM6E1 bytes differ from the receipt hash`);
  }
  const parsed = parseM6DevidSummary({ wireSchema: "CDRM6E1",
    policyId: CADR_M6_DEVID_POLICY_ID, summary: bytes,
    summaryDigest: hexBytes(value.sha256, `${label}.sha256`) });
  if (Buffer.from(parsed.digest).toString("hex") !== value.sha256 ||
      parsed.selectedMaximum.toString() !== value.selected_maximum ||
      parsed.totalAccepted.toString() !== value.total_accepted ||
      parsed.tailEventCount.toString() !== value.tail_event_count) {
    fail(`${label} CDRM6E1 projection differs from its bytes`);
  }
  return Object.freeze({ bytes, parsed });
}
async function expectedArtifactSetDigest(join) {
  const profile = new TextEncoder().encode(join.selected_inputs.profile.id);
  const artifacts = join.selected_inputs.release.artifacts;
  const bytes = new Uint8Array(12 + profile.byteLength + artifacts.length * 44);
  bytes.set(new TextEncoder().encode("CDRM6AR1"), 0);
  const view = new DataView(bytes.buffer); view.setUint32(8, profile.byteLength, true);
  bytes.set(profile, 12); let offset = 12 + profile.byteLength;
  for (const artifact of artifacts) {
    view.setUint32(offset, artifact.kind, true);
    view.setBigUint64(offset + 4, BigInt(artifact.byte_count), true);
    bytes.set(hexBytes(artifact.sha256, `artifact ${artifact.kind}.sha256`), offset + 12);
    offset += 44;
  }
  return sha256(bytes);
}
async function readPinnedReleaseRecord(join) {
  const path = await liveContainedPath(ROOT, RELEASE_PATH, "frozen M6 release record");
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    fail("frozen M6 release record is not a regular non-symlink file");
  }
  const handle = await open(path, FS.O_RDONLY | FS.O_NOFOLLOW);
  let bytes;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail("frozen M6 release record changed while being opened");
    }
    bytes = new Uint8Array(await handle.readFile());
    const after = await handle.stat({ bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size) {
      fail("frozen M6 release record changed while being read");
    }
  } finally { await handle.close(); }
  const named = await lstat(path, { bigint: true });
  if (!named.isFile() || named.isSymbolicLink() || named.dev !== before.dev ||
      named.ino !== before.ino || named.size !== before.size) {
    fail("frozen M6 release record pathname changed while being read");
  }
  const identity = Object.freeze({ path: repositoryRelativePath(path, "frozen M6 release record"),
    bytes: bytes.byteLength, sha256: sha256(bytes) });
  const expected = join.selected_inputs?.release;
  if (identity.path !== expected?.path || identity.bytes !== expected?.bytes ||
      identity.sha256 !== expected?.sha256) {
    fail("frozen M6 release record differs from the selected provenance identity");
  }
  let value;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail("frozen M6 release record is not UTF-8 JSON"); }
  const canonical = new TextEncoder().encode(canonicalJson(value));
  if (canonical.byteLength !== bytes.byteLength || !canonical.every((byte, index) => byte === bytes[index])) {
    fail("frozen M6 release record is not canonical JSON");
  }
  return Object.freeze({ identity, value: Object.freeze(value) });
}
async function validateReady4Evidence(value, join, release, label) {
  exactKeys(value, ["schema", "outcome", "target", "contract", "boundary", "quiescent",
    "release_record", "run_evidence", "machine_info", "quiescence", "ready3_witness",
    "ready4_witness", "cdrm6e1", "checkpoint_chain", "host_wait_chain", "cdrstate5", "cdrm5q1",
    "artifact_set", "host_transcript", "post_208_summary"], label);
  if (value.schema !== "cadr-m8-m9-ready4-evidence-v1" || value.outcome !== "ready4" ||
      value.target !== CADR_M6_DEVID_PROFILE || value.contract !== CADR_M6_READY4_CONTRACT ||
      value.boundary !== "983990278" || value.quiescent !== true) {
    fail(`${label} does not claim exact quiescent READY4`);
  }
  const ready3 = digestReceipt(value.ready3_witness, `${label}.ready3_witness`);
  const ready4 = digestReceipt(value.ready4_witness, `${label}.ready4_witness`);
  const state = digestReceipt(value.cdrstate5, `${label}.cdrstate5`);
  const queue = digestReceipt(value.cdrm5q1, `${label}.cdrm5q1`);
  const artifactSet = digestReceipt(value.artifact_set, `${label}.artifact_set`);
  exactIdentity(value.release_record, release.identity, `${label}.release_record`);
  exactKeys(value.run_evidence, ["session_id", "private_disk_instance_id", "private_disk_base"],
    `${label}.run_evidence`);
  if (!/^m6-ready4-session-[0-9a-f]{32}$/.test(value.run_evidence.session_id) ||
      !/^m6-ready4-private-disk-[0-9a-f]{32}$/.test(value.run_evidence.private_disk_instance_id)) {
    fail(`${label}.run_evidence lacks fresh READY4 execution identities`);
  }
  const base = digestReceipt(value.run_evidence.private_disk_base,
    `${label}.run_evidence.private_disk_base`);
  exactKeys(value.machine_info, ["lifecycle", "artifact_mask", "boundary", "microinstructions",
    "generation", "next_request_id", "outstanding_request_id", "last_completed_request_id",
    "persistent_status", "profile"], `${label}.machine_info`);
  if (value.machine_info.lifecycle !== 2 || value.machine_info.artifact_mask !== 31 ||
      value.machine_info.boundary !== "983990278" || value.machine_info.persistent_status !== 0 ||
      value.machine_info.profile !== 1 || value.machine_info.outstanding_request_id !== "0") {
    fail(`${label}.machine_info is not the exact READY4 running core state`);
  }
  for (const field of ["microinstructions", "generation", "next_request_id", "last_completed_request_id"]) {
    decimal(value.machine_info[field], `${label}.machine_info.${field}`,
      { zero: field === "last_completed_request_id" });
  }
  exactKeys(value.quiescence, ["scheduler_lifecycle", "run_active", "deferred_control_count",
    "pending_boundary_digest", "media_busy", "media_snapshot_blocked", "visibility_initialized",
    "hidden", "block_service_pending", "host_next_request_status"], `${label}.quiescence`);
  if (value.quiescence.scheduler_lifecycle !== "PAUSED" || value.quiescence.run_active !== false ||
      value.quiescence.deferred_control_count !== 0 || value.quiescence.pending_boundary_digest !== false ||
      value.quiescence.media_busy !== false || value.quiescence.media_snapshot_blocked !== false ||
      value.quiescence.visibility_initialized !== true || value.quiescence.hidden !== false ||
      value.quiescence.block_service_pending !== false || value.quiescence.host_next_request_status !== 9) {
    fail(`${label}.quiescence does not retain assertQuiescent facts`);
  }
  exactKeys(value.checkpoint_chain, ["count", "bytes", "sha256", "records"], `${label}.checkpoint_chain`);
  if (!Number.isSafeInteger(value.checkpoint_chain.count) || value.checkpoint_chain.count < 1) {
    fail(`${label}.checkpoint_chain has no fast-run links`);
  }
  const checkpoint = digestReceipt({ bytes: value.checkpoint_chain.bytes,
    sha256: value.checkpoint_chain.sha256 }, `${label}.checkpoint_chain`);
  if (!Array.isArray(value.checkpoint_chain.records) ||
      value.checkpoint_chain.records.length !== value.checkpoint_chain.count) {
    fail(`${label}.checkpoint_chain records do not match its count`);
  }
  let expectedCheckpoint = new Uint8Array(createHash("sha256").update("CDRM6FASTCHAIN1\0").digest());
  for (const [ordinal, record] of value.checkpoint_chain.records.entries()) {
    exactKeys(record, ["fast_run", "cdrstate5", "cdrm5q1"],
      `${label}.checkpoint_chain.records ${ordinal}`);
    exactKeys(record.fast_run, ["bytes", "sha256", "hex"],
      `${label}.checkpoint_chain.records ${ordinal}.fast_run`);
    if (record.fast_run.bytes !== 128 || typeof record.fast_run.hex !== "string" ||
        !/^[0-9a-f]{256}$/.test(record.fast_run.hex)) {
      fail(`${label}.checkpoint_chain.records ${ordinal} has no exact CDRM6FAST1`);
    }
    const fast = Buffer.from(record.fast_run.hex, "hex");
    if (sha256(fast) !== record.fast_run.sha256 || parseM6FastRunRecord(fast).reason === 3) {
      fail(`${label}.checkpoint_chain.records ${ordinal} is not a settled fast stop`);
    }
    const stateAtCheckpoint = digestReceipt(record.cdrstate5,
      `${label}.checkpoint_chain.records ${ordinal}.cdrstate5`);
    const queueAtCheckpoint = digestReceipt(record.cdrm5q1,
      `${label}.checkpoint_chain.records ${ordinal}.cdrm5q1`);
    expectedCheckpoint = await appendM6FastCheckpoint(expectedCheckpoint, ordinal,
      fast, stateAtCheckpoint, queueAtCheckpoint);
  }
  if (Buffer.from(checkpoint).toString("hex") !== Buffer.from(expectedCheckpoint).toString("hex")) {
    fail(`${label}.checkpoint_chain commitment differs from its settled materials`);
  }
  const finalCheckpoint = value.checkpoint_chain.records.at(-1);
  if (finalCheckpoint?.cdrstate5?.sha256 !== value.cdrstate5.sha256 ||
      finalCheckpoint?.cdrm5q1?.sha256 !== value.cdrm5q1.sha256) {
    fail(`${label} terminal state/queue differ from the final settled checkpoint`);
  }
  exactKeys(value.host_wait_chain, ["count", "bytes", "sha256", "records"], `${label}.host_wait_chain`);
  if (!Number.isSafeInteger(value.host_wait_chain.count) || value.host_wait_chain.count < 0) {
    fail(`${label}.host_wait_chain has an invalid fast host-stop count`);
  }
  const hostWait = digestReceipt({ bytes: value.host_wait_chain.bytes,
    sha256: value.host_wait_chain.sha256 }, `${label}.host_wait_chain`);
  if (!Array.isArray(value.host_wait_chain.records) ||
      value.host_wait_chain.records.length !== value.host_wait_chain.count) {
    fail(`${label}.host_wait_chain records do not match its count`);
  }
  let expectedHostWait = new Uint8Array(createHash("sha256").update("CDRM6FASTHOSTWAIT1\0").digest());
  for (const [ordinal, record] of value.host_wait_chain.records.entries()) {
    exactKeys(record, ["bytes", "sha256", "hex"], `${label}.host_wait_chain.records ${ordinal}`);
    if (record.bytes !== 128 || typeof record.hex !== "string" || !/^[0-9a-f]{256}$/.test(record.hex)) {
      fail(`${label}.host_wait_chain.records ${ordinal} is not an exact CDRM6FAST1 record`);
    }
    const bytes = Buffer.from(record.hex, "hex");
    if (sha256(bytes) !== record.sha256 || parseM6FastRunRecord(bytes).reason !== 3) {
      fail(`${label}.host_wait_chain.records ${ordinal} is not a reason-3 CDRM6FAST1 record`);
    }
    expectedHostWait = await appendM6FastHostWait(expectedHostWait, ordinal, bytes);
  }
  if (Buffer.from(hostWait).toString("hex") !== Buffer.from(expectedHostWait).toString("hex")) {
    fail(`${label}.host_wait_chain commitment differs from its exact records`);
  }
  exactKeys(value.host_transcript, ["bytes", "sha256", "hex"], `${label}.host_transcript`);
  if (!Number.isSafeInteger(value.host_transcript.bytes) || value.host_transcript.bytes < 64 ||
      !digest(value.host_transcript.sha256, `${label}.host_transcript.sha256`) ||
      typeof value.host_transcript.hex !== "string" ||
      value.host_transcript.hex.length !== value.host_transcript.bytes * 2 ||
      !/^[0-9a-f]+$/.test(value.host_transcript.hex) ||
      sha256(Buffer.from(value.host_transcript.hex, "hex")) !== value.host_transcript.sha256) {
    fail(`${label}.host_transcript is incomplete`);
  }
  try {
    await parseM6ZeroLatencyHostTranscript(Buffer.from(value.host_transcript.hex, "hex"), {
      artifactSetSha256: artifactSet,
      hostWaitRecords: value.host_wait_chain.records.map(record => Buffer.from(record.hex, "hex")),
    });
  } catch (error) {
    fail(`${label}.host_transcript/artifact closure differs: ${error.message}`);
  }
  const summary = summaryReceipt(value.cdrm6e1, `${label}.cdrm6e1`);
  exactKeys(value.post_208_summary, ["outcome", "after_input_ordinal", "cdrm6e1"], `${label}.post_208_summary`);
  if (value.post_208_summary.outcome !== "limit-not-exceeded" ||
      value.post_208_summary.after_input_ordinal !== 208) {
    fail(`${label} post-208 evidence does not establish the selected limit`);
  }
  const post = summaryReceipt(value.post_208_summary.cdrm6e1, `${label}.post_208_summary.cdrm6e1`);
  if (post.parsed.totalAccepted > post.parsed.selectedMaximum ||
      post.parsed.selectedMaximum !== summary.parsed.selectedMaximum ||
      post.parsed.totalAccepted < summary.parsed.totalAccepted) {
    fail(`${label} post-208 CDRM6E1 exceeds its selected maximum`);
  }
  const expectedBase = join.selected_inputs.release.artifacts.find(item => item.kind === 3)?.sha256;
  if (Buffer.from(base).toString("hex") !== expectedBase ||
      Buffer.from(artifactSet).toString("hex") !== await expectedArtifactSetDigest(join)) {
    fail(`${label} does not bind the selected artifact closure`);
  }
  const expectedReady3 = await canonicalM6ReadyWitness({ releaseRecord: release.value,
    artifactSetSha256: artifactSet, privateDiskBaseSha256: base,
    formABoundary: BigInt(M6_FROZEN.boundaries[0]), formBBoundary: BigInt(M6_FROZEN.boundaries[1]),
    listenerIdleCBoundary: BigInt(M6_FROZEN.boundaries[2]),
    listenerIdleSettledBoundary: BigInt(M6_FROZEN.boundaries[3]), readyBoundary: 983990278n,
    cdrstate5Sha256: state, cdrm5q1Sha256: queue,
    hostTranscriptSha256: hexBytes(value.host_transcript.sha256, `${label}.host_transcript.sha256`) });
  const expectedReady4 = await canonicalM6ReadyWitnessV4({ ready3Witness: expectedReady3,
    target: CADR_M6_DEVID_PROFILE, policyId: CADR_M6_DEVID_POLICY_ID,
    selectedMaximum: summary.parsed.selectedMaximum,
    cdrm6e1Sha256: hexBytes(value.cdrm6e1.sha256, `${label}.cdrm6e1.sha256`),
    checkpointCount: value.checkpoint_chain.count,
    checkpointChainSha256: checkpoint,
    hostWaitCount: value.host_wait_chain.count,
    hostWaitChainSha256: hostWait });
  if (Buffer.from(ready3).toString("hex") !== Buffer.from(expectedReady3).toString("hex") ||
      Buffer.from(ready4).toString("hex") !== Buffer.from(expectedReady4).toString("hex")) {
    fail(`${label} READY3/READY4 witness differs from the selected closure`);
  }
  return Object.freeze({ summary, post, ready3, ready4 });
}
function hexSession(value, prefix, label) {
  if (typeof value !== "string" || !new RegExp(`^${prefix}-[0-9a-f]{32}$`).test(value)) {
    fail(`${label} is not a fresh ${prefix} identifier`);
  }
  return value;
}
function exactIdentity(value, expected, label) {
  exactKeys(value, ["path", "bytes", "sha256"], label);
  if (!sameJson(value, expected)) fail(`${label} differs from its selected identity`);
  return value;
}
function validateDirectSourceBinding(value, expectedJoin, label) {
  exactKeys(value, ["schema", "repository", "source_closure", "direct_runner"], label);
  if (value.schema !== "cadr-m8-m9-direct-source-binding-v1" ||
      !sameJson(value.repository, expectedJoin.repository) ||
      !sameJson(value.source_closure, expectedJoin.source_closure)) {
    fail(`${label} does not bind the complete current M8/M9 source closure`);
  }
  const runner = value.direct_runner;
  exactKeys(runner, ["revision", "closure_dirty", "dirty_policy", "status_sha256", "status", "files"],
    `${label} direct runner`);
  if (runner.revision !== expectedJoin.repository.candidate_commit ||
      typeof runner.closure_dirty !== "boolean" ||
      runner.dirty_policy !== CADR_M8_M9_DIRECT_DIRTY_POLICY || typeof runner.status !== "string" ||
      !digest(runner.status_sha256, `${label} direct runner status`) ||
      runner.status_sha256 !== sha256(Buffer.from(runner.status)) ||
      runner.closure_dirty !== (runner.status.length !== 0) || !Array.isArray(runner.files) ||
      runner.files.length !== CADR_M8_M9_DIRECT_AUTHORITIES.length) {
    fail(`${label} direct-runner source receipt is incomplete`);
  }
  const closure = new Map(expectedJoin.source_closure.files.map(item => [item.path, item]));
  for (const [index, path] of CADR_M8_M9_DIRECT_AUTHORITIES.entries()) {
    const identity = runner.files[index];
    if (identity?.path !== path) {
      fail(`${label} direct-runner source authorities are not the exact ordered producer set`);
    }
    exactIdentity(identity, closure.get(path), `${label} direct-runner source ${path}`);
  }
}
function validateCapturedWorkerClosure(value, expectedJoin, label) {
  exactKeys(value, ["schema", "root", "file_count", "sha256", "files", "static_imports",
    "execution"], label);
  if (value.schema !== "cadr-m8-m9-worker-capture-v1" ||
      value.root !== "cadr-web/wasm/cadr-worker.js" ||
      value.execution !== "descriptor-captured-in-memory-vm-module-graph-v1" ||
      !Array.isArray(value.files) || !Array.isArray(value.static_imports) ||
      value.file_count !== value.files.length ||
      value.sha256 !== sha256(`${canonicalJson({ files: value.files,
        static_imports: value.static_imports })}\n`)) {
    fail(`${label} is not an exact descriptor-captured worker module graph`);
  }
  const expectedFiles = new Map(expectedJoin.source_closure.files.map(file => [file.path, file]));
  const expectedEdges = new Map(expectedJoin.source_closure.static_imports.map(edge => [edge.path, edge]));
  const pending = [value.root]; const reached = new Set();
  while (pending.length !== 0) {
    const path = pending.pop();
    if (reached.has(path)) continue;
    reached.add(path);
    const edge = expectedEdges.get(path);
    if (edge === undefined) fail(`${label} root graph omits ${path}`);
    pending.push(...edge.imports);
  }
  const files = [...reached].sort().map(path => expectedFiles.get(path));
  const edges = [...reached].sort().map(path => expectedEdges.get(path));
  if (files.some(file => file === undefined) || !sameJson(value.files, files) ||
      !sameJson(value.static_imports, edges)) {
    fail(`${label} differs from the selected descriptor-captured source closure`);
  }
}
const M6_RAW_SCHEDULE = resolve(ROOT, "scripts/cadr-m6-witness-schedule.py");
const M6_FROZEN = Object.freeze({
  mapping_sha256: "2881102e8a8883379cf7da06251501b3c75f453d8fe0bff0d7e9f649198e1cd8",
  forms: Object.freeze({ a: Object.freeze([0x4d36, 0x4131, 0xa55a]),
    b: Object.freeze([0x4d36, 0x4232, 0x5aa5]), c: Object.freeze([0x4d36, 0x4944, 0x4c45]) }),
  write_boundaries: Object.freeze([[328589384, 328606313, 328623242],
    [980279676, 980296605, 980313534], [982955347, 982972780, 982990213]]),
  boundaries: Object.freeze([328623243, 980313535, 982990214, 983990214]),
  cleanup_hold: 1000000, listener_timeout: 100000000,
  retained_all_up: 0x18000,
});
let frozenM6Schedule = null;
function exactInteger(value, name, low = 0, high = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < low || value > high) fail(`${name} is outside its exact integer domain`);
  return value;
}
function m6ClockDue(ordinal) { return Math.floor((ordinal * 1000000 + 59) / 60); }
function loadFrozenM6Schedule() {
  if (frozenM6Schedule !== null) return frozenM6Schedule;
  const program = [
    "import importlib.util,json,sys",
    "spec=importlib.util.spec_from_file_location('cadr_m6_schedule',sys.argv[1])",
    "module=importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "print(json.dumps(module.schedule(),sort_keys=True,separators=(',',':')))",
  ].join(";");
  const result = spawnSync("python3", ["-c", program, M6_RAW_SCHEDULE], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (result.error || result.signal || result.status !== 0) {
    fail("cannot materialize the tracked frozen M6 schedule for raw-transcript verification");
  }
  let value;
  try { value = JSON.parse(result.stdout); } catch { fail("tracked frozen M6 schedule did not produce JSON"); }
  const schedule = value?.schedule;
  const events = [...(schedule?.pre_a_batches ?? []), ...(schedule?.post_a_batches ?? [])].flat();
  if (value?.mapping?.sha256 !== M6_FROZEN.mapping_sha256 || schedule?.sha256 === undefined ||
      !Number.isSafeInteger(schedule?.event_count) || events.length !== schedule.event_count) {
    fail("tracked M6 schedule is not the frozen Cadet-bound producer schedule");
  }
  frozenM6Schedule = Object.freeze({ schedule, events: Object.freeze(events.map(event => Object.freeze({ ...event }))) });
  return frozenM6Schedule;
}
function rawState(recordValue, label, kind = "boundary") {
  const keys = ["kind", "ordinal", "debug_ir_words", "state"];
  exactKeys(recordValue, keys, label);
  if (recordValue.kind !== kind) fail(`${label} is not a ${kind} record`);
  exactInteger(recordValue.ordinal, `${label}.ordinal`, 0);
  if (!Array.isArray(recordValue.debug_ir_words) || recordValue.debug_ir_words.length !== 3) {
    fail(`${label}.debug_ir_words is not a three-word record`);
  }
  recordValue.debug_ir_words.forEach((word, index) => exactInteger(word, `${label}.debug_ir_words[${index}]`, 0, 0xffff));
  const state = recordValue.state;
  exactKeys(state, ["scheduler", "keyboard", "iob", "disk", "host", "completion"], `${label}.state`);
  exactKeys(state.scheduler, ["machine_cycles", "halted", "pending_count"], `${label}.state.scheduler`);
  exactKeys(state.keyboard, ["scancode", "ready", "fifo_count"], `${label}.state.keyboard`);
  exactKeys(state.iob, ["csr", "sixty_cycle_clock"], `${label}.state.iob`);
  exactKeys(state.disk, ["status", "busy", "outstanding_operation", "interrupt_request", "fault"], `${label}.state.disk`);
  exactKeys(state.host, ["request_pending", "completion_queued", "outstanding_request_id"], `${label}.state.host`);
  exactKeys(state.completion, ["schedule_consumed", "debug_ir_writes"], `${label}.state.completion`);
  for (const [owner, field, high] of [[state.scheduler, "machine_cycles", Number.MAX_SAFE_INTEGER],
    [state.scheduler, "halted", 1], [state.scheduler, "pending_count", 0xffffffff],
    [state.keyboard, "scancode", 0x1ffff], [state.keyboard, "ready", 1], [state.keyboard, "fifo_count", 0xffffffff],
    [state.iob, "csr", 0xffffffff], [state.iob, "sixty_cycle_clock", 0xffff],
    [state.disk, "status", 0xffffffff], [state.disk, "busy", 0xffffffff], [state.disk, "outstanding_operation", 0xffffffff],
    [state.disk, "interrupt_request", 1], [state.disk, "fault", 1],
    [state.host, "request_pending", 0xffffffff], [state.host, "completion_queued", 0xffffffff],
    [state.host, "outstanding_request_id", Number.MAX_SAFE_INTEGER],
    [state.completion, "schedule_consumed", 0xffffffff], [state.completion, "debug_ir_writes", 0xffffffff]]) {
    exactInteger(owner[field], `${label}.state.${field}`, 0, high);
  }
  if (state.scheduler.machine_cycles !== recordValue.ordinal || state.scheduler.halted !== 0) {
    fail(`${label} has a noncanonical scheduler state`);
  }
  return recordValue;
}
function rawSettled(recordValue, label) {
  exactKeys(recordValue, ["kind", "ordinal", "cleanup_hold_boundaries", "debug_ir_words", "state"], label);
  if (recordValue.kind !== "settled" || recordValue.cleanup_hold_boundaries !== M6_FROZEN.cleanup_hold) {
    fail(`${label} does not bind the exact retained-C cleanup hold`);
  }
  return rawState({ kind: "settled", ordinal: recordValue.ordinal,
    debug_ir_words: recordValue.debug_ir_words, state: recordValue.state }, label, "settled");
}
function requireRawQuiescence(boundary, label) {
  const state = boundary.state;
  if (state.scheduler.pending_count !== 0 || state.keyboard.scancode !== M6_FROZEN.retained_all_up ||
      state.keyboard.ready !== 0 || state.keyboard.fifo_count !== 0 || (state.iob.csr & (1 << 5)) !== 0 ||
      !sameJson(state.disk, { status: 3, busy: 0, outstanding_operation: 0, interrupt_request: 1, fault: 0 }) ||
      !sameJson(state.host, { request_pending: 0, completion_queued: 0, outstanding_request_id: 0 })) {
    fail(`${label} is not fully device/scheduler quiescent`);
  }
}
function validateM6Idle(samples, label) {
  if (samples.byteLength !== 64 * 96) fail(`${label} is not exactly 64 CDRM6I1 samples`);
  for (let index = 0; index < 64; index += 1) {
    const row = samples.subarray(index * 96, (index + 1) * 96); const view = new DataView(row.buffer, row.byteOffset, row.byteLength);
    if (new TextDecoder().decode(row.subarray(0, 7)) !== "CDRM6I1" || row[7] !== 0 ||
        view.getBigUint64(8, true) !== 0x4c4549444d36n || view.getBigUint64(16, true) >> 48n ||
        view.getBigUint64(24, true) >> 48n || (view.getUint32(60, true) & (1 << 5)) !== 0 ||
        view.getUint32(64, true) !== 0 || view.getUint32(68, true) !== M6_FROZEN.retained_all_up ||
        view.getUint32(72, true) !== 3 || view.getUint32(76, true) !== 0 || view.getUint32(80, true) !== 0 ||
        view.getUint32(84, true) !== 1 || view.getUint32(88, true) !== 0 || view.getUint32(92, true) !== 0) {
      fail(`${label} sample ${index} is not quiescent CDRM6I1 Listener-idle C`);
    }
  }
}
function validateNativeTranscript(identity, metadata, expectedJoin, label) {
  let lines;
  try { lines = new TextDecoder("utf-8", { fatal: true }).decode(identity.content).split("\n"); }
  catch { fail(`${label} is not UTF-8`); }
  if (lines.pop() !== "" || lines.length < 3 || lines.some(line => line.length === 0)) fail(`${label} is incomplete`);
  const records = lines.map((line, index) => { try { return JSON.parse(line); }
    catch { fail(`${label} line ${index} is not JSON`); } });
  const frozen = loadFrozenM6Schedule(); const schedule = expectedJoin.selected_inputs.release.schedule;
  if (schedule.sha256 !== frozen.schedule.sha256 || schedule.event_count !== frozen.schedule.event_count ||
      metadata.m6_schedule.mapping_sha256 !== M6_FROZEN.mapping_sha256 ||
      expectedJoin.selected_inputs.release.identities.cadet_mapping_sha256 !== M6_FROZEN.mapping_sha256) {
    fail(`${label} does not bind the frozen Cadet mapping and M6 schedule`);
  }
  const expectedMeta = { kind: "meta", schema: "cadr-m6-native-raw-v2", schedule_sha256: schedule.sha256,
    schedule_events: schedule.event_count, session_id: metadata.session_id };
  const expectedComplete = { kind: "complete", clean_shutdown: true,
    schedule_consumed: schedule.event_count, debug_ir_writes: 9 };
  if (!sameJson(records[0], expectedMeta) || !sameJson(records.at(-1), expectedComplete)) {
    fail(`${label} does not bind the selected M6 schedule and clean completion`);
  }
  const body = records.slice(1, -1); const priority = { clock: 0, event: 1, write: 2, boundary: 3, settled: 4 };
  const effectiveField = { clock: "due_boundary", event: "due_boundary", write: "boundary", boundary: "ordinal", settled: "ordinal" };
  let priorBoundary = -1; let priorPriority = -1;
  for (const [index, item] of body.entries()) {
    if (!record(item) || !Object.hasOwn(priority, item.kind)) fail(`${label} has a fabricated or unsupported row ${index + 1}`);
    const effective = exactInteger(item[effectiveField[item.kind]], `${label} row ${index} effective boundary`, 0);
    if (effective < priorBoundary || (effective === priorBoundary && priority[item.kind] < priorPriority)) {
      fail(`${label} raw rows violate global guest-boundary priority chronology`);
    }
    priorBoundary = effective; priorPriority = priority[item.kind];
  }
  const events = body.filter(item => item.kind === "event");
  if (events.length !== frozen.events.length) fail(`${label} omits or adds frozen input events`);
  for (const [index, item] of events.entries()) {
    const expected = frozen.events[index]; const phase = { boot: 0, "form-a": 1, "form-b": 2 }[expected.phase];
    exactKeys(item, ["kind", "ordinal", "due_boundary", "scancode", "phase"], `${label} event ${index}`);
    if (item.kind !== "event" || item.ordinal !== expected.index || item.due_boundary !== Number(expected.due_boundary) ||
        item.scancode !== expected.scancode || item.phase !== phase) fail(`${label} event ${index} differs from the frozen M6 schedule`);
  }
  const writes = body.filter(item => item.kind === "write");
  if (writes.length !== 9) fail(`${label} does not contain exactly nine A/B/C writes`);
  const expectedWords = [...M6_FROZEN.forms.a, ...M6_FROZEN.forms.b, ...M6_FROZEN.forms.c];
  for (const [index, item] of writes.entries()) {
    exactKeys(item, ["kind", "boundary", "address", "value"], `${label} write ${index}`);
    if (item.boundary !== M6_FROZEN.write_boundaries[Math.floor(index / 3)][index % 3] ||
        item.address !== [257024, 257026, 257028][index % 3] || item.value !== expectedWords[index]) {
      fail(`${label} write ${index} differs from the exact ABC producer transcript`);
    }
  }
  const boundaries = body.filter(item => item.kind === "boundary").map((item, index) => rawState(item, `${label} boundary ${index}`));
  const settled = body.filter(item => item.kind === "settled").map((item, index) => rawSettled(item, `${label} settled ${index}`));
  if (boundaries.length !== 67 || settled.length !== 1) fail(`${label} omits exact ABC/suffix boundary or settled evidence`);
  const [a, b, c] = boundaries;
  if (!sameJson(a.debug_ir_words, M6_FROZEN.forms.a) || !sameJson(b.debug_ir_words, M6_FROZEN.forms.b) ||
      !sameJson(c.debug_ir_words, M6_FROZEN.forms.c) || a.ordinal !== M6_FROZEN.boundaries[0] ||
      b.ordinal !== M6_FROZEN.boundaries[1] || c.ordinal !== M6_FROZEN.boundaries[2] ||
      settled[0].ordinal !== M6_FROZEN.boundaries[3] || !sameJson(settled[0].debug_ir_words, M6_FROZEN.forms.c)) {
    fail(`${label} has noncanonical A/B/C/settled evidence`);
  }
  for (const point of [a, b, c, settled[0]]) requireRawQuiescence(point, `${label} exact boundary`);
  const lastAEvent = Number(frozen.events.filter(event => event.phase !== "form-b").at(-1).due_boundary);
  const firstBEvent = Number(frozen.events.find(event => event.phase === "form-b").due_boundary);
  if (!(lastAEvent < a.ordinal && a.ordinal < firstBEvent) || firstBEvent !== lastAEvent + 20000000 ||
      writes[8].boundary > writes[5].boundary + M6_FROZEN.listener_timeout) {
    fail(`${label} violates the exact Form-A/Form-B/Listener-idle chronology`);
  }
  const preAEventCount = frozen.events.filter(event => event.phase !== "form-b").length;
  if (!sameJson(a.state.completion, { schedule_consumed: preAEventCount, debug_ir_writes: 3 }) ||
      !sameJson(b.state.completion, { schedule_consumed: schedule.event_count, debug_ir_writes: 6 }) ||
      !sameJson(c.state.completion, { schedule_consumed: schedule.event_count, debug_ir_writes: 9 }) ||
      !sameJson(settled[0].state.completion, { schedule_consumed: schedule.event_count, debug_ir_writes: 9 })) {
    fail(`${label} boundary completion counters do not bind A/B/C`);
  }
  for (const [index, item] of boundaries.slice(3).entries()) {
    if (item.ordinal !== M6_FROZEN.boundaries[3] + index + 1 || !sameJson(item.debug_ir_words, M6_FROZEN.forms.c) ||
        !sameJson(item.state.completion, { schedule_consumed: schedule.event_count, debug_ir_writes: 9 })) {
      fail(`${label} suffix boundary ${index} is not the retained-C quiescent sequence`);
    }
    requireRawQuiescence(item, `${label} suffix boundary ${index}`);
  }
  const clocks = body.filter(item => item.kind === "clock");
  const expectedClockCount = Math.floor(((M6_FROZEN.boundaries[3] + 64) * 60) / 1000000);
  if (clocks.length !== expectedClockCount || expectedClockCount === 0) fail(`${label} has an incomplete clock transcript`);
  const clockPositions = new Map();
  for (const [index, item] of clocks.entries()) {
    exactKeys(item, ["kind", "ordinal", "due_boundary", "color_enabled", "policy"], `${label} clock ${index}`);
    if (item.ordinal !== index + 1 || item.due_boundary !== m6ClockDue(index + 1) || ![0, 1].includes(item.color_enabled) ||
        item.policy !== "ceil(n*1000000/60)") fail(`${label} clock ${index} is not the rational guest clock`);
  }
  body.forEach((item, index) => { if (item.kind === "clock") clockPositions.set(item.ordinal, index); });
  for (const [index, item] of body.entries()) if (item.kind === "event") {
    const ordinal = Math.floor((item.due_boundary * 60) / 1000000);
    if (ordinal > 0 && m6ClockDue(ordinal) === item.due_boundary && (clockPositions.get(ordinal) ?? body.length) > index) {
      fail(`${label} dispatches a coincident input before its guest clock`);
    }
  }
}

function validateAuthorityBuildReceipt(value, expectedJoin, label) {
  exactKeys(value, ["schema", "bytes", "sha256", "derivation", "output",
    "independent_selection", "yama_ptrace_scope", "build_environment",
    "source_closure", "guix_client", "authority"], label);
  if (value.schema !== "cadr-m8-m9-python-authority-build-v1" ||
      unsigned(value.bytes, `${label} bytes`) === 0 ||
      !digest(value.sha256, `${label} digest`) ||
      value.yama_ptrace_scope !== 3 ||
      typeof value.derivation !== "string" ||
      !/^\/gnu\/store\/[a-z0-9]+-[^/]+\.drv$/.test(value.derivation) ||
      typeof value.output !== "string" ||
      !/^\/gnu\/store\/[a-z0-9]+-cadr-m8-m9-python-seal-authority$/.test(value.output)) {
    fail(`${label} profile/store selection is malformed`);
  }
  exactKeys(value.independent_selection, ["derivation", "output"],
    `${label} independent selection`);
  if (value.independent_selection.derivation !== value.derivation ||
      value.independent_selection.output !== value.output) {
    fail(`${label} was not independently re-evaluated`);
  }
  const expectedEnvironment = {
    CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
    CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
    CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
    LANG: "C", LC_ALL: "C", TZ: "UTC",
  };
  if (!sameJson(value.build_environment, expectedEnvironment)) {
    fail(`${label} Guix environment is not closed and exact`);
  }
  exactKeys(value.source_closure, ["schema", "files", "sha256"],
    `${label} source closure`);
  const expectedRoles = new Map([
    ["builder-wrapper", "scripts/build-cadr-m8-m9-python-authority.sh"],
    ["builder", "scripts/build-cadr-m8-m9-python-authority.mjs"],
    ["derivation", "scripts/cadr-m8-m9-python-seal-authority.scm"],
    ["launcher-source", "scripts/cadr-m8-m9-python-seal-launcher.c"],
    ["guard-source", "scripts/cadr-m8-m9-prepython-guard.c"],
    ["bootstrap-source", "scripts/cadr-m8-m9-captured-python-bootstrap.py"],
  ]);
  const closureFiles = new Map(expectedJoin.source_closure.files.map(item =>
    [item.path, item]));
  if (value.source_closure.schema !==
        "cadr-m8-m9-python-authority-source-closure-v1" ||
      !Array.isArray(value.source_closure.files) ||
      value.source_closure.files.length !== expectedRoles.size ||
      value.source_closure.sha256 !== sha256(Buffer.from(
        `${canonicalJson({ files: value.source_closure.files })}\n`))) {
    fail(`${label} source closure is incomplete`);
  }
  for (const item of value.source_closure.files) {
    exactKeys(item, ["role", "path", "bytes", "sha256"],
      `${label} source`);
    const expectedPath = expectedRoles.get(item.role);
    const joined = closureFiles.get(item.path);
    if (expectedPath !== item.path || joined?.bytes !== item.bytes ||
        joined?.sha256 !== item.sha256) {
      fail(`${label} does not bind the joined reviewed source bytes`);
    }
    expectedRoles.delete(item.role);
  }
  if (expectedRoles.size !== 0) fail(`${label} omits reviewed build sources`);
  exactKeys(value.guix_client, ["path", "identity", "ancestry"],
    `${label} Guix client`);
  exactKeys(value.guix_client.identity,
    ["bytes", "sha256", "device", "inode"], `${label} Guix identity`);
  if (typeof value.guix_client.path !== "string" ||
      !value.guix_client.path.startsWith("/gnu/store/") ||
      unsigned(value.guix_client.identity.bytes,
        `${label} Guix bytes`) === 0 ||
      !digest(value.guix_client.identity.sha256,
        `${label} Guix digest`)) {
    fail(`${label} Guix client is incomplete`);
  }
  immutableAncestry(value.guix_client.ancestry, `${label} Guix client`);
  exactKeys(value.authority, ["bootstrap", "launcher", "guard"],
    `${label} output`);
  exactKeys(value.authority.bootstrap,
    ["bytes", "sha256", "device", "inode"], `${label} bootstrap`);
  for (const field of ["launcher", "guard"]) {
    exactKeys(value.authority[field], ["identity", "elf"],
      `${label} ${field}`);
    exactKeys(value.authority[field].identity,
      ["bytes", "sha256", "device", "inode"], `${label} ${field} identity`);
    exactKeys(value.authority[field].elf, ["elf_class", "data", "version",
      "osabi", "type", "machine", "entry", "program_header_types",
      "has_pt_interp", "has_pt_dynamic"], `${label} ${field} ELF`);
  }
  const launcherElf = value.authority.launcher.elf;
  const guardElf = value.authority.guard.elf;
  if (launcherElf.elf_class !== "ELF64" ||
      launcherElf.data !== "little-endian" || launcherElf.type !== 2 ||
      launcherElf.machine !== "x86-64" ||
      launcherElf.has_pt_interp !== false ||
      launcherElf.has_pt_dynamic !== false ||
      guardElf.elf_class !== "ELF64" ||
      guardElf.data !== "little-endian" || guardElf.type !== 3 ||
      guardElf.machine !== "x86-64" ||
      guardElf.has_pt_interp !== false ||
      guardElf.has_pt_dynamic !== true) {
    fail(`${label} launcher/guard ELF identities are nonconforming`);
  }
  const canonicalBuild = {
    schema: value.schema,
    yama_ptrace_scope: value.yama_ptrace_scope,
    guix_client: value.guix_client,
    build_environment: value.build_environment,
    source_closure: value.source_closure,
    derivation: value.derivation,
    output: value.output,
    authority: value.authority,
  };
  const bytes = Buffer.from(`${canonicalJson(canonicalBuild)}\n`);
  if (bytes.byteLength !== value.bytes || sha256(bytes) !== value.sha256) {
    fail(`${label} digest does not commit its canonical build result`);
  }
  return value;
}

const NATIVE_PYTHON_PERMIT = Object.freeze([
  "scripts/cadr-m6-native-oracle.py",
  "scripts/cadr-m6-witness-schedule.py",
  "scripts/cadr-m7-native-frame-oracle.py",
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "scripts/cadr-oracle.py", "scripts/cadr_oracle_trace.py",
  "scripts/verify-cadr-web-profile.py",
]);
const PREPARED_EXECUTABLES = Object.freeze([
  "source/usim/usim", "source/usim/usim-m8-m9-direct",
  "source/usim/usim-m8-m9-x11-witness",
]);
const NATIVE_PERMIT_TAIL_ROLES = Object.freeze([
  "isolated-native-output", "native-input-script", "native-campaign",
  "native-configuration-input-0", "native-configuration-input-1",
  "native-configuration-input-2", "native-configuration-input-3",
  "native-configuration-input-4", "selected-profile",
  "selected-configuration-template", "selected-m6-release-record",
  "selected-m8-m9-patch", "selected-cadet-mapping",
]);
const BWRAP_SYNTHETIC_DEV = Object.freeze({
  schema: "bubblewrap-synthetic-dev-v1", option: "--dev /dev",
  entries: Object.freeze([
    "core:symlink:/proc/kcore", "fd:symlink:/proc/self/fd",
    "full:char:0666", "null:char:0666", "ptmx:symlink:pts/ptmx",
    "pts:directory:0755", "pts/ptmx:char:0666", "random:char:0666",
    "shm:directory:0755", "stderr:symlink:/proc/self/fd/2",
    "stdin:symlink:/proc/self/fd/0", "stdout:symlink:/proc/self/fd/1",
    "tty:char:0666", "urandom:char:0666", "zero:char:0666",
  ]),
});
const STORE_ITEM_PATTERN = /^\/gnu\/store\/[a-z0-9]{32}-[^/]+$/;

function validatePermitIdentity(value, { directory }, label) {
  const fields = directory ? ["device", "inode"] :
    ["bytes", "sha256", "device", "inode"];
  exactKeys(value, fields, label);
  for (const field of fields) {
    if (field === "bytes") unsigned(value[field], `${label} bytes`);
    else if (field === "sha256") digest(value[field], `${label} digest`);
    else decimal(value[field], `${label} ${field}`, { zero: field !== "inode" });
  }
  return value;
}

function validateGuixRuntimeClosure(value, label) {
  exactKeys(value, ["schema", "seed", "paths", "sha256"], label);
  if (value.schema !== "cadr-m8-m9-guix-runtime-closure-v1" ||
      !Array.isArray(value.paths) || value.paths.length === 0 ||
      !sameJson(value.paths, [...new Set(value.paths)].sort()) ||
      !STORE_ITEM_PATTERN.test(value.seed) || !value.paths.includes(value.seed) ||
      value.paths.some(path => !STORE_ITEM_PATTERN.test(path))) {
    fail(`${label} does not select one canonical Guix runtime closure`);
  }
  if (digest(value.sha256, `${label}.sha256`) !==
      sha256(Buffer.from(`${canonicalJson({ seed: value.seed, paths: value.paths })}\n`))) {
    fail(`${label} digest differs from its canonical path set`);
  }
  return value;
}

function validatePreparedFileClosure(value, label) {
  exactKeys(value, ["schema", "root", "executable_paths", "files", "file_count", "sha256"], label);
  if (value.schema !== "cadr-m8-m9-prepared-file-closure-v1" ||
      typeof value.root !== "string" || !value.root.startsWith("/") ||
      resolve(value.root) !== value.root || value.root.includes("\0") ||
      !sameJson(value.executable_paths, PREPARED_EXECUTABLES) ||
      !Array.isArray(value.files) || value.files.length === 0 ||
      value.file_count !== value.files.length || !Number.isSafeInteger(value.file_count)) {
    fail(`${label} is not the selected prepared-file closure`);
  }
  const paths = new Set(); const destinations = new Set(); let priorPath = null;
  for (const [index, file] of value.files.entries()) {
    exactKeys(file, ["path", "destination", "executable", "bytes", "sha256", "device", "inode"],
      `${label} file ${index}`);
    if (typeof file.path !== "string" || file.path.length === 0 || file.path.includes("\0") ||
        file.path.split("/").some(part => part === "" || part === "." || part === "..") ||
        typeof file.destination !== "string" || file.destination !== resolve(value.root, file.path) ||
        typeof file.executable !== "boolean" ||
        file.executable !== PREPARED_EXECUTABLES.includes(file.path) ||
        paths.has(file.path) || destinations.has(file.destination) ||
        (priorPath !== null && priorPath >= file.path)) {
      fail(`${label} file ${index} is malformed or noncanonical`);
    }
    validatePermitIdentity({ bytes: file.bytes, sha256: file.sha256,
      device: file.device, inode: file.inode }, { directory: false },
    `${label} file ${index} identity`);
    paths.add(file.path); destinations.add(file.destination); priorPath = file.path;
  }
  if (!PREPARED_EXECUTABLES.every(path => paths.has(path)) ||
      digest(value.sha256, `${label}.sha256`) !==
        sha256(Buffer.from(`${canonicalJson({ files: value.files })}\n`))) {
    fail(`${label} differs from its canonical prepared-file receipt`);
  }
  return value;
}

export function validateFilesystemPermit(value, label = "filesystem permit") {
  exactKeys(value, ["schema", "repository_root_visible", "selected_python_programs",
    "guix_runtime_closure", "prepared_file_closure", "synthetic_dev", "mounts"], label);
  if (value.schema !== "cadr-m8-m9-native-filesystem-permit-v1" ||
      value.repository_root_visible !== false ||
      !sameJson(value.selected_python_programs, NATIVE_PYTHON_PERMIT) ||
      !sameJson(value.synthetic_dev, BWRAP_SYNTHETIC_DEV) || !Array.isArray(value.mounts)) {
    fail(`${label} is not the selected seven-key permit-only closure`);
  }
  const runtimeStore = validateGuixRuntimeClosure(value.guix_runtime_closure,
    `${label} Guix runtime closure`);
  const prepared = validatePreparedFileClosure(value.prepared_file_closure,
    `${label} prepared file closure`);
  const preparedRoles = prepared.files.map(file => `prepared-file:${file.path}`);
  const storeRoles = runtimeStore.paths.map(path =>
    `guix-runtime-store:${path.slice("/gnu/store/".length)}`);
  const roles = ["native-configuration", ...preparedRoles, ...storeRoles,
    ...NATIVE_PERMIT_TAIL_ROLES];
  if (value.mounts.length !== roles.length) {
    fail(`${label} mount count differs from its dynamic closure groups`);
  }
  const destinations = new Set();
  for (const [index, mount] of value.mounts.entries()) {
    exactKeys(mount, ["role", "destination", "access", "type", "identity"],
      `${label} mount ${index}`);
    const expectedRole = roles[index];
    const preparedIndex = preparedRoles.indexOf(expectedRole);
    const storeIndex = storeRoles.indexOf(expectedRole);
    const isOutput = expectedRole === "isolated-native-output";
    const expectedFile = preparedIndex >= 0 ? prepared.files[preparedIndex] : null;
    const expectedStore = storeIndex >= 0 ? runtimeStore.paths[storeIndex] : null;
    if (mount.role !== expectedRole || typeof mount.destination !== "string" ||
        !mount.destination.startsWith("/") || resolve(mount.destination) !== mount.destination ||
        destinations.has(mount.destination) ||
        mount.access !== (isOutput ? "read-write-output" : "read-only") ||
        mount.type !== (isOutput || expectedStore !== null ? "directory" : "file") ||
        (expectedFile !== null && (!sameJson(mount.identity, {
          bytes: expectedFile.bytes, sha256: expectedFile.sha256,
          device: expectedFile.device, inode: expectedFile.inode,
        }) || mount.destination !== expectedFile.destination)) ||
        (expectedStore !== null && mount.destination !== expectedStore)) {
      fail(`${label} mount ${index} differs from its dynamic closure group`);
    }
    validatePermitIdentity(mount.identity, { directory: mount.type === "directory" },
      `${label} mount ${index} identity`);
    destinations.add(mount.destination);
  }
  return value;
}

function validateNativeMetadata(value, expectedJoin, script, witness, transcript, idle, label) {
  exactKeys(value, ["schema", "target", "session_id", "private_disk_instance_id", "source",
    "m6_release_record", "patches", "prepared", "runtime_provenance", "artifacts", "native_inputs",
    "m6_schedule", "campaign", "private_disk", "process", "transcript"], label);
  const selected = expectedJoin.selected_inputs; const native = expectedJoin.native_x11_closure;
  if (value.schema !== "cadr-m8-m9-native-input-capture-v1" ||
      value.target !== "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9") {
    fail(`${label} schema/target differs`);
  }
  exactKeys(value.source, ["system_fossil", "usim_fossil"], `${label} source`);
  if (value.source.system_fossil !== selected.profile.source_pins.sys.revision ||
      value.source.usim_fossil !== selected.profile.source_pins.usim.revision) {
    fail(`${label} source pins differ from the selected profile`);
  }
  exactIdentity(value.m6_release_record, { path: selected.release.path, bytes: selected.release.bytes,
    sha256: selected.release.sha256 }, `${label} M6 release record`);
  exactKeys(value.patches, ["m7_prepare_sha256", "m8_m9_sha256", "m8_m9_support"], `${label} patches`);
  if (value.patches.m7_prepare_sha256 !== native.prepare_record.m7_prepare_sha256 ||
      value.patches.m8_m9_sha256 !== native.patch.sha256 ||
      !sameJson(value.patches.m8_m9_support, native.prepare_record.m8_m9_native_support)) {
    fail(`${label} M7/M8/M9 patch closure differs`);
  }
  exactKeys(value.prepared, ["path", "source_tree_sha256", "source_file_count", "executable"],
    `${label} prepared closure`);
  if (value.prepared.path !== native.prepared_root ||
      value.prepared.source_tree_sha256 !== native.prepared_source_tree_sha256 ||
      value.prepared.source_file_count !== native.prepared_source_file_count ||
      !sameJson(value.prepared.executable, native.build_record)) {
    fail(`${label} prepared source/build marker differs`);
  }
  if (!sameJson(value.artifacts, selected.release.artifacts) ||
      !sameJson(value.native_inputs, selected.release.native_inputs)) {
    fail(`${label} selected artifact/native-input closure differs`);
  }
  exactKeys(value.m6_schedule, ["sha256", "event_count", "mapping_sha256"], `${label} M6 schedule`);
  if (value.m6_schedule.sha256 !== selected.release.schedule.sha256 ||
      value.m6_schedule.event_count !== selected.release.schedule.event_count ||
      !digest(value.m6_schedule.mapping_sha256, `${label} M6 mapping`) ||
      value.m6_schedule.mapping_sha256 !== selected.release.identities.cadet_mapping_sha256) {
    fail(`${label} selected M6 schedule differs`);
  }
  exactKeys(value.private_disk, ["sha256_at_start", "sha256_at_end"], `${label} private disk`);
  const disk = selected.release.artifacts.find(item => item.kind === 3);
  if (value.private_disk.sha256_at_start !== disk?.sha256 || value.private_disk.sha256_at_end !== disk?.sha256) {
    fail(`${label} private disk is not the selected immutable base copy`);
  }
  exactKeys(value.runtime_provenance, ["python", "program", "rendered_config",
    "private_executable", "child_argv", "child_environment"],
    `${label} runtime provenance`);
  exactKeys(value.runtime_provenance.python, ["schema", "source_fd",
    "transport", "bytes", "sha256", "device", "inode",
    "sys_executable", "proc_self_exe", "version", "implementation",
    "executable_ancestry", "prepython_seal"],
    `${label} Python identity`);
  const python = value.runtime_provenance.python;
  if (python.schema !== "cadr-m8-m9-python-identity-v3" ||
      python.source_fd !== 3 || python.transport !== "bwrap-ro-bind-fd" ||
      unsigned(python.bytes, `${label} Python bytes`) === 0 ||
      !digest(python.sha256, `${label} Python digest`) ||
      !decimal(python.device, `${label} Python device`) || !decimal(python.inode, `${label} Python inode`, { zero: false }) ||
      typeof python.version !== "string" || typeof python.implementation !== "string") {
    fail(`${label} Python/toolchain identity is incomplete`);
  }
  for (const [field, reference] of [["sys_executable", "sys-executable"], ["proc_self_exe", "proc-self-exe"]]) {
    exactKeys(python[field], ["reference", "bytes", "sha256", "device", "inode"], `${label} Python ${field}`);
    if (python[field].reference !== reference || python[field].bytes !== python.bytes ||
        python[field].sha256 !== python.sha256) {
      fail(`${label} Python ${field} differs from the read-only bound executable`);
    }
  }
  immutableAncestry(python.executable_ancestry,
    `${label} Python executable`);
  exactKeys(python.prepython_seal, ["dumpable", "no_new_privileges",
    "core_soft", "core_hard", "yama_ptrace_scope",
    "authority_build_receipt", "filesystem_permit", "importer_isolation",
    "stdlib_roots", "loader_files", "bootstrap", "launcher", "guard"],
  `${label} pre-Python seal`);
  if (python.prepython_seal.dumpable !== 0 ||
      python.prepython_seal.no_new_privileges !== 1 ||
      python.prepython_seal.core_soft !== 0 ||
      python.prepython_seal.core_hard !== 0 ||
      python.prepython_seal.yama_ptrace_scope !== 3) {
    fail(`${label} pre-Python seal controls are incomplete`);
  }
  const authorityReceipt = validateAuthorityBuildReceipt(
    python.prepython_seal.authority_build_receipt, expectedJoin,
    `${label} authority build receipt`);
  if (python.prepython_seal.yama_ptrace_scope !==
      authorityReceipt.yama_ptrace_scope) {
    fail(`${label} runtime Yama policy differs from the authority receipt`);
  }
  validateFilesystemPermit(python.prepython_seal.filesystem_permit,
    `${label} filesystem permit`);
  exactKeys(python.prepython_seal.importer_isolation,
    ["sys_path", "meta_path", "path_hooks",
      "approved_non_file_importers", "archive_paths"],
    `${label} importer isolation`);
  const importer = python.prepython_seal.importer_isolation;
  if (!Array.isArray(importer.sys_path) || importer.sys_path.length < 1 ||
      importer.sys_path.some(path => typeof path !== "string" ||
        !path.startsWith("/") || /\.(?:zip|egg|whl)$/i.test(path)) ||
      !sameJson(importer.meta_path, [
        "_frozen_importlib.BuiltinImporter",
        "_frozen_importlib.FrozenImporter",
        "_frozen_importlib_external.PathFinder",
      ]) ||
      !sameJson(importer.path_hooks, [
        "_frozen_importlib_external.FileFinder.path_hook.<locals>.path_hook_for_FileFinder",
      ]) ||
      !sameJson(importer.approved_non_file_importers, [
        "_frozen_importlib.BuiltinImporter",
        "_frozen_importlib.FrozenImporter",
      ]) || !sameJson(importer.archive_paths, [])) {
    fail(`${label} Python importer surface is not isolated and archive-free`);
  }
  for (const field of ["bootstrap", "launcher", "guard"]) {
    exactKeys(python.prepython_seal[field],
      ["bytes", "sha256", "device", "inode"],
      `${label} pre-Python ${field}`);
    if (unsigned(python.prepython_seal[field].bytes,
        `${label} pre-Python ${field} bytes`) === 0 ||
        !digest(python.prepython_seal[field].sha256,
          `${label} pre-Python ${field} digest`) ||
        !decimal(python.prepython_seal[field].device,
          `${label} pre-Python ${field} device`) ||
        !decimal(python.prepython_seal[field].inode,
          `${label} pre-Python ${field} inode`, { zero: false })) {
      fail(`${label} pre-Python ${field} identity is incomplete`);
    }
    const receiptIdentity = field === "bootstrap"
      ? authorityReceipt.authority.bootstrap
      : authorityReceipt.authority[field].identity;
    if (!sameJson(python.prepython_seal[field], receiptIdentity)) {
      fail(`${label} pre-Python ${field} differs from the authority receipt`);
    }
  }
  if (!Array.isArray(python.prepython_seal.stdlib_roots) ||
      python.prepython_seal.stdlib_roots.length < 1) {
    fail(`${label} pre-Python standard-library roots are absent`);
  }
  for (const root of python.prepython_seal.stdlib_roots) {
    exactKeys(root, ["path", "ancestry"],
      `${label} standard-library root`);
    if (typeof root.path !== "string" || !root.path.startsWith("/")) {
      fail(`${label} standard-library root is mutable or incomplete`);
    }
    immutableAncestry(root.ancestry, `${label} standard-library root`);
  }
  if (!sameJson(python.prepython_seal.stdlib_roots.map(root => root.path),
      importer.sys_path)) {
    fail(`${label} Python sys.path differs from immutable stdlib roots`);
  }
  if (!Array.isArray(python.prepython_seal.loader_files) ||
      python.prepython_seal.loader_files.length < 1) {
    fail(`${label} standard-library file closure is absent`);
  }
  for (const file of python.prepython_seal.loader_files) {
    exactKeys(file, ["path", "ancestry", "file"],
      `${label} standard-library file`);
    if (typeof file.path !== "string" || !file.path.startsWith("/")) {
      fail(`${label} standard-library file path is malformed`);
    }
    immutableAncestry(file.ancestry, `${label} standard-library file`);
    exactKeys(file.file, ["bytes", "sha256", "uid", "gid", "mode",
      "device", "inode"], `${label} standard-library file identity`);
    if (unsigned(file.file.bytes, `${label} standard-library file bytes`) < 0 ||
        !digest(file.file.sha256, `${label} standard-library file digest`)) {
      fail(`${label} standard-library file identity is incomplete`);
    }
  }
  exactKeys(value.runtime_provenance.program, ["schema", "inherited_fd",
    "transport", "bytes", "sha256", "closure_sha256"],
    `${label} Python program identity`);
  const program = value.runtime_provenance.program;
  const expectedProgram = expectedJoin.native_python_closure.files.find(item =>
    item.path === expectedJoin.native_python_closure.root);
  if (program.schema !== "cadr-m8-m9-python-program-identity-v2" ||
      program.inherited_fd !== 4 || program.bytes !== expectedProgram?.bytes ||
      program.sha256 !== expectedProgram?.sha256 ||
      program.transport !== "bwrap-ro-bind-data-from-one-shot-pipe" ||
      program.closure_sha256 !== expectedJoin.native_python_closure.sha256) {
    fail(`${label} Python program differs from the captured native closure root`);
  }
  exactKeys(value.runtime_provenance.rendered_config, ["bytes", "sha256"], `${label} rendered config`);
  if (unsigned(value.runtime_provenance.rendered_config.bytes, `${label} rendered config bytes`) === 0 ||
      !digest(value.runtime_provenance.rendered_config.sha256, `${label} rendered config digest`)) {
    fail(`${label} rendered private config is not identified`);
  }
  exactKeys(value.runtime_provenance.private_executable, ["sha256_at_start", "sha256_at_exec", "sha256_at_end"],
    `${label} private executable`);
  if (Object.values(value.runtime_provenance.private_executable).some(hash => hash !== native.direct_witness.sha256)) {
    fail(`${label} private executable differs across copy/exec/exit`);
  }
  /* These absolute strings are capture-time provenance only.  The verifier
   * never resolves, opens, or treats child_argv/environment path strings as
   * locators; all dereferenced receipt paths are separately confined below. */
  if (!Array.isArray(value.runtime_provenance.child_argv) || value.runtime_provenance.child_argv.length !== 3 ||
      value.runtime_provenance.child_argv[1] !== "-c" ||
      value.runtime_provenance.child_argv.some(item => typeof item !== "string" || item.length === 0)) {
    fail(`${label} child argv provenance is malformed`);
  }
  const environment = value.runtime_provenance.child_environment;
  const environmentKeys = ["LANG", "LC_ALL", "TZ", "CADR_M6_RAW_SCHEDULE", "CADR_M6_NATIVE_LOG",
    "CADR_M6_IDLE_SAMPLES", "CADR_M6_SESSION_ID", "CADR_M8_M9_INPUT_SCRIPT", "CADR_M8_M9_INPUT_WITNESS"];
  exactKeys(environment, environmentKeys, `${label} child environment`);
  if (environment.LANG !== "C" || environment.LC_ALL !== "C" || environment.TZ !== "UTC" ||
      environment.CADR_M6_SESSION_ID !== value.session_id ||
      environmentKeys.slice(3, -1).some(key => typeof environment[key] !== "string" || environment[key].length === 0) ||
      typeof environment.CADR_M8_M9_INPUT_WITNESS !== "string" || environment.CADR_M8_M9_INPUT_WITNESS.length === 0) {
    fail(`${label} child environment provenance is incomplete`);
  }
  exactKeys(value.campaign, ["schema", "key_count", "native_row_count", "browser_record_count",
    "input_script_sha256", "input_script_bytes", "native_witness"], `${label} campaign`);
  if (value.campaign.schema !== "cadr-m8-m9-input-campaign-v1" || value.campaign.key_count !== 100 ||
      value.campaign.native_row_count !== 207 || value.campaign.browser_record_count !== 208 ||
      value.campaign.input_script_sha256 !== script.sha256 || value.campaign.input_script_bytes !== script.bytes ||
      !sameJson(value.campaign.native_witness, witness)) {
    fail(`${label} campaign/witness linkage differs`);
  }
  exactKeys(value.process, ["returncode", "timed_out", "forced_stop", "state_may_be_incomplete", "pending_host_requests"],
    `${label} process`);
  if (value.process.returncode !== 0 || value.process.timed_out !== false || value.process.forced_stop !== false ||
      value.process.state_may_be_incomplete !== false || value.process.pending_host_requests !== 0) {
    fail(`${label} native process did not cleanly finish`);
  }
  exactKeys(value.transcript, ["sha256", "idle_samples_sha256"], `${label} transcript`);
  if (value.transcript.sha256 !== transcript.sha256 || value.transcript.idle_samples_sha256 !== idle.sha256 ||
      idle.bytes === 0) fail(`${label} transcript/idle receipt differs`);
  validateM6Idle(idle.content, `${label} idle samples`);
  validateNativeTranscript(transcript, value, expectedJoin, `${label} transcript`);
}
function validateWorkerLog(identity, sessionId, consumptionBoundaries, label) {
  let lines;
  try { lines = new TextDecoder("utf-8", { fatal: true }).decode(identity.content).split("\n"); }
  catch { fail(`${label} is not UTF-8`); }
  if (lines.pop() !== "" || lines.length < 2) fail(`${label} is incomplete`);
  const log = lines.map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`${label} line ${index} is not JSON`); }
  });
  if (!sameJson(log[0], { schema: "cadr-m8-m9-portable-session-v1", session_id: sessionId })) {
    fail(`${label} header does not bind its portable session`);
  }
  const counts = new Map();
  for (const [index, entry] of log.slice(1).entries()) {
    exactKeys(entry, ["session_id", "id", "op", "status", "lifecycle"], `${label} entry ${index}`);
    if (entry.session_id !== sessionId || entry.id !== index + 1 || typeof entry.op !== "string" ||
        entry.op.length === 0 || entry.status !== 0 ||
        (entry.lifecycle !== null && typeof entry.lifecycle !== "string")) {
      fail(`${label} does not record a successful ordered protocol response`);
    }
    counts.set(entry.op, (counts.get(entry.op) ?? 0) + 1);
  }
  if (log[1]?.op !== "instantiate" || !Array.isArray(consumptionBoundaries) ||
      consumptionBoundaries.length !== 100) fail(`${label} lacks the producer's instantiate/consumption prefix`);
  /* M6 boot has its own source-bound protocol trace.  Its end is the first
   * post-boot input-state receipt.  Everything after that point is a fixed
   * M8/M9 request sequence including every bounded consumer step, so an extra
   * or reordered successful response cannot masquerade as the campaign. */
  let position = log.findIndex((entry, index) => index > 1 && entry.op === "input-state");
  if (position < 2) fail(`${label} omits the M6 READY input-state boundary`);
  position += 1;
  let consumptionIndex = 0;
  for (const operation of buildCadrM8M9Campaign().browserOperations) {
    if (log[position]?.op !== operation.op || log[position + 1]?.op !== "input-state") {
      fail(`${label} differs from the exact M8/M9 worker campaign order at ${operation.label}`);
    }
    position += 2;
    if (operation.op === "keyboard-up") {
      const runs = consumptionBoundaries[consumptionIndex]?.runs;
      if (log[position]?.op !== "scheduler-start" || !Array.isArray(runs) || runs.length < 1) {
        fail(`${label} omits the bounded consumer start for keyboard pair ${consumptionIndex}`);
      }
      position += 1;
      for (let index = 0; index < runs.length; index += 1) {
        if (log[position]?.op !== "scheduler-run" || log[position + 1]?.op !== "input-state") {
          fail(`${label} differs from the exact consumer run/input-state order for keyboard pair ${consumptionIndex}`);
        }
        position += 2;
      }
      if (log[position]?.op !== "scheduler-pause") {
        fail(`${label} omits the bounded consumer pause for keyboard pair ${consumptionIndex}`);
      }
      position += 1; consumptionIndex += 1;
    }
  }
  if (consumptionIndex !== 100 || !sameJson(log.slice(position).map(entry => entry.op),
    ["m6-disk-evidence-summary", "pointer-state", "keyboard-down", "pointer-down", "pointer-neutralize", "keyboard-state", "pointer-state", "input-state"])) {
    fail(`${label} has an extra, missing, or reordered shared-deactivation suffix`);
  }
  return Object.freeze({ entries: log.length - 1, operation_counts: Object.freeze(Object.fromEntries(counts)) });
}
function stateRecord(value, label) {
  exactKeys(value, ["csr", "scancode", "mouse_x", "mouse_y", "input_sequence",
    "keyboard_fifo_count", "ingress_ordinal", "generation", "lifecycle"], label);
  for (const key of ["csr", "scancode", "mouse_x", "mouse_y", "input_sequence",
    "keyboard_fifo_count", "lifecycle"]) unsigned(value[key], `${label}.${key}`);
  decimal(value.ingress_ordinal, `${label}.ingress_ordinal`);
  decimal(value.generation, `${label}.generation`, { zero: false });
  if (value.lifecycle !== 2) fail(`${label}.lifecycle is not running`);
  return value;
}
function runtimeState(value, label) {
  stateRecord(value, label);
  return Object.freeze({ csr: value.csr, scancode: value.scancode, mouseX: value.mouse_x,
    mouseY: value.mouse_y, inputSequence: value.input_sequence,
    keyboardFifoCount: value.keyboard_fifo_count, ingressOrdinal: BigInt(value.ingress_ordinal),
    generation: BigInt(value.generation), lifecycle: value.lifecycle });
}
function equalRuntimeState(left, right) {
  return ["csr", "scancode", "mouseX", "mouseY", "inputSequence", "keyboardFifoCount",
    "ingressOrdinal", "generation", "lifecycle"].every(field => left[field] === right[field]);
}
function expectedInputState(prior, record) {
  const next = { ...prior, inputSequence: (prior.inputSequence + 1) >>> 0,
    ingressOrdinal: record.ordinal };
  if (record.kind === 1) {
    if ((prior.csr & (1 << 5)) === 0) {
      next.scancode = (0x10000 | record.payload) >>> 0;
      if ((prior.csr & (1 << 2)) !== 0) next.csr = (prior.csr | (1 << 5)) >>> 0;
    } else next.keyboardFifoCount = (prior.keyboardFifoCount + 1) >>> 0;
  } else if (record.kind === 2) {
    next.mouseX = record.payload & 0x3ff;
    next.mouseY = ((record.payload >>> 10) & 0x3ff) | (((record.payload >>> 20) & 7) << 12);
    next.csr = (prior.csr | (1 << 4)) >>> 0;
  } else fail("CDRINP-derived state has an unknown input kind");
  return Object.freeze(next);
}
function validateConsumptionBoundary(value, expectedInitial, pair, index, label) {
  exactKeys(value, ["label", "outcome", "run_count", "scheduler_started", "scheduler_paused",
    "allowed_scancodes", "allowed_mutations", "initial", "final", "runs"], `${label} ${index}`);
  if (value.label !== pair.label || value.outcome !== "keyboard-iob-quiescent" ||
      !Number.isSafeInteger(value.run_count) || value.run_count < 1 ||
      value.scheduler_started !== true || value.scheduler_paused !== true ||
      !Array.isArray(value.runs) || value.runs.length !== value.run_count ||
      !Array.isArray(value.allowed_scancodes) || !Array.isArray(value.allowed_mutations)) {
    fail(`${label} ${index} has an incomplete keyboard-consumption receipt`);
  }
  const initial = runtimeState(value.initial, `${label} ${index} initial`);
  if (!equalRuntimeState(initial, expectedInitial)) fail(`${label} ${index} initial state is not CDRINP-derived`);
  const allowed = [...new Set([initial.scancode, (0x10000 | pair.down.payload) >>> 0,
    (0x10000 | pair.up.payload) >>> 0])];
  if (!sameJson(value.allowed_scancodes, allowed) || !sameJson(value.allowed_mutations, [
    "csr keyboard-ready bit", "keyboard FIFO count", "scancode within the just-delivered down/all-up pair",
  ])) fail(`${label} ${index} allowed transition set differs from the worker producer`);
  let prior = initial;
  for (const [runIndex, run] of value.runs.entries()) {
    exactKeys(run, ["attempt", "requested_clock_slots", "status", "completed_slots", "microinstructions_executed", "state"],
      `${label} ${index} run ${runIndex}`);
    if (run.attempt !== runIndex + 1 || run.requested_clock_slots !== 8192 || run.status !== 0 ||
        typeof run.completed_slots !== "string" || typeof run.microinstructions_executed !== "string") {
      fail(`${label} ${index} run ${runIndex} is not a successful bounded consumer step`);
    }
    const next = runtimeState(run.state, `${label} ${index} run ${runIndex} state`);
    if (next.generation !== initial.generation || next.ingressOrdinal !== initial.ingressOrdinal ||
        next.inputSequence !== initial.inputSequence || next.lifecycle !== initial.lifecycle ||
        next.mouseX !== initial.mouseX || next.mouseY !== initial.mouseY ||
        (next.csr & ~(1 << 5)) !== (initial.csr & ~(1 << 5)) || !allowed.includes(next.scancode)) {
      fail(`${label} ${index} run ${runIndex} changes an invariant input field`);
    }
    prior = next;
  }
  const final = runtimeState(value.final, `${label} ${index} final`);
  if (!equalRuntimeState(final, prior) || (final.csr & (1 << 5)) !== 0 || final.keyboardFifoCount !== 0) {
    fail(`${label} ${index} does not finish in keyboard-IOB quiescence`);
  }
  return Object.freeze({ final, runCount: value.run_count });
}
function cdrinpStream(bytes, label) {
  if (bytes.byteLength !== 208 * 40) fail(`${label} has a noncanonical CDRINP1 extent`);
  const records = [];
  for (let index = 0; index !== 208; index += 1) {
    const at = index * 40; const row = bytes.subarray(at, at + 40); const view = new DataView(row.buffer, row.byteOffset, row.byteLength);
    if (new TextDecoder().decode(row.subarray(0, 7)) !== "CDRINP1" || row[7] !== 0 ||
        view.getUint16(8, true) !== 1 || ![1, 2].includes(view.getUint16(10, true)) ||
        view.getUint32(12, true) !== 0 || view.getBigUint64(24, true) !== BigInt(index + 1) ||
        view.getUint32(36, true) !== 0) fail(`${label} CDRINP1 record ${index} is malformed`);
    records.push(Object.freeze({ kind: view.getUint16(10, true), generation: view.getBigUint64(16, true).toString(),
      ordinal: (index + 1).toString(), payload: view.getUint32(32, true), bytes: row.slice(),
      sha256: sha256(row) }));
  }
  const generation = records[0].generation;
  if (records.some(item => item.generation !== generation)) fail(`${label} mixes CDRINP1 generations`);
  return Object.freeze({ records: Object.freeze(records), generation });
}
function nativeScriptRows(bytes, label) {
  let text;
  try { text = new TextDecoder("ascii", { fatal: true }).decode(bytes); }
  catch { fail(`${label} is not ASCII`); }
  const rows = text.split("\n");
  if (rows.pop() !== "" || rows.shift() !== "CADR-M8-M9-INPUT-v1" || rows.length !== 207) {
    fail(`${label} has a noncanonical input-script extent`);
  }
  let prior = -1n;
  return rows.map((line, ordinal) => {
    const fields = line.split(" ");
    if (fields.length !== 5 || !/^[1-9][0-9]*$/.test(fields[0]) ||
        !["keyboard", "pointer"].includes(fields[1]) ||
        fields.slice(2).some(field => !/^[0-9]+$/.test(field))) fail(`${label} row ${ordinal} is malformed`);
    const boundary = BigInt(fields[0]);
    if (boundary <= prior) fail(`${label} boundaries are not strict`); prior = boundary;
    return Object.freeze({ boundary, type: fields[1], first: Number(fields[2]),
      second: Number(fields[3]), third: Number(fields[4]), ordinal });
  });
}
function deactivationWireRecord(value, label) {
  exactKeys(value, ["bytes", "sha256", "hex", "kind", "generation", "ordinal", "payload"], label);
  if (value.bytes !== 40 || !digest(value.sha256, `${label}.sha256`) || typeof value.hex !== "string" ||
      !/^[0-9a-f]{80}$/.test(value.hex) || ![1, 2].includes(value.kind) ||
      !/^[1-9][0-9]*$/.test(value.generation) || !/^[1-9][0-9]*$/.test(value.ordinal) ||
      !Number.isSafeInteger(value.payload) || value.payload < 0 || value.payload > 0xffffffff) {
    fail(`${label} is not an exact CDRINP1 JSON receipt`);
  }
  const bytes = Buffer.from(value.hex, "hex"); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (sha256(bytes) !== value.sha256 || new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRINP1" || bytes[7] !== 0 ||
      view.getUint16(8, true) !== 1 || view.getUint16(10, true) !== value.kind || view.getUint32(12, true) !== 0 ||
      view.getBigUint64(16, true).toString() !== value.generation || view.getBigUint64(24, true).toString() !== value.ordinal ||
      view.getUint32(32, true) !== value.payload || view.getUint32(36, true) !== 0) {
    fail(`${label} bytes do not encode its CDRINP1 receipt fields`);
  }
  return value;
}
function deactivationProducerRecords(initial) {
  const key = cadrM8KeyForCode("KeyQ");
  if (key === null || key.scancode !== 0x52) {
    fail("selected KeyQ mapping is not exact scancode 0x52");
  }
  const pointerDown = encodeCadrM9Edge32({ x: 60, y: 70, buttonsAfter: 1,
    changedMask: 1, cause: "physical" });
  const pointerRelease = encodeCadrM9Edge32({ x: 60, y: 70, buttonsAfter: 0,
    changedMask: 1, cause: "capture-loss" });
  return Object.freeze([
    Object.freeze({ stage: "keyboard_down", kind: 1, payload: key.scancode }),
    Object.freeze({ stage: "pointer_down", kind: 2, payload: pointerDown }),
    Object.freeze({ stage: "neutralize", kind: 2, payload: pointerRelease }),
    Object.freeze({ stage: "neutralize", kind: 1, payload: 0x8000 }),
  ].map((record, index) => Object.freeze({ ...record,
    ordinal: initial.ingressOrdinal + BigInt(index + 1), generation: initial.generation })));
}
function validateDeactivationDelivery(value, expectedRecords, initial, label) {
  exactKeys(value, ["wire_schema", "records_delivered", "first_ingress_ordinal", "last_ingress_ordinal", "input_sequence", "wire_records", "core_observations"], label);
  if (value.wire_schema !== "CDRINP1" || value.records_delivered !== expectedRecords.length ||
      value.first_ingress_ordinal !== expectedRecords[0]?.ordinal.toString() ||
      value.last_ingress_ordinal !== expectedRecords.at(-1)?.ordinal.toString() ||
      value.input_sequence !== initial.inputSequence + expectedRecords.length ||
      !Array.isArray(value.wire_records) || value.wire_records.length !== expectedRecords.length ||
      !Array.isArray(value.core_observations) || value.core_observations.length !== expectedRecords.length) {
    fail(`${label} delivery extent differs from the complete shared transaction`);
  }
  let derived = initial;
  value.wire_records.forEach((recordValue, index) => {
    const wire = deactivationWireRecord(recordValue, `${label} wire ${index}`);
    const expected = expectedRecords[index];
    if (wire.kind !== expected.kind || wire.payload !== expected.payload ||
        wire.generation !== expected.generation.toString() || wire.ordinal !== expected.ordinal.toString()) {
      fail(`${label} wire ${index} is not derived from the KeyQ/60,70 producer commands`);
    }
    derived = expectedInputState(derived, { kind: expected.kind, payload: expected.payload,
      ordinal: expected.ordinal });
    const observation = runtimeState(value.core_observations[index], `${label} observation ${index}`);
    if (!equalRuntimeState(observation, derived)) {
      fail(`${label} CDRIOB91 transition ${index} is not the exact CDRINP1 core effect`);
    }
  });
  return Object.freeze({ value, final: derived });
}
function nativeWitness(bytes, rows, label) {
  if (bytes.byteLength !== rows.length * 64) fail(`${label} has a noncanonical CDRM8N1 extent`);
  for (const row of rows) {
    const at = row.ordinal * 64; const record = bytes.subarray(at, at + 64);
    const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
    const expected = row.type === "keyboard" ? [row.first, row.second, 0, 0] : [row.third, 0, row.first, row.second];
    if (new TextDecoder().decode(record.subarray(0, 7)) !== "CDRM8N1" || record[7] !== 0 ||
        view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 64 ||
        view.getUint32(16, true) !== (row.type === "keyboard" ? 1 : 2) ||
        view.getUint32(20, true) !== 0 || view.getBigUint64(24, true) !== row.boundary ||
        view.getUint32(52, true) !== row.ordinal || !record.subarray(56).every(byte => byte === 0) ||
        expected.some((value, index) => view.getUint32(36 + index * 4, true) !== value)) {
      fail(`${label} record ${row.ordinal} differs from the input script`);
    }
  }
  return Object.freeze({ schema: "CDRM8N1", record_bytes: 64, record_count: rows.length,
    sha256: sha256(bytes) });
}
function selectedNativeCampaign(bytes, label) {
  const selected = new TextEncoder().encode(serializeCadrM8M9NativeScript(buildCadrM8M9Campaign()));
  if (bytes.byteLength !== selected.byteLength || !bytes.every((byte, index) => byte === selected[index])) {
    fail(`${label} does not equal the frozen complete M8/M9 native schedule`);
  }
  return nativeScriptRows(bytes, label);
}
export async function browserAll100Evidence(path, expectedJoin, variant) {
  if (!["O0", "O2"].includes(variant)) fail("browser evidence variant must be O0 or O2");
  if (path === null) fail(`--execute requires --browser-${variant.toLowerCase()}-manifest from its separate all-100 worker/core campaign`);
  if (basename(path) !== "manifest.json") fail(`browser ${variant} manifest must be named manifest.json`);
  const sessionRoot = dirname(path);
  const rootRelative = repositoryRelativePath(sessionRoot, `browser ${variant} manifest root`);
  const directRelative = relative(DIRECT_RESULT_ROOT, sessionRoot).split("\\").join("/");
  if (directRelative.length === 0 || directRelative === ".." || directRelative.startsWith("../")) {
    fail(`browser ${variant} manifest is outside the private direct-result tree`);
  }
  await liveContainedPath(ROOT, DIRECT_RESULT_ROOT, `browser ${variant} direct-result root`, { directory: true });
  await liveContainedPath(DIRECT_RESULT_ROOT, sessionRoot, `browser ${variant} session root`, { directory: true });
  await privateDirectory(sessionRoot, `browser ${variant} session root`);
  await liveContainedPath(sessionRoot, path, `browser ${variant} manifest`);
  const manifestIdentity = await privateIdentity(path, `browser ${variant} manifest`);
  const manifest = jsonBytes(manifestIdentity, `browser ${variant} manifest`);
  exactKeys(manifest, ["schema", "target", "outcome", "runtime_execution_performed",
    "source_binding", "provenance_join_start", "provenance_join_end", "wasm_production", "session", "campaign",
    "native", "portable", "comparison"], `browser ${variant} manifest`);
  const release = await readPinnedReleaseRecord(expectedJoin);
  assertCadrM8M9ProvenanceJoin(manifest?.provenance_join_start, expectedJoin,
    `browser ${variant} start provenance binding`);
  assertCadrM8M9ProvenanceJoin(manifest?.provenance_join_end, expectedJoin,
    `browser ${variant} end provenance binding`);
  validateDirectSourceBinding(manifest.source_binding, expectedJoin,
    `browser ${variant} source binding`);
  const expectedWasm = expectedJoin.m9_devid_wasm?.[variant];
  const expectedWorker = expectedJoin.source_closure?.files?.find(file =>
    file.path === "cadr-web/wasm/cadr-worker.js");
  const sourceWorker = manifest?.source_binding?.source_closure?.files?.find(file =>
    file.path === "cadr-web/wasm/cadr-worker.js");
  const production = manifest?.wasm_production;
  exactKeys(production, ["schema", "profile", "forced", "argv", "stdout_sha256", "stderr_sha256", "outputs"],
    `browser ${variant} forced Wasm production`);
  if (manifest?.schema !== "cadr-m8-m9-input-conformance-result-v3" ||
      manifest?.target !== "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9-DEVID-READY4-DIRECT-BOUNDARY-NON-CW2" ||
      manifest?.runtime_execution_performed !== true ||
      sourceWorker?.bytes !== expectedWorker?.bytes ||
      sourceWorker?.sha256 !== expectedWorker?.sha256 ||
      manifest?.portable?.module?.path !== expectedWasm?.path ||
      manifest?.portable?.module?.bytes !== expectedWasm?.bytes ||
      manifest?.portable?.module?.sha256 !== expectedWasm?.sha256 ||
      manifest?.portable?.worker?.path !== expectedWorker?.path ||
      manifest?.portable?.worker?.bytes !== expectedWorker?.bytes ||
      manifest?.portable?.worker?.sha256 !== expectedWorker?.sha256 ||
      production?.schema !== "cadr-m8-m9-wasm-production-v2" ||
      production?.profile !== "m9-devid" || production?.forced !== true ||
      !digest(production?.stdout_sha256, `browser ${variant} forced Wasm stdout`) ||
      !digest(production?.stderr_sha256, `browser ${variant} forced Wasm stderr`) ||
      !Array.isArray(production?.argv) ||
      production.argv.join(" ") !==
        "make -B -C cadr-web build/cadr-web-m9-devid-O0.wasm build/cadr-web-m9-devid-O2.wasm" ||
      !sameJson(production?.outputs, expectedJoin.m9_devid_wasm)) {
    fail(`browser ${variant} receipt is not a direct M8/M9 run of the staged/current closure`);
  }
  exactKeys(manifest.session, ["id", "mode"], `browser ${variant} session`);
  if (manifest.session.mode !== "0700") {
    fail(`browser ${variant} session identity is incomplete or nonconforming`);
  }
  hexSession(manifest.session.id, "m8-cw2", `browser ${variant} outer session`);
  if (basename(sessionRoot) !== manifest.session.id) {
    fail(`browser ${variant} outer session identifier does not name its live session root`);
  }
  await exactDirectoryEntries(sessionRoot,
    ["campaign.json", "comparison.json", "input-script.txt", "manifest.json", "native", "portable"],
    `browser ${variant} session root`);
  const nativeRoot = await confinedLivePath(sessionRoot, "native", `browser ${variant} native root`, { directory: true });
  const portableRoot = await confinedLivePath(sessionRoot, "portable", `browser ${variant} portable root`, { directory: true });
  await Promise.all([privateDirectory(nativeRoot, `browser ${variant} native root`),
    privateDirectory(portableRoot, `browser ${variant} portable root`)]);
  await Promise.all([
    exactDirectoryEntries(nativeRoot, ["campaign.json", "capture.ndjson", "idle.bin", "input-script.txt",
      "input.cdrm8n1", "metadata.json"], `browser ${variant} native root`),
    exactDirectoryEntries(portableRoot, ["expected-input.cdrinp1", "expected-input-states.json",
      "observed-input.cdrinp1", "observed-input-states.json", "shared-deactivation.json", "worker.ndjson"],
    `browser ${variant} portable root`),
  ]);
  const named = async (relativePath, label) => {
    const contained = await confinedLivePath(sessionRoot, relativePath, `${label} path`);
    return privateIdentity(contained, label);
  };
  exactKeys(manifest.campaign, ["script", "manifest"], `browser ${variant} campaign`);
  exactKeys(manifest.native, ["session_id", "private_disk_instance_id",
    "python_closure", "oracle_process", "witness", "files", "metadata"],
    `browser ${variant} native receipt`);
  if (!sameJson(manifest.native.python_closure,
    expectedJoin.native_python_closure)) {
    fail(`browser ${variant} native execution Python closure differs`);
  }
  exactKeys(manifest.portable, ["session_id", "runtime", "module", "worker", "worker_closure", "expected_cdrinp_file",
    "wasm_execution", "observed_cdrinp_file", "expected_state_file", "observed_state_file", "worker_log_file",
    "consumption_boundaries", "shared_deactivation_file", "shared_deactivation", "termination",
    "browser_state", "ready4"], `browser ${variant} portable receipt`);
  const [script, campaignIdentity, comparisonIdentity, expected, observed, expectedStatesIdentity,
    observedStatesIdentity, workerLogIdentity, deactivationIdentity, nativeWitnessIdentity,
    nativeMetadataIdentity, nativeCaptureIdentity, nativeIdleIdentity, nativeScriptIdentity,
    nativeCampaignIdentity] = await Promise.all([
    named("input-script.txt", `browser ${variant} input script`),
    named("campaign.json", `browser ${variant} campaign`),
    named("comparison.json", `browser ${variant} comparison`),
    named("portable/expected-input.cdrinp1", `browser ${variant} expected CDRINP1`),
    named("portable/observed-input.cdrinp1", `browser ${variant} observed CDRINP1`),
    named("portable/expected-input-states.json", `browser ${variant} expected states`),
    named("portable/observed-input-states.json", `browser ${variant} observed states`),
    named("portable/worker.ndjson", `browser ${variant} worker log`),
    named("portable/shared-deactivation.json", `browser ${variant} deactivation`),
    named("native/input.cdrm8n1", `browser ${variant} native witness`),
    named("native/metadata.json", `browser ${variant} native metadata`),
    named("native/capture.ndjson", `browser ${variant} native transcript`),
    named("native/idle.bin", `browser ${variant} native idle samples`),
    named("native/input-script.txt", `browser ${variant} native input script`),
    named("native/campaign.json", `browser ${variant} native campaign`),
  ]);
  receipt(manifest.campaign.script, script, "input-script.txt", `browser ${variant} input script`);
  receipt(manifest.campaign.manifest, campaignIdentity, "campaign.json", `browser ${variant} campaign`);
  receipt(manifest.comparison, comparisonIdentity, "comparison.json", `browser ${variant} comparison`);
  receipt(manifest.portable.expected_cdrinp_file, expected, "portable/expected-input.cdrinp1", `browser ${variant} expected CDRINP1`);
  receipt(manifest.portable.observed_cdrinp_file, observed, "portable/observed-input.cdrinp1", `browser ${variant} observed CDRINP1`);
  receipt(manifest.portable.expected_state_file, expectedStatesIdentity, "portable/expected-input-states.json", `browser ${variant} expected states`);
  receipt(manifest.portable.observed_state_file, observedStatesIdentity, "portable/observed-input-states.json", `browser ${variant} observed states`);
  receipt(manifest.portable.worker_log_file, workerLogIdentity, "portable/worker.ndjson", `browser ${variant} worker log`);
  validateCapturedWorkerClosure(manifest.portable.worker_closure, expectedJoin,
    `browser ${variant} worker closure`);
  receipt(manifest.portable.shared_deactivation_file, deactivationIdentity, "portable/shared-deactivation.json", `browser ${variant} deactivation`);
  const campaign = jsonBytes(campaignIdentity, `browser ${variant} campaign`);
  const comparison = jsonBytes(comparisonIdentity, `browser ${variant} comparison`);
  const expectedStates = jsonBytes(expectedStatesIdentity, `browser ${variant} expected states`);
  const observedStates = jsonBytes(observedStatesIdentity, `browser ${variant} observed states`);
  const deactivation = jsonBytes(deactivationIdentity, `browser ${variant} deactivation`);
  const nativeMetadata = jsonBytes(nativeMetadataIdentity, `browser ${variant} native metadata`);
  const rows = selectedNativeCampaign(script.content, `browser ${variant} input script`);
  if (sha256(nativeScriptIdentity.content) !== script.sha256 || sha256(nativeCampaignIdentity.content) !== campaignIdentity.sha256) {
    fail(`browser ${variant} native copied schedule sidecars differ from the root schedule`);
  }
  const witness = nativeWitness(nativeWitnessIdentity.content, rows, `browser ${variant} native witness`);
  exactKeys(manifest.native.oracle_process, ["returncode", "signal",
    "bootstrap_sha256", "pipe_bundle_sha256", "launcher",
    "prepython_authority"],
  `browser ${variant} native process`);
  exactKeys(manifest.native.oracle_process.launcher,
    ["reference", "bytes", "sha256", "device", "inode"],
    `browser ${variant} native launcher`);
  const authority = manifest.native.oracle_process.prepython_authority;
  exactKeys(authority, ["reference", "root", "ancestry", "build_receipt",
    "yama_ptrace_scope", "filesystem_permit", "bootstrap", "launcher",
    "guard"], `browser ${variant} pre-Python authority`);
  if (authority.reference !==
        "canonical-receipt-selected-guix-store-authority" ||
      typeof authority.root !== "string" ||
      !authority.root.startsWith("/gnu/store/")) {
    fail(`browser ${variant} pre-Python authority is not immutable Guix state`);
  }
  validateAuthorityBuildReceipt(authority.build_receipt, expectedJoin,
    `browser ${variant} authority build receipt`);
  if (!sameJson(authority.build_receipt,
      nativeMetadata.runtime_provenance.python.prepython_seal
        .authority_build_receipt) ||
      authority.root !== authority.build_receipt.output) {
    fail(`browser ${variant} authority result is not independently decisive`);
  }
  if (authority.yama_ptrace_scope !== authority.build_receipt.yama_ptrace_scope ||
      authority.yama_ptrace_scope !== nativeMetadata.runtime_provenance.python
        .prepython_seal.yama_ptrace_scope) {
    fail(`browser ${variant} outer, runtime, and receipt Yama policies differ`);
  }
  validateFilesystemPermit(authority.filesystem_permit,
    `browser ${variant} outer filesystem permit`);
  if (!sameJson(authority.filesystem_permit,
      nativeMetadata.runtime_provenance.python.prepython_seal
        .filesystem_permit)) {
    fail(`browser ${variant} outer filesystem permit differs from child provenance`);
  }
  immutableAncestry(authority.ancestry,
    `browser ${variant} pre-Python authority`);
  const expectedAuthorityPaths = ["/", "/gnu", "/gnu/store", authority.root,
    `${authority.root}/bin`,
    `${authority.root}/bin/cadr-m8-m9-python-seal-launcher`,
    `${authority.root}/lib`,
    `${authority.root}/lib/cadr-m8-m9-prepython-guard.so`,
    `${authority.root}/share`, `${authority.root}/share/cadr-m8-m9`,
    `${authority.root}/share/cadr-m8-m9/captured-python-bootstrap.py`];
  const authorityPaths = new Set(authority.ancestry.map(item => item.reference));
  if (authorityPaths.size !== expectedAuthorityPaths.length ||
      expectedAuthorityPaths.some(path => !authorityPaths.has(path))) {
    fail(`browser ${variant} pre-Python authority descriptor closure is incomplete`);
  }
  for (const field of ["bootstrap", "launcher", "guard"]) {
    exactKeys(authority[field], ["bytes", "sha256", "device", "inode"],
      `browser ${variant} authority ${field}`);
    if (!sameJson(authority[field],
        nativeMetadata.runtime_provenance.python.prepython_seal[field])) {
      fail(`browser ${variant} authority ${field} differs from child provenance`);
    }
    const receiptIdentity = field === "bootstrap"
      ? authority.build_receipt.authority.bootstrap
      : authority.build_receipt.authority[field].identity;
    if (!sameJson(authority[field], receiptIdentity)) {
      fail(`browser ${variant} authority ${field} differs from its receipt`);
    }
  }
  if (manifest.native.oracle_process.returncode !== 0 ||
      manifest.native.oracle_process.signal !== null ||
      !digest(manifest.native.oracle_process.bootstrap_sha256,
        `browser ${variant} Python bootstrap`) ||
      manifest.native.oracle_process.bootstrap_sha256 !==
        CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256 ||
      !digest(manifest.native.oracle_process.pipe_bundle_sha256,
        `browser ${variant} Python pipe bundle`) ||
      manifest.native.oracle_process.launcher.reference !==
        "root-owned-bwrap" ||
      unsigned(manifest.native.oracle_process.launcher.bytes,
        `browser ${variant} launcher bytes`) === 0 ||
      !digest(manifest.native.oracle_process.launcher.sha256,
        `browser ${variant} launcher digest`) ||
      !decimal(manifest.native.oracle_process.launcher.device,
        `browser ${variant} launcher device`) ||
      !decimal(manifest.native.oracle_process.launcher.inode,
        `browser ${variant} launcher inode`, { zero: false })) {
    fail(`browser ${variant} native process/session receipt is incomplete or nonconforming`);
  }
  hexSession(manifest.native.session_id, "native", `browser ${variant} native session`);
  hexSession(manifest.native.private_disk_instance_id, "disk", `browser ${variant} private disk instance`);
  if (manifest.native.session_id === manifest.portable.session_id ||
      manifest.native.session_id === manifest.session.id ||
      manifest.portable.session_id === manifest.session.id) {
    fail(`browser ${variant} native and portable sessions are not distinct`);
  }
  hexSession(manifest.portable.session_id, "portable", `browser ${variant} portable session`);
  exactKeys(manifest.native.witness, ["schema", "record_bytes", "record_count", "sha256"], `browser ${variant} native witness receipt`);
  if (!sameJson(manifest.native.witness, witness)) fail(`browser ${variant} native witness receipt differs from its sidecar`);
  if (!Array.isArray(manifest.native.files) || manifest.native.files.length !== 6) fail(`browser ${variant} native file list is incomplete`);
  const nativeFiles = new Map(manifest.native.files.map(item => [item?.path, item]));
  for (const [name, identity] of [["campaign.json", nativeCampaignIdentity], ["capture.ndjson", nativeCaptureIdentity],
    ["idle.bin", nativeIdleIdentity], ["input-script.txt", nativeScriptIdentity], ["input.cdrm8n1", nativeWitnessIdentity],
    ["metadata.json", nativeMetadataIdentity]]) {
    const contained = resolve(nativeRoot, name);
    receipt(nativeFiles.get(repositoryRelativePath(contained, `browser ${variant} native ${name}`)), identity,
      repositoryRelativePath(contained, `browser ${variant} native ${name}`), `browser ${variant} native ${name}`);
  }
  if (nativeFiles.size !== 6 || !sameJson(manifest.native.metadata, nativeMetadata)) {
    fail(`browser ${variant} native metadata receipt is incomplete or nonconforming`);
  }
  if (nativeMetadata.session_id !== manifest.native.session_id ||
      nativeMetadata.private_disk_instance_id !== manifest.native.private_disk_instance_id) {
    fail(`browser ${variant} native metadata does not bind the manifest identifiers`);
  }
  validateNativeMetadata(nativeMetadata, expectedJoin, script, witness, nativeCaptureIdentity,
    nativeIdleIdentity, `browser ${variant} native metadata`);
  const expectedStream = cdrinpStream(expected.content, `browser ${variant} expected CDRINP1`);
  const observedStream = cdrinpStream(observed.content, `browser ${variant} observed CDRINP1`);
  if (expected.sha256 !== observed.sha256 || expectedStream.generation !== observedStream.generation ||
      !expected.content.every((byte, index) => byte === observed.content[index])) {
    fail(`browser ${variant} CDRINP1 sidecars differ`);
  }
  const expectedCampaign = buildCadrM8M9Campaign({ generation: BigInt(expectedStream.generation) });
  if (expectedCampaign.records.length !== expectedStream.records.length ||
      expectedCampaign.records.some((entry, index) => entry.kind !== expectedStream.records[index].kind ||
        entry.payload !== expectedStream.records[index].payload ||
        entry.ordinal.toString() !== expectedStream.records[index].ordinal)) {
    fail(`browser ${variant} CDRINP1 stream does not equal the frozen complete M8/M9 schedule`);
  }
  exactKeys(expectedStates, ["schema", "before", "after", "records", "states"], `browser ${variant} expected states`);
  exactKeys(observedStates, ["schema", "before", "after", "consumption_boundaries", "states"], `browser ${variant} observed states`);
  if (expectedStates.schema !== "cadr-m8-m9-expected-input-states-v1" ||
      observedStates.schema !== "cadr-m8-m9-observed-input-states-v1" ||
      !Array.isArray(expectedStates.records) || expectedStates.records.length !== 208 ||
      !Array.isArray(expectedStates.states) || expectedStates.states.length !== 208 ||
      !Array.isArray(observedStates.states) || observedStates.states.length !== 208 ||
      !sameJson(expectedStates.states, observedStates.states) ||
      !sameJson(expectedStates.before, observedStates.before) || !sameJson(expectedStates.after, observedStates.after)) {
    fail(`browser ${variant} expected-state sidecars are incomplete or nonconforming`);
  }
  let derivedState = runtimeState(expectedStates.before, `browser ${variant} state before`);
  let consumptionIndex = 0;
  const expectedCampaignRecords = buildCadrM8M9Campaign({ generation: BigInt(expectedStream.generation) }).records;
  for (const [index, state] of expectedStates.states.entries()) {
    const wire = expectedStream.records[index]; const receiptValue = expectedStates.records[index];
    exactKeys(receiptValue, ["label", "kind", "ordinal", "payload", "sha256"], `browser ${variant} record receipt ${index}`);
    if (receiptValue.label !== expectedCampaignRecords[index].label || receiptValue.kind !== wire.kind || receiptValue.ordinal !== wire.ordinal ||
        receiptValue.payload !== wire.payload || receiptValue.sha256 !== wire.sha256 ||
        state.generation !== wire.generation || state.ingress_ordinal !== wire.ordinal ||
        expectedCampaignRecords[index].kind !== wire.kind || expectedCampaignRecords[index].payload !== wire.payload) {
      fail(`browser ${variant} expected-state record ${index} differs from CDRINP1`);
    }
    derivedState = expectedInputState(derivedState, { kind: wire.kind, payload: wire.payload,
      ordinal: BigInt(wire.ordinal) });
    const actualState = runtimeState(state, `browser ${variant} state ${index}`);
    if (!equalRuntimeState(actualState, derivedState)) {
      fail(`browser ${variant} expected state ${index} is not derived from CDRINP1`);
    }
    if (index < 200 && index % 2 === 1) {
      const down = expectedStream.records[index - 1]; const up = wire;
      const boundary = validateConsumptionBoundary(manifest.portable.consumption_boundaries[consumptionIndex],
        derivedState, { label: expectedCampaignRecords[index].label, down, up }, consumptionIndex,
        `browser ${variant} keyboard-consumption boundary`);
      derivedState = boundary.final; consumptionIndex += 1;
    }
  }
  if (consumptionIndex !== 100 || !equalRuntimeState(runtimeState(expectedStates.after,
    `browser ${variant} state after`), derivedState)) {
    fail(`browser ${variant} final expected state is not CDRINP/consumption-derived`);
  }
  if (!Array.isArray(manifest.portable.consumption_boundaries) ||
      manifest.portable.consumption_boundaries.length !== 100 ||
      !sameJson(manifest.portable.consumption_boundaries, observedStates.consumption_boundaries)) {
    fail(`browser ${variant} keyboard-consumption sidecar is incomplete or nonconforming`);
  }
  exactKeys(manifest.portable.termination, ["pending_requests", "terminated"], `browser ${variant} portable termination`);
  exactKeys(manifest.portable.wasm_execution, ["path", "bytes", "sha256", "device", "inode"],
    `browser ${variant} descriptor-bound Wasm execution`);
  if (manifest.portable.wasm_execution.path !== manifest.portable.module.path ||
      manifest.portable.wasm_execution.bytes !== manifest.portable.module.bytes ||
      manifest.portable.wasm_execution.sha256 !== manifest.portable.module.sha256) {
    fail(`browser ${variant} descriptor-bound Wasm differs from the portable module receipt`);
  }
  decimal(manifest.portable.wasm_execution.device, `browser ${variant} Wasm descriptor device`);
  decimal(manifest.portable.wasm_execution.inode, `browser ${variant} Wasm descriptor inode`, { zero: false });
  exactKeys(manifest.portable.browser_state, ["generation", "first_ingress_ordinal", "last_ingress_ordinal",
    "input_sequence_before", "input_sequence_after"], `browser ${variant} portable browser state`);
  if (manifest.portable.termination.pending_requests !== 0 || manifest.portable.termination.terminated !== true ||
      manifest.portable.browser_state.generation !== expectedStream.generation ||
      manifest.portable.browser_state.first_ingress_ordinal !== "1" ||
      manifest.portable.browser_state.last_ingress_ordinal !== "208" ||
      manifest.portable.browser_state.input_sequence_after !== expectedStates.after.input_sequence) {
    fail(`browser ${variant} portable termination/state receipt is incomplete or nonconforming`);
  }
  await validateReady4Evidence(manifest.portable.ready4, expectedJoin, release,
    `browser ${variant} portable READY4 evidence`);
  exactKeys(manifest.portable.runtime, ["node", "v8", "executable", "environment"], `browser ${variant} portable runtime`);
  exactKeys(manifest.portable.runtime.executable, ["bytes", "sha256"], `browser ${variant} Node identity`);
  exactKeys(manifest.portable.runtime.environment, ["LANG", "LC_ALL", "TZ"], `browser ${variant} runtime environment`);
  if (typeof manifest.portable.runtime.node !== "string" || typeof manifest.portable.runtime.v8 !== "string" ||
      unsigned(manifest.portable.runtime.executable.bytes, `browser ${variant} Node bytes`) === 0 ||
      !digest(manifest.portable.runtime.executable.sha256, `browser ${variant} Node SHA-256`)) {
    fail(`browser ${variant} runtime identity is incomplete or nonconforming`);
  }
  if (!sameJson(manifest.portable.shared_deactivation, deactivation)) {
    fail(`browser ${variant} shared-deactivation sidecar is incomplete or nonconforming`);
  }
  exactKeys(deactivation, ["outcome", "keyboard_down", "pointer_down", "neutralize", "deactivation", "coreAfter"],
    `browser ${variant} shared deactivation`);
  if (deactivation.outcome !== "held-key-and-pointer-cleared-after-core-delivery") {
    fail(`browser ${variant} shared deactivation has the wrong outcome`);
  }
  const afterCampaign = runtimeState(expectedStates.after, `browser ${variant} state before shared deactivation`);
  const deactivationRecords = deactivationProducerRecords(afterCampaign);
  const heldKey = validateDeactivationDelivery(deactivation.keyboard_down, [deactivationRecords[0]], afterCampaign,
    `browser ${variant} held-key delivery`);
  const heldPointer = validateDeactivationDelivery(deactivation.pointer_down, [deactivationRecords[1]], heldKey.final,
    `browser ${variant} held-pointer delivery`);
  const neutralize = validateDeactivationDelivery(deactivation.neutralize, deactivationRecords.slice(2), heldPointer.final,
    `browser ${variant} neutralization delivery`);
  if (neutralize.value.wire_records[1].payload !== 0x8000 || heldKey.value.wire_records[0].payload === 0x8000 ||
      heldPointer.value.wire_records[0].payload === 0 ||
      !sameJson(deactivation.deactivation, { heldKeysCleared: 1 })) {
    fail(`browser ${variant} shared deactivation does not atomically deliver pointer-up then one all-up`);
  }
  const coreAfter = runtimeState(deactivation.coreAfter, `browser ${variant} shared deactivation final core state`);
  if (!equalRuntimeState(coreAfter, neutralize.final)) {
    fail(`browser ${variant} shared deactivation final CDRIOB91 state is not the complete derived tail`);
  }
  const workerLog = validateWorkerLog(workerLogIdentity, manifest.portable.session_id,
    manifest.portable.consumption_boundaries, `browser ${variant} worker log`);
  if (manifest.outcome !== "worker-core-payloads-identical-to-expected" ||
      comparison?.schema !== "cadr-m8-m9-input-comparison-v1" ||
      comparison?.outcome !== manifest.outcome || comparison?.browser?.record_count !== 208 ||
      comparison?.browser?.record_bytes !== 40 || comparison?.browser?.exact_worker_boundary_match !== true ||
      comparison?.browser?.expected_sha256 !== expected.sha256 || comparison?.browser?.observed_sha256 !== observed.sha256 ||
      comparison?.browser?.generation !== expectedStream.generation || comparison?.native?.record_count !== 207 ||
      comparison?.native?.record_bytes !== 64 || comparison?.native?.sha256 !== witness.sha256 ||
      comparison?.common_campaign?.key_count !== 100 || comparison?.common_campaign?.native_row_count !== 207 ||
      comparison?.common_campaign?.browser_record_count !== 208 || comparison?.common_campaign?.input_script_sha256 !== script.sha256 ||
      campaign?.schema !== "cadr-m8-m9-input-campaign-v1" || campaign?.key_count !== 100 ||
      campaign?.native_row_count !== 207 || campaign?.browser_record_count !== 208 ||
      campaign?.input_script_sha256 !== script.sha256) {
    fail(`browser ${variant} campaign/comparison sidecars are incomplete or nonconforming`);
  }
  return { variant, session_id: manifest.session.id, session_root: rootRelative,
    native_session_id: manifest.native.session_id,
    portable_session_id: manifest.portable.session_id,
    private_disk_instance_id: manifest.native.private_disk_instance_id,
    manifest: manifestIdentity, campaign: campaignIdentity,
    comparison: comparisonIdentity,
    expected, observed, deactivation: deactivationIdentity,
    observedStates: observedStatesIdentity,
    workerLog, consumptionBoundaryCount: 100, keyCount: 100 };
}
export function assertDistinctDirectVariants(o0, o2) {
  for (const field of ["session_id", "session_root", "native_session_id", "portable_session_id",
    "private_disk_instance_id"]) {
    if (o0?.[field] === o2?.[field]) {
      fail(`O0 and O2 direct receipts reuse ${field}`);
    }
  }
  return Object.freeze({ O0: o0, O2: o2 });
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
  const provenanceJoin = await collectCadrM8M9ProvenanceJoin({ prepared });
  const sourceBinding = await sourceProvenance([
    fileURLToPath(import.meta.url),
    resolve(ROOT, "scripts/cadr-m8-m9-provenance-join.mjs"),
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
  const browserEvidence = Object.freeze({
    O0: await browserAll100Evidence(browserManifests.O0, provenanceJoin, "O0"),
    O2: await browserAll100Evidence(browserManifests.O2, provenanceJoin, "O2"),
  });
  assertDistinctDirectVariants(browserEvidence.O0, browserEvidence.O2);
  if (resolve(browserManifests.O0) === resolve(browserManifests.O2)) {
    fail("O0 and O2 direct receipts must have distinct manifest paths");
  }
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
  let provenanceJoinEnd = null;
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
    provenanceJoinEnd = await collectCadrM8M9ProvenanceJoin({ prepared });
    assertCadrM8M9ProvenanceJoin(provenanceJoinEnd, provenanceJoin,
      "live X11 campaign end provenance binding");
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
    await writeFile(manifestPath, `${JSON.stringify({ schema: "cadr-m8-m9-x11-campaign-v2",
      x11_witness: { marker: build.x11_witness, selected },
      prepared_binding: preparedBinding,
      provenance_join: provenanceJoin,
      provenance_join_end: provenanceJoinEnd,
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
      evidence_boundary: "source-bound O0/O2 browser direct receipts are joined to this native XTEST/X11/Cadet closure; this does not close the separate matched browser Listener/editor/window CW2 workflow",
      calls }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ outcome: "native-x11-campaign-recorded",
      map_session: mapSession, workflow_session: workflowSession, manifest: manifestPath })}\n`);
  } catch (error) {
    const failurePath = resolve(stateRoot, mapSession, "m8-m9-x11-failure.json");
    await writeX11FailureManifest(failurePath, {
      error: error instanceof Error ? error.message : String(error),
      x11_witness: { marker: build.x11_witness, selected },
      prepared_binding: preparedBinding, source_reachability: reachability.evidence,
      provenance_join: provenanceJoin,
      provenance_join_end: provenanceJoinEnd,
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
