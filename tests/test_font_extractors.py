from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest import mock


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPTS = REPOSITORY / "scripts"
sys.path.insert(0, str(SCRIPTS))

import lisp_machine_fonts as common  # noqa: E402


def load_script(module_name: str, filename: str):
    spec = importlib.util.spec_from_file_location(module_name, SCRIPTS / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


cadr = load_script("extract_cadr_fonts", "extract-cadr-fonts.py")
genera = load_script("extract_genera_fonts", "extract-genera-fonts.py")


def pack_seven_bit_text(data: bytes) -> list[int]:
    padded = data + b"\x03" * ((-len(data)) % 5)
    return [
        sum(character << shift for character, shift in zip(padded[index : index + 5], (29, 22, 15, 8, 1)))
        for index in range(0, len(padded), 5)
    ]


def quote_binary_word(word: int) -> bytes:
    left = (word >> 18) & cadr.MASK18
    right = word & cadr.MASK18
    return bytes(
        [
            0o360 | ((left >> 14) & 0o17),
            (left >> 6) & 0xFF,
            ((left & 0x3F) << 2) | ((right >> 16) & 0x03),
            (right >> 8) & 0xFF,
            right & 0xFF,
        ]
    )


def evacuated_host_words(words: list[int]) -> bytes:
    return b"".join(quote_binary_word(word) for word in words)


def pack_al_values(values: list[int]) -> list[int]:
    padded = values + [0] * (len(values) % 2)
    return [
        (padded[index] << 20) | (padded[index + 1] << 4)
        for index in range(0, len(padded), 2)
    ]


def simple_al_words(*, corrupt_code: int | None = None) -> list[int]:
    # All 256 character pointers share one empty descriptor.  FNTCNV imports
    # the first 128, each as an eight-pixel advance with a blank one-line cell.
    pointers = [256 - code for code in range(256)]
    if corrupt_code is not None:
        pointers[corrupt_code] = 0x4800
    return pack_al_values([1, 0x0108, *pointers, 17, 0])


class EvacuatedSourceTests(unittest.TestCase):
    def test_plain_text_is_reassembled_into_pdp10_words(self) -> None:
        expected = sum(
            character << shift
            for character, shift in zip(b"ABCDE", (29, 22, 15, 8, 1))
        )
        self.assertEqual(cadr.evacuated_words(b"ABCDE"), [expected])

    def test_host_newline_recovers_its_crlf_pair(self) -> None:
        recovered = cadr.seven_bit_text(cadr.evacuated_words(b"\n"))
        self.assertEqual(recovered, b"\r\n\x03\x03\x03")

    def test_quoted_binary_word_round_trips(self) -> None:
        word = 0o123456654321
        self.assertEqual(cadr.evacuated_words(quote_binary_word(word)), [word])

    def test_binary_quote_inside_text_word_is_rejected(self) -> None:
        with self.assertRaisesRegex(cadr.SourceError, "inside a text word"):
            cadr.evacuated_words(b"A" + quote_binary_word(0))


class CadrAstTests(unittest.TestCase):
    def test_textual_ast_metrics_and_bitmap(self) -> None:
        source = (
            b"KSTID\n2\n1\n0\n"
            b"\f101\n3\n4\n-1\n **\n* *\n"
        )
        font = cadr.parse_ast(Path("demo.ast"), pack_seven_bit_text(source))
        self.assertEqual(font.name, "DEMO")
        self.assertEqual(font.character_height, 2)
        self.assertEqual(font.baseline, 1)
        self.assertEqual(len(font.glyphs), 1)
        glyph = font.glyphs[0]
        self.assertEqual(glyph.code, 0o101)
        self.assertEqual(glyph.advance, 4)
        self.assertEqual(glyph.x_offset, 1)
        self.assertEqual(glyph.y_offset, -1)
        self.assertEqual(glyph.rows, (0b011, 0b101))

    def test_truncated_raster_is_rejected_instead_of_filled_with_blanks(self) -> None:
        source = b"KSTID\n2\n1\n0\n\f101\n3\n4\n0\n***"
        with self.assertRaisesRegex(cadr.SourceError, "truncated AST raster row"):
            cadr.parse_ast(Path("short.ast"), pack_seven_bit_text(source))


class CadrKstTests(unittest.TestCase):
    @staticmethod
    def one_glyph_words() -> list[int]:
        return [
            0,
            (1 << 18) | 1,
            1,
            0o101,
            (1 << 18) | 1,
            1 << 28,
            cadr.MASK36,
        ]

    def test_declared_raster_size_and_exact_separator_are_accepted(self) -> None:
        font = cadr.parse_kst(Path("demo.kst"), self.one_glyph_words())
        self.assertEqual(len(font.glyphs), 1)
        self.assertEqual(font.glyphs[0].rows, (1,))

    def test_truncated_declared_raster_is_rejected(self) -> None:
        with self.assertRaisesRegex(cadr.SourceError, "truncated KST raster"):
            cadr.parse_kst(Path("short.kst"), self.one_glyph_words()[:-1])

    def test_parser_does_not_resynchronize_past_a_bad_separator(self) -> None:
        words = self.one_glyph_words()
        words[-1] = 0
        with self.assertRaisesRegex(cadr.SourceError, "invalid KST separator"):
            cadr.parse_kst(Path("bad-separator.kst"), words)

    def test_nonzero_raster_packing_padding_is_rejected(self) -> None:
        low_bits = self.one_glyph_words()
        low_bits[-2] |= 1
        with self.assertRaisesRegex(cadr.SourceError, "low four bits"):
            cadr.parse_kst(Path("low-bits.kst"), low_bits)

        unused_row_bits = self.one_glyph_words()
        unused_row_bits[-2] |= 2 << 28
        with self.assertRaisesRegex(cadr.SourceError, "nonzero unused bits"):
            cadr.parse_kst(Path("row-padding.kst"), unused_row_bits)

        trailing_byte = self.one_glyph_words()
        trailing_byte[-2] |= 1 << 20
        with self.assertRaisesRegex(cadr.SourceError, "trailing byte padding"):
            cadr.parse_kst(Path("byte-padding.kst"), trailing_byte)


class CadrAlTests(unittest.TestCase):
    def test_formal_256_pointer_table_is_required(self) -> None:
        words = pack_al_values([1, 0x0108, *([1] * 128)])
        with self.assertRaisesRegex(cadr.SourceError, "256 pointers"):
            cadr.parse_al(Path("short.al"), words)

    def test_standalone_al_rejects_an_impossible_character_pointer(self) -> None:
        with self.assertRaisesRegex(cadr.SourceError, "out of range"):
            cadr.parse_al(Path("broken.al"), simple_al_words(corrupt_code=3))

    def test_ar1_mode_omits_only_the_impossible_character(self) -> None:
        font = cadr.parse_al(
            Path("partial.al"),
            simple_al_words(corrupt_code=3),
            tolerate_character_errors=True,
        )
        self.assertEqual(len(font.glyphs), 127)
        self.assertNotIn(3, {glyph.code for glyph in font.glyphs})
        self.assertEqual(font.metadata["character_pointer_integrity"], "partial")
        self.assertEqual(font.metadata["omitted_character_codes"], [3])
        self.assertEqual(
            font.metadata["character_errors"][0]["directory_relative_pointer"],
            0x4800,
        )
        self.assertIn("out of range", font.metadata["character_errors"][0]["error"])

    def test_pixels_below_declared_line_height_are_preserved(self) -> None:
        pointers = [256 - code for code in range(256)]
        code = 0o30
        descriptor_index = 260
        pointers[code] = descriptor_index - code
        words = pack_al_values(
            [
                15,
                0x0C10,
                *pointers,
                17,
                0,
                0x8000,
                0x8000,
                17,
                (14 << 8) | 2,
            ]
        )

        font = cadr.parse_al(Path("overflow.al"), words)
        glyph = next(glyph for glyph in font.glyphs if glyph.code == code)

        self.assertEqual(len(glyph.rows), 16)
        self.assertNotEqual(glyph.rows[14], 0)
        self.assertNotEqual(glyph.rows[15], 0)
        self.assertEqual(glyph.y_offset, font.baseline - 16)
        self.assertEqual(font.metadata["vertical_overflow_codes"], [code])
        self.assertEqual(font.metadata["vertical_overflows"][str(code)], [15])
        self.assertTrue(font.metadata["extent_recovery_required"])
        self.assertEqual(
            font.metadata["historical_loader_extent_status"],
            "recovery-required",
        )


class CadrArcVersionTests(unittest.TestCase):
    @staticmethod
    def entry(name: str, second_name: str, directory_word: int):
        return cadr._ArcEntry(
            name=name,
            second_name=second_name,
            directory_word=directory_word,
            ignored=False,
            descriptor_index=1,
            fbat_index=1,
            descriptor_block_count=1,
            word_length=1,
            words=(0,),
        )

    def test_greatest_numeric_second_name_is_selected(self) -> None:
        selected = cadr._select_latest_numeric_arc_versions(
            [
                self.entry("PRONTO", "1", 100),
                self.entry("PRONTO", "2", 200),
                self.entry("SOLO", "FONT", 300),
            ]
        )
        self.assertEqual(selected["PRONTO"].second_name, "2")
        self.assertEqual(selected["SOLO"].second_name, "FONT")

    def test_duplicate_non_numeric_second_names_are_rejected(self) -> None:
        with self.assertRaisesRegex(cadr.SourceError, "non-numeric"):
            cadr._select_latest_numeric_arc_versions(
                [
                    self.entry("DUP", "A", 100),
                    self.entry("DUP", "B", 200),
                ]
            )


class CadrArcDescriptorTests(unittest.TestCase):
    def test_take_skip_placeholder_and_load_address_counts(self) -> None:
        descriptor = [
            0,
            0o40,
            0o01,
            0o02,
            12,
            13,
            30,
            31,
            0o43,
            0o04,
            0o05,
            0,
        ]

        fbat_index, block_count = cadr._parse_arc_descriptor(
            descriptor, 1, len(descriptor)
        )

        self.assertEqual(fbat_index, (1 << 6) | 2)
        self.assertEqual(block_count, 16)

    def test_descriptor_load_address_cannot_cross_free_index(self) -> None:
        with self.assertRaisesRegex(cadr.SourceError, "truncated.*load address"):
            cadr._parse_arc_descriptor([0, 0o40, 1, 2], 1, 3)


class CadrVariantDeduplicationTests(unittest.TestCase):
    def test_later_source_can_match_an_already_emitted_variant(self) -> None:
        ast = b"KSTID\n1\n1\n0\n\f101\n1\n1\n0\n*\n"
        kst = [0, (1 << 18) | 1]
        for code in range(128):
            kst.extend([1, code, (8 << 18) | 8, 0])
        kst.append(cadr.MASK36)

        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "lmfont"
            output = Path(directory) / "output"
            source.mkdir()
            (source / "demo.ast").write_bytes(
                evacuated_host_words(pack_seven_bit_text(ast))
            )
            (source / "demo.kst").write_bytes(evacuated_host_words(kst))
            (source / "demo.al").write_bytes(
                evacuated_host_words(simple_al_words())
            )
            argv = [
                "extract-cadr-fonts.py",
                str(source),
                "--output",
                str(output),
                "--omit-json",
                "--strict",
            ]
            with (
                mock.patch.object(sys, "argv", argv),
                mock.patch.object(sys, "stdout", io.StringIO()),
                mock.patch.object(sys, "stderr", io.StringIO()),
            ):
                self.assertEqual(cadr.main(), 0)

            catalog = json.loads((output / "catalog.json").read_text())
            self.assertEqual([font["name"] for font in catalog["fonts"]], [
                "DEMO",
                "DEMO-KST",
            ])
            self.assertEqual(len(catalog["alternate_sources"]), 1)
            alternate = catalog["alternate_sources"][0]
            self.assertEqual(alternate["source"], "demo.al")
            self.assertEqual(alternate["selected_output_name"], "DEMO-KST")

            with (
                mock.patch.object(sys, "argv", argv),
                mock.patch.object(sys, "stdout", io.StringIO()),
                mock.patch.object(sys, "stderr", io.StringIO()),
                self.assertRaises(SystemExit) as rerun,
            ):
                cadr.main()
            self.assertEqual(rerun.exception.code, 2)

            stale = output / "bdf" / "obsolete.bdf"
            stale.write_text("obsolete", encoding="ascii")
            with (
                mock.patch.object(sys, "argv", argv + ["--clean"]),
                mock.patch.object(sys, "stdout", io.StringIO()),
                mock.patch.object(sys, "stderr", io.StringIO()),
            ):
                self.assertEqual(cadr.main(), 0)
            self.assertFalse(stale.exists())


class TrackedCadrCatalogTests(unittest.TestCase):
    def test_public_asset_catalog_has_reviewed_recovery_counts(self) -> None:
        catalog = json.loads(
            (
                REPOSITORY
                / "docs"
                / "assets"
                / "mit-cadr-fonts"
                / "catalog.json"
            ).read_text(encoding="utf-8")
        )

        self.assertEqual(catalog["font_count"], 150)
        self.assertEqual(catalog["logical_font_count"], 88)
        self.assertEqual(catalog["variant_count"], 62)
        self.assertEqual(catalog["partial_recovery_count"], 6)
        self.assertEqual(catalog["extent_recovery_font_count"], 45)
        self.assertEqual(catalog["extent_recovery_glyph_count"], 142)

        archives = {
            archive["source"]: archive["observations"]
            for archive in catalog["archives"]
        }
        ast_archive = archives["arc.ast's"]
        self.assertEqual(ast_archive["live_logical_file_block_count"], 275)
        self.assertEqual(ast_archive["live_physical_data_block_count"], 318)

        ar1 = archives["ar1.1"]
        self.assertEqual(ar1["live_entry_count"], 63)
        self.assertEqual(ar1["selected_member_count"], 62)
        self.assertEqual(ar1["live_logical_file_block_count"], 63)
        self.assertEqual(ar1["live_physical_data_block_count"], 101)
        self.assertEqual(ar1["character_pointer_partial_member_count"], 7)
        self.assertEqual(
            ar1["selected_character_pointer_partial_member_count"], 6
        )
        self.assertEqual(ar1["selected_extent_recovery_member_count"], 45)


class OutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.font = common.BitmapFont(
            name="Demo / Font",
            character_height=3,
            raster_height=3,
            baseline=2,
            glyphs=(
                common.Glyph(
                    code=0o101,
                    bitmap_width=3,
                    advance=4,
                    x_offset=0,
                    y_offset=-1,
                    rows=(0b010, 0b111, 0b101),
                ),
            ),
            source_format="synthetic test",
            source_name="fixture",
        )

    def test_outputs_are_deterministic_and_keep_original_character_code(self) -> None:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_paths = common.write_font_outputs(
                self.font, Path(first), foundry="TEST", sheet_label_radix=8
            )
            second_paths = common.write_font_outputs(
                self.font, Path(second), foundry="TEST", sheet_label_radix=8
            )
            self.assertEqual(first_paths, second_paths)
            for relative in first_paths.values():
                self.assertEqual(
                    (Path(first) / relative).read_bytes(),
                    (Path(second) / relative).read_bytes(),
                )
            bdf = (Path(first) / first_paths["bdf"]).read_text(encoding="ascii")
            self.assertIn("ENCODING -1 65", bdf)
            self.assertIn("SWIDTH 1333 0", bdf)
            self.assertIn("FONTBOUNDINGBOX 3 3 0 -1", bdf)
            png = (Path(first) / first_paths["sheet"]).read_bytes()
            self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
            self.assertEqual(struct.unpack(">I", png[8:12])[0], 13)

    def test_filename_is_portable(self) -> None:
        self.assertEqual(common.safe_filename(self.font.name), "demo-font")

    def test_sheet_expands_to_preserve_vertical_raster_overflow(self) -> None:
        overflow_font = common.BitmapFont(
            name="Overflow",
            character_height=3,
            raster_height=3,
            baseline=2,
            glyphs=(
                common.Glyph(
                    code=0,
                    bitmap_width=1,
                    advance=1,
                    x_offset=0,
                    y_offset=-2,
                    rows=(1, 1, 1, 1),
                ),
            ),
            source_format="synthetic test",
            source_name="fixture",
        )
        with tempfile.TemporaryDirectory() as directory:
            sheet = Path(directory) / "overflow.png"
            common.write_sheet(overflow_font, sheet, columns=1, scale=1)
            png = sheet.read_bytes()

        self.assertEqual(struct.unpack(">I", png[16:20])[0], 14)
        self.assertEqual(struct.unpack(">I", png[20:24])[0], 19)


class OutputDirectoryTests(unittest.TestCase):
    def test_clean_removes_only_recognized_generated_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            common.prepare_output_directory(
                output, clean=False, owned_names={"bdf", "catalog.json"}
            )
            (output / "bdf").mkdir()
            (output / "bdf" / "obsolete.bdf").write_text(
                "obsolete", encoding="ascii"
            )

            with self.assertRaisesRegex(ValueError, "pass --clean"):
                common.prepare_output_directory(
                    output, clean=False, owned_names={"bdf", "catalog.json"}
                )

            common.prepare_output_directory(
                output, clean=True, owned_names={"bdf", "catalog.json"}
            )
            self.assertEqual(list(output.iterdir()), [])

            unknown = output / "keep.txt"
            unknown.write_text("not generated", encoding="ascii")
            with self.assertRaisesRegex(ValueError, "unrecognized"):
                common.prepare_output_directory(
                    output, clean=True, owned_names={"bdf", "catalog.json"}
                )
            self.assertEqual(unknown.read_text(encoding="ascii"), "not generated")


class DisplacedArrayTests(unittest.TestCase):
    class FakeWorld:
        def __init__(self) -> None:
            self.read_addresses: list[int] = []

        def follow_q(self, q, *, include_header_forward=True):
            return q, None

        def q(self, address: int):
            self.read_addresses.append(address)
            return genera.Q(genera.DTP_FIXNUM, address)

    @staticmethod
    def array(world, *, indirect, displaced, index_offset=0):
        array = object.__new__(genera.Array)
        array.world = world
        array.indirect = indirect
        array.displaced = displaced
        array.index_offset = index_offset
        array.element_type = 0
        array.packing = 0
        return array

    def test_every_nested_array_index_offset_is_applied_once(self) -> None:
        world = self.FakeWorld()
        root = self.array(
            world,
            indirect=genera.Q(genera.DTP_ARRAY, 100),
            displaced=True,
        )
        middle = self.array(
            world,
            indirect=genera.Q(genera.DTP_ARRAY, 200),
            displaced=True,
            index_offset=7,
        )
        storage = self.array(
            world,
            indirect=genera.Q(genera.DTP_LOCATIVE, 1000),
            displaced=False,
            index_offset=11,
        )

        with mock.patch.object(
            genera,
            "Array",
            side_effect=lambda _world, address: {100: middle, 200: storage}[address],
        ):
            self.assertEqual(root.get_storage(5), 1023)
        self.assertEqual(world.read_addresses, [1023])


class VlodHeaderTests(unittest.TestCase):
    def test_non_v2_world_is_rejected_before_map_decoding(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wrong-version.vlod"
            header = bytearray(20)
            struct.pack_into("<I", header, 0, genera.VLOD_COOKIE)
            struct.pack_into("<I", header, 4, genera.VLOD_V2_VERSION - 1)
            path.write_bytes(header)
            with self.assertRaisesRegex(ValueError, "unsupported VLOD version"):
                genera.World(path)


if __name__ == "__main__":
    unittest.main()
