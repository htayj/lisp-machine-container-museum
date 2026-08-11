/* M12-P2 debugger/review coordinator.  Snapshot authority is a private host
 * capability supplied by CadrM13Shell, never a protocol-v8 request name. */
import { CADR_M12_P2_RAW_SNAPSHOT_BYTES } from "./cadr-m13-shell.mjs";
import { validateCdrSnap1Structure } from "../wasm/cadr-m10-wrapper.mjs";
import {
  CADR_M12_DEBUGGER_PROFILE, parseCdrDbgStop1, serializeCdrProv1,
  serializeCdrBug1, parseCdrProv1, parseCdrBug1,
} from "../wasm/cadr-m12-debugger.mjs";

export const CADR_M12_PRODUCTION_DEBUGGER_PROFILE =
  "CADR-WEB-303/ABI1.11/protocol-v8/M12-P2-DBGPROV1";
export const CADR_M12_PRODUCTION_DEBUGGER_RECEIPT_SCHEMA = "M12-P2-DBGPROV1";
export const CADR_M12_PRODUCTION_DEBUGGER_STATES = Object.freeze([
  "PAUSED", "STEPPING", "STOP_BOUND", "REVIEW_PREPARING", "REVIEW_READY",
  "EXPORT_PREPARED", "RELEASE_REQUIRED", "UNPIN_REQUIRED", "FAILED",
]);

const MUTATING = new Set(["debug-breakpoint-set", "debug-breakpoint-clear",
  "debug-resume-one-boundary", "debug-trace-filter", "debug-micro-step", "debug-macro-step"]);
const PUBLIC = new Set([...MUTATING, "debug-inspect-read", "debug-stop-record"]);
const TEXT = new TextDecoder();
const DEBUGGER_PROFILE_SHA256 = Uint8Array.from(
  "8c0ef85505485aacfd bf42d4efef416e7a4c0964fbc59037d234b4e499b9f1a0".replaceAll(" ", "").match(/../g),
  value => Number.parseInt(value, 16));
function assert(c, m) { if (!c) throw new TypeError(`M12-P2: ${m}`); }
function plain(v) { return v !== null && typeof v === "object" && !Array.isArray(v) &&
  [null, Object.prototype].includes(Object.getPrototypeOf(v)); }
function exact(v, label, keys) { assert(plain(v), `${label} must be a record`); const own = Reflect.ownKeys(v);
  assert(own.every(k => typeof k === "string") && own.length === keys.length && keys.every(k => Object.hasOwn(v, k)),
    `${label} fields are not exact`); return v; }
function bytes(v, label, max = Number.MAX_SAFE_INTEGER) { const b = v instanceof ArrayBuffer ? new Uint8Array(v) :
  ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : null;
  assert(b !== null && b.byteLength <= max, `${label} is not bounded bytes`); return b.slice(); }
function same(a, b) { return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]); }
function hex(b) { return [...b].map(v => v.toString(16).padStart(2, "0")).join(""); }
function unhex(s) { assert(typeof s === "string" && /^[0-9a-f]{64}$/.test(s), "digest is not canonical");
  return Uint8Array.from(s.match(/../g), x => Number.parseInt(x, 16)); }
