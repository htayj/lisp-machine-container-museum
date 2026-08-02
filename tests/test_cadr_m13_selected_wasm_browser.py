"""Chromium evidence for the M13-shell/selected-ABI1.11-worker seam.

It deliberately does not provide the M10 storage service, any base bytes, or a
CADR audio device.  A successful result therefore establishes module and worker
composition only, never a booted or persistent System 303 session.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / "cadr-web" / "browser"
WASM = ROOT / "cadr-web" / "wasm"
SELECTED_WASM = ROOT / "cadr-web" / "build" / "cadr-web-m13-audio-O2.wasm"
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; "
       "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; "
       "frame-ancestors 'none'")


class Handler(BaseHTTPRequestHandler):
    requests: list[str] = []

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        type(self).requests.append(path)
        relative: Path | None = None
        mime = "text/javascript; charset=utf-8"
        if path == "/cadr-web/browser/cadr-m13-selected-wasm-browser.html":
            relative = BROWSER / "cadr-m13-selected-wasm-browser.html"; mime = "text/html; charset=utf-8"
        elif path.startswith("/cadr-web/browser/") and path.endswith(".mjs"):
            candidate = BROWSER / path.removeprefix("/cadr-web/browser/")
            if candidate.is_file() and candidate.resolve().parent == BROWSER.resolve():
                relative = candidate
        elif path.startswith("/cadr-web/wasm/") and path.endswith((".js", ".mjs")):
            candidate = WASM / path.removeprefix("/cadr-web/wasm/")
            if candidate.is_file() and candidate.resolve().parent == WASM.resolve():
                relative = candidate
        elif path == "/cadr-web/build/cadr-web-m13-audio-O2.wasm":
            relative = SELECTED_WASM; mime = "application/wasm"
        if relative is None:
            self.send_response(404); self.send_header("Content-Security-Policy", CSP); self.end_headers(); return
        body = relative.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class CadrM13SelectedWasmBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not SELECTED_WASM.is_file():
            raise RuntimeError("build the selected M13 ABI1.11 O2 Wasm module before this browser probe")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()

    def test_v8_shell_bootstraps_selected_wasm_in_real_v8_worker(self) -> None:
        Handler.requests = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-selected-wasm-browser.html",
                      wait_until="domcontentloaded")
            page.wait_for_function("() => window.cadrM13SelectedWasmHarness !== undefined")
            bootstrap = page.evaluate("() => window.cadrM13SelectedWasmHarness.bootstrap()")
            self.assertEqual(bootstrap["status"], 0)
            self.assertFalse(bootstrap["terminal"])
            self.assertEqual(bootstrap["lifecycle"], "NEW")
            expect(page.locator("#cadr-m13-selected-wasm-status")).to_have_text(
                "Selected M13 ABI1.11 Wasm instantiated in the real v8 worker; no storage is configured.")

            # The M12 worker is real, but its canonical machine has no selected
            # artifacts yet: it must fail closed without terminalizing the v8
            # shell or being mistaken for a successful boot.
            cold = page.evaluate("() => window.cadrM13SelectedWasmHarness.submit(2, 'machine-cold-power-on')")
            self.assertEqual(cold["status"], 9)
            self.assertFalse(cold["terminal"])
            self.assertEqual(cold["lifecycle"], "NEW")
            self.assertEqual(page.evaluate("() => window.cadrM13SelectedWasmHarness.state()"), "NEW")

            # Exercise the normal public-ID exhaustion response against the
            # actual selected worker in a second, independent shell.  The
            # synthetic-worker campaign retains the hostile/reply-race matrix.
            maximum = page.evaluate(
                "() => window.cadrM13SelectedWasmHarness.bootstrapAtMaximumId()")
            self.assertEqual(maximum["result"]["status"], 0)
            self.assertTrue(maximum["result"]["terminal"])
            self.assertEqual(maximum["result"]["lifecycle"], "NEW")
            self.assertEqual(maximum["state"], "TERMINATED")

            # A third, independently bootstrapped selected worker is actually
            # terminated while its lower request is pending.  Its v8 shell must
            # report the terminal worker-loss result, not mislabel it as the
            # selected worker's ordinary NOT_READY response.
            loss = page.evaluate(
                "() => window.cadrM13SelectedWasmHarness.terminateSelectedWorkerDuringRequest()")
            self.assertEqual(loss["bootstrapResult"]["status"], 0)
            self.assertEqual(loss["result"]["status"], 24)
            self.assertTrue(loss["result"]["terminal"])
            self.assertEqual(loss["state"], "FAILED")

            # No M10 service is injected.  The v8 shell rejects no parser input
            # here; it returns its documented NOT_READY result and neither
            # fetches base media nor gives the worker a storage capability.
            storage = page.evaluate("""() => window.cadrM13SelectedWasmHarness.submit(3, 'base-import-begin', {
              role: 'system-303-base', byteCount: 269562880,
              sha256: 'bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5',
            })""")
            self.assertEqual(storage["status"], 9)
            self.assertFalse(storage["terminal"])
            self.assertEqual(page.evaluate("() => window.cadrM13SelectedWasmHarness.state()"), "NEW")
            page.evaluate("() => window.cadrM13SelectedWasmHarness.dispose()")
            # The self-only server is an exact module closure allowlist.  This
            # catches an unreviewed self-origin import as well as an accidental
            # attempt to fetch the selected base.  It is not an assertion about
            # a release CSP or the browser network service after M10 exists.
            expected_paths = {
                "/cadr-web/browser/cadr-m13-selected-wasm-browser.html",
                "/cadr-web/browser/cadr-m13-selected-wasm-browser.mjs",
                "/cadr-web/browser/cadr-m13-shell.mjs",
                "/cadr-web/browser/cadr-m13-audio-boundary.mjs",
                "/cadr-web/browser/cadr-m13-audio-record.mjs",
                "/cadr-web/browser/cadr-m13-audio-reducer.mjs",
                "/cadr-web/wasm/cadr-worker.js",
                "/cadr-web/wasm/cadr-m5-batch.mjs",
                "/cadr-web/wasm/cadr-display-renderer.mjs",
                "/cadr-web/wasm/cadr-m7-devid-failure.mjs",
                "/cadr-web/wasm/cadr-m9-pointer.mjs",
                "/cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
                "/cadr-web/wasm/cadr-m8-m9-campaign.mjs",
                "/cadr-web/wasm/cadr-m8-m9-transaction.mjs",
                "/cadr-web/wasm/cadr-m8-keyboard.mjs",
                "/cadr-web/wasm/cadr-m11-audio.mjs",
                "/cadr-web/wasm/cadr-m12-debugger.mjs",
                "/cadr-web/wasm/cadr-m13-audio-source.mjs",
                "/cadr-web/build/cadr-web-m13-audio-O2.wasm",
            }
            self.assertEqual(set(Handler.requests), expected_paths)
            self.assertEqual(errors, [], errors)
            browser.close()


if __name__ == "__main__":
    unittest.main()
