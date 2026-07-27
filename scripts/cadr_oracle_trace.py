#!/usr/bin/env python3
"""Fail-closed CADR native-oracle trace-v1 codec.

The codec deliberately only transforms bytes.  The native oracle owns capture and
persistence; this module makes its resulting evidence format deterministic and
rejects incomplete or semantically inconsistent traces.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import struct
from typing import Sequence


MAGIC = b"CDRTRC1\0"
VERSION = 1
HEADER_SIZE = 64
RECORD_HEADER_SIZE = 32
RECORD_CRC_SIZE = 4
MIN_RECORD_SIZE = 40
MAX_RECORD_LENGTH = 16 * 1024 * 1024
MAX_PAYLOAD_LENGTH = 16 * 1024 * 1024
MAX_RECORD_COUNT = 1_000_000
STREAMING_RECORD_COUNT = (1 << 64) - 1

KIND_BOUNDARY_HASH = 1
KIND_CHECKPOINT = 2  # Reserved: v1 represents checkpoints with a boundary flag.
KIND_EXTERNAL_EVENT = 3
KIND_TERMINAL = 4

BOUNDARY_S0 = 1
BOUNDARY_EXECUTED = 2
BOUNDARY_INHIBITED = 4
BOUNDARY_CHECKPOINT = 8
BOUNDARY_HALT = 16
BOUNDARY_KNOWN_FLAGS = (
    BOUNDARY_S0 | BOUNDARY_EXECUTED | BOUNDARY_INHIBITED |
    BOUNDARY_CHECKPOINT | BOUNDARY_HALT
)

TERMINAL_COMPLETE = 0
TERMINAL_ABORT = 1
TERMINAL_ORACLE_FAILURE = 2

TERMINAL_REASON_COMPLETE_HALT = 0
TERMINAL_REASON_COMPLETE_LIMIT = 1
TERMINAL_REASON_ABORTED = 2
TERMINAL_REASON_ORACLE_FAILURE = 3
# Descriptive aliases retained for callers that render prose rather than status
# names.  Both pairs have identical wire values.
TERMINAL_REASON_GUEST_HALT = TERMINAL_REASON_COMPLETE_HALT
TERMINAL_REASON_LIMIT_REACHED = TERMINAL_REASON_COMPLETE_LIMIT

# This is the only legal mutation digest for a boundary with no mutations.  It
# cannot collide with SHA-256 of a bare empty byte string by accident.
EMPTY_MUTATION_SHA256 = hashlib.sha256(b"CDRMUT1\0").digest()
ZERO_SHA256 = b"\0" * 32
NO_BOUNDARY_ORDINAL = STREAMING_RECORD_COUNT
IDENTITY_BUNDLE_TLV = 100
IDENTITY_PROFILE_TLV = 101
IDENTITY_COMPONENT_TLVS = tuple(range(101, 109))
IDENTITY_TLVS = tuple(range(100, 109))

_HEADER = struct.Struct("<8sHHIQ16s20sI")
_RECORD = struct.Struct("<IHHQQII")
_TLV = struct.Struct("<HHI")
_U32 = struct.Struct("<I")
_U64 = struct.Struct("<Q")
_CRC32C_TABLE: tuple[int, ...] | None = None


class TraceError(ValueError):
    """A trace is malformed or violates the trace-v1 contract."""


@dataclass(frozen=True)
class TraceTLV:
    type: int
    critical: bool
    value: bytes


@dataclass(frozen=True)
class TraceRecord:
    kind: int
    sequence: int
    logical_cycle: int
    tlvs: tuple[TraceTLV, ...]
    chain_hash: bytes


def _crc32c_table() -> tuple[int, ...]:
    global _CRC32C_TABLE
    if _CRC32C_TABLE is None:
        table: list[int] = []
        for initial in range(256):
            value = initial
            for _ in range(8):
                value = (value >> 1) ^ (0x82F63B78 if value & 1 else 0)
            table.append(value & 0xFFFFFFFF)
        _CRC32C_TABLE = tuple(table)
    return _CRC32C_TABLE


def crc32c(data: bytes) -> int:
    """Return the Castagnoli CRC-32C of *data* as an unsigned integer."""
    value = 0xFFFFFFFF
    for byte in data:
        value = _crc32c_table()[(value ^ byte) & 0xFF] ^ (value >> 8)
    return value ^ 0xFFFFFFFF


def _padding(length: int) -> int:
    return (-length) & 7


def _record_padding(payload_length: int) -> int:
    return (-(RECORD_HEADER_SIZE + payload_length + RECORD_CRC_SIZE)) & 7


def _require_uint(value: int, bits: int, field: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value < (1 << bits):
        raise TraceError(f"{field} is not an unsigned {bits}-bit integer")


def _require_bytes(value: bytes, length: int, field: str) -> None:
    if not isinstance(value, bytes) or len(value) != length:
        raise TraceError(f"{field} must be exactly {length} bytes")


def _sha256(domain: bytes, *parts: bytes) -> bytes:
    digest = hashlib.sha256()
    digest.update(domain)
    for part in parts:
        digest.update(part)
    return digest.digest()


def identity_bundle(identity_components: Sequence[bytes]) -> bytes:
    """Derive the S0 identity bundle from the exact eight ordered components."""
    if len(identity_components) != 8:
        raise TraceError("identity bundle requires exactly eight components")
    normalized: list[bytes] = []
    for index, component in enumerate(identity_components):
        _require_bytes(component, 32, f"identity component {index + 1}")
        normalized.append(component)
    return _sha256(b"CDRIDENT1\0", *normalized)


def encode_header(record_count: int, trace_uuid: bytes) -> bytes:
    """Encode a v1 header.

    ``STREAMING_RECORD_COUNT`` means that the terminal record, rather than the
    header, supplies the authoritative count.
    """
    _require_uint(record_count, 64, "record_count")
    if record_count != STREAMING_RECORD_COUNT and record_count > MAX_RECORD_COUNT:
        raise TraceError("record_count exceeds the conservative trace-v1 limit")
    _require_bytes(trace_uuid, 16, "trace_uuid")
    prefix = _HEADER.pack(MAGIC, VERSION, HEADER_SIZE, 0, record_count, trace_uuid, b"\0" * 20, 0)[:60]
    return prefix + _U32.pack(crc32c(prefix))


def _validate_header(header: bytes) -> tuple[int, bytes]:
    if not isinstance(header, bytes) or len(header) != HEADER_SIZE:
        raise TraceError("trace header must be exactly 64 bytes")
    magic, version, header_size, flags, count, trace_uuid, reserved, checksum = _HEADER.unpack(header)
    if magic != MAGIC:
        raise TraceError("bad trace magic")
    if version != VERSION or header_size != HEADER_SIZE:
        raise TraceError("unsupported trace version or header size")
    if flags or reserved != b"\0" * 20:
        raise TraceError("trace header flags or reserved bytes are nonzero")
    if count != STREAMING_RECORD_COUNT and count > MAX_RECORD_COUNT:
        raise TraceError("record_count exceeds the conservative trace-v1 limit")
    if checksum != crc32c(header[:60]):
        raise TraceError("trace header CRC-32C does not match")
    return count, trace_uuid


def header_chain_hash(header: bytes) -> bytes:
    """Return H0, the outer file-record chain root, after validating *header*."""
    _validate_header(header)
    return _sha256(b"CDRTRC1-HDR\0", header[:60])


def encode_tlv(type: int, value: bytes, *, critical: bool = False) -> bytes:
    _require_uint(type, 16, "TLV type")
    if type == 0:
        raise TraceError("TLV type zero is reserved")
    if not isinstance(value, bytes):
        raise TraceError("TLV value must be bytes")
    _require_uint(len(value), 32, "TLV length")
    flags = 1 if critical else 0
    encoded = _TLV.pack(type, flags, len(value)) + value
    return encoded + (b"\0" * _padding(len(encoded)))


def _encode_tlvs(tlvs: Sequence[TraceTLV]) -> bytes:
    previous = 0
    encoded: list[bytes] = []
    for tlv in tlvs:
        if not isinstance(tlv, TraceTLV):
            raise TraceError("record TLVs must be TraceTLV values")
        if tlv.type <= previous:
            raise TraceError("TLV types must be strictly increasing and unique")
        previous = tlv.type
        encoded.append(encode_tlv(tlv.type, tlv.value, critical=tlv.critical))
    return b"".join(encoded)


def encode_record(kind: int, sequence: int, logical_cycle: int, tlvs: Sequence[TraceTLV]) -> bytes:
    """Encode a canonical envelope.  Semantic validation occurs in ``parse_trace``."""
    _require_uint(kind, 16, "record kind")
    if kind not in (KIND_BOUNDARY_HASH, KIND_EXTERNAL_EVENT, KIND_TERMINAL):
        raise TraceError("unknown or reserved record kind")
    _require_uint(sequence, 64, "sequence")
    _require_uint(logical_cycle, 64, "logical_cycle")
    payload = _encode_tlvs(tlvs)
    if len(payload) > MAX_PAYLOAD_LENGTH:
        raise TraceError("payload exceeds the conservative trace-v1 limit")
    padding = _record_padding(len(payload))
    total = RECORD_HEADER_SIZE + len(payload) + padding + RECORD_CRC_SIZE
    if total > MAX_RECORD_LENGTH:
        raise TraceError("record exceeds the conservative trace-v1 limit")
    body = _RECORD.pack(total, kind, 0, sequence, logical_cycle, len(payload), 0)
    body += payload + (b"\0" * padding)
    return body + _U32.pack(crc32c(body))


def record_chain_hash(predecessor_hash: bytes, record: bytes) -> bytes:
    """Return an outer file-record chain value H(i), excluding the record CRC."""
    _require_bytes(predecessor_hash, 32, "predecessor_hash")
    if len(record) < MIN_RECORD_SIZE:
        raise TraceError("record is shorter than trace-v1 minimum")
    total = _U32.unpack_from(record)[0]
    if total != len(record) or total % 8 or total < MIN_RECORD_SIZE:
        raise TraceError("record length is not a valid trace-v1 length")
    if _U32.unpack_from(record, total - 4)[0] != crc32c(record[:-4]):
        raise TraceError("record CRC-32C does not match")
    return _sha256(b"CDRTRC1-REC\0", predecessor_hash, record[:-4])


def semantic_boundary_hash(payload: bytes) -> bytes:
    """Return a boundary's semantic-chain hash from its canonical TLV payload."""
    if not isinstance(payload, bytes):
        raise TraceError("boundary payload must be bytes")
    # Parse to ensure an arbitrary caller cannot label malformed bytes canonical.
    if _encode_tlvs(_parse_tlvs(payload)) != payload:
        raise TraceError("boundary payload is not canonical TLV encoding")
    return _sha256(b"CDRBOUND1\0", payload)


