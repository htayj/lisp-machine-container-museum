#!/usr/bin/env python3
"""Compare framed M3 CDRSTATE1+CDRSTATE2+CDRSTATE3 transcripts."""
from __future__ import annotations

import argparse
from pathlib import Path
import struct
import sys

HEADER = 32
FOOTER = 32
RECORD = 96


def fail(message: str) -> None:
    raise ValueError(message)


def inspect(path: Path) -> tuple[int, int, int]:
    size = path.stat().st_size
    if size < HEADER + FOOTER:
        fail(f"{path}: too short")
    with path.open("rb") as source:
        header = source.read(HEADER)
        source.seek(size - FOOTER)
        footer = source.read(FOOTER)
    if header[:8] != b"CDRM3TR1" or footer[:8] != b"CDRM3END":
        fail(f"{path}: bad M3 framing magic")
    record_bytes, expected_count, requested_slots = struct.unpack_from("<IQQ", header, 8)
    actual_count, terminal = struct.unpack_from("<QI", footer, 8)
    if record_bytes != RECORD or expected_count != requested_slots + 1:
        fail(f"{path}: invalid header count/record framing")
    if actual_count != expected_count or terminal != 0:
        fail(f"{path}: terminal status {terminal} or count {actual_count} is not complete")
    if size != HEADER + actual_count * RECORD + FOOTER:
        fail(f"{path}: byte length conflicts with signed framing")
    return actual_count, requested_slots, size


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("native", type=Path)
    parser.add_argument("wasm", type=Path)
    parser.add_argument("--expected-slots", type=int, required=True)
    args = parser.parse_args()
    try:
        native_count, native_slots, _ = inspect(args.native)
        wasm_count, wasm_slots, _ = inspect(args.wasm)
        if native_slots != args.expected_slots or wasm_slots != args.expected_slots:
            fail("requested boundary count does not match command expectation")
        if native_count != wasm_count:
            fail("framed transcript counts disagree")
        with args.native.open("rb") as left, args.wasm.open("rb") as right:
            left.seek(HEADER); right.seek(HEADER)
            for ordinal in range(native_count):
                a = left.read(RECORD); b = right.read(RECORD)
                if a != b:
                    which = ("CDRSTATE1" if a[:32] != b[:32] else
                             "CDRSTATE2" if a[32:64] != b[32:64] else "CDRSTATE3")
                    print(f"first mismatch at S{ordinal}: {which}", file=sys.stderr)
                    return 1
    except (OSError, ValueError) as error:
        print(f"M3 transcript comparison failed: {error}", file=sys.stderr)
        return 2
    print(f"matched S0..S{args.expected_slots}: {native_count} 96-byte boundary records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
