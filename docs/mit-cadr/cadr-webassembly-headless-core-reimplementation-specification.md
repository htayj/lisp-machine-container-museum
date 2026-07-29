---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.2 headless WebAssembly core reimplementation specification
description: A release-bounded contract for the CADR-WEB-303 ABI 1.2 bare WebAssembly core, dedicated-worker protocol, streamed artifact boundary, portability rules, and native/WASM differential evidence.
tags: [mit-cadr, lm-3, system-303, webassembly, reimplementation, browser, worker]
timestamp: 2026-07-29T03:30:01-04:00
---

# CADR-WEB-303 ABI 1.2 headless WebAssembly core reimplementation specification

## Status and reconstruction claim

Nonclaim: this profile reserves all historical-binary, full-boot, interactive, and
hardware-timing compatibility beyond the expressly named M3 gates.

`CADR-WEB-303/ABI1.2/M3` is a new, headless WebAssembly hosting profile for the
portable System 303 core.  It defines a reproducible bare `wasm32` module, one
dedicated-worker ownership domain, a fixed request protocol, and a native/WASM
comparison transcript.  It preserves the selected U303 microengine semantics only
to the extent proved by the M1/M2 core and this document's conformance gates.

`C-M3` is **closed** for the bounded `CADR-WEB-303/ABI1.2/M3` profile.  The release
record below proves fixed-width ABI1.2 behavior, deterministic CDRSTATE1/2/3
observation, and browser-worker transport compatibility for its declared M3
operations.  It does not claim a historical CADR binary interface, a historical browser interface,
hardware-cycle or wall-clock identity, a completed disk-controller boot, display,
input, persistence, audio, Chaos networking, or compatibility with arbitrary
System 303 media.  The selected base disk remains an excluded local import.
Those stronger compatibility claims are explicitly reserved for later milestones.

## Normative language, profile, and evidence

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` have their usual requirements meanings.
They apply to an independent implementation of this reconstruction profile, not to
the historical machine.  When source and this portable contract differ, the source
is evidence for `U303`; the stated portable rule controls `CADR-WEB-303`.

| Code | Witness | Establishes | Does not establish |
| --- | --- | --- | --- |
| `U303-SRC` | `usim` Fossil check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`, including `uexec.c` and `m32.h` | selected source-visible processor algorithm and its type-sensitive expressions | that the checked-out or running artifact has that exact check-in |
| `M1-ORACLE` | [native instruction oracle](cadr-native-instruction-oracle-design.md) | bounded native clock-slot boundary reference | browser or whole-boot behavior |
| `M2-SPEC` | [ABI1.1 trace/snapshot specification](cadr-deterministic-tracing-and-snapshot-reimplementation-specification.md) | CDRGTRC1, CDRSNAP1, CDRSTATE1/2 and fresh-restore contract | M3 transport or browser behavior |
| `M3-SRC` | `cadr-web/wasm/`, `cadr-web/core/`, `cadr-web/include/cadr_host_api.h` | current ABI1.2 code and worker protocol | a passing release gate |
| `M3-TEST` | `test_cadr_m3_conformance.c`, M3 Node/Chromium tests, transcript comparator | exercised synthetic and host-transport behavior | unexercised historical runtime paths |
| `INF-M3` | this specification | browser ownership, bounds, rejection, and reproducibility policy | a historical implementation detail |
| `M3-RELEASE-2026-07-28` | commands and aggregate identities recorded below | every C-M3 release gate passed | a later M4 media or LMFS compatibility result |

The release profile is `CADR-WEB-303`: LM-3 System 303 source check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
selected `usim` check-in
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`,
and the M0 manifest
[`cadr-web-303.json`](../../cadr-web/profiles/cadr-web-303.json).  The manifest's
base disk is `269,562,880` bytes with SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` and
is `unresolved-local-import`; it MUST NOT enter a public bundle.

| Level | Compatibility grain | Closed only when |
| --- | --- | --- |
| `M3-P0` | deterministic fixed-width core calculations | closed: U01--U05 and portability probe passed at O0 and O2 |
| `M3-P1` | portable-native/WASM CDRSTATE1+CDRSTATE2+CDRSTATE3 boundary transcript | closed: M1 regression and one-million-slot cross-target gate matched exactly |
| `M3-P2` | pinned maintained-usim/portable behavioral oracle | closed only for the selected no-media prefix: the common-scalar, physical-bus, and M4-D0 disk projections matched; request, block, and completion streams were explicitly empty |
| `M3-P3` | ABI1.2 worker/wasm transport | closed: reproducible build, Node worker, and Chromium smoke gates passed |

