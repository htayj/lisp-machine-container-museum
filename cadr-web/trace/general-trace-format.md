---
type: Reimplementation Specification
title: CADR general trace format, version 1
description: Binary representation and validation contract for deterministic CADR-WEB M2 traces under the cadr-web-303 profile.
tags: [mit-cadr, reimplementation, trace, binary-format, webassembly]
timestamp: 2026-07-28T20:15:00-04:00
---

# CADR general trace format, version 1

## Status and reconstruction claim

`CDRGTRC1` is the M2 deterministic general trace format.  It is a
machine-evidence stream, not a snapshot or guest-media format.  Its only v1
profile is `cadr-web-303`; paths, timestamps, process identifiers and host
addresses are forbidden.

This specification closes file-representation compatibility between the tracked
Python codec and a conforming CADR-WEB C producer for the exact v1 profile below.
It also defines deterministic semantic comparison for traces selected by the same
profile, artifacts, initial `CDRSTATE2`, input schedule, selectors, and events.

It does not claim that `CDRGTRC1` is a historical MIT CADR format, that it is
compatible with the M1-only `CDRTRC1` native-oracle format, that a trace is a
restorable snapshot, or that matching traces establish unselected device, timing,
or guest behavior.  Historical-source, public-API, ABI, and image compatibility
are outside this format claim.

