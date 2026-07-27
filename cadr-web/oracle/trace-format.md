# CADR native-oracle trace format, version 1

CADR trace-v1 (`CDRTRC1`) is a deterministic little-endian binary evidence
format at the native-oracle boundary. It is designed to make selected machine
boundaries, mutations, and host-supplied events auditable. It is not a disk-image
format, a checkpoint portability promise, or permission to redistribute a guest
image.

Raw traces are ignored local evidence: they can encode licensed machine state or
other unreviewed content and **must not be tracked**. Track only the codec, test
vectors containing synthetic state, and evidence-only metadata or hashes.

## File layout

All integer fields are unsigned little-endian. A trace is a 64-byte header,
records, and no trailing bytes. The header count is either the exact number of
records, including the terminal record, or `UINT64_MAX` for a streaming trace.
In the latter case the terminal record is authoritative.

| Offset | Width | Value |
| --- | ---: | --- |
| 0 | 8 | ASCII `CDRTRC1` followed by NUL |
| 8 | 2 | version `1` |
| 10 | 2 | header size `64` |
| 12 | 4 | flags, zero |
| 16 | 8 | exact record count or `UINT64_MAX` |
| 24 | 16 | first 16 bytes of the S0 identity-bundle SHA-256 |
| 40 | 20 | reserved, zero |
| 60 | 4 | CRC-32C of bytes 0 through 59 |

CRC-32C is the Castagnoli polynomial. It detects corruption; it is not a security
signature.

Each record is 8-byte aligned and has a total length of at least 40 bytes:

| Offset | Width | Value |
| --- | ---: | --- |
| 0 | 4 | total record length: header, payload, record padding, and CRC |
| 4 | 2 | record kind |
| 6 | 2 | flags, zero |
| 8 | 8 | zero-based record sequence number |
| 16 | 8 | non-decreasing logical cycle |
| 24 | 4 | payload length |
| 28 | 4 | reserved, zero |
| 32 | variable | TLV payload |
| after payload | 0–7 | zero record padding |
| final 4 | 4 | CRC-32C of the preceding bytes of this record |

The parser rejects a length below 40, a non-8-aligned length, overflow or
truncation, nonzero flags/reserved/padding, bad CRC, non-sequential numbering,
decreasing logical cycles, missing terminal, and any malformed semantic sequence.
It applies conservative 16 MiB record/payload and one-million-record limits.

## TLVs and record kinds

A payload is a sequence of aligned TLVs:

| Offset | Width | Value |
| --- | ---: | --- |
| 0 | 2 | nonzero type |
| 2 | 2 | flags: bit 0 is `critical`; all other bits are zero |
| 4 | 4 | value length |
| 8 | variable | value |
| after value | 0–7 | zero padding to an 8-byte boundary |

Types are strictly increasing and unique inside one record. Unknown noncritical
types are retained and otherwise ignored; unknown critical types are rejected.
Required TLVs have the listed widths and criticality.

| Kind | Required TLVs | Optional / extension TLVs |
| --- | --- | --- |
| 1 `boundary` | described below | S0 identity types 100–108; unknown noncritical outside that reserved range |
| 2 | reserved and rejected in v1 | none |
| 3 `external-event` | 1 critical `u32` source; 2 critical `u32` event; 3 critical arbitrary event bytes | unknown noncritical |
| 4 `terminal` | 1 critical `u64` final record count; 2 critical `u64` final boundary ordinal; 3 critical 32-byte final semantic boundary hash; 4 critical `u32` status; 5 critical `u32` reason | unknown noncritical |

Kind 2 is intentionally reserved. A checkpoint is a `boundary` record carrying
the checkpoint flag; this keeps the state/mutation boundary chain unambiguous.

## Boundary records and semantic chain

A kind-1 boundary has these required critical TLVs:

| Type | Value |
| ---: | --- |
| 1 | 32-byte predecessor semantic boundary SHA-256 |
| 2 | 32-byte canonical state SHA-256 |
| 3 | 32-byte ordered mutation SHA-256 |
| 4 | `u64` boundary ordinal |
| 5 | `u64` clock-slot ordinal; forbidden on S0 and required after it |
| 6 | `u64` first mutation ordinal |
| 7 | `u64` mutation count |
| 8 | `u32` flags |

The semantic boundary hash is intentionally separate from the file-record chain:

```text
semantic-boundary-hash = SHA-256("CDRBOUND1\\0" || canonical-boundary-TLV-payload)
```

`canonical-boundary-TLV-payload` includes each TLV header, value, and its zero
padding in the recorded order. The next boundary stores this value in type 1.
S0 (boundary ordinal zero) has an all-zero type-1 predecessor; it is the only
boundary allowed to do so.

