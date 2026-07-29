#!/usr/bin/env python3
"""Mutation tests for the shared raw CDRM5TR1 v4 parser."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import struct
import unittest


MODULE = Path(__file__).resolve().parents[1] / "scripts" / "cadr-m5-transcript.py"
SPEC = importlib.util.spec_from_file_location("cadr_m5_transcript", MODULE)
assert SPEC is not None and SPEC.loader is not None
TRANSCRIPT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TRANSCRIPT)


def record(*, due: int, generation: int, sequence: int, kind: int, order: int,
           value: int, interrupt_before: int, interrupt_after: int,
           csr_before: int, csr_after: int, control_before: int, control_after: int,
           location_before: int, location_after: int, tv_before: int, tv_after: int,
           sixty_before: int, sixty_after: int, usec_before: int, usec_after: int,
           phase_before: int, phase_after: int, scancode_before: int,
           scancode_after: int, fifo_before: int, fifo_after: int) -> bytes:
    return struct.pack(
        "<QQQ24I", due, generation, sequence, kind, order, 0, value,
        interrupt_before, interrupt_after, csr_before, csr_after,
        control_before, control_after, location_before, location_after,
        tv_before, tv_after, sixty_before, sixty_after, usec_before, usec_after,
        phase_before, phase_after, scancode_before, scancode_after, fifo_before,
        fifo_after,
    )


def valid_transcript() -> bytes:
    clock = record(
        due=5, generation=1, sequence=3, kind=2, order=0, value=1,
        interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
        control_before=0, control_after=0, location_before=0, location_after=0,
        tv_before=0, tv_after=0, sixty_before=0, sixty_after=1,
        usec_before=0, usec_after=16666, phase_before=0, phase_after=40,
        scancode_before=0, scancode_after=0, fifo_before=0, fifo_after=0,
    )
    keyboard = record(
        due=5, generation=1, sequence=4, kind=3, order=1, value=1,
        interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
        control_before=0, control_after=0, location_before=0, location_after=0,
        tv_before=0, tv_after=0, sixty_before=1, sixty_after=1,
        usec_before=16666, usec_after=16666, phase_before=40, phase_after=40,
        scancode_before=0, scancode_after=0x10001, fifo_before=0, fifo_after=0,
    )
    sequence_break = record(
        due=5, generation=1, sequence=5, kind=1, order=2, value=0,
        interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
        control_before=0, control_after=1 << 26, location_before=0,
        location_after=1 << 26, tv_before=0, tv_after=0,
        sixty_before=1, sixty_after=1, usec_before=16666, usec_after=16666,
        phase_before=40, phase_after=40, scancode_before=0x10001,
        scancode_after=0x10001, fifo_before=0, fifo_after=0,
    )
    return b"CDRM5TR1" + struct.pack("<II", 4, 3) + clock + keyboard + sequence_break


class Cdrm5TranscriptTests(unittest.TestCase):
    def assert_invalid(self, bytes_: bytes, pattern: str) -> None:
        with self.assertRaisesRegex(TRANSCRIPT.TranscriptError, pattern):
            TRANSCRIPT.parse_cdrm5tr1(bytes_)

    def test_valid_raw_v4_frame(self) -> None:
        records = TRANSCRIPT.parse_cdrm5tr1(valid_transcript())
        self.assertEqual([record["kind"] for record in records], [2, 3, 1])
        self.assertEqual(records[-1]["interrupt_control_after"], 1 << 26)

    def test_header_mutations_fail_closed(self) -> None:
        bytes_ = bytearray(valid_transcript())
        bytes_[0] ^= 1
        self.assert_invalid(bytes(bytes_), "magic")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 8, 3)
        self.assert_invalid(bytes(bytes_), "version")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 12, 4)
        self.assert_invalid(bytes(bytes_), "length")
        self.assert_invalid(valid_transcript()[:-1], "length")
        self.assert_invalid(valid_transcript() + b"\\0", "length")

    def test_domain_order_and_transition_mutations_fail_closed(self) -> None:
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 16 + 24, 99)  # first kind
        self.assert_invalid(bytes(bytes_), "unknown scheduler event kind")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 16 + 120 + 28, 9)  # second order
        self.assert_invalid(bytes(bytes_), "same-boundary order")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 16 + 120 + 96, 41)  # keyboard phase-before
        self.assert_invalid(bytes(bytes_), "same-boundary usec_phase before-state")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 16 + 92, 16667)  # clock usec-after
        self.assert_invalid(bytes(bytes_), "clock rational-60Hz")
        bytes_ = bytearray(valid_transcript())
        struct.pack_into("<I", bytes_, 16 + 2 * 120 + 60, 0)  # SB control-after
        self.assert_invalid(bytes(bytes_), "sequence-break interrupt-control")

    def test_same_priority_insertion_sequence_tie_break_is_ascending(self) -> None:
        first = record(
            due=5, generation=1, sequence=10, kind=2, order=0, value=1,
            interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
            control_before=0, control_after=0, location_before=0, location_after=0,
            tv_before=0, tv_after=0, sixty_before=0, sixty_after=1,
            usec_before=0, usec_after=16666, phase_before=0, phase_after=40,
            scancode_before=0, scancode_after=0, fifo_before=0, fifo_after=0,
        )
        second = record(
            due=5, generation=1, sequence=5, kind=2, order=1, value=1,
            interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
            control_before=0, control_after=0, location_before=0, location_after=0,
            tv_before=0, tv_after=0, sixty_before=1, sixty_after=2,
            usec_before=16666, usec_after=33333, phase_before=40, phase_after=20,
            scancode_before=0, scancode_after=0, fifo_before=0, fifo_after=0,
        )
        frame = b"CDRM5TR1" + struct.pack("<II", 4, 2) + first + second
        self.assert_invalid(frame, "same-priority insertion sequence")

    def test_same_due_keyboard_pair_is_ambiguous(self) -> None:
        first = record(
            due=5, generation=1, sequence=3, kind=3, order=0, value=1,
            interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
            control_before=0, control_after=0, location_before=0, location_after=0,
            tv_before=0, tv_after=0, sixty_before=0, sixty_after=0,
            usec_before=0, usec_after=0, phase_before=0, phase_after=0,
            scancode_before=0, scancode_after=0x10001, fifo_before=0, fifo_after=0,
        )
        second = record(
            due=5, generation=1, sequence=4, kind=3, order=1, value=2,
            interrupt_before=0, interrupt_after=0, csr_before=0, csr_after=0,
            control_before=0, control_after=0, location_before=0, location_after=0,
            tv_before=0, tv_after=0, sixty_before=0, sixty_after=0,
            usec_before=0, usec_after=0, phase_before=0, phase_after=0,
            scancode_before=0x10001, scancode_after=0x10002, fifo_before=0, fifo_after=0,
        )
        frame = b"CDRM5TR1" + struct.pack("<II", 4, 2) + first + second
        self.assert_invalid(frame, "more than one keyboard event")


if __name__ == "__main__":
    unittest.main()
