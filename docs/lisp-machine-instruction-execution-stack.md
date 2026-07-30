---
type: Technical Article
title: What executes on CADR and Genera Lisp machines
description: A release-bounded map from Lisp source through compiled functions, processor instructions, microcode or emulation, and host hardware for MIT CADR and Symbolics Ivory/Open Genera.
tags: [lisp-machine, mit-cadr, genera, compiler, instruction-set, microcode, virtual-machine]
timestamp: 2026-07-27T08:38:56-04:00
---

# What executes on CADR and Genera Lisp machines

The short answer is that compiled Lisp becomes native Lisp-machine instructions, not
a portable Lisp bytecode. On CADR, those 16-bit macroinstructions are interpreted by
CADR microcode, whose 48-bit microinstructions are the words directly executed by
the processor datapath. On an Ivory machine, compiled Lisp becomes the tagged
I-machine instruction set and is executed directly by the Ivory processor. Open
Genera's VLM interprets that same Ivory instruction architecture in host software.

```text
MIT CADR / LM-3

Lisp source
  -> compiler
  -> FEF containing 16-bit CADR macroinstructions
  -> UC-MACROCODE interpreter in writable control store
  -> 48-bit CADR microinstructions
  -> CADR datapath, memory system, and devices

Open Genera

Lisp source
  -> I-Lisp compiler and linker
  -> compiled function containing 18-bit Ivory instructions
  -> VLM instruction interpreter
  -> host CPU and Life Support

Physical Ivory

Lisp source
  -> I-Lisp compiler and linker
  -> compiled function containing 18-bit Ivory instructions
  -> Ivory processor
```

This is why calling either system “a Lisp VM” needs qualification. The CADR is a
microprogrammed physical processor whose macroinstruction layer resembles a
language-specific VM. Ivory is a physical Lisp processor with an architectural
instruction set. Open Genera is a virtual machine implementation of Ivory.

## The layers and their units

| Layer | CADR / LM-3 | Ivory / Open Genera | Is it executable processor code? |
| --- | --- | --- | --- |
| Source language | Lisp forms and macros | Lisp forms and macros | No |
| Compiler output container | FEF and related compiled objects | Compiled functions and linkage records | Container, not itself an instruction set |
| Lisp instruction | 16-bit macroinstruction, normally two per 32-bit word | 18-bit packed instruction, normally two per 40-bit word; full-word call/entry and constant forms also exist | Yes |
| Lower execution layer | 48-bit CADR microinstruction | Ivory hardware implementation or VLM host implementation | CADR: yes; Ivory hardware: implementation below the architectural ISA |
| Serialized loader language | QFASL commands and L-BIN loader operations | FASL/world loader records | No: these construct and relocate objects |
| Saved machine state | Load band / saved world | VLOD world plus host configuration and auxiliary files | No: state image containing executable objects |

The [compiled-object and UNFASL article](compiled-objects-qfasl-relocation-and-unfasl.md)
inventories loader commands. Those opcodes are a serialization language. They tell a
loader to allocate, relocate, intern, initialize, or finish objects; the processor
does not fetch them as instructions.

## CADR: macroinstructions interpreted by microcode

The selected maintained target is LM-3 System 303, check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
The compiler emits macroinstructions into a Function Entry Frame. The instruction
stream is made of 16-bit halfwords, and the microcode maintains the macro PC,
instruction buffer, current FEF, argument/local stack frame, binding stack, catch
state, and tagged Lisp objects.

System 303's `UC-MACROCODE` fetch loop dispatches the decoded class to microcode
routines for calls, list operations, arithmetic, predicates, branches, bindings,
array access, and the large MISC family. Page faults, interrupts, sequence breaks,
single stepping, and breakpoints are part of that interpreter's control flow rather
than host-emulator conveniences.

Below that layer, the CADR control store supplies 48-bit microinstructions. A
microinstruction selects A-memory and M-memory sources, an ALU/byte/jump/dispatch
operation, destinations, sequencing flags, and optional functional sources or
destinations. The current `usim` implementation executes these words and models the
control store, A and M memories, PDL buffer, microstack, dispatch memory, virtual
memory maps, and devices.