### S0 identity contract

The first boundary must contain exactly these additional noncritical 32-byte TLVs.
They are reserved, forbidden on every other record, and ordered by their numeric
type like all other TLVs:

| Type | SHA-256 identity |
| ---: | --- |
| 100 | complete identity bundle |
| 101 | selected profile |
| 102 | unpatched source manifest |
| 103 | instrumentation patch |
| 104 | executable |
| 105 | canonical configuration |
| 106 | disk |
| 107 | prepared source tree |
| 108 | capture-input aggregate |

The bundle and header UUID are derived rather than opaque caller labels:

```text
identity-bundle =
  SHA-256("CDRIDENT1\\0" || TLV-101 || TLV-102 || ... || TLV-108)
TLV-100 = identity-bundle
header UUID = identity-bundle[0:16]
```

The parser rejects a missing, duplicate, reordered, misplaced, wrong-width, or
critical identity TLV, a component/bundle disagreement, and an unrelated header
UUID. A selected comparison must additionally supply the expected full bundle and
profile SHA-256. This external selection rejects a trace that is internally
self-consistent but belongs to another profile or build. Unknown noncritical TLVs
outside types 100 through 108 remain forward-compatible.

The flags are:

| Bit | Name | Meaning |
| ---: | --- | --- |
| 0 | `S0` | exactly the initial boundary |
| 1 | `EXECUTED` | this clock slot executed |
| 2 | `INHIBITED` | this clock slot was inhibited |
| 3 | `CHECKPOINT` | this boundary is marked as a checkpoint |
| 4 | `HALT` | this is the final halted boundary |

All reserved flag bits are zero. Boundary zero has exactly `S0`, no clock-slot
TLV, and the empty mutation range starting at zero. Every later boundary has
exactly one of `EXECUTED` and `INHIBITED`, a clock-slot ordinal equal to one less
than its boundary ordinal, and contiguous boundary and mutation ranges.

The mutation count covers only the enumerated transcript families selected by the
oracle. It is not a count of every machine-state change and is not a proof that
the canonical state stayed equal. In the pinned `uexec_step`, pipeline state,
`incNPC`, and delayed MD processing advance before the inhibit test. Consequently
an `INHIBITED` boundary can have a changed canonical state and transcript events;
an `EXECUTED` boundary with zero enumerated mutations can also have changed
processor or latch state. The parser deliberately imposes no state-hash equality
rule for either case.

This ordering was checked in `uexec.c` at the exact `usim` source identity
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`;
the companion [native-oracle design](../../docs/mit-cadr/cadr-native-instruction-oracle-design.md)
records the profile and source-provenance boundary. The claim applies to that
pinned implementation and is not inferred from the manuals.

For every zero-mutation boundary (including S0), type 3 is the fixed value:

```text
EMPTY_MUTATION_SHA256 = SHA-256("CDRMUT1\\0")
```

`HALT` may occur only on the last boundary: no later boundary or external event
is allowed.

## Terminal semantics

Terminal status is `0` complete, `1` abort, or `2` oracle failure. Its reason is
`0` complete because the guest machine halted, `1` complete because the selected
capture limit was reached, `2` aborted, or `3` oracle failure. The valid
status/reason pairs are `(complete, guest-halt)`, `(complete, limit-reached)`,
`(abort, aborted)`, and `(oracle-failure, oracle-failure)`; all other pairs are
rejected. There is exactly one terminal record and it is last. Its
`final_record_count` includes the terminal and must equal the actual record count,
whether the header was exact or streaming. An exact header count must also equal
that count.

Its final-boundary ordinal and semantic hash must equal the last boundary. An
abort/failure trace that ended before S0 uses the explicit no-boundary sentinel
`UINT64_MAX` and an all-zero final semantic hash. A complete trace must contain S0
and no external-event record. A guest-halt completion requires `HALT` on its final
boundary. A limit-reached completion instead requires no `HALT`: it represents a
successful bounded prefix while the guest machine is still running. `HALT` is
reserved for an observed guest-machine halt and cannot be inferred merely because
the native oracle stopped at its configured boundary count. An external event
makes either form of `complete` invalid even when all hashes otherwise verify.

## Outer file-record chain

The parser also reports an outer file-record chain. It is distinct from the
semantic boundary chain and binds the canonical physical record sequence:

```text
H0 = SHA-256("CDRTRC1-HDR\\0" || header[0:60])
Hi = SHA-256("CDRTRC1-REC\\0" || H(i-1) || record-without-its-CRC)
```

This outer chain is an evidence/reporting value; it must never be substituted for
the semantic predecessor stored in a boundary or the semantic hash named by the
terminal record.
