#!/usr/bin/env python3
"""Prepare/build/strictly verify the private native M7 framebuffer oracle.

This intentionally does not cold-boot a Lisp-machine image.  The C witness is
installed only into a verified disposable source closure; a later supervised
capture process supplies its one private output pathname through the complete,
non-inherited child environment returned by ``native_execution_environment``.
``verify-capture`` reads that ignored raw record without copying it into the
repository or a release artifact.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from typing import Any
import uuid


ROOT = Path(__file__).resolve().parents[1]
M6_PATCH = Path("cadr-web/oracle/patches/0002-m6-debug-ir-witness.patch")
M7_PATCH = Path("cadr-web/oracle/patches/0003-m7-frame-witness.patch")
M7_SUPPORT = (
    Path("cadr-web/oracle/native/cadr_m7_frame_witness.c"),
    Path("cadr-web/oracle/native/cadr_m7_frame_witness.h"),
)
DEFAULT_PREPARED = "build/cadr-oracle/m7-frame-prepared"
FRAME_SCHEMA = "CDRM7N1"
FRAME_HEADER_BYTES = 64
FRAME_WIDTH = 768
FRAME_HEIGHT = 963
FRAME_STRIDE_WORDS = 24
FRAME_BACKING_WORDS = 32768
FRAME_ACTIVE_WORDS = FRAME_STRIDE_WORDS * FRAME_HEIGHT
FRAME_PAYLOAD_BYTES = FRAME_ACTIVE_WORDS * 4
M7_C_BOUNDARY = 982_990_214
EXECUTION_ENVIRONMENT = {
    "policy_id": "cadr-m7-native-frame-minimal-environment-v1",
    "inherited": False,
    "variables": {"LANG": "C", "LC_ALL": "C", "TZ": "UTC"},
}


class M7OracleError(ValueError):
    """A source closure or private raw frame is not an M7 oracle input."""


def load_base() -> Any:
    path = ROOT / "scripts/cadr-oracle.py"
    specification = importlib.util.spec_from_file_location("cadr_m7_oracle_base", path)
    if specification is None or specification.loader is None:
        raise M7OracleError("cannot load the CADR source-closure preparer")
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


BASE = load_base()


def load_m6_native_capture() -> Any:
    """Load the frozen M6 private-input materializer without invoking it.

    M7 is intentionally a lineage on top of the accepted M6 boundary witness.
    Reusing the materializer keeps the five artifact and native-host copy rules
    identical, while this module alone supplies the M7 frame-output variable
    and M7-only capture bundle schema.
    """
    path = ROOT / "scripts/cadr-m6-native-oracle.py"
    specification = importlib.util.spec_from_file_location("cadr_m7_m6_capture", path)
    if specification is None or specification.loader is None:
        raise M7OracleError("cannot load the frozen M6 native input materializer")
    module = importlib.util.module_from_spec(specification)
    sys.modules[specification.name] = module
    specification.loader.exec_module(module)
    return module


M6_NATIVE = load_m6_native_capture()
M7_NATIVE_CAPTURE_SCHEMA = "cadr-m7-native-frame-capture-v1"
M7_TARGET = "CADR-WEB-303/ABI1.5/protocol-v5/M7"
SUCCESS_STATUSES = frozenset(("captured", "ok", "planned"))


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("utf-8")


def canonical_result(value: Any) -> bytes:
    """Return the newline-free canonical JSON contract consumed by P4."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True).encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def reject_duplicate_members(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise M7OracleError(f"duplicate JSON member {key!r}")
        result[key] = value
    return result


def owned_directory(path: Path, label: str) -> Path:
    try:
        information = path.lstat()
    except OSError as exc:
        raise M7OracleError(f"{label} is unavailable") from exc
    if (path.is_symlink() or not stat.S_ISDIR(information.st_mode) or
            information.st_uid != os.geteuid() or information.st_mode & 0o022):
        raise M7OracleError(f"{label} must be a current-owner non-symlink directory without group/other write")
    return path


def owned_regular(path: Path, label: str, *, exact_mode: int | None = None) -> os.stat_result:
    try:
        information = path.lstat()
    except OSError as exc:
        raise M7OracleError(f"{label} is unavailable") from exc
    if (path.is_symlink() or not stat.S_ISREG(information.st_mode) or
            information.st_uid != os.geteuid() or information.st_nlink != 1 or
            information.st_mode & 0o022 or
            (exact_mode is not None and information.st_mode & 0o7777 != exact_mode)):
        raise M7OracleError(f"{label} must be a current-owner regular non-symlink file with safe mode")
    return information


