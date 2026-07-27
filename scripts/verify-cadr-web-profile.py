#!/usr/bin/env python3
"""Verify a CADR-WEB profile manifest without requiring local-only inputs."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
from typing import Any, Sequence


REPOSITORY = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = Path("cadr-web/profiles/cadr-web-303.json")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
DISPOSITIONS = {
    "tracked",
    "generated",
    "generated-local",
    "local-only",
    "metadata-only-review",
    "public-source",
    "unresolved-local-import",
}
CADR_WEB_303_PINS = {
    "lm3_l": {
        "vcs": "fossil",
        "hash_algorithm": "sha3-256",
        "revision": "d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6",
    },
    "sys": {
        "vcs": "fossil",
        "hash_algorithm": "sha3-256",
        "revision": "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91",
    },
    "usim": {
        "vcs": "fossil",
        "hash_algorithm": "sha3-256",
        "revision": "330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d",
    },
    "chaos": {
        "vcs": "fossil",
        "hash_algorithm": "sha3-256",
        "revision": "db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e",
    },
    "usite": {
        "vcs": "fossil",
        "hash_algorithm": "sha3-256",
        "revision": "8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e",
    },
}
CADR_WEB_303_BLOCKERS = {
    "disk-provenance",
    "golden-oracle-stabilization",
    "distribution-rights",
}
M0_TEMPLATE_PATH = Path("cadr-web/profiles/cadr-web-303.ini.in")
M0_TEMPLATE_TOKENS = ("RUNTIME", "FS_ROOT", "DISK", "STATE", "SCREENSHOT")
M0_LOG_SCHEMA = "cadr-m0-boot-log-v1"
M0_EVIDENCE_SCHEMA = "cadr-m0-boot-evidence-v1"
M0_REQUIRED_MARKERS = (
    ("emulator", re.compile(r"^CADR emulator .+ x11-release$")),
    ("monitor", re.compile(r"^tv: using other monitor$")),
    ("memory", re.compile(r"^memory: 2048kW \(kilowords\) installed \(8192 pages\)$")),
    ("disk0-online", re.compile(r"^disk-unit 0: \[Trident T-300\]: online \(.+\)$")),
    ("keyboard", re.compile(r"^kbd: using new \(space cadet\) keyboard$")),
    ("chaos-hosts", re.compile(r'^chaos: using hosts table from ".+"$')),
    ("chaos-local-name", re.compile(r"^chaos: I am LOCAL-CADR \(0177041\)$")),
    ("chaos-local-backend", re.compile(r'^chaos: backend is "local", connecting to LOCAL-BRIDGE \(0177001\)$')),
    ("filesystem-root", re.compile(r"^chaos: mapping / to .+$")),
    ("idle-disabled", re.compile(r"^idle: is disabled$")),
    ("x11", re.compile(r"^tv: using x11 backend for monitor and keyboard$")),
    ("powered-on", re.compile(r"^usim: CADR powered on$")),
    ("booting", re.compile(r"^usim: CADR booting$")),
    ("sigterm", re.compile(r"^usim: sigterm_handler$")),
    ("powered-off", re.compile(r"^usim: CADR powered off$")),
    ("state-written", re.compile(r"^usim: dumping state to .+$")),
    ("framebuffer-written", re.compile(r"^usim: screenshot saved to .+$")),
)
M0_PHASE_NAMES = tuple(marker for marker, _ in M0_REQUIRED_MARKERS)
CADR_WEB_303_ARTIFACTS = {
    "cadr-web-303-runnable-template": (
        "cadr-web/profiles/cadr-web-303.ini.in", 854,
        "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f",
        "tracked", True,
    ),
    "usim-303-0-configuration": (
        "l/usim/usim-303-0.ini", 579,
        "1e4a93c330b6082aaff71b170d741aa30faa4a88bd5f04b83686f568ba6442e1",
        "metadata-only-review", False,
    ),
    "prom-control-store": (
        "l/sys/ubin/promh.mcr", 20480,
        "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6",
        "metadata-only-review", False,
    ),
    "prom-symbols": (
        "l/sys/ubin/promh.sym", 3130,
        "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d",
        "metadata-only-review", False,
    ),
    "microcode-symbols": (
        "l/sys/ubin/ucadr.sym", 83270,
        "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a",
        "metadata-only-review", False,
    ),
    "cadet-keyboard-device-source": (
        "l/usim/cadet.c", 6896,
        "e8974b1bbee8f30a4d55ea76bff8e9b519a02d32056997bf9c5089f2b217860b",
        "public-source", False,
    ),
    "keyboard-device-source": (
        "l/usim/kbd.c", 11245,
        "718bb78231dc40586073dd659c0c46950dcbcf5ad226b1d6dadf2297b8413d9e",
        "public-source", False,
    ),
    "sdl3-cadet-scancode-table": (
        "l/usim/sdl3-keyboard-cadet-scancodes.defs", 2333,
        "913fa9ef9452f6b9bc32e3ac7f7b911680839258c0be9ac75fb770890173a149",
        "public-source", False,
    ),
    "sdl3-default-host-keyboard-map": (
        "l/usim/sdl3-keyboard-default-mapping.defs", 2374,
        "532b577e62ae89f4b748d10805aecc1520d1b5cbe4ccbdf26c08dd31338e9117",
        "public-source", False,
    ),
    "system-303-0-base-disk": (
        "l/usim/disk-sys-303-0.img", 269562880,
        "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
        "unresolved-local-import", False,
    ),
    "usite-extra-hosts": (
        "l/usite/extra.hosts", 262,
        "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438",
        "metadata-only-review", False,
    ),
}
CADR_WEB_303_RUNTIME_SOURCE_REVISIONS = {
    "chaos": "db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e",
    "l": "d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6",
    "system": "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91",
    "usim": "330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d",
    "usite": "8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e",
}
CADR_WEB_303_PRIVATE_SOURCE_TREES = {
    "chaos": "34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87",
    "system": "21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e",
    "usite": "adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81",
}
CADR_WEB_303_MACHINE_ARTIFACTS = {
    "promh.mcr": "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6",
    "promh.sym": "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d",
    "ucadr.sym": "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a",
}


class ProfileError(ValueError):
    """A manifest is malformed or violates a profile invariant."""


def error(code: str, detail: str, artifact: str | None = None) -> dict[str, str]:
    result = {"code": code, "detail": detail}
    if artifact is not None:
        result["artifact"] = artifact
    return result


def relative_path(value: Any) -> Path:
    if not isinstance(value, str) or not value:
        raise ProfileError("artifact path must be a non-empty string")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise ProfileError("artifact path must not contain control characters")
    portable = PurePosixPath(value)
    if portable.is_absolute() or ".." in portable.parts or "\\" in value:
        raise ProfileError(f"artifact path is not repository-relative: {value!r}")
    if any(part in ("", ".") for part in portable.parts):
        raise ProfileError(f"artifact path is not normalized: {value!r}")
    return Path(*portable.parts)


def require_sha256(value: Any, field: str) -> None:
    if not isinstance(value, str) or SHA256_RE.fullmatch(value) is None:
        raise ProfileError(f"{field} must be a lowercase SHA-256 digest")


def m0_bindings(runtime: Path) -> dict[str, str]:
    """Return the only legal per-session substitutions for the M0 template.

    The checked-in template is intentionally portable.  It can contain no host
    path, while a live usim configuration needs absolute private runtime paths.
    Keeping their relationships here makes that one materialization operation
    auditable and prevents a saved state or public input from leaking in.
    """
    runtime = runtime.resolve()
    if not runtime.is_absolute():
        raise ProfileError("M0 runtime must be absolute")
    values = {
        "RUNTIME": str(runtime),
        "FS_ROOT": str(runtime / "fs-root"),
        "DISK": str(runtime / "disk-sys-303-0.img"),
        "STATE": str(runtime / "usim.state"),
        "SCREENSHOT": str(runtime / "final-framebuffer.pbm"),
    }
    if any("\n" in value or "\r" in value for value in values.values()):
        raise ProfileError("M0 runtime paths must not contain line breaks")
    return values


def materialize_m0_template(template: str, bindings: dict[str, str]) -> str:
    """Expand exactly the portable M0 placeholders, without an ambient state."""
    if set(bindings) != set(M0_TEMPLATE_TOKENS):
        raise ProfileError("M0 template substitutions are incomplete")
    rendered = template
    for token in M0_TEMPLATE_TOKENS:
        placeholder = f"@{token}@"
        if placeholder not in rendered:
            raise ProfileError(f"M0 template is missing {placeholder}")
        rendered = rendered.replace(placeholder, bindings[token])
    if re.search(r"@[A-Z_]+@", rendered):
        raise ProfileError("M0 template contains an unknown placeholder")
    return rendered


def _parse_ini_pairs(text: str, *, allow_placeholders: bool) -> list[tuple[str, str, str]]:
    """Parse the inih/ucfg subset used by the cold-boot configuration.

    This deliberately rejects continuation syntax, duplicate keys, and implicit
    sections: all are accepted or ignored differently by general INI libraries
    and would make a profile comparison less exact than the selected ucfg input.
    """
    section: str | None = None
    result: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str]] = set()
    for number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1].strip()
            if not section or any(character.isspace() for character in section):
                raise ProfileError(f"invalid INI section on line {number}")
            continue
        if section is None or "=" not in line:
            raise ProfileError(f"unsupported M0 INI syntax on line {number}")
        name, value = (part.strip() for part in line.split("=", 1))
        if not name or not value or any(character.isspace() for character in name):
            raise ProfileError(f"invalid M0 INI pair on line {number}")
        if not allow_placeholders and re.search(r"@[A-Z_]+@", value):
            raise ProfileError(f"unexpanded M0 placeholder on line {number}")
        key = (section, name)
        if key in seen:
            raise ProfileError(f"duplicate M0 INI pair on line {number}")
        seen.add(key)
        result.append((section, name, value))
    if not result:
        raise ProfileError("M0 INI contains no options")
    return result


def canonicalize_m0_config(text: str, bindings: dict[str, str], *, template: bool = False) -> str:
    """Normalize one M0 config to its portable placeholder representation."""
    pairs = _parse_ini_pairs(text, allow_placeholders=template)
    replacements = sorted(
        ((value, f"@{token}@") for token, value in bindings.items()),
        key=lambda item: len(item[0]), reverse=True,
    )
    normalized: list[tuple[str, str, str]] = []
    for section, name, value in pairs:
        if not template:
            for concrete, placeholder in replacements:
                value = value.replace(concrete, placeholder)
        normalized.append((section, name, value))
    chunks: list[str] = []
    current: str | None = None
    for section, name, value in normalized:
        if section != current:
            if chunks:
                chunks.append("")
            chunks.append(f"[{section}]")
            current = section
        chunks.append(f"{name} = {value}")
    return "\n".join(chunks) + "\n"


def m0_template_text(repo_root: Path = REPOSITORY) -> str:
    path = repo_root / M0_TEMPLATE_PATH
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ProfileError(f"cannot read M0 template: {path}") from exc


def canonical_m0_template(repo_root: Path = REPOSITORY) -> str:
    bindings = m0_bindings(Path("/cadr-web-private-runtime"))
    return canonicalize_m0_config(m0_template_text(repo_root), bindings, template=True)


def canonical_m0_template_sha256(repo_root: Path = REPOSITORY) -> str:
    return hashlib.sha256(canonical_m0_template(repo_root).encode("utf-8")).hexdigest()


def verify_m0_rendered_config(rendered: str, runtime: Path, repo_root: Path = REPOSITORY) -> str:
    """Return the canonical config digest or reject any effective difference."""
    bindings = m0_bindings(runtime)
    expected = canonical_m0_template(repo_root)
    actual = canonicalize_m0_config(rendered, bindings)
    if actual != expected:
        raise ProfileError("rendered M0 config does not normalize exactly to the portable template")
    return hashlib.sha256(actual.encode("utf-8")).hexdigest()


def m0_phase_evidence(phases: Sequence[str] = M0_PHASE_NAMES) -> dict[str, Any]:
    """Return canonical evidence for host-observable phases only."""
    phase_list = list(phases)
    canonical = json.dumps(
        {"schema": M0_LOG_SCHEMA, "phases": phase_list},
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return {
        "schema": M0_LOG_SCHEMA,
        "phases": phase_list,
        "canonical_sha256": hashlib.sha256(canonical).hexdigest(),
    }


def extract_m0_boot_log_markers(log: str) -> dict[str, Any]:
    """Extract a path-free ordered phase list, not fabricated guest checkpoints."""
    lines = [line.strip() for line in log.splitlines()]
    cursor = 0
    markers: list[str] = []
    for marker, pattern in M0_REQUIRED_MARKERS:
        while cursor < len(lines) and pattern.fullmatch(lines[cursor]) is None:
            cursor += 1
        if cursor == len(lines):
            raise ProfileError(f"M0 boot log is missing ordered marker: {marker}")
        markers.append(marker)
        cursor += 1
    return m0_phase_evidence(markers)

def validate_source_pin(pin: Any, field: str) -> None:
    if not isinstance(pin, dict):
        raise ProfileError(f"{field} must be an object")
    if set(pin) != {"vcs", "hash_algorithm", "revision"}:
        raise ProfileError(f"{field} must contain vcs, hash_algorithm, and revision")
    if pin["vcs"] not in {"fossil", "git"}:
        raise ProfileError(f"{field}.vcs is not recognized")
    algorithm_lengths = {"sha1": 40, "sha256": 64, "sha3-256": 64}
    expected_length = algorithm_lengths.get(pin["hash_algorithm"])
    revision = pin["revision"]
    if (
        expected_length is None
        or not isinstance(revision, str)
        or len(revision) != expected_length
        or re.fullmatch(r"[0-9a-f]+", revision) is None
    ):
        raise ProfileError(f"{field}.revision does not match its hash algorithm")


def validate_artifact(artifact: Any, index: int) -> None:
    if not isinstance(artifact, dict):
        raise ProfileError(f"artifacts[{index}] must be an object")
    for key in ("id", "path", "bytes", "sha256", "disposition", "required"):
        if key not in artifact:
            raise ProfileError(f"artifacts[{index}] is missing {key!r}")
    if not isinstance(artifact["id"], str) or not artifact["id"]:
        raise ProfileError(f"artifacts[{index}].id must be a non-empty string")
    relative_path(artifact["path"])
    if (
        not isinstance(artifact["bytes"], int)
        or isinstance(artifact["bytes"], bool)
        or artifact["bytes"] < 0
    ):
        raise ProfileError(f"artifacts[{index}].bytes must be a non-negative integer")
    require_sha256(artifact["sha256"], f"artifacts[{index}].sha256")
    if artifact["disposition"] not in DISPOSITIONS:
        raise ProfileError(f"artifacts[{index}].disposition is not recognized")
    if not isinstance(artifact["required"], bool):
        raise ProfileError(f"artifacts[{index}].required must be boolean")
    mismatch = artifact.get("upstream_mismatch")
    if mismatch is not None:
        if not isinstance(mismatch, dict):
            raise ProfileError(f"artifacts[{index}].upstream_mismatch must be an object")
        if (
            not isinstance(mismatch.get("bytes"), int)
            or isinstance(mismatch["bytes"], bool)
            or mismatch["bytes"] < 0
        ):
            raise ProfileError(f"artifacts[{index}].upstream_mismatch.bytes must be a non-negative integer")
        require_sha256(mismatch.get("sha256"), f"artifacts[{index}].upstream_mismatch.sha256")


def validate_schema(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ProfileError("manifest must be an object")
    if manifest.get("schema") != "cadr-web-profile":
        raise ProfileError("manifest schema must be 'cadr-web-profile'")
    if manifest.get("schema_version") != 1:
        raise ProfileError("unsupported manifest schema_version")
    profile = manifest.get("profile")
    if not isinstance(profile, dict) or not isinstance(profile.get("id"), str) or not profile["id"]:
        raise ProfileError("profile.id must be a non-empty string")
    pins = manifest.get("source_pins")
    if not isinstance(pins, dict) or not pins:
        raise ProfileError("source_pins must be a non-empty object")
    for name, pin in pins.items():
        if not isinstance(name, str) or not name:
            raise ProfileError("source pin names must be non-empty strings")
        validate_source_pin(pin, f"source_pins.{name}")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        raise ProfileError("artifacts must be a list")
    seen_ids: set[str] = set()
    for index, artifact in enumerate(artifacts):
        validate_artifact(artifact, index)
        if artifact["id"] in seen_ids:
            raise ProfileError(f"duplicate artifact id: {artifact['id']}")
        seen_ids.add(artifact["id"])
    return manifest


def validate_m0_boot_series(series: Any, repo_root: Path = REPOSITORY) -> None:
    if not isinstance(series, dict) or series.get("schema") != M0_EVIDENCE_SCHEMA:
        raise ProfileError("CADR-WEB-303 needs a cadr-m0-boot-evidence-v1 series")
    common = series.get("common")
    if not isinstance(common, dict):
        raise ProfileError("CADR-WEB-303 M0 series needs common invariants")
    if common.get("config_canonical_sha256") != canonical_m0_template_sha256(repo_root):
        raise ProfileError("CADR-WEB-303 M0 config canonical hash does not match the template")
    expected_common = {
        "usim_sha256_at_start_and_exec": "a1d88a5b0ba3d477adfd8e3f9296ad282aa8a1fdc0118b3b27defeffafa53bd6",
        "disk_sha256_before_and_after": "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
        "public_source_revisions_at_start": CADR_WEB_303_RUNTIME_SOURCE_REVISIONS,
        "private_source_tree_sha256_at_copy_and_start": CADR_WEB_303_PRIVATE_SOURCE_TREES,
        "private_source_changed_since_copy": {name: False for name in CADR_WEB_303_PRIVATE_SOURCE_TREES},
        "private_machine_artifacts_sha256_at_start": CADR_WEB_303_MACHINE_ARTIFACTS,
        "window_title": "usim",
        "window_geometry": {"x": 0, "y": 0, "width": 768, "height": 963, "screen": 0},
        "generation": 1,
        "resume_requested": False,
        "saved_state_input": False,
        "resumed": False,
        "forced_stop": False,
        "state_may_be_incomplete": False,
        "usim_exit_status": 0,
        "xvfb_exit_status": 0,
    }
    for key, expected in expected_common.items():
        if common.get(key) != expected:
            raise ProfileError(f"CADR-WEB-303 M0 common invariant is wrong: {key}")
    runs = series.get("runs")
    if not isinstance(runs, list) or len(runs) != 3:
        raise ProfileError("CADR-WEB-303 M0 requires exactly three independent runs")
    pixels: set[str] = set()
    sessions: set[str] = set()
    expected_phases = m0_phase_evidence()
    for index, run in enumerate(runs):
        if not isinstance(run, dict):
            raise ProfileError(f"CADR-WEB-303 M0 run {index} is not an object")
        session = run.get("session")
        if not isinstance(session, str) or not session or session in sessions:
            raise ProfileError("CADR-WEB-303 M0 runs need distinct non-empty session IDs")
        sessions.add(session)
        if run.get("schema") != M0_EVIDENCE_SCHEMA or run.get("cold_boot") is not True:
            raise ProfileError("CADR-WEB-303 M0 run is not a recorded cold boot")
        for key in ("saved_state_input", "resumed", "resume_requested"):
            if run.get(key) is not False:
                raise ProfileError(f"CADR-WEB-303 M0 run must exclude {key}")
        if run.get("generation") != common["generation"]:
            raise ProfileError("CADR-WEB-303 M0 run is not generation one")
        if run.get("config_canonical_sha256") != common["config_canonical_sha256"]:
            raise ProfileError("CADR-WEB-303 M0 run uses a non-canonical configuration")
        if run.get("usim_sha256_at_start") != common["usim_sha256_at_start_and_exec"] or run.get("usim_sha256_at_exec") != common["usim_sha256_at_start_and_exec"]:
            raise ProfileError("CADR-WEB-303 M0 run executable identity differs from common identity")
        if run.get("base_disk_sha256_before_and_after") != common["disk_sha256_before_and_after"] or run.get("private_disk_sha256_before_and_after") != common["disk_sha256_before_and_after"]:
            raise ProfileError("CADR-WEB-303 M0 run disk identity differs from common identity")
        for key in (
            "public_source_revisions_at_start",
            "private_source_tree_sha256_at_copy_and_start",
            "private_source_changed_since_copy",
            "private_machine_artifacts_sha256_at_start",
            "window_title",
            "window_geometry",
        ):
            if run.get(key) != common[key]:
                raise ProfileError(f"CADR-WEB-303 M0 run identity differs from common identity: {key}")
        if run.get("config_runtime_layout") != {
            "fs_root": "runtime/fs-root",
            "disk": "runtime/disk-sys-303-0.img",
            "state_output": "runtime/usim.state",
            "screenshot_output": "runtime/final-framebuffer.pbm",
        }:
            raise ProfileError("CADR-WEB-303 M0 run has an unexpected generated config layout")
        listener = run.get("listener")
        if not isinstance(listener, dict) or listener.get("label") != "listener-ready":
            raise ProfileError("CADR-WEB-303 M0 run lacks Listener screenshot evidence")
        if listener.get("width") != 768 or listener.get("height") != 963:
            raise ProfileError("CADR-WEB-303 M0 Listener evidence has wrong dimensions")
        require_sha256(listener.get("png_sha256"), f"M0 runs[{index}].listener.png_sha256")
        require_sha256(listener.get("pixel_sha256"), f"M0 runs[{index}].listener.pixel_sha256")
        pixels.add(listener["pixel_sha256"])
        if run.get("boot_phases") != expected_phases:
            raise ProfileError("CADR-WEB-303 M0 run lacks the required normalized boot phase sequence")
        clean = run.get("clean_stop")
        if clean != {
            "forced_stop": False,
            "state_may_be_incomplete": False,
            "usim_exit_status": 0,
            "xvfb_exit_status": 0,
        }:
            raise ProfileError("CADR-WEB-303 M0 run did not end in the required clean stop")
    if len(pixels) != 1:
        raise ProfileError("CADR-WEB-303 M0 Listener captures are not pixel-identical")
    if series.get("listener_pixel_sha256") != next(iter(pixels)):
        raise ProfileError("CADR-WEB-303 M0 series pixel hash disagrees with its runs")


def validate_runtime_input_boundary(boundary: Any) -> None:
    """Keep runtime inputs explicit without publishing a machine-local pathname."""
    if not isinstance(boundary, dict):
        raise ProfileError("CADR-WEB-303 needs a runtime input boundary")
    executable = boundary.get("generated_native_executable")
    if executable != {
        "disposition": "generated-local",
        "path_class": "local build output; no host path recorded",
        "sha256": "a1d88a5b0ba3d477adfd8e3f9296ad282aa8a1fdc0118b3b27defeffafa53bd6",
        "bytes": 1215344,
        "source_pin": "usim",
    }:
        raise ProfileError("CADR-WEB-303 generated executable boundary is wrong")
    fs_root = boundary.get("fs_root")
    if not isinstance(fs_root, dict) or fs_root.get("disposition") != "generated-local":
        raise ProfileError("CADR-WEB-303 fs-root must be a generated-local boundary")
    if fs_root.get("path_class") != "fresh per-session runtime/fs-root; no host path recorded":
        raise ProfileError("CADR-WEB-303 fs-root path classification is wrong")
    expected_inputs = [
        {
            "name": "System 303 microcode files",
            "disposition": "metadata-only-review",
            "source_pin": "sys",
            "private_tree_sha256": CADR_WEB_303_PRIVATE_SOURCE_TREES["system"],
            "runtime_paths": [
                "runtime/fs-root/sys/ubin/promh.mcr",
                "runtime/fs-root/sys/ubin/promh.sym",
                "runtime/fs-root/sys/ubin/ucadr.sym",
            ],
            "artifact_ids": ["prom-control-store", "prom-symbols", "microcode-symbols"],
        },
        {
            "name": "LOCAL-CADR Chaos hosts table",
            "disposition": "metadata-only-review",
            "source_pin": "usite",
            "private_tree_sha256": CADR_WEB_303_PRIVATE_SOURCE_TREES["usite"],
            "runtime_paths": ["runtime/fs-root/usite/extra.hosts"],
            "artifact_ids": ["usite-extra-hosts"],
        },
    ]
    if fs_root.get("consumed_inputs") != expected_inputs:
        raise ProfileError("CADR-WEB-303 fs-root consumed input inventory is wrong")
    excluded = fs_root.get("incidental_entries_excluded")
    if not isinstance(excluded, list) or len(excluded) != 3:
        raise ProfileError("CADR-WEB-303 fs-root exclusions are incomplete")
    boundary_bytes = json.dumps(boundary, sort_keys=True)
    if re.search(r"/(?:home|tmp|var|usr)/", boundary_bytes):
        raise ProfileError("CADR-WEB-303 runtime input boundary contains a machine-local path")


def validate_cadr_web_303_invariants(manifest: dict[str, Any]) -> None:
    """Validate the non-negotiable M0 declarations for the named public profile."""
    if manifest["profile"]["id"] != "CADR-WEB-303":
        return
    if manifest["source_pins"] != CADR_WEB_303_PINS:
        raise ProfileError("CADR-WEB-303 source pins do not match the M0 target")
    artifacts = {artifact["id"]: artifact for artifact in manifest["artifacts"]}
    artifact_identities = {
        artifact_id: (
            artifact.get("path"),
            artifact.get("bytes"),
            artifact.get("sha256"),
            artifact.get("disposition"),
            artifact.get("required"),
        )
        for artifact_id, artifact in artifacts.items()
    }
    if artifact_identities != CADR_WEB_303_ARTIFACTS:
        raise ProfileError("CADR-WEB-303 artifact identities do not match the M0 target")
    disk = artifacts.get("system-303-0-base-disk")
    if disk is None or disk.get("disposition") != "unresolved-local-import":
        raise ProfileError("CADR-WEB-303 must retain the unresolved local disk import disposition")
    mismatch = disk.get("upstream_mismatch")
    if mismatch != {
        "bytes": 269562880,
        "sha256": "4e2ddb91e0f71b70fcc80aff1a8484594251f4765d7f94a5b429b64cca136a00",
        "fossil_unversioned_artifact_prefix": "e8eca149",
        "first_differing_byte": 1026,
    }:
        raise ProfileError("CADR-WEB-303 must record the audited upstream disk mismatch")
    if manifest.get("saved_state", {}).get("disposition") != "excluded":
        raise ProfileError("CADR-WEB-303 must exclude an initial saved state")
    executable = manifest.get("native_executable", {})
    candidate = executable.get("candidate", {}) if isinstance(executable, dict) else {}
    if executable.get("disposition") != "m0-boot-golden":
        raise ProfileError("CADR-WEB-303 must identify the M0 boot-golden native executable")
    if candidate.get("backend") != "x11" or candidate.get("build_type") != "release":
        raise ProfileError("CADR-WEB-303 M0 native executable must be the x11 release build")
    if candidate.get("bytes") != 1215344 or candidate.get("sha256") != "a1d88a5b0ba3d477adfd8e3f9296ad282aa8a1fdc0118b3b27defeffafa53bd6":
        raise ProfileError("CADR-WEB-303 M0 native executable identity is wrong")
    initial = manifest.get("cold_boot_initial_state")
    if not isinstance(initial, dict) or initial.get("saved_state_input") is not False:
        raise ProfileError("CADR-WEB-303 must define a no-saved-state cold boot identity")
    if initial.get("config_template") != {
        "path": M0_TEMPLATE_PATH.as_posix(),
        "sha256": "1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f",
        "canonical_sha256": canonical_m0_template_sha256(),
    }:
        raise ProfileError("CADR-WEB-303 cold boot config template identity is wrong")
    if initial.get("disk") != {
        "geometry": "Trident T-300",
        "bytes": 269562880,
        "sha256": "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5",
        "private_copy": "fresh per-session copy of excluded local import",
    }:
        raise ProfileError("CADR-WEB-303 cold boot disk identity is wrong")
    validate_runtime_input_boundary(manifest.get("runtime_input_boundary"))
    validate_m0_boot_series(manifest.get("native_boot_series"))
    blockers = manifest.get("blockers")
    if not isinstance(blockers, list) or {
        blocker.get("id") for blocker in blockers if isinstance(blocker, dict)
    } != CADR_WEB_303_BLOCKERS:
        raise ProfileError("CADR-WEB-303 must record the three M0 blockers")
    status = {blocker["id"]: blocker.get("status") for blocker in blockers}
    if status != {
        "disk-provenance": "excluded-local-import",
        "golden-oracle-stabilization": "closed",
        "distribution-rights": "open",
    }:
        raise ProfileError("CADR-WEB-303 blocker dispositions do not match the M0 closure")
    scopes = {blocker["id"]: blocker.get("m0_blocking") for blocker in blockers}
    if scopes != {
        "disk-provenance": False,
        "golden-oracle-stabilization": True,
        "distribution-rights": False,
    }:
        raise ProfileError("CADR-WEB-303 M0 blocker scopes are wrong")


def safe_artifact_path(repo_root: Path, path: str) -> Path:
    try:
        candidate = (repo_root / relative_path(path)).resolve()
    except (OSError, RuntimeError, ValueError) as exc:
        raise ProfileError(f"artifact path cannot be resolved: {path!r}") from exc
    try:
        candidate.relative_to(repo_root.resolve())
    except ValueError as exc:
        raise ProfileError(f"artifact path escapes repository root: {path!r}") from exc
    return candidate


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_profile(manifest: Any, repo_root: Path) -> dict[str, Any]:
    """Return a machine-readable validation summary; never raise on bad input."""
    summary: dict[str, Any] = {
        "status": "invalid",
        "checked": 0,
        "optional_missing": 0,
        "open_blockers": 0,
        "open_m0_blockers": 0,
        "m0_evidence_valid": False,
        "milestone_ready": False,
        "errors": [],
    }
    try:
        checked_manifest = validate_schema(manifest)
        validate_cadr_web_303_invariants(checked_manifest)
    except ProfileError as exc:
        summary["errors"].append(error("schema", str(exc)))
        return summary

    blockers = checked_manifest.get("blockers", [])
    summary["open_blockers"] = sum(
        1
        for blocker in blockers
        if isinstance(blocker, dict) and blocker.get("status") == "open"
    )
    summary["open_m0_blockers"] = sum(
        1
        for blocker in blockers
        if isinstance(blocker, dict)
        and blocker.get("m0_blocking") is True
        and blocker.get("status") == "open"
    )
    summary["m0_evidence_valid"] = checked_manifest["profile"].get("id") != "CADR-WEB-303"
    if checked_manifest["profile"].get("id") == "CADR-WEB-303":
        # The production invariant already checked all three runs.  Keep this
        # explicit in the machine-readable result so callers cannot mistake a
        # structurally valid manifest for a closed M0 evidence gate.
        summary["m0_evidence_valid"] = True

    for artifact in checked_manifest["artifacts"]:
        try:
            path = safe_artifact_path(repo_root, artifact["path"])
        except ProfileError as exc:
            summary["errors"].append(error("path", str(exc), artifact["id"]))
            continue
        if not path.exists():
            if artifact["required"]:
                summary["errors"].append(error("missing", f"required file is absent: {artifact['path']}", artifact["id"]))
            else:
                summary["optional_missing"] += 1
            continue
        if not path.is_file():
            summary["errors"].append(error("not-file", f"artifact is not a regular file: {artifact['path']}", artifact["id"]))
            continue
        summary["checked"] += 1
        actual_bytes = path.stat().st_size
        if actual_bytes != artifact["bytes"]:
            summary["errors"].append(error("size-mismatch", f"expected {artifact['bytes']} bytes, found {actual_bytes}", artifact["id"]))
            continue
        actual_sha256 = sha256_file(path)
        if actual_sha256 != artifact["sha256"]:
            summary["errors"].append(error("sha256-mismatch", "SHA-256 does not match manifest", artifact["id"]))

    if not summary["errors"]:
        summary["status"] = "ok"
        summary["milestone_ready"] = (
            summary["open_m0_blockers"] == 0 and summary["m0_evidence_valid"]
        )
    return summary


def load_manifest(path: Path) -> Any:
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--repo-root", type=Path, default=REPOSITORY)
    arguments = parser.parse_args(argv)
    repo_root = arguments.repo_root.resolve()
    manifest_path = arguments.manifest
    if not manifest_path.is_absolute():
        manifest_path = repo_root / manifest_path
    try:
        summary = verify_profile(load_manifest(manifest_path), repo_root)
    except (OSError, json.JSONDecodeError) as exc:
        summary = {
            "status": "invalid",
            "checked": 0,
            "optional_missing": 0,
            "open_blockers": 0,
            "milestone_ready": False,
            "errors": [error("manifest", str(exc))],
        }
    print(json.dumps(summary, sort_keys=True))
    return 0 if summary["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
