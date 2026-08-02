import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  CADR_M7_P4_HOST_FOUNDATION,
  closedM7P4HostEnvironmentForTest,
  parseM7P4HostSupervisorArguments,
  rejectM7P4DangerousEnvironmentForTest,
  runM7P4HostCleanupScopeForTest,
  validateM7P4ClosedEnvironmentForTest,
  validateM7P4HostRootSnapshotForTest,
  validateM7P4ReceiptBoundRuntimeForTest,
} from "../scripts/cadr-m7-p4-host-supervisor.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DROPPER_SOURCE = resolve(ROOT, "scripts/cadr-m7-p4-host-dropper.c");
const SUPERVISOR_SOURCE = resolve(ROOT, "scripts/cadr-m7-p4-host-supervisor.mjs");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest();
}

function rootStatus({ uid = "0 0 0 0", gid = "0 0 0 0", groups = "0" } = {}) {
  return [
    `Uid:\t${uid}`,
    `Gid:\t${gid}`,
    `Groups:\t${groups}`,
    "CapInh:\t0000000000000000",
    "CapPrm:\t000001ffffffffff",
    "CapEff:\t000001ffffffffff",
    "CapBnd:\t000001ffffffffff",
    "CapAmb:\t0000000000000000",
    "NoNewPrivs:\t0",
    "",
  ].join("\n");
}

function rootSnapshot(overrides = {}) {
  return {
    initial_user_namespace: true,
    uid_map: "         0          0 4294967295\n",
    gid_map: "         0          0 4294967295\n",
    status: rootStatus(),
    ...overrides,
  };
}

function writeConfig({ node, runner, namespace, flags = 1, targetUid = 0, targetGid = 0 }) {
  const config = Buffer.alloc(176);
  Buffer.from("M7HDPV1\0", "ascii").copy(config, 0);
  config.writeUInt32LE(1, 8); config.writeUInt32LE(flags, 12);
  config.writeBigUInt64LE(BigInt(targetUid), 16); config.writeBigUInt64LE(BigInt(targetGid), 24);
  config.writeBigUInt64LE(node.dev, 32); config.writeBigUInt64LE(node.ino, 40);
  config.writeBigUInt64LE(runner.dev, 48); config.writeBigUInt64LE(runner.ino, 56);
  config.writeBigUInt64LE(namespace.dev, 64); config.writeBigUInt64LE(namespace.ino, 72);
  node.sha256.copy(config, 80); runner.sha256.copy(config, 112);
  Buffer.alloc(32, 0x5a).copy(config, 144);
  return config;
}

async function identity(path) {
  const [info, bytes] = await Promise.all([stat(path, { bigint: true }), readFile(path)]);
  return { dev: info.dev, ino: info.ino, sha256: sha256(bytes) };
}

assert.deepEqual(CADR_M7_P4_HOST_FOUNDATION, {
  schema: "cadr-m7-p4-host-supervisor-foundation-v1",
  production_evidence: false,
  phase_a_recomputation: "not-implemented",
  launch: "refuse",
});
assert.throws(() => parseM7P4HostSupervisorArguments(["--forged"]), /takes no caller arguments/);
assert.deepEqual(parseM7P4HostSupervisorArguments([]), []);
assert.throws(() => rejectM7P4DangerousEnvironmentForTest({ NODE_OPTIONS: "--require=/tmp/x" }),
  /NODE_OPTIONS/, "ambient Node injection is rejected before root work");
assert.equal(rejectM7P4DangerousEnvironmentForTest({ LANG: "hostile-but-not-inherited" }), true);
assert.deepEqual(closedM7P4HostEnvironmentForTest(), {
  HOME: "/var/empty", LANG: "C", LC_ALL: "C", TZ: "UTC", PATH: "/var/empty",
}, "children receive the fixed closed environment, never a caller merge");
assert.equal(validateM7P4ClosedEnvironmentForTest(closedM7P4HostEnvironmentForTest()), true);
assert.throws(() => validateM7P4ClosedEnvironmentForTest({
  ...closedM7P4HostEnvironmentForTest(), MALICIOUS: "1",
}), /exact closed environment/);

