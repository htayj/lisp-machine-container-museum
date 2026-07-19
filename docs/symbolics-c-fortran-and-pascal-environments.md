---
type: Historical Article
title: Symbolics C, FORTRAN, and Pascal environments
description: An evidence-bounded guide to the three Genera language products, including their compiler architecture, Zmacs interfaces, commands, interoperation with Lisp, limits, and preservation status.
tags: [genera, symbolics-c, fortran, pascal, compiler, zmacs, debugger, preservation]
timestamp: 2026-07-18T09:56:15-04:00
---

# Symbolics C, FORTRAN, and Pascal environments

Symbolics C, Symbolics FORTRAN, and the Pascal Tool Kit were not conventional
cross-compilers bolted onto a Lisp Machine. Each was an integrated Genera
development product: a language front end translated source into Lisp-level
compiler input, the ordinary Genera compiler produced native code, Zmacs knew
the language, and the resulting definitions participated in the same packages,
debugger, call trees, systems, and virtual memory as Lisp definitions.

That integration is also the main preservation difficulty. The purchased Open
Genera media inspected here contains the three products, their on-line books,
system declarations, and compiled implementation modules, but the museum's
base Genera 8.5 world has none of their packages loaded. This page can therefore
establish architecture, files, commands, documented behavior, and source-visible
facts at high confidence. It cannot yet confirm the visible editor modes,
listeners, debuggers, or exact effective command tables in a running installed
product. Those runtime gaps are marked explicitly.

This is one dossier covering three separately sold or versioned environments.
It does not treat the C-like, FORTRAN-like, Pascal-like, PL/I, MIDAS, TECO, or
Macsyma *editor modes* found in another Lisp-machine source tree as evidence
that the corresponding language product was installed.

## Evidence and release boundary

The principal documentary witnesses are the public Genera 8 manuals, the
licensed but untracked Open Genera media, recovered on-line Help metadata, and
one isolated Genera 8.5 runtime probe. Version labels in those witnesses do not
form one simple sequence:

| Product | Manual identity | Inspected media system versions | What the number means |
| --- | --- | --- | --- |
| Symbolics C | The registered on-line book says C 1.2 on Genera 8.0. A bundled C 1.1 release note says the older guide described 1.0 and that on-line material was being updated for 1.1. | C 440; C-RUNTIME 438; C-PACKAGES 436; C-DOCUMENTATION released 426/latest 427; C-LIBRARY-HEADERS latest 434. | The 4xx numbers are Genera system-component versions, not C product release numbers. |
| Symbolics FORTRAN | Symbolics FORTRAN 6.1 on Genera 8.0. | FORTRAN 434; FORTRAN-RUNTIME 434; FORTRAN-PACKAGE 434; FORTRAN-DOC released 427/latest 428. | The manual-to-system-version mapping is not stated in the inspected declarations. |
| Pascal Tool Kit | The book registration says 5.2 on Genera 8.0, while its units chapter calls the units facility a Release 6.0 replacement for 5.2 separate compilation. | PASCAL 433; PASCAL-RUNTIME 434; PASCAL-PACKAGE 434; PASCAL-DOC 427. | The inspected evidence does not establish whether system PASCAL 433 should be called product 5.2 or 6.0. |

These mismatches matter. A command described in the manual may belong to a
nearby product revision, and an editorial status note may have survived after
an implementation changed. The inventories below therefore say whether a
claim comes from the book, a system declaration, compiled-media metadata,
decoded Help, or runtime observation.

“Complete command inventory” here means every language-specific user command
or binding found in the audited manuals, on-line Help records, and system
declarations. It does not include every inherited global Zmacs, Command
Processor, or debugger command, nor site or patch additions. For the shared
editor and debugger substrate, see [From EINE to ZWEI and Zmacs](lisp-machine-text-editors.md)
and [Tracing, stepping, breakpoints, and call analysis](trace-stepper-breakpoints-and-call-analysis.md).

## One compiler architecture, three front ends

All three products use Compiler Tools and the ordinary Lisp compiler:

~~~text
language source
    -> lexer, parser, and language semantic front end
    -> generated Lisp compiler input and source metadata
    -> Genera Lisp compiler
    -> native compiled definitions in the running world
~~~

This explains several traits which otherwise look unusual to a Unix reader:

- there is no separate traditional linker pass;
- compiling one routine can immediately replace its definition in the live
  world;
- the language debugger can recover source names and types from compiler
  metadata;
- a program is an executable call tree or environment, not merely one host
  executable file;
- Lisp and foreign-language routines can call one another without a separate
  operating-system process boundary; and
- a stripped run-time-only configuration can execute compiled code but lacks
  the compiler and most incremental-development metadata.

The common machinery is described more generally in
[The Lisp runtime, compiler, and development environment](lisp-runtime-compiler-and-development-environment.md),
[Compiler Tools, grammars, lexers, and the syntax editor](compiler-tools-grammar-lexer-and-syntax-editor.md),
and [System construction, patches, worlds, and distribution](system-construction-patches-worlds-and-distribution.md).

### Files and compiled products

| Language | Source suffixes accepted by the documented environment | User compilation output | Files visible in the inspected Open Genera media |
| --- | --- | --- | --- |
| C | .c; include files conventionally .h | .bin, or .ibin for Ivory code according to the C guide | Versioned .vbin implementation modules, plain header files, Lisp system declarations, and .sab documentation |
| FORTRAN | .fortran, .for, .ftn | Lisp compiled-code .bin files | Versioned .vbin implementation modules, Lisp system declarations, and .sab documentation |
| Pascal | .pascal, .pas | Lisp compiled-code .bin files | Versioned .vbin implementation modules, Lisp system declarations, and .sab documentation |

A media .vbin is a versioned compiled Genera module; it is not evidence that
the product's original implementation source was distributed. A .sab is a
compiled documentation payload. Neither is a VM snapshot. The VLOD world holds
the live Lisp-machine state into which these systems can be loaded, while the
language source and binary files remain normal Genera file-system artifacts.

