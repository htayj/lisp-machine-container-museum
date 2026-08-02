---
type: Reimplementation Specification
title: CADR-WEB-303 C-M12 debugger reimplementation specification
description: An isolated Phase 1 contract for deterministic outer-slot stepping, breakpoint stops, paused direct-array inspection, and privacy-bounded debugger evidence.
tags: [mit-cadr, cadr-web, debugger, microcode, trace, reimplementation]
timestamp: 2026-08-02T04:23:41-04:00
---

# CADR-WEB-303 C-M12 debugger reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.10/protocol-v7/C-M12-DBG-v1` is a Phase 1 debugger contract
with a deliberately narrow integrated M12 build profile. Its reference model implements a
64-record breakpoint table, one-complete-outer-slot micro-step, a mandatory
generated/native-oracle-gated macro-step, read-only paused inspection, an installed
copied trace-filter state, and bounded canonical evidence records.

The narrow M12 profile now provides the cumulative ABI 1.10 core adapter, scalar-only
protocol-v7 worker branch, O0/O2 Wasm builds, a browser-accessible scalar-inspector
panel, and a pointer-free `CDRM12C1` breakpoint-configuration sidecar. Its adapter calls the real core exactly once for
a successful micro-step, binds the five read-only inspector arrays to the live
machine, and invalidates/rebinds that owner across machine replacement. It
recognizes only the public System 303 source labels `QMLP` (I-MEM 0164) and `DMLP`
(I-MEM 0200) as candidate macro-loop boundaries.

ABI 1.10 also closes the adapter's source-level lifetime and exhaustion boundary.
The adapter's first initialization accepts only a semantically zero, stable-address
domain/debugger/owner tuple; a byte-copied live adapter is rejected before it can
follow its copied machine pointer. Normal teardown clears the active payload but
retains that address-bound domain's monotonically increasing incarnation counter.
Consequently, an old lease remains stale even after a new owner is installed at the
same debugger and owner addresses with the same machine generation. Internal
owner-lineage exhaustion remains C-M12 status 21; direct Wasm lifecycle and snapshot
bridges map it to the preexisting public resource-exhaustion status 15, and no v7
debugger request admits 21.

The M12 direct-Wasm generic snapshot is now the `CDRM12S1` composed envelope,
which retains the frozen lower-profile `CDRSNAP1`, `CDRAUDS1`, and `CDRM12C1`
records and gives their adoption one staged publication boundary.

It claims semantic and selected wire-representation compatibility for those
clean-room rules and that narrow adapter only. It does not claim a preserved-system
or hardware observation of the selected M8/M11 order, generic protocol-v7 M9 input
continuation, AudioWorklet behavior, a historical CADR debugger,
preserved System 303 load-band behavior, or that the two source labels fully
establish historical macro-step semantics.
In particular, changing a location counter or revisiting an arbitrary PC is
never evidence of a macro boundary.

The implementation comprises the reference model
[`cadr_m12_debugger.c`](../../cadr-web/core/cadr_m12_debugger.c), machine adapter
[`cadr_m12_machine_adapter.c`](../../cadr-web/core/cadr_m12_machine_adapter.c),
and closed protocol subhandler
[`cadr-m12-debugger.mjs`](../../cadr-web/wasm/cadr-m12-debugger.mjs). It updates
the ABI, M12 Wasm build, and worker surfaces without changing their earlier
protocol branches. `CDRM12C1` is available through direct Wasm exports and closed
v7 save/restore operations. The v7 build composes M8/M9 `CDRINP1` ingress with M11
audio and M12 controls. Direct generic Wasm save/import uses `CDRM12S1`; the worker
still rejects generic protocol-v7 snapshots because the frozen M5 `CDRSNAP1` payload
does not carry M9 ingress ordering. Full M12 closure remains conditional on that M9
continuation decision and provenance-bound runtime evidence.

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative below.

