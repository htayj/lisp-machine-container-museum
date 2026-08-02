#!/usr/bin/env python3
"""Prepare and build the inert, pinned M8/M9 native pre-IOB input oracle.

This never launches a Lisp-machine session.  It extends the verified M7/M6
disposable source closure with one additional exact patch.  A later campaign
must create a fresh ignored 0700 directory, materialize the frozen M6 inputs,
and supply both explicit M8/M9 sidecar paths; the patch records keyboard and
pointer arguments before their native functions mutate IOB state.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import Any


ROOT = Path(os.environ.get(
    "CADR_M8_M9_REPOSITORY_ROOT", Path(__file__).resolve().parents[1])).resolve()
PROGRAM_ROOT = Path(os.environ.get(
    "CADR_M8_M9_PYTHON_PROGRAM_ROOT", ROOT)).resolve()
PATCH = Path("cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch")
SUPPORT = (
    Path("cadr-web/oracle/native/cadr_m8_m9_input_witness.c"),
    Path("cadr-web/oracle/native/cadr_m8_m9_input_witness.h"),
    Path("cadr-web/oracle/native/cadr_m8_m9_input_driver.c"),
    Path("cadr-web/oracle/native/cadr_m8_m9_input_driver.h"),
)
DEFAULT_PREPARED = "build/cadr-oracle/m8-m9-x11-prepared-v4"
PREPARE_MARKER = "m8-m9-input-prepare.json"
BUILD_MARKER = "m8-m9-input-build.json"
SUCCESS = frozenset(("ok", "planned", "captured"))
NATIVE_CAPTURE_SCHEMA = "cadr-m8-m9-native-input-capture-v1"
CAMPAIGN_SCHEMA = "cadr-m8-m9-input-campaign-v1"
NATIVE_SCRIPT_SCHEMA = "CADR-M8-M9-INPUT-v1"
NATIVE_RECORD_SCHEMA = b"CDRM8N1"
NATIVE_RECORD_BYTES = 64


class M8M9OracleError(ValueError):
    """The disposable input-oracle closure is incomplete or has drifted."""


def load_m7() -> Any:
    path = PROGRAM_ROOT / "scripts/cadr-m7-native-frame-oracle.py"
    specification = importlib.util.spec_from_file_location("cadr_m8_m9_m7_base", path)
    if specification is None or specification.loader is None:
        raise M8M9OracleError("cannot load the pinned M7 source-closure preparer")
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


M7 = load_m7()
BASE = M7.BASE


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tool_identity(name: str, version_arguments: tuple[str, ...] = ("--version",)) -> dict[str, Any]:
    found = shutil.which(name)
    if found is None:
        raise M8M9OracleError(f"required build tool {name} is not on PATH")
    path = Path(found).resolve()
    if not path.is_file():
        raise M8M9OracleError(f"required build tool {name} is not a regular file")
    completed = subprocess.run([str(path), *version_arguments], stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, check=False,
                               env={"LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                                    "PATH": os.environ.get("PATH", "")})
    if completed.returncode != 0:
        raise M8M9OracleError(f"cannot identify build tool {name}")
    return {"name": name, "path": str(path), "bytes": path.stat().st_size,
            "sha256": sha256(path), "version_argv": [str(path), *version_arguments],
            "version_output": completed.stdout.strip()}


def python_identity() -> dict[str, Any]:
    """Identify the host Python used to prepare or build an inert closure."""
    executable = Path(sys.executable).resolve()
    return {"path": str(executable), "bytes": executable.stat().st_size,
            "sha256": sha256(executable), "version": sys.version,
            "implementation": sys.implementation.name}


def runtime_python_identity() -> dict[str, Any]:
    """Bind Python to the inherited fd-3 execution object without host paths."""
    try:
        captured = sys._CADR_CAPTURED_PYTHON_IDENTITY
    except AttributeError:
        captured = None
    if isinstance(captured, dict):
        return dict(captured)
    try:
        descriptor = os.fstat(3)
    except OSError as exc:
        raise M8M9OracleError("M8/M9 native capture requires inherited Python descriptor 3") from exc
    if not sys.executable:
        raise M8M9OracleError("M8/M9 native capture Python has no executable identity")

    def identity(path: Path, label: str, reference: str) -> dict[str, Any]:
        try:
            information = path.stat()
            raw = path.read_bytes()
        except OSError as exc:
            raise M8M9OracleError(f"M8/M9 native capture cannot read {label}") from exc
        if (not stat.S_ISREG(information.st_mode) or information.st_dev != descriptor.st_dev or
                information.st_ino != descriptor.st_ino):
            raise M8M9OracleError(f"M8/M9 native capture {label} differs from inherited descriptor 3")
        return {"reference": reference, "bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "device": str(information.st_dev), "inode": str(information.st_ino)}

    from_sys = identity(Path(sys.executable), "sys.executable", "sys-executable")
    from_proc = identity(Path("/proc/self/exe"), "proc-self-exe", "proc-self-exe")
    for field in ("bytes", "sha256", "device", "inode"):
        if from_sys[field] != from_proc[field]:
            raise M8M9OracleError("M8/M9 native capture Python identity is internally inconsistent")
    return {"schema": "cadr-m8-m9-python-identity-v1", "inherited_fd": 3,
            **{field: from_sys[field] for field in ("bytes", "sha256", "device", "inode")},
            "sys_executable": from_sys, "proc_self_exe": from_proc,
            "version": sys.version, "implementation": sys.implementation.name}


def runtime_program_identity() -> dict[str, Any]:
    """Bind the root oracle bytes consumed once from inherited pipe 4."""
    try:
        captured = sys._CADR_CAPTURED_PROGRAM_IDENTITY
    except AttributeError:
        captured = None
    if isinstance(captured, dict):
        return dict(captured)
    try:
        descriptor = os.fstat(4)
        raw = Path("/proc/self/fd/4").read_bytes()
    except OSError as exc:
        raise M8M9OracleError(
            "M8/M9 native capture requires inherited oracle-program descriptor 4") from exc
    if not stat.S_ISREG(descriptor.st_mode):
        raise M8M9OracleError("M8/M9 oracle-program descriptor 4 is not regular")
    return {"schema": "cadr-m8-m9-python-program-identity-v1", "inherited_fd": 4,
            "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
            "device": str(descriptor.st_dev), "inode": str(descriptor.st_ino)}


def marker(prepared: Path, name: str) -> dict[str, Any]:
    path = prepared / name
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise M8M9OracleError(f"missing or invalid {name}") from exc
    if not isinstance(value, dict):
        raise M8M9OracleError(f"invalid {name}")
    return value


def prepared_source(prepared_value: str) -> tuple[Path, Path, dict[str, Any]]:
    prepared = BASE.output_path(ROOT, prepared_value)
    source = prepared / "source/usim"
    value = marker(prepared, PREPARE_MARKER)
    if value.get("schema") != "cadr-m8-m9-input-prepare-v1":
        raise M8M9OracleError("M8/M9 prepared marker has the wrong schema")
    if value.get("m8_m9_patch", {}).get("sha256") != sha256(ROOT / PATCH):
        raise M8M9OracleError("M8/M9 prepared marker is stale relative to the tracked patch")
    tree, entries = BASE.prepared_source_identity(prepared)
    if (tree != value.get("prepared_source_tree_sha256") or
            len(entries) != value.get("prepared_source_file_count")):
        raise M8M9OracleError("prepared source closure drifted")
    if not source.is_dir() or source.is_symlink():
        raise M8M9OracleError("prepared usim source is unavailable")
    return prepared, source, value


def edge32_to_native_pointer(edge32: int) -> dict[str, int]:
    """Freeze the browser EDGE32 to native ``mouse_event`` argument adapter.

    Native ``mouse_event(x, y, buttons)`` receives 0 for a motion and 1, 2, or
    3 for the tail/middle/head *changed-button selector*.  EDGE32 instead
    carries the post-event bit mask and one-hot changed mask.  This function is
    deliberately part of the campaign record, not an inference a later runner
    may make while comparing output.
    """
    if not isinstance(edge32, int) or edge32 < 0 or edge32 > 0xffffffff:
        raise M8M9OracleError("EDGE32 must be one unsigned 32-bit integer")
    x = edge32 & 0x3ff
    y = (edge32 >> 10) & 0x3ff
    after = (edge32 >> 20) & 0x7
    changed = (edge32 >> 23) & 0x7
    if edge32 & 0xf0000000 or x >= 768 or y >= 963:
        raise M8M9OracleError("EDGE32 coordinate or reserved bits are invalid")
    if changed != 0 and (changed & (changed - 1)) != 0:
        raise M8M9OracleError("EDGE32 changed mask must be one-hot or zero")
    selector = 0 if changed == 0 else changed.bit_length()
    return {"x": x, "y": y, "buttons_after": after,
            "changed_mask": changed, "native_button_selector": selector}


def owned_regular(path: Path, label: str, mode: int = 0o600) -> Path:
    information = path.lstat()
    if (not path.is_file() or path.is_symlink() or information.st_uid != os.geteuid() or
            information.st_nlink != 1 or (information.st_mode & 0o7777) != mode):
        raise M8M9OracleError(f"{label} must be an owned singly linked {mode:o} regular file")
    return path


def validate_campaign_inputs(script_value: str, campaign_value: str) -> tuple[Path, Path, dict[str, Any], list[tuple[int, str, int, int, int]]]:
    script = owned_regular(Path(script_value).resolve(), "M8/M9 native input script")
    campaign = owned_regular(Path(campaign_value).resolve(), "M8/M9 campaign manifest")
    try:
        manifest = json.loads(campaign.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise M8M9OracleError("M8/M9 campaign manifest is not UTF-8 JSON") from exc
    required = {"schema", "key_count", "native_row_count", "browser_record_count", "input_script_sha256"}
    if not isinstance(manifest, dict) or set(manifest) != required or manifest.get("schema") != CAMPAIGN_SCHEMA:
        raise M8M9OracleError("M8/M9 campaign manifest has the wrong schema")
    if (manifest.get("key_count") != 100 or manifest.get("native_row_count") != 207 or
            manifest.get("browser_record_count") != 208 or
            not isinstance(manifest.get("input_script_sha256"), str) or
            not re.fullmatch(r"[0-9a-f]{64}", manifest["input_script_sha256"]) or
            sha256(script) != manifest["input_script_sha256"]):
        raise M8M9OracleError("M8/M9 campaign does not bind the complete pinned input script")
    lines = script.read_text(encoding="ascii").splitlines()
    if not lines or lines[0] != NATIVE_SCRIPT_SCHEMA or len(lines) != 208:
        raise M8M9OracleError("M8/M9 input script has the wrong header or row count")
    rows: list[tuple[int, str, int, int, int]] = []
    prior = -1
    for line in lines[1:]:
        fields = line.split()
        if len(fields) != 5 or not fields[0].isdigit() or fields[1] not in {"keyboard", "pointer"}:
            raise M8M9OracleError("M8/M9 input script has a malformed row")
        try:
            boundary, first, second, third = int(fields[0]), int(fields[2]), int(fields[3]), int(fields[4])
        except ValueError as exc:
            raise M8M9OracleError("M8/M9 input script has a nondecimal field") from exc
        if boundary <= prior:
            raise M8M9OracleError("M8/M9 input script boundaries are not strictly increasing")
        if fields[1] == "keyboard":
            valid = 0 <= first <= 0o177 and second in {0, 1} and third == 0
        else:
            valid = 0 <= first < 768 and 0 <= second < 963 and 0 <= third <= 3
        if not valid:
            raise M8M9OracleError("M8/M9 input script row is outside its frozen domain")
        rows.append((boundary, fields[1], first, second, third)); prior = boundary
    if sum(row[1] == "keyboard" for row in rows) != 200 or sum(row[1] == "pointer" for row in rows) != 7:
        raise M8M9OracleError("M8/M9 input script does not cover 100 keyboard transitions plus pointer lifecycle")
    return script, campaign, manifest, rows


def parse_native_witness(path: Path, expected_rows: list[tuple[int, str, int, int, int]]) -> dict[str, Any]:
    owned_regular(path, "M8/M9 native pre-IOB witness")
    raw = path.read_bytes()
    if len(raw) != len(expected_rows) * NATIVE_RECORD_BYTES:
        raise M8M9OracleError("M8/M9 native witness has the wrong fixed record count")
    kinds = {"keyboard": 1, "pointer": 2}
    for ordinal, row in enumerate(expected_rows):
        record = raw[ordinal * NATIVE_RECORD_BYTES:(ordinal + 1) * NATIVE_RECORD_BYTES]
        boundary = int.from_bytes(record[24:32], "little")
        first = int.from_bytes(record[36:40], "little")
        second = int.from_bytes(record[40:44], "little")
        x = int.from_bytes(record[44:48], "little")
        y = int.from_bytes(record[48:52], "little")
        row_boundary, row_kind, row_first, row_second, row_third = row
        if (record[:7] != NATIVE_RECORD_SCHEMA or record[7] != 0 or
                int.from_bytes(record[8:12], "little") != 1 or
                int.from_bytes(record[12:16], "little") != NATIVE_RECORD_BYTES or
                int.from_bytes(record[16:20], "little") != kinds[row_kind] or
                int.from_bytes(record[20:24], "little") != 0 or boundary != row_boundary or
                int.from_bytes(record[52:56], "little") != ordinal or any(record[56:])):
            raise M8M9OracleError("M8/M9 native witness header/order drifted")
        expected = (row_first, row_second, 0, 0) if row_kind == "keyboard" else (row_third, 0, row_first, row_second)
        if (first, second, x, y) != expected:
            raise M8M9OracleError("M8/M9 native pre-IOB witness differs from its frozen input row")
    return {"schema": "CDRM8N1", "record_bytes": NATIVE_RECORD_BYTES,
            "record_count": len(expected_rows), "sha256": hashlib.sha256(raw).hexdigest()}


def prepare(*, output_value: str) -> dict[str, Any]:
    try:
        output = BASE.output_path(ROOT, output_value)
        parent = M7.prepare(output_value=output_value)
        if parent.get("status") != "ok":
            raise M8M9OracleError("M7/M6 source-closure preparation failed")
        source = output / "source/usim"
        patch_bytes = (ROOT / PATCH).read_bytes()
        patch_identity = BASE.apply_patch_exactly(
            patch_path=ROOT / PATCH, patch_bytes=patch_bytes, source_root=source)
        installed = BASE.install_native_support(ROOT, source, SUPPORT)
        tree, entries = BASE.prepared_source_identity(output)
        value = {
            "schema": "cadr-m8-m9-input-prepare-v1", "schema_version": 1,
            "m7_prepare_sha256": sha256(output / "m7-prepare.json"),
            "m8_m9_patch": patch_identity, "m8_m9_native_support": installed,
            "prepared_source_tree_sha256": tree, "prepared_source_file_count": len(entries),
        }
        M7.atomic_write_new(output / PREPARE_MARKER, canonical(value))
        return {"status": "ok", "operation": "prepare",
                "output": str(output.relative_to(ROOT)), "prepare": value}
    except (BASE.OracleError, M7.M7OracleError, M8M9OracleError, OSError, TypeError) as exc:
        return {"status": "invalid", "operation": "prepare", "error": str(exc)}


def build(*, prepared_value: str) -> dict[str, Any]:
    try:
        prepared, source, prepared_marker = prepared_source(prepared_value)
        tools = {name: tool_identity(name) for name in ("make", "cc", "ar", "ld", "nm")}
        pkg_config = tool_identity("pkg-config")
        # Guix profiles publish x11.pc through PKG_CONFIG_PATH rather than a
        # global directory.  Preserve only pkg-config's three documented
        # search-root variables (not the ambient environment) for both the
        # preflight queries and the nested Make invocation that repeats them.
        pkg_environment = {"LANG": "C", "LC_ALL": "C", "TZ": "UTC",
                           "PATH": os.environ.get("PATH", "")}
        for name in ("PKG_CONFIG_PATH", "PKG_CONFIG_LIBDIR", "PKG_CONFIG_SYSROOT_DIR"):
            if name in os.environ:
                pkg_environment[name] = os.environ[name]
        x11_queries: dict[str, dict[str, Any]] = {}
        for label, arguments in (("cflags", ("--cflags", "x11")),
                                 ("libs", ("--libs", "x11")),
                                 ("libdir", ("--variable=libdir", "x11"))):
            argv = [pkg_config["path"], *arguments]
            queried = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                     text=True, check=False, env=pkg_environment)
            if queried.returncode != 0:
                raise M8M9OracleError(f"pkg-config could not resolve X11 {label}")
            x11_queries[label] = {"argv": argv, "stdout": queried.stdout.strip()}
        libx11 = (Path(x11_queries["libdir"]["stdout"]) / "libX11.so").resolve()
        if not libx11.is_file():
            raise M8M9OracleError("pkg-config X11 libdir has no resolvable libX11.so")
        x11_toolchain = {"pkg_config": pkg_config, "queries": x11_queries,
                         "pkg_config_environment": {name: pkg_environment.get(name)
                                                    for name in ("PKG_CONFIG_PATH", "PKG_CONFIG_LIBDIR",
                                                                 "PKG_CONFIG_SYSROOT_DIR")},
                         "resolved_libX11": {"path": str(libx11),
                                             "bytes": libx11.stat().st_size,
                                             "sha256": sha256(libx11)}}
        command = [tools["make"]["path"], "-f", "Makefile.usim",
                   "USIM_BACKEND=m8-m9-input-oracle", "USIM_BUILD_TYPE=release",
                   "CHAOSDIR=../chaos", "LDFLAGS=-no-pie",
                   f"CC={tools['cc']['path']}", f"AR={tools['ar']['path']}"]
        build_environment = dict(pkg_environment)
        completed = subprocess.run(
            command, cwd=source, env=build_environment,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if completed.returncode != 0:
            raise M8M9OracleError("M8/M9 native oracle build failed: " + completed.stderr[-2000:])
        executable = source / "usim"
        direct_executable = source / "usim-m8-m9-direct"
        shutil.copy2(executable, direct_executable)
        x11_command = [tools["make"]["path"], "-f", "Makefile.usim",
                       "USIM_BACKEND=m8-m9-x11-witness", "USIM_BUILD_TYPE=release",
                       "CHAOSDIR=../chaos", f"CC={tools['cc']['path']}",
                       f"AR={tools['ar']['path']}"]
        x11_completed = subprocess.run(
            x11_command, cwd=source, env=build_environment,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if x11_completed.returncode != 0:
            raise M8M9OracleError("M8/M9 X11 witness build failed: " +
                                  x11_completed.stderr[-2000:])
        x11_executable = source / "usim-m8-m9-x11-witness"
        shutil.copy2(executable, x11_executable)
        executable = direct_executable
        information = executable.stat()
        if (not executable.is_file() or executable.is_symlink() or
                information.st_uid != os.geteuid() or
                not (information.st_mode & stat.S_IXUSR)):
            raise M8M9OracleError("M8/M9 native executable has unsafe ownership or mode")
        nm_command = [tools["nm"]["path"], "-u", str(executable)]
        undefined = subprocess.run(nm_command, env=build_environment,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, check=False)
        if undefined.returncode != 0:
            raise M8M9OracleError("cannot audit M8/M9 native oracle symbols")
        forbidden = (" X", "SDL_", "socket", "connect", "select", "gettimeofday",
                     "clock_gettime", "setitimer", "pthread_create", "pthread_cond_wait")
        hits = sorted(line for line in undefined.stdout.splitlines()
                      if any(token in line for token in forbidden))
        if hits:
            raise M8M9OracleError("forbidden native dependency: " + "; ".join(hits))
        tree, entries = BASE.prepared_source_identity(prepared)
        if (tree != prepared_marker["prepared_source_tree_sha256"] or
                len(entries) != prepared_marker["prepared_source_file_count"]):
            raise M8M9OracleError("M8/M9 build changed the prepared source closure")
        value = {
            "schema": "cadr-m8-m9-input-build-v1", "schema_version": 1,
            "path": str(executable.relative_to(ROOT)), "bytes": executable.stat().st_size,
            "sha256": sha256(executable), "forbidden_undefined_symbol_count": 0,
            "m8_m9_patch_sha256": prepared_marker["m8_m9_patch"]["sha256"],
            "prepared_source_tree_sha256": tree, "prepared_source_file_count": len(entries),
            "build_command": command, "build_cwd": str(source),
            "build_environment": build_environment, "nm_command": nm_command,
            "toolchain": tools, "x11_toolchain": x11_toolchain,
            "python": python_identity(),
            "x11_witness": {"path": str(x11_executable.relative_to(ROOT)),
                            "bytes": x11_executable.stat().st_size,
                            "sha256": sha256(x11_executable),
                            "build_command": x11_command},
        }
        M7.atomic_write_new(prepared / BUILD_MARKER, canonical(value))
        return {"status": "ok", "operation": "build", "build": value}
    except (BASE.OracleError, M8M9OracleError, OSError, KeyError) as exc:
        return {"status": "invalid", "operation": "build", "error": str(exc)}


def native_capture(*, prepared_value: str, config_value: str, output_value: str,
                   session_id: str, private_disk_instance_id: str,
                   input_script_value: str, campaign_value: str) -> dict[str, Any]:
    """Execute one fresh, private, source-bound native M8/M9 input capture.

    No caller-provided emulator path, config rendering, disk, schedule, or
    witness path reaches the child unchanged.  The existing M6 private-copy
    mechanism materializes those inputs into a new 0700 temporary runtime;
    only the reviewed sidecars are copied to the requested empty 0700 output.
    """
    try:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", session_id or "") or not re.fullmatch(
                r"[A-Za-z0-9_-]{1,128}", private_disk_instance_id or ""):
            raise M8M9OracleError("M8/M9 native session and disk identifiers are invalid")
        prepared, source, prepared_marker = prepared_source(prepared_value)
        build_marker = marker(prepared, BUILD_MARKER)
        executable = ROOT / build_marker.get("path", "")
        if (build_marker.get("schema") != "cadr-m8-m9-input-build-v1" or
                not executable.is_file() or executable.is_symlink() or
                sha256(executable) != build_marker.get("sha256")):
            raise M8M9OracleError("M8/M9 executable is not bound to its build marker")
        config = M7.M6_NATIVE.regular(Path(config_value), "M8/M9 native configuration")
        output = Path(output_value).resolve()
        M7.owned_directory(output, "M8/M9 native output directory")
        if (output.stat().st_mode & 0o7777) != 0o700 or any(output.iterdir()):
            raise M8M9OracleError("M8/M9 native output must be one empty 0700 directory")
        script, campaign, campaign_manifest, rows = validate_campaign_inputs(
            input_script_value, campaign_value)
        profile = M7.M6_NATIVE.read_json(M7.M6_NATIVE.PROFILE)
        pins = profile.get("source_pins")
        if not isinstance(pins, dict):
            raise M8M9OracleError("CADR-WEB profile has no source pins")
        mapping = M7.M6_NATIVE.load_schedule_module(); frozen = mapping.schedule()
        input_paths, base_disk = M7.M6_NATIVE.load_capture_inputs(config)
        artifacts, native_inputs = M7.M6_NATIVE.profile_inputs(profile, input_paths, base_disk)
        by_kind = {item["kind"]: item for item in artifacts}
        if set(by_kind) != {1, 2, 3, 4, 5} or len(native_inputs) != 1:
            raise M8M9OracleError("M8/M9 requires the exact M6 artifact/native-host closure")
        original_umask = os.umask(0o077)
        try:
            with tempfile.TemporaryDirectory(prefix=".m8-m9-runtime-", dir=output) as temporary:
                runtime = Path(temporary); os.chmod(runtime, 0o700)
                fs_root = runtime / "fs-root"; private_template = runtime / "inputs/cadr-web-303.ini.in"
                private_disk = runtime / "disk-sys-303-0.img"; rendered_config = runtime / "usim.ini"
                schedule = runtime / "schedule.txt"; raw = runtime / "capture.ndjson"; idle = runtime / "idle.bin"
                runtime_script = runtime / "input-script.txt"; witness = runtime / "input.cdrm8n1"
                private_executable = M7.M6_NATIVE.copy_private_executable(executable, runtime, build_marker["sha256"])
                private_executable_start = M7.sha256_file(private_executable)
                M7.M6_NATIVE.copy_verified(ROOT / "cadr-web/profiles/cadr-web-303.ini.in", private_template,
                                            by_kind[1], "M8/M9 config template")
                M7.M6_NATIVE.copy_verified(input_paths[0], fs_root / "sys/ubin/promh.mcr", by_kind[2], "M8/M9 control-store PROM")
                M7.M6_NATIVE.copy_verified(input_paths[1], fs_root / "sys/ubin/promh.sym", by_kind[4], "M8/M9 PROM symbols")
                M7.M6_NATIVE.copy_verified(input_paths[2], fs_root / "sys/ubin/ucadr.sym", by_kind[5], "M8/M9 microcode symbols")
                M7.M6_NATIVE.copy_verified(input_paths[3], fs_root / "usite/extra.hosts", native_inputs[0], "M8/M9 Chaos hosts")
                M7.M6_NATIVE.copy_verified(base_disk, private_disk, by_kind[3], "M8/M9 base disk")
                disk_before = M7.sha256_file(private_disk)
                if disk_before != by_kind[3]["sha256"]:
                    raise M8M9OracleError("M8/M9 private disk differs from selected base")
                M7.M6_NATIVE.render_private_config(private_template, fs_root, private_disk, runtime, rendered_config)
                M7.M6_NATIVE.assert_private_execution_config(rendered_config, fs_root, private_disk, runtime)
                rendered_config_identity = {"bytes": rendered_config.stat().st_size,
                                            "sha256": M7.sha256_file(rendered_config)}
                M7._copy_new_private(script, runtime_script, "M8/M9 runtime input script")
                mapping.write_native(frozen, schedule)
                environment = M7.M6_NATIVE.native_execution_environment(
                    schedule.resolve(), raw.resolve(), idle.resolve(), session_id)
                environment = {**environment, "CADR_M8_M9_INPUT_SCRIPT": str(runtime_script.resolve()),
                               "CADR_M8_M9_INPUT_WITNESS": str(witness.resolve())}
                private_executable_exec = M7.sha256_file(private_executable)
                if private_executable_exec != private_executable_start:
                    raise M8M9OracleError("private executable changed between copy and exec")
                child_argv = [str(private_executable), "-c", str(rendered_config)]
                completed = M7.M6_NATIVE.execute_private_m6(runtime, private_executable, rendered_config, environment)
                if completed.returncode != 0:
                    raise M8M9OracleError("M8/M9 native executable exited " + str(completed.returncode) + ": " + completed.stderr[-1000:])
                disk_after = M7.sha256_file(private_disk)
                private_executable_end = M7.sha256_file(private_executable)
                if private_executable_end != private_executable_exec:
                    raise M8M9OracleError("private executable changed during execution")
                if disk_before != disk_after or disk_after != by_kind[3]["sha256"]:
                    raise M8M9OracleError("M8/M9 private disk changed during capture")
                raw_lines = M7.read_owned_regular(raw, "M8/M9 native raw transcript").decode("utf-8").splitlines()
                if not raw_lines:
                    raise M8M9OracleError("M8/M9 native raw transcript is empty")
                raw_meta = json.loads(raw_lines[0]); raw_complete = json.loads(raw_lines[-1])
                if (raw_meta != {"kind": "meta", "schema": M7.M6_NATIVE.RAW_SCHEMA,
                                 "schedule_sha256": frozen["schedule"]["sha256"],
                                 "schedule_events": frozen["schedule"]["event_count"], "session_id": session_id} or
                        raw_complete != {"kind": "complete", "clean_shutdown": True,
                                         "schedule_consumed": frozen["schedule"]["event_count"], "debug_ir_writes": 9}):
                    raise M8M9OracleError("M8/M9 native transcript does not bind the clean M6 schedule")
                witness_record = parse_native_witness(witness, rows)
                M7._copy_new_private(runtime_script, output / "input-script.txt", "M8/M9 captured input script")
                M7._copy_new_private(campaign, output / "campaign.json", "M8/M9 captured campaign manifest")
                M7._copy_new_private(witness, output / "input.cdrm8n1", "M8/M9 native pre-IOB witness")
                M7._copy_new_private(raw, output / "capture.ndjson", "M8/M9 native transcript")
                M7._copy_new_private(idle, output / "idle.bin", "M8/M9 native idle samples")
        finally:
            os.umask(original_umask)
        metadata = {
            "schema": NATIVE_CAPTURE_SCHEMA, "target": "CADR-WEB-303/ABI1.8/protocol-v6/C-M8-M9",
            "session_id": session_id, "private_disk_instance_id": private_disk_instance_id,
            "source": {"system_fossil": pins["sys"]["revision"], "usim_fossil": pins["usim"]["revision"]},
            "m6_release_record": M7._m7_release_identity(),
            "patches": {"m7_prepare_sha256": prepared_marker["m7_prepare_sha256"],
                        "m8_m9_sha256": prepared_marker["m8_m9_patch"]["sha256"],
                        "m8_m9_support": prepared_marker["m8_m9_native_support"]},
            "prepared": {"path": str(prepared.relative_to(ROOT)), "source_tree_sha256": prepared_marker["prepared_source_tree_sha256"],
                         "source_file_count": prepared_marker["prepared_source_file_count"], "executable": build_marker},
            "runtime_provenance": {
                "python": runtime_python_identity(), "program": runtime_program_identity(),
                "rendered_config": rendered_config_identity,
                "private_executable": {"sha256_at_start": private_executable_start,
                                       "sha256_at_exec": private_executable_exec,
                                       "sha256_at_end": private_executable_end},
                "child_argv": child_argv, "child_environment": environment,
            },
            "artifacts": artifacts, "native_inputs": native_inputs,
            "m6_schedule": {"sha256": frozen["schedule"]["sha256"], "event_count": frozen["schedule"]["event_count"],
                            "mapping_sha256": frozen["mapping"]["sha256"]},
            "campaign": {**campaign_manifest, "input_script_bytes": script.stat().st_size,
                         "native_witness": witness_record},
            "private_disk": {"sha256_at_start": disk_before, "sha256_at_end": disk_after},
            "process": {"returncode": 0, "timed_out": False, "forced_stop": False,
                        "state_may_be_incomplete": False, "pending_host_requests": 0},
            "transcript": {"sha256": M7.sha256_file(output / "capture.ndjson"),
                           "idle_samples_sha256": M7.sha256_file(output / "idle.bin")},
        }
        M7.atomic_write_new(output / "metadata.json", canonical(metadata))
        if {path.name for path in output.iterdir()} != {"campaign.json", "capture.ndjson", "idle.bin", "input-script.txt", "input.cdrm8n1", "metadata.json"}:
            raise M8M9OracleError("M8/M9 native output has an unexpected sidecar")
        return {"status": "captured", "operation": "native-capture", "metadata": metadata}
    except (BASE.OracleError, M7.M7OracleError, M8M9OracleError, M7.M6_NATIVE.ProbeError,
            OSError, KeyError, ValueError, subprocess.TimeoutExpired) as exc:
        return {"status": "invalid", "operation": "native-capture", "error": str(exc)}


def campaign_plan(*, prepared_value: str) -> dict[str, Any]:
    try:
        prepared, source, prepared_marker = prepared_source(prepared_value)
        built = marker(prepared, BUILD_MARKER)
        executable = ROOT / built.get("path", "")
        if (built.get("schema") != "cadr-m8-m9-input-build-v1" or not executable.is_file() or
                sha256(executable) != built.get("sha256")):
            raise M8M9OracleError("M8/M9 build marker is not bound to its executable")
        return {
            "status": "planned", "operation": "campaign-plan", "runtime_execution_performed": False,
            "prepared": str(prepared.relative_to(ROOT)),
            "executable": str(executable.relative_to(ROOT)),
            "patch_sha256": prepared_marker["m8_m9_patch"]["sha256"],
            "record_schema": "CDRM8N1", "record_bytes": 64,
            "input_script_schema": "CADR-M8-M9-INPUT-v1",
            "pointer_translation": {
                "browser": "EDGE32 x,y,after-mask,one-hot-changed-mask",
                "native": "mouse_event(x,y,changed-button-selector)",
                "selector": {"motion": 0, "tail": 1, "middle": 2, "head": 3},
                "examples": [
                    edge32_to_native_pointer(0),
                    edge32_to_native_pointer(1 | (2 << 10) | (1 << 20) | (1 << 23)),
                    edge32_to_native_pointer(3 | (4 << 10) | (2 << 20) | (2 << 23)),
                    edge32_to_native_pointer(5 | (6 << 10) | (4 << 20) | (4 << 23)),
                ],
            },
            "required_private_files": ["M6 schedule and transcript inputs", "private configuration",
                                        "private disk", "input-script.txt", "input.cdrm8n1"],
            "required_environment": ["CADR_M6_RAW_SCHEDULE", "CADR_M6_NATIVE_LOG",
                                     "CADR_M6_IDLE_SAMPLES", "CADR_M6_SESSION_ID",
                                     "CADR_M8_M9_INPUT_SCRIPT", "CADR_M8_M9_INPUT_WITNESS"],
            "direct_boundary_campaign_command": (
                "guix shell node -- node scripts/run-cadr-m8-m9-input-conformance.mjs "
                "--execute --native-config build/cadr-oracle/m6-run-smoke/usim.ini "
                f"--prepared {prepared.relative_to(ROOT)} --wasm cadr-web/build/cadr-web-m9-devid-O0.wasm"),
            "ordered_transition": [
                "advance one guest boundary", "run M8/M9 driver rows due at that boundary",
                "write CDRM8N1 before kbd_event or mouse_event mutates native IOB state",
                "run the pinned M6 keyboard schedule at that boundary",
            ],
            "nonclaims": ["no private native session was launched",
                          "no input transition has yet been compared",
                          "the direct native driver does not traverse XTEST, X11, or Cadet",
                          "this command cannot close C-M8 or CW2-INTERACTIVE",
                          "the browser bridge is not declared native-equivalent before the campaign"],
        }
    except (BASE.OracleError, M8M9OracleError, OSError, KeyError) as exc:
        return {"status": "invalid", "operation": "campaign-plan", "error": str(exc)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="operation", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--output", default=DEFAULT_PREPARED)
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    plan_parser = commands.add_parser("campaign-plan")
    plan_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    capture_parser = commands.add_parser("native-capture")
    capture_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    capture_parser.add_argument("--config", required=True)
    capture_parser.add_argument("--output", required=True)
    capture_parser.add_argument("--session-id", required=True)
    capture_parser.add_argument("--private-disk-instance-id", required=True)
    capture_parser.add_argument("--input-script", required=True)
    capture_parser.add_argument("--campaign", required=True)
    capture_parser.add_argument("--execute", action="store_true")
    arguments = parser.parse_args(argv)
    if arguments.operation == "prepare":
        response = prepare(output_value=arguments.output)
    elif arguments.operation == "build":
        response = build(prepared_value=arguments.prepared)
    elif arguments.operation == "native-capture":
        if not arguments.execute:
            response = {"status": "invalid", "operation": "native-capture",
                        "error": "explicit --execute is required before a private native runtime may start"}
        else:
            response = native_capture(
                prepared_value=arguments.prepared, config_value=arguments.config,
                output_value=arguments.output, session_id=arguments.session_id,
                private_disk_instance_id=arguments.private_disk_instance_id,
                input_script_value=arguments.input_script, campaign_value=arguments.campaign)
    else:
        response = campaign_plan(prepared_value=arguments.prepared)
    print(json.dumps(response, sort_keys=True))
    return 0 if response["status"] in SUCCESS else 2


if __name__ == "__main__":
    raise SystemExit(main())
