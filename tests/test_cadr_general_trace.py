from __future__ import annotations

import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "general_trace", ROOT / "scripts/cadr_general_trace.py")
assert SPEC and SPEC.loader
t = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = t
SPEC.loader.exec_module(t)
D = lambda value: hashlib.sha256(value).digest()
INITIAL = D(b"initial")
KW = dict(
    profile_sha256=D(b"profile"),
    artifact_set_sha256=D(b"artifacts"),
    initial_state_sha256=INITIAL,
    input_schedule_sha256=D(b"schedule"),
)
TRANSACTION = struct.pack(
    "<IIQIIIIIII", 0, 1, 0x1000, 0, 3, 0, 0, 1, 0, 1)


def selectors(transaction_count: int = 0) -> tuple[bytes, ...]:
    transaction_list = (
        struct.pack("<I", transaction_count) + TRANSACTION * transaction_count)
    return (
        struct.pack("<8I", *range(8)),
        struct.pack("<QQ", 7, 7),
        struct.pack("<II", 1, 2),
        struct.pack("<4I", 1, 2, 3, 1),
        struct.pack("<4I", 1, 2, 3, 1),
        struct.pack("<2I", 1, 2),
        struct.pack("<2I", 1, 2),
        struct.pack("<3I", 1, 2, 1),
        struct.pack("<2I", 1, 2),
        struct.pack("<4I", 0, 1, 1, 1),
        struct.pack(
            "<4I",
            0,
            t.CADR_INTERRUPT_ENABLE | t.CADR_INTERRUPT_XBUS
            | t.CADR_INTERRUPT_UNIBUS | 0o260,
            0o260,
            1,
        ),
        transaction_list,
    )


def record_semantic(record: bytes) -> bytes:
    parsed, end = t._record_from_bytes(record, 0)
    assert end == len(record)
    return t._item(parsed.tlvs, t.TLV_SEMANTIC)


def valid(
    *,
    with_event: bool = False,
    inhibited: bool = False,
    streaming: bool = False,
    reason: int | None = None,
    terminal_cycle: int | None = None,
) -> bytes:
    mask = t.KNOWN_SELECTOR_MASK
    header = t.encode_header(
        record_count=t.STREAMING_COUNT if streaming else 999,
        selector_mask=mask,
        event_mask=t.EVENT_CLOCK if with_event else 0,
        **KW,
    )
    parsed_header = t.parse_header(header)
    initial = t.encode_record(
        kind=t.KIND_INITIAL,
        flags=0,
        sequence=0,
        boundary=0,
        cycle=0,
        tlvs=t.initial_tlvs(
            previous=parsed_header.semantic_seed, state=INITIAL, boundary=0),
    )
    previous = record_semantic(initial)
    flags = (
        t.FLAG_INHIBITED
        if inhibited
        else t.FLAG_EXECUTED | (0 if with_event else t.FLAG_HALT)
    )
    present_mask = mask & ~0b11110 if inhibited else mask
    state = D(b"state")
    boundary = t.encode_record(
        kind=t.KIND_BOUNDARY,
        flags=flags,
        sequence=1,
        boundary=1,
        cycle=1,
        selector_mask=present_mask,
        tlvs=t.boundary_tlvs(
            previous=previous,
            state=state,
            flags=flags,
            boundary=1,
            cycle=1,
            selector_mask=present_mask,
            selectors=selectors(),
        ),
    )
    records = [initial, boundary]
    previous = record_semantic(boundary)
    if with_event:
        event = t.encode_record(
            kind=t.KIND_EVENT,
            flags=0,
            sequence=2,
            boundary=1,
            cycle=2,
            event_class=t.EVENT_CLOCK,
            tlvs=t.event_tlvs(
                previous=previous,
                state=state,
                boundary=1,
                cycle=2,
                event_class=t.EVENT_CLOCK,
                code=1,
                payload=struct.pack("<QQQ", 7, 8, 1),
            ),
        )
        records.append(event)
        previous = record_semantic(event)
    if reason is None:
        reason = (
            t.REASON_ABORT
            if inhibited
            else (
                t.REASON_COMPLETE_LIMIT
                if with_event
                else t.REASON_COMPLETE_HALT
            )
        )
    if terminal_cycle is None:
        terminal_cycle = 2 if with_event else 1
    terminal = t.encode_record(
        kind=t.KIND_TERMINAL,
        flags=0,
        sequence=len(records),
        boundary=1,
        cycle=terminal_cycle,
        tlvs=t.terminal_tlvs(
            accumulated=previous,
            final_state=state,
            record_count=len(records) + 1,
            reason=reason,
        ),
    )
    records.append(terminal)
    return t.build_trace(header, records)


