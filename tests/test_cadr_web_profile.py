from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "verify-cadr-web-profile.py"
MANIFEST = REPOSITORY / "cadr-web" / "profiles" / "cadr-web-303.json"


def load_script():
    spec = importlib.util.spec_from_file_location("verify_cadr_web_profile_for_tests", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


profile = load_script()


def fixture_manifest(path: str, data: bytes, *, required: bool = True) -> dict[str, object]:
    return {
        "schema": "cadr-web-profile",
        "schema_version": 1,
        "profile": {"id": "fixture-profile"},
        "source_pins": {
            "fixture": {
                "vcs": "git",
                "hash_algorithm": "sha256",
                "revision": "0" * 64,
            }
        },
        "artifacts": [
            {
                "id": "fixture-artifact",
                "path": path,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "disposition": "local-only",
                "required": required,
            }
        ],
    }


class CadrWebProfileTests(unittest.TestCase):
    def verify(self, manifest: dict[str, object], root: Path) -> dict[str, object]:
        return profile.verify_profile(manifest, root)

    def test_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data = b"CADR-WEB fixture\n"
            (root / "inputs").mkdir()
            (root / "inputs" / "good.bin").write_bytes(data)
            summary = self.verify(fixture_manifest("inputs/good.bin", data), root)
        self.assertEqual(summary["status"], "ok")
        self.assertEqual(summary["checked"], 1)
        self.assertTrue(summary["milestone_ready"])

    def test_hash_mismatch_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "input.bin").write_bytes(b"actual!!")
            manifest = fixture_manifest("input.bin", b"expected")
            summary = self.verify(manifest, root)
        self.assertEqual(summary["status"], "invalid")
        self.assertEqual(summary["errors"][0]["code"], "sha256-mismatch")

    def test_size_mismatch_fails_before_hashing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "input.bin").write_bytes(b"longer")
            manifest = fixture_manifest("input.bin", b"short")
            summary = self.verify(manifest, root)
        self.assertEqual(summary["status"], "invalid")
        self.assertEqual(summary["errors"][0]["code"], "size-mismatch")

    def test_absolute_and_escaping_paths_are_rejected(self) -> None:
        for path in ("/tmp/input.bin", "../input.bin", "inputs/../../input.bin", "bad\u0000name"):
            with self.subTest(path=path):
                summary = self.verify(fixture_manifest(path, b"fixture"), Path.cwd())
                self.assertEqual(summary["status"], "invalid")
                self.assertEqual(summary["errors"][0]["code"], "schema")

    def test_missing_optional_artifact_is_allowed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            summary = self.verify(fixture_manifest("missing.bin", b"fixture", required=False), Path(temporary))
        self.assertEqual(summary["status"], "ok")
        self.assertEqual(summary["checked"], 0)
        self.assertEqual(summary["optional_missing"], 1)

    def test_symlink_loop_is_a_machine_readable_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "loop").symlink_to("loop")
            summary = self.verify(fixture_manifest("loop", b"fixture"), root)
        self.assertEqual(summary["status"], "invalid")
        self.assertIn(summary["errors"][0]["code"], {"path", "missing"})

    def test_production_profile_invariants(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        profile.validate_schema(manifest)
        profile.validate_cadr_web_303_invariants(manifest)
        summary = self.verify(manifest, REPOSITORY)
        disk = next(item for item in manifest["artifacts"] if item["id"] == "system-303-0-base-disk")
        self.assertEqual(disk["sha256"], "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5")
        self.assertEqual(disk["disposition"], "unresolved-local-import")
        self.assertEqual(disk["upstream_mismatch"]["first_differing_byte"], 1026)
        artifacts = {item["id"]: item for item in manifest["artifacts"]}
        self.assertEqual(
            artifacts["cadet-keyboard-device-source"]["sha256"],
            "e8974b1bbee8f30a4d55ea76bff8e9b519a02d32056997bf9c5089f2b217860b",
        )
        self.assertEqual(manifest["saved_state"]["disposition"], "excluded")
        self.assertEqual(manifest["native_executable"]["disposition"], "m0-boot-golden")
        self.assertEqual(summary["open_blockers"], 1)
        self.assertEqual(summary["open_m0_blockers"], 0)
        self.assertTrue(summary["m0_evidence_valid"])
        self.assertTrue(summary["milestone_ready"])
        runs = manifest["native_boot_series"]["runs"]
        self.assertEqual(len(runs), 3)
        pixels = {run["listener"]["pixel_sha256"] for run in runs}
        self.assertEqual(pixels, {manifest["native_boot_series"]["listener_pixel_sha256"]})
        self.assertTrue(all(run["saved_state_input"] is False for run in runs))
        self.assertTrue(all(run["boot_phases"] == profile.m0_phase_evidence() for run in runs))
        self.assertTrue(all(run["resume_requested"] is False for run in runs))
        self.assertTrue(all(run["generation"] == 1 for run in runs))
        self.assertTrue(all(run["window_title"] == "usim" for run in runs))
        self.assertEqual(
            artifacts["usite-extra-hosts"]["sha256"],
            "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
        )

    def test_production_artifact_metadata_is_independently_pinned(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        control_store = next(
            item for item in manifest["artifacts"] if item["id"] == "prom-control-store"
        )
        control_store["sha256"] = "0" * 64
        summary = self.verify(manifest, REPOSITORY)
        self.assertEqual(summary["status"], "invalid")
        self.assertIn("artifact identities", summary["errors"][0]["detail"])

    def test_production_profile_cannot_turn_the_excluded_disk_into_a_bundle_input(self) -> None:
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        disk = next(item for item in manifest["artifacts"] if item["id"] == "system-303-0-base-disk")
        disk["disposition"] = "tracked"
        disk["required"] = True
        summary = self.verify(manifest, REPOSITORY)
        self.assertEqual(summary["status"], "invalid")
        self.assertIn("artifact identities", summary["errors"][0]["detail"])

    def test_m0_rejects_changed_bound_runtime_identities(self) -> None:
        changes = {
            "source revision": lambda m: m["native_boot_series"]["runs"][0]["public_source_revisions_at_start"].__setitem__("system", "0" * 64),
            "prom hash": lambda m: m["native_boot_series"]["runs"][0]["private_machine_artifacts_sha256_at_start"].__setitem__("promh.mcr", "0" * 64),
            "title": lambda m: m["native_boot_series"]["runs"][0].__setitem__("window_title", "wrong"),
            "hosts hash": lambda m: m["native_boot_series"]["runs"][0]["private_source_tree_sha256_at_copy_and_start"].__setitem__("usite", "0" * 64),
            "resume flag": lambda m: m["native_boot_series"]["runs"][0].__setitem__("resume_requested", True),
            "generation": lambda m: m["native_boot_series"]["runs"][0].__setitem__("generation", 2),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
                change(manifest)
                summary = self.verify(manifest, REPOSITORY)
                self.assertEqual(summary["status"], "invalid")
                self.assertEqual(summary["errors"][0]["code"], "schema")


if __name__ == "__main__":
    unittest.main()
