#!/usr/bin/env python3
"""Drive a private MIT CADR session through Xvfb and XTEST.

The public checkout, load-band disk, and source tree are treated as immutable
inputs.  Each named session receives private copy-on-write-capable copies below
``build/cadr-computer-use``.  A detached supervisor owns both Xvfb and usim so
that shutdown always reaches the emulator before its X server disappears.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
import uuid
from typing import Any, Iterator, Sequence


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_ROOT = ROOT / "build" / "cadr-computer-use"
DEFAULT_SESSION = "default"
SESSION_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}\Z")
LABEL_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,47}\Z")
EXPECTED_WIDTH = 768
EXPECTED_HEIGHT = 963
XVFB_WIDTH = 1024
XVFB_HEIGHT = 1100
STATE_SCHEMA = 1
DISPLAY_RANGE = range(90, 200)
STATE_ROOT_MARKER = ".cadr-computer-use-root"
SESSION_MARKER = ".cadr-computer-use-session"
RUNTIME_MARKER = ".cadr-computer-use-runtime"
STATE_ROOT_MARKER_CONTENT = "MIT CADR computer-use state root v1\n"
SESSION_MARKER_CONTENT = "MIT CADR computer-use session v1\n"
RUNTIME_MARKER_CONTENT = "MIT CADR computer-use private runtime v1\n"
RUNTIME_PREPARE_LOCK = ROOT / "build" / ".cadr-computer-use-runtime.lock"
DISPLAY_ALLOCATE_LOCK = ROOT / "build" / ".cadr-computer-use-display.lock"

KEY_ALIASES = {
    "system": "F1",
    "network": "F2",
    "status": "F3",
    "terminal": "F4",
    "help": "F5",
    "clear-input": "F6",
    "clear-screen": "F7",
    "return": "Return",
    "enter": "Return",
    "rubout": "BackSpace",
    "space": "space",
    "escape": "Escape",
}


class HarnessError(RuntimeError):
    pass


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def json_print(value: Any) -> None:
    print(json.dumps(value, indent=2, sort_keys=True))


def run(
    argv: Sequence[str | os.PathLike[str]],
    *,
    env: dict[str, str] | None = None,
    cwd: Path | None = None,
    check: bool = True,
    text: bool = True,
    timeout: float | None = None,
) -> subprocess.CompletedProcess[Any]:
    try:
        return subprocess.run(
            [os.fspath(item) for item in argv],
            env=env,
            cwd=cwd,
            check=check,
            capture_output=True,
            text=text,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise HarnessError(f"required command not found: {argv[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise HarnessError(f"command timed out after {timeout:g}s: {' '.join(map(os.fspath, argv))}") from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else exc.stderr
        stdout = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else exc.stdout
        detail = (stderr or stdout or "").strip()
        raise HarnessError(f"command failed ({exc.returncode}): {' '.join(map(os.fspath, argv))}\n{detail}") from exc
    except OSError as exc:
        raise HarnessError(f"cannot run command: {' '.join(map(os.fspath, argv))}: {exc}") from exc


def finite_float(value: str, *, positive: bool, maximum: float = 86_400) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"expected a finite number, got {value!r}") from exc
    if not math.isfinite(number) or (number <= 0 if positive else number < 0):
        qualifier = "positive" if positive else "non-negative"
        raise argparse.ArgumentTypeError(f"expected a finite {qualifier} number, got {value!r}")
    if number > maximum:
        raise argparse.ArgumentTypeError(f"expected a number no greater than {maximum:g}, got {value!r}")
    return number


def positive_float(value: str) -> float:
    return finite_float(value, positive=True)


def nonnegative_float(value: str) -> float:
    return finite_float(value, positive=False)


def bounded_int(value: str, *, positive: bool, maximum: int) -> int:
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"expected an integer, got {value!r}") from exc
    invalid = number <= 0 if positive else number < 0
    if invalid:
        qualifier = "positive" if positive else "non-negative"
        raise argparse.ArgumentTypeError(f"expected a {qualifier} integer, got {value!r}")
    if number > maximum:
        raise argparse.ArgumentTypeError(f"expected an integer no greater than {maximum}, got {value!r}")
    return number


def positive_int(value: str) -> int:
    return bounded_int(value, positive=True, maximum=10_000)


def nonnegative_int(value: str) -> int:
    return bounded_int(value, positive=False, maximum=60_000)


def duration_milliseconds(value: str) -> int:
    return bounded_int(value, positive=False, maximum=600_000)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_tree(path: Path) -> str:
    """Hash relative names, entry kinds, symlink targets, and file contents."""
    digest = hashlib.sha256()
    for entry in sorted(path.rglob("*"), key=lambda item: item.relative_to(path).as_posix()):
        relative = entry.relative_to(path).as_posix().encode("utf-8", errors="surrogateescape")
        if entry.is_symlink():
            kind = b"link"
            payload = os.readlink(entry).encode("utf-8", errors="surrogateescape")
        elif entry.is_dir():
            kind = b"directory"
            payload = b""
        elif entry.is_file():
            kind = b"file"
            payload_digest = hashlib.sha256()
            with entry.open("rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    payload_digest.update(chunk)
            payload = payload_digest.digest()
        else:
            kind = b"other"
            payload = b""
        for value in (kind, relative, payload):
            digest.update(len(value).to_bytes(8, "big"))
            digest.update(value)
    return digest.hexdigest()


def boot_id() -> str:
    try:
        return Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip()
    except OSError as exc:
        raise HarnessError("the harness requires Linux /proc process identity data") from exc


def proc_start_ticks(pid: int) -> int | None:
    try:
        stat = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
    except (OSError, ValueError):
        return None
    close = stat.rfind(")")
    if close < 0:
        return None
    fields = stat[close + 2 :].split()
    try:
        return int(fields[19])  # Field 22 overall; fields starts at field 3.
    except (IndexError, ValueError):
        return None


def proc_cmdline(pid: int) -> str:
    try:
        data = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").strip()
    except OSError:
        return ""
    return data.decode(errors="replace")


def process_record(pid: int) -> dict[str, Any]:
    ticks = proc_start_ticks(pid)
    if ticks is None:
        raise HarnessError(f"process {pid} disappeared before it could be recorded")
    return {"pid": pid, "start_ticks": ticks, "cmdline": proc_cmdline(pid)}


def process_matches(record: dict[str, Any] | None, recorded_boot_id: str | None) -> bool:
    if not record or recorded_boot_id != boot_id():
        return False
    try:
        pid = int(record["pid"])
        expected = int(record["start_ticks"])
    except (KeyError, TypeError, ValueError):
        return False
    return proc_start_ticks(pid) == expected


def validate_session_name(name: str) -> str:
    if not SESSION_RE.fullmatch(name) or name in {".", ".."}:
        raise HarnessError("session names must be 1-64 portable filename characters")
    return name


def validate_label(label: str) -> str:
    if not LABEL_RE.fullmatch(label) or label in {".", ".."}:
        raise HarnessError("screenshot labels must be 1-48 portable filename characters")
    return label


def state_root_from(value: str | None) -> Path:
    root = Path(value or os.environ.get("CADR_COMPUTER_USE_ROOT", DEFAULT_STATE_ROOT))
    return root.expanduser().resolve()


def marker_contents(path: Path, description: str) -> str:
    refuse_symlink(path, description)
    if not path.is_file():
        raise HarnessError(f"missing {description}: {path}")
    try:
        return path.read_text(encoding="ascii")
    except OSError as exc:
        raise HarnessError(f"cannot read {description}: {path}") from exc


def ensure_state_root(path: Path) -> None:
    critical_roots = {Path("/").resolve(), Path.home().resolve(), ROOT.resolve()}
    if path in critical_roots:
        raise HarnessError(f"refusing unsafe harness state root: {path}")
    created = False
    if path.exists():
        refuse_symlink(path, "state root")
        if not path.is_dir():
            raise HarnessError(f"state root is not a directory: {path}")
    else:
        path.mkdir(parents=True, mode=0o700)
        created = True

    marker = path / STATE_ROOT_MARKER
    if marker.exists() or marker.is_symlink():
        contents = marker_contents(marker, "harness state-root marker")
        if contents != STATE_ROOT_MARKER_CONTENT:
            raise HarnessError(f"unrecognized harness state-root marker: {marker}")
    elif not created:
        raise HarnessError(
            f"refusing to adopt existing directory without {STATE_ROOT_MARKER}: {path}"
        )
    else:
        try:
            with marker.open("x", encoding="ascii", newline="\n") as output:
                output.write(STATE_ROOT_MARKER_CONTENT)
        except FileExistsError:
            ensure_state_root(path)
            return
        marker.chmod(0o600)
        path.chmod(0o700)


def session_dir_for(state_root: Path, name: str) -> Path:
    validate_session_name(name)
    candidate = state_root / name
    try:
        candidate.resolve().relative_to(state_root.resolve())
    except ValueError as exc:
        raise HarnessError("session path escapes the harness state root") from exc
    return candidate


def refuse_symlink(path: Path, description: str) -> None:
    if path.is_symlink():
        raise HarnessError(f"refusing symbolic link for {description}: {path}")


def ensure_session_directory(path: Path) -> None:
    refuse_symlink(path, "session directory")
    refuse_symlink(path.parent, "state root")
    root_marker = path.parent / STATE_ROOT_MARKER
    if marker_contents(root_marker, "harness state-root marker") != STATE_ROOT_MARKER_CONTENT:
        raise HarnessError(f"unrecognized harness state-root marker: {root_marker}")
    if path.exists():
        if not path.is_dir():
            raise HarnessError(f"session path is not a directory: {path}")
        require_session_directory(path)
    else:
        path.mkdir(mode=0o700)
        marker = path / SESSION_MARKER
        marker.write_text(SESSION_MARKER_CONTENT, encoding="ascii", newline="\n")
        marker.chmod(0o600)
    path.chmod(0o700)


def require_session_directory(path: Path) -> None:
    refuse_symlink(path, "session directory")
    if not path.is_dir():
        raise HarnessError(f"session directory does not exist: {path}")
    marker = path / SESSION_MARKER
    if not marker.exists() and not marker.is_symlink():
        raise HarnessError(f"refusing unowned session directory without {SESSION_MARKER}: {path}")
    contents = marker_contents(marker, "harness session marker")
    if contents != SESSION_MARKER_CONTENT:
        raise HarnessError(f"unrecognized harness session marker: {marker}")


@contextlib.contextmanager
def locked(path: Path, *, create_parent: bool = True) -> Iterator[None]:
    if create_parent:
        path.parent.mkdir(parents=True, exist_ok=True)
    elif not path.parent.is_dir():
        raise HarnessError(f"lock parent directory does not exist: {path.parent}")
    refuse_symlink(path, "lock file")
    try:
        lock_file = path.open("a+b")
    except OSError as exc:
        raise HarnessError(f"cannot open harness lock: {path}") from exc
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
    except OSError as exc:
        lock_file.close()
        raise HarnessError(f"cannot lock harness lock: {path}") from exc
    try:
        yield
    finally:
        lock_file.close()


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o600)
    os.replace(temporary, path)


def state_path(session_dir: Path) -> Path:
    return session_dir / "run.json"


def read_state(session_dir: Path, *, required: bool = True) -> dict[str, Any]:
    path = state_path(session_dir)
    if not path.is_file():
        if required:
            raise HarnessError(f"session has not been started: {session_dir.name}")
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"cannot read session state: {path}") from exc
    if value.get("schema") != STATE_SCHEMA:
        raise HarnessError(f"unsupported session-state schema in {path}")
    return value


def update_state(session_dir: Path, changes: dict[str, Any]) -> dict[str, Any]:
    with locked(session_dir / "state.lock"):
        state = read_state(session_dir, required=False)
        state.update(changes)
        state.setdefault("schema", STATE_SCHEMA)
        atomic_write_json(state_path(session_dir), state)
        return state


def live_processes(state: dict[str, Any]) -> dict[str, bool]:
    recorded_boot_id = state.get("boot_id")
    return {
        name: process_matches(state.get(name), recorded_boot_id)
        for name in ("supervisor", "xvfb", "usim")
    }


def command_paths() -> dict[str, str | None]:
    return {
        command: shutil.which(command)
        for command in (
            "Xvfb",
            "xauth",
            "xdotool",
            "import",
            "identify",
            "convert",
            "make",
            "cp",
            "flock",
            "guix",
        )
    }


def toolchain_provenance() -> dict[str, Any]:
    commands = command_paths()
    resolved_commands = {
        name: str(Path(path).resolve()) if path else None for name, path in commands.items()
    }
    guix_channels: Any = None
    guix_error: str | None = None
    if commands.get("guix"):
        result = run([commands["guix"], "describe", "--format=json"], check=False, timeout=30)
        if result.returncode == 0:
            try:
                guix_channels = json.loads(result.stdout)
            except json.JSONDecodeError:
                guix_error = "guix describe returned invalid JSON"
        else:
            guix_error = (result.stderr or result.stdout).strip() or f"exit status {result.returncode}"
    else:
        guix_error = "guix command not found"
    return {
        "python_version": sys.version.split()[0],
        "python_executable": str(Path(sys.executable).resolve()),
        "manifest_sha256": sha256_file(ROOT / "manifest.scm"),
        "guix_channels": guix_channels,
        "guix_error": guix_error,
        "commands": resolved_commands,
    }


def base_paths() -> dict[str, Path]:
    return {
        "usim": ROOT / "l" / "usim" / "usim",
        "disk": ROOT / "l" / "usim" / "disk-sys-303-0.img",
        "prommcr": ROOT / "l" / "sys" / "ubin" / "promh.mcr",
        "promsym": ROOT / "l" / "sys" / "ubin" / "promh.sym",
        "mcrsym": ROOT / "l" / "sys" / "ubin" / "ucadr.sym",
        "hosts": ROOT / "l" / "usite" / "extra.hosts",
        "sys": ROOT / "l" / "sys",
        "usite": ROOT / "l" / "usite",
        "chaos": ROOT / "l" / "chaos",
    }


def binary_usable(path: Path) -> bool:
    if not path.is_file() or not os.access(path, os.X_OK):
        return False
    try:
        result = subprocess.run(
            [path, "-h"],
            cwd=path.parent,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


def ensure_runtime_ready() -> dict[str, Path]:
    paths = base_paths()
    non_binary = [key for key, path in paths.items() if key != "usim" and not path.exists()]
    if non_binary or not binary_usable(paths["usim"]):
        launcher = ROOT / "scripts" / "cadr-guix-container.sh"
        environment = os.environ.copy()
        environment["CADR_RUNTIME_LOCK_HELD"] = "1"
        run(
            [launcher, "--mode", "run", "--prepare-only"],
            cwd=ROOT,
            env=environment,
            timeout=1800,
        )
    missing = [key for key, path in paths.items() if key != "usim" and not path.exists()]
    if missing:
        raise HarnessError(f"CADR preparation did not create required artifacts: {', '.join(missing)}")

    if not binary_usable(paths["usim"]):
        raise HarnessError("usim still cannot execute after rebuilding it in the current Guix environment")
    return paths


def fossil_checkout_revision(checkout: Path, repository: Path) -> str | None:
    checkout_db = checkout / ".fslckout"
    if not checkout_db.is_file() or not repository.is_file():
        return None
    try:
        with sqlite3.connect(f"file:{checkout_db}?mode=ro", uri=True) as local_db:
            row = local_db.execute("SELECT value FROM vvar WHERE name='checkout'").fetchone()
        if not row:
            return None
        rid = int(row[0])
        with sqlite3.connect(f"file:{repository}?mode=ro", uri=True) as repo_db:
            row = repo_db.execute("SELECT uuid FROM blob WHERE rid=?", (rid,)).fetchone()
        return str(row[0]) if row else None
    except (OSError, sqlite3.Error, TypeError, ValueError):
        return None


def source_revisions() -> dict[str, str | None]:
    return {
        name: fossil_checkout_revision(ROOT / checkout, ROOT / f"{repo}.fossil")
        for name, checkout, repo in (
            ("l", "l", "l"),
            ("usim", "l/usim", "usim"),
            ("chaos", "l/chaos", "chaos"),
            ("system", "l/sys", "sys"),
            ("usite", "l/usite", "usite"),
        )
    }


def copy_reflink(source: Path, destination: Path) -> None:
    if destination.exists() or destination.is_symlink():
        raise HarnessError(f"refusing to replace session artifact: {destination}")
    run(["cp", "-a", "--reflink=auto", "--sparse=always", source, destination], timeout=900)


def remove_tree(path: Path, parent: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    refuse_symlink(path, "removal target")
    try:
        path.resolve().relative_to(parent.resolve())
    except ValueError as exc:
        raise HarnessError(f"refusing to remove path outside {parent}: {path}") from exc
    shutil.rmtree(path)


def render_config(paths: dict[str, Path], runtime: Path) -> str:
    fs_root = runtime / "fs-root"
    return f"""[usim]
