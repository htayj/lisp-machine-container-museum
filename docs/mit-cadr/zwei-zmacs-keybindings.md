---
type: Reference
title: MIT ZWEI and Zmacs keybindings
description: Release-bounded effective-tree inventories of public System 46 ZWEI evidence and the fixed, intercepted, Help, pointer-hook, mode, and context layers in the pinned LM-3 System 303 ZWEI subsystem.
tags: [mit-cadr, lm-3, zwei, zmacs, keybindings, reference]
timestamp: 2026-07-19T12:26:08-04:00
---

# MIT ZWEI and Zmacs keybindings

There is no timeless Zmacs keymap. This reference separates the preserved
System 46 evidence from the maintained System 303 restoration and records the
table layer in which each binding originates. The companion
[architecture and feature article](zwei-and-zmacs.md) explains why mode,
application, prefix, and parent tables must be composed to get an effective
binding.

## Notation and completeness

- `C-`, `M-`, `S-`, and `H-` mean Control, Meta, Super, and Hyper. `Sh-` means
  Shift where case alone would be ambiguous.
- `Space`, `Return`, `Line`, `Form`, `Rubout`, `Help`, `Abort`, `Clear`, and
  `Break` are Lisp Machine characters.
- Multiple keys in one cell are source-defined aliases for the same command.
- A range such as `C-0` … `C-9` represents the source's range form and is not a
  sampling shortcut.
- “Complete fixed source tree” means that every non-comment fixed entry or
  generated range in the named System 303 subsystem appears below, including
  subordinate input/search, stream, and application tables. This page also
  specifies the source-visible TV intercepts, pointer hooks, Help subtrees and
  mode-composition algorithm. Dynamically loaded packages, patches, user
  initialization, and runtime mutation remain separately identified oracle
  layers; they are not silently included in the fixed-tree claim.

Beyond the standard, prefix, Zmacs, completing-reader, and general-mode tables,
the fixed System 303 subordinate and special tables enumerated below contain
199 configured local slots: 164 direct commands, prefixes, or sentinels; 32
explicit lowercase aliases; and 3 explicit undefined leaves. The total is 19
minibuffer/pathname, 26 search, 8 editor-stream, 1 macro-mover, 135
application/task, and 10 Control-R/Recursive Edit/Standalone cells. These are
constructor counts, not an effective-tree denominator. The exact generated
alias algorithms and parent lookup below make every inherited or generated
leaf derivable; named commands without keys remain a separate namespace.

### Generated aliases and finite domains

Both releases use 160 keyboard codes (octal `000` through `237`) by 16 modifier
states. A newly created System 46 table preloads every lowercase ASCII letter,
under every one of the 16 modifier states, with an alias to the corresponding
uppercase code at the same modifier state: 26 × 16 generated cells before
explicit specifications overwrite them.

A newly named System 303 table instead installs two exact compatibility
families, without overwriting a non-`NIL` cell:

1. each unmodified lowercase `a` through `z` aliases unmodified uppercase `A`
   through `Z` (26 candidates); and
2. for uppercase `A` through `Z`, each of the seven Hyper-containing modifier
   states `H-C`, `H-M`, `H-S`, `H-C-M`, `H-C-S`, `H-M-S`, and `H-C-M-S`
   aliases the corresponding lowercase letter with Hyper removed and all other
   modifiers retained (182 candidates).

`SET-COMTAB-CONTROL-INDIRECTION`, used by the Standard `Control-X` tables and
the search operator table where stated, then fills only still-`NIL` cells over
that same 160 × 16 domain:

1. ordinary Return, Linefeed, Tab, Backspace, Form, and Vertical Tab alias the
   corresponding Control code obtained by subtracting octal `100`;
2. every Meta-only and Control-Meta cell aliases the same code with Meta
   removed; and
3. every Control-only cell whose code is outside ASCII `@` through `_` aliases
   the same unmodified code.

An alias stores a `(modifier-state, code)` destination. Lookup restarts that
destination at the original top comtab, then applies explicit `:UNDEFINED`,
parent fallthrough, and unbound behavior described below. Thus the algorithms,
ordered direct tables, and parent chains are an exact finite mapping; aliases
are not counted again as handwritten rows.

## System 46 boundary and canonical built listing

The pinned System 46 tree can establish the complete preserved standard ZWEI
and standard `Control-X` tables in `comtab.115`. It cannot establish a complete
Zmacs overlay: `nzwei.tags` names `DSK: NZWEI; ZMACS >` and its initialization
functions, but neither `zmacs.*` nor `zmacs.qfasl` is present in `src/nzwei/`.
The later System 303 file is not substituted for this missing evidence.

For the built System 46 environment, the tracked
[`_comnd.1`](../assets/mit-cadr-online-help/standalone/_comnd.1) is the exhaustive
generated named-command listing, including every direct invocation the running
self-documenter reported. The accompanying
[`emacs.comdif`](../assets/mit-cadr-online-help/standalone/emacs.comdif) and
[`nzwei.comdif`](../assets/mit-cadr-online-help/standalone/nzwei.comdif) record
the supplied compatibility and change descriptions. These artifacts are more
faithful than relabeling the System 303 tables below as System 46.

Static audit of the 25 source-present files among 31 active ZWEI modules found
345 concrete unique `DEFCOM` declarations plus 17 mode-generated entry commands,
for 362 source-defined command symbols; 11 major modes, 6 minor modes, and 450
literal expanded `SET-COMTAB` assignments. The six declared but absent
modules are `SEARCH`, `SCREEN`, `STREAM`, `SECTIO`, `ZMACS`, and `ZYMURG`; that
gap is why the count is explicitly “source-present,” not a whole-release claim.

### Complete preserved System 46 Standard table

The following grouped rows enumerate every active fixed Standard cell and range
in `comtab.115`. They are not a delta inferred from System 303.

