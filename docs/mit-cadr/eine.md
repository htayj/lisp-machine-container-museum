---
type: Artifact Analysis
title: EINE, the first Lisp Machine editor
description: Source-grounded architecture and feature study of the late-1977 EINE display editor, including its definition-oriented file model and incomplete mouse gestures.
tags: [mit-cadr, eine, editor, source-code, preservation]
timestamp: 2026-07-19T10:30:14-04:00
---

# EINE, the first Lisp Machine editor

EINE was already a substantial, Lisp-integrated graphical editor: it had live
redisplay, named buffers, multiple views, a minibuffer, regions, histories,
keyboard and mouse command dispatch, font changes, and evaluation and
compilation. Its most historically revealing feature is its ability to treat
individual Lisp definitions as separately resident buffers while preserving
their relationship to a larger source file.

This page studies a coherent late-1977 source set, not an unspecified ideal
version of EINE. The [binding companion](eine-keybindings.md) enumerates every
initial keyboard and mouse cell, every named extended command, the `Control-X`
and Help trees, and all source-visible EDT and recursive-minibuffer shadows in
that set.

## Inspected source set

The public source is preserved by the MIT Department of Distinctive Collections
from ITS backup tapes. The archive contains multiple versions and branches, not
a single release checkout. This study follows the 19-module recipe in
`eine/9004365/dlw/eine.8`, resolving each named module to the latest
archive-dated source in the adjacent `dlw2` directory. This matters for `EDFN`:
the selected `edfn.46` is archive-later than numerically larger `edfn.113`.
The recipe is 1,129 bytes with SHA-256
`1ae9bed8b613e4bf1997b8a232e66de20c525f399c1cd15964c75f56282f4976`.
The resulting 276,909-byte corpus has aggregate manifest SHA-256
`7aefec316b32dac5ec42db1721655c010a14c394ecb2c9b7f03b42a7261ed8f5`.
Each lexical-path-ordered record is the UTF-8 repository-relative pathname,
one NUL byte, and the 32-byte binary file SHA-256; records are concatenated
without a terminator and hashed again.
The key findings rely principally on:

| File | Role | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `etable.34` | initial keyboard, prefix, extended-command, syntax, and mouse tables | 23,814 | `90bbf97c2c4fa932549f52b50c51705a111dac6e4d22a92b1c0a7b74793cc06a` |
| `ecmd.50` | command loop, lookup, installation, and dispatch | 16,531 | `3f552b88c9064f5890938e4ebc0cbf6e662e7b0fe46205bba66a3abb62a5fc10` |
| `edefs.50` | editor variables and data definitions | 11,307 | `04e034a0f25c8a78e0b2ea270be8d1864d0fef679cacc70385fd38e7e9b635a3` |
| `ebasic.64` | initialization, editor entry, buffers, and reset behavior | 14,423 | `67495ebeeb5f66d6e1172edf5b66008e306be0c7ceb2e7f0854613a9e0312feb` |
| `edm.122` | pointer regions and mouse commands | 21,803 | `1c0c908101974bfd1f0b48619a9a30f8a41ab461db68ada964c20f177613f27b` |
| `edfn.46` | definition- and file-oriented operations | 18,106 | `7492479912fd11fdc030768b39360be8449a88b1e7fd57d9a91f11d4ed1250fb` |

