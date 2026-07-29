---
type: Reimplementation Specification
title: CADR-WEB-303 ABI 1.3 boot-media controller reimplementation specification
description: An implementation-ready contract for the selected System 303 disk controller, asynchronous range service, volatile boot-scratch overlay, controller evidence, and native/Wasm conformance gate.
tags: [mit-cadr, lm-3, system-303, disk-controller, webassembly, reimplementation]
timestamp: 2026-07-29T03:30:01-04:00
---

# CADR-WEB-303 ABI 1.3 boot-media controller reimplementation specification

## Status, target, and nonclaims

`CADR-WEB-303/ABI1.3/C-M4-BOOT-MEDIA-v1` specifies the disk path needed by the
selected maintained System 303 world from its first disk START through the
source-identified terminal boot-media chain and a quiet controller suffix. It is
the M4 compatibility profile for the browser roadmap.

The selected successful chain is exact:

1. the earlier diagnostic START under command `0405`;
2. command `011`, unit 0, LBA 1, memory page 0: guest-to-media write;
3. command `010`, unit 0, LBA 1, memory page 0: media-to-guest comparison;
4. command `000`, unit 0, LBA 0, memory page 0: media-to-guest read;
5. after the first `0405` START, executed micro-PC `0355`, p1 `0356`, next
   micro-PC `0357` at stabilized boundary S1,029,996;
6. no later disk event through S1,030,044.

Nonclaim: this profile does not establish LMFS mounting, `FILE-SYSTEM-RUNNING`,
pack membership, historical disk timing, arbitrary media compatibility, browser
UI behavior, persistence, or a historical MIT format. The later
`CADR-WEB-303-LMFS-OVERLAY` profile owns filesystem semantics. The base disk is a
local unresolved import and is not redistributed.

This subsystem is headless. There is no visible application state for which a
runtime screenshot would add evidence; the normative visual requirement is
therefore not applicable. The exact machine, controller, and media transcripts
serve as the runtime observation.

## Normative language and release profile

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` constrain an independent implementation
of this reconstruction profile. They do not assert that the historical CADR used
the new host ABI or evidence formats.

| Identity | Selected value |
| --- | --- |
| LM-3 System source | Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` |
| Maintained `usim` source | Fossil check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` |
| Public System 46 comparison source | Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` |
| CADR-WEB profile SHA-256 | `1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a` |
| Artifact-set SHA-256 | `e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941` |
| Selected base size | 269,562,880 bytes |
| Selected base SHA-256 | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |
| Geometry | T-300: 815 cylinders, 19 heads, 17 1,024-byte blocks per track |
| Controller compatibility | `SYSTEM_303`; CLP addition wraps only its low 16 bits |
| Host latency | zero guest ticks for the selected gate |
| Start predicate ID | `FIRST-START-0405-v1` |
| Terminal predicate ID | `FIRST-START-0405-v1/EXECUTED-0355-P1-0356-NEXT-0357-v1` |
| Schedule ID | `C-M4-ZERO-TICK-SCHEDULE-v1` |

The public System 46 tree remains historical comparison evidence, not the
implementation target for this profile. Maintained LM-3 source supplies the
selected controller and boot behavior. Exact source links and verification date
belong in the release record because a changing browser or repository view is not
itself a frozen artifact.

## Evidence ledger

| Code | Kind | Establishes | Does not establish |
| --- | --- | --- | --- |
| `M4-SRC` | maintained `usim` controller, disk unit, memory, and microengine source | selected register, CCW, DMA, command, and terminal algorithms | that the portable implementation agrees |
| `M4-USIM` | two independently rebuilt, disposable maintained-`usim` oracle captures | selected common controller sequence and page identities; repeatability; base preservation | portable host request identity or overlay publication |
| `M4-CORE` | `cadr-web/core/usim-port/disk-controller.c` and ABI1.3 core | portable state transitions and request/application boundary | host range-reader or overlay semantics |
| `M4-HOST` | native C and JavaScript range services | immutable-base reads, volatile write staging, guest-tick delivery, reset/detach behavior | historical implementation |
| `M4-CTRL` | independently serialized native and Wasm `CDRM4CTRL1` | exact common portable controller path and final state | independent correctness, because the core is shared |
| `M4-MEDIA` | native C and JavaScript `CDRM4MEDIA1` | host actor ordering and overlay commit identity | full controller state |
| `M4-TEST` | synthetic negative, fault, reset, trace, snapshot, Chromium host-adapter, and differential gates | exercised failure and ordering rules | unselected media or a full selected boot inside Chromium |
| `INF-M4` | rules stated here where preserved evidence is silent | deterministic browser-hosting policy | historical fact |

