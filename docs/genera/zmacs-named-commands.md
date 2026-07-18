---
type: Reference
title: Genera 8.5 Zmacs named-command audit
description: Evidence-only counts, categories, installation semantics, and reproducible audit boundary for the named commands configured by the inspected Genera source.
tags: [genera, zwei, zmacs, commands, reference, preservation]
timestamp: 2026-07-18T01:54:01-04:00
---

# Genera 8.5 Zmacs named-command audit

The inspected source supplies 277 named-command candidates: 140 to the standard
Zwei environment, 135 to the main Zmacs environment, and two later CP additions.
This is a source-constructor count, not a claim that all 277 names were present
in the running Genera 8.5 world.

This tracked page records counts, functional groupings, installation behavior,
and the audit method in original prose. The exact ordered symbol arrays and
mechanically rendered source rows remain in ignored local evidence because they
are derived from licensed source. Direct keys, prefixes, modes, and task-specific
tables are documented separately in the
[keybinding inventory](zmacs-keybindings.md).

## What the two constructors cover

The standard constructor supplies the editor-wide named operations. The source's
own group boundaries produce this count:

| Functional group | Candidates |
| --- | ---: |
| General editing, evaluation, searching, counting, sorting, and inspection | 59 |
| Command documentation | 4 |
| File operations | 14 |
| Directory operations | 4 |
| Major/minor modes and word abbreviations | 26 |
| Styles, keyboard macros, and indentation | 11 |
| Flavors inspection | 10 |
| Undo and change-history management | 3 |
| Dynamic Windows presentation inspection | 1 |
| CLOS inspection | 8 |
| **Standard total** | **140** |

The main Zmacs constructor adds operations that depend on Zmacs's persistent
buffers, files, definitions, tag tables, systems, and patch workflow:

| Functional group | Candidates |
| --- | ---: |
| Buffers and windows | 14 |
| Definitions, tag tables, and cross-file searches | 14 |
| Callers, methods, and Flavor maintenance | 21 |
| Editor attributes, compilation, commands, and code case | 10 |
| Directories, files, mail, and find variants | 11 |
| Warnings, tag-table selection, and replacement | 11 |
| Buffer attributes and buffer operations | 7 |
| Changed-definition workflows | 12 |
| Source comparison and merge | 8 |
| Patch construction and maintenance | 23 |
| Remaining comparison, documentation, macro-sort, and tab-stop tools | 4 |
| **Main Zmacs total** | **135** |

After that constructor, the source adds two explicit display-name/command pairs
for CP execution and editing. They do not pass through the same symbol-property
lookup as the preceding arrays.

The category distribution exposes an aspect that a short editing tutorial can
understate: Zmacs is also a source-engineering environment. Definition
navigation, callers, compiler warnings, changed definitions, source comparison,
system tag tables, and patch construction occupy a substantial part of its
named-command surface.

## Installation semantics

`MAKE-COMMAND-ALIST` preserves candidate order but does not blindly install every
symbol. For each candidate it looks up the symbol's `COMMAND-NAME` property. If
the property is absent at load time, the constructor warns and omits that entry.
The 140 and 135 counts therefore describe the pinned source inputs to the
constructor, not a pristine-world runtime census.

The audit found no duplicate symbol within either constructor and no symbol
shared by the two arrays. That makes the arithmetic unambiguous at the source
boundary; it does not remove later effects from patches, optional systems, or
site and user initialization.

## Evidence and reproducibility boundary

| Artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `sys.sct/zwei/comtab.lisp.~589~` | 100,220 | `5101f5a25a7222d6d0f8f48401522fa418576eb27d145f659513eb80660ca2b1` | standard constructor and installation implementation |
| `sys.sct/zwei/zmacs.lisp.~1058~` | 31,456 | `082959472626b04d74631ada24bb8ad164bc44ef19f292343f905fbf10bf1d2f` | main Zmacs constructor and explicit CP additions |
| local `configured-bindings.json` | 43,174 | `4e7454e68ee4a007e44829d6ebff73e942e627ac43cc8fad8b55b7fe9baa2b5e` | ignored structured extraction evidence |
| local `configured-bindings.md` | 13,655 | `d711273780f3144d994b620313513c676be4626c0350d5a76c6c351c6d3df33e` | ignored rendering of the four principal direct tables |

The inert audit decoded the two source files without evaluating Lisp, located
the two constructor spans and the later explicit additions, removed comments,
collected command-symbol tokens in source order, and asserted the expected
counts and uniqueness properties. The structured output also records source
line locations for the four principal direct command tables. It does not cover
the subordinate, mode, and task tables audited separately for the keybinding
page.

To repeat the audit, use a legally obtained local source tree with the hashes
above and write all mechanically derived rows and symbol arrays beneath an
ignored `build/genera-computer-use/` session. A publishable result should retain
only the counts, checksums, method, and original analysis unless redistribution
permission is established separately.

## What remains to verify live

The Xvfb session confirmed entry to Zmacs, the Help dispatcher, and an extended
command prompt, but it did not dump the pristine named-command registry. A
future live census should compare the installed names with these constructor
counts while recording inheritance, loaded optional systems, patch state, and
site initialization. Its raw dump must remain ignored licensed-derived evidence.

## Sources

- Symbolics, [Editing and Mail, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  editor overview and documented command interface; verified 2026-07-18.
- The two locally inspected Genera 8.5 source artifacts identified by checksum
  above; inspected 2026-07-18. No proprietary implementation or exact source
  inventory is reproduced here.
