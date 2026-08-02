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
from struct import pack as struct_pack, unpack, unpack_from
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
IDENTITY_PATH = "portable/effective-page-identity.json"
HOST_TRANSCRIPT_PATH = "portable/host-transcript.cdrm6hs1"
IDENTITY_PROFILE = "CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v2"
IDENTITY_SELECTED_BASE_BYTES = 269_562_880
IDENTITY_SELECTED_BASE_SHA256 = "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
IDENTITY_SELECTED_PAGE_SHA256 = "ba1b1cc2228edbe5028760e47687c6889023fc72221bd5c5f5be85c4cfbb6a00"
IDENTITY_EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
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


def tagged_u64(value: Any, label: str) -> int:
    if not isinstance(value, dict) or set(value) != {"u64"} or not isinstance(value["u64"], str) or \
            not re.fullmatch(r"0|[1-9][0-9]*", value["u64"]):
        raise BrowserConformanceError(f"{label} is not a canonical tagged u64")
    result = int(value["u64"])
    if result > 0xffffffffffffffff:
        raise BrowserConformanceError(f"{label} exceeds uint64")
    return result


def identity_u32(value: Any, label: str) -> int:
    if type(value) is not int or not 0 <= value <= 0xffffffff:
        raise BrowserConformanceError(f"{label} is not an unsigned 32-bit integer")
    return value


def tagged_hash(value: Any, label: str) -> str:
    if not isinstance(value, dict) or set(value) != {"bytes"}:
        raise BrowserConformanceError(f"{label} is not tagged bytes")
    return digest(value["bytes"], label)


def tagged_bytes(value: Any, label: str, byte_count: int | None = None) -> bytes:
    if not isinstance(value, dict) or set(value) != {"bytes"} or \
            not isinstance(value["bytes"], str) or not re.fullmatch(r"(?:[0-9a-f]{2})*", value["bytes"]):
        raise BrowserConformanceError(f"{label} is not canonical tagged bytes")
    result = bytes.fromhex(value["bytes"])
    if byte_count is not None and len(result) != byte_count:
        raise BrowserConformanceError(f"{label} has the wrong byte count")
    return result


def identity_host_record(transcript: bytes, ordinal: int, count: int) -> dict[str, Any]:
    if not isinstance(ordinal, int) or isinstance(ordinal, bool) or not 0 <= ordinal < count:
        raise BrowserConformanceError("P4 identity transcript ordinal is out of range")
    record = transcript[64 + ordinal * 256:64 + (ordinal + 1) * 256]
    if len(record) != 256 or unpack_from("<Q", record, 0)[0] != ordinal or \
            record[92:96] != b"\0" * 4 or record[200:] != b"\0" * 56:
        raise BrowserConformanceError("P4 identity transcript record is noncanonical")
    return {"bytes": record, "ordinal": ordinal,
            "actor": unpack_from("<I", record, 8)[0],
            "operation": unpack_from("<I", record, 12)[0],
            "boundary": unpack_from("<Q", record, 16)[0],
            "due": unpack_from("<Q", record, 24)[0],
            "generation": unpack_from("<Q", record, 32)[0],
            "request": unpack_from("<Q", record, 40)[0],
            "status": unpack_from("<I", record, 48)[0],
            "block_count": unpack_from("<I", record, 52)[0],
            "descriptor_bytes": unpack_from("<Q", record, 56)[0],
            "payload_bytes": unpack_from("<Q", record, 64)[0],
            "completion_bytes": unpack_from("<Q", record, 72)[0],
            "first_block": unpack_from("<Q", record, 80)[0],
            "block_bytes": unpack_from("<I", record, 88)[0],
            "overlay_generation": unpack_from("<Q", record, 96)[0],
            "descriptor_sha256": record[104:136].hex(),
            "payload_sha256": record[136:168].hex(),
            "completion_sha256": record[168:200].hex()}