Source, compiled artifact, runtime observation, manuals, and papers remain
separate evidence categories. Equality between native and Wasm is a portability
witness, not an independent oracle; the maintained-`usim` projection is required
to guard against a shared portable-core error.

The selected local load-band/base is compiled-image and runtime-input evidence;
its identity and observed bytes constrain this profile, but the image is not
redistributed and does not establish source intent. No manual or paper is
normative for the reconstructed ABI1.3 host interface, volatile overlay, or
evidence formats. Historical manuals and papers provide hardware context only;
they were not used to substitute for the selected source and runtime transition
witnesses.

## Components and ownership

```text
guest microengine
  -> XBUS disk registers
      -> controller state + CCW fetch
          -> payload-bearing or payload-free host request
              -> one attached range service
                  -> read-only base descriptor / immutable Blob
                  -> volatile block-1 overlay
              -> copied completion
          -> controller completion application
              -> page write, comparison, or write acknowledgement

portable core -> CDRM4CTRL1
host service  -> CDRM4MEDIA1
every quiet boundary -> CDRSTATE1/2/3 transcript
final quiet state -> CDRSTATE4
```

The core owns controller, request, copied completion, and diagnostic evidence
state. The host service owns the range source, latency policy, staged write, and
committed overlay. The dedicated worker serializes all JavaScript requests; a
second poll, detach, snapshot, or restore cannot race an earlier poll.

No guest pointer, host pathname, file descriptor, JavaScript object, wall clock,
or C structure representation crosses the ABI. All multi-byte evidence fields are
fixed-width little-endian values. Page hashes use the canonical 1,024-byte stream
formed by encoding 256 guest words least-significant byte first.

## Controller registers and status

The disk occupies four XBUS word offsets. Read and write meanings differ.

| Offset | Read | Write |
| --- | --- | --- |
| 0 | status | command/reset |
| 1 | last memory address | command-list pointer |
| 2 | disk address | disk address |
| 3 | zero/ECC placeholder | START |

The selected state contains command, CLP, DA, LMA, pending CCW address and index,
pending guest page address, pending LBA, transfer-active, reset, done-interrupt
enable, attention-interrupt enable, full status, and bus-interrupt state.

Required status bits are:

| Bit | Meaning |
| --- | --- |
| 22 | read comparison differed |
| 21 | CCW cycle |
| 20 | nonexistent memory |
| 10 | seek error |
| 9 | unit offline |
| 7 | read-only |
| 6 | controller fault |
| 3 | interrupt |
| 2 | selected attention |
| 1 | any attention |
| 0 | not active |

Reset command `016` clears controller state, retains the selected compatibility
profile, sets not-active, and enters reset condition. Command zero releases reset.
Diagnostic evidence history is not erased by an in-guest controller reset; cold
power clears it. Unit selection admits only unit zero. Cylinder, head, and block
must be within the selected T-300 geometry. An unavailable unit sets offline; an
invalid CHS or end-of-media continuation sets seek error.

Command 4 seeks, command 5 performs the source-ordered at-ease/recalibrate/fault
clear compound behavior, and command 6 is the source-visible offset-clear no-op.
Unsupported command codes end the transfer with fault and
`CADR_STATUS_UNIMPLEMENTED_DEVICE`.

## CCW and transfer algorithm

START validates unit and CHS, makes the controller active, sets CCW index zero,
then reads the current CCW. Under `SYSTEM_303`, the high 16 CLP bits remain fixed
while addition of the CCW index wraps the low 16 bits. `USIM_330D` unmasked
addition is a separately selectable compatibility rule and MUST NOT be averaged
into this profile.

For each CCW:

1. set pending CCW address and LMA; set CCW-cycle status;
2. read one 32-bit guest word; on failure, set NXM and finish;
3. clear CCW-cycle; decode guest page address as `ccw & 0x00ffff00`;
4. derive LBA from unit/cylinder/head/block;
5. issue exactly one 1,024-byte block operation;
6. after accepted completion, transfer or compare 256 words;
7. reread the CCW; bit zero clear ends the chain, bit zero set advances the CCW
   index and disk address before issuing the next request.

Write command `011` copies the guest page into canonical bytes before publishing
the request. Compare command `010` reads a page without modifying memory and sets
the read-compare bit on any differing word. Command `000` reads and writes all 256
words. A page transfer is atomic at the selected host boundary: a rejected or
short completion does not expose a partial page.

## ABI1.3 request and completion lifecycle

ABI major remains 1; ABI minor 3 adds `cadr_host_request_m4`, whose fixed fields
are operation, generation, request ID, descriptor count, expected completion
count, and request-payload count. The frozen payload-free request API remains
valid for a current-minor caller; it rejects only a request whose payload cannot
be represented by that API.

Read descriptor:

```text
u64 first-block
u32 block-count
u32 block-bytes
```

Write descriptor:

```text
u64 transaction-id
u64 first-block
u32 block-count
u32 block-bytes
```

The selected write requires transaction ID equal to the core-assigned request ID,
first block 1, one 1,024-byte block, a 1,024-byte request payload, and zero
completion bytes. The descriptor and payload MUST be validated and copied before
request publication. Trace code 6 records both hashes in that same preflighted
transaction. Enabling trace therefore cannot reject or misdescribe a valid write.

The lifecycle is:

```text
ISSUE -> CAPTURE -> [guest-tick latency] -> DELIVERY -> APPLICATION
                    \-> rejection/abort leaves controller and overlay uncommitted
```

Generation, request ID, operation, descriptor, request-payload hash, and expected
completion count are immutable through the chain. Completion acceptance and
controller application are separate transitions. Stale, duplicate, wrong
generation, wrong request, wrong operation, short, oversized, or malformed
completions fail without applying a page.

## Range source and volatile overlay

The final host interface is a bounded range reader. Native retains one read-only
descriptor; JavaScript retains an immutable Blob/File identity or an equivalent
range source. Neither runner reopens a pathname between requests. Artifact ingress
verifies the selected size and SHA-256 before execution, and the release gate
rehashes the base afterward.

The boot sequence genuinely writes LBA 1. Calling M4 “read-only” would therefore
be incorrect. The M4 host service implements a deliberately narrow volatile
overlay:

- only one block at LBA 1 may be written;
- bytes are staged before completion delivery;
- accepted successful delivery publishes the page and increments generation
  from 0 to 1 exactly once;
- the following comparison reads the overlay, not the unchanged base;
- LBA 0 reads from the base;
- an identical replay of the same
  `(generation, request ID, transaction ID, payload hash)` is idempotent and does
  not increment generation;
- mismatched reuse, an older identity, host failure, detach during capture, or a
  rejected completion discards staging and cannot publish;
- reset after host commit retains the already committed volatile overlay; reset
  before accepted delivery discards the stale stage;
- explicit service discard clears overlay bytes and identity.

The final overlay root is:

```text
SHA-256(
  "CDRM4OVERLAY1\0" ||
  base-sha256 ||
  LE64(entry-count) ||
  sorted(LE64(block-number) || page-sha256)
)
```

No recovered block bytes enter tracked files. The page hashes are evidence, not a
redistribution of the page.

## Guest-time scheduling and worker lifecycle

Latency is measured only in `clock_slots_completed`. The selected gate uses zero:
capture and delivery occur in the same between-boundaries service turn, followed
by one zero-slot core call that applies the queued completion. Host fetch duration,
event-loop delay, tab visibility, and wall time do not advance guest time.

JavaScript poll and detach share one lifecycle queue and attachment epoch. Detach
marks the service synchronously before an awaited range read can begin; a capture
from an older epoch cannot commit afterward. Completion dispatch is the
point-of-no-return: if detach begins while the external `complete` callback is
already in flight, that accepted delivery finishes, emits its delivery/commit
evidence, and only then may the queued detach clear the volatile overlay. The
same detach discards a returned positive-latency request that has staged bytes
but has not begun completion dispatch; it does not require the caller to advance
the service to its due tick first. The
worker marks media busy before capture and clears it only after the service turn.
A worker failure or termination discards the volatile service.

