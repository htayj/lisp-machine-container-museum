#!/usr/bin/env python3
"""Capture and normalize the S0..S1,000,000 upstream-usim oracle prefix.

The pre-existing CDRTRC1 oracle intentionally remains a mandatory 100,000-slot
gate.  This runner creates a *new disposable copy* of that already prepared
source tree, changes only its copied ceiling from 100,000 to 1,000,000, and
adds a read-only disk witness inclusion.  It never modifies the pinned checkout,
the selected input disk, or the mandatory oracle script/patch.

Its NDJSON boundary stream is an adapter format, not a claim that CDRTRC1,
CDRSTATE1, and CDRSTATE2 are byte-comparable.  It makes the ordinal convention
explicit: S0 is the post-boot boundary; S(n>0) is after slot n-1, and the pinned
driver records machine_cycles after increment, so raw_machine_cycles == n.
"""
from __future__ import annotations

import argparse
import configparser
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
from typing import Any, BinaryIO, Iterator, TextIO

ROOT = Path(__file__).resolve().parents[1]
SLOTS = 1_000_000
HEADER = struct.Struct("<8sHHIQ16s20sI")
RECORD = struct.Struct("<IHHQQII")
TLV = struct.Struct("<HHI")
U32 = struct.Struct("<I")
U64 = struct.Struct("<Q")
MAX_RECORD = 16 * 1024 * 1024
MAX_PAYLOAD = 16 * 1024 * 1024
BOUNDARY = 1
TERMINAL = 4
S0 = 1
EXECUTED = 2
INHIBITED = 4
HALT = 16
EMPTY_MUTATION_SHA256 = hashlib.sha256(b"CDRMUT1\0").digest()
BASELINE_OUTPUT = Path("build/cadr-oracle/m3-upstream-native-s1000000")
BASELINE_NORMALIZED_SHA256 = "0b1126e777d24ee67a55204649ba0d12da7ecf01f827fc06403e2fe422d41945"
EXPECTED_PREFIX_REPORT = {
    "schema": "cadr-oracle-prefix-closure",
    "schema_version": 1,
    "slot_limit": SLOTS,
    "boundary_count": SLOTS + 1,
    "mutation_count": 1_265_669,
    "checkpoint_interval": 1024,
    "external_event_count": 0,
    "first_alu_slot": 4,
    "negative_alu_exercised_slot": None,
    "families": {
        "1": 16384, "2": 556626, "3": 555607, "4": 2048,
        "5": 1026, "6": 41, "7": 67585, "8": 65540, "9": 258,
        "21": 264, "22": 269, "25": 7, "26": 9,
        "31": 1, "32": 4,
    },
}
EXPECTED_BUS_COUNTS = {"read": 264, "write": 269}
EXPECTED_DISK_COUNTS = {
    "register": 16, "interrupt": 2, "request": 0,
    "block": 0, "completion": 0,
}
EXPECTED_DISK_REGISTER_COUNTS = {"read": 7, "write": 9}
EXPECTED_CAPTURE_ANCHORS = {
    "executable_sha256":
        "e08786f9e15de8c45fffe12609af102cf65067a986b25376090bc4d1664987e3",
    "raw_trace_sha256":
        "f9374dc219a4ef48d8c7d827346abb93e60f5eb168ac1375048778a6b31f9d22",
    "adapter_sha256":
        "75303b0246775e76cc2ac66da8c29d73db65c4e94e946f672262b1d70c36180a",
    "adapter_s0_sha256":
        "8d4bcefcc01bb9ea7ac128213385a55b6e362b5aced9bfff0bb53162e592b9ca",
    "adapter_final_sha256":
        "7e0a1220869382da3fe967f1b244b69049c5c14f4ed9a6a825f824cc48696ce3",
    "bus_sha256":
        "06a72c0084a8188c145afb31343c1d02252d62908ad66a1d7c6570b879ce9936",
    "bus_first": (503_533, 0, "read", 0, 0),
    "bus_last": (505_329, 0, "read", 4_063_228, 7),
    "disk_stream_sha256":
        "660c51dde4c2e2eb12223a74513d379ab8bdaea310d4d9ee67dbb4974b1c5c01",
    "disk_first": (505_079, 0, "register", "read", 0, 1),
    "disk_last": (505_329, 0, "register", "read", 0, 7),
    "disk_sha256":
        "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
}
BUS_KEYS = {
    "record", "post_slot_s", "intra_slot_sequence", "direction",
    "physical_word_address", "write_value", "read_result",
    "bus_error_after", "interrupt_status_after",
}
DISK_KEYS = {
    "record", "post_slot_s", "intra_slot_sequence", "action",
    "register_direction", "register_offset", "input_value", "returned_value",
    "command", "clp", "da", "lma", "status", "reset",
    "done_interrupt_enable", "attention_interrupt_enable", "interrupt_action",
    "request_ready", "request_direction", "request_clp", "request_cylinder",
    "request_head", "request_block", "selected_unit", "selected_configured",
    "selected_online", "selected_read_only", "selected_fault",
    "selected_attention", "selected_seek_error", "selected_cylinder",
    "selected_head", "selected_lba", "media_action",
}
BUS_NUMERIC_KEYS = BUS_KEYS - {"record", "direction"}
DISK_STRING_KEYS = {
    "record", "action", "register_direction", "interrupt_action",
    "request_direction", "media_action",
}
DISK_NUMERIC_KEYS = DISK_KEYS - DISK_STRING_KEYS
ADAPTER_HEADER = struct.Struct("<8sIIQQ")
ADAPTER_FOOTER = struct.Struct("<8sQI12s")
_CRC32C_TABLE: tuple[int, ...] | None = None
DETERMINISTIC_SOURCE_PREFIX = "/usr/src/cadr-m3-upstream"


