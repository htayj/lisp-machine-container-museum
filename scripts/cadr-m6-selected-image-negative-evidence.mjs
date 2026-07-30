/*
 * Evidence primitives for the selected-image negative gate.  This module is
 * intentionally data- and file-descriptor-only: it neither imports the CADR
 * headless driver nor has a Worker, WebAssembly, build, or guest interface.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rm } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { canonicalJson, parseCanonicalJson, sha256Hex } from
  "./cadr-m6-ready4-evidence.mjs";

export const M6_SELECTED_IMAGE_NEGATIVE_CONTRACT =
  "C-M6-SELECTED-IMAGE-NEGATIVE-v1";
export const M6_SELECTED_IMAGE_NEGATIVE_RUN_SCHEMA =
  "cadr-m6-selected-image-negative-run-v1";
export const M6_SELECTED_IMAGE_NEGATIVE_SUPERVISED_SCHEMA =
  "cadr-m6-selected-image-negative-supervised-v1";
export const M6_SELECTED_IMAGE_NEGATIVE_FAILURE_SCHEMA =
  "cadr-m6-selected-image-negative-failure-v1";
export const M6_SELECTED_IMAGE_NEGATIVE_TARGET =
  "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1";
export const M6_SELECTED_IMAGE_RELATIVE_PATH =
  "l/usim/disk-sys-303-0.img";
export const M6_SELECTED_IMAGE_NEGATIVE_REQUIRED_ENVIRONMENT = Object.freeze({
  LANG: "C", LC_ALL: "C", TZ: "UTC", UMASK: "0077",
});
export const M6_SELECTED_IMAGE_STATIC_LAUNCHER_SCHEMA =
  "cadr-m6-selected-image-guix-authority-v1";
export const M6_SELECTED_IMAGE_STATIC_LAUNCHER_SOURCE =
  "scripts/cadr-m6-selected-image-static-launcher.c";
export const M6_SELECTED_IMAGE_PINNED_NODE = Object.freeze({
  path: "/gnu/store/ja8lzccpgxrr5s3f00kq4i3b83d1l8lp-node-22.14.0/bin/node",
  derivation: "/gnu/store/3dmpza190pjx2qyg8xq801glyxcb4fi9-node-22.14.0.drv",
  package: "node", package_version: "22.14.0",
});
export const M6_SELECTED_IMAGE_PINNED_TOOLCHAIN = Object.freeze({
  path: "/gnu/store/ndnvicqyk3v45iayahf153w5cpf639iw-gcc-toolchain-14.3.0",
  derivation:
    "/gnu/store/cd1j4mll3fhahfd2alg31mc90vi5rlhn-gcc-toolchain-14.3.0.drv",
  package: "gcc-toolchain", package_version: "14.3.0",
});
export const M6_SELECTED_IMAGE_PINNED_GUIX = Object.freeze({
  path: "/gnu/store/ganla421f3g1p9rh3r68zj9djc9b807m-guix-1.5.0/bin/guix",
  byte_count: "5208",
  sha256: "e64f344b31d0c3289ad849abbb1545624cf112094b1107f8c0e4ea49e4aa62ce",
  package: "guix", package_version: "1.5.0",
});
export const M6_SELECTED_IMAGE_GUIX_ENVIRONMENT = Object.freeze({
  HOME: "/nonexistent", LANG: "C", LC_ALL: "C", TZ: "UTC",
});
export const M6_SELECTED_IMAGE_AUTHORITY_DERIVATION =
  "scripts/cadr-m6-selected-image-authority.scm";
export const M6_SELECTED_IMAGE_AUTHORITY_FILES = Object.freeze([
  Object.freeze({ relative_path: "bin/cadr-m6-selected-image-static-launcher",
    mode: "0555", role: "launcher" }),
  Object.freeze({ relative_path:
    "share/cadr-m6-selected-image-authority/scripts/run-cadr-m6-selected-image-negative.mjs",
    mode: "0444", role: "entry" }),
  Object.freeze({ relative_path:
    "share/cadr-m6-selected-image-authority/scripts/cadr-m6-selected-image-negative-evidence.mjs",
    mode: "0444", role: "module" }),
  Object.freeze({ relative_path:
    "share/cadr-m6-selected-image-authority/scripts/cadr-m6-ready4-evidence.mjs",
    mode: "0444", role: "module" }),
  Object.freeze({ relative_path:
    "share/cadr-m6-selected-image-authority/cadr-web/oracle/cadr-m6-release-record.json",
    mode: "0444", role: "release-record" }),
]);
export const M6_SELECTED_IMAGE_STATIC_BUILD_ARGUMENTS = Object.freeze([
  "-std=c11", "-nostdlib", "-static", "-Os", "-ffreestanding", "-fno-builtin",
  "-fno-ident", "-fno-stack-protector", "-fno-asynchronous-unwind-tables",
  "-fno-unwind-tables", "-Wl,--build-id=none", "-Wl,-z,noexecstack",
  "-Wl,-e,_start", `-DM6_NODE_PATH="${M6_SELECTED_IMAGE_PINNED_NODE.path}"`,
]);
export const M6_SELECTED_IMAGE_STATIC_BUILD_ENVIRONMENT = Object.freeze({
  LANG: "C", LC_ALL: "C", SOURCE_DATE_EPOCH: "0",
});
const SYNTHETIC_AUTHORITY_FILES = Object.freeze(
  M6_SELECTED_IMAGE_AUTHORITY_FILES.map((entry, index) => Object.freeze({
    ...entry, byte_count: String(index + 1), sha256: String(index + 1)
      .padStart(64, "0"),
  })));
export const M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY = Object.freeze({
  schema: M6_SELECTED_IMAGE_STATIC_LAUNCHER_SCHEMA,
  kind: "guix-store-execution-authority",
  derivation: M6_SELECTED_IMAGE_AUTHORITY_DERIVATION,
  guix: M6_SELECTED_IMAGE_PINNED_GUIX,
  guix_environment: M6_SELECTED_IMAGE_GUIX_ENVIRONMENT,
  guix_arguments: Object.freeze(["build", "-f",
    M6_SELECTED_IMAGE_AUTHORITY_DERIVATION, "--no-grafts"]),
  output_path:
    "/gnu/store/00000000000000000000000000000000-cadr-m6-selected-image-authority",
  source_closure_sha256: "00".repeat(32),
  node: M6_SELECTED_IMAGE_PINNED_NODE,
  toolchain: M6_SELECTED_IMAGE_PINNED_TOOLCHAIN,
  files: SYNTHETIC_AUTHORITY_FILES,
  elf: Object.freeze({ class: "ELF64", endian: "little",
    machine: "x86-64", pt_interp: false, pt_dynamic: false,
    dt_needed: Object.freeze([]) }),
});
const CHUNK_BYTES = 1024 * 1024;
const XOR_MASK = 0x01;

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) {
    throw new TypeError(`${label} has missing or unknown fields`);
  }
}

export function validateSelectedImageStaticLauncherBuildIdentity(value) {
  exactKeys(value, ["derivation", "elf", "files", "guix", "guix_arguments",
    "guix_environment", "kind",
    "node", "output_path", "schema", "source_closure_sha256", "toolchain"],
  "selected-image Guix authority");
  if (value.schema !== M6_SELECTED_IMAGE_STATIC_LAUNCHER_SCHEMA ||
      value.kind !== "guix-store-execution-authority" ||
      value.derivation !== M6_SELECTED_IMAGE_AUTHORITY_DERIVATION ||
      canonicalJson(value.guix) !== canonicalJson(M6_SELECTED_IMAGE_PINNED_GUIX) ||
      canonicalJson(value.guix_environment) !==
        canonicalJson(M6_SELECTED_IMAGE_GUIX_ENVIRONMENT) ||
      canonicalJson(value.guix_arguments) !== canonicalJson(["build", "-f",
        M6_SELECTED_IMAGE_AUTHORITY_DERIVATION, "--no-grafts"]) ||
      !/^\/gnu\/store\/[0-9a-df-np-sv-z]{32}-cadr-m6-selected-image-authority$/
        .test(value.output_path) ||
      !/^[0-9a-f]{64}$/.test(value.source_closure_sha256) ||
      canonicalJson(value.node) !== canonicalJson(M6_SELECTED_IMAGE_PINNED_NODE) ||
      canonicalJson(value.toolchain) !==
        canonicalJson(M6_SELECTED_IMAGE_PINNED_TOOLCHAIN) ||
      canonicalJson(value.elf) !== canonicalJson(
        M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY.elf) ||
      !Array.isArray(value.files) ||
      value.files.length !== M6_SELECTED_IMAGE_AUTHORITY_FILES.length) {
    throw new TypeError("selected-image Guix authority is not the exact reviewed profile");
  }
  const files = value.files.map((entry, index) => {
    exactKeys(entry, ["byte_count", "mode", "relative_path", "role", "sha256"],
      `selected-image Guix authority file ${index}`);
    const expected = M6_SELECTED_IMAGE_AUTHORITY_FILES[index];
    if (entry.relative_path !== expected.relative_path ||
        entry.mode !== expected.mode || entry.role !== expected.role ||
        !/^[1-9][0-9]*$/.test(entry.byte_count) ||
        !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new TypeError("selected-image Guix authority manifest differs");
    }
    return Object.freeze({ ...entry });
  });
  return Object.freeze({ ...value, files: Object.freeze(files) });
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(`${label} is not a lowercase SHA-256`);
  }
}

function positiveDecimal(value, label, { minimum = 1n } = {}) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw new TypeError(`${label} is not a positive canonical decimal`);
  }
  const parsed = BigInt(value);
  if (parsed < minimum || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TypeError(`${label} is out of supported range`);
  }
  return parsed;
}

function sourceIdentity(value, label) {
  exactKeys(value, ["byte_count", "sha256"], label);
  positiveDecimal(value.byte_count, `${label} byte_count`);
  digest(value.sha256, `${label} sha256`);
  return Object.freeze({ ...value });
}

function selectedDiskIdentity(value, label = "selected disk") {
  exactKeys(value, ["byte_count", "kind", "sha256"], label);
  if (value.kind !== 3) throw new TypeError(`${label} is not artifact kind 3`);
  const count = positiveDecimal(value.byte_count, `${label} byte_count`, {
    minimum: 2n,
  });
  digest(value.sha256, `${label} sha256`);
  return Object.freeze({ kind: 3, byte_count: count.toString(),
    sha256: value.sha256 });
}

export function selectedDiskFromReleaseRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      !Array.isArray(value.artifacts)) {
    throw new TypeError("selected-image release record lacks artifacts");
  }
  const matches = value.artifacts.filter(artifact => artifact?.kind === 3);
  if (matches.length !== 1) {
    throw new TypeError("selected-image release record must name exactly one kind-3 artifact");
  }
  return selectedDiskIdentity(matches[0], "selected-image release kind-3 artifact");
}

export function readCanonicalSelectedImageRelease(bytes) {
  const value = parseCanonicalJson(bytes, "selected-image release record");
  return Object.freeze({ value, identity: Object.freeze({
    byte_count: String(bytes.byteLength), sha256: sha256Hex(bytes),
  }), selected_disk: selectedDiskFromReleaseRecord(value) });
}

function isDescendant(root, path) {
  const relation = relative(root, path);
  return relation !== "" && relation !== ".." && !relation.startsWith(`..${sep}`) &&
    !relation.includes(`..${sep}`);
}

/* Resolve every component by lstat.  Resolving then checking only the final
 * path would give a parent-directory symlink an unintended authority. */
