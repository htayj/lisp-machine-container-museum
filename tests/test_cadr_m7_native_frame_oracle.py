"""Focused tests for M7's private-frame parser and non-inherited environment."""

from __future__ import annotations

import importlib.util
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/cadr-m7-native-frame-oracle.py"


def load_oracle():
    specification = importlib.util.spec_from_file_location("cadr_m7_native_frame_oracle_test", SCRIPT)
    assert specification and specification.loader
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


def record(oracle, *, boundary: int = 982_990_214) -> bytes:
    value = bytearray(64 + oracle.FRAME_PAYLOAD_BYTES)
    value[:7] = b"CDRM7N1"
    value[8:12] = (1).to_bytes(4, "little")
    value[12:16] = (64).to_bytes(4, "little")
    value[16:24] = boundary.to_bytes(8, "little")
    value[24:28] = (768).to_bytes(4, "little")
    value[28:32] = (963).to_bytes(4, "little")
    value[32:36] = (4).to_bytes(4, "little")
    value[36:40] = (1).to_bytes(4, "little")
    value[40:44] = (32768).to_bytes(4, "little")
    value[44:48] = (23112).to_bytes(4, "little")
    value[48:52] = oracle.FRAME_PAYLOAD_BYTES.to_bytes(4, "little")
    for index in range(oracle.FRAME_ACTIVE_WORDS):
        value[64 + index * 4:68 + index * 4] = (index * 0x10204081 & 0xffffffff).to_bytes(4, "little")
    return bytes(value)


def expect_rejected(oracle, path: Path, label: str) -> None:
    try:
        oracle.parse_cdrm7n1(path)
    except (oracle.M7OracleError, oracle.BASE.OracleError):
        return
    raise AssertionError(f"{label} was accepted")


