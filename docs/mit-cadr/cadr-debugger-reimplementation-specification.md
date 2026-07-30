---
type: Reimplementation Specification
title: CADR-WEB-303 C-M12 debugger reimplementation specification
description: An isolated Phase 1 contract for deterministic outer-slot stepping, breakpoint stops, paused direct-array inspection, and privacy-bounded debugger evidence.
tags: [mit-cadr, cadr-web, debugger, microcode, trace, reimplementation]
timestamp: 2026-07-29T21:55:11-04:00
---

# CADR-WEB-303 C-M12 debugger reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.7/protocol-v7/C-M12-DBG-v1` is an isolated Phase 1 debugger
contract for the browser CADR reconstruction. Its reference model implements a
64-record breakpoint table, one-complete-outer-slot micro-step, a mandatory
generated/native-oracle-gated macro-step, read-only paused inspection, pure trace
filtering, and bounded canonical evidence records.

It claims semantic and selected wire-representation compatibility for those
clean-room rules only. It does not claim that ABI 1.7, protocol v7, M8/M11,
shared worker dispatch, CDRSNAP1 integration, a historical CADR debugger, a
preserved System 303 load band, or a QMLP/DMLP macro-dispatch map is implemented
or runtime-verified. In particular, changing a location counter or revisiting
QMLP is never evidence of a macro boundary.

The current implementation is intentionally isolated in
[`cadr_m12_debugger.c`](../../cadr-web/core/cadr_m12_debugger.c) and
[`cadr-m12-debugger.mjs`](../../cadr-web/wasm/cadr-m12-debugger.mjs). It does
not modify the shared ABI, worker, snapshot, or build surfaces. Integration is
conditional on the separate ABI 1.6/protocol-v6 M8/M11 work being integrated
without changing its ownership or timing contracts.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative below.

## Evidence boundary and compatibility level

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C303-DBG-SRC` | Public maintained System 303 debugger analysis | Console-debugger context and the distinction between raw control state and symbolic interpretation | This browser representation, source-to-band identity, or macro dispatch PCs |
| `TRACE-SRC` | Local trace-engine source | Existing complete-boundary trace vocabulary and a retained-output engine | A C-M12 filter or future worker routing |
| `DEC-M12` | Explicit reconstruction decision | Fixed limits, stop order, record schemas, privacy policy, isolated protocol boundary, and live-host lease safety rules | A historical algorithm or storage layout |
| `SRC-M12` | New readable Phase 1 reference source | The implemented callback, debugger/domain/lease identities, filter, and byte behavior | A shared-core integration or preserved-runtime result |
| `TEST-M12` | Synthetic C and Node tests | The listed deterministic unit cases | CADR, LM-3, or browser runtime behavior |
| `ORACLE-M12` | Open generated/native oracle obligation | Nothing until an identified control-store witness closes it | QMLP/DMLP dispatch locations or macro semantics |
| `TODO-RUNTIME-M12` | Unperformed native/Wasm runtime probe | Nothing until the named campaign runs | User-visible debugger behavior or timing |

The public System 303 console-debugger discussion is useful historical context,
but C-M12 does not copy its command language, modify control memory, or claim a
second debuggee link. See the separate
[CADR microcode, microassembler, and console debugger dossier](cadr-microcode-microassembler-and-console-debugger.md).

| Level | Includes | Reserved |
| --- | --- | --- |
| `M12-L0` | Pure C state machine, exact records, callback seam, caller-owned direct-array incarnation domain and lease, pure filters | ABI, worker, snapshot, audio, Worklet, and native runtime integration |
| `M12-L1` | `M12-L0` plus an integrated ABI 1.7/protocol-v7 adapter after M8/M11 closure | Generated/native macro oracle and snapshot adoption rules |
| `M12-L2` | `M12-L1` plus provenance-bound native and Wasm differential probes | Preserved System 303 macro semantics and historical console compatibility |
| `M12-L3` | `M12-L2` plus named CADR harness observations | Historical timing, source-interface, binary, and pixel identity |

Only `M12-L0` is implemented. The profile name identifies a target, not a claim
that the shared public ABI has already reached minor 7.

## Architecture and explicit integration obligations

```text
future ABI1.7 core complete-slot adapter
        -> C-M12 debugger state model
        -> CDRDBGSTOP1 / CDRPROV1 / CDRBUG1
        -> future protocol-v7 worker branch