fs_root_directory = {fs_root}
state_filename = {runtime / 'usim.state'}
screenshot_filename = {runtime / 'final-framebuffer.pbm'}
kbd = cadet
monitor = other
grab_keyboard = false
geometry = 0 0
scale = 1
scale_filter = nearest
allow_resize = false
beep_amplitude = 0
special_key = F12

[ucode]
prommcr_filename = {fs_root / 'sys' / 'ubin' / paths['prommcr'].name}
promsym_filename = {fs_root / 'sys' / 'ubin' / paths['promsym'].name}
mcrsym_filename = {fs_root / 'sys' / 'ubin' / paths['mcrsym'].name}
track_mouse = false

[chaos]
hosts = {fs_root / 'usite' / 'extra.hosts'}
backend = local
myname = LOCAL-CADR
servername = LOCAL-BRIDGE

[disk]
disk0 = T-300,{runtime / 'disk-sys-303-0.img'}
"""


def prepare_session(session_dir: Path, paths: dict[str, Path], *, fresh: bool) -> tuple[dict[str, Any], bool]:
    previous = read_state(session_dir, required=False)
    runtime = session_dir / "runtime"
    current_revisions = source_revisions()
    refuse_symlink(runtime, "private runtime")
    if runtime.exists() and not runtime.is_dir():
        raise HarnessError(f"private runtime is not a directory: {runtime}")
    if runtime.is_dir():
        existing_runtime_marker = runtime / RUNTIME_MARKER
        if (
            marker_contents(existing_runtime_marker, "private-runtime marker")
            != RUNTIME_MARKER_CONTENT
        ):
            raise HarnessError(f"unrecognized private-runtime marker: {existing_runtime_marker}")

    if fresh or not runtime.is_dir():
        for stale in session_dir.glob(".runtime-*.tmp"):
            remove_tree(stale, session_dir)
        staged = session_dir / f".runtime-{os.getpid()}-{uuid.uuid4().hex}.tmp"
        staged.mkdir(mode=0o700)
        try:
            fs_root = staged / "fs-root"
            fs_root.mkdir(mode=0o700)
            copy_reflink(paths["disk"], staged / "disk-sys-303-0.img")
            copied_disk_hash = sha256_file(staged / "disk-sys-303-0.img")
            base_disk_hash = sha256_file(paths["disk"])
            if copied_disk_hash != base_disk_hash:
                raise HarnessError("private load-band copy does not match the public base checksum")
            copy_reflink(paths["sys"], fs_root / "sys")
            copy_reflink(paths["usite"], fs_root / "usite")
            copy_reflink(paths["chaos"], fs_root / "chaos")
            (fs_root / "tree").symlink_to("sys", target_is_directory=True)
            private_sources = {
                "system": fs_root / "sys",
                "usite": fs_root / "usite",
                "chaos": fs_root / "chaos",
            }
            source_snapshot = {
                "schema": 1,
                "copied_at": now_iso(),
                "revisions_at_copy": {
                    name: current_revisions[name] for name in private_sources
                },
                "tree_sha256_at_copy": {
                    name: sha256_tree(path) for name, path in private_sources.items()
                },
            }
            atomic_write_json(staged / "source-snapshot.json", source_snapshot)
            marker = staged / RUNTIME_MARKER
            marker.write_text(RUNTIME_MARKER_CONTENT, encoding="ascii", newline="\n")
            marker.chmod(0o600)
            remove_tree(runtime, session_dir)
            os.replace(staged, runtime)
        finally:
            remove_tree(staged, session_dir)

    runtime_marker = runtime / RUNTIME_MARKER
    if marker_contents(runtime_marker, "private-runtime marker") != RUNTIME_MARKER_CONTENT:
        raise HarnessError(f"unrecognized private-runtime marker: {runtime_marker}")
    state_file = runtime / "usim.state"
    refuse_symlink(state_file, "saved emulator state")
    source_snapshot_path = runtime / "source-snapshot.json"
    refuse_symlink(source_snapshot_path, "private source snapshot")
    can_resume = (runtime / "disk-sys-303-0.img").is_file() and state_file.is_file()

    if not source_snapshot_path.is_file():
        raise HarnessError(
            "private runtime predates source provenance manifests; restart this session with --fresh"
        )
    try:
        source_snapshot = json.loads(source_snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"cannot read private source snapshot: {source_snapshot_path}") from exc
    if source_snapshot.get("schema") != 1:
        raise HarnessError(f"unsupported private source-snapshot schema: {source_snapshot_path}")

    fs_root = runtime / "fs-root"
    private_sources = {
        "system": fs_root / "sys",
        "usite": fs_root / "usite",
        "chaos": fs_root / "chaos",
    }
    for name, path in private_sources.items():
        refuse_symlink(path, f"private {name} source tree")
    missing_private_sources = [name for name, path in private_sources.items() if not path.is_dir()]
    if missing_private_sources:
        raise HarnessError(
            f"private runtime is missing source trees: {', '.join(missing_private_sources)}; use --fresh"
        )
    private_hashes = {name: sha256_tree(path) for name, path in private_sources.items()}
    copy_hashes = source_snapshot.get("tree_sha256_at_copy", {})
    if not isinstance(copy_hashes, dict) or set(copy_hashes) != set(private_sources):
        raise HarnessError(f"incomplete private source provenance: {source_snapshot_path}")
    private_changes = {
        name: private_hashes[name] != copy_hashes.get(name) for name in private_sources
    }

    config = runtime / "usim.ini"
    refuse_symlink(config, "private emulator configuration")
    config.write_text(render_config(paths, runtime), encoding="utf-8", newline="\n")
    config.chmod(0o600)

    screenshots = session_dir / "screenshots"
    refuse_symlink(screenshots, "screenshot directory")
    if screenshots.exists() and not screenshots.is_dir():
        raise HarnessError(f"screenshot path is not a directory: {screenshots}")
    screenshots.mkdir(mode=0o700, exist_ok=True)
    base_hash = sha256_file(paths["disk"])
    session_disk = runtime / "disk-sys-303-0.img"
    refuse_symlink(session_disk, "private load-band disk")
    if not session_disk.is_file():
        raise HarnessError(f"private runtime is missing its load-band disk: {session_disk}")
    machine_artifacts = {
        name: fs_root / "sys" / "ubin" / name
        for name in ("promh.mcr", "promh.sym", "ucadr.sym")
    }
    missing_machine_artifacts = [name for name, path in machine_artifacts.items() if not path.is_file()]
    if missing_machine_artifacts:
        raise HarnessError(
            f"private runtime is missing machine artifacts: {', '.join(missing_machine_artifacts)}"
        )
    try:
        generation = int(previous.get("generation", 0)) + 1
    except (TypeError, ValueError) as exc:
        raise HarnessError("invalid prior session generation") from exc
    metadata = {
        "schema": STATE_SCHEMA,
        "session": session_dir.name,
        "session_dir": str(session_dir),
        "status": "prepared",
        "generation": generation,
        "boot_id": boot_id(),
        "prepared_at": now_iso(),
        "load_band": "System 303-0",
        "base_disk": str(paths["disk"]),
        "base_disk_sha256": base_hash,
        "session_disk": str(session_disk),
        "session_disk_sha256_at_start": sha256_file(session_disk),
        "public_source_revisions_at_start": current_revisions,
        "private_source_snapshot": source_snapshot,
        "private_source_tree_sha256_at_start": private_hashes,
        "private_source_changed_since_copy": private_changes,
        "usim_sha256_at_start": sha256_file(paths["usim"]),
        "private_machine_artifacts_sha256_at_start": {
            name: sha256_file(path) for name, path in machine_artifacts.items()
        },
        "toolchain_provenance": toolchain_provenance(),
        "runtime": {
            "usim": str(paths["usim"]),
            "config": str(config),
            "state": str(state_file),
            "native_screenshot": str(runtime / "final-framebuffer.pbm"),
            "fs_root": str(runtime / "fs-root"),
        },
        "xvfb_screen": {"width": XVFB_WIDTH, "height": XVFB_HEIGHT, "depth": 24},
        "expected_framebuffer": {"width": EXPECTED_WIDTH, "height": EXPECTED_HEIGHT},
    }
    return metadata, can_resume and not fresh


def x_environment(state: dict[str, Any]) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "DISPLAY": state["display"],
            "XAUTHORITY": state["xauthority"],
            "SDL_AUDIODRIVER": "dummy",
            "SDL_VIDEODRIVER": "x11",
            "LIBGL_ALWAYS_SOFTWARE": "1",
            "XDG_RUNTIME_DIR": str(Path(state["session_dir"]) / "runtime" / "xdg-runtime"),
            "HOME": str(Path(state["session_dir"]) / "runtime" / "home"),
        }
    )
    return env


def xdotool(state: dict[str, Any], arguments: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["xdotool", *arguments], env=x_environment(state), check=check)


def geometry_for_window(state: dict[str, Any], window_id: int) -> dict[str, int] | None:
    result = xdotool(state, ["getwindowgeometry", "--shell", str(window_id)], check=False)
    if result.returncode != 0:
        return None
    values: dict[str, int] = {}
    for line in result.stdout.splitlines():
        key, separator, value = line.partition("=")
        if separator and key in {"X", "Y", "WIDTH", "HEIGHT", "SCREEN"}:
            try:
                values[key.lower()] = int(value)
            except ValueError:
                return None
    return values if {"width", "height"}.issubset(values) else None


def window_title(state: dict[str, Any], window_id: int) -> str:
    result = xdotool(state, ["getwindowname", str(window_id)], check=False)
    return result.stdout.rstrip("\n") if result.returncode == 0 else ""


def discover_window(state: dict[str, Any]) -> tuple[int, dict[str, int], str] | None:
    result = xdotool(state, ["search", "--onlyvisible", "--name", "."], check=False)
    if result.returncode != 0:
        return None
    candidates: list[tuple[int, dict[str, int], str]] = []
    for raw in result.stdout.splitlines():
        try:
            window_id = int(raw.strip())
        except ValueError:
            continue
        geometry = geometry_for_window(state, window_id)
        if not geometry:
            continue
        title = window_title(state, window_id)
        candidates.append((window_id, geometry, title))
    for candidate in candidates:
        if candidate[1].get("width") == EXPECTED_WIDTH and candidate[1].get("height") == EXPECTED_HEIGHT:
            return candidate
    for candidate in candidates:
        if candidate[2] == "usim" or "LOCAL-CADR" in candidate[2]:
            return candidate
    return candidates[0] if len(candidates) == 1 else None


def start_xvfb(session_dir: Path) -> tuple[subprocess.Popen[bytes], str, Path]:
    xauthority = session_dir / "runtime" / "Xauthority"
    xlog_path = session_dir / f"xvfb-generation-{read_state(session_dir)['generation']}.log"
    xlog = xlog_path.open("ab", buffering=0)
    with locked(DISPLAY_ALLOCATE_LOCK):
        for number in DISPLAY_RANGE:
            if Path(f"/tmp/.X11-unix/X{number}").exists() or Path(f"/tmp/.X{number}-lock").exists():
                continue
            xauthority.unlink(missing_ok=True)
            cookie = secrets.token_hex(16)
            run(["xauth", "-f", xauthority, "add", f":{number}", "MIT-MAGIC-COOKIE-1", cookie])
            xauthority.chmod(0o600)
            process = subprocess.Popen(
                [
                    "Xvfb",
                    f":{number}",
                    "-screen",
                    "0",
                    f"{XVFB_WIDTH}x{XVFB_HEIGHT}x24",
                    "-nolisten",
                    "tcp",
                    "-noreset",
                    "-auth",
                    str(xauthority),
                ],
                stdin=subprocess.DEVNULL,
                stdout=xlog,
                stderr=subprocess.STDOUT,
            )
            probe_state = {
                "display": f":{number}",
                "xauthority": str(xauthority),
                "session_dir": str(session_dir),
            }
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and process.poll() is None:
                probe = xdotool(probe_state, ["getdisplaygeometry"], check=False)
                if probe.returncode == 0:
                    xlog.close()
                    return process, f":{number}", xauthority
                time.sleep(0.1)
            if process.poll() is None:
                process.terminate()
                with contextlib.suppress(subprocess.TimeoutExpired):
                    process.wait(timeout=3)
            xauthority.unlink(missing_ok=True)
    xlog.close()
    raise HarnessError("could not allocate a private Xvfb display in :90 through :199")


def wait_for_own_record(session_dir: Path) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        state = read_state(session_dir, required=False)
        record = state.get("supervisor")
        if record and int(record.get("pid", -1)) == os.getpid():
            return state
        time.sleep(0.05)
    raise HarnessError("supervisor was not recorded by its parent")


def terminate_process(
    process: subprocess.Popen[Any] | None, timeout: float
) -> tuple[int | None, bool]:
    if process is None:
        return None, False
    forced = False
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            forced = True
            process.wait(timeout=5)
    return process.returncode, forced


def supervise(session_dir: Path, resume: bool) -> int:
    stop_requested = False

    def request_stop(_signum: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    state = wait_for_own_record(session_dir)
    xvfb_process: subprocess.Popen[bytes] | None = None
    usim_process: subprocess.Popen[bytes] | None = None
    error: str | None = None
    usim_forced = False
    try:
        xvfb_process, display, xauthority = start_xvfb(session_dir)
        state = update_state(
            session_dir,
            {
                "status": "xvfb-ready",
                "display": display,
                "xauthority": str(xauthority),
                "xvfb": process_record(xvfb_process.pid),
            },
        )
        runtime = state["runtime"]
        xdg_runtime = Path(x_environment(state)["XDG_RUNTIME_DIR"])
        home = Path(x_environment(state)["HOME"])
        xdg_runtime.mkdir(mode=0o700, exist_ok=True)
        home.mkdir(mode=0o700, exist_ok=True)
        generation = state["generation"]
        usim_log_path = session_dir / f"usim-generation-{generation}.log"
        with usim_log_path.open("ab", buffering=0) as usim_log:
            arguments = [runtime["usim"], "-c", runtime["config"]]
            if resume:
                arguments.extend(["-w", runtime["state"]])
            # The prepared executable is shared with the ordinary CADR launcher.
            # Recheck it and fork/exec under the same lock used by rebuilds, so
            # provenance cannot describe one binary while the child maps another.
            with locked(RUNTIME_PREPARE_LOCK):
                usim_hash_at_exec = sha256_file(Path(runtime["usim"]))
                if usim_hash_at_exec != state["usim_sha256_at_start"]:
                    raise HarnessError(
                        "shared usim changed after session preparation; start the session again"
                    )
                usim_process = subprocess.Popen(
                    arguments,
                    cwd=Path(runtime["config"]).parent,
                    env=x_environment(state),
                    stdin=subprocess.DEVNULL,
                    stdout=usim_log,
                    stderr=subprocess.STDOUT,
                )
            state = update_state(
                session_dir,
                {
                    "status": "waiting-for-window",
                    "resumed": resume,
                    "usim": process_record(usim_process.pid),
                    "usim_sha256_at_exec": usim_hash_at_exec,
                    "usim_log": str(usim_log_path),
                    "started_at": now_iso(),
                },
            )
            deadline = time.monotonic() + 30
            found: tuple[int, dict[str, int], str] | None = None
            while time.monotonic() < deadline and not stop_requested and usim_process.poll() is None:
                found = discover_window(state)
                if found:
                    break
                time.sleep(0.2)
            if found is None:
                if usim_process.poll() is not None:
                    raise HarnessError(f"usim exited before creating its window (status {usim_process.returncode})")
                if not stop_requested:
                    raise HarnessError("usim did not create a discoverable X window within 30 seconds")
            else:
                window_id, geometry, title = found
                state = update_state(
                    session_dir,
                    {
                        "status": "running",
                        "window_id": window_id,
                        "window_geometry": geometry,
                        "window_title": title,
                        "window_ready_at": now_iso(),
                    },
                )

            while usim_process.poll() is None and not stop_requested:
                if xvfb_process.poll() is not None:
                    raise HarnessError(f"Xvfb exited unexpectedly (status {xvfb_process.returncode})")
                time.sleep(0.25)
            if stop_requested:
                usim_exit, usim_forced = terminate_process(usim_process, 25)
            else:
                usim_exit = usim_process.returncode
                raise HarnessError(f"usim exited unexpectedly (status {usim_exit})")
    except Exception as exc:  # The error is serialized for the controlling process.
        error = str(exc)
        usim_exit, usim_forced = terminate_process(usim_process, 25)
    finally:
        xvfb_exit, xvfb_forced = terminate_process(xvfb_process, 5)
        forced_stop = usim_forced or xvfb_forced
        final = read_state(session_dir, required=False)
        base_path = Path(final["base_disk"]) if final.get("base_disk") else None
        base_hash = sha256_file(base_path) if base_path and base_path.is_file() else None
        update_state(
            session_dir,
            {
                "status": "failed" if error else "forced-stopped" if forced_stop else "stopped",
                "error": error,
                "forced_stop": forced_stop,
                "state_may_be_incomplete": forced_stop,
                "usim_exit_status": usim_exit,
                "xvfb_exit_status": xvfb_exit,
                "stopped_at": now_iso(),
                "base_disk_sha256_after": base_hash,
                "base_disk_unchanged": bool(base_hash and base_hash == final.get("base_disk_sha256")),
            },
        )
    return 1 if error else 0


def require_running(session_dir: Path) -> dict[str, Any]:
    require_session_directory(session_dir)
    state = read_state(session_dir)
    live = live_processes(state)
    if state.get("status") != "running" or not all(live.values()):
        raise HarnessError(f"session {session_dir.name!r} is not fully running: {state.get('status')}, {live}")
    if not state.get("window_id"):
        raise HarnessError("running session has no recorded window")
    return state


def focus_window(state: dict[str, Any]) -> None:
    xdotool(state, ["windowfocus", "--sync", str(state["window_id"])])


def capture_window(state: dict[str, Any], destination: Path) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.stem}.{uuid.uuid4().hex}.tmp.png")
    env = x_environment(state)
    try:
        run(["import", "-silent", "-window", str(state["window_id"]), f"png:{temporary}"], env=env, timeout=30)
        dimensions = run(["identify", "-format", "%w %h", temporary], env=env).stdout.strip().split()
        if len(dimensions) != 2:
            raise HarnessError("ImageMagick did not report screenshot dimensions")
        width, height = map(int, dimensions)
        raw = run(
            ["convert", temporary, "-alpha", "off", "-depth", "8", "rgb:-"],
            env=env,
            text=False,
            timeout=30,
        ).stdout
        pixel_sha256 = hashlib.sha256(raw).hexdigest()
        png_sha256 = sha256_file(temporary)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)
    return {
        "path": str(destination.resolve()),
        "width": width,
        "height": height,
        "png_sha256": png_sha256,
        "pixel_sha256": pixel_sha256,
    }


def next_screenshot_path(session_dir: Path, label: str) -> Path:
    screenshots = session_dir / "screenshots"
    numbers = []
    for path in screenshots.glob("*.png"):
        match = re.match(r"([0-9]+)-", path.name)
        if match:
            numbers.append(int(match.group(1)))
    number = max(numbers, default=0) + 1
    return screenshots / f"{number:04d}-{validate_label(label)}.png"


def take_screenshot(session_dir: Path, label: str) -> dict[str, Any]:
    state = require_running(session_dir)
    destination = next_screenshot_path(session_dir, label)
    captured = capture_window(state, destination)
    geometry = geometry_for_window(state, int(state["window_id"])) or state.get("window_geometry")
    title = window_title(state, int(state["window_id"]))
    metadata = {
        "format": "MIT CADR Xvfb computer-use screenshot provenance",
        "timestamp": now_iso(),
        "session": state["session"],
        "generation": state["generation"],
        "display": state["display"],
        "window_id": state["window_id"],
        "window_title": title,
        "window_geometry": geometry,
        "load_band": state["load_band"],
        "base_disk_sha256": state["base_disk_sha256"],
        "session_disk_sha256_at_start": state["session_disk_sha256_at_start"],
        "public_source_revisions_at_start": state["public_source_revisions_at_start"],
        "private_source_snapshot": state["private_source_snapshot"],
        "private_source_tree_sha256_at_start": state[
            "private_source_tree_sha256_at_start"
        ],
        "private_source_changed_since_copy": state["private_source_changed_since_copy"],
        "usim_sha256_at_start": state["usim_sha256_at_start"],
        "private_machine_artifacts_sha256_at_start": state[
            "private_machine_artifacts_sha256_at_start"
        ],
        "toolchain_provenance": state["toolchain_provenance"],
        **captured,
    }
    atomic_write_json(destination.with_suffix(".json"), metadata)
    return metadata


def command_doctor(_args: argparse.Namespace, state_root: Path) -> int:
    paths = base_paths()
    tools = command_paths()
    result = {
        "state_root": str(state_root),
        "commands": tools,
        "base_artifacts": {name: {"path": str(path), "exists": path.exists()} for name, path in paths.items()},
        "usim_usable": binary_usable(paths["usim"]),
        "expected_framebuffer": {"width": EXPECTED_WIDTH, "height": EXPECTED_HEIGHT},
        "source_revisions": source_revisions(),
    }
    result["ok"] = all(tools.values()) and all(item["exists"] for item in result["base_artifacts"].values()) and result["usim_usable"]
    json_print(result)
    return 0 if result["ok"] else 1


def command_start(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(state_root / ".lifecycle.lock", create_parent=False):
        ensure_session_directory(session_dir)
        with locked(session_dir / "control.lock", create_parent=False):
            prior = read_state(session_dir, required=False)
            if prior and any(live_processes(prior).values()):
                raise HarnessError(f"session {args.session!r} still owns live processes")
            with locked(RUNTIME_PREPARE_LOCK):
                paths = ensure_runtime_ready()
                metadata, resumable = prepare_session(session_dir, paths, fresh=args.fresh)
            if args.resume and not resumable:
                raise HarnessError("--resume needs a state file produced by an earlier clean stop")
            resume = bool(args.resume)
            metadata["state_root"] = str(state_root)
            metadata["status"] = "starting"
            atomic_write_json(state_path(session_dir), metadata)
            supervisor_log = session_dir / f"supervisor-generation-{metadata['generation']}.log"
            with supervisor_log.open("ab", buffering=0) as log:
                command = [
                    sys.executable,
                    str(Path(__file__).resolve()),
                    "--state-root",
                    str(state_root),
                    "_supervise",
                    "--session",
                    args.session,
                ]
                if resume:
                    command.append("--resume")
                process = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    start_new_session=True,
                )
            update_state(
                session_dir,
                {
                    "supervisor": process_record(process.pid),
                    "supervisor_log": str(supervisor_log),
                    "resume_requested": resume,
                },
            )

    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        state = read_state(session_dir)
        if state.get("status") == "running":
            # A restored framebuffer can appear just before an invalid warm state
            # halts.  Require a short live interval before reporting success.
            time.sleep(0.75)
            state = read_state(session_dir)
            payload = status_payload(state)
            if state.get("status") == "running" and all(payload["live"].values()):
                json_print(payload)
                return 0
        if state.get("status") in {"failed", "stopped"}:
            raise HarnessError(state.get("error") or "supervisor stopped before the window became ready")
        time.sleep(0.2)
    state = read_state(session_dir)
    record = state.get("supervisor")
    if process_matches(record, state.get("boot_id")):
        os.kill(int(record["pid"]), signal.SIGTERM)
    raise HarnessError(f"timed out after {args.timeout:g}s waiting for the CADR window")


def status_payload(state: dict[str, Any]) -> dict[str, Any]:
    payload = dict(state)
    payload["live"] = live_processes(state)
    if payload["live"].get("xvfb") and state.get("window_id"):
        payload["current_window_title"] = window_title(state, int(state["window_id"]))
        payload["current_window_geometry"] = geometry_for_window(state, int(state["window_id"]))
    return payload


def command_status(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    require_session_directory(session_dir)
    state = read_state(session_dir)
    payload = status_payload(state)
    json_print(payload)
    return 0 if all(payload["live"].values()) and state.get("status") == "running" else 1


def command_screenshot(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        metadata = take_screenshot(session_dir, args.label)
    json_print(metadata)
    return 0


def translate_keys(keys: Sequence[str]) -> list[str]:
    return [KEY_ALIASES.get(key.lower(), key) for key in keys]


def command_key(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        focus_window(state)
        action = "keydown" if args.down else "keyup" if args.up else "key"
        keys = translate_keys(args.keys)
        command = [action]
        if action == "key":
            command.extend(["--clearmodifiers", "--delay", str(args.delay_ms)])
        command.append("--")
        command.extend(keys)
        xdotool(state, command)
    json_print({"action": action, "keys": keys, "session": args.session, "timestamp": now_iso()})
    return 0


def command_type(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        focus_window(state)
        xdotool(state, ["type", "--clearmodifiers", "--delay", str(args.delay_ms), "--", args.text])
        if args.enter:
            xdotool(state, ["key", "--clearmodifiers", "Return"])
    json_print(
        {
            "action": "type",
            "character_count": len(args.text),
            "delay_ms": args.delay_ms,
            "enter": args.enter,
            "session": args.session,
            "timestamp": now_iso(),
        }
    )
    return 0


def validate_coordinates(x: int, y: int) -> None:
    if not (0 <= x < EXPECTED_WIDTH and 0 <= y < EXPECTED_HEIGHT):
        raise HarnessError(f"CADR coordinates must be within 0..{EXPECTED_WIDTH - 1}, 0..{EXPECTED_HEIGHT - 1}")


def mouse_move(state: dict[str, Any], x: int, y: int) -> None:
    validate_coordinates(x, y)
    xdotool(state, ["mousemove", "--sync", "--window", str(state["window_id"]), str(x), str(y)])


def validate_button(button: int) -> None:
    if button not in (1, 2, 3):
        raise HarnessError("CADR mouse buttons are host buttons 1 (tail), 2 (middle), or 3 (head)")


def command_mouse(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        focus_window(state)
        result: dict[str, Any] = {"action": args.mouse_action, "session": args.session, "timestamp": now_iso()}
        if args.mouse_action == "move":
            mouse_move(state, args.x, args.y)
            result.update({"x": args.x, "y": args.y})
        elif args.mouse_action == "click":
            validate_button(args.button)
            mouse_move(state, args.x, args.y)
            xdotool(state, ["click", str(args.button)])
            result.update({"x": args.x, "y": args.y, "button": args.button})
        elif args.mouse_action in {"down", "up"}:
            validate_button(args.button)
            xdotool(state, ["mousedown" if args.mouse_action == "down" else "mouseup", str(args.button)])
            result["button"] = args.button
        elif args.mouse_action == "drag":
            validate_button(args.button)
            validate_coordinates(args.x1, args.y1)
            validate_coordinates(args.x2, args.y2)
            mouse_move(state, args.x1, args.y1)
            xdotool(state, ["mousedown", str(args.button)])
            try:
                steps = max(1, args.steps)
                for index in range(1, steps + 1):
                    x = round(args.x1 + (args.x2 - args.x1) * index / steps)
                    y = round(args.y1 + (args.y2 - args.y1) * index / steps)
                    mouse_move(state, x, y)
                    time.sleep(args.duration_ms / steps / 1000)
            finally:
                xdotool(state, ["mouseup", str(args.button)], check=False)
            result.update(
                {
                    "from": [args.x1, args.y1],
                    "to": [args.x2, args.y2],
                    "button": args.button,
                    "duration_ms": args.duration_ms,
                }
            )
    json_print(result)
    return 0


def temporary_capture_path(session_dir: Path) -> Path:
    return session_dir / "runtime" / f"wait-{os.getpid()}-{uuid.uuid4().hex}.png"


def command_wait(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    if args.seconds is not None:
        require_running(session_dir)
        deadline = time.monotonic() + args.seconds
        while time.monotonic() < deadline:
            require_running(session_dir)
            remaining = deadline - time.monotonic()
            if remaining > 0:
                time.sleep(min(0.25, remaining))
        json_print({"session": args.session, "condition": "elapsed", "seconds": args.seconds})
        return 0

    if args.stable_for is None and args.changed_from is None:
        state = require_running(session_dir)
        json_print({"session": args.session, "condition": "window-ready", "window_id": state["window_id"]})
        return 0

    baseline_hash: str | None = None
    if args.changed_from is not None:
        baseline = Path(args.changed_from).expanduser().resolve()
        if not baseline.is_file():
            raise HarnessError(f"comparison screenshot does not exist: {baseline}")
        raw = run(["convert", baseline, "-alpha", "off", "-depth", "8", "rgb:-"], text=False).stdout
        baseline_hash = hashlib.sha256(raw).hexdigest()

    deadline = time.monotonic() + args.timeout
    stable_since: float | None = None
    previous_hash: str | None = None
    while time.monotonic() < deadline:
        state = require_running(session_dir)
        temporary = temporary_capture_path(session_dir)
        try:
            captured = capture_window(state, temporary)
        finally:
            temporary.unlink(missing_ok=True)
        current_hash = captured["pixel_sha256"]
        if baseline_hash is not None and current_hash != baseline_hash:
            json_print({"session": args.session, "condition": "screen-changed", "pixel_sha256": current_hash})
            return 0
        if args.stable_for is not None:
            if current_hash == previous_hash:
                stable_since = stable_since or time.monotonic()
                if time.monotonic() - stable_since >= args.stable_for:
                    json_print(
                        {
                            "session": args.session,
                            "condition": "screen-stable",
                            "stable_for": args.stable_for,
                            "pixel_sha256": current_hash,
                            "warning": "screen stability is not proof that Lisp boot completed",
                        }
                    )
                    return 0
            else:
                stable_since = None
            previous_hash = current_hash
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(args.interval, remaining))
    raise HarnessError(f"wait condition was not met within {args.timeout:g}s")


def wait_record_gone(record: dict[str, Any], recorded_boot_id: str, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not process_matches(record, recorded_boot_id):
            return True
        time.sleep(0.1)
    return not process_matches(record, recorded_boot_id)


def safe_signal(record: dict[str, Any] | None, recorded_boot_id: str, signum: int) -> bool:
    if not process_matches(record, recorded_boot_id):
        return False
    try:
        os.kill(int(record["pid"]), signum)
    except ProcessLookupError:
        return False
    except OSError as exc:
        raise HarnessError(f"cannot signal recorded process {record['pid']}: {exc}") from exc
    return True


def command_stop(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    discard = False
    with locked(state_root / ".lifecycle.lock", create_parent=False):
        require_session_directory(session_dir)
        with locked(session_dir / "control.lock", create_parent=False):
            state = read_state(session_dir)
            recorded_boot_id = state.get("boot_id")
            supervisor = state.get("supervisor")
            forced_stop = False
            if safe_signal(supervisor, recorded_boot_id, signal.SIGTERM):
                if not wait_record_gone(supervisor, recorded_boot_id, args.timeout):
                    raise HarnessError("supervisor did not stop within the requested timeout")
            else:
                usim = state.get("usim")
                if safe_signal(usim, recorded_boot_id, signal.SIGTERM):
                    if not wait_record_gone(usim, recorded_boot_id, min(args.timeout, 25)):
                        forced_stop = safe_signal(usim, recorded_boot_id, signal.SIGKILL) or forced_stop
                        if not wait_record_gone(usim, recorded_boot_id, 5):
                            raise HarnessError("orphaned usim remained live after SIGKILL")
                xvfb = state.get("xvfb")
                if safe_signal(xvfb, recorded_boot_id, signal.SIGTERM):
                    if not wait_record_gone(xvfb, recorded_boot_id, 5):
                        forced_stop = safe_signal(xvfb, recorded_boot_id, signal.SIGKILL) or forced_stop
                        if not wait_record_gone(xvfb, recorded_boot_id, 5):
                            raise HarnessError("orphaned Xvfb remained live after SIGKILL")
                update_state(
                    session_dir,
                    {
                        "status": "forced-stopped" if forced_stop else "stopped",
                        "forced_stop": forced_stop,
                        "state_may_be_incomplete": forced_stop,
                        "stopped_at": now_iso(),
                    },
                )
            final = read_state(session_dir)
            discard = args.discard
        if discard:
            require_session_directory(session_dir)
            remove_tree(session_dir, state_root)
    if discard:
        json_print({"session": args.session, "status": "discarded"})
    else:
        json_print(status_payload(final))
    return 0


def add_session_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--session", default=DEFAULT_SESSION, help=f"session name (default: {DEFAULT_SESSION})")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Operate a private MIT CADR session on an authenticated Xvfb display."
    )
    parser.add_argument("--state-root", help=argparse.SUPPRESS)
    public_commands = "{doctor,start,status,wait,key,type,mouse,screenshot,stop}"
    subparsers = parser.add_subparsers(dest="command", required=True, metavar=public_commands)

    doctor = subparsers.add_parser("doctor", help="check tools and prepared CADR artifacts")
    doctor.set_defaults(handler=command_doctor)

    start = subparsers.add_parser("start", help="start or resume a detached session")
    add_session_argument(start)
    start_mode = start.add_mutually_exclusive_group()
    start_mode.add_argument("--fresh", action="store_true", help="replace the private disk/source runtime and cold boot")
    start_mode.add_argument("--resume", action="store_true", help="attempt a warm boot from the last cleanly saved state")
    start.add_argument("--timeout", type=positive_float, default=60, help="seconds to wait for the usim window")
    start.set_defaults(handler=command_start)

    status = subparsers.add_parser("status", help="show recorded and live session state")
    add_session_argument(status)
    status.set_defaults(handler=command_status)

    wait = subparsers.add_parser("wait", help="wait for a live window, elapsed time, screen change, or stability")
    add_session_argument(wait)
    group = wait.add_mutually_exclusive_group()
    group.add_argument("--seconds", type=nonnegative_float)
    group.add_argument("--stable-for", type=nonnegative_float)
    group.add_argument("--changed-from")
    wait.add_argument("--timeout", type=positive_float, default=180)
    wait.add_argument("--interval", type=positive_float, default=1)
    wait.set_defaults(handler=command_wait)

    key = subparsers.add_parser("key", help="send keys through XTEST after focusing usim")
    add_session_argument(key)
    direction = key.add_mutually_exclusive_group()
    direction.add_argument("--down", action="store_true")
    direction.add_argument("--up", action="store_true")
    key.add_argument("--delay-ms", type=nonnegative_int, default=40)
    key.add_argument(
        "keys",
        nargs="+",
        help=(
            "X key names or aliases: system, network, status, terminal, help, "
            "clear-input, clear-screen, return, rubout, space, escape"
        ),
    )
    key.set_defaults(handler=command_key)

    type_parser = subparsers.add_parser("type", help="type text through XTEST")
    add_session_argument(type_parser)
    type_parser.add_argument("--delay-ms", type=nonnegative_int, default=40)
    type_parser.add_argument("--enter", action="store_true")
    type_parser.add_argument("text")
    type_parser.set_defaults(handler=command_type)

    mouse = subparsers.add_parser("mouse", help="move or use the three CADR mouse buttons")
    add_session_argument(mouse)
    mouse_actions = mouse.add_subparsers(dest="mouse_action", required=True)
    move = mouse_actions.add_parser("move")
    move.add_argument("x", type=int)
    move.add_argument("y", type=int)
    click = mouse_actions.add_parser("click")
    click.add_argument("x", type=int)
    click.add_argument("y", type=int)
    click.add_argument("--button", type=int, default=1)
    down = mouse_actions.add_parser("down")
    down.add_argument("button", type=int)
    up = mouse_actions.add_parser("up")
    up.add_argument("button", type=int)
    drag = mouse_actions.add_parser("drag")
    drag.add_argument("x1", type=int)
    drag.add_argument("y1", type=int)
    drag.add_argument("x2", type=int)
    drag.add_argument("y2", type=int)
    drag.add_argument("--button", type=int, default=1)
    drag.add_argument("--duration-ms", type=duration_milliseconds, default=500)
    drag.add_argument("--steps", type=positive_int, default=10)
    mouse.set_defaults(handler=command_mouse)

    screenshot = subparsers.add_parser("screenshot", help="capture the exact usim client window and provenance")
    add_session_argument(screenshot)
    screenshot.add_argument("--label", default="screen")
    screenshot.set_defaults(handler=command_screenshot)

    stop = subparsers.add_parser("stop", help="save emulator state, stop usim, then stop Xvfb")
    add_session_argument(stop)
    stop.add_argument("--timeout", type=positive_float, default=40)
    stop.add_argument("--discard", action="store_true", help="delete the private session after it stops")
    stop.set_defaults(handler=command_stop)

    supervise_parser = subparsers.add_parser("_supervise", help=argparse.SUPPRESS)
    add_session_argument(supervise_parser)
    supervise_parser.add_argument("--resume", action="store_true")
    subparsers._choices_actions = [  # Keep the detached implementation out of public help.
        action for action in subparsers._choices_actions if action.dest != "_supervise"
    ]
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        state_root = state_root_from(args.state_root)
        ensure_state_root(state_root)
    except (HarnessError, OSError) as exc:
        print(json.dumps({"error": str(exc), "command": args.command}, sort_keys=True), file=sys.stderr)
        return 1
    if args.command == "_supervise":
        session_dir = session_dir_for(state_root, args.session)
        try:
            require_session_directory(session_dir)
            return supervise(session_dir, args.resume)
        except Exception as exc:
            with contextlib.suppress(Exception):
                update_state(session_dir, {"status": "failed", "error": str(exc), "stopped_at": now_iso()})
            return 1
    try:
        return args.handler(args, state_root)
    except (HarnessError, OSError) as exc:
        print(json.dumps({"error": str(exc), "command": args.command}, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
