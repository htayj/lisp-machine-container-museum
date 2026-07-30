"""Browser component evidence for M13 F15/F15b.

This uses one actual user click and a real Chromium AudioContext/AudioWorklet,
but only fixed public PCM.  It is deliberately not a C-M13 shell, selected Wasm,
or historical CADR sound run.
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
    "/cadr-web/browser/cadr-m13-audio-browser.html": "text/html; charset=utf-8",
    "/cadr-web/browser/cadr-m13-audio-browser.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m11-audio-bridge.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m11-audio-worklet.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-audio-reducer.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-audio-fault-worklet.mjs": "text/javascript; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        mime = FILES.get(path)
        if mime is None:
            self.send_response(404)
            self.end_headers()
            return
        body = (ROOT / path.lstrip("/")).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class CadrM13AudioBrowserTest(unittest.TestCase):
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

    def test_direct_click_audio_worklet_and_browser_task_reducer(self) -> None:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page()
            page_errors: list[str] = []
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-audio-browser.html",
                      wait_until="domcontentloaded")
            status = page.locator("#cadr-m13-audio-status")
            expect(status).to_have_text("Audio is stopped.")
            # Playwright dispatches a browser click here; no autoplay bypass flag
            # is supplied to Chromium.
            page.locator("#cadr-m13-audio-start").click()
            page.wait_for_function(
                "() => window.cadrM13AudioBrowserHarness.state().acknowledgements === 1",
                timeout=10000)
            first = page.evaluate("() => window.cadrM13AudioBrowserHarness.state()")
            self.assertEqual(first["epoch"], "1")
            self.assertEqual(first["contextState"], "running")
            self.assertEqual(first["acknowledgements"], 1)
            self.assertEqual([entry["op"] for entry in first["trace"]],
                             ["audio-peek", "audio-render", "audio-ack", "audio-peek"])
            self.assertIn("AudioWorklet acknowledgement", first["status"])

            # This is the actual M11 Worklet queue, not the M13 reducer.  A
            # full 8,192-frame packet followed by another full packet must
            # report queue rejection rather than fabricate guest progress.
            backpressure = page.evaluate(
                "() => window.cadrM13AudioBrowserHarness.workletBackpressureProbe()")
            self.assertEqual(backpressure, {"rejected": 1, "frameLimit": 8192})

            reducer = page.evaluate("() => window.cadrM13AudioBrowserHarness.reducerBrowserTasks()")
            self.assertEqual(reducer["sameTask"], [{"kind": "device-lost", "cause": "device-error"}])
            self.assertEqual(reducer["separateTasks"], [{"kind": "device-lost", "cause": "reply-timeout"}])
            self.assertEqual(reducer["highWater"], {"accepted": [True] * 8 + [False], "queuedRecords": 8})

            closed = page.evaluate("() => window.cadrM13AudioBrowserHarness.closeAudio()")
            self.assertEqual(closed["contextState"], "closed")
            self.assertIn("no guest acknowledgement was invented", closed["status"])
            # A second explicit click is a fresh browser audio consumer epoch.
            page.locator("#cadr-m13-audio-start").click()
            page.wait_for_function(
                "() => window.cadrM13AudioBrowserHarness.state().acknowledgements === 2",
                timeout=10000)
            second = page.evaluate("() => window.cadrM13AudioBrowserHarness.state()")
            self.assertEqual(second["epoch"], "2")
            self.assertEqual(second["contextState"], "running")
            self.assertEqual(second["acknowledgements"], 2)
            page.evaluate("() => window.cadrM13AudioBrowserHarness.closeAudio()")

            # This click posts one record to a real Worklet port and closes the
            # context in the same user-activation task.  Bridge close fences a
            # late callback, so no synthetic core acknowledgement is possible.
            page.locator("#cadr-m13-audio-start-close").click()
            page.wait_for_function(
                "() => window.cadrM13AudioBrowserHarness.state().epoch === '3' && "
                "window.cadrM13AudioBrowserHarness.state().contextState === 'closed'")
            closed_after_post = page.evaluate("() => window.cadrM13AudioBrowserHarness.state()")
            self.assertEqual(closed_after_post["acknowledgements"], 2)

            # This module really throws from AudioWorkletProcessor.process();
            # Chromium must surface processorerror and the bridge must not ack.
            page.locator("#cadr-m13-audio-start-fault").click()
            page.wait_for_function(
                "() => window.cadrM13AudioBrowserHarness.state().trace.some(item => item.op === 'processorerror')",
                timeout=10000)
            fault = page.evaluate("() => window.cadrM13AudioBrowserHarness.state()")
            self.assertEqual(fault["epoch"], "4")
            self.assertEqual(fault["acknowledgements"], 2)
            self.assertIn("processor failed", fault["status"])
            page.evaluate("() => window.cadrM13AudioBrowserHarness.closeAudio()")
            self.assertEqual(page_errors, [], page_errors)
            browser.close()


if __name__ == "__main__":
    unittest.main()
