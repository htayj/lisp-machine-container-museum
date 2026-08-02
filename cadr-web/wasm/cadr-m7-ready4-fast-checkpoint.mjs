/*
 * M7 P4's READY4 fast differential bridge.  The M6-DEVID driver owns boot
 * progression and its CDRM6FASTCHAIN1; this module owns only the narrow M7
 * observation made while the exact Form-C CDRM6FAST1 reply is still awaited.
 *
 * The bridge deliberately accepts neither an ordinary M7 module nor a
 * per-boundary M5 digest batch.  It requires the selected M7-DEVID profile,
 * which combines protocol-v5 display exports with M6-DEVID's bounded fast
 * runner.  Raw native and portable frames remain caller-owned private bytes.
 */
import {
  CADR_M6_DEVID_PROFILE,
  CADR_M6_FAST_RUN_MAX_SLOTS,
  CADR_M6_FORM_C,
  CADR_M6_READY4_CONTRACT,
  CADR_M6_RELEASE_RECORD_SHA256,
  appendM6FastCheckpoint,
  appendM6FastHostWait,
  canonicalM6ReadyWitness,
  canonicalM6ReadyWitnessV4,
  parseM6DevidSummary,
  parseM6FastRunResponse,
  runM6Ready4Fast,
} from "./cadr-m6-headless-boot.mjs";
import {
  CADR_DISPLAY_ACTIVE_WORDS,
  CADR_DISPLAY_HEIGHT,
  CADR_DISPLAY_WIDTH,
  parseCdrDisp1,
} from "./cadr-display-renderer.mjs";
import {
  CADR_M7_FORM_C_BOUNDARY,
  CadrM7UnderlyingM6Failure,
  compareM7FrameCheckpoint,
  parseCdrM7N1,
} from "./cadr-m7-frame-checkpoint.mjs";
import {
  CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  createM7EffectivePageIdentityArm,
  m7EffectivePageIdentityAcknowledgementSha256,
  parseM7EffectivePageIdentityPolicy,
  validateSelectedM7P4EffectivePageIdentityAcknowledgement,
} from "./cadr-m7-effective-page-identity.mjs";

export const CADR_M7_READY4_FAST_TARGET =
  "CADR-WEB-303/ABI1.5/protocol-v5/M7-DEVID1";
export const CADR_M7_READY4_FAST_CONTRACT =
  "C-M7-P4-FAST-READY4-DIFFERENTIAL-v1";
export const CADR_M7_READY4_FAST_MODULE_SCHEMA =
  "cadr-m7-devid-module-identity-v2";
export const CADR_M7_READY4_FAST_BUILD_ARGV = Object.freeze([
  "frozen-guix-plan-v1", "bash-5.2.37", "clang-21.1.5", "wasm-ld-21.1.5",
  "coreutils-9.1", "sed-4.9", "-eu", "-c", "cadr-m7-p4-closed-o2-v1",
  "cadr-web/build/cadr-web-m7-devid-O2.wasm",
]);
export const CADR_M7_READY4_FAST_WORKER_TRANSITIVE_MODULES = Object.freeze([
  "cadr-web/browser/cadr-m13-audio-record.mjs",
  "cadr-web/wasm/cadr-display-renderer.mjs",
  "cadr-web/wasm/cadr-m5-batch.mjs",
  "cadr-web/wasm/cadr-m7-devid-failure.mjs",
  "cadr-web/wasm/cadr-m8-keyboard.mjs",
  "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
  "cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
  "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
  "cadr-web/wasm/cadr-m9-pointer.mjs",
  "cadr-web/wasm/cadr-m11-audio.mjs",
  "cadr-web/wasm/cadr-m12-debugger.mjs",
  "cadr-web/wasm/cadr-m13-audio-source.mjs",
  "cadr-web/wasm/cadr-worker.js",
]);
export const CADR_M7_READY4_FAST_REQUIRED_AUTHORITIES = Object.freeze([
  "cadr-web/Makefile",
  "cadr-web/oracle/cadr-m6-release-record.json",
  "cadr-web/profiles/cadr-web-303.json",
  "cadr-web/wasm/build-wasm.sh",
  "cadr-web/wasm/cadr-m4-block-service.mjs",
  "cadr-web/wasm/cadr-m4-media.mjs",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-m7-effective-page-identity.mjs",
  "cadr-web/wasm/cadr-m7-frame-checkpoint.mjs",
  "cadr-web/wasm/cadr-m7-ready4-fast-checkpoint.mjs",
  "scripts/run-cadr-m7-p4-fast-differential.mjs",
  ...CADR_M7_READY4_FAST_WORKER_TRANSITIVE_MODULES,
]);
export const CADR_M7_READY4_FAST_SPAN_BYTES = 128;
export const CADR_M7_READY4_FAST_MINIMUM_SPANS = Math.ceil(
  Number(CADR_M7_FORM_C_BOUNDARY) / CADR_M6_FAST_RUN_MAX_SLOTS);

const STATUS_OK = 0;

