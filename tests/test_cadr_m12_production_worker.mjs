import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { validateCadrM12ProductionSnapshot } from
  "../cadr-web/browser/cadr-m12-production-debugger.mjs";
import { CadrM12ProductionDebugger, cadrM12ProductionDebuggerReceipt } from
  "../cadr-web/browser/cadr-m12-production-debugger.mjs";
import { CadrM13Shell } from "../cadr-web/browser/cadr-m13-shell.mjs";
import { parseCdrDbgStop1 } from "../cadr-web/wasm/cadr-m12-debugger.mjs";

const variant = process.env.CADR_M12_PRODUCTION_VARIANT ?? "O0";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const module = await WebAssembly.compile(await readFile(resolve(
  root, `cadr-web/build/cadr-web-m13-debugger-test-${variant}.wasm`)));
const worker = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });

async function withPendingActiveAudio(snapshot) {
  const source = new Uint8Array(snapshot); const outer = new DataView(source.buffer, source.byteOffset, source.byteLength);
  const coreLength = Number(outer.getBigUint64(24, true)); const oldAudioLength = outer.getUint32(32, true);
  const audioAt = 48 + coreLength + 72; const configAt = audioAt + oldAudioLength;
  const generation = new DataView(source.buffer, source.byteOffset + audioAt - 72, 72).getBigUint64(48, true);
  const audio = new Uint8Array(188 + 64 * 64); const view = new DataView(audio.buffer);
  audio.set(new TextEncoder().encode("CDRAUDS1")); view.setUint32(8, 1, true);
  view.setUint32(12, audio.byteLength, true); view.setBigUint64(16, generation, true);
  view.setBigUint64(24, 0n, true); view.setBigUint64(32, 64n, true);
  view.setBigUint64(40, 1n, true); view.setBigUint64(48, 1n, true);
  view.setBigUint64(56, 32768n, true); view.setBigUint64(64, 40000n, true);
  view.setBigUint64(72, 32768n, true); view.setBigUint64(80, 1n, true);
  view.setUint32(88, 64, true); view.setUint32(96, 63, true); view.setUint32(100, 1, true);
  view.setUint32(104, 1, true); view.setUint32(108, 1, true); view.setUint32(112, 1, true);
  view.setUint32(116, 100, true); view.setUint32(120, 5000000, true);
  let witness = new Uint8Array(32);
  for (let index = 0; index < 64; index += 1) {
    const at = 188 + index * 64; const event = new DataView(audio.buffer, at, 64);
    event.setBigUint64(0, BigInt(index), true); event.setBigUint64(8, generation, true);
    event.setBigUint64(16, 1n, true); event.setUint32(24, index, true); event.setUint32(28, 1, true);
    event.setUint32(32, 512, true); event.setUint32(36, 1, true); event.setUint32(40, 100, true);
    event.setUint32(44, 5000000, true); event.setBigUint64(48, BigInt(index * 512), true);
    event.setUint32(56, 1, true);
    const step = new Uint8Array(104); step.set(new TextEncoder().encode("CDRAUDW1"));
    step.set(witness, 8); step.set(audio.subarray(at, at + 64), 40);
    witness = new Uint8Array(await crypto.subtle.digest("SHA-256", step));
  }
  audio.set(witness, 124); audio.fill(0, 156, 188);
  const result = new Uint8Array(source.byteLength - oldAudioLength + audio.byteLength);
  result.set(source.subarray(0, audioAt)); result.set(audio, audioAt);
  result.set(source.subarray(configAt), audioAt + audio.byteLength);
  const resultView = new DataView(result.buffer); resultView.setBigUint64(16, BigInt(result.byteLength), true);
  resultView.setUint32(32, audio.byteLength, true);
  return result;
}
let nextId = 1;
const request = value => new Promise((resolveReply, reject) => {
  const timeout = setTimeout(() => reject(new Error("private-v8 worker timeout")), 30000);
  worker.once("message", reply => { clearTimeout(timeout); resolveReply(reply); });
  worker.postMessage({ version: 8, id: nextId++, ...value });
});