def identity_pair_link(value: Any, label: str) -> dict[str, Any]:
    link = exact_keys(value, ["completion_ordinal", "completion_record_sha256",
                              "issue_ordinal", "issue_record_sha256"], label)
    issue = identity_u32(link["issue_ordinal"], f"{label} issue ordinal")
    completion = identity_u32(link["completion_ordinal"], f"{label} completion ordinal")
    if completion != issue + 1:
        raise BrowserConformanceError(f"{label} has invalid ordinals")
    return {"issue": issue, "completion": completion,
            "issue_hash": tagged_hash(link["issue_record_sha256"], f"{label} issue hash"),
            "completion_hash": tagged_hash(link["completion_record_sha256"],
                                           f"{label} completion hash")}


def identity_media(value: Any, label: str) -> dict[str, Any]:
    media = exact_keys(value, ["dirty", "overlay_generation", "overlay_root_sha256",
                               "persistent", "staged"], label)
    if media["dirty"] is not True or media["persistent"] is not False or media["staged"] is not False:
        raise BrowserConformanceError(f"{label} is not stable volatile overlay state")
    return {"dirty": True,
            "generation": tagged_u64(media["overlay_generation"], f"{label} generation"),
            "root": tagged_hash(media["overlay_root_sha256"], f"{label} root"),
            "persistent": False, "staged": False}


def identity_boot_request(value: Any, label: str) -> dict[str, Any]:
    request = exact_keys(value, ["completion_boundary", "first_block", "generation",
                                 "issue_boundary", "page_sha256", "request_id",
                                 "transaction_id"], label)
    result = {name: tagged_u64(request[name], f"{label} {name}") for name in
              ("completion_boundary", "first_block", "generation", "issue_boundary",
               "request_id", "transaction_id")}
    result["page_sha256"] = tagged_hash(request["page_sha256"], f"{label} page")
    if result["completion_boundary"] < result["issue_boundary"]:
        raise BrowserConformanceError(f"{label} boundaries are reversed")
    return result


def validate_identity_arm(value: Any) -> dict[str, Any]:
    arm = exact_keys(value, ["base_read", "comparison_read", "initial_commit", "profile",
                             "quiet_suffix", "schema"], "P4 identity arm")
    if arm["schema"] != "cadr-m7-effective-page-identity-arm-v2" or arm["profile"] != IDENTITY_PROFILE:
        raise BrowserConformanceError("P4 identity arm profile differs")
    initial = identity_boot_request(arm["initial_commit"], "P4 identity initial commit")
    comparison = identity_boot_request(arm["comparison_read"], "P4 identity comparison read")
    base = identity_boot_request(arm["base_read"], "P4 identity base read")
    quiet = exact_keys(arm["quiet_suffix"], ["boundary", "outstanding_request_id",
                                             "persistent_status", "reason"],
                       "P4 identity quiet suffix")
    quiet_boundary = tagged_u64(quiet["boundary"], "P4 identity quiet boundary")
    outstanding = tagged_u64(quiet["outstanding_request_id"], "P4 identity quiet request")
    reason = identity_u32(quiet["reason"], "P4 identity quiet reason")
    persistent_status = identity_u32(quiet["persistent_status"],
                                     "P4 identity quiet persistent status")
    if ((initial["generation"], initial["request_id"], initial["transaction_id"],
         initial["first_block"]) != (1, 1, 1, 1) or
            (comparison["generation"], comparison["request_id"], comparison["transaction_id"],
             comparison["first_block"]) != (1, 2, 0, 1) or
            (base["generation"], base["request_id"], base["transaction_id"],
             base["first_block"]) != (1, 3, 0, 0) or
            initial["page_sha256"] != comparison["page_sha256"] or
            comparison["issue_boundary"] < initial["completion_boundary"] or
            base["issue_boundary"] < comparison["completion_boundary"] or
            quiet_boundary != 1_030_044 or reason != 1 or
            persistent_status != 0 or outstanding != 0 or
            quiet_boundary < base["completion_boundary"]):
        raise BrowserConformanceError("P4 identity arm is not the selected boot suffix")
    return {"initial_commit": initial, "comparison_read": comparison,
            "base_read": base, "quiet_boundary": quiet_boundary, "raw": arm}


