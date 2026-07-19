---
type: Artifact Analysis
title: Compiler Tools, grammars, lexers, and the Syntax Editor in Genera
description: An evidence-graded study of the shared Symbolics foreign-language compiler substrate, context-free grammar and parser packages, lexer, and syntax-directed Zmacs editing framework.
tags: [genera, compiler-tools, parser, lexer, syntax-editor, zmacs, symbolics-c, symbolics-pascal, preservation]
timestamp: 2026-07-18T10:02:00-04:00
---

# Compiler Tools, grammars, lexers, and the Syntax Editor in Genera

## Conclusion

Genera's `Compiler Tools`, context-free grammar, LALR(1), LL(1), lexer, and
Syntax Editor systems are a coherent language-toolchain substrate, not six
unrelated end-user programs. Together they let a language product describe
tokens and grammar, build compact parsing machinery, retain an incremental
syntax model of a Zmacs buffer, and share compiler and debugger abstractions
across Symbolics C, Fortran, and Pascal.

The stack has four broad layers:

1. **Compiler Tools (`CTS`)** supplies language-neutral compiler
   representations, control-flow graphs, data-flow and temporary/register
   allocation machinery, source-location records, include-file caching,
   machine-dependent stack accounting, and a debugger bridge for non-Lisp
   values and mixed-language frames.
2. **Context Free Grammar, LALR 1, and LL-1** represent terminals,
   nonterminals, productions, dialects, FIRST/FOLLOW and nullability data, then
   build or execute table-driven bottom-up and predictive parsers.
3. **Lexer Runtime** executes a compact table-driven finite-state lexer with
   actions, regular-expression descriptions, lookahead, skipped tokens, and
   serialized lexer objects. Its editor support preserves tokenization state
   across Zmacs lines.
4. **Syntax Editor** combines the LL(1) parser and editor lexer with Zmacs. It
   maintains tokens, parse trees, error positions, section boundaries,
   templates, construct-aware movement and deletion, indentation, and electric
   face/case transformations without forbidding temporarily invalid text.

“Syntax Editor” is therefore not a separate screen editor competing with
Zmacs. It is a set of ZWEI mixins, buffer structures, commands, and language
hooks used by C and Pascal modes. The manuals expose it through those modes;
the source media exposes the reusable machinery beneath them.

All thirteen named systems are present on the inspected licensed Open Genera
release media, but a fresh isolated Genera 8.5 world reported every one as
unloaded. The `CTS`, `GRAMMAR`, and `LEXER` packages were likewise absent while
the ordinary `ZWEI` package was present. No optional system was loaded, no
grammar was compiled, and no file was written. This page consequently describes
the installed product from declarations, compiled-object inspection, and public
language manuals, while keeping live operation as an explicit follow-up.

## What this dossier does and does not cover

This page documents the common implementation layer. The language products
that consume it have their own user interfaces, compiler options, listeners,
debugger commands, and foreign-function conventions; see
[Symbolics C, Fortran, and Pascal](symbolics-c-fortran-and-pascal-environments.md) when that
dossier is available. The ordinary Lisp compiler and Zmacs editor are covered
separately in [Lisp runtime, compiler, and development environment](lisp-runtime-compiler-and-development-environment.md)
and [Lisp-machine text editors](lisp-machine-text-editors.md).

The names also need a boundary:

| Name | Meaning in this page | Not the same as |
| --- | --- | --- |
| Compiler Tools | Shared foreign-language compiler and debugger substrate, package nickname `CTS` | Genera's ordinary Lisp compiler user interface |
| Context Free Grammar | Grammar object model and common compressed-table utilities | One particular C or Pascal grammar |
| LALR 1 | Bottom-up parser support over the common grammar model | The LL(1) editor parser |
| LL-1 | Predictive parser support and editor-oriented parsing hooks | A claim that every supported language is globally LL(1) |
| Lexer Runtime | Reusable token recognizer and serialized lexer support | The Common Lisp reader or Zmacs's simple Lisp scanner |
| Syntax Editor | Syntax-aware Zmacs extension framework | A stand-alone application frame or a source-code pretty-printer alone |

## Evidence classes

- **System declarations** are readable licensed files in the inspected Open
  Genera media. They establish names, dependencies, distribution flags, and
  module order. This page publishes analysis and short identifiers, not the
  proprietary source.
- **Compiled-object inspection** means inert string and symbol census of the
  shipped VBIN files. It establishes that named structures and operations occur
  in those objects. It is not decompilation and does not prove every control-flow
  detail.
- **System-directory records** establish release versions and the source-world
  context. Adjacent generated records sometimes disagree about whether another
  subsystem was marked `Experimental`; those adjectives are reported as
  record-local state rather than flattened into a universal product status.
- **Manual evidence** comes from the public archival *User's Guide to Symbolics
  C* and *User's Guide to the Pascal Tool Kit*. Their C and Pascal editor-mode
  chapters document the user-facing behavior of the shared Syntax Editor.
- **Runtime observation** means the fresh, read-only 2026-07-18 Xvfb/VLM
  session described below. It establishes only the load state of that exact
  Genera 8.5 world.
- **Public CADR comparison** uses the pinned public MIT CADR source tree. An
  absence claim is limited to the searched revision and named facilities.