try {
  let reply = await request({ op: "instantiate", module, sessionId: "12".repeat(32) });
  assert.equal(reply.status, 0, JSON.stringify(reply)); assert.equal(reply.lifecycle, "PAUSED");
  reply = await request({ op: "debug-breakpoint-set", slot: 0,
    breakpoint: { kind: 1, value: 0n } });
  assert.equal(reply.status, 0);
  reply = await request({ op: "m13-debug-micro-step" });
  assert.equal(reply.status, 19); assert.equal(reply.terminal, false,
    "genuine breakpoint stop remains a nonterminal private outcome");
  reply = await request({ op: "m13-debug-macro-step", extra: true });
  assert.equal(reply.status, 2, "private-v8 debugger fields remain closed");
  reply = await request({ op: "m13-debug-snapshot-save" });
  assert.equal(reply.status, 0);
  const { snapshotId, byteCount, snapshotSha256 } = reply; let offset = 0; const chunks = [];
  while (offset < byteCount) {
    reply = await request({ op: "m13-debug-snapshot-next", snapshotId, offset, maxBytes: 1048576 });
    assert.equal(reply.status, 0); assert.equal(reply.offset, offset);
    assert.equal(reply.nextOffset, offset + reply.snapshot.byteLength); chunks.push(new Uint8Array(reply.snapshot)); offset = reply.nextOffset;
  }
  const full = new Uint8Array(byteCount); let at = 0; for (const chunk of chunks) { full.set(chunk, at); at += chunk.byteLength; }
  assert.equal(Buffer.from(await crypto.subtle.digest("SHA-256", full)).toString("hex"), snapshotSha256,
    "real PAUSED stream closes over the saved whole digest");
  const parsed = await validateCadrM12ProductionSnapshot(full, snapshotSha256);
  assert.equal(parsed.bytes.byteLength, byteCount, "real PAUSED snapshot passes the exact browser parser");
  const pendingActive = await withPendingActiveAudio(full);
  const pendingSha256 = Buffer.from(await crypto.subtle.digest("SHA-256", pendingActive)).toString("hex");
  assert.equal((await validateCadrM12ProductionSnapshot(pendingActive, pendingSha256)).bytes.byteLength,
    pendingActive.byteLength, "a valid 64-packet pending-active CDRAUDS1 branch is accepted");
  const pendingAudioAt = 48 + Number(new DataView(pendingActive.buffer).getBigUint64(24, true)) + 72;
  for (const [label, mutate] of [
    ["pending-next/packet closure", view => view.setBigUint64(pendingAudioAt + 72, 32256n, true)],
    ["pending-post/active-post binding", view => view.setBigUint64(pendingAudioAt + 80, 2n, true)],
    ["slot-open pending binding", view => view.setUint32(pendingAudioAt + 104, 0, true)],
  ]) {
    const mutant = pendingActive.slice(); mutate(new DataView(mutant.buffer));
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", mutant)).toString("hex");
    await assert.rejects(validateCadrM12ProductionSnapshot(mutant, digest), /audio/,
      `${label} rejects even after recomputing the whole snapshot digest`);
  }
  const outer = new DataView(full.buffer, full.byteOffset, full.byteLength);
  const audioAt = 48 + Number(outer.getBigUint64(24, true)) + 72;
  const rejectAudioMutation = async (label, mutate) => {
    const mutant = full.slice(); const view = new DataView(mutant.buffer); mutate(view, audioAt);
    const recomputed = Buffer.from(await crypto.subtle.digest("SHA-256", mutant)).toString("hex");
    await assert.rejects(validateCadrM12ProductionSnapshot(mutant, recomputed), /audio|generation/,
      `${label} must fail after recomputing the whole-snapshot digest`);
  };
  await rejectAudioMutation("zero generation", (view, at) => view.setBigUint64(at + 16, 0n, true));
  await rejectAudioMutation("head/next/count mismatch", (view, at) => view.setBigUint64(at + 32, 1n, true));
  await rejectAudioMutation("queued-frame mismatch", (view, at) => view.setBigUint64(at + 56, 1n, true));
  await rejectAudioMutation("head-frame mismatch", (view, at) => view.setUint32(at + 92, 1, true));
  await rejectAudioMutation("boolean overflow", (view, at) => view.setUint32(at + 100, 2, true));
  await rejectAudioMutation("renderer mismatch", (view, at) => view.setUint32(at + 108, 3, true));
  await rejectAudioMutation("pending_active mismatch", (view, at) => view.setUint32(at + 112, 1, true));
  await rejectAudioMutation("inactive pending half-wave", (view, at) => view.setUint32(at + 116, 1, true));
  await rejectAudioMutation("inactive pending duration", (view, at) => view.setUint32(at + 120, 1, true));
  await rejectAudioMutation("inactive pending total", (view, at) => view.setBigUint64(at + 64, 1n, true));
  await rejectAudioMutation("inactive pending next", (view, at) => view.setBigUint64(at + 72, 1n, true));
  await rejectAudioMutation("inactive pending post", (view, at) => view.setBigUint64(at + 80, 1n, true));
  await rejectAudioMutation("queue witness mismatch", (view, at) => view.setUint8(at + 124, view.getUint8(at + 124) ^ 1));
  reply = await request({ op: "m13-debug-snapshot-release", snapshotId });
  assert.equal(reply.status, 0); assert.equal(reply.released, true);
  reply = await request({ op: "m13-debug-snapshot-next", snapshotId, offset: 0, maxBytes: 1 });
  assert.equal(reply.status, 9, "released bytes cannot be streamed again");
  reply = await request({ op: "debug-breakpoint-clear", slot: 0 }); assert.equal(reply.status, 0);
  reply = await request({ op: "debug-resume-one-boundary" }); assert.equal(reply.status, 0);
  reply = await request({ op: "m13-debug-micro-step" }); assert.equal(reply.status, 0);
  reply = await request({ op: "m13-debug-test-arm-macro-limit" }); assert.equal(reply.status, 0);
  reply = await request({ op: "m13-debug-macro-step" });
  assert.equal(reply.status, 20, "genuine macro-step limit is surfaced without a fabricated lower reply");
  assert.equal(reply.terminal, false);
  assert.equal(parseCdrDbgStop1(reply.result.stop).operationSlots, 1048576n,
    "the compile-gated cheap-slot seam still reaches the exact production macro limit");
} finally { await worker.terminate(); }

