import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bytes = execFileSync(resolve(root, "cadr-web/build/cadr_m6_tail_fixture"));
const summaryBytes = 512;
const recordBytes = 384;
assert.equal(bytes.byteLength, summaryBytes + recordBytes * 2,
  "fixture is exactly one summary and canonical records 512 and 513");
const summary = bytes.subarray(0, summaryBytes);
const record512 = bytes.subarray(summaryBytes, summaryBytes + recordBytes);
const record513 = bytes.subarray(summaryBytes + recordBytes);
const view = new DataView(summary.buffer, summary.byteOffset, summary.byteLength);
const le64 = value => {
  const result = Buffer.alloc(8);
  result.writeBigUInt64LE(value);
  return result;
};
const sha256 = (...parts) => {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
};
const domain = Buffer.from("CDRM6TAIL1\0", "ascii");
const policy = Buffer.from("M6-PREFIX512-TAILSHA256-v1\0", "ascii");
const h0 = sha256(domain, policy, le64(512n));
const h1 = sha256(domain, h0, record512);
const h2 = sha256(domain, h1, record513);

assert.equal(summary.subarray(0, 7).toString("ascii"), "CDRM6E1");
assert.equal(view.getBigUint64(40, true), 514n);
assert.equal(view.getBigUint64(48, true), 2n);
assert.equal(view.getBigUint64(56, true), 512n);
assert.equal(view.getUint32(20, true) & 1, 1,
  "tail-started flag is asserted after event 512");
assert.deepEqual(summary.subarray(272, 304), h2,
  "Node crypto independently reproduces the C tail through events 512 and 513");
assert.notDeepEqual(h0, h1);
assert.notDeepEqual(h1, h2);

console.log("cadr_m6_tail_chain: ok");
