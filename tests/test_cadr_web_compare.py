import subprocess
import sys
import importlib.util
import hashlib
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / "scripts" / "compare-cadr-web-trace.py"
TRACE_SCRIPT = ROOT / "scripts" / "cadr_oracle_trace.py"
SPEC = importlib.util.spec_from_file_location("cadr_web_compare_trace", TRACE_SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("cannot load trace codec")
trace = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = trace
SPEC.loader.exec_module(trace)


def identity_components() -> tuple[bytes, ...]:
    return tuple(
        hashlib.sha256(f"component-{index}".encode()).digest()
        for index in range(8)
    )


def s0_record() -> bytes:
    return trace.boundary_record(
        0, 0, trace.ZERO_SHA256, bytes.fromhex("11" * 32),
        trace.EMPTY_MUTATION_SHA256, 0, None, 0, 0,
        trace.BOUNDARY_S0, identity_components(),
    )


def write_oracle(path: Path, records: tuple[bytes, ...]) -> None:
    identities = identity_components()
    path.write_bytes(
        trace.encode_trace(records, trace.identity_bundle(identities)[:16])
    )


def fixture(tmp_path: Path) -> tuple[Path, Path, str, str, str, str]:
    state = bytes.fromhex("11" * 32)
    mutation = trace.EMPTY_MUTATION_SHA256
    identities = identity_components()
    boundary = s0_record()
    terminal = trace.terminal_record(
        1, 0, 2, 0, trace.boundary_semantic_hash(boundary),
        trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_LIMIT_REACHED,
    )
    oracle = tmp_path / "oracle.cdrtrc1"
    write_oracle(oracle, (boundary, terminal))
    production = tmp_path / "production.txt"
    production.write_text(
        "0 0 0 000000000000 000000000000 0 0 0 0 0 "
        f"00000000 00000000 0 0 {mutation.hex()} {state.hex()}\n",
        encoding="ascii",
    )
    return (
        oracle,
        production,
        mutation.hex(),
        state.hex(),
        trace.identity_bundle(identities).hex(),
        identities[0].hex(),
    )


def two_boundary_fixture(
    tmp_path: Path, *, halted: bool = False
) -> tuple[Path, Path, str, str, str, str]:
    result = fixture(tmp_path)
    oracle, production, _mutation, _state, _identity, _profile = result
    s0 = s0_record()
    state = bytes.fromhex("44" * 32)
    oracle_flags = trace.BOUNDARY_EXECUTED
    production_flags = 1
    if halted:
        oracle_flags |= trace.BOUNDARY_HALT
        production_flags |= 4
    boundary = trace.boundary_record(
        1, 1, trace.boundary_semantic_hash(s0), state,
        trace.EMPTY_MUTATION_SHA256, 1, 0, 0, 0, oracle_flags,
    )
    reason = (
        trace.TERMINAL_REASON_COMPLETE_HALT
        if halted
        else trace.TERMINAL_REASON_COMPLETE_LIMIT
    )
    terminal = trace.terminal_record(
        2, 1, 3, 1, trace.boundary_semantic_hash(boundary),
        trace.TERMINAL_COMPLETE, reason,
    )
    write_oracle(oracle, (s0, boundary, terminal))
    with production.open("a", encoding="ascii") as stream:
        stream.write(
            "1 0 1 000000000000 000000000000 "
            f"{production_flags} 0 0 0 0 00000000 00000000 0 0 "
            f"{trace.EMPTY_MUTATION_SHA256.hex()} {state.hex()}\n"
        )
    return result


def replace_production_flags(production: Path, ordinal: int, flags: int) -> None:
    lines = production.read_text(encoding="ascii").splitlines()
    fields = lines[ordinal].split()
    fields[5] = str(flags)
    lines[ordinal] = " ".join(fields)
    production.write_text("\n".join(lines) + "\n", encoding="ascii")


def run(
    oracle: Path,
    production: Path,
    identity_bundle: str,
    profile_sha256: str,
    expected: int = 1,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable, str(COMPARATOR), str(oracle), str(production),
            "--expected-identity-bundle", identity_bundle,
            "--expected-profile-sha256", profile_sha256,
            "--expected-boundaries", str(expected),
        ],
        check=False, text=True, capture_output=True,
    )


class CadrWebComparatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_correct_identity_and_profile_selection_matches(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "matched 1 boundaries\n")

    def test_state_digest_mutation_fails(self) -> None:
        oracle, production, _mutation, state, identity, profile = fixture(
            self.directory
        )
        production.write_text(
            production.read_text(encoding="ascii").replace(state, "22" * 32),
            encoding="ascii",
        )
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("first divergence at boundary 0", result.stderr)

    def test_ordered_mutation_digest_mutation_fails(self) -> None:
        oracle, production, mutation, _state, identity, profile = fixture(
            self.directory
        )
        production.write_text(
            production.read_text(encoding="ascii").replace(mutation, "33" * 32),
            encoding="ascii",
        )
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("first divergence at boundary 0", result.stderr)

    def test_wrong_boundary_count_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        result = run(oracle, production, identity, profile, expected=2)
        self.assertEqual(result.returncode, 1)
        self.assertIn("production has 1, expected 2 boundaries", result.stderr)

    def test_wrong_identity_bundle_rejects_self_consistent_trace(self) -> None:
        oracle, production, _mutation, _state, _identity, profile = fixture(
            self.directory
        )
        result = run(oracle, production, "ab" * 32, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "identity bundle does not match selected expectation",
            result.stderr,
        )

    def test_wrong_profile_rejects_self_consistent_trace(self) -> None:
        oracle, production, _mutation, _state, identity, _profile = fixture(
            self.directory
        )
        result = run(oracle, production, identity, "cd" * 32)
        self.assertEqual(result.returncode, 1)
        self.assertIn(
            "profile identity does not match selected expectation",
            result.stderr,
        )

    def test_missing_selection_expectations_fails(self) -> None:
        oracle, production, _mutation, _state, _identity, _profile = fixture(
            self.directory
        )
        result = subprocess.run(
            [
                sys.executable, str(COMPARATOR), str(oracle), str(production),
                "--expected-boundaries", "1",
            ],
            check=False,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("--expected-identity-bundle", result.stderr)
        self.assertIn("--expected-profile-sha256", result.stderr)

    def test_malformed_selection_expectations_fail(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        for option, malformed, other_option, other_value in (
            (
                "--expected-identity-bundle",
                "not-a-digest",
                "--expected-profile-sha256",
                profile,
            ),
            (
                "--expected-profile-sha256",
                "1234",
                "--expected-identity-bundle",
                identity,
            ),
        ):
            with self.subTest(option=option):
                result = subprocess.run(
                    [
                        sys.executable,
                        str(COMPARATOR),
                        str(oracle),
                        str(production),
                        option,
                        malformed,
                        other_option,
                        other_value,
                        "--expected-boundaries",
                        "1",
                    ],
                    check=False,
                    text=True,
                    capture_output=True,
                )
                self.assertEqual(result.returncode, 2)
                self.assertIn(
                    "expected exactly 64 hexadecimal characters",
                    result.stderr,
                )

    def test_matching_s0_with_terminal_abort_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        s0 = s0_record()
        abort = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED,
        )
        write_oracle(oracle, (s0, abort))
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("TERMINAL_COMPLETE/COMPLETE_LIMIT", result.stderr)

    def test_oracle_failure_terminal_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        s0 = s0_record()
        failure = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ORACLE_FAILURE,
            trace.TERMINAL_REASON_ORACLE_FAILURE,
        )
        write_oracle(oracle, (s0, failure))
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("TERMINAL_COMPLETE/COMPLETE_LIMIT", result.stderr)

    def test_complete_halt_reason_fails_selected_prefix_gate(self) -> None:
        oracle, production, _mutation, _state, identity, profile = (
            two_boundary_fixture(self.directory, halted=True)
        )
        result = run(oracle, production, identity, profile, expected=2)
        self.assertEqual(result.returncode, 1)
        self.assertIn("TERMINAL_COMPLETE/COMPLETE_LIMIT", result.stderr)

    def test_external_event_fails_even_with_valid_abort_terminal(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        s0 = s0_record()
        event = trace.external_event_record(1, 0, 7, 9, b"synthetic")
        abort = trace.terminal_record(
            2, 0, 3, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED,
        )
        write_oracle(oracle, (s0, event, abort))
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("contains an external event", result.stderr)

    def test_missing_terminal_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        write_oracle(oracle, (s0_record(),))
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("trace has no terminal record", result.stderr)

    def test_duplicate_terminal_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        s0 = s0_record()
        first = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED,
        )
        second = trace.terminal_record(
            2, 0, 3, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_ABORT, trace.TERMINAL_REASON_ABORTED,
        )
        write_oracle(oracle, (s0, first, second))
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("terminal record is not last", result.stderr)

    def test_terminal_before_expected_final_boundary_fails(self) -> None:
        oracle, production, _mutation, _state, identity, profile = (
            two_boundary_fixture(self.directory)
        )
        s0 = s0_record()
        early = trace.terminal_record(
            1, 0, 2, 0, trace.boundary_semantic_hash(s0),
            trace.TERMINAL_COMPLETE, trace.TERMINAL_REASON_COMPLETE_LIMIT,
        )
        write_oracle(oracle, (s0, early))
        result = run(oracle, production, identity, profile, expected=2)
        self.assertEqual(result.returncode, 1)
        self.assertIn("oracle has 1, expected 2 boundaries", result.stderr)

    def test_s0_production_flags_must_be_zero(self) -> None:
        oracle, production, _mutation, _state, identity, profile = fixture(
            self.directory
        )
        replace_production_flags(production, 0, 1)
        result = run(oracle, production, identity, profile)
        self.assertEqual(result.returncode, 1)
        self.assertIn("S0 flags must be exactly zero", result.stderr)

    def test_later_production_activity_flags_fail_closed(self) -> None:
        for name, flags, diagnostic in (
            ("both", 3, "exactly executed xor inhibited"),
            ("neither", 0, "exactly executed xor inhibited"),
            ("unknown", 33, "contain unknown bits"),
            ("inhibited-halt", 6, "cannot be both inhibited and halted"),
        ):
            with self.subTest(case=name):
                case_dir = self.directory / name
                case_dir.mkdir()
                oracle, production, _mutation, _state, identity, profile = (
                    two_boundary_fixture(case_dir)
                )
                replace_production_flags(production, 1, flags)
                result = run(
                    oracle, production, identity, profile, expected=2
                )
                self.assertEqual(result.returncode, 1)
                self.assertIn(diagnostic, result.stderr)


if __name__ == "__main__":
    unittest.main()
