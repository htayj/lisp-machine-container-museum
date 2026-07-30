import assert from "node:assert/strict";
import {
  CADR_M9_BUTTONS,
  CADR_M9_COALESCING_BARRIER_KINDS,
  CADR_M9_EDGE_CAUSES,
  CADR_M9_KEYBOARD_ALL_UP,
  CADR_M9_POINTER_ORDINARY_CAPACITY,
  CADR_M9_POINTER_PROFILE,
  CADR_M9_CONTROLLER_VERSION,
  CADR_M9_CORE_ABI,
  CADR_M9_PROTOCOL_VERSION,
  CADR_M9_SCHEDULER_KIND_POINTER,
  CadrM9PointerController,
  CadrM9PointerProtocolSubhandler,
  decodeCadrM9Edge32,
  encodeCadrM9Edge32,
} from "../cadr-web/wasm/cadr-m9-pointer.mjs";

assert.equal(CADR_M9_CONTROLLER_VERSION, "C-M9.1");
assert.equal(CADR_M9_CORE_ABI, "ABI1.8");
assert.equal(CADR_M9_POINTER_PROFILE,
  "CADR-WEB-303/controller-C-M9.1/core-ABI1.8/protocol-v6/PTR-X11-EDGE32-v1");
assert.deepEqual(CADR_M9_BUTTONS.map(({ name, bit, x11, dom }) => ({ name, bit, x11, dom })), [
  { name: "tail", bit: 1, x11: 1, dom: 0 }, { name: "middle", bit: 2, x11: 2, dom: 1 },
  { name: "head", bit: 4, x11: 3, dom: 2 },
]);

/* Exhaust the coordinate domain independently of semantic masks. */
for (let y = 0; y < 963; y += 1) {
  for (let x = 0; x < 768; x += 1) {
    assert.deepEqual(decodeCadrM9Edge32(encodeCadrM9Edge32({ x, y, buttonsAfter: 0 })),
      { x, y, buttonsAfter: 0, changedMask: 0, cause: "physical" });
  }
}
for (const buttonsAfter of [0, 1, 2, 3, 4, 5, 6, 7]) {
  for (const changedMask of [0, 1, 2, 4]) {
    for (const cause of Object.keys(CADR_M9_EDGE_CAUSES)) {
      const decoded = decodeCadrM9Edge32(encodeCadrM9Edge32({ x: 767, y: 962,
        buttonsAfter, changedMask, cause }));
      assert.deepEqual(decoded, { x: 767, y: 962, buttonsAfter, changedMask, cause });
    }
  }
}
for (const changedMask of [3, 5, 6, 7]) {
  assert.throws(() => encodeCadrM9Edge32({ x: 0, y: 0, buttonsAfter: 0, changedMask }), /one-hot/);
}
assert.throws(() => decodeCadrM9Edge32(0x80000000), /reserved/);
assert.throws(() => decodeCadrM9Edge32(768), /outside/);
assert.throws(() => decodeCadrM9Edge32(963 << 10), /outside/);
assert.throws(() => encodeCadrM9Edge32({ x: 768, y: 0, buttonsAfter: 0 }), /outside/);
assert.throws(() => encodeCadrM9Edge32({ x: 0, y: 963, buttonsAfter: 0 }), /outside/);

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) => permutations([...values.slice(0, index), ...values.slice(index + 1)])
    .map(rest => [value, ...rest]));
}

/* Every three-button down/up ordering is an exact after-mask transition. */
for (const downOrder of permutations([0, 1, 2])) {
  for (const upOrder of permutations([0, 1, 2])) {
    const controller = new CadrM9PointerController(); let mask = 0;
    for (const domButton of downOrder) {
      const response = controller.buttonDown({ domButton, x: 100 + domButton, y: 200, tick: 7n });
      assert.equal(response.accepted, true); mask |= 1 << domButton;
      assert.equal(response.entry.edge.buttonsAfter, mask); assert.equal(response.entry.edge.changedMask, 1 << domButton);
    }
    for (const domButton of upOrder) {
      const response = controller.buttonUp({ domButton, x: 100 + domButton, y: 200, tick: 7n });
      assert.equal(response.accepted, true); mask &= ~(1 << domButton);
      assert.equal(response.entry.edge.buttonsAfter, mask); assert.equal(response.entry.edge.changedMask, 1 << domButton);
    }
    assert.equal(controller.buttons, 0);
  }
}

{
  const controller = new CadrM9PointerController();
  assert.equal(controller.buttonDown({ domButton: 0, x: 1, y: 1 }).accepted, true);
  assert.equal(controller.buttonDown({ domButton: 0, x: 1, y: 1 }).reason, "duplicate-down");
  assert.equal(controller.buttonUp({ domButton: 1, x: 1, y: 1 }).reason, "not-held");
  assert.equal(controller.buttonDown({ domButton: 3, x: 1, y: 1 }).reason, "unmapped-button");
  assert.throws(() => controller.buttonUp({ domButton: 0, x: 1 }), /supplied together/);
}

