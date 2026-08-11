"""Sealed-source real-browser M11 pause/resume continuity evidence."""
from __future__ import annotations

from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import importlib.metadata
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from threading import Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TEST_RELATIVE = "tests/test_cadr_m11_selected_playback.py"
CHROMIUM = Path("/usr/bin/chromium")
CHROMIUM_LAUNCH_FLAGS = (
    "--disable-background-networking", "--disable-component-update",
    "--disable-domain-reliability", "--disable-sync", "--metrics-recording-only",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
)
EXPECTED_WASM_SHA256 = "0768c02a0be066cd71ded1882e00e0cdae64e4d1a7197bf89a23801190722c76"
SERVED_PATHS = {
    "/cadr-web/browser/cadr-m11-selected-playback.html":
        "cadr-web/browser/cadr-m11-selected-playback.html",
    "/cadr-web/browser/cadr-m11-selected-playback.mjs":
        "cadr-web/browser/cadr-m11-selected-playback.mjs",
    "/cadr-web/browser/cadr-m13-audio-boundary.mjs":
        "cadr-web/browser/cadr-m13-audio-boundary.mjs",
    "/cadr-web/browser/cadr-m13-browser-audio-factory.mjs":
        "cadr-web/browser/cadr-m13-browser-audio-factory.mjs",
    "/cadr-web/browser/cadr-m13-audio-reducer.mjs":
        "cadr-web/browser/cadr-m13-audio-reducer.mjs",
    "/cadr-web/browser/cadr-m13-audio-record.mjs":
        "cadr-web/browser/cadr-m13-audio-record.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs":
        "cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/wasm/cadr-m13-audio-source.mjs":
        "cadr-web/wasm/cadr-m13-audio-source.mjs",
    "/cadr-web/build/cadr-web-m13-audio-O2.wasm":
        "cadr-web/build/cadr-web-m13-audio-O2.wasm",
}
EXPECTED_REQUEST_PATHS = sorted([*SERVED_PATHS, "/m11-selected-fixture.json",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs",
    "/cadr-web/browser/cadr-m13-audio-worklet.mjs"])
EXPECTED_CDP_PATHS = sorted([path for path in SERVED_PATHS
    if path != "/cadr-web/browser/cadr-m13-audio-worklet.mjs"] +
    ["/m11-selected-fixture.json"])
SOURCE_EXACT = {
    ".gitignore", "cadr-web/Makefile", "cadr-web/wasm/build-wasm.sh",
    "cadr-web/wasm/cadr_wasm_adapter.c", "cadr-web/wasm/cadr_wasm_adapter.h",
    "cadr-web/wasm/cadr_wasm_runtime.c", "cadr-web/wasm/cadr_wasm_runtime.h",
    "scripts/cadr-m11-fixed-table-oracle.py",
    "scripts/verify-cadr-m11-selected-playback-report.py", TEST_RELATIVE,
    *(path for path in SERVED_PATHS.values() if not path.startswith("cadr-web/build/")),
}
SOURCE_PREFIXES = ("cadr-web/core/", "cadr-web/include/", "cadr-web/trace/",
                   "cadr-web/wasm/include/")


def run(args: list[str], cwd: Path, *, text: bool = True,
        env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True,
                          text=text, env=env)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def regular_identity(path: Path) -> dict[str, object]:
    metadata = path.lstat()
    if path.is_symlink() or not stat.S_ISREG(metadata.st_mode):
        raise RuntimeError(f"identity path is not a regular non-symlink file: {path}")
    return {"path": str(path), "bytes": metadata.st_size, "sha256": sha256_file(path)}


def chromium_payload(launcher: Path) -> Path:
    launcher = launcher.resolve(strict=True)
    data = launcher.read_bytes()
    matches = set()
    for value in re.findall(rb"(/[A-Za-z0-9._/+@%=-]+/chromium)\x00", data):
        try:
            candidate = Path(value.decode()).resolve(strict=True)
            regular_identity(candidate)
        except (OSError, RuntimeError):
            continue
        matches.add(candidate)
    if len(matches) != 1:
        raise RuntimeError("Chromium launcher has no single absolute payload path")
    payload = next(iter(matches)).resolve(strict=True)
    return payload


def playwright_identity() -> dict[str, object]:
    origin = importlib.util.find_spec("playwright.sync_api")
    if origin is None or origin.origin is None:
        raise RuntimeError("Playwright sync API module is unavailable")
    return {"version": importlib.metadata.version("playwright"),
            "sync_api": regular_identity(Path(origin.origin).resolve(strict=True))}