def boundary_record(
    sequence: int,
    logical_cycle: int,
    predecessor_semantic_hash: bytes,
    state_sha256: bytes,
    mutation_sha256: bytes,
    boundary_ordinal: int,
    clock_slot_ordinal: int | None,
    first_mutation_ordinal: int,
    mutation_count: int,
    flags: int,
    identity_components: Sequence[bytes] | None = None,
) -> bytes:
    """Encode one boundary.  ``parse_trace`` validates cross-boundary invariants."""
    _require_bytes(predecessor_semantic_hash, 32, "predecessor_semantic_hash")
    _require_bytes(state_sha256, 32, "state_sha256")
    _require_bytes(mutation_sha256, 32, "mutation_sha256")
    _require_uint(boundary_ordinal, 64, "boundary_ordinal")
    _require_uint(first_mutation_ordinal, 64, "first_mutation_ordinal")
    _require_uint(mutation_count, 64, "mutation_count")
    _require_uint(flags, 32, "boundary flags")
    tlvs = [
        TraceTLV(1, True, predecessor_semantic_hash),
        TraceTLV(2, True, state_sha256),
        TraceTLV(3, True, mutation_sha256),
        TraceTLV(4, True, _U64.pack(boundary_ordinal)),
    ]
    if clock_slot_ordinal is not None:
        _require_uint(clock_slot_ordinal, 64, "clock_slot_ordinal")
        tlvs.append(TraceTLV(5, True, _U64.pack(clock_slot_ordinal)))
    tlvs.extend((
        TraceTLV(6, True, _U64.pack(first_mutation_ordinal)),
        TraceTLV(7, True, _U64.pack(mutation_count)),
        TraceTLV(8, True, _U32.pack(flags)),
    ))
    if identity_components is not None:
        if boundary_ordinal != 0:
            raise TraceError("identity components are only valid on S0")
        bundle = identity_bundle(identity_components)
        tlvs.extend(
            TraceTLV(type, False, value)
            for type, value in zip(
                IDENTITY_TLVS, (bundle, *identity_components), strict=True)
        )
    return encode_record(KIND_BOUNDARY_HASH, sequence, logical_cycle, tuple(tlvs))