class OracleError(ValueError):
    pass


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def crc32c(data: bytes) -> int:
    global _CRC32C_TABLE
    if _CRC32C_TABLE is None:
        table: list[int] = []
        for initial in range(256):
            value = initial
            for _ in range(8):
                value = (value >> 1) ^ (0x82f63b78 if value & 1 else 0)
            table.append(value & 0xffffffff)
        _CRC32C_TABLE = tuple(table)
    value = 0xffffffff
    for byte in data:
        value = _CRC32C_TABLE[(value ^ byte) & 0xff] ^ (value >> 8)
    return value ^ 0xffffffff


def padding(length: int) -> int:
    return (-length) & 7


def load_existing_oracle() -> Any:
    path = ROOT / "scripts" / "cadr-oracle.py"
    spec = importlib.util.spec_from_file_location("cadr_m3_upstream_oracle_base", path)
    if spec is None or spec.loader is None:
        raise OracleError("cannot load the mandatory native-oracle helper")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def disk_from_config(config: Path) -> Path:
    parser = configparser.ConfigParser(interpolation=None)
    with config.open(encoding="utf-8") as stream:
        parser.read_file(stream)
    try:
        value = parser["disk"]["disk0"]
        disk = Path(value.split(",", 1)[1])
    except (KeyError, IndexError, configparser.Error) as error:
        raise OracleError("cannot identify disk0 from oracle configuration") from error
    if not disk.is_absolute() or disk.is_symlink() or not disk.is_file():
        raise OracleError("configured disk0 is not an absolute regular non-symlink file")
    return disk


