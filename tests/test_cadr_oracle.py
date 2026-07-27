from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import subprocess
import unittest
from unittest import mock

REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "cadr-oracle.py"


def load_oracle():
    spec = importlib.util.spec_from_file_location("cadr_oracle_for_tests", SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load oracle script")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


oracle = load_oracle()
REVISION = "f" * 64


def source_entry(name: str, data: bytes) -> dict[str, object]:
    return {"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def profile() -> dict[str, object]:
    return {
        "schema": "cadr-web-profile",
        "schema_version": 1,
        "profile": {"id": "fixture"},
        "source_pins": {
            "usim": {"vcs": "fossil", "hash_algorithm": "sha3-256", "revision": REVISION}
        },
        "artifacts": [],
    }


def source_manifest(files: dict[str, bytes]) -> dict[str, object]:
    return {
        "schema": "cadr-oracle-source-files",
        "schema_version": 1,
        "profile_id": "fixture",
        "source_root": "sources",
        "profile_source_pin": "usim",
        "expected_source_revision": {
            "vcs": "fossil",
            "hash_algorithm": "sha3-256",
            "revision": REVISION,
            "verification": "asserted-not-live-verified",
            "reason": "fixture only; no live Fossil repository is available",
        },
        "files": [source_entry(name, data) for name, data in sorted(files.items())],
    }


class CadrOraclePrepareTests(unittest.TestCase):
    def fixture(self, root: Path, files: dict[str, bytes] | None = None) -> tuple[Path, Path, dict[str, bytes]]:
        files = files or {"one.c": b"int one;\n", "one.h": b"#define ONE 1\n", "Makefile.usim": b"all:\n"}
        source = root / "sources"
        source.mkdir()
        for name, data in files.items():
            (source / name).write_bytes(data)
        profile_path = root / "profile.json"
        manifest_path = root / "manifest.json"
        profile_path.write_text(json.dumps(profile()), encoding="utf-8")
        manifest_path.write_text(json.dumps(source_manifest(files)), encoding="utf-8")
        return profile_path, manifest_path, files

    def prepare(self, root: Path, profile_path: Path, manifest_path: Path, output: str = "build/cadr-oracle/out") -> dict[str, object]:
        return oracle.prepare(repo_root=root, profile_path=profile_path, source_manifest_path=manifest_path, output_value=output)

    def test_happy_path_is_source_only_and_records_fallback_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, files = self.fixture(root)
            before = {name: hashlib.sha256((root / "sources" / name).read_bytes()).hexdigest() for name in files}
            response = self.prepare(root, profile_path, manifest_path)
            output = root / "build/cadr-oracle/out"
            marker = json.loads((output / "prepare.json").read_text(encoding="utf-8"))
            self.assertEqual(response["status"], "ok")
            self.assertEqual(marker["copied_file_count"], len(files))
            self.assertFalse(marker["vcs_live_verified"])
            self.assertEqual(marker["expected_source_revision"]["verification"], "asserted-not-live-verified")
            self.assertEqual(set(path.name for path in (output / "source").iterdir()), set(files))
            self.assertFalse((output / "source/disk-sys-303-0.img").exists())
            self.assertEqual(before, {name: hashlib.sha256((root / "sources" / name).read_bytes()).hexdigest() for name in files})

    def test_hash_drift_fails_without_success_marker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            (root / "sources/one.c").write_bytes(b"drift\n")
            response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertFalse((root / "build/cadr-oracle/out/prepare.json").exists())

    def test_unexpected_source_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            (root / "sources/unexpected.defs").write_text("bad\n", encoding="utf-8")
            response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertIn("unexpected source files", response["errors"][0]["detail"])

    def test_symlink_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            (root / "sources/linked.h").symlink_to("one.h")
            response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertIn("symlink", response["errors"][0]["detail"])

    def test_output_parent_symlink_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            (root / "build").mkdir()
            (root / "redirect").mkdir()
            (root / "build/cadr-oracle").symlink_to(root / "redirect")
            response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertIn("symlink component", response["errors"][0]["detail"])
            self.assertEqual(list((root / "redirect").iterdir()), [])

    def test_output_must_be_empty_and_within_oracle_build_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            occupied = root / "build/cadr-oracle/occupied"
            occupied.mkdir(parents=True)
            (occupied / "old").write_text("old", encoding="utf-8")
            nonempty = self.prepare(root, profile_path, manifest_path, "build/cadr-oracle/occupied")
            outside = self.prepare(root, profile_path, manifest_path, "build/not-oracle")
            self.assertEqual(nonempty["status"], "invalid")
            self.assertEqual(outside["status"], "invalid")
            self.assertTrue((occupied / "old").exists())

    def test_no_partial_success_marker_when_copy_cannot_complete(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            output = root / "build/cadr-oracle/out"
            output.mkdir(parents=True)
            (output / "stale").write_text("present", encoding="utf-8")
            response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertFalse((output / "prepare.json").exists())

    def test_source_mutation_during_copy_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            original = oracle.copy_regular_file_no_follow

            def mutate_after_copy(source, destination, item):
                original(source, destination, item)
                if item["path"] == "one.c":
                    source.write_bytes(b"changed after copy\n")

            with mock.patch.object(
                oracle, "copy_regular_file_no_follow", side_effect=mutate_after_copy
            ):
                response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertIn("source", response["errors"][0]["detail"])
            self.assertFalse((root / "build/cadr-oracle/out/prepare.json").exists())

    def test_file_to_symlink_swap_is_not_followed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            profile_path, manifest_path, _ = self.fixture(root)
            original = oracle.copy_regular_file_no_follow
            swapped = False

            def swap_before_copy(source, destination, item):
                nonlocal swapped
                if not swapped:
                    swapped = True
                    replacement = root / "replacement"
                    replacement.write_bytes(source.read_bytes())
                    source.unlink()
                    source.symlink_to(replacement)
                original(source, destination, item)

            with mock.patch.object(
                oracle, "copy_regular_file_no_follow", side_effect=swap_before_copy
            ):
                response = self.prepare(root, profile_path, manifest_path)
            self.assertEqual(response["status"], "invalid")
            self.assertFalse((root / "build/cadr-oracle/out/prepare.json").exists())

    def test_compare_requires_two_traces(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            response = oracle.compare(repo_root=Path(temporary), trace_values=[])
            self.assertEqual(response["status"], "invalid")
            self.assertIn("at least two", response["errors"][0]["detail"])

    def test_v2_named_closure_copies_chaos_and_applies_patch_only_to_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            usim = root / "l/usim"
            chaos = root / "l/chaos/libhosts"
            usim.mkdir(parents=True)
            chaos.mkdir(parents=True)
            ucode = b"/* ucode.c --- CADR simulator main loop\n */\n\nint native_oracle_fixture;\n"
            host = b"int host_fixture;\n"
            (usim / "ucode.c").write_bytes(ucode)
            (chaos / "hostlib.c").write_bytes(host)
            profile_value = profile()
            profile_value["source_pins"]["chaos"] = {"vcs": "fossil", "hash_algorithm": "sha3-256", "revision": "e" * 64}
            profile_path = root / "profile.json"
            profile_path.write_text(json.dumps(profile_value), encoding="utf-8")
            manifest = {
                "schema": "cadr-oracle-source-files", "schema_version": 2,
                "profile_id": "fixture", "sources": [
                    {"id": "usim", "source_root": "l/usim", "profile_source_pin": "usim",
                     "expected_source_revision": {"vcs": "fossil", "hash_algorithm": "sha3-256", "revision": REVISION, "verification": "asserted-not-live-verified", "reason": "fixture"},
                     "files": [source_entry("ucode.c", ucode)]},
                    {"id": "chaos", "source_root": "l/chaos", "profile_source_pin": "chaos",
                     "expected_source_revision": {"vcs": "fossil", "hash_algorithm": "sha3-256", "revision": "e" * 64, "verification": "asserted-not-live-verified", "reason": "fixture"},
                     "files": [source_entry("libhosts/hostlib.c", host)]},
                ],
            }
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            patch_path = root / "cadr-web/oracle/patches/0001-native-boundary-oracle.patch"
            patch_path.parent.mkdir(parents=True)
            patch_path.write_text(
                "diff --git a/ucode.c b/ucode.c\n"
                "--- a/ucode.c\n"
                "+++ b/ucode.c\n"
                "@@ -1,3 +1,4 @@\n"
                "+/* CADR native-oracle patch anchor */\n"
                " /* ucode.c --- CADR simulator main loop\n"
                "  */\n"
                " \n",
                encoding="utf-8",
            )
            native = root / "cadr-web/oracle/native"
            native.mkdir()
            for relative in oracle.NATIVE_SUPPORT:
                (native / relative.name).write_bytes((REPOSITORY / relative).read_bytes())
            response = oracle.prepare(repo_root=root, profile_path=profile_path, source_manifest_path=manifest_path,
                                      output_value="build/cadr-oracle/out", patch_path=patch_path)
            output = root / "build/cadr-oracle/out"
            self.assertEqual(response["status"], "ok")
            self.assertEqual(json.loads((output / "prepare.json").read_text())["copied_file_count"], 2)
            self.assertTrue((output / "source/chaos/libhosts/hostlib.c").is_file())
            self.assertIn("CADR native-oracle patch anchor", (output / "source/usim/ucode.c").read_text())
            self.assertTrue((output / "source/usim/cadr_oracle_native.c").is_file())
            self.assertEqual((usim / "ucode.c").read_bytes(), ucode)
            (output / "source/usim/cadr_oracle_native.c").write_text("drift\n")
            with self.assertRaisesRegex(oracle.OracleError, "support drifted"):
                oracle.load_prepare_marker(root, "build/cadr-oracle/out")

    def test_tracked_manifest_matches_available_production_source_class(self) -> None:
        source = REPOSITORY / "l/usim"
        if not source.is_dir():
            self.skipTest("ignored pinned usim checkout is unavailable")
        manifest = json.loads(
            (REPOSITORY / "cadr-web/oracle/source-files.json").read_text(encoding="utf-8")
        )
        if manifest["schema_version"] == 1:
            expected = {item["path"] for item in manifest["files"]}
        else:
            expected = {item["path"] for item in next(item for item in manifest["sources"] if item["id"] == "usim")["files"]}
        name_is_source = oracle.is_source_name if manifest["schema_version"] == 1 else oracle.is_closure_source_name
        actual = {
            child.name
            for child in source.iterdir()
            if child.is_file() and name_is_source(child.name)
        }
        self.assertEqual(expected, actual)


class CadrOracleNativeFixtureTests(unittest.TestCase):
    EXPECTED_MUTABLE_FAMILIES = set(range(1, 14)) | {15} | set(range(20, 38))

    def setUp(self) -> None:
        if not (REPOSITORY / "l/usim/ucode.h").is_file():
            self.skipTest("pinned native headers are unavailable")
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.executable = self.root / "hook-fixture"
        completed = subprocess.run([
            "cc", "-std=gnu99", "-Wall", "-Wextra", "-Werror",
            "-I", str(REPOSITORY / "cadr-web/oracle/native"),
            "-I", str(REPOSITORY / "l/usim"),
            "-o", str(self.executable),
            str(REPOSITORY / "cadr-web/oracle/native/cadr_oracle_hook_fixture.c"),
            str(REPOSITORY / "cadr-web/oracle/native/cadr_oracle_native.c"),
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if completed.returncode:
            self.fail(completed.stderr)
        self.counter = 0

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def run_fixture(self, *arguments: str, extra_env: dict[str, str] | None = None) -> tuple[subprocess.CompletedProcess[str], Path, Path]:
        self.counter += 1
        trace = self.root / f"fixture-{self.counter}.trace"
        report = self.root / f"fixture-{self.counter}.json"
        zero = "0" * 64
        environment = {
            **os.environ,
            "CADR_ORACLE_TRACE": str(trace),
            "CADR_ORACLE_REPORT": str(report),
            "CADR_ORACLE_UUID": "0764820bb744024fd2aca181a7996c96",
            "CADR_ORACLE_PROFILE_SHA256": zero,
            "CADR_ORACLE_SOURCE_MANIFEST_SHA256": zero,
            "CADR_ORACLE_PATCH_SHA256": zero,
            "CADR_ORACLE_EXECUTABLE_SHA256": zero,
            "CADR_ORACLE_CONFIG_SHA256": zero,
            "CADR_ORACLE_DISK_SHA256": zero,
            "CADR_ORACLE_PREPARED_TREE_SHA256": zero,
            "CADR_ORACLE_INPUT_AGGREGATE_SHA256": zero,
            **(extra_env or {}),
        }
        completed = subprocess.run(
            [str(self.executable), *arguments], env=environment,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        return completed, trace, report

    def test_fixture_exercises_every_mutable_hook_family(self) -> None:
        completed, trace, report = self.run_fixture()
        self.assertEqual(completed.returncode, 0, completed.stderr)
        closure = json.loads(report.read_text())
        self.assertEqual({int(key) for key in closure["families"]}, self.EXPECTED_MUTABLE_FAMILIES)
        parsed = oracle.load_trace_codec().parse_trace(trace.read_bytes())
        self.assertEqual(parsed["record_count"], 3)
        s0 = {item.type: item for item in parsed["records"][0].tlvs}
        self.assertEqual(set(range(100, 109)), set(s0) & set(range(100, 109)))

    def test_unhandled_device_mutation_fails_at_checkpoint(self) -> None:
        completed, _trace, _report = self.run_fixture("--unhandled-device")
        self.assertEqual(completed.returncode, 70)
        self.assertIn("unhandled device mutation", completed.stderr)

    def test_begin_latch_changes_boundary_state(self) -> None:
        normal, normal_trace, _ = self.run_fixture()
        variant, variant_trace, _ = self.run_fixture("--latch-variant")
        self.assertEqual((normal.returncode, variant.returncode), (0, 0))
        codec = oracle.load_trace_codec()
        normal_parsed = codec.parse_trace(normal_trace.read_bytes())
        variant_parsed = codec.parse_trace(variant_trace.read_bytes())
        normal_state = {item.type: item.value for item in normal_parsed["records"][1].tlvs}[2]
        variant_state = {item.type: item.value for item in variant_parsed["records"][1].tlvs}[2]
        self.assertNotEqual(normal_state, variant_state)

    def test_behavioral_alu_mutation_diverges_at_first_exercising_boundary(self) -> None:
        normal, normal_trace, _ = self.run_fixture()
        mutated, mutated_trace, mutated_report = self.run_fixture(
            extra_env={"CADR_ORACLE_NEGATIVE_ALU_SLOT": "1"})
        self.assertEqual((normal.returncode, mutated.returncode), (0, 0))
        closure = json.loads(mutated_report.read_text())
        self.assertEqual(closure["negative_alu_exercised_slot"], 1)
        codec = oracle.load_trace_codec()
        normal_parsed = codec.parse_trace(normal_trace.read_bytes())
        mutated_parsed = codec.parse_trace(mutated_trace.read_bytes())
        self.assertEqual(normal_parsed["records"][0].tlvs,
                         mutated_parsed["records"][0].tlvs)
        self.assertNotEqual(normal_parsed["records"][1].chain_hash,
                            mutated_parsed["records"][1].chain_hash)

    def test_identity_uuid_mismatch_fails_before_s0(self) -> None:
        completed, _trace, _report = self.run_fixture(
            extra_env={"CADR_ORACLE_UUID": "0" * 32})
        self.assertEqual(completed.returncode, 70)
        self.assertIn("identity UUID", completed.stderr)

    def test_native_identity_hex_rejects_malformed_half_byte(self) -> None:
        completed, _trace, _report = self.run_fixture(extra_env={
            "CADR_ORACLE_PROFILE_SHA256": "0g" + "0" * 62,
        })
        self.assertEqual(completed.returncode, 70)
        self.assertIn("identity hex pair", completed.stderr)

    def test_every_identity_component_changes_bundle_and_uuid(self) -> None:
        baseline, baseline_uuid = oracle.identity_bundle(["00" * 32] * 8)
        for index in range(8):
            components = ["00" * 32] * 8
            components[index] = "01" + "00" * 31
            bundle, uuid = oracle.identity_bundle(components)
            self.assertNotEqual(bundle, baseline)
            self.assertNotEqual(uuid, baseline_uuid)

    def test_component_dump_recomputes_state_and_does_not_change_trace(self) -> None:
        baseline, baseline_trace, _ = self.run_fixture()
        dump_path = self.root / "components.ndjson"
        diagnostic, diagnostic_trace, _ = self.run_fixture(extra_env={
            "CADR_ORACLE_COMPONENT_DUMP": str(dump_path),
            "CADR_ORACLE_COMPONENT_BOUNDARIES": "0,1",
        })
        self.assertEqual((baseline.returncode, diagnostic.returncode), (0, 0))
        self.assertEqual(baseline_trace.read_bytes(), diagnostic_trace.read_bytes())
        records = oracle.load_component_dump(dump_path, expected_boundaries=[0, 1])
        self.assertEqual([record["boundary_ordinal"] for record in records], [0, 1])
        parsed = oracle.load_trace_codec().parse_trace(diagnostic_trace.read_bytes())
        trace_states = [
            {item.type: item.value for item in parsed["records"][index].tlvs}[2].hex()
            for index in (0, 1)
        ]
        self.assertEqual(
            [record["state_sha256"] for record in records], trace_states)
        self.assertEqual(
            [item["tag"] for item in records[0]["scalars"]], list(range(1, 61)))
        self.assertEqual(
            [item["family"] for item in records[0]["tree_roots"]],
            oracle.COMPONENT_TREE_FAMILIES)
        self.assertEqual(
            [item["family"] for item in records[0]["device_roots"]],
            oracle.COMPONENT_DEVICE_FAMILIES)

    def test_component_dump_validator_rejects_component_tamper(self) -> None:
        dump_path = self.root / "components.ndjson"
        completed, _trace, _report = self.run_fixture(extra_env={
            "CADR_ORACLE_COMPONENT_DUMP": str(dump_path),
            "CADR_ORACLE_COMPONENT_BOUNDARIES": "0",
        })
        self.assertEqual(completed.returncode, 0, completed.stderr)
        record = json.loads(dump_path.read_text(encoding="ascii"))
        record["scalars"][1]["value"] ^= 1
        dump_path.write_text(
            json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="ascii")
        with self.assertRaisesRegex(oracle.OracleError, "does not recompute"):
            oracle.load_component_dump(dump_path)

    def test_component_dump_requires_s0_and_increasing_boundaries(self) -> None:
        for selection in ("1", "0,0", "0,2,1"):
            completed, _trace, _report = self.run_fixture(extra_env={
                "CADR_ORACLE_COMPONENT_DUMP": str(
                    self.root / f"invalid-{self.counter + 1}.ndjson"),
                "CADR_ORACLE_COMPONENT_BOUNDARIES": selection,
            })
            self.assertEqual(completed.returncode, 70)
            self.assertIn("component dump", completed.stderr)

    def test_compare_requires_selected_profile_and_rejects_self_consistent_other_identity(self) -> None:
        first, first_trace, _ = self.run_fixture()
        second, second_trace, _ = self.run_fixture()
        self.assertEqual((first.returncode, second.returncode), (0, 0))
        baseline_bundle, _ = oracle.identity_bundle(["00" * 32] * 8)
        missing = oracle.compare(
            repo_root=self.root,
            trace_values=[first_trace.name, second_trace.name],
        )
        self.assertEqual(missing["status"], "invalid")
        self.assertIn("selected expected", missing["errors"][0]["detail"])
        accepted = oracle.compare(
            repo_root=self.root,
            trace_values=[first_trace.name, second_trace.name],
            expected_identity_bundle_sha256=baseline_bundle,
            expected_profile_sha256="00" * 32,
        )
        self.assertEqual(accepted["status"], "ok")

        other_components = ["00" * 32] * 8
        other_components[0] = "01" + "00" * 31
        other_bundle, other_uuid = oracle.identity_bundle(other_components)
        overrides = {
            "CADR_ORACLE_PROFILE_SHA256": other_components[0],
            "CADR_ORACLE_UUID": other_uuid,
        }
        other_first, other_first_trace, _ = self.run_fixture(extra_env=overrides)
        other_second, other_second_trace, _ = self.run_fixture(extra_env=overrides)
        self.assertEqual((other_first.returncode, other_second.returncode), (0, 0))
        forged = oracle.compare(
            repo_root=self.root,
            trace_values=[other_first_trace.name, other_second_trace.name],
            expected_identity_bundle_sha256=baseline_bundle,
            expected_profile_sha256="00" * 32,
        )
        self.assertEqual(forged["status"], "invalid")
        self.assertIn("selected expectation", forged["errors"][0]["detail"])
        selected_other = oracle.compare(
            repo_root=self.root,
            trace_values=[other_first_trace.name, other_second_trace.name],
            expected_identity_bundle_sha256=other_bundle,
            expected_profile_sha256=other_components[0],
        )
        self.assertEqual(selected_other["status"], "ok")


if __name__ == "__main__":
    unittest.main()