generated or native dispatch oracle ----^  (mandatory for macro-step)

caller-owned incarnation domain -> debugger -> registered owner/incarnation
                                           -> read-only inspector lease
existing retained trace item -> pure C-M12 filter predicate
```

| Boundary | Present Phase 1 responsibility | Required later proof; deliberately absent now |
| --- | --- | --- |
| **CORE** | The caller supplies one callback that reports zero or one completed outer clock slot. C-M12 owns no machine object and does not make device, bus, memory, or deposit calls. | ABI 1.7 must invoke the callback only around the actual complete core boundary, retain transient 19/20 status outside durable lifecycle, and preserve M8/M11 same-boundary order. |
| **SNAPSHOT** | Debugger state and leases are outside CDRSNAP1. `CDRDBGSTOP1` is a report, not continuation state. | Decide a versioned breakpoint-configuration block, restore order, and whether restored pause increments a generation; never serialize a live pointer lease. |
| **PCM** | No PCM samples, render state, or audio queue is read or written. | An M11 bridge must prove audio events retain their documented post-slot and intra-slot order around an M12 stop. |
| **WORKLET** | The protocol reference imports neither worker nor AudioWorklet code. | A later control UI must prove pause/resume cannot race an audio consumer or cause a second device-visible event. |
| **INCARNATION** | C-M12 receives a caller-owned live-host domain; it does not allocate process-global identity state, serialize a domain, or expose a lease to JavaScript. | ABI 1.7 integration must allocate one stable domain at the host lineage that owns all debugger/owner lifetimes, serialize users of that domain, define teardown before core-array release, and keep pointer-bearing domain/debugger/owner/lease state out of CDRSNAP1 and protocol payloads. |
| **ORACLE** | `macro-step` accepts only an explicit dispatch oracle callback. A null/unavailable oracle returns `ORACLE_UNAVAILABLE`. | Generate and pin exact QMLP/DMLP macro-dispatch PC sets from a selected control-store/native witness, then cross-check native behavior. No LC-change heuristic or QMLP-visit fallback is permitted. |
| **Runtime** | Synthetic tests exercise only the model. No CADR/LM-3 or licensed Genera process was opened. | Run an isolated System 303 native/Wasm probe with identity, slot trace, source revision, clean stop, and a discriminating macro-boundary trace. |

The JavaScript module is a protocol and byte-format reference only. Its injected
`invoke` callback models a later worker-to-core seam; it cannot supply a direct
CPU array, mutable medium, screen, or input payload to a browser client.

## State model and invariants

The debugger starts paused with a nonzero generation, a current boundary
`(micro_pc, raw_lc, fault, device_request)`, zero completed slots, and an empty
table. A C-M12 operation is serialized; a callback runs while the debugger is
internally non-paused, so a reentrant inspector request cannot observe moving
state.

| Entity | State | Invariant |
| --- | --- | --- |
| Breakpoint table | 64 fixed records: `enabled`, `kind`, `value` | Disabled record is all zero; fixed index `0..63` determines precedence. |
| Boundary | pre/post micro-PC, raw LC, fault, device request | A returned completed slot changes state once; a zero completion changes none. |
| Generation | Nonzero u64 | Increments once per completed outer slot, including inhibited slots; every old inspector lease becomes stale. |
| Stop record | Last deterministic stop plus `have_stop` | Stop status is a response result, not machine lifecycle or snapshot state. |
| Suppression | One saved breakpoint index | Applies to that one record at one current pre-boundary; it then clears. |
| Debugger identity | Caller-owned self token, live lifecycle word, zero reserved word | Virgin state is validated field-by-field without reading padding. After initialization it remains at one address and is never copied, moved, or serialized. |
| Incarnation domain | Caller-owned self token, next nonzero incarnation, live lifecycle word, zero reserved word | It starts as all zero, initializes once at its stable address, is never copied/moved/reinitialized, and outlives every associated debugger, owner, and lease. The caller serializes its users. |
| Inspector owner | Debugger token, nonzero incarnation, five direct-array pointers/counts | One stable, caller-allocated owner is registered at a time and must be retired before it or its arrays cease to exist. |
| Inspector lease | Debugger token, owner token/incarnation, generation; no array pointers | Legal only while paused, generation-equal, and the exact owner incarnation remains registered; no mutation entry point exists. It has live-host-only meaning and is not serializable. |
| Trace filter | Flags plus scalar constraints | Pure predicate over an already supplied metadata record; it owns no trace item or output cursor. |

The direct inspector arrays are exactly A memory (1024 words), M memory (32),
dispatch memory (2048), PDL (1024), and micro stack (32). Before any debugger is
initialized, the caller zero-initializes and initializes one stable-address
incarnation domain. A virgin debugger accepts that valid domain. The separate
reinitialize operation accepts only a valid paused debugger with no owner and the
same domain; it cannot select another lineage. A domain self token rejects an
initialized domain that was copied or moved, and its lifecycle/reserved words are
validated before use. This is a `DEC-M12` live-host safety rule, not a historical
CADR representation and not a serialization format.

Virgin debugger validation compares every named field to its semantic zero value;
object padding is irrelevant. Initialization installs the debugger's own address
token and live lifecycle. Every later operation validates those fields before it
can follow the owner route. Thus a bytewise copy or move is invalid at its new
address, and even `lease-open` rejects such a copy before dereferencing a dangling
copied owner pointer. Owner bind records the exact validated debugger self identity;
retire, lease-open, and lease-read require that same identity.

The caller binds arrays through a stable owner object and the domain allocates the
owner incarnation monotonically. Bind validates the debugger, domain, owner, and
all five array shapes before reserving an incarnation. `UINT64_MAX` is an
unissued exhausted sentinel: bind returns the dedicated nonterminal
`INCARNATION_EXHAUSTED = 21` with the domain, debugger, and owner byte-identical.
Otherwise the reservation and publication have no later fallible path, and an
issued value is never recycled. A lease holds only debugger/owner identity,
incarnation, and generation. A read first proves the registered route, generation,
and incarnation still match and only then dereferences the owner and selected
array. Retirement clears every debugger route before zeroing the owner, so an old
lease can be checked after old owner and array storage has been freed without
dereferencing it. Rebinding the same owner address after same-address debugger
reinitialization receives a distinct domain incarnation and does not revive an old
lease. There is intentionally no bus read, memory deposit, control-memory edit, or
arbitrary address route.

## Breakpoints and deterministic stop order

| Kind | Phase | `value` interpretation |
| --- | --- | --- |
| `MICRO_PC_BEFORE` | Before a proposed slot | Exact u32 micro-PC |
| `RAW_LC_BEFORE` | Before a proposed slot | Exact u32 raw location counter |
| `CLOCK_SLOT_AFTER` | After one completed outer slot | Exact absolute u64 completed-slot count |
| `FAULT_AFTER` | After one completed outer slot | Literal `1`; matches asserted fault |
| `DEVICE_REQUEST_AFTER` | After one completed outer slot | Literal `1`; matches asserted device request |

At any pre-boundary C-M12 tests `MICRO_PC_BEFORE`, then `RAW_LC_BEFORE`; after a
complete slot it tests `CLOCK_SLOT_AFTER`, then `FAULT_AFTER`, then
`DEVICE_REQUEST_AFTER`. Within each kind it scans fixed record indices in ascending
order. The first match wins and produces `DEBUG_STOP = 19`; no later predicate is
evaluated for that operation. This kind-and-index ordering is `DEC-M12`, tested by
an intentionally lower-index fault record losing to a higher-index clock record.

`resume-one-boundary` requires the previous stop to be a breakpoint stop. It arms
only that record's index. The next pre-boundary scan skips that one index and then
clears the arm. A duplicate condition in a different record still stops. This
avoids accidental repeated stops without silently disabling an entire condition.

## Stepping contract

### Micro-step

Micro-step means **one complete outer clock slot**, not one decoded instruction,
one micro-PC change, or one location-counter change.

```text
evaluate ordered pre-breakpoints (with exactly one-record suppression)
if matched: return DEBUG_STOP, execute zero slots
call core_complete_slot(before) -> completion
if callback did not report exactly one completed slot: return NOT_READY; retain state
commit post boundary; clock_slots++, generation++, boundary_ordinal++, run_ordinal++
evaluate ordered post-breakpoints
if matched: record and return DEBUG_STOP
return OK
```

The completion contains `inhibited`. Both executed and inhibited completed slots
advance all four counters. A completion of zero is not a step and does not advance
or invalidate a lease. A callback result outside `{0,1}` completed slots or with a
nonboolean post flag is rejected before C-M12 commits state.

### Macro-step

Macro-step begins only when `dispatch_oracle(current.micro_pc)` returns YES. The
oracle is mandatory and intentionally unresolved for QMLP/DMLP in this phase. It
then repeats the micro-step core boundary, stopping after the preceding slot when
the next PC is an oracle-validated dispatch PC. Thus the next macro boundary is
reached but its slot has not executed.

```text
require oracle YES at initial PC
repeat at most 1,048,576 completed slots:
    perform the complete micro-step boundary and its breakpoint checks
    if a breakpoint stops: return DEBUG_STOP
    ask oracle about resulting PC
    if YES: return OK before executing that PC
    if UNAVAILABLE: return ORACLE_UNAVAILABLE