The full reconstruction contract is the
[CADR macroinstruction and microarchitecture specification](mit-cadr/cadr-macroinstruction-and-microarchitecture-reimplementation-specification.md).
The existing
[microcode, microassembler, and console-debugger dossier](mit-cadr/cadr-microcode-microassembler-and-console-debugger.md)
describes how those control-store words are built and diagnosed.

## Ivory: one architecture, hardware or software execution

Ivory uses 40-bit tagged words. A packed-instruction word contains two 18-bit
instructions; four bits of their encoding occupy part of the word's data-type field.
Other executable word forms include full-word call instructions, entry instructions,
constants, and external-value-cell references. Encountering a word with a data type
that is not executable in the current position causes an architectural exception.

The packed format has an 8-bit opcode and a 10-bit operand. Depending on the opcode,
the operand is:

- an FP-, LP-, or SP-relative stack operand;
- an immediate integer;
- a signed branch displacement;
- a field position and width; or
- an instruction-specific unsigned value.

The architecture includes tagged memory cycles, invisible-pointer following, stack
cache state, function calling, multiple-value disposition, dynamic binding, catch
and unwind, lexical and instance access, allocation, ephemeral garbage-collector
barriers, page-hash-table translation, traps, and coprocessor operations. These are
not library conventions layered over an untyped integer CPU; they are part of the
instruction architecture visible to compiled code.

Physical Ivory implements that contract in hardware and microcode. Open Genera's VLM
keeps the same guest-visible processor state and executes it in host code. Life
Support supplies virtual disks, paging, network packet transfer, console services,
time, X display relay, and other host integration, but it does not replace the
I-machine instruction semantics.

The full reconstruction contract is the
[Ivory I-machine and Open Genera VLM specification](genera/ivory-i-machine-and-vlm-reimplementation-specification.md).
The companion
[Ivory, FEP, and VLM dossier](ivory-fep-and-open-genera-vlm-implementation-layers.md)
documents the wider boot, debugger, and host-service layers.

## Is this bytecode?

“Bytecode” is defensible only as an analogy for the CADR macroinstruction stream or
the VLM's input. It is misleading if it suggests Java-style portability:

- CADR macroinstructions are the native compiled-code interface of a particular
  tagged, stack-oriented machine and are interpreted by release-specific microcode.
- Ivory instructions are the native ISA of a real Symbolics processor.
- The VLM emulates Ivory rather than defining a separate Open Genera bytecode.

“Machine Lisp” or “Lisp-machine instruction set” is the less ambiguous term.

## What can be recovered from a world image

A world contains compiled functions whose instruction words and constants can be
located and disassembled. That can recover:

- function identities where names and debug information survive;
- instruction sequences and constant references;
- call sites and some control-flow structure;
- argument and local-variable metadata retained by the compiler;
- literal strings, symbols, methods, tables, and other live objects; and
- enough behavior to construct a semantically equivalent reimplementation in many
  cases.

It cannot generally recover original macro use, comments, lexical spelling,
discarded declarations, exact source structure, or code removed by optimization.
The result is best described as disassembly plus object-graph reconstruction, not
the original Lisp source. See
[world loads and VLOD](genera/world-loads-and-vlod.md) and
[runtime, compiler, and development environment](lisp-runtime-compiler-and-development-environment.md).

## Evidence boundaries

The CADR conclusions use public System 46 source at Git commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`, maintained LM-3 System 303 at Fossil
check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
and the current public `usim` executable model at check-in
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`.
The 1979 macroinstruction memo is used as historical design evidence only where
System 303 source agrees.

The Ivory conclusions use the public
[I-Machine Architecture Specification](https://bitsavers.org/pdf/symbolics/I_Machine/I-Machine_Architecture_Specification.pdf),
SHA-256 `b45cd026d6930e27f9830efefc9ab8d7f1da01dd030ab6adf876d56603b34a89`,
the licensed Genera 8.5 source inventory without reproducing its text, the local
Open Genera runtime observations recorded in the companion dossier, and the public
VLM descendant at Git commit
[`55b2a3b1cf884f827d85829713587657c435cb29`](https://github.com/LdBeth/osx-vlm/tree/55b2a3b1cf884f827d85829713587657c435cb29).
The public descendant is a structural cross-check, not proof of the exact source
used to build the preserved historical VLM executable.
