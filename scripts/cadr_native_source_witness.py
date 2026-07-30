#!/usr/bin/env python3
"""Prepare, build, plan, or explicitly run a content-pinned public-usim witness.

The command only copies source-form public inputs below ``build/cadr-oracle``.
It never starts usim, opens a disk image, or accepts a runtime configuration.
The two witness kinds record narrow candidate observations when a separately
authorized native execution is later run against the built disposable closure.
Every execution receives a new authenticated Xvfb, stops only after the minimal
required hook record, and retains a privacy-bounded provenance receipt.
"""
from __future__ import annotations

import argparse
import configparser
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import platform
import secrets
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "build" / "cadr-oracle"
SOURCE_WORKTREE = ROOT / "l"
REPOSITORY_WORKTREE_GIT = "f6d3212c03e563b54b19082a97080eb697d6b060"
SOURCE_SUFFIXES = frozenset((".c", ".h", ".defs", ".mk", ".text", ".md"))
SOURCE_NAMES = frozenset(("Makefile", "Kbuild"))
XVFB = Path("/usr/bin/Xvfb")
XAUTH = Path("/usr/bin/xauth")
XDPYINFO = Path("/usr/bin/xdpyinfo")
XVFB_SCREEN = "1152x864x24"
XVFB_DISPLAY_RANGE = range(250, 300)
XVFB_START_TIMEOUT_SECONDS = 10.0
WITNESS_TIMEOUT_SECONDS = 120.0
TERM_TIMEOUT_SECONDS = 10.0
KILL_TIMEOUT_SECONDS = 10.0

WITNESSES: dict[str, dict[str, Any]] = {
    "m11-audio": {
        "default_output": "build/cadr-oracle/m11-audio-prepared",
        "patch": Path("cadr-web/oracle/patches/0006-m11-audio-witness.patch"),
        "support": (
            Path("cadr-web/oracle/native/cadr_m11_audio_witness.c"),
            Path("cadr-web/oracle/native/cadr_m11_audio_witness.h"),
        ),
        "sources": {
            "usim/Makefile.usim": "da5ee9389f0588635fc807b2dc30e84c314c4beb5361fa6b37dd22b179273c5f",
            "usim/iob.c": "529cc570c1f3552c0c366a84049a6e6f5267788bdb4255457076fcb5c8c5d14e",
            "usim/sdl3-audio.c": "16bd4806a5c650b587be8a7701193884526d16b7f88cf8c0a26657de6039dca4",
        },
        "witness_schema": "CDRM11USIM1",
        "witness_schema_version": 2,
        "environment": "CADR_M11_AUDIO_WITNESS",
        "backend": "sdl3",
    },
    "m12-debugger": {
        "default_output": "build/cadr-oracle/m12-debugger-prepared",
        "patch": Path("cadr-web/oracle/patches/0007-m12-debugger-witness.patch"),
        "support": (
            Path("cadr-web/oracle/native/cadr_m12_debugger_witness.c"),
            Path("cadr-web/oracle/native/cadr_m12_debugger_witness.h"),
        ),
        "sources": {
            "usim/Makefile.usim": "da5ee9389f0588635fc807b2dc30e84c314c4beb5361fa6b37dd22b179273c5f",
            "usim/ucode.c": "1b8775124fe7fcb112daf67848b07616811001c49565130887e4590d519bfe13",
            "sys/ucadr/uc-macrocode.lisp": "6e4ed4a4309e483811f050dcd51ec59cee583e78b4e15557636547f0c2c81bbd",
            "sys/ubin/ucadr.sym": "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a",
        },
        "witness_schema": "CDRM12USIM1",
        "witness_schema_version": 1,
        "environment": "CADR_M12_DEBUGGER_WITNESS",
        "backend": "x11",
    },
}


class WitnessError(ValueError):
    """An input does not satisfy the witness preparation boundary."""


def u32(value: Any, label: str, *, nonzero: bool = False) -> int:
    if (not isinstance(value, int) or isinstance(value, bool) or value < 0 or
            value > 0xffffffff or (nonzero and value == 0)):
        raise WitnessError(f"{label} must be a {'nonzero ' if nonzero else ''}u32")
    return value


