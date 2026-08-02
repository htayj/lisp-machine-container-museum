#!/usr/bin/env node
/*
 * Canonical, receipt-producing builder for the M8/M9 captured-Python
 * authority.  It is intentionally usable only while host-global Yama
 * ptrace_scope is exactly 3.
 * The Guix client and every derivation input are opened before selection and
 * passed to the child through fixed descriptors under a closed environment.
 */
import { spawnSync } from "node:child_process";
import { closeSync, constants as FS, lstatSync, openSync, readFileSync,
  writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  authorityBuildSourceClosure,
  canonicalAuthorityBuildReceiptBytes,
  elfIdentityForFd,
  nativePythonFdIdentity,
  openImmutableDescriptorPath,
  openExecutableFromPath,
  readHostPtraceScope,
} from "./run-cadr-m8-m9-input-conformance.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_FDS = Object.freeze([
  Object.freeze({ childFd: 4, role: "derivation",
    path: resolve(ROOT, "scripts/cadr-m8-m9-python-seal-authority.scm") }),
  Object.freeze({ childFd: 5, role: "launcher-source",
    path: resolve(ROOT, "scripts/cadr-m8-m9-python-seal-launcher.c") }),
  Object.freeze({ childFd: 6, role: "guard-source",
    path: resolve(ROOT, "scripts/cadr-m8-m9-prepython-guard.c") }),
  Object.freeze({ childFd: 7, role: "bootstrap-source",
    path: resolve(ROOT, "scripts/cadr-m8-m9-captured-python-bootstrap.py") }),
]);
const BUILD_ENVIRONMENT = Object.freeze({
  CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
  CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
  CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
  LANG: "C",
  LC_ALL: "C",
  TZ: "UTC",
});

function fail(message) { throw new Error(message); }
function oneStoreLine(result, suffix, label) {
  if (result.error !== undefined || result.signal !== null ||
      result.status !== 0) {
    fail(`${label} failed: ${(result.stderr ?? "").slice(-2000)}`);
  }
  const lines = result.stdout.split("\n").filter(Boolean);
  if (lines.length !== 1 || !lines[0].startsWith("/gnu/store/") ||
      !lines[0].endsWith(suffix) || /[\0\r]/.test(lines[0])) {
    fail(`${label} did not return one exact Guix store path`);
  }
  return lines[0];
}
function closeBinding(value, close = closeSync) {
  for (const fd of [...new Set(value?.descriptors ?? [])].reverse()) close(fd);
}
function sameIdentity(actual, expected, label) {
  for (const field of ["bytes", "sha256"]) {
    if (actual[field] !== expected[field]) fail(`${label} changed before Guix read it`);
  }
}
function validateBuiltElf(launcher, guard) {
  if (launcher.elf_class !== "ELF64" ||
      launcher.data !== "little-endian" || launcher.type !== 2 ||
      launcher.machine !== "x86-64" || launcher.has_pt_interp !== false ||
      launcher.has_pt_dynamic !== false ||
      guard.elf_class !== "ELF64" || guard.data !== "little-endian" ||
      guard.type !== 3 || guard.machine !== "x86-64" ||
      guard.has_pt_interp !== false || guard.has_pt_dynamic !== true) {
    fail("built launcher/guard ELF profiles are not static/shared-object exact");
  }
}
function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--receipt") {
    fail("usage: build-cadr-m8-m9-python-authority.mjs --receipt ABSOLUTE-PATH");
  }
  const path = argv[1];
  if (!path.startsWith("/") || resolve(path) !== path || path.includes("\0")) {
    fail("authority receipt output must be one canonical absolute path");
  }
  return path;
}

