#!/usr/bin/env node
/*
 * Independently validate the outer receipt written by
 * run-cadr-m6-wasm-conformance.mjs.  The production M6 serializer owns the
 * READY summary semantics; this program owns the surrounding provenance and
 * byte-identity envelope.  It intentionally does not start a worker or run
 * guest code.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CADR_M6_PROTOCOL_VERSION,
  CADR_M6_READY_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  serializeM6ReadyConformance,
  validateSyntheticM6ReleaseRecord,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const M6_EVIDENCE_SCHEMA = "cadr-m6-real-wasm-conformance-evidence-v1";
export const M6_EVIDENCE_RELATIVE_PATH =
  "cadr-web/oracle/cadr-m6-wasm-conformance.json";
export const M6_RELEASE_RELATIVE_PATH =
  "cadr-web/oracle/cadr-m6-release-record.json";
export const M6_PROFILE_RELATIVE_PATH = "cadr-web/profiles/cadr-web-303.json";
export const M6_WASM_IDENTITY = Object.freeze({
  path: "cadr-web/build/cadr-web-m5-O0.wasm",
  byte_count: 192819,
  sha256: "4b71307d0e299b6d6f55b8265ac9d66f63710099c4aa414154c631eba0475d88",
});

const REQUIRED_KINDS = Object.freeze([1, 2, 4, 5, 3]);
const SOURCE_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, id: "cadr-web-303-runnable-template",
    local_path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, id: "prom-control-store",
    local_path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, id: "prom-symbols",
    local_path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, id: "microcode-symbols",
    local_path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, id: "system-303-0-base-disk",
    local_path: "l/usim/disk-sys-303-0.img" }),
]);
const FIXED_NATIVE_INPUTS = Object.freeze([
  Object.freeze({
    id: "usite-extra-hosts",
    byte_count: "262",
    sha256: "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
  }),
]);

function fail(message) {
  throw new TypeError(`C-M6 Wasm evidence: ${message}`);
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bytesEqual(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((byte, index) => byte === right[index]);
}

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(`${label} has missing or unknown fields`);
  }
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a lowercase SHA-256 digest`);
  }
}

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("JSON contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  fail("JSON has an unsupported value");
}

/* JSON.parse deliberately accepts duplicate object members.  Evidence is a
 * signed-style identity record, so parse it ourselves and reject the second
 * spelling before a JavaScript object could silently overwrite the first. */
export function parseUniqueJson(bytes, label = "JSON") {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail(`${label} is not UTF-8: ${error.message}`);
  }
  let offset = 0;
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  const whitespace = () => {
    while (offset < text.length && " \t\r\n".includes(text[offset])) offset += 1;
  };
  const token = expected => {
    if (text[offset] !== expected) fail(`${label} has invalid JSON at byte ${offset}`);
    offset += 1;
  };
  const string = () => {
    if (text[offset] !== "\"") fail(`${label} has invalid JSON string at byte ${offset}`);
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const code = text.charCodeAt(offset);
      if (code === 0x22) {
        offset += 1;
        try {
          return JSON.parse(text.slice(start, offset));
        } catch (error) {
          fail(`${label} has invalid JSON string: ${error.message}`);
        }
      }
      if (code <= 0x1f) fail(`${label} has an unescaped control character`);
      if (code === 0x5c) {
        offset += 1;
        if (offset >= text.length) fail(`${label} ends inside a JSON escape`);
        const escaped = text[offset];
        if (escaped === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(offset + 1, offset + 5))) {
            fail(`${label} has an invalid Unicode escape`);
          }
          offset += 5;
        } else if ("\"\\/bfnrt".includes(escaped)) {
          offset += 1;
        } else {
          fail(`${label} has an invalid JSON escape`);
        }
      } else {
        offset += 1;
      }
    }
    fail(`${label} ends inside a JSON string`);
  };
  const value = () => {
    whitespace();
    const character = text[offset];
    if (character === "\"") return string();
    if (character === "{") {
      token("{"); whitespace();
      const object = Object.create(null);
      const seen = new Set();
      if (text[offset] === "}") {
        offset += 1;
        return object;
      }
      while (true) {
        whitespace();
        const key = string();
        if (seen.has(key)) fail(`${label} contains duplicate JSON member ${JSON.stringify(key)}`);
        seen.add(key);
        whitespace(); token(":");
        object[key] = value();
        whitespace();
        if (text[offset] === "}") {
          offset += 1;
          return object;
        }
        token(",");
      }
    }
    if (character === "[") {
      token("["); whitespace();
      const array = [];
      if (text[offset] === "]") {
        offset += 1;
        return array;
      }
      while (true) {
        array.push(value());
        whitespace();
        if (text[offset] === "]") {
          offset += 1;
          return array;
        }
        token(",");
      }
    }
    for (const [literal, result] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, offset)) {
        offset += literal.length;
        return result;
      }
    }
    number.lastIndex = offset;
    const match = number.exec(text);
    if (match !== null) {
      offset = number.lastIndex;
      const result = Number(match[0]);
      if (!Number.isFinite(result)) fail(`${label} has a non-finite JSON number`);
      return result;
    }
    fail(`${label} has invalid JSON at byte ${offset}`);
  };
  const result = value();
  whitespace();
  if (offset !== text.length) fail(`${label} has trailing JSON data at byte ${offset}`);
  return result;
}

