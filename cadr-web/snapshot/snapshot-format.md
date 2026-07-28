---
type: Reimplementation Format Specification
title: CDRSNAP1 CADR core snapshot format
description: A deterministic, integrity-checked internal snapshot format for the CADR-WEB-303 core at an instruction boundary.
tags: [mit-cadr, cadr-web, snapshot, serialization, reimplementation]
timestamp: 2026-07-27T18:05:00-04:00
---

# CDRSNAP1 CADR core snapshot format

CDRSNAP1 is the internal state-transfer format for one selected
`CADR-WEB-303` machine state at an instruction boundary. It is a portable,
little-endian, chunked representation: it never copies a C structure, pointer,
padding byte, derived cache node, or operational pointer. A valid restore is
staged, rebuilds all derived canonical and CDRSTATE2 caches, verifies the
integrated core's state digests, and only then becomes available to the machine
owner.

This is a new reconstruction format, not a claim that historical CADR save-state
files used this layout. Its target profile is the M0/M1 `CADR-WEB-303` profile
whose tracked identity is SHA-256
`1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a`.

## Evidence and scope

`CW-SRC` is the tracked production-core state definition in
[`../core/cadr_state.h`](../core/cadr_state.h) and its component headers.
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

The claim is file-representation compatibility for CDRSNAP1 version 1.0 and the
named profile. It guarantees a deterministic byte representation for equivalent
semantic M2 core state and atomic rejection of malformed or mismatched input. It
does not claim compatibility with a historical CADR, LM-3, or usim saved-state
format, nor does it make an archive authentic or authorize use of media outside
the profile's artifact boundary.

## Profile and conformance level

The sole version-1.0 profile is `CADR-WEB-303/file-representation/M2-snapshot`.
A conforming writer MUST emit the fixed header, eight required chunks, explicit
little-endian fields, directory and chunk hashes, and final trailer described
here. A conforming reader MUST reject another profile, artifact-set identity,
overlay binding, byte layout, or required semantic field rather than applying a
default. It may ignore an integrity-checked unknown optional chunk exactly as the
directory rules specify.

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

The final trailer is SHA-256 of every preceding byte. The header stores the
SHA-256 of the exact directory. Every directory entry stores the SHA-256 of the
exact uncompressed chunk payload. These checks establish integrity, not a
signature or origin authentication.

## Fixed header

| Offset | Field | Rule |
| ---: | --- | --- |
| 0 | `magic[8]` | ASCII `CDRSNAP1` |
| 8 | `major:u16`, `minor:u16` | exactly 1, 0 |
| 12 | `header_bytes:u32` | exactly 264 |
| 16 | `flags:u32` | zero |
| 20 | `chunk_count:u32` | 8 or more, bounded by parser limit |
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

Bit 0 of `flags` means *required*. All known chunks are required. An unknown
required chunk rejects the archive. An unknown optional chunk (zero flags) is
integrity-checked and then ignored; it is not preserved by a subsequent canonical
re-serialization. This is the only forward-extension path in version 1.0.

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

The canonical writer emits exactly these eight required chunks in this order.
Their fields are emitted in declaration order with nested arrays in ascending
index order. CANONICAL includes `mutation_sha256` but omits every Merkle-node
array; the parser recomputes and compares the hash before the restore hook
recreates the derived nodes. TRACE omits nested `state_v2` cache storage and the
engine pointer.
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

The caller must provide both hooks in `cadr_snapshot_restore_hooks`. The first
rebuilds **all** derived continuation storage: both the legacy canonical Merkle
nodes and `trace.state_v2`. Before it runs, the parser recomputes and compares the
legacy canonical mutation SHA-256 from decoded events. The hook must preserve
every semantic field and must leave the operational `trace.engine` pointer null.
The parser fingerprints all serialized semantic fields before and after that
callback and rejects any semantic mutation or non-null engine. The second, const
validator receives the staged state and fixed-header metadata and must recompute
and verify both the frozen M1 `CDRSTATE1` boundary digest and the full
`CDRSTATE2` continuation digest before the state is published. On any error,
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

## Integration boundary

The public ABI integration wires the production all-derived-cache rebuilder and
dual-digest validator into a fresh-machine restore transaction. The format parser
itself deliberately returns only a staged internal state; it does not make a
restored machine externally observable by itself.
