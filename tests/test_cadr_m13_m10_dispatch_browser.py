"""Chromium composition checks for M13 dispatch into real C-M10-IDB-v1.

The lower peer is one synthetic exact M4 write request.  This tests the M13
dispatcher/bridge/controller ordering, not a booted selected-Wasm CADR session.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "/cadr-web/browser/cadr-m13-m10-dispatch-browser.html": "text/html; charset=utf-8",
    "/cadr-web/browser/cadr-m13-m10-dispatch-browser.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-shell.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m10-controller.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m10-indexeddb.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/wasm/cadr-m10-persistence.mjs": "text/javascript; charset=utf-8",
}
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; "
       "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; "
       "frame-ancestors 'none'")


class Handler(BaseHTTPRequestHandler):
    requests: list[str] = []

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        type(self).requests.append(path)
        mime = FILES.get(path)
        if mime is None:
            self.send_response(404); self.send_header("Content-Security-Policy", CSP); self.end_headers(); return
        body = (ROOT / path.lstrip("/")).read_bytes()
        self.send_response(200); self.send_header("Content-Type", mime)
        self.send_header("Content-Security-Policy", CSP); self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff"); self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class CadrM13M10DispatchBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()

    def test_real_idb_controller_is_dispatched_by_the_m13_shell(self) -> None:
        Handler.requests = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-m10-dispatch-browser.html",
                      wait_until="domcontentloaded")
            page.wait_for_function("() => window.cadrM13M10DispatchHarness !== undefined")
            result = page.evaluate("() => window.cadrM13M10DispatchHarness")
            self.assertNotIn("error", result, result.get("error"))
            expect(page.locator("#cadr-m13-m10-dispatch-status")).to_have_text("M13/M10 dispatch probe passed.")

            clean = result["clean"]
            self.assertEqual(clean["status"], 8)
            self.assertFalse(clean["terminal"])
            self.assertEqual(clean["controllerState"], "CLEAN")
            self.assertEqual(clean["completionCount"], 1)
            self.assertEqual(clean["completionByteCount"], 0)
            self.assertEqual(clean["requestOps"], ["scheduler-run-v7-slice", "host-next-request", "host-complete"])
            self.assertRegex(clean["storedPageSha256"], r"^[0-9a-f]{64}$")

            uncertain = result["uncertain"]
            self.assertEqual(uncertain["status"], 7)
            self.assertTrue(uncertain["terminal"])
            self.assertEqual(uncertain["controllerState"], "IN_DOUBT")
            self.assertEqual(uncertain["replacementCount"], 1)
            self.assertEqual(uncertain["completionCount"], 1)
            self.assertTrue(uncertain["workerTerminated"])
            self.assertEqual(uncertain["requestOps"], ["scheduler-run-v7-slice", "host-next-request", "host-complete"])

            pre_completion = result["preCompletion"]
            self.assertEqual(pre_completion["status"], 7)
            self.assertFalse(pre_completion["terminal"])
            self.assertEqual(pre_completion["controllerState"], "CLEAN")
            self.assertEqual(pre_completion["replacementCount"], 0)
            self.assertEqual(pre_completion["completionCount"], 1)
            self.assertEqual(pre_completion["completionStatus"], 1)
            self.assertFalse(pre_completion["workerTerminated"])
            self.assertEqual(pre_completion["requestOps"], ["scheduler-run-v7-slice", "host-next-request", "host-complete"])
            self.assertEqual(set(Handler.requests), set(FILES))
            self.assertEqual(errors, [], errors)
            browser.close()


if __name__ == "__main__":
    unittest.main()