def read_owned_regular(path: Path, label: str, *, exact_mode: int | None = None) -> bytes:
    """Read one marker through an O_NOFOLLOW descriptor and recheck that inode."""
    owned_regular(path, label, exact_mode=exact_mode)
    if not hasattr(os, "O_NOFOLLOW"):
        raise M7OracleError("platform lacks the required O_NOFOLLOW marker guard")
    descriptor = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
    try:
        information = os.fstat(descriptor)
        if (not stat.S_ISREG(information.st_mode) or information.st_uid != os.geteuid() or
                information.st_nlink != 1 or information.st_mode & 0o022 or
                (exact_mode is not None and information.st_mode & 0o7777 != exact_mode)):
            raise M7OracleError(f"{label} changed while being opened")
        blocks: list[bytes] = []
        remaining = information.st_size
        while remaining:
            block = os.read(descriptor, min(remaining, 1024 * 1024))
            if not block:
                raise M7OracleError(f"{label} ended before its declared length")
            blocks.append(block)
            remaining -= len(block)
        if os.read(descriptor, 1):
            raise M7OracleError(f"{label} changed while being read")
        return b"".join(blocks)
    finally:
        os.close(descriptor)


def parse_owned_json(path: Path, label: str, *, exact_mode: int | None = None,
                     canonical_required: bool = False) -> tuple[dict[str, Any], bytes]:
    raw = read_owned_regular(path, label, exact_mode=exact_mode)
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_members)
    except (UnicodeDecodeError, json.JSONDecodeError, M7OracleError) as exc:
        raise M7OracleError(f"{label} is not unique UTF-8 JSON") from exc
    if not isinstance(value, dict):
        raise M7OracleError(f"{label} must be a JSON object")
    if canonical_required and raw != canonical(value):
        raise M7OracleError(f"{label} is not canonical JSON")
    return value, raw


def hash_owned_regular(path: Path, label: str, *, executable: bool = False) -> tuple[int, str]:
    information = owned_regular(path, label)
    if executable and information.st_mode & 0o111 == 0:
        raise M7OracleError(f"{label} is not executable")
    raw = read_owned_regular(path, label)
    if len(raw) != information.st_size:
        raise M7OracleError(f"{label} size changed while being hashed")
    return len(raw), hashlib.sha256(raw).hexdigest()


def m7_patch() -> tuple[Path, bytes]:
    path = ROOT / M7_PATCH
    owned_regular(path, "M7 instrumentation patch")
    patch = BASE.validate_patch(path)
    changed: set[str] = set()
    for line in patch.decode("utf-8").splitlines():
        if line.startswith("diff --git a/"):
            fields = line.split()
            changed.add(fields[2][2:])
    expected = {"Makefile.usim", "ucode.c", "tv.h", "tv.c",
                "cadr_m6_debug_ir_witness.c", "cadr_m6_debug_ir_witness.h"}
    if changed != expected:
        raise M7OracleError("M7 patch does not have the reviewed six-file scope")
    return path, patch


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write_new(path: Path, bytes_value: bytes, *, failure_phase: str | None = None) -> None:
    """Durably publish one marker without replacing or retaining a partial result.

    ``failure_phase`` is an in-process test seam only; production callers pass
    no value.  It proves that write, file-sync, post-link, and directory-sync
    failures leave neither a final record nor a reusable temporary pathname.
    """
    parent = owned_directory(path.parent, "M7 marker parent")
    temporary = parent / f".{path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}"
    descriptor = -1
    published = False
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                             os.O_NOFOLLOW | os.O_CLOEXEC,
                             stat.S_IRUSR | stat.S_IWUSR)
        written = 0
        while written != len(bytes_value):
            if failure_phase == "write":
                raise M7OracleError("injected marker write failure")
            count = os.write(descriptor, bytes_value[written:])
            if count <= 0:
                raise M7OracleError("cannot write M7 oracle provenance")
            written += count
        if failure_phase == "file-fsync":
            raise M7OracleError("injected marker file-sync failure")
        os.fsync(descriptor)
        os.close(descriptor)
        descriptor = -1
        os.link(temporary, path)
        published = True
        if failure_phase == "after-link":
            raise M7OracleError("injected marker post-link failure")
        os.unlink(temporary)
        if failure_phase == "parent-fsync":
            raise M7OracleError("injected marker parent-sync failure")
        fsync_directory(parent)
    except Exception:
        if descriptor >= 0:
            os.close(descriptor)
            descriptor = -1
        try:
            os.unlink(temporary)
        except OSError:
            pass
        if published:
            try:
                os.unlink(path)
            except OSError:
                pass
            try:
                fsync_directory(parent)
            except OSError:
                pass
        raise


def m7_marker(prepared: Path) -> dict[str, Any]:
    path = prepared / "m7-prepare.json"
    value, _ = parse_owned_json(path, "M7 prepare marker", exact_mode=0o600,
                                canonical_required=True)
    expected_keys = {
        "schema", "schema_version", "m6_prepare_marker_sha256", "m6_patch_sha256",
        "m7_patch", "m7_native_support", "prepared_source_tree_sha256",
        "prepared_source_file_count",
    }
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise M7OracleError("M7 prepare marker has an unknown shape")
    if value["schema"] != "cadr-m7-frame-prepare" or value["schema_version"] != 1:
        raise M7OracleError("M7 prepare marker has the wrong schema")
    if not all(isinstance(value[field], str) and len(value[field]) == 64
               for field in ("m6_prepare_marker_sha256", "m6_patch_sha256",
                             "prepared_source_tree_sha256")):
        raise M7OracleError("M7 prepare marker has an invalid SHA-256 field")
    if not isinstance(value["prepared_source_file_count"], int) or \
            value["prepared_source_file_count"] <= 0:
        raise M7OracleError("M7 prepare marker has an invalid source count")
    return value