def validate_identity_stream(raw: bytes, transcript_raw: bytes,
                             summary: dict[str, Any]) -> None:
    if not raw.endswith(b"\n"):
        raise BrowserConformanceError("P4 identity stream lacks its canonical newline")
    try:
        stream = json.loads(raw, object_pairs_hook=reject_duplicate_members)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BrowserConformanceError("P4 identity stream is not canonical JSON") from error
    if canonical(stream) + b"\n" != raw:
        raise BrowserConformanceError("P4 identity stream bytes are noncanonical")
    exact_keys(stream, ["acknowledgements", "count", "disposition", "first",
                        "host_transcript", "profile", "schema"], "P4 identity stream")
    stream_count = identity_u32(stream["count"], "P4 identity stream count")
    summary_count = identity_u32(summary["count"], "P4 identity summary count")
    if (stream["schema"] != "cadr-m7-effective-page-identity-stream-v1" or
            stream["profile"] != IDENTITY_PROFILE or stream["profile"] != summary["profile"] or
            stream["disposition"] != "IDENTITY_ACK_STREAM" or
            stream_count != summary_count or
            not isinstance(stream["acknowledgements"], list) or
            len(stream["acknowledgements"]) != stream_count or
            not 1 <= stream_count <= 1024):
        raise BrowserConformanceError("P4 identity stream header differs")
    transcript = exact_keys(stream["host_transcript"],
                            ["artifact_set_sha256", "byte_count", "record_count",
                            "schema", "sha256"], "P4 identity transcript binding")
    transcript_record_count = identity_u32(transcript["record_count"],
                                           "P4 transcript record count")
    if (transcript["schema"] != "CDRM6HS1" or
            tagged_u64(transcript["byte_count"], "P4 transcript byte count") != len(transcript_raw) or
            tagged_hash(transcript["sha256"], "P4 transcript hash") != sha256(transcript_raw)):
        raise BrowserConformanceError("P4 identity transcript binding differs")
    if len(transcript_raw) < 64 or transcript_raw[:8] != b"CDRM6HS1":
        raise BrowserConformanceError("P4 host transcript header differs")
    version, header_bytes, record_bytes, record_count = unpack_from("<IIII", transcript_raw, 8)
    if (version, header_bytes, record_bytes, record_count) != \
            (1, 64, 256, transcript_record_count) or len(transcript_raw) != 64 + record_count * 256 or \
            record_count == 0 or record_count % 2 != 0 or record_count > 2048:
        raise BrowserConformanceError("P4 host transcript framing differs")
    if tagged_hash(transcript["artifact_set_sha256"], "P4 transcript artifact set") != \
            transcript_raw[24:56].hex():
        raise BrowserConformanceError("P4 transcript artifact-set binding differs")
    records = [identity_host_record(transcript_raw, ordinal, record_count)
               for ordinal in range(record_count)]
    high_water = -1
    initial_replay_signature: tuple[str, str] | None = None
    for ordinal in range(0, record_count, 2):
        issue, completion = records[ordinal], records[ordinal + 1]
        if (issue["actor"] != 1 or completion["actor"] != 2 or
                any(issue[name] != completion[name] for name in
                    ("operation", "generation", "request", "status", "block_count",
                     "descriptor_bytes", "payload_bytes", "completion_bytes", "first_block",
                     "block_bytes", "descriptor_sha256", "payload_sha256")) or
                completion["boundary"] < issue["boundary"] or issue["status"] != 0):
            raise BrowserConformanceError("P4 host transcript request pair differs")
        if ordinal == 0:
            initial_replay_signature = (issue["descriptor_sha256"], issue["payload_sha256"])
        is_initial_replay = (ordinal != 0 and issue["request"] == 1 and issue["operation"] == 2 and
                             issue["generation"] == 1 and issue["first_block"] == 1 and
                             issue["block_count"] == 1 and issue["block_bytes"] == 1024 and
                             issue["descriptor_bytes"] == 24 and issue["payload_bytes"] == 1024 and
                             issue["completion_bytes"] == 0 and issue["overlay_generation"] == 1 and
                             completion["overlay_generation"] == 1 and
                             issue["completion_sha256"] == IDENTITY_EMPTY_SHA256 and
                             completion["completion_sha256"] == IDENTITY_EMPTY_SHA256 and
                             initial_replay_signature ==
                             (issue["descriptor_sha256"], issue["payload_sha256"]))
        if not is_initial_replay:
            if issue["generation"] != 1 or issue["request"] <= high_water:
                raise BrowserConformanceError("P4 host transcript high-water differs")
            high_water = issue["request"]
    previous_request = previous_completion_ordinal = previous_completion_boundary = -1
    selected_arm = selected_arm_links = None
    used_candidate_records: set[int] = set()
    for index, acknowledgement in enumerate(stream["acknowledgements"]):
        exact_keys(acknowledgement,
                   ["acknowledgement_ordinal", "arm", "disposition", "effective_page",
                    "media_after", "media_before", "preceding_read", "profile", "request",
                    "schema", "selected_base", "target_rereads", "transcript"],
                   f"P4 identity acknowledgement {index}")
        request = exact_keys(acknowledgement["request"],
                             ["block_bytes", "block_count", "completion_boundary", "descriptor",
                              "descriptor_sha256", "due_boundary", "first_block", "generation",
                              "host_status", "issue_boundary", "payload_sha256", "request_id",
                              "transaction_id"], f"P4 acknowledgement {index} request")
        page = exact_keys(acknowledgement["effective_page"],
                          ["byte_count", "byte_offset", "first_block", "sha256", "source"],
                          f"P4 acknowledgement {index} effective page")
        base = exact_keys(acknowledgement["selected_base"], ["byte_count", "sha256"],
                          f"P4 acknowledgement {index} selected base")
        rereads = exact_keys(acknowledgement["target_rereads"],
                             ["post_completion_sha256", "pre_success_sha256"],
                             f"P4 acknowledgement {index} target rereads")
        link = exact_keys(acknowledgement["transcript"],
                          ["arm_records", "artifact_set_sha256", "completion_ordinal",
                           "completion_record_sha256", "issue_ordinal", "issue_record_sha256",
                           "schema", "sha256"], f"P4 acknowledgement {index} transcript")
        arm = validate_identity_arm(acknowledgement["arm"])
        acknowledgement_ordinal = identity_u32(acknowledgement["acknowledgement_ordinal"],
                                               f"P4 acknowledgement {index} ordinal")
        block_count = identity_u32(request["block_count"],
                                   f"P4 acknowledgement {index} block count")
        block_bytes = identity_u32(request["block_bytes"],
                                   f"P4 acknowledgement {index} block bytes")
        host_status = identity_u32(request["host_status"],
                                   f"P4 acknowledgement {index} host status")
        page_byte_count = identity_u32(page["byte_count"],
                                       f"P4 acknowledgement {index} page byte count")
        before = identity_media(acknowledgement["media_before"],
                                f"P4 acknowledgement {index} media before")
        after = identity_media(acknowledgement["media_after"],
                               f"P4 acknowledgement {index} media after")
        request_id = tagged_u64(request["request_id"], f"P4 acknowledgement {index} request")
        generation = tagged_u64(request["generation"], f"P4 acknowledgement {index} generation")
        transaction_id = tagged_u64(request["transaction_id"], f"P4 acknowledgement {index} transaction")
        issue_boundary = tagged_u64(request["issue_boundary"], f"P4 acknowledgement {index} issue")
        first_block = tagged_u64(request["first_block"], f"P4 acknowledgement {index} block")
        due_boundary = tagged_u64(request["due_boundary"], f"P4 acknowledgement {index} due")
        completion_boundary = tagged_u64(request["completion_boundary"],
                                         f"P4 acknowledgement {index} completion")
        descriptor = tagged_bytes(request["descriptor"], f"P4 acknowledgement {index} descriptor", 24)
        descriptor_hash = tagged_hash(request["descriptor_sha256"],
                                      f"P4 acknowledgement {index} descriptor hash")
        payload_hash = tagged_hash(request["payload_sha256"],
                                   f"P4 acknowledgement {index} payload hash")
        effective = tagged_hash(page["sha256"], f"P4 acknowledgement {index} effective page")
        base_bytes = tagged_u64(base["byte_count"], f"P4 acknowledgement {index} base bytes")
        base_hash = tagged_hash(base["sha256"], f"P4 acknowledgement {index} base hash")
        page_block = tagged_u64(page["first_block"], f"P4 acknowledgement {index} page block")
        page_offset = tagged_u64(page["byte_offset"], f"P4 acknowledgement {index} page offset")
        pair = identity_pair_link({name: link[name] for name in
                                   ("completion_ordinal", "completion_record_sha256",
                                    "issue_ordinal", "issue_record_sha256")},
                                  f"P4 acknowledgement {index} transcript link")
        issue_ordinal, completion_ordinal = pair["issue"], pair["completion"]
        if (acknowledgement["schema"] != "cadr-m7-effective-page-identity-evidence-v4" or
                acknowledgement["profile"] != IDENTITY_PROFILE or
                acknowledgement["disposition"] != "IDENTITY_ACK" or
                acknowledgement_ordinal != index or generation != 1 or
                transaction_id != request_id or issue_ordinal + 1 != completion_ordinal or
                completion_ordinal >= record_count or request_id <= previous_request or
                issue_ordinal <= previous_completion_ordinal or
                issue_boundary < previous_completion_boundary or block_count != 1 or
                block_bytes != 1024 or host_status != 0 or
                due_boundary < issue_boundary or completion_boundary < due_boundary or
                unpack_from("<QQII", descriptor) != (transaction_id, first_block, 1, 1024) or
                sha256(descriptor) != descriptor_hash or payload_hash != effective or
                base_bytes != IDENTITY_SELECTED_BASE_BYTES or base_hash != IDENTITY_SELECTED_BASE_SHA256 or
                page_block != first_block or page_offset != first_block * 1024 or
                page_byte_count != 1024 or page["source"] not in ("base", "overlay") or
                (first_block == 1) != (page["source"] == "overlay") or
                page_offset + 1024 > base_bytes or before != after or before["generation"] != 1 or
                link["schema"] != "CDRM6HS1" or
                tagged_hash(link["sha256"], f"P4 acknowledgement {index} transcript hash") !=
                sha256(transcript_raw) or
                tagged_hash(link["artifact_set_sha256"],
                            f"P4 acknowledgement {index} artifact set") != transcript_raw[24:56].hex()):
            raise BrowserConformanceError("P4 identity acknowledgement ordering differs")
        issue, completion = records[issue_ordinal], records[completion_ordinal]
        candidate_tuple = (issue["actor"], completion["actor"], issue["operation"],
                           completion["operation"], issue["boundary"], completion["boundary"],
                           issue["due"], completion["due"], issue["generation"],
                           completion["generation"], issue["request"], completion["request"],
                           issue["first_block"], completion["first_block"],
                           issue["overlay_generation"], completion["overlay_generation"])
        if (candidate_tuple !=
                (1, 2, 2, 2, issue_boundary, completion_boundary, due_boundary, due_boundary,
                 generation, generation, request_id, request_id, first_block, first_block, 1, 1) or
                issue["block_count"] != 1 or issue["block_bytes"] != 1024 or
                issue["descriptor_bytes"] != 24 or issue["payload_bytes"] != 1024 or
                issue["completion_bytes"] != 0 or issue["descriptor_sha256"] != descriptor_hash or
                issue["payload_sha256"] != effective or issue["completion_sha256"] != IDENTITY_EMPTY_SHA256 or
                completion["completion_sha256"] != IDENTITY_EMPTY_SHA256 or
                sha256(issue["bytes"]) != pair["issue_hash"] or
                sha256(completion["bytes"]) != pair["completion_hash"]):
            raise BrowserConformanceError("P4 identity acknowledgement transcript link differs")
        if (tagged_hash(rereads["pre_success_sha256"], "P4 pre-success reread") != effective or
                tagged_hash(rereads["post_completion_sha256"], "P4 post-completion reread") != effective):
            raise BrowserConformanceError("P4 identity target rereads differ")
        expected_root = hashlib.sha256(b"CDRM4OVERLAY1\0" + bytes.fromhex(base_hash) +
                                       (1).to_bytes(8, "little") + (1).to_bytes(8, "little") +
                                       bytes.fromhex(arm["initial_commit"]["page_sha256"])).hexdigest()
        if before["root"] != expected_root:
            raise BrowserConformanceError("P4 identity media root differs")
        arm_records = exact_keys(link["arm_records"],
                                 ["base_read", "comparison_read", "initial_commit"],
                                 f"P4 acknowledgement {index} arm links")
        arm_links = {name: identity_pair_link(arm_records[name], f"P4 arm {name}")
                     for name in ("initial_commit", "comparison_read", "base_read")}
        if {name: (link["issue"], link["completion"]) for name, link in arm_links.items()} != {
                "initial_commit": (0, 1), "comparison_read": (2, 3), "base_read": (4, 5)}:
            raise BrowserConformanceError("P4 identity arm is not the opening transcript prefix")
        if selected_arm is None:
            selected_arm, selected_arm_links = arm["raw"], arm_links
        elif arm["raw"] != selected_arm or arm_links != selected_arm_links:
            raise BrowserConformanceError("P4 identity arm differs across the collection")
        for name, operation, expected in (("initial_commit", 2, arm["initial_commit"]),
                                          ("comparison_read", 1, arm["comparison_read"]),
                                          ("base_read", 1, arm["base_read"])):
            arm_link = arm_links[name]
            arm_issue, arm_completion = records[arm_link["issue"]], records[arm_link["completion"]]
            descriptor_bytes = (struct_pack("<QQII", expected["transaction_id"],
                                             expected["first_block"], 1, 1024) if operation == 2 else
                                struct_pack("<QII", expected["first_block"], 1, 1024))
            expected_descriptor_hash = sha256(descriptor_bytes)
            if (sha256(arm_issue["bytes"]) != arm_link["issue_hash"] or
                    sha256(arm_completion["bytes"]) != arm_link["completion_hash"] or
                    arm_issue["actor"] != 1 or arm_completion["actor"] != 2 or
                    arm_issue["operation"] != operation or arm_completion["operation"] != operation or
                    arm_issue["boundary"] != expected["issue_boundary"] or
                    arm_completion["boundary"] != expected["completion_boundary"] or
                    arm_issue["generation"] != expected["generation"] or
                    arm_issue["request"] != expected["request_id"] or
                    arm_issue["first_block"] != expected["first_block"] or
                    arm_issue["due"] != expected["completion_boundary"] or
                    arm_completion["due"] != expected["completion_boundary"] or
                    arm_issue["block_count"] != 1 or arm_issue["block_bytes"] != 1024 or
                    arm_issue["descriptor_bytes"] != (24 if operation == 2 else 16) or
                    arm_issue["payload_bytes"] != (1024 if operation == 2 else 0) or
                    arm_issue["completion_bytes"] != (0 if operation == 2 else 1024) or
                    arm_issue["overlay_generation"] != (0 if operation == 2 else 1) or
                    arm_completion["overlay_generation"] != 1 or
                    arm_issue["descriptor_sha256"] != expected_descriptor_hash or
                    arm_issue["payload_sha256"] !=
                    (expected["page_sha256"] if operation == 2 else IDENTITY_EMPTY_SHA256) or
                    arm_completion["completion_sha256"] !=
                    (IDENTITY_EMPTY_SHA256 if operation == 2 else expected["page_sha256"])):
                raise BrowserConformanceError("P4 identity arm transcript link differs")
        arm_ordinals = {ordinal for arm_link in arm_links.values()
                        for ordinal in (arm_link["issue"], arm_link["completion"])}
        if (len(arm_ordinals) != 6 or max(arm_ordinals) >= issue_ordinal or
                issue_ordinal in used_candidate_records or completion_ordinal in used_candidate_records or
                issue_ordinal in arm_ordinals or completion_ordinal in arm_ordinals):
            raise BrowserConformanceError("P4 identity transcript pairs overlap")
        used_candidate_records.update((issue_ordinal, completion_ordinal))
        preceding = acknowledgement["preceding_read"]
        prior_is_read = issue_ordinal >= 2 and records[issue_ordinal - 2]["operation"] == 1
        if (preceding is None) == prior_is_read:
            raise BrowserConformanceError("P4 preceding read provenance is incomplete")
        if preceding is not None:
            preceding = exact_keys(preceding, ["completion_boundary", "first_block", "generation",
                                                "issue_boundary", "page_sha256", "request_id"],
                                   f"P4 acknowledgement {index} preceding read")
            if issue_ordinal < 2:
                raise BrowserConformanceError("P4 preceding read is not adjacent")
            read_issue = transcript_raw[64 + (issue_ordinal - 2) * 256:
                                        64 + (issue_ordinal - 1) * 256]
            read_completion = transcript_raw[64 + (issue_ordinal - 1) * 256:
                                             64 + issue_ordinal * 256]
            read_request = tagged_u64(preceding["request_id"], "P4 preceding read request")
            read_generation = tagged_u64(preceding["generation"], "P4 preceding read generation")
            read_block = tagged_u64(preceding["first_block"], "P4 preceding read block")
            read_issue_boundary = tagged_u64(preceding["issue_boundary"],
                                             "P4 preceding read issue")
            read_completion_boundary = tagged_u64(preceding["completion_boundary"],
                                                  "P4 preceding read completion")
            read_hash = tagged_hash(preceding["page_sha256"], "P4 preceding read page")
            if (unpack_from("<QIIQ", read_issue, 0) !=
                    (issue_ordinal - 2, 1, 1, read_issue_boundary) or
                    unpack_from("<QIIQ", read_completion, 0) !=
                    (issue_ordinal - 1, 2, 1, read_completion_boundary) or
                    unpack_from("<Q", read_issue, 32)[0] != read_generation or
                    unpack_from("<Q", read_issue, 40)[0] != read_request or
                    unpack_from("<Q", read_issue, 80)[0] != read_block or
                    read_completion[168:200].hex() != read_hash or
                    issue_ordinal - 2 in used_candidate_records or
                    issue_ordinal - 1 in used_candidate_records or
                    issue_ordinal - 2 in arm_ordinals or issue_ordinal - 1 in arm_ordinals):
                raise BrowserConformanceError("P4 preceding read differs from its adjacent transcript")
            used_candidate_records.update((issue_ordinal - 2, issue_ordinal - 1))
        if index == 0 and (request_id, transaction_id, first_block, issue_boundary,
                           due_boundary, completion_boundary, effective, page["source"]) != \
                (135, 135, 1299, 1_366_722, 1_366_722, 1_366_722,
                 IDENTITY_SELECTED_PAGE_SHA256, "base"):
            raise BrowserConformanceError("P4 identity first acknowledgement is not selected")
        previous_request = request_id
        previous_completion_ordinal = completion_ordinal
        previous_completion_boundary = completion_boundary
    first = exact_keys(stream["first"], ["boundary", "first_block", "generation",
                                         "request_id", "transaction_id"], "P4 identity first tuple")
    first_values = {name: str(tagged_u64(first[name], f"P4 first {name}")) for name in first}
    first_ack = stream["acknowledgements"][0]["request"]
    expected_first = {"boundary": first_ack["issue_boundary"]["u64"],
                      "first_block": first_ack["first_block"]["u64"],
                      "generation": first_ack["generation"]["u64"],
                      "request_id": first_ack["request_id"]["u64"],
                      "transaction_id": first_ack["transaction_id"]["u64"]}
    if first_values != expected_first or first_values != summary["first"] or first_values != {
            "boundary": "1366722", "first_block": "1299", "generation": "1",
            "request_id": "135", "transaction_id": "135"}:
        raise BrowserConformanceError("P4 identity first tuple differs from its summary")


