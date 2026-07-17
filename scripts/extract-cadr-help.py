#!/usr/bin/env python3
"""Recover in-program help from the public MIT CADR System 46 source tree.

The extractor is deliberately inert: it never invokes a Lisp implementation,
loads a QFASL, expands a macro, or evaluates a source form.  A small byte-level
scanner recognizes enough of the 1980 Lisp reader syntax to locate declarations
while retaining their exact source bytes.  The generated corpus is therefore a
source recovery, not a claim to reproduce the final state of a particular load
band (which could also contain compiled-only documentation or runtime changes).

The tracked default output contains only material covered by the license in the
public System 46 snapshot.  An optional LM-3 scan writes metadata only and never
copies LM-3 source or documentation payloads.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Iterable, Iterator, Sequence


SOURCE_REPOSITORY = "https://github.com/mietek/mit-cadr-system-software"
SOURCE_REVISION = "8e978d7d1704096a63edd4386a3b8326a2e584af"
SOURCE_LICENSE_SHA256 = "05b8de7c86c946cc747ab71a9aaa7dd56e37365278b5585ab685156eaa90fb92"
SOURCE_LICENSE_BYTES = 1_516
CONTENT_MANIFEST_CONVENTION = (
    "sorted UTF-8 relative path, NUL byte, binary SHA-256 file digest"
)
SOURCE_SELECTED_BYTES = 12_024_129
SOURCE_SELECTED_MANIFEST_SHA256 = (
    "efe818fc76d02c6c31afd6b0bbcdf43d89d277e871dedbee6562445be21d662d"
)
LM3_SOURCE_REPOSITORY = "https://tumbleweed.nu/r/sys"
LM3_SOURCE_REVISION = (
    "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91"
)
LM3_SOURCE_TAG = "system-303"
LM3_SCAN_FILE_COUNT = 1_044
LM3_SCAN_BYTES = 25_493_051
LM3_SCAN_MANIFEST_SHA256 = (
    "0758ba2f96f1764fe622d283e2f51277b5bf3060481b4019973767db5ad046ec"
)


@dataclass(frozen=True)
class StandaloneSpec:
    path: str
    byte_size: int
    sha256: str
    role: str


STANDALONE_FILES = (
    StandaloneSpec(
        "nzwei/basic.zwei",
        53,
        "27ff8f344dc9bd48f4b3ee0178d9eb5df92626c3ef0969e36475203b3b63cc36",
        "Help-B target; the snapshot contains an explicit historical placeholder",
    ),
    StandaloneSpec(
        "nzwei/_comnd.1",
        37_158,
        "9cbd632e763c8ff150941f84ddb082edf56f123d513ff3e6c9ff2e6a3e598f36",
        "generated ZWEI command self-documentation listing",
    ),
    StandaloneSpec(
        "nzwei/emacs.comdif",
        7_950,
        "6fec019a836715bc19be9ba36eec97e58d2fd23b4d1541ae9be07942eb0526c3",
        "EMACS-mode command differences",
    ),
    StandaloneSpec(
        "nzwei/nzwei.comdif",
        4_831,
        "d1ae94ca60fccf8ff078b3a77a0e01f359fab10e40ded085f6342b9886c2a712",
        "native ZWEI command differences",
    ),
)

NUMERIC_VERSION_RE = re.compile(r"^(?P<stem>.+)\.(?P<version>[0-9]+)$")
FUNCTION_DEFINITION_HEADS = frozenset(
    {
        "DEFUN",
        "DEFUNP",
        "DEFMACRO",
        "DEFMACRO-DISPLACE",
        "DEFSUBST",
        "DEFMETHOD",
        "DEFWRAPPER",
    }
)
DOCUMENTATION_PROPERTIES = frozenset(
    {
        "DOCUMENTATION",
        ":DOCUMENTATION",
        "DOCUMENTATION-FUNCTION",
        ":DOCUMENTATION-FUNCTION",
        "HOOK-DOCUMENTATION-FUNCTION",
        "VARIABLE-DOCUMENTATION",
        ":VARIABLE-DOCUMENTATION",
    }
)
LM3_USER_OPTION_CONSTRUCTORS = frozenset(
    {"DEFINE-ZMAIL-HARDCOPY-OPTION", "DEFINE-ZMAIL-USER-OPTION"}
)
LM3_SPECIAL_UI_DOCUMENTATION_PROPERTIES = frozenset(
    {
        ":BUTTON-DOCUMENTATION",
        ":WHO-LINE-OVERRIDE-DOCUMENTATION-STRING",
    }
)
LM3_WHO_LINE_DOCUMENTATION_SETTER = (
    ":SET-WHO-LINE-OVERRIDE-DOCUMENTATION-STRING"
)
LM3_POSITIONAL_PRODUCER_HEADS = frozenset(
    {
        "ADD-TYPEOUT-ITEM-TYPE",
        "ADD-SYSTEM-KEY",
        "ASSOCIATE-OPTION-WITH-COMMAND-DOCUMENTATION",
        "DEFCLASS",
        "DEFCOMMAND",
        "DEFCOMMENT",
        "CERROR",
        "DEFDEMO",
        "DEFGLOBAL",
        "DEFINE-CLOSED-VARIABLE",
        "DEFINE-COMBINED-METHOD-DOCUMENTATION-HANDLER",
        "DEFINE-COMMAND",
        "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION",
        "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION-UPDATER",
        "DEFINE-MAIL-TEMPLATE",
        "DEFINE-MODIFY-MACRO",
        "DEFINE-OPTION",
        "DEFINE-PEEK-MODE",
        "DEFINE-SETF-METHOD",
        "DEFINE-SETTABLE-MAIL-FILE-OPTION",
        "DEFINE-NOT-SETTABLE-MAIL-FILE-OPTION",
        "DEFINE-SITE-ALIST-USER-OPTION",
        "DEFINE-SITE-HOST-LIST",
        "DEFINE-SITE-USER-OPTION",
        "DEFINE-SITE-VARIABLE",
        "DEFINE-USER-OPTION",
        "DEFINE-USER-OPTION-1",
        "DEFINE-USER-OPTION-ALIST",
        "DEFINE-ZMAIL-GLOBAL",
        "DEFINE-ZMAIL-TOP-LEVEL-COMMAND",
        "DEFSIGNAL",
        "DEFSIGNAL-EXPLICIT",
        "DEFSIGNAL-FORMAT",
        "DEFRESOURCE",
        "DEFVAR-SITE-ALIST-USER-OPTION",
        "DEFVAR-SITE-USER-OPTION",
        "DEFVAR-USER-OPTION",
        "DEFWINDOW-RESOURCE",
        "MULTIPLE-CERROR",
        *LM3_USER_OPTION_CONSTRUCTORS,
    }
)
HELP_NAME_RE = re.compile(r"(?:^|[-:*])(HELP|DOCUMENT|DESCRIBE)(?:[-:*]|$)")
DOCUMENTATION_NAME_RE = re.compile(
    r"(?:^|[-:*])DOCUMENTATION(?:[-:*]|$)"
)
MOUSE_NAME_RE = re.compile(r"(?:^|[-:*])MOUSE(?:[-:*]|$)")
MENU_NAME_RE = re.compile(r"(?:^|[-:*])MENU(?:[-:*]|$)")
KNOWN_HELP_TABLES = frozenset(
    {
        "*COM-DOCUMENTATION-ALIST*",
        "*ESCAPE-KEYS*",
        "*SYSTEM-KEYS*",
        "KBD-ESC-REPOSITORY",
        "PEEK-MODE-ALIST",
        "PEEK-DEFAULT-MODE-ALIST",
        "EH-HELP-LIST",
    }
)
HELP_KEY_DISPATCH_ALLOWLIST = frozenset(
    {
        ("lcadr/packed.112", "PACKED"),
        ("lispm/qmisc.281", "FDEFINE"),
        ("lispm2/eh.317", "EH-COMMAND-LOOP-READ"),
        ("lispm2/peek.55", "PEEK-WINDOW-CLASS :BORN"),
        ("lispm2/step.45", "STEP-CMDR"),
        ("lmcons/dcheck.81", "DC-GET-ADDR-SPEC"),
        (
            "lmio/comlnk.50",
            "COM-LINK-FRAME-CLASS :LOCAL-LISTEN-TOP-LEVEL",
        ),
        ("lmio/supdup.196", "SUPDUP-CLASS :HANDLE-ESCAPE"),
        ("lmio1/fed.165", "FED-WINDOW-CLASS :COMMAND"),
        ("lmio1/hacks.189", "MUNCH"),
        ("lmio1/xfed.4", "FED-WINDOW-CLASS :COMMAND"),
        ("lmwin/basstr.163", "KBD-SYS-1"),
        ("lmwin/ehc.36", "COMMAND-LOOP-READ"),
        ("lmwin/peek.75", "PEEK-TOP-LEVEL"),
        ("lmwin/supdup.105", "BASIC-NVT :HANDLE-ESCAPE"),
        ("nzwei/comtab.115", "INITIALIZE-MINI-BUFFER"),
        ("nzwei/comtab.115", "INITIALIZE-STANDARD-COMTABS"),
        ("nzwei/font.23", "INPUT-FONT-NAME"),
        ("nzwei/kbdmac.22", "MACRO-TYI"),
    }
)
LM3_HELP_KEY_DISPATCH_ALLOWLIST = frozenset(
    {
        ("cc/cc.lisp", "CC-TYPE-IN"),
        ("cc/ccwhy.lisp", "/? CC-COLON-CMD"),
        ("cc/dcheck.lisp", "DC-GET-ADDR-SPEC"),
        ("file/fsguts.lisp", "DBG-EDIT"),
        ("io/dledit.lisp", "EDIT-DISK-LABEL"),
        ("io1/fquery.lisp", "READLINE-FQUERY-FUNCTION"),
        ("io1/fquery.lisp", "TYI-FQUERY-FUNCTION"),
        ("io1/hacks.lisp", "MUNCH"),
        ("network/edit/data-types.lisp", "QUERY-COMMAND-CHAR-P"),
        ("network/edit/main.lisp", "COMMAND-LOOP-PROCESS-THING"),
        (
            "network/edit/patch-3-2.lisp",
            "COMMAND-LOOP-PROCESS-THING",
        ),
        ("patch/system-100-21.lisp", "INITIALIZE-STANDARD-COMTABS"),
        ("patch/system-100-5.lisp", "EDIT-DISK-LABEL"),
        ("patch/system-300-4.lisp", "READLINE-FQUERY-FUNCTION"),
        ("patch/system-300-4.lisp", "TYI-FQUERY-FUNCTION"),
        ("patch/system-98-13.lisp", "KBD-SYS-1"),
        ("patch/system-98-14.lisp", "INSPECT-COMMAND-LOOP"),
        ("patch/system-98-14.lisp", "KBD-SYS-1"),
        ("patch/system-98-2.lisp", "SUPDUP-IO-BUFFER-OUTPUT-FUNCTION"),
        ("patch/system-98-26.lisp", "READLINE-FQUERY-FUNCTION"),
        ("patch/system-98-27.lisp", "INSPECT-COMMAND-LOOP"),
        ("patch/system-98-29.lisp", "TYI-FQUERY-FUNCTION"),
        ("patch/system-98-3.lisp", "QUERY-REPLACE-INTERNAL"),
        ("patch/system-98-33.lisp", "VIEW-WINDOW"),
        ("patch/system-98-49.lisp", "COM-STRING-SEARCH-INTERNAL"),
        ("patch/system-98-49.lisp", "QUERY-REPLACE-INTERNAL"),
        ("patch/system-98-49.lisp", "STEP-CMDR"),
        ("patch/system-98-57.lisp", "INPUT-FONT-NAME"),
        ("patch/system-98-7.lisp", "INSPECT-COMMAND-LOOP"),
        ("patch/system-99-10.lisp", "GET-REGISTER-NAME"),
        ("patch/system-99-18.lisp", "TYI-FQUERY-FUNCTION"),
        ("patch/system-99-31.lisp", "INCREMENTAL-SEARCH"),
        ("patch/system-99-5.lisp", "STEP-CMDR"),
        ("patch/system-99-7.lisp", "INSPECT-COMMAND-LOOP"),
        ("sys2/step.lisp", "STEP-CMDR"),
        ("tape/patch-24-1.lisp", "PARTITION-SEARCHER"),
        ("tape/tape.lisp", "PARTITION-SEARCHER"),
        ("tape/tape.lisp", "PROMPT-FOR-REWIND-WITH-STATE"),
        ("window/basstr.lisp", "KBD-SYS-1"),
        ("window/inspct.lisp", "INSPECT-COMMAND-LOOP"),
        ("window/peek.lisp", "PEEK-STANDALONE-TOP-LEVEL"),
        ("window/peek.lisp", "PEEK-TOP-LEVEL"),
        ("window/supdup.lisp", "BASIC-NVT :ALLOW-ESCAPE"),
        ("window/supdup.lisp", "BASIC-NVT :HANDLE-ESCAPE"),
        ("window/supdup.lisp", "SUPDUP-IO-BUFFER-OUTPUT-FUNCTION"),
        ("window/telnet-front-hack.lisp", "BASIC-NVT :ALLOW-ESCAPE"),
        ("window/telnet-front-hack.lisp", "BASIC-NVT :HANDLE-ESCAPE"),
        (
            "window/telnet-front-hack.lisp",
            "SUPDUP-IO-BUFFER-OUTPUT-FUNCTION",
        ),
        ("zmail/comnds.lisp", "INITIALIZE-ZMAIL-COMTABS"),
        ("zmail/patch/zmail-74-13.lisp", "INITIALIZE-ZMAIL-COMTABS"),
        ("zmail/patch/zmail-74-14.lisp", "INITIALIZE-ZMAIL-COMTABS"),
        ("zwei/comd.lisp", "GET-REGISTER-NAME"),
        ("zwei/coms.lisp", "COM-STRING-SEARCH-INTERNAL"),
        ("zwei/coms.lisp", "INCREMENTAL-SEARCH"),
        ("zwei/coms.lisp", "QUERY-REPLACE-INTERNAL"),
        ("zwei/comtab.lisp", "INITIALIZE-MINI-BUFFER"),
        ("zwei/comtab.lisp", "INITIALIZE-STANDARD-COMTABS"),
        ("zwei/displa.lisp", "VIEW-WINDOW"),
        ("zwei/font.lisp", "INPUT-FONT-NAME"),
        ("zwei/kbdmac.lisp", "MACRO-TYI"),
        ("zwei/patch/zwei-126-20.lisp", "SOURCE-COMPARE-MERGE-QUERY"),
        ("zwei/patch/zwei-126-20.lisp", "SOURCE-COMPARE-MERGE-QUERY-1"),
        ("zwei/search.lisp", "INITIALIZE-EXTENDED-SEARCH"),
        ("zwei/zmacs.lisp", "SOURCE-COMPARE-MERGE-QUERY"),
        ("zwei/zmacs.lisp", "SOURCE-COMPARE-MERGE-QUERY-1"),
    }
)
LM3_CASE_DOCUMENTATION_ALLOWLIST = frozenset(
    {
        (
            "eh/ehf.lisp",
            "MULTIPLE-CERROR :AROUND :PROCEED-ASKING-USER",
        ),
        ("sys2/flavor.lisp", "CASE-METHOD-DEFAULT-HANDLER"),
    }
)
LM3_DIRECT_UI_DOCUMENTATION_BINDINGS = {
    "WHO-LINE-MOUSE-GRABBED-DOCUMENTATION": {
        "kind": "mouse-grabbed-documentation-binding",
        "heads": frozenset({"LET-GLOBALLY", "SETQ"}),
    },
    "SPECIAL-COMMAND-MOUSE-DOCUMENTATION": {
        "kind": "special-command-mouse-documentation-binding",
        "heads": frozenset({"SETQ"}),
    },
    "*GLOBAL-MOUSE-CHAR-BLINKER-DOCUMENTATION-STRING*": {
        "kind": "mouse-char-blinker-documentation-binding",
        "heads": frozenset({"LET-GLOBALLY", "SETQ"}),
    },
    "WHO-LINE-OVERRIDE-DOCUMENTATION-STRING": {
        "kind": "who-line-override-documentation-binding",
        "heads": frozenset({"LET-GLOBALLY"}),
    },
    "DOCUMENTATION-STRINGS": {
        "kind": "inspect-documentation-builder",
        "heads": frozenset({"SETQ"}),
        "paths": frozenset({"window/inspct.lisp"}),
    },
}
LM3_RUNTIME_HELP_INITIALIZERS = {
    ("io1/conver.lisp", "*CONVERSE-RECEIVE-MODE-DOCUMENTATION*"): (
        "documentation-variable-initializer",
        frozenset({"help-handler", "option"}),
    ),
    ("zwei/coms.lisp", "*STRING-SEARCH-OPTION-DOCUMENTATION*"): (
        "documentation-variable-initializer",
        frozenset({"command", "help-handler"}),
    ),
    ("zmail/filter.lisp", "*FILTER-DEFINITION-SUMMARY-DOCUMENTATION*"): (
        "documentation-variable-initializer",
        frozenset({"help-handler", "mouse"}),
    ),
    ("zmail/comnds.lisp", "*COM-ZMAIL-DOCUMENTATION-ALIST*"): (
        "command-documentation-table-initializer",
        frozenset({"command", "help-table"}),
    ),
}
LM3_COMPUTED_DOCUMENTATION_ENDPOINTS = {
    ("window/wholin.lisp", "WHO-LINE-DOCUMENTATION-FUNCTION"): (
        "who-line-documentation-renderer",
        frozenset({"help-handler", "mouse"}),
    ),
    ("zwei/coms.lisp", "KIND-OF-QUERY-REPLACE-DOCUMENTATION"): (
        "zwei-command-documentation-handler",
        frozenset({"command", "help-handler"}),
    ),
}
LM3_STANDALONE_NAMES = frozenset(
    {
        "teach-zmacs.text",
        "emacs.comdif",
        "cc.help",
        "newtape.info",
        "newtape-1.info",
        "newtape-2.info",
        "newtape.doc",
    }
)
LM3_SCAN_SUFFIXES = frozenset(
    {".lisp", ".text", ".comdif", ".help", ".info", ".doc"}
)
LM3_IGNORED_PARTS = frozenset({".git", "patches", "historical", "archive"})
PINNED_EXPECTATIONS = {
    "highest_numeric_version_file_count": 463,
    "record_count": 949,
    "context_count": 944,
    "source_file_count": 89,
    "concrete_defcom_count": 347,
    "generated_command_template_count": 1,
    "kind_counts": {
        "command-name-property": 8,
        "documentation-message-handler": 6,
        "documentation-method": 1,
        "documentation-property": 32,
        "flavor-documentation": 135,
        "function-docstring": 250,
        "help-handler": 60,
        "help-key-handler": 18,
        "help-table": 9,
        "key-registration": 18,
        "zwei-command": 348,
        "zwei-mode-command": 17,
        "zwei-variable": 47,
    },
    "category_counts": {
        "api": 417,
        "command": 373,
        "help-handler": 89,
        "help-table": 6,
        "key": 21,
        "menu": 19,
        "mode": 17,
        "mouse": 26,
        "option": 47,
    },
    "documentation_source_kind_counts": {
        "computed-or-handler": 94,
        "literal-string": 825,
        "nonliteral-form": 30,
    },
}
LM3_PINNED_EXPECTATIONS = {
    "file_count": 562,
    "record_count": 10_090,
    "unique_source_form_count": 10_073,
    "generated_template_count": 188,
    "standalone_candidate_count": 8,
    "reviewed_help_dispatch_count": 65,
    "category_file_counts": {
        "api": 479,
        "command": 132,
        "documentation-reference": 1,
        "help-handler": 149,
        "help-table": 16,
        "key": 20,
        "menu": 92,
        "mode": 12,
        "mouse": 64,
        "option": 16,
        "standalone-candidate": 8,
    },
    "kind_counts": {
        "application-class-documentation": 5,
        "application-command-documentation": 17,
        "application-menu-documentation": 4,
        "button-documentation-property": 1,
        "case-documentation-clause": 2,
        "cerror-proceed-documentation": 29,
        "closed-variable-documentation": 1,
        "combined-method-documentation-handler": 16,
        "command-documentation-option-association": 17,
        "command-documentation-table-initializer": 1,
        "command-name-property": 7,
        "command-who-line-documentation": 13,
        "command-who-line-documentation-updater": 29,
        "demo-documentation": 74,
        "documentation-endpoint-method": 21,
        "documentation-message-clause": 7,
        "documentation-message-handler": 4,
        "documentation-method": 24,
        "documentation-property": 16,
        "documentation-setf": 378,
        "documentation-variable-initializer": 3,
        "documentation-wrapper": 1,
        "flavor-documentation": 244,
        "function-docstring": 4_812,
        "global-variable-documentation": 28,
        "help-handler": 141,
        "help-key-handler": 55,
        "help-table": 31,
        "inspect-documentation-builder": 1,
        "modify-macro-documentation": 5,
        "mouse-char-blinker-documentation-binding": 4,
        "mouse-documentation-property": 5,
        "mouse-grabbed-documentation-binding": 12,
        "peek-mode-documentation": 12,
        "peek-mode-menu-documentation": 12,
        "proceed-option-documentation": 13,
        "resource-documentation": 4,
        "signal-documentation": 141,
        "site-variable-documentation": 8,
        "special-command-mouse-documentation-binding": 5,
        "structure-documentation": 15,
        "structure-slot-documentation": 405,
        "system-key-registration": 14,
        "tape-command-mouse-documentation": 29,
        "tape-option-documentation": 16,
        "type-documentation": 1,
        "typeout-item-documentation": 43,
        "ui-documentation-property": 532,
        "user-option-alist-documentation": 1,
        "user-option-presentation": 95,
        "variable-documentation": 1_525,
        "who-line-documentation-clause": 3,
        "who-line-documentation-property": 3,
        "who-line-documentation-renderer": 1,
        "who-line-override-documentation-property": 2,
        "who-line-override-documentation-setter": 2,
        "who-line-override-documentation-binding": 2,
        "zmail-command-documentation": 94,
        "zmail-global-documentation": 6,
        "zwei-command": 985,
        "zwei-command-documentation-function": 4,
        "zwei-command-documentation-handler": 1,
        "zwei-mode-command": 38,
        "zwei-variable": 70,
    },
    "documentation_source_kind_counts": {
        "computed-or-handler": 291,
        "literal-string": 9_609,
        "nonliteral-form": 190,
    },
    "producer_form_counts": {
        "ADD-SYSTEM-KEY": 14,
        "ADD-TYPEOUT-ITEM-TYPE": 43,
        "ASSOCIATE-OPTION-WITH-COMMAND-DOCUMENTATION": 17,
        "CERROR": 291,
        "DEFCLASS": 14,
        "DEFCOMMAND": 17,
        "DEFCOMMENT": 4,
        "DEFDEMO": 25,
        "DEFGLOBAL": 28,
        "DEFINE-CLOSED-VARIABLE": 10,
        "DEFINE-COMBINED-METHOD-DOCUMENTATION-HANDLER": 16,
        "DEFINE-COMMAND": 29,
        "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION": 13,
        "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION-UPDATER": 29,
        "DEFINE-MAIL-TEMPLATE": 0,
        "DEFINE-MODIFY-MACRO": 5,
        "DEFINE-NOT-SETTABLE-MAIL-FILE-OPTION": 3,
        "DEFINE-OPTION": 16,
        "DEFINE-PEEK-MODE": 12,
        "DEFINE-SETF-METHOD": 33,
        "DEFINE-SETTABLE-MAIL-FILE-OPTION": 10,
        "DEFINE-SITE-ALIST-USER-OPTION": 2,
        "DEFINE-SITE-HOST-LIST": 4,
        "DEFINE-SITE-USER-OPTION": 0,
        "DEFINE-SITE-VARIABLE": 15,
        "DEFINE-USER-OPTION": 0,
        "DEFINE-USER-OPTION-1": 8,
        "DEFINE-USER-OPTION-ALIST": 2,
        "DEFINE-ZMAIL-GLOBAL": 29,
        "DEFINE-ZMAIL-HARDCOPY-OPTION": 3,
        "DEFINE-ZMAIL-TOP-LEVEL-COMMAND": 94,
        "DEFINE-ZMAIL-USER-OPTION": 71,
        "DEFRESOURCE": 26,
        "DEFSIGNAL": 139,
        "DEFSIGNAL-EXPLICIT": 9,
        "DEFSIGNAL-FORMAT": 0,
        "DEFVAR-SITE-ALIST-USER-OPTION": 0,
        "DEFVAR-SITE-USER-OPTION": 0,
        "DEFVAR-USER-OPTION": 1,
        "DEFWINDOW-RESOURCE": 35,
        "MULTIPLE-CERROR": 6,
    },
    "documentation_keyword_candidate_count": 1_196,
    "documentation_keyword_excluded_non_help_count": 3,
    "documentation_keyword_semantic_field_count": 1_193,
}
class HelpExtractionError(ValueError):
    """A source tree or source form is not suitable for deterministic recovery."""


@dataclass
class Node:
    """One inert source expression with byte offsets into its source file."""

    kind: str
    start: int
    end: int
    children: list["Node"] = field(default_factory=list)
    prefix: bytes | None = None


@dataclass(frozen=True)
class VersionedSource:
    logical_stem: str
    version: int
    path: Path
    relative_path: str


@dataclass
class Match:
    categories: set[str]
    kind: str
    name: str
    node: Node
    root: Node
    documentation_node: Node | None
    generated_template: bool


def _sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _content_manifest(
    entries: Iterable[tuple[str, bytes]],
) -> tuple[int, int, str]:
    digest = hashlib.sha256()
    count = 0
    byte_size = 0
    for relative_path, raw in sorted(entries):
        encoded_path = relative_path.encode("utf-8")
        digest.update(encoded_path)
        digest.update(b"\0")
        digest.update(hashlib.sha256(raw).digest())
        count += 1
        byte_size += len(raw)
    return count, byte_size, digest.hexdigest()


def _line_number(raw: bytes, offset: int) -> int:
    return raw.count(b"\n", 0, offset) + 1


def _display_bytes(raw: bytes, *, limit: int | None = None) -> str:
    """Render historical bytes reversibly enough for Markdown and JSON labels."""

    text = raw.decode("latin-1")
    pieces: list[str] = []
    for char in text:
        code = ord(char)
        if char == "\n":
            pieces.append(" ")
        elif char == "\t":
            pieces.append(" ")
        elif code < 0x20 or code == 0x7F:
            pieces.append(f"<0x{code:02x}>")
        elif 0x80 <= code <= 0x9F:
            pieces.append(f"<0x{code:02x}>")
        else:
            pieces.append(char)
    result = " ".join("".join(pieces).split())
    if limit is not None and len(result) > limit:
        return result[: max(0, limit - 1)] + "…"
    return result


def _decode_lisp_string(raw: bytes, *, escape_byte: int = ord("/")) -> str:
    """Decode a source string without assigning Unicode identity to 8-bit bytes."""

    if len(raw) < 2 or not (raw.startswith(b'"') and raw.endswith(b'"')):
        raise HelpExtractionError("not a complete Lisp string")
    result = bytearray()
    position = 1
    while position < len(raw) - 1:
        byte = raw[position]
        if byte == escape_byte and position + 1 < len(raw) - 1:
            position += 1
            byte = raw[position]
        result.append(byte)
        position += 1
    return result.decode("latin-1")


class InertSExpressionParser:
    """Small parser for source boundaries; it never interns or evaluates data."""

    # Byte 0x0b occurs as a historical character modifier inside a ZWEI
    # command symbol (COM-<0x0b>R-DIRED); treating host ASCII VT as whitespace
    # would shift that declaration's documentation argument.
    _WHITESPACE = b" \t\r\n\f"

    def __init__(
        self, raw: bytes, *, path: str, strict_block_comments: bool = True
    ):
        self.raw = raw
        self.path = path
        self.length = len(raw)
        self.strict_block_comments = strict_block_comments
        # The older ZL/T readtables use slash quoting.  A small, explicit
        # subset of the later tree declares Readtable:CL and uses backslash
        # quoting instead.  Treating backslash as an escape globally corrupts
        # valid ZL strings whose final printable character is a backslash.
        self.escape_byte = (
            ord("\\")
            if re.search(
                rb"\bREADTABLE\s*:\s*CL\b", raw[:1024], re.IGNORECASE
            )
            else ord("/")
        )

    def _skip_space_and_comments(self, position: int, limit: int) -> int:
        while position < limit:
            if self.raw[position] in self._WHITESPACE:
                position += 1
                continue
            if self.raw[position] == ord(";"):
                newline = self.raw.find(b"\n", position + 1, limit)
                position = limit if newline < 0 else newline + 1
                continue
            if self.raw[position : position + 2] == b"#|":
                start = position
                position += 2
                depth = 1
                while position < limit and depth:
                    marker = self.raw[position : position + 2]
                    if marker == b"#|":
                        depth += 1
                        position += 2
                    elif marker == b"|#":
                        depth -= 1
                        position += 2
                    else:
                        position += 1
                if depth:
                    if not self.strict_block_comments:
                        return limit
                    raise HelpExtractionError(
                        f"{self.path}:{_line_number(self.raw, start)}: "
                        "unterminated block comment"
                    )
                continue
            break
        return position

    def _quoted(self, position: int, limit: int, delimiter: int, kind: str) -> tuple[Node, int]:
        start = position
        position += 1
        while position < limit:
            byte = self.raw[position]
            if byte == self.escape_byte and position + 1 < limit:
                position += 2
                continue
            position += 1
            if byte == delimiter:
                return Node(kind, start, position), position
        raise HelpExtractionError(
            f"{self.path}:{_line_number(self.raw, start)}: unterminated {kind}"
        )

    def _atom(self, position: int, limit: int) -> tuple[Node, int]:
        start = position
        while position < limit:
            byte = self.raw[position]
            if self.raw[position : position + 2] == b"#|":
                break
            if byte in self._WHITESPACE or byte in b"();\"'` ,":
                break
            if byte == self.escape_byte and position + 1 < limit:
                position += 2
                continue
            # #/ introduces exactly one (possibly non-ASCII) Lisp character.
            if self.raw[position : position + 2] == b"#/":
                position = min(limit, position + 3)
                continue
            # #\\ accepts either a one-character delimiter or a character name.
            if self.raw[position : position + 2] == b"#\\":
                position += 2
                if position < limit and self.raw[position] in b"()":
                    position += 1
                else:
                    while (
                        position < limit
                        and self.raw[position] not in self._WHITESPACE + b"();"
                    ):
                        position += 1
                continue
            position += 1
        if position == start:
            position += 1
        return Node("atom", start, position), position

    def expression(self, position: int, limit: int) -> tuple[Node, int]:
        position = self._skip_space_and_comments(position, limit)
        if position >= limit:
            raise HelpExtractionError(f"{self.path}: expected expression at end of input")
        byte = self.raw[position]
        if byte == ord("("):
            return self.list_expression(position, limit)
        if byte == ord('"'):
            return self._quoted(position, limit, ord('"'), "string")
        if byte == ord("|"):
            return self._quoted(position, limit, ord("|"), "atom")
        if byte in (ord("'"), ord("`")) or (
            byte == ord(",") and position + 1 < limit
        ):
            start = position
            if byte == ord(",") and self.raw[position : position + 2] == b",@":
                position += 2
                prefix = b",@"
            else:
                position += 1
                prefix = bytes((byte,))
            child, position = self.expression(position, limit)
            return Node("prefix", start, position, [child], prefix), position
        if self.raw[position : position + 2] == b"#'":
            start = position
            child, position = self.expression(position + 2, limit)
            return Node("prefix", start, position, [child], b"#'"), position
        if self.raw[position : position + 2] == b"#.":
            start = position
            child, position = self.expression(position + 2, limit)
            return Node("prefix", start, position, [child], b"#."), position
        dispatch_prefix = self.raw[position : position + 2].upper()
        dispatch_following = self.raw[position + 2 : position + 3]
        if (
            dispatch_prefix == b"#P"
            and dispatch_following in bytes((ord('"'),)) + self._WHITESPACE
        ) or (
            dispatch_prefix in {b"#C", b"#S"}
            and dispatch_following in b"(" + self._WHITESPACE
        ):
            start = position
            prefix = dispatch_prefix
            child, position = self.expression(position + 2, limit)
            return Node("prefix", start, position, [child], prefix), position
        if self.raw[position : position + 2] == b"#(":
            start = position
            child, position = self.list_expression(position + 1, limit)
            return Node("prefix", start, position, [child], b"#("), position
        if byte == ord("#"):
            dispatch_end = position + 1
            while dispatch_end < limit and self.raw[dispatch_end : dispatch_end + 1].isdigit():
                dispatch_end += 1
            if (
                dispatch_end > position + 1
                and self.raw[dispatch_end : dispatch_end + 1].upper() == b"A"
            ):
                start = position
                dispatch_end += 1
                prefix = self.raw[start:dispatch_end].upper()
                child, position = self.expression(dispatch_end, limit)
                return Node("prefix", start, position, [child], prefix), position
            radix_match = re.match(
                rb"#(?:[OBX]|[0-9]+R)",
                self.raw[position:limit],
                re.IGNORECASE,
            )
            if radix_match is not None:
                dispatch_end = position + radix_match.end()
                following = self.raw[dispatch_end : dispatch_end + 1]
                if following in b"(" + self._WHITESPACE:
                    start = position
                    prefix = self.raw[start:dispatch_end].upper()
                    child, position = self.expression(dispatch_end, limit)
                    return (
                        Node("prefix", start, position, [child], prefix),
                        position,
                    )
            if (
                dispatch_end > position + 1
                and self.raw[dispatch_end : dispatch_end + 1] == b"="
            ):
                start = position
                dispatch_end += 1
                prefix = self.raw[start:dispatch_end]
                child, position = self.expression(dispatch_end, limit)
                return Node("prefix", start, position, [child], prefix), position
        sharp_prefix = self.raw[position : position + 2].upper()
        if sharp_prefix in {b"#M", b"#Q"} and (
            position + 2 == limit
            or self.raw[position + 2] in self._WHITESPACE + b"("
        ):
            start = position
            child, position = self.expression(position + 2, limit)
            return Node("prefix", start, position, [child], sharp_prefix), position
        if sharp_prefix in {b"#+", b"#-"}:
            start = position
            feature, position = self.expression(position + 2, limit)
            child, position = self.expression(position, limit)
            return Node(
                "prefix", start, position, [feature, child], sharp_prefix
            ), position
        if byte == ord(")"):
            raise HelpExtractionError(
                f"{self.path}:{_line_number(self.raw, position)}: unexpected close parenthesis"
            )
        atom, atom_end = self._atom(position, limit)
        atom_source = _node_raw(self.raw, atom)
        if (
            self.escape_byte == ord("/")
            and re.fullmatch(
                rb"[A-Z0-9*+\-<>=!?$%&_~.]+#?(?:::|:)",
                atom_source,
                re.IGNORECASE,
            )
            is not None
        ):
            following = self._skip_space_and_comments(atom_end, limit)
            if following < limit and self.raw[following] != ord(")"):
                child, end = self.expression(atom_end, limit)
                return (
                    Node(
                        "prefix",
                        atom.start,
                        end,
                        [child],
                        atom_source.upper(),
                    ),
                    end,
                )
        return atom, atom_end

    def list_expression(self, position: int, limit: int) -> tuple[Node, int]:
        start = position
        position += 1
        children: list[Node] = []
        while True:
            position = self._skip_space_and_comments(position, limit)
            if position >= limit:
                raise HelpExtractionError(
                    f"{self.path}:{_line_number(self.raw, start)}: unterminated list"
                )
            if self.raw[position] == ord(")"):
                position += 1
                return Node("list", start, position, children), position
            child, position = self.expression(position, limit)
            children.append(child)

    def top_level_lists(self) -> list[Node]:
        """Read top-level forms containing lists, ignoring archival prose."""

        result: list[Node] = []
        position = 0
        while position < self.length:
            position = self._skip_space_and_comments(position, self.length)
            if position >= self.length:
                break
            if self.raw[position] == ord(")"):
                position += 1
                continue
            try:
                node, end = self.expression(position, self.length)
            except HelpExtractionError:
                # Some numeric-version files are manuals or drawing data rather
                # than Lisp.  Candidate Lisp files are checked separately below.
                position += 1
                continue
            if node.kind == "list" or any(
                child.kind == "list" for child, _ancestors in _walk_lists(node)
            ):
                result.append(node)
            position = end
        return result


def _node_raw(raw: bytes, node: Node) -> bytes:
    return raw[node.start : node.end]


def _declares_lisp_mode(raw: bytes) -> bool:
    return re.search(
        rb"\bMODE\s*:\s*LISP\b", raw[:1024], re.IGNORECASE
    ) is not None


def _atom_name(raw: bytes, node: Node | None) -> str | None:
    if node is None:
        return None
    while node.kind == "prefix" and node.children:
        node = node.children[0]
    if node.kind != "atom":
        return None
    source = _node_raw(raw, node)
    if source.startswith(b"|") and source.endswith(b"|"):
        source = source[1:-1]
    return source.decode("latin-1").upper()


def _unqualified_atom_name(raw: bytes, node: Node | None) -> str | None:
    name = _atom_name(raw, node)
    if name is not None and not name.startswith(":") and ":" in name:
        return name.rsplit(":", 1)[1]
    return name


def _head(raw: bytes, node: Node) -> str | None:
    return _atom_name(raw, node.children[0]) if node.kind == "list" and node.children else None


def _declaration_head(raw: bytes, node: Node) -> str | None:
    """Return a declaration operator without a non-keyword package prefix."""

    head = _head(raw, node)
    if head is not None and not head.startswith(":") and ":" in head:
        return head.rsplit(":", 1)[1]
    return head


def _form_name(raw: bytes, node: Node) -> str:
    if len(node.children) < 2:
        return "(anonymous)"
    name = node.children[1]
    atom = _atom_name(raw, name)
    if atom is not None:
        return atom
    if name.kind == "list":
        atoms = [_atom_name(raw, child) for child in name.children]
        atoms = [value for value in atoms if value is not None]
        if atoms:
            return " ".join(atoms[:4])
    return _display_bytes(_node_raw(raw, name), limit=100)


def _walk_lists(node: Node, *, ancestors: tuple[Node, ...] = ()) -> Iterator[tuple[Node, tuple[Node, ...]]]:
    if node.kind == "list":
        yield node, ancestors
    for child in node.children:
        yield from _walk_lists(child, ancestors=ancestors + (node,))


def _is_backquoted(ancestors: Sequence[Node]) -> bool:
    return any(node.kind == "prefix" and node.prefix == b"`" for node in ancestors)


def _logical_children(raw: bytes, node: Node) -> list[Node]:
    """Group adjacent complementary reader-conditionals as one argument."""

    if node.kind != "list":
        return []
    result: list[Node] = []
    position = 0
    while position < len(node.children):
        child = node.children[position]
        result.append(child)
        if (
            child.kind == "prefix"
            and child.prefix in {b"#+", b"#-"}
            and len(child.children) >= 2
            and position + 1 < len(node.children)
        ):
            following = node.children[position + 1]
            if (
                following.kind == "prefix"
                and following.prefix in {b"#+", b"#-"}
                and following.prefix != child.prefix
                and len(following.children) >= 2
                and _node_raw(raw, child.children[0]).upper()
                == _node_raw(raw, following.children[0]).upper()
            ):
                position += 1
        position += 1
    return result


def _function_doc_node(raw: bytes, node: Node) -> Node | None:
    if len(node.children) < 4:
        return None
    position = 3
    while (
        position < len(node.children)
        and node.children[position].kind == "list"
        and _head(raw, node.children[position]) == "DECLARE"
    ):
        position += 1
    # A sole string is the executable body and return value.  The CADR
    # compiler records a leading string as documentation only when another
    # body form follows it.
    if position + 1 >= len(node.children):
        return None
    candidate = node.children[position]
    return candidate if candidate.kind == "string" else None


def _function_leading_string_node(raw: bytes, node: Node) -> Node | None:
    """Return a leading body string even when it is the endpoint result."""

    if len(node.children) < 4:
        return None
    position = 3
    while (
        position < len(node.children)
        and node.children[position].kind == "list"
        and _head(raw, node.children[position]) == "DECLARE"
    ):
        position += 1
    if position >= len(node.children):
        return None
    candidate = node.children[position]
    return candidate if candidate.kind == "string" else None


def _flavor_doc_node(raw: bytes, node: Node) -> Node | None:
    # Only a direct DEFFLAVOR option is flavor documentation.  Menu plists and
    # other nested runtime data can also contain :DOCUMENTATION and are
    # enumerated individually by the LM-3 UI-property pass.
    for child in node.children[4:]:
        if child.kind != "list" or _head(raw, child) != ":DOCUMENTATION":
            continue
        for value in child.children[1:]:
            if value.kind == "string":
                return value
        return child
    return None


def _property_doc_node(raw: bytes, node: Node, head: str) -> Node | None:
    if head == "DEFPROP" and len(node.children) >= 4:
        prop = _atom_name(raw, node.children[3])
        return node.children[2] if prop in DOCUMENTATION_PROPERTIES else None
    if head == "PUTPROP" and len(node.children) >= 4:
        prop = _atom_name(raw, node.children[3])
        return node.children[2] if prop in DOCUMENTATION_PROPERTIES else None
    return None


def _defined_name_has(pattern: re.Pattern[str], name: str) -> bool:
    return pattern.search(name.upper()) is not None


def _is_nil_atom(raw: bytes, node: Node) -> bool:
    return _atom_name(raw, node) == "NIL"


def _is_in_comment(raw: bytes, node: Node, ancestors: Sequence[Node]) -> bool:
    return (
        node.kind == "list" and _head(raw, node) == "COMMENT"
    ) or any(
        ancestor.kind == "list" and _head(raw, ancestor) == "COMMENT"
        for ancestor in ancestors
    )


def _is_quoted_data(ancestors: Sequence[Node]) -> bool:
    return any(
        ancestor.kind == "prefix" and ancestor.prefix in {b"'", b"#'"}
        for ancestor in ancestors
    )


def _documentation_value(raw: bytes, node: Node | None) -> Node | None:
    if node is None or _is_nil_atom(raw, node):
        return None
    return node


def _source_documentation_variable(raw: bytes, node: Node) -> bool:
    """Recognize a named documentation source, not a saved runtime value."""

    name = _atom_name(raw, node)
    return bool(
        name
        and name.startswith("*")
        and name.endswith("*")
        and "DOCUMENTATION" in name
    )


def _button_documentation_value(raw: bytes, node: Node) -> Node | None:
    """Return the literal payload inside a one-string button-doc list."""

    value = _documentation_value(raw, node)
    if (
        value is not None
        and value.kind == "list"
        and len(value.children) == 1
        and value.children[0].kind == "string"
    ):
        return value.children[0]
    return value


def _message_clause_result_string(raw: bytes, node: Node) -> Node | None:
    """Return a clause's sole literal result, allowing an argument list."""

    children = _logical_children(raw, node)
    if len(children) == 2 and children[1].kind == "string":
        return children[1]
    if (
        len(children) == 3
        and children[1].kind == "list"
        and children[2].kind == "string"
    ):
        return children[2]
    return None


