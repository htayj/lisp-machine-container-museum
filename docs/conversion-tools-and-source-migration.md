---
type: Museum Guide
title: Conversion Tools and source migration on Symbolics Genera
description: A source-, manual-, and runtime-grounded study of Genera's Zmacs-assisted ZetaLisp, Common Lisp, Flavors, Dynamic Windows, and CLIM conversion tools.
tags: [genera, conversion-tools, zmacs, zetalisp, common-lisp, flavors, clos, dynamic-windows, clim, preservation]
timestamp: 2026-07-18T13:59:33-04:00
---

# Conversion Tools and source migration on Symbolics Genera

Genera's Conversion Tools are an interactive **source-to-source migration system
inside Zmacs**. They are not a compiler, decompiler, load-band extractor, or virtual
machine snapshot converter. The tools search editable source buffers for candidate
forms, read those forms as Lisp while retaining source correspondence, apply a named
set of structural rewrites, show alternatives and warnings to the programmer, and
install an accepted replacement while trying to preserve comments and layout.

That architecture explains both their historical value and their limits. They can
perform much more than textual search-and-replace: a converter can match a macro-style
argument template, consult facts learned from other definitions or loaded classes,
change a whole form, and leave an explicit marker where human judgment is required.
They do not prove semantic equivalence. Package identity, program-wide protocols,
implementation extensions, changed user-interface models, and constructs with no
portable analogue still require review, compilation, and tests.

The inspected release contains these principal migrations:

- ZetaLisp reader syntax, radix, packages, functions, and structures to Symbolics
  Common Lisp;
- Flavors definitions, methods, messages, and instance operations to CLOS;
- Symbolics Common Lisp extensions to a conservative portable Common Lisp subset;
- Dynamic Windows forms and program frameworks to CLIM 1.1 or CLIM 2.0; and
- CLIM 1.1 interfaces to CLIM 2.0.

Source inspection also found a Common Lisp-to-Common Lisp Developer cleanup set, a
public facility for defining additional conversion sets, and a declared
Flavors/Statice-to-CLOS/Statice module whose implementation is absent from the
inspected VLM media. This article covers every Zmacs command and interactive option,
every named conversion set present in the readable VLM source, its registration
census and facility boundary, and all explicit unsupported cases found in the
manuals or implementation. It does not reproduce hundreds of proprietary mapping
bodies; exact registration counts and source identities make that boundary
auditable.

## Evidence and rights boundary

| Evidence | Inspected boundary | What it establishes |
| --- | --- | --- |
| Symbolics *Program Development Utilities* | Genera 8 public manual, chapter “Conversion Tools” | Supported workflow, six-step ZetaLisp process, command behavior, converter limitations, extension API, and recommended validation |
| Symbolics *Genera 8.0 Release Notes* | Public release notes, “Enhanced Conversion Tools in Genera 8.0” | Conversion Tools first shipped in 7.1; Genera 8.0 added Flavors-to-CLOS and user-defined conversions |
| Symbolics *Genera 8.1 Release Notes* | Public release notes, “New Conversion Tools in Genera 8.1” | Package conversion and Symbolics Common Lisp-to-portable-Common-Lisp were new in 8.1 |
| Symbolics *CLIM 2.0 User's Guide* and release notes | Public CLIM 2 documentation | Supported Dynamic Windows and CLIM 1.1 migration procedures and CLIM-version differences |
| Licensed Open Genera source | `Conversion-Tools` source and component metadata from the identified local archive | Exact system graph, command definitions, conversion-set registrations, hidden query controls, heuristics, comments, and unresolved implementation issues |
| Licensed installed Help | Recovered inert Help records for Conversion Tools and CLIM | Cross-check of the public manuals against the installed documentation payload |
| Preserved Genera 8.5 world | Fresh isolated Xvfb session `d39-conversion-tools-20260718`, generation 1 | The package survives in the world, but the optional system, conversion registry, and representative Zmacs commands were not loaded |

The Genera source, Help payload, world image, and raw runtime captures are licensed
local inputs. They remain untracked. This page records interface names, counts,
checksums, and original analysis; it does not reproduce source listings, recovered
documentation, or converted customer code. No optional system was loaded during the
runtime check, and no source buffer or media file was modified.

## Product and release identity

The system declaration names `CONVERSION-TOOLS`, distributes source and binaries,
and categorizes the source as basic. That distribution category does **not** mean the
system is resident in every world. The declaration orders its modules as follows:

| Stage | Modules | Dependency or media boundary |
| --- | --- | --- |
| Flavor update | `SYS:FLAVOR;UPDATE` | Loaded in parallel with the following serial branch |
| Editing substrate | `editor`, `reader`, `convert-functions` | Zmacs commands, conversion-aware readers, registry, query loop, and source-preserving replacement |
| Core conversion sets | `zetalisp-conversions`, `Flavors-to-CLOS`, `SCL-to-CL` | No CLIM dependency |
| CLIM conversion sets | `DW-to-CLIM`, `CLIM1-to-CLIM2` | Requires the `CLIM` system |
| Statice conversion | `Flavors-Statice-to-CLOS-Statice` | Requires `Statice`; declared only for 3600 and IMach, not VLM |
| Examples | general, structure, and octal test programs | Lisp examples supplied as source, not loadable binary modules |

The version evidence has several layers that should not be collapsed into one label:

- a VLM inventory in `system-info` lists Conversion Tools 433.0;
- the inspected 436 component directory calls its creating world “Experimental
  Conversion Tools 436.0” and inventories the VLM inputs and outputs;
- the patch system directory records 436 as both `:RELEASED` and `:LATEST`, and the
  436 patch directory contains a released version-zero load marker; and
- the preserved Genera 8.5 world used here had no loaded `Conversion Tools` system
  version at runtime.

These statements describe different artifacts: a release inventory, a component
build context, patch metadata, and one saved world. The runtime result does not erase
the released media, and the media does not establish that the system was active in
the world.

## Architecture: a structured editor, not global text replacement

The conversion pipeline has four cooperating layers:

1. A `conversion-set` object holds a machine name, display name, search strings,
   default converters, and separate tables for symbol, funarg, and function/form
   conversions. A set with message conversions also creates a private message table
   reached through generated converters for its configured send forms.
2. The editor searches for inexpensive strings associated with the set. Around a
   candidate, it finds the innermost balanced form and reads that form with a reader
   that records correspondence between Lisp objects and buffer positions.
3. Applicable converters produce one or more replacement forms and optional hints.
   A template mismatch or a converter returning `NIL` quietly rejects that
   alternative. A conversion operation can also maintain state learned from earlier
   forms, open buffers, or the running world.
4. The query loop shows source context and possible replacements. After acceptance,
   a correspondence algorithm compares the old and new structures, edits the
   smallest practical source interval, and optionally reindents multiline output.

The source-correspondence layer makes this materially different from pretty-printing
an entire abstract syntax tree. It performs multiple matching passes so unchanged
subforms can retain their spelling, whitespace, and nearby comments. Preservation is
heuristic: rearranged forms can move comments or indentation, and structured comments
are intentionally ignored by the same reading path that ignores them as program
input. The manuals recommend temporarily uncommenting code that should itself be
converted, then restoring the comment delimiters afterward.

