---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.1 deterministic tracing and snapshot reimplementation specification
description: A release-bounded contract for the CADR-WEB-303 ABI 1.1 CDRGTRC1 trace and CDRSNAP1 snapshot formats, their state boundary, host hand-off rules, failure semantics, and conformance tests.
tags: [mit-cadr, lm-3, system-303, reimplementation, tracing, snapshot, webassembly]
timestamp: 2026-07-28T19:25:34-04:00
---

# CADR-WEB-303 ABI 1.1 deterministic tracing and snapshot reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303 ABI1.1` defines a new, portable observation and continuation
contract around the repository's selected System 303 execution profile. It is not a
claim that historical CADR hardware, LM-3, or `usim` shipped either format. A
conforming core emits an identity-bound `CDRGTRC1` trace and can transfer a complete
instruction-boundary continuation in `CDRSNAP1`; it can then produce the same later
semantic trace when given the same later host completions.

The closed compatibility grain is a source-defined, fixed-width ABI plus deterministic
semantic/file representation for the implemented core. It does **not** yet claim
historical save-file compatibility, a complete System 303 boot continuation, browser
or WebAssembly parity, hardware-cycle timing identity, or equivalence to any licensed
load band. The prior M1 boundary comparison is a separate, narrower execution result;
this document does not promote it to an M2 runtime result.

## Normative language

The normative language **MUST**, **MUST NOT**, and **MAY** applies to an
independent implementation of this profile. The implementation witnesses are source
evidence, not a running historical artifact.

## Profile and evidence ledger