export async function selectedDiskPath(artifactRoot) {
  const root = resolve(artifactRoot);
  const target = resolve(root, M6_SELECTED_IMAGE_RELATIVE_PATH);
  if (!isDescendant(root, target)) {
    throw new TypeError("selected-image path escapes artifact root");
  }
  let current = root;
  const rootMetadata = await lstat(current);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new TypeError("selected-image artifact root is not a real directory");
  }
  for (const component of M6_SELECTED_IMAGE_RELATIVE_PATH.split("/")) {
    current = resolve(current, component);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) {
      throw new TypeError("selected-image path contains a symbolic link");
    }
    if (component !== "disk-sys-303-0.img" && !metadata.isDirectory()) {
      throw new TypeError("selected-image path has a non-directory component");
    }
  }
  return target;
}

async function openDirectoryNoFollow(path, label) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY |
    constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat({ bigint: true })).isDirectory()) {
      throw new TypeError(`${label} is not a directory`);
    }
    return handle;
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

/* Node does not expose openat(2).  Traversing through an already opened parent
 * directory's /proc/self/fd handle is the POSIX/Linux equivalent needed here:
 * no later replacement of an ancestor name can redirect the kind-3 open. */
async function openExactSelectedDisk(artifactRoot, expected) {
  let directory = await openDirectoryNoFollow(resolve(artifactRoot),
    "selected-image artifact root");
  try {
    for (const component of ["l", "usim"]) {
      const child = await openDirectoryNoFollow(
        `/proc/self/fd/${directory.fd}/${component}`,
        "selected-image path component");
      await directory.close(); directory = child;
    }
    const handle = await open(`/proc/self/fd/${directory.fd}/disk-sys-303-0.img`,
      constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile() || opened.size !== BigInt(expected.byte_count)) {
        throw new TypeError("selected image is not the exact regular kind-3 file");
      }
      return Object.freeze({ handle, directory, identity: Object.freeze({
        dev: opened.dev, ino: opened.ino, size: opened.size,
        ctimeNs: opened.ctimeNs, mtimeNs: opened.mtimeNs,
      }) });
    } catch (error) {
      await handle.close().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    await directory.close().catch(() => undefined);
    throw error;
  }
}

