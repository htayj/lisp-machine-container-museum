---
type: specification
title: CADR-WEB-303 M6-DEVID1 disk-evidence continuation policy
description: Separate M6 profile retaining the frozen 512-event evidence prefix and committing later final events in a SHA-256 tail witness.
timestamp: 2026-07-29T21:07:00-04:00
---

# CADR-WEB-303 M6-DEVID1 disk-evidence continuation policy

M6-DEVID1 retains exactly the frozen M4 `CDRDISKEVID1` prefix of 512 complete events and commits later complete events through a SHA-256 tail; it does not alter M4 capacity, record bytes, overflow behavior, state records, or snapshots.

## Profile and evidence status

The selected profile is `CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1`, with policy identifier `M6-PREFIX512-TAILSHA256-v1`. Its compatibility boundary is the existing portable M4 evidence representation, not historical CADR disk behavior. This result does not claim a completed System 303 boot or READY4 result and reserves those claims for a reviewed release envelope and runtime observation. `TODO-RUNTIME-M6-DEVID-READY4` remains open.

The frozen M4 record layout and serializer are implementation evidence; M6-DEVID1 adds a separately compiled state extension only.

## Architecture and compatibility boundary

The compatibility target is the selected portable `CADR-WEB-303` profile, not a claim of historical System 303 disk forensic compatibility. M6-DEVID1 MUST preserve the M4 capacity, record bytes, serializer, fault disposition, state-record bytes, and wire behavior outside its separately selected build. It excludes a generalized audit log, snapshot continuation, any M7 display-policy change, and a claim that the tail proves unobserved guest data.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` have their usual requirements meanings for an independent implementation of this portable profile.

## Atomic event rule

Before either prefix append or tail hashing, the controller calls one M6-only final-event producer that constructs a temporary canonical 384-byte event with its final descriptor, payload, delivery, and page hashes. In particular, write-delivery copies the raw completion hash into `delivery_sha256` before write-delivery and write-application replace `page_sha256` with the request-payload hash. M6 never uses the M4 post-append mutation path and never modifies prefix slot 511 while appending a tail event or recording a limit rejection.

The first 512 accepted events are copied byte-for-byte in the frozen prefix representation. For event 512 and later, M6 computes:

`H0 = SHA256("CDRM6TAIL1\\0" || "M6-PREFIX512-TAILSHA256-v1\\0" || LE64(512))`

`H(i + 1) = SHA256("CDRM6TAIL1\\0" || H(i) || canonical-event-384)`

The selected maximum is `0x7fffffffffffffff`; the test-only compile-time seam may select a smaller value. The next event at that maximum is rejected with a guest fault and records the final rejected-event digest without extending either the prefix or tail.

## `CDRM6E1`

`m6-disk-evidence-summary` is protocol-v4-only and requires explicit worker instantiation with `m6DiskEvidencePolicy: true`. It returns a fixed 512-byte little-endian `CDRM6E1` record. Its fixed fields are policy code and flags, retained-prefix capacity/count, selected maximum, accepted/tail counts, last event order and tuple, nine per-kind counts, prefix SHA-256, tail SHA-256, and a limit-rejection witness. Bytes 352–511 are required zero. The worker parses this record as a closed schema and returns its SHA-256 with the record.

| Offset | Width | Field | Required value or meaning |
| ---: | ---: | --- | --- |
| 0 | 8 | magic | ASCII `CDRM6E1` followed by one zero byte |
| 8 | 4 | schema version | little-endian `1` |
| 12 | 4 | record bytes | little-endian `512` |
| 16 | 4 | policy code | `1`, for `M6-PREFIX512-TAILSHA256-v1` |
| 20 | 4 | flags | bit 0: tail started; bit 1: selected maximum rejected; all other bits zero |
| 24 | 4 | retained-prefix capacity | `512` |
| 28 | 4 | retained-prefix count | `min(total_accepted, 512)` |
| 32 | 8 | selected maximum | `0x7fffffffffffffff` |
| 40 | 8 | total accepted | accepted complete final events |
| 48 | 8 | tail event count | zero before the tail; otherwise `total_accepted - 512` |
| 56 | 8 | first omitted sequence | zero before the tail; otherwise `512` |
| 64 | 8 | last sequence | zero is valid both for the empty sentinel and for the one accepted event with sequence zero; otherwise `total_accepted - 1` |
| 72 | 8 | last post slot | final accepted event order key |
| 80 | 4 | last intra-slot | final accepted event order key |
| 84 | 4 | have-last | zero for an empty evidence stream, one otherwise |
| 88 | 72 | per-kind counts | nine little-endian `u64` values in numeric kind order: register read, register write, CCW read, block request, delivery, application, page transfer, state, interrupt |
| 160 | 8 | last-after LBA | little-endian `u64` |
| 168 | 8 | last-after generation | little-endian `u64` |
| 176 | 8 | last-after request ID | little-endian `u64` |
| 184 | 8 | last-after expected completion | little-endian `u64` |
| 192 | 4 | last-after command | little-endian `u32` |
| 196 | 4 | last-after CLP | little-endian `u32` |
| 200 | 4 | last-after DA | little-endian `u32` |
| 204 | 4 | last-after LMA | little-endian `u32` |
| 208 | 4 | last-after CCW address | little-endian `u32` |
| 212 | 4 | last-after CCW index | little-endian `u32` |
| 216 | 4 | last-after status | little-endian `u32` |
| 220 | 4 | last-after transfer/reset enables | little-endian `u32` |
| 224 | 4 | last-after bus IRQ | little-endian `u32` |
| 228 | 4 | last-after operation | little-endian `u32` |
| 232 | 4 | last-after completion queued | little-endian `u32` |
| 236 | 4 | last-after reserved | zero |
| 240 | 32 | prefix SHA-256 | SHA-256 of the exact frozen `CDRDISKEVID1` header and retained final records |
| 272 | 32 | tail SHA-256 | `H0` before event 512; otherwise the final chained tail hash |
| 304 | 8 | limit attempt post slot | zero until a selected-maximum rejection |
| 312 | 4 | limit attempt intra-slot | zero until a selected-maximum rejection |
| 316 | 4 | limit reason | zero until a selected-maximum rejection; then `1` |
| 320 | 32 | rejected-event SHA-256 | all zero until a selected-maximum rejection; then SHA-256 of that final rejected canonical event |
| 352 | 160 | reserved | all zero |

The closed parser rejects every other size, magic, version, policy code, flag bit, maximum, prefix relation, tail relation, or nonzero reserved byte. It also rejects a no-tail record whose tail hash differs from `H0`, a zero-total record whose last tuple is nonzero, a nonzero per-kind sum that differs from `total_accepted`, and an inconsistent limit witness. `CDRM6E1` has no permissive or forward-compatible extension path in protocol v4.

After the tail starts, the old `disk-evidence` operation returns `NOT_READY` rather than presenting a misleading partial log. Protocols v1–v3 reject the M6 operation, and protocol v5/M7 does not inherit the policy. The M6 build exports `cadr_wasm_m6_disk_evidence_summary`; ordinary M4/M5/M7 builds do not gain it.

## State and READY boundary

`CDRSTATE1` through `CDRSTATE5` remain unchanged and omit this evidence. All snapshot endpoints return `NOT_READY` in the M6-DEVID1 build. The proposed `CDRM6READY4` binding commits the frozen READY3 witness, the exact policy identifier, selected maximum, and the SHA-256 of one exact `CDRM6E1` record. It is a separate binding, not evidence that READY4 has occurred.

## Failure and recovery semantics

At the selected maximum, M6-DEVID1 MUST retain the accepted prefix and tail unchanged, set the one-time limit witness, and return the guest-fault disposition. A caller may still read `CDRM6E1` after a terminal failure when the module remains live; the worker response includes the record SHA-256. There is no recovery or continuation through a snapshot: a fresh machine or independently retained evidence record is required.

## O2 canary procedure and result

`scripts/run-cadr-m6-devid-o2-canary-systemd.mjs` is the only live entry point for the pending long-run canary. The underlying launcher refuses an unsupervised child. Commit 1 must contain the reviewed inert control plane; its live launcher, wrapper, staged driver, and fixture-test bytes must equal those commit-1 blobs. Commit 2 must have commit 1 as its sole parent and contain only the local M6 candidate plus the fixed-path action manifest. The separately supplied payload patch is the commit-1-to-commit-2 diff with the manifest path excluded, avoiding a self-referential manifest hash.

Before the O2 build or media access, the launcher verifies the exact union and separation of commit-2 paths, payload paths, and the fixed manifest path. Each action records add/modify, mode, preimage size/hash or null, and postimage size/hash; deletes, renames, copies, binary deltas, mode changes, M7/display, `cadr_machine.h`, and `cadr_host_api.h` are rejected. The staged tree then passes, in order, `make -B -C cadr-web m3-wasm`, `m4-unit`, `m4-browser`, `m5-unit`, and `m6-devid-wasm`. A domain-separated complete source-closure identity is checked before and after execution.

The fixed staged driver uses a dedicated canary loop rather than wrapping the READY-oriented `runM6HeadlessBoot`. Its sole counter is `machine-info.clock_slots_completed`. `terminalStatus == WAITING_FOR_HOST` plus a nonzero machine-info outstanding request authorizes host service; `boundaryPendingHost` means only that a boundary digest remains unpublished. A pending digest is settled with one proven completion-only batch and the counter must remain unchanged. At the exact target, a wait without that tested settlement fails closed. Success requires the exact counter, no outstanding request or pending digest, no active/deferred control, and quiescent media.

All five artifact-root inputs are opened with `O_NOFOLLOW`, verified by `fstat`, byte-copied into a fresh service-private mode-0700 session, and rehashed source/copy before and after. The private kind-3 copy is immutable backing for a new null, generation-zero, in-memory block-one overlay; artifact-root media is never writable.

The transient service has a 14,400-second limit and the fixed reviewed
resource/isolation policy. The outer wrapper creates and owns the exact stage
and private-media roots, passes them through internal child-only arguments,
and removes and verifies both after the unit exits, including abnormal exits.
The child publishes only a private atomic result envelope. The outer wrapper
validates the effective service policy, successful terminal result, available
numeric accounting, exact systemd unavailable-value sentinels, unit
collection, and root removal before publishing one canonical mode-0600
no-replace success receipt. Any run, evidence, or cleanup failure instead
publishes a bounded-enum failure receipt without raw paths or exception prose.

The O2 continuation canary completed on 2026-07-29. The ignored private
receipt is
`build/cadr-m6-live/m6-devid-o2-canary-b55bfa7-run3.json`: 18,609 bytes,
mode `0600`, SHA-256
`47131339865ae4c07eb4b88603d6feceb0c5889b7a9bc27cf30a9c3f4a1ec2ac`.
It binds signed base commit
`8eb4c536a8ff9c29ee5e288d55deda8f77fb06da`, signed sole-child candidate
`b55bfa76b7c39d33277fcb7457e9d5f84e2c3e4a`, the 29-path payload SHA-256
`17425d22fe44dbb7869444827e1110218a31f6d56ab6b87ad2d2275efaaaf4de`,
and staged source-closure SHA-256
`d50b1e1819fc4e6ae2eb62a1b5511eb0f534b43034750e9a3c336761f16a8102`.
The recorded toolchain was Node `v26.4.0` and Guix channel commit
`230aa373f315f247852ee07dff34146e9b480aec`.

The guest stopped nonterminal at exactly 1,130,000 completed clock slots with
no outstanding request, persistent status zero, and all five frozen gates
successful. A fresh in-memory overlay advanced from generation zero to one
over immutable base SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`;
the base remained unchanged. The evidence summary accepted 535 complete
events, including 23 tail events, and had SHA-256
`3ad9350edb3f0a4b4f873aa3f87a68fe75fc4d91b7db7154f38b41eb622ac2ff`.
The exact loop used 291 batches and 39 host transactions. The service result
was successful, peak memory was 830,337,024 bytes, CPU usage was 434,323,130,000
nanoseconds, and unit absence plus both outer-root removals were verified.
Systemd 261 reported IO counters as `[not set]` and IP counters as `[no data]`;
the receipt preserves those values rather than presenting them as zero.

