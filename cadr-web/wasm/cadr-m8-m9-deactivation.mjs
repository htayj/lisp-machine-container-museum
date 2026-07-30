/*
 * Shared C-M8/C-M9 lifecycle transaction.
 *
 * Preparation mutates only the M9 controller's reserved deactivation tail.
 * The worker commits the M8 held-set clear only after every tail record has
 * crossed the core boundary.  Serialized worker requests therefore expose
 * either the prior state or a pointer-up* + exactly-one-all-up transaction.
 */

const VERSION = 6;
const INVALID_ARGUMENT = 2;

function invalid(request, reason) {
  return Object.freeze({ type: "cadr-response", version: VERSION,
    id: request.id, op: request.op, status: INVALID_ARGUMENT,
    ok: false, reason });
}

export function prepareCadrM8M9SharedDeactivation({
  pointerProtocol, request,
}) {
  if (request.op === "keyboard-focus-lost") {
    if (Object.keys(request).some(key => !["version", "id", "op"].includes(key))) {
      return invalid(request, "invalid-keyboard-focus-lost");
    }
    const generation = pointerProtocol.controller.snapshot().generation;
    const pointer = pointerProtocol.handle(Object.freeze({ version: VERSION,
      id: request.id, op: "pointer-neutralize", cause: "lifecycle",
      tick: 0n, generation }));
    return pointer === null ? null : Object.freeze({ ...pointer, op: request.op });
  }
  if (request.op === "pointer-neutralize") return pointerProtocol.handle(request);
  return null;
}

export function commitCadrM8M9SharedDeactivation({ keyboardProtocol }) {
  return keyboardProtocol.controller.clearHeldForSharedDeactivation();
}
