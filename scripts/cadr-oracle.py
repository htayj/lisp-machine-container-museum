#!/usr/bin/env python3
"""Prepare a fail-closed CADR native-oracle source closure and patch boundary."""
from __future__ import annotations

import argparse
import configparser
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import Any

REPOSITORY = Path(__file__).resolve().parents[1]
DEFAULT_PROFILE = Path("cadr-web/profiles/cadr-web-303.json")
DEFAULT_SOURCE_MANIFEST = Path("cadr-web/oracle/source-files.json")
DEFAULT_OUTPUT = Path("build/cadr-oracle/prepared")
DEFAULT_PATCH = Path("cadr-web/oracle/patches/0001-native-boundary-oracle.patch")
NATIVE_SUPPORT = (
    Path("cadr-web/oracle/native/cadr_oracle_native.c"),
    Path("cadr-web/oracle/native/cadr_oracle_native.h"),
    Path("cadr-web/oracle/native/cadr_oracle_idle_stubs.c"),
    Path("cadr-web/oracle/native/cadr_oracle_lashup_stubs.c"),
)
SOURCE_SUFFIXES = {".c", ".h", ".defs"}
SOURCE_NAMES = {"Makefile.usim", "COPYING.md"}


class OracleError(ValueError):
    """Inputs did not establish a safe oracle-preparation boundary."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True) + "\n").encode("utf-8")


def summary(status: str, operation: str, **fields: Any) -> dict[str, Any]:
    return {"status": status, "operation": operation, **fields}


def invalid(operation: str, code: str, detail: str) -> dict[str, Any]:
    return summary("invalid", operation, errors=[{"code": code, "detail": detail}])


def relative_path(value: Any, field: str) -> Path:
    if not isinstance(value, str) or not value:
        raise OracleError(f"{field} must be a non-empty repository-relative path")
    parsed = PurePosixPath(value)
    if parsed.is_absolute() or ".." in parsed.parts or "\\" in value:
        raise OracleError(f"{field} is not repository-relative: {value!r}")
    if any(part in ("", ".") for part in parsed.parts):
        raise OracleError(f"{field} is not normalized: {value!r}")
    return Path(*parsed.parts)


def safe_path(repo_root: Path, relative: Path, field: str) -> Path:
    root = repo_root.resolve()
    candidate = root / relative
    try:
        candidate.resolve(strict=False).relative_to(root)
    except (OSError, RuntimeError, ValueError) as exc:
        raise OracleError(f"{field} escapes repository root") from exc
    return candidate


def reject_symlink_components(root: Path, relative: Path, field: str) -> None:
    current = root
    for component in relative.parts:
        current = current / component
        if current.is_symlink():
            raise OracleError(f"{field} contains a symlink component: {component}")


def is_source_name(name: str) -> bool:
    """Return whether *name* is source material which must be closed over.

    Generated objects, Fossil administration, archives, and runtime media never
    enter this predicate.  The manifest is deliberately a source closure, not a
    convenient recursive copy of the local checkout.
    """
    return name in SOURCE_NAMES or Path(name).suffix in SOURCE_SUFFIXES


def is_closure_source_name(name: str) -> bool:
    """The v2 closure additionally pins subordinate build recipes."""
    return is_source_name(name) or name == "Makefile" or name.startswith("Makefile.")


def load_json(path: Path, field: str) -> tuple[Any, bytes]:
    try:
        raw = path.read_bytes()
        return json.loads(raw.decode("utf-8")), raw
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise OracleError(f"cannot read {field}: {exc}") from exc


def load_profile_verifier() -> Any:
    path = REPOSITORY / "scripts" / "verify-cadr-web-profile.py"
    spec = importlib.util.spec_from_file_location("cadr_oracle_profile_verifier", path)
    if spec is None or spec.loader is None:
        raise OracleError("cannot load the CADR-WEB profile verifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _validate_expected_revision(revision: Any, field: str) -> dict[str, Any]:
    if not isinstance(revision, dict) or set(revision) != {
        "vcs", "hash_algorithm", "revision", "verification", "reason"
    }:
        raise OracleError(f"{field} has the wrong shape")
    if revision["vcs"] != "fossil" or revision["hash_algorithm"] != "sha3-256":
        raise OracleError(f"{field} must be a Fossil SHA3-256 id")
    if not isinstance(revision["revision"], str) or len(revision["revision"]) != 64:
        raise OracleError(f"{field}.revision must be complete")
    if revision["verification"] != "asserted-not-live-verified":
        raise OracleError(f"{field} must be asserted-not-live-verified")
    if not isinstance(revision["reason"], str) or not revision["reason"]:
        raise OracleError(f"{field}.reason must be non-empty")
    return revision


def _validate_file_list(files: Any, field: str, *, flat: bool) -> list[dict[str, Any]]:
    if not isinstance(files, list) or not files:
        raise OracleError(f"{field} must be a non-empty list")
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, entry in enumerate(files):
        entry_field = f"{field}[{index}]"
        if not isinstance(entry, dict) or set(entry) != {"path", "bytes", "sha256"}:
            raise OracleError(f"{entry_field} must contain path, bytes, and sha256 only")
        name = relative_path(entry["path"], f"{entry_field}.path")
        allowed_name = is_source_name(name.name) if flat else is_closure_source_name(name.name)
        if (flat and len(name.parts) != 1) or not allowed_name:
            raise OracleError(f"{entry_field} is not an allowed source input")
        key = name.as_posix()
        if key in seen:
            raise OracleError(f"duplicate source-manifest entry: {key}")
        seen.add(key)
        if not isinstance(entry["bytes"], int) or isinstance(entry["bytes"], bool) or entry["bytes"] < 0:
            raise OracleError(f"{entry_field}.bytes must be a non-negative integer")
        digest = entry["sha256"]
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise OracleError(f"{entry_field}.sha256 must be lowercase SHA-256")
        result.append({"path": key, "bytes": entry["bytes"], "sha256": digest})
    return result


def validate_source_manifest(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise OracleError("source manifest must be an object")
    if manifest.get("schema") != "cadr-oracle-source-files" or manifest.get("schema_version") not in (1, 2):
        raise OracleError("unsupported source-manifest schema")
    # Schema v1 remains readable so existing audited fixture manifests retain
    # their meaning.  New production manifests use v2's named multi-root
    # closure: usim's Makefile directly compiles and archives Chaos sources.
    if manifest["schema_version"] == 2:
        if set(manifest) != {"schema", "schema_version", "profile_id", "sources"}:
            raise OracleError("source-manifest v2 has the wrong shape")
        if not isinstance(manifest.get("profile_id"), str) or not manifest["profile_id"]:
            raise OracleError("source manifest profile_id must be a non-empty string")
        sources = manifest.get("sources")
        if not isinstance(sources, list) or not sources:
            raise OracleError("source manifest sources must be a non-empty list")
        normalized: list[dict[str, Any]] = []
        ids: set[str] = set()
        for index, source in enumerate(sources):
            if not isinstance(source, dict) or set(source) != {"id", "source_root", "profile_source_pin", "expected_source_revision", "files"}:
                raise OracleError(f"sources[{index}] has the wrong shape")
            source_id = source["id"]
            if not isinstance(source_id, str) or not source_id or "/" in source_id or "\\" in source_id or source_id in ids:
                raise OracleError(f"sources[{index}].id must be a unique simple identifier")
            ids.add(source_id)
            if not isinstance(source["profile_source_pin"], str) or not source["profile_source_pin"]:
                raise OracleError(f"sources[{index}].profile_source_pin must be non-empty")
            relative_path(source["source_root"], f"sources[{index}].source_root")
            normalized.append({
                "id": source_id,
                "source_root": source["source_root"],
                "profile_source_pin": source["profile_source_pin"],
                "expected_source_revision": _validate_expected_revision(source["expected_source_revision"], f"sources[{index}].expected_source_revision"),
                "files": _validate_file_list(source["files"], f"sources[{index}].files", flat=False),
            })
        manifest = dict(manifest)
        manifest["_sources"] = normalized
        return manifest
    for field in ("profile_id", "source_root", "profile_source_pin"):
        if not isinstance(manifest.get(field), str) or not manifest[field]:
            raise OracleError(f"source manifest {field} must be a non-empty string")
    relative_path(manifest["source_root"], "source_root")
    manifest = dict(manifest)
    manifest["expected_source_revision"] = _validate_expected_revision(manifest.get("expected_source_revision"), "expected_source_revision")
    manifest["_sources"] = [{
        "id": "source", "source_root": manifest["source_root"],
        "profile_source_pin": manifest["profile_source_pin"],
        "expected_source_revision": manifest["expected_source_revision"],
        "files": _validate_file_list(manifest.get("files"), "files", flat=True),
    }]
    return manifest


def validate_profile(profile: Any, repo_root: Path, source_manifest: dict[str, Any]) -> None:
    verification = load_profile_verifier().verify_profile(profile, repo_root)
    if verification.get("status") != "ok":
        raise OracleError(f"profile verification failed: {verification.get('errors', [])}")
    if profile.get("profile", {}).get("id") != source_manifest["profile_id"]:
        raise OracleError("profile id does not match source manifest")
    for source in source_manifest["_sources"]:
        pin = profile.get("source_pins", {}).get(source["profile_source_pin"])
        expected = source["expected_source_revision"]
        if pin != {"vcs": expected["vcs"], "hash_algorithm": expected["hash_algorithm"], "revision": expected["revision"]}:
            raise OracleError(f"profile source pin does not match expected source revision for {source['id']}")


def verified_sources(repo_root: Path, source_manifest: dict[str, Any]) -> list[dict[str, Any]]:
    verified: list[dict[str, Any]] = []
    for source_spec in source_manifest["_sources"]:
        source_relative = relative_path(source_spec["source_root"], f"source_root {source_spec['id']}")
        reject_symlink_components(repo_root, source_relative, f"source_root {source_spec['id']}")
        source = safe_path(repo_root, source_relative, f"source_root {source_spec['id']}")
        if source.is_symlink() or not source.is_dir():
            raise OracleError(f"source_root {source_spec['id']} must be a non-symlink directory")
        expected = {item["path"]: item for item in source_spec["files"]}
        actual: set[str] = set()
        for child in source.rglob("*"):
            relative = child.relative_to(source).as_posix()
            if child.is_symlink():
                raise OracleError(f"source tree contains a symlink: {source_spec['id']}/{relative}")
            source_name = is_source_name(child.name) if source_manifest["schema_version"] == 1 else is_closure_source_name(child.name)
            if child.is_file() and source_name:
                actual.add(relative)
        if actual - set(expected):
            raise OracleError(f"unexpected source files in {source_spec['id']}: {', '.join(sorted(actual - set(expected)))}")
        if set(expected) - actual:
            raise OracleError(f"manifest source files are missing in {source_spec['id']}: {', '.join(sorted(set(expected) - actual))}")
        for name in sorted(expected):
            path = source / name
            item = expected[name]
            digest, byte_count = hash_regular_file_no_follow(path, f"{source_spec['id']}/{name}")
            if byte_count != item["bytes"]:
                raise OracleError(f"source size drift for {source_spec['id']}/{name}")
            if digest != item["sha256"]:
                raise OracleError(f"source hash drift for {source_spec['id']}/{name}")
            verified.append({"source_id": source_spec["id"], "source_root": source, "path": name, "bytes": item["bytes"], "sha256": digest})
    return verified


def hash_regular_file_no_follow(path: Path, name: str) -> tuple[str, int]:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags)
    except OSError as exc:
        raise OracleError(f"cannot open manifest source without following links: {name}") from exc
    try:
        information = os.fstat(descriptor)
        if not stat.S_ISREG(information.st_mode):
            raise OracleError(f"manifest source is not a regular file: {name}")
        digest = hashlib.sha256()
        byte_count = 0
        while True:
            block = os.read(descriptor, 1024 * 1024)
            if not block:
                break
            digest.update(block)
            byte_count += len(block)
        return digest.hexdigest(), byte_count
    finally:
        os.close(descriptor)


def copy_regular_file_no_follow(source: Path, destination: Path, item: dict[str, Any]) -> None:
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(source, flags)
    except OSError as exc:
        raise OracleError(f"cannot copy source without following links: {item['path']}") from exc
    try:
        information = os.fstat(descriptor)
        if not stat.S_ISREG(information.st_mode):
            raise OracleError(f"source changed to a non-regular file: {item['path']}")
        digest = hashlib.sha256()
        byte_count = 0
        with destination.open("xb") as output:
            while True:
                block = os.read(descriptor, 1024 * 1024)
                if not block:
                    break
                output.write(block)
                digest.update(block)
                byte_count += len(block)
        if byte_count != item["bytes"] or digest.hexdigest() != item["sha256"]:
            raise OracleError(f"source changed while being copied: {item['path']}")
    finally:
        os.close(descriptor)


def output_path(repo_root: Path, value: str) -> Path:
    relative = relative_path(value, "output")
    reject_symlink_components(repo_root, relative, "output")
    output = safe_path(repo_root, relative, "output")
    allowed_relative = Path("build") / "cadr-oracle"
    reject_symlink_components(repo_root, allowed_relative, "oracle output root")
    allowed = repo_root / allowed_relative
    try:
        output.relative_to(allowed)
    except (OSError, RuntimeError, ValueError) as exc:
        raise OracleError("output must be under build/cadr-oracle") from exc
    return output


def verify_output(source_roots: list[Path], output: Path) -> None:
    if any(output.resolve(strict=False) == source.resolve() for source in source_roots):
        raise OracleError("source_root and output must not be the same directory")
    if output.exists() and (output.is_symlink() or not output.is_dir() or any(output.iterdir())):
        raise OracleError("output must be absent or an empty non-symlink directory")


def tracked_patch_path(repo_root: Path, patch_path: Path) -> Path:
    """Require the patch itself to be a tracked oracle input, not a temp file."""
    try:
        relative = patch_path.resolve(strict=True).relative_to((repo_root / "cadr-web/oracle/patches").resolve(strict=True))
    except (OSError, RuntimeError, ValueError) as exc:
        raise OracleError("instrumentation patch must be below cadr-web/oracle/patches") from exc
    if patch_path.is_symlink() or relative.name != "0001-native-boundary-oracle.patch":
        raise OracleError("instrumentation patch is not the selected tracked patch")
    return patch_path


def validate_patch(patch_path: Path) -> bytes:
    """Return a tracked textual patch after rejecting ambiguous patch features."""
    try:
        data = patch_path.read_bytes()
    except OSError as exc:
        raise OracleError(f"cannot read instrumentation patch: {exc}") from exc
    if not data or b"\0" in data:
        raise OracleError("instrumentation patch must be non-empty text")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise OracleError("instrumentation patch must be UTF-8 text") from exc
    if not text.endswith("\n") or "GIT binary patch" in text or "new file mode 120000" in text:
        raise OracleError("instrumentation patch contains an unsupported binary or symlink change")
    if not text.startswith("diff --git a/"):
        raise OracleError("instrumentation patch must be a Git-style unified diff")
    for line in text.splitlines():
        if not line.startswith("diff --git "):
            continue
        parts = line.split()
        if len(parts) != 4 or not parts[2].startswith("a/") or not parts[3].startswith("b/"):
            raise OracleError("instrumentation patch has a malformed file header")
        old_name = parts[2][2:]
        new_name = parts[3][2:]
        if old_name != new_name:
            raise OracleError("instrumentation patch may not rename source files")
        relative_path(old_name, "instrumentation patch path")
    return data


def apply_patch_exactly(*, patch_path: Path, patch_bytes: bytes, source_root: Path) -> dict[str, Any]:
    """Apply one tracked patch to a disposable source copy with no fuzz or offsets."""
    try:
        completed = subprocess.run(
            ["patch", "--batch", "--forward", "--fuzz=0", "--posix", "-p1", "-i", str(patch_path)],
            cwd=source_root, input=None, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            check=False, text=True,
        )
    except OSError as exc:
        raise OracleError(f"cannot execute patch: {exc}") from exc
    transcript = completed.stdout + completed.stderr
    lowered = transcript.lower()
    if completed.returncode != 0 or "fuzz" in lowered or "offset" in lowered or "reject" in lowered or "reversed" in lowered or "skipping" in lowered:
        raise OracleError("instrumentation patch did not apply exactly: " + transcript.strip())
    return {
        "path": patch_path.name,
        "sha256": sha256_bytes(patch_bytes),
        "bytes": len(patch_bytes),
        "application": "patch --batch --forward --fuzz=0 --posix -p1",
    }


def install_native_support(repo_root: Path, source_root: Path) -> list[dict[str, Any]]:
    """Install the separately tracked oracle adapter into the disposable tree."""
    installed: list[dict[str, Any]] = []
    for relative in NATIVE_SUPPORT:
        source = safe_path(repo_root, relative, "native support")
        reject_symlink_components(repo_root, relative, "native support")
        digest, byte_count = hash_regular_file_no_follow(source, relative.as_posix())
        destination = source_root / relative.name
        item = {"path": relative.as_posix(), "bytes": byte_count, "sha256": digest}
        copy_regular_file_no_follow(source, destination, item)
        installed.append({
            "path": relative.as_posix(), "installed_as": relative.name,
            "bytes": byte_count, "sha256": digest,
        })
    return installed


def prepare(*, repo_root: Path, profile_path: Path, source_manifest_path: Path, output_value: str,
            patch_path: Path | None = None) -> dict[str, Any]:
    operation = "prepare"
    output: Path | None = None
    stage: Path | None = None
    try:
        profile, profile_bytes = load_json(profile_path, "profile")
        manifest, manifest_bytes = load_json(source_manifest_path, "source manifest")
        manifest = validate_source_manifest(manifest)
        validate_profile(profile, repo_root, manifest)
        verified = verified_sources(repo_root, manifest)
        output = output_path(repo_root, output_value)
        source_roots = sorted({item["source_root"] for item in verified}, key=str)
        verify_output(source_roots, output)
        output.parent.mkdir(parents=True, exist_ok=True)
        stage = Path(tempfile.mkdtemp(prefix=".prepare-", dir=output.parent))
        copied_source = stage / "source"
        copied_source.mkdir()
        source_ids = {item["source_id"] for item in verified}
        def copied_root(item: dict[str, Any]) -> Path:
            return copied_source if source_ids == {"source"} else copied_source / item["source_id"]
        for item in verified:
            # Preserve schema-v1's established source/ layout.  Schema-v2
            # names each closure root so its Makefile-relative topology is
            # reproducible without pulling a whole local checkout.
            destination_root = copied_root(item)
            destination_root.mkdir(parents=True, exist_ok=True)
            destination = destination_root / item["path"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            copy_regular_file_no_follow(
                item["source_root"] / item["path"], destination, item
            )
        copied = [{"source_id": item["source_id"], "path": item["path"],
                   "bytes": (copied_root(item) / item["path"]).stat().st_size,
                   "sha256": sha256_file(copied_root(item) / item["path"])} for item in verified]
        expected_copied = [{key: item[key] for key in ("source_id", "path", "bytes", "sha256")} for item in verified]
        if copied != expected_copied:
            raise OracleError("copied source tree did not retain verified identities")
        verified_after_copy = verified_sources(repo_root, manifest)
        if verified_after_copy != verified:
            raise OracleError("source tree changed during preparation")
        patch_identity: dict[str, Any] | None = None
        native_support: list[dict[str, Any]] = []
        if patch_path is not None:
            patch_path = tracked_patch_path(repo_root, patch_path)
            patch_bytes = validate_patch(patch_path)
            if source_ids == {"source"}:
                patch_root = copied_source
            elif "usim" in source_ids:
                patch_root = copied_source / "usim"
            else:
                raise OracleError("multi-root instrumentation requires a usim source closure")
            patch_identity = apply_patch_exactly(patch_path=patch_path, patch_bytes=patch_bytes, source_root=patch_root)
            native_support = install_native_support(repo_root, patch_root)
        marker = {
            "schema": "cadr-oracle-prepare", "schema_version": 1,
            "profile_id": manifest["profile_id"],
            "profile_sha256": sha256_bytes(profile_bytes),
            "source_manifest_sha256": sha256_bytes(manifest_bytes),
            "copied_tree_sha256": sha256_bytes(canonical_json_bytes(copied)),
            "copied_file_count": len(copied),
            "source_closure": [{
                "id": item["id"], "source_root": item["source_root"],
                "profile_source_pin": item["profile_source_pin"],
                "expected_source_revision": item["expected_source_revision"],
                "file_count": len(item["files"]),
            } for item in manifest["_sources"]],
            "instrumentation_patch": patch_identity,
            "native_support": native_support,
            "vcs_live_verified": False,
            "limitation": "The local Fossil checkout administrative database points to an unavailable repository; source identity is verified only by the independently pinned regular-file manifest.",
            "tool": {"path": "scripts/cadr-oracle.py", "python": sys.version, "executable": sys.executable, "platform": platform.platform()},
        }
        if manifest["schema_version"] == 1:
            marker["expected_source_revision"] = manifest["expected_source_revision"]
        (stage / "prepare.json").write_bytes(canonical_json_bytes(marker))
        if output.exists():
            output.rmdir()
        os.replace(stage, output)
        stage = None
        return summary("ok", operation, output=str(output.relative_to(repo_root)), prepare=marker)
    except OracleError as exc:
        return invalid(operation, "prepare", str(exc))
    except OSError as exc:
        return invalid(operation, "io", str(exc))
    finally:
        if stage is not None:
            shutil.rmtree(stage, ignore_errors=True)


def load_prepare_marker(repo_root: Path, prepared_value: str) -> tuple[Path, dict[str, Any]]:
    prepared = output_path(repo_root, prepared_value)
    marker, _ = load_json(prepared / "prepare.json", "prepare marker")
    if not isinstance(marker, dict) or marker.get("schema") != "cadr-oracle-prepare":
        raise OracleError("prepared input has no recognized prepare marker")
    patch = marker.get("instrumentation_patch")
    if not isinstance(patch, dict) or patch.get("sha256") != sha256_file(repo_root / DEFAULT_PATCH):
        raise OracleError("prepared instrumentation patch identity is stale")
    expected_support = {item["path"]: item for item in marker.get("native_support", [])}
    for relative in NATIVE_SUPPORT:
        item = expected_support.get(relative.as_posix())
        if not item or item.get("sha256") != sha256_file(repo_root / relative):
            raise OracleError(f"prepared native support identity is stale: {relative}")
        installed = prepared / "source/usim" / relative.name
        if sha256_file(installed) != item["sha256"]:
            raise OracleError(f"installed native support drifted: {relative.name}")
    return prepared, marker


def prepared_source_identity(prepared: Path) -> tuple[str, list[dict[str, Any]]]:
    source = prepared / "source"
    entries: list[dict[str, Any]] = []
    for path in sorted(source.rglob("*")):
        if path.is_symlink():
            raise OracleError("prepared source contains a symlink")
        if not path.is_file() or not is_closure_source_name(path.name):
            continue
        entries.append({
            "path": path.relative_to(source).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        })
    if not entries:
        raise OracleError("prepared source identity is empty")
    return sha256_bytes(canonical_json_bytes(entries)), entries


def original_source_identity(repo_root: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    manifest, _ = load_json(repo_root / DEFAULT_SOURCE_MANIFEST, "source manifest")
    normalized = validate_source_manifest(manifest)
    return normalized, verified_sources(repo_root, normalized)


def build(*, repo_root: Path, prepared_value: str) -> dict[str, Any]:
    operation = "build"
    try:
        prepared, marker = load_prepare_marker(repo_root, prepared_value)
        source = prepared / "source/usim"
        source_tree_sha256, source_entries = prepared_source_identity(prepared)
        completed = subprocess.run(
            ["make", "-f", "Makefile.usim", "USIM_BACKEND=oracle",
             "USIM_BUILD_TYPE=release", "CHAOSDIR=../chaos", "LDFLAGS=-no-pie"],
            cwd=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            check=False,
        )
        if completed.returncode:
            raise OracleError("native oracle build failed: " + completed.stderr[-2000:])
        executable = source / "usim"
        symbols = subprocess.run(
            ["nm", "-u", str(executable)], stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, check=False,
        )
        if symbols.returncode:
            raise OracleError("cannot audit native oracle symbols")
        forbidden = (" X", "SDL_", "socket", "connect", "select",
                     "gettimeofday", "clock_gettime", "setitimer",
                     "pthread_create", "pthread_cond_wait")
        hits = sorted(line for line in symbols.stdout.splitlines()
                      if any(token in line for token in forbidden))
        if hits:
            raise OracleError("forbidden native dependency: " + "; ".join(hits))
        after_tree_sha256, after_entries = prepared_source_identity(prepared)
        if after_tree_sha256 != source_tree_sha256 or after_entries != source_entries:
            raise OracleError("build changed the prepared source identity")
        identity = {
            "path": str(executable.relative_to(repo_root)),
            "bytes": executable.stat().st_size,
            "sha256": sha256_file(executable),
            "forbidden_undefined_symbol_count": 0,
            "prepare_patch_sha256": marker["instrumentation_patch"]["sha256"],
            "profile_sha256": marker["profile_sha256"],
            "source_manifest_sha256": marker["source_manifest_sha256"],
            "prepared_source_tree_sha256": source_tree_sha256,
            "prepared_source_file_count": len(source_entries),
        }
        (prepared / "build.json").write_bytes(canonical_json_bytes({
            "schema": "cadr-oracle-build", "schema_version": 1, **identity,
        }))
        return summary("ok", operation, build=identity)
    except (OracleError, OSError) as exc:
        return invalid(operation, "build", str(exc))


def load_trace_codec() -> Any:
    path = REPOSITORY / "scripts" / "cadr_oracle_trace.py"
    spec = importlib.util.spec_from_file_location("cadr_oracle_trace_for_capture", path)
    if spec is None or spec.loader is None:
        raise OracleError("cannot load the CDRTRC1 codec")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def capture_inputs(config_path: Path) -> tuple[Path, list[dict[str, Any]], str]:
    parser = configparser.ConfigParser(interpolation=None)
    try:
        with config_path.open("r", encoding="utf-8") as stream:
            parser.read_file(stream)
        paths = [
            ("prom-control-store", Path(parser["ucode"]["prommcr_filename"])),
            ("prom-symbols", Path(parser["ucode"]["promsym_filename"])),
            ("microcode-symbols", Path(parser["ucode"]["mcrsym_filename"])),
            ("chaos-hosts", Path(parser["chaos"]["hosts"])),
        ]
        disk_value = parser["disk"]["disk0"]
        disk = Path(disk_value.split(",", 1)[1])
        paths.append(("disk0", disk))
    except (OSError, KeyError, IndexError, configparser.Error) as exc:
        raise OracleError(f"cannot identify capture inputs from config: {exc}") from exc
    identities: list[dict[str, Any]] = []
    for input_id, path in paths:
        if not path.is_absolute() or not path.is_file() or path.is_symlink():
            raise OracleError(f"capture input {input_id} is not an absolute regular file")
        identities.append({
            "id": input_id, "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        })
    return disk, identities, sha256_bytes(canonical_json_bytes(identities))


def identity_bundle(components: list[str]) -> tuple[str, str]:
    if len(components) != 8:
        raise OracleError("identity bundle requires eight component hashes")
    digest = hashlib.sha256()
    digest.update(b"CDRIDENT1\0")
    for value in components:
        if len(value) != 64:
            raise OracleError("identity component is not complete SHA-256")
        digest.update(bytes.fromhex(value))
    bundle = digest.hexdigest()
    return bundle, bundle[:32]


def sha256_hex_bytes(value: str, field: str) -> bytes:
    if (not isinstance(value, str) or len(value) != 64 or
            value != value.lower()):
        raise OracleError(f"{field} must be 64 lowercase hexadecimal characters")
    try:
        result = bytes.fromhex(value)
    except ValueError as exc:
        raise OracleError(f"{field} must be 64 lowercase hexadecimal characters") from exc
    if len(result) != 32:
        raise OracleError(f"{field} must identify one SHA-256 value")
    return result


COMPONENT_SCALAR_WIDTHS = [8] * 5 + [4] * 41 + [8] * 2 + [4] * 12
COMPONENT_TREE_FAMILIES = [14, *range(1, 14), 15]
COMPONENT_DEVICE_FAMILIES = list(range(31, 38))


def _component_integer(value: Any, field: str, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > maximum:
        raise OracleError(f"{field} is not a bounded unsigned integer")
    return value


def load_component_dump(path: Path,
                        expected_boundaries: list[int] | None = None) -> list[dict[str, Any]]:
    """Parse and independently validate native canonical-state component NDJSON."""
    try:
        raw_lines = path.read_text(encoding="ascii").splitlines()
    except (OSError, UnicodeError) as exc:
        raise OracleError(f"cannot read component dump: {exc}") from exc
    if not raw_lines:
        raise OracleError("component dump is empty")
    records: list[dict[str, Any]] = []
    expected_keys = {
        "schema", "schema_version", "boundary_ordinal", "cycle",
        "scalar_encoding", "scalars", "tree_roots", "device_roots",
        "state_sha256",
    }
    prior_boundary = -1
    for line_number, raw in enumerate(raw_lines, 1):
        try:
            record = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise OracleError(f"component dump line {line_number} is not JSON: {exc}") from exc
        if not isinstance(record, dict) or set(record) != expected_keys:
            raise OracleError(f"component dump line {line_number} has an unknown schema shape")
        if (record["schema"] != "cadr-oracle-component-boundary" or
                record["schema_version"] != 1 or
                record["scalar_encoding"] != "unsigned-decimal-little-endian"):
            raise OracleError(f"component dump line {line_number} has an unsupported schema")
        boundary = _component_integer(
            record["boundary_ordinal"], f"line {line_number} boundary", (1 << 64) - 1)
        cycle = _component_integer(
            record["cycle"], f"line {line_number} cycle", (1 << 64) - 1)
        if boundary <= prior_boundary:
            raise OracleError("component dump boundaries are not strictly increasing")
        prior_boundary = boundary
        scalars = record["scalars"]
        if not isinstance(scalars, list) or len(scalars) != 60:
            raise OracleError(f"component dump line {line_number} must contain 60 scalars")
        digest = hashlib.sha256()
        digest.update(b"CDRSTATE1\0")
        normalized_scalars: list[dict[str, int]] = []
        for offset, scalar in enumerate(scalars):
            tag = offset + 1
            width = COMPONENT_SCALAR_WIDTHS[offset]
            if not isinstance(scalar, dict) or set(scalar) != {"tag", "width", "value"}:
                raise OracleError(f"component scalar {tag} has an unknown schema shape")
            if scalar["tag"] != tag or scalar["width"] != width:
                raise OracleError(f"component scalar {tag} tag or width is not canonical")
            value = _component_integer(
                scalar["value"], f"component scalar {tag}", (1 << (width * 8)) - 1)
            digest.update(tag.to_bytes(4, "little"))
            digest.update(value.to_bytes(width, "little"))
            normalized_scalars.append({"tag": tag, "width": width, "value": value})
        if normalized_scalars[0]["value"] != cycle:
            raise OracleError("component dump cycle disagrees with canonical scalar tag 1")
        for field, families in (
                ("tree_roots", COMPONENT_TREE_FAMILIES),
                ("device_roots", COMPONENT_DEVICE_FAMILIES)):
            roots = record[field]
            if not isinstance(roots, list) or len(roots) != len(families):
                raise OracleError(f"component dump {field} inventory is incomplete")
            for root, family in zip(roots, families, strict=True):
                if not isinstance(root, dict) or set(root) != {"family", "sha256"}:
                    raise OracleError(f"component dump {field} has an unknown schema shape")
                if root["family"] != family or not isinstance(root["sha256"], str):
                    raise OracleError(f"component dump {field} order is not canonical")
                try:
                    root_bytes = bytes.fromhex(root["sha256"])
                except ValueError as exc:
                    raise OracleError(f"component dump family {family} root is not hex") from exc
                if len(root_bytes) != 32 or root["sha256"] != root["sha256"].lower():
                    raise OracleError(f"component dump family {family} root is not SHA-256")
                digest.update(family.to_bytes(4, "little"))
                digest.update(root_bytes)
        state_sha256 = record["state_sha256"]
        if (not isinstance(state_sha256, str) or len(state_sha256) != 64 or
                state_sha256 != state_sha256.lower()):
            raise OracleError("component dump state digest is not canonical SHA-256")
        try:
            bytes.fromhex(state_sha256)
        except ValueError as exc:
            raise OracleError("component dump state digest is not hex") from exc
        recomputed = digest.hexdigest()
        if recomputed != state_sha256:
            raise OracleError(
                f"component dump boundary {boundary} state digest does not recompute")
        records.append(record)
    boundaries = [record["boundary_ordinal"] for record in records]
    if not boundaries or boundaries[0] != 0:
        raise OracleError("component dump does not include S0")
    if expected_boundaries is not None and boundaries != expected_boundaries:
        raise OracleError("component dump boundaries do not match the requested selection")
    return records


def parse_dump_boundaries(value: str) -> list[int]:
    try:
        boundaries = [int(item, 10) for item in value.split(",")]
    except ValueError as exc:
        raise OracleError("dump boundaries must be comma-separated decimal integers") from exc
    if (not boundaries or boundaries[0] != 0 or
            any(value < 0 or value > 100000 for value in boundaries) or
            any(left >= right for left, right in zip(boundaries, boundaries[1:]))):
        raise OracleError("dump boundaries must start with 0 and increase through at most 100000")
    return boundaries


def capture(*, repo_root: Path, prepared_value: str, config_value: str,
            output_value: str, uuid_hex: str | None,
            negative_alu_slot: int | None = None,
            dump_boundaries: list[int] | None = None) -> dict[str, Any]:
    operation = "capture"
    stage: Path | None = None
    try:
        prepared, prepare_marker = load_prepare_marker(repo_root, prepared_value)
        build_marker, _ = load_json(prepared / "build.json", "build marker")
        executable = repo_root / build_marker["path"]
        if sha256_file(executable) != build_marker["sha256"]:
            raise OracleError("built executable identity drifted")
        tree_before, _ = prepared_source_identity(prepared)
        if tree_before != build_marker.get("prepared_source_tree_sha256"):
            raise OracleError("patched prepared source drifted after build")
        if build_marker.get("profile_sha256") != sha256_file(repo_root / DEFAULT_PROFILE):
            raise OracleError("profile identity drifted after build")
        if build_marker.get("source_manifest_sha256") != sha256_file(repo_root / DEFAULT_SOURCE_MANIFEST):
            raise OracleError("source-manifest identity drifted after build")
        if build_marker.get("prepare_patch_sha256") != sha256_file(repo_root / DEFAULT_PATCH):
            raise OracleError("instrumentation patch identity drifted after build")
        source_manifest, source_before = original_source_identity(repo_root)
        config_relative = relative_path(config_value, "config")
        config = safe_path(repo_root, config_relative, "config")
        if not config.is_file() or config.is_symlink():
            raise OracleError("config must be a regular non-symlink file")
        config_sha256 = sha256_file(config)
        disk_path, inputs_before, input_aggregate = capture_inputs(config)
        disk_before = {"bytes": disk_path.stat().st_size, "sha256": sha256_file(disk_path)}
        components = [
            prepare_marker["profile_sha256"],
            prepare_marker["source_manifest_sha256"],
            prepare_marker["instrumentation_patch"]["sha256"],
            build_marker["sha256"],
            config_sha256,
            disk_before["sha256"],
            tree_before,
            input_aggregate,
        ]
        bundle_sha256, derived_uuid = identity_bundle(components)
        if uuid_hex is not None and uuid_hex != derived_uuid:
            raise OracleError("requested UUID does not match exact identity bundle")
        uuid_hex = derived_uuid
        output = output_path(repo_root, output_value)
        verify_output([], output)
        output.parent.mkdir(parents=True, exist_ok=True)
        stage = Path(tempfile.mkdtemp(prefix=".capture-", dir=output.parent))
        trace_path, report_path = stage / "trace.cdrtrc1", stage / "prefix-report.json"
        component_dump_path = stage / "components.ndjson"
        environment = {
            "PATH": os.environ.get("PATH", ""),
            "LANG": "C", "LC_ALL": "C", "TZ": "UTC",
            "CADR_ORACLE_TRACE": str(trace_path),
            "CADR_ORACLE_REPORT": str(report_path),
            "CADR_ORACLE_UUID": uuid_hex,
            "CADR_ORACLE_PROFILE_SHA256": components[0],
            "CADR_ORACLE_SOURCE_MANIFEST_SHA256": components[1],
            "CADR_ORACLE_PATCH_SHA256": components[2],
            "CADR_ORACLE_EXECUTABLE_SHA256": components[3],
            "CADR_ORACLE_CONFIG_SHA256": components[4],
            "CADR_ORACLE_DISK_SHA256": components[5],
            "CADR_ORACLE_PREPARED_TREE_SHA256": components[6],
            "CADR_ORACLE_INPUT_AGGREGATE_SHA256": components[7],
        }
        if negative_alu_slot is not None:
            if negative_alu_slot < 1 or negative_alu_slot > 100000:
                raise OracleError("negative ALU slot must be in 1..100000")
            environment["CADR_ORACLE_NEGATIVE_ALU_SLOT"] = str(negative_alu_slot)
        if dump_boundaries is not None:
            if (not dump_boundaries or dump_boundaries[0] != 0 or
                    any(value < 0 or value > 100000 for value in dump_boundaries) or
                    any(left >= right for left, right in
                        zip(dump_boundaries, dump_boundaries[1:]))):
                raise OracleError("dump boundaries must start with 0 and strictly increase")
            environment["CADR_ORACLE_COMPONENT_DUMP"] = str(component_dump_path)
            environment["CADR_ORACLE_COMPONENT_BOUNDARIES"] = ",".join(
                str(value) for value in dump_boundaries)
        completed = subprocess.run(
            [str(executable), "-c", str(config)], cwd=executable.parent,
            env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, check=False, timeout=120,
        )
        (stage / "stdout.log").write_text(completed.stdout, encoding="utf-8")
        (stage / "stderr.log").write_text(completed.stderr, encoding="utf-8")
        if completed.returncode:
            raise OracleError(f"native oracle exited {completed.returncode}: {completed.stderr[-1000:]}")
        report, report_bytes = load_json(report_path, "prefix report")
        if report.get("external_event_count") != 0:
            raise OracleError("prefix report records an uncontrolled external event")
        if (negative_alu_slot is not None and
                report.get("negative_alu_exercised_slot") != negative_alu_slot):
            raise OracleError("requested behavioral ALU mutation was not exercised")
        codec = load_trace_codec()
        trace_bytes = trace_path.read_bytes()
        parsed = codec.parse_trace(
            trace_bytes,
            expected_identity_bundle=bytes.fromhex(bundle_sha256),
            expected_profile_sha256=bytes.fromhex(components[0]),
        )
        if negative_alu_slot is None:
            if (parsed["record_count"] != 100002 or
                    parsed["terminal_status"] != codec.TERMINAL_COMPLETE or
                    parsed["terminal_reason"] != codec.TERMINAL_REASON_COMPLETE_LIMIT):
                raise OracleError("capture is not the complete 100,000-slot prefix")
        elif (parsed["terminal_status"] != codec.TERMINAL_COMPLETE or
              parsed["record_count"] < negative_alu_slot + 2):
            raise OracleError("negative capture did not complete after exercising its mutation")
        s0_tlvs = {item.type: item.value for item in parsed["records"][0].tlvs}
        expected_s0 = [bundle_sha256, *components]
        for offset, expected in enumerate(expected_s0):
            if s0_tlvs.get(100 + offset) != bytes.fromhex(expected):
                raise OracleError("S0 identity binding does not match capture inputs")
        component_dump: dict[str, Any] | None = None
        if dump_boundaries is not None:
            component_records = load_component_dump(
                component_dump_path, expected_boundaries=dump_boundaries)
            component_dump = {
                "path": "components.ndjson",
                "bytes": component_dump_path.stat().st_size,
                "sha256": sha256_file(component_dump_path),
                "boundaries": dump_boundaries,
                "record_count": len(component_records),
            }
        tree_after, _ = prepared_source_identity(prepared)
        _, source_after = original_source_identity(repo_root)
        _, inputs_after, input_aggregate_after = capture_inputs(config)
        disk_after = {"bytes": disk_path.stat().st_size, "sha256": sha256_file(disk_path)}
        if (tree_after != tree_before or source_after != source_before or
                inputs_after != inputs_before or input_aggregate_after != input_aggregate or
                disk_after != disk_before or sha256_file(config) != config_sha256 or
                sha256_file(executable) != build_marker["sha256"]):
            raise OracleError("source, executable, configuration, or input changed during capture")
        identity = {
            "schema": "cadr-oracle-capture", "schema_version": 1,
            "trace": {"path": "trace.cdrtrc1", "bytes": len(trace_bytes),
                      "sha256": sha256_bytes(trace_bytes),
                      "record_count": parsed["record_count"],
                      "final_chain_hash": parsed["final_chain_hash"].hex()},
            "prefix_report_sha256": sha256_bytes(report_bytes),
            "identity_bundle_sha256": bundle_sha256,
            "trace_uuid": uuid_hex,
            "identity_components": {
                "profile_sha256": components[0],
                "source_manifest_sha256": components[1],
                "patch_sha256": components[2],
                "executable_sha256": components[3],
                "config_sha256": components[4],
                "disk_sha256": components[5],
                "prepared_source_tree_sha256": components[6],
                "input_aggregate_sha256": components[7],
            },
            "config": {"path": config_value, "pre_sha256": config_sha256,
                       "post_sha256": sha256_file(config)},
            "disk": {"pre": disk_before, "post": disk_after},
            "inputs": {"pre": inputs_before, "post": inputs_after},
            "original_source_file_count": len(source_before),
            "original_source_pre_sha256": sha256_bytes(canonical_json_bytes([
                {key: item[key] for key in ("source_id","path","bytes","sha256")}
                for item in source_before
            ])),
            "original_source_post_sha256": sha256_bytes(canonical_json_bytes([
                {key: item[key] for key in ("source_id","path","bytes","sha256")}
                for item in source_after
            ])),
            "executable_sha256": build_marker["sha256"],
            "negative_alu_slot": negative_alu_slot,
            "component_dump": component_dump,
        }
        (stage / "capture.json").write_bytes(canonical_json_bytes(identity))
        if output.exists():
            output.rmdir()
        os.replace(stage, output)
        stage = None
        return summary("ok", operation, output=str(output.relative_to(repo_root)),
                       capture=identity, prefix_report=report)
    except subprocess.TimeoutExpired:
        return invalid(operation, "timeout", "native oracle exceeded 120 seconds")
    except (OracleError, OSError, KeyError, ValueError) as exc:
        return invalid(operation, "capture", str(exc))
    finally:
        if stage is not None:
            shutil.rmtree(stage, ignore_errors=True)


def compare(*, repo_root: Path, trace_values: list[str],
            expected_identity_bundle_sha256: str | None = None,
            expected_profile_sha256: str | None = None) -> dict[str, Any]:
    operation = "compare"
    try:
        if len(trace_values) < 2:
            raise OracleError("compare requires at least two traces")
        if expected_identity_bundle_sha256 is None or expected_profile_sha256 is None:
            raise OracleError(
                "compare requires selected expected identity bundle and profile SHA-256")
        expected_bundle = sha256_hex_bytes(
            expected_identity_bundle_sha256, "expected identity bundle")
        expected_profile = sha256_hex_bytes(
            expected_profile_sha256, "expected profile")
        codec = load_trace_codec()
        identities = []
        reference: bytes | None = None
        for value in trace_values:
            relative = relative_path(value, "trace")
            path = safe_path(repo_root, relative, "trace")
            data = path.read_bytes()
            parsed = codec.parse_trace(
                data, expected_identity_bundle=expected_bundle,
                expected_profile_sha256=expected_profile)
            if parsed["terminal_status"] != codec.TERMINAL_COMPLETE:
                raise OracleError(f"trace is not complete: {value}")
            if reference is not None and data != reference:
                raise OracleError(f"trace bytes diverge: {value}")
            reference = data
            identities.append({"path": value, "bytes": len(data),
                               "sha256": sha256_bytes(data),
                               "record_count": parsed["record_count"],
                               "final_chain_hash": parsed["final_chain_hash"].hex()})
        return summary("ok", operation, identical=True, traces=identities)
    except (OracleError, OSError, ValueError) as exc:
        return invalid(operation, "compare", str(exc))


def validate_components(*, repo_root: Path, dump_value: str,
                        boundary_value: str | None) -> dict[str, Any]:
    operation = "validate-components"
    try:
        relative = relative_path(dump_value, "component dump")
        path = safe_path(repo_root, relative, "component dump")
        expected = parse_dump_boundaries(boundary_value) if boundary_value else None
        records = load_component_dump(path, expected_boundaries=expected)
        return summary(
            "ok", operation, path=dump_value, record_count=len(records),
            boundaries=[record["boundary_ordinal"] for record in records],
            state_sha256=[record["state_sha256"] for record in records],
        )
    except (OracleError, OSError, ValueError) as exc:
        return invalid(operation, "component-dump", str(exc))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=str(REPOSITORY))
    commands = parser.add_subparsers(dest="operation", required=True)
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--profile", default=str(DEFAULT_PROFILE))
    prepare_parser.add_argument("--source-manifest", default=str(DEFAULT_SOURCE_MANIFEST))
    prepare_parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    prepare_parser.add_argument("--patch", default=str(DEFAULT_PATCH))
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--prepared", default=str(DEFAULT_OUTPUT))
    capture_parser = commands.add_parser("capture")
    capture_parser.add_argument("--prepared", default=str(DEFAULT_OUTPUT))
    capture_parser.add_argument("--config", required=True)
    capture_parser.add_argument("--output", required=True)
    capture_parser.add_argument("--uuid")
    capture_parser.add_argument("--negative-alu-slot", type=int)
    capture_parser.add_argument(
        "--dump-boundaries",
        help="write components.ndjson for ordered boundaries beginning with S0, e.g. 0,1,1024")
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("traces", nargs="+")
    compare_parser.add_argument("--expected-identity-bundle-sha256", required=True)
    compare_parser.add_argument("--expected-profile-sha256", required=True)
    components_parser = commands.add_parser("validate-components")
    components_parser.add_argument("dump")
    components_parser.add_argument("--boundaries")
    args = parser.parse_args(argv)
    repo_root = Path(args.repo_root).resolve()
    if args.operation == "prepare":
        profile = Path(args.profile)
        manifest = Path(args.source_manifest)
        output = args.output
        response = prepare(repo_root=repo_root, profile_path=profile if profile.is_absolute() else repo_root / profile,
                           source_manifest_path=manifest if manifest.is_absolute() else repo_root / manifest,
                           output_value=output,
                           patch_path=(Path(args.patch) if Path(args.patch).is_absolute() else repo_root / args.patch))
    elif args.operation == "build":
        response = build(repo_root=repo_root, prepared_value=args.prepared)
    elif args.operation == "capture":
        try:
            dump_boundaries = (parse_dump_boundaries(args.dump_boundaries)
                               if args.dump_boundaries else None)
        except OracleError as exc:
            response = invalid("capture", "component-dump", str(exc))
            print(json.dumps(response, sort_keys=True))
            return 2
        response = capture(repo_root=repo_root, prepared_value=args.prepared,
                           config_value=args.config, output_value=args.output,
                           uuid_hex=args.uuid,
                           negative_alu_slot=args.negative_alu_slot,
                           dump_boundaries=dump_boundaries)
    elif args.operation == "compare":
        response = compare(
            repo_root=repo_root, trace_values=args.traces,
            expected_identity_bundle_sha256=args.expected_identity_bundle_sha256,
            expected_profile_sha256=args.expected_profile_sha256)
    else:
        response = validate_components(
            repo_root=repo_root, dump_value=args.dump,
            boundary_value=args.boundaries)
    print(json.dumps(response, sort_keys=True))
    return 0 if response["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