def prepared_usim_source(prepared: Path) -> Path:
    """Return the one exact, non-symlink source/usim closure directory."""
    owned_directory(prepared, "M7 prepared tree")
    source_parent = prepared / "source"
    source = source_parent / "usim"
    owned_directory(source_parent, "M7 prepared source root")
    owned_directory(source, "M7 prepared source/usim")
    if source.parent != source_parent or source_parent.parent != prepared:
        raise M7OracleError("M7 prepared source/usim path is not contained in the prepared tree")
    try:
        if source.resolve(strict=True) != (prepared.resolve(strict=True) / "source/usim"):
            raise M7OracleError("M7 prepared source/usim path resolved outside its closure")
    except OSError as exc:
        raise M7OracleError("M7 prepared source/usim path cannot be resolved") from exc
    return source


def validate_m7_prepared(prepared_value: str) -> tuple[Path, dict[str, Any]]:
    prepared = BASE.output_path(ROOT, prepared_value)
    owned_directory(prepared, "M7 prepared tree")
    source = prepared_usim_source(prepared)
    marker = m7_marker(prepared)
    m6_marker_path = prepared / "prepare.json"
    parent_marker, m6_marker_bytes = parse_owned_json(m6_marker_path, "M6 prepare marker",
                                                       canonical_required=True)
    if hashlib.sha256(m6_marker_bytes).hexdigest() != marker["m6_prepare_marker_sha256"]:
        raise M7OracleError("M6 preparation marker drifted after M7 preparation")
    parent_patch = parent_marker.get("instrumentation_patch") if isinstance(parent_marker, dict) else None
    if not isinstance(parent_patch, dict) or parent_patch.get("path") != M6_PATCH.name or \
            parent_patch.get("sha256") != marker["m6_patch_sha256"]:
        raise M7OracleError("M7 tree is not based on the selected M6 witness patch")
    if hash_owned_regular(ROOT / M6_PATCH, "tracked M6 patch")[1] != marker["m6_patch_sha256"]:
        raise M7OracleError("tracked M6 patch drifted after M7 preparation")
    patch_path, patch_bytes = m7_patch()
    patch_identity = marker["m7_patch"]
    if not isinstance(patch_identity, dict) or set(patch_identity) != {
            "path", "sha256", "bytes", "application"} or \
            patch_identity != {
                "path": patch_path.name, "sha256": hashlib.sha256(patch_bytes).hexdigest(),
                "bytes": len(patch_bytes),
                "application": "patch --batch --forward --fuzz=0 --posix -p1",
            }:
        raise M7OracleError("tracked M7 patch drifted after preparation")
    support = marker["m7_native_support"]
    if not isinstance(support, list) or len(support) != len(M7_SUPPORT):
        raise M7OracleError("M7 native-support inventory is incomplete")
    expected_support: dict[str, dict[str, Any]] = {}
    for index, item in enumerate(support):
        if not isinstance(item, dict) or set(item) != {"path", "installed_as", "bytes", "sha256"}:
            raise M7OracleError(f"M7 native-support inventory entry {index} has an unknown shape")
        path = item["path"]
        if not isinstance(path, str) or path in expected_support:
            raise M7OracleError("M7 native-support inventory has an invalid or duplicate path")
        expected_support[path] = item
    for relative in M7_SUPPORT:
        item = expected_support.get(relative.as_posix())
        if (not isinstance(item, dict) or set(item) != {"path", "installed_as", "bytes", "sha256"} or
                item["installed_as"] != relative.name or not isinstance(item["bytes"], int) or
                item["bytes"] < 1 or not isinstance(item["sha256"], str) or
                len(item["sha256"]) != 64 or
                hash_owned_regular(ROOT / relative, f"tracked M7 support {relative.name}")[1] != item["sha256"] or
                hash_owned_regular(source / relative.name, f"prepared M7 support {relative.name}")[1] != item["sha256"]):
            raise M7OracleError(f"M7 native support drifted: {relative.name}")
    tree_sha256, entries = BASE.prepared_source_identity(prepared)
    if (tree_sha256 != marker["prepared_source_tree_sha256"] or
            len(entries) != marker["prepared_source_file_count"]):
        raise M7OracleError("prepared M7 source tree drifted")
    return prepared, marker