The source repository is pinned at revision
[`b12f5b7`](https://github.com/MITDDC/eine-1975-1981/tree/b12f5b7c9a8817886ed85c72fa48bccaf5296be5).
Its provenance record identifies Software Heritage directory
[`swh:1:dir:ebd75608d2ac37affde679d124999044214ea701`](https://archive.softwareheritage.org/swh:1:dir:ebd75608d2ac37affde679d124999044214ea701).
The archive states that, to the extent MIT holds rights in the material, it is
released under GPL 2.0.

Because ITS version numbers and tape dates do not amount to a formal release
manifest, “late-1977 EINE” below means this exact recipe-derived source
selection. In particular, the recipe names `EDFN`, so the similarly situated
`edfn2.14` is not substituted. The
contemporary EINE manual in the System 46 source distribution is supporting
evidence, not proof that every paragraph describes exactly these files.

## Screen and editing model

An EINE buffer is a named `ART-Q` array whose elements are line objects. A
window is a rectangular view of a buffer; two windows can show the same buffer,
and redisplay reflects a change in both. The normal screen has a large editing
window, a status line, and a three-line area used either for echoes or as a
small editable minibuffer.

Point is the insertion and command position. Mark can be on or off. When on,
EINE underlines the region between point and mark; most text-changing commands
turn it off while movement and redisplay preserve it. That behavior is a safety
mechanism as well as feedback: region commands refuse to run when no active
region is displayed.

The command loop reads from an editor stream, looks up a function in a
four-row dispatch table, executes it, updates command history and mark state,
and asks redisplay for only the necessary degree of repair. The rows represent
unmodified, Control, Meta, and Control-Meta input. `Control-X` dispatches through
a second table with the same four modifier rows. `Meta-X` completes over a
named-command association list. Recursive string and Lisp minibuffers temporarily
shadow activation, cancel, and exit cells in that same table and unwind those
changes on return; they are not accurately modeled as an entirely separate
permanent keymap.

## Feature inventory

### Basic editing and movement

- insertion, quoted insertion, forward and backward deletion, line killing,
  horizontal-space deletion, joining and splitting lines;
- character, real-line, word, s-expression, list, defun, buffer, screen, and
  screen-edge movement; the initial table also names sentence and paragraph
  commands whose implementations are absent from the exact build corpus;
- point/mark exchange, active regions, word/sexp/line/paragraph/defun marking,
  and saved region text;
- kill and yank history with append-next-kill and yank-pop;
- case conversion of words and regions, word capitalization, indentation,
  code formatting, fill-related commands, and tab stops;
- numeric arguments, a negative argument, and repeated commands;
- incremental and single-character search;
- redisplay, recentering, and position/count queries.

### Buffers, windows, and temporary editing

- create, rename, select, list, kill, and revert buffers;
- one- and two-window layouts, other-window selection, arbitrary window
  creation, movement, resizing, burying, and deletion;
- ordinary buffers and tab buffers;
- a minibuffer that uses editor commands rather than line-oriented rubout
  processing;
- a temporary-area mode for reclaiming short-lived editor storage.

### Lisp development

- evaluate or compile a buffer or active region;
- evaluate or compile and leave the editor;
- edit a definition, show an argument list, format a definition or expression,
  and load a whole source file;
- `ED`, `EDVAL`, and `EDPROP` entry points that construct or select buffers for
  functions, values, and properties;
- tag-table reading and defining-file associations;
- optional visual error effects named `BARFOLA` and `ZOWIE` in the source.

### The EDT editor top level

`edt.84` is a specialized “editor top level” built from EINE rather than a
separate editor lineage. It gives an `Editor Top Level` buffer to a stack group
and installs that buffer as `STANDARD-INPUT`, `STANDARD-OUTPUT`, and
`ERROR-OUTPUT`. Submitted input and printed output therefore share an editable
interaction history. Six dynamic table changes add activation, clear, exit, and
insert-previous-interaction behavior or suppress EINE's ordinary exit commands.
The exact overlay is listed in the [binding reference](eine-keybindings.md#edt-editor-top-level-overlay).

### Text appearance

The command set can change the font of a character, word, or region, choose a
default font, redefine a font, and choose the cursor blinker's font. These are
embedded raster-font changes, not scalable vector styles. EINE's storage and
redisplay code treat the font choice as part of character-level display state.

### Files and definition sections

EINE supports two file models:

- **file style** puts an entire file in one buffer, like a conventional Emacs
  visit;
- **section style** scans the file into definition ranges and loads selected
  sections into separate buffers.

In section style, the editor records a sorted section list, the original
character range, a defining-file property, and a modification tick. `UPDATE
FILE` writes the modified definitions associated with a file; `FORGET FILE`
discards the editor's associations; `LIST FUNCTIONS` reports what was read and
what needs updating. `LOAD WHOLE FILE` populates all sections but the manual
warns that this is the slow path the section design is intended to avoid.

The scanner normally recognizes top-level `DEFUN`, `MACRO`, `DEFMACRO`, and
`DEFSTRUCT` forms. No-op `BEGF` and `ENDF` forms can delimit a logical
definition explicitly. Special `HEAD` and `TAIL` sections hold file-wide
prologue and initialization material. These are editor/source conventions,
not Lisp evaluation constructs.

The internal documentation also records an `ED-FILE-ID` containing version,
date, time, and size. If the current file no longer matches that identity, EINE
can recognize that an external writer changed it. This conflict check is a
source-confirmed feature that the short user-facing overview does not develop.

## Mouse and tablet operation

The source supports either a mouse or tablet and divides the editing surface
into three vertical semantic regions:

- **text**, where horizontal position identifies a character;
- **line**, where the gesture addresses a whole displayed line;
- **paragraph**, where it addresses larger syntactic or textual units.

The pointer changes arrow glyph by region. A three-dimensional dispatch table
selects a command from region, click count (one, two, or three-or-more), and
button. Its implemented operations include moving point, marking and dragging a
region, killing, saving, yanking, showing a line at the top or bottom of a
window, and marking list, s-expression, line, line-list, or defun units.

Two table entries are important counterexamples to a naive keymap audit:
`EDM-SCROLL-FAST` and `EDM-MARK-PARAGRAPH` are bound, but in `edm.122` each
function only rings the display bell and reports no redisplay work. The gestures
were allocated without the named behavior being implemented in this source set.
The [mouse binding table](eine-keybindings.md#mouse-and-tablet-bindings) labels
them as stubs.

## Customization and self-description

EINE can install a command on a key and exposes an extended `INSTALL COMMAND`
operation. The source's initial-table comment deliberately reserves
Control-period for the user. Lowercase Control/Meta key codes are aliases of
their uppercase forms, so customization operates on the logical command
character rather than a printed ASCII spelling alone.

Self-documentation is itself a command. Control-slash, Control-question-mark,
Meta-slash, and Meta-question-mark reach it in the initial map. Prefix lookup is
represented by a generated function, so asking about `Control-X` can continue
into the prefix table instead of merely describing a single leaf command.

An exhaustive static audit of the 19 files named by the archived EINE build
manifest found 413 unique functions and 170 command-like definitions. The main
dispatch has 576 slots: 263 direct entries, 78 automatic aliases, one
`Control-X` prefix, and 234 unbound slots. The prefix table has 19 direct, 104
alias, and 453 unbound slots. All 53 named extended commands and all 15 distinct
mouse targets are defined in the corpus.

Five functions referenced by the main table are not present in those 19 files:
backward/forward sentence, backward/forward paragraph, and format code. The
bindings are real table entries, but their effects are not claimed as available
without a separately loaded definition. A sixth apparently missing prefix
symbol is generated at initialization with `FSET` and is therefore resolved.

## What is and is not runtime-verified

No EINE load band compatible with the current CADR harness has yet been located.
The museum's runnable System 303 band contains ZWEI/Zmacs, not this earlier
EINE source. The feature and key claims on this page are therefore grounded in
the pinned implementation and contemporary documentation, but are not presented
as observations of a running 1977 editor.

TODO: locate or construct a redistributable EINE-capable load band, reproduce
the screen layout, section-buffer workflow, and mouse-region behavior through
the Xvfb harness, and add a runtime screenshot.

## Sources

- MIT DDC, [`etable.34`](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw2/etable.34),
  initial key, command, syntax, and pointer tables; verified 2026-07-18.
- MIT DDC, [`ecmd.50`](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw2/ecmd.50),
  command dispatch and installation; verified 2026-07-18.
- MIT DDC, [`edm.122`](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw2/edm.122),
  mouse implementation; verified 2026-07-18.
- MIT DDC, [`eine.8`](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw/eine.8)
  and [`edfn.46`](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw2/edfn.46),
  exact build recipe and selected definition/file module; verified 2026-07-18.
- MIT CADR System 46, [EINE user manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/eine.8)
  and [internal data-structure notes](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/eineid.14),
  revision `8e978d7`; verified 2026-07-18.
- Daniel L. Weinreb, [A Real-Time Display-oriented Editor for the LISP Machine](https://tumbleweed.nu/r/lm-3/uv/paper.html),
  1977; verified 2026-07-18.
