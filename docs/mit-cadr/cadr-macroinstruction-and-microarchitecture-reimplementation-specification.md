---
type: Reimplementation Specification
title: MIT CADR System 303 macroinstruction and microarchitecture reimplementation specification
description: A source-grounded contract for the System 303 16-bit Lisp macroinstruction interpreter and the 48-bit CADR microinstruction engine, with explicit System 46 and usim comparison profiles.
tags: [mit-cadr, lm-3, system-303, instruction-set, microcode, emulator, reimplementation]
timestamp: 2026-07-27T09:42:00-04:00
---

# MIT CADR System 303 macroinstruction and microarchitecture reimplementation specification

## Status and reconstruction claim

This specification targets the maintained LM-3 System 303 macroinstruction
architecture and CADR control-store engine at System Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`
and `usim` check-in
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`.

A conforming implementation can execute the selected System 303 compiler's FEF
instruction stream when it supplies the tagged object, virtual-memory, stack,
interrupt, and device contracts named here. At the microarchitecture level it can
run the selected control-store image with instruction-for-instruction state
equivalence.

The
[CADR browser and WebAssembly implementation roadmap](cadr-browser-webassembly-implementation-roadmap.md)
turns these contracts and tests into the ordered `CADR-WEB-303` implementation and
release program.

It claims:

- exact 16-bit fetch, class decode, effective-address, destination, branch, ND1–ND4,
  OP20, and MISC dispatch structure for the selected System 303 source;
- exact 48-bit common-field decode and ALU, jump, dispatch, byte, microstack, control
  store, A/M memory, PDL, and delayed-memory state transitions implemented by the
  selected `usim`; and
- release-selectable differences where the 1979/System 46 descriptions do not match
  System 303.

It does not claim:

- that every System 303 MISC operation is re-specified independently of its named
  normative microcode routine;
- cycle or electrical compatibility with CADR hardware;
- Lambda, LMI, 3600, or Ivory compatibility; or
- that the maintained System 303 restoration is byte-identical to an MIT historical
  release.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` state requirements.

| Code | Evidence | Use |
| --- | --- | --- |
| `S303` | Maintained LM-3 System source, pinned above | Normative macroinstruction and microcode target |
| `U303` | Maintained `usim`, pinned above | Normative executable model for CADR microinstruction state |
| `S46` | Public System 46 source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | Historical comparison profile |
| `MAN79` | Knight, *LISP Machine Macro Instruction Set*, 1979 | Design vocabulary and historical comparison |
| `CADR` | Moon et al., *LISP Machine*, AI Memo 528 | Hardware architecture evidence |
| `RUN303` | Repository System 303 harness runs | Integrated oracle, only for the exact recorded band |
| `INF` | Necessary implementation-independent reconstruction | Clearly marked rule, not historical expression |

When witnesses disagree, `S303` controls the macroarchitecture target and `U303`
controls the executable microarchitecture target. `S46` and `MAN79` define separate
comparison profiles; they MUST NOT be averaged into System 303.

## Compatibility profiles and levels

| Profile | Exact target | Purpose |
| --- | --- | --- |
| `M303` | System 303 Lisp macroinstructions and `UC-MACROCODE` at `4df393c…` | Default compiled-code target |
| `U303` | CADR 48-bit engine in `usim` at `330d824…` | Default microinstruction oracle |
| `M46` | Public System 46 source at `8e978d7…` | Historical source comparison |
| `H79` | 1979 macroinstruction memo and AI Memo 528 | Dated design profile, not a boot claim |

| Level | Includes | Reserves |
| --- | --- | --- |
| `C0-DECODE` | Halfword fetch, class, operands, destinations, branch target | Lisp object effects |
| `C1-MACRO` | `C0` plus tags, FEF, PDL, calls, bindings, catch, faults, MISC dispatch | Exact microinstruction trace |
| `C2-MICRO` | `U303` 48-bit state and transitions | Device timing |
| `C3-BOOT` | `C1` and `C2` plus maps and devices sufficient to boot selected band | Unattached hardware and other bands |

## Architecture and ownership boundary

```text
compiled FEF halfwords
    -> UC-MACROCODE owns Lisp instruction semantics
        -> CADR control store owns 48-bit microinstruction sequencing
            -> datapath, memory maps, and devices