## Release-media identity

The inspected system-directory record for Syntax Editor Support was written on
1998-09-11 in a source world reporting System 452.18. It records the following
released versions:

| Layer | System-directory name | Released version | Declaration boundary |
| --- | --- | ---: | --- |
| Compiler | Compiler Tools Package | 434 | Package definition; unadvertised |
| Compiler | Compiler Tools Runtime | 434 | Optional source category; source and binaries distributed |
| Compiler | Compiler Tools Development | 435 | Restricted source category; source and binaries distributed |
| Debugger | Compiler Tools Debugger | 434 | Restricted source category; source and binaries distributed |
| Grammar | Context Free Grammar Package | 439 | Package definition; unadvertised |
| Grammar | Context Free Grammar | 439 | Restricted source category; source and binaries distributed |
| Parser | Lalr 1 | 434 | Restricted; binaries distributed, source not distributed |
| Parser | LL-1 support system | 438 | Restricted; binaries distributed, source not distributed |
| Lexer | Lexer Package | 438 | Package system; source and binaries distributed |
| Lexer | Lexer Runtime | 438 | Restricted; binaries distributed, source not distributed |
| Lexer | Minimal Lexer Runtime | 439 | Restricted; binaries distributed, source not distributed |
| Editor | Syntax Editor Runtime | 434 | Optional; source and binaries distributed |
| Editor | Syntax Editor Support | 434 | Restricted; source and binaries distributed |

Every declaration uses an empty or `nil` `advertised-in` value. That is strong
evidence that these are dependency systems rather than ordinary selectable
applications. It does not mean they were unused: the C and Pascal manuals expose
their behavior through language modes, and the language system declarations
depend on them.

Some generated system-directory headers call a neighboring component
`Experimental`, while the component's own later record lists it without that
word. For example, the LL-1 record presents Syntax Editor Support as released but
still calls LL-1 itself experimental in the source-world inventory. The stable
claims here are the numeric released versions and each component's own
declaration flags. A precise history of when each experimental designation was
added or removed remains a TODO.

### Local media census

The following manifests identify the inspected directories without publishing
their contents. Each aggregate hash was computed by sorting relative paths,
hashing every file, and then hashing that relative-content manifest.

| Media directory | Files | Bytes | Relative-content-manifest SHA-256 |
| --- | ---: | ---: | --- |
| Compiler Tools (`cts`) | 46 | 627,788 | `bc8de45d07c0770c22271816a7e55b4084d7ce5af8899cdfb2efa95e18000ae3` |
| Grammar and parsers (`cfg`) | 31 | 203,205 | `b3ca69f738edff58b19d265982b66b7fca6e1b12426fcf6190c7d9a292ad76b3` |
| Lexer | 23 | 103,117 | `66a2854ca6f6da5031e384100b034defe0f9f880b0c5d19e48161b5a4a8ab673` |
| Syntax Editor | 18 | 210,618 | `93bbc74e371e838a5e64b9b5681ed7d67295288ffd72588856e2b7e0164165e9` |

The directory mix matters. Compiler Tools contains readable declarations plus
compiled modules. The public package and system shells for CFG, Lexer, and
Syntax Editor are readable, but most implementation modules are compiled VBINs.
LALR(1), LL(1), and Lexer Runtime explicitly declare that their source is not
distributed. Claims about those implementations are therefore intentionally
coarser than claims about readable declarations.

## How the pieces fit together

The declared dependency direction is:

```text
Compiler Tools Runtime
        |
        +--> Compiler Tools Development --> Compiler Tools Debugger clients
        |                     |
        |                     +------------------------------+
        |                                                    |
Context Free Grammar --> LALR(1)                             |
        |                                                    |
        +--------------> LL(1) --> LL1 Editor Support -------+
                                      |                      |
Lexer Package --> Minimal Lexer Runtime                       |
        |              |                                     |
        +----------> Lexer Runtime --> Lexer Editor Support --+
                                                             |
Syntax Editor Runtime ---------------------------------------+
                                                             |
                         Syntax Editor Support <--------------+
                                      |
                             C and Pascal editor modes
```

The graph is not merely a packaging curiosity. It explains the product's
division of labor:

- a batch parser can use CFG, a lexer, and either parser without Zmacs;
- a small delivered program can use Minimal Lexer Runtime instead of the full
  regular-expression and serialization layer;
- the Syntax Editor Runtime supplies buffer sectionization behavior without
  pulling in the complete compiler-development stack;
- full Syntax Editor Support deliberately depends on Compiler Tools Development
  because language units, source definitions, compilation, and editor
  sectionization share compiler representations and source-location services.

## Compiler Tools (`CTS`)

### Three different load boundaries

Compiler Tools is split so a delivered foreign-language program need not carry
the entire compiler and debugger:

| System | Declared modules | Purpose established by the declaration and symbol census |
| --- | --- | --- |
| Package | `compiler-tools-package` | Defines the `COMPILER-TOOLS-SYSTEM` package, nickname and prefix `CTS`, and its shared public vocabulary. |
| Runtime | runtime definitions, libraries, keyword macros, system patches | Data and support needed by compiled foreign-language code and language runtimes. |
| Development | compiler definitions, flow definitions/language, representation, flow code/graph/bit operations, temporary binding, utilities, Lisp expansion, stack requirements, include cache, `cometh` | Compiler construction, analysis, allocation, source integration, and developer tools. |
| Debugger | definitions, conceptual types and variables, presentation types, language debugger, hybrid debugger, CTS hybrid methods, monitor types | Maps foreign-language types, variables, expressions, and frames into Genera's debugger and presentations. |

