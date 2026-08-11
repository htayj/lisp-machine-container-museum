import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  CADR_M7_P4_HOST_FOUNDATION,
  closedM7P4HostEnvironmentForTest,
  main,
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
  schema: "cadr-m7-p4-host-supervisor-foundation-v2",
  production_evidence: false,
  phase_a_recomputation: "synthetic-core-only",
  launch: "refuse-until-live-unit-caps-cgroup-evidence",
});
assert.throws(() => parseM7P4HostSupervisorArguments(["--forged"]), /takes no caller arguments/);
assert.deepEqual(parseM7P4HostSupervisorArguments([]), []);
for (const argv of [[], ["--serve-inherited"], ["--synthetic-test-v1"]]) {
  await assert.rejects(main(argv),
    /Phase-A lacks live effective-unit, capability, and cgroup evidence/,
    "direct main has no selector that can reach a synthetic or production seam");
}
for (const argv of [[], ["--serve-inherited"], ["--synthetic-test-v1"]]) {
  const direct = spawnSync(process.execPath, [SUPERVISOR_SOURCE, ...argv], {
    encoding: "utf8", env: { M7_P4_SYNTHETIC_SELECTOR: "forged", PATH: "/no/such/path" },
  });
  assert.notEqual(direct.status, 0);
  assert.match(direct.stderr, /Phase-A lacks live effective-unit, capability, and cgroup evidence/,
    "the direct executable refuses before argument, proc, receipt, or synthetic-seam handling");
}
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

  const obsoleteSynthetic = spawnSync(compiledDropper, ["--synthetic-test-v1"],
    { encoding: "utf8" });
  assert.equal(obsoleteSynthetic.status, 64,
    "the v2 production dropper has no synthetic or caller-selected ABI");

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
    "  fd = fcntl(source, F_DUPFD, 18); close(source); if (fd < 18) return 2;",
    "  close_non_allowlisted_fds(); return fcntl(fd, F_GETFD) == -1 && errno == EBADF ? 0 : 1; }",
  ].join("\n"));
  execFileSync("cc", ["-std=c11", "-O2", "-Dstatic=", "-Dmain=cadr_m7_dropper_main",
    "-c", DROPPER_SOURCE, "-o", dropperObject]);
  execFileSync("cc", ["-std=c11", "-O2", closeHarness, dropperObject, "-o", closeBinary]);
  assert.equal(spawnSync(closeBinary).status, 0,
    "a descriptor above the fixed fd17 allowlist is closed before exec");
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const [dropperSource, supervisorSource] = await Promise.all([
  readFile(DROPPER_SOURCE, "utf8"), readFile(SUPERVISOR_SOURCE, "utf8"),
]);
assert.match(dropperSource, /M7HDPV2/);
assert.doesNotMatch(dropperSource, /getpwnam|getgrnam|service_name/);
assert.match(dropperSource, /account_policy_sha256/);
assert.match(dropperSource, /SO_PEERCRED/);
assert.match(dropperSource, /verify_proc_state/);
assert.match(dropperSource, /CapInh.*CapPrm.*CapEff.*CapBnd.*CapAmb/s);
assert.match(dropperSource, /PR_SET_NO_NEW_PRIVS/);
assert.match(dropperSource, /SYS_execveat/);
assert.match(supervisorSource, /Phase-A lacks live effective-unit, capability, and cgroup evidence/);

console.log("M7 P4 immutable host-root foundation synthetic tests passed");