function required(condition, message) {
  if (!condition) throw new TypeError(`M7 READY4 fast checkpoint: ${message}`);
}

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function snapshotProtocolData(value, label) {
  if (value === null || value === undefined ||
      ["string", "number", "boolean", "bigint"].includes(typeof value)) {
    return value;
  }
  const bytes = bytesOf(value);
  if (bytes !== null) return bytes.slice();
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter(key => key !== "length");
    required(keys.length === value.length &&
      keys.every((key, index) => key === String(index)) &&
      Reflect.ownKeys(value).every(key => typeof key !== "symbol"),
    `${label} is not a dense data array`);
    return Object.freeze(keys.map(key => {
      const descriptor = descriptors[key];
      required(descriptor.get === undefined && descriptor.set === undefined &&
        descriptor.enumerable === true, `${label}[${key}] is not a data property`);
      return snapshotProtocolData(descriptor.value, `${label}[${key}]`);
    }));
  }
  required(typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
  `${label} is not a plain data object`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  required(Reflect.ownKeys(value).every(key => typeof key !== "symbol"),
    `${label} has symbol properties`);
  const copy = Object.create(null);
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    required(descriptor.get === undefined && descriptor.set === undefined &&
      descriptor.enumerable === true, `${label}.${key} is not a data property`);
    Object.defineProperty(copy, key, { enumerable: true, configurable: false,
      writable: false, value: snapshotProtocolData(descriptor.value, `${label}.${key}`) });
  }
  return Object.freeze(copy);
}

function sameBytes(left, right) {
  return left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index]);
}

function sameM7EffectivePageIdentityArm(left, right) {
  const sameRequest = (first, second) =>
    first.generation === second.generation &&
    first.request_id === second.request_id &&
    first.transaction_id === second.transaction_id &&
    first.issue_boundary === second.issue_boundary &&
    first.completion_boundary === second.completion_boundary &&
    first.first_block === second.first_block &&
    sameBytes(first.page_sha256, second.page_sha256);
  return left.schema === right.schema && left.profile === right.profile &&
    sameRequest(left.initial_commit, right.initial_commit) &&
    sameRequest(left.comparison_read, right.comparison_read) &&
    sameRequest(left.base_read, right.base_read) &&
    left.quiet_suffix.boundary === right.quiet_suffix.boundary &&
    left.quiet_suffix.reason === right.quiet_suffix.reason &&
    left.quiet_suffix.persistent_status === right.quiet_suffix.persistent_status &&
    left.quiet_suffix.outstanding_request_id ===
      right.quiet_suffix.outstanding_request_id;
}

function sha256(bytes) {
  return crypto.subtle.digest("SHA-256", bytes).then(value => new Uint8Array(value));
}

function exactKeys(value, keys, label) {
  required(value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} is not an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  required(actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]),
  `${label} has missing or unknown fields`);
  return value;
}

function sha256Bytes(value, label) {
  const bytes = bytesOf(value);
  required(bytes !== null && bytes.byteLength === 32, `${label} is not SHA-256 bytes`);
  return bytes;
}

function moduleFileIdentity(value) {
  exactKeys(value, ["bytes", "path", "sha256"], "selected M7-DEVID Wasm");
  required(typeof value.path === "string" &&
    value.path === "cadr-web/build/cadr-web-m7-devid-O2.wasm",
  "selected M7-DEVID Wasm path differs");
  required(Number.isSafeInteger(value.bytes) && value.bytes > 0,
    "selected M7-DEVID Wasm byte count is invalid");
  required(typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256),
    "selected M7-DEVID Wasm hash is invalid");
  return value;
}

function genericFileIdentity(value, label) {
  exactKeys(value, ["bytes", "path", "sha256"], label);
  required(typeof value.path === "string" && value.path.length > 0 &&
    !value.path.startsWith("/") && !value.path.split("/").includes("..") &&
    Number.isSafeInteger(value.bytes) && value.bytes > 0 &&
    typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256),
  `${label} is invalid`);
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deeplyFrozenCanonicalCopy(value) {
  const copy = JSON.parse(canonicalJson(value));
  const freeze = item => {
    if (item !== null && typeof item === "object") {
      for (const child of Object.values(item)) freeze(child);
      Object.freeze(item);
    }
    return item;
  };
  return freeze(copy);
}

function sourceClosure(value, label) {
  exactKeys(value, ["file_count", "schema", "sha256", "total_byte_count"], label);
  required(value.schema === "cadr-m6-stage-source-closure-v1" &&
    Number.isSafeInteger(value.file_count) && value.file_count > 0 &&
    Number.isSafeInteger(value.total_byte_count) && value.total_byte_count > 0 &&
    typeof value.sha256 === "string" && /^[0-9a-f]{64}$/.test(value.sha256),
  `${label} is not the established staged-M6 closure`);
  return value;
}

