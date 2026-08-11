"""Real Chromium proof for the current source-only M13 P1 composition seam.

Only public synthetic Wasm and an identity-only base-stream binding are served.
The test intentionally excludes the removed M12 P2 fixture and all M10 adapter,
IndexedDB, selected-media, and preserved-runtime claims.
"""
from __future__ import annotations

import hashlib
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import shutil
from threading import Thread
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
REPORT_ENV = "CADR_M13_PRODUCTION_BROWSER_REPORT"
CSP = ("default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; "
       "connect-src 'self'; img-src 'none'; media-src 'none'; object-src 'none'; "
       "base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
IMPORT = re.compile(r"\b(?:import|export)\s+(?:[^\"'`;]*?\s+from\s+)?[\"'](\.[^\"']+)[\"']")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def module_closure(entry: Path) -> set[Path]:
    pending = [entry]
    seen: set[Path] = set()
    while pending:
        path = pending.pop().resolve()
        if path in seen:
            continue
        if ROOT not in path.parents:
            raise AssertionError(f"module escaped repository: {path}")
        seen.add(path)
        if path.suffix not in {".mjs", ".js"}:
            continue
        for match in IMPORT.finditer(path.read_text(encoding="utf-8")):
            candidate = (path.parent / match.group(1)).resolve()
            pending.append(candidate.with_suffix(".mjs") if candidate.suffix == "" else candidate)
    return seen


class Handler(BaseHTTPRequestHandler):
    routes: dict[str, tuple[bytes, str]] = {}

    def do_GET(self) -> None:  # noqa: N802
        route = self.routes.get(urlsplit(self.path).path)
        if route is None:
            self.send_response(404)
            self.send_header("Content-Security-Policy", CSP)
            self.end_headers()
            return
        body, mime = route
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


class CadrM13ProductionBrowserTest(unittest.TestCase):
    def test_real_worker_p1_public_synthetic_composition(self) -> None:
        fixture = ROOT / "build" / "cadr-m13" / f"production-browser-p1-{os.getpid()}"
        fixture.parent.mkdir(parents=True, exist_ok=True)
        server: ThreadingHTTPServer | None = None
        thread: Thread | None = None
        browser = None
        try:
            fixture.mkdir(mode=0o700)
            wasm = b"\x00asm\x01\x00\x00\x00"
            fixture_record = {"schema": "cadr-m13-production-browser-fixture-v2",
                              "disposition": "public-synthetic-not-selected-media",
                              "wasm": {"name": "synthetic-p1.wasm", "byteCount": len(wasm),
                                       "sha256": sha256(wasm)}}
            (fixture / "synthetic-p1.wasm").write_bytes(wasm)
            (fixture / "fixture.json").write_bytes(canonical_json_bytes(fixture_record))

            html = ROOT / "cadr-web/browser/cadr-m13-production-browser.html"
            browser_entry = ROOT / "cadr-web/browser/cadr-m13-production-browser.mjs"
            worker_entry = ROOT / "cadr-web/browser/cadr-m13-production-browser-worker.mjs"
            sources = module_closure(browser_entry) | module_closure(worker_entry) | {html}
            closure = {"schema": "cadr-m13-production-browser-closure-v2",
                       "disposition": "source-browser-closure-not-runtime-compatibility",
                       "files": [{"path": path.relative_to(ROOT).as_posix(), "byteCount": path.stat().st_size,
                                  "sha256": sha256(path.read_bytes())} for path in sorted(sources)]}
            routes: dict[str, tuple[bytes, str]] = {}
            for path in sources:
                route = "/" + path.relative_to(ROOT).as_posix()
                mime = "text/html; charset=utf-8" if path.suffix == ".html" else "text/javascript; charset=utf-8"
                routes[route] = (path.read_bytes(), mime)
            fixture_prefix = f"/fixture/{fixture.name}/"
            for name, mime in (("fixture.json", "application/json"), ("synthetic-p1.wasm", "application/wasm")):
                routes[f"{fixture_prefix}{name}"] = ((fixture / name).read_bytes(), mime)
            Handler.routes = routes
            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            origin = f"http://127.0.0.1:{server.server_port}"
            reports: dict[str, object] = {}

            def portable_path(value: str) -> str:
                return "/fixture/<session>/" + value[len(fixture_prefix):] if value.startswith(fixture_prefix) else value

            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium",
                                                     args=["--disable-background-networking"])
                browser_version = browser.version
                browser_cdp = browser.new_browser_cdp_session()
                browser_product = browser_cdp.send("Browser.getVersion")["product"]
                browser_cdp.detach()

                def open_scenario(delay: str | None = None):
                    page = browser.new_page()
                    requests: list[str] = []
                    page_errors: list[str] = []
                    nonlocal_requests: list[str] = []
                    page_websockets: list[str] = []
                    cdp_websockets: list[str] = []
                    cdp_nonlocal_requests: list[str] = []
                    cdp = page.context.new_cdp_session(page)
                    cdp.send("Network.enable")

                    def local_request(url: str) -> bool:
                        parsed = urlsplit(url)
                        return parsed.scheme == "http" and parsed.hostname == "127.0.0.1" and parsed.port == server.server_port

                    def record_request(request: object) -> None:
                        request_url = request.url
                        if not local_request(request_url):
                            nonlocal_requests.append(request_url)
                        requests.append(portable_path(urlsplit(request_url).path))

                    def record_cdp_request(event: dict[str, object]) -> None:
                        request_url = event["request"]["url"]
                        if not local_request(request_url):
                            cdp_nonlocal_requests.append(request_url)

                    page.on("request", record_request)
                    page.on("pageerror", lambda error: page_errors.append(str(error)))
                    page.on("websocket", lambda websocket: page_websockets.append(websocket.url))
                    cdp.on("Network.requestWillBeSent", record_cdp_request)
                    cdp.on("Network.webSocketCreated", lambda event: cdp_websockets.append(event["url"]))
                    suffix = f"&delay={delay}" if delay else ""
                    page.goto(f"{origin}/cadr-web/browser/cadr-m13-production-browser.html"
                              f"?fixture={fixture_prefix}{suffix}", wait_until="domcontentloaded")
                    page.wait_for_function("() => window.cadrM13ProductionBrowserHarness !== undefined || "
                                           "window.cadrM13ProductionBrowserFailure !== undefined", timeout=30000)
                    self.assertIsNone(page.evaluate("() => window.cadrM13ProductionBrowserFailure ?? null"))
                    self.assertEqual(page.evaluate("() => window.cadrM13ProductionBrowserHarness.app.state.phase"), "PAUSED")
                    return page, {"requests": requests, "pageErrors": page_errors, "nonlocalRequests": nonlocal_requests,
                                  "pageWebSockets": page_websockets, "cdpWebSockets": cdp_websockets,
                                  "cdpNonlocalRequests": cdp_nonlocal_requests, "cdp": cdp}

                def close_scenario(page: object, observation: dict[str, object]) -> None:
                    self.assertEqual(observation["nonlocalRequests"], [])
                    self.assertEqual(observation["pageWebSockets"], [])
                    self.assertEqual(observation["cdpWebSockets"], [])
                    self.assertEqual(observation["cdpNonlocalRequests"], [])
                    observation["cdp"].detach()
                    page.close()
                    self.assertTrue(page.is_closed())

                page, normal_network = open_scenario()
                self.assertEqual(page.evaluate("async () => (await window.cadrM13ProductionBrowserHarness.resume()).phase"), "RUNNING")
                self.assertEqual(page.evaluate("async () => (await window.cadrM13ProductionBrowserHarness.layoutRelease()).phase"), "PAUSED")
                self.assertEqual(page.evaluate("() => window.cadrM13ProductionBrowserHarness.stop().phase"), "STOPPED")
                normal = page.evaluate("async () => window.cadrM13ProductionBrowserHarness.report()")
                self.assertEqual(normal["appState"]["phase"], "STOPPED")
                self.assertEqual(normal["appWorkerCount"], 1)
                self.assertEqual(normal["appShellCount"], 1)
                self.assertEqual(normal["workerTerminations"], 1)
                self.assertEqual(normal["m10Disposition"], {"state": "CLEAN", "open": True, "readOnly": False})
                self.assertEqual(normal["mediaBinding"], {"disposition": "identity-only-one-byte-per-range-not-selected-base",
                                                           "phase": "MOUNTED", "reads": 258, "returnedBytes": 258})
                self.assertEqual(normal["nonclaims"], ["selected-media", "selected-runtime", "M12-P2", "M10-adapter",
                                                        "IndexedDB", "C-M13", "F-row-closure"])
                self.assertEqual(normal_network["pageErrors"], [])
                operations = [item["op"] for item in normal["requestLog"]]
                self.assertEqual(operations[:14], ["instantiate", "input", "import", "input", "import", "input", "import",
                                                   "input", "import", "stream-begin"] + ["stream-chunk"] * 4)
                self.assertEqual(operations.count("stream-chunk"), 258)
                self.assertIn("scheduler-start", operations)
                self.assertIn("scheduler-pause", operations)
                self.assertIn("display-full", operations)
                self.assertGreaterEqual(operations.count("pointer-neutralize"), 2)
                self.assertEqual([item["ordinal"] for item in normal["requestLog"]], list(range(1, len(operations) + 1)))
                self.assertEqual(normal["requestLogSha256"], sha256(json.dumps(normal["requestLog"], separators=(",", ":")).encode()))
                reports["normal"] = {"report": normal, "network": sorted(normal_network["requests"])}
                close_scenario(page, normal_network)

                delayed, delayed_network = open_scenario("scheduler-start")
                delayed.evaluate("() => { window.__resume = window.cadrM13ProductionBrowserHarness.resume(); }")
                delayed.wait_for_function("async () => (await window.cadrM13ProductionBrowserHarness.report()).requestLog"
                                          ".some(item => item.op === 'scheduler-start')")
                self.assertEqual(delayed.evaluate("() => window.cadrM13ProductionBrowserHarness.stop('delayed-start-stop').phase"), "STOPPED")
                self.assertEqual(delayed.evaluate("async () => (await window.__resume).phase"), "STOPPED")
                delayed_report = delayed.evaluate("async () => window.cadrM13ProductionBrowserHarness.report()")
                self.assertEqual(delayed_report["appState"]["phase"], "STOPPED")
                self.assertEqual(delayed_report["workerTerminations"], 1)
                self.assertEqual(delayed_network["pageErrors"], [])
                reports["delayedStop"] = {"report": delayed_report, "network": sorted(delayed_network["requests"])}
                close_scenario(delayed, delayed_network)

                loss_page, loss_network = open_scenario()
                loss_page.evaluate("() => window.cadrM13ProductionBrowserHarness.crashWorker()")
                loss_page.wait_for_function("() => ['FAILED', 'IN_DOUBT', 'RECOVERY_REQUIRED'].includes("
                                            "window.cadrM13ProductionBrowserHarness.app.state.phase)")
                loss_report = loss_page.evaluate("async () => window.cadrM13ProductionBrowserHarness.report()")
                self.assertEqual(loss_report["appState"]["phase"], "FAILED")
                self.assertEqual(loss_report["workerTerminations"], 1)
                self.assertEqual(loss_network["pageErrors"], [])
                reports["workerLoss"] = {"report": loss_report, "network": sorted(loss_network["requests"])}
                close_scenario(loss_page, loss_network)

                browser.close()
                self.assertFalse(browser.is_connected())
                browser = None

            server.shutdown()
            thread.join(timeout=3)
            self.assertFalse(thread.is_alive(), "fixture HTTP thread did not stop")
            server.server_close()
            server = None
            shutil.rmtree(fixture)
            self.assertFalse(fixture.exists(), "fixture removal was not confirmed")
            allowed_paths = {portable_path(path) for path in routes}
            for scenario in reports.values():
                self.assertEqual(set(scenario["network"]), allowed_paths)
                self.assertEqual(len(scenario["network"]), len(allowed_paths), scenario["network"])
            report = {"schema": "cadr-m13-production-browser-campaign-v2",
                      "disposition": "passed-public-synthetic-p1-browser-composition-only",
                      "browser": {"engine": "Chromium", "version": browser_version, "cdpProduct": browser_product},
                      "closure": closure, "scenarios": reports,
                      "cleanup": {"browserClosed": True, "serverThreadStopped": True, "fixtureRemoved": True},
                      "holds": ["M10 adapter not exercised", "IndexedDB adapter not exercised", "selected runtime not exercised"],
                      "fRows": "not-evaluated", "runtimeCompatibility": "HOLD", "selectedMedia": "not-used"}
            encoded = canonical_json_bytes(report)
            if output := os.environ.get(REPORT_ENV):
                Path(output).write_bytes(encoded)
            print(f"cadr M13 production browser report sha256 {sha256(encoded)}")
        finally:
            if browser is not None and browser.is_connected():
                browser.close()
            if server is not None:
                server.shutdown()
                if thread is not None:
                    thread.join(timeout=3)
                server.server_close()
            shutil.rmtree(fixture, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