/* All three identities derive from the same descriptor read.  The XOR buffer
 * is one bounded chunk, never a materialized image; truncation simply omits
 * the final byte from that same pass. */
async function hashSelectedImageViews(handle, byteCount, afterChunkForTest = null) {
  const base = createHash("sha256"); const xor = createHash("sha256");
  const truncated = createHash("sha256"); const total = Number(byteCount);
  const xorOffset = Math.floor(total / 2); const truncatedCount = total - 1;
  for (let offset = 0; offset < total;) {
    const length = Math.min(CHUNK_BYTES, total - offset);
    const bytes = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(bytes, 0, length, offset);
    if (bytesRead !== length) {
      throw new TypeError("selected image returned a short read");
    }
    base.update(bytes);
    const altered = Buffer.from(bytes);
    if (xorOffset >= offset && xorOffset < offset + length) {
      altered[xorOffset - offset] ^= XOR_MASK;
    }
    xor.update(altered);
    if (offset < truncatedCount) {
      truncated.update(bytes.subarray(0, Math.min(length, truncatedCount - offset)));
    }
    offset += length;
    if (afterChunkForTest !== null) await afterChunkForTest(offset);
  }
  return Object.freeze({ base: base.digest("hex"), xor: xor.digest("hex"),
    truncated: truncated.digest("hex"), xor_byte_offset: String(xorOffset) });
}

