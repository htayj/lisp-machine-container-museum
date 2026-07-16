---
type: Preservation Note
title: Recovering code and assets from a Genera world
description: What can be reconstructed from compiled functions and heap-resident fonts, and where fidelity to the original source is lost.
tags: [genera, open-genera, decompilation, fonts, preservation]
timestamp: 2026-07-16T15:15:02-04:00
---

# Recovering code and assets from a Genera world

## Bottom line

A Genera world can yield something meaningfully described as **decompiled Lisp**, but
not, in general, the original or idiomatic Lisp source. The defensible target is a
symbolic Ivory instruction representation or generated low-level Lisp that implements
those instructions against a faithful Genera/Ivory runtime. Such output can retain the
compiled program's effects while looking more like a control-flow state machine than
the program its author wrote.

Fonts are easier. A resident Genera screen font contains the bitmaps and metrics used
for display, so those can be exported at that represented level. This does not recreate
the exact original font file or authoring metadata. In this distribution, separate BFD
and BDF font files already exist and are preferable to reconstruction from the world.

| Recovery target | Feasibility from the world alone |
| --- | --- |
| Original source text, comments, and formatting | Not generally recoverable |
| Original macro calls and high-level control structure | Not generally recoverable |
| Saved interpreted Lisp forms | Recoverable when present; none surfaced in a bounded scan of this base world |
| Named symbolic Ivory disassembly | Feasible |
| Executable, low-level Lisp with equivalent Ivory semantics | Feasible in principle with a compatibility runtime |
| Automatically recovered idiomatic portable Common Lisp | Not a defensible general claim |
| Resident font glyphs and display metrics | Raster and basic metric decoding directly demonstrated |
| Byte-identical original font files and authoring metadata | Not generally recoverable from resident font objects |

## Why compiled code is not the original source

An Ivory compiled function is a Lisp object containing a machine-instruction program.
Its suffix can retain its function name, debugging information, linkage data, and
constants. Genera's disassembler uses this material to print symbolic instructions and
can often attach useful names to calls, constants, arguments, and local variables.

Compilation is nevertheless many-to-one. It expands macros, substitutes and folds
constants, inlines or open-codes operations, deletes dead code, and merges control-flow
paths. Comments, whitespace, reader spellings, the author's macro choices, and much of
the history of top-level forms are not executable semantics and need not survive. Two
different source programs can therefore produce indistinguishable compiled functions.

Genera source locators do not recreate exact source text. Depending on the compilation
mode, debug metadata can associate machine-instruction intervals with retained parsed
forms and read correspondences; development tools also use locators with source in
editor buffers. This can preserve valuable source structure, but not comments,
formatting, or necessarily the form exactly as the author read it. Genera's `uncompile`
can recover an interpreted definition only when the compiled object has retained one
explicitly.

## What survives in this Genera 8.5 world

An offline experimental scan of the museum's base world found a large, coherent
compiled-code corpus. It used a bounded best-effort heap decoder, so the counts are a
preliminary inventory rather than a complete semantic traversal. They describe the
exact artifact identified below, not every Genera release:

- 59,217 objects matching the structural shape of Ivory compiled functions;
- a non-nil decoded representation returned for every candidate's extra-information
  suffix, although some representations contain depth, length, or opaque-object cuts;
- 25,622 simple symbol names and 33,528 compound function specifications recovered
  from those suffixes, with only 67 nil or failed names;
- compressed metadata containing representative function and package identities,
  argument and local names, declarations, constants, and occasional documentation;
- no entries named `INTERPRETED-FORM`, `INTERPRETED-DEFINITION`, `SOURCE-LOCATORS`, or
  `READ-CORRESPONDENCES` in the portions traversed by that bounded scan.

The world's own settings support that result: `*DEBUG-INFO-MODE*` is
`COMPRESS-WITHOUT-MACROS`, `*USE-SOURCE-LOCATORS*` is `NIL`, and
`*INHIBIT-USING-SOURCE-LOCATORS*` is `T`. The negative scan result agrees with those
settings but does not prove that no cut-off or opaque object contains one of those
records. For this particular base world, the evidence nevertheless favors beginning
with instructions and compressed metadata rather than assuming a hidden source corpus.

The separately supplied `sys.sct` hierarchy changes the preservation problem for the
better. It contains original Lisp files, and Genera records relationships between
function specifications and source pathnames. The most faithful approach is therefore
to match the live compiled definitions to those supplied sources, then concentrate
decompilation on patched, changed, or otherwise unmatched definitions.

## A useful definition of decompiled Lisp