## Evidence boundary and compatibility level

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C303-DBG-SRC` | Public maintained System 303 debugger analysis | Console-debugger context and the distinction between raw control state and symbolic interpretation | This browser representation or source-to-band identity |
| `C303-MACRO-SRC` | Public System 303 `uc-macrocode.lisp` plus `ucadr.sym`, checked in repository worktree `f6d3212c03e563b54b19082a97080eb697d6b060` with recorded input hashes | The named QMLP and DMLP source locations 0164 and 0200 | A selected load band's execution, all macro boundaries, or historical console behavior |
| `TRACE-SRC` | Local trace-engine source | Existing complete-boundary trace vocabulary and a retained-output engine | A C-M12 filter or future worker routing |
| `DEC-M12` | Explicit reconstruction decision | Fixed limits, stop order, record schemas, privacy policy, isolated protocol boundary, and live-host lease safety rules | A historical algorithm or storage layout |
| `SRC-M12` | New readable Phase 1 source | The implemented callback, debugger/domain/lease identities, filter, scalar ABI adapter, and byte behavior | Preserved-runtime result |
| `TEST-M12` | Strict native C and Node/Wasm tests | The listed deterministic adapter, O0/O2 export, and worker cases | CADR or LM-3 behavior |
| `TEST-M12-ABI110` | Strict native C and Node protocol tests | Stable-address teardown/reuse, copied-adapter rejection before machine access, nonmutating rebind exhaustion, direct-Wasm status mapping source, and v7 rejection of backend status 21 | A preserved CADR debugger lifetime or runtime allocation exhaustion |
| `TEST-M12-BROWSER` | Local Chromium accessibility/protocol probe using generated M12 Wasm | Keyboard activation reaches the scalar A-memory read and copied trace-filter install through the real v7 worker | System 303 boot, a historical debugger UI, selected-load-band behavior, or real diagnostic provenance |
| `ORACLE-M12` | Open generated/native oracle obligation | The source labels only; no generated/native execution witness yet | Complete macro semantics or selected-load-band timing |
| `TODO-RUNTIME-M12` | Unperformed native/Wasm runtime probe | Nothing until the named campaign runs | User-visible debugger behavior or timing |

The public System 303 console-debugger discussion is useful historical context,
but C-M12 does not copy its command language, modify control memory, or claim a
second debuggee link. See the separate
[CADR microcode, microassembler, and console debugger dossier](cadr-microcode-microassembler-and-console-debugger.md).

| Level | Includes | Reserved |
| --- | --- | --- |
| `M12-L0` | Pure C state machine, exact records, callback seam, caller-owned direct-array incarnation domain and lease, pure filters | ABI, worker, snapshot, audio, Worklet, and native runtime integration |
| `M12-L1` | `M12-L0` plus composed M8/M9/M11 ABI 1.10/protocol-v7 input/audio order, scalar browser inspector reads, `CDRM12C1` sidecar transport, and direct-Wasm `CDRM12S1` staged generic restore | Protocol-v7 M9 input continuation |
| `M12-L2` | `M12-L1` plus provenance-bound native and Wasm differential probes | Preserved System 303 macro semantics and historical console compatibility |
| `M12-L3` | `M12-L2` plus named CADR harness observations | Historical timing, source-interface, binary, and pixel identity |

`M12-L0`, the narrow cumulative ABI 1.10/protocol-v7 adapter seam, composed M8/M9/M11 input
and audio order, direct-Wasm `CDRM12C1` save/restore, and direct-Wasm composed
snapshot adoption are implemented and tested. Protocol-v7 M9 input continuation
and provenance-bound runtime evidence remain open.

## Architecture and explicit integration obligations

```text
ABI1.10 core complete-slot adapter
        -> C-M12 debugger state model
        -> CDRDBGSTOP1 / CDRPROV1 / CDRBUG1
        -> protocol-v7 worker branch

public System 303 QMLP/DMLP source labels ----^  (candidate loop map only)
generated/native execution oracle ----------------^  (still required for closure)

caller-owned incarnation domain -> debugger -> registered owner/incarnation
                                           -> read-only inspector lease