async function assertSameDirectoryEntry(directory, identity) {
  const handle = await open(`/proc/self/fd/${directory.fd}/disk-sys-303-0.img`,
    constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const after = await handle.stat({ bigint: true });
    if (!after.isFile() || after.dev !== identity.dev || after.ino !== identity.ino ||
        after.size !== identity.size || after.ctimeNs !== identity.ctimeNs ||
        after.mtimeNs !== identity.mtimeNs) {
      throw new TypeError("selected image changed or was replaced during negative gate");
    }
  } finally { await handle.close(); }
}

/* Returns only identities.  The full image and both views are streamed from one
 * O_RDONLY descriptor; no buffer, tempfile, derivative image, worker, or guest
 * object is constructed. */
export async function deriveSelectedImageNegativeViews({ artifactRoot,
  selectedDisk, afterChunkForTest = null }) {
  if (afterChunkForTest !== null && typeof afterChunkForTest !== "function") {
    throw new TypeError("selected-image test chunk hook is not callable");
  }
  const expected = selectedDiskIdentity(selectedDisk);
  const opened = await openExactSelectedDisk(artifactRoot, expected);
  try {
    const count = Number(expected.byte_count);
    const hashes = await hashSelectedImageViews(opened.handle, count,
      afterChunkForTest);
    if (hashes.base !== expected.sha256) {
      throw new TypeError("selected image does not match the release kind-3 SHA-256");
    }
    const statAfter = await opened.handle.stat({ bigint: true });
    if (statAfter.dev !== opened.identity.dev ||
        statAfter.ino !== opened.identity.ino ||
        statAfter.size !== opened.identity.size ||
        statAfter.ctimeNs !== opened.identity.ctimeNs ||
        statAfter.mtimeNs !== opened.identity.mtimeNs) {
      throw new TypeError("selected image changed while deriving negative views");
    }
    await assertSameDirectoryEntry(opened.directory, opened.identity);
    if (hashes.xor === expected.sha256 || hashes.truncated === expected.sha256) {
      throw new TypeError("selected-image negative view unexpectedly retained base identity");
    }
    return Object.freeze({ base_before: Object.freeze({ byte_count: expected.byte_count,
      sha256: hashes.base }), base_after: Object.freeze({ byte_count: expected.byte_count,
      sha256: hashes.base }), negative_views: Object.freeze([
      Object.freeze({ byte_count: expected.byte_count,
        disposition: "rejected-hash-mismatch", kind: "same-length-xor-v1",
        sha256: hashes.xor, xor_byte_offset: hashes.xor_byte_offset, xor_mask: "01" }),
      Object.freeze({ byte_count: String(count - 1),
        disposition: "rejected-byte-count-mismatch", kind: "truncated-by-one-v1",
        sha256: hashes.truncated }),
    ]) });
  } finally {
    await opened.handle.close();
    await opened.directory.close();
  }
}