This separation is historically important. “Compiler runtime” does not mean a
compiler happens to be running; it is the support layer required by already
compiled language code. “Development” is the compiler-building and interactive
program-development layer. “Debugger” is a bridge into the shared Genera
debugger rather than an entirely separate crash monitor.

### Shared intermediate representation

The CTS package exports a large language-neutral vocabulary. The compiled
development modules add evidence for:

- compiler variables, statements, expressions, operators, fetch/store/address
  operations, semantic and implementation types, scopes, and source locations;
- language and machine dispatch, allowing one framework to specialize behavior
  by source language and target machine;
- basic blocks, predecessors, successors, exception scopes, conditional and
  unconditional branches, loop processing, graph simplification, and graph
  linearization;
- operator classes and operator sets with language-specific cost and method
  tables;
- liveness, definitions, exposed uses, variable lifetimes, roadblocks, register
  profitability, and assignment of register numbers;
- statement-to-time and time-to-statement maps used while allocating temporary
  names and retaining debugging correspondence;
- call-stack requirement estimation and machine stack-frame sizing;
- compiler phase timers and nested phase statistics;
- source-file names, source positions, PC-to-source intervals, and source
  definition records.

The evidence supports describing CTS as a compiler framework rather than one C
compiler with a misleadingly generic name. It does not prove that C, Fortran,
and Pascal take identical optimization paths or share every back-end phase.
Language-specific modules can add operators, representations, transformations,
and code generators.

### Include-file cache

The `include-cache` module is a manual-quiet but operationally significant CTS
facility. Its compiled object names cached include-file records, streams over
cached intervals, a cache lock, and commands to list, show, or clear included
files. This fits C and other conventional-language compilation, where repeatedly
reading header material could dominate an incremental compile.

The census establishes the facility and its command names; it does not establish
the precise invalidation rule for every remote file system. A future loaded
language session should test whether truename, file version, write date, or a
combination controls reuse.

### Debugger integration

The debugger modules model language values at a conceptual level rather than
forcing every value through a Lisp printer. Named facilities cover:

- aliases, arrays and array indices, files, pointers, records, routines, sets,
  strings, packed types, sizes, signatures, and return types;
- typed value presentation and type-name or detailed-type display;
- language-specific expression readers, evaluators, describers, and printers;
- argument and local-variable access in language frames;
- mixed or “hybrid” stack frames, frame visibility, source display, code
  display, and language-specific command tables.

This architecture explains how the ordinary Genera debugger can cross a boundary
between Lisp and compiled C or Pascal while retaining language-level types and
source locations. The language products still supply their concrete type systems,
debug information, expression syntax, and commands.

## Context Free Grammar

### Object model

The grammar system represents more than a list of productions. Its compiled
symbol vocabulary establishes:

- terminal and nonterminal objects and their enumerated ranges;
- production objects, left- and right-hand-side indexes, action parameters, and
  goal productions;
- named grammars, active dialects, and input syntax;
- FIRST and FOLLOW information and nullable nonterminals;
- matching blink terminals and error-permission data used by editor clients;
- approximate terminal, nonterminal, and production sets for incomplete input;
- maps between a grammar and its lexer.

The `GRAMMAR` package exports 17 names at this media boundary:
`COMB`, `COMB-COMB`, `COMB-COMB-INDEX-ARRAY`, `COMB-INDEX-ARRAY`,
`COMB-VALID-ENTRY-MATRIX`, `DEF-LBE`, `ERRORS`, `FASD-FLAVOR-METHOD`,
`FINTERN`, `ILLEGAL-LEXEME`, `LL-1`, `LL-1-GRAMMAR`, `SPARSE-AREF`,
`TREE-LEAF`, `TREE-NODE`, and `VALID-ENTRY-MATRIX`.

That export list is deliberately small relative to the internal vocabulary. It
suggests that clients build higher-level language descriptions through macros and
specialized grammar flavors rather than manipulating every table slot directly.

### Compact tables

The `COMB` and validity-matrix names recur in CFG, the parsers, and the lexer.
This is the classic compressed sparse-table arrangement in which one array holds
candidate values, an index array relocates a logical row, and a validity structure
distinguishes a true entry from an accidental collision. The same compact
representation is useful for parser action/goto tables and DFA transitions.

The source census establishes the family of representations and lookup names.
It does not justify claiming a particular table-packing algorithm or asymptotic
bound without reconstructing the compiled implementation.

### Dialects and editor metadata

CFG contains dialect, matching-blink-terminal, extended-syntax, and approximate-
grammar vocabulary. This is evidence that the grammar is not solely a batch
recognizer. A language can vary its accepted grammar by dialect and attach enough
metadata for editor error recovery, matching-construct feedback, and template
selection.

## LALR(1) support

LALR 1 is the bottom-up parser branch. Its system depends on Context Free Grammar
and loads definitions, parser, a test/try module, and FASD support. The compiled
objects name:

