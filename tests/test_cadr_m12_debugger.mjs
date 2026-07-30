import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CADR_M12_BUG_HEADER_BYTES,
  CADR_M12_BUG_MAX_BYTES,
  CADR_M12_DEBUGGER_PROFILE,
  CADR_M12_MACRO_SLOT_LIMIT,
  CADR_M12_PROTOCOL_VERSION,
  CADR_M12_STATUS_DEBUG_STOP,
  CADR_M12_STATUS_INVALID_ARGUMENT,
  CADR_M12_STATUS_LIMIT_REACHED,
  CADR_M12_STATUS_OK,
  CADR_M12_STOP_BYTES,
  CADR_M12_TRACE_FILTER_CLOCK_RANGE,
  CADR_M12_TRACE_FILTER_FAULT,
  CADR_M12_TRACE_FILTER_MICRO_PC,
  CadrM12FormatError,
  CadrM12ProtocolSubhandler,
  parseCdrBug1,
  parseCdrDbgStop1,
  parseCdrProv1,
  serializeCdrBug1,
  serializeCdrDbgStop1,
  serializeCdrProv1,
  validateCadrM12TraceFilter,
} from "../cadr-web/wasm/cadr-m12-debugger.mjs";

function hash(seed) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed + index) & 0xff);
}

function stopRecord(reason = 1, breakpointIndex = 3) {
  return {
    reason, breakpointIndex,
    generation: 9n, boundaryOrdinal: 12n, clockSlot: 34n,
    microPcBefore: 0x123, rawLcBefore: 0x456,
    microPcAfter: 0x124, rawLcAfter: 0x457,
    faultAfter: 1, deviceRequestAfter: 0, inhibitedAfter: 1,
    runOrdinal: 15n,
    operationSlots: reason === 2 ? CADR_M12_MACRO_SLOT_LIMIT : 3n,
    profileSha256: hash(1),
  };
}

function testProfileAndCanonicalStop() {
  assert.equal(CADR_M12_DEBUGGER_PROFILE,
    "CADR-WEB-303/ABI1.7/protocol-v7/C-M12-DBG-v1");
  assert.equal(CADR_M12_PROTOCOL_VERSION, 7);
  assert.equal(CADR_M12_STATUS_DEBUG_STOP, 19);
  assert.equal(CADR_M12_STATUS_LIMIT_REACHED, 20);
  const bytes = serializeCdrDbgStop1(stopRecord());
  assert.equal(bytes.byteLength, CADR_M12_STOP_BYTES);
  assert.deepEqual([...bytes.subarray(0, 12)], [...new TextEncoder().encode("CDRDBGSTOP1\0")]);
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 136);
  assert.equal(view.getUint32(24, true), 1);
  assert.equal(view.getUint32(28, true), 3);
  assert.equal(view.getBigUint64(48, true), 34n);
  const parsed = parseCdrDbgStop1(bytes);
  assert.equal(parsed.microPcBefore, 0x123);
  assert.equal(parsed.inhibitedAfter, 1);
  assert.deepEqual(serializeCdrDbgStop1(parsed), bytes);

  const corrupt = bytes.slice(); corrupt[84] = 1;
  assert.throws(() => parseCdrDbgStop1(corrupt), CadrM12FormatError);
  assert.throws(() => serializeCdrDbgStop1({ ...stopRecord(), breakpointIndex: 64 }), CadrM12FormatError);
  assert.throws(() => serializeCdrDbgStop1({ ...stopRecord(2, 3) }), CadrM12FormatError);
  const limit = serializeCdrDbgStop1(stopRecord(2, 0xffffffff));
  assert.equal(parseCdrDbgStop1(limit).reason, 2);
}