| Binding(s) | Command(s), in binding order |
| --- | --- |
| unmodified codes `000`–`177` octal; `Backspace` | Standard insertion |
| `C-F`, `C-B`, `C-N`, `C-P` | Forward; Backward; Down Real Line; Up Real Line |
| `C-V`, `M-V`, `C-M-V` | Next Screen; Previous Screen; Scroll Other Window |
| `C-A`, `C-E`, `M-R`, `M-<`, `M->` | Beginning Of Line; End Of Line; Move To Screen Edge; Goto Beginning; Goto End |
| `C-<`, `C->`, `C-Space`/`C-@`, `M-Space`, `C-M-Space` | Mark Beginning; Mark End; Set Pop Mark; Push Pop Point Explicit; Move To Previous Point |
| `Return`, `C-O`, `C-M-O`, `M-O`, `M-^`/`C-M-^` | Insert CRs; Make Room; Split Line; This Indentation; Delete Indentation |
| `C-D`, `Rubout`, `C-Rubout`, `C-K`, `Clear` | Delete Forward; Rubout; Tab Hacking Rubout; Kill Line; Clear |
| `Break` | Break |
| `M-W`, `C-W`, `C-M-W`, `C-Y`, `M-Y` | Save Region; Kill Region; Append Next Kill; Yank; Yank Pop |
| `C-L`, `Form`/`C-M-!` | Recenter Window; Complete Redisplay |
| `C-U` | Quadruple Numeric Arg |
| `C--`, `M--`, `C-M--` | Negate Numeric Arg |
| `C-0`…`C-9`, `M-0`…`M-9`, `C-M-0`…`C-M-9` | Numbers |
| `C-T`, `M-T`, `C-M-T` | Exchange Characters; Exchange Words; Exchange Sexps |
| `M-F`, `M-B`, `M-K`, `M-D`, `M-Rubout`, `M-@` | Forward Word; Backward Word; Kill Sentence; Kill Word; Backward Kill Word; Mark Word |
| `C-M-F`, `C-M-N`, `C-M-B`, `C-M-P` | Forward Sexp; Forward List; Backward Sexp; Backward List |
| `C-M-K`, `C-M-Rubout`, `C-M-@` | Kill Sexp; Backward Kill Sexp; Mark Sexp |
| `C-M-)`, `C-M-(`/`C-M-U` | Forward Up List; Backward Up List |
| `C-M-[`/`C-M-A`, `C-M-]`/`C-M-E`, `C-M-D` | Beginning Of Defun; End Of Defun; Down List |
| `M-)`, `M-(` | Move Over `)`; Make `()` |
| `M-]`, `M-[`, `M-H`, `M-E`, `M-A` | Forward Paragraph; Backward Paragraph; Mark Paragraph; Forward Sentence; Backward Sentence |
| `C-G` | Beep |
| `Tab`/`M-Tab`, `C-M-Tab`, `C-Tab`, `Line` | Insert Tab; Indent For Lisp; Indent Differently; Indent New Line |
| `C-M-Q` | Indent Sexp |
| `C-;`/`M-;`, `C-M-;`, `M-N`, `M-P` | Indent For Comment; Kill Comment; Down Comment Line; Up Comment Line |
| `M-Q`, `M-G` | Fill Paragraph; Fill Region |
| `M-\`, `C-M-\` | Delete Horizontal Space; Indent Region |
| `M-Return`/`M-M`/`C-M-Return`/`C-M-M` | Back To Indentation |
| `M-U`, `M-L`, `M-C` | Uppercase Word; Lowercase Word; Uppercase Initial |
| `M-Form`, `M-S`, `M-=`, `C-=` | Insert Form Feed; Center Line; Count Lines Region; Fast Where Am I |
| `C-S`, `C-R` | Incremental Search; Reverse Incremental Search |
| `M-033` raw | Evaluate Mini Buffer |
| `C-006` | Compile Defun |
| `C-022`, `M-022`, `C-M-022` | Evaluate Defun; Evaluate Defun Verbose; Evaluate Defun Hack |
| `C-?`/`M-?`, `C-M-?`/`Help` | Self Document; Documentation |
| `C-Q` | Various Quantities |
| `M-X`, `C-M-X` | Extended Command; Any Extended Command |
| `M-Line` | Indent New Comment Line |
| `C-%`, `M-%` | Replace String; Query Replace |
| `C-M-H`, `C-M-R`, `M-'` | Mark Defun; Reposition Window; Upcase Digit |
| `C-035` raw | Find Pattern |
| `C-Z`, `End` | Quit |
| `M-~` | Not Modified |
| `C-M-&`, `C-M-$` | Frob Lisp Conditional; Frob Do |
| `C-034`, `C-036`, `M-036` | Quick Arglist; Brief Documentation; Long Documentation |
| `C-J`, `M-J`, `C-M-J` | Change Font Char; Change Font Word; Change Default Font |
| `M-#`, `M-_`, `C-M-#` | Text Justifier Change Font Word; Text Justifier Underline Word; Goto Character |
| `Mouse-1-1`/`Mouse-1-2` | Mouse Mark Region; Mouse Move Region |
| `Mouse-2-1`/`Mouse-2-2` | Mouse Mark Thing; Mouse Kill Yank |
| `C-X` | enter the System 46 Standard `Control-X` child |

The source repeats `C-<` and `C->`; later identical assignments do not change
their effective commands. Commented Form recenter and `C-M-G` Format Code forms
are not bindings.

### Complete preserved System 46 Control-X and recursive contexts