async function sha(b, injected = null) { if (injected !== null) { const out = await injected(b.slice().buffer);
  const result = typeof out === "string" ? unhex(out) : bytes(out, "SHA-256", 32);
  assert(result.byteLength === 32, "SHA-256 has wrong length"); return result; }
  assert(globalThis.crypto?.subtle?.digest, "SHA-256 unavailable");
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", b)); }
function magic(b, at, value) { return TEXT.decode(b.subarray(at, at + value.length)) === value; }

export function cadrM12ProductionDebuggerReceipt() { return Object.freeze({
  schema: CADR_M12_PRODUCTION_DEBUGGER_RECEIPT_SCHEMA, profile: CADR_M12_PRODUCTION_DEBUGGER_PROFILE,
  lowerProfile: CADR_M12_DEBUGGER_PROFILE, snapshotFormat: "CDRM12S1-v2",
  snapshotCeiling: CADR_M12_P2_RAW_SNAPSHOT_BYTES, disposition: "source-only",
}); }
export function validateCadrM12ProductionDebuggerReceipt(v) { const wanted = cadrM12ProductionDebuggerReceipt();
  exact(v, "receipt", Object.keys(wanted)); for (const [k, x] of Object.entries(wanted)) assert(v[k] === x, `receipt.${k} mismatch`); return wanted; }

function validateEvent(event, generation) {
  const v = new DataView(event.buffer, event.byteOffset, 64); const kind = v.getUint32(28, true);
  assert(v.getBigUint64(8, true) === generation && v.getUint32(60, true) === 0, "audio event generation/reserved");
  if (kind === 1) { const duration = v.getUint32(44, true), frame = v.getBigUint64(48, true);
    const total = (BigInt(duration) * 8000n + 999999n) / 1000000n; const remaining = total - frame;
    assert(duration > 0 && frame < total && frame % 512n === 0n && v.getUint32(32, true) === Number(remaining > 512n ? 512n : remaining) &&
      [1, 3].includes(v.getUint32(36, true)) && v.getUint32(40, true) > 0 && v.getUint32(56, true) === 1,
    "audio beep event");
  } else if (kind === 2) { const source = v.getUint32(56, true), format = v.getUint32(44, true);
    assert(v.getUint32(32, true) === 0 && v.getBigUint64(48, true) === 300n && v.getUint32(40, true) <= 255 &&
      v.getUint32(36, true) === 5 && ((source === 2 && format === 0x20208) || (source === 3 && format === 0x10207)),
    "audio UART event");
  } else assert(false, "audio event kind");
}

async function validateAudio(b, digest) {
  assert(b.byteLength >= 188 && b.byteLength <= 4284 && magic(b, 0, "CDRAUDS1"), "audio sidecar envelope");
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), count = v.getUint32(88, true);
  assert(v.getUint32(8, true) === 1 && v.getUint32(12, true) === b.byteLength && count <= 64 && b.byteLength === 188 + count * 64,
    "audio sidecar length/count");
  const generation = v.getBigUint64(16, true), head = v.getBigUint64(24, true), next = v.getBigUint64(32, true),
    lastPost = v.getBigUint64(40, true), activePost = v.getBigUint64(48, true), queued = v.getBigUint64(56, true),
    pendingTotal = v.getBigUint64(64, true), pendingNext = v.getBigUint64(72, true), pendingPost = v.getBigUint64(80, true);
  const headFrame = v.getUint32(92, true), lastIntra = v.getUint32(96, true), haveLast = v.getUint32(100, true),
    slotOpen = v.getUint32(104, true), renderer = v.getUint32(108, true), pending = v.getUint32(112, true),
    pendingHalf = v.getUint32(116, true), pendingDuration = v.getUint32(120, true);
  assert(generation > 0n && next >= head && next - head === BigInt(count) && [0, 1].includes(haveLast) &&
    [0, 1].includes(slotOpen) && [1, 2].includes(renderer) && [0, 1].includes(pending), "audio header semantics");
  let witness = b.subarray(156, 188).slice(), frames = 0n, prior = null, pendingPackets = 0, pendingOffset = 0n;
  for (let i = 0; i < count; i += 1) { const event = b.subarray(188 + i * 64, 252 + i * 64); validateEvent(event, generation);
    const e = new DataView(event.buffer, event.byteOffset, 64); const seq = e.getBigUint64(0, true), post = e.getBigUint64(16, true), intra = e.getUint32(24, true);
    assert(seq === head + BigInt(i), "audio sequence");
    if (prior) assert(post > prior.post ? intra === 0 : post === prior.post && prior.intra < 0xffffffff && intra === prior.intra + 1, "audio ordering");
    const fc = e.getUint32(32, true); assert(i !== 0 || (fc === 0 ? headFrame === 0 : headFrame < fc), "audio head frame");
    frames += BigInt(fc - (i === 0 ? headFrame : 0));
    if (pending !== 0) {
      if (e.getBigUint64(16, true) === pendingPost) {
        assert(e.getUint32(28, true) === 1 && e.getUint32(40, true) === pendingHalf &&
          e.getUint32(44, true) === pendingDuration && e.getBigUint64(48, true) === pendingOffset && fc === 512,
        "audio pending packet");
        pendingOffset += BigInt(fc); pendingPackets += 1;
      } else assert(pendingPackets === 0 && e.getBigUint64(16, true) < pendingPost, "audio pending ordering");
    }
    const step = new Uint8Array(8 + 32 + 64); step.set(new TextEncoder().encode("CDRAUDW1")); step.set(witness, 8); step.set(event, 40);
    witness = await sha(step, digest); prior = { post, intra };
  }
  assert(frames === queued && same(witness, b.subarray(124, 156)) && (count !== 0 || headFrame === 0), "audio queue witness");
  if (count !== 0) assert(haveLast === 1 && lastPost === prior.post && lastIntra === prior.intra, "audio tail binding");
  if (pending !== 0) { const total = (BigInt(pendingDuration) * 8000n + 999999n) / 1000000n;
    assert(count === 64 && pendingHalf !== 0 && pendingDuration !== 0 && total > 0n && total === pendingTotal &&
      pendingNext > 0n && pendingNext < total && pendingNext % 512n === 0n && pendingPost === activePost &&
      slotOpen === 1 && pendingPackets > 0 && pendingOffset === pendingNext, "audio pending state");
  } else assert(pendingHalf === 0 && pendingDuration === 0 && pendingTotal === 0n && pendingNext === 0n &&
    pendingPost === 0n, "audio inactive pending state");
  return Object.freeze({ generation });
}