retained-trace owner -> installed copied C-M12 filter predicate
```

| Boundary | Present Phase 1 responsibility | Required later proof; deliberately absent now |
| --- | --- | --- |
| **CORE** | The adapter invokes `cadr_machine_run` with an exact one-slot budget and rejects any zero or multi-slot result. The composed profile accepts M8/M9 `CDRINP1` only at a ready boundary, then records M11 `BEEP` as post-slot; a strict native composition test fixes their distinct sequence domains and a worker test proves both v7 branches are installed. C-M12 makes no device, bus, memory, or deposit call of its own. | Compare this source-level order with a provenance-bound runtime trace. |
| **SNAPSHOT** | `CDRM12C1` serializes only profile identity, generation, and 64 breakpoint records. `CDRM12S1` places frozen `CDRSNAP1`, `CDRAUDS1`, and `CDRM12C1` payloads in that exact order and stages all three before publication. It excludes leases, live pointers, stop reports, callback state, and M9 ingress ordering. | Define a separate M9 continuation record or retain protocol-v7 generic-snapshot rejection; never serialize a live pointer lease. |
| **PCM** | No PCM samples, render state, or audio queue is read or written. | An M11 bridge must prove audio events retain their documented post-slot and intra-slot order around an M12 stop. |
| **WORKLET** | The protocol reference imports neither worker nor AudioWorklet code. | A later control UI must prove pause/resume cannot race an audio consumer or cause a second device-visible event. |
| **BROWSER PANEL** | A separately mounted, keyboard-accessible host panel issues only `debug-inspect-read` and `debug-trace-filter` requests to the v7 worker. The inspector export makes a single copied scalar record; the panel never receives a Wasm view, direct array, lease, storage capability, or raw guest bytes. | Bind this panel to a full M13/M10 artifact and run its screen-reader and private-System-303 workflows. |
| **INCARNATION** | The adapter owns one stable debugger/domain/owner tuple, never exposes a lease to JavaScript, retires the owner before a rebind, and keeps it outside CDRSNAP1/protocol data. Native conformance covers nonmutating failed first initialization and retry, normal teardown, same-address reuse with a monotonically newer owner, adversarial old-lease rejection after that reuse, copied-adapter rejection before a copied machine pointer is read, and nonmutating exhaustion preflight. | Retain a sanitizer run that covers any later allocator or ownership change. |
| **ORACLE** | `macro-step` uses the public source-defined QMLP/DMLP loop labels only; it has no LC-change, decoded-word, trap, or arbitrary-PC fallback. | Generate and pin exact dispatch behavior from a selected control-store/native witness, then cross-check native behavior. |
| **Runtime** | Native, O0/O2 Wasm, and worker tests exercise the adapter. No CADR/LM-3 or licensed Genera process was opened. | Run an isolated System 303 native/Wasm probe with identity, slot trace, source revision, clean stop, and a discriminating macro-boundary trace. |

### `CDRM12C1` breakpoint-configuration sidecar

`CDRM12C1` is exactly 1,088 bytes: the eight-byte magic, `version:u32le = 1`,
`total_bytes:u32le = 1088`, the M12 profile hash, machine event generation,
`breakpoint_count:u32le = 64`, a zero reserved word, and 64 fixed
`(enabled:u32le, kind:u32le, value:u64le)` records. It has no pointer, lease,
incarnation, pause state, callback, stop record, machine-state payload, or private
artifact reference. Restore decodes and validates all records before it copies the
table, so a malformed sidecar leaves the live debugger unchanged. The direct Wasm
exports require a caller-reserved 1,088-byte input buffer; the v7 worker reserves
that buffer internally and returns cloned sidecar bytes. This is a configuration
sidecar, not proof that a generic machine snapshot continues a paused debugger.

### `CDRM12S1` composed generic snapshot and transaction

`CDRM12S1` is an inferred, safety-corrected M12 composition record; it is not a
historical CADR format. It leaves every component byte format unchanged. Its
48-byte little-endian header contains magic `"CDRM12S1"`, `version:u32le = 1`,
`header_bytes:u32le = 48`, `total_bytes:u64le`, `cdrsnap1_bytes:u64le`,
`cdrauds1_bytes:u32le`, `cdrm12c1_bytes:u32le = 1088`, and a zero reserved
`u64le`. The three exact component payloads follow contiguously in the named
order. Lower ABI profiles continue to save and restore bare `CDRSNAP1`.

Save observes one serialized adapter boundary and writes `CDRSNAP1`, then
`CDRAUDS1`, then `CDRM12C1`; no component publication occurs during save. Restore
has this transaction contract:

1. Validate envelope version, sizes, reserved field, exact exhaustion, and bounded
   component lengths without changing live state.
2. Parse `CDRSNAP1` into a newly allocated unpublished machine.
3. Adopt and validate `CDRAUDS1` only into that machine's initially empty audio
   model, require its generation to equal the restored machine event generation,
   and create a fresh local consumer epoch.
4. Decode `CDRM12C1` against the replacement generation and preflight a
   nonrecycled inspector-owner incarnation.
5. At the commit point, retire the old inspector owner, reinitialize the debugger
   paused on the replacement boundary, bind a new owner, publish the decoded
   breakpoint table, swap the global machine, invalidate the retained audio
   cursor, and destroy the old machine.

Any envelope, core, audio, generation, configuration, or preflight failure occurs
before the commit point: the staged machine is destroyed and the live machine,
debugger configuration, inspector owner/leases, audio model, and retained cursor
remain unchanged. Incarnation exhaustion returns status 21 before retirement rather
than collapsing into a malformed-record error. After owner retirement, the preflighted tail has no permitted
failure. Success deliberately does not restore a stop record, suppression,
run ordinal, callback, lease, or old pause generation; the debugger begins paused
with the restored machine event generation, and every old inspector lease and
audio cursor is stale. Direct Wasm tests distinguish malformed pre-commit failure
from successful publication in both O0 and O2 builds. For each rejected
envelope/core/audio/config stage they byte-compare the public machine-info,
debugger state, audio status, and both pointer-free sidecars before and after
rejection. The direct-array lease is intentionally not a Wasm object; its native
adapter test separately proves that a failed preflight preserves a live lease and a
successful rebind stales it.

The JavaScript module is both the protocol/byte-format reference and the closed
v7 subhandler. Its worker backend invokes only scalar Wasm exports; it cannot
supply a direct CPU array, mutable medium, screen, or input payload to a browser
client.

### ABI 1.10 scalar inspector and browser control boundary

`cadr_wasm_m12_inspect_read(array_kind:u32, index:u32)` is the additive ABI 1.10
export. It opens and consumes a process-local inspector lease inside one
synchronous Wasm call, then writes exactly this 24-byte little-endian copy-out
record at the ordinary transient output address:

| Offset | Field |
| --- | --- |
| 0 | debugger `generation:u64` |
| 8 | requested `array_kind:u32` |
| 12 | requested `index:u32` |
| 16 | copied `value:u32` |
| 20 | reserved `u32 = 0` |

The only valid array kinds are A memory (1, 1,024 words), M memory (2, 32),
dispatch/control store (3, 2,048), PDL (4, 1,024), and micro stack (5, 32).
The worker clones the four scalar fields into the closed
`debug-inspect-read` success result and checks that request and result kinds and
indices agree. No pointer, owner token, lease, array view, byte range, or generic
address is serializable or returned. An inactive adapter returns status 9; a bad
kind/index returns 2; a changed inspection generation returns 3. The output
buffer is transient and is not a lease.

[`cadr-m12-debugger-panel.mjs`](../../cadr-web/browser/cadr-m12-debugger-panel.mjs)
is the browser-facing integration component. It accepts only a shell-owned async
operation function; it has no browser-storage, path, disk, `WebAssembly.Memory`,
or direct-worker authority. Its named controls are keyboard-reachable, status
changes use polite live output, and it displays only an eight-digit hexadecimal
scalar word. The Chromium probe mounts it with generated M12 Wasm and the real v7
worker, activates a read with the keyboard, and activates the persisted trace
filter. This is `TEST-M12-BROWSER` evidence for that host path only, **not** an
observation of a System 303 load band or the historical CADR console debugger.

The component can render only an already canonical `CDRPROV1` record. Its optional
diagnostic control accepts no free-text field: when a trusted host provides a
validated terminal stop and provenance record, it builds `CDRBUG1` with the fixed
ASCII summary `C-M12 terminal debugger outcome; raw guest content excluded`.
The fixed schema excludes raw memory, media, trace, pixels, input, local paths,
and arbitrary notes. This is a technical privacy bound, not a legal/privacy review
of a particular publication; M13's artifact-specific review and export campaign
remain required.

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
| Trace filter | Flags plus scalar constraints and one adapter-owned installed copy | Validation precedes replacement; caller mutation cannot alter the installed copy. A retained-trace owner may apply the copied predicate before exposing a record. The filter owns no trace item or output cursor and is not in `CDRM12C1`. |

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

The composed adapter extends that rule to its containing storage. Its first
initialization requires every named domain, debugger, owner, filter, machine, and
adapter field to be semantically zero; debugger padding is still ignored. It validates
the initial machine generation and complete debugger boundary before changing that
virgin storage, so an invalid initial boundary leaves it byte-identical and a corrected
retry may succeed. Before an adapter-facing operation reads `machine`, it proves that
the embedded domain and debugger self tokens point back into the containing adapter.
Thus a byte-copied live adapter rejects configuration serialization and other adapter
operations without following the copy's possibly dangling machine pointer.

`destroy` retires the owner and zeroes the debugger, owner, machine route, filter, and
adapter flags, but retains the live same-address domain and its next-incarnation
counter. Reinitialization accepts that exact reusable state and allocates the next
owner incarnation instead of restarting at one. If an old lease is presented after
the new owner is installed—even when debugger address, owner address, and machine
generation all match—the incarnation comparison returns `STALE_GENERATION` before
array access. At `UINT64_MAX`, reusable initialization returns internal status 21
without changing the retained domain or empty payload.

`cadr_m12_machine_adapter_rebind_preflight` validates the replacement boundary and
checks the unissued `UINT64_MAX` incarnation sentinel before the old owner is
retired. Both ordinary rebind and `CDRM12C1` rebind use it, so internal status 21
leaves the live adapter, owner, lease, and machine selection unchanged. The latter
two adapter functions return the C-M12 status type rather than the generic core
status type. At a direct Wasm lifecycle or composed-snapshot boundary, status 21 is
mapped to public `CADR_STATUS_NO_MEMORY = 15`; the C-M12 spelling is not an
undocumented generic ABI result.

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
generic model continues to require an explicit oracle. The integrated adapter's
only source-supported answers are YES for System 303 `QMLP` 0164 and `DMLP` 0200,
and NO for every other PC; it neither infers a third loop nor substitutes a
location-counter rule. It then repeats the micro-step core boundary, stopping after
the preceding slot when the next PC is one of those source-supported candidate
loops. Thus that candidate boundary is reached but its slot has not executed.

```text
require oracle YES at initial PC
repeat at most 1,048,576 completed slots:
    perform the complete micro-step boundary and its breakpoint checks
    if a breakpoint stops: return DEBUG_STOP
    ask oracle about resulting PC
    if YES: return OK before executing that PC
    if a supplied generic oracle is unavailable: return ORACLE_UNAVAILABLE
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
| 20, 24, 28 | ABI major 1, ABI minor 10, protocol 7 u32 |
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
| `debug-inspect-read` | `arrayKind:u32`, `index:u32` | Copy one paused A/M/dispatch/PDL/micro-stack word through the scalar ABI 1.10 export |
| `debug-micro-step` | none | Request one complete outer slot |
| `debug-macro-step` | none | Request oracle-gated macro step |
| `debug-resume-one-boundary` | none | Arm one-record suppression |
| `debug-trace-filter` | scalar filter | Install/query a pure metadata predicate at a later boundary |
| `debug-stop-record` | none | Retrieve a validated stop report at a later boundary |
| `debug-config-snapshot-save` | none | Copy exactly one pointer-free 1,088-byte `CDRM12C1` configuration record into a transient response buffer |
| `debug-config-snapshot-restore` | `snapshot:ArrayBuffer` exactly 1,088 bytes | Validate the closed `CDRM12C1` record before atomically replacing the breakpoint table; live pointer leases and machine state are not serialized or adopted |