### Development, RTO, and run-time configurations

The manuals distinguish a development configuration from a run-time-only
(RTO) configuration. A development BIN retains source-level and incremental
compilation information. An RTO BIN keeps executable code under the same file
extension but strips information needed by the language debugger and some
incremental recompilation. A run-time system can load and execute suitable
BINs, but cannot compile source or provide the full language-level debugger.

For C, compiling an individual RTO function is safe only after its file or
buffer has established the necessary external environment. FORTRAN and Pascal
have the analogous requirement that external declarations and initialization
context precede an isolated routine. The practical preservation target is
therefore not just “a BIN which loads”: it is the compiler product, package and
runtime systems, headers or libraries, system definitions, and the metadata
needed to reconstruct the call tree.

## The shared C and Pascal syntax editor

C and Pascal use the Compiler Tools syntax-editor substrate. It knows grammar
constructs and templates rather than treating source as undifferentiated text.
FORTRAN uses a separate fixed-format mode described later.

The following bindings are common to the documented C and Pascal environments.
The key names use Lisp Machine spelling; “right” and “left” describe movement
relative to point.

| Key | Operation |
| --- | --- |
| Control-Meta-F / Control-Meta-B | Move to the next or previous language unit. |
| Control-Meta-A / Control-Meta-E | Move to the beginning or end of the current definition. |
| Control-Shift-F / Control-Shift-B | Move right or left by language expression or token. |
| Control-Meta-H | Mark the current definition. |
| Meta-Shift-X / Control-Shift-X | Delete the expression to the left or right. |
| Control-Meta-Rubout / Control-Meta-K | Delete the grammar construct to the left or right. |
| Control-Shift-K | Delete the grammar construct surrounding point. |
| Control-Shift-T / Meta-Shift-T | Delete the next or previous token; in a template, delete the adjacent template item. |
| Control-Shift-N / Control-Shift-P | Find the next/right or previous/left syntax error. A numeric argument selects the last or first error respectively. |
| End | Insert the closure matching the construct to the right. |
| Control-End | Insert the unique closure implied by the construct to the left. |
| Complete | Complete a keyword or syntax template. |
| Control-Help | Show valid templates at point. |
| Control-? | Show applicable predeclared names. |
| Space or Meta-X Remove Template Item | Remove the current template item when point is in a template. |
| Control-Meta-N / Control-Meta-P | Move to the next or previous template position. |
| Control-Meta-Q | Correct the structure of the containing construct. |
| Line | Open a new line and indent it according to syntax. |
| Tab | Reindent the current line. |

The language-mode command set also contains:

| Command | Purpose and evidence boundary |
| --- | --- |
| Adjust Face and Case | Apply the configured case and face conventions. The C summary itself says this did not work at the time represented by that record; runtime confirmation is pending. |
| Blink Matching Construct | Temporarily identify the syntactically matching construct. |
| Electric C Mode / Electric Pascal Mode | Enable syntax-aware insertion, templates, case, faces, and indentation for the selected language. |
| Format Language Region | Reformat the selected source. A numeric argument removes faces according to the manuals. |
| Reparse Attribute List | Recompute the buffer's parsed definition attributes. |
| Update Attribute List | Refresh the language attribute list after edits. |
| Save Indentation | Emit a Lisp form which recreates the current indentation choices. |

Space or Rubout at a construct boundary, followed by Control-I, changes the
global indentation associated with that grammar relationship. The function
ZWEI:CHANGE-SYNTAX-EDITOR-DEFAULTS controls case, character style,
indentation, and—in Pascal—the dialect defaults.

The manuals' displayed Electric-mode tables say that C body and reserved words
default to lower case, with reserved words bold; Pascal body defaults lower
case and reserved words upper-case bold. Both show comments as leave-alone
italic and templates as leave-alone Roman. Recovered API records disagree:
they report an upper-case body default, and the Pascal record separately
reports lower-case predeclared names. This is a genuine documentary conflict,
not a choice made by this article. The available case operations are upper,
lower, capitalize, capitalize words, and leave alone; comment case is not
changeable through that facility.

## Symbolics C

### Identity and implementation

Symbolics C targets the draft ANSI X3.159-198x language described by its guide,
not a later finalized ISO C revision. The source system declaration dates the
product to 1986. Its development system depends on C Runtime, Compiler Tools
development and debugger support, lexer/LALR machinery, the C editor, library
headers, and documentation.

The inspected declaration is revealing about source distribution. The compiler
and editor systems are marked not to distribute implementation source, while C
Runtime is marked to distribute source. The media accordingly exposes Lisp
runtime source and ordinary header files but keeps the compiler/editor proper
as compiled .vbin modules. This makes C more source-visible than the other two
products without making it an open-source compiler.

### Zmacs modes, bindings, and named commands

The C product documents three editing levels:

- C Fundamental Mode supplies a compiler-oriented lexical subset without
  syntax templates;
- C Mode supplies the language major mode; and
- Electric C Mode enables the full syntax-aware behavior.

In addition to the shared syntax-editor keys, C defines:

| Key or command | Effect |
| --- | --- |
| Control-Shift-C / Compile Region | Compile the current region, or the containing definition when there is no active region according to the command context. |
| Meta-Shift-C / Compile Changed Definitions of Buffer | Compile definitions in the current buffer whose recorded source has changed. A numeric argument requests confirmation. |
| Control-Meta-Q / Format Language Region | Reformat the language region; this overlaps the shared syntax-editor binding. |
| Control-Meta-H / Mark C Definition | Mark the current C definition. |
| Meta-. / Edit C Definition | Find the source definition of a C name. |
| Compile and Execute C Function | Compile the selected function and execute it. |
| Compile Buffer | Compile the buffer; with a numeric argument, begin at point. |
| Compile File | Compile the disk file, not merely the current modified buffer. |
| Compiler Warnings | Display the compiler warnings associated with the buffer or compilation. |
| Edit Compiler Warnings | Visit warnings in source; Control-. advances to the next warning. |
| Execute C Function | Execute a compiled C entry point. |
| Reparse Attribute List | Reparse the C definition inventory. |
| Define C Search List | Create a named include-directory search list. |
| Set C Search List | Select a search list for the current context. |
| Show C Search List | Display a selected search list. |
| Undefine C Search List | Remove a named search list. |
| Set Export for Buffer | Control whether definitions from this buffer are exported. |
| Set Package | Set the Lisp package associated with the source buffer. |
| Show Documentation / Meta-Shift-D | Show documentation for the C object at point. |
| Update Attribute List | Refresh the parsed C definition inventory. |