## Dedicated-worker protocol version 2

ABI1.3 uses CADR-WEB dedicated-worker protocol version 2. The first
well-formed, in-order request selects version 1 or 2 for that worker session;
every later request MUST use the selected version, and every response or
protocol error reports it. Unsupported versions and attempts to change version
are malformed messages and do not consume the expected request identifier.

Version 1 remains the exhaustive M3 request tree specified by the
[headless-core companion](cadr-webassembly-headless-core-reimplementation-specification.md).
It rejects every M4-only operation with `INVALID_ARGUMENT`. Its
`host-next-request` response has only `request` and `descriptor`, and a request
with a nonzero payload count is invalid under that profile.

Version 2 includes all version-1 operations and adds this exact request subtree:

```text
M4 additions
├─ media-overlay-state(
│    busy:boolean, dirty:boolean, snapshotBlocked:boolean,
│    overlayGeneration:u64 BigInt, detached?:true)
├─ run-digest-batch-m4(clockSlots: 1..4096)
├─ boundary-digest-v4
├─ boot-media-observation
└─ disk-evidence
```

In version 2, a successful `host-next-request` reply is:

```text
{
  type: "cadr-response", version: 2, id, op, status: 0, ok: true,
  request: {
    operation:u32, generation:u64 BigInt, requestId:u64 BigInt,
    descriptorByteCount:u64 BigInt,
    completionByteCount:u64 BigInt,
    requestPayloadByteCount:u64 BigInt
  },
  descriptor: ArrayBuffer,
  requestPayload: ArrayBuffer
}
```

The descriptor is at most 64 bytes, request payload at most 1,024 bytes, and
completion at most 1 MiB. Each is copied out of module memory before transfer.
`media-overlay-state` is a worker-side snapshot fence: dirty state requires a
nonzero monotonic generation; dirty or fault-progress state cannot be cleared
without `detached: true`; and detach is valid only with busy, dirty, and
snapshot-blocked false and generation zero. While any fence is set,
snapshot size, save, and both restore forms return `NOT_READY`.

## Reset and snapshot semantics

Core reset invalidates outstanding request identity and rejects a later stale
completion. It does not prove that a host overlay was discarded. Service reset and
core reset are coordinated explicitly:

- reset before completion acceptance discards staging;
- reset after accepted write delivery preserves the committed volatile overlay;
- later block-1 reads still observe that committed page.

CDRSNAP1 minor 1 does not serialize the host service, staged write, committed
overlay, overlay generation, range attachment, latency queue, or targeted-fault
occurrence progress. Snapshot size, save, and restore MUST return not-ready while
media is busy or dirty, and after a nonzero one-based fault occurrence counter has
begun matching. Checking only the core request-payload count is insufficient
because it is zero after application while the overlay remains required. A future
snapshot format may add an identity-bound overlay and fault-selector chunk; ABI1.3
does not silently extend CDRSNAP1.

## Fault selection and failures

Fault selection is deterministic and identical in C and JavaScript. A selector is
`(operation or any, first block or any, one-based matching occurrence or every)`;
the action mask may force host failure, flip the first completion byte, or delay
one guest tick.

All of the following are hard gate failures:

- wrong base size/hash, mutated base, truncated or out-of-range range;
- invalid operation, descriptor, transaction identity, block size, or count;
- unavailable unit, invalid CHS, NXM, unsupported command, or evidence overflow;
- short/wrong-hash completion, host failure, stale/duplicate/wrong completion;
- request identity drift, apply without accepted delivery, or issue while another
  request remains outstanding;
- page hash disagreement, comparison mismatch in the successful profile, overlay
  generation/root disagreement, or an unexpected write;
- missing/reordered/extra selected transfer, missing first `0405` START, terminal
  before the three transfers, missing/duplicate terminal, or a disk event after
  the terminal during the quiet suffix;
- malformed, truncated, noncanonical, or hash-invalid evidence.

The controller may record its final error transition, but a failed gate MUST NOT
emit a successful controller footer.

