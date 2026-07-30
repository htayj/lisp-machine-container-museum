import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  CADR_M10_BASE_SHA256,
  cadrM10Sha256,
  parseCdrOvh1,
  parseCdrOvm1,
  parseCdrOvn1,
  serializeCdrOvh1,
  serializeCdrOvm1,
  serializeCdrOvn1,
} from "../cadr-web/wasm/cadr-m10-persistence.mjs";
import {
  parseCdrM10W1,
  validateCdrSnap1Structure,
} from "../cadr-web/wasm/cadr-m10-wrapper.mjs";
import {
  parseCadrM10OverlayExport,
  serializeCadrM10OverlayExport,
} from "../cadr-web/browser/cadr-m10-controller.mjs";
import {
  CADR_M12_MACRO_SLOT_LIMIT,
  CADR_M12_STATUS_DEBUG_STOP,
  parseCdrBug1,
  parseCdrDbgStop1,
  parseCdrProv1,
  serializeCdrBug1,
  serializeCdrDbgStop1,
  serializeCdrProv1,
  validateCadrM12TraceFilter,
} from "../cadr-web/wasm/cadr-m12-debugger.mjs";
import {
  parseCdrM8Kb1,
  serializeCdrM8Kb1,
} from "../cadr-web/wasm/cadr-m8-keyboard.mjs";
import {
  parseCdrState6Pointer,
  serializeCdrState6Pointer,
} from "../cadr-web/wasm/cadr-m9-interactive-lifecycle.mjs";
import { parseCdrDisp1 } from "../cadr-web/wasm/cadr-display-renderer.mjs";
import { parseCdrM7N1 } from "../cadr-web/wasm/cadr-m7-frame-checkpoint.mjs";
import {
  parseM6FastRunResponse,
  validateSyntheticM6ReleaseRecord,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  CADR_M13_PROTOCOL_VERSION,
  canonicalizeCadrM13Request,
  validateCadrM13PostCloneRequest,
} from "../cadr-web/browser/cadr-m13-shell.mjs";
import { serializeM4ControllerTranscript } from "../cadr-web/wasm/cadr-m4-controller-transcript.mjs";

/*
 * M13-F02 parser corpus.  It intentionally names every currently exported
 * parser/validator that accepts an untrusted record in the M6--M13 browser
 * stack.  Lower modules retain their own exhaustive semantic fixtures; this
 * campaign adds a uniform bounded hostile-input sweep and records its exact
 * deterministic seed/result summary on request.  It is not a claim that
 * private helpers, a selected Wasm core, or the absent composed M13 workflow
 * have been fuzzed.
 */
const SEED = 0x6d313346;
const FUZZ_CASES_PER_BYTE_TARGET = 48;
const PARSER_DEADLINE_MS = 1000;
const TEXT = new TextEncoder();
const session = "13".repeat(32);

function hash(seed) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index * 19) & 0xff);
}

function cloneBytes(value) { return value.slice(); }

function xorshift32(state) {
  let value = state >>> 0;
  value ^= value << 13; value >>>= 0;
  value ^= value >>> 17; value >>>= 0;
  value ^= value << 5; return value >>> 0;
}

