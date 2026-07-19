---
type: Historical Article
title: Formatting, spelling, and text production utilities
description: A release-bounded guide to FORMAT, FQUERY, grinders, dribbling, spelling, Bolio, Sage, fonts, and editor-side text production on the MIT and Symbolics Lisp machines.
tags: [lisp-machine, mit-cadr, lm-3, genera, format, spelling, bolio, sage, fonts]
timestamp: 2026-07-18T08:22:08-04:00
---

# Formatting, spelling, and text production utilities

Text production on the Lisp Machine was a stack, not one program. At its lower
levels, `FORMAT` rendered values, `FQUERY` asked structured questions, the
grinder laid out Lisp forms, and dribbling captured a listener session. ZWEI
then supplied filling, comment formatting, font or character-style operations,
and spelling correction. At the document level, MIT material used Bolio source
and XGP or Press output, while Genera shipped Sage-backed screen and printer
formatting, a documentation database, and command tables for documentation,
fonts, and spelling.

That stack did not grow monotonically. The maintained LM-3 System 303 source
adds a general `FQUERY`, a local spelling checker, a wider grinder, and the
`FORMAT:OUTPUT` mini-language to the public System 46 baseline. Genera 8.5 has
a presentation-aware `FQUERY`, a much richer Zmacs speller, character styles,
and Sage, but drops some LM-3 `FQUERY` options and some of the maintained
grinder's special-form handlers. The old Bolio mode survives in Genera as a
recognizable compatibility mode even though its historical font-key setup is
commented out. A fresh System 303-0 runtime probe also establishes that its
load band retains older `FORMAT` case-conversion and indentation handlers that
the current maintained component source no longer registers.

## Evidence boundary and meaning of “complete”

| System | Inspected release | What establishes behavior here |
| --- | --- | --- |
| MIT CADR | Public System 46 source at Git revision `8e978d7d1704096a63edd4386a3b8326a2e584af` | Source definitions and contemporary manual source. |
| LM-3 | Maintained System 303 source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, tag `system-303`; System 303-0 load band | Current files at that check-in, retained historical file versions, public manual source, and one fresh isolated listener probe. A maintained restoration is not silently treated as an untouched 1980s release. |
| Symbolics Genera | Genera 8.5 purchased archive, `og2/sys.sct`, plus locally extracted Help | Licensed source and Help were inspected locally. Only hashes, paths, counts, and original analysis are published. No licensed source or recovered Help is tracked. |

“Complete” below has an explicit grain. For `FORMAT`, it means the directives
registered by the selected core implementation file, plus named directives
registered in that same file. For `FQUERY`, it means all accepted keyword
options and the standard wrappers. For the grinder, it means public entry
points and the complete built-in special-layout registration table, not every
private layout function. For ZWEI and CP, it means every literal command
registration in the identified command tables and source files. Genera Sage
is extensible by book designs and loaded records, so the markup inventory is
the complete *basic palette exposed by the shipped Zmacs Help record*, not a
claim that no site or document can define another directive.

The System 303 `FORMAT` inventory distinguishes the current component file
from the loaded System 303-0 band wherever those two artifacts disagree.

The source, manual, extracted-Help, and runtime evidence classes remain
separate. In particular, a docstring can describe a directive whose handler is
not present in the selected source, and a source definition does not prove that
an optional system was loaded in a particular world.

## `FORMAT`: a language inside output

All three lines accept a destination and a control argument followed by data.
`NIL` as destination builds a string, `T` means the standard output stream, and
a stream receives output directly. System 46 and System 303 also accept a
string as destination and append into it. Their Zetalisp implementations accept
a string, symbol, or a list that intermixes literal strings with directive
forms; an undefined list directive is evaluated. Genera's `ZL:FORMAT` first
checks that its control argument is a string. Its inherited docstring still
says that lists work, but the actual entry point rejects them. That is a
source-visible documentation defect, not a compatibility feature.

The common parameter grammar is decimal integers, comma-separated omitted or
present parameters, `V` for a parameter taken from the next argument, `#` for
the number of remaining arguments, and a quoted character for a character
value. Colon and at-sign modify directive semantics. Genera additionally parses
a leading minus sign on numeric parameters.

### Core directive inventory

The following table groups the complete built-in registrations rather than
repeating matching end delimiters as separate features. “ZL” and “CL” in the
Genera row describe the same engine under its two syntax modes.

| Family | System 46 | LM-3 System 303 | Genera 8.5 |
| --- | --- | --- | --- |
| Object and character output | `~A`, `~S`, `~C`; `~Q` calls a function supplied as an argument | `~A`, `~S`, `~C`, obsolete-compatible `~Q`; named `LOZENGED-CHAR`, `LOZENGED-CHARACTER`, and `LOZENGED-STRING` | `~A`, `~S`, `~C`, `~W`, obsolete-compatible `~Q`, and a legacy lozenged-object control; `~W` uses the pretty printer and its flags alter pretty/level/length behavior |
| Integers and radix | `~D`, `~O`, and `~nR`; no built-in binary or hexadecimal directive | `~D`, `~O`, `~B`, `~X`, and `~nR` | `~D`, `~O`, `~B`, `~R`; `~X` is hexadecimal in CL mode but repeats spaces in ZL mode |
| Floating point | `~F`, `~E` | `~F`, `~E`, hybrid `~G`, and `~$` | `~F`, `~E`, `~$`; `~G` is general floating-point output in CL mode and an argument jump in ZL mode |
| English and Roman forms | `~R` selects cardinal, ordinal, new Roman, old Roman, or an explicit radix | Same | Same, plus the named grammatical helpers listed below |
| Layout and effectors | `~T`, `~%`, `~&`, `~X` for spaces, `~~`, `~\|`, and tilde-newline whitespace control | `~T`, `~%`, `~&`, `~~`, `~\|`, and tilde-newline; `~X` has become hexadecimal | `~T`, `~%`, `~&`, `~~`, `~\|`, tilde-newline, pretty-printer indentation `~I`, and pretty-printer newline `~_` |
| Argument movement and termination | `~*`, old absolute jump `~G`, and `~^` | `~*` including `~n@*` absolute movement, hybrid `~G`, and `~^` | `~*`, `~^`; ZL `~G` retains the old absolute jump |
| Plural and indirect operations | `~P` and `~Q`; no `~?` | `~P`, `~Q`, and indirect `~?` | `~P`, `~Q`, indirect `~?`, and ANSI-style `~/function/` |
| Compound controls | selection `~[...~]`, iteration `~{...~}`, justification `~<...~>`, and clause delimiter `~;` | The same in the current component file; the System 303-0 load band additionally has case conversion `~(...~)` and non-ASCII indentation delimiters, for which retained `format.lisp.208` supplies matching source | The same, plus case conversion `~(...~)`, a non-ASCII indentation delimiter pair, a legacy upcase-one-object control, and character-style delimiters |

System 46's `~G` means “go to argument,” while `~X` means spaces. System 303
is transitional: `~X` is hexadecimal and `~@*` is the general absolute
movement operation, but `~G` still performs a jump when its first parameter is
an integer from zero through three; otherwise it performs general
floating-point formatting. Genera resolves the collision through the dynamic
syntax mode: its ZL branch keeps old `G`/`X`, while its CL branch gives them the
Common Lisp floating/hexadecimal meanings.

