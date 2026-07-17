#!/usr/bin/env python3
"""Inertly recover Genera's installed on-line help and documentation.

The input ``.sab`` files, standalone Teach Zmacs tutorial files, and every
generated JSON/text file are derived from licensed Genera media.  Keep the
output outside version control.  This decoder does not execute serialized Lisp
forms or Genera code; Lisp reader payloads are retained as strings and embedded
byte arrays are retained as base64.
"""

from __future__ import annotations

import argparse
import base64
import bisect
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any, BinaryIO


SAB_CODE_NAMES = (
    "record",
    "type-symbol",
    "function-spec",
    "field-alist",
    "field-name",
    "environment",
    "environment-name",
    "environment-modifiers",
    "attribute-name",
    "contents-list",
    "fixnum",
    "string",
    "long-string",
    "list",
    "symbol-reference",
    "uninterned-symbol-definition",
    "sage-symbol-definition",
    "package-symbol-definition",
    "doc-symbol-definition",
    "lisp-reader-source",
    "simple-command",
    "command",
    "simple-command-name",
    "command-name",
    "macro-call",
    "macro-name",
    "macro-argument-list",
    "location-pair",
    "index",
    "callee-triple-list",
    "index-item",
    "file-attribute-alist",
    "keyword-symbol-definition",
    "reference",
    "styled-string",
    "unique-id",
    "modification-history",
    "token-list",
    "file-attribute-string",
    "callee-quadruple-list",
    "picture",
    "byte-array",
    "example-record-marker",
    "extensible-reference",
    "extensible-reference-v2",
    "character",
)

SAB_RECORD = 0
SAB_TYPE_SYMBOL = 1
SAB_FUNCTION_SPEC = 2
SAB_FIELD_ALIST = 3
SAB_FIELD_NAME = 4
SAB_ENVIRONMENT = 5
SAB_ENVIRONMENT_NAME = 6
SAB_ENVIRONMENT_MODIFIERS = 7
SAB_ATTRIBUTE_NAME = 8
SAB_CONTENTS_LIST = 9
SAB_FIXNUM = 10
SAB_STRING = 11
SAB_LONG_STRING = 12
SAB_LIST = 13
SAB_SYMBOL_REFERENCE = 14
SAB_UNINTERNED_SYMBOL_DEFINITION = 15
SAB_SAGE_SYMBOL_DEFINITION = 16
SAB_PACKAGE_SYMBOL_DEFINITION = 17
SAB_DOC_SYMBOL_DEFINITION = 18
SAB_LISP_READER_SOURCE = 19
SAB_SIMPLE_COMMAND = 20
SAB_COMMAND = 21
SAB_SIMPLE_COMMAND_NAME = 22
SAB_COMMAND_NAME = 23
SAB_MACRO_CALL = 24
SAB_MACRO_NAME = 25
SAB_MACRO_ARGUMENT_LIST = 26
SAB_LOCATION_PAIR = 27
SAB_INDEX = 28
SAB_CALLEE_TRIPLE_LIST = 29
SAB_INDEX_ITEM = 30
SAB_FILE_ATTRIBUTE_ALIST = 31
SAB_KEYWORD_SYMBOL_DEFINITION = 32
SAB_REFERENCE = 33
SAB_STYLED_STRING = 34
SAB_UNIQUE_ID = 35
SAB_MODIFICATION_HISTORY = 36
SAB_TOKEN_LIST = 37
SAB_FILE_ATTRIBUTE_STRING = 38
SAB_CALLEE_QUADRUPLE_LIST = 39
SAB_PICTURE = 40
SAB_BYTE_ARRAY = 41
SAB_EXAMPLE_RECORD_MARKER = 42
SAB_EXTENSIBLE_REFERENCE = 43
SAB_EXTENSIBLE_REFERENCE_V2 = 44
SAB_CHARACTER = 45

BIN_STRING_SIMPLE = 0
BIN_STRING_RLE = 1
BIN_STRING_16_BIT = 2
BIN_STRING_GENERAL = 3
BIN_FIXNUM = 4
BIN_NEGATIVE_FIXNUM = 5
BIN_SYMBOL = 6
BIN_STYLE = 7
BIN_NIL = 8
BIN_DISPLACED_STRING = 9
BIN_KEYWORD = 10
BIN_RATIO = 11

EVACUATED_VERSION_RE = re.compile(r"^(?P<base>.*\.sab)\.~(?P<version>[0-9]+)~$", re.I)
LISP_EVACUATED_VERSION_RE = re.compile(
    r"^(?P<base>.*\.lisp)\.~(?P<version>[0-9]+)~$", re.I
)

API_DEFINITION_HEADS = {
    "DEFCONSTANT",
    "DEFGENERIC",
    "DEFFLAVOR",
    "DEFMACRO",
    "DEFMETHOD",
    "DEFPARAMETER",
    "DEFSTRUCT",
    "DEFSUBST",
    "DEFUN",
    "DEFUN-IN-FLAVOR",
    "DEFVAR",
    "DEFINE-CONDITION",
}
HELP_MARKERS = (
    "DOCUMENTATION",
    "DOCUMENTER",
    "HELP",
    "SELF-DOCUMENT",
    "TEACH-",
    "ESCAPE-KEYS",
    "SYSTEM-KEYS",
    "FUNCTION-KEYS",
    "RH-HELP-INFO",
)


class SabError(ValueError):
    """A malformed or unsupported Sage Binary construct."""


@dataclass(frozen=True)
class SabInput:
    logical_path: str
    physical_path: Path
    evacuated_version: int | None


@dataclass(frozen=True)
class StandaloneHelpSpec:
    logical_path: str
    role: str
    runtime_consumer_proven: bool
    evidence_paths: tuple[str, ...]


STANDALONE_HELP_FILES = (
    StandaloneHelpSpec(
        "examples/teach-zmacs-master.text",
        "interactive Teach Zmacs tutorial buffer copied and opened by the Teach Zmacs command",
        True,
        (
            "examples/teach-zmacs.lisp",
            "examples/sysdcl.lisp",
            "zwei/doc.lisp",
        ),
    ),
    StandaloneHelpSpec(
        "examples/teach-zmacs-info.text",
        "usage instructions distributed in the Teach Zmacs text module",
        False,
        ("examples/sysdcl.lisp",),
    ),
    StandaloneHelpSpec(
        "contributed/macsyma-421/manual/engrman.mdoc",
        "Macsyma DESCRIBE and Help hypertext documentation database",
        True,
        (
            "contributed/macsyma-421/tools/nmudoc.vbin",
            "contributed/macsyma-421/tools/lmhelp.vbin",
        ),
    ),
)


