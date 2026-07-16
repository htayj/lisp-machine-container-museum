#!/usr/bin/env python3
"""Recover MIT CADR fonts from their public source representations.

Inputs are files under ``src/lmfont`` in mietek/mit-cadr-system-software.
They are stored in Alan Bawden's evacuated PDP-10 format, so even readable
text that appears as ASCII must first be reconstructed as 36-bit words.  This
program performs that decoding and handles source-level AST, KST, Alto AL, and
CLDFNT representations.  It never reads a CADR load band or emulator heap.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

from lisp_machine_fonts import (
    BitmapFont,
    Glyph,
    prepare_output_directory,
    write_font_outputs,
)


class SourceError(ValueError):
    """A public font source cannot be decoded without inventing data."""


MASK18 = (1 << 18) - 1
MASK36 = (1 << 36) - 1


def _text_byte(byte: int) -> tuple[int, ...]:
    """Decode one non-quoted byte from Bawden's evacuated representation."""

    if 0 <= byte <= 0o11:
        return (byte,)
    if byte == 0o12:
        return (0o15, 0o12)
    if 0o13 <= byte <= 0o14:
        return (byte,)
    if byte == 0o15:
        return (0o12,)
    if 0o16 <= byte <= 0o176:
        return (byte,)
    if byte == 0o177:
        return (0o177, 0o7)
    if 0o200 <= byte <= 0o206:
        return (0o177, byte - 0o200)
    if byte == 0o207:
        return (0o177, 0o177)
    if 0o210 <= byte <= 0o211:
        return (0o177, byte - 0o200)
    if byte == 0o212:
        return (0o177, 0o15)
    if 0o213 <= byte <= 0o214:
        return (0o177, byte - 0o200)
    if byte == 0o215:
        return (0o177, 0o12)
    if 0o216 <= byte <= 0o355:
        return (0o177, byte - 0o200)
    if byte == 0o356:
        return (0o15,)
    if byte == 0o357:
        return (0o177,)
    raise SourceError(f"invalid evacuated text byte {byte:#o}")


def evacuated_words(raw: bytes) -> list[int]:
    """Reconstruct PDP-10 36-bit words from an evacuated host file."""

    words: list[int] = []
    characters: list[int] = []
    position = 0

    def flush_characters() -> None:
        nonlocal characters
        if len(characters) == 5:
            words.append(
                sum(
                    character << shift
                    for character, shift in zip(characters, (29, 22, 15, 8, 1))
                )
            )
            characters = []

    while position < len(raw):
        byte = raw[position]
        position += 1
        if byte >= 0o360:
            if characters:
                raise SourceError("quoted binary word occurs inside a text word")
            if position + 4 > len(raw):
                raise SourceError("truncated quoted binary word")
            byte1, byte2, byte3, byte4 = raw[position : position + 4]
            position += 4
            left = ((byte & 0o17) << 14) | (byte1 << 6) | (byte2 >> 2)
            right = ((byte2 & 0o3) << 16) | (byte3 << 8) | byte4
            words.append((left << 18) | right)
            continue
        for character in _text_byte(byte):
            characters.append(character)
            flush_characters()

    if characters:
        characters.extend([0o3] * (5 - len(characters)))
        flush_characters()
    return words


def seven_bit_text(words: list[int]) -> bytes:
    return bytes(
        (word >> shift) & 0o177
        for word in words
        for shift in (29, 22, 15, 8, 1)
    )


def _leading_integer(line: bytes, *, radix: int, field: str) -> int:
    match = re.match(rb"\s*([+-]?[0-9]+)", line)
    if not match:
        raise SourceError(f"missing {field}: {line[:80]!r}")
    try:
        return int(match.group(1), radix)
    except ValueError as error:
        raise SourceError(f"invalid {field}: {line[:80]!r}") from error


def parse_ast(path: Path, words: list[int]) -> BitmapFont:
    """Parse a textual AST font source as the original FCMP reader did."""

    raw = seven_bit_text(words).rstrip(b"\x03")
    pages = raw.split(b"\f")
    header = pages[0].replace(b"\r\n", b"\n").splitlines()
    if len(header) < 4:
        raise SourceError("short AST header")
    # KSTID is deliberately ignored, matching RD-AST.
    character_height = _leading_integer(header[1], radix=10, field="height")
    baseline = _leading_integer(header[2], radix=10, field="baseline")
    column_adjust = _leading_integer(
        header[3], radix=10, field="column-position adjustment"
    )
    glyphs = []
    source_metrics = {}
    for page_number, page in enumerate(pages[1:], 1):
        page = page.replace(b"\r\n", b"\n").rstrip(b"\x03")
        if not page:
            continue
        lines = page.split(b"\n")
        if len(lines) < 4:
            raise SourceError(f"short AST character page {page_number}")
        code = _leading_integer(lines[0], radix=8, field="character code")
        raster_width = _leading_integer(lines[1], radix=10, field="raster width")
        advance = _leading_integer(lines[2], radix=10, field="character width")
        left_kern = _leading_integer(lines[3], radix=10, field="left kern")
        if raster_width < 0 or character_height < 0:
            raise SourceError(f"negative AST extent for character {code:o}")
        if not page.endswith(b"\n"):
            raise SourceError(
                f"truncated AST raster row for character {code:o}: "
                "missing line terminator"
            )
        raster_lines = lines[4:-1]
        if len(raster_lines) > character_height:
            raise SourceError(
                f"too many AST raster rows for character {code:o}: "
                f"maximum {character_height}, found {len(raster_lines)}"
            )
        rows = []
        for line in raster_lines:
            graphical = [byte for byte in line if byte >= 0o40]
            graphical = (graphical + [0o40] * raster_width)[:raster_width]
            row = 0
            for byte in graphical:
                row = (row << 1) | (byte != 0o40)
            rows.append(row)
        # RD-AST treats FF/ETX/EOF before the next row as the end of a glyph,
        # even when that occurs before the header height.  Those absent bottom
        # rows are intentionally blank, not evidence of truncation.
        supplied_row_count = len(rows)
        rows.extend([0] * (character_height - len(rows)))

        # FCMP calls a negative left kern "compact raster lossage": it widens
        # the runtime cell by -kern and places the authored raster that far in.
        x_offset = -left_kern
        glyphs.append(
            Glyph(
                code=code,
                bitmap_width=raster_width,
                advance=advance,
                x_offset=x_offset,
                y_offset=baseline - character_height,
                rows=tuple(rows),
            )
        )
        source_metrics[str(code)] = {
            "raster_width": raster_width,
            "character_width": advance,
            "left_kern": left_kern,
            "source_raster_row_count": supplied_row_count,
            "compiler_normalized_raster_width": (
                raster_width - left_kern if left_kern < 0 else raster_width
            ),
            "compiler_normalized_left_kern": max(0, left_kern),
        }

    if not glyphs:
        raise SourceError("AST contains no character pages")
    return BitmapFont(
        name=path.stem.upper(),
        character_height=character_height,
        raster_height=character_height,
        baseline=baseline,
        glyphs=tuple(sorted(glyphs, key=lambda glyph: glyph.code)),
        source_format="MIT CADR textual AST font source",
        source_name=path.name,
        metadata={
            "column_position_adjustment": column_adjust,
            "source_metrics": source_metrics,
        },
    )