def copy_extended_source(prepared: Path, destination: Path) -> dict[str, str]:
    source = prepared / "source"
    if not source.is_dir():
        raise OracleError("prepared oracle source tree is unavailable")
    shutil.copytree(source, destination, symlinks=False)
    ucode = destination / "usim" / "ucode.c"
    native_oracle = destination / "usim" / "cadr_oracle_native.c"
    bus_adaptor = destination / "usim" / "bus-adaptor.c"
    disk_controller = destination / "usim" / "disk-controller.c"
    helpers = (
        ROOT / "cadr-web/host/cadr_m3_native_usim_boundary_adapter.c",
        ROOT / "cadr-web/host/cadr_m3_native_usim_bus_witness.c",
        ROOT / "cadr-web/host/cadr_m3_native_usim_disk_witness.c",
    )
    if any(not helper.is_file() for helper in helpers):
        raise OracleError("upstream adapter helper source is unavailable")
    text = ucode.read_text(encoding="utf-8")
    old = "const uint64_t oracle_slot_limit = 100000;"
    if text.count(old) != 1:
        raise OracleError("prepared source lacks the exact 100,000-slot oracle anchor")
    ucode.write_text(text.replace(old, "const uint64_t oracle_slot_limit = 1000000;"), encoding="utf-8")
    for helper in helpers:
        shutil.copyfile(helper, disk_controller.parent / helper.name)

    text = native_oracle.read_text(encoding="utf-8")
    native_declaration_anchor = "static FILE *trace_file;\n"
    native_declaration = (
        "static void cadr_m3_native_usim_adapter_boundary(uint32_t flags);\n"
        "static void cadr_m3_native_usim_adapter_finish(uint32_t terminal_status);\n"
    )
    if text.count(native_declaration_anchor) != 1:
        raise OracleError("native adapter declaration anchor is not exact")
    text = text.replace(
        native_declaration_anchor,
        native_declaration + native_declaration_anchor,
    )
    native_replacements = (
        (
            "size_t n=0; state_hash(state);\n    component_dump_boundary(state);",
            "size_t n=0; state_hash(state);\n"
            "    cadr_m3_native_usim_adapter_boundary(flags);\n"
            "    component_dump_boundary(state);",
        ),
        (
            "terminal_record(0,halted?0:1);\n"
            "    if (fflush(trace_file)||fclose(trace_file))",
            "terminal_record(0,halted?0:1);\n"
            "    cadr_m3_native_usim_adapter_finish(0u);\n"
            "    if (fflush(trace_file)||fclose(trace_file))",
        ),
    )
    for before, after in native_replacements:
        if text.count(before) != 1:
            raise OracleError(f"native adapter instrumentation anchor is not exact: {before!r}")
        text = text.replace(before, after)
    native_oracle.write_text(
        text + '\n#include "cadr_m3_native_usim_boundary_adapter.c"\n',
        encoding="utf-8",
    )

    text = bus_adaptor.read_text(encoding="utf-8")
    bus_declaration_anchor = "static void\nbus_adaptor_xbusio_rw"
    bus_declaration = (
        "static void cadr_m3_native_usim_bus_witness("
        "uint32_t direction, uint32_t physical_word_address, "
        "uint32_t write_value, uint32_t read_result);\n\n"
    )
    if text.count(bus_declaration_anchor) != 1:
        raise OracleError("bus adapter declaration anchor is not exact")
    text = text.replace(
        bus_declaration_anchor, bus_declaration + bus_declaration_anchor)
    bus_replacements = (
        (
            "    bus_adaptor_rw(false, paddr, pv);\n#ifdef WITH_CADR_ORACLE",
            "    bus_adaptor_rw(false, paddr, pv);\n"
            "    cadr_m3_native_usim_bus_witness(0u,paddr,0u,*pv);\n"
            "#ifdef WITH_CADR_ORACLE",
        ),
        (
            "    bus_adaptor_rw(true, paddr, &v);\n#ifdef WITH_CADR_ORACLE",
            "    bus_adaptor_rw(true, paddr, &v);\n"
            "    cadr_m3_native_usim_bus_witness(1u,paddr,v,0u);\n"
            "#ifdef WITH_CADR_ORACLE",
        ),
    )
    for before, after in bus_replacements:
        if text.count(before) != 1:
            raise OracleError(f"bus instrumentation anchor is not exact: {before!r}")
        text = text.replace(before, after)
    bus_adaptor.write_text(
        text + '\n#include "cadr_m3_native_usim_bus_witness.c"\n',
        encoding="utf-8",
    )

    text = disk_controller.read_text(encoding="utf-8")
    declaration = (
        "static void cadr_m3_native_usim_disk_witness("
        "uint32_t kind, uint32_t register_direction, "
        "uint32_t register_offset, uint32_t input_value, "
        "uint32_t returned_value);\n"
    )
    anchor = "// implementation may support >8 disks, \n"
    if text.count(anchor) != 1:
        raise OracleError("disk controller declaration anchor is not exact")
    text = text.replace(anchor, declaration + anchor)
    replacements = (
        (
            "status.interrupt_request = true;",
            "status.interrupt_request = true;\n"
            "    cadr_m3_native_usim_disk_witness(4u,0u,0u,0u,0u);",
        ),
        (
            "deassert_xbus_interrupt();",
            "deassert_xbus_interrupt();\n"
            "    cadr_m3_native_usim_disk_witness(5u,0u,0u,0u,0u);",
        ),
        (
            "xfer_req.ready = false;\n\n        set_status_not_active();",
            "xfer_req.ready = false;\n"
            "        cadr_m3_native_usim_disk_witness(3u,0u,0u,0u,0u);\n\n"
            "        set_status_not_active();",
        ),
        (
            "xfer_req.ready = true;\n\n#ifndef WITH_NONBLOCKING_DISKIO",
            "xfer_req.ready = true;\n"
            "    cadr_m3_native_usim_disk_witness(2u,0u,0u,0u,0u);\n\n"
            "#ifndef WITH_NONBLOCKING_DISKIO",
        ),
        (
            "    while (true)\n    {\n        uint32_t ccw;",
            "    while (true)\n    {\n"
            "        cadr_m3_native_usim_disk_witness(6u,0u,0u,0u,0u);\n"
            "        uint32_t ccw;",
        ),
        (
            "        *pv = 0;\n        return;\n    }\n\tswitch (offset)",
            "        *pv = 0;\n"
            "        cadr_m3_native_usim_disk_witness(1u,1u,offset,0u,*pv);\n"
            "        return;\n    }\n\tswitch (offset)",
        ),
        (
            "\t}\n}\n\nvoid\ndisk_controller_write",
            "\t}\n"
            "    cadr_m3_native_usim_disk_witness(1u,1u,offset,0u,*pv);\n"
            "}\n\nvoid\ndisk_controller_write",
        ),
        (
            "\t}\n}\n\nvoid \ndisk_controller_bus_reset",
            "\t}\n"
            "    cadr_m3_native_usim_disk_witness(1u,2u,offset,v,0u);\n"
            "}\n\nvoid \ndisk_controller_bus_reset",
        ),
    )
    for before, after in replacements:
        if text.count(before) != 1:
            raise OracleError(f"disk-controller instrumentation anchor is not exact: {before!r}")
        text = text.replace(before, after)
    disk_controller.write_text(text + "\n#include \"cadr_m3_native_usim_disk_witness.c\"\n", encoding="utf-8")
    return {
        "ceiling_adapter_sha256": hashlib.sha256(
            b"cadr-m3-upstream-native-usim-ceiling-v1\0" + old.encode() + b"1000000"
        ).hexdigest(),
        "boundary_adapter_sha256": sha256_file(helpers[0]),
        "bus_witness_sha256": sha256_file(helpers[1]),
        "disk_witness_sha256": sha256_file(helpers[2]),
        "extended_source_tree_sha256": tree_identity(destination),
    }


def tree_identity(root: Path) -> str:
    entries: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise OracleError("extended source tree contains a symlink")
        if path.is_file():
            entries.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)})
    return hashlib.sha256(canonical_json(entries)).hexdigest()