The System 303 `FORMAT` docstring advertises `~(...~)` case conversion and a
pair of non-ASCII indentation controls. The selected `format.lisp` does not
register either handler. An older file retained in the Fossil checkout,
`format.lisp.208`, does contain those registrations, but it is not the current
component source. The fresh runtime probe below found all three functions in
the loaded System 303-0 dispatch properties and exercised all four
case-conversion variants. Thus the docstring describes the load band correctly
while the current executable source body does not reconstruct that part of the
loaded band. The indentation handler's presence is runtime-confirmed; its
visible line-layout effect was not exercised.

### Named and extensible directives

System 46 already parses a long directive name delimited by backslashes, even
though its core file defines no named convenience family comparable to later
releases. System 303's core named directives are:

- `LOZENGED-CHAR` and `LOZENGED-CHARACTER`, which show a character in the
  Lisp-machine lozenge notation;
- `LOZENGED-STRING`;
- `TIME-INTERVAL`, `DATIME`, `TIME`, and `DATE`.

Genera exposes `DEFFORMAT` as a definition type and supports ANSI-style
`~/function/`. The core file also registers these English helpers:

- `HAS-HAVE`, `IS-ARE`, and `WAS-WERE`;
- `THIS-THESE`, `THAT-THOSE`, `IT-THEM`, `IT-THEY`, and `ITS-THEIR`;
- `PLURALIZE`, `A-OR-AN`, and `QUOTED-STRING`.

Its character-style region uses source control characters corresponding to a
Control-P opener and Control-Q closer. A parameter can be `I`, `B`, `P`, or
`R` for italic, bold, bold-italic, or roman; it can instead be a face symbol or
a full character-style value. The colon modifier also binds line height. This
is rendering metadata carried by “fat” characters and output streams, not a
vector-font facility.

Because `DEFFORMAT` and property registration are extension mechanisms, an
application can add directives after the core loads. For example, the LM-3
Zmail tree registers an `ARROW` directive. The table above deliberately means
“complete core language,” not “every directive any loadable application could
have installed into a running world.”

### `FORMAT:OUTPUT` in maintained LM-3

System 303 also contains a small output-composition language in
`io1/output.lisp`, documented alongside `FORMAT`. Its complete public surface
in the selected source/manual pair is:

| Operation | Role |
| --- | --- |
| `FORMAT:OUTPUT` | Establish an output stream and interpret a sequence of literal strings and output forms. |
| `FORMAT:OUTFMT` | Use the already established output context. |
| `FORMAT:ONUM` | Print an integer with radix, minimum-width, padding, sign, comma, and tab-period controls. |
| `FORMAT:OFLOAT` | Print a float with digit count, exponential choice, width, and padding controls. |
| `FORMAT:OSTRING` | Print a string with width, padding, tab period, and right-justification. |
| `FORMAT:OPRINT` | The object-printing counterpart to `OSTRING`. |
| `FORMAT:OCHAR` | Print a character with style, top-character explanation, width, and padding controls. |
| `FORMAT:TAB` | Advance to a column, optionally breaking the line, in character or other requested units. |
| `FORMAT:PAD` | Run a body, collect its pieces, and pad the combined result to a requested field. |
| `FORMAT:PLURAL` | Choose a supplied singular or plural string from a number. |
| `FORMAT:BREAKLINE` | Collect output and conditionally break before emitting it. |
| `FORMAT:PRINT-LIST` | Lay out list elements without allowing a separator to lap over a line boundary. |

`FORMAT-MACRO` is a compile-time optimizer for literal controls. When it cannot
safely expand a control, it falls back to a normal `FORMAT` call; it is not a
second formatting language.

## `FQUERY`: structured questions

No definition of `FQUERY` occurs in the selected System 46 source. That release
does have two narrower interfaces:

- `Y-OR-N-P` reads one character. `Y`, `y`, `T`, `t`, or Space means yes;
  `N`, `n`, or Rubout means no. Invalid input repeats the message and asks for
  Y or N.
- `YES-OR-NO-P` reads a line, removes surrounding spaces, tabs, periods, and
  double quotes, ignores case, and accepts only `YES` or `NO`.

Both functions contain a temporary compatibility branch that recognizes an
older message/stream argument order. This implementation detail is easy to
miss when reading only later manuals.

### System 303 option inventory

The complete accepted keyword surface of the maintained `FQUERY` is:

| Option | Effect |
| --- | --- |
| `:MAKE-COMPLETE` | Ask a capable stream to complete the interaction after a choice. |
| `:TYPE` | Select `:TYI`, `:READLINE`, or `:MINI-BUFFER-OR-READLINE`. |
| `:CHOICES` | Supply `:ANY` or choice entries that map input items to a return value and optional echo text. |
| `:STREAM` | Select a stream; a non-stream symbol or list expression is evaluated. The default is query I/O. |
| `:BEEP`, `:CLEAR-INPUT`, `:FRESH-LINE` | Control setup and retry presentation. |
| `:CONDITION` | Signal a condition before asking and accept a handler-provided new value. |
| `:LIST-CHOICES` | Print the choices after the prompt. |
| `:HELP-FUNCTION` | Handle Help with the stream, choices, and selected type implementation. |
| `:DEFAULT-VALUE` | Value returned by a timeout/default event. |
| `:TIMEOUT` | Timeout interval in sixtieths of a second, gated by `*ALLOW-FQUERY-TIMEOUTS*`. |

`:SELECT` is accepted but explicitly marked no longer used.
`:SIGNAL-CONDITION` is accepted by the decoder but has no independent effect in
the selected source. The public `query.text` manual describes the older core
options and omits `:DEFAULT-VALUE`, `:TIMEOUT`, and the timeout wrappers; those
features are established by source, not by that manual page.

Standard one-character choices add Hand-Up as yes and Hand-Down as no, alongside
`Y`/`T`/Space and `N`/Rubout. The wrappers are `Y-OR-N-P`, `YES-OR-NO-P`,
`Y-OR-N-P-WITH-TIMEOUT`, and `YES-OR-NO-P-WITH-TIMEOUT`.

### Genera option inventory

Genera's complete keyword surface is:

| Option | Effect |
| --- | --- |
| `:MAKE-COMPLETE`, `:CHOICES`, `:BEEP`, `:CLEAR-INPUT`, `:FRESH-LINE`, `:LIST-CHOICES`, `:HELP-FUNCTION`, `:STREAM` | The corresponding core interaction controls. |
| `:TYPE` | `:TYI` or `:READLINE`; the LM-3 minibuffer-or-readline value is absent. |
| `:SELECT` | Select or notify the relevant query window and restore the previous selection afterward. |
| `:NO-INPUT-SAVE` | Keep a response out of input history. |
| `:STATUS` | Permit a status result from character input. |
| `:SIGNAL-CONDITION` | Signal `FQUERY` and accept a handler-provided choice. |

Genera removes the maintained LM-3 timeout and default-value options. It adds
Dynamic Windows integration: choices have a presentation type, can be clicked,
and readline choices use completion suggestions. A stream can redirect the
interaction through its `:FQUERY-STREAM` operation. The one-character defaults
retain `Y`/`T`/Space and `N`/Rubout but not LM-3's hand gestures.
`YES-OR-NO-P` requests line input with `:NO-INPUT-SAVE T`.

