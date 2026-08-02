"""Mutation tests for the source-only M12 continuation comparator."""
from __future__ import annotations

import copy
from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/compare-cadr-m12-breakpoint-continuation.py"


def load_comparator():
    specification = importlib.util.spec_from_file_location("cadr_m12_breakpoint_comparator_test", SCRIPT)
    assert specification and specification.loader
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


CMP = load_comparator()
SOURCE_PREIMAGE = b"synthetic comparator source preimage\n"


def digest(character: str) -> str:
    return character * 64


def capture(arm: str) -> dict:
    schema, backend, intervened = CMP.ARM_SPECS[arm]
    records = [
        {"boundary": 101, "semantic_sha256": digest("1")},
        {"boundary": 102, "semantic_sha256": digest("2")},
        {"boundary": 103, "semantic_sha256": digest("3")},
    ]
    actions = []
    if intervened:
        actions = [
            {
                "sequence": 0,
                "op": "debug-inspect-read",
                "array_kind": 1,
                "index": 17,
                "value": 0x12345678,
            },
            {
                "sequence": 1,
                "op": "debug-resume-one-boundary",
                "breakpoint_slot": 3,
            },
        ]
    return {
        "schema": schema,
        "schema_version": 2,
        "arm": arm,
        "identity": {
            "profile_sha256": digest("a"),
            "campaign_sha256": digest("b"),
            "source_revision": ("c" if backend == "native" else "d") * 40,
            "source_tree_sha256": digest("6" if backend == "native" else "7"),
            "fixture_sha256": digest("e"),
            "base_state_sha256": digest("5"),
            "snapshot_sha256": digest("8"),
            "input_schedule_sha256": digest("f"),
            "artifact_sha256": digest("1" if backend == "native" else "2"),
            "runner_sha256": digest("3" if backend == "native" else "4"),
        },
        "breakpoint": {"slot": 3, "kind": 1, "value": 0o164, "occurrence": 2},
        "pre_boundary": {
            "boundary_ordinal": 100,
            "clock_slot": 994,
            "micro_pc_before": 0o164,
            "raw_lc_before": 0x2345,
        },
        "pause": {"observed": intervened, "operation_slots": 0},
        "actions": actions,
        "post_resume": {
            "boundary_count": len(records),
            "semantic_hashes": records,
            "trace_sha256": CMP.semantic_trace_sha256(records),
        },
        "cleanup": {
            "status": "verified-clean",
            "process_exit_code": 0,
            "forced_stop": False,
            "state_may_be_incomplete": False,
            "fixture_sha256": digest("e"),
            "base_state_sha256_before": digest("5"),
            "base_state_sha256_after": digest("5"),
            "snapshot_sha256_before": digest("8"),
            "snapshot_sha256_after": digest("8"),
            "private_state_disposition": "discarded",
        },
    }