Unknown operations return `null` to the outer worker; extra fields are rejected
before backend invocation. Every recognized response has the ordinary
`cadr-response` envelope, v7, matching ID and operation, numeric status, `ok`, and
`terminal`. `ok` is true only for status zero. The backend envelope itself is
closed to `{status,result?}` and each operation has a closed status and result
schema:

| Operation family | Permitted statuses | Success or terminal result |
| --- | --- | --- |
| Breakpoint set/clear | `0`, `2`, `9` | Canonical validated slot and, for set, breakpoint echoed from the request; backend supplies no result |
| Scalar inspector read | `0`, `2`, `3`, `9` | Status 0 has exactly `{generation:u64 bigint,arrayKind:u32,index:u32,value:u32}` correlated to the request; no lease, pointer, array, bytes, or host identity is returned |
| Resume one boundary | `0`, `2`, `3` | `{suppressionArmed:true}` synthesized by the subhandler |
| Trace filter | `0`, `2` | Canonical validated filter echoed from the request |
| Micro-step | `0`, `2`, `9`, `19` | Status 0 has exactly generation, clock slot, micro-PC, and raw LC; status 19 has exactly one validated 136-byte stop |
| Macro-step | `0`, `2`, `9`, `13`, `19`, `20` | Status 0 has the same exact state; status 19/20 has exactly one validated 136-byte stop whose reason matches the status |
| Stop record | `0`, `3`, `9` | Status 0 has exactly one validated 136-byte stop |
| Configuration snapshot save | `0`, `2`, `9` | Status 0 has exactly `result:{snapshot:ArrayBuffer}` containing one 1,088-byte `CDRM12C1`; no provenance, pointer, lease, raw memory, or private field is returned |
| Configuration snapshot restore | `0`, `2`, `9` | Status 0 has no result; malformed, wrong-generation, or semantically invalid input leaves the live breakpoint table and every lease unchanged |

