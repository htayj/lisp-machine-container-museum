#!/usr/bin/env python3
"""Validate the portable ABI 1.2 CDRSNAP1 header and required D0 chunk."""
import struct
import sys
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {Path(sys.argv[0]).name} SNAPSHOT")
    path = Path(sys.argv[1])
    data = path.read_bytes()
    require(len(data) >= 264, f"{path}: too short for CDRSNAP1 header")
    require(data[:8] == b"CDRSNAP1", f"{path}: bad CDRSNAP1 magic")
    require(struct.unpack_from("<H", data, 8)[0] == 1, f"{path}: bad format major")
    require(struct.unpack_from("<H", data, 10)[0] == 1,
            f"{path}: expected ABI1.2 snapshot format minor 1")
    header_bytes = struct.unpack_from("<I", data, 12)[0]
    chunk_count = struct.unpack_from("<I", data, 20)[0]
    entry_bytes = struct.unpack_from("<I", data, 24)[0]
    require(header_bytes == 264 and chunk_count == 9 and entry_bytes == 64,
            f"{path}: expected a 264-byte, nine-chunk ABI1.2 directory")
    require(len(data) >= header_bytes + chunk_count * entry_bytes,
            f"{path}: truncated directory")
    kinds = [struct.unpack_from("<I", data, header_bytes + index * entry_bytes)[0]
             for index in range(chunk_count)]
    require(kinds == list(range(1, 10)), f"{path}: required chunks 1..9 are absent")
    print(f"{path.name}: CDRSNAP1 format minor 1, chunks 1..9 (D0 present)")


if __name__ == "__main__":
    main()
