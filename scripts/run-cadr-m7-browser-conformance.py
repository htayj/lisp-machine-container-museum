#!/usr/bin/env python3
"""Run M7-P5 against a P4 CDRDISP1 checkpoint in headed Chromium on Xvfb.

The only served frame is the private P4 ``portable/frame.cdrdisp1`` file.  It
is exposed over a loopback endpoint with ``Cache-Control: no-store`` and then
rendered through the production M7 browser host.  This script intentionally
does not accept the synthetic demo input and treats a fullscreen denial as a
campaign failure, not as a headless-automation fallback.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from struct import unpack
from threading import Thread
from typing import Any
from urllib.parse import urlparse
from zlib import decompress


ROOT = Path(__file__).resolve().parents[1]
PRIVATE_ROOT = ROOT / "build/cadr-oracle"
CHROMIUM = Path("/usr/bin/chromium")
XVFB = Path("/usr/bin/Xvfb")
P5_SCHEMA = "cadr-m7-browser-conformance-result-v1"
P5_TARGET = "CADR-WEB-303/ABI1.5/protocol-v5/M7"
WIDTH, HEIGHT, STRIDE_WORDS, ACTIVE_WORDS = 768, 963, 24, 23112
FRAME_PATH = "portable/frame.cdrdisp1"
TIMEOUT_MS = 20_000
XAUTH = Path("/usr/bin/xauth")
P5_PAGE = b"""<!doctype html><html><head><meta charset=\"utf-8\"><link rel=\"stylesheet\" href=\"/cadr-web/browser/m7-host.css\"></head><body><main id=\"cadr-m7-demo\"></main><script type=\"module\">import {createM7BrowserHost} from \"/cadr-web/browser/m7-host.mjs\";const r=await fetch(\"/p4-frame.cdrdisp1\",{cache:\"no-store\"});if(!r.ok)throw new Error(\"P4 frame fetch failed\");window.cadrM7Demo=createM7BrowserHost({root:document.querySelector(\"#cadr-m7-demo\"),record:new Uint8Array(await r.arrayBuffer())});document.documentElement.dataset.cadrM7Ready=\"true\";</script></body></html>"""


class BrowserConformanceError(ValueError):
    """A P4 input or P5 browser observation is incomplete or unsafe."""


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True).encode("utf-8")