class Reader:
    """Bounds-checked little-endian byte reader."""

    def __init__(self, stream: BinaryIO, *, path: Path):
        self.stream = stream
        self.path = path

    def tell(self) -> int:
        return self.stream.tell()

    def seek(self, offset: int) -> None:
        if offset < 0:
            raise SabError(f"{self.path}: negative seek offset {offset}")
        self.stream.seek(offset)

    def read(self, length: int) -> bytes:
        if length < 0:
            raise SabError(f"{self.path}: negative byte count {length}")
        value = self.stream.read(length)
        if len(value) != length:
            raise SabError(
                f"{self.path}: truncated at byte {self.tell()}; "
                f"wanted {length}, received {len(value)}"
            )
        return value

    def u8(self) -> int:
        return self.read(1)[0]

    def uint(self, width: int) -> int:
        return int.from_bytes(self.read(width), "little")

    def u16(self) -> int:
        return self.uint(2)

    def u32(self) -> int:
        return self.uint(4)


def _symbol(package: str | None, name: str, *, interned: bool = True) -> dict[str, Any]:
    return {
        "kind": "symbol",
        "package": package,
        "name": name,
        "interned": interned,
    }


def _symbol_name(value: Any) -> str | None:
    if isinstance(value, dict) and value.get("kind") == "symbol":
        name = value.get("name")
        return name if isinstance(name, str) else None
    return None


def _decode_thin_string(value: bytes) -> str:
    # Genera's SAB thin strings retain 8-bit character subindices. Latin-1 is
    # the reversible host representation; no Unicode identity is asserted.
    return value.decode("latin-1")


class BinaryCharacterLoader:
    """Decoder for the BIN character-string encoding used by SAB code 34."""

    def __init__(self, reader: Reader):
        self.reader = reader
        self.character_types: dict[int, dict[str, Any]] = {
            0: {
                "index": 0,
                "bits": 0,
                "offset": 0,
                "charset": None,
                "style": None,
                "font": "",
            }
        }

    def _header(self) -> dict[str, Any]:
        first = self.reader.u8()
        long_flag = bool(first & 0x01)
        result = {
            "opcode": (first >> 1) & 0x1F,
            "nbytes": ((first >> 6) & 0x03) + 1,
            "dimension_count": 1,
            "leader": False,
            "leader_length_only": False,
            "named": False,
            "adjustable": False,
            "conformal": False,
            "fat_displaced": False,
        }
        if long_flag:
            second = self.reader.u8()
            result.update(
                dimension_count=second & 0x0F,
                leader=bool(second & 0x10),
                leader_length_only=bool(second & 0x20),
                adjustable=bool(second & 0x40),
            )
            if second & 0x80:
                third = self.reader.u8()
                result.update(
                    conformal=bool(third & 0x01),
                    fat_displaced=bool(third & 0x02),
                    named=bool(third & 0x04),
                )
        return result

    def _simple_string(self, width: int = 1) -> str:
        return _decode_thin_string(self.reader.read(self.reader.uint(width)))

    def _object(self) -> Any:
        header = self._header()
        opcode = header["opcode"]
        width = header["nbytes"]
        if opcode == BIN_NIL:
            return None
        if opcode in (BIN_FIXNUM, BIN_NEGATIVE_FIXNUM):
            value = self.reader.uint(width)
            return -value if opcode == BIN_NEGATIVE_FIXNUM else value
        if opcode == BIN_KEYWORD:
            return _symbol("KEYWORD", self._simple_string(width))
        if opcode == BIN_SYMBOL:
            package = self._simple_string(width)
            return _symbol(package, self._simple_string(width))
        if opcode == BIN_STYLE:
            return self._style_payload()
        if opcode == BIN_RATIO:
            return {
                "kind": "ratio",
                "numerator": self._object(),
                "denominator": self._object(),
            }
        if opcode in (BIN_STRING_SIMPLE, BIN_STRING_RLE, BIN_STRING_16_BIT):
            return self._string_from_header(header)
        if opcode == BIN_STRING_GENERAL:
            raise SabError("BIN general character-string encoding is unsupported")
        if opcode == BIN_DISPLACED_STRING:
            raise SabError("BIN displaced character strings are unsupported")
        raise SabError(f"unknown BIN character object opcode {opcode}")

    def _style_payload(self) -> dict[str, Any]:
        style_header = self.reader.u8()
        if style_header & 0x01:
            raise SabError("BIN character style definitions are unsupported")
        count = (style_header >> 3) & 0x1F
        return {
            "kind": "character-style",
            "fields": [self._object() for _ in range(count)],
        }

    def _dimensions(self, header: dict[str, Any]) -> tuple[int, int | None]:
        width = header["nbytes"]
        leader_length = self.reader.uint(width) if header["leader"] else None
        dimensions = [
            self.reader.uint(width) for _ in range(header["dimension_count"])
        ]
        if dimensions == []:
            length = 1
        else:
            length = 1
            for dimension in dimensions:
                length *= dimension
        if header["dimension_count"] != 1:
            raise SabError(
                "BIN character payload is not a one-dimensional string "
                f"(dimensions {dimensions!r})"
            )
        return length, leader_length

    def _character_type_definitions(self) -> None:
        while True:
            type_header = self.reader.u8()
            if type_header == 0:
                return
            field_count = type_header & 0x3F
            index_width = ((type_header >> 6) & 0x03) + 1
            if field_count != 6:
                raise SabError(
                    f"unsupported BIN character-type field count {field_count}"
                )
            index = self.reader.uint(index_width)
            bits = self.reader.u8()
            offset = self.reader.u8()
            charset = self._object()
            # BIN's character-type record calls LOAD-STYLE without requesting
            # an object opcode, so this begins directly with the style payload.
            style = self._style_payload()
            font = self._simple_string()
            self.character_types[index] = {
                "index": index,
                "bits": bits,
                "offset": offset,
                "charset": charset,
                "style": style,
                "font": font,
            }

    def _string_from_header(self, header: dict[str, Any]) -> Any:
        opcode = header["opcode"]
        length, leader_length = self._dimensions(header)
        if header["named"] or header["adjustable"] or header["conformal"]:
            raise SabError("unsupported BIN array flags in character string")
        if leader_length:
            if header["leader_length_only"]:
                leader = [None] * leader_length
            else:
                leader = [self._object() for _ in range(leader_length)]
        else:
            leader = []

        if opcode == BIN_STRING_SIMPLE:
            return _decode_thin_string(self.reader.read(length))

        self._character_type_definitions()
        codes = bytearray()
        runs: list[dict[str, int]] = []
        if opcode == BIN_STRING_RLE:
            while len(codes) < length:
                count = self.reader.u8()
                type_index = self.reader.u8()
                if count == 0 or len(codes) + count > length:
                    raise SabError(
                        f"invalid BIN run length {count} at character {len(codes)}"
                    )
                start = len(codes)
                codes.extend(self.reader.read(count))
                runs.append({"start": start, "end": len(codes), "type_index": type_index})
        elif opcode == BIN_STRING_16_BIT:
            start = 0
            last_type: int | None = None
            for position in range(length):
                codes.append(self.reader.u8())
                type_index = self.reader.u8()
                if type_index != last_type:
                    if last_type is not None:
                        runs.append(
                            {"start": start, "end": position, "type_index": last_type}
                        )
                    start = position
                    last_type = type_index
            if last_type is not None:
                runs.append({"start": start, "end": length, "type_index": last_type})
        else:
            raise SabError(f"unsupported BIN character-string opcode {opcode}")

        unknown = sorted({run["type_index"] for run in runs} - self.character_types.keys())
        if unknown:
            raise SabError(f"BIN string references undefined character types {unknown}")
        return {
            "kind": "styled-string",
            "text": _decode_thin_string(bytes(codes)),
            "character_codes_base64": base64.b64encode(codes).decode("ascii"),
            "runs": runs,
            "character_types": [self.character_types[i] for i in sorted(self.character_types)],
            "leader": leader,
        }

    def string(self) -> Any:
        header = self._header()
        if header["opcode"] not in (
            BIN_STRING_SIMPLE,
            BIN_STRING_RLE,
            BIN_STRING_16_BIT,
        ):
            raise SabError(
                f"expected BIN character string, found opcode {header['opcode']}"
            )
        return self._string_from_header(header)