This is a clear case where “later” does not mean “strict superset.” Genera's
interface is richer on a presentation-aware display but lacks the timeout API
present in the maintained LM-3 line.

## The Lisp grinder

The grinder is a layout engine for Lisp objects and definitions. It first tries
compact output, measures whether a form fits, and falls back through normal,
miser, or vertical layouts. It recognizes selected operators so, for example,
a `DEFUN`, `COND`, `LET`, or `DO` is laid out structurally instead of as an
undifferentiated list.

The public entry points across the inspected files are `GRIND-TOP-LEVEL`,
`GRINDEF`, and `GRIND-1`. `GRINDEF` prints one or more named definitions; in
System 46, invoking it without names repeats the previous request. System 303
and Genera define it as a macro and avoid allowing a malformed previous list to
poison later calls. ZWEI exposes `Grind Definition` and `Grind Expression` as
named commands; the latter evaluates a minibuffer form and inserts its ground
result, so it is not safe on untrusted input.

### Complete special-layout registrations

| Release | Forms with built-in grinder handlers |
| --- | --- |
| System 46 | `QUOTE`; `DEFUN`, `MACRO`, `DEFMACRO`, `DEFMETHOD`; `LAMBDA`; `PROG`; `DO`, `DO-NAMED`; `COND`; `SETQ`; `AND`, `OR`; `LET`; `TRACE`; lambda composition; backquote constructors `XR-BQ-CONS`, `XR-BQ-LIST`, `XR-BQ-LIST*`, `XR-BQ-APPEND`, and `XR-BQ-NCONC`, plus the four internal comma forms. |
| LM-3 System 303 | All applicable System 46 forms, plus `DEFSELECT`, `FUNCTION`, `DEFSUBST`, `NAMED-LAMBDA`, `SUBST`, `NAMED-SUBST`, `CLI:SUBST`, `PROG*`, `PROGV`, `PROGW`, `DO*`, `DO*-NAMED`, `PSETQ`, `LET*`, `COMPILER-LET`, and `XR-BQ-VECTOR`. |
| Genera 8.5 | `QUOTE`; `DEFUN`, `MACRO`, `DEFMACRO`, `DEFMETHOD`; `LAMBDA`, `NAMED-LAMBDA`; `PROG`, `PROG*`; `DO`, `DO*`, `DO-NAMED`, `DO*-NAMED`; `COND`; `SETQ`, `PSETQ`; `AND`, `OR`; `LET`, `LET*`, `COMPILER-LET`; `TRACE`; the System 46 backquote and comma families. |

System 303's `GRIND-TOP-LEVEL` adds a selectable layout function and initial
indentation to the older optional argument list. It can inspect encapsulations,
renamings, interpreted definitions, `DEFSELECT`, and arrays. The selected source
also disables its custom array-contents branch after recording an infinite-loop
problem, and states that the old grinder does not understand `*PRINT-CIRCLE*`.
Genera supports compiled and interpreted functions, flavor methods, macro or
special-form expanders, and encapsulation, but its literal registration table
is narrower than maintained LM-3's: the `DEFSELECT`, `FUNCTION`, `DEFSUBST`,
substitution, `PROGV`, and `PROGW` special layouts are absent.

ZWEI's `Format Code` command is related but hazardous to comments: it reads the
form after point, grinds it back into the buffer, and deletes comments. The
operation is undoable. Its old Control-Meta-G binding is commented out in all
three inspected command tables, leaving it as a named command.

## Dribbling a listener session

Dribbling duplicates terminal interaction to a file or editor buffer while a
nested Lisp listener runs. It is closer to a transcript facility than to a VM
snapshot: it records stream traffic and input-editor text, not process memory,
window state, or machine state.

| Release | Public controls and capture boundary |
| --- | --- |
| System 46 | `DRIBBLE-START filename &optional editor-p` enters a nested listener; `DRIBBLE-END` closes it. Standard input and output are wrapped. Output is duplicated, and accepted rubout-handler input is copied after editing. |
| LM-3 System 303 | `DRIBBLE pathname-or-NIL` starts or stops; `DRIBBLE-START` wraps standard input/output; `DRIBBLE-ALL` wraps terminal I/O so queries and break loops are also included; `DRIBBLE-END` exits. Stream safety checks, forced output, and a returned truename are added. |
| Genera 8.5 | `INSIDE-DRIBBLE?`, `DRIBBLE-START pathname &optional editor-p concatenate-p debugger-p`, and `DRIBBLE-END`. The Common Lisp `DRIBBLE` wrapper starts when given a pathname and ends when passed none. |

Genera refuses nested recording, defaults the pathname to text, and labels its
nested loop “Dribbling Lisp Listener.” It binds standard input, standard output,
error output, query I/O, and trace output to the transcript stream, and can also
include debugger I/O. Its stream understands input-editor replacement and
presentation output. `concatenate-p` is passed to the editor-buffer stream; the
ordinary file branch uses the file-opening behavior shown in source, so this
page does not generalize that flag into an undocumented file-append promise.

Genera has no literal `DRIBBLE-ALL` counterpart in the selected source. Its
default start operation instead captures more named streams directly than the
older `DRIBBLE-START` did.

## Spelling correction

### System 46: no shipped spell subsystem in the selected tree

An exact source search found no spelling or Ispell subsystem in the selected
System 46 tree. This is a bounded negative result: it says the public snapshot
does not contain the later facility, not that no MIT Lisp Machine site ever ran
a spelling program.

### Maintained LM-3: local Ispell behind two ZWEI commands

System 303 loads `NEW-ISPELL` as the ZWEI interface and defines the optional
`ISPELL` system as the local checker in `spell-check.lisp`. The active command
surface is small:

| Command | Binding | Behavior |
| --- | --- | --- |
| `Correct Word Spelling` | Meta-$ | Check the word immediately around point; automatically replace when there is exactly one near match. |
| `Correct Spelling` | Meta-X only in the selected command table | Check the active region, or the whole buffer when there is no mark. |

If the checker is not loaded, the interface offers to load the optional system,
with a two-hour timeout whose default is yes. The local checker seeks a root in
a hash-table dictionary after single wrong-letter, extra-letter,
missing-letter, and adjacent-transposition permutations, returning at most ten
variants. Dictionary flags are `V`, `N`, `X`, `H`, `Y`, `G`, `J`, `D`, `T`,
`R`, `Z`, `S`, `P`, and `M`; they enable families such as adjectival,
nominal, ordinal, adverbial, participial, past-tense, comparative,
superlative, plural, possessive, and related endings.

For multiple suggestions, the ZWEI interface displays at most nine numbered
choices, `R` for an explicitly typed replacement, and Space to accept the
questioned word. The digit-range test in `select-word` can admit the digit equal
to the candidate count, while the caller later rejects an index outside the
list. That is a questionable source-visible edge, not a runtime-confirmed user
bug.