function validateConfig(b, generation) {
  assert(b.byteLength === 1088 && magic(b, 0, "CDRM12C1"), "debugger config envelope"); const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  assert(v.getUint32(8, true) === 1 && v.getUint32(12, true) === 1088 && same(b.subarray(16, 48), DEBUGGER_PROFILE_SHA256) &&
    v.getBigUint64(48, true) === generation && v.getUint32(56, true) === 64 && v.getUint32(60, true) === 0,
  "debugger config binding");
  for (let i = 0; i < 64; i += 1) { const at = 64 + i * 16, enabled = v.getUint32(at, true), kind = v.getUint32(at + 4, true), value = v.getBigUint64(at + 8, true);
    assert((enabled === 0 && kind === 0 && value === 0n) || (enabled === 1 && kind >= 1 && kind <= 5 &&
      (![1, 2].includes(kind) || value <= 0xffffffffn) && (![4, 5].includes(kind) || value === 1n)), "debugger breakpoint record"); }
}

export async function validateCadrM12ProductionSnapshot(value, expectedSha256 = null, digest = null) {
  const b = bytes(value, "snapshot", CADR_M12_P2_RAW_SNAPSHOT_BYTES); assert(b.byteLength >= 48 && magic(b, 0, "CDRM12S1"), "snapshot envelope");
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), coreLength = Number(v.getBigUint64(24, true)), audioLength = v.getUint32(32, true), configLength = v.getUint32(36, true);
  assert(v.getUint32(8, true) === 2 && v.getUint32(12, true) === 48 && v.getBigUint64(16, true) === BigInt(b.byteLength) &&
    Number.isSafeInteger(coreLength) && coreLength >= 936 && coreLength <= 18126780 && audioLength >= 188 && audioLength <= 4284 &&
    configLength === 1088 && v.getUint32(40, true) === 72 && v.getUint32(44, true) === 0 &&
    48 + coreLength + 72 + audioLength + configLength === b.byteLength, "snapshot section closure");
  const core = b.subarray(48, 48 + coreLength), structure = await validateCdrSnap1Structure(core);
  const cv = new DataView(core.buffer, core.byteOffset, core.byteLength), profile = core.subarray(104, 136).slice();
  let coreChunk = null, cpuChunk = null;
  for (let i = 0; i < structure.chunkCount; i += 1) { const at = 264 + i * 64, type = cv.getUint32(at, true), off = Number(cv.getBigUint64(at + 8, true)), len = Number(cv.getBigUint64(at + 16, true));
    if (type === 1) coreChunk = core.subarray(off, off + len); if (type === 2) cpuChunk = core.subarray(off, off + len); }
  assert(coreChunk?.byteLength >= 24 && cpuChunk?.byteLength >= 16724, "snapshot core chunks");
  const c0 = new DataView(coreChunk.buffer, coreChunk.byteOffset, coreChunk.byteLength), cpu = new DataView(cpuChunk.buffer, cpuChunk.byteOffset, cpuChunk.byteLength);
  assert(c0.getBigUint64(16, true) === structure.clockSlotsCompleted, "core clock binding");
  const contAt = 48 + coreLength, cont = b.subarray(contAt, contAt + 72), m9 = new DataView(cont.buffer, cont.byteOffset, 72);
  assert(magic(cont, 0, "CDRM9D1") && cont[7] === 0 && m9.getUint32(8, true) === 1 && m9.getUint32(12, true) === 72 &&
    m9.getBigUint64(48, true) > 0n && m9.getUint32(64, true) === Number(m9.getBigUint64(56, true) & 0xffffffffn) &&
    m9.getUint16(68, true) < 768 && (m9.getUint16(70, true) & 0x8000) === 0 && (m9.getUint16(70, true) & 0x0fff) < 963,
  "continuation sidecar");
  const generation = m9.getBigUint64(48, true), audioAt = contAt + 72;
  const audio = await validateAudio(b.subarray(audioAt, audioAt + audioLength), digest); assert(audio.generation === generation, "audio generation binding");
  validateConfig(b.subarray(audioAt + audioLength), generation);
  const computed = await sha(b, digest); if (expectedSha256 !== null) assert(same(computed, unhex(expectedSha256)), "whole snapshot digest mismatch");
  return Object.freeze({ bytes: b, snapshotSha256: computed, coreSha256: await sha(core, digest),
    coreProfileSha256: profile, profileSha256: DEBUGGER_PROFILE_SHA256.slice(),
    clockSlot: structure.clockSlotsCompleted, boundaryOrdinal: structure.clockSlotsCompleted,
    microPcAfter: cpu.getUint32(52, true), rawLcAfter: cpu.getUint32(16720, true), generation });
}