def boundary_semantic_hash(record: bytes) -> bytes:
    """Extract and hash the canonical TLV payload of a boundary record."""
    if not isinstance(record, bytes) or len(record) < MIN_RECORD_SIZE:
        raise TraceError("boundary record is truncated")
    total, kind, flags, _sequence, _cycle, payload_length, reserved = _RECORD.unpack_from(record)
    if kind != KIND_BOUNDARY_HASH or flags or reserved or total != len(record):
        raise TraceError("not a canonical boundary record")
    padding = _record_padding(payload_length)
    if total != RECORD_HEADER_SIZE + payload_length + padding + RECORD_CRC_SIZE:
        raise TraceError("boundary record total and payload lengths disagree")
    if _U32.unpack_from(record, total - 4)[0] != crc32c(record[:-4]):
        raise TraceError("record CRC-32C does not match")
    return semantic_boundary_hash(record[RECORD_HEADER_SIZE:RECORD_HEADER_SIZE + payload_length])


def external_event_record(sequence: int, logical_cycle: int, source: int, event: int, event_bytes: bytes, extra_tlvs: Sequence[TraceTLV] = ()) -> bytes:
    _require_uint(source, 32, "event source")
    _require_uint(event, 32, "event")
    if not isinstance(event_bytes, bytes):
        raise TraceError("event_bytes must be bytes")
    tlvs = [TraceTLV(1, True, _U32.pack(source)), TraceTLV(2, True, _U32.pack(event)), TraceTLV(3, True, event_bytes)]
    tlvs.extend(extra_tlvs)
    return encode_record(KIND_EXTERNAL_EVENT, sequence, logical_cycle, tuple(tlvs))


