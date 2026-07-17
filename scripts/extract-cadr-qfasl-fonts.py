#!/usr/bin/env python3
"""Recover public MIT CADR fonts serialized in System 46 QFASL files.

This is deliberately separate from ``extract-cadr-fonts.py``.  That program
recovers authored AST, KST, Alto, and CLDFNT representations; this one reads a
narrow, verified subset of the QFASL object language and reconstructs the
runtime FONT arrays stored by the historical font compiler or array dumper.

The inputs are public files from mietek/mit-cadr-system-software, not a load
band and not licensed Symbolics media.  The parser implements only opcodes
observed in the reviewed font files and rejects all other executable content.
"""

from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import shutil
import sys
from typing import Iterable

from lisp_machine_fonts import (
    BitmapFont,
    Glyph,
    prepare_output_directory,
    write_font_outputs,
)


SOURCE_REPOSITORY = "https://github.com/mietek/mit-cadr-system-software"
SOURCE_REVISION = "8e978d7d1704096a63edd4386a3b8326a2e584af"
SOURCE_LICENSE_SHA256 = "05b8de7c86c946cc747ab71a9aaa7dd56e37365278b5585ab685156eaa90fb92"
MASK36 = (1 << 36) - 1
MAX_NIBBLES = 2_000_000
MAX_TABLE_ENTRIES = 100_000
MAX_ARRAY_ELEMENTS = 20_000_000
MAX_INITIALIZATION_VALUES = 2_000_000
MAX_NESTING = 128


class QfaslError(ValueError):
    """The input cannot be decoded under the reviewed inert-QFASL grammar."""


@dataclass(frozen=True)
class ArtifactSpec:
    artifact_name: str
    source_file: str
    runtime_name: str
    byte_size: int
    sha256: str
    relation: str = "QFASL-only runtime logical name"


@dataclass(frozen=True)
class CrossCheckSpec:
    source_file: str
    runtime_name: str
    reference_bdf: str
    source_byte_size: int
    source_sha256: str
    reference_bdf_byte_size: int
    reference_bdf_sha256: str


@dataclass(frozen=True)
class CompiledVersionSpec:
    older_file: str
    older_artifact_name: str
    newer_file: str
    runtime_name: str
    older_byte_size: int
    older_sha256: str
    newer_byte_size: int
    newer_sha256: str


# This reviewed manifest is intentionally closed.  It keeps the compiled-only
# corpus distinct from the 30 source-backed QFASLs.  Four representative
# source-backed files are used as decoder controls but are not emitted here.
ARTIFACTS = (
    ArtifactSpec(
        "20VR", "20vr.qfasl", "20VR", 14093,
        "7ad9fd1ab06055651017a87577003171b03906f235e34f04df0bc9f75b500ac1",
    ),
    ArtifactSpec(
        "31VR", "31vr.qfasl", "31VR", 21074,
        "8711e18f24ffd1bcbd50aafc111048b229531bdd6a35cf7e78e6086be0b7ce81",
    ),
    ArtifactSpec(
        "40VR", "40vr.qfasl", "40VR", 26675,
        "5e7be5a1769f1d5b962bcf28a4297e5a1b191bc0a8546e77e6ea5c26a1e589d5",
    ),
    ArtifactSpec(
        "BIGVG", "bigvg.qfasl", "BIGVG", 17063,
        "9adb3676ca3a9c1322e6f60e0cb233e64b9f8f4b69715a5ab2902ca22521273c",
    ),
    ArtifactSpec(
        "CPT-13FG", "3213fg.qfasl", "CPT-13FG", 2820,
        "41a50596856d7a0fcf5416f092f6eac6bac2a11a7d0a62383bae7abf2989a029",
    ),
    ArtifactSpec(
        "CPT-HL10", "32hl10.qfasl", "CPT-HL10", 5139,
        "84b7be68b782f1586f9cee7c7b14d8497591abb9ef920847afeb15d727824302",
    ),
    ArtifactSpec(
        "CPT-HL10B", "3hl10b.qfasl", "CPT-HL10B", 5143,
        "6fd65073b66d14dcca217e697478d3a628033286837d91589e7631d7090b0017",
    ),
    ArtifactSpec(
        "CPT-TR10I", "3tr10i.qfasl", "CPT-TR10I", 5141,
        "88bdf62840868ddd58a77df2819c4a0dd97edb538054cd243cb75809da5f7026",
    ),
    ArtifactSpec(
        "GERM35", "germ35.qfasl", "GERM35", 12846,
        "6cc0761cea0b19f5c182321721d19b5dc64dec8b8b381f346d7723d61fc3b8da",
    ),
    ArtifactSpec(
        "HL12BI", "hl12bi.qfasl", "HL12BI", 4934,
        "d7ec25e750853b2dbe6d951f03df063fc1ce0f02b2739d0d7f4b6f025e0ada55",
    ),
    ArtifactSpec(
        "MEDFNB", "medfnb.qfasl", "MEDFNB", 4312,
        "5e821fc01c13878c5f127ebbd4a2da46cd9ac5fb22fafa53415d4f0882bf4c77",
    ),
    ArtifactSpec(
        "S30CHS", "s30chs.qfasl", "S30CHS", 19319,
        "76f77a3bdc6f10331100edc755fd7701b72bf74ef75276d3fe0a4de629a8dfb2",
    ),
    ArtifactSpec(
        "S35GER", "s35ger.qfasl", "S35GER", 23547,
        "702d3408a83df9654b5e1d704513378b07b5f50755076b4bd38ec7e790689b4a",
    ),
    ArtifactSpec(
        "SAIL12", "sail12.qfasl", "SAIL12", 3864,
        "4f8e2d6c81f2966248fdb08e5eef92b56b289a21788cbc53432469098d3df612",
    ),
    ArtifactSpec(
        "SEARCH", "search.qfasl", "SEARCH", 2209,
        "668993eac8f301536b04affd7a2ec4d28a8cd46e4a6440c6bbe48504fc3f6330",
    ),
    ArtifactSpec(
        "SHIP", "ship.qfasl", "SHIP", 13059,
        "385a8bd82f4d3d0edf35a341fefba0259c30d773230460376a4ae1875a7af553",
    ),
    ArtifactSpec(
        "TR12B1", "tr12b1.qfasl", "TR12B1", 6419,
        "4c87b61ddfc8f0f91fbf82f4fa27c53724e8dc64a5a03fe46b40309eadf50e1a",
    ),
    ArtifactSpec(
        "N43XMS",
        "n43xms.qfasl",
        "43VXMS",
        22284,
        "4ab3b3fb58a94497ced5d3bfefe5d9d40be794ab6d98b8223d918103416b1dfe",
        "older compiled version of source-backed runtime name 43VXMS",
    ),
    ArtifactSpec(
        "NTOG",
        "ntog.qfasl",
        "TOG",
        18790,
        "d65eef34111b30b109f3e517ae04d9841e46f6a05a1449af7846d8c08762fa3a",
        "older compiled version of source-backed runtime name TOG",
    ),
)