function stagedAuthority(value) {
  exactKeys(value, ["files", "full_tree_file_count", "prefix_counts", "schema"],
    "M7 staged authority");
  required(value.schema === "cadr-m7-p4-fast-authority-v2" &&
    Number.isSafeInteger(value.full_tree_file_count) &&
    Array.isArray(value.files), "M7 staged authority is incomplete");
  const paths = value.files.map((file, index) =>
    genericFileIdentity(file, `M7 staged authority file ${index}`).path);
  required(paths.every((path, index) => index === 0 || paths[index - 1] < path) &&
    CADR_M7_READY4_FAST_REQUIRED_AUTHORITIES.every(path => paths.includes(path)) &&
    value.full_tree_file_count >= paths.length,
  "M7 staged authority paths are incomplete or noncanonical");
  exactKeys(value.prefix_counts, ["core", "include", "trace"],
    "M7 staged authority prefix counts");
  for (const prefix of ["core", "include", "trace"]) {
    const count = value.prefix_counts[prefix];
    required(Number.isSafeInteger(count) && count > 0 &&
      paths.filter(path => path.startsWith(`cadr-web/${prefix}/`)).length === count,
    `M7 staged ${prefix} coverage differs`);
  }
  return value;
}

function storePath(value, suffix, label) {
  required(typeof value === "string" &&
    new RegExp(`^/gnu/store/[0-9a-df-np-sv-z]{32}-${suffix}$`).test(value),
  `${label} is not an exact Guix store path`);
  return value;
}

function buildToolchain(value) {
  exactKeys(value, ["build_environment", "guix", "schema", "toolchain"],
    "M7 build toolchain");
  required(value.schema === "cadr-m7-p4-fast-toolchain-v4",
    "M7 build toolchain receipt is incomplete");
  exactKeys(value.build_environment, ["HOME", "LANG", "LC_ALL", "TZ"],
    "M7 Guix build environment");
  required(value.build_environment.HOME === "/var/empty" &&
    value.build_environment.LANG === "C" &&
    value.build_environment.LC_ALL === "C" &&
    value.build_environment.TZ === "UTC",
  "M7 Guix build environment is not closed");
  exactKeys(value.guix, ["channel_commit", "daemon_socket", "descriptor_bytes",
    "descriptor_sha256", "store"],
    "M7 descriptor-bound Guix");
  required(value.guix.channel_commit === "230aa373f315f247852ee07dff34146e9b480aec" &&
    Number.isSafeInteger(value.guix.descriptor_bytes) &&
    value.guix.descriptor_bytes > 0 && typeof value.guix.descriptor_sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(value.guix.descriptor_sha256),
  "M7 Guix descriptor identity is invalid");
  exactKeys(value.guix.daemon_socket, ["dev", "gid", "ino", "mode", "uid"],
    "M7 Guix daemon socket identity");
  exactKeys(value.guix.store, ["dev", "gid", "ino", "mode", "uid"],
    "M7 Guix store identity");
  required(value.guix.daemon_socket.dev === 36 && value.guix.daemon_socket.ino === 4806452 &&
    value.guix.daemon_socket.uid === 944 && value.guix.daemon_socket.gid === 954 &&
    value.guix.daemon_socket.mode === 438 && value.guix.store.dev === 36 &&
    value.guix.store.ino === 389021 && value.guix.store.uid === 944 &&
    value.guix.store.gid === 954 && value.guix.store.mode === 1021,
  "M7 Guix daemon/store authority differs from the pinned host capability");
  const exact = {
    clang: ["/gnu/store/rfrk3x0n4x8br7jgknfanvy3rpn2vmgs-clang-toolchain-21.1.5.drv",
      "/gnu/store/k240495dfcfwkmlpqjf3dl8zxl9h9r82-clang-toolchain-21.1.5", 52,
      "1f301306191b398518e80a11788c9f36f5e63ddf4bd5298bfe3c06fc35dd0bfa"],
    lld: ["/gnu/store/lwl823kr8gr4n4j919gj4kvsmy255lfm-lld-21.1.5.drv",
      "/gnu/store/1hlqi2fs7fwkmyvks462n55bj6d936r0-lld-21.1.5", 7,
      "25776ef1c8f2464672895728c541c4245806e4e35451278855c839e329821598"],
    bash: ["/gnu/store/l49zk72wc49jm6dkmchafhfp4ybb28xc-bash-minimal-5.2.37.drv",
      "/gnu/store/9pi8kah55s964qfik4cqysjdq74ll4sv-bash-minimal-5.2.37", 4,
      "cd64ad45ac89616a5e194da62af23b7769164c24c10523473d6249fb03394f49"],
    coreutils: ["/gnu/store/lbwyr39f1913h5rjb8i934ss020hyv9n-coreutils-9.1.drv",
      "/gnu/store/92x5q45dgl6qynlxy66vyxdz6rk7ammd-coreutils-9.1", 8,
      "d5d8908793ff09c02f3ced999a002993b8e9d1d19545caab661d4bfafc8e6415"],
    sed: ["/gnu/store/3x01309604iiw4594habpavcrc0v6j51-sed-4.9.drv",
      "/gnu/store/2c3ikfc9h1ghl9fx765mdiwsx1nnpr0f-sed-4.9", 4,
      "ada3e663e0cc32528b2f55d537eb791733a3fb0bfd5a504167406b31b70f2937"],
  };
  exactKeys(value.toolchain, ["bash", "clang", "coreutils", "lld", "sed"],
    "M7 Guix toolchain");
  for (const name of ["bash", "clang", "coreutils", "lld", "sed"]) {
    exactKeys(value.toolchain[name], ["derivation", "output", "requisites_count",
      "requisites_sha256"],
      `M7 ${name} toolchain`);
    storePath(value.toolchain[name].derivation,
      "[^/]+\\.drv",
      `M7 ${name} derivation`);
    storePath(value.toolchain[name].output,
      "[^/]+",
      `M7 ${name} output`);
    required(value.toolchain[name].derivation === exact[name][0] &&
      value.toolchain[name].output === exact[name][1] &&
      value.toolchain[name].requisites_count === exact[name][2] &&
      value.toolchain[name].requisites_sha256 === exact[name][3],
    `M7 ${name} differs from the frozen time-machine plan`);
  }
  return value;
}