## Architecture, ownership, and lifecycle

```text
main-thread client -> versioned MessagePort request
                         -> one dedicated worker
                              -> one bare WebAssembly.Module instance
                                   -> one opaque cadr_machine
                                        -> CDRSTATE1 / CDRSTATE2 / CDRSTATE3
```

The main thread owns module acquisition, transferable byte buffers, and UI policy.
The dedicated worker owns the one instantiated module and serializes every request.
The module owns the sole `cadr_machine`; neither JavaScript side may read or write
machine structures directly.  The core owns guest state, and the M2 state formats
remain its only portable continuation boundary.  No worker operation accepts a host
file handle, callback, pathname, clock, socket, or mutable guest pointer.

The lifecycle is:

```text
UNINSTANTIATED --instantiate--> COLD --verified artifacts--> POWERED
POWERED --boot--> RUNNING --run--> RUNNING
RUNNING --snapshot restore--> RUNNING (fresh replacement)
any well-formed rejected request --> same machine state, next request id,
  except documented artifact-stream abort/discard transitions clear stream scratch
worker termination --> volatile state discarded; it is never reported as saved
```

`instantiate` is accepted exactly once.  A second well-formed attempt consumes its
request identifier and returns `CADR_STATUS_INVALID_ARGUMENT`; it MUST NOT replace
the existing machine.  A malformed envelope or a non-monotonic identifier emits
`cadr-error` and MUST NOT consume the expected identifier.  A well-formed request,
including one rejected by the core, consumes exactly one consecutive positive safe
integer identifier in `1..2^31-1`.

## ABI1.2 module and worker protocol

The ABI major remains 1 and ABI minor is 2.  ABI1.2 accepts only records at or
above minor 2 for M3 additions; older M1/M2 record validation remains where those
operations are used.  Fixed-width `uint32_t`, `uint64_t`, and byte arrays are the
portable C boundary; C structure bytes, pointer values, padding, and host endian
layout MUST NOT be serialized or exposed.

Every request is a record `{version: 1, id, op, ...}`.  Every normal reply is
`{type: "cadr-response", version: 1, id, op, status, ok, ...}`; a protocol error
is `{type: "cadr-error", version: 1, id|null, code, message}`.  `status` is the
fixed CADR status value, and `ok` is true exactly for status zero.  Inputs are
copied into module memory before their operation; response byte arrays are copied
out and transferred, so no response aliases live module memory.

```text
request root
├─ instantiate(module: WebAssembly.Module)
├─ input(bytes: ArrayBuffer|view) -> import(artifactKind:u32, byteCount:u32)
├─ stream-begin(artifactKind:u32, byteCount:u64 BigInt)
│  └─ stream-chunk(offset:u64 BigInt, bytes) ... -> stream-finish | stream-abort
├─ cold-power-on -> boot -> run(clockSlots:u32)
│  ├─ boundary-digests
│  ├─ boundary-digests-v3
│  ├─ run-digest-batch(clockSlots: 1..4096)
│  ├─ run-digest-batch-v3(clockSlots: 1..4096)
│  ├─ machine-info
│  ├─ host-next-request
│  ├─ host-complete(operation, hostStatus, generation, requestId, bytes)
│  └─ disk-observation
├─ portability-probe
├─ trace-start(transportMode:u32, capacity:u32,
│              selectorMask:u64 BigInt, eventMask:u64 BigInt)
│  ├─ trace-header | trace-drain | trace-digest
│  ├─ trace-count
│  └─ trace-finish(reason:u32)
└─ snapshot-size -> snapshot-save -> snapshot-restore
   └─ snapshot-restore-import(snapshot bytes)
```

The request tree is exhaustive for protocol version 1.  Unknown operations return
`INVALID_ARGUMENT`.  Operations before instantiation return `NOT_READY`, except
`instantiate`; core lifecycle errors retain their core status.  `run` requires a
nonzero u32 budget.  The legacy batched form produces zero to 4,096 complete
64-byte digest pairs; `run-digest-batch-v3` produces the corresponding 96-byte
CDRSTATE1/2/3 records.  Neither form pads an incomplete batch.  All JavaScript u64
stream, selector, and event-mask fields are `BigInt`; a
Number, negative value, or value above `2^64-1` is rejected before splitting it
into low/high u32 words.

