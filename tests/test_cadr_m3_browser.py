#!/usr/bin/env python3
"""Real Chromium smoke for the M3 dedicated module worker."""
from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PAGE = b"""<!doctype html><meta charset=utf-8><pre id=result>pending</pre><script type=module>
const result = document.querySelector('#result');
function call(worker, request, transfer = []) {
  return new Promise((resolve, reject) => {
    worker.addEventListener('error', event => reject(new Error(event.message)), {once:true});
    worker.addEventListener('message', function listener(event) {
      if (event.data.id !== request.id) return;
      worker.removeEventListener('message', listener); resolve(event.data);
    });
    worker.postMessage(request, transfer);
  });
}
try {
  const module = await WebAssembly.compile(await (await fetch('/cadr-web/build/cadr-web-m3-O0.wasm')).arrayBuffer());
  const worker = new Worker('/cadr-web/wasm/cadr-worker.js', {type:'module'});
  const init = await call(worker, {version:1,id:1,op:'instantiate',module});
  const probe = await call(worker, {version:1,id:2,op:'portability-probe'});
  worker.terminate();
  result.textContent = init.status === 0 && probe.status === 0 && new Uint8Array(probe.bytes).byteLength === 32 ? 'ok' : JSON.stringify({init,probe});
} catch (error) { result.textContent = 'error:' + String(error); }
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
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium")
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="networkidle")
            expect(page.locator("#result")).to_have_text("ok", timeout=15000)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("cadr_m3_browser: ok")


if __name__ == "__main__":
    main()