const RUN_KEYS = Object.freeze([
  "base_after", "base_before", "contract", "guest_execution_attempted",
  "effective_environment", "materialized_image_bytes", "negative_views", "outcome",
  "release_record", "schema", "selected_disk", "source_closure_sha256",
  "source_commit", "target", "wasm_build_attempted", "worker_constructed",
]);

export function selectedImageNegativeEffectiveEnvironment(unit) {
  if (!/^cadr-m6-selected-image-negative-[0-9a-f]{32}\.service$/.test(unit ?? "")) {
    throw new TypeError("selected-image negative unit identity is invalid");
  }
  return Object.freeze({
    LANG: "C",
    LC_ALL: "C",
    M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD: "1",
    M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT: unit,
    TZ: "UTC",
    UMASK: "0077",
  });
}

function validateEffectiveEnvironment(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("selected-image negative effective environment is invalid");
  }
  const expected = selectedImageNegativeEffectiveEnvironment(
    value.M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT);
  exactKeys(value, Object.keys(expected),
    "selected-image negative effective environment");
  for (const [name, required] of Object.entries(expected)) {
    if (value[name] !== required) {
      throw new TypeError(`selected-image negative effective environment differs at ${name}`);
    }
  }
  return Object.freeze({ ...value });
}

function validateView(value, index, selectedDisk) {
  const isXor = index === 0;
  exactKeys(value, isXor ? ["byte_count", "disposition", "kind", "sha256",
    "xor_byte_offset", "xor_mask"] : ["byte_count", "disposition", "kind", "sha256"],
  `selected-image negative view ${index}`);
  if (value.kind !== (isXor ? "same-length-xor-v1" : "truncated-by-one-v1") ||
      value.disposition !== (isXor ? "rejected-hash-mismatch" :
        "rejected-byte-count-mismatch")) {
    throw new TypeError("selected-image negative view has the wrong fixed disposition");
  }
  digest(value.sha256, `selected-image negative view ${index} sha256`);
  const expectedCount = isXor ? BigInt(selectedDisk.byte_count) :
    BigInt(selectedDisk.byte_count) - 1n;
  if (positiveDecimal(value.byte_count, `selected-image negative view ${index} byte_count`) !==
      expectedCount || value.sha256 === selectedDisk.sha256) {
    throw new TypeError("selected-image negative view does not differ from exact base");
  }
  if (isXor && (!/^(?:0|[1-9][0-9]*)$/.test(value.xor_byte_offset) ||
      BigInt(value.xor_byte_offset) >= BigInt(selectedDisk.byte_count) ||
      value.xor_mask !== "01")) {
    throw new TypeError("selected-image XOR view has the wrong bounded mutation");
  }
  return Object.freeze({ ...value });
}