| Binding(s) | Command(s), in binding order |
| --- | --- |
| `C-X C-G`, `C-X C-D`, `C-X C-N`, `C-X C-P`, `C-X C-X` | Prefix Beep; Display Directory; Set Goal Column; Mark Page; Swap Point And Mark |
| `C-X G`, `C-X X`, `C-X L` | Open Get Q Register; Put Q Register; Count Lines Page |
| `C-X Rubout`, `C-X ;`, `C-X .`, `C-X F` | Backward Kill Sentence; Set Comment Column; Set Fill Prefix; Set Fill Column |
| `C-X C-U`, `C-X C-L`, `C-X C-O`, `C-X C-I` | Uppercase Region; Lowercase Region; Delete Blank Lines; Indent Rigidly |
| `C-X =`, `C-X [`, `C-X ]`, `C-X H`, `C-X C-C` | Where Am I; Previous Page; Next Page; Mark Whole; Quit |
| `C-X C-J` | Change Font Region |
| `C-X (`, `C-X )`, `C-X E`, `C-X Q` | Start/End/Call Keyboard Macro; Keyboard Macro Query |
| `C-X 033` raw, `C-X C-T`, `C-X T` | Repeat Last Mini Buffer Command; Exchange Lines; Exchange Regions |
| `C-X #`, `C-X _`, `C-X C-M-Space` | Text Justifier Change Font Region; Text Justifier Underline Region; Move To Default Previous Point |

The System 46 prefix has no `Help` or `Abort` leaf. Control indirection supplies
the source-defined plain/controlled compatibility aliases; an unknown second key
follows ordinary undefined behavior.

| Context | Complete local cells; every other cell inherits Standard |
| --- | --- |
| Completing reader | raw `033` Complete; `Space` and `)` Self Insert And Complete; `?` List Completions; `C-Q` Quoted Insert; `Help` Document Completing Read; `C-/` Completion Apropos; `Return`/`C-Return`/`End` Complete And Exit; `C-G` Mini Buffer Beep; `Mouse-1-1` End Of Mini Buffer; `Mouse-3-1` List Completions; `C-Z`/`M-Z`/`C-M-Z` hard undefined |
| Control-R | `C-033` and `End` Exit Control-R |
| Recursive Edit | `C-033` and `End` Exit Control-R; `C-G` Recursive Edit Beep |
| Standalone | `C-033` Quit |

The public source also constructs two ordinary minibuffer tables that were
separate from the completing reader:

| Context | Complete local cells; every other cell follows the stated parent |
| --- | --- |
| Multi-line minibuffer | `Help` Document Containing Command; `C-Return` and `End` End Of Mini Buffer; `C-G` Mini Buffer Beep; `C-Z`, `M-Z`, and `C-M-Z` hard undefined; `C-M-Y` Pop Mini Buffer Ring; `Mouse-1-2` Mouse End Of Mini Buffer; parent Standard |
| Single-line minibuffer | `Return` End Of Mini Buffer; parent multi-line minibuffer |

The multi-line table has nine direct cells and the single-line child one. This
is public fixed evidence and does not depend on the missing System 46 Zmacs
module.

### Complete System 46 Help subtree

`Help` enters a staged dispatcher: `A` Apropos, `B` basic ZWEI
documentation, `C` Self Document followed by any key or prefix subtree, `D`
Describe Command, `L` What Lossage, `U` Undo, `V` Variable Apropos, `W` Where
Is, `Space` repeat the preceding request, and `?` describe the Help dispatcher.
`C-G` aborts; every other input beeps and prompts again. Self Document follows a
prefix closure recursively, and `*` at that stage enumerates every leaf of the
selected prefix.

## System 303 standard ZWEI table

### Insertion, movement, and marking

| Binding(s) | Command |
| --- | --- |
| unmodified character range `0`–`177` octal | Ordinarily Self Insert |
| `Backspace` | Ordinarily Self Insert |
| `C-F`, `C-B` | Forward; Backward |
| `C-N`, `C-P` | Down Real Line; Up Real Line |
| `C-V`, `M-V`, `C-M-V` | Next Screen; Previous Screen; Scroll Other Window |
| `C-A`, `C-E` | Beginning Of Line; End Of Line |
| `M-R`, `M-<`, `M->` | Move To Screen Edge; Goto Beginning; Goto End |
| `C-Space`, `C-@` | Set Pop Mark |
| `M-Space` | Push Pop Point Explicit |
| `C-M-Space` | Move To Previous Point |
| `C-<`, `C->` | Mark Beginning; Mark End |

### Newlines, deletion, killing, and yanking

| Binding(s) | Command |
| --- | --- |
| `Return` | Insert CRs |
| `C-O`, `C-M-O` | Make Room; Split Line |
| `M-O` | This Indentation |
| `M-^`, `C-M-^` | Delete Indentation |
| `C-D`, `Rubout`, `C-Rubout` | Delete Forward; Rubout; Tab Hacking Rubout |
| `C-K`, `Clear` | Kill Line; Clear |
| `M-W`, `C-W`, `C-M-W` | Save Region; Kill Region; Append Next Kill |
| `C-Y`, `M-Y` | Yank; Yank Pop |

### Redisplay, arguments, and transposition

| Binding(s) | Command |
| --- | --- |
| `Break` | Break into Lisp |
| `C-L` | Recenter Window |
| `Form`, `C-M-!` | Complete Redisplay |
| `C-U` | Universal Argument |
| `C--`, `M--`, `C-M--`, `S--`, `S-C--`, `S-M--`, `S-C-M--`, `H--`, `H-M--`, `H-C-M--`, `H-S--`, `H-S-C--`, `H-S-M--`, `H-S-C-M--` | Negate Numeric Arg |
| `H-C--` | **No source-installed leaf in this profile** |
| digits `0`–`9` under each source-listed Control/Meta/Super/Hyper modifier combination | Numbers |
| `C-T`, `M-T`, `C-M-T` | Exchange Characters; Exchange Words; Exchange Sexps |

