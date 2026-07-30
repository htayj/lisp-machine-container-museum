---
type: Reimplementation Specification
title: Symbolics Ivory I-machine and Open Genera VLM reimplementation specification
description: A release-bounded contract for the Ivory tagged instruction architecture and its Open Genera virtual-machine execution and Life Support boundary.
tags: [symbolics, genera, ivory, i-machine, vlm, instruction-set, virtual-machine, reimplementation]
timestamp: 2026-07-30T07:32:05-04:00
---

# Symbolics Ivory I-machine and Open Genera VLM reimplementation specification

## Status and reconstruction claim

This specification defines two related targets:

- `IMA-R2`, the public Symbolics I-machine architecture described by the 366-page
  *I-Machine Architecture Specification*, revision 2; and
- `OG85-VLM`, the guest-visible Ivory version 5 execution environment observed in
  the repository's preserved Open Genera 8.5 world and historical VLM.

The complete instruction semantics, memory cycles, trap entry/return, stack frames,
function calling, and page-hash-table algorithm in sections 1–5 and appendices A, B,
D, and F of the public architecture specification are normatively incorporated.
This document fixes the implementation profile, state boundaries, VLM mapping,
failure ordering, release evidence, and conformance tests needed to use that
architecture without conflating hardware, host services, or a modern public fork.

A conforming `IMA-R2` implementation can execute architecture-conforming compiled
functions. A conforming `OG85-VLM` implementation can host the selected Open Genera
world only after it also implements the VLOD, Life Support, communication-area,
device, debugger, X, and host contracts named here.

The
[Genera browser and WebAssembly investigation and implementation roadmap](genera-browser-webassembly-investigation-and-implementation-roadmap.md)
turns those requirements and remaining oracles into gated `OG85-WEB-LOCAL`
milestones without treating the licensed world as a distributable application asset.

It does not claim:

- source or binary identity with Symbolics' historical VLM;
- that the public descendant is the source of the preserved local executable;
- compatibility with 3600 macrocode, CADR microcode, or their object layouts;
- complete behavior for unpublished implementation-dependent coprocessor commands;
  or
- successful boot of every Genera release or site configuration.

## Normative language and evidence codes

`MUST` and `MUST NOT` state requirements for conforming implementations. `SHOULD`
states a requirement that may be departed from only with a documented compatibility
reason. `MAY` marks an optional behavior. These terms define this reconstruction
contract; they do not claim that the historical sources used RFC-style terminology.

| Code | Evidence | Role |
| --- | --- | --- |
| `IMA` | Public I-Machine Architecture Specification revision 2 | Normative architectural contract |
| `G85-SRC` | Licensed Genera 8.5 source witnesses, identified by hash only | Release cross-check; no source text reproduced |
| `G85-RUN` | Recorded isolated-harness Open Genera runtime | Exact observed world/VLM behavior |
| `PVLM` | Public VLM descendant at Git commit `55b2a3b1cf884f827d85829713587657c435cb29` | Structural emulator and Life Support cross-check |
| `OG-MAN` | Open Genera User's and Installation Guides | Host-visible documented contract |
| `INF` | Necessary implementation-independent reconstruction | Marked rule, not historical expression |
| `TODO-RUNTIME` | Unclosed oracle | No present compatibility claim |

`IMA` controls the processor architecture. `G85-SRC` and `G85-RUN` can select or
constrain the `OG85-VLM` profile but cannot silently alter `IMA-R2`. `PVLM` is not
ancestry proof and MUST NOT be used to attribute its fixes to the preserved binary.

## Compatibility profiles and levels

| Profile | Exact target |
| --- | --- |
| `IMA-R2` | Public architecture PDF, SHA-256 `b45cd026d6930e27f9830efefc9ab8d7f1da01dd030ab6adf876d56603b34a89` |
| `OG85-VLM` | Genera 8.5 world SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`, VLM executable SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`, debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| `PVLM-55B2` | Public descendant at Git commit `55b2a3b…`; comparison only |

| Level | Includes | Excludes or reserves |
| --- | --- | --- |
| `I0-OBJECT` | 40-bit object, tags, cdr codes, executable word formats | Instruction effects |
| `I1-ISA` | Complete instruction decode and architectural effects | Paging and host services |
| `I2-SYSTEM` | Calls, traps, GC barriers, PHT translation, caches as architecturally visible | Life Support devices |
| `I3-VLM` | VLM processor plus communication areas and host service operations | Exact historical host ABI/source identity |
| `I4-WORLD` | Boot and operate the selected world | Other worlds and configured Symbolics sites |

