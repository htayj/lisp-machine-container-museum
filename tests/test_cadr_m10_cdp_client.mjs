import assert from "node:assert/strict";

import { connectBoundedCdp } from "../scripts/cadr-cdp-client.mjs";

class HostileSocket {
  onopen = null;
  onerror = null;
  onclose = null;
  onmessage = null;
  sent = [];
  closed = false;
  open() { this.onopen?.(); }
  error() { this.onerror?.(new Error("synthetic CDP socket error")); }
  peerClose() { this.onclose?.(); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.closed = true; this.onclose?.(); }
  reply(id, result = {}) { this.onmessage?.({ data: JSON.stringify({ id, result }) }); }
}

async function openClient({ deadline = Date.now() + 1000 } = {}) {
  const socket = new HostileSocket();
  const opening = connectBoundedCdp("ws://hostile.invalid", {
    deadline, WebSocketImpl: class {
      constructor() { return socket; }
    },
  });
  socket.open();
  return { socket, client: await opening };
}

{
  const { socket, client } = await openClient();
  const first = client.call("Runtime.evaluate", { expression: "1" });
  const second = client.call("Page.enable");
  assert.equal(socket.sent.length, 2);
  socket.error();
  await assert.rejects(first, /C-M10 CDP connection failed/);
  await assert.rejects(second, /C-M10 CDP connection failed/);
  await assert.rejects(client.call("Runtime.enable"), /C-M10 CDP connection failed/);
}

{
  const { socket, client } = await openClient();
  const call = client.call("Page.navigate", { url: "about:blank" });
  socket.peerClose();
  await assert.rejects(call, /C-M10 CDP connection closed/);
}

{
  const { socket, client } = await openClient({ deadline: Date.now() + 15 });
  const first = client.call("Runtime.evaluate");
  const second = client.call("Runtime.enable");
  await assert.rejects(first, /campaign deadline/);
  await assert.rejects(second, /campaign deadline/);
  assert.equal(socket.sent.length, 2,
    "a silent CDP peer did not receive the bounded requests");
  await assert.rejects(client.call("Runtime.enable"), /campaign deadline/);
}

{
  const { socket, client } = await openClient();
  const call = client.call("Browser.getVersion");
  socket.reply(socket.sent[0].id, { product: "hostile-but-responsive" });
  assert.deepEqual(await call, { product: "hostile-but-responsive" });
  client.close();
  assert.equal(socket.closed, true);
}

console.log("C-M10 bounded CDP client tests passed");
