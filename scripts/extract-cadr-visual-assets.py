#!/usr/bin/env python3
"""Recover reviewed non-font pictures from the public MIT CADR System 46 tree.

The two current inputs are the serialized ``10LEAF`` grayscale array and the
XGP ``SCANIN CWH3`` scan-demo page.  The former is decoded with the inert
QFASL object parser; the latter follows the contemporary XGP SCN record and
interface-byte formats.  No Lisp code is executed.

Decoded pictures are research outputs, not automatically distributable
assets.  Their authorship and publication rights have not been established,
so write them under the ignored ``build/`` tree unless that question is
resolved separately.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import zlib


SOURCE_REPOSITORY = "https://github.com/mietek/mit-cadr-system-software"
SOURCE_REVISION = "8e978d7d1704096a63edd4386a3b8326a2e584af"
SOURCE_LICENSE_SHA256 = "05b8de7c86c946cc747ab71a9aaa7dd56e37365278b5585ab685156eaa90fb92"
RIGHTS_NOTE = (
    "The encoded files occur in the public System 46 snapshot, but the "
    "authorship and publication rights of the decoded photographic and "
    "scanned-page content are not established. Keep outputs local unless "
    "that question is resolved separately."
)


@dataclass(frozen=True)
class SourceSpec:
    relative_path: str
    byte_size: int
    sha256: str


TEN_LEAF = SourceSpec(
    "lmio1/10leaf.qfasl",
    81_524,
    "d1f1b12907c79d58685cdbf2f6be9c55352b12a521d07ee0a68848372496f28a",
)
SCANIN = SourceSpec(
    "lmdemo/scanin.cwh3",
    72_987,
    "7ea79051ea81d7a3382164a6cf5fdee7f8ee7d4d0393372f70440dbfd421e824",
)


class VisualAssetError(ValueError):
    """A source is not one of the reviewed visual-asset artifacts."""


def _load_qfasl_module():
    module_path = Path(__file__).with_name("extract-cadr-qfasl-fonts.py")
    module_name = "_cadr_qfasl_for_visual_assets"
    existing = sys.modules.get(module_name)
    if existing is not None:
        return existing
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load inert QFASL parser from {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _verified_source(source_root: Path, spec: SourceSpec) -> bytes:
    path = source_root / spec.relative_path
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise VisualAssetError(f"cannot read reviewed source {path}: {error}") from error
    digest = hashlib.sha256(raw).hexdigest()
    if len(raw) != spec.byte_size or digest != spec.sha256:
        raise VisualAssetError(
            f"{path} is not the reviewed System 46 artifact: got {len(raw)} bytes "
            f"and sha256 {digest}"
        )
    return raw


def _verify_license(source_root: Path) -> None:
    path = source_root / "LICENSE"
    try:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as error:
        raise VisualAssetError(f"cannot read source license {path}: {error}") from error
    if digest != SOURCE_LICENSE_SHA256:
        raise VisualAssetError(f"unexpected source license sha256 {digest} at {path}")


def decode_ten_leaf(raw: bytes) -> tuple[int, int, bytes, dict[str, object]]:
    """Decode the exact inert array written by System 46 ``CVPTS``."""

    qfasl = _load_qfasl_module()
    nibbles = qfasl.qfasl_nibbles(qfasl.evacuated_words(raw))
    parser = qfasl.FontQfaslParser(
        nibbles, allow_inert_picture_form=True
    )
    bindings = parser.parse()
    symbol = qfasl.Symbol("10LEAF")
    picture = bindings.get(symbol)
    if not isinstance(picture, qfasl.SerializedArray):
        raise VisualAssetError("10LEAF QFASL does not bind one serialized array")
    if picture.element_type != "ART-8B" or picture.dimensions != (255, 255):
        raise VisualAssetError(
            "10LEAF is not the reviewed 255 by 255 ART-8B picture"
        )
    if picture.declared_leader_length != 30:
        raise VisualAssetError("10LEAF has an unexpected array-leader length")
    if picture.leader.get(1) != qfasl.Symbol("PICTURE-HANDLER"):
        raise VisualAssetError("10LEAF lacks its PICTURE-HANDLER leader")
    if picture.leader.get(2) != symbol:
        raise VisualAssetError("10LEAF leader name does not match its binding")
    if picture.initialization_opcode != "INITIALIZE-NUMERIC-ARRAY":
        raise VisualAssetError("10LEAF does not use numeric-array initialization")
    values = picture.values()
    if len(values) != 255 * 255 or min(values) != 0 or max(values) != 255:
        raise VisualAssetError("10LEAF pixel range or length is unexpected")
    distinct_values = len(set(values))
    if distinct_values != 91:
        raise VisualAssetError("10LEAF has an unexpected grayscale value count")
    pixels = bytes(values)
    metadata = {
        "array_type": picture.element_type,
        "dimensions": list(picture.dimensions),
        "leader_length": picture.declared_leader_length,
        "leader_handler": "PICTURE-HANDLER",
        "pixel_minimum": min(values),
        "pixel_maximum": max(values),
        "distinct_pixel_value_count": distinct_values,
        "pixel_sha256": hashlib.sha256(pixels).hexdigest(),
        "qfasl_opcode_counts_octal": {
            f"{opcode:o}": count
            for opcode, count in sorted(parser.opcode_counts.items())
        },
    }
    return 255, 255, pixels, metadata


def _xgp_interface_bytes(words: list[int]) -> bytes:
    result = bytearray()
    for word in words:
        if word & 0xF:
            raise VisualAssetError("XGP PDP-10 word has nonzero low padding bits")
        byte_1 = (word >> 28) & 0xFF
        byte_2 = (word >> 20) & 0xFF
        byte_3 = (word >> 12) & 0xFF
        byte_4 = (word >> 4) & 0xFF
        # XGP.24 documents the interface order as byte 2, 1, 4, 3.
        result.extend((byte_2, byte_1, byte_4, byte_3))
    return bytes(result)


def _decode_xgp_rle(stream: bytes) -> list[int]:
    if not stream.startswith(b"\x00\x00"):
        raise VisualAssetError("XGP row does not enter run-length mode")
    encoded = stream[2:]
    escape = next(
        (
            index
            for index in range(len(encoded) - 1)
            if encoded[index] == 0 and encoded[index + 1] == 0
        ),
        None,
    )
    if escape is None:
        raise VisualAssetError("XGP run-length row has no command-mode escape")
    tail = encoded[escape + 2 :]
    if tail not in {b"\x00\x01", b"\x00\x01\x00\x00"}:
        raise VisualAssetError(f"unexpected XGP run-length trailer {tail!r}")
    color = 0
    row: list[int] = []
    for count in encoded[:escape]:
        row.extend([color] * count)
        color ^= 1
    return row


def _decode_xgp_image(stream: bytes) -> list[int]:
    if not stream.startswith(b"\x00\x02"):
        raise VisualAssetError("XGP row does not enter image mode")
    encoded = stream[2:]
    if len(encoded) != 210:
        raise VisualAssetError(
            f"reviewed XGP image row has {len(encoded)} bytes, expected 210"
        )
    # System 46 XGP.21 fills bit positions 0, 1, 2, ... from left to right.
    return [(byte >> bit) & 1 for byte in encoded for bit in range(8)]


def decode_scanin(raw: bytes) -> tuple[int, int, bytes, dict[str, object]]:
    """Decode SCANIN's XGP records and return its normalized content crop."""

    qfasl = _load_qfasl_module()
    words = qfasl.evacuated_words(raw)
    position = 0
    records: list[tuple[int, bytes]] = []
    while position < len(words):
        header = words[position]
        if header & 0xF:
            raise VisualAssetError("XGP record header has nonzero low padding bits")
        length_16bit_words = (header >> 20) & 0xFFFF
        line = (header >> 4) & 0xFFFF
        if length_16bit_words < 2 or length_16bit_words % 2:
            raise VisualAssetError("reviewed XGP record length is not a positive even value")
        record_words = length_16bit_words // 2
        end = position + record_words
        if end > len(words):
            raise VisualAssetError("XGP record extends beyond end of artifact")
        payload = _xgp_interface_bytes(words[position + 1 : end])
        expected_payload_bytes = (length_16bit_words - 2) * 2
        if len(payload) != expected_payload_bytes:
            raise VisualAssetError("XGP record payload length is inconsistent")
        records.append((line, payload))
        position = end

    if len(records) != 789:
        raise VisualAssetError(f"SCANIN has {len(records)} records, expected 789")
    cut_line_word, cut_payload = records[-1]
    if cut_line_word & 0x8000 == 0 or cut_payload:
        raise VisualAssetError("SCANIN does not end in the reviewed cut record")
    cut_line = cut_line_word & 0x7FFF
    if cut_line != 2171:
        raise VisualAssetError("SCANIN cut coordinate is unexpected")

    rows: list[tuple[int, list[int]]] = []
    modes: Counter[str] = Counter()
    for line, stream in records[:-1]:
        if line & 0x8000:
            raise VisualAssetError("SCANIN contains an early cut record")
        if stream.startswith(b"\x00\x00"):
            row = _decode_xgp_rle(stream)
            modes["run-length"] += 1
        elif stream.startswith(b"\x00\x02"):
            row = _decode_xgp_image(stream)
            modes["image"] += 1
        else:
            raise VisualAssetError(f"unsupported XGP interface mode on line {line}")
        if len(row) > 1680:
            raise VisualAssetError("decoded XGP row exceeds 1,680 pixels")
        rows.append((line, row))

    line_numbers = [line for line, _row in rows]
    if line_numbers != sorted(line_numbers):
        raise VisualAssetError("SCANIN line records are not ordered")
    if (min(line_numbers), max(line_numbers)) != (278, 1972):
        raise VisualAssetError("SCANIN line-coordinate envelope is unexpected")
    if modes != Counter({"run-length": 714, "image": 74}):
        raise VisualAssetError(f"SCANIN mode counts are unexpected: {modes}")

    black_points = [
        (x, line)
        for line, row in rows
        for x, value in enumerate(row)
        if value
    ]
    if not black_points:
        raise VisualAssetError("SCANIN contains no black pixels")
    if len(black_points) != 125_498:
        raise VisualAssetError("SCANIN black-pixel count is unexpected")
    min_x = min(x for x, _line in black_points)
    max_x = max(x for x, _line in black_points)
    min_y = min(line for _x, line in black_points)
    max_y = max(line for _x, line in black_points)
    if (min_x, max_x, min_y, max_y) != (200, 1469, 278, 1972):
        raise VisualAssetError("SCANIN black-pixel bounding box is unexpected")

    width = max_x - min_x + 1
    height = max_y - min_y + 1
    pixels = bytearray(b"\xFF" * (width * height))
    for line, row in rows:
        if not min_y <= line <= max_y:
            continue
        destination = (line - min_y) * width
        for x in range(min_x, min(max_x + 1, len(row))):
            if row[x]:
                pixels[destination + x - min_x] = 0

    normalized = bytes(pixels)
    metadata = {
        "record_count": len(records),
        "picture_record_count": len(rows),
        "mode_counts": dict(sorted(modes.items())),
        "interface_width": 1680,
        "line_range_inclusive": [min(line_numbers), max(line_numbers)],
        "cut_line": cut_line,
        "black_pixel_count": len(black_points),
        "black_bounding_box_half_open": [min_x, min_y, max_x + 1, max_y + 1],
        "normalized_dimensions": [width, height],
        "normalized_pixel_sha256": hashlib.sha256(normalized).hexdigest(),
    }
    return width, height, normalized, metadata


