#!/usr/bin/env python3
"""Compare canonical M4-D0 host/guest transcripts without buffering them.

The native and worker harnesses must each write the following ASCII stream:

    CDRM4TX1\n
    S <boundary> <state-1-sha256> <state-2-sha256> <state-3-sha256> <schedule>\n
`boundary` starts at zero and is contiguous.  `schedule` is an ASCII,
canonical event token (not a lossy summary): it records every BLOCK_READ
issue, delivery status and tick, and the post-boundary disk interrupt bit.
Thus a test that changes disk status, byte range, request timing, or interrupt
timing cannot pass by comparing guest state alone.

This comparator is intentionally streaming: the M4 gate invokes it with
--required-final-boundary 1000000 and it retains only one native and one wasm
line at a time.  Image bytes never appear in this transcript.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HEADER = "CDRM4TX1\n"
RECORD = re.compile(r"S ([0-9]+) ([0-9a-f]{64}) ([0-9a-f]{64}) ([0-9a-f]{64}) ([A-Za-z0-9,;:_-]+)\n\Z")


def fail(message: str) -> "None":
    raise ValueError(message)


def read_header(stream, label: str) -> None:
    if stream.readline() != HEADER:
        fail(f"{label}: missing or incompatible CDRM4TX1 header")


def read_record(stream, label: str, expected_boundary: int) -> str | None:
    line = stream.readline()
    if line == "":
        return None
    match = RECORD.fullmatch(line)
    if match is None:
        fail(f"{label}: malformed transcript record at boundary {expected_boundary}")
    if int(match.group(1)) != expected_boundary:
        fail(f"{label}: expected boundary {expected_boundary}, got {match.group(1)}")
    return line


def compare(native: Path, wasm: Path, required_final_boundary: int | None) -> int:
    with native.open("r", encoding="ascii", newline="") as native_stream, \
         wasm.open("r", encoding="ascii", newline="") as wasm_stream:
        read_header(native_stream, "native")
        read_header(wasm_stream, "wasm")
        boundary = 0
        while True:
            native_line = read_record(native_stream, "native", boundary)
            wasm_line = read_record(wasm_stream, "wasm", boundary)
            if native_line is None or wasm_line is None:
                if native_line != wasm_line:
                    fail(f"transcript length differs at boundary {boundary}")
                break
            if native_line != wasm_line:
                fail(f"transcript mismatch at boundary {boundary}")
            boundary += 1
        if boundary == 0:
            fail("transcript contains no boundary records")
        final_boundary = boundary - 1
        if required_final_boundary is not None and final_boundary != required_final_boundary:
            fail(f"required final boundary {required_final_boundary}, got {final_boundary}")
    return final_boundary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("native", type=Path)
    parser.add_argument("wasm", type=Path)
    parser.add_argument("--required-final-boundary", type=int)
    arguments = parser.parse_args()
    if arguments.required_final_boundary is not None and arguments.required_final_boundary < 0:
        parser.error("--required-final-boundary must be non-negative")
    try:
        final_boundary = compare(arguments.native, arguments.wasm,
                                 arguments.required_final_boundary)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"M4 transcript comparison failed: {error}", file=sys.stderr)
        return 1
    print(f"M4 transcript comparison passed through S{final_boundary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