def observed_payload_path(payload: Path) -> str:
    matches = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            executable = Path(os.readlink(entry / "exe")).resolve(strict=True)
            command = (entry / "cmdline").read_bytes()
        except (FileNotFoundError, PermissionError, ProcessLookupError, OSError):
            continue
        if executable == payload and b"--remote-debugging-pipe" in command:
            matches.append(str(executable))
    if matches != [str(payload)]:
        raise RuntimeError(f"live Playwright browser payload is ambiguous: {matches}")
    return matches[0]


def canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def source_entries(stage: Path) -> list[dict[str, object]]:
    tracked = run(["git", "ls-files"], stage).stdout.splitlines()
    selected = sorted(path for path in tracked if path in SOURCE_EXACT or
                      path.startswith(SOURCE_PREFIXES))
    missing = sorted(SOURCE_EXACT - set(selected))
    if missing:
        raise RuntimeError(f"evidence source closure is missing {missing}")
    entries = []
    for relative in selected:
        path = stage / relative
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or path.is_symlink():
            raise RuntimeError(f"evidence source is not regular: {relative}")
        entries.append({"path": relative, "bytes": metadata.st_size,
                        "sha256": sha256_file(path)})
    return entries


def signature_identity(repository: Path, commit: str) -> dict[str, object]:
    checked = run(["git", "verify-commit", "--raw", commit], repository)
    transcript = checked.stdout + checked.stderr
    match = re.search(r"\[GNUPG:\] VALIDSIG ([0-9A-F]{40}) ", transcript)
    if match is None:
        raise RuntimeError("base commit lacks a machine-readable valid signature")
    return {"verified": True, "fingerprint": match.group(1)}


def toolchain_identity(stage: Path) -> dict[str, object]:
    channel = run(["guix", "describe", "-f", "channels"], stage).stdout
    commits = re.findall(r'\(commit\s+"([0-9a-f]{40})"\)', channel)
    if len(commits) != 1:
        raise RuntimeError("Guix channel identity is ambiguous")
    script = r'''
set -eu
clang_path=$(readlink -f "$(command -v clang)")
lld_path=$(readlink -f "$(command -v wasm-ld)")
printf '%s\n' "$clang_path" "$(clang --version | sed -n '1p')" "$(sha256sum "$clang_path" | cut -d' ' -f1)"
printf '%s\n' "$lld_path" "$(wasm-ld --version | sed -n '1p')" "$(sha256sum "$lld_path" | cut -d' ' -f1)"
'''
    lines = run(["guix", "shell", "clang-toolchain", "lld", "--", "sh", "-c", script],
                stage).stdout.splitlines()
    if len(lines) != 6:
        raise RuntimeError("toolchain identity output is incomplete")
    chromium_launcher = CHROMIUM.resolve(strict=True)
    chromium_real = chromium_payload(chromium_launcher)
    return {
        "guix_channel_commit": commits[0],
        "clang": {"path": lines[0], "version": lines[1], "sha256": lines[2]},
        "wasm_ld": {"path": lines[3], "version": lines[4], "sha256": lines[5]},
        "chromium": {"launcher": {**regular_identity(chromium_launcher),
                                   "command_version": run([str(chromium_launcher), "--version"],
                                                          stage).stdout.strip()},
                     "payload": {**regular_identity(chromium_real),
                                 "command_version": run([str(chromium_real), "--version"],
                                                        stage).stdout.strip()},
                     "launch_flags": list(CHROMIUM_LAUNCH_FLAGS)},
        "python": sys.version.split()[0],
        "playwright": playwright_identity(),
        "git": run(["git", "--version"], stage).stdout.strip(),
    }