- states, start and goal states, transition and action tables;
- a parse stack, production actions, and production queues;
- token enumeration and lexer linkage;
- conflicts and error states;
- next-legal-token queries, error-context printing, syntax-error repair, and
  spelling-error search;
- serialized parser state including compact tables and self-mapping tables.

The presence of repair and next-legal-token machinery matters: this was not just
an accept-or-reject batch parser. It could explain or recover from an invalid
token stream and provide completion-oriented information to a client.

The shipped system declares binaries but no source. Accordingly, “LALR(1)” here
is the product's own name and intended parser class; this page does not claim to
have independently proved the lookahead-state-merging algorithm from machine
code.

## LL(1) support

LL-1 is the predictive-parser branch and the parser directly incorporated into
the Syntax Editor support graph. Its compiled objects name:

- parse and token stacks, parse rows, productions, and grammar goals;
- full and compact parse tables plus a feasibility table;
- next-legal-token and token-insertion operations;
- error nonterminals, error recovery, error reporting, and parse-error counts;
- start/finish hooks for a parse and for individual productions;
- editor parser modules layered on the ordinary parser.

The feasibility table and next-legal-token interface fit an interactive editor:
the client needs to know which continuations remain possible before the program is
complete. The editor-specific `ed` and `ed-parser` binaries are packaged in the
`LL1 Editor Support` subsystem rather than in the core LL-1 system, preserving a
batch/runtime boundary.

The name does not prove that an entire C or Pascal grammar is strictly LL(1) in
the simplest textbook sense. The binaries include repair, inserted-token, error-
nonterminal, and extended-syntax machinery, and a language may partition or
augment its grammar for editing. “LL-1 support system” is the warranted claim.

## Lexer Runtime

### Package, minimal driver, and full runtime

The lexer is split into three named systems:

| System | Contents | Intended boundary |
| --- | --- | --- |
| Lexer Package | Defines package `LEXER`, prefix `LEXER`, nickname `LX` | Names can be referenced before the implementation is loaded. |
| Minimal Lexer Runtime | Package plus minimal driver | Small delivered recognizer path. |
| Lexer Runtime | Package, definitions, lexer, regular expression, FASD, token, and minimal runtime | Full construction, execution, description, token, and serialization support. |

The full runtime's declaration orders the token module after the core lexer and
serialization support while also depending on the minimal runtime. This is not
evidence that the minimal driver has every full token object feature; it is
evidence of a deliberate delivery-size boundary.

### Recognition model

The compiled runtime describes a table-driven finite-state recognizer:

- a lexer has a name, start state, current state, terminal map, DFA transition
  arrays, active lexer, and optional sets of cooperating lexers;
- an input buffer has a cursor, size, last match, lookahead boundary, and growth
  path;
- transitions use the common `COMB`, index-array, and valid-entry matrix
  structures;
- actions can return a terminal, skip a token, continue lexing, or report an
  illegal lexeme;
- multiple-character lookahead can be backed up;
- regular-expression descriptions can be associated with states and named
  actions;
- lexer and parser terminal vocabularies are checked for consistency.

This supports the description “compiled regular-expression/DFA lexer,” but the
media census alone does not establish the complete source-language syntax of the
regular-expression notation. Recovering that notation with high confidence
requires installed documentation or a loaded development system.

### Editor lexer support

The `Lexer Editor Support` subsystem adds four modules: Zmacs lexer, FASD,
tokenizer, and multi-line tokenizer. Its compiled structures retain:

- pre- and post-lex states on a line;
- outgoing and previous states;
- line token lists and reusable syntactic-token objects;
- begin, middle, and end token terminals for tokens crossing line boundaries;
- incremental re-lexing from a changed line;
- a tokenizer tied to a context-free grammar.

This is a source-only insight not obvious from a basic key list. Multi-line
comments, strings, or other lexical constructs cannot be tokenized correctly by
starting every line in the initial state. The editor therefore carries lexical
state across line boundaries and can restart downstream tokenization when an edit
changes that state.

## Syntax Editor architecture

### Runtime mixins

The small Syntax Editor Runtime contains the source-readable sectionization
declaration. It defines a `SYNTAX-EDITOR-MIXIN` and related electric-formatting and
nested-function behavior for ZWEI buffers. This layer gives language modes a
shared buffer protocol without loading the parser generator, compiler
development system, and full template machinery.

The complete Syntax Editor Support system then loads:

1. grammar utilities and a parser adapter;
2. LL(1), Lexer Editor Support, and LL1 Editor Support;
3. program syntactic structures;
4. the Syntax Editor Runtime;
5. editor commands;
6. Compiler Tools Development and sectionization, in parallel with a
   sectionization checker;
7. templates and compiled grammar-flavor methods.

There is no frame or top-level application system in that declaration. The
user-visible surface is a syntax-aware Zmacs buffer.

### Incremental program representation

The compiled-object census reveals three related structures:

- **line tokens** associate syntactic tokens and lexical state with Zmacs lines;
- **parse trees** contain leaves, compound nodes, partial and broken trees,
  parent/child links, grammar symbols, errors, and token bounds;