```

The macro PC is not the micro PC. A macroinstruction can execute many
microinstructions, trap into another microcode path, fault and resume, or invoke a
large MISC routine. A macroinstruction boundary is nevertheless the compiler-visible
atomic sequencing unit unless an architecturally visible fault or interrupt occurs.

## Macroinstruction representation and fetch

`M303` MUST treat the instruction stream as 16-bit halfwords packed two per 32-bit
word. It MUST maintain a halfword location counter and instruction buffer consistent
with `UC-MACROCODE`; crossing a word boundary fetches the next word through the
normal virtual-memory path. `C1` MUST preserve enough restart state that a page fault
does not duplicate a completed side effect.

The ordinary halfword fields are numbered in octal source convention:

| Field | Source byte | Meaning |
| --- | --- | --- |
| `OP4` | `1104` | Four-bit primary opcode |
| `OP5` | `1105` when `OP4 < 11` | Extended direct-operation opcode |
| `SUBOP` | `1503` | Three-bit class suboperation |
| `DEST` | `1602` | Two-bit destination |
| `REG` | `0603` | Three-bit source region |
| `DISP` | `0011` | Nine-bit displacement |

The opcode extension rule is essential: direct opcodes below octal `11` consume a
fifth opcode bit; the class opcodes do not.

## Complete primary decode

| Primary opcode | Suboperation | Required operation |
| ---: | --- | --- |
| `00` | — | `CALL` |
| `01` | — | `CALL0` |
| `02` | — | `MOVE` |
| `03` | — | `CAR` |
| `04` | — | `CDR` |
| `05` | — | `CADR` |
| `06` | — | `CDDR` |
| `07` | — | `CDAR` |
| `10` | — | `CAAR` |
| `11` ND1 | `0` unused, `1 +`, `2 -`, `3 *`, `4 //`, `5 LOGAND`, `6 LOGXOR`, `7 LOGIOR` | Binary numeric/logical operation |
| `12` ND2 | `0 =`, `1 >`, `2 <`, `3 EQ`, `4 SETE-CDR`, `5 SETE-CDDR`, `6 SETE-1+`, `7 SETE-1-` | Predicate or stack-slot update |
| `13` ND3 | `0 BIND-OBSOLETE`, `1 BIND-NIL`, `2 BIND-POP`, `3 SET-NIL`, `4 SET-ZERO`, `5 PUSH-E`, `6 MOVEM`, `7 POP` | Binding and movement |
| `14` branch | `0 BR`, `1 BR-NIL`, `2 BR-NOT-NIL`, `3 BR-NIL-POP`, `4 BR-NOT-NIL-POP`, `5 BR-ATOM`, `6 BR-NOT-ATOM`, `7 illegal` | Relative branch |
| `15` MISC | extended opcode | Microcoded miscellaneous operation |
| `16` ND4 | see below | Closure and combined list operation |
| `17` | — | Unused instruction trap |
| `20` | `REG` selects family | Array, array-leader, or instance access |
| `21`–`37` | — | Undefined unless a selected release explicitly assigns it |

`ND4` is complete for `M303`:

| Subop | Operation |
| ---: | --- |
| `0` | `STACK-CLOSURE-DISCONNECT` |
| `1` | `STACK-CLOSURE-UNSHARE` |
| `2` | `MAKE-STACK-CLOSURE` |
| `3` | `PUSH-NUMBER` |
| `4` | `STACK-CLOSURE-DISCONNECT-FIRST` |
| `5` | `PUSH-CDR-IF-CAR-EQUAL` |
| `6` | `PUSH-CDR-STORE-CAR-IF-CONS` |
| `7` | Undefined-instruction trap |

For OP20, `REG` has this complete decode:

| `REG` | Operation |
| ---: | --- |
| `0` | `AR-1` |
| `1` | `ARRAY-LEADER` |
| `2` | `%INSTANCE-REF` |
| `3` | `COMMON-LISP-AR-1` |
| `4` | `SET-AR-1` |
| `5` | `SET-ARRAY-LEADER` |
| `6` | `SET-%INSTANCE-REF` |
| `7` | Undefined array instruction |