export function validateSelectedImageNegativeRun(value) {
  exactKeys(value, RUN_KEYS, "selected-image negative run");
  if (value.schema !== M6_SELECTED_IMAGE_NEGATIVE_RUN_SCHEMA ||
      value.outcome !== "selected-image-negative" ||
      value.contract !== M6_SELECTED_IMAGE_NEGATIVE_CONTRACT ||
      value.target !== M6_SELECTED_IMAGE_NEGATIVE_TARGET ||
      value.materialized_image_bytes !== "0" ||
      value.worker_constructed !== false || value.wasm_build_attempted !== false ||
      value.guest_execution_attempted !== false ||
      !/^[0-9a-f]{40}$/.test(value.source_commit ?? "") ||
      !/^[0-9a-f]{64}$/.test(value.source_closure_sha256 ?? "") ||
      !Array.isArray(value.negative_views) || value.negative_views.length !== 2) {
    throw new TypeError("selected-image negative run violates its closed capability boundary");
  }
  const release = sourceIdentity(value.release_record, "selected-image release record");
  const selected = selectedDiskIdentity(value.selected_disk);
  const effectiveEnvironment = validateEffectiveEnvironment(
    value.effective_environment);
  for (const [name, identity] of [["base_before", value.base_before],
    ["base_after", value.base_after]]) {
    const checked = sourceIdentity(identity, `selected-image ${name}`);
    if (checked.byte_count !== selected.byte_count || checked.sha256 !== selected.sha256) {
      throw new TypeError(`selected-image ${name} differs from exact kind-3 input`);
    }
  }
  const views = value.negative_views.map((view, index) =>
    validateView(view, index, selected));
  return Object.freeze({ ...value, release_record: release, selected_disk: selected,
    effective_environment: effectiveEnvironment,
    negative_views: Object.freeze(views) });
}

const SUPERVISED_KEYS = Object.freeze([
  "accounting_sha256", "launcher", "launcher_source_binding_sha256",
  "outcome", "policy_sha256",
  "private_root_removed", "run", "schema", "source_stage_removed",
  "systemd_clients", "systemd_clients_source_binding_sha256",
  "transient_unit_absent",
]);
const PINNED_RECEIPTS = new WeakMap();

function validateSystemdClientIdentity(value, label, expectedPath) {
  exactKeys(value, ["ancestry", "byte_count", "dev", "gid", "ino", "mode",
    "path", "real_path", "sha256", "uid"], label);
  const executableMode = /^0[0-7]{3}$/.test(value.mode ?? "") ?
    Number.parseInt(value.mode, 8) : 0;
  if (value.uid !== "0" || value.real_path !== value.path ||
      value.path !== expectedPath ||
      !/^[1-9][0-9]*$/.test(value.byte_count ?? "") ||
      !/^(?:0|[1-9][0-9]*)$/.test(value.dev ?? "") ||
      !/^(?:0|[1-9][0-9]*)$/.test(value.gid ?? "") ||
      !/^[1-9][0-9]*$/.test(value.ino ?? "") ||
      !/^0[0-7]{3}$/.test(value.mode ?? "") ||
      (executableMode & 0o111) === 0 || (executableMode & 0o022) !== 0 ||
      !Array.isArray(value.ancestry) || value.ancestry.length !== 3) {
    throw new TypeError(`${label} lacks a root-owned immutable identity`);
  }
  digest(value.sha256, `${label} sha256`);
  const expectedAncestors = ["/", "/usr", "/usr/bin"];
  for (const [index, ancestor] of value.ancestry.entries()) {
    exactKeys(ancestor, ["dev", "gid", "ino", "mode", "path", "uid"],
      `${label} ancestor ${index}`);
    if (ancestor.uid !== "0" || ancestor.path !== expectedAncestors[index] ||
        !/^(?:0|[1-9][0-9]*)$/.test(ancestor.dev ?? "") ||
        !/^(?:0|[1-9][0-9]*)$/.test(ancestor.gid ?? "") ||
        !/^[1-9][0-9]*$/.test(ancestor.ino ?? "") ||
        !/^0[0-7]{3}$/.test(ancestor.mode ?? "") ||
        (Number.parseInt(ancestor.mode, 8) & 0o022) !== 0) {
      throw new TypeError(`${label} has an untrusted ancestor`);
    }
  }
  return Object.freeze({ ...value,
    ancestry: Object.freeze(value.ancestry.map(entry =>
      Object.freeze({ ...entry }))) });
}

