#!/usr/bin/env python3
"""Focused CDRM11FIX1 native/O0/O2/Wasm differential tests."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts" / "cadr-m11-fixed-table-oracle.py"
SPEC = importlib.util.spec_from_file_location("cadr_m11_fixed_table_oracle", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot import CDRM11FIX1 runner")
ORACLE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ORACLE)


class CadrM11FixedTableOracleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory(prefix="cadr-m11-fixed-table-test-")
        cls.report_path = Path(cls.temporary.name) / "report.json"
        completed = subprocess.run([sys.executable, str(SCRIPT_PATH), "--output", str(cls.report_path)],
                                   cwd=ROOT, check=False, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE)
        if completed.returncode != 0:
            raise AssertionError(completed.stderr.decode("utf-8", "replace"))
        cls.report_bytes = cls.report_path.read_bytes()
        cls.report = json.loads(cls.report_bytes)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_report_is_closed_and_has_the_required_fixed_table_fixture(self) -> None:
        self.assertTrue(self.report_bytes.endswith(b"\n"))
        self.assertEqual(self.report["schema"], "CDRM11FIX2")
        self.assertEqual(self.report["schema_version"], 2)
        semantic = self.report["semantic_results"]
        self.assertEqual(semantic["schema"], "CDRM11FIX1")
        self.assertEqual(semantic["schema_version"], 1)
        self.assertEqual(semantic["fixtures"][0]["pcm_s16le_samples"], ORACLE.EXPECTED_SHORT_SAMPLES)
        self.assertEqual(semantic["fixtures"][0]["packets"][0]["pcm_s16le_sha256"],
                         ORACLE.EXPECTED_SHORT_SHA256)
        self.assertEqual(semantic["fixtures"][1]["pause"]["ack_frames"], 200)
        self.assertEqual(semantic["fixtures"][1]["job"]["half_wavelength_us"], 499)
        self.assertEqual([packet["frames"] for packet in semantic["fixtures"][1]["resumed_packets"]],
                         [312, 512, 1])
        long_packets = semantic["fixtures"][1]
        self.assertEqual({
            "0..511": long_packets["pre_pause_packet"]["pcm_s16le_sha256"],
            "200..511": long_packets["resumed_packets"][0]["pcm_s16le_sha256"],
            "512..1023": long_packets["resumed_packets"][1]["pcm_s16le_sha256"],
            "frame1024": long_packets["resumed_packets"][2]["pcm_s16le_sha256"],
        }, ORACLE.EXPECTED_LONG_HASHES)
        self.assertIn("cadr-web/core/cadr_audio_model.h",
                      [item["path"] for item in self.report["provenance"]["source_closure"]])
        self.assertIn("cadr-web/wasm/cadr_wasm_adapter.c",
                      [item["path"] for item in self.report["provenance"]["source_closure"]])
        self.assertIn("cadr-web/wasm/cadr_wasm_runtime.c",
                      [item["path"] for item in self.report["provenance"]["source_closure"]])
        self.assertEqual([entry["variant"] for entry in self.report["provenance"]["native_builds"]],
                         ["O0", "O2"])
        self.assertEqual([entry["variant"] for entry in self.report["provenance"]["wasm_builds"]],
                         ["O0", "O2"])
        ORACLE.validate_report_bytes(self.report_bytes, ORACLE.source_identities())

    def test_validator_fails_closed_on_an_extra_packet_key(self) -> None:
        mutated = json.loads(self.report_bytes)
        mutated["semantic_results"]["fixtures"][0]["packets"][0]["unbound"] = True
        with self.assertRaises(ORACLE.OracleError):
            ORACLE.validate_report_bytes(
                json.dumps(mutated, separators=(",", ":")).encode("utf-8") + b"\n",
                ORACLE.source_identities())

    def test_validator_rejects_a_wrong_long_hash_and_duplicate_or_noncanonical_json(self) -> None:
        mutated = json.loads(self.report_bytes)
        mutated["semantic_results"]["fixtures"][1]["resumed_packets"][0]["pcm_s16le_sha256"] = (
            "0" * 64)
        with self.assertRaises(ORACLE.OracleError):
            ORACLE.validate_report_bytes(
                json.dumps(mutated, separators=(",", ":")).encode("utf-8") + b"\n",
                ORACLE.source_identities())
        mutated = json.loads(self.report_bytes)
        mutated["semantic_results"]["fixtures"][1]["pause"]["ack_frames"] = True
        with self.assertRaises(ORACLE.OracleError):
            ORACLE.validate_report_bytes(
                json.dumps(mutated, separators=(",", ":")).encode("utf-8") + b"\n",
                ORACLE.source_identities())
        duplicate = b'{"schema":"CDRM11FIX2","schema":"CDRM11FIX2"}\n'
        with self.assertRaises(ORACLE.OracleError):
            ORACLE.validate_report_bytes(duplicate, ORACLE.source_identities())
        noncanonical = self.report_bytes[:-1] + b"\n\n"
        with self.assertRaises(ORACLE.OracleError):
            ORACLE.validate_report_bytes(noncanonical, ORACLE.source_identities())

    def test_reference_decodes_event_timing_and_rejects_zero_offset_mutant(self) -> None:
        multi = self.report["semantic_results"]["fixtures"][1]
        events = [bytes.fromhex(value) for value in multi["events_hex"]]
        self.assertEqual([ORACLE.event_timing(event) for event in events],
                         [(499, 0), (499, 512), (499, 1024)])
        first = ORACLE.pcm_from_event(events[0], 0, 512)
        resumed = ORACLE.pcm_from_event(events[0], 200, 312)
        second = ORACLE.pcm_from_event(events[1], 0, 512)
        tail = ORACLE.pcm_from_event(events[2], 0, 1)
        import hashlib
        self.assertEqual(hashlib.sha256(first).hexdigest(), ORACLE.EXPECTED_LONG_HASHES["0..511"])
        self.assertEqual(hashlib.sha256(resumed).hexdigest(), ORACLE.EXPECTED_LONG_HASHES["200..511"])
        self.assertEqual(hashlib.sha256(second).hexdigest(), ORACLE.EXPECTED_LONG_HASHES["512..1023"])
        self.assertEqual(hashlib.sha256(tail).hexdigest(), ORACLE.EXPECTED_LONG_HASHES["frame1024"])
        resumed_packets = multi["resumed_packets"]
        for event, rendered in zip(events, resumed_packets, strict=True):
            correct = ORACLE.pcm_from_event(event, int(rendered["frame_offset"]),
                                             int(rendered["frames"]))
            mutant = ORACLE.zero_offset_mutant_pcm(event, int(rendered["frames"]))
            self.assertNotEqual(correct, mutant,
                                "erasing event and cursor frame offsets must change resumed PCM")

    def test_runner_uses_selected_m11_exports_and_compiles_the_real_core(self) -> None:
        source = SCRIPT_PATH.read_text(encoding="utf-8")
        self.assertIn("cadr_audio_model.c", source)
        self.assertIn("cadr-web-m12-", source)
        self.assertIn("make", source)
        self.assertIn("-B", source)
        for export in ("cadr_wasm_m11_audio_snapshot_restore", "cadr_wasm_m11_audio_render",
                       "cadr_wasm_m11_audio_ack", "cadr_wasm_m11_audio_snapshot_save"):
            self.assertIn(export, ORACLE.WASM_RUNNER)
        self.assertNotIn("SDL", ORACLE.WASM_RUNNER)
        native = (ROOT / "cadr-web" / "oracle" / "native" /
                  "cadr_m11_fixed_table_oracle.c").read_text(encoding="utf-8")
        self.assertIn("cadr_audio_model_snapshot_adopt", native)
        self.assertIn("fresh model and authority", native)


if __name__ == "__main__":
    unittest.main()