export function parseCanonicalJson(bytes, label = "JSON") {
  const value = parseUniqueJson(bytes, label);
  const canonical = new TextEncoder().encode(canonicalJson(value));
  if (!bytesEqual(new Uint8Array(bytes), canonical)) {
    fail(`${label} is not recursively canonical JSON bytes`);
  }
  return value;
}

async function loadPinnedRelease(root) {
  const releaseBytes = new Uint8Array(await readFile(resolve(root, M6_RELEASE_RELATIVE_PATH)));
  const release = parseCanonicalJson(releaseBytes, "tracked M6 release record");
  const expectedHash = hex(CADR_M6_RELEASE_RECORD_SHA256);
  if (sha256Hex(releaseBytes) !== expectedHash) {
    fail("tracked M6 release bytes differ from the production compiled digest");
  }
  await validateSyntheticM6ReleaseRecord(release);
  if (canonicalJson(release.native_inputs) !== canonicalJson(FIXED_NATIVE_INPUTS)) {
    fail("tracked M6 release native_inputs differ from the fixed native-only input");
  }
  return Object.freeze({ bytes: releaseBytes, value: release, sha256: expectedHash });
}

async function loadProfile(root) {
  const bytes = new Uint8Array(await readFile(resolve(root, M6_PROFILE_RELATIVE_PATH)));
  const profile = parseUniqueJson(bytes, "tracked CADR-WEB-303 profile");
  if (profile?.profile?.id !== "CADR-WEB-303" || !Array.isArray(profile.artifacts)) {
    fail("tracked CADR-WEB-303 profile has the wrong identity");
  }
  const byId = new Map();
  for (const artifact of profile.artifacts) {
    if (typeof artifact?.id !== "string" || byId.has(artifact.id)) {
      fail("tracked CADR-WEB-303 profile has duplicate or invalid artifact identifiers");
    }
    byId.set(artifact.id, artifact);
  }
  return Object.freeze({ value: profile, artifacts: byId });
}