def m7_build_marker(prepared: Path, marker: dict[str, Any]) -> tuple[dict[str, Any], Path]:
    """Load a closed build record and rehash exactly its prepared executable."""
    source = prepared_usim_source(prepared)
    value, _ = parse_owned_json(prepared / "m7-build.json", "M7 build marker",
                                exact_mode=0o600, canonical_required=True)
    expected_keys = {
        "schema", "schema_version", "path", "bytes", "sha256",
        "forbidden_undefined_symbol_count", "m6_patch_sha256", "m7_patch_sha256",
        "prepared_source_tree_sha256", "prepared_source_file_count",
    }
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise M7OracleError("M7 build marker has an unknown shape")
    expected_path = source / "usim"
    if (value["schema"] != "cadr-m7-frame-build" or value["schema_version"] != 1 or
            value["path"] != str(expected_path.relative_to(ROOT)) or
            not isinstance(value["bytes"], int) or value["bytes"] <= 0 or
            not isinstance(value["sha256"], str) or len(value["sha256"]) != 64 or
            value["forbidden_undefined_symbol_count"] != 0 or
            value["m6_patch_sha256"] != marker["m6_patch_sha256"] or
            value["m7_patch_sha256"] != marker["m7_patch"]["sha256"] or
            value["prepared_source_tree_sha256"] != marker["prepared_source_tree_sha256"] or
            value["prepared_source_file_count"] != marker["prepared_source_file_count"]):
        raise M7OracleError("M7 build marker is not bound to the exact prepared source closure")
    byte_count, digest = hash_owned_regular(expected_path, "M7 prepared executable", executable=True)
    if byte_count != value["bytes"] or digest != value["sha256"]:
        raise M7OracleError("M7 prepared executable drifted after its build marker")
    return value, expected_path


def prepare(*, output_value: str) -> dict[str, Any]:
    """Build a private M7 source closure atop the frozen M6 prepared closure."""
    try:
        output = BASE.output_path(ROOT, output_value)
        response = BASE.prepare(
            repo_root=ROOT, profile_path=ROOT / "cadr-web/profiles/cadr-web-303.json",
            source_manifest_path=ROOT / "cadr-web/oracle/source-files.json",
            output_value=output_value, patch_path=ROOT / M6_PATCH)
        if response.get("status") != "ok":
            raise M7OracleError("M6 source-closure preparation failed: " +
                                json.dumps(response.get("errors", []), sort_keys=True))
        prepared, parent_marker = BASE.load_prepare_marker(ROOT, output_value)
        patch_path, patch_bytes = m7_patch()
        patch_identity = BASE.apply_patch_exactly(
            patch_path=patch_path, patch_bytes=patch_bytes, source_root=prepared / "source/usim")
        installed = BASE.install_native_support(ROOT, prepared / "source/usim", M7_SUPPORT)
        source_tree_sha256, entries = BASE.prepared_source_identity(prepared)
        marker = {
            "schema": "cadr-m7-frame-prepare", "schema_version": 1,
            "m6_prepare_marker_sha256": sha256_file(prepared / "prepare.json"),
            "m6_patch_sha256": parent_marker["instrumentation_patch"]["sha256"],
            "m7_patch": patch_identity, "m7_native_support": installed,
            "prepared_source_tree_sha256": source_tree_sha256,
            "prepared_source_file_count": len(entries),
        }
        atomic_write_new(prepared / "m7-prepare.json", canonical(marker))
        return {"status": "ok", "operation": "prepare",
                "output": str(output.relative_to(ROOT)), "prepare": marker}
    except (BASE.OracleError, M7OracleError, OSError, KeyError, TypeError) as exc:
        return {"status": "invalid", "operation": "prepare", "error": str(exc)}