def terminal_record(
    sequence: int,
    logical_cycle: int,
    final_record_count: int,
    final_boundary_ordinal: int,
    final_semantic_boundary_hash: bytes,
    status: int,
    reason: int,
) -> bytes:
    _require_uint(final_record_count, 64, "final_record_count")
    _require_uint(final_boundary_ordinal, 64, "final_boundary_ordinal")
    _require_bytes(final_semantic_boundary_hash, 32, "final_semantic_boundary_hash")
    _require_uint(status, 32, "terminal status")
    if status not in (TERMINAL_COMPLETE, TERMINAL_ABORT, TERMINAL_ORACLE_FAILURE):
        raise TraceError("unknown terminal status")
    _require_uint(reason, 32, "terminal reason")
    return encode_record(KIND_TERMINAL, sequence, logical_cycle, (
        TraceTLV(1, True, _U64.pack(final_record_count)),
        TraceTLV(2, True, _U64.pack(final_boundary_ordinal)),
        TraceTLV(3, True, final_semantic_boundary_hash),
        TraceTLV(4, True, _U32.pack(status)),
        TraceTLV(5, True, _U32.pack(reason)),
    ))


def encode_trace(records: Sequence[bytes], trace_uuid: bytes, *, streaming: bool = False) -> bytes:
    """Join canonical records under an exact or streaming header.

    The caller must put the authoritative count in the terminal record.
    """
    if len(records) > MAX_RECORD_COUNT:
        raise TraceError("record_count exceeds the conservative trace-v1 limit")
    return encode_header(STREAMING_RECORD_COUNT if streaming else len(records), trace_uuid) + b"".join(records)