def prepare_stage(repository: Path, patch: Path | None, destination: Path) -> dict[str, object]:
    base = run(["git", "rev-parse", "--verify", "HEAD^{commit}"], repository).stdout.strip()
    signature = signature_identity(repository, base)
    run(["git", "clone", "--no-hardlinks", "--quiet", str(repository), str(destination)], repository)
    run(["git", "checkout", "--detach", "--quiet", base], destination)
    patch_evidence = None
    if patch is not None:
        metadata = patch.lstat()
        if not stat.S_ISREG(metadata.st_mode) or patch.is_symlink():
            raise RuntimeError("evidence patch must be a regular non-symlink")
        run(["git", "apply", "--check", str(patch)], destination)
        run(["git", "apply", str(patch)], destination)
        patch_evidence = {"bytes": metadata.st_size, "mode": stat.S_IMODE(metadata.st_mode),
                          "sha256": sha256_file(patch)}
    elif run(["git", "status", "--porcelain=v1", "--untracked-files=all"], repository).stdout:
        raise RuntimeError("uncommitted evidence requires CADR_M11_EVIDENCE_PATCH")
    run(["git", "add", "-A"], destination)
    if run(["git", "diff", "--name-only"], destination).stdout or run(
            ["git", "ls-files", "--others", "--exclude-standard"], destination).stdout:
        raise RuntimeError("staged evidence has bytes outside its exact index")
    proposed_tree = run(["git", "write-tree"], destination).stdout.strip()
    if patch is not None:
        reproduced = run(["git", "diff", "--cached", "--binary", "HEAD"], destination,
                         text=False).stdout
        if sha256_bytes(reproduced) != patch_evidence["sha256"]:
            raise RuntimeError("base-to-proposed diff differs from supplied patch")
    entries = source_entries(destination)
    manifest = canonical(entries)
    return {"base_commit": base, "base_signature": signature,
            "base_tree": run(["git", "rev-parse", f"{base}^{{tree}}"], destination).stdout.strip(),
            "proposed_tree": proposed_tree, "patch": patch_evidence,
            "worktree_matches_index": True, "untracked_count": 0,
            "closure_entries": entries, "closure_manifest_sha256": sha256_bytes(manifest)}


def load_oracle(stage: Path):
    spec = importlib.util.spec_from_file_location(
        "cadr_m11_fixed_table_oracle", stage / "scripts/cadr-m11-fixed-table-oracle.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@contextmanager
def browser_server(stage: Path, fixture_body: bytes):
    requests: list[str] = []
    unexpected: list[str] = []
    response_hashes = {path: sha256_file(stage / relative)
                       for path, relative in SERVED_PATHS.items()}
    response_hashes["/m11-selected-fixture.json"] = sha256_bytes(fixture_body)
    expected = {*SERVED_PATHS, "/m11-selected-fixture.json"}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urlsplit(self.path)
            if parsed.query or parsed.fragment or parsed.path not in expected:
                unexpected.append(self.path)
                self.send_response(404); self.end_headers(); return
            requests.append(parsed.path)
            if parsed.path == "/m11-selected-fixture.json":
                body, mime = fixture_body, "application/json"
            else:
                target = stage / SERVED_PATHS[parsed.path]
                body = target.read_bytes()
                mime = "application/wasm" if target.suffix == ".wasm" else (
                    "text/html; charset=utf-8" if target.suffix == ".html" else
                    "text/javascript; charset=utf-8")
            self.send_response(200); self.send_header("Content-Type", mime)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *_args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True); thread.start()
    try:
        yield server, requests, unexpected, response_hashes, sorted(expected)
    finally:
        server.shutdown(); thread.join(timeout=3); server.server_close()
        if thread.is_alive():
            raise RuntimeError("loopback evidence server did not stop")