A nonzero nonterminal response has no result. A malformed backend envelope,
extra result field, operation-inappropriate status, or terminal status/stop
mismatch is mapped to status 2 with the fixed reason `backend-response`.
Exceptions are mapped to status 2 with fixed reason `backend-rejected`; backend
messages, paths, byte payloads, and private fields are never reflected. Statuses
19 and 20 are marked `terminal: true` but are transient control outcomes, not
persisted lifecycle states. Status 21 is excluded from every v7 debugger-operation
set: no debugger request owns a rebind. A backend that supplies 21 is therefore an
operation-inappropriate backend response and receives the same closed status-2,
nonterminal, no-result `backend-response` envelope; it cannot be converted into a
stop or disclosed as an adapter detail. The module deliberately has no generic scheduler,
trace-output, generic array/address/byte-range, snapshot, PCM, worker, or Worklet
operation; `debug-inspect-read` is its only scalar inspector route.

## Failure and recovery

- Invalid breakpoint kind/value, table index, callback output, direct-array shape,
  nonvirgin or copied/moved debugger, virgin/live/copied/moved/reinitialized
  domain, mismatched reinitialize domain, stale lease, record byte, protocol
  field, or filter range is rejected with no partial C-M12 mutation.
- Adapter initialization validates the complete initial machine boundary before it
  initializes a virgin domain or publishes a debugger. An invalid boundary leaves
  every named adapter field unchanged, and retrying after correction is supported.
  Destroyed same-address storage retains only its valid domain and monotonic
  incarnation counter; a failed retry leaves that reusable state unchanged.
