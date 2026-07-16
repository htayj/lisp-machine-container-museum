#!/usr/bin/env python3
"""Shared, dependency-free output helpers for Lisp Machine bitmap fonts.

The format-specific extractors normalize their input to ``BitmapFont`` and
``Glyph`` objects.  This module writes transparent archival data (JSON and
BDF) plus deterministic PNG specimen sheets without requiring Pillow.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
from pathlib import Path
import shutil
import struct
from typing import Iterable
import zlib


@dataclass(frozen=True)
class Glyph:
    """One bitmap glyph, with rows stored most-significant pixel first."""

    code: int
    bitmap_width: int
    advance: int
    x_offset: int
    y_offset: int
    rows: tuple[int, ...]


@dataclass(frozen=True)
class BitmapFont:
    """A bitmap font in the common representation used by the exporters."""

    name: str
    character_height: int
    raster_height: int
    baseline: int
    glyphs: tuple[Glyph, ...]
    source_format: str
    source_name: str
    metadata: dict[str, object] = field(default_factory=dict)


def safe_filename(name: str) -> str:
    """Return a stable lowercase filename component."""

    result = []
    previous_hyphen = False
    for character in name.lower():
        if character.isascii() and character.isalnum():
            result.append(character)
            previous_hyphen = False
        elif not previous_hyphen:
            result.append("-")
            previous_hyphen = True
    return "".join(result).strip("-") or "unnamed-font"


def prepare_output_directory(
    path: Path, *, clean: bool, owned_names: Iterable[str]
) -> None:
    """Create an empty output directory without deleting unrecognized data.

    Existing extractor-owned top-level paths require explicit ``clean=True``.
    Unknown entries are always rejected, including in clean mode, so a typo in
    an output path cannot turn this helper into a general directory remover.
    """

    owned = set(owned_names)
    if path.exists() and not path.is_dir():
        raise ValueError(f"output path is not a directory: {path}")
    existing = list(path.iterdir()) if path.exists() else []
    unknown = sorted(child.name for child in existing if child.name not in owned)
    if unknown:
        raise ValueError(
            "output directory contains unrecognized entries: "
            + ", ".join(unknown)
        )
    if existing and not clean:
        raise ValueError(
            "output directory already contains generated files; pass --clean "
            "to replace them"
        )
    if clean:
        for child in existing:
            if child.is_symlink() or child.is_file():
                child.unlink()
            else:
                shutil.rmtree(child)
    path.mkdir(parents=True, exist_ok=True)


def _row_hex(row: int, width: int) -> str:
    digits = max(1, (width + 3) // 4)
    return f"{row:0{digits}X}"


def write_json(font: BitmapFont, path: Path) -> None:
    """Write a lossless, human-inspectable normalized font record."""

    path.parent.mkdir(parents=True, exist_ok=True)
    record = asdict(font)
    record["glyphs"] = [
        {
            "code": glyph.code,
            "code_octal": f"{glyph.code:o}",
            "bitmap_width": glyph.bitmap_width,
            "advance": glyph.advance,
            "x_offset": glyph.x_offset,
            "y_offset": glyph.y_offset,
            "rows": [_row_hex(row, glyph.bitmap_width) for row in glyph.rows],
        }
        for glyph in font.glyphs
    ]
    path.write_text(
        json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def write_bdf(font: BitmapFont, path: Path, foundry: str) -> None:
    """Write a conservative BDF 2.1 representation.

    Lisp Machine character codes are not claimed to be Unicode.  BDF's
    alternate-encoding form (``ENCODING -1 n``) retains the original numeric
    code without assigning a modern character-set identity.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    glyphs = sorted(font.glyphs, key=lambda item: item.code)
    if not glyphs:
        raise ValueError(f"font {font.name!r} contains no glyphs")
    if font.character_height < 1:
        raise ValueError(f"font {font.name!r} has a non-positive character height")

    minimum_x = min(glyph.x_offset for glyph in glyphs)
    maximum_x = max(glyph.x_offset + glyph.bitmap_width for glyph in glyphs)
    minimum_y = min(glyph.y_offset for glyph in glyphs)
    maximum_y = max(glyph.y_offset + len(glyph.rows) for glyph in glyphs)
    bounding_width = maximum_x - minimum_x
    bounding_height = maximum_y - minimum_y
    descent = max(0, font.character_height - font.baseline)
    bdf_name = f"{foundry}-{font.name}".upper().replace(" ", "-")

    lines = [
        "STARTFONT 2.1",
        f"COMMENT Recovered from {font.source_name} ({font.source_format})",
        f"FONT {bdf_name}",
        f"SIZE {font.character_height} 72 72",
        (
            f"FONTBOUNDINGBOX {bounding_width} {bounding_height} "
            f"{minimum_x} {minimum_y}"
        ),
        "STARTPROPERTIES 2",
        f"FONT_ASCENT {font.baseline}",
        f"FONT_DESCENT {descent}",
        "ENDPROPERTIES",
        f"CHARS {len(glyphs)}",
    ]

    for glyph in glyphs:
        byte_width = max(1, (glyph.bitmap_width + 7) // 8)
        padding = byte_width * 8 - glyph.bitmap_width
        scalable_width = round(glyph.advance * 1000 / font.character_height)
        lines.extend(
            [
                f"STARTCHAR C{glyph.code:04X}",
                f"ENCODING -1 {glyph.code}",
                f"SWIDTH {scalable_width} 0",
                f"DWIDTH {glyph.advance} 0",
                (
                    f"BBX {glyph.bitmap_width} {len(glyph.rows)} "
                    f"{glyph.x_offset} {glyph.y_offset}"
                ),
                "BITMAP",
            ]
        )
        row_mask = (1 << glyph.bitmap_width) - 1 if glyph.bitmap_width else 0
        for row in glyph.rows:
            lines.append(f"{((row & row_mask) << padding):0{byte_width * 2}X}")
        lines.append("ENDCHAR")
    lines.append("ENDFONT")
    path.write_text("\n".join(lines) + "\n", encoding="ascii")


# A tiny code-label alphabet.  It is deliberately program data, not a bundled
# third-party font, so specimen rendering remains dependency-free.
_LABEL_GLYPHS = {
    "0": (0b111, 0b101, 0b101, 0b101, 0b111),
    "1": (0b010, 0b110, 0b010, 0b010, 0b111),
    "2": (0b110, 0b001, 0b111, 0b100, 0b111),
    "3": (0b110, 0b001, 0b111, 0b001, 0b110),
    "4": (0b101, 0b101, 0b111, 0b001, 0b001),
    "5": (0b111, 0b100, 0b110, 0b001, 0b110),
    "6": (0b011, 0b100, 0b111, 0b101, 0b111),
    "7": (0b111, 0b001, 0b010, 0b010, 0b010),
    "8": (0b111, 0b101, 0b111, 0b101, 0b111),
    "9": (0b111, 0b101, 0b111, 0b001, 0b110),
    "A": (0b010, 0b101, 0b111, 0b101, 0b101),
    "B": (0b110, 0b101, 0b110, 0b101, 0b110),
    "C": (0b011, 0b100, 0b100, 0b100, 0b011),
    "D": (0b110, 0b101, 0b101, 0b101, 0b110),
    "E": (0b111, 0b100, 0b110, 0b100, 0b111),
    "F": (0b111, 0b100, 0b110, 0b100, 0b100),
}


class _Canvas:
    def __init__(self, width: int, height: int, background: tuple[int, int, int]):
        self.width = width
        self.height = height
        self.pixels = bytearray(background * (width * height))

    def pixel(self, x: int, y: int, color: tuple[int, int, int]) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            offset = (y * self.width + x) * 3
            self.pixels[offset : offset + 3] = bytes(color)

    def rectangle(
        self, x: int, y: int, width: int, height: int, color: tuple[int, int, int]
    ) -> None:
        for row in range(max(0, y), min(self.height, y + height)):
            start = (row * self.width + max(0, x)) * 3
            end = (row * self.width + min(self.width, x + width)) * 3
            self.pixels[start:end] = bytes(color) * ((end - start) // 3)

    def png_bytes(self) -> bytes:
        scanlines = bytearray()
        row_size = self.width * 3
        for row in range(self.height):
            scanlines.append(0)
            start = row * row_size
            scanlines.extend(self.pixels[start : start + row_size])

        def chunk(kind: bytes, payload: bytes) -> bytes:
            body = kind + payload
            return struct.pack(">I", len(payload)) + body + struct.pack(
                ">I", zlib.crc32(body) & 0xFFFFFFFF
            )

        return b"".join(
            [
                b"\x89PNG\r\n\x1a\n",
                chunk(
                    b"IHDR",
                    struct.pack(">IIBBBBB", self.width, self.height, 8, 2, 0, 0, 0),
                ),
                chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9)),
                chunk(b"IEND", b""),
            ]
        )