A practical recovery ladder is:

1. Enumerate compiled functions in a booted world and export their names, source
   pathname associations, argument information, constants, and symbolic disassembly.
2. Decode the instruction stream into a control-flow graph and a stack-aware
   intermediate representation.
3. Recover structured conditionals and loops where justified, while retaining
   `tagbody` and `go`-like control flow where the graph is irreducible.
4. Emit Lisp whose operations call helpers with explicitly defined Ivory semantics.
5. Compare selected recovered functions with the running original by differential
   tests.

That final representation could be executable and effect-preserving, but it would be
a rehosting of compiled semantics, not recovered authorial source. Outside Genera it
needs a substantial compatibility layer for tagged arithmetic and traps, multiple
values, dynamic binding, closures, object identity and mutation, nonlocal exits,
method dispatch, subprimitives, and other Lisp-machine behavior.

“Same effects” also needs a testable boundary. For an individual function it should
cover return and multiple values, mutations to reachable objects, identity, signaled
conditions, nonlocal exits, dynamic bindings, and I/O. Whole-world equivalence also
involves scheduling, devices, timing, and saved heap state. Wrapping an interpreter
around the original instruction stream is the easiest way to maximize fidelity, but
the result becomes progressively less useful as human-readable source.

Function-by-function lifting is not by itself a conventional source-tree recovery. A
world also contains packages, classes, generic functions, instances, shared constants,
mutable objects, and effects of the original load order. Preserving a function may
require exporting the transitive object graph reachable from its constants.

## Resident fonts

Genera represents a screen font as a named Lisp array containing a one-bit glyph
raster together with height, baseline, width, left-kern, existence, and indexing
information. Genera's own font code can turn such a resident `FONT` into a BFD
description and can read or write BDF as well.

The preliminary base-world scan found 89 distinct resident `FONT` objects and 90
symbol bindings because `*DEFAULT-FONT*` and `CPTFONT` refer to the same object. It
found no resident named `BFONT-DESCRIPTOR` objects. Subject to the experimental limits
described below, this supports the interpretation that the world retained consolidated
display fonts rather than their original BFD authoring objects.

As a direct test, `CPTFONT` was decoded from the VLOD as a one-bit array. Its leader
reported a character height of 12 and fixed advance of 8, and its decoded character
65 matched the corresponding supplied native font data. The glyph itself is not
reproduced here because this repository does not distribute Genera-derived artwork.

This is an effect-preserving asset reconstruction: it can preserve the pixels,
baseline, advances, left kerns, and other resident display metrics. It need not
preserve original file bytes, comments, source outlines, discarded font or character
properties, or the exact compact glyph rectangles chosen by an earlier tool.

