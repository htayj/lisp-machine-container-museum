---
type: Reimplementation Specification
title: CADR-WEB-303 C-M10 private disk overlay reimplementation specification
description: Normative contract for the synthetic, immutable-base, content-addressed CADR-WEB private-disk overlay, durable controller, interchange, and recovery records.
tags: [mit-cadr, cadr-web, preservation, disk, reimplementation]
timestamp: 2026-07-30T00:48:06-04:00
---

# CADR-WEB-303 C-M10 private disk overlay reimplementation specification

## Status and reconstruction claim

`CADR-WEB-303/ABI1.5/protocol-v6/C-M10-PERSIST-v1` is a clean-room
format, deterministic reference backend, browser IndexedDB durable store, and
guest/controller integration for private CADR disk pages. It provides
semantic and representation compatibility with the **selected C-M10 format profile**:
exactly sized canonical records, SHA-256-addressed immutable pages and tree nodes,
base-equal removal, generation/head activation, recovery selection, and bounded
retention collection. It also supplies a verified canonical overlay interchange,
discard, clone, compact, and recover operations. Tests use synthetic overlay
writes; controller and process-loss tests independently hash the selected public
base image before reading exact requested base pages.

The selected `CW3-PERSISTENT/process-loss` gate is closed by an external
supervisor that sends `SIGKILL` to the complete Chromium process group at every
named durable seam, restarts the same disposable browser profile, and verifies
the complete old or new activated generation. This is not physical power
removal, storage-device cache-loss evidence, or quota exhaustion. The
implementation does not claim historical CADR private-pack compatibility,
LMFS transaction compatibility, or public API compatibility. It neither reads
nor stores the selected base image, licensed media, a private disk, or a world
snapshot. The previously sketched binary `CDROVL1` encoding remains unselected;
the implemented `cadr-m10-overlay-export-v1` is an explicitly modern,
canonical-JSON clean-room interchange instead.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` state this selected reconstruction profile,
not unobserved historical behavior.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `DEC-M10` | Reviewed reconstruction decision | Profile name, immutable base identity, record sizes, fixed node/head/wrapper fields, transaction order, and gates | A historical CADR on-disk format |
| `SRC-M4` | Tracked readable source | Existing 1024-byte block-service boundary and selected base identity | M10 persistence semantics or durable behavior |
| `ROAD-M10` | Repository roadmap | M10 deliverable and old-or-new-generation persistence objective | Exact fields, algorithms, or browser implementation |
| `INF-M10` | Explicit clean-room inference | Candidate manifest offsets, in-memory object store, reference model, and defensive parser policy | That those choices were selected historical or Sol layouts |
| `TEST-M10` | Synthetic Node tests | Exercised canonical records, transaction seams, recovery, and wrapper integrity paths | Real media behavior, browser persistence, or a power-loss campaign |
| `SRC-M10-IDB` | Tracked readable source | Closed IndexedDB schema, copied immutable staging, session/writer fencing, bounded recovery, and the one-transaction head/activation primitive | CADR or filesystem behavior |
| `SRC-M10-CTRL` | Tracked readable source | COW planning, real host-request completion order, uncertainty fencing, interchange, discard, clone, compact, and recover operations | Historical CADR or LMFS behavior |
| `TEST-M10-IDB` | Disposable Chromium campaign | Chromium IndexedDB behavior under each durable seam's abort, dedicated-worker termination, and page reload; follow-up writers; fallback recovery; activation bounds; schema, handle, durability, foreign-origin/UUID, version-change, active-closure, and compaction checks | OS power loss, quota exhaustion, or private media |
| `RUN-M10-KILL` | External disposable Chromium supervisor | Whole-process-group `SIGKILL` and same-profile restart at all six durable seams plus two outstanding-transaction probes selected exactly an old or new complete generation | Physical power removal, device-cache loss, or quota behavior |
| `TODO-RUNTIME-M10` | Open oracle | The precise unclosed browser/runtime probe | Any result before it runs |

## Profile, compatibility levels, and evidence ledger

The profile binds an immutable base of 269,562,880 bytes, exactly 263,245 logical
1024-byte blocks, with LBAs `0` through `263244`, to SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The base is a read-only input callback, never an object in the overlay store.

| Level | Includes | Reserved |
| --- | --- | --- |
| `L0-format` | Strict parsers and canonical serializers for `CDROVN1`, `CDROVM1`, `CDROVH1`, and the modern `cadr-m10-overlay-export-v1` interchange | Historical archive layouts |
| `L1-memory` | Deterministic in-memory COW map, generations, atomic head/activation, recovery, and bounded collection | Worker and browser persistence |
| `L1-wrapper` | `CDRM10W1` binding wrapper around a complete `CDRM5WK1` v3 envelope | Snapshot restore integration |
| `L2-indexeddb-selection` | UUID-confined Chromium IndexedDB object staging, active closure, compaction, and head/activation selection | Physical power and quota behavior |
| `L3-controller` | Real radix-tree COW planning, host-request bridge, pre-guest staging, `IN_DOUBT` fencing, interchange, discard, clone, compact, and recover | LMFS atomicity |
| `CW3-PERSISTENT/process-loss` | Whole Chromium process loss and restart at every durable seam yields old or new complete state | Physical power removal and device-cache loss |

| Subsystem | Source/artifact witness | Runtime/manual witness | Status |
| --- | --- | --- | --- |
| Block extent and base identity | `SRC-M4`: [`cadr-m4-media.mjs`](../../cadr-web/wasm/cadr-m4-media.mjs) | No M10 runtime observation | selected by `DEC-M10` |
| M10 transaction objective | `ROAD-M10`: [browser implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md) | No durable browser run | selected order plus `INF-M10` backend |
| Fixed records | `DEC-M10` | No preserved format artifact inspected | normative selected profile |
| Phase 1 manifest offsets | `INF-M10` | No preserved format artifact inspected | frozen for this selected profile |
| Phase 1 implementation | [`cadr-m10-persistence.mjs`](../../cadr-web/wasm/cadr-m10-persistence.mjs) and synthetic tests | No private-media run | `L0-format`/`L1-memory` only |
| Browser durable selection | [`cadr-m10-indexeddb.mjs`](../../cadr-web/browser/cadr-m10-indexeddb.mjs) | Chromium 150.0.7871.124 headed-under-Xvfb and headless campaigns on synthetic data, 2026-07-29 | `L2-indexeddb-selection` only |
| Durable controller and worker bridge | [`cadr-m10-controller.mjs`](../../cadr-web/browser/cadr-m10-controller.mjs) | Synthetic controller/bridge test and durable Chromium backend campaign, 2026-07-30 | `L3-controller` |
| Browser process-loss recovery | [`run-cadr-m10-process-kill-browser.mjs`](../../scripts/run-cadr-m10-process-kill-browser.mjs) | Eight external process-group kills and same-profile restarts, including stage/head transactions with requests outstanding, Chromium 150.0.7871.124, 2026-07-30 | `CW3-PERSISTENT/process-loss` |

## Architecture and state model

```text
immutable base-page callback ──> full 24-bit radix-256 map ──> page objects
                                      │                         (SHA-256 key)
                                      v
                                node objects (SHA-256 key)
                                      │
                                      v
                         complete manifest ──> head + activation atomically
                                      │
                    active/previous/snapshot/clone/export references ──> GC roots