console.log(`cadr m12 production private-worker ${variant} tests passed`);

/* The actual production coordinator reaches STOP_BOUND, streams the complete
 * private snapshot, and constructs reviewed CDRPROV1/CDRBUG1 bytes through a
 * real worker rather than a fabricated snapshot fixture. */
{
  const worker2 = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
  const digest = async value => Buffer.from(await crypto.subtle.digest("SHA-256", value)).toString("hex");
  const shell = new CadrM13Shell({ worker: worker2, wasmCompiler: async () => module,
    sha256Function: digest, sessionRandom: () => Uint8Array.from({ length: 32 }, () => 4) });
  let id = 1; const submit = (op, fields = {}) => shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: id++, op, ...fields });
  try {
    const wasmBytes = await readFile(resolve(root, `cadr-web/build/cadr-web-m13-debugger-test-${variant}.wasm`));
    assert.equal((await submit("bootstrap", { wasmBytes: wasmBytes.buffer.slice(wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength), wasmSha256: await digest(wasmBytes) })).status, 0);
    assert.equal((await submit("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    const m10Authority = (release = async () => ({ released: true })) => ({
      async acquire() { return Object.freeze({ binding: Object.freeze({ generation: "0", headSeq: "1",
        manifestSha256: "00".repeat(32), rootSha256: "00".repeat(32) }), release }); },
      revoke() { return Object.freeze({ revoked: true }); },
    });
    const ordinaryExporter = async bundle => ({
      async commit() { assert.ok(bundle.snapshot.byteLength > 1000); return { prepared: true }; },
      accept() { return { published: true, receipt: "test-bundle" }; },
      async cancel() { new Uint8Array(bundle.snapshot).fill(0); new Uint8Array(bundle.provenance).fill(0);
        new Uint8Array(bundle.diagnostic).fill(0); return { cancelled: true, published: false, erased: true }; },
    });
    const makeCoordinator = (realTransaction, dispose = reason => realTransaction.dispose(reason),
      exporter = ordinaryExporter, publicationTimeoutMs = 1000, reviewAuthority = m10Authority()) =>
      new CadrM12ProductionDebugger({ request: submit,
      openSnapshotTransaction: () => ({ save: () => realTransaction.save(),
        next: (offset, maxBytes) => realTransaction.next(offset, maxBytes),
        dispose, onInvalidating: observer => realTransaction.onInvalidating(observer),
        onDisposition: observer => realTransaction.onDisposition(observer) }),
      receipt: cadrM12ProductionDebuggerReceipt(),
      digest, audio: { async joinTail() { return { joined: true }; },
        async pause() { return { status: 0, paused: true }; },
        async reducePause() { return { committed: true, state: "PAUSED" }; } },
      m10Authority: reviewAuthority,
      exportBundle: exporter, publicationTimeoutMs,
    });
    const coordinator = makeCoordinator(shell.openDebuggerHostTransaction());
    assert.equal((await coordinator.request("debug-micro-step")).status, 19);
    assert.equal(coordinator.state, "STOP_BOUND"); const preparing = coordinator.prepareReview();
    const racingMutation = coordinator.request("debug-breakpoint-clear", { slot: 0 });
    const review = await preparing;
    await assert.rejects(racingMutation, /freezes/, "same-tick mutation is admitted only inside the serialized tail");
    assert.equal(coordinator.state, "REVIEW_READY"); assert.ok(review.provenance.byteLength > 0);
    const token = await coordinator.beginReviewExport();
    assert.equal((await submit("machine-reset")).status, 0);
    assert.equal(coordinator.state, "FAILED", "reset invalidates the old review coordinator before it completes");
    assert.equal(coordinator.review, null); assert.equal(coordinator.zeroizationReceipt.verifiedZero, true);
    assert.ok(coordinator.zeroizationReceipt.snapshotBytes > 1000 && coordinator.zeroizationReceipt.provenanceBytes > 0 &&
      coordinator.zeroizationReceipt.diagnosticBytes > 0, "reset verifies host snapshot and review-record erasure");
    await assert.rejects(coordinator.completeReviewExport(token), /export token stale/,
      "a pre-reset export token cannot publish after host erasure");

    assert.equal((await submit("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    let rejectUnpinOnce = true; const secondReal = shell.openDebuggerHostTransaction();
    const second = makeCoordinator(secondReal, undefined, ordinaryExporter, 1000,
      m10Authority(async () => { if (rejectUnpinOnce) { rejectUnpinOnce = false; throw new Error("synthetic unpin failure"); }
        return { released: true }; }));
    assert.equal((await second.request("debug-micro-step")).status, 19);
    const freshReview = await second.prepareReview();
    assert.ok(freshReview.provenance.byteLength > 0, "a post-reset review must be freshly prepared");
    const freshToken = await second.beginReviewExport();
    await assert.rejects(second.completeReviewExport(freshToken), /unpin failure/);
    assert.equal(second.state, "RELEASE_REQUIRED", "unpin failure retains a discard-capable recovery state");
    assert.equal(second.review, null,
      "after worker release, an unpin retry retains only the durable M10 lease, never review bytes");
    await second.discardReview();
    assert.equal(second.state, "PAUSED"); assert.equal(second.review, null);

    const neverCommit = new Promise(() => {}); let commitCancelled = false;
    const commitTimeout = makeCoordinator(shell.openDebuggerHostTransaction(), undefined, async bundle => ({
      async commit() { return neverCommit; },
      accept() { throw new Error("timed-out commit must not publish"); },
      async cancel() { commitCancelled = true; new Uint8Array(bundle.snapshot).fill(0);
        new Uint8Array(bundle.provenance).fill(0); new Uint8Array(bundle.diagnostic).fill(0);
        return { cancelled: true, published: false, erased: true }; },
    }), 20);
    assert.equal((await commitTimeout.request("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    assert.equal((await commitTimeout.request("debug-micro-step")).status, 19);
    await commitTimeout.prepareReview(); const commitToken = await commitTimeout.beginReviewExport();
    await assert.rejects(commitTimeout.completeReviewExport(commitToken), /commit timeout/);
    assert.equal(commitCancelled, true); assert.equal(commitTimeout.state, "REVIEW_READY");
    assert.ok(commitTimeout.review, "confirmed pre-publication cancellation permits explicit discard recovery");
    await commitTimeout.discardReview(); assert.equal(commitTimeout.state, "PAUSED");

    /* A reset while a hostile exporter holds the exact staged buffers closes
     * the epoch before worker reset. The exporter may delay returning its
     * transaction but cannot publish or retain nonzero staged bytes. */
    assert.equal((await submit("machine-reset")).status, 0);
    let releaseResetStage; const resetStage = new Promise(resolve => { releaseResetStage = resolve; });
    let releaseResetCancel; const resetCancel = new Promise(resolve => { releaseResetCancel = resolve; });
    let resetBundle; let resetPublished = false; let resetCancelled = false;
    const resetExporter = async bundle => {
      resetBundle = bundle; await resetStage;
      return { async commit() { return { prepared: true }; },
        accept() { resetPublished = true; return { published: true, receipt: "stale-reset" }; },
        async cancel() { resetCancelled = true; await resetCancel;
          return { cancelled: true, published: false, erased: true }; } };
    };
    const resetting = makeCoordinator(shell.openDebuggerHostTransaction(), undefined, resetExporter);
    assert.equal((await resetting.request("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    assert.equal((await resetting.request("debug-micro-step")).status, 19);
    await resetting.prepareReview(); const resetToken = await resetting.beginReviewExport();
    const pendingResetExport = resetting.completeReviewExport(resetToken);
    while (resetBundle === undefined) await new Promise(resolve => setTimeout(resolve, 0));
    let resetSettled = false;
    const reset = submit("machine-reset").then(value => { resetSettled = true; return value; });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(resetSettled, false, "reset waits while export staging has no cancellation handle");
    releaseResetStage();
    while (!resetCancelled) await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(resetSettled, false, "reset waits for the delayed cancellation receipt");
    releaseResetCancel();
    const resetReply = await reset;
    assert.equal(resetReply.status, 0, JSON.stringify(resetReply));
    await assert.rejects(pendingResetExport, /invalidation/);
    assert.equal(resetPublished, false); assert.equal(resetCancelled, true);
    assert.equal(resetting.state, "FAILED"); assert.equal(resetting.review, null);
    for (const bytes of [resetBundle.snapshot, resetBundle.provenance, resetBundle.diagnostic]) {
      assert.ok(new Uint8Array(bytes).every(value => value === 0), "reset erases every escaped staged byte");
    }

    assert.equal((await submit("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    let releaseLossStage; const lossStage = new Promise(resolve => { releaseLossStage = resolve; });
    let lossBundle; let lossPublished = false; let lossCancelled = false;
    const lossExporter = async bundle => {
      lossBundle = bundle; await lossStage;
      return { async commit() { return { prepared: true }; },
        accept() { lossPublished = true; return { published: true, receipt: "stale-loss" }; },
        async cancel() { lossCancelled = true; return { cancelled: true, published: false, erased: true }; } };
    };
    const lost = makeCoordinator(shell.openDebuggerHostTransaction(), undefined, lossExporter);
    assert.equal((await lost.request("debug-micro-step")).status, 19);
    await lost.prepareReview(); const lostToken = await lost.beginReviewExport();
    const pendingLossExport = lost.completeReviewExport(lostToken);
    while (lossBundle === undefined) await new Promise(resolve => setTimeout(resolve, 0));
    worker2.emit("error", new Error("injected worker loss")); releaseLossStage();
    await assert.rejects(pendingLossExport, /invalidation/);
    assert.equal(lossPublished, false); assert.equal(lossCancelled, true);
    assert.equal(lost.state, "FAILED"); assert.equal(lost.review, null);
    assert.equal(lost.zeroizationReceipt.verifiedZero, true);
    for (const bytes of [lossBundle.snapshot, lossBundle.provenance, lossBundle.diagnostic]) {
      assert.ok(new Uint8Array(bytes).every(value => value === 0), "worker loss erases every escaped staged byte");
    }
  } finally { shell.dispose(); await worker2.terminate(); }
}

/* A non-returning stage or cancellation cannot wedge reset indefinitely.
 * Both are contract violations and therefore terminate the shell rather than
 * allowing reset to overtake uncertain publication state. */
async function publicationTimeoutRace(kind) {
  const candidate = new Worker(pathToFileURL(resolve(root, "cadr-web/wasm/cadr-worker.js")), { type: "module" });
  const digest = async value => Buffer.from(await crypto.subtle.digest("SHA-256", value)).toString("hex");
  const shell = new CadrM13Shell({ worker: candidate, wasmCompiler: async () => module,
    sha256Function: digest, sessionRandom: () => Uint8Array.from({ length: 32 }, () => kind === "stage" ? 6 : 7) });
  let id = 1; const submit = (op, fields = {}) => shell.submit({ type: "cadr-request", version: 8,
    sessionId: shell.sessionId, id: id++, op, ...fields });
  let entered = false;
  const never = new Promise(() => {});
  let resolveLateStage; const lateStage = new Promise(resolve => { resolveLateStage = resolve; });
  let latePublished = false;
  const exporter = kind === "stage" ? async () => { entered = true; return never; } :
    (kind === "stage-alone" ? async () => { entered = true; return lateStage; } : async bundle => {
    entered = true;
    return { async commit() { return never; },
      accept() { throw new Error("unreachable stale accept"); },
      async cancel() { new Uint8Array(bundle.snapshot).fill(0); return never; } };
  });
  try {
    const wasmBytes = await readFile(resolve(root, `cadr-web/build/cadr-web-m13-debugger-test-${variant}.wasm`));
    assert.equal((await submit("bootstrap", { wasmBytes: wasmBytes.buffer.slice(wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength), wasmSha256: await digest(wasmBytes) })).status, 0);
    const transaction = shell.openDebuggerHostTransaction();
    const coordinator = new CadrM12ProductionDebugger({ request: submit,
      openSnapshotTransaction: () => transaction, receipt: cadrM12ProductionDebuggerReceipt(), digest,
      publicationTimeoutMs: 20, exportBundle: exporter,
      audio: { async joinTail() { return { joined: true }; }, async pause() { return { status: 0, paused: true }; },
        async reducePause() { return { committed: true, state: "PAUSED" }; } },
      m10Authority: { async acquire() { return { binding: {}, async release() { return { released: true }; } }; },
        revoke() { return { revoked: true }; } },
    });
    assert.equal((await coordinator.request("debug-breakpoint-set", { slot: 0,
      breakpoint: { kind: 1, value: 0n } })).status, 0);
    assert.equal((await coordinator.request("debug-micro-step")).status, 19);
    await coordinator.prepareReview(); const token = await coordinator.beginReviewExport();
    const pending = coordinator.completeReviewExport(token);
    while (!entered) await new Promise(resolve => setTimeout(resolve, 0));
    if (kind === "stage-alone") {
      await assert.rejects(Promise.race([pending, new Promise((_, reject) =>
        setTimeout(() => reject(new Error("standalone stage timeout wedged")), 3000))]), /staging timeout/);
      assert.equal(coordinator.state, "FAILED"); assert.equal(coordinator.review, null);
      assert.equal(shell.state, "NEW",
        "bounded staging rejection closes P2 without granting its inert late promise a publication path");
      resolveLateStage({ async commit() { return { prepared: true }; },
        accept() { latePublished = true; return { published: true, receipt: "late" }; },
        async cancel() { return { cancelled: true, published: false, erased: true }; } });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(latePublished, false, "late staging resolution cannot revive publication");
      return;
    }
    const reset = submit("machine-reset");
    const boundedReset = await Promise.race([reset, new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${kind} timeout wedged reset`)), 2000))]);
    assert.equal(boundedReset.status, kind === "stage" ? 0 : 25);
    assert.equal(boundedReset.terminal, kind !== "stage");
    await assert.rejects(pending, /timeout|cancellation/);
    assert.equal(coordinator.state, "FAILED"); assert.equal(coordinator.review, null);
    assert.equal(shell.state, kind === "stage" ? "NEW" : "FAILED");
  } finally { shell.dispose(); await candidate.terminate(); }
}

await publicationTimeoutRace("stage");
await publicationTimeoutRace("cancel");
await publicationTimeoutRace("stage-alone");