assert.doesNotThrow(() => validateM7P4HostRootSnapshotForTest(rootSnapshot()));
assert.throws(() => validateM7P4HostRootSnapshotForTest(rootSnapshot({
  initial_user_namespace: false,
})), /initial user namespace/, "root in a subordinate user namespace is refused");
assert.throws(() => validateM7P4HostRootSnapshotForTest(rootSnapshot({
  status: rootStatus({ uid: "0 1000 0 0" }),
})), /Uid/, "mapped-looking root credentials are not host root");
assert.throws(() => validateM7P4HostRootSnapshotForTest(rootSnapshot({
  status: rootStatus({ groups: "0 1001" }),
})), /Groups/, "supplementary host groups are not accepted");

{
  const events = [];
  await assert.rejects(runM7P4HostCleanupScopeForTest({
    cleanup: { begin: async () => events.push("cleanup-begin"),
      finish: async () => events.push("cleanup-finish") },
    acquire: async () => { events.push("acquire"); throw new Error("partial acquisition"); },
  }), /partial acquisition/);
  assert.deepEqual(events, ["cleanup-begin", "acquire", "cleanup-finish"],
    "cleanup begins before the first acquisition and survives a partial failure");
}

const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-p4-host-foundation-"));
try {
  const store = resolve(fixture, "store");
  const output = resolve(store, "out"); const nodeOutput = resolve(store, "node");
  const supervisor = resolve(output, "bin/cadr-m7-p4-host-supervisor.mjs");
  const dropper = resolve(output, "bin/cadr-m7-p4-host-dropper");
  const node = resolve(nodeOutput, "bin/node");
  await mkdir(dirname(supervisor), { recursive: true }); await mkdir(dirname(dropper), { recursive: true });
  await mkdir(dirname(node), { recursive: true });
  await writeFile(supervisor, "supervisor\n"); await writeFile(dropper, "dropper\n");
  await writeFile(node, "node\n");
  await Promise.all([chmod(supervisor, 0o555), chmod(dropper, 0o555), chmod(node, 0o555)]);
  const artifact = async path => ({ path, sha256: createHash("sha256").update(
    await readFile(path)).digest("hex"), mode: 0o555 });
  const receipt = {
    schema: "cadr-m7-p4-host-launch-receipt-v1",
    production_evidence: false,
    output,
    node_output: nodeOutput,
    node: await artifact(node),
    host_supervisor: await artifact(supervisor),
    host_dropper: await artifact(dropper),
    compiler: { output: resolve(store, "compiler"), closure_sha256: "c".repeat(64) },
  };
  await assert.doesNotReject(validateM7P4ReceiptBoundRuntimeForTest(receipt,
    { supervisor, node, dropper }, { storePrefix: store }));
  await assert.rejects(validateM7P4ReceiptBoundRuntimeForTest({
    ...receipt, production_evidence: true,
  }, { supervisor, node, dropper }, { storePrefix: store }), /non-production/);
  await assert.rejects(validateM7P4ReceiptBoundRuntimeForTest({
    ...receipt, host_dropper_path: resolve(fixture, "checkout-dropper"),
  }, { supervisor, node, dropper }, { storePrefix: store }), /shape/,
  "a checkout pathname cannot replace the immutable dropper");

  const compiledDropper = resolve(fixture, "dropper");
  execFileSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror", "-static",
    DROPPER_SOURCE, "-o", compiledDropper]);
  const malformed = spawnSync(compiledDropper, ["--caller-selected-runner"], { encoding: "utf8" });
  assert.equal(malformed.status, 64);
  assert.match(malformed.stderr, /usage is exactly/);

  const runner = resolve(fixture, "signed-captured-runner.mjs");
  await writeFile(runner, "export const foundation = 'synthetic';\n");
  const configPath = resolve(fixture, "fixed-config.bin");
  const [nodeIdentity, runnerIdentity, namespace] = await Promise.all([
    identity(process.execPath), identity(runner), stat("/proc/self/ns/user", { bigint: true }),
  ]);
  await writeFile(configPath, writeConfig({ node: nodeIdentity, runner: runnerIdentity, namespace }));
  const [configHandle, nodeHandle, runnerHandle] = await Promise.all([
    open(configPath, "r"), open(process.execPath, "r"), open(runner, "r"),
  ]);
  try {
    const userNamespaceRoot = spawnSync("/usr/bin/unshare",
      ["--user", "--map-root-user", "--", compiledDropper, "--synthetic-test-v1"], {
        encoding: "utf8", env: { PATH: "/usr/bin:/bin" },
        stdio: ["ignore", "pipe", "pipe", configHandle.fd, nodeHandle.fd, runnerHandle.fd],
      });
    assert.equal(userNamespaceRoot.status, 125, userNamespaceRoot.stderr);
    assert.match(userNamespaceRoot.stderr, /cannot clear supplementary groups/,
      "a mapped user-namespace root cannot pass the group-clearing authority step");

    /* Run the verifier bytes compiled into the native dropper against the
     * current child process, not an invented status string.  This negative
     * exercise proves the first Node realm reads /proc and refuses before it
     * imports fd 5 when uid/gid/groups/capability/no_new_privs state is not the
     * dropped-child profile.  A positive host-root launch requires Phase A and
     * is deliberately not claimed by this foundation. */
    const verifierStrings = execFileSync("strings", [compiledDropper], { encoding: "utf8" })
      .split("\n");
    const verifierCommon = verifierStrings.find(line => line.startsWith(
      "const f=require('node:fs'),s=f.readFileSync('/proc/self/status'"));
    const verifierSynthetic = verifierStrings.find(line => line.includes(
      "if(!f.statSync('/proc/self/ns/user').isFile())"));
    assert.notEqual(verifierCommon, undefined); assert.notEqual(verifierSynthetic, undefined);
    const actualChildRejection = spawnSync(process.execPath,
      ["--no-addons", "--disable-proto=throw", "--eval", `${verifierCommon}${
        verifierSynthetic.slice(verifierSynthetic.indexOf("if(!f.statSync"))}`], {
        encoding: "utf8", env: closedM7P4HostEnvironmentForTest(),
        stdio: ["ignore", "pipe", "pipe", "ignore", "ignore", runnerHandle.fd],
      });
    assert.equal(actualChildRejection.status, 125,
      "the compiled child verifier rejects this actual, non-dropped /proc state");
  } finally {
    await Promise.all([configHandle.close(), nodeHandle.close(), runnerHandle.close()]);
  }

  /* Exercise the exact native close routine with a deliberately leaked fd.
   * The harness links the production translation unit with static removed only
   * so the otherwise-private primitive can be observed without a root launch. */
  const dropperObject = resolve(fixture, "dropper-close-test.o");
  const closeHarness = resolve(fixture, "dropper-close-test.c");
  const closeBinary = resolve(fixture, "dropper-close-test");
  await writeFile(closeHarness, [
    "#include <errno.h>", "#include <fcntl.h>", "#include <stdio.h>",
    "#include <unistd.h>", "void close_non_allowlisted_fds(void);",
    "int main(void) { int source = open(\"/dev/null\", O_RDONLY); int fd; if (source < 0) return 2;",
    "  fd = fcntl(source, F_DUPFD, 16); close(source); if (fd < 16) return 2;",
    "  close_non_allowlisted_fds(); return fcntl(fd, F_GETFD) == -1 && errno == EBADF ? 0 : 1; }",
  ].join("\n"));
  execFileSync("cc", ["-std=c11", "-O2", "-Dstatic=", "-Dmain=cadr_m7_dropper_main",
    "-c", DROPPER_SOURCE, "-o", dropperObject]);
  execFileSync("cc", ["-std=c11", "-O2", closeHarness, dropperObject, "-o", closeBinary]);
  assert.equal(spawnSync(closeBinary).status, 0,
    "a descriptor above the fixed 0,1,2,4,5 allowlist is closed before exec");
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const [dropperSource, supervisorSource] = await Promise.all([
  readFile(DROPPER_SOURCE, "utf8"), readFile(SUPERVISOR_SOURCE, "utf8"),
]);
assert.match(dropperSource, /production_evidence/,
  "the native foundation is permanently labelled non-production in source policy");
assert.match(dropperSource, /verify_proc_state/);
assert.match(dropperSource, /CapInh.*CapPrm.*CapEff.*CapBnd.*CapAmb/s);
assert.match(dropperSource, /PR_SET_NO_NEW_PRIVS/);
assert.match(dropperSource, /SYS_execveat/);
assert.match(supervisorSource, /independent fd4 Phase-A recomputation is not implemented/);

console.log("M7 P4 immutable host-root foundation synthetic tests passed");