def encoded(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii") + b"\n"


def parsed(value: dict) -> dict:
    return CMP.parse_capture_bytes(
        encoded(value),
        value.get("schema", CMP.NATIVE_SCHEMA),
        value.get("arm", "native-intervened"),
    )


def expected() -> dict:
    sample = capture("native-uninterrupted")
    result = {field: sample["identity"][field] for field in CMP.COMMON_IDENTITY_FIELDS}
    for backend, arm in (("native", "native-uninterrupted"), ("wasm", "wasm-uninterrupted")):
        identity = capture(arm)["identity"]
        for field in CMP.BACKEND_IDENTITY_FIELDS:
            result[f"{backend}_{field}"] = identity[field]
    for field in CMP.BREAKPOINT_FIELDS:
        result[f"breakpoint_{field}"] = sample["breakpoint"][field]
    result["post_resume_boundaries"] = sample["post_resume"]["boundary_count"]
    return result


def four_parsed() -> dict[str, dict]:
    return {arm: parsed(capture(arm)) for arm in CMP.ARM_SPECS}


def input_hashes() -> dict[str, str]:
    return {
        arm: CMP.hashlib.sha256(encoded(capture(arm))).hexdigest()
        for arm in CMP.ARM_SPECS
    }


def compare(captures: dict[str, dict], selected: dict | None = None) -> dict:
    return CMP.compare_four(
        {arm: encoded(captures[arm]) for arm in CMP.ARM_SPECS},
        expected() if selected is None else selected,
        SOURCE_PREIMAGE,
    )


def receipt() -> dict:
    return compare(four_parsed())


def reseal(value: dict) -> None:
    value["receipt_sha256"] = CMP.receipt_sha256(value)


def write_capture_files(directory: Path) -> dict[str, Path]:
    result = {}
    for arm in CMP.ARM_SPECS:
        path = directory / f"{arm}.json"
        path.write_bytes(encoded(capture(arm)))
        result[arm] = path
    return result


def cli_argv(paths: dict[str, Path], selected: dict | None = None) -> list[str]:
    selected = expected() if selected is None else selected
    argv = []
    for arm, path in paths.items():
        argv.extend((f"--{arm}", str(path)))
    for field in CMP.COMMON_IDENTITY_FIELDS:
        argv.extend((f"--expected-{field.replace('_', '-')}", str(selected[field])))
    for backend in ("native", "wasm"):
        for field in CMP.BACKEND_IDENTITY_FIELDS:
            argv.extend(
                (
                    f"--expected-{backend}-{field.replace('_', '-')}",
                    str(selected[f"{backend}_{field}"]),
                )
            )
    for field in CMP.BREAKPOINT_FIELDS:
        argv.extend(
            (
                f"--expected-breakpoint-{field.replace('_', '-')}",
                str(selected[f"breakpoint_{field}"]),
            )
        )
    argv.extend(
        (
            "--expected-post-resume-boundaries",
            str(selected["post_resume_boundaries"]),
        )
    )
    return argv


def assign(value, path: tuple, replacement) -> None:
    target = value
    for item in path[:-1]:
        target = target[item]
    target[path[-1]] = replacement


def locate(value, path: tuple):
    target = value
    for item in path:
        target = target[item]
    return target


class ComparatorSchemaTests(unittest.TestCase):
    def assert_rejected(self, value: dict, label: str) -> None:
        with self.assertRaises(CMP.ComparisonError, msg=label):
            parsed(value)

    def test_all_four_closed_schemas_parse_and_compare(self) -> None:
        result = compare(four_parsed())
        self.assertEqual(result["schema"], "CDRM12CMP1")
        self.assertEqual(result["result"]["status"], "equal")
        self.assertEqual(result["post_resume"]["boundary_count"], 3)
        self.assertEqual(result["post_resume"]["trace_sha256"], capture("native-uninterrupted")["post_resume"]["trace_sha256"])

    def test_every_leaf_field_has_a_rejecting_mutation(self) -> None:
        base = capture("native-intervened")
        mutations = {
            ("schema",): "CDRM12W2",
            ("schema_version",): True,
            ("arm",): "native-uninterrupted",
            ("identity", "profile_sha256"): "A" * 64,
            ("identity", "campaign_sha256"): "b" * 63,
            ("identity", "source_revision"): "c" * 39,
            ("identity", "source_tree_sha256"): "g" * 64,
            ("identity", "fixture_sha256"): 7,
            ("identity", "base_state_sha256"): digest("0"),
            ("identity", "snapshot_sha256"): "8" * 63,
            ("identity", "input_schedule_sha256"): "f" * 65,
            ("identity", "artifact_sha256"): None,
            ("identity", "runner_sha256"): "",
            ("breakpoint", "slot"): 64,
            ("breakpoint", "kind"): 0,
            ("breakpoint", "value"): -1,
            ("breakpoint", "occurrence"): 0,
            ("pre_boundary", "boundary_ordinal"): True,
            ("pre_boundary", "clock_slot"): -1,
            ("pre_boundary", "micro_pc_before"): CMP.U32_MAX + 1,
            ("pre_boundary", "raw_lc_before"): "0",
            ("pause", "observed"): False,
            ("pause", "operation_slots"): 1,
            ("actions", 0, "sequence"): 1,
            ("actions", 0, "op"): "inspect",
            ("actions", 0, "array_kind"): 0,
            ("actions", 0, "index"): -1,
            ("actions", 0, "value"): CMP.U32_MAX + 1,
            ("actions", 1, "sequence"): 0,
            ("actions", 1, "op"): "continue",
            ("actions", 1, "breakpoint_slot"): 4,
            ("post_resume", "boundary_count"): 0,
            ("post_resume", "semantic_hashes", 0, "boundary"): -1,
            ("post_resume", "semantic_hashes", 0, "semantic_sha256"): "A" * 64,
            ("post_resume", "trace_sha256"): digest("0"),
            ("cleanup", "status"): "failed",
            ("cleanup", "process_exit_code"): 1,
            ("cleanup", "forced_stop"): True,
            ("cleanup", "state_may_be_incomplete"): True,
            ("cleanup", "fixture_sha256"): digest("6"),
            ("cleanup", "base_state_sha256_before"): "5" * 63,
            ("cleanup", "base_state_sha256_after"): digest("6"),
            ("cleanup", "snapshot_sha256_before"): digest("7"),
            ("cleanup", "snapshot_sha256_after"): digest("7"),
            ("cleanup", "private_state_disposition"): "retained",
        }
        for path, replacement in mutations.items():
            with self.subTest(path=path):
                changed = copy.deepcopy(base)
                assign(changed, path, replacement)
                self.assert_rejected(changed, ".".join(map(str, path)))

    def test_every_object_is_closed_and_every_declared_field_is_required(self) -> None:
        base = capture("native-intervened")
        objects = [
            (),
            ("identity",),
            ("breakpoint",),
            ("pre_boundary",),
            ("pause",),
            ("actions", 0),
            ("actions", 1),
            ("post_resume",),
            ("post_resume", "semantic_hashes", 0),
            ("cleanup",),
        ]
        for path in objects:
            with self.subTest(path=path, mutation="reserved"):
                changed = copy.deepcopy(base)
                locate(changed, path)["$extension"] = True
                self.assert_rejected(changed, f"reserved {path}")
            for field in tuple(locate(base, path)):
                with self.subTest(path=path, missing=field):
                    changed = copy.deepcopy(base)
                    del locate(changed, path)[field]
                    self.assert_rejected(changed, f"missing {path}.{field}")

    def test_container_types_and_action_cardinality_are_exact(self) -> None:
        for path in (
            ("identity",),
            ("breakpoint",),
            ("pre_boundary",),
            ("pause",),
            ("actions",),
            ("post_resume",),
            ("post_resume", "semantic_hashes"),
            ("cleanup",),
        ):
            with self.subTest(path=path):
                changed = capture("native-intervened")
                assign(changed, path, None)
                self.assert_rejected(changed, str(path))
        changed = capture("native-intervened")
        changed["actions"].pop()
        self.assert_rejected(changed, "short action list")
        changed = capture("native-uninterrupted")
        changed["actions"] = [{"op": "debug-inspect-read"}]
        self.assert_rejected(changed, "control action list")

    def test_post_resume_hashes_are_nonempty_contiguous_and_self_bound(self) -> None:
        changed = capture("native-uninterrupted")
        changed["post_resume"]["semantic_hashes"][1]["boundary"] = 104
        changed["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(changed["post_resume"]["semantic_hashes"])
        self.assert_rejected(changed, "gap")
        changed = capture("native-uninterrupted")
        changed["post_resume"]["semantic_hashes"].pop()
        self.assert_rejected(changed, "count")

    def test_boolean_breakpoint_target_is_exact(self) -> None:
        for value in (0, 2):
            changed = capture("native-intervened")
            changed["breakpoint"].update(kind=4, value=value)
            self.assert_rejected(changed, f"boolean target {value}")

    def test_strict_single_line_framing_and_duplicates(self) -> None:
        good = encoded(capture("native-uninterrupted"))
        bad_values = (
            good[:-1],
            good + b"\n",
            good.replace(b"\n", b"\r\n"),
            b"\xef\xbb\xbf" + good,
            good[:-1] + b"\n{}\n",
            b"\xff\n",
        )
        for data in bad_values:
            with self.subTest(data=data[:12]):
                with self.assertRaises(CMP.ComparisonError):
                    CMP.parse_capture_bytes(data, CMP.NATIVE_SCHEMA, "native-uninterrupted")
        duplicate = good.replace(b'{"actions":', b'{"actions":[],"actions":', 1)
        with self.assertRaisesRegex(CMP.ComparisonError, "duplicate JSON key"):
            CMP.parse_capture_bytes(duplicate, CMP.NATIVE_SCHEMA, "native-uninterrupted")

    def test_old_candidate_loop_witness_is_explicitly_rejected(self) -> None:
        old = (
            b'{"schema":"CDRM12USIM1","schema_version":1}\n'
            b'{"event":"candidate-loop","sequence":0}\n'
        )
        with self.assertRaisesRegex(CMP.ComparisonError, "old candidate-loop witness"):
            CMP.parse_capture_bytes(old, CMP.NATIVE_SCHEMA, "native-uninterrupted")

    def test_forced_incomplete_and_changed_base_cleanup_are_rejected(self) -> None:
        mutations = (
            ("forced_stop", True),
            ("state_may_be_incomplete", True),
            ("status", "unknown"),
            ("process_exit_code", -9),
            ("base_state_sha256_after", digest("6")),
        )
        for field, replacement in mutations:
            with self.subTest(field=field):
                changed = capture("wasm-intervened")
                changed["cleanup"][field] = replacement
                self.assert_rejected(changed, field)


class ComparatorDifferenceTests(unittest.TestCase):
    def test_native_intervention_must_equal_its_control(self) -> None:
        captures = four_parsed()
        captures["native-intervened"]["pre_boundary"]["raw_lc_before"] += 1
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"native intervention/control field=pre_boundary.raw_lc_before boundary=100",
        ):
            compare(captures)

    def test_wasm_intervention_must_equal_its_control(self) -> None:
        captures = four_parsed()
        record = captures["wasm-intervened"]["post_resume"]["semantic_hashes"][1]
        record["semantic_sha256"] = digest("9")
        captures["wasm-intervened"]["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            captures["wasm-intervened"]["post_resume"]["semantic_hashes"]
        )
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"Wasm intervention/control.*semantic_sha256 boundary=102",
        ):
            compare(captures)

    def test_native_and_wasm_share_the_same_semantic_trace(self) -> None:
        captures = four_parsed()
        for arm in ("wasm-uninterrupted", "wasm-intervened"):
            captures[arm]["post_resume"]["semantic_hashes"][0]["semantic_sha256"] = digest("8")
            captures[arm]["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
                captures[arm]["post_resume"]["semantic_hashes"]
            )
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"native/Wasm control.*semantic_sha256 boundary=101",
        ):
            compare(captures)

    def test_intervention_actions_are_shared_across_targets(self) -> None:
        captures = four_parsed()
        captures["wasm-intervened"]["actions"][0]["value"] += 1
        with self.assertRaisesRegex(CMP.DivergenceError, r"native/Wasm intervention field=actions\[0\].value"):
            compare(captures)

    def test_first_missing_trace_boundary_names_the_short_arm(self) -> None:
        captures = four_parsed()
        short = captures["wasm-intervened"]["post_resume"]
        short["semantic_hashes"].pop()
        short["boundary_count"] = len(short["semantic_hashes"])
        short["trace_sha256"] = CMP.semantic_trace_sha256(short["semantic_hashes"])
        with self.assertRaisesRegex(
            CMP.MissingBoundaryError,
            r"arm=wasm-intervened.*missing_boundary=103",
        ):
            compare(captures)

    def test_common_prefix_hash_divergence_precedes_missing_boundary(self) -> None:
        captures = four_parsed()
        short = captures["wasm-intervened"]["post_resume"]
        short["semantic_hashes"][0]["semantic_sha256"] = digest("9")
        short["semantic_hashes"].pop()
        short["boundary_count"] = len(short["semantic_hashes"])
        short["trace_sha256"] = CMP.semantic_trace_sha256(short["semantic_hashes"])
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"Wasm intervention/control.*semantic_sha256 boundary=101",
        ):
            compare(captures)

    def test_all_metadata_relationships_precede_any_missing_boundary(self) -> None:
        captures = four_parsed()
        short = captures["native-intervened"]["post_resume"]
        short["semantic_hashes"].pop()
        short["boundary_count"] = len(short["semantic_hashes"])
        short["trace_sha256"] = CMP.semantic_trace_sha256(short["semantic_hashes"])
        captures["wasm-intervened"]["identity"]["runner_sha256"] = digest("9")
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"Wasm intervention/control field=identity.runner_sha256",
        ):
            compare(captures)

    def test_earliest_boundary_hash_wins_across_all_relations(self) -> None:
        captures = four_parsed()
        native_record = captures["native-intervened"]["post_resume"]["semantic_hashes"][1]
        native_record["semantic_sha256"] = digest("8")
        captures["native-intervened"]["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            captures["native-intervened"]["post_resume"]["semantic_hashes"]
        )
        wasm_record = captures["wasm-intervened"]["post_resume"]["semantic_hashes"][0]
        wasm_record["semantic_sha256"] = digest("9")
        captures["wasm-intervened"]["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            captures["wasm-intervened"]["post_resume"]["semantic_hashes"]
        )
        with self.assertRaisesRegex(
            CMP.DivergenceError,
            r"Wasm intervention/control.*semantic_sha256 boundary=101",
        ):
            compare(captures)

    def test_selected_identity_target_and_fixed_count_are_external_gates(self) -> None:
        cases = (
            ("profile_sha256", digest("9"), "identity.profile_sha256"),
            ("native_artifact_sha256", digest("9"), "identity.artifact_sha256"),
            ("breakpoint_occurrence", 3, "breakpoint.occurrence"),
            ("post_resume_boundaries", 4, "boundary_count"),
        )
        for field, replacement, message in cases:
            with self.subTest(field=field):
                selected = expected()
                selected[field] = replacement
                with self.assertRaisesRegex(CMP.ComparisonError, message):
                    compare(four_parsed(), selected)

    def test_cli_has_four_explicit_arms_and_emits_only_a_verifier_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            argv = cli_argv(paths)
            stdout = io.StringIO()
            stderr = io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                status = CMP.main(argv)
            self.assertEqual(status, 0, stderr.getvalue())
            self.assertEqual(stderr.getvalue(), "")
            result = json.loads(stdout.getvalue())
            self.assertEqual(set(result), set(CMP.RECEIPT_FIELDS))
            self.assertEqual(result["result"]["status"], "equal")
            CMP.validate_receipt_structure(result)
            CMP.validate_receipt_bytes_authoritative(
                stdout.getvalue().encode("ascii"),
                comparator_source_bytes=SCRIPT.read_bytes(),
                capture_bytes={arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
            )


class ComparatorBoundaryAndInspectorTests(unittest.TestCase):
    def test_inspector_kinds_have_exact_selected_array_bounds(self) -> None:
        for array_kind, length in CMP.INSPECTOR_LENGTHS.items():
            with self.subTest(array_kind=array_kind, boundary="last-valid"):
                value = capture("native-intervened")
                value["actions"][0]["array_kind"] = array_kind
                value["actions"][0]["index"] = length - 1
                parsed(value)
            with self.subTest(array_kind=array_kind, boundary="first-invalid"):
                value = capture("native-intervened")
                value["actions"][0]["array_kind"] = array_kind
                value["actions"][0]["index"] = length
                with self.assertRaisesRegex(CMP.ComparisonError, f"bound {length}"):
                    parsed(value)
        value = capture("native-intervened")
        value["actions"][0]["array_kind"] = 6
        with self.assertRaises(CMP.ComparisonError):
            parsed(value)

    def test_first_trace_boundary_is_the_exact_successor(self) -> None:
        value = capture("native-uninterrupted")
        for record in value["post_resume"]["semantic_hashes"]:
            record["boundary"] += 1
        value["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            value["post_resume"]["semantic_hashes"]
        )
        with self.assertRaisesRegex(CMP.ComparisonError, r"must equal.*\+ 1"):
            parsed(value)

    def test_pre_boundary_successor_overflow_is_rejected(self) -> None:
        value = capture("native-uninterrupted")
        value["pre_boundary"]["boundary_ordinal"] = CMP.U64_MAX
        with self.assertRaisesRegex(CMP.ComparisonError, "has no successor"):
            parsed(value)

    def test_parser_enforces_size_limit_before_framing(self) -> None:
        with self.assertRaisesRegex(CMP.ComparisonError, "parser limit"):
            CMP.parse_capture_bytes(
                b"x" * (CMP.MAX_CAPTURE_BYTES + 1),
                CMP.NATIVE_SCHEMA,
                "native-uninterrupted",
            )


class ComparatorSafeReadTests(unittest.TestCase):
    def test_four_distinct_regular_files_are_read_and_byte_hashed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            admitted = CMP.safe_read_four(paths)
            self.assertEqual(set(admitted), set(CMP.ARM_SPECS))
            for arm in CMP.ARM_SPECS:
                self.assertEqual(admitted[arm]["data"], encoded(capture(arm)))
                self.assertEqual(
                    admitted[arm]["byte_sha256"],
                    CMP.hashlib.sha256(encoded(capture(arm))).hexdigest(),
                )

    def test_duplicate_normalized_path_and_duplicate_inode_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            paths = write_capture_files(directory)
            duplicate_path = dict(paths)
            duplicate_path["wasm-uninterrupted"] = paths["native-uninterrupted"]
            hardlink = directory / "hardlink.json"
            os.link(paths["native-uninterrupted"], hardlink)
            duplicate_inode = dict(paths)
            duplicate_inode["wasm-uninterrupted"] = hardlink
            for candidate, message in (
                (duplicate_path, "duplicate capture path"),
                (duplicate_inode, "duplicate capture inode"),
            ):
                with self.subTest(message=message):
                    opened = []
                    closed = []
                    real_open = CMP.os.open
                    real_close = CMP.os.close

                    def tracked_open(path, flags):
                        descriptor = real_open(path, flags)
                        opened.append(descriptor)
                        return descriptor

                    def tracked_close(descriptor):
                        closed.append(descriptor)
                        return real_close(descriptor)

                    with (
                        mock.patch.object(CMP.os, "open", side_effect=tracked_open),
                        mock.patch.object(CMP.os, "close", side_effect=tracked_close),
                    ):
                        with self.assertRaisesRegex(CMP.ComparisonError, message):
                            CMP.safe_read_four(candidate)
                    self.assertEqual(len(opened), 4)
                    self.assertEqual(set(closed), set(opened))

    def test_symlink_directory_fifo_and_oversize_inputs_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            regular = directory / "regular.json"
            regular.write_bytes(encoded(capture("native-uninterrupted")))
            symlink = directory / "link.json"
            symlink.symlink_to(regular)
            special_directory = directory / "capture-directory"
            special_directory.mkdir()
            fifo = directory / "capture-fifo"
            os.mkfifo(fifo)
            oversize = directory / "oversize.json"
            oversize.write_bytes(b"x" * (CMP.MAX_CAPTURE_BYTES + 1))
            for path, message in (
                (symlink, "safely open"),
                (special_directory, "not a regular file"),
                (fifo, "not a regular file"),
                (oversize, "byte limit"),
            ):
                with self.subTest(path=path.name):
                    with self.assertRaisesRegex(CMP.ComparisonError, message):
                        CMP.safe_read_capture(path)

    def test_fstat_change_during_read_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "capture.json"
            path.write_bytes(encoded(capture("native-uninterrupted")))
            real_fstat = CMP.os.fstat
            calls = 0

            def changing_fstat(descriptor):
                nonlocal calls
                calls += 1
                result = real_fstat(descriptor)
                if calls == 1:
                    return result
                return types.SimpleNamespace(
                    st_dev=result.st_dev,
                    st_ino=result.st_ino,
                    st_mode=result.st_mode,
                    st_nlink=result.st_nlink,
                    st_uid=result.st_uid,
                    st_gid=result.st_gid,
                    st_size=result.st_size,
                    st_mtime_ns=result.st_mtime_ns + 1,
                    st_ctime_ns=result.st_ctime_ns,
                )

            with mock.patch.object(CMP.os, "fstat", side_effect=changing_fstat):
                with self.assertRaisesRegex(CMP.ComparisonError, "changed while it was read"):
                    CMP.safe_read_capture(path)

    def test_main_reads_all_four_files_before_parsing_any(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            paths = write_capture_files(directory)
            paths["native-uninterrupted"].write_bytes(b"not-json\n")
            paths["wasm-intervened"] = directory / "missing.json"
            stderr = io.StringIO()
            with redirect_stderr(stderr), redirect_stdout(io.StringIO()):
                status = CMP.main(cli_argv(paths))
            self.assertEqual(status, 1)
            self.assertIn("cannot safely open capture", stderr.getvalue())
            self.assertNotIn("invalid JSON", stderr.getvalue())

    def test_all_four_descriptors_open_before_first_read_or_close(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            events = []
            real_open = CMP.os.open
            real_read = CMP.os.read
            real_close = CMP.os.close

            def tracked_open(path, flags):
                descriptor = real_open(path, flags)
                events.append(("open", descriptor))
                return descriptor

            def tracked_read(descriptor, size):
                events.append(("read", descriptor))
                return real_read(descriptor, size)

            def tracked_close(descriptor):
                events.append(("close", descriptor))
                return real_close(descriptor)

            with (
                mock.patch.object(CMP.os, "open", side_effect=tracked_open),
                mock.patch.object(CMP.os, "read", side_effect=tracked_read),
                mock.patch.object(CMP.os, "close", side_effect=tracked_close),
            ):
                CMP.safe_read_four(paths)
            first_non_open = next(index for index, event in enumerate(events) if event[0] != "open")
            self.assertEqual(first_non_open, 4)
            self.assertEqual([event[0] for event in events[:4]], ["open"] * 4)
            self.assertLess(
                max(index for index, event in enumerate(events) if event[0] == "open"),
                min(index for index, event in enumerate(events) if event[0] == "close"),
            )

    def test_acquisition_failure_closes_every_open_descriptor_without_reading(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            paths = write_capture_files(directory)
            special = directory / "fourth-directory"
            special.mkdir()
            paths["wasm-intervened"] = special
            opened = []
            closed = []
            reads = []
            real_open = CMP.os.open
            real_close = CMP.os.close
            real_read = CMP.os.read

            def tracked_open(path, flags):
                descriptor = real_open(path, flags)
                opened.append(descriptor)
                return descriptor

            def tracked_close(descriptor):
                closed.append(descriptor)
                return real_close(descriptor)

            def tracked_read(descriptor, size):
                reads.append(descriptor)
                return real_read(descriptor, size)

            with (
                mock.patch.object(CMP.os, "open", side_effect=tracked_open),
                mock.patch.object(CMP.os, "close", side_effect=tracked_close),
                mock.patch.object(CMP.os, "read", side_effect=tracked_read),
            ):
                with self.assertRaisesRegex(CMP.ComparisonError, "not a regular file"):
                    CMP.safe_read_four(paths)
            self.assertEqual(len(opened), 4)
            self.assertEqual(set(closed), set(opened))
            self.assertEqual(reads, [])

    def test_close_failure_rejects_success_after_attempting_all_four_closes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            closed = []
            real_close = CMP.os.close

            def failing_close(descriptor):
                closed.append(descriptor)
                real_close(descriptor)
                raise OSError(5, "synthetic close failure")

            with mock.patch.object(CMP.os, "close", side_effect=failing_close):
                with self.assertRaisesRegex(
                    CMP.ComparisonError,
                    "descriptor cleanup failed.*wasm-intervened.*native-uninterrupted",
                ) as raised:
                    CMP.safe_read_four(paths)
            self.assertEqual(len(closed), 4)
            for arm in CMP.ARM_SPECS:
                self.assertIn(arm, str(raised.exception))

    def test_close_failure_preserves_primary_error_and_attempts_all_closes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            paths = write_capture_files(directory)
            special = directory / "fourth-directory"
            special.mkdir()
            paths["wasm-intervened"] = special
            closed = []
            real_close = CMP.os.close

            def failing_close(descriptor):
                closed.append(descriptor)
                real_close(descriptor)
                raise OSError(5, "synthetic close failure")

            with mock.patch.object(CMP.os, "close", side_effect=failing_close):
                with self.assertRaises(CMP.ComparisonError) as raised:
                    CMP.safe_read_four(paths)
            message = str(raised.exception)
            self.assertIn("not a regular file", message)
            self.assertTrue(
                any(
                    "descriptor cleanup failed" in note
                    for note in raised.exception.__notes__
                )
            )
            self.assertIsInstance(raised.exception.__cause__, CMP.ComparisonError)
            self.assertEqual(len(closed), 4)

    def test_single_capture_close_failure_rejects_the_read(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "capture.json"
            path.write_bytes(encoded(capture("native-uninterrupted")))
            real_close = CMP.os.close

            def failing_close(descriptor):
                real_close(descriptor)
                raise OSError(5, "synthetic close failure")

            with mock.patch.object(CMP.os, "close", side_effect=failing_close):
                with self.assertRaisesRegex(
                    CMP.ComparisonError,
                    "descriptor cleanup failed.*single",
                ):
                    CMP.safe_read_capture(path)

    def test_keyboard_interrupt_during_first_read_still_closes_all_four(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            interruption = KeyboardInterrupt("synthetic read interruption")
            closed = []
            real_close = CMP.os.close

            def tracked_close(descriptor):
                closed.append(descriptor)
                return real_close(descriptor)

            with (
                mock.patch.object(CMP.os, "read", side_effect=interruption),
                mock.patch.object(CMP.os, "close", side_effect=tracked_close),
            ):
                with self.assertRaises(KeyboardInterrupt) as raised:
                    CMP.safe_read_four(paths)
            self.assertIs(raised.exception, interruption)
            self.assertEqual(len(closed), 4)

    def test_keyboard_interrupt_during_close_still_attempts_remaining_closes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            interruption = KeyboardInterrupt("synthetic close interruption")
            closed = []
            real_close = CMP.os.close

            def interrupted_close(descriptor):
                closed.append(descriptor)
                real_close(descriptor)
                if len(closed) == 1:
                    raise interruption

            with mock.patch.object(CMP.os, "close", side_effect=interrupted_close):
                with self.assertRaises(KeyboardInterrupt) as raised:
                    CMP.safe_read_four(paths)
            self.assertIs(raised.exception, interruption)
            self.assertEqual(len(closed), 4)
            self.assertTrue(
                any("wasm-intervened" in note for note in interruption.__notes__)
            )

    def test_single_capture_interruptions_always_close_or_propagate(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "capture.json"
            path.write_bytes(encoded(capture("native-uninterrupted")))
            real_close = CMP.os.close

            read_interruption = SystemExit("synthetic read exit")
            closed = []

            def tracked_close(descriptor):
                closed.append(descriptor)
                return real_close(descriptor)

            with (
                mock.patch.object(CMP.os, "read", side_effect=read_interruption),
                mock.patch.object(CMP.os, "close", side_effect=tracked_close),
            ):
                with self.assertRaises(SystemExit) as raised:
                    CMP.safe_read_capture(path)
            self.assertIs(raised.exception, read_interruption)
            self.assertEqual(len(closed), 1)

            close_interruption = KeyboardInterrupt("synthetic single close interruption")

            def interrupted_close(descriptor):
                real_close(descriptor)
                raise close_interruption

            with mock.patch.object(CMP.os, "close", side_effect=interrupted_close):
                with self.assertRaises(KeyboardInterrupt) as raised:
                    CMP.safe_read_capture(path)
            self.assertIs(raised.exception, close_interruption)

    def test_primary_interrupt_is_reraised_with_cleanup_failure_attached(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            primary = KeyboardInterrupt("synthetic primary interruption")
            real_close = CMP.os.close
            closed = []

            def failing_close(descriptor):
                closed.append(descriptor)
                real_close(descriptor)
                if len(closed) == 1:
                    raise OSError(5, "synthetic cleanup failure")

            with (
                mock.patch.object(CMP.os, "read", side_effect=primary),
                mock.patch.object(CMP.os, "close", side_effect=failing_close),
            ):
                with self.assertRaises(KeyboardInterrupt) as raised:
                    CMP.safe_read_four(paths)
            self.assertIs(raised.exception, primary)
            self.assertEqual(len(closed), 4)
            self.assertTrue(
                any("descriptor cleanup failed" in note for note in primary.__notes__)
            )
            self.assertIsInstance(primary.__cause__, CMP.ComparisonError)


class ComparatorArgumentTests(unittest.TestCase):
    def test_repeated_options_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            argv = cli_argv(paths)
            argv.extend(("--expected-breakpoint-slot", "3"))
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    CMP.main(argv)
            self.assertEqual(raised.exception.code, 2)

    def test_long_options_cannot_be_abbreviated(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            paths = write_capture_files(Path(temporary))
            argv = cli_argv(paths)
            index = argv.index("--expected-post-resume-boundaries")
            argv[index] = "--expected-post-resume-bound"
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    CMP.main(argv)
            self.assertEqual(raised.exception.code, 2)


class ComparatorReceiptTests(unittest.TestCase):
    def assert_receipt_rejected(self, value: dict, message: str = "") -> None:
        with self.assertRaises(CMP.ComparisonError, msg=message):
            CMP.validate_receipt_structure(value)

    def test_canonical_self_hashed_receipt_validates(self) -> None:
        value = receipt()
        data = CMP.canonical_json(value) + b"\n"
        parsed_receipt = CMP.validate_receipt_bytes_authoritative(
            data,
            comparator_source_bytes=SOURCE_PREIMAGE,
            capture_bytes={arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
        )
        self.assertEqual(parsed_receipt, value)
        self.assertEqual(value["receipt_sha256"], CMP.receipt_sha256(value))
        self.assertEqual(value["caller_expectation"], expected())
        self.assertEqual(value["validation_scope"], CMP.RECEIPT_VALIDATION_SCOPE)
        self.assertEqual(
            value["comparator"]["identity_kind"],
            "observed-path-source-preimage",
        )
        self.assertIn(
            "does-not-prove",
            value["comparator"]["execution_identity_nonclaim"],
        )
        self.assertEqual(
            value["result"]["semantic_trace_sha256"],
            value["post_resume"]["trace_sha256"],
        )
        for arm in CMP.ARM_SPECS:
            self.assertEqual(
                value["inputs"][arm]["byte_size"],
                len(encoded(capture(arm))),
            )
            self.assertEqual(value["inputs"][arm]["byte_sha256"], input_hashes()[arm])

    def test_every_receipt_object_is_closed_and_every_field_required(self) -> None:
        base = receipt()
        paths = (
            (),
            ("comparator",),
            ("inputs",),
            ("inputs", "native-uninterrupted"),
            ("inputs", "native-uninterrupted", "identity"),
            ("caller_expectation",),
            ("breakpoint",),
            ("pre_boundary",),
            ("pause",),
            ("pause", "native-intervened"),
            ("actions",),
            ("cleanup",),
            ("cleanup", "fixture"),
            ("cleanup", "arms"),
            ("cleanup", "arms", "native-uninterrupted"),
            ("post_resume",),
            ("post_resume", "semantic_hashes", 0),
            ("result",),
        )
        for path in paths:
            with self.subTest(path=path, mutation="reserved"):
                changed = copy.deepcopy(base)
                locate(changed, path)["$extension"] = True
                if path:
                    reseal(changed)
                self.assert_receipt_rejected(changed, f"reserved {path}")
            for field in tuple(locate(base, path)):
                with self.subTest(path=path, missing=field):
                    changed = copy.deepcopy(base)
                    del locate(changed, path)[field]
                    if path:
                        reseal(changed)
                    self.assert_receipt_rejected(changed, f"missing {path}.{field}")

    def test_receipt_component_and_relationship_mutations_are_rejected(self) -> None:
        mutations = (
            (("schema",), "CDRM12CMP2"),
            (("schema_version",), True),
            (("validation_scope",), "authority-claimed"),
            (("comparator", "contract"), "other"),
            (("comparator", "identity_kind"), "executed-source"),
            (("comparator", "execution_identity_nonclaim"), "none"),
            (("comparator", "source_bytes"), 0),
            (("comparator", "source_sha256"), "A" * 64),
            (("inputs", "native-uninterrupted", "byte_size"), -1),
            (("inputs", "native-uninterrupted", "byte_sha256"), "A" * 64),
            (("inputs", "native-uninterrupted", "schema"), CMP.WASM_SCHEMA),
            (("inputs", "native-uninterrupted", "schema_version"), 3),
            (("inputs", "native-uninterrupted", "identity", "fixture_sha256"), digest("9")),
            (("caller_expectation", "profile_sha256"), digest("8")),
            (("breakpoint", "occurrence"), 3),
            (("pre_boundary", "micro_pc_before"), 0),
            (("pause", "native-intervened", "operation_slots"), 1),
            (("actions", "wasm-intervened", 0, "value"), 0),
            (("cleanup", "fixture", "base_state_sha256"), digest("9")),
            (("cleanup", "arms", "native-intervened", "forced_stop"), True),
            (("post_resume", "first_boundary"), 102),
            (("result", "status"), "failed"),
            (("result", "claim"), "broader-claim"),
            (("result", "post_resume_boundaries"), 4),
            (("result", "semantic_trace_sha256"), digest("8")),
        )
        for path, replacement in mutations:
            with self.subTest(path=path):
                changed = copy.deepcopy(receipt())
                assign(changed, path, replacement)
                reseal(changed)
                self.assert_receipt_rejected(changed, ".".join(map(str, path)))

        changed = copy.deepcopy(receipt())
        changed["post_resume"]["semantic_hashes"][0]["semantic_sha256"] = digest("a")
        changed["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            changed["post_resume"]["semantic_hashes"]
        )
        reseal(changed)
        self.assert_receipt_rejected(changed, "trace/result binding")

        changed = copy.deepcopy(receipt())
        changed["receipt_sha256"] = digest("8")
        self.assert_receipt_rejected(changed, "self hash")

    def test_receipt_framing_is_canonical_bounded_and_duplicate_free(self) -> None:
        value = receipt()
        canonical = CMP.canonical_json(value) + b"\n"
        noncanonical = json.dumps(value, sort_keys=True).encode("ascii") + b"\n"
        duplicate = canonical.replace(
            b'{"actions":', b'{"actions":{},"actions":', 1
        )
        bad = (
            canonical[:-1],
            canonical + b"\n",
            b"\xef\xbb\xbf" + canonical,
            noncanonical,
            duplicate,
            b"x" * (CMP.MAX_CAPTURE_BYTES + 1),
        )
        for data in bad:
            with self.subTest(prefix=data[:12]):
                with self.assertRaises(CMP.ComparisonError):
                    CMP.validate_receipt_bytes_structure(data)

    def test_cleanup_is_bound_to_shared_selected_fixture_base_and_snapshot(self) -> None:
        relationships = (
            ("fixture_sha256", digest("9")),
            ("base_state_sha256_before", digest("9")),
            ("base_state_sha256_after", digest("9")),
            ("snapshot_sha256_before", digest("9")),
            ("snapshot_sha256_after", digest("9")),
        )
        for field, replacement in relationships:
            with self.subTest(field=field):
                value = capture("native-intervened")
                value["cleanup"][field] = replacement
                with self.assertRaises(CMP.ComparisonError):
                    parsed(value)

    def test_authoritative_validation_rejects_source_and_capture_preimage_mismatch(self) -> None:
        value = receipt()
        capture_preimages = {arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS}
        with self.assertRaisesRegex(CMP.ComparisonError, "source preimage"):
            CMP.validate_receipt_authoritative(
                value,
                comparator_source_bytes=b"different source preimage\n",
                capture_bytes=capture_preimages,
            )
        changed = dict(capture_preimages)
        changed["native-uninterrupted"] = changed["native-uninterrupted"].replace(
            b'"schema":"CDRM12N2"',
            b'"schema":"CDRM12X2"',
            1,
        )
        with self.assertRaisesRegex(CMP.ComparisonError, "capture preimage hash"):
            CMP.validate_receipt_authoritative(
                value,
                comparator_source_bytes=SOURCE_PREIMAGE,
                capture_bytes=changed,
            )

    def test_coordinated_reseal_is_rejected_by_exact_preimage_replay(self) -> None:
        value = copy.deepcopy(receipt())
        value["post_resume"]["semantic_hashes"][0]["semantic_sha256"] = digest("a")
        value["post_resume"]["trace_sha256"] = CMP.semantic_trace_sha256(
            value["post_resume"]["semantic_hashes"]
        )
        value["result"]["semantic_trace_sha256"] = value["post_resume"]["trace_sha256"]
        reseal(value)
        CMP.validate_receipt_structure(value)
        with self.assertRaisesRegex(CMP.ComparisonError, "not reproduced"):
            CMP.validate_receipt_authoritative(
                value,
                comparator_source_bytes=SOURCE_PREIMAGE,
                capture_bytes={arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
            )

    def test_observed_source_path_replacement_is_not_execution_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            observed_path = directory / "comparator.py"
            replacement_path = directory / "replacement.py"
            observed_path.write_bytes(b"first observed source\n")
            replacement_path.write_bytes(b"replacement observed source\n")
            with mock.patch.object(CMP, "__file__", str(observed_path)):
                first = CMP.comparator_source_preimage()
                os.replace(replacement_path, observed_path)
                second = CMP.comparator_source_preimage()
            self.assertNotEqual(first, second)
            value = CMP.compare_four(
                {arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
                expected(),
                first,
            )
            CMP.validate_receipt_structure(value)
            with self.assertRaisesRegex(CMP.ComparisonError, "source preimage"):
                CMP.validate_receipt_authoritative(
                    value,
                    comparator_source_bytes=second,
                    capture_bytes={arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
                )
            CMP.validate_receipt_authoritative(
                value,
                comparator_source_bytes=first,
                capture_bytes={arm: encoded(capture(arm)) for arm in CMP.ARM_SPECS},
            )


if __name__ == "__main__":
    unittest.main()
