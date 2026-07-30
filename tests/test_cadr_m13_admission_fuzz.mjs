/* Deterministic source-admission corpus for the M13 v8 boundary.  This is a
 * bounded parser campaign, not a browser-network, storage, or sanitizer
 * result.  Every accepted candidate also passes the independent post-clone
 * predicate and has its bounded M13META1 record encoded. */
import assert from "node:assert/strict";

import {
  CADR_M13_PROTOCOL_VERSION,
  canonicalizeCadrM13Request,
  encodeCadrM13Meta1,
  validateCadrM13PostCloneRequest,
} from "../cadr-web/browser/cadr-m13-shell.mjs";

const sessionId = "7a".repeat(32);
let state = 0x6d313346;
function next() {
  state ^= state << 13; state >>>= 0;
  state ^= state >>> 17; state >>>= 0;
  state ^= state << 5; state >>>= 0;
  return state >>> 0;
}
function letters(length) {
  let output = "";
  for (let index = 0; index < length; index += 1) output += String.fromCharCode(0x41 + (next() % 26));
  return output;
}
function candidate(index) {
  const op = ["keyboard-down", "keyboard-up", "keyboard-state", "debug-inspect-read",
    "debug-breakpoint-set", "machine-run", "not-an-operation"][next() % 7];
  const request = {
    type: next() % 13 === 0 ? "wrong" : "cadr-request",
    version: next() % 11 === 0 ? 7 : CADR_M13_PROTOCOL_VERSION,
    sessionId: next() % 17 === 0 ? "ff".repeat(32) : sessionId,
    id: next() % 19 === 0 ? 0 : index + 1,
    op,
  };
  if (op === "keyboard-down") {
    request.code = next() % 23 === 0 ? "\ud800" : letters(next() % 81);
    if (next() & 1) request.repeat = (next() & 1) !== 0;
  } else if (op === "keyboard-up") request.code = letters(next() % 81);
  else if (op === "debug-inspect-read") {
    request.arrayKind = next() % 8; request.index = next();
  } else if (op === "debug-breakpoint-set") {
    request.slot = next() % 80;
    request.breakpoint = { kind: next() % 8, value: BigInt(next()) };
  } else if (op === "machine-run") request.clockSlots = next() % 2 === 0 ? 0 : next();
  if (next() % 7 === 0) request.extra = next();
  return request;
}

let accepted = 0;
let rejected = 0;
for (let index = 0; index < 4096; index += 1) {
  const request = candidate(index);
  try {
    const canonical = await canonicalizeCadrM13Request(request, { sessionId });
    assert.equal(validateCadrM13PostCloneRequest(canonical.request), true);
    const bytes = await encodeCadrM13Meta1(canonical.request);
    assert.ok(bytes.byteLength >= 8 && bytes.byteLength <= 65536);
    accepted += 1;
  } catch {
    rejected += 1;
  }
}
assert.ok(accepted > 0 && rejected > 0, "corpus must exercise both admission outcomes");
console.log(`cadr M13 admission fuzz passed (seed=0x6d313346 iterations=4096 accepted=${accepted} rejected=${rejected})`);
