#!/usr/bin/env python3
"""Compare a CADR-WEB headless witness with a validated CDRTRC1 oracle."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cadr_oracle_trace as trace  # noqa: E402

PRODUCTION_BOUNDARY_EXECUTED = 1
PRODUCTION_BOUNDARY_INHIBITED = 2
PRODUCTION_BOUNDARY_HALTED = 4
PRODUCTION_BOUNDARY_PROM_DISABLED = 8
PRODUCTION_BOUNDARY_VMA_OK = 16
PRODUCTION_BOUNDARY_KNOWN_MASK = (
    PRODUCTION_BOUNDARY_EXECUTED
    | PRODUCTION_BOUNDARY_INHIBITED
    | PRODUCTION_BOUNDARY_HALTED
    | PRODUCTION_BOUNDARY_PROM_DISABLED
    | PRODUCTION_BOUNDARY_VMA_OK
)


def sha256_argument(value: str) -> bytes:
    """Decode one explicit SHA-256 comparison-target selector."""
    if re.fullmatch(r"[0-9a-fA-F]{64}", value) is None:
        raise argparse.ArgumentTypeError(
            "expected exactly 64 hexadecimal characters (a SHA-256 digest)"
        )
    return bytes.fromhex(value)


def positive_integer_argument(value: str) -> int:
    try:
        result = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("expected a positive integer") from error
    if result <= 0:
        raise argparse.ArgumentTypeError("expected a positive integer")
    return result


def production_boundaries(path: Path) -> dict[int, tuple[str, str, int, int, int]]:
    result: dict[int, tuple[str, str, int, int, int]] = {}
    for line_number, line in enumerate(path.read_text(encoding="ascii").splitlines(), 1):
        fields = line.split()
        if len(fields) != 16:
            raise ValueError(f"{path}:{line_number}: expected 16 fields")
        ordinal = int(fields[0])
        if ordinal in result:
            raise ValueError(f"{path}:{line_number}: duplicate boundary {ordinal}")
        result[ordinal] = (
            fields[-1],
            fields[-2],
            int(fields[-3]),
            int(fields[-4]),
            int(fields[5]),
        )
    if tuple(result) != tuple(range(len(result))):
        raise ValueError(f"{path}: boundary ordinals are not contiguous from S0")
    return result


def oracle_flags(value: int, ordinal: int) -> int:
    if value & ~PRODUCTION_BOUNDARY_KNOWN_MASK:
        raise ValueError(
            f"production boundary {ordinal} flags contain unknown bits: {value:#x}"
        )
    if ordinal == 0:
        if value != 0:
            raise ValueError(
                f"production S0 flags must be exactly zero, got {value:#x}"
            )
        return trace.BOUNDARY_S0
    activity = value & (
        PRODUCTION_BOUNDARY_EXECUTED | PRODUCTION_BOUNDARY_INHIBITED
    )
    if activity not in (
        PRODUCTION_BOUNDARY_EXECUTED,
        PRODUCTION_BOUNDARY_INHIBITED,
    ):
        raise ValueError(
            f"production boundary {ordinal} must be exactly executed xor inhibited"
        )
    if (
        value & PRODUCTION_BOUNDARY_HALTED
        and activity != PRODUCTION_BOUNDARY_EXECUTED
    ):
        raise ValueError(
            f"production boundary {ordinal} cannot be both inhibited and halted"
        )
    result = (
        trace.BOUNDARY_EXECUTED
        if activity == PRODUCTION_BOUNDARY_EXECUTED
        else trace.BOUNDARY_INHIBITED
    )
    if value & PRODUCTION_BOUNDARY_HALTED:
        result |= trace.BOUNDARY_HALT
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Compare a CADR-WEB headless witness with a CDRTRC1 oracle "
            "selected by its frozen identity bundle and profile."
        )
    )
    parser.add_argument("oracle", type=Path)
    parser.add_argument("production", type=Path)
    parser.add_argument(
        "--expected-identity-bundle",
        required=True,
        type=sha256_argument,
        metavar="SHA256",
        help="required SHA-256 identity bundle of the selected oracle target",
    )
    parser.add_argument(
        "--expected-profile-sha256",
        required=True,
        type=sha256_argument,
        metavar="SHA256",
        help="required SHA-256 profile identity of the selected oracle target",
    )
    parser.add_argument(
        "--expected-boundaries",
        required=True,
        type=positive_integer_argument,
        help="required boundary count for the selected bounded-prefix gate",
    )
    args = parser.parse_args()

    try:
        production = production_boundaries(args.production)
        parsed = trace.parse_trace(
            args.oracle.read_bytes(),
            expected_identity_bundle=args.expected_identity_bundle,
            expected_profile_sha256=args.expected_profile_sha256,
        )
    except (OSError, ValueError, trace.TraceError) as error:
        print(f"comparison rejected: {error}", file=sys.stderr)
        return 1

    records = parsed["records"]
    external_events = [
        record for record in records if record.kind == trace.KIND_EXTERNAL_EVENT
    ]
    if external_events:
        print("comparison rejected: selected C-M1 trace contains an external event",
              file=sys.stderr)
        return 1
    terminals = [record for record in records if record.kind == trace.KIND_TERMINAL]
    boundaries = [
        record for record in records if record.kind == trace.KIND_BOUNDARY_HASH
    ]
    if len(terminals) != 1:
        print("comparison rejected: selected C-M1 trace must have exactly one terminal",
              file=sys.stderr)
        return 1
    if (
        parsed["terminal_status"] != trace.TERMINAL_COMPLETE
        or parsed["terminal_reason"] != trace.TERMINAL_REASON_COMPLETE_LIMIT
    ):
        print(
            "comparison rejected: selected C-M1 trace must terminate "
            "TERMINAL_COMPLETE/COMPLETE_LIMIT",
            file=sys.stderr,
        )
        return 1
    if len(production) != args.expected_boundaries:
        print(
            f"production has {len(production)}, expected "
            f"{args.expected_boundaries} boundaries",
            file=sys.stderr,
        )
        return 1
    if len(boundaries) != args.expected_boundaries:
        print(
            f"oracle has {len(boundaries)}, expected "
            f"{args.expected_boundaries} boundaries",
            file=sys.stderr,
        )
        return 1
    terminal_items = {item.type: item.value for item in terminals[0].tlvs}
    expected_final_ordinal = args.expected_boundaries - 1
    if (
        len(records) != args.expected_boundaries + 1
        or records[-1].kind != trace.KIND_TERMINAL
        or records[-2].kind != trace.KIND_BOUNDARY_HASH
        or int.from_bytes(terminal_items[1], "little")
        != args.expected_boundaries + 1
        or int.from_bytes(terminal_items[2], "little") != expected_final_ordinal
    ):
        print(
            "comparison rejected: terminal does not immediately follow the "
            "expected final boundary with the exact record count",
            file=sys.stderr,
        )
        return 1

    matched = 0
    for record in records:
        if record.kind != trace.KIND_BOUNDARY_HASH:
            continue
        items = {item.type: item.value for item in record.tlvs}
        ordinal = int.from_bytes(items[4], "little")
        if ordinal not in production:
            break
        expected_flags = int.from_bytes(items[8], "little")
        expected_flags &= ~trace.BOUNDARY_CHECKPOINT
        expected = (
            items[2].hex(),
            items[3].hex(),
            int.from_bytes(items[7], "little"),
            int.from_bytes(items[6], "little"),
            expected_flags,
        )
        actual = production[ordinal]
        try:
            actual = (*actual[:4], oracle_flags(actual[4], ordinal))
        except ValueError as error:
            print(f"comparison rejected: {error}", file=sys.stderr)
            return 1
        if actual != expected:
            print(
                f"first divergence at boundary {ordinal}\n"
                f"production={actual}\noracle={expected}",
                file=sys.stderr,
            )
            return 1
        matched += 1
    if matched != len(production):
        print("oracle ended before the production witness", file=sys.stderr)
        return 1
    if matched != args.expected_boundaries:
        print(
            f"matched {matched}, expected {args.expected_boundaries} boundaries",
            file=sys.stderr,
        )
        return 1
    print(f"matched {matched} boundaries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