## Evidence formats

### CDRSTATE4

`CDRSTATE4` is additive. It hashes CDRSTATE3 plus generation, request identity,
descriptor bytes, request-payload bytes, expected and queued completion identity,
completion hash, and event status. Frozen CDRSTATE1/2/3 bytes do not change and
continue to reject payload states they cannot represent.

### CDRM4MEDIA1

The 64-byte header binds schema version, selected base size, and selected base
hash. Each 352-byte actor turn contains ordinal, actor, disposition, operation,
actor result, guest tick, complete request identity, descriptor bytes and hash,
request-payload hash, page hash, overlay generation/root, and an optional final
CDRSTATE4. A valid chain has ISSUE, CAPTURE, DELIVERY, APPLICATION for each
request, followed by STABLE.

Only a successful write delivery has COMMIT. A failed delivery has ABORT and leaves
overlay identity unchanged. Reads use NONE. The stable turn requires no outstanding
request, queued completion, or request payload.

### CDRM4CTRL1

Native C and JavaScript independently serialize the same bytes:

- 256-byte identity header;
- 384-byte ordered controller records;
- 256-byte terminal footer.

The header binds schema geometry/capacity, selected base, requested final boundary,
record count, profile, artifact set, schedule ID, start ID, and terminal ID. Each
record has contiguous ordinal, post-slot S, intra-slot sequence, kind/cause,
event fields, reversible before/after controller tuples, and descriptor, request
payload, delivery, and page hashes. Required kinds are register read/write, CCW
read, request, delivery, application, page transfer, otherwise-uncovered state
transition, and interrupt attempt.

The footer binds count, final/terminal boundaries, the exact terminal PCs, no
outstanding request, success flags, final CDRSTATE4, records hash, header-plus-
records hash, and canonical final-controller-tuple hash. Reserved bytes are zero.
No wrap, overwrite, post-terminal event, short export, or success footer after
overflow is permitted. The selected C serializer also requires the exact
67-record kind sequence and its three request, delivery, application, and page
chains before it can emit this footer. A terminal PC alone is not sufficient.

`CDRM4CTRL1` and `CDRM4MEDIA1` are complementary. The controller stream cannot
prove host overlay publication; the media stream cannot prove raw CCWs or controller
state. The release gate correlates them by full request and page identities.

### Maintained-usim common projection

`CDRM4USIM1` is independently captured from a disposable build of maintained
`usim`. Its common projection compares the exact guest boundary, direction,
offset, and value of every register operation and interrupt-deassert attempt;
all three CCW addresses, words, commands, LBAs, and guest pages; the ordered
write/compare/read block hashes; and the terminal PC tuple. It deliberately
does not invent portable request IDs, host delivery actors, or overlay
generations that the maintained source cannot observe.

Two instrumentation differences are normalized explicitly. The maintained hook
labels the enclosing register write before its interrupt side effect, while the
portable evidence records the completed write after that side effect; those
records are canonically ordered within their shared guest boundary. Maintained
`usim` performs media access synchronously, while the portable host completion
may apply at the issuing boundary or the immediately following boundary.
Register and CCW boundaries remain exact; a page application may therefore be
at `S` or `S+1` while its direction, command, LBA, size, and hash remain exact.
This is a declared common projection, not raw-hook byte equality.

## Conformance matrix

| Test | Required result |
| --- | --- |
| `M4-T01` register/reset/command/status vectors | exact selected transitions; in-guest reset retains evidence history |
| `M4-T02` CCW wrap, chain, NXM, CHS/end-media | selectable System 303/usim rule; exact failure state |
| `M4-T03` read/write/compare pages | canonical page bytes and hashes; comparison latch |
| `M4-T04` ABI legacy/current minors | payload-free legacy call remains compatible; payload write requires M4 API |
| `M4-T05` trace-active write | code-6 issue includes descriptor/payload hashes; behavior unchanged |
| `M4-T06` targeted faults | operation/block/occurrence selection agrees in C and JavaScript |
| `M4-T07` reset races and replay | stale stage rejected; post-commit overlay retained; replay idempotent |
| `M4-T08` detach race | old attachment cannot commit after detach |
| `M4-T09` snapshot dirty/busy | size/save/restore all reject |
| `M4-T10` CDRSTATE4/media/controller vectors | deterministic golden bytes and mutation rejection |
| `M4-T11` maintained-`usim` repeat | raw and normalized captures repeat; base/copy unchanged |
| `M4-T12` native/Wasm selected gate | all S0..S1,030,044 state records, host schedule, media actors, and controller bytes match |
| `M4-T13` release portability | GCC/Clang O0/O2 and Wasm O0/O2 preserve selected semantic outputs |