### Conversion state

State is scoped to a conversion operation. A set can establish additional state
before scanning and unwind it afterward. This enables program-aware decisions without
turning the tool into a whole-program compiler. Flavors-to-CLOS, for example, records
known superclasses, slots, generic functions, and method argument lists. It searches
already converted definitions first, then editor buffers, then loaded Flavor
metadata. Better context can improve a result, but a result is not thereby complete:
closed files, conditionally defined forms, generated methods, and target-system
behavior remain outside that evidence.

### What is edited and when a file changes

All conversion phases operate on Zmacs buffers. A region command edits the marked
region, or the definition containing point when no region is marked. A buffer command
selects one buffer. A Tag Table command obtains the current search domain, reads its
files into buffers when necessary, filters candidates, and can step through many
buffers.

The converter itself changes buffer text and, for some buffer or Tag Table commands,
buffer/file attributes. It does not implicitly save every converted file. Saving is a
separate Zmacs action after review and testing. This distinction matters for museum
operation: merely invoking a conversion can create packages and alter editor/world
state, while persistent source-file changes require a later save.

The manual recommends making a source-directory copy before beginning, especially
when the file server does not retain multiple versions. That precaution is separate
from Zmacs undo and from any later version-control operation.

| Pass | Text effect | Additional buffer or world effect |
| --- | --- | --- |
| Syntax | Reads ZetaLisp syntax and rewrites it as Common Lisp syntax, notably historical slash/backslash conventions | Sets syntax to Common Lisp; optionally updates file attributes; remaps the corresponding package, evaluation context, sectionization, and mode hook |
| Base | Reprints octal input in decimal or explicit-octal notation | Sets buffer base, `BASE`, and `IBASE` to 10; optionally updates attributes; runs the mode hook |
| Conflict scan | Does not change the source | Creates/replaces a `Conflicting symbols` buffer for later query replacement |
| Package | Re-reads forms and adds or removes package qualifications as needed to preserve symbol identity in a new package | Can create or remake a package; changes buffer package, attribute/context, sectionization, and mode hook |
| Function/conversion set | Replaces accepted symbols, funargs, calls, macros, or message sends | Maintains per-operation conversion state and automatic-choice memory; Tag Table use creates a special `Convert-functions` control buffer |

Read errors normally report the affected line and definition, skip to the next
definition, and continue. If no following definition can be located, the rest of the
file is skipped. The manuals tell the programmer to inspect every reported location.
Accepted form replacements are wrapped in Zmacs undo records, and the manual directs
users to the ordinary Zmacs undo commands. Two interval-level whole-pass undo calls
for syntax/base and one for package conversion remain commented out in the inspected
source, so a future runtime exercise should determine the exact granularity of undo
for those three passes rather than assuming they behave identically to per-form
function conversion.

## Complete Zmacs command surface

The inspected editor module defines exactly fourteen extended commands. All are
installed in the ordinary Zmacs command table when the system loads.

| Command | Scope | Prompts and result |
| --- | --- | --- |
| `Convert Lisp Syntax of Region` | Region/current definition | Converts ZetaLisp reader syntax; no buffer metadata transition |
| `Convert Lisp Syntax of Buffer` | One buffer | Confirms if syntax is not ZetaLisp, converts, then establishes Common Lisp buffer state |
| `Convert Lisp Syntax of Tag Table` | Candidate buffers | Lists only ZetaLisp-syntax buffers; Yes, No, or Selective; optional file-attribute updates |
| `Convert Base of Region` | Region/current definition | Chooses one large-octal-number policy and converts the interval |
| `Convert Base of Buffer` | One buffer | Confirms if base is not 8; converts and establishes base 10 buffer state |
| `Convert Base of Tag Table` | Candidate buffers | Lists only octal buffers; Yes, No, or Selective; optional attribute updates |
| `Find Conflicting Symbols in Buffer` | One buffer | Maps old and proposed packages, then writes conflicts to `Conflicting symbols` |
| `Find Conflicting Symbols in Tag Table` | All buffers in Tag Table | Same analysis over the domain; intended to feed Tags Multiple Query Replace |
| `Convert Package of Region` | Region/current definition | Selects a destination for the current package and rewrites symbol qualifications |
| `Convert Package of Buffer` | One buffer | Converts package qualifications and establishes the new buffer package |
| `Convert Package of Tag Table` | Candidate buffers | Maps each source package; Yes, No, or Selective; optional attribute updates |
| `Convert Functions of Region` | Region/current definition | Selects a conversion set and function-conversion policy |
| `Convert Functions of Buffer` | One buffer | Selects a conversion set and converts candidates in that buffer |
| `Convert Functions of Tag Table` | Tag Table | Selects a set and drives buffers through `Convert-functions` |

The manuals recommend constructing a current Tag Table first with `Select All Buffers
As Tag Table`, `Select Some Files As Tag Table`, `Select System As Tag Table`, or
`Select Some Buffers As Tag Table`. Those are general Zmacs commands, not additional
Conversion Tools commands.

### Syntax, radix, conflict, and package choices

The base pass has three policies for large octal numbers:

- **Octal** retains the numeric value using an explicit `#o` prefix;
- **Decimal** prints the value in decimal; and
- **Selective** asks for each affected number.

Selective mode offers Octal (`O`) or Decimal (`D`) for each number. The base reader
explicitly requires Common Lisp syntax, which is why the ordered ZetaLisp workflow
runs syntax conversion first. One source inconsistency remains unresolved: the
Buffer command tests the current base against integer `8`, but the Tag Table candidate
filter tests it against `:8`, while successful conversion stores integer `10`.
Whether `:8` has release-specific reader meaning or this prevents normal octal
buffers from entering the Tag Table worklist requires runtime verification; it is
not silently normalized here.

The conflict pass compares section definitions, not every token with the same print
name. A candidate must be local to the old package, resolve globally or by inheritance
in the proposed package, and have compatible source-definition evidence. The output
is a worklist for ordinary Multiple Query Replace, not an automatic rename oracle.

For each source package, the package pass offers an existing package, creation of a
new package, or “do not convert.” New-package creation asks for package universe/Lisp
syntax, used packages, and name. It also asks for symbols that should remain
unqualified because they are more likely local variables than global references.
The resulting package mapping and exclusion list are retained as defaults for later
conversions in the current world. This is a source-visible session side effect that
the high-level workflow description does not emphasize.

The conflict scanner invokes the same destination-package chooser. Selecting “a new
package” during what appears to be a read-only conflict analysis can therefore create
or remake that proposed package even though the source buffers are not rewritten.

### Function-conversion setup

Before a function/form pass, Zmacs asks for:

1. the named conversion set;
2. whether straightforward symbol renamings should occur without individual queries,
   when the chosen set has symbol substitutions; and
3. whether accepted multiline replacements should be reindented automatically.

“Do it every time” choices are remembered only for the active operation. Depending
on the answer, the remembered key can be the source operator alone or the entire old
form, so the programmer can restrict automation when arguments affect correctness.

### Complete single-character conversion query controls