The source spells `C--` twice and never spells `H-C--`. By contrast, the
digit ranges do include `H-C-0` through `H-C-9`. This asymmetry is part of the
strict source profile and MUST NOT be silently regularized. The digit rows are
stated as generated families because each source form creates a complete
ten-digit range.

### Words, lists, definitions, paragraphs, and sentences

| Binding(s) | Command |
| --- | --- |
| `M-F`, `M-B` | Forward Word; Backward Word |
| `M-K`, `M-D`, `M-Rubout`, `M-@` | Kill Sentence; Kill Word; Backward Kill Word; Mark Word |
| `C-M-F`, `C-M-B` | Forward Sexp; Backward Sexp |
| `C-M-N`, `C-M-P` | Forward List; Backward List |
| `C-M-K`, `C-M-Rubout`, `C-M-@` | Kill Sexp; Backward Kill Sexp; Mark Sexp |
| `C-M-)`, `C-M-(`, `C-M-U` | Forward Up List; Backward Up List; Backward Up List |
| `C-M-A`, `C-M-[` | Beginning Of Defun |
| `C-M-E`, `C-M-]` | End Of Defun |
| `C-M-D` | Down List |
| `C-(`, `C-)` | Find Unbalanced Parentheses; Show List Start |
| `M-(`, `M-)` | Make `()`; Move Over `)` |
| `C-M-Sh-K` | Delete `()` |
| `C-M-Sh-F`, `C-M-Sh-B` | Grow List Forward; Grow List Backward |
| `M-]`, `M-[`, `M-H` | Forward Paragraph; Backward Paragraph; Mark Paragraph |
| `M-E`, `M-A` | Forward Sentence; Backward Sentence |

### Indentation, comments, filling, case, and layout

| Binding(s) | Command |
| --- | --- |
| `C-G` | Beep |
| `Tab`, `M-Tab` | Insert Tab |
| `C-M-Tab`, `C-Tab` | Indent For Lisp; Indent Differently |
| `Line` | Indent New Line |
| `C-M-Q` | Indent Sexp |
| `C-;`, `M-;`, `C-M-;` | Indent For Comment; Indent For Comment; Kill Comment |
| `M-N`, `M-P` | Down Comment Line; Up Comment Line |
| `C-Sh-M`, `M-Sh-M` | Macro Expand Expression; Macro Expand Expression All |
| `M-Q`, `M-G` | Fill Paragraph; Fill Region |
| `C-\`, `M-\`, `C-M-\` | Just One Space; Delete Horizontal Space; Indent Region |
| `M-Return`, `M-M`, `C-M-Return`, `C-M-M` | Back To Indentation |
| `M-U`, `M-L`, `M-C` | Uppercase Word; Lowercase Word; Uppercase Initial |
| `M-Form` | Insert Form Feed |
| `M-S` | Center Line |
| `M-=`, `C-=` | Count Lines Region; Fast Where Am I |

### Search, evaluation, help, exit, and system operations

| Binding(s) | Command |
| --- | --- |
| `C-S`, `C-R` | Incremental Search; Reverse Incremental Search |
| `M-Escape` | Evaluate Mini Buffer |
| `Control-006` (octal), `C-Sh-C` | Compile Region |
| `C-Sh-E`, `M-Sh-E`, `C-M-Sh-E` | Evaluate Region; Evaluate Region Verbose; Evaluate Region Hack |
| `M-?` | Self Document |
| `C-M-?`, `Help`, `C-Help` | Documentation |
| `C-Q` | Quoted Insert |
| `M-X`, `C-M-X` | Extended Command; Any Extended Command |
| `C-Sh-X` | Various Quantities |
| `M-Line` | Indent New Comment Line |
| `C-%`, `M-%` | Replace String; Query Replace |
| `C-M-H`, `C-M-R` | Mark Defun; Reposition Window |
| `M-'` | Upcase Digit |
| `C-Sh-S` | Lisp Match Search |
| `C-Z`, `Abort` | Quit; Abort At Top Level |
| `C-M-&`, `C-M-$` | Frob Lisp Conditional; Frob Do |
| `C-Sh-A` | Quick Arglist |
| `C-Sh-D`, `M-Sh-D` | Quick Documentation; Long Documentation |
| `C-Sh-V` | Describe Variable At Point |

`C-?` and `End` appear near these entries only as commented-out forms in the
pinned source; they are not counted as bindings.

### Fonts, spelling, printing, undo, and mouse

| Binding(s) | Command |
| --- | --- |
| `C-J`, `M-J`, `C-M-J` | Change Font Char; Change Font Word; Change Default Font |
| `C-Sh-J`, `M-Sh-J` | Change Font Region; Change One Font Region |
| `M-#`, `M-_` | Text Justifier Change Font Word; Text Justifier Underline Word |
| `M-$` | Correct Word Spelling |
| `C-M-#` | Goto Character |
| `M-Sh-P` | Quick Print Buffer |
| `C-Sh-U`, `C-Sh-R` | Quick Undo; Quick Redo |
| `Mouse-1-1`, `Mouse-1-2` | Mouse Mark Region; Mouse Move Region |
| `Mouse-2-1`, `Mouse-2-2` | Mouse Mark Thing; Mouse Kill Yank |
| `C-X` | Enter Standard Control-X table; Zmacs replaces this leaf with its child table. |

## System 303 standard Control-X table

This table has Control indirection, so on a key with no explicit Control entry,
the controlled spelling can fall back to its plain spelling according to
`SET-COMTAB-CONTROL-INDIRECTION`.

