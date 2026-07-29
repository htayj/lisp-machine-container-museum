---
type: Reimplementation Format Specification
title: CDRSNAP1 CADR core snapshot format
description: A deterministic, integrity-checked internal snapshot format for CADR-WEB-303 ABI 1.1 through ABI 1.4 cores, including the ABI 1.4 scheduler and IOB state.
tags: [mit-cadr, cadr-web, snapshot, serialization, reimplementation]
timestamp: 2026-07-29T05:49:00-04:00
---

# CDRSNAP1 CADR core snapshot format

CDRSNAP1 is the internal state-transfer format for one selected
`CADR-WEB-303` machine state at an instruction boundary. It is a portable,
little-endian, chunked representation: it never copies a C structure, pointer,
padding byte, derived cache node, or operational pointer. A valid restore is
staged, rebuilds all derived canonical and CDRSTATE2 caches, verifies the
integrated core's state digests and, for format minor 1 and later, the
CDRSTATE3 disk witness, and only then becomes available to the machine owner.
Minor 2 adds the ABI 1.4 scheduler's pending event queue, IOB keyboard/clock
state, optional undrained detailed transcript records, and cumulative
transcript witness.

This is a new reconstruction format, not a claim that historical CADR save-state
files used this layout. Its target profile is the M0/M1 `CADR-WEB-303` profile
whose tracked identity is SHA-256
`1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a`.

## Evidence and scope

`CW-SRC` is the tracked production encoder, decoder, and state definition in
[`../core/cadr_snapshot.c`](../core/cadr_snapshot.c),
[`../core/cadr_snapshot.h`](../core/cadr_snapshot.h),
[`../core/cadr_scheduler_state.h`](../core/cadr_scheduler_state.h), and their
component headers. `CW-TEST` is
[`../tests/test_cadr_m5_scheduler.c`](../tests/test_cadr_m5_scheduler.c), which
exercises M5 round trips, legacy upgrade, and undrained transcript preservation.
`CW-PLAN` is the snapshot/restore deliverable and identical-continuation gate in
the [CADR browser/WebAssembly roadmap](../../docs/mit-cadr/cadr-browser-webassembly-implementation-roadmap.md).
`CW-INF` is the format's transactional and host-neutral reconstruction policy.

The format covers every semantic field presently owned by `cadr_machine_state`:
processor registers and arrays; PROM, control store, maps, and all declared main
RAM; bus and diagnostic state; TV state; lifecycle, profile, artifact flags,
counters, trace latches, request state, and copied completion bytes. It stores
the canonical mutation ordinal, slot range, events, initialized marker, overflow
marker, and `mutation_sha256`, but not its Merkle nodes. The parser recomputes the
stored mutation SHA-256 from the serialized events and requires an exact match
before publication. The nested `trace.state_v2` cache and operational trace-engine
pointer are likewise omitted as derived or operational state. Later device-state
additions require
a new required chunk or a profile/version change; silently treating a missing
future device as reset state is invalid.

## Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, and **MAY** in
this specification are normative requirements for a CDRSNAP1 reader or writer.
They do not describe historical CADR behavior.

## Reconstruction claim and nonclaim

The claim is file-representation compatibility for CDRSNAP1 versions 1.0, 1.1,
and 1.2 and their named profiles. Version 1.0 is the frozen ABI 1.1/M2
representation. Version 1.1 adds the required D0 disk state used by ABI
1.2/M3 without changing the first eight chunks. Version 1.2 is selected by
ABI 1.4/M5 and adds required type 10 without changing the prior chunks. These
versions guarantee a deterministic byte representation for equivalent semantic
state and atomic rejection of malformed or mismatched input. Nonclaim: these
versions are not compatible with a historical CADR, LM-3, or
usim saved-state format, do not make an archive authentic, and do not authorize
use of media outside the profile's artifact boundary.

