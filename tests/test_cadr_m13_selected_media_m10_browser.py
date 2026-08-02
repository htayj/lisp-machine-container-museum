"""Chromium probe of the public v8 selected-media/M10 mount and bridge.

The selected System 303 inputs are untracked local preservation inputs.  This
server exposes their exact fixed identities only for this disposable test and
never materializes the 269 MiB base in the repository or browser page source.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime
import os
import hashlib
import json
from pathlib import Path
import subprocess
from threading import Thread
from urllib.parse import urlsplit
import unittest

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / "cadr-web" / "browser"
WASM = ROOT / "cadr-web" / "wasm"
BUILD = ROOT / "cadr-web" / "build"
INPUT_ROOT = Path(os.environ["CADR_M13_SELECTED_INPUT_DIR"]).resolve() if os.environ.get(
    "CADR_M13_SELECTED_INPUT_DIR") else None
BASE = (INPUT_ROOT / "disk-sys-303-0.img") if INPUT_ROOT else ROOT / "l" / "usim" / "disk-sys-303-0.img"
SMALL = {
    "/cadr-web/profiles/cadr-web-303.ini.in": (INPUT_ROOT / "cadr-web-303.ini.in") if INPUT_ROOT else ROOT / "cadr-web" / "profiles" / "cadr-web-303.ini.in",
    "/l/sys/ubin/promh.mcr": (INPUT_ROOT / "promh.mcr") if INPUT_ROOT else ROOT / "l" / "sys" / "ubin" / "promh.mcr",
    "/l/sys/ubin/promh.sym": (INPUT_ROOT / "promh.sym") if INPUT_ROOT else ROOT / "l" / "sys" / "ubin" / "promh.sym",
    "/l/sys/ubin/ucadr.sym": (INPUT_ROOT / "ucadr.sym") if INPUT_ROOT else ROOT / "l" / "sys" / "ubin" / "ucadr.sym",
}
SELECTED_WASM = BUILD / "cadr-web-m13-audio-O2.wasm"
SELECTED_WASM_SHA256 = "11794b191dd355e6577133f293b591f065bb695b07ff0b3c41c2597c8c6bcd35"
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
        elif path == "/cadr-web/build/cadr-web-m13-audio-O2.wasm":
            target = SELECTED_WASM; mime = "application/wasm"
        else:
            target = SMALL.get(path); mime = "application/octet-stream"
        allowed_parents = {
                BROWSER.resolve(), WASM.resolve(), (ROOT / "cadr-web" / "profiles").resolve(),
                (ROOT / "l" / "sys" / "ubin").resolve(), BUILD.resolve()}
        if INPUT_ROOT is not None:
            allowed_parents.add(INPUT_ROOT)
        if target is None or not target.is_file() or target.resolve().parent not in allowed_parents:
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
    @staticmethod
    def _digest(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @classmethod
    def setUpClass(cls) -> None:
        if os.environ.get("CADR_M13_RUN_SELECTED_MEDIA") != "1":
            raise unittest.SkipTest(
                "set CADR_M13_RUN_SELECTED_MEDIA=1 to use local selected System 303 inputs")
        required = [SELECTED_WASM, BASE, *SMALL.values()]
        missing = [str(path) for path in required if not path.is_file()]
        if missing:
            raise RuntimeError("selected-media browser witness needs local inputs: " + ", ".join(missing))
        if cls._digest(SELECTED_WASM) != SELECTED_WASM_SHA256:
            raise RuntimeError("selected-media browser witness Wasm identity differs")
        if cls._digest(BASE) != "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5":
            raise RuntimeError("selected-media browser witness base identity differs")
        cls.input_paths = {"base": BASE, "wasm": SELECTED_WASM,
                           **{path.rsplit("/", 1)[-1]: value for path, value in SMALL.items()}}
        cls.before = {role: {"bytes": path.stat().st_size, "sha256": cls._digest(path)}
                      for role, path in cls.input_paths.items()}
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start(); cls.origin = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()

    def test_public_v8_selected_media_mount_reaches_real_m10_host_service(self) -> None:
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
            self.assertEqual(result["service"]["workerLifecycleAfterHostComplete"], "RUNNING")
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
            self.assertEqual(result["reopenReadback"]["publicReopenStatus"], 0)
            synthetic = result["syntheticChangedPersistence"]
            self.assertEqual(synthetic["origin"], "synthetic-controller-write-after-public-mount")
            self.assertTrue(synthetic["writeChanged"])
            self.assertTrue(synthetic["immediateReadMatches"])
            self.assertEqual(synthetic["changedPublicReopenStatus"], 0)
            self.assertTrue(synthetic["changedReopenMatches"])
            self.assertEqual(synthetic["finalPublicReopenStatus"], 0)
            self.assertTrue(synthetic["finalReadMatches"])
            adapter = result["testAdapterArchiveRoundtrip"]
            self.assertEqual(adapter["adapterProfile"],
                             "M13-E27-CDRM10W1-DISPATCH-ADAPTER-v1")
            self.assertEqual(adapter["archiveFormat"], "CDRM10W1")
            self.assertTrue(adapter["publicOperationDispatchOnly"])
            self.assertFalse(adapter["normativePinnedObjectExportRecords"])
            self.assertFalse(adapter["compositePausedResetRestore"])
            self.assertEqual(adapter["workerLifecycleAfterHostComplete"], "RUNNING")
            self.assertEqual(adapter["dispatchExportOpenStatus"], 0)
            self.assertGreater(adapter["exportChunkCount"], 0)
            self.assertGreater(adapter["archiveBytes"], 0)
            self.assertRegex(adapter["archiveSha256"], r"^[0-9a-f]{64}$")
            self.assertEqual(adapter["dispatchExportCloseStatus"], 0)
            self.assertEqual(adapter["malformedRestoreFinishStatus"], 7)
            self.assertTrue(adapter["malformedRoundtripPreservedOverlay"])
            self.assertEqual(adapter["validRestoreFinishStatus"], 0)
            self.assertTrue(adapter["validRoundtrip"])
            self.assertFalse(adapter["adopted"])
            self.assertTrue(adapter["roundtripPreservedOverlay"])
            self.assertEqual(adapter["controllerState"], "CLEAN")
            self.assertEqual(adapter["replacementCount"], 0)
            self.assertEqual(result["baseBytes"], 269562880)
            self.assertEqual(result["baseSha256"], "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5")
            self.assertTrue(result["basePage0"])
            self.assertTrue(result["baseIdentityBound"])
            self.assertEqual(result["profileSha256"],
                             "58ea88164b0156f8dbcd83f172d0e2b3e641f44575aa1473793745b97a7efdf6")
            self.assertEqual(result["artifactSetSha256"],
                             "54417f58ecda7074b97ac88265b88c376dbde5f2367bc69f59783209435594ba")
            self.assertEqual(result["forbiddenRunOperations"], [])
            self.assertIn("scheduler-run-v7-slice", result["lowerOperations"])
            self.assertNotIn("scheduler-run", result["lowerOperations"])
            self.assertFalse(any(operation in {"run", "run-digest-batch", "run-digest-batch-v3", "run-digest-batch-m4"}
                                 for operation in result["lowerOperations"]))
            self.assertGreaterEqual(len(Handler.base_ranges), 260)
            self.assertTrue(all(path in Handler.requests for path in SMALL))
            self.assertIn("/cadr-web/build/cadr-web-m13-audio-O2.wasm", Handler.requests)
            self.assertEqual(errors, [], errors)
            after = {role: {"bytes": path.stat().st_size, "sha256": self._digest(path)}
                     for role, path in self.input_paths.items()}
            self.assertEqual(after, self.before, "selected source inputs changed during runtime probe")
            report_path_text = os.environ.get("CADR_M13_SELECTED_REPORT")
            if report_path_text:
                report_path = Path(report_path_text).resolve()
                report_root = (ROOT / "build" / "cadr-m13").resolve()
                if not report_path.is_relative_to(report_root):
                    raise RuntimeError("selected M13 report must remain under ignored build/cadr-m13")
                report_path.parent.mkdir(parents=True, exist_ok=True)
                source_paths = {
                    "shell": BROWSER / "cadr-m13-shell.mjs",
                    "browserHarness": BROWSER / "cadr-m13-selected-media-m10-browser.mjs",
                    "browserTest": Path(__file__),
                    "worker": WASM / "cadr-worker.js",
                }
                report = {
                    "schema": "cadr-m13-public-selected-runtime-v1",
                    "recordedAt": datetime.now().astimezone().isoformat(),
                    "baseCommit": subprocess.check_output(
                        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                    "baseTree": subprocess.check_output(
                        ["git", "rev-parse", "HEAD^{tree}"], cwd=ROOT, text=True).strip(),
                    "sourceIdentities": {name: {"bytes": path.stat().st_size,
                                                 "sha256": self._digest(path)}
                                         for name, path in source_paths.items()},
                    "selectedInputs": {role: {**identity, "unchanged": identity == after[role]}
                                       for role, identity in self.before.items()},
                    "chromiumVersion": browser.version,
                    "publicResult": result,
                    "httpObservation": {"requestCount": len(Handler.requests),
                                        "baseRangeCount": len(Handler.base_ranges)},
                    "rightsBoundary": {"licensedBytesEmbedded": False,
                                       "privatePathsEmbedded": False,
                                       "syntheticChangedWrite": True,
                                       "guestGeneratedChangedWrite": False,
                                       "normativePinnedObjectExportProven": False,
                                       "compositePausedResetRestoreProven": False},
                }
                temporary = report_path.with_suffix(report_path.suffix + ".tmp")
                temporary.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
                temporary.replace(report_path)
            browser.close()


if __name__ == "__main__":
    unittest.main()
