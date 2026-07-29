#!/usr/bin/env python3
"""Produce one atomic native M6 DEBUG-IR capture, or record the older probe.

The capture path uses only the native guest boundary witness: it materializes
fresh, verified private copies of the canonical config, PROM, symbols, hosts,
and disk, dispatches the frozen raw-Cadet schedule against those copies, and
publishes exactly the three files accepted by the strict three-run verifier.
It never treats a screenshot or a wait as evidence.
"""
from __future__ import annotations

import argparse
import configparser
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Any
import uuid


ROOT = Path(__file__).resolve().parents[1]
PROBE_SOURCE = ROOT / "cadr-web/oracle/native/cadr_m6_listener_probe.c"
PROBE_HEADER = ROOT / "cadr-web/oracle/native/cadr_m6_listener_probe.h"
DEFAULT_OUTPUT = Path("build/cadr-oracle/m6-native-listener-probe.json")
CAPTURE_SCHEMA = "cadr-m6-native-debug-ir-capture-bundle-v1"
CAPTURE_CONTRACT = "C-M6-DEBUG-IR-LISTENER-READY-ABC-v1"
CAPTURE_TARGET = "CADR-WEB-303/ABI1.4/protocol-v4/M6"
RAW_SCHEMA = "cadr-m6-native-raw-v2"
CLOCK_POLICY = "C-M6-CEIL-N-1000000-OVER-60-GUEST-BOUNDARY-v1"
CLOCK_FORMULA = "due(n)=ceil(n*1000000/60), n=1..event_count"
SCHEDULE_SCRIPT = ROOT / "scripts/cadr-m6-witness-schedule.py"
PROFILE = ROOT / "cadr-web/profiles/cadr-web-303.json"
ABI_ARTIFACTS = ((1, "cadr-web-303-runnable-template"),
                 (2, "prom-control-store"), (4, "prom-symbols"),
                 (5, "microcode-symbols"), (3, "system-303-0-base-disk"))