function validateArtifactProfile(value, release, profile) {
  exactKeys(value, ["artifacts", "profile_id", "profile_path"], "artifact_profile");
  if (value.profile_id !== "CADR-WEB-303" ||
      value.profile_path !== M6_PROFILE_RELATIVE_PATH ||
      !Array.isArray(value.artifacts) || value.artifacts.length !== REQUIRED_KINDS.length ||
      !Array.isArray(release.artifacts) || release.artifacts.length !== REQUIRED_KINDS.length) {
    fail("artifact_profile has the wrong fixed M6 identity");
  }
  for (const [index, source] of SOURCE_LAYOUT.entries()) {
    const evidence = value.artifacts[index];
    const releaseArtifact = release.artifacts[index];
    const profileArtifact = profile.artifacts.get(source.id);
    exactKeys(evidence, ["byte_count", "id", "kind", "local_path", "sha256"],
      `artifact_profile.artifacts[${index}]`);
    if (evidence.kind !== source.kind || evidence.id !== source.id ||
        evidence.local_path !== source.local_path ||
        releaseArtifact?.kind !== source.kind ||
        typeof releaseArtifact?.byte_count !== "string" ||
        typeof releaseArtifact?.sha256 !== "string" ||
        profileArtifact?.path !== source.local_path ||
        profileArtifact?.bytes === undefined || typeof profileArtifact?.sha256 !== "string" ||
        evidence.byte_count !== releaseArtifact.byte_count ||
        evidence.sha256 !== releaseArtifact.sha256 ||
        BigInt(profileArtifact.bytes) !== BigInt(evidence.byte_count) ||
        profileArtifact.sha256 !== evidence.sha256) {
      fail(`artifact_profile artifact ${index} disagrees with the pinned release/profile`);
    }
    if (!/^[1-9][0-9]*$/.test(evidence.byte_count)) {
      fail(`artifact_profile artifact ${index} has a noncanonical byte count`);
    }
    digest(evidence.sha256, `artifact_profile artifact ${index} sha256`);
  }
}

function validateDriver(value) {
  exactKeys(value, ["protocol_version", "repetitions", "script", "synthetic_entrypoint_used"],
    "driver");
  if (value.protocol_version !== CADR_M6_PROTOCOL_VERSION || value.repetitions !== 3 ||
      value.script !== "scripts/run-cadr-m6-wasm-conformance.mjs" ||
      value.synthetic_entrypoint_used !== false) {
    fail("driver is not the exact production M6 runner");
  }
}

function validateNegativePreflight(value) {
  exactKeys(value, ["artifact_kind", "mutation_started", "outcome", "reason", "worker_created", "worker_requests"],
    "negative_preflight");
  if (value.artifact_kind !== 1 || value.mutation_started !== false ||
      value.outcome !== "failed" || value.reason !== "artifact-preflight-mismatch" ||
      value.worker_created !== false || value.worker_requests !== 0) {
    fail("negative_preflight did not prove the fixed no-worker source rejection");
  }
}

function validateReleaseEvidence(value, pinned) {
  exactKeys(value, ["contract", "native_inputs", "path", "sha256"], "release_record");
  if (!Array.isArray(value.native_inputs) || value.native_inputs.length !== FIXED_NATIVE_INPUTS.length) {
    fail("release_record has the wrong native_inputs tree");
  }
  if (value.contract !== CADR_M6_READY_CONTRACT || value.path !== M6_RELEASE_RELATIVE_PATH ||
      value.sha256 !== pinned.sha256 ||
      canonicalJson(value.native_inputs) !== canonicalJson(FIXED_NATIVE_INPUTS) ||
      canonicalJson(value.native_inputs) !== canonicalJson(pinned.value.native_inputs)) {
    fail("release_record does not bind the exact pinned release bytes and native inputs");
  }
  for (const [index, input] of value.native_inputs.entries()) {
    exactKeys(input, ["byte_count", "id", "sha256"], `release_record.native_inputs[${index}]`);
  }
}

function validateWasm(value) {
  exactKeys(value, ["byte_count", "path", "sha256"], "wasm");
  if (value.path !== M6_WASM_IDENTITY.path || value.byte_count !== M6_WASM_IDENTITY.byte_count ||
      value.sha256 !== M6_WASM_IDENTITY.sha256) {
    fail("wasm does not name the fixed M6 module identity");
  }
}

async function verifyLocalWasm(root) {
  const path = resolve(root, M6_WASM_IDENTITY.path);
  let metadata;
  try {
    metadata = await stat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("local Wasm verification was requested but the fixed M6 module is unavailable");
    }
    throw error;
  }
  if (!metadata.isFile()) fail("local fixed M6 Wasm path is not a regular file");
  const bytes = new Uint8Array(await readFile(path));
  if (bytes.byteLength !== M6_WASM_IDENTITY.byte_count ||
      sha256Hex(bytes) !== M6_WASM_IDENTITY.sha256) {
    fail("local Wasm bytes differ from the fixed M6 module identity");
  }
  return Object.freeze({ mode: "local", path: M6_WASM_IDENTITY.path,
    byte_count: bytes.byteLength, sha256: M6_WASM_IDENTITY.sha256 });
}