- **section nodes** associate top-level language units with buffer intervals,
  presentations, modification ticks, and compilation/source operations.

The system compares buffer and sectionization ticks, collects old changed
sections, inserts and deletes section nodes, and can re-tokenize or re-parse only
affected portions. This is substantially more than repeatedly running a whole-file
parser after each keystroke.

The implementation also names representation-invariant checks, broken-tree
tests, random insertion/deletion tests, and a separate sectionization checker.
Those diagnostics show that incremental tree integrity was treated as a first-
class engineering problem.

### Invalid text is allowed

Both C and Pascal manuals make an important product-design point: the syntax-
directed editor retains ordinary Zmacs text editing and does not require the
buffer to remain legal or structurally complete. Syntax awareness becomes more
helpful as the program becomes more correct, but the editor does not trap the user
inside a rigid tree editor.

The compiled code supports that account with partial and broken parse trees,
approximate grammar sets, error tokens, inserted-token recovery, and quick parse-
error paths. Templates are ordinary buffer content with special token identity,
not an opaque external form that replaces the source file.

### Sections and language units

“Sectionization” divides the buffer into compiler-meaningful units and relates
them to source definitions. The common commands and manuals speak of language
constructs, expressions, definitions, and units rather than Lisp s-expressions.
For C, a definition can be a function or declaration-scale unit; for Pascal it
can be a procedure, function, or program-scale unit. Each language supplies the
concrete grammar and definition rules.

Because section nodes retain modification ticks and source relationships, the
same structure can support:

- navigation among definitions;
- compilation of changed definitions;
- syntax checking before save;
- source lookup and `Edit Definition` behavior;
- indentation and formatting of one construct rather than the whole buffer.

### Error behavior

The shared editor parses as text changes but does not continuously interrupt for
every error. The manuals identify four user-visible notification points:

1. explicit next- or previous-error commands;
2. compilation commands;
3. construct-aware deletion, which can mark the questionable region and ask
   before acting;
4. the `Line` command after entering a line.

One original mistake can create a cascade of later parse errors, so the manuals
recommend correcting from the first error. The source supports nearest-error
search in either direction and special numeric-argument behavior for the first or
last error.

## Complete common Syntax Editor interaction surface

The following tables combine the standard common command summary printed in the
C manual with the matching Pascal descriptions. Language-specific compiler and
mode commands belong in the language dossier. Key names retain Symbolics notation:
`c-` is Control, `m-` is Meta, and `sh-` is Shift.

### Movement and marking

| Key | Common action in a syntax-aware language buffer |
| --- | --- |
| `c-m-F` | Move to the end of the current or next language construct/unit. |
| `c-m-B` | Move to the beginning of the current or previous language construct/unit. |
| `c-m-A` | Move to the beginning of the current or previous language definition. |
| `c-m-E` | Move to the end of the current or next language definition. |
| `c-sh-F` | Move to the end of the current or next language expression. |
| `c-sh-B` | Move to the beginning of the current or previous language expression. |
| `c-m-H` | Move to the beginning of the current definition and mark the whole definition as the region. |
| `c-m-N` | Move to the next template item in the buffer. |
| `c-m-P` | Move to the previous template item in the buffer. |

Ordinary Zmacs character, word, line, page, buffer, region, search, and window
commands remain available. The syntax commands reinterpret the structural grain;
they do not replace the underlying text editor.

### Construct-aware deletion

| Key | Common action |
| --- | --- |
| `m-sh-X` | Delete the language expression to the left. |
| `c-sh-X` | Delete the language expression to the right. |
| `c-m-Rubout` | Delete the language construct to the left. |
| `c-m-K` | Delete the language construct to the right. |
| `c-sh-K` | Delete the language construct surrounding point. |
| `c-sh-T` | Delete the language token to the right. At a template item, remove that item. |
| `m-sh-T` | Delete the language token to the left. At a template item, remove that item. |

Deleted text goes through normal Zmacs kill/yank behavior. The parser can refuse an
unbalanced expression or warn before deleting a construct containing a syntax
error. These are syntax-aware safety checks, not proof that all destructive edits
are impossible.

### Error navigation

| Key | Common action |
| --- | --- |
| `c-sh-N` | Move to the nearest syntax error to the right; with a numeric argument, move to the last error in the buffer. |
| `c-sh-P` | Move to the nearest syntax error to the left; with a numeric argument, move to the first error in the buffer. |

### Templates and completion

| Key or command | Common action |
| --- | --- |
| `End` | Insert a matching syntactic template. If several constructs are valid, present a menu. |
| `c-End` | Insert the unique token or keyword that closes the construct to the left, when one can be determined. |
| `Complete` | Complete the preceding keyword or refine/fill the current template item. |
| `c-Help` | Present a menu of templates legal at point. Plain `Help` retains the ordinary Help facility. |
| `c-?` | List possible completions of a predeclared identifier immediately to the left; the identifier domain is language-specific. |
| `Space` at a template item | Remove the template item rather than inserting a space. |
| `m-X Remove Template Item` | Remove the next template item to the right. |
| `c-m-N` / `c-m-P` | Move among template items. |
| `c-sh-T` / `m-sh-T` at a template | Remove the adjacent template item. |