function validateSystemdClients(value) {
  exactKeys(value, ["environment", "systemctl", "systemd_run"],
    "selected-image systemd clients");
  exactKeys(value.environment, ["DBUS_SESSION_BUS_ADDRESS", "LANG", "LC_ALL",
    "SYSTEMD_COLORS", "SYSTEMD_PAGER", "TZ", "XDG_RUNTIME_DIR"],
  "selected-image systemd control environment");
  if (value.environment.LANG !== "C" || value.environment.LC_ALL !== "C" ||
      value.environment.SYSTEMD_COLORS !== "0" ||
      value.environment.SYSTEMD_PAGER !== "" || value.environment.TZ !== "UTC" ||
      !/^\/run\/user\/[1-9][0-9]*$/.test(value.environment.XDG_RUNTIME_DIR ?? "") ||
      value.environment.DBUS_SESSION_BUS_ADDRESS !==
        `unix:path=${value.environment.XDG_RUNTIME_DIR}/bus`) {
    throw new TypeError("selected-image systemd control environment is not closed");
  }
  return Object.freeze({
    environment: Object.freeze({ ...value.environment }),
    systemd_run: validateSystemdClientIdentity(value.systemd_run,
      "selected-image systemd-run", "/usr/bin/systemd-run"),
    systemctl: validateSystemdClientIdentity(value.systemctl,
      "selected-image systemctl", "/usr/bin/systemctl"),
  });
}

export function selectedImageSystemdClientsSourceBinding(run, clients) {
  return sha256Hex(Buffer.from(canonicalJson({
    source_closure_sha256: run.source_closure_sha256,
    source_commit: run.source_commit,
    systemd_clients: clients,
  })));
}

export function selectedImageLauncherSourceBinding(run, launcher) {
  return sha256Hex(Buffer.from(canonicalJson({
    launcher,
    source_closure_sha256: run.source_closure_sha256,
    source_commit: run.source_commit,
  })));
}

export function validateSelectedImageNegativeSupervised(value) {
  exactKeys(value, SUPERVISED_KEYS, "selected-image negative supervised receipt");
  if (value.schema !== M6_SELECTED_IMAGE_NEGATIVE_SUPERVISED_SCHEMA ||
      value.outcome !== "selected-image-negative-supervised" ||
      value.private_root_removed !== true || value.source_stage_removed !== true ||
      value.transient_unit_absent !== true) {
    throw new TypeError("selected-image negative receipt lacks completed supervision");
  }
  digest(value.accounting_sha256, "selected-image negative accounting_sha256");
  digest(value.policy_sha256, "selected-image negative policy_sha256");
  digest(value.systemd_clients_source_binding_sha256,
    "selected-image negative systemd client source binding");
  digest(value.launcher_source_binding_sha256,
    "selected-image negative launcher source binding");
  const launcher = validateSelectedImageStaticLauncherBuildIdentity(
    value.launcher);
  const run = validateSelectedImageNegativeRun(value.run);
  if (launcher.source_closure_sha256 !== run.source_closure_sha256 ||
      value.launcher_source_binding_sha256 !==
        selectedImageLauncherSourceBinding(run, launcher)) {
    throw new TypeError(
      "selected-image launcher is not bound to the run source closure");
  }
  const systemdClients = validateSystemdClients(value.systemd_clients);
  if (value.systemd_clients_source_binding_sha256 !==
      selectedImageSystemdClientsSourceBinding(run, systemdClients)) {
    throw new TypeError(
      "selected-image systemd clients are not bound to the source closure");
  }
  return Object.freeze({ ...value,
    launcher,
    systemd_clients: systemdClients,
    run });
}

export async function readSelectedImageNegativeReceipt(path, label =
  "selected-image negative receipt") {
  const record = await readSelectedImageNegativeRecord(path, label,
    validateSelectedImageNegativeSupervised);
  return Object.freeze({ ...record, value: record.value });
}

/* A campaign holds this opaque token from its first no-follow read until its
 * final aggregation.  The canonical receipt bytes are retained privately in a
 * WeakMap, so a pathname replacement or a caller-forged descriptor cannot
 * change the prerequisite after child one has started. */