The common syntax-editor record calls Control-Meta-Q Correct Structure, while
the C-specific command summary calls the same gesture Format Language Region.
This may be an alias, a context-sensitive binding, or version drift; the
effective loaded command table is a runtime TODO.

The same command-summary witness contains unresolved implementation notes:
Kill Definition is marked “not working”; List Definitions and List Changed
Definitions are marked available; List C Callers is marked unavailable; and
Macro Expand Region on Control-Shift-M is questioned as either not implemented
or renamed Macro Expand Expression. Those are release-document editorial
states, not findings from the currently unloaded runtime.

### Dynamic C Listener

Select Activity C enters the Dynamic C Listener when the product is installed.
It combines a command history, C evaluator, and Command Processor-style menus.
Help describes the active interface.

At an earlier prompt, left-click reexecutes the command, middle-click modifies
and then reexecutes it, and right-click obtains the contextual menu. On a
command name, left-click reads typed arguments, the documented middle gesture
has no operation, and right-click chooses arguments from menus. End commits a
value; a second End activates the completed command. The C 1.1 notes say typed
commands were newly enabled and that a menu selection may abbreviate a full
command name.

The listener's C evaluator is also available in debugger and suspended-break
contexts. A comma introduces a C expression and End evaluates it. It cannot
define a C function; definitions must be compiled first. The guide says
setjmp/longjmp have no useful effect in this evaluator, and atexit has no useful
program-exit context there.

### C Command Processor inventory

These are the language-specific commands and options recovered from the C
command chapters:

| Command | Arguments or behavior |
| --- | --- |
| Kill C Definition | Pathname; type All, Function, Macro, Variable, or Type; Query. |
| Edit C Definition | Pathname or named definition. |
| Show C Callers | Scope by Package, Pathname, or System. |
| Find C Name | Packages (All or a package, default C-USER) and type All Types, Function, Typedef, or Variable. |
| Create C User Package | Create the package context expected by a C development session. |
| Define C Include Directory Search List | Define a named ordered include search path. |
| Show C Include Directory Search List | Show All, Default, or one named list. |
| Execute C Function | Arguments as argc/argv strings; Program Name; User File Pathname Defaults; Temporary File Pathname Defaults (documented default SYS:C;TMP); Enter Debugger On Error (default No). |
| Make C Main Program | Construct a callable main-program environment from a C entry point. |
| Trace C Definition | Install tracing on a C definition. |
| Show Include Files | Left-click one file or right-click all files in the C Include command menu. |
| List Include Files | List any selected include files. |
| Clear Include Files | Clear one with left-click or all with right-click. The detailed command accepts pathnames or wildcards and Query Everything, Confirm Only, or No. |
| Establish Environment | File Context; New Name Environment; Reinitialize; Search List From Pathname. |
| Set File Context | Select context, optionally deriving its search list from a pathname. |
| Add File | Add a source file to the current C environment. |
| Set C Environment Search List | Choose whether a predefined search list is used. |
| Describe Type | Describe a C type known to the active environment. |
| Show C Established Environment | Display the files, context, and search state of the environment. |
| Generate C System Definition | System name, source pathnames, defaults, search list, and component systems; produces a system-definition buffer and a warnings buffer. |

The Generate C System Definition description is internally inconsistent: its
argument list includes search lists and component systems, but nearby prose
says the generator cannot preserve those facts. A generated definition should
therefore be reviewed rather than treated as a lossless serialization of the
interactive environment.

An environment records the current file context, include search lists, files,
and names. It is the development-time analogue of the call-tree context needed
at execution. The source-only export routine adds another preservation warning:
its implementation comment says that recompiling a C library between minor C
releases invalidates user BINs. Preserving only header text and recompiling a
library with an arbitrary compiler version can therefore break binary
compatibility.

### Compilation, systems, and execution

The normal workflow is:

1. enter C Mode or Electric C Mode and establish the package/search-list
   context;
2. compile a definition, region, buffer, file, or Genera system;
3. inspect Compiler Warnings and navigate to individual warnings;
4. establish or generate the C environment and call tree; and
5. run through Execute C Function, Make C Main Program, or the equivalent Lisp
   entry point.

Compile and Load System applies the ordinary Genera system-construction
machinery. Incremental definition replacement is available in a development
world, but its correctness depends on the current environment, external
declarations, and runtime initialization. C programs which use static data or
string literals must remain below C-SYSTEM:EXECUTE in the call tree. Calling a
generated Lisp symbol directly can bypass required C initialization.
C-SYSTEM:BUILD-EXPANDED-ARGUMENT-LIST constructs the argc/argv representation
for Lisp callers.

### Libraries

The inspected header system contains the standard-library families:

| Headers | Scope represented by the media |
| --- | --- |
| assert.h, ctype.h, errno support, float.h, limits.h | Assertions, character classification, error state, and numeric implementation limits |
| locale.h, math.h, setjmp.h, signal.h | Locale, mathematics, nonlocal-transfer declarations, and signals |
| stdarg.h, stddef.h, stdio.h, stdlib.h | Variable arguments, common types/macros, streams, allocation and conversion |
| string.h, time.h | Byte/string operations and time facilities |