async function bounded(label, action) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${PARSER_DEADLINE_MS}ms`)),
          PARSER_DEADLINE_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function mustReject(label, action) {
  let rejected = false;
  try {
    const result = await bounded(label, action);
    rejected = result === false;
  } catch {
    rejected = true;
  }
  assert.equal(rejected, true, `${label} was accepted`);
}

async function runHostileByteCorpus(target, valid, report) {
  await bounded(`${target.name}: valid`, () => target.parse(valid));
  const invalid = valid.slice();
  invalid[target.requiredOffset ?? 0] ^= 0x80;
  await mustReject(`${target.name}: corrupted required field`, () => target.parse(invalid));

  const hostileTypes = [null, undefined, false, 0, "", {}, [],
    new ArrayBuffer(1), new DataView(new ArrayBuffer(1))];
  for (const candidate of hostileTypes) {
    await mustReject(`${target.name}: hostile type`, () => target.parse(candidate));
    report.fuzzed += 1;
    report.targets[target.name].rejected += 1;
  }

  let state = (SEED ^ target.seed) >>> 0;
  for (let ordinal = 0; ordinal < FUZZ_CASES_PER_BYTE_TARGET; ordinal += 1) {
    state = xorshift32(state);
    const bytes = cloneBytes(valid);
    const mutations = 1 + (state & 3);
    for (let index = 0; index < mutations; index += 1) {
      state = xorshift32(state);
      const offset = state % bytes.byteLength;
      state = xorshift32(state);
      bytes[offset] ^= (state & 0xff) || 1;
    }
    let disposition;
    try {
      const result = await bounded(`${target.name}: fuzz ${ordinal}`, () => target.parse(bytes));
      disposition = result === false ? "rejected" : "accepted";
    } catch {
      disposition = "rejected";
    }
    report.fuzzed += 1;
    report.targets[target.name][disposition] += 1;
  }
}

function structuralSnapshot() {
  const types = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const directoryOffset = 264;
  const directoryBytes = types.length * 64;
  const payloadOffset = directoryOffset + directoryBytes;
  return { types, directoryOffset, directoryBytes, payloadOffset,
    bytes: new Uint8Array(payloadOffset + 32) };
}

async function validCdrSnap1() {
  const { types, directoryOffset, directoryBytes, payloadOffset, bytes } = structuralSnapshot();
  const view = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRSNAP1"));
  view.setUint16(8, 1, true); view.setUint16(10, 2, true);
  view.setUint32(12, 264, true); view.setUint32(20, types.length, true);
  view.setUint32(24, 64, true); view.setBigUint64(32, BigInt(bytes.byteLength), true);
  view.setBigUint64(40, 264n, true); view.setBigUint64(48, BigInt(directoryBytes), true);
  view.setBigUint64(56, BigInt(payloadOffset), true); view.setUint32(64, 1, true);
  bytes.set(Uint8Array.from("1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a"
    .match(/../g), byte => Number.parseInt(byte, 16)), 104);
  bytes.set(Uint8Array.from("e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941"
    .match(/../g), byte => Number.parseInt(byte, 16)), 136);
  const emptyHash = await cadrM10Sha256(new Uint8Array());
  for (let index = 0; index < types.length; index += 1) {
    const offset = directoryOffset + index * 64;
    view.setUint32(offset, types[index], true); view.setUint32(offset + 4, 1, true);
    view.setBigUint64(offset + 8, BigInt(payloadOffset), true);
    bytes.set(emptyHash, offset + 32);
  }
  bytes.set(await cadrM10Sha256(bytes.subarray(directoryOffset, payloadOffset)), 232);
  bytes.set(await cadrM10Sha256(bytes.subarray(0, bytes.byteLength - 32)),
    bytes.byteLength - 32);
  return bytes;
}

async function validCdrM10W1(snapshot) {
  const inner = new Uint8Array(104 + snapshot.byteLength);
  const view = new DataView(inner.buffer);
  inner.set(TEXT.encode("CDRM5WK1")); view.setUint32(8, 3, true);
  view.setBigUint64(16, BigInt(snapshot.byteLength), true);
  inner.set(snapshot, 104);
  const digestInput = new Uint8Array(72 + snapshot.byteLength);
  digestInput.set(inner.subarray(0, 72)); digestInput.set(snapshot, 72);
  inner.set(await cadrM10Sha256(digestInput), 72);
  const bytes = new Uint8Array(256 + inner.byteLength);
  const wrapper = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRM10W1")); wrapper.setUint32(8, 1, true);
  wrapper.setUint32(12, 256, true); wrapper.setUint32(16, 1, true);
  wrapper.setBigUint64(24, BigInt(inner.byteLength), true);
  wrapper.setBigUint64(32, 269562880n, true); wrapper.setUint32(40, 1024, true);
  bytes.set(hash(1), 48); bytes.set(hash(2), 64); wrapper.setBigUint64(80, 1n, true);
  wrapper.setBigUint64(88, 1n, true); bytes.set(hash(3), 96); bytes.set(hash(4), 128);
  bytes.set(CADR_M10_BASE_SHA256, 160); bytes.set(hash(5), 192);
  const wrapperDigest = new Uint8Array(224 + inner.byteLength);
  wrapperDigest.set(bytes.subarray(0, 224)); wrapperDigest.set(inner, 224);
  bytes.set(await cadrM10Sha256(wrapperDigest), 224); bytes.set(inner, 256);
  return bytes;
}

function validDisplayRecord() {
  const bytes = new Uint8Array(100);
  const view = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRDISP1")); view.setUint16(8, 1, true); view.setUint16(10, 80, true);
  view.setUint32(12, 2, true); view.setBigUint64(16, 1n, true); view.setBigUint64(24, 1n, true);
  view.setUint32(32, 768, true); view.setUint32(36, 963, true); view.setUint32(40, 24, true);
  view.setUint32(44, 32768, true); view.setUint32(48, 23112, true); view.setUint32(56, 1, true);
  view.setUint32(60, 1, true); view.setBigUint64(64, 4n, true); view.setBigUint64(72, 100n, true);
  view.setUint32(80, 0, true); view.setUint32(84, 0, true); view.setUint32(88, 32, true); view.setUint32(92, 1, true);
  return bytes;
}

function validM7NativeRecord() {
  const bytes = new Uint8Array(64 + 23112 * 4);
  const view = new DataView(bytes.buffer);
  bytes.set(TEXT.encode("CDRM7N1")); view.setUint32(8, 1, true); view.setUint32(12, 64, true);
  view.setBigUint64(16, 982990214n, true); view.setUint32(24, 768, true); view.setUint32(28, 963, true);
  view.setUint32(32, 4, true); view.setUint32(36, 1, true); view.setUint32(40, 32768, true);
  view.setUint32(44, 23112, true); view.setUint32(48, 23112 * 4, true);
  return bytes;
}

function validM6FastRunResponse() {
  const fastRun = new Uint8Array(128);
  const view = new DataView(fastRun.buffer);
  fastRun.set(TEXT.encode("CDRM6FAST1")); view.setUint32(16, 1, true); view.setUint32(20, 128, true);
  view.setUint32(24, 1, true); view.setUint32(32, 1, true); view.setBigUint64(40, 1n, true);
  view.setBigUint64(64, 1n, true);
  return { wireSchema: "CDRM6FAST1", fastRun, reason: 1, terminalStatus: 0, requestedSlots: 1,
    completedSlots: 1n, microinstructionDelta: 0n, preBoundary: 0n, postBoundary: 1n,
    debugBefore: 0n, debugAfter: 0n, persistentStatus: 0, coreLifecycle: 0,
    outstandingRequestId: 0n };
}

const rootChildren = Array.from({ length: 256 }, () => new Uint8Array(32));
const rootBytes = await serializeCdrOvn1({ level: 2, prefix: 0n, children: rootChildren });
const root = await parseCdrOvn1(rootBytes);
const manifestBytes = await serializeCdrOvm1({ generation: 0n, parentGeneration: 0n, entryCount: 0n,
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index), baseSha256: CADR_M10_BASE_SHA256,
  profileSha256: hash(6), artifactSetSha256: hash(7), rootSha256: root.hash });
const manifest = await parseCdrOvm1(manifestBytes);
const headBytes = await serializeCdrOvh1({ headSeq: 1n, writerEpoch: 0n,
  diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index), activeGeneration: 0n,
  activeManifestSha256: manifest.hash, activeRootSha256: root.hash,
  baseSha256: CADR_M10_BASE_SHA256, profileSha256: hash(6) });
const snapshot = await validCdrSnap1();
const wrapper = await validCdrM10W1(snapshot);
const overlay = await serializeCadrM10OverlayExport({ diskUuid: Uint8Array.from({ length: 16 }, (_, index) => index),
  baseSha256: CADR_M10_BASE_SHA256, profileSha256: hash(6), artifactSetSha256: hash(7) }, {
  generation: 0n, entryCount: 0n, rootSha256: root.hash, pages: [],
  nodes: [{ key: [...root.hash].map(byte => byte.toString(16).padStart(2, "0")).join(""), bytes: rootBytes }],
});
const stop = serializeCdrDbgStop1({ reason: 1, breakpointIndex: 0, generation: 1n, boundaryOrdinal: 1n,
  clockSlot: 1n, microPcBefore: 1, rawLcBefore: 1, microPcAfter: 1, rawLcAfter: 1,
  faultAfter: 0, deviceRequestAfter: 0, inhibitedAfter: 0, runOrdinal: 1n,
  operationSlots: 1n, profileSha256: hash(8) });
const provenance = serializeCdrProv1({ profileSha256: hash(8), coreSha256: hash(9), snapshotSha256: hash(10) });
const bug = serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance, summary: "parser corpus" });

const report = { schema: "cadr-m13-f02-parser-corpus-v1", seed: `0x${SEED.toString(16)}`,
  casesPerByteTarget: FUZZ_CASES_PER_BYTE_TARGET, parserDeadlineMs: PARSER_DEADLINE_MS,
  fuzzed: 0, targets: Object.create(null) };
const byteTargets = [
  ["CDROVN1", parseCdrOvn1, rootBytes],
  ["CDROVM1", parseCdrOvm1, manifestBytes],
  ["CDROVH1", parseCdrOvh1, headBytes],
  ["CDRSNAP1", validateCdrSnap1Structure, snapshot],
  ["CDRM10W1", value => parseCdrM10W1(value, { validateInnerSnapshot: async () => true }), wrapper],
  ["C-M10 overlay export", parseCadrM10OverlayExport, overlay],
  ["CDRDBGSTOP1", parseCdrDbgStop1, stop],
  ["CDRPROV1", parseCdrProv1, provenance],
  ["CDRBUG1", parseCdrBug1, bug],
  ["CDRM8KB1", parseCdrM8Kb1, serializeCdrM8Kb1({ queueCapacity: 1, heldCodes: [], queue: [] })],
  ["CDRSTATE6 pointer", parseCdrState6Pointer, serializeCdrState6Pointer({ legacyY: 0, legacyX: 0 }), 6],
  ["CDRDISP1", parseCdrDisp1, validDisplayRecord()],
  ["CDRM7N1", parseCdrM7N1, validM7NativeRecord()],
].map(([name, parse, valid, requiredOffset], index) => ({
  name, parse, valid, requiredOffset, seed: index + 1,
}));

for (const target of byteTargets) {
  report.targets[target.name] = { accepted: 0, rejected: 0 };
  await runHostileByteCorpus(target, target.valid, report);
}

const nonByteTargets = [
  ["CDRM6FAST1 projection", () => parseM6FastRunResponse({}), validM6FastRunResponse(), parseM6FastRunResponse],
  ["M6 release configuration", () => validateSyntheticM6ReleaseRecord({}), null, validateSyntheticM6ReleaseRecord],
  ["M12 trace filter", () => validateCadrM12TraceFilter({}),
    { flags: 0, microPc: 0, firstClockSlot: 0n, lastClockSlot: 0n }, validateCadrM12TraceFilter],
  ["M13 canonical request", () => canonicalizeCadrM13Request({}, { sessionId: session }),
    { type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION, sessionId: session, id: 1, op: "keyboard-state" },
    value => canonicalizeCadrM13Request(value, { sessionId: session })],
  ["M13 post-clone request", () => validateCadrM13PostCloneRequest({}),
    Object.assign(Object.create(null), { type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION,
      sessionId: session, id: 1, op: "keyboard-state" }), validateCadrM13PostCloneRequest],
];

for (const [name, malformed, valid, parse] of nonByteTargets) {
  report.targets[name] = { accepted: 0, rejected: 0 };
  await mustReject(`${name}: malformed`, malformed);
  if (valid !== null) await bounded(`${name}: valid`, () => parse(valid));
  const hostile = [null, undefined, 0, "", [], Object.create({ inherited: true }), { extra: true }];
  for (const candidate of hostile) {
    let disposition;
    try {
      const result = await bounded(`${name}: hostile`, () => parse(candidate));
      disposition = result === false ? "rejected" : "accepted";
    } catch {
      disposition = "rejected";
    }
    report.fuzzed += 1;
    report.targets[name][disposition] += 1;
  }
}

assert.equal(parseM6FastRunResponse(validM6FastRunResponse()).reason, 1);
assert.equal(validateCadrM12TraceFilter({ flags: 0 }).flags, 0);
assert.equal(validateCadrM13PostCloneRequest(nonByteTargets[4][2]), true);
assert.equal(CADR_M12_MACRO_SLOT_LIMIT, 1048576n);

/* `parseCoreEvidence` is deliberately private to the M4 transcript module;
 * exercise it through the only public ingress instead of widening a production
 * parsing surface merely for a test. */
report.targets["M4 CDRDISKEVID1 diagnostic evidence"] = { accepted: 0, rejected: 0 };
for (const evidence of [null, new Uint8Array(), new Uint8Array(16), new Uint8Array(17)]) {
  await mustReject("M4 CDRDISKEVID1 diagnostic evidence", () => serializeM4ControllerTranscript({
    coreEvidence: evidence, finalBoundary: 1030044n, finalStateSha256: hash(11),
    terminalObservation: { p0Pc: 0o355n, p1Pc: 0o356n, nextMicroPc: 0o357n,
      outstandingRequestId: 0n },
  }));
  report.fuzzed += 1;
  report.targets["M4 CDRDISKEVID1 diagnostic evidence"].rejected += 1;
}

const reportFlag = process.argv.indexOf("--report");
if (reportFlag !== -1) {
  const output = process.argv[reportFlag + 1];
  assert.notEqual(output, undefined, "--report requires a path");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
}
console.log(`cadr M13 named parser corpus passed (${report.fuzzed} bounded hostile cases, ${report.seed})`);
