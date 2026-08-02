"""Inert schema and raw-frame tests for the explicit M7-P5 campaign runner."""
from __future__ import annotations

import importlib.util
import hashlib
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import struct
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
    worker = file("cadr-web/wasm/cadr-worker.js", 26)
    node = {"version": "v22.14.0", "executable_bytes": 123,
            "executable_sha256": h(119)}
    closure_files = [worker]
    closure_tree = hashlib.sha256(json.dumps({
        "builtins": ["node:worker_threads"], "files": closure_files, "node": node,
    }, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "schema": "cadr-m7-frame-conformance-result-v2", "target": module.P5_TARGET,
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
                     "module": file("cadr-web/build/cadr-web-m7-O0.wasm", 25),
                     "worker": worker,
                     "worker_closure": {
                         "schema": "cadr-m7-worker-source-closure-v1",
                         "entry": worker, "files": closure_files,
                         "builtins": ["node:worker_threads"], "node": node,
                         "tree_sha256": closure_tree,
                     },
                     "contemporaneous_adapter_observation": [
                         file("a.c", 27), file("a.h", 28)],
                     "effective_page_identity": {
                         "schema": "cadr-m7-effective-page-identity-stream-v1",
                         "profile": "CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v2",
                         "disposition": "IDENTITY_ACK_STREAM", "count": 1,
                         "collection_sha256": h(35), "host_transcript_sha256": h(36),
                         "first": {"generation": "1", "request_id": "135",
                                   "transaction_id": "135", "first_block": "1299",
                                   "boundary": "1366722"}},
                     "termination": {"pending_requests": 0, "terminated": True},
                     "framebuffer_checkpoint": {"boundary": "982990214", "cdrdisp1_sha256": h(29), "cdrm6i1_sha256": h(30)},
                     "cdrdisp_file": file("portable/frame.cdrdisp1", 29), "witness_file": file("portable/witness.cdrm6i1", 30), "ready_file": file("portable/ready.json", 31), "worker_log_file": file("portable/worker.ndjson", 32),
                     "effective_page_identity_file": file("portable/effective-page-identity.json", 35),
                     "host_transcript_file": file("portable/host-transcript.cdrm6hs1", 36)},
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


def identity_sidecars(module):
    artifact_set = bytes.fromhex(h(55))
    profile = module.IDENTITY_PROFILE
    selected_hash = module.IDENTITY_SELECTED_PAGE_SHA256
    overlay_hash, base_zero_hash = h(49), h(50)
    empty_hash = module.sha256(b"")
    tagged = lambda value: {"u64": str(value)}
    tagged_bytes = lambda value: {"bytes": value}

    def descriptor(operation, request_id, first_block):
        if operation == 2:
            return struct.pack("<QQII", request_id, first_block, 1, 1024)
        return struct.pack("<QII", first_block, 1, 1024)

    def pair(ordinal, operation, request_id, first_block, boundary, page_hash,
             issue_overlay, completion_overlay):
        descriptor_bytes = descriptor(operation, request_id, first_block)
        descriptor_hash = bytes.fromhex(module.sha256(descriptor_bytes))
        payload_hash = bytes.fromhex(page_hash if operation == 2 else empty_hash)
        completion_hash = bytes.fromhex(empty_hash if operation == 2 else page_hash)
        result = []
        for actor, record_ordinal, record_boundary, overlay_generation in (
                (1, ordinal, boundary, issue_overlay),
                (2, ordinal + 1, boundary, completion_overlay)):
            record = bytearray(256)
            struct.pack_into("<QIIQQQQIIQQQQI", record, 0, record_ordinal, actor,
                             operation, record_boundary, boundary, 1, request_id,
                             0, 1, len(descriptor_bytes),
                             1024 if operation == 2 else 0,
                             0 if operation == 2 else 1024, first_block, 1024)
            struct.pack_into("<Q", record, 96, overlay_generation)
            record[104:136] = descriptor_hash
            record[136:168] = payload_hash
            record[168:200] = completion_hash if actor == 2 else bytes.fromhex(empty_hash)
            result.append(bytes(record))
        return result

    records = []
    records += pair(0, 2, 1, 1, 1_000_000, overlay_hash, 0, 1)
    records += pair(2, 1, 2, 1, 1_000_001, overlay_hash, 1, 1)
    records += pair(4, 1, 3, 0, 1_000_002, base_zero_hash, 1, 1)
    records += pair(6, 1, 134, 187956, 1_366_543, selected_hash, 1, 1)
    records += pair(8, 2, 135, 1299, 1_366_722, selected_hash, 1, 1)
    transcript = bytearray(64)
    transcript[:8] = b"CDRM6HS1"
    struct.pack_into("<IIII", transcript, 8, 1, 64, 256, len(records))
    transcript[24:56] = artifact_set
    transcript_raw = bytes(transcript) + b"".join(records)

    def boot_request(request_id, transaction_id, first_block, boundary, page_hash):
        return {"generation": tagged(1), "request_id": tagged(request_id),
                "transaction_id": tagged(transaction_id), "first_block": tagged(first_block),
                "issue_boundary": tagged(boundary), "completion_boundary": tagged(boundary),
                "page_sha256": tagged_bytes(page_hash)}

    arm = {"schema": "cadr-m7-effective-page-identity-arm-v2", "profile": profile,
           "initial_commit": boot_request(1, 1, 1, 1_000_000, overlay_hash),
           "comparison_read": boot_request(2, 0, 1, 1_000_001, overlay_hash),
           "base_read": boot_request(3, 0, 0, 1_000_002, base_zero_hash),
           "quiet_suffix": {"boundary": tagged(1_030_044), "reason": 1,
                            "persistent_status": 0, "outstanding_request_id": tagged(0)}}

    def link(ordinal):
        return {"issue_ordinal": ordinal,
                "issue_record_sha256": tagged_bytes(module.sha256(records[ordinal])),
                "completion_ordinal": ordinal + 1,
                "completion_record_sha256": tagged_bytes(module.sha256(records[ordinal + 1]))}

    overlay_root = module.sha256(b"CDRM4OVERLAY1\0" +
                                 bytes.fromhex(module.IDENTITY_SELECTED_BASE_SHA256) +
                                 (1).to_bytes(8, "little") + (1).to_bytes(8, "little") +
                                 bytes.fromhex(overlay_hash))
    media = {"dirty": True, "overlay_generation": tagged(1),
             "overlay_root_sha256": tagged_bytes(overlay_root),
             "persistent": False, "staged": False}
    candidate_descriptor = descriptor(2, 135, 1299)
    acknowledgement = {
        "schema": "cadr-m7-effective-page-identity-evidence-v4",
        "profile": profile,
        "disposition": "IDENTITY_ACK", "acknowledgement_ordinal": 0,
        "arm": arm,
        "selected_base": {"byte_count": tagged(module.IDENTITY_SELECTED_BASE_BYTES),
                          "sha256": tagged_bytes(module.IDENTITY_SELECTED_BASE_SHA256)},
        "preceding_read": {"generation": tagged(1), "request_id": tagged(134),
                           "first_block": tagged(187956),
                           "issue_boundary": tagged(1_366_543),
                           "completion_boundary": tagged(1_366_543),
                           "page_sha256": tagged_bytes(selected_hash)},
        "request": {"generation": tagged(1), "request_id": tagged(135),
                    "transaction_id": tagged(135), "first_block": tagged(1299),
                    "block_count": 1, "block_bytes": 1024,
                    "issue_boundary": tagged(1_366_722), "due_boundary": tagged(1_366_722),
                    "completion_boundary": tagged(1_366_722), "host_status": 0,
                    "descriptor": tagged_bytes(candidate_descriptor.hex()),
                    "descriptor_sha256": tagged_bytes(module.sha256(candidate_descriptor)),
                    "payload_sha256": tagged_bytes(selected_hash)},
        "effective_page": {"source": "base", "first_block": tagged(1299),
                           "byte_offset": tagged(1299 * 1024), "byte_count": 1024,
                           "sha256": tagged_bytes(selected_hash)},
        "target_rereads": {"pre_success_sha256": tagged_bytes(selected_hash),
                           "post_completion_sha256": tagged_bytes(selected_hash)},
        "media_before": media, "media_after": json_clone(media),
        "transcript": {"schema": "CDRM6HS1", "issue_ordinal": 8,
                       "completion_ordinal": 9,
                       "sha256": tagged_bytes(module.sha256(transcript_raw)),
                       "artifact_set_sha256": tagged_bytes(artifact_set.hex()),
                       "issue_record_sha256": tagged_bytes(module.sha256(records[8])),
                       "completion_record_sha256": tagged_bytes(module.sha256(records[9])),
                       "arm_records": {"initial_commit": link(0),
                                       "comparison_read": link(2), "base_read": link(4)}},
    }
    stream = {
        "schema": "cadr-m7-effective-page-identity-stream-v1",
        "profile": acknowledgement["profile"], "disposition": "IDENTITY_ACK_STREAM",
        "count": 1,
        "first": {"generation": tagged(1), "request_id": tagged(135),
                  "transaction_id": tagged(135), "first_block": tagged(1299),
                  "boundary": tagged(1366722)},
        "host_transcript": {"schema": "CDRM6HS1", "byte_count": tagged(len(transcript_raw)),
                            "record_count": len(records),
                            "sha256": tagged_bytes(module.sha256(transcript_raw)),
                            "artifact_set_sha256": tagged_bytes(artifact_set.hex())},
        "acknowledgements": [acknowledgement],
    }
    return (json.dumps(stream, sort_keys=True, separators=(",", ":")).encode() + b"\n",
            transcript_raw)


def forged_consistent_unselected_identity(module):
    raw, transcript_raw = identity_sidecars(module)
    stream = json.loads(raw)
    acknowledgement = stream["acknowledgements"][0]
    tagged = lambda value: {"u64": str(value)}
    tagged_bytes = lambda value: {"bytes": value}
    forged_hash = h(88)
    descriptor = struct.pack("<QQII", 999, 5, 1, 1024)
    forged_transcript = bytearray(transcript_raw)
    for ordinal in (8, 9):
        offset = 64 + ordinal * 256
        struct.pack_into("<QQ", forged_transcript, offset + 16, 42, 42)
        struct.pack_into("<Q", forged_transcript, offset + 40, 999)
        struct.pack_into("<Q", forged_transcript, offset + 80, 5)
        forged_transcript[offset + 104:offset + 136] = bytes.fromhex(module.sha256(descriptor))
        forged_transcript[offset + 136:offset + 168] = bytes.fromhex(forged_hash)
    transcript_bytes = bytes(forged_transcript)
    acknowledgement["arm"] = {}
    acknowledgement["selected_base"] = {}
    acknowledgement["media_before"] = {}
    acknowledgement["media_after"] = {}
    acknowledgement["preceding_read"] = None
    acknowledgement["request"].update({
        "request_id": tagged(999), "transaction_id": tagged(999),
        "first_block": tagged(5), "issue_boundary": tagged(42),
        "due_boundary": tagged(42), "completion_boundary": tagged(42),
        "descriptor": tagged_bytes(descriptor.hex()),
        "descriptor_sha256": tagged_bytes(module.sha256(descriptor)),
        "payload_sha256": tagged_bytes(forged_hash),
    })
    acknowledgement["effective_page"].update({
        "first_block": tagged(5), "byte_offset": tagged(5 * 1024),
        "sha256": tagged_bytes(forged_hash),
    })
    acknowledgement["target_rereads"] = {
        "pre_success_sha256": tagged_bytes(forged_hash),
        "post_completion_sha256": tagged_bytes(forged_hash),
    }
    acknowledgement["transcript"].update({
        "sha256": tagged_bytes(module.sha256(transcript_bytes)),
        "issue_record_sha256": tagged_bytes(module.sha256(
            transcript_bytes[64 + 8 * 256:64 + 9 * 256])),
        "completion_record_sha256": tagged_bytes(module.sha256(
            transcript_bytes[64 + 9 * 256:64 + 10 * 256])),
    })
    stream["host_transcript"]["sha256"] = tagged_bytes(module.sha256(transcript_bytes))
    stream["first"] = {"generation": tagged(1), "request_id": tagged(999),
                       "transaction_id": tagged(999), "first_block": tagged(5),
                       "boundary": tagged(42)}
    summary = {"profile": module.IDENTITY_PROFILE, "count": 1,
               "first": {"generation": "1", "request_id": "999",
                         "transaction_id": "999", "first_block": "5", "boundary": "42"}}
    return (json.dumps(stream, sort_keys=True, separators=(",", ":")).encode() + b"\n",
            transcript_bytes, summary)


def consistent_two_ack_identity(module, boundary):
    raw, transcript_raw = identity_sidecars(module)
    stream = json.loads(raw)
    tagged = lambda value: {"u64": str(value)}
    tagged_bytes = lambda value: {"bytes": value}
    request_id, first_block = 137, 1300
    descriptor = struct.pack("<QQII", request_id, first_block, 1, 1024)
    descriptor_hash = module.sha256(descriptor)

    transcript = bytearray(transcript_raw)
    for source_ordinal, ordinal in ((8, 10), (9, 11)):
        source = 64 + source_ordinal * 256
        record = bytearray(transcript[source:source + 256])
        struct.pack_into("<Q", record, 0, ordinal)
        struct.pack_into("<QQ", record, 16, boundary, boundary)
        struct.pack_into("<Q", record, 40, request_id)
        struct.pack_into("<Q", record, 80, first_block)
        record[104:136] = bytes.fromhex(descriptor_hash)
        transcript.extend(record)
    struct.pack_into("<I", transcript, 20, 12)
    transcript_bytes = bytes(transcript)
    transcript_hash = module.sha256(transcript_bytes)

    first_acknowledgement = stream["acknowledgements"][0]
    first_acknowledgement["transcript"]["sha256"] = tagged_bytes(transcript_hash)
    second = json_clone(first_acknowledgement)
    second["acknowledgement_ordinal"] = 1
    second["preceding_read"] = None
    second["request"].update({
        "request_id": tagged(request_id), "transaction_id": tagged(request_id),
        "first_block": tagged(first_block), "issue_boundary": tagged(boundary),
        "due_boundary": tagged(boundary), "completion_boundary": tagged(boundary),
        "descriptor": tagged_bytes(descriptor.hex()),
        "descriptor_sha256": tagged_bytes(descriptor_hash),
    })
    second["effective_page"].update({
        "first_block": tagged(first_block), "byte_offset": tagged(first_block * 1024),
    })
    second["transcript"].update({
        "issue_ordinal": 10, "completion_ordinal": 11,
        "issue_record_sha256": tagged_bytes(module.sha256(
            transcript_bytes[64 + 10 * 256:64 + 11 * 256])),
        "completion_record_sha256": tagged_bytes(module.sha256(
            transcript_bytes[64 + 11 * 256:64 + 12 * 256])),
    })
    stream["acknowledgements"].append(second)
    stream["count"] = 2
    stream["host_transcript"].update({
        "byte_count": tagged(len(transcript_bytes)), "record_count": 12,
        "sha256": tagged_bytes(transcript_hash),
    })
    summary = {"profile": module.IDENTITY_PROFILE, "count": 2,
               "first": {"generation": "1", "request_id": "135",
                         "transaction_id": "135", "first_block": "1299",
                         "boundary": "1366722"}}
    return (json.dumps(stream, sort_keys=True, separators=(",", ":")).encode() + b"\n",
            transcript_bytes, summary)


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
            for path in ("AGENTS.md", module.IDENTITY_PATH,
                         module.HOST_TRANSCRIPT_PATH):
                try:
                    urlopen(Request(f"{base}/{path}", method=method))
                except HTTPError as exc:
                    assert exc.code == 404
                else:
                    raise AssertionError(
                        f"P5 server exposed non-served evidence {path} to {method}")
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
    identity_raw, identity_transcript = identity_sidecars(module)
    module.validate_identity_stream(identity_raw, identity_transcript,
                                    manifest["portable"]["effective_page_identity"])
    identity_schema_bool_mutations_rejected = 0
    for mutate in (
            lambda value: value["acknowledgements"][0]["request"].__setitem__(
                "host_status", False),
            lambda value: value["acknowledgements"][0].__setitem__(
                "acknowledgement_ordinal", False),
            lambda value: value["acknowledgements"][0]["arm"]["quiet_suffix"].__setitem__(
                "reason", True)):
        candidate = json.loads(identity_raw); mutate(candidate)
        candidate_raw = json.dumps(candidate, sort_keys=True,
                                   separators=(",", ":")).encode() + b"\n"
        try:
            module.validate_identity_stream(
                candidate_raw, identity_transcript,
                manifest["portable"]["effective_page_identity"])
        except module.BrowserConformanceError:
            identity_schema_bool_mutations_rejected += 1
        else:
            raise AssertionError("P5 accepted a boolean in an untagged identity u32 field")
    forged_raw, forged_transcript, forged_summary = forged_consistent_unselected_identity(module)
    try:
        module.validate_identity_stream(forged_raw, forged_transcript, forged_summary)
    except module.BrowserConformanceError:
        identity_forgery_rejected = True
    else:
        raise AssertionError(
            "P5 accepted forged request 999/LBA 5/boundary 42 with empty arm/base/media")
    monotonic_raw, monotonic_transcript, monotonic_summary = \
        consistent_two_ack_identity(module, 1_400_000)
    module.validate_identity_stream(monotonic_raw, monotonic_transcript,
                                    monotonic_summary)
    regressing_raw, regressing_transcript, regressing_summary = \
        consistent_two_ack_identity(module, 1_200_000)
    try:
        module.validate_identity_stream(regressing_raw, regressing_transcript,
                                        regressing_summary)
    except module.BrowserConformanceError:
        identity_boundary_regression_rejected = True
    else:
        raise AssertionError(
            "P5 accepted second request 137 at boundary 1200000 after completion 1366722")
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
        identity_raw, host_transcript_raw = identity_sidecars(module)
        payloads = {
            "native/frame.cdrm7n1": native,
            "native/capture.ndjson": b"native-log\n",
            "native/idle.bin": b"idle",
            "native/metadata.json": b"{}",
            "portable/frame.cdrdisp1": record,
            "portable/witness.cdrm6i1": b"witness",
            "portable/ready.json": b"{}",
            "portable/worker.ndjson": b"worker\n",
            module.IDENTITY_PATH: identity_raw,
            module.HOST_TRANSCRIPT_PATH: host_transcript_raw,
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
            module.IDENTITY_PATH: on_disk["portable"]["effective_page_identity_file"],
            module.HOST_TRANSCRIPT_PATH: on_disk["portable"]["host_transcript_file"],
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
        on_disk["portable"]["effective_page_identity"]["collection_sha256"] = \
            receipt_fields[module.IDENTITY_PATH]["sha256"]
        on_disk["portable"]["effective_page_identity"]["host_transcript_sha256"] = \
            receipt_fields[module.HOST_TRANSCRIPT_PATH]["sha256"]
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
    def duplicate_worker_file(value):
        closure = value["portable"]["worker_closure"]
        closure["files"].append(json_clone(closure["files"][0]))
        closure["tree_sha256"] = hashlib.sha256(json.dumps({
            "builtins": closure["builtins"], "files": closure["files"],
            "node": closure["node"],
        }, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    p4_mutations_rejected = 0
    for mutate in (
            lambda value: value["artifacts"].pop(),
            lambda value: value["native_inputs"].pop(),
            lambda value: value["schedule"].__setitem__("sha256", "bad"),
            lambda value: value["native"]["private_disk"].__setitem__("sha256_at_end", h(92)),
            lambda value: value["native"]["process"].__setitem__("pending_host_requests", 1),
            lambda value: value["native"]["capture"].__setitem__("schema", "OTHER"),
            lambda value: value["native"]["capture"].__setitem__("byte_count", "1"),
            lambda value: value["portable"]["termination"].__setitem__("pending_requests", 1),
            lambda value: value["portable"]["effective_page_identity"].__setitem__("collection_sha256", "bad"),
            lambda value: value["portable"]["framebuffer_checkpoint"].__setitem__("cdrdisp1_sha256", h(92)),
            duplicate_worker_file,
            lambda value: value["portable"]["cdrdisp_file"].__setitem__("path", "synthetic"),
            lambda value: value["comparison"].__setitem__("portable_record_sha256", h(93)),
            lambda value: value["summary"].__setitem__("portable_frame_sha256", h(94))):
        candidate = json_clone(manifest); mutate(candidate)
        try:
            module.validate_p4_manifest(candidate, module.canonical(candidate))
        except module.BrowserConformanceError:
            p4_mutations_rejected += 1
        else:
            raise AssertionError("mutated P4 binding was accepted")
    result = p5_result(module)
    assert module.validate_p5_result(result) is result
    p5_mutations_rejected = 0
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
            p5_mutations_rejected += 1
        else:
            raise AssertionError("mutated P5 result was accepted")
    assert identity_forgery_rejected is True
    assert identity_boundary_regression_rejected is True
    assert identity_schema_bool_mutations_rejected == 3
    assert p4_mutations_rejected == 14
    assert p5_mutations_rejected == 15
    print("cadr M7 P5 conformance schema tests passed; "
          "identity_forgery=1 identity_boundary_regression=1 "
          "identity_schema_bool_mutations=3 identity_mutations=5 "
          "p4_mutations=14 p5_mutations=15")


def json_clone(value):
    import json
    return json.loads(json.dumps(value))


if __name__ == "__main__":
    main()