The successful selected gate additionally requires:

- three controller requests with commands/LBAs/directions `011/1/write`,
  `010/1/compare`, `000/0/read`;
- raw CCW address 511 and value zero for all three;
- write and comparison page SHA-256
  `5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef`;
- LBA-0 page SHA-256
  `2002734fa44f32c7f74fc00bdee9f8ef1021a84a073bad86d814e30d7e03dc79`;
- four interrupt-deassert attempts in the independently observed source profile;
- overlay generation one and unchanged base SHA-256;
- final CDRSTATE4 equality and no host work.

## Release record

The closure record MUST state exact commands, compiler/Node/browser versions,
native and Wasm artifact hashes, all transcript hashes, upstream prepared-source
and instrumentation hashes, repeat identities, base pre/post identity, and the
Git commit. It MUST distinguish a static unit pass, a native/Wasm differential
pass, the independently rebuilt upstream oracle, and a live browser pass.

The locally observed upstream repeat after the `CDRM4USIM1` schema rename produced
59 raw events and three chains in both runs. Raw streams were 23,182 bytes with
SHA-256
`aad0a1bcf3e40c5ba6d400b61ee3b6f8b076ba2d2b1b4895a81fff9e34908135`;
normalized streams were 23,536 bytes with SHA-256
`e8b2b8921defabdd6a30c4ef0252cb71ef38612ccb99ab3c6311867abf1c583b`.
Both the input and disposable copy retained the selected base identity. These are
local runtime observations from ignored build trees, not redistributed media.

The real-Chromium M4 test is intentionally a host-adapter smoke. It instantiates
the M4 worker, exercises the empty disk-evidence and premature-CDRSTATE4 paths,
then uses a synthetic two-block range source to test commit, exact replay,
older-generation rejection, and overlay-shadowed read. The selected
269,562,880-byte disk boot remains the Node-worker/native differential gate; this
browser smoke is not represented as a second full boot oracle.

### Closed M4 release

`C-M4-BOOT-MEDIA-v1` is **closed for the selected zero-latency System 303
boot-media chain through S1,030,044**. The closure used these commands from the
repository root:

```sh
CADR_M4_USIM_ORACLE="$PWD/build/cadr-oracle/m4-usim1-schema-repeat-a/media.cdrm4usim1.ndjson" \
  make -C cadr-web m4-differential
make -C cadr-web m3-snapshot-cross-target
make -C cadr-web m3-differential
scripts/run-cadr-m4-portability.sh
make -C cadr-web test
python3 .agents/skills/write-reimplementation-specs/scripts/audit_spec.py \
  docs/mit-cadr/cadr-boot-media-controller-reimplementation-specification.md
```

The selected differential and all six portability producers emitted these
byte-identical semantic artifacts:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `CDRM4TX1` S0 through S1,030,044 | 216,228,529 | `f766414951e645e6ed24590bd23a0394996662d598bba9e5bb1b9bb89dfccda5` |
| `CDRM4MEDIA1` actor schedule | 4,640 | `9efe5c4933d4c789167cf3e581045b7937cf19f68c786d8f1434ceff78cb8ac5` |
| `CDRM4CTRL1` controller witness | 26,240 | `c07cbd4edb9c54f2c87f839cd5abb590a5083d3bbdd8af3d4d85c39ede55c9c0` |

