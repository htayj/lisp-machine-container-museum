---
type: Artifact Analysis
title: Compiled objects, QFASL, relocation, and UNFASL
description: A source and runtime dossier on CADR QFASL and QFASL-REL, Genera L-BIN, their inspection tools, load-time effects, and realistic source-recovery limits.
tags: [mit-cadr, lm-3, genera, qfasl, rel, l-bin, unfasl, unbin, compiled-code, preservation]
timestamp: 2026-07-18T10:06:00-04:00
---

# Compiled objects, QFASL, relocation, and UNFASL

## Conclusion

CADR QFASL and Genera L-BIN files are neither ordinary archives nor whole-machine
snapshots. Each is a compact loader program: a typed stream can construct Lisp
objects, compiled functions, and arrays, then install definitions or perform other
load-time actions. A cautious parser can recover meaningful structure—names,
packages, constants, aggregate data, function boundaries, machine-code
disassembly, and sometimes source-file metadata—but cannot in general recreate the
original Lisp source.

`UNFASL` and `UNBIN` are consequently best understood as structural disassemblers,
not decompilers. Their output can retain the operational effect of parts of a file,
but comments, macro invocations, formatting, compiler decisions, and much
high-level lexical structure have already been erased. Even the vendor inspection
tools are not a safe sandbox for hostile input: they create live Lisp objects and
reuse parts of the loader. Preservation extraction should use a closed,
non-evaluating parser where possible and an isolated disposable world otherwise.

The names also need care. Genera's `L-BIN` is its compiled-file substrate. The
separate `SYS:BIN` string/object encoding, Zmail `KBIN`, and
`C+LISP-SUPPORT`/`OCTET-STRUCTURE` are not alternate spellings or versions of that
compiled-file format.

## Evidence boundaries

| Boundary | Evidence inspected | What it establishes |
| --- | --- | --- |
| MIT System 46 | Public QFASL constants, loader, dumper documentation, and early `UNFASL` at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | The early 52-slot loader language, 16-bit group encoding, load-time effects, and an early disassembler |
| Maintained LM-3 System 303 | Public `QFASL`, `QFASL-REL`, `QC-FILE`, and `UNFASL` sources at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | The evolved 56-slot language, selectable QFASL/REL compiler output, relocation representation, and maintained inspection interface |
| Genera 8.5/Open Genera | Licensed `L-BIN` definitions, dumper, loader, and `UNBIN` source, inspected locally without reproducing proprietary source | The version-5 command language, architecture-specific compiled-function paths, live loader effects, and limits of `UNBIN` |
| Empirical recovery | The repository's public 19-file CADR font recovery and a fresh System 303 run | That a restricted, non-evaluating QFASL parser can recover complete data objects, and that `SI:UNFASL-PRINT` is present in the inspected load band |

The word *complete* below has a precise grain. The QFASL inventory covers every
entry in the inspected System 303 `FASL-OPS` vector and identifies every changed or
added slot relative to System 46. The L-BIN inventory covers every opcode defined
by the inspected version-5 definitions file. It does not claim that either format
is unchanged in every historical release.

## What kind of artifact is this?

| Property | QFASL / L-BIN | Conventional archive | World or VM snapshot |
| --- | --- | --- | --- |
| Primary unit | Loader operation and constructed Lisp value | Named member plus bytes | Address space, device, and execution state |
| Can install definitions? | Yes | Not by itself | Definitions are already resident |
| Can execute a form while loading? | Yes | Not by itself | Execution resumes from saved state |
| Contains an entire running system? | No | Usually no | Ordinarily yes, within the snapshot boundary |
| Supports selective structural extraction? | Yes, if its operation language is decoded | Usually yes | Only through snapshot-aware object/memory analysis |
| Equivalent to original source? | No | Only if source was stored as a member | No |