def run_staged_observation(stage: Path, evidence_path: Path, output: Path) -> None:
    evidence = json.loads(evidence_path.read_text())
    payload = Path(evidence["tools"]["chromium"]["payload"]["path"]).resolve(strict=True)
    oracle = load_oracle(stage)
    multi = oracle.build_reference_semantic_report(oracle.source_identities())["fixtures"][1]
    fixture_body = json.dumps({"name": multi["name"],
        "initial_snapshot_cdrauds1_hex": multi["initial_snapshot_cdrauds1_hex"],
        "oracle_source_identities": oracle.source_identities()},
        sort_keys=True, separators=(",", ":")).encode()
    page_errors: list[str] = []; unhandled: list[str] = []; blocked: list[str] = []; cdp_requests: list[str] = []
    websockets: list[str] = []
    with browser_server(stage, fixture_body) as (server, requests, unexpected,
                                                 response_hashes, expected):
        origin = f"http://127.0.0.1:{server.server_port}"
        expected_urls = {origin + path for path in expected}
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=str(CHROMIUM),
                args=list(CHROMIUM_LAUNCH_FLAGS))
            payload_observed = observed_payload_path(payload)
            context = browser.new_context(service_workers="block")
            def route_request(route):
                if route.request.url not in expected_urls:
                    blocked.append(route.request.url); route.abort("blockedbyclient")
                else:
                    route.continue_()
            context.route("**/*", route_request)
            page = context.new_page(); page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on("console", lambda message: unhandled.append(message.text)
                    if "Unhandled" in message.text or "unhandledrejection" in message.text else None)
            cdp = context.new_cdp_session(page); cdp.send("Network.enable")
            cdp.on("Network.requestWillBeSent", lambda event: cdp_requests.append(event["request"]["url"]))
            cdp.on("Network.webSocketCreated", lambda event: websockets.append(event["url"]))
            page.goto(origin + "/cadr-web/browser/cadr-m11-selected-playback.html")
            page.wait_for_function("() => window.cadrM11SelectedPlayback !== undefined")
            page.locator("#open").click()
            page.wait_for_function("() => window.cadrM11SelectedPlayback.state().observations.staged !== null")
            page.locator("#pause").click()
            page.wait_for_function("() => window.cadrM11SelectedPlayback.state().observations.paused !== null")
            page.locator("#resume").click()
            page.wait_for_function("() => window.cadrM11SelectedPlayback.state().observations.final !== null",
                                   timeout=10000)
            result = page.evaluate("() => window.cadrM11SelectedPlayback.state()")
            late_factory = {
                "resolve": page.evaluate("""async () =>
                    await window.cadrM11SelectedPlayback.terminalBoundaryScenario("resolve")"""),
                }
            late_factory["reject"] = page.evaluate("""async () =>
                await window.cadrM11SelectedPlayback.terminalBoundaryScenario("reject")""")
            result["terminal"] = late_factory
            result["terminalNever"] = {stage: page.evaluate(
                """async stage => await window.cadrM11SelectedPlayback.terminalNeverScenario(stage)""", stage)
                for stage in ("before-module", "after-module", "after-node")}
            browser_version = browser.version
            context.close(); browser.close()
    if page_errors or unhandled or unexpected or blocked or websockets:
        raise AssertionError({"page_errors": page_errors, "unexpected": unexpected,
                              "unhandled": unhandled, "blocked": blocked, "websockets": websockets})
    if sorted(requests) != EXPECTED_REQUEST_PATHS:
        raise AssertionError(f"closed HTTP request set differs: {requests}")
    if sorted(urlsplit(url).path for url in cdp_requests if url.startswith("http://")) != EXPECTED_CDP_PATHS:
        raise AssertionError(f"CDP request set differs: {cdp_requests}")
    first, resumed = result["deliveries"]
    first_stage = result["observations"]["staged"]
    resumed_stage = result["observations"]["resumed"]
    assert first_stage["delivery"] == first and resumed_stage["delivery"] == resumed
    assert first_stage["staged"]["kind"] == resumed_stage["staged"]["kind"] == "worklet-staged"
    assert result["observations"]["initial"] == result["observations"]["paused"]
    assert result["activation"] == [True, True]
    assert result["contexts"] == [
        {"state": "closed", "sampleRate": 48000, "disconnected": True,
         "staged": 1, "acknowledgements": 0},
        {"state": "running", "sampleRate": 48000, "disconnected": False,
         "staged": 1, "acknowledgements": 1},
    ]
    assert result["statuses"] == ["CADR audio ready", "CADR audio ready"]
    assert [call["op"] for call in result["calls"]] == ["audio-open-private", "audio-peek",
        "audio-render", "audio-open-private", "audio-peek", "audio-render", "audio-ack"]
    assert result["observations"]["committed"]["receipt"]["kind"] == "ack-committed"
    assert result["observations"]["committed"]["sourceInFlightRecords"] == 0
    assert result["observations"]["committed"]["boundary"] == result["boundary"]
    assert result["observations"]["final"]["packetCount"] == 2
    assert result["observations"]["final"]["queuedFrames"] == "513"
    assert result["wasm"] == {"bytes": 218989, "sha256": EXPECTED_WASM_SHA256}
    assert late_factory == {kind: {
        "kind": kind, "phaseTrace": ["start-deferred-before-node", "terminal-first-pass",
        "node-after-first-pass"], "openStatus": 9, "nodeAllocatedAfterFirstDisconnect": True,
        "disconnectPasses": 2, "nodeDisconnects": 1, "contextCloseCalls": 1,
        "contextState": "closed", "closeRejections": 0, "terminalState": "DEVICE_LOST",
    } for kind in ("resolve", "reject")}
    for stage, terminal in result["terminalNever"].items():
        assert terminal == {"stage": stage, "phaseTrace": [stage + "-entered", "terminal-first-pass"],
            "openStatus": 9, "startStillPending": True, "nodeAllocatedAfterFirstDisconnect": False,
            "disconnectPasses": 1, "nodeDisconnects": 1 if stage == "after-node" else 0,
            "contextCloseCalls": 1, "contextState": "closed", "closeRejections": 0,
            "terminalState": "DEVICE_LOST"}, terminal
    command_version = re.match(r"Chromium ([0-9.]+)",
        evidence["tools"]["chromium"]["payload"]["command_version"])
    assert command_version is not None and browser_version == command_version.group(1)
    observation = {"browser": result, "errors": {"pageErrors": [], "unhandledRejections": []},
        "browser_process": {"payload_path": payload_observed},
        "network": {"policy": "playwright-route-plus-cdp-network-v1",
                    "loopback_only": True, "blocked_requests": [], "websockets": [],
                    "request_paths": sorted(requests),
                    "cdp_request_paths": sorted(urlsplit(url).path for url in cdp_requests
                                                 if url.startswith("http://")),
                    "response_sha256": response_hashes},
        "browser_version": browser_version,
        "cleanup": {"browser_closed": True, "context_closed": True,
                    "server_closed": True, "server_thread_stopped": True}}
    output.write_bytes(canonical(observation))