The displayed dimension/count is the low six bits of `DISP`, plus one for instance
reference/store (`REG` 2 or 6). A `C1` implementation MUST run the same tag, bounds,
displacement, and transport checks as the selected microcode rather than treating
that displayed count as the complete operation.

## Effective addresses

For an ordinary one-halfword source:

| `REG` | Address source |
| ---: | --- |
| `0`–`3` | FEF-relative pages selected by `REG`; `DISP` is the within-page offset |
| `4` | FEF constants area |
| `5` | Current local frame |
| `6` | Current argument frame |
| `7`, `DISP=77` | Pop and use top of PDL |
| `7`, `DISP<40` | `SELF` slot |
| `7`, `40<=DISP<70` | `SELF-MAP` slot |
| other `REG=7` | Undefined/trap; MUST NOT alias an ordinary PDL slot |

The two-halfword extended form MUST reconstruct the larger `REG`/`DISP` address
specified by the following halfword and advance the macro PC once more. Fault
restart MUST remember whether the extension word was consumed.

Source access MUST honor Lisp tags, cdr codes, invisible-pointer transport, and the
selected memory cycle. An implementation MUST NOT reduce every effective address to
an untyped 32-bit load.

## Destinations and value disposition

| Destination bits | Name | Effect |
| ---: | --- | --- |
| `0` | `D-IGNORE` | Discard an ordinary result |
| `1` | `D-PDL` / `D-NEXT` | Push/retain result as required by the operation |
| `2` | `D-RETURN` | Return the value according to current frame state |
| `3` | `D-LAST` | Supply the final argument and activate the prepared call |

MISC entries can require or reinterpret a destination. The complete System 303
authority is `l/sys/cold/defmic.lisp`, including
`MISC-INSTRUCTION-REQUIRED-DESTINATION-ALIST`, together with the matching entry
labels in `UC-MACROCODE`. A decoder MUST reject an incompatible required
destination rather than silently applying ordinary result disposal.

## Branches

The ordinary branch displacement is signed nine-bit two's complement and is
relative to the already advanced halfword PC. Octal `777` is an escape: the next
halfword is the signed long displacement and is consumed even when the condition is
false. Pop variants perform their specified PDL change in the same order as
System 303; a fault before the branch commits MUST be restartable without a second
pop.

## MISC instruction closure

MISC uses primary opcode `15`. The SUBOP extension contributes the high bit of the
ten-bit MISC opcode. The normative operation inventory is every active `DEFMIC`
form in System 303 `l/sys/cold/defmic.lisp`, including aliases, argument lists,
compiler eligibility, and destination constraints. There are 407 active forms;
aliases can share an opcode and therefore MUST NOT be counted as distinct encodings.

The decoder also MUST implement these encoded families before generic symbol lookup:

- compact indexed array-reference, array-leader, and instance-reference ranges below
  octal `200`;
- `UNBIND` count encodings `200`–`217`;
- PDL-pop count encodings `220`–`237`;
- the special destination meanings of `INTERNAL-FLOOR-1` at `460` and the related
  ceiling, truncate, and round path; and
- every opcode above octal `777` using the SUBOP extension.

Each MISC routine's public contract is its `DEFMIC` argument list and result
destination. Its exact `M303/C1` behavior is the reachable System 303 microcode entry
and helpers, including tag dispatch, memory cycles, faults, errors, bindings, and
multiple-value effects. This normative incorporation prevents a short prose summary
from silently weakening 407 operations.

## Macroarchitectural state

| State | Required meaning |
| --- | --- |
| Macro PC / location counter | Next halfword plus even/odd position |
| Instruction buffer | Current fetched 32-bit instruction word |
| FEF pointer | Compiled function header, constants, references, and code base |
| Argument and local bases | Current activation's indexed regions |
| PDL pointer/index and buffer | Operand and control stack state |
| `SELF` and self map | Instance receiver and mapped variables |
| Binding stack | Dynamic binding restoration records |
| Catch state | Open catch frames and unwind target |
| Return/control state | Caller linkage, destinations, multiple-value convention |
| Tag and cdr state | Full Lisp object representation, not payload alone |
| Fault/interrupt state | Pending and enabled conditions plus restart phase |