export class CadrM12ProductionDebugger {
  #request; #openSnapshotTransaction; #snapshot = null; #audio; #m10Authority; #lease = null;
  #digest; #exportBundle; #state = "PAUSED"; #stop = null; #stopStatus = null; #review = null;
  #token = null; #tail = Promise.resolve(); #zeroization = null; #publication = null;
  #cancellation = null; #stagedExport = null; #staging = null; #publicationTimeoutMs;
  #invalidationEpoch = 0; #cleanup = null; #disposed = false; #cleanupAdmissionSerial = 0;
  constructor({ request, openSnapshotTransaction, receipt, audio, m10Authority, digest = null,
    exportBundle = null, publicationTimeoutMs = 10000 } = {}) {
    assert(typeof request === "function" && typeof openSnapshotTransaction === "function",
      "request/snapshot boundaries required");
    assert(audio && ["joinTail", "pause", "reducePause"].every(k => typeof audio[k] === "function"),
      "audio boundary required");
    assert(m10Authority && ["acquire", "revoke"].every(k => typeof m10Authority[k] === "function"),
      "restricted M10 review authority required");
    assert(exportBundle === null || typeof exportBundle === "function", "bundle exporter invalid");
    validateCadrM12ProductionDebuggerReceipt(receipt);
    assert(Number.isSafeInteger(publicationTimeoutMs) && publicationTimeoutMs >= 1 && publicationTimeoutMs <= 60000,
      "bundle publication timeout invalid");
    this.#request = request; this.#openSnapshotTransaction = openSnapshotTransaction; this.#audio = audio;
    this.#m10Authority = m10Authority; this.#digest = digest; this.#exportBundle = exportBundle;
    this.#publicationTimeoutMs = publicationTimeoutMs;
  }
  get state() { return this.#state; } get directStop() { return this.#stop?.bytes.slice().buffer ?? null; } get review() { return this.#view(); }
  get cleanupDisposition() { return this.#cleanup?.disposition ?? null; }
  get zeroizationReceipt() { return this.#zeroization === null ? null : Object.freeze({ ...this.#zeroization }); }
  request(op, fields = {}) { return this.#serialize(async () => {
    assert(PUBLIC.has(op), "operation is not public debugger control"); assert(this.#state !== "FAILED" && this.#state !== "RELEASE_REQUIRED", "debugger unavailable");
    if (["REVIEW_READY", "EXPORT_PREPARED"].includes(this.#state) && MUTATING.has(op)) assert(false, "review freezes mutating controls");
    const prior = this.#state; if (["debug-micro-step", "debug-macro-step"].includes(op)) this.#state = "STEPPING";
    let reply;
    try { reply = await this.#request(op, fields);
    if ([19, 20].includes(reply?.status)) { assert(reply.terminal === false, "transient stop was terminalized"); const stop = parseCdrDbgStop1(reply.result?.stop);
      assert(stop.reason === (reply.status === 19 ? 1 : 2), "stop status/reason mismatch"); this.#stop = stop; this.#stopStatus = reply.status; this.#state = "STOP_BOUND";
    } else if (reply?.status === 0 && this.#state === "STEPPING") this.#state = "PAUSED";
    else if (reply?.status !== 0) this.#state = reply?.terminal === true || [24, 25].includes(reply?.status) ? "FAILED" : prior;
    return reply; } catch (error) { this.#state = "FAILED"; throw error; }
  }); }
  prepareReview() { return this.#serialize(async () => {
    assert(this.#state === "STOP_BOUND" && this.#snapshot === null && this.#lease === null,
      "review requires STOP_BOUND");
    const owner = this.#openSnapshot(); this.#snapshot = owner; this.#state = "REVIEW_PREPARING";
    const epoch = this.#invalidationEpoch;
    try {
      const mp = exact(await this.#awaitPreparation(epoch, owner, this.#request("machine-pause", {}), "machine pause"), "machine pause", ["type", "version", "sessionId", "id", "op", "status", "ok", "terminal", "lifecycle"]);
      assert(mp.status === 0 && mp.ok === true && mp.terminal === false && mp.lifecycle === "PAUSED", "machine pause failed");
      const aj = exact(await this.#awaitPreparation(epoch, owner, this.#audio.joinTail(), "audio join"), "audio join", ["joined"]); assert(aj.joined === true, "audio tail did not join");
      const ap = exact(await this.#awaitPreparation(epoch, owner, this.#audio.pause(), "audio pause"), "audio pause", ["status", "paused"]); assert(ap.status === 0 && ap.paused === true, "audio pause failed");
      const ar = exact(await this.#awaitPreparation(epoch, owner, this.#audio.reducePause(), "audio reduction"), "audio reduction", ["committed", "state"]); assert(ar.committed === true && ar.state === "PAUSED", "audio reduction failed");
      const lease = await this.#awaitPreparation(epoch, owner, this.#m10Authority.acquire(), "M10 review lease");
      assert(lease && typeof lease.release === "function" && plain(lease.binding), "M10 review lease invalid");
      this.#lease = lease;
      const save = await this.#awaitPreparation(epoch, owner, owner.save(), "snapshot save"); exact(save, "snapshot save", ["status", "remainder"]); assert(save.status === 0, "snapshot save failed");
      const meta = exact(save.remainder, "snapshot save remainder", ["lifecycle", "snapshotId", "byteCount", "snapshotSha256"]);
      assert(meta.lifecycle === "PAUSED" && Number.isSafeInteger(meta.byteCount) && meta.byteCount > 0 && meta.byteCount <= CADR_M12_P2_RAW_SNAPSHOT_BYTES, "snapshot save receipt");
      const assembled = new Uint8Array(meta.byteCount);
      /* Publish host ownership immediately after allocation.  Any later
       * stream/parser failure can therefore zero it after release or retain
       * it behind RELEASE_REQUIRED for an explicit discard retry. */
      this.#review = { snapshot: assembled, snapshotId: meta.snapshotId,
        snapshotSha256: meta.snapshotSha256, provenance: null, diagnostic: null, m10Pinned: true };
      let offset = 0;
      while (offset < assembled.byteLength) { const result = await this.#awaitPreparation(epoch, owner, owner.next(offset, Math.min(1048576, assembled.byteLength - offset)), "snapshot next");
        exact(result, "snapshot next", ["status", "remainder"]); assert(result.status === 0, "snapshot stream failed"); const r = exact(result.remainder, "snapshot next remainder", ["lifecycle", "snapshotId", "offset", "nextOffset", "done", "chunkSha256", "snapshot"]);
        const chunk = bytes(r.snapshot, "snapshot chunk", 1048576); assert(r.lifecycle === "PAUSED" && r.snapshotId === meta.snapshotId && r.offset === offset && r.nextOffset === offset + chunk.byteLength &&
          r.done === (r.nextOffset === assembled.byteLength) && same(await this.#awaitPreparation(epoch, owner, sha(chunk, this.#digest), "snapshot chunk digest"), unhex(r.chunkSha256)), "snapshot chunk binding"); assembled.set(chunk, offset); offset = r.nextOffset; }
      const parsed = await this.#awaitPreparation(epoch, owner, validateCadrM12ProductionSnapshot(assembled, meta.snapshotSha256, this.#digest), "snapshot parser"), stop = this.#stop;
      assert(stop.clockSlot === parsed.clockSlot && stop.boundaryOrdinal === parsed.boundaryOrdinal && stop.microPcAfter === parsed.microPcAfter &&
        stop.rawLcAfter === parsed.rawLcAfter && same(stop.profileSha256, parsed.profileSha256), "stop/snapshot binding");
      const provenance = serializeCdrProv1({ profileSha256: parsed.profileSha256, coreSha256: parsed.coreSha256, snapshotSha256: parsed.snapshotSha256 });
      const diagnostic = serializeCdrBug1({ terminalStatus: this.#stopStatus, stop: stop.bytes, provenance,
        summary: this.#stopStatus === 19 ? "Breakpoint stop review" : "Macro step limit review" });
      parseCdrProv1(provenance); parseCdrBug1(diagnostic);
      this.#assertPreparation(epoch, owner, "review publication");
      this.#review = { snapshot: assembled, snapshotId: meta.snapshotId, snapshotSha256: hex(parsed.snapshotSha256), provenance, diagnostic, m10Pinned: true };
      this.#state = "REVIEW_READY"; return this.#view();
    } catch (error) {
      const terminal = epoch !== this.#invalidationEpoch || this.#disposed;
      try { await this.#disposeSnapshot("prepare-failed", { terminal, after: "STOP_BOUND" }); }
      catch { /* the retained RELEASE_REQUIRED state is the recovery result */ }
      throw error;
    }
  }); }
  beginReviewExport() { return this.#serialize(async () => { assert(this.#state === "REVIEW_READY", "export requires REVIEW_READY");
    this.#token = Object.freeze({ nonce: Symbol("M12-P2-export") }); this.#state = "EXPORT_PREPARED"; return this.#token; }); }
  completeReviewExport(token) { return this.#serialize(async () => {
    assert(this.#state === "EXPORT_PREPARED" && token === this.#token, "export token stale");
    assert(this.#exportBundle, "bundle exporter unavailable");
    const epoch = this.#invalidationEpoch;
    const staged = { snapshot: this.#review.snapshot.slice(), provenance: this.#review.provenance.slice(),
      diagnostic: this.#review.diagnostic.slice() };
    this.#stagedExport = staged;
    const bundle = Object.freeze({ snapshot: staged.snapshot.buffer,
      provenance: staged.provenance.buffer, diagnostic: staged.diagnostic.buffer });
    try {
      this.#staging = this.#boundedPublication(Promise.resolve().then(() => this.#exportBundle(bundle)),
        "export staging timeout").then(value => {
          this.#publication = this.#publicationContract(value, staged); return this.#publication;
        });
      await this.#staging; this.#staging = null;
      await this.#requireCurrentPublication(epoch, "export staging");
      const prepared = exact(await this.#boundedPublication(
        Promise.resolve().then(() => this.#publication.commit()), "export commit timeout"),
      "export prepare receipt", ["prepared"]);
      assert(prepared.prepared === true, "bundle commit was not prepared");
      await this.#requireCurrentPublication(epoch, "export commit");
      /* accept() is the sole publication linearization point and MUST be
       * synchronous. No reset/loss callback can interleave between this final
       * epoch check and acceptance in the same JavaScript task. */
      const accepted = this.#publication.accept();
      assert(!(accepted instanceof Promise), "bundle accept must be synchronous");
      const out = exact(accepted, "export acceptance receipt", ["published", "receipt"]);
      assert(out.published === true && typeof out.receipt === "string" && out.receipt.length > 0,
        "bundle publication failed");
      this.#review.publication = Object.freeze({ ...out });
      this.#publication = null; this.#eraseStaged(staged); this.#stagedExport = null;
      await this.#requireCurrentPublication(epoch, "snapshot release");
      return this.#disposeSnapshot("export-complete", { after: "PAUSED" });
    } catch (error) {
      this.#eraseStaged(staged);
      const invalidated = epoch !== this.#invalidationEpoch || this.#state === "FAILED";
      const stagingUnconfirmed = this.#publication === null && this.#staging !== null;
      if (stagingUnconfirmed) {
        /* The staging call is contractually non-publishing, but without its
         * returned cancel handle the coordinator cannot confirm retention or
         * erasure. Fail-stop the capability; a late raw promise resolution is
         * detached from publication state and cannot revive this instance. */
        this.#state = "FAILED"; this.#token = null; this.#zero();
        try { await this.#disposeSnapshot("export-stage-unconfirmed", { terminal: true, after: "FAILED" }); } catch { /* fail-stop is already terminal */ }
        this.#staging = null; this.#stagedExport = null;
        throw error;
      }
      if (this.#publication !== null) {
        try { await this.#cancelPublication("export-failed"); }
        catch { this.#state = "FAILED"; this.#token = null;
          throw new TypeError("M12-P2: export cancellation was not confirmed"); }
      }
      if (!invalidated && this.#state !== "FAILED") this.#state = "REVIEW_READY";
      this.#staging = null; this.#stagedExport = null; this.#token = null;
      throw error;
    }
  }); }
  discardReview() { const admission = ++this.#cleanupAdmissionSerial; return this.#serialize(() => {
    assert(["REVIEW_READY", "EXPORT_PREPARED", "RELEASE_REQUIRED", "UNPIN_REQUIRED"].includes(this.#state), "discard unavailable");
    return this.#disposeSnapshot("discard", { after: "PAUSED", admission });
  }); }
  invalidate(reason = "invalidated") {
    assert(typeof reason === "string" && reason.length > 0, "invalidation reason");
    this.#disposed = true; this.#invalidationEpoch += 1;
    const admission = ++this.#cleanupAdmissionSerial;
    return this.#serialize(() => this.#disposeSnapshot(reason, { terminal: true, after: "FAILED", admission }));
  }
  #publicationContract(value, staged) {
    assert(value !== null && typeof value === "object" && !Array.isArray(value), "bundle staging contract invalid");
    const keys = Reflect.ownKeys(value);
    assert(keys.length === 3 && ["commit", "accept", "cancel"].every(key => keys.includes(key)) &&
      keys.every(key => typeof key === "string"), "bundle staging contract fields");
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      assert(descriptor && Object.hasOwn(descriptor, "value") && typeof descriptor.value === "function" &&
        descriptor.get === undefined && descriptor.set === undefined, `bundle staging ${key}`);
    }
    return Object.freeze({ commit: value.commit.bind(value), accept: value.accept.bind(value),
      cancel: value.cancel.bind(value), staged });
  }
  #eraseStaged(staged) {
    staged?.snapshot?.fill(0); staged?.provenance?.fill(0); staged?.diagnostic?.fill(0);
    assert([staged?.snapshot, staged?.provenance, staged?.diagnostic].every(value =>
      value === undefined || value.every(byte => byte === 0)), "staged export zeroization failed");
  }
  async #cancelPublication(reason) {
    if (this.#publication === null) return;
    if (this.#cancellation === null) {
      const publication = this.#publication;
      this.#eraseStaged(publication.staged);
      this.#cancellation = this.#boundedPublication(Promise.resolve().then(() => publication.cancel(reason)),
        "export cancellation timeout").then(value => {
        const result = exact(value, "export cancellation receipt", ["cancelled", "published", "erased"]);
        assert(result.cancelled === true && result.published === false && result.erased === true,
          "export cancellation was not confirmed");
        this.#publication = null;
      });
    }
    try { await this.#cancellation; } finally { this.#cancellation = null; }
  }
  #openSnapshot() {
    const snapshot = this.#openSnapshotTransaction();
    assert(snapshot && ["save", "next", "dispose", "onInvalidating", "onDisposition"].every(k => typeof snapshot[k] === "function"),
      "fresh snapshot transaction unavailable");
    snapshot.onInvalidating(event => this.#onSnapshotInvalidating(snapshot, event));
    snapshot.onDisposition(event => this.#onSnapshotDisposition(snapshot, event));
    return snapshot;
  }
  #cleanupRecord(reason, { terminal = false, after = "PAUSED" } = {}) {
    if (this.#cleanup !== null) {
      if (terminal) this.#cleanup.terminal = true;
      return this.#cleanup;
    }
    const record = { reason, terminal, after, snapshot: this.#snapshot, prepared: null,
      finished: null, disposition: null, disposeStarted: false,
      releaseFailure: null, releaseFailureEpoch: 0 };
    record.prepared = (async () => {
      this.#token = null; this.#invalidationEpoch += 1;
      this.#eraseStaged(this.#stagedExport); this.#stagedExport = null;
      if (this.#staging !== null) {
        /* A bounded staging failure is already fail-stop, but it must not
         * prevent the single cleanup path from disposing worker bytes and the
         * durable lease.  The rejected wrapper cannot later publish when the
         * hostile underlying staging promise eventually settles. */
        try { await this.#staging; } catch { /* cancellation/zeroization continues */ }
        finally { this.#staging = null; }
      }
      try { await this.#cancelPublication(reason); }
      finally { this.#zero(); }
    })();
    this.#cleanup = record;
    return record;
  }
  async #disposeSnapshot(reason, options = {}) {
    const admission = options.admission ?? ++this.#cleanupAdmissionSerial;
    const record = this.#cleanupRecord(reason, options);
    await record.prepared;
    if (record.releaseFailure !== null) {
      if (admission <= record.releaseFailureEpoch) {
        throw record.releaseFailure;
      }
      record.releaseFailure = null;
    }
    if (record.finished !== null) return record.finished;
    if (record.snapshot === null) return this.#finishCleanup(record, "ABSENT");
    if (!record.disposeStarted) {
      record.disposeStarted = true;
      try { await record.snapshot.dispose(reason); }
      catch (error) {
        /* A disposition callback can itself fail because durable unpin failed.
         * That is not uncertainty about the already released worker snapshot. */
        if (record.finished === null && record.disposition === null) {
          await this.#finishCleanup(record, "UNKNOWN");
        }
        throw error;
      }
    }
    if (record.releaseFailure !== null) {
      if (admission <= record.releaseFailureEpoch) throw record.releaseFailure;
      record.releaseFailure = null;
    }
    if (record.finished === null) return this.#finishCleanup(record, record.disposition ?? "UNKNOWN");
    return record.finished;
  }
  #onSnapshotInvalidating(snapshot, event) {
    if (snapshot !== this.#snapshot && snapshot !== this.#cleanup?.snapshot) return Promise.resolve();
    /* A locally initiated dispose has already chosen its nonterminal outcome.
     * The transaction still announces its pre-disposal edge, but that edge must
     * not turn an ordinary explicit discard into a worker-loss failure. */
    if (this.#cleanup?.snapshot === snapshot && this.#cleanup.disposeStarted) {
      return this.#cleanup.prepared;
    }
    this.#disposed = this.#disposed || event?.reason === "worker-lost";
    const record = this.#cleanupRecord(event?.reason ?? "snapshot-invalidated", { terminal: true, after: "FAILED" });
    return record.prepared;
  }
  #onSnapshotDisposition(snapshot, event) {
    if (snapshot !== this.#snapshot && snapshot !== this.#cleanup?.snapshot) return Promise.resolve();
    const disposition = event?.disposition;
    assert(["ABSENT", "RELEASED", "WORKER_TERMINATED", "UNKNOWN"].includes(disposition),
      "snapshot disposal disposition invalid");
    const record = this.#cleanupRecord(event?.reason ?? "snapshot-disposed", {
      terminal: disposition === "WORKER_TERMINATED", after: "FAILED",
    });
    return record.prepared.then(() => this.#finishCleanup(record, disposition));
  }
  #finishCleanup(record, disposition) {
    if (record.finished !== null) {
      if (record.disposition === "UNKNOWN" && disposition === "WORKER_TERMINATED") {
        void record.finished.catch(() => {});
        record.finished = null;
        record.terminal = true;
      } else {
        return record.finished;
      }
    }
    record.disposition = disposition;
    record.finished = (async () => {
      if (this.#snapshot === record.snapshot) this.#snapshot = null;
      if (disposition === "UNKNOWN") {
        this.#state = "RELEASE_REQUIRED";
        throw new TypeError("M12-P2: snapshot disposal is unknown; M10 lease retained");
      }
      if (this.#lease !== null) {
        const lease = this.#lease;
        try {
          const receipt = await lease.release();
          assert(receipt && receipt.released === true, "M10 lease release failed");
          this.#lease = null;
        } catch (error) {
          this.#state = "RELEASE_REQUIRED";
          /* The worker disposition is already final.  A later explicit
           * discard may retry only this durable unpin flight; it cannot ask
           * the worker to release the snapshot a second time. */
          record.finished = null;
          record.releaseFailure = error;
          record.releaseFailureEpoch = this.#cleanupAdmissionSerial;
          throw error;
        }
      }
      this.#zero(); this.#stop = null; this.#stopStatus = null;
      this.#cleanup = null;
      this.#state = record.terminal || this.#disposed ? "FAILED" : record.after;
      return this.#state;
    })();
    return record.finished;
  }
  async #requireCurrentPublication(epoch, label) {
    if (epoch === this.#invalidationEpoch && this.#state !== "FAILED") return;
    await this.#cancelPublication(label);
    throw new TypeError(`M12-P2: ${label} crossed invalidation`);
  }
  #assertPreparation(epoch, owner, label) {
    assert(epoch === this.#invalidationEpoch && owner === this.#snapshot && this.#state === "REVIEW_PREPARING",
      `${label} crossed invalidation`);
  }
  async #awaitPreparation(epoch, owner, value, label) {
    const result = await value; this.#assertPreparation(epoch, owner, label); return result;
  }
  async #boundedPublication(value, label) {
    let timer;
    try {
      return await Promise.race([value, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TypeError(`M12-P2: ${label}`)), this.#publicationTimeoutMs);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  #zero() { const snapshot = this.#review?.snapshot ?? null, provenance = this.#review?.provenance ?? null,
      diagnostic = this.#review?.diagnostic ?? null;
    if (snapshot === null && provenance === null && diagnostic === null && this.#zeroization !== null) {
      this.#review = null; this.#token = null; return;
    }
    snapshot?.fill(0); provenance?.fill?.(0); diagnostic?.fill?.(0);
    const zero = value => value === null || value.every(byte => byte === 0);
    assert(zero(snapshot) && zero(provenance) && zero(diagnostic), "host review zeroization failed");
    this.#zeroization = Object.freeze({ snapshotBytes: snapshot?.byteLength ?? 0,
      provenanceBytes: provenance?.byteLength ?? 0, diagnosticBytes: diagnostic?.byteLength ?? 0,
      verifiedZero: true });
    this.#review = null; this.#token = null; }
  #view() { if (!this.#review) return null; return Object.freeze({ profile: CADR_M12_PRODUCTION_DEBUGGER_PROFILE, stop: this.#stop.bytes.slice().buffer,
    snapshotSha256: this.#review.snapshotSha256, snapshotByteCount: this.#review.snapshot.byteLength,
    provenance: this.#review.provenance?.slice().buffer ?? null,
    diagnostic: this.#review.diagnostic?.slice().buffer ?? null, m10Pinned: true }); }
  #serialize(fn) { const run = this.#tail.then(fn); this.#tail = run.catch(() => {}); return run; }
}