def deterministic_build_arguments(source: Path) -> tuple[list[str], dict[str, str]]:
    source_path = str(source.resolve())
    common_template = (
        "-std=gnu99 -Wall -Wextra -I. -O3 -ggdb3 -DNDEBUG=1 "
        f"-ffile-prefix-map=<copied-source>={DETERMINISTIC_SOURCE_PREFIX} "
        f"-fdebug-prefix-map=<copied-source>={DETERMINISTIC_SOURCE_PREFIX} "
        f"-fmacro-prefix-map=<copied-source>={DETERMINISTIC_SOURCE_PREFIX}"
    )
    common = common_template.replace("<copied-source>", source_path)
    policy = {
        "cflags_template": common_template,
        "ldflags": "-no-pie -Wl,--build-id=sha1",
        "source_date_epoch": "0",
        "mapped_source_prefix": DETERMINISTIC_SOURCE_PREFIX,
    }
    return [
        f"CFLAGS={common}",
        "LDFLAGS=-no-pie -Wl,--build-id=sha1",
    ], policy


def parse_tlvs(payload: bytes) -> dict[int, tuple[bool, bytes]]:
    offset = 0
    prior = 0
    values: dict[int, tuple[bool, bytes]] = {}
    while offset < len(payload):
        if len(payload) - offset < TLV.size:
            raise OracleError("truncated TLV header")
        kind, flags, length = TLV.unpack_from(payload, offset)
        if kind == 0 or flags & ~1 or kind <= prior:
            raise OracleError("noncanonical TLV ordering or flags")
        end = offset + TLV.size + length
        padded = end + padding(TLV.size + length)
        if end > len(payload) or padded > len(payload) or payload[end:padded] != b"\0" * (padded - end):
            raise OracleError("truncated or nonzero-padded TLV")
        values[kind] = (bool(flags & 1), payload[offset + TLV.size:end])
        prior = kind
        offset = padded
    return values


def value(tlvs: dict[int, tuple[bool, bytes]], kind: int, width: int) -> bytes:
    try:
        critical, result = tlvs[kind]
    except KeyError as error:
        raise OracleError(f"record lacks required TLV {kind}") from error
    if not critical or len(result) != width:
        raise OracleError(f"record TLV {kind} has wrong criticality or width")
    return result


def records(stream: BinaryIO) -> Iterator[tuple[int, int, int, bytes]]:
    sequence = 0
    previous_cycle = 0
    while True:
        prefix = stream.read(RECORD.size)
        if not prefix:
            return
        if len(prefix) != RECORD.size:
            raise OracleError("truncated record header")
        total, kind, flags, index, cycle, payload_length, reserved = RECORD.unpack(prefix)
        if (total < 40 or total % 8 or total > MAX_RECORD or payload_length > MAX_PAYLOAD or
                flags or reserved or index != sequence or (sequence and cycle < previous_cycle)):
            raise OracleError("invalid raw CDRTRC1 record framing")
        trailing = total - RECORD.size
        body = stream.read(trailing)
        if len(body) != trailing:
            raise OracleError("truncated record body")
        expected_padding = padding(RECORD.size + payload_length + 4)
        if trailing != payload_length + expected_padding + 4 or body[payload_length:payload_length + expected_padding] != b"\0" * expected_padding:
            raise OracleError("raw record length or padding disagrees")
        whole = prefix + body
        if U32.unpack_from(whole, total - 4)[0] != crc32c(whole[:-4]):
            raise OracleError("raw record CRC-32C disagrees")
        yield kind, cycle, sequence, whole[RECORD.size:RECORD.size + payload_length]
        sequence += 1
        previous_cycle = cycle


