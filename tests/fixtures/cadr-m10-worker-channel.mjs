import { parentPort, threadId, workerData } from "node:worker_threads";

const descriptor = new Uint8Array(24);
const view = new DataView(descriptor.buffer);
view.setBigUint64(0, 91n, true);
view.setBigUint64(8, 7n, true);
view.setUint32(16, 1, true);
view.setUint32(20, 1024, true);
let delivered = false;

parentPort.on("message", message => {
  const { id, operation } = message;
  if (operation.op === "ping") {
    parentPort.postMessage({ id, result: { status: 0, threadId } });
    return;
  }
  if (operation.op === "host-next-request" && !delivered) {
    delivered = true;
    parentPort.postMessage({ id, result: {
      status: 0,
      request: {
        operation: 2, generation: 1n, requestId: 91n,
        completionByteCount: 0n,
      },
      descriptor: descriptor.buffer,
      requestPayload: Uint8Array.from({ length: 1024 },
        (_, index) => (index * 13 + 3) & 255).buffer,
    } });
    return;
  }
  if (operation.op === "host-complete" &&
      workerData?.loseCompletionResponse === true) {
    /* Model an applied completion whose response is lost with the worker. */
    process.exit(0);
  }
  parentPort.postMessage({ id, result: { status: 9 } });
});