## Architecture and ownership boundaries

```text
Genera compiled function
    -> Ivory architectural instruction
        -> physical Ivory implementation

Genera compiled function
    -> Ivory architectural instruction
        -> VLM interpreter
            -> Life Support communication and host devices
                -> Unix host
```

The VLM owns guest processor state and instruction atomicity. Life Support owns
host I/O, virtual disks, paging service, network transfer, time, cold-load console,
and process lifecycle. A coprocessor instruction is the architectural handoff; its
host effect belongs to the selected coprocessor protocol, not to ordinary instruction
decode.

## Word and object model

An architectural word is 40 bits:

| Field | Width | Meaning |
| --- | ---: | --- |
| Data | 32 | Address, immediate payload, numeric bits, or instruction payload |
| Data type | 6 | Object representation, executable format, or special pointer |
| Cdr/sequencing code | 2 | List cdr relation or instruction sequencing |

`I0` MUST preserve all 40 bits through memory. Stack operations often normalize the
cdr code to `cdr-next`, but MUST do so only where the incorporated instruction
contract requires it. Object equality, numeric equality, transport, and memory
cycles MUST inspect tags according to `IMA`; an emulator MUST NOT represent every
guest word as an untagged host integer.

The complete data-type code table in `IMA` section 1.17 is normative. Its major
classes include immediate numeric/character objects, list and instance pointers,
array and function headers, physical and lexical locatives, invisible/forwarding
pointers, compiled-function forms, full-word call forms, external-value-cell
pointers, and packed-instruction types.

## Executable word formats and sequencing

The processor fetches a 40-bit word and selects behavior from its data type:

1. A packed-instruction word contains even and odd 18-bit instructions. The even
   halfword at bits `0..17` executes first, then the odd halfword at `18..35`.
   Bits `36..37` contribute the upper opcode bits needed for packed-instruction
   types octal `60`–`77`.
2. A full-word call instruction uses its data-type code as call opcode and its
   32-bit data field as the address.
3. An entry instruction is a packed-instruction word used as one full-word entry
   descriptor, encoding required/optional argument counts and rest acceptance.
4. An executable object-reference word pushes the constant.
5. An external-value-cell pointer performs the architecture's data-read cycle and
   pushes the referenced cell contents after required invisible-pointer following.
6. Every other fetched data type raises the specified illegal-instruction exception.

PC is a halfword address. Sequencing code, taken branches, calls, returns, entry
dispatch, and traps update it exactly as `IMA` specifies. No host pointer or host
instruction address may become guest-visible.

## Packed instruction encoding

The ordinary packed instruction is 18 bits:

| Bits | Meaning |
| ---: | --- |
| `10..17` | Eight-bit opcode |
| `0..9` | Operand specifier or opcode-specific immediate |

The two basic formats are operand-from-stack and ten-bit immediate.

### Stack operand modes

Bits `8..9` select:

| Mode | Effective operand |
| --- | --- |
| `00` | `FP + unsigned-offset` |
| `01` | `LP + unsigned-offset` |
| `10`, offset nonzero | `SP + offset - 255`, using SP before other operand pops |
| `10`, offset zero | `SP-pop`: pop this final operand before other operand pops |
| `11` | Immediate operand; signedness is instruction-class specific |

When an instruction has more operands, it pops those operands before using the
addressed final operand in the order stated by its `IMA` entry. Address-operand
instructions use the calculated location rather than its contents. Stack underflow,
wrong type, or bad addressing MUST enter the architecture's exception path; they
MUST NOT read arbitrary host memory.

### Immediate subformats

- Branch and loop instructions interpret the operand as a signed halfword offset
  from current PC according to their entry.
- Field operations use bits `0..4` as rotate count and `5..9` as width minus one.
- Other operations use signed, unsigned, or address operands exactly as classified
  in `IMA` appendix F.

## Complete opcode-family inventory

The following is a complete family inventory for `IMA-R2`. Exact opcode numbers,
operand signedness/address interpretation, stack pops, results, memory cycles,
exceptions, and next-PC rules are normatively incorporated from `IMA` chapter 3,
appendix B, and appendix F. The licensed `i-instruction-set` witness and `PVLM`
`emulator/aihead.sid` cross-check the selected names and encodings.