The closest ordinary analogy is an object file with a richer, Lisp-aware linker
script. QFASL and L-BIN do not merely carry instruction bytes: they can allocate
objects, refer back to previously decoded values, intern names, initialize cells,
and invoke load-time behavior. QFASL-REL moves still closer to a relocating heap
image, but it remains a particular compiled-file representation rather than a
saved machine.

## CADR QFASL

### Stream and group encoding

A QFASL stream is read as 16-bit units historically called *nibbles*. The stream
begins with two octal magic values, `143150` and `071660`. A normal operation begins
with a group header containing:

- a check bit that must be set;
- an operation-specific flag bit;
- an eight-bit count of following units, with an extended-length escape; and
- a six-bit operation number.

Operations can consume raw 16-bit units and can recursively request values from
nested groups. A value-producing group enters its result in a FASL table and returns
that table index. Later `INDEX`, `MOVE`, fetch, store, aggregate, and compiled-frame
operations can refer to it. A file contains one or more independently loadable
*whacks*; the working FASL table is discarded and reinitialized at a whack boundary.

This is a small virtual machine for object construction. The format is not a flat
sequence of printed s-expressions, and a symbol name inside it need not correspond
to a recoverable source definition.

### Complete System 303 operation inventory

The maintained System 303 table has 56 positions. The following grouping is
explanatory; the actual numeric opcode is the operation's zero-based position in
the source vector.

| Role | Count | Operations |
| --- | ---: | --- |
| Framing and references | 8 | `ERR`, `NOOP`, `INDEX`, `MOVE`, `END-OF-WHACK`, `END-OF-FILE`, `SOAK`, `LARGE-INDEX` |
| Names and scalar values | 9 | `SYMBOL`, `PACKAGE-SYMBOL`, `STRING`, `FIXED`, `FLOAT`, `NEW-FLOAT`, `CHARACTER`, `RATIONAL`, `COMPLEX` |
| Lists and arrays | 9 | `LIST`, `TEMP-LIST`, `LIST-COMPONENT`, `ARRAY`, `ARRAY-PUSH`, `NULL-ARRAY-ELEMENT`, `INITIALIZE-ARRAY`, `INITIALIZE-NUMERIC-ARRAY`, `STOREIN-ARRAY-LEADER` |
| Evaluation and Lisp state | 12 | `EVAL`, `EVAL1`, `APPLY`, `STOREIN-SYMBOL-VALUE`, `STOREIN-FUNCTION-CELL`, `STOREIN-PROPERTY-CELL`, `STOREIN-SYMBOL-CELL`, `FETCH-SYMBOL-VALUE`, `FETCH-FUNCTION-CELL`, `FETCH-PROPERTY-CELL`, `REMOTE-VARIABLE`, `FILE-PROPERTY-LIST` |
| Compiled layout, addresses, and relocation | 9 | `FRAME`, `FUNCTION-HEADER`, `FUNCTION-END`, `QUOTE-POINTER`, `S-V-CELL`, `FUNCELL`, `CONST-PAGE`, `SET-PARAMETER`, `REL-FILE` |
| Reserved slots | 9 | `UNUSED10`, `UNUSED11`, `UNUSED12`, and `UNUSED1` through `UNUSED6` |

`FUNCTION-HEADER` and `FUNCTION-END` delimit compiled regions for file-editing and
inspection operations; they do not themselves recreate a `DEFUN`. `FRAME` carries
boxed and unboxed components used to construct compiled frames. Array construction
is similarly split: one operation makes an array object, other operations populate
its elements or leader.

### System 46 to System 303 evolution

System 46 has 52 table positions. Most positions retained their meanings, but these
changes prove that the common magic number alone is not a compatibility guarantee:

| Slot | System 46 | System 303 |
| ---: | --- | --- |
| 12 | `UNUSED7` | `LIST-COMPONENT` |
| 26 | `MAKE-MICRO-CODE-ENTRY` | `NULL-ARRAY-ELEMENT` |
| 27 | `SAVE-ENTRY-POINT` | `NEW-FLOAT` |
| 28 | `MICRO-CODE-SYMBOL` | `UNUSED10` |
| 29 | `MICRO-TO-MICRO-LINK` | `UNUSED11` |
| 30 | `MISC-ENTRY` | `UNUSED12` |
| 36 | `UNUSED` | `CHARACTER` |
| 52–55 | absent | `RATIONAL`, `COMPLEX`, `LARGE-INDEX`, `STOREIN-SYMBOL-CELL` |