def _nearest_declaration(
    raw: bytes, node: Node, ancestors: Sequence[Node]
) -> tuple[str | None, str]:
    """Return the nearest declaration-like head and a stable display name."""

    candidates = [node, *reversed(ancestors)]
    nearest_list: Node | None = None
    for candidate in candidates:
        if candidate.kind != "list":
            continue
        if nearest_list is None:
            nearest_list = candidate
        head = _declaration_head(raw, candidate)
        if head is not None and (
            head.startswith("DEF")
            or head.startswith("DEFINE")
            or head in {"SETQ", "SETF", "PUTPROP"}
        ):
            return head, _form_name(raw, candidate)
    if nearest_list is None:
        return None, "(anonymous)"
    return _declaration_head(raw, nearest_list), _form_name(raw, nearest_list)


def classify_root(
    raw: bytes,
    root: Node,
    *,
    source_path: str | None = None,
    help_key_allowlist: frozenset[tuple[str, str]] = HELP_KEY_DISPATCH_ALLOWLIST,
) -> list[Match]:
    """Return every documentation-bearing construct inside one top-level form."""

    matches: list[Match] = []
    seen: set[tuple[int, int, str]] = set()
    for node, ancestors in _walk_lists(root):
        # Quoted lists are data, not declarations.  Backquoted declaration
        # templates are intentionally retained and marked below.
        if _is_quoted_data(ancestors):
            continue
        if _is_in_comment(raw, node, ancestors):
            continue
        head = _declaration_head(raw, node)
        if head is None:
            continue
        name = _form_name(raw, node)
        categories: set[str] = set()
        kind: str | None = None
        doc_node: Node | None = None

        if head == "DEFCOM":
            categories.add("command")
            kind = "zwei-command"
            if len(node.children) >= 3:
                doc_node = node.children[2]
        elif head in {"DEFMAJOR", "DEFMINOR"}:
            categories.update({"command", "mode"})
            kind = "zwei-mode-command"
            index = 4 if head == "DEFMAJOR" else 5
            if len(node.children) > index:
                doc_node = node.children[index]
        elif head == "DEFVARIABLE":
            categories.add("option")
            kind = "zwei-variable"
            if len(node.children) >= 5:
                doc_node = node.children[4]
        elif head in FUNCTION_DEFINITION_HEADS:
            doc_node = _function_doc_node(raw, node)
            if doc_node is not None:
                categories.add("api")
                kind = "function-docstring"
        elif head == "DEFFLAVOR":
            doc_node = _flavor_doc_node(raw, node)
            if doc_node is not None:
                categories.add("api")
                kind = "flavor-documentation"
        elif head in {"DEFPROP", "PUTPROP"}:
            doc_node = _property_doc_node(raw, node, head)
            if doc_node is not None:
                categories.add("api")
                kind = "documentation-property"
            elif head == "DEFPROP" and len(node.children) >= 4:
                property_name = _atom_name(raw, node.children[3])
                if property_name == "COMMAND-NAME":
                    categories.add("command")
                    kind = "command-name-property"
                    doc_node = node.children[2]
                elif property_name == ":MOUSE-SHORT-DOCUMENTATION":
                    categories.update({"command", "mouse"})
                    kind = "mouse-documentation-property"
                    doc_node = node.children[2]

        if head == "KBD-ESC-INSTALL-FUNCTION":
            categories.add("key")
            kind = kind or "key-registration"
            if len(node.children) >= 4:
                doc_node = node.children[3]

        defined_name = name.upper()
        initialized_named_help_data = (
            head in {"DEFVAR", "DEFCONST", "SETQ"}
            and _defined_name_has(HELP_NAME_RE, defined_name)
            and len(node.children) >= 3
        )
        if head in {"DEFVAR", "DEFCONST", "SETQ", "DEFPROP"} and (
            defined_name in KNOWN_HELP_TABLES or initialized_named_help_data
        ):
            categories.add("key" if "KEY" in defined_name or "ESCAPE" in defined_name else "help-table")
            kind = kind or "help-table"
            if len(node.children) >= 3:
                doc_node = doc_node or node.children[2]

        is_definition = head in FUNCTION_DEFINITION_HEADS or head in {
            "DEFSELECT",
            "DEFF",
        }
        if is_definition and _defined_name_has(HELP_NAME_RE, defined_name):
            categories.add("help-handler")
            kind = kind or "help-handler"
        elif is_definition and (
            source_path,
            defined_name,
        ) in help_key_allowlist:
            categories.add("help-handler")
            kind = kind or "help-key-handler"

        # A documentation wrapper is a live computed endpoint even though it
        # delegates between its wrapped body and another window.
        if head == "DEFWRAPPER" and _defined_name_has(
            DOCUMENTATION_NAME_RE, defined_name
        ):
            categories.update({"help-handler", "mouse"})
            kind = "documentation-wrapper"
            doc_node = None
        # Every method whose operation contains the segmented name
        # DOCUMENTATION is a live endpoint.  A sole leading string is its
        # literal result; all other bodies are metadata-only computed handlers.
        elif head == "DEFMETHOD" and _defined_name_has(
            DOCUMENTATION_NAME_RE, defined_name
        ):
            categories.add("help-handler")
            endpoint_string = _function_leading_string_node(raw, node)
            if (
                endpoint_string is not None
                and _function_doc_node(raw, node) is None
            ):
                kind = "documentation-endpoint-method"
                doc_node = endpoint_string
            else:
                kind = "documentation-method"
                doc_node = None
            if (
                "WHO-LINE-DOCUMENTATION" in defined_name
                or "MOUSE-DOCUMENTATION" in defined_name
            ):
                categories.add("mouse")
        # Retain older :DOCUMENT operations, such as condition proceed-type
        # renderers, which are recognized separately from DOCUMENTATION.
        elif head == "DEFMETHOD" and ":DOCUMENT" in defined_name:
            categories.add("help-handler")
            kind = kind or "documentation-method"
            doc_node = doc_node or _function_leading_string_node(raw, node)

        body_upper = _node_raw(raw, node).upper()
        if is_definition and (
            b"':DOCUMENTATION" in body_upper or b"':DOCUMENT)" in body_upper
        ):
            categories.add("help-handler")
            kind = kind or "documentation-message-handler"
            if "MOUSE" in defined_name:
                categories.add("mouse")

        if categories and _defined_name_has(MOUSE_NAME_RE, defined_name):
            categories.add("mouse")
        if categories and _defined_name_has(MENU_NAME_RE, defined_name):
            categories.add("menu")

        if not categories or kind is None:
            continue
        key = (node.start, node.end, kind)
        if key in seen:
            continue
        seen.add(key)
        matches.append(
            Match(
                categories=categories,
                kind=kind,
                name=name,
                node=node,
                root=root,
                documentation_node=doc_node,
                generated_template=_is_backquoted(ancestors),
            )
        )
    return matches