## Normative language and evidence strata

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` have their usual
requirements meanings.  Unqualified descriptive text explains the selected
profile; explicit normative keywords define conformance.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C-SRC` | Readable current CADR-WEB source named under [Current C producer contract and evidence](#current-c-producer-contract-and-evidence) | Core value domains, state fields, and producer resource ceiling | That another build or historical emulator has identical behavior |
| `C-ABI` | Public host ABI header | Current status, operation, result, generation, and request-width meanings | Guest behavior or a stable ABI beyond the selected repository profile |
| `PY-CODEC` | Tracked Python codec | Exact encoder, decoder, CRC, semantic-hash, and rejection behavior | Correctness of an untested C producer |
| `PY-TEST` | Direct test execution of synthetic binary traces | Exercised positive, malformed, boundary, projection, and comparison cases | Preserved-machine runtime behavior outside those cases |
| `ART-NONE` | Compiled-artifact evidence not selected | No artifact claim | Any identity or behavior of a separately compiled binary |
| `DOC-NONE` | No historical manual or paper defines this new format | Avoids attributing the reconstruction to historical documentation | Historical design intent |
| `INF` | Implementation policy inferred for deterministic interchange | Extension range, comparison projection, and fail-closed limits | Historical representation |

Source and ABI evidence controls field meanings for `cadr-web-303`.  The format's
new envelope, hashing, limits, and extension rules are reconstruction policy
(`INF`).  Direct test observations (`PY-TEST`) establish only the exercised
codec bytes and failures.  A source/test disagreement MUST remain a conformance
failure; it MUST NOT be resolved by silently changing the selected profile.

## Selected profile and conformance level

| Profile | Exact target | Compatibility grain | Exclusions |
| --- | --- | --- | --- |
| `CDRGTRC1-v1/cadr-web-303` | Version-1 bytes emitted from the repository's `cadr-web-303` state, ABI, and trace producer at the commit containing this specification | File representation plus deterministic semantic comparison | Historical format, snapshot restore, cross-profile comparison, performance identity |

A conforming `V1-READ` implementation MUST reject malformed or semantically
inconsistent bytes according to this specification.  `V1-WRITE` includes
`V1-READ` and MUST emit the unique canonical encoding.  `V1-COMPARE` includes
`V1-READ` and MUST compare the selected header identity, every nonterminal
semantic record, and normalized terminal fields.  None of these levels claims
that the underlying CADR execution engine is otherwise complete.

## Format architecture and ownership

```text
CADR-WEB core state and typed events
    -> CDRGTRC1 producer
        -> binary stream
            -> validating codec
                -> deterministic renderer or semantic comparator
```

The core owns guest state and event meanings.  The producer owns canonical
serialization and CRC emission.  The codec owns fail-closed parsing and semantic
validation.  Renderers MAY project a validated stream, but MUST NOT redefine its
semantic digest.  A consumer MUST validate before rendering or comparison.

## Header

All integers are unsigned little endian.  The header is exactly 256 bytes.

| offset | size | field |
| ---: | ---: | --- |
| 0 | 8 | ASCII `CDRGTRC1` |
| 8 | 2 | version, `1` |
| 10 | 2 | header size, `256` |
| 12 | 4 | flags, zero |
| 16 | 8 | first boundary ordinal |
| 24 | 8 | exact record count, or `UINT64_MAX` while streaming |
| 32 | 8 | selector mask |
| 40 | 8 | event mask |
| 48 | 32 | selected-profile SHA-256 |
| 80 | 32 | artifact-set SHA-256 |
| 112 | 32 | initial `CDRSTATE2` SHA-256 |
| 144 | 32 | input-schedule SHA-256 |
| 176 | 32 | derived semantic seed |
| 208 | 44 | reserved, zero |
| 252 | 4 | CRC-32C of bytes 0 through 251 |

The seed is derived, not supplied: `SHA-256("CDRGHDR1\\0" || profile ||
artifact-set || initial-state || input-schedule || LE64(first-boundary) ||
LE64(selector-mask) || LE64(event-mask))`.  It binds logical selected content.
Count is excluded.  `hash-only` is a rendering of this same validated stream,
not a trace with different masks; it reports the original terminal digest.
Version 1 permits at most 1,000,000 records, including terminal.

## Producer transport admission

For the selected current C producer (`C-SRC`), a `FULL` trace start MUST reject
an undersized raw ring before it emits the INITIAL record or changes machine
state. Its `ring_record_capacity` MUST be at least
`1 + popcount(event-mask & known-slot-event-mask)`: one boundary plus one
reservation for each selected clock, interrupt, device, fault, or halt event.
The v1 known mask therefore requires capacities from one (no selected slot
events) through six (all five classes). This is an admission requirement, not a
claim that every selected event will occur in every slot.

The INITIAL record still occupies one retained `FULL` ring record. Consequently,
with the exact minimum capacity a caller may have to drain INITIAL before its
first slot preflight can reserve the complete compound slot; after that drain,
the same unchanged slot request is retryable. `HASH_ONLY` owns no raw ring and
does not use this capacity for minimum admission or backpressure (its existing
upper-bound validation still applies); the configuration field is not a
retained-record promise.

## Records

Records are variable length, 8-byte aligned, and use a fixed 48-byte envelope:
The maximum complete wire record is 16,384 bytes, matching the current C
producer's `CADR_TRACE_MAX_RECORD_BYTES`; larger records are malformed.

| offset | size | field |
| ---: | ---: | --- |
| 0 | 4 | total record length including padding and CRC |
| 4 | 2 | kind: boundary=1, event=2, terminal=3, initial=4 |
| 6 | 2 | flags |
| 8 | 8 | sequential record number, starting at zero |
| 16 | 8 | boundary ordinal (or final boundary ordinal for terminal) |
| 24 | 8 | logical guest cycle, nondecreasing |
| 32 | 8 | selector mask present in this record |
| 40 | 4 | event class (zero for boundary and terminal) |
| 44 | 4 | TLV payload length |
| 48 | variable | sorted, aligned TLVs; then zero record padding; then CRC-32C |

Each TLV is `u16 type, u16 flags, u32 length, value, zero padding to 8`.  Bit 0
of flags means required; all other bits are zero.  Types must increase strictly.
Unknown required types, unknown record kinds, nonzero reserved bytes and malformed
padding are rejected.  The codec permits unknown optional types only in the
extension range 2000--65535.

Selector bits 0--11 select, respectively, TLVs 1--12.  Their fixed little-endian
forms are: 1 micro PC (`u32 p0-before,p1-before,npc-before,opc-before,p0-after,
p1-after,npc-after,opc-after`); 2 raw/effective microinstruction (`u64,u64`, each
restricted to 48 bits); 3 A source (`u32 address,u32 value`, address 0..1023);
4 M source (`u32
kind,u32 address,u32 value,u32 valid`); 5 destination (`u32 kind,u32 address,u32
value,u32 valid`); 6 Q (`u32 before,u32 after`); 7 VMA (`u32 before,u32 after`);
8 MD (`u32 before,u32 after,u32 delayed-phase`); 9 macro location counter (`u32
before,u32 after`); 10 fault state (`u32 before,u32 after,u32 code,u32 valid`);
11 interrupt state (`u32 before,u32 after,u32 level,u32 pending`); and 12 a
normalized device transaction list (`u32 count`, followed by exactly `count`
44-byte transactions: `u32 read/write-kind,u32 address-space,u64 address,u32 value,u32
result,u32 status,u32 interrupt-before,u32 interrupt-after,u32 error-before,u32
error-after`).  A boundary's present
mask is a subset of the header selector mask and has exactly one corresponding
required selector TLV for every set bit.  Event and terminal records have zero
selector masks.

Event classes are one-bit values: clock decision=1, interrupt=2, device
transaction=4, fault=8, halt=16.  An event record has exactly one known class
which must be enabled by the header event mask, required event-code TLV 110
(`u32`), and required event bytes TLV 111.  Event TLV 112 is its derived digest:
`SHA-256("CDRGEVENT1\\0" || LE32(class) || LE32(code) || bytes)`.
There is no opaque v1 event body.  Clock code 1 has `u64 guest-tick-before,u64
guest-tick-after,u64 decision`; interrupt code 1 has `u32 before,u32 after,u32
level,u32 pending`; fault code 1 has `u32 before,u32 after,u32 code,u32 valid`;
halt code 1 has one `u32` code, exactly `CADR_STATUS_HALTED=16`.  Device code
1=request issue has `u32 operation,
u32 status,u64 generation,u64 request-id,u64 descriptor-length,sha256 descriptor,
u64 expected-completion-length`.  Codes 2=completion accepted, 3=completion
applied and 4=completion rejected each have `u32 operation,u32 result,u32 status,
u64 generation,u64 request-id,u64 payload-length,sha256 payload`.  Code 5 is the
same count-plus-normalized-transactions structure as selector 12.  The decoder
rejects any unknown class/code, length, non-boolean validity, or count mismatch.
Code 4 covers semantic rejection of an otherwise structurally recordable
completion, including stale generation, duplicate identity, wrong outstanding
identity, and a payload length that disagrees with the outstanding request.
Inputs that cannot populate the normalized event schema are outside the trace
model and do not produce code 4: an invalid ABI header or reserved field, invalid
operation/result enum, zero generation or request ID, or disagreement between the
completion record's declared length and the bytes supplied to the API.  Ring
backpressure is checked before a recordable rejection is returned; the caller
receives `NOT_READY` and may retry after draining without a guest-state mutation.
The INITIAL record does not provide an event attachment point.  Before the first
boundary, request issue and structurally recordable completion attempts therefore
return `NOT_READY` without machine mutation; the caller must execute one boundary
and retry.  HALT remains a compound-slot result and cannot be injected in this
pre-boundary state.

The v1 bus transaction crossover is exactly `cadr_bus_read32`/`cadr_bus_write32`.
`address-space=1` is its only address space and means a CADR physical word
address, limited to octal `017777777`.  Read/write is 0=read or 1=write.  On a
read, request `value` is zero and `result` is the returned raw `u32`; on a write,
`value` is the written raw `u32` and `result` is zero.  Status is exactly
`CADR_STATUS_OK=0` or `CADR_STATUS_UNIMPLEMENTED_DEVICE=13`.  Interrupt before
and after are raw 16-bit interrupt-status words.  Error before/after are 16-bit
masks containing only `XBUS_NXM=000001`, `UNIBUS_NXM=000010`, and
`UNIBUS_MAP=000040`, in any combination.

The interrupt selector and event use the same raw before/after status words.
Their upper 16 bits are zero.  Level/vector equals `after & 01774`, with no
other bits; pending is exactly `(after & 0140000) != 0`.  The named status bits
are enable `02000`, XBUS pending `040000`, UNIBUS pending `0100000`, and vector
mask `01774`.

Host request and completion operation is exactly one of the current ABI values
1 through 5.  Request/completion status is any current `cadr_status` 0 through
16.  Completion result is exactly 0=OK or 1=FAILED.  M-source kind is exactly
0=direct M-memory or 1=functional M-source, with address 0..31.  An invalid
M-source latch is all zero; a valid latch permits either kind.  Destination
kind is 0=invalid, 1=A-memory (address 0..1023), or 2=functional destination
(address 0..31).  Invalid destination requires kind/address/value all zero;
valid requires kind 1 or 2 and its matching range.  Guest fault before, after,
code, and validity are booleans.  Clock decision and all other validity/pending
fields are booleans.  Micro PCs are 14-bit.  Every known structure is unpacked
and checked; byte length alone is not validation.

Descriptor length, expected-completion length, and completion-payload length are
logical unsigned 64-bit lengths.  Their payload bytes are not embedded, only
SHA-256 identities are.  Consequently they are not capped by the 16,384-byte
wire-record ceiling, ring capacity, or host memory allocation; values through
`UINT64_MAX` are valid wire values.  The C ring and
`CADR_TRACE_MAX_RECORD_BYTES` limit producer resources and the encoded record,
not those logical lengths.

Every record has required TLVs 100 state SHA-256, 101 predecessor semantic
SHA-256, and 102 semantic SHA-256.  For every nonterminal record, canonical
semantic input is its fixed tuple `(kind, flags, boundary, cycle, selector mask,
event class)` followed by canonical encoding of every known required logical TLV
except TLV 102.  Selected detail and raw event bytes are therefore covered;
envelope padding, CRC, sequence number and extension TLVs are not.  The derived
step is `SHA-256("CDRGREC1\\0" || predecessor || tuple || canonical-TLVs)`.
The first predecessor is the header seed; every later predecessor is the prior
digest.  The terminal does **not** advance the chain: TLV 102 must equal its
predecessor, the accumulated header-plus-nonterminal digest.  Terminal TLVs also
require 120 final record count (`u64`), 121 reason (`u32`: COMPLETE_LIMIT=0,
COMPLETE_HALT=1, ABORT=2, FAILURE=3), and 122 final state SHA-256 equal to TLV
100.  It must be last; its count includes itself and agrees with an exact header.

The first record is exactly one `initial` record.  It has zero flags, selector
mask, and event class; its boundary equals the header's first-boundary field and
its logical cycle is zero; its TLV 100 equals the header's initial `CDRSTATE2`
SHA-256.  It advances the
semantic chain.  Executed/inhibited slot boundaries then use consecutive
ordinals `first-boundary+1` onward.  An event for boundary B occurs after B's
boundary record and before boundary B+1; there is no event before `initial`.
A reader maintains one constant-space order state per boundary.  Slot events may
occur at most once each and have strictly increasing positions: clock, interrupt,
device code 5 aggregate, fault, then halt.  A halt event occurs only after a
boundary carrying HALT; that halted boundary cannot carry a non-halt event.  Device
codes 1 through 4 are host request/completion lifecycle observations, not slot
events.  They may occur in source order after slot close and before the next
boundary, including request issue followed by rejected, accepted, and applied
completion observations.  The first such lifecycle event closes the boundary's
slot-event attachment point: no later clock, interrupt, code-5 aggregate, fault,
or halt event may attach to that boundary.  A reader MUST reject a duplicate,
reversed, or post-lifecycle slot event.

Terminal is last after all events and is nonmutating: its cycle MUST equal the
cycle of the immediately preceding nonterminal record (the initial record when
there are no boundaries).  The terminal still does not advance the semantic digest;
its cycle remains part of normalized terminal comparison.

Once the current C producer has emitted TERMINAL, every later slot preflight
MUST return `NOT_READY` before reserving a boundary or mutating guest state.
The terminal remains the last retained FULL record after a drain; the same
finished-state rejection applies to HASH_ONLY and does not alter its semantic
digest or record count. This check precedes event-mask selection: a later host
request or structurally valid completion receives `NOT_READY` even when DEVICE
was not selected, so neither ingress can change a sealed final state.

The exact known-type allowlist is `{100,101,102}` for initial,
`{selected 1..12,100,101,102}` for boundary,
`{100,101,102,110,111,112}` for event, and
`{100,101,102,120,121,122}` for terminal.  A known TLV in the wrong kind is
rejected.  Only nonrequired TLVs numbered 2000 or above are extensions.

Boundary flags are `EXECUTED=1`, `INHIBITED=2`, `HALT=4`, `CHECKPOINT=8`; exactly
one of EXECUTED/INHIBITED is required.  Terminal records have no flags.
COMPLETE_HALT requires HALT; COMPLETE_LIMIT requires its absence.  An inhibited
boundary omits decoded-word, A-source, M-source and destination selectors (bits
1--4), but may carry post-state selectors such as PC, Q, VMA, MD, macro-PC,
fault and interrupt.  Executed boundaries have exactly the header selector mask;
inhibited boundaries have exactly the header mask with bits 1--4 removed.  This
prevents a producer from silently treating an arbitrary subset as an equivalent
trace profile.

## Failure, abort, and recovery semantics

Validation is all-or-nothing.  A decoder MUST reject the complete input and
return no partially trusted trace when it encounters:

- bad magic, version, size, flags, reserved bytes, CRC, padding, length,
  alignment, sequence, cycle, count, or terminal placement;
- an unknown required TLV, a known TLV in the wrong record kind, a duplicate or
  unordered TLV, or a nonoptional extension below 2000;
- profile, artifact, initial-state, or input-schedule selection mismatch;
- an invalid selector/event mask, field width, enum, boolean, address, status,
  transaction count, event position/order, semantic predecessor, or semantic digest;
  or
- a missing/duplicate initial or terminal record, a nonconsecutive boundary, or
  an invalid terminal reason/final-state/HALT relationship.

Rejection MUST NOT be treated as an abbreviated successful trace.  A streaming
header count remains provisional until terminal; EOF before a valid terminal is
failure.  CRC failure is corruption detection, not authentication.  The decoder
MAY report the first failure diagnostically, but callers MUST NOT consume records
returned before it.  Recovery consists of obtaining or regenerating a complete
trace; v1 defines no in-place repair, resynchronization, or partial commit.

## Tooling

`scripts/cadr_general_trace.py` is the authoritative codec.  The renderer emits
deterministic NDJSON; `--mode full`, `hash-only`, `events`, and `range` are
projections of a validated stream.  Range requires inclusive, nonnegative
`--range START:END` with START no greater than END.  Both CLIs accept an explicit
expected initial-state SHA-256 selection and reject a mismatch.  The comparator
normalizes and compares terminal reason, state, boundary, and count in addition
to the accumulated digest; the authoritative reader has already required the
terminal cycle to equal the preceding record's cycle.
`scripts/compare-cadr-general-trace.py`
reports the first semantic divergence, not a host-dependent text diff.

## Conformance test suite

The normative executable cases are in
[`test_cadr_general_trace.py`](../../tests/test_cadr_general_trace.py).  Synthetic
fixtures contain no guest media.

| ID | Level | Setup and action | Required result |
| --- | --- | --- | --- |
| `GTRC-H01` | `V1-READ` | Round-trip exact and streaming-count headers with selected initial state | Canonical exact-count trace; initial witness and terminal agree |
| `GTRC-R01` | `V1-WRITE` | Emit initial, executed/inhibited boundaries, interleaved events, and terminal | Sequence, boundary, cycle, masks, semantic chain, and normalized terminal validate |
| `GTRC-R02` | `V1-READ` | Parse 600 boundaries with 600 interleaved events | Linear ordered validation completes with the expected final boundary/count |
| `GTRC-O01` | `V1-READ` | Exercise the one valid non-halt slot ordering, every other permutation, every slot duplicate, and code 1/4/2/3 after close | Valid lifecycle sequence accepts; duplicate, reversed, and post-lifecycle slot events reject |
| `GTRC-T01` | `V1-READ` | Encode zero, one, and multiple normalized transactions, including maximum raw read result | Exact 44-byte stride and every field domain accept |
| `GTRC-T02` | `V1-READ` | Corrupt stride, count, address-space, address, read/write normalization, status, interrupt/error before or after | Each independently malformed field is rejected |
| `GTRC-S01` | `V1-READ` | Exercise selector maxima and invalid values for A/M/destination/fault/interrupt fields | In-range semantic records accept; out-of-range self-consistent records reject |
| `GTRC-E01` | `V1-READ` | Exercise XBUS, UNIBUS, combined pending/vector, cleared vector, host operation/status/result, fault, and HALT schemas | Exact current-core meanings accept; each invalid field rejects |
| `GTRC-F01` | `V1-READ` | Truncate or corrupt CRC, semantic hash, counts, identity, kind, TLV order/allowlist, padding, or terminal | Complete trace rejects without partial success |
| `GTRC-P01` | `V1-COMPARE` | Render full/hash-only/events/range twice | Stable NDJSON byte hashes; all modes report the same validated terminal semantic digest |
| `GTRC-C01` | `V1-COMPARE` | Compare differing record semantics and terminal reason; give a terminal a cycle different from its preceding record | First semantic divergence or exact normalized terminal field is reported; the malformed terminal is rejected before comparison |

The required focused command is:

```sh
python3 -m unittest tests/test_cadr_general_trace.py tests/test_cadr_oracle_trace.py
```

The unchanged M1 oracle suite is included to prove that the new general codec
does not alter `CDRTRC1`; it does not make the formats interoperable.

## Versioning, extensions, and release deltas

Version 1 has no release delta or negotiation mechanism.  A writer MUST emit
version 1 and zero reserved fields.  A v1 reader MUST reject another version
rather than infer layout.  Optional TLVs 2000..65535 are the only v1 extension
surface; they MUST be ordered and zero-padded like other TLVs, MUST NOT use the
required flag, and do not enter the v1 semantic digest.  A required new field,
changed existing field meaning, new record kind, or semantic-hash change requires
a new format version.  Implementations SHOULD preserve optional extension bytes
when transparently relaying a trace, but comparison remains defined by v1
semantic fields.

## Known unknowns, oracle gaps, and nonclaims

- No preserved historical runtime can validate `CDRGTRC1`, because it is a new
  reconstruction format rather than a historical interface.
- Cross-language byte identity remains a C-producer conformance obligation until
  the C engine and Python codec pass the same complete binary vectors at the
  selected repository commit.
- The current conformance fixtures establish deterministic codec behavior, not
  real-time performance, maximum sustained ring throughput, or completeness of
  every later-roadmap device producer.
- Snapshot continuation identity and native-versus-WebAssembly execution
  equivalence are separate M2/M3 gates; this format does not close them.

## Current C producer contract and evidence

The v1 producer MUST use the current core meanings, not a privately invented
device taxonomy:

- [`cadr_host_api.h`](../include/cadr_host_api.h) defines `cadr_status` 0..16,
  `CADR_STATUS_HALTED`, host operations 1..5, and host results 0/1.
- [`cadr_bus_device.h`](../core/usim-port/cadr_bus_device.h) defines the three
  legal bus-error bits and the `cadr_bus_read32`/`cadr_bus_write32` crossover.
- [`bus-adaptor.c`](../core/usim-port/bus-adaptor.c) bounds its physical word
  address and returns only the two v1 transaction statuses.
- [`bus-interface.c`](../core/usim-port/bus-interface.c) defines interrupt
  enable, XBUS, UNIBUS, pending, and vector behavior.
- [`cadr_processor_memory.c`](../core/usim-port/cadr_processor_memory.c) fills
  M-source, destination, boolean fault, and raw interrupt trace latches.
- [`cadr_cpu_state.h`](../core/cadr_cpu_state.h) defines the selected
  1,024-word A-memory; `cadr_processor_memory.c` decodes its ten-bit A address.
- [`cadr_trace_state.h`](../core/cadr_trace_state.h) is the instance-owned latch
  schema consumed by the C producer.
- [`cadr_trace_engine.h`](cadr_trace_engine.h) fixes the current producer's
  16,384-byte wire-record/ring-slot ceiling.

The C producer MUST emit selector and event bytes in the exact layouts above,
including zero/invalid latch normalization.  It MUST compute semantic bytes
from those emitted values and the corresponding successful `CDRSTATE2` digest;
it cannot substitute host addresses, an enum from another device layer, or a
post-hoc textual rendering.

Last verified against the current repository source: 2026-07-27.