function testProvenanceAndPrivacyBoundedBugRecord() {
  const stop = serializeCdrDbgStop1(stopRecord());
  const macroStop = serializeCdrDbgStop1(stopRecord(2, 0xffffffff));
  const provenance = serializeCdrProv1({ profileSha256: hash(1),
    coreSha256: hash(40), snapshotSha256: hash(80) });
  const mismatchedProvenance = serializeCdrProv1({ profileSha256: hash(2),
    coreSha256: hash(40), snapshotSha256: hash(80) });
  assert.equal(provenance.byteLength, 128);
  assert.deepEqual([...provenance.subarray(0, 8)], [...new TextEncoder().encode("CDRPROV1")]);
  assert.deepEqual(parseCdrProv1(provenance).snapshotSha256, hash(80));
  const bug = serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance,
    summary: "bounded debugger stop with source digest" });
  assert.equal(bug.byteLength, CADR_M12_BUG_HEADER_BYTES + "bounded debugger stop with source digest".length);
  assert.ok(bug.byteLength <= CADR_M12_BUG_MAX_BYTES);
  const parsed = parseCdrBug1(bug);
  assert.equal(parsed.terminalStatus, CADR_M12_STATUS_DEBUG_STOP);
  assert.equal(parsed.summary, "bounded debugger stop with source digest");
  assert.equal(parsed.stop.clockSlot, 34n);
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance,
    summary: "../private" }), CadrM12FormatError);
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance,
    summary: "C:private" }), CadrM12FormatError);
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP, stop, provenance,
    summary: "x".repeat(CADR_M12_BUG_MAX_BYTES) }), CadrM12FormatError);
  const maxSummary = "x".repeat(CADR_M12_BUG_MAX_BYTES - CADR_M12_BUG_HEADER_BYTES);
  const maxBug = serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP,
    stop, provenance, summary: maxSummary });
  assert.equal(maxBug.byteLength, CADR_M12_BUG_MAX_BYTES);
  assert.equal(parseCdrBug1(maxBug).summary.length, maxSummary.length);

  /* Oversize is rejected before embedded-record getters or byte cloning. */
  let embeddedRead = false;
  const oversized = {
    terminalStatus: CADR_M12_STATUS_DEBUG_STOP,
    summary: "x".repeat(CADR_M12_BUG_MAX_BYTES),
    get stop() { embeddedRead = true; throw new Error("must not read stop"); },
    get provenance() { embeddedRead = true; throw new Error("must not read provenance"); },
  };
  assert.throws(() => serializeCdrBug1(oversized), CadrM12FormatError);
  assert.equal(embeddedRead, false);
  const originalSlice = Uint8Array.prototype.slice;
  let slices = 0;
  Uint8Array.prototype.slice = function (...args) {
    slices += 1;
    return originalSlice.apply(this, args);
  };
  try {
    assert.throws(() => parseCdrBug1(
      new Uint8Array(CADR_M12_BUG_MAX_BYTES + 1)), CadrM12FormatError);
    assert.equal(slices, 0, "oversize parser input is rejected before clone");
  } finally {
    Uint8Array.prototype.slice = originalSlice;
  }

  /* BUG-X01/X02/X03 are the same cross-record vectors as the C suite. */
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP,
    stop: macroStop, provenance, summary: "wrong status reason" }), CadrM12FormatError);
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_LIMIT_REACHED,
    stop, provenance, summary: "wrong status reason" }), CadrM12FormatError);
  assert.throws(() => serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_DEBUG_STOP,
    stop, provenance: mismatchedProvenance, summary: "profile mismatch" }), CadrM12FormatError);
  assert.throws(() => serializeCdrDbgStop1({
    ...stopRecord(2, 0xffffffff),
    operationSlots: CADR_M12_MACRO_SLOT_LIMIT - 1n,
  }), CadrM12FormatError);
  const limitBug = serializeCdrBug1({ terminalStatus: CADR_M12_STATUS_LIMIT_REACHED,
    stop: macroStop, provenance, summary: "exact macro limit" });
  assert.equal(parseCdrBug1(limitBug).stop.operationSlots,
    CADR_M12_MACRO_SLOT_LIMIT);
  const wrongStatus = limitBug.slice();
  new DataView(wrongStatus.buffer).setUint32(24, CADR_M12_STATUS_DEBUG_STOP, true);
  assert.throws(() => parseCdrBug1(wrongStatus), CadrM12FormatError);

  const corrupt = bug.slice(); new DataView(corrupt.buffer).setBigUint64(32, 1n, true);
  assert.throws(() => parseCdrBug1(corrupt), CadrM12FormatError);
}