def slot_event(event_class: int) -> tuple[int, int, bytes]:
    payloads = {
        t.EVENT_CLOCK: (1, struct.pack("<QQQ", 7, 8, 1)),
        t.EVENT_INTERRUPT: (1, struct.pack(
            "<4I", 0,
            t.CADR_INTERRUPT_ENABLE | t.CADR_INTERRUPT_XBUS | 0o260,
            0o260, 1)),
        t.EVENT_FAULT: (1, struct.pack("<4I", 0, 1, 1, 1)),
        t.EVENT_HALT: (1, struct.pack("<I", t.CADR_STATUS_HALTED)),
    }
    if event_class == t.EVENT_DEVICE:
        return (5, struct.pack("<I", 0))
    return (payloads[event_class][0], payloads[event_class][1])


def lifecycle_event(code: int) -> tuple[int, int, bytes]:
    if code == 1:
        return (t.EVENT_DEVICE, code, struct.pack(
            "<IIQQQ32sQ", 5, 0, 1, 2, 0, D(b"request"), 0))
    return (t.EVENT_DEVICE, code, struct.pack(
        "<IIIQQQ32s", 5, t.CADR_HOST_RESULT_OK, 0, 1, 2, 0,
        D(b"completion")))


def boundary_events_trace(
    events: list[tuple[int, int, bytes]], *, halted: bool = False,
) -> bytes:
    event_mask = 0
    for event_class, _code, _payload in events:
        event_mask |= event_class
    header = t.encode_header(selector_mask=0, event_mask=event_mask, **KW)
    seed = t.parse_header(header).semantic_seed
    initial = t.encode_record(
        kind=t.KIND_INITIAL, flags=0, sequence=0, boundary=0, cycle=0,
        tlvs=t.initial_tlvs(previous=seed, state=INITIAL, boundary=0))
    previous = record_semantic(initial)
    state = D(b"boundary event state")
    flags = t.FLAG_EXECUTED | (t.FLAG_HALT if halted else 0)
    boundary = t.encode_record(
        kind=t.KIND_BOUNDARY, flags=flags, sequence=1, boundary=1, cycle=1,
        selector_mask=0,
        tlvs=t.boundary_tlvs(
            previous=previous, state=state, flags=flags, boundary=1, cycle=1))
    records = [initial, boundary]
    previous = record_semantic(boundary)
    for event_class, code, payload in events:
        event = t.encode_record(
            kind=t.KIND_EVENT, flags=0, sequence=len(records), boundary=1,
            cycle=2, event_class=event_class,
            tlvs=t.event_tlvs(
                previous=previous, state=state, boundary=1, cycle=2,
                event_class=event_class, code=code, payload=payload))
        records.append(event)
        previous = record_semantic(event)
    terminal = t.encode_record(
        kind=t.KIND_TERMINAL, flags=0, sequence=len(records), boundary=1,
        cycle=2 if events else 1,
        tlvs=t.terminal_tlvs(
            accumulated=previous, final_state=state,
            record_count=len(records) + 1,
            reason=(t.REASON_COMPLETE_HALT if halted
                    else t.REASON_COMPLETE_LIMIT)))
    return t.build_trace(header, (*records, terminal))


def trace_with_selector(selector_type: int, selector_value: bytes) -> bytes:
    mask = 1 << (selector_type - 1)
    header = t.encode_header(selector_mask=mask, event_mask=0, **KW)
    seed = t.parse_header(header).semantic_seed
    initial = t.encode_record(
        kind=t.KIND_INITIAL, flags=0, sequence=0, boundary=0, cycle=0,
        tlvs=t.initial_tlvs(previous=seed, state=INITIAL, boundary=0))
    previous = record_semantic(initial)
    values = list(selectors())
    values[selector_type - 1] = selector_value
    state = D(b"selector state")
    boundary = t.encode_record(
        kind=t.KIND_BOUNDARY,
        flags=t.FLAG_EXECUTED | t.FLAG_HALT,
        sequence=1,
        boundary=1,
        cycle=1,
        selector_mask=mask,
        tlvs=t.boundary_tlvs(
            previous=previous, state=state,
            flags=t.FLAG_EXECUTED | t.FLAG_HALT,
            boundary=1, cycle=1, selector_mask=mask,
            selectors=tuple(values)))
    previous = record_semantic(boundary)
    terminal = t.encode_record(
        kind=t.KIND_TERMINAL, flags=0, sequence=2, boundary=1, cycle=1,
        tlvs=t.terminal_tlvs(
            accumulated=previous, final_state=state, record_count=3,
            reason=t.REASON_COMPLETE_HALT))
    return t.build_trace(header, (initial, boundary, terminal))