| Code | Witness | What it establishes |
| --- | --- | --- |
| `M2-SRC` | `cadr-web/include/cadr_host_api.h`, `core/cadr_core.c`, `trace/cadr_trace_engine.[ch]` | ABI records, trace selections, record ordering, reservations, and public entry points |
| `M2-SNAP` | `cadr-web/core/cadr_snapshot.[ch]`, `core/cadr_state_v2.[ch]` | CDRSNAP1 layout, restore staging, semantic/derived-state boundary, and CDRSTATE2 |
| `M2-TEST` | `cadr-web/tests/test_cadr_{trace_engine,snapshot,state_v2,m2_public,m2_mutant_trace}.c` and `tests/test_cadr_m2_public_trace.py` | synthetic contract tests and cross-language trace parsing; not historical runtime proof |
| `M1-ORACLE` | [browser roadmap](cadr-browser-webassembly-implementation-roadmap.md#m1--define-the-portable-core-and-host-abi) | selected public `usim` prefix and production-core boundary comparison, separately recorded |
| `HIST-SRC` | pinned public System 303 and `usim` source named in the [browser roadmap](cadr-browser-webassembly-implementation-roadmap.md#status-and-reconstruction-claim) | historical execution model selected by the profile; not the new formats |
| `INF-M2` | this specification | versioned host boundary and representation policy where no historical counterpart exists |
| `TODO-RUNTIME` | named below | an experiment required before a stronger claim |

The source functions that own the contract are `cadr_machine_trace_*`,
`cadr_machine_snapshot_*`, `cadr_machine_run`, and
`cadr_machine_complete_host_request` in `core/cadr_core.c`;
`cadr_trace_engine_*` in `trace/cadr_trace_engine.c`; `cadr_snapshot_*` in
`core/cadr_snapshot.c`; and `cadr_state_v2_*` in `core/cadr_state_v2.c`.
No licensed disk, load band, world, screenshot, or extracted historical payload is
part of this page.

## Architecture and state model

One opaque `cadr_machine` owns every mutable guest and core datum. The host owns
only transient input/output byte buffers and its own storage policy. It cannot retain
a pointer into a machine, manufacture a request, or re-enter execution. Public ABI
records begin with `(abi_major, abi_minor, struct_size)` and ABI1.1 rejects unknown
reserved fields before mutation (`cadr_validate_m2_record`).

```text
host bytes -> typed completion -> queued core event -> run boundary
                                                     -> CDRSTATE2 / CDRGTRC1
core state -> CDRSNAP1 bytes -> fresh staged state -> validate -> new machine
```

This is a serialization boundary, not a host callback interface. A request observed
through `cadr_machine_next_host_request` is issued by the core. A completion is
accepted only for its exact `(operation, generation, request_id, length)` and is
copied before the call returns. Applying it is deferred to `cadr_machine_run`; the
host cannot make an arbitrary partial device write.

## CDRSTATE1 and CDRSTATE2

`CDRSTATE1` is the frozen M1 canonical boundary digest from
`cadr_boundary_digest_state`/`cadr_machine_boundary_digest`. It retains M1's
canonical mutation transcript and tree roots. ABI1.1 must neither alter its mutation
ordering nor substitute it for the broader continuation digest.

`CDRSTATE2` is SHA-256 over the tagged `CDRSTATE2` schema-1 domain in
`cadr_state_v2_digest`. It includes the M1-visible CPU, memory-map, bus,
canonical-mutation, device, artifact, event, and trace-latch continuation state,
plus thirteen Merkle roots and the queued-completion root. It is the state digest in
new trace records and is also bound into CDRSNAP1. Both digests are saved: snapshot
metadata calls them `cdrstate1_digest` and `cdrstate2_digest`.

The cache trees are derived accelerators, not independently serializable truth.
`cadr_state_v2_rebuild` recomputes them from decoded state; `cadr_state_v2_verify_cache`
compares every root and the completion root against a rebuild. A restorer MUST reject
a snapshot if rebuild changes the semantic fingerprint or leaves a trace-engine
allocation attached.

### Mutable-state inventory and derived omissions

| Family | Serialized canonical continuation | Deliberately omitted or rebuilt |
| --- | --- | --- |
| Core/artifacts | profile, lifecycle, clock slots, host-completion guard, ingress/verification flags | structure padding and all reserved fields must be zero |
| CPU | pipeline words/PCs, A/M/dispatch/PDL/microstack, ALU, delayed-MD, OA, interrupt, decoded and halt latches | no host pointers or source-file state |
| Memory | PROM, instruction store, L1/L2 maps, mapped-word metadata, every configured main-memory word | Merkle nodes are rebuilt |
| Bus/devices | guest tick, interrupt/error/map/diagnostic latches; TV mode/sync RAM/framebuffer/event sequence | renderer, browser, socket, audio, wall-clock, and host path state |
| Canonical M1 | ordinal/count/overflow, mutation SHA-256 and current ordered events | canonical tree cache is rebuilt |
| Host events | generation, request IDs, operation, typed descriptor, expected length, queued completion status/bytes, persistent status | borrowed caller buffers; `completion_bytes` is freshly allocated |
| Trace latches | instruction/event ordinal, raw/effective word, pre/post and validity latches | active trace engine, raw ring, drain cursor, record bytes, reservations, semantic chain |

The last omission is intentional: snapshotting captures the machine continuation,
not an in-flight observation subscription. Restoring yields no active CDRGTRC1
engine. Starting a new trace after restore binds a new initial CDRSTATE2 state.

## CDRGTRC1 deterministic trace contract

### Start, identity, and transport

`cadr_machine_trace_start` accepts ABI1.1 `cadr_trace_config`: first boundary,
selector and event masks, full-ring capacity, transport, and SHA-256 identities for
the selected profile, artifact set, and input schedule. The core computes the initial
CDRSTATE2; all identities and selections become immutable until finish/destroy.
Starting while a request is outstanding, a completion is queued, a trace is already
active, or state/cache validation fails is rejected.

The 256-byte little-endian header starts `CDRGTRC1`, has format version 1 and a
CRC-32C over bytes 0--251. It carries `first_boundary`, final record count (all ones
while unfinished), masks, profile/artifact/initial-state/input digests, and the
semantic seed. It has no host pathname, wall-clock timestamp, pointer, or browser
identifier.

`FULL` retains bounded complete raw records. Its capacity MUST be at least one
boundary plus one reservation for every selected slot-event class:
`1 + popcount(event-mask & known-slot-event-mask)`, hence one through six for
the current five-class mask. Start rejects a smaller full ring before emitting its
INITIAL record or changing machine state. INITIAL itself occupies one retained
record, so a caller using the exact minimum drains it before the first compound-slot
preflight and then retries unchanged. `HASH_ONLY` retains no ring and therefore
cannot stall because the host has not drained output; its capacity does not create
this minimum-admission rule. Both execute the same semantic chain, use the same
header identity, record the same count, and MUST return the same semantic digest for
the same input sequence. Draining a full ring consumes only complete records and
cannot change that digest.

### Selectors, events, and records

All record integers and TLV headers are little-endian; record envelopes contain total
length, kind, flags, ordinal, boundary, microinstruction count, payload length, and
CRC-32C. Records are eight-byte aligned. Each nonterminal record carries state,
previous-chain, and semantic-chain SHA-256 TLVs; event records also carry event code,
bytes, and their digest. The terminal carries final count, reason, and final state.

| Selector bit | Observable boundary projection |
| --- | --- |
| micro PC; decoded word | pre/post micro-PC pipeline and fetched/effective 48-bit word |
| A source; M source; destination | selected address/value/source-kind and destination kind/address/post-value |
| Q; VMA; MD; macro PC | pre/post latches, including delayed-MD phase |
| fault; interrupt | pre/post fault and interrupt status/pending/level |
| device transaction | normalized in-slot CADR physical-word reads/writes, values/results, status, and bus latches |

Selectors are a projection, not state elision: every emitted boundary is chained to
the full CDRSTATE2. On an inhibited slot, decoded-word, A-source, M-source, and
destination selections are suppressed because their latches are not valid. The valid
mask makes that absence explicit; an implementation MUST NOT report stale values.

The event mask has five one-bit classes: clock, interrupt, device, fault, and halt.
Clock carries before/after guest tick and a decision; interrupt carries before/after
u16 status, derived level and pending; fault carries before/after/code/valid; halt
carries `CADR_STATUS_HALTED`; device records request issue, completion, or an ordered
list of at most 64 in-slot transactions. Device traces bind payload SHA-256 and
length, rather than retaining host-owned input buffers.

### Compound slot ordering and backpressure

For every outer clock slot the producer MUST establish this order:

1. Trace start first rejects a FULL capacity below the complete worst-case slot
   reservation. Preflight then reserves one boundary plus one slot for every
   selected event class, leaving room for exactly one terminal record. A
   `NOT_READY` preflight makes no guest-visible mutation; a full-mode caller may
   drain and retry.
2. Before the boundary, device modules may stage valid normalized transactions.
   More than 64, staging after the boundary, or invalid transaction domains is a
   guest fault; it is not silently truncated.
3. Execute the normal core transition. Record exactly one boundary, marked executed
   or inhibited (and optionally halt/checkpoint), after the transition.
4. Close the slot in this fixed order: clock, interrupt, device list, fault, halt.
   A selected class with no event releases its reservation without a record. Each
   slot event is single-use. Device code 5 is that in-slot aggregate; codes 1--4
   instead record host request/completion lifecycle after close. Once any code 1--4
   has been recorded for a boundary, no later slot event may attach to it, although
   later lifecycle records retain their source order until the next boundary.
5. Clear reservations/staged transactions and only then open another slot or finish.

`slot_abort` is permitted only before a boundary and with no staged transaction; it
releases reservations without guest mutation. Finish fails while a compound slot is
open, a reservation exists, or the full raw ring cannot hold the terminal. A halt
slot has no simultaneous selected clock, interrupt, device, or fault event; a
`COMPLETE_HALT` terminal requires a halt boundary, and `COMPLETE_LIMIT` requires that
the final boundary not be halt.

### Termination and failures

Reasons are `COMPLETE_LIMIT`, `COMPLETE_HALT`, `ABORT`, and `FAILURE`. Terminal
finalization neither advances guest state nor advances the semantic chain; it binds
the current chain/state and makes the final count visible in the header. Its cycle
MUST exactly equal the immediately preceding nonterminal record's cycle. Starting,
preflighting, record construction, and finish reject invalid masks, invalid transport
capacity, malformed latches, bad ordering, record-limit exhaustion, and post-finish
reuse with a typed status. Once terminal is emitted, later slot preflight returns
`NOT_READY` before any reservation or guest-state mutation; FULL drains terminal as
its last retained record, while HASH_ONLY preserves the same count and semantic
digest. This rejection precedes event-mask selection, so later host request and
otherwise valid completion ingress cannot mutate a sealed trace even when DEVICE is
unselected. A post-preflight emission failure is surfaced as guest fault, not
retried as a different event ordering.

## CDRSNAP1 transfer contract

### Wire representation and versioning

`CDRSNAP1` is an internal state-transfer representation, not a host ABI record. It
starts with the eight ASCII bytes `CDRSNAP1`, format major 1/minor 0, a 264-byte
header, a directory of 64-byte entries, payload chunks, and a 32-byte whole-body
SHA-256 trailer. The header binds CADR-WEB-303 profile and artifact-set SHA-256,
CDRSTATE1, CDRSTATE2, lifecycle, artifact mask, storage binding/generation, and
slot/instruction counters. Numeric fields are little-endian.

The required chunks, in type order, are `CORE` (1), `CPU` (2), `MEMORY` (3), `BUS`
(4), `DEVICES` (5), `CANONICAL` (6), `EVENTS` (7), and `TRACE` (8). Every directory
entry includes type, required flag, nonoverlapping payload offset/length, and a
per-chunk SHA-256. Unknown optional chunks MAY be skipped; unknown required chunks,
duplicate known chunks, missing known chunks, unrecognized header flags, unsupported
format version, nonzero reserved fields, bad offsets/lengths, bad hashes, or trailing
bytes are rejected. A future incompatible encoding MUST raise the major version;
minor extension uses directory entries and required flags, never reinterpretation of
v1 bytes.

`cadr_machine_snapshot_size` gives the exact required size. `snapshot_save` writes
exactly that many bytes or returns zero `out_written` and no partial success. It
first ensures CDRSTATE2 cache validity/rebuild and computes both digests; request
records must be ABI1.1 with zero flags/reserved fields.

### Fresh atomic restore

`cadr_machine_snapshot_restore` parses into a zeroed, newly allocated machine state.
It validates the representation and internal state, records a semantic fingerprint,
rebuilds only the CDRSTATE1 and CDRSTATE2 derived cache families, re-fingerprints,
verifies both snapshot digests/profile/artifact binding, and confirms cache parity.
Only then does it allocate/publish a new opaque machine. The destination is therefore
either a usable fresh instance or no instance; failed input cannot partially mutate a
pre-existing machine.

Queued completions are continuation state. A restore with an outstanding request
preserves descriptor identity and exact expected length. A queued zero-byte
completion restores with a null byte pointer; a nonzero queued completion receives a
fresh copy. The next `run` applies it at the same core boundary. A snapshot does not
invent a host completion, replay host ownership, or preserve an active trace ring.

## Host request/completion semantics

The sole core-to-host operations are block read/write, present, audio, and network.
`cadr_machine_next_host_request` copies a descriptor only for an existing issued
request. `cadr_machine_complete_host_request` validates ABI, operation, generation,
request ID, host result, exact declared/completion byte count, and no prior queued
completion before copying input bytes. Bad or stale/duplicate/wrong completions fail
without applying the device result. `cadr_machine_run` serializes application of a
queued completion before subsequent execution; while a request remains uncompleted it
returns `WAITING_FOR_HOST` rather than executing around it.

Trace start refuses an unresolved hand-off, but CDRSNAP1 deliberately preserves one
because that is continuation state. Completion application itself participates in
the deterministic trace: source code preflights a device event before mutation and
records issue/completion identities and payload digest through
`cadr_trace_engine_record_device_*`.

## Conformance matrix

| ID | Fixture/action | Required observable |
| --- | --- | --- |
| M2-T01 | Same synthetic slot sequence in FULL and HASH_ONLY | identical semantic digest/count; hash-only drains zero raw records |
| M2-T02 | FULL with event mask zero and capacity one; INITIAL fills ring, then preflight before drain | `NOT_READY`, unchanged CDRSTATE2/slot count; draining INITIAL then retrying executes one slot |
| M2-T02a | FULL with all five slot-event classes and capacity five | start rejects the impossible compound-slot configuration before emitting INITIAL |
| M2-T03 | Clock/interrupt/device/fault/halt selections plus a code-1/4/2/3 host lifecycle | boundary then slot ordering is exactly clock, interrupt, device-code-5, fault, halt; lifecycle stays after close; duplicate, reversed, post-lifecycle, and invalid halt mixtures reject |
| M2-T04 | Exhaust record capacity or stage 65 transactions | terminal space remains reserved; failed preflight is nonmutating; transaction overflow is guest fault |
| M2-T05 | Save a queued zero/nonzero completion and restore | fresh state retains exact request/completion meaning; next run applies it once |
| M2-T06 | Mutate each serialized family and derived cache | CDRSTATE2 changes for semantic mutation; stale cache rebuild/verification detects mismatch; derived engine/ring is absent after restore |
| M2-T07 | Damage magic/version/directory/length/hash/digest/profile or a semantic field | restore returns typed failure, null output, and no partial state escapes |
| M2-T08 | Continue source and restored machine with same later completion | equivalent continuation records and semantic digest after new trace start |
| M2-T09 | Build four injected ALU, byte, jump, and dispatch mutants | each differs from baseline at its first exercised boundary |
| M2-T10 | Emit public trace and parse it with the Python reader | independently parsed header/records/digest agree with C producer |
| M2-T11 | Finish equivalent FULL and HASH_ONLY traces, then attempt one more slot | `NOT_READY`, zero public run slots, unchanged CDRSTATE2/count/digest; FULL drains terminal last and HASH_ONLY remains semantically equal |
| M2-T12 | Finish traces with DEVICE selected and unselected, then issue/complete a host request | both ingresses return `NOT_READY` before mutation; CDRSTATE2/count/digest and terminal raw record stay frozen |

`M2-TEST` proves these synthetic implementation properties only. On 2026-07-28, a
clean `make clean && make test` rebuilt the core, host tools, tests, and four
execution mutants with the repository's strict warning set and completed with exit
status zero. Its Python gate ran 14 cases: two public C-producer cross-parser cases,
11 authoritative general-format cases, and one C-engine wrapper case. Every C
machine, state, trace, snapshot, public-ABI, and mutant check passed. Both
specification audits reported zero errors and zero warnings.

The final clean native artifacts were:

| Item | Bytes | SHA-256 |
| --- | ---: | --- |
| `cadr-web/build/cadr-headless` | 160,064 | `70cdc43084879e342dcb1dcc513406c5141a70dd01ba56c602411c4a7ca7fc9a` |
| `cadr-web/build/libcadr_core.a` | 185,878 | `a47b74a144f30ca30f052616940595ff91514158839e5f741b255680253705e8` |
| `cadr-web/build/cadr-snapshot-inspect` | 159,952 | `9301c27f3bdeace96f84060af648669a9a02b6adc9413ff7b373c9f59a610172` |

The final production headless core then ran the frozen M1 command from the roadmap
for 100,000 clock slots. It reported 100,000 completed slots and 82,149 executed
microinstructions. The fail-closed comparator matched all 100,001 boundaries. The
ignored boundary witness was 20,674,527 bytes with SHA-256
`34023f108424d9f9a92621f6e70dbf034d0235d6919f7b4a307864aee3e33c90`;
the selected frozen oracle remained 24,000,792 bytes with SHA-256
`97c8dbf8d7bd0f3a896fecfdcb8161c5a2d2ad0a77b7c25d14c5091f21ecd0d5`.
This establishes that the final ABI1.1 build preserves the already bounded M1
prefix result; it does not turn the synthetic M2 tests into historical runtime or
browser evidence.

## Known unknowns, nonclaims, and preservation boundary

- **TODO-RUNTIME-M2-303:** run a disposable selected System 303/native `usim` fixture
  with a deliberately bounded device/interrupt action and compare its observable
  order to the ABI1.1 projection. This can constrain the mapping, not prove that
  System 303 used CDRGTRC1 or CDRSNAP1.
- **TODO-WASM-M2:** compile the same source to WASM and compare full and hash-only
  trace digests plus save/restore continuation against native. Until then ABI1.1 is
  native-core source/test coverage, not browser parity.
- **TODO-DEVICE-M2:** disk, tape, Chaos, color-TV, audio, and timing behaviors outside
  the exercised core prefix need their own selected-device continuation oracles.

The formats may describe and hash locally supplied artifacts but do not authorize
redistribution of disks, load bands, source payloads, or screenshots. Those remain
subject to the repository's CADR evidence and rights rules.

## Sources and verification

- `cadr-web/include/cadr_host_api.h` (ABI1.1 records, status values, selectors, and
  public trace/snapshot functions).
- `cadr-web/trace/cadr_trace_engine.[ch]` (CDRGTRC1 encoding, chain, reservations,
  ordering, transports, and drain behavior).
- `cadr-web/core/cadr_snapshot.[ch]`, `cadr_state_v2.[ch]`, and `cadr_core.c`
  (CDRSNAP1, CDRSTATE2, atomic restore, and host completion integration).
- `cadr-web/tests/` M2 sources and `tests/test_cadr_{m2_public_trace,general_trace,trace_engine}.py`
  (synthetic conformance witnesses).
- [MIT CADR System 303 browser and WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md)
  (selected profile, historical/source boundary, and M1 evidence).

Last verified: 2026-07-28. Source assertions and executable hashes are against the
clean release-candidate ABI1.1 build described above.