| Family | Instructions |
| --- | --- |
| List | `car`, `cdr`, `set-to-car`, `set-to-cdr`, `set-to-cdr-push-car`, `rplaca`, `rplacd`, `rgetf`, `member`, `assoc` |
| Logic/AI | `dereference`, `unify`, `push-local-logic-variables`, `push-global-logic-variable`, `logic-tail-test` |
| Binary predicates | `eq`, `eql`, `equal-number`, `greaterp`, `lessp`, `logtest`, their no-pop variants, `type-member`, `type-member-no-pop` |
| Unary predicates | `endp`, `plusp`, `minusp`, `zerop` |
| Numeric | `add`, `sub`, `unary-minus`, `increment`, `decrement`, `multiply`, `quotient`, `remainder`, `ceiling`, `floor`, `truncate`, `round`, `rational-quotient`, `max`, `min`, `logand`, `logior`, `logxor`, `ash`, `rot`, `lsh`, 32-bit plus/difference, double multiply, bignum steps, double-float operation |
| Movement | `push`, `pop`, `movem`, `push-n-nils`, address/SP variants, `stack-blt`, `stack-blt-address` |
| Fields | `ldb`, `dpb`, character, physical, and physical-tag LDB/DPB variants |
| Arrays | `aref-1`, `aset-1`, `aloc-1`, setup/forced setup, fast aref/aset, array-leader store/location |
| Branch/loop | unconditional, eight true forms, eight false forms, decrement loop, increment-less-than loop |
| Blocks | four BAR-indexed read, read-shift, read-ALU, read-test, and write families |
| Calls/returns | `start-call`, four finish-call forms, two entry forms, `locate-locals`, single/multiple/kludge return, `take-values` |
| Bind/catch | bind-locative forms, `unbind-n`, restore binding stack, catch open/close |
| Lexical variables | eight encodings each for push, pop, and movem |
| Instance variables | unordered and ordered push/pop/movem/address forms, instance ref/set/loc |
| Subprimitives | ephemeral test, unsigned comparisons, ALU, allocation, pointer arithmetic, internal-register and coprocessor access, memory read/write/address, tag/set-tag, store-conditional, cdr-code operations, generic/message dispatch, jump, preempt check, no-op, halt |

Opcode holes are illegal even if a host dispatch table has storage for them. The
emulator MUST dispatch by the complete 8-bit opcode plus format; it MUST NOT select
an operation solely from a mnemonic table that loses packed-type distinctions.

### Exact packed opcode map

Numbers in this table are octal. A range represents distinct encodings selected by
the stated low opcode bits; it is not one opcode with a runtime subargument.