def normalize_trace(
    trace: Path,
    output: Path | None,
    *,
    expected_slots: int = SLOTS,
    baseline: Path | None = None,
) -> dict[str, Any]:
    target: TextIO | None = None
    baseline_stream: TextIO | None = None
    with trace.open("rb") as source:
        header = source.read(HEADER.size)
        if len(header) != HEADER.size:
            raise OracleError("trace has no complete header")
        magic, version, header_bytes, flags, declared, uuid, reserved, checksum = HEADER.unpack(header)
        expected_records = expected_slots + 2
        if (magic != b"CDRTRC1\0" or version != 1 or header_bytes != HEADER.size or
                flags or reserved != b"\0" * 20 or
                checksum != crc32c(header[:60]) or declared != expected_records):
            raise OracleError("trace is not the exact extended native-oracle framing")
        mutation_next = 0
        boundaries = 0
        terminal: tuple[int, int] | None = None
        final_semantic = b""
        identity_bundle = b""
        identity_components: list[bytes] = []
        try:
            if output is not None:
                target = output.open("w", encoding="ascii", newline="\n")
                target.write(json.dumps({
                    "schema": "cadr-m3-upstream-native-boundary",
                    "schema_version": 1,
                    "comparison_disposition": "adapter-required",
                    "ordinal_contract":
                        "S0=post-boot; S(n>0)=post-slot(n-1); "
                        "raw_machine_cycles=S(n) after ucode.c increment",
                    "requested_post_slot_s": expected_slots,
                }, sort_keys=True, separators=(",", ":")) + "\n")
            if baseline is not None:
                if sha256_file(baseline) != BASELINE_NORMALIZED_SHA256:
                    raise OracleError("prior million-slot normalized baseline identity drifted")
                baseline_stream = baseline.open("r", encoding="ascii")
                metadata = json.loads(baseline_stream.readline())
                if metadata.get("requested_post_slot_s") != expected_slots:
                    raise OracleError("prior baseline has the wrong slot limit")
            for kind, cycle, sequence, payload in records(source):
                tlvs = parse_tlvs(payload)
                if kind == BOUNDARY:
                    predecessor_value = value(tlvs, 1, 32)
                    state = value(tlvs, 2, 32)
                    mutation = value(tlvs, 3, 32)
                    ordinal = U64.unpack(value(tlvs, 4, 8))[0]
                    first = U64.unpack(value(tlvs, 6, 8))[0]
                    count = U64.unpack(value(tlvs, 7, 8))[0]
                    boundary_flags = U32.unpack(value(tlvs, 8, 4))[0]
                    slot = None if ordinal == 0 else U64.unpack(value(tlvs, 5, 8))[0]
                    if ordinal != boundaries or first != mutation_next:
                        raise OracleError("boundary or mutation ordinals are not contiguous")
                    if ordinal == 0:
                        if (cycle != 0 or slot is not None or boundary_flags != S0 or
                                predecessor_value != b"\0" * 32):
                            raise OracleError("S0 does not establish the pinned post-boot convention")
                        identity_bundle = tlvs.get(100, (True, b""))[1]
                        identity_components = [
                            tlvs.get(number, (True, b""))[1]
                            for number in range(101, 109)
                        ]
                        if (len(identity_bundle) != 32 or
                                any(len(item) != 32 for item in identity_components)):
                            raise OracleError("S0 identity block is incomplete")
                        derived = hashlib.sha256(
                            b"CDRIDENT1\0" + b"".join(identity_components)).digest()
                        if identity_bundle != derived or uuid != derived[:16]:
                            raise OracleError("S0 identity does not bind the trace header")
                    else:
                        if (slot != ordinal - 1 or cycle != ordinal or
                                predecessor_value != final_semantic):
                            raise OracleError(
                                "raw machine_cycles cannot be reconciled to post-slot S ordinal")
                        if boundary_flags & (EXECUTED | INHIBITED) not in (
                                EXECUTED, INHIBITED):
                            raise OracleError(
                                "boundary activity is not executed xor inhibited")
                    if count == 0 and mutation != EMPTY_MUTATION_SHA256:
                        raise OracleError(
                            "zero mutation boundary has noncanonical mutation digest")
                    semantic = hashlib.sha256(b"CDRBOUND1\0" + payload).digest()
                    final_semantic = semantic
                    mutation_next += count
                    normalized = {
                        "record": "boundary", "s": ordinal,
                        "raw_machine_cycles": cycle, "post_slot_s": ordinal,
                        "pre_slot": slot, "first_mutation": first,
                        "mutation_count": count, "flags": boundary_flags,
                        "state_sha256": state.hex(),
                        "mutation_sha256": mutation.hex(),
                        "oracle_semantic_sha256": semantic.hex(),
                    }
                    if baseline_stream is not None:
                        line = baseline_stream.readline()
                        if not line:
                            raise OracleError(f"prior baseline ended before S{ordinal}")
                        expected = json.loads(line)
                        for field in (
                            "record", "s", "raw_machine_cycles", "post_slot_s",
                            "pre_slot", "first_mutation", "mutation_count",
                            "flags", "state_sha256", "mutation_sha256",
                        ):
                            if expected.get(field) != normalized[field]:
                                raise OracleError(
                                    f"instrumentation changed S{ordinal} field {field}")
                    if target is not None:
                        target.write(json.dumps(
                            normalized, sort_keys=True,
                            separators=(",", ":")) + "\n")
                    boundaries += 1
                elif kind == TERMINAL:
                    status = U32.unpack(value(tlvs, 4, 4))[0]
                    reason = U32.unpack(value(tlvs, 5, 4))[0]
                    final_count = U64.unpack(value(tlvs, 1, 8))[0]
                    final_boundary = U64.unpack(value(tlvs, 2, 8))[0]
                    final_hash = value(tlvs, 3, 32)
                    if (sequence != expected_records - 1 or
                            final_count != expected_records or
                            final_boundary != expected_slots or
                            final_hash != final_semantic or status != 0 or reason != 1):
                        raise OracleError(
                            "trace terminal is not an exact limit-reached S1,000,000 prefix")
                    terminal = (status, reason)
                    terminal_object = {
                        "record": "terminal", "s": expected_slots,
                        "status": status, "reason": reason,
                    }
                    if target is not None:
                        target.write(json.dumps(
                            terminal_object, sort_keys=True,
                            separators=(",", ":")) + "\n")
                    if baseline_stream is not None:
                        expected = json.loads(baseline_stream.readline())
                        if expected != {
                            "reason": reason, "record": "terminal",
                            "s": expected_slots, "status": status,
                        }:
                            raise OracleError("prior baseline terminal disagrees")
                        if baseline_stream.readline():
                            raise OracleError("prior baseline has trailing records")
                else:
                    raise OracleError(
                        "extended native capture contains a non-boundary event record")
        finally:
            if target is not None:
                target.close()
            if baseline_stream is not None:
                baseline_stream.close()
        if boundaries != expected_slots + 1 or terminal != (0, 1):
            raise OracleError("extended native capture ended before S1,000,000")
    return {
        "boundary_count": boundaries,
        "identity_bundle_sha256": identity_bundle.hex(),
        "identity_components": [item.hex() for item in identity_components],
        "normalized_sha256": sha256_file(output) if output is not None else None,
        "prior_baseline_sha256": (
            BASELINE_NORMALIZED_SHA256 if baseline is not None else None),
        "observational_noninterference": baseline is not None,
    }


