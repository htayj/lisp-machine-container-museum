#!/usr/bin/env python3
"""Render one validated CDRGTRC1 stream as deterministic NDJSON."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import cadr_general_trace as trace

def digest_argument(value: str) -> bytes:
    if re.fullmatch(r"[0-9a-fA-F]{64}",value) is None:
        raise argparse.ArgumentTypeError("expected a 64-hex-character SHA-256")
    return bytes.fromhex(value)

def range_argument(value: str) -> tuple[int,int]:
    if re.fullmatch(r"[0-9]+:[0-9]+",value) is None:
        raise argparse.ArgumentTypeError("expected nonnegative START:END")
    start,end=(int(part) for part in value.split(":"))
    if start>end: raise argparse.ArgumentTypeError("START must be <= END")
    return start,end

def main() -> int:
    p=argparse.ArgumentParser(); p.add_argument("trace",type=Path)
    p.add_argument("--mode",choices=("full","hash-only","events","range"),default="full")
    p.add_argument("--range",dest="boundary_range",type=range_argument,metavar="START:END")
    p.add_argument("--expected-initial-state-sha256",type=digest_argument,metavar="SHA256")
    a=p.parse_args()
    if (a.mode=="range") != (a.boundary_range is not None):
        p.error("--range START:END is required exactly when --mode range is selected")
    try: parsed=trace.parse_trace(a.trace.read_bytes(),expected_initial_state_sha256=a.expected_initial_state_sha256)
    except (OSError,trace.TraceError) as e: print(f"trace rejected: {e}",file=sys.stderr); return 1
    header=parsed["header"]
    print(json.dumps({"type":"header","profile_sha256":header.profile_sha256.hex(),"artifact_set_sha256":header.artifact_set_sha256.hex(),"initial_state_sha256":header.initial_state_sha256.hex(),"input_schedule_sha256":header.input_schedule_sha256.hex(),"selector_mask":header.selector_mask,"event_mask":header.event_mask,"semantic_seed":header.semantic_seed.hex()},sort_keys=True,separators=(",",":")))
    for r in parsed["records"]:
        if a.mode=="events" and r.kind!=trace.KIND_EVENT: continue
        if a.mode=="range" and not (a.boundary_range[0]<=r.boundary<=a.boundary_range[1]): continue
        item={"type":"record","kind":r.kind,"sequence":r.sequence,"boundary":r.boundary,"cycle":r.cycle,"flags":r.flags,"semantic_digest":r.semantic.hex()}
        if a.mode=="full":
            item["selector_mask"]=r.selector_mask; item["event_class"]=r.event_class
            item["tlvs"]=[{"type":x.type,"required":x.required,"hex":x.value.hex()} for x in r.tlvs]
        print(json.dumps(item,sort_keys=True,separators=(",",":")))
    terminal=parsed["terminal"]
    print(json.dumps({"type":"terminal","record_count":terminal["record_count"],"reason":terminal["reason"],"final_boundary":terminal["final_boundary"],"cycle":terminal["cycle"],"final_state_sha256":terminal["final_state_sha256"].hex(),"semantic_digest":parsed["semantic_digest"].hex()},sort_keys=True,separators=(",",":")))
    return 0
if __name__=="__main__": raise SystemExit(main())