NATIVE_INPUTS = ("usite-extra-hosts",)
EXECUTION_ENVIRONMENT = {
    "policy_id": "cadr-m6-native-minimal-environment-v1",
    "inherited": False,
    "variables": {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"},
}
SCHEDULE = [
    "fresh private runtime", "mouse move 0,0", "wait 25 seconds",
    "Return", "wait 2 seconds", "N Return", "wait 6 seconds", "mouse move 0,0",
]


class ProbeError(ValueError):
    pass


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def regular(path: Path, field: str) -> Path:
    if not path.is_file() or path.is_symlink():
        raise ProbeError(f"{field} must be a regular non-symlink file")
    return path


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(regular(path, "run record").read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ProbeError("run record is not JSON") from exc
    if not isinstance(value, dict):
        raise ProbeError("run record must be an object")
    return value


def load_schedule_module() -> Any:
    spec = importlib.util.spec_from_file_location("cadr_m6_schedule", SCHEDULE_SCRIPT)
    if spec is None or spec.loader is None:
        raise ProbeError("cannot load the frozen M6 schedule generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def regular_directory(path: Path, field: str) -> Path:
    if not path.is_dir() or path.is_symlink():
        raise ProbeError(f"{field} must be a regular non-symlink directory")
    return path.resolve()


def load_capture_inputs(config: Path) -> tuple[list[Path], Path]:
    parser = configparser.ConfigParser(interpolation=None)
    try:
        with config.open("r", encoding="utf-8") as stream:
            parser.read_file(stream)
        inputs = [Path(parser["ucode"]["prommcr_filename"]),
                  Path(parser["ucode"]["promsym_filename"]),
                  Path(parser["ucode"]["mcrsym_filename"]),
                  Path(parser["chaos"]["hosts"])]
        disk = Path(parser["disk"]["disk0"].split(",", 1)[1])
    except (OSError, KeyError, IndexError, configparser.Error) as exc:
        raise ProbeError(f"cannot identify native M6 inputs from configuration: {exc}") from exc
    return [regular(path, "native M6 input") for path in inputs], regular(disk, "native M6 base disk")


def copy_verified(source: Path, destination: Path, expected: dict[str, Any], field: str) -> Path:
    """Copy one canonical input and fail unless source and private bytes agree."""
    source = regular(source, field)
    if destination.exists() or destination.is_symlink():
        raise ProbeError(f"refusing to replace private {field}: {destination}")
    byte_count = source.stat().st_size
    digest = sha256_file(source)
    if (byte_count != int(expected["byte_count"]) or
            digest != expected["sha256"]):
        raise ProbeError(f"{field} differs from the selected canonical input")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    private = regular(destination, f"private {field}")
    if private.stat().st_size != byte_count or sha256_file(private) != digest:
        raise ProbeError(f"private {field} copy does not match canonical bytes")
    return private


def copy_private_executable(source: Path, runtime: Path, expected_sha256: str) -> Path:
    """Materialize the checked oracle binary inside the fresh private runtime."""
    source = regular(source, "native M6 executable")
    source_mode = source.stat().st_mode & 0o777
    if source_mode & 0o111 == 0:
        raise ProbeError("native M6 executable has no execute permission")
    source_size = source.stat().st_size
    private = copy_verified(source, runtime / "usim", {
        "byte_count": str(source_size), "sha256": expected_sha256,
    }, "native M6 executable")
    os.chmod(private, source_mode)
    private_mode = private.stat().st_mode & 0o777
    if private_mode != source_mode or private_mode & 0o111 == 0:
        raise ProbeError("private native M6 executable is not executable")
    return private


def execute_private_m6(runtime: Path, executable: Path, config: Path,
                       environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
    """Execute only the private executable and configuration of this runtime."""
    executable = regular(executable, "private native M6 executable")
    if executable.parent != runtime or executable.stat().st_mode & 0o111 == 0:
        raise ProbeError("native M6 execution escaped the private runtime")
    config = regular(config, "private native M6 configuration")
    if config.parent != runtime:
        raise ProbeError("native M6 configuration escaped the private runtime")
    return subprocess.run([str(executable), "-c", str(config)], text=True,
                          capture_output=True, env=environment, timeout=120,
                          check=False)


def native_execution_environment(schedule: Path, raw: Path, idle: Path,
                                 session_id: str) -> dict[str, str]:
    """Return the entire child environment; never inherit a host variable."""
    return {
        **EXECUTION_ENVIRONMENT["variables"],
        "CADR_M6_RAW_SCHEDULE": str(schedule),
        "CADR_M6_NATIVE_LOG": str(raw),
        "CADR_M6_IDLE_SAMPLES": str(idle),
        "CADR_M6_SESSION_ID": session_id,
    }


def render_private_config(template: Path, fs_root: Path, private_disk: Path,
                          runtime: Path, output: Path) -> None:
    """Render only the tracked canonical template with private runtime paths."""
    source = regular(template, "private CADR-WEB runnable template").read_text(encoding="utf-8")
    bindings = {
        "@RUNTIME@": str(runtime),
        "@FS_ROOT@": str(fs_root),
        "@STATE@": str(runtime / "usim.state"),
        "@SCREENSHOT@": str(runtime / "final-framebuffer.pbm"),
        "@DISK@": str(private_disk),
    }
    rendered = source
    for token, value in bindings.items():
        if token not in rendered:
            raise ProbeError(f"canonical M6 template omits {token}")
        rendered = rendered.replace(token, value)
    if re.search(r"@[A-Z_]+@", rendered):
        raise ProbeError("private M6 configuration retains a template placeholder")
    output.write_text(rendered, encoding="utf-8", newline="\n")


def assert_private_execution_config(config: Path, fs_root: Path,
                                    private_disk: Path, runtime: Path) -> None:
    parser = configparser.ConfigParser(interpolation=None)
    try:
        with regular(config, "private native M6 configuration").open("r", encoding="utf-8") as stream:
            parser.read_file(stream)
        disk = parser["disk"]["disk0"].split(",", 1)
        values = {
            "fs_root": parser["usim"]["fs_root_directory"],
            "state": parser["usim"]["state_filename"],
            "screenshot": parser["usim"]["screenshot_filename"],
            "prom": parser["ucode"]["prommcr_filename"],
            "prom_symbols": parser["ucode"]["promsym_filename"],
            "microcode_symbols": parser["ucode"]["mcrsym_filename"],
            "hosts": parser["chaos"]["hosts"],
            "disk_prefix": disk[0], "disk": disk[1],
        }
    except (KeyError, IndexError, configparser.Error) as exc:
        raise ProbeError(f"private M6 configuration is incomplete: {exc}") from exc
    expected = {
        "fs_root": str(fs_root), "state": str(runtime / "usim.state"),
        "screenshot": str(runtime / "final-framebuffer.pbm"),
        "prom": str(fs_root / "sys/ubin/promh.mcr"),
        "prom_symbols": str(fs_root / "sys/ubin/promh.sym"),
        "microcode_symbols": str(fs_root / "sys/ubin/ucadr.sym"),
        "hosts": str(fs_root / "usite/extra.hosts"),
        "disk_prefix": "T-300", "disk": str(private_disk),
    }
    if values != expected:
        raise ProbeError("private M6 configuration does not execute only private inputs")


def profile_inputs(profile: dict[str, Any], paths: list[Path], disk: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Bind native capture inputs to the portable ABI and native-only host file.

    The native configuration contains PROM, symbol, microcode, Chaos-hosts and
    disk paths.  Only the first three plus the disk are CADR-WEB artifact
    ingress; the fixed runnable template is artifact kind 1.  Chaos hosts is
    still an input to this native observation, but never masquerades as a
    portable artifact kind.
    """
    if len(paths) != 4:
        raise ProbeError("native M6 configuration did not supply four non-disk inputs")
    inventory = profile.get("artifacts")
    if not isinstance(inventory, list):
        raise ProbeError("CADR-WEB profile has no artifact inventory")
    entries = {item.get("id"): item for item in inventory if isinstance(item, dict)}
    actual = {
        "cadr-web-303-runnable-template": regular(
            ROOT / "cadr-web/profiles/cadr-web-303.ini.in", "CADR-WEB runnable template"),
        "prom-control-store": paths[0],
        "prom-symbols": paths[1],
        "microcode-symbols": paths[2],
        "usite-extra-hosts": paths[3],
        "system-303-0-base-disk": disk,
    }

    def checked(identifier: str) -> dict[str, Any]:
        entry = entries.get(identifier)
        path = actual[identifier]
        byte_count = path.stat().st_size
        digest = sha256_file(path)
        if (not isinstance(entry, dict) or entry.get("bytes") != byte_count or
                entry.get("sha256") != digest):
            raise ProbeError(f"CADR-WEB profile disagrees with native M6 input {identifier}")
        return {"id": identifier, "byte_count": str(byte_count), "sha256": digest}

    artifact_records = []
    for kind, identifier in ABI_ARTIFACTS:
        record = checked(identifier)
        artifact_records.append({"kind": kind, "byte_count": record["byte_count"],
                                 "sha256": record["sha256"]})
    return artifact_records, [checked(identifier) for identifier in NATIVE_INPUTS]


def native_capture(prepared: Path, config: Path, output: Path, *,
                   session_id: str | None = None,
                   private_disk_instance_id: str | None = None) -> dict[str, Any]:
    """Run one fresh native session and atomically publish its raw-v2 bundle."""
    prepared = regular_directory(prepared, "prepared native M6 tree")
    config = regular(config, "native M6 configuration")
    output = output.resolve()
    if output.exists() or output.is_symlink() or output.parent.is_symlink():
        raise ProbeError("native M6 bundle output must not already exist")
    output.parent.mkdir(parents=True, exist_ok=True)
    prepare = read_json(prepared / "prepare.json")
    build = read_json(prepared / "build.json")
    if prepare.get("schema") != "cadr-oracle-prepare" or build.get("schema") != "cadr-oracle-build":
        raise ProbeError("prepared native M6 tree lacks checked prepare/build records")
    executable = regular(prepared / "source/usim/usim", "native M6 executable")
    executable_sha256 = sha256_file(executable)
    if executable_sha256 != build.get("sha256"):
        raise ProbeError("prepared native M6 executable hash differs from its build record")
    patch = prepare.get("instrumentation_patch")
    if not isinstance(patch, dict) or not isinstance(patch.get("sha256"), str):
        raise ProbeError("prepared native M6 patch identity is absent")
    profile = read_json(PROFILE)
    pins = profile.get("source_pins")
    if not isinstance(pins, dict):
        raise ProbeError("CADR-WEB profile has no source pins")
    mapping = load_schedule_module()
    frozen = mapping.schedule()
    input_paths, base_disk = load_capture_inputs(config)
    artifact_records, native_input_records = profile_inputs(profile, input_paths, base_disk)
    artifact_by_kind = {record["kind"]: record for record in artifact_records}
    generated_session = session_id or f"m6-{uuid.uuid4().hex}"
    generated_disk_id = private_disk_instance_id or f"m6-disk-{uuid.uuid4().hex}"
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", generated_session):
        raise ProbeError("native M6 session id has unsupported characters")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", generated_disk_id):
        raise ProbeError("native M6 private disk id has unsupported characters")
    stage: Path | None = None
    try:
        with tempfile.TemporaryDirectory(prefix=".m6-runtime-", dir=output.parent) as temporary:
            runtime = Path(temporary)
            fs_root = runtime / "fs-root"
            private_template = runtime / "inputs/cadr-web-303.ini.in"
            private_disk = runtime / "disk-sys-303-0.img"
            rendered_config = runtime / "usim.ini"
            native_schedule = runtime / "schedule.txt"
            raw = runtime / "capture.ndjson"
            idle = runtime / "idle.bin"
            private_executable = copy_private_executable(executable, runtime,
                                                         executable_sha256)
            copy_verified(ROOT / "cadr-web/profiles/cadr-web-303.ini.in",
                          private_template, artifact_by_kind[1], "M6 config template")
            copy_verified(input_paths[0], fs_root / "sys/ubin/promh.mcr",
                          artifact_by_kind[2], "M6 control-store PROM")
            copy_verified(input_paths[1], fs_root / "sys/ubin/promh.sym",
                          artifact_by_kind[4], "M6 PROM symbols")
            copy_verified(input_paths[2], fs_root / "sys/ubin/ucadr.sym",
                          artifact_by_kind[5], "M6 microcode symbols")
            copy_verified(input_paths[3], fs_root / "usite/extra.hosts",
                          native_input_records[0], "M6 Chaos hosts")
            copy_verified(base_disk, private_disk, artifact_by_kind[3],
                          "M6 base disk")
            disk_before = sha256_file(private_disk)
            if disk_before != artifact_by_kind[3]["sha256"]:
                raise ProbeError("private M6 disk does not equal artifact kind 3")
            render_private_config(private_template, fs_root, private_disk, runtime,
                                  rendered_config)
            assert_private_execution_config(rendered_config, fs_root, private_disk,
                                            runtime)
            mapping.write_native(frozen, native_schedule)
            environment = native_execution_environment(
                native_schedule, raw, idle, generated_session)
            completed = execute_private_m6(runtime, private_executable, rendered_config,
                                            environment)
            if completed.returncode != 0:
                raise ProbeError(f"native M6 executable exited {completed.returncode}: {completed.stderr[-1000:]}")
            disk_after = sha256_file(private_disk)
            if disk_before != disk_after:
                raise ProbeError("fresh native M6 private disk changed during capture")
            if disk_after != artifact_by_kind[3]["sha256"]:
                raise ProbeError("private M6 disk no longer equals artifact kind 3")
            raw_lines = regular(raw, "native M6 raw transcript").read_text(encoding="utf-8").splitlines()
            if not raw_lines:
                raise ProbeError("native M6 raw transcript is empty")
            try:
                raw_meta, raw_complete = json.loads(raw_lines[0]), json.loads(raw_lines[-1])
            except json.JSONDecodeError as exc:
                raise ProbeError("native M6 raw transcript is not JSON") from exc
            if (raw_meta != {"kind": "meta", "schema": RAW_SCHEMA,
                             "schedule_sha256": frozen["schedule"]["sha256"],
                             "schedule_events": frozen["schedule"]["event_count"],
                             "session_id": generated_session} or
                    raw_complete != {"kind": "complete", "clean_shutdown": True,
                                     "schedule_consumed": frozen["schedule"]["event_count"],
                                     "debug_ir_writes": 9}):
                raise ProbeError("native M6 raw-v2 endpoints do not bind the selected session and schedule")
            metadata = {
                "schema": CAPTURE_SCHEMA, "contract": CAPTURE_CONTRACT, "target": CAPTURE_TARGET,
                "identities": {"system_fossil": pins["sys"]["revision"],
                               "usim_fossil": pins["usim"]["revision"],
                               "oracle_patch_sha256": patch["sha256"],
                               "native_executable_sha256": executable_sha256,
                               "cadet_mapping_sha256": frozen["mapping"]["sha256"]},
                "artifacts": artifact_records,
                "native_inputs": native_input_records,
                "execution_environment": EXECUTION_ENVIRONMENT,
                "forms": frozen["forms"], "schedule": frozen["schedule"],
                "timing": frozen["timing"],
                "listener_idle_observer": {
                    "schema": "cadr-m6-listener-idle-observer-v1",
                    "spawner": "process-run-function",
                    "wait": "process-wait-for-lisp-listener-idle",
                    "critical_section": "without-interrupts",
                    "source_form": "b", "marker_form": "c",
                    "identity_checks": ["initial-lisp-listener", "selected-window",
                                        "lisp-listener-type", "exposed", "owner-process",
                                        "owner-stack-group", "lisp-listener-idle"],
                    "nonclaims": ["tagged-pointer-identity", "read-for-top-level", "input-empty"],
                    "cleanup": {"hold_boundaries": "1000000",
                                "stable_invariants": ["debug-ir-c", "keyboard-all-up",
                                                      "keyboard-fifo-empty", "iob-cclk-clear",
                                                      "disk-not-busy", "host-no-request"],
                                "residual_nonclaim": "observer-process-inactivity-not-decoded"},
                },
                "clock_policy": {"policy_id": CLOCK_POLICY, "formula": CLOCK_FORMULA,
                                 "numerator": 1_000_000, "denominator": 60,
                                 "source": "guest-boundary"},
                "host": {"request_pending": 0, "completion_queued": 0,
                         "outstanding_request_id": 0},
                "session_id": generated_session,
                "private_disk_instance_id": generated_disk_id,
                "private_disk_sha256_at_start": disk_before,
                "private_disk_sha256_at_end": disk_after,
                "forced_stop": False, "state_may_be_incomplete": False,
                "unexpected_input_count": 0, "forbidden_debug_write_count": 0,
            }
            stage = Path(tempfile.mkdtemp(prefix=".m6-bundle-", dir=output.parent))
            (stage / "metadata.json").write_bytes(canonical(metadata))
            shutil.copyfile(raw, stage / "capture.ndjson")
            shutil.copyfile(idle, stage / "idle.bin")
            if {entry.name for entry in stage.iterdir()} != {"metadata.json", "capture.ndjson", "idle.bin"}:
                raise ProbeError("native M6 bundle has an unexpected sidecar")
        os.replace(stage, output)
        stage = None
        return {"status": "captured", "output": str(output), "session_id": generated_session,
                "private_disk_instance_id": generated_disk_id, "schedule_sha256": frozen["schedule"]["sha256"]}
    except subprocess.TimeoutExpired as exc:
        raise ProbeError("native M6 executable exceeded 120 seconds") from exc
    finally:
        if stage is not None:
            shutil.rmtree(stage, ignore_errors=True)


def compile_probe(destination: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="cadr-m6-probe-") as temporary:
        fixture = Path(temporary) / "probe.c"
        fixture.write_text(
            "#include <stdio.h>\n"
            "#include \"cadr_m6_listener_probe.h\"\n"
            "int main(void) {\n"
            "  unsigned int s = cadr_m6_listener_probe(0);\n"
            "  puts(cadr_m6_listener_probe_status_name(s)); return s == 3 ? 0 : 1;\n"
            "}\n",
            encoding="ascii",
        )
        completed = subprocess.run(
            ["cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic",
             "-I", str(PROBE_HEADER.parent), "-o", str(destination), str(fixture),
             str(PROBE_SOURCE)], text=True, capture_output=True, check=False,
        )
    if completed.returncode:
        raise ProbeError("cannot compile M6 listener probe: " + completed.stderr.strip())


def record(run_directory: Path, output: Path) -> dict[str, Any]:
    run_directory = run_directory.resolve()
    run = read_json(run_directory / "run.json")
    runtime = run.get("runtime")
    if not isinstance(runtime, dict):
        raise ProbeError("run record has no runtime object")
    state = regular(Path(str(runtime.get("state", ""))), "saved native state")
    config = regular(Path(str(runtime.get("config", ""))), "rendered native configuration")
    disk = regular(Path(str(run.get("session_disk", ""))), "private session disk")
    if run.get("status") != "stopped" or run.get("resumed") is not False:
        raise ProbeError("M6 probe requires a stopped non-resumed cold-boot session")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cadr-m6-probe-bin-") as temporary:
        executable = Path(temporary) / "cadr-m6-listener-probe"
        compile_probe(executable)
        completed = subprocess.run([str(executable)], text=True, capture_output=True, check=False)
    if completed.returncode or completed.stdout.strip() != "blocked-no-object-decoder":
        raise ProbeError("M6 probe did not fail closed for the absent object decoder")
    result = {
        "schema": "cadr-m6-native-listener-oracle-v1",
        "status": "blocked",
        "run": {
            "session": run.get("session"), "generation": run.get("generation"),
            "load_band": run.get("load_band"), "usim_sha256_at_start": run.get("usim_sha256_at_start"),
            "usim_sha256_at_exec": run.get("usim_sha256_at_exec"),
            "base_disk_sha256": run.get("base_disk_sha256"),
            "private_disk_sha256_at_start": run.get("session_disk_sha256_at_start"),
            "forced_stop": run.get("forced_stop"),
            "state_may_be_incomplete": run.get("state_may_be_incomplete"),
        },
        "inputs": {
            "rendered_config": {"bytes": config.stat().st_size, "sha256": sha256_file(config)},
            "private_disk_after_stop": {"bytes": disk.stat().st_size, "sha256": sha256_file(disk)},
            "saved_state_after_stop": {"bytes": state.stat().st_size, "sha256": sha256_file(state)},
            "probe_source": {"sha256": sha256_file(PROBE_SOURCE)},
            "probe_header": {"sha256": sha256_file(PROBE_HEADER)},
        },
        "boot_input_schedule": SCHEDULE,
        "semantic_conjunction": {
            "source_anchors": [
                "l/sys/window/baswin.lisp:1603-1621",
                "l/sys/io/read.lisp.441:504-519",
            ],
            "predicate": [
                "The exact tagged-object identity bound to TV:INITIAL-LISP-LISTENER is selected and exposed.",
                "That exact object is a LISP-LISTENER and :LISP-LISTENER-P returns :IDLE.",
                "Its owner process and stack group are live; its decoded PC or stack is in SI:READ-FOR-TOP-LEVEL.",
                "Its decoded input buffer is empty and contains no partial form.",
                "The boot-prompt phase was accepted by the guest.",
                "The boundary oracle confirms a quiescent suffix with disk_busy=false and host_request_pending=false.",
            ],
            "first_satisfaction_boundary": None,
            "quiescent_suffix": None,
        },
        "blockers": [
            "No pinned System 303 object layout maps TV:INITIAL-LISP-LISTENER to a tagged-object identity and selected/exposed window state in a native boundary snapshot.",
            "The current native oracle exposes canonical machine/device state, not Lisp object decoding, listener ownership, process-stack-group liveness, or PC/stack symbols.",
            "The current native oracle cannot decode the listener input buffer, distinguish a partial form, prove guest boot-prompt acceptance, or derive a quiescent suffix.",
            "The saved usim state is post-stop only; searching it for labels or framebuffer bytes would not establish the predicate.",
        ],
        "nonclaims": [
            "No framebuffer, screenshot label, fixed wait, window title, or host boot marker was used as Listener evidence.",
            "This blocked record does not claim a first Listener-ready boundary or a quiescent suffix.",
        ],
    }
    temporary_output = output.with_name("." + output.name + ".tmp")
    temporary_output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary_output.replace(output)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-directory", type=Path,
                        help="record the historical fail-closed Listener probe")
    parser.add_argument("--prepared", type=Path,
                        help="prepared and built m6-oracle source closure for an atomic capture")
    parser.add_argument("--config", type=Path,
                        help="cold-boot native configuration whose disk is copied privately")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--session-id")
    parser.add_argument("--private-disk-instance-id")
    arguments = parser.parse_args(argv)
    try:
        wants_capture = arguments.prepared is not None or arguments.config is not None
        if wants_capture:
            if arguments.run_directory is not None or arguments.prepared is None or arguments.config is None:
                parser.error("native capture requires --prepared and --config, without --run-directory")
            result = native_capture(arguments.prepared, arguments.config, arguments.output,
                                    session_id=arguments.session_id,
                                    private_disk_instance_id=arguments.private_disk_instance_id)
        else:
            if arguments.run_directory is None:
                parser.error("--run-directory is required for the Listener probe")
            result = record(arguments.run_directory, arguments.output)
    except (OSError, ProbeError) as exc:
        print(json.dumps({"schema": "cadr-m6-native-capture-result-v1", "status": "invalid", "error": str(exc)}, sort_keys=True))
        return 2
    response = {"status": result["status"], "output": str(arguments.output)}
    response.update({key: result[key]
                     for key in ("session_id", "private_disk_instance_id", "schedule_sha256")
                     if key in result})
    print(json.dumps(response, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