def _draw_scaled_pixel(
    canvas: _Canvas,
    x: int,
    y: int,
    scale: int,
    color: tuple[int, int, int],
) -> None:
    canvas.rectangle(x, y, scale, scale, color)


def _draw_label(canvas: _Canvas, text: str, x: int, y: int) -> None:
    color = (80, 84, 92)
    for character in text:
        rows = _LABEL_GLYPHS[character]
        for row_number, row in enumerate(rows):
            for column in range(3):
                if row & (1 << (2 - column)):
                    canvas.pixel(x + column, y + row_number, color)
        x += 4


def write_sheet(
    font: BitmapFont,
    path: Path,
    *,
    columns: int = 16,
    scale: int = 2,
    label_radix: int = 16,
) -> None:
    """Write a deterministic grid of every represented glyph as RGB PNG."""

    if columns < 1 or scale < 1:
        raise ValueError("columns and scale must be positive")
    if label_radix not in {8, 16}:
        raise ValueError("label radix must be 8 or 16")
    glyphs = sorted(font.glyphs, key=lambda item: item.code)
    if not glyphs:
        raise ValueError(f"font {font.name!r} contains no glyphs")

    minimum_x = min(0, *(glyph.x_offset for glyph in glyphs))
    maximum_x = max(
        max(glyph.advance, glyph.x_offset + glyph.bitmap_width) for glyph in glyphs
    )
    raster_width = maximum_x - minimum_x
    glyph_tops = [
        font.baseline - glyph.y_offset - len(glyph.rows) for glyph in glyphs
    ]
    minimum_top = min(0, *glyph_tops)
    maximum_bottom = max(
        font.raster_height,
        *(
            glyph_top + len(glyph.rows)
            for glyph_top, glyph in zip(glyph_tops, glyphs)
        ),
    )
    raster_height = maximum_bottom - minimum_top
    if label_radix == 8:
        label_digits = max(3, max(len(f"{glyph.code:o}") for glyph in glyphs))
    else:
        label_digits = max(2, max(len(f"{glyph.code:X}") for glyph in glyphs))
    label_width = label_digits * 4 - 1
    padding = 3
    cell_width = max(raster_width * scale, label_width) + padding * 2
    cell_height = raster_height * scale + 5 + padding * 3
    row_count = (len(glyphs) + columns - 1) // columns
    canvas = _Canvas(
        cell_width * columns + 1,
        cell_height * row_count + 1,
        (250, 250, 248),
    )

    for index, glyph in enumerate(glyphs):
        cell_x = (index % columns) * cell_width
        cell_y = (index // columns) * cell_height
        canvas.rectangle(cell_x, cell_y, cell_width, 1, (214, 216, 218))
        canvas.rectangle(cell_x, cell_y, 1, cell_height, (214, 216, 218))

        origin_x = cell_x + padding + (-minimum_x) * scale
        raster_top = cell_y + padding
        baseline_y = raster_top + (font.baseline - minimum_top) * scale
        canvas.rectangle(
            cell_x + 1, baseline_y, cell_width - 1, 1, (226, 214, 214)
        )
        glyph_x = origin_x + glyph.x_offset * scale
        glyph_top = glyph_tops[index]
        glyph_y = raster_top + (glyph_top - minimum_top) * scale
        for row_number, row in enumerate(glyph.rows):
            for column in range(glyph.bitmap_width):
                if row & (1 << (glyph.bitmap_width - column - 1)):
                    _draw_scaled_pixel(
                        canvas,
                        glyph_x + column * scale,
                        glyph_y + row_number * scale,
                        scale,
                        (18, 20, 22),
                    )
        label = (
            f"{glyph.code:0{label_digits}o}"
            if label_radix == 8
            else f"{glyph.code:0{label_digits}X}"
        )
        label_x = cell_x + (cell_width - label_width) // 2
        _draw_label(canvas, label, label_x, cell_y + cell_height - padding - 5)

    canvas.rectangle(0, canvas.height - 1, canvas.width, 1, (214, 216, 218))
    canvas.rectangle(canvas.width - 1, 0, 1, canvas.height, (214, 216, 218))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canvas.png_bytes())


def write_font_outputs(
    font: BitmapFont,
    output_directory: Path,
    *,
    foundry: str,
    sheet_columns: int = 16,
    sheet_scale: int = 2,
    include_json: bool = True,
    sheet_label_radix: int = 16,
) -> dict[str, str]:
    """Write all standard outputs and return their relative paths."""

    stem = safe_filename(font.name)
    destinations = {
        "bdf": output_directory / "bdf" / f"{stem}.bdf",
        "sheet": output_directory / "sheets" / f"{stem}.png",
    }
    if include_json:
        destinations["json"] = output_directory / "json" / f"{stem}.json"
        write_json(font, destinations["json"])
    write_bdf(font, destinations["bdf"], foundry)
    write_sheet(
        font,
        destinations["sheet"],
        columns=sheet_columns,
        scale=sheet_scale,
        label_radix=sheet_label_radix,
    )
    return {
        kind: str(path.relative_to(output_directory))
        for kind, path in destinations.items()
    }


def write_catalog(records: Iterable[dict[str, object]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(list(records), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
