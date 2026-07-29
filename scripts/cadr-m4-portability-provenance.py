#!/usr/bin/env python3
"""Freeze and verify the byte inputs of the C-M4 portability matrix.

The matrix deliberately runs long enough that its manifest must be tied to the
sources and immutable input artifacts seen *before* compilation, not to a
possibly different tree sampled while emitting its results.  This helper writes
an ignored preflight record and verifies that exact record once all producers
have stopped.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
from typing import Iterable


INPUT_ROLES = (
    ("config", "config"),
    ("prom", "prom"),
    ("prom_symbols", "prom_symbols"),
    ("microcode_symbols", "microcode_symbols"),
    ("base_disk", "disk"),
)


def fingerprint(path: pathlib.Path) -> dict[str, object]:
    """Return a coherent byte count and digest, rejecting a raced read."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        before = os.fstat(stream.fileno())
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
        after = os.fstat(stream.fileno())
    identity_before = (before.st_dev, before.st_ino, before.st_size,
                       before.st_mtime_ns, before.st_ctime_ns)
    identity_after = (after.st_dev, after.st_ino, after.st_size,
                      after.st_mtime_ns, after.st_ctime_ns)
    if identity_before != identity_after:
        raise ValueError("artifact changed while it was being hashed: {}".format(path))
    return {"bytes": after.st_size, "sha256": digest.hexdigest()}


def portable_identity(root: pathlib.Path, path: pathlib.Path, role: str) -> str:
    """Return a non-absolute identity; the digest carries the full identity."""
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    try:
        return "repository/" + str(resolved_path.relative_to(resolved_root))
    except ValueError:
        # Caller-selected external media is legitimate, but a host path is not
        # portable evidence.  Keep only a role-qualified basename here.
        return "external/{}/{}".format(role, resolved_path.name)


def default_source_paths(root: pathlib.Path) -> list[pathlib.Path]:
    """All source and build/runner code that controls this exact matrix."""
    globbed = (
        ("cadr-web/core", "*.c"),
        ("cadr-web/core", "*.h"),
        ("cadr-web/core/usim-port", "*.c"),
        ("cadr-web/core/usim-port", "*.h"),
        ("cadr-web/include", "*.h"),
        ("cadr-web/trace", "*.c"),
        ("cadr-web/trace", "*.h"),
        ("cadr-web/host", "*.h"),
        ("cadr-web/wasm", "*.h"),
        ("cadr-web/wasm/include", "*.h"),
    )
    fixed = (
        "cadr-web/host/cadr_m4_native.c",
        "cadr-web/host/cadr_m4_block_service.c",
        "cadr-web/host/cadr_m4_file_range_reader.c",
        "cadr-web/host/cadr_m3_projection.c",
        "cadr-web/host/cadr_m3_native_observer.c",
        "cadr-web/wasm/build-wasm.sh",
        "cadr-web/wasm/cadr_wasm_adapter.c",
        "cadr-web/wasm/cadr_wasm_runtime.c",
        "cadr-web/wasm/cadr-worker.js",
        "cadr-web/wasm/cadr-m4-block-service.mjs",
        "cadr-web/wasm/cadr-m4-media.mjs",
        "cadr-web/wasm/cadr-m4-controller-transcript.mjs",
        "scripts/cadr-m4-wasm-runner.mjs",
        "scripts/validate-cadr-m4-gate.py",
        "scripts/run-cadr-m4-portability.sh",
        "scripts/cadr-m4-portability-provenance.py",
    )
    paths: set[pathlib.Path] = set()
    for directory, pattern in globbed:
        paths.update((root / directory).glob(pattern))
    paths.update(root / relative for relative in fixed)
    return sorted(paths, key=lambda path: path.relative_to(root).as_posix())


def source_records(
        root: pathlib.Path, source_paths: Iterable[pathlib.Path]
) -> dict[str, dict[str, object]]:
    records: dict[str, dict[str, object]] = {}
    for path in source_paths:
        if not path.is_file():
            raise ValueError("required source file is absent: {}".format(path))
        records[path.relative_to(root).as_posix()] = fingerprint(path)
    if not records:
        raise ValueError("source list is empty")
    return records


def state_sha256(source_files: dict[str, dict[str, object]]) -> str:
    state = json.dumps(
        source_files, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(state).hexdigest()


def input_records(root: pathlib.Path, args: argparse.Namespace) -> dict[str, dict[str, object]]:
    records: dict[str, dict[str, object]] = {}
    for role, attribute in INPUT_ROLES:
        path = pathlib.Path(getattr(args, attribute))
        if not path.is_file():
            raise ValueError("required input artifact is absent: {}".format(path))
        records[role] = {
            "identity": portable_identity(root, path, role),
            **fingerprint(path),
        }
    return records


def capture(root: pathlib.Path, args: argparse.Namespace) -> dict[str, object]:
    files = source_records(root, default_source_paths(root))
    return {
        "schema": "cadr-m4-portability-preflight",
        "schema_version": 1,
        "source_state_sha256": state_sha256(files),
        "source_files": files,
        "input_artifacts": input_records(root, args),
    }


def load_record(path: pathlib.Path) -> dict[str, object]:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("cannot read preflight record {}: {}".format(path, error)) from error
    required = {"schema", "schema_version", "source_state_sha256", "source_files", "input_artifacts"}
    if not isinstance(record, dict) or set(record) != required:
        raise ValueError("preflight record has an unexpected schema")
    if record["schema"] != "cadr-m4-portability-preflight" or record["schema_version"] != 1:
        raise ValueError("preflight record has an unsupported schema version")
    return record


def changed_keys(before: dict[str, object], after: dict[str, object]) -> list[str]:
    return sorted(
        key for key in set(before) | set(after)
        if before.get(key) != after.get(key)
    )


def verify(root: pathlib.Path, args: argparse.Namespace, preflight: pathlib.Path) -> None:
    before = load_record(preflight)
    after = capture(root, args)
    differences: list[str] = []
    if before["source_files"] != after["source_files"]:
        differences.append("source files changed: {}".format(", ".join(changed_keys(before["source_files"], after["source_files"]))))
    if before["source_state_sha256"] != after["source_state_sha256"]:
        differences.append("source-state digest changed")
    if before["input_artifacts"] != after["input_artifacts"]:
        differences.append("input artifacts changed: {}".format(", ".join(changed_keys(before["input_artifacts"], after["input_artifacts"]))))
    if differences:
        raise ValueError("C-M4 portability provenance fence failed: " + "; ".join(differences))


def parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    for name in ("capture", "verify"):
        command = subcommands.add_parser(name)
        command.add_argument("--root", type=pathlib.Path, required=True)
        command.add_argument("--config", required=True)
        command.add_argument("--prom", required=True)
        command.add_argument("--prom-symbols", dest="prom_symbols", required=True)
        command.add_argument("--microcode-symbols", dest="microcode_symbols", required=True)
        command.add_argument("--disk", required=True)
        command.add_argument("--preflight", type=pathlib.Path, required=True)
    return parser


def main() -> int:
    args = parser().parse_args()
    root = args.root.resolve()
    try:
        if args.command == "capture":
            record = capture(root, args)
            args.preflight.parent.mkdir(parents=True, exist_ok=True)
            args.preflight.write_text(
                json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
        else:
            verify(root, args, args.preflight)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
