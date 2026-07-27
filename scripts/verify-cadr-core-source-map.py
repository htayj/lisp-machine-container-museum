#!/usr/bin/env python3
"""Fail-closed validation for the CADR M1 public-usim source map."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

REQUIRED_C = set("uexec.c m32.c ucode.c machine-control.c uvmem.c main-memory.c bus-adaptor.c bus-interface.c unibus-mapping.c diagnostic-interface.c tv.c colortv.c iob.c disk-controller.c tape-controller.c uch11.c".split())
VALID = {"import", "adapt", "omit"}
FUNCTION = re.compile(r"(?ms)^[ \t]*(?:static[ \t]+)?(?:inline[ \t]+)?[A-Za-z_][A-Za-z0-9_ \t\*]*?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*?\)\s*\{")
EXPORTED_FUNCTION = re.compile(r"(?ms)^[ \t]*(?!static\b)(?:[A-Za-z_][A-Za-z0-9_]*[ \t\*]+)+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*?\)\s*\{")
IDENT = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")

def clean(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = re.sub(r"//[^\n]*", " ", text)
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))

def source_globals(text: str) -> set[str]:
    text, result, depth, statement = clean(text), set(), 0, ""
    for char in text:
        statement += char
        if char == "{": depth += 1
        elif char == "}": depth -= 1
        elif char == ";" and depth == 0:
            declaration, statement = statement.strip(), ""
            if not declaration or declaration.startswith(("typedef ", "extern ")):
                continue
            if "(" in declaration and not re.search(r"\(\s*\*\s*[A-Za-z_]", declaration):
                continue
            pointer = re.search(r"\(\s*\*\s*([A-Za-z_]\w*)\s*\)", declaration)
            names = IDENT.findall(re.sub(r"\[[^]]*\]", "", declaration.split("=", 1)[0]))
            if pointer: result.add(pointer.group(1))
            elif names and names[-1] not in {"static", "const", "struct", "union"}: result.add(names[-1])
    return result

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", type=Path, default=Path("cadr-web/core/usim-port/source-map.json"))
    parser.add_argument("--source-root", type=Path)
    parser.add_argument("--derived-root", type=Path)
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    errors: list[str] = []
    try: data = json.loads(args.map.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"cadr-core-source-map: cannot load map: {exc}", file=sys.stderr); return 1
    if data.get("schema") != "cadr-core-source-map-v2": errors.append("unexpected schema")
    if data.get("rights", {}).get("license") != "BSD-2-Clause": errors.append("BSD-2-Clause rights missing")
    rules = data.get("dispositions", {})
    if set(rules) != VALID: errors.append("dispositions must be exactly import, adapt, omit")
    for key in VALID:
        if not isinstance(rules.get(key), dict) or not rules[key].get("reason") or not rules[key].get("derived_module"):
            errors.append(f"disposition {key} lacks reason or derived_module")
    by_path: dict[str, dict] = {}
    for item in data.get("source_files", []):
        path = item.get("path") if isinstance(item, dict) else None
        if not isinstance(path, str): errors.append("malformed source file"); continue
        if path in by_path: errors.append(f"duplicate source file {path}")
        by_path[path] = item
        if not isinstance(item.get("bytes"), int) or not re.fullmatch(r"[0-9a-f]{64}", str(item.get("sha256"))):
            errors.append(f"{path}: invalid identity")
    declared = set(data.get("selected_production_c_sources", []))
    mapped = {path for path, item in by_path.items() if item.get("kind") == "production-c"}
    if declared != REQUIRED_C or mapped != REQUIRED_C: errors.append("missing or extra production C source in declared closure")
    symbols = data.get("symbols", {})
    if set(symbols) != REQUIRED_C: errors.append("symbols must cover all and only selected production C")
    flat: dict[str, dict[str, set[str]]] = {}
    for path, kinds in symbols.items():
        flat[path] = {"function": set(), "global": set()}; seen: set[str] = set()
        for kind, buckets in kinds.items():
            if kind not in {"function", "mutable_global", "immutable_global"}: errors.append(f"{path}: invalid symbol kind {kind}"); continue
            for disposition, names in buckets.items():
                if disposition not in VALID: errors.append(f"{path}: invalid disposition {disposition}"); continue
                for name in names:
                    if not isinstance(name, str) or not IDENT.fullmatch(name): errors.append(f"{path}: invalid symbol {name!r}"); continue
                    if name in seen: errors.append(f"{path}: duplicate symbol classification for {name}")
                    seen.add(name); flat[path]["function" if kind == "function" else "global"].add(name)
    copy = repo_root / "cadr-web/core/usim-port" / data.get("rights", {}).get("tracked_copy", "")
    if not copy.is_file(): errors.append("tracked COPYING.md missing")
    elif hashlib.sha256(copy.read_bytes()).hexdigest() != data.get("rights", {}).get("upstream_sha256"): errors.append("tracked COPYING.md hash mismatch")
    if args.source_root:
        for path, item in by_path.items():
            local = args.source_root / path
            if not local.is_file(): errors.append(f"missing selected source file {path}"); continue
            body = local.read_bytes()
            if len(body) != item["bytes"] or hashlib.sha256(body).hexdigest() != item["sha256"]: errors.append(f"hash or byte drift in {path}")
        upstream_copy = args.source_root / data["rights"]["upstream_path"]
        if copy.is_file() and upstream_copy.is_file() and copy.read_bytes() != upstream_copy.read_bytes(): errors.append("tracked COPYING.md differs from public source")
        for path in REQUIRED_C:
            local = args.source_root / path
            if not local.is_file() or path not in flat: continue
            text = local.read_text(encoding="utf-8")
            actual = {"function": set(FUNCTION.findall(clean(text))) - {"if", "while", "switch", "for"}, "global": source_globals(text)}
            for kind, label in (("function", "functions"), ("global", "mutable globals/tables")):
                missing, extra = actual[kind] - flat[path][kind], flat[path][kind] - actual[kind]
                if missing: errors.append(f"{path}: unaccounted top-level {label} {sorted(missing)}")
                if extra and kind == "function": errors.append(f"{path}: mapped {label} not found {sorted(extra)}")
    adapted = {
        (path, name)
        for path, kinds in symbols.items()
        for buckets in kinds.values()
        for name in buckets.get("adapt", [])
    }
    covered: set[tuple[str, str]] = set()
    records = data.get("adaptation_records", [])
    if not isinstance(records, list): errors.append("adaptation_records must be a list"); records = []
    def witness_present(witness: object) -> bool:
        if not isinstance(witness, str) or "::" not in witness: return False
        witness_path, witness_symbol = witness.split("::", 1)
        local = repo_root / witness_path
        return local.is_file() and re.search(r"\b" + re.escape(witness_symbol) + r"\b", local.read_text(encoding="utf-8")) is not None
    for record in records:
        if not isinstance(record, dict): errors.append("malformed adaptation record"); continue
        source_file = record.get("source_file")
        source_symbols = record.get("source_symbols")
        status = record.get("implementation_status")
        span = record.get("source_span")
        if source_file not in REQUIRED_C or not isinstance(source_symbols, list) or not source_symbols:
            errors.append("adaptation record has invalid source file or empty symbols"); continue
        if status not in {"implemented", "pending"}: errors.append(f"{record.get('id')}: invalid implementation status")
        if not isinstance(span, dict) or not isinstance(span.get("line_start"), int) or not isinstance(span.get("line_end"), int) or span["line_start"] < 1 or span["line_end"] < span["line_start"]:
            errors.append(f"{record.get('id')}: invalid source span")
        if not record.get("observable_mapping") or not record.get("integration_status"):
            errors.append(f"{record.get('id')}: missing observable mapping or integration status")
        if not witness_present(record.get("test_witness")):
            errors.append(f"{record.get('id')}: missing test witness")
        for name in source_symbols:
            key = (source_file, name)
            if key in covered: errors.append(f"duplicate adaptation record for {source_file}:{name}")
            covered.add(key)
        if status == "implemented":
            derived_file = record.get("intended_derived_file")
            derived_symbols = record.get("intended_derived_symbols")
            local = repo_root / derived_file if isinstance(derived_file, str) else None
            if local is None or not local.is_file() or not isinstance(derived_symbols, list) or not derived_symbols:
                errors.append(f"{record.get('id')}: implemented record lacks derived file/symbols")
            elif not set(derived_symbols) <= set(FUNCTION.findall(clean(local.read_text(encoding="utf-8")))):
                errors.append(f"{record.get('id')}: claimed derived symbol is absent")
        elif status == "pending" and record.get("integration_status") not in {"pending", "prefix-only"}:
            errors.append(f"{record.get('id')}: pending record must be pending or prefix-only")
    if covered != adapted:
        missing, extra = adapted - covered, covered - adapted
        if missing: errors.append(f"adapted upstream symbols lack records: {sorted(missing)}")
        if extra: errors.append(f"adaptation records cover non-adapted symbols: {sorted(extra)}")
    outputs = data.get("derived_outputs", {})
    derived_root = args.derived_root or repo_root / outputs.get("root", "")
    output_files = outputs.get("files", []) if isinstance(outputs, dict) else []
    output_by_path: dict[str, dict] = {}
    for item in output_files:
        path = item.get("path") if isinstance(item, dict) else None
        if not isinstance(path, str): errors.append("malformed derived output"); continue
        if path in output_by_path: errors.append(f"duplicate derived output {path}")
        output_by_path[path] = item
    actual_paths = {path.name for path in derived_root.glob("*.c")} if derived_root.is_dir() else set()
    if set(output_by_path) != actual_paths: errors.append("missing or extra derived production source")
    for path, item in output_by_path.items():
        local = derived_root / path
        if not local.is_file(): continue
        body = local.read_bytes()
        if len(body) != item.get("bytes") or hashlib.sha256(body).hexdigest() != item.get("sha256"):
            errors.append(f"derived-output drift in {path}")
        actual_exports = set(EXPORTED_FUNCTION.findall(clean(body.decode("utf-8"))))
        recorded: set[str] = set()
        for function in item.get("functions", []):
            name = function.get("symbol") if isinstance(function, dict) else None
            if not isinstance(name, str): errors.append(f"{path}: malformed derived function"); continue
            if name in recorded: errors.append(f"{path}: duplicate derived function {name}")
            recorded.add(name)
            if function.get("integration_status") not in {"integrated", "prefix-only"}:
                errors.append(f"{path}:{name}: invalid integration status")
            if not witness_present(function.get("test_witness")):
                errors.append(f"{path}:{name}: missing test witness")
        if recorded != actual_exports:
            errors.append(f"{path}: missing or extra exported derived functions")
    if errors:
        for error in errors: print("cadr-core-source-map: " + error, file=sys.stderr)
        return 1
    implemented = sum(len(record["source_symbols"]) for record in records if record.get("implementation_status") == "implemented")
    pending = sum(len(record["source_symbols"]) for record in records if record.get("implementation_status") == "pending")
    print(f"cadr-core-source-map: OK ({len(by_path)} upstream files; {len(REQUIRED_C)} production C units; {implemented} implemented; {pending} pending)")
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
