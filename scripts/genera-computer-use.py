#!/usr/bin/env python3
"""Drive a private Open Genera session through Xvfb and XTEST.

Licensed world data and every derivative stay below the ignored session root.
The VLM boots in a disposable Bubblewrap filesystem, process, and network
sandbox with no external route or host file service.  Host-side VLM process
cleanup is deliberately distinct from an in-guest Save World: ordinary
sessions do not checkpoint Lisp state.
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
import stat
import subprocess
import sys
import tempfile
import time
import uuid
from typing import Any, Iterator, Sequence


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_STATE_ROOT = ROOT / "build" / "genera-computer-use"
DEFAULT_SESSION = "default"
SESSION_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}\Z")
LABEL_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{0,47}\Z")
STATE_SCHEMA = 1
XVFB_WIDTH = 1440
XVFB_HEIGHT = 1100
MAIN_GEOMETRY = "1200x900"
COLD_LOAD_GEOMETRY = "1024x768"
DISPLAY_RANGE = range(200, 250)
STATE_ROOT_MARKER = ".genera-computer-use-root"
SESSION_MARKER = ".genera-computer-use-session"
RUNTIME_MARKER = ".genera-computer-use-runtime"
STATE_ROOT_MARKER_CONTENT = "Open Genera computer-use state root v1\n"
SESSION_MARKER_CONTENT = "Open Genera computer-use session v1\n"
RUNTIME_MARKER_CONTENT = "Open Genera computer-use private runtime v1\n"
SANDBOX_HOSTS_CONTENT = "127.0.0.1 localhost\n10.0.0.1 genera-museum\n"
SANDBOX_NSSWITCH_CONTENT = "hosts: files\n"
RUNTIME_PREPARE_LOCK = ROOT / "build" / ".genera-computer-use-runtime.lock"
VLM_RUN_LOCK = ROOT / "build" / ".genera-computer-use-vlm.lock"
DISPLAY_ALLOCATE_LOCK = ROOT / "build" / ".cadr-computer-use-display.lock"
NETWORK_SPEC = "tun0:10.0.0.2;mask=255.255.255.0;gateway=10.0.0.1"
RFC868_UNIX_EPOCH_OFFSET = 2_208_988_800
EXPECTED_TIME_REQUEST_SHA256 = (
    "99436b7cb2393ba0d8b1691a9393b2bfdd7a33d7fc976461e721bb074542710c"
)
RELAY_QUERY_EXTENSION_NAME = (
    "GENERA-COMPUTER-USE-LEGACY-MODIFIER-MAP-SUPPRESSED-" + ("X" * 140)
)[:140]
assert len(RELAY_QUERY_EXTENSION_NAME.encode("ascii")) == 140
RELAY_GRAB_MARKER = (
    b"computer-use transformed the exact guest X modifier setup: "
    b"GrabServer -> NoOperation"
)
RELAY_MODIFIER_MARKER = (
    b"computer-use transformed the exact guest X modifier setup: "
    b"SetModifierMapping -> absent QueryExtension"
)
RELAY_MISMATCH_MARKER = (
    b"computer-use refused a mismatched continuation of an exact guest X "
    b"compatibility write"
)
SANDBOX_RUNTIME = Path("/session/runtime")
SANDBOX_HELPERS = Path("/museum/scripts")
EXPECTED_BASE_SHA256 = {
    "world": "a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672",
    "debugger": "2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a",
    "vlm": "9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7",
}

KEY_ALIASES = {
    "select": "F1",
    "rubout": "Delete",
    "abort": "KP_Subtract",
    "super": "Control_R",
    "return": "Return",
    "enter": "Return",
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
    command = [os.fspath(item) for item in argv]
    try:
        return subprocess.run(
            command,
            env=env,
            cwd=cwd,
            check=check,
            capture_output=True,
            text=text,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise HarnessError(f"required command not found: {command[0]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise HarnessError(
            f"command timed out after {timeout:g}s: {' '.join(command)}"
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else exc.stderr
        stdout = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else exc.stdout
        detail = (stderr or stdout or "").strip()
        raise HarnessError(
            f"command failed ({exc.returncode}): {' '.join(command)}\n{detail}"
        ) from exc
    except OSError as exc:
        raise HarnessError(f"cannot run command: {' '.join(command)}: {exc}") from exc


def finite_float(value: str, *, positive: bool, maximum: float = 86_400) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"expected a finite number, got {value!r}") from exc
    invalid = not math.isfinite(number) or (number <= 0 if positive else number < 0)
    if invalid:
        qualifier = "positive" if positive else "non-negative"
        raise argparse.ArgumentTypeError(f"expected a finite {qualifier} number, got {value!r}")
    if number > maximum:
        raise argparse.ArgumentTypeError(
            f"expected a number no greater than {maximum:g}, got {value!r}"
        )
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
        raise argparse.ArgumentTypeError(
            f"expected an integer no greater than {maximum}, got {value!r}"
        )
    return number


def positive_int(value: str) -> int:
    return bounded_int(value, positive=True, maximum=10_000)


def nonnegative_int(value: str) -> int:
    return bounded_int(value, positive=False, maximum=60_000)


def duration_milliseconds(value: str) -> int:
    return bounded_int(value, positive=False, maximum=600_000)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags)
    try:
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode):
            raise OSError(f"not a regular file: {path}")
        source = os.fdopen(descriptor, "rb")
        descriptor = -1
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    with source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def boot_id() -> str:
    try:
        return Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip()
    except OSError as exc:
        raise HarnessError("the harness requires Linux /proc process identity data") from exc


def proc_start_ticks(pid: int) -> int | None:
    try:
        stat_text = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
    except OSError:
        return None
    close = stat_text.rfind(")")
    if close < 0:
        return None
    fields = stat_text[close + 2 :].split()
    try:
        return int(fields[19])
    except (IndexError, ValueError):
        return None


def proc_cmdline_elements(pid: int) -> list[str]:
    try:
        raw = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return []
    return [part.decode(errors="replace") for part in raw.rstrip(b"\0").split(b"\0") if part]


def proc_cmdline(pid: int) -> str:
    return " ".join(proc_cmdline_elements(pid))


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


def child_pids(pid: int) -> list[int]:
    try:
        text = Path(f"/proc/{pid}/task/{pid}/children").read_text(encoding="ascii")
    except OSError:
        return []
    result: list[int] = []
    for value in text.split():
        with contextlib.suppress(ValueError):
            result.append(int(value))
    return result


def descendant_pids(root_pid: int) -> list[int]:
    descendants: list[int] = []
    pending = [root_pid]
    seen = {root_pid}
    while pending:
        parent = pending.pop(0)
        for child in child_pids(parent):
            if child in seen:
                continue
            seen.add(child)
            descendants.append(child)
            pending.append(child)
    return descendants


def find_descendant_with_argument(root_pid: int, exact_argument: str) -> int | None:
    for pid in descendant_pids(root_pid):
        if exact_argument in proc_cmdline_elements(pid):
            return pid
    return None


def find_vlm_descendant(root_pid: int, exact_argument: str) -> int | None:
    """Find the loader-launched VLM, excluding Bubblewrap's copied argv."""
    for pid in descendant_pids(root_pid):
        arguments = proc_cmdline_elements(pid)
        if (
            exact_argument in arguments
            and "--setenv" not in arguments
            and "-network" in arguments
            and arguments
            and not Path(arguments[0]).name.startswith("bwrap")
        ):
            return pid
    return None


def validate_session_name(name: str) -> str:
    if not SESSION_RE.fullmatch(name) or name in {".", ".."}:
        raise HarnessError("session names must be 1-64 portable filename characters")
    return name


def validate_label(label: str) -> str:
    if not LABEL_RE.fullmatch(label) or label in {".", ".."}:
        raise HarnessError("screenshot labels must be 1-48 portable filename characters")
    return label


def state_root_from(value: str | None) -> Path:
    root = Path(value or os.environ.get("GENERA_COMPUTER_USE_ROOT", DEFAULT_STATE_ROOT))
    resolved = root.expanduser().resolve()
    if resolved != DEFAULT_STATE_ROOT.resolve():
        raise HarnessError(
            "Genera computer-use state is restricted to the repository's ignored "
            f"state root: {DEFAULT_STATE_ROOT}"
        )
    return resolved


def archive_path_from(value: str | None) -> Path:
    default = os.environ.get("OPENGENERA_ARCHIVE") or str(Path.home() / "opengenera2.tar.bz2")
    return Path(value or default).expanduser().resolve()


def refuse_symlink(path: Path, description: str) -> None:
    if path.is_symlink():
        raise HarnessError(f"refusing symbolic link for {description}: {path}")


def marker_contents(path: Path, description: str) -> str:
    refuse_symlink(path, description)
    if not path.is_file():
        raise HarnessError(f"missing {description}: {path}")
    try:
        return path.read_text(encoding="ascii")
    except OSError as exc:
        raise HarnessError(f"cannot read {description}: {path}") from exc


def ensure_state_root(path: Path) -> None:
    critical = {Path("/").resolve(), Path.home().resolve(), ROOT.resolve()}
    if path in critical:
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
        if marker_contents(marker, "harness state-root marker") != STATE_ROOT_MARKER_CONTENT:
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
    if marker_contents(marker, "harness session marker") != SESSION_MARKER_CONTENT:
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
        yield
    finally:
        lock_file.close()


def try_run_lock(path: Path) -> Any:
    path.parent.mkdir(parents=True, exist_ok=True)
    refuse_symlink(path, "VLM run lock")
    lock_file = path.open("a+b")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as exc:
        lock_file.close()
        raise HarnessError("another Genera computer-use VLM is already running") from exc
    return lock_file


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2, sort_keys=True)
        output.write("\n")
        output.flush()
        os.fsync(output.fileno())
    temporary.chmod(0o600)
    os.replace(temporary, path)