/**
 * Validate the caller-provided source/module identity before a private M7
 * worker is created.  The direct precommit tool materializes this shape from
 * closed source bytes and the selected `m7-devid` Wasm only.
 */
export function validateM7Ready4FastModuleIdentity(value) {
  exactKeys(value, ["build", "contract", "optimization", "profile",
    "protocol_version", "run_operation", "schema", "source", "target"],
  "M7 READY4 fast module identity");
  required(value.schema === CADR_M7_READY4_FAST_MODULE_SCHEMA &&
    value.contract === CADR_M7_READY4_FAST_CONTRACT &&
    value.target === CADR_M7_READY4_FAST_TARGET &&
    value.profile === "m7-devid" && value.optimization === "O2" &&
    value.protocol_version === 5 && value.run_operation === "run-until-event-m6",
  "selected M7-DEVID module profile/contract differs");
  exactKeys(value.source, ["authority_after", "authority_before",
    "closure_after", "closure_before", "commit", "signature", "tree"],
  "M7 committed source");
  required(typeof value.source.commit === "string" &&
    /^[0-9a-f]{40}$/.test(value.source.commit) &&
    typeof value.source.tree === "string" &&
    /^[0-9a-f]{40}$/.test(value.source.tree),
  "selected M7-DEVID source provenance is invalid");
  exactKeys(value.source.signature,
    ["policy", "primary_key", "signing_subkey", "status_sha256"],
    "M7 signed source policy");
  required(value.source.signature.policy ===
      "gpgv-validsig-v4-ed25519-sha512-subkey-997e-primary-3ea3-v1" &&
    value.source.signature.signing_subkey ===
      "997E2BA6B52340268A3987E3D94F0A11ACD78333" &&
    value.source.signature.primary_key ===
      "3EA36B492D7E76450D2C59267B55A97A62F6D6C0" &&
    typeof value.source.signature.status_sha256 === "string" &&
      /^[0-9a-f]{64}$/.test(value.source.signature.status_sha256),
  "M7 signed source policy differs");
  sourceClosure(value.source.closure_before, "M7 source closure before build");
  sourceClosure(value.source.closure_after, "M7 source closure after build");
  required(canonicalJson(value.source.closure_before) ===
    canonicalJson(value.source.closure_after),
  "committed staged closure changed during exact M7-DEVID O2 build");
  stagedAuthority(value.source.authority_before);
  stagedAuthority(value.source.authority_after);
  required(canonicalJson(value.source.authority_before) ===
    canonicalJson(value.source.authority_after),
  "committed staged authority changed during exact M7-DEVID O2 build");
  exactKeys(value.build, ["argv", "toolchain", "wasm"], "M7 exact build");
  required(canonicalJson(value.build.argv) ===
    canonicalJson(CADR_M7_READY4_FAST_BUILD_ARGV),
  "M7 exact build command differs");
  buildToolchain(value.build.toolchain);
  moduleFileIdentity(value.build.wasm);
  return deeplyFrozenCanonicalCopy(value);
}

function parseM6CWitnessSample(response, boundary) {
  const sample = bytesOf(response?.sample);
  required(response?.status === STATUS_OK && response?.wireSchema === "CDRM6I1" &&
    response?.boundary === boundary && response?.debugInstruction === CADR_M6_FORM_C &&
    sample !== null && sample.byteLength === 96,
  "Form-C CDRM6I1 envelope differs");
  const view = new DataView(sample.buffer, sample.byteOffset, sample.byteLength);
  required(new TextDecoder().decode(sample.subarray(0, 7)) === "CDRM6I1" &&
    sample[7] === 0 && view.getBigUint64(8, true) === CADR_M6_FORM_C &&
    (view.getBigUint64(16, true) >> 48n) === 0n &&
    (view.getBigUint64(24, true) >> 48n) === 0n &&
    (view.getUint32(60, true) & (1 << 5)) === 0 &&
    view.getUint32(64, true) === 0 && view.getUint32(68, true) === 0x18000 &&
    view.getUint32(72, true) === 3 && view.getUint32(76, true) === 0 &&
    view.getUint32(80, true) === 0 && view.getUint32(84, true) === 1 &&
    view.getUint32(88, true) === 0 && view.getUint32(92, true) === 0,
  "Form-C CDRM6I1 bytes differ");
  return sample.slice();
}