Reserved claims: later disk-unit models, writable overlays, active-host-I/O
checkpointing, persistence, and historical save formats require separate versioned
profiles and conformance evidence.

## Profile and conformance level

The version-1.0 profile is
`CADR-WEB-303/file-representation/M2-snapshot`; it emits eight required chunks
and is valid only when the disk controller has the implied quiescent default
state. The version-1.1 profile is
`CADR-WEB-303/file-representation/M3-snapshot`; it emits the same eight chunks
plus required type 9 containing explicit D0 disk state and its CDRSTATE3 witness.
it, and an ABI 1.1 reader MUST reject minor 1. The version-1.2 profile is
`CADR-WEB-303/file-representation/M5-snapshot`; its canonical writer emits ten
required chunks and carries all M5 scheduler state in type 10. An ABI below 1.4
MUST reject minor 2. An ABI 1.4 restore accepts minors 0 and 1, then explicitly
installs an empty, capture-disabled scheduler with phase `BOUNDARY_READY` and
hidden policy `HIDDEN_PAUSE`; it does not fabricate queued events, transcript
records, IOB FIFO bytes, or a cumulative witness. A conforming reader MUST reject
another profile, artifact-set identity, overlay binding, byte layout, or required
semantic field rather than applying a default. It may ignore an integrity-checked
unknown optional chunk exactly as the directory rules specify.

## Primitive encoding

All unsigned integers are fixed-width little-endian bytes. `u8`, `u16`, `u32`,
and `u64` mean respectively 1, 2, 4, and 8 bytes. Boolean fields encode exactly
0 or 1. SHA-256 values are their ordinary 32 output bytes, not hexadecimal text.
No alignment or implicit padding exists.

The file is:

```text
fixed header (264 bytes)
sorted chunk directory (chunk_count * 64 bytes)
contiguous chunk payloads
final SHA-256 trailer (32 bytes)
```

The canonical ABI 1.4/M5 writer uses `chunk_count = 10`, so its directory is
640 bytes, `payload_offset` is `264 + 640 = 904`, and its total length is
`936 + sum(length(type 1)..length(type 10))`. Type 10 itself has exact length
`132 + 40 * pending_event_count + 120 * pending_transcript_count`; therefore
an otherwise empty canonical M5 snapshot adds 132 scheduler bytes over its M3
counterpart. The parser also accepts a larger `chunk_count` only for sorted,
integrity-checked unknown *optional* chunks; its general calculation remains
`264 + 64 * chunk_count + sum(directory lengths) + 32`, with checked u64
arithmetic and no alignment padding.

The final trailer is SHA-256 of every preceding byte. The header stores the
SHA-256 of the exact directory. Every directory entry stores the SHA-256 of the
exact uncompressed chunk payload. These checks establish integrity, not a
signature or origin authentication.

## Fixed header

| Offset | Field | Rule |
| ---: | --- | --- |
| 0 | `magic[8]` | ASCII `CDRSNAP1` |
| 8 | `major:u16`, `minor:u16` | major exactly 1; minor 0 for ABI 1.1, 1 for ABI 1.2/1.3, or 2 for ABI 1.4/M5 |
| 12 | `header_bytes:u32` | exactly 264 |
| 16 | `flags:u32` | zero |
| 20 | `chunk_count:u32` | at least 8, 9, or 10 respectively for minors 0, 1, or 2; at most 1,024 |
| 24 | `directory_entry_bytes:u32` | exactly 64 |
| 28 | `reserved0:u32` | zero |
| 32 | `total_bytes:u64` | exact supplied input length |
| 40 | `directory_offset:u64` | exactly 264 |
| 48 | `directory_bytes:u64` | exactly `chunk_count * 64` |
| 56 | `payload_offset:u64` | exactly `directory_offset + directory_bytes` |
| 64 | `profile:u32` | `CADR_PROFILE_CADR_WEB_303` |
| 68 | `artifact_mask:u32` | five known artifact-presence bits only |
| 72 | `lifecycle:u32` | matches the CORE chunk and a defined lifecycle value |
| 76 | `storage_binding_flags:u32` | exactly zero: M2 has no writable overlay or external storage binding |
| 80 | `storage_overlay_generation:u64` | exactly zero: no overlay generation exists in M2 |
| 88 | `clock_slots_completed:u64` | matches CORE |
| 96 | `microinstructions_executed:u64` | matches CPU |
| 104 | `selected_profile_sha256[32]` | exact SHA-256 of the tracked selected-profile record |
| 136 | `artifact_set_sha256[32]` | exact SHA-256 of the canonical runtime-artifact inventory below |
| 168 | `cdrstate1_digest[32]` | caller-supplied frozen M1 boundary digest |
| 200 | `cdrstate2_digest[32]` | caller-supplied full continuation-state digest |
| 232 | `directory_sha256[32]` | SHA-256 of the exact directory bytes |