The portability matrix used GCC 15.2.0 and Clang 21.1.5 at O0 and O2, plus
bare-Wasm builds made directly with Clang/LLD 21.1.5 at O0 and O2.
Node was v22.14.0 and the live-browser gate used Chromium 150.0.7871.124. Its
machine-readable ignored manifest records every binary, semantic artifact, source
file, byte count, and digest. The exact M4 implementation source set has aggregate
SHA-256 `5d43afe324bd2061e9eab83a771cab1abb35037b14cbad6015f25fa7289f9329`.
The sealed preflight record has SHA-256
`2ebb7b2014f08925a4c91cc17c2071934eded548716b67263514be5004d8863c`;
the final manifest has SHA-256
`047d58fe5484c3f72f12b9289577847fcca36cca5416a6e18428a123d997a595`.
The optimized Wasm artifact was 152,385 bytes with SHA-256
`348fcfe0effa0cd15204368897104cf5de561e4aa47c4346e8f431548b1753ee`;
the unoptimized artifact was 167,480 bytes with SHA-256
`9e516255ddf6688ebe88591dc22a3abc5d18f12f3d1eac85a2f637825dbc4ac8`.

The sealed portability inputs were:

| Input identity | Bytes | SHA-256 |
| --- | ---: | --- |
| `repository/cadr-web/profiles/cadr-web-303.ini.in` | 854 | `1cfd4cb6f8ebe390a527f6c870fad51b53d1e4897cee4371bbfc2ae8bba38e2f` |
| `repository/l/sys/ubin/promh.mcr` | 20,480 | `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6` |
| `repository/l/sys/ubin/promh.sym` | 3,130 | `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d` |
| `repository/l/sys/ubin/ucadr.sym` | 83,270 | `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| `repository/l/usim/disk-sys-303-0.img` | 269,562,880 | `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` |

The independently rebuilt maintained-`usim` oracle was repeated twice. Both raw
captures were 23,182 bytes with SHA-256
`aad0a1bcf3e40c5ba6d400b61ee3b6f8b076ba2d2b1b4895a81fff9e34908135`;
both normalized captures were 23,536 bytes with SHA-256
`e8b2b8921defabdd6a30c4ef0252cb71ef38612ccb99ab3c6311867abf1c583b`.
The prepared upstream profile had SHA-256
`1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a`;
the upstream executable had SHA-256
`cba4d2ece7418972ad8b1cbcb3fd12f925ce5cbd160de431b4a0b359c61f0a3f`;
the media-witness, stub, and prepared-source-tree digests were respectively
`3d013df22ab372e57cd40db45c991ef9a2c4d9c44b2628923a384ee5906b3556`,
`229138a15abbc4a4e0bc79eafe1c9fb5b0e78cf6fcd0b991f12f259fe324793f`,
and `b538ee9cbcd646fd73d3fccc6fc13541d91931fccf36cf11fdebcddc2c5656cc`.

The selected 269,562,880-byte base and both disposable oracle copies remained
SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`
before and after every gate. The M3 one-million-boundary compiler matrix and
bidirectional snapshot continuation gates were rerun as regressions. The
real-Chromium M4 test remains the synthetic adapter test described above, not a
second full selected-media boot.

The closing Git identity is the commit containing this record, with the unique
subject `Close CADR WebAssembly roadmap M4`; a commit cannot include its own
content-derived SHA. The aggregate source digest above seals the exact executable
source state independently of that unavoidable self-reference.

## Open extensions

- `CADR-WEB-303-LMFS-OVERLAY` must specify arbitrary filesystem writes, pack
  incarnation and clean flags, mount ordering, and persistence separately.
- A future snapshot minor may own an overlay chunk and attachment identity.
- Nonzero deterministic latency profiles require separate release evidence.
- Other disk units, geometries, commands, and historical release profiles remain
  unselected.

## Sources

- [Maintained LM-3 System check-in
  `4df393c6`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and [maintained `usim` check-in
  `330d8248`](https://tumbleweed.nu/r/usim/info/330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d),
  verified 2026-07-29.
- [Public System 46 source snapshot at commit
  `8e978d7d`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
  for historical comparison, not merged into the System 303 profile.
- Repository implementations and tests under `cadr-web/core/`,
  `cadr-web/host/`, `cadr-web/wasm/`, `cadr-web/tests/`, and `tests/`.
- [CADR browser/WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md).
- [CADR-WEB headless core specification](cadr-webassembly-headless-core-reimplementation-specification.md).
- [Deterministic trace and snapshot specification](cadr-deterministic-tracing-and-snapshot-reimplementation-specification.md).