The older `ispell.lisp` remains in the tree and talks to a Chaosnet `ISPELL`
server. It is historical/dormant relative to `NEW-ISPELL` plus the current
system declaration. A comment in `spell-check.lisp` still advertises a second
Meta-Roman-1 route for region or buffer checking, but the selected command table
binds only Meta-$; `Correct Spelling` remains a named command. This is another
manual/comment-to-current-table disagreement.

The source-advertised programming interface is `SPELL-WORD`, `SPELL-CHECK`,
`WORD-OK-P`, and `WORD-IN-DICTIONARY-P`, with `ZWEI:SPELL-WORD` linked to the
local implementation.

### Genera: full Zmacs dictionary workflow

Genera registers exactly fifteen literal commands in the standard ZWEI command
table; only `Spell This Word` has a default key:

| Command | Binding or scope |
| --- | --- |
| `Spell This Word` | Meta-$; check the current word, or the region when one is active. |
| `Spell Word` | Prompt for a word without editing buffer text. |
| `Spell Region` | Check the active region; when none exists, check the current paragraph. |
| `Spell Buffer` | Check the whole buffer. |
| `Spell File` | Scan wildcard-selected files and put distinct unknown words in a chosen buffer. |
| `Tags Spell` | Scan buffers reached through the current tag table and collect unknown words. |
| `Read Spell Dictionary` | Load a character or binary dictionary; a numeric argument keeps it off the correction menu. |
| `Show Spell Dictionaries` | Show loaded dictionaries, word counts, menu membership, and modification state. |
| `Show Contents of Spell Dictionary` | Display sorted words, or write them to a file with a numeric argument. |
| `Kill Spell Dictionary` | Remove a dictionary from the live list without deleting its file. |
| `Save Spell Dictionary` | Save a selected modified dictionary. |
| `Save All Spell Dictionaries` | Save all modified dictionaries. |
| `Compile Spell Dictionary` | Convert a character dictionary into the faster binary dictionary representation. |
| `Add Word to Spell Dictionary` | Add a prompted word to a selected loaded dictionary. |
| `Delete Word from Spell Dictionary` | Delete a prompted word from a selected loaded dictionary. |

The separate CP `Spelling` table has one literal command, `Create Spell
Dictionary From Namespace`. It scans user login and personal names in a chosen
namespace, extracts alphabetic runs longer than one character, adds possessive
forms, and writes the chosen dictionary pathname.

The Zmacs scanner treats letters and apostrophes as word characters and ignores
one-character words. `Spell This Word` has explicit cases for point within, at
the beginning of, at the end of, or in whitespace after a word. Paired single
quotes receive special handling so TeX-like quoting does not become part of the
spelling candidate. Suggested replacements preserve the original broad case
kind and character style; an explicitly typed uppercase letter is respected.

The correction menu's complete semantic controls are:

- `Prompt` or Control-P: type an arbitrary replacement;
- `Accept`: when a temporary command dictionary exists, accept the word for the
  rest of that command; otherwise it behaves as accept once;
- `Accept Once` or Control-O: permit only the present occurrence;
- Control-A: choose the context-appropriate accept behavior;
- `Accept Command`: the explicit menu label used when a temporary dictionary
  exists;
- one item per writable menu dictionary: accept and add the word there;
- one item per suggested spelling: replace the word;
- Abort: cancel.

The source explicitly says keyboard selection for suggestion words and
dictionary names was not implemented; only the individually installed keys
above are keyboard-sensitive. That limit is not obvious from the manual's
menu-oriented explanation.

The standard basic dictionary is `SYS: DATA; BASIC.DICT.NEWEST`. Site options
can add dictionaries, and a personal `SPELL.DICT` in the home directory is
tried in binary and then text form. Dictionaries load lazily on first spell
operation, with a prompt when expected files are unavailable. Logout policy is
`:YES`, `:NO`, or `:ASK` for saving modified dictionaries.

## Bolio and the MIT document pipeline

Bolio is present in the public evidence principally as a document source
language and a ZWEI editing mode. The System 46 manual title says the manual was
produced by the Bolio text justifier and printed on the MIT AI Laboratory XGP.
The source tree contains `.bolio` documents and generated `.xgp` artifacts, but
the inspected snapshot does not contain the Bolio formatter itself. An init
form refers to an external `(DSK BOLIO)` include/FASL. Maintained System 303
likewise contains Bolio manual sources and a `manual.lisp` driver that includes
external Bolio macros; the formatter engine is not in the inspected checkout.

The System 46 and System 303 Bolio-mode command surface is:

| Control | Effect |
| --- | --- |
| Tab | Move to the next tab stop. |
| Control-Meta-0 through Control-Meta-9 | Insert Control-F followed by that font digit. |
| Control-Meta-: or Control-Meta-* | Insert Control-F `*`, ending the font change. |
| Control-Meta-Space | Expand a word abbreviation without inserting a delimiter. |
| `ZNIL` word abbreviation | Expand to `nil` bracketed by font 3 and the font-end marker. |
| `ZT` word abbreviation | Expand to `t` bracketed the same way. |

The mode is based on Text mode, treats underscore and apostrophe as word
characters, uses `.c ` for comments at column zero, and turns on Word Abbrev
mode. System 303 additionally puts apostrophe into the paragraph-delimiter
list.

Genera still recognizes `.def` lines for Bolio sections and defines Bolio mode
as a Text-mode-derived major mode. However, its old key-table and abbreviation
setup is inside a block comment. The live mode forms retain comment and
paragraph settings, but source does not establish the historical font shortcuts
as active in Genera 8.5. This is compatibility residue, not evidence that
Genera's Sage formatter used Bolio font controls.

At the output end, System 46 has Press and XGP code for printer transport,
font selection, page/entity construction, bitmaps, lines, file printing, and
spooling. System 303 adds the generic `HARDCOPY-FILE`, `HARDCOPY-STREAM`,
`HARDCOPY-BIT-ARRAY`, and `HARDCOPY-STATUS` layer over printer-specific methods,
while retaining Press/XGP conversion and spooling. Those components prove that
the Lisp Machine could emit and transport hardcopy; they do not fill the missing
Bolio-engine gap.

## Genera Sage and document formatting

Genera's screen/printer formatter consumes embedded at-sign instructions. The
Zmacs commands wrap plain text or Scribe-style source in `@begin(text)` and
`@end(text)` and pass the resulting stream to Sage. Short environments use a
paired delimiter after a directive, while long environments use
`@begin(name)` and `@end(name)`. Commands, unlike environments, do not acquire a
long form merely by using `begin`/`end`.

### Command Processor tables

The literal `Document Formatting` table contains four commands:

| Command | Arguments and behavior |
| --- | --- |
| `Format File` | One or more pathnames, including wildcards; destination defaults to screen and can be a compatible printer; `Page Headings` defaults true. Each input is treated as a Text environment. |
| `Set Sage Variable` | Sage variable and string value. |
| `Clear Sage Variable` | Sage variable whose static value is removed. |
| `List Sage Variables` | Display the current static variable/value table. |

The literal `Documentation` table contains six commands:

| Command | Arguments and behavior |
| --- | --- |
| `Show Documentation` | Record group and destination, defaulting to screen. It looks up and displays or prints installed documentation. |
| `Show Table of Contents` | Record group; optional cross-references, associated sources, and depth. Cross-references and sources default false but are mentioned as true when explicitly requested. |
| `Register Book` | Record group plus mnemonic, design type, highest structural level, Symbolics-copyright flag, MIT-copyright flag, document number (default `999999`), release version, author group, and trademarks. Boilerplate, marketing, design, printer, and confidentiality arguments appear only as commented-out source and are not active controls. |
| `Format Topic` | Record group and destination; expand and format the selected installed Sage record. |
| `Run Documentation Example` | Compile and/or evaluate the Lisp forms embedded in an active documentation example. This is executable content and must not be invoked on untrusted records. |
| `Edit Documentation Example` | Copy the example's source text into a Lisp-mode Zmacs buffer named `Documentation Examples`. |

Dynamic Windows translators connect record groups and record-group names to
`Show Documentation`, callable names and activities to Describe-style
documentation gestures, and function-bearing records to Edit Definition.
Active examples have run and edit translators. These are semantic object
controls, not merely underlined text regions.

### Zmacs formatting and documentation commands

The Sage UI installs these named Zmacs controls:

| Command | Binding or arguments |
| --- | --- |
| `Format Region` | Meta-X; screen by default, numeric argument asks for a device, zero suppresses page headings. |
| `Format Buffer` | Meta-X; same destination and heading rules. |
| `Format File` | Meta-X; same destination and heading rules. |
| `Show Documentation` | Meta-Shift-D. |
| `Show Documentation Function` | Meta-Shift-A. |
| `Show Documentation Variable` | Meta-Shift-V. |
| `Show Documentation Flavor` | Meta-Shift-F. |
| `Show Table of Contents` | Meta-X. |
| `What Document` | Meta-X. |
| `Document List Callers` | Meta-X. |
| `Show Candidates` | Meta-X; supports heuristic, exact, initial-substring, or substring matching and any-order or adjacent multiword matching. |

Source reveals an important restriction omitted from the basic command
summaries in Help: `Format Region` and `Format Buffer` refuse a Sage-mode
buffer, and `Format File` refuses a Sage-record file. They are for plain text
or Scribe-command input. The error path directs a writer to Writer Tools parsing
and `Show Documentation` instead. Thus “Sage-backed formatter” does not mean
that these three convenience commands are the renderer for already parsed Sage
record source.

### Basic Sage markup inventory

The shipped Zmacs Help record calls the following its basic formatting palette.
The classification shown here follows that record.

- Environments: `+`, `-`, `B`, `Bar`, `BI`, `Box`, `C`, `Center`,
  `Checklist`, `Commentary`, `Description`, `Display`, `Enumerate`, `Equation`,
  `Example`, `F`, `Figure`, `FileExample`, `Float`, `FlushLeft`, `FlushRight`,
  `Format`, `FullPageFigure`, `FullPageTable`, `G`, `Group`, `Heading`, `I`,
  `InputExample`, `Itemize`, `K`, `Level`, `LS`, `M`, `MajorHeading`,
  `Multiple`, `OutputExample`, `P`, `Presentation`, `ProgramExample`,
  `Quotation`, `R`, `S`, `SimpleTable`, `SubHeading`, `SubSubHeading`, `T`,
  `Table`, `Text`, `Transparent`, `U`, `UN`, `UX`, `Verbatim`, `Verse`, and
  `W`.
- Commands and markup: `BlankPage`, `BlankSpace`, `Caption`, `Cite`,
  `CiteMark`, `Foot`, `Hinge`, `Index`, `IndexPrimary`, `IndexSecondary`,
  `Label`, `Message`, `Modify`, `NewPage`, `Note`, `PageFooting`,
  `PageHeading`, `PageRef`, `Ref`, `Set`, `SimpleTableSpecs`, `String`,
  `Style`, `SubSection`, `SubSubSection`, `TabClear`, `TabDivide`, `Tabs`,
  `TabSet`, `TabStops`, `Tab-To-Tab-Stop`, `Tag`, `TitleRef`, `Unnumbered`,
  `Use`, and `Value`.