Two earlier attempts failed closed before guest execution while calibrating
the frozen Chromium gate to the actual host: first because the private service
allowed no loopback `AF_INET`, then because Chromium exceeded a 64-task
ceiling. The final reviewed policy retains `PrivateNetwork=yes`, restricts
address families to `AF_INET AF_UNIX`, and bounds the service at 128 tasks.
Those failures are not canary successes.

## Open questions and nonclaims

No checked-in release envelope yet establishes a native/Wasm READY4 equality.
The completed continuation canary establishes the named runtime tail only; it
does not turn that tail into READY4 or close `CW1-BOOT`. The fixed event layout
follows the portable controller implementation; it does not establish that a
historical controller emitted this representation. These questions remain
deliberately unresolved rather than inferred from the canary.

## Conformance checks

- `test_cadr_m6_disk_evidence` uses a selected maximum of 513 to exercise the first tail event, the limit fault, zero reserved bytes, prefix-slot preservation, and the exact `H0` value.
- `test_cadr_m6_disk_evidence_differential` serializes and compares the literal frozen M4 post-enrichment records against the M6 production final-event helper after each event. It covers every one of the nine controller kinds, including the write DELIVERY raw-hash-to-delivery ordering and the write page replacement.
- `cadr_m6_tail_fixture` emits C-produced canonical records 512 and 513; `test_cadr_m6_tail_chain` recomputes `H0`, `H1`, and `H2` independently with Node crypto and compares `H2` to `CDRM6E1`.
- `test_cadr_m6_disk_evidence_wasm_exports` checks M6 export isolation.
- `test_cadr_m6_disk_evidence_worker` checks explicit protocol-v4 admission, closed `CDRM6E1` return, summary digest, M7 rejection, and snapshot refusal.
- `test_cadr_m6_ready4_binding` checks deterministic READY4 binding and changes to the summary digest.
- `test_cadr_m6_devid_o2_canary_runner` checks the non-executing manifest, systemd, receipt, and staged-result contracts. The headless fixture also rejects an exact-limit `WAITING_FOR_HOST` without calling `host-next-request`. These tests do not create a private disk or claim a long-run result.

`scripts/run-cadr-m6-devid-wasm-conformance.mjs --negative-only` is intentionally a non-ready release gate until a reviewed READY4 envelope is tracked.
