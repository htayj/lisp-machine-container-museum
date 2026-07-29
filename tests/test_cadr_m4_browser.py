#!/usr/bin/env python3
"""Real Chromium smoke for M4 Worker and synthetic range-service surfaces."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PAGE = b"""<!doctype html><meta charset=utf-8>
<pre id=result>pending</pre>
<script type=module>
import {
  CADR_HOST_OPERATION_BLOCK_READ,
  CADR_HOST_OPERATION_BLOCK_WRITE,
  CADR_HOST_RESULT_FAILED,
  CADR_STATUS_OK,
  createM4BlockRangeService,
} from "/cadr-web/wasm/cadr-m4-block-service.mjs";

const result = document.querySelector("#result");

function call(worker, request) {
  return new Promise((resolve, reject) => {
    worker.addEventListener("error",
      event => reject(new Error(event.message)), { once: true });
    worker.addEventListener("message", function listener(event) {
      if (event.data.id !== request.id) return;
      worker.removeEventListener("message", listener);
      resolve(event.data);
    });
    worker.postMessage(request);
  });
}

function writeDescriptor(transactionId) {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, transactionId, true);
  view.setBigUint64(8, 1n, true);
  view.setUint32(16, 1, true);
  view.setUint32(20, 1024, true);
  return bytes;
}

function readDescriptor() {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, 1n, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, 1024, true);
  return bytes;
}

function request(operation, generation, requestId) {
  const write = operation === CADR_HOST_OPERATION_BLOCK_WRITE;
  return {
    operation, generation, requestId,
    descriptorByteCount: write ? 24n : 16n,
    requestPayloadByteCount: write ? 1024n : 0n,
    completionByteCount: write ? 0n : 1024n,
  };
}

async function oneRequest(service, tick, next, completions) {
  return service.poll({
    tick,
    nextRequest: async () => next,
    complete: async completion => {
      completions.push(completion);
      return { status: CADR_STATUS_OK };
    },
  });
}

try {
  const module = await WebAssembly.compile(
    await (await fetch("/cadr-web/build/cadr-web-m4-O2.wasm")).arrayBuffer());
  const worker = new Worker("/cadr-web/wasm/cadr-worker.js", { type: "module" });
  const instantiated = await call(
    worker, { version: 2, id: 1, op: "instantiate", module });
  const emptyEvidence = await call(
    worker, { version: 2, id: 2, op: "disk-evidence" });
  const prematureV4 = await call(
    worker, { version: 2, id: 3, op: "boundary-digest-v4" });
  worker.terminate();

  const base = new Uint8Array(2048);
  base[1024] = 77;
  const payload = new Uint8Array(1024);
  payload[0] = 99;
  const service = createM4BlockRangeService({
    imageByteCount: 2048n,
    expectedImageByteCount: 2048n,
    readRange: async (offset, count) =>
      base.slice(Number(offset), Number(offset + count)),
  });
  const completions = [];
  const first = await oneRequest(service, 1n, {
    status: CADR_STATUS_OK,
    request: request(CADR_HOST_OPERATION_BLOCK_WRITE, 2n, 1n),
    descriptor: writeDescriptor(1n),
    requestPayload: payload,
  }, completions);
  const replay = await oneRequest(service, 2n, {
    status: CADR_STATUS_OK,
    request: request(CADR_HOST_OPERATION_BLOCK_WRITE, 2n, 1n),
    descriptor: writeDescriptor(1n),
    requestPayload: payload,
  }, completions);
  const stale = await oneRequest(service, 3n, {
    status: CADR_STATUS_OK,
    request: request(CADR_HOST_OPERATION_BLOCK_WRITE, 1n, 1n),
    descriptor: writeDescriptor(1n),
    requestPayload: payload,
  }, completions);
  const read = await oneRequest(service, 4n, {
    status: CADR_STATUS_OK,
    request: request(CADR_HOST_OPERATION_BLOCK_READ, 2n, 2n),
    descriptor: readDescriptor(),
    requestPayload: new Uint8Array(),
  }, completions);

  const ok = instantiated.version === 2 &&
    emptyEvidence.version === 2 &&
    prematureV4.version === 2 &&
    instantiated.status === CADR_STATUS_OK &&
    emptyEvidence.status === CADR_STATUS_OK &&
    new Uint8Array(emptyEvidence.bytes).byteLength === 16 &&
    prematureV4.status !== CADR_STATUS_OK &&
    first.events[1].overlayCommitted === true &&
    replay.events[1].overlayReplayed === true &&
    stale.events[1].hostStatus === CADR_HOST_RESULT_FAILED &&
    stale.events[1].overlayCommitted === undefined &&
    service.overlayGeneration() === 1n &&
    read.events[1].hostStatus === CADR_STATUS_OK &&
    completions.length === 4 &&
    completions[3].bytes[0] === 99;
  result.textContent = ok ? "ok" : JSON.stringify({
    instantiated: instantiated.status,
    emptyEvidence: emptyEvidence.status,
    emptyEvidenceBytes: new Uint8Array(emptyEvidence.bytes).byteLength,
    prematureV4: prematureV4.status,
    firstCommitted: first.events[1].overlayCommitted,
    replayed: replay.events[1].overlayReplayed,
    staleStatus: stale.events[1].hostStatus,
    overlayGeneration: service.overlayGeneration().toString(),
    readStatus: read.events[1].hostStatus,
    completionCount: completions.length,
    readFirstByte: completions[3]?.bytes[0],
  });
} catch (error) {
  result.textContent = "error:" + String(error);
}
</script>"""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        if urlparse(self.path).path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(PAGE)))
            self.end_headers()
            self.wfile.write(PAGE)
            return
        super().do_GET()

    def log_message(self, _format: str, *args: object) -> None:
        del args


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path="/usr/bin/chromium")
            page = browser.new_page()
            page.goto(
                f"http://127.0.0.1:{server.server_port}/",
                wait_until="networkidle")
            expect(page.locator("#result")).to_have_text("ok", timeout=15000)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("cadr_m4_browser: ok")


if __name__ == "__main__":
    main()
