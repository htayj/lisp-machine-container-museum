---
type: Historical Article
title: From EINE to ZWEI and Zmacs
description: An evidence-bounded guide to the MIT and Symbolics Lisp-machine editor lineage, its architecture, and the editors represented in this museum.
tags: [lisp-machine, eine, zwei, zmacs, editor, history]
timestamp: 2026-07-19T12:23:53-04:00
---

# From EINE to ZWEI and Zmacs

EINE, ZWEI, and Zmacs are related but are not three interchangeable names for
one editor. EINE was an early Lisp Machine display editor. ZWEI was the
successor produced by converting EINE and became both an editing substrate and
a family of editor top levels. Zmacs was the multi-buffer, file- and
program-oriented editor built
on ZWEI. That distinction is explicit in the code and in later Symbolics
documentation, and is also visible when the preserved systems are operated.

This article gives the lineage and comparison. The detailed implementation,
features, modes, and release-bounded key inventories are in:

- [EINE, the first Lisp Machine editor](mit-cadr/eine.md) and its
  [complete 1977 key and command inventory](mit-cadr/eine-keybindings.md);
- [ZWEI and Zmacs on the MIT CADR and LM-3](mit-cadr/zwei-and-zmacs.md) and
  their [System 46 and System 303 bindings](mit-cadr/zwei-zmacs-keybindings.md);
- [Zmacs in Symbolics Genera](genera/zmacs.md) and the
  [Genera 8.5 binding inventory](genera/zmacs-keybindings.md), with a separate
  [named-command audit](genera/zmacs-named-commands.md) of the 277 constructor
  candidates; and
- [EINE, ZWEI, and Zmacs editor-family reimplementation
  specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md)
  defines the release profiles, complete effective input-tree boundary, semantic
  operations, lifecycle/failure rules, visuals, and conformance tests.

## Names and scope

| Name | What the inspected evidence means by it | Museum release boundary |
| --- | --- | --- |
| EINE | A complete display editor with its own buffer, redisplay, command, file-section, window, and mouse machinery. | Late-1977 source preserved by MIT DDC; no EINE load band is currently runnable in the harness. |
| ZWEI | The editing data structures, command loop, redisplay, primitives, modes, self-documentation, and reusable editor embodiments that replaced EINE. | MIT System 46 source/help; LM-3 System 303 source and runtime; licensed Genera 8.5 source/help/runtime. |
| Zmacs | The ZWEI-based top-level editor that adds persistent named buffers, file visitation, source navigation, development commands, and editor-specific window behavior. | System 46 generated help, System 303 source/runtime, Genera 8.5 source/help/runtime. |
| ZTOP and ZDT | ZWEI editor-stream or top-level embodiments used for Lisp interaction and debugging. They share the editing engine; they are not separate editor lineages. | System 303 source. |
| Dired, Zmail/Mail, Converse, and similar tools | Applications or special modes built on ZWEI editing windows and command tables. Their use of ZWEI does not make them versions of Zmacs. | System 46/System 303 source and Genera documentation. |
| Input Editor | The listener and prompt input-editing facility. Genera documentation explicitly distinguishes it from ZWEI. | Genera 8 documentation. |

The recursive acronyms are established by contemporary source: EINE is “EINE Is
Not EMACS”; ZWEI is “ZWEI Was EINE Initially.” The archive's 1975–1981 span is
not EINE's start date. Editor antecedent code survives from February 1977, while
the earliest direct `EINE` name found in this audit is an August 1977 mode-line
value. In January 1979 Weinreb described the group as converting EINE into the
new ZWEI version. His thesis says much of the conversion was mechanical because
the design philosophies were close, so “successor produced through conversion”
is better supported than an unqualified “rewrite.”

Zmacs was already being distinguished from generic ZWEI responsibilities in
February–March 1979 bug mail. By March 1980 Weinreb described the effective
lookup chain as mode table, Zmacs table, then ZWEI table—the same layering made
explicit in the later code.

No primary expansion for “Zmacs” was found; none is invented here. Weinreb is a
principal documented designer and the thesis author, but his acknowledgements
credit Mike McMahon, Richard Stallman, and the broader Lisp Machine group with
parts of EINE and ZWEI. Original Zmacs authorship remains an open attribution
question.

## What changed

### EINE: an editor organized around Lisp definitions