function testPureTraceFilterValidation() {
  const filter = validateCadrM12TraceFilter({ flags: CADR_M12_TRACE_FILTER_MICRO_PC |
    CADR_M12_TRACE_FILTER_CLOCK_RANGE | CADR_M12_TRACE_FILTER_FAULT,
  microPc: 0x123, firstClockSlot: 1n, lastClockSlot: 9n });
  assert.equal(filter.microPc, 0x123);
  assert.throws(() => validateCadrM12TraceFilter({ flags: CADR_M12_TRACE_FILTER_CLOCK_RANGE,
    firstClockSlot: 9n, lastClockSlot: 1n }), CadrM12FormatError);
  assert.throws(() => validateCadrM12TraceFilter({ flags: 16 }), CadrM12FormatError);
}

function testProtocolBranch() {
  const invoked = [];
  const breakpointStop = serializeCdrDbgStop1(stopRecord());
  const macroStop = serializeCdrDbgStop1(stopRecord(2, 0xffffffff));
  const handler = new CadrM12ProtocolSubhandler({
    invoke(operation) {
      invoked.push(operation);
      if (operation.op === "debug-micro-step") {
        return { status: CADR_M12_STATUS_DEBUG_STOP,
          result: { stop: breakpointStop } };
      }
      if (operation.op === "debug-macro-step") {
        return { status: CADR_M12_STATUS_LIMIT_REACHED,
          result: { stop: macroStop } };
      }
      if (operation.op === "debug-stop-record") {
        return { status: CADR_M12_STATUS_OK,
          result: { stop: breakpointStop } };
      }
      return { status: CADR_M12_STATUS_OK };
    },
  });
  const set = handler.handle({ version: 7, id: 1, op: "debug-breakpoint-set", slot: 3,
    breakpoint: { kind: 3, value: 12n } });
  assert.equal(set.status, CADR_M12_STATUS_OK);
  assert.equal(set.ok, true);
  assert.deepEqual(set.result, { slot: 3, breakpoint: { kind: 3, value: 12n } });
  assert.equal(invoked[0].breakpoint.value, 12n);
  const stop = handler.handle({ version: 7, id: 2, op: "debug-micro-step" });
  assert.equal(stop.status, CADR_M12_STATUS_DEBUG_STOP);
  assert.equal(stop.ok, false);
  assert.equal(stop.terminal, true);
  assert.deepEqual(stop.result.stop, breakpointStop);
  const limit = handler.handle({ version: 7, id: 7, op: "debug-macro-step" });
  assert.equal(limit.status, CADR_M12_STATUS_LIMIT_REACHED);
  assert.equal(parseCdrDbgStop1(limit.result.stop).operationSlots,
    CADR_M12_MACRO_SLOT_LIMIT);
  const stopRecordResponse = handler.handle({
    version: 7, id: 8, op: "debug-stop-record",
  });
  assert.deepEqual(stopRecordResponse.result.stop, breakpointStop);
  const filter = handler.handle({ version: 7, id: 3, op: "debug-trace-filter", filter: {
    flags: CADR_M12_TRACE_FILTER_FAULT, firstClockSlot: 0n, lastClockSlot: 9n,
  } });
  assert.equal(filter.status, CADR_M12_STATUS_OK);
  assert.equal(handler.handle({ version: 7, id: 4, op: "debug-micro-step", extra: true }).status,
    CADR_M12_STATUS_INVALID_ARGUMENT);
  assert.equal(handler.handle({ version: 7, id: 5, op: "unrelated-op" }), null);
  assert.equal(handler.handle({ version: 6, id: 6, op: "debug-micro-step" }), null);

  const privateBackend = new CadrM12ProtocolSubhandler({
    invoke() {
      return { status: CADR_M12_STATUS_OK,
        result: { path: "/private/secret", bytes: new Uint8Array([1, 2, 3]) } };
    },
  });
  const closed = privateBackend.handle({
    version: 7, id: 9, op: "debug-breakpoint-clear", slot: 1,
  });
  assert.equal(closed.status, CADR_M12_STATUS_INVALID_ARGUMENT);
  assert.equal(closed.reason, "backend-response");
  assert.doesNotMatch(JSON.stringify(closed), /private|secret|bytes/);

  const extraStopBackend = new CadrM12ProtocolSubhandler({
    invoke() {
      return { status: CADR_M12_STATUS_DEBUG_STOP,
        result: { stop: breakpointStop, path: "/private" } };
    },
  });
  const rejectedExtra = extraStopBackend.handle({
    version: 7, id: 10, op: "debug-micro-step",
  });
  assert.equal(rejectedExtra.status, CADR_M12_STATUS_INVALID_ARGUMENT);
  assert.deepEqual(Object.keys(rejectedExtra).sort(),
    ["id", "ok", "op", "reason", "status", "terminal", "type", "version"].sort());

  const statusMismatchBackend = new CadrM12ProtocolSubhandler({
    invoke() {
      return { status: CADR_M12_STATUS_DEBUG_STOP,
        result: { stop: macroStop } };
    },
  });
  assert.equal(statusMismatchBackend.handle({
    version: 7, id: 11, op: "debug-micro-step",
  }).status, CADR_M12_STATUS_INVALID_ARGUMENT);

  const arbitraryStatusBackend = new CadrM12ProtocolSubhandler({
    invoke() { return { status: 21 }; },
  });
  assert.equal(arbitraryStatusBackend.handle({
    version: 7, id: 12, op: "debug-micro-step",
  }).status, CADR_M12_STATUS_INVALID_ARGUMENT);

  const stateBackend = new CadrM12ProtocolSubhandler({
    invoke() {
      return { status: CADR_M12_STATUS_OK, result: {
        generation: 4n, clockSlot: 12n, microPc: 0x123, rawLc: 0x456,
      } };
    },
  });
  assert.deepEqual(stateBackend.handle({
    version: 7, id: 13, op: "debug-micro-step",
  }).result, { generation: 4n, clockSlot: 12n, microPc: 0x123, rawLc: 0x456 });

  const extraStateBackend = new CadrM12ProtocolSubhandler({
    invoke() {
      return { status: CADR_M12_STATUS_OK, result: {
        generation: 4n, clockSlot: 12n, microPc: 0x123, rawLc: 0x456,
        path: "/private/state",
      } };
    },
  });
  const rejectedState = extraStateBackend.handle({
    version: 7, id: 14, op: "debug-micro-step",
  });
  assert.equal(rejectedState.status, CADR_M12_STATUS_INVALID_ARGUMENT);
  assert.doesNotMatch(JSON.stringify(rejectedState), /private|state/);
}