| Input | Effect |
| --- | --- |
| `Y` or Space | Accept the sole replacement, or the first of several |
| `1` through base-36 digits | Select the numbered alternative; this extends beyond `9` when enough alternatives exist |
| `N` or Rubout | Skip this occurrence |
| `P` | Select an alternative if necessary, accept it, and remember that choice for matching later occurrences |
| Control-R | Enter a manual buffer edit; `End` returns to the same conversion question |
| Comma | Accept the sole/first replacement, then enter manual editing |
| Period | Accept the second replacement, then edit |
| Slash | Accept the third replacement when there are exactly three; with more, ask which replacement, then edit |
| Control-L or Refresh | Redisplay context and ask again |
| Semicolon | Accept and insert a warning comment asking the reviewer to check the result |
| `#` | Toggle between replacing with only the new form and retaining old/new forms under complementary feature conditionals; it does not itself accept the replacement |
| Control-`#` | Set or clear the feature name used by the `#` mode |
| Help | Display the full query-command table |
| Scroll, Control-V, or Control-Scroll | Scroll the typeout context forward |
| Meta-Scroll, Meta-V, Meta-Control-Scroll, Back-Scroll, or Control-Back-Scroll | Scroll the typeout context backward |
| Super-S or Find | Search the typeout context forward |
| Super-R or Meta-Find | Search the typeout context backward |

A message conversion restricted to a receiver Flavor has one additional query when
the type cannot be inferred. **Yes** assumes the type for this occurrence, **No**
declines the message conversion, and **Always** records the receiver/type fact for
later occurrences in the active conversion state.

This is a meaningful manual/source difference. The public Conversion Tools manual
documents acceptance, skip, persistent choice, manual edit, comma/period/slash,
redisplay, warning comment, Help, and ordinary scrolling. The inspected source also
exposes feature conditionalization with `#` and Control-`#`, base-36 alternative
selection, and the precise forward/backward typeout-search bindings; the prose only
mentions Super-R among “standard scrolling” controls. The manual's shorthand that
only the first three alternatives can be accepted-and-edited is accurate for direct
comma/period/slash gestures, but the source lets Slash prompt for an alternative when
more than three exist.

## ZetaLisp to Symbolics Common Lisp

The manual defines an ordered migration whose intended contract is that each
completed phase remains compilable and behaviorally equivalent:

1. syntax conversion;
2. optional radix conversion;
3. name-conflict resolution;
4. package-prefix conversion;
5. optional removal of unnecessary `CL:` prefixes;
6. function conversion using **ZetaLisp to Common Lisp**;
7. optional removal of remaining unnecessary `ZL:` prefixes; and
8. structure conversion using the separate `DEFSTRUCT` set.

The manual numbers those as steps 1–6 with 4a and 5a; they are expanded here so the
actual actions are unambiguous. Their order matters because syntax controls how forms
are read, base controls number interpretation, and package conversion makes
unconverted extensions visibly retain their `ZL:` qualification.

### Registration census and coverage

The principal set's raw top-level source contains 136 direct symbol registrations,
105 direct function/form registrations, and 7 direct funarg registrations. Helper
families add 8 equality registrations, 14 string-comparison families, 16 string-search
families, and 3 string-case families. These are source-form counts, not a claim about
unique runtime table entries: several source operators intentionally have multiple
alternatives, and one helper can expand to more than one converter.

The mappings cover these program concerns:

| Concern | Typical structural work |
| --- | --- |
| Arithmetic and numbers | Renames old floating operators; offers alternative rounding semantics where ZetaLisp and Common Lisp division differ |
| Arrays and locations | Converts ordinary access where possible; some leader/locative operations remain Symbolics extensions |
| Lists, sequences, predicates, and equality | Changes argument order and test conventions rather than blindly renaming |
| Strings | Converts comparison, case, search, trimming, and destructive/non-destructive variants while preserving option intent when recognized |
| Hash tables | Moves old hash operations toward Common Lisp or Symbolics Common Lisp equivalents |
| Reader, printer, streams, and format | Rewrites old stream messages and optional argument conventions |
| Packages, files, and pathnames | Converts locally expressible operations while retaining implementation-specific services when necessary |
| Variables and locations | Converts special-variable names and access forms; locative semantics can remain nonportable |
| Errors, query functions, and processes | Rewrites supported local idioms but does not promise a portable process model |

The separate structure set has two direct converter declarations: one for old
`DEFSTRUCT` forms and a default constructor-call converter applied after specific
function matches. It analyzes options and slot forms rather than treating
`DEFSTRUCT` as a simple symbol substitution.

### Limits and manual gaps

The manual explicitly excludes ZetaLisp operations with no Common Lisp analogue,
uses hidden inside macros, and complex conversions requiring surrounding code to be
rearranged. Such forms remain visibly `ZL:`-qualified after the package phase. The
output is Symbolics Common Lisp, not necessarily portable Common Lisp; a second
portability pass is required.

The manual's stepwise-equivalence statement is best read as the workflow's design
goal, not a theorem about arbitrary input. The source offers alternative semantics
for operations such as division, retains locative-related extensions, skips parse
failures, and sometimes emits warnings. No end-to-end runtime conversion was possible
in the unloaded world, so universal equivalence remains deliberately unclaimed.

## Flavors to CLOS

The Flavors converter is stateful and protocol-aware. It can turn a flavor into a
same-named class; derive slots, initargs, readers, writers, accessors, and default
initialization; transform Flavor methods into CLOS methods with an explicit `SELF`
specialization; wrap direct slot use with `WITH-SLOTS`; convert messages to generic
function calls; and translate whoppers to around methods using next-method behavior.
It has special paths for initialization, construction, printing, describing, and a
FASD-related method form.

The source contains 19 direct converter declarations over these 15 distinct source
operators:

`DEFFLAVOR`, `DEFGENERIC`, `DEFMETHOD`, `DEFWHOPPER`, `DEFWHOPPER-SUBST`,
`DEFUN-IN-FLAVOR`, `DEFSUBST-IN-FLAVOR`, `DEFMACRO-IN-FLAVOR`, `SEND`,
`LEXPR-SEND`, `BOUNDP-IN-INSTANCE`, `CHANGE-INSTANCE-FLAVOR`,
`DEFINE-SIMPLE-METHOD-COMBINATION`, `MAKE-INSTANCE`, and
`SYMBOL-VALUE-IN-INSTANCE`.

The declaration count exceeds the distinct-name count because operations including
message send and instance-variable mutation have alternative conversions. Generic
function names and new-style `SETF` argument order sometimes require a programmer's
choice.

### Evidence used for cross-form decisions

For a flavor or generic function, the converter consults facts in this order:

1. definitions already analyzed in the current conversion;
2. matching definitions in open editor buffers; and
3. loaded Flavor metadata in the running world.

This means conversion quality can depend on which files are open or loaded. A buffer
or whole-system Tag Table pass can know more than an isolated region pass. It also
means a result cannot be reproduced from the changed form alone without recording
the source domain and world state.

### Deliberately visible unfinished work