def grayscale_png(width: int, height: int, pixels: bytes) -> bytes:
    if width <= 0 or height <= 0 or len(pixels) != width * height:
        raise VisualAssetError("invalid grayscale raster dimensions")
    scanlines = b"".join(
        b"\x00" + pixels[row * width : (row + 1) * width]
        for row in range(height)
    )

    def chunk(kind: bytes, payload: bytes) -> bytes:
        body = kind + payload
        return (
            struct.pack(">I", len(payload))
            + body
            + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
        )

    return b"".join(
        (
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(scanlines, level=9)),
            chunk(b"IEND", b""),
        )
    )


def build_outputs(source_root: Path) -> dict[str, bytes]:
    _verify_license(source_root)
    ten_leaf_raw = _verified_source(source_root, TEN_LEAF)
    scanin_raw = _verified_source(source_root, SCANIN)

    leaf_width, leaf_height, leaf_pixels, leaf_metadata = decode_ten_leaf(
        ten_leaf_raw
    )
    scan_width, scan_height, scan_pixels, scan_metadata = decode_scanin(scanin_raw)
    leaf_png = grayscale_png(leaf_width, leaf_height, leaf_pixels)
    scan_png = grayscale_png(scan_width, scan_height, scan_pixels)

    assets = [
        {
            "name": "10LEAF",
            "kind": "serialized 8-bit grayscale raster",
            "source_file": TEN_LEAF.relative_path,
            "source_byte_size": TEN_LEAF.byte_size,
            "source_sha256": TEN_LEAF.sha256,
            "output_file": "10leaf.png",
            "output_byte_size": len(leaf_png),
            "output_sha256": hashlib.sha256(leaf_png).hexdigest(),
            **leaf_metadata,
        },
        {
            "name": "SCANIN CWH3",
            "kind": "XGP SCN one-bit page, normalized to its black-pixel crop",
            "source_file": SCANIN.relative_path,
            "source_byte_size": SCANIN.byte_size,
            "source_sha256": SCANIN.sha256,
            "output_file": "scanin-cwh3.png",
            "output_byte_size": len(scan_png),
            "output_sha256": hashlib.sha256(scan_png).hexdigest(),
            **scan_metadata,
        },
    ]
    catalog = {
        "schema_version": 1,
        "source": {
            "repository": SOURCE_REPOSITORY,
            "revision": SOURCE_REVISION,
            "license_file": "LICENSE",
            "license_sha256": SOURCE_LICENSE_SHA256,
        },
        "distribution_status": "local research output; not cleared for redistribution",
        "rights_note": RIGHTS_NOTE,
        "assets": assets,
    }
    return {
        "10leaf.png": leaf_png,
        "scanin-cwh3.png": scan_png,
        "catalog.json": (
            json.dumps(catalog, indent=2, sort_keys=True) + "\n"
        ).encode("utf-8"),
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="public System 46 src directory")
    parser.add_argument("--output", type=Path, required=True, help="local output directory")
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify that the output directory already contains the expected files",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    try:
        outputs = build_outputs(arguments.source)
    except (VisualAssetError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if arguments.check:
        failures = []
        for relative_path, expected in outputs.items():
            path = arguments.output / relative_path
            try:
                actual = path.read_bytes()
            except OSError:
                failures.append(f"missing {path}")
                continue
            if actual != expected:
                failures.append(f"stale {path}")
        if failures:
            print("\n".join(failures), file=sys.stderr)
            return 1
        return 0

    arguments.output.mkdir(parents=True, exist_ok=True)
    for relative_path, contents in outputs.items():
        path = arguments.output / relative_path
        path.write_bytes(contents)
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