# Public source-backed controls exercise both FCMP's direct output and the
# later generic array dumper, including wide glyphs and every auxiliary table
# type used by this corpus.
CROSS_CHECKS = (
    CrossCheckSpec(
        "hl10.qfasl", "HL10", "hl10.bdf", 5139,
        "6cb8edf80597fa6a18d7d083626601eae760d7968fe333cc66cbaf70d0f21457",
        14045, "55e554b22cc967a7c89c71a2134aedf2701b7a30ca44577548e43b1b083c7fdb",
    ),
    CrossCheckSpec(
        "43vxms.qfasl", "43VXMS", "43vxms.bdf", 21293,
        "f6800abefa7bd0d3a326219b669072b53ae5be6b2a019f27007edcfef8a7f968",
        32271, "871db2362749c15d017d00fab0667f3d66de798cb878fe279a1342e8de0465ee",
    ),
    CrossCheckSpec(
        "arrow.qfasl", "ARROW", "arrow.bdf", 2262,
        "c539480c8976347b12fa30dea13b2b46bc2670abc553602ac4d0f0d650d54c8a",
        3044, "96c08c980ce07a5e16ef89a602b15b6b58f0ba70a255ea5269af64d44d8a2966",
    ),
    CrossCheckSpec(
        "bigfnt.qfasl", "BIGFNT", "bigfnt-kst.bdf", 7288,
        "767d2044b016e3abfb0e13d84fd1bc1fcb041d1b556acca9510bc8b33f4a4ec9",
        22296, "e82cac902b2289e2d598d6b9b077965214aadb183b595fd0efe6170f9bcc0014",
    ),
    CrossCheckSpec(
        "n43xms.qfasl", "43VXMS", "43vxms.bdf", 22284,
        "4ab3b3fb58a94497ced5d3bfefe5d9d40be794ab6d98b8223d918103416b1dfe",
        32271, "871db2362749c15d017d00fab0667f3d66de798cb878fe279a1342e8de0465ee",
    ),
    CrossCheckSpec(
        "ntog.qfasl", "TOG", "tog.bdf", 18790,
        "d65eef34111b30b109f3e517ae04d9841e46f6a05a1449af7846d8c08762fa3a",
        2548, "073a816dd7cae18140567546fafbe4c9c3a6246bd847d44230404b764becc378",
    ),
)


COMPILED_VERSION_CHECKS = (
    CompiledVersionSpec(
        "n43xms.qfasl",
        "N43XMS",
        "43vxms.qfasl",
        "43VXMS",
        22284,
        "4ab3b3fb58a94497ced5d3bfefe5d9d40be794ab6d98b8223d918103416b1dfe",
        21293,
        "f6800abefa7bd0d3a326219b669072b53ae5be6b2a019f27007edcfef8a7f968",
    ),
    CompiledVersionSpec(
        "ntog.qfasl",
        "NTOG",
        "tog.qfasl",
        "TOG",
        18790,
        "d65eef34111b30b109f3e517ae04d9841e46f6a05a1449af7846d8c08762fa3a",
        18737,
        "379a3d0b226ebe3bda79e1906886cba039d707b7fea65c566f1934aea331f01b",
    ),
)


def _text_byte(byte: int) -> tuple[int, ...]:
    """Undo one byte of the ITS tape extractor's evacuated representation."""

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
    raise QfaslError(f"invalid evacuated text byte {byte:#o}")


def evacuated_words(raw: bytes) -> list[int]:
    """Reconstruct the historical PDP-10 36-bit words from host bytes."""

    words: list[int] = []
    characters: list[int] = []
    position = 0

    def flush() -> None:
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
                raise QfaslError("quoted binary word occurs inside a text word")
            if position + 4 > len(raw):
                raise QfaslError("truncated quoted binary word")
            byte1, byte2, byte3, byte4 = raw[position : position + 4]
            position += 4
            left = ((byte & 0o17) << 14) | (byte1 << 6) | (byte2 >> 2)
            right = ((byte2 & 0o3) << 16) | (byte3 << 8) | byte4
            words.append((left << 18) | right)
            continue
        for character in _text_byte(byte):
            characters.append(character)
            flush()

    if characters:
        characters.extend([0o3] * (5 - len(characters)))
        flush()
    return words


def qfasl_nibbles(words: Iterable[int]) -> list[int]:
    """Return the two 16-bit QFASL nibbles stored in each PDP-10 word."""

    result = []
    for word in words:
        if not 0 <= word <= MASK36:
            raise QfaslError("PDP-10 word is outside 36-bit range")
        if word & 0xF:
            raise QfaslError("QFASL PDP-10 word has nonzero low padding bits")
        result.extend(((word >> 20) & 0xFFFF, (word >> 4) & 0xFFFF))
    return result


@dataclass(frozen=True)
class Symbol:
    name: str
    package: tuple[str, ...] = ()

    @property
    def qualified_name(self) -> str:
        return ":".join((*self.package, self.name))


@dataclass
class SerializedArray:
    element_type: str
    dimensions: tuple[int, ...]
    leader: dict[int, object] = field(default_factory=dict)
    initialization: list[object] | None = None
    initialization_opcode: str | None = None
    declared_leader_length: int | None = None

    @property
    def length(self) -> int:
        result = 1
        for dimension in self.dimensions:
            result *= dimension
        return result

    def values(self) -> list[int]:
        """Decode the initialized array in Lisp Machine storage order."""

        if self.initialization is None:
            raise QfaslError("array was never initialized")
        if any(not isinstance(value, int) for value in self.initialization):
            raise QfaslError(f"{self.element_type} array has non-integer data")
        raw = [int(value) for value in self.initialization]

        packed_counts = {
            "ART-Q": self.length,
            "ART-1B": (self.length + 15) // 16,
            "ART-8B": (self.length + 1) // 2,
            "ART-16B": self.length,
            "ART-32B": self.length * 2,
        }
        if self.element_type not in packed_counts:
            raise QfaslError(f"unsupported serialized array type {self.element_type}")
        expected_count = packed_counts[self.element_type]
        if len(raw) != expected_count:
            raise QfaslError(
                f"{self.element_type} initialization has {len(raw)} halfwords or "
                f"values, expected exactly {expected_count}"
            )

        if self.element_type == "ART-Q":
            result = raw
        elif self.element_type == "ART-1B":
            result = [(word >> bit) & 1 for word in raw for bit in range(16)]
        elif self.element_type == "ART-8B":
            result = [
                (word >> shift) & 0xFF for word in raw for shift in (0, 8)
            ]
        elif self.element_type == "ART-16B":
            result = raw
        elif self.element_type == "ART-32B":
            if len(raw) % 2:
                raise QfaslError("ART-32B array has an odd halfword count")
            result = []
            for index in range(0, len(raw), 2):
                # System 46's ART-32B access supplies a FIXNUM data type and
                # exposes 24 payload bits.  The dumped upper byte is the Q tag,
                # not part of a signed left-kern value.
                raw32 = raw[index] | (raw[index + 1] << 16)
                tag = (raw32 >> 24) & 0xFF
                if raw32 != 0 and tag != 0xC5:
                    raise QfaslError(
                        f"ART-32B element has unsupported Q tag {tag:#04x}"
                    )
                value = raw32 & 0xFFFFFF
                if value & 0x800000:
                    value -= 1 << 24
                result.append(value)
        if any(result[self.length :]):
            raise QfaslError(f"nonzero packing padding in {self.element_type} array")
        return result[: self.length]


