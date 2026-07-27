from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERIFY = ROOT / "scripts" / "verify-cadr-core-source-map.py"
MAP = ROOT / "cadr-web" / "core" / "usim-port" / "source-map.json"
SOURCE = ROOT / "l" / "usim"


class CadrCoreSourceMapTests(unittest.TestCase):
    def run_verify(self, map_path=MAP, source_root=SOURCE, derived_root=None):
        command = ["python3", str(VERIFY), "--map", str(map_path),
                   "--source-root", str(source_root)]
        if derived_root is not None:
            command.extend(["--derived-root", str(derived_root)])
        return subprocess.run(
            command,
            text=True, capture_output=True, check=False,
        )

    def test_pinned_public_source_closure_verifies(self):
        result = self.run_verify()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("16 production C units", result.stdout)

    def test_rejects_hash_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "usim"
            shutil.copytree(SOURCE, root)
            (root / "m32.c").write_text("drift", encoding="utf-8")
            result = self.run_verify(source_root=root)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("hash or byte drift in m32.c", result.stderr)

    def test_rejects_duplicate_or_missing_symbol_accounting(self):
        with tempfile.TemporaryDirectory() as tmp:
            changed = Path(tmp) / "source-map.json"
            data = json.loads(MAP.read_text(encoding="utf-8"))
            data["symbols"]["m32.c"]["function"]["adapt"].append("rol32")
            changed.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_verify(map_path=changed)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("duplicate symbol classification", result.stderr)

    def test_rejects_extra_closure_member(self):
        with tempfile.TemporaryDirectory() as tmp:
            changed = Path(tmp) / "source-map.json"
            data = json.loads(MAP.read_text(encoding="utf-8"))
            data["selected_production_c_sources"].append("usim.c")
            changed.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_verify(map_path=changed)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing or extra production C source", result.stderr)

    def test_pending_records_are_explicit(self):
        data = json.loads(MAP.read_text(encoding="utf-8"))
        pending = [record for record in data["adaptation_records"]
                   if record["implementation_status"] == "pending"]
        self.assertTrue(pending)
        for record in pending:
            self.assertIn(record["integration_status"], {"pending", "prefix-only"})
            self.assertIn("test_witness", record)
        controller_files = {"disk-controller.c", "tape-controller.c", "uch11.c"}
        for record in data["adaptation_records"]:
            if record["source_file"] in controller_files:
                self.assertEqual(record["implementation_status"], "pending")

    def test_rejects_derived_output_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            derived = Path(tmp) / "usim-port"
            shutil.copytree(ROOT / "cadr-web/core/usim-port", derived)
            (derived / "disk-controller.c").write_text("drift", encoding="utf-8")
            result = self.run_verify(derived_root=derived)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("derived-output drift in disk-controller.c", result.stderr)

    def test_rejects_missing_derived_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            derived = Path(tmp) / "usim-port"
            shutil.copytree(ROOT / "cadr-web/core/usim-port", derived)
            (derived / "uch11.c").unlink()
            result = self.run_verify(derived_root=derived)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing or extra derived production source", result.stderr)

    def test_rejects_extra_derived_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            derived = Path(tmp) / "usim-port"
            shutil.copytree(ROOT / "cadr-web/core/usim-port", derived)
            (derived / "unexpected.c").write_text("void unexpected(void) {}\n",
                                                  encoding="utf-8")
            result = self.run_verify(derived_root=derived)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing or extra derived production source", result.stderr)


if __name__ == "__main__":
    unittest.main()
