"""Chromium evidence for M13's narrow real-IndexedDB review adapter.

The served namespace has a synthetic base and no CADR worker, selected media, or
runtime artifact.  It proves only the adapter's binding, review-pin, lifecycle,
digest-cursor, and self-only browser boundaries.
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
    "/cadr-web/browser/cadr-m13-m10-review-adapter-browser.html": "text/html; charset=utf-8",
    "/cadr-web/browser/cadr-m13-m10-review-adapter-browser.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m13-m10-review-adapter.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m10-controller.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/browser/cadr-m10-indexeddb.mjs": "text/javascript; charset=utf-8",
    "/cadr-web/wasm/cadr-m10-persistence.mjs": "text/javascript; charset=utf-8",
}
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; "
       "worker-src 'none'; img-src 'none'; media-src 'none'; object-src 'none'; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'none'")


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


class CadrM13M10ReviewAdapterBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()

    def test_real_chromium_indexeddb_adapter_fences_binding_pin_and_cursor(self) -> None:
        Handler.requests = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            context = browser.new_context()
            page = context.new_page()
            errors: list[str] = []
            sockets: list[object] = []
            cdp = context.new_cdp_session(page)
            network: list[dict[str, object]] = []
            cdp.send("Network.enable")
            cdp.on("Network.requestWillBeSent", lambda event: network.append(event["request"]))
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("websocket", lambda socket: sockets.append(socket))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-m10-review-adapter-browser.html",
                      wait_until="domcontentloaded")
            page.wait_for_function("() => window.cadrM13M10ReviewAdapterHarness !== undefined")
            result = page.evaluate("() => window.cadrM13M10ReviewAdapterHarness")
            self.assertNotIn("error", result, result.get("error"))
            expect(page.locator("#cadr-m13-m10-review-adapter-status")).to_have_text(
                "M13 M10 review-adapter probe passed.")
            self.assertTrue(result["openingBindingCopied"])
            self.assertEqual(result["initialReferenceCount"], 1)
            self.assertEqual(result["invalidatedReferenceCount"], 0)
            self.assertTrue(result["cursorRejected"])
            self.assertTrue(result["reopenRejected"])
            self.assertEqual(result["replacementCount"], 1)
            self.assertEqual(result["invalidatedPhase"], "INVALIDATED")
            self.assertEqual(result["freshControllerState"], "CLEAN")
            self.assertEqual(result["freshDisposedPhase"], "DISPOSED")
            self.assertGreater(int(result["reviewArchiveBytes"]), 0)
            self.assertRegex(result["reviewArchiveSha256"], r"^[0-9a-f]{64}$")
            self.assertTrue(result["replacementFailureRejected"])
            self.assertEqual(result["replacementFailureReferenceCount"], 1)
            self.assertEqual(result["replacementRetryReferenceCount"], 0)
            self.assertEqual(result["replacementRetryCount"], 2)
            self.assertEqual(result["replacementRetryPhase"], "INVALIDATED")
            self.assertTrue(result["unpinFailureRejected"])
            self.assertEqual(result["unpinFailureReferenceCount"], 1)
            self.assertEqual(result["unpinRetryReferenceCount"], 0)
            self.assertEqual(result["unpinRetryCount"], 2)
            self.assertEqual(result["unpinRetryPhase"], "DISPOSED")
            self.assertTrue(result["postCommitUnpinRejected"])
            self.assertEqual(result["postCommitUnpinReferenceCount"], 0)
            self.assertEqual(result["postCommitUnpinRetryReferenceCount"], 0)
            self.assertEqual(result["postCommitUnpinRetryCount"], 2)
            self.assertEqual(result["postCommitUnpinRetryPhase"], "DISPOSED")
            self.assertTrue(result["successfulRollbackRejected"])
            self.assertEqual(result["successfulRollbackReferenceCount"], 0)
            self.assertEqual(result["successfulRollbackUnpinAttempts"], 1)
            self.assertEqual(result["successfulRollbackRevokeCount"], 1)
            self.assertEqual(result["successfulRollbackCloseCount"], 1)
            self.assertEqual(result["successfulRollbackPhase"], "FAILED")
            self.assertTrue(result["beforePinRejected"])
            self.assertEqual(result["beforePinReferenceCount"], 0)
            self.assertEqual(result["beforePinReplacementCount"], 1)
            self.assertEqual(result["beforePinRevokeCount"], 1)
            self.assertGreaterEqual(result["beforePinCloseCount"], 1)
            self.assertEqual(result["beforePinPhase"], "INVALIDATED")
            self.assertTrue(result["continuityRejected"])
            self.assertTrue(result["continuityDisposeRejected"])
            self.assertEqual(result["continuityFailureReferenceCount"], 1)
            self.assertEqual(result["continuityCleanupFailureReferenceCount"], 1)
            self.assertEqual(result["continuityRecoveredReferenceCount"], 0)
            self.assertEqual(result["continuityCleanupUnpinAttempts"], 4)
            self.assertEqual(result["continuityRevokeCount"], 1)
            self.assertEqual(result["continuityPhase"], "FAILED")
            self.assertTrue(result["continuityPostCommitRejected"])
            self.assertEqual(result["continuityPostCommitReferenceCount"], 0)
            self.assertEqual(result["continuityPostCommitRetryReferenceCount"], 0)
            self.assertEqual(result["continuityPostCommitUnpinAttempts"], 3)
            self.assertEqual(result["continuityPostCommitRevokeCount"], 1)
            self.assertEqual(result["continuityPostCommitPhase"], "FAILED")
            self.assertTrue(result["leaseFreeReplacementRejected"])
            self.assertEqual(result["leaseFreeReplacementReferenceCount"], 0)
            self.assertTrue(result["leaseFreeReplacementCleanupRejected"])
            self.assertEqual(result["leaseFreeReplacementCleanupFailureReferenceCount"], 0)
            self.assertEqual(result["leaseFreeReplacementRetryReferenceCount"], 0)
            self.assertEqual(result["leaseFreeReplacementCount"], 2)
            self.assertEqual(result["leaseFreeRevokeCount"], 1)
            self.assertEqual(result["leaseFreeRevokeAttemptCount"], 2)
            self.assertEqual(result["leaseFreePhase"], "INVALIDATED")
            self.assertTrue(result["concurrentPromiseJoined"])
            self.assertTrue(result["concurrentResultJoined"])
            self.assertEqual(result["concurrentReferenceCount"], 0)
            self.assertEqual(result["concurrentReplacementCount"], 2)
            self.assertEqual(result["concurrentRevokeCount"], 1)
            self.assertEqual(result["concurrentCloseCount"], 1)
            self.assertEqual(result["concurrentPhase"], "INVALIDATED")
            self.assertTrue(result["concurrentFailurePromiseJoined"])
            self.assertTrue(result["concurrentFailureSameError"])
            self.assertEqual(result["concurrentFailureReferenceCount"], 1)
            self.assertEqual(result["concurrentFailureRetryReferenceCount"], 0)
            self.assertEqual(result["concurrentFailureReplacementCount"], 3)
            self.assertEqual(result["concurrentFailureRevokeCount"], 1)
            self.assertEqual(result["concurrentFailureCloseCount"], 1)
            self.assertEqual(result["concurrentFailurePhase"], "INVALIDATED")
            self.assertEqual(set(Handler.requests), set(FILES))
            self.assertEqual(errors, [], errors)
            self.assertEqual(sockets, [])
            self.assertTrue(network)
            self.assertTrue(all(request["url"].startswith(self.origin + "/") for request in network), network)
            context.close(); browser.close()


if __name__ == "__main__":
    unittest.main()