Protocol version 1 remains frozen at this exact M3 tree. ABI1.3 media support
does not add operations or response fields to it; the separately specified
[boot-media controller profile](cadr-boot-media-controller-reimplementation-specification.md)
uses worker protocol version 2. A version-1 session rejects those M4-only
operations with `INVALID_ARGUMENT` and retains the payload-free
`host-next-request` response shape above.

## Streamed artifact verification and failure semantics

ABI1.2 adds streaming only for the selected immutable base disk.  It permits that
excluded import without requiring a duplicate 269 MB JavaScript/WASM transfer
buffer.  `stream-begin` validates ABI, cold lifecycle, inactive stream, inactive
trace, kind `BASE_DISK`, and the manifest byte count.  It then creates an internal
SHA-256 state, offset zero, and an *unpublished* artifact stream.

Each chunk MUST be nonempty, at most 1 MiB, start at the exact current offset, and
fit within the declared length.  The core hashes bytes in order and advances only
the stream offset.  `stream-finish` requires exact final length and exact manifest
SHA-256; only then does it atomically set `base_disk_verified`.  Out-of-order,
overflowing, short-final, hash-mismatched, or failed stream input clears the stream
scratch state and leaves every artifact-presence bit unchanged.  While a stream is
active, power-on, host request issuance, trace start, snapshot save/size, and both
boundary digest operations reject rather than observing a half-verified artifact.
The worker additionally aborts the core stream before rejecting any malformed
offset or transfer larger than 1 MiB.  Therefore a protocol-level rejected chunk
cannot strand the module in an active-stream state; a new `stream-begin` may follow.
`stream-abort` exposes the same discard transition for an otherwise well-formed but
deliberately abandoned import; it publishes no artifact bytes and permits subsequent
snapshot operations on the unchanged machine.

The nonstreamed `input` plus `import` path remains limited to 1 MiB, copies bytes
into the module, and uses the M1 exact-ingress validation.  It does not retain the
input after import.  An M3 artifact verifier is not a disk controller: it verifies
identity only.  Disk reads, writes, timing, and persistence are M4/M10 work.

## Portable integer and memory contract

The portable core MUST use explicit widths.  CADR microinstructions occupy a
`uint64_t` carrier, but every instruction import, control-store write, OA merge,
trace field, snapshot field, and exported value MUST mask to
`0x0000ffffffffffff`.  Micro-PC is 14 bits, virtual addresses are masked to their
specified 24-bit domain, and arithmetic that represents a 32-bit CADR register
uses `uint32_t` modular arithmetic.  Shifts have a validated nonzero count where C
would otherwise shift by the width; rotate counts are reduced modulo 32 and a zero
count returns its input.  Wire fields are explicit little-endian byte sequences.

The portable reconstruction MUST NOT depend on signed overflow, implementation-
defined right shift of a negative value, host `long`, `time_t`, `off_t`, pointer
width, alignment, or C structure padding.  It uses raw two's-complement bit
patterns for signed ordering and magnitude, widened `int64_t` only where the result
is representable, and unsigned comparisons for defined wrap/borrow behavior.

### The signed-carry source detail

`U303-SRC` is unusually type-sensitive.  In pinned `l/usim/uexec.c`, `adata` and
`mdata` are declared `int` (lines 51--57), and `arithOps` calls the `add32` macro
for opcode octal `031` (lines 584--585).  Pinned `l/usim/m32.h` lines 11--13 define
its carry test as `b > ~a` (or `b >= ~a` when carry-in is set).  Thus the selected
source expression is evaluated with its signed `int` operands; it is not simply
the usual unsigned-overflow predicate.  The source also gives opcode `034` a
separate `mdata == (int)0xffffffff && cin` carry case (lines 597--601), and uses
the macro again in divide/remainder paths (lines 680--705).

`INF-M3` defines the portable equivalent: compare raw 32-bit patterns in signed
two's-complement order (sign-bit ordering, then unsigned order within a sign),
compute low results in `uint32_t`, and never use host signed overflow or conversion
of an out-of-range unsigned value to signed as the semantic rule.  This preserves
the selected source's observed signed-comparison formulation on the declared
two's-complement profile, but does not claim that the historical hardware defined
the source macro's C type behavior.  `U01` is the discriminating oracle.