def _parse_tlvs(payload: bytes) -> tuple[TraceTLV, ...]:
    offset = 0
    previous = 0
    result: list[TraceTLV] = []
    while offset < len(payload):
        if len(payload) - offset < _TLV.size:
            raise TraceError("truncated TLV header")
        type, flags, length = _TLV.unpack_from(payload, offset)
        if type == 0 or flags & ~1:
            raise TraceError("TLV type or flags are reserved")
        if type <= previous:
            raise TraceError("TLV types are not strictly increasing and unique")
        previous = type
        value_start = offset + _TLV.size
        value_end = value_start + length
        padded_end = value_end + _padding(_TLV.size + length)
        if value_end < value_start or padded_end < value_end or padded_end > len(payload):
            raise TraceError("truncated or overflowing TLV")
        if payload[value_end:padded_end] != b"\0" * (padded_end - value_end):
            raise TraceError("TLV padding is nonzero")
        result.append(TraceTLV(type, bool(flags & 1), payload[value_start:value_end]))
        offset = padded_end
    return tuple(result)


def _required_tlvs(kind: int, tlvs: tuple[TraceTLV, ...]) -> dict[int, TraceTLV]:
    by_type = {item.type: item for item in tlvs}
    if kind == KIND_BOUNDARY_HASH:
        known = {1: (True, 32), 2: (True, 32), 3: (True, 32), 4: (True, 8), 5: (True, 8), 6: (True, 8), 7: (True, 8), 8: (True, 4)}
        known.update({type: (False, 32) for type in IDENTITY_TLVS})
        required = {1, 2, 3, 4, 6, 7, 8}
    elif kind == KIND_EXTERNAL_EVENT:
        known = {1: (True, 4), 2: (True, 4), 3: (True, None)}
        required = {1, 2, 3}
    elif kind == KIND_TERMINAL:
        known = {1: (True, 8), 2: (True, 8), 3: (True, 32), 4: (True, 4), 5: (True, 4)}
        required = {1, 2, 3, 4, 5}
    elif kind == KIND_CHECKPOINT:
        raise TraceError("record kind 2 is reserved in trace-v1; use boundary checkpoint flag")
    else:
        raise TraceError("unknown trace record kind")
    for type in required:
        if type not in by_type:
            raise TraceError(f"record kind {kind} is missing required TLV {type}")
    for item in tlvs:
        expected = known.get(item.type)
        if expected is None:
            if item.critical:
                raise TraceError(f"unknown critical TLV {item.type}")
            continue
        critical, width = expected
        if item.critical != critical or (width is not None and len(item.value) != width):
            raise TraceError(f"TLV {item.type} has invalid flags or width for record kind {kind}")
    return by_type