The retired entries reflect an earlier path for linking PDP-10-style microcode
artifacts. The later table instead adds language data types and larger table
references. A preservation parser therefore needs a release-specific opcode table,
not a single guessed “CADR QFASL” dialect.

### Loading can execute and mutate

The full loader is intentionally active. `EVAL` and `EVAL1` evaluate reconstructed
forms. `APPLY` invokes a reconstructed function with reconstructed arguments.
Store operations change value, function, property, symbol, or array-leader cells;
fetch operations depend on the current world. A relocation escape transfers control
to another loader. Compiled-frame and older microcode operations construct code or
link it into the running environment.

Consequences for preservation are direct:

- file extension and magic bytes do not make an arbitrary QFASL passive;
- loading in a historically valuable world can redefine functions or corrupt state;
- a parser that implements only data constructors is safer than a loader with
  “evaluation disabled” after parsing, because other mutation operations remain;
- an unknown opcode, malformed size, incompatible slot table, or unexpected
  load-time form should be a hard rejection, not a best-effort skip.

### `QC-FILE`, QFASD, and output choice

The file compiler reads source forms, compiles definitions, and sends the resulting
objects and top-level effects to a dumper. In System 303, `QC-FILE` can select
ordinary QFASL or REL output (`:FASL` and `:REL` in the inspected implementation).
It records macros expanded while compiling and can include file property data, but
that metadata is not a reversible record of every macro invocation or source form.

This distinction explains why “decompile the QFASL” is not an inverse compiler
operation. The dumper serializes the compiler's chosen runtime objects and required
effects. Multiple source programs can produce equivalent loader streams, and the
stream does not record which of those programs was the original.

## QFASL-REL

### Container and five-operation sublanguage

A REL file starts like a QFASL, then uses `FASL-OP-REL-FILE` to escape into a
different halfword stream. The inspected System 303 loader defines this complete
five-entry operation vector:

| Value | Operation | Function |
| ---: | --- | --- |
| 0 | stop / `NIL` | Leave the REL subloader and permit ordinary QFASL data to continue |
| 1 | `READ-STORAGE-FORMAT-VERSION` | Compare the file's storage representation version with the loader |
| 2 | `READ-PACKAGE-NAME` | Select the package context encoded by the file |
| 3 | `READ-SYMBOLS` | Read and intern referenced symbols and cell locatives |
| 4 | `READ-DATA` | Read the section dictionary and section contents, relocate them, then process section 1 |

The storage-format version is independently checked and is `1` in the inspected
loader. This is a second compatibility boundary beyond the outer QFASL opcode
table.

### Sections and relocatable pointers

The dumper divides objects by area and representation into contiguous sections.
A relocatable pointer uses its high ten bits for a section number and its low 14
bits for the index within that section. The loader chooses a destination area for
each section, loads its words, identifies pointer-bearing data types, and adds the
appropriate relocation base.

Two sections have special semantics:

- Section 0 stands for interned symbols and references to their value and function
  cells. Its actual data is reconstructed from the symbol table rather than loaded
  as an ordinary section.
- Section 1 contains forms to evaluate and optimized store commands. References to
  its results become fixup lists; after an entry is processed, its value is written
  to every referring location.

Other sections contain list or structure storage placed into an area chosen through
the format's area-code map. The representation therefore preserves a larger portion
of the compiler's connected object graph than a sequence of independent QFASL
constructors. It is reasonable to describe REL as a relocating Lisp heap fragment
inside a loader container. It is still not a world snapshot: it excludes unrelated
memory, process state, devices, and the rest of the running system.

## `UNFASL`

### Maintained user interface