EINE already had live redisplay, multiple buffers and windows, a minibuffer,
mark and region operations, kill history, self-documentation, keyboard and mouse
dispatch, font-changing commands, and direct evaluation and compilation. Its
most distinctive file workflow was *section-style editing*: a file could be
scanned into named definition ranges, and individual functions could occupy
separate editor buffers. `BEGF`, `ENDF`, `HEAD`, and `TAIL` gave the scanner
hints about definitions that did not fit a simple `DEFUN` heuristic.

This was more than a presentation convention. The code recorded a file
identifier, section ranges, a modification tick for each loaded section, and a
defining-file association. It could therefore notice that somebody else had
changed a file and decide which resident definitions needed to be written back.

### ZWEI: a reusable editing system

The System 303 system declaration lists ZWEI as a large subsystem: structures,
screen interface, redisplay, movement, indentation, insertion, history, fonts,
keyboard macros, search, files, modes, mouse operations, streams, Zmacs, Dired,
and more are separate modules. A command table is not a flat key dictionary.
The implementation supports parent-table indirection, control-key indirection,
aliases, prefix tables, menu commands, and local tables installed by modes.
Self-documentation asks these live structures what a key means.

That organization is why “ZWEI” can mean the editor technology used by several
programs without identifying the Zmacs application. Genera's own editing manual
uses this narrower architectural meaning.

### Zmacs: the integrated development editor

Zmacs composes the general ZWEI tables with a file-and-buffer layer. In System
303, its initialization creates a Zmacs `Control-X` table whose parent is the
standard ZWEI `Control-X` table, and a Zmacs top-level table whose parent is the
standard table. It adds file visitation and saving, buffer selection and
killing, multiple-window layouts, Dired and mail entry points, tag tables,
definition and caller navigation, compiler-warning navigation, patching,
source comparison, and changed-definition operations.

Genera retains that composition and adds hardware editing keys, character
styles, presentations, richer mouse menus, modernized file/buffer commands, and
undo/redo integration. A fresh Genera 8.5 runtime session confirmed that
`Select E` enters Zmacs in Fundamental mode, List Buffers produces a nonmodal
typeout report, and generic bottom-line documentation and a generic Operation
menu appear while that report is displayed. Source establishes presentation-wrapped
report rows and active-table Help; the captures do not establish an exact row hit
or buffer-specific runtime operation.

## Shared interaction model

The family inherits the Emacs division between printable insertion and commands
formed with Control and Meta. Lisp-aware structural commands add the
Control-Meta layer: movement by s-expression and list, definition boundaries,
indentation, evaluation, and compilation. `Control-X` is a prefix for files,
buffers, windows, registers, and keyboard macros; `Meta-X` reads a named
command. A numeric prefix repeats or parameterizes a command.

The similarity should not be mistaken for identity with any particular GNU
Emacs release. Lisp Machine keyboards have named Help, Abort, Clear, Complete,
End, and later Cut/Copy/Paste/Undo keys, plus Shift, Control, Meta, Super, and
Hyper combinations. Mouse clicks enter the same semantic command machinery.
Modes change bindings through command-table composition, so the answer to
“what does this key do?” depends on the active editor, major mode, minor modes,
and sometimes the object under the pointer.

## Source and runtime findings beyond the manuals

The following findings came from implementation or direct use, not simply from
manual feature lists:

- EINE's source deliberately leaves the Control-period slot untouched “for the
  user.” Its command installer is therefore part of the initial keymap design,
  not just a later customization story.
- EINE's initial mouse table binds fast scrolling and paragraph marking, but the
  corresponding late-1977 functions only beep and return. A binding proves that
  a gesture was reserved; it does not prove that the advertised operation was
  implemented.
- EINE divides the pointer surface into text, line, and paragraph regions and
  uses different arrow glyphs and command meanings in those regions. This
  implementation detail is absent from the short user manual.
- ZWEI command lookup follows aliases and parent tables. Major and minor modes
  install local tables in the editor's dynamic environment. A source grep of
  only the standard table therefore cannot describe an effective keymap.
- ZWEI self-documentation reads the active command tables. The generated System
  46 command listing and the live Genera help behavior are products of the same
  architectural choice.
- In the inspected Genera-on-X11 environment, host `F12` reached the Genera Help
  key while host `F11` did not. This is a property of the current harness/X key
  translation, not a claim about a Symbolics keyboard.
