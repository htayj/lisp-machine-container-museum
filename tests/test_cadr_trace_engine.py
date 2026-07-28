from __future__ import annotations

import importlib.util
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "cadr_trace_engine_codec", ROOT / "scripts/cadr_general_trace.py")
assert SPEC and SPEC.loader
codec = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = codec
SPEC.loader.exec_module(codec)


class CadrTraceEngineCrossParseTests(unittest.TestCase):
    def test_c_producer_cross_parses_with_authoritative_codec(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            binary = directory / "test-cadr-trace-engine"
            trace = directory / "producer.cdrgtrc1"
            command = [
                "cc",
                "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic",
                "-Wconversion", "-Wshadow", "-Wstrict-prototypes",
                "-Wmissing-prototypes", "-Wformat=2",
                "-DCADR_STATE_V2_TESTING", "-DCADR_TRACE_ENGINE_TESTING",
                "-I", str(ROOT / "cadr-web/include"),
                "-I", str(ROOT / "cadr-web/core"),
                "-I", str(ROOT / "cadr-web/core/usim-port"),
                "-I", str(ROOT / "cadr-web/trace"),
                str(ROOT / "cadr-web/tests/test_cadr_trace_engine.c"),
                str(ROOT / "cadr-web/core/cadr_state_v2.c"),
                str(ROOT / "cadr-web/trace/cadr_trace_engine.c"),
                "-o", str(binary),
            ]
            subprocess.run(command, cwd=ROOT, check=True, capture_output=True)
            subprocess.run([str(binary), "--emit", str(trace)], cwd=ROOT,
                           check=True, capture_output=True)
            parsed = codec.parse_trace(trace.read_bytes())
            self.assertEqual(parsed["record_count"], 7)
            self.assertEqual(
                [record.kind for record in parsed["records"]],
                [codec.KIND_INITIAL, codec.KIND_BOUNDARY, codec.KIND_EVENT,
                 codec.KIND_EVENT, codec.KIND_EVENT, codec.KIND_EVENT,
                 codec.KIND_TERMINAL],
            )
            self.assertEqual(parsed["terminal_reason"], codec.REASON_COMPLETE_LIMIT)

            # This fixture is emitted by the C producer.  Check the actual
            # normalized selector and event bytes as well as codec acceptance,
            # so a mutually permissive C/Python schema drift cannot pass.
            boundary = parsed["records"][1]
            self.assertEqual(
                codec._item(boundary.tlvs, 1),
                struct.pack("<8I", 1, 2, 3, 4, 2, 3, 4, 1),
            )
            self.assertEqual(
                codec._item(boundary.tlvs, 2),
                struct.pack("<QQ", 0x1234, 0x5678),
            )
            self.assertEqual(
                codec._item(boundary.tlvs, 4),
                struct.pack("<4I", 0, 3, 0x22222222, 1),
            )
            self.assertEqual(
                codec._item(boundary.tlvs, 5),
                struct.pack("<4I", 1, 4, 0x33333333, 1),
            )
            transaction = struct.pack(
                "<IIIQIIIIIII",
                1,  # one transaction
                0, 1, 0o400, 0, 0, 0, 0, 0, 0, 0,
            )
            self.assertEqual(codec._item(boundary.tlvs, 12), transaction)

            clock = parsed["records"][2]
            self.assertEqual(clock.event_class, codec.EVENT_CLOCK)
            self.assertEqual(struct.unpack("<I", codec._item(
                clock.tlvs, codec.TLV_EVENT_CODE))[0], 1)
            self.assertEqual(codec._item(clock.tlvs, codec.TLV_EVENT_BYTES),
                             struct.pack("<QQQ", 0, 1, 1))

            device = parsed["records"][3]
            self.assertEqual(device.event_class, codec.EVENT_DEVICE)
            self.assertEqual(struct.unpack("<I", codec._item(
                device.tlvs, codec.TLV_EVENT_CODE))[0], 5)
            self.assertEqual(codec._item(device.tlvs, codec.TLV_EVENT_BYTES),
                             transaction)
            descriptor_digest = bytes(range(0xa0, 0xc0))
            request = parsed["records"][4]
            self.assertEqual(request.event_class, codec.EVENT_DEVICE)
            self.assertEqual(struct.unpack("<I", codec._item(
                request.tlvs, codec.TLV_EVENT_CODE))[0], 1)
            self.assertEqual(
                codec._item(request.tlvs, codec.TLV_EVENT_BYTES),
                struct.pack("<IIQQQ32sQ", 1, 0, 1, 1, (1 << 64) - 1,
                            descriptor_digest, (1 << 64) - 2),
            )
            completion_digest = bytes(range(0xc0, 0xe0))
            completion = parsed["records"][5]
            self.assertEqual(completion.event_class, codec.EVENT_DEVICE)
            self.assertEqual(struct.unpack("<I", codec._item(
                completion.tlvs, codec.TLV_EVENT_CODE))[0], 2)
            self.assertEqual(
                codec._item(completion.tlvs, codec.TLV_EVENT_BYTES),
                struct.pack("<IIIQQQ32s", 1, 0, 0, 1, 1,
                            (1 << 64) - 1, completion_digest),
            )


if __name__ == "__main__":
    unittest.main()