The artifact bit positions are boot configuration (0), control store (1), base
disk verification (2), PROM symbols (3), and microcode symbols (4). The selected
profile hash is the SHA-256 of the tracked profile record. The distinct artifact
set hash is SHA-256 of `CDRARTSET1\\0` followed, in artifact-kind order, by each
required profile artifact's `kind:u32`, `byte_count:u64`, and 32-byte SHA-256:
boot configuration, control store, base disk, PROM symbols, and microcode symbols.
For the selected profile it is
`e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941`.
The two identities and the artifact mask bind both the selected profile inventory
and the verified inputs resident in this state. M2's `storage_binding_flags` and
`storage_overlay_generation` are explicit zero/no-overlay bindings; a later
writable-overlay profile must version or extend this contract rather than treating
an omitted overlay as empty.

## Directory and chunk rules

Each 64-byte entry is `type:u32`, `flags:u32`, `offset:u64`, `length:u64`,
`reserved0:u64`, and `sha256[32]`. Entries are strictly increasing by type,
unique, have zero reserved and unknown flag bits, and describe contiguous payload
ranges beginning at `payload_offset` and ending exactly before the final trailer.
Ranges may not overlap, leave gaps, point into the header/directory/trailer, or
overflow an unsigned 64-bit calculation.

Bit 0 of `flags` means *required*. All chunks known for the selected minor are
required. An unknown
required chunk rejects the archive. An unknown optional chunk (zero flags) is
integrity-checked and then ignored; it is not preserved by a subsequent canonical
re-serialization. This is the only forward-extension path within major version 1.

| Type | Name | Required payload |
| ---: | --- | --- |
| 1 | CORE | profile/lifecycle, in-completion guard, counters, and artifact flags |
| 2 | CPU | all processor scalars, register arrays, decode latches, and boolean flags |
| 3 | MEMORY | memory scalars, 512 PROM words, 16,384 instruction words, maps, and all 16,384 × 256 RAM words |
| 4 | BUS | bus state, both 16-entry maps, and all diagnostic latches |
| 5 | DEVICES | current device state: event sequence and monochrome-TV control, sync RAM, and 32,768 screen words |
| 6 | CANONICAL | semantic canonical mutation fields and exactly `mutation_count` 32-byte events |
| 7 | EVENTS | request scalars, the operation-selected canonical descriptor record, and exactly queued copied completion bytes |
| 8 | TRACE | every logical `cadr_trace_state` ordinal and latch scalar through `interrupt_level` |
| 9 | DISK | minors 1 and 2: 64 bytes of D0 disk semantic fields followed by a 32-byte CDRSTATE3 witness |
| 10 | SCHEDULER | minor 2 only: ABI 1.4 IOB state, pending scheduler events, cumulative transcript witness, and pending detailed transcript transport records |