Unsupported flavor and generic-function options are not silently discarded. The
implementation carries them into intentionally invalid
`:UNCONVERTED-FLAVOR-OPTIONS` or `:UNCONVERTED-DEFGENERIC-OPTIONS` clauses, with
hints, so compilation exposes remaining work. Locatable slots use the Symbolics
`:LOCATOR` CLOS extension and therefore do not become portable merely because the
class conversion succeeds.

The source also records these semantic losses or open design questions:

- wrappers remain unconverted;
- `DEFWHOPPER-SUBST` becomes an around method without preserving inline compilation;
- `DEFSUBST-IN-FLAVOR` loses its inline declaration;
- a simple method combination's pretty name is not retained;
- `:WHICH-OPERATIONS` lacks an established conversion;
- the `:CONSTRUCTOR` flavor option is not converted automatically; and
- whether `:REQUIRED-FLAVORS` should become direct superclasses is explicitly left
  unresolved.

The manual's complete unsupported list is:

`COMPILE-FLAVOR-METHODS`, `DEFINE-METHOD-COMBINATION`, `DEFWRAPPER`, `:FASD-FORM`,
`GET-HANDLER-FOR`, `LEXPR-SEND-IF-HANDLES`, `OPERATION-HANDLED-P`,
`RECOMPILE-FLAVOR`, `SEND-IF-HANDLES`, `:UNCLAIMED-MESSAGE`, and
`:WHICH-OPERATIONS`.

The appearance of `:FASD-FORM` in that supported-documentation exclusion beside an
implementation special case is not necessarily a contradiction: the converter can
recognize one method pattern without supporting the facility generally. The safe
conclusion is that every such result requires inspection.

The manual warns that arbitrary mixing is constrained: a class cannot inherit from a
flavor, a flavor cannot inherit from a class, and Flavor generic functions do not
become general dispatchers for CLOS methods or instances. The explicitly supported
bridge is the other direction: CLOS generic functions can be applied to Flavor
instances, and CLOS methods can specialize on a flavor as though it were a class. It
therefore recommends converting all uses of a given flavor and all Flavor methods for
a given generic function together, preferably in a new package so old and new
versions can be compared.

## Symbolics Common Lisp to portable Common Lisp

The **Symbolics Common Lisp to portable Common Lisp** set targets the conservative
common subset described by the first edition of *Common Lisp: The Language* when
possible. It does not target one contemporary vendor. For some later standardized
facilities it leaves or introduces `FUTURE-COMMON-LISP` references rather than
inventing a pre-standard substitute.

Its raw direct-registration census is 11 symbol substitutions, 109 function/form
converters, 10 macro-expansion converters, 4 funarg conversions, and 37 message
conversions. Multiple alternatives make the number of unique source operations
smaller than the form count. The set covers data, numeric, sequence, string, array,
hash-table, package, pathname, condition/restart, stream, allocation, and declaration
idioms. Pathname and stream messages form an important part of the migration because
old programs often expressed these operations through `SEND` rather than portable
functions.

### Explicit portability boundary

The implementation and manual agree on the following exclusions or compromises:

- Flavors and Dynamic Windows require their dedicated converters;
- `LOOP`, `DESTRUCTURING-BIND`, conditions, and dynamic-extent facilities are
  assumed to be available rather than reduced to first-edition constructs;
- interactive development operations such as call analysis are not converted;
- locatives and array leaders have no direct portable analogue;
- area and other Symbolics-only keyword arguments can be discarded, changing
  allocation or representation behavior;
- resources, initializations, system-construction definitions, and similar Genera
  facilities need a manual rewrite or a compatibility implementation; and
- nonlocal changes are outside the set's model.

The recommended proof process is therefore two-stage: compile the result in the
Common Lisp Developer and resolve warnings, then run the original under ordinary
Genera and the converted program under the Developer against the same test cases.
That is differential testing advice, not a promise that compilation alone proves
portability.

### The source-visible Common Lisp Developer cleanup set

The same module defines **Common Lisp to Common Lisp Developer** (`CL-TO-CLYDE`),
with 139 direct symbol substitutions and 12 guarded form conversions. Its purpose is
narrower: remove `CL:` qualifications only when the Common Lisp Developer's CLtL or
CLtL-Only symbol is effectively equivalent, while retaining prefixes that still mark
Symbolics extensions. The manual explicitly warns that global string replacement is
unsafe for this job.

“Clyde” is the internal source name of this set. No primary source inspected here
establishes it as an acronym, so this article does not expand it.

## Dynamic Windows to CLIM

The **DW to CLIM** set is a Genera migration implementation, not part of portable
CLIM itself. At the start of an operation it asks whether the target is CLIM 1.1 or
CLIM 2.0. It temporarily makes historical target symbols readable in the `CLIM`
package and removes those temporary exports afterward. The source identifies its
target snapshot as CLIM 1.1 and 2.0 interfaces current on 1992-07-27; this is an
important historical version boundary.

The raw source census is 44 symbol substitutions, 97 form conversions, and 27
message-conversion declarations over 26 distinct messages. No direct funarg
registration appears despite the set defining a funarg registration macro.

### Facility coverage

| Dynamic Windows concern | CLIM-directed work |
| --- | --- |
| Formatted output | Tables, rows, columns, cells, item lists, filling, indentation, textual lists, borders, and text styles |
| Presentations and input | Presentation types, `ACCEPT`, `PRESENT`, string forms, output-as-presentation, prompts, and input editing |
| Geometry and graphics | Transform creation/composition, coordinate scopes, colors, contrasting patterns, primitive drawing, and presentation erasure/redraw |
| Higher-level interaction | Accepting Values, command buttons, translators/actions, menus, completion, and suggestions |
| Commands and redisplay | Command construction/definition, accelerators, redisplayers, recorded output, and redisplayable present/format operations |
| Program framework | Framework definitions, panes, frame configuration, mouse tracking, and output-recording controls |
| Stream/window protocol | History, clearing, exposure, hierarchy, dimensions, character metrics, cursor/pointer position, and scrolling messages |
| Type utilities | Input contexts, tokens/completion, presentation-type arguments/defaults, parse errors, and accept-character input |

The converter validates keyword options rather than merely moving them. Shared
options are retained, known renamed options are rewritten, known Dynamic Windows-only
options are removed with a warning, and unknown options are preserved visibly under
`:UNCONVERTED-DW-OPTIONS`. When an option form cannot be analyzed safely, the source
form remains unconverted.

The target concepts—output recording, presentation types and input contexts,
command tables and application frames, panes/layout, drawing, and events—are defined
by CLIM. The mapping policy and its heuristics are Symbolics Conversion Tools
behavior. Keeping those layers separate avoids attributing a Genera-only migration
command or Dynamic Windows compatibility rule to the portable CLIM specification.

### Complete registration-name inventory

The 44 source names with direct symbol substitutions are:

`DW:WITH-ACCEPT-HELP`, `GRAPHICS:2PI`, `GRAPHICS:*IDENTITY-TRANSFORM*`,
`GRAPHICS:COMPOSE-TRANSFORMS`, `GRAPHICS:INVERT-TRANSFORM`,
`GRAPHICS:STREAM-TRANSFORM`, `GRAPHICS:WITH-GRAPHICS-TRANSLATION`,
`GRAPHICS:WITH-GRAPHICS-ROTATION`, `GRAPHICS:WITH-GRAPHICS-SCALE`,
`DW:BOX-EDGES`, `DW:BOX-LEFT`, `DW:BOX-TOP`, `DW:BOX-RIGHT`, `DW:BOX-BOTTOM`,
`DW:BOX-SIZE`, `DW::BOX-WIDTH`, `DW::BOX-HEIGHT`, `DW:*PROGRAM*`,
`DW:*PROGRAM-FRAME*`, `GRAPHICS:WITH-ROOM-FOR-GRAPHICS`,
`DW:WITH-OWN-COORDINATES`, `DW:IN-SUB-WINDOW`, `SCL:BEEP`,
`DW:PRESENTATION-TYPE-P`, `DW:PRESENTATION-OBJECT`, `DW:PRESENTATION-TYPE`,
`DW:WITH-TYPE-DECODED`, `DW:PRESENTATION-TYPE-NAME`, `DW::FIND-ACCEPT-HISTORY`,
`DW:INPUT-NOT-OF-REQUIRED-TYPE`, `DW:OBJECT-PARSED-NOT-OF-TYPE`,
`DW:COMPARE-CHAR-FOR-ACCEPT`, `DW::PTYPEP`, `DW:PRESENTATION-SUBTYPEP`,
`BOOLEAN`, `SYS:EXPRESSION`, `SYS:FORM`, `DW:MEMBER-SEQUENCE`,
`NULL-OR-TYPE`, `PATHNAME`, `SEQUENCE-ENUMERATED`, `SUBSET`, `TOKEN-OR-TYPE`,
and `TYPE-OR-STRING`.

The 97 source names with form converters are:

`FORMATTING-TABLE`, `FORMATTING-ROW`, `FORMATTING-COLUMN`, `FORMATTING-CELL`,
`FORMAT-CELL`, `FORMATTING-ITEM-LIST`, `FORMAT-ITEM-LIST`,
`FORMAT-TEXTUAL-LIST`, `FILLING-OUTPUT`, `INDENTING-OUTPUT`,
`FORMAT-GRAPH-FROM-ROOT`, `SURROUNDING-OUTPUT-WITH-BORDER`, `WITH-UNDERLINING`,
`WITH-CHARACTER-FACE`, `WITH-CHARACTER-FAMILY`, `WITH-CHARACTER-SIZE`,
`WITH-CHARACTER-STYLE`, `DW:ALIST-MEMBER`, `DW:DEFINE-PRESENTATION-TYPE`,
`DW:ACCEPT`, `ACCEPT-FROM-STRING`, `DW:PRESENT`, `DW:PRESENT-TO-STRING`,
`DW:WITH-OUTPUT-AS-PRESENTATION`, `DW:PROMPT-AND-ACCEPT`, `WITH-INPUT-EDITING`,
`GRAPHICS:MAKE-IDENTITY-TRANSFORM`, `GRAPHICS:MAKE-GRAPHICS-TRANSFORM`,
`GRAPHICS:TRANSFORM-POINT`, `GRAPHICS:TRANSFORM-DISTANCE`,
`GRAPHICS:UNTRANSFORM-POINT`, `GRAPHICS:UNTRANSFORM-DISTANCE`,
`GRAPHICS:STREAM-TRANSFORM-POINT`, `GRAPHICS:STREAM-UNTRANSFORM-POINT`,
`GRAPHICS:WITH-GRAPHICS-IDENTITY-TRANSFORM`,
`GRAPHICS:WITH-GRAPHICS-TRANSFORM`, `GRAPHICS:GRAPHICS-TRANSFORM`,
`GRAPHICS:GRAPHICS-TRANSLATE`, `GRAPHICS:GRAPHICS-ROTATE`,
`GRAPHICS:GRAPHICS-SCALE`, `COLOR:MAKE-COLOR`, `GRAPHICS:MAKE-CONTRASTING-PATTERN`,
`GRAPHICS:DRAW-POINT`, `GRAPHICS:DRAW-LINE`, `GRAPHICS:DRAW-ARROW`,
`GRAPHICS:DRAW-RECTANGLE`, `GRAPHICS:DRAW-POLYGON`, `GRAPHICS:DRAW-TRIANGLE`,
`GRAPHICS:DRAW-REGULAR-POLYGON`, `GRAPHICS:DRAW-ELLIPSE`,
`GRAPHICS:DRAW-CIRCLE`, `GRAPHICS:DRAW-OVAL`, `GRAPHICS:DRAW-STRING`,
`DW:ERASE-DISPLAYED-PRESENTATION`, `GRAPHICS:ERASE-GRAPHICS-PRESENTATION`,
`DW:REDRAW-DISPLAYED-PRESENTATION`, `DW::BOX-POSITION`, `DW::BOX-CENTER-X`,
`DW::BOX-CENTER-Y`, `DW:ACCEPTING-VALUES`, `DW:ACCEPT-VALUES-COMMAND-BUTTON`,
`DW:DEFINE-PRESENTATION-TRANSLATOR`, `DW:DEFINE-PRESENTATION-ACTION`,
`DW:DEFINE-PRESENTATION-TO-COMMAND-TRANSLATOR`,
`DW:DESCRIBE-PRESENTATION-TYPE`, `DW:MENU-CHOOSE`,
`DW:MENU-CHOOSE-FROM-DRAWER`, `DW:COMPLETING-FROM-SUGGESTIONS`, `DW:SUGGEST`,
`DW:DEFAULT-COMMAND-TOP-LEVEL`, `DW:GET-PROGRAM-PANE`,
`DW:SET-PROGRAM-FRAME-CONFIGURATION`, `DW:TRACKING-MOUSE`,
`DW:WITH-OUTPUT-RECORDING-DISABLED`, `DW:WITH-OUTPUT-TRUNCATION`,
`CP:BUILD-COMMAND`, `CP:DEFINE-COMMAND`, `DEFINE-CP-COMMAND`,
`CP:DEFINE-COMMAND-ACCELERATOR`, `DW:REDISPLAYER`,
`DW:WITH-REDISPLAYABLE-OUTPUT`, `DW:DO-REDISPLAY`, `DW:REDISPLAYABLE-PRESENT`,
`DW:REDISPLAYABLE-FORMAT`, `DW:DEFINE-PROGRAM-FRAMEWORK`,
`DW:WITH-PRESENTATION-INPUT-CONTEXT`, `DW:READ-STANDARD-TOKEN`,
`DW:WITH-ACCEPT-BLIP-CHARS`, `DW:WITH-ACCEPT-ACTIVATION-CHARS`,
`DW:COMPLETE-INPUT`, `DW:COMPLETE-FROM-SEQUENCE`,
`DW:WITH-PRESENTATION-TYPE-ARGUMENTS`, `DW:PRESENTATION-TYPE-DEFAULT`,
`SYS:PARSE-ERROR`, `DW:READ-CHAR-FOR-ACCEPT`, `DW:UNREAD-CHAR-FOR-ACCEPT`, and
`DW:PEEK-CHAR-FOR-ACCEPT`.