def main() -> None:
    oracle = load_oracle()
    assert oracle.canonical_result({"a": 1}) == b'{"a":1}'
    blocked = subprocess.run([
        sys.executable, str(SCRIPT), "native-capture",
        "--prepared", "build/cadr-oracle/nonexistent",
        "--config", "build/cadr-oracle/nonexistent.json",
        "--output", "build/cadr-oracle/nonexistent-output",
        "--session-id", "native-test",
        "--private-disk-instance-id", "disk-test",
    ], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
    assert blocked.returncode == 2
    blocked_result = json.loads(blocked.stdout)
    assert blocked_result["status"] == "invalid"
    assert "explicit --execute" in blocked_result["error"]
    original_capture = oracle.native_capture
    oracle.native_capture = lambda **_kwargs: {
        "status": "captured", "operation": "native-capture", "metadata": {}}
    captured_stdout = io.StringIO()
    try:
        with redirect_stdout(captured_stdout):
            captured_exit = oracle.main([
                "native-capture", "--prepared", "p", "--config", "c", "--output", "o",
                "--session-id", "s", "--private-disk-instance-id", "d", "--execute"])
    finally:
        oracle.native_capture = original_capture
    assert captured_exit == 0
    assert json.loads(captured_stdout.getvalue())["status"] == "captured"
    patch, patch_bytes = oracle.m7_patch()
    assert patch.name == "0003-m7-frame-witness.patch"
    assert patch_bytes.startswith(b"diff --git a/Makefile.usim")
    ignored_root = ROOT / "build/cadr-oracle"
    ignored_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="m7-private-frame-", dir=ignored_root) as temporary:
        capture = Path(temporary) / "frame.cdrm7n1"
        capture.write_bytes(record(oracle))
        os.chmod(capture, 0o600)
        parsed = oracle.parse_cdrm7n1(capture)
        assert parsed["schema"] == "CDRM7N1"
        assert parsed["boundary"] == "982990214"
        assert parsed["active_words"] == 23112
        assert parsed["black_on_white"] is True
        relative = capture.relative_to(ROOT).as_posix()
        assert oracle.verify_capture(capture_value=relative,
                                     expected_boundary="982990214")["status"] == "ok"
        assert oracle.verify_capture(capture_value=relative,
                                     expected_boundary="982990215")["status"] == "invalid"
        short = capture.parent / "short.cdrm7n1"
        short.write_bytes(b"bad")
        os.chmod(short, 0o600)
        expect_rejected(oracle, short, "short private frame")
        symlink = capture.parent / "symlink.cdrm7n1"
        os.symlink(capture, symlink)
        expect_rejected(oracle, symlink, "symlink private frame")
        hardlink = capture.parent / "hardlink.cdrm7n1"
        os.link(capture, hardlink)
        expect_rejected(oracle, capture, "hard-linked private frame")
        hardlink.unlink()
        os.chmod(capture, 0o644)
        expect_rejected(oracle, capture, "wrong-mode private frame")
        os.chmod(capture, 0o600)
        for name, offset, replacement in (
                ("reserved", 56, b"\x01"),
                ("version", 8, (2).to_bytes(4, "little")),
                ("boundary", 16, (982_990_215).to_bytes(8, "little"))):
            malformed = bytearray(record(oracle))
            malformed[offset:offset + len(replacement)] = replacement
            candidate = capture.parent / f"{name}.cdrm7n1"
            candidate.write_bytes(malformed)
            os.chmod(candidate, 0o600)
            expect_rejected(oracle, candidate, f"{name} private frame")
        for phase in ("write", "file-fsync", "after-link", "parent-fsync"):
            marker = capture.parent / f"{phase}.json"
            try:
                oracle.atomic_write_new(marker, b"{}\n", failure_phase=phase)
            except oracle.M7OracleError:
                pass
            else:
                raise AssertionError(f"atomic marker {phase} failure was accepted")
            assert not marker.exists(), f"atomic {phase} failure left a final marker"
            assert not list(marker.parent.glob(f".{marker.name}.tmp-*")), \
                f"atomic {phase} failure left a temporary marker"
        marker = capture.parent / "published.json"
        oracle.atomic_write_new(marker, b"{}\n")
        assert marker.read_bytes() == b"{}\n"
        assert marker.stat().st_mode & 0o7777 == 0o600
        environment = oracle.native_execution_environment(
            schedule=capture.resolve(), raw_log=(capture.parent / "raw.ndjson").resolve(),
            idle_samples=(capture.parent / "idle.bin").resolve(), session_id="test-session",
            frame_output=(capture.parent / "output.cdrm7n1").resolve())
        assert set(environment) == {
            "LANG", "LC_ALL", "TZ", "CADR_M6_RAW_SCHEDULE", "CADR_M6_NATIVE_LOG",
            "CADR_M6_IDLE_SAMPLES", "CADR_M6_SESSION_ID", "CADR_M7_FRAME_OUTPUT",
        }
        assert environment["CADR_M7_FRAME_OUTPUT"].endswith("output.cdrm7n1")

    # This exercises the production preparer, not a hand-applied surrogate:
    # 0002 then 0003 must apply with fuzz=0 before m7-frame-oracle builds.
    output_name = f"build/cadr-oracle/m7-exact-patch-test-{uuid.uuid4().hex}"
    output = ROOT / output_name
    try:
        prepared = oracle.prepare(output_value=output_name)
        assert prepared["status"] == "ok", prepared
        assert prepared["prepare"]["m7_patch"]["application"] == \
            "patch --batch --forward --fuzz=0 --posix -p1"
        built = oracle.build(prepared_value=output_name)
        assert built["status"] == "ok", built
        assert oracle.capture_plan(prepared_value=output_name)["status"] == "planned"
        source = output / "source/usim"
        header = (source / "tv.h").read_text(encoding="utf-8")
        assert "extern uint32_t tv_screen_buffer[TV_SCREEN_BUFFER_WORDS];" in header
        tv_source = source / "tv.c"
        original = tv_source.read_text(encoding="utf-8")
        assert "M7 requires exactly 32768 TV backing words" in original
        executable = source / "usim"
        original_executable = executable.read_bytes()
        executable.write_bytes(bytes([original_executable[0] ^ 1]) + original_executable[1:])
        assert oracle.capture_plan(prepared_value=output_name)["status"] == "invalid"
        executable.write_bytes(original_executable)
        os.chmod(executable, 0o755)
        build_marker = output / "m7-build.json"
        original_build_marker = build_marker.read_bytes()
        build_marker.write_bytes(original_build_marker + b" ")
        os.chmod(build_marker, 0o600)
        assert oracle.capture_plan(prepared_value=output_name)["status"] == "invalid"
        build_marker.write_bytes(original_build_marker)
        os.chmod(build_marker, 0o600)
        tv_source.write_text(original + "\n/* tampered */\n", encoding="utf-8")
        assert oracle.capture_plan(prepared_value=output_name)["status"] == "invalid"
        tv_source.write_text(original, encoding="utf-8")
        prepare_marker = output / "m7-prepare.json"
        original_prepare_marker = prepare_marker.read_bytes()
        base_support = json.loads(original_prepare_marker)["m7_native_support"]
        malformed_first_entries = (
            {},
            {"installed_as": "cadr_m7_frame_witness.c", "bytes": 1, "sha256": "0" * 64},
            {"path": "x", "installed_as": "x", "bytes": 1, "sha256": "0" * 64,
             "unknown": True},
            "not-an-object",
            {"path": "x", "installed_as": 7, "bytes": "1", "sha256": 9},
        )
        for first_entry in malformed_first_entries:
            malformed_marker = json.loads(original_prepare_marker)
            malformed_marker["m7_native_support"] = [first_entry, base_support[1]]
            prepare_marker.write_bytes(oracle.canonical(malformed_marker))
            os.chmod(prepare_marker, 0o600)
            response = oracle.capture_plan(prepared_value=output_name)
            assert response["status"] == "invalid", response
        prepare_marker.write_bytes(original_prepare_marker)
        os.chmod(prepare_marker, 0o600)
        tv_source.write_text(original.replace(
            "uint32_t tv_screen_buffer[0100000 /* 32K */];",
            "uint32_t tv_screen_buffer[32767];", 1), encoding="utf-8")
        wrong_size = subprocess.run([
            "make", "-f", "Makefile.usim", "USIM_BACKEND=m7-frame-oracle",
            "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos", "LDFLAGS=-no-pie",
        ], cwd=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        assert wrong_size.returncode != 0, "wrong TV backing declaration compiled"
        assert "TV backing" in wrong_size.stderr or "conflicting types" in wrong_size.stderr
    finally:
        shutil.rmtree(output, ignore_errors=True)


if __name__ == "__main__":
    main()