class SabThingReader:
    """Recursive, non-evaluating decoder for one SAB symbol-table scope."""

    def __init__(self, reader: Reader):
        self.reader = reader
        self.symbols: list[dict[str, Any]] = []
        self.character_loader = BinaryCharacterLoader(reader)

    def _thin(self) -> str:
        code = self.reader.u8()
        if code == SAB_STRING:
            length = self.reader.u8()
        elif code == SAB_LONG_STRING:
            length = self.reader.u32()
        else:
            raise SabError(
                f"expected SAB thin string at byte {self.reader.tell() - 1}, "
                f"found code {code}"
            )
        return _decode_thin_string(self.reader.read(length))

    def _define_symbol(self, package: str | None, *, interned: bool = True) -> dict[str, Any]:
        value = _symbol(package, self._thin(), interned=interned)
        self.symbols.append(value)
        return value

    def _fields(self) -> list[dict[str, Any]]:
        result = []
        for _ in range(self.reader.u16()):
            name = self.thing(required=SAB_FIELD_NAME)
            result.append({"name": name, "value": self.thing()})
        return result

    def _contents(self) -> list[Any]:
        return [self.thing() for _ in range(self.reader.u16())]

    def _reference(self, kind: str, extra_fields: tuple[str, ...]) -> dict[str, Any]:
        result = {
            "kind": kind,
            "topic": self.thing(),
            "type": self.thing(required=SAB_TYPE_SYMBOL),
            "unique_id_or_index": self.thing(),
            "view": self.thing(),
        }
        for field in extra_fields:
            result[field] = self.thing()
        result["field"] = self.thing()
        return result

    def thing(self, *, required: int | None = None) -> Any:
        offset = self.reader.tell()
        code = self.reader.u8()
        if code >= len(SAB_CODE_NAMES):
            raise SabError(f"unknown SAB code {code} at byte {offset}")
        if required is not None and code != required:
            raise SabError(
                f"expected SAB {SAB_CODE_NAMES[required]} ({required}) at byte {offset}, "
                f"found {SAB_CODE_NAMES[code]} ({code})"
            )

        if code == SAB_RECORD:
            return {
                "kind": "record",
                "topic": self.thing(),
                "type": self.thing(required=SAB_TYPE_SYMBOL),
                "fields": self.thing(required=SAB_FIELD_ALIST),
            }
        if code in (SAB_TYPE_SYMBOL, SAB_FIELD_NAME, SAB_ENVIRONMENT_NAME, SAB_ATTRIBUTE_NAME):
            return self.thing()
        if code == SAB_FUNCTION_SPEC:
            return {"kind": "lisp-function-spec-source", "source": self._thin()}
        if code == SAB_FIELD_ALIST:
            return self._fields()
        if code == SAB_ENVIRONMENT:
            return {
                "kind": "environment",
                "name": self.thing(required=SAB_ENVIRONMENT_NAME),
                "modifiers": self.thing(required=SAB_ENVIRONMENT_MODIFIERS),
                "contents": self.thing(required=SAB_CONTENTS_LIST),
            }
        if code == SAB_ENVIRONMENT_MODIFIERS:
            return [
                {
                    "attribute": self.thing(required=SAB_ATTRIBUTE_NAME),
                    "value": self.thing(),
                }
                for _ in range(self.reader.u16())
            ]
        if code == SAB_CONTENTS_LIST:
            return self._contents()
        if code == SAB_FIXNUM:
            return self.reader.u32()
        if code == SAB_STRING:
            return _decode_thin_string(self.reader.read(self.reader.u8()))
        if code == SAB_LONG_STRING:
            return _decode_thin_string(self.reader.read(self.reader.u32()))
        if code == SAB_LIST:
            return [self.thing() for _ in range(self.reader.u16())]
        if code == SAB_SYMBOL_REFERENCE:
            index = self.reader.u16()
            if index >= len(self.symbols):
                raise SabError(
                    f"symbol reference {index} exceeds table size {len(self.symbols)} "
                    f"at byte {offset}"
                )
            return self.symbols[index]
        if code == SAB_UNINTERNED_SYMBOL_DEFINITION:
            return self._define_symbol(None, interned=False)
        if code == SAB_SAGE_SYMBOL_DEFINITION:
            return self._define_symbol("SAGE")
        if code == SAB_PACKAGE_SYMBOL_DEFINITION:
            package = self._thin()
            return self._define_symbol(package)
        if code == SAB_DOC_SYMBOL_DEFINITION:
            return self._define_symbol(None, interned=False)
        if code == SAB_KEYWORD_SYMBOL_DEFINITION:
            return self._define_symbol("KEYWORD")
        if code == SAB_LISP_READER_SOURCE:
            return {"kind": "lisp-reader-source", "source": self._thin()}
        if code == SAB_SIMPLE_COMMAND:
            return {
                "kind": "command",
                "name": self.thing(required=SAB_SIMPLE_COMMAND_NAME),
                "parameter": None,
            }
        if code == SAB_COMMAND:
            return {
                "kind": "command",
                "name": self.thing(required=SAB_COMMAND_NAME),
                "parameter": self.thing(),
            }
        if code in (SAB_SIMPLE_COMMAND_NAME, SAB_COMMAND_NAME, SAB_MACRO_NAME):
            return self.thing()
        if code == SAB_MACRO_CALL:
            return {
                "kind": "macro-call",
                "name": self.thing(required=SAB_MACRO_NAME),
                "arguments": self.thing(required=SAB_MACRO_ARGUMENT_LIST),
            }
        if code == SAB_MACRO_ARGUMENT_LIST:
            return self.thing()
        if code == SAB_LOCATION_PAIR:
            return {
                "kind": "location",
                "start": self.thing(required=SAB_FIXNUM),
                "end": self.thing(required=SAB_FIXNUM),
            }
        if code == SAB_INDEX:
            return [self.thing(required=SAB_INDEX_ITEM) for _ in range(self.reader.u32())]
        if code in (SAB_CALLEE_TRIPLE_LIST, SAB_CALLEE_QUADRUPLE_LIST):
            width = 3 if code == SAB_CALLEE_TRIPLE_LIST else 4
            result = []
            for _ in range(self.reader.u16()):
                row = {
                    "topic": self.thing(),
                    "type": self.thing(required=SAB_TYPE_SYMBOL),
                    "called_how": self.thing(),
                }
                if width == 4:
                    row["unique_id_or_index"] = self.thing()
                result.append(row)
            return result
        if code == SAB_INDEX_ITEM:
            return {
                "kind": "index-item",
                "topic": self.thing(),
                "type": self.thing(required=SAB_TYPE_SYMBOL),
                "fields": self._fields(),
            }
        if code == SAB_FILE_ATTRIBUTE_ALIST:
            return self.thing()
        if code == SAB_REFERENCE:
            return self._reference("reference", ())
        if code == SAB_STYLED_STRING:
            return self.character_loader.string()
        if code in (SAB_UNIQUE_ID, SAB_MODIFICATION_HISTORY, SAB_TOKEN_LIST):
            return self.thing()
        if code == SAB_FILE_ATTRIBUTE_STRING:
            return self._thin()
        if code == SAB_PICTURE:
            return {
                "kind": "picture",
                "type": self.thing(),
                "file_name": self.thing(),
                "name": self.thing(required=SAB_STRING),
                "contents": self.thing(),
            }
        if code == SAB_BYTE_ARRAY:
            payload = self.reader.read(self.reader.u32())
            return {
                "kind": "byte-array",
                "length": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "base64": base64.b64encode(payload).decode("ascii"),
            }
        if code == SAB_EXAMPLE_RECORD_MARKER:
            return {
                "kind": "example-record-marker",
                "type": self.thing(),
                "encoding": self.thing(),
            }
        if code == SAB_EXTENSIBLE_REFERENCE:
            return self._reference("extensible-reference", ("appearance",))
        if code == SAB_EXTENSIBLE_REFERENCE_V2:
            return self._reference(
                "extensible-reference-v2", ("appearance", "booleans")
            )
        if code == SAB_CHARACTER:
            return {"kind": "character", "source": self.thing()}
        raise AssertionError(f"unhandled SAB code {code}")


