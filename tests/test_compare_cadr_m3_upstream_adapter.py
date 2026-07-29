from __future__ import annotations

import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / "scripts/compare-cadr-m3-upstream-adapter.py"
HEADER = struct.Struct("<8sIIQQ")
FOOTER = struct.Struct("<8sQI12s")


def canonical(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n"


def write_adapter(path: Path, digests: list[bytes], slots: int) -> None:
    path.write_bytes(
        HEADER.pack(b"CDRM3AD1", 1, 32, len(digests), slots) +
        b"".join(digests) +
        FOOTER.pack(b"CDRM3AE1", len(digests), 0, b"\0" * 12))


def bus_event(value: int = 7) -> dict[str, object]:
    return {
        "record": "bus", "post_slot_s": 1, "intra_slot_sequence": 0,
        "direction": "read", "physical_word_address": 3,
        "write_value": 0, "read_result": value,
        "bus_error_after": 0, "interrupt_status_after": 0,
    }


def disk_event(value: int = 7) -> dict[str, object]:
    return {
        "record": "disk", "post_slot_s": 1, "intra_slot_sequence": 0,
        "action": "register", "register_direction": "read",
        "register_offset": 0, "input_value": 0, "returned_value": value,
        "command": 0, "clp": 0, "da": 0, "lma": 0, "status": value,
        "reset": 0, "done_interrupt_enable": 0,
        "attention_interrupt_enable": 0, "interrupt_action": "none",
        "request_ready": 0, "request_direction": "none",
        "request_clp": 0, "request_cylinder": 0, "request_head": 0,
        "request_block": 0, "selected_unit": 0, "selected_configured": 1,
        "selected_online": 1, "selected_read_only": 0, "selected_fault": 0,
        "selected_attention": 0, "selected_seek_error": 0,
        "selected_cylinder": 0, "selected_head": 0, "selected_lba": 0,
        "media_action": "none",
    }


def write_events(path: Path, schema: str, event: dict[str, object]) -> None:
    path.write_text(
        canonical({"schema": schema, "schema_version": 1, "requested_slots": 2}) +
        canonical(event), encoding="utf-8")


class AdapterComparatorTests(unittest.TestCase):
    def fixture(self, root: Path) -> list[Path]:
        paths = [root / name for name in (
            "ua", "pa", "ub", "pb", "ud", "pd")]
        digests = [bytes([value]) * 32 for value in (1, 2, 3)]
        write_adapter(paths[0], digests, 2)
        write_adapter(paths[1], digests, 2)
        write_events(paths[2], "CDRM3BUS1", bus_event())
        write_events(paths[3], "CDRM3BUS1", bus_event())
        write_events(paths[4], "CDRM3DISK1", disk_event())
        write_events(paths[5], "CDRM3DISK1", disk_event())
        return paths

    def run_comparator(self, paths: list[Path]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(COMPARATOR), *map(str, paths),
             "--expected-slots", "2"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def test_equal_typed_streams_match(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            result = self.run_comparator(self.fixture(Path(temporary)))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("3 CDRM3AD1 digests, 1 bus events, 1 disk events",
                          result.stdout)

    def test_digest_perturbation_reports_first_s(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            data = bytearray(paths[1].read_bytes())
            data[HEADER.size + 32 + 4] ^= 1
            paths[1].write_bytes(data)
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("S1: digest", result.stderr)

    def test_bus_perturbation_reports_s_sequence_and_field(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            write_events(paths[3], "CDRM3BUS1", bus_event(8))
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("S1/seq0: read_result", result.stderr)

    def test_disk_perturbation_reports_s_sequence_and_field(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            write_events(paths[5], "CDRM3DISK1", disk_event(8))
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("S1/seq0: returned_value", result.stderr)

    def test_noncanonical_ndjson_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            value = bus_event()
            paths[3].write_text(
                json.dumps({"schema": "CDRM3BUS1", "schema_version": 1,
                            "requested_slots": 2}) + "\n" +
                json.dumps(value) + "\n", encoding="utf-8")
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("not canonical", result.stderr)

    def test_disk_boolean_and_inactive_request_payload_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            value = disk_event()
            value["selected_online"] = 2
            write_events(paths[5], "CDRM3DISK1", value)
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("non-boolean disk field", result.stderr)
            value = disk_event()
            value["request_clp"] = 1
            write_events(paths[5], "CDRM3DISK1", value)
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("inactive request has payload", result.stderr)

    def test_disk_action_disposition_and_active_chs_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = self.fixture(Path(temporary))
            value = disk_event()
            value.update({"action": "request", "register_direction": "none",
                          "request_ready": 1, "request_direction": "read",
                          "request_cylinder": 815, "media_action": "request"})
            write_events(paths[5], "CDRM3DISK1", value)
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("invalid active request CHS", result.stderr)
            value = disk_event()
            value.update({"action": "interrupt", "register_direction": "none",
                          "interrupt_action": "deassert", "register_offset": 1})
            write_events(paths[5], "CDRM3DISK1", value)
            result = self.run_comparator(paths)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("interrupt has register", result.stderr)


if __name__ == "__main__":
    unittest.main()
