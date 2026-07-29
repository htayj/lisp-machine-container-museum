#!/usr/bin/env python3
"""Validate the fail-closed C-M5 native/Wasm differential evidence contract.

This program deliberately does not drive CADR-WEB.  A producer must use the
ABI1.4 scheduler ingress for clock, keyboard, and sequence-break events, and
must name its separate test-only post-acceptance disk/Xbus latch in the
CDRM5D1 header.  Keeping the latch out of this tool prevents a comparison gate
from silently turning an arbitrary host write into a new public device API.

Each producer writes canonical JSON Lines.  The first line is a CDRM5D1 header;
one subsequent line covers every affected boundary.  The schema contains the
CDRSTATE5 digest and the SHA-256 of the *current complete* CDRM5TR1 byte
stream, so a successful comparison covers both state and scheduler witness.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any, Iterable


_TRANSCRIPT_SPEC = importlib.util.spec_from_file_location(
    "cadr_m5_transcript", Path(__file__).with_name("cadr-m5-transcript.py"))
if _TRANSCRIPT_SPEC is None or _TRANSCRIPT_SPEC.loader is None:
    raise RuntimeError("cannot load shared CDRM5TR1 validator")
_TRANSCRIPT = importlib.util.module_from_spec(_TRANSCRIPT_SPEC)
_TRANSCRIPT_SPEC.loader.exec_module(_TRANSCRIPT)
TranscriptError = _TRANSCRIPT.TranscriptError
parse_cdrm5tr1 = _TRANSCRIPT.parse_cdrm5tr1


SCHEMA = "CDRM5D1"
TARGET = "CADR-WEB-303/ABI1.4/C-M5-SCHED-v1"
SCHEDULE = "INF-M5-PRE-SLOT-v1"
HOOK = "source-oracle-disk-xbus-result-latch-v1"
DEFAULT_DUE = 500000
DEFAULT_LAST = 565536
DEFAULT_SB_CLEAR = 502997
DEFAULT_EXTERNAL_CLEAR = 505102


class DifferentialError(ValueError):
    """A producer, oracle, or comparison failed its exact evidence contract."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def json_line(stream: Iterable[str], path: Path) -> Iterable[dict[str, Any]]:
    for number, line in enumerate(stream, 1):
        if not line.endswith("\n"):
            raise DifferentialError(f"{path}: line {number} is not LF terminated")
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise DifferentialError(f"{path}: invalid JSON on line {number}") from error
        if not isinstance(value, dict):
            raise DifferentialError(f"{path}: line {number} is not an object")
        yield value


def hex_digest(value: Any, name: str, path: Path) -> str:
    if not isinstance(value, str) or len(value) != 64:
        raise DifferentialError(f"{path}: {name} is not a SHA-256 hex digest")
    try:
        int(value, 16)
    except ValueError as error:
        raise DifferentialError(f"{path}: {name} is not hexadecimal") from error
    return value


def exact_keys(value: dict[str, Any], keys: set[str], label: str) -> None:
    if set(value) != keys:
        raise DifferentialError(f"{label}: unexpected schema keys")


def uint(value: Any, name: str, path: Path) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise DifferentialError(f"{path}: {name} is not an unsigned integer")
    return value


def boolean(value: Any, name: str, path: Path) -> bool:
    if not isinstance(value, bool):
        raise DifferentialError(f"{path}: {name} is not Boolean")
    return value


def read_raw_transcript(path: Path, label: str) -> tuple[bytes, str]:
    if not path.is_file():
        raise DifferentialError(f"missing {label} raw CDRM5TR1 sidecar: {path}")
    raw = path.read_bytes()
    try:
        parse_cdrm5tr1(raw)
    except TranscriptError as error:
        raise DifferentialError(f"{label} raw CDRM5TR1 is invalid: {error}") from error
    return raw, hashlib.sha256(raw).hexdigest()