```

The deterministic backend has separately inspectable `meta`, `disks`, `pages`,
`nodes`, `manifests`, `heads`, `activations`, `activation_quarantine`, `refs`, and
`gc_marks` stores. This is an `INF-M10` test model, not a browser storage schema. It
retains only hashes and synthetic bytes supplied by the caller; a base page is read
when comparison or an unmapped read needs it and is never copied into those stores.
The caller MUST independently establish that its callback exposes the complete,
immutable 269,562,880-byte base with the selected whole-image SHA-256 before
initialization. The controller requires a separate identity callback and rejects
unless it returns the exact hash bound into the durable controls. This prevents an
accidentally mismatched base identity, but cannot prove that a dishonest or
later-mutated page callback returns those bytes. Checking individual callback pages
cannot establish that prerequisite, and this backend does not hash the whole base.

### `C-M10-IDB-v1` durable-selection adapter

`C-M10-IDB-v1` is `SRC-M10-IDB`: a browser adapter in
[`cadr-m10-indexeddb.mjs`](../../cadr-web/browser/cadr-m10-indexeddb.mjs), not a
second COW planner. `SRC-M10-CTRL` first constructs and validates the candidate
pages, nodes, and complete manifest. The adapter copies those supplied immutable
bytes before any asynchronous operation, verifies their content-address keys, then
stages only `pages`, `nodes`, and `manifests`. The selected base is never supplied to
or retained by this adapter.

Each disk UUID has one derived IndexedDB database name; a handle for one UUID cannot
address another UUID's `meta`, `head`, activation, or quarantine records. A database
contains only the closed records `m10-meta`, `m10-pages`, `m10-nodes`,
`m10-manifests`, `m10-heads`, `m10-activations`, and `m10-quarantine`. Byte-bearing
records contain an `ArrayBuffer` copy and an exact lowercase hash key; control
records reject unknown fields, noncanonical decimal u64s, unexpected UUID bindings,
or noncanonical activation keys. Opening requires the exact sorted object-store set
and requires every store to have the string key path `key`, `autoIncrement` false,
and zero indexes. Missing or extra stores, a wrong key path, auto-increment, or any
index reject and close the connection. Every adapter read-write transaction requests
IndexedDB `durability: "strict"` and rejects if that transaction option is
unavailable. A content-address collision requires byte equality.
This is a namespace/immutability safety boundary, not a cross-origin access control
replacement; browser same-origin policy separately confines another origin's IDB.

The adapter retains the selected 4096-record activation bound *per UUID database*.
Recovery requests at most 4097 activation records and refuses an over-bound database.
At the bound, publication prunes only the oldest unprotected record in that same
database; it retains the current head activation and immediate predecessor, and
refuses if neither can be safely removed. Durable `compact` marks the complete
selected manifest lineage and every reachable node/page while holding the disk's
writer lease. Its single sweep transaction rereads the exact writer epoch, pending
generation, and head bytes marked earlier; it deletes only unreachable immutable
objects if all still match. A concurrent writer or changed head aborts the sweep.
It deliberately does not truncate the selected lineage.

Every reopened durable handle advances the stored session high-water and clears the
writer lease and any prior session's pending-generation reservation in the same
metadata transaction before recovery. This is safe because publication clears the
reservation in the same transaction that writes the new head and activation: a
reservation left at reopen is necessarily pre-publication, while a completed
publication already has a cleared reservation. Every public adapter operation
rechecks that session after its asynchronous storage/hash work. Closing one handle
marks only that handle closed; every subsequent operation through it rejects before
durable mutation, and it does not close a newer handle's shared IDB connection. A
version-change event closes the database and makes later handle use
fail as a version-change error. An IndexedDB
`QuotaExceededError` or aborted transaction is surfaced as a failed staging or
activation operation; because a transaction contains the head, matching activation,
and pending-generation clear together, it cannot report a partial new control pair.
The quota branch is source-inspected but not capacity-exhaustion tested.

An overlay map is a three-level radix-256 tree. Its root is level 2, the next level
is 1, and leaves are level 0. The index bytes of the 24-bit LBA select levels 2, 1,
and 0 respectively. A zero 32-byte digest means absent. An absent mapping reads the
immutable base page. The empty overlay nevertheless has one real, canonical level-2
zero-root node. A level-0 digest names an exact 1024-byte content page; upper-level
digests name `CDROVN1` nodes.

Invariants:

1. A page key is SHA-256 of exactly its 1024 page bytes. A node key is SHA-256 of
   all 8232 canonical node bytes. A manifest and head have the distinct trailer
   hash rules below. Every store reread MUST reverify the key/hash relationship.
2. No mapping may name an LBA outside the selected base range. A complete map walk
   MUST also reject an unreachable child prefix, wrong node level, wrong node
   prefix, a cycle, absent referenced object, or wrong content hash.
3. A page equal byte-for-byte to its base page MUST be represented by an absent
   leaf, not a duplicate stored page. Removal prunes empty non-root paths; if the
   whole map is empty the canonical real zero root is used.
4. `high_water` reserves monotonically increasing unsigned-64 generations. Gaps
   caused by a failed transaction are legal. A writer epoch is a separate
   monotonically increasing u64; a stale epoch MUST NOT write a head.
5. Every successful open issues a monotonically increasing per-open session token.
   A new open invalidates all API objects and leases from the prior session. This
   fence applies to reads, writer operations, commits, pins, collection, and reopen,
   not merely to head publication. A read MUST recheck its token after every
   interleavable await and immediately before returning bytes. A pin MUST recheck
   after every tree/hash await and remain valid through its synchronous reference
   publication linearization point. Once the exact owned reference is retained, its
   ID MAY be delivered even if reopen invalidates the old session before the outer
   result await resumes; pre-publication invalidation still rejects without a pin.
6. Root mutation and collection coordination is backend-global, not per disk. Every
   initialize, reopen, commit, pin, or unpin advances one root epoch and invalidates
   any collector derived from an older epoch.
7. Initialization reserves the disk UUID's canonical stored record before its first
   await in explicit `INITIALIZING` phase. Reopen rejects that phase even if a head
   and activation have already been published. A concurrent same-UUID initialization
   likewise rejects and cannot return a detached handle whose runtime later diverges
   from the stored record. After recovery, session high-water, and metadata commit
   succeed, initialization synchronously changes metadata and the exact record to
   `OPEN` immediately before returning its handle. Any earlier failure removes the
   reservation, runtime, head, activations, metadata, and owned references if and
   only if the reservation is still the same canonical record in `INITIALIZING`;
   unreachable content-addressed objects may remain collection candidates.

### Browser controller and guest completion

[`cadr-m10-controller.mjs`](../../cadr-web/browser/cadr-m10-controller.mjs)
is `SRC-M10-CTRL`. It acquires the durable writer lease before loading the verified
active closure or planning any mutation and retains that lease through planning,
staging, guest completion, and publication. It applies strictly
ordered 1024-byte writes to the three-level radix tree, compares every changed
page with the independently supplied immutable base callback, and produces
only changed pages and COW nodes. It asks the durable handle to stage and
reread the page/node/manifest closure before invoking the worker's existing
`host-complete` operation. Only after that guest completion succeeds does it
ask IndexedDB to publish the new head and matching activation.

If staging or validation fails first, the guest receives failure and the old
head remains authoritative. If publication or its reread fails after
`host-complete` advanced the guest, or if its response is lost after the request
may have reached the worker, the controller enters `IN_DOUBT`, closes
the durable handle, terminates and replaces the worker through its required callback,
and permits no further disk operation until `recover` reopens and rereads the
durable store. The bridge implements the existing block-read and block-write
host-request framing; it adds no worker protocol branch and does not duplicate
guest disk-controller state.

| Operation | Durable effect |
| --- | --- |
| `exportOverlay` | Emits one verified active closure as canonical `cadr-m10-overlay-export-v1` bytes |
| `importOverlay` | Verifies the complete archive and republishes its tree under a local manifest extending the current head |
| `discard` | Rewrites every mapped LBA to immutable base bytes, producing the canonical empty real root |
| `cloneTo` | Requires the destination worker-replacement callback, initializes another UUID-confined database, and imports the verified source closure without sharing mutable controls; failure deletes the partial destination or reports aggregate cleanup failure |
| `compact` | Marks all selected lineage manifests and reachable nodes/pages, then atomically removes only unreachable immutable objects; selected lineage is not truncated |
| `recover` | Closes the stale handle and accepts only a fresh writable head or read-only bounded fallback from the durable adapter |

The controller-local mutation owner also serializes `recover` and `close`.
Either operation rejects while planning, commit, import, discard, export, clone
source capture, or compaction is active. `recover` retains that owner across the
entire durable reopen, so a new mutation or `close` also rejects until recovery
finishes. `close` never silently races an operation whose callbacks may still run.

## Canonical records

All multi-byte integers are little-endian. A parser MUST reject wrong total size,
wrong magic/schema/version, unknown flags, nonzero reserved bytes, overflow,
out-of-range resources, and a digest mismatch. The implementation copies input
bytes before retaining them so later mutation cannot alter a validated object.

### `CDROVN1` radix node

`CDROVN1` is exactly 8232 bytes: 40 header bytes plus 256 32-byte child digests.
There is no room for an in-record digest; the object address is SHA-256 of all 8232
bytes. This follows directly from the selected size and fields (`DEC-M10`).

| Offset | Width | Field | Rule |
| ---: | ---: | --- | --- |
| 0 | 8 | magic | ASCII `CDROVN1` followed by NUL |
| 8 | 2 | schema | `1` |
| 10 | 1 | level | `0`, `1`, or `2` |
| 11 | 1 | flags | zero |
| 12 | 4 | header bytes | `40` |
| 16 | 4 | node bytes | `8232` |
| 20 | 4 | child count | `256` |
| 24 | 8 | prefix | Canonical for its level |
| 32 | 8 | reserved | zero |
| 40 | 8192 | child digests | 256 SHA-256 values; all-zero means absent |

For level 2 the prefix MUST be zero. For level 1 it MUST have its low 16 bits zero;
for level 0 its low 8 bits zero. The child at index `i` of an upper node has prefix
`parent-prefix OR (i << (level * 8))`. A complete walk applies the base LBA bound at
the level-0 child, not merely the nominal 24-bit address space.

### `CDROVM1` complete manifest

`CDROVM1` is 352 bytes: a 320-byte header followed by SHA-256 of bytes `0..319`.
Only the `COMPLETE` flag (`1`) is legal. The fields below are the **frozen Phase 1
candidate offset table** chosen under `INF-M10`: the reviewed decision selected all
required fields and sizes but did not assign their offsets. Any change requires a
new schema or selected profile; an implementation MUST NOT silently reinterpret
bytes written under this profile.

| Offset | Width | Candidate field |
| ---: | ---: | --- |
| 0 | 8 | `CDROVM1` plus NUL |
| 8 | 4 | schema `1` |
| 12 | 4 | header bytes `320` |
| 16 | 4 | manifest bytes `352` |
| 20 | 4 | flags `COMPLETE` |
| 24 | 8 | generation |
| 32 | 8 | parent generation (lineage only) |
| 40 | 8 | base bytes `269562880` |
| 48 | 8 | base blocks `263245` |
| 56 | 4 | block bytes `1024` |
| 60 | 4 | reserved zero |
| 64 | 8 | overlay entry count |
| 72 | 4 | fanout `256` |
| 76 | 4 | depth `3` |
| 80 | 16 | disk UUID |
| 96 | 32 | base SHA-256 |
| 128 | 32 | profile SHA-256 |
| 160 | 32 | artifact-set SHA-256 |
| 192 | 32 | parent manifest SHA-256 |
| 224 | 32 | root-node SHA-256 |
| 256 | 64 | reserved zero |
| 320 | 32 | SHA-256 of header bytes `0..319` |

Generation zero is the genesis manifest: both parent generation and parent hash are
zero. A later generation MUST name an older generation and a nonzero parent
manifest. Opening verifies the entire parent generation chain and validates the
current manifest's exact reachable map count. The manifest records lineage only;
it does not encode a separate delta list. Phase 1 retains that complete ancestry as
a collection root. It implements no history compaction or parent-chain truncation.
A future compactor must define a separately activated baseline and compatible
lineage rule under a new profile before it can discard ancestors.

### `CDROVH1` active head

`CDROVH1` is exactly 296 bytes. Its final 32 bytes are SHA-256 of bytes `0..263`.
All fields and offsets in this table are `DEC-M10`.

| Offset | Width | Field |
| ---: | ---: | --- |
| 0 | 8 | `CDROVH1` plus NUL |
| 8 | 4 | schema `1` |
| 12 | 4 | bytes `296` |
| 16 | 4 | flags zero |
| 20 | 4 | reserved zero |
| 24 | 8 | head sequence |
| 32 | 8 | writer epoch |
| 40 | 16 | disk UUID |
| 56 | 8 | active generation |
| 64 | 32 | active manifest hash |
| 96 | 32 | active root hash |
| 128 | 8 | previous generation |
| 136 | 32 | previous manifest hash |
| 168 | 32 | previous root hash |
| 200 | 32 | base hash |
| 232 | 32 | profile hash |
| 264 | 32 | SHA-256 of bytes `0..263` |

The initial head has a real activated generation-zero manifest and head sequence 1.
An absent previous record has all-zero previous fields. A later head may name
generation zero as its nonzero previous manifest; therefore generation number zero
alone does not indicate absence.

### `CDRM10W1` snapshot binding wrapper

The safe selected wrapper is implemented in
[`cadr-m10-wrapper.mjs`](../../cadr-web/wasm/cadr-m10-wrapper.mjs). It is a 256-byte
header followed by a complete `CDRM5WK1` version-3 envelope described in the
[M5 scheduler specification](cadr-deterministic-machine-scheduler-reimplementation-specification.md).
Before any asynchronous hash or semantic validation, the wrapper implementation
copies the complete supplied wrapper/M5 bytes and validates and emits only that
immutable candidate. A validator receives a separate copy and cannot alter the
candidate through its argument or a closure over the caller's original buffer.
The wrapper parser verifies the inner magic, version, flags, raw length, control
witness invariants, and M5 envelope hash. It also structurally validates the
selected `CDRSNAP1` minor-2 header, fixed profile/artifact hashes, sorted contiguous
chunk directory, required chunk set, chunk hashes, and final body hash. It then
MUST invoke a supplied worker/core semantic validator and accept only an exact
`true` result. Serialization and parsing fail closed if that validator is absent.
Calling the existing worker validator directly is deferred to the integration owner;
the Phase 1 module does not duplicate that semantic decoder or claim integration.
Directory ordering matches the selected core: the first entry has no predecessor,
so optional type `0` with flags zero is legal there; every later type MUST be
strictly greater. Required types `1` through `10` remain present exactly once with
required flag `1`.

| Offset | Width | Field |
| ---: | ---: | --- |
| 0 | 8 | `CDRM10W1` |
| 8 | 4 | version `1` |
| 12 | 4 | header bytes `256` |
| 16 | 4 | flags: only binding-required bit 0 (`1`) |
| 20 | 4 | reserved zero |
| 24 | 8 | inner length |
| 32 | 8 | base bytes `269562880` |
| 40 | 4 | block bytes `1024` |
| 44 | 4 | reserved zero |
| 48 | 16 | disk UUID |
| 64 | 16 | snapshot UUID |
| 80 | 8 | durable generation |
| 88 | 8 | head sequence |
| 96 | 32 | manifest hash |
| 128 | 32 | root hash |
| 160 | 32 | base hash |
| 192 | 32 | profile hash |
| 224 | 32 | SHA-256 of header bytes `0..223` followed by inner bytes |
| 256 | N | complete `CDRM5WK1` v3 inner envelope |

### `cadr-m10-overlay-export-v1` interchange

The implemented interchange is canonical UTF-8 JSON with an outer
`{body,sha256}` envelope. `sha256` covers the byte-exact canonical body. The
body binds the schema, source disk UUID, selected base/profile/artifact hashes,
source generation, entry count, root hash, and sorted unique page and node
arrays. Each object carries lowercase content hash and lowercase exact bytes.
The parser limits the complete archive to 320 MiB, rejects unknown fields,
duplicates, reordering, malformed hex, hash mismatch, wrong node level/prefix,
cycles, aliases, missing children, unreachable extra objects, and a tree count
different from `entry_count`. Import never imports source head, activation,
session, writer, or generation-control records; it publishes a fresh manifest
in the destination UUID namespace.

This is an `INF-M10` clean-room browser interchange, not a historical CADR
format and not the previously sketched binary archive.

### Deferred binary `CDROVL1` archive

`CDROVL1` is not implemented. `DEC-M10` fixes its 320-byte header,
then `N * 64` sorted directory entries and payloads, followed by a final hash. A
directory entry is `(kind u32, flags-zero u32, offset u64, length u64, sha256[32],
reserved-zero u64)`, sorted by kind and hash; the archive contains exactly the
reachable closure and has a 320 MiB maximum. Its header offsets and digest binding
were not selected, so implementing a codec would falsely invent an interchange
format.

`TODO-RUNTIME-M10-CDROVL1-HEADER`: obtain a reviewed header offset/digest table
only if binary `CDROVL1` interoperability becomes a separate selected profile,
then add strict export/import codecs, malformed archive cases, maximum-size checks,
and a closure comparison against the in-memory map.

## Lifecycle, transaction, and recovery model

The durable state machine is:

```text
CLEAN --beginWriter(epoch)--> CLEAN/leased
  --validated base comparisons--> private COW objects
  --core completion--> DIRTY + paused working root
  --reserve generation--> complete manifest
  --atomic head + activation--> published generation
  --reread verified head--> CLEAN