- A live owner rejects debugger reinitialization without changing the debugger,
  domain, or owner. Bind validates every input before it tests reservation; at the
  `UINT64_MAX` exhaustion sentinel it returns nonterminal operation status 21 and
  leaves the domain, debugger, and owner byte-identical. Rebind performs the same
  exhaustion check before retiring its owner. Status 21 is not a debugger lifecycle
  value, CDRBUG1 terminal status, or v7 debugger result. The direct Wasm lifecycle
  and composed-snapshot bridges map it to generic status 15 before core mutation or
  publication; a v7 debugger backend that attempts to return 21 is rejected as a
  closed status-2 backend response.
- A core callback may propagate only statuses `2`, `7` through `12`, and `14`
  through `18`; C-M12 restores its paused marker and does not fabricate a
  completion. Any other nonzero callback status, including 19 or 20, maps to
  `INVALID_ARGUMENT`. Only C-M12 breakpoint evaluation or macro-limit accounting
  can create a canonical stop and return those terminal statuses.
- `NOT_READY` from zero-slot completion is retryable and preserves current state
  and leases. A bad completion is not a retryable inferred zero slot.
- `ORACLE_UNAVAILABLE` never becomes a guessed macro step. It remains the result
  for a generic unavailable oracle; the integrated adapter instead has the closed
  two-label source map and remains gated on native execution evidence.
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
| `M12-CORE-01` | Narrow adapter seam | Strict native adapter test: pre-PC breakpoint, one successful step, direct-array read, stale lease after rebind, and QMLP source-label macro stop | A successful micro-step invokes exactly one actual core outer slot; reads remain lease-gated and rebind invalidates ownership |
| `M12-CORE-02` | Snapshot sidecar | Save/restore 64 breakpoint records; malformed kind/value/magic/length rejection | `CDRM12C1` is pointer-free and restore is atomic |
| `M12-CORE-03` | ABI 1.10 lifetime and exhaustion | In a composed M12 build, reject a zero-generation first machine and retry corrected; issue owner incarnation `UINT64_MAX-1` and immediately attempt the sentinel successor; byte-copy a live adapter and attempt a copied configuration save; preflight an exhausted rebind; destroy the original, reject an exhausted reusable initialization, then initialize the same address for another machine and adversarially reuse the old lease | Failed first initialization leaves virgin storage byte-identical; `UINT64_MAX-1` is issued exactly once and the immediate successor leaves that owner and lease readable; the copy rejects before its machine pointer is read; every exhaustion path is nonmutating; teardown makes the old lease stale; the new owner has a greater incarnation, the new lease reads only the new machine, and the old lease remains stale after publication |
| `M12-WASM-01` | Narrow adapter seam | O0 and O2 M12 modules expose the checked scalar debugger bridge, scalar paused inspector reads, direct `CDRM12C1` save/restore, and reject inactive-machine stepping | The cumulative ABI 1.10 adapter has no JavaScript pointer or array lease route |
| `M12-WASM-02` | Composed snapshot transaction | Build a public synthetic `CDRM12S1`; independently corrupt its reserved header and each of the `CDRSNAP1`, `CDRAUDS1`, and `CDRM12C1` stages; then repair and import it in O0 and O2 modules | Every pre-commit failure preserves machine/debugger/audio state and both sidecars byte-for-byte; the native adapter separately preserves its live lease. Success publishes the saved breakpoint only after core/audio staging and later save emits `CDRM12S1` |
| `M12-WORKER-01` | Narrow adapter seam | Protocol-v7 worker test drives breakpoint/stop/resume/filter/micro/macro requests through a real M12 Wasm module | The installed v7 branch preserves the earlier worker branches and returns closed result shapes |
| `M12-BROWSER-01` | Browser accessibility seam | Serve only the generated M12 Wasm and required browser/worker modules under a restrictive same-origin CSP; keyboard-focus Read word at A[0], then keyboard-focus Apply trace filter | The real browser worker returns one copied scalar word and accepts the installed filter without a Wasm memory/lease/storage capability crossing the UI boundary |
| `M12-ORACLE-01` | L2 | Generate candidate dispatch PC map from pinned selected artifact; compare native trace | Each macro start/end is independently established; QMLP/LC heuristics alone fail |
| `M12-RUN-01` | L3 | Isolated CADR Xvfb run with private session and provenance | Reproduce pre/post breakpoint and macro stop/limit with harness identity and clean/forced-stop result |