The C 1.1 release notes specifically call locale support new. Presence of these
headers establishes the library shipped with this product revision; it does
not imply conformance to later C standards.

### Lisp interoperation and representation

A C declaration with the lisp function directive names a Lisp callee, optionally
including an explicit package and Lisp-name string. The directive applies to one
function. Callers must be recompiled when it changes.

The lispobj type can carry any Lisp object, but C may only assign it or pass it
as an argument; the C program cannot portably inspect, compare, coerce, or
mutate its Lisp representation. Ordinary scalars cross by value. Aggregates
cross according to size:

| C object | Lisp-facing representation described by the guide |
| --- | --- |
| Structure of at most one machine word | One Lisp argument |
| Structure of at most two words | Two Lisp arguments |
| Larger structure | Array plus offset |
| C double scalar | Boxed when entering Lisp; the C side uses high/low unboxed components |
| C pointer | Two words representing an array and index, with tagged bounds and pointer checks |

The documented sizes are 8-bit char, 16-bit short, one-word int, long, and
float, and two-word double and pointer. C structure storage uses ART-Q arrays.
These are properties of this implementation and target, not portable C ABI
promises.

### Debugging limits

The compiler emits source-level information for the Genera debugger, but the
available documents disagree about breakpoints. The C 1.1 notes say C
breakpoints are not supported, while a C debugger chapter still describes
them. No C package is resident in the base world, so this audit cannot decide
which statement applies to the inspected media version. Standard Genera
debugger commands remain inherited; no separate, trustworthy complete C-only
debugger command table was exposed by the recovered records.

## Symbolics FORTRAN

### Language identity and extensions

The FORTRAN manual claims full ANSI FORTRAN 77, X3.9-1978, and then adds
Symbolics facilities: arbitrary-size integers, detection of uninitialized
values, stronger type checks, packages, integer/logical coercions, selected
Department of Defense extensions, DO WHILE and ENDDO forms, INCLUDE and
IMPLICIT facilities, binary patterns, logical and shift operators, and bit
substrings. Source is case-insensitive except in strings and Hollerith data.
The system declaration dates the product to 1982.

The normal package is FTN-USER with no superiors. CL-USER can be made visible,
but the manual warns about name conflicts. Character data is 8-bit; INTEGER,
REAL, and LOGICAL occupy one word; DOUBLE and COMPLEX occupy two.

### Fixed-format Zmacs interaction

FORTRAN mode is deliberately different from the C/Pascal syntax editor. Its
bindings know statement fields, continuations, sequence numbers, and the
column-72 source limit:

| Key | Effect |
| --- | --- |
| Tab | In columns 0 through 6, pad to the next fixed-format field; elsewhere perform the mode's normal indentation/tab action. |
| Line | Open and indent the next statement line. |
| Control-Line | Open a continuation line. |
| Control-Meta-A / Control-Meta-E | Move to the beginning or end of the current routine. |
| Control-Meta-F / Control-Meta-B | Move to the next or previous statement. |
| Control-Meta-H | Mark the current routine. |
| Control-Shift-A | Show the compiled routine name and argument types. |
| Control-Shift-C | Compile the region or nearby routine according to context. |
| Control-^ | Merge source lines. |

Electric FORTRAN Mode wraps at column 72 and inserts continuation syntax. Two
editor variables are user-settable: F77:*WRAPAROUND-COLUMN*, documented default
40, and F77:*CONTINUATION-CHARACTER*, documented default dollar sign.

The recovered FORTRAN-specific named commands are:

| Command | Purpose |
| --- | --- |
| FORTRAN Mode / Electric FORTRAN Mode | Select fixed-format editing, with Electric mode adding automatic wrapping and continuation behavior. |
| Compile and Execute FORTRAN Program | Compile the current program and run it. |
| Compile Buffer | Compile definitions in the current buffer. |
| Compile Changed Definitions of Buffer | Compile changed definitions in this buffer. |
| Compile File | Compile the file on disk. |
| Compile Region | Compile the selected region or contextual routine. |
| Compiler Warnings / Load Compiler Warnings | Display or reload saved compiler diagnostics. |
| Edit Compiler Warnings | Visit the source locations of warnings. |
| Edit Changed Definitions of Buffer | With numeric argument 1 read, 2 save, or 3 compile according to the manual. |
| Edit Definition / Meta-. | Visit the defining source of a FORTRAN name. |
| Execute FORTRAN Program | Run a compiled main-program environment. |
| Find Next FORTRAN Sequence Number | Find the next fixed-format sequence field. |
| Remove Sequence Numbers | Remove sequence fields from source. |
| Replace Tabs | Replace tab characters with fixed-format spacing. |
| List Definitions / List Changed Definitions | Display the routine inventory or changed subset. |
| Clear All Breakpoints / List Breakpoints | Manage the documented language breakpoints; runtime support remains unverified. |
| Reparse Attribute List / Update Attribute List | Recompute or refresh parsed routine metadata. |
| Set Package | Set the buffer's FORTRAN/Lisp package. |

### Programs, systems, and run commands

A FORTRAN program can be run by Execute FORTRAN Program in Zmacs,
Execute FORTRAN in the Command Processor, or F77:EXECUTE/F77:XQT from Lisp.
The Command Processor interface exposes:

| Option | Function |
| --- | --- |
| Additional Externals | Supply extra external routines. |
| Blockdata | Select BLOCK DATA initialization units. |
| Extra Character Space / Extra Number Space | Reserve additional FORTRAN character or numeric storage. |
| Init to Zero | Initialize storage to zero rather than preserving uninitialized-value detection. |
| Libraries | Select FORTRAN libraries. |
| Pathname Default | Establish file defaults for program I/O. |
| Reload | Force relevant compiled files to reload. |
| Save Environment | Retain the constructed execution environment. |
| System | Name a Genera system supplying program components. |
| Trap Underflow | Enable floating-point underflow trapping. |
| Units | Select program units. |