The bare wasm module has no imports, no WASI, no filesystem, no threads, no clock,
and no host callbacks.  Its linear memory and monotonic arena share a fixed
initial/maximum ceiling of 128 MiB.  The build fixes the linker stack at 1 MiB:
trace emission may simultaneously hold two 16 KiB record buffers plus hashing
locals, and the smaller linker default produced target-specific state corruption
in the cross-target trace test.  The arena begins at the linker's aligned
`__heap_base`, uses 16-byte alignment, and checks overflow before alignment.
Failure returns null and the caller returns `NO_MEMORY` or its documented status;
a conforming M3 host MUST NOT treat a null allocation as a successful partial
import, snapshot, or trace.

Ordinary allocations are monotonic, but snapshot restore is a bounded transaction.
The adapter checkpoints the arena immediately before allocating the replacement
machine and rolls back to that mark after every failed restore, including failures
discovered only after the complete snapshot has been parsed and checksummed.  It
does not roll back the separately reserved snapshot-input buffer.  A successful
restore commits the replacement allocation and consumes the profile's single
successful-restore allowance.

M3 bounds its no-free lifetime: one module and initial machine; at most one
successful snapshot replacement; one fixed 18,126,780-byte snapshot-output arena;
one fixed equal-sized import arena; one fixed 1 MiB transfer arena; one 96-byte
output and 32-byte metadata arena; at most a 1,024-record trace ring; and the M2
bounded completion payloads.  Counting the old, parsed, cache-verification, and
replacement machine states, both snapshot arenas, maximum trace storage, two
maximum completion payloads, and transfer/output storage gives a
130,186,776-byte dynamic upper bound.  This leaves 4,030,952 bytes below 128 MiB
for linked static data, stack, alignment, and small allocation metadata.  The
build gate fixes both WebAssembly memory limits at 2,048 pages and the adapter
asserts that the dynamic bound is below that limit.  These are M3 resource limits,
not CADR memory sizes or a claim that later M4/M10 profiles can fit all production
media under the same limit.

## CDRSTATE transcript, trace, and snapshot bridge

At every requested outer clock-slot boundary, the M3 runner records exactly 96
bytes: `CDRSTATE1[32] || CDRSTATE2[32] || CDRSTATE3[32]`.  `CDRSTATE1` is the
frozen M1 canonical boundary digest; `CDRSTATE2` is the byte-stable ABI1.1
continuation digest with derived Merkle caches rebuilt as necessary.  `CDRSTATE3`
is the ABI1.2 domain-separated digest of that exact CDRSTATE2 value plus every
M4-D0 disk semantic field.  Introducing disk state MUST NOT silently change
CDRSTATE2 schema 1.  None of the three is a raw C-state hash.

`CDRM3TR1` is an evidence transcript, not a historical or general trace format:

```text
32-byte header: magic, record_bytes=96, expected_count=slots+1, requested_slots
96-byte records: S0 through S<slots>, CDRSTATE1 then CDRSTATE2 then CDRSTATE3
32-byte footer: magic, actual_count, terminal_status=OK
```

The comparator MUST validate both framing/count equations and terminal status
before comparing byte-for-byte.  It reports the first unequal `S<n>` and whether
CDRSTATE1, CDRSTATE2, or CDRSTATE3 differs.  It MUST NOT trust file length alone.  The native
runner and worker runner start from the same verified artifacts, write S0 after
boot, then write one pair after each one-slot run.  A requested complete transcript
has exactly `slots + 1` records.

The maintained-usim oracle does not use the portable continuation-digest schemas:
its CDRSTATE1 includes live tree and device roots that the M1 portable profile
freezes, and it has no CDRSTATE2 or CDRSTATE3.  M3-P2 therefore MUST NOT compare
those opaque hashes or describe self-parity as an upstream oracle.  It uses three
separate, explicitly adapted streams:

- `CDRM3AD1` contains one SHA-256 projection for every S0 through S1,000,000.
  Its preimage is the domain `CDRM3AD1\0`, schema, S ordinal, executed/inhibited
  phase, and the exact 60 common scalar tags already defined by the pinned native
  oracle.  Each tag carries its explicit four- or eight-byte width; 48-bit words
  are masked and booleans are normalized.
- `CDRM3BUS1` contains every guest physical-word read or write in order, with its
  post-slot S, intra-slot sequence, address, input or result, and resulting bus
  error and interrupt latches.
- `CDRM3DISK1` contains every disk-register access and controller action in order,
  including full controller/selected-unit state and an explicit
  assert/deassert/request/block/completion disposition.

