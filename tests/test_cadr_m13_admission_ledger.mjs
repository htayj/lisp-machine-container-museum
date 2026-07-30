/* Deterministic F05a admission-cell campaign.  The ledger counts declared,
 * bounded cells only; it neither allocates 16 MiB arrays nor claims to be a
 * destructive browser OOM test. */
import assert from "node:assert/strict";

import { CADR_M13_MAX_BODY_BYTES, CADR_M13_MAX_METADATA_BYTES,
  CADR_M13_MAX_METADATA_TOTAL, CADR_M13_MAX_SNAPSHOT_BYTES,
  CADR_M13_MAX_STREAM_WINDOW_BYTES, CADR_M13_MAX_STREAM_WINDOWS,
  CADR_M13_PROTOCOL_VERSION, CADR_M13_STATUS, CadrM13AdmissionLedger,
  canonicalizeCadrM13Request } from "../cadr-web/browser/cadr-m13-shell.mjs";

function expectsStatus(callback, status) {
  assert.throws(callback, error => error?.status === status);
}

/* One byte below, at, and above the declared non-stream and stream limits. */
for (const [streaming, maximum] of [[false, CADR_M13_MAX_BODY_BYTES],
  [true, CADR_M13_MAX_STREAM_WINDOW_BYTES]]) {
  for (const size of [maximum - 1, maximum, maximum + 1]) {
    const ledger = new CadrM13AdmissionLedger();
    if (size <= maximum) {
      ledger.reserve(1, { metadataBytes: 0, bodyBytes: size, streaming });
      assert.equal(ledger.snapshot().bodyLive, true);
    } else expectsStatus(() => ledger.reserve(1, { metadataBytes: 0, bodyBytes: size, streaming }), CADR_M13_STATUS.RESOURCE_LIMIT);
  }
}

/* The mutually exclusive body arms allow exactly one 16 MiB body or two one-MiB
 * streaming windows.  A failed reservation never wedges subsequent admission. */
{
  const ledger = new CadrM13AdmissionLedger();
  ledger.reserve(1, { metadataBytes: 0, bodyBytes: CADR_M13_MAX_BODY_BYTES, streaming: false });
  expectsStatus(() => ledger.reserve(2, { metadataBytes: 0, bodyBytes: 1, streaming: false }), CADR_M13_STATUS.RESOURCE_LIMIT);
  expectsStatus(() => ledger.reserve(2, { metadataBytes: 0, bodyBytes: 1, streaming: true }), CADR_M13_STATUS.RESOURCE_LIMIT);
  ledger.release(1);
  ledger.reserve(2, { metadataBytes: 0, bodyBytes: CADR_M13_MAX_STREAM_WINDOW_BYTES, streaming: true });
  ledger.reserve(3, { metadataBytes: 0, bodyBytes: CADR_M13_MAX_STREAM_WINDOW_BYTES, streaming: true });
  assert.equal(ledger.snapshot().streamWindows, CADR_M13_MAX_STREAM_WINDOWS);
  expectsStatus(() => ledger.reserve(4, { metadataBytes: 0, bodyBytes: 1, streaming: true }), CADR_M13_STATUS.RESOURCE_LIMIT);
  expectsStatus(() => ledger.reserve(4, { metadataBytes: 0, bodyBytes: 1, streaming: false }), CADR_M13_STATUS.RESOURCE_LIMIT);
  ledger.release(2); ledger.release(3);
  assert.deepEqual(ledger.snapshot(), { pending: 0, metadataBytes: 0, bodyLive: false, regularBodyLive: false, streamWindows: 0 });
}

/* Individual and aggregate metadata cells reach exactly 64 * 64 KiB = 4 MiB;
 * one more record must fail on pending capacity before any metadata mutates. */
{
  const ledger = new CadrM13AdmissionLedger();
  expectsStatus(() => ledger.reserve(1, { metadataBytes: CADR_M13_MAX_METADATA_BYTES + 1 }), CADR_M13_STATUS.RESOURCE_LIMIT);
  for (let id = 1; id <= 64; id += 1) ledger.reserve(id, { metadataBytes: CADR_M13_MAX_METADATA_BYTES });
  assert.equal(ledger.snapshot().metadataBytes, CADR_M13_MAX_METADATA_TOTAL);
  expectsStatus(() => ledger.reserve(65, { metadataBytes: 0 }), CADR_M13_STATUS.RESOURCE_LIMIT);
  ledger.release(1); ledger.reserve(65, { metadataBytes: CADR_M13_MAX_METADATA_BYTES });
  assert.equal(ledger.snapshot().metadataBytes, CADR_M13_MAX_METADATA_TOTAL);
}

/* Each injected allocation point reports NO_MEMORY atomically.  The next request
 * still succeeds once the deterministic injector stops failing. */
for (const point of ["metadata", "body", "stream-window"]) {
  let failed = false;
  const ledger = new CadrM13AdmissionLedger({ allocation: value => {
    if (!failed && value.point === point) { failed = true; return false; }
    return true;
  } });
  expectsStatus(() => ledger.reserve(1, { metadataBytes: 4, bodyBytes: 8, streaming: point === "stream-window" }), CADR_M13_STATUS.NO_MEMORY);
  assert.deepEqual(ledger.snapshot(), { pending: 0, metadataBytes: 0, bodyLive: false, regularBodyLive: false, streamWindows: 0 });
  ledger.reserve(1, { metadataBytes: 4, bodyBytes: 8, streaming: point === "stream-window" });
  assert.equal(ledger.snapshot().pending, 1);
}

/* Snapshot total is a stream-total rule, not a live-body allocation. */
const sessionId = "8c".repeat(32);
for (const byteCount of [17078204, CADR_M13_MAX_SNAPSHOT_BYTES, CADR_M13_MAX_SNAPSHOT_BYTES + 1]) {
  const request = { type: "cadr-request", version: CADR_M13_PROTOCOL_VERSION, sessionId, id: 1,
    op: "snapshot-restore-begin", byteCount, snapshotSha256: "00".repeat(32) };
  if (byteCount <= CADR_M13_MAX_SNAPSHOT_BYTES) {
    const canonical = await canonicalizeCadrM13Request(request, { sessionId });
    assert.equal(canonical.request.byteCount, byteCount);
  } else await assert.rejects(canonicalizeCadrM13Request(request, { sessionId }));
}

console.log("cadr M13 deterministic admission ledger tests passed");