function parseFullDisplay(response, native) {
  const frame = bytesOf(response?.frame);
  required(response?.status === STATUS_OK && response?.full === true &&
    response?.updated === true && response?.width === CADR_DISPLAY_WIDTH &&
    response?.height === CADR_DISPLAY_HEIGHT &&
    response?.blackOnWhite === native.blackOnWhite && frame !== null,
  "Form-C CDRDISP1 envelope differs");
  const parsed = parseCdrDisp1(frame);
  required(parsed.full && parsed.wordCount === CADR_DISPLAY_ACTIVE_WORDS &&
    parsed.rectangles.length === 1 && parsed.rectangles[0].x === 0 &&
    parsed.rectangles[0].y === 0 &&
    parsed.rectangles[0].width === CADR_DISPLAY_WIDTH &&
    parsed.rectangles[0].height === CADR_DISPLAY_HEIGHT &&
    parsed.tvMode === native.tvMode && parsed.bow === native.blackOnWhite,
  "Form-C CDRDISP1 is not the selected full display state");
  return parsed.bytes.slice();
}

/**
 * One-client M7 hook for the M6 fast driver.  Capture happens before this
 * method resolves the CDRM6FAST1 reply to M6, so it cannot be reordered past
 * the next guest boundary by the outer driver.
 */
export class CadrM7Ready4FastBoundaryClient {
  constructor(client, nativeCapture) {
    required(client !== null && typeof client?.request === "function",
      "base protocol client is invalid");
    this.client = client;
    this.native = parseCdrM7N1(nativeCapture);
    required(this.native.boundary === CADR_M7_FORM_C_BOUNDARY,
      "native CDRM7N1 is not the exact Form-C boundary");
    this.lastBoundary = null;
    this.totalStopCount = 0;
    this.reason3StopCount = 0;
    this.settledCheckpointCount = 0;
    this.hostWaitRecords = [];
    this.lastHostWait = null;
    this.hostWaitRequestIds = new Set();
    this.settledCheckpoints = [];
    this.pendingSettled = null;
    this.hostWaitAwaitingSettlement = false;
    this.status9BeforeSettlementCount = 0;
    this.checkpoint = null;
    this.captureError = null;
  }