System 303 exposes two user-callable entry points:

```lisp
(si:unfasl-file input-file &key output-file verbose terse)
(si:unfasl-print input-file &key verbose terse)
```

`UNFASL-FILE` writes a textual description and defaults the output pathname to the
input name with type `UNFASL`. `UNFASL-PRINT` writes the description to the current
output stream. Both default the input type to `QFASL`, verify the two magic units,
reinitialize the table at each whack, and accept `verbose` and `terse` controls.

The maintained implementation deliberately represents decoded names as
`unfasl-symbol` objects printed with angle brackets. Its source says this extra
syntax prevents the output from misleading a reader into treating them as ordinary
interned symbols. That design is a useful warning about the entire output: it is a
description of loader structures, not a source file ready to compile.

### What it retains and what it cannot restore

| Often visible or inferable | Usually lost or not reliably reversible |
| --- | --- |
| package and symbol names | comments and source whitespace |
| literal strings, numbers, lists, and array contents | original macro calls after expansion |
| function-region boundaries | original `LET`, local-function, and declaration spelling |
| compiled constants and linkage targets | names optimized away or never emitted |
| some file properties and source-path references | exact top-level form organization |
| disassemblable instruction words | portable high-level control flow and data types |
| explicit load-time forms and cell stores | authoring history and intent |

A separate decompiler could build control-flow graphs and higher-level pseudo-Lisp
from compiled frames. That would be a new analysis tool, not a mode already supplied
by `UNFASL`, and its output would remain a semantic approximation.

### Fresh System 303 observation

An isolated System 303-0 session on 2026-07-18 evaluated
`(fboundp 'si:unfasl-print)` and returned `T`. A subsequent attempt to inspect
`SYS:FONTS;5X5.QFASL` reached the UNFASL pathname-opening path, then requested a
login for the unconfigured `ED-FILE` host and entered the error handler. No file was
opened or loaded. This establishes that the inspected load band contains the
maintained entry point, while also showing that its logical pathname defaults depend
on a configured file-service environment.

The local session was `d23-qfasl-unfasl-20260718`, generation 1. It used load band
`System 303-0`, base disk SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`, and `usim`
SHA-256 `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.
The base disk was unchanged and the emulator exited normally without a forced stop.
The ignored run record is 6,888 bytes with SHA-256
`4d54aed2992fcdc917bb9106f5c604167cdabbcb183925a4bf6e5f627a5203ec`.

No screenshot is published. The successful result was a single listener return and
the failed pathname attempt was an error backtrace; neither visible state adds
enough explanatory value to justify another curated image. The raw run remains
local with its provenance.

## Empirical QFASL recovery: the CADR fonts

The repository's [compiled CADR font recovery](mit-cadr/compiled-qfasl-font-recovery.md)
is a concrete counterexample to the claim that every compiled file must be run. All
19 reviewed public font QFASLs use a closed 14-operation subset consisting of name,
number, list, array, table, initialization, and termination operations. None uses
evaluation, application, compiled-function construction, relocation, or microcode
linkage.

[`extract-cadr-qfasl-fonts.py`](../scripts/extract-cadr-qfasl-fonts.py) implements
only that observed subset, verifies a closed input manifest, validates the exact
runtime `FONT` object shape, and rejects every other opcode. It recovers usable BDF,
normalized JSON, and raster specimen sheets without running Lisp. Those are complete
exports of the serialized runtime bitmap objects, but they are not the missing
authoring files from which those objects were produced.

This pattern generalizes carefully: one may recover an asset or data structure when
the encountered operations and target object schema are both understood. It does
not justify treating arbitrary QFASL as inert data.

## Genera L-BIN

### Version-5 command encoding

The inspected L-BIN definitions say each command is a 16-bit word. The high four
bits select a main dispatch and the low 12 bits carry an immediate operand. One
high-field value escapes into a larger command table. Format version `5` is current
in these sources; the loader accepts version 4 directly, offers a condition/restart
path for obsolete version 3, and rejects other unsupported versions.