The message registrations are `:REDISPLAY-PANE`, `:GET-PANE`, `:CLEAR-HISTORY`, two
alternatives for `:CLEAR-WINDOW`, `:REFRESH`, `:EXPOSE`, `:DEEXPOSE`, `:BURY`,
`:SUPERIOR`, `:INFERIORS`, `:INSIDE-EDGES`, `:INSIDE-SIZE`, `:LINE-HEIGHT`,
`:INSIDE-WIDTH`, `:INSIDE-HEIGHT`, `:STRING-LENGTH`, `:CHARACTER-WIDTH`, `:VSP`,
`:READ-CURSORPOS`, `:SET-CURSORPOS`, `:MOUSE-POSITION`, `:SET-MOUSE-POSITION`,
`:X-SCROLL-POSITION`, `:X-SCROLL-TO`, `:Y-SCROLL-POSITION`, and `:Y-SCROLL-TO`.

### Source-visible limits beyond the manual

Implementation comments preserve useful uncertainty:

- compatibility of `SURROUNDING-OUTPUT-WITH-BORDER` was not fully checked;
- generated `DEFINE-PRESENTATION-TYPE` output might not compile cleanly;
- the changed `FRESH-LINE` rules in Accepting Values are not handled;
- some general type expressions cannot be determined at conversion time and remain
  unconverted;
- the scroll-message conversions deliberately do more work than their author liked;
  and
- the message inventory contains only convertible cases found in one inspected
  program, not a proof that all Dynamic Windows messages are covered.

The manual likewise says CLIM accepts fewer options than Dynamic Windows, and that
some visual-format choices must be redesigned rather than translated. The procedure
is to copy the application to a new package, load the appropriate CLIM target, run the
conversion over buffers or a Tag Table, review every warning, reformat and compile,
then use Flavors-to-CLOS and portability passes when required. Historical manual
references to old private patch files describe that documentation release; they are
not instructions to load those patches into this 436 media set.

There is no general TV-to-CLIM converter. The CLIM manual explicitly treats many TV
programs as redesign work because their window and event assumptions lack a
mechanical mapping.

## CLIM 1.1 to CLIM 2.0

The **CLIM 1.1 to CLIM 2.0** set uses the same query engine and temporary package
export strategy. Its raw census is 75 symbol substitutions and 44 form converters,
with no direct funarg or message registrations.

The contemporary CLIM manual says these conversion commands are supported only on
Genera. That statement concerns the migration utility; it does not make the resulting
CLIM 2 program Genera-only if the remaining implementation dependencies are removed.

It covers geometry and transforms; text, drawing, colors, and ink names; cursors and
stream spacing; output-record trees and replay; pointer events; presentations and
translators; gesture/input-editor names; menus; command tables; application-frame
accessors; and root-window/viewport helpers.

The 75 direct substitution source names are:

All names in the following two inventories are internal symbols in the `CLIM`
package; the repeated `CLIM::` prefix is omitted for readability.

`POINT-POSITION*`, `REGION-CONTAINS-POINT*-P`, `BOUNDING-RECTANGLE-POSITION*`,
`BOUNDING-RECTANGLE-SET-POSITION*`, `COMPOSE-ROTATION-TRANSFORMATION`,
`COMPOSE-SCALING-TRANSFORMATION`, `COMPOSE-TRANSLATION-TRANSFORMATION`,
`TRANSFORM-POINT*`, `UNTRANSFORM-POINT*`, `DRAW-CHARACTER`, `DRAW-CHARACTER*`,
`DRAW-STRING`, `DRAW-STRING*`, `DRAW-ICON`, `DRAW-ICON*`, `+BACKGROUND+`,
`+FOREGROUND+`, `MAKE-COLOR-RGB`, `MAKE-COLOR-IHS`, `STREAM-CURSOR-POSITION*`,
`STREAM-SET-CURSOR-POSITION*`, `STREAM-INCREMENT-CURSOR-POSITION*`,
`CURSOR-POSITION*`, `CURSOR-SET-POSITION*`, `STREAM-VSP`,
`OUTPUT-RECORD-POSITION*`, `OUTPUT-RECORD-SET-POSITION*`,
`OUTPUT-RECORD-START-POSITION*`, `OUTPUT-RECORD-END-POSITION*`,
`OUTPUT-RECORD-SET-START-POSITION*`, `OUTPUT-RECORD-SET-END-POSITION*`,
`OUTPUT-RECORD-ELEMENT-COUNT`, `OUTPUT-RECORD-ELEMENTS`, `REPLAY-1`,
`OUTPUT-RECORD-REFINED-SENSITIVITY-TEST`,
`OUTPUT-RECORDING-STREAM-OUTPUT-RECORD`,
`OUTPUT-RECORDING-STREAM-CURRENT-OUTPUT-RECORD-STACK`,
`OUTPUT-RECORDING-STREAM-REPLAY`, `ADD-OUTPUT-RECORD`, `STREAM-DRAW-P`,
`STREAM-RECORD-P`, `REDISPLAY-1`, `EVENT-WINDOW`, `POINTER-EVENT-SHIFT-MASK`,
`STREAM-POINTER-POSITION*`, `STREAM-SET-POINTER-POSITION*`, `POINTER-POSITION*`,
`POINTER-SET-POSITION*`, `DRAGGING-OUTPUT-RECORD`, `REMOVE-POINTER-GESTURE-NAME`,
`DIALOG-VIEW`, `+DIALOG-VIEW+`, `MENU-VIEW`, `+MENU-VIEW+`,
`*ACTIVATION-CHARACTERS*`, `*STANDARD-ACTIVATION-CHARACTERS*`,
`*BLIP-CHARACTERS*`, `ACTIVATION-CHARACTER-P`, `BLIP-CHARACTER-P`,
`WITH-ACTIVATION-CHARACTERS`, `WITH-BLIP-CHARACTERS`, `*ABORT-CHARACTERS*`,
`*COMPLETE-CHARACTERS*`, `*HELP-CHARACTERS*`, `*POSSIBILITIES-CHARACTERS*`,
`INPUT-POSITION`, `INSERTION-POINTER`, `RESCANNING-P`, `*UNSUPPLIED-ARGUMENT*`,
`FRAME-TOP-LEVEL-WINDOW`, `WINDOW-VIEWPORT-POSITION*`,
`WINDOW-SET-VIEWPORT-POSITION*`, `POSITION-WINDOW-NEAR-CAREFULLY`,
`POSITION-WINDOW-NEAR-POINTER`, and `SIZE-MENU-APPROPRIATELY`.

The 44 form-converter source names are:

`WITH-BOUNDING-RECTANGLE*`, `MAKE-3-POINT-TRANSFORMATION`,
`MAKE-3-POINT-TRANSFORMATION*`, `WITH-TEXT-FACE`, `WITH-TEXT-FAMILY`,
`WITH-TEXT-SIZE`, `WITH-TEXT-STYLE`, `ADD-TEXT-STYLE-MAPPING`,
`WITH-END-OF-LINE-ACTION`, `WITH-END-OF-PAGE-ACTION`,
`WITH-OUTPUT-RECORDING-OPTIONS`, `ADD-OUTPUT-RECORD-ELEMENT`,
`DELETE-OUTPUT-RECORD-ELEMENT`, `MAP-OVER-OUTPUT-RECORD-ELEMENTS`,
`MAP-OVER-OUTPUT-RECORD-ELEMENTS-CONTAINING-POINT*`,
`MAP-OVER-OUTPUT-RECORD-ELEMENTS-OVERLAPPING-REGION`, `FORMATTING-TABLE`,
`FORMATTING-CELL`, `FORMATTING-ITEM-LIST`, `FORMAT-ITEMS`,
`WITH-OUTPUT-AS-PRESENTATION`, `ACCEPT`, `FIND-PRESENTATION-TRANSLATORS`,
`TEST-PRESENTATION-TRANSLATOR`, `FIND-APPLICABLE-TRANSLATORS`,
`PRESENTATION-MATCHES-CONTEXT-TYPE`, `FIND-INNERMOST-APPLICABLE-PRESENTATION`,
`DEFINE-GESTURE-NAME`, `ADD-POINTER-GESTURE-NAME`,
`CALL-PRESENTATION-GENERIC-FUNCTION`, `MENU-CHOOSE`, `DRAW-STANDARD-MENU`,
`HIERARCHICAL-MENU-CHOOSE`, `DISPLAY-COMMAND-TABLE-MENU`,
`ADD-COMMAND-TO-COMMAND-TABLE`, `ADD-KEYSTROKE-TO-COMMAND-TABLE`,
`REMOVE-KEYSTROKE-FROM-COMMAND-TABLE`, `READ-COMMAND`,
`READ-COMMAND-USING-KEYSTROKES`, `SET-FRAME-LAYOUT`, `COMMAND-ENABLED-P`,
`DISABLE-COMMAND`, `ENABLE-COMMAND`, and `OPEN-ROOT-WINDOW`.

The decisive unsupported case is `DEFINE-APPLICATION-FRAME`: the converter does not
rewrite its `:PANES` or `:LAYOUTS` options because the CLIM 2 model is substantially
different and there is no generally correct answer. That omission is documented in
the manual and visible in the absence of a registration. Methods on
`RUN-FRAME-TOP-LEVEL` can also require a manual `&KEY` lambda-list change.

The CLIM manual explicitly advertises Buffer and Tag Table operation for this set.
Because the generic command layer accepts every conversion set, the source also makes
the Region command technically selectable; this is a source-visible capability not
promoted by the CLIM migration procedure. It has not been runtime-verified here.

## Defining a custom conversion set

`CONVERSION-TOOLS:DEFINE-CONVERSION-SET` is the public extension point. Its complete
argument list is:

`SET-NAME SYMBOL-MACRO FUNCTION-MACRO &KEY FUNARG-MACRO MESSAGE-MACRO
SEND-FUNCTIONS PRETTY-NAME SEARCH-STRINGS DEFAULT-CONVERSIONS`.

The macro creates registration macros chosen by the caller:

| Registration kind | Match context | Complete option surface |
| --- | --- | --- |
| Symbol | The old symbol wherever it occurs, unless a more specific function or funarg match wins | old symbol and new symbol |
| Function/form | A symbol in operator position with a macro-style argument template | `:FORM`, `:NAME`, `:MODIFICATION-DEPTH`, `:DOCUMENTATION`, `:DOCUMENTATION-LEVEL`, `:DOCUMENTATION-LENGTH` |
| Funarg | `#'name` or `(FUNCTION name)` | `:NEW-FUNCTION`, `:NAME`, `:MODIFICATION-DEPTH`, `:DOCUMENTATION`, `:DOCUMENTATION-LEVEL`, `:DOCUMENTATION-LENGTH` |
| Message | A configured send function whose literal message name is recognized | function-converter options plus `:FLAVOR`, which can name one receiver type or an `(OR ...)` type expression |

`SEND-FUNCTIONS` defaults to `SEND` and can include other calling conventions such as
`FUNCALL`. `PRETTY-NAME` is the value accepted by the Zmacs conversion prompt.
`SEARCH-STRINGS` overrides the automatically derived candidate strings for speed or
to find generated command-definer names. `DEFAULT-CONVERSIONS` names form converters
that are tried after any converter specific to the source operator.

A function converter's template quietly rejects calls with the wrong shape. Its
`:FORM` computes a replacement or returns `NIL` to decline. `:MODIFICATION-DEPTH`
describes how deeply changed lists should be considered when preserving source
correspondence. The documentation print-level and print-length options control how
alternatives are explained, not conversion semantics. A message converter with a
`:FLAVOR` restriction can infer the receiver type from known program state or a
matching variable name; otherwise it asks the programmer rather than silently
assuming the type.

Each detailed registration macro also has a positional abbreviation when no other
options are needed: function and message registrations accept the computed form
after the template, while a funarg registration accepts the replacement function
after the old name.

The public manual says message conversions still needed documentation in one
editorial note, yet the same installed reference entry specifies their complete
argument surface. This is an internal documentation seam, not an absence of the
implemented facility.

## The declared Statice converter boundary

The system graph declares `Flavors-Statice-to-CLOS-Statice`, dependent on Statice and
restricted to 3600/IMach builds. The 436 IMach component inventory contains it; the
VLM component inventory and inspected VLM source tree do not. Therefore this article
can establish the module's name, dependency, platform restriction, and absence from
the VLM media, but cannot responsibly describe its mappings.

**TODO:** inspect an independently licensed 436 IMach source artifact, if one becomes
available, before documenting Statice conversion behavior. Do not infer that behavior
from the module name.

## Runtime observation: present on media, absent from the world

A fresh Genera computer-use session made only read-only Listener queries. It did not
invoke `Load System Conversion-Tools`, create a package, open customer source, or run
any converter.

The first query checked the system version, package, and four representative command
symbols. It observed:

- `SCT:GET-SYSTEM-VERSION` returned no loaded version;
- the `CONVERSION-TOOLS` package existed;
- `COM-CONVERT-FUNCTIONS-OF-BUFFER`,
  `COM-CONVERT-LISP-SYNTAX-OF-BUFFER`,
  `COM-CONVERT-PACKAGE-OF-BUFFER`, and
  `COM-FIND-CONFLICTING-SYMBOLS-IN-BUFFER` were not present in `ZWEI`; and
- no function binding existed for those absent command symbols.

The second query scanned the live system list and conversion substrate. It found no
system whose name contained “Conversion,” no bound conversion-set registry, and a
`CONVERSION-TOOLS:DEFINE-CONVERSION-SET` symbol without a function binding. Together
these observations establish an interned package shell, not a loaded application.

This is why no conversion demonstration or application screenshot appears here. The
only available captures show a generic Dynamic Lisp Listener displaying the load-state
queries; they do not show Conversion Tools behavior and would add licensed screen
content without enough evidentiary value. They remain in the ignored session tree.
A useful screenshot requires a separately justified, read-only optional-system load
and a disposable source buffer; that media path and side-effect boundary have not yet
been proved.

### Runtime provenance