Templates can contain required, optional, and repeating items, distinguished
visually by their delimiters. They are written into the text buffer and can survive
a file write/read cycle. When typing begins at an item, the placeholder disappears
and ordinary source replaces it. This hybrid model preserves free text while
offering structured construction.

The template-choice menu has three documented mouse meanings:

| Button | Menu action |
| --- | --- |
| Left | Insert the selected template at point. |
| Middle | Temporarily display the template for inspection. |
| Right | Display documentation associated with the selected template or item. |

### Indentation and newline

| Key or command | Common action |
| --- | --- |
| `c-m-Q` | Correct indentation of the language structure following point. |
| `Line` | Indent the current line, create and move to a new line aligned to context, and report a syntax error found on the completed line. |
| `Tab` | Correct indentation of the current line and move to its first nonblank character. |
| `c-I` in the documented customization workflow | Record a changed indentation value for the construct at point after the user adjusts leading space. |
| `m-X Save Indentation` | Produce a Lisp form representing the current language indentation settings for later evaluation. |
| `m-X Indent Buffer` | Reindent the complete buffer using language syntax. This name is present in the implementation even though the compact standard-key table emphasizes line and construct operations. |

`c-m-Q` can have another ordinary Zmacs binding outside a syntax-aware language
mode. The language mode's local binding is the relevant one here.

### Electric face and case

| Command | Common action |
| --- | --- |
| `m-X Electric C Mode` / `m-X Electric Pascal Mode` | Toggle language-specific electric formatting in the current language buffer. |
| `m-X Adjust Face and Case` | Change face and case choices for syntactic contexts in the current buffer. |
| `m-X Format Language Region` | Apply current electric face/case rules to the region or current language unit; a numeric argument removes special faces while preserving case. |

The common mechanism distinguishes body text, reserved words, comments, and
template items. C and Pascal choose their own defaults. For example, the archived
C guide specifies lowercase bold reserved words, lowercase Roman body text,
unchanged-case italic comments, and unchanged-case Roman template items. Those are
C-mode defaults, not universal Syntax Editor rules.

The implementation contains an explicit default-changing interface and derives
styles from syntactic context. This means electric formatting is not merely a
keystroke macro that uppercases the last word; it operates after lexical/syntactic
classification and can reformat existing code.

### Matching constructs

`m-X Blink Matching Construct` toggles language-keyword matching in at least the
Pascal mode documented by the manual. When point follows a closing reserved word,
the matching opener can blink. The feature requires syntactically correct input.
Compiled Syntax Editor modules also name matching blink terminals and a global
toggle, showing that the common framework supports the behavior while each grammar
defines the matched terminals.

### File wrappers and checks

The implementation adds `Save Language File` and `Write Language File` wrappers
around ordinary file commands. Their named purpose is to check the buffer for
syntax errors before saving or writing. This is an additional source-visible layer
over ordinary `Save File` and `Write File`, not evidence that invalid buffers can
never be saved: the exact query/proceed policy needs a loaded system test.

## Source-visible commands beyond the compact manual table

An inert symbol census of `ed-commands` and its companion modules found the
following additional command families. Some are development diagnostics or tests,
not advertised everyday commands. Compiled string fragments sometimes append
encoding artifacts to symbol names, so the table reports normalized names only
when corroborated across modules or by a readable identifier.

| Family | Source-visible commands or operations | Interpretation |
| --- | --- | --- |
| Grammar identity | `Identify Grammar`, `Print Syntax Editor Grammar`, `LL Initialize` | Inspect or initialize the grammar/editor binding. |
| Parser diagnostics | `Print Program`, `Print Tokens`, `Parse Error Forward`, `Parse Error Backward` | Inspect the incremental representation and navigate failures. |
| Structure navigation | `Forward/Backward/Upward Language Construct`, `Forward/Backward Language Expression`, `Beginning/End of Language Definition` | Full command-name layer beneath the standard keys. |
| Editing | `Kill/Rubout Language Construct`, `Kill Language Construct Around Point`, `Kill/Rubout Language Expression`, `Delete/Rubout Language Token`, `Comment Out Language Region` | Structural editing beyond simple character operations. |
| Templates | `Overlay Template`, `Template Completions`, `Next/Previous Template Item`, `Remove Template Item`, `Close Language Construct` | Template insertion, refinement, navigation, and closure. |
| Layout | `Indent Line`, `Indent Newline`, `Indent Language Structure`, `Indent Buffer`, `Change Indentation`, `Save Indentation` | Shared layout and customization machinery. |
| Sections and definitions | `Sectionize Buffer`, `Edit Language Definition`, `Edit Definition and Other Definitions`, `Reposition Language Window` | Rebuild and navigate the compiler/editor unit map. |
| Documentation | `Show Language Documentation`, `Show Keyword Documentation for Language` | Language- and token-sensitive documentation entry points. |
| File wrappers | `Save Language File`, `Write Language File` | Syntax-checking file operations. |
| Integrity tests | `Demon Test`, `LBE Parse Tree Tests`, `LBE Type In Tests`, `LBE Check Representation Invariants` | Engineering tests for incremental parse/tree behavior. |

The raw `ed-commands` binary yielded 50 unique `COM-`-like strings, but that is
not a trustworthy command count: several include compiled-string suffixes, some
generic inherited commands appear in the object, and additional common commands
are defined in sectionization or templates modules. The warranted deliverable is
the complete public common interaction table above plus this source-only family
inventory, not a false exact total.