- No-argument punctuation commands: `@#` reserves an em-sized blank; `@*`
  forces a line; `@.` emits a period followed by one significant space; `@=`
  starts centered tab text; `@>` starts right-flush tab text; `@\` advances to
  a tab stop or ends centered/right-flush text; `@^` sets a tab at the current
  position; `@@` emits a literal at-sign; and `@~` discards following source
  whitespace.

The same Help record explicitly labels these names as present in code but not
documented there: `ActiveExample`, `Bibliography`, `Block`, `BlockLabel`,
`CB`, `Case`, `Chapter`, `Define`, `Device`, `Disable`, `EquateFontFamily`,
`Flg`, `HDX`, `Include`, `IndexEntry`, `IndFinalPage`, `Itag`, `L`,
`LayeredErrorEnv`, `Lisp`, `MajorPart`, `Make`, `MargLabel`, `NewColumn`,
`Noop`, `Page`, `Parm`, `ParmQuote`, `Part`, `Picture`, `Place`,
`PlainHeadings`, `PlainHeadingNow`, `PlusStandardBoxMargins`, `TextForm`, and
`UnindentParagraph`. `Box`, `Caption`, and `Message` appear in both the basic
listing and that “not documented” preface, an internal inconsistency preserved
here rather than silently deduplicated into a stronger claim.

The names establish a shipped parser vocabulary, not the complete semantics of
each book design. A book registration can select a design, and a loaded design
can change how a structural name renders.

## Fonts, character styles, and editor text controls

The Genera CP `Fonts` table has exactly two literal source registrations:

| Command | Behavior |
| --- | --- |
| `Edit Font` | Accept an optional font name and enter the Font Editor. An unknown name prompts before creating a font. Font-name presentations have an Edit Definition translator. |
| `Show Font` | Accept a font name and display every character. Font-name presentations have a Select translator. |

Zmacs also registers `List Fonts`, `Display Font`, and the alias `Show Font`.
`List Fonts` normally lists loaded fonts; a numeric argument also searches font
files available from the file computer. `Display Font`/`Show Font` prompts for
a font and produces a specimen.

These commands operate on Genera's bitmap-font and character-style machinery.
The inspected Font Editor reads and writes BFD, binary Lisp font definitions,
and other registered font-file types. This does not establish a vector-font
renderer; the separate font-recovery article should be used for the recovered
font formats and specimens.

The Zmacs character-style command surface relevant to text production is:

| Command | Binding | Effect |
| --- | --- | --- |
| `Change Style Char` | Control-J | Change one or a numeric count of following characters. |
| `Change Style Word` | Meta-J | Change one or a numeric count of words. |
| `Change Style Region` | Control-X Control-J | Replace the region's style; a numeric argument merges the chosen style against existing components. |
| `Change One Style Region` | Meta-X | Replace only characters having one selected source style. |
| `Change Typein Style` | Control-Meta-J | Set the style for newly inserted text. |
| `Set Default Character Style` | Meta-X | Set a fully specified buffer default and optionally update the file attribute list. |
| `Show Character` | Control-Shift-J | Describe the character at point, including its font/style. |
| `Show Character Styles` | Meta-X | List styles in the region or buffer, resolved fonts, canned samples, and samples from the buffer; displayed objects are presentations. |
| `Find Character in Style` | Meta-X | Search forward for the next character having a selected style. |

The default Quick style dispatch is `B` bold, `I` italic, `P` bold-italic, `N`
normal/null face, `S` smaller, and `L` larger. Meta plus a dispatch character
redefines it; Escape asks for a full style once; Space or Return uses the
default; End selects the null style; Help describes the dispatch table; Abort,
Rubout, or Control-G cancels. The alternative prompt-for-name mode reads a full
family/face/size style. This complete interaction is clearer in source than in
the manual's shorter six-command overview.

### Filling, comments, and legacy text-justifier controls

The text-production subset of the standard ZWEI table is:

| Command | System 46 / System 303 | Genera 8.5 |
| --- | --- | --- |
| `Set Fill Column` | Control-X F | Same; a numeric value below 200 means characters and 200 or more means pixels, otherwise use point's current horizontal position. |
| `Set Fill Prefix` | Control-X . | Same; text from line start to point becomes the per-buffer prefix. |
| `Fill Paragraph` | Meta-Q | Same; a positive numeric argument adjusts instead of simply filling. |
| `Fill Region` | Meta-G | Same; a positive numeric argument adjusts. |
| `Fill Differently` | Absent | Meta-Shift-Q; repeat an adjacent fill/adjust with a changing fill column, one character wider per repetition unless a numeric increment is supplied. |
| `Fill Long Comment` | Named; Meta-Q in Lisp mode | Same; comment must begin at line start. |
| `Fill Long Comment Differently` | Absent | Meta-Shift-Q in Lisp mode. |
| `Grind Definition`, `Grind S-Expression`/`Grind Expression` | Named commands | Named `Grind Definition` and `Grind Expression`. |
| `Format Code` | Named; old Control-Meta-G binding commented out | Same. |

All three source lines also retain PDP-10 text-justifier compatibility commands:
Meta-# and Control-X # insert or move Control-F font markers around a word or
region, and Meta-_ / Control-X _ do the analogous underline markers. Their own
documentation says they work only for the PDP-10 text justifier R. They should
not be mistaken for native character-style formatting merely because they are
still in the Genera command table.

For the general editor architecture and complete release-bounded keymaps, see
[From EINE to ZWEI and Zmacs](lisp-machine-text-editors.md).

## Findings that the manuals alone do not establish

- System 46's core has no `FQUERY` or spell subsystem, only narrower yes/no
  functions.
- System 46's old `FORMAT` names conflict with later Common Lisp meanings:
  `~G` jumps and `~X` spaces.
- The maintained System 303 `FORMAT` source/docstring disagree about case and
  indentation controls. Archived older source and the live System 303-0
  dispatch contain them; the current selected component source does not.
- System 303 adds `FQUERY` timeout/default features omitted from its public
  query manual, while Genera later removes them.
- Maintained LM-3's active spelling path is local, despite a historical
  Chaosnet-Ispell implementation and a stale second-keybinding comment in the
  same tree.
- Genera's correction menu has no keyboard selection for suggestions or
  dictionaries, even though its four fixed keyboard actions work.
- Genera's convenience `Format Region`, `Format Buffer`, and `Format File`
  commands explicitly reject parsed Sage buffers/files and direct users toward
  Writer Tools and installed-record display.
- The Genera Bolio mode retains section recognition but comments out the old
  CADR font keys and word abbreviations.
- Genera's literal grinder handler table is narrower than the maintained LM-3
  table; later release numbering is not a proof of a strict feature superset.
- Legacy Control-F font and underline commands survive beside native character
  styles, but their source still limits them to a PDP-10 text-justifier syntax.

## Runtime observation: System 303-0 `FORMAT`

The fresh `format-probe-20260718t0800` generation-1 session cold-booted the
System 303-0 load band. The three date/time answers were `n`, `n`, and `n`,
declining the displayed default and then declining to specify another time.
Lisp Listener 1 entered package `USER` with the standard traditional-syntax
readtable.

The first inert listener form queried the live properties that `FORMAT` uses
to dispatch the opening parenthesis, Control-Y, and Control-X directive
characters. The control characters were constructed by numeric code rather
than injected literally:

```lisp
(list (get (intern "(" "FORMAT")
           (intern "FORMAT-CTL-MULTI-ARG" "FORMAT"))
      (get (intern (string (int-char 25.)) "FORMAT")
           (intern "FORMAT-CTL-MULTI-ARG" "FORMAT"))
      (get (intern (string (int-char 24.)) "FORMAT")
           (intern "FORMAT-CTL-NO-ARG" "FORMAT")))
```

The live result was:

```lisp
(FORMAT::FORMAT-CTL-START-CASE-CONVERT
 FORMAT::FORMAT-CTL-START-INDENT-CONVERT
 FORMAT::FORMAT-CTL-END-INDENT-CONVERT)
```

The second form exercised only string-producing case conversion:

```lisp
(list (format nil "~(Foo BAR~)")
      (format nil "~@(foo BAR~)")
      (format nil "~:(foo BAR~)")
      (format nil "~:@(foo BAR~)"))
```

It returned `("foo bar" "Foo bar" "Foo Bar" "FOO BAR")`. This confirms,
respectively, lowercase, capitalize-first-word, capitalize-every-word, and
uppercase behavior. Those names and effects match the retained older
`format.lisp.208` implementation. The current `format.lisp` retains the
docstring but not the three registrations. This is therefore a real
load-band/current-source divergence, not merely an ambiguous manual phrase.
The probe confirms that both indentation delimiter functions are installed;
it does not yet confirm their visible multiline cursor-column effect.

### Raw captures and screenshot disposition

Two 768 by 963 raw framebuffer captures retain the listener evidence under the
ignored session tree. They are not published in `docs/assets/`: the exact
results above carry the evidence, and a screenshot of the same listener text
would add no distinct interface, layout, or interaction claim proportionate to
publication. Other utilities on this page do have visible states, but they are
separate optional or licensed subsystems and are not inferred from this probe.

| Raw state | Timestamp (EDT) | PNG SHA-256 | Pixel SHA-256 | Sidecar SHA-256 |
| --- | --- | --- | --- | --- |
| live dispatch-property result | 2026-07-18 08:10:15 | `5bc300dc9b393d2cec0f77509cba4d9cc812bfeb04e910e43c71d8dae4c077ca` | `d6503e1bc21207a6c10d1982bbdf3f7b1d950d351ef5230cb70ed38ecf6865ce` | `d66eb966863109010c42edffbca33010ad2ea43e648d9f080f1e97ca810ee4b8` |
| four case-conversion results | 2026-07-18 08:10:59 | `2c4420e6aaada70f6aa8e030cfb0e00d13f2b91529aa488925c01cf97b95774b` | `1711c591bae5660165e76a6c8db1a6f3f230e707ad8fae667db76f4494ea762e` | `fbd5f00be4741348bfb7b473036cb9e78aa6bd9cdd2d55517fbef524a889b42e` |

The exact ordered guest input was `n` Return at each of the three date/time
questions, the dispatch-property form and Return, then the case-conversion form
and Return. Screenshots were captured after each form. The CADR harness does
not yet have the Genera harness's linked action ledger, so this article records
the ordered sequence explicitly.

### Portable run provenance

The run used display `:91`, XID 2097202, title `LOCAL-CADR [running]`, and a
768 by 963 framebuffer from 2026-07-18 08:08:12 through 08:11:20 EDT. The base
and fresh private disk began with SHA-256
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`.
The harness recorded the base as unchanged, and direct hashes of the private
disk both after the listener forms and after shutdown still matched that value.
The final `run.json` is 6,901 bytes with SHA-256
`22bad007c33b4a88f8af9250ff14f93a5e782f17b167b3b1a84342fabcb4df41`.

