from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "cadr_m2_public_trace_codec", ROOT / "scripts/cadr_general_trace.py")
assert SPEC and SPEC.loader
codec = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = codec
SPEC.loader.exec_module(codec)


class CadrM2PublicTraceCrossParseTests(unittest.TestCase):
    @staticmethod
    def _binary() -> Path:
        configured = os.environ.get("CADR_M2_PUBLIC_BINARY")
        binary = (
            Path(configured)
            if configured
            else ROOT / "cadr-web/build/test_cadr_m2_public"
        )
        if not binary.exists():
            subprocess.run(
                ["make", "build/test_cadr_m2_public"],
                cwd=ROOT / "cadr-web", check=True, capture_output=True)
        return binary

    def test_public_abi_trace_parses_in_python_range_and_event_modes(self) -> None:
        binary = self._binary()

        with tempfile.TemporaryDirectory() as temporary:
            trace = Path(temporary) / "public-api.cdrgtrc1"
            subprocess.run(
                [str(binary), "--emit", str(trace)],
                cwd=ROOT, check=True, capture_output=True)
            parsed = codec.parse_trace(trace.read_bytes())
            records = parsed["records"]
            self.assertEqual(
                [record.kind for record in records],
                [codec.KIND_INITIAL, codec.KIND_BOUNDARY, codec.KIND_EVENT,
                 codec.KIND_TERMINAL],
            )
            boundary = records[1]
            self.assertEqual(
                boundary.flags, codec.FLAG_EXECUTED | codec.FLAG_HALT)
            self.assertEqual(boundary.selector_mask, codec.KNOWN_SELECTOR_MASK)
            halt = records[2]
            self.assertEqual(halt.event_class, codec.EVENT_HALT)
            self.assertEqual(
                struct.unpack(
                    "<I", codec._item(halt.tlvs, codec.TLV_EVENT_CODE))[0],
                1,
            )
            self.assertEqual(
                struct.unpack(
                    "<I", codec._item(halt.tlvs, codec.TLV_EVENT_BYTES))[0],
                codec.CADR_STATUS_HALTED,
            )
            self.assertEqual(
                parsed["terminal_reason"], codec.REASON_COMPLETE_HALT)

            renderer = ROOT / "scripts/render-cadr-general-trace.py"
            events = subprocess.check_output([
                sys.executable, str(renderer), str(trace), "--mode", "events",
            ])
            event_lines = [
                json.loads(line) for line in events.decode().splitlines()]
            self.assertEqual(
                [line["type"] for line in event_lines],
                ["header", "record", "terminal"],
            )
            self.assertEqual(event_lines[1]["kind"], codec.KIND_EVENT)

            selected = subprocess.check_output([
                sys.executable, str(renderer), str(trace), "--mode", "range",
                "--range", "1:1",
            ])
            selected_lines = [
                json.loads(line) for line in selected.decode().splitlines()]
            self.assertEqual(
                [line.get("kind") for line in selected_lines[1:-1]],
                [codec.KIND_BOUNDARY, codec.KIND_EVENT, codec.KIND_TERMINAL],
            )

    def test_public_completion_lifecycle_cross_parses(self) -> None:
        binary = self._binary()
        with tempfile.TemporaryDirectory() as temporary:
            trace = Path(temporary) / "completion.cdrgtrc1"
            subprocess.run(
                [str(binary), "--emit-completion", str(trace)],
                cwd=ROOT, check=True, capture_output=True)
            parsed = codec.parse_trace(trace.read_bytes())
            records = parsed["records"]
            self.assertEqual(
                [record.kind for record in records],
                [codec.KIND_INITIAL, codec.KIND_BOUNDARY, codec.KIND_EVENT,
                 codec.KIND_EVENT, codec.KIND_EVENT, codec.KIND_EVENT,
                 codec.KIND_TERMINAL],
            )
            self.assertEqual(records[1].flags, codec.FLAG_INHIBITED)
            device_events = records[2:6]
            self.assertEqual(
                [record.event_class for record in device_events],
                [codec.EVENT_DEVICE] * 4,
            )
            self.assertEqual(
                [
                    struct.unpack(
                        "<I", codec._item(
                            record.tlvs, codec.TLV_EVENT_CODE))[0]
                    for record in device_events
                ],
                [1, 4, 2, 3],
            )
            self.assertEqual(
                parsed["terminal_reason"], codec.REASON_FAILURE)


if __name__ == "__main__":
    unittest.main()