@dataclass
class _Group:
    opcode: int
    flag: bool
    remaining: int
    offset: int


OPCODE_NAMES = {
    0o02: "INDEX",
    0o03: "SYMBOL",
    0o04: "LIST",
    0o05: "TEMP-LIST",
    0o06: "FIXED",
    0o10: "ARRAY",
    0o16: "STOREIN-SYMBOL-VALUE",
    0o25: "END-OF-WHACK",
    0o26: "END-OF-FILE",
    0o44: "INITIALIZE-ARRAY",
    0o54: "STRING",
    0o55: "STOREIN-ARRAY-LEADER",
    0o56: "INITIALIZE-NUMERIC-ARRAY",
    0o60: "PACKAGE-SYMBOL",
}


class FontQfaslParser:
    """A non-evaluating parser for reviewed serialized-object subsets.

    The default remains the exact subset used by the recovered font files.
    ``allow_inert_picture_form`` adds only the object-conversion form emitted
    by ``LMIO1;CVPTS`` for picture arrays.  The form is recognized and its
    already-serialized array is returned; no Lisp form is ever executed.
    """

    def __init__(
        self, nibbles: list[int], *, allow_inert_picture_form: bool = False
    ):
        if len(nibbles) > MAX_NIBBLES:
            raise QfaslError(f"QFASL exceeds the {MAX_NIBBLES}-nibble safety limit")
        self.nibbles = nibbles
        self.allow_inert_picture_form = allow_inert_picture_form
        self.position = 0
        self.table: list[object] = []
        self.bindings: dict[Symbol, object] = {}
        self.opcode_counts: Counter[int] = Counter()
        self.whack_count = 0
        self._finished = False
        self._reset_table()

    def _reset_table(self) -> None:
        # Only FASL-NIL (index zero) is semantically required by these files.
        # Unknown parameter slots are sentinels so an unexpected dependency is
        # rejected instead of silently assigned a made-up host value.
        self.table = [None] + [_UNSET] * 31

    def _raw(self) -> int:
        if self.position >= len(self.nibbles):
            raise QfaslError("unexpected end of QFASL nibble stream")
        value = self.nibbles[self.position]
        self.position += 1
        return value

    @staticmethod
    def _operation_name(opcode: int) -> str:
        return "EVAL" if opcode == 0o11 else OPCODE_NAMES[opcode]

    def _direct(self, group: _Group) -> int:
        if group.remaining == 0:
            raise QfaslError(
                f"opcode {self._operation_name(group.opcode)} "
                "consumed too many direct nibbles"
            )
        group.remaining -= 1
        return self._raw()

    def _enter(self, value: object) -> int:
        if len(self.table) >= MAX_TABLE_ENTRIES:
            raise QfaslError("QFASL table exceeds its safety limit")
        self.table.append(value)
        return len(self.table) - 1

    def _lookup(self, index: int) -> object:
        if not 0 <= index < len(self.table):
            raise QfaslError(f"FASL table index {index} is out of range")
        value = self.table[index]
        if value is _UNSET:
            raise QfaslError(f"FASL table parameter index {index} is unsupported")
        return value

    def _value(self, depth: int) -> object:
        return self._lookup(self._parse_group(depth + 1))

    @staticmethod
    def _symbol_name(value: object, field_name: str) -> str:
        if not isinstance(value, Symbol):
            raise QfaslError(f"{field_name} is not a symbol")
        return value.name

    def _parse_group(self, depth: int = 0) -> int:
        if depth > MAX_NESTING:
            raise QfaslError("QFASL value nesting exceeds its safety limit")
        offset = self.position
        header = self._raw()
        if not header & 0o100000:
            raise QfaslError(
                f"group at nibble {offset} lacks the QFASL check bit: {header:#o}"
            )
        opcode = header & 0o77
        if opcode == 0o11 and not self.allow_inert_picture_form:
            raise QfaslError(
                f"unsupported opcode {opcode:#o} at nibble {offset}; "
                "QFASLs are never evaluated"
            )
        if opcode not in OPCODE_NAMES and not (
            opcode == 0o11 and self.allow_inert_picture_form
        ):
            raise QfaslError(
                f"unsupported opcode {opcode:#o} at nibble {offset}; "
                "QFASLs are never evaluated"
            )
        length = (header & 0o37700) >> 6
        if length == 0o377:
            length = self._raw()
        group = _Group(opcode, bool(header & 0o40000), length, offset)
        self.opcode_counts[opcode] += 1

        if opcode == 0o02:  # INDEX
            result = self._direct(group)
            self._lookup(result)
        elif opcode in {0o03, 0o54}:  # SYMBOL or STRING
            characters: list[int] = []
            for nibble_number in range(length):
                packed = self._direct(group)
                characters.append(packed & 0xFF)
                second = (packed >> 8) & 0xFF
                if second == 0x80:
                    if nibble_number != length - 1:
                        raise QfaslError("symbol padding occurs before its last nibble")
                else:
                    characters.append(second)
            try:
                name = bytes(characters).decode("ascii")
            except UnicodeDecodeError as error:
                raise QfaslError("font QFASL contains a non-ASCII symbol") from error
            if opcode == 0o03:
                value: object = None if name == "NIL" else Symbol(name)
            else:
                value = name
            result = self._enter(value)
        elif opcode in {0o04, 0o05}:  # LIST or TEMP-LIST
            count = self._direct(group)
            if count > MAX_INITIALIZATION_VALUES:
                raise QfaslError("QFASL list exceeds its safety limit")
            values = [self._value(depth) for _ in range(count)]
            if group.flag:
                raise QfaslError("dotted lists are outside the font QFASL subset")
            result = self._enter(values)
        elif opcode == 0o06:  # FIXED
            magnitude = 0
            for _ in range(length):
                magnitude = (magnitude << 16) | self._direct(group)
            result = self._enter(-magnitude if group.flag else magnitude)
        elif opcode == 0o10:  # ARRAY
            area = self._value(depth)
            element_type = self._symbol_name(
                self._value(depth), "array element type"
            )
            dimensions_value = self._value(depth)
            displaced = self._value(depth)
            leader_value = self._value(depth)
            index_offset = self._value(depth)
            if group.flag:
                named_structure = self._value(depth)
                if named_structure not in {Symbol("T"), Symbol("FONT")}:
                    # Historical generic dumps use T; FCMP supplies FONT via
                    # the leader and does not set this flag.
                    raise QfaslError("unexpected ARRAY named-structure marker")
            if not isinstance(area, Symbol):
                raise QfaslError("array area is not a symbol")
            if displaced is not None or index_offset is not None:
                raise QfaslError("displaced font arrays are unsupported")
            if not isinstance(dimensions_value, list) or not dimensions_value:
                raise QfaslError("array dimensions are not a nonempty list")
            if any(
                not isinstance(value, int) or value < 0
                for value in dimensions_value
            ):
                raise QfaslError("array has an invalid dimension")
            element_count = 1
            for dimension in dimensions_value:
                element_count *= dimension
                if element_count > MAX_ARRAY_ELEMENTS:
                    raise QfaslError("array dimensions exceed the safety limit")
            if isinstance(leader_value, int):
                if not self.allow_inert_picture_form:
                    raise QfaslError("array leader initializer is not a list")
                if not 0 <= leader_value <= MAX_INITIALIZATION_VALUES:
                    raise QfaslError("array leader length exceeds its safety limit")
                leader = {}
                declared_leader_length = leader_value
            elif leader_value is None:
                leader = {}
                declared_leader_length = 0
            elif isinstance(leader_value, list):
                leader = dict(enumerate(reversed(leader_value)))
                declared_leader_length = len(leader_value)
            else:
                raise QfaslError("array leader initializer is neither a list nor a length")
            result = self._enter(
                SerializedArray(
                    element_type,
                    tuple(dimensions_value),
                    leader,
                    declared_leader_length=declared_leader_length,
                )
            )
        elif opcode == 0o11:  # EVAL -- recognized but never executed
            form = self._lookup(self._direct(group))
            valid = (
                not group.flag
                and isinstance(form, list)
                and len(form) == 2
                and form[0] == Symbol("MAKE-ARRAY-INTO-NAMED-STRUCTURE")
                and isinstance(form[1], Symbol)
                and isinstance(self.bindings.get(form[1]), SerializedArray)
            )
            if not valid:
                raise QfaslError(
                    "unsupported EVAL form in picture subset; QFASLs are never evaluated"
                )
            # FASL-OP-EVAL stores its result in table parameter 1.  The only
            # accepted form returns the array already bound to its second
            # argument, so reproducing that pointer does not require EVAL.
            self.table[1] = self.bindings[form[1]]
            result = 1
        elif opcode == 0o16:  # STOREIN-SYMBOL-VALUE
            source_index = self._direct(group)
            destination = self._value(depth)
            if not isinstance(destination, Symbol):
                raise QfaslError("symbol-value destination is not a symbol")
            self.bindings[destination] = self._lookup(source_index)
            result = 0
        elif opcode == 0o25:  # END-OF-WHACK
            if group.flag:
                raise QfaslError("END-OF-WHACK has an unexpected flag")
            self.whack_count += 1
            result = _END_WHACK
        elif opcode == 0o26:  # END-OF-FILE
            if group.flag:
                raise QfaslError("END-OF-FILE has an unexpected flag")
            result = _END_FILE
        elif opcode in {0o44, 0o56}:  # array initialization
            array_index = self._parse_group(depth + 1)
            array = self._lookup(array_index)
            count = self._value(depth)
            if not isinstance(array, SerializedArray):
                raise QfaslError("array initialization target is not an array")
            if array.initialization is not None:
                raise QfaslError("array is initialized more than once")
            if not isinstance(count, int) or count < 0:
                raise QfaslError("array initialization count is invalid")
            if count > MAX_INITIALIZATION_VALUES:
                raise QfaslError("array initialization exceeds its safety limit")
            if opcode == 0o44:
                initialization = [self._value(depth) for _ in range(count)]
                operation = "INITIALIZE-ARRAY"
            else:
                # The historical format explicitly excludes these halfwords
                # from the group-length field.
                initialization = [self._raw() for _ in range(count)]
                operation = "INITIALIZE-NUMERIC-ARRAY"
            array.initialization = initialization
            array.initialization_opcode = operation
            result = array_index
            # CVPTS asks FASD for a direct group length of one, then emits the
            # target as a nested INDEX group.  The historical loader does not
            # require the resulting redundant count to reach zero.  Accept
            # that exact quirk only in the reviewed picture subset.
            if (
                self.allow_inert_picture_form
                and opcode == 0o56
                and group.remaining == 1
            ):
                group.remaining = 0
        elif opcode == 0o55:  # STOREIN-ARRAY-LEADER
            array = self._lookup(self._direct(group))
            subscript = self._lookup(self._direct(group))
            value = self._lookup(self._direct(group))
            if not isinstance(array, SerializedArray):
                raise QfaslError("leader store target is not an array")
            if not isinstance(subscript, int) or subscript < 0:
                raise QfaslError("leader store subscript is invalid")
            if (
                array.declared_leader_length is not None
                and subscript >= array.declared_leader_length
            ):
                raise QfaslError("leader store subscript is outside the declared leader")
            array.leader[subscript] = value
            result = 0
        elif opcode == 0o60:  # PACKAGE-SYMBOL
            component_count = self._direct(group)
            if component_count > MAX_NESTING:
                raise QfaslError("package name has too many components")
            components = [self._value(depth) for _ in range(component_count)]
            if not components or any(
                not isinstance(component, str) for component in components
            ):
                raise QfaslError("package symbol has invalid name components")
            result = self._enter(
                Symbol(str(components[-1]), tuple(str(x) for x in components[:-1]))
            )
        else:  # pragma: no cover - guarded by OPCODE_NAMES
            raise AssertionError(opcode)

        if group.remaining:
            raise QfaslError(
                f"opcode {self._operation_name(opcode)} left {group.remaining} "
                "direct nibbles unconsumed"
            )
        return result

    def parse(self) -> dict[Symbol, object]:
        if self._finished:
            raise QfaslError("parser instances are single-use")
        if self._raw() != 0o143150 or self._raw() != 0o071660:
            raise QfaslError("not a System 46 QFASL file (bad SIXBIT/QFASL magic)")
        while True:
            result = self._parse_group()
            if result is _END_FILE:
                break
            if result is _END_WHACK:
                self._reset_table()
        trailing = self.nibbles[self.position :]
        if len(trailing) > 1 or any(trailing):
            raise QfaslError(f"unexpected data after END-OF-FILE: {trailing!r}")
        self._finished = True
        return self.bindings