## Serialization and generated artifacts

CFG, both parser systems, the lexer, and the lexer editor support each include a
module named `fasd`. The compiled symbols name `FASD-FORM`, block writing,
load-time flavor lookup, and construction of a fasload pathname. Serialized state
includes:

- grammar and lexer links;
- compact `COMB` arrays and self-mapping tables;
- LALR state, transition, action, error, and repair tables;
- LL(1) parse and feasibility tables;
- lexer start states, transition data, keyword maps, skipped-token behavior, and
  state-to-regular-expression descriptions;
- editor-lexer begin/middle/end terminal information.

These are generated Lisp-machine compiled-data artifacts intended to be loaded
back into the Genera environment. They are meaningfully inspectable and in
principle recoverable at an object/symbol level, but they are not plain portable
grammar files and not virtual-machine snapshots. A FASD or VBIN can preserve
tables and executable initialization without preserving the original comments,
macro structure, grammar-source formatting, or generator implementation.

This distinction parallels the larger
[compiled-object and UNFASL](compiled-objects-qfasl-relocation-and-unfasl.md)
boundary: extraction can recover behaviorally relevant objects and names, but
does not recreate original source authorship or layout.

## Manual/source findings that are easy to miss

The manuals are strongest on user workflow; the media reveals several additional
architectural points:

1. The editor tracks lexical state across lines rather than tokenizing lines in
   isolation.
2. Parse trees can be partial, broken, or fragmented while still supporting
   editing.
3. Buffer and sectionization ticks permit incremental rebuilds of changed units.
4. Templates are syntactic tokens in ordinary text, not an external form model.
5. Grammar tables include approximation, feasibility, error-repair, and next-
   legal-token information useful before a program is valid.
6. Compiler Tools includes an include-file cache with interactive inspection and
   clearing commands.
7. The debugger is explicitly hybrid: it has hooks for language expressions,
   foreign conceptual types, Lisp frames, and mixed stack navigation.
8. Dedicated randomized tree-edit tests and representation-invariant checks were
   shipped with the implementation.
9. Syntax Editor Runtime is separable from full Support, allowing a language
   runtime or buffer to carry lighter sectionization behavior.
10. The product stores generated grammar, parser, and lexer objects through FASD
    rather than rebuilding every table from source on each load.

## Runtime study

Fresh isolated session `d38-language-tools-20260718`, generation 1, ran from
09:48:11 through 09:50:17 EDT on 2026-07-18. It used the repository's
[Genera Xvfb computer-use harness](genera/genera-computer-use-harness.md) and the
identified Genera 8.5 world, VLM, and debugger listed below.

The session performed two read-only evaluations:

1. it asked `SCT:GET-SYSTEM-VERSION` about all thirteen systems in the release-
   media table;
2. it looked up packages `CTS`, `GRAMMAR`, `LEXER`, and `ZWEI`.

Every system query returned `NIL`. The first three package lookups returned
`NIL`; `ZWEI` returned the resident editor package. This proves the language
toolchain layers were not loaded in that base world even though Zmacs itself was
present. It does not prove the media is unloadable or that another saved world
would omit them.

No optional system was loaded, no parser or editor mode was initialized, no file
was opened or written, and no world was saved. The base and private world SHA-256
both remained
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
The action log contains four intent/outcome records, is 2,500 bytes, and has
SHA-256 `10f5c10b8bba2becfd7ab327c561f6ab9e750d1bbab53ea8649a28a0d393d523`.

The VLM accepted its shutdown confirmation and began cleanup, then reached the
known bounded cleanup stall. The harness forced termination and recorded
`forced_after_confirmed_shutdown_stall: true`; this was not orderly VLM process
exit. No saved guest state was expected or retained.

### Screenshot decision

The raw session contains two Listener captures showing only the system and package
query results. They remain ignored local evidence. They were not selected for
publication because they do not show a visible language editor or toolchain
interaction and would merely duplicate the textual runtime record. A useful future
screenshot should show a loaded C or Pascal buffer with a syntax template, error
marker, or construct-aware operation; it must receive its own per-image rights
review before publication.

## Public CADR comparison