| Binding | Command |
| --- | --- |
| `C-X C-G` | Prefix Beep |
| `C-X C-D` | Display Directory |
| `C-X C-N` | Set Goal Column |
| `C-X C-P` | Mark Page |
| `C-X C-X` | Swap Point And Mark |
| `C-X G`, `C-X X` | Get Register; Put Register |
| `C-X S`, `C-X J` | Save Position In Register; Jump To Register Position |
| `C-X L` | Count Lines Page |
| `C-X Rubout` | Backward Kill Sentence |
| `C-X C-;`, `C-X ;` | Comment Out Region; Set Comment Column |
| `C-X .`, `C-X F` | Set Fill Prefix; Set Fill Column |
| `C-X C-U`, `C-X C-L` | Uppercase Region; Lowercase Region |
| `C-X C-O`, `C-X C-I` | Delete Blank Lines; Indent Rigidly |
| `C-X =` | Where Am I |
| `C-X [`, `C-X ]` | Previous Page; Next Page |
| `C-X H` | Mark Whole |
| `C-X C-C` | Quit |
| `C-X C-J` | Change Font Region |
| `C-X (`, `C-X )` | Start Keyboard Macro; End Keyboard Macro |
| `C-X E`, `C-X Q` | Call Last Keyboard Macro; Keyboard Macro Query |
| `C-X Escape` | Repeat Mini Buffer Command |
| `C-X C-T`, `C-X T` | Exchange Lines; Exchange Regions |
| `C-X U` | Unexpand Last Word |
| `C-X #`, `C-X _` | Text Justifier Change Font Region; Text Justifier Underline Region |
| `C-X C-M-Space` | Move To Default Previous Point |
| `C-X Help` | Document Containing Prefix Command |
| `C-X Abort` | Prefix Abort |

Word Abbrev mode additionally installs `C-X C-A` Add Mode Word Abbrev,
`C-X M-'` Word Abbrev Prefix Mark, and `C-X +` Add Global Word Abbrev, while
reasserting `C-X U` Unexpand Last Word. The source mutates the standard prefix,
which is a non-obvious global consequence of enabling this minor mode.

## System 303 Zmacs overlays

The top-level Zmacs table inherits the standard table. These entries replace or
add to it:

| Binding | Zmacs command |
| --- | --- |
| `C-M-V` | Scroll Other Window |
| `C-Sh-P` | Go To Next Possibility |
| `C-Sh-W`, `M-Sh-W` | Edit Next Warning; Edit Previous Warning |
| `M-~` | Not Modified |
| `M-.` | Edit Definition |
| `C-M-.` | Edit Zmacs Command |
| `C-M-L` | Select Previous Buffer |
| `C-X` | Enter the Zmacs Control-X child table |
| `Mouse-3-1` | Open the Zmacs editor menu |

The editor menu is constructed from commands for argument lists, definition and
caller navigation, sections and buffers, buffer review, screen splitting,
compile/indent/uppercase/lowercase region operations, font changes, and mouse
indentation.

The Zmacs `Control-X` table inherits the standard prefix and supplies these
editor-specific leaves:

| Binding | Zmacs command |
| --- | --- |
| `C-X C-F`, `C-X C-V` | Find File; Find Alternate File |
| `C-X B` | Select Buffer |
| `C-X C-W`, `C-X C-S` | Write File; Save File |
| `C-X C-Q` | Toggle Read Only |
| `C-X C-B`, `C-X K` | List Buffers; Kill Buffer |
| `C-X A` | Append To Buffer |
| `C-X 1`, `C-X 2` | One Window; Two Windows |
| `C-X 3`, `C-X 4` | View Two Windows; Modified Two Windows |
| `C-X ^`, `C-X O` | Grow Window; Other Window |
| `C-X M`, `C-X D` | Mail; Dired for current file |
| `C-X V` | View File |
| `C-X 8` | Two Windows Showing Region |
| `C-X C-M-L` | Select Default Previous Buffer |

## Minibuffer and special editor contexts

### Completing reader

| Binding(s) | Command |
| --- | --- |
| `Escape` | Complete |
| `Space`, `.` | Self Insert And Complete |
| `C-?` | List Completions |
| `C-Q` | Quoted Insert |
| `Help` | Document Completing Read |
| `C-/` | Completion Apropos |
| `Return`, `C-Return` | Complete And Exit |
| `C-G` | Mini Buffer Beep |
| `Abort` | Recursive Edit Abort |
| `End` | Complete And Exit If Unique |
| `Mouse-1-1`, `Mouse-3-1` | Mouse End Of Mini Buffer; Mouse List Completions |
| `C-Sh-Y`, `C-M-Y`, `M-Sh-Y` | Yank Default String; Yank Previous Input; Pop Mini Buffer History |
| `C-Sh-F` | Specify File Buffer |
| `C-Z`, `M-Z`, `C-M-Z` | Explicitly undefined in this context |

Control-R, Recursive Edit, and Standalone are independent tables created by
`SET-COMTAB`; each inherits Standard rather than another table in this group:

| Context | Direct local cells |
| --- | --- |
| Control-R | `C-Escape`, `End`, `Abort` Exit Control-R |
| Recursive Edit | `C-Escape`, `End` Exit Control-R; `C-G` Recursive Edit Beep; `Abort` Recursive Edit Abort |
| Standalone | `End`, `C-Escape` Quit; `Abort` Standalone Abort |

They contribute 3, 4, and 3 direct cells respectively to the 199-cell special
and subordinate denominator.

### Minibuffer and pathname overlays

| Context | Binding(s) | Command or value |
| --- | --- | --- |
| Multi-line minibuffer | `Help` | Document Containing Command |
| Multi-line minibuffer | `C-Return`, `End` | End Of Mini Buffer |
| Multi-line minibuffer | `C-G`; `Abort` | Mini Buffer Beep; Recursive Edit Abort |
| Multi-line minibuffer | `C-Sh-Y`; `C-M-Y` | Yank Default String; Yank Previous Input |
| Multi-line minibuffer | `C-Sh-S`; `M-Sh-Y` | Yank Search String; Pop Mini Buffer History |
| Multi-line minibuffer | `Mouse-1-2` | Mouse End Of Mini Buffer |
| Multi-line minibuffer | `C-Z`, `M-Z`, `C-M-Z` | Explicitly undefined |
| Single-line minibuffer | `Return` | End Of Mini Buffer |
| Pathname reader | `Escape`; `C-?` | Pathname Complete; Pathname List Completions |
| Pathname reader | `C-Sh-Y` | Yank Default Pathname |
| Pathname reader | `End`; `Help` | Pathname Complete And Exit If Unique; Document Pathname Read |