Public revisions at session start were `l`
`d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6`,
`system`
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
`usim`
`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`,
`usite`
`8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`,
and `chaos`
`db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`.
The private `system`, `usite`, and `chaos` copies were made at those same
revisions at 08:08:09 EDT and remained unchanged since copy. Their tree hashes
were, respectively,
`21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`,
`adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81`,
and
`34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87`.

`usim_sha256_at_start` and the separately recorded
`usim_sha256_at_exec` both equal
`707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`.
The private machine-artifact hashes were `promh.mcr`
`2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`,
`promh.sym`
`e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`,
and `ucadr.sym`
`9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a`.
The screenshot sidecars do not contain the execution-time `usim` hash; that
evidence is joined here from `run.json`.

Toolchain provenance used Guix commit
`230aa373f315f247852ee07dff34146e9b480aec`, manifest SHA-256
`3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`,
and Python 3.11.14. Shutdown was clean: `usim` and Xvfb both exited zero,
`forced_stop` is false, `state_may_be_incomplete` is false, and no session
process remained.

### Remaining runtime work

- **TODO:** load the optional local System 303 Ispell in a disposable Zmacs
  buffer and verify the suggestion menu, including the source-visible digit
  edge, without modifying a dictionary.
- **TODO:** in an isolated Genera session, format synthetic unlicensed text and
  capture only the minimal `Format Region` result and spelling-correction menu.
- **TODO:** enter `Show Font` or Font Editor using a system font without
  reproducing a font sheet, and verify the visible labels described here.
- **TODO:** exercise the System 303 indentation region against a synthetic
  multiline string on a cursor-position-aware stream.

Any selected image requires its own review under
[Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md),
portable harness provenance, and a substantive evidentiary use. Raw captures
must remain in the ignored session trees. A font specimen or extracted glyph
sheet is not a runtime screenshot and remains governed by the separate font
recovery/redistribution rules.

## Local artifact provenance

The following identities permit the static audit to be reproduced without
publishing licensed contents or machine-specific absolute paths.

### Public System 46 files

All paths are relative to the pinned `mit-cadr-system-software` source tree.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lmio/format.144` | 43,806 | `ec91ee2e6a6e376c77f58fd86642ade27f0859b5bfea31909f68c705be295308` |
| `src/lmio/grind.107` | 27,336 | `e96b0d546836f37ea1851645bab0e74a7d78863f208b432ecea455373ee92b5b` |
| `src/lmio/dribbl.23` | 2,350 | `cfd3acca272bfc70374891cb910b63d3a9627ae36633075e336381c032226726` |
| `src/lispm/lfl.192` | 15,463 | `b2da667d3bf2bd211717accfc984fbdf01309912155815d0bc32e3ca05901759` |
| `src/lispm/qmisc.281` | 62,028 | `ed80c13e4d51f5d9b3132a8f193673f081f25d310835087c40cc8c9b08d063ad` |
| `src/nzwei/comb.45` | 34,845 | `a15f167153804be85a521f91cd5ef021b76c5007a87f2f0950cf9c1b1cbb1cda` |
| `src/nzwei/come.58` | 23,081 | `0c204b6ada9a061b5baa0c649c40a8cc3361eb9cf441de5df4b1544361adefd7` |
| `src/nzwei/modes.49` | 43,268 | `0ffe92950723424a86b4c95c2da8e8187c5f8be11031df3321e278e6cb715965` |
| `src/nzwei/comtab.115` | 42,847 | `a40bcc9389cad426faf50ee7aaa507e40c569c90226ba5f53115b53f5f316834` |
| `src/lmio1/press.46` | 33,389 | `60ede993769d42ac56289ccac835da01a7d5587b7ad601414ab32aae6825c8a8` |
| `src/lmio1/xgp.21` | 7,943 | `c7e9eb812be4c7363c622628c27bd3b927629607e922327073a51d36c6209dfc` |
| `src/lmman/fd_str.65` | 43,141 | `1915e27130fca4931accd4b9948116cb39aa71fe5eb970461a83f97a6f5a519b` |
| `src/lmman/title.20` | 2,569 | `3e1a76100f15c9cf4101276105bfae4655bf5bef495adfd6277ce9ad7c553dbb` |

### Public maintained LM-3 files

All paths are relative to the `sys` Fossil checkout at the pinned System 303
check-in.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `io/format.lisp` | 70,507 | `7225d3fe5bf532c663b7c5237e1c84ae8341dd55b813ee1cd34cce55ff3cefda` |
| `io/format.lisp.208` | 75,716 | `61e169a01940af66c9b34cd91d2273ffb62ccba42662c95f2aa4558ccad2a429` |
| `io/format-macro.lisp` | 20,325 | `f4aa43e26bf57f40523c6dd21d3a9da455f6c77ce07315853d7897b82a89da61` |
| `io1/output.lisp` | 22,859 | `2df06e999ab790a1725b99e3e06234f0212e9b120d3416cbe4a7a6645bc6c60c` |
| `io1/fquery.lisp` | 15,618 | `3e4a519f9a0f44f87db2c6e594cb21a9bca5cde983df21fbdf9e6237fffdcf23` |
| `io/grind.lisp` | 40,910 | `669d18daca11b37209358813e8c054aaba64bb856e3a5f0c041388b9330febde` |
| `io/dribbl.lisp` | 5,930 | `2e71745cc350b9d94613338e4239f8fb77a321d74df5b59b467b79cf31ec07f9` |
| `io1/hardcopy.lisp` | 8,040 | `e3e38c09e024cb958c00c6f2432f3a8b22389bb0838dc50862d662d267e3a5e9` |
| `io1/press.lisp` | 61,017 | `8259b3782dca69d27ce505921d34a01db126f15d8e3c4d62aa56888681e85341` |
| `io1/xgp.lisp` | 8,473 | `ae3e385e1a6209e33ac6046e60548b03c23fbc10560f97a6389067ed45b3cab8` |
| `sys/sysdcl.lisp` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` |
| `zwei/new-ispell.lisp` | 7,436 | `a1e627cec864c48123f09f0534bcd9c341ca8ec1dc7ae9498b6a0d3d4fb62d47` |
| `zwei/spell-check.lisp` | 50,002 | `883b600c569234915558113c01c1df8cb1ef8884cc83b52547e80a876238d3a6` |
| `zwei/ispell.lisp` | 17,218 | `a271f2f18478c31a0e079ae19a1d12eebbe803da5531ec762de3b0067d2033f3` |
| `zwei/comtab.lisp` | 64,703 | `5e54ab5e70fd7e2e6086fb16d8a83efe27d65173abeaa78e0825804b3866e600` |
| `zwei/comb.lisp` | 43,168 | `0d7978fc5a44ad95dda7c58cd91448386d331d3c5d8845a16a367f571427f671` |
| `zwei/come.lisp` | 23,399 | `702f0e53f1306f9781d355250d63e682eda69717f4baf773561e3982de8fb978` |
| `zwei/modes.lisp` | 68,224 | `732303cda32a8c931ae4f112b7f54d3803a49e2c8206f90e39759235bcad975a` |
| `man/fd-fio.text` | 47,789 | `419d720843f0e344040e37385afa0c1bc3fb6cd757edf4067d82cdaa2265959a` |
| `man/query.text` | 10,075 | `3f818b5a518d21537be97bc535c3a748739905f9e1ba5b5cd49693a540252c1c` |
| `man/title.text` | 2,995 | `93c61053fac233c8dccd84852cfd656109dd8f9dc84a4f755b413b2bb5780495` |
| `man/manual.lisp` | 9,623 | `69c38fe9d5448544314a672c2a275a54bb1b8590da7be98f35a2899921ce96ec` |

