import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  validateM7P4ExpectedClosureV2ForTest,
  runM7P4ProspectiveBControlFixtureForTest,
  writeM7P4AuthorityReadyForTest,
} from "../scripts/cadr-m7-p4-authority-root.mjs";


const canonical = value => Array.isArray(value) ?
  `[${value.map(canonical).join(",")}]` :
  value !== null && typeof value === "object" ?
    `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` :
    JSON.stringify(value);
for (const scenario of ["success", "evaluation-failure", "requisites-failure", "ready-peer-close", "root-close-failure", "repeated-close"]) {
  const result = await runM7P4ProspectiveBControlFixtureForTest(Buffer.from(canonical({ scenario })));
  assert.equal(result.production_evidence, false); assert.equal(result.capability_exposed, false);
  assert.equal(result.host_action, false); assert.equal(result.receipt_generated, false);
}
await assert.rejects(runM7P4ProspectiveBControlFixtureForTest(Buffer.from('{"scenario":"success","x":1}')));
const keys = ["artifacts", "comparison", "execution_accounting",
  "execution_budget", "m6_release_record", "native", "native_inputs",
  "patches", "portable", "prepared", "schedule", "source", "summary"];
const closure = { schema: "cadr-m7-frame-expected-closure-v2",
  bindings: Object.fromEntries(keys.map(key => [key, {}])) };
assert.deepEqual(validateM7P4ExpectedClosureV2ForTest(
  Buffer.from(canonical(closure))), closure);
for (const bytes of [Buffer.from(`${canonical(closure)}\n`),
  Buffer.from(JSON.stringify(closure)), Buffer.from(canonical({ ...closure,
    schema: "cadr-m7-frame-expected-closure-v1" })),
  Buffer.from(canonical({ ...closure, bindings: { ...closure.bindings,
    extra: {} } })),
  Buffer.from(canonical({ ...closure, bindings: Object.fromEntries(
    Object.entries(closure.bindings).filter(([key]) => key !== "summary")) })),
  Buffer.from(canonical({ ...closure, bindings: {
    ...Object.fromEntries(Object.entries(closure.bindings).filter(
      ([key]) => key !== "artifacts" && key !== "comparison")),
    "artifacts,comparison": {},
  } }))]) {
  assert.throws(() => validateM7P4ExpectedClosureV2ForTest(bytes));
}
const ready = { schema: "cadr-m7-p4-authority-ready-v1", status: "ready",
  expected_closure_sha256: "01".repeat(32) };
let served = false; const frames = [];
class SyntheticSocket extends EventEmitter {
  constructor() { super(); this.destroyed = false; this.writableEnded = false; }
  write(frame, callback) { assert.equal(served, false); frames.push(frame); callback(); }
}
const socket = new SyntheticSocket();
await writeM7P4AuthorityReadyForTest(socket, ready);
served = true;
assert.deepEqual(frames, [`${canonical(ready)}\n`]);
await assert.rejects(writeM7P4AuthorityReadyForTest(socket, ready),
  /already attempted/);
const closed = new SyntheticSocket(); closed.destroyed = true;
await assert.rejects(writeM7P4AuthorityReadyForTest(closed, ready));
const partial = new SyntheticSocket();
partial.write = (_frame, callback) => callback(new Error("partial write"));
await assert.rejects(writeM7P4AuthorityReadyForTest(partial, ready));
const raced = new SyntheticSocket();
raced.write = (_frame, callback) => { raced.emit("error", new Error("peer race")); callback(); };
await assert.rejects(writeM7P4AuthorityReadyForTest(raced, ready), /peer race/);
const callbackThenError = new SyntheticSocket();
callbackThenError.write = (_frame, callback) => {
  callback(); callbackThenError.emit("error", new Error("callback error race"));
};
await assert.rejects(writeM7P4AuthorityReadyForTest(callbackThenError, ready),
  /callback error race/);
const closeRace = new SyntheticSocket();
closeRace.write = (_frame, callback) => { closeRace.emit("close"); callback(); };
await assert.rejects(writeM7P4AuthorityReadyForTest(closeRace, ready), /peer closed/);
console.log("cadr M7 P4 authority READY tests passed");
