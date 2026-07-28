#!/usr/bin/env python3
"""Compare CDRGTRC1 logical streams and report the first divergence."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cadr_general_trace as trace


def digest_argument(value: str) -> bytes:
    if re.fullmatch(r"[0-9a-fA-F]{64}", value) is None:
        raise argparse.ArgumentTypeError("expected SHA-256")
    return bytes.fromhex(value)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("left", type=Path)
    parser.add_argument("right", type=Path)
    parser.add_argument(
        "--expected-initial-state-sha256",
        type=digest_argument,
        metavar="SHA256",
    )
    args = parser.parse_args()
    try:
        left = trace.parse_trace(
            args.left.read_bytes(),
            expected_initial_state_sha256=args.expected_initial_state_sha256,
        )
        right = trace.parse_trace(
            args.right.read_bytes(),
            expected_initial_state_sha256=args.expected_initial_state_sha256,
        )
    except (OSError, trace.TraceError) as error:
        print(f"comparison rejected: {error}", file=sys.stderr)
        return 1
    left_header, right_header = left["header"], right["header"]
    for name in (
        "first_boundary",
        "profile_sha256",
        "artifact_set_sha256",
        "initial_state_sha256",
        "input_schedule_sha256",
        "selector_mask",
        "event_mask",
    ):
        if getattr(left_header, name) != getattr(right_header, name):
            print(f"first divergence: header {name}", file=sys.stderr)
            return 1
    for index, (left_record, right_record) in enumerate(
        zip(left["records"], right["records"])
    ):
        if left_record.semantic != right_record.semantic:
            print(
                f"first divergence: record {index}, boundary "
                f"{left_record.boundary} vs {right_record.boundary}, "
                f"{left_record.semantic.hex()} != {right_record.semantic.hex()}",
                file=sys.stderr,
            )
            return 1
    if len(left["records"]) != len(right["records"]):
        print("first divergence: record count", file=sys.stderr)
        return 1
    if left["semantic_digest"] != right["semantic_digest"]:
        print("first divergence: terminal semantic digest", file=sys.stderr)
        return 1
    for name in (
        "reason", "final_state_sha256", "final_boundary", "record_count"
    ):
        if left["terminal"][name] != right["terminal"][name]:
            print(f"first divergence: terminal {name}", file=sys.stderr)
            return 1
    print(f"equal semantic digest {left['semantic_digest'].hex()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