| Family | Exact `name=opcode` mapping |
| --- | --- |
| List and logic | `car=000`, `cdr=001`, `logic-tail-test=014`, `dereference=013`, `push-global-logic-variable=055`, `push-local-logic-variables=103`, `set-to-car=140`, `set-to-cdr=141`, `set-to-cdr-push-car=142`, `rplaca=200`, `rplacd=201`, `rgetf=225`, `member=226`, `assoc=227`, `unify=237` |
| Predicates | `endp=002`, `zerop=034`, `minusp=035`, `plusp=036`; `type-member=040..043`, `type-member-no-pop=044..047`; `equal-number=260`, `lessp=261`, `greaterp=262`, `eql=263`, their no-pop forms `264..267`; `eq=270`, `logtest=273`, `eq-no-pop=274`, `logtest-no-pop=277` |
| Numeric | `unary-minus=114`, `increment=143`, `decrement=144`, `multiply=202`, `quotient=203`, `ceiling=204`, `floor=205`, `truncate=206`, `round=207`, `remainder=210`, `rational-quotient=211`, `min=212`, `max=213`, `logand=215`, `logxor=216`, `logior=217`, `rot=220`, `lsh=221`, `multiply-double=222`, `lshc-bignum-step=223`, `ash=232`, `add=300`, `sub=301`, `32-bit-plus=302`, `32-bit-difference=303`, `add-bignum-step=304`, `sub-bignum-step=305`, `multiply-bignum-step=306`, `divide-bignum-step=307`, `double-float-op=016` |
| Movement | `push=100`, `push-n-nils=101`, `push-address-sp-relative=102`, `push-address=150`, `set-sp-to-address=151`, `set-sp-to-address-save-tos=152`, `stack-blt=224`, `pop=340`, `movem=341`, `fast-aref-1=350`, `fast-aset-1=351`, `stack-blt-address=352` |
| Fields | `ldb=170`, `char-ldb=171`, `p-ldb=172`, `p-tag-ldb=173`, `dpb=370`, `char-dpb=371`, `p-dpb=372`, `p-tag-dpb=373` |
| Arrays | `setup-1d-array=003`, `setup-force-1d-array=004`, `aset-1=310`, `allocate-list-block=311`, `aref-1=312`, `aloc-1=313`, `store-array-leader=314`, `allocate-structure-block=315`, `array-leader=316`, `aloc-leader=317` |
| Branch and loop | `branch-true` family `060..067`, `branch-false` family `070..077`, `branch=174`, `loop-decrement-tos=175`, `loop-increment-tos-less-than=375` |
| Block | `block-0..3-write=030..033`; `block-0..3-read=120..123`; `block-0..3-read-shift=124..127`; `block-0..3-read-test=130..133`; `block-0..3-read-alu=160..163` |
| Call and return | `start-call=010`, `jump=011`, `locate-locals=050`, `return-multiple=104`, `return-kludge=105`, `take-values=106`, `return-single=115`, `finish-call-n=134`, `finish-call-n-apply=135`, `finish-call-tos=136`, `finish-call-tos-apply=137`, `entry-rest-accepted=176`, `entry-rest-not-accepted=177` |
| Binding and catch | `bind-locative=005`, `restore-binding-stack=006`, `catch-close=051`, `unbind-n=107`, `bind-locative-to-value=236`, `catch-open=376` |
| Lexical variables | `push-lexical-var=020..027`, `pop-lexical-var=240..247`, `movem-lexical-var=250..257` |
| Instance variables | `push-instance-variable=110`, `push-address-instance-variable=111`, `push-instance-variable-ordered=112`, `push-address-instance-variable-ordered=113`, `pop-instance-variable=320`, `movem-instance-variable=321`, `pop-instance-variable-ordered=322`, `movem-instance-variable-ordered=323`, `instance-ref=324`, `instance-set=325`, `instance-loc=326` |
| Subprimitives | `ephemeralp=007`, `tag=012`, `generic-dispatch=052`, `message-dispatch=053`, `check-preempt-request=054`, `no-op=056`, `read-internal-register=154`, `write-internal-register=155`, `coprocessor-read=156`, `coprocessor-write=157`, `memory-read=116`, `memory-read-address=117`, `pointer-plus=230`, `pointer-difference=231`, `store-conditional=233`, `memory-write=234`, `p-store-contents=235`, `eq`/comparison entries as above, `alu=214`, `pointer-increment=145`, `set-cdr-code-1=146`, `set-cdr-code-2=147`, `set-tag=327`, `unsigned-lessp=331`, `unsigned-lessp-no-pop=335`, `merge-cdr-no-pop=342` |

The true and false branch ranges have eight distinct stack-action leaves:
ordinary, else-extra-pop, and-extra-pop, extra-pop, no-pop, and-no-pop,
else-no-pop, and `and-no-pop/else-no-pop/extra-pop`, in ascending opcode order.
The selected profiles differ at two relevant encodings. `IMA-R2` defines
`remainder=210`, while the inspected public VLM table leaves `210` as `SpareOp`.
Conversely, the public VLM installs a host `halt` operation at `057`; that entry is
not silently promoted into the architecture table above. `IMA-R2` describes
`%halt=377` as a guaranteed undefined instruction. A conformance corpus MUST test
these as selectable profile deltas rather than normalize their names or encodings.

## Processor state

At minimum `I1` and above preserve:

| State | Architectural role |
| --- | --- |
| PC, continuation, control | Sequencing, call state, argument size, cleanup, value disposition, apply |
| FP, LP, SP, macro-SP | Current stack frame and operands |
| Stack cache bounds/limits | Resident control-stack window and overflow/underflow |
| TOS | Architecturally visible top-of-stack cache |
| Binding stack pointer/limit | Dynamic binding records |
| Catch block list | Nonlocal exit chain |
| Four BARs | Block memory operations |
| EA and memory data | Effective address and memory-cycle state |
| EPC/DPC | Exception and dispatch PCs |
| ALU/rotate control | Subprimitive arithmetic and block operations |
| Oldspace/zone state | Ephemeral GC barrier and transport decisions |
| PHT base, mask, hash/map state | Virtual address translation |
| Preempt/event state | Asynchronous request visibility |
| Allocation caches | List and structure area/address/length |
| Coprocessor interface state | Ordered external operations and results |

