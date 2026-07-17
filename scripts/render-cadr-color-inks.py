#!/usr/bin/env python3
"""Render idealized swatches for the MIT CADR color-map routines.

The historical display stored a four-bit index at each pixel.  These swatches
show the logical 8-bit RGB values assigned by R-G-B-COLOR-MAP,
SPECTRUM-COLOR-MAP, and GRAY-COLOR-MAP with a base of zero.  They do not try to
simulate the transfer function, phosphors, or calibration of a physical CADR
color monitor.

This script uses only the Python standard library and writes deterministic RGB
PNG output for a fixed Python/zlib toolchain.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import struct
import sys
import zlib


RGB = tuple[int, int, int]
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = (
    REPOSITORY_ROOT / "docs" / "assets" / "mit-cadr-color-inks" / "palettes.png"
)


def rgb_color_map() -> tuple[RGB, ...]:
    """Return the exact index order produced by R-G-B-COLOR-MAP."""

    red = (255, 0, 0)
    green = (0, 255, 0)
    blue = (0, 0, 255)
    primaries = (red, green, blue)
    return ((0, 0, 0), *(primaries[index % 3] for index in range(1, 16)))


def spectrum_color_map() -> tuple[RGB | None, ...]:
    """Return SPECTRUM-COLOR-MAP; None records its untouched index zero."""

    colors: list[RGB | None] = [None]
    offset = 0
    for index in range(1, 16):
        value = index + offset
        colors.append(
            (
                255 if value & 0b001 else 0,
                255 if value & 0b010 else 0,
                255 if value & 0b100 else 0,
            )
        )
        if index == 7:
            offset = 1
        elif index == 14:
            offset = 2
    return tuple(colors)


def gray_color_map(base: int = 0) -> tuple[RGB, ...]:
    """Return GRAY-COLOR-MAP for BASE, including its eight-bit wraparound."""

    return tuple(
        ((level := (base + 16 * index) % 256), level, level)
        for index in range(16)
    )


class Canvas:
    """Small dependency-free RGB canvas with a deterministic PNG encoder."""

    def __init__(self, width: int, height: int, background: RGB) -> None:
        self.width = width
        self.height = height
        self.pixels = bytearray(background * (width * height))

    def pixel(self, x: int, y: int, color: RGB) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            offset = (y * self.width + x) * 3
            self.pixels[offset : offset + 3] = bytes(color)

    def rectangle(self, x: int, y: int, width: int, height: int, color: RGB) -> None:
        left = max(0, x)
        right = min(self.width, x + width)
        if left >= right:
            return
        for row in range(max(0, y), min(self.height, y + height)):
            start = (row * self.width + left) * 3
            end = (row * self.width + right) * 3
            self.pixels[start:end] = bytes(color) * (right - left)

    def png_bytes(self) -> bytes:
        scanlines = bytearray()
        row_size = self.width * 3
        for row in range(self.height):
            scanlines.append(0)
            start = row * row_size
            scanlines.extend(self.pixels[start : start + row_size])

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
                chunk(
                    b"IHDR",
                    struct.pack(">IIBBBBB", self.width, self.height, 8, 2, 0, 0, 0),
                ),
                chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9)),
                chunk(b"IEND", b""),
            )
        )


LABEL_GLYPHS = {
    "0": (0b111, 0b101, 0b101, 0b101, 0b111),
    "1": (0b010, 0b110, 0b010, 0b010, 0b111),
    "2": (0b110, 0b001, 0b111, 0b100, 0b111),
    "3": (0b110, 0b001, 0b111, 0b001, 0b110),
    "4": (0b101, 0b101, 0b111, 0b001, 0b001),
    "5": (0b111, 0b100, 0b110, 0b001, 0b110),
    "6": (0b011, 0b100, 0b111, 0b101, 0b111),
    "7": (0b111, 0b001, 0b010, 0b010, 0b010),
}


def draw_octal_label(canvas: Canvas, value: int, x: int, y: int) -> None:
    for character in f"{value:02o}":
        for row_number, bits in enumerate(LABEL_GLYPHS[character]):
            for column in range(3):
                if bits & (1 << (2 - column)):
                    canvas.pixel(x + column, y + row_number, (70, 73, 78))
        x += 4


def render() -> bytes:
    """Render three source-defined mappings, with indexes labeled in octal."""

    cell_width = 30
    swatch_height = 28
    header_height = 15
    gap = 4
    margin = 6
    width = margin * 2 + cell_width * 16
    height = margin * 2 + header_height + swatch_height * 3 + gap * 2
    canvas = Canvas(width, height, (248, 248, 246))

    for index in range(16):
        x = margin + index * cell_width
        draw_octal_label(canvas, index, x + (cell_width - 7) // 2, margin + 2)

    palettes = (rgb_color_map(), spectrum_color_map(), gray_color_map())
    for row, palette in enumerate(palettes):
        y = margin + header_height + row * (swatch_height + gap)
        for index, color in enumerate(palette):
            x = margin + index * cell_width
            canvas.rectangle(x, y, cell_width, swatch_height, (65, 68, 72))
            if color is None:
                for pixel_y in range(y + 1, y + swatch_height - 1):
                    for pixel_x in range(x + 1, x + cell_width - 1):
                        checker = ((pixel_x - x) // 4 + (pixel_y - y) // 4) % 2
                        canvas.pixel(
                            pixel_x,
                            pixel_y,
                            (214, 214, 210) if checker else (242, 242, 238),
                        )
            else:
                canvas.rectangle(
                    x + 1, y + 1, cell_width - 2, swatch_height - 2, color
                )

    return canvas.png_bytes()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"PNG destination (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify that the destination already contains the expected bytes",
    )
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    expected = render()
    output = arguments.output
    if arguments.check:
        if not output.exists():
            print(f"missing generated specimen: {output}", file=sys.stderr)
            return 1
        if output.read_bytes() != expected:
            print(f"generated specimen is stale: {output}", file=sys.stderr)
            return 1
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(expected)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