def _field_value(fields: list[dict[str, Any]], wanted: str) -> Any:
    for field in fields:
        if _symbol_name(field.get("name")) == wanted:
            return field.get("value")
    return None


def parse_sab_file(path: Path) -> dict[str, Any]:
    size = path.stat().st_size
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)

    with path.open("rb") as stream:
        reader = Reader(stream, path=path)
        identifier = reader.u32()
        if identifier != 0:
            raise SabError(f"{path}: Sage identifier is {identifier}, expected 0")
        version = reader.u8()
        if version not in (6, 7):
            raise SabError(f"{path}: unsupported Sage compiled format {version}")
        attributes = SabThingReader(reader).thing(required=SAB_FILE_ATTRIBUTE_ALIST)
        ps_pointer = reader.u32()
        index_pointer = reader.u32()
        if not (reader.tell() <= index_pointer < size):
            raise SabError(
                f"{path}: index pointer {index_pointer} outside {reader.tell()}..{size - 1}"
            )
        reader.seek(index_pointer)
        index = SabThingReader(reader).thing(required=SAB_INDEX)

        records = []
        locations = [_field_value(item["fields"], "LOCATION") for item in index]
        if all(
            isinstance(location, dict) and location.get("kind") == "location"
            for location in locations
        ):
            for number, location in enumerate(locations):
                start = location["start"]
                end = location["end"]
                if not (0 <= start < end <= index_pointer):
                    raise SabError(
                        f"{path}: index item {number} has invalid record range {start}..{end}"
                    )
                reader.seek(start)
                record = SabThingReader(reader).thing(required=SAB_RECORD)
                if reader.tell() != end:
                    raise SabError(
                        f"{path}: record {number} ended at {reader.tell()}, index says {end}"
                    )
                records.append(record)
        elif all(location is None for location in locations):
            # Distribution SABs use the compact form: PS points at a contiguous
            # sequence of records and the index omits redundant LOCATION fields.
            reader.seek(ps_pointer)
            for _ in index:
                records.append(SabThingReader(reader).thing(required=SAB_RECORD))
            if reader.tell() != index_pointer:
                raise SabError(
                    f"{path}: compact records ended at {reader.tell()}, "
                    f"index begins at {index_pointer}"
                )
        else:
            raise SabError(f"{path}: index mixes records with and without locations")

    return {
        "format": "Symbolics Sage Binary",
        "format_version": version,
        "source_size": size,
        "source_sha256": digest.hexdigest(),
        "ps_pointer": ps_pointer,
        "index_pointer": index_pointer,
        "file_attributes": attributes,
        "index": index,
        "records": records,
    }