def reject_duplicate_members(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise BrowserConformanceError(f"duplicate JSON member {key!r}")
        value[key] = item
    return value


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest(value: Any, label: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise BrowserConformanceError(f"{label} must be a lowercase SHA-256")
    return value


def exact_keys(value: Any, keys: list[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != set(keys):
        raise BrowserConformanceError(f"{label} has missing or unknown fields")
    return value


def owned_directory(path: Path, label: str, *, mode: int = 0o700) -> Path:
    try:
        info = path.lstat()
    except OSError as exc:
        raise BrowserConformanceError(f"{label} is unavailable") from exc
    if (path.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or
            (info.st_mode & 0o7777) != mode):
        raise BrowserConformanceError(f"{label} must be a current-owner non-symlink {mode:04o} directory")
    return path


def owned_file(path: Path, label: str, *, mode: int = 0o600) -> os.stat_result:
    try:
        info = path.lstat()
    except OSError as exc:
        raise BrowserConformanceError(f"{label} is unavailable") from exc
    if (path.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or
            info.st_nlink != 1 or (info.st_mode & 0o7777) != mode):
        raise BrowserConformanceError(f"{label} must be a current-owner singly linked {mode:04o} regular file")
    return info


def private_relative(value: str, label: str) -> Path:
    if not isinstance(value, str) or not value:
        raise BrowserConformanceError(f"{label} must be a non-empty repository-relative path")
    path = Path(value)
    if path.is_absolute() or ".." in path.parts:
        raise BrowserConformanceError(f"{label} escapes the repository")
    candidate = (ROOT / path).resolve()
    try:
        candidate.relative_to(PRIVATE_ROOT.resolve())
    except ValueError as exc:
        raise BrowserConformanceError(f"{label} must remain below ignored build/cadr-oracle") from exc
    return candidate


def read_canonical_json(path: Path, label: str) -> tuple[dict[str, Any], bytes]:
    owned_file(path, label)
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_members)
    except (UnicodeDecodeError, json.JSONDecodeError, BrowserConformanceError) as exc:
        raise BrowserConformanceError(f"{label} is not unique UTF-8 JSON") from exc
    if not isinstance(value, dict) or raw != canonical(value):
        raise BrowserConformanceError(f"{label} is not canonical JSON bytes")
    return value, raw


def parse_cdrdisp1(raw: bytes) -> dict[str, Any]:
    """Parse the exact full P4 transfer without importing browser code."""
    if len(raw) != 80 + 16 + ACTIVE_WORDS * 4:
        raise BrowserConformanceError("CDRDISP1 does not have the exact full-frame length")
    if raw[:8] != b"CDRDISP1":
        raise BrowserConformanceError("CDRDISP1 magic is wrong")
    view = memoryview(raw)
    u16 = lambda offset: int.from_bytes(view[offset:offset + 2], "little")
    u32 = lambda offset: int.from_bytes(view[offset:offset + 4], "little")
    u64 = lambda offset: int.from_bytes(view[offset:offset + 8], "little")
    flags = u32(12)
    if (u16(8), u16(10), flags, u64(16) > 0, u64(24) > 0,
            u32(32), u32(36), u32(40), u32(44), u32(48), u32(56), u32(60),
            u64(64), u64(72)) != (1, 80, 3 if (u32(52) >> 2) & 1 == 0 else 1,
                                       True, True, WIDTH, HEIGHT, STRIDE_WORDS, 32768,
                                       ACTIVE_WORDS, 1, ACTIVE_WORDS, ACTIVE_WORDS * 4,
                                       len(raw)):
        raise BrowserConformanceError("CDRDISP1 has an invalid full-frame header")
    if (u32(80), u32(84), u32(88), u32(92)) != (0, 0, WIDTH, HEIGHT):
        raise BrowserConformanceError("CDRDISP1 does not have one full rectangle")
    tv_mode = u32(52)
    bow = bool((tv_mode >> 2) & 1)
    return {"raw": raw, "sha256": sha256(raw), "machine_generation": str(u64(16)),
            "framebuffer_generation": str(u64(24)), "tv_mode": tv_mode, "bow": bow,
            "payload": raw[96:]}


def parse_cdrm7n1(raw: bytes) -> dict[str, Any]:
    if len(raw) != 64 + ACTIVE_WORDS * 4 or raw[:7] != b"CDRM7N1":
        raise BrowserConformanceError("CDRM7N1 has the wrong fixed size or magic")
    if raw[7] != 0 or any(raw[52:64]):
        raise BrowserConformanceError("CDRM7N1 reserved bytes are nonzero")
    u32 = lambda offset: int.from_bytes(raw[offset:offset + 4], "little")
    u64 = lambda offset: int.from_bytes(raw[offset:offset + 8], "little")
    if (u32(8), u32(12), u64(16), u32(24), u32(28), u32(36), u32(40),
            u32(44), u32(48)) != (1, 64, 982_990_214, WIDTH, HEIGHT, 1,
                                  32768, ACTIVE_WORDS, ACTIVE_WORDS * 4):
        raise BrowserConformanceError("CDRM7N1 header fields are wrong")
    tv_mode = u32(32)
    return {"schema": "CDRM7N1", "sha256": sha256(raw), "byte_count": str(len(raw)),
            "boundary": str(u64(16)), "width": WIDTH, "height": HEIGHT,
            "stride_words": STRIDE_WORDS, "backing_words": 32768,
            "active_words": ACTIVE_WORDS, "tv_mode": tv_mode,
            "black_on_white": bool((tv_mode >> 2) & 1),
            "raw_words_sha256": sha256(raw[64:])}


def positive_integer(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise BrowserConformanceError(f"{label} must be a positive integer")
    return value


def canonical_u64(value: Any, label: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"0|[1-9][0-9]*", value) or int(value) > 0xffffffffffffffff:
        raise BrowserConformanceError(f"{label} must be a canonical u64")
    return value


def file_identity(value: Any, label: str, expected_path: str | None = None) -> dict[str, Any]:
    identity = exact_keys(value, ["bytes", "path", "sha256"], label)
    if (not isinstance(identity["path"], str) or not identity["path"] or
            Path(identity["path"]).is_absolute() or ".." in Path(identity["path"]).parts):
        raise BrowserConformanceError(f"{label} path is not private and relative")
    if expected_path is not None and identity["path"] != expected_path:
        raise BrowserConformanceError(f"{label} path differs from the exact session layout")
    positive_integer(identity["bytes"], f"{label} bytes")
    digest(identity["sha256"], f"{label} hash")
    return identity


def rehash_p4_sidecar(session: Path, relative_path: str, identity: dict[str, Any], label: str) -> None:
    path = session / relative_path
    info = owned_file(path, label)
    raw = path.read_bytes()
    if info.st_size != identity["bytes"] or sha256(raw) != identity["sha256"]:
        raise BrowserConformanceError(f"{label} bytes differ from the P4 receipt")


def validate_p4_manifest(value: dict[str, Any], raw: bytes,
                         session: Path | None = None) -> dict[str, Any]:
    """Validate the complete closed P4 schema and optionally rehash every sidecar."""
    exact_keys(value, ["artifacts", "comparison", "m6_release_record", "native", "native_inputs",
                       "outcome", "patches", "portable", "prepared", "runtime_execution_performed",
                       "schedule", "schema", "session", "source", "summary", "target"], "P4 manifest")
    if (value["schema"] != "cadr-m7-frame-conformance-result-v1" or
            value["target"] != P5_TARGET or value["outcome"] != "identical" or
            value["runtime_execution_performed"] is not True):
        raise BrowserConformanceError("P4 manifest is not a successful M7-P4 result")
    exact_keys(value["session"], ["id", "mode"], "P4 session")
    if not isinstance(value["session"]["id"], str) or not value["session"]["id"] or value["session"]["mode"] != "0700":
        raise BrowserConformanceError("P4 session identity is not private")
    if session is not None and value["session"]["id"] != session.name:
        raise BrowserConformanceError("P4 manifest session ID differs from the supplied directory")
    exact_keys(value["source"], ["system_fossil", "usim_fossil"], "P4 source")
    for field in ("system_fossil", "usim_fossil"):
        digest(value["source"][field], f"P4 source.{field}")
    file_identity(value["m6_release_record"], "P4 M6 release",
                  "cadr-web/oracle/cadr-m6-release-record.json")
    exact_keys(value["patches"], ["m6_sha256", "m7_sha256", "m7_support"], "P4 patches")
    digest(value["patches"]["m6_sha256"], "P4 M6 patch"); digest(value["patches"]["m7_sha256"], "P4 M7 patch")
    if not isinstance(value["patches"]["m7_support"], list) or len(value["patches"]["m7_support"]) != 2:
        raise BrowserConformanceError("P4 M7 support binding is incomplete")
    for index, support in enumerate(value["patches"]["m7_support"]):
        exact_keys(support, ["bytes", "installed_as", "path", "sha256"], f"P4 support {index}")
        positive_integer(support["bytes"], f"P4 support {index} bytes")
        digest(support["sha256"], f"P4 support {index} hash")
        if not all(isinstance(support[field], str) and support[field] for field in ("path", "installed_as")):
            raise BrowserConformanceError(f"P4 support {index} path is absent")
    exact_keys(value["prepared"], ["executable", "path", "source_file_count", "source_tree_sha256"],
               "P4 prepared")
    positive_integer(value["prepared"]["source_file_count"], "P4 prepared file count")
    digest(value["prepared"]["source_tree_sha256"], "P4 prepared tree")
    executable = exact_keys(value["prepared"]["executable"],
                            ["bytes", "forbidden_undefined_symbol_count", "m6_patch_sha256",
                             "m7_patch_sha256", "path", "prepared_source_file_count",
                             "prepared_source_tree_sha256", "sha256"], "P4 executable")
    positive_integer(executable["bytes"], "P4 executable bytes")
    positive_integer(executable["prepared_source_file_count"], "P4 executable source count")
    if executable["forbidden_undefined_symbol_count"] != 0:
        raise BrowserConformanceError("P4 executable has forbidden undefined symbols")
    for field in ("m6_patch_sha256", "m7_patch_sha256", "prepared_source_tree_sha256", "sha256"):
        digest(executable[field], f"P4 executable {field}")
    if not isinstance(value["artifacts"], list) or len(value["artifacts"]) != 5:
        raise BrowserConformanceError("P4 five-artifact binding is incomplete")
    for index, artifact in enumerate(value["artifacts"]):
        exact_keys(artifact, ["byte_count", "kind", "sha256"], f"P4 artifact {index}")
        positive_integer(artifact["kind"], f"P4 artifact {index} kind")
        canonical_u64(artifact["byte_count"], f"P4 artifact {index} bytes")
        digest(artifact["sha256"], f"P4 artifact {index} hash")
    if not isinstance(value["native_inputs"], list) or len(value["native_inputs"]) != 1:
        raise BrowserConformanceError("P4 native-host binding is incomplete")
    native_input = exact_keys(value["native_inputs"][0], ["byte_count", "id", "sha256"], "P4 native input")
    canonical_u64(native_input["byte_count"], "P4 native input bytes")
    digest(native_input["sha256"], "P4 native input hash")
    if not isinstance(native_input["id"], str) or not native_input["id"]:
        raise BrowserConformanceError("P4 native input id is absent")
    exact_keys(value["schedule"], ["event_count", "mapping_sha256", "sha256"], "P4 schedule")
    positive_integer(value["schedule"]["event_count"], "P4 schedule events")
    for field in ("sha256", "mapping_sha256"):
        digest(value["schedule"][field], f"P4 schedule.{field}")
    exact_keys(value["native"], ["capture", "frame_file", "idle_file", "metadata_file", "oracle_process",
                                 "private_disk", "private_disk_instance_id", "process", "session_id", "transcript_file"],
               "P4 native")
    if not all(isinstance(value["native"][field], str) and value["native"][field]
               for field in ("session_id", "private_disk_instance_id")):
        raise BrowserConformanceError("P4 native session/private-disk identity is absent")
    disk = exact_keys(value["native"]["private_disk"], ["sha256_at_end", "sha256_at_start"],
                      "P4 native disk")
    digest(disk["sha256_at_start"], "P4 native disk start")
    digest(disk["sha256_at_end"], "P4 native disk end")
    if disk["sha256_at_start"] != disk["sha256_at_end"]:
        raise BrowserConformanceError("P4 native private disk changed")
    process = exact_keys(value["native"]["process"],
                         ["forced_stop", "pending_host_requests", "returncode",
                          "state_may_be_incomplete", "timed_out"], "P4 native process")
    if process != {"returncode": 0, "timed_out": False, "forced_stop": False,
                   "state_may_be_incomplete": False, "pending_host_requests": 0}:
        raise BrowserConformanceError("P4 native process did not terminate cleanly")
    oracle_process = exact_keys(value["native"]["oracle_process"], ["returncode", "signal"],
                                "P4 native oracle process")
    if oracle_process != {"returncode": 0, "signal": None}:
        raise BrowserConformanceError("P4 native oracle child did not terminate cleanly")
    capture = exact_keys(value["native"]["capture"],
                         ["active_words", "backing_words", "black_on_white", "boundary",
                          "byte_count", "height", "raw_words_sha256", "schema", "sha256",
                          "stride_words", "tv_mode", "width"], "P4 native capture")
    if (capture["schema"], capture["boundary"], capture["width"], capture["height"],
            capture["stride_words"], capture["backing_words"], capture["active_words"],
            capture["black_on_white"]) != ("CDRM7N1", "982990214", WIDTH, HEIGHT,
                                            STRIDE_WORDS, 32768, ACTIVE_WORDS, True):
        raise BrowserConformanceError("P4 native capture identity is wrong")
    if capture["byte_count"] != str(64 + ACTIVE_WORDS * 4):
        raise BrowserConformanceError("P4 native capture byte count is not the fixed CDRM7N1 size")
    if not isinstance(capture["tv_mode"], int) or isinstance(capture["tv_mode"], bool) or not 0 <= capture["tv_mode"] <= 0xffffffff:
        raise BrowserConformanceError("P4 native tv_mode is not uint32")
    if bool((capture["tv_mode"] >> 2) & 1) is not capture["black_on_white"]:
        raise BrowserConformanceError("P4 native BOW flag differs from tv_mode")
    digest(capture["sha256"], "P4 native capture hash")
    digest(capture["raw_words_sha256"], "P4 native raw words")
    native_files = {
        "frame_file": ("native/frame.cdrm7n1", value["native"]["frame_file"]),
        "transcript_file": ("native/capture.ndjson", value["native"]["transcript_file"]),
        "idle_file": ("native/idle.bin", value["native"]["idle_file"]),
        "metadata_file": ("native/metadata.json", value["native"]["metadata_file"]),
    }
    for name, (_path, identity) in native_files.items():
        file_identity(identity, f"P4 native {name}")
    exact_keys(value["portable"], ["cdrdisp_file", "contemporaneous_adapter_observation",
                                    "effective_page_identity", "framebuffer_checkpoint", "module", "ready_file",
                                    "session_evidence", "session_id", "termination",
                                    "witness_file", "worker", "worker_closure",
                                    "worker_log_file"], "P4 portable")
    evidence = exact_keys(value["portable"]["session_evidence"],
                          ["ready_session_id", "worker_log_session_id"], "P4 portable session evidence")
    if (not isinstance(value["portable"]["session_id"], str) or not value["portable"]["session_id"] or
            evidence != {"ready_session_id": value["portable"]["session_id"],
                         "worker_log_session_id": value["portable"]["session_id"]}):
        raise BrowserConformanceError("P4 portable session evidence is not bound")
    termination = exact_keys(value["portable"]["termination"], ["pending_requests", "terminated"],
                             "P4 portable termination")
    if termination != {"pending_requests": 0, "terminated": True}:
        raise BrowserConformanceError("P4 portable worker did not terminate cleanly")
    identity = exact_keys(value["portable"]["effective_page_identity"],
                          ["acknowledgement_sha256", "boundary", "disposition",
                           "first_block", "request_id"],
                          "P4 effective-page identity")
    digest(identity["acknowledgement_sha256"],
           "P4 effective-page identity acknowledgement")
    if identity != {
            "acknowledgement_sha256": identity["acknowledgement_sha256"],
            "boundary": "1366722", "disposition": "IDENTITY_ACK",
            "first_block": "1299", "request_id": "135"}:
        raise BrowserConformanceError("P4 effective-page identity is not the selected acknowledgement")
    file_identity(value["portable"]["module"], "P4 portable module")
    worker = file_identity(value["portable"]["worker"], "P4 portable worker")
    closure = exact_keys(value["portable"]["worker_closure"],
                         ["builtins", "entry", "files", "node", "schema",
                          "tree_sha256"], "P4 worker closure")
    if closure["schema"] != "cadr-m7-worker-source-closure-v1" or \
            closure["builtins"] != ["node:worker_threads"]:
        raise BrowserConformanceError("P4 worker closure identity is wrong")
    if file_identity(closure["entry"], "P4 worker closure entry") != worker:
        raise BrowserConformanceError("P4 worker differs from its closure entry")
    if not isinstance(closure["files"], list) or not closure["files"]:
        raise BrowserConformanceError("P4 worker closure files are incomplete")
    closure_files = [
        file_identity(item, f"P4 worker closure file {index}")
        for index, item in enumerate(closure["files"])
    ]
    closure_paths = [item["path"] for item in closure_files]
    if any(left >= right for left, right in
           zip(closure_paths, closure_paths[1:])) or worker not in closure_files:
        raise BrowserConformanceError("P4 worker closure files are not canonical")
    node = exact_keys(closure["node"],
                      ["executable_bytes", "executable_sha256", "version"],
                      "P4 worker Node identity")
    if not isinstance(node["executable_bytes"], int) or \
            isinstance(node["executable_bytes"], bool) or \
            node["executable_bytes"] < 1 or \
            not isinstance(node["version"], str) or \
            not re.fullmatch(r"v[1-9][0-9]*\.[0-9]+\.[0-9]+", node["version"]):
        raise BrowserConformanceError("P4 worker Node identity is malformed")
    digest(node["executable_sha256"], "P4 worker Node executable")
    tree = json.dumps({"builtins": closure["builtins"],
                       "files": closure_files, "node": node},
                      sort_keys=True, separators=(",", ":")).encode()
    if closure["tree_sha256"] != hashlib.sha256(tree).hexdigest():
        raise BrowserConformanceError("P4 worker closure tree hash is wrong")
    observations = value["portable"]["contemporaneous_adapter_observation"]
    if not isinstance(observations, list) or len(observations) != 2:
        raise BrowserConformanceError(
            "P4 contemporaneous adapter observation is incomplete")
    for index, adapter in enumerate(observations):
        file_identity(adapter,
                      f"P4 contemporaneous adapter observation {index}")
    checkpoint = exact_keys(value["portable"]["framebuffer_checkpoint"],
                            ["boundary", "cdrdisp1_sha256", "cdrm6i1_sha256"],
                            "P4 portable checkpoint")
    if checkpoint["boundary"] != "982990214":
        raise BrowserConformanceError("P4 portable checkpoint boundary is wrong")
    digest(checkpoint["cdrdisp1_sha256"], "P4 checkpoint frame")
    digest(checkpoint["cdrm6i1_sha256"], "P4 checkpoint witness")
    frame = file_identity(value["portable"]["cdrdisp_file"], "P4 CDRDISP1 file", FRAME_PATH)
    witness = file_identity(value["portable"]["witness_file"], "P4 witness",
                            "portable/witness.cdrm6i1")
    ready = file_identity(value["portable"]["ready_file"], "P4 ready", "portable/ready.json")
    worker_log = file_identity(value["portable"]["worker_log_file"], "P4 worker log",
                               "portable/worker.ndjson")
    exact_keys(value["comparison"], ["file", "m6_witness_sample_sha256", "native_capture_sha256",
                                      "native_raw_words_sha256", "portable_raw_words_sha256",
                                      "portable_record_sha256"], "P4 comparison")
    if value["comparison"]["portable_record_sha256"] != frame["sha256"]:
        raise BrowserConformanceError("P4 comparison is not bound to its CDRDISP1 input")
    for field in ("m6_witness_sample_sha256", "native_capture_sha256", "native_raw_words_sha256",
                  "portable_raw_words_sha256", "portable_record_sha256"):
        digest(value["comparison"][field], f"P4 comparison.{field}")
    comparison_file = file_identity(value["comparison"]["file"], "P4 comparison file",
                                    "comparison.json")
    exact_keys(value["summary"], ["comparison_sha256", "manifest_kind", "native_frame_sha256", "portable_frame_sha256"], "P4 summary")
    if value["summary"]["manifest_kind"] != "hashes-only" or value["summary"]["portable_frame_sha256"] != frame["sha256"]:
        raise BrowserConformanceError("P4 summary does not bind the portable frame")
    for field in ("comparison_sha256", "native_frame_sha256", "portable_frame_sha256"):
        digest(value["summary"][field], f"P4 summary {field}")
    if (capture["sha256"] != value["native"]["frame_file"]["sha256"] or
            checkpoint["cdrdisp1_sha256"] != frame["sha256"] or
            checkpoint["cdrm6i1_sha256"] != witness["sha256"] or
            value["comparison"]["native_capture_sha256"] != capture["sha256"] or
            value["comparison"]["native_raw_words_sha256"] != capture["raw_words_sha256"] or
            value["comparison"]["portable_record_sha256"] != frame["sha256"] or
            value["comparison"]["m6_witness_sample_sha256"] != witness["sha256"] or
            value["summary"]["comparison_sha256"] != comparison_file["sha256"] or
            value["summary"]["native_frame_sha256"] != capture["sha256"] or
            value["summary"]["portable_frame_sha256"] != frame["sha256"]):
        raise BrowserConformanceError("P4 redundant hashes do not describe one checkpoint")
    if session is not None:
        for name, (path, identity) in native_files.items():
            expected_manifest_path = (session / path).relative_to(ROOT).as_posix()
            if identity["path"] != expected_manifest_path:
                raise BrowserConformanceError(f"P4 native {name} path differs from its session")
            rehash_p4_sidecar(session, path, identity, f"P4 native {name}")
        parsed_native = parse_cdrm7n1((session / "native/frame.cdrm7n1").read_bytes())
        if parsed_native != capture:
            raise BrowserConformanceError("P4 native capture fields differ from rehashed CDRM7N1 bytes")
        for path, identity, label in (
                ("portable/frame.cdrdisp1", frame, "P4 frame"),
                ("portable/witness.cdrm6i1", witness, "P4 witness"),
                ("portable/ready.json", ready, "P4 ready"),
                ("portable/worker.ndjson", worker_log, "P4 worker log"),
                ("comparison.json", comparison_file, "P4 comparison")):
            rehash_p4_sidecar(session, path, identity, label)
    return {"manifest": value, "manifest_sha256": sha256(raw), "frame": frame}


@dataclass(frozen=True)
class RgbaImage:
    width: int
    height: int
    pixels: bytes

    def pixel(self, x: int, y: int) -> tuple[int, int, int, int]:
        if not 0 <= x < self.width or not 0 <= y < self.height:
            raise BrowserConformanceError(f"screenshot sample outside image: {x}, {y}")
        offset = (y * self.width + x) * 4
        return tuple(self.pixels[offset:offset + 4])  # type: ignore[return-value]


def _paeth(left: int, above: int, upper_left: int) -> int:
    prediction = left + above - upper_left
    distances = (abs(prediction - left), abs(prediction - above), abs(prediction - upper_left))
    return (left, above, upper_left)[distances.index(min(distances))]


def decode_png_rgba(path: Path) -> RgbaImage:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise BrowserConformanceError("Chromium did not write a PNG")
    offset, chunks = 8, {}
    while offset < len(data):
        length = unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        body = data[offset + 8:offset + 8 + length]
        chunks.setdefault(kind, []).append(body)
        offset += length + 12
        if kind == b"IEND":
            break
    width, height, bit_depth, colour_type, compression, filtering, interlace = unpack(
        ">IIBBBBB", chunks[b"IHDR"][0])
    if (bit_depth, colour_type, compression, filtering, interlace) not in ((8, 2, 0, 0, 0), (8, 6, 0, 0, 0)):
        raise BrowserConformanceError("Chromium PNG has an unsupported format")
    channels, stride = (4 if colour_type == 6 else 3), width * (4 if colour_type == 6 else 3)
    packed = decompress(b"".join(chunks[b"IDAT"]))
    if len(packed) != height * (stride + 1):
        raise BrowserConformanceError("Chromium PNG is short")
    rows: list[bytes] = []; prior = bytes(stride); source = 0
    for _ in range(height):
        filter_type = packed[source]; source += 1
        encoded = packed[source:source + stride]; source += stride
        row = bytearray(stride)
        for index, item in enumerate(encoded):
            left = row[index - channels] if index >= channels else 0
            above = prior[index]; upper_left = prior[index - channels] if index >= channels else 0
            if filter_type == 0: decoded = item
            elif filter_type == 1: decoded = item + left
            elif filter_type == 2: decoded = item + above
            elif filter_type == 3: decoded = item + (left + above) // 2
            elif filter_type == 4: decoded = item + _paeth(left, above, upper_left)
            else: raise BrowserConformanceError("Chromium PNG has an unknown filter")
            row[index] = decoded & 0xff
        rows.append(bytes(row)); prior = row
    if colour_type == 6:
        return RgbaImage(width, height, b"".join(rows))
    rgba = bytearray(width * height * 4)
    for pixel in range(width * height):
        rgba[pixel * 4:pixel * 4 + 3] = rows[pixel // width][(pixel % width) * 3:(pixel % width) * 3 + 3]
        rgba[pixel * 4 + 3] = 255
    return RgbaImage(width, height, bytes(rgba))


def integer_presentation(viewport_width: int, viewport_height: int) -> dict[str, int | bool]:
    scale = min(viewport_width // WIDTH, viewport_height // HEIGHT)
    if scale < 1:
        return {"fits": False, "scale": 0, "width": 0, "height": 0, "left": 0, "top": 0}
    width, height = WIDTH * scale, HEIGHT * scale
    return {"fits": True, "scale": scale, "width": width, "height": height,
            "left": (viewport_width - width) // 2, "top": (viewport_height - height) // 2}


def assert_visible_pixels(image: RgbaImage, frame: dict[str, Any], plan: dict[str, Any]) -> str:
    scale = int(plan["scale"])
    if image.width != WIDTH * scale or image.height != HEIGHT * scale:
        raise BrowserConformanceError("full-frame screenshot dimensions do not equal integral source rectangles")
    payload = frame["payload"]; bow = frame["bow"]
    black, white = (0, 0, 0, 255), (255, 255, 255, 255)
    for y in range(HEIGHT):
        for x in range(WIDTH):
            word_offset = ((y * STRIDE_WORDS) + x // 32) * 4
            word = int.from_bytes(payload[word_offset:word_offset + 4], "little")
            bit = bool((word >> (x & 31)) & 1)
            expected = black if (bit if bow else not bit) else white
            base_x, base_y = x * scale, y * scale
            for out_y in range(base_y, base_y + scale):
                for out_x in range(base_x, base_x + scale):
                    if image.pixel(out_x, out_y) != expected:
                        raise BrowserConformanceError(f"browser pixel mismatch at source {x},{y}")
    return sha256(image.pixels)


class FrameHandler(SimpleHTTPRequestHandler):
    assets: dict[str, tuple[bytes, str]]
    requests: list[dict[str, str]]

    def _serve(self, include_body: bool) -> None:
        path = urlparse(self.path).path
        self.requests.append({"method": self.command, "path": path})
        asset = self.assets.get(path)
        if asset is None:
            self.send_error(404)
            return
        body, content_type = asset
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if include_body:
            self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        self._serve(True)

    def do_HEAD(self) -> None:  # noqa: N802
        self._serve(False)

    def log_message(self, _format: str, *args: object) -> None:
        del args


def snapshot_assets(frame: bytes) -> dict[str, tuple[bytes, str]]:
    """Snapshot the entire loopback closure before the server starts."""
    return {
        "/m7-p5.html": (P5_PAGE, "text/html; charset=utf-8"),
        "/p4-frame.cdrdisp1": (bytes(frame), "application/octet-stream"),
        "/cadr-web/browser/m7-host.css":
            ((ROOT / "cadr-web/browser/m7-host.css").read_bytes(), "text/css; charset=utf-8"),
        "/cadr-web/browser/m7-host.mjs":
            ((ROOT / "cadr-web/browser/m7-host.mjs").read_bytes(), "text/javascript; charset=utf-8"),
        "/cadr-web/wasm/cadr-display-renderer.mjs":
            ((ROOT / "cadr-web/wasm/cadr-display-renderer.mjs").read_bytes(),
             "text/javascript; charset=utf-8"),
    }


def command_identity(path: Path, probe_args: list[str]) -> dict[str, Any]:
    if not path.is_file() or path.is_symlink():
        raise BrowserConformanceError(f"required executable is unavailable: {path}")
    result = subprocess.run([str(path), *probe_args], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False, timeout=10)
    output = (result.stdout + result.stderr).strip()[:4000]
    if not output:
        raise BrowserConformanceError(f"identity probe returned no output: {path}")
    return {"path": str(path), "sha256": sha256(path.read_bytes()), "probe_args": probe_args,
            "probe_exit": result.returncode, "probe_output": output}


def next_display() -> str:
    for number in range(80, 200):
        if not Path(f"/tmp/.X{number}-lock").exists() and not Path(f"/tmp/.X11-unix/X{number}").exists():
            return f":{number}"
    raise BrowserConformanceError("no private Xvfb display number is available")


def xvfb_command(display: str, authority: Path) -> list[str]:
    return [str(XVFB), display, "-screen", "0", "1920x1200x24", "-nolisten", "tcp",
            "-auth", str(authority)]


def xvfb_environment() -> dict[str, str]:
    return {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"}


def chromium_environment(display: str, authority: Path) -> dict[str, str]:
    return {"DISPLAY": display, "XAUTHORITY": str(authority),
            "LANG": "C", "LC_ALL": "C", "TZ": "UTC"}


def create_xauthority(directory: Path, display: str) -> Path:
    authority = directory / "Xauthority"
    if not XAUTH.is_file() or XAUTH.is_symlink():
        raise BrowserConformanceError("P5 requires /usr/bin/xauth")
    cookie = secrets.token_hex(16)
    result = subprocess.run(
        [str(XAUTH), "-f", str(authority), "add", display, ".", cookie],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False, timeout=10,
        env={"LANG": "C", "LC_ALL": "C", "TZ": "UTC"})
    if result.returncode != 0:
        raise BrowserConformanceError(f"cannot create private Xauthority: {result.stderr.strip()}")
    os.chmod(authority, 0o600)
    owned_file(authority, "P5 Xauthority")
    return authority


def private_write(path: Path, value: bytes) -> dict[str, Any]:
    if path.exists() or path.is_symlink():
        raise BrowserConformanceError(f"refusing to replace private output {path.name}")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        offset = 0
        while offset != len(value):
            written = os.write(descriptor, value[offset:])
            if written <= 0:
                raise BrowserConformanceError(f"cannot write private output {path.name}")
            offset += written
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    owned_file(path, path.name)
    return {"path": path.name, "bytes": len(value), "sha256": sha256(value)}


def inspect(page: Any) -> dict[str, Any]:
    state = page.evaluate("() => window.cadrM7Demo.snapshot()")
    dom = page.evaluate("""() => { const canvas=document.querySelector('.cadr-m7-canvas'); const stage=document.querySelector('.cadr-m7-stage'); const host=document.querySelector('.cadr-m7-host'); const style=getComputedStyle(canvas); const b=canvas.getBoundingClientRect(), s=stage.getBoundingClientRect(); return {dpr:window.devicePixelRatio,screen:{width:screen.width,height:screen.height},canvas_bounds:{x:b.x,y:b.y,width:b.width,height:b.height},stage_bounds:{x:s.x,y:s.y,width:s.width,height:s.height},css:{width:style.width,height:style.height,image_rendering:style.imageRendering},smoothing:canvas.getContext('2d').imageSmoothingEnabled,fullscreen:document.fullscreenElement===host}; }""")
    if not isinstance(state, dict) or not isinstance(dom, dict):
        raise BrowserConformanceError("browser host did not return structured inspection")
    return {"state": state, "dom": dom}


def validate_visible_inspection(observed: dict[str, Any], *, fullscreen: bool) -> tuple[dict[str, Any], dict[str, Any]]:
    state, dom = observed["state"], observed["dom"]
    if state.get("fit") is not True or state.get("mode") != ("fullscreen" if fullscreen else "ordinary"):
        raise BrowserConformanceError("browser host did not enter the required presentation mode")
    if dom.get("dpr") != 1 or dom.get("screen") != {"width": 1920, "height": 1200}:
        raise BrowserConformanceError("P5 requires headed 1920x1200 Xvfb and devicePixelRatio exactly 1")
    presentation = state.get("presentation")
    if not isinstance(presentation, dict) or not presentation.get("fits"):
        raise BrowserConformanceError("browser did not report an integral presentation")
    viewport_width, viewport_height = presentation.get("viewportWidth"), presentation.get("viewportHeight")
    if not isinstance(viewport_width, int) or not isinstance(viewport_height, int):
        raise BrowserConformanceError("browser presentation viewport is malformed")
    expected = integer_presentation(viewport_width, viewport_height)
    if {key: presentation.get(key) for key in expected} != expected:
        raise BrowserConformanceError("browser integer presentation differs from the independent calculation")
    if state.get("canvasWidth") != viewport_width or state.get("canvasHeight") != viewport_height:
        raise BrowserConformanceError("canvas backing dimensions do not equal its CSS viewport")
    if state.get("canvasCssWidth") != f"{viewport_width}px" or state.get("canvasCssHeight") != f"{viewport_height}px":
        raise BrowserConformanceError("canvas CSS dimensions permit a second transform")
    if dom.get("css") != {"width": f"{viewport_width}px", "height": f"{viewport_height}px", "image_rendering": "pixelated"} or dom.get("smoothing") is not False:
        raise BrowserConformanceError("canvas smoothing/CSS policy differs from P5")
    for bounds_name in ("canvas_bounds", "stage_bounds"):
        bounds = dom.get(bounds_name)
        if not isinstance(bounds, dict) or set(bounds) != {"x", "y", "width", "height"}:
            raise BrowserConformanceError(f"{bounds_name} is malformed")
        for name, value in bounds.items():
            if (not isinstance(value, (int, float)) or isinstance(value, bool) or
                    not float(value).is_integer()):
                raise BrowserConformanceError(f"{bounds_name} {name} has fractional geometry")
    canvas, stage = dom["canvas_bounds"], dom["stage_bounds"]
    if (canvas["x"], canvas["y"], canvas["width"], canvas["height"]) != (
            stage["x"], stage["y"], viewport_width, viewport_height) or (
            stage["width"], stage["height"]) != (viewport_width, viewport_height):
        raise BrowserConformanceError("canvas bounds do not equal the integral stage viewport")
    return presentation, dom


def capture_full_frame(page: Any, directory: Path, name: str, frame: dict[str, Any],
                       presentation: dict[str, Any], dom: dict[str, Any]) -> dict[str, Any]:
    stage = dom["stage_bounds"]
    integral = lambda bounds: {key: int(item) for key, item in bounds.items()}
    scale = int(presentation["scale"])
    clip = {"x": int(stage["x"]) + int(presentation["left"]),
            "y": int(stage["y"]) + int(presentation["top"]),
            "width": WIDTH * scale, "height": HEIGHT * scale}
    path = directory / name
    page.screenshot(path=str(path), clip=clip)
    os.chmod(path, 0o600); owned_file(path, f"P5 {name}")
    image = decode_png_rgba(path)
    return {"file": {"path": name, "bytes": path.stat().st_size, "sha256": sha256(path.read_bytes())},
            "decoded_pixel_sha256": assert_visible_pixels(image, frame, presentation),
            "dimensions": {"width": image.width, "height": image.height},
            "presentation": presentation,
            "geometry": {"canvas_bounds": integral(dom["canvas_bounds"]),
                         "stage_bounds": integral(dom["stage_bounds"]), "source_clip": clip}}


def run_browser_campaign(p4_session: Path, output: Path) -> dict[str, Any]:
    if not CHROMIUM.is_file() or not XVFB.is_file():
        raise BrowserConformanceError("P5 requires /usr/bin/chromium and /usr/bin/Xvfb")
    p4_session = p4_session.resolve(); owned_directory(p4_session, "P4 session")
    manifest, manifest_raw = read_canonical_json(p4_session / "manifest.json", "P4 manifest")
    p4 = validate_p4_manifest(manifest, manifest_raw, p4_session)
    frame_path = p4_session / FRAME_PATH; owned_file(frame_path, "P4 CDRDISP1 frame")
    frame_raw = frame_path.read_bytes(); frame = parse_cdrdisp1(frame_raw)
    if frame["sha256"] != p4["frame"]["sha256"]:
        raise BrowserConformanceError("P4 CDRDISP1 bytes differ from the P4 manifest")
    chromium_identity = command_identity(CHROMIUM, ["--version"])
    xvfb_identity = command_identity(XVFB, ["-help"])
    if chromium_identity["probe_exit"] != 0 or not re.search(
            r"\bChromium 150\.", chromium_identity["probe_output"]):
        raise BrowserConformanceError("P5 requires the reviewed Chromium 150 profile")
    if "-screen scrn WxHxD" not in xvfb_identity["probe_output"]:
        raise BrowserConformanceError("P5 Xvfb identity probe is not the reviewed server interface")
    output = output.resolve()
    if output.exists() or output.is_symlink():
        raise BrowserConformanceError("P5 output session must not already exist")
    owned_directory(output.parent, "P5 output parent")
    output.mkdir(mode=0o700); os.chmod(output, 0o700); owned_directory(output, "P5 output session")
    browser_log: list[dict[str, Any]] = []
    assets = snapshot_assets(frame_raw)
    FrameHandler.assets = assets
    FrameHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), FrameHandler)
    server_thread = Thread(target=server.serve_forever, daemon=True); server_thread.start()
    display, xvfb, browser = next_display(), None, None
    try:
        authority = create_xauthority(output, display)
        xvfb_log = (output / "xvfb.log").open("xb", buffering=0); os.chmod(xvfb_log.name, 0o600)
        xvfb = subprocess.Popen(xvfb_command(display, authority),
                                stdout=xvfb_log, stderr=subprocess.STDOUT,
                                env=xvfb_environment())
        for _ in range(100):
            if Path(f"/tmp/.X11-unix/X{display[1:]}").exists(): break
            if xvfb.poll() is not None: raise BrowserConformanceError("Xvfb exited before creating its display")
            time.sleep(0.05)
        else: raise BrowserConformanceError("Xvfb did not create its display in time")
        from playwright.sync_api import sync_playwright  # imported only for explicit P5 execution
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=False, executable_path=str(CHROMIUM),
                args=["--force-device-scale-factor=1", "--disable-gpu", "--no-first-run", "--no-default-browser-check"],
                env=chromium_environment(display, authority), timeout=TIMEOUT_MS)
            context = browser.new_context(viewport={"width": 1920, "height": 1200}, device_scale_factor=1)
            page = context.new_page(); page.set_default_timeout(TIMEOUT_MS); page.set_default_navigation_timeout(TIMEOUT_MS)
            base = f"http://127.0.0.1:{server.server_port}"
            browser_log.append({"action": "goto", "url": f"{base}/m7-p5.html"})
            page.goto(f"{base}/m7-p5.html", wait_until="networkidle")
            page.wait_for_function("() => document.documentElement.dataset.cadrM7Ready === 'true' && window.cadrM7Demo.snapshot().presentation !== null")
            ordinary_observed = inspect(page); ordinary_plan, ordinary_dom = validate_visible_inspection(ordinary_observed, fullscreen=False)
            ordinary = capture_full_frame(page, output, "ordinary.png", frame, ordinary_plan, ordinary_dom)
            # A 767px viewport cannot admit logical scale one.  The observed area may be
            # smaller after body margins, which is acceptable only when the explicit host
            # state remains zero-fit rather than choosing fractional scale.
            page.set_viewport_size({"width": 767, "height": 1200})
            page.wait_for_function("() => window.cadrM7Demo.snapshot().fit === false")
            zero_fit = inspect(page)
            if zero_fit["state"].get("canvasWidth") != 0 or zero_fit["state"].get("canvasHeight") != 0:
                raise BrowserConformanceError("767px P5 zero-fit state retained a drawable canvas")
            browser_log.append({"action": "zero-fit", "viewport_width": 767, "fit": False})
            page.set_viewport_size({"width": 1920, "height": 1200})
            page.wait_for_function("() => window.cadrM7Demo.snapshot().fit === true")
            button = page.get_by_role("button", name="Enter fullscreen")
            browser_log.append({"action": "trusted-click-enter-fullscreen"}); button.click()
            page.wait_for_function("() => document.fullscreenElement !== null && window.cadrM7Demo.snapshot().mode === 'fullscreen'")
            fullscreen_observed = inspect(page); fullscreen_plan, fullscreen_dom = validate_visible_inspection(fullscreen_observed, fullscreen=True)
            if fullscreen_observed["dom"].get("fullscreen") is not True:
                raise BrowserConformanceError("browser fullscreen request was denied")
            fullscreen = capture_full_frame(page, output, "fullscreen.png", frame, fullscreen_plan, fullscreen_dom)
            browser_log.append({"action": "trusted-click-exit-fullscreen"}); page.get_by_role("button", name="Exit fullscreen").click()
            page.wait_for_function("() => document.fullscreenElement === null && window.cadrM7Demo.snapshot().mode === 'ordinary'")
            browser_log.append({"action": "fullscreen-exit-observed", "success": True})
            context.close(); browser.close(); browser = None
        xvfb_log.close()
        xvfb.wait(timeout=2) if xvfb.poll() is not None else xvfb.terminate()
        if xvfb.poll() is None: xvfb.wait(timeout=5)
        if xvfb.returncode not in (0, -15): raise BrowserConformanceError(f"Xvfb terminated unexpectedly: {xvfb.returncode}")
        browser_log.extend({"action": "http", **request} for request in FrameHandler.requests)
        if not any(item["path"] == "/p4-frame.cdrdisp1" for item in FrameHandler.requests):
            raise BrowserConformanceError("production browser host did not fetch the P4 loopback frame")
        log_receipt = private_write(output / "browser.ndjson", b"".join(canonical(item) + b"\n" for item in browser_log))
        identities = {"chromium": chromium_identity, "xvfb": xvfb_identity,
                      "css": {"path": "cadr-web/browser/m7-host.css",
                              "sha256": sha256(assets["/cadr-web/browser/m7-host.css"][0])},
                      "host": {"path": "cadr-web/browser/m7-host.mjs",
                               "sha256": sha256(assets["/cadr-web/browser/m7-host.mjs"][0])},
                      "renderer": {"path": "cadr-web/wasm/cadr-display-renderer.mjs",
                                   "sha256": sha256(assets["/cadr-web/wasm/cadr-display-renderer.mjs"][0])}}
        result = {"schema": P5_SCHEMA, "target": P5_TARGET, "outcome": "passed",
                  "runtime_execution_performed": True, "p4_manifest_sha256": p4["manifest_sha256"],
                  "input_cdrdisp1": {"sha256": frame["sha256"], "machine_generation": frame["machine_generation"],
                                       "framebuffer_generation": frame["framebuffer_generation"], "tv_mode": frame["tv_mode"]},
                  "environment": {"xvfb_screen": "1920x1200x24", "device_pixel_ratio": 1,
                                  "loopback_cache_control": "no-store",
                                  "xauthority": "private-cookie"}, "identities": identities,
                  "ordinary": ordinary, "fullscreen": fullscreen,
                  "zero_fit": {"requested_viewport_width": 767, "canvas_width": 0, "canvas_height": 0},
                  "fullscreen_control": {"entry": "trusted-click", "entry_succeeded": True,
                                         "exit": "trusted-click", "exit_succeeded": True},
                  "browser_log": log_receipt}
        validate_p5_result(result)
        receipt = private_write(output / "manifest.json", canonical(result))
        return {"session": output.relative_to(ROOT).as_posix(), "manifest": receipt,
                "summary": {"ordinary_png_sha256": ordinary["file"]["sha256"],
                            "fullscreen_png_sha256": fullscreen["file"]["sha256"],
                            "p4_frame_sha256": frame["sha256"]}}
    finally:
        if browser is not None:
            try: browser.close()
            except Exception: pass
        if xvfb is not None and xvfb.poll() is None:
            xvfb.terminate()
            try: xvfb.wait(timeout=5)
            except subprocess.TimeoutExpired: xvfb.kill()
        server.shutdown(); server.server_close()


def validate_p5_result(value: dict[str, Any]) -> dict[str, Any]:
    exact_keys(value, ["browser_log", "environment", "fullscreen", "fullscreen_control", "identities",
                       "input_cdrdisp1", "ordinary", "outcome", "p4_manifest_sha256",
                       "runtime_execution_performed", "schema", "target", "zero_fit"], "P5 result")
    if (value["schema"] != P5_SCHEMA or value["target"] != P5_TARGET or value["outcome"] != "passed" or
            value["runtime_execution_performed"] is not True):
        raise BrowserConformanceError("P5 result status is wrong")
    digest(value["p4_manifest_sha256"], "P5 P4 manifest hash")
    exact_keys(value["input_cdrdisp1"],
               ["framebuffer_generation", "machine_generation", "sha256", "tv_mode"],
               "P5 CDRDISP1 input")
    digest(value["input_cdrdisp1"]["sha256"], "P5 CDRDISP1 hash")
    for field in ("machine_generation", "framebuffer_generation"):
        generation = value["input_cdrdisp1"][field]
        if not isinstance(generation, str) or not re.fullmatch(r"[1-9][0-9]*", generation):
            raise BrowserConformanceError(f"P5 {field} is not a canonical nonzero generation")
    tv_mode = value["input_cdrdisp1"]["tv_mode"]
    if not isinstance(tv_mode, int) or isinstance(tv_mode, bool) or not 0 <= tv_mode <= 0xffffffff:
        raise BrowserConformanceError("P5 tv_mode is not uint32")
    exact_keys(value["environment"],
               ["device_pixel_ratio", "loopback_cache_control", "xauthority", "xvfb_screen"],
               "P5 environment")
    if value["environment"] != {"xvfb_screen": "1920x1200x24", "device_pixel_ratio": 1,
                                "loopback_cache_control": "no-store",
                                "xauthority": "private-cookie"}:
        raise BrowserConformanceError("P5 environment is not the required headed DPR1 Xvfb profile")
    exact_keys(value["fullscreen_control"], ["entry", "entry_succeeded", "exit", "exit_succeeded"], "P5 fullscreen control")
    if value["fullscreen_control"] != {"entry": "trusted-click", "entry_succeeded": True, "exit": "trusted-click", "exit_succeeded": True}:
        raise BrowserConformanceError("P5 fullscreen did not enter and exit through trusted controls")
    exact_keys(value["identities"], ["chromium", "css", "host", "renderer", "xvfb"],
               "P5 identities")
    for label, path, args in (("chromium", str(CHROMIUM), ["--version"]),
                              ("xvfb", str(XVFB), ["-help"])):
        identity = exact_keys(value["identities"][label],
                              ["path", "probe_args", "probe_exit", "probe_output", "sha256"],
                              f"P5 {label} identity")
        if identity["path"] != path or identity["probe_args"] != args or not isinstance(
                identity["probe_exit"], int) or isinstance(identity["probe_exit"], bool):
            raise BrowserConformanceError(f"P5 {label} probe identity is wrong")
        digest(identity["sha256"], f"P5 {label} executable hash")
        if not isinstance(identity["probe_output"], str) or not identity["probe_output"]:
            raise BrowserConformanceError(f"P5 {label} probe output is absent")
    if (value["identities"]["chromium"]["probe_exit"] != 0 or
            not re.search(r"\bChromium 150\.", value["identities"]["chromium"]["probe_output"])):
        raise BrowserConformanceError("P5 Chromium identity is not the reviewed Chromium 150 profile")
    if "-screen scrn WxHxD" not in value["identities"]["xvfb"]["probe_output"]:
        raise BrowserConformanceError("P5 Xvfb identity is not the reviewed server interface")
    for label, path in (("css", "cadr-web/browser/m7-host.css"),
                        ("host", "cadr-web/browser/m7-host.mjs"),
                        ("renderer", "cadr-web/wasm/cadr-display-renderer.mjs")):
        identity = exact_keys(value["identities"][label], ["path", "sha256"], f"P5 {label} identity")
        if identity["path"] != path or identity["sha256"] != sha256((ROOT / path).read_bytes()):
            raise BrowserConformanceError(f"P5 {label} identity differs from production bytes")
    for state in ("ordinary", "fullscreen"):
        exact_keys(value[state], ["decoded_pixel_sha256", "dimensions", "file", "geometry", "presentation"], f"P5 {state}")
        digest(value[state]["decoded_pixel_sha256"], f"P5 {state} pixel hash")
        file = exact_keys(value[state]["file"], ["bytes", "path", "sha256"], f"P5 {state} file")
        if file["path"] != f"{state}.png" or not isinstance(file["bytes"], int) or isinstance(
                file["bytes"], bool) or file["bytes"] <= 0:
            raise BrowserConformanceError(f"P5 {state} file identity is malformed")
        digest(file["sha256"], f"P5 {state} file hash")
        presentation = exact_keys(value[state]["presentation"],
                                  ["dpr", "fits", "height", "left", "scale", "top",
                                   "viewportHeight", "viewportWidth", "width"],
                                  f"P5 {state} presentation")
        if presentation["dpr"] != 1 or presentation["fits"] is not True:
            raise BrowserConformanceError(f"P5 {state} presentation is not integral DPR1")
        expected = integer_presentation(presentation["viewportWidth"], presentation["viewportHeight"])
        if {key: presentation[key] for key in expected} != expected:
            raise BrowserConformanceError(f"P5 {state} presentation differs from the independent plan")
        exact_keys(value[state]["dimensions"], ["height", "width"], f"P5 {state} dimensions")
        if value[state]["dimensions"] != {"width": WIDTH * value[state]["presentation"]["scale"],
                                            "height": HEIGHT * value[state]["presentation"]["scale"]}:
            raise BrowserConformanceError(f"P5 {state} screenshot does not contain the full integral frame")
        geometry = exact_keys(value[state]["geometry"],
                              ["canvas_bounds", "source_clip", "stage_bounds"],
                              f"P5 {state} geometry")
        for bounds_name in ("canvas_bounds", "stage_bounds", "source_clip"):
            bounds = exact_keys(geometry[bounds_name], ["height", "width", "x", "y"],
                                f"P5 {state} {bounds_name}")
            if any(not isinstance(item, int) or isinstance(item, bool) for item in bounds.values()):
                raise BrowserConformanceError(f"P5 {state} {bounds_name} is not integral")
        if geometry["canvas_bounds"] != {
                "x": geometry["stage_bounds"]["x"], "y": geometry["stage_bounds"]["y"],
                "width": presentation["viewportWidth"], "height": presentation["viewportHeight"]}:
            raise BrowserConformanceError(f"P5 {state} retained canvas bounds are inconsistent")
        if (geometry["stage_bounds"]["width"], geometry["stage_bounds"]["height"]) != (
                presentation["viewportWidth"], presentation["viewportHeight"]):
            raise BrowserConformanceError(f"P5 {state} stage bounds differ from the viewport")
        if geometry["source_clip"] != {
                "x": geometry["stage_bounds"]["x"] + presentation["left"],
                "y": geometry["stage_bounds"]["y"] + presentation["top"],
                "width": WIDTH * presentation["scale"], "height": HEIGHT * presentation["scale"]}:
            raise BrowserConformanceError(f"P5 {state} source placement is fractional or inconsistent")
    if value["zero_fit"] != {"requested_viewport_width": 767, "canvas_width": 0, "canvas_height": 0}:
        raise BrowserConformanceError("P5 767px zero-fit proof is absent")
    log = exact_keys(value["browser_log"], ["bytes", "path", "sha256"], "P5 browser log")
    if log["path"] != "browser.ndjson" or not isinstance(log["bytes"], int) or isinstance(
            log["bytes"], bool) or log["bytes"] <= 0:
        raise BrowserConformanceError("P5 browser log identity is malformed")
    digest(log["sha256"], "P5 browser log hash")
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="explicitly permit the headed private campaign")
    parser.add_argument("--p4-session", help="0700 P4 session below build/cadr-oracle")
    parser.add_argument("--output", help="new 0700 P5 session below build/cadr-oracle")
    args = parser.parse_args(argv)
    if not args.execute:
        print(canonical({"schema": "cadr-m7-browser-conformance-plan-v1", "outcome": "blocked",
                         "runtime_execution_performed": False, "reason": "explicit---execute-required"}).decode())
        return 2
    if not args.p4_session or not args.output:
        parser.error("--execute requires --p4-session and --output")
    try:
        p4_session = private_relative(args.p4_session, "P4 session")
        output = private_relative(args.output, "P5 output")
        result = run_browser_campaign(p4_session, output)
    except (BrowserConformanceError, OSError, subprocess.SubprocessError) as exc:
        print(json.dumps({"schema": P5_SCHEMA, "outcome": "invalid", "error": str(exc)}, sort_keys=True))
        return 1
    print(canonical({"schema": "cadr-m7-browser-conformance-summary-v1", "outcome": "passed", **result}).decode())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