def read_producer(path: Path, transcript_path: Path, producer: str, due: int, last: int,
                  sb_clear: int, external_clear: int, disk_sha256: str) -> tuple[dict[str, Any], list[dict[str, Any]], bytes, bytes, str]:
    required_header = {
        "schema", "schema_version", "target", "producer", "due_boundary",
        "final_boundary", "schedule", "hook", "ingress", "cdrm5tr1_schema",
        "cdrm5tr1_version", "projected_markers", "disk_sha256_before",
        "disk_sha256_after", "keyboard_scheduler_value",
        "projected_keyboard_scancode", "cdrm5tr1_record_bytes",
    }
    required_record = {
        "boundary", "cdrstate5_sha256", "cdrm5tr1_current_sha256",
        "sequence_break_pending", "external_interrupt_pending",
    }
    expected_ingress = {
        "clock": "scheduler-event", "keyboard": "scheduler-event",
        "sequence_break": "scheduler-event",
        "disk_xbus": "test-only-post-acceptance-latch",
    }
    expected_markers = {
        "sequence_break_clear_boundary": sb_clear,
        "external_interrupt_clear_boundary": external_clear,
    }
    if not path.is_file():
        raise DifferentialError(f"missing {producer} producer output: {path}")
    transcript, transcript_sha256 = read_raw_transcript(transcript_path, producer)
    raw = path.read_bytes()
    try:
        text = raw.decode("ascii")
    except UnicodeDecodeError as error:
        raise DifferentialError(f"{path}: CDRM5D1 must be ASCII JSON Lines") from error
    lines = iter(json_line(text.splitlines(keepends=True), path))
    try:
        header = next(lines)
    except StopIteration as error:
        raise DifferentialError(f"{path}: empty CDRM5D1 stream") from error
    exact_keys(header, required_header, str(path))
    if (header["schema"] != SCHEMA or header["schema_version"] != 1 or
            header["target"] != TARGET or header["producer"] != producer or
            header["due_boundary"] != due or header["final_boundary"] != last or
            header["schedule"] != SCHEDULE or header["hook"] != HOOK or
            header["ingress"] != expected_ingress or
            header["cdrm5tr1_schema"] != "CDRM5TR1" or
            header["cdrm5tr1_version"] != 4 or
            header["cdrm5tr1_record_bytes"] != 120 or
            header["projected_markers"] != expected_markers or
            header["keyboard_scheduler_value"] != 1 or
            header["projected_keyboard_scancode"] != 0x10001):
        raise DifferentialError(f"{path}: CDRM5D1 header does not name the selected M5 profile")
    if (hex_digest(header["disk_sha256_before"], "disk_sha256_before", path) != disk_sha256 or
            hex_digest(header["disk_sha256_after"], "disk_sha256_after", path) != disk_sha256):
        raise DifferentialError(f"{path}: producer did not preserve the selected base disk")
    records: list[dict[str, Any]] = []
    for expected_boundary, record in zip(range(due, last + 1), lines):
        exact_keys(record, required_record, str(path))
        if uint(record["boundary"], "boundary", path) != expected_boundary:
            raise DifferentialError(f"{path}: missing or reordered affected boundary {expected_boundary}")
        hex_digest(record["cdrstate5_sha256"], "cdrstate5_sha256", path)
        if (hex_digest(record["cdrm5tr1_current_sha256"], "cdrm5tr1_current_sha256", path) !=
                transcript_sha256):
            raise DifferentialError(f"{path}: boundary {expected_boundary} does not bind its raw CDRM5TR1 sidecar")
        expected_sb = expected_boundary < sb_clear
        expected_external = expected_boundary < external_clear
        if (boolean(record["sequence_break_pending"], "sequence_break_pending", path) != expected_sb or
                boolean(record["external_interrupt_pending"], "external_interrupt_pending", path) != expected_external):
            raise DifferentialError(f"{path}: projected clear markers disagree at S{expected_boundary}")
        records.append(record)
    try:
        extra = next(lines)
    except StopIteration:
        extra = None
    if extra is not None or len(records) != last - due + 1:
        raise DifferentialError(f"{path}: CDRM5D1 does not end at S{last}")
    return header, records, raw, transcript, transcript_sha256


