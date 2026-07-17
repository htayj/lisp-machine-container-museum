from __future__ import annotations

import hashlib
import importlib.util
import io
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest import mock
import zlib


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPTS = REPOSITORY / "scripts"
sys.path.insert(0, str(SCRIPTS))


def load_script(module_name: str, filename: str):
    spec = importlib.util.spec_from_file_location(module_name, SCRIPTS / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


qfasl = load_script(
    "extract_cadr_qfasl_fonts_for_visual_tests",
    "extract-cadr-qfasl-fonts.py",
)
visual = load_script(
    "extract_cadr_visual_assets_for_tests",
    "extract-cadr-visual-assets.py",
)
PINNED_SYSTEM46_SOURCE = os.environ.get("MIT_CADR_SYSTEM46_SRC")


def _header(opcode: int, direct_count: int = 0, *, flag: bool = False) -> int:
    return (
        0o100000
        | (0o40000 if flag else 0)
        | (direct_count << 6)
        | opcode
    )


def _symbol(name: str) -> list[int]:
    raw = name.encode("ascii")
    packed = []
    for position in range(0, len(raw), 2):
        first = raw[position]
        second = raw[position + 1] if position + 1 < len(raw) else 0x80
        packed.append(first | (second << 8))
    return [_header(0o03, len(packed)), *packed]


def _fixed(value: int) -> list[int]:
    return [_header(0o06, 1, flag=value < 0), abs(value)]


def _index(table_index: int) -> list[int]:
    return [_header(0o02, 1), table_index]


def _list(table_indices: list[int]) -> list[int]:
    nested = [nibble for index in table_indices for nibble in _index(index)]
    return [_header(0o04, 1), len(table_indices), *nested]


def _array(table_indices: list[int]) -> list[int]:
    nested = [nibble for index in table_indices for nibble in _index(index)]
    return [_header(0o10), *nested]


def _store(source_index: int, destination_index: int) -> list[int]:
    return [_header(0o16, 1), source_index, *_index(destination_index)]


def _eval(form_index: int) -> list[int]:
    return [_header(0o11, 1), form_index]


def _leader_store(array_index: int, subscript_index: int, value_index: int) -> list[int]:
    return [
        _header(0o55, 3),
        array_index,
        subscript_index,
        value_index,
    ]


def _picture_qfasl() -> list[int]:
    """Build the object shape emitted by CVPTS without using a fixture file."""

    stream = [0o143150, 0o071660]
    stream += _symbol("WORKING-STORAGE-AREA")  # table 32
    stream += _symbol("ART-8B")  # table 33
    stream += _fixed(2)  # table 34
    stream += _fixed(3)  # table 35
    stream += _list([34, 35])  # table 36
    stream += _fixed(30)  # table 37: numeric array-leader length
    stream += _symbol("PIC")  # table 38
    stream += _symbol("MAKE-ARRAY-INTO-NAMED-STRUCTURE")  # table 39
    stream += _fixed(1)  # table 40: leader name-handler subscript
    stream += _symbol("PICTURE-HANDLER")  # table 41
    stream += _array([32, 33, 36, 0, 37, 0])  # table 42
    stream += _store(42, 38)
    stream += _leader_store(42, 40, 41)
    stream += _leader_store(42, 34, 38)
    # CVPTS declares one outer direct nibble even though its target is a nested
    # INDEX group. Three raw halfwords pack the six ART-8B values.
    stream += [
        _header(0o56, 1),
        *_index(42),
        *_index(35),
        0x0201,
        0x0403,
        0x0605,
    ]
    stream += _list([39, 38])  # table 43: the sole accepted EVAL form
    stream += _eval(43)
    stream += [_header(0o26)]
    return stream


def _png_chunks(data: bytes) -> list[tuple[bytes, bytes]]:
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise AssertionError("not a PNG")
    chunks = []
    position = 8
    while position < len(data):
        length = struct.unpack(">I", data[position : position + 4])[0]
        kind = data[position + 4 : position + 8]
        payload_start = position + 8
        payload_end = payload_start + length
        payload = data[payload_start:payload_end]
        expected_crc = struct.unpack(">I", data[payload_end : payload_end + 4])[0]
        actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise AssertionError(f"bad {kind!r} CRC")
        chunks.append((kind, payload))
        position = payload_end + 4
    if position != len(data):
        raise AssertionError("truncated PNG chunk")
    return chunks


class VisualAssetRasterTests(unittest.TestCase):
    def test_grayscale_png_is_deterministic_and_lossless(self) -> None:
        pixels = bytes((0, 127, 255, 64, 128, 192))
        first = visual.grayscale_png(3, 2, pixels)
        second = visual.grayscale_png(3, 2, pixels)

        self.assertEqual(first, second)
        self.assertEqual(
            hashlib.sha256(first).hexdigest(),
            "9850dedbe0b61d76fd7d9fcc823c0dc9d1652d88a4ea3434d891883ec6c7c46f",
        )
        chunks = _png_chunks(first)
        self.assertEqual(
            [kind for kind, _payload in chunks],
            [b"IHDR", b"IDAT", b"IEND"],
        )
        self.assertEqual(
            chunks[0][1],
            struct.pack(">IIBBBBB", 3, 2, 8, 0, 0, 0, 0),
        )
        self.assertEqual(
            zlib.decompress(chunks[1][1]),
            b"\x00" + pixels[:3] + b"\x00" + pixels[3:],
        )

    def test_grayscale_png_rejects_incoherent_dimensions(self) -> None:
        for width, height, pixels in ((0, 1, b""), (1, 0, b""), (2, 2, b"\0" * 3)):
            with self.subTest(width=width, height=height, length=len(pixels)):
                with self.assertRaisesRegex(visual.VisualAssetError, "dimensions"):
                    visual.grayscale_png(width, height, pixels)

    def test_xgp_interface_byte_order(self) -> None:
        word = (0x11 << 28) | (0x22 << 20) | (0x33 << 12) | (0x44 << 4)
        self.assertEqual(visual._xgp_interface_bytes([word]), b"\x22\x11\x44\x33")
        with self.assertRaisesRegex(visual.VisualAssetError, "padding"):
            visual._xgp_interface_bytes([word | 1])

    def test_xgp_run_length_rows_alternate_from_white(self) -> None:
        stream = b"\x00\x00\x02\x03\x01\x00\x00\x00\x01"
        self.assertEqual(visual._decode_xgp_rle(stream), [0, 0, 1, 1, 1, 0])
        with self.assertRaisesRegex(visual.VisualAssetError, "trailer"):
            visual._decode_xgp_rle(b"\x00\x00\x02\x00\x00\x99")

    def test_xgp_image_rows_are_lsb_first_and_fixed_width(self) -> None:
        decoded = visual._decode_xgp_image(
            b"\x00\x02" + bytes((0b10000001, 0b00000010)) + bytes(208)
        )
        self.assertEqual(len(decoded), 1680)
        self.assertEqual(decoded[:16], [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0])
        with self.assertRaisesRegex(visual.VisualAssetError, "expected 210"):
            visual._decode_xgp_image(b"\x00\x02" + bytes(209))


class InertPictureQfaslTests(unittest.TestCase):
    def test_numeric_leader_and_exact_inert_conversion_require_opt_in(self) -> None:
        stream = _picture_qfasl()
        with self.assertRaisesRegex(qfasl.QfaslError, "leader initializer"):
            qfasl.FontQfaslParser(stream).parse()

        parser = qfasl.FontQfaslParser(
            stream,
            allow_inert_picture_form=True,
        )
        bindings = parser.parse()
        picture = bindings[qfasl.Symbol("PIC")]
        self.assertIsInstance(picture, qfasl.SerializedArray)
        self.assertEqual(picture.element_type, "ART-8B")
        self.assertEqual(picture.dimensions, (2, 3))
        self.assertEqual(picture.declared_leader_length, 30)
        self.assertEqual(picture.leader[1], qfasl.Symbol("PICTURE-HANDLER"))
        self.assertEqual(picture.leader[2], qfasl.Symbol("PIC"))
        self.assertEqual(picture.values(), [1, 2, 3, 4, 5, 6])
        self.assertIs(parser.table[1], picture)

    def test_default_parser_rejects_eval_before_inspecting_form(self) -> None:
        stream = [
            0o143150,
            0o071660,
            *_eval(0),
            _header(0o26),
        ]
        with self.assertRaisesRegex(qfasl.QfaslError, "unsupported opcode"):
            qfasl.FontQfaslParser(stream).parse()

    def test_picture_opt_in_still_rejects_arbitrary_eval_forms(self) -> None:
        stream = [0o143150, 0o071660]
        stream += _symbol("PROGN")  # table 32
        stream += _list([32])  # table 33
        stream += _eval(33)
        stream += [_header(0o26)]
        with self.assertRaisesRegex(qfasl.QfaslError, "unsupported EVAL form"):
            qfasl.FontQfaslParser(
                stream,
                allow_inert_picture_form=True,
            ).parse()

    def test_picture_opt_in_rejects_flagged_eval(self) -> None:
        stream = _picture_qfasl()
        stream[-3] |= 0o40000
        with self.assertRaisesRegex(qfasl.QfaslError, "unsupported EVAL form"):
            qfasl.FontQfaslParser(
                stream,
                allow_inert_picture_form=True,
            ).parse()

    def test_picture_opt_in_cleanly_rejects_eval_without_operand(self) -> None:
        stream = [
            0o143150,
            0o071660,
            _header(0o11),
            _header(0o26),
        ]
        with self.assertRaisesRegex(qfasl.QfaslError, "EVAL.*direct nibbles"):
            qfasl.FontQfaslParser(
                stream,
                allow_inert_picture_form=True,
            ).parse()


@unittest.skipUnless(
    PINNED_SYSTEM46_SOURCE,
    "set MIT_CADR_SYSTEM46_SRC to the pinned public System 46 src directory",
)
class PinnedSystem46IntegrationTests(unittest.TestCase):
    def test_real_extraction_and_cli_check_match_reviewed_outputs(self) -> None:
        source = Path(PINNED_SYSTEM46_SOURCE)
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "visual-assets"
            with (
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        str(visual.__file__),
                        str(source),
                        "--output",
                        str(output),
                    ],
                ),
                mock.patch.object(sys, "stdout", io.StringIO()),
            ):
                self.assertEqual(visual.main(), 0)

            expected_sha256 = {
                "10leaf.png": "8c2e9ea74a4fc148dde7ca741f31664c9290b31458db62ac2dfc8b8dcb2539b4",
                "scanin-cwh3.png": "523604fd894137901eff9ea70b9fcadbe69c2aa7133fdfb83093ca4245cc983e",
                "catalog.json": "cd2dba2f72acfb314cd7327bf6fca39aa8d8f5c30076adc8e09a63e9be724e04",
            }
            self.assertEqual(
                {
                    path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in output.iterdir()
                },
                expected_sha256,
            )

            with mock.patch.object(
                sys,
                "argv",
                [
                    str(visual.__file__),
                    str(source),
                    "--output",
                    str(output),
                    "--check",
                ],
            ):
                self.assertEqual(visual.main(), 0)

if __name__ == "__main__":
    unittest.main()