  async request(op, fields = {}, transfer = []) {
    if (this.captureError !== null) throw this.captureError;
    /* The fast driver must be the sole long-run path.  Refuse a seemingly
     * plausible M5 bulk-digest call before it can transfer an unbounded row
     * array or weaken the recorded CDRM6FASTCHAIN1. */
    required(op !== "run-digest-batch-m5",
      "M5 digest batches are forbidden in the fast differential path");
    const response = snapshotProtocolData(
      await this.client.request(op, fields, transfer), `M7 protocol response ${op}`);
    if (this.hostWaitAwaitingSettlement &&
        (op === "boundary-digest-v5" || op === "scheduler-queue-digest")) {
      required(response?.status === 9,
        "pre-settlement digest query did not fail with protocol status 9");
      this.status9BeforeSettlementCount += 1;
      return response;
    }
    if (op === "boundary-digest-v5" || op === "scheduler-queue-digest") {
      required(this.pendingSettled !== null,
        "checkpoint digest arrived without a settled CDRM6FAST1");
      const digest = bytesOf(response?.digest);
      required(response?.status === STATUS_OK && digest?.byteLength === 32,
        "settled checkpoint digest differs");
      if (op === "boundary-digest-v5") {
        required(this.pendingSettled.cdrstate5 === null,
          "duplicate CDRSTATE5 for one settled stop");
        this.pendingSettled.cdrstate5 = digest.slice();
      } else {
        required(this.pendingSettled.cdrstate5 !== null &&
          this.pendingSettled.cdrm5q1 === null,
        "CDRM5Q1 arrived before CDRSTATE5 or twice");
        this.pendingSettled.cdrm5q1 = digest.slice();
        this.settledCheckpoints.push(Object.freeze({
          fast: this.pendingSettled.fast.slice(),
          cdrstate5: this.pendingSettled.cdrstate5.slice(),
          cdrm5q1: this.pendingSettled.cdrm5q1.slice(),
        }));
        this.pendingSettled = null;
        this.settledCheckpointCount += 1;
      }
      return response;
    }
    if (op === "machine-info" && response?.status === STATUS_OK) {
      const info = bytesOf(response.info);
      required(info !== null && info.byteLength === 64,
        "machine-info framing differs");
      this.lastBoundary = new DataView(info.buffer, info.byteOffset, info.byteLength)
        .getBigUint64(8, true);
      return response;
    }
    if (op !== "run-until-event-m6" || response?.status !== STATUS_OK) return response;
    let fast;
    try {
      fast = parseM6FastRunResponse(response);
    } catch (error) {
      this.captureError = error;
      throw error;
    }
    required(this.lastBoundary !== null && fast.preBoundary === this.lastBoundary,
      "CDRM6FAST1 pre-boundary differs from the established machine boundary");
    required(this.pendingSettled === null,
      "next fast stop arrived before the prior settled checkpoint completed");
    required(fast.bytes.byteLength === CADR_M7_READY4_FAST_SPAN_BYTES,
      "CDRM6FAST1 has the wrong bounded transfer length");
    this.lastBoundary = fast.postBoundary;
    this.totalStopCount += 1;
    if (fast.reason === 3) {
      /* A host wait is not a CDRM6I1/CDRDISP1 checkpoint.  This selected
       * Form-C witness excludes a coincident wait: otherwise its next
       * C-owned continuation could erase this witness's exact boundary. */
      required(fast.postBoundary < CADR_M7_FORM_C_BOUNDARY,
        "selected Form-C witness excludes a reason-3 host wait at or across its capture boundary");
      required(fast.outstandingRequestId !== 0n,
        "reason-3 host wait must name a nonzero request id");
      required(!this.hostWaitRequestIds.has(fast.outstandingRequestId),
        "reason-3 host wait reused a request id");
      this.hostWaitRequestIds.add(fast.outstandingRequestId);
      this.reason3StopCount += 1;
      this.hostWaitRecords.push(fast.bytes.slice());
      this.lastHostWait = fast;
      this.hostWaitAwaitingSettlement = true;
      return response;
    }
    this.hostWaitAwaitingSettlement = false;
    this.lastHostWait = null;
    this.pendingSettled = {
      fast: fast.bytes.slice(), cdrstate5: null, cdrm5q1: null,
    };
    if (this.checkpoint !== null) return response;
    if (fast.postBoundary < CADR_M7_FORM_C_BOUNDARY) return response;
    if (fast.postBoundary !== CADR_M7_FORM_C_BOUNDARY || fast.reason !== 2 ||
        fast.debugAfter !== CADR_M6_FORM_C) {
      this.captureError = new RangeError(
        "CDRM6FAST1 crossed the exact Form-C capture boundary");
      throw this.captureError;
    }
    const witnessResponse = await this.client.request("boot-witness");
    const witness = parseM6CWitnessSample(witnessResponse,
      CADR_M7_FORM_C_BOUNDARY);
    const displayResponse = await this.client.request("display-full");
    const display = parseFullDisplay(displayResponse, this.native);
    this.checkpoint = Object.freeze({
      boundary: CADR_M7_FORM_C_BOUNDARY,
      witness_sample: witness,
      display_record: display,
      total_stop_ordinal: this.totalStopCount,
      settled_checkpoint_ordinal: this.settledCheckpointCount + 1,
      reason3_stops_before_checkpoint: this.reason3StopCount,
      captured_before_next_boundary: true,
    });
    return response;
  }
}