def _validate_identity_tlvs(
    kind: int, by_type: dict[int, TraceTLV], record_index: int,
    trace_uuid: bytes,
) -> tuple[bytes, tuple[bytes, ...]] | None:
    present = tuple(type for type in IDENTITY_TLVS if type in by_type)
    is_s0 = (
        kind == KIND_BOUNDARY_HASH and record_index == 0 and
        4 in by_type and _u64(by_type[4]) == 0
    )
    if not is_s0:
        if present:
            raise TraceError("reserved identity TLVs are only valid on S0")
        return None
    if present != IDENTITY_TLVS:
        raise TraceError("S0 must contain exactly identity TLVs 100 through 108")
    components = tuple(by_type[type].value for type in IDENTITY_COMPONENT_TLVS)
    derived_bundle = identity_bundle(components)
    if by_type[IDENTITY_BUNDLE_TLV].value != derived_bundle:
        raise TraceError("S0 identity bundle does not match identity components")
    if trace_uuid != derived_bundle[:16]:
        raise TraceError("trace header UUID does not match S0 identity bundle")
    return derived_bundle, components


def _u64(item: TraceTLV) -> int:
    return _U64.unpack(item.value)[0]


def _u32(item: TraceTLV) -> int:
    return _U32.unpack(item.value)[0]


def _validate_boundary(
    by_type: dict[int, TraceTLV], payload: bytes, previous_semantic_hash: bytes | None,
    previous_state_hash: bytes | None, previous_boundary_ordinal: int | None,
    next_mutation_ordinal: int, halted: bool,
) -> tuple[bytes, bytes, int, int, bool]:
    ordinal = _u64(by_type[4])
    flags = _u32(by_type[8])
    mutations = _u64(by_type[7])
    first_mutation = _u64(by_type[6])
    is_s0 = ordinal == 0
    if flags & ~BOUNDARY_KNOWN_FLAGS:
        raise TraceError("boundary flags contain reserved bits")
    if halted:
        raise TraceError("boundary follows a halted boundary")
    if is_s0:
        if previous_semantic_hash is not None:
            raise TraceError("S0 is only valid as the first boundary")
        if flags != BOUNDARY_S0:
            raise TraceError("boundary 0 must have exactly the S0 flag")
        if 5 in by_type:
            raise TraceError("clock-slot ordinal is forbidden on S0")
        if by_type[1].value != ZERO_SHA256:
            raise TraceError("S0 predecessor semantic hash must be all zero")
        if first_mutation or mutations:
            raise TraceError("S0 mutation range must be empty at ordinal zero")
    else:
        if previous_semantic_hash is None or previous_state_hash is None or previous_boundary_ordinal is None:
            raise TraceError("first boundary must be S0")
        if flags & BOUNDARY_S0:
            raise TraceError("S0 flag is only valid on boundary 0")
        activity = flags & (BOUNDARY_EXECUTED | BOUNDARY_INHIBITED)
        if activity not in (BOUNDARY_EXECUTED, BOUNDARY_INHIBITED):
            raise TraceError("later boundary must be exactly executed xor inhibited")
        if 5 not in by_type:
            raise TraceError("clock-slot ordinal is required after S0")
        if ordinal != _u64(by_type[5]) + 1:
            raise TraceError("boundary ordinal must equal clock-slot ordinal plus one")
        if ordinal != previous_boundary_ordinal + 1:
            raise TraceError("boundary ordinal is not contiguous")
        if by_type[1].value != previous_semantic_hash:
            raise TraceError("boundary predecessor semantic hash does not match prior boundary")
        if first_mutation != next_mutation_ordinal:
            raise TraceError("mutation ordinal range is not contiguous")
    if mutations == 0:
        if by_type[3].value != EMPTY_MUTATION_SHA256:
            raise TraceError("zero-mutation boundary must use EMPTY_MUTATION_SHA256")
    semantic_hash = semantic_boundary_hash(payload)
    return semantic_hash, by_type[2].value, first_mutation + mutations, ordinal, bool(flags & BOUNDARY_HALT)


