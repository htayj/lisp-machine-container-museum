import { parentPort } from "node:worker_threads";

let boundary = 0n;
let outstanding = false;
let requestIssued = false;
let lifecycle = "RUNNING";

function machineInfo() {
  const bytes = new Uint8Array(64);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 2, true);
  view.setBigUint64(8, boundary, true);
  view.setBigUint64(16, boundary, true);
  view.setBigUint64(32, 2n, true);
  view.setBigUint64(40, outstanding ? 1n : 0n, true);
  view.setBigUint64(48, requestIssued && !outstanding ? 1n : 0n, true);
  view.setUint32(56, 0, true);
  view.setUint32(60, 1, true);
  return bytes.buffer;
}

function hostRequest() {
  const descriptor = new Uint8Array(16);
  const view = new DataView(descriptor.buffer);
  view.setBigUint64(0, 0n, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, 1024, true);
  return {
    request: {
      operation: 1, generation: 1n, requestId: 1n,
      descriptorByteCount: 16n, requestPayloadByteCount: 0n,
      completionByteCount: 1024n,
    },
    descriptor: descriptor.buffer,
    requestPayload: new ArrayBuffer(0),
  };
}

parentPort.on("message", message => {
  const response = { type: "cadr-response", version: 4,
    id: message.id, op: message.op, status: 0 };
  if (message.op === "machine-info") {
    response.info = machineInfo();
  } else if (message.op === "run-digest-batch-m5") {
    if (!requestIssued) {
      boundary += 1n; outstanding = true; requestIssued = true;
      Object.assign(response, {
        terminalStatus: 8, boundaryCount: 1,
        boundaryPendingHost: false, lifecycle: "WAITING_FOR_HOST",
        digests: new Uint8Array(128).buffer,
      });
    } else {
      boundary += BigInt(message.clockSlots);
      Object.assign(response, {
        terminalStatus: 0, boundaryCount: message.clockSlots,
        boundaryPendingHost: false, lifecycle: "RUNNING",
        digests: new Uint8Array(message.clockSlots * 128).buffer,
      });
    }
  } else if (message.op === "run-until-event-m6") {
    const preBoundary = boundary;
    const waiting = !requestIssued;
    const completed = waiting ? 1n : BigInt(message.clockSlots);
    boundary += completed;
    if (waiting) { outstanding = true; requestIssued = true; }
    Object.assign(response, {
      wireSchema: "CDRM6FAST1", reason: waiting ? 3 : 1,
      terminalStatus: waiting ? 8 : 0, requestedSlots: message.clockSlots,
      completedSlots: completed, preBoundary, postBoundary: boundary,
      debugBefore: 0n, debugAfter: 0n, persistentStatus: 0,
      coreLifecycle: 2, outstandingRequestId: waiting ? 1n : 0n,
    });
  } else if (message.op === "host-next-request") {
    if (outstanding) Object.assign(response, hostRequest());
    else response.status = 9;
  } else if (message.op === "host-complete") {
    outstanding = false;
  } else if (message.op === "scheduler-state") {
    Object.assign(response, {
      lifecycle, runActive: false, pendingBoundaryDigest: false,
      deferredControlCount: 0, mediaBusy: false,
      mediaSnapshotBlocked: false, visibilityInitialized: true, hidden: false,
    });
  } else if (message.op === "scheduler-pause") {
    lifecycle = "PAUSED"; response.lifecycle = lifecycle;
  } else if (message.op === "media-overlay-state") {
    response.lifecycle = lifecycle;
  } else {
    response.status = 2;
  }
  parentPort.postMessage(response);
});
