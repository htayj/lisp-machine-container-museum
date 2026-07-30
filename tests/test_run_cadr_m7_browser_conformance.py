"""Inert schema and raw-frame tests for the explicit M7-P5 campaign runner."""
from __future__ import annotations

import importlib.util
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
import sys
import tempfile
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/run-cadr-m7-browser-conformance.py"


def load_module():
    spec = importlib.util.spec_from_file_location("m7_p5_test", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def h(index: int) -> str:
    return f"{index:064x}"


def full_record() -> bytes:
    payload = bytearray(23_112 * 4)
    payload[:4] = (0x80000001).to_bytes(4, "little")
    value = bytearray(96 + len(payload))
    value[:8] = b"CDRDISP1"
    value[8:10] = (1).to_bytes(2, "little")
    value[10:12] = (80).to_bytes(2, "little")
    value[12:16] = (1).to_bytes(4, "little")  # full; BOW means zero is white
    value[16:24] = (1).to_bytes(8, "little")
    value[24:32] = (2).to_bytes(8, "little")
    for offset, number in ((32, 768), (36, 963), (40, 24), (44, 32768),
                           (48, 23112), (52, 4), (56, 1), (60, 23112),
                           (64, len(payload)), (72, len(value)), (80, 0),
                           (84, 0), (88, 768), (92, 963)):
        value[offset:offset + (8 if offset in (64, 72) else 4)] = number.to_bytes(
            8 if offset in (64, 72) else 4, "little")
    value[96:] = payload
    return bytes(value)


def native_record() -> bytes:
    value = bytearray(64 + 23_112 * 4)
    value[:7] = b"CDRM7N1"
    value[8:12] = (1).to_bytes(4, "little")
    value[12:16] = (64).to_bytes(4, "little")
    value[16:24] = (982_990_214).to_bytes(8, "little")
    for offset, number in ((24, 768), (28, 963), (32, 4), (36, 1),
                           (40, 32768), (44, 23112), (48, 23112 * 4)):
        value[offset:offset + 4] = number.to_bytes(4, "little")
    return bytes(value)


def p4_manifest(module):
    file = lambda path, number: {"path": path, "bytes": number, "sha256": h(number)}
    return {
        "schema": "cadr-m7-frame-conformance-result-v1", "target": module.P5_TARGET,
        "outcome": "identical", "runtime_execution_performed": True,
        "session": {"id": "p4", "mode": "0700"}, "source": {"system_fossil": h(1), "usim_fossil": h(2)},
        "m6_release_record": file("cadr-web/oracle/cadr-m6-release-record.json", 3),
        "patches": {"m6_sha256": h(4), "m7_sha256": h(5), "m7_support": [
            {"path": "a", "installed_as": "a", "bytes": 6, "sha256": h(6)},
            {"path": "b", "installed_as": "b", "bytes": 7, "sha256": h(7)}]},
        "prepared": {"path": "build/cadr-oracle/p", "source_tree_sha256": h(8), "source_file_count": 9,
                     "executable": {"path": "x", "bytes": 10, "sha256": h(10), "forbidden_undefined_symbol_count": 0,
                                    "m6_patch_sha256": h(4), "m7_patch_sha256": h(5), "prepared_source_tree_sha256": h(8), "prepared_source_file_count": 9}},
        "artifacts": [{"kind": kind, "byte_count": str(11 + index), "sha256": h(11 + index)} for index, kind in enumerate((1, 2, 4, 5, 3))],
        "native_inputs": [{"id": "usite-extra-hosts", "byte_count": "16", "sha256": h(16)}],
        "schedule": {"event_count": 17, "mapping_sha256": h(17), "sha256": h(18)},
        "native": {"session_id": "native", "private_disk_instance_id": "disk",
                   "private_disk": {"sha256_at_start": h(19), "sha256_at_end": h(19)},
                   "process": {"returncode": 0, "timed_out": False, "forced_stop": False, "state_may_be_incomplete": False, "pending_host_requests": 0},
                   "oracle_process": {"returncode": 0, "signal": None},
                   "capture": {"schema": "CDRM7N1", "sha256": h(20), "byte_count": "92512", "boundary": "982990214", "width": 768, "height": 963, "stride_words": 24, "backing_words": 32768, "active_words": 23112, "tv_mode": 4, "black_on_white": True, "raw_words_sha256": h(21)},
                   "frame_file": file("native/frame.cdrm7n1", 20), "transcript_file": file("native/capture.ndjson", 22), "idle_file": file("native/idle.bin", 23), "metadata_file": file("native/metadata.json", 24)},
        "portable": {"session_id": "portable",
                     "session_evidence": {"ready_session_id": "portable", "worker_log_session_id": "portable"},
                     "module": file("cadr-web/build/cadr-web-m7-O0.wasm", 25), "worker": file("cadr-web/wasm/cadr-worker.js", 26), "adapter": [file("a.c", 27), file("a.h", 28)], "termination": {"pending_requests": 0, "terminated": True},
                     "framebuffer_checkpoint": {"boundary": "982990214", "cdrdisp1_sha256": h(29), "cdrm6i1_sha256": h(30)},
                     "cdrdisp_file": file("portable/frame.cdrdisp1", 29), "witness_file": file("portable/witness.cdrm6i1", 30), "ready_file": file("portable/ready.json", 31), "worker_log_file": file("portable/worker.ndjson", 32)},
        "comparison": {"file": file("comparison.json", 33), "m6_witness_sample_sha256": h(30), "native_capture_sha256": h(20), "native_raw_words_sha256": h(21), "portable_raw_words_sha256": h(34), "portable_record_sha256": h(29)},
        "summary": {"manifest_kind": "hashes-only", "comparison_sha256": h(33), "native_frame_sha256": h(20), "portable_frame_sha256": h(29)},
    }


def p5_result(module):
    capture = lambda name, number: {"file": {"path": name, "bytes": 1, "sha256": h(number)},
                                     "decoded_pixel_sha256": h(number + 1), "dimensions": {"width": 768, "height": 963},
                                     "presentation": {"fits": True, "scale": 1, "width": 768, "height": 963,
                                                      "left": 576, "top": 118, "viewportWidth": 1920,
                                                      "viewportHeight": 1200, "dpr": 1},
                                     "geometry": {
                                         "canvas_bounds": {"x": 0, "y": 0, "width": 1920, "height": 1200},
                                         "stage_bounds": {"x": 0, "y": 0, "width": 1920, "height": 1200},
                                         "source_clip": {"x": 576, "y": 118, "width": 768, "height": 963}}}
    return {"schema": module.P5_SCHEMA, "target": module.P5_TARGET, "outcome": "passed",
            "runtime_execution_performed": True, "p4_manifest_sha256": h(40),
            "input_cdrdisp1": {"sha256": h(41), "machine_generation": "1", "framebuffer_generation": "2", "tv_mode": 4},
            "environment": {"xvfb_screen": "1920x1200x24", "device_pixel_ratio": 1,
                            "loopback_cache_control": "no-store",
                            "xauthority": "private-cookie"},
            "identities": {
                "chromium": {"path": str(module.CHROMIUM), "sha256": h(47),
                             "probe_args": ["--version"], "probe_exit": 0,
                             "probe_output": "Chromium 150.0 test"},
                "xvfb": {"path": str(module.XVFB), "sha256": h(48),
                         "probe_args": ["-help"], "probe_exit": 1,
                         "probe_output": "use: X [:<display>] -screen scrn WxHxD"},
                "css": {"path": "cadr-web/browser/m7-host.css",
                        "sha256": module.sha256((ROOT / "cadr-web/browser/m7-host.css").read_bytes())},
                "host": {"path": "cadr-web/browser/m7-host.mjs",
                         "sha256": module.sha256((ROOT / "cadr-web/browser/m7-host.mjs").read_bytes())},
                "renderer": {"path": "cadr-web/wasm/cadr-display-renderer.mjs",
                             "sha256": module.sha256((ROOT / "cadr-web/wasm/cadr-display-renderer.mjs").read_bytes())}},
            "ordinary": capture("ordinary.png", 42), "fullscreen": capture("fullscreen.png", 44),
            "zero_fit": {"requested_viewport_width": 767, "canvas_width": 0, "canvas_height": 0},
            "fullscreen_control": {"entry": "trusted-click", "entry_succeeded": True, "exit": "trusted-click", "exit_succeeded": True},
            "browser_log": {"path": "browser.ndjson", "bytes": 1, "sha256": h(46)}}


def main() -> None:
    module = load_module()
    mutable_frame = bytearray(b"private-frame")
    module.FrameHandler.assets = module.snapshot_assets(mutable_frame)
    mutable_frame[:] = b"changed-frame"
    module.FrameHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), module.FrameHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}"
        assert urlopen(f"{base}/p4-frame.cdrdisp1").read() == b"private-frame"
        head = urlopen(Request(f"{base}/p4-frame.cdrdisp1", method="HEAD"))
        assert head.status == 200 and head.read() == b""
        assert urlopen(f"{base}/cadr-web/browser/m7-host.mjs").read() == (
            ROOT / "cadr-web/browser/m7-host.mjs").read_bytes()
        for method in ("GET", "HEAD"):
            try:
                urlopen(Request(f"{base}/AGENTS.md", method=method))
            except HTTPError as exc:
                assert exc.code == 404
            else:
                raise AssertionError(f"P5 server exposed a non-allowlisted repository file to {method}")
    finally:
        server.shutdown()
        server.server_close()
    record = full_record()
    authority = ROOT / "build/cadr-oracle/test-Xauthority"
    assert module.xvfb_command(":99", authority)[-2:] == ["-auth", str(authority)]
    chromium_env = module.chromium_environment(":99", authority)
    assert chromium_env["XAUTHORITY"] == str(authority)
    assert "XAUTHORITY" not in module.xvfb_environment()
    parsed = module.parse_cdrdisp1(record)
    assert parsed["bow"] is True and parsed["tv_mode"] == 4 and len(parsed["payload"]) == 92_448
    presentation = {"fits": True, "scale": 1, "width": 768, "height": 963,
                    "left": 576, "top": 118, "viewportWidth": 1920,
                    "viewportHeight": 1200, "dpr": 1}
    observed = {
        "state": {"fit": True, "mode": "ordinary", "presentation": presentation,
                  "canvasWidth": 1920, "canvasHeight": 1200,
                  "canvasCssWidth": "1920px", "canvasCssHeight": "1200px"},
        "dom": {"dpr": 1, "screen": {"width": 1920, "height": 1200},
                "canvas_bounds": {"x": 0, "y": 0, "width": 1920, "height": 1200},
                "stage_bounds": {"x": 0, "y": 0, "width": 1920, "height": 1200},
                "css": {"width": "1920px", "height": "1200px",
                        "image_rendering": "pixelated"},
                "smoothing": False, "fullscreen": False}}
    module.validate_visible_inspection(observed, fullscreen=False)
    fractional = json_clone(observed)
    fractional["dom"]["canvas_bounds"]["x"] = 0.5
    try:
        module.validate_visible_inspection(fractional, fullscreen=False)
    except module.BrowserConformanceError:
        pass
    else:
        raise AssertionError("fractional canvas geometry was accepted")
    for offset, replacement in ((0, b"X"), (12, (3).to_bytes(4, "little")),
                                (80, (32).to_bytes(4, "little")), (64, (0).to_bytes(8, "little"))):
        malformed = bytearray(record); malformed[offset:offset + len(replacement)] = replacement
        try:
            module.parse_cdrdisp1(bytes(malformed))
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError(f"malformed CDRDISP1 offset {offset} was accepted")
    manifest = p4_manifest(module)
    checked = module.validate_p4_manifest(manifest, module.canonical(manifest))
    assert checked["frame"]["path"] == "portable/frame.cdrdisp1"
    private_root = ROOT / "build/cadr-oracle"
    private_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="m7-p4-rehash-", dir=private_root) as temporary:
        session = Path(temporary)
        os.chmod(session, 0o700)
        (session / "native").mkdir(mode=0o700)
        (session / "portable").mkdir(mode=0o700)
        on_disk = json_clone(manifest)
        on_disk["session"]["id"] = session.name
        native = native_record()
        payloads = {
            "native/frame.cdrm7n1": native,
            "native/capture.ndjson": b"native-log\n",
            "native/idle.bin": b"idle",
            "native/metadata.json": b"{}",
            "portable/frame.cdrdisp1": record,
            "portable/witness.cdrm6i1": b"witness",
            "portable/ready.json": b"{}",
            "portable/worker.ndjson": b"worker\n",
            "comparison.json": b"comparison",
        }
        receipt_fields = {
            "native/frame.cdrm7n1": on_disk["native"]["frame_file"],
            "native/capture.ndjson": on_disk["native"]["transcript_file"],
            "native/idle.bin": on_disk["native"]["idle_file"],
            "native/metadata.json": on_disk["native"]["metadata_file"],
            "portable/frame.cdrdisp1": on_disk["portable"]["cdrdisp_file"],
            "portable/witness.cdrm6i1": on_disk["portable"]["witness_file"],
            "portable/ready.json": on_disk["portable"]["ready_file"],
            "portable/worker.ndjson": on_disk["portable"]["worker_log_file"],
            "comparison.json": on_disk["comparison"]["file"],
        }
        for path, payload in payloads.items():
            destination = session / path
            destination.write_bytes(payload)
            os.chmod(destination, 0o600)
            receipt = receipt_fields[path]
            receipt.update({"bytes": len(payload), "sha256": module.sha256(payload)})
            if path.startswith("native/"):
                receipt["path"] = destination.relative_to(ROOT).as_posix()
            else:
                receipt["path"] = path
        native_hash = receipt_fields["native/frame.cdrm7n1"]["sha256"]
        frame_hash = receipt_fields["portable/frame.cdrdisp1"]["sha256"]
        witness_hash = receipt_fields["portable/witness.cdrm6i1"]["sha256"]
        comparison_hash = receipt_fields["comparison.json"]["sha256"]
        on_disk["native"]["capture"]["sha256"] = native_hash
        on_disk["native"]["capture"]["raw_words_sha256"] = module.sha256(native[64:])
        on_disk["portable"]["framebuffer_checkpoint"].update(
            {"cdrdisp1_sha256": frame_hash, "cdrm6i1_sha256": witness_hash})
        on_disk["comparison"].update(
            {"native_capture_sha256": native_hash, "portable_record_sha256": frame_hash,
             "m6_witness_sample_sha256": witness_hash,
             "native_raw_words_sha256": module.sha256(native[64:])})
        on_disk["summary"].update(
            {"comparison_sha256": comparison_hash, "native_frame_sha256": native_hash,
             "portable_frame_sha256": frame_hash})
        module.validate_p4_manifest(on_disk, module.canonical(on_disk), session)
        wrong_session = json_clone(on_disk)
        wrong_session["session"]["id"] = "another-session"
        try:
            module.validate_p4_manifest(wrong_session, module.canonical(wrong_session), session)
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError("P5 accepted a manifest from another session directory")
        wrong_tv = json_clone(on_disk)
        wrong_tv["native"]["capture"]["tv_mode"] = 0
        wrong_tv["native"]["capture"]["black_on_white"] = False
        try:
            module.validate_p4_manifest(wrong_tv, module.canonical(wrong_tv), session)
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError("P5 accepted native capture fields differing from CDRM7N1 bytes")
        (session / "portable/worker.ndjson").write_bytes(b"tampered\n")
        os.chmod(session / "portable/worker.ndjson", 0o600)
        try:
            module.validate_p4_manifest(on_disk, module.canonical(on_disk), session)
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError("P5 accepted a changed P4 sidecar")
    for mutate in (
            lambda value: value["artifacts"].pop(),
            lambda value: value["native_inputs"].pop(),
            lambda value: value["schedule"].__setitem__("sha256", "bad"),
            lambda value: value["native"]["private_disk"].__setitem__("sha256_at_end", h(92)),
            lambda value: value["native"]["process"].__setitem__("pending_host_requests", 1),
            lambda value: value["native"]["capture"].__setitem__("schema", "OTHER"),
            lambda value: value["native"]["capture"].__setitem__("byte_count", "1"),
            lambda value: value["portable"]["termination"].__setitem__("pending_requests", 1),
            lambda value: value["portable"]["framebuffer_checkpoint"].__setitem__("cdrdisp1_sha256", h(92)),
            lambda value: value["portable"]["cdrdisp_file"].__setitem__("path", "synthetic"),
            lambda value: value["comparison"].__setitem__("portable_record_sha256", h(93)),
            lambda value: value["summary"].__setitem__("portable_frame_sha256", h(94))):
        candidate = json_clone(manifest); mutate(candidate)
        try:
            module.validate_p4_manifest(candidate, module.canonical(candidate))
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError("mutated P4 binding was accepted")
    result = p5_result(module)
    assert module.validate_p5_result(result) is result
    for mutate in (
            lambda value: value["environment"].__setitem__("device_pixel_ratio", 2),
            lambda value: value["environment"].__setitem__("xauthority", "open"),
            lambda value: value["fullscreen_control"].__setitem__("entry_succeeded", False),
            lambda value: value["ordinary"]["dimensions"].__setitem__("width", 767),
            lambda value: value["zero_fit"].__setitem__("canvas_width", 1),
            lambda value: value["identities"]["chromium"].__setitem__("probe_output", ""),
            lambda value: value["identities"]["xvfb"].__setitem__("probe_args", ["--version"]),
            lambda value: value["identities"]["host"].__setitem__("sha256", h(99)),
            lambda value: value["identities"]["css"].__setitem__("sha256", h(98)),
            lambda value: value["ordinary"]["file"].__setitem__("bytes", 0),
            lambda value: value["ordinary"]["presentation"].__setitem__("dpr", 2),
            lambda value: value["ordinary"]["geometry"]["canvas_bounds"].__setitem__("x", 0.5),
            lambda value: value["ordinary"]["geometry"]["source_clip"].__setitem__("x", 575),
            lambda value: value["browser_log"].__setitem__("path", "other.ndjson"),
            lambda value: value["input_cdrdisp1"].__setitem__("machine_generation", "01")):
        candidate = json_clone(result); mutate(candidate)
        try:
            module.validate_p5_result(candidate)
        except module.BrowserConformanceError:
            pass
        else:
            raise AssertionError("mutated P5 result was accepted")
    print("cadr M7 P5 conformance schema tests passed")


def json_clone(value):
    import json
    return json.loads(json.dumps(value))


if __name__ == "__main__":
    main()