The internal-register numbers and read/write permissions in `IMA` section 3.2 and
the selected source are normative. Unimplemented, read-only, or privileged accesses
raise their specified exception.

## Function call and return transaction

A call is a multi-instruction transaction:

1. `start-call` establishes call-started control state.
2. Argument-producing instructions build the callee argument area.
3. A finish-call instruction identifies the callee, argument count source, apply
   mode, and value disposition.
4. The processor validates the callable object, follows permitted indirections,
   constructs the control frame, and fetches the entry descriptor.
5. Entry checks required/optional counts and rest acceptance, creates missing
   optionals/rest representation, and locates locals.
6. Return restores caller frame and applies effect/value/return/multiple disposition.

Any exception before frame commitment MUST leave restart information sufficient to
avoid duplicating arguments or bindings. Cleanup bits govern unwind obligations.
Multiple-value return MUST not be reduced to repeated single-value pushes.

## Binding, catch, and unwind

Binding records contain the locative and saved contents needed for exact restoration.
`unbind-n` and restore-binding-stack unwind in newest-first order. Catch-open links a
catch block to the current control state; catch-close removes the matching open
block. Trap or throw unwinding MUST honor cleanup bits and restore bindings/control
frames in architecture order. A malformed chain causes the specified exception
rather than a host loop or memory fault.

## Memory cycles, transport, and GC

`IMA` chapter 2 and the memory-cycle tables are normative. A memory reference
selects a cycle such as data read, binding read, header read, structure offset,
scavenge, copy, or raw access. The cycle and encountered data type jointly determine
whether to return the word, follow an invisible pointer, transport an oldspace
object, invoke a trap, or reject the access.

Writes MUST apply cdr/data-type merge rules, write barriers, ephemeral/oldspace
checks, and store-conditional atomicity at the architectural commit point. A VLM may
use host locks or atomic primitives internally but MUST preserve guest-visible
success/failure and ordering.

## Address translation and page hash table

The 32-bit virtual address is classified into mapped, ephemeral, unmapped, or wired
regions according to `IMA`. For mapped access:

1. apply the architecture's PHT hash functions using PHT base and mask;
2. probe entries and validate virtual-page identity;
3. enforce access and write permissions;
4. produce the physical page and retained map attributes; or
5. raise the correct page-not-resident, access, write, or transport-related fault.

Map/cache optimizations are not architecturally visible except through invalidation,
fault counts, ordering, and control registers. Invalidating or loading a map entry
MUST affect subsequent translations at the boundary specified by the internal
register operation.

## Exceptions and traps

Exceptions include illegal instruction/format, instruction exception, operand type,
arithmetic, memory, page, stack, binding, preemption, and reset conditions. `IMA`
chapter 5 controls priority, trap-vector selection, saved EPC/DPC/continuation/control
state, handler arguments, and return/restart.

An emulator MUST:

- distinguish an instruction exception from a memory-cycle exception;
- save the architecturally specified PC, not merely the host dispatcher PC;
- identify whether the faulting instruction's stack effects committed;
- make retry, continue, or unwind produce the specified next state; and
- convert no guest error into an uncontrolled host signal.

## Coprocessor and Life Support boundary

`%coprocessor-read` and `%coprocessor-write` are ordinary architectural instructions
whose selected operand identifies an external register/operation. Their architectural
completion is ordered with respect to guest state. For `OG85-VLM`, the host side can
request or report world saving, disk, clock, console, network, and other Life Support
work.

Each write-like operation MUST have an exactly-once commit token or equivalent state:
a guest trap/retry MUST NOT repeat a completed host side effect. Unknown registers
raise the profile's instruction exception. `PVLM` extensions are unavailable in
`OG85-VLM` unless separately established by `G85-SRC` or `G85-RUN`.

## VLM execution contract

A VLM instruction step:

