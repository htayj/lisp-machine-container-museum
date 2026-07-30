"""Browser execution check for the deliberately fail-closed M13 policy artifact.

It proves external-module execution and keyboard reachability under the exact
provisional CSP.  It does not test selected-Wasm execution, a real M10 store,
or browser network-service tracing, so it cannot close C-M13.
"""

from __future__ import annotations

from pathlib import Path
import socket
from subprocess import PIPE, Popen, TimeoutExpired, run
import time
import unittest
from urllib.request import urlopen
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class CadrM13ProvisionalBrowserTest(unittest.TestCase):
    def test_external_module_and_keyboard_controls_run_under_exact_csp(self) -> None:
        name = f"browser-test-{__import__('os').getpid()}"
        artifact = ROOT / "build" / "cadr-m13" / name
        inventory = artifact.with_suffix(".inventory.json")
        server: Popen[str] | None = None
        try:
            run(["node", "scripts/build-cadr-m13-provisional.mjs", "--output", str(artifact)],
                cwd=ROOT, check=True, capture_output=True, text=True)
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as reservation:
                reservation.bind(("127.0.0.1", 0))
                port = reservation.getsockname()[1]
            server = Popen(["node", "scripts/serve-cadr-m13-provisional.mjs", "--root", str(artifact),
                            "--port", str(port)], cwd=ROOT, stdout=PIPE, stderr=PIPE, text=True)
            for _ in range(50):
                try:
                    with urlopen(f"http://127.0.0.1:{port}/index.html", timeout=0.2) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.1)
            else:
                self.fail(server.stderr.read() if server.stderr is not None else "M13 server did not listen")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True, executable_path="/usr/bin/chromium",
                    args=["--disable-background-networking"])
                context = browser.new_context()
                page = context.new_page()
                cdp = context.new_cdp_session(page)
                cdp.send("Network.enable")
                network_starts: list[str] = []
                cdp.on("Network.requestWillBeSent", lambda event: network_starts.append(event["request"]["url"]))
                page_errors: list[str] = []
                page.on("pageerror", lambda error: page_errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded")
                status = page.locator("#cadr-m13-status")
                expect(status).to_have_text(
                    "CADR host shell loaded. No machine is running in this M13 policy harness.", timeout=15000)
                buttons = page.locator("#cadr-m13-controls button")
                self.assertEqual(buttons.count(), 13)
                self.assertEqual(page.locator("#cadr-shell-root > a").get_attribute("href"), "#cadr-m13-controls")
                self.assertEqual(page.locator("#cadr-m13-status").get_attribute("role"), "status")
                self.assertEqual(page.locator("#cadr-m13-status").get_attribute("aria-live"), "polite")
                self.assertEqual(page.locator(".cadr-m13-guest").get_attribute("aria-label"),
                                 "CADR guest framebuffer; use the separate host controls.")
                self.assertEqual(page.locator(".cadr-m13-guest").text_content(), "")
                self.assertEqual(buttons.evaluate_all("items => items.every(item => item.getAttribute('aria-label') === item.textContent)"), True)
                # This is a true keyboard route: Tab reaches the skip link,
                # canvas, then every host control in DOM order.  This page has
                # no machine wiring, so it proves only the host-control seam.
                page.keyboard.press("Tab")
                self.assertEqual(page.evaluate("() => document.activeElement?.tagName"), "A")
                focus_outline = page.evaluate("""() => { const style = getComputedStyle(document.activeElement);
                  return { style: style.outlineStyle, width: style.outlineWidth }; }""")
                self.assertNotEqual(focus_outline["style"], "none")
                self.assertNotEqual(focus_outline["width"], "0px")
                page.keyboard.press("Tab")
                self.assertEqual(page.evaluate("() => document.activeElement?.tagName"), "CANVAS")
                for index in range(buttons.count()):
                    button = buttons.nth(index)
                    label = button.text_content() or ""
                    page.keyboard.press("Tab")
                    self.assertEqual(page.evaluate("() => document.activeElement?.textContent"), label)
                    page.keyboard.press("Enter")
                    expect(status).to_have_text(
                        f"{label} is unavailable until the selected machine is configured.")
                # CDP Network events are the browser-stack observation, rather
                # than a page fetch/XMLHttpRequest spy.  The normal closed
                # policy-harness workflow has exactly three startup loads and
                # starts none while its controls are exercised.  The hostile
                # CSP probes below are intentionally excluded: their purpose is
                # to prove that an injected action is denied, not to present a
                # DevTools-injected attempted URL as normal user workflow.
                observed_paths = [urlsplit(url).path for url in network_starts]
                self.assertEqual(observed_paths,
                                 ["/index.html", "/cadr-shell.css", "/cadr-shell.mjs"],
                                 network_starts)
                # This is an actual CSP-enforcement probe, not a header-string
                # assertion.  The deterministic artifact nonce permits its two
                # listed external assets but must not authorize inline, eval,
                # Function, dynamically named scripts, worker creation, frames,
                # objects, forms, or connections.  `wasm-unsafe-eval` is the one
                # selected exception: compile of a minimal valid module works.
                probe = page.evaluate("""async () => {
                  const violations = [];
                  addEventListener('securitypolicyviolation', event => violations.push(event.effectiveDirective));
                  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
                  const script = (value, source) => new Promise(resolve => {
                    const item = document.createElement('script');
                    if (source) item.src = value; else item.textContent = value;
                    const timeout = setTimeout(() => resolve('timeout'), 250);
                    item.onload = () => { clearTimeout(timeout); resolve('loaded'); };
                    item.onerror = () => { clearTimeout(timeout); resolve('blocked'); };
                    document.head.append(item);
                  });
                  const inline = await script('window.__cadrM13Inline = true', false);
                  const selfDynamic = await script('/cadr-shell.mjs?unlisted=1', true);
                  const remoteDynamic = await script('data:text/javascript,window.__cadrM13Remote=true', true);
                  let evalBlocked = false; try { eval('1 + 1'); } catch { evalBlocked = true; }
                  let functionBlocked = false; try { Function('return 1'); } catch { functionBlocked = true; }
                  let connectBlocked = false; try { await fetch('/cadr-shell.css'); } catch { connectBlocked = true; }
                  const workerBlocked = await new Promise(resolve => {
                    try {
                      const worker = new Worker('/cadr-worker.js');
                      const timeout = setTimeout(() => { worker.terminate(); resolve(false); }, 250);
                      worker.onerror = () => { clearTimeout(timeout); worker.terminate(); resolve(true); };
                      worker.onmessage = () => { clearTimeout(timeout); worker.terminate(); resolve(false); };
                    } catch { resolve(true); }
                  });
                  const object = document.createElement('object'); object.data = '/cadr-shell.mjs'; document.body.append(object);
                  const frame = document.createElement('iframe'); frame.src = '/index.html?unlisted-frame=1'; frame.name = 'cadr-m13-csp-target'; document.body.append(frame);
                  const form = document.createElement('form'); form.action = '/cadr-shell.css'; form.method = 'get'; form.target = frame.name; document.body.append(form); form.requestSubmit();
                  const wasmAllowed = await WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])).then(() => true, () => false);
                  await wait(100);
                  return { inline, inlineRan: window.__cadrM13Inline === true, selfDynamic, remoteDynamic,
                    evalBlocked, functionBlocked, connectBlocked, workerBlocked, wasmAllowed, violations };
                }""")
                self.assertIn(probe["inline"], ("blocked", "timeout"))
                self.assertFalse(probe["inlineRan"])
                self.assertIn(probe["selfDynamic"], ("blocked", "timeout"))
                self.assertIn(probe["remoteDynamic"], ("blocked", "timeout"))
                self.assertTrue(probe["evalBlocked"])
                self.assertTrue(probe["functionBlocked"])
                self.assertTrue(probe["connectBlocked"])
                self.assertTrue(probe["workerBlocked"])
                self.assertTrue(probe["wasmAllowed"])
                directives = set(probe["violations"])
                self.assertTrue(any(value.startswith("script-src") for value in directives), directives)
                self.assertIn("connect-src", directives)
                self.assertIn("worker-src", directives)
                self.assertIn("object-src", directives)
                self.assertIn("form-action", directives)
                self.assertTrue(any(value.startswith("frame-src") or value == "default-src" for value in directives), directives)
                self.assertEqual(page_errors, [], page_errors)
                cdp.detach()
                context.close()
                browser.close()
        finally:
            if server is not None and server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=3)
                except TimeoutExpired:
                    server.kill()
                    server.wait(timeout=3)
            if artifact.exists():
                import shutil
                shutil.rmtree(artifact)
            inventory.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
