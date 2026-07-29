#!/usr/bin/env python3
"""Focused synthetic tests for the M4 portability provenance fence."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts/cadr-m4-portability-provenance.py"
SPEC = importlib.util.spec_from_file_location("m4_portability_provenance", HELPER)
assert SPEC is not None and SPEC.loader is not None
PROVENANCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROVENANCE)


class PortabilityProvenanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temporary.name) / "repository"
        self.root.mkdir()
        self.source = self.root / "source.c"
        self.source.write_bytes(b"first source\n")
        self.inputs = {}
        for role, content in {
                "config": b"[cadr]\n",
                "prom": b"prom\x00",
                "prom_symbols": b"prom symbols\n",
                "microcode_symbols": b"ucode symbols\n",
                "disk": b"disk image bytes\n",
        }.items():
            path = pathlib.Path(self.temporary.name) / (role + ".bin")
            path.write_bytes(content)
            self.inputs[role] = path
        self.args = argparse.Namespace(**self.inputs)
        self.preflight = pathlib.Path(self.temporary.name) / "preflight.json"
        self.original_source_paths = PROVENANCE.default_source_paths
        PROVENANCE.default_source_paths = lambda root: [self.source]

    def tearDown(self) -> None:
        PROVENANCE.default_source_paths = self.original_source_paths
        self.temporary.cleanup()

    def test_capture_records_portable_bytes_and_hashes(self) -> None:
        record = PROVENANCE.capture(self.root, self.args)
        source = record["source_files"]["source.c"]
        self.assertEqual(source["bytes"], len(b"first source\n"))
        self.assertEqual(source["sha256"], hashlib.sha256(b"first source\n").hexdigest())
        canonical = json.dumps(
            record["source_files"], sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        self.assertEqual(record["source_state_sha256"], hashlib.sha256(canonical).hexdigest())
        for input_record in record["input_artifacts"].values():
            self.assertFalse(pathlib.PurePath(input_record["identity"]).is_absolute())
            self.assertTrue(input_record["identity"].startswith("external/"))

    def test_verify_rejects_input_and_source_mutation(self) -> None:
        record = PROVENANCE.capture(self.root, self.args)
        self.preflight.write_text(json.dumps(record), encoding="utf-8")
        PROVENANCE.verify(self.root, self.args, self.preflight)

        self.inputs["config"].write_bytes(b"[cadr]\nchanged=true\n")
        with self.assertRaisesRegex(ValueError, "input artifacts changed: config"):
            PROVENANCE.verify(self.root, self.args, self.preflight)

        self.inputs["config"].write_bytes(b"[cadr]\n")
        record = PROVENANCE.capture(self.root, self.args)
        self.preflight.write_text(json.dumps(record), encoding="utf-8")
        self.source.write_bytes(b"second source\n")
        with self.assertRaisesRegex(ValueError, "source files changed: source.c"):
            PROVENANCE.verify(self.root, self.args, self.preflight)


if __name__ == "__main__":
    unittest.main()