The two implementations emit these through observational, native-only hooks.
They are absent from the public ABI and bare Wasm module.  A release gate MUST
prove the hooks leave the preexisting boundary/mutation witnesses unchanged,
validate contiguous S ordinals and canonical framing, compare typed event fields,
and reject a deliberate scalar or event perturbation at its first S/sequence.
An empty request/block/completion stream is accepted only when both sides emit the
stream metadata and the gate pins the observed zero counts.

If a one-slot call applies an already queued host completion it reports zero guest
slots and `OK`; this is a valid between-slot transition and MUST NOT consume a batch
budget or emit a boundary record.  The worker continues until it obtains one guest
slot or a terminal status.  If the slot completed and the same call also reports a
terminal condition, its completed boundary is retained once and the batch then
stops.

M2 `CDRGTRC1` and `CDRSNAP1` cross the ABI1.2 boundary through the worker's
trace/snapshot leaves.  Trace outputs are copied out in at-most-1 MiB chunks;
snapshot save copies its exact byte count out, and restore-import copies exact input
bytes into a separately allocated region before fresh atomic restore.  A snapshot
restore creates a fresh core machine and replaces the module's old pointer only
after `cadr_machine_snapshot_restore` succeeds; on failure the old machine remains
usable, its allocator transaction is rolled back, and a corrected snapshot may be
retried.  Tests MUST exercise multiple late, internally checksummed failures before
a valid restore, rather than relying only on a trivially truncated input.  At most
one restore may succeed in one module lifetime; later restore attempts return
`NOT_READY`, preventing the monotonic allocator from exceeding the stated bound.
M3 does not redefine M2 record ordering, terminal rules, or state-cache validation.

Legacy CDRSNAP1 format minor 0 remains byte-stable and is legal only when the disk
is in its implied canonical quiescent default; an ABI1.1 save MUST reject a
nondefault disk rather than omit it.  An ABI1.2 snapshot uses CDRSNAP1 format minor
1 and a required type-9 disk chunk carrying the disk semantic fields and their
CDRSTATE3 witness.  A minor-0 restore constructs the documented default disk state;
a minor-1 restore validates and publishes the decoded disk state atomically with
the rest of the replacement machine.

### Cross-target snapshot observation (2026-07-28)

Local observation, not a claim that later M4 media service is complete:
`run-cadr-m3-snapshot-cross-target.sh` first proves the default-disk format-minor-0
compatibility path, then uses an ABI1.2 format-minor-1 snapshot whose directory is
exactly nine chunks (types 1 through 9, including D0).  Its deliberately nondefault
but valid D0 observation is controller status `5`, command `012`, and enabled
attention interrupt.  The gate asserts that observation after native-to-Wasm
restore, after Wasm save, and after Wasm-to-native restore.

The native-produced and Wasm-produced snapshots were byte-identical:
`b966296e8c6988a8863aabced590f798fa63f756573c226fa810cc45d54a61be`.
Both directions compared `CDRSTATE1 || CDRSTATE2 || CDRSTATE3` through S1024:
each comparison matched 1,025 96-byte records, and all four continuation
transcripts had SHA-256
`e751cd43a62404607e85dfdd2c305012f4b4d0b964ff55bcecd83cd86accde85`.
The excluded System 303 disk remained
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
Raw snapshots and transcripts stay in the ignored build tree.

## Exact startup bus prefix and M4-D0 dependency

The selected System 303 startup performs a read and, two clock slots later, a
zero-valued write at physical word address `017377400`.  A direct maintained-usim
debugger observation found them at raw pre-execution `machine_cycles` 505,068 and
505,070, hence post-slot boundaries S505069 and S505071.  In a `CDRM3TR1` file,
which also contains S0, their completed record counts are 505,070 and 505,072;
those counts are not boundary ordinals.  Pinned `bus-adaptor.c` identifies both
exact accesses as the extra page-zero parity location made by `PAGE-0-PARITY-FIX`,
suppresses both warnings in a release build, returns zero for the read, and ignores
the write.  ABI1.2 therefore returns `0`/`OK` for a guarded read and `OK` for a
guarded write of exactly `017377400`, emits no external-device event, and sets the
Xbus-NXM error latch just as the pinned bus adaptor does.  Apart from the exact
source-defined startup controls and M4-D0 operations named below, unimplemented bus
addresses remain fail-closed with `UNIMPLEMENTED_DEVICE`; this exception neither
activates the disk controller nor broadens the device compatibility claim.