async function validateReady4Result(result, bridge, frozenReleaseRecord) {
  required(result?.outcome === "ready4" && result.target === CADR_M6_DEVID_PROFILE &&
    result.contract === CADR_M6_READY4_CONTRACT,
  "M6 result differs from the selected READY4 contract/profile");
  required(result.ready !== null && typeof result.ready === "object" &&
    result.boundary > CADR_M7_FORM_C_BOUNDARY &&
    Number.isSafeInteger(result.checkpointCount) &&
    Number.isSafeInteger(result.hostWaitCount) &&
    result.checkpointCount === bridge.settledCheckpointCount &&
    result.hostWaitCount === bridge.reason3StopCount &&
    bridge.totalStopCount === bridge.settledCheckpointCount +
      bridge.reason3StopCount &&
    bridge.totalStopCount >= CADR_M7_READY4_FAST_MINIMUM_SPANS &&
    bridge.pendingSettled === null && !bridge.hostWaitAwaitingSettlement,
  "M6 READY4 checkpoint-chain span count differs");
  const ready3 = sha256Bytes(result.ready.ready3Witness, "READY3 witness");
  const ready4 = sha256Bytes(result.ready.ready4Witness, "READY4 witness");
  const chain = sha256Bytes(result.checkpointChainSha256, "CDRM6FASTCHAIN1");
  const hostWaitChain = sha256Bytes(result.hostWaitChainSha256,
    "CDRM6FASTHOSTWAIT1");
  const state = sha256Bytes(result.cdrstate5Sha256, "terminal CDRSTATE5");
  const queue = sha256Bytes(result.cdrm5q1Sha256, "terminal CDRM5Q1");
  const summaryBytes = bytesOf(result.cdrm6e1);
  const summaryDigest = sha256Bytes(result.cdrm6e1Sha256, "CDRM6E1 digest");
  required(summaryBytes !== null && summaryBytes.byteLength === 512,
    "READY4 result lacks CDRM6E1 bytes");
  const [actualSummary, witnessDigest, displayDigest] = await Promise.all([
    sha256(summaryBytes), sha256(bridge.checkpoint.witness_sample),
    sha256(bridge.checkpoint.display_record),
  ]);
  required(sameBytes(actualSummary, summaryDigest),
    "CDRM6E1 bytes and digest differ");
  const summary = parseM6DevidSummary({ status: STATUS_OK, wireSchema: "CDRM6E1",
    policyId: "M6-PREFIX512-TAILSHA256-v1", summary: summaryBytes,
    summaryDigest });
  required(result.cdrm6e1SelectedMaximum === summary.selectedMaximum &&
    result.cdrm6e1TotalAccepted === summary.totalAccepted &&
    result.cdrm6e1TailEventCount === summary.tailEventCount,
  "READY4 result's CDRM6E1 projections differ");
  required(Array.isArray(result.hostWaitRecords) &&
    result.hostWaitRecords.length === bridge.hostWaitRecords.length &&
    result.hostWaitRecords.every((record, index) => {
      const bytes = bytesOf(record);
      return bytes !== null && sameBytes(bytes, bridge.hostWaitRecords[index]);
    }), "READY4 host-wait records differ from intercepted reason-3 stops");
  let expectedHostWaitChain = await sha256(
    new TextEncoder().encode("CDRM6FASTHOSTWAIT1\0"));
  for (const [index, record] of bridge.hostWaitRecords.entries()) {
    expectedHostWaitChain = await appendM6FastHostWait(
      expectedHostWaitChain, index, record);
  }
  required(sameBytes(expectedHostWaitChain, hostWaitChain),
    "CDRM6FASTHOSTWAIT1 differs from intercepted reason-3 stops");
  let expectedCheckpointChain = await sha256(
    new TextEncoder().encode("CDRM6FASTCHAIN1\0"));
  for (const [index, checkpoint] of bridge.settledCheckpoints.entries()) {
    expectedCheckpointChain = await appendM6FastCheckpoint(
      expectedCheckpointChain, index, checkpoint.fast,
      checkpoint.cdrstate5, checkpoint.cdrm5q1);
  }
  required(sameBytes(expectedCheckpointChain, chain),
    "CDRM6FASTCHAIN1 differs from settled fast checkpoints");
  const expectedReady3 = await canonicalM6ReadyWitness({
    releaseRecord: frozenReleaseRecord,
    artifactSetSha256: result.preflight?.artifactSetSha256,
    privateDiskBaseSha256: result.runEvidence?.privateDiskBaseSha256,
    formABoundary: result.ready.formABoundary,
    formBBoundary: result.ready.formBBoundary,
    listenerIdleCBoundary: result.ready.listenerIdleCBoundary,
    listenerIdleSettledBoundary: result.ready.listenerIdleSettledBoundary,
    readyBoundary: result.boundary, cdrstate5Sha256: state,
    cdrm5q1Sha256: queue, hostTranscriptSha256: result.hostTranscriptSha256,
  });
  required(sameBytes(expectedReady3, ready3),
    "READY3 witness differs from its frozen M6 inputs");
  const expectedReady4 = await canonicalM6ReadyWitnessV4({
    ready3Witness: expectedReady3, target: CADR_M6_DEVID_PROFILE,
    selectedMaximum: summary.selectedMaximum, cdrm6e1Sha256: summaryDigest,
    checkpointCount: result.checkpointCount, checkpointChainSha256: chain,
    hostWaitCount: result.hostWaitCount, hostWaitChainSha256: hostWaitChain,
  });
  required(sameBytes(expectedReady4, ready4),
    "READY4 witness differs from READY3/CDRM6E1 binding");
  return Object.freeze({ ready3WitnessSha256: ready3.slice(),
    ready4WitnessSha256: ready4.slice(), checkpointChainSha256: chain.slice(),
    hostWaitChainSha256: hostWaitChain.slice(),
    totalStopCount: bridge.totalStopCount,
    reason3StopCount: bridge.reason3StopCount,
    settledCheckpointCount: bridge.settledCheckpointCount,
    status9BeforeSettlementCount: bridge.status9BeforeSettlementCount,
    cdrstate5Sha256: state.slice(), cdrm5q1Sha256: queue.slice(),
    cdrm6e1: summary.bytes.slice(), cdrm6e1Sha256: summaryDigest.slice(),
    cdrm6e1SelectedMaximum: summary.selectedMaximum,
    cdrm6e1TotalAccepted: summary.totalAccepted,
    cdrm6e1TailEventCount: summary.tailEventCount,
    m6ReleaseRecordSha256: CADR_M6_RELEASE_RECORD_SHA256.slice(),
    witnessSha256: witnessDigest, displaySha256: displayDigest });
}