### Licensed Genera files

These are archive-relative logical paths under the purchased `og2/sys.sct`.
They are local evidence only.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `io/format.lisp.~369~` | 91,024 | `ae5135cf2be3af4741093ea7f8e885259927d9aaa32555c7fa292553eb112249` |
| `io1/fquery.lisp.~104~` | 13,320 | `022823ae8dddbf64c598ab59bde00945c9b5e621191617b1374a84f020730e0f` |
| `io/grind.lisp.~158~` | 35,324 | `e25374d9a1d50644181923ff92e02616f4e539568792a979d0d217d894cd0ae9` |
| `io/dribbl.lisp.~54~` | 11,068 | `282184f8e3a9b2215b8315e821e2d3f650b897720734b19f80f67041b400d22b` |
| `clcp/more-functions.lisp.~152~` | 26,717 | `cb2b5b6a30d61ec8e72b3275449e94ffb4b2cea3d7bd2c8ff06d12e01f8057fb` |
| `clcp/ansi-syntax.lisp.~54~` | 44,999 | `bd9e38fa9d2009834c42b666fc06d27a0c8c54a511113fca9f7f6fe99a123a8a` |
| `io1/spell-core.lisp.~4015~` | 30,538 | `6355a2235a3a9e73e78812858805b856662db144884d18b10f4e008c1f9344da` |
| `io1/spell-interface.lisp.~4040~` | 55,647 | `4a07c1387c2ef0629b151b0a6c61fdbc297db6ffa20164fceeeec99ab83e2771` |
| `nsage/commands.lisp.~75~` | 49,298 | `83910bba318a23c2e532c4e4b6d5ff1749b8d89239f40b7de975fb7c08bfdabe` |
| `nsage/sage-ui.lisp.~287~` | 24,922 | `af2f4a124bdfdaa14625c8758829cbe7edf516ba65030d61b5197ea64247773a` |
| `io1/bfd-misc.lisp.~1521~` | 31,955 | `51f7abfb588509ad0395481791c9809f8e8c94f84e9b86c1cd8041fbdedb7feb` |
| `bitmap-editor/font-editor.lisp.~124~` | 33,589 | `ebe1564d4523c899eeb6229f085e0945c07f30a0010230e8c82914204864a8a6` |
| `zwei/comb.lisp.~190~` | 59,703 | `3fae5ef6b7bde72add9ed791ef71d17afd02f7f5c377296e7626b227c108e5f0` |
| `zwei/come.lisp.~208~` | 31,996 | `6318de252c34c77ee3a14ef6b59e0bf399095970a62106de5d63a47c63635597` |
| `zwei/comtab.lisp.~589~` | 100,220 | `5101f5a25a7222d6d0f8f48401522fa418576eb27d145f659513eb80660ca2b1` |
| `zwei/text-modes.lisp.~27~` | 12,414 | `34c9bdec02ab8e8c7229c4303c48b59e28df8369f09253333b1eb6e4b0919020` |
| `zwei/style.lisp.~123~` | 49,844 | `14425902c9cc283588127f811dbcb87004197d40e34a0e19e9fe91fd17f592ca` |
| `zwei/attributes.lisp.~15~` | 47,274 | `7b4cf251d52cfd7761c0db51d239bfb1b6a8dcc0c1ea93f653cce401eccbf5a5` |

The ignored Help catalog contains 801 decoded files and 17,266 records, with
18,931,775 embedded byte-array bytes. Its catalog is 577,696 bytes,
SHA-256 `a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed`.
The 9,817,347-byte inert Lisp-source Help inventory has SHA-256
`8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190`.
Relevant decoded outputs were `zmacs2.txt` (39,036 bytes,
`b291133739281560c54cae6d9bfffd04b1c4532445dd8668c72fa5b14fab0990`),
`zmacs21.txt` (19,746 bytes,
`fbc439b0095d14e2c813a1689586599c599a963c1d02aa106cc88935baa3817d`),
and `zmacs22.txt` (28,223 bytes,
`2bbeef2534bf596e20beea8aab6088a81122f517d37fcf9ca9a0eb9b1413ce6f`).
All remain under ignored `build/help/genera/` and are not linked as publishable
licensed documentation.

## Sources

- MIT CADR System 46, [FORMAT source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/format.144),
  [grinder source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/grind.107),
  [dribble source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/dribbl.23), and
  [Bolio-mode source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/modes.49),
  revision `8e978d7`; verified 2026-07-18.
- MIT CADR System 46, [manual title and production note](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/title.20),
  [formatted-I/O manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/fd_str.65),
  [single-character query source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/lfl.192), and
  [line query source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281),
  verified 2026-07-18.
- MIT CADR System 46, ZWEI [filling and grinder commands](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comb.45),
  [text-justifier compatibility controls](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/come.58), and
  [standard command table](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/comtab.115),
  verified 2026-07-18.
- LM-3 System 303, [current FORMAT component](https://tumbleweed.nu/r/lm-3/file/l/sys/io/format.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [retained FORMAT revision 208](https://tumbleweed.nu/r/lm-3/file/l/sys/io/format.lisp.208?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [FQUERY](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/fquery.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [grinder](https://tumbleweed.nu/r/lm-3/file/l/sys/io/grind.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [dribble](https://tumbleweed.nu/r/lm-3/file/l/sys/io/dribbl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [local spelling checker](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/spell-check.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303, [`FORMAT:OUTPUT`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/output.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`FORMAT-MACRO`](https://tumbleweed.nu/r/lm-3/file/l/sys/io/format-macro.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [ZWEI Ispell interface](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/new-ispell.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [system declaration](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303, [formatted I/O manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/fd-fio.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and [query manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/query.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  verified 2026-07-18.
- Symbolics, [Symbolics Common Lisp: Programming Constructs](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Common_Lisp_Programming_Constructs.pdf),
  especially the formatted-output chapter; verified 2026-07-18.
- Symbolics, [Editing and Mail](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  especially the formatting, character-style, and spelling chapters; verified
  2026-07-18.
- Symbolics, [Program Development Utilities](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf),
  especially the advice and definition-display material; verified 2026-07-18.
- Symbolics, [Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf),
  especially the Document Examiner overview; verified 2026-07-18.