def orchestrate() -> None:
    patch_value = os.environ.get("CADR_M11_EVIDENCE_PATCH")
    patch = Path(patch_value).resolve() if patch_value else None
    requested_output = os.environ.get("CADR_M11_SELECTED_PLAYBACK_REPORT")
    with tempfile.TemporaryDirectory(prefix="cadr-m11-selected-evidence-") as temporary:
        temporary_root = Path(temporary); stage = temporary_root / "stage"
        source = prepare_stage(ROOT, patch, stage)
        tools = toolchain_identity(stage)
        subprocess.run(["make", "-B", "-C", str(stage / "cadr-web"),
            "build/cadr-web-m13-audio-O2.wasm"], check=True)
        wasm = stage / "cadr-web/build/cadr-web-m13-audio-O2.wasm"
        if wasm.stat().st_size != 218989 or sha256_file(wasm) != EXPECTED_WASM_SHA256:
            raise RuntimeError("forced selected Wasm identity differs")
        if run(["git", "diff", "--name-only"], stage).stdout or run(
                ["git", "ls-files", "--others", "--exclude-standard"], stage).stdout:
            raise RuntimeError("forced build changed the exact source stage")
        evidence = {"schema": "cadr-m11-selected-source-evidence-v3",
                    "source": source, "tools": tools,
                    "wasm": {"bytes": wasm.stat().st_size, "sha256": sha256_file(wasm),
                             "forced_build": True, "isolated_stage": True}}
        evidence_path = temporary_root / "evidence.json"
        evidence_path.write_bytes(canonical(evidence))
        observation_path = temporary_root / "observation.json"
        environment = os.environ.copy(); environment["CADR_M11_EVIDENCE_STAGE_ROOT"] = str(stage)
        subprocess.run([sys.executable, str(stage / TEST_RELATIVE), "--staged-run",
                        str(evidence_path), str(observation_path)], cwd=stage,
                       env=environment, check=True)
        observation = json.loads(observation_path.read_text())
        shutil.rmtree(stage)
        if stage.exists():
            raise RuntimeError("isolated evidence stage was not removed")
        report = {"schema": "cadr-m11-selected-playback-v3", "evidence": evidence,
                  "observation": observation,
                  "cleanup": {"isolated_stage_removed": True},
                  "claims": observation["browser"]["claimBoundary"]}
        encoded = canonical(report)
        if requested_output:
            target = Path(requested_output).resolve()
            report_root = (ROOT / "build/cadr-m11").resolve()
            if not target.is_relative_to(report_root):
                raise RuntimeError("selected playback report must remain under ignored build/cadr-m11")
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary_output = target.with_suffix(target.suffix + ".tmp")
            temporary_output.write_bytes(encoded); temporary_output.replace(target)
    print("sealed-source selected-Wasm M11 playback evidence passed")


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--staged-run":
        stage_root = Path(os.environ["CADR_M11_EVIDENCE_STAGE_ROOT"]).resolve()
        if ROOT != stage_root:
            raise RuntimeError("staged evidence runner root differs")
        run_staged_observation(stage_root, Path(sys.argv[2]), Path(sys.argv[3]))
    elif len(sys.argv) == 1:
        orchestrate()
    else:
        raise SystemExit("usage: test_cadr_m11_selected_playback.py [--staged-run EVIDENCE OBSERVATION]")