The minor-0 canonical writer emits exactly chunks 1 through 8 in order. The
minor-1 canonical writer emits exactly chunks 1 through 9 in order. The
minor-2 canonical writer emits exactly chunks 1 through 10 in order. Their
fields are emitted in declaration order with nested arrays in ascending index
order. A known chunk has flags exactly `1` (required). A reader rejects a known
chunk absent, duplicated, or marked optional. For a lower minor, a higher-numbered
chunk is not known: it is rejected if marked required, but is an ignored optional
extension if marked zero and otherwise satisfies the directory and hash rules.
CANONICAL includes `mutation_sha256` but omits every Merkle-node array; the parser
recomputes and compares the hash before the restore hook recreates the derived
nodes. TRACE omits nested `state_v2` cache storage and the engine pointer.
EVENTS omits bytes after the active descriptor and does not encode the completion
pointer itself. Descriptor bytes are not copied from a native C structure. After
the 80-byte EVENTS scalar prefix, the selected operation has the following
canonical little-endian wire record:

| Operation | Bytes | Fields in order |
| --- | ---: | --- |
| `BLOCK_READ` (1) | 16 | `first_block:u64`, `block_count:u32`, `block_bytes:u32` |
| `BLOCK_WRITE` (2) | 24 | `transaction_id:u64`, `first_block:u64`, `block_count:u32`, `block_bytes:u32` |
| `PRESENT` (3) | 24 | `framebuffer_generation:u64`, `x:u32`, `y:u32`, `width:u32`, `height:u32` |
| `AUDIO` (4) | 24 | `audio_generation:u64`, `guest_timestamp:u64`, `encoding:u32`, `frame_count:u32` |
| `NETWORK` (5) | 16 | `frame_sequence:u64`, `frame_byte_count:u64` |

The operation discriminant and descriptor length must select exactly one row.
The reader decodes each field, initializes a fresh native descriptor to zero, and
copies that reconstructed native value into staged request state. Thus host
endianness, alignment, and padding are not part of CDRSNAP1.

### Minor-1-and-later DISK payload

The 96-byte type-9 payload is:

```text
pending_first_block:u64
compatibility_profile:u32
command:u32
command_list_pointer:u32
disk_address:u32
last_memory_address:u32
pending_ccw_address:u32
pending_memory_address:u32
pending_ccw:u32
status:u32
transfer_active:u32
reset_condition:u32
done_interrupt_enable:u32
attention_interrupt_enable:u32
reserved0:u32
cdrstate3_witness[32]
```

The compatibility profile is exactly the selected System 303 rule or the pinned
maintained-usim rule. Booleans are zero or one, reserved is zero, pending CCW and
page-address fields obey their declared widths and alignment, and status contains
only known D0 bits. An active transfer requires a valid in-range block, an active
controller status, and a matching outstanding one-block, 1,024-byte `BLOCK_READ`
request. A reset or not-active controller cannot carry an active transfer.

The witness is the canonical CDRSTATE3 digest of the decoded state. The reader
recomputes it only after structural and semantic validation and requires exact
equality before publication for both minors 1 and 2. Minor 0 instead initializes the documented default
disk state: System 303 compatibility, `NOT_ACTIVE`, and every other disk field
zero. It may not be used to erase nondefault disk state.

### Minor-2 SCHEDULER payload (type 10)

Type 10 is the ABI 1.4/M5 addition. It is a compact wire record, not a dump of
`cadr_iob_state`, `cadr_scheduler_state`, or either C compiler's padding. Its
length is exactly `132 + 40E + 120T`, where `E` is the stored pending-event count
(`0 <= E <= 64`) and `T` is the stored pending-transcript count (`0 <= T <= 256`).
All fields are little-endian and have no alignment padding:

