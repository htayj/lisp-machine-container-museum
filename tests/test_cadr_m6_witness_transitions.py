"""Linked negative-transition coverage for the native M6 witness state machine."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "cadr-web/tests/cadr_m6_witness_transition_harness.c"
WITNESS = ROOT / "cadr-web/oracle/native/cadr_m6_debug_ir_witness.c"
INCLUDE = ROOT / "cadr-web/oracle/native"


class M6WitnessTransitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls._temporary.name)
        cls.binary = cls.root / "cadr-m6-witness-transition-harness"
        build = subprocess.run([
            "cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic",
            "-I", str(INCLUDE), str(HARNESS), str(WITNESS), "-o", str(cls.binary),
        ], text=True, capture_output=True, check=False)
        if build.returncode != 0:
            raise RuntimeError(build.stderr)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temporary.cleanup()

    def run_case(self, name: str) -> list[dict]:
        case = self.root / name
        case.mkdir()
        schedule = case / "schedule.txt"
        # A valid but deliberately distant event keeps this test focused on the
        # witness transitions rather than keyboard dispatch.
        header = "CADR-M6-SCHEDULE-v1 " + "0" * 64 + " 1\n"
        schedule_text = {
            "invalid-schedule-header": "not-a-cadr-m6-header\n",
            "malformed-schedule": header + "not-a-schedule-row\n",
            "noncanonical-schedule-phase": header + "0 0 0 3\n",
            "noncanonical-schedule-scancode": header + "0 0 0200000 0\n",
            "noncanonical-schedule-ordinal": header + "0 1 0 0\n",
        }.get(name, header + "1000000000000 0 0 0\n")
        schedule.write_text(schedule_text, encoding="ascii")
        capture = case / "capture.ndjson"
        samples = case / "idle.bin"
        completed = subprocess.run(
            [str(self.binary), name, str(schedule), str(capture), str(samples)],
            text=True, capture_output=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stderr)
        if not capture.exists():
            return []
        return [json.loads(line) for line in capture.read_text(encoding="utf-8").splitlines()]

    def assert_failure(self, name: str, reason: str) -> None:
        records = self.run_case(name)
        failures = [record for record in records if record["kind"] == "failure"]
        self.assertEqual(failures, [{"kind": "failure", "reason": reason}])
        self.assertNotIn("complete", [record["kind"] for record in records])

    def test_incomplete_finish_is_rejected_by_the_live_witness_state_machine(self) -> None:
        self.assert_failure("incomplete", "incomplete-witness")

    def test_missing_required_environment_fails_before_any_capture_file_is_opened(self) -> None:
        self.assertEqual(self.run_case("missing-environment"), [])
        self.assertFalse((self.root / "missing-environment" / "capture.ndjson").exists())

    def test_invalid_schedule_header_fails_in_the_live_witness_initializer(self) -> None:
        self.assert_failure("invalid-schedule-header", "invalid-schedule-header")

    def test_malformed_and_noncanonical_schedule_rows_fail_in_the_live_parser(self) -> None:
        self.assert_failure("malformed-schedule", "malformed-schedule")
        for case in (
                "noncanonical-schedule-phase", "noncanonical-schedule-scancode",
                "noncanonical-schedule-ordinal"):
            with self.subTest(case=case):
                self.assert_failure(case, "malformed-or-noncanonical-schedule")

    def test_duplicate_partial_and_reordered_writes_are_rejected_before_a_release_can_form(self) -> None:
        self.assert_failure("duplicate", "noncanonical-debug-ir-write")
        self.assert_failure("partial", "incomplete-witness")
        self.assert_failure("reordered", "noncanonical-debug-ir-write")

    def test_late_listener_idle_c_is_rejected_by_the_live_deadline(self) -> None:
        self.assert_failure("late-c", "missing-C-listener-idle-marker")

    def test_each_live_cleanup_projection_guard_is_rejected_after_the_real_c_transition(self) -> None:
        self.assert_failure("cleanup-debug-ir", "C-cleanup-debug-ir-changed")
        for case in (
                "cleanup-kbd-scancode", "cleanup-kbd-fifo", "cleanup-iob-ready",
                "cleanup-disk-busy", "cleanup-host-request"):
            with self.subTest(case=case):
                self.assert_failure(case, "C-cleanup-invariant-changed")


if __name__ == "__main__":
    unittest.main()
