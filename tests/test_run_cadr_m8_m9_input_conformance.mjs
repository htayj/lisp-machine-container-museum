import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { closeSync, openSync } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm,
  writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
  authorityBuildSourceClosure,
  assertPermitDescriptorsUnchanged,
  capturedPythonBootstrapBytes,
  canonicalGuixRuntimeClosure,
  compileBoundM9DevidWasm,
  captureNativeMetadata,
  createDescriptorCapturedM8M9Worker,
  deriveCadrM8M9DeactivationProducer,
  nativePythonFdIdentity,
  openExecutableFromPath,
  openCapturedPythonAuthority,
  openImmutableDescriptorPath,
  openNativeFilesystemPermit,
  openPreparedFileEntries,
  openRuntimeStoreEntries,
  openNativePythonExecutable,
  quiesceKeyboardInput,
  recomputeCanonicalAuthoritySelection,
  runCapturedPythonClosureHostProbe,
  runNativeCapture,
  serializeProtocolV6Log,
} from "../scripts/run-cadr-m8-m9-input-conformance.mjs";
import { captureCadrM8M9NativePythonClosure,
  collectCadrM8M9StaticImportClosure } from
  "../scripts/cadr-m8-m9-provenance-join.mjs";
import { buildCanonicalAuthorityReceipt } from
  "../scripts/build-cadr-m8-m9-python-authority.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = resolve(root, "scripts/run-cadr-m8-m9-input-conformance.mjs");
const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = value => createHash("sha256").update(value).digest("hex");
const refused = spawnSync("node", [script], { cwd: root, encoding: "utf8" });
assert.equal(refused.status, 2, refused.stderr);
assert.deepEqual(JSON.parse(refused.stdout), {
  schema: "cadr-m8-m9-input-conformance-plan-v1",
  outcome: "blocked",
  runtime_execution_performed: false,
  reason: "explicit---execute-required",
});
const source = await readFile(script, "utf8");
const bootstrapSourceText = capturedPythonBootstrapBytes().toString("utf8");
for (const boundary of ["runpy.run_path = prohibited_dynamic_execution",
  "io.open_code = guarded_open_code",
  "builtins.compile = prohibited_dynamic_execution",
  "builtins.exec = prohibited_dynamic_execution",
  "builtins.eval = prohibited_dynamic_execution",
  "bootstrap_external.FileLoader.__init__ = guarded_file_loader_init"]) {
  assert(bootstrapSourceText.includes(boundary),
    `bootstrap mediates shared execution boundary: ${boundary}`);
}
assert.throws(() => assertPermitDescriptorsUnchanged({ entries: [{
  role: "guix-runtime-store:test", fd: 88, directory: true,
  identity: { device: "1", inode: "2" },
}] }, { fstatSyncImpl: () => ({ isDirectory: () => true,
  dev: 1n, ino: 3n }) }), /Guix runtime store|guix-runtime-store|changed during child execution/i,
"a replaced Guix store-item directory is rejected by its retained descriptor receipt");
const capturedBootstrapSource = await readFile(resolve(root,
  "scripts/cadr-m8-m9-captured-python-bootstrap.py"), "utf8");
const authorityBuilderSource = await readFile(resolve(root,
  "scripts/build-cadr-m8-m9-python-authority.sh"), "utf8");
const authorityBuilderMjsSource = await readFile(resolve(root,
  "scripts/build-cadr-m8-m9-python-authority.mjs"), "utf8");
const authorityLauncherSource = await readFile(resolve(root,
  "scripts/cadr-m8-m9-python-seal-launcher.c"), "utf8");
const x11CampaignSource = await readFile(resolve(root,
  "scripts/run-cadr-m8-m9-x11-campaign.mjs"), "utf8");
assert.match(source,
  /process\.getuid[\s\S]*process\.geteuid[\s\S]*currentUids\.has\(uid\)/,
  "host authority ancestry rejects both real and effective process UIDs");
assert.match(authorityBuilderSource,
  /case "\$ptrace_scope" in\s+3\)[\s\S]*exactly 3 before authority build/,
  "the authority wrapper rejects mode 2 before it can invoke Node");
assert.match(authorityBuilderMjsSource,
  /yamaPtraceScope !== 3[\s\S]*exactly 3 before authority build/,
  "the receipt-producing builder independently rejects an injected mode-2 decision");
assert.match(source,
  /value !== 3[\s\S]*exactly 3 before captured Python may start/,
  "the native parent rejects mode 2 from the real host-policy reader");
assert.equal([...source.matchAll(
  /requireHostPtraceScopeThree\(hostPtraceScope\(\)\)/g)].length, 2,
"both native parent entry points independently reject an injected mode-2 policy value");
assert.match(source,
  /build\.yama_ptrace_scope !== 3[\s\S]*authority build receipt has the wrong profile/,
  "the native parent rejects a mode-2 canonical build receipt");
assert.match(source,
  /value\.prepython_seal\.yama_ptrace_scope !== 3[\s\S]*did not inherit the native pre-Python controls/,
  "the native parent rejects mode 2 reported by the child seal");
assert.match(capturedBootstrapSource,
  /if yama_ptrace_scope != 3:[\s\S]*must prohibit every ptrace attach[\s\S]*build\["yama_ptrace_scope"\] != 3/,
  "the in-child bootstrap rejects both live and retained mode-2 policy");
assert.match(x11CampaignSource,
  /value\.yama_ptrace_scope !== 3[\s\S]*python\.prepython_seal\.yama_ptrace_scope !== 3/,
  "the browser/X11 receipt join rejects mode 2 at both build and runtime layers");
assert.match(capturedBootstrapSource,
  /current_uids = \{os\.getuid\(\), os\.geteuid\(\)\}[\s\S]*information\.st_uid in current_uids/,
  "stdlib and loader descriptor authority rejects current-owned 0555 components");
assert.doesNotMatch(capturedBootstrapSource,
  /root_candidate = os\.path\.realpath/,
  "stdlib roots are descriptor-walked as named rather than canonicalized before open");
assert.doesNotMatch(capturedBootstrapSource, /CADR_M8_M9_REPOSITORY_ROOT/,
  "captured Python has no repository locator after its empty-root transition");
assert.doesNotMatch(capturedBootstrapSource, /\bbootstrap_(?:compile|exec)\b/,
  "the startup gate retains no original compile or exec object in a Python module namespace");
assert.match(capturedBootstrapSource,
  /real captured root starts only after this sitecustomize module returns/,
  "the startup gate documents that the captured root, rather than the gate, is __main__");
assert.match(authorityLauncherSource,
  /PYTHONPATH=\/tmp\/cadr-captured[\s\S]*python_argv\[3\] = argv\[1\]/,
  "the static authority launcher supplies only its sealed startup hook and runs the root as the script");
assert.doesNotMatch(source, /--setenv", "CADR_M8_M9_REPOSITORY_ROOT"/,
  "Bubblewrap does not pass a repository-root environment locator to the child");
for (const needle of ["native-capture", "CDRM8N1", "CDRINP1", "CDRIOB91",
  "runM6Ready4Fast", "m6DiskEvidencePolicy: true", "CADR_M6_DEVID_PROFILE",
  "CADR_M6_READY4_CONTRACT", "fastSlots: 1048576", "readyLimit",
  "fresh private ignored 0700 session", "synthetic fallback",
  "wireRecords", "coreObservations", "expected-input.cdrinp1",
  "observed-input.cdrinp1", "expected-input-states.json",
  "observed-input-states.json", "worker-core-payloads-identical-to-expected",
  "process.versions.v8", "DEVID-READY4-DIRECT-BOUNDARY-NON-CW2",
  "--portable-canary", "READY4-O2-KEY-POINTER-CANARY",
  "did not deliver exactly four CDRINP1 records"]) {
  assert.ok(source.includes(needle), `runner omits ${needle}`);
}
const canaryWrongVariant = spawnSync("node", [script, "--execute", "--portable-canary",
  "--variant", "O0"], { cwd: root, encoding: "utf8" });
assert.equal(canaryWrongVariant.status, 1);
assert.match(canaryWrongVariant.stderr, /limited to the selected O2 M9-DEVID build/);
assert.ok(source.indexOf("expected-input.cdrinp1") !== source.indexOf("observed-input.cdrinp1"));
const logBytes = serializeProtocolV6Log([
  { schema: "cadr-m8-m9-portable-session-v1", session_id: "portable-test" },
  { session_id: "portable-test", id: 1, op: "instantiate", status: 0, lifecycle: "RUNNING" },
]);
const logText = new TextDecoder("utf-8", { fatal: true }).decode(logBytes);
assert.equal(logText.endsWith("\n"), true);
assert.equal(logText.includes("\\n"), false,
  "portable worker NDJSON contains real line delimiters rather than backslash-n bytes");
assert.deepEqual(logText.trimEnd().split("\n").map(line => JSON.parse(line)).map(row => row.id ?? 0), [0, 1],
  "the success log parser sees one JSON object per physical line");
for (const variant of ["O0", "O2"]) {
  const bound = await compileBoundM9DevidWasm(
    resolve(root, `cadr-web/build/cadr-web-m9-devid-${variant}.wasm`),
    `M9-DEVID ${variant} test module`,
  );
  assert.equal(bound.identity.path, `cadr-web/build/cadr-web-m9-devid-${variant}.wasm`);
  assert.equal(bound.identity.sha256, bound.execution.sha256);
  assert.equal(bound.identity.bytes, bound.execution.bytes);
  assert.match(bound.execution.device, /^[0-9]+$/);
  assert.match(bound.execution.inode, /^[1-9][0-9]*$/);
  const exports = new Set(WebAssembly.Module.exports(bound.module).map(entry => entry.name));
  assert.ok(exports.has("cadr_wasm_run_until_event_m6"));
  assert.ok(exports.has("cadr_wasm_m9_input_deliver"));
}

const nativePythonBinding = openNativePythonExecutable();
const nativePython = nativePythonBinding.path;
assert.match(nativePython, /^\//,
  "native capture binds an absolute Python executable before environment scrubbing");
assert.throws(() => openNativePythonExecutable({ path: "" }),
  /cannot be found on the absolute PATH/,
  "an empty PATH cannot open or resolve a Python executable");
for (const output of ["/trusted/python\nsecond", "/trusted/python\r", "/trusted/\0python",
  "/trusted/../python"]) {
  assert.throws(() => openExecutableFromPath("python3", {
    path: "/trusted/bin", realpathSyncImpl: () => output,
    openSyncImpl: () => 900,
    closeSyncImpl: () => {},
    identityForFd: () => ({
      bytes: 1, sha256: "1".repeat(64), device: "1", inode: "1",
    }),
  }), /descriptor resolved to a malformed path/,
  `resolver rejects malformed canonicalization output ${JSON.stringify(output)}`);
}
assert.match(source,
  /path = "\/proc\/sys\/kernel\/yama\/ptrace_scope"/,
  "the native parent reads the fixed host policy path; this regression does not fake proc");