1. obtains the word containing PC through guest translation;
2. decodes its executable data type and even/odd position;
3. resolves the packed opcode and operand format or full-word form;
4. performs ordered stack reads/pops and type checks;
5. performs memory cycles and external operations;
6. commits results, stack pointers, and control state;
7. records any exception restart phase; and
8. advances or replaces PC.

Host-code dispatch, caching, threaded interpretation, or generated native code MAY
replace this sequence internally. Boundary state at instruction, exception, memory,
and coprocessor commit points MUST be identical.

`OG85-VLM/I3` additionally implements the fixed Boot, FEP, and System communication
areas, their 40-bit word layout and queues, virtual disk/page service, network packet
channels, cold-load display and debugger channel, main-display X relay, clock, and
shutdown coordination specified in
[Ivory, FEP, and Open Genera VLM implementation layers](../ivory-fep-and-open-genera-vlm-implementation-layers.md).
That dossier is a normative companion for those host-facing layouts and lifecycle
transitions.

## Boot and world loading

The VLOD is serialized world state, not an instruction archive. `I4` MUST:

1. validate and privately map the selected VLOD;
2. initialize processor, maps, stack caches, communication areas, and Life Support;
3. load or connect the selected VLM Debugger;
4. establish virtual disks and configured devices;
5. transfer control to the world's recorded restart state; and
6. service guest activity until pause or shutdown.

The [VLOD article](world-loads-and-vlod.md) defines the world boundary. The harness
does not imply that a changed private VLOD is a successful Save World, and a forced
host shutdown after accepted guest confirmation is not orderly guest persistence.

## Failure, recovery, and shutdown

Guest faults remain guest state. Host resource exhaustion, invalid configuration,
disk failure, communication queue corruption, or unavailable X/network service MUST
be reported without silently fabricating a successful guest operation.

Pause retains the live VLM process and guest memory. Resume continues that process.
Process exit destroys unsaved guest state. Save World is a separate in-guest
operation and becomes durable only after its own successful completion.

The current historical VLM is known to accept shutdown confirmation, begin cleanup,
break X, and then deadlock at a Cold Load channel mutex before bounded host
termination. `OG85-VLM` MUST preserve this as an observed historical-binary defect,
not as required architecture behavior. A reimplementation SHOULD complete orderly
shutdown while offering a defect-compatibility test mode only if required.

## Conformance tests

| ID | Level/profile | Test | Objective pass condition |
| --- | --- | --- | --- |
| `IVY-W01` | `IMA-R2/I0` | Round-trip every data type and cdr code through memory | All 40 bits preserved; only specified stack normalizations occur |
| `IVY-F01` | `IMA-R2/I1` | Decode every executable full-word and packed format | Exact operation or illegal-format exception |
| `IVY-O01` | `IMA-R2/I1` | Enumerate all 256 opcodes across operand classifications | Exact name, legality, signedness/address class |
| `IVY-S01` | `IMA-R2/I1` | Exhaust FP/LP/SP/SP-pop/immediate boundaries | Exact operand, pop order, result, exception |
| `IVY-B01` | `IMA-R2/I1` | Branch offset minima/maxima and every true/false pop family | Exact PC and stack delta |
| `IVY-C01` | `IMA-R2/I2` | Calls with missing/excess/rest/apply args and four dispositions | Exact frames, errors, values, return state |
| `IVY-U01` | `IMA-R2/I2` | Nested bind/catch, throw, cleanup, trap, and retry | Exact restoration order and saved state |
| `IVY-M01` | `IMA-R2/I2` | Matrix every memory cycle against every relevant data-type class | Exact follow/transport/value/trap result |
| `IVY-P01` | `IMA-R2/I2` | PHT hit, collision, permission, absent page, invalidation | Exact translation/fault and cache boundary |
| `IVY-G01` | `IMA-R2/I2` | Oldspace and ephemeral reads/writes through required cycles | Exact transport/barrier/trap behavior |
| `IVY-X01` | `OG85-VLM/I3` | Retry a coprocessor write around each commit boundary | External effect occurs exactly once |
| `IVY-L01` | `OG85-VLM/I3` | Exercise each communication queue with wrap/full/empty/corrupt states | Ordering, wakeup, backpressure, and fault match |
| `IVY-V01` | `OG85-VLM/I4` | Boot selected world in isolated harness | Expected success markers, machine identity, display, and stable Listener |
| `IVY-D01` | `OG85-VLM/I4` | Disassemble and execute a synthetic compiler corpus | Runtime values and decoded instructions agree |
| `IVY-Q01` | `OG85-VLM/I4` | Pause, resume, Save World test copy, orderly and defect shutdown paths | Persistence and process-lifetime distinctions preserved |
| `IVY-XP1` | `OG85-VLM` versus `PVLM-55B2` | Probe public-fork-only opcode/service candidates | Unestablished extensions remain unavailable in historical profile |