def trace_with_event(event_class: int, code: int, payload: bytes) -> bytes:
    header = t.encode_header(
        selector_mask=0, event_mask=event_class, **KW)
    seed = t.parse_header(header).semantic_seed
    initial = t.encode_record(
        kind=t.KIND_INITIAL, flags=0, sequence=0, boundary=0, cycle=0,
        tlvs=t.initial_tlvs(previous=seed, state=INITIAL, boundary=0))
    previous = record_semantic(initial)
    state = D(b"event state")
    boundary = t.encode_record(
        kind=t.KIND_BOUNDARY, flags=t.FLAG_EXECUTED, sequence=1,
        boundary=1, cycle=1, selector_mask=0,
        tlvs=t.boundary_tlvs(
            previous=previous, state=state, flags=t.FLAG_EXECUTED,
            boundary=1, cycle=1))
    previous = record_semantic(boundary)
    event = t.encode_record(
        kind=t.KIND_EVENT, flags=0, sequence=2, boundary=1, cycle=2,
        event_class=event_class,
        tlvs=t.event_tlvs(
            previous=previous, state=state, boundary=1, cycle=2,
            event_class=event_class, code=code, payload=payload))
    previous = record_semantic(event)
    terminal = t.encode_record(
        kind=t.KIND_TERMINAL, flags=0, sequence=3, boundary=1, cycle=2,
        tlvs=t.terminal_tlvs(
            accumulated=previous, final_state=state, record_count=4,
            reason=t.REASON_COMPLETE_LIMIT))
    return t.build_trace(header, (initial, boundary, event, terminal))