There are 55 named definitions: 12 immediate operations, including the command
escape, and 43 escaped command operations.

### Complete immediate inventory

| Operation | Function |
| --- | --- |
| `NUMBER-IMMEDIATE` | Decode a sign-extended small integer from the immediate field |
| `TABLE-FETCH-IMMEDIATE` | Refer to a nearby object-table entry |
| `STRING-IMMEDIATE` | Construct a short immediate-length string |
| `LIST-IMMEDIATE`, `LIST*-IMMEDIATE` | Construct short proper or dotted lists |
| `ARRAY` | Construct an array whose short size is carried immediately |
| `DEFCONST`, `DEFVAR` | Encode short defining forms/effects |
| `MAKE-INSTANCE-IMMEDIATE` | Reconstruct an instance from a flavor name and short init plist |
| `EMBEDDED-CONSTANT-IMMEDIATE` | Refer to a tagged constant embedded in an Ivory compiled function |
| `INITIALIZE-LIST-IMMEDIATE` | Initialize a short list payload |
| `COMMAND-IMMEDIATE` | Escape the low 12 bits into the command dispatch table |

### Complete escaped-command inventory

| Role | Count | Operations |
| --- | ---: | --- |
| Framing and file metadata | 4 | `FORM`, `EOF`, `FILE-ATTRIBUTE-LIST`, `FORMAT-VERSION` |
| Object table | 6 | `TABLE-FETCH`, `TABLE-STORE`, `TABLE-FETCH-MEDIUM`, `TABLE-FETCH-LARGE`, `TABLE-STORE-INITIALIZER`, `INITIALIZE-LIST` |
| Names, packages, and strings | 6 | `SYMBOL`, `PACKAGE-SYMBOL`, `PACKAGE`, `STRING`, `CHARACTER-STYLE`, `CHARACTER-SET` |
| Lists and arrays | 8 | `LIST`, `LIST*`, `INITIALIZE-ARRAY`, `INITIALIZE-NUMERIC-ARRAY`, `INITIALIZE-AND-RETURN-ARRAY`, `INITIALIZE-AND-RETURN-NUMERIC-ARRAY`, `CONVERT-ARRAY-TO-FLOATING`, `SMALL-CHARACTER` |
| Numbers and characters | 11 | `INTEGER`, `NEGATIVE-INTEGER`, `RATIO`, `FLOAT`, `NEGATIVE-FLOAT`, `CHARACTER`, `EXTENDED-NUMBER`, `32-BIT-FIXNUM`, `IEEE-SINGLE-FLOAT`, `IEEE-DOUBLE-FLOAT`, `COMPLEX` |
| Definitions and locations | 5 | `VALUE-CELL-LOCATION`, `FDEFINITION-LOCATION`, `FDEFINE`, `SETQ`, `PUTPROP` |
| Compiled representation | 3 | `L-COMPILED-FUNCTION`, `I-COMPILED-FUNCTION`, `NATIVE-INSTRUCTION` |

The table records both 3600-family “L” and Ivory “I” compiled functions. Their load
and disassembly paths are architecture-conditional; the wrong machine family does
not silently reinterpret the code. Styles and character sets in the command
language also show that L-BIN can serialize more than executable functions.

### Loading effects

The L-BIN loader evaluates a `FORM`, installs definitions through `FDEFINE`, sets
variables through `SETQ`, changes property lists through `PUTPROP`, interns or looks
up packages and symbols, creates arrays and instances, and constructs compiled
functions. The file-attribute list can change source-path metadata used for
definition records. As with QFASL, loading is an operation with effects in the
current Lisp world, not archive extraction.

## `UNBIN`

The inspected interfaces are:

```lisp
(unbin-file file &optional outfile)
(unbin-file-to-stream file)
```

`UNBIN-FILE` defaults its textual output to type `UNBIN`. It prints a `FORM` as a
synthetic `(**EVAL** form)` marker and disassembles architecture-appropriate compiled
functions. It consumes but deliberately does not reproduce the actual installing
effects of `FDEFINE`, `SETQ`, and `PUTPROP` as executable forms.