_UNSET = object()
_END_WHACK = -2
_END_FILE = -3


def _require_int(leader: dict[int, object], index: int, name: str) -> int:
    value = leader.get(index)
    if not isinstance(value, int):
        raise QfaslError(f"FONT leader {name} ({index:o}) is not an integer")
    return value


def _optional_array(
    leader: dict[int, object], index: int, expected_type: str, length: int, name: str
) -> list[int] | None:
    value = leader.get(index)
    if value is None:
        return None
    if not isinstance(value, SerializedArray):
        raise QfaslError(f"FONT leader {name} ({index:o}) is not an array")
    if value.element_type not in {expected_type, "ART-Q"}:
        raise QfaslError(
            f"FONT {name} table uses {value.element_type}, expected {expected_type}"
        )
    values = value.values()
    if len(values) != length:
        raise QfaslError(f"FONT {name} table has {len(values)} entries, expected {length}")
    return values


def _serialized_font_binding(
    bindings: dict[Symbol, object],
) -> tuple[Symbol, SerializedArray]:
    font_bindings = [
        (symbol, value)
        for symbol, value in bindings.items()
        if isinstance(value, SerializedArray)
        and isinstance(value.leader.get(1), Symbol)
        and value.leader[1].name == "FONT"
    ]
    if len(font_bindings) != 1:
        raise QfaslError(f"expected one serialized FONT binding, found {len(font_bindings)}")
    return font_bindings[0]


