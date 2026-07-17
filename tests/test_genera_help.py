from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "extract-genera-help.py"
SPEC = importlib.util.spec_from_file_location("extract_genera_help_for_tests", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
genera_help = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = genera_help
SPEC.loader.exec_module(genera_help)


def u16(value: int) -> bytes:
    return value.to_bytes(2, "little")


def u32(value: int) -> bytes:
    return value.to_bytes(4, "little")


def thin(value: bytes) -> bytes:
    assert len(value) < 256
    return bytes((genera_help.SAB_STRING, len(value))) + value


def sage_symbol(value: bytes) -> bytes:
    return bytes((genera_help.SAB_SAGE_SYMBOL_DEFINITION,)) + thin(value)


def type_symbol(value: bytes) -> bytes:
    return bytes((genera_help.SAB_TYPE_SYMBOL,)) + sage_symbol(value)


def compact_sab(*, content: bytes = b"First\x8dSecond") -> bytes:
    attributes = bytes((genera_help.SAB_FILE_ATTRIBUTE_ALIST, genera_help.SAB_LIST)) + u16(0)
    record = b"".join(
        (
            bytes((genera_help.SAB_RECORD,)),
            thin(b"Synthetic Help"),
            type_symbol(b"SECTION"),
            bytes((genera_help.SAB_FIELD_ALIST,)) + u16(1),
            bytes((genera_help.SAB_FIELD_NAME,)) + sage_symbol(b"CONTENTS"),
            bytes((genera_help.SAB_CONTENTS_LIST,)) + u16(1) + thin(content),
        )
    )
    index = b"".join(
        (
            bytes((genera_help.SAB_INDEX,)) + u32(1),
            bytes((genera_help.SAB_INDEX_ITEM,)),
            thin(b"Synthetic Help"),
            type_symbol(b"SECTION"),
            u16(0),
        )
    )
    ps_pointer = 4 + 1 + len(attributes) + 8
    index_pointer = ps_pointer + len(record)
    return b"".join(
        (
            u32(0),
            bytes((7,)),
            attributes,
            u32(ps_pointer),
            u32(index_pointer),
            record,
            index,
        )
    )


class GeneraSabUnitTests(unittest.TestCase):
    def test_compact_sab_records_and_lisp_machine_newline(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "help.sab"
            path.write_bytes(compact_sab())
            document = genera_help.parse_sab_file(path)

        self.assertEqual(document["format_version"], 7)
        self.assertEqual(len(document["records"]), 1)
        self.assertEqual(document["records"][0]["topic"], "Synthetic Help")
        rendered = genera_help.render_text(document)
        self.assertIn("First\nSecond", rendered)
        self.assertNotIn("\x8d", rendered)

    def test_styled_string_rle_is_lossless(self) -> None:
        # BIN compact header: opcode 1 (RLE), one-byte dimension; no new
        # character-type definitions; one run using the predefined type zero.
        payload = bytes((genera_help.SAB_STYLED_STRING, 0x02, 3, 0, 3, 0)) + b"ABC"
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "styled.bin"
            path.write_bytes(payload)
            with path.open("rb") as stream:
                reader = genera_help.Reader(stream, path=path)
                value = genera_help.SabThingReader(reader).thing()

        self.assertEqual(value["text"], "ABC")
        self.assertEqual(value["character_codes_base64"], "QUJD")
        self.assertEqual(value["runs"], [{"start": 0, "end": 3, "type_index": 0}])

    def test_lisp_reader_payload_is_never_evaluated(self) -> None:
        source = b'#.(error "must not run")'
        payload = bytes((genera_help.SAB_LISP_READER_SOURCE,)) + thin(source)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "reader.bin"
            path.write_bytes(payload)
            with path.open("rb") as stream:
                value = genera_help.SabThingReader(
                    genera_help.Reader(stream, path=path)
                ).thing()

        self.assertEqual(value, {"kind": "lisp-reader-source", "source": source.decode()})

    def test_discovery_selects_newest_evacuated_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "manual.sab.~2~").write_bytes(b"old")
            (root / "manual.sab.~11~").write_bytes(b"new")
            (root / "other.sab").write_bytes(b"plain")
            selected = genera_help.discover_sab_inputs(root)

        self.assertEqual(
            [(item.logical_path, item.evacuated_version) for item in selected],
            [("manual.sab", 11), ("other.sab", None)],
        )

    def test_standalone_tutorial_selects_versions_and_normalizes_text(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            examples = root / "examples"
            examples.mkdir()
            (examples / "teach-zmacs-master.text.~2~").write_bytes(b"Old")
            (examples / "teach-zmacs-master.text.~6~").write_bytes(
                b"First\x8dSecond"
            )
            (examples / "teach-zmacs-info.text.~1~").write_bytes(b"Instructions")
            manual = root / "contributed" / "macsyma-421" / "manual"
            manual.mkdir(parents=True)
            (manual / "engrman.mdoc.~941~").write_bytes(b"Macsyma help")
            output = root / "output"
            catalog = genera_help.extract_standalone_help(root, output)
            master = next(
                item
                for item in catalog["files"]
                if item["logical_path"].endswith("teach-zmacs-master.text")
            )
            rendered = (output / master["text"]).read_text(encoding="utf-8")

        self.assertEqual(catalog["file_count"], 3)
        self.assertEqual(catalog["runtime_consumed_file_count"], 2)
        self.assertEqual(master["evacuated_version"], 6)
        self.assertTrue(master["runtime_consumer_proven"])
        self.assertEqual(
            master["source_sha256"],
            genera_help.hashlib.sha256(b"First\x8dSecond").hexdigest(),
        )
        self.assertEqual(rendered, "First\nSecond")

    def test_clean_refuses_unknown_nested_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "output"
            nested = output / "json" / "personal-note.txt"
            nested.parent.mkdir(parents=True)
            nested.write_text("keep me", encoding="utf-8")
            with self.assertRaises(genera_help.SabError):
                genera_help._prepare_output(
                    output,
                    clean=True,
                    owned_files={Path("catalog.json"), Path("json/help.json")},
                )
            self.assertEqual(nested.read_text(encoding="utf-8"), "keep me")

    def test_clean_refuses_symlinked_output_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target"
            target.mkdir()
            catalog = target / "catalog.json"
            catalog.write_text("keep me", encoding="utf-8")
            output = root / "output"
            output.symlink_to(target, target_is_directory=True)
            with self.assertRaises(genera_help.SabError):
                genera_help._prepare_output(
                    output, clean=True, owned_files={Path("catalog.json")}
                )
            self.assertEqual(catalog.read_text(encoding="utf-8"), "keep me")

    def test_zetalisp_help_source_scan_handles_slash_escapes(self) -> None:
        source = (
            ';;; -*- Syntax: Zetalisp -*-\n'
            '(DEFUN F (X) "API /"documentation/"" X)\n'
            '(DEFCOM COM-EXAMPLE "Command help" () NIL)\n'
            "(DEFCONST PUNCTUATION '(#/- /; /|))\n"
        )
        spans, unmatched_open, unmatched_close = genera_help.top_level_form_spans(
            source, string_escape="/"
        )
        self.assertEqual(unmatched_open, 0)
        self.assertEqual(unmatched_close, 0)
        self.assertEqual(len(spans), 3)

        spans, unmatched_open, unmatched_close = genera_help.top_level_form_spans(
            ") (OK) ((", string_escape="/"
        )
        self.assertEqual(spans, [(2, 6)])
        self.assertEqual(unmatched_open, 2)
        self.assertEqual(unmatched_close, 1)

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "help.lisp.~4~").write_bytes(source.encode("latin-1"))
            destination = root / "result.jsonl"
            catalog = genera_help.scan_lisp_help_sources(root, destination)
            records = [json.loads(line) for line in destination.read_text().splitlines()]

        self.assertEqual(catalog["file_count"], 1)
        self.assertEqual(catalog["unmatched_files"], [])
        self.assertEqual(len(records), 2)
        self.assertEqual(
            {category for record in records for category in record["categories"]},
            {"api-docstring-candidate", "zmacs-command-documentation"},
        )


@unittest.skipUnless(
    os.environ.get("GENERA_SYS_SCT"),
    "set GENERA_SYS_SCT to run the licensed-media integration audit",
)
class GeneraSabLocalMediaTests(unittest.TestCase):
    def test_every_release_sab_decodes(self) -> None:
        root = Path(os.environ["GENERA_SYS_SCT"])
        inputs = genera_help.discover_sab_inputs(root)
        total_bytes = 0
        total_records = 0
        versions = set()
        for item in inputs:
            document = genera_help.parse_sab_file(item.physical_path)
            total_bytes += document["source_size"]
            total_records += len(document["records"])
            versions.add(document["format_version"])

        self.assertEqual(len(inputs), 801)
        self.assertEqual(total_bytes, 53_186_374)
        self.assertEqual(total_records, 17_266)
        self.assertEqual(versions, {6, 7})


if __name__ == "__main__":
    unittest.main()