Calls MUST distinguish setup from activation. `CALL`/`CALL0` prepare the callee and
argument state; `D-LAST` is an active control transfer, not merely a fourth place to
store a value. Returns MUST restore the caller frame and apply its saved destination
and multiple-value convention.

## Exceptions, interrupts, and restart

Before dispatching the next macroinstruction, `UC-MACROCODE` checks applicable page
fault, interrupt, sequence-break, single-step, and breakpoint state. A conforming
implementation MUST preserve that priority from the selected source. It MUST expose
illegal primary/subop combinations as the same class of guest fault rather than a
host crash.

Every memory operation has a pre-commit and post-commit boundary. A page fault before
the write or stack mutation commits MUST leave the operation retryable. A fault after
an architecturally visible effect MUST resume after, or otherwise record, that
effect. Host exceptions MUST NOT leak as substitutes for Lisp-machine traps.

## Failure and recovery

Decode holes, illegal suboperations, bad tags, invalid addresses, stack failures,
protection faults, and unavailable devices MUST become the selected guest trap or
fault. A host emulator failure is not a compatible substitute. Recovery resumes at
the pre-effect or post-effect boundary recorded by the microcode; it MUST NOT repeat
a committed store, pop, binding, call activation, or external device request.

## CADR microinstruction word

`U303` executes a 48-bit word. Bits are numbered from zero; source byte syntax uses
octal position and size. Common fields are:

| Bits | Width | Meaning |
| ---: | ---: | --- |
| `0` | operation-specific | ALU/byte/jump/dispatch low fields |
| `26` | 5 | M-memory address or functional-source number |
| `31` | 1 | `0`: M memory; `1`: functional source |
| `32` | 10 | A-memory address; also dispatch constant source |
| `42` | 1 | Pop microstack after the instruction unless inhibited |
| `43` | 2 | Class: `0 ALU`, `1 JUMP`, `2 DISPATCH`, `3 BYTE` |
| `45` | 1 | Long-instruction/control extension used by assembler/disassembler |
| `46` | 1 | Statistics bit |
| `47` | 1 | Hardware/control extension bit |

Conceptual operand read occurs from selected A and M sources before the
class-specific write phase. Writing an ordinary destination below octal `4000`
writes both the selected low M-memory location and corresponding low A-memory
location after performing any functional-destination effect. Destinations with bit
octal `4000` set write A memory only.

### Required microarchitectural state

| Store/register | Width/count |
| --- | --- |
| PROM | 512 × 48 bits |
| Writable instruction memory | 16K × 48 bits |
| A memory | 1024 × 32 bits |
| M memory | 32 × 32 bits |
| Dispatch memory | 2048 entries |
| PDL buffer | 1024 × 32 bits |
| Microstack | 32 entries, five-bit circular pointer |
| Q register | 32 bits |
| VMA and MD | 32 bits |
| Location counter | 26 bits |
| PDL pointer and index | 10 bits each |
| OA low/high | Together modify the next 48-bit microinstruction |
| Micro PC | 14 bits, with PROM/control-store selection |

### ALU class

ALU class fields are:

- destination at bits `14..25`;
- output selector at `12..13`;
- ALU operation at `3..8`;
- carry-in at bit `2`;
- Q control at `0..1`.

Operations octal `00`–`17` are the sixteen Boolean functions of A and M.
Operations `20`–`37` are the selected 74181-style arithmetic combinations.
`40`, `41`, `45`, and `51` are multiply/divide steps. Output selection is rotated M,
raw ALU, arithmetic right shift with ALU carry as sign, or left shift with old-Q
high bit. Q control is no change, left shift with inverse ALU sign, right shift with
ALU low bit, or load from ALU.

### Jump class