def validate_oracle(capture: Path, due: int, last: int, sb_clear: int,
                    external_clear: int) -> str:
    metadata_path = capture / "capture.json"
    normalized_path = capture / "scheduler.cdrm5usim1.ndjson"
    if not metadata_path.is_file() or not normalized_path.is_file():
        raise DifferentialError("upstream oracle capture requires capture.json and scheduler.cdrm5usim1.ndjson")
    metadata = json.loads(metadata_path.read_text(encoding="ascii"))
    if not isinstance(metadata, dict):
        raise DifferentialError("upstream oracle capture metadata is not an object")
    if (metadata.get("schema") != "cadr-m5-upstream-scheduler-oracle" or
            metadata.get("schema_version") != 1 or
            metadata.get("capture_status") != "instrumented-schedule-captured-not-c-m5-closure"):
        raise DifferentialError("upstream oracle capture is not the normalized M5 instrumented witness")
    input_record = metadata.get("input")
    events = metadata.get("events")
    if not isinstance(input_record, dict) or not isinstance(events, dict):
        raise DifferentialError("upstream oracle capture lacks input or events")
    if input_record.get("due_slot") != due or input_record.get("post_slots") != last - due:
        raise DifferentialError("upstream oracle capture covers a different M5 interval")
    consumption = events.get("interrupt_consumption")
    if not isinstance(consumption, dict) or consumption.get("sequence_break_consumed_slots") != [sb_clear] or consumption.get("external_interrupt_consumed_slots") != [external_clear]:
        raise DifferentialError("upstream oracle does not establish S502997/S505102 projected clear markers")
    phases: list[str] = []
    sb_seen = external_seen = False
    with normalized_path.open("r", encoding="ascii", newline="") as stream:
        for number, item in enumerate(json_line(stream, normalized_path), 1):
            if number == 1:
                if (item.get("schema") != "cadr-m5-upstream-scheduler-oracle" or
                        item.get("schema_version") != 1 or item.get("due_slot") != due or
                        item.get("post_slots") != last - due or item.get("schedule") != SCHEDULE):
                    raise DifferentialError("upstream normalized stream has a different profile")
                continue
            phase = item.get("phase")
            if isinstance(phase, str) and len(phases) < 5:
                phases.append(phase)
            if item.get("machine_cycles") == sb_clear and item.get("sequence_break_consumed") == 1:
                sb_seen = True
            if item.get("machine_cycles") == external_clear and item.get("external_interrupt_consumed") == 1:
                external_seen = True
    if phases != ["before", "disk-completion", "clock", "keyboard", "sequence-break"]:
        raise DifferentialError("upstream normalized stream does not prove INF-M5-PRE-SLOT-v1")
    if not sb_seen or not external_seen:
        raise DifferentialError("upstream normalized stream lacks one projected clear marker")
    return sha256_file(normalized_path)