The next observed native operations are not optional probes.  At raw cycle 505,074
the PROM writes `04` to physical `017773005`, mapped to diagnostic Unibus register
`0766012`; at raw cycle 505,078 it reads disk status at physical `017377774`.
The corresponding post-slot boundaries are S505075 and S505079, and the first disk
`START` write occurs at raw cycle 505,198/post-slot S505199.  The first command is
`0405` (at-ease plus fault-clear), so that START itself performs no media transfer,
but it requires real disk register and controller-state semantics.  A
processor-only M3 therefore cannot honestly reach S1,000,000.

`M4-D0` names the minimum forward slice of M4 required to close M3: every actual
disk register read and write, command-5 action, encoded status result, and
interrupt-deassert attempt exercised through S1,000,000.  The observed prefix has
seven disk-register reads, nine writes, two deassert attempts, no interrupt
assertion, and no CCW, DMA, media request, block, or completion.  Those zero counts
are negative reachability evidence, not validation of the implemented media path.
This is an explicit forward dependency, not permission to replace the boot fixture
with a synthetic processor loop.  CCW walking, DMA, range service, writable-overlay
semantics, and completion timing remain M4 work.  Full M4 is reserved pending a
separately declared `C-M4-BOOT-MEDIA` gate and later `C-LMFS-MOUNT` overlay
profile; it is not coupled to a host filesystem mount.

## Required conformance and release evidence

| ID | Setup and action | Objective pass condition | Status evidence required |
| --- | --- | --- | --- |
| `U01` | exhaustive selected ALU opcode/value/carry/Q vectors | result and carry equal the independent portable reference, including signed carry | passed under GCC 16.1.1 and Clang 21.1.5 at O0/O2, plus Wasm |
| `U02` | jump condition, push/return/inhibit combinations | next PC, stack, instruction-write, and inhibit latches match | passed under GCC 16.1.1 and Clang 21.1.5 at O0/O2, plus Wasm |
| `U03` | dispatch position/width/map/stack combinations | rotated source, dispatch entry, next PC, and inhibit match | passed under GCC 16.1.1 and Clang 21.1.5 at O0/O2, plus Wasm |
| `U04` | byte position/width/mode matrix | destination equals the specified masked/rotated result | passed under GCC 16.1.1 and Clang 21.1.5 at O0/O2, plus Wasm |
| `U05` | OA, delayed-MD, PROM-wrap, and pipeline-edge vectors | effective word and pipeline/memory latches match | passed under GCC 16.1.1 and Clang 21.1.5 at O0/O2, plus Wasm |
| `M3-M1-REG` | selected 100,000-slot M1 fixture | 100,001 CDRSTATE1 boundaries match frozen M1 oracle | passed: identity bundle `5e31742c67576a291dc071b91673c5e4ef3952edb2a1d9c3081a4f4adbc01390`, profile `1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a` |
| `M3-O0-O2` | same artifact inputs through O0 and O2 wasm | CDRM3TR1 byte-for-byte equal and native comparator passes | passed: O0/O2 repeats and cross-optimization comparison identical; declared transcript SHA-256 below |
| `M3-TRACE-SNAP` | minor-0 compatibility plus ABI1.2/D0 save/restore on both targets | native-to-Wasm and Wasm-to-native CDRSTATE1/2/3 continuations agree | observed 2026-07-28; see cross-target snapshot observation above |
| `M3-XTARGET-1M` | selected one-million-clock-slot fixture | portable native, wasm O0, and wasm O2 CDRM3TR1 match S0 through S1000000 | observed 2026-07-28: all eight declared transcripts matched 1,000,001 96-byte records and SHA-256 `1b2dd67359d08d20f096136053d1e7df95e404faa75ed3a82a642c3f432f102e` |
| `M3-USIM-1M` | same fixture through pinned maintained usim and M4-D0 | all 1,000,001 `CDRM3AD1` common-scalar projections and all ordered `CDRM3BUS1`/`CDRM3DISK1` events match; media-action streams are present and empty | passed: 533 bus events and 18 disk events after metadata; 0 request/block/completion events; aggregate hashes below |
| `M3-BUILD` | two clean O0 and two clean O2 builds | same hash per optimization level; no module imports; exact export allowlist | passed by clean `make test`; release module hashes below |
| `M3-WORKER` | malformed, ordered, duplicate-instantiation, BigInt, and batching probes | protocol identifier and failure rules above hold | passed by clean `make test`, including worker, framing, and Wasm conformance suites |
| `M3-BROWSER` | real Chromium HTTP-served ES-module worker | module instantiate and portability probe return OK | passed: `cadr_m3_browser: ok` under Chromium 150.0.7871.124 Arch Linux |