Jump target is bits `12..25`; return, push, inhibit-next, and invert occupy bits
`9`, `8`, `7`, and `6`. Conditions are either a selected rotated M bit or internal
conditions: signed M less/equal A, M equal A, page fault, enabled interrupt,
sequence break, or unconditional. Push and return together write control store from
the synthesized instruction-write register. A taken inhibit-next suppresses the next
fetched microinstruction. Return targets can carry the location-counter-advance bit.

### Dispatch class

Dispatch rotates M, extracts a selected field, ORs it with an eleven-bit base, may
add level-two map bits, and reads dispatch memory. Each dispatch entry supplies a
14-bit target plus N/P/R control. The instruction can load dispatch memory instead.
The N-plus-one and instruction-sequence-hardware bits MUST follow `U303` ordering;
dispatch constant is loaded from instruction bits `32..41`.

### Byte class

Byte operations use destination bits `14..25`, merge/rotate selector bits `12..13`,
width-minus-one at `5..9`, and position at `0..4`. The four selector values are the
reserved/zero path, LDB merge, selective deposit without rotation, and DPB merge.
Position can be replaced by the location-counter byte-mode function. Fields wrap
modulo 32 exactly as `U303`; an implementation MUST test zero width and wraparound.

### Microinstruction sequencing

The engine keeps a two-stage fetched pair (`p0`, `p1`) and a next micro PC. Each
step:

1. advances the fetch pipeline and wraps the 14-bit PC;
2. completes a pending delayed MD update when its countdown reaches zero;
3. if inhibit is set, clears it and suppresses execution of this word;
4. ORs pending OA-low and OA-high modifications into the current word once;
5. reads A and M/functional sources;
6. executes one class and its writes;
7. applies a non-inhibited pop-after-next microstack action.

This ordering is normative for `U303`. An optimized emulator MAY fuse host
operations but MUST expose identical boundary state and faults.

## Memory and tag boundary

The CADR physical word is 32 bits; Lisp objects divide it into cdr code, data type,
and pointer/payload fields. Virtual-memory translation, map bits, access/write
permissions, meta/oldspace state, and transport are part of observable execution.
The precise tag and map constants are normatively incorporated from the pinned
System 303 `QCOM`, `MADEFS`, `UC-PARAMETERS`, `UC-PAGE-FAULT`, and `UC-STORAGE-ALLOCATION`
modules and the matching `usim` headers. An implementation MUST version these
tables with the selected system; it MUST NOT borrow Ivory's 40-bit object layout.

## Release deltas

- `H79` describes primary `16` and `17` as reserved; `M303` assigns ND4 to `16`.
- `M303` assigns OP20 array/leader/instance operations not present in the early
  four-class description.
- The early destination description includes obsolete quoted/list destinations;
  `M303` has the four two-bit dispositions specified above.
- Dispatch map-bit locations changed; `U303` uses level-two map bits 18 and 19 and
  explicitly notes the disagreement with the CADR memo.
- System 46 and System 303 MISC inventories and microcode entry behavior can differ.
  Selecting `M46` requires rebuilding its own `DEFMIC` and microcode tables.

## Conformance tests

| ID | Profile/level | Test | Pass condition |
| --- | --- | --- | --- |
| `CADR-D01` | `M303/C0` | Enumerate all 32 primary opcodes and eight subops | Names or illegal results exactly match `DISASS` |
| `CADR-D02` | `M303/C0` | Decode every `REG`, boundary `DISP`, and extended form | Exact effective-address class and consumed length |
| `CADR-D03` | `M303/C0` | Test short offsets `-256,-1,0,255` and long escape | Exact target and PC consumption |
| `CADR-D04` | `M303/C0` | Test all four destinations on an ordinary producer | Exact push/discard/return/last behavior |
| `CADR-M01` | `M303/C1` | Enumerate active `DEFMIC` encodings and aliases | Isomorphic opcode/name/arity/destination inventory |
| `CADR-M02` | `M303/C1` | Run representative list, numeric, bind, catch, call, array, closure operations | Same values, tags, stack delta, and fault |
| `CADR-M03` | `M303/C1` | Inject page faults before and after write-like effects | No lost or duplicated effect |
| `CADR-U01` | `U303/C2` | Differentially execute every Boolean/arithmetic ALU code | A/M/Q/out/carry/destination match |
| `CADR-U02` | `U303/C2` | Exhaust jump condition and N/P/R/invert combinations | PC, microstack, inhibit, and control-store writes match |
| `CADR-U03` | `U303/C2` | Exhaust legal dispatch extraction widths/positions and map selectors | Address, constant, target, N/P/R match |
| `CADR-U04` | `U303/C2` | Exhaust byte selectors, widths, positions, and wrap cases | Destination matches bit-precise oracle |
| `CADR-U05` | `U303/C2` | Exercise OA one-shot modification, delayed MD, PROM disable, PC wrap | Pipeline boundary state matches |
| `CADR-B01` | `M303+U303/C3` | Boot the pinned System 303-0 band and evaluate a corpus | Same printed values, conditions, disassembly, and stable idle state |
| `CADR-X01` | `M46` versus `M303` | Decode primary `16`, OP20, and selected changed MISC opcodes | Profile-specific result, never averaged |