| Offset | Bytes | Field |
| ---: | ---: | --- |
| 0 | 4 | `iob.csr:u32` |
| 4 | 4 | `iob.scancode:u32` |
| 8 | 4 | `iob.usec_clock:u32` |
| 12 | 4 | `iob.usec_latched:u32` |
| 16 | 4 | `iob.usec_phase:u32` |
| 20 | 2 | `iob.sixty_cycle_clock:u16` |
| 22 | 2 | required zero |
| 24 | 4 | `iob.key_queue_read:u32` |
| 28 | 4 | `iob.key_queue_write:u32` |
| 32 | 4 | `iob.key_queue_count:u32` |
| 36 | 20 | ten `iob.key_queue[index]:u16`, index 0 through 9 |
| 56 | 8 | `scheduler.next_insertion_sequence:u64` |
| 64 | 4 | `scheduler.count:E:u32` |
| 68 | 4 | `scheduler.phase:u32` |
| 72 | 4 | `scheduler.hidden_policy:u32` |
| 76 | 4 | `scheduler.reserved0:u32` |
| 80 | `40E` | pending event records, in array order |
| `80 + 40E` | 8 | `scheduler.transcript_total_count:u64` |
| `88 + 40E` | 32 | `scheduler.transcript_witness_sha256[32]` |
| `120 + 40E` | 4 | `scheduler.transcript_count:T:u32` |
| `124 + 40E` | 4 | `scheduler.transcript_capture_enabled:u32` (boolean) |
| `128 + 40E` | 4 | `scheduler.transcript_reserved0:u32` (zero) |
| `132 + 40E` | `120T` | pending detailed transcript records, in array order |

Each 40-byte pending event is `due_tick:u64`, `generation:u64`,
`insertion_sequence:u64`, `kind:u32`, `flags:u32`, `value:u32`, and
`reserved0:u32`. Each 120-byte pending detailed transcript record is the same
first `due_tick`, `generation`, `insertion_sequence`, and `kind`, followed by
the 23 `u32` values `order`, `flags`, `value`, `interrupt_before`,
`interrupt_after`, `interrupt_control_before`, `interrupt_control_after`,
`iob_csr_before`, `iob_csr_after`, `location_counter_before`,
`location_counter_after`, `tv_mode_before`, `tv_mode_after`,
`sixty_cycle_before`, `sixty_cycle_after`, `usec_clock_before`,
`usec_clock_after`, `usec_phase_before`, `usec_phase_after`,
`scancode_before`, `scancode_after`, `fifo_count_before`, and
`fifo_count_after`.

`transcript_witness_sha256` and `transcript_total_count` are semantic,
append-only state. The transcript array is a bounded host-transport buffer:
draining it does not alter CDRSTATE5, but an M5 snapshot deliberately preserves
the currently undrained records and whether capture is enabled. Thus bytewise
snapshots taken before and after a drain may differ even when the CDRSTATE5
digest is identical.

## Validation and atomic restore

Before allocation or publication, a reader validates magic/version, all lengths
and overflow calculations, final/directory/chunk hashes, directory ordering,
known/unknown chunk rules, and exact required chunk lengths. It then decodes into
a zeroed private `cadr_machine_state`, validates booleans, lifecycle, profile,
reserved fields, mapped-memory count, artifact mask, counter/header agreement,
request/completion state, and canonical event bounds.

TRACE acceptance is not independently redefined by this format. After decoding
the semantic latch fields and before any derived-cache rebuild or publication,
the reader calls the trace subsystem's shared
`cadr_trace_latches_validate(const cadr_machine_state *)` contract. Any invalid
micro-PC width, 48-bit instruction value, boolean, source or destination
address/kind, valid-bit relationship, fault state, interrupt
vector/pending relationship, or class-outcome relationship rejects the entire
restore atomically. Keeping this validation in the trace subsystem makes live
trace emission and restored trace state use one rule set.
In particular, an invalid M-source or destination latch has an all-zero tuple;
clearing its validity bit cannot preserve stale kind, address, or value fields.

