"""Compile and exercise the M7 source-local framebuffer witness in isolation."""

from __future__ import annotations

import pathlib
import subprocess
import tempfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
WITNESS = ROOT / "cadr-web/oracle/native/cadr_m7_frame_witness.c"
HARNESS = ROOT / "cadr-web/tests/cadr_m7_frame_witness_harness.c"


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="cadr-m7-frame-witness-") as temporary:
        temporary_path = pathlib.Path(temporary)
        executable = temporary_path / "witness-harness"
        subprocess.run([
            "cc", "-std=gnu99", "-Wall", "-Wextra", "-Werror",
            "-DCADR_M7_FRAME_WITNESS_TESTING=1",
            "-I", str(ROOT / "cadr-web/oracle/native"),
            "-I", str(ROOT / "l/usim"),
            "-o", str(executable), str(HARNESS), str(WITNESS),
        ], check=True, cwd=ROOT)
        for mode in ("success", "missing", "occupied", "relative", "geometry", "bow",
                     "short-write", "after-link", "symlink"):
            subprocess.run([str(executable), mode, str(temporary_path / f"{mode}.cdrm7n1")],
                           check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
