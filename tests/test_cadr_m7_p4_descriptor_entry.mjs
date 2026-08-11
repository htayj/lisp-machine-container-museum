import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants as FS, openSync, readSync, writeSync } from "node:fs";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { addM7P4ProductionRunPolicyForTest, executeM7P4FastDifferentialForTest } from
  "../scripts/run-cadr-m7-p4-fast-differential.mjs";
import { CADR_M7_P4_RESULT_DECODER_STATUS, createM7P4HostResultWriterForTest,
  encodeM7P4HostResultFrameForTest, validateM7P4DescriptorEnvironmentForTest } from
  "../scripts/cadr-m7-p4-descriptor-runner.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const dropperPath = resolve(ROOT, "scripts/cadr-m7-p4-host-dropper.c");
const entryPath = resolve(ROOT, "scripts/cadr-m7-p4-descriptor-runner.mjs");
const [dropper, entry] = await Promise.all([
  readFile(dropperPath, "utf8"), readFile(entryPath, "utf8"),
]);
function configV2() {
  const value = Buffer.alloc(952);
  Buffer.from("M7HDPV2\0", "ascii").copy(value, 0);
  value.writeUInt32LE(2, 8); value.writeUInt32LE(0, 12);
  value.writeUInt32LE(952, 16); value.writeUInt32LE(12, 20);
  value.writeBigUInt64LE(611n, 24); value.writeBigUInt64LE(612n, 32);
  for (let offset = 40; offset < 88; offset += 8) value.writeBigUInt64LE(BigInt(offset), offset);
  value.fill(0x5a, 88, 184);
  const fds = [4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  fds.forEach((fd, index) => {
    const offset = 184 + index * 64;
    value.writeUInt32LE(fd, offset); value.writeUInt32LE(index + 1, offset + 4);
    value.writeBigUInt64LE(BigInt(index + 100), offset + 8);
    value.writeBigUInt64LE(BigInt(index + 200), offset + 16);
    value.writeBigUInt64LE(BigInt(index + 1), offset + 24);
    value.fill(index + 1, offset + 32, offset + 64);
  });
  return value;
}

assert.match(dropper, /CONFIG_BYTES = 952/);
assert.match(dropper, /CONFIG_FILE_COUNT = 12/);
assert.match(dropper, /ROLE_NODE.*ROLE_RUNNER.*ROLE_WASM/s);
assert.match(dropper, /SO_TYPE.*SO_ACCEPTCONN.*getpeername.*SO_PEERCRED/s);
assert.match(dropper, /peer_credentials\.uid != 0.*peer_credentials\.gid != 0/s);
assert.doesNotMatch(dropper, /getpwnam|getgrnam|<pwd\.h>|service_name/);
assert.match(dropper, /account_policy_sha256/);
assert.match(dropper, /__BYTE_ORDER__.*__ORDER_LITTLE_ENDIAN__/s);
assert.match(dropper, /setgroups\(0, NULL\).*drop_bounding_capabilities.*setresgid.*setresuid.*clear_current_capabilities.*PR_SET_NO_NEW_PRIVS/s);
assert.match(dropper, /SYS_execveat, NODE_FD/);
assert.doesNotMatch(dropper, /getenv|secure_getenv|--synthetic/);
assert.match(entry, /actual\.length !== expected\.length.*key !== expected\[index\].*environment\[key\] !== CLOSED_ENVIRONMENT\[key\]/s);
assert.match(entry, /fd: 7, name: "wasm"/);
assert.match(entry, /\[12, 13, 14, 15, 16\].*artifact/s);
assert.match(entry, /const RESULT_FD = 17/);
assert.doesNotMatch(entry, /process\.argv\[1\].*fileURLToPath|main\(\)\.catch/,
  "the importable source never competes with the installed wrapper for fd5 entry ownership");
assert.doesNotMatch(entry, /process\.env\.(?:UID|GID|RUNNER|WASM|MANIFEST|CLOSURE)/);
assert.deepEqual(CADR_M7_P4_RESULT_DECODER_STATUS, {
  schema: "cadr-m7-p4-result-decoder-status-v1",
  implementation: "later-supervisor-slice", production_go: false,
});
const closedEnvironment = {
  HOME: "/var/empty", LANG: "C", LC_ALL: "C", PATH: "/var/empty", TZ: "UTC",
};
assert.equal(validateM7P4DescriptorEnvironmentForTest(closedEnvironment), true);
for (const key of Object.keys(closedEnvironment)) {
  assert.throws(() => validateM7P4DescriptorEnvironmentForTest({
    ...closedEnvironment, [key]: `${closedEnvironment[key]}-wrong`,
  }), /environment is not closed/, `wrong ${key} value is rejected`);
  assert.throws(() => validateM7P4DescriptorEnvironmentForTest(Object.fromEntries(
    Object.entries(closedEnvironment).filter(([candidate]) => candidate !== key))),
  /environment is not closed/, `missing ${key} is rejected`);
}
assert.throws(() => validateM7P4DescriptorEnvironmentForTest({
  ...closedEnvironment, EXTRA: "1",
}), /environment is not closed/, "an extra key is rejected");
const collisionEnvironment = { ...closedEnvironment };
delete collisionEnvironment.HOME; delete collisionEnvironment.LANG;
collisionEnvironment["HOME\nLANG"] = "/var/empty\nC";
assert.throws(() => validateM7P4DescriptorEnvironmentForTest(collisionEnvironment),
  /environment is not closed/, "a newline key cannot collide with two expected keys");
assert.match(entry, /code: "M7_P4_EXECUTION_FAILED", message: "M7 P4 execution failed"/);
assert.doesNotMatch(entry, /String\(error|error\?\.message|error\?\.name/);

const bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 0x5a);
const ranges = [];
const hostile = addM7P4ProductionRunPolicyForTest({
  maxHostTransactions: 1,
  hashArtifact: async () => new Uint8Array(32),
});
assert.equal(hostile.maxHostTransactions, 2048,
  "the production cap replaces, rather than trusts, an attempted caller value");
const digest = await hostile.hashArtifact({ byteCount: BigInt(bytes.byteLength),
  async readRange(offset, count) {
    ranges.push([offset, count]); return new Uint8Array(bytes.subarray(
      Number(offset), Number(offset + count)));
  } });
assert.equal(Buffer.from(digest).toString("hex"),
  createHash("sha256").update(bytes).digest("hex"));
assert.ok(ranges.length === 3 && ranges.every(([, count]) => count <= 1_048_576n),
  "the production-owned hash function streams bounded ranges");
await assert.rejects(executeM7P4FastDifferentialForTest({
  artifacts: [], maxBoundaries: 1n, moduleBytes: new Uint8Array(), moduleIdentity: {},
  nativeAuthority: {}, profile: {}, ready: {}, authorityRoot: {}, supervisor: {},
  maxHostTransactions: 1, hashArtifact: async () => new Uint8Array(32),
}), /missing or unknown fields/,
"the public seven-field production schema never admits caller cap/hash hooks");

const payload = { schema: "cadr-m7-p4-host-result-v2", status: "ok" };
const frame = encodeM7P4HostResultFrameForTest(0, payload);
assert.equal(frame.subarray(0, 8).toString("ascii"), "M7HDRS2\0");
assert.equal(frame.readUInt32LE(8), 2); assert.equal(frame.readUInt32LE(12), 0);
assert.equal(frame.readBigUInt64LE(16), BigInt(frame.byteLength - 56));
assert.deepEqual(frame.subarray(24, 56), createHash("sha256").update(frame.subarray(56)).digest());
assert.equal(frame.subarray(56).toString(),
  '{"schema":"cadr-m7-p4-host-result-v2","status":"ok"}');
assert.throws(() => encodeM7P4HostResultFrameForTest(2, payload), /disposition/);

const fixture = await mkdtemp(resolve(tmpdir(), "cadr-m7-hdpv2-test-"));
try {
  const binary = resolve(fixture, "dropper");
  execFileSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    dropperPath, "-o", binary]);
  assert.equal(spawnSync(binary, ["--inherited-v1"]).status, 64);
  assert.equal(spawnSync(binary, ["--inherited-v2", "/tmp/caller-path"]).status, 64);
  const wrapperPath = resolve(fixture, "installed-descriptor-runner.mjs");
  await writeFile(wrapperPath,
    `import { main } from ${JSON.stringify(new URL(`file://${entryPath}`).href)};\nawait main();\n`);
  const wrapperHandle = await open(wrapperPath, "r");
  try {
    const hostileArgv = spawnSync(process.execPath,
      ["/proc/self/fd/5", "--inherited-v2", "/tmp/caller-path"], {
        env: { HOME: "/tmp", MALICIOUS: "1" },
        stdio: ["ignore", "pipe", "pipe", "ignore", "ignore", wrapperHandle.fd,
          ...Array(11).fill("ignore"), "pipe"],
      });
    assert.equal(hostileArgv.status, 1,
      "the installed-style fd5 wrapper is the sole entry owner and rejects hostile process state");
  } finally { await wrapperHandle.close(); }
  const sizeSource = resolve(fixture, "size.c");
  const sizeBinary = resolve(fixture, "size");
  await writeFile(sizeSource, `#define main dropper_main\n#include "${dropperPath}"\n#undef main\nint main(void){return sizeof(struct m7_host_dropper_config)==952?0:1;}\n`);
  execFileSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    sizeSource, "-o", sizeBinary]);
  assert.equal(spawnSync(sizeBinary).status, 0, "the packed M7HDPV2 record is exactly 952 bytes");
  const configHarnessSource = resolve(fixture, "config.c");
  const configHarness = resolve(fixture, "config");
  await writeFile(configHarnessSource, `#define main dropper_main\n#include "${dropperPath}"\n#undef main\nint main(int argc,char **argv){struct m7_host_dropper_config c;int f;if(argc!=2)return 2;f=open(argv[1],O_RDONLY);if(f<0||dup2(f,6)<0)return 2;close(f);read_configuration(&c);errno=0;return fcntl(6,F_GETFD)==-1&&errno==EBADF?0:3;}\n`);
  execFileSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    configHarnessSource, "-o", configHarness]);
  const validConfig = resolve(fixture, "valid.bin");
  const trailingConfig = resolve(fixture, "trailing.bin");
  const aliasConfig = resolve(fixture, "alias.bin");
  await writeFile(validConfig, configV2());
  await writeFile(trailingConfig, Buffer.concat([configV2(), Buffer.from([0])]));
  const alias = configV2(); alias.writeBigUInt64LE(alias.readBigUInt64LE(184 + 8),
    184 + 64 + 8); alias.writeBigUInt64LE(alias.readBigUInt64LE(184 + 16),
    184 + 64 + 16); await writeFile(aliasConfig, alias);
  assert.equal(spawnSync(configHarness, [validConfig]).status, 0,
    "the exact configuration is consumed and fd6 closes");
  const wrongIdentityConfig = resolve(fixture, "wrong-identity.bin");
  const wrongIdentity = configV2();
  wrongIdentity.writeBigUInt64LE(1001n, 24); wrongIdentity.writeBigUInt64LE(1002n, 32);
  await writeFile(wrongIdentityConfig, wrongIdentity);
  assert.equal(spawnSync(configHarness, [wrongIdentityConfig]).status, 65,
    "the compiled dropper rejects an arbitrary non-root 1001:1002 identity");
  assert.equal(spawnSync(configHarness, [trailingConfig]).status, 65,
    "a trailing configuration byte is rejected");
  assert.equal(spawnSync(configHarness, [aliasConfig]).status, 65,
    "two file-table entries cannot alias one authority object");
  const typeHarnessSource = resolve(fixture, "types.c");
  const typeHarness = resolve(fixture, "types");
  await writeFile(typeHarnessSource, `#define main dropper_main\n#include "${dropperPath}"\n#undef main\nint main(int argc,char **argv){struct m7_host_dropper_config c={0};struct stat s;int p[2];if(argc!=2)return 2;if(!strcmp(argv[1],"result")){if(pipe(p)||dup2(p[1],17)<0||fstat(17,&s))return 2;c.result_dev=s.st_dev;c.result_ino=s.st_ino;verify_result_pipe(&c);return 0;}if(!strcmp(argv[1],"authority")){if(socketpair(AF_UNIX,SOCK_STREAM,0,p)||dup2(p[0],3)<0||fstat(3,&s))return 2;c.authority_dev=s.st_dev;c.authority_ino=s.st_ino;verify_authority_socket(&c);return 0;}return 2;}\n`);
  execFileSync("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    typeHarnessSource, "-o", typeHarness]);
  assert.equal(spawnSync(typeHarness, ["result"]).status, 0,
    "fd17 accepts only its fixed write pipe identity");
  assert.equal(spawnSync(typeHarness, ["authority"]).status, 65,
    "a connected AF_UNIX stream from this non-root peer is not root authority");

  const fifo = name => {
    const path = resolve(fixture, name); execFileSync("mkfifo", [path]); return path;
  };
  const backpressure = fifo("backpressure.fifo");
  const backReader = openSync(backpressure, FS.O_RDONLY | FS.O_NONBLOCK);
  const backWriter = openSync(backpressure, FS.O_WRONLY | FS.O_NONBLOCK);
  const filler = Buffer.alloc(4096, 0x41); let filled = 0;
  for (;;) {
    try { filled += writeSync(backWriter, filler); }
    catch (error) { assert.equal(error.code, "EAGAIN"); break; }
  }
  const freed = Buffer.alloc(4096);
  assert.equal(readSync(backReader, freed), freed.byteLength);
  const largeValue = { schema: "cadr-m7-p4-host-result-v2", status: "ok",
    detail: "x".repeat(128 * 1024) };
  const largeFrame = encodeM7P4HostResultFrameForTest(0, largeValue);
  const backpressureWriter = createM7P4HostResultWriterForTest(backWriter);
  assert.throws(() => backpressureWriter.send(0, largeValue), error => error.code === "EAGAIN",
    "nonblocking backpressure terminates the single partial-write attempt");
  const received = []; const chunk = Buffer.alloc(8192);
  for (;;) {
    const count = readSync(backReader, chunk);
    if (count === 0) break;
    received.push(Buffer.from(chunk.subarray(0, count)));
  }
  closeSync(backReader);
  const joined = Buffer.concat(received);
  const framePrefix = joined.subarray(filled - freed.byteLength);
  assert.ok(framePrefix.byteLength > 0 && framePrefix.byteLength < largeFrame.byteLength);
  assert.deepEqual(framePrefix, largeFrame.subarray(0, framePrefix.byteLength),
    "a partial result is a byte-exact prefix and is never retried as a second frame");

  const closedReaderPath = fifo("closed-reader.fifo");
  const closedReader = openSync(closedReaderPath, FS.O_RDONLY | FS.O_NONBLOCK);
  const closedWriter = openSync(closedReaderPath, FS.O_WRONLY | FS.O_NONBLOCK);
  closeSync(closedReader);
  assert.throws(() => createM7P4HostResultWriterForTest(closedWriter).send(0, payload),
    error => error.code === "EPIPE", "reader close fails the one result attempt with EPIPE");

  const completePath = fifo("complete.fifo");
  const completeReader = openSync(completePath, FS.O_RDONLY | FS.O_NONBLOCK);
  const completeFd = openSync(completePath, FS.O_WRONLY | FS.O_NONBLOCK);
  const completeWriter = createM7P4HostResultWriterForTest(completeFd);
  assert.equal(completeWriter.send(0, payload), frame.byteLength);
  assert.throws(() => completeWriter.send(0, payload), /already attempted/,
    "one writer cannot send a second terminal frame");
  const completeBytes = Buffer.alloc(frame.byteLength);
  assert.equal(readSync(completeReader, completeBytes), frame.byteLength);
  assert.deepEqual(completeBytes, frame);
  assert.equal(readSync(completeReader, Buffer.alloc(1)), 0,
    "closing the one-shot writer exposes EOF immediately after its frame");
  closeSync(completeReader);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log("M7 P4 descriptor dropper/entry tests passed");