def inspect_adapter(path: Path, expected_slots: int = SLOTS) -> dict[str, Any]:
    size = path.stat().st_size
    expected_count = expected_slots + 1
    expected_size = ADAPTER_HEADER.size + expected_count * 32 + ADAPTER_FOOTER.size
    if size != expected_size:
        raise OracleError("CDRM3AD1 byte size does not match its exact boundary count")
    with path.open("rb") as stream:
        header = stream.read(ADAPTER_HEADER.size)
        magic, schema, digest_bytes, count, slots = ADAPTER_HEADER.unpack(header)
        if (magic != b"CDRM3AD1" or schema != 1 or digest_bytes != 32 or
                count != expected_count or slots != expected_slots):
            raise OracleError("CDRM3AD1 header is not the selected exact framing")
        first = stream.read(32)
        stream.seek(ADAPTER_HEADER.size + expected_slots * 32)
        last = stream.read(32)
        footer = stream.read(ADAPTER_FOOTER.size)
        footer_magic, observed, terminal, reserved = ADAPTER_FOOTER.unpack(footer)
        if (footer_magic != b"CDRM3AE1" or observed != expected_count or
                terminal != 0 or reserved != b"\0" * 12):
            raise OracleError("CDRM3AD1 footer is incomplete or noncanonical")
    return {
        "schema": "CDRM3AD1", "schema_version": 1,
        "boundary_count": expected_count, "requested_slots": expected_slots,
        "bytes": size, "sha256": sha256_file(path),
        "s0_sha256": first.hex(), "final_sha256": last.hex(),
    }


def _canonical_event_line(raw: str, line_number: int) -> dict[str, Any]:
    try:
        item = json.loads(raw)
    except json.JSONDecodeError as error:
        raise OracleError(f"event line {line_number} is not JSON") from error
    if raw != json.dumps(item, sort_keys=True, separators=(",", ":")):
        raise OracleError(f"event line {line_number} is not canonical compact JSON")
    if not isinstance(item, dict):
        raise OracleError(f"event line {line_number} is not an object")
    return item


def inspect_events(
    path: Path, schema: str, keys: set[str],
    expected_counts: dict[str, int], expected_slots: int = SLOTS,
) -> dict[str, Any]:
    counts = {name: 0 for name in expected_counts}
    register_counts = {"read": 0, "write": 0}
    prior_s = -1
    expected_sequence = 0
    first: dict[str, Any] | None = None
    last: dict[str, Any] | None = None
    with path.open("r", encoding="utf-8", newline="") as stream:
        metadata_raw = stream.readline()
        if not metadata_raw.endswith("\n"):
            raise OracleError(f"{schema} metadata is not LF-terminated")
        metadata = _canonical_event_line(metadata_raw[:-1], 1)
        if metadata != {
            "requested_slots": expected_slots,
            "schema": schema,
            "schema_version": 1,
        }:
            raise OracleError(f"{schema} metadata is not the selected profile")
        for line_number, raw in enumerate(stream, 2):
            if not raw.endswith("\n"):
                raise OracleError(f"{schema} line {line_number} is not LF-terminated")
            item = _canonical_event_line(raw[:-1], line_number)
            if set(item) != keys:
                raise OracleError(f"{schema} line {line_number} has the wrong key inventory")
            numeric_keys = (
                BUS_NUMERIC_KEYS if schema == "CDRM3BUS1"
                else DISK_NUMERIC_KEYS)
            if any(
                isinstance(item[name], bool) or not isinstance(item[name], int) or
                item[name] < 0 or item[name] > 0xffffffffffffffff
                for name in numeric_keys
            ):
                raise OracleError(
                    f"{schema} line {line_number} has a non-unsigned numeric field")
            s = item["post_slot_s"]
            sequence = item["intra_slot_sequence"]
            if (isinstance(s, bool) or not isinstance(s, int) or
                    s < 1 or s > expected_slots or
                    isinstance(sequence, bool) or not isinstance(sequence, int) or
                    sequence < 0):
                raise OracleError(f"{schema} line {line_number} has invalid ordinals")
            if s != prior_s:
                if s < prior_s:
                    raise OracleError(f"{schema} post-slot order decreases")
                prior_s = s
                expected_sequence = 0
            if sequence != expected_sequence:
                raise OracleError(
                    f"{schema} S{s} intra-slot sequence is not contiguous")
            expected_sequence += 1
            if schema == "CDRM3BUS1":
                direction = item["direction"]
                if (item["record"] != "bus" or direction not in counts or
                        (direction == "read" and item["write_value"] != 0) or
                        (direction == "write" and item["read_result"] != 0)):
                    raise OracleError(f"{schema} line {line_number} has invalid direction fields")
                counts[direction] += 1
            else:
                action = item["action"]
                if (item["record"] != "disk" or action not in counts or
                        item["register_direction"] not in ("read", "write", "none") or
                        item["interrupt_action"] not in ("assert", "deassert", "none") or
                        item["request_direction"] not in ("read", "compare", "none") or
                        item["media_action"] not in (
                            "request", "block", "completion", "none")):
                    raise OracleError(f"{schema} line {line_number} has invalid action fields")
                counts[action] += 1
                if action == "register":
                    if item["register_direction"] not in register_counts:
                        raise OracleError(
                            f"{schema} line {line_number} register lacks read/write direction")
                    register_counts[item["register_direction"]] += 1
                elif item["register_direction"] != "none":
                    raise OracleError(
                        f"{schema} line {line_number} non-register has register direction")
            if first is None:
                first = item
            last = item
    if counts != expected_counts:
        raise OracleError(f"{schema} event counts disagree: {counts}")
    if schema == "CDRM3DISK1":
        if register_counts != EXPECTED_DISK_REGISTER_COUNTS:
            raise OracleError(
                f"CDRM3DISK1 register direction counts disagree: {register_counts}")
        if any(counts[name] for name in ("request", "block", "completion")):
            raise OracleError("CDRM3DISK1 media streams are not empty")
    return {
        "schema": schema, "schema_version": 1, "counts": counts,
        "register_counts": register_counts if schema == "CDRM3DISK1" else None,
        "event_count": sum(counts.values()), "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "first_event": first, "last_event": last,
        "media_streams_empty": (
            not any(counts[name] for name in ("request", "block", "completion"))
            if schema == "CDRM3DISK1" else None),
    }