def validate_p4_manifest(value: dict[str, Any], raw: bytes,
                         session: Path | None = None) -> dict[str, Any]:
    """Validate the complete closed P4 schema and optionally rehash every sidecar."""
    exact_keys(value, ["artifacts", "comparison", "m6_release_record", "native", "native_inputs",
                       "outcome", "patches", "portable", "prepared", "runtime_execution_performed",
                       "schedule", "schema", "session", "source", "summary", "target"], "P4 manifest")
    if (value["schema"] != "cadr-m7-frame-conformance-result-v2" or
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
                                    "effective_page_identity", "effective_page_identity_file",
                                    "framebuffer_checkpoint", "host_transcript_file", "module", "ready_file",
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
                          ["collection_sha256", "count", "disposition", "first",
                           "host_transcript_sha256", "profile", "schema"],
                          "P4 effective-page identity")
    exact_keys(identity["first"], ["boundary", "first_block", "generation",
                                   "request_id", "transaction_id"], "P4 identity first tuple")
    digest(identity["collection_sha256"], "P4 effective-page identity collection")
    digest(identity["host_transcript_sha256"], "P4 effective-page host transcript")
    if (identity["schema"] != "cadr-m7-effective-page-identity-stream-v1" or
            identity["profile"] !=
            "CADR-WEB-303/ABI1.5/protocol-v5/C-M7-P4-EFFECTIVE-PAGE-IDENTITY-v2" or
            identity["disposition"] != "IDENTITY_ACK_STREAM" or
            not isinstance(identity["count"], int) or isinstance(identity["count"], bool) or
            not 1 <= identity["count"] <= 1024 or identity["first"] != {
                "generation": "1", "request_id": "135", "transaction_id": "135",
                "first_block": "1299", "boundary": "1366722"}):
        raise BrowserConformanceError("P4 effective-page identity is not the selected stream")
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
    identity_file = file_identity(value["portable"]["effective_page_identity_file"],
                                  "P4 identity stream", IDENTITY_PATH)
    transcript_file = file_identity(value["portable"]["host_transcript_file"],
                                    "P4 host transcript", HOST_TRANSCRIPT_PATH)
    if (identity_file["sha256"] != identity["collection_sha256"] or
            transcript_file["sha256"] != identity["host_transcript_sha256"]):
        raise BrowserConformanceError("P4 identity sidecars differ from their summary")
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
                (IDENTITY_PATH, identity_file, "P4 identity stream"),
                (HOST_TRANSCRIPT_PATH, transcript_file, "P4 host transcript"),
                ("comparison.json", comparison_file, "P4 comparison")):
            rehash_p4_sidecar(session, path, identity, label)
        validate_identity_stream((session / IDENTITY_PATH).read_bytes(),
                                 (session / HOST_TRANSCRIPT_PATH).read_bytes(),
                                 value["portable"]["effective_page_identity"])
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