def _validate_terminal(
    by_type: dict[int, TraceTLV], record_index: int, last_boundary_ordinal: int | None,
    last_semantic_hash: bytes | None, saw_external_event: bool, halted: bool,
) -> tuple[int, int]:
    final_count = _u64(by_type[1])
    final_ordinal = _u64(by_type[2])
    final_hash = by_type[3].value
    status = _u32(by_type[4])
    reason = _u32(by_type[5])
    if status not in (TERMINAL_COMPLETE, TERMINAL_ABORT, TERMINAL_ORACLE_FAILURE):
        raise TraceError("terminal status is not defined")
    valid_pair = (
        (status == TERMINAL_COMPLETE and reason in (TERMINAL_REASON_GUEST_HALT, TERMINAL_REASON_LIMIT_REACHED))
        or (status == TERMINAL_ABORT and reason == TERMINAL_REASON_ABORTED)
        or (status == TERMINAL_ORACLE_FAILURE and reason == TERMINAL_REASON_ORACLE_FAILURE)
    )
    if not valid_pair:
        raise TraceError("terminal status and reason are inconsistent")
    if final_count != record_index + 1:
        raise TraceError("terminal final record count does not include this terminal")
    if last_boundary_ordinal is None:
        if final_ordinal != NO_BOUNDARY_ORDINAL or final_hash != ZERO_SHA256:
            raise TraceError("terminal without boundary must use no-boundary sentinel and zero hash")
    elif final_ordinal != last_boundary_ordinal or final_hash != last_semantic_hash:
        raise TraceError("terminal final boundary fields do not match last boundary")
    if status == TERMINAL_COMPLETE:
        if last_boundary_ordinal is None:
            raise TraceError("complete terminal requires an S0 boundary")
        if saw_external_event:
            raise TraceError("external event invalidates successful completion")
        if reason == TERMINAL_REASON_GUEST_HALT and not halted:
            raise TraceError("guest-halt completion requires a HALT boundary")
        if reason == TERMINAL_REASON_LIMIT_REACHED and halted:
            raise TraceError("limit-reached completion cannot relabel a HALT boundary")
    return status, reason