{
  const currentUid = process.getuid();
  const immutableUid = currentUid === 0 ? 1 : 0;
  const currentGid = process.getegid();
  const immutableGid = currentGid === 0 ? 1 : 0;
  const makeWalk = ({ hostileReference = null, hostileMode = null,
    hostileGid = immutableGid, hostileUid = immutableUid,
    credentials = undefined } = {}) => {
    const locators = [];
    const closed = [];
    const references = ["/", "/authority", "/authority/bin", "/authority/bin/tool"];
    const fds = new Map(references.map((reference, index) => [100 + index, reference]));
    const opened = openImmutableDescriptorPath("/authority/bin/tool", {
      label: "synthetic descriptor-walk authority",
      executable: true,
      ...(credentials === undefined ? {} : { credentials }),
      openSyncImpl: locator => {
        locators.push(locator);
        return 100 + locators.length - 1;
      },
      closeSyncImpl: fd => closed.push(fd),
      fstatSyncImpl: fd => {
        const reference = fds.get(fd);
        const directory = reference !== "/authority/bin/tool";
        return {
          uid: BigInt(reference === hostileReference ? hostileUid : immutableUid),
          gid: BigInt(reference === hostileReference ? hostileGid : immutableGid),
          mode: BigInt(reference === hostileReference ? hostileMode :
            (directory ? 0o555 : 0o555)),
          dev: 1n,
          ino: BigInt(fd),
          isDirectory: () => directory,
          isFile: () => !directory,
        };
      },
      identityForFd: fd => Object.freeze({
        bytes: 1, sha256: "1".repeat(64), device: "1", inode: String(fd),
      }),
    });
    return { opened, locators, closed };
  };
  const walked = makeWalk();
  assert.deepEqual(walked.locators, ["/", "/proc/self/fd/100/authority",
    "/proc/self/fd/101/bin", "/proc/self/fd/102/tool"],
  "every component after root is opened relative to its held parent descriptor");
  assert.deepEqual(walked.opened.ancestry.map(item => item.reference),
    ["/", "/authority", "/authority/bin", "/authority/bin/tool"]);
  assert.throws(() => makeWalk({
    hostileReference: "/authority",
    hostileMode: 0o575,
    hostileGid: currentGid,
  }), /mutable or has the wrong type or owner/,
  "effective-group-writable ancestry is rejected");
  assert.throws(() => makeWalk({
    hostileReference: "/authority/bin",
    hostileMode: 0o557,
  }), /mutable or has the wrong type or owner/,
  "other-writable ancestry is rejected");
  assert.throws(() => makeWalk({
    hostileReference: "/authority/bin",
    hostileMode: 0o555,
    hostileUid: 2000,
    credentials: {
      currentUids: new Set([1000, 2000]),
      currentGroups: new Set([3000]),
    },
  }), /mutable or has the wrong type or owner/,
  "effective-UID-owned ancestry rejects even when the real UID differs");
}

const pythonFixture = await mkdtemp(resolve(tmpdir(), "cadr-m8-m9-python-fd-"));
try {
  const original = resolve(pythonFixture, "python3");
  await copyFile(nativePython, original); await chmod(original, 0o555);
  assert.throws(() => openNativePythonExecutable({
    path: pythonFixture,
  }), /mutable or has the wrong type or owner/,
  "a current-owned 0555 interpreter or ancestor is not immutable authority");
  const held = nativePythonBinding;
  assert(held.ancestry.length >= 3);
  assert(held.ancestry.every(component =>
    component.uid !== String(process.getuid())),
  "every selected-Python path component is non-current-owned");
  assert.equal(held.identity.sha256, nativePythonFdIdentity(held.fd).sha256);
  for (const fd of [...new Set(held.descriptors)].reverse()) closeSync(fd);
} finally { await rm(pythonFixture, { recursive: true, force: true }); }

await mkdir(resolve(root, "build/cadr-oracle"), { recursive: true, mode: 0o700 });
const workerFixture = await mkdtemp(resolve(root, "build/cadr-oracle/m8-worker-capture-test-"));
try {
  const entry = resolve(workerFixture, "entry.mjs");
  const dependency = resolve(workerFixture, "dependency.mjs");
  const originalDependency = "export const marker = 'descriptor-captured';\n";
  await writeFile(dependency, originalDependency);
  await writeFile(entry, [
    "import { parentPort } from 'node:worker_threads';",
    "import { marker } from './dependency.mjs';",
    "parentPort.postMessage({ marker });",
    "",
  ].join("\n"));
  const closure = await collectCadrM8M9StaticImportClosure({ roots: [entry] });
  const rootPath = closure.files.find(file => file.path.endsWith("/entry.mjs")).path;
  const capture = Object.freeze({ schema: "cadr-m8-m9-worker-capture-v1", root: rootPath,
    file_count: closure.files.length,
    sha256: sha256(`${canonicalJson({ files: closure.files,
      static_imports: closure.static_imports })}\n`),
    files: closure.files, static_imports: closure.static_imports,
    captured_modules: closure.captured_modules });
  const execution = await createDescriptorCapturedM8M9Worker({
    captureClosure: async () => capture,
    afterCapture: async () => { await writeFile(dependency,
      "export const marker = 'pathname-replacement';\n"); },
  });
  try {
    const message = await new Promise((resolveMessage, rejectMessage) => {
      execution.worker.once("message", resolveMessage);
      execution.worker.once("error", rejectMessage);
    });
    assert.deepEqual(message, { marker: "descriptor-captured" },
      "worker executes the one-shot descriptor capture while its source pathname is replaced");
    assert.match(await readFile(dependency, "utf8"), /pathname-replacement/);
  } finally {
    await execution.worker.terminate();
    await writeFile(dependency, originalDependency);
  }
  assert.equal(await readFile(dependency, "utf8"), originalDependency,
    "replacement/restore adversary leaves the test pathname restored");
} finally { await rm(workerFixture, { recursive: true, force: true }); }

const fdIdentity = Object.freeze({ bytes: 123, sha256: "a".repeat(64), device: "7", inode: "11" });
const fakeAncestry = Object.freeze([
  Object.freeze({ reference: "/", uid: "0", gid: "0", mode: "755",
    device: "1", inode: "2" }),
  Object.freeze({ reference: "/usr", uid: "0", gid: "0", mode: "755",
    device: "1", inode: "3" }),
  Object.freeze({ reference: "/usr/bin", uid: "0", gid: "0", mode: "755",
    device: "1", inode: "4" }),
  Object.freeze({ reference: "/usr/bin/python3", uid: "0", gid: "0",
    mode: "755", device: "1", inode: "5" }),
]);
const parentPythonFd = 29;
const parentLauncherFd = 31;
const parentBootstrapFd = 32;
const parentSealLauncherFd = 33;
const parentGuardFd = 34;
const parentGuixFd = 35;
const fakeLauncherElf = Object.freeze({ elf_class: "ELF64",
  data: "little-endian", version: 1, osabi: 0, type: 2,
  machine: "x86-64", entry: "4096", program_header_types: [1],
  has_pt_interp: false, has_pt_dynamic: false });
const fakeGuardElf = Object.freeze({ elf_class: "ELF64",
  data: "little-endian", version: 1, osabi: 0, type: 3,
  machine: "x86-64", entry: "0", program_header_types: [1, 2],
  has_pt_interp: false, has_pt_dynamic: true });