def atomic_write_text(path: Path, value: str, *, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    descriptor = os.open(temporary, flags, mode)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            output.write(value)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_write_bytes(path: Path, value: bytes, *, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    refuse_symlink(path, "binary output")
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(temporary, flags, mode)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(value)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def open_private_append_log(path: Path) -> Any:
    refuse_symlink(path, "session log")
    flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o600)
    except OSError as exc:
        raise HarnessError(f"cannot open private session log: {path}") from exc
    os.fchmod(descriptor, 0o600)
    return os.fdopen(descriptor, "ab", buffering=0)


def state_path(session_dir: Path) -> Path:
    return session_dir / "run.json"


def generation_state_path(session_dir: Path, generation: int) -> Path:
    if generation < 1:
        raise HarnessError("session generations must be positive integers")
    return session_dir / "runs" / f"generation-{generation:04d}.json"


def ensure_private_subdirectory(path: Path, description: str) -> None:
    refuse_symlink(path, description)
    if path.exists() and not path.is_dir():
        raise HarnessError(f"{description} is not a directory: {path}")
    path.mkdir(mode=0o700, exist_ok=True)
    path.chmod(0o700)


def write_state_files(session_dir: Path, state: dict[str, Any]) -> None:
    atomic_write_json(state_path(session_dir), state)
    try:
        generation = int(state["generation"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HarnessError("session state has no valid generation") from exc
    history = session_dir / "runs"
    ensure_private_subdirectory(history, "generation-state directory")
    atomic_write_json(generation_state_path(session_dir, generation), state)


def replace_state(session_dir: Path, state: dict[str, Any]) -> None:
    with locked(session_dir / "state.lock"):
        write_state_files(session_dir, state)


def preserve_previous_generation(
    session_dir: Path, previous: dict[str, Any]
) -> dict[str, Any]:
    if not previous:
        return previous
    try:
        generation = int(previous["generation"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HarnessError("prior session state has no valid generation") from exc

    preserved = dict(previous)
    legacy_actions = session_dir / "actions.json"
    if legacy_actions.is_file():
        actions_directory = session_dir / "actions"
        ensure_private_subdirectory(actions_directory, "action-log directory")
        destination = (
            actions_directory / f"legacy-through-generation-{generation:04d}.json"
        )
        if destination.exists():
            if sha256_file(destination) != sha256_file(legacy_actions):
                raise HarnessError(
                    f"legacy action-log preservation conflict: {destination}"
                )
        else:
            copy_reflink(legacy_actions, destination)
            destination.chmod(0o600)
        preserved["legacy_action_log"] = {
            "basename": destination.name,
            "bytes": destination.stat().st_size,
            "sha256": sha256_file(destination),
        }

    history = session_dir / "runs"
    ensure_private_subdirectory(history, "generation-state directory")
    destination = generation_state_path(session_dir, generation)
    if destination.is_file():
        try:
            recorded = json.loads(destination.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise HarnessError(f"cannot read preserved generation state: {destination}") from exc
        if recorded != preserved:
            raise HarnessError(f"preserved generation state conflicts with {destination}")
    else:
        atomic_write_json(destination, preserved)
    return preserved


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
        write_state_files(session_dir, state)
        return state


def live_processes(state: dict[str, Any]) -> dict[str, bool]:
    recorded_boot_id = state.get("boot_id")
    return {
        name: process_matches(state.get(name), recorded_boot_id)
        for name in ("supervisor", "xvfb", "launcher", "vlm")
    }


def command_paths() -> dict[str, str | None]:
    return {
        command: shutil.which(command)
        for command in (
            "Xvfb",
            "xauth",
            "xdpyinfo",
            "xdotool",
            "xmodmap",
            "import",
            "identify",
            "convert",
            "bwrap",
            "ip",
            "gcc",
            "cp",
            "guix",
            "python3",
            "bash",
            "ldd",
            "awk",
        )
    }


def toolchain_provenance() -> dict[str, Any]:
    commands = command_paths()
    resolved = {name: str(Path(path).resolve()) if path else None for name, path in commands.items()}
    channels: Any = None
    guix_error: str | None = None
    if commands.get("guix"):
        result = run([commands["guix"], "describe", "--format=json"], check=False, timeout=30)
        if result.returncode == 0:
            try:
                channels = json.loads(result.stdout)
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
        "guix_channels": channels,
        "guix_error": guix_error,
        "commands": resolved,
    }


def base_paths() -> dict[str, Path]:
    runtime = ROOT / ".lm-home" / "opengenera" / "runtime"
    return {
        "world": runtime / "Genera-8-5.vlod",
        "debugger": runtime / "VLM_debugger",
        "vlm": runtime / "genera",
        "ifconfig_preload_source": ROOT
        / "scripts"
        / "opengenera-computer-use-ifconfig-bypass.c",
        "x_compatibility_preload_source": ROOT
        / "scripts"
        / "opengenera-computer-use-x-compat.c",
        "time_server_source": ROOT
        / "scripts"
        / "opengenera-computer-use-time-server.py",
    }


def harness_source_paths() -> dict[str, Path]:
    return {
        "python_harness": ROOT / "scripts" / "genera-computer-use.py",
        "guix_entrypoint": ROOT / "scripts" / "genera-computer-use.sh",
        "namespace_helper": ROOT / "scripts" / "inside-genera-computer-use-netns.sh",
        "vlm_helper": ROOT / "scripts" / "inside-genera-computer-use-vlm.sh",
        "ifconfig_preload_source": ROOT
        / "scripts"
        / "opengenera-computer-use-ifconfig-bypass.c",
        "x_compatibility_preload_source": ROOT
        / "scripts"
        / "opengenera-computer-use-x-compat.c",
        "time_server_source": ROOT
        / "scripts"
        / "opengenera-computer-use-time-server.py",
    }


def ensure_runtime_ready(archive: Path) -> tuple[dict[str, Path], str]:
    if not archive.is_file():
        raise HarnessError(f"Open Genera archive not found: {archive}")
    archive_stat_before = archive.stat()
    archive_sha256 = sha256_file(archive)
    launcher = ROOT / "scripts" / "opengenera-guix-container.sh"
    run(
        [launcher, "--mode", "run", "--prepare-only", "--archive", archive],
        cwd=ROOT,
        timeout=1800,
    )
    archive_stat_after = archive.stat()
    if (
        archive_stat_after.st_size != archive_stat_before.st_size
        or archive_stat_after.st_mtime_ns != archive_stat_before.st_mtime_ns
        or sha256_file(archive) != archive_sha256
    ):
        raise HarnessError("the Open Genera archive changed while staging inputs")
    paths = base_paths()
    missing = [name for name, path in paths.items() if not path.is_file()]
    if missing:
        raise HarnessError(
            f"Open Genera preparation did not create required artifacts: {', '.join(missing)}"
        )
    if not os.access(paths["vlm"], os.X_OK):
        raise HarnessError(f"prepared VLM is not executable: {paths['vlm']}")
    actual = {
        name: sha256_file(paths[name]) for name in ("world", "debugger", "vlm")
    }
    if actual != EXPECTED_BASE_SHA256:
        mismatches = [
            name
            for name in ("world", "debugger", "vlm")
            if actual[name] != EXPECTED_BASE_SHA256[name]
        ]
        raise HarnessError(
            "prepared Open Genera artifacts do not match the museum's verified "
            f"Genera 8.5 set: {', '.join(mismatches)}"
        )
    return paths, archive_sha256


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


def build_private_preload(source: Path, destination: Path) -> None:
    refuse_symlink(destination, "private compatibility preload")
    run(
        [
            "gcc",
            "-std=c11",
            "-Wall",
            "-Wextra",
            "-Werror",
            "-shared",
            "-fPIC",
            "-O2",
            "-pthread",
            "-ldl",
            "-o",
            destination,
            source,
        ],
        timeout=120,
    )
    destination.chmod(0o700)


def refresh_private_file(source: Path, destination: Path, mode: int) -> None:
    refuse_symlink(destination, "private runtime file")
    temporary = destination.with_name(
        f".{destination.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    )
    try:
        copy_reflink(source, temporary)
        temporary.chmod(mode)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def render_vlm_config(runtime: Path = SANDBOX_RUNTIME) -> str:
    return f"""genera.network: {NETWORK_SPEC}
genera.virtualMemory: 2048
genera.enableIDS: yes
genera.world: {runtime / 'Genera-8-5.vlod'}
genera.debugger: {runtime / 'VLM_debugger'}
genera.worldSearchPath: {runtime}
genera.coldLoad.geometry: {COLD_LOAD_GEOMETRY}
"""


def private_artifact_paths(runtime: Path) -> dict[str, Path]:
    return {
        "world": runtime / "Genera-8-5.vlod",
        "debugger": runtime / "VLM_debugger",
        "vlm": runtime / "genera",
        "ifconfig_preload": runtime / "ifconfig-bypass.so",
        "x_compatibility_preload": runtime / "x-compat.so",
        "time_server": runtime / "rfc868-time-server.py",
        "sandbox_hosts": runtime / "sandbox-hosts",
        "sandbox_nsswitch": runtime / "sandbox-nsswitch.conf",
        "config": runtime / ".VLM",
    }


def action_log_path(session_dir: Path, generation: int) -> Path:
    if generation < 1:
        raise HarnessError("action-log generations must be positive integers")
    return session_dir / "actions" / f"generation-{generation:04d}.json"


def prepare_session(
    session_dir: Path,
    base: dict[str, Path],
    archive: Path,
    archive_sha256: str,
    *,
    fresh: bool,
) -> dict[str, Any]:
    previous = read_state(session_dir, required=False)
    if previous:
        previous = preserve_previous_generation(session_dir, previous)
        replace_state(session_dir, previous)
    runtime = session_dir / "runtime"
    refuse_symlink(runtime, "private runtime")
    if runtime.exists() and not runtime.is_dir():
        raise HarnessError(f"private runtime is not a directory: {runtime}")
    if runtime.is_dir():
        marker = runtime / RUNTIME_MARKER
        if marker_contents(marker, "private-runtime marker") != RUNTIME_MARKER_CONTENT:
            raise HarnessError(f"unrecognized private-runtime marker: {marker}")

    base_hashes_before = {
        name: sha256_file(base[name]) for name in ("world", "debugger", "vlm")
    }
    if fresh or not runtime.is_dir():
        for stale in session_dir.glob(".runtime-*.tmp"):
            remove_tree(stale, session_dir)
        staged = session_dir / f".runtime-{os.getpid()}-{uuid.uuid4().hex}.tmp"
        staged.mkdir(mode=0o700)
        try:
            destinations = private_artifact_paths(staged)
            copy_reflink(base["world"], destinations["world"])
            copy_reflink(base["debugger"], destinations["debugger"])
            copy_reflink(base["vlm"], destinations["vlm"])
            destinations["vlm"].chmod(0o700)
            build_private_preload(
                base["ifconfig_preload_source"], destinations["ifconfig_preload"]
            )
            build_private_preload(
                base["x_compatibility_preload_source"],
                destinations["x_compatibility_preload"],
            )
            copy_reflink(base["time_server_source"], destinations["time_server"])
            destinations["time_server"].chmod(0o700)
            atomic_write_text(destinations["sandbox_hosts"], SANDBOX_HOSTS_CONTENT)
            atomic_write_text(
                destinations["sandbox_nsswitch"], SANDBOX_NSSWITCH_CONTENT
            )
            copied = {
                name: sha256_file(destinations[name]) for name in ("world", "debugger", "vlm")
            }
            if copied != base_hashes_before:
                raise HarnessError("private Open Genera copies do not match the staged inputs")
            base_after_copy = {
                name: sha256_file(base[name]) for name in ("world", "debugger", "vlm")
            }
            if base_after_copy != base_hashes_before:
                raise HarnessError("a staged Open Genera input changed while it was being copied")
            marker = staged / RUNTIME_MARKER
            marker.write_text(RUNTIME_MARKER_CONTENT, encoding="ascii", newline="\n")
            marker.chmod(0o600)
            remove_tree(runtime, session_dir)
            os.replace(staged, runtime)
        finally:
            remove_tree(staged, session_dir)

    marker = runtime / RUNTIME_MARKER
    if marker_contents(marker, "private-runtime marker") != RUNTIME_MARKER_CONTENT:
        raise HarnessError(f"unrecognized private-runtime marker: {marker}")
    artifacts = private_artifact_paths(runtime)
    for name, path in artifacts.items():
        refuse_symlink(path, f"private {name}")
        if name != "config" and not path.is_file():
            raise HarnessError(f"private runtime is missing {name}: {path}; use --fresh")

    build_private_preload(
        base["ifconfig_preload_source"], artifacts["ifconfig_preload"]
    )
    build_private_preload(
        base["x_compatibility_preload_source"],
        artifacts["x_compatibility_preload"],
    )
    refresh_private_file(
        base["time_server_source"], artifacts["time_server"], 0o700
    )

    atomic_write_text(artifacts["sandbox_hosts"], SANDBOX_HOSTS_CONTENT)
    atomic_write_text(artifacts["sandbox_nsswitch"], SANDBOX_NSSWITCH_CONTENT)
    atomic_write_text(artifacts["config"], render_vlm_config())
    try:
        generation = int(previous.get("generation", 0)) + 1
    except (TypeError, ValueError) as exc:
        raise HarnessError("invalid prior session generation") from exc

    screenshots = session_dir / "screenshots"
    refuse_symlink(screenshots, "screenshot directory")
    if screenshots.exists() and not screenshots.is_dir():
        raise HarnessError(f"screenshot path is not a directory: {screenshots}")
    screenshots.mkdir(mode=0o700, exist_ok=True)
    captures = session_dir / ".captures"
    ensure_private_subdirectory(captures, "host-only transient-capture directory")
    actions_directory = session_dir / "actions"
    ensure_private_subdirectory(actions_directory, "action-log directory")
    actions = action_log_path(session_dir, generation)
    refuse_symlink(actions, "action log")
    atomic_write_json(
        actions,
        {"schema": 1, "session": session_dir.name, "generation": generation, "actions": []},
    )
    private_home = runtime / "home"
    ensure_private_subdirectory(private_home, "private HOME directory")
    time_ready = runtime / f"rfc868-generation-{generation:04d}.ready.json"
    time_evidence = runtime / f"rfc868-generation-{generation:04d}.json"
    time_complete = runtime / f"rfc868-generation-{generation:04d}.complete.json"
    time_failure = runtime / f"rfc868-generation-{generation:04d}.failure.json"
    for path, description in (
        (time_ready, "RFC 868 ready record"),
        (time_evidence, "RFC 868 evidence record"),
        (time_complete, "RFC 868 completion record"),
        (time_failure, "RFC 868 failure record"),
    ):
        refuse_symlink(path, description)
        path.unlink(missing_ok=True)
    archive_stat = archive.stat()
    if sha256_file(archive) != archive_sha256:
        raise HarnessError("the Open Genera archive changed during private preparation")
    private_hashes = {name: sha256_file(path) for name, path in artifacts.items()}
    metadata = {
        "schema": STATE_SCHEMA,
        "session": session_dir.name,
        "session_dir": str(session_dir),
        "status": "prepared",
        "generation": generation,
        "action_log": {
            "path": str(actions),
            "generation": generation,
        },
        "time_service": {
            "mode": "one-shot-rfc868-ethernet-responder",
            "interface": "tun0",
            "host_ip": "10.0.0.1",
            "host_mac": "02:00:00:00:00:25",
            "guest_mac": "40:00:00:00:00:00",
            "port": 37,
            "reply_attempts": 1,
            "delivery": "af-packet-raw-ethernet",
            "udp_guard_bind": "0.0.0.0",
            "vlm_tap_io_interposed": False,
            "expected_request_frame_sha256": EXPECTED_TIME_REQUEST_SHA256,
            "ready_path": str(time_ready),
            "evidence_path": str(time_evidence),
            "completion_path": str(time_complete),
            "failure_path": str(time_failure),
            "sandbox_ready_path": str(SANDBOX_RUNTIME / time_ready.name),
            "sandbox_evidence_path": str(SANDBOX_RUNTIME / time_evidence.name),
            "sandbox_completion_path": str(SANDBOX_RUNTIME / time_complete.name),
            "sandbox_failure_path": str(SANDBOX_RUNTIME / time_failure.name),
            "source_sha256_at_start": sha256_file(base["time_server_source"]),
            "private_sha256_at_start": private_hashes["time_server"],
        },
        "boot_id": boot_id(),
        "prepared_at": now_iso(),
        "archive": {
            "path": str(archive),
            "basename": archive.name,
            "bytes": archive_stat.st_size,
            "sha256": archive_sha256,
        },
        "base_artifacts": {
            name: {
                "path": str(base[name]),
                "bytes": base[name].stat().st_size,
                "sha256_at_start": base_hashes_before[name],
            }
            for name in ("world", "debugger", "vlm")
        },
        "ifconfig_preload_source": {
            "path": str(base["ifconfig_preload_source"]),
            "sha256_at_start": sha256_file(base["ifconfig_preload_source"]),
        },
        "x_compatibility_preload_source": {
            "path": str(base["x_compatibility_preload_source"]),
            "sha256_at_start": sha256_file(
                base["x_compatibility_preload_source"]
            ),
        },
        "time_server_source": {
            "path": str(base["time_server_source"]),
            "sha256_at_start": sha256_file(base["time_server_source"]),
        },
        "harness_sources": {
            name: {
                "path": str(path),
                "bytes": path.stat().st_size,
                "sha256_at_start": sha256_file(path),
            }
            for name, path in harness_source_paths().items()
        },
        "private_artifacts": {
            name: {
                "path": str(path),
                "bytes": path.stat().st_size,
                "sha256_at_start": private_hashes[name],
            }
            for name, path in artifacts.items()
        },
        "private_world_matches_base_at_start": private_hashes["world"] == base_hashes_before["world"],
        "network_isolation": {
            "mode": "bubblewrap-unprivileged-user-and-network-namespace",
            "host_side": "10.0.0.1/24",
            "guest_side": "10.0.0.2/24",
            "device": "tun0",
            "interfaces": [
                {
                    "name": "tun0",
                    "kind": "tap",
                    "address": "10.0.0.1/24",
                },
                {
                    "name": "eth0",
                    "kind": "dummy",
                    "address": "192.0.2.1/24",
                    "mac": "02:00:00:00:00:01",
                },
            ],
            "external_route": False,
            "default_route": False,
            "host_file_service": False,
        },
        "native_process_isolation": {
            "mode": "bubblewrap-filesystem-process-and-network-sandbox",
            "environment": "minimal-scrubbed",
            "mount_namespace": True,
            "pid_namespace": True,
            "ipc_namespace": True,
            "uts_namespace": True,
            "host_root_visible": False,
            "gnu_store_read_only": True,
            "private_runtime_read_write": True,
            "private_session_metadata_visible": False,
            "helper_scripts_read_only": True,
            "etc": "generated-hosts-and-nsswitch-only",
            "x_socket": "exact-private-Xvfb-socket-read-only",
            "x_mit_shm_enabled": False,
            "unrelated_runtime_sockets_hidden": True,
            "network_admin_capability_scope": "throwaway-network-namespace-only",
            "raw_packet_capability_scope": "throwaway-network-namespace-only",
            "low_port_bind_capability_scope": "throwaway-network-namespace-only",
            "kernel_security_boundary_claimed": False,
        },
        "world_persistence": (
            "no-process-snapshot;private-world-file-reused-unless-fresh"
        ),
        "save_world_invoked_by_harness": False,
        "save_world_performed": None,
        "process_checkpoint_created_by_harness": False,
        "guest_checkpoint_created": None,
        "x_protocol_compatibility": {
            "mode": "typed-xlib-hooks-plus-exact-guest-x-relay-transform",
            "scope": "displays-returned-by-x-open-display",
            "state_lifetime": "per-display-xextdata",
            "event_conversion": "per-display-xesetwiretoevent",
            "zero_timestamp_event_types": [
                "KeyPress",
                "KeyRelease",
                "ButtonPress",
                "ButtonRelease",
                "MotionNotify",
                "EnterNotify",
                "LeaveNotify",
            ],
            "modifier_mapping": {
                "mode": (
                    "typed-local-success-plus-byte-exact-guest-relay-"
                    "query-extension-substitution"
                ),
                "max_keypermod": 18,
                "map_sha256": (
                    "a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466"
                ),
                "wire_request_sha256": (
                    "e17ca71a9780516bee282b09c5297660122fca7806a111dc00771748e850fc71"
                ),
                "xvfb_map_prepared_before_vlm": True,
                "typed_xlib_ack_configured": True,
                "guest_relay_transform_configured": True,
                "replacement_request": "QueryExtension",
                "replacement_extension_name_bytes": 140,
                "replacement_extension_name_sha256": hashlib.sha256(
                    RELAY_QUERY_EXTENSION_NAME.encode("ascii")
                ).hexdigest(),
                "replacement_extension_absence_required_before_vlm": True,
                "request_count_and_sequence_preserved": True,
                "client_byte_order": "little-endian-pinned-wire-framing",
            },
            "x_server_grab_transform_configured": True,
            "x_server_grab_mode": (
                "typed-local-noop-and-byte-exact-guest-relay-nooperation-for-"
                "the-pinned-vlm-legacy-modifier-setup"
            ),
            "x_ungrab_server_mode": (
                "matching-suppressed-grab-acknowledged-locally-with-an-atomic-"
                "flush-fallback-for-unmatched-tracked-ungrabs"
            ),
            "x_ungrab_server_fallback_flush_available": True,
            "libc_descriptor_io_interposed": True,
            "libc_descriptor_io_scope": (
                "write-only-on-live-wrapped-XOpenDisplay-descriptors-and-only-"
                "for-two-byte-exact-pinned-guest-request-shapes"
            ),
            "raw_relay_reads_interposed": False,
            "nonmatching_writes_delegated_byte_for_byte": True,
            "configuration_is_not_runtime_observation": True,
            "tap_io_modified": False,
            "world_or_ordinary_file_io_modified": False,
            "unrelated_socket_io_modified": False,
        },
        "toolchain_provenance": toolchain_provenance(),
        "xvfb_screen": {"width": XVFB_WIDTH, "height": XVFB_HEIGHT, "depth": 24},
        "requested_geometry": {
            "main": MAIN_GEOMETRY,
            "cold_load": COLD_LOAD_GEOMETRY,
        },
    }
    return metadata


def x_environment(state: dict[str, Any]) -> dict[str, str]:
    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(Path(state["session_dir"]) / "runtime" / "home"),
        "USER": "genera",
        "LOGNAME": "genera",
        "LANG": "C",
        "LC_ALL": "C",
        "TMPDIR": "/tmp",
        "DISPLAY": state["display"],
        "XAUTHORITY": state["xauthority"],
        "LIBGL_ALWAYS_SOFTWARE": "1",
    }


def xdotool(
    state: dict[str, Any],
    arguments: Sequence[str],
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return run(
        ["xdotool", *arguments],
        env=x_environment(state),
        check=check,
        timeout=10,
    )


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


def classify_window(title: str) -> str:
    lowered = title.lower()
    if "genera on " in lowered:
        return "main"
    if "cold load" in lowered:
        return "cold-load"
    if "vlm debugger" in lowered:
        return "debugger"
    if "genera" in lowered:
        return "genera-other"
    return "other"


def discover_windows(state: dict[str, Any]) -> dict[str, Any]:
    try:
        result = xdotool(
            state, ["search", "--onlyvisible", "--name", "."], check=False
        )
    except HarnessError as exc:
        return {"candidates": [], "selected": None, "error": str(exc)}
    candidates: list[dict[str, Any]] = []
    if result.returncode == 0:
        for raw in result.stdout.splitlines():
            try:
                window_id = int(raw.strip())
            except ValueError:
                continue
            try:
                geometry = geometry_for_window(state, window_id)
                title = window_title(state, window_id) if geometry else ""
            except HarnessError as exc:
                return {"candidates": [], "selected": None, "error": str(exc)}
            if not geometry:
                continue
            kind = classify_window(title)
            candidates.append(
                {
                    "window_id": window_id,
                    "title": title,
                    "kind": kind,
                    "geometry": geometry,
                    "area": geometry["width"] * geometry["height"],
                }
            )
    rank = {"main": 4, "cold-load": 3, "debugger": 2, "genera-other": 1, "other": 0}
    recognized = [item for item in candidates if item["kind"] != "other"]
    pool = recognized or candidates
    selected = max(pool, key=lambda item: (rank[item["kind"]], item["area"]), default=None)
    return {"candidates": candidates, "selected": selected, "error": None}


def prepare_x_modifier_map(state: dict[str, Any]) -> dict[str, Any]:
    expressions = ["clear mod2", "add mod2 = Left"]
    command = ["xmodmap"]
    for expression in expressions:
        command.extend(["-e", expression])
    run(command, env=x_environment(state), timeout=10)
    verification = run(["xmodmap", "-pm"], env=x_environment(state), timeout=10)
    mod2 = next(
        (line.strip() for line in verification.stdout.splitlines() if line.startswith("mod2")),
        "",
    )
    if "Left (0x71)" not in mod2 or "Num_Lock" in mod2:
        raise HarnessError(
            "Xvfb did not retain the VLM-compatible Mod2 mapping: "
            f"{mod2 or '<missing>'}"
        )
    return {
        "mode": "pre-vlm-core-modifier-map",
        "expressions": expressions,
        "verified_mod2": mod2,
        "verified_at": now_iso(),
        "reason": (
            "the inspected VLM requests keycode 0x71 (Left) in Mod2; "
            "the private Xvfb is prepared with that map before launch, while the "
            "X-compatibility preload confines legacy reply and timestamp handling "
            "to the VLM's identified live X connections"
        ),
    }


def start_xvfb(
    session_dir: Path,
) -> tuple[subprocess.Popen[bytes], str, Path, dict[str, Any], dict[str, Any]]:
    state = read_state(session_dir)
    xauthority = session_dir / "runtime" / "Xauthority"
    xlog_path = session_dir / f"xvfb-generation-{state['generation']}.log"
    xlog = open_private_append_log(xlog_path)
    start_cleanup_attempts: list[dict[str, Any]] = []

    def clean_failed_candidate(
        process: subprocess.Popen[bytes], number: int, reason: str
    ) -> None:
        returncode, forced = terminate_process(process, 3)
        start_cleanup_attempts.append(
            {
                "display": f":{number}",
                "reason": reason,
                "returncode": returncode,
                "forced": forced,
                "recorded_at": now_iso(),
            }
        )
        update_state(
            session_dir,
            {
                "xvfb_start_attempts": list(start_cleanup_attempts),
                "xvfb_start_last_returncode": returncode,
                "xvfb_start_cleanup_forced": any(
                    attempt["forced"] for attempt in start_cleanup_attempts
                ),
            },
        )

    with locked(DISPLAY_ALLOCATE_LOCK):
        for number in DISPLAY_RANGE:
            if Path(f"/tmp/.X11-unix/X{number}").exists() or Path(f"/tmp/.X{number}-lock").exists():
                continue
            xauthority.unlink(missing_ok=True)
            cookie = secrets.token_hex(16)
            run(["xauth", "-f", xauthority, "add", f":{number}", "MIT-MAGIC-COOKIE-1", cookie])
            run(
                [
                    "xauth",
                    "-f",
                    xauthority,
                    "add",
                    f"genera-museum/unix:{number}",
                    "MIT-MAGIC-COOKIE-1",
                    cookie,
                ]
            )
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
                    "-extension",
                    "MIT-SHM",
                    "-noreset",
                    "-auth",
                    str(xauthority),
                ],
                stdin=subprocess.DEVNULL,
                stdout=xlog,
                stderr=subprocess.STDOUT,
            )
            probe = {
                "display": f":{number}",
                "xauthority": str(xauthority),
                "session_dir": str(session_dir),
            }
            try:
                update_state(
                    session_dir,
                    {
                        "xvfb": process_record(process.pid),
                        "xvfb_start_candidate": f":{number}",
                    },
                )
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline and process.poll() is None:
                    if xdotool(probe, ["getdisplaygeometry"], check=False).returncode == 0:
                        extension_report = run(
                            ["xdpyinfo", "-queryExtensions"],
                            env=x_environment(probe),
                            timeout=10,
                        ).stdout
                        if re.search(r"(?:^|\n)\s*MIT-SHM\b", extension_report):
                            raise HarnessError(
                                "private Xvfb still advertises the disabled MIT-SHM extension"
                            )
                        if RELAY_QUERY_EXTENSION_NAME in extension_report:
                            raise HarnessError(
                                "private Xvfb unexpectedly advertises the reserved "
                                "compatibility QueryExtension name"
                            )
                        modifier_map = prepare_x_modifier_map(probe)
                        x_server_security = {
                            "mit_shm_enabled": False,
                            "mit_shm_launch_arguments": ["-extension", "MIT-SHM"],
                            "mit_shm_verified_absent": True,
                            "mit_shm_verified_at": now_iso(),
                            "verification_command": "xdpyinfo -queryExtensions",
                            "relay_query_extension": {
                                "name_bytes": 140,
                                "name_sha256": hashlib.sha256(
                                    RELAY_QUERY_EXTENSION_NAME.encode("ascii")
                                ).hexdigest(),
                                "verified_absent": True,
                                "verified_at": now_iso(),
                                "verification_command": "xdpyinfo -queryExtensions",
                            },
                        }
                        xlog.close()
                        return (
                            process,
                            f":{number}",
                            xauthority,
                            modifier_map,
                            x_server_security,
                        )
                    time.sleep(0.1)
            except Exception:
                try:
                    clean_failed_candidate(
                        process, number, "startup verification failed"
                    )
                finally:
                    xauthority.unlink(missing_ok=True)
                    xlog.close()
                raise
            try:
                clean_failed_candidate(process, number, "startup readiness timed out")
            finally:
                xauthority.unlink(missing_ok=True)
    xlog.close()
    raise HarnessError("could not allocate a private Xvfb display in :200 through :249")


def wait_for_own_record(session_dir: Path) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        state = read_state(session_dir, required=False)
        record = state.get("supervisor")
        if record and int(record.get("pid", -1)) == os.getpid():
            return state
        time.sleep(0.05)
    raise HarnessError("supervisor was not recorded by its parent")


def wait_process_gone(record: dict[str, Any], recorded_boot_id: str, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not process_matches(record, recorded_boot_id):
            return True
        time.sleep(0.1)
    return not process_matches(record, recorded_boot_id)


def safe_signal(
    record: dict[str, Any] | None,
    recorded_boot_id: str,
    signum: int,
) -> bool:
    if not process_matches(record, recorded_boot_id):
        return False
    try:
        os.kill(int(record["pid"]), signum)
    except ProcessLookupError:
        return False
    except OSError as exc:
        raise HarnessError(f"cannot signal recorded process {record['pid']}: {exc}") from exc
    return True


def safe_signal_group(
    record: dict[str, Any] | None,
    recorded_boot_id: str,
    signum: int,
) -> bool:
    if not process_matches(record, recorded_boot_id):
        return False
    try:
        os.killpg(int(record["pid"]), signum)
    except ProcessLookupError:
        return False
    except OSError as exc:
        raise HarnessError(
            f"cannot signal recorded process group {record['pid']}: {exc}"
        ) from exc
    return True


def terminate_process(process: subprocess.Popen[Any] | None, timeout: float) -> tuple[int | None, bool]:
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


def terminate_process_group(process: subprocess.Popen[Any] | None, timeout: float) -> bool:
    if process is None or process.poll() is not None:
        return False
    forced = False
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return False
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        with contextlib.suppress(ProcessLookupError):
            os.killpg(process.pid, signal.SIGKILL)
            forced = True
        process.wait(timeout=5)
    return forced


def wait_for_log_token(
    path: Path, token: bytes, timeout: float, *, start_offset: int = 0
) -> bool:
    overlap_start = max(0, start_offset - max(0, len(token) - 1))
    minimum_match_end = start_offset - overlap_start
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with path.open("rb") as log:
                log.seek(overlap_start)
                data = log.read()
                position = data.find(token)
                while position >= 0:
                    if position + len(token) > minimum_match_end:
                        return True
                    position = data.find(token, position + 1)
        except OSError:
            pass
        time.sleep(0.05)
    return False


def launcher_command(state: dict[str, Any]) -> tuple[list[str], dict[str, str], str]:
    private = state["private_artifacts"]
    runtime = Path(state["session_dir"]) / "runtime"
    expected_vlm_argument = str(SANDBOX_RUNTIME / Path(private["vlm"]["path"]).name)
    helper = ROOT / "scripts" / "inside-genera-computer-use-netns.sh"
    launcher = ROOT / "scripts" / "inside-genera-computer-use-vlm.sh"
    display_match = re.fullmatch(r":([0-9]+)(?:\.[0-9]+)?", state["display"])
    if display_match is None:
        raise HarnessError(f"invalid private X display: {state['display']!r}")
    x_socket = Path("/tmp/.X11-unix") / f"X{display_match.group(1)}"
    if not x_socket.is_socket():
        raise HarnessError(f"private Xvfb socket is unavailable: {x_socket}")

    bwrap = shutil.which("bwrap")
    bash = shutil.which("bash")
    if bwrap is None or bash is None:
        raise HarnessError("Bubblewrap and Bash are required to launch Open Genera")
    profile = Path(bash).parent.parent
    sandbox_path = f"{profile / 'bin'}:{profile / 'sbin'}"

    sandbox_private = {
        name: str(SANDBOX_RUNTIME / Path(record["path"]).name)
        for name, record in private.items()
    }
    inner_environment = {
        "PATH": sandbox_path,
        "HOME": str(SANDBOX_RUNTIME / "home"),
        "USER": "genera",
        "LOGNAME": "genera",
        "LANG": "C",
        "LC_ALL": "C",
        "TMPDIR": "/tmp",
        "DISPLAY": state["display"],
        "XAUTHORITY": str(SANDBOX_RUNTIME / "Xauthority"),
        "LIBGL_ALWAYS_SOFTWARE": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "GENERA_COMPUTER_USE_VLM": expected_vlm_argument,
        "GENERA_COMPUTER_USE_CWD": str(SANDBOX_RUNTIME),
        "GENERA_COMPUTER_USE_PRELOADS": ":".join(
            (
                sandbox_private["ifconfig_preload"],
                sandbox_private["x_compatibility_preload"],
            )
        ),
        "GENERA_COMPUTER_USE_TIME_SERVER": sandbox_private["time_server"],
        "GENERA_COMPUTER_USE_TIME_READY": state["time_service"][
            "sandbox_ready_path"
        ],
        "GENERA_COMPUTER_USE_TIME_EVIDENCE": state["time_service"][
            "sandbox_evidence_path"
        ],
        "GENERA_COMPUTER_USE_TIME_COMPLETE": state["time_service"][
            "sandbox_completion_path"
        ],
        "GENERA_COMPUTER_USE_TIME_FAILURE": state["time_service"][
            "sandbox_failure_path"
        ],
    }
    command = [
        bwrap,
        "--die-with-parent",
        "--unshare-user",
        "--uid",
        "0",
        "--gid",
        "0",
        "--cap-add",
        "CAP_NET_ADMIN",
        "--cap-add",
        "CAP_NET_RAW",
        "--cap-add",
        "CAP_NET_BIND_SERVICE",
        "--unshare-net",
        "--unshare-pid",
        "--unshare-ipc",
        "--unshare-uts",
        "--hostname",
        "genera-museum",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--dir",
        "/dev/net",
        "--dev-bind",
        "/dev/net/tun",
        "/dev/net/tun",
        "--tmpfs",
        "/run",
        "--dir",
        "/tmp",
        "--chmod",
        "1777",
        "/tmp",
        "--dir",
        "/tmp/.X11-unix",
        "--ro-bind",
        x_socket,
        x_socket,
        "--dir",
        "/gnu",
        "--ro-bind",
        "/gnu/store",
        "/gnu/store",
        "--dir",
        "/etc",
        "--ro-bind",
        Path(private["sandbox_hosts"]["path"]),
        "/etc/hosts",
        "--ro-bind",
        Path(private["sandbox_nsswitch"]["path"]),
        "/etc/nsswitch.conf",
        "--dir",
        "/session",
        "--bind",
        runtime,
        SANDBOX_RUNTIME,
        "--dir",
        "/museum",
        "--dir",
        SANDBOX_HELPERS,
        "--ro-bind",
        helper,
        SANDBOX_HELPERS / helper.name,
        "--ro-bind",
        launcher,
        SANDBOX_HELPERS / launcher.name,
        "--chdir",
        SANDBOX_RUNTIME,
        "--clearenv",
    ]
    for name, value in inner_environment.items():
        command.extend(["--setenv", name, value])
    command.extend(
        [
        "--",
        bash,
        SANDBOX_HELPERS / helper.name,
        bash,
        SANDBOX_HELPERS / launcher.name,
        "-network",
        NETWORK_SPEC,
        "-world",
        sandbox_private["world"],
        "-debugger",
        sandbox_private["debugger"],
        "-display",
        state["display"],
        "-coldloaddisplay",
        state["display"],
        "-geometry",
        MAIN_GEOMETRY,
        "-coldloadgeometry",
        COLD_LOAD_GEOMETRY,
        ]
    )
    return [os.fspath(item) for item in command], x_environment(state), expected_vlm_argument


def hashes_at_stop(state: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    base_world = Path(state["base_artifacts"]["world"]["path"])
    private_world = Path(state["private_artifacts"]["world"]["path"])
    refuse_symlink(base_world, "base world at stop")
    refuse_symlink(private_world, "private world at stop")
    if base_world.is_file():
        result["base_world_sha256_at_stop"] = sha256_file(base_world)
        result["base_world_unchanged"] = (
            result["base_world_sha256_at_stop"]
            == state["base_artifacts"]["world"]["sha256_at_start"]
        )
    if private_world.is_file():
        result["private_world_sha256_at_stop"] = sha256_file(private_world)
        result["private_world_changed_during_run"] = (
            result["private_world_sha256_at_stop"]
            != state["private_artifacts"]["world"]["sha256_at_start"]
        )
    try:
        generation = int(state["generation"])
        actions = action_log_path(Path(state["session_dir"]), generation)
        value = json.loads(actions.read_text(encoding="utf-8"))
        if value.get("generation") == generation and isinstance(
            value.get("actions"), list
        ):
            result["action_log_at_stop"] = {
                "generation": generation,
                "count": len(value["actions"]),
                "sha256": sha256_file(actions),
            }
    except (KeyError, TypeError, ValueError, OSError, json.JSONDecodeError):
        result["action_log_at_stop"] = None
    return result


def verify_execution_inputs(state: dict[str, Any]) -> dict[str, Any]:
    artifact_hashes: dict[str, str] = {}
    for name, record in state["private_artifacts"].items():
        path = Path(record["path"])
        refuse_symlink(path, f"private {name} execution input")
        if not path.is_file():
            raise HarnessError(f"private execution input is missing: {path}")
        digest = sha256_file(path)
        if digest != record["sha256_at_start"]:
            raise HarnessError(f"private execution input changed before launch: {name}")
        artifact_hashes[name] = digest

    source_hashes: dict[str, str] = {}
    for name, record in state["harness_sources"].items():
        path = Path(record["path"])
        refuse_symlink(path, f"harness {name} execution source")
        if not path.is_file():
            raise HarnessError(f"harness execution source is missing: {path}")
        digest = sha256_file(path)
        if digest != record["sha256_at_start"]:
            raise HarnessError(f"harness execution source changed before launch: {name}")
        source_hashes[name] = digest

    return {
        "verified_at": now_iso(),
        "private_artifacts": artifact_hashes,
        "harness_sources": source_hashes,
    }


def read_time_service_evidence(state: dict[str, Any]) -> dict[str, Any] | None:
    path = Path(state["time_service"]["evidence_path"])
    refuse_symlink(path, "RFC 868 evidence record")
    if not path.is_file():
        return None
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HarnessError(f"cannot read RFC 868 evidence: {path}") from exc
    required = {
        "schema",
        "received_at",
        "interface",
        "host_ip",
        "host_mac",
        "port",
        "udp_guard_bind",
        "request_source_mac",
        "request_destination_mac",
        "request_source_ip",
        "request_destination_ip",
        "request_source_port",
        "request_destination_port",
        "request_payload_bytes",
        "request_frame_bytes",
        "request_frame_sha256",
        "reply_source_mac",
        "reply_destination_mac",
        "reply_source_ip",
        "reply_destination_ip",
        "reply_source_port",
        "reply_destination_port",
        "reply_udp_checksum",
        "reply_payload_hex",
        "reply_frame_bytes",
        "reply_frame_sha256",
        "reply_attempts",
        "reply_interval_seconds",
        "first_reply_sent_at",
        "last_reply_sent_at",
        "rfc868_seconds",
        "unix_seconds",
    }
    if not isinstance(value, dict) or not required.issubset(value) or value.get("schema") != 2:
        raise HarnessError(f"invalid RFC 868 evidence schema: {path}")
    service = state["time_service"]
    network = state["network_isolation"]
    integer_fields = (
        "port",
        "request_source_port",
        "request_destination_port",
        "request_udp_checksum",
        "request_payload_bytes",
        "request_frame_bytes",
        "reply_source_port",
        "reply_destination_port",
        "reply_udp_checksum",
        "reply_frame_bytes",
        "reply_attempts",
        "rfc868_seconds",
        "unix_seconds",
    )
    if any(type(value.get(name)) is not int for name in integer_fields):
        raise HarnessError(f"invalid RFC 868 numeric evidence: {path}")
    if any(
        not isinstance(value.get(name), str)
        for name in (
            "received_at",
            "first_reply_sent_at",
            "last_reply_sent_at",
            "request_frame_sha256",
            "reply_frame_sha256",
            "reply_payload_hex",
        )
    ):
        raise HarnessError(f"invalid RFC 868 textual evidence: {path}")
    digest_pattern = re.compile(r"[0-9a-f]{64}\Z")
    payload_pattern = re.compile(r"[0-9a-f]{8}\Z")
    guest_ip = str(network["guest_side"]).split("/", 1)[0]
    if (
        value.get("interface") != service["interface"]
        or value.get("host_ip") != service["host_ip"]
        or value.get("host_mac") != service["host_mac"]
        or value.get("port") != service["port"]
        or value.get("udp_guard_bind") != "0.0.0.0"
        or value.get("request_source_ip") != guest_ip
        or value.get("request_source_mac") != service["guest_mac"]
        or value.get("request_destination_ip") != "255.255.255.255"
        or value.get("request_destination_mac") != "ff:ff:ff:ff:ff:ff"
        or value.get("request_destination_port") != service["port"]
        or value.get("request_payload_bytes") != 0
        or value.get("request_frame_bytes") != 58
        or value.get("request_frame_sha256")
        != service["expected_request_frame_sha256"]
        or value.get("reply_source_ip") != service["host_ip"]
        or value.get("reply_source_mac") != service["host_mac"]
        or value.get("reply_source_port") != service["port"]
        or value.get("reply_destination_port") != value.get("request_source_port")
        or value.get("reply_destination_ip") != value.get("request_source_ip")
        or value.get("reply_destination_mac") != value.get("request_source_mac")
        or value.get("reply_udp_checksum") != 0
        or value.get("reply_frame_bytes") != 46
        or value.get("reply_attempts") != service["reply_attempts"]
        or not digest_pattern.fullmatch(value["request_frame_sha256"])
        or not digest_pattern.fullmatch(value["reply_frame_sha256"])
        or not payload_pattern.fullmatch(value["reply_payload_hex"])
        or value.get("reply_payload_hex")
        != f"{value['rfc868_seconds']:08x}"
        or value["rfc868_seconds"]
        != (value["unix_seconds"] + RFC868_UNIX_EPOCH_OFFSET) & 0xFFFFFFFF
        or not isinstance(value.get("reply_interval_seconds"), (int, float))
        or isinstance(value.get("reply_interval_seconds"), bool)
        or value["reply_interval_seconds"] < 0
    ):
        raise HarnessError(f"invalid RFC 868 reply evidence: {path}")
    return {**value, "sha256": hashlib.sha256(raw).hexdigest()}


def read_time_service_completion(
    state: dict[str, Any], evidence: dict[str, Any]
) -> dict[str, Any] | None:
    path = Path(state["time_service"]["completion_path"])
    refuse_symlink(path, "RFC 868 completion record")
    if not path.is_file():
        return None
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HarnessError(f"cannot read RFC 868 completion record: {path}") from exc
    if (
        not isinstance(value, dict)
        or value.get("schema") != 1
        or value.get("responder_exit_status") != 0
        or value.get("evidence_sha256") != evidence.get("sha256")
        or not isinstance(value.get("completed_at"), str)
    ):
        raise HarnessError(f"invalid RFC 868 completion record: {path}")
    return {**value, "sha256": hashlib.sha256(raw).hexdigest()}


def read_time_service_failure(state: dict[str, Any]) -> dict[str, Any] | None:
    path = Path(state["time_service"]["failure_path"])
    refuse_symlink(path, "RFC 868 failure record")
    if not path.is_file():
        return None
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HarnessError(f"cannot read RFC 868 failure record: {path}") from exc
    if (
        not isinstance(value, dict)
        or value.get("schema") != 1
        or not isinstance(value.get("failed_at"), str)
        or not isinstance(value.get("reason"), str)
        or not value["reason"]
    ):
        raise HarnessError(f"invalid RFC 868 failure record: {path}")
    return {**value, "sha256": hashlib.sha256(raw).hexdigest()}


def read_x_compatibility_observations(
    state: dict[str, Any],
) -> dict[str, Any] | None:
    log_value = state.get("launcher_log")
    if not isinstance(log_value, str):
        return None
    path = Path(log_value)
    refuse_symlink(path, "Open Genera launcher log")
    if not path.is_file():
        return None
    try:
        with path.open("rb") as log:
            data = log.read(2 * 1024 * 1024)
    except OSError as exc:
        raise HarnessError(f"cannot inspect X compatibility evidence: {path}") from exc
    if RELAY_MISMATCH_MARKER in data:
        raise HarnessError(
            "the exact guest X compatibility write had a mismatched partial-write continuation"
        )
    grab = RELAY_GRAB_MARKER in data
    modifier = RELAY_MODIFIER_MARKER in data
    if not (grab and modifier):
        return None
    return {
        "observed_at": now_iso(),
        "guest_relay_grab_transformed": True,
        "guest_relay_modifier_mapping_transformed": True,
        "success_markers_required_before_running": True,
        "launcher_log_bytes_examined": min(path.stat().st_size, len(data)),
    }


def supervise(session_dir: Path) -> int:
    stop_requested = False

    def request_stop(_signum: int, _frame: Any) -> None:
        nonlocal stop_requested
        stop_requested = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    state = wait_for_own_record(session_dir)
    run_lock: Any = None
    xvfb_process: subprocess.Popen[bytes] | None = None
    launcher_process: subprocess.Popen[bytes] | None = None
    launcher_log: Any = None
    error: str | None = None
    selected: dict[str, Any] | None = None
    vlm_record: dict[str, Any] | None = None
    shutdown_confirmation_sent = False
    shutdown_confirmation_accepted = False
    shutdown_cleanup_progress_observed = False
    shutdown_prompt_observed = False
    vlm_signal_sent = False
    forced_stop = False
    vlm_forced_stop = False
    launcher_returncode: int | None = None
    xvfb_returncode: int | None = None
    cleanup_errors: list[str] = []
    main_without_time_completion_since: float | None = None
    try:
        run_lock = try_run_lock(VLM_RUN_LOCK)
        (
            xvfb_process,
            display,
            xauthority,
            modifier_map,
            x_server_security,
        ) = start_xvfb(session_dir)
        state = update_state(
            session_dir,
            {
                "display": display,
                "xauthority": str(xauthority),
                "x_modifier_compatibility": modifier_map,
                "x_server_security": x_server_security,
                "xvfb": process_record(xvfb_process.pid),
                "status": "booting",
                "boot_started_at": now_iso(),
            },
        )
        execution_inputs = verify_execution_inputs(state)
        private_execution = execution_inputs["private_artifacts"]
        state = update_state(
            session_dir,
            {
                "execution_inputs": execution_inputs,
                "vlm_sha256_at_exec": private_execution["vlm"],
                "ifconfig_preload_sha256_at_exec": private_execution[
                    "ifconfig_preload"
                ],
                "x_compatibility_preload_sha256_at_exec": private_execution[
                    "x_compatibility_preload"
                ],
                "time_server_sha256_at_exec": private_execution["time_server"],
                "config_sha256_at_exec": private_execution["config"],
            },
        )
        command, env, expected_vlm_argument = launcher_command(state)
        launcher_log_path = session_dir / f"vlm-generation-{state['generation']}.log"
        launcher_log = open_private_append_log(launcher_log_path)
        launcher_process = subprocess.Popen(
            command,
            cwd=ROOT,
            env=env,
            stdin=subprocess.PIPE,
            stdout=launcher_log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        state = update_state(
            session_dir,
            {
                "launcher": process_record(launcher_process.pid),
                "launcher_log": str(launcher_log_path),
                "expected_vlm_cmdline_argument": expected_vlm_argument,
            },
        )

        while not stop_requested:
            if launcher_process.poll() is not None:
                launcher_returncode = launcher_process.returncode
                raise HarnessError(
                    f"Open Genera launcher exited before stop (status {launcher_returncode})"
            )
            if vlm_record is None:
                vlm_pid = find_vlm_descendant(
                    launcher_process.pid, expected_vlm_argument
                )
                if vlm_pid is not None:
                    vlm_record = process_record(vlm_pid)
                    state = update_state(
                        session_dir,
                        {
                            "vlm": vlm_record,
                            "vlm_process_observed_at": now_iso(),
                        },
                    )
            state = read_state(session_dir)
            time_failure = read_time_service_failure(state)
            if time_failure is not None:
                update_state(
                    session_dir, {"time_service_failure": time_failure}
                )
                raise HarnessError(
                    f"RFC 868 responder failed: {time_failure['reason']}"
                )
            if not state.get("time_service_evidence"):
                time_evidence = read_time_service_evidence(state)
                if time_evidence is not None:
                    state = update_state(
                        session_dir, {"time_service_evidence": time_evidence}
                    )
            if state.get("time_service_evidence") and not state.get(
                "time_service_completion"
            ):
                time_completion = read_time_service_completion(
                    state, state["time_service_evidence"]
                )
                if time_completion is not None:
                    state = update_state(
                        session_dir, {"time_service_completion": time_completion}
                    )
            if not state.get("x_protocol_compatibility_observed"):
                x_observations = read_x_compatibility_observations(state)
                if x_observations is not None:
                    state = update_state(
                        session_dir,
                        {"x_protocol_compatibility_observed": x_observations},
                    )
            observed = discover_windows(state)
            selected = observed["selected"]
            if selected:
                changes: dict[str, Any] = {
                    "window_candidates": observed["candidates"],
                    "window_id": selected["window_id"],
                    "window_title": selected["title"],
                    "window_kind": selected["kind"],
                    "window_geometry": selected["geometry"],
                    "window_observed_at": now_iso(),
                }
                if selected["kind"] == "main" and vlm_record is not None:
                    if (
                        state.get("time_service_evidence")
                        and state.get("time_service_completion")
                        and state.get("x_protocol_compatibility_observed")
                    ):
                        changes["status"] = "running"
                        changes["time_service_ready"] = True
                        main_without_time_completion_since = None
                        if not state.get("started_at"):
                            changes["started_at"] = now_iso()
                    elif main_without_time_completion_since is None:
                        main_without_time_completion_since = time.monotonic()
                    elif time.monotonic() - main_without_time_completion_since >= 10:
                        raise HarnessError(
                            "Genera reached its main window but startup did not publish "
                            "both valid RFC 868 completion evidence and observed exact "
                            "guest X compatibility transformations"
                        )
                update_state(session_dir, changes)
            time.sleep(0.2)
    except Exception as exc:
        error = str(exc)
    finally:
        try:
            latest_state = read_state(session_dir, required=False)
            if latest_state:
                state = latest_state
        except Exception as exc:
            cleanup_errors.append(f"could not refresh session state: {exc}")
        try:
            if state and not state.get("time_service_failure"):
                time_failure = read_time_service_failure(state)
                if time_failure is not None:
                    state = update_state(
                        session_dir, {"time_service_failure": time_failure}
                    )
            if state and not state.get("time_service_evidence"):
                time_evidence = read_time_service_evidence(state)
                if time_evidence is not None:
                    state = update_state(
                        session_dir, {"time_service_evidence": time_evidence}
                    )
            if (
                state
                and state.get("time_service_evidence")
                and not state.get("time_service_completion")
            ):
                time_completion = read_time_service_completion(
                    state, state["time_service_evidence"]
                )
                if time_completion is not None:
                    state = update_state(
                        session_dir, {"time_service_completion": time_completion}
                    )
        except Exception as exc:
            cleanup_errors.append(f"could not finalize RFC 868 provenance: {exc}")
        if state.get("xvfb_start_cleanup_forced"):
            forced_stop = True
        if xvfb_process is None and xvfb_returncode is None:
            xvfb_returncode = state.get("xvfb_start_last_returncode")
        recorded_boot_id = state.get("boot_id", "")
        try:
            if stop_requested and vlm_record and process_matches(
                vlm_record, recorded_boot_id
            ):
                log_path = Path(state["launcher_log"])
                try:
                    shutdown_log_offset = log_path.stat().st_size
                except OSError:
                    shutdown_log_offset = 0
                update_state(
                    session_dir,
                    {"shutdown_log_search_offset": shutdown_log_offset},
                )
                vlm_signal_sent = safe_signal(
                    vlm_record, recorded_boot_id, signal.SIGTERM
                )
                update_state(session_dir, {"vlm_signal_sent": vlm_signal_sent})
                if vlm_signal_sent and launcher_process is not None:
                    shutdown_prompt_observed = wait_for_log_token(
                        log_path,
                        b"(yes or no)",
                        5,
                        start_offset=shutdown_log_offset,
                    )
                    update_state(
                        session_dir,
                        {"shutdown_prompt_observed": shutdown_prompt_observed},
                    )
                    try:
                        if launcher_process.stdin is None:
                            raise BrokenPipeError("Open Genera stdin is unavailable")
                        launcher_process.stdin.write(b"yes\n")
                        launcher_process.stdin.flush()
                        shutdown_confirmation_sent = True
                    except (BrokenPipeError, OSError):
                        shutdown_confirmation_sent = False
                    update_state(
                        session_dir,
                        {"shutdown_confirmation_sent": shutdown_confirmation_sent},
                    )
                    if shutdown_confirmation_sent:
                        shutdown_cleanup_progress_observed = wait_for_log_token(
                            log_path,
                            b"X connection to ",
                            5,
                            start_offset=shutdown_log_offset,
                        )
                        update_state(
                            session_dir,
                            {
                                "shutdown_cleanup_progress_observed": (
                                    shutdown_cleanup_progress_observed
                                )
                            },
                        )
                vlm_exited_after_confirmation = wait_process_gone(
                    vlm_record, recorded_boot_id, 20
                )
                shutdown_confirmation_accepted = bool(
                    shutdown_confirmation_sent
                    and shutdown_prompt_observed
                    and (
                        shutdown_cleanup_progress_observed
                        or vlm_exited_after_confirmation
                    )
                )
                update_state(
                    session_dir,
                    {
                        "shutdown_confirmation_accepted": (
                            shutdown_confirmation_accepted
                        )
                    },
                )
                if not vlm_exited_after_confirmation:
                    vlm_forced_stop = safe_signal(
                        vlm_record, recorded_boot_id, signal.SIGKILL
                    )
                    forced_stop = vlm_forced_stop or forced_stop
                    wait_process_gone(vlm_record, recorded_boot_id, 5)
        except Exception as exc:
            cleanup_errors.append(f"recorded VLM shutdown failed: {exc}")

        try:
            if launcher_process is not None:
                forced_stop = (
                    terminate_process_group(launcher_process, 10) or forced_stop
                )
                launcher_returncode = launcher_process.returncode
        except Exception as exc:
            forced_stop = True
            cleanup_errors.append(f"launcher cleanup failed: {exc}")
        if launcher_process is not None and launcher_process.stdin is not None:
            with contextlib.suppress(OSError):
                launcher_process.stdin.close()
        try:
            xvfb_returncode, xvfb_forced = terminate_process(xvfb_process, 5)
            forced_stop = forced_stop or xvfb_forced
        except Exception as exc:
            forced_stop = True
            cleanup_errors.append(f"Xvfb cleanup failed: {exc}")
        if launcher_log is not None:
            with contextlib.suppress(OSError):
                launcher_log.close()
        if run_lock is not None:
            with contextlib.suppress(OSError):
                run_lock.close()

        final_status = "failed"
        if stop_requested and not cleanup_errors:
            final_status = "forced-stopped" if forced_stop else "stopped"
        if cleanup_errors:
            cleanup_detail = "; ".join(cleanup_errors)
            error = f"{error}; cleanup: {cleanup_detail}" if error else cleanup_detail
        try:
            stop_hashes = hashes_at_stop(state)
        except Exception as exc:
            stop_hashes = {}
            cleanup_errors.append(f"could not hash stopped artifacts: {exc}")
            if error:
                error = f"{error}; could not hash stopped artifacts: {exc}"
            else:
                error = f"could not hash stopped artifacts: {exc}"
        if cleanup_errors:
            final_status = "failed"
        changes = {
            "status": final_status,
            "stopped_at": now_iso(),
            "error": error,
            "vlm_signal_sent": vlm_signal_sent,
            "shutdown_prompt_observed": shutdown_prompt_observed,
            "shutdown_confirmation_sent": shutdown_confirmation_sent,
            "shutdown_confirmation_accepted": shutdown_confirmation_accepted,
            "shutdown_cleanup_progress_observed": shutdown_cleanup_progress_observed,
            "forced_after_confirmed_shutdown_stall": bool(
                vlm_forced_stop
                and shutdown_confirmation_accepted
                and shutdown_cleanup_progress_observed
            ),
            "vlm_forced_stop": vlm_forced_stop,
            "orderly_vlm_host_shutdown": bool(
                stop_requested
                and vlm_signal_sent
                and shutdown_confirmation_accepted
                and not forced_stop
            ),
            "forced_stop": forced_stop,
            "state_may_be_incomplete": forced_stop or bool(cleanup_errors),
            "launcher_returncode": launcher_returncode,
            "xvfb_returncode": xvfb_returncode,
            "process_checkpoint_created_by_harness": False,
            "guest_checkpoint_created": None,
            "save_world_invoked_by_harness": False,
            "save_world_performed": None,
            "unsaved_lisp_state_discarded": bool(vlm_record or state.get("vlm")),
            **stop_hashes,
        }
        update_state(session_dir, changes)
    return 0 if stop_requested and not forced_stop and not cleanup_errors else 1


def require_running(session_dir: Path) -> dict[str, Any]:
    state = read_state(session_dir)
    live = live_processes(state)
    if state.get("status") != "running" or not all(live.values()):
        raise HarnessError(
            f"session {session_dir.name!r} is not running (status {state.get('status')!r})"
        )
    return state


def refresh_window(session_dir: Path, state: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    observed = discover_windows(state)
    selected = observed["selected"]
    if not selected or selected["kind"] != "main":
        raise HarnessError("the running Genera main window could not be identified")
    state = update_state(
        session_dir,
        {
            "window_candidates": observed["candidates"],
            "window_id": selected["window_id"],
            "window_title": selected["title"],
            "window_kind": selected["kind"],
            "window_geometry": selected["geometry"],
            "window_observed_at": now_iso(),
        },
    )
    return state, selected


def focus_window(state: dict[str, Any], window_id: int) -> None:
    xdotool(state, ["windowfocus", "--sync", str(window_id)])


def append_action(
    session_dir: Path, state: dict[str, Any], action: dict[str, Any]
) -> dict[str, Any]:
    path = action_log_path(session_dir, int(state["generation"]))
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HarnessError(f"cannot read action log: {path}") from exc
    if (
        value.get("schema") != 1
        or value.get("generation") != state["generation"]
        or not isinstance(value.get("actions"), list)
    ):
        raise HarnessError(f"unsupported action-log schema: {path}")
    value["actions"].append(action)
    atomic_write_json(path, value)
    return {"count": len(value["actions"]), "sha256": sha256_file(path)}


def capture_window(state: dict[str, Any], selected: dict[str, Any], destination: Path) -> dict[str, Any]:
    window_id = int(selected["window_id"])
    env = x_environment(state)
    encoded = run(
        ["import", "-window", str(window_id), "png:-"],
        env=env,
        text=False,
        timeout=30,
    ).stdout
    if not isinstance(encoded, bytes) or not encoded:
        raise HarnessError("ImageMagick returned an empty screenshot")
    atomic_write_bytes(destination, encoded)
    dimensions = run(
        ["identify", "-format", "%w %h", destination], env=env, timeout=30
    ).stdout.split()
    if len(dimensions) != 2:
        raise HarnessError(f"ImageMagick did not report screenshot dimensions: {destination}")
    try:
        width, height = (int(value) for value in dimensions)
    except ValueError as exc:
        raise HarnessError(f"invalid screenshot dimensions for {destination}") from exc
    expected = selected["geometry"]
    if width != expected["width"] or height != expected["height"]:
        raise HarnessError(
            f"captured {width}x{height}, expected exact client {expected['width']}x{expected['height']}"
        )
    pixels = run(
        ["convert", destination, "-alpha", "off", "-depth", "8", "rgb:-"],
        env=env,
        text=False,
        timeout=30,
    ).stdout
    return {
        "path": str(destination),
        "window_id": window_id,
        "window_title": selected["title"],
        "window_kind": selected["kind"],
        "window_geometry": selected["geometry"],
        "width": width,
        "height": height,
        "png_sha256": sha256_file(destination),
        "pixel_sha256": hashlib.sha256(pixels).hexdigest(),
    }


def next_screenshot_path(session_dir: Path, label: str) -> Path:
    validate_label(label)
    screenshots = session_dir / "screenshots"
    highest = 0
    for candidate in screenshots.glob("*.png"):
        match = re.match(r"([0-9]+)-", candidate.name)
        if match:
            highest = max(highest, int(match.group(1)))
    return screenshots / f"{highest + 1:04d}-{label}.png"


def screenshot_provenance(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "archive": {
            key: state["archive"][key] for key in ("basename", "bytes", "sha256")
        },
        "base_artifacts": {
            name: {
                "bytes": value["bytes"],
                "sha256_at_start": value["sha256_at_start"],
            }
            for name, value in state["base_artifacts"].items()
        },
        "private_artifacts": {
            name: {
                "bytes": value["bytes"],
                "sha256_at_start": value["sha256_at_start"],
            }
            for name, value in state["private_artifacts"].items()
        },
        "ifconfig_preload_source_sha256_at_start": state["ifconfig_preload_source"][
            "sha256_at_start"
        ],
        "x_compatibility_preload_source_sha256_at_start": state[
            "x_compatibility_preload_source"
        ]["sha256_at_start"],
        "time_server_source_sha256_at_start": state["time_server_source"][
            "sha256_at_start"
        ],
        "vlm_sha256_at_exec": state.get("vlm_sha256_at_exec"),
        "ifconfig_preload_sha256_at_exec": state.get(
            "ifconfig_preload_sha256_at_exec"
        ),
        "x_compatibility_preload_sha256_at_exec": state.get(
            "x_compatibility_preload_sha256_at_exec"
        ),
        "time_server_sha256_at_exec": state.get("time_server_sha256_at_exec"),
        "config_sha256_at_exec": state.get("config_sha256_at_exec"),
        "harness_sources_at_exec": state.get("execution_inputs", {}).get(
            "harness_sources"
        ),
        "time_service_evidence": state.get("time_service_evidence"),
        "time_service_completion": state.get("time_service_completion"),
        "x_modifier_compatibility": state.get("x_modifier_compatibility"),
        "x_protocol_compatibility": state.get("x_protocol_compatibility"),
        "x_protocol_compatibility_observed": state.get(
            "x_protocol_compatibility_observed"
        ),
        "network_isolation": state["network_isolation"],
        "native_process_isolation": state["native_process_isolation"],
        "toolchain_provenance": state["toolchain_provenance"],
    }


def take_screenshot(session_dir: Path, label: str) -> dict[str, Any]:
    state = require_running(session_dir)
    state, selected = refresh_window(session_dir, state)
    destination = next_screenshot_path(session_dir, label)
    captured = capture_window(state, selected, destination)
    actions = action_log_path(session_dir, int(state["generation"]))
    action_value = json.loads(actions.read_text(encoding="utf-8"))
    metadata = {
        "schema": 1,
        "captured_at": now_iso(),
        "session": state["session"],
        "generation": state["generation"],
        "window_candidates": state.get("window_candidates", []),
        "action_log": {
            "count": len(action_value.get("actions", [])),
            "sha256": sha256_file(actions),
        },
        "process_checkpoint_created_by_harness": False,
        "guest_checkpoint_created": None,
        "save_world_invoked_by_harness": False,
        "save_world_performed": None,
        "provenance": screenshot_provenance(state),
        **captured,
    }
    atomic_write_json(destination.with_suffix(".json"), metadata)
    return metadata


def status_payload(state: dict[str, Any]) -> dict[str, Any]:
    payload = dict(state)
    payload["live"] = live_processes(state)
    if payload["live"].get("xvfb") and state.get("display"):
        with contextlib.suppress(HarnessError):
            observed = discover_windows(state)
            payload["current_window_candidates"] = observed["candidates"]
            payload["current_window"] = observed["selected"]
    return payload


def probe_host_capabilities() -> dict[str, Any]:
    if not Path("/dev/net/tun").exists():
        return {"ok": False, "error": "/dev/net/tun is unavailable"}
    bwrap = shutil.which("bwrap")
    bash = shutil.which("bash")
    if bwrap is None or bash is None:
        return {"ok": False, "error": "Bubblewrap and Bash are required"}
    profile = Path(bash).parent.parent
    sandbox_path = f"{profile / 'bin'}:{profile / 'sbin'}"
    probe = r"""
set -eu
ip link set lo up
ip link add eth0 type dummy
ip link set eth0 address 02:00:00:00:00:01
ip addr add 192.0.2.1/24 dev eth0
ip link set eth0 up
ip tuntap add dev tun0 mode tap user 0
ip addr add 10.0.0.1/24 dev tun0
ip link set tun0 up
python3 - <<'PY'
import socket
raw = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(3))
raw.bind(("tun0", 0))
guard = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
guard.bind(("0.0.0.0", 37))
guard.close()
raw.close()
assert socket.gethostbyname("genera-museum") == "10.0.0.1"
PY
loader=$(ldd "$(command -v bash)" | awk '/ld-linux/ {for (i=1;i<=NF;i++) if ($i ~ /^\//) {print $i; exit}}')
test -n "$loader"
test -x "$loader"
test ! -e /home
test -r /etc/hosts
test -r /etc/nsswitch.conf
test ! -e /etc/passwd
test ! -e /etc/resolv.conf
test ! -e /var
test ! -e /run/user
test -r /gnu/store
test -w /session/runtime
test -c /dev/net/tun
test -r /proc/self/status
test -z "$(ip route show default)"
printf '%s\n' ok > /session/runtime/probe
"""
    with tempfile.TemporaryDirectory(prefix="genera-computer-use-doctor-") as temporary:
        temporary_path = Path(temporary)
        hosts = temporary_path / "sandbox-hosts"
        nsswitch = temporary_path / "sandbox-nsswitch.conf"
        hosts.write_text(SANDBOX_HOSTS_CONTENT, encoding="ascii")
        nsswitch.write_text(SANDBOX_NSSWITCH_CONTENT, encoding="ascii")
        result = run(
            [
                bwrap,
                "--die-with-parent",
                "--unshare-user",
                "--uid",
                "0",
                "--gid",
                "0",
                "--cap-add",
                "CAP_NET_ADMIN",
                "--cap-add",
                "CAP_NET_RAW",
                "--cap-add",
                "CAP_NET_BIND_SERVICE",
                "--unshare-net",
                "--unshare-pid",
                "--unshare-ipc",
                "--unshare-uts",
                "--hostname",
                "genera-doctor",
                "--proc",
                "/proc",
                "--dev",
                "/dev",
                "--dir",
                "/dev/net",
                "--dev-bind",
                "/dev/net/tun",
                "/dev/net/tun",
                "--tmpfs",
                "/run",
                "--dir",
                "/tmp",
                "--chmod",
                "1777",
                "/tmp",
                "--dir",
                "/gnu",
                "--ro-bind",
                "/gnu/store",
                "/gnu/store",
                "--dir",
                "/etc",
                "--ro-bind",
                hosts,
                "/etc/hosts",
                "--ro-bind",
                nsswitch,
                "/etc/nsswitch.conf",
                "--dir",
                "/session",
                "--bind",
                temporary,
                SANDBOX_RUNTIME,
                "--chdir",
                SANDBOX_RUNTIME,
                "--clearenv",
                "--setenv",
                "PATH",
                sandbox_path,
                "--setenv",
                "LANG",
                "C",
                "--setenv",
                "LC_ALL",
                "C",
                "--",
                bash,
                "-c",
                probe,
            ],
            check=False,
            timeout=20,
        )
    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "error": (result.stderr or result.stdout).strip() or None,
        "checks": [
            "bubblewrap-user-network-mount-pid-ipc-uts-namespaces",
            "filesystem-allowlist-and-scrubbed-environment",
            "minimal-generated-hostname-resolution",
            "private-tap-creation",
            "dummy-eth0-creation",
            "rfc868-raw-ethernet-responder",
            "rfc868-udp-port-guard",
            "dynamic-loader-resolution",
            "no-default-route",
        ],
    }


def command_doctor(args: argparse.Namespace, state_root: Path) -> int:
    archive = archive_path_from(args.archive)
    tools = command_paths()
    base = base_paths()
    base_artifacts: dict[str, Any] = {}
    for name, path in base.items():
        exists = path.is_file()
        digest = sha256_file(path) if exists else None
        base_artifacts[name] = {
            "path": str(path),
            "exists": exists,
            "bytes": path.stat().st_size if exists else None,
            "sha256": digest,
            "expected_sha256": EXPECTED_BASE_SHA256.get(name),
            "matches_expected": (
                digest == EXPECTED_BASE_SHA256[name]
                if name in EXPECTED_BASE_SHA256 and digest is not None
                else None
            ),
        }
    capabilities = probe_host_capabilities()
    result = {
        "state_root": str(state_root),
        "archive": {
            "path": str(archive),
            "exists": archive.is_file(),
            "bytes": archive.stat().st_size if archive.is_file() else None,
        },
        "commands": tools,
        "base_artifacts": base_artifacts,
        "host_capabilities": capabilities,
        "x_server_policy": {
            "mit_shm_enabled": False,
            "launch_arguments": ["-extension", "MIT-SHM"],
            "live_verification": "xdpyinfo -queryExtensions on every session start",
            "verification_tool_available": bool(tools.get("xdpyinfo")),
        },
        "network_mode": "isolated Bubblewrap user/network namespace",
        "host_tun0_required": False,
        "external_network": False,
    }
    result["ok"] = (
        all(tools.values())
        and result["archive"]["exists"]
        and all(value["exists"] for value in result["base_artifacts"].values())
        and all(
            value["matches_expected"] is not False
            for value in result["base_artifacts"].values()
        )
        and capabilities["ok"]
        and os.access(base["vlm"], os.X_OK)
    )
    json_print(result)
    return 0 if result["ok"] else 1


def command_start(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    archive = archive_path_from(args.archive)
    with locked(state_root / ".lifecycle.lock", create_parent=False):
        ensure_session_directory(session_dir)
        with locked(session_dir / "control.lock", create_parent=False):
            prior = read_state(session_dir, required=False)
            if prior and any(live_processes(prior).values()):
                raise HarnessError(f"session {args.session!r} still owns live processes")
            with locked(RUNTIME_PREPARE_LOCK):
                base, archive_sha256 = ensure_runtime_ready(archive)
                metadata = prepare_session(
                    session_dir,
                    base,
                    archive,
                    archive_sha256,
                    fresh=args.fresh,
                )
            metadata["state_root"] = str(state_root)
            metadata["status"] = "starting"
            metadata["startup_timeout"] = args.timeout
            replace_state(session_dir, metadata)
            supervisor_log = session_dir / f"supervisor-generation-{metadata['generation']}.log"
            with open_private_append_log(supervisor_log) as log:
                process = subprocess.Popen(
                    [
                        sys.executable,
                        str(Path(__file__).resolve()),
                        "--state-root",
                        str(state_root),
                        "_supervise",
                        "--session",
                        args.session,
                    ],
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
                },
            )

    deadline = time.monotonic() + args.timeout
    while time.monotonic() < deadline:
        state = read_state(session_dir)
        if state.get("status") == "running":
            payload = status_payload(state)
            if all(payload["live"].values()) and payload.get("window_kind") == "main":
                json_print(payload)
                return 0
        if state.get("status") in {"failed", "stopped", "forced-stopped"}:
            raise HarnessError(state.get("error") or "supervisor stopped before Genera became ready")
        time.sleep(0.2)
    state = read_state(session_dir)
    supervisor = state.get("supervisor")
    if process_matches(supervisor, state.get("boot_id")):
        os.kill(int(supervisor["pid"]), signal.SIGTERM)
    raise HarnessError(f"timed out after {args.timeout:g}s waiting for the Genera main window")


def command_status(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    require_session_directory(session_dir)
    payload = status_payload(read_state(session_dir))
    json_print(payload)
    return 0 if payload.get("status") == "running" and all(payload["live"].values()) else 1


def command_screenshot(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        metadata = take_screenshot(session_dir, args.label)
    json_print(metadata)
    return 0


def translate_keys(keys: Sequence[str]) -> list[str]:
    return [KEY_ALIASES.get(key.lower(), key) for key in keys]


def action_context(state: dict[str, Any], selected: dict[str, Any]) -> dict[str, Any]:
    return {
        "timestamp": now_iso(),
        "generation": state["generation"],
        "window_id": selected["window_id"],
        "window_title": selected["title"],
        "window_geometry": selected["geometry"],
    }


def begin_action_attempt(
    session_dir: Path,
    state: dict[str, Any],
    selected: dict[str, Any],
    action: str,
    details: dict[str, Any],
) -> str:
    attempt_id = uuid.uuid4().hex
    append_action(
        session_dir,
        state,
        {
            **action_context(state, selected),
            "action": action,
            "attempt_id": attempt_id,
            "phase": "intent",
            "outcome": "pending",
            **details,
        },
    )
    return attempt_id


def finish_action_attempt(
    session_dir: Path,
    state: dict[str, Any],
    selected: dict[str, Any],
    action: str,
    attempt_id: str,
    *,
    succeeded: bool,
    error: str | None = None,
) -> dict[str, Any]:
    return append_action(
        session_dir,
        state,
        {
            **action_context(state, selected),
            "action": action,
            "attempt_id": attempt_id,
            "phase": "outcome",
            "outcome": "succeeded" if succeeded else "failed-or-partial",
            "error": error,
        },
    )


def command_key(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        state, selected = refresh_window(session_dir, state)
        action = "keydown" if args.down else "keyup" if args.up else "key"
        keys = translate_keys(args.keys)
        details = {
            "keys": keys,
            "delay_ms": args.delay_ms if action == "key" else None,
        }
        attempt_id = begin_action_attempt(
            session_dir, state, selected, action, details
        )
        command = [action]
        if action == "key":
            command.extend(["--clearmodifiers", "--delay", str(args.delay_ms)])
        command.append("--")
        command.extend(keys)
        try:
            focus_window(state, int(selected["window_id"]))
            xdotool(state, command)
        except Exception as exc:
            with contextlib.suppress(Exception):
                finish_action_attempt(
                    session_dir,
                    state,
                    selected,
                    action,
                    attempt_id,
                    succeeded=False,
                    error=str(exc),
                )
            raise
        log = finish_action_attempt(
            session_dir, state, selected, action, attempt_id, succeeded=True
        )
    json_print({"action": action, "keys": keys, "session": args.session, "action_log": log})
    return 0


def command_type(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        state, selected = refresh_window(session_dir, state)
        action = "type"
        details = {
            "text": args.text,
            "delay_ms": args.delay_ms,
            "enter": args.enter,
        }
        attempt_id = begin_action_attempt(
            session_dir, state, selected, action, details
        )
        try:
            focus_window(state, int(selected["window_id"]))
            xdotool(
                state,
                [
                    "type",
                    "--clearmodifiers",
                    "--delay",
                    str(args.delay_ms),
                    "--",
                    args.text,
                ],
            )
            if args.enter:
                xdotool(state, ["key", "--clearmodifiers", "Return"])
        except Exception as exc:
            with contextlib.suppress(Exception):
                finish_action_attempt(
                    session_dir,
                    state,
                    selected,
                    action,
                    attempt_id,
                    succeeded=False,
                    error=str(exc),
                )
            raise
        log = finish_action_attempt(
            session_dir, state, selected, action, attempt_id, succeeded=True
        )
    json_print(
        {
            "action": "type",
            "character_count": len(args.text),
            "delay_ms": args.delay_ms,
            "enter": args.enter,
            "session": args.session,
            "action_log": log,
        }
    )
    return 0


def validate_coordinates(x: int, y: int, geometry: dict[str, int]) -> None:
    if not (0 <= x < geometry["width"] and 0 <= y < geometry["height"]):
        raise HarnessError(
            f"Genera coordinates must be within 0..{geometry['width'] - 1}, "
            f"0..{geometry['height'] - 1} for the current window"
        )


def mouse_move(state: dict[str, Any], selected: dict[str, Any], x: int, y: int) -> None:
    validate_coordinates(x, y, selected["geometry"])
    xdotool(
        state,
        ["mousemove", "--window", str(selected["window_id"]), str(x), str(y)],
    )
    geometry = selected["geometry"]
    expected_x = geometry["x"] + x
    expected_y = geometry["y"] + y
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        observed = xdotool(state, ["getmouselocation", "--shell"], check=False)
        values: dict[str, int] = {}
        if observed.returncode == 0:
            for line in observed.stdout.splitlines():
                key, separator, value = line.partition("=")
                if separator and key in {"X", "Y"}:
                    try:
                        values[key] = int(value)
                    except ValueError:
                        values.clear()
                        break
        if values.get("X") == expected_x and values.get("Y") == expected_y:
            return
        time.sleep(0.01)
    raise HarnessError(
        "the XTEST pointer did not reach the requested Genera coordinates "
        f"({x}, {y})"
    )


def validate_button(button: int) -> None:
    if button not in (1, 2, 3):
        raise HarnessError("Genera mouse buttons must be host X buttons 1, 2, or 3")


def command_mouse(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    with locked(session_dir / "control.lock", create_parent=False):
        require_session_directory(session_dir)
        state = require_running(session_dir)
        state, selected = refresh_window(session_dir, state)
        result: dict[str, Any] = {
            "action": args.mouse_action,
            "session": args.session,
            "timestamp": now_iso(),
        }
        details: dict[str, Any] = {}
        if args.mouse_action == "move":
            validate_coordinates(args.x, args.y, selected["geometry"])
            details.update({"x": args.x, "y": args.y})
        elif args.mouse_action == "click":
            validate_button(args.button)
            validate_coordinates(args.x, args.y, selected["geometry"])
            details.update({"x": args.x, "y": args.y, "button": args.button})
        elif args.mouse_action in {"down", "up"}:
            validate_button(args.button)
            details["button"] = args.button
        elif args.mouse_action == "drag":
            validate_button(args.button)
            validate_coordinates(args.x1, args.y1, selected["geometry"])
            validate_coordinates(args.x2, args.y2, selected["geometry"])
            details.update(
                {
                    "from": [args.x1, args.y1],
                    "to": [args.x2, args.y2],
                    "button": args.button,
                    "duration_ms": args.duration_ms,
                    "steps": args.steps,
                }
            )
        action = f"mouse-{args.mouse_action}"
        attempt_id = begin_action_attempt(
            session_dir, state, selected, action, details
        )
        try:
            focus_window(state, int(selected["window_id"]))
            if args.mouse_action == "move":
                mouse_move(state, selected, args.x, args.y)
            elif args.mouse_action == "click":
                mouse_move(state, selected, args.x, args.y)
                xdotool(state, ["click", str(args.button)])
            elif args.mouse_action in {"down", "up"}:
                xdotool(
                    state,
                    [
                        "mousedown" if args.mouse_action == "down" else "mouseup",
                        str(args.button),
                    ],
                )
            elif args.mouse_action == "drag":
                mouse_move(state, selected, args.x1, args.y1)
                xdotool(state, ["mousedown", str(args.button)])
                try:
                    steps = max(1, args.steps)
                    for index in range(1, steps + 1):
                        x = round(args.x1 + (args.x2 - args.x1) * index / steps)
                        y = round(args.y1 + (args.y2 - args.y1) * index / steps)
                        mouse_move(state, selected, x, y)
                        time.sleep(args.duration_ms / steps / 1000)
                finally:
                    xdotool(state, ["mouseup", str(args.button)])
        except Exception as exc:
            with contextlib.suppress(Exception):
                finish_action_attempt(
                    session_dir,
                    state,
                    selected,
                    action,
                    attempt_id,
                    succeeded=False,
                    error=str(exc),
                )
            raise
        result.update(details)
        log = finish_action_attempt(
            session_dir, state, selected, action, attempt_id, succeeded=True
        )
        result["action_log"] = log
    json_print(result)
    return 0


def temporary_capture_path(session_dir: Path) -> Path:
    captures = session_dir / ".captures"
    ensure_private_subdirectory(captures, "host-only transient-capture directory")
    return captures / f"wait-{os.getpid()}-{uuid.uuid4().hex}.png"


def command_wait(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    if args.seconds is not None:
        require_running(session_dir)
        deadline = time.monotonic() + args.seconds
        while time.monotonic() < deadline:
            require_running(session_dir)
            time.sleep(min(0.25, max(0, deadline - time.monotonic())))
        json_print({"session": args.session, "condition": "elapsed", "seconds": args.seconds})
        return 0

    if args.stable_for is None and args.changed_from is None:
        state = require_running(session_dir)
        state, selected = refresh_window(session_dir, state)
        json_print(
            {
                "session": args.session,
                "condition": "main-window-ready",
                "window": selected,
            }
        )
        return 0

    baseline_hash: str | None = None
    if args.changed_from is not None:
        baseline = Path(args.changed_from).expanduser().resolve()
        if not baseline.is_file():
            raise HarnessError(f"comparison screenshot does not exist: {baseline}")
        raw = run(
            ["convert", baseline, "-alpha", "off", "-depth", "8", "rgb:-"], text=False
        ).stdout
        baseline_hash = hashlib.sha256(raw).hexdigest()

    deadline = time.monotonic() + args.timeout
    stable_since: float | None = None
    previous_hash: str | None = None
    while time.monotonic() < deadline:
        state = require_running(session_dir)
        state, selected = refresh_window(session_dir, state)
        temporary = temporary_capture_path(session_dir)
        try:
            captured = capture_window(state, selected, temporary)
        finally:
            temporary.unlink(missing_ok=True)
        current_hash = captured["pixel_sha256"]
        if baseline_hash is not None and current_hash != baseline_hash:
            json_print(
                {"session": args.session, "condition": "screen-changed", "pixel_sha256": current_hash}
            )
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
                            "warning": "screen stability is not proof that Genera completed an operation",
                        }
                    )
                    return 0
            else:
                stable_since = None
            previous_hash = current_hash
        time.sleep(min(args.interval, max(0, deadline - time.monotonic())))
    raise HarnessError(f"wait condition was not met within {args.timeout:g}s")


def force_recorded_session_cleanup(
    session_dir: Path,
    state: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    recorded_boot_id = state.get("boot_id", "")
    forced = False
    vlm_forced = False

    if safe_signal(state.get("supervisor"), recorded_boot_id, signal.SIGKILL):
        forced = True
        wait_process_gone(state["supervisor"], recorded_boot_id, 5)
    if safe_signal(state.get("vlm"), recorded_boot_id, signal.SIGKILL):
        forced = True
        vlm_forced = True
        wait_process_gone(state["vlm"], recorded_boot_id, 5)
    if safe_signal_group(state.get("launcher"), recorded_boot_id, signal.SIGKILL):
        forced = True
        wait_process_gone(state["launcher"], recorded_boot_id, 5)
    if safe_signal(state.get("xvfb"), recorded_boot_id, signal.SIGTERM):
        forced = True
        if not wait_process_gone(state["xvfb"], recorded_boot_id, 5):
            safe_signal(state.get("xvfb"), recorded_boot_id, signal.SIGKILL)
            wait_process_gone(state["xvfb"], recorded_boot_id, 5)

    try:
        stop_hashes = hashes_at_stop(state)
        hash_error = None
    except Exception as exc:
        stop_hashes = {}
        hash_error = str(exc)
    recorded_error = reason
    if hash_error:
        recorded_error = f"{reason}; stopped-artifact hashing failed: {hash_error}"

    return update_state(
        session_dir,
        {
            "status": "forced-stopped",
            "error": recorded_error,
            "forced_stop": True,
            "state_may_be_incomplete": True,
            "vlm_signal_sent": bool(state.get("vlm_signal_sent")),
            "shutdown_prompt_observed": bool(
                state.get("shutdown_prompt_observed")
            ),
            "shutdown_confirmation_sent": bool(
                state.get("shutdown_confirmation_sent")
            ),
            "shutdown_confirmation_accepted": bool(
                state.get("shutdown_confirmation_accepted")
            ),
            "shutdown_cleanup_progress_observed": bool(
                state.get("shutdown_cleanup_progress_observed")
            ),
            "forced_after_confirmed_shutdown_stall": bool(
                vlm_forced
                and state.get("shutdown_confirmation_accepted")
                and state.get("shutdown_cleanup_progress_observed")
            ),
            "vlm_forced_stop": vlm_forced,
            "orderly_vlm_host_shutdown": False,
            "fallback_process_signal_sent": forced,
            "process_checkpoint_created_by_harness": False,
            "guest_checkpoint_created": None,
            "save_world_invoked_by_harness": False,
            "save_world_performed": None,
            "unsaved_lisp_state_discarded": bool(state.get("vlm")),
            "stopped_at": now_iso(),
            **stop_hashes,
        },
    )


def command_stop(args: argparse.Namespace, state_root: Path) -> int:
    session_dir = session_dir_for(state_root, args.session)
    discard = False
    exit_code = 0
    with locked(state_root / ".lifecycle.lock", create_parent=False):
        require_session_directory(session_dir)
        with locked(session_dir / "control.lock", create_parent=False):
            state = read_state(session_dir)
            recorded_boot_id = state.get("boot_id", "")
            live = live_processes(state)
            supervisor = state.get("supervisor")
            if live.get("supervisor") and safe_signal(
                supervisor, recorded_boot_id, signal.SIGTERM
            ):
                if not wait_process_gone(supervisor, recorded_boot_id, args.timeout):
                    state = read_state(session_dir)
                    force_recorded_session_cleanup(
                        session_dir,
                        state,
                        "supervisor exceeded the stop timeout; forced fallback used",
                    )
                else:
                    state = read_state(session_dir)
                    if any(live_processes(state).values()):
                        force_recorded_session_cleanup(
                            session_dir,
                            state,
                            "supervisor exited while recorded session processes remained",
                        )
            elif any(live.values()):
                force_recorded_session_cleanup(
                    session_dir,
                    state,
                    "supervisor was unavailable; forced recorded-process cleanup used",
                )
            elif state.get("status") in {"starting", "booting", "running"}:
                force_recorded_session_cleanup(
                    session_dir,
                    state,
                    "all recorded processes disappeared before terminal state was recorded",
                )
            final = read_state(session_dir)
            if final.get("forced_stop") or final.get("status") not in {"stopped"}:
                exit_code = 2
            discard = args.discard
        if discard:
            require_session_directory(session_dir)
            remove_tree(session_dir, state_root)
    if discard:
        json_print(
            {
                "session": args.session,
                "status": "discarded",
                "stop_status": final.get("status"),
                "forced_stop": final.get("forced_stop", False),
            }
        )
    else:
        json_print(status_payload(final))
    return exit_code


def add_session_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--session", default=DEFAULT_SESSION, help=f"session name (default: {DEFAULT_SESSION})"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Operate a private licensed Open Genera session on an authenticated, "
            "network-isolated Xvfb display."
        )
    )
    parser.add_argument("--state-root", help=argparse.SUPPRESS)
    public_commands = "{doctor,start,status,wait,key,type,mouse,screenshot,stop}"
    subparsers = parser.add_subparsers(dest="command", required=True, metavar=public_commands)

    doctor = subparsers.add_parser("doctor", help="check tools, archive, and prepared artifacts")
    doctor.add_argument("--archive", help="path to a legitimately acquired Open Genera archive")
    doctor.set_defaults(handler=command_doctor)

    start = subparsers.add_parser("start", help="cold boot a detached private Genera session")
    add_session_argument(start)
    start.add_argument("--archive", help="path to a legitimately acquired Open Genera archive")
    start.add_argument(
        "--fresh",
        action="store_true",
        help="replace the private world/debugger/VLM/preload before cold boot",
    )
    start.add_argument(
        "--timeout", type=positive_float, default=120, help="seconds to wait for the Genera main window"
    )
    start.set_defaults(handler=command_start)

    status = subparsers.add_parser("status", help="show recorded and live session state")
    add_session_argument(status)
    status.set_defaults(handler=command_status)

    wait = subparsers.add_parser(
        "wait", help="wait for the main window, time, a screen change, or screen stability"
    )
    add_session_argument(wait)
    wait_group = wait.add_mutually_exclusive_group()
    wait_group.add_argument("--seconds", type=nonnegative_float)
    wait_group.add_argument("--stable-for", type=nonnegative_float)
    wait_group.add_argument("--changed-from")
    wait.add_argument("--timeout", type=positive_float, default=180)
    wait.add_argument("--interval", type=positive_float, default=1)
    wait.set_defaults(handler=command_wait)

    key = subparsers.add_parser("key", help="send X key names through XTEST")
    add_session_argument(key)
    direction = key.add_mutually_exclusive_group()
    direction.add_argument("--down", action="store_true")
    direction.add_argument("--up", action="store_true")
    key.add_argument("--delay-ms", type=nonnegative_int, default=40)
    key.add_argument(
        "keys",
        nargs="+",
        help=(
            "X key names or documented aliases: select, rubout, abort, super, "
            "return, space, escape"
        ),
    )
    key.set_defaults(handler=command_key)

    type_parser = subparsers.add_parser("type", help="type text through XTEST")
    add_session_argument(type_parser)
    type_parser.add_argument("--delay-ms", type=nonnegative_int, default=40)
    type_parser.add_argument("--enter", action="store_true")
    type_parser.add_argument("text")
    type_parser.set_defaults(handler=command_type)

    mouse = subparsers.add_parser("mouse", help="move or use the three X mouse buttons")
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

    screenshot = subparsers.add_parser(
        "screenshot", help="capture the exact current Genera client and provenance"
    )
    add_session_argument(screenshot)
    screenshot.add_argument("--label", default="screen")
    screenshot.set_defaults(handler=command_screenshot)

    stop = subparsers.add_parser(
        "stop", help="request and record VLM host shutdown without claiming a saved world"
    )
    add_session_argument(stop)
    stop.add_argument("--timeout", type=positive_float, default=45)
    stop.add_argument("--discard", action="store_true", help="delete the private session after it stops")
    stop.set_defaults(handler=command_stop)

    supervise_parser = subparsers.add_parser("_supervise", help=argparse.SUPPRESS)
    add_session_argument(supervise_parser)
    subparsers._choices_actions = [
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
            return supervise(session_dir)
        except Exception as exc:
            with contextlib.suppress(Exception):
                update_state(
                    session_dir,
                    {"status": "failed", "error": str(exc), "stopped_at": now_iso()},
                )
            return 1
    try:
        return args.handler(args, state_root)
    except (HarnessError, OSError) as exc:
        print(json.dumps({"error": str(exc), "command": args.command}, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
