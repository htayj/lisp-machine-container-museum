#!/usr/bin/env python3
"""Recover resident Symbolics screen fonts directly from a VLM VLOD world.

The input and every generated BDF, JSON font record, and specimen PNG are
derived from licensed Genera media.  Keep the output outside version control.
The decoder itself contains no Genera font data and uses only Python's standard
library.
"""

from __future__ import annotations

import argparse
import bisect
import hashlib
import json
import mmap
import pathlib
import struct
import sys
from dataclasses import dataclass

from lisp_machine_fonts import (
    BitmapFont,
    Glyph,
    prepare_output_directory,
    write_font_outputs,
)


DTP_HEADER_P = 2
DTP_HEADER_I = 3
DTP_EVCP = 4
DTP_ONE_Q_FORWARD = 5
DTP_HEADER_FORWARD = 6
DTP_ELEMENT_FORWARD = 7
DTP_FIXNUM = 8
DTP_NIL = 20
DTP_ARRAY = 22
DTP_STRING = 23
DTP_SYMBOL = 24
DTP_LOCATIVE = 25
DTP_GC_FORWARD = 37

ART_1B = 10
ART_BOOLEAN = 43
ART_Q = 48
ART_Q_LIST = 49

OP_DATA_PAGES = 0
OP_CONSTANT = 1
OP_CONSTANT_INCREMENTED = 2
OP_COPY = 3

VLOD_COOKIE = 0xA38A8988
VLOD_V2_VERSION = 0o40000201
BLOCK_SIZE = 8192


def tag_type(tag: int) -> int:
    return tag & 0x3F


def signed32(value: int) -> int:
    return value - (1 << 32) if value & (1 << 31) else value


@dataclass(frozen=True)
class Q:
    tag: int
    data: int

    @property
    def type(self) -> int:
        return tag_type(self.tag)


@dataclass(frozen=True)
class Entry:
    address: int
    opcode: int
    count: int
    data_tag: int
    data_data: int


