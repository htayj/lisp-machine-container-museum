import assert from "node:assert/strict";
import {
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  CADR_M6_READY_CONTRACT,
  CADR_M6_SCHEMA,
} from "../cadr-web/wasm/cadr-m6-headless-boot.mjs";
import {
  failureEvidence,
  failureOutputPath,
  writeCanonicalNoReplaceAtomically,
} from "../scripts/run-cadr-m6-wasm-conformance.mjs";
import { canonicalJson } from "../scripts/validate-cadr-m6-wasm-evidence.mjs";

const DIGEST = "ab".repeat(32);
const loaded = Object.freeze({
  expected: Object.freeze([
    { kind: 1, id: "cadr-web-303-runnable-template", localPath: "profile", byteCount: 1n, sha256: DIGEST },
    { kind: 2, id: "prom-control-store", localPath: "prom", byteCount: 2n, sha256: DIGEST },
    { kind: 4, id: "prom-symbols", localPath: "prom.sym", byteCount: 4n, sha256: DIGEST },
    { kind: 5, id: "microcode-symbols", localPath: "ucadr.sym", byteCount: 5n, sha256: DIGEST },
    { kind: 3, id: "system-303-0-base-disk", localPath: "disk", byteCount: 3n, sha256: DIGEST },
  ]),
  profile: Object.freeze({ profile: Object.freeze({ id: "CADR-WEB-303" }) }),
  nativeInputs: Object.freeze([{ id: "usite-extra-hosts", byte_count: "262", sha256: DIGEST }]),
  releaseSha256: DIGEST,
});

function failedConformance(detail) {
  return {
    schema: "cadr-m6-wasm-ready-conformance-v1",
    outcome: "failed",
    completed_runs: 0,
    failed_run: 0,
    failure: {
      preflight: null,
      run_evidence: null,
      transcript_tail: [],
      report: {
        schema: CADR_M6_SCHEMA,
        schemaVersion: 1,
        outcome: "failed",
        reason: "invalid-boot-configuration",
        phase: "preflight",
        status: 2,
        detail,
        mutationStarted: false,
      },
    },
  };
}

const envelope = failureEvidence({
  loaded,
  wasm: Object.freeze({ byteCount: 123, sha256: "cd".repeat(32) }),
  negativePreflight: Object.freeze({
    artifact_kind: 1,
    mutation_started: false,
    outcome: "failed",
    reason: "artifact-preflight-mismatch",
    worker_created: false,
    worker_requests: 0,
  }),
  conformance: failedConformance("first retained failure"),
});
assert.equal(envelope.schema, "cadr-m6-real-wasm-failure-evidence-v1");
assert.equal(envelope.failure_diagnostic.failure.report.detail, "first retained failure");
assert.equal(envelope.failure_diagnostic.failure.report.mutationStarted, false);
assert.equal(failureOutputPath("/tmp/m6.json"), "/tmp/m6.json.failure.json");

const directory = await mkdtemp(resolve(tmpdir(), "cadr-m6-failure-receipt-"));

function injectedPrivatePublishIo(directoryPath, failure) {
  let parentSyncCalls = 0;
  let temporaryUnlinkCalls = 0;
  return Object.freeze({
    mkdir,
    link: async (...args) => {
      if (failure === "link") throw new Error("injected link failure");
      return link(...args);
    },
    open: async (path, flags) => {
      const handle = await open(path, flags);
      const isParent = path === directoryPath;
      return Object.freeze({
        close: () => handle.close(),
        sync: async () => {
          if (failure === "temp-fsync" && !isParent) {
            throw new Error("injected temporary fsync failure");
          }
          if (failure === "parent-fsync" && isParent && parentSyncCalls++ === 0) {
            throw new Error("injected post-link parent fsync failure");
          }
          return handle.sync();
        },
      });
    },
    unlink: async path => {
      if (failure === "temp-unlink" && path.includes(".cadr-m6-failure-diagnostic.tmp") &&
          temporaryUnlinkCalls++ === 0) {
        throw new Error("injected post-link temporary unlink failure");
      }
      return unlink(path);
    },
    writeFile: async (...args) => {
      if (failure === "write") throw new Error("injected exclusive write failure");
      return writeFile(...args);
    },
  });
}

async function assertNoTemporaryFiles() {
  assert.deepEqual((await readdir(directory)).filter(name => name.includes(".tmp")), [],
    "failed publication leaves no temporary receipt behind");
}

try {
  const path = resolve(directory, "cadr-m6-wasm-conformance.json.failure.json");
  const first = await writeCanonicalNoReplaceAtomically(path, envelope, 0o600);
  assert.equal((await stat(path)).mode & 0o777, 0o600,
    "private failure receipt is not world-readable");
  assert.equal((await readFile(path, "utf8")), canonicalJson(envelope));
  assert.equal(first.byteCount, Buffer.byteLength(canonicalJson(envelope)));

  const replacement = failureEvidence({
    loaded,
    wasm: Object.freeze({ byteCount: 123, sha256: "cd".repeat(32) }),
    negativePreflight: envelope.negative_preflight,
    conformance: failedConformance("replacement retained failure"),
  });
  const beforeRejectedReplacement = await readFile(path, "utf8");
  await assert.rejects(
    () => writeCanonicalNoReplaceAtomically(path, replacement, 0o600),
    error => error?.code === "EEXIST",
    "a prior diagnostic is never replaced",
  );
  assert.equal(await readFile(path, "utf8"), beforeRejectedReplacement,
    "a no-replace collision preserves the earlier complete failure receipt");
  await assertNoTemporaryFiles();

  for (const [failure, expected] of [
    ["write", /exclusive write failure/],
    ["temp-fsync", /temporary fsync failure/],
    ["link", /link failure/],
    ["temp-unlink", /temporary unlink failure/],
    ["parent-fsync", /post-link parent fsync failure/],
  ]) {
    const failedPath = resolve(directory, `${failure}.failure.json`);
    await assert.rejects(
      () => writeCanonicalNoReplaceAtomically(
        failedPath, envelope, 0o600, injectedPrivatePublishIo(directory, failure)),
      expected,
      `${failure} failure is propagated after cleanup`,
    );
    await assert.rejects(() => readFile(failedPath), error => error?.code === "ENOENT",
      `${failure} failure leaves no published failure receipt`);
    await assertNoTemporaryFiles();
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("cadr_m6_wasm_runner_failure: ok");
