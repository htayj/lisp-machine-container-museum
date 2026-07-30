#!/usr/bin/env python3
"""Run one Linux process group tied to its exact supervisor parent."""

from __future__ import annotations

import ctypes
import os
import signal
import sys


PR_SET_PDEATHSIG = 1


def kill_process_group(_signal: int, _frame: object) -> None:
    """Fail closed: the wrapper and every descendant share this group."""
    signal.signal(signal.SIGUSR1, signal.SIG_IGN)
    os.killpg(0, signal.SIGKILL)
    os._exit(137)


def main() -> int:
    if len(sys.argv) < 3 or not sys.argv[1].isdigit():
        raise SystemExit("usage: cadr-pdeath-exec.py EXPECTED-PPID PROGRAM [ARG ...]")
    expected_parent = int(sys.argv[1])
    if expected_parent < 2 or os.getppid() != expected_parent:
        raise SystemExit("supervisor parent changed before PDEATHSIG installation")
    signal.signal(signal.SIGUSR1, kill_process_group)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(PR_SET_PDEATHSIG, signal.SIGUSR1, 0, 0, 0) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    if os.getppid() != expected_parent:
        kill_process_group(signal.SIGUSR1, None)

    child = os.fork()
    if child == 0:
        signal.signal(signal.SIGUSR1, signal.SIG_DFL)
        signal.signal(signal.SIGTERM, signal.SIG_DFL)
        os.execv(sys.argv[2], sys.argv[2:])
        os._exit(127)

    while True:
        try:
            _, status = os.waitpid(child, 0)
            break
        except InterruptedError:
            continue

    # Chromium may leave helpers alive after its direct process exits.  The
    # wrapper remains the group leader precisely so no such helper is orphaned.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    os.killpg(0, signal.SIGKILL)
    return os.waitstatus_to_exitcode(status)


if __name__ == "__main__":
    raise SystemExit(main())