/* Structural mode proves the evidence itself is fully bound even in a clean
 * checkout where ignored build outputs are intentionally absent.  Passing
 * verifyLocalWasm opts into checking the locally materialized module too. */
export async function validateM6WasmEvidenceBytes(bytes, {
  repoRoot = ROOT,
  verifyLocalWasm: verifyLocal = false,
} = {}) {
  const root = resolve(repoRoot);
  const raw = new Uint8Array(bytes);
  const evidence = parseCanonicalJson(raw, "M6 Wasm evidence");
  exactKeys(evidence, [
    "artifact_profile", "conformance", "driver", "negative_preflight",
    "release_record", "schema", "wasm",
  ], "M6 Wasm evidence");
  if (evidence.schema !== M6_EVIDENCE_SCHEMA) fail("wrong outer evidence schema");
  const [pinned, profile] = await Promise.all([loadPinnedRelease(root), loadProfile(root)]);
  validateArtifactProfile(evidence.artifact_profile, pinned.value, profile);
  validateDriver(evidence.driver);
  validateNegativePreflight(evidence.negative_preflight);
  validateReleaseEvidence(evidence.release_record, pinned);
  validateWasm(evidence.wasm);
  const serializedConformance = await serializeM6ReadyConformance(evidence.conformance);
  const expectedConformance = new TextEncoder().encode(canonicalJson(evidence.conformance));
  if (!bytesEqual(serializedConformance, expectedConformance)) {
    fail("conformance is not the production canonical READY serialization");
  }
  if (evidence.conformance.release_record_sha256 !== pinned.sha256 ||
      evidence.conformance.contract !== CADR_M6_READY_CONTRACT) {
    fail("conformance does not bind the tracked exact release record");
  }
  const wasmVerification = verifyLocal ? await verifyLocalWasm(root) : Object.freeze({
    mode: "structural", local_wasm_checked: false,
    reason: "local-wasm-verification-not-requested",
  });
  return Object.freeze({
    schema: "cadr-m6-real-wasm-conformance-evidence-validation-v1",
    evidence_sha256: sha256Hex(raw),
    release_record_sha256: pinned.sha256,
    wasm_verification: wasmVerification,
  });
}

export async function validateM6WasmEvidenceFile(path = resolve(ROOT, M6_EVIDENCE_RELATIVE_PATH), options = {}) {
  return validateM6WasmEvidenceBytes(await readFile(path), options);
}

function parseArguments(argv) {
  const options = { evidence: resolve(ROOT, M6_EVIDENCE_RELATIVE_PATH), repoRoot: ROOT,
    verifyLocalWasm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--evidence") {
      const path = argv[++index];
      if (typeof path !== "string" || path.length === 0) fail("--evidence requires a pathname");
      options.evidence = resolve(path);
    } else if (argument === "--repo-root") {
      const path = argv[++index];
      if (typeof path !== "string" || path.length === 0) fail("--repo-root requires a pathname");
      options.repoRoot = resolve(path);
    } else if (argument === "--verify-local-wasm") {
      options.verifyLocalWasm = true;
    } else if (argument === "--help" || argument === "-h") {
      console.log("usage: node scripts/validate-cadr-m6-wasm-evidence.mjs [--evidence PATH] [--repo-root PATH] [--verify-local-wasm]");
      process.exit(0);
    } else {
      fail(`unknown argument ${JSON.stringify(argument)}`);
    }
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArguments(process.argv.slice(2));
  validateM6WasmEvidenceFile(options.evidence, options).then(receipt => {
    console.log(canonicalJson(receipt));
  }).catch(error => {
    console.error(error?.stack ?? String(error));
    process.exitCode = 1;
  });
}