return LIMIT_REACHED = 20 and record a macro-limit stop
```

Zero completion returns `NOT_READY` without consuming the macro limit. If the
1,048,576th slot reaches a validated next dispatch PC it succeeds; otherwise the
hard limit returns `LIMIT_REACHED` and records exactly 1,048,576 operation slots.
Neither outcome invents a dispatch location.

## Canonical records and privacy boundary

All multi-byte fields are little-endian. Native C structure layout is never a wire
format.

### `CDRDBGSTOP1` — fixed 136 bytes

The first eleven bytes are ASCII `CDRDBGSTOP1`, byte 11 is zero, schema at 12 is
one, byte count at 16 is 136, and reserved u32s at 20 and 84 are zero.

| Offset | Field |
| ---: | --- |
| 24 | reason u32: breakpoint `1`, macro limit `2` |
| 28 | breakpoint index u32, or `0xffffffff` only for macro limit |
| 32 | debugger generation u64 |
| 40 | boundary ordinal u64 |
| 48 | absolute completed clock slot u64 |
| 56 | pre micro-PC u32 |
| 60 | pre raw LC u32 |
| 64 | post micro-PC u32 |
| 68 | post raw LC u32 |
| 72 | post fault boolean u32 |
| 76 | post device-request boolean u32 |
| 80 | post inhibited boolean u32 |
| 88 | run ordinal u64 |
| 96 | completed slots in this requested operation u64 |
| 104 | selected profile SHA-256, 32 bytes |

The parser rejects bad magic, schema, length, reserved bytes, zero generation or
profile digest, invalid reason/index pairing, and nonboolean flags. A macro-limit
record additionally requires breakpoint index `0xffffffff` and exactly 1,048,576
operation slots. It does not serialize a host pointer, raw core state, or a
writable authority.

### `CDRPROV1` — fixed 128 bytes

`CDRPROV1` binds one report to digest identities without publishing paths:

| Offset | Field |
| ---: | --- |
| 0 | ASCII magic `CDRPROV1` |
| 8 | schema u32 = 1 |
| 12 | byte count u32 = 128 |
| 16 | reserved u32 = 0 |
| 20, 24, 28 | ABI major 1, ABI minor 7, protocol 7 u32 |
| 32 | profile SHA-256 |
| 64 | core SHA-256 |
| 96 | snapshot SHA-256 |

All three digests must be nonzero. The record names no local artifact path,
browser storage key, user, host, or source payload.

### `CDRBUG1` — bounded bug report

`CDRBUG1` has a fixed 304-byte header and total size no greater than 1,048,576
bytes. The header contains only magic/schema/size, transient terminal status 19 or
20, a summary length, zero reserved bytes, a validated 136-byte `CDRDBGSTOP1`, and
a validated 128-byte `CDRPROV1`. Its sole variable tail is a printable ASCII,
path-separator-and-drive-marker-free summary. It has no field for disk bytes, raw
memory, display pixels, keyboard/pointer input, private paths, source text, trace
payload, or credentials.

The declared or supplied byte size is rejected when it exceeds 1,048,576 before
an encoder scans the summary or decodes an embedded record, and before a parser
reads or clones input bytes. Exact-size reports are accepted. Every accepted
report also satisfies these cross-record invariants: status 19 if and only if the
stop reason is breakpoint; status 20 if and only if the stop reason is macro
limit; a macro-limit stop has exactly 1,048,576 operation slots; and the stop and
provenance profile digests are byte-identical. C and JavaScript exercise the same
named negative-vector classes for status/reason disagreement, profile mismatch,
and bad macro-limit slot count.

This is a privacy guardrail for a diagnostic export, not a claim that arbitrary
free text can be proven free of all sensitive information. Integrators must choose
an appropriate summary and keep raw diagnostic material local.

## Protocol-v7 reference surface

`CadrM12ProtocolSubhandler` recognizes only a well-formed v7 positive-u32 request
ID and dispatches these isolated operations to its injected future backend:

| Operation | Exact request fields after `version`, `id`, `op` | Backend semantic action |
| --- | --- | --- |
| `debug-breakpoint-set` | `slot`, `{kind,value:u64 bigint}` | Set one validated table record |
| `debug-breakpoint-clear` | `slot` | Clear one record |
| `debug-micro-step` | none | Request one complete outer slot |
| `debug-macro-step` | none | Request oracle-gated macro step |
| `debug-resume-one-boundary` | none | Arm one-record suppression |
| `debug-trace-filter` | scalar filter | Install/query a pure metadata predicate at a later boundary |
| `debug-stop-record` | none | Retrieve a validated stop report at a later boundary |

Unknown operations return `null` to the outer worker; extra fields are rejected
before backend invocation. Every recognized response has the ordinary
`cadr-response` envelope, v7, matching ID and operation, numeric status, `ok`, and
`terminal`. `ok` is true only for status zero. The backend envelope itself is
closed to `{status,result?}` and each operation has a closed status and result
schema:

| Operation family | Permitted statuses | Success or terminal result |
| --- | --- | --- |
| Breakpoint set/clear | `0`, `2`, `9` | Canonical validated slot and, for set, breakpoint echoed from the request; backend supplies no result |
| Resume one boundary | `0`, `2`, `3` | `{suppressionArmed:true}` synthesized by the subhandler |
| Trace filter | `0`, `2` | Canonical validated filter echoed from the request |
| Micro-step | `0`, `2`, `9`, `19` | Status 0 has exactly generation, clock slot, micro-PC, and raw LC; status 19 has exactly one validated 136-byte stop |
| Macro-step | `0`, `2`, `9`, `13`, `19`, `20` | Status 0 has the same exact state; status 19/20 has exactly one validated 136-byte stop whose reason matches the status |
| Stop record | `0`, `3`, `9` | Status 0 has exactly one validated 136-byte stop |

A nonzero nonterminal response has no result. A malformed backend envelope,
extra result field, operation-inappropriate status, or terminal status/stop
mismatch is mapped to status 2 with the fixed reason `backend-response`.
Exceptions are mapped to status 2 with fixed reason `backend-rejected`; backend
messages, paths, byte payloads, and private fields are never reflected. Statuses
19 and 20 are marked `terminal: true` but are transient control outcomes, not
persisted lifecycle states. The module deliberately has no generic scheduler,
trace-output, inspector array, snapshot, PCM, worker, or Worklet operation.

## Failure and recovery

- Invalid breakpoint kind/value, table index, callback output, direct-array shape,
  nonvirgin or copied/moved debugger, virgin/live/copied/moved/reinitialized
  domain, mismatched reinitialize domain, stale lease, record byte, protocol
  field, or filter range is rejected with no partial C-M12 mutation.
- A live owner rejects debugger reinitialization without changing the debugger,
  domain, or owner. Bind validates every input before it tests reservation; at the
  `UINT64_MAX` exhaustion sentinel it returns nonterminal operation status 21 and
  leaves the domain, debugger, and owner byte-identical. Status 21 is not a
  debugger lifecycle value, a CDRBUG1 terminal status, or a protocol-v7 result
  until a future adapter explicitly maps it.
- A core callback may propagate only statuses `2`, `7` through `12`, and `14`
  through `18`; C-M12 restores its paused marker and does not fabricate a
  completion. Any other nonzero callback status, including 19 or 20, maps to
  `INVALID_ARGUMENT`. Only C-M12 breakpoint evaluation or macro-limit accounting
  can create a canonical stop and return those terminal statuses.
- `NOT_READY` from zero-slot completion is retryable and preserves current state
  and leases. A bad completion is not a retryable inferred zero slot.
- `ORACLE_UNAVAILABLE` never becomes a guessed macro step. It is a gate for the
  generated/native oracle work.
- A breakpoint `DEBUG_STOP` or macro `LIMIT_REACHED` retains only a bounded stop
  record. Resuming after a macro limit has no suppression because it was not a
  breakpoint stop.
- Any future snapshot restore must invalidate all direct-array leases even when its
  machine contents compare equal; the Phase 1 model has no restore API.

## Conformance suite

| ID | Level | Setup/action | Objective pass condition |
| --- | --- | --- | --- |
| `M12-C-01` | L0 | Two same-kind pre-PC records at indices 2 and 5 | Index 2 stops first; one-boundary suppression skips only 2 and record 5 still stops |
| `M12-C-02` | L0 | One inhibited completed callback, then zero completion | Inhibited slot increments clock/generation; zero completion returns `NOT_READY` with no mutation |
| `M12-C-03` | L0 | Bind an owner for five exact direct arrays; lease, retire, reinitialize the same debugger address/generation and domain, rebind the same owner address, then free owner and arrays under ASan | In-range read works while active; reinitialization cannot reproduce a domain incarnation; old leases remain stale; post-free reads return stale without dereference |
| `M12-C-04` | L0 | Same post boundary matches clock and fault records | `CLOCK_SLOT_AFTER` wins despite higher table index; stop records inhibited state |
| `M12-C-05` | L0 | Dispatch oracle at 100 and 103; then unavailable/null/no-next variants | Macro stops before 103, unavailable does not guess, and 1,048,576 slots return 20 |
| `M12-C-06` | L0 | Encode/decode records, exact-size and oversized CDRBUG1 inputs, shared `BUG-X01..03` vectors, callback status injection | Exact 1 MiB passes; oversized invalid pointers reject before scan/read under ASan; cross-record mismatches reject; callbacks cannot manufacture 19/20 |
| `M12-C-07` | L0 | Zero, malformed, copied, moved, and reinitialized incarnation domains; virgin debugger initialization | Only exactly initialized, stable-address live domain passes; a debugger cannot use the virgin initializer twice |
| `M12-C-08` | L0 | Attempt reinitialization with a live owner, then with a different domain; retire and reinitialize with the original domain | Both rejected paths are byte-identical; only paused, ownerless, same-domain reinitialization succeeds |
| `M12-C-09` | L0 | Initialize two debuggers with one caller-serialized domain and bind two owners without retiring the first | Both owners and leases are simultaneously live with distinct increasing incarnations; retiring the first does not disturb the second |
| `M12-C-10` | L0 | Set the valid domain next-incarnation field to `UINT64_MAX`, snapshot all three objects, then bind | Nonterminal 21; domain, debugger, and owner snapshots compare byte-identically |
| `M12-C-11` | L0 | Byte-copy live debugger A to B, retire and free A's owner/arrays, then call `lease-open(B)` under ASan | B rejects on its debugger self token before dereferencing its copied dangling owner route |
| `M12-C-12` | L0 | Poison the entire debugger representation, then set every named field to semantic virgin zero while leaving padding poisoned | Virgin initialization succeeds, proving padding bytes are not part of lifecycle validation |
| `M12-JS-01` | L0 | Serialize/parse all records, exact-size and oversized inputs, shared `BUG-X01..03` vectors | Exact 1 MiB passes; oversize rejects before getter/clone/decode; cross-record and macro-slot invariants match C |
| `M12-JS-02` | L0 | Validate filters and protocol branch against adversarial fake backends | Closed statuses/results accept canonical values; extra fields, private path/bytes, arbitrary statuses, and terminal mismatches reject without disclosure |
| `M12-JS-03` | L0 | Inspect the native C-M12 source surface from the Node suite | Domain/reinitialize/exhaustion and debugger self/lifecycle checks exist; padding-wide virgin checks, C11 atomics, and process-global incarnation allocator symbols are absent |
| `M12-CORE-01` | L1 | Integrate actual core outer-slot callback and retain trace | Every callback result maps to one real complete boundary; no debugger side channel alters core |
| `M12-ORACLE-01` | L2 | Generate candidate dispatch PC map from pinned selected artifact; compare native trace | Each macro start/end is independently established; QMLP/LC heuristics alone fail |
| `M12-RUN-01` | L3 | Isolated CADR Xvfb run with private session and provenance | Reproduce pre/post breakpoint and macro stop/limit with harness identity and clean/forced-stop result |

## Open oracle backlog and nonclaims

| ID | Setup and discriminating result | Claim closed |
| --- | --- | --- |
| `ORACLE-M12-QMLP-01` | Pin a selected generated control-store/native witness; emit candidate dispatch PCs during synthetic macro trace; compare two native runs | Exact selected QMLP/DMLP macro dispatch set |
| `ORACLE-M12-CORE-01` | Instrument future ABI adapter around one clock, one inhibited slot, and one host wait | Callback `0`/`1` completion meaning and M8/M11 ordering |
| `TODO-M12-ABI17-DOMAIN-01` | In the eventual adapter, allocate one zero-initialized domain and stable-address debugger in the core host lineage; exercise normal teardown, a same-address core/debugger reuse, copied-debugger rejection, and adapter failure after attempted owner bind | Adapter lifetime/serialization rules for noncopyable, nonserializable pointer-bearing domain, debugger, owner, and lease state |
| `TODO-M12-ABI17-STATUS-01` | Specify and test whether operation-scoped status 21 stays host-internal or receives a closed protocol response mapping | ABI1.7/protocol-v7 treatment of domain-exhaustion without mistaking it for terminal 19/20 |
| `TODO-RUNTIME-M12-01` | Start disposable System 303 CADR harness session, record artifact/source/harness identities and action trace, then stop and verify integrity | Bounded runtime debugger observation for the selected load band |

No historical console command grammar, symbolic decoding, control-memory patching,
temporary historical breakpoint behavior, source compatibility, native binary
compatibility, browser UI, source-to-band identity, exact timing, or screenshot
claim is made. There is no C-M12 application key, menu, pointer, presentation, or
Help binding inventory; it is a headless debugger service below those interfaces.

## Artifact identities and sources

| Role | Portable identity | Rights/publication boundary |
| --- | --- | --- |
| C reference model | [`cadr_m12_debugger.h`](../../cadr-web/core/cadr_m12_debugger.h) and [`cadr_m12_debugger.c`](../../cadr-web/core/cadr_m12_debugger.c) | Original tracked reconstruction code; not historical CADR source |
| Protocol/format reference | [`cadr-m12-debugger.mjs`](../../cadr-web/wasm/cadr-m12-debugger.mjs) | Original tracked reconstruction code; isolated from shared worker |
| C conformance | [`test_cadr_m12_debugger.c`](../../cadr-web/tests/test_cadr_m12_debugger.c) | Synthetic data only |
| Node conformance | [`test_cadr_m12_debugger.mjs`](../../tests/test_cadr_m12_debugger.mjs) | Synthetic data only |
| Existing trace substrate | [`cadr_trace_engine.h`](../../cadr-web/trace/cadr_trace_engine.h) | Local source witness for complete-boundary/retained-trace vocabulary; not an M12 integration claim |
| CADR debugger context | [CADR microcode, microassembler, and console debugger](cadr-microcode-microassembler-and-console-debugger.md) | Public-source and runtime-boundary analysis; no proprietary Genera payload is used here |

Last verified: 2026-07-29.
