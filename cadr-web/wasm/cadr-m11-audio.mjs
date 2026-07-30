/* Closed protocol-v7 requests for the M11 audio bridge.  The worker owns the
 * Wasm cursor and calls the supplied invoke operation; browser callers never
 * receive an authority token, pointer, or host-audio callback. */
export const CADR_M11_PROTOCOL_VERSION = 7;
export const CADR_M11_STATUS_OK = 0;
export const CADR_M11_STATUS_INVALID_ARGUMENT = 2;

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function id(value) { return Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff; }
function u32(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff; }
function u64(value) { return typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn; }
function bytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}
function exact(object, fields) {
  return Object.keys(object).every(key => fields.includes(key));
}

export class CadrM11AudioProtocolSubhandler {
  constructor({ invoke }) {
    if (typeof invoke !== "function") throw new TypeError("invoke must be a function");
    this.invoke = invoke;
  }

  #response(idValue, op, status, extra = {}) {
    const numeric = status >>> 0;
    return Object.freeze({ type: "cadr-response", version: CADR_M11_PROTOCOL_VERSION,
      id: idValue, op, status: numeric, ok: numeric === CADR_M11_STATUS_OK, ...extra });
  }

  #call(idValue, op, operation) {
    try {
      const result = this.invoke(operation);
      if (!record(result) || !u32(result.status)) {
        return this.#response(idValue, op, CADR_M11_STATUS_INVALID_ARGUMENT,
          { reason: "backend-response" });
      }
      const { status, ...extra } = result;
      return this.#response(idValue, op, status, extra);
    } catch {
      return this.#response(idValue, op, CADR_M11_STATUS_INVALID_ARGUMENT,
        { reason: "backend-rejected" });
    }
  }

  handle(request) {
    if (!record(request) || request.version !== CADR_M11_PROTOCOL_VERSION || !id(request.id) ||
        typeof request.op !== "string") return null;
    const { id: requestId, op } = request;
    if (op === "audio-state" || op === "audio-peek" || op === "audio-snapshot-size" ||
        op === "audio-snapshot-save") {
      if (!exact(request, ["version", "id", "op"])) {
        return this.#response(requestId, op, CADR_M11_STATUS_INVALID_ARGUMENT);
      }
      return this.#call(requestId, op, Object.freeze({ op }));
    }
    if (op === "audio-render" || op === "audio-ack") {
      const terminal = op === "audio-render" ? "requestedFrames" : "frames";
      if (!exact(request, ["version", "id", "op", "generation", "sequence", "frameOffset", terminal]) ||
          !u64(request.generation) || !u64(request.sequence) || !u32(request.frameOffset) ||
          !u32(request[terminal]) ||
          (op === "audio-render" && request.requestedFrames === 0) ||
          (op === "audio-render" && request.requestedFrames > 512)) {
        return this.#response(requestId, op, CADR_M11_STATUS_INVALID_ARGUMENT);
      }
      return this.#call(requestId, op, Object.freeze({ op, generation: request.generation,
        sequence: request.sequence, frameOffset: request.frameOffset,
        [terminal]: request[terminal] }));
    }
    if (op === "audio-snapshot-restore") {
      const snapshot = bytes(request.snapshot);
      if (!exact(request, ["version", "id", "op", "snapshot"]) || snapshot === null ||
          snapshot.byteLength === 0 || snapshot.byteLength > 1048576) {
        return this.#response(requestId, op, CADR_M11_STATUS_INVALID_ARGUMENT);
      }
      return this.#call(requestId, op, Object.freeze({ op, snapshot: snapshot.slice() }));
    }
    return null;
  }
}