def _display_symbol(value: Any) -> str:
    if not isinstance(value, dict) or value.get("kind") != "symbol":
        return ""
    package = value.get("package")
    name = value.get("name", "")
    if package == "KEYWORD":
        return f":{name}"
    if package:
        return f"{package}:{name}"
    return str(name)


LM_TEXT_CHARACTERS = {
    0o211: "\t",              # Tab
    0o212: "\n",              # Line feed
    0o214: "\n\f\n",          # Page / form feed
    0o215: "\n",              # Return / newline
    0o221: "[Abort]",
    0o222: "[Resume]",
    0o224: "[End]",
    0o225: "[Square]",
    0o226: "[Circle]",
    0o227: "[Triangle]",
    0o232: "[Scroll]",
    0o235: "[Select]",
    0o236: "[Network]",
    0o237: "[Escape]",
    0o240: "[Complete]",
    0o241: "[Symbol-Help]",
}


def _normalize_lm_text(value: str) -> str:
    result = []
    for character in value.replace("\r\n", "\n"):
        code = ord(character)
        if code in LM_TEXT_CHARACTERS:
            result.append(LM_TEXT_CHARACTERS[code])
        elif character == "\r":
            result.append("\n")
        elif character in "\n\t" or 0x20 <= code < 0x7F:
            result.append(character)
        elif code < 0x20 or code >= 0x7F:
            # The raw eight-bit subindex remains in JSON.  Avoid silently
            # claiming a Unicode identity in the convenience text rendering.
            result.append(f"[LM-char-{code:03o}]")
        else:  # pragma: no cover - the preceding ranges are exhaustive
            result.append(character)
    return "".join(result)