export function buildCanonicalAuthorityReceipt(receiptPath, {
  ptraceScope = readHostPtraceScope,
  openGuix = () => openExecutableFromPath("guix", {
    label: "immutable Guix client",
  }),
  spawn = spawnSync,
  openAuthorityArtifact = openImmutableDescriptorPath,
  openSource = openSync,
  elfForFd = elfIdentityForFd,
  lstat = lstatSync,
  writeReceipt = writeFileSync,
  close = closeSync,
} = {}) {
  const yamaPtraceScope = ptraceScope();
  if (yamaPtraceScope !== 3) {
    fail("host Yama ptrace_scope must be exactly 3 before authority build");
  }
  const sourceClosure = authorityBuildSourceClosure();
  const sourceByRole = new Map(sourceClosure.files.map(item => [item.role, item]));
  const sourceDescriptors = [];
  const authorityArtifacts = [];
  let guix;
  try {
    for (const item of SOURCE_FDS) {
      const fd = openSource(item.path, FS.O_RDONLY | FS.O_NOFOLLOW);
      const opened = Object.freeze({ ...item, fd });
      sourceDescriptors.push(opened);
      sameIdentity(nativePythonFdIdentity(fd), sourceByRole.get(item.role),
        item.role);
    }
    guix = openGuix();
    const derivationResult = spawn("/proc/self/fd/3",
      ["build", "--derivations", "-f", "/proc/self/fd/4"], {
        cwd: ROOT,
        env: { ...BUILD_ENVIRONMENT },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe", guix.fd,
          ...sourceDescriptors.map(item => item.fd)],
      });
    const derivation = oneStoreLine(derivationResult, ".drv",
      "canonical authority derivation");
    const outputResult = spawn("/proc/self/fd/3", ["build", derivation], {
      cwd: ROOT,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe", guix.fd],
    });
    const output = oneStoreLine(outputResult,
      "-cadr-m8-m9-python-seal-authority", "canonical authority build");
    const bootstrap = openAuthorityArtifact(resolve(output,
      "share/cadr-m8-m9/captured-python-bootstrap.py"), {
      label: "built authority bootstrap",
    });
    authorityArtifacts.push(bootstrap);
    const launcher = openAuthorityArtifact(resolve(output,
      "bin/cadr-m8-m9-python-seal-launcher"), {
      label: "built authority launcher", executable: true,
    });
    authorityArtifacts.push(launcher);
    const guard = openAuthorityArtifact(resolve(output,
      "lib/cadr-m8-m9-prepython-guard.so"), {
      label: "built authority guard",
    });
    authorityArtifacts.push(guard);
    sameIdentity(bootstrap.identity, sourceByRole.get("bootstrap-source"),
      "built authority bootstrap");
    const launcherElf = elfForFd(launcher.fd);
    const guardElf = elfForFd(guard.fd);
    validateBuiltElf(launcherElf, guardElf);
    const receipt = Object.freeze({
      schema: "cadr-m8-m9-python-authority-build-v1",
      yama_ptrace_scope: yamaPtraceScope,
      guix_client: Object.freeze({ path: guix.path,
        identity: guix.identity, ancestry: guix.ancestry }),
      build_environment: BUILD_ENVIRONMENT,
      source_closure: sourceClosure,
      derivation,
      output,
      authority: Object.freeze({
        bootstrap: bootstrap.identity,
        launcher: Object.freeze({ identity: launcher.identity,
          elf: launcherElf }),
        guard: Object.freeze({ identity: guard.identity,
          elf: guardElf }),
      }),
    });
    const parent = lstat(dirname(receiptPath));
    if (!parent.isDirectory() || parent.isSymbolicLink() ||
        parent.uid !== process.getuid() || (parent.mode & 0o7777) !== 0o700) {
      fail("authority receipt parent must be a current-real-UID exact 0700 directory");
    }
    writeReceipt(receiptPath, canonicalAuthorityBuildReceiptBytes(receipt), {
      flag: "wx", mode: 0o600,
    });
    return receipt;
  } finally {
    for (const artifact of authorityArtifacts.reverse()) {
      closeBinding(artifact, close);
    }
    if (guix !== undefined) closeBinding(guix, close);
    for (const item of sourceDescriptors.reverse()) close(item.fd);
  }
}

const invokedAsMain = typeof process.argv[1] === "string" &&
  resolve(process.argv[1]) === resolve(import.meta.filename);
if (invokedAsMain) {
  try {
    const receipt = buildCanonicalAuthorityReceipt(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${receipt.output}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
    process.exitCode = 1;
  }
}