def _signed(value: int, bits: int) -> int:
    return value - (1 << bits) if value & (1 << (bits - 1)) else value


def parse_kst(path: Path, words: list[int]) -> BitmapFont:
    if len(words) < 2:
        raise SourceError("short KST header")

    def halves(word: int) -> tuple[int, int]:
        return _signed((word >> 18) & 0o777777, 18), _signed(
            word & 0o777777, 18
        )

    kstid = [(words[0] >> shift) & 0o777 for shift in (27, 18, 9, 0)]
    column_adjust = (words[1] >> 27) & 0o777
    baseline = (words[1] >> 18) & 0o777
    declared_line_height = _signed(words[1] & 0o777777, 18)
    if declared_line_height < 0:
        raise SourceError("negative KST line height")

    glyphs = []
    single_end_marker_word = False
    position = 2
    while position < len(words):
        marker = _signed(words[position], 36)
        if marker == -1:
            if position + 1 >= len(words) or _signed(words[position + 1], 36) != -1:
                single_end_marker_word = True
            break
        if marker != 1:
            raise SourceError(f"invalid KST character separator at word {position}")
        if position + 2 >= len(words):
            raise SourceError("truncated KST character header")
        left_kern, code = halves(words[position + 1])
        raster_width, advance = halves(words[position + 2])
        if code < 0 or raster_width < 0:
            raise SourceError("negative KST character code or raster width")
        raster_start = position + 3
        bytes_per_row = (raster_width + 7) // 8
        expected_words = (
            (declared_line_height * bytes_per_row + 3) // 4
            if bytes_per_row
            else 0
        )
        raster_end = raster_start + expected_words
        if raster_end >= len(words):
            raise SourceError(
                f"truncated KST raster for character {code:o}: "
                f"expected {expected_words} words"
            )
        if _signed(words[raster_end], 36) not in {1, -1}:
            raise SourceError(
                f"invalid KST separator after character {code:o} "
                f"at word {raster_end}"
            )

        raster_words = words[raster_start:raster_end]
        for word_number, word in enumerate(raster_words, start=raster_start):
            if word & 0xF:
                raise SourceError(
                    f"KST raster word {word_number} has nonzero low four bits"
                )
        raster_bytes = []
        for word in raster_words:
            raster_bytes.extend(
                (word >> shift) & 0xFF for shift in (28, 20, 12, 4)
            )
        used_byte_count = declared_line_height * bytes_per_row
        if any(raster_bytes[used_byte_count:]):
            raise SourceError(
                f"KST raster for character {code:o} has nonzero trailing byte padding"
            )
        raster_bytes = raster_bytes[:used_byte_count]
        rows = []
        for y in range(declared_line_height):
            row = 0
            encoded = raster_bytes[y * bytes_per_row : (y + 1) * bytes_per_row]
            if raster_width % 8 and encoded:
                padding_mask = 0xFF ^ ((1 << (raster_width % 8)) - 1)
                if encoded[-1] & padding_mask:
                    raise SourceError(
                        f"KST raster for character {code:o}, row {y} has "
                        "nonzero unused bits"
                    )
            for x in range(raster_width):
                row = (row << 1) | ((encoded[x // 8] >> (x % 8)) & 1)
            rows.append(row)
        glyphs.append(
            Glyph(
                code=code,
                bitmap_width=raster_width,
                advance=advance,
                x_offset=-left_kern,
                y_offset=baseline - declared_line_height,
                rows=tuple(rows),
            )
        )
        position = raster_end

    if not glyphs:
        raise SourceError("KST contains no glyphs")
    represented_height = max(
        len(glyph.rows) for glyph in glyphs if glyph.bitmap_width > 0
    )
    return BitmapFont(
        name=path.stem.upper(),
        character_height=represented_height,
        raster_height=represented_height,
        baseline=baseline,
        glyphs=tuple(sorted(glyphs, key=lambda glyph: glyph.code)),
        source_format="MIT CADR PDP-10 interchange font source (KST)",
        source_name=path.name,
        metadata={
            "kstid": kstid,
            "column_position_adjustment": column_adjust,
            "declared_line_height": declared_line_height,
            "single_end_marker_word": single_end_marker_word,
        },
    )


def _alto_values(words: list[int]) -> list[int]:
    return [
        value
        for word in words
        for value in ((word >> 20) & 0xFFFF, (word >> 4) & 0xFFFF)
    ]


def parse_al(
    path: Path,
    words: list[int],
    *,
    tolerate_character_errors: bool = False,
) -> BitmapFont:
    """Parse Xerox Alto CONVERT font source using CADR FNTCNV semantics."""

    values = _alto_values(words)
    # CONVERT's format has a two-word header followed by a formal 256-entry
    # character-pointer table.  The CADR reader imports only codes 000--177,
    # but accepting a 128-entry table would mistake a truncated file for one
    # of the preserved sources.
    if len(values) < 2 + 0o400:
        raise SourceError(
            "short Alto font: expected a two-word header and 256 pointers"
        )
    line_height = values[0]
    baseline_and_width = values[1]
    baseline = (baseline_and_width >> 8) & 0x7F
    max_width = baseline_and_width & 0xFF
    array = values[2:]

    def checked(index: int) -> int:
        if not 0 <= index < len(array):
            raise SourceError(f"Alto relative pointer out of range: {index}")
        return array[index]

    def segments(code: int) -> tuple[int, list[tuple[int, int, list[int]]]]:
        index = code
        advance = 0
        result = []
        seen = set()
        x_offset = 0
        while True:
            if index in seen:
                raise SourceError(f"Alto extension cycle at character {code:o}")
            seen.add(index)
            index += checked(index)
            xw = checked(index)
            height_and_displacement = checked(index + 1)
            bitmap_height = height_and_displacement & 0xFF
            top = (height_and_displacement >> 8) & 0xFF
            start = index - bitmap_height
            if start < 0:
                raise SourceError(f"Alto bitmap underflow at character {code:o}")
            result.append(
                (x_offset, top, [checked(row_index) for row_index in range(start, index)])
            )
            if xw & 1:
                advance += xw // 2
                break
            advance += 16
            index = xw // 2
            x_offset += 16
        return advance, result

    def error_record(code: int, error: SourceError) -> dict[str, object]:
        record: dict[str, object] = {
            "code": code,
            "code_octal": f"{code:03o}",
            "error": str(error),
        }
        if code < len(array):
            relative = array[code]
            descriptor_index = code + relative
            record["directory_relative_pointer"] = relative
            record["initial_descriptor_index"] = descriptor_index
            if 0 <= descriptor_index < len(array):
                xw = array[descriptor_index]
                record["initial_xw"] = xw
                if not xw & 1:
                    record["first_extension_descriptor_index"] = xw // 2
        return record

    glyphs = []
    overhangs = {}
    vertical_overflows = {}
    character_errors = []
    for code in range(0o200):
        try:
            advance, pieces = segments(code)
        except SourceError as error:
            if not tolerate_character_errors:
                raise
            character_errors.append(error_record(code, error))
            continue
        points = set()
        for x_offset, top, encoded_rows in pieces:
            for row_number, bits in enumerate(encoded_rows):
                for x in range(16):
                    if bits & (1 << (15 - x)):
                        points.add((x_offset + x, top + row_number))
        represented_width = max([advance, *(x + 1 for x, _ in points)])
        represented_height = max([line_height, *(y + 1 for _, y in points)])
        if any(x >= advance for x, _ in points):
            overhangs[str(code)] = sorted(
                {x for x, _ in points if x >= advance}
            )
        if any(y >= line_height for _, y in points):
            vertical_overflows[str(code)] = sorted(
                {y for _, y in points if y >= line_height}
            )
        rows = []
        for y in range(represented_height):
            row = 0
            for x in range(represented_width):
                row = (row << 1) | ((x, y) in points)
            rows.append(row)
        glyphs.append(
            Glyph(
                code=code,
                bitmap_width=represented_width,
                advance=advance,
                x_offset=0,
                y_offset=baseline - represented_height,
                rows=tuple(rows),
            )
        )

    extent_recovery_required = bool(overhangs or vertical_overflows)

    return BitmapFont(
        name=path.stem.upper(),
        character_height=line_height,
        raster_height=line_height,
        baseline=baseline,
        glyphs=tuple(glyphs),
        source_format="Xerox Alto CONVERT font source (AL), via CADR FNTCNV semantics",
        source_name=path.name,
        metadata={
            "declared_max_width": max_width,
            "raster_overhangs": overhangs,
            "vertical_overflows": vertical_overflows,
            "character_pointer_integrity": (
                "partial" if character_errors else "complete"
            ),
            "extent_recovery_required": extent_recovery_required,
            "historical_loader_extent_status": (
                "recovery-required"
                if extent_recovery_required
                else "within-declared-extents"
            ),
            "horizontal_overhang_codes": sorted(int(code) for code in overhangs),
            "vertical_overflow_codes": sorted(
                int(code) for code in vertical_overflows
            ),
            "omitted_character_codes": [
                record["code"] for record in character_errors
            ],
            "character_errors": character_errors,
        },
    )


def _parse_octal_shift(token: str) -> int:
    parts = token.split("_")
    if len(parts) == 1:
        return int(parts[0], 8)
    if len(parts) == 2:
        return int(parts[0], 8) << int(parts[1].rstrip("."), 8)
    raise SourceError(f"invalid Maclisp integer {token!r}")


def _reverse_32(value: int) -> int:
    return int(f"{value & 0xFFFFFFFF:032b}"[::-1], 2)


def parse_cldfnt(path: Path, words: list[int]) -> BitmapFont:
    raw = seven_bit_text(words).rstrip(b"\x03").decode("ascii")
    match = re.search(r"LEADER\s*\((.*?)\)\s*RASTER\s*(\S+)\s*(.*)", raw, re.S)
    if not match:
        raise SourceError("invalid CLDFNT text")
    leader = match.group(1).split()
    if len(leader) < 16 or leader[14].upper() != "FONT":
        raise SourceError("unsupported CLDFNT leader")
    length = _parse_octal_shift(match.group(2))
    tokens = re.findall(r"[0-7]+(?:_[0-7]+\.?)?", match.group(3))
    raster_words = [_parse_octal_shift(token) & 0xFFFFFFFF for token in tokens]
    if len(raster_words) != length:
        raise SourceError(
            f"CLDFNT raster length {len(raster_words)} does not match {length}"
        )

    baseline = _parse_octal_shift(leader[6])
    words_per_character = _parse_octal_shift(leader[7])
    rasters_per_word = _parse_octal_shift(leader[8])
    raster_width = _parse_octal_shift(leader[9])
    raster_height = _parse_octal_shift(leader[10])
    advance = _parse_octal_shift(leader[11])
    character_height = _parse_octal_shift(leader[12])
    name = leader[13].upper()
    if not words_per_character or length % words_per_character:
        raise SourceError("inconsistent CLDFNT words-per-character")
    glyphs = []
    for code in range(length // words_per_character):
        rows = []
        for word_index in range(words_per_character):
            packed = _reverse_32(
                raster_words[code * words_per_character + word_index]
            )
            for row_index in range(rasters_per_word):
                shift = 32 - (row_index + 1) * raster_width
                if shift < 0:
                    break
                rows.append((packed >> shift) & ((1 << raster_width) - 1))
        rows = rows[:raster_height]
        rows.extend([0] * (raster_height - len(rows)))
        glyphs.append(
            Glyph(
                code=code,
                bitmap_width=raster_width,
                advance=advance,
                x_offset=0,
                y_offset=baseline - raster_height,
                rows=tuple(rows),
            )
        )
    return BitmapFont(
        name=name,
        character_height=character_height,
        raster_height=raster_height,
        baseline=baseline,
        glyphs=tuple(glyphs),
        source_format="MIT CADR cold-font source dump (CLDFNT)",
        source_name=path.name,
        metadata={
            "words_per_character": words_per_character,
            "rasters_per_word": rasters_per_word,
        },
    )


def _sixbit(word: int) -> str:
    return "".join(
        chr(((word >> shift) & 0o77) + 0o40)
        for shift in (30, 24, 18, 12, 6, 0)
    )


@dataclass(frozen=True)
class _ArcEntry:
    name: str
    second_name: str
    directory_word: int
    ignored: bool
    descriptor_index: int
    fbat_index: int | None
    descriptor_block_count: int
    word_length: int
    words: tuple[int, ...]
    physical_block_count: int = 0


def _arc_entry_record(entry: _ArcEntry) -> dict[str, object]:
    record: dict[str, object] = {
        "name": entry.name,
        "second_name": entry.second_name,
        "directory_word": entry.directory_word,
        "ignored": entry.ignored,
        "descriptor_index": entry.descriptor_index,
        "fbat_index": entry.fbat_index,
        "descriptor_block_count": entry.descriptor_block_count,
        "logical_file_block_count": entry.descriptor_block_count,
        "physical_data_block_count": entry.physical_block_count,
        "word_length": entry.word_length,
    }
    if entry.words:
        canonical = b"".join(word.to_bytes(5, "big") for word in entry.words)
        digest = hashlib.sha256(canonical).hexdigest()
        # Keep the original field name for catalog compatibility while making
        # the canonical representation explicit for new consumers.
        record["canonical_word_sha256"] = digest
        record["pdp10_word_sha256"] = digest
    return record


def _parse_arc_descriptor(
    descriptor_bytes: list[int], index: int, limit: int
) -> tuple[int | None, int]:
    """Return the first FBAT index and represented data-block count.

    ``DMARCD`` uses six-bit descriptor bytes.  Decimal values 1 through 12 take
    that many logical file blocks, decimal values 13 through 30 skip entries
    and take one, decimal 31 (octal 37) is a write-time placeholder, and a byte
    with the octal 40 bit set begins a three-byte 17-bit load address.  Each
    load address represents one logical file block.  Zero terminates the
    descriptor.  An ordinary file descriptor begins with exactly octal 40 and
    a two-byte FBAT index; later load-address operations may use the high five
    address bits in the marker.
    """

    if index == 0:
        return None, 0
    end = min(limit, len(descriptor_bytes))
    if not 0 <= index < end:
        raise SourceError(f"ARC descriptor index {index} is out of bounds")

    def load_address(cursor: int) -> tuple[int, int]:
        marker = descriptor_bytes[cursor]
        if not marker & 0o40:
            raise SourceError(f"ARC descriptor {index} has an invalid marker")
        if cursor + 2 >= end:
            raise SourceError("truncated ARC descriptor load address")
        address = (
            ((marker & 0o37) << 12)
            | (descriptor_bytes[cursor + 1] << 6)
            | descriptor_bytes[cursor + 2]
        )
        return address, cursor + 3

    if descriptor_bytes[index] != 0o40:
        raise SourceError(
            f"ARC file descriptor {index} does not begin with FBAT marker 40"
        )
    fbat_index, cursor = load_address(index)
    block_count = 1
    while True:
        if cursor >= end:
            raise SourceError("unterminated ARC descriptor")
        value = descriptor_bytes[cursor]
        if value == 0:
            return fbat_index, block_count
        if value & 0o40:
            _address, cursor = load_address(cursor)
            block_count += 1
        elif 1 <= value <= 12:
            block_count += value
            cursor += 1
        elif 13 <= value < 31:
            block_count += 1
            cursor += 1
        elif value == 31:
            cursor += 1
        else:
            raise SourceError(
                f"ARC descriptor {index} has invalid byte {value:o}"
            )


def parse_arc(
    path: Path, words: list[int]
) -> tuple[list[_ArcEntry], dict[str, object]]:
    """Extract members and provenance from an ``ARC!!!`` archive."""

    if len(words) < 2048 or _sixbit(words[0]) != "ARC!!!":
        raise SourceError("not an ARC!!! archive")
    descriptor_free_index = words[1] & MASK18
    name_area_start = words[2] & MASK18
    if not 11 <= name_area_start <= 1024:
        raise SourceError(f"implausible ARC name-area pointer {name_area_start}")
    descriptor_bytes = [
        (word >> shift) & 0o77
        for word in words[11:1024]
        for shift in (30, 24, 18, 12, 6, 0)
    ]
    descriptor_limit = min(
        descriptor_free_index,
        (name_area_start - 11) * 6,
        len(descriptor_bytes),
    )

    def chain(fbat_index: int, expected_words: int) -> tuple[tuple[int, ...], int]:
        fbat_word = 1024 + 5 + fbat_index
        if not 0 <= fbat_word < len(words):
            raise SourceError(f"ARC FBAT index {fbat_index} is out of bounds")
        pointer_mask = (1 << 23) - 1
        fbat_entry = words[fbat_word]
        if fbat_entry & ~pointer_mask:
            raise SourceError(f"ARC FBAT entry {fbat_index} has high bits set")
        address = fbat_entry & pointer_mask
        extracted = []
        visited = set()
        previous_address = 0
        traversed_blocks = 0
        found_final = False
        while address:
            if address in visited:
                raise SourceError(f"ARC data-block chain cycles at word {address}")
            visited.add(address)
            if address >= len(words):
                raise SourceError(f"ARC data block {address} is out of bounds")
            block_header = words[address]
            if block_header & (1 << 35):
                raise SourceError(f"ARC live file points to free block {address}")
            if block_header & (1 << 33):
                raise SourceError(f"ARC block {address} has its unused flag set")
            final = bool(block_header & (1 << 34))
            data_length = ((block_header >> 23) & 0x3FF) + 1
            end = address + 1 + data_length
            if end >= len(words):
                raise SourceError(f"ARC block {address} extends beyond archive")
            trailer = words[end]
            if (block_header & ~pointer_mask) != (trailer & ~pointer_mask):
                raise SourceError(
                    f"ARC block {address} header and trailer disagree"
                )
            trailer_previous = trailer & pointer_mask
            if trailer_previous != previous_address:
                raise SourceError(
                    f"ARC block {address} trailer points back to "
                    f"{trailer_previous}, expected {previous_address}"
                )
            extracted.extend(words[address + 1 : end])
            traversed_blocks += 1
            next_address = block_header & pointer_mask
            if len(extracted) > expected_words:
                raise SourceError(
                    f"ARC chain supplied more than its declared "
                    f"{expected_words} words"
                )
            if final:
                if next_address:
                    raise SourceError(
                        f"final ARC block {address} has successor {next_address}"
                    )
                found_final = True
                break
            if not next_address:
                raise SourceError(f"non-final ARC block {address} has no successor")
            if len(extracted) == expected_words:
                raise SourceError(
                    "ARC chain continues past its declared word length"
                )
            previous_address = address
            address = next_address
        if not found_final:
            raise SourceError("ARC chain ended without a final data block")
        if len(extracted) != expected_words:
            raise SourceError(
                f"ARC chain supplied {len(extracted)} of {expected_words} words"
            )
        return tuple(extracted), traversed_blocks

    entries = []
    ignore_mask = 0o200064
    for directory_word in range(name_area_start, 1024, 5):
        if words[directory_word] == 0:
            continue
        name = _sixbit(words[directory_word]).rstrip()
        second_name = _sixbit(words[directory_word + 1]).rstrip()
        random_word = words[directory_word + 2]
        descriptor_index = random_word & 0x1FFF
        ignored = bool(((random_word >> 18) & MASK18) & ignore_mask)
        fbat_index, block_count = _parse_arc_descriptor(
            descriptor_bytes, descriptor_index, descriptor_limit
        )
        last_block_words = (random_word >> 24) & 0x3FF
        if last_block_words == 0:
            last_block_words = 1024
        word_length = (
            (block_count - 1) * 1024 + last_block_words if block_count else 0
        )
        file_words = ()
        physical_block_count = 0
        if fbat_index is not None and block_count and not ignored:
            file_words, physical_block_count = chain(fbat_index, word_length)
        entries.append(
            _ArcEntry(
                name=name,
                second_name=second_name,
                directory_word=directory_word,
                ignored=ignored,
                descriptor_index=descriptor_index,
                fbat_index=fbat_index,
                descriptor_block_count=block_count,
                word_length=word_length,
                words=file_words,
                physical_block_count=physical_block_count,
            )
        )

    metadata = {
        "archive_magic": "ARC!!!",
        "archive_word_count": len(words),
        "descriptor_free_index": descriptor_free_index,
        "descriptor_limit": descriptor_limit,
        "name_area_start_word": name_area_start,
        "directory_entry_count": len(entries),
        "live_entry_count": sum(not entry.ignored for entry in entries),
        "ignored_entry_count": sum(entry.ignored for entry in entries),
        "live_logical_file_block_count": sum(
            entry.descriptor_block_count for entry in entries if not entry.ignored
        ),
        "live_physical_data_block_count": sum(
            entry.physical_block_count for entry in entries if not entry.ignored
        ),
        "entries": [_arc_entry_record(entry) for entry in entries],
    }
    return entries, metadata


def _archive_records_by_directory(
    metadata: dict[str, object],
) -> dict[int, dict[str, object]]:
    return {
        record["directory_word"]: record
        for record in metadata["entries"]
        if isinstance(record, dict)
    }


def parse_ast_archive(
    path: Path, words: list[int]
) -> tuple[list[BitmapFont], dict[str, object]]:
    """Strictly parse every live member of ``arc.ast's`` as AST."""

    entries, metadata = parse_arc(path, words)
    records = _archive_records_by_directory(metadata)
    fonts = []
    failures = []
    for entry in entries:
        if entry.ignored:
            continue
        record = records[entry.directory_word]
        try:
            parsed = parse_ast(Path(f"{entry.name.lower()}.ast"), list(entry.words))
            digest = record["pdp10_word_sha256"]
            fonts.append(
                BitmapFont(
                    name=entry.name.upper(),
                    character_height=parsed.character_height,
                    raster_height=parsed.raster_height,
                    baseline=parsed.baseline,
                    glyphs=parsed.glyphs,
                    source_format="MIT CADR AST source recovered from ARC!!!",
                    source_name=(
                        f"{path.name}:{entry.name} {entry.second_name}".rstrip()
                    ),
                    metadata=parsed.metadata
                    | {
                        "archive_directory_word": entry.directory_word,
                        "archive_second_name": entry.second_name,
                        "archive_member_sha256": digest,
                        "pdp10_word_sha256": digest,
                    },
                )
            )
            record["member_format"] = "MIT CADR textual AST font source"
            record["parse_status"] = "complete"
        except SourceError as error:
            record["parse_error"] = str(error)
            failures.append(record)

    metadata["member_format"] = "MIT CADR textual AST font source"
    metadata["live_ast_parse_success_count"] = len(fonts)
    if failures:
        raise SourceError(f"{len(failures)} live ARC AST members failed to parse")
    return fonts, metadata


def _select_latest_numeric_arc_versions(
    entries: list[_ArcEntry],
) -> dict[str, _ArcEntry]:
    """Select the greatest numeric FN2 for every duplicate ARC FN1."""

    grouped: dict[str, list[_ArcEntry]] = {}
    for entry in entries:
        if not entry.ignored:
            grouped.setdefault(entry.name, []).append(entry)

    selected = {}
    for name, versions in grouped.items():
        if len(versions) == 1:
            selected[name] = versions[0]
            continue
        if any(re.fullmatch(r"[0-9]+", entry.second_name) is None for entry in versions):
            raise SourceError(
                f"ARC member {name} has duplicate non-numeric second names"
            )
        selected[name] = max(
            versions,
            key=lambda entry: (int(entry.second_name, 10), entry.directory_word),
        )
    return selected


def _alto_bytes(words: tuple[int, ...]) -> bytes:
    return b"".join(value.to_bytes(2, "big") for value in _alto_values(list(words)))


def parse_al_archive(
    path: Path, words: list[int]
) -> tuple[list[BitmapFont], dict[str, object]]:
    """Parse AR1's AL members, omitting only impossible character records."""

    entries, metadata = parse_arc(path, words)
    records = _archive_records_by_directory(metadata)
    selected = _select_latest_numeric_arc_versions(entries)
    parsed_members: dict[int, BitmapFont] = {}
    failures = []

    # Parse every live member, including superseded FN2 versions, so the
    # archive catalog preserves the condition of all source material.
    for entry in entries:
        if entry.ignored:
            continue
        record = records[entry.directory_word]
        try:
            parsed = parse_al(
                Path(f"{entry.name.lower()}.al"),
                list(entry.words),
                tolerate_character_errors=True,
            )
        except SourceError as error:
            record["parse_error"] = str(error)
            failures.append(record)
            continue
        parsed_members[entry.directory_word] = parsed
        alto_digest = hashlib.sha256(_alto_bytes(entry.words)).hexdigest()
        record.update(
            {
                "member_format": "Xerox Alto CONVERT font source (AL)",
                "alto_byte_sha256": alto_digest,
                "character_pointer_integrity": parsed.metadata[
                    "character_pointer_integrity"
                ],
                "extent_recovery_required": parsed.metadata[
                    "extent_recovery_required"
                ],
                "historical_loader_extent_status": parsed.metadata[
                    "historical_loader_extent_status"
                ],
                "horizontal_overhang_codes": parsed.metadata[
                    "horizontal_overhang_codes"
                ],
                "vertical_overflow_codes": parsed.metadata[
                    "vertical_overflow_codes"
                ],
                "glyph_count": len(parsed.glyphs),
                "omitted_character_codes": parsed.metadata[
                    "omitted_character_codes"
                ],
                "character_errors": parsed.metadata["character_errors"],
            }
        )

    if failures:
        raise SourceError(f"{len(failures)} live ARC AL members failed to parse")

    fonts = []
    for entry in entries:
        if entry.ignored:
            continue
        selected_entry = selected[entry.name]
        record = records[entry.directory_word]
        record["selected_second_name"] = selected_entry.second_name
        if entry.directory_word != selected_entry.directory_word:
            record["selection_status"] = "unselected older numeric version"
            continue
        record["selection_status"] = "selected"
        parsed = parsed_members[entry.directory_word]
        digest = record["pdp10_word_sha256"]
        fonts.append(
            BitmapFont(
                name=entry.name.upper(),
                character_height=parsed.character_height,
                raster_height=parsed.raster_height,
                baseline=parsed.baseline,
                glyphs=parsed.glyphs,
                source_format=(
                    "Xerox Alto CONVERT font source (AL) recovered from "
                    "MIT CADR AR1 ARC!!!"
                ),
                source_name=(
                    f"{path.name}:{entry.name} {entry.second_name}".rstrip()
                ),
                metadata=parsed.metadata
                | {
                    "archive_directory_word": entry.directory_word,
                    "archive_second_name": entry.second_name,
                    "archive_member_sha256": digest,
                    "pdp10_word_sha256": digest,
                    "alto_byte_sha256": record["alto_byte_sha256"],
                    "variant_label": "AL-AR1",
                },
            )
        )

    pointer_complete_count = sum(
        record.get("character_pointer_integrity") == "complete"
        for record in records.values()
    )
    pointer_partial_count = sum(
        record.get("character_pointer_integrity") == "partial"
        for record in records.values()
    )
    selected_pointer_partial_count = sum(
        records[entry.directory_word].get("character_pointer_integrity")
        == "partial"
        for entry in selected.values()
    )
    extent_recovery_count = sum(
        bool(record.get("extent_recovery_required"))
        for record in records.values()
    )
    selected_extent_recovery_count = sum(
        bool(records[entry.directory_word].get("extent_recovery_required"))
        for entry in selected.values()
    )
    metadata.update(
        {
            "member_format": "Xerox Alto CONVERT font source (AL)",
            "live_al_parse_success_count": len(parsed_members),
            "selected_member_count": len(fonts),
            "unselected_version_count": len(parsed_members) - len(fonts),
            "character_pointer_complete_member_count": pointer_complete_count,
            "character_pointer_partial_member_count": pointer_partial_count,
            "selected_character_pointer_partial_member_count": (
                selected_pointer_partial_count
            ),
            "extent_recovery_member_count": extent_recovery_count,
            "selected_extent_recovery_member_count": (
                selected_extent_recovery_count
            ),
        }
    )
    return fonts, metadata


PARSERS = {
    ".ast": parse_ast,
    ".kst": parse_kst,
    ".al": parse_al,
    ".cldfnt": parse_cldfnt,
}

ARCHIVE_PARSERS = {
    "arc.ast's": parse_ast_archive,
    "ar1.1": parse_al_archive,
}


def source_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Recover fonts from the public MIT CADR lmfont source directory; "
            "no load band is read."
        )
    )
    parser.add_argument("source", type=Path, help="path to public src/lmfont")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--format",
        action="append",
        choices=("arc", "ast", "kst", "al", "cldfnt"),
        help=(
            "source formats to include (repeatable; default: both ARC "
            "containers, AST, KST, AL; CLDFNT is optional because "
            "arc.ast's contains TVFONT's AST source)"
        ),
    )
    parser.add_argument("--font", action="append", help="font basename to include")
    parser.add_argument("--sheet-columns", type=positive_integer, default=16)
    parser.add_argument("--sheet-scale", type=positive_integer, default=2)
    parser.add_argument(
        "--clean",
        action="store_true",
        help=(
            "replace extractor-owned files in an existing output directory; "
            "unrecognized entries are never removed"
        ),
    )
    parser.add_argument(
        "--omit-json",
        action="store_true",
        help="omit per-font normalized JSON (BDF and PNG are still written)",
    )
    parser.add_argument(
        "--strict", action="store_true", help="fail if any selected source is rejected"
    )
    args = parser.parse_args()

    if not args.source.is_dir():
        parser.error(f"not a directory: {args.source}")
    selected_formats = set(args.format or ["arc", "ast", "kst", "al"])
    selected_suffixes = {f".{name}" for name in selected_formats - {"arc"}}
    requested_names = {name.casefold() for name in args.font or []}
    sources = [
        path
        for path in args.source.iterdir()
        if (
            path.suffix.casefold() in selected_suffixes
            and (not requested_names or path.stem.casefold() in requested_names)
        )
        or (
            "arc" in selected_formats
            and path.name.casefold() in ARCHIVE_PARSERS
        )
    ]
    priority = {
        "arc.ast's": 0,
        ".ast": 1,
        ".kst": 2,
        "ar1.1": 3,
        ".al": 4,
        ".cldfnt": 5,
    }
    sources.sort(
        key=lambda path: (
            priority.get(path.name.casefold(), priority.get(path.suffix.casefold(), 9)),
            path.name.casefold(),
        )
    )
    if not sources:
        parser.error("no selected public font sources found")

    records = []
    failures = []
    seen_names = {}
    seen_logical_fonts: dict[str, list[dict[str, object]]] = {}
    alternate_sources = []
    archive_records = []
    decoded_fonts: list[tuple[BitmapFont, Path]] = []

    def semantic_fingerprint(font: BitmapFont) -> tuple[object, ...]:
        return (
            font.character_height,
            font.raster_height,
            font.baseline,
            font.glyphs,
        )

    def emit_font(font: BitmapFont, source: Path) -> None:
        if requested_names and font.name.casefold() not in requested_names:
            return
        logical_name = font.name
        fingerprint = semantic_fingerprint(font)
        for selected in seen_logical_fonts.get(logical_name, []):
            if fingerprint == selected["fingerprint"]:
                alternate_sources.append(
                    {
                        "name": logical_name,
                        "source": source.name,
                        "source_format": font.source_format,
                        "selected_source": selected["source"],
                        "selected_output_name": selected["output_name"],
                        "status": (
                            "not emitted; semantically equal to a previously "
                            "selected representation of this logical font"
                        ),
                    }
                )
                return
        variant_of = None
        if font.name in seen_names:
            variant = font.metadata.get("variant_label")
            if not isinstance(variant, str):
                variant = source.suffix.lstrip(".").upper().replace("'S", "")
            candidate = f"{font.name}-{variant}"
            serial = 2
            while candidate in seen_names:
                candidate = f"{font.name}-{variant}-{serial}"
                serial += 1
            variant_of = font.name
            font = BitmapFont(
                name=candidate,
                character_height=font.character_height,
                raster_height=font.raster_height,
                baseline=font.baseline,
                glyphs=font.glyphs,
                source_format=font.source_format,
                source_name=font.source_name,
                metadata=font.metadata
                | {"logical_name": logical_name, "variant_source_format": variant},
            )
        outputs = write_font_outputs(
            font,
            args.output,
            foundry="MIT-CADR",
            sheet_columns=args.sheet_columns,
            sheet_scale=args.sheet_scale,
            include_json=not args.omit_json,
            sheet_label_radix=8,
        )
        seen_names[font.name] = {
            "source": font.source_name,
            "fingerprint": fingerprint,
        }
        seen_logical_fonts.setdefault(logical_name, []).append(
            {
                "source": font.source_name,
                "output_name": font.name,
                "fingerprint": fingerprint,
            }
        )
        records.append(
            {
                "name": font.name,
                "logical_name": logical_name,
                "variant_of": variant_of,
                "source": font.source_name,
                "container_source": source.name,
                "source_sha256": source_sha256(source),
                "source_format": font.source_format,
                "glyph_count": len(font.glyphs),
                "character_height": font.character_height,
                "raster_height": font.raster_height,
                "baseline": font.baseline,
                "outputs": outputs,
                "observations": (
                    {
                        key: value
                        for key, value in font.metadata.items()
                        if key != "source_metrics"
                    }
                    | (
                        {"source_metric_record_count": len(font.metadata["source_metrics"])}
                        if "source_metrics" in font.metadata
                        else {}
                    )
                ),
            }
        )

    for source in sources:
        try:
            words = evacuated_words(source.read_bytes())
            archive_parser = ARCHIVE_PARSERS.get(source.name.casefold())
            if archive_parser is not None:
                fonts, archive_metadata = archive_parser(source, words)
                archive_records.append(
                    {
                        "source": source.name,
                        "source_sha256": source_sha256(source),
                        "observations": archive_metadata,
                    }
                )
                for font in fonts:
                    decoded_fonts.append((font, source))
            else:
                decoded_fonts.append(
                    (PARSERS[source.suffix.casefold()](source, words), source)
                )
        except (SourceError, EOFError, IndexError, ValueError) as error:
            failures.append({"source": source.name, "error": str(error)})
            print(f"warning: {source.name}: {error}", file=sys.stderr)

    available_names = {font.name.casefold() for font, _source in decoded_fonts}
    if not available_names:
        parser.error("none of the selected public font sources could be decoded")
    missing_names = sorted(requested_names - available_names)
    if missing_names:
        parser.error("requested font not found: " + ", ".join(missing_names))

    try:
        prepare_output_directory(
            args.output,
            clean=args.clean,
            owned_names={"bdf", "json", "sheets", "catalog.json", "LICENSE.source"},
        )
    except ValueError as error:
        parser.error(str(error))
    for font, source in decoded_fonts:
        emit_font(font, source)

    duplicate_sources = []
    by_hash = {}
    for source in sources:
        digest = source_sha256(source)
        by_hash.setdefault(digest, []).append(source.name)
    duplicate_sources = [names for names in by_hash.values() if len(names) > 1]
    pointer_partial_recoveries = [
        {
            "recovery_kind": "character-pointer",
            "name": record["name"],
            "logical_name": record["logical_name"],
            "source": record["source"],
            "omitted_character_codes": record["observations"].get(
                "omitted_character_codes", []
            ),
            "character_errors": record["observations"].get(
                "character_errors", []
            ),
        }
        for record in records
        if record["observations"].get("character_pointer_integrity") == "partial"
    ]
    extent_recoveries = [
        {
            "recovery_kind": "declared-extent",
            "name": record["name"],
            "logical_name": record["logical_name"],
            "source": record["source"],
            "horizontal_overhang_codes": record["observations"].get(
                "horizontal_overhang_codes", []
            ),
            "vertical_overflow_codes": record["observations"].get(
                "vertical_overflow_codes", []
            ),
        }
        for record in records
        if record["observations"].get("extent_recovery_required")
    ]
    logical_font_count = len({record["logical_name"] for record in records})
    variant_count = sum(record["variant_of"] is not None for record in records)
    extent_recovery_glyph_count = sum(
        len(
            set(recovery["horizontal_overhang_codes"])
            | set(recovery["vertical_overflow_codes"])
        )
        for recovery in extent_recoveries
    )
    catalog = {
        "schema_version": 2,
        "method": "public source representations only; no load band or heap",
        "source_directory": args.source.name,
        "font_count": len(records),
        "logical_font_count": logical_font_count,
        "variant_count": variant_count,
        "fonts": records,
        "rejected_sources": failures,
        "alternate_sources": alternate_sources,
        "archives": archive_records,
        "partial_recovery_count": len(pointer_partial_recoveries),
        "partial_recoveries": pointer_partial_recoveries,
        "character_pointer_partial_recovery_count": len(
            pointer_partial_recoveries
        ),
        "character_pointer_partial_recoveries": pointer_partial_recoveries,
        "extent_recovery_font_count": len(extent_recoveries),
        "extent_recovery_glyph_count": extent_recovery_glyph_count,
        "extent_recoveries": extent_recoveries,
        "byte_identical_source_groups": duplicate_sources,
    }
    license_source = args.source.parent / "LICENSE"
    if license_source.is_file():
        shutil.copyfile(license_source, args.output / "LICENSE.source")
        catalog["source_license_copy"] = "LICENSE.source"
    (args.output / "catalog.json").write_text(
        json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output.resolve()),
                "font_count": len(records),
                "logical_font_count": logical_font_count,
                "variant_count": variant_count,
                "rejected_source_count": len(failures),
                "partial_recovery_count": len(pointer_partial_recoveries),
                "extent_recovery_font_count": len(extent_recoveries),
                "extent_recovery_glyph_count": extent_recovery_glyph_count,
                "catalog": str((args.output / "catalog.json").resolve()),
            },
            indent=2,
        )
    )
    return 1 if args.strict and failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