class World:
    def __init__(self, path: pathlib.Path):
        self.path = path
        self.file = path.open("rb")
        try:
            self.mm = mmap.mmap(self.file.fileno(), 0, access=mmap.ACCESS_READ)
            if len(self.mm) < 20:
                raise ValueError("VLOD is shorter than its first header group")
            if struct.unpack_from("<I", self.mm, 0)[0] != VLOD_COOKIE:
                raise ValueError("not a supported little-endian VLM .vlod")
            version = self.header_q(0).data
            if version != VLOD_V2_VERSION:
                raise ValueError(
                    f"unsupported VLOD version {version:#o}; expected VLM VLOD V2"
                )
            q1 = self.header_q(1)
            q2 = self.header_q(2)
            self.data_page_base = q2.data & ((1 << 28) - 1)
            self.tags_page_base = q2.data >> 28
            self.entries: list[Entry] = []
            for i in range(q1.data):
                a = self.header_q(8 + 3 * i)
                op = self.header_q(9 + 3 * i)
                d = self.header_q(10 + 3 * i)
                self.entries.append(
                    Entry(a.data, op.data >> 24, op.data & 0xFFFFFF, d.tag, d.data)
                )
            self.entries.sort(key=lambda e: e.address)
            self.starts = [e.address for e in self.entries]
        except Exception:
            if hasattr(self, "mm"):
                self.mm.close()
            self.file.close()
            raise

    def close(self):
        self.mm.close()
        self.file.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def header_q(self, number: int) -> Q:
        page, q = divmod(number, 256)
        group, lane = divmod(q, 4)
        base = page * 1280 + group * 20
        return Q(self.mm[base + lane], struct.unpack_from("<I", self.mm, base + 4 + 4 * lane)[0])

    def entry_for(self, vma: int) -> Entry | None:
        i = bisect.bisect_right(self.starts, vma) - 1
        if i < 0:
            return None
        entry = self.entries[i]
        return entry if vma < entry.address + entry.count else None

    def q(self, vma: int, copy_depth: int = 0) -> Q:
        entry = self.entry_for(vma)
        if entry is None:
            raise ValueError(f"unmapped VMA 0x{vma:08x}")
        i = vma - entry.address
        if entry.opcode == OP_DATA_PAGES:
            file_q = entry.data_data * BLOCK_SIZE + i
            tag_off = self.tags_page_base * BLOCK_SIZE + file_q
            data_off = self.data_page_base * BLOCK_SIZE + 4 * file_q
            return Q(self.mm[tag_off], struct.unpack_from("<I", self.mm, data_off)[0])
        if entry.opcode == OP_CONSTANT:
            return Q(entry.data_tag, entry.data_data)
        if entry.opcode == OP_CONSTANT_INCREMENTED:
            return Q(entry.data_tag, (entry.data_data + i) & 0xFFFFFFFF)
        if entry.opcode == OP_COPY:
            if copy_depth >= 32:
                raise ValueError("copy-map cycle")
            return self.q((entry.data_data + i) & 0xFFFFFFFF, copy_depth + 1)
        raise ValueError(f"unsupported map opcode {entry.opcode}")

    def follow_q(self, q: Q, *, include_header_forward: bool = True) -> tuple[Q, int | None]:
        """Follow invisible pointers.  Return the final Q and its source VMA."""
        source = None
        seen = set()
        forward_types = {DTP_EVCP, DTP_ONE_Q_FORWARD, DTP_ELEMENT_FORWARD, DTP_GC_FORWARD}
        if include_header_forward:
            forward_types.add(DTP_HEADER_FORWARD)
        for _ in range(64):
            if q.type not in forward_types:
                return q, source
            source = q.data
            if source in seen:
                raise ValueError("forwarding cycle")
            seen.add(source)
            q = self.q(source)
        raise ValueError("too many forwarding hops")

    def resolve_header(self, vma: int) -> tuple[int, Q]:
        seen = set()
        for _ in range(64):
            if vma in seen:
                raise ValueError("header-forwarding cycle")
            seen.add(vma)
            q = self.q(vma)
            if q.type in {DTP_HEADER_FORWARD, DTP_ONE_Q_FORWARD, DTP_ELEMENT_FORWARD, DTP_GC_FORWARD}:
                vma = q.data
                continue
            if q.type not in {DTP_HEADER_I, DTP_HEADER_P}:
                raise ValueError(f"VMA 0x{vma:08x} is not an object header (tag {q.tag:#x})")
            return vma, q
        raise ValueError("too many header-forwarding hops")

    def symbol_name(self, symbol_vma: int) -> str | None:
        try:
            h = self.q(symbol_vma)
            if h.type != DTP_HEADER_P:
                return None
            return self.string_at(h.data)
        except (ValueError, UnicodeError):
            return None

    def string_at(self, header_vma: int) -> str | None:
        a = Array(self, header_vma)
        if a.element_type != 1 or a.rank != 1:
            return None
        values = [a.get((i,)) for i in range(a.dims[0])]
        if any(not isinstance(x, int) or not 0 <= x <= 255 for x in values):
            return None
        return bytes(values).decode("latin-1")

    def iter_data_qs(self):
        for entry in self.entries:
            if entry.opcode == OP_DATA_PAGES:
                for i in range(entry.count):
                    yield entry.address + i, self.q(entry.address + i)