def parse_trace(
    data: bytes, *,
    expected_identity_bundle: bytes | None = None,
    expected_profile_sha256: bytes | None = None,
) -> dict[str, object]:
    """Validate and parse a complete exact or streaming trace-v1 byte string.

    The S0 identity block is always internally validated. Optional expectations
    bind a caller's selected comparison target and reject a self-consistent trace
    for a different profile or build.
    """
    if not isinstance(data, bytes) or len(data) < HEADER_SIZE:
        raise TraceError("trace is truncated before its header")
    header = data[:HEADER_SIZE]
    declared_count, trace_uuid = _validate_header(header)
    position = HEADER_SIZE
    predecessor = header_chain_hash(header)
    records: list[TraceRecord] = []
    prior_cycle = 0
    terminal_seen = False
    terminal_status: int | None = None
    terminal_reason: int | None = None
    last_semantic_hash: bytes | None = None
    last_state_hash: bytes | None = None
    last_boundary_ordinal: int | None = None
    next_mutation_ordinal = 0
    saw_external_event = False
    halted = False
    identity: tuple[bytes, tuple[bytes, ...]] | None = None
    while position < len(data):
        index = len(records)
        if index >= MAX_RECORD_COUNT:
            raise TraceError("trace exceeds the conservative record limit")
        if declared_count != STREAMING_RECORD_COUNT and index >= declared_count:
            raise TraceError("trace has trailing bytes")
        if len(data) - position < MIN_RECORD_SIZE:
            raise TraceError("trace is truncated before a complete record")
        total, kind, flags, sequence, logical_cycle, payload_length, reserved = _RECORD.unpack_from(data, position)
        if total < MIN_RECORD_SIZE or total % 8 or total > MAX_RECORD_LENGTH:
            raise TraceError("record total length is invalid")
        if payload_length > MAX_PAYLOAD_LENGTH:
            raise TraceError("record payload length exceeds conservative limit")
        padding = _record_padding(payload_length)
        if total != RECORD_HEADER_SIZE + payload_length + padding + RECORD_CRC_SIZE:
            raise TraceError("record total and payload lengths disagree")
        end = position + total
        if end < position or end > len(data):
            raise TraceError("record is truncated or length overflows")
        record = data[position:end]
        if flags or reserved:
            raise TraceError("record flags or reserved field are nonzero")
        if sequence != index:
            raise TraceError("record sequence is not the required zero-based increment")
        if index and logical_cycle < prior_cycle:
            raise TraceError("logical cycle decreases")
        prior_cycle = logical_cycle
        payload_end = RECORD_HEADER_SIZE + payload_length
        if record[payload_end:payload_end + padding] != b"\0" * padding:
            raise TraceError("record padding is nonzero")
        if _U32.unpack_from(record, total - 4)[0] != crc32c(record[:-4]):
            raise TraceError("record CRC-32C does not match")
        tlvs = _parse_tlvs(record[RECORD_HEADER_SIZE:payload_end])
        by_type = _required_tlvs(kind, tlvs)
        record_identity = _validate_identity_tlvs(
            kind, by_type, index, trace_uuid)
        if record_identity is not None:
            if identity is not None:
                raise TraceError("trace contains more than one S0 identity block")
            identity = record_identity
        if terminal_seen:
            raise TraceError("record follows terminal")
        if kind == KIND_BOUNDARY_HASH:
            last_semantic_hash, last_state_hash, next_mutation_ordinal, last_boundary_ordinal, halted_now = _validate_boundary(
                by_type, record[RECORD_HEADER_SIZE:payload_end], last_semantic_hash, last_state_hash,
                last_boundary_ordinal, next_mutation_ordinal, halted,
            )
            halted = halted or halted_now
        elif kind == KIND_EXTERNAL_EVENT:
            if halted:
                raise TraceError("external event follows a halted boundary")
            saw_external_event = True
        elif kind == KIND_TERMINAL:
            terminal_status, terminal_reason = _validate_terminal(
                by_type, index, last_boundary_ordinal, last_semantic_hash,
                saw_external_event, halted,
            )
            terminal_seen = True
            if end != len(data):
                raise TraceError("terminal record is not last")
        chain_hash = _sha256(b"CDRTRC1-REC\0", predecessor, record[:-4])
        records.append(TraceRecord(kind, sequence, logical_cycle, tlvs, chain_hash))
        predecessor = chain_hash
        position = end
    actual_count = len(records)
    if declared_count != STREAMING_RECORD_COUNT and actual_count != declared_count:
        raise TraceError("header record count does not match trace")
    if not terminal_seen:
        raise TraceError("trace has no terminal record")
    if identity is None:
        raise TraceError("trace has no S0 identity block")
    identity_bundle_value, identity_components = identity
    if expected_identity_bundle is not None:
        _require_bytes(expected_identity_bundle, 32, "expected_identity_bundle")
        if identity_bundle_value != expected_identity_bundle:
            raise TraceError("trace identity bundle does not match selected expectation")
    if expected_profile_sha256 is not None:
        _require_bytes(expected_profile_sha256, 32, "expected_profile_sha256")
        if identity_components[0] != expected_profile_sha256:
            raise TraceError("trace profile identity does not match selected expectation")
    return {
        "version": VERSION,
        "trace_uuid": trace_uuid,
        "identity_bundle": identity_bundle_value,
        "identity_components": identity_components,
        "record_count": actual_count,
        "declared_record_count": declared_count,
        "initial_chain_hash": header_chain_hash(header),
        "final_chain_hash": predecessor,
        "terminal_status": terminal_status,
        "terminal_reason": terminal_reason,
        "records": tuple(records),
    }
