/*
 * Browser-side delivery of the one M5 control that is derived from a browser
 * surface: tab visibility.  This module deliberately has no scheduler, clock,
 * rAF, or wall-clock dependency.  It only turns an explicit Document state
 * into protocol-v3 requests; the worker remains the authority for guest time.
 */

export const CADR_M5_PROTOCOL_VERSION = 3;

function hostError(message) {
  return new TypeError(`invalid M5 visibility host: ${message}`);
}

function requestIdError(value) {
  return new RangeError(
    `invalid M5 visibility request id: ${String(value)}`);
}

function requireDocument(documentSurface) {
  if (documentSurface === null || typeof documentSurface !== "object") {
    throw hostError("document must be an object supplied by the caller");
  }
  if (typeof documentSurface.hidden !== "boolean") {
    throw hostError("document.hidden must be boolean");
  }
  if (typeof documentSurface.addEventListener !== "function" ||
      typeof documentSurface.removeEventListener !== "function") {
    throw hostError("document must implement addEventListener and removeEventListener");
  }
  return documentSurface;
}

function requireTransport(transport) {
  if (typeof transport === "function") return transport;
  if (transport !== null && typeof transport === "object" &&
      typeof transport.send === "function") {
    return (request) => transport.send(request);
  }
  throw hostError("transport must be a function or an object with send(request)");
}

function requireAllocator(allocateRequestId) {
  if (typeof allocateRequestId !== "function") {
    throw hostError("allocateRequestId must be a function");
  }
  return allocateRequestId;
}

function validRequestId(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 0x7fffffff;
}

/**
 * Bind a caller-owned protocol-v3 transport to a caller-supplied Document.
 *
 * The first request is always sent, including when the document is visible,
 * so the worker's initial visibility state is explicit rather than inferred
 * from the absence of an event.  Its id is allocated and its transport is
 * invoked before this function returns, so a host cannot start the scheduler
 * first or consume that id.  Later requests are serialized in observed event
 * order.  Request identifiers are allocated immediately before each actual
 * transport delivery, preventing skipped identifiers after an asynchronous
 * transport failure.
 *
 * `drain()` resolves only after all visibility notifications observed so far
 * have settled, or rejects with the first delivery/allocator error.  Delivery
 * errors are contained until `drain()` is called, so an ordinary browser event
 * cannot create an unhandled promise rejection.
 */
export function bindM5VisibilityAdapter({
  document: documentSurface,
  allocateRequestId,
  transport,
} = {}) {
  const documentHost = requireDocument(documentSurface);
  const allocate = requireAllocator(allocateRequestId);
  const send = requireTransport(transport);
  let disposed = false;
  let lastId = 0;
  let failure = null;
  const deliverNow = (hidden) => {
    /* The document contract was checked at bind time and is checked again at
     * event delivery: a mutable fake or host shim cannot smuggle a nonboolean
     * value into a worker request. */
    if (failure !== null) return Promise.resolve();
    try {
      if (typeof hidden !== "boolean") throw hostError("document.hidden became nonboolean");
      const id = allocate();
      if (!validRequestId(id) || id <= lastId) throw requestIdError(id);
      lastId = id;
      const completion = send({
        version: CADR_M5_PROTOCOL_VERSION,
        id,
        op: "scheduler-visibility",
        hidden,
      });
      return Promise.resolve(completion).catch((caught) => {
        if (failure === null) failure = caught;
      });
    } catch (caught) {
      if (failure === null) failure = caught;
      return Promise.resolve();
    }
  };

  /* Later events begin only after the prior transport has settled.  In
   * contrast, the first state is delivered below directly during binding. */
  let tail;
  const enqueue = (hidden) => {
    tail = tail.then(() => deliverNow(hidden));
  };

  const onVisibilityChange = () => {
    if (!disposed) enqueue(documentHost.hidden);
  };

  /* This is intentionally a request, not merely a public property: a newly
   * created worker must observe both initially visible and initially hidden
   * tabs before scheduler-start is permitted. */
  tail = deliverNow(documentHost.hidden);
  documentHost.addEventListener("visibilitychange", onVisibilityChange);

  return Object.freeze({
    initialHidden: documentHost.hidden,
    get disposed() { return disposed; },
    get failure() { return failure; },
    dispose() {
      if (!disposed) {
        documentHost.removeEventListener("visibilitychange", onVisibilityChange);
        disposed = true;
      }
    },
    async drain() {
      await tail;
      if (failure !== null) throw failure;
    },
  });
}
