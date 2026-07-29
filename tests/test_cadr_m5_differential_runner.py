#!/usr/bin/env python3
"""Focused contract tests for the isolated C-M5 differential validator."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts" / "cadr-m5-differential-runner.py"


def write_json_lines(path: Path, values: list[dict[str, object]]) -> None:
    path.write_text("".join(json.dumps(value, sort_keys=True) + "\n" for value in values), encoding="ascii")


class CadrM5DifferentialRunnerTest(unittest.TestCase):
    due = 10
    last = 16
    sb_clear = 12
    external_clear = 14
    disk = "a" * 64
    raw_transcript = b"CDRM5TR1" + (4).to_bytes(4, "little") + (0).to_bytes(4, "little")

    def producer(self, path: Path, producer: str) -> None:
        transcript_sha = hashlib.sha256(self.raw_transcript).hexdigest()
        header: dict[str, object] = {
            "schema": "CDRM5D1", "schema_version": 1,
            "target": "CADR-WEB-303/ABI1.4/C-M5-SCHED-v1", "producer": producer,
            "due_boundary": self.due, "final_boundary": self.last,
            "schedule": "INF-M5-PRE-SLOT-v1", "hook": "source-oracle-disk-xbus-result-latch-v1",
            "ingress": {"clock": "scheduler-event", "keyboard": "scheduler-event",
                        "sequence_break": "scheduler-event", "disk_xbus": "test-only-post-acceptance-latch"},
            "cdrm5tr1_schema": "CDRM5TR1", "cdrm5tr1_version": 4,
            "cdrm5tr1_record_bytes": 120,
            "projected_markers": {"sequence_break_clear_boundary": self.sb_clear,
                                  "external_interrupt_clear_boundary": self.external_clear},
            "disk_sha256_before": self.disk, "disk_sha256_after": self.disk,
            "keyboard_scheduler_value": 1, "projected_keyboard_scancode": 0x10001,
        }
        rows: list[dict[str, object]] = [header]
        for boundary in range(self.due, self.last + 1):
            rows.append({"boundary": boundary, "cdrstate5_sha256": f"{boundary:064x}",
                         "cdrm5tr1_current_sha256": transcript_sha,
                         "sequence_break_pending": boundary < self.sb_clear,
                         "external_interrupt_pending": boundary < self.external_clear})
        write_json_lines(path, rows)
        (directory := path.with_name(f"{path.name}.cdrm5tr1")).write_bytes(self.raw_transcript)

    def oracle(self, directory: Path) -> None:
        directory.mkdir()
        metadata = {
            "schema": "cadr-m5-upstream-scheduler-oracle", "schema_version": 1,
            "capture_status": "instrumented-schedule-captured-not-c-m5-closure",
            "input": {"due_slot": self.due, "post_slots": self.last - self.due},
            "events": {"interrupt_consumption": {
                "sequence_break_consumed_slots": [self.sb_clear],
                "external_interrupt_consumed_slots": [self.external_clear],
            }},
        }
        (directory / "capture.json").write_text(json.dumps(metadata), encoding="ascii")
        rows: list[dict[str, object]] = [{"schema": "cadr-m5-upstream-scheduler-oracle",
            "schema_version": 1, "due_slot": self.due, "post_slots": self.last - self.due,
            "schedule": "INF-M5-PRE-SLOT-v1"}]
        rows.extend({"phase": phase, "machine_cycles": self.due,
                     "sequence_break_consumed": 0, "external_interrupt_consumed": 0}
                    for phase in ("before", "disk-completion", "clock", "keyboard", "sequence-break"))
        rows.append({"phase": "after-slot", "machine_cycles": self.sb_clear,
                     "sequence_break_consumed": 1, "external_interrupt_consumed": 0})
        rows.append({"phase": "after-slot", "machine_cycles": self.external_clear,
                     "sequence_break_consumed": 0, "external_interrupt_consumed": 1})
        write_json_lines(directory / "scheduler.cdrm5usim1.ndjson", rows)

    def command(self, directory: Path) -> list[str]:
        return ["python3", str(RUNNER), "compare", "--native-a", str(directory / "native-a"),
                "--native-b", str(directory / "native-b"), "--wasm-a", str(directory / "wasm-a"),
                "--wasm-b", str(directory / "wasm-b"), "--oracle-capture", str(directory / "oracle"),
                "--native-a-transcript", str(directory / "native-a.cdrm5tr1"),
                "--native-b-transcript", str(directory / "native-b.cdrm5tr1"),
                "--wasm-a-transcript", str(directory / "wasm-a.cdrm5tr1"),
                "--wasm-b-transcript", str(directory / "wasm-b.cdrm5tr1"),
                "--disk-sha256", self.disk, "--due", str(self.due), "--last", str(self.last),
                "--sb-clear", str(self.sb_clear), "--external-clear", str(self.external_clear)]

    def test_accepts_identical_native_wasm_repeats_and_oracle_markers(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            directory = Path(value)
            self.oracle(directory / "oracle")
            for name, producer in (("native-a", "native"), ("native-b", "native"),
                                   ("wasm-a", "wasm"), ("wasm-b", "wasm")):
                self.producer(directory / name, producer)
            result = subprocess.run(self.command(directory), text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["status"], "native-wasm-and-repeats-identical")

    def test_rejects_wrong_projected_clear_marker(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            directory = Path(value)
            self.oracle(directory / "oracle")
            for name, producer in (("native-a", "native"), ("native-b", "native"),
                                   ("wasm-a", "wasm"), ("wasm-b", "wasm")):
                self.producer(directory / name, producer)
            path = directory / "wasm-b"
            rows = [json.loads(line) for line in path.read_text(encoding="ascii").splitlines()]
            rows[2]["sequence_break_pending"] = False
            write_json_lines(path, rows)
            result = subprocess.run(self.command(directory), text=True, capture_output=True, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("projected clear markers disagree", result.stderr)

    def test_rejects_json_that_does_not_bind_raw_sidecar(self) -> None:
        with tempfile.TemporaryDirectory() as value:
            directory = Path(value)
            self.oracle(directory / "oracle")
            for name, producer in (("native-a", "native"), ("native-b", "native"),
                                   ("wasm-a", "wasm"), ("wasm-b", "wasm")):
                self.producer(directory / name, producer)
            path = directory / "wasm-b"
            rows = [json.loads(line) for line in path.read_text(encoding="ascii").splitlines()]
            rows[1]["cdrm5tr1_current_sha256"] = "0" * 64
            write_json_lines(path, rows)
            result = subprocess.run(self.command(directory), text=True, capture_output=True, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("does not bind its raw CDRM5TR1 sidecar", result.stderr)


if __name__ == "__main__":
    unittest.main()