post-core pre-activation failure --> SAVE_FAILED + paused candidate working root
corrupt/unavailable current head --reopen--> prior candidate or RECOVERY_REQUIRED
no valid activated candidate --reopen--> refuse to mount
```

The `DIRTY` state is a logical pause after the guest/core-completion boundary and
before durable publication. If any later pre-activation step fails, the disk remains
paused in explicit `SAVE_FAILED`, retains the candidate as `workingRootSha256`, and
continues to expose the unchanged durable root for reads. It MUST NOT unpause or
report the old head as a clean completion. The browser controller strengthens
this reference-backend state: after guest completion, uncertain publication
terminates and replaces the worker and requires durable reopen; before guest completion, it
reports host failure and may release the lease. Explicit discard and recover
are implemented maintenance operations.

### Commit contract

Preconditions: the disk is writable, the caller owns the current writer epoch, the
expected head sequence matches, each write has an exact 1024-byte page, and writes
are in strictly increasing LBA order. Duplicate or unordered writes are rejected
rather than made order-dependent. A backend accepts only one commit invocation at a
time for a disk and rejects another immediately. Reopen is likewise rejected while
the commit is active.

Required order:

1. Validate disk binding, epoch, head sequence, resource limits, write order, and
   every LBA.
2. Read each relevant immutable base page and convert byte-equal writes into map
   removals.
3. Build changed pages and exactly the affected COW three-node paths privately.
4. CAS-insert each page/node by hash and reread it with hash verification.
5. Cross the core-completion seam.
6. Publish the working root in `DIRTY`/paused runtime state.
7. Reserve a new generation from `high_water`; a later abort may leave this gap.
8. Build, CAS-insert, and reread a complete manifest.
9. Recheck the open-session token, writer epoch, expected in-memory head, stored
   head bytes, and identical current activation. In one non-awaiting logical action,
   replace `heads[disk]` and write the identical activation at
   `activations[disk, head-seq]`.
10. Reread and verify the active head, manifest, root, and map; only then become
    `CLEAN` and report durable success.

The same current-head checks run after validation and again immediately before
activation, after the last await or injected callback. The head/activation action is
logically atomic in the deterministic backend: no
callback or await separates its two map mutations. A production durable backend
MUST supply an equivalent all-or-neither transaction. An error before that action
leaves the old active head. Pages, nodes, a reserved generation, or a manifest may
leak and are later collection candidates; they are not active state. If core
completion already succeeded, that error produces the paused `SAVE_FAILED` state
described above. An error at or after publication is uncertain: the caller MUST
reread the head. If it names the new validated manifest, the operation reports
durable success with `recoveredAfterFault`; otherwise it reports the original
failure.

Immediately before that non-awaiting publication, the backend quarantines malformed
records within an already bounded activation log and preflights one free slot. At
the 4096-record boundary it preserves every open disk's current activation and
immediate predecessor, proves sufficient unprotected candidates exist, then removes
the oldest candidates before adding the new activation. It rejects without partial
canonical-history pruning if no safe slot exists. Publication therefore cannot
produce record 4097 and report a durable head that recovery categorically refuses
to scan.

Every named transition has an injectable `before-*` and `after-*` seam: validation,
base comparison, private build, page CAS, core completion, dirty publication,
generation reservation, manifest CAS, head/activation, head reread, and clean
publication. `TEST-M10` runs a synthetic fault at all of them. This proves only the
in-memory transition implementation, not loss behavior of IndexedDB, OPFS, browser
termination, or an actual power source.

### Browser durable-selection suffix

`SRC-M10-IDB` implements only the durable suffix of this transaction. Its caller
first owns steps 1--8, reserves a generation through the adapter, and supplies a
complete candidate manifest plus the immutable closure to stage. The adapter
revalidates the candidate's disk/profile/artifact binding, direct parent, reachable
node/page closure, entry count, session, writer lease, and expected active head. It
then performs this browser-specific order:

1. `before-stage`; copy, validate, CAS-stage immutable candidate bytes; then
   `after-stage`.
2. Verify the candidate closure and reread current control state.
3. `before-head-activation`; boundedly preflight an activation slot.
4. In one IndexedDB read-write transaction, recheck the stored old head and its
   matching activation, then put the next head, identical next activation, and
   pending-generation clear. The transaction's completion is the publication point.
5. `after-head-activation`, `before-reread-head`, a fresh atomic control snapshot
   and complete closure verification, then `after-reread-head`.

The callback ledger is exactly `before-stage`, `after-stage`, `before-head-activation`,
`after-head-activation`, `before-reread-head`, and `after-reread-head`. Hooks occur
only outside an active IDB transaction. Therefore a callback hook cannot extend a transaction
across an arbitrary callback: it observes either the pre-publication pair or the
completed transaction. These hooks do not interrupt an outstanding request *inside*
the publication transaction. A rejection
before completion leaves the old selected head;
a post-completion callback/re-read error performs the normal uncertain-result reread
and returns durable success only if that reread names the new head.

`TEST-M10-IDB` ran a disposable Chromium 150.0.7871.124 origin both headed under
Xvfb and headless against all six ledger seams. For each seam it separately injected
an exception, terminated the dedicated worker at the parked hook, and reloaded the
page; it also mutated the caller's candidate page only after `commit` had entered.
Each restart saw exactly generation/head `(0,1)` or `(1,2)` with the original
matching map root, never a head without its matching activation or a late-mutated
page. After each of the nine pre-publication faults, a fresh reopened writer cleared
the abandoned reservation, reserved generation 2, and durably committed head
sequence 2. The same campaign retained a nonmutating canonical full-store hash for a
second same-origin UUID database, reopened and reread an iframe's foreign-origin
database, rejected real missing-store, extra-store, wrong-key-path, auto-increment,
and indexed schemas, proved a stale handle's `close()` did not close the current
handle or permit closed-handle metadata mutation, instrumented page-realm
read-write transactions to require strict durability, forced fallback recovery from
a corrupt current head while quarantining a forged high-sequence activation, and
published at the real 4096-record activation boundary. It exported the exact empty
active closure and removed staged unreachable page/node objects without changing
the active generation. It also forced a same-origin
IDB version upgrade to confirm that the old handle was fenced. The HTTP harness
served only an exact preloaded fixture allowlist, validated `Host`, and returned 404
for GET and HEAD probes of repository-private and unrelated paths.

`RUN-M10-KILL` separately exercises the production controller and IndexedDB adapter
inside a dedicated browser Worker. Its guest endpoint is an explicitly synthetic
host-request protocol responder, not production
[`cadr-worker.js`](../../cadr-web/wasm/cadr-worker.js) or a running CADR Wasm
machine. In addition to the six parked callback seams, synchronous probes post an
out-of-renderer signal and enter `Atomics.wait` on a `SharedArrayBuffer` before
returning from the IndexedDB transaction scheduler. The first stage request or
head-publication metadata request therefore remains outstanding until the external
supervisor kills the complete Chromium process group. Repeated campaign runs
selected the complete old state at both outstanding-transaction barriers.

Before launching Chromium, the supervisor reads the selected base from a local
path, requires exactly 269,562,880 bytes, independently computes the selected
whole-image SHA-256, and refuses any mismatch. The isolated controller Worker then
uses bounded HTTP Range requests for the actual base pages and obtains the verified
identity from the host. The campaign no longer attests the selected hash while
serving unrelated zero pages.

`RUN-M10-KILL` used a separate host process, not page script, to launch
Chromium with a disposable persistent profile. At each of the six seams the
page parked the durable operation, the host sent `SIGKILL` to the complete
Chromium process group, waited for exit, restarted Chromium on the same
profile, and reopened the complete closure. `before-stage`, `after-stage`, and
`before-head-activation` selected generation/head `(0,1)`;
`after-head-activation`, `before-reread-head`, and `after-reread-head` selected
`(1,2)`. No run observed a mixed head/root/activation. The profile was removed
after the campaign. This closes browser process loss and restart at the named
seams. It does not place the kill inside an unobservable internal IndexedDB
request, remove machine or storage power, test device-cache loss, exhaust
quota, or use CADR media.

### Writer fencing and activation recovery

`beginWriter` issues a new writer epoch only when no lease is active. `closeWriter`
releases it. Reopening first issues a new session token, advances the session
high-water, and clears old leases and pending reservations, so every previous API object is stale before
recovery awaits. A head records the epoch that published it, but a head sequence
remains the optimistic commit comparison value. Exhaustion of any session, writer,
generation, or head-sequence u64 fails closed; values never wrap.

Open/reopen uses the following defensive order:

1. Parse and hash-verify the current head; require the identical activation keyed
   by its disk UUID and head sequence; then validate its active manifest, lineage,
   root, and map.
2. If an intact current head supplies a valid previous binding, try that previous
   generation without treating a zero generation as absence.
3. Provided the backend contains no more than 4096 activation records total,
   quarantine malformed keys and records, then try canonical records for the disk
   in descending head-sequence order. Each candidate is reread by its exact key
   before use. Its outer key, UUID namespace, and sequence MUST equal the parsed
   head's UUID and sequence; a high outer sequence cannot promote lower-sequence
   head bytes. A key is exactly
   `lowercase-disk-uuid-hex ":" canonical-decimal-u64`, with a nonzero sequence.
   Malformed records do not stop a later valid candidate, but an over-limit
   activation volume refuses recovery rather than performing an unbounded scan.
4. If a fallback succeeds, retain the exact validated head and manifest bytes as a
   private read-only snapshot and expose only that snapshot in `RECOVERY_REQUIRED`;
   later `active()` calls do not return the corrupt current-head store.
   If none succeeds, refuse the mount. It MUST NOT manufacture an empty overlay.

This makes unactivated manifests deliberately unrecoverable: creation alone is not
durable selection evidence.

## References, collection, and abort behavior

Every disk's active and previous head manifests are mandatory backend-global GC
roots. Callers may add named `snapshot`, `clone`, or `export` root references only
after the complete proposed tree verifies. Each disk reserves reference identifiers
from its own monotonic bounded u64 high-water; deletion never permits identifier
reuse. Unpin verifies the stored reference ID, disk UUID, and legal kind before
deletion, so one disk cannot remove another disk's root. Pin publication is a
linearization point: session invalidation during the synchronous map mutation rolls
back the exact just-published reference and rejects, as does a store mutation that
throws after insertion; invalidation after publication does not turn a successfully
returned ID into an unreachable leaked root. Marking follows manifests
to roots, parent manifests, nodes, and pages. The collector accepts a finite step budget and
uses `gc_marks`; only one invocation may run across the backend at once, and it
sweeps pages, nodes, and manifests only after a complete mark. Any root mutation on
any disk advances the global root epoch, clears marks, and makes an older collector
return `invalidated` before deletion. If a root mutation is already active,
collection returns `blocked`. An interrupted or invalidated mark/sweep can leak
unreachable objects, but MUST NOT delete a live one.

The store does not claim byte-level zeroing of JavaScript garbage-collected copies.
This is a test backend and uses synthetic data; any durable implementation needs a
separate confidentiality and deletion policy.

## Semantic protocol inventory

| Operation | Inputs | Result | Failure/abort semantics |
| --- | --- | --- | --- |
| Initialize | bound disk UUID, profile/artifact hashes, base-page callback | one canonical `INITIALIZING` reservation, then activated `OPEN` generation-zero map | reopen/concurrent initialize reject until commit; failure rolls back exact initializing owner |
| Read block | in-range LBA | mapped page or fresh base callback page | stale session after any await, malformed/corrupt stored page reject; no fallback |
| Begin/close writer | current lifecycle and epoch | exclusive epoch or released lease | stale/concurrent epoch rejects |
| Commit | epoch, expected head sequence, ordered 1024-byte writes | unchanged result or durable new generation | follows transaction order and uncertain-head reread above |
| Reopen | same independently verified immutable binding plus fresh base callback | writable active head or read-only recovered head | invalidates all earlier session handles; no valid activation refuses mount |
| Pin/unpin root | `snapshot`, `clone`, or `export`; complete root hash | monotonic owned retained/released GC reference | stale session, invalid tree, unknown reference, or cross-disk ownership rejects |
| Collect | positive finite step budget | backend-global incremental mark/sweep report | concurrent invocation rejects; mutation blocks or invalidates |
| Wrap snapshot | bound overlay identity, complete `CDRM5WK1` v3, and injected semantic validator | `CDRM10W1` bytes | absent validator or structural/semantic/integrity failure rejects |
| IndexedDB durable selection | selected binding, session/writer epoch, reserved complete manifest, immutable closure | atomically activated next head plus matching activation | closed-schema, stale-session, quota, version-change, bounded-activation, or closure failure rejects; a post-publication fault rereads |
| Worker disk bridge | one existing block-read or block-write host request | exact overlay/base read completion or staged-COW write completion | pre-guest failure completes with host failure; ambiguous completion response or post-guest publication uncertainty terminates/replaces the worker and requires reopen |
| Export/import | verified active closure or canonical `cadr-m10-overlay-export-v1` | bounded canonical archive or locally republished tree | malformed, foreign binding, incomplete, aliased, cyclic, unreachable-extra, or over-size archive rejects before publication |
| Discard/clone/compact/recover | current durable session and operation-specific destination | empty overlay, independently controlled clone, collected unreachable objects, or reopened selected state | stale/read-only/conflicting sessions reject; compaction never truncates selected lineage |

This is a semantic JavaScript module inventory, not an historical source interface.
No CADR Lisp function or historical persistence API is claimed. The worker bridge
uses the already selected host-request operations and adds no new worker ABI.
The layer treats all 1024-byte pages as opaque. LMFS directory structure, allocation,
file update atomicity, and filesystem repair semantics are explicitly deferred; no
overlay transaction is evidence of a filesystem-level atomic operation.

## Conformance suite and comparison procedure

| ID | Profile/level | Synthetic action | Objective pass condition |
| --- | --- | --- | --- |
| `M10-F01` | `L0-format` | Serialize/parse node, manifest, and head; mutate reserved/hash-covered bytes | fixed byte sizes, candidate table, and strict rejection hold |
| `M10-F02` | `L1-memory` | Write a base-different page, a high LBA page, then restore the first page to base | lookup follows full map; base-equal write removes the mapping |
| `M10-F03` | `L1-memory` | Close/reopen writer and attempt old epoch | stale epoch is fenced |
| `M10-F04` | `L1-memory` | Corrupt current head then reopen; corrupt every activation and reopen | valid older activation is read-only recovery; no valid activation refuses mount |
| `M10-F05` | `L1-memory` | Inject each before/after transaction seam | old complete state or reread new complete state, never an in-memory mixed head |
| `M10-F06` | `L1-memory` | Pin a snapshot root across a later remove and collect in tiny budgets | marked page survives; bounded collection completes |
| `M10-F07` | `L1-memory` | Reopen and exercise every prior API handle | every stale read, mutation, lease, collection, and reopen rejects |
| `M10-F08` | `L1-memory` | Hold one commit at an async barrier; race a second commit, reopen, and collection | second commit/reopen reject and collection blocks |
| `M10-F09` | `L1-memory` | Interleave disk-A collection with disk-B pin/commit and concurrent collection | global epoch invalidates, active mutation blocks, one collector is serialized, disk-B live data survives |
| `M10-F10` | `L1-memory` | Insert malformed, oversized, and over-volume activation keys/records | malformed records quarantine without hiding a valid candidate; over-limit scan refuses |
| `M10-F11` | `L0-format`/`L1-memory` | Exercise zero/partial bindings, count bounds, invalid pins, and u64 high-water exhaustion | canonical validation and every no-wrap boundary fail closed |
| `M10-F12` | `L1-memory` | Race two same-UUID initializations, commit through the sole handle, then reopen | one initialization rejects; canonical reopen sees the committed head and page |
| `M10-F13` | `L1-memory` | Delete/recreate a pin and attempt cross-disk unpin | IDs increase without reuse and foreign ownership cannot delete |
| `M10-F14` | `L1-memory` | Gate old-session base read and root validation across reopen | both operations reject after their await and no stale pin is published |
| `M10-F15` | `L1-memory` | Gate after genesis head/activation, attempt reopen, remove metadata, release, then retry | reopen rejects `INITIALIZING`; exact owned control records roll back; retry reaches `OPEN` and reopens |
| `M10-F16` | `L1-memory` | Reopen synchronously inside final pin-map publication | stale publication rolls back its exact reference and leaves no leaked root |
| `M10-F17` | `L1-memory` | Fill activation log with hash-valid same-UUID heads to 4096, commit, and reopen | oldest unprotected valid history prunes, size remains bounded, new head recovers |
| `M10-F18` | `L1-memory` | Queue reopen after exact pin publication but before the outer result continuation | old call returns its retained ID; foreign disk cannot unpin; reopened same disk may release it |
| `M10-I01` | `L2-indexeddb-selection` | Abort, terminate the worker, and reload at all six external durable seams | reopen selects exactly old or new complete state; every pre-publication case then admits a fresh successful writer |
| `M10-I02` | `L2-indexeddb-selection` | Corrupt current head and add a forged higher-sequence activation carrying genesis bytes | fallback returns the exact validated read-only snapshot twice; forged record is removed and quarantined |
| `M10-I03` | `L2-indexeddb-selection` | Exercise every operation on a closed handle; open databases with missing/extra stores, wrong key path, auto-increment, or an index | current handle stays usable; closed handle cannot mutate metadata; every non-exact schema rejects and closes |
| `M10-I04` | `L2-indexeddb-selection` | Hash every store of a second UUID without reopening it; reopen/reread a foreign-origin database | same-origin foreign UUID is byte-inventory unchanged; foreign origin rereads the same selected state |
| `M10-I05` | `L2-indexeddb-selection` | Fill a real database to 4096 canonical activations, publish, and inspect | current/new records survive, oldest disposable record prunes, total remains 4096 |
| `M10-I06` | `L2-indexeddb-selection` | Instrument page-realm transactions and statically require the adapter's single transaction factory | every observed read-write transaction requests strict durability; no adapter bypass exists |
| `M10-I07` | `L2-indexeddb-selection` | Export active closure, stage unreachable page/node, compact, and reread | exact closure is returned; only unreachable objects disappear; active generation is unchanged |
| `M10-I08` | `L2-indexeddb-selection` | Race commit and compact in both directions and alter the marked epoch/head before sweep | controller admits only one mutation; stale epoch/head sweep rejects before deletion |
| `M10-C01` | `L3-controller` | COW-write through staged guest completion, then read, discard, import, clone, compact, and recover | staging precedes guest completion and activation; every operation preserves binding and expected bytes |
| `M10-C02` | `L3-controller` | Fail publication after completion or make an actual Worker-thread protocol fixture consume completion and exit before responding | controller enters `IN_DOUBT`, closes the handle, terminates/replaces the Worker, and recovers only by durable reopen; this does not claim production `cadr-worker.js` execution |
| `M10-C03` | `L3-controller` | Service framed block read/write through the worker bridge | completion bytes and durable write order match the existing host-request protocol |
| `M10-C04` | `L3-controller` | Hold commit/compact while attempting recover/close, then hold recover while attempting mutation/close | every overlapping operation rejects and the surviving owner completes cleanly |
| `M10-P01` | `CW3-PERSISTENT/process-loss` | External host kills complete Chromium process group at each durable seam and while stage/head transactions are outstanding, then restarts same profile | pre-publication seams select old complete state; post-publication seams select new complete state; outstanding head transaction selects old or new; none mix |
| `M10-W01` | `L1-wrapper` | Wrap a structurally valid synthetic `CDRSNAP1` in M5; corrupt outer or inner bytes | both binding and inner integrity reject |
| `M10-W02` | `L1-wrapper` | Omit or reject the injected validator and wrap arbitrary M5 payload bytes | validator omission fails closed and arbitrary bytes never pass structural validation |
| `M10-W03` | `L1-wrapper` | Validator mutates its argument and caller-owned M5 during an await | emitted wrapper contains the exact pre-validation snapshot and reparses successfully |
| `M10-W04` | `L1-wrapper` | Hash a directory with optional type `0` followed by required types `1..10` | first type zero is accepted and every subsequent type remains strictly increasing |

Run the Phase 1 synthetic checks with:

```sh
node tests/test_cadr_m10_persistence.mjs
node tests/test_cadr_m10_wrapper.mjs
node tests/test_cadr_m10_controller.mjs
node tests/test_cadr_m10_indexeddb_static.mjs
node scripts/run-cadr-m10-indexeddb-browser.mjs
node scripts/run-cadr-m10-process-kill-browser.mjs
xvfb-run -a node scripts/run-cadr-m10-indexeddb-browser.mjs --headed
python3 .agents/skills/write-reimplementation-specs/scripts/audit_spec.py \
  --require-frontmatter docs/mit-cadr/cadr-private-disk-overlay-reimplementation-specification.md