These are 19 local cells: 13 multi-line, one single-line, and five pathname.
Multi-line inherits Standard, single-line inherits multi-line, and pathname
inherits single-line. The files alternate among the reader names `CR`, `Return`,
and `Newline`; System 303 maps those three names to the same base character,
octal `215`. The table distinction here is the Control modifier: multi-line
input binds `C-Return`, while its single-line child adds ordinary `Return`.

### Extended-search hierarchy

| Context | Binding(s) | Command |
| --- | --- | --- |
| Search `C-H` child | `(`; `)` | Extended Search Open; Close |
| Search `C-H` child | source byte `037` octal, `C-O` | Extended Search Or |
| Search `C-H` child | source byte `004` octal, `&`, `C-A` | Extended Search And |
| Search `C-H` child | `C-N`, `~`, source byte `005` octal | Extended Search Not |
| Search `C-H` child | `Space`; `-`; `A`; `*`; `C-X` | Extended Search Whitespace; Delimiter; Alphabetic; Some; Any |
| Search `C-H` child | `Help` | Document Containing Prefix Command |
| Search minibuffer | `Help`; `C-H` | Document Extended Search; enter Search `C-H` child |
| String-search `C-H` child | `C-B`, `C-E` | Extended Search Beginning; End |
| String-search `C-H` child | `C-F`, `C-R` | Extended Search Top Line; Reverse |
| Multi-line string search | `Escape`; `Help`; `C-H` | End Of Mini Buffer; Document Extended Search; enter string-search child |
| Single-line string search | `Return` | End Of Mini Buffer |

These are all 26 direct local assignments. The three source bytes are retained
as literal observations rather than relabeled as modern key names. Search
`C-H` has generated Control indirection but no parent comtab. The search
minibuffer inherits the single-line minibuffer; the string-search `C-H` child
inherits search `C-H`; multi-line string search inherits the multi-line
minibuffer; and single-line string search inherits multi-line string search.

### Editor-stream and keyboard-macro-mover tables

| Context | Binding(s) or event | Command |
| --- | --- | --- |
| Editor stream | `End`, `C-Return` | Activate |
| Editor stream | `Clear`; `Page` | Stream Clear; Recenter To Top |
| Editor stream | `C-M-Y`, `C-C`; `M-C` | Yank Input History; Yank Pop |
| Editor stream | `C-Sh-A` | Quick Arglist Into Buffer |
| Keyboard-macro mover | synthetic integer `-1` | Exit Keyboard Macro Mover |

The editor-stream table has eight local cells, inherits Standard, and supplies
the named but unkeyed Require Activation Mode. The mover entry is an internal
terminator, not a physical key. Its one-cell sparse table inherits the active
comtab, allowing recorded motion commands to retain their caller's context
until replay emits `-1`.

## Major-mode key deltas in System 303

Bindings not listed here are inherited from Zmacs/standard tables. Syntax,
variables, hooks, and named commands are summarized in the system article even
when a mode installs no direct key.

| Mode | Direct local bindings |
| --- | --- |
| Lisp | `Tab` Indent For Lisp; `Rubout` Tab Hacking Rubout; `C-Rubout` Rubout; `M-Z` Compile And Exit; `C-M-Z` Evaluate And Exit |
| Scheme | Lisp-style `Tab`/Rubout pair; `Break` Scheme Break; `M-.` Scheme Edit Definition |
| T | Lisp-style `Tab`/Rubout pair; `M-.` Scheme Edit Definition |
| MIDAS | `Tab` Insert Tab; `C-M-A/E` go to accumulator/address field; `C-M-D` Kill Terminated Word; `C-M-N/P` next/previous label |
| Text | `Tab` Tab To Tab Stop |
| Bolio | Text `Tab`; `C-M-0` … `C-M-9` Bolio Into Font; `C-M-:` and `C-M-*` Bolio Outof Font; `C-M-Space` Expand Only |
| Fundamental | No direct local binding |
| PL1 | `Tab` Indent For PL1; `C-M-H` Roll Back PL1 Indentation; `Control-036` (octal; Top-D) PL1DCL |
| Electric PL1 | PL1 bindings plus `;` Electric Semicolon, `:` Electric Colon, `#` Rubout, `@` Clear, and `\` Various Quantities |
| C | `Hyper-.` Edit C Definition; named `Read C Tags File` command |
| TECO | `Tab` Indent Nested; `M-'` Forward TECO Conditional; `M-"` Backward TECO Conditional |
| Macsyma | `Tab` Indent Nested; local list syntax supplies the rest of the behavior |
| TeX | `Tab` Stupid Tab; local TeX delimiter, escape, word, and comment syntax |

## Application and task-mode tables in System 303

These sparse overlays inherit the active editor tables. They account for the
remaining 135 fixed subordinate slots: 103 direct commands or prefixes and 32
explicit lowercase aliases. Named commands without keys are not included in
that denominator.

### Mail minor-mode overlay

| Binding(s) | Command |
| --- | --- |
| `C-Escape`, `End` | Exit Com Mail |
| `Abort`, `C-]` | Quit Com Mail |
| `Tab` | Tab To Tab Stop |
| `H-F`, `H-B` | Forward Address; Backward Address |
| `H-K`, `H-Rubout` | Kill Address; Backward Kill Address |
| `H-T` | Exchange Addresses |
| `C-X` | Enter the Mail `Control-X` child table |
| `C-X A`, `C-X C`, `C-X S`, `C-X T` | Add More Text; Add CC Field; Add Subject Field; Add To Field |