Only statuses which core execution can persist are accepted:
`OK`, `HOST_FAILURE`, `GUEST_FAULT`, `UNIMPLEMENTED_DEVICE`, and `HALTED`.
Cold and powered states require `OK`; a guest-faulted lifecycle requires
`GUEST_FAULT`, and `GUEST_FAULT` requires that lifecycle. `HALTED` requires the
processor halt latch. Any non-`OK` persisted status requires no outstanding
request and no queued completion. A live outstanding request always has `OK`.

For initialized canonical state, unsigned addition must not overflow and
`first_mutation_ordinal + mutation_count` must equal `mutation_ordinal`.
Uninitialized canonical state requires all three values, the overflow latch, and
the mutation digest to be zero. These relations also cover the zero-event
initialized case, where the first and current ordinals are equal.

An instruction-boundary snapshot cannot be taken during host completion; therefore
`in_host_completion` must be zero. A queued completion must have an outstanding
request, a valid matching operation and descriptor size, a completion length equal
to the request's expected length, and valid host status. A nonqueued request has
no copied completion bytes. The parser allocates copied completion data only after
the chunk has passed structural checks.

CDRSNAP1 does not own the ABI1.3 M4 host service's staged write, committed volatile
block-1 overlay, overlay generation, range-reader attachment, or pending service
latency. The integrated native service and dedicated worker therefore MUST reject
snapshot size, save, and restore while the service is busy or while any committed
overlay exists. Checking only the core request-payload count is insufficient:
after controller application that count is zero while the overlay is still
semantically required by later reads. A future snapshot profile may add an
identity-bound overlay chunk; CDRSNAP1 minors 1 and 2 do not silently do so.

For minor 2, structural parsing additionally requires the type-10 u16 at offset
22 to be zero, `E <= 64`, `T <= 256`, and no trailing or missing payload byte.
Semantic validation requires the IOB microsecond phase to be below 60; keyboard
FIFO read and write indices below 10; FIFO count at most 10; and
`write == (read + count) mod 10`. Scheduler phase is exactly
`BOUNDARY_READY`, hidden policy is exactly `HIDDEN_PAUSE`, both scheduler
reserved fields are zero, and capture-enabled is exactly zero or one (zero
requires `T = 0`). `transcript_total_count >= T`; it is zero exactly when the
32-byte cumulative witness is all zero. These are the selected profile's
current representability rules, not a general claim about all historical IOBs.

Every pending event has the current event generation, is due no earlier than
`clock_slots_completed`, has a unique increasing insertion sequence below
`next_insertion_sequence`, has flags zero and reserved zero, and is one of
sequence break/value 0, clock/value 1, or keyboard/value at most `0xffff`.
No two queued keyboard events may have the same due tick. Detailed transcript
records have the same kind/value/flags domain, insertion-sequence uniqueness
against both prior transcript and pending events, due tick no later than the
snapshot boundary, FIFO count at most 10, microsecond phase below 60, 16-bit
interrupt and sixty-cycle values, IOB CSR bits only in octal `057`, and a
nondecreasing `(due_tick, order, priority)` order. At equal due tick the
priority is clock, keyboard, then sequence break; at a later due tick `order`
restarts at zero. This validates the recorded scheduling evidence but does not
replay it during parse.

The caller must provide both hooks in `cadr_snapshot_restore_hooks`. The first
rebuilds **all** derived continuation storage: both the legacy canonical Merkle
nodes and `trace.state_v2`. Before it runs, the parser recomputes and compares the
legacy canonical mutation SHA-256 from decoded events. The hook must preserve
every semantic field and must leave the operational `trace.engine` pointer null.
The parser fingerprints all serialized semantic fields before and after that
callback and rejects any semantic mutation or non-null engine. The second, const
validator receives the staged state and fixed-header metadata and must recompute
and verify both the frozen M1 `CDRSTATE1` boundary digest and the full
`CDRSTATE2` continuation digest before the state is published. Minor 1 and minor
2 additionally require the type-9 witness to equal the recomputed CDRSTATE3
digest. CDRSTATE5 is a separately exposed M5 state digest: type 10 is included
in the parser's semantic-stability fingerprint, but CDRSNAP1 carries no
CDRSTATE5 field in its fixed header. On any error,
including allocation or either callback,
the output state is null and the metadata is zero.