def _plain(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "T" if value else "NIL"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return _normalize_lm_text(value)
    if isinstance(value, list):
        return "".join(_plain(item) for item in value)
    if not isinstance(value, dict):
        return str(value)

    kind = value.get("kind")
    if kind == "symbol":
        return _display_symbol(value)
    if kind == "styled-string":
        return _plain(value.get("text", ""))
    if kind == "environment":
        return _plain(value.get("contents"))
    if kind == "command":
        name = _display_symbol(value.get("name"))
        parameter = _plain(value.get("parameter"))
        return parameter if name.endswith(":L") or name == "L" else f"@{name}({parameter})"
    if kind == "macro-call":
        return f"@{_display_symbol(value.get('name'))}({_plain(value.get('arguments'))})"
    if kind in ("reference", "extensible-reference", "extensible-reference-v2"):
        topic = _plain(value.get("topic"))
        return topic or "[reference]"
    if kind == "picture":
        return f"[picture: {_plain(value.get('name'))}]"
    if kind == "example-record-marker":
        return _plain(value.get("encoding"))
    if kind in ("lisp-reader-source", "lisp-function-spec-source"):
        return str(value.get("source", ""))
    if kind == "character":
        return _plain(value.get("source"))
    return ""


TEXT_FIELDS = (
    "SOURCE-TITLE",
    "TITLE",
    "ONELINER",
    "ARGLIST",
    "CONTENTS",
    "OPERATION",
    "NOTES",
    "RELATED",
    "KEYWORDS",
    "GLOSSARY",
    "RELEASENUMBER",
    "ABBREV",
)


def render_text(document: dict[str, Any]) -> str:
    lines = [
        "Genera Document Examiner extraction",
        "====================================",
        "",
        f"Source SHA-256: {document['source_sha256']}",
        f"Sage Binary format: {document['format_version']}",
        f"Records: {len(document['records'])}",
        "",
    ]
    for number, record in enumerate(document["records"], 1):
        topic = _plain(record.get("topic"))
        record_type = _plain(record.get("type"))
        lines.extend(
            [
                f"[{number}] {topic}",
                "-" * max(3, len(f"[{number}] {topic}")),
                f"Type: {record_type}",
            ]
        )
        for field_name in TEXT_FIELDS:
            value = _field_value(record["fields"], field_name)
            if value is None:
                continue
            rendered = _plain(value).strip()
            if rendered:
                lines.extend(["", field_name.replace("-", " ").title() + ":", rendered])
        lines.extend(["", ""])
    return "\n".join(lines).rstrip() + "\n"


def payload_statistics(value: Any) -> tuple[dict[str, int], int]:
    counts: dict[str, int] = {}
    byte_array_bytes = 0

    def visit(item: Any) -> None:
        nonlocal byte_array_bytes
        if isinstance(item, dict):
            kind = item.get("kind")
            if isinstance(kind, str):
                counts[kind] = counts.get(kind, 0) + 1
                if kind == "byte-array":
                    byte_array_bytes += int(item["length"])
            for key, child in item.items():
                if key not in ("base64", "character_codes_base64"):
                    visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(value)
    return dict(sorted(counts.items())), byte_array_bytes


def discover_sab_inputs(root: Path) -> list[SabInput]:
    if not root.is_dir():
        raise SabError(f"SCT root is not a directory: {root}")
    selected: dict[str, SabInput] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        match = EVACUATED_VERSION_RE.match(relative)
        if match:
            logical = match.group("base")
            version: int | None = int(match.group("version"))
        elif relative.lower().endswith(".sab"):
            logical = relative
            version = None
        else:
            continue
        candidate = SabInput(logical, path, version)
        previous = selected.get(logical)
        if previous is None:
            selected[logical] = candidate
            continue
        previous_rank = -1 if previous.evacuated_version is None else previous.evacuated_version
        candidate_rank = -1 if version is None else version
        if candidate_rank == previous_rank:
            raise SabError(f"ambiguous physical files for logical SAB path {logical}")
        if candidate_rank > previous_rank:
            selected[logical] = candidate
    return [selected[key] for key in sorted(selected, key=str.casefold)]


def discover_lisp_inputs(root: Path) -> list[SabInput]:
    selected: dict[str, SabInput] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        match = LISP_EVACUATED_VERSION_RE.match(relative)
        if match:
            logical = match.group("base")
            version: int | None = int(match.group("version"))
        elif relative.lower().endswith(".lisp"):
            logical = relative
            version = None
        else:
            continue
        candidate = SabInput(logical, path, version)
        previous = selected.get(logical)
        if previous is None:
            selected[logical] = candidate
            continue
        previous_rank = -1 if previous.evacuated_version is None else previous.evacuated_version
        candidate_rank = -1 if version is None else version
        if candidate_rank == previous_rank:
            raise SabError(f"ambiguous physical files for logical Lisp path {logical}")
        if candidate_rank > previous_rank:
            selected[logical] = candidate
    return [selected[key] for key in sorted(selected, key=str.casefold)]


def _select_versioned_logical_path(root: Path, logical_path: str) -> SabInput:
    """Select the greatest evacuated version for one known logical pathname."""

    logical = Path(logical_path)
    parent = root / logical.parent
    if not parent.is_dir():
        raise SabError(f"missing directory for standalone help file {logical_path}")
    candidates: list[SabInput] = []
    version_re = re.compile(
        rf"^{re.escape(logical.name)}\.~(?P<version>[0-9]+)~$", re.I
    )
    for path in parent.iterdir():
        if not path.is_file():
            continue
        if path.name.casefold() == logical.name.casefold():
            candidates.append(SabInput(logical_path, path, None))
            continue
        match = version_re.match(path.name)
        if match:
            candidates.append(
                SabInput(logical_path, path, int(match.group("version")))
            )
    if not candidates:
        raise SabError(f"missing standalone help file {logical_path}")
    candidates.sort(
        key=lambda item: (
            -1 if item.evacuated_version is None else item.evacuated_version,
            item.physical_path.name.casefold(),
        )
    )
    selected = candidates[-1]
    selected_rank = (
        -1 if selected.evacuated_version is None else selected.evacuated_version
    )
    if sum(
        (-1 if item.evacuated_version is None else item.evacuated_version)
        == selected_rank
        for item in candidates
    ) != 1:
        raise SabError(f"ambiguous physical files for logical path {logical_path}")
    return selected


def discover_standalone_help_inputs(
    root: Path,
) -> list[tuple[StandaloneHelpSpec, SabInput]]:
    return [
        (spec, _select_versioned_logical_path(root, spec.logical_path))
        for spec in STANDALONE_HELP_FILES
    ]


def extract_standalone_help(
    root: Path, output: Path
) -> dict[str, Any]:
    """Copy known standalone help losslessly and make readable convenience text."""

    inputs = discover_standalone_help_inputs(root)
    entries = []
    source_bytes = 0
    manifest_hash = hashlib.sha256()
    for spec, item in inputs:
        data = item.physical_path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        logical = Path(item.logical_path)
        raw_relative = Path("standalone/raw") / logical
        text_relative = Path("standalone/text") / logical.with_suffix(".txt")
        raw_path = output / raw_relative
        text_path = output / text_relative
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        text_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_bytes(data)
        text_path.write_text(
            _normalize_lm_text(data.decode("latin-1")), encoding="utf-8"
        )
        source_bytes += len(data)
        manifest_hash.update(item.logical_path.encode("utf-8"))
        manifest_hash.update(b"\0")
        manifest_hash.update(bytes.fromhex(digest))
        entries.append(
            {
                "logical_path": item.logical_path,
                "physical_filename": item.physical_path.name,
                "evacuated_version": item.evacuated_version,
                "source_size": len(data),
                "source_sha256": digest,
                "role": spec.role,
                "runtime_consumer_proven": spec.runtime_consumer_proven,
                "evidence_paths": list(spec.evidence_paths),
                "raw": raw_relative.as_posix(),
                "text": text_relative.as_posix(),
            }
        )
    return {
        "format": "Genera standalone on-line help recovery",
        "selection_rule": (
            "Reviewed runtime-associated logical pathnames; the greatest numeric "
            "evacuated version is selected. A false runtime_consumer_proven value "
            "marks associated documentation for which no direct display call was found."
        ),
        "file_count": len(entries),
        "runtime_consumed_file_count": sum(
            bool(entry["runtime_consumer_proven"]) for entry in entries
        ),
        "source_bytes": source_bytes,
        "source_manifest_sha256": manifest_hash.hexdigest(),
        "files": entries,
    }


def _skip_block_comment(text: str, position: int) -> int:
    depth = 1
    position += 2
    while position < len(text) and depth:
        if text.startswith("#|", position):
            depth += 1
            position += 2
        elif text.startswith("|#", position):
            depth -= 1
            position += 2
        else:
            position += 1
    return position


def _skip_string_or_bar(
    text: str, position: int, delimiter: str, escape_character: str = "\\"
) -> int:
    position += 1
    while position < len(text):
        if text[position] == escape_character:
            position += 2
        elif text[position] == delimiter:
            return position + 1
        else:
            position += 1
    return position


def _skip_character_literal(text: str, position: int) -> int:
    position += 2
    if position >= len(text):
        return position
    if text[position] in "()\";'`":
        return position + 1
    while position < len(text) and text[position] not in "() \t\r\n\f":
        position += 1
    return position


def _escaped_at(text: str, position: int, escape_character: str) -> bool:
    count = 0
    position -= 1
    while position >= 0 and text[position] == escape_character:
        count += 1
        position -= 1
    return bool(count % 2)


def top_level_form_spans(
    text: str, *, string_escape: str = "\\"
) -> tuple[list[tuple[int, int]], int, int]:
    """Return balanced top-level lists plus unmatched-open and close counts."""

    spans: list[tuple[int, int]] = []
    position = 0
    depth = 0
    unmatched_close = 0
    start = 0
    while position < len(text):
        if _escaped_at(text, position, string_escape):
            position += 1
            continue
        if text.startswith("#|", position):
            position = _skip_block_comment(text, position)
            continue
        if text.startswith(("#\\", "#/"), position):
            position = _skip_character_literal(text, position)
            continue
        character = text[position]
        if character == ";":
            newline = min(
                (candidate for candidate in (text.find("\n", position), text.find("\r", position)) if candidate >= 0),
                default=len(text),
            )
            position = newline
            continue
        if character == '"':
            position = _skip_string_or_bar(text, position, '"', string_escape)
            continue
        if character == "|":
            position = _skip_string_or_bar(text, position, "|", string_escape)
            continue
        if character == "(":
            if depth == 0:
                start = position
            depth += 1
        elif character == ")":
            if depth:
                depth -= 1
                if depth == 0:
                    spans.append((start, position + 1))
            else:
                unmatched_close += 1
        position += 1
    return spans, depth, unmatched_close


def _form_tokens(
    form: str, *, string_escape: str = "\\"
) -> tuple[str | None, list[str], list[str]]:
    """Return head, depth-one string literals, and symbol tokens."""

    position = 0
    depth = 0
    head = None
    top_strings: list[str] = []
    symbols: list[str] = []
    delimiters = "()\";'`|, \t\r\n\f"
    while position < len(form):
        if _escaped_at(form, position, string_escape):
            position += 1
            continue
        if form.startswith("#|", position):
            position = _skip_block_comment(form, position)
            continue
        if form.startswith(("#\\", "#/"), position):
            position = _skip_character_literal(form, position)
            continue
        character = form[position]
        if character == ";":
            newline = min(
                (candidate for candidate in (form.find("\n", position), form.find("\r", position)) if candidate >= 0),
                default=len(form),
            )
            position = newline
            continue
        if character == '"':
            end = _skip_string_or_bar(form, position, '"', string_escape)
            if depth == 1:
                top_strings.append(form[position:end])
            position = end
            continue
        if character == "|":
            end = _skip_string_or_bar(form, position, "|", string_escape)
            token = form[position:end]
            symbols.append(token)
            if depth == 1 and head is None:
                head = token
            position = end
            continue
        if character == "(":
            depth += 1
            position += 1
            continue
        if character == ")":
            depth = max(0, depth - 1)
            position += 1
            continue
        if character in delimiters:
            position += 1
            continue
        end = position + 1
        while end < len(form) and form[end] not in delimiters:
            if form.startswith("#|", end) or form.startswith(("#\\", "#/"), end):
                break
            end += 1
        token = form[position:end]
        symbols.append(token)
        if depth == 1 and head is None:
            head = token
        position = end
    return head, top_strings, symbols


def _unqualified_symbol(value: str | None) -> str:
    if not value:
        return ""
    return value.rsplit(":", 1)[-1].upper()


def _classify_help_form(
    head: str | None, top_strings: list[str], symbols: list[str]
) -> list[str]:
    name = _unqualified_symbol(head)
    upper_symbols = [_unqualified_symbol(symbol) for symbol in symbols]
    categories = []
    if name == "DEFCOM" and top_strings:
        categories.append("zmacs-command-documentation")
    if (
        name == "DEFINE-COMMAND"
        or (name.startswith("DEFINE-") and name.endswith("-COMMAND"))
        or name == "DEFINE-OPTION"
    ):
        categories.append("command-or-option-definition")
    if (
        (name in API_DEFINITION_HEADS or name.startswith("DEFUN-") or name.startswith("DEFMETHOD-"))
        and top_strings
    ):
        categories.append("api-docstring-candidate")
    if any(marker in symbol for symbol in upper_symbols for marker in HELP_MARKERS):
        categories.append("explicit-help-or-documentation-form")
    return categories


def scan_lisp_help_sources(root: Path, destination: Path) -> dict[str, Any]:
    inputs = discover_lisp_inputs(root)
    counts: dict[str, int] = {}
    candidate_count = 0
    unmatched_files = []
    source_bytes = 0
    manifest_hash = hashlib.sha256()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as output:
        for item in inputs:
            data = item.physical_path.read_bytes()
            source_bytes += len(data)
            digest = hashlib.sha256(data).hexdigest()
            manifest_hash.update(item.logical_path.encode("utf-8"))
            manifest_hash.update(b"\0")
            manifest_hash.update(bytes.fromhex(digest))
            text = data.decode("latin-1")
            header = text[:16384]
            common_syntax = re.search(
                r"syntax:\s*(?:(?:ansi|cl)-)?common[- ]lisp|"
                r"syntax:\s*(?:lisp\+c|minima)",
                header,
                re.I,
            )
            string_escape = "\\" if common_syntax else "/"
            spans, unmatched_open, unmatched_close = top_level_form_spans(
                text, string_escape=string_escape
            )
            if unmatched_open or unmatched_close:
                unmatched_files.append(
                    {
                        "logical_path": item.logical_path,
                        "unmatched_open": unmatched_open,
                        "unmatched_close": unmatched_close,
                    }
                )
            line_starts = [0]
            line_starts.extend(match.end() for match in re.finditer(r"\r\n|\r|\n", text))
            for start, end in spans:
                form = text[start:end]
                head, top_strings, symbols = _form_tokens(
                    form, string_escape=string_escape
                )
                categories = _classify_help_form(head, top_strings, symbols)
                if not categories:
                    continue
                candidate_count += 1
                for category in categories:
                    counts[category] = counts.get(category, 0) + 1
                record = {
                    "logical_path": item.logical_path,
                    "physical_filename": item.physical_path.name,
                    "evacuated_version": item.evacuated_version,
                    "source_sha256": digest,
                    "byte_start": start,
                    "byte_end": end,
                    "line": bisect.bisect_right(line_starts, start),
                    "head": head,
                    "categories": categories,
                    "top_level_string_literals": top_strings,
                    "source_latin1": form,
                }
                output.write(json.dumps(record, sort_keys=True, ensure_ascii=True) + "\n")
    return {
        "format": "Static Genera Lisp online-help candidate inventory",
        "scope_note": (
            "A non-evaluating lexical inventory of literal definition docstrings and "
            "forms bearing known Help/documentation registrations. Reader conditionals, "
            "macro expansion, compiled-only definitions, and runtime mutation remain "
            "outside this static proof boundary."
        ),
        "file_count": len(inputs),
        "source_bytes": source_bytes,
        "source_manifest_sha256": manifest_hash.hexdigest(),
        "candidate_form_count": candidate_count,
        "category_counts": dict(sorted(counts.items())),
        "unmatched_files": unmatched_files,
        "jsonl": destination.name,
    }


def _prepare_output(
    path: Path, *, clean: bool, owned_files: set[Path]
) -> None:
    if path.is_symlink():
        raise SabError(f"output path must not be a symbolic link: {path}")
    if path.exists() and not path.is_dir():
        raise SabError(f"output path is not a directory: {path}")
    existing = list(path.rglob("*")) if path.exists() else []
    owned_directories = {
        parent
        for owned_file in owned_files
        for parent in owned_file.parents
        if parent != Path(".")
    }
    unknown = []
    for child in existing:
        relative = child.relative_to(path)
        if child.is_symlink():
            unknown.append(relative.as_posix())
        elif child.is_file() and relative not in owned_files:
            unknown.append(relative.as_posix())
        elif child.is_dir() and relative not in owned_directories:
            unknown.append(relative.as_posix() + "/")
    if unknown:
        raise SabError(
            "output directory contains unrecognized entries: "
            + ", ".join(sorted(unknown))
        )
    if existing and not clean:
        raise SabError("output already exists; pass --clean to replace generated files")
    if clean:
        for child in sorted(
            existing, key=lambda item: len(item.relative_to(path).parts), reverse=True
        ):
            if child.is_file():
                child.unlink()
            else:
                child.rmdir()
    path.mkdir(parents=True, exist_ok=True)


def extract(
    root: Path, output: Path, *, clean: bool, include_lisp_source: bool = True
) -> dict[str, Any]:
    inputs = discover_sab_inputs(root)
    if not inputs:
        raise SabError(f"no .sab files found under {root}")
    # Resolve these before cleaning so an incomplete input tree cannot destroy a
    # previously successful local recovery.
    standalone_inputs = discover_standalone_help_inputs(root)
    owned_files = {Path("catalog.json"), Path("lisp-source-help.jsonl")}
    for item in inputs:
        relative = Path(item.logical_path)
        owned_files.add(Path("json") / relative.with_suffix(".json"))
        owned_files.add(Path("text") / relative.with_suffix(".txt"))
    for _spec, item in standalone_inputs:
        logical = Path(item.logical_path)
        owned_files.add(Path("standalone/raw") / logical)
        owned_files.add(Path("standalone/text") / logical.with_suffix(".txt"))
    _prepare_output(output, clean=clean, owned_files=owned_files)
    catalog_entries = []
    total_records = 0
    total_bytes = 0
    total_kind_counts: dict[str, int] = {}
    total_byte_array_bytes = 0
    manifest_hash = hashlib.sha256()

    for number, item in enumerate(inputs, 1):
        document = parse_sab_file(item.physical_path)
        kind_counts, byte_array_bytes = payload_statistics(document["records"])
        for kind, count in kind_counts.items():
            total_kind_counts[kind] = total_kind_counts.get(kind, 0) + count
        total_byte_array_bytes += byte_array_bytes
        relative = Path(item.logical_path)
        json_relative = Path("json") / relative.with_suffix(".json")
        text_relative = Path("text") / relative.with_suffix(".txt")
        json_path = output / json_relative
        text_path = output / text_relative
        json_path.parent.mkdir(parents=True, exist_ok=True)
        text_path.parent.mkdir(parents=True, exist_ok=True)
        document.update(
            logical_path=item.logical_path,
            evacuated_version=item.evacuated_version,
            physical_filename=item.physical_path.name,
        )
        json_path.write_text(
            json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        text_path.write_text(render_text(document), encoding="utf-8")
        record_count = len(document["records"])
        total_records += record_count
        total_bytes += document["source_size"]
        manifest_hash.update(item.logical_path.encode("utf-8"))
        manifest_hash.update(b"\0")
        manifest_hash.update(bytes.fromhex(document["source_sha256"]))
        catalog_entries.append(
            {
                "logical_path": item.logical_path,
                "physical_filename": item.physical_path.name,
                "evacuated_version": item.evacuated_version,
                "source_size": document["source_size"],
                "source_sha256": document["source_sha256"],
                "format_version": document["format_version"],
                "record_count": record_count,
                "object_kind_counts": kind_counts,
                "embedded_byte_array_bytes": byte_array_bytes,
                "json": json_relative.as_posix(),
                "text": text_relative.as_posix(),
            }
        )
        print(f"[{number:03d}/{len(inputs):03d}] {item.logical_path}: {record_count} records")

    lisp_source = (
        scan_lisp_help_sources(root, output / "lisp-source-help.jsonl")
        if include_lisp_source
        else None
    )
    standalone_help = extract_standalone_help(root, output)
    catalog = {
        "format": "Genera on-line help and documentation extraction catalog",
        "rights_notice": (
            "Inputs and generated files derive from licensed Genera media; "
            "do not commit or redistribute them."
        ),
        "selection_rule": (
            "Every .sab logical pathname below the supplied sys.sct root; for "
            "evacuated .sab.~N~ names, the greatest numeric N is selected."
        ),
        "file_count": len(inputs),
        "record_count": total_records,
        "source_bytes": total_bytes,
        "source_manifest_sha256": manifest_hash.hexdigest(),
        "object_kind_counts": dict(sorted(total_kind_counts.items())),
        "embedded_byte_array_bytes": total_byte_array_bytes,
        "standalone_help": standalone_help,
        "lisp_source_help": lisp_source,
        "files": catalog_entries,
    }
    (output / "catalog.json").write_text(
        json.dumps(catalog, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return catalog


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sys-sct",
        type=Path,
        default=Path(".lm-home/opengenera/runtime/sys.sct"),
        help="root of the licensed Genera sys.sct tree",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("build/help/genera"),
        help="ignored output directory for decoded JSON and text",
    )
    parser.add_argument(
        "--clean", action="store_true", help="replace extractor-owned output files"
    )
    parser.add_argument(
        "--skip-lisp-source",
        action="store_true",
        help="decode only SAB records and omit the static Lisp help/docstring inventory",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        catalog = extract(
            args.sys_sct,
            args.output,
            clean=args.clean,
            include_lisp_source=not args.skip_lisp_source,
        )
    except (OSError, SabError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(
        f"Recovered {catalog['record_count']} records from {catalog['file_count']} "
        f"SAB files ({catalog['source_bytes']} source bytes) into {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