F77:DEF-LIBRARY and F77:DEF-PROGRAM define language-level libraries and
program call trees. DEFSYSTEM and Compile/Load System integrate FORTRAN,
Lisp, and—subject to dependency order—Pascal components. Explicit PROGRAM
names are recommended because unnamed main programs reuse the conventional
.MAIN. name and can replace one another.

The runtime provides separate numeric and character spaces. Lisp code can
allocate scoped regions with F77:WITH-FORTRAN-NUMBER-DATA and
F77:WITH-FORTRAN-CHARACTER-DATA; FORTRAN addresses entries by integer offset.
The inspected compiled media includes modules named libraries,
io-libraries, and intrinsic-inits. The manual describes Genera- and
network-compatible I/O, but the exact exported routine inventory has not yet
been recovered safely.

### Debugger and language listener

FORTRAN participates in the Display Debugger's eight-pane source interface.
Its language listener can evaluate FORTRAN statements in a suspended context.
The recovered restriction record names GOTO and RETURN as excluded, but that
record is not demonstrably exhaustive. The recovered language-specific
debugger commands are:

- Show Local (Meta-L);
- Show Variable's Value;
- Show Detailed Value;
- Show Variable's Type;
- Show Value's Type;
- Describe Type Detailed;
- Show Type Name;
- Edit Viewspecs;
- Statement Step For Function; and
- Clear Statement Step For Function.

The ordinary debugger commands, traps, stack navigation, and presentations are
inherited from Genera. The documentation itself says Show FORTRAN Global
Common does not exist, and some trap/breakpoint records retain editorial notes
asking whether the facility works. They are not counted as confirmed commands.

### Lisp interoperation

The lispobject type has the same deliberately narrow role as C lispobj: it may
be assigned or passed but not inspected as a foreign structure. A lispfunction
declaration names a Lisp routine. Scalars cross by value; arrays become
indirect Lisp arrays or references.

DOUBLE arrays remain unboxed high/low-word data, while DOUBLE scalar
arguments are boxed automatically on the Lisp side. A function cannot return
a character array directly; callers must supply an output argument. Data
initialization requires execution below the FORTRAN program call tree, or an
appropriate EXTERNAL declaration and environment. Directly invoking an
internal compiled symbol can therefore be as unsafe as bypassing
C-SYSTEM:EXECUTE.

A decoded on-line Help record titled Standard FORTRAN Functions contains
Pascal EOF/EOLN material rather than a FORTRAN intrinsic inventory. This audit
does not turn that mislabeled payload into a claim about supported intrinsics.
The exact intrinsic and library list is a runtime TODO.

## Pascal Tool Kit

### Dialects, extensions, and restrictions

The Pascal environment supports an ISO-oriented default dialect and a
Pascal/VS dialect. It adds arbitrary-size integers, uninitialized-value
detection, stronger type checking, SHORTREAL, an OTHERWISE case arm, %INCLUDE,
single/double conversion, packages, Lisp interaction, a second file-open
argument, and the units facility. The system declaration dates the product to
1982.

The book's broad “full ISO and Pascal/VS” overview is qualified by its own
restriction chapters. The Pascal/VS mode omits routines or facilities named
PARMS, PDSIN, PDSOUT, RETCODE, and TOKEN; percent directives other than
%INCLUDE; DEF, REF, SEGMENT, SPACE, and STATIC declarators; EXTERNAL, FORTRAN,
MAIN, and REENTRANT directives; and range case selectors. ISO OTHERWISE becomes
a reserved word. Pascal/VS strings cannot be passed directly to ISO routines,
and conformant arrays cannot be passed directly to Pascal/VS routines.

The normal package is PASCAL-USER with no package conflicts documented. The
manual calls units the Release 6.0 replacement for the older 5.2 separate
compilation scheme; Set Using survives in the editor inventory only as an
obsolete 5.2 command.

### Zmacs bindings and commands

Pascal uses all shared syntax-editor bindings above. Its direct language
bindings add Control-Meta-A/E for routine boundaries, Control-Shift-A for the
compiled argument list, and Control-Shift-C for compilation. The
Control-Shift-A documentation itself asks whether the command works, so the
binding is documented but its behavior is not runtime-confirmed.

The complete recovered Pascal-specific named-command inventory is:

| Command | Purpose |
| --- | --- |
| Pascal Mode / Electric Pascal Mode | Select normal or syntax-aware Pascal editing. |
| Set Dialect | Toggle or choose ISO versus Pascal/VS parsing and templates. |
| Compile and Execute Pascal Program | Compile and run the current program. |
| Compile Buffer | Compile definitions in the current buffer. |
| Compile Changed Definitions | Compile changed definitions across applicable buffers. |
| Compile Changed Definitions of Buffer | Compile only changed definitions in the current buffer. |
| Compile File | Compile the source file on disk. |
| Compile Region | Compile the region or contextual routine. |
| Compiler Warnings / Edit Compiler Warnings | Display diagnostics and visit their source locations. |
| Edit Definition / Meta-. | Visit a Pascal definition. |
| Execute Pascal Program | Construct and run a Pascal program environment. |
| Format Language Region | Reformat syntax-aware source. The appendix also names Format Pascal Region, probably an older synonym; equivalence needs runtime confirmation. |
| List Definitions | Display the parsed Pascal definition inventory. |
| Clear All Breakpoints / List Breakpoints | Manage documented Pascal breakpoints; not verified in the unloaded runtime. |
| Show Dependent Units | Show units which depend on the selected unit. |
| Show Units Depended On | Show units required by the selected unit. |
| Set Using | Obsolete command for the pre-units 5.2 separate-compilation scheme. |
| Reparse Attribute List / Update Attribute List | Recompute or refresh syntax metadata. |
| Set Package | Set the associated Pascal/Lisp package. |

Load File is also named in the Pascal appendix, but it is inherited Zmacs
functionality rather than a Pascal-only command.

### Programs, units, and run options