def font_from_binding(
    artifact_name: str,
    expected_runtime_name: str,
    source_name: str,
    bindings: dict[Symbol, object],
) -> BitmapFont:
    symbol, array = _serialized_font_binding(bindings)
    if symbol.package != ("FONTS",) or symbol.name != expected_runtime_name:
        raise QfaslError(
            f"QFASL binds {symbol.qualified_name}, expected "
            f"FONTS:{expected_runtime_name}"
        )
    if array.element_type != "ART-1B" or len(array.dimensions) != 1:
        raise QfaslError("serialized FONT raster is not a one-dimensional ART-1B array")

    leader = array.leader
    character_height = _require_int(leader, 0o3, "character height")
    fixed_width = _require_int(leader, 0o4, "character width")
    raster_height = _require_int(leader, 0o5, "raster height")
    raster_width = _require_int(leader, 0o6, "raster width")
    rasters_per_word = _require_int(leader, 0o7, "rasters per word")
    words_per_character = _require_int(leader, 0o10, "words per character")
    baseline = _require_int(leader, 0o11, "baseline")
    if not 1 <= character_height <= 256:
        raise QfaslError("FONT character height is outside the supported range")
    if not 1 <= raster_height <= character_height:
        raise QfaslError("FONT raster height is inconsistent with character height")
    if not 0 <= baseline <= character_height:
        raise QfaslError("FONT baseline is outside the character cell")
    if not 1 <= raster_width <= 32:
        raise QfaslError("FONT raster width is outside 1..32")
    if rasters_per_word != 32 // raster_width:
        raise QfaslError("FONT rasters-per-word is inconsistent with raster width")
    expected_words = (raster_height + rasters_per_word - 1) // rasters_per_word
    if words_per_character != expected_words:
        raise QfaslError("FONT words-per-character is inconsistent with raster height")

    widths = _optional_array(leader, 0o12, "ART-8B", 128, "character width")
    kerns = _optional_array(leader, 0o13, "ART-32B", 128, "left kern")
    indexes = _optional_array(leader, 0o14, "ART-16B", 129, "indexing")
    if leader.get(0o15) is not None:
        raise QfaslError("FONT next-plane pointer is unsupported")
    exists = _optional_array(leader, 0o20, "ART-1B", 128, "characters-exist")
    if indexes is not None:
        if indexes[0] != 0:
            raise QfaslError("FONT indexing table does not start at zero")
        if any(indexes[index] > indexes[index + 1] for index in range(128)):
            raise QfaslError("FONT indexing table is not monotonic")
    storage_characters = indexes[-1] if indexes is not None else 128
    expected_raster_bits = 32 * words_per_character * storage_characters
    if array.length != expected_raster_bits:
        raise QfaslError(
            f"FONT raster has {array.length} bits, expected {expected_raster_bits}"
        )
    raster_bits = array.values()
    if array.initialization is None or len(array.initialization) % 2:
        raise QfaslError("FONT raster does not contain complete 32-bit words")
    raster_qs = [
        int(array.initialization[index])
        | (int(array.initialization[index + 1]) << 16)
        for index in range(0, len(array.initialization), 2)
    ]
    raster_q_bytes = b"".join(value.to_bytes(4, "big") for value in raster_qs)

    glyphs = []
    represented_codes = [
        code for code in range(128) if exists is None or exists[code] != 0
    ]
    for code in represented_codes:
        if indexes is None:
            bitmap_width = raster_width
        else:
            bitmap_width = (indexes[code + 1] - indexes[code]) * raster_width
        rows = []
        for row in range(raster_height):
            packed_row = 0
            for column in range(bitmap_width):
                storage_code = (
                    code
                    if indexes is None
                    else indexes[code] + column // raster_width
                )
                in_column = column % raster_width
                word_index = (
                    words_per_character * storage_code + row // rasters_per_word
                )
                bit_index = (
                    32 * word_index
                    + raster_width * (row % rasters_per_word)
                    + in_column
                )
                packed_row = (packed_row << 1) | raster_bits[bit_index]
            rows.append(packed_row)
        glyphs.append(
            Glyph(
                code=code,
                bitmap_width=bitmap_width,
                advance=widths[code] if widths is not None else fixed_width,
                x_offset=-(kerns[code] if kerns is not None else 0),
                y_offset=baseline - raster_height,
                rows=tuple(rows),
            )
        )

    leader_name = leader.get(0o2)
    serialized_leader_name = (
        leader_name.qualified_name if isinstance(leader_name, Symbol) else None
    )
    return BitmapFont(
        name=artifact_name,
        character_height=character_height,
        raster_height=raster_height,
        baseline=baseline,
        glyphs=tuple(glyphs),
        source_format="MIT CADR System 46 serialized QFASL FONT object",
        source_name=source_name,
        metadata={
            "runtime_name": symbol.name,
            "runtime_symbol": symbol.qualified_name,
            "serialized_leader_name": serialized_leader_name,
            "fixed_character_width": fixed_width,
            "raster_width": raster_width,
            "rasters_per_word": rasters_per_word,
            "words_per_character": words_per_character,
            "leader_length": max(leader, default=-1) + 1,
            "blinker_width": _require_int(leader, 0o16, "blinker width"),
            "blinker_height": _require_int(leader, 0o17, "blinker height"),
            "storage_character_count": storage_characters,
            "raster_q_count": len(raster_qs),
            "raster_q_sha256": hashlib.sha256(raster_q_bytes).hexdigest(),
            "character_width_table": widths is not None,
            "left_kern_table": kerns is not None,
            "indexing_table": indexes is not None,
            "next_plane_present": False,
            "characters_exist_table": exists is not None,
            "explicit_existing_code_count": (
                sum(value != 0 for value in exists) if exists is not None else None
            ),
            "explicit_existing_codes": (
                [code for code, value in enumerate(exists) if value != 0]
                if exists is not None
                else None
            ),
            "existence_semantics": (
                "explicit characters-exist table"
                if exists is not None
                else "no table; runtime treats all 128 character slots as existing"
            ),
            "bitmap_width_semantics": (
                "runtime storage/draw width; compiler padding is retained"
            ),
            "controller_mode_provenance": (
                "not encoded in the FONT leader; export follows runtime bit-array "
                "coordinates and does not assign 16-bit or 32-bit screen provenance"
            ),
        },
    )


@dataclass(frozen=True)
class _BdfGlyph:
    code: int
    advance: int
    x_offset: int
    y_offset: int
    rows: tuple[int, ...]
    width: int

    def pixels(self) -> frozenset[tuple[int, int]]:
        return frozenset(
            (self.x_offset + column, self.y_offset + len(self.rows) - 1 - row_number)
            for row_number, row in enumerate(self.rows)
            for column in range(self.width)
            if row & (1 << (self.width - 1 - column))
        )


