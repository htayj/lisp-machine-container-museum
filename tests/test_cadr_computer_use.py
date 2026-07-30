from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import unittest
from unittest import mock


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "cadr-computer-use.py"


def load_script():
    module_name = "cadr_computer_use_for_tests"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


cadr = load_script()


class NameAndPathValidationTests(unittest.TestCase):
    def test_session_names_accept_only_bounded_portable_components(self) -> None:
        for name in ("default", "museum-1", "CADR_303.0", "a" * 64):
            with self.subTest(name=name):
                self.assertEqual(cadr.validate_session_name(name), name)

        for name in (
            "",
            ".",
            "..",
            ".hidden",
            "-option",
            "has/slash",
            "has space",
            "caf\N{LATIN SMALL LETTER E WITH ACUTE}",
            "a" * 65,
        ):
            with self.subTest(name=name):
                with self.assertRaises(cadr.HarnessError):
                    cadr.validate_session_name(name)

    def test_screenshot_labels_have_their_own_bound(self) -> None:
        for label in ("screen", "after-help_1", "x" * 48):
            with self.subTest(label=label):
                self.assertEqual(cadr.validate_label(label), label)

        for label in ("", ".", "..", "bad/label", "bad label", "x" * 49):
            with self.subTest(label=label):
                with self.assertRaises(cadr.HarnessError):
                    cadr.validate_label(label)

    def test_state_root_and_session_paths_are_normalized_and_confined(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temporary_path = Path(temporary)
            root = temporary_path / "state" / ".." / "state"
            expected_root = root.resolve()

            self.assertEqual(cadr.state_root_from(str(root)), expected_root)
            with mock.patch.dict(os.environ, {"CADR_COMPUTER_USE_ROOT": str(root)}):
                self.assertEqual(cadr.state_root_from(None), expected_root)
            self.assertEqual(
                cadr.session_dir_for(expected_root, "museum"),
                expected_root / "museum",
            )

            expected_root.mkdir(parents=True)
            outside = temporary_path / "outside"
            outside.mkdir()
            (expected_root / "escape").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(cadr.HarnessError, "escapes"):
                cadr.session_dir_for(expected_root, "escape")


class IsolationAndStateTests(unittest.TestCase):
    def test_rendered_config_uses_only_private_mutable_runtime_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            runtime = base / "private-session" / "runtime"
            originals = base / "read-only-originals"
            paths = {
                "prommcr": originals / "promh.mcr",
                "promsym": originals / "promh.sym",
                "mcrsym": originals / "ucadr.sym",
                "disk": originals / "disk-sys-303-0.img",
                "hosts": originals / "extra.hosts",
                "sys": originals / "sys",
                "usite": originals / "usite",
                "chaos": originals / "chaos",
            }

            config = cadr.render_config(paths, runtime)

            self.assertIn(f"fs_root_directory = {runtime / 'fs-root'}", config)
            self.assertIn(f"state_filename = {runtime / 'usim.state'}", config)
            self.assertIn(
                f"screenshot_filename = {runtime / 'final-framebuffer.pbm'}",
                config,
            )
            self.assertIn(
                f"hosts = {runtime / 'fs-root' / 'usite' / 'extra.hosts'}",
                config,
            )
            self.assertIn(
                f"disk0 = T-300,{runtime / 'disk-sys-303-0.img'}",
                config,
            )
            for key in ("disk", "hosts", "sys", "usite", "chaos", "prommcr", "promsym", "mcrsym"):
                self.assertNotIn(str(paths[key]), config)
            self.assertIn(
                f"prommcr_filename = {runtime / 'fs-root' / 'sys' / 'ubin' / 'promh.mcr'}",
                config,
            )
            self.assertIn(
                f"promsym_filename = {runtime / 'fs-root' / 'sys' / 'ubin' / 'promh.sym'}",
                config,
            )
            self.assertIn(
                f"mcrsym_filename = {runtime / 'fs-root' / 'sys' / 'ubin' / 'ucadr.sym'}",
                config,
            )

    def test_m11_rendered_config_enables_only_the_required_pcm_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            runtime = base / "runtime"
            paths = {
                "prommcr": base / "promh.mcr",
                "promsym": base / "promh.sym",
                "mcrsym": base / "ucadr.sym",
                "disk": base / "disk.img",
                "hosts": base / "hosts",
                "sys": base / "sys",
                "usite": base / "usite",
                "chaos": base / "chaos",
            }
            normal = cadr.render_config(paths, runtime)
            m11 = cadr.render_config(paths, runtime, m11_audio_witness=True)

            self.assertIn("beep_amplitude = 0\n", normal)
            self.assertNotIn("use_ascii_beep", normal)
            self.assertIn("beep_amplitude = 0.8\nuse_ascii_beep = false\n", m11)
            self.assertNotIn("beep_amplitude = 0\n", m11)

    def test_m11_plan_is_non_live_and_names_the_exact_source_backed_input(self) -> None:
        closure = {
            "prepared": "build/cadr-oracle/m11-audio-cm11-v3",
            "repository_worktree_git": "a" * 40,
            "source_tree_sha256": "b" * 64,
            "patch_sha256": "c" * 64,
            "executable": {"path": "/tmp/checked-usim", "bytes": 1, "sha256": "d" * 64},
            "witness_schema": "CDRM11USIM1",
            "witness_schema_version": 2,
        }
        source_form = {"form": cadr.M11_AUDIO_TRIGGER_FORM, "literal_arguments": {}, "si_package_spelling": {}}
        output = io.StringIO()
        args = cadr.argparse.Namespace(prepared=closure["prepared"], session="m11-plan")
        with (
            mock.patch.object(cadr, "m11_audio_closure", return_value=closure) as checked,
            mock.patch.object(cadr, "m11_audio_source_form", return_value=source_form),
            mock.patch.object(cadr.subprocess, "Popen") as popen,
            contextlib.redirect_stdout(output),
        ):
            self.assertEqual(cadr.command_m11_audio_plan(args, Path("/unused")), 0)

        payload = json.loads(output.getvalue())
        checked.assert_called_once_with(closure["prepared"])
        popen.assert_not_called()
        self.assertEqual(payload["status"], "planned")
        self.assertEqual(payload["source_form"]["form"], "(SI:%BEEP 500. 100000.)")
        self.assertTrue(payload["start_requirements"]["fresh_private_runtime"])
        self.assertIn("MIT-SHM", payload["start_requirements"]["xvfb"])

    def test_m11_action_ledger_is_private_and_ordered(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            runtime = session / "runtime"
            runtime.mkdir(parents=True)
            runtime.chmod(0o700)
            state = {
                "session_dir": str(session),
                "m11_audio_witness": {
                    "schema": cadr.M11_AUDIO_WITNESS_SCHEMA,
                    "action_ledger_path": str(runtime / "m11-audio-actions.ndjson"),
                    "witness_path": str(runtime / "m11-audio-witness.ndjson"),
                },
            }
            first = cadr.append_m11_audio_action(state, {"record": "intent", "intent_id": "one"})
            second = cadr.append_m11_audio_action(state, {"record": "outcome", "intent_id": "one"})
            ledger = runtime / "m11-audio-actions.ndjson"

            self.assertEqual(stat.S_IMODE(ledger.stat().st_mode), 0o600)
            self.assertNotEqual(first["sha256"], second["sha256"])
            lines = [json.loads(line) for line in ledger.read_text(encoding="ascii").splitlines()]
            self.assertEqual(lines[0], {"schema": cadr.M11_AUDIO_WITNESS_SCHEMA, "ledger": "intent-outcome-v1"})
            self.assertEqual([line["record"] for line in lines[1:]], ["intent", "outcome"])

    def test_m11_environment_scrubs_host_witness_and_uses_only_session_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            runtime = session / "runtime"
            runtime.mkdir(parents=True)
            runtime.chmod(0o700)
            witness = runtime / "m11-audio-witness.ndjson"
            state = {
                "session_dir": str(session),
                "display": ":111",
                "xauthority": str(runtime / "Xauthority"),
                "m11_audio_witness": {
                    "schema": cadr.M11_AUDIO_WITNESS_SCHEMA,
                    "witness_path": str(witness),
                    "action_ledger_path": str(runtime / "m11-audio-actions.ndjson"),
                },
                "m8_m9_x11_witness": None,
            }
            with mock.patch.dict(os.environ, {cadr.M11_AUDIO_WITNESS_ENVIRONMENT: "/tmp/host-path"}, clear=False):
                environment = cadr.x_environment(state)

            self.assertEqual(environment[cadr.M11_AUDIO_WITNESS_ENVIRONMENT], str(witness))
            self.assertNotEqual(environment[cadr.M11_AUDIO_WITNESS_ENVIRONMENT], "/tmp/host-path")

    def test_process_record_and_identity_include_start_ticks(self) -> None:
        with (
            mock.patch.object(cadr, "proc_start_ticks", return_value=81723),
            mock.patch.object(cadr, "proc_cmdline", return_value="usim -c private.ini"),
        ):
            self.assertEqual(
                cadr.process_record(4321),
                {
                    "pid": 4321,
                    "start_ticks": 81723,
                    "cmdline": "usim -c private.ini",
                },
            )

        with mock.patch.object(cadr, "proc_start_ticks", return_value=None):
            with self.assertRaisesRegex(cadr.HarnessError, "disappeared"):
                cadr.process_record(4321)

    def test_process_match_requires_boot_pid_and_start_tick_identity(self) -> None:
        record = {"pid": 4321, "start_ticks": 81723, "cmdline": "old command"}
        with (
            mock.patch.object(cadr, "boot_id", return_value="boot-a"),
            mock.patch.object(cadr, "proc_start_ticks", return_value=81723) as ticks,
        ):
            self.assertTrue(cadr.process_matches(record, "boot-a"))
            self.assertFalse(cadr.process_matches(record, "boot-b"))
            self.assertEqual(ticks.call_count, 1, "boot mismatch must not inspect or signal a reused PID")

        with (
            mock.patch.object(cadr, "boot_id", return_value="boot-a"),
            mock.patch.object(cadr, "proc_start_ticks", return_value=99999),
        ):
            self.assertFalse(cadr.process_matches(record, "boot-a"))

        malformed_records = (None, {}, {"pid": "nope", "start_ticks": 1}, {"pid": 1})
        with mock.patch.object(cadr, "boot_id", return_value="boot-a"):
            for malformed in malformed_records:
                with self.subTest(record=malformed):
                    self.assertFalse(cadr.process_matches(malformed, "boot-a"))

    def test_proc_stat_parser_uses_linux_start_time_field(self) -> None:
        # The command name may itself contain spaces and right parentheses.  The
        # fields after its final ')' begin at Linux proc(5) field three.
        fields_three_through_twenty_two = ["S", *("0" for _ in range(18)), "24680"]
        proc_stat = "77 (usim worker) name) " + " ".join(fields_three_through_twenty_two)
        with mock.patch.object(cadr.Path, "read_text", return_value=proc_stat):
            self.assertEqual(cadr.proc_start_ticks(77), 24680)

        with mock.patch.object(cadr.Path, "read_text", return_value="77 malformed"):
            self.assertIsNone(cadr.proc_start_ticks(77))

    def test_atomic_json_replaces_complete_sorted_private_file(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "nested" / "run.json"
            destination.parent.mkdir()
            destination.write_text("old contents\n", encoding="utf-8")
            real_replace = os.replace
            with mock.patch.object(cadr.os, "replace", wraps=real_replace) as replace:
                cadr.atomic_write_json(destination, {"z": [3, 2, 1], "a": 1})

            self.assertEqual(
                destination.read_text(encoding="utf-8"),
                '{\n  "a": 1,\n  "z": [\n    3,\n    2,\n    1\n  ]\n}\n',
            )
            self.assertEqual(json.loads(destination.read_text()), {"a": 1, "z": [3, 2, 1]})
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o600)
            self.assertEqual(replace.call_count, 1)
            source, target = replace.call_args.args
            self.assertEqual(target, destination)
            self.assertNotEqual(source, destination)
            self.assertEqual(list(destination.parent.glob(".*.tmp")), [])

    def test_tree_hash_detects_file_content_and_symlink_target_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            tree = Path(temporary) / "tree"
            tree.mkdir()
            payload = tree / "payload"
            payload.write_bytes(b"original contents")
            (tree / "target-a").write_bytes(b"same target contents")
            (tree / "target-b").write_bytes(b"same target contents")
            link = tree / "current"
            link.symlink_to("target-a")

            baseline = cadr.sha256_tree(tree)
            self.assertEqual(cadr.sha256_tree(tree), baseline)

            payload.write_bytes(b"changed contents")
            self.assertNotEqual(cadr.sha256_tree(tree), baseline)
            payload.write_bytes(b"original contents")
            self.assertEqual(cadr.sha256_tree(tree), baseline)

            link.unlink()
            link.symlink_to("target-b")
            self.assertNotEqual(
                cadr.sha256_tree(tree),
                baseline,
                "the link target is provenance even when both targets have identical bytes",
            )

    def test_toolchain_provenance_records_resolved_commands_guix_and_manifest(self) -> None:
        commands = {
            "Xvfb": "/opt/fake/bin/Xvfb",
            "xauth": "/opt/fake/bin/xauth",
            "xdotool": "/opt/fake/bin/xdotool",
            "import": "/opt/fake/bin/import",
            "identify": None,
            "convert": "/opt/fake/bin/convert",
            "make": "/opt/fake/bin/make",
            "cp": "/opt/fake/bin/cp",
            "flock": "/opt/fake/bin/flock",
            "guix": "/opt/fake/bin/guix",
        }
        channels = [
            {
                "name": "guix",
                "url": "https://example.invalid/guix.git",
                "commit": "a" * 40,
            }
        ]
        completed = cadr.subprocess.CompletedProcess(
            args=[commands["guix"], "describe", "--format=json"],
            returncode=0,
            stdout=json.dumps(channels),
            stderr="",
        )
        with (
            mock.patch.object(cadr, "command_paths", return_value=commands),
            mock.patch.object(cadr, "sha256_file", return_value="f" * 64) as sha256,
            mock.patch.object(cadr, "run", return_value=completed) as run,
        ):
            provenance = cadr.toolchain_provenance()

        self.assertEqual(
            set(provenance),
            {
                "python_version",
                "python_executable",
                "manifest_sha256",
                "guix_channels",
                "guix_error",
                "commands",
            },
        )
        self.assertEqual(provenance["python_version"], sys.version.split()[0])
        self.assertEqual(provenance["python_executable"], str(Path(sys.executable).resolve()))
        self.assertEqual(provenance["manifest_sha256"], "f" * 64)
        self.assertEqual(provenance["guix_channels"], channels)
        self.assertIsNone(provenance["guix_error"])
        self.assertEqual(
            provenance["commands"],
            {
                name: str(Path(path).resolve()) if path else None
                for name, path in commands.items()
            },
        )
        sha256.assert_called_once_with(cadr.ROOT / "manifest.scm")
        run.assert_called_once_with(
            [commands["guix"], "describe", "--format=json"],
            check=False,
            timeout=30,
        )

    def test_fresh_prepare_refuses_unmarked_existing_runtime_before_deletion(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            runtime = session / "runtime"
            runtime.mkdir(parents=True)
            unrelated = runtime / "unrelated-data"
            unrelated.write_text("must survive", encoding="utf-8")

            with (
                mock.patch.object(cadr, "source_revisions", return_value={}),
                mock.patch.object(cadr, "copy_reflink") as copy,
                mock.patch.object(cadr, "remove_tree", wraps=cadr.remove_tree) as remove,
            ):
                with self.assertRaisesRegex(cadr.HarnessError, "missing private-runtime marker"):
                    cadr.prepare_session(session, {}, fresh=True)

            copy.assert_not_called()
            remove.assert_not_called()
            self.assertEqual(unrelated.read_text(encoding="utf-8"), "must survive")


class FilesystemSafetyTests(unittest.TestCase):
    def test_existing_unowned_roots_and_sessions_are_not_adopted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)

            unowned_root = base / "unowned-root"
            unowned_root.mkdir()
            root_keep = unowned_root / "do-not-delete"
            root_keep.write_text("unrelated data", encoding="utf-8")
            with self.assertRaisesRegex(cadr.HarnessError, "refusing to adopt"):
                cadr.ensure_state_root(unowned_root)
            self.assertEqual(root_keep.read_text(encoding="utf-8"), "unrelated data")
            self.assertFalse((unowned_root / cadr.STATE_ROOT_MARKER).exists())

            wrong_root = base / "wrong-root"
            wrong_root.mkdir()
            (wrong_root / cadr.STATE_ROOT_MARKER).write_text("some other tool\n", encoding="ascii")
            wrong_root_keep = wrong_root / "keep"
            wrong_root_keep.write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(cadr.HarnessError, "unrecognized"):
                cadr.ensure_state_root(wrong_root)
            self.assertEqual(wrong_root_keep.read_text(encoding="utf-8"), "preserve")

            owned_root = base / "owned-root"
            cadr.ensure_state_root(owned_root)
            unowned_session = owned_root / "unowned-session"
            unowned_session.mkdir()
            session_keep = unowned_session / "also-do-not-delete"
            session_keep.write_text("unrelated session data", encoding="utf-8")
            with self.assertRaisesRegex(cadr.HarnessError, "unowned session"):
                cadr.ensure_session_directory(unowned_session)
            self.assertEqual(
                session_keep.read_text(encoding="utf-8"),
                "unrelated session data",
            )
            self.assertFalse((unowned_session / cadr.SESSION_MARKER).exists())

            wrong_session = owned_root / "wrong-session"
            wrong_session.mkdir()
            (wrong_session / cadr.SESSION_MARKER).write_text("foreign session\n", encoding="ascii")
            wrong_session_keep = wrong_session / "keep"
            wrong_session_keep.write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(cadr.HarnessError, "unrecognized"):
                cadr.ensure_session_directory(wrong_session)
            self.assertEqual(wrong_session_keep.read_text(encoding="utf-8"), "preserve")

    def test_new_root_and_session_are_marked_as_harness_owned(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "new" / "state"
            cadr.ensure_state_root(root)

            root_marker = root / cadr.STATE_ROOT_MARKER
            self.assertEqual(
                root_marker.read_text(encoding="ascii"),
                cadr.STATE_ROOT_MARKER_CONTENT,
            )
            self.assertEqual(stat.S_IMODE(root.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(root_marker.stat().st_mode), 0o600)

            session = root / "museum"
            cadr.ensure_session_directory(session)
            session_marker = session / cadr.SESSION_MARKER
            self.assertEqual(
                session_marker.read_text(encoding="ascii"),
                cadr.SESSION_MARKER_CONTENT,
            )
            self.assertEqual(stat.S_IMODE(session.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(session_marker.stat().st_mode), 0o600)
            self.assertIsNone(cadr.require_session_directory(session))

            # Both ownership checks are deliberately idempotent.
            self.assertIsNone(cadr.ensure_state_root(root))
            self.assertIsNone(cadr.ensure_session_directory(session))

    def test_lock_body_oserror_is_not_reclassified_as_lock_failure(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            lock = Path(temporary) / "locks" / "control.lock"
            with self.assertRaisesRegex(OSError, "body failed") as raised:
                with cadr.locked(lock):
                    raise OSError("body failed")

            self.assertNotIsInstance(raised.exception, cadr.HarnessError)
            self.assertTrue(lock.is_file())

    def test_remove_tree_removes_only_real_descendants(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            parent = base / "sessions"
            target = parent / "one"
            target.mkdir(parents=True)
            (target / "state").write_text("private", encoding="utf-8")

            cadr.remove_tree(target, parent)
            self.assertFalse(target.exists())

            outside = base / "outside"
            outside.mkdir()
            (outside / "keep").write_text("preserve", encoding="utf-8")
            with self.assertRaisesRegex(cadr.HarnessError, "outside"):
                cadr.remove_tree(outside, parent)
            self.assertTrue((outside / "keep").is_file())

    def test_remove_tree_and_directory_setup_refuse_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            parent = base / "sessions"
            parent.mkdir()
            outside = base / "outside"
            outside.mkdir()
            (outside / "keep").write_text("preserve", encoding="utf-8")
            linked_session = parent / "linked"
            linked_session.symlink_to(outside, target_is_directory=True)

            with self.assertRaisesRegex(cadr.HarnessError, "symbolic link"):
                cadr.remove_tree(linked_session, parent)
            with self.assertRaisesRegex(cadr.HarnessError, "symbolic link"):
                cadr.ensure_session_directory(linked_session)
            self.assertTrue(linked_session.is_symlink())
            self.assertTrue((outside / "keep").is_file())

            symlinked_root = base / "root-link"
            symlinked_root.symlink_to(parent, target_is_directory=True)
            with self.assertRaisesRegex(cadr.HarnessError, "state root"):
                cadr.ensure_session_directory(symlinked_root / "new-session")
            self.assertFalse((parent / "new-session").exists())


class ScreenshotAndShutdownTests(unittest.TestCase):
    def test_screenshot_sequence_has_arbitrary_width_after_9999(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            screenshots = session / "screenshots"
            screenshots.mkdir(parents=True)
            for name in (
                "0001-first.png",
                "9999-last-four-digit.png",
                "not-a-sequence.png",
                "20000.png",
            ):
                (screenshots / name).touch()

            ten_thousand = cadr.next_screenshot_path(session, "continued")
            self.assertEqual(ten_thousand.name, "10000-continued.png")
            ten_thousand.touch()
            self.assertEqual(
                cadr.next_screenshot_path(session, "continued-again").name,
                "10001-continued-again.png",
            )

    def test_terminate_process_distinguishes_graceful_and_forced_shutdown(self) -> None:
        self.assertEqual(cadr.terminate_process(None, 2), (None, False))

        already_stopped = mock.Mock(name="already-stopped-popen")
        already_stopped.poll.return_value = 7
        already_stopped.returncode = 7
        self.assertEqual(cadr.terminate_process(already_stopped, 2), (7, False))
        already_stopped.terminate.assert_not_called()
        already_stopped.kill.assert_not_called()
        already_stopped.wait.assert_not_called()

        graceful = mock.Mock(name="graceful-popen")
        graceful.poll.return_value = None
        graceful.returncode = 0
        graceful.wait.return_value = 0
        self.assertEqual(cadr.terminate_process(graceful, 2), (0, False))
        graceful.terminate.assert_called_once_with()
        graceful.wait.assert_called_once_with(timeout=2)
        graceful.kill.assert_not_called()

        forced = mock.Mock(name="forced-popen")
        forced.poll.return_value = None
        forced.returncode = -9
        forced.wait.side_effect = (
            cadr.subprocess.TimeoutExpired(cmd="usim", timeout=2),
            -9,
        )
        self.assertEqual(cadr.terminate_process(forced, 2), (-9, True))
        forced.terminate.assert_called_once_with()
        forced.kill.assert_called_once_with()
        self.assertEqual(
            forced.wait.call_args_list,
            [mock.call(timeout=2), mock.call(timeout=5)],
        )

    def test_supervisor_checks_usim_under_runtime_lock_before_exec(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            session = Path(temporary) / "session"
            session.mkdir()
            runtime_dir = session / "runtime"
            runtime_dir.mkdir()
            usim = runtime_dir / "usim"
            config = runtime_dir / "usim.ini"
            saved_state = runtime_dir / "usim.state"
            initial = {
                "schema": cadr.STATE_SCHEMA,
                "session": session.name,
                "session_dir": str(session),
                "generation": 3,
                "status": "starting",
                "usim_sha256_at_start": "prepared-hash",
                "runtime": {
                    "usim": str(usim),
                    "config": str(config),
                    "state": str(saved_state),
                },
            }
            state = dict(initial)
            updates: list[dict[str, object]] = []
            xvfb = mock.Mock(name="xvfb-popen")
            xvfb.pid = 2468
            lock_active = False
            locks: list[Path] = []

            @contextlib.contextmanager
            def fake_locked(path: Path, **_kwargs):
                nonlocal lock_active
                locks.append(path)
                self.assertFalse(lock_active)
                lock_active = True
                try:
                    yield
                finally:
                    lock_active = False

            def fake_sha256(path: Path) -> str:
                self.assertTrue(lock_active, "the shared executable must be hashed while rebuilds are locked")
                self.assertEqual(path, usim)
                return "changed-after-prepare"

            def fake_update(_session: Path, changes: dict[str, object]):
                updates.append(dict(changes))
                state.update(changes)
                return dict(state)

            def fake_terminate(process, timeout: float):
                if process is None:
                    self.assertEqual(timeout, 25)
                    return None, False
                self.assertIs(process, xvfb)
                self.assertEqual(timeout, 5)
                return 0, False

            environment = {
                "XDG_RUNTIME_DIR": str(runtime_dir / "xdg-runtime"),
                "HOME": str(runtime_dir / "home"),
            }
            with (
                mock.patch.object(cadr.signal, "signal") as signal_handler,
                mock.patch.object(cadr, "wait_for_own_record", return_value=dict(initial)),
                mock.patch.object(
                    cadr,
                    "start_xvfb",
                    return_value=(xvfb, ":99", runtime_dir / "Xauthority"),
                ),
                mock.patch.object(cadr, "process_record", return_value={"pid": 2468, "start_ticks": 10}),
                mock.patch.object(cadr, "update_state", side_effect=fake_update),
                mock.patch.object(cadr, "read_state", side_effect=lambda *_args, **_kwargs: dict(state)),
                mock.patch.object(cadr, "x_environment", return_value=environment),
                mock.patch.object(cadr, "locked", side_effect=fake_locked),
                mock.patch.object(cadr, "sha256_file", side_effect=fake_sha256) as sha256,
                mock.patch.object(cadr, "terminate_process", side_effect=fake_terminate) as terminate,
                mock.patch.object(cadr.subprocess, "Popen") as popen,
            ):
                self.assertEqual(cadr.supervise(session, resume=False), 1)

            self.assertEqual(signal_handler.call_count, 2)
            self.assertEqual(locks, [cadr.RUNTIME_PREPARE_LOCK])
            sha256.assert_called_once_with(usim)
            popen.assert_not_called()
            self.assertEqual(terminate.call_count, 2)
            self.assertEqual([update["status"] for update in updates], ["xvfb-ready", "failed"])
            failed = updates[-1]
            self.assertIn("shared usim changed after session preparation", failed["error"])
            self.assertFalse(failed["forced_stop"])
            self.assertFalse(failed["state_may_be_incomplete"])
            self.assertIsNone(failed["usim_exit_status"])
            self.assertEqual(failed["xvfb_exit_status"], 0)


class InputValidationTests(unittest.TestCase):
    def test_m11_trigger_types_only_the_fixed_form_and_records_joined_witness(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "state"
            cadr.ensure_state_root(root)
            session = root / "m11-trigger"
            cadr.ensure_session_directory(session)
            runtime = session / "runtime"
            runtime.mkdir()
            runtime.chmod(0o700)
            state = {
                "schema": cadr.STATE_SCHEMA,
                "session": "m11-trigger",
                "session_dir": str(session),
                "generation": 4,
                "m11_audio_witness": {
                    "schema": cadr.M11_AUDIO_WITNESS_SCHEMA,
                    "witness_path": str(runtime / "m11-audio-witness.ndjson"),
                    "action_ledger_path": str(runtime / "m11-audio-actions.ndjson"),
                    "trigger": {"form": cadr.M11_AUDIO_TRIGGER_FORM},
                },
            }
            args = cadr.argparse.Namespace(
                session="m11-trigger",
                listener_ready_screenshot=str(session / "screenshots" / "listener.png"),
                delay_ms=17,
                timeout=3.0,
            )
            xdotool_calls: list[list[str]] = []
            screenshots = iter((
                {"path": "before.png", "png_sha256": "a" * 64},
                {"path": "after.png", "png_sha256": "b" * 64},
            ))
            witness = {"path": str(runtime / "m11-audio-witness.ndjson"), "bytes": 80, "sha256": "c" * 64}
            with (
                mock.patch.object(cadr, "require_running", return_value=state),
                mock.patch.object(cadr, "listener_ready_screenshot", return_value={"image": {}, "sidecar": {}}),
                mock.patch.object(cadr, "take_screenshot", side_effect=lambda *_args: next(screenshots)),
                mock.patch.object(cadr, "focus_window") as focus,
                mock.patch.object(cadr, "xdotool", side_effect=lambda _state, argv: xdotool_calls.append(list(argv))),
                mock.patch.object(cadr, "wait_for_m11_audio_witness", return_value=([{"schema": "CDRM11USIM1"}], witness)),
                mock.patch.object(cadr, "update_state") as update,
                contextlib.redirect_stdout(io.StringIO()),
            ):
                self.assertEqual(cadr.command_m11_audio_trigger(args, root), 0)

            focus.assert_called_once_with(state)
            self.assertEqual(
                xdotool_calls,
                [
                    ["type", "--clearmodifiers", "--delay", "17", "--", "(SI:%BEEP 500. 100000.)"],
                    ["key", "--clearmodifiers", "Return"],
                ],
            )
            update.assert_called_once()
            ledger = runtime / "m11-audio-actions.ndjson"
            records = [json.loads(line) for line in ledger.read_text(encoding="ascii").splitlines()]
            self.assertEqual([record.get("record") for record in records[1:]], ["intent", "outcome"])
            self.assertEqual(records[1]["form"], cadr.M11_AUDIO_TRIGGER_FORM)
            self.assertEqual(records[2]["result"], "witness-observed")

    def test_timing_number_validators_are_finite_and_bounded(self) -> None:
        self.assertEqual(cadr.positive_float("0.25"), 0.25)
        self.assertEqual(cadr.positive_float("86400"), 86400)
        self.assertEqual(cadr.nonnegative_float("0"), 0)
        self.assertEqual(cadr.nonnegative_float("86400"), 86400)
        self.assertEqual(cadr.positive_int("1"), 1)
        self.assertEqual(cadr.positive_int("10000"), 10000)
        self.assertEqual(cadr.nonnegative_int("0"), 0)
        self.assertEqual(cadr.nonnegative_int("60000"), 60000)
        self.assertEqual(cadr.duration_milliseconds("0"), 0)
        self.assertEqual(cadr.duration_milliseconds("600000"), 600000)

        invalid_float_cases = {
            cadr.positive_float: ("0", "-1", "nan", "inf", "-inf", "86400.1", "1e999"),
            cadr.nonnegative_float: ("-1", "nan", "inf", "-inf", "86400.1", "1e999"),
        }
        for validator, values in invalid_float_cases.items():
            for value in values:
                with self.subTest(validator=validator.__name__, value=value):
                    with self.assertRaises(cadr.argparse.ArgumentTypeError):
                        validator(value)

        invalid_integer_cases = {
            cadr.positive_int: ("0", "-1", "10001", "1.5", "nan"),
            cadr.nonnegative_int: ("-1", "60001", "1.5", "nan"),
            cadr.duration_milliseconds: ("-1", "600001", "1.5", "nan"),
        }
        for validator, values in invalid_integer_cases.items():
            for value in values:
                with self.subTest(validator=validator.__name__, value=value):
                    with self.assertRaises(cadr.argparse.ArgumentTypeError):
                        validator(value)

    def test_key_aliases_are_case_insensitive_and_unknown_keys_pass_through(self) -> None:
        self.assertEqual(
            cadr.translate_keys(
                ["SYSTEM", "network", "Status", "terminal", "help", "clear-input", "clear-screen"]
            ),
            ["F1", "F2", "F3", "F4", "F5", "F6", "F7"],
        )
        self.assertEqual(
            cadr.translate_keys(["return", "ENTER", "rubout", "space", "escape", "F12", "a"]),
            ["Return", "Return", "BackSpace", "space", "Escape", "F12", "a"],
        )

    def test_coordinates_and_three_mouse_buttons_enforce_cadr_bounds(self) -> None:
        for coordinate in (
            (0, 0),
            (cadr.EXPECTED_WIDTH - 1, cadr.EXPECTED_HEIGHT - 1),
        ):
            with self.subTest(coordinate=coordinate):
                self.assertIsNone(cadr.validate_coordinates(*coordinate))

        for coordinate in (
            (-1, 0),
            (0, -1),
            (cadr.EXPECTED_WIDTH, 0),
            (0, cadr.EXPECTED_HEIGHT),
        ):
            with self.subTest(coordinate=coordinate):
                with self.assertRaises(cadr.HarnessError):
                    cadr.validate_coordinates(*coordinate)

        for button in (1, 2, 3):
            self.assertIsNone(cadr.validate_button(button))
        for button in (0, 4, -1):
            with self.subTest(button=button):
                with self.assertRaises(cadr.HarnessError):
                    cadr.validate_button(button)


class ParserInterfaceTests(unittest.TestCase):
    def test_parser_exposes_non_live_command_interfaces_and_defaults(self) -> None:
        parser = cadr.build_parser()
        cases = (
            (["doctor"], "doctor", cadr.command_doctor),
            (["m11-audio-plan", "--prepared", "build/cadr-oracle/m11"], "m11-audio-plan", cadr.command_m11_audio_plan),
            (["start", "--session", "demo", "--fresh", "--timeout", "12.5"], "start", cadr.command_start),
            (["status", "--session", "demo"], "status", cadr.command_status),
            (["wait", "--session", "demo", "--stable-for", "2", "--interval", "0.25"], "wait", cadr.command_wait),
            (["key", "--session", "demo", "--down", "system"], "key", cadr.command_key),
            (["type", "--session", "demo", "--enter", "hello world"], "type", cadr.command_type),
            (["mouse", "--session", "demo", "click", "12", "34", "--button", "3"], "mouse", cadr.command_mouse),
            (["screenshot", "--session", "demo", "--label", "help-menu"], "screenshot", cadr.command_screenshot),
            (["m11-audio-trigger", "--session", "demo", "--listener-ready-screenshot", "/tmp/ready.png"], "m11-audio-trigger", cadr.command_m11_audio_trigger),
            (["stop", "--session", "demo", "--discard"], "stop", cadr.command_stop),
        )
        for arguments, command, handler in cases:
            with self.subTest(arguments=arguments):
                parsed = parser.parse_args(arguments)
                self.assertEqual(parsed.command, command)
                self.assertIs(parsed.handler, handler)

        start = parser.parse_args(["--state-root", "/tmp/cadr-state", "start"])
        self.assertEqual(start.state_root, "/tmp/cadr-state")
        self.assertEqual(start.session, cadr.DEFAULT_SESSION)
        self.assertFalse(start.fresh)
        self.assertFalse(start.resume)
        self.assertIsNone(start.m11_audio_witness)
        self.assertEqual(start.timeout, 60)

        click = parser.parse_args(["mouse", "click", "10", "20"])
        self.assertEqual((click.mouse_action, click.x, click.y, click.button), ("click", 10, 20, 1))

        supervisor = parser.parse_args(["_supervise", "--session", "internal", "--resume"])
        self.assertEqual(supervisor.command, "_supervise")
        self.assertEqual(supervisor.session, "internal")
        self.assertTrue(supervisor.resume)
        self.assertFalse(hasattr(supervisor, "handler"))

    def test_parser_rejects_missing_and_mutually_exclusive_actions(self) -> None:
        parser = cadr.build_parser()
        invalid = (
            [],
            ["start", "--fresh", "--resume"],
            ["key", "--down", "--up", "a"],
            ["key"],
            ["mouse"],
            ["mouse", "move", "1"],
        )
        for arguments in invalid:
            with self.subTest(arguments=arguments):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit):
                        parser.parse_args(arguments)

    def test_parser_applies_timing_validators_to_every_bounded_option(self) -> None:
        parser = cadr.build_parser()
        valid_zero_values = (
            ["wait", "--seconds", "0"],
            ["wait", "--stable-for", "0"],
            ["key", "--delay-ms", "0", "a"],
            ["type", "--delay-ms", "0", "text"],
            ["mouse", "drag", "0", "0", "1", "1", "--duration-ms", "0"],
        )
        for arguments in valid_zero_values:
            with self.subTest(arguments=arguments):
                parser.parse_args(arguments)

        invalid_timing_values = (
            ["start", "--timeout", "0"],
            ["start", "--timeout", "nan"],
            ["wait", "--seconds", "-1"],
            ["wait", "--stable-for", "inf"],
            ["wait", "--timeout", "86401"],
            ["wait", "--interval", "0"],
            ["key", "--delay-ms", "-1", "a"],
            ["key", "--delay-ms", "60001", "a"],
            ["type", "--delay-ms", "-1", "text"],
            ["mouse", "drag", "0", "0", "1", "1", "--duration-ms", "600001"],
            ["mouse", "drag", "0", "0", "1", "1", "--steps", "0"],
            ["mouse", "drag", "0", "0", "1", "1", "--steps", "10001"],
            ["stop", "--timeout", "-1"],
        )
        for arguments in invalid_timing_values:
            with self.subTest(arguments=arguments):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit):
                        parser.parse_args(arguments)

    def test_status_success_requires_supervisor_xvfb_and_usim(self) -> None:
        parser = cadr.build_parser()
        args = parser.parse_args(["status", "--session", "demo"])
        state = {"status": "running"}
        process_names = ("supervisor", "xvfb", "usim")

        with (
            tempfile.TemporaryDirectory() as temporary,
            mock.patch.object(cadr, "require_session_directory"),
            mock.patch.object(cadr, "read_state", return_value=state),
            mock.patch.object(cadr, "json_print"),
        ):
            state_root = Path(temporary)
            all_live = {name: True for name in process_names}
            with mock.patch.object(cadr, "status_payload", return_value={"live": all_live}):
                self.assertEqual(cadr.command_status(args, state_root), 0)

            for missing in process_names:
                live = {name: name != missing for name in process_names}
                with (
                    self.subTest(missing=missing),
                    mock.patch.object(cadr, "status_payload", return_value={"live": live}),
                ):
                    self.assertEqual(cadr.command_status(args, state_root), 1)

            stopped = {"status": "stopped"}
            with (
                mock.patch.object(cadr, "read_state", return_value=stopped),
                mock.patch.object(cadr, "status_payload", return_value={"live": all_live}),
            ):
                self.assertEqual(cadr.command_status(args, state_root), 1)


if __name__ == "__main__":
    unittest.main()