## Failure and recovery

No invalid archive partially restores a state. Header, directory, chunk hash,
cross-state, shared trace-latch, allocation, cache-rebuild, and
semantic-validator failures destroy the private staged allocation and leave the caller's output null. A caller retains
its existing live machine until it separately accepts and installs the staged state;
this format has no operation that mutates a live machine in place. A later host
restore transaction may retry from the unchanged input bytes or discard them; it
MUST NOT substitute reset state for a rejected chunk or omitted artifact.

## Conformance obligations

`test_cadr_snapshot` exercises deterministic round trip; canonical little-endian
portability vectors and native reconstruction for all five descriptors; pending,
queued nonzero, and queued zero-length completions; independent FIPS SHA-256 and
stored chunk/final hash checks; corruption and truncation; unknown required and
optional chunks; duplicate/order/overlap failures; self-consistently resealed
semantic-negative mutations in every required state family; omission of derived
caches and operational pointers; shared trace-latch negative vectors covering
widths, booleans, source/destination relationships, interrupt relationships,
and class outcomes; and callback/allocation atomicity. The
integrated M2 trace suite additionally proves that a restored instruction-boundary
state produces the same continuation trace and CDRSTATE2/M1 boundary digests.
The M3 suite proves that minor 0 remains byte-stable for default disk state,
minor 0 rejects nondefault disk state, minor 1 requires and validates type 9,
and native-to-Wasm and Wasm-to-native minor-1 restores preserve identical
CDRSTATE1/2/3 continuations from a nondefault valid D0 state. `CW-TEST` proves
that a minor-2 snapshot preserves an enabled capture session and its one pending
detailed record; draining the restored record leaves CDRSTATE5 unchanged; and a
minor-1 snapshot restored through an ABI 1.4 request receives the exact empty
M5 scheduler defaults before it is saved and restored again as minor 2. Required
negative vectors for minor 2 are malformed type-10 fixed fields, event and
transcript count/length mismatch, FIFO-ring inconsistency, invalid event or
transcript ordering, nonzero scheduler reserves, malformed CDRSTATE3 witness,
and a type-10 omission or optional marking. The last group is a continuing test
obligation where no focused negative vector is yet identified in `CW-TEST`.

## ABI selection and restore publication

The public snapshot request uses ABI major 1, a supported ABI minor, its exact
structure size, and zero flags. ABI minors below 1.2 select minor 0; ABI 1.2
and ABI 1.3 select minor 1; ABI 1.4 and later select minor 2. A request below
ABI 1.2 rejects any parsed snapshot later than minor 0, and a request below ABI
1.4 rejects a parsed minor-2 snapshot. Conversely, ABI 1.4 accepts a valid
minor-0 or minor-1 archive only through the explicit default-scheduler upgrade
described above. This is a compatibility adaptation at restore time, not an
assertion that the old archive contained M5 state.

The core parser creates a private state allocation and returns it only after all
format, semantic, derived-cache, and hook checks succeed. The public restore
then allocates a new `cadr_machine`, copies the staged state, and publishes that
new machine through the output pointer; a failed restore leaves the output null.
The Wasm adapter performs one further atomic replacement: it keeps the old
machine until successful core restore, then installs the new one and destroys
the old. Its finite allocator permits one successful restore per adapter
instance; malformed input rolls back the allocation mark and does not consume
that one successful-restore right. These adapter rules are not bytes in
CDRSNAP1 itself.

## Integration boundary

The public ABI integration wires the production all-derived-cache rebuilder and
dual-digest validator into a fresh-machine restore transaction. The format parser
itself deliberately returns only a staged internal state; it does not make a
restored machine externally observable by itself.
