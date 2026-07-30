#!/usr/bin/env python3
"""Prepare, build, plan, or explicitly capture the disposable M12 debugger witness."""
from __future__ import annotations

import sys

from cadr_native_source_witness import main


if __name__ == "__main__":
    raise SystemExit(main(["m12-debugger", *sys.argv[1:]]))