Pascal programs run through Execute Pascal Program in Zmacs, Execute Pascal in
the Command Processor, or PASCAL:EXECUTE/PASCAL:XQT from Lisp. The documented
Command Processor options are:

| Option | Function |
| --- | --- |
| Input / Output | Choose program input and output streams or files. |
| Pathname Defaults | Establish defaults for Pascal file operations. |
| Reload | Force program components to reload. |
| Save Environment | Preserve the assembled execution environment. |
| Stack Size | Set the Pascal program stack allocation. |
| Streams | Supply additional stream bindings. |
| Trap Underflow | Enable floating-point underflow traps. |
| Use Abort Mode | Select the documented abort-handling mode. |
| Init to Zero | Zero-initialize storage. |

The PASCAL:EXECUTE arglist shown elsewhere omits Streams and Use Abort Mode,
and prose uses the singular Stream where the option table says Streams. This
is another unresolved manual inconsistency.

PASCAL:DEF-PROGRAM and DEFSYSTEM describe programs and their units.
Compile/Load System can combine Pascal, FORTRAN, and Lisp components when
dependencies are declared correctly. Units, not the obsolete Set Using
mechanism, are the relevant separate-compilation model for the later text in
the inspected book.

### Debugger

Pascal uses the same eight-pane Display Debugger architecture as FORTRAN. Its
language listener may evaluate executable statements in the suspended
environment except GOTO, LEAVE, EXIT, and RETURN. The recovered Pascal-specific
value, type, and stepping commands are the same set:

- Show Local (Meta-L);
- Show Variable's Value;
- Show Detailed Value;
- Show Variable's Type;
- Show Value's Type;
- Describe Type Detailed;
- Show Type Name;
- Edit Viewspecs;
- Statement Step For Function; and
- Clear Statement Step For Function.

Generic debugger operations are inherited. The existence of Clear All
Breakpoints and List Breakpoints in the editor documents intended integration,
but only a loaded product can establish the effective release behavior.

### Lisp interoperation and data representation

Pascal's lispobject and lisp directive provide the bridge to Lisp. Scalars pass
by value; arrays and records may pass by value or reference. Packed character
arrays and Pascal/VS strings map to Lisp strings. REAL is boxed for Lisp while
the Pascal side uses its unboxed high/low representation.

Lisp invokes a main program through PASCAL:EXECUTE. The manual also documents
calling a first-level routine through its generated Lisp symbol with a NIL
compiler display argument. It does not authorize the same shortcut for nested
routines.

The documented target model uses 8-bit characters, approximately 24-bit
single precision, approximately 53-bit double precision, and arbitrary-size
integers through Lisp bignums. An unconstrained set constructor defaults to a
256-element integer domain. These implementation choices affect data exchange
and should be retained in compatibility tests.

## Manual, source, Help, and runtime disagreements

These are not editorial trivia. They delimit what can be claimed about a
particular preserved release:

| Topic | Conflicting evidence | Current treatment |
| --- | --- | --- |
| C release identity | On-line guide registers C 1.2; bundled 1.1 notes describe an earlier 1.0 guide and rolling on-line updates. | Treat the media and books as a piecemeal release family; cite the exact witness for a command. |
| C breakpoints | C 1.1 notes say unsupported; debugger material describes them. | Runtime TODO; do not advertise as verified. |
| C and Pascal Electric defaults | User tables and recovered API metadata disagree about body and predeclared-name case. | Preserve both statements; do not choose by guess. |
| Adjust Face and Case | The command is listed, but the C command summary says it did not work then. | Listed as exposed but unverified. |
| Generate C System Definition | Its interface accepts facts which its prose says it cannot preserve. | Generated output requires manual review. |
| Pascal version | Book says 5.2; units chapter says Release 6.0 and calls 5.2 mechanism obsolete. | Marketing-to-system version remains unknown. |
| Pascal conformance | Overview says full ISO/Pascal/VS; restriction chapters list omissions. | Report the restrictions, not the unqualified slogan. |
| Pascal execution streams | Option table says Streams; prose says Stream; Lisp arglist omits it and Use Abort Mode. | Keep all three witnesses and defer effective arglist to runtime. |
| FORTRAN intrinsics | A recovered record bearing a FORTRAN-functions title contains Pascal EOF/EOLN content. | It is not used as an intrinsic inventory. |
| Editor/debugger status | Records retain questions such as whether Control-Shift-A, traps, or breakpoint operations work. | Treat as editorial uncertainty until runtime use. |

### Findings visible only in the media declarations

- C compiler and editor source are marked non-distributable, while C Runtime
  source is distributable; this explains the mixed source/binary media tree.
- C's library exporter warns that recompilation across minor C releases
  invalidates user BINs.
- The C editor declares explicit dependencies on syntax-editor support, lexer,
  grammar, search, kill, and language modules rather than being a superficial
  file-suffix mode.
- Pascal declares the same syntax-editor/lexer/grammar architecture and
  explicitly disables source distribution.
- FORTRAN, Pascal, and their run-time/package systems are separate loadable
  systems. Finding one package would not prove the compiler, editor, and
  documentation systems were all loaded.

## What the CADR and LM-3 source does—and does not—show

A bounded search of the public MIT System 46 ZWEI, SYS, and LMMAN trees found no
Symbolics C, Symbolics FORTRAN, or Pascal Tool Kit product declarations. It did
find editor modes for MIDAS, PL1, Electric PL1, TECO, and Macsyma. The PL1 mode
has real implementation—indentation, electric semicolon and colon behavior,
and a Multics declaration helper—but that proves an editing grammar and keymap,
not a compiler, runtime, listener, library, or installed language product.

The maintained LM-3 Fossil tree preserves the same five mode definitions in
zwei/modes.lisp and zwei/pl1mod.lisp. That tree is a maintained restoration
branch, not the historical System 46 snapshot, so the two witnesses are pinned
and named separately:

