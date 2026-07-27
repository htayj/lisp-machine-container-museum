from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import struct
import sys
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "cadr_oracle_trace.py"


def load_trace():
    spec = importlib.util.spec_from_file_location("cadr_oracle_trace_for_tests", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load trace codec")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


trace = load_trace()


def digest(label: bytes) -> bytes:
    return hashlib.sha256(label).digest()

IDENTITY_COMPONENTS = tuple(digest(f"identity-{index}".encode()) for index in range(8))
IDENTITY_BUNDLE = trace.identity_bundle(IDENTITY_COMPONENTS)
UUID = IDENTITY_BUNDLE[:16]


def rewrite_record(record: bytes, tlvs: tuple[object, ...]) -> bytes:
    _total, kind, _flags, sequence, cycle, _payload_length, _reserved = struct.unpack_from("<IHHQQII", record)
    return trace.encode_record(kind, sequence, cycle, tlvs)


def raw_record(record: bytes, encoded_tlvs: bytes) -> bytes:
    """Replace a record payload without canonicalizing its TLV order."""
    _total, kind, _flags, sequence, cycle, _payload_length, _reserved = struct.unpack_from(
        "<IHHQQII", record)
    padding = (-(32 + len(encoded_tlvs) + 4)) & 7
    total = 32 + len(encoded_tlvs) + padding + 4
    body = struct.pack(
        "<IHHQQII", total, kind, 0, sequence, cycle, len(encoded_tlvs), 0)
    body += encoded_tlvs + b"\0" * padding
    return body + struct.pack("<I", trace.crc32c(body))


class CadrOracleTraceTests(unittest.TestCase):
    def test_crc32c_uses_castagnoli_polynomial(self) -> None:
        self.assertEqual(trace.crc32c(b"123456789"), 0xE3069283)

    def s0(self, *, sequence: int = 0, cycle: int = 0, state: bytes | None = None) -> bytes:
        return trace.boundary_record(
            sequence, cycle, trace.ZERO_SHA256, state or digest(b"S0"),
            trace.EMPTY_MUTATION_SHA256, 0, None, 0, 0, trace.BOUNDARY_S0,
            IDENTITY_COMPONENTS,
        )

    def complete_trace(self, *, streaming: bool = False) -> bytes:
        s0 = self.s0()
        s0_hash = trace.boundary_semantic_hash(s0)
        halt = trace.boundary_record(
            1, 1, s0_hash, digest(b"after one mutation"), digest(b"mutation 0"),
            1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_HALT,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(halt), trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_GUEST_HALT)
        return trace.encode_trace((s0, halt, terminal), UUID, streaming=streaming)

    def test_complete_s0_executed_halt_accepts(self) -> None:
        parsed = trace.parse_trace(self.complete_trace())
        self.assertEqual(parsed["record_count"], 3)
        self.assertEqual(parsed["terminal_status"], trace.TERMINAL_COMPLETE)
        self.assertEqual(parsed["records"][0].kind, trace.KIND_BOUNDARY_HASH)

    def test_streaming_header_terminal_count_is_authoritative(self) -> None:
        parsed = trace.parse_trace(self.complete_trace(streaming=True))
        self.assertEqual(parsed["declared_record_count"], trace.STREAMING_RECORD_COUNT)
        self.assertEqual(parsed["record_count"], 3)

    def test_complete_limit_is_a_successful_running_prefix(self) -> None:
        s0 = self.s0()
        running = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"running processor state"),
            digest(b"enumerated transcript"), 1, 0, 0, 1, trace.BOUNDARY_EXECUTED,
        )
        terminal = trace.terminal_record(
            2, 1, 3, 1, trace.boundary_semantic_hash(running), trace.TERMINAL_COMPLETE,
            trace.TERMINAL_REASON_COMPLETE_LIMIT,
        )
        parsed = trace.parse_trace(trace.encode_trace((s0, running, terminal), UUID))
        self.assertEqual(parsed["terminal_status"], trace.TERMINAL_COMPLETE)
        self.assertEqual(parsed["terminal_reason"], trace.TERMINAL_REASON_COMPLETE_LIMIT)

        relabeled_halt = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"halted state"),
            digest(b"enumerated transcript"), 1, 0, 0, 1,
            trace.BOUNDARY_EXECUTED | trace.BOUNDARY_HALT,
        )
        bad_terminal = trace.terminal_record(
            2, 1, 3, 1, trace.boundary_semantic_hash(relabeled_halt),
            trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_COMPLETE_LIMIT,
        )
        with self.assertRaisesRegex(trace.TraceError, "cannot relabel"):
            trace.parse_trace(trace.encode_trace((s0, relabeled_halt, bad_terminal), UUID))

        bad_pair = trace.terminal_record(
            2, 1, 3, 1, trace.boundary_semantic_hash(running),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_COMPLETE_LIMIT,
        )
        with self.assertRaisesRegex(trace.TraceError, "status and reason"):
            trace.parse_trace(trace.encode_trace((s0, running, bad_pair), UUID))

    def test_s0_contract_and_later_activity_contract(self) -> None:
        # S0 cannot carry a clock slot, a nonzero predecessor, or another flag.
        with self.assertRaisesRegex(trace.TraceError, "clock-slot"):
            s0 = trace.boundary_record(
                0, 0, trace.ZERO_SHA256, digest(b"s"),
                trace.EMPTY_MUTATION_SHA256, 0, 0, 0, 0,
                trace.BOUNDARY_S0, IDENTITY_COMPONENTS)
            terminal = trace.terminal_record(1, 0, 2, 0, trace.boundary_semantic_hash(s0), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
            trace.parse_trace(trace.encode_trace((s0, terminal), UUID))
        s0 = self.s0()
        bad = trace.boundary_record(1, 1, trace.boundary_semantic_hash(s0), digest(b"changed"), digest(b"m"), 1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_INHIBITED)
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(bad), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "executed xor inhibited"):
            trace.parse_trace(trace.encode_trace((s0, bad, terminal), UUID))

    def test_inhibited_and_zero_mutation_may_change_state(self) -> None:
        s0 = self.s0(state=digest(b"before pipeline advance"))
        inhibited = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"pipeline advanced while inhibited"), digest(b"enumerated latch transcript"),
            1, 0, 0, 1, trace.BOUNDARY_INHIBITED,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(inhibited), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        self.assertEqual(trace.parse_trace(trace.encode_trace((s0, inhibited, terminal), UUID))["record_count"], 3)
        zero_exec = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"processor state changed without enumerated transcript"), trace.EMPTY_MUTATION_SHA256,
            1, 0, 0, 0, trace.BOUNDARY_EXECUTED,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(zero_exec), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        self.assertEqual(trace.parse_trace(trace.encode_trace((s0, zero_exec, terminal), UUID))["record_count"], 3)
        bad_empty = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"any state"), digest(b"not empty"),
            1, 0, 0, 0, trace.BOUNDARY_EXECUTED,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(bad_empty), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "EMPTY_MUTATION"):
            trace.parse_trace(trace.encode_trace((s0, bad_empty, terminal), UUID))

    def test_ordinal_and_mutation_ranges_cannot_have_gaps(self) -> None:
        s0 = self.s0()
        gap = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"one"), digest(b"m0"),
            1, 0, 1, 1, trace.BOUNDARY_EXECUTED,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(gap), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "mutation ordinal range"):
            trace.parse_trace(trace.encode_trace((s0, gap, terminal), UUID))
        bad_slot = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"one"), digest(b"m0"),
            1, 7, 0, 1, trace.BOUNDARY_EXECUTED,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(bad_slot), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "clock-slot"):
            trace.parse_trace(trace.encode_trace((s0, bad_slot, terminal), UUID))

    def test_semantic_predecessor_and_terminal_semantic_hash_are_checked(self) -> None:
        data = self.complete_trace()
        records = trace.parse_trace(data)["records"]
        bad = trace.boundary_record(
            1, 1, digest(b"wrong predecessor"), digest(b"after one mutation"), digest(b"mutation 0"),
            1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_HALT,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(bad), trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_GUEST_HALT)
        with self.assertRaisesRegex(trace.TraceError, "predecessor semantic"):
            trace.parse_trace(trace.encode_trace((self.s0(), bad, terminal), UUID))
        s0, halt = self.s0(), self.complete_trace()[64:]
        # A self-consistent outer record chain does not repair a terminal semantic mismatch.
        first = self.s0()
        second = trace.boundary_record(1, 1, trace.boundary_semantic_hash(first), digest(b"after one mutation"), digest(b"mutation 0"), 1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_HALT)
        wrong_terminal = trace.terminal_record(2, 1, 3, 1, digest(b"wrong final semantic hash"), trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_GUEST_HALT)
        with self.assertRaisesRegex(trace.TraceError, "final boundary fields"):
            trace.parse_trace(trace.encode_trace((first, second, wrong_terminal), UUID))
        self.assertEqual(records[1].kind, trace.KIND_BOUNDARY_HASH)

    def test_checkpoint_is_a_boundary_flag_and_kind_two_is_rejected(self) -> None:
        s0 = self.s0()
        checkpoint = trace.boundary_record(
            1, 1, trace.boundary_semantic_hash(s0), digest(b"m"), digest(b"one"),
            1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_CHECKPOINT,
        )
        terminal = trace.terminal_record(2, 1, 3, 1, trace.boundary_semantic_hash(checkpoint), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        self.assertEqual(trace.parse_trace(trace.encode_trace((s0, checkpoint, terminal), UUID))["record_count"], 3)
        with self.assertRaisesRegex(trace.TraceError, "reserved"):
            trace.encode_record(trace.KIND_CHECKPOINT, 0, 0, ())

    def test_external_event_invalidates_complete_but_not_abort(self) -> None:
        s0 = self.s0()
        event = trace.external_event_record(1, 1, 7, 9, b"synthetic")
        halt = trace.boundary_record(
            2, 2, trace.boundary_semantic_hash(s0), digest(b"next"), digest(b"m"),
            1, 0, 0, 1, trace.BOUNDARY_EXECUTED | trace.BOUNDARY_HALT,
        )
        complete = trace.terminal_record(3, 2, 4, 1, trace.boundary_semantic_hash(halt), trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_GUEST_HALT)
        with self.assertRaisesRegex(trace.TraceError, "external event"):
            trace.parse_trace(trace.encode_trace((s0, event, halt, complete), UUID))
        abort = trace.terminal_record(3, 2, 4, 1, trace.boundary_semantic_hash(halt), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        self.assertEqual(trace.parse_trace(trace.encode_trace((s0, event, halt, abort), UUID))["terminal_status"], trace.TERMINAL_ABORT)

    def test_terminal_and_header_mismatches_fail_closed(self) -> None:
        s0 = self.s0()
        abort = trace.terminal_record(1, 0, 99, 0, trace.boundary_semantic_hash(s0), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "final record count"):
            trace.parse_trace(trace.encode_trace((s0, abort), UUID))
        incomplete = trace.encode_trace((s0,), UUID)
        with self.assertRaisesRegex(trace.TraceError, "terminal"):
            trace.parse_trace(incomplete)
        # A complete terminal needs a final halt boundary, even if its counts match.
        terminal = trace.terminal_record(1, 0, 2, 0, trace.boundary_semantic_hash(s0), trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_GUEST_HALT)
        with self.assertRaisesRegex(trace.TraceError, "HALT"):
            trace.parse_trace(trace.encode_trace((s0, terminal), UUID))

    def test_crc_padding_unknown_critical_and_trailing_rejected(self) -> None:
        original = self.complete_trace()
        corrupt = bytearray(original)
        corrupt[64 + 32 + 8] ^= 1
        with self.assertRaisesRegex(trace.TraceError, "CRC"):
            trace.parse_trace(bytes(corrupt))
        s0 = self.s0()
        event = trace.external_event_record(1, 1, 7, 9, b"x", (trace.TraceTLV(9, True, b"extension"),))
        terminal = trace.terminal_record(2, 1, 3, 0, trace.boundary_semantic_hash(s0), trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "unknown critical"):
            trace.parse_trace(trace.encode_trace((s0, event, terminal), UUID))
        with self.assertRaisesRegex(trace.TraceError, "terminal.*last|trailing"):
            trace.parse_trace(original + b"x")

    def test_deterministic_roundtrip_and_limits(self) -> None:
        self.assertEqual(self.complete_trace(), self.complete_trace())
        with self.assertRaisesRegex(trace.TraceError, "conservative"):
            trace.encode_header(trace.MAX_RECORD_COUNT + 1, UUID)
        with self.assertRaisesRegex(trace.TraceError, "conservative"):
            trace.encode_record(trace.KIND_EXTERNAL_EVENT, 0, 0, (trace.TraceTLV(1, True, b"x" * (trace.MAX_PAYLOAD_LENGTH + 1)),))

    def test_s0_identity_is_exact_and_uuid_is_derived(self) -> None:
        parsed = trace.parse_trace(self.complete_trace())
        self.assertEqual(parsed["identity_bundle"], IDENTITY_BUNDLE)
        self.assertEqual(parsed["identity_components"], IDENTITY_COMPONENTS)
        self.assertEqual(parsed["trace_uuid"], IDENTITY_BUNDLE[:16])

        s0 = self.s0()
        parsed_s0 = trace.parse_trace(self.complete_trace())["records"][0]
        without_profile = tuple(
            item for item in parsed_s0.tlvs if item.type != trace.IDENTITY_PROFILE_TLV)
        missing = rewrite_record(s0, without_profile)
        terminal = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(missing),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "exactly identity TLVs"):
            trace.parse_trace(trace.encode_trace((missing, terminal), UUID))

        wrong_components = list(IDENTITY_COMPONENTS)
        wrong_components[3] = digest(b"wrong executable")
        wrong_s0 = trace.boundary_record(
            0, 0, trace.ZERO_SHA256, digest(b"S0"), trace.EMPTY_MUTATION_SHA256,
            0, None, 0, 0, trace.BOUNDARY_S0, wrong_components)
        wrong_tlvs = list(trace._parse_tlvs(
            wrong_s0[32:32 + struct.unpack_from("<I", wrong_s0, 24)[0]]))
        wrong_tlvs[7] = trace.TraceTLV(
            trace.IDENTITY_BUNDLE_TLV, False, IDENTITY_BUNDLE)
        inconsistent = rewrite_record(wrong_s0, tuple(wrong_tlvs))
        terminal = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(inconsistent),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "bundle does not match"):
            trace.parse_trace(trace.encode_trace((inconsistent, terminal), UUID))

        with self.assertRaisesRegex(trace.TraceError, "header UUID"):
            trace.parse_trace(trace.encode_trace(
                (self.s0(), trace.terminal_record(
                    1, 0, 2, 0, trace.boundary_semantic_hash(self.s0()),
                    trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)),
                bytes(range(16))))

    def test_identity_tlv_duplicate_reorder_and_wrong_placement_are_rejected(self) -> None:
        s0 = self.s0()
        payload_length = struct.unpack_from("<I", s0, 24)[0]
        payload = s0[32:32 + payload_length]
        tlv100 = trace.encode_tlv(100, IDENTITY_BUNDLE)
        duplicate = raw_record(s0, payload + tlv100)
        terminal = trace.terminal_record(
            1, 0, 2, 0, digest(b"unreached"),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "strictly increasing"):
            trace.parse_trace(trace.encode_trace((duplicate, terminal), UUID))

        base_tlvs = trace._parse_tlvs(payload)
        reordered_payload = b"".join(
            trace.encode_tlv(item.type, item.value, critical=item.critical)
            for item in (*base_tlvs[:-2], base_tlvs[-1], base_tlvs[-2]))
        reordered = raw_record(s0, reordered_payload)
        with self.assertRaisesRegex(trace.TraceError, "strictly increasing"):
            trace.parse_trace(trace.encode_trace((reordered, terminal), UUID))

        event = trace.external_event_record(
            1, 1, 1, 1, b"x", (trace.TraceTLV(100, False, IDENTITY_BUNDLE),))
        terminal = trace.terminal_record(
            2, 1, 3, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        with self.assertRaisesRegex(trace.TraceError, "only valid on S0"):
            trace.parse_trace(trace.encode_trace((s0, event, terminal), UUID))

    def test_self_consistent_other_identity_needs_selected_expectation(self) -> None:
        other_components = list(IDENTITY_COMPONENTS)
        other_components[0] = digest(b"other profile")
        other_bundle = trace.identity_bundle(other_components)
        s0 = trace.boundary_record(
            0, 0, trace.ZERO_SHA256, digest(b"S0"), trace.EMPTY_MUTATION_SHA256,
            0, None, 0, 0, trace.BOUNDARY_S0, other_components)
        terminal = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        forged = trace.encode_trace((s0, terminal), other_bundle[:16])
        self.assertEqual(trace.parse_trace(forged)["identity_bundle"], other_bundle)
        with self.assertRaisesRegex(trace.TraceError, "bundle.*selected"):
            trace.parse_trace(
                forged, expected_identity_bundle=IDENTITY_BUNDLE)
        with self.assertRaisesRegex(trace.TraceError, "profile.*selected"):
            trace.parse_trace(
                forged, expected_profile_sha256=IDENTITY_COMPONENTS[0])

    def test_unknown_noncritical_extension_outside_identity_range_is_preserved(self) -> None:
        s0 = self.s0()
        parsed_s0 = trace.parse_trace(self.complete_trace())["records"][0]
        extended = rewrite_record(
            s0, (*parsed_s0.tlvs, trace.TraceTLV(109, False, b"future")))
        terminal = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(extended),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED)
        parsed = trace.parse_trace(trace.encode_trace(
            (extended, terminal), UUID))
        self.assertEqual(parsed["records"][0].tlvs[-1].type, 109)


if __name__ == "__main__":
    unittest.main()
