#!/usr/bin/env python3
"""Stream-compare the exact M3-P2 CDRM3AD1/BUS1/DISK1 sidecars."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import struct
import sys
from typing import Any, Iterator, TextIO

HEADER = struct.Struct("<8sIIQQ")
FOOTER = struct.Struct("<8sQI12s")
DIGEST_BYTES = 32
METADATA_KEYS = {"schema", "schema_version", "requested_slots"}
BUS_KEYS = {
    "record", "post_slot_s", "intra_slot_sequence", "direction",
    "physical_word_address", "write_value", "read_result",
    "bus_error_after", "interrupt_status_after",
}
DISK_KEYS = {
    "record", "post_slot_s", "intra_slot_sequence", "action",
    "register_direction", "register_offset", "input_value", "returned_value",
    "command", "clp", "da", "lma", "status", "reset",
    "done_interrupt_enable", "attention_interrupt_enable", "interrupt_action",
    "request_ready", "request_direction", "request_clp", "request_cylinder",
    "request_head", "request_block", "selected_unit", "selected_configured",
    "selected_online", "selected_read_only", "selected_fault",
    "selected_attention", "selected_seek_error", "selected_cylinder",
    "selected_head", "selected_lba", "media_action",
}
BUS_NUMERIC_KEYS = BUS_KEYS - {"record", "direction"}
DISK_STRING_KEYS = {
    "record", "action", "register_direction", "interrupt_action",
    "request_direction", "media_action",
}
DISK_NUMERIC_KEYS = DISK_KEYS - DISK_STRING_KEYS
DISK_BOOL_KEYS = {
    "attention_interrupt_enable", "done_interrupt_enable", "request_ready",
    "reset", "selected_attention", "selected_configured", "selected_fault",
    "selected_online", "selected_read_only", "selected_seek_error",
}


class CompareError(ValueError):
    pass


def canonical_object(raw: str, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise CompareError(f"{label}: malformed JSON") from error
    if not isinstance(value, dict):
        raise CompareError(f"{label}: JSON value is not an object")
    if raw != json.dumps(value, sort_keys=True, separators=(",", ":")):
        raise CompareError(f"{label}: object is not canonical compact JSON")
    return value


def read_line(stream: TextIO, label: str) -> str:
    raw = stream.readline()
    if not raw:
        raise CompareError(f"{label}: unexpected end of stream")
    if not raw.endswith("\n"):
        raise CompareError(f"{label}: line is not LF-terminated")
    return raw[:-1]


def compare_adapter(left: Path, right: Path, expected_slots: int) -> int:
    expected_count = expected_slots + 1
    expected_size = HEADER.size + expected_count * DIGEST_BYTES + FOOTER.size
    if left.stat().st_size != expected_size or right.stat().st_size != expected_size:
        raise CompareError("CDRM3AD1 byte size does not match selected slot count")
    with left.open("rb") as a, right.open("rb") as b:
        left_header = HEADER.unpack(a.read(HEADER.size))
        right_header = HEADER.unpack(b.read(HEADER.size))
        expected_header = (
            b"CDRM3AD1", 1, DIGEST_BYTES, expected_count, expected_slots)
        if left_header != expected_header or right_header != expected_header:
            raise CompareError("CDRM3AD1 header is not the selected framing")
        for ordinal in range(expected_count):
            left_digest = a.read(DIGEST_BYTES)
            right_digest = b.read(DIGEST_BYTES)
            if left_digest != right_digest:
                raise CompareError(f"CDRM3AD1 mismatch at S{ordinal}: digest")
        expected_footer = (b"CDRM3AE1", expected_count, 0, b"\0" * 12)
        if (FOOTER.unpack(a.read(FOOTER.size)) != expected_footer or
                FOOTER.unpack(b.read(FOOTER.size)) != expected_footer):
            raise CompareError("CDRM3AD1 footer is incomplete or noncanonical")
    return expected_count


def event_stream(
    stream: TextIO, label: str, schema: str, keys: set[str],
    expected_slots: int,
) -> Iterator[dict[str, Any]]:
    metadata = canonical_object(read_line(stream, f"{label} metadata"), label)
    if set(metadata) != METADATA_KEYS or metadata != {
        "requested_slots": expected_slots,
        "schema": schema,
        "schema_version": 1,
    }:
        raise CompareError(f"{label}: metadata does not select {schema}")
    prior_s = -1
    expected_sequence = 0
    line_number = 1
    while True:
        raw = stream.readline()
        if not raw:
            return
        line_number += 1
        if not raw.endswith("\n"):
            raise CompareError(f"{label}:{line_number}: line is not LF-terminated")
        item = canonical_object(raw[:-1], f"{label}:{line_number}")
        if set(item) != keys:
            raise CompareError(f"{label}:{line_number}: wrong key inventory")
        numeric_keys = (
            BUS_NUMERIC_KEYS if schema == "CDRM3BUS1"
            else DISK_NUMERIC_KEYS)
        if any(
            isinstance(item[name], bool) or not isinstance(item[name], int) or
            item[name] < 0 or item[name] > 0xffffffffffffffff
            for name in numeric_keys
        ):
            raise CompareError(
                f"{label}:{line_number}: non-unsigned numeric field")
        s = item.get("post_slot_s")
        sequence = item.get("intra_slot_sequence")
        if (isinstance(s, bool) or not isinstance(s, int) or
                s < 1 or s > expected_slots or
                isinstance(sequence, bool) or not isinstance(sequence, int) or
                sequence < 0):
            raise CompareError(f"{label}:{line_number}: invalid S/sequence")
        if s != prior_s:
            if s < prior_s:
                raise CompareError(f"{label}:{line_number}: S decreases")
            prior_s = s
            expected_sequence = 0
        if sequence != expected_sequence:
            raise CompareError(
                f"{label}:{line_number}: S{s} sequence {sequence} "
                f"expected {expected_sequence}")
        expected_sequence += 1
        if schema == "CDRM3BUS1":
            if (item["record"] != "bus" or
                    item["direction"] not in ("read", "write") or
                    item["physical_word_address"] > 0xffffff or
                    item["bus_error_after"] > 0xffff or
                    item["interrupt_status_after"] > 0xffff or
                    (item["direction"] == "read" and item["write_value"] != 0) or
                    (item["direction"] == "write" and item["read_result"] != 0)):
                raise CompareError(
                    f"{label}:{line_number}: invalid bus direction fields")
        else:
            if any(item[name] not in (0, 1) for name in DISK_BOOL_KEYS):
                raise CompareError(f"{label}:{line_number}: non-boolean disk field")
            if (item["record"] != "disk" or
                    item["action"] not in (
                        "register", "interrupt", "request", "block", "completion") or
                    item["register_direction"] not in ("read", "write", "none") or
                    item["interrupt_action"] not in ("assert", "deassert", "none") or
                    item["request_direction"] not in ("read", "compare", "none") or
                    item["media_action"] not in (
                        "request", "block", "completion", "none") or
                    (item["action"] == "register") !=
                    (item["register_direction"] in ("read", "write"))):
                raise CompareError(
                    f"{label}:{line_number}: invalid disk action fields")
            if item["register_offset"] > 3 or item["selected_unit"] > 7 or \
                    item["selected_cylinder"] > 0xfff or item["selected_head"] > 0xff:
                raise CompareError(f"{label}:{line_number}: invalid disk register or selected CHS field")
            if item["request_ready"] == 0 and (
                    item["request_direction"] != "none" or
                    any(item[name] != 0 for name in (
                        "request_clp", "request_cylinder", "request_head", "request_block"))):
                raise CompareError(f"{label}:{line_number}: inactive request has payload")
            if item["request_ready"] != 0 and (
                    item["request_direction"] == "none" or
                    item["request_cylinder"] >= 815 or item["request_head"] >= 19 or
                    item["request_block"] >= 17):
                raise CompareError(f"{label}:{line_number}: invalid active request CHS")
            if item["action"] == "register" and (
                    item["interrupt_action"] != "none" or item["media_action"] != "none"):
                raise CompareError(f"{label}:{line_number}: register has non-register disposition")
            if item["action"] == "interrupt" and (
                    item["register_direction"] != "none" or item["register_offset"] != 0 or
                    item["input_value"] != 0 or item["returned_value"] != 0 or
                    item["media_action"] != "none"):
                raise CompareError(f"{label}:{line_number}: interrupt has register or media payload")
            if item["action"] in ("request", "block", "completion") and (
                    item["register_direction"] != "none" or item["register_offset"] != 0 or
                    item["input_value"] != 0 or item["returned_value"] != 0 or
                    item["interrupt_action"] != "none" or
                    item["media_action"] != item["action"]):
                raise CompareError(f"{label}:{line_number}: media action has wrong disposition")
        yield item


def compare_events(
    left: Path, right: Path, schema: str, keys: set[str],
    expected_slots: int,
) -> int:
    count = 0
    with left.open("r", encoding="utf-8", newline="") as a, \
            right.open("r", encoding="utf-8", newline="") as b:
        left_events = event_stream(a, f"upstream {schema}", schema, keys, expected_slots)
        right_events = event_stream(b, f"portable {schema}", schema, keys, expected_slots)
        while True:
            left_item = next(left_events, None)
            right_item = next(right_events, None)
            if left_item is None or right_item is None:
                if left_item != right_item:
                    raise CompareError(
                        f"{schema} event count mismatch after {count} events")
                return count
            s = left_item["post_slot_s"]
            sequence = left_item["intra_slot_sequence"]
            if (right_item["post_slot_s"], right_item["intra_slot_sequence"]) != (
                    s, sequence):
                raise CompareError(
                    f"{schema} mismatch at S{s}/seq{sequence}: ordinal")
            for field in sorted(keys):
                if left_item[field] != right_item[field]:
                    raise CompareError(
                        f"{schema} mismatch at S{s}/seq{sequence}: {field} "
                        f"upstream={left_item[field]!r} portable={right_item[field]!r}")
            count += 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("upstream_adapter", type=Path)
    parser.add_argument("portable_adapter", type=Path)
    parser.add_argument("upstream_bus", type=Path)
    parser.add_argument("portable_bus", type=Path)
    parser.add_argument("upstream_disk", type=Path)
    parser.add_argument("portable_disk", type=Path)
    parser.add_argument("--expected-slots", type=int, required=True)
    args = parser.parse_args(argv)
    try:
        if args.expected_slots <= 0:
            raise CompareError("expected slots must be positive")
        boundaries = compare_adapter(
            args.upstream_adapter, args.portable_adapter, args.expected_slots)
        bus_events = compare_events(
            args.upstream_bus, args.portable_bus, "CDRM3BUS1",
            BUS_KEYS, args.expected_slots)
        disk_events = compare_events(
            args.upstream_disk, args.portable_disk, "CDRM3DISK1",
            DISK_KEYS, args.expected_slots)
    except (OSError, CompareError, struct.error) as error:
        print(f"M3-P2 adapter comparison failed: {error}", file=sys.stderr)
        return 1
    print(
        f"matched S0..S{args.expected_slots}: {boundaries} CDRM3AD1 "
        f"digests, {bus_events} bus events, {disk_events} disk events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