def _parse_bdf(path: Path) -> tuple[int, int, dict[int, _BdfGlyph]]:
    lines = path.read_text(encoding="ascii").splitlines()
    size = None
    ascent = None
    glyphs: dict[int, _BdfGlyph] = {}
    index = 0
    while index < len(lines):
        line = lines[index]
        if line.startswith("SIZE "):
            size = int(line.split()[1])
        elif line.startswith("FONT_ASCENT "):
            ascent = int(line.split()[1])
        elif line.startswith("STARTCHAR "):
            code = advance = width = height = x_offset = y_offset = None
            rows: list[int] = []
            index += 1
            while index < len(lines) and lines[index] != "ENDCHAR":
                current = lines[index]
                if current.startswith("ENCODING "):
                    parts = current.split()
                    code = int(parts[-1])
                elif current.startswith("DWIDTH "):
                    advance = int(current.split()[1])
                elif current.startswith("BBX "):
                    width, height, x_offset, y_offset = map(
                        int, current.split()[1:]
                    )
                elif current == "BITMAP":
                    if height is None:
                        raise QfaslError(f"BDF {path} has BITMAP before BBX")
                    for _ in range(height):
                        index += 1
                        encoded = int(lines[index], 16)
                        byte_width = max(1, (int(width) + 7) // 8)
                        rows.append(encoded >> (byte_width * 8 - int(width)))
                index += 1
            if None in {code, advance, width, height, x_offset, y_offset}:
                raise QfaslError(f"BDF {path} has an incomplete glyph")
            glyphs[int(code)] = _BdfGlyph(
                int(code),
                int(advance),
                int(x_offset),
                int(y_offset),
                tuple(rows),
                int(width),
            )
        index += 1
    if size is None or ascent is None or not glyphs:
        raise QfaslError(f"BDF {path} is missing required font data")
    return size, ascent, glyphs


def compare_with_bdf(font: BitmapFont, path: Path) -> dict[str, object]:
    reference_height, reference_baseline, reference = _parse_bdf(path)
    compiled = {
        glyph.code: _BdfGlyph(
            glyph.code,
            glyph.advance,
            glyph.x_offset,
            glyph.y_offset,
            glyph.rows,
            glyph.bitmap_width,
        )
        for glyph in font.glyphs
    }
    missing = sorted(set(reference) - set(compiled))
    extra = sorted(set(compiled) - set(reference))
    common_codes = sorted(set(reference) & set(compiled))
    advances_differ = sorted(
        code
        for code in common_codes
        if reference[code].advance != compiled[code].advance
    )
    widths_differ = sorted(
        code
        for code in common_codes
        if reference[code].width != compiled[code].width
    )
    heights_differ = sorted(
        code
        for code in common_codes
        if len(reference[code].rows) != len(compiled[code].rows)
    )
    x_offsets_differ = sorted(
        code
        for code in common_codes
        if reference[code].x_offset != compiled[code].x_offset
    )
    y_offsets_differ = sorted(
        code
        for code in common_codes
        if reference[code].y_offset != compiled[code].y_offset
    )
    pixels_differ = sorted(
        code
        for code in common_codes
        if reference[code].pixels() != compiled[code].pixels()
    )

    def alignment_result(
        horizontal_shift: int,
    ) -> tuple[int, list[int], int, int, set[int], set[int]]:
        difference_codes = []
        reference_only_count = 0
        compiled_only_count = 0
        reference_only_columns: set[int] = set()
        compiled_only_columns: set[int] = set()
        for code in common_codes:
            reference_pixels = reference[code].pixels()
            compiled_pixels = frozenset(
                (x + horizontal_shift, y) for x, y in compiled[code].pixels()
            )
            reference_only = reference_pixels - compiled_pixels
            compiled_only = compiled_pixels - reference_pixels
            if reference_only or compiled_only:
                difference_codes.append(code)
            reference_only_count += len(reference_only)
            compiled_only_count += len(compiled_only)
            reference_only_columns.update(x for x, _y in reference_only)
            compiled_only_columns.update(x for x, _y in compiled_only)
        return (
            reference_only_count + compiled_only_count,
            difference_codes,
            reference_only_count,
            compiled_only_count,
            reference_only_columns,
            compiled_only_columns,
        )

    alignment_candidates = [
        (alignment_result(shift), shift) for shift in range(-4, 5)
    ]
    aligned, best_shift = min(
        alignment_candidates, key=lambda item: (item[0][0], abs(item[1]), item[1])
    )
    rendering_match = (
        reference_height == font.character_height
        and reference_baseline == font.baseline
        and not missing
        and not advances_differ
        and not pixels_differ
    )
    physical_cell_match = (
        rendering_match
        and not widths_differ
        and not heights_differ
        and not x_offsets_differ
        and not y_offsets_differ
    )
    return {
        "reference": str(path),
        "reference_glyph_count": len(reference),
        "compiled_glyph_count": len(compiled),
        "character_height_match": reference_height == font.character_height,
        "baseline_match": reference_baseline == font.baseline,
        "missing_reference_codes": missing,
        "extra_compiled_codes": extra,
        "advance_difference_codes": advances_differ,
        "bitmap_width_difference_codes": widths_differ,
        "bitmap_height_difference_codes": heights_differ,
        "x_offset_difference_codes": x_offsets_differ,
        "y_offset_difference_codes": y_offsets_differ,
        "pixel_difference_codes": pixels_differ,
        "source_represented_rendering_match": rendering_match,
        "source_represented_physical_cell_match": physical_cell_match,
        "best_compiled_horizontal_alignment": best_shift,
        "aligned_pixel_difference_codes": aligned[1],
        "aligned_reference_only_pixel_count": aligned[2],
        "aligned_compiled_only_pixel_count": aligned[3],
        "aligned_total_pixel_difference_count": aligned[0],
        "aligned_reference_only_columns": sorted(aligned[4]),
        "aligned_compiled_only_columns": sorted(aligned[5]),
        "comparison_scope": (
            "all glyphs represented by the source-derived BDF; rendering match "
            "means equal character height, baseline, advances, and set-pixel "
            "coordinates, while physical-cell match additionally requires equal "
            "bitmap dimensions and offsets; extra compiled runtime slots are "
            "reported but do not make either match fail"
        ),
    }


def compare_compiled_versions(
    older_font: BitmapFont,
    older_parser: FontQfaslParser,
    newer_font: BitmapFont,
    newer_parser: FontQfaslParser,
) -> dict[str, object]:
    older_symbol, older_array = _serialized_font_binding(older_parser.bindings)
    newer_symbol, newer_array = _serialized_font_binding(newer_parser.bindings)
    older_glyphs = {glyph.code: glyph for glyph in older_font.glyphs}
    newer_glyphs = {glyph.code: glyph for glyph in newer_font.glyphs}
    common_codes = sorted(set(older_glyphs) & set(newer_glyphs))

    def differing_codes(attribute: str) -> list[int]:
        return [
            code
            for code in common_codes
            if getattr(older_glyphs[code], attribute)
            != getattr(newer_glyphs[code], attribute)
        ]

    def pixels(glyph: Glyph) -> frozenset[tuple[int, int]]:
        return _BdfGlyph(
            glyph.code,
            glyph.advance,
            glyph.x_offset,
            glyph.y_offset,
            glyph.rows,
            glyph.bitmap_width,
        ).pixels()

    font_metric_fields = ("character_height", "raster_height", "baseline")
    font_metric_differences = [
        field
        for field in font_metric_fields
        if getattr(older_font, field) != getattr(newer_font, field)
    ]
    metadata_differences = sorted(
        key
        for key in set(older_font.metadata) | set(newer_font.metadata)
        if older_font.metadata.get(key) != newer_font.metadata.get(key)
    )
    advance_differences = differing_codes("advance")
    width_differences = differing_codes("bitmap_width")
    x_offset_differences = differing_codes("x_offset")
    y_offset_differences = differing_codes("y_offset")
    raster_differences = differing_codes("rows")
    pixel_differences = [
        code
        for code in common_codes
        if pixels(older_glyphs[code]) != pixels(newer_glyphs[code])
    ]
    older_only_codes = sorted(set(older_glyphs) - set(newer_glyphs))
    newer_only_codes = sorted(set(newer_glyphs) - set(older_glyphs))
    glyph_storage_and_metrics_match = not any(
        (
            font_metric_differences,
            advance_differences,
            width_differences,
            x_offset_differences,
            y_offset_differences,
            raster_differences,
            older_only_codes,
            newer_only_codes,
        )
    )

    older_leader_keys = set(older_array.leader)
    newer_leader_keys = set(newer_array.leader)
    common_leader_differences = sorted(
        index
        for index in older_leader_keys & newer_leader_keys
        if older_array.leader[index] != newer_array.leader[index]
    )
    older_only_leader_indices = sorted(older_leader_keys - newer_leader_keys)
    newer_only_leader_indices = sorted(newer_leader_keys - older_leader_keys)
    newer_only_nil_indices = [
        index
        for index in newer_only_leader_indices
        if newer_array.leader[index] is None
    ]
    raster_q_match = (
        older_font.metadata["raster_q_sha256"]
        == newer_font.metadata["raster_q_sha256"]
    )
    only_reconstructed_font_nil_tail_differs = (
        older_symbol == newer_symbol
        and glyph_storage_and_metrics_match
        and raster_q_match
        and not common_leader_differences
        and not older_only_leader_indices
        and newer_only_leader_indices == newer_only_nil_indices
        and newer_only_nil_indices
        == list(
            range(
                int(older_font.metadata["leader_length"]),
                int(newer_font.metadata["leader_length"]),
            )
        )
        and metadata_differences == ["leader_length"]
    )

    return {
        "runtime_symbol_match": older_symbol == newer_symbol,
        "font_metric_difference_fields": font_metric_differences,
        "metadata_difference_fields": metadata_differences,
        "older_only_glyph_codes": older_only_codes,
        "newer_only_glyph_codes": newer_only_codes,
        "advance_difference_codes": advance_differences,
        "bitmap_width_difference_codes": width_differences,
        "x_offset_difference_codes": x_offset_differences,
        "y_offset_difference_codes": y_offset_differences,
        "raster_row_difference_codes": raster_differences,
        "set_pixel_difference_codes": pixel_differences,
        "glyph_storage_and_metrics_match": glyph_storage_and_metrics_match,
        "raster_q_sha256_match": raster_q_match,
        "older_leader_length": older_font.metadata["leader_length"],
        "newer_leader_length": newer_font.metadata["leader_length"],
        "common_leader_difference_indices": common_leader_differences,
        "older_only_leader_indices": older_only_leader_indices,
        "newer_only_leader_indices": newer_only_leader_indices,
        "newer_only_nil_leader_indices": newer_only_nil_indices,
        "only_reconstructed_font_difference_is_newer_nil_leader_tail": bool(
            only_reconstructed_font_nil_tail_differs
        ),
        "older_qfasl_opcode_counts": {
            OPCODE_NAMES[opcode]: count
            for opcode, count in sorted(older_parser.opcode_counts.items())
        },
        "newer_qfasl_opcode_counts": {
            OPCODE_NAMES[opcode]: count
            for opcode, count in sorted(newer_parser.opcode_counts.items())
        },
        "older_end_of_whack_count": older_parser.whack_count,
        "newer_end_of_whack_count": newer_parser.whack_count,
        "comparison_scope": (
            "reconstructed runtime FONT bindings; QFASL stream operations and "
            "table layouts are inventoried separately and are not claimed to be "
            "serialization-identical"
        ),
    }


def _decode_bytes(
    raw: bytes, source_name: str, artifact_name: str, runtime_name: str
) -> tuple[BitmapFont, FontQfaslParser, list[int]]:
    words = evacuated_words(raw)
    nibbles = qfasl_nibbles(words)
    parser = FontQfaslParser(nibbles)
    bindings = parser.parse()
    font = font_from_binding(
        artifact_name, runtime_name, source_name, bindings
    )
    return font, parser, words


def _decode_file(
    path: Path, artifact_name: str, runtime_name: str
) -> tuple[BitmapFont, FontQfaslParser, list[int]]:
    return _decode_bytes(path.read_bytes(), path.name, artifact_name, runtime_name)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _reviewed_bytes(
    path: Path, expected_size: int, expected_sha256: str
) -> bytes:
    if not path.is_file():
        raise QfaslError(f"missing reviewed input: {path}")
    raw = path.read_bytes()
    if len(raw) != expected_size:
        raise QfaslError(
            f"{path.name}: expected {expected_size} bytes, found {len(raw)}"
        )
    digest = _sha256(raw)
    if digest != expected_sha256:
        raise QfaslError(
            f"{path.name}: SHA-256 {digest} does not match reviewed input"
        )
    return raw


def positive_integer(value: str) -> int:
    result = int(value)
    if result < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Recover the 19 public MIT CADR compiled font artifacts from "
            "their serialized QFASL FONT objects."
        )
    )
    parser.add_argument("source", type=Path, help="public System 46 src/lmfont")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--reference-assets",
        type=Path,
        help=(
            "source-derived MIT CADR font asset tree used for decoder and "
            "legacy-version semantic cross-checks"
        ),
    )
    parser.add_argument("--sheet-columns", type=positive_integer, default=16)
    parser.add_argument("--sheet-scale", type=positive_integer, default=2)
    parser.add_argument("--clean", action="store_true")
    args = parser.parse_args()

    if not args.source.is_dir():
        parser.error(f"not a directory: {args.source}")
    license_path = args.source.parent / "LICENSE"
    if not license_path.is_file():
        parser.error(f"source license not found: {license_path}")
    if _sha256(license_path.read_bytes()) != SOURCE_LICENSE_SHA256:
        parser.error("source license does not match the reviewed revision")

    reviewed_sources: dict[str, bytes] = {}
    reviewed_references: dict[str, bytes] = {}
    try:
        for spec in ARTIFACTS:
            reviewed_sources[spec.source_file] = _reviewed_bytes(
                args.source / spec.source_file, spec.byte_size, spec.sha256
            )
        for spec in COMPILED_VERSION_CHECKS:
            reviewed_sources[spec.older_file] = _reviewed_bytes(
                args.source / spec.older_file,
                spec.older_byte_size,
                spec.older_sha256,
            )
            reviewed_sources[spec.newer_file] = _reviewed_bytes(
                args.source / spec.newer_file,
                spec.newer_byte_size,
                spec.newer_sha256,
            )
        if args.reference_assets is not None:
            bdf_directory = args.reference_assets / "bdf"
            if not bdf_directory.is_dir():
                parser.error(f"reference BDF directory not found: {bdf_directory}")
            for spec in CROSS_CHECKS:
                reviewed_sources[spec.source_file] = _reviewed_bytes(
                    args.source / spec.source_file,
                    spec.source_byte_size,
                    spec.source_sha256,
                )
                reviewed_references[spec.reference_bdf] = _reviewed_bytes(
                    bdf_directory / spec.reference_bdf,
                    spec.reference_bdf_byte_size,
                    spec.reference_bdf_sha256,
                )
    except QfaslError as error:
        parser.error(str(error))

    owned = {"bdf", "json", "sheets", "catalog.json", "LICENSE.source"}
    try:
        prepare_output_directory(args.output, clean=args.clean, owned_names=owned)
    except ValueError as error:
        parser.error(str(error))

    records = []
    decoded: dict[str, tuple[BitmapFont, FontQfaslParser]] = {}
    for spec in ARTIFACTS:
        path = args.source / spec.source_file
        raw = reviewed_sources[spec.source_file]
        try:
            font, qfasl, words = _decode_bytes(
                raw, path.name, spec.artifact_name, spec.runtime_name
            )
        except QfaslError as error:
            parser.error(f"{spec.source_file}: {error}")
        digest = _sha256(raw)
        outputs = write_font_outputs(
            font,
            args.output,
            foundry="MIT-CADR-QFASL",
            sheet_columns=args.sheet_columns,
            sheet_scale=args.sheet_scale,
            include_json=True,
            sheet_label_radix=8,
        )
        decoded[spec.source_file] = (font, qfasl)
        canonical_words = b"".join(word.to_bytes(5, "big") for word in words)
        records.append(
            {
                "artifact_name": spec.artifact_name,
                "runtime_name": spec.runtime_name,
                "relation": spec.relation,
                "source_file": spec.source_file,
                "source_byte_size": len(raw),
                "source_sha256": digest,
                "decoded_pdp10_word_count": len(words),
                "decoded_pdp10_word_sha256": _sha256(canonical_words),
                "consumed_qfasl_nibble_count": qfasl.position,
                "padding_nibble_count": len(qfasl.nibbles) - qfasl.position,
                "end_of_whack_count": qfasl.whack_count,
                "fasl_table_segment_count": qfasl.whack_count + 1,
                "opcode_counts": {
                    OPCODE_NAMES[opcode]: count
                    for opcode, count in sorted(qfasl.opcode_counts.items())
                },
                "character_height": font.character_height,
                "raster_height": font.raster_height,
                "baseline": font.baseline,
                "glyph_count": len(font.glyphs),
                "observations": font.metadata,
                "outputs": outputs,
            }
        )

    version_comparisons = []
    for spec in COMPILED_VERSION_CHECKS:
        older_font, older_qfasl = decoded[spec.older_file]
        newer_raw = reviewed_sources[spec.newer_file]
        try:
            newer_font, newer_qfasl, _words = _decode_bytes(
                newer_raw,
                spec.newer_file,
                spec.runtime_name,
                spec.runtime_name,
            )
        except QfaslError as error:
            parser.error(f"compiled-version check {spec.newer_file}: {error}")
        comparison = compare_compiled_versions(
            older_font, older_qfasl, newer_font, newer_qfasl
        )
        comparison.update(
            {
                "older_artifact_name": spec.older_artifact_name,
                "runtime_name": spec.runtime_name,
                "older_qfasl_file": spec.older_file,
                "older_qfasl_byte_size": spec.older_byte_size,
                "older_qfasl_sha256": spec.older_sha256,
                "newer_qfasl_file": spec.newer_file,
                "newer_qfasl_byte_size": len(newer_raw),
                "newer_qfasl_sha256": _sha256(newer_raw),
            }
        )
        version_comparisons.append(comparison)

    comparisons = []
    if args.reference_assets is not None:
        bdf_directory = args.reference_assets / "bdf"
        for spec in CROSS_CHECKS:
            source_path = args.source / spec.source_file
            reference_path = bdf_directory / spec.reference_bdf
            source_raw = reviewed_sources[spec.source_file]
            reference_raw = reviewed_references[spec.reference_bdf]
            if spec.source_file in decoded:
                font, _qfasl = decoded[spec.source_file]
                artifact_name = font.name
            else:
                try:
                    font, _qfasl, _words = _decode_bytes(
                        source_raw,
                        source_path.name,
                        spec.runtime_name,
                        spec.runtime_name,
                    )
                except QfaslError as error:
                    parser.error(f"cross-check {spec.source_file}: {error}")
                artifact_name = spec.runtime_name
            comparison = compare_with_bdf(font, reference_path)
            comparison.update(
                {
                    "qfasl_file": spec.source_file,
                    "qfasl_source_byte_size": len(source_raw),
                    "qfasl_source_sha256": _sha256(source_raw),
                    "artifact_name": artifact_name,
                    "runtime_name": spec.runtime_name,
                    "reference_bdf": f"bdf/{spec.reference_bdf}",
                    "reference_bdf_byte_size": len(reference_raw),
                    "reference_bdf_sha256": _sha256(reference_raw),
                }
            )
            comparison.pop("reference")
            comparisons.append(comparison)

    shutil.copyfile(license_path, args.output / "LICENSE.source")
    catalog = {
        "schema_version": 1,
        "method": (
            "strict non-evaluating decode of the reviewed System 46 font-QFASL "
            "opcode subset into runtime FONT arrays"
        ),
        "source_repository": SOURCE_REPOSITORY,
        "source_revision": SOURCE_REVISION,
        "source_directory": "src/lmfont",
        "source_license": "src/LICENSE (three-clause BSD)",
        "source_license_copy": "LICENSE.source",
        "artifact_count": len(records),
        "runtime_logical_name_count": len({record["runtime_name"] for record in records}),
        "compiled_only_runtime_logical_name_count": 17,
        "legacy_compiled_version_count": 2,
        "font_artifacts": records,
        "compiled_version_cross_checks": version_comparisons,
        "semantic_cross_checks": comparisons,
        "cross_check_summary": {
            "comparison_count": len(comparisons),
            "compiled_version_comparison_count": len(version_comparisons),
            "source_represented_rendering_match_count": sum(
                bool(comparison["source_represented_rendering_match"])
                for comparison in comparisons
            ),
            "source_represented_physical_cell_match_count": sum(
                bool(comparison["source_represented_physical_cell_match"])
                for comparison in comparisons
            ),
            "purpose": (
                "validate the decoder against source-backed compiled files and "
                "measure N43XMS/NTOG against their surviving source-derived names"
            ),
        },
    }
    (args.output / "catalog.json").write_text(
        json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "artifact_count": len(records),
                "runtime_logical_name_count": catalog["runtime_logical_name_count"],
                "cross_check_count": len(comparisons),
                "compiled_version_cross_check_count": len(version_comparisons),
                "cross_check_rendering_match_count": catalog["cross_check_summary"][
                    "source_represented_rendering_match_count"
                ],
                "catalog": str(args.output / "catalog.json"),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        sys.stderr.close()