def compare(args: argparse.Namespace) -> dict[str, Any]:
    if not (0 <= args.due < args.sb_clear <= args.last and
            0 <= args.due < args.external_clear <= args.last):
        raise DifferentialError("marker boundaries must lie inside the affected interval")
    disk_sha256 = hex_digest(args.disk_sha256, "disk_sha256", Path("argument"))
    oracle_sha = validate_oracle(args.oracle_capture, args.due, args.last,
                                 args.sb_clear, args.external_clear)
    outputs = {
        "native-a": read_producer(args.native_a, args.native_a_transcript, "native", args.due, args.last,
                                  args.sb_clear, args.external_clear, disk_sha256),
        "native-b": read_producer(args.native_b, args.native_b_transcript, "native", args.due, args.last,
                                  args.sb_clear, args.external_clear, disk_sha256),
        "wasm-a": read_producer(args.wasm_a, args.wasm_a_transcript, "wasm", args.due, args.last,
                                args.sb_clear, args.external_clear, disk_sha256),
        "wasm-b": read_producer(args.wasm_b, args.wasm_b_transcript, "wasm", args.due, args.last,
                                args.sb_clear, args.external_clear, disk_sha256),
    }
    native_a = outputs["native-a"]
    if outputs["native-a"][2] != outputs["native-b"][2]:
        raise DifferentialError("native repeat CDRM5D1 bytes differ")
    if outputs["wasm-a"][2] != outputs["wasm-b"][2]:
        raise DifferentialError("Wasm repeat CDRM5D1 bytes differ")
    if outputs["native-a"][3] != outputs["native-b"][3]:
        raise DifferentialError("native repeat raw CDRM5TR1 bytes differ")
    if outputs["wasm-a"][3] != outputs["wasm-b"][3]:
        raise DifferentialError("Wasm repeat raw CDRM5TR1 bytes differ")
    if outputs["wasm-a"][3] != native_a[3]:
        raise DifferentialError("native and Wasm raw CDRM5TR1 bytes differ")
    for name in ("wasm-a", "wasm-b"):
        if outputs[name][1] != native_a[1]:
            raise DifferentialError(f"native and {name} differ at an affected boundary")
    return {
        "schema": "cadr-m5-differential-result", "schema_version": 1,
        "status": "native-wasm-and-repeats-identical",
        "due_boundary": args.due, "final_boundary": args.last,
        "sequence_break_clear_boundary": args.sb_clear,
        "external_interrupt_clear_boundary": args.external_clear,
        "oracle_normalized_sha256": oracle_sha,
        "native_sha256": hashlib.sha256(native_a[2]).hexdigest(),
        "wasm_sha256": hashlib.sha256(outputs["wasm-a"][2]).hexdigest(),
        "cdrm5tr1_sha256": native_a[4],
    }


def validate_oracle_command(args: argparse.Namespace) -> dict[str, Any]:
    if not (0 <= args.due < args.sb_clear <= args.last and
            0 <= args.due < args.external_clear <= args.last):
        raise DifferentialError("marker boundaries must lie inside the affected interval")
    return {
        "schema": "cadr-m5-differential-oracle-preflight", "schema_version": 1,
        "status": "normalized-oracle-projects-required-clear-markers",
        "normalized_sha256": validate_oracle(args.oracle_capture, args.due, args.last,
                                               args.sb_clear, args.external_clear),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("compare", "validate-oracle"))
    parser.add_argument("--native-a", type=Path)
    parser.add_argument("--native-b", type=Path)
    parser.add_argument("--wasm-a", type=Path)
    parser.add_argument("--wasm-b", type=Path)
    parser.add_argument("--native-a-transcript", type=Path)
    parser.add_argument("--native-b-transcript", type=Path)
    parser.add_argument("--wasm-a-transcript", type=Path)
    parser.add_argument("--wasm-b-transcript", type=Path)
    parser.add_argument("--oracle-capture", type=Path, required=True)
    parser.add_argument("--disk-sha256")
    parser.add_argument("--due", type=int, default=DEFAULT_DUE)
    parser.add_argument("--last", type=int, default=DEFAULT_LAST)
    parser.add_argument("--sb-clear", type=int, default=DEFAULT_SB_CLEAR)
    parser.add_argument("--external-clear", type=int, default=DEFAULT_EXTERNAL_CLEAR)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate-oracle":
            result = validate_oracle_command(args)
        else:
            if (args.native_a is None or args.native_b is None or args.wasm_a is None or
                    args.wasm_b is None or args.native_a_transcript is None or
                    args.native_b_transcript is None or args.wasm_a_transcript is None or
                    args.wasm_b_transcript is None or args.disk_sha256 is None):
                raise DifferentialError("compare requires both native/Wasm repeats, raw CDRM5TR1 sidecars, and disk_sha256")
            result = compare(args)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    except (DifferentialError, OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"cadr-m5-differential-runner: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
