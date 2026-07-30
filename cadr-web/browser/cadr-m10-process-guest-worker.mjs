const page = Uint8Array.from({ length: 1024 },
  (_, index) => (index * 29 + 71) & 255);
const descriptor = new Uint8Array(24);
const view = new DataView(descriptor.buffer);
view.setBigUint64(0, 1n, true);
view.setBigUint64(8, 11n, true);
view.setUint32(16, 1, true);
view.setUint32(20, 1024, true);
let delivered = false;

self.onmessage = event => {
  const { id, operation } = event.data;
  if (operation.op === "host-next-request" && !delivered) {
    delivered = true;
    self.postMessage({ id, result: {
      status: 0,
      request: {
        operation: 2, generation: 1n, requestId: 1n,
        completionByteCount: 0n,
      },
      descriptor: descriptor.buffer,
      requestPayload: page.buffer,
    } });
    return;
  }
  if (operation.op === "host-complete") {
    self.postMessage({ id, result: { status: 0 } });
    return;
  }
  self.postMessage({ id, result: { status: 9 } });
};