const fakeAuthorityElfForFd = fd => {
  if (fd === parentSealLauncherFd) return fakeLauncherElf;
  if (fd === parentGuardFd) return fakeGuardElf;
  throw new Error(`unexpected synthetic authority ELF descriptor ${fd}`);
};
const fakeBuildReceipt = Object.freeze({
  schema: "cadr-m8-m9-python-authority-build-v1",
  yama_ptrace_scope: 3,
  guix_client: Object.freeze({ path: "/gnu/store/fake-guix/bin/guix",
    identity: fdIdentity, ancestry: fakeAncestry }),
  build_environment: Object.freeze({
    CADR_M8_M9_BOOTSTRAP_SOURCE: "/proc/self/fd/7",
    CADR_M8_M9_GUARD_SOURCE: "/proc/self/fd/6",
    CADR_M8_M9_SEAL_SOURCE: "/proc/self/fd/5",
    LANG: "C", LC_ALL: "C", TZ: "UTC",
  }),
  source_closure: authorityBuildSourceClosure(),
  derivation: "/gnu/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-authority.drv",
  output: "/gnu/store/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-cadr-m8-m9-python-seal-authority",
  authority: Object.freeze({
    bootstrap: fdIdentity,
    launcher: Object.freeze({ identity: fdIdentity, elf: fakeLauncherElf }),
    guard: Object.freeze({ identity: fdIdentity, elf: fakeGuardElf }),
  }),
});
const fakeBuildReceiptSummary = Object.freeze({
  schema: fakeBuildReceipt.schema,
  bytes: Buffer.byteLength(`${canonicalJson(fakeBuildReceipt)}\n`),
  sha256: sha256(Buffer.from(`${canonicalJson(fakeBuildReceipt)}\n`)),
  derivation: fakeBuildReceipt.derivation,
  output: fakeBuildReceipt.output,
  independent_selection: Object.freeze({
    derivation: fakeBuildReceipt.derivation,
    output: fakeBuildReceipt.output,
  }),
  yama_ptrace_scope: fakeBuildReceipt.yama_ptrace_scope,
  build_environment: fakeBuildReceipt.build_environment,
  source_closure: fakeBuildReceipt.source_closure,
  guix_client: fakeBuildReceipt.guix_client,
  authority: fakeBuildReceipt.authority,
});
{
  const bootstrapIdentity = Object.freeze({
    bytes: Buffer.byteLength(capturedBootstrapSource),
    sha256: CADR_M8_M9_CAPTURED_PYTHON_BOOTSTRAP_SHA256,
    device: "8", inode: "101",
  });
  const launcherIdentity = Object.freeze({
    bytes: 4096, sha256: "d".repeat(64), device: "8", inode: "102",
  });
  const guardIdentity = Object.freeze({
    bytes: 4096, sha256: "e".repeat(64), device: "8", inode: "103",
  });
  const receipt = structuredClone(fakeBuildReceipt);
  receipt.authority = {
    bootstrap: bootstrapIdentity,
    launcher: { identity: launcherIdentity, elf: fakeLauncherElf },
    guard: { identity: guardIdentity, elf: fakeGuardElf },
  };
  const selected = {
    derivation: receipt.derivation,
    output: receipt.output,
  };
  const openFixture = ({
    selectedReceipt = receipt,
    launcherActual = launcherIdentity,
    guardActual = guardIdentity,
    selection = selected,
  } = {}) => openCapturedPythonAuthority({
    receipt: selectedReceipt,
    legacyAuthorityRoot: "",
    expectedYamaPtraceScope: 3,
    closeSyncImpl: () => {},
    recomputeSelection: () => selection,
    openGuixExecutable: () => ({
      fd: 200, identity: fdIdentity, ancestry: fakeAncestry,
      descriptors: [200],
    }),
    openDescriptorPath: path => {
      if (path.endsWith("captured-python-bootstrap.py")) {
        return { fd: 201, identity: bootstrapIdentity,
          ancestry: fakeAncestry, descriptors: [201] };
      }
      if (path.endsWith("python-seal-launcher")) {
        return { fd: 202, identity: launcherActual,
          ancestry: fakeAncestry, descriptors: [202] };
      }
      if (path.endsWith("prepython-guard.so")) {
        return { fd: 203, identity: guardActual,
          ancestry: fakeAncestry, descriptors: [203] };
      }
      throw new Error(`unexpected fixture path ${path}`);
    },
    elfForFd: fd => fd === 202 ? fakeLauncherElf : fakeGuardElf,
  });
  const accepted = openFixture();
  assert.equal(accepted.root, receipt.output);
  assert.deepEqual(accepted.build_receipt.independent_selection, selected);
  const modeTwoReceipt = structuredClone(receipt);
  modeTwoReceipt.yama_ptrace_scope = 2;
  assert.throws(() => openFixture({ selectedReceipt: modeTwoReceipt }),
    /authority build receipt has the wrong profile or store paths/,
    "the native receipt validator rejects a forged mode-2 decision before opening authority files");
  assert.throws(() => openCapturedPythonAuthority({
    receipt, legacyAuthorityRoot: "/gnu/store/caller-selected",
  }), /caller-selected .* store items are prohibited/,
  "the legacy caller-selected store-item environment is rejected");
  assert.throws(() => openFixture({
    launcherActual: { ...launcherIdentity, sha256: "f".repeat(64) },
  }), /launcher differs from the canonical build receipt/,
  "a launcher-only alternate store mutation is rejected");
  assert.throws(() => openFixture({
    guardActual: { ...guardIdentity, sha256: "f".repeat(64) },
  }), /guard differs from the canonical build receipt/,
  "a guard-only alternate store mutation is rejected");
  const alternate = structuredClone(receipt);
  alternate.output =
    "/gnu/store/cccccccccccccccccccccccccccccccc-cadr-m8-m9-python-seal-authority";
  assert.throws(() => openFixture({ selectedReceipt: alternate }),
    /caller-selected authority differs from the independently evaluated derivation/,
    "a caller-authored receipt cannot select an alternate Guix output");
  const authorityClosed = [];
  assert.throws(() => openCapturedPythonAuthority({
    receipt, legacyAuthorityRoot: "", expectedYamaPtraceScope: 3,
    closeSyncImpl: fd => authorityClosed.push(fd),
    recomputeSelection: () => selected,
    openGuixExecutable: () => ({ fd: 210, identity: fdIdentity,
      ancestry: fakeAncestry, descriptors: [210] }),
    openDescriptorPath: path => {
      if (path.endsWith("captured-python-bootstrap.py")) {
        return { fd: 211, identity: bootstrapIdentity, ancestry: fakeAncestry,
          descriptors: [211] };
      }
      throw new Error("injected authority output open failure");
    },
  }), /injected authority output open failure/,
  "authority reselector propagates a partial output-open failure");
  assert.deepEqual(authorityClosed, [211, 210],
    "authority reselector closes bootstrap and Guix descriptors after a partial open");
  const guardClosed = [];
  assert.throws(() => openCapturedPythonAuthority({
    receipt, legacyAuthorityRoot: "", expectedYamaPtraceScope: 3,
    closeSyncImpl: fd => guardClosed.push(fd),
    recomputeSelection: () => selected,
    openGuixExecutable: () => ({ fd: 220, identity: fdIdentity,
      ancestry: fakeAncestry, descriptors: [220] }),
    openDescriptorPath: path => {
      if (path.endsWith("captured-python-bootstrap.py")) {
        return { fd: 221, identity: bootstrapIdentity, ancestry: fakeAncestry,
          descriptors: [221] };
      }
      if (path.endsWith("python-seal-launcher")) {
        return { fd: 222, identity: launcherIdentity, ancestry: fakeAncestry,
          descriptors: [222] };
      }
      throw new Error("injected authority guard open failure");
    },
    elfForFd: () => fakeLauncherElf,
  }), /injected authority guard open failure/,
  "authority reselector propagates a late output open failure");
  assert.deepEqual(guardClosed, [222, 221, 220],
    "authority reselector closes launcher, bootstrap, and Guix on guard-open failure");
}
{
  const receiptDirectory = await mkdtemp(resolve(
    root, "build/cadr-oracle/m8-authority-builder-test-"));
  const receiptPath = resolve(receiptDirectory, "authority.json");
  const sourceClosure = authorityBuildSourceClosure();
  const bootstrapSource = sourceClosure.files.find(item =>
    item.role === "bootstrap-source");
  const bootstrapIdentity = {
    bytes: bootstrapSource.bytes, sha256: bootstrapSource.sha256,
    device: "9", inode: "301",
  };
  const launcherIdentity = {
    bytes: 4096, sha256: "d".repeat(64), device: "9", inode: "302",
  };
  const guardIdentity = {
    bytes: 4096, sha256: "e".repeat(64), device: "9", inode: "303",
  };
  const fakeFds = new Set([900, 901, 902, 903]);
  let invocation = 0;
  const receipt = buildCanonicalAuthorityReceipt(receiptPath, {
    ptraceScope: () => 3,
    openGuix: () => ({
      fd: 900, path: "/gnu/store/fake-guix/bin/guix",
      identity: fdIdentity, ancestry: fakeAncestry, descriptors: [900],
    }),
    spawn: (executable, args, options) => {
      invocation += 1;
      assert.equal(executable, "/proc/self/fd/3");
      assert.equal(options.env.PATH, undefined);
      assert.equal(options.env.HOME, undefined);
      if (invocation === 1) {
        assert.deepEqual(Object.keys(options.env).sort(), [
          "CADR_M8_M9_BOOTSTRAP_SOURCE", "CADR_M8_M9_GUARD_SOURCE",
          "CADR_M8_M9_SEAL_SOURCE", "LANG", "LC_ALL", "TZ",
        ]);
        assert.deepEqual(args,
          ["build", "--derivations", "-f", "/proc/self/fd/4"]);
        return { error: undefined, signal: null, status: 0,
          stdout: `${fakeBuildReceipt.derivation}\n`, stderr: "" };
      }
      assert.deepEqual(args, ["build", fakeBuildReceipt.derivation]);
      assert.deepEqual(Object.keys(options.env).sort(), ["LANG", "LC_ALL", "TZ"]);
      return { error: undefined, signal: null, status: 0,
        stdout: `${fakeBuildReceipt.output}\n`, stderr: "" };
    },
    openAuthorityArtifact: path => {
      if (path.endsWith("captured-python-bootstrap.py")) {
        return { fd: 901, identity: bootstrapIdentity, descriptors: [901] };
      }
      if (path.endsWith("python-seal-launcher")) {
        return { fd: 902, identity: launcherIdentity, descriptors: [902] };
      }
      return { fd: 903, identity: guardIdentity, descriptors: [903] };
    },
    elfForFd: fd => fd === 902 ? fakeLauncherElf : fakeGuardElf,
    close: fd => { if (!fakeFds.has(fd)) closeSync(fd); },
  });
  assert.equal(invocation, 2);
  assert.equal(receipt.output, fakeBuildReceipt.output);
  assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), receipt);
  await rm(receiptDirectory, { recursive: true, force: true });
}
{
  let openedGuix = false;
  assert.throws(() => buildCanonicalAuthorityReceipt(resolve(root,
    `build/cadr-oracle/m8-authority-mode2-${process.pid}.json`), {
    ptraceScope: () => 2,
    openGuix: () => { openedGuix = true; throw new Error("must not open Guix"); },
  }), /exactly 3 before authority build/,
  "the receipt-producing builder rejects mode 2 before it can select Guix");
  assert.equal(openedGuix, false,
    "mode 2 does not reach any builder authority acquisition");
}
{
  const sourcePaths = authorityBuildSourceClosure().files.map(item =>
    resolve(root, item.path));
  const openTrackedSources = (closed, { failAt = null } = {}) => {
    const opened = [];
    let count = 0;
    return {
      opened,
      open: (path, flags) => {
        if (count++ === failAt) throw new Error("injected source open failure");
        const fd = openSync(path, flags); opened.push(fd); return fd;
      },
      close: fd => { closed.push(fd); closeSync(fd); },
    };
  };
  const partialClosed = [];
  const partial = openTrackedSources(partialClosed, { failAt: 2 });
  assert.throws(() => buildCanonicalAuthorityReceipt(
    resolve(root, `build/cadr-oracle/m8-authority-partial-${process.pid}.json`), {
      ptraceScope: () => 3,
      openSource: partial.open, close: partial.close,
      openGuix: () => { throw new Error("Guix must not open after source failure"); },
    }), /injected source open failure/);
  assert.deepEqual(partialClosed, [...partial.opened].reverse(),
    "builder closes every earlier reviewed source descriptor after a partial open");

  const guixClosed = [];
  const guixFailure = openTrackedSources(guixClosed);
  assert.throws(() => buildCanonicalAuthorityReceipt(
    resolve(root, `build/cadr-oracle/m8-authority-guix-${process.pid}.json`), {
      ptraceScope: () => 3,
      openSource: guixFailure.open, close: guixFailure.close,
      openGuix: () => { throw new Error("injected Guix open failure"); },
    }), /injected Guix open failure/);
  assert.deepEqual(guixClosed, [...guixFailure.opened].reverse(),
    "builder closes all reviewed sources when Guix cannot be opened before spawn");

  const spawnClosed = [];
  const spawnFailure = openTrackedSources(spawnClosed);
  const guixFd = openSync(process.execPath, "r");
  assert.throws(() => buildCanonicalAuthorityReceipt(
    resolve(root, `build/cadr-oracle/m8-authority-spawn-${process.pid}.json`), {
      ptraceScope: () => 3,
      openSource: spawnFailure.open, close: fd => {
        spawnClosed.push(fd); closeSync(fd);
      },
      openGuix: () => ({ fd: guixFd, path: process.execPath,
        identity: nativePythonFdIdentity(guixFd), ancestry: fakeAncestry,
        descriptors: [guixFd] }),
      spawn: () => { throw new Error("injected builder pre-spawn failure"); },
    }), /injected builder pre-spawn failure/);
  assert.deepEqual(spawnClosed, [guixFd, ...[...spawnFailure.opened].reverse()],
    "builder closes Guix and all source descriptors when the first spawn throws");

  const reselectorClosed = [];
  let reselectorCount = 0;
  assert.throws(() => recomputeCanonicalAuthoritySelection({ fd: 999 }, {
    openSyncImpl: (path, flags) => {
      if (reselectorCount++ === 2) throw new Error("injected reselector source failure");
      return openSync(path, flags);
    },
    closeSyncImpl: fd => { reselectorClosed.push(fd); closeSync(fd); },
  }), /injected reselector source failure/);
  assert.equal(reselectorClosed.length, 2,
    "reselector closes each successfully acquired source descriptor on partial open");

  const reselectorSpawnClosed = [];
  assert.throws(() => recomputeCanonicalAuthoritySelection({ fd: 999 }, {
    openSyncImpl: openSync,
    closeSyncImpl: fd => { reselectorSpawnClosed.push(fd); closeSync(fd); },
    spawnSyncImpl: () => { throw new Error("injected reselector pre-spawn failure"); },
  }), /injected reselector pre-spawn failure/);
  assert.equal(reselectorSpawnClosed.length, 4,
    "reselector closes its complete source descriptor set when Guix spawn throws");
  const reselectorSecondSpawnClosed = [];
  let reselectorInvocation = 0;
  assert.throws(() => recomputeCanonicalAuthoritySelection({ fd: 999 }, {
    openSyncImpl: openSync,
    closeSyncImpl: fd => { reselectorSecondSpawnClosed.push(fd); closeSync(fd); },
    spawnSyncImpl: () => {
      reselectorInvocation += 1;
      if (reselectorInvocation === 1) {
        return { error: undefined, signal: null, status: 0,
          stdout: "/gnu/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-authority.drv\n",
          stderr: "" };
      }
      throw new Error("injected reselector dry-run failure");
    },
  }), /injected reselector dry-run failure/);
  assert.equal(reselectorSecondSpawnClosed.length, 4,
    "reselector closes every source descriptor after its later dry-run spawn fails");
  assert.equal(sourcePaths.length, 6,
    "authority cleanup injections retain the reviewed six-file source closure");
}
const fakeLauncherExecutable = () => ({
  fd: parentLauncherFd, path: "/usr/bin/bwrap", identity: fdIdentity,
  ancestry: fakeAncestry, descriptors: [parentLauncherFd],
});
{
  const storeRoot = "/gnu/store/" + "a".repeat(32) + "-python-3.14";
  const closure = canonicalGuixRuntimeClosure({ path: `${storeRoot}/bin/python3` },
    { fd: 91 }, { spawnSyncImpl: (executable, argv, options) => {
      assert.equal(executable, "/proc/self/fd/3");
      assert.deepEqual(argv, ["gc", "--requisites", storeRoot]);
      assert.equal(options.stdio[3], 91);
      return { status: 0, signal: null, error: undefined,
        stdout: `/gnu/store/${"b".repeat(32)}-glibc\n${storeRoot}\n`, stderr: "" };
    } });
  assert.deepEqual(closure.paths, [storeRoot,
    `/gnu/store/${"b".repeat(32)}-glibc`].sort(),
  "Guix runtime closure is one canonical sorted exact store-path receipt");
  assert.throws(() => canonicalGuixRuntimeClosure({ path: "/usr/bin/python3" },
    { fd: 91 }), /must be selected from one canonical Guix store item/);
}