The pinned public MIT CADR source revision
[`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
contains the Lisp compiler, ZWEI's Lisp syntax scanner, indentation and structural
editing, reader finite-state machinery, and language-specific editing modes. A
case-insensitive search of that revision did not find systems or definitions named
Compiler Tools, Context Free Grammar, LALR, LL-1, Lexer Runtime, Syntax Editor, or
`DEF-LBE`.

That bounded absence supports a careful conclusion: the specific layered product
described here belongs to the later Symbolics Genera environment and should not be
retroactively assigned to System 46. CADR still had syntax-aware Lisp editing and
finite-state readers; those are functional ancestors or parallels at a broad
problem-domain level, not proof of direct subsystem lineage.

The LM-3 fossil should be checked separately for intermediate names or designs.
Until that search is complete, this page does not claim the exact first release or
lineage of CTS, CFG, or the Syntax Editor.

## Preservation and recovery implications

- Keep all recovered licensed VBIN, FASD, source, grammar, parser, and lexer data
  untracked. Only original analysis, tools, and evidence-only catalogs belong in
  the repository.
- Preserve the four media directories together. Syntax Editor Support cannot be
  understood fully from `syntax-editor` alone because it depends on CTS, CFG,
  LL(1), and lexer editor support.
- Preserve system declarations and system-directory files alongside compiled
  binaries. They retain dependency order, version history, aliases, source-
  distribution boundaries, and release status that symbol extraction cannot
  reconstruct reliably.
- Treat a symbol/string census as evidence of vocabulary, not recovered source.
  Compiled string artifacts, uninterned symbols, and generic inherited code can
  distort exact command counts.
- A future extractor could safely emit an evidence-only JSON inventory of systems,
  modules, exported names, and hashes without redistributing executable or grammar
  data. It must not emit reconstructed proprietary tables into tracked output.
- The most useful behavioral recovery target is a disposable loaded C or Pascal
  session. It can exercise template insertion, incremental errors, cross-line
  lexing, sectionized compilation, include-cache invalidation, and hybrid debugging
  without trying to treat the whole VLOD as a simple archive.

## Open questions

- TODO: load the licensed language systems in a throwaway world only after a
  reproducible, read-only guest media mount is available, then exercise the common
  commands in both C and Pascal modes.
- TODO: determine the exact source syntax accepted by the lexer regular-expression
  compiler and CFG/LBE declarations without reconstructing or publishing licensed
  grammar source.
- TODO: establish the precise include-cache invalidation rule on local and remote
  file systems.
- TODO: test how partial edits delimit incremental re-lexing, re-parsing, and
  sectionization, including multi-line comments and strings.
- TODO: record which common commands are exported for ordinary users and which are
  internal diagnostics in a loaded Syntax Editor Support world.
- TODO: inspect LM-3 fossils for an intermediate CTS, CFG, lexer, or syntax-editor
  lineage before making a first-release claim.
- TODO: capture and review a small, substantive syntax-template or error-navigation
  screenshot if a loaded language world becomes available.

## Artifact provenance

The purchased Open Genera archive is 206,213,430 bytes with SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
The runtime study used:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Genera-8-5.vlod` | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| `VLM_debugger` | 346,880 | `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| `genera` VLM | 1,533,760 | `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |

Representative readable declaration hashes are:

| Declaration | SHA-256 |
| --- | --- |
| Compiler Tools Development | `9e6463262a21eddf67cff3afa1fa6ed3c35282b0c018f064073901dedeb7909f` |
| Compiler Tools Runtime | `6a32cc906d132c41d473168afee3b250fbef10421b016624081e606b18df5a6b` |
| Compiler Tools Package | `1898d0478174ad971d395a65d0a8f2eb512e59875f684a8667256a61d03133d5` |
| Compiler Tools Debugger | `4fc0b737abc471a43c7cf4f8f23e74dc6dd7ab1171eede0387468d1d6ce05409` |
| Context Free Grammar | `168dd92c2f0f33ae3ffd8d505ec357e7829be6d4c42b8beda22e4f8186c8f579` |
| Context Free Grammar Package | `d4c0d0e6980b44ddda4aee92f8d820c962b0dbb5ad76ac4d83ee631f0384988c` |
| LALR 1 | `6ed83e7cee5a8774e5cd789a22d0338e56483aa7d7e8865ee144f44225b4d03c` |
| LL-1 | `700bd9df512bf1b51f9e62dcaae00577a9cd72a94ebf9d167806019ee3dec12f` |
| Lexer Package | `1cd2d8f33007f69d689972c22d6dbcc0e46d97775434b88b868df98007cc991e` |
| Lexer Runtime | `3b8e4729cbcba8f103d9954e48553f070faaf5e2e382c913452fdbe3825ed5f5` |
| Minimal Lexer Runtime | `6ccecafdfe67e43b56c2c0adf5dbc0b55404ab3d4fb2c648c48557ea838905e3` |
| Syntax Editor Runtime | `023debe5b47e312f35bfda3061b653b38801d729c3cb89cbd6a487864ebaef38` |
| Syntax Editor Support | `af241d7c9c2731e308232e4255e7b076ade91d0fc7809256a495e8a1934e82dd` |

The public C manual copy inspected locally is 543,959 bytes with SHA-256
`549baa34a6428feeff6c225492db64e6342e9684589c9b983c33ceac1b382db2`.
The Pascal Tool Kit guide is 607,569 bytes with SHA-256
`f9c2a855fc75eac23afd66d55dd1247fb828edfd8b361c14ee790cb2eacf8895`.

## Public sources

- Symbolics, [*User's Guide to Symbolics C*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/User_s_Guide_to_Symbolics_C.pdf), especially “C Editor Mode,” “C Mode Completion and Templates,” “Electric C Mode,” and “Summary of Standard Editor Mode Commands.”
- Symbolics, [*User's Guide to the Pascal Tool Kit*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/User_s_Guide_to_the_Pascal_Tool_Kit.pdf), especially “Pascal Editor Mode,” “Template and Completion Commands,” and “Electric Pascal Mode.”
- MIT CADR System Software, [public source revision `8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src), used only for the bounded comparison above.

Last verified: 2026-07-18.