class Array:
    def __init__(self, world: World, header_vma: int):
        self.world = world
        self.header_vma, header = world.resolve_header(header_vma)
        self.header = header
        word = header.data
        self.type_code = (word >> 26) & 0x3F
        self.element_type = (self.type_code >> 4) & 3
        self.packing = (self.type_code >> 1) & 7
        self.named = bool(word & (1 << 25))
        self.leader_length = (word >> 15) & 0xFF
        self.long = bool(word & (1 << 23))
        self.displaced = bool(word & (1 << 14)) if self.long else False
        self.discontiguous = bool(word & (1 << 13)) if self.long else False
        if self.discontiguous:
            raise ValueError("discontiguous arrays are not supported")
        if not self.long:
            self.rank = 1
            self.total_size = word & 0x7FFF
            self.index_offset = 0
            self.indirect = Q(DTP_LOCATIVE, self.header_vma + 1)
            self.dims = [self.total_size]
            self.multipliers = [1]
        else:
            self.rank = word & 7
            self.total_size = self._fixnum(self.header_vma + 1)
            self.index_offset = self._fixnum(self.header_vma + 2)
            self.indirect = world.q(self.header_vma + 3)
            self.dims = []
            self.multipliers = []
            for i in range(self.rank):
                self.dims.append(self._fixnum(self.header_vma + 4 + 2 * i))
                self.multipliers.append(self._fixnum(self.header_vma + 5 + 2 * i))
        if self.total_size < 0 or any(d < 0 for d in self.dims):
            raise ValueError("negative array extent")

    def _fixnum(self, vma: int) -> int:
        q, _ = self.world.follow_q(self.world.q(vma), include_header_forward=False)
        if q.type != DTP_FIXNUM:
            raise ValueError(f"array prefix VMA 0x{vma:08x} is not a fixnum")
        return signed32(q.data)

    def leader_q(self, index: int) -> Q:
        if not 0 <= index < self.leader_length:
            raise IndexError(index)
        q, _ = self.world.follow_q(
            self.world.q(self.header_vma - 1 - index), include_header_forward=False
        )
        return q

    def _storage_index(self, subscripts: tuple[int, ...]) -> int:
        if len(subscripts) != self.rank:
            raise IndexError("wrong number of subscripts")
        index = self.index_offset
        for subscript, extent, multiplier in zip(subscripts, self.dims, self.multipliers):
            if not 0 <= subscript < extent:
                raise IndexError(subscripts)
            index += subscript * multiplier
        return index

    def get(self, subscripts: tuple[int, ...]):
        return self.get_storage(self._storage_index(subscripts))

    def get_storage(self, index: int):
        indirect, _ = self.world.follow_q(self.indirect, include_header_forward=False)
        if self.displaced and indirect.type in {DTP_ARRAY, DTP_STRING}:
            target = Array(self.world, indirect.data)
            return target.get_storage(index + target.index_offset)
        if indirect.type not in {DTP_LOCATIVE, DTP_ARRAY, DTP_STRING}:
            raise ValueError(f"unsupported array indirect pointer type {indirect.type}")
        if indirect.type in {DTP_ARRAY, DTP_STRING}:
            # A non-displaced array should normally use a locative, but treating an
            # array pointer as storage is useful for malformed/research artifacts.
            target = Array(self.world, indirect.data)
            return target.get_storage(index + target.index_offset)
        if self.element_type == 3:
            q = self.world.q(indirect.data + index)
            if q.type == DTP_FIXNUM:
                return signed32(q.data)
            if q.type == DTP_NIL:
                return None
            return q
        bits = 32 >> self.packing
        elements_per_q = 1 << self.packing
        q = self.world.q(indirect.data + index // elements_per_q)
        value = (q.data >> (bits * (index % elements_per_q))) & ((1 << bits) - 1)
        if self.element_type == 2:
            return bool(value)
        if self.element_type in {0, 1}:
            return value
        raise ValueError(f"unsupported array element type {self.element_type}")


def q_fixnum(q: Q, field: str) -> int:
    if q.type != DTP_FIXNUM:
        raise ValueError(f"{field} is not a fixnum (type {q.type})")
    return signed32(q.data)


def optional_array(world: World, q: Q) -> Array | None:
    if q.type == DTP_NIL:
        return None
    if q.type not in {DTP_ARRAY, DTP_STRING}:
        raise ValueError(f"expected array or NIL, got type {q.type}")
    return Array(world, q.data)


@dataclass
class Font:
    world: World
    array: Array
    name: str
    fill_pointer: int
    char_height: int
    char_width: int
    raster_height: int
    raster_width: int
    baseline: int
    blinker_width: int
    blinker_height: int
    chars_exist: Array | None
    char_widths: Array | None
    indexing: Array | None
    left_kerns: Array | None

    @classmethod
    def from_array(cls, world: World, array: Array) -> "Font":
        marker = array.leader_q(1)
        if marker.type != DTP_SYMBOL or world.symbol_name(marker.data) != "FONT":
            raise ValueError("not a FONT named structure")
        nq = array.leader_q(2)
        name = world.symbol_name(nq.data) if nq.type == DTP_SYMBOL else None
        if not name:
            raise ValueError("FONT has no symbol name")
        return cls(
            world,
            array,
            name,
            q_fixnum(array.leader_q(0), "fill-pointer"),
            q_fixnum(array.leader_q(3), "char-height"),
            q_fixnum(array.leader_q(4), "char-width"),
            q_fixnum(array.leader_q(5), "raster-height"),
            q_fixnum(array.leader_q(6), "raster-width"),
            q_fixnum(array.leader_q(7), "baseline"),
            q_fixnum(array.leader_q(8), "blinker-width"),
            q_fixnum(array.leader_q(9), "blinker-height"),
            optional_array(world, array.leader_q(10)),
            optional_array(world, array.leader_q(11)),
            optional_array(world, array.leader_q(12)),
            optional_array(world, array.leader_q(13)),
        )

    def special_high_codes(self) -> list[int]:
        if any((self.chars_exist, self.char_widths, self.indexing, self.left_kerns)):
            return []
        if self.fill_pointer != 0o200:
            return []
        if self.array.total_size < 0o320 * self.raster_width * self.raster_height:
            return []
        return list(range(0o301, 0o311)) + list(range(0o312, 0o320))

    def codes(self) -> list[int]:
        return list(range(self.fill_pointer)) + self.special_high_codes()

    def metric(self, table: Array | None, code: int, default: int) -> int:
        if table is None:
            return default
        value = table.get((code,))
        if not isinstance(value, int):
            raise ValueError(f"metric for {code} is not an integer: {value!r}")
        return value

    def glyph(self, code: int) -> dict:
        special = code in self.special_high_codes()
        exists = True if self.chars_exist is None else bool(self.chars_exist.get((code,)))
        set_width = 0 if special else self.metric(self.char_widths, code, self.char_width)
        left = self.metric(self.indexing, code, code * self.raster_width)
        right = self.metric(self.indexing, code + 1, (code + 1) * self.raster_width)
        width = right - left
        left_kern = self.metric(self.left_kerns, code, 0)
        if self.indexing is not None and width == 0 and set_width == 0:
            exists = False
        rows = []
        if exists:
            for y in range(self.raster_height):
                rows.append("".join("#" if self.array.get((y, left + x)) else "." for x in range(width)))
        return {
            "code": code,
            "exists": exists,
            "set_width": set_width,
            "left_kern": left_kern,
            "raster_width": width,
            "raster_height": self.raster_height,
            "rows": rows,
        }

    def summary(self) -> dict:
        glyphs = [self.glyph(c) for c in self.codes()]
        return {
            "name": self.name,
            "header_vma": f"0x{self.array.header_vma:08x}",
            "fill_pointer": self.fill_pointer,
            "char_height": self.char_height,
            "char_width": self.char_width,
            "raster_height": self.raster_height,
            "raster_width": self.raster_width,
            "baseline": self.baseline,
            "blinker_width": self.blinker_width,
            "blinker_height": self.blinker_height,
            "variable_width": self.char_widths is not None,
            "defined_glyphs": sum(g["exists"] for g in glyphs),
            "special_high_codes": self.special_high_codes(),
        }

    def exported_font(self) -> BitmapFont:
        """Return the represented glyphs with Genera's BDF crop semantics."""

        glyphs = []
        for code in self.codes():
            record = self.optimized_glyph(code)
            if not record["exists"]:
                continue
            width, _height, x_offset, y_offset = record["bbx"]
            rows = tuple(
                int(row.replace(".", "0").replace("#", "1"), 2)
                for row in record["rows"]
            )
            glyphs.append(
                Glyph(
                    code=code,
                    bitmap_width=width,
                    advance=record["set_width"],
                    x_offset=x_offset,
                    y_offset=y_offset,
                    rows=rows,
                )
            )
        return BitmapFont(
            name=self.name,
            character_height=self.char_height,
            raster_height=self.raster_height,
            baseline=self.baseline,
            glyphs=tuple(glyphs),
            source_format="VLM VLOD V2 resident FONT array",
            source_name=self.world.path.name,
            metadata=self.summary(),
        )

    def optimized_glyph(self, code: int) -> dict:
        glyph = self.glyph(code)
        rows = glyph["rows"]
        if not glyph["exists"]:
            return glyph | {"crop_left": 0, "crop_top": 0, "bbx": [0, 0, 0, 0]}
        points = [
            (x, y)
            for y, row in enumerate(rows)
            for x, value in enumerate(row)
            if value == "#"
        ]
        if not points:
            return glyph | {
                # Genera's BDF output represents an empty glyph as a transparent
                # 1x1 bitmap rather than a zero-sized BBX.
                "rows": ["."],
                "crop_left": 0,
                "crop_top": 0,
                "bbx": [1, 1, -glyph["left_kern"], 0],
            }
        left = min(x for x, _ in points)
        right = max(x for x, _ in points) + 1
        top = min(y for _, y in points)
        bottom = max(y for _, y in points) + 1
        cropped = [row[left:right] for row in rows[top:bottom]]
        return glyph | {
            "rows": cropped,
            "crop_left": left,
            "crop_top": top,
            "bbx": [
                right - left,
                bottom - top,
                -glyph["left_kern"] + left,
                self.baseline - bottom,
            ],
        }


def parse_bdf(path: pathlib.Path) -> dict[int, dict]:
    glyphs: dict[int, dict] = {}
    current = None
    bitmap = False
    for raw in path.read_text(encoding="ascii").splitlines():
        parts = raw.split()
        if not parts:
            continue
        if parts[0] == "STARTCHAR":
            current = {"name": " ".join(parts[1:]), "bitmap": []}
            bitmap = False
        elif current is not None and parts[0] == "ENCODING":
            current["encoding"] = int(parts[-1])
        elif current is not None and parts[0] == "DWIDTH":
            current["dwidth"] = int(parts[1])
        elif current is not None and parts[0] == "BBX":
            current["bbx"] = [int(x) for x in parts[1:5]]
        elif current is not None and parts[0] == "BITMAP":
            bitmap = True
        elif current is not None and parts[0] == "ENDCHAR":
            glyphs[current["encoding"]] = current
            current = None
            bitmap = False
        elif current is not None and bitmap:
            width = current["bbx"][0]
            bits = bin(int(parts[0], 16))[2:].zfill(len(parts[0]) * 4)
            current["bitmap"].append(bits[:width].replace("0", ".").replace("1", "#"))
    return glyphs


def validate_bdf(font: Font, path: pathlib.Path) -> list[str]:
    expected = parse_bdf(path)
    errors = []
    actual_codes = {g["code"] for g in (font.glyph(c) for c in font.codes()) if g["exists"]}
    if actual_codes != set(expected):
        errors.append(
            f"codes differ: only-world={sorted(actual_codes - set(expected))} "
            f"only-bdf={sorted(set(expected) - actual_codes)}"
        )
    for code in sorted(actual_codes & set(expected)):
        got = font.optimized_glyph(code)
        want = expected[code]
        if got["set_width"] != want["dwidth"]:
            errors.append(f"{code}: dwidth {got['set_width']} != {want['dwidth']}")
        if got["bbx"] != want["bbx"]:
            errors.append(f"{code}: bbx {got['bbx']} != {want['bbx']}")
        if got["rows"] != want["bitmap"]:
            errors.append(f"{code}: bitmap differs")
    return errors


class U16Reader:
    """Reader for the simple little-endian 16-bit BFD serialization."""

    def __init__(self, path: pathlib.Path):
        raw = path.read_bytes()
        if len(raw) % 2:
            raise ValueError("odd-length BFD")
        self.words = struct.unpack("<" + "H" * (len(raw) // 2), raw)
        self.position = 0

    def word(self) -> int:
        if self.position >= len(self.words):
            raise ValueError("unexpected BFD EOF")
        value = self.words[self.position]
        self.position += 1
        return value

    def signed(self) -> int:
        value = self.word()
        return value - 65536 if value & 0x8000 else value

    def string(self, length: int | None = None) -> str:
        if length is None:
            length = self.word()
        return "".join(chr(self.word()) for _ in range(length))

    def plist(self) -> dict[str, list[int]]:
        result = {}
        while (length := self.word()) != 0:
            name = self.string(length)
            result[name] = [self.word() for _ in range(self.word())]
        return result


def parse_binary_bfd(path: pathlib.Path) -> dict:
    reader = U16Reader(path)
    if [reader.word(), reader.word(), reader.word()] != [ord("B"), ord("F"), ord("D")]:
        raise ValueError("bad BFD magic")
    version = reader.word()
    if version & 0x7FFF != 0o1000:
        raise ValueError(f"unsupported BFD version {version:#x}")
    result = {
        "name": reader.string(),
        "line_spacing": reader.word(),
        "baseline": reader.word(),
        "char_width": reader.signed(),
        "properties": reader.plist(),
        "fill_pointer": reader.word(),
    }
    glyphs = []
    for _ in range(reader.word()):
        glyph = {
            "code": reader.word(),
            "set_width": reader.signed(),
            "left_kern": reader.signed(),
            "top_kern": reader.signed(),
            "width": reader.word(),
            "height": reader.word(),
        }
        glyph["legacy"] = [reader.word() for _ in range(6)]
        glyph["properties"] = reader.plist()
        glyphs.append(glyph)
    for glyph in glyphs:
        span = ((glyph["width"] + 31) // 32) * 32
        rows = []
        for _ in range(glyph["height"]):
            words = [reader.word() for _ in range(span // 16)]
            rows.append(
                "".join(
                    "#" if words[x // 16] & (1 << (x % 16)) else "."
                    for x in range(glyph["width"])
                )
            )
        glyph["rows"] = rows
    if reader.position != len(reader.words):
        raise ValueError(f"BFD trailing words: {len(reader.words) - reader.position}")
    result["glyphs"] = glyphs
    return result


def semantic_pixels(
    rows: list[str], x_offset: int, y_offset: int
) -> set[tuple[int, int]]:
    return {
        (x + x_offset, y + y_offset)
        for y, row in enumerate(rows)
        for x, pixel in enumerate(row)
        if pixel == "#"
    }


def validate_binary_bfd(font: Font, path: pathlib.Path) -> list[str]:
    bfd = parse_binary_bfd(path)
    errors = []
    for field, actual, expected in [
        ("name", font.name, bfd["name"]),
        ("line-spacing", font.char_height, bfd["line_spacing"]),
        ("baseline", font.baseline, bfd["baseline"]),
        ("char-width", font.char_width, bfd["char_width"]),
    ]:
        if str(actual).casefold() != str(expected).casefold():
            errors.append(f"{field}: {actual!r} != {expected!r}")
    expected = {glyph["code"]: glyph for glyph in bfd["glyphs"]}
    actual = {
        glyph["code"]: glyph
        for glyph in (font.glyph(code) for code in font.codes())
        if glyph["exists"]
    }
    if set(actual) != set(expected):
        errors.append(
            f"codes differ: only-world={sorted(set(actual) - set(expected))} "
            f"only-bfd={sorted(set(expected) - set(actual))}"
        )
    for code in sorted(set(actual) & set(expected)):
        got, wanted = actual[code], expected[code]
        if got["set_width"] != wanted["set_width"]:
            errors.append(
                f"{code}: set width {got['set_width']} != {wanted['set_width']}"
            )
        got_pixels = semantic_pixels(got["rows"], -got["left_kern"], 0)
        wanted_pixels = semantic_pixels(
            wanted["rows"], -wanted["left_kern"], -wanted["top_kern"]
        )
        if got_pixels != wanted_pixels:
            errors.append(f"{code}: positioned pixels differ")
    return errors


def find_fonts(world: World) -> list[Font]:
    fonts = []
    seen = set()
    for vma, q in world.iter_data_qs():
        if q.type not in {DTP_HEADER_I, DTP_HEADER_P}:
            continue
        word = q.data
        if not (word & (1 << 25)) or ((word >> 26) & 0x3F) != ART_1B:
            continue
        if ((word >> 15) & 0xFF) < 14:
            continue
        try:
            array = Array(world, vma)
            if array.header_vma in seen or array.rank != 2:
                continue
            font = Font.from_array(world, array)
        except (ValueError, IndexError):
            continue
        seen.add(array.header_vma)
        fonts.append(font)
    return sorted(fonts, key=lambda f: f.name)


def positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Extract resident FONT arrays from a little-endian VLM VLOD V2 "
            "world into BDF, normalized JSON, and PNG specimen sheets."
        )
    )
    parser.add_argument("vlod", type=pathlib.Path)
    parser.add_argument(
        "--output",
        type=pathlib.Path,
        help="output directory (required unless --list or --glyph is used)",
    )
    parser.add_argument("--font", help="extract or inspect one font by name")
    parser.add_argument(
        "--glyph",
        type=lambda value: int(value, 0),
        help="print one glyph as JSON (requires --font; accepts 0x/octal syntax)",
    )
    parser.add_argument(
        "--list", action="store_true", help="print the resident-font inventory as JSON"
    )
    parser.add_argument(
        "--reference-bdf-dir",
        type=pathlib.Path,
        help="compare against a local Genera BDF directory and write validation.json",
    )
    parser.add_argument(
        "--reference-bfd-dir",
        type=pathlib.Path,
        help="compare against a local Genera TV BFD directory and write validation.json",
    )
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
    args = parser.parse_args()

    if args.glyph is not None and not args.font:
        parser.error("--glyph requires --font")
    if not args.output and not args.list and args.glyph is None:
        parser.error("--output is required for extraction")

    with World(args.vlod) as world:
        fonts = find_fonts(world)
        if args.font:
            matches = [
                font for font in fonts if font.name.casefold() == args.font.casefold()
            ]
            if not matches:
                parser.error(f"font not found: {args.font}")
            fonts = matches
            if args.glyph is not None:
                print(
                    "warning: glyph data is derived from licensed Genera media; "
                    "do not commit or redistribute it",
                    file=sys.stderr,
                )
                print(json.dumps(fonts[0].glyph(args.glyph), indent=2))
                return 0
        if args.list:
            print(json.dumps([f.summary() for f in fonts], indent=2))
            if not args.output:
                return 0

        output = args.output.resolve()
        print(
            "warning: outputs contain font data derived from licensed Genera media; "
            "do not commit or redistribute them",
            file=sys.stderr,
        )
        try:
            prepare_output_directory(
                output,
                clean=args.clean,
                owned_names={
                    "bdf",
                    "json",
                    "sheets",
                    "manifest.json",
                    "validation.json",
                },
            )
        except ValueError as error:
            parser.error(str(error))
        output_records = []
        for font in fonts:
            paths = write_font_outputs(
                font.exported_font(),
                output,
                foundry="GENERA-WORLD",
                sheet_columns=args.sheet_columns,
                sheet_scale=args.sheet_scale,
                sheet_label_radix=8,
            )
            output_records.append(font.summary() | {"outputs": paths})

        digest = hashlib.sha256()
        with args.vlod.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        manifest = {
            "schema_version": 1,
            "notice": (
                "All generated files in this directory are derived from licensed "
                "Genera media and are intentionally not tracked by genera-emu."
            ),
            "source": {
                "filename": args.vlod.name,
                "size_bytes": args.vlod.stat().st_size,
                "sha256": digest.hexdigest(),
                "format": "little-endian VLM VLOD V2",
            },
            "distinct_font_count": len(fonts),
            "fonts": output_records,
        }
        (output / "manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

        if args.reference_bdf_dir or args.reference_bfd_dir:
            validation = {font.name: {} for font in fonts}
        if args.reference_bdf_dir:
            by_stem = {
                path.name.casefold().split(".bdf", 1)[0]: path
                for path in args.reference_bdf_dir.glob("*.bdf*")
            }
            for font in fonts:
                reference = by_stem.get(font.name.casefold())
                validation[font.name]["bdf"] = {
                    "reference": str(reference) if reference else None,
                    "differences": (
                        validate_bdf(font, reference)
                        if reference
                        else ["no unique reference BDF found"]
                    ),
                }
        if args.reference_bfd_dir:
            by_stem = {
                path.name.casefold().split(".bfd", 1)[0]: path
                for path in args.reference_bfd_dir.glob("*.bfd*")
            }
            for font in fonts:
                reference = by_stem.get(font.name.casefold())
                validation[font.name]["bfd"] = {
                    "reference": str(reference) if reference else None,
                    "differences": (
                        validate_binary_bfd(font, reference)
                        if reference
                        else ["no unique reference BFD found"]
                    ),
                }
        if args.reference_bdf_dir or args.reference_bfd_dir:
            (output / "validation.json").write_text(
                json.dumps(validation, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

        print(
            json.dumps(
                {
                    "output": str(output),
                    "font_count": len(fonts),
                    "manifest": str(output / "manifest.json"),
                },
                indent=2,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