The all-raster resident inventory does not mean that Genera lacked outline fonts.
Genera 8.5's separate PostScript hardcopy subsystem can use built-in device fonts and
can construct downloadable Type 3 fonts from Bitstream outline segments. A complete
reference audit found the implementation but no registered Bitstream outline-font
payload in this base world. Those hardcopy objects are outside the one-bit `FONT`
schema used by the resident extractor; see
[Extracting resident fonts from a Genera world](extracting-resident-fonts.md#raster-display-fonts-and-outline-hardcopy-fonts)
for the evidence boundary.

An extractor must also understand the font schema rather than merely iterate to an
array fill pointer. `CPTFONT` has 14 historical non-spacing glyphs above its apparent
fill pointer; Genera's conversion logic recovers them, producing the same 142-glyph
count declared by the separately supplied BDF.

## Prefer the separately supplied assets

The inspected `sys.sct` tree contains 275 BFD files totaling 2,605,322 bytes and 224
plain-text X BDF files totaling 3,076,642 bytes. Resident examples checked, including
`CPTFONT`, `TVFONT`, `HL12`, and `MOUSE`, have both BFD and BDF counterparts. These
files retain more provenance than a format reconstructed from the heap and should be
the primary preservation artifacts.

Other resident arrays, icons, patterns, and bitmaps may be exported losslessly at the
level represented in memory once their object schema is known. A VLOD contains only
objects present in the saved world: unloaded assets are absent, procedurally generated
graphics may have no source file, and generic heap inspection cannot infer a lost
filename or authoring format. Technical recoverability also does not grant permission
to redistribute licensed assets.

## Reproducibility record

- artifact: `Genera-8-5.vlod`, from licensed Open Genera media;
- size: 54,804,480 bytes;
- SHA-256: `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`;
- base offline tool: [`worldtool` revision `a2fdcfd`](https://github.com/LdBeth/worldtool/tree/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf);
- compiled-function experiment: scan mapped Qs for structurally valid Ivory
  compiled-function headers, derive body and suffix bounds from each header, and pass
  suffix objects through `w-decode` with recursion depth 30 and a 50,000-cell budget;
- font experiment: locate named array leaders whose structure name is `FONT`, follow
  forwarded symbol value cells, and interpret headers, leaders, tables, and one-bit
  raster storage according to the inspected Genera schema;
- status of the compiled-function inventory: its scanner was a one-off local
  `worldtool` extension and is not in the pinned revision. Its precise counts remain
  preliminary until that scanner is committed and reports cut and opaque-object
  counts;
- status of the font inventory: the independent, standard-library
  [`extract-genera-fonts.py`](../../scripts/extract-genera-fonts.py) decoder is now
  tracked. Its [extraction record](extracting-resident-fonts.md) reproduces all 89
  resident objects and compares them with both licensed BFD and BDF reference sets.

The separate font-file inventory is reproducible from the extracted release root with
GNU `find` and `awk`:

```sh
find sys.sct -type f -iregex '.*\.bfd\(\.~[0-9]+~\)?' -printf '%s\n' |
  awk '{count += 1; bytes += $1} END {print count, bytes}'
find sys.sct -type f -iregex '.*\.bdf\(\.~[0-9]+~\)?' -printf '%s\n' |
  awk '{count += 1; bytes += $1} END {print count, bytes}'
```

The results are `275 2605322` and `224 3076642`, respectively.

The most mature first exporter would run inside booted Genera: enumerate its compiled
functions with its own object walker and use its own Ivory disassembler. Offline tools
remain valuable for independent preservation, reproducibility, and eventual recovery
when a bootable host environment is unavailable.

## Sources

- Symbolics, [*I-Machine Architecture Specification*](https://bitsavers.org/pdf/symbolics/I_Machine/I-Machine_Architecture_Specification.pdf),
  especially the manual's pages 40–43 and 56a, for compiled-function layout.
- Symbolics, [*Program Development Utilities*](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf),
  especially PDF pages 101–125 and 206–210, for compilation, optimization,
  disassembly, source locators, and interpreted definitions.
- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  especially PDF pages 344–347, for screen-font representation and metrics.
- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  “Font Support in the Genera X Client,” for the supplied BDF fonts and X font
  mechanisms.
- Symbolics, [Release 5 notes](https://bitsavers.org/pdf/symbolics/software/release_5/996012_1B_Release_Notes_198403.pdf),
  PDF page 113, for BFD use by the Font Editor and system fonts.
- X Consortium, [*Glyph Bitmap Distribution Format 2.1*](https://www.x.org/releases/X11R7.0/doc/PDF/bdf.pdf),
  for the public text bitmap-font interchange format.
- Experimental `worldtool`,
  [`cold-fun.lisp`](https://github.com/LdBeth/worldtool/blob/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf/src/cold-fun.lisp)
  and
  [`wdecode.lisp`](https://github.com/LdBeth/worldtool/blob/a2fdcfd68e24f42a6f0cba92f01585139a6b54cf/src/wdecode.lisp)
  at revision `a2fdcfd`.
- Licensed Genera 8.5 source inspected locally, identified here by artifact-relative
  filename without linking or quoting it:
  - `sys.sct/compiler/compile-file.lisp.~124~` and
    `sys.sct/compiler/compile.lisp.~31~` for interpreted definitions, forms,
    correspondences, and source locators;
  - `sys.sct/compiler/optimize.lisp.~312~` and
    `sys.sct/compiler/phase-3.lisp.~153~` for irreversible optimization steps;
  - `sys.sct/i-compiler/i-back-end.lisp.~371~` and
    `sys.sct/i-compiler/disassemble.lisp.~60~` for suffix metadata and symbolic
    disassembly;
  - `sys.sct/gc/debug-info.lisp.~33~` for debug-information compression;
  - `sys.sct/sys/objects.lisp.~9~` and `sys.sct/sys/fspec.lisp.~328~` for object
    enumeration and function-to-source registries;
  - `sys.sct/io1/lfont-defs.lisp.~2~`, `sys.sct/io1/bfd.lisp.~135~`,
    `sys.sct/io1/bfd-misc.lisp.~1521~`, and `sys.sct/io1/pxl.lisp.~1520~` for
    resident font layout and BFD/BDF conversion;
  - `sys.sct/hardcopy/postscript.lisp.~1681~` for built-in, bitmap-downloadable,
    and outline-downloadable hardcopy font handling.

Last verified: 2026-07-16.