class GeneralTraceTests(unittest.TestCase):
    def test_roundtrip_initial_witness_and_streaming_canonicalized(self) -> None:
        parsed = t.parse_trace(
            valid(with_event=True, streaming=True),
            expected_initial_state_sha256=INITIAL,
        )
        self.assertEqual(parsed["record_count"], 4)
        self.assertEqual(parsed["records"][0].kind, t.KIND_INITIAL)
        self.assertNotEqual(parsed["header"].record_count, t.STREAMING_COUNT)
        with self.assertRaisesRegex(t.TraceError, "initial state"):
            t.parse_trace(
                valid(), expected_initial_state_sha256=D(b"wrong initial"))

    def test_header_initial_state_must_equal_first_record(self) -> None:
        header = t.encode_header(selector_mask=0, event_mask=0, **KW)
        seed = t.parse_header(header).semantic_seed
        wrong = D(b"wrong")
        initial = t.encode_record(
            kind=t.KIND_INITIAL,
            flags=0,
            sequence=0,
            boundary=0,
            cycle=0,
            tlvs=t.initial_tlvs(previous=seed, state=wrong, boundary=0),
        )
        terminal = t.encode_record(
            kind=t.KIND_TERMINAL,
            flags=0,
            sequence=1,
            boundary=0,
            cycle=0,
            tlvs=t.terminal_tlvs(
                accumulated=record_semantic(initial),
                final_state=wrong,
                record_count=2,
                reason=t.REASON_ABORT,
            ),
        )
        with self.assertRaisesRegex(t.TraceError, "initial record witness"):
            t.parse_trace(t.build_trace(header, (initial, terminal)))

    def test_corruption_hash_count_and_identity_fail_closed(self) -> None:
        raw = valid()
        for corrupted in (
            raw[:-1],
            raw[:260] + bytes([raw[260] ^ 1]) + raw[261:],
        ):
            with self.assertRaises(t.TraceError):
                t.parse_trace(corrupted)
        with self.assertRaisesRegex(t.TraceError, "profile"):
            t.parse_trace(raw, expected_profile_sha256=D(b"wrong profile"))
        with self.assertRaisesRegex(t.TraceError, "artifact set"):
            t.parse_trace(
                raw, expected_artifact_set_sha256=D(b"wrong artifacts"))
        with self.assertRaisesRegex(t.TraceError, "input schedule"):
            t.parse_trace(
                raw, expected_input_schedule_sha256=D(b"wrong schedule"))
        with self.assertRaises(t.TraceError):
            t.encode_header(selector_mask=1 << 63, **KW)
        with self.assertRaises(t.TraceError):
            t.encode_header(event_mask=1 << 63, **KW)

        positions = []
        position = t.HEADER_SIZE
        while position < len(raw):
            start = position
            record, position = t._record_from_bytes(raw, position)
            positions.append((start, position, record))
        start, end, boundary = positions[1]
        bad_hash_tlvs = tuple(
            t.TLV(item.type, D(b"bad semantic")
                  if item.type == t.TLV_SEMANTIC else item.value,
                  item.required)
            for item in boundary.tlvs
        )
        bad_hash_record = t.encode_record(
            kind=boundary.kind,
            flags=boundary.flags,
            sequence=boundary.sequence,
            boundary=boundary.boundary,
            cycle=boundary.cycle,
            selector_mask=boundary.selector_mask,
            tlvs=bad_hash_tlvs,
        )
        with self.assertRaisesRegex(t.TraceError, "semantic digest"):
            t.parse_trace(raw[:start] + bad_hash_record + raw[end:])

        start, end, terminal = positions[-1]
        bad_count_tlvs = tuple(
            t.TLV(item.type, struct.pack("<Q", 99)
                  if item.type == t.TLV_FINAL_COUNT else item.value,
                  item.required)
            for item in terminal.tlvs
        )
        bad_count_record = t.encode_record(
            kind=terminal.kind,
            flags=0,
            sequence=terminal.sequence,
            boundary=terminal.boundary,
            cycle=terminal.cycle,
            tlvs=bad_count_tlvs,
        )
        with self.assertRaisesRegex(
            t.TraceError, "terminal counts, reason, or final state"
        ):
            t.parse_trace(raw[:start] + bad_count_record + raw[end:])

        start, end, boundary = positions[1]
        unknown_kind = t.encode_record(
            kind=999,
            flags=boundary.flags,
            sequence=boundary.sequence,
            boundary=boundary.boundary,
            cycle=boundary.cycle,
            selector_mask=boundary.selector_mask,
            tlvs=boundary.tlvs,
        )
        with self.assertRaisesRegex(t.TraceError, "unknown record kind"):
            t.parse_trace(raw[:start] + unknown_kind + raw[end:])

    def test_transaction_stride_count_and_every_field(self) -> None:
        max_result_read = struct.pack(
            "<IIQIIIIIII",
            0, t.CADR_ADDRESS_SPACE_PHYSICAL_WORD_BUS,
            t.CADR_PHYSICAL_WORD_ADDRESS_MAX, 0, 0xffffffff,
            t.CADR_STATUS_OK, 0xffff, 0xffff, 0, 0)
        write_transaction = struct.pack(
            "<IIQIIIIIII",
            1, t.CADR_ADDRESS_SPACE_PHYSICAL_WORD_BUS,
            t.CADR_PHYSICAL_WORD_ADDRESS_MAX, 0xffffffff, 0,
            t.CADR_STATUS_UNIMPLEMENTED_DEVICE,
            0xffff, 0xffff,
            t.CADR_BUS_ERROR_XBUS_NXM | t.CADR_BUS_ERROR_UNIBUS_MAP,
            t.CADR_BUS_ERROR_UNIBUS_NXM)
        for transaction in (TRANSACTION, max_result_read, write_transaction):
            t._validate_selector(12, struct.pack("<I", 1) + transaction)
        for count in (0, 1, 3):
            value = struct.pack("<I", count) + TRANSACTION * count
            t._validate_selector(12, value)
            t.parse_trace(trace_with_selector(12, value))
        malformed_transactions = (
            b"\0" * 40,
            struct.pack("<I", 2) + TRANSACTION,
            struct.pack("<I", 1) + TRANSACTION[:-1],
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 2, 1, 0, 0, 0, 0, 0, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 2, 0, 0, 0, 0, 0, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1,
                t.CADR_PHYSICAL_WORD_ADDRESS_MAX + 1,
                0, 0, 0, 0, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 0, 0, 1, 0, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 0, 0, 0, 0x10000, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 0, 0, 0, 0, 0x10000, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 0, 0, 0, 0, 0, 0o2, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 0, 0, 0, 0, 0, 0, 0o2),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 0, 1, 0, 1, 0, 0, 0, 0, 0, 0),
            struct.pack("<I", 1) + struct.pack(
                "<IIQIIIIIII", 1, 1, 0, 1, 1, 0, 0, 0, 0, 0),
        )
        for malformed in malformed_transactions:
            with self.assertRaises(t.TraceError):
                t._validate_selector(12, malformed)
            with self.assertRaises(t.TraceError):
                t.parse_trace(trace_with_selector(12, malformed))

    def test_selector_and_event_schemas_unpack_enums(self) -> None:
        a_source_max = struct.pack("<II", 1023, 0xffffffff)
        t._validate_selector(3, a_source_max)
        t.parse_trace(trace_with_selector(3, a_source_max))
        for m_source in (
            struct.pack("<4I", 0, 0, 0xffffffff, 1),
            struct.pack("<4I", 1, 31, 0xffffffff, 1),
            struct.pack("<4I", 0, 0, 0, 0),
        ):
            t._validate_selector(4, m_source)
            t.parse_trace(trace_with_selector(4, m_source))
        for destination in (
            struct.pack("<4I", 0, 0, 0, 0),
            struct.pack("<4I", 1, 1023, 0xffffffff, 1),
            struct.pack("<4I", 2, 31, 0xffffffff, 1),
        ):
            t._validate_selector(5, destination)
            t.parse_trace(trace_with_selector(5, destination))
        for fault in (
            struct.pack("<4I", 0, 0, 0, 0),
            struct.pack("<4I", 1, 1, 1, 1),
        ):
            t._validate_selector(10, fault)
            t.parse_trace(trace_with_selector(10, fault))
        selector_negatives = (
            (1, struct.pack("<8I", 0x4000, *([0] * 7))),
            (2, struct.pack("<QQ", 1 << 48, 0)),
            (3, struct.pack("<II", 1024, 0)),
            (4, struct.pack("<4I", 2, 0, 0, 1)),
            (4, struct.pack("<4I", 0, 32, 0, 1)),
            (4, struct.pack("<4I", 0, 0, 1, 0)),
            (5, struct.pack("<4I", 0, 0, 0, 1)),
            (5, struct.pack("<4I", 1, 1024, 0, 1)),
            (5, struct.pack("<4I", 2, 32, 0, 1)),
            (5, struct.pack("<4I", 0, 0, 1, 0)),
            (8, struct.pack("<III", 0, 0, 2)),
            (10, struct.pack("<4I", 0, 0, 2, 1)),
            (11, struct.pack("<4I", 0, 0, 4, 0)),
            (11, struct.pack(
                "<4I", 0, t.CADR_INTERRUPT_UNIBUS | 0o260, 0o264, 1)),
            (11, struct.pack(
                "<4I", 0, t.CADR_INTERRUPT_UNIBUS | 0o260, 0o260, 0)),
        )
        for selector_type, value in selector_negatives:
            with self.assertRaises(t.TraceError):
                t._validate_selector(selector_type, value)
            with self.assertRaises(t.TraceError):
                t.parse_trace(trace_with_selector(selector_type, value))
        for fields in (
            (0, t.CADR_INTERRUPT_XBUS, 0, 1),
            (0, t.CADR_INTERRUPT_UNIBUS | 0o260, 0o260, 1),
            (0, t.CADR_INTERRUPT_XBUS | t.CADR_INTERRUPT_UNIBUS | 0o260,
             0o260, 1),
            (t.CADR_INTERRUPT_UNIBUS | 0o260, 0, 0, 0),
        ):
            t._validate_selector(11, struct.pack("<4I", *fields))
            t.parse_trace(
                trace_with_selector(11, struct.pack("<4I", *fields)))
            t._validate_event_schema(
                t.EVENT_INTERRUPT, 1, struct.pack("<4I", *fields))
        t._validate_event_schema(
            t.EVENT_CLOCK, 1, struct.pack("<QQQ", 1, 2, 1))
        with self.assertRaises(t.TraceError):
            t._validate_event_schema(
                t.EVENT_CLOCK, 1, struct.pack("<QQQ", 2, 1, 0))
        issue = struct.pack("<IIQQQ32sQ", 1, 0, 1, 2, 3, D(b"d"), 4)
        t._validate_event_schema(t.EVENT_DEVICE, 1, issue)
        t._validate_event_schema(
            t.EVENT_DEVICE, 1,
            struct.pack(
                "<IIQQQ32sQ", 1, 0, 1, 2, (1 << 64) - 1,
                D(b"max descriptor"), (1 << 64) - 1))
        completion = struct.pack(
            "<IIIQQQ32s", 5, t.CADR_HOST_RESULT_FAILED, 16,
            1, 2, 3, D(b"payload"))
        t._validate_event_schema(t.EVENT_DEVICE, 4, completion)
        t._validate_event_schema(
            t.EVENT_DEVICE, 2,
            struct.pack(
                "<IIIQQQ32s", 1, t.CADR_HOST_RESULT_OK, 0,
                1, 2, (1 << 64) - 1, D(b"max payload")))
        for operation in t.CADR_HOST_OPERATIONS:
            for status in t.CADR_STATUS_VALUES:
                t._validate_event_schema(
                    t.EVENT_DEVICE, 1,
                    struct.pack(
                        "<IIQQQ32sQ", operation, status, 1, 2, 3,
                        D(b"descriptor"), 4))
                for result in (
                    t.CADR_HOST_RESULT_OK, t.CADR_HOST_RESULT_FAILED
                ):
                    t._validate_event_schema(
                        t.EVENT_DEVICE, 2,
                        struct.pack(
                            "<IIIQQQ32s", operation, result, status,
                            1, 2, 3, D(b"payload")))
        event_negatives = (
            (t.EVENT_INTERRUPT, 1, struct.pack("<4I", 0, 0, 4, 0)),
            (t.EVENT_FAULT, 1, struct.pack("<4I", 0, 0, 2, 1)),
            (t.EVENT_HALT, 1, struct.pack("<I", 0)),
            (t.EVENT_DEVICE, 1,
             struct.pack("<IIQQQ32sQ", 0, 0, 1, 2, 3, D(b"d"), 4)),
            (t.EVENT_DEVICE, 1,
             struct.pack("<IIQQQ32sQ", 1, 17, 1, 2, 3, D(b"d"), 4)),
            (t.EVENT_DEVICE, 2,
             struct.pack("<IIIQQQ32s", 1, 2, 0, 1, 2, 3, D(b"p"))),
            (t.EVENT_DEVICE, 2,
             struct.pack("<IIIQQQ32s", 1, 0, 17, 1, 2, 3, D(b"p"))),
        )
        for event_class, code, payload in event_negatives:
            with self.assertRaises(t.TraceError):
                t._validate_event_schema(event_class, code, payload)
            with self.assertRaises(t.TraceError):
                t.parse_trace(trace_with_event(event_class, code, payload))

    def test_exact_tlv_allowlist_authenticates_record_kind(self) -> None:
        raw = valid()
        position = t.HEADER_SIZE
        initial, position = t._record_from_bytes(raw, position)
        boundary_start = position
        boundary, position = t._record_from_bytes(raw, position)
        wrong = tuple(boundary.tlvs) + (
            t.TLV(t.TLV_EVENT_CODE, struct.pack("<I", 1)),)
        bad_boundary = t.encode_record(
            kind=t.KIND_BOUNDARY,
            flags=boundary.flags,
            sequence=boundary.sequence,
            boundary=boundary.boundary,
            cycle=boundary.cycle,
            selector_mask=boundary.selector_mask,
            tlvs=wrong,
        )
        with self.assertRaisesRegex(t.TraceError, "not allowed"):
            t.parse_trace(
                raw[:boundary_start] + bad_boundary + raw[position:])
        with self.assertRaises(t.TraceError):
            t._parse_tlvs(t.encode_tlv(2000, b"x", required=True))
        optional = t._parse_tlvs(
            t.encode_tlv(2000, b"x", required=False))
        self.assertEqual(optional[0].value, b"x")

    def test_event_placement_and_halt_rules(self) -> None:
        raw = valid(with_event=True)
        parsed = t.parse_trace(raw)
        self.assertEqual(
            [record.kind for record in parsed["records"]],
            [t.KIND_INITIAL, t.KIND_BOUNDARY, t.KIND_EVENT, t.KIND_TERMINAL],
        )
        header = raw[:t.HEADER_SIZE]
        records = []
        position = t.HEADER_SIZE
        while position < len(raw):
            record_start = position
            record, position = t._record_from_bytes(raw, position)
            records.append((record_start, position, record))
        # Rebuild the event as a self-consistent event for the initial boundary.
        start, end, event = records[2]
        previous = t._item(records[1][2].tlvs, t.TLV_SEMANTIC)
        event_state = t._item(event.tlvs, t.TLV_STATE)
        bad_tlvs = t.event_tlvs(
            previous=previous,
            state=event_state,
            boundary=0,
            cycle=event.cycle,
            event_class=event.event_class,
            code=1,
            payload=struct.pack("<QQQ", 7, 8, 1),
        )
        bad_event = t.encode_record(
            kind=event.kind,
            flags=0,
            sequence=event.sequence,
            boundary=0,
            cycle=event.cycle,
            event_class=event.event_class,
            tlvs=bad_tlvs,
        )
        with self.assertRaisesRegex(t.TraceError, "event placement"):
            t.parse_trace(raw[:start] + bad_event + raw[end:])
        # A self-consistent HALT event is invalid after a running boundary.
        halt_header = t.encode_header(
            selector_mask=0, event_mask=t.EVENT_HALT, **KW)
        halt_seed = t.parse_header(halt_header).semantic_seed
        halt_initial = t.encode_record(
            kind=t.KIND_INITIAL, flags=0, sequence=0, boundary=0, cycle=0,
            tlvs=t.initial_tlvs(
                previous=halt_seed, state=INITIAL, boundary=0))
        previous = record_semantic(halt_initial)
        state = D(b"running")
        running = t.encode_record(
            kind=t.KIND_BOUNDARY,
            flags=t.FLAG_EXECUTED,
            sequence=1,
            boundary=1,
            cycle=1,
            selector_mask=0,
            tlvs=t.boundary_tlvs(
                previous=previous, state=state, flags=t.FLAG_EXECUTED,
                boundary=1, cycle=1))
        previous = record_semantic(running)
        halt_event = t.encode_record(
            kind=t.KIND_EVENT, flags=0, sequence=2, boundary=1, cycle=2,
            event_class=t.EVENT_HALT,
            tlvs=t.event_tlvs(
                previous=previous, state=state, boundary=1, cycle=2,
                event_class=t.EVENT_HALT, code=1,
                payload=struct.pack("<I", t.CADR_STATUS_HALTED)))
        previous = record_semantic(halt_event)
        terminal = t.encode_record(
            kind=t.KIND_TERMINAL, flags=0, sequence=3, boundary=1, cycle=2,
            tlvs=t.terminal_tlvs(
                accumulated=previous, final_state=state, record_count=4,
                reason=t.REASON_COMPLETE_LIMIT))
        with self.assertRaisesRegex(t.TraceError, "halt event placement"):
            t.parse_trace(t.build_trace(
                halt_header, (halt_initial, running, halt_event, terminal)))

    def test_per_boundary_slot_order_and_host_lifecycle_close(self) -> None:
        slot_classes = (
            t.EVENT_CLOCK,
            t.EVENT_INTERRUPT,
            t.EVENT_DEVICE,
            t.EVENT_FAULT,
        )
        ordered = [(event_class, *slot_event(event_class))
                   for event_class in slot_classes]
        t.parse_trace(boundary_events_trace(ordered))

        # The non-halting compound-slot order has one valid permutation.  Test
        # every other ordering as a self-consistent wire stream rather than
        # depending on an encoder-side construction failure.
        for permutation in itertools.permutations(slot_classes):
            events = [(event_class, *slot_event(event_class))
                      for event_class in permutation]
            if permutation == slot_classes:
                t.parse_trace(boundary_events_trace(events))
            else:
                with self.assertRaisesRegex(
                    t.TraceError, "duplicate or reversed slot event"
                ):
                    t.parse_trace(boundary_events_trace(events))

        # Each slot event is single-use, including the halt-only slot.
        for event_class in slot_classes:
            prefix = [(candidate, *slot_event(candidate))
                      for candidate in slot_classes[
                          :slot_classes.index(event_class) + 1]]
            duplicate = prefix + [(event_class, *slot_event(event_class))]
            with self.assertRaisesRegex(
                t.TraceError, "duplicate or reversed slot event"
            ):
                t.parse_trace(boundary_events_trace(duplicate))
        halt = [(t.EVENT_HALT, *slot_event(t.EVENT_HALT))]
        t.parse_trace(boundary_events_trace(halt, halted=True))
        with self.assertRaisesRegex(
            t.TraceError, "duplicate or reversed slot event"
        ):
            t.parse_trace(boundary_events_trace(halt + halt, halted=True))

        # Codes 1--4 are source-order host lifecycle observations after slot
        # close, not the code-5 aggregate that belongs in the slot.
        completion = ordered + [lifecycle_event(code) for code in (1, 4, 2, 3)]
        parsed = t.parse_trace(boundary_events_trace(completion))
        self.assertEqual(
            [struct.unpack("<I", t._item(record.tlvs, t.TLV_EVENT_CODE))[0]
             for record in parsed["records"]
             if record.kind == t.KIND_EVENT and record.event_class == t.EVENT_DEVICE],
            [5, 1, 4, 2, 3],
        )
        for lifecycle_code in (1, 2, 3, 4):
            for event_class in slot_classes:
                events = [lifecycle_event(lifecycle_code),
                          (event_class, *slot_event(event_class))]
                with self.assertRaisesRegex(
                    t.TraceError, "slot event after host lifecycle"
                ):
                    t.parse_trace(boundary_events_trace(events))

    def test_terminal_cycle_is_nonmutating_and_comparator_checks_reason(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            left = directory_path / "left"
            right = directory_path / "right"
            left.write_bytes(valid(
                with_event=True, reason=t.REASON_ABORT, terminal_cycle=2))
            right.write_bytes(valid(
                with_event=True, reason=t.REASON_FAILURE, terminal_cycle=2))
            command = [
                sys.executable,
                str(ROOT / "scripts/compare-cadr-general-trace.py"),
                str(left),
                str(right),
            ]
            result = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn("terminal reason", result.stderr)
            right.write_bytes(valid(
                with_event=True, reason=t.REASON_ABORT, terminal_cycle=9))
            with self.assertRaisesRegex(
                t.TraceError, "terminal cycle must equal last nonterminal cycle"
            ):
                t.parse_trace(right.read_bytes())
            result = subprocess.run(command, text=True, capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn("terminal cycle", result.stderr)

    def test_large_interleaved_fixture_is_linear_and_ordered(self) -> None:
        count = 600
        header = t.encode_header(
            selector_mask=0, event_mask=t.EVENT_CLOCK, **KW)
        parsed_header = t.parse_header(header)
        initial = t.encode_record(
            kind=t.KIND_INITIAL, flags=0, sequence=0, boundary=0, cycle=0,
            tlvs=t.initial_tlvs(
                previous=parsed_header.semantic_seed,
                state=INITIAL,
                boundary=0),
        )
        records = [initial]
        previous = record_semantic(initial)
        state = INITIAL
        for ordinal in range(1, count + 1):
            state = D(struct.pack("<I", ordinal))
            boundary = t.encode_record(
                kind=t.KIND_BOUNDARY,
                flags=t.FLAG_EXECUTED,
                sequence=len(records),
                boundary=ordinal,
                cycle=ordinal * 2 - 1,
                selector_mask=0,
                tlvs=t.boundary_tlvs(
                    previous=previous,
                    state=state,
                    flags=t.FLAG_EXECUTED,
                    boundary=ordinal,
                    cycle=ordinal * 2 - 1),
            )
            records.append(boundary)
            previous = record_semantic(boundary)
            event = t.encode_record(
                kind=t.KIND_EVENT,
                flags=0,
                sequence=len(records),
                boundary=ordinal,
                cycle=ordinal * 2,
                event_class=t.EVENT_CLOCK,
                tlvs=t.event_tlvs(
                    previous=previous,
                    state=state,
                    boundary=ordinal,
                    cycle=ordinal * 2,
                    event_class=t.EVENT_CLOCK,
                    code=1,
                    payload=struct.pack("<QQQ", ordinal, ordinal + 1, 1),
                ),
            )
            records.append(event)
            previous = record_semantic(event)
        records.append(t.encode_record(
            kind=t.KIND_TERMINAL,
            flags=0,
            sequence=len(records),
            boundary=count,
            cycle=count * 2,
            tlvs=t.terminal_tlvs(
                accumulated=previous,
                final_state=state,
                record_count=len(records) + 1,
                reason=t.REASON_COMPLETE_LIMIT),
        ))
        parsed = t.parse_trace(t.build_trace(header, records))
        self.assertEqual(parsed["record_count"], count * 2 + 2)
        self.assertEqual(parsed["terminal"]["final_boundary"], count)

    def test_ndjson_modes_are_byte_deterministic_and_range_is_strict(self) -> None:
        raw = valid(with_event=True)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "trace.cdrgtrc1"
            path.write_bytes(raw)
            outputs: dict[str, bytes] = {}
            for mode in ("full", "hash-only", "events", "range"):
                command = [
                    sys.executable,
                    str(ROOT / "scripts/render-cadr-general-trace.py"),
                    str(path),
                    "--mode", mode,
                ]
                if mode == "range":
                    command += ["--range", "1:1"]
                first = subprocess.check_output(command)
                second = subprocess.check_output(command)
                self.assertEqual(first, second)
                self.assertTrue(first.endswith(b"\n"))
                outputs[mode] = first
            terminal_digests = [
                json.loads(value.splitlines()[-1])["semantic_digest"]
                for value in outputs.values()
            ]
            self.assertEqual(
                terminal_digests, [terminal_digests[0]] * len(outputs))
            expected_output_sha256 = {
                "full": "24262fcb2a491d0ee65bedb9833e610ee9bd0fef4da2177e946d818ace26f9e3",
                "hash-only": "bc096571762c8745568b66e7af1558d5ada1e39b2d5504f0cf8abf3db717a8b2",
                "events": "dd290f197b3e49e030c954a4e4f6ca84c14c534d35fba088346407568af4827e",
                "range": "5776229d672ae4f8ec003ccff0f1b8724396b106a4e361a37218ac30381f93df",
            }
            self.assertEqual(
                {mode: hashlib.sha256(data).hexdigest()
                 for mode, data in outputs.items()},
                expected_output_sha256,
            )
            selected = subprocess.run([
                sys.executable,
                str(ROOT / "scripts/render-cadr-general-trace.py"),
                str(path),
                "--expected-initial-state-sha256", INITIAL.hex(),
            ], capture_output=True)
            self.assertEqual(selected.returncode, 0)
            rejected = subprocess.run([
                sys.executable,
                str(ROOT / "scripts/render-cadr-general-trace.py"),
                str(path),
                "--expected-initial-state-sha256", D(b"wrong").hex(),
            ], capture_output=True)
            self.assertEqual(rejected.returncode, 1)
            for invalid in ("-1:1", "2:1", "x:1"):
                result = subprocess.run([
                    sys.executable,
                    str(ROOT / "scripts/render-cadr-general-trace.py"),
                    str(path), "--mode", "range", "--range", invalid,
                ], capture_output=True)
                self.assertNotEqual(result.returncode, 0)
            missing = subprocess.run([
                sys.executable,
                str(ROOT / "scripts/render-cadr-general-trace.py"),
                str(path), "--mode", "range",
            ], capture_output=True)
            self.assertNotEqual(missing.returncode, 0)


if __name__ == "__main__":
    unittest.main()