export function pinSelectedImageNegativeReceipt(receipt) {
  if (receipt === null || typeof receipt !== "object" ||
      !(receipt.bytes instanceof Uint8Array) ||
      typeof receipt.sha256 !== "string") {
    throw new TypeError("selected-image negative receipt cannot be pinned");
  }
  const bytes = Buffer.from(receipt.bytes);
  const sha256 = sha256Hex(bytes);
  if (sha256 !== receipt.sha256) {
    throw new TypeError("selected-image negative receipt changed before pinning");
  }
  const value = validateSelectedImageNegativeSupervised(
    parseCanonicalJson(bytes, "pinned selected-image negative receipt"));
  const token = Object.freeze({
    launcher_source_binding_sha256: value.launcher_source_binding_sha256,
    receipt_sha256: sha256,
    source_closure_sha256: value.run.source_closure_sha256,
    source_commit: value.run.source_commit });
  PINNED_RECEIPTS.set(token, bytes);
  return token;
}

export function validatePinnedSelectedImageNegativeReceipt(token) {
  exactKeys(token, ["launcher_source_binding_sha256", "receipt_sha256",
    "source_closure_sha256", "source_commit"],
    "pinned selected-image negative receipt");
  digest(token.launcher_source_binding_sha256,
    "pinned selected-image negative launcher source binding");
  digest(token.receipt_sha256, "pinned selected-image negative receipt SHA-256");
  digest(token.source_closure_sha256,
    "pinned selected-image negative source closure SHA-256");
  if (!/^[0-9a-f]{40}$/.test(token.source_commit ?? "")) {
    throw new TypeError("pinned selected-image negative source commit is invalid");
  }
  const bytes = PINNED_RECEIPTS.get(token);
  if (bytes === undefined || sha256Hex(bytes) !== token.receipt_sha256) {
    throw new TypeError("selected-image negative prerequisite was not retained from its initial read");
  }
  const value = validateSelectedImageNegativeSupervised(
    parseCanonicalJson(bytes, "pinned selected-image negative receipt"));
  if (value.run.source_commit !== token.source_commit ||
      value.run.source_closure_sha256 !== token.source_closure_sha256 ||
      value.launcher_source_binding_sha256 !==
        token.launcher_source_binding_sha256) {
    throw new TypeError("pinned selected-image negative receipt identity changed");
  }
  return Object.freeze({ token, value });
}

async function readSelectedImageNegativeRecord(path, label, validate) {
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
    return Object.freeze({ bytes, sha256: sha256Hex(bytes),
      value: validate(parseCanonicalJson(bytes, label)) });
  } finally {
    await handle.close();
  }
}

export async function readSelectedImageNegativeRun(path, label =
  "selected-image negative run") {
  return readSelectedImageNegativeRecord(path, label,
    validateSelectedImageNegativeRun);
}

export function assertSelectedImageNegativePrerequisite(receipt, run) {
  const prerequisite = validateSelectedImageNegativeSupervised(receipt);
  if (prerequisite.run.source_commit !== run.source_commit ||
      prerequisite.run.source_closure_sha256 !== run.source_closure_sha256) {
    throw new TypeError("selected-image negative receipt is not bound to READY4 source closure");
  }
  return prerequisite;
}

export async function writeCanonicalNoReplace(path, value, mode = 0o600) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = resolve(directory,
    `.${sha256Hex(Buffer.from(path))}.tmp-${process.pid}`);
  const bytes = Buffer.from(canonicalJson(value));
  let handle = null;
  try {
    handle = await open(temporary, "wx", mode);
    await handle.writeFile(bytes); await handle.sync(); await handle.close();
    handle = null;
    /* link(2) is the no-replace publication commit point. */
    await link(temporary, path);
    const parent = await open(directory, constants.O_RDONLY);
    try { await parent.sync(); } finally { await parent.close(); }
    await rm(temporary, { force: true });
    return Object.freeze({ byte_count: String(bytes.byteLength),
      sha256: sha256Hex(bytes) });
  } catch (error) {
    if (handle !== null) await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function selectedImageNegativeFailure(reason, diagnostic) {
  if (!/^[a-z0-9-]{1,64}$/.test(reason)) {
    throw new TypeError("selected-image negative failure reason is invalid");
  }
  digest(diagnostic, "selected-image negative diagnostic");
  return Object.freeze({ schema: M6_SELECTED_IMAGE_NEGATIVE_FAILURE_SCHEMA,
    outcome: "failed", reason, diagnostic_sha256: diagnostic });
}