def build(*, prepared_value: str) -> dict[str, Any]:
    """Compile the no-window M7 frame backend and reject host-time/UI imports."""
    try:
        prepared, marker = validate_m7_prepared(prepared_value)
        source = prepared_usim_source(prepared)
        completed = subprocess.run(
            ["make", "-f", "Makefile.usim", "USIM_BACKEND=m7-frame-oracle",
             "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos", "LDFLAGS=-no-pie"],
            cwd=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
        if completed.returncode != 0:
            raise M7OracleError("M7 native oracle build failed: " + completed.stderr[-2000:])
        executable = source / "usim"
        symbols = subprocess.run(["nm", "-u", str(executable)], stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, check=False)
        if symbols.returncode != 0:
            raise M7OracleError("cannot audit M7 native oracle symbols")
        forbidden = (" X", "SDL_", "socket", "connect", "select", "gettimeofday",
                     "clock_gettime", "setitimer", "pthread_create", "pthread_cond_wait")
        hits = sorted(line for line in symbols.stdout.splitlines()
                      if any(token in line for token in forbidden))
        if hits:
            raise M7OracleError("forbidden native dependency: " + "; ".join(hits))
        tree_sha256, entries = BASE.prepared_source_identity(prepared)
        if (tree_sha256 != marker["prepared_source_tree_sha256"] or
                len(entries) != marker["prepared_source_file_count"]):
            raise M7OracleError("M7 build changed its prepared source closure")
        executable_bytes, executable_sha256 = hash_owned_regular(
            executable, "M7 prepared executable", executable=True)
        identity = {
            "path": str(executable.relative_to(ROOT)), "bytes": executable_bytes,
            "sha256": executable_sha256, "forbidden_undefined_symbol_count": 0,
            "m6_patch_sha256": marker["m6_patch_sha256"],
            "m7_patch_sha256": marker["m7_patch"]["sha256"],
            "prepared_source_tree_sha256": tree_sha256,
            "prepared_source_file_count": len(entries),
        }
        atomic_write_new(prepared / "m7-build.json", canonical({
            "schema": "cadr-m7-frame-build", "schema_version": 1, **identity}))
        return {"status": "ok", "operation": "build", "build": identity}
    except (BASE.OracleError, M7OracleError, OSError) as exc:
        return {"status": "invalid", "operation": "build", "error": str(exc)}


def private_capture_path(value: str) -> Path:
    relative = BASE.relative_path(value, "M7 frame capture")
    BASE.reject_symlink_components(ROOT, relative, "M7 frame capture")
    path = BASE.safe_path(ROOT, relative, "M7 frame capture")
    allowed = ROOT / "build/cadr-oracle"
    try:
        path.relative_to(allowed)
    except ValueError as exc:
        raise M7OracleError("M7 frame capture must remain under ignored build/cadr-oracle") from exc
    return path


def open_private_capture(value: str) -> tuple[Path, int]:
    """Open one capture without following its final component, then verify it.

    The descriptor, rather than an earlier path-stat result, is the sole input
    to the parser.  This prevents an attacker from swapping the final file
    between a name check and ``read``.
    """
    path = private_capture_path(value)
    flags = os.O_RDONLY | os.O_CLOEXEC
    if not hasattr(os, "O_NOFOLLOW"):
        raise M7OracleError("platform lacks the required O_NOFOLLOW capture guard")
    try:
        descriptor = os.open(path, flags | os.O_NOFOLLOW)
    except OSError as exc:
        raise M7OracleError("M7 frame capture cannot be opened safely") from exc
    try:
        information = os.fstat(descriptor)
        if (not stat.S_ISREG(information.st_mode) or information.st_nlink != 1 or
                (information.st_mode & 0o7777) != 0o600 or
                information.st_uid != os.geteuid()):
            raise M7OracleError(
                "M7 frame capture must be a current-owner 0600 singly linked regular file")
        return path, descriptor
    except Exception:
        os.close(descriptor)
        raise


def parse_cdrm7n1(path: Path) -> dict[str, Any]:
    """Validate the complete fixed native record, retaining only its evidence hash."""
    expected_size = FRAME_HEADER_BYTES + FRAME_PAYLOAD_BYTES
    try:
        capture_value = path.relative_to(ROOT).as_posix()
    except ValueError as exc:
        raise M7OracleError("M7 frame capture must have a repository-relative private path") from exc
    _, descriptor = open_private_capture(capture_value)
    try:
        information = os.fstat(descriptor)
        if information.st_size != expected_size:
            raise M7OracleError("CDRM7N1 capture has the wrong fixed length")
        blocks: list[bytes] = []
        remaining = expected_size
        while remaining:
            block = os.read(descriptor, remaining)
            if not block:
                raise M7OracleError("CDRM7N1 capture ended before its declared fixed length")
            blocks.append(block)
            remaining -= len(block)
        if os.read(descriptor, 1):
            raise M7OracleError("CDRM7N1 capture changed while it was verified")
        value = b"".join(blocks)
    finally:
        os.close(descriptor)
    if value[:7] != b"CDRM7N1" or value[7] != 0:
        raise M7OracleError("CDRM7N1 capture has the wrong magic")
    u32 = lambda offset: int.from_bytes(value[offset:offset + 4], "little")
    boundary = int.from_bytes(value[16:24], "little")
    version, header_bytes = u32(8), u32(12)
    width, height, tv_mode, bow = u32(24), u32(28), u32(32), u32(36)
    backing, active, payload, flags = u32(40), u32(44), u32(48), u32(52)
    if (version != 1 or header_bytes != FRAME_HEADER_BYTES or boundary != M7_C_BOUNDARY or
            (width, height, backing, active, payload, flags) !=
            (FRAME_WIDTH, FRAME_HEIGHT, FRAME_BACKING_WORDS, FRAME_ACTIVE_WORDS,
             FRAME_PAYLOAD_BYTES, 0) or bow not in (0, 1) or ((tv_mode >> 2) & 1) != bow or
            any(value[index] != 0 for index in range(56, FRAME_HEADER_BYTES))):
        raise M7OracleError("CDRM7N1 capture has an invalid fixed header")
    return {
        "schema": FRAME_SCHEMA, "sha256": hashlib.sha256(value).hexdigest(),
        "byte_count": str(len(value)), "boundary": str(boundary),
        "width": width, "height": height, "stride_words": FRAME_STRIDE_WORDS,
        "backing_words": backing, "active_words": active, "tv_mode": tv_mode,
        "black_on_white": bool(bow), "raw_words_sha256": hashlib.sha256(
            value[FRAME_HEADER_BYTES:]).hexdigest(),
    }


def verify_capture(*, capture_value: str, expected_boundary: str | None) -> dict[str, Any]:
    try:
        record = parse_cdrm7n1(private_capture_path(capture_value))
        if expected_boundary is not None:
            if not expected_boundary.isascii() or not expected_boundary.isdecimal() or \
                    str(int(expected_boundary)) != expected_boundary:
                raise M7OracleError("expected boundary must be a canonical decimal integer")
            if record["boundary"] != expected_boundary:
                raise M7OracleError("CDRM7N1 boundary differs from the requested checkpoint")
        return {"status": "ok", "operation": "verify-capture",
                "verification_schema": "cadr-m7-frame-capture-verification-v1",
                "capture": record,
                "rights": "private ignored raw capture; no pixels are published"}
    except (BASE.OracleError, M7OracleError, OSError, ValueError) as exc:
        return {"status": "invalid", "operation": "verify-capture", "error": str(exc)}


def native_execution_environment(*, schedule: Path, raw_log: Path, idle_samples: Path,
                                 session_id: str, frame_output: Path) -> dict[str, str]:
    """The only approved future native M7 child environment.

    The four M6 witness controls and M7's exact output pathname are all
    explicit.  No ambient PATH, display, locale, credentials, or media path is
    inherited.  Callers must independently require ``frame_output`` to be a
    fresh absolute path in the private run directory before invoking usim.
    """
    if (not session_id or any(not path.is_absolute() for path in
                              (schedule, raw_log, idle_samples, frame_output))):
        raise M7OracleError("M7 native execution inputs must be absolute and session-bound")
    return {
        **EXECUTION_ENVIRONMENT["variables"],
        "CADR_M6_RAW_SCHEDULE": str(schedule), "CADR_M6_NATIVE_LOG": str(raw_log),
        "CADR_M6_IDLE_SAMPLES": str(idle_samples), "CADR_M6_SESSION_ID": session_id,
        "CADR_M7_FRAME_OUTPUT": str(frame_output),
    }


def capture_plan(*, prepared_value: str) -> dict[str, Any]:
    """Validate the future capture integration boundary without executing usim.

    This is intentionally an inert command.  A runtime campaign must allocate
    a new 0700 directory below ignored ``build/cadr-oracle/``, materialize the
    canonical M6 private inputs there using the reviewed M6 copy/configuration
    helpers, copy this exact M7 executable into that directory, then call
    ``native_execution_environment`` with its new schedule/raw/idle/output
    files.  Only after a clean process result and ``verify-capture`` may the
    protocol-v5 checkpoint wrapper be run against the same frozen artifacts.
    """
    try:
        prepared, marker = validate_m7_prepared(prepared_value)
        build, executable = m7_build_marker(prepared, marker)
        return {
            "status": "planned", "operation": "capture-plan",
            "runtime_execution_performed": False,
            "prepared": str(prepared.relative_to(ROOT)),
            "executable": str(executable.relative_to(ROOT)),
            "required_private_files": ["schedule.ndjson", "capture.ndjson", "idle.bin",
                                       "frame.cdrm7n1", "private configuration", "private disk"],
            "environment_policy": EXECUTION_ENVIRONMENT["policy_id"],
            "next_operations": [
                "make a new 0700 ignored run directory and private M6 inputs",
                "run only its copied m7-frame-oracle executable with the complete explicit environment",
                "strictly verify its 0600 CDRM7N1 output at completed Form-C boundary 982990214",
                "run the protocol-v5 M7 wrapper and compare the paired raw frames",
            ],
        }
    except (BASE.OracleError, M7OracleError, OSError) as exc:
        return {"status": "invalid", "operation": "capture-plan", "error": str(exc)}


def _copy_new_private(source: Path, destination: Path, label: str) -> None:
    """Copy a checked private by-product without replacing a prior capture."""
    if destination.exists() or destination.is_symlink():
        raise M7OracleError(f"refusing to replace {label}")
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                         os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    try:
        with source.open("rb") as input_stream:
            while True:
                block = input_stream.read(1024 * 1024)
                if not block:
                    break
                offset = 0
                while offset != len(block):
                    count = os.write(descriptor, block[offset:])
                    if count <= 0:
                        raise M7OracleError(f"cannot write {label}")
                    offset += count
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    owned_regular(destination, label, exact_mode=0o600)


def _m7_release_identity() -> dict[str, Any]:
    """Read the canonical M6 envelope which M7 must not rewrite."""
    path = ROOT / "cadr-web/oracle/cadr-m6-release-record.json"
    raw = read_owned_regular(path, "frozen M6 release record")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_members)
    except (UnicodeDecodeError, json.JSONDecodeError, M7OracleError) as exc:
        raise M7OracleError("frozen M6 release record is not unique UTF-8 JSON") from exc
    if not isinstance(value, dict) or value.get("schema") != "cadr-m6-native-debug-ir-release-record-v1":
        raise M7OracleError("frozen M6 release record has the wrong schema")
    return {"path": str(path.relative_to(ROOT)), "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest()}


def native_capture(*, prepared_value: str, config_value: str, output_value: str,
                   session_id: str, private_disk_instance_id: str) -> dict[str, Any]:
    """Run exactly one fresh M7 native capture into an already-private directory.

    This is deliberately not wired to ``capture-plan`` and is never selected by
    default.  Its caller must have made a new 0700 session directory.  The
    output contains exactly the M7 private layout's native four files; copied
    artifacts and the transient rendered configuration are discarded after
    their hashes have been recorded.
    """
    try:
        if not session_id or not private_disk_instance_id:
            raise M7OracleError("M7 native session and private-disk IDs are required")
        if any(not character.isalnum() and character not in "_-"
               for character in session_id + private_disk_instance_id):
            raise M7OracleError("M7 native session identifiers have unsupported characters")
        if len(session_id) > 128 or len(private_disk_instance_id) > 128:
            raise M7OracleError("M7 native session identifiers are too long")
        prepared, marker = validate_m7_prepared(prepared_value)
        build, executable = m7_build_marker(prepared, marker)
        config = M6_NATIVE.regular(Path(config_value), "M7 native configuration")
        output = Path(output_value).resolve()
        owned_directory(output, "M7 native output directory")
        if (output.stat().st_mode & 0o7777) != 0o700:
            raise M7OracleError("M7 native output directory must have exact mode 0700")
        if any(output.iterdir()):
            raise M7OracleError("M7 native output directory must be empty")
        profile = M6_NATIVE.read_json(M6_NATIVE.PROFILE)
        pins = profile.get("source_pins")
        if not isinstance(pins, dict):
            raise M7OracleError("CADR-WEB profile has no source pins")
        mapping = M6_NATIVE.load_schedule_module()
        frozen = mapping.schedule()
        input_paths, base_disk = M6_NATIVE.load_capture_inputs(config)
        artifacts, native_inputs = M6_NATIVE.profile_inputs(profile, input_paths, base_disk)
        by_kind = {item["kind"]: item for item in artifacts}
        if set(by_kind) != {1, 2, 3, 4, 5} or len(native_inputs) != 1:
            raise M7OracleError("M7 requires the exact five M6 artifacts and native hosts input")
        original_umask = os.umask(0o077)
        try:
            with tempfile.TemporaryDirectory(prefix=".m7-runtime-", dir=output) as temporary:
                runtime = Path(temporary)
                os.chmod(runtime, 0o700)
                fs_root = runtime / "fs-root"
                private_template = runtime / "inputs/cadr-web-303.ini.in"
                private_disk = runtime / "disk-sys-303-0.img"
                rendered_config = runtime / "usim.ini"
                schedule = runtime / "schedule.txt"
                raw = runtime / "capture.ndjson"
                idle = runtime / "idle.bin"
                frame = runtime / "frame.cdrm7n1"
                private_executable = M6_NATIVE.copy_private_executable(
                    executable, runtime, build["sha256"])
                M6_NATIVE.copy_verified(ROOT / "cadr-web/profiles/cadr-web-303.ini.in",
                                        private_template, by_kind[1], "M7 config template")
                M6_NATIVE.copy_verified(input_paths[0], fs_root / "sys/ubin/promh.mcr",
                                        by_kind[2], "M7 control-store PROM")
                M6_NATIVE.copy_verified(input_paths[1], fs_root / "sys/ubin/promh.sym",
                                        by_kind[4], "M7 PROM symbols")
                M6_NATIVE.copy_verified(input_paths[2], fs_root / "sys/ubin/ucadr.sym",
                                        by_kind[5], "M7 microcode symbols")
                M6_NATIVE.copy_verified(input_paths[3], fs_root / "usite/extra.hosts",
                                        native_inputs[0], "M7 Chaos hosts")
                M6_NATIVE.copy_verified(base_disk, private_disk, by_kind[3], "M7 base disk")
                disk_before = sha256_file(private_disk)
                if disk_before != by_kind[3]["sha256"]:
                    raise M7OracleError("private M7 disk does not equal the selected base artifact")
                M6_NATIVE.render_private_config(private_template, fs_root, private_disk, runtime,
                                                rendered_config)
                M6_NATIVE.assert_private_execution_config(rendered_config, fs_root, private_disk,
                                                         runtime)
                mapping.write_native(frozen, schedule)
                environment = native_execution_environment(
                    schedule=schedule.resolve(), raw_log=raw.resolve(), idle_samples=idle.resolve(),
                    session_id=session_id, frame_output=frame.resolve())
                completed = M6_NATIVE.execute_private_m6(runtime, private_executable,
                                                          rendered_config, environment)
                if completed.returncode != 0:
                    raise M7OracleError("M7 native executable exited " + str(completed.returncode) +
                                        ": " + completed.stderr[-1000:])
                disk_after = sha256_file(private_disk)
                if disk_before != disk_after or disk_after != by_kind[3]["sha256"]:
                    raise M7OracleError("M7 native private disk changed during capture")
                raw_lines = read_owned_regular(raw, "M7 native raw transcript").decode("utf-8").splitlines()
                if not raw_lines:
                    raise M7OracleError("M7 native raw transcript is empty")
                try:
                    raw_meta = json.loads(raw_lines[0], object_pairs_hook=reject_duplicate_members)
                    raw_complete = json.loads(raw_lines[-1], object_pairs_hook=reject_duplicate_members)
                except (json.JSONDecodeError, M7OracleError) as exc:
                    raise M7OracleError("M7 native raw transcript endpoints are invalid") from exc
                if (raw_meta != {"kind": "meta", "schema": M6_NATIVE.RAW_SCHEMA,
                                 "schedule_sha256": frozen["schedule"]["sha256"],
                                 "schedule_events": frozen["schedule"]["event_count"],
                                 "session_id": session_id} or
                        raw_complete != {"kind": "complete", "clean_shutdown": True,
                                         "schedule_consumed": frozen["schedule"]["event_count"],
                                         "debug_ir_writes": 9}):
                    raise M7OracleError("M7 native raw transcript does not bind session and schedule")
                parsed_frame = parse_cdrm7n1(frame)
                if parsed_frame["boundary"] != str(M7_C_BOUNDARY):
                    raise M7OracleError("M7 native frame is not at the completed Form-C boundary")
                _copy_new_private(frame, output / "frame.cdrm7n1", "M7 native frame")
                _copy_new_private(raw, output / "capture.ndjson", "M7 native transcript")
                _copy_new_private(idle, output / "idle.bin", "M7 native idle samples")
        finally:
            os.umask(original_umask)
        metadata = {
            "schema": M7_NATIVE_CAPTURE_SCHEMA, "target": M7_TARGET,
            "session_id": session_id, "private_disk_instance_id": private_disk_instance_id,
            "source": {"system_fossil": pins["sys"]["revision"],
                       "usim_fossil": pins["usim"]["revision"]},
            "m6_release_record": _m7_release_identity(),
            "patches": {"m6_sha256": marker["m6_patch_sha256"],
                        "m7_sha256": marker["m7_patch"]["sha256"],
                        "m7_support": marker["m7_native_support"]},
            "prepared": {"path": str(prepared.relative_to(ROOT)),
                         "source_tree_sha256": marker["prepared_source_tree_sha256"],
                         "source_file_count": marker["prepared_source_file_count"],
                         "executable": {key: value for key, value in build.items()
                                        if key not in ("schema", "schema_version")}},
            "artifacts": artifacts, "native_inputs": native_inputs,
            "schedule": {"sha256": frozen["schedule"]["sha256"],
                         "event_count": frozen["schedule"]["event_count"],
                         "mapping_sha256": frozen["mapping"]["sha256"]},
            "private_disk": {"sha256_at_start": disk_before, "sha256_at_end": disk_after},
            "process": {"returncode": 0, "timed_out": False, "forced_stop": False,
                        "state_may_be_incomplete": False, "pending_host_requests": 0},
            "capture": parsed_frame,
            "transcript": {"sha256": sha256_file(output / "capture.ndjson"),
                           "idle_samples_sha256": sha256_file(output / "idle.bin")},
        }
        atomic_write_new(output / "metadata.json", canonical_result(metadata))
        if {item.name for item in output.iterdir()} != {
                "frame.cdrm7n1", "capture.ndjson", "idle.bin", "metadata.json"}:
            raise M7OracleError("M7 native output has an unexpected sidecar")
        return {"status": "captured", "operation": "native-capture", "metadata": metadata}
    except (BASE.OracleError, M7OracleError, M6_NATIVE.ProbeError, OSError,
            subprocess.TimeoutExpired, ValueError) as exc:
        return {"status": "invalid", "operation": "native-capture", "error": str(exc)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="operation", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--output", default=DEFAULT_PREPARED)
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    plan_parser = commands.add_parser("capture-plan")
    plan_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    verify_parser = commands.add_parser("verify-capture")
    verify_parser.add_argument("--capture", required=True)
    verify_parser.add_argument("--expected-boundary", default=str(M7_C_BOUNDARY))
    capture_parser = commands.add_parser("native-capture")
    capture_parser.add_argument("--prepared", default=DEFAULT_PREPARED)
    capture_parser.add_argument("--config", required=True)
    capture_parser.add_argument("--output", required=True)
    capture_parser.add_argument("--session-id", required=True)
    capture_parser.add_argument("--private-disk-instance-id", required=True)
    capture_parser.add_argument("--execute", action="store_true")
    arguments = parser.parse_args(argv)
    if arguments.operation == "prepare":
        response = prepare(output_value=arguments.output)
    elif arguments.operation == "build":
        response = build(prepared_value=arguments.prepared)
    elif arguments.operation == "capture-plan":
        response = capture_plan(prepared_value=arguments.prepared)
    elif arguments.operation == "native-capture":
        if not arguments.execute:
            response = {"status": "invalid", "operation": "native-capture",
                        "error": "explicit --execute is required"}
        else:
            response = native_capture(prepared_value=arguments.prepared, config_value=arguments.config,
                                      output_value=arguments.output, session_id=arguments.session_id,
                                      private_disk_instance_id=arguments.private_disk_instance_id)
    else:
        response = verify_capture(capture_value=arguments.capture,
                                  expected_boundary=arguments.expected_boundary)
    print(json.dumps(response, sort_keys=True))
    return 0 if response["status"] in SUCCESS_STATUSES else 2


if __name__ == "__main__":
    raise SystemExit(main())
