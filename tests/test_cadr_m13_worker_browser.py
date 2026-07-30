"""Chromium Worker/structured-clone conformance probes for M13-F04.

The page uses a synthetic lower v7 peer and never boots a CADR machine.  It
therefore proves only the modern M13 v8 message boundary, not System 303 behavior,
storage, audio, or release readiness.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "/cadr-web/browser/cadr-m13-message-browser.html": "text/html; charset=utf-8",
    "/cadr-web/browser/cadr-m13-message-browser.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-message-worker.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-shell.mjs": "text/javascript; charset=utf-8",
}
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; "
       "connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; "
       "frame-ancestors 'none'")


class Handler(BaseHTTPRequestHandler):
    requests: list[str] = []
    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        type(self).requests.append(path)
        mime = FILES.get(path)
        if mime is None:
            self.send_response(404)
            self.send_header("Content-Security-Policy", CSP)
            self.end_headers()
            return
        body = (ROOT / path.lstrip("/")).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class CadrM13WorkerBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.thread.join(timeout=3)
        cls.server.server_close()

    def test_v8_message_boundary_against_actual_chromium_worker(self) -> None:
        Handler.requests = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page()

            def open_mode(mode: str = "echo", initial_id: int = 1) -> None:
                page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-message-browser.html"
                          f"?mode={mode}&initialId={initial_id}", wait_until="domcontentloaded")
                page.wait_for_function("() => window.cadrM13MessageHarness !== undefined")
                # The Worker script is fetched separately from the module that
                # publishes the harness.  This is not a protocol readiness
                # signal; it merely keeps this test from measuring cold-worker
                # compilation instead of the message boundary.
                page.wait_for_timeout(50)

            def submit(candidate: dict[str, object]) -> dict[str, object]:
                return page.evaluate("async candidate => window.cadrM13MessageHarness.submit(candidate)", candidate)

            def request(identifier: object, operation: str = "keyboard-state", **fields: object) -> dict[str, object]:
                return {"type": "cadr-request", "version": 8, "sessionId": "6d" * 32,
                        "id": identifier, "op": operation, **fields}

            # v1--v7 and malformed common fields must never reach the Worker.
            for version in range(1, 8):
                open_mode()
                result = submit({**request(1), "version": version})
                self.assertTrue(result["rejected"])
                self.assertEqual(result["state"], "FAILED")
            for malformed in (
                {**request(1), "type": "wrong"},
                {**request(1), "sessionId": "ff" * 32},
                request(0), request(1.5), request(0x1_0000_0000),
            ):
                open_mode()
                self.assertTrue(submit(malformed)["rejected"])

            # A correct correlated reply completes once.  A caller duplicate is
            # terminal before it can replay an edge into the Worker.
            open_mode()
            first = submit(request(1))
            self.assertEqual(first["status"], 0)
            duplicate = submit(request(1))
            self.assertEqual(duplicate["status"], 25)
            self.assertTrue(duplicate["terminal"])

            # Detached source body before admission is rejected.  Detachment
            # immediately after submit and after the response cannot change the
            # copied canonical Wasm bytes delivered to the actual Worker.
            open_mode()
            detachment = page.evaluate("""async () => {
              const api = window.cadrM13MessageHarness;
              const bytes = () => new Uint8Array([0,97,115,109,1,0,0,0]).buffer;
              const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))]
                .map(byte => byte.toString(16).padStart(2, '0')).join('');
              const candidate = async (id, value) => ({ type: 'cadr-request', version: 8,
                sessionId: api.sessionId, id, op: 'bootstrap', wasmBytes: value,
                wasmSha256: await digest(value) });
              const before = bytes(); const beforeRequest = await candidate(1, before);
              structuredClone({ before }, { transfer: [before] });
              const beforeResult = await api.submit(beforeRequest);
              const during = bytes(); const duringRequest = await candidate(2, during);
              const duringPromise = api.submit(duringRequest);
              structuredClone({ during }, { transfer: [during] });
              const duringResult = await duringPromise;
              const after = bytes(); const afterRequest = await candidate(3, after);
              const afterResult = await api.submit(afterRequest);
              structuredClone({ after }, { transfer: [after] });
              return { before: beforeResult.status, during: duringResult.status, after: afterResult.status };
            }""")
            self.assertEqual(detachment, {"before": 2, "during": 0, "after": 0})

            # Lower failures are fenced to one terminal v8 outcome.  A delayed
            # normal reply is accepted; a duplicate later reply terminates the
            # current shell instead of completing a second pending request.
            open_mode("delayed")
            self.assertEqual(submit(request(1))["status"], 0)
            open_mode("duplicate")
            self.assertEqual(submit(request(1))["status"], 0)
            page.wait_for_timeout(80)
            self.assertEqual(page.evaluate("() => window.cadrM13MessageHarness.state()"), "FAILED")
            for mode, expected in (("error", 24), ("malformed", 25), ("status21", 25)):
                open_mode(mode)
                result = submit(request(1))
                self.assertEqual(result["status"], expected)
                self.assertTrue(result["terminal"])

            # The final public ID has exactly one result in each outcome: normal,
            # worker loss, and protocol violation.  The duplicate post-terminal
            # reply cannot resurrect the normal terminal shell.
            for mode, expected, state in (("duplicate", 0, "TERMINATED"),
                                          ("error", 24, "FAILED"),
                                          ("malformed", 25, "FAILED")):
                open_mode(mode, 0xFFFF_FFFF)
                result = submit(request(0xFFFF_FFFF))
                self.assertEqual(result["status"], expected)
                self.assertTrue(result["terminal"])
                page.wait_for_timeout(80)
                self.assertEqual(page.evaluate("() => window.cadrM13MessageHarness.state()"), state)
            browser.close()


if __name__ == "__main__":
    unittest.main()