`U01` through `U05` are source-grounded vectors, not a proof that the maintained
System 303 runtime loaded every same source body.  The M1 regression and million
slot gate compare outer clock slots, including inhibited slots, rather than treating
every slot as a retired microinstruction.  The million gate is the M3 boundary gate;
the M1 regression remains mandatory because it ties the new larger run to the
already frozen native witness.

### C-M3 release record (2026-07-28)

The release run used LM-3 System 303 source
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
and maintained `usim`
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`.
The commands were `make -C cadr-web clean && make -C cadr-web test`,
`scripts/run-cadr-m3-conformance.sh`, `scripts/run-cadr-m3-differential.sh`,
`make -C cadr-web m3-snapshot-cross-target`, and the checked P2 comparator over
the upstream `det-a` sidecars and `build/cadr-m3-p2-portable-s1000000` sidecars.
The final P2 comparison command was:

```sh
python3 scripts/compare-cadr-m3-upstream-adapter.py build/cadr-oracle/m3-p2-upstream-s1000000-det-a/adapter.cdrm3ad1 build/cadr-m3-p2-portable-s1000000/adapter.cdrm3ad1 build/cadr-oracle/m3-p2-upstream-s1000000-det-a/bus.cdrm3bus1.ndjson build/cadr-m3-p2-portable-s1000000/bus.cdrm3bus1.ndjson build/cadr-oracle/m3-p2-upstream-s1000000-det-a/disk.cdrm3disk1.ndjson build/cadr-m3-p2-portable-s1000000/disk.cdrm3disk1.ndjson --expected-slots 1000000
```

The toolchain was GCC 16.1.1, Clang 21.1.5, Node v22.14.0, LLD 21.1.5, and
Chromium 150.0.7871.124 Arch Linux.
`guix shell clang-toolchain lld -- sh -c 'clang --version | head -1; wasm-ld --version | head -1; command -v wasm-ld'`
selected the Guix-profile `wasm-ld`, rather than an ambient linker.

The clean-test artifacts were: `libcadr_core.a`, 205,558 bytes,
`c7523a72cfc3587337fa96cde6164ce5bc7183cbea2450fced7c6cfc35f9b71c`;
`cadr-headless`, 178,632 bytes,
`561b1d1b9be5082ad5b0a156d3c0bb724d36734385e00c44bebe53b430b30c6e`;
`cadr-m3-native`, 188,696 bytes,
`a4db8a1c1e8c61506f0b6b1f87871ca61d81a3537c9e3ff79d16be0d8a720001`;
and the O0 Wasm module, 151,981 bytes,
`85f241ca5f58593a799e7b1c4a3fd7a7d67e6feb24bbb55eafbed1a71cef9aa7`.
The differential additionally produced O2 Wasm
`ea8ea46ecc949ab3817fb758be337c19330d82de68f5e9e689a0943a40210ec4`
and compiler/optimization-specific native hashes: GCC O0
`a4db8a1c1e8c61506f0b6b1f87871ca61d81a3537c9e3ff79d16be0d8a720001`,
GCC O2 `1a346d90c0ddd1a6807396b60b35c45228053b92e58c6788d7f723d6ec995835`,
Clang O0 `33c03c3712894f5c3f4dfdca329e9045dd5c028a58803bf01a82c7d7f8e6f6d0`,
and Clang O2 `78d357ca50de963876daa88c3e0bc5155569a4a72aa345dcfd7417e41e4509d7`.

All eight declared one-million-slot `CDRM3TR1` transcripts matched through
S1,000,000 (1,000,001 records of 96 bytes) and had SHA-256
`1b2dd67359d08d20f096136053d1e7df95e404faa75ed3a82a642c3f432f102e`.
The P2 maintained-usim comparison matched 1,000,001 `CDRM3AD1` digests, 533
bus events, and 18 disk events.  The upstream and portable sidecars had identical
hashes: adapter
`75303b0246775e76cc2ac66da8c29d73db65c4e94e946f672262b1d70c36180a`,
bus `06a72c0084a8188c145afb31343c1d02252d62908ad66a1d7c6570b879ce9936`,
and disk `660c51dde4c2e2eb12223a74513d379ab8bdaea310d4d9ee67dbb4974b1c5c01`.
The selected local System 303 disk was supplied as an excluded input, never
bundled or copied into tracked output, and remained
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` before
and after the gates.

