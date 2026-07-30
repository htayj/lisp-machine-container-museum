"""Compile and exercise the M8/M9 pre-IOB witness and exact campaign driver."""

from __future__ import annotations

from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import uuid


ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT / "cadr-web/oracle/native"
TESTS = ROOT / "cadr-web/tests"


def compile_and_run(name: str, sources: list[Path], argument: str) -> None:
    with tempfile.TemporaryDirectory(prefix=f"{name}-") as temporary:
        directory = Path(temporary)
        executable = directory / name
        subprocess.run([
            "cc", "-std=gnu99", "-Wall", "-Wextra", "-Werror", "-I", str(NATIVE),
            "-o", str(executable), *(str(source) for source in sources),
        ], check=True, cwd=ROOT)
        subprocess.run([str(executable), str(directory / argument)], check=True, cwd=ROOT)


def remove_prepared_tree(path: Path) -> None:
    if path.is_symlink():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)
    assert not path.exists(), f"test output was not removed: {path}"


def exercise_prepared_oracle(prepared: str, oracle: Path) -> None:
    for operation, argument in (("prepare", "--output"), ("build", "--prepared"),
                                ("campaign-plan", "--prepared")):
        completed = subprocess.run(["python3", str(oracle), operation, argument, prepared],
                                   cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, check=False)
        assert completed.returncode == 0, completed.stderr + completed.stdout
        result = json.loads(completed.stdout)
        if operation == "build":
            build = result["build"]
            assert set(build["toolchain"]) == {"make", "cc", "ar", "ld", "nm"}
            assert build["build_command"][0] == build["toolchain"]["make"]["path"]
            assert build["build_environment"]["LC_ALL"] == "C"
            assert build["python"]["sha256"]
            assert build["x11_toolchain"]["pkg_config"]["sha256"]
            assert build["x11_toolchain"]["queries"]["libs"]["stdout"] == "-lX11"
            assert build["x11_toolchain"]["resolved_libX11"]["sha256"]
    assert result["status"] in {"ok", "planned"}, result
    assert result["runtime_execution_performed"] is False
    assert result["pointer_translation"] == {
        "browser": "EDGE32 x,y,after-mask,one-hot-changed-mask",
        "native": "mouse_event(x,y,changed-button-selector)",
        "selector": {"motion": 0, "tail": 1, "middle": 2, "head": 3},
        "examples": [
            {"x": 0, "y": 0, "buttons_after": 0, "changed_mask": 0,
             "native_button_selector": 0},
            {"x": 1, "y": 2, "buttons_after": 1, "changed_mask": 1,
             "native_button_selector": 1},
            {"x": 3, "y": 4, "buttons_after": 2, "changed_mask": 2,
             "native_button_selector": 2},
            {"x": 5, "y": 6, "buttons_after": 4, "changed_mask": 4,
             "native_button_selector": 3},
        ],
    }
    blocked = subprocess.run([
        "python3", str(oracle), "native-capture", "--prepared", prepared,
        "--config", "missing.ini", "--output", "missing-output",
        "--session-id", "test", "--private-disk-instance-id", "disk",
        "--input-script", "missing-script", "--campaign", "missing-campaign",
    ], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
    assert blocked.returncode == 2, blocked.stderr + blocked.stdout
    assert json.loads(blocked.stdout) == {
        "status": "invalid", "operation": "native-capture",
        "error": "explicit --execute is required before a private native runtime may start",
    }
    captured = subprocess.run([
        "python3", "-c", """
import importlib.util
import json
import sys
from unittest.mock import patch

path = sys.argv[1]
specification = importlib.util.spec_from_file_location("m8_m9_cli_exit", path)
module = importlib.util.module_from_spec(specification)
specification.loader.exec_module(module)
with patch.object(module, "native_capture", return_value={
        "status": "captured", "operation": "native-capture", "metadata": {}}):
    raise SystemExit(module.main([
        "native-capture", "--prepared", "unused-prepared", "--config", "unused-config",
        "--output", "unused-output", "--session-id", "test", "--private-disk-instance-id", "disk",
        "--input-script", "unused-script", "--campaign", "unused-campaign", "--execute",
    ]))
""", str(oracle)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, check=False)
    assert captured.returncode == 0, captured.stderr + captured.stdout
    assert json.loads(captured.stdout) == {
        "status": "captured", "operation": "native-capture", "metadata": {},
    }


def main() -> None:
    compile_and_run("input-witness", [TESTS / "cadr_m8_m9_input_witness_harness.c",
                                        NATIVE / "cadr_m8_m9_input_witness.c"], "input.cdrm8n1")
    compile_and_run("input-driver", [TESTS / "cadr_m8_m9_input_driver_harness.c",
                                       NATIVE / "cadr_m8_m9_input_driver.c"], "input.txt")
    patch = (ROOT / "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch").read_text()
    assert "cadr_m8_m9_input_witness_keyboard(machine_cycles, iob_csr" in patch
    assert "cadr_m8_m9_input_witness_pointer(machine_cycles, iob_csr" in patch
    assert "cadr_m8_m9_input_driver_boundary(machine_cycles)" in patch
    assert "cadr_m8_m9_input_driver_complete()" in patch
    assert patch.count("cadr_m8_m9_input_driver_dispatch_active() &&") == 4
    assert "cadr_m8_m9_input_driver_dispatch_active(void)" in (
        NATIVE / "cadr_m8_m9_input_driver.h").read_text()
    assert "m8-m9-input-oracle" in patch
    prepared = f"build/cadr-oracle/m8-m9-native-test-{uuid.uuid4().hex}"
    oracle = ROOT / "scripts/cadr-m8-m9-native-input-oracle.py"
    prepared_path = ROOT / prepared
    try:
        exercise_prepared_oracle(prepared, oracle)
    finally:
        remove_prepared_tree(prepared_path)


if __name__ == "__main__":
    main()
