from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/cadr-m6-native-oracle.py"
SPEC = importlib.util.spec_from_file_location("cadr_m6_native_oracle_tests", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
oracle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(oracle)


class CadrM6NativeOracleTests(unittest.TestCase):
    def fixture(self, root: Path) -> Path:
        runtime = root / "runtime"
        runtime.mkdir()
        for name, payload in (("usim.state", b"state"), ("usim.ini", b"config"),
                              ("disk.img", b"disk")):
            (runtime / name).write_bytes(payload)
        (root / "run.json").write_text(json.dumps({
            "status": "stopped", "resumed": False, "session": "fixture", "generation": 1,
            "load_band": "System 303-0", "runtime": {
                "state": str(runtime / "usim.state"), "config": str(runtime / "usim.ini"),
            }, "session_disk": str(runtime / "disk.img"),
            "usim_sha256_at_start": "u-start", "usim_sha256_at_exec": "u-exec",
            "base_disk_sha256": "base", "session_disk_sha256_at_start": "private",
            "forced_stop": False, "state_may_be_incomplete": False,
        }), encoding="utf-8")
        return root

    def test_blocked_report_is_identity_bound_and_never_claims_listener_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = self.fixture(Path(temporary))
            output = root / "report.json"
            report = oracle.record(root, output)
            self.assertEqual(report["status"], "blocked")
            self.assertIsNone(report["semantic_conjunction"]["first_satisfaction_boundary"])
            self.assertIsNone(report["semantic_conjunction"]["quiescent_suffix"])
            self.assertEqual(report["inputs"]["saved_state_after_stop"]["sha256"],
                             hashlib.sha256(b"state").hexdigest())
            self.assertEqual(json.loads(output.read_text())["blockers"], report["blockers"])

    def test_rejects_resumed_or_non_stopped_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = self.fixture(Path(temporary))
            run = json.loads((root / "run.json").read_text())
            run["resumed"] = True
            (root / "run.json").write_text(json.dumps(run), encoding="utf-8")
            with self.assertRaisesRegex(oracle.ProbeError, "non-resumed"):
                oracle.record(root, root / "report.json")

    def test_profile_inputs_keep_native_hosts_out_of_portable_artifact_kinds(self) -> None:
        profile = oracle.read_json(oracle.PROFILE)
        paths = [
            ROOT / "l/sys/ubin/promh.mcr",
            ROOT / "l/sys/ubin/promh.sym",
            ROOT / "l/sys/ubin/ucadr.sym",
            ROOT / "l/usite/extra.hosts",
        ]
        artifact_records, native_inputs = oracle.profile_inputs(
            profile, paths, ROOT / "l/usim/disk-sys-303-0.img")
        self.assertEqual([item["kind"] for item in artifact_records], [1, 2, 4, 5, 3])
        self.assertEqual(artifact_records, [
            {"kind": 1, "byte_count": "854",
             "sha256": "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f"},
            {"kind": 2, "byte_count": "20480",
             "sha256": "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6"},
            {"kind": 4, "byte_count": "3130",
             "sha256": "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d"},
            {"kind": 5, "byte_count": "83270",
             "sha256": "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a"},
            {"kind": 3, "byte_count": "269562880",
             "sha256": "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"},
        ])
        self.assertEqual(native_inputs, [{
            "id": "usite-extra-hosts", "byte_count": "262",
            "sha256": "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
        }])

    def test_private_config_uses_only_private_template_artifacts_and_disk(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary)
            template = runtime / "inputs/cadr-web-303.ini.in"
            template.parent.mkdir()
            template.write_bytes((ROOT / "cadr-web/profiles/cadr-web-303.ini.in").read_bytes())
            fs_root = runtime / "fs-root"
            disk = runtime / "disk-sys-303-0.img"
            disk.write_bytes(b"private-disk")
            rendered = runtime / "usim.ini"
            oracle.render_private_config(template, fs_root, disk, runtime, rendered)
            oracle.assert_private_execution_config(rendered, fs_root, disk, runtime)
            text = rendered.read_text(encoding="utf-8")
            self.assertNotIn("@", text)
            self.assertNotIn(str(ROOT / "l"), text)

    def test_copy_verified_rejects_wrong_or_changed_private_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"; source.write_bytes(b"canonical")
            expected = {"byte_count": "9", "sha256": hashlib.sha256(b"canonical").hexdigest()}
            private = oracle.copy_verified(source, root / "private", expected, "fixture")
            self.assertEqual(private.read_bytes(), b"canonical")
            wrong = {"byte_count": "9", "sha256": "00" * 32}
            with self.assertRaisesRegex(oracle.ProbeError, "differs"):
                oracle.copy_verified(source, root / "wrong", wrong, "fixture")

    def test_native_execution_uses_a_private_verified_executable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "prepared-usim"
            source.write_bytes(b"native executable")
            source.chmod(0o755)
            runtime = root / "runtime"; runtime.mkdir()
            private = oracle.copy_private_executable(
                source, runtime, hashlib.sha256(b"native executable").hexdigest())
            config = runtime / "usim.ini"; config.write_text("[usim]\n", encoding="utf-8")
            self.assertEqual(private.parent, runtime)
            self.assertTrue(private.stat().st_mode & 0o111)
            environment = oracle.native_execution_environment(
                runtime / "schedule.txt", runtime / "capture.ndjson",
                runtime / "idle.bin", "private-session")
            with mock.patch.object(oracle.subprocess, "run",
                                   return_value=subprocess.CompletedProcess([], 0)) as run:
                completed = oracle.execute_private_m6(runtime, private, config, environment)
            self.assertEqual(completed.returncode, 0)
            self.assertEqual(run.call_args.args[0][0], str(private))
            self.assertNotEqual(run.call_args.args[0][0], str(source))
            self.assertEqual(run.call_args.kwargs["env"], environment)

    def test_minimal_native_environment_is_exact_and_ignores_hostile_parent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime = Path(temporary)
            with mock.patch.dict(oracle.os.environ, {
                "PATH": "/hostile/path", "LD_PRELOAD": "hostile.so",
                "GLIBC_TUNABLES": "hostile", "GCONV_PATH": "/hostile/gconv",
                "LOCPATH": "/hostile/locale", "MALLOC_CHECK_": "3",
            }, clear=False):
                environment = oracle.native_execution_environment(
                    runtime / "schedule.txt", runtime / "capture.ndjson",
                    runtime / "idle.bin", "private-session")
            self.assertEqual(environment, {
                "LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                "CADR_M6_RAW_SCHEDULE": str(runtime / "schedule.txt"),
                "CADR_M6_NATIVE_LOG": str(runtime / "capture.ndjson"),
                "CADR_M6_IDLE_SAMPLES": str(runtime / "idle.bin"),
                "CADR_M6_SESSION_ID": "private-session",
            })
            self.assertEqual(oracle.EXECUTION_ENVIRONMENT, {
                "policy_id": "cadr-m6-native-minimal-environment-v1", "inherited": False,
                "variables": {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"},
            })

    def test_native_conjunction_requires_every_read_only_fact(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fixture = root / "fixture.c"
            executable = root / "fixture"
            fixture.write_text(
                "#include <stdio.h>\n"
                "#include \"cadr_m6_listener_probe.h\"\n"
                "int main(void) {\n"
                "  struct cadr_m6_listener_snapshot s = {\n"
                "    2, 01234, 01234, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1\n"
                "  };\n"
                "  unsigned int ready = cadr_m6_listener_probe(&s);\n"
                "  unsigned int blocked = cadr_m6_listener_probe(0);\n"
                "  unsigned int failures = 0;\n"
                "#define REQUIRE_NOT_READY(field) do { \\\n"
                "  s.field = 0; \\\n"
                "  if (cadr_m6_listener_probe(&s) != CADR_M6_LISTENER_PROBE_NOT_READY) failures++; \\\n"
                "  s.field = 1; \\\n"
                "} while (0)\n"
                "  s.selected_window_identity = 0777;\n"
                "  if (cadr_m6_listener_probe(&s) != CADR_M6_LISTENER_PROBE_NOT_READY) failures++;\n"
                "  s.selected_window_identity = s.initial_listener_identity;\n"
                "  REQUIRE_NOT_READY(initial_listener_is_lisp_listener);\n"
                "  REQUIRE_NOT_READY(initial_listener_is_exposed);\n"
                "  REQUIRE_NOT_READY(listener_lisp_listener_p_is_idle);\n"
                "  REQUIRE_NOT_READY(listener_owner_process_live);\n"
                "  REQUIRE_NOT_READY(listener_owner_stack_group_live);\n"
                "  REQUIRE_NOT_READY(listener_stack_at_read_for_top_level);\n"
                "  REQUIRE_NOT_READY(listener_input_buffer_empty);\n"
                "  REQUIRE_NOT_READY(listener_has_no_partial_form);\n"
                "  REQUIRE_NOT_READY(boot_prompt_phase_accepted);\n"
                "  s.disk_busy = 1;\n"
                "  if (cadr_m6_listener_probe(&s) != CADR_M6_LISTENER_PROBE_NOT_READY) failures++;\n"
                "  s.disk_busy = 0; s.host_request_pending = 1;\n"
                "  if (cadr_m6_listener_probe(&s) != CADR_M6_LISTENER_PROBE_NOT_READY) failures++;\n"
                "  s.host_request_pending = 0;\n"
                "  REQUIRE_NOT_READY(oracle_quiescent_suffix_confirmed);\n"
                "  printf(\"%u %u %u\\n\", ready, blocked, failures);\n"
                "  return failures == 0 ? 0 : 1;\n"
                "}\n",
                encoding="ascii",
            )
            completed = subprocess.run([
                "cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic",
                "-I", str(ROOT / "cadr-web/oracle/native"), "-o", str(executable), str(fixture),
                str(ROOT / "cadr-web/oracle/native/cadr_m6_listener_probe.c"),
            ], text=True, capture_output=True, check=False)
            self.assertEqual(completed.returncode, 0, completed.stderr)
            observed = subprocess.run([str(executable)], text=True, capture_output=True, check=False)
            self.assertEqual(observed.returncode, 0, observed.stderr)
            self.assertEqual(observed.stdout, "1 3 0\n")


if __name__ == "__main__":
    unittest.main()
