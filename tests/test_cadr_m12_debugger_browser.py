"""Real-browser accessibility/protocol probe for the scalar C-M12 inspector.

This serves only the generated M12 Wasm and the browser/worker modules needed by
the page.  It is not a System 303 boot, a provenance observation, or a claim
about the historical console debugger.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ALLOWED_PREFIXES = ("/cadr-web/browser/", "/cadr-web/wasm/", "/cadr-web/build/")


class Handler(BaseHTTPRequestHandler):
    requests: list[str] = []

    def log_message(self, _format: str, *_args: object) -> None:
        pass

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = self.path.split("?", 1)[0]
        type(self).requests.append(path)
        if not path.startswith(ALLOWED_PREFIXES) or ".." in path:
            self.send_error(404)
            return
        file_path = (ROOT / path.lstrip("/")).resolve()
        if not file_path.is_file() or ROOT not in file_path.parents:
            self.send_error(404)
            return
        content_type = "application/wasm" if file_path.suffix == ".wasm" else (
            "text/html; charset=utf-8" if file_path.suffix == ".html" else
            "text/javascript; charset=utf-8")
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; "
                         "worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)


class CadrM12DebuggerBrowserTest(unittest.TestCase):
    def test_keyboard_reachable_lower_controls_and_p2_inventory(self) -> None:
        wasm = ROOT / "cadr-web/build/cadr-web-m12-O0.wasm"
        self.assertTrue(wasm.is_file(), "build the M12 O0 module before this browser probe")
        Handler.requests = []
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True, executable_path="/usr/bin/chromium",
                    args=["--disable-background-networking"])
                page = browser.new_page()
                browser_messages: list[str] = []
                page.on("console", lambda message: browser_messages.append(
                    f"console {message.type}: {message.text}"))
                page.on("pageerror", lambda error: browser_messages.append(
                    f"pageerror: {error}"))
                page.goto(
                    f"http://127.0.0.1:{server.server_port}/cadr-web/browser/cadr-m12-debugger-browser.html",
                    wait_until="domcontentloaded")
                try:
                    page.locator("#cadr-m12-debugger-status").wait_for(timeout=15000)
                except Exception as error:
                    raise AssertionError(
                        f"C-M12 inspector page did not mount: {browser_messages}; "
                        f"body={page.locator('body').text_content()!r}") from error
                # Keyboard navigation reaches the named scalar read control;
                # activation must yield only its copied u32 result.
                page.locator("#cadr-m12-inspector-array").select_option("1")
                page.locator("#cadr-m12-inspector-index").fill("0")
                page.locator("button", has_text="Read word").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-inspector-value")).to_have_text(
                    "A memory[0] = 0x00000000 (generation 1)", timeout=15000)
                page.locator("#cadr-m12-apply-trace-filter").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-debugger-status")).to_contain_text(
                    "Trace filter installed", timeout=15000)
                # The P2 host-control inventory is present in the
                # same keyboard order. This v7 generated fixture exercises
                # the lower breakpoint controls only; production review is
                # deliberately disabled without its additive receipt.
                page.locator("button", has_text="Set breakpoint").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-debugger-status")).to_have_text(
                    "Breakpoint installed.", timeout=15000)
                page.locator("button", has_text="Micro-step").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-debugger-status")).to_contain_text(
                    "stop is ready for review", timeout=15000)
                page.locator("button", has_text="Resume one boundary").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-debugger-status")).to_have_text(
                    "One-boundary breakpoint suppression armed.", timeout=15000)
                page.locator("button", has_text="Clear breakpoint").focus()
                page.keyboard.press("Enter")
                expect(page.locator("#cadr-m12-debugger-status")).to_have_text(
                    "Breakpoint cleared.", timeout=15000)
                expect(page.locator("button", has_text="Prepare paused review")).to_be_disabled()
                expect(page.locator(
                    "button", has_text="Export reviewed snapshot and diagnostic")).to_be_disabled()
                expect(page.locator("button", has_text="Discard reviewed snapshot")).to_be_disabled()
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
        self.assertTrue(any(path.endswith("cadr-web-m12-O0.wasm") for path in Handler.requests))
        unexpected = [path for path in Handler.requests
                      if path != "/favicon.ico" and not path.startswith(ALLOWED_PREFIXES)]
        self.assertEqual(unexpected, [])


if __name__ == "__main__":
    unittest.main()