That makes the output safer to read, not proof that the inspector is a pure byte
parser. `UNBIN` shares loader routines for arrays and compiled functions, constructs
objects, interns bookkeeping symbols, looks up packages, character styles, and
character sets, and creates symbolic `MAKE-INSTANCE` descriptions. It should be run
on untrusted media only in an isolated, disposable world with no useful network or
writable preservation input attached.

The same source-recovery limits apply as with UNFASL. Disassembly can preserve the
effect of instruction sequences for the original architecture. It does not recover
the exact Lisp forms, macros, declarations, or comments that led the compiler to
emit them.

## Similar names that are different systems

| Name | Inspected role | Relationship to compiled Lisp |
| --- | --- | --- |
| `L-BIN` | Genera compiled-file dumper, loader, and `UNBIN` disassembler | The relevant Genera compiled-object format in this dossier |
| `SYS:BIN` | Separate string/object serializer with 12 opcodes for simple, run-length, 16-bit, general, and displaced strings plus fixnums, symbols, styles, `NIL`, keywords, and ratios | General binary object/string transport, not the L-BIN compiler loader |
| Zmail `KBIN` | Mail-store buffer, dump, load, and tracing subsystem | Application data persistence, not a compiled Lisp dialect |
| `C+LISP-SUPPORT` | Distribution name for the embedding/RPC `OCTET-STRUCTURE` facility | Interoperability support, not a compiled-object format |

The prior grouped catalog row that placed all four names beside QFASL was therefore
too broad. Future application dossiers should cover `SYS:BIN` with data interchange,
`KBIN` with Zmail storage, and `C+LISP-SUPPORT` with embedding/RPC rather than
claiming a common compiled-file lineage.

## Practical recovery model

### Recoverable at high confidence

- a documented, closed data-only opcode subset;
- exact scalar, list, string, array, and named-structure contents when the runtime
  schema is known;
- package and symbol spelling carried by the file;
- function-region boundaries and architecture-specific instruction streams;
- explicit source pathname or file-attribute metadata still present in the artifact;
- explicit load-time forms, with the warning that their subforms may already be
  compiler-generated or macro-expanded.

### Recoverable only as a semantic reconstruction

- control-flow graphs and pseudo-code inferred from machine instructions;
- approximate Lisp expressions reconstructed from calls, branches, constants, and
  stack/dataflow analysis;
- definition relationships inferred from cell stores and linkage records;
- data types inferred from operations or runtime conventions rather than preserved
  source declarations.

### Not recoverable in general

- comments, whitespace, and editorial layout;
- the exact macro calls and reader syntax used by the author;
- names or abstractions erased by optimization;
- dead source that produced no serialized effect;
- a unique original program when multiple programs compile to the same result.

## Preservation procedure

For a newly found compiled artifact:

1. Hash it and identify the release and rights boundary before decoding.
2. Determine the dialect from provenance and version fields, not extension alone.
3. Inventory every encountered opcode before implementing effects.
4. Prefer a parser that never calls the historical evaluator, loader, package
   system, or compiled-function constructor.
5. Whitelist expected operation sequences and target schemas; reject everything
   else, including trailing data.
6. Separate exact serialized values from inferred pseudo-source in the output.
7. If the vendor inspector is required, use a disposable world with copied inputs,
   no credentials, no useful writable disks, and no network service.
8. Retain input checksum, tool revision, command, output checksum, and every warning
   needed to reproduce the result.

For licensed Genera artifacts, keep recovered code, data, and disassembly in ignored
local output. A tracked tool may describe how to perform an analysis without
committing the proprietary result.

## Open questions and deferred work

- **TODO:** Exercise `UNFASL-PRINT` on a small public QFASL through a configured
  System 303 local or network pathname. The fresh run confirmed the entry point but
  not a complete on-machine dump.
