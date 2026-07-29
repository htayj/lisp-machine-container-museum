#!/usr/bin/env python3
"""Parse and validate the raw CDRM5TR1 v4 scheduler transcript.

This is the shared gate for native and Wasm M5 differential producers.  It
validates the raw ABI record before higher-level CDRM5D1 metadata binds its
SHA-256; it neither drives a machine nor accepts a lossy JSON projection.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import struct
import sys
from typing import Any


MAGIC = b"CDRM5TR1"
VERSION = 4
HEADER_BYTES = 16
RECORD_BYTES = 120
MAX_RECORDS = 256
KIND_SEQUENCE_BREAK = 1
KIND_CLOCK = 2
KIND_KEYBOARD = 3
CSR_MASK = 0o57
CSR_KEYBOARD_INTERRUPT = 0o4
CSR_KEYBOARD_READY = 0o40
INTERRUPT_UNIBUS_ENABLE = 0o2000
INTERRUPT_UNIBUS_PENDING = 0o100000
INTERRUPT_UNIBUS_VECTOR = 0o260
INTERRUPT_XBUS_PENDING = 0o40000
INTERRUPT_CONTROL_SEQUENCE_BREAK = 1 << 26
INTERRUPT_CONTROL_LOCATION_BITS = 0xF << 26

_RECORD = struct.Struct("<QQQ24I")
_NAMES = (
    "kind", "order", "flags", "value",
    "interrupt_before", "interrupt_after", "iob_csr_before", "iob_csr_after",
    "interrupt_control_before", "interrupt_control_after",
    "location_counter_before", "location_counter_after",
    "tv_mode_before", "tv_mode_after", "sixty_cycle_before", "sixty_cycle_after",
    "usec_clock_before", "usec_clock_after", "usec_phase_before", "usec_phase_after",
    "scancode_before", "scancode_after", "fifo_count_before", "fifo_count_after",
)


class TranscriptError(ValueError):
    """The byte stream is not a selected-profile raw CDRM5TR1 v4 transcript."""


def _fail(index: int | None, message: str) -> None:
    where = "header" if index is None else f"record {index}"
    raise TranscriptError(f"{where}: {message}")


def _priority(kind: int) -> int:
    return {KIND_CLOCK: 0, KIND_KEYBOARD: 1, KIND_SEQUENCE_BREAK: 2}[kind]


def _same_due_continuity(previous: dict[str, int], current: dict[str, int], index: int) -> None:
    fields = (
        "interrupt", "iob_csr", "interrupt_control", "location_counter", "tv_mode",
        "sixty_cycle", "usec_clock", "usec_phase", "scancode", "fifo_count",
    )
    for field in fields:
        if current[f"{field}_before"] != previous[f"{field}_after"]:
            _fail(index, f"same-boundary {field} before-state does not continue prior after-state")


def _unchanged(record: dict[str, int], index: int, *fields: str) -> None:
    for field in fields:
        if record[f"{field}_after"] != record[f"{field}_before"]:
            _fail(index, f"{field} changes for this event kind")


def _validate_transition(record: dict[str, int], index: int) -> None:
    kind = record["kind"]
    if kind == KIND_SEQUENCE_BREAK:
        expected_control = record["interrupt_control_before"] | INTERRUPT_CONTROL_SEQUENCE_BREAK
        expected_location = ((record["location_counter_before"] & ~INTERRUPT_CONTROL_LOCATION_BITS) |
                             (expected_control & INTERRUPT_CONTROL_LOCATION_BITS))
        if record["interrupt_control_after"] != expected_control:
            _fail(index, "sequence-break interrupt-control transition is invalid")
        if record["location_counter_after"] != expected_location:
            _fail(index, "sequence-break location-counter transition is invalid")
        _unchanged(record, index, "interrupt", "iob_csr", "tv_mode", "sixty_cycle",
                   "usec_clock", "usec_phase", "scancode", "fifo_count")
        return
    if kind == KIND_CLOCK:
        phase = record["usec_phase_before"] + 1_000_000
        expected_clock = (record["usec_clock_before"] + phase // 60) & 0xFFFFFFFF
        expected_phase = phase % 60
        expected_sixty = (record["sixty_cycle_before"] + 1) & 0xFFFF
        if (record["usec_clock_after"] != expected_clock or
                record["usec_phase_after"] != expected_phase or
                record["sixty_cycle_after"] != expected_sixty):
            _fail(index, "clock rational-60Hz transition is invalid")
        if record["tv_mode_before"] & (1 << 3):
            expected_tv = record["tv_mode_before"] | (1 << 4)
            expected_interrupt = record["interrupt_before"] | INTERRUPT_XBUS_PENDING
        else:
            expected_tv = record["tv_mode_before"]
            expected_interrupt = record["interrupt_before"]
        if (record["tv_mode_after"] != expected_tv or
                record["interrupt_after"] != expected_interrupt):
            _fail(index, "clock TV/Xbus transition is invalid")
        _unchanged(record, index, "interrupt_control", "location_counter", "iob_csr",
                   "scancode", "fifo_count")
        return

    # Keyboard delivery either occupies the visible register or appends one
    # raw 16-bit value to the hidden FIFO.  It never changes clock, TV, or CPU
    # interrupt-control state.
    _unchanged(record, index, "interrupt_control", "location_counter", "tv_mode",
               "sixty_cycle", "usec_clock", "usec_phase")
    if record["iob_csr_before"] & CSR_KEYBOARD_READY:
        if (record["iob_csr_after"] != record["iob_csr_before"] or
                record["scancode_after"] != record["scancode_before"] or
                record["fifo_count_after"] != record["fifo_count_before"] + 1 or
                record["interrupt_after"] != record["interrupt_before"]):
            _fail(index, "keyboard FIFO-append transition is invalid")
        return
    expected_scancode = 0x10000 | record["value"]
    if record["scancode_after"] != expected_scancode or record["fifo_count_after"] != record["fifo_count_before"]:
        _fail(index, "keyboard visible-register transition is invalid")
    if record["iob_csr_before"] & CSR_KEYBOARD_INTERRUPT:
        expected_csr = record["iob_csr_before"] | CSR_KEYBOARD_READY
        if record["interrupt_before"] & INTERRUPT_UNIBUS_ENABLE:
            expected_interrupt = ((record["interrupt_before"] & ~0o1774) |
                                  INTERRUPT_UNIBUS_PENDING | INTERRUPT_UNIBUS_VECTOR)
        else:
            expected_interrupt = record["interrupt_before"]
    else:
        expected_csr = record["iob_csr_before"]
        expected_interrupt = record["interrupt_before"]
    if (record["iob_csr_after"] != expected_csr or
            record["interrupt_after"] != expected_interrupt):
        _fail(index, "keyboard CSR/Unibus transition is invalid")


def _validate_record(record: dict[str, int], index: int,
                     previous: dict[str, int] | None,
                     generation: int | None,
                     sequences: set[int], keyboard_due_ticks: set[int]) -> int:
    if record["generation"] == 0:
        _fail(index, "generation is zero")
    if generation is not None and record["generation"] != generation:
        _fail(index, "generation changes within one captured transcript")
    if record["insertion_sequence"] in sequences:
        _fail(index, "insertion sequence is not unique")
    sequences.add(record["insertion_sequence"])
    if record["kind"] not in (KIND_SEQUENCE_BREAK, KIND_CLOCK, KIND_KEYBOARD):
        _fail(index, "unknown scheduler event kind")
    if record["flags"] != 0:
        _fail(index, "nonzero scheduler flags")
    if ((record["kind"] == KIND_SEQUENCE_BREAK and record["value"] != 0) or
            (record["kind"] == KIND_CLOCK and record["value"] != 1) or
            (record["kind"] == KIND_KEYBOARD and record["value"] > 0xFFFF)):
        _fail(index, "event kind/value domain is invalid")
    if record["kind"] == KIND_KEYBOARD:
        if record["due_tick"] in keyboard_due_ticks:
            _fail(index, "more than one keyboard event has the same due tick")
        keyboard_due_ticks.add(record["due_tick"])
    if (record["interrupt_before"] > 0xFFFF or record["interrupt_after"] > 0xFFFF or
            record["iob_csr_before"] & ~CSR_MASK or record["iob_csr_after"] & ~CSR_MASK or
            record["sixty_cycle_before"] > 0xFFFF or record["sixty_cycle_after"] > 0xFFFF or
            record["usec_phase_before"] >= 60 or record["usec_phase_after"] >= 60 or
            record["scancode_before"] > 0x1FFFF or record["scancode_after"] > 0x1FFFF or
            record["fifo_count_before"] > 10 or record["fifo_count_after"] > 10):
        _fail(index, "recorded IOB or interrupt scalar is out of domain")
    if previous is None:
        if record["order"] != 0:
            _fail(index, "first record order is not zero")
    elif record["due_tick"] < previous["due_tick"]:
        _fail(index, "due ticks decrease")
    elif record["due_tick"] == previous["due_tick"]:
        if record["order"] != previous["order"] + 1:
            _fail(index, "same-boundary order is not consecutive")
        current_priority = _priority(record["kind"])
        previous_priority = _priority(previous["kind"])
        if current_priority < previous_priority:
            _fail(index, "same-boundary priority decreases")
        if (current_priority == previous_priority and
                record["insertion_sequence"] <= previous["insertion_sequence"]):
            _fail(index, "same-boundary same-priority insertion sequence does not increase")
        _same_due_continuity(previous, record, index)
    elif record["order"] != 0:
        _fail(index, "later-boundary order does not restart at zero")
    _validate_transition(record, index)
    return record["generation"]


def parse_cdrm5tr1(data: bytes) -> list[dict[str, int]]:
    """Return validated raw records or raise TranscriptError without recovery."""
    if len(data) < HEADER_BYTES:
        _fail(None, "shorter than 16-byte header")
    if data[:8] != MAGIC:
        _fail(None, "magic is not CDRM5TR1")
    version, count = struct.unpack_from("<II", data, 8)
    if version != VERSION:
        _fail(None, f"version is {version}, not {VERSION}")
    if count > MAX_RECORDS:
        _fail(None, f"count {count} exceeds {MAX_RECORDS}")
    expected = HEADER_BYTES + count * RECORD_BYTES
    if expected != len(data):
        _fail(None, f"length {len(data)} is not exactly {expected} for count {count}")
    result: list[dict[str, int]] = []
    generation: int | None = None
    sequences: set[int] = set()
    keyboard_due_ticks: set[int] = set()
    for index in range(count):
        values = _RECORD.unpack_from(data, HEADER_BYTES + index * RECORD_BYTES)
        record = dict(zip(("due_tick", "generation", "insertion_sequence", *_NAMES), values,
                          strict=True))
        generation = _validate_record(record, index,
                                      result[-1] if result else None,
                                      generation, sequences, keyboard_due_ticks)
        result.append(record)
    return result


def validate_path(path: Path) -> list[dict[str, int]]:
    try:
        data = sys.stdin.buffer.read() if str(path) == "-" else path.read_bytes()
    except OSError as error:
        raise TranscriptError(f"cannot read {path}: {error}") from error
    return parse_cdrm5tr1(data)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate",))
    parser.add_argument("input", type=Path)
    parser.add_argument("--json", action="store_true", help="emit validated record metadata")
    args = parser.parse_args(argv)
    try:
        records = validate_path(args.input)
    except TranscriptError as error:
        print(f"cadr-m5-transcript: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"schema": "CDRM5TR1", "version": VERSION,
                          "record_bytes": RECORD_BYTES, "count": len(records)},
                         sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