## Open oracle backlog and nonclaims

| ID | Setup and discriminating result | Claim closed |
| --- | --- | --- |
| `ORACLE-M12-QMLP-01` | Run the prepared, compile-verified disposable public-usim witness and retain its canonical candidate-loop record; compare a discriminating selected-load-band trace | Exact selected QMLP/DMLP macro dispatch set; preparation/build alone has not run it |
| `ORACLE-M12-CORE-01` | Instrument the composed adapter around one clock, one inhibited slot, and one host wait | Callback `0`/`1` completion meaning and source-level ordering comparison |
| `TODO-RUNTIME-M12-01` | Start disposable System 303 CADR harness session, record artifact/source/harness identities and action trace, then stop and verify integrity | Bounded runtime debugger observation for the selected load band |

No historical console command grammar, symbolic decoding, control-memory patching,
temporary historical breakpoint behavior, source compatibility, native binary
compatibility, source-to-band identity, exact timing, or screenshot claim is made.
The browser panel is a modern accessible host control, not a historical UI, and has
no CADR application key, menu, pointer, presentation, or Help binding inventory.

After the separately running M6 benchmark has released the private-runtime slot,
the following exact native-capture form may collect the public-usim candidate-loop
witness. It was not run for this work. Replace only the bracketed private-runtime
path and date/session fields; use a fresh empty 0700 output directory under
`build/cadr-oracle/` and current-owner regular non-symlink configuration and private
disk files within a 0700 runtime.