## Reproducible build and comparison procedure

The tracked build script requires Guix channel
`230aa373f315f247852ee07dff34146e9b480aec`, Clang 21.1.5, and LLD 21.1.5.  It
compiles the explicit freestanding source closure with `--target=wasm32-unknown-
unknown`, `-nostdlib`, no entry point, exported memory, fixed 128 MiB memory, and
only the declared adapter exports.  The build MUST be invoked separately for O0 and
O2.  Determinism is assessed per same optimization level; this specification does
not require O0 and O2 module bytes to be identical.

1. Verify the M0 profile and local artifact identities; make a disposable output
   location without copying licensed payload into version control.
2. Build native `cadr_m3_native`, O0 wasm, and O2 wasm from the declared source
   closure.
3. Run U01--U05 natively and retain their pass/fail output.
4. Produce native and worker CDRM3TR1 transcripts with identical inputs and slot
   count; compare them with `compare-cadr-m3-transcripts.py`.
5. Repeat for M1's 100,000 slots, then the one-million-slot gate, and repeat the
   relevant comparison under O0 and O2.
6. Run trace/snapshot cross-target checks, reproducible-build/export/import audit,
   Node worker tests, and the Chromium smoke under a local HTTP server.
7. Store only aggregate hashes/results in tracked documentation.  Keep disks,
   transcripts containing guest state, and raw browser data in ignored build trees.

## Known unknowns and nonclaims

- `TODO-RUNTIME-M3-MEDIA`: M3 executes the selected startup disk-register and
  command-5 prefix, but that prefix reaches no CCW, DMA, block service, filesystem,
  or Listener.  Synthetic media-path tests do not substitute for the M4 boot-media
  oracle.
- `TODO-RUNTIME-M3-RESOURCE`: the static proof bounds the declared operation
  sequence, but a later browser profile should also retain measured high-water
  evidence; the fixed M3 limits are not a user-facing capacity guarantee.
- `TODO-RUNTIME-M3-BROWSER-MATRIX`: one Chromium smoke is a transport probe, not a
  browser compatibility matrix or an accessibility/interactive test.
- The exact current checkout's administrative Git identifier is not substituted for
  the profile's asserted Fossil pins.  A fresh source-identity verification remains
  part of release evidence.
- The headless profile has no application keybinding tree or pointer gestures; M8
  and M9 own their future guest-input inventory.  The worker request tree above is
  host protocol, not a historical CADR user interface.

## Artifact identities and rights boundary

| Role | Identity | Publication boundary |
| --- | --- | --- |
| Selected historical source | System 303 `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, `usim` `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` | public source evidence; do not conflate with a runtime capture |
| Portable core/ABI | tracked `cadr-web/` ABI1.2 source | reconstructive implementation, not historical binary API |
| Base disk | M0 manifest identity above | excluded local import; no disk bytes or derived guest payload tracked |
| M3 transcript and snapshots | CDRM3TR1, CDRSNAP1, and P2 sidecars | local evidence unless separately reviewed; no guest data in this page |
| Browser module | O0 Wasm `85f241ca5f58593a799e7b1c4a3fd7a7d67e6feb24bbb55eafbed1a71cef9aa7`; O2 Wasm `ea8ea46ecc949ab3817fb758be337c19330d82de68f5e9e689a0943a40210ec4` | publish only after source/license and conformance record review |

## Sources

- [CADR browser/WebAssembly roadmap](cadr-browser-webassembly-implementation-roadmap.md), M0--M3.
- [System 303 macroinstruction and microarchitecture specification](cadr-macroinstruction-and-microarchitecture-reimplementation-specification.md), selected `U303` profile.
- [Native CADR instruction-boundary oracle design](cadr-native-instruction-oracle-design.md).
- [ABI1.1 deterministic tracing and snapshot specification](cadr-deterministic-tracing-and-snapshot-reimplementation-specification.md).
- Pinned `usim` `m32.h` lines 3--20 and `uexec.c` lines 51--57, 541--705, inspected 2026-07-28.
- Tracked M3 build, worker, adapter, transcript comparator, and tests, inspected 2026-07-28.
