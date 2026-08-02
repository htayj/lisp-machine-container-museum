"""Chromium composition evidence for selected ABI1.11 audio authority.

The selected worker/core queue is empty. Two records are explicitly synthetic
downstream fixtures; this test therefore does not claim selected guest playback.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib, json, os
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BROWSER = ROOT / "cadr-web" / "browser"
WASM = ROOT / "cadr-web" / "wasm"
SELECTED = ROOT / "cadr-web" / "build" / "cadr-web-m13-audio-O2.wasm"
SELECTED_SHA256 = "11794b191dd355e6577133f293b591f065bb695b07ff0b3c41c2597c8c6bcd35"

class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path.startswith("/cadr-web/browser/"):
            target = BROWSER / path.removeprefix("/cadr-web/browser/")
        elif path.startswith("/cadr-web/wasm/"):
            target = WASM / path.removeprefix("/cadr-web/wasm/")
        elif path == "/cadr-web/build/cadr-web-m13-audio-O2.wasm":
            target = SELECTED
        else:
            target = None
        if target is None or not target.is_file():
            self.send_response(404); self.end_headers(); return
        body = target.read_bytes()
        mime = "application/wasm" if target.suffix == ".wasm" else (
            "text/html; charset=utf-8" if target.suffix == ".html" else "text/javascript; charset=utf-8")
        self.send_response(200); self.send_header("Content-Type", mime)
        self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def log_message(self, _format: str, *_args: object) -> None: return

class SelectedAudioRuntime(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not SELECTED.is_file(): raise RuntimeError("build selected ABI1.11 O2 Wasm first")
        if hashlib.sha256(SELECTED.read_bytes()).hexdigest() != SELECTED_SHA256:
            raise RuntimeError("selected ABI1.11 O2 Wasm identity differs")
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_port}"
    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown(); cls.thread.join(timeout=3); cls.server.server_close()
    def test_selected_worker_shell_real_worklet_with_labelled_synthetic_pcm(self) -> None:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium",
                args=["--disable-background-networking"])
            page = browser.new_page(); errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{self.origin}/cadr-web/browser/cadr-m13-selected-audio-runtime.html")
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime !== undefined")
            identity = page.evaluate("() => window.cadrM13SelectedAudioRuntime.ready")
            self.assertEqual(identity["wasmSha256"], hashlib.sha256(SELECTED.read_bytes()).hexdigest())
            page.locator("#start-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().publicResults.at(-1)?.audio?.consumerEpoch === '2'")
            page.locator("#pause-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().publicResults.at(-1)?.audio?.state === 'PAUSED'")
            page.locator("#resume-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().publicResults.at(-1)?.audio?.consumerEpoch === '3'")
            page.locator("#inject-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().shellStatuses.filter(x => x === 'CADR audio device lost; unacknowledged audio retained').length === 1", timeout=10000)
            page.locator("#resume-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().publicResults.at(-1)?.audio?.consumerEpoch === '4'")
            page.locator("#inject-audio").click()
            page.wait_for_function("() => window.cadrM13SelectedAudioRuntime.state().shellStatuses.filter(x => x === 'CADR audio device lost; unacknowledged audio retained').length === 2", timeout=10000)
            result = page.evaluate("() => window.cadrM13SelectedAudioRuntime.state()")
            self.assertEqual(result["activationAtPrepare"], [True, True, True])
            self.assertEqual([item["frames"] for item in result["injected"]], [512, 88])
            self.assertEqual([item["sequence"] for item in result["injected"]], ["10", "11"])
            self.assertEqual([item["consumerEpoch"] for item in result["injected"]], ["3", "4"])
            self.assertEqual(len({item["recordSha256"] for item in result["injected"]}), 2)
            self.assertTrue(all(item["origin"] == "synthetic-downstream-fixture" for item in result["injected"]))
            expected_worker_order = ["m13-audio-open", "m13-audio-pause", "m13-audio-open",
                "m13-audio-ack", "m13-audio-device-lost", "m13-audio-open",
                "m13-audio-ack", "m13-audio-device-lost"]
            worker_requests = [item for item in result["workerRequests"]
                if item.get("op", "").startswith("m13-audio")]
            worker_responses = [item for item in result["workerResponses"]
                if item.get("op", "").startswith("m13-audio")]
            self.assertEqual([item["op"] for item in worker_requests], expected_worker_order)
            self.assertEqual([item["op"] for item in worker_responses], expected_worker_order)
            self.assertEqual([item["sequence"] for item in worker_requests
                if item["op"] == "m13-audio-ack"], ["10", "11"])
            self.assertEqual([item["status"] for item in worker_responses
                if item["op"] == "m13-audio-ack"], [3, 3])
            self.assertEqual([item["status"] for item in worker_responses
                if item["op"] == "m13-audio-device-lost"], [0, 0])
            self.assertEqual([item["lifecycle"] for item in worker_responses], ["NEW"] * 8)
            self.assertEqual([item["op"] for item in result["publicResults"]],
                ["bootstrap", "audio-open", "audio-pause", "audio-resume", "audio-resume"])
            self.assertEqual([item.get("consumerEpoch") for item in
                [value.get("audio", {}) for value in result["publicResults"]]],
                [None, "2", "2", "3", "4"])
            self.assertEqual(result["shellStatuses"], ["CADR audio ready",
                "CADR audio device lost; unacknowledged audio retained", "CADR audio ready",
                "CADR audio device lost; unacknowledged audio retained"])
            self.assertTrue(all(item["sampleRate"] > 0 for item in result["contexts"]))
            self.assertEqual(len(result["contexts"]), 3)
            self.assertTrue(all(item["disconnected"] for item in result["contexts"]))
            self.assertEqual(errors, [])
            report = {"schema": "cadr-m13-selected-audio-runtime-v1",
                "baseCommit": "779812aff56a030a208d23fef925aa55e4c27d37",
                "chromiumVersion": browser.version,
                "wasm": identity, "observation": result,
                "claims": {"selectedWorkerWasmShellWorklet": True, "selectedGuestGeneratedPcm": False,
                    "syntheticDownstreamPcm": True, "cM11Closed": False}}
            output = os.environ.get("CADR_M13_AUDIO_RUNTIME_REPORT")
            if output:
                target = Path(output).resolve()
                report_root = (ROOT / "build" / "cadr-m13").resolve()
                if not target.is_relative_to(report_root):
                    raise RuntimeError("selected audio report must remain under ignored build/cadr-m13")
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_suffix(target.suffix + ".tmp")
                temporary.write_text(json.dumps(report, sort_keys=True, indent=2) + "\n")
                temporary.replace(target)
            page.evaluate("() => window.cadrM13SelectedAudioRuntime.dispose()")
            browser.close()

if __name__ == "__main__": unittest.main()