const preparedPermitFixture = await mkdtemp(resolve(
  root, "build/cadr-oracle/m8-prepared-permit-test-"));
try {
  await mkdir(resolve(preparedPermitFixture, "source/usim"), { recursive: true });
  await writeFile(resolve(preparedPermitFixture, "marker.json"), "{}\n");
  for (const name of ["usim", "usim-m8-m9-direct", "usim-m8-m9-x11-witness"]) {
    const path = resolve(preparedPermitFixture, "source/usim", name);
    await writeFile(path, `exact-${name}\n`); await chmod(path, 0o755);
  }
  const opened = openPreparedFileEntries(preparedPermitFixture);
  try {
    assert.equal(opened.receipt.file_count, 4);
    assert.deepEqual(opened.receipt.executable_paths, [
      "source/usim/usim", "source/usim/usim-m8-m9-direct",
      "source/usim/usim-m8-m9-x11-witness",
    ]);
    const held = opened.entries.find(entry =>
      entry.prepared_relative_path === "source/usim/usim-m8-m9-direct");
    const before = held.identity;
    await writeFile(resolve(preparedPermitFixture,
      "source/usim/usim-m8-m9-direct"), "mutated-after-open\n");
    assert.notEqual(nativePythonFdIdentity(held.fd).sha256, before.sha256,
      "a prepared-file mutation is visible through the retained descriptor");
  } finally {
    for (const fd of [...new Set(opened.entries.flatMap(entry => entry.descriptors))]) {
      closeSync(fd);
    }
  }
  const extra = resolve(preparedPermitFixture, "source/usim/extra-executable");
  await writeFile(extra, "extra\n"); await chmod(extra, 0o755);
  assert.throws(() => openPreparedFileEntries(preparedPermitFixture),
    /unapproved executable set/,
    "an extra executable source is rejected before namespace construction");
} finally { await rm(preparedPermitFixture, { recursive: true, force: true }); }
const fakePythonExecutable = () => ({
  fd: parentPythonFd, path: "/usr/bin/python3", identity: fdIdentity,
  ancestry: fakeAncestry, descriptors: [parentPythonFd],
});
const fakePythonAuthority = () => ({
  root: fakeBuildReceipt.output,
  ancestry: [{ reference: "/gnu", uid: "0", gid: "0", mode: "755",
    device: "1", inode: "2" }],
  build_receipt: fakeBuildReceiptSummary,
  guix: { fd: parentGuixFd, identity: fdIdentity },
  bootstrap: { fd: parentBootstrapFd, identity: fdIdentity },
  launcher: { fd: parentSealLauncherFd, identity: fdIdentity },
  guard: { fd: parentGuardFd, identity: fdIdentity },
  descriptors: [parentGuixFd, parentBootstrapFd, parentSealLauncherFd,
    parentGuardFd],
});
const fakeFilesystemPermitSummary = Object.freeze({
  schema: "cadr-m8-m9-native-filesystem-permit-v1",
  repository_root_visible: false,
  selected_python_programs: [
    "scripts/cadr-m6-native-oracle.py",
    "scripts/cadr-m6-witness-schedule.py",
    "scripts/cadr-m7-native-frame-oracle.py",
    "scripts/cadr-m8-m9-native-input-oracle.py",
    "scripts/cadr-oracle.py", "scripts/cadr_oracle_trace.py",
    "scripts/verify-cadr-web-profile.py",
  ],
  guix_runtime_closure: null,
  prepared_file_closure: { root: resolve(root, "prepared") },
  synthetic_dev: null,
  mounts: [],
});
const fakeFilesystemPermit = Object.freeze({
  entries: Object.freeze([
    ["prepared-file:source/usim/usim-m8-m9-direct",
      "prepared/source/usim/usim-m8-m9-direct"],
    ["native-configuration", "config"],
    ["isolated-native-output", "output"],
    ["native-input-script", "script"],
    ["native-campaign", "campaign"],
  ].map(([role, path], index) => Object.freeze({ role,
    fd: 400 + index, destination: resolve(root, path), directory: false,
    writable: role === "isolated-native-output", identity: fdIdentity,
    descriptors: Object.freeze([400 + index]) }))),
  childPassThroughDescriptors: Object.freeze([400, 401, 402, 403, 404]),
  ownedCleanupDescriptors: Object.freeze([400, 401, 402, 403, 404]),
  summary: fakeFilesystemPermitSummary,
});
const fakeOpenFilesystemPermit = () => fakeFilesystemPermit;
function capturedPythonIdentity({ version = "test", implementation = "cpython" } = {}) {
  return { schema: "cadr-m8-m9-python-identity-v3", source_fd: 3,
    transport: "bwrap-ro-bind-fd", ...fdIdentity,
    sys_executable: { reference: "sys-executable", ...fdIdentity },
    proc_self_exe: { reference: "proc-self-exe", ...fdIdentity }, version,
    implementation, executable_ancestry: fakeAncestry, prepython_seal: {
      dumpable: 0, no_new_privileges: 1, core_soft: 0, core_hard: 0,
      yama_ptrace_scope: 3,
      authority_build_receipt: fakeBuildReceiptSummary,
      filesystem_permit: fakeFilesystemPermitSummary,
      importer_isolation: {
        sys_path: ["/usr/lib/python"],
        meta_path: ["_frozen_importlib.BuiltinImporter",
          "_frozen_importlib.FrozenImporter",
          "_frozen_importlib_external.PathFinder"],
        path_hooks: [
          "_frozen_importlib_external.FileFinder.path_hook.<locals>.path_hook_for_FileFinder",
        ],
        approved_non_file_importers: [
          "_frozen_importlib.BuiltinImporter",
          "_frozen_importlib.FrozenImporter",
        ],
        archive_paths: [],
      },
      stdlib_roots: [{ path: "/usr/lib/python", ancestry: fakeAncestry }],
      loader_files: [{ path: "/usr/lib/python/os.py", ancestry: fakeAncestry,
        file: { bytes: 1, sha256: "c".repeat(64), uid: "0", gid: "0",
          mode: "644", device: "1", inode: "9" } }],
      bootstrap: fdIdentity, launcher: fdIdentity, guard: fdIdentity,
    } };
}
function capturedResponse(python = capturedPythonIdentity(), program = fdIdentity) {
  return { status: "captured", metadata: { runtime_provenance: { python,
    program: { schema: "cadr-m8-m9-python-program-identity-v2",
      inherited_fd: 4,
      transport: "bwrap-ro-bind-data-from-one-shot-pipe",
      ...program } } } };
}
function fakeNativeSpawn(response, expectedPermit = fakeFilesystemPermit) {
  return (executable, _args, options) => {
    assert.equal(executable, "/proc/self/fd/9",
      "runner executes the root-owned namespace launcher descriptor");
    assert(_args.includes("--unshare-net"));
    assert(_args.includes("--ro-bind-data"));
    assert(_args.includes("/tmp/cadr-captured/sitecustomize.py"));
    assert(_args.some(argument => argument.startsWith("/__cadr_m8_m9_captured_python__/") &&
      argument.endsWith(".py")), "the sealed root is CPython's script argument");
    assert.deepEqual(_args.slice(_args.indexOf("--tmpfs"), _args.indexOf("--tmpfs") + 2),
      ["--tmpfs", "/"], "captured Python starts below an empty filesystem root");
    assert(_args.includes("--dev") && !_args.includes("--dev-bind"),
      "captured Python receives a fresh device tree rather than a host /dev bind");
    assert.equal(_args.some((argument, index) => argument === "--ro-bind" &&
      _args[index + 1] === "/gnu/store"), false,
    "captured Python never receives a whole-store pathname bind");
    assert(!_args.includes("--ro-bind") ||
      !_args.slice(_args.indexOf("--ro-bind"), _args.indexOf("--ro-bind") + 3).includes(root),
    "captured Python never receives a repository-wide read-only bind");
    assert(!_args.includes("-c"), "mutable Python -c bootstrap is absent");
    assert.equal(options.env.PATH, undefined, "native child environment remains scrubbed");
    assert(!_args.includes("CADR_M8_M9_REPOSITORY_ROOT"),
      "captured Python has no repository-root environment variable");
    assert(_args.includes("/__cadr_m8_m9_captured_python__"));
    assert.equal(options.stdio[3], parentPythonFd,
      "native child receives a non-3 parent descriptor specifically as child fd 3");
    assert.deepEqual(options.stdio.slice(4, 10), ["pipe", "pipe",
      parentBootstrapFd, parentSealLauncherFd, parentGuardFd,
      parentLauncherFd]);
    const helperCount = options.stdio.length - 10 -
      expectedPermit.childPassThroughDescriptors.length;
    assert(helperCount >= 0 && options.stdio.slice(10, 10 + helperCount).every(value => value === "pipe"),
      "each non-root captured Python source reaches Bubblewrap as its own one-shot pipe");
    assert.deepEqual(options.stdio.slice(10 + helperCount),
      expectedPermit.childPassThroughDescriptors,
      "only descriptor-held native/prepared/static permit entries reach Bubblewrap");
    const rootPipe = new PassThrough(); const bundlePipe = new PassThrough();
    const helperPipes = Array.from({ length: helperCount }, () => new PassThrough());
    const rootChunks = []; const bundleChunks = []; const helperChunks = helperPipes.map(() => []);
    rootPipe.on("data", chunk => rootChunks.push(chunk));
    bundlePipe.on("data", chunk => bundleChunks.push(chunk));
    helperPipes.forEach((pipe, index) => pipe.on("data", chunk => helperChunks[index].push(chunk)));
    const child = new EventEmitter(); child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdio = [null, child.stdout, child.stderr, null, rootPipe,
      bundlePipe, null, null, null, null, ...helperPipes];
    let finished = 0;
    const finish = () => {
      finished += 1; if (finished !== 2 + helperPipes.length) return;
      const bundle = JSON.parse(Buffer.concat(bundleChunks).toString("ascii"));
      assert.deepEqual(bundle.prepython_authority, {
        build_receipt: fakeBuildReceiptSummary,
        bootstrap: fdIdentity, launcher: fdIdentity, guard: fdIdentity,
      }, "pipe bundle binds every immutable pre-Python authority file");
      assert.deepEqual(bundle.filesystem_permit, fakeFilesystemPermitSummary,
        "pipe bundle commits the exact permit mounted into its empty root");
      const rootBytes = Buffer.concat(rootChunks);
      const program = { bytes: rootBytes.byteLength, sha256: sha256(rootBytes),
        closure_sha256: bundle.closure_sha256 };
      const helperBytes = helperChunks.map(chunks => Buffer.concat(chunks));
      const actualResponse = typeof response === "function"
        ? response(program, bundle, rootBytes, helperBytes) : response;
      queueMicrotask(() => { child.stderr.emit("data", Buffer.from("CDRM8PYBOOT1\n"));
        child.stdout.emit("data", Buffer.from(JSON.stringify(actualResponse)));
        child.emit("close", 0, null); });
    };
    rootPipe.on("finish", finish); bundlePipe.on("finish", finish);
    helperPipes.forEach(pipe => pipe.on("finish", finish));
    return child;
  };
}
const captureArguments = { prepared: "prepared", nativeConfig: "config", output: "output", sessionId: "session",
  diskId: "disk", inputScript: "script", campaign: "campaign" };
