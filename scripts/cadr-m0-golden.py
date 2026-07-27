#!/usr/bin/env python3
"""Capture a fail-closed, evidence-only CADR-WEB-303 M0 cold-boot series.

The checked-in profile never includes the System 303 disk, a saved state, raw
logs, or screenshots.  This program uses the private Xvfb harness to make three
new cold boots and writes its detailed result only beneath the ignored
``build/cadr-computer-use`` tree.  It returns non-zero unless every run uses the
pinned executable and rendered configuration, reaches the Listener capture
point, stops cleanly, preserves both disks, exposes the required normalized boot
markers, and has the same Listener pixel hash as the other two runs.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import time
import uuid
from typing import Any, Sequence


ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "scripts" / "cadr-computer-use.py"
PROFILE_SCRIPT = ROOT / "scripts" / "verify-cadr-web-profile.py"
PINNED_USIM_SHA256 = "a1d88a5b0ba3d477adfd8e3f9296ad282aa8a1fdc0118b3b27defeffafa53bd6"
PINNED_DISK_SHA256 = "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
LISTENER_LABEL = "listener-ready"


class GoldenError(RuntimeError):
    """A cold-boot evidence gate was not met."""


def load_profile_module() -> Any:
    spec = importlib.util.spec_from_file_location("cadr_m0_profile", PROFILE_SCRIPT)
    if spec is None or spec.loader is None:
        raise GoldenError(f"cannot load profile verifier: {PROFILE_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


profile = load_profile_module()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def command_json(argv: Sequence[str], *, timeout: float) -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, str(HARNESS), *argv],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise GoldenError(f"harness command failed ({result.returncode}): {' '.join(argv)}\n{detail}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise GoldenError(f"harness command did not return JSON: {' '.join(argv)}") from exc


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GoldenError(f"cannot read evidence JSON: {path}") from exc
    if not isinstance(value, dict):
        raise GoldenError(f"evidence JSON is not an object: {path}")
    return value


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def checked_run_record(session_dir: Path, screenshot: dict[str, Any]) -> dict[str, Any]:
    """Join raw harness evidence into a path-free M0 record or reject it."""
    state = read_json(session_dir / "run.json")
    runtime = state.get("runtime")
    if not isinstance(runtime, dict):
        raise GoldenError("harness run record has no runtime object")
    config_path = Path(str(runtime.get("config", "")))
    disk_path = Path(str(state.get("session_disk", "")))
    log_path = Path(str(state.get("usim_log", "")))
    if not config_path.is_file() or not disk_path.is_file() or not log_path.is_file():
        raise GoldenError("harness evidence lacks a regular config, private disk, or log")
    rendered = config_path.read_text(encoding="utf-8")
    canonical_hash = profile.verify_m0_rendered_config(rendered, config_path.parent, ROOT)
    phases = profile.extract_m0_boot_log_markers(log_path.read_text(encoding="utf-8", errors="replace"))
    runtime_root = config_path.parent.resolve()
    expected_runtime = {
        "config": runtime_root / "usim.ini",
        "fs_root": runtime_root / "fs-root",
        "state": runtime_root / "usim.state",
        "native_screenshot": runtime_root / "final-framebuffer.pbm",
    }
    for key, expected_path in expected_runtime.items():
        if Path(str(runtime.get(key, ""))).resolve() != expected_path:
            raise GoldenError(f"generated config runtime identity is wrong: {key}")
    if disk_path.resolve() != runtime_root / "disk-sys-303-0.img":
        raise GoldenError("generated config runtime identity is wrong: session disk")
    source_snapshot = state.get("private_source_snapshot")
    if not isinstance(source_snapshot, dict) or source_snapshot.get("schema") != 1:
        raise GoldenError("harness run record has no supported private source snapshot")
    expected = {
        "status": "stopped",
        "usim_sha256_at_start": PINNED_USIM_SHA256,
        "usim_sha256_at_exec": PINNED_USIM_SHA256,
        "base_disk_sha256": PINNED_DISK_SHA256,
        "base_disk_sha256_after": PINNED_DISK_SHA256,
        "session_disk_sha256_at_start": PINNED_DISK_SHA256,
        "forced_stop": False,
        "state_may_be_incomplete": False,
        "usim_exit_status": 0,
        "xvfb_exit_status": 0,
        "resumed": False,
        "resume_requested": False,
        "generation": 1,
        "public_source_revisions_at_start": profile.CADR_WEB_303_RUNTIME_SOURCE_REVISIONS,
        "private_source_tree_sha256_at_start": profile.CADR_WEB_303_PRIVATE_SOURCE_TREES,
        "private_source_changed_since_copy": {
            name: False for name in profile.CADR_WEB_303_PRIVATE_SOURCE_TREES
        },
        "private_machine_artifacts_sha256_at_start": profile.CADR_WEB_303_MACHINE_ARTIFACTS,
        "window_title": "usim",
        "window_geometry": {"x": 0, "y": 0, "width": 768, "height": 963, "screen": 0},
    }
    for field, value in expected.items():
        if state.get(field) != value:
            raise GoldenError(f"run evidence mismatch for {field}: expected {value!r}, got {state.get(field)!r}")
    if source_snapshot.get("revisions_at_copy") != {
        key: profile.CADR_WEB_303_RUNTIME_SOURCE_REVISIONS[key]
        for key in ("chaos", "system", "usite")
    }:
        raise GoldenError("private source revisions at copy differ from the pinned inputs")
    if source_snapshot.get("tree_sha256_at_copy") != profile.CADR_WEB_303_PRIVATE_SOURCE_TREES:
        raise GoldenError("private source trees at copy differ from the pinned inputs")
    if sha256_file(disk_path) != PINNED_DISK_SHA256:
        raise GoldenError("private disk changed during the M0 cold boot")
    if not isinstance(screenshot.get("pixel_sha256"), str) or not isinstance(screenshot.get("png_sha256"), str):
        raise GoldenError("Listener screenshot lacks hashes")
    if screenshot.get("width") != 768 or screenshot.get("height") != 963:
        raise GoldenError("Listener screenshot has the wrong geometry")
    return {
        "schema": profile.M0_EVIDENCE_SCHEMA,
        "session": state.get("session"),
        "generation": state["generation"],
        "protocol_version": 1,
        "cold_boot": True,
        "saved_state_input": False,
        "resumed": False,
        "resume_requested": False,
        "config_canonical_sha256": canonical_hash,
        "config_runtime_layout": {
            "fs_root": "runtime/fs-root",
            "disk": "runtime/disk-sys-303-0.img",
            "state_output": "runtime/usim.state",
            "screenshot_output": "runtime/final-framebuffer.pbm",
        },
        "usim_sha256_at_start": state["usim_sha256_at_start"],
        "usim_sha256_at_exec": state["usim_sha256_at_exec"],
        "base_disk_sha256_before_and_after": state["base_disk_sha256"],
        "private_disk_sha256_before_and_after": state["session_disk_sha256_at_start"],
        "public_source_revisions_at_start": state["public_source_revisions_at_start"],
        "private_source_tree_sha256_at_copy_and_start": state["private_source_tree_sha256_at_start"],
        "private_source_changed_since_copy": state["private_source_changed_since_copy"],
        "private_machine_artifacts_sha256_at_start": state["private_machine_artifacts_sha256_at_start"],
        "window_title": state["window_title"],
        "window_geometry": state["window_geometry"],
        "listener": {
            "label": LISTENER_LABEL,
            "width": screenshot["width"],
            "height": screenshot["height"],
            "png_sha256": screenshot["png_sha256"],
            "pixel_sha256": screenshot["pixel_sha256"],
        },
        "boot_phases": phases,
        "clean_stop": {
            "forced_stop": False,
            "state_may_be_incomplete": False,
            "usim_exit_status": 0,
            "xvfb_exit_status": 0,
        },
    }


def cold_boot_once(session: str, *, boot_wait: float, prompt_wait: float, listener_wait: float) -> dict[str, Any]:
    """Run the fixed M0 protocol using a new private runtime and no resume."""
    command_json(["start", "--session", session, "--fresh", "--timeout", "75"], timeout=90)
    stopped = False
    try:
        # Stage the pointer identically before any guest input.  This profile
        # renders with track_mouse=false, so the client-relative host motion is
        # not delivered as guest mouse state.
        command_json(["mouse", "--session", session, "move", "0", "0"], timeout=20)
        command_json(["wait", "--session", session, "--seconds", str(boot_wait)], timeout=boot_wait + 20)
        command_json(["key", "--session", session, "Return"], timeout=20)
        command_json(["wait", "--session", session, "--seconds", str(prompt_wait)], timeout=prompt_wait + 20)
        command_json(["key", "--session", session, "n", "Return"], timeout=20)
        command_json(["wait", "--session", session, "--seconds", str(listener_wait)], timeout=listener_wait + 20)
        command_json(["mouse", "--session", session, "move", "0", "0"], timeout=20)
        screenshot = command_json(
            ["screenshot", "--session", session, "--label", LISTENER_LABEL], timeout=45
        )
    finally:
        command_json(["stop", "--session", session, "--timeout", "45"], timeout=60)
        stopped = True
    if not stopped:
        raise GoldenError("M0 run did not stop")
    return checked_run_record(ROOT / "build" / "cadr-computer-use" / session, screenshot)


def run_series(prefix: str, *, boot_wait: float = 25, prompt_wait: float = 2, listener_wait: float = 6) -> dict[str, Any]:
    if min(boot_wait, prompt_wait, listener_wait) < 0:
        raise GoldenError("M0 protocol waits must be non-negative")
    unique = uuid.uuid4().hex[:8]
    sessions = [f"{prefix}-{unique}-{index}" for index in range(1, 4)]
    records: list[dict[str, Any]] = []
    for session in sessions:
        records.append(cold_boot_once(session, boot_wait=boot_wait, prompt_wait=prompt_wait, listener_wait=listener_wait))
    pixels = {record["listener"]["pixel_sha256"] for record in records}
    if len(pixels) != 1:
        raise GoldenError("M0 Listener pixel hashes differ; no golden claim is permitted")
    return {
        "schema": profile.M0_EVIDENCE_SCHEMA,
        "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "protocol": {
            "fresh_private_disk_copy": True,
            "saved_state_input": False,
            "pointer_stage": [0, 0],
            "boot_wait_seconds": boot_wait,
            "date_prompt": ["Return", "wait", "N", "Return"],
            "prompt_wait_seconds": prompt_wait,
            "listener_wait_seconds": listener_wait,
            "stop_timeout_seconds": 45,
        },
        "runs": records,
        "listener_pixel_sha256": pixels.pop(),
    }


def parse_seconds(value: str) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected a non-negative number") from exc
    if number < 0 or number > 120:
        raise argparse.ArgumentTypeError("expected a number from 0 through 120")
    return number


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", default="cadr-m0-golden", help="new private-session prefix")
    parser.add_argument("--boot-wait", type=parse_seconds, default=25)
    parser.add_argument("--prompt-wait", type=parse_seconds, default=2)
    parser.add_argument("--listener-wait", type=parse_seconds, default=6)
    arguments = parser.parse_args(argv)
    result_path = ROOT / "build" / "cadr-computer-use" / f"{arguments.prefix}-result.json"
    try:
        result = run_series(
            arguments.prefix,
            boot_wait=arguments.boot_wait,
            prompt_wait=arguments.prompt_wait,
            listener_wait=arguments.listener_wait,
        )
    except (GoldenError, subprocess.TimeoutExpired, OSError) as exc:
        result = {
            "schema": profile.M0_EVIDENCE_SCHEMA,
            "success": False,
            "error": str(exc),
        }
        atomic_json(result_path, result)
        print(json.dumps(result, sort_keys=True), file=sys.stderr)
        return 1
    result["success"] = True
    atomic_json(result_path, result)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