async function runM7Ready4FastCheckpointedBootInternal(config, runBoot) {
  required(typeof runBoot === "function", "M6 READY4 fast driver is absent");
  const moduleIdentity = validateM7Ready4FastModuleIdentity(config?.moduleIdentity);
  required(config.fastSlots === undefined || config.fastSlots === CADR_M6_FAST_RUN_MAX_SLOTS,
    "M7 P4 fast path requires the fixed maximum CDRM6FAST1 span");
  const frozenReleaseRecord = bytesOf(config?.ready?.releaseRecord);
  required(frozenReleaseRecord !== null && sameBytes(
    await sha256(frozenReleaseRecord), CADR_M6_RELEASE_RECORD_SHA256),
  "M7 P4 input is not the frozen M6 release record");
  let frozenRelease;
  try {
    frozenRelease = JSON.parse(new TextDecoder("utf-8", { fatal: true })
      .decode(frozenReleaseRecord));
  } catch {
    throw new TypeError("M7 READY4 fast checkpoint: frozen M6 release record is not JSON");
  }
  const bridge = new CadrM7Ready4FastBoundaryClient(config.client, config.nativeCapture);
  const effectivePageIdentityPolicy = parseM7EffectivePageIdentityPolicy({
    enabled: true, profile: CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE,
  });
  const m6 = snapshotProtocolData(await runBoot({ ...config, client: bridge,
    fastSlots: CADR_M6_FAST_RUN_MAX_SLOTS,
    m7EffectivePageIdentityPolicy: effectivePageIdentityPolicy }), "M7 READY4 result");
  /* A canonical failed M6 result is evidence, including a pre-Form-C
   * status-13 diagnostic.  Serialize it before the READY-only Form-C
   * requirement so the P4 wrapper preserves its exact bounded failure
   * receipt.  CadrM7UnderlyingM6Failure canonicalizes fail-closed, so a
   * malformed or noncanonical failed result cannot use this escape path. */
  if (m6?.outcome === "failed") {
    throw new CadrM7UnderlyingM6Failure(
      m6, bridge.checkpoint, config.requireM7DevidFailureDiagnostic === true);
  }
  required(bridge.checkpoint !== null,
    "READY4 completed without a Form-C CDRM6I1/CDRDISP1 checkpoint");
  const record = m6.m7EffectivePageIdentity;
  required(record !== null && typeof record === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(record)) &&
    Object.keys(record).sort().join(",") === "acknowledgements,arm,profile" &&
    record.profile === CADR_M7_EFFECTIVE_PAGE_IDENTITY_PROFILE &&
    Array.isArray(record.acknowledgements) &&
    record.arm !== null,
  "M7 effective-page identity result differs");
  required(record.acknowledgements.length === 1,
    "selected P4 requires exactly one effective-page identity acknowledgement");
  const identityArm = createM7EffectivePageIdentityArm(record.arm);
  const identityAcknowledgement =
    await validateSelectedM7P4EffectivePageIdentityAcknowledgement(
      record.acknowledgements[0], m6.hostTranscript);
  required(sameM7EffectivePageIdentityArm(identityArm,
    identityAcknowledgement.arm),
    "M7 effective-page acknowledgement is not bound to the selected arm");
  const identityAcknowledgementSha256 =
    await m7EffectivePageIdentityAcknowledgementSha256(
      identityAcknowledgement);
  const evidence = await validateReady4Result(m6, bridge, frozenRelease);
  const checkpoint = Object.freeze({ ...bridge.checkpoint,
    m6_release_record_sha256: evidence.m6ReleaseRecordSha256.slice() });
  const comparison = await compareM7FrameCheckpoint(config.nativeCapture, checkpoint);
  return Object.freeze({ target: CADR_M7_READY4_FAST_TARGET,
    contract: CADR_M7_READY4_FAST_CONTRACT, moduleIdentity, m6, checkpoint,
    comparison, evidence, identityAcknowledgement,
    identityAcknowledgementSha256, fast: Object.freeze({
      maximum_slots: CADR_M6_FAST_RUN_MAX_SLOTS,
      minimum_spans_to_form_c: CADR_M7_READY4_FAST_MINIMUM_SPANS,
      total_stops_to_form_c: bridge.checkpoint.total_stop_ordinal,
      total_stops: bridge.totalStopCount,
      reason3_stops: bridge.reason3StopCount,
      settled_checkpoints: bridge.settledCheckpointCount,
      bytes_per_span: CADR_M7_READY4_FAST_SPAN_BYTES,
      checkpoint_digest_bytes_per_span: 64,
      fast_record_bytes_to_form_c: bridge.checkpoint.total_stop_ordinal *
        CADR_M7_READY4_FAST_SPAN_BYTES,
      settled_digest_bytes: bridge.settledCheckpointCount * 64,
      bulk_m5_digest_batches: 0,
    }) });
}

/** Execute the selected M7-DEVID/READY4 differential path with private inputs. */
export async function runM7Ready4FastCheckpointedBoot(config) {
  return runM7Ready4FastCheckpointedBootInternal({ ...config,
    requireM7DevidFailureDiagnostic: true }, runM6Ready4Fast);
}

/** Test seam: it preserves all M7 ordering and evidence checks. */
export async function runM7Ready4FastCheckpointedBootForTest(config, runBoot) {
  return runM7Ready4FastCheckpointedBootInternal(config, runBoot);
}