const cleanupClosure = Object.freeze({ root: "scripts/cleanup.py", files: [],
  dynamic_imports: [], sha256: "1".repeat(64), captured_programs: Object.freeze([
    Object.freeze({ path: "scripts/cleanup.py", bytes: Buffer.from("pass\n"),
      identity: Object.freeze({ path: "scripts/cleanup.py", bytes: 5,
        sha256: sha256(Buffer.from("pass\n")) }) }),
  ]) });
const cleanupPermit = () => Object.freeze({
  entries: Object.freeze(fakeFilesystemPermit.entries.map((entry, index) =>
    Object.freeze({ ...entry, fd: 500 + index, descriptors: [500 + index] }))),
  childPassThroughDescriptors: Object.freeze([500, 501, 502, 503, 504]),
  ownedCleanupDescriptors: Object.freeze([500, 501, 502, 503, 504]),
  summary: fakeFilesystemPermitSummary,
});
const multiDescriptorStorePermit = () => {
  const storeEntry = Object.freeze({
    fd: 512, descriptors: Object.freeze([510, 511, 512]),
    destination: `/gnu/store/${"d".repeat(32)}-python`, directory: true,
    writable: false, role: `guix-runtime-store:${"d".repeat(32)}-python`,
    identity: Object.freeze({ device: "1", inode: "3" }),
  });
  const ordinaryEntries = fakeFilesystemPermit.entries.map((entry, index) =>
    Object.freeze({ ...entry, fd: 520 + index,
      descriptors: Object.freeze([520 + index]) }));
  return Object.freeze({
    entries: Object.freeze([storeEntry, ...ordinaryEntries]),
    childPassThroughDescriptors: Object.freeze([512, 520, 521, 522, 523, 524]),
    ownedCleanupDescriptors: Object.freeze([510, 511, 512, 520, 521, 522, 523, 524]),
    summary: fakeFilesystemPermitSummary,
  });
};
{
  const closed = []; let calls = 0;
  assert.throws(() => openRuntimeStoreEntries({
    schema: "cadr-m8-m9-guix-runtime-closure-v1",
    paths: [`/gnu/store/${"e".repeat(32)}-first`,
      `/gnu/store/${"f".repeat(32)}-second`],
  }, {
    openDescriptorPath: path => {
      if (calls++ !== 0) throw new Error("injected second store-item open failure");
      return Object.freeze({ fd: 702, descriptors: Object.freeze([700, 701, 702]),
        ancestry: Object.freeze([{ reference: path, device: "1", inode: "3" }]) });
    },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected second store-item open failure/);
  assert.deepEqual(closed, [702, 701, 700],
    "runtime-store acquisition closes every owned ancestry descriptor on failure");
}
{
  const closed = []; let acquisitions = 0;
  const configBytes = Buffer.from([
    "[ucode]", "prommcr_filename=/static/promh.mcr",
    "promsym_filename=/static/promh.sym", "mcrsym_filename=/static/ucadr.sym",
    "[chaos]", "hosts=/media/hosts.text", "[disk]",
    "disk0=read-only,/media/disk.img", "",
  ].join("\n"));
  assert.throws(() => openNativeFilesystemPermit({
    prepared: resolve(root, "prepared"), nativeConfig: resolve(root, "config"),
    output: resolve(root, "output"), inputScript: resolve(root, "script"),
    campaign: resolve(root, "campaign"), runtimeStore: {
      schema: "cadr-m8-m9-guix-runtime-closure-v1", paths: ["/gnu/store/" + "a".repeat(32) + "-python"],
    },
  }, {
    readFileSyncImpl: () => configBytes,
    openPreparedClosure: () => ({ entries: [], receipt: {
      schema: "cadr-m8-m9-prepared-file-closure-v1",
      root: resolve(root, "prepared"), executable_paths: [], files: [],
      file_count: 0, sha256: "a".repeat(64),
    } }),
    openStoreEntries: () => [],
    openEntry: (path, options) => {
      if (acquisitions++ === 3) throw new Error("injected permit acquisition failure");
      const fd = 600 + acquisitions;
      return Object.freeze({ fd, destination: path, directory: options.directory,
        writable: options.writable, identity: fdIdentity, descriptors: [fd] });
    },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected permit acquisition failure/);
  assert.deepEqual(closed, [603, 602, 601],
    "permit acquisition closes every earlier descriptor before propagation");
}
{
  let nextFd = 620;
  const configBytes = Buffer.from([
    "[ucode]", "prommcr_filename=/static/promh.mcr",
    "promsym_filename=/static/promh.sym", "mcrsym_filename=/static/ucadr.sym",
    "[chaos]", "hosts=/media/hosts.text", "[disk]",
    "disk0=read-only,/media/disk.img", "",
  ].join("\n"));
  const storeEntry = Object.freeze({ fd: 612,
    descriptors: Object.freeze([610, 611, 612]),
    destination: `/gnu/store/${"a".repeat(32)}-python`, directory: true,
    writable: false, role: `guix-runtime-store:${"a".repeat(32)}-python`,
    identity: Object.freeze({ device: "1", inode: "3" }) });
  const permit = openNativeFilesystemPermit({
    prepared: resolve(root, "prepared"), nativeConfig: resolve(root, "config"),
    output: resolve(root, "output"), inputScript: resolve(root, "script"),
    campaign: resolve(root, "campaign"), runtimeStore: {
      schema: "cadr-m8-m9-guix-runtime-closure-v1",
      paths: [storeEntry.destination],
    },
  }, {
    readFileSyncImpl: () => configBytes,
    openPreparedClosure: () => ({ entries: [], receipt: {
      schema: "cadr-m8-m9-prepared-file-closure-v1",
      root: resolve(root, "prepared"), executable_paths: [], files: [],
      file_count: 0, sha256: "a".repeat(64),
    } }),
    openStoreEntries: () => [storeEntry],
    openEntry: (path, options) => {
      const fd = nextFd++;
      return Object.freeze({ fd, destination: path, directory: options.directory,
        writable: options.writable, identity: fdIdentity,
        descriptors: Object.freeze([fd]) });
    },
  });
  assert(permit.childPassThroughDescriptors.includes(612));
  assert(!permit.childPassThroughDescriptors.includes(610) &&
    !permit.childPassThroughDescriptors.includes(611),
  "only the runtime-store final descriptor is eligible for child pass-through");
  assert(permit.ownedCleanupDescriptors.includes(610) &&
    permit.ownedCleanupDescriptors.includes(611) &&
    permit.ownedCleanupDescriptors.includes(612),
  "the permit owns the runtime-store final and ancestry descriptors for cleanup");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit,
    openPythonExecutable: () => { throw new Error("injected native Python open failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected native Python open failure/);
  assert.deepEqual(closed, [],
    "native runner does not acquire permit descriptors before Python opens");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    hostPtraceScope: () => { throw new Error("injected Yama pre-spawn failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected Yama pre-spawn failure/);
  assert.deepEqual(closed, [parentPythonFd],
    "native runner closes Python before any permit descriptors are acquired");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    hostPtraceScope: () => 3,
    openPythonAuthority: () => { throw new Error("injected authority selection failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected authority selection failure/);
  assert.deepEqual(closed, [parentPythonFd],
    "native runner closes Python when authority selection fails before permit acquisition");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    hostPtraceScope: () => 3, openPythonAuthority: fakePythonAuthority,
    openLauncherExecutable: () => { throw new Error("injected launcher open failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected launcher open failure/);
  assert.deepEqual(closed, [parentPythonFd, parentGuardFd, parentSealLauncherFd,
    parentBootstrapFd, parentGuixFd, 504, 503, 502, 501, 500],
  "native runner closes authority and permit descriptors when Bubblewrap cannot open");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    hostPtraceScope: () => 3, openPythonAuthority: fakePythonAuthority,
    openLauncherExecutable: fakeLauncherExecutable,
    makePipeBundle: () => { throw new Error("injected pre-spawn pipe failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected pre-spawn pipe failure/);
  assert.deepEqual(closed, [parentPythonFd, parentLauncherFd, parentGuardFd,
    parentSealLauncherFd, parentBootstrapFd, parentGuixFd,
    504, 503, 502, 501, 500],
  "native runner closes every descriptor when captured pipe assembly fails before spawn");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runCapturedPythonClosureHostProbe(cleanupClosure, {
    filesystemPermit: permit, openPythonExecutable: fakePythonExecutable,
    hostPtraceScope: () => 3, openPythonAuthority: fakePythonAuthority,
    openLauncherExecutable: fakeLauncherExecutable,
    makePipeBundle: () => { throw new Error("injected host-probe pipe failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected host-probe pipe failure/);
  assert.deepEqual(closed, [parentPythonFd, parentLauncherFd, parentGuardFd,
    parentSealLauncherFd, parentBootstrapFd, parentGuixFd],
  "host probe closes every acquired descriptor when its pre-spawn pipe assembly fails");
}
{
  const closed = []; const permit = cleanupPermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority, hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    spawnImpl: () => { throw new Error("injected native spawn failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected native spawn failure/);
  assert.deepEqual(closed, [parentPythonFd, parentLauncherFd, parentGuardFd,
    parentSealLauncherFd, parentBootstrapFd, parentGuixFd, 504, 503, 502, 501, 500],
  "native runner closes Python, launcher, authority, and permit descriptors when spawn throws");
}
{
  const closed = []; const permit = multiDescriptorStorePermit();
  const result = await runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority, hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    identityForFd: () => fdIdentity, elfForFd: fakeAuthorityElfForFd,
    fstatSyncImpl: () => ({ isDirectory: () => true, dev: 1n, ino: 3n }),
    closeSyncImpl: fd => closed.push(fd),
    spawnImpl: fakeNativeSpawn(program =>
      capturedResponse(capturedPythonIdentity(), program), permit),
  });
  assert.equal(result.response.status, "captured");
  assert.deepEqual(closed, [parentPythonFd, parentLauncherFd, parentGuardFd,
    parentSealLauncherFd, parentBootstrapFd, parentGuixFd,
    524, 523, 522, 521, 520, 512, 511, 510],
  "successful native capture closes a store entry's final and ancestry descriptors");
}
{
  const closed = []; const permit = multiDescriptorStorePermit();
  await assert.rejects(runNativeCapture(captureArguments, {
    nativePythonClosure: cleanupClosure, assertPythonPermit: () => {},
    openFilesystemPermit: () => permit, openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority, hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    spawnImpl: () => { throw new Error("injected multi-descriptor spawn failure"); },
    closeSyncImpl: fd => closed.push(fd),
  }), /injected multi-descriptor spawn failure/);
  assert.deepEqual(closed, [parentPythonFd, parentLauncherFd, parentGuardFd,
    parentSealLauncherFd, parentBootstrapFd, parentGuixFd,
    524, 523, 522, 521, 520, 512, 511, 510],
  "failed native capture closes a store entry's final and ancestry descriptors");
}
await assert.rejects(runNativeCapture(captureArguments, {
  openPythonExecutable: fakePythonExecutable,
  openPythonAuthority: fakePythonAuthority,
  openFilesystemPermit: fakeOpenFilesystemPermit,
  hostPtraceScope: () => 3,
  openLauncherExecutable: fakeLauncherExecutable,
  elfForFd: fakeAuthorityElfForFd,
  identityForFd: () => ({ ...fdIdentity, sha256: "b".repeat(64) }), closeSyncImpl: () => {},
  spawnImpl: fakeNativeSpawn(program => capturedResponse(capturedPythonIdentity(),
    program)),
}), /descriptor changed during child execution/,
"post-exit descriptor identity drift rejects dynamically");
await assert.rejects(runNativeCapture(captureArguments, {
  openPythonExecutable: fakePythonExecutable,
  openPythonAuthority: fakePythonAuthority,
  openFilesystemPermit: fakeOpenFilesystemPermit,
  hostPtraceScope: () => 3,
  openLauncherExecutable: fakeLauncherExecutable,
  elfForFd: fakeAuthorityElfForFd,
  identityForFd: fd => fd === parentGuardFd
    ? { ...fdIdentity, sha256: "b".repeat(64) } : fdIdentity,
  closeSyncImpl: () => {},
  spawnImpl: fakeNativeSpawn(program => capturedResponse(capturedPythonIdentity(),
    program)),
}), /guard descriptor changed during child execution/,
"parent post-child rehash rejects a changed mounted pre-Python guard");
for (const [label, mutate, pattern] of [
  ["schema", value => { value.schema = "wrong"; }, /is incomplete/],
  ["source fd", value => { value.source_fd = 4; }, /is incomplete/],
  ["sys reference", value => { value.sys_executable.reference = "wrong"; }, /read-only bound executable/],
  ["proc hash", value => { value.proc_self_exe.sha256 = "b".repeat(64); }, /read-only bound executable/],
  ["version type", value => { value.version = 1; }, /is incomplete/],
  ["top-level inode", value => { value.inode = "12"; }, /differs from the inherited descriptor/],
]) {
  const altered = capturedPythonIdentity(); mutate(altered);
  await assert.rejects(runNativeCapture(captureArguments, {
    openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority, identityForFd: () => fdIdentity,
    openFilesystemPermit: fakeOpenFilesystemPermit,
    hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    elfForFd: fakeAuthorityElfForFd,
    closeSyncImpl: () => {}, spawnImpl: fakeNativeSpawn(program =>
      capturedResponse(altered, program)),
  }), pattern, `child Python ${label} mutation rejects dynamically`);
}
for (const [label, mutate] of [
  ["zip sys.path", value => {
    value.prepython_seal.importer_isolation.sys_path.push("/tmp/hostile.zip");
  }],
  ["zip importer", value => {
    value.prepython_seal.importer_isolation.path_hooks.unshift(
      "zipimport.zipimporter");
  }],
  ["unknown meta importer", value => {
    value.prepython_seal.importer_isolation.meta_path.unshift(
      "hostile.Loader");
  }],
  ["unrecorded non-FileLoader importer", value => {
    value.prepython_seal.importer_isolation.approved_non_file_importers = [];
  }],
]) {
  const altered = capturedPythonIdentity(); mutate(altered);
  await assert.rejects(runNativeCapture(captureArguments, {
    openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority,
    openFilesystemPermit: fakeOpenFilesystemPermit,
    identityForFd: () => fdIdentity,
    hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    elfForFd: fakeAuthorityElfForFd,
    closeSyncImpl: () => {},
    spawnImpl: fakeNativeSpawn(program => capturedResponse(altered, program)),
  }), /isolated non-archive importer surface|sys\.path differs/,
  `${label} cannot enter the independently checked Python receipt`);
}
await assert.rejects(runNativeCapture(captureArguments, {
  openPythonExecutable: fakePythonExecutable,
  openPythonAuthority: fakePythonAuthority,
  openFilesystemPermit: fakeOpenFilesystemPermit,
  hostPtraceScope: () => 3,
  openLauncherExecutable: fakeLauncherExecutable,
  elfForFd: fakeAuthorityElfForFd,
  identityForFd: () => fdIdentity, closeSyncImpl: () => {},
  spawnImpl: fakeNativeSpawn(program => capturedResponse(capturedPythonIdentity(),
    { ...program, sha256: "b".repeat(64) })),
}), /program provenance differs from inherited pipe 4/,
"child top-level program identity mutation rejects dynamically");

const pythonClosureFixture = await mkdtemp(resolve(
  root, "build/cadr-oracle/m8-python-closure-test-"));
try {
  const oracle = resolve(pythonClosureFixture, "oracle.py");
  const helper = resolve(pythonClosureFixture, "helper.py");
  const omitted = resolve(pythonClosureFixture, "omitted.py");
  const originalOracle = [
    "import importlib.util",
    "HELPER = 'helper.py'",
    "spec = importlib.util.spec_from_file_location('helper', HELPER)",
    "",
  ].join("\n");
  await writeFile(oracle, originalOracle);
  await writeFile(helper, "VALUE = 'captured-helper'\n");
  await writeFile(omitted, "VALUE = 'newly-discovered-helper'\n");
  const fixtureRoot = oracle.slice(root.length + 1);
  const startCapture = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert.deepEqual(startCapture.files.map(item => item.path).sort(),
    [fixtureRoot, helper.slice(root.length + 1)].sort(),
    "literal dynamic helper is in the complete Python closure");

  let duringExecutionAdversaryRan = false;
  await runNativeCapture(captureArguments, {
    nativePythonClosure: startCapture,
    assertPythonPermit: () => {},
    openPythonExecutable: fakePythonExecutable,
    openPythonAuthority: fakePythonAuthority,
    openFilesystemPermit: fakeOpenFilesystemPermit,
    hostPtraceScope: () => 3,
    openLauncherExecutable: fakeLauncherExecutable,
    elfForFd: fakeAuthorityElfForFd,
    identityForFd: () => fdIdentity,
    closeSyncImpl: () => {},
    spawnImpl: fakeNativeSpawn((program, bundle, rootBytes, helperBytes) => {
      assert.equal(rootBytes.toString("utf8"), originalOracle,
        "root pipe retains pre-adversary captured bytes");
      const capturedHelper = bundle.programs.find(item =>
        item.path === helper.slice(root.length + 1));
      assert.equal(capturedHelper.sha256, sha256(Buffer.from("VALUE = 'captured-helper'\n")),
        "helper pipe bundle binds the pre-adversary helper identity");
      assert.equal(helperBytes.length, 1);
      assert.equal(helperBytes[0].toString("utf8"), "VALUE = 'captured-helper'\n",
        "one-shot helper pipe excludes hostile during-execution pathname bytes");
      return capturedResponse(capturedPythonIdentity(), program);
    }),
    afterProgramPipes: async () => {
      await writeFile(oracle, "raise RuntimeError('hostile-root')\n");
      await writeFile(helper, "raise RuntimeError('hostile-helper')\n");
      assert.match(await readFile(helper, "utf8"), /hostile-helper/);
      await writeFile(helper, "VALUE = 'captured-helper'\n");
      await writeFile(oracle, originalOracle);
      duringExecutionAdversaryRan = true;
    },
  });
  assert.equal(duringExecutionAdversaryRan, true,
    "replace/restore adversary ran after child spawn and pipe delivery");

  if (process.env.CADR_M8_M9_PYTHON_AUTHORITY_RECEIPT !== undefined) {
    const executableOracle = [
    "import ctypes,importlib.util,json,os,sys",
    "from pathlib import Path",
    "PROGRAM_ROOT = Path(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'])",
    `HELPER = PROGRAM_ROOT / '${helper.slice(root.length + 1)}'`,
    "spec = importlib.util.spec_from_file_location('helper', HELPER)",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "print(json.dumps({'dumpable': ctypes.CDLL(None).prctl(3), 'value': module.VALUE}, sort_keys=True))",
    "",
  ].join("\n");
  await writeFile(oracle, executableOracle);
  const executableCapture = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  const actualProbe = await runCapturedPythonClosureHostProbe(
    executableCapture, {
      afterProgramPipes: async () => {
        await writeFile(helper, "VALUE = 'hostile-helper'\n");
        await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
        await writeFile(helper, "VALUE = 'captured-helper'\n");
      },
    });
  assert.equal(actualProbe.code, 0, actualProbe.stderr);
  assert.deepEqual(JSON.parse(actualProbe.stdout), {
    dumpable: 0, value: "captured-helper",
  },
    "actual custom-loader execution cannot observe hostile helper pathname bytes");
    const escapedMarker = resolve(pythonClosureFixture, "uncaptured-executed");
  await writeFile(helper, [
    "from pathlib import Path",
    `Path(${JSON.stringify(escapedMarker)}).write_text('executed')`,
    "VALUE = 'uncaptured-repository-helper'",
    "",
  ].join("\n"));
  const uncapturedRootSource = Buffer.from([
    "import importlib.util,os",
    "from pathlib import Path",
    "PROGRAM_ROOT = Path(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'])",
    `HELPER = PROGRAM_ROOT / '${helper.slice(root.length + 1)}'`,
    "spec = importlib.util.spec_from_file_location('escaped', HELPER)",
    "module = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(module)",
    "",
  ].join("\n"));
  const uncapturedRootIdentity = { path: fixtureRoot,
    bytes: uncapturedRootSource.byteLength, sha256: sha256(uncapturedRootSource) };
  const omittedRuntimeClosure = {
    schema: "cadr-m8-m9-native-python-closure-v1", root: fixtureRoot,
    file_count: 1, sha256: "8".repeat(64),
    files: [uncapturedRootIdentity], dynamic_imports: [],
    captured_programs: [{ path: fixtureRoot, bytes: uncapturedRootSource,
      identity: uncapturedRootIdentity }],
  };
  const escapedProbe = await runCapturedPythonClosureHostProbe(
    omittedRuntimeClosure);
  assert.notEqual(escapedProbe.code, 0);
  assert.match(escapedProbe.stderr, /uncaptured Python program/);
  await assert.rejects(lstat(escapedMarker), error => error?.code === "ENOENT",
    "runtime fail-closed loader prevents an omitted repository helper executing");
  const runtimeLoaderAdversaries = {
    "_bootstrap_external entry point": [
      "import importlib._bootstrap_external as external,os",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "spec = external.spec_from_file_location('escaped', path)",
      "module = external.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
    ],
    "saved bootstrap-external alias": [
      "import importlib._bootstrap_external as external,importlib.util,os",
      "saved = external.spec_from_file_location",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "spec = saved('escaped', path)",
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
    ],
    "direct source-file loader": [
      "import importlib.machinery,os,types",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "loader = importlib.machinery.SourceFileLoader('escaped', path)",
      "module = types.ModuleType('escaped')",
      "loader.exec_module(module)",
    ],
    "getattr source-file loader constructor": [
      "import importlib.machinery,os,types",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "loader = getattr(importlib.machinery, 'SourceFileLoader')('escaped', path)",
      "loader.exec_module(types.ModuleType('escaped'))",
    ],
    "getattr runpy run_path": [
      "import runpy,os",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "getattr(runpy, 'run_path')(path)",
    ],
    "getattr io open_code": [
      "import io,os",
      `path = os.path.join(os.environ['CADR_M8_M9_PYTHON_PROGRAM_ROOT'], ${
        JSON.stringify(helper.slice(root.length + 1))})`,
      "getattr(io, 'open_code')(path)",
    ],
    "recovered builtins compile": [
      "builtins_module = __import__('builtins')",
      "getattr(builtins_module, 'compile')('VALUE=1', '<hostile>', 'exec')",
    ],
    "recovered builtins exec": [
      "builtins_module = __import__('builtins')",
      "getattr(builtins_module, 'exec')('VALUE=1')",
    ],
    "recovered builtins eval": [
      "builtins_module = __import__('builtins')",
      "getattr(builtins_module, 'eval')('1+1')",
    ],
  };
  for (const [label, lines] of Object.entries(runtimeLoaderAdversaries)) {
    const rootBytes = Buffer.from(`${lines.join("\n")}\n`);
    const identity = { path: fixtureRoot, bytes: rootBytes.byteLength,
      sha256: sha256(rootBytes) };
    const probe = await runCapturedPythonClosureHostProbe({
      schema: "cadr-m8-m9-native-python-closure-v1", root: fixtureRoot,
      file_count: 1, sha256: "9".repeat(64), files: [identity],
      dynamic_imports: [], captured_programs: [{
        path: fixtureRoot, bytes: rootBytes, identity,
      }],
    });
    assert.notEqual(probe.code, 0, `${label} unexpectedly loaded an omitted helper`);
    assert.match(probe.stderr,
      /uncaptured Python (?:program|file loader|open_code)|dynamic execution is prohibited/);
    await assert.rejects(lstat(escapedMarker), error => error?.code === "ENOENT",
      `${label} cannot execute omitted repository bytes`);
  }
  const authorityRecoveryAdversaries = {
    "captured root importing __main__": [
      "import __main__",
      "__main__.bootstrap_exec(__main__.bootstrap_compile(\"print('ESCAPED')\", '<hostile>', 'exec'), {})",
    ],
    "captured root recovering __main__ through sys.modules": [
      "import sys",
      "main = sys.modules['__main__']",
      "main.bootstrap_exec(main.bootstrap_compile(\"print('ESCAPED')\", '<hostile>', 'exec'), {})",
    ],
    "captured root walking the startup module dictionary": [
      "import sitecustomize",
      "sitecustomize.__dict__['bootstrap_exec'](sitecustomize.__dict__['bootstrap_compile'](\"print('ESCAPED')\", '<hostile>', 'exec'), {})",
    ],
    "captured root walking a guarded loader function globals": [
      "import importlib.util",
      "surface = importlib.util.spec_from_file_location.__globals__",
      "surface['bootstrap_exec'](surface['bootstrap_compile'](\"print('ESCAPED')\", '<hostile>', 'exec'), {})",
    ],
    "captured root walking a caller frame": [
      "import sys",
      "parent = sys._getframe().f_back",
      "parent.f_globals['bootstrap_exec'](parent.f_globals['bootstrap_compile'](\"print('ESCAPED')\", '<hostile>', 'exec'), {})",
    ],
  };
  for (const [label, lines] of Object.entries(authorityRecoveryAdversaries)) {
    const rootBytes = Buffer.from(`${lines.join("\n")}\n`);
    const identity = { path: fixtureRoot, bytes: rootBytes.byteLength,
      sha256: sha256(rootBytes) };
    const probe = await runCapturedPythonClosureHostProbe({
      schema: "cadr-m8-m9-native-python-closure-v1", root: fixtureRoot,
      file_count: 1, sha256: "a".repeat(64), files: [identity],
      dynamic_imports: [], captured_programs: [{ path: fixtureRoot,
        bytes: rootBytes, identity }],
    });
    assert.notEqual(probe.code, 0,
      `${label} must not recover the original CPython dynamic-execution authority`);
    assert.doesNotMatch(probe.stdout, /ESCAPED/,
      `${label} cannot execute an injected code string`);
    assert.match(probe.stderr, /(?:AttributeError|KeyError|NoneType)/,
      `${label} fails at the sealed startup object graph`);
  }
    await writeFile(helper, "VALUE = 'captured-helper'\n");
    await writeFile(oracle, originalOracle);
  }

  await writeFile(oracle, `${originalOracle}OMITTED = 'omitted.py'\n` +
    "spec2 = importlib.util.spec_from_file_location('omitted', OMITTED)\n");
  const endCapture = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert.notEqual(endCapture.sha256, startCapture.sha256,
    "an added transitive Python helper changes the closure receipt");
  assert(endCapture.files.some(item => item.path === omitted.slice(root.length + 1)),
    "an added transitive Python helper cannot be omitted from the closure");
  await writeFile(oracle, originalOracle);
  await writeFile(helper, "VALUE = 'mutated-helper'\n");
  const helperMutation = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert.notEqual(helperMutation.sha256, startCapture.sha256,
    "mutation of a transitive helper changes the closure receipt");
  await writeFile(helper, "VALUE = 'captured-helper'\n");
  await writeFile(oracle, `${originalOracle}COMPUTED = 'helper' + '.py'\n` +
    "spec2 = importlib.util.spec_from_file_location('computed', COMPUTED)\n");
  await assert.rejects(captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  }), /computed Python (?:loader|program)/,
  "a computed local loader cannot evade the explicit Python closure");
  await writeFile(oracle, "import __main__\n");
  await assert.rejects(captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  }), /unapproved execution\/import authority/,
  "the source-admission audit rejects direct recovery of the startup __main__ module");
  await writeFile(oracle, originalOracle);
  await writeFile(oracle, [
    "import importlib.util",
    "def outer():",
    "    HELPER = 'helper.py'",
    "    def nested(name):",
    "        known = importlib.util.spec_from_file_location('known', HELPER)",
    "        if importlib.util.spec_from_file_location('computed', f'{name}.py'):",
    "            return known",
    "    return nested",
    "",
  ].join("\n"));
  await assert.rejects(captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  }), /computed Python loader/,
  "nested mixed recognized/computed loader in an if-test rejects per call");
  const computedPositions = {
    "while-test": "while importlib.util.spec_from_file_location('x', f'{name}.py'):\n        break",
    "for-iterator": "for _ in (importlib.util.spec_from_file_location('x', f'{name}.py'),):\n        pass",
    "with-context": "with importlib.util.spec_from_file_location('x', f'{name}.py'):\n        pass",
    decorator: "@importlib.util.spec_from_file_location('x', f'{name}.py')\ndef decorated():\n    pass",
    default: "def defaulted(value=importlib.util.spec_from_file_location('x', f'{name}.py')):\n        pass",
    "class-body": "class C:\n        value = importlib.util.spec_from_file_location('x', f'{name}.py')",
    comprehension: "values = [importlib.util.spec_from_file_location('x', f'{name}.py') for _ in (0,)]",
  };
  for (const [position, snippet] of Object.entries(computedPositions)) {
    await writeFile(oracle, [
      "import importlib.util",
      "HELPER = 'helper.py'",
      "known = importlib.util.spec_from_file_location('known', HELPER)",
      "def outer(name):",
      ...snippet.split("\n").map(line => `    ${line}`),
      "",
    ].join("\n"));
    await assert.rejects(captureCadrM8M9NativePythonClosure({
      root: fixtureRoot,
    }), /computed Python loader/,
    `${position} computed loader rejects even beside a recognized call`);
  }
  for (const name of ["global-real.py", "class-only.py", "before.py",
    "after-real.py", "first-real.py", "outer.py", "middle-before.py",
    "middle-after.py", "outer-skip-before.py", "outer-skip-after.py"]) {
    await writeFile(resolve(pythonClosureFixture, name), `VALUE = ${JSON.stringify(name)}\n`);
  }
  await writeFile(oracle, [
    "import importlib.util",
    "HELPER = 'global-real.py'",
    "class Container:",
    "    HELPER = 'class-only.py'",
    "    def load(self):",
    "        return importlib.util.spec_from_file_location('method', HELPER)",
    "    load_lambda = lambda self: importlib.util.spec_from_file_location('lambda', HELPER)",
    "",
  ].join("\n"));
  const classScope = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert(classScope.files.some(item => item.path.endsWith("/global-real.py")),
    "method and lambda bodies skip their defining class namespace");
  assert(!classScope.files.some(item => item.path.endsWith("/class-only.py")),
    "a class-local decoy is not substituted for the method runtime lookup");
  for (const source of [[
    "import importlib.util",
    "HELPER = 'global-real.py'",
    "class Outer:",
    "    HELPER = 'class-only.py'",
    "    class Inner:",
    "        spec = importlib.util.spec_from_file_location('nested', HELPER)",
  ], [
    "import importlib.util",
    "HELPER = 'global-real.py'",
    "class Ordered:",
    "    spec = importlib.util.spec_from_file_location('ordered', HELPER)",
    "    HELPER = 'class-only.py'",
  ]]) {
    await writeFile(oracle, `${source.join("\n")}\n`);
    await assert.rejects(captureCadrM8M9NativePythonClosure({
      root: fixtureRoot,
    }), /computed Python loader/,
    "execution-order-sensitive class lookup is rejected instead of under-captured");
  }

  await writeFile(oracle, [
    "import importlib.util",
    "HELPER = 'before.py'",
    "values = [(HELPER := 'after-real.py') for _ in (0,)]",
    "spec = importlib.util.spec_from_file_location('after', HELPER)",
    "",
  ].join("\n"));
  const comprehensionWalrus = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert(comprehensionWalrus.files.some(item => item.path.endsWith("/after-real.py")),
    "a comprehension named expression binds in its containing non-comprehension scope");

  await writeFile(oracle, [
    "import importlib.util",
    "HELPER = 'first-real.py'",
    "values = [None for HELPER in (",
    "    importlib.util.spec_from_file_location('first', HELPER),",
    ")]",
    "",
  ].join("\n"));
  const firstIterable = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert(firstIterable.files.some(item => item.path.endsWith("/first-real.py")),
    "a comprehension first iterable resolves in the enclosing scope before target binding");

  const rebindingAdversaries = {
    "match capture": [
      "import importlib.util",
      "HELPER = 'helper.py'",
      "match object():",
      "    case HELPER:",
      "        pass",
      "spec = importlib.util.spec_from_file_location('match', HELPER)",
    ],
    "augmented assignment": [
      "import importlib.util",
      "HELPER = 'helper.py'",
      "HELPER += '.hostile.py'",
      "spec = importlib.util.spec_from_file_location('augmented', HELPER)",
    ],
    "reserved root shadow": [
      "import importlib.util",
      "from pathlib import Path",
      "REPOSITORY = Path('.')",
      "def load():",
      "    REPOSITORY = 'hostile'",
      "    return importlib.util.spec_from_file_location('shadow', REPOSITORY / 'helper.py')",
    ],
  };
  for (const [label, source] of Object.entries(rebindingAdversaries)) {
    await writeFile(oracle, `${source.join("\n")}\n`);
    await assert.rejects(captureCadrM8M9NativePythonClosure({
      root: fixtureRoot,
    }), /computed Python loader/,
    `${label} cannot make static resolution omit the runtime path`);
  }
  await writeFile(oracle, [
    "import importlib.util",
    "def outer():",
    "    HELPER = 'outer.py'",
    "    def middle():",
    "        HELPER = 'middle-before.py'",
    "        def inner():",
    "            nonlocal HELPER",
    "            before = importlib.util.spec_from_file_location('before', HELPER)",
    "            HELPER = 'middle-after.py'",
    "            after = importlib.util.spec_from_file_location('after', HELPER)",
    "            return before, after",
    "        return inner",
    "    return middle",
    "",
  ].join("\n"));
  const nonlocalClosure = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert(nonlocalClosure.files.some(item =>
    item.path.endsWith("/middle-before.py")));
  assert(nonlocalClosure.files.some(item =>
    item.path.endsWith("/middle-after.py")));
  assert(!nonlocalClosure.files.some(item => item.path.endsWith("/outer.py")),
    "nonlocal assignment resolves only to the nearest actual enclosing function binding");

  await writeFile(oracle, [
    "import importlib.util",
    "def outer():",
    "    HELPER = 'outer-skip-before.py'",
    "    def middle():",
    "        def inner():",
    "            nonlocal HELPER",
    "            before = importlib.util.spec_from_file_location('before', HELPER)",
    "            HELPER = 'outer-skip-after.py'",
    "            after = importlib.util.spec_from_file_location('after', HELPER)",
    "            return before, after",
    "        return inner",
    "    return middle",
    "",
  ].join("\n"));
  const skipMiddleClosure = await captureCadrM8M9NativePythonClosure({
    root: fixtureRoot,
  });
  assert(skipMiddleClosure.files.some(item =>
    item.path.endsWith("/outer-skip-before.py")));
  assert(skipMiddleClosure.files.some(item =>
    item.path.endsWith("/outer-skip-after.py")),
  "nonlocal skips a middle function with no actual binding and resolves outer before+after values");

  const namespaceAdversaries = {
    "star import": [
      "from math import *",
      "import importlib.util",
      "spec = importlib.util.spec_from_file_location('x', HELPER)",
    ],
    "globals subscript assignment": [
      "import importlib.util",
      "HELPER = 'helper.py'",
      "globals()['HELPER'] = 'outer.py'",
      "spec = importlib.util.spec_from_file_location('x', HELPER)",
    ],
    "globals update": [
      "import importlib.util",
      "HELPER = 'helper.py'",
      "globals().update({'HELPER': 'outer.py'})",
      "spec = importlib.util.spec_from_file_location('x', HELPER)",
    ],
    "sys path mutation": [
      "import importlib.util,sys",
      "HELPER = 'helper.py'",
      "sys.path.append('/tmp/hostile.zip')",
      "spec = importlib.util.spec_from_file_location('x', HELPER)",
    ],
    "zip importer": [
      "import importlib.util,zipimport",
      "HELPER = 'helper.py'",
      "spec = importlib.util.spec_from_file_location('x', HELPER)",
    ],
  };
  for (const [label, source] of Object.entries(namespaceAdversaries)) {
    await writeFile(oracle, `${source.join("\n")}\n`);
    await assert.rejects(captureCadrM8M9NativePythonClosure({
      root: fixtureRoot,
    }), /Python AST loader analysis failed/,
    `${label} is rejected instead of mutating an unmodeled namespace`);
  }
  await writeFile(oracle, originalOracle);
} finally {
  await rm(pythonClosureFixture, { recursive: true, force: true });
}

const metadataFixture = await mkdtemp(resolve(
  root, "build/cadr-oracle/m8-native-metadata-test-"));
try {
  const metadataPath = resolve(metadataFixture, "metadata.json");
  const heldPath = resolve(metadataFixture, "metadata.held");
  const responseMetadata = { schema: "captured-response", nested: { value: 7 } };
  const responseBytes = `${canonicalJson(responseMetadata)}\n`;
  await writeFile(metadataPath, responseBytes, { mode: 0o600 });
  await chmod(metadataPath, 0o600);
  const captured = await captureNativeMetadata(metadataPath, responseMetadata, {
    afterDescriptorOpen: async () => {
      await rename(metadataPath, heldPath);
      await writeFile(metadataPath, `${canonicalJson({ schema: "hostile" })}\n`,
        { mode: 0o600 });
      await chmod(metadataPath, 0o600);
      await rm(metadataPath);
      await rename(heldPath, metadataPath);
    },
  });
  assert.equal(new TextDecoder().decode(captured.bytes), responseBytes,
    "metadata replacement/restore cannot redirect the open descriptor");
  assert.deepEqual(captured.value, responseMetadata);

  await writeFile(metadataPath, `${canonicalJson({ schema: "hostile-before-open" })}\n`);
  await chmod(metadataPath, 0o600);
  await assert.rejects(captureNativeMetadata(metadataPath, responseMetadata),
    /differs from the descriptor-bound child response/,
    "replacement before metadata descriptor capture cannot detach the final manifest");
} finally {
  await rm(metadataFixture, { recursive: true, force: true });
}

const deactivation = deriveCadrM8M9DeactivationProducer({ coreState: {
  csr: 0x14, scancode: 0x18000, mouseX: 44, mouseY: 54, inputSequence: 208,
  keyboardFifoCount: 0, ingressOrdinal: 208n, generation: 1n, lifecycle: 2,
}, pointerGeneration: 1 });
assert.equal(deactivation.keyboard_down[0].payload, 0x52,
  "KeyQ derives from the selected physical keyboard mapping, not a literal placeholder");
assert.equal(deactivation.pointer_down[0].payload,
  60 | (70 << 10) | (1 << 20) | (1 << 23),
  "tail-down uses the exact 60,70 EDGE32 producer command");
assert.equal(deactivation.neutralize[0].payload, 60 | (70 << 10) | (1 << 23) | (1 << 26),
  "capture-loss release retains the one-hot changed-mask as well as its cause");
assert.deepEqual(deactivation.neutralize.map(record => record.ordinal), [211n, 212n]);

function observation(state) {
  const bytes = new Uint8Array(64); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRIOB91"));
  view.setUint32(8, 1, true); view.setUint32(12, 64, true);
  view.setUint32(16, state.csr, true); view.setUint32(20, state.scancode, true);
  view.setUint32(24, state.mouseX, true); view.setUint32(28, state.mouseY, true);
  view.setUint32(32, state.inputSequence, true);
  view.setUint32(36, state.keyboardFifoCount, true);
  view.setBigUint64(40, state.ingressOrdinal, true);
  view.setBigUint64(48, state.generation, true);
  view.setUint32(56, 2, true);
  return bytes.buffer;
}

let state = { csr: 4, scancode: 0, mouseX: 0, mouseY: 0, inputSequence: 0,
  keyboardFifoCount: 0, ingressOrdinal: 0n, generation: 1n, lifecycle: 2 };
const client = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") {
    state = { ...state, csr: state.csr & ~(1 << 5), keyboardFifoCount: 0 };
    return { status: 0, completedSlots: 1n, microinstructionsExecuted: 1n };
  }
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91", observation: observation(state) };
} };
for (let pair = 0; pair < 100; pair += 1) {
  state = { ...state, csr: state.csr | (1 << 5), keyboardFifoCount: 1,
    inputSequence: state.inputSequence + 2, ingressOrdinal: state.ingressOrdinal + 2n };
  const result = await quiesceKeyboardInput(client, state, `pair-${pair}`,
    { maxRuns: 2, clockSlots: 1 });
  state = result.state;
  assert.equal(result.evidence.run_count, 1);
  assert.equal(state.csr, 4);
  assert.equal(state.keyboardFifoCount, 0);
}
assert.equal(state.ingressOrdinal, 200n,
  "READY-seeded runtime-like model advances beyond the native ten-entry FIFO limit");

const driftInitial = { ...state, csr: state.csr | (1 << 5), keyboardFifoCount: 1 };
const driftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 4, keyboardFifoCount: 0,
      ingressOrdinal: driftInitial.ingressOrdinal + 1n }) };
} };
await assert.rejects(quiesceKeyboardInput(driftClient, driftInitial, "drift",
  { maxRuns: 2, clockSlots: 1 }), /changed invariant input field ingressOrdinal/);

const mouseDriftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 4, keyboardFifoCount: 0,
      mouseX: driftInitial.mouseX + 1 }) };
} };
await assert.rejects(quiesceKeyboardInput(mouseDriftClient, driftInitial,
  "mouse-drift", { maxRuns: 2, clockSlots: 1 }), /changed mouse state/);

const csrDriftClient = { async request(op) {
  if (op === "scheduler-start" || op === "scheduler-pause") return { status: 0 };
  if (op === "scheduler-run") return { status: 0, completedSlots: 1n,
    microinstructionsExecuted: 1n };
  assert.equal(op, "input-state");
  return { status: 0, wireSchema: "CDRIOB91",
    observation: observation({ ...driftInitial, csr: 0, keyboardFifoCount: 0 }) };
} };
await assert.rejects(quiesceKeyboardInput(csrDriftClient, driftInitial,
  "csr-drift", { maxRuns: 2, clockSlots: 1 }), /changed a non-READY CSR bit/);
console.log("cadr M8/M9 paired campaign refuses runtime without explicit consent");