- In live Genera Zmacs, pointer movement while List Buffers was visible left
  generic mouse documentation at the bottom, and a right-button generic Operation
  menu was observed. The source establishes typed report rows, but the captures do
  not prove row recognition, buffer-specific documentation, or row-owned menu
  dispatch.

## Evidence method and limits

“Complete” in the companion binding pages means complete for the named initial
command tables and modes in the pinned source revision. It does not mean every
key a user, site initialization file, patch, application, or dynamically loaded
package could install. Ranges such as printable self-insertion and all modifier
forms of digits are stated as ranges rather than expanded into hundreds of
near-identical rows. Named-command catalogs are separated from key bindings:
an editor can expose a command through `Meta-X` without giving it a direct key.

The research used four evidence layers:

1. pinned source to establish implementation, default command tables, and mode
   composition;
2. contemporary manuals and papers to establish intended operation and
   terminology;
3. extracted in-system help to record the commands exposed by a built release;
4. isolated Xvfb sessions to verify visible behavior and capture reproducible
   evidence.

EINE currently has no compatible runnable world or load band in this museum, so
its behavioral claims are restricted to source and contemporary documentation.
System 303 and Genera 8.5 observations apply only to the exact preserved artifacts
identified in their system pages.

Ten curated runtime captures are now part of the tracked museum bundle after the
image- and use-specific
[screenshot publication rights review](screenshot-publication-rights-review.md).
The four [System 303 captures](assets/mit-cadr-screenshots/index.md) show entry into
a fresh Zmacs Lisp buffer, the live ZWEI Help dispatcher, and the visible mode-line
changes from Lisp to Text mode and back. The six
[Genera 8.5 captures](assets/genera-screenshots/index.md) show the editor menu, the
Help dispatcher reached through this harness's host-key mapping, a two-window
layout, the nonmodal List Buffers report, generic mouse documentation, and a
generic Operation menu observed while that report was displayed. Those last two
captures do not prove a typed row hit. The source-distinct Edit Buffers application
and an exact List Buffers presentation-hit probe still require reviewed runtime
captures.

Each capture appears beside the system-level analysis it supports, and each asset
catalog records its raw-source mapping, hashes, action prefix, runtime identity, and
shutdown result. The conclusion is limited to those selected documentary uses under
U.S. fair use; it is not blanket permission for the raw sessions or every screen a
system could display. All raw captures and sidecars remain ignored, and the curated
PNG files are excluded from any repository-wide project license.

## Sources

- Richard M. Stallman, [EMACS: The Extensible, Customizable Display Editor](https://www.gnu.org/software/emacs/emacs-paper.html),
  including the EINE and ZWEI history; verified 2026-07-18.
- Daniel L. Weinreb, [A Real-Time Display-oriented Editor for the LISP Machine](https://tumbleweed.nu/r/lm-3/uv/paper.html),
  1977 progress report and editor design; verified 2026-07-18.
- Computer History Museum Software Preservation Group,
  [The Early History of Emacs](https://softwarepreservation.computerhistory.org/emacs/),
  source and document catalog; verified 2026-07-18.
- MIT Department of Distinctive Collections,
  [EINE source code and files, 1975–1981](https://github.com/MITDDC/eine-1975-1981/tree/b12f5b7c9a8817886ed85c72fa48bccaf5296be5),
  revision `b12f5b7`; verified 2026-07-18.
- MIT DDC, [August 1977 `EINE` mode-line evidence](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/9004365/dlw/edstkg.1#L6-L9)
  and [January 1979 EINE-to-ZWEI conversion account](https://github.com/MITDDC/eine-1975-1981/blob/b12f5b7c9a8817886ed85c72fa48bccaf5296be5/eine/701419/arc.thesis/th.64#L20-L27);
  verified 2026-07-18.
- MIT CADR System 46, [ZWEI command-table source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comtab.115),
  revision `8e978d7`; verified 2026-07-18.
- MIT CADR System 46, [March 1980 mode/Zmacs/ZWEI lookup discussion](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/bugs.old#L2660-L2669);
  verified 2026-07-18.
- LM-3 System 303, [ZWEI system declaration](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- Symbolics, [Editing and Mail, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  especially the Zmacs overview and command chapters; verified 2026-07-18.
