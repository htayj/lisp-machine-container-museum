import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { M6_SELECTED_IMAGE_PINNED_GUIX } from
  "../scripts/cadr-m6-selected-image-negative-evidence.mjs";
import { buildSelectedImageGuixAuthority,
  buildSelectedImagePeerConnectorTestAuthority, verifyGuixAuthority } from
  "../scripts/run-cadr-m6-selected-image-negative-systemd.mjs";

const LIVE_GATE = "CADR_M6_SYSTEMD_PEER_CONNECTOR_LIVE";
const RELEASE_GATE = "CADR_M6_RELEASE_VALIDATION";
const MISSING_TEST_PREREQUISITE =
  "CADR_M6_SYSTEMD_PEER_CONNECTOR_TEST_MISSING_PREREQUISITE";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prerequisite =
  `${LIVE_GATE}=1, Linux SO_PEERPIDFD, a running root system bus, ` +
  "the current non-root user's systemd user bus, and the reviewed pinned " +
  "Node, Guix, and Guix test-toolchain store identities";

const command = (program, args, options = {}) => spawnSync(program, args, {
  cwd: "/", encoding: null, maxBuffer: 1024 * 1024, ...options,
});
const text = value => Buffer.from(value ?? []).toString("utf8");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function requireSuccess(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message}`);
  assert.equal(result.signal, null, `${label}: signal ${result.signal}`);
  assert.equal(result.status, 0,
    `${label}: status ${result.status}; stderr=${text(result.stderr)}`);
  return result;
}

async function missingPrerequisites() {
  const missing = [];
  if (process.env[MISSING_TEST_PREREQUISITE] === "1") {
    missing.push("injected-live-test-prerequisite");
  }
  if (process.platform !== "linux") missing.push("Linux");
  if (!Number.isSafeInteger(process.getuid?.()) || process.getuid() <= 0) {
    missing.push("non-root uid");
  }
  for (const path of ["/usr/bin/busctl", "/usr/bin/systemctl",
    "/run/dbus/system_bus_socket", `/run/user/${process.getuid?.()}/bus`]) {
    try { await access(path, constants.R_OK); }
    catch { missing.push(path); }
  }
  try { await access(M6_SELECTED_IMAGE_PINNED_GUIX.path, constants.R_OK); }
  catch { missing.push(M6_SELECTED_IMAGE_PINNED_GUIX.path); }
  return missing;
}

const authorityInputPaths = Object.freeze({
  derivation: "scripts/cadr-m6-selected-image-authority.scm",
  launcherSource: "scripts/cadr-m6-selected-image-static-launcher.c",
  peerConnectorSource: "scripts/cadr-m6-systemd-peer-connect.c",
  childSource: "scripts/run-cadr-m6-selected-image-negative.mjs",
  selectedEvidence: "scripts/cadr-m6-selected-image-negative-evidence.mjs",
  ready4Evidence: "scripts/cadr-m6-ready4-evidence.mjs",
  releaseRecord: "cadr-web/oracle/cadr-m6-release-record.json",
});

async function retainInputs(paths) {
  const handles = {};
  try {
    for (const [name, relative] of Object.entries(paths)) {
      handles[name] = await open(resolve(ROOT, relative),
        constants.O_RDONLY | constants.O_NOFOLLOW);
    }
    return handles;
  } catch (error) {
    await Promise.allSettled(Object.values(handles).map(handle => handle.close()));
    throw error;
  }
}

function descriptorInputs(handles) {
  return Object.freeze(Object.fromEntries(Object.entries(handles).map(
    ([name, handle]) => [name, `/proc/${process.pid}/fd/${handle.fd}`])));
}

function parseMainPID(stdout) {
  const match = /^\{"type":"u","data":([1-9][0-9]*)\}\n$/.exec(
    text(stdout));
  assert.notEqual(match, null, "root MainPID reply must be exact typed u JSON");
  assert(BigInt(match[1]) <= 4294967295n, "root MainPID exceeds uint32");
  return match[1];
}

async function processProfile(pid) {
  const proc = await lstat(`/proc/${pid}`, { bigint: true });
  const stat = (await readFile(`/proc/${pid}/stat`, "utf8"));
  const close = stat.lastIndexOf(")");
  assert(close > 0 && stat.endsWith("\n"), "root-selected stat is malformed");
  const fields = stat.slice(close + 2, -1).split(" ");
  const boot = (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim();
  const comm = (await readFile(`/proc/${pid}/comm`, "utf8")).trimEnd();
  const argv = await readFile(`/proc/${pid}/cmdline`);
  const cgroup = await readFile(`/proc/${pid}/cgroup`);
  return Object.freeze({ uid: String(proc.uid), gid: String(proc.gid), pid,
    ppid: fields[1], start: fields[19], boot, comm,
    argvBytes: String(argv.length),
    argvCount: String(argv.reduce((n, byte) => n + (byte === 0 ? 1 : 0), 0)),
    argvSha: sha256(argv), cgroupBytes: String(cgroup.length),
    cgroupSha: sha256(cgroup) });
}

function connectorArguments(profile, tail = ["--probe"]) {
  return ["--socket", `/run/user/${profile.uid}/bus`,
    "--peer-uid", profile.uid, "--peer-gid", profile.gid,
    "--peer-pid", profile.pid, "--peer-ppid", profile.ppid,
    "--peer-start-time", profile.start, "--boot-id", profile.boot,
    "--peer-comm", profile.comm,
    "--peer-argv-byte-count", profile.argvBytes,
    "--peer-argv-count", profile.argvCount,
    "--peer-argv-sha256", profile.argvSha,
    "--peer-cgroup-byte-count", profile.cgroupBytes,
    "--peer-cgroup-sha256", profile.cgroupSha, ...tail];
}

async function main() {
  const releaseMode = process.env[RELEASE_GATE] === "1";
  if (process.env[LIVE_GATE] !== "1") {
    const message = `missing prerequisite: ${prerequisite}`;
    if (releaseMode) throw new Error(`release validation cannot skip: ${message}`);
    console.log(`cadr M6 systemd peer connector live: skipped (${message})`);
    return;
  }
  const missing = await missingPrerequisites();
  if (missing.length > 0) {
    const message = `missing prerequisite: ${missing.join(", ")}; requires ${prerequisite}`;
    if (releaseMode) throw new Error(`release validation cannot skip: ${message}`);
    console.log(`cadr M6 systemd peer connector live: skipped (${message})`);
    return;
  }

  const busctl = await open("/usr/bin/busctl", constants.O_RDONLY | constants.O_NOFOLLOW);
  const systemctl = await open("/usr/bin/systemctl", constants.O_RDONLY | constants.O_NOFOLLOW);
  const authorityHandles = await retainInputs(authorityInputPaths);
  const testHandles = await retainInputs({
    derivation: "scripts/cadr-m6-systemd-peer-connect-test-authority.scm",
    source: "scripts/cadr-m6-systemd-peer-connect.c",
  });
  let connectorHandle = null; let hookedHandle = null;
  try {
    const authority = await buildSelectedImageGuixAuthority(
      descriptorInputs(authorityHandles),
      { source_closure_sha256: sha256(Buffer.from(
        "cadr-m6-systemd-peer-connector-live-release-v1")) });
    await verifyGuixAuthority(authority);
    const connectorEntry = authority.files.find(entry =>
      entry.role === "peer-connector");
    const sourceEntry = authority.files.find(entry =>
      entry.role === "peer-connector-source");
    assert(connectorEntry && sourceEntry,
      "production authority lacks connector binary or source identity");
    const currentSource = await readFile(resolve(ROOT,
      "scripts/cadr-m6-systemd-peer-connect.c"));
    assert.equal(sourceEntry.sha256, sha256(currentSource),
      "current helper source hash differs from exact authority input");
    const connector = resolve(authority.output_path,
      connectorEntry.relative_path);
    const connectorBytes = await readFile(connector);
    assert.equal(connectorEntry.byte_count, String(connectorBytes.length));
    assert.equal(connectorEntry.sha256, sha256(connectorBytes),
      "built connector binary differs from authority identity");
    connectorHandle = await open(connector,
      constants.O_RDONLY | constants.O_NOFOLLOW);
    const connectorDescriptor = `/proc/${process.pid}/fd/${connectorHandle.fd}`;

    const testAuthority = await buildSelectedImagePeerConnectorTestAuthority(
      descriptorInputs(testHandles));
    assert.equal(testAuthority.source.sha256, sha256(currentSource),
      "reviewed test derivation did not compile the current helper source");
    const hookedBytes = await readFile(testAuthority.binary.path);
    assert.equal(testAuthority.binary.byte_count, String(hookedBytes.length));
    assert.equal(testAuthority.binary.sha256, sha256(hookedBytes));
    hookedHandle = await open(testAuthority.binary.path,
      constants.O_RDONLY | constants.O_NOFOLLOW);
    const hookedDescriptor = `/proc/${process.pid}/fd/${hookedHandle.fd}`;

    const rootArgs = ["--system", "--no-pager", "--json=short", "get-property",
      "org.freedesktop.systemd1",
      `/org/freedesktop/systemd1/unit/user_40${process.getuid()}_2eservice`,
      "org.freedesktop.systemd1.Service", "MainPID"];
    const rootEnv = { DBUS_SYSTEM_BUS_ADDRESS:
      "unix:path=/run/dbus/system_bus_socket", LANG: "C", LC_ALL: "C",
    SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "", TZ: "UTC" };
    const queryRoot = () => parseMainPID(requireSuccess(command(
      `/proc/${process.pid}/fd/${busctl.fd}`, rootArgs, { env: rootEnv }),
    "root MainPID query").stdout);

    const selected = queryRoot();
    const profile = await processProfile(selected);
    assert.equal(profile.uid, String(process.getuid()));
    assert.equal(profile.ppid, "1");
    assert.equal(profile.comm, "systemd");

    assert.equal(queryRoot(), selected, "MainPID changed before connector probe");
    const probe = requireSuccess(command(connectorDescriptor,
      connectorArguments(profile),
      { env: { M6_PEER_CONNECT_TEST_MODE: "pidfd-unavailable" } }),
    "exact Guix connector probe");
    assert.equal(text(probe.stdout), "pidfd_profile=so-peerpidfd-v1\n",
      "production Guix connector is hook-free and retains a live pidfd");

    assert.equal(queryRoot(), selected, "MainPID changed before Version query");
    const controlEnv = { DBUS_SESSION_BUS_ADDRESS: "unix:fd=3", LANG: "C",
      LC_ALL: "C", SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "", TZ: "UTC",
      XDG_RUNTIME_DIR: `/run/user/${profile.uid}` };
    const version = requireSuccess(command(connectorDescriptor,
      connectorArguments(profile,
      ["--", `/proc/${process.pid}/fd/${systemctl.fd}`, "--user", "--no-pager",
        "show", "--property=Version"]), { env: controlEnv }),
    "actual fd3 Version query");
    assert.match(text(version.stdout), /^Version=[A-Za-z0-9][A-Za-z0-9.+:~_-]{0,127}\n$/);
    assert.equal(queryRoot(), selected, "MainPID changed after Version query");

    const wrong = [
      ["uid", "--peer-uid", String(Number(profile.uid) + 1)],
      ["gid", "--peer-gid", String(Number(profile.gid) + 1)],
      ["pid", "--peer-pid", String(Number(profile.pid) + 1)],
      ["ppid", "--peer-ppid", "2"],
      ["start", "--peer-start-time", String(BigInt(profile.start) + 1n)],
      ["boot", "--boot-id", "00000000-0000-4000-8000-000000000000"],
      ["comm", "--peer-comm", "not-systemd"],
      ["argv", "--peer-argv-sha256", "00".repeat(32)],
      ["cgroup", "--peer-cgroup-sha256", "00".repeat(32)],
    ];
    for (const [label, option, replacement] of wrong) {
      const args = connectorArguments(profile); const index = args.indexOf(option);
      assert(index >= 0); args[index + 1] = replacement;
      const rejected = command(hookedDescriptor, args, { env: {} });
      assert.equal(rejected.status, 125, `${label} mismatch must fail closed`);
    }
    for (const [mode, status] of [["pidfd-unavailable", 124],
      ["pidfd-dead", 125], ["fdinfo-mismatch", 125]]) {
      const rejected = command(hookedDescriptor, connectorArguments(profile),
        { env: { M6_PEER_CONNECT_TEST_MODE: mode } });
      assert.equal(rejected.status, status, `${mode} must fail closed`);
    }
    assert.equal(queryRoot(), selected, "final MainPID query changed");
    console.log("cadr M6 systemd peer connector live integration passed");
  } finally {
    await Promise.allSettled([busctl.close(), systemctl.close(),
      connectorHandle?.close(), hookedHandle?.close(),
      ...Object.values(authorityHandles).map(handle => handle.close()),
      ...Object.values(testHandles).map(handle => handle.close())]);
  }
}

await main();