```

The process-kill command requires the selected public base at the ignored
repository-relative default `l/usim/disk-sys-303-0.img`, or at the path named by
`CADR_M10_BASE_IMAGE`. The supervisor hashes it before Chromium starts and refuses
any size or digest mismatch.

`M10-P01` closes externally imposed Chromium process loss and same-profile
browser-engine restart at every observable durable seam. It also closes two
additional probes whose notifications are emitted synchronously while the stage and
head transactions have outstanding IDB requests. The exact lower-level instant at
which the storage engine makes an outstanding transaction durable remains
unobservable; the reopened head-transaction case is therefore allowed to select
either complete old or complete new state, never a mixture.

`TODO-RUNTIME-M10-PHYSICAL-POWER`: on a disposable host and storage device whose
cache/power controls are measurable, remove machine or device power at the same
operation sequence and verify the reopened closure. `M10-P01` does not claim this
hardware result.

`TODO-RUNTIME-M10-IDB-QUOTA`: impose a repeatable, measured storage quota on the
disposable origin, exhaust it during immutable staging and control publication, and
verify both the typed quota result and the complete reopened selection. The current
campaign does not claim that capacity-exhaustion oracle.

## Snapshot and rights boundary

`CDRM10W1` cryptographically binds an already complete M5 snapshot to a synthetic
overlay identity. It does not grant redistribution rights to any inner snapshot,
world state, base disk, or application content. Tests construct only synthetic
`CDRM5WK1` bytes. Any future use with a private disk or licensed payload MUST keep
those inputs and raw output in the repository's ignored private/session areas and
publish only permitted metadata or separately reviewed evidence. This page contains
no screenshot claim and requires none. Runtime writes are synthetic; the
process-loss campaign reads only exact pages from the independently verified public
selected base and never modifies that file.

## Known unknowns and nonclaims

- The `CDROVM1` offset table is the frozen clean-room Phase 1 candidate for this
  profile, not an observed historical layout. A change requires a new schema/profile.
- Binary `CDROVL1` header offsets/digest grammar are unselected. The implemented
  canonical-JSON interchange is a distinct modern profile.
- LMFS transaction semantics, selected-history truncation, quota exhaustion,
  physical power/device-cache loss, private base-media execution, and direct
  snapshot-wrapper use by a running worker remain outside the closed claim.
- The historical CADR private-disk representation, if any, was not inspected and is
  not being reconstructed by this clean-room profile.
- `C-M10` and `CW3-PERSISTENT/process-loss` are closed for synthetic opaque disk
  pages and the selected browser controller. This is not CADR media, LMFS, physical
  power, or filesystem-level atomicity evidence.

## Sources

- [CADR browser WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md), M10 section, verified 2026-07-29.
- [`cadr-m4-media.mjs`](../../cadr-web/wasm/cadr-m4-media.mjs), selected immutable base metadata and 1024-byte block boundary, inspected 2026-07-29.
- [CADR-WEB deterministic machine scheduler reimplementation specification](cadr-deterministic-machine-scheduler-reimplementation-specification.md), `CDRM5WK1` version-3 inner envelope, verified 2026-07-29.
- [`cadr-m10-indexeddb.mjs`](../../cadr-web/browser/cadr-m10-indexeddb.mjs) and [`run-cadr-m10-indexeddb-browser.mjs`](../../scripts/run-cadr-m10-indexeddb-browser.mjs), inspected and run headed under Xvfb and headless with Chromium 150.0.7871.124 on 2026-07-29; all input was synthetic and the temporary browser profile was removed after each campaign.
- [`cadr-m10-controller.mjs`](../../cadr-web/browser/cadr-m10-controller.mjs) and [`run-cadr-m10-process-kill-browser.mjs`](../../scripts/run-cadr-m10-process-kill-browser.mjs), inspected and run with synthetic overlay writes and exact pages from the independently hashed selected public base under Chromium 150.0.7871.124 on 2026-07-30; two consecutive eight-kill runs, including two `SharedArrayBuffer`/`Atomics.wait` barriers with IDB requests outstanding, selected only complete generations and each disposable browser profile was removed.
- `DEC-M10`, reviewed Phase 1 reconstruction decision supplied to this implementation on 2026-07-29; it is a project decision, not a historical artifact witness.
