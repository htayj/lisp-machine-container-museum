#!/usr/bin/env python3
"""Static exact-anchor tests for disposable public-usim witness patches."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "cadr_native_source_witness.py"
SPEC = importlib.util.spec_from_file_location("cadr_native_source_witness", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot import native witness preparer")
WITNESS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WITNESS)


class NativeSourceWitnessTests(unittest.TestCase):
    @staticmethod
    def fake_xvfb(directory: Path):
        """Avoid starting any X server in a source-witness unit test."""
        authority = directory / "Xauthority"
        authority.write_bytes(b"unit-test-authority\n")
        os.chmod(authority, 0o600)
        log = directory / "xvfb.log"
        log.write_bytes(b"unit-test-xvfb\n")
        os.chmod(log, 0o600)
        return object(), {"display": ":299", "screen": "unit-test",
                          "mit_shm": "disabled-and-verified",
                          "log": {"path": "xvfb.log", **WITNESS.file_identity(log)}}, ":299", authority

    def assert_exact_patch(self, kind: str) -> None:
        config = WITNESS.WITNESSES[kind]
        inputs = WITNESS.checked_inputs(config)
        self.assertEqual({item["path"] for item in inputs}, set(config["sources"]))
        patch = WITNESS.checked_patch(kind, config)
        self.assertEqual(patch["path"], config["patch"].as_posix())
        with tempfile.TemporaryDirectory(prefix="cadr-native-witness-") as temporary:
            usim = Path(temporary) / "usim"
            usim.mkdir()
            second = "sdl3-audio.c" if kind == "m11-audio" else "ucode.c"
            for source_name in ("Makefile.usim", second):
                shutil.copyfile(WITNESS.SOURCE_WORKTREE / "usim" / source_name,
                                usim / source_name)
            WITNESS.run_patch(ROOT / config["patch"], usim, dry_run=True)

    def test_m11_audio_patch_has_exact_public_anchors(self) -> None:
        self.assert_exact_patch("m11-audio")

    def test_m12_debugger_patch_has_exact_public_anchors(self) -> None:
        self.assert_exact_patch("m12-debugger")

    def test_capture_plan_binds_the_built_executable_identity(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cadr-native-plan-") as temporary:
            executable = Path(temporary) / "usim"
            executable.write_bytes(b"public witness identity\n")
            marker = {"source_tree_sha256": "a" * 64}
            with mock.patch.object(WITNESS, "build_executable", return_value=(marker, executable)):
                plan = WITNESS.capture_plan("m11-audio", "build/cadr-oracle/plan-test")
        self.assertEqual(plan["status"], "planned")
        self.assertTrue(plan["requires"]["execute"])
        self.assertEqual(plan["command"]["witness_schema"], "CDRM11USIM1")
        self.assertEqual(plan["prepared_source_tree_sha256"], "a" * 64)

    def test_cli_refuses_native_execution_without_explicit_execute(self) -> None:
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            result = WITNESS.main([
                "m11-audio", "native-capture", "--prepared", "build/cadr-oracle/no-run",
                "--config", "/private/usim.ini", "--private-runtime", "/private",
                "--private-disk", "/private/disk.img", "--output", "build/cadr-oracle/no-run-output",
                "--session-id", "test-no-execute",
            ])
        self.assertEqual(result, 2)
        response = json.loads(stream.getvalue())
        self.assertEqual(response["status"], "invalid")
        self.assertEqual(response["error"], "explicit --execute is required")

    def test_native_capture_executes_only_a_copied_witness_and_checks_disk(self) -> None:
        output_root = ROOT / "build" / "cadr-oracle"
        output_root.mkdir(parents=True, exist_ok=True)
        output = Path(tempfile.mkdtemp(prefix="capture-test-", dir=output_root))
        try:
            with tempfile.TemporaryDirectory(prefix="cadr-native-runtime-") as temporary:
                runtime = Path(temporary)
                os.chmod(runtime, 0o700)
                config = runtime / "usim.ini"
                disk = runtime / "disk.img"
                config.write_text("[usim]\nbeep_amplitude = 0.8\nuse_ascii_beep = false\n", encoding="utf-8")
                disk.write_bytes(b"private disk bytes\n")
                executable = runtime / "prepared-usim"
                executable.write_text(
                    "#!/bin/sh\n"
                    "printf '%s\\n' "
                    "'{\"schema\":\"CDRM11USIM1\",\"schema_version\":2}' "
                    "'{\"duration_us\":1,\"event\":\"beep-job\",\"event_sha256\":\"425f4a13f2cceabb8aa35b85b59efe234b30b1604e435d6b9173e7435cb8f130\",\"half_wavelength_us\":1,\"sequence\":0,\"wavelength_us\":2}' "
                    "'{\"event\":\"pcm-block\",\"frame_count\":1,\"pcm_s16le_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sample_bytes\":2,\"sample_rate\":8000,\"sequence\":1}' "
                    "> \"$CADR_M11_AUDIO_WITNESS\"\n",
                    encoding="utf-8",
                )
                os.chmod(executable, 0o700)
                marker = {"source_tree_sha256": "b" * 64,
                          "repository_worktree_git": WITNESS.REPOSITORY_WORKTREE_GIT,
                          "patch": {"sha256": "c" * 64}}
                with mock.patch.object(WITNESS, "build_executable", return_value=(marker, executable)), \
                        mock.patch.object(WITNESS, "start_private_xvfb", side_effect=self.fake_xvfb), \
                        mock.patch.object(WITNESS, "stop_xvfb", return_value=(0, False)):
                    result = WITNESS.native_capture(
                        "m11-audio", "build/cadr-oracle/capture-test-prepared", str(config),
                        str(runtime), str(disk), str(output.relative_to(ROOT)), "capture-test",
                    )
            self.assertEqual(result["status"], "captured")
            metadata = result["metadata"]
            self.assertEqual(metadata["private_disk"]["sha256_at_start"],
                             metadata["private_disk"]["sha256_at_end"])
            self.assertEqual(metadata["witness"]["records"], 3)
            self.assertEqual(metadata["prepared"]["repository_worktree_git"], WITNESS.REPOSITORY_WORKTREE_GIT)
            self.assertEqual(metadata["actions"], [
                {"action": "launch", "argv": ["usim", "-c", "<private-config>"]},
                {"action": "observe", "event": "beep-job"},
                {"action": "observe", "event": "pcm-block"},
                {"action": "exit", "returncode": 0},
            ])
            self.assertEqual(set(metadata["logs"]), {"stdout.log", "stderr.log", "xvfb.log"})
            self.assertTrue(all(item["sha256"] for item in metadata["logs"].values()))
            self.assertEqual((output / "witness.ndjson").stat().st_mode & 0o777, 0o600)
        finally:
            shutil.rmtree(output, ignore_errors=True)

    def test_m12_capture_can_prove_the_witness_only_candidate_pause_resume(self) -> None:
        output_root = ROOT / "build" / "cadr-oracle"
        output_root.mkdir(parents=True, exist_ok=True)
        output = Path(tempfile.mkdtemp(prefix="m12-control-test-", dir=output_root))
        try:
            with tempfile.TemporaryDirectory(prefix="cadr-native-runtime-") as temporary:
                runtime = Path(temporary)
                os.chmod(runtime, 0o700)
                config = runtime / "usim.ini"; disk = runtime / "disk.img"
                config.write_text("private configuration\n", encoding="utf-8")
                disk.write_bytes(b"private disk bytes\n")
                executable = runtime / "prepared-usim"
                candidate = ('{"event":"candidate-loop","label":"QMLP",'
                             '"location_counter":0,"machine_cycles":0,"next_pc":0,'
                             '"p0_pc":0,"p1_pc":116,"sequence":0}')
                entered = candidate.replace("candidate-loop", "candidate-pause-enter").replace('"sequence":0', '"sequence":1')
                resumed = candidate.replace("candidate-loop", "candidate-pause-resume").replace('"sequence":0', '"sequence":2')
                executable.write_text(
                    "#!/bin/sh\n"
                    "printf '%s\\n' "
                    "'{\"schema\":\"CDRM12USIM1\",\"schema_version\":1}' "
                    f"'{candidate}' '{entered}' > \"$CADR_M12_DEBUGGER_WITNESS\"\n"
                    "while [ \"$(cat \"$CADR_M12_DEBUGGER_WITNESS_CONTROL\")\" != resume ]; do sleep 0.01; done\n"
                    f"printf '%s\\n' '{resumed}' >> \"$CADR_M12_DEBUGGER_WITNESS\"\n",
                    encoding="utf-8",
                )
                os.chmod(executable, 0o700)
                marker = {"source_tree_sha256": "d" * 64,
                          "repository_worktree_git": WITNESS.REPOSITORY_WORKTREE_GIT,
                          "patch": {"sha256": "e" * 64}}
                with mock.patch.object(WITNESS, "build_executable", return_value=(marker, executable)), \
                        mock.patch.object(WITNESS, "start_private_xvfb", side_effect=self.fake_xvfb), \
                        mock.patch.object(WITNESS, "stop_xvfb", return_value=(0, False)):
                    result = WITNESS.native_capture(
                        "m12-debugger", "build/cadr-oracle/m12-control-prepared", str(config),
                        str(runtime), str(disk), str(output.relative_to(ROOT)), "m12-control",
                        candidate_pause_resume=True,
                    )
            self.assertEqual(result["status"], "captured")
            metadata = result["metadata"]
            self.assertTrue(metadata["candidate_pause_resume"])
            self.assertEqual([item["action"] for item in metadata["actions"]], [
                "configure-candidate-pause", "launch", "observe", "configure-candidate-resume", "observe", "exit",
            ])
        finally:
            shutil.rmtree(output, ignore_errors=True)

    def test_m11_capture_stops_an_owned_process_group_after_the_required_witness(self) -> None:
        output_root = ROOT / "build" / "cadr-oracle"; output_root.mkdir(parents=True, exist_ok=True)
        output = Path(tempfile.mkdtemp(prefix="m11-group-test-", dir=output_root))
        try:
            with tempfile.TemporaryDirectory(prefix="cadr-native-runtime-") as temporary:
                runtime = Path(temporary); os.chmod(runtime, 0o700)
                config = runtime / "usim.ini"; disk = runtime / "disk.img"; executable = runtime / "prepared-usim"
                config.write_text("[usim]\nbeep_amplitude = 0.8\nuse_ascii_beep = false\n", encoding="utf-8"); disk.write_bytes(b"private disk bytes\n")
                executable.write_text(
                    "#!/bin/sh\n"
                    "printf '%s\\n' "
                    "'{\"schema\":\"CDRM11USIM1\",\"schema_version\":2}' "
                    "'{\"duration_us\":1,\"event\":\"beep-job\",\"event_sha256\":\"425f4a13f2cceabb8aa35b85b59efe234b30b1604e435d6b9173e7435cb8f130\",\"half_wavelength_us\":1,\"sequence\":0,\"wavelength_us\":2}' "
                    "'{\"event\":\"pcm-block\",\"frame_count\":1,\"pcm_s16le_sha256\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sample_bytes\":2,\"sample_rate\":8000,\"sequence\":1}' "
                    "> \"$CADR_M11_AUDIO_WITNESS\"\n"
                    "while :; do sleep 1; done\n", encoding="utf-8")
                os.chmod(executable, 0o700)
                marker = {"source_tree_sha256": "f" * 64, "repository_worktree_git": WITNESS.REPOSITORY_WORKTREE_GIT,
                          "patch": {"sha256": "0" * 64}}
                with mock.patch.object(WITNESS, "build_executable", return_value=(marker, executable)), \
                        mock.patch.object(WITNESS, "start_private_xvfb", side_effect=self.fake_xvfb), \
                        mock.patch.object(WITNESS, "stop_xvfb", return_value=(0, False)):
                    result = WITNESS.native_capture("m11-audio", "build/cadr-oracle/m11-group-prepared", str(config),
                                                    str(runtime), str(disk), str(output.relative_to(ROOT)), "m11-group")
            self.assertEqual(result["status"], "captured")
            self.assertIn({"action": "observe", "event": "beep-job"}, result["metadata"]["actions"])
            self.assertIn({"action": "observe", "event": "pcm-block"}, result["metadata"]["actions"])
            self.assertTrue(any(item.get("signal") == "SIGTERM" for item in result["metadata"]["actions"]))
            self.assertFalse(result["metadata"]["process"]["forced_stop"])
        finally:
            shutil.rmtree(output, ignore_errors=True)

    def test_witness_parser_rejects_pcm_before_job_and_unexplained_m12_control(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cadr-native-witness-shape-") as temporary:
            path = Path(temporary) / "witness.ndjson"
            path.write_text(
                '{"schema":"CDRM11USIM1","schema_version":2}\n'
                '{"event":"pcm-block","frame_count":1,"pcm_s16le_sha256":"' + "a" * 64 +
                '","sample_bytes":2,"sample_rate":8000,"sequence":0}\n'
                '{"duration_us":1,"event":"beep-job","event_sha256":"425f4a13f2cceabb8aa35b85b59efe234b30b1604e435d6b9173e7435cb8f130","half_wavelength_us":1,"sequence":1,"wavelength_us":2}\n',
                encoding="utf-8")
            os.chmod(path, 0o600)
            with self.assertRaises(WITNESS.WitnessError):
                WITNESS.witness_events("m11-audio", path)
            path.write_text(
                '{"schema":"CDRM12USIM1","schema_version":1}\n'
                '{"event":"candidate-loop","label":"QMLP","location_counter":0,"machine_cycles":0,"next_pc":0,"p0_pc":0,"p1_pc":116,"sequence":0}\n'
                '{"event":"candidate-pause-enter","label":"QMLP","location_counter":0,"machine_cycles":0,"next_pc":0,"p0_pc":0,"p1_pc":116,"sequence":1}\n'
                '{"event":"candidate-pause-resume","label":"QMLP","location_counter":0,"machine_cycles":0,"next_pc":0,"p0_pc":0,"p1_pc":116,"sequence":2}\n',
                encoding="utf-8")
            os.chmod(path, 0o600)
            with self.assertRaises(WITNESS.WitnessError):
                WITNESS.witness_events("m12-debugger", path)

    def test_m11_rejects_the_normal_silent_m6_audio_profile(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cadr-native-silent-config-") as temporary:
            config = Path(temporary) / "usim.ini"
            config.write_text("[usim]\nbeep_amplitude = 0\n", encoding="utf-8")
            with self.assertRaisesRegex(WITNESS.WitnessError, "normal silent M6 profile"):
                WITNESS.validate_audio_runtime_config(config)


if __name__ == "__main__":
    unittest.main()