def capture(
    prepared_value: str, config_value: str, output_value: str,
    timeout: int, baseline_value: str = str(BASELINE_OUTPUT),
) -> dict[str, Any]:
    base = load_existing_oracle()
    prepared, marker = base.load_prepare_marker(ROOT, prepared_value)
    config = (ROOT / config_value).resolve()
    if not config.is_file() or config.is_symlink():
        raise OracleError("config must be a regular repository file")
    disk = disk_from_config(config)
    output = (ROOT / output_value).resolve()
    allowed_output = (ROOT / "build/cadr-oracle").resolve()
    try:
        output.relative_to(allowed_output)
    except ValueError as error:
        raise OracleError("output must be a new directory below build/cadr-oracle") from error
    if output == allowed_output or output.exists():
        raise OracleError("output must be a new directory below build/cadr-oracle")
    output.parent.mkdir(parents=True, exist_ok=True)
    before = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
    stage = Path(tempfile.mkdtemp(prefix=".m3-upstream-", dir=output.parent))
    try:
        extended = stage / "extended-source"
        adapter = copy_extended_source(prepared, extended)
        build_arguments, build_policy = deterministic_build_arguments(extended)
        completed = subprocess.run([
            "make", "-f", "Makefile.usim", "USIM_BACKEND=oracle",
            "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos",
            *build_arguments,
        ], cwd=extended / "usim", env={
            **os.environ, "SOURCE_DATE_EPOCH": "0",
        }, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if completed.returncode:
            raise OracleError("extended native oracle build failed: " + completed.stderr[-2000:])
        executable = extended / "usim" / "usim"
        trace = stage / "raw-trace.cdrtrc1"
        report = stage / "prefix-report.json"
        adapter_path = stage / "adapter.cdrm3ad1"
        bus_path = stage / "bus.cdrm3bus1.ndjson"
        disk_path = stage / "disk.cdrm3disk1.ndjson"
        environment = {"PATH": os.environ.get("PATH", ""), "LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                       "CADR_ORACLE_TRACE": str(trace), "CADR_ORACLE_REPORT": str(report),
                       "CADR_M3_UPSTREAM_ADAPTER": str(adapter_path),
                       "CADR_M3_UPSTREAM_BUS": str(bus_path),
                       "CADR_M3_UPSTREAM_DISK": str(disk_path)}
        # Reuse the mandatory capture identity components but bind the extended executable and adapter separately.
        components = [marker["profile_sha256"], marker["source_manifest_sha256"], marker["instrumentation_patch"]["sha256"],
                      sha256_file(executable), sha256_file(config), before["sha256"], adapter["extended_source_tree_sha256"],
                      hashlib.sha256(canonical_json(adapter)).hexdigest()]
        bundle, uuid = base.identity_bundle(components)
        for name, digest in zip(("CADR_ORACLE_PROFILE_SHA256", "CADR_ORACLE_SOURCE_MANIFEST_SHA256", "CADR_ORACLE_PATCH_SHA256", "CADR_ORACLE_EXECUTABLE_SHA256", "CADR_ORACLE_CONFIG_SHA256", "CADR_ORACLE_DISK_SHA256", "CADR_ORACLE_PREPARED_TREE_SHA256", "CADR_ORACLE_INPUT_AGGREGATE_SHA256"), components, strict=True):
            environment[name] = digest
        environment["CADR_ORACLE_UUID"] = uuid
        run = subprocess.run([str(executable), "-c", str(config)], cwd=executable.parent, env=environment,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False, timeout=timeout)
        (stage / "stdout.log").write_text(run.stdout, encoding="utf-8")
        (stage / "stderr.log").write_text(run.stderr, encoding="utf-8")
        if run.returncode:
            raise OracleError("extended native oracle exited %d: %s" % (run.returncode, run.stderr[-1000:]))
        prefix_report, _ = base.load_json(report, "extended prefix report")
        if prefix_report != EXPECTED_PREFIX_REPORT:
            raise OracleError("extended prefix counts or family anchors changed")
        baseline_root = (ROOT / baseline_value).resolve()
        baseline = baseline_root / "native-boundaries.ndjson"
        if not baseline.is_file():
            raise OracleError("prior million-slot noninterference baseline is unavailable")
        normalized = normalize_trace(trace, None, baseline=baseline)
        adapter_result = inspect_adapter(adapter_path)
        bus_result = inspect_events(
            bus_path, "CDRM3BUS1", BUS_KEYS, EXPECTED_BUS_COUNTS)
        disk_result = inspect_events(
            disk_path, "CDRM3DISK1", DISK_KEYS, EXPECTED_DISK_COUNTS)
        after = {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)}
        if before != after:
            raise OracleError("selected disk changed during extended native-oracle capture")
        bus_first = bus_result["first_event"]
        bus_last = bus_result["last_event"]
        disk_first = disk_result["first_event"]
        disk_last = disk_result["last_event"]
        observed_anchors = {
            "executable_sha256": sha256_file(executable),
            "raw_trace_sha256": sha256_file(trace),
            "adapter_sha256": adapter_result["sha256"],
            "adapter_s0_sha256": adapter_result["s0_sha256"],
            "adapter_final_sha256": adapter_result["final_sha256"],
            "bus_sha256": bus_result["sha256"],
            "bus_first": (
                bus_first["post_slot_s"], bus_first["intra_slot_sequence"],
                bus_first["direction"], bus_first["physical_word_address"],
                bus_first["read_result"]),
            "bus_last": (
                bus_last["post_slot_s"], bus_last["intra_slot_sequence"],
                bus_last["direction"], bus_last["physical_word_address"],
                bus_last["read_result"]),
            "disk_stream_sha256": disk_result["sha256"],
            "disk_first": (
                disk_first["post_slot_s"], disk_first["intra_slot_sequence"],
                disk_first["action"], disk_first["register_direction"],
                disk_first["register_offset"], disk_first["returned_value"]),
            "disk_last": (
                disk_last["post_slot_s"], disk_last["intra_slot_sequence"],
                disk_last["action"], disk_last["register_direction"],
                disk_last["register_offset"], disk_last["returned_value"]),
            "disk_sha256": after["sha256"],
        }
        if observed_anchors != EXPECTED_CAPTURE_ANCHORS:
            raise OracleError(
                f"million-slot artifact anchors changed: {observed_anchors}")
        metadata = {"schema": "cadr-m3-upstream-native-oracle", "schema_version": 1, "requested_post_slot_s": SLOTS,
                    "mandatory_100k_oracle": {"prepared": prepared_value, "prepare_sha256": sha256_file(prepared / "prepare.json"),
                                               "build_sha256": sha256_file(prepared / "build.json")},
                    "adapter": adapter, "executable": {"bytes": executable.stat().st_size, "sha256": sha256_file(executable)},
                    "deterministic_build": build_policy,
                    "disk": {"pre": before, "post": after}, "identity_bundle_sha256": bundle,
                    "trace": {"path": "raw-trace.cdrtrc1", "bytes": trace.stat().st_size, "sha256": sha256_file(trace)},
                    "boundaries": normalized, "adapter_stream": adapter_result,
                    "bus_stream": bus_result, "disk_stream": disk_result,
                    "pinned_anchors": observed_anchors,
                    "prefix_report": prefix_report,
                    "comparison": {
                        "format": "CDRM3AD1+CDRM3BUS1+CDRM3DISK1",
                        "direct_common_projection_comparison": "available",
                        "full_CDRTRC1_to_CDRSTATE1_CDRSTATE2_comparison": "not-defined",
                    }}
        (stage / "capture.json").write_bytes(canonical_json(metadata))
        os.replace(stage, output)
        return metadata
    except subprocess.TimeoutExpired as error:
        raise OracleError(f"extended native oracle exceeded {timeout} seconds") from error
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    capture_parser = commands.add_parser("capture")
    capture_parser.add_argument("--prepared", required=True, help="mandatory 100k prepared oracle below build/cadr-oracle")
    capture_parser.add_argument("--config", required=True, help="repository-relative native oracle config")
    capture_parser.add_argument("--output", required=True, help="new ignored directory below build/cadr-oracle")
    capture_parser.add_argument("--timeout", type=int, default=900)
    capture_parser.add_argument(
        "--baseline", default=str(BASELINE_OUTPUT),
        help="prior ignored million-slot capture used for noninterference")
    args = parser.parse_args(argv)
    try:
        if args.timeout <= 0:
            raise OracleError("timeout must be positive")
        response = capture(
            args.prepared, args.config, args.output, args.timeout,
            args.baseline)
        print(json.dumps(response, sort_keys=True, separators=(",", ":")))
        return 0
    except (OracleError, OSError, ValueError) as error:
        print(f"cadr-m3-upstream-native-oracle: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