/* Coalescing is only same-generation/same-tick adjacency and retains the first ordinal. */
{
  const controller = new CadrM9PointerController();
  assert.equal(controller.motion({ x: 1, y: 1, tick: 9n }).reason, "motion");
  assert.equal(controller.motion({ x: 2, y: 2, tick: 9n }).reason, "motion-coalesced");
  assert.equal(controller.snapshot().queue.length, 1);
  assert.equal(controller.snapshot().queue[0].ingressOrdinal, 1n);
  assert.equal(controller.snapshot().queue[0].edge.x, 2);
  controller.buttonDown({ domButton: 0, x: 2, y: 2, tick: 9n });
  controller.motion({ x: 3, y: 3, tick: 9n });
  controller.motion({ x: 4, y: 4, tick: 10n });
  assert.equal(controller.snapshot().queue.length, 4, "edge and tick both break motion coalescing");
  controller.advanceGeneration();
  assert.equal(controller.motion({ x: 5, y: 5, tick: 10n, generation: 0 }).reason, "stale-generation");
  assert.equal(controller.snapshot().queue.length, 4, "late generation does not mutate queue");
}

assert.deepEqual(CADR_M9_COALESCING_BARRIER_KINDS,
  ["edge", "warp", "keyboard", "clock", "lifecycle", "tick", "generation"]);

/* Every non-motion ordering class has an explicit token, so same-tick motion
 * cannot cross a keyboard, clock, lifecycle, or warp boundary. */
for (const kind of ["keyboard", "clock", "lifecycle", "warp"]) {
  const controller = new CadrM9PointerController();
  controller.motion({ x: 1, y: 1, tick: 9n });
  const before = controller.snapshot().coalescingBarrierToken;
  assert.equal(controller.coalescingBarrier(kind).accepted, true);
  assert.equal(controller.snapshot().lastCoalescingBarrier.kind, kind);
  assert.ok(controller.snapshot().coalescingBarrierToken > before);
  assert.equal(controller.motion({ x: 2, y: 2, tick: 9n }).reason, "motion");
  assert.equal(controller.queueLength, 2, `${kind} is a coalescing barrier`);
}

{
  const controller = new CadrM9PointerController();
  controller.motion({ x: 1, y: 1, tick: 1n });
  const tickToken = controller.snapshot().coalescingBarrierToken;
  controller.motion({ x: 2, y: 2, tick: 2n });
  assert.ok(controller.snapshot().coalescingBarrierToken > tickToken);
  assert.equal(controller.snapshot().lastCoalescingBarrier.kind, "tick");
  const warpToken = controller.snapshot().coalescingBarrierToken;
  controller.requestWarp({ cursorState: 3, x: 4, y: 5 });
  assert.ok(controller.snapshot().coalescingBarrierToken > warpToken);
  assert.equal(controller.snapshot().lastCoalescingBarrier.kind, "warp");
  controller.motion({ x: 3, y: 3, tick: 2n });
  assert.equal(controller.queueLength, 3, "warp request prevents same-tick coalescing");
  const generationToken = controller.snapshot().coalescingBarrierToken;
  controller.advanceGeneration();
  assert.ok(controller.snapshot().coalescingBarrierToken > generationToken);
  controller.motion({ x: 4, y: 4, tick: 2n, generation: 1 });
  assert.equal(controller.queueLength, 4, "generation change prevents coalescing");
}

/* Parsing and ingress validation are mutation-free, including the ordinal. */
{
  const controller = new CadrM9PointerController();
  controller.motion({ x: 1, y: 1, tick: 1n, ingressOrdinal: 7n });
  for (const operation of [
    () => controller.motion({ x: 2, y: 2, tick: 2, ingressOrdinal: 8n }),
    () => controller.motion({ x: 2, y: 2, tick: 2n, ingressOrdinal: 8n, cause: "not-a-cause" }),
    () => controller.buttonDown({ domButton: 0, x: 768, y: 0, ingressOrdinal: 8n }),
  ]) {
    const before = controller.snapshot();
    assert.throws(operation);
    assert.deepEqual(controller.snapshot(), before);
  }
  const beforeStale = controller.snapshot();
  assert.equal(controller.motion({ x: 2, y: 2, tick: 2n, ingressOrdinal: 7n }).reason,
    "stale-ingress-ordinal");
  assert.deepEqual(controller.snapshot(), beforeStale);
}