| Field | Recorded value |
| --- | --- |
| Session | `d39-conversion-tools-20260718`, generation 1 |
| Boot/start/stop | boot 2026-07-18 10:00:52 -04:00; main window 10:00:56; stopped 10:04:36 |
| World | `Genera-8-5.vlod`; 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Licensed archive | `opengenera2.tar.bz2`; 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| VLM and debugger | VLM 1,533,760 bytes, SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger 346,880 bytes, SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Display | `Genera on DIS-LOCAL-HOST`, 1200 by 900 pixels |
| Action record | Four records: intent and outcome for each of two successful typed queries; SHA-256 `de8ba7341d667dd39adce4016c9434ff06283aaded983cf73ba2bacb2de04707` |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; read-only Guix store/helpers/X socket; writable private runtime; no external route or host file service; MIT-SHM absent |
| Persistence | Base and private world hashes unchanged; harness did not invoke Save World or create a host checkpoint; in-guest save/checkpoint status remains unknown |
| Shutdown | Prompt observed, `yes` sent and accepted, cleanup progress observed, then the known VLM cleanup stall required bounded `SIGKILL`; `forced_stop=true`, `orderly_vlm_host_shutdown=false`, `state_may_be_incomplete=true` |

The accepted shutdown confirmation is not described as orderly exit, and unchanged
world hashes are not used to infer anything about arbitrary in-guest Save World
semantics.

## Preservation implications

Conversion Tools preserve more than a table of old and new names. Historically
meaningful behavior resides in:

- the ordered editor workflow;
- the correspondence reader and minimal-edit installer;
- the query language, especially conditional old/new output and remembered choices;
- conversion state that learns from a program and running world;
- warnings and deliberately invalid unfinished markers;
- per-target CLIM package preparation; and
- example programs that exercise syntax, structure, and radix cases.

A modern reimplementation based only on mapping tables would lose most of that
behavior. Conversely, running the original tool is not archival proof that the output
is equivalent. A preservation-grade experiment should retain source and destination
buffer hashes, package/syntax/base attributes, conversion set and system versions,
ordered answers, warnings, before/after compile diagnostics, behavioral tests, and
the complete harness record.

The original examples are licensed and remain local. They may be used as private test
inputs, but this repository should not publish their text or converted output.

## Open questions and next experiments

- **TODO — safe optional load:** prove that the VLM can load Conversion Tools 436 and
  its CLIM dependency entirely from the private read-only media copy without file
  service, patch, world-save, or source-tree writes.
- **TODO — interaction exercise:** in a disposable in-memory buffer, exercise one
  syntax, radix, package, and function conversion; record query UI, undo granularity,
  comment retention, reindent behavior, and buffer attributes without saving.
- **TODO — conditional query:** verify `#`, Control-`#`, base-36 choice, and typeout
  search against the live 436 command loop.
- **TODO — differential proof:** run the supplied private examples through the
  intended phases and compare compilation and behavior after each phase, retaining
  only hashes, diagnostics, and original analysis.
- **TODO — release lineage:** inspect licensed 7.1 and 8.0 implementation snapshots,
  if lawfully available, before attributing a particular internal algorithm to the
  first release rather than 436.
- **TODO — Statice:** inspect an appropriately licensed IMach artifact; the VLM media
  cannot answer this question.

## Local artifact identities

The following portable records identify the licensed inputs without publishing their
paths or contents.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Conversion Tools source tree, 33 files | 1,897,990 | Relative sorted-manifest hash `963867901739b6753390fe354915979b8b7c2387c00a341ab593ab39b563cdf9` |
| `sysdcl.lisp.~28~` | 3,811 | `6d4600bf67e7ede3764916645c1d7afe8811eed949bf280b9872fa0b58460b6d` |
| `editor.lisp.~86~` | 79,840 | `2506ce91be25642da5e85e944d130a9be1e481eac0241462817de61c6dcd3cc3` |
| `reader.lisp.~36~` | 14,055 | `c478e62b31c5f07b52a44538eafa38d17b319f0be1ccd31968df2efcf044dc7b` |
| `convert-functions.lisp.~37~` | 22,710 | `50f4a05b8bba7ba611664443d1686156dbce16f377d278a2b3cb4ffcb6a9569d` |
| `zetalisp-conversions.lisp.~69~` | 57,964 | `bb0b74c031205fc28f4fc5d19fa27b5ef68166d50f07034e0a0adad76b476440` |
| `flavors-to-clos.lisp.~17~` | 46,220 | `a72702caba2051f3d5ff100e9a5fffebbd57432876c4c36c960fc12931274a8d` |
| `scl-to-cl.lisp.~3~` | 78,404 | `2ee02d8df98f85a606f19afeb71f60ca93b7491ba7d230a8bc7389a2be08057b` |
| `dw-to-clim.lisp.~50~` | 123,785 | `46de18026baecae99595c486d973539e24ff467e0082996460d56b88a5446c8c` |
| `clim1-to-clim2.lisp.~3~` | 26,379 | `8b47985e78e65b8d846999315b7ad82332a504bf4a4877da05af13750e726210` |
| Recovered Conversion Tools Help text | 70,897 | `d177a38fbe6f4a10b8f8920e976289a5cc63da3f474b0531f94cbd8632504e54` |
| Recovered CLIM user-guide Help text | 87,123 | `582f13759245cef25d7e64f2286ada6939555baae09747866b274ac486d94981` |
| Recovered Genera Help catalog | 577,696 | `a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed` |

The source-tree manifest was produced by sorting relative filenames, hashing each
file, and hashing that normalized checksum stream. It is an identity for this local
inspection set, not a redistributable source bundle.

## Sources

- Symbolics, [*Program Development Utilities*](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf),
  “Conversion Tools”; local copy 2,292,247 bytes, SHA-256
  `2c6e23e4a0f969cb7962b71f0ed0eb390b47e394195f6ed9e7a862ba33914d6f`.
- Symbolics, [*Genera 8.0 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.0_Release_Notes.pdf),
  “Enhanced Conversion Tools in Genera 8.0.”
- Symbolics, [*Genera 8.1 Release Notes*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.1_Release_Notes.pdf),
  “New Conversion Tools in Genera 8.1” and “Miscellaneous Changes to Conversion
  Tools in Genera 8.1.”
- Symbolics, [*Common Lisp Interface Manager (CLIM), Release 2.0*](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf),
  “Converting from Dynamic Windows to CLIM” and “Converting From CLIM 1.1 to CLIM
  2.0”; local copy identity recorded in [CLIM 2 on Genera](clim-2-on-genera.md).
- Symbolics, [*CLIM 2.0 Release Notes and Installation Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/CLIM_2.0_Release_Notes_and_Installation_Guide.pdf),
  installation and compatibility context.
- [CLIM II Specification](https://dept-info.labri.fr/~strandh/Teaching/PFS/Common/CLIM-spec/cover.html), used
  only to distinguish portable target concepts from Genera's converter behavior.
- [Zmacs on Genera](genera/zmacs.md), [Flavors, CLOS, and the Flavor
  Examiner](flavors-clos-and-flavor-examiner.md), [Dynamic Windows and
  presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md),
  and [CLIM 2 on Genera](clim-2-on-genera.md) provide the surrounding editor,
  object-system, and interface context.

Last verified: 2026-07-18.