- **TODO:** Build a general inert QFASL inventory tool that identifies dialect and
  lists operations without constructing objects. The font extractor is deliberately
  narrower and should stay so.
- **TODO:** Compare actual QFASL and REL outputs of the same small public source file
  to quantify which names, forms, and debug structures each retains.
- **TODO:** Document Genera's separate `SYS:BIN`, Zmail `KBIN`, and embedding/RPC
  octet-structure facilities in their correct application dossiers.
- **TODO:** A high-confidence compiled-function decompiler would require complete
  instruction semantics, control/dataflow recovery, and tests against known source;
  neither `UNFASL` nor `UNBIN` supplies that transformation.

## Artifact records

### Public System 46 files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lispm/qdefs.328` | 10,329 | `c61a3a6337906886182f0333690de79ea62482e24fb07e9e33c976568ec2130c` |
| `src/lispm/qfasl.283` | 29,575 | `8cf64af3a06dc2182444b9f6af2cd52f50cbf98f4cc60eabc8ac75adfcf24aeb` |
| `src/lmcons/unfasl.60` | 15,561 | `aabac9d4312a7e19dee8d4fcbddd9bf07e0eb733b0e226399419eedd52ed39dc` |

### Public System 303 files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `cold/qdefs.lisp` | 12,041 | `d7236a1194492b50b4599163bfb4a6eddb0595419c620267ea72d1f33c78e632` |
| `sys/qfasl.lisp` | 45,184 | `14b8924ea809697df54ff2c5c9f12f0b3b7c0bd6ea0d476aac7e08403d38efc9` |
| `sys2/unfasl.lisp` | 23,197 | `f67c2efb7889a0e193e75ca014295bcde9f94b6eaa7891b6cb7a6ff52743c5e7` |
| `io1/reldmp.lisp` | 18,048 | `1c2682725b4131f35918688f4d364fbc2831b290b8d54244c18bd9694d91729a` |
| `io1/relld.lisp` | 20,490 | `8f89c1d7df74123deea3a8fe0eca018f6a0a7308beef50aadfe74f0c89f35c2a` |

### Licensed Genera files

The following are portable records of local licensed inputs; the source files and
their contents remain untracked.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `sys.sct/l-bin/defs.lisp.~97~` | 10,641 | `f1f25b75ec26e308fb4309f63620f7bd7d0ca598d0e05e73731cea7188ab61fd` |
| `sys.sct/l-bin/dump.lisp.~186~` | 38,936 | `a1131e0e5003be508c7ae23de4a81f110f77426ead8928e72a6b5bad29592478` |
| `sys.sct/l-bin/load.lisp.~310~` | 50,295 | `0edc78081aaebde6bbeef62096085ed87ae84f1f0ff017eae60893e4c1d48f3e` |
| `sys.sct/l-bin/unbin.lisp.~85~` | 15,783 | `a56824c724fca243196c71de233df67ef1e0b6ad6f1705d6c60be5a4483f9158` |

## Sources

- MIT System 46, pinned [`FASL-OPS` and group fields](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qdefs.328),
  [`QFASL` loader](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qfasl.283),
  [format documentation](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/fasld.1), and
  [early `UNFASL`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmcons/unfasl.60).
- LM-3 project, pinned System 303 [`FASL-OPS`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=cold%2Fqdefs.lisp),
  [`QFASL` loader](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fqfasl.lisp),
  [`QC-FILE`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fqcfile.lisp),
  [`UNFASL`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys2%2Funfasl.lisp),
  [REL dumper](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Freldmp.lisp), and
  [REL loader](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Frelld.lisp).
- Symbolics Genera 8.5 licensed source files recorded in the artifact table above,
  inspected locally on 2026-07-18; no proprietary source is reproduced here.
- Repository analyses, [compiled CADR font recovery](mit-cadr/compiled-qfasl-font-recovery.md)
  and [VLOD world-image format](genera/world-loads-and-vlod.md).

Last verified: 2026-07-18.
