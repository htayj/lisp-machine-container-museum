#!/usr/bin/env python3
"""Conservative structural audit for reconstruction specifications.

This tool checks mechanics and conspicuous omissions. It cannot establish that a
specification is accurate, complete, legally publishable, or behaviorally closed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlsplit


HEADING_RE = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$")
FRONTMATTER_KEY_RE = re.compile(r"^([A-Za-z0-9_-]+):(?:[ \t]*(.*))?$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
MACHINE_PATH_RE = re.compile(
    r"(?:/home/[A-Za-z0-9._-]+/|/Users/[A-Za-z0-9._-]+/|[A-Za-z]:\\Users\\[^\\\s]+\\)"
)
NORMATIVE_RE = re.compile(r"\b(?:MUST(?: NOT)?|SHOULD(?: NOT)?|MAY)\b")

SECTION_FAMILIES = {
    "claim/scope": ("status", "scope", "reconstruction claim", "compatibility claim", "target"),
    "profiles/levels": ("profile", "compatibility level", "conformance level", "target matrix"),
    "evidence/provenance": ("evidence", "provenance", "witness", "sources"),
    "architecture/model": ("architecture", "data model", "state model", "object model", "format", "grammar"),
    "failure/recovery": ("failure", "error", "abort", "recovery", "invalid input"),
    "conformance/oracles": ("conformance", "test suite", "verification", "comparison procedure", "oracle"),
    "unknowns/nonclaims": ("unknown", "nonclaim", "limitation", "open question", "closure probe", "todo"),
}

EVIDENCE_VOCABULARY = {
    "source": re.compile(r"\bsource(?: code)?\b", re.I),
    "artifact": re.compile(r"\b(?:compiled|binary|bytecode|firmware|world|image|capture|artifact)\b", re.I),
    "runtime": re.compile(r"\b(?:runtime|oracle|observation|observed|trace|probe)\b", re.I),
    "documentation": re.compile(r"\b(?:manual|reference documentation|paper|design report)\b", re.I),
    "inference/unknown": re.compile(r"\b(?:inferred|inference|interpretation|unknown|TODO-RUNTIME)\b", re.I),
}


@dataclass
class Finding:
    severity: str
    message: str
    line: int | None = None


@dataclass
class Audit:
    path: Path
    findings: list[Finding] = field(default_factory=list)
    todo_count: int = 0

    def error(self, message: str, line: int | None = None) -> None:
        self.findings.append(Finding("error", message, line))

    def warn(self, message: str, line: int | None = None) -> None:
        self.findings.append(Finding("warning", message, line))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="Markdown specifications to audit")
    parser.add_argument(
        "--require-frontmatter",
        action="store_true",
        help="require YAML-like frontmatter and its required keys",
    )
    parser.add_argument(
        "--frontmatter-key",
        action="append",
        default=[],
        metavar="KEY",
        help="additional required frontmatter key; repeat as needed",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="return failure when warnings are present",
    )
    return parser.parse_args()


def fence_mask(lines: list[str], audit: Audit) -> list[bool]:
    mask: list[bool] = []
    marker: str | None = None
    marker_length = 0
    opening_line = 0

    for number, line in enumerate(lines, 1):
        stripped = line.lstrip()
        match = re.match(r"(`{3,}|~{3,})", stripped)
        if marker is None:
            mask.append(False)
            if match:
                token = match.group(1)
                marker = token[0]
                marker_length = len(token)
                opening_line = number
        else:
            mask.append(True)
            if match and match.group(1)[0] == marker and len(match.group(1)) >= marker_length:
                marker = None
                marker_length = 0

    if marker is not None:
        audit.error("unclosed fenced code block", opening_line)
    return mask


def parse_frontmatter(lines: list[str], audit: Audit) -> tuple[dict[str, str], int]:
    if not lines or lines[0].strip() != "---":
        return {}, 0

    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        audit.error("frontmatter opens but has no closing delimiter", 1)
        return {}, 0

    values: dict[str, str] = {}
    for index, line in enumerate(lines[1:end], 2):
        if not line or line[0].isspace() or line.lstrip().startswith("#"):
            continue
        match = FRONTMATTER_KEY_RE.match(line)
        if not match:
            audit.warn("frontmatter line is not a simple top-level key", index)
            continue
        key, value = match.groups()
        if key in values:
            audit.error(f"duplicate frontmatter key: {key}", index)
        values[key] = (value or "").strip().strip("'\"")
    return values, end + 1


def heading_slug(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[`*_~]", "", text).strip().lower()
    text = re.sub(r"[^a-z0-9 _-]", "", text)
    return re.sub(r"[ _]+", "-", text)


def extract_link_destination(raw: str) -> str:
    value = raw.strip()
    if value.startswith("<") and ">" in value:
        return value[1 : value.index(">")]
    # An unescaped space starts the optional Markdown title. Paths containing spaces
    # must use the angle-bracket form above.
    return value.split(None, 1)[0] if value else ""


def audit_links(lines: list[str], mask: list[bool], path: Path, headings: set[str], audit: Audit) -> None:
    for number, line in enumerate(lines, 1):
        if mask[number - 1]:
            continue
        for match in LINK_RE.finditer(line):
            destination = extract_link_destination(match.group(1))
            if not destination:
                audit.error("empty Markdown link destination", number)
                continue
            parsed = urlsplit(destination)
            if parsed.scheme or destination.startswith("//"):
                continue
            local_path = unquote(parsed.path)
            fragment = unquote(parsed.fragment)
            if not local_path:
                if fragment and heading_slug(fragment) not in headings:
                    audit.error(f"fragment does not match a local heading: #{fragment}", number)
                continue
            candidate = Path(local_path)
            if not candidate.is_absolute():
                candidate = path.parent / candidate
            if not candidate.exists():
                audit.error(f"broken local link: {destination}", number)


def section_text(lines: list[str], headings: list[tuple[int, int, str]], needle: str) -> str:
    for position, (line_number, level, title) in enumerate(headings):
        if level == 2 and needle in title.lower():
            end = len(lines)
            for later_line, later_level, _ in headings[position + 1 :]:
                if later_level <= 2:
                    end = later_line - 1
                    break
            return "\n".join(lines[line_number:end])
    return ""


def audit_claim_closure(text: str, claim: str, audit: Audit) -> None:
    normalized = re.sub(r"\s+", " ", claim)
    strong_source = re.search(
        r"\b(?:claim(?:s|ed)?|guarantee(?:s|d)?|provide(?:s|d)?|target(?:s|ed)?)\b"
        r".{0,90}\b(?:exact|drop-in|unmodified)\b.{0,60}\b(?:source|API)\b",
        normalized,
        re.I,
    )
    if strong_source:
        groups = {
            "packages/namespaces": r"\b(?:package|namespace)\b",
            "complete signatures/grammars": r"\b(?:signature|lambda list|argument|macro grammar)\b",
            "return and multiple-value conventions": r"\b(?:return value|multiple value|values convention)\b",
            "conditions/errors/restarts": r"\b(?:condition|error|restart)\b",
            "module/load contracts": r"\b(?:module|load contract|load order|dependency)\b",
        }
        missing = [name for name, pattern in groups.items() if not re.search(pattern, text, re.I)]
        if missing:
            audit.warn("strong source-compatibility claim lacks closure vocabulary for " + ", ".join(missing))

    strong_binary = re.search(
        r"\b(?:claim(?:s|ed)?|guarantee(?:s|d)?|provide(?:s|d)?|target(?:s|ed)?)\b"
        r".{0,90}\b(?:binary|ABI|bytecode|image) compatibility\b",
        normalized,
        re.I,
    )
    if strong_binary:
        groups = {
            "layout/ABI": r"\b(?:layout|ABI|calling convention|object representation)\b",
            "encoding/relocation": r"\b(?:encoding|relocation|addressing)\b",
            "loader behavior": r"\b(?:loader|load contract|linker)\b",
        }
        missing = [name for name, pattern in groups.items() if not re.search(pattern, text, re.I)]
        if missing:
            audit.warn("strong binary-compatibility claim lacks closure vocabulary for " + ", ".join(missing))


def audit_file(path: Path, args: argparse.Namespace) -> Audit:
    audit = Audit(path)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        audit.error("file does not exist")
        return audit
    except UnicodeDecodeError as exc:
        audit.error(f"file is not valid UTF-8: {exc}")
        return audit
    except OSError as exc:
        audit.error(f"cannot read file: {exc}")
        return audit

    lines = text.splitlines()
    mask = fence_mask(lines, audit)
    frontmatter, frontmatter_end = parse_frontmatter(lines, audit)
    required_keys = ["type", "title", "description", "timestamp", *args.frontmatter_key]
    if args.require_frontmatter and not frontmatter:
        audit.error("required frontmatter is missing", 1)
    if frontmatter:
        for key in required_keys if args.require_frontmatter else args.frontmatter_key:
            if not frontmatter.get(key):
                audit.error(f"required frontmatter key is missing or empty: {key}", 1)
        timestamp = frontmatter.get("timestamp")
        if timestamp and "<" not in timestamp:
            try:
                dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                audit.error("frontmatter timestamp is not ISO-8601", 1)

    headings: list[tuple[int, int, str]] = []
    for number, line in enumerate(lines, 1):
        if number <= frontmatter_end or mask[number - 1]:
            continue
        match = HEADING_RE.match(line)
        if match:
            headings.append((number, len(match.group(1)), match.group(2).strip()))

    h1s = [(number, title) for number, level, title in headings if level == 1]
    if len(h1s) != 1:
        audit.error(f"expected exactly one H1, found {len(h1s)}")
    elif frontmatter.get("title") and h1s[0][1] != frontmatter["title"]:
        audit.error("frontmatter title and H1 differ", h1s[0][0])

    heading_names = [title.lower() for _, _, title in headings]
    for family, needles in SECTION_FAMILIES.items():
        if not any(any(needle in title for needle in needles) for title in heading_names):
            audit.warn(f"no heading covers structural family: {family}")

    visible_text = "\n".join(line for index, line in enumerate(lines) if not mask[index])
    declaration = re.search(r"normative language|requirements meanings|\bMUST\b.{0,100}\bSHOULD\b", visible_text, re.I | re.S)
    if NORMATIVE_RE.search(visible_text) and not declaration:
        audit.error("normative keywords appear without a normative-language declaration")
    if not NORMATIVE_RE.search(visible_text):
        audit.warn("no normative requirement keywords found")

    evidence_classes = [name for name, pattern in EVIDENCE_VOCABULARY.items() if pattern.search(visible_text)]
    if len(evidence_classes) < 3:
        audit.warn("fewer than three evidence classes are discussed: " + ", ".join(evidence_classes or ["none"]))

    claim = section_text(lines, headings, "reconstruction claim") or section_text(lines, headings, "status")
    if claim:
        if not re.search(r"\bcompatib", claim, re.I):
            audit.warn("reconstruction claim does not state a compatibility boundary")
        if not re.search(r"\b(?:does not|nonclaim|exclude|reserve|out of scope)\b", claim, re.I):
            audit.warn("reconstruction claim does not state exclusions or reserved claims")
        audit_claim_closure(visible_text, claim, audit)
    else:
        audit.warn("could not identify the reconstruction-claim section")

    for number, line in enumerate(lines, 1):
        if not mask[number - 1] and MACHINE_PATH_RE.search(line):
            audit.warn("machine-specific absolute path may leak local provenance", number)

    heading_slugs = {heading_slug(title) for _, _, title in headings}
    audit_links(lines, mask, path, heading_slugs, audit)
    audit.todo_count = len(re.findall(r"\bTODO-RUNTIME(?:-[A-Za-z0-9._-]+)?\b", visible_text))
    return audit


def print_audit(audit: Audit) -> tuple[int, int]:
    errors = sum(finding.severity == "error" for finding in audit.findings)
    warnings = sum(finding.severity == "warning" for finding in audit.findings)
    for finding in audit.findings:
        location = f":{finding.line}" if finding.line is not None else ""
        print(f"{audit.path}{location}: {finding.severity}: {finding.message}")
    status = "OK" if not audit.findings else "ISSUES"
    print(
        f"{audit.path}: {status} ({errors} errors, {warnings} warnings, "
        f"{audit.todo_count} explicit runtime obligations)"
    )
    return errors, warnings


def main() -> int:
    args = parse_args()
    error_count = 0
    warning_count = 0
    for path in args.files:
        errors, warnings = print_audit(audit_file(path, args))
        error_count += errors
        warning_count += warnings
    if error_count or (args.strict and warning_count):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