```sh
python3 scripts/cadr-m12-native-debugger-oracle.py native-capture \
  --prepared build/cadr-oracle/m12-debugger-witness-campaign-20260729-v2 \
  --config <private-runtime>/usim.ini \
  --private-runtime <private-runtime> \
  --private-disk <private-runtime>/disk-sys-303-0.img \
  --output build/cadr-oracle/m12-runtime-YYYYMMDD \
  --session-id m12-YYYYMMDD-1 --candidate-pause-resume --execute
```

The entrypoint requires explicit `--execute`, makes a fresh executable copy beneath
the output directory, clears ambient locale/timezone state, and rejects an altered
private disk or a missing/non-real witness. `--candidate-pause-resume` is M12-only:
it writes a private 0600 control file, waits for the hook's candidate-loop
`candidate-pause-enter` record, writes `resume`, and requires the matching
`candidate-pause-resume` record. This is a controlled witness pause/resume at a
source-named candidate loop, **not** historical CADR debugger behavior. A successful
metadata record hashes the public closure/patch/executable, private configuration
and disk before/after, witness and logs; records the portable toolchain and ordered
actions; and retains clean versus forced-stop state. It does not prepare private
runtime artifacts; the project runtime-preparation policy remains a prerequisite.
A refused or invalid capture exits nonzero.

## Artifact identities and sources

| Role | Portable identity | Rights/publication boundary |
| --- | --- | --- |
| C reference model and adapter | [`cadr_m12_debugger.h`](../../cadr-web/core/cadr_m12_debugger.h), [`cadr_m12_debugger.c`](../../cadr-web/core/cadr_m12_debugger.c), and [`cadr_m12_machine_adapter.c`](../../cadr-web/core/cadr_m12_machine_adapter.c) | Original tracked reconstruction code, including `CDRM12C1`; not historical CADR source |
| Protocol/format, browser panel, and worker bridge | [`cadr-m12-debugger.mjs`](../../cadr-web/wasm/cadr-m12-debugger.mjs), [`cadr-m12-debugger-panel.mjs`](../../cadr-web/browser/cadr-m12-debugger-panel.mjs), [`cadr-m12-debugger-browser.mjs`](../../cadr-web/browser/cadr-m12-debugger-browser.mjs), and [`cadr-worker.js`](../../cadr-web/wasm/cadr-worker.js) | Original tracked reconstruction code; scalar-only v7 route and modern host controls, not a historical browser API |
| C conformance | [`test_cadr_m12_debugger.c`](../../cadr-web/tests/test_cadr_m12_debugger.c) | Synthetic data only |
| Node/Wasm/browser conformance | [`test_cadr_m12_debugger.mjs`](../../tests/test_cadr_m12_debugger.mjs), [`test_cadr_m12_wasm_exports.mjs`](../../tests/test_cadr_m12_wasm_exports.mjs), [`test_cadr_m12_worker.mjs`](../../tests/test_cadr_m12_worker.mjs), and [`test_cadr_m12_debugger_browser.py`](../../tests/test_cadr_m12_debugger_browser.py) | Generated or synthetic data only; no preserved System 303 process opened |
| Native candidate-loop witness | [`cadr-m12-native-debugger-oracle.py`](../../scripts/cadr-m12-native-debugger-oracle.py), [patch](../../cadr-web/oracle/patches/0007-m12-debugger-witness.patch), and [witness](../../cadr-web/oracle/native/cadr_m12_debugger_witness.c) | Public-source-only disposable preparation/build; unrun and not a runtime claim |
| Existing trace substrate | [`cadr_trace_engine.h`](../../cadr-web/trace/cadr_trace_engine.h) | Local source witness for complete-boundary/retained-trace vocabulary; not an M12 integration claim |
| CADR debugger context | [CADR microcode, microassembler, and console debugger](cadr-microcode-microassembler-and-console-debugger.md) | Public-source and runtime-boundary analysis; no proprietary Genera payload is used here |

Last verified: 2026-07-30.