- System 46 revision 8e978d7d1704096a63edd4386a3b8326a2e584af:
  [modes.49](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/modes.49)
  and
  [pl1mod.8](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/pl1mod.8);
- LM-3 check-in 4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91:
  [modes.lisp](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/modes.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and
  [pl1mod.lisp](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/pl1mod.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).

The bounded negative search is not a claim that no C, FORTRAN, or Pascal
compiler ever ran on any MIT Lisp Machine. It only prevents editor-mode evidence
from being misreported as an installed product in the inspected trees.

## Runtime observation and screenshot blocker

Session d37-language-products-20260718, generation 1, booted the museum's
Genera 8.5 base world in the isolated Xvfb harness on 2026-07-18. Evaluation of:

~~~lisp
(list (find-package "C-SYSTEM")
      (find-package "F77")
      (find-package "PASCAL"))
~~~

returned (NIL NIL NIL). This proves only that the three packages were not
resident in that base world. It does not prove that their systems are absent
from the purchased media; the media inventory above establishes the opposite.

A second exploratory expression intended to inspect file-mode associations
used ASSQ in CL-USER, where it was undefined, and entered the debugger. It
produced no valid evidence about mode registration. The session then returned
to the listener and shut down.

No screenshot is published with this article. The only verified visible state
was the ordinary Lisp Listener reporting package absence, not any C, FORTRAN,
or Pascal interface. Publishing that generic screen would add no evidence
beyond the reproducible expression and would not satisfy the purpose of a
product screenshot. Raw captures and sidecars remain in the ignored session
tree. A representative editor/listener/debugger capture is explicitly blocked
until a private world can safely load each licensed product; any selected image
must then pass the image-specific
[screenshot publication rights review](screenshot-publication-rights-review.md).

### Runtime provenance

| Item | Recorded value |
| --- | --- |
| Session and generation | d37-language-products-20260718; generation 1; 2026-07-18T09:36:46-04:00 to 09:39:50-04:00 |
| Base and private VLOD | Genera-8-5.vlod; 54,804,480 bytes; SHA-256 a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672; private matched base at start and did not change |
| Purchased archive | opengenera2.tar.bz2; 206,213,430 bytes; SHA-256 89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e |
| VLM and debugger | VLM 1,533,760 bytes, SHA-256 9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7; debugger 346,880 bytes, SHA-256 2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a |
| Compatibility helpers | X compatibility preload SHA-256 acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1; ifconfig interposer f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7; RFC 868 responder cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb; configuration 5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086 |
| Toolchain | Guix channel commit 230aa373f315f247852ee07dff34146e9b480aec; manifest SHA-256 3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d |
| Isolation | Bubblewrap user, mount, network, PID, IPC, and hostname namespaces; host root hidden; read-only Guix store and exact helpers/X socket; private runtime writable; no default or external route and no host file service |
| X display | Xvfb 1440x1100x24 with MIT-SHM disabled and live-verified absent; selected main window “Genera on DIS-LOCAL-HOST”, 1200x900 |
| X protocol boundary | Exact configured modifier-map request substitutions were observed successfully; nonmatching writes delegated byte-for-byte; no read, TAP, world-file, ordinary-file, or unrelated-socket interposition |
| Time service | One validated raw-Ethernet RFC 868 request/reply; evidence SHA-256 ff24aff5572b6c0d1c45d9726233222f2017b4fb8083d897b5f46df564849db4; completion af6f9cf2109c7aeca533d51e80f7d7c9edc4c9184399b624720d0a16d117b6b0; responder exit 0 |
| Input record | Twelve intent/outcome records; SHA-256 7c59388041ef5f7aa517e3fa4f3cd83752ed94bc13a544ed9ef190c085421352 |
| Shutdown | Prompt observed, yes sent, confirmation accepted, cleanup progress observed, then forced after the known confirmed stall; forced_stop true; orderly host shutdown false; state_may_be_incomplete true |
| Persistence | Harness did not invoke Save World or create a host checkpoint; Save World and guest-checkpoint status remain unknown; base and private world hashes were unchanged |

The detailed harness boundary is documented in
[Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md).
Machine-specific paths are intentionally omitted.

## Preservation inventory

The licensed media subtrees were inventoried without publishing their content.
For each subtree, the manifest digest is the SHA-256 of the sorted stream
produced by running SHA-256 over every regular file relative to that subtree:

| Logical media subtree | Files | Bytes | Manifest SHA-256 |
| --- | ---: | ---: | --- |
| sys.sct/c | 207 | 3,414,357 | 518c32fd0353b4322d99af3719701542071ebd2ec5be8f7036e75312a4dbf1cb |
| sys.sct/fortran | 44 | 1,444,243 | 5de50b361989b40b97f0dcb59950a0a9fa16d41276c247bcb3e05837f763f8a5 |
| sys.sct/pascal | 48 | 1,845,151 | 4bcf5578daec633e8a7288f70219845a413d138395e161af0e443d5db5fac845 |

Selected evidence-bearing artifacts:

| Logical pathname | Bytes | SHA-256 |
| --- | ---: | --- |
| c/c.lisp.~125~ | 8,912 | cf38f055a5995e044372a4c0b0937f8435bf7e6dcf8a023074b62cab667e517e |
| c/c-runtime.lisp.~68~ | 6,541 | a7ddba1b9f72733d9077acee030c93141e3d7c3f0ab3290409543cdc3e5ae103 |
| c/doc/c-editor-command-summary.sab.~27~ | 19,363 | 4129e8707cac0323680567f079e43bdcd70dc5532b4ee84d384741b1b2cfdded |
| c/doc/c-cp-commands.sab.~31~ | 63,199 | 17dc483a2fb4564f102232424c5c1485a45e738413dd93fb9bf4ae2f5971a970 |
| c/doc/release-notes-for-c-1-1.sab.~13~ | 13,356 | 56effd0be367201e0f69996c5d701e729f41eb98fccafb3a58487448dfd78670 |
| fortran/fortran.lisp.~67~ | 3,885 | ed801319de57f4aa177e348eae5cc8e4789a02a61f2f4a91a51f92f31f52f1cb |
| fortran/fortran-runtime.lisp.~11~ | 3,927 | 1568bb516e194acd0dbcb5bf5042bf683174c383be09bed5a5fb7c0852b4f9d9 |
| fortran/doc/fortran77-1.sab.~36~ | 167,912 | 7fdde101471f829300e51a9bff7d60d721ed858bc54652222dc99bb0b6aa946d |
| fortran/doc/fortran77-2.sab.~35~ | 113,671 | 8cb1f7f3f6d25782e8233dcf0cef064caf74b5696bc34ee14ae03130488d1da5 |
| fortran/doc/fortran77-3.sab.~47~ | 569,388 | 8aa475f7b1de22796d0b6d059fead8af38c2b4b74265576a06aa654841bba95d |
| pascal/pascal.lisp.~57~ | 4,330 | 13f4b9afd99877c697b9d74696cce1444a5308c9225213030d625b19c4e5c61b |
| pascal/pascal-runtime.lisp.~9~ | 4,333 | 9770bc258aee170ad222c7d896be2b206418717502d374a846d3e5ecad6b4bbe |
| pascal/doc/pug-intro.sab.~25~ | 166,691 | 67a5f7b774a7a3741e0bf6a854c679fa0e424ccfb1d45e24fab5aa2b0e8d443c |
| pascal/doc/pug-editor.sab.~18~ | 225,842 | 0f0ed3266c2df717affc7fcb9ce1aec04b231e4924f2e332967b0fc559654c68 |
| pascal/doc/pug-systems.sab.~15~ | 204,353 | 2abe4ca71bbfc4acc7ecc4674fe86a45e78b94b47cd484ee57f4844c5d5ffcf5 |

The inert [Genera Help extractor](../scripts/extract-genera-help.py) was
inspected at 55,939 bytes, SHA-256
e59440906a0092afe28ca514be9e7afdf6c21ca1009b765a710f0a4121f13a74.
Its ignored catalog was 577,696 bytes with SHA-256
a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed;
the ignored JSONL was 9,817,347 bytes with SHA-256
8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190.
Method and rights boundaries are in
[Recovering Genera on-line Help and documentation](genera/online-help-and-documentation-recovery.md).
No decoded proprietary prose or compiler module is tracked by this article.

The corresponding public-source witnesses were hashed separately:

| Witness | Bytes | SHA-256 |
| --- | ---: | --- |
| System 46 src/nzwei/modes.49 | 43,268 | 0ffe92950723424a86b4c95c2da8e8187c5f8be11031df3321e278e6cb715965 |
| System 46 src/nzwei/pl1mod.8 | 14,314 | 72c04e3681f44fdb2626433a18cffba65470b110070a0c03213ea1f07b9016d6 |
| LM-3 zwei/modes.lisp | 68,224 | 732303cda32a8c931ae4f112b7f54d3803a49e2c8206f90e39759235bcad975a |
| LM-3 zwei/pl1mod.lisp | 13,520 | 28244432ae35e1dd660dbebc41f1046c233070e8c25b77eaf903becafc40b49e |

## Open questions and next runtime work

- TODO: make private, disposable worlds which load C, FORTRAN, and Pascal
  independently, recording every system load and patch dependency.
- TODO: query the effective Zmacs command tables in each language mode and
  compare them with this manual/Help inventory.
- TODO: exercise Electric mode templates, case/face defaults, Adjust Face and
  Case, indentation persistence, syntax-error navigation, and the questioned
  Control-Shift-A commands.
- TODO: run one minimal mixed Lisp/language program per product, then repeat it
  as development BIN, RTO BIN in a development world, and RTO BIN in a
  run-time-only world.
- TODO: test C breakpoints, FORTRAN/Pascal breakpoint and trap commands, and
  source-level statement stepping against the exact media versions.
- TODO: enumerate FORTRAN intrinsics and libraries, and Pascal units/runtime
  library exports, from loaded systems rather than the mislabeled Help record.
- TODO: capture one representative, minimally revealing editor/listener or
  debugger state for each product, perform the specific four-factor review,
  and publish it only if it materially supports the resulting analysis.

## Sources

- Symbolics,
  [User's Guide to Symbolics C](https://bitsavers.org/pdf/symbolics/software/genera_8/User_s_Guide_to_Symbolics_C.pdf),
  C 1.2 / Genera 8.0; editor, listener, Command Processor, execution,
  Lisp-interface, and representation chapters; verified 2026-07-18.
- Symbolics,
  [Release Notes for Symbolics C 1.1](https://bitsavers.org/pdf/symbolics/software/genera_8/Release_Notes_for_Symbolics_C_1.1.pdf);
  verified 2026-07-18.
- Symbolics,
  [User's Guide to the Pascal Tool Kit](https://bitsavers.org/pdf/symbolics/software/genera_8/User_s_Guide_to_the_Pascal_Tool_Kit.pdf),
  registered as 5.2 / Genera 8.0; language, editor, units/systems, debugger,
  execution, and Lisp-interface chapters; verified 2026-07-18.
- Symbolics,
  [User's Guide to Symbolics FORTRAN](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Users-Guide-to-Symbolics-Fortran.pdf),
  FORTRAN 6.1 / Genera 8.0; language, editor, program/system, debugger,
  execution, and Lisp-interface chapters; verified 2026-07-18.
- Licensed Open Genera media, logical subtrees sys.sct/c, sys.sct/fortran,
  and sys.sct/pascal; inspected locally 2026-07-18 using the manifest and
  selected-artifact hashes above; no proprietary payload is reproduced.
- MIT CADR System 46 source revision
  [8e978d7d1704096a63edd4386a3b8326a2e584af](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af);
  verified 2026-07-18.
- LM-3 maintained Fossil check-in
  [4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91);
  verified 2026-07-18.