Every `G85-RUN` test MUST retain the full Genera harness record required by
repository `AGENTS.md`: exact world, runtime, debugger, preloads, responder,
configuration and helper hashes; namespace/network/X state; ordered input intents
and outcomes; screenshot/pixel evidence when visible; and shutdown stages.

## Oracle gaps

- `TODO-OPCODE-FIXTURE`: publish a rights-safe generated fixture covering every
  opcode and exception path; do not extract compiled proprietary functions as the
  fixture.
- `TODO-COPROCESSOR`: close the complete Open Genera coprocessor register set and
  exact host-side failure semantics.
- `TODO-LINEAGE`: establish the precise source revision and build recipe for the
  1,533,760-byte historical VLM executable.
- `TODO-HARDWARE`: compare instruction-boundary traces with physical Ivory hardware.
- `TODO-SAVE-WORLD`: verify Save World success on a disposable private copy and
  distinguish every modified file and commit point.

## Unknowns and reserved claims

The historical VLM's exact source ancestry, physical-Ivory trace equivalence,
unpublished coprocessor operations, all implementation-dependent timing, and
unexercised world profiles remain unknown. Booting the selected world would not
establish those claims. `PVLM-55B2` behavior is never promoted into `OG85-VLM`
without independent licensed-source or exact-runtime evidence.

## Evidence ledger and provenance

| Claim | Witness | Status |
| --- | --- | --- |
| Word, tags, formats, instructions, calls, PHT, traps | [I-Machine Architecture Specification](https://bitsavers.org/pdf/symbolics/I_Machine/I-Machine_Architecture_Specification.pdf), SHA-256 `b45cd026d6930e27f9830efefc9ab8d7f1da01dd030ab6adf876d56603b34a89` | Normative public manual |
| Genera compiler encoding | Licensed `i-compiler/i-instruction-set.lisp.~12~`, 12,511 bytes, SHA-256 `3a61307ca198cdd6eba22a3b968a2a2f6943a1abeec64406840225c59bcfd84e` | Rights-safe metadata cross-check |
| Genera disassembly | Licensed `i-compiler/disassemble.lisp.~60~`, 96,339 bytes, SHA-256 `ff4870f426cfbfa8d5db15fc76143548ffbf6174fbfa617ecaa7779f7d7a7e8a` | Rights-safe metadata cross-check |
| Compiler backend | Licensed `i-compiler/i-back-end.lisp.~371~`, 201,796 bytes, SHA-256 `f7e0aaf936f5a58cbc126dcaa6ec4101dc2434ef88841905ff6c1ac3732452e4` | Rights-safe metadata cross-check |
| VLM processor structures | Public [`emulator/ivory.h`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/emulator/ivory.h) and [`aihead.sid`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/emulator/aihead.sid), commit `55b2a3b…` | Structural cross-check |
| Host initialization | Public [`src/main.c`](https://github.com/LdBeth/osx-vlm/blob/55b2a3b1cf884f827d85829713587657c435cb29/src/main.c), commit `55b2a3b…` | Structural cross-check |
| Communication areas | Public `FEPComm.h`, `SystemComm.h`, `BootComm.h`, and `life-support/embed.h` at `55b2a3b…` | Structural cross-check |
| Preserved runtime and host lifecycle | Exact artifacts and ignored harness record summarized in the [implementation-layers dossier](../ivory-fep-and-open-genera-vlm-implementation-layers.md) | Runtime observation |

The public architecture PDF was verified 2026-07-27. Its original restrictive
notice is not treated as permission to reproduce the manual; this specification
uses original prose, small facts, and stable citations. Licensed Genera source and
world bytes remain untracked.

No screenshot is required for the processor contract itself because its normative
outputs are object, instruction, stack, memory, trap, and host-operation traces. A
reviewed compiler/disassembly image can illustrate the user-facing tools in the
companion compiler dossier but cannot prove unexercised instruction semantics.
