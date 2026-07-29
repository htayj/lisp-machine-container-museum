from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


oracle = load(ROOT / "scripts/cadr-m3-upstream-native-oracle.py", "cadr_m3_upstream_native_oracle_test")
trace = load(ROOT / "scripts/cadr_oracle_trace.py", "cadr_m3_upstream_native_oracle_trace")


class NativeUsimOracleNormalizationTests(unittest.TestCase):
    def complete_trace(self, slots: int) -> bytes:
        components = tuple(hashlib.sha256(f"component-{n}".encode()).digest() for n in range(8))
        bundle = trace.identity_bundle(components)
        records = []
        s0 = trace.boundary_record(0, 0, trace.ZERO_SHA256, hashlib.sha256(b"s0").digest(),
                                   trace.EMPTY_MUTATION_SHA256, 0, None, 0, 0, trace.BOUNDARY_S0, components)
        records.append(s0)
        predecessor = trace.boundary_semantic_hash(s0)
        for ordinal in range(1, slots + 1):
            mutation = hashlib.sha256(f"m-{ordinal}".encode()).digest()
            boundary = trace.boundary_record(ordinal, ordinal, predecessor,
                hashlib.sha256(f"state-{ordinal}".encode()).digest(), mutation, ordinal, ordinal - 1,
                ordinal - 1, 1, trace.BOUNDARY_EXECUTED)
            records.append(boundary)
            predecessor = trace.boundary_semantic_hash(boundary)
        records.append(trace.terminal_record(slots + 1, slots, slots + 2, slots, predecessor,
                                             trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_COMPLETE_LIMIT))
        # The extended runner intentionally exceeds trace-v1's conservative parser
        # limit, but this small synthetic stream uses the same wire contract.
        return trace.encode_trace(tuple(records), bundle[:16])

    def test_normalization_reconciles_raw_cycles_with_post_slot_s(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            raw = root / "raw.cdrtrc1"
            output = root / "normalized.ndjson"
            raw.write_bytes(self.complete_trace(2))
            result = oracle.normalize_trace(raw, output, expected_slots=2)
            lines = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual(result["boundary_count"], 3)
            self.assertEqual([line["s"] for line in lines if line.get("record") == "boundary"], [0, 1, 2])
            one = lines[2]
            self.assertEqual((one["raw_machine_cycles"], one["post_slot_s"], one["pre_slot"]), (1, 1, 0))

    def test_cycle_ordinal_disagreement_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            raw = bytearray(self.complete_trace(1))
            s0_size = int.from_bytes(raw[64:68], "little")
            second = 64 + s0_size
            # The first post-S0 record's logical-cycle field starts at its byte 16.
            raw[second + 16] = 2
            # Recompute its record CRC after the deliberate semantic corruption.
            total = int.from_bytes(raw[second:second + 4], "little")
            offset = second + total - 4
            raw[offset:offset + 4] = oracle.crc32c(bytes(raw[second:offset])).to_bytes(4, "little")
            path = root / "bad.cdrtrc1"
            path.write_bytes(raw)
            with self.assertRaisesRegex(oracle.OracleError, "reconciled"):
                oracle.normalize_trace(path, root / "out.ndjson", expected_slots=1)

    def test_adapter_inspector_accepts_exact_framing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adapter = root / "adapter.cdrm3ad1"
            adapter.write_bytes(
                struct.pack("<8sIIQQ", b"CDRM3AD1", 1, 32, 3, 2) +
                b"a" * 32 + b"b" * 32 + b"c" * 32 +
                struct.pack("<8sQI12s", b"CDRM3AE1", 3, 0, b"\0" * 12))
            result = oracle.inspect_adapter(adapter, expected_slots=2)
            self.assertEqual(result["boundary_count"], 3)
            self.assertEqual(result["s0_sha256"], (b"a" * 32).hex())
            self.assertEqual(result["final_sha256"], (b"c" * 32).hex())

    def test_event_inspector_rejects_nonregister_direction(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "disk.ndjson"
            event = {name: 0 for name in oracle.DISK_NUMERIC_KEYS}
            event.update({
                "record": "disk", "action": "interrupt",
                "register_direction": "read", "interrupt_action": "deassert",
                "request_direction": "none", "media_action": "none",
                "post_slot_s": 1, "intra_slot_sequence": 0,
            })
            path.write_text(
                json.dumps({
                    "requested_slots": 2, "schema": "CDRM3DISK1",
                    "schema_version": 1,
                }, sort_keys=True, separators=(",", ":")) + "\n" +
                json.dumps(event, sort_keys=True, separators=(",", ":")) + "\n",
                encoding="ascii")
            with self.assertRaisesRegex(
                    oracle.OracleError, "non-register has register direction"):
                oracle.inspect_events(
                    path, "CDRM3DISK1", oracle.DISK_KEYS,
                    {"register": 0, "interrupt": 1, "request": 0,
                     "block": 0, "completion": 0},
                    expected_slots=2)

    def test_deterministic_build_policy_hides_staging_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first_args, first_policy = oracle.deterministic_build_arguments(
                root / "random-a")
            second_args, second_policy = oracle.deterministic_build_arguments(
                root / "random-b")
            self.assertEqual(first_policy, second_policy)
            self.assertNotEqual(first_args, second_args)
            self.assertIn("<copied-source>", first_policy["cflags_template"])
            self.assertNotIn(str(root), json.dumps(first_policy))


if __name__ == "__main__":
    unittest.main()