Each test record MUST include source/check-in identity, generated control-store and
band identities where applicable, logical input, instruction or macro boundary
trace, and final state. The runtime harness provenance rules in repository
`AGENTS.md` apply to `CADR-B01`.

## Oracle gaps

- `TODO-HARDWARE`: compare control-store traces against a physical CADR rather than
  only `usim`.
- `TODO-MISC-DIFF`: generate a checked opcode-by-opcode System 46/System 303 MISC
  delta, preserving aliases and holes.
- `TODO-FAULT-CORPUS`: close every tag-dispatch and memory-cycle fault branch for all
  active MISC routines.
- `TODO-TIMING`: document only timing that software or device interfaces can observe;
  no cycle claim is currently made.

## Unknowns and reserved claims

Physical-gate timing, undocumented hardware races, exact maintained-versus-historical
System 303 identity, and exhaustive physical-device behavior remain unknown. They
are not implied by successful `usim` boot. The `M46`, `M303`, and `H79` profiles are
deliberately separate, and no result from one closes a gap in another without a
release-discriminating test.

## Normative source map and provenance

| Contract | System 303 witness |
| --- | --- |
| Macro fetch and class dispatch | `l/sys/ucadr/uc-macrocode.lisp` |
| Calls and returns | `l/sys/ucadr/uc-call-return.lisp` |
| Page faults and memory cycles | `l/sys/ucadr/uc-page-fault.lisp` |
| Interrupt and sequence break | `l/sys/ucadr/uc-interrupt.lisp` |
| Tags, maps, and parameters | `l/sys/ucadr/uc-parameters.lisp`, `l/sys/sys/madefs.lisp`, `l/usim/qcom300.h` |
| MISC definitions | `l/sys/cold/defmic.lisp` and matching `UC-MACROCODE` entries |
| Authoritative disassembly | `l/sys/sys2/disass.lisp` |
| Microinstruction execution | `l/usim/uexec.c` |
| Microinstruction disassembly | `l/usim/udiss.c` |
| Virtual memory | `l/usim/uvmem.c` |

Public comparison sources:

- [1979 LISP Machine Macro Instruction Set](https://bitsavers.org/pdf/mit/cadr/Knight-LISP_Machine_Macro_Instruction_Set-1979.pdf),
  SHA-256 `a4bad4eed37efad17640e137670cd6d058920f807da02676865f0a921ef81bb8`.
- [AI Memo 528, LISP Machine](https://bitsavers.org/pdf/mit/cadr/AIM-528_CADR.pdf),
  SHA-256 `add5cd4c601137c7e5c9476778b76a1e757fa5756c7be4158efbe87693f87586`.
- [System 46 source](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af),
  commit `8e978d7d1704096a63edd4386a3b8326a2e584af`.
- [LM-3 System 303 source](https://tumbleweed.nu/r/lm-3/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

No screenshot is required for this processor specification: its normative outputs
are instruction, object, stack, fault, and machine-state traces rather than a
visible application. The runtime compiler/disassembler screenshot in the
[compiler dossier](../lisp-runtime-compiler-and-development-environment.md) is a
separate visible oracle for the user-facing disassembler.