def u64(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > 0xffffffffffffffff:
        raise WitnessError(f"{label} must be a u64")
    return value


def lowercase_sha256(value: Any, label: str) -> str:
    if (not isinstance(value, str) or len(value) != 64 or
            any(character not in "0123456789abcdef" for character in value)):
        raise WitnessError(f"{label} must be a lowercase SHA-256")
    return value


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def file_identity(path: Path) -> dict[str, Any]:
    return {"bytes": path.stat().st_size, "sha256": sha256_file(path)}


def relative_build_path(value: str) -> Path:
    parsed = PurePosixPath(value)
    if (not value or parsed.is_absolute() or ".." in parsed.parts or "\\" in value or
            any(part in ("", ".") for part in parsed.parts)):
        raise WitnessError("output must be a normalized repository-relative path")
    path = ROOT.joinpath(*parsed.parts)
    try:
        path.resolve(strict=False).relative_to(OUTPUT_ROOT.resolve())
    except (OSError, ValueError) as error:
        raise WitnessError("output must be below ignored build/cadr-oracle") from error
    return path


def regular_source(path: Path, label: str) -> None:
    if not path.is_file() or path.is_symlink():
        raise WitnessError(f"{label} is not a regular non-symlink source file")


def checked_inputs(config: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for name, expected in sorted(config["sources"].items()):
        path = SOURCE_WORKTREE / name
        regular_source(path, name)
        actual = sha256_file(path)
        if actual != expected:
            raise WitnessError(f"public source identity drifted: {name}")
        records.append({"path": name, "bytes": path.stat().st_size, "sha256": actual})
    return records


def checked_patch(kind: str, config: dict[str, Any]) -> dict[str, Any]:
    relative = config["patch"]
    path = ROOT / relative
    regular_source(path, "instrumentation patch")
    changed = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("diff --git a/"):
            fields = line.split()
            if len(fields) != 4 or not fields[2].startswith("a/"):
                raise WitnessError("instrumentation patch has an invalid file header")
            changed.add(fields[2][2:])
    expected = ({"Makefile.usim", "sdl3-audio.c"} if kind == "m11-audio"
                else {"Makefile.usim", "ucode.c"})
    if changed != expected:
        raise WitnessError("instrumentation patch has an unexpected file scope")
    return {"path": relative.as_posix(), "sha256": sha256_file(path)}


def source_file_name(path: Path) -> bool:
    return path.name in SOURCE_NAMES or path.name.startswith("Makefile.") or path.suffix in SOURCE_SUFFIXES


def copy_source_tree(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if path.is_symlink():
            raise WitnessError(f"public source tree contains a symlink: {source.name}/{relative}")
        if path.is_dir():
            continue
        if not path.is_file():
            raise WitnessError(f"public source tree has a non-regular member: {source.name}/{relative}")
        if source_file_name(path):
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)


def source_tree_identity(root: Path) -> tuple[str, list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if path.is_symlink() or not path.is_file():
            if path.is_dir():
                continue
            raise WitnessError(f"prepared source has a non-regular member: {relative}")
        records.append({"path": relative.as_posix(), "bytes": path.stat().st_size,
                        "sha256": sha256_file(path)})
    if not records:
        raise WitnessError("prepared source tree is empty")
    return hashlib.sha256(canonical(records)).hexdigest(), records


def install_support(config: dict[str, Any], usim: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for relative in config["support"]:
        source = ROOT / relative
        regular_source(source, f"support {relative}")
        target = usim / source.name
        if target.exists():
            raise WitnessError(f"support target already exists: {source.name}")
        shutil.copyfile(source, target)
        records.append({"path": relative.as_posix(), "bytes": source.stat().st_size,
                        "sha256": sha256_file(source)})
    return records


def run_patch(patch: Path, usim: Path, *, dry_run: bool) -> None:
    command = ["patch", "--batch", "--fuzz=0", "-p1", "-i", str(patch)]
    if dry_run:
        command.insert(1, "--dry-run")
    completed = subprocess.run(command, cwd=usim, text=True, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, check=False)
    if completed.returncode != 0:
        detail = (completed.stdout + completed.stderr).strip()[-1000:]
        raise WitnessError(f"instrumentation patch does not apply exactly: {detail}")


def load_marker(prepared: Path, kind: str) -> dict[str, Any]:
    marker_path = prepared / "prepare.json"
    regular_source(marker_path, "prepare marker")
    raw = marker_path.read_bytes()
    try:
        marker = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise WitnessError("prepare marker is not JSON") from error
    if (not isinstance(marker, dict) or raw != canonical(marker) or
            marker.get("schema") != "cadr-native-source-witness-prepare-v1"):
        raise WitnessError("prepare marker is not canonical witness preparation")
    if marker.get("kind") != kind:
        raise WitnessError("prepared witness kind differs")
    expected = WITNESSES[kind]
    if (marker.get("capture_status") != "not-run" or
            marker.get("environment_variable") != expected["environment"] or
            marker.get("witness_schema") != expected["witness_schema"] or
            not isinstance(marker.get("repository_worktree_git"), str) or
            len(marker["repository_worktree_git"]) != 40 or
            any(character not in "0123456789abcdef" for character in marker["repository_worktree_git"]) or
            not isinstance(marker.get("source_tree_file_count"), int) or
            isinstance(marker["source_tree_file_count"], bool) or marker["source_tree_file_count"] <= 0):
        raise WitnessError("prepare marker has an invalid identity envelope")
    lowercase_sha256(marker.get("source_tree_sha256"), "prepare source-tree hash")
    patch = marker.get("patch")
    if (not isinstance(patch, dict) or set(patch) != {"path", "sha256"} or
            patch.get("path") != expected["patch"].as_posix()):
        raise WitnessError("prepare marker has an invalid patch identity")
    lowercase_sha256(patch.get("sha256"), "prepare patch hash")
    for field, expected_paths in (("source_inputs", set(expected["sources"])),
                                  ("support", {item.as_posix() for item in expected["support"]})):
        records = marker.get(field)
        if not isinstance(records, list) or len(records) != len(expected_paths):
            raise WitnessError(f"prepare marker has an invalid {field} inventory")
        seen: set[str] = set()
        for item in records:
            if (not isinstance(item, dict) or set(item) != {"path", "bytes", "sha256"} or
                    not isinstance(item.get("path"), str) or item["path"] in seen or
                    not isinstance(item.get("bytes"), int) or isinstance(item["bytes"], bool) or item["bytes"] <= 0):
                raise WitnessError(f"prepare marker has an invalid {field} item")
            lowercase_sha256(item.get("sha256"), f"prepare {field} item hash")
            seen.add(item["path"])
        if seen != expected_paths:
            raise WitnessError(f"prepare marker {field} scope differs")
    return marker


def prepare(kind: str, output_value: str) -> dict[str, Any]:
    config = WITNESSES[kind]
    output = relative_build_path(output_value)
    if output.exists():
        raise WitnessError("output already exists; preparation never replaces a prior record")
    inputs = checked_inputs(config)
    patch = checked_patch(kind, config)
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent))
    try:
        source = stage / "source"
        usim = source / "usim"
        copy_source_tree(SOURCE_WORKTREE / "usim", usim)
        copy_source_tree(SOURCE_WORKTREE / "chaos", source / "chaos")
        support = install_support(config, usim)
        patch_path = ROOT / config["patch"]
        run_patch(patch_path, usim, dry_run=True)
        run_patch(patch_path, usim, dry_run=False)
        tree_sha256, tree_records = source_tree_identity(source)
        marker = {
            "capture_status": "not-run",
            "environment_variable": config["environment"],
            "kind": kind,
            "repository_worktree_git": REPOSITORY_WORKTREE_GIT,
            "patch": patch,
            "schema": "cadr-native-source-witness-prepare-v1",
            "source_inputs": inputs,
            "source_tree_file_count": len(tree_records),
            "source_tree_sha256": tree_sha256,
            "support": support,
            "witness_schema": config["witness_schema"],
        }
        (stage / "prepare.json").write_bytes(canonical(marker))
        os.replace(stage, output)
        return {"operation": "prepare", "output": output_value, "prepare": marker,
                "status": "ok"}
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def build(kind: str, prepared_value: str) -> dict[str, Any]:
    config = WITNESSES[kind]
    prepared = relative_build_path(prepared_value)
    marker = load_marker(prepared, kind)
    if checked_patch(kind, config)["sha256"] != marker["patch"].get("sha256"):
        raise WitnessError("instrumentation patch identity drifted")
    expected_support = marker.get("support")
    if not isinstance(expected_support, list) or len(expected_support) != len(config["support"]):
        raise WitnessError("prepare marker has an invalid support inventory")
    for item in expected_support:
        if not isinstance(item, dict):
            raise WitnessError("prepare marker has an invalid support entry")
        path = ROOT / item.get("path", "")
        if (not path.is_file() or sha256_file(path) != item.get("sha256") or
                path.stat().st_size != item.get("bytes")):
            raise WitnessError("native support identity drifted")
    source = prepared / "source"
    tree_sha256, _ = source_tree_identity(source)
    if tree_sha256 != marker.get("source_tree_sha256"):
        raise WitnessError("prepared source identity drifted")
    runtime = prepared / "runtime"
    if runtime.exists() or (prepared / "build.json").exists():
        raise WitnessError("build record already exists; create a fresh prepared closure to retry")
    shutil.copytree(source, runtime / "source", symlinks=False)
    command = ["make", "-f", "Makefile.usim", "USIM_BUILD_TYPE=debug",
               f"USIM_BACKEND={config['backend']}", "CHAOSDIR=../chaos", "-j1"]
    completed = subprocess.run(command, cwd=runtime / "source" / "usim", text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    (prepared / "build.stdout.log").write_text(completed.stdout, encoding="utf-8")
    (prepared / "build.stderr.log").write_text(completed.stderr, encoding="utf-8")
    source_after_sha256, _ = source_tree_identity(source)
    if source_after_sha256 != tree_sha256:
        raise WitnessError("compile changed the immutable prepared source closure")
    executable = runtime / "source" / "usim" / "usim"
    executable_record = None
    if completed.returncode == 0:
        regular_source(executable, "compiled disposable witness")
        executable_record = {"path": "runtime/source/usim/usim",
                             "bytes": executable.stat().st_size,
                             "sha256": sha256_file(executable)}
    record = {
        "command": command,
        "executable": executable_record,
        "environment": {name: os.environ.get(name) for name in
                        ("CC", "CFLAGS", "CPPFLAGS", "LDFLAGS", "MAKEFLAGS")},
        "returncode": completed.returncode,
        "schema": "cadr-native-source-witness-build-v1",
        "source_tree_sha256": tree_sha256,
        "status": "ok" if completed.returncode == 0 else "failed",
    }
    (prepared / "build.json").write_bytes(canonical(record))
    if completed.returncode != 0:
        raise WitnessError("disposable native build failed; see ignored build stderr log")
    return {"build": record, "operation": "build", "output": prepared_value, "status": "ok"}


def owned_private_directory(path: Path, label: str) -> None:
    information = path.lstat()
    if (path.is_symlink() or not stat.S_ISDIR(information.st_mode) or
            information.st_uid != os.geteuid() or
            (information.st_mode & 0o7777) != 0o700):
        raise WitnessError(f"{label} must be a current-owner, non-symlink directory with mode 0700")


def contained(child: Path, parent: Path, label: str) -> None:
    try:
        child.resolve(strict=True).relative_to(parent.resolve(strict=True))
    except (OSError, ValueError) as error:
        raise WitnessError(f"{label} escapes the private runtime") from error


def private_regular(path: Path, parent: Path, label: str) -> None:
    contained(path, parent, label)
    information = path.lstat()
    if path.is_symlink() or not stat.S_ISREG(information.st_mode) or information.st_uid != os.geteuid():
        raise WitnessError(f"{label} must be a current-owner regular non-symlink file")


def validate_audio_runtime_config(path: Path) -> None:
    """Reject the normal silent M6 profile before starting an audio witness."""
    parser = configparser.ConfigParser(interpolation=None)
    try:
        with path.open("r", encoding="utf-8") as stream:
            parser.read_file(stream)
        value = parser.get("usim", "beep_amplitude")
        amplitude = float(value)
        ascii_beep = parser.getboolean("usim", "use_ascii_beep", fallback=False)
    except (configparser.Error, UnicodeDecodeError, ValueError) as error:
        raise WitnessError("M11 audio capture requires a parseable private [usim] audio configuration") from error
    if not math.isfinite(amplitude) or amplitude <= 0.0 or amplitude > 1.0:
        raise WitnessError("M11 audio capture requires 0 < [usim] beep_amplitude <= 1; the normal silent M6 profile is not an audio oracle")
    if ascii_beep:
        raise WitnessError("M11 audio capture requires [usim] use_ascii_beep = false so the selected SDL3 PCM path runs")


def build_executable(prepared: Path, kind: str) -> tuple[dict[str, Any], Path]:
    marker = load_marker(prepared, kind)
    build_path = prepared / "build.json"
    regular_source(build_path, "build marker")
    try:
        build_marker = json.loads(build_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise WitnessError("build marker is not JSON") from error
    if (not isinstance(build_marker, dict) or canonical(build_marker) != build_path.read_bytes() or
            build_marker.get("schema") != "cadr-native-source-witness-build-v1" or
            build_marker.get("status") != "ok" or build_marker.get("returncode") != 0 or
            build_marker.get("source_tree_sha256") != marker.get("source_tree_sha256") or
            not isinstance(build_marker.get("command"), list) or
            any(not isinstance(value, str) for value in build_marker["command"]) or
            not isinstance(build_marker.get("environment"), dict)):
        raise WitnessError("build marker is not a successful canonical build")
    executable = prepared / "runtime/source/usim/usim"
    regular_source(executable, "built disposable witness")
    item = build_marker.get("executable")
    if (not isinstance(item, dict) or set(item) != {"path", "bytes", "sha256"} or
            item.get("path") != "runtime/source/usim/usim" or
            item.get("sha256") != sha256_file(executable) or item.get("bytes") != executable.stat().st_size):
        raise WitnessError("built disposable executable identity drifted")
    return marker, executable


def witness_events(kind: str, path: Path, *, require_candidate_pause_resume: bool = False) -> list[dict[str, Any]]:
    private_regular(path, path.parent, "native witness")
    if (path.stat().st_mode & 0o777) != 0o600:
        raise WitnessError("native witness must have exact mode 0600")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
        records = [json.loads(line) for line in lines]
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise WitnessError("native witness is not NDJSON") from error
    schema = WITNESSES[kind]["witness_schema"]
    if not records or records[0] != {"schema": schema,
                                     "schema_version": WITNESSES[kind]["witness_schema_version"]}:
        raise WitnessError("native witness header differs")
    events = records[1:]
    if not events:
        raise WitnessError("native witness has no runtime events")
    sequence = 0
    for event in events:
        if (not isinstance(event, dict) or u64(event.get("sequence"), "native witness sequence") != sequence):
            raise WitnessError("native witness event sequence differs")
        sequence += 1
    if kind == "m11-audio":
        def job_hash(event: dict[str, Any]) -> str:
            return hashlib.sha256(
                b"CDRM11E1" + event["half_wavelength_us"].to_bytes(4, "little") +
                event["wavelength_us"].to_bytes(4, "little") +
                event["duration_us"].to_bytes(4, "little")
            ).hexdigest()
        def valid_job(event: dict[str, Any]) -> bool:
            if set(event) != {"duration_us", "event", "event_sha256", "half_wavelength_us", "sequence", "wavelength_us"}:
                return False
            try:
                for name in ("duration_us", "half_wavelength_us", "wavelength_us"):
                    u32(event[name], f"M11 {name}", nonzero=True)
                lowercase_sha256(event["event_sha256"], "M11 event hash")
            except WitnessError:
                return False
            return (event["event"] == "beep-job" and
                    event["wavelength_us"] == event["half_wavelength_us"] * 2 and
                    event["event_sha256"] == job_hash(event))
        def valid_pcm(event: dict[str, Any]) -> bool:
            if set(event) != {"event", "frame_count", "pcm_s16le_sha256", "sample_bytes", "sample_rate", "sequence"}:
                return False
            try:
                u32(event["frame_count"], "M11 frame count", nonzero=True)
                u32(event["sample_bytes"], "M11 sample bytes")
                u32(event["sample_rate"], "M11 sample rate", nonzero=True)
                lowercase_sha256(event["pcm_s16le_sha256"], "M11 PCM hash")
            except WitnessError:
                return False
            return (event["event"] == "pcm-block" and event["sample_rate"] == 8000 and
                    event["sample_bytes"] == event["frame_count"] * 2)
        if (any(event.get("event") not in {"beep-job", "pcm-block"} for event in events) or
                any(not valid_job(event) for event in events if event.get("event") == "beep-job") or
                any(not valid_pcm(event) for event in events if event.get("event") == "pcm-block")):
            raise WitnessError("M11 native witness events are incomplete or malformed")
        jobs = [index for index, event in enumerate(events) if event["event"] == "beep-job"]
        pcm = [index for index, event in enumerate(events) if event["event"] == "pcm-block"]
        # The patched source emits a job immediately before it calls the synchronous
        # renderer.  A PCM record without an earlier job therefore cannot be a record
        # from this exact hook, even if both record shapes happen to be valid.
        if not jobs or not pcm or jobs[0] > pcm[0]:
            raise WitnessError("M11 native witness lacks a job-before-PCM observation")
    else:
        names = {"candidate-loop", "candidate-pause-enter", "candidate-pause-resume"}
        required_fields = {"event", "label", "location_counter", "machine_cycles", "next_pc", "p0_pc", "p1_pc", "sequence"}
        try:
            for event in events:
                if set(event) != required_fields or event.get("event") not in names or event.get("label") not in ("QMLP", "DMLP"):
                    raise WitnessError("invalid M12 event shape")
                for field in ("location_counter", "next_pc", "p0_pc", "p1_pc"):
                    u32(event[field], f"M12 {field}")
                u64(event["machine_cycles"], "M12 machine cycles")
                if event["p1_pc"] != (0o164 if event["label"] == "QMLP" else 0o200):
                    raise WitnessError("M12 label/PC anchor differs")
        except WitnessError as error:
            raise WitnessError("M12 native witness events are incomplete or malformed") from error
        loops = [event for event in events if event["event"] == "candidate-loop"]
        if not loops:
            raise WitnessError("M12 native witness events are incomplete or malformed")
        pause_state = None
        pauses = 0
        preceding_loop = None
        for event in events:
            if event["event"] == "candidate-loop":
                preceding_loop = event
                continue
            if event["event"] == "candidate-pause-enter":
                if (pause_state is not None or preceding_loop is None or
                        any(event[key] != preceding_loop[key] for key in
                            ("label", "location_counter", "machine_cycles", "next_pc", "p0_pc", "p1_pc"))):
                    raise WitnessError("M12 candidate pause is not paired with its loop")
                pause_state = event; pauses += 1
            elif event["event"] == "candidate-pause-resume":
                if pause_state is None or any(event[key] != pause_state[key]
                                               for key in ("label", "location_counter", "machine_cycles", "next_pc", "p0_pc", "p1_pc")):
                    raise WitnessError("M12 candidate resume does not match its pause")
                pause_state = None
        if (pause_state is not None or (require_candidate_pause_resume and pauses == 0) or
                (not require_candidate_pause_resume and pauses != 0)):
            raise WitnessError("M12 controlled candidate pause/resume is absent or incomplete")
    return records


def wait_for_witness_event(path: Path, event_name: str, process: subprocess.Popen[bytes], timeout: float = 30.0) -> None:
    """Wait only for a flushed NDJSON event from the child-owned 0600 witness."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            try:
                for line in path.read_text(encoding="utf-8").splitlines():
                    if json.loads(line).get("event") == event_name:
                        return
            except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                pass  # a final concurrent line may be incomplete; retry it
        returncode = process.poll()
        if returncode is not None:
            raise WitnessError(f"native witness exited {returncode} before {event_name}")
        time.sleep(0.02)
    raise WitnessError(f"native witness did not emit {event_name} within {timeout:g} seconds")


def atomic_private_text(path: Path, value: str) -> None:
    """Replace a 0600 control value without exposing a truncate/read race."""
    if not path.parent.is_dir() or path.parent.is_symlink():
        raise WitnessError("private control parent is unavailable")
    temporary = path.parent / ("." + path.name + "." + secrets.token_hex(8))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="ascii", newline="\n") as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    except Exception:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass
        raise


def tool_identity(path: Path, label: str, probe: list[str]) -> dict[str, Any]:
    if not path.is_file() or path.is_symlink() or path.stat().st_mode & 0o111 == 0:
        raise WitnessError(f"{label} is unavailable")
    result = subprocess.run([str(path), *probe], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False, timeout=10,
                            env={"LANG": "C", "LC_ALL": "C", "TZ": "UTC"})
    output = (result.stdout + result.stderr).encode("utf-8", errors="replace")
    if not output:
        raise WitnessError(f"{label} identity probe returned no output")
    return {"name": label, **file_identity(path), "probe": probe,
            "probe_exit": result.returncode, "probe_sha256": hashlib.sha256(output).hexdigest()}


def probe_output(path: Path, arguments: list[str], label: str) -> str:
    result = subprocess.run([str(path), *arguments], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False, timeout=10, env=xvfb_environment())
    output = result.stdout + result.stderr
    if not output:
        raise WitnessError(f"{label} probe returned no output")
    return output


def xvfb_environment() -> dict[str, str]:
    return {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"}


def display_environment(kind: str, display: str, authority: Path, home: Path) -> dict[str, str]:
    environment = {"LANG": "C", "LC_ALL": "C", "TZ": "UTC", "HOME": str(home),
                   "XDG_RUNTIME_DIR": str(home), "DISPLAY": display,
                   "XAUTHORITY": str(authority), WITNESSES[kind]["environment"]: ""}
    if kind == "m11-audio":
        # SDL3 still needs an X video surface, while its audio device must never
        # select an ambient host server for this evidence-only capture.
        environment.update({"SDL_VIDEODRIVER": "x11", "SDL_AUDIODRIVER": "dummy"})
    return environment


def create_xauthority(directory: Path, display: str) -> Path:
    authority = directory / "Xauthority"
    if not XAUTH.is_file() or XAUTH.is_symlink():
        raise WitnessError("native witness requires /usr/bin/xauth")
    result = subprocess.run([str(XAUTH), "-f", str(authority), "add", display, ".", secrets.token_hex(16)],
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            check=False, timeout=10, env=xvfb_environment())
    if result.returncode != 0:
        raise WitnessError("cannot create private Xauthority: " + result.stderr.strip())
    os.chmod(authority, 0o600)
    private_regular(authority, directory, "private Xauthority")
    if authority.stat().st_mode & 0o777 != 0o600:
        raise WitnessError("private Xauthority must have exact mode 0600")
    return authority


def group_exists(process_group: int) -> bool:
    try:
        os.killpg(process_group, 0)
    except ProcessLookupError:
        return False
    except PermissionError as error:
        raise WitnessError("cannot inspect native witness process group") from error
    return True


def stop_process_group(process: subprocess.Popen[bytes], reason: str) -> tuple[int, bool, list[dict[str, Any]]]:
    """Stop the owned session and prove it did not leave a child behind."""
    group = process.pid
    actions: list[dict[str, Any]] = []
    if process.poll() is None or group_exists(group):
        try:
            os.killpg(group, signal.SIGTERM)
            actions.append({"action": "signal", "signal": "SIGTERM", "reason": reason})
        except ProcessLookupError:
            pass
    try:
        returncode = process.wait(timeout=TERM_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(group, signal.SIGKILL)
            actions.append({"action": "signal", "signal": "SIGKILL", "reason": reason + "-term-timeout"})
        except ProcessLookupError:
            pass
        try:
            returncode = process.wait(timeout=KILL_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired as error:
            raise WitnessError("native witness leader survived SIGKILL") from error
    deadline = time.monotonic() + TERM_TIMEOUT_SECONDS
    while group_exists(group) and time.monotonic() < deadline:
        time.sleep(0.02)
    if group_exists(group):
        try:
            os.killpg(group, signal.SIGKILL)
            actions.append({"action": "signal", "signal": "SIGKILL", "reason": reason + "-orphan"})
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + KILL_TIMEOUT_SECONDS
        while group_exists(group) and time.monotonic() < deadline:
            time.sleep(0.02)
        if group_exists(group):
            raise WitnessError("native witness process group survived cleanup")
    return returncode, any(action["signal"] == "SIGKILL" for action in actions), actions


def stop_xvfb(process: subprocess.Popen[bytes] | None) -> tuple[int | None, bool]:
    if process is None:
        return None, False
    returncode, forced, _ = stop_process_group(process, "xvfb-cleanup")
    if returncode not in (0, -signal.SIGTERM, -signal.SIGKILL):
        raise WitnessError(f"private Xvfb exited unexpectedly: {returncode}")
    return returncode, forced


def start_private_xvfb(directory: Path) -> tuple[subprocess.Popen[bytes], dict[str, Any], str, Path]:
    """Start a short-lived authenticated Xvfb and verify MIT-SHM is absent."""
    if not XVFB.is_file() or XVFB.is_symlink() or not XDPYINFO.is_file() or XDPYINFO.is_symlink():
        raise WitnessError("native witness requires /usr/bin/Xvfb and /usr/bin/xdpyinfo")
    xvfb_identity = tool_identity(XVFB, "Xvfb", ["-help"])
    if "-screen scrn WxHxD" not in probe_output(XVFB, ["-help"], "Xvfb"):
        raise WitnessError("Xvfb identity probe is not the expected server interface")
    xdpynfo_identity = tool_identity(XDPYINFO, "xdpyinfo", ["-version"])
    for number in XVFB_DISPLAY_RANGE:
        display = f":{number}"
        if Path(f"/tmp/.X{number}-lock").exists() or Path(f"/tmp/.X11-unix/X{number}").exists():
            continue
        authority = create_xauthority(directory, display)
        log = directory / "xvfb.log"
        with log.open("xb") as stream:
            os.chmod(log, 0o600)
            process = subprocess.Popen([str(XVFB), display, "-screen", "0", XVFB_SCREEN,
                                        "-nolisten", "tcp", "-extension", "MIT-SHM", "-auth", str(authority)],
                                       cwd=directory, stdin=subprocess.DEVNULL, stdout=stream,
                                       stderr=subprocess.STDOUT, env=xvfb_environment(), start_new_session=True)
        deadline = time.monotonic() + XVFB_START_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            if Path(f"/tmp/.X11-unix/X{number}").exists():
                probe = subprocess.run([str(XDPYINFO), "-display", display, "-queryExtensions"], text=True,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=10,
                                       env={**xvfb_environment(), "DISPLAY": display, "XAUTHORITY": str(authority)})
                if probe.returncode != 0:
                    stop_xvfb(process)
                    raise WitnessError("private Xvfb extension query failed: " + probe.stderr.strip())
                if any("MIT-SHM" in line for line in probe.stdout.splitlines()):
                    stop_xvfb(process)
                    raise WitnessError("private Xvfb still advertises MIT-SHM")
                return process, {"display": display, "screen": XVFB_SCREEN,
                                 "mit_shm": "disabled-and-verified", "xvfb": xvfb_identity,
                                 "xdpyinfo": xdpynfo_identity, "log": {"path": "xvfb.log", **file_identity(log)}}, display, authority
            if process.poll() is not None:
                break
            time.sleep(0.02)
        stop_xvfb(process)
        authority.unlink(missing_ok=True)
        log.unlink(missing_ok=True)
    raise WitnessError("no private Xvfb display was available")


def capture_plan(kind: str, prepared_value: str) -> dict[str, Any]:
    prepared = relative_build_path(prepared_value)
    marker, executable = build_executable(prepared, kind)
    requirements = {"execute": True, "fresh_private_runtime_mode": "0700",
                    "fresh_output_mode": "0700", "private_config": True,
                    "private_disk_unchanged": True, "nonempty_real_witness": True,
                    "private_xvfb": True, "mit_shm_disabled": True,
                    "controlled_stop_after_required_witness": True}
    if kind == "m11-audio":
        requirements["audio_config"] = "0 < beep_amplitude <= 1 and use_ascii_beep = false"
    return {"operation": "capture-plan", "status": "planned", "kind": kind,
            "requires": requirements,
            "command": {"executable_sha256": sha256_file(executable),
                        "environment_variable": WITNESSES[kind]["environment"],
                        "witness_schema": WITNESSES[kind]["witness_schema"]},
            "prepared_source_tree_sha256": marker["source_tree_sha256"]}


def wait_for_required_witness(kind: str, raw: Path, process: subprocess.Popen[bytes], control: Path,
                              candidate_pause_resume: bool, actions: list[dict[str, Any]]) -> None:
    """Wait for exactly the smallest source-hook observation this capture claims."""
    if kind == "m11-audio":
        wait_for_witness_event(raw, "beep-job", process, timeout=WITNESS_TIMEOUT_SECONDS)
        actions.append({"action": "observe", "event": "beep-job"})
        wait_for_witness_event(raw, "pcm-block", process, timeout=WITNESS_TIMEOUT_SECONDS)
        actions.append({"action": "observe", "event": "pcm-block"})
        return
    if candidate_pause_resume:
        wait_for_witness_event(raw, "candidate-pause-enter", process, timeout=WITNESS_TIMEOUT_SECONDS)
        actions.append({"action": "observe", "event": "candidate-pause-enter"})
        atomic_private_text(control, "resume\n")
        actions.append({"action": "configure-candidate-resume", "value": "resume"})
        wait_for_witness_event(raw, "candidate-pause-resume", process, timeout=WITNESS_TIMEOUT_SECONDS)
        actions.append({"action": "observe", "event": "candidate-pause-resume"})
        return
    wait_for_witness_event(raw, "candidate-loop", process, timeout=WITNESS_TIMEOUT_SECONDS)
    actions.append({"action": "observe", "event": "candidate-loop"})


def native_capture(kind: str, prepared_value: str, config_value: str,
                   private_runtime_value: str, private_disk_value: str,
                   output_value: str, session_id: str,
                   candidate_pause_resume: bool = False) -> dict[str, Any]:
    """Run one disposable executable against a caller-supplied private runtime.

    This does not materialize artifacts or render configuration: callers must
    provide the already isolated, fresh M6-compatible runtime and disk.  The
    native executable is copied into a new child directory, receives a clean
    environment, and must emit the instrumented witness itself.
    """
    try:
        if not session_id or len(session_id) > 128 or any(not (char.isalnum() or char in "_-")
                                                           for char in session_id):
            raise WitnessError("session ID must be a short ASCII token")
        if candidate_pause_resume and kind != "m12-debugger":
            raise WitnessError("candidate pause/resume is only defined for m12-debugger")
        prepared = relative_build_path(prepared_value)
        marker, executable = build_executable(prepared, kind)
        runtime = Path(private_runtime_value).resolve(strict=True)
        output = relative_build_path(output_value)
        config = Path(config_value).resolve(strict=True)
        disk = Path(private_disk_value).resolve(strict=True)
        owned_private_directory(runtime, "private runtime")
        private_regular(config, runtime, "private configuration")
        private_regular(disk, runtime, "private disk")
        if kind == "m11-audio":
            validate_audio_runtime_config(config)
        if output.exists():
            owned_private_directory(output, "capture output")
            if any(output.iterdir()): raise WitnessError("capture output must be empty")
        else:
            output.mkdir(parents=True, mode=0o700)
            os.chmod(output, 0o700)
            owned_private_directory(output, "capture output")
        display_record: dict[str, Any] | None = None
        xvfb_returncode: int | None = None
        xvfb_forced_stop = False
        returncode: int | None = None
        process_forced_stop = False
        original_umask = os.umask(0o077)
        try:
            with tempfile.TemporaryDirectory(prefix=f".{kind}-{session_id}-", dir=output) as temporary:
                child = Path(temporary); os.chmod(child, 0o700)
                private_executable = child / "usim"
                shutil.copyfile(executable, private_executable)
                os.chmod(private_executable, executable.stat().st_mode & 0o777)
                raw = child / "witness.ndjson"
                control = child / "candidate-control"
                disk_before = sha256_file(disk)
                stdout_log = child / "stdout.log"
                stderr_log = child / "stderr.log"
                actions = ([{"action": "configure-candidate-pause", "value": "pause"}]
                           if candidate_pause_resume else []) + \
                    [{"action": "launch", "argv": ["usim", "-c", "<private-config>"]}]
                started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                xvfb = None
                process = None
                try:
                    xvfb, display_record, display, authority = start_private_xvfb(child)
                    environment = display_environment(kind, display, authority, child)
                    environment[WITNESSES[kind]["environment"]] = str(raw)
                    if candidate_pause_resume:
                        atomic_private_text(control, "pause\n")
                        environment["CADR_M12_DEBUGGER_WITNESS_CONTROL"] = str(control)
                    with stdout_log.open("xb") as stdout_stream, stderr_log.open("xb") as stderr_stream:
                        process = subprocess.Popen([str(private_executable), "-c", str(config)], cwd=runtime,
                                                   stdin=subprocess.DEVNULL, stdout=stdout_stream,
                                                   stderr=stderr_stream, env=environment, start_new_session=True)
                        wait_for_required_witness(kind, raw, process, control, candidate_pause_resume, actions)
                        returncode, process_forced_stop, stop_actions = stop_process_group(process, "required-witness")
                        actions.extend(stop_actions)
                        process = None
                    if returncode not in (0, -signal.SIGTERM, -signal.SIGKILL):
                        detail = stderr_log.read_text(encoding="utf-8", errors="replace")[-1000:]
                        raise WitnessError("native witness exited " + str(returncode) + ": " + detail)
                finally:
                    if process is not None:
                        _, forced, stop_actions = stop_process_group(process, "capture-error")
                        actions.extend(stop_actions)
                        process_forced_stop = process_forced_stop or forced
                    if xvfb is not None:
                        xvfb_returncode, xvfb_forced_stop = stop_xvfb(xvfb)
                actions.append({"action": "exit", "returncode": returncode})
                finished_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                disk_after = sha256_file(disk)
                if disk_before != disk_after:
                    raise WitnessError("private disk changed during native witness capture")
                records = witness_events(kind, raw, require_candidate_pause_resume=candidate_pause_resume)
                target = output / "witness.ndjson"
                if target.exists(): raise WitnessError("capture witness target already exists")
                shutil.copyfile(raw, target); os.chmod(target, 0o600)
                for name, source in (("stdout.log", stdout_log), ("stderr.log", stderr_log),
                                     ("xvfb.log", child / "xvfb.log")):
                    target_log = output / name
                    if target_log.exists(): raise WitnessError("capture log target already exists")
                    shutil.copyfile(source, target_log); os.chmod(target_log, 0o600)
        finally:
            os.umask(original_umask)
        metadata = {"schema": "cadr-native-source-witness-capture-v1", "kind": kind,
                    "session_id": session_id, "witness_schema": WITNESSES[kind]["witness_schema"],
                    "prepared": {"repository_worktree_git": marker["repository_worktree_git"],
                                 "source_tree_sha256": marker["source_tree_sha256"],
                                 "patch_sha256": marker["patch"]["sha256"],
                                 "executable_sha256": sha256_file(executable)},
                    "private_config": file_identity(config),
                    "private_disk": {"sha256_at_start": disk_before, "sha256_at_end": disk_after},
                    "witness": {"path": "witness.ndjson", **file_identity(output / "witness.ndjson"),
                                "records": len(records)},
                    "logs": {name: {"path": name, **file_identity(output / name)}
                             for name in ("stdout.log", "stderr.log", "xvfb.log")},
                    "display": {**(display_record or {}),
                                "log": {"path": "xvfb.log", **file_identity(output / "xvfb.log")},
                                "returncode": xvfb_returncode, "forced_stop": xvfb_forced_stop},
                    "toolchain": {"python": sys.version.split()[0], "platform": platform.platform(),
                                  "locale": "C", "timezone": "UTC",
                                  "audio_backend": "SDL3 dummy" if kind == "m11-audio" else "not-applicable"},
                    "capture_window": {"started_at_utc": started_at, "finished_at_utc": finished_at},
                    "candidate_pause_resume": candidate_pause_resume,
                    "actions": actions,
                    "process": {"returncode": returncode, "timed_out": False,
                                "stop_requested_after_required_witness": True,
                                "forced_stop": process_forced_stop,
                                "state_may_be_incomplete": process_forced_stop or returncode != 0}}
        (output / "metadata.json").write_bytes(canonical(metadata))
        return {"operation": "native-capture", "status": "captured", "metadata": metadata}
    except (OSError, WitnessError, subprocess.TimeoutExpired) as error:
        return {"operation": "native-capture", "status": "invalid", "error": str(error)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=sorted(WITNESSES))
    commands = parser.add_subparsers(dest="operation", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--output")
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--prepared")
    plan_parser = commands.add_parser("capture-plan")
    plan_parser.add_argument("--prepared")
    capture_parser = commands.add_parser("native-capture")
    capture_parser.add_argument("--prepared")
    capture_parser.add_argument("--config", required=True)
    capture_parser.add_argument("--private-runtime", required=True)
    capture_parser.add_argument("--private-disk", required=True)
    capture_parser.add_argument("--output", required=True)
    capture_parser.add_argument("--session-id", required=True)
    capture_parser.add_argument("--candidate-pause-resume", action="store_true",
                                help="M12 only: exercise the instrumented candidate-loop pause/resume control")
    capture_parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    config = WITNESSES[args.kind]
    try:
        if args.operation == "prepare":
            result = prepare(args.kind, args.output or config["default_output"])
        elif args.operation == "build":
            result = build(args.kind, args.prepared or config["default_output"])
        elif args.operation == "capture-plan":
            result = capture_plan(args.kind, args.prepared or config["default_output"])
        elif not args.execute:
            result = {"error": "explicit --execute is required", "operation": "native-capture", "status": "invalid"}
        else:
            result = native_capture(args.kind, args.prepared or config["default_output"], args.config,
                                    args.private_runtime, args.private_disk, args.output, args.session_id,
                                    candidate_pause_resume=args.candidate_pause_resume)
    except (OSError, WitnessError, subprocess.SubprocessError) as error:
        result = {"error": str(error), "operation": args.operation, "status": "invalid"}
        print(json.dumps(result, sort_keys=True))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 2 if result.get("status") == "invalid" else 0


if __name__ == "__main__":
    raise SystemExit(main())
