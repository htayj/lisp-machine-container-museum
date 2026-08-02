"""Chromium probe of the public v8 selected-media/M10 mount and bridge.

The selected System 303 inputs are untracked local preservation inputs.  This
server exposes their exact fixed identities only for this disposable test and
never materializes the 269 MiB base in the repository or browser page source.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import hashlib
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / "cadr-web" / "browser"
WASM = ROOT / "cadr-web" / "wasm"
BUILD = ROOT / "cadr-web" / "build"
BASE = ROOT / "l" / "usim" / "disk-sys-303-0.img"
SMALL = {
    "/cadr-web/profiles/cadr-web-303.ini.in": ROOT / "cadr-web" / "profiles" / "cadr-web-303.ini.in",
    "/l/sys/ubin/promh.mcr": ROOT / "l" / "sys" / "ubin" / "promh.mcr",
    "/l/sys/ubin/promh.sym": ROOT / "l" / "sys" / "ubin" / "promh.sym",
    "/l/sys/ubin/ucadr.sym": ROOT / "l" / "sys" / "ubin" / "ucadr.sym",
}
SELECTED_WASM = BUILD / "cadr-web-m12-O2.wasm"
SELECTED_WASM_SHA256 = "42e1e7d37ac1b1cc3dabf5b22a38bc81702c1b1f45b6da8bf31f0ddb249a40e0"
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; "
       "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; "
       "frame-ancestors 'none'")


class Handler(BaseHTTPRequestHandler):
    requests: list[str] = []
    base_ranges: list[str] = []

    def _headers(self, status: int, mime: str, length: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(length))

    def _range_base(self) -> None:
        supplied = self.headers.get("Range")
        if supplied is None or not supplied.startswith("bytes=") or "," in supplied:
            self._headers(416, "text/plain; charset=utf-8", 0); self.end_headers(); return
        try:
            start_text, end_text = supplied.removeprefix("bytes=").split("-", 1)
            start = int(start_text); end = int(end_text)
        except ValueError:
            self._headers(416, "text/plain; charset=utf-8", 0); self.end_headers(); return
        size = BASE.stat().st_size
        if start < 0 or end < start or end >= size or end - start + 1 > 1048576:
            self._headers(416, "text/plain; charset=utf-8", 0); self.end_headers(); return
        Handler.base_ranges.append(supplied)
        with BASE.open("rb") as source:
            source.seek(start); body = source.read(end - start + 1)
        self._headers(206, "application/octet-stream", len(body))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers(); self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        Handler.requests.append(path)
        if path == "/l/usim/disk-sys-303-0.img":
            self._range_base(); return
        if path == "/cadr-web/browser/cadr-m13-selected-media-m10-browser.html":
            target = BROWSER / "cadr-m13-selected-media-m10-browser.html"; mime = "text/html; charset=utf-8"
        elif path.startswith("/cadr-web/browser/") and path.endswith(".mjs"):
            target = BROWSER / path.removeprefix("/cadr-web/browser/"); mime = "text/javascript; charset=utf-8"
        elif path.startswith("/cadr-web/wasm/") and path.endswith((".js", ".mjs")):
            target = WASM / path.removeprefix("/cadr-web/wasm/"); mime = "text/javascript; charset=utf-8"
        elif path == "/cadr-web/build/cadr-web-m12-O2.wasm":
            target = SELECTED_WASM; mime = "application/wasm"
        else:
            target = SMALL.get(path); mime = "application/octet-stream"
        if target is None or not target.is_file() or target.resolve().parent not in {
                BROWSER.resolve(), WASM.resolve(), (ROOT / "cadr-web" / "profiles").resolve(),
                (ROOT / "l" / "sys" / "ubin").resolve(), BUILD.resolve()}:
            self._headers(404, "text/plain; charset=utf-8", 0); self.end_headers(); return
        body = target.read_bytes()
        self._headers(200, mime, len(body)); self.end_headers(); self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


class CadrM13SelectedMediaSourceWiringTest(unittest.TestCase):
    def test_selected_factory_passes_its_existing_storage_boundary(self) -> None:
        """Runs without licensed media and catches the constructor regression."""
        source = (BROWSER / "cadr-m13-selected-media-m10-browser.mjs").read_text()
        constructor = source.split("const shell = new CadrM13Shell({", 1)[1].split("});", 1)[0]
        self.assertRegex(constructor, r"\bworker\s*,\s*storage\s*,\s*baseMediaBinding:")
        self.assertIn("selectedWasmSha256: SELECTED_WASM_SHA256", constructor)


class CadrM13SelectedMediaM10BrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if os.environ.get("CADR_M13_RUN_SELECTED_MEDIA") != "1":
            raise unittest.SkipTest(
                "set CADR_M13_RUN_SELECTED_MEDIA=1 to use local selected System 303 inputs")
        required = [SELECTED_WASM, BASE, *SMALL.values()]
        missing = [str(path) for path in required if not path.is_file()]
        if missing:
            raise RuntimeError("selected-media browser witness needs local inputs: " + ", ".join(missing))
        if hashlib.sha256(SELECTED_WASM.read_bytes()).hexdigest() != SELECTED_WASM_SHA256:
            raise RuntimeError("selected-media browser witness Wasm identity differs")
        digest = hashlib.sha256()
        with BASE.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5":
            raise RuntimeError("selected-media browser witness base identity differs")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start(); cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()

    def test_selected_v7_media_mount_reaches_real_m10_host_service(self) -> None:
        Handler.requests = []; Handler.base_ranges = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page(); page.set_default_timeout(180000)
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-selected-media-m10-browser.html",
                      wait_until="domcontentloaded")
            page.wait_for_function("() => window.cadrM13SelectedMediaM10Harness !== undefined", timeout=180000)
            result = page.evaluate("() => window.cadrM13SelectedMediaM10Harness")
            self.assertNotIn("error", result, result.get("error"))
            expect(page.locator("#cadr-m13-selected-media-m10-status")).to_have_text(
                "Selected M12 media mount and M10 host-request probe passed.")
            self.assertEqual(result["bootstrapStatus"], 0)
            self.assertEqual(result["mountStatus"], 0)
            self.assertEqual(result["baseImport"]["beginStatus"], 0)
            self.assertEqual(result["baseImport"]["chunkCount"], 258)
            self.assertEqual(result["baseImport"]["finishStatus"], 0)
            self.assertEqual(result["baseImport"]["mountStatus"], 0)
            self.assertEqual(result["baseImport"]["m10ReopenStatus"], 0)
            self.assertEqual(result["baseBindingState"], "MOUNTED")
            self.assertEqual(result["coldStatus"], 0); self.assertEqual(result["bootStatus"], 0)
            self.assertEqual(result["visibilityStatus"], 0); self.assertEqual(result["startStatus"], 0)
            self.assertEqual(result["hostWaits"], 1)
            self.assertGreater(result["batches"], 0); self.assertLessEqual(result["batches"], 300)
            self.assertEqual(result["waitSlice"]["lifecycle"], "WAITING_FOR_HOST")
            self.assertGreater(int(result["waitSlice"]["completedSlots"]), 0)
            self.assertGreaterEqual(int(result["waitSlice"]["microinstructionsExecuted"]), 0)
            self.assertEqual(result["waitSequence"], ["scheduler-run-v7-slice", "host-next-request", "host-complete"])
            self.assertEqual(result["service"]["operation"], "write")
            self.assertEqual(result["service"]["firstBlock"], "1")
            self.assertEqual(result["service"]["blockCount"], 1)
            self.assertTrue(result["service"]["durable"])
            self.assertFalse(result["service"]["changed"])
            self.assertEqual(result["controllerState"], "CLEAN")
            self.assertEqual(result["replacementCount"], 0)
            self.assertEqual(result["reopenReadback"]["firstBlock"], "1")
            self.assertEqual(result["reopenReadback"]["byteCount"], 1024)
            self.assertRegex(result["reopenReadback"]["sha256"], r"^[0-9a-f]{64}$")
            self.assertFalse(result["reopenReadback"]["commitChanged"])
            self.assertTrue(result["reopenReadback"]["matchesSelectedBase"])
            self.assertTrue(result["reopenReadback"]["matchesBeforeClose"])
            self.assertEqual(result["reopenReadback"]["controllerState"], "CLEAN")
            self.assertEqual(result["reopenReadback"]["replacementCount"], 0)
            self.assertEqual(result["baseBytes"], 269562880)
            self.assertEqual(result["baseSha256"], "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5")
            self.assertTrue(result["basePage0"])
            self.assertTrue(result["baseIdentityBound"])
            self.assertEqual(result["profileSha256"],
                             "58ea88164b0156f8dbcd83f172d0e2b3e641f44575aa1473793745b97a7efdf6")
            self.assertEqual(result["artifactSetSha256"],
                             "deddd6ff5bc626c1d62b354a28e757a638b6f824915df9b0c783fed5ebfc482a")
            self.assertEqual(result["forbiddenRunOperations"], [])
            self.assertIn("scheduler-run-v7-slice", result["lowerOperations"])
            self.assertNotIn("scheduler-run", result["lowerOperations"])
            self.assertFalse(any(operation in {"run", "run-digest-batch", "run-digest-batch-v3", "run-digest-batch-m4"}
                                 for operation in result["lowerOperations"]))
            self.assertGreaterEqual(len(Handler.base_ranges), 260)
            self.assertTrue(all(path in Handler.requests for path in SMALL))
            self.assertIn("/cadr-web/build/cadr-web-m12-O2.wasm", Handler.requests)
            self.assertEqual(errors, [], errors)
            browser.close()


if __name__ == "__main__":
    unittest.main()