These are 15 fixed cells: ten top-level leaves, the `C-X` prefix, and four
child leaves. The Mail child inherits the Zmacs `Control-X` table, so normal
file and window commands remain available where Mail does not replace them.

### Dired

| Binding(s) | Command |
| --- | --- |
| `Space` | Down Real Line |
| `!` | Dired Next Undumped |
| `@`, `#`, `$` | Complement the do-not-delete, do-not-supersede, and do-not-reap flags |
| `.`, `,` | Change File Properties; Print File Attributes |
| `=`, source byte `036` octal | SRCCOM against the newest version; SRCCOM File against a selected file |
| `?`, `Help` | Dired Documentation |
| `A`, `a` | Apply Function |
| `C`, `c` | Copy |
| `D`, `d`, `C-D`, `K`, `k`, `C-K` | Mark for deletion |
| `E`, `e`; `C-Sh-E` | Edit File, entering Dired for a directory; Edit File in two windows |
| `F`, `f` | Find File |
| `H`, `h` | Automatic cleanup marking |
| `L`, `l` | Load File |
| `N`, `n` | Next Hog |
| `P`, `p` | Print File |
| `Q`, `q`, `End` | Exit and process requested operations |
| `R`, `r` | Rename |
| `S`, `s` | Show or remove a subdirectory |
| `U`, `u` | Undelete |
| `V`, `v` | View File, or open a directory view for a directory |
| `X`, `x` | Execute requested operations without leaving Dired |
| `0`–`9` | Numbers |
| `<`, `>` | Edit Superior Directory; go to most recent version |
| `Rubout` | Reverse Undelete |
| `Abort` | Abort Dired |
| `Mouse-3-1` | Dired Mouse Menu |

This is the complete 62-cell local Dired table: 46 direct cells and 16
lowercase aliases. The source byte is reported as encoded evidence rather than
assigned a modern host-key label.

### BDIRED directory-difference editor

| Binding(s) | Command |
| --- | --- |
| `Space` | Down Real Line |
| `=` | Dired SRCCOM |
| `?`, `Help` | BDIRED Documentation |
| `C`, `c` | Dired Copy |
| `P`, `p` | BDIRED Print Transfer |
| `Q`, `q`, `End` | Exit BDIRED |
| `R`, `r` | Dired Rename |
| `T`, `t` | BDIRED Transfer |
| `U`, `u` | BDIRED Unmark |
| `V`, `v` | Dired View File |
| `Rubout` | BDIRED Reverse Unmark |
| `Abort` | Abort BDIRED |

These are all 21 local cells: 14 direct and seven lowercase aliases. `I` and
`i` forms for Resolve Inconsistency are commented out in this revision and are
not bindings.

### Edit Buffers

| Binding(s) | Command |
| --- | --- |
| `Space` | Down Real Line |
| `S`, `s`; `W`, `w`; `R`, `r` | Save; Write; Revert |
| `~` | Unmodify |
| `K`, `k`, `D`, `d`, `C-K`, `C-D` | Mark buffer for deletion |
| `.` | Select Buffer |
| `U`, `u` | Undelete |
| `N`, `n` | Suppress File I/O |
| `P`, `p` | Print |
| `Help` | Edit Buffers Help |
| `Rubout` | Reverse Undelete |
| `Abort` | Abort Edit Buffers |
| `End`, `Q`, `q` | Exit Edit Buffers |

This is the complete 27-cell table: 18 direct cells and nine lowercase aliases.

### Possibilities, Warnings, and ZTOP

| Context | Binding(s) | Command |
| --- | --- | --- |
| Possibilities | `C-/` | Go To Possibility |
| Warnings | `C-/` | Go To Warning |
| ZTOP | `End`, `C-Return` | Finish ZTOP Evaluation |
| ZTOP | `Abort`, `M-Abort` | ZTOP Abort; ZTOP Abort All |
| ZTOP | `C-M-Y` | ZTOP Yank Input History |
| ZTOP | `Tab` | Indent For Lisp |
| ZTOP | `Rubout`, `C-Rubout` | Tab Hacking Rubout; Rubout |

The two navigation modes each have one local leaf; ZTOP has eight. ZTOP also
installs command hooks and advertises its input state in the mode line, so its
activation behavior is not reducible to these eight keys.

One static-source trap is worth recording. `poss.lisp` defines
`KEY-FOR-COMMAND-SET-C-.`, which first binds global Zmacs `C-.` to Beep and then
retargets it to a caller-supplied command. That mutation is runtime-dependent;
there is no single timeless `C-.` binding to put in this release table.
Possibilities callers retarget it to Go To Next Possibility, while the warning
workflow retargets it to Edit Next Warning.

Static audit of all 42 declared System 303 ZWEI files found 671 concrete unique
commands plus 31 mode-generated entry commands, for 702 source-defined command
symbols; 19 major modes, 12 minor modes, and 800 literal expanded `SET-COMTAB`
assignments.

## Minor-mode deltas in System 303

| Mode | Binding or behavioral delta |
| --- | --- |
| Return Indents | `Return` Indent New Line; `Line` Insert CRs |
| Atom Word | Redirect word syntax to Lisp atom syntax; no direct key |
| Emacs | `C-^`, `Escape`, `C-C` become Control/Meta/Control-Meta prefix characters; `C-I`, `C-H`, `C-]` alias Tab, Backspace, Abort |
| Any Bracket | Treat square and curly brackets as list delimiters; no direct key |
| Auto Fill | Post-command hook fills after configured activation characters |
| Overwrite | Replaces the ordinary self-insert command with Self Overwrite |
| Word Abbrev | Expansion hook plus the `Control-X` additions listed above |
| Electric Shift Lock | Hook uppercases inserted letters outside comments and strings |
| Electric Font Lock | Hook changes comment font |
| Mail | The 15-cell Mail and Mail `Control-X` overlay listed above |
| Require Activation modes | Editor-stream/ZTOP contexts require an explicit activation command before buffered input runs |