/* Fill the ordinary 60 cells while all three buttons are held, then prove the
 * reserved four cells provide LIFO pointer release and M8 all-up atomically. */
{
  const controller = new CadrM9PointerController();
  for (const button of [0, 1, 2]) assert.equal(controller.buttonDown({ domButton: button, x: 50, y: 50 }).accepted, true);
  for (let index = 0; index < CADR_M9_POINTER_ORDINARY_CAPACITY - 3; index += 1) {
    assert.equal(controller.motion({ x: index % 768, y: Math.floor(index / 768), tick: BigInt(index + 1) }).accepted, true);
  }
  assert.equal(controller.queueLength, 60);
  assert.equal(controller.motion({ x: 700, y: 900 }).reason, "capacity-pressure");
  const neutralized = controller.neutralize({ cause: "lifecycle", tick: 44n });
  assert.equal(neutralized.accepted, true); assert.equal(controller.queueLength, 64);
  assert.deepEqual(neutralized.entries.map(entry => entry.type),
    ["pointer-edge", "pointer-edge", "pointer-edge", "keyboard-all-up"]);
  assert.deepEqual(neutralized.entries.slice(0, 3).map(entry => entry.edge.changedMask), [4, 2, 1]);
  assert.deepEqual(neutralized.entries.slice(0, 3).map(entry => entry.edge.cause), ["lifecycle", "lifecycle", "lifecycle"]);
  assert.equal(neutralized.entries[3].value, CADR_M9_KEYBOARD_ALL_UP);
  assert.equal(controller.buttons, 0);
}

{
  const controller = new CadrM9PointerController({ generation: 12 });
  assert.equal(controller.requestWarp({ cursorState: 2, x: 1, y: 2 }).reason, "cursor-state-not-warp");
  assert.equal(controller.requestWarp({ cursorState: 3, x: -20, y: 10000 }).accepted, true);
  assert.deepEqual(controller.warpRequest(), { x: 0, y: 962, generation: 12, previousCursorState: 3 });
  controller.advanceGeneration(13);
  assert.equal(controller.warpRequest(), null, "generation transition invalidates a rebase request");
}

{
  const controller = new CadrM9PointerController();
  controller.buttonDown({ domButton: 0, x: 4, y: 5 });
  const transaction = controller.neutralizeAndAdvanceGeneration({
    cause: "capture-loss", tick: 3n, generation: 0,
  });
  assert.equal(transaction.accepted, true);
  assert.equal(transaction.priorGeneration, 0);
  assert.equal(transaction.nextGeneration, 1);
  assert.equal(controller.generation, 1);
  assert.deepEqual(transaction.entries.map(entry => entry.generation), [0, 0],
    "the old generation tags the complete neutralization tail");
}

{
  const controller = new CadrM9PointerController({ generation: 0xffffffff });
  controller.buttonDown({ domButton: 0, x: 4, y: 5 });
  const before = controller.snapshot();
  const rejected = controller.neutralizeAndAdvanceGeneration({
    cause: "capture-loss", tick: 3n, generation: 0xffffffff,
  });
  assert.equal(rejected.reason, "epoch-exhausted");
  assert.deepEqual(controller.snapshot(), before,
    "generation exhaustion rejects before any neutralization mutation");
}

/* v6 generic scheduler ingress must not accept either keyboard or pointer kinds. */
{
  const handler = new CadrM9PointerProtocolSubhandler();
  assert.equal(handler.handle({ version: CADR_M9_PROTOCOL_VERSION, id: 1, op: "scheduler-events",
    events: [{ kind: 1 }] }), null);
  for (const kind of [3, CADR_M9_SCHEDULER_KIND_POINTER]) {
    const response = handler.handle({ version: 6, id: kind + 1, op: "scheduler-events", events: [{ kind }] });
    assert.equal(response.ok, false); assert.equal(response.reason, "v6-input-is-host-only");
  }
  const down = handler.handle({ version: 6, id: 8, op: "pointer-down", domButton: 0, x: 7, y: 8 });
  assert.equal(down.ok, true); assert.equal(down.result.entry.edge.changedMask, 1);
  assert.equal(handler.handle({ version: 6, id: 9, op: "pointer-down", domButton: 0, x: 7, y: 8, stray: true }).ok, false);
  const beforeMissingCoordinates = handler.controller.snapshot();
  for (const request of [
    { version: 6, id: 11, op: "pointer-down", domButton: 1 },
    { version: 6, id: 12, op: "pointer-down", domButton: 1, x: 3 },
    { version: 6, id: 13, op: "pointer-down", domButton: 1, y: 4 },
  ]) {
    assert.equal(handler.handle(request).ok, false, "v6 pointer-down requires both coordinates");
  }
  assert.deepEqual(handler.controller.snapshot(), beforeMissingCoordinates,
    "missing pointer-down coordinates do not mutate button, queue, or ordinal state");
  assert.equal(handler.handle({ version: 6, id: 14, op: "pointer-up", domButton: 0 }).ok, true,
    "v6 pointer-up explicitly permits omission of both coordinates");
  const beforeMalformed = handler.controller.snapshot();
  assert.equal(handler.handle({ version: 6, id: 15, op: "pointer-motion", x: 9, y: 9,
    tick: 4, ingressOrdinal: 99n }).ok, false);
  assert.deepEqual(handler.controller.snapshot(), beforeMalformed,
    "malformed protocol ingress does not consume an ordinal or mutate state");
}

console.log("cadr M9 pointer tests passed");