function testIsolationSurface() {
  const source = readFileSync(new URL("../cadr-web/wasm/cadr-m12-debugger.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from\s+["']\.\/cadr-worker\.js["']/);
  assert.doesNotMatch(source, /cadr_wasm_adapter/);
  assert.doesNotMatch(source, /AudioWorklet/);
}

function testNativeIncarnationDomainIsolation() {
  const header = readFileSync(new URL("../cadr-web/core/cadr_m12_debugger.h", import.meta.url), "utf8");
  const source = readFileSync(new URL("../cadr-web/core/cadr_m12_debugger.c", import.meta.url), "utf8");
  assert.match(header, /typedef struct cadr_m12_incarnation_domain/);
  assert.match(header, /cadr_m12_incarnation_domain_initialize/);
  assert.match(header, /cadr_m12_debugger_reinitialize/);
  assert.match(header, /CADR_M12_STATUS_INCARNATION_EXHAUSTED/);
  assert.match(source, /domain->next_incarnation == UINT64_MAX/);
  assert.match(source, /debugger->self_token != \(uintptr_t\)debugger/);
  assert.match(source, /debugger->lifecycle != CADR_M12_DEBUGGER_LIVE/);
  assert.doesNotMatch(source, /all_zero\(\(const uint8_t \*\)debugger/);
  assert.doesNotMatch(source, /stdatomic\.h|_Atomic|atomic_|cadr_m12_next_inspector_incarnation/);
}

testProfileAndCanonicalStop();
testProvenanceAndPrivacyBoundedBugRecord();
testPureTraceFilterValidation();
testProtocolBranch();
testIsolationSurface();
testNativeIncarnationDomainIsolation();
console.log("C-M12 debugger tests passed");