def classify_lm3_root(
    raw: bytes, root: Node, *, source_path: str
) -> list[Match]:
    """Add reviewed System 303 documentation constructs to the base scan."""

    matches = classify_root(
        raw,
        root,
        source_path=source_path,
        help_key_allowlist=LM3_HELP_KEY_DISPATCH_ALLOWLIST,
    )
    seen = {(match.node.start, match.node.end, match.kind) for match in matches}

    def add_match(
        *,
        kind: str,
        categories: set[str],
        node: Node,
        ancestors: Sequence[Node],
        documentation_node: Node | None,
        name: str | None = None,
    ) -> None:
        key = (node.start, node.end, kind)
        if key in seen:
            return
        seen.add(key)
        matches.append(
            Match(
                categories=categories,
                kind=kind,
                name=name if name is not None else _form_name(raw, node),
                node=node,
                root=root,
                documentation_node=documentation_node,
                generated_template=_is_backquoted(ancestors),
            )
        )

    def add_demo_entries(
        entries: Sequence[Node], ancestors: Sequence[Node]
    ) -> None:
        for entry in entries:
            if entry.kind != "list" or len(entry.children) < 2:
                continue
            documentation = _documentation_value(raw, entry.children[1])
            if documentation is None:
                continue
            title = _display_bytes(_node_raw(raw, entry.children[0]), limit=80)
            add_match(
                kind="demo-documentation",
                categories={"menu"},
                node=documentation,
                ancestors=(*ancestors, entry),
                documentation_node=documentation,
                name=f"{title} DEMO@{entry.start}",
            )
            # A submenu entry has a title as its first argument, followed by
            # recursively shaped menu entries.
            if len(entry.children) >= 4 and entry.children[2].kind == "string":
                add_demo_entries(entry.children[3:], (*ancestors, entry))

    def add_direct_ui_binding(
        *,
        binding_head: str,
        variable: Node,
        value: Node,
        ancestors: Sequence[Node],
    ) -> None:
        variable_name = _unqualified_atom_name(raw, variable)
        if variable_name is None:
            return
        specification = LM3_DIRECT_UI_DOCUMENTATION_BINDINGS.get(variable_name)
        if specification is None or binding_head not in specification["heads"]:
            return
        allowed_paths = specification.get("paths")
        if allowed_paths is not None and source_path not in allowed_paths:
            return
        documentation = _documentation_value(raw, value)
        if documentation is None:
            return
        if (
            variable_name
            == "*GLOBAL-MOUSE-CHAR-BLINKER-DOCUMENTATION-STRING*"
            and documentation.kind == "atom"
        ):
            # The atom-valued SETQ occurrence restores a previously saved
            # runtime value; it does not introduce documentation in source.
            return
        add_match(
            kind=specification["kind"],
            categories={"help-handler", "mouse"},
            node=variable,
            ancestors=ancestors,
            documentation_node=documentation,
            name=f"{variable_name}@{variable.start}",
        )

    for node, ancestors in _walk_lists(root):
        if _is_quoted_data(ancestors) or _is_in_comment(raw, node, ancestors):
            continue
        head = _declaration_head(raw, node)
        if head is None:
            continue
        name = _form_name(raw, node)
        children = _logical_children(raw, node)

        initializer = LM3_RUNTIME_HELP_INITIALIZERS.get((source_path, name))
        if (
            initializer is not None
            and head in {"DEFCONST", "DEFVAR"}
            and len(children) >= 3
        ):
            initializer_kind, initializer_categories = initializer
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                add_match(
                    kind=initializer_kind,
                    categories=set(initializer_categories),
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )

        computed_endpoint = LM3_COMPUTED_DOCUMENTATION_ENDPOINTS.get(
            (source_path, name)
        )
        if computed_endpoint is not None and head in FUNCTION_DEFINITION_HEADS:
            endpoint_kind, endpoint_categories = computed_endpoint
            add_match(
                kind=endpoint_kind,
                categories=set(endpoint_categories),
                node=node,
                ancestors=ancestors,
                documentation_node=None,
                name=name,
            )

        if head == "SETQ":
            for index in range(1, len(children) - 1, 2):
                add_direct_ui_binding(
                    binding_head=head,
                    variable=children[index],
                    value=children[index + 1],
                    ancestors=(*ancestors, node),
                )
        elif (
            head == "LET-GLOBALLY"
            and len(children) >= 2
            and children[1].kind == "list"
        ):
            for binding in children[1].children:
                binding_children = _logical_children(raw, binding)
                if binding.kind != "list" or len(binding_children) < 2:
                    continue
                add_direct_ui_binding(
                    binding_head=head,
                    variable=binding_children[0],
                    value=binding_children[1],
                    ancestors=(*ancestors, node, children[1], binding),
                )

        # Two live UI help channels use application-specific keywords rather
        # than the ordinary :DOCUMENTATION property.  BASIC-INSPECT consumes
        # :BUTTON-DOCUMENTATION as who-line mouse help.  ZMail's override mixin
        # consumes the corresponding init property and setter message.  Saved
        # OLD-DOC values merely restore runtime state; only literal strings and
        # named documentation variables introduce source documentation.
        for index, keyword in enumerate(node.children[:-1]):
            property_name = _atom_name(raw, keyword)
            if (
                index == 0
                or property_name not in LM3_SPECIAL_UI_DOCUMENTATION_PROPERTIES
            ):
                continue
            documentation = _documentation_value(raw, node.children[index + 1])
            if documentation is None:
                continue
            if property_name == ":BUTTON-DOCUMENTATION":
                documentation = _button_documentation_value(
                    raw, node.children[index + 1]
                )
                kind = "button-documentation-property"
            else:
                kind = "who-line-override-documentation-property"
            _enclosing_head, enclosing_name = _nearest_declaration(
                raw, node, ancestors
            )
            add_match(
                kind=kind,
                categories={"help-handler", "mouse"},
                node=keyword,
                ancestors=(*ancestors, node),
                documentation_node=documentation,
                name=f"{enclosing_name} {property_name}@{keyword.start}",
            )

        if head == "SEND":
            for index, message in enumerate(children[:-1]):
                if _atom_name(raw, message) != LM3_WHO_LINE_DOCUMENTATION_SETTER:
                    continue
                documentation = _documentation_value(raw, children[index + 1])
                if documentation is None or not (
                    documentation.kind == "string"
                    or _source_documentation_variable(raw, documentation)
                ):
                    continue
                _enclosing_head, enclosing_name = _nearest_declaration(
                    raw, node, ancestors
                )
                add_match(
                    kind="who-line-override-documentation-setter",
                    categories={"help-handler", "mouse"},
                    node=message,
                    ancestors=(*ancestors, node),
                    documentation_node=documentation,
                    name=(
                        f"{enclosing_name} "
                        f"{LM3_WHO_LINE_DOCUMENTATION_SETTER}@{message.start}"
                    ),
                )

        # Standard Lisp documentation mechanisms present in the later tree.
        if head == "DEFINE-COMMAND-DOCUMENTATION":
            add_match(
                kind="zwei-command-documentation-function",
                categories={"command", "help-handler"},
                node=node,
                ancestors=ancestors,
                documentation_node=None,
                name=name,
            )
        elif head in {"DEFVAR", "DEFPARAMETER", "DEFCONSTANT", "DEFCONST"}:
            if len(children) >= 4:
                documentation = _documentation_value(raw, children[3])
                if documentation is not None:
                    add_match(
                        kind="variable-documentation",
                        categories={"api"},
                        node=node,
                        ancestors=ancestors,
                        documentation_node=documentation,
                        name=name,
                    )
        elif head == "DEFVAR-RESETTABLE" and len(children) >= 5:
            documentation = _documentation_value(raw, children[4])
            if documentation is not None:
                add_match(
                    kind="variable-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFSTRUCT" and len(children) >= 3:
            if children[2].kind == "string":
                add_match(
                    kind="structure-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=children[2],
                    name=name,
                )
        elif head == "DEFTYPE":
            documentation = _function_doc_node(raw, node)
            if documentation is not None:
                add_match(
                    kind="type-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFSETF":
            documentation = None
            if len(children) >= 4 and children[3].kind == "string":
                documentation = children[3]
            elif len(children) >= 6 and children[4].kind == "string":
                documentation = children[4]
            if documentation is not None:
                add_match(
                    kind="setf-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "SETF" and len(children) >= 3:
            place = children[1]
            if (
                place.kind == "list"
                and _declaration_head(raw, place) == "DOCUMENTATION"
            ):
                add_match(
                    kind="documentation-setf",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=children[2],
                    name=_display_bytes(_node_raw(raw, place), limit=100),
                )

        if head == "SETF" and len(children) >= 3:
            place = children[1]
            place_children = _logical_children(raw, place)
            if (
                place.kind == "list"
                and _declaration_head(raw, place) == "GET"
                and len(place_children) >= 3
                and _atom_name(raw, place_children[2])
                == ":WHO-LINE-DOCUMENTATION"
            ):
                add_match(
                    kind="who-line-documentation-property",
                    categories={"command", "mouse"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=children[2],
                    name=_display_bytes(_node_raw(raw, place), limit=100),
                )
        elif head in {
            ":CASE-DOCUMENTATION",
            ":WHO-LINE-DOCUMENTATION-STRING",
        }:
            _enclosing_head, enclosing_name = _nearest_declaration(
                raw, node, ancestors
            )
            if head == ":WHO-LINE-DOCUMENTATION-STRING":
                add_match(
                    kind="who-line-documentation-clause",
                    categories={"help-handler", "mouse"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=_message_clause_result_string(raw, node),
                    name=f"{enclosing_name} {head}@{node.start}",
                )
            elif (
                source_path,
                enclosing_name,
            ) in LM3_CASE_DOCUMENTATION_ALLOWLIST:
                # These clauses compute documentation from an already
                # inventoried method or MULTIPLE-CERROR proceed record.  The
                # endpoint is retained without duplicating its source payload.
                add_match(
                    kind="case-documentation-clause",
                    categories={"help-handler"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=None,
                    name=f"{enclosing_name} {head}@{node.start}",
                )

        # Positional application producers whose macro definitions establish a
        # concrete runtime documentation consumer.
        if head == "CERROR" and len(children) >= 2 and children[1].kind == "string":
            add_match(
                kind="cerror-proceed-documentation",
                categories={"help-handler"},
                node=node,
                ancestors=ancestors,
                documentation_node=children[1],
                name=f"CERROR@{node.start}",
            )
        elif head == "ADD-SYSTEM-KEY" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="system-key-registration",
                    categories={"key"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head in {"DEFSIGNAL", "DEFSIGNAL-EXPLICIT"} and len(children) >= 5:
            documentation = children[4]
            if documentation.kind == "string":
                add_match(
                    kind="signal-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head in {"DEFRESOURCE", "DEFWINDOW-RESOURCE"} and len(children) >= 4:
            documentation = children[3]
            if documentation.kind == "string":
                add_match(
                    kind="resource-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFCLASS":
            for option in children[2:]:
                if option.kind != "list":
                    continue
                for index, child in enumerate(option.children[:-1]):
                    if _atom_name(raw, child) != ":DOCUMENTATION":
                        continue
                    documentation = _documentation_value(
                        raw, option.children[index + 1]
                    )
                    if documentation is not None and documentation.kind == "string":
                        add_match(
                            kind="application-class-documentation",
                            categories={"menu"},
                            node=child,
                            ancestors=(*ancestors, node, option),
                            documentation_node=documentation,
                            name=f"{name} CLASS@{child.start}",
                        )
        elif head == "DEFDEMO" and len(children) >= 3:
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                title = _display_bytes(_node_raw(raw, children[1]), limit=80)
                add_match(
                    kind="demo-documentation",
                    categories={"menu"},
                    node=documentation,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=f"{title} DEMO@{node.start}",
                )
            if len(children) >= 5 and children[3].kind == "string":
                add_demo_entries(children[4:], (*ancestors, node))
        elif head == "MULTIPLE-CERROR" and len(children) >= 5:
            for index, clause in enumerate(children[4:], start=1):
                if clause.kind != "list" or not clause.children:
                    continue
                documentation = _documentation_value(raw, clause.children[0])
                if documentation is None:
                    continue
                add_match(
                    kind="proceed-option-documentation",
                    categories={"help-handler"},
                    node=documentation,
                    ancestors=(*ancestors, node, clause),
                    documentation_node=documentation,
                    name=f"MULTIPLE-CERROR@{node.start} PROCEED-{index}",
                )
        elif head == "DEFINE-ZMAIL-TOP-LEVEL-COMMAND" and len(children) >= 3:
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                add_match(
                    kind="zmail-command-documentation",
                    categories={"command"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-MAIL-TEMPLATE" and len(children) >= 3:
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                add_match(
                    kind="mail-template-documentation",
                    categories={"api", "command"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION-UPDATER":
            add_match(
                kind="command-who-line-documentation-updater",
                categories={"command", "help-handler"},
                node=node,
                ancestors=ancestors,
                documentation_node=None,
                name=name,
            )
        elif head == "DEFINE-COMMAND-WHO-LINE-DOCUMENTATION" and len(children) >= 3:
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                add_match(
                    kind="command-who-line-documentation",
                    categories={"command"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "ASSOCIATE-OPTION-WITH-COMMAND-DOCUMENTATION":
            add_match(
                kind="command-documentation-option-association",
                categories={"command", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=None,
                name=name,
            )
        elif head == "DEFINE-COMBINED-METHOD-DOCUMENTATION-HANDLER":
            documentation = (
                _documentation_value(raw, children[2])
                if len(children) >= 3
                else None
            )
            add_match(
                kind="combined-method-documentation-handler",
                categories={"api", "help-handler"},
                node=node,
                ancestors=ancestors,
                documentation_node=documentation,
                name=name,
            )
        elif head == "DEFINE-ZMAIL-GLOBAL" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="zmail-global-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-MODIFY-MACRO" and len(children) >= 5:
            documentation = _documentation_value(raw, children[4])
            if documentation is not None:
                add_match(
                    kind="modify-macro-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-PEEK-MODE" and len(children) >= 4:
            short_documentation = _documentation_value(raw, children[3])
            if short_documentation is not None:
                add_match(
                    kind="peek-mode-menu-documentation",
                    categories={"menu", "mode"},
                    node=short_documentation,
                    ancestors=ancestors,
                    documentation_node=short_documentation,
                    name=f"{name} SHORT",
                )
            if len(children) >= 6:
                long_documentation = _documentation_value(raw, children[5])
                if long_documentation is not None:
                    add_match(
                        kind="peek-mode-documentation",
                        categories={"help-handler", "mode"},
                        node=long_documentation,
                        ancestors=ancestors,
                        documentation_node=long_documentation,
                        name=f"{name} LONG",
                    )
        elif head == "ADD-TYPEOUT-ITEM-TYPE" and len(children) >= 7:
            documentation = _documentation_value(raw, children[6])
            if documentation is not None:
                add_match(
                    kind="typeout-item-documentation",
                    categories={"menu", "mouse"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFGLOBAL" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="global-variable-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head in {"DEFINE-SITE-VARIABLE", "DEFINE-SITE-HOST-LIST"} and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="site-variable-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFCOMMAND" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="application-command-documentation",
                    categories={"command", "menu"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFCOMMENT" and len(children) >= 3:
            documentation = _documentation_value(raw, children[2])
            if documentation is not None:
                add_match(
                    kind="application-menu-documentation",
                    categories={"menu"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-COMMAND" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="tape-command-mouse-documentation",
                    categories={"command", "mouse"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-OPTION" and len(children) >= 7:
            documentation = _documentation_value(raw, children[6])
            if documentation is not None:
                add_match(
                    kind="tape-option-documentation",
                    categories={"menu", "option"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head == "DEFINE-CLOSED-VARIABLE" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="closed-variable-documentation",
                    categories={"api"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )

        # User-option constructors install labels consumed by
        # CHOOSE-USER-OPTIONS; absent explicit labels are computed from the
        # option symbol and remain handler-generated metadata records.
        if head == "DEFINE-USER-OPTION-ALIST" and len(children) >= 4:
            documentation = _documentation_value(raw, children[3])
            if documentation is not None:
                add_match(
                    kind="user-option-alist-documentation",
                    categories={"api", "option"},
                    node=node,
                    ancestors=ancestors,
                    documentation_node=documentation,
                    name=name,
                )
        elif head in LM3_USER_OPTION_CONSTRUCTORS or head == "DEFINE-SETTABLE-MAIL-FILE-OPTION":
            label = (
                _documentation_value(raw, children[4])
                if len(children) >= 5
                else None
            )
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=label,
                name=name,
            )
        elif head == "DEFVAR-USER-OPTION":
            if len(children) >= 4:
                documentation = _documentation_value(raw, children[3])
                if documentation is not None:
                    add_match(
                        kind="user-option-variable-documentation",
                        categories={"api", "option"},
                        node=node,
                        ancestors=ancestors,
                        documentation_node=documentation,
                        name=name,
                    )
            label = children[5] if len(children) >= 6 else None
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )
        elif head in {"DEFINE-USER-OPTION", "DEFINE-USER-OPTION-1"}:
            label_index = 4 if head == "DEFINE-USER-OPTION" else 5
            label = (
                children[label_index]
                if len(children) > label_index
                else None
            )
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )
        elif head == "DEFVAR-SITE-USER-OPTION":
            if len(children) >= 4:
                documentation = _documentation_value(raw, children[3])
                if documentation is not None:
                    add_match(
                        kind="user-option-variable-documentation",
                        categories={"api", "option"},
                        node=node,
                        ancestors=ancestors,
                        documentation_node=documentation,
                        name=name,
                    )
            label = children[5] if len(children) >= 6 else None
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )
        elif head == "DEFINE-SITE-USER-OPTION":
            label = children[4] if len(children) >= 5 else None
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )
        elif head == "DEFVAR-SITE-ALIST-USER-OPTION":
            if len(children) >= 4:
                documentation = _documentation_value(raw, children[3])
                if documentation is not None:
                    add_match(
                        kind="user-option-variable-documentation",
                        categories={"api", "option"},
                        node=node,
                        ancestors=ancestors,
                        documentation_node=documentation,
                        name=name,
                    )
            label = children[5] if len(children) >= 6 else None
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )
        elif head == "DEFINE-SITE-ALIST-USER-OPTION":
            label = children[2] if len(children) >= 3 else None
            add_match(
                kind="user-option-presentation",
                categories={"menu", "option"},
                node=node,
                ancestors=ancestors,
                documentation_node=_documentation_value(raw, label),
                name=name,
            )

    # Enumerate every runtime :DOCUMENTATION field individually, including
    # quoted and backquoted menu data.  Existing typed matches own their payload
    # span and therefore suppress a generic duplicate.
    used_documentation_spans = {
        (match.documentation_node.start, match.documentation_node.end)
        for match in matches
        if match.documentation_node is not None
    }
    for container, ancestors in _walk_lists(root):
        if _is_in_comment(raw, container, ancestors):
            continue
        for index, keyword in enumerate(container.children):
            if _atom_name(raw, keyword) != ":DOCUMENTATION":
                continue
            if index + 1 >= len(container.children):
                continue
            documentation = _documentation_value(
                raw, container.children[index + 1]
            )
            if documentation is None:
                continue
            documentation_span = (documentation.start, documentation.end)
            if documentation_span in used_documentation_spans:
                continue

            enclosing_head, enclosing_name = _nearest_declaration(
                raw, container, ancestors
            )
            if (
                source_path == "distribution/dist.lisp"
                and enclosing_name == "*LOGICAL-DIRECTORIES*"
                and _atom_name(raw, documentation) == "T"
                and _line_number(raw, keyword.start) in {318, 329, 340}
            ):
                # These are directory-classification flags consumed by
                # COPY-OZ-WORLD, not strings or UI documentation payloads.
                continue
            if index == 0:
                # Typed DEFFLAVOR clauses can have an intervening flavor type,
                # such as (:DOCUMENTATION :MIXIN "...").  They are exclusively
                # represented by flavor-documentation above.
                if enclosing_head == "DEFFLAVOR":
                    continue
                # Quoted keyword-head lists are data entries, not message
                # clauses.  Flat plist pairs inside those entries are handled
                # when their keyword occurs after index zero.
                if _is_quoted_data(ancestors) or _is_backquoted(ancestors):
                    categories = {"menu"}
                    context = (
                        enclosing_name.upper().encode("latin-1", "ignore")
                        + b" "
                        + _node_raw(raw, container).upper()
                    )
                    if b"MOUSE" in context:
                        categories.add("mouse")
                    add_match(
                        kind="ui-documentation-property",
                        categories=categories,
                        node=keyword,
                        ancestors=(*ancestors, container),
                        documentation_node=documentation,
                        name=f"{enclosing_name} :DOCUMENTATION@{keyword.start}",
                    )
                    used_documentation_spans.add(documentation_span)
                    continue
                add_match(
                    kind="documentation-message-clause",
                    categories={"help-handler"},
                    node=keyword,
                    ancestors=(*ancestors, container),
                    documentation_node=documentation,
                    name=f"{enclosing_name} :DOCUMENTATION@{keyword.start}",
                )
                used_documentation_spans.add(documentation_span)
                continue

            if enclosing_head == "DEFSTRUCT":
                kind = "structure-slot-documentation"
                categories = {"api"}
            elif enclosing_head == "DEFCLASS":
                kind = "application-class-documentation"
                categories = {"menu"}
            else:
                kind = "ui-documentation-property"
                categories = {"menu"}
                context = (
                    enclosing_name.upper().encode("latin-1", "ignore")
                    + b" "
                    + _node_raw(raw, container).upper()
                )
                if b"MOUSE" in context:
                    categories.add("mouse")
            add_match(
                kind=kind,
                categories=categories,
                node=keyword,
                ancestors=(*ancestors, container),
                documentation_node=documentation,
                name=f"{enclosing_name} :DOCUMENTATION@{keyword.start}",
            )
            used_documentation_spans.add(documentation_span)

    return matches


def select_highest_versions(source_root: Path) -> list[VersionedSource]:
    selected: dict[tuple[str, str], VersionedSource] = {}
    for path in source_root.rglob("*"):
        if not path.is_file():
            continue
        match = NUMERIC_VERSION_RE.fullmatch(path.name)
        if match is None:
            continue
        relative_parent = path.parent.relative_to(source_root).as_posix()
        stem = match.group("stem")
        version = int(match.group("version"), 10)
        logical_stem = f"{relative_parent}/{stem}" if relative_parent != "." else stem
        key = (relative_parent, stem.casefold())
        candidate = VersionedSource(
            logical_stem=logical_stem,
            version=version,
            path=path,
            relative_path=path.relative_to(source_root).as_posix(),
        )
        old = selected.get(key)
        if old is None or (candidate.version, candidate.relative_path) > (
            old.version,
            old.relative_path,
        ):
            selected[key] = candidate
    return sorted(selected.values(), key=lambda item: item.relative_path)


def _read_verified_selected_sources(
    selected: Sequence[VersionedSource],
) -> dict[str, bytes]:
    payloads = {
        source.relative_path: source.path.read_bytes() for source in selected
    }
    file_count, byte_size, manifest = _content_manifest(payloads.items())
    expected = (
        PINNED_EXPECTATIONS["highest_numeric_version_file_count"],
        SOURCE_SELECTED_BYTES,
        SOURCE_SELECTED_MANIFEST_SHA256,
    )
    observed = (file_count, byte_size, manifest)
    if observed != expected:
        raise HelpExtractionError(
            "selected System 46 source manifest differs from pinned revision "
            f"{SOURCE_REVISION}: expected {expected}, observed {observed}"
        )
    return payloads


def _verify_system46(source_root: Path) -> bytes:
    license_path = source_root / "LICENSE"
    try:
        license_raw = license_path.read_bytes()
    except OSError as error:
        raise HelpExtractionError(f"cannot read System 46 license {license_path}: {error}") from error
    if len(license_raw) != SOURCE_LICENSE_BYTES or _sha256(license_raw) != SOURCE_LICENSE_SHA256:
        raise HelpExtractionError(
            f"{license_path} is not the pinned public System 46 license: got "
            f"{len(license_raw)} bytes and sha256 {_sha256(license_raw)}"
        )
    for spec in STANDALONE_FILES:
        path = source_root / spec.path
        try:
            raw = path.read_bytes()
        except OSError as error:
            raise HelpExtractionError(f"cannot read reviewed help source {path}: {error}") from error
        if len(raw) != spec.byte_size or _sha256(raw) != spec.sha256:
            raise HelpExtractionError(
                f"{path} is not the reviewed System 46 artifact: got {len(raw)} bytes "
                f"and sha256 {_sha256(raw)}"
            )
    return license_raw


def _documentation_metadata(raw: bytes, node: Node | None) -> dict[str, object]:
    if node is None:
        return {"source_kind": "computed-or-handler", "text": None}
    source = _node_raw(raw, node)
    if node.kind == "string":
        return {
            "source_kind": "literal-string",
            "text": _decode_lisp_string(source),
            "source": source.decode("latin-1"),
        }
    return {
        "source_kind": "nonliteral-form",
        "text": None,
        "source": source.decode("latin-1"),
    }


def _safe_source_output_path(relative_path: str) -> Path:
    path = Path(relative_path)
    return Path("source") / path.parent / f"{path.name}.help.lisp"


def _render_context_file(
    source_relative_path: str,
    raw: bytes,
    roots: Sequence[Node],
) -> tuple[str, bytes, dict[tuple[int, int], tuple[int, int]]]:
    relative_output = _safe_source_output_path(source_relative_path)
    result = bytearray(
        (
            ";;; Inertly recovered online-help source contexts.\n"
            f";;; Original System 46 file: {source_relative_path}\n"
            ";;; Exact source bytes follow each generated provenance comment.\n\n"
        ).encode("ascii")
    )
    output_spans: dict[tuple[int, int], tuple[int, int]] = {}
    for root in sorted(roots, key=lambda value: (value.start, value.end)):
        line_start = _line_number(raw, root.start)
        line_end = _line_number(raw, max(root.start, root.end - 1))
        result.extend(
            (
                f";;; Source bytes {root.start}:{root.end}; lines {line_start}-{line_end}; "
                f"sha256 {_sha256(_node_raw(raw, root))}\n"
            ).encode("ascii")
        )
        output_start = len(result)
        result.extend(_node_raw(raw, root))
        output_end = len(result)
        output_spans[(root.start, root.end)] = (output_start, output_end)
        result.extend(b"\n\n")
    return relative_output.as_posix(), bytes(result), output_spans


def _markdown_escape(value: str) -> str:
    return value.replace("|", "\\|").replace("`", "\\`")


def _write_markdown(output: Path, catalog: dict[str, object]) -> None:
    lines = [
        "---",
        "type: Preservation Asset Catalog",
        "title: Recovered MIT CADR System 46 online help",
        "description: Deterministic source recovery of help artifacts and declarations from the public System 46 snapshot.",
        "tags: [mit-cadr, system-46, online-help, recovered-source]",
        "timestamp: 2026-07-17T03:35:00-04:00",
        "---",
        "",
        "# Recovered MIT CADR System 46 online help",
        "",
        "This generated catalog contains source help, not a reconstructed running world. "
        "The extractor does not evaluate Lisp. Exact declaration contexts are retained in "
        "the `source/` tree; control and 8-bit characters are shown as byte escapes in this view.",
        "",
        "## Counts",
        "",
        "| Category | Records |",
        "| --- | ---: |",
    ]
    for category, count in sorted(catalog["category_counts"].items()):
        lines.append(f"| {_markdown_escape(category)} | {count} |")
    lines.extend(
        [
            "",
            f"Unique declarations: {catalog['record_count']}. Exact source contexts: "
            f"{catalog['context_count']} across {catalog['source_file_count']} files.",
            "",
            "## Standalone and generated files",
            "",
            "| File | Bytes | SHA-256 | Role |",
            "| --- | ---: | --- | --- |",
        ]
    )
    for entry in catalog["standalone_files"]:
        lines.append(
            f"| [{_markdown_escape(entry['source_path'])}]({entry['output_path']}) | "
            f"{entry['byte_size']} | `{entry['sha256']}` | {_markdown_escape(entry['role'])} |"
        )
    lines.extend(
        [
            "",
            "## Source declarations and handlers",
            "",
            "| Source | Name | Kind | Categories | Documentation |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for record in catalog["records"]:
        doc = record["documentation"]
        if doc["source_kind"] == "literal-string":
            display = _display_bytes(doc["text"].encode("latin-1"), limit=180)
        elif doc["source_kind"] == "nonliteral-form":
            display = "computed: " + _display_bytes(doc["source"].encode("latin-1"), limit=150)
        else:
            display = "computed by handler"
        link = f"{record['output_path']}"
        lines.append(
            f"| [{record['source_path']}:{record['line_start']}]({link}) | "
            f"{_markdown_escape(record['name'])} | {_markdown_escape(record['kind'])} | "
            f"{_markdown_escape(', '.join(record['categories']))} | {_markdown_escape(display)} |"
        )
    (output / "catalog.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def _prepare_output(
    output: Path, *, clean: bool, owned_files: set[Path]
) -> None:
    """Refuse ambiguous output trees before replacing extractor-owned files."""

    if output.is_symlink():
        raise HelpExtractionError(
            f"output path must not be a symbolic link: {output}"
        )
    if output.exists() and not output.is_dir():
        raise HelpExtractionError(f"output path is not a directory: {output}")
    existing = list(output.rglob("*")) if output.exists() else []
    owned_directories = {
        parent
        for owned_file in owned_files
        for parent in owned_file.parents
        if parent != Path(".")
    }
    unknown: list[str] = []
    for child in existing:
        relative = child.relative_to(output)
        if child.is_symlink():
            unknown.append(relative.as_posix())
        elif child.is_file() and relative not in owned_files:
            unknown.append(relative.as_posix())
        elif child.is_dir() and relative not in owned_directories:
            unknown.append(relative.as_posix() + "/")
    if unknown:
        raise HelpExtractionError(
            "output directory contains unrecognized entries: "
            + ", ".join(sorted(unknown))
        )
    if existing and not clean:
        raise HelpExtractionError(
            "output already exists; pass --clean to replace generated files"
        )
    if clean:
        for child in sorted(
            existing,
            key=lambda item: len(item.relative_to(output).parts),
            reverse=True,
        ):
            if child.is_file():
                child.unlink()
            else:
                child.rmdir()
    output.mkdir(parents=True, exist_ok=True)


def _validate_pinned_counts(catalog: dict[str, object]) -> None:
    records = catalog["records"]
    observed = {
        "highest_numeric_version_file_count": catalog["source"][
            "highest_numeric_version_file_count"
        ],
        "record_count": catalog["record_count"],
        "context_count": catalog["context_count"],
        "source_file_count": catalog["source_file_count"],
        "concrete_defcom_count": sum(
            record["kind"] == "zwei-command" and not record["generated_template"]
            for record in records
        ),
        "generated_command_template_count": sum(
            record["kind"] == "zwei-command" and record["generated_template"]
            for record in records
        ),
        "kind_counts": dict(
            sorted(Counter(record["kind"] for record in records).items())
        ),
        "category_counts": catalog["category_counts"],
        "documentation_source_kind_counts": catalog[
            "documentation_source_kind_counts"
        ],
    }
    if observed != PINNED_EXPECTATIONS:
        raise HelpExtractionError(
            "recovered declaration counts differ from the reviewed pinned System 46 "
            "corpus:\n"
            + json.dumps(
                {"expected": PINNED_EXPECTATIONS, "observed": observed},
                indent=2,
                sort_keys=True,
            )
        )


def extract_system46(source_root: Path, output: Path, *, clean: bool = False) -> dict[str, object]:
    license_raw = _verify_system46(source_root)
    selected = select_highest_versions(source_root)
    selected_payloads = _read_verified_selected_sources(selected)
    by_file: dict[str, tuple[bytes, list[Match]]] = {}
    for source in selected:
        raw = selected_payloads[source.relative_path]
        parser = InertSExpressionParser(
            raw,
            path=source.relative_path,
            strict_block_comments=_declares_lisp_mode(raw),
        )
        roots = parser.top_level_lists()
        matches = [
            match
            for root in roots
            for match in classify_root(
                raw, root, source_path=source.relative_path
            )
        ]
        if matches:
            by_file[source.relative_path] = (raw, matches)

    standalone_entries: list[dict[str, object]] = []
    standalone_payloads: dict[Path, bytes] = {}
    for spec in STANDALONE_FILES:
        raw = (source_root / spec.path).read_bytes()
        output_path = Path("standalone") / Path(spec.path).name
        standalone_payloads[output_path] = raw
        standalone_entries.append(
            {
                "source_path": spec.path,
                "output_path": output_path.as_posix(),
                "byte_size": len(raw),
                "sha256": _sha256(raw),
                "role": spec.role,
            }
        )

    records: list[dict[str, object]] = []
    rendered_contexts: dict[Path, bytes] = {}
    unique_contexts: set[tuple[str, int, int]] = set()
    for source_path in sorted(by_file):
        raw, matches = by_file[source_path]
        roots_by_span = {(match.root.start, match.root.end): match.root for match in matches}
        output_path, rendered, output_spans = _render_context_file(
            source_path, raw, list(roots_by_span.values())
        )
        rendered_contexts[Path(output_path)] = rendered
        for match in sorted(matches, key=lambda item: (item.node.start, item.node.end, item.kind)):
            context_key = (match.root.start, match.root.end)
            output_start, output_end = output_spans[context_key]
            node_raw = _node_raw(raw, match.node)
            root_raw = _node_raw(raw, match.root)
            unique_contexts.add((source_path, *context_key))
            record = {
                "id": f"{source_path}:{match.node.start}:{match.kind}",
                "source_path": source_path,
                "line_start": _line_number(raw, match.node.start),
                "line_end": _line_number(raw, max(match.node.start, match.node.end - 1)),
                "byte_start": match.node.start,
                "byte_end": match.node.end,
                "byte_size": len(node_raw),
                "sha256": _sha256(node_raw),
                "context_byte_start": match.root.start,
                "context_byte_end": match.root.end,
                "context_sha256": _sha256(root_raw),
                "output_path": output_path,
                "output_context_byte_start": output_start,
                "output_context_byte_end": output_end,
                "kind": match.kind,
                "name": match.name,
                "categories": sorted(match.categories),
                "generated_template": match.generated_template,
                "documentation": _documentation_metadata(raw, match.documentation_node),
            }
            records.append(record)

    records.sort(key=lambda entry: (entry["source_path"], entry["byte_start"], entry["kind"]))
    category_counts = Counter(
        category for record in records for category in record["categories"]
    )
    document_kinds = Counter(record["documentation"]["source_kind"] for record in records)
    catalog: dict[str, object] = {
        "format": "MIT CADR System 46 online-help source recovery catalog",
        "format_version": 1,
        "extraction_policy": {
            "execution": "none; byte-level source scanning only",
            "version_selection": "greatest numeric suffix for each directory and case-folded stem",
            "included": [
                "four reviewed standalone/generated ZWEI help files",
                "DEFCOM plus DEFMAJOR/DEFMINOR command documentation",
                "function and method docstrings surfaced by FUNCTION-DOCUMENTATION",
                "explicit DOCUMENTATION properties and DEFFLAVOR :DOCUMENTATION",
                "explicit COMMAND-NAME properties used by ZWEI command display",
                "ZWEI DEFVARIABLE option documentation",
                "keyboard help tables and KBD-ESC-INSTALL-FUNCTION registrations",
                "menu and mouse documentation attached to included declarations",
                "named documentation/help handlers and definitions dispatching HELP or ?",
            ],
            "excluded": [
                "comments and prose manuals without an identified in-program consumer",
                "runtime mutations not present in source",
                "compiled-only FEF debugging information absent from source",
                "LM-3-only payloads, pending authoritative redistribution provenance",
            ],
            "historical_bytes": "source and standalone payloads retained byte-for-byte; JSON strings use Latin-1 as a reversible byte mapping",
        },
        "source": {
            "repository": SOURCE_REPOSITORY,
            "revision": SOURCE_REVISION,
            "license_path": "LICENSE.source",
            "license_byte_size": len(license_raw),
            "license_sha256": _sha256(license_raw),
            "highest_numeric_version_file_count": len(selected),
            "selected_source_byte_size": SOURCE_SELECTED_BYTES,
            "selected_source_manifest_sha256": SOURCE_SELECTED_MANIFEST_SHA256,
            "selected_source_manifest_convention": CONTENT_MANIFEST_CONVENTION,
        },
        "standalone_files": standalone_entries,
        "record_count": len(records),
        "context_count": len(unique_contexts),
        "source_file_count": len(by_file),
        "category_counts": dict(sorted(category_counts.items())),
        "documentation_source_kind_counts": dict(sorted(document_kinds.items())),
        "generated_template_count": sum(bool(record["generated_template"]) for record in records),
        "records": records,
    }
    _validate_pinned_counts(catalog)

    # Build and validate the entire recovery before --clean can remove a
    # previously successful output.  Every selected source path is considered
    # an extractor-owned possible output so stale files from a rule correction
    # can be removed without treating arbitrary similarly-named files as ours.
    owned_files = {
        Path("LICENSE.source"),
        Path("catalog.json"),
        Path("catalog.md"),
        *standalone_payloads,
        *(_safe_source_output_path(source.relative_path) for source in selected),
    }
    _prepare_output(output, clean=clean, owned_files=owned_files)
    (output / "LICENSE.source").write_bytes(license_raw)
    for relative, payload in sorted(standalone_payloads.items()):
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
    for relative, payload in sorted(rendered_contexts.items()):
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
    (output / "catalog.json").write_text(
        json.dumps(catalog, indent=2, sort_keys=True, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    _write_markdown(output, catalog)
    return catalog


def _validate_lm3_counts(result: dict[str, object]) -> None:
    reviewed_matches = {
        (file_entry["path"], declaration["name"])
        for file_entry in result["files"]
        for declaration in file_entry["declarations"]
        if (file_entry["path"], declaration["name"])
        in LM3_HELP_KEY_DISPATCH_ALLOWLIST
        and "help-handler" in declaration["categories"]
    }
    observed = {
        "file_count": result["file_count"],
        "record_count": result["record_count"],
        "unique_source_form_count": result["unique_source_form_count"],
        "generated_template_count": result["generated_template_count"],
        "standalone_candidate_count": result["standalone_candidate_count"],
        "reviewed_help_dispatch_count": len(reviewed_matches),
        "category_file_counts": result["category_file_counts"],
        "kind_counts": result["kind_counts"],
        "documentation_source_kind_counts": result[
            "documentation_source_kind_counts"
        ],
        "producer_form_counts": result["producer_form_counts"],
        "documentation_keyword_candidate_count": result[
            "documentation_keyword_candidate_count"
        ],
        "documentation_keyword_excluded_non_help_count": result[
            "documentation_keyword_excluded_non_help_count"
        ],
        "documentation_keyword_semantic_field_count": result[
            "documentation_keyword_semantic_field_count"
        ],
    }
    if observed != LM3_PINNED_EXPECTATIONS:
        raise HelpExtractionError(
            "LM-3 metadata counts differ from the reviewed pinned System 303 "
            "inventory:\n"
            + json.dumps(
                {"expected": LM3_PINNED_EXPECTATIONS, "observed": observed},
                indent=2,
                sort_keys=True,
            )
        )
    if reviewed_matches != LM3_HELP_KEY_DISPATCH_ALLOWLIST:
        raise HelpExtractionError(
            "LM-3 reviewed Help-key dispatch definitions are incomplete: "
            + json.dumps(
                {
                    "missing": sorted(
                        LM3_HELP_KEY_DISPATCH_ALLOWLIST - reviewed_matches
                    ),
                    "unexpected": sorted(
                        reviewed_matches - LM3_HELP_KEY_DISPATCH_ALLOWLIST
                    ),
                },
                sort_keys=True,
            )
        )


def _lm3_metadata_name(match: Match) -> str:
    """Keep symbolic identity while suppressing literal prose from metadata."""

    if '"' in match.name:
        return f"{match.kind.upper()}@{match.node.start}"
    return match.name


def inventory_lm3(
    source_root: Path,
    output_path: Path,
    *,
    verify_pinned: bool = True,
) -> dict[str, object]:
    """Write metadata-only LM-3 help inventory; never copy source or help text."""

    eligible: list[tuple[str, Path, bytes]] = []
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        relative_path = path.relative_to(source_root)
        if any(
            part.casefold() in LM3_IGNORED_PARTS for part in relative_path.parts
        ):
            continue
        if path.suffix.casefold() not in LM3_SCAN_SUFFIXES:
            continue
        eligible.append((relative_path.as_posix(), path, path.read_bytes()))

    scan_file_count, scan_byte_size, scan_manifest = _content_manifest(
        (relative, raw) for relative, _path, raw in eligible
    )
    expected_manifest = (
        LM3_SCAN_FILE_COUNT,
        LM3_SCAN_BYTES,
        LM3_SCAN_MANIFEST_SHA256,
    )
    observed_manifest = (scan_file_count, scan_byte_size, scan_manifest)
    if verify_pinned and observed_manifest != expected_manifest:
        raise HelpExtractionError(
            "LM-3 help scan manifest differs from pinned System 303 check-in "
            f"{LM3_SOURCE_REVISION}: expected {expected_manifest}, "
            f"observed {observed_manifest}"
        )

    records: list[dict[str, object]] = []
    category_counts: Counter[str] = Counter()
    kind_counts: Counter[str] = Counter()
    documentation_source_kind_counts: Counter[str] = Counter()
    record_count = 0
    unique_source_forms: set[tuple[str, int, str]] = set()
    generated_template_count = 0
    standalone_candidate_count = 0
    producer_form_counts: Counter[str] = Counter(
        {head: 0 for head in LM3_POSITIONAL_PRODUCER_HEADS}
    )
    documentation_keyword_candidate_count = 0
    documentation_keyword_excluded_non_help_count = 0
    for relative, path, raw in eligible:
        categories: set[str] = set()
        match_count = 0
        declaration_metadata: list[dict[str, object]] = []
        leading_source_header = raw[:512].upper()
        text_mode_lisp = (
            path.suffix.casefold() == ".lisp"
            and b"-*-" in leading_source_header
            and re.search(
                rb"\bMODE\s*:\s*TEXT\b", leading_source_header
            ) is not None
        )
        if path.suffix.casefold() == ".lisp" and not text_mode_lisp:
            parser = InertSExpressionParser(raw, path=relative)
            for root in parser.top_level_lists():
                for node, ancestors in _walk_lists(root):
                    if not _is_in_comment(raw, node, ancestors):
                        for index, keyword in enumerate(node.children[:-1]):
                            if _atom_name(raw, keyword) != ":DOCUMENTATION":
                                continue
                            documentation = _documentation_value(
                                raw, node.children[index + 1]
                            )
                            if documentation is None:
                                continue
                            documentation_keyword_candidate_count += 1
                            if (
                                relative == "distribution/dist.lisp"
                                and _atom_name(raw, documentation) == "T"
                                and _line_number(raw, keyword.start)
                                in {318, 329, 340}
                            ):
                                documentation_keyword_excluded_non_help_count += 1
                    if _is_quoted_data(ancestors) or _is_in_comment(
                        raw, node, ancestors
                    ):
                        continue
                    head = _declaration_head(raw, node)
                    if head not in LM3_POSITIONAL_PRODUCER_HEADS:
                        continue
                    # This three-element list is a DEFMETHOD method name, not
                    # an invocation of the MULTIPLE-CERROR macro.
                    if head == "MULTIPLE-CERROR" and len(node.children) < 5:
                        continue
                    producer_form_counts[head] += 1
                found = classify_lm3_root(raw, root, source_path=relative)
                match_count += len(found)
                for match in found:
                    line = _line_number(raw, match.node.start)
                    metadata_name = _lm3_metadata_name(match)
                    categories.update(match.categories)
                    kind_counts[match.kind] += 1
                    if match.documentation_node is None:
                        source_kind = "computed-or-handler"
                    elif match.documentation_node.kind == "string":
                        source_kind = "literal-string"
                    else:
                        source_kind = "nonliteral-form"
                    documentation_source_kind_counts[source_kind] += 1
                    generated_template_count += int(match.generated_template)
                    unique_source_forms.add((relative, line, metadata_name))
                    declaration_metadata.append(
                        {
                            "name": metadata_name,
                            "kind": match.kind,
                            "line": line,
                            "categories": sorted(match.categories),
                            "generated_template": match.generated_template,
                            "documentation_source_kind": source_kind,
                        }
                    )
        elif text_mode_lisp:
            categories.add("documentation-reference")
        elif (
            path.name.casefold() in LM3_STANDALONE_NAMES
            or path.name.casefold().endswith(".comnd.text")
        ):
            categories.add("standalone-candidate")
            standalone_candidate_count += 1
        if not categories:
            continue
        record_count += match_count
        category_counts.update(categories)
        relative_parts = tuple(
            part.casefold() for part in Path(relative).parts
        )
        filename = relative_parts[-1]
        patch_context = (
            "patch" in relative_parts[:-1]
            or filename.startswith("patch-")
            or filename.startswith("system-")
        )
        records.append(
            {
                "path": relative,
                "byte_size": len(raw),
                "sha256": _sha256(raw),
                "categories": sorted(categories),
                "record_count": match_count,
                "record_kind_counts": dict(
                    sorted(Counter(
                        item["kind"] for item in declaration_metadata
                    ).items())
                ),
                "declarations": declaration_metadata,
                "source_role": (
                    "patch-context"
                    if patch_context
                    else (
                        "documentation-reference"
                        if text_mode_lisp
                        else "source-or-documentation-candidate"
                    )
                ),
            }
        )
    result = {
        "format": "LM-3 metadata-only online-help inventory",
        "payload_included": False,
        "rights_note": (
            "No source or documentation text is copied because the public Fossil tree "
            "does not by itself establish authoritative redistribution permission."
        ),
        "source": {
            "repository": LM3_SOURCE_REPOSITORY,
            "revision": (
                LM3_SOURCE_REVISION
                if observed_manifest == expected_manifest
                else None
            ),
            "tag": (
                LM3_SOURCE_TAG if observed_manifest == expected_manifest else None
            ),
            "expected_revision": LM3_SOURCE_REVISION,
            "expected_tag": LM3_SOURCE_TAG,
            "scan_file_count": scan_file_count,
            "scan_byte_size": scan_byte_size,
            "scan_manifest_sha256": scan_manifest,
            "scan_manifest_convention": CONTENT_MANIFEST_CONVENTION,
            "scan_domain": (
                "files with suffixes "
                + ", ".join(sorted(LM3_SCAN_SUFFIXES))
                + "; excluding path components "
                + ", ".join(sorted(LM3_IGNORED_PARTS))
            ),
            "manifest_verified": observed_manifest == expected_manifest,
        },
        "file_count": len(records),
        "record_count": record_count,
        "unique_source_form_count": len(unique_source_forms),
        "record_semantics": (
            "Each record is one matched metadata kind. A source form can yield "
            "more than one record."
        ),
        "generated_template_count": generated_template_count,
        "standalone_candidate_count": standalone_candidate_count,
        "category_file_counts": dict(sorted(category_counts.items())),
        "kind_counts": dict(sorted(kind_counts.items())),
        "documentation_source_kind_counts": dict(
            sorted(documentation_source_kind_counts.items())
        ),
        "producer_form_counts": dict(sorted(producer_form_counts.items())),
        "documentation_keyword_candidate_count": (
            documentation_keyword_candidate_count
        ),
        "documentation_keyword_excluded_non_help_count": (
            documentation_keyword_excluded_non_help_count
        ),
        "documentation_keyword_semantic_field_count": (
            documentation_keyword_candidate_count
            - documentation_keyword_excluded_non_help_count
        ),
        "files": records,
    }
    if sum(kind_counts.values()) != record_count or sum(
        documentation_source_kind_counts.values()
    ) != record_count:
        raise HelpExtractionError(
            "LM-3 record totals do not agree with aggregate kind counts"
        )
    if verify_pinned:
        _validate_lm3_counts(result)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return result


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        required=True,
        help="the src/ directory of the pinned public mit-cadr-system-software checkout",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("docs/assets/mit-cadr-online-help"),
        help="tracked output directory for public System 46 recovery",
    )
    parser.add_argument(
        "--clean", action="store_true", help="replace extractor-owned output files"
    )
    parser.add_argument(
        "--lm3-source",
        type=Path,
        help="optional LM-3 tree to scan without copying payloads",
    )
    parser.add_argument(
        "--lm3-inventory-output",
        type=Path,
        default=Path("build/help/mit-cadr/lm3-inventory.json"),
        help="ignored metadata-only destination used with --lm3-source",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    try:
        catalog = extract_system46(args.source, args.output, clean=args.clean)
        if args.lm3_source is not None:
            lm3 = inventory_lm3(args.lm3_source, args.lm3_inventory_output)
            print(
                f"Inventoried {lm3['record_count']} LM-3 metadata records from "
                f"{lm3['unique_source_form_count']} unique source forms in "
                f"{lm3['file_count']} matching files into "
                f"{args.lm3_inventory_output} (no payload copied)"
            )
    except (OSError, HelpExtractionError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(
        f"Recovered {catalog['record_count']} declarations in "
        f"{catalog['context_count']} exact contexts from "
        f"{catalog['source_file_count']} System 46 files into {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