### Mode-composition order

System 303 major and minor modes do not form independent immutable maps. Every
active mode writes a shared sparse mode table and, when needed, a shared mode
`Control-X` table. A newly enabled mode therefore wins a collision with an
older mode. To disable an older mode, ZWEI:

1. unwinds every newer mode;
2. unwinds the target mode;
3. removes the target from the active order; and
4. reapplies the newer modes in their original order.

This transaction preserves temporal precedence. An effective-tree dump MUST
record mode activation order, not merely the set of mode names.

## System 303 effective ingress and pointer overlays

The fixed cells above are only one layer of the effective editor tree:

~~~text
raw TV input
├─ Abort      -> editor intercept -> TV Abort
├─ Meta-Abort -> editor intercept -> TV Abort All
├─ Break      -> editor intercept -> TV Break
├─ Meta-Break -> editor intercept -> TV Error Break
└─ other input
   ├─ active dynamic mouse hook -> hook-owned pointer result
   └─ mode table -> Zmacs table -> Standard table
      └─ C-X: mode C-X -> Zmacs C-X -> Standard C-X
~~~

The ordinary editor installs the four TV intercepts around its command loop.
Consequently the Standard `Break` and `Abort` cells remain table facts but are
not the effective top-level path while interception is active. A returning
Break completes typeout and redisplays editor windows unless the break remains
recursive or the typeout window was selected. Abort paths complete query/typeout
state before delegating to TV.

An absent comtab cell falls through to the parent. An explicit `:UNDEFINED`
stops lookup. An alias restarts resolution from the original top table, so a
top-level override can change the destination reached by an inherited alias.
Either unbound result clears queued input and reports a not-defined key; a
command symbol without a function binding reports the distinct not-implemented
case.

### Read Function Name pointer hook

While Read Function Name has an empty minibuffer, it installs a dynamic hook
ahead of ordinary pointer-table dispatch:

| Preconditions | Gesture | Result |
| --- | --- | --- |
| pointed highlighted atom passes the source predicate | `Mouse-1-1` | copy the name, remove the hook, and return it immediately |
| same | `Mouse-3-1` | copy the name, put point after it, remove the hook, and continue editing |

Pointer routing also has pane precedence. A click in an unselected frame selects
that frame first. In a selected frame but noncurrent editor pane, `Mouse-1-1`
normally selects the pane without running its ordinary editing command; other
buttons dispatch in the clicked pane. During that dispatch, the clicked window
and interval are the current dynamic editing context. A minibuffer exception can
select the Standard table so an unrelated application overlay does not capture
minibuffer input.

## System 303 Help subtree

`Help` is a command tree:

| Input | Help operation |
| --- | --- |
| `C` | Self Document, then read any key or recurse into a prefix |
| `D` | Describe Command |
| `A` | Apropos in the current mode |
| `U` | Undo help |
| `V` | Variable Apropos |
| `W` | Where Is |
| `L` | What Lossage, only when playback support is available |
| `Space` | repeat the preceding Help request |
| `Help` | describe Help itself |
| `C-G` or `Rubout` | abort Help |
| any other input | beep and prompt again |

Self Document follows aliases and prefix commands. `*` after selecting a prefix
enumerates all reachable leaves in that prefix. `C-X Help` directly documents
the active prefix table. The stored prior Help character initializes to `B`,
although this System 303 dispatcher has no `B` operation. Therefore `Space` as
the first request substitutes `B`, finds no dispatch function, and loops to
print the Help prompt again without an explicit beep. After a valid request,
`Space` repeats the stored request; that stored value persists in the editor
closure until another non-Space request changes it.

The command body contains a later `?`-or-`Help` test, but the input reader
accepts only the dispatcher alist, `Space`, and `Help`. Because `?` is absent
from that alist, it never reaches the test: it takes the invalid-input path,
beeps, and prompts again. Dired and BDIRED still bind an initial `?` directly to
their documentation commands; once inside this shared dispatcher, a following
`?` is likewise invalid.

## Runtime check

In the isolated System 303 load band, the harness evaluated
`(LIST (FBOUNDP 'ED) (FBOUNDP 'ZWEI:ED) (FIND-PACKAGE "EINE")
(FIND-PACKAGE "ZWEI"))` and received `(T T NIL #<Package ZWEI ...>)`.
`(ED T)` then displayed `ZMACS (LISP) * *Buffer-2*`. Typing a Lisp definition,
pressing `Help`, and invoking `Meta-X` produced the live editor Help dispatcher,
Help menu, and `Extended command:` prompt. `Text Mode` visibly changed the mode
line to `ZMACS (Text)`, and `Lisp Mode` changed it back. This confirms the
high-level input paths, active editor identity, and executable mode transition;
it does not exhaustively execute every table leaf. Four selected screenshots
have passed the repository's capture-specific rights review and are tracked in
the [curated CADR screenshot catalog](../assets/mit-cadr-screenshots/); the
[architecture article](zwei-and-zmacs.md#runtime-observations) records their
actions and evidentiary limits.

## Sources

- MIT CADR System 46, [`comtab.115` Standard tables](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comtab.115#L603-L856),
  its [completing-reader and minibuffer tables](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comtab.115#L1087-L1107),
  and the [expected Zmacs tags](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/nzwei.tags#L1592-L1674),
  revision `8e978d7`; verified 2026-07-18.
- LM-3 System 303, [`comtab.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/comtab.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`zmacs.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/zmacs.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`modes.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/modes.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`dired.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/dired.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`bdired.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/bdired.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`poss.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/poss.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and [`stream.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/stream.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
