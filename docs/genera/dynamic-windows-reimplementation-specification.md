---
type: Reimplementation Specification
title: Symbolics Genera Dynamic Windows reimplementation specification
description: A reconstruction-grade D0-D4 semantic and behavioral specification of Genera's presentation substrate, typed input and output, handlers, commands, formatted output, redisplay, graphics, program frameworks, and reusable clients, with D5 reserved for exact historical source compatibility.
tags: [genera, dynamic-windows, presentations, command-processor, reimplementation, specification, preservation]
timestamp: 2026-07-19T00:35:29-04:00
---

# Symbolics Genera Dynamic Windows reimplementation specification

## Status and reconstruction claim

This document specifies a new implementation of the native Dynamic Windows semantic
stack represented by the preserved Symbolics Genera 8.5 environment. It is intended
to let an engineering team recreate the system's interaction model, public
programming concepts, and observable behavior through compatibility level D4 without
reusing the original implementation. It covers the presentation substrate, typed
input and output, handler resolution, presentation histories, completion, the Command
Processor boundary, formatted output, output records, incremental redisplay, Dynamic
Window streams, graphics integration, program frameworks, pane types, Accepting
Values, menu programs, and sequence-reordering clients.

The current target is semantic and behavioral compatibility through `DW-G85/D4`, not
a byte-identical Ivory world and not yet drop-in compatibility for arbitrary
historical source. Exact public package/symbol names, argument lists, macro option
grammars, condition and restart contracts, multiple-value conventions, and the full
predefined type and handler libraries belong to the separately reserved
`DW-G85/D5` level. The implementation may use CLOS, another object system, retained
scene graphs, a GPU, or a host event loop. It MUST nevertheless preserve the
distinctions among application objects, presentation types, displayed presentations,
output records, input contexts, handlers, commands, and raw TV windows. A conventional
widget callback system with those names attached does not conform at D0-D4.

This is a rights-conscious technical specification, not a legal opinion or a claim
that every unpublished implementation detail is unprotectable. Licensed source and
decoded Help remain local and untracked. This page records interface names, file
identities, original analysis, observed behavior, and independently stated
algorithms; it does not reproduce proprietary source listings or substantial manual
text.

## What Dynamic Windows is, and is not

Dynamic Windows is a semantic user-interface layer on top of Genera's TV window
system. Its defining relationship is:

```text
application object
    + presentation type and parameters
    + displayed representation and region
    + active input context
    + applicable gesture handler
    -> object, translated object, action, or command
```

It is not merely:

- the low-level TV sheet/window hierarchy;
- a bitmap drawing library;
- the Command Processor alone;
- a set of program-frame panes;
- the later portable CLIM implementation; or
- a widget toolkit in which rectangles own callbacks.

Genera's system declaration keeps `TV`, `PRESENTATION-SUBSTRATE`, `CP`,
`DYNAMIC-WINDOWS`, and `DYNAMIC-WINDOW-CLIENTS` as distinct ordered subsystems. A
reimplementation MUST preserve those behavioral boundaries even if it packages them
together.

## Normative language and evidence codes

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative. Exact Lisp interface names are retained when they identify a historical
contract. Pseudocode describes required effects, not the original source.

| Code | Meaning |
| --- | --- |
| `G85-SRC` | Original analysis of readable licensed source selected for the installed Genera 8.5 / System 452.22 tree; no source text is reproduced |
| `G85-WORLD` | Compiled definitions, system state, or subsystem presence established in the licensed 8.5 world/VLOD |
| `G85-RUN` | Direct behavior through the isolated Genera Xvfb harness |
| `G8-MAN` | Public Symbolics Genera 8 manuals |
| `UIST89` | McKay, York, and McMahon's contemporary Dynamic Windows paper |
| `INFERRED` | An implementation-independent synthesis, explicitly not attributed as original wording |
| `TODO-RUNTIME` | Source/manual-supported behavior not yet exercised in the preserved world |

A paper-era limitation is not automatically a Genera 8.5 requirement. A readable
source definition is not automatically loaded in the preserved world. A screenshot
establishes pixels and interaction, not hidden type descriptors or object identity.
`INFERRED` marks a clean-room design rule synthesized to preserve an established
observable invariant; it does not assert that Genera used that representation or
algorithm. When source-established behavior and an inferred implementation rule share
a section, each inferred paragraph is labeled explicitly.

## Compatibility profiles and levels

The primary profile is `DW-G85`, the Dynamic Windows facilities in Genera 8.5 with
System 452.22 source media and the identified 8.5 world. An implementation MAY add a
historical `DW-1989` profile for behavior documented by the contemporary paper, but
MUST NOT use it to override later `DW-G85` evidence.

| Level | Name | Required facilities |
| --- | --- | --- |
| D0 | Presentation substrate | Type descriptors, type lattice, printers/parsers, views, presentation records, input contexts, histories, completion, gestures, handlers, and semantic diagnostics |
| D1 | Command interaction | Command definitions and objects, command tables/inheritance, keyboard accelerators, menus, typed and pointer arguments, command loop, and Help metadata |
| D2 | Dynamic output | Output histories, hit testing, highlighting, formatted output, output records, replay, and incremental redisplay |
| D3 | Program environment | Dynamic Window streams, graphics/viewport integration, panes, constraints/configurations, program-framework lifecycle, activities and selection |
| D4 | Reusable clients | Standalone and pane Accepting Values, menu program, reorder/alter sequences, branching undo, and Frame-Up-compatible generated frameworks |
| D5 | Historical source interface | Exact public package/symbol names, signatures, macro grammars, conditions/restarts, multiple values, predefined type signatures, standard handlers, and every source-facing selected subfacility |

A claim such as `DW-G85/D2` means all lower levels also conform. `DW-G85/D5` is
reserved and MUST NOT be claimed until the API and selected-module coverage appendix
has no D5-pending entry required by the historical program being compiled. D5 means
drop-in historical source compatibility over D0-D4; it does not imply QFASL, Ivory
object-layout, world-image, or private wire-format compatibility. Low-level TV
behavior is a dependency. The
[TV window-system reimplementation specification](../mit-cadr/tv-window-system-reimplementation-specification.md)
specifies the preserved MIT CADR/LM-3 ancestor, not an exact Genera 8.5 TV contract.
This document specifies only the Genera-TV dependency subset Dynamic Windows needs;
exact Genera TV parity beyond that boundary remains out of scope and `TODO-RUNTIME`.

## Evidence ledger

| Facility | Readable source evidence | World/compiled evidence | Observed behavior | Manual/paper evidence |
| --- | --- | --- | --- | --- |
| Type and handler substrate | Type descriptors, definition macros, type walking, lookup, standard type modules, dynamic input, basic handlers | Presentation functions, types, handlers, and Presentation Inspector are resident in the base world | Integer presentations, type-specific Boolean rejection, handler inspection, and contextual pointer documentation | `G8-MAN`, `UIST89` |
| Commands | Separate CP subsystem plus Dynamic Windows command integration | Dynamic Lisp Listener and program frames execute command objects from resident tables | Typed command names, completion, accelerators, command menus, and presentation-produced commands work | `G8-MAN`, `UIST89` |
| Output and redisplay | Formatted-output, displayed-presentation, Dynamic Window, and redisplay modules | Base world retains presentation-sensitive output histories and redisplay machinery | Presentation Inspector, Display Debugger, Frame-Up, Inspector, and Accepting Values redraw semantic output | `G8-MAN`, `UIST89` |
| Frameworks and panes | Framework generator, pane registry, Accepting Values, layout designer | Numerous resident applications are concrete program frameworks | Frame-Up split a pane and returned; standalone Set GC Options form accepted navigation and pointer abort | `G8-MAN` |
| Graphics | Graphics generics, patterns, raster mixin, viewport operations, graphing, binary graphics | Resident drawing applications and display programs use the facilities | Graphic and raster applications, Frame-Up model, and presentation highlighting draw in the live world | `G8-MAN`; later source extends the paper-era account |

The world/compiled column is established by resident behavior and introspection of the
preserved world, not by extracting proprietary machine code into the repository.

### Section evidence map

This map is the evidence key for the normative sections below. Line spans refer to
the exact licensed witnesses in [Artifact identities](#artifact-identities). They are
portable artifact-relative paths, not machine paths. `G85-SRC` establishes selected
source behavior; it does not prove that every definition is the one currently patched
into the running world.

| Specification section | `G85-SRC` / selected component evidence | `G85-WORLD` and `G85-RUN` | Manual/paper cross-check |
| --- | --- | --- | --- |
| Layer graph | `patch/system-452/system-452.component-dir.~10~:370-457` | The five named systems and their clients are resident; full cold-load tracing remains `TODO-RUNTIME` | `G8-MAN` overview separates presentation, CP, Dynamic Windows, graphics, and frameworks |
| Type and data model | `dynamic-windows/substrate-definitions.lisp.~44~:148-481`; `type-descriptor.lisp.~12~:81-316`; `type-walk.lisp.~17~:58-887`; standard types in `core-types.lisp.~34~:137-1957`, `number-types.lisp.~5~:148-781`, `sequence-types.lisp.~28~:55-1893`, `presentation-types.lisp.~722~:58-1775`, and `sys2/character-style-presentations.lisp.~64~:371-671` | Presentation Inspector displayed live integer/symbol types and methods, but lattice edge cases and conditional live-name population remain `TODO-RUNTIME` | `G8-MAN`; `UIST89` type-lattice model |
| Typed output/history | `accept-substrate.lisp.~19~:217-249`; `displayed-presentation.lisp.~47~:64-720`; `dynamic-window.lisp.~625~:225-848,1214-3844` | Live Inspector and Presentation Inspector outputs retain sensitive objects | `G8-MAN` presentations and Dynamic Windows chapters; `UIST89` |
| Typed input/editor/completion | `accept-substrate.lisp.~19~:397-1339`; `io/input-editor.lisp.~332~:120-2309`; `completion.lisp.~206~:743-1923` | GC Boolean correction and pointer Abort are `G85-RUN`; full key/completion matrices are `TODO-RUNTIME` | `G8-MAN` input-editor, Accept, and completion chapters |
| Handlers/gestures | `define-handler.lisp.~12~:65-587`; `mouse-handler-lookup.lisp.~33~:1452-2220`; `dynamic-input.lisp.~498~:57-1313` | Presentation Inspector handler report is `G85-RUN`; synthetic tie tests are `TODO-RUNTIME` | `G8-MAN`; `UIST89` translator-selection section |
| Commands | `cp/comtab.lisp.~103~:55-423`; `cp/command-processor.lisp.~318~:532-2596`; `cp/read-accelerated-command.lisp.~142~:55-831` | Resident listeners/frameworks exercise commands; inheritance conflicts and every prefix path are `TODO-RUNTIME` | `G8-MAN` Command Processor chapters; `UIST89` application construction |
| Formatted output/redisplay | `formatted-output.lisp.~397~:76-2681`; `redisplay.lisp.~185~:57-2590` | Visible framework redisplay is `G85-RUN`; two-pass counters and pixel-copy ordering are `TODO-RUNTIME` | `G8-MAN` output, replay, and incremental-redisplay chapters |
| Graphics | `graphics-flavors.lisp.~21~:59-192`; `graphics-generics.lisp.~246~:123-4005`; `raster-graphics-mixin.lisp.~157~:57-2393`; `define-viewport-graphics-operation.lisp.~62~:57-1459` | Live clients draw and highlight; primitive edge/raster cases are `TODO-RUNTIME` | `G8-MAN` graphics overview/dictionary; the later source exceeds `UIST89`'s paper-era account |
| Frameworks/panes/activities | `program-framework-panes.lisp.~32~:58-459`; `define-program-framework.lisp.~332~:55-340,1106-1233,1343-1426,1726-1789`; `window/activities.lisp.~35~:65-554` | Frame-Up split-pane session is `G85-RUN`; exhaustive pane/lifecycle behavior is `TODO-RUNTIME` | `G8-MAN` framework and pane chapters |
| Accepting Values/FQUERY/clients | `accept-values.lisp.~244~:105-1706`; `io1/fquery.lisp.~104~:55-327`; selected client modules | GC options is `G85-RUN`; generic menu/reorder/alter clients are `TODO-RUNTIME` | `G8-MAN` Accepting Values and query facilities |

The manual corroborates the public model but omits several source-visible rules: the
four-state internal subtype result, handler name/package tie-break, semantic blips in
the input buffer, redisplay's collection/display identity check, the seventh standard
`TREE-BROWSER` pane, and several failure-recovery paths. Conversely, a source-only
branch remains labeled `TODO-RUNTIME` until a harmless synthetic oracle reaches it.

## Layer graph and dependency rules

### `TV`

TV supplies screens, sheets, raster operations, stream primitives, windows, mouse
routing, menus, frames, color, and graphics foundations. Selected Dynamic Windows
graphics and flavor mixins load during TV construction in the inspected release. This
is a boot dependency, not evidence that TV and Dynamic Windows are the same system.

### `PRESENTATION-SUBSTRATE`

The substrate owns type descriptors and methods, type definition, handler
definition, histories, standard types, completion, typed acceptance, input contexts,
and handler matching. It MUST be usable without the full program-framework layer.

### `CP`

The Command Processor owns command tables and the command reader/executor. It uses
presentation input and can be embedded in Dynamic Window programs, while remaining a
separate command-language subsystem.

### `DYNAMIC-WINDOWS`

The core adds formatted output, redisplay, box arithmetic, displayed-presentation
records, Dynamic Window streams, viewport graphics, window combinations, graphing,
color, and binary graphics.

### `DYNAMIC-WINDOW-CLIENTS`

The client layer adds framework panes, `DEFINE-PROGRAM-FRAMEWORK`, Accepting Values,
queries, and sequence-reordering utilities. Loading a client MUST NOT redefine the
meaning of core presentation matching.

## Semantic data model

### Domain object

A domain object is application-owned state. Dynamic Windows MUST NOT require it to
inherit from a UI class, contain a screen rectangle, or retain callbacks. Object
identity MUST be preserved when a presentation is selected; reparsing printed text is
only one alternate input path.

### Presentation type specifier

```text
PresentationTypeSpecifier {
  type_name
  data_arguments
  presentation_arguments
  meta_options
}
```

Data arguments refine semantic membership and subtype relationships. Presentation
arguments control parsing, printing, view, prompts, defaulting, or other interaction
without necessarily changing the accepted object set. Meta options are interpreted
by the substrate rather than the type's membership predicate.

The implementation MUST retain the complete specifier through parsing, output,
handler lookup, and diagnostics. It MUST NOT reduce every presentation type to a host
language class.

### Type descriptor

```text
PresentationTypeDescriptor {
  name
  lambda_lists_for_data_and_presentation_arguments
  pretty_name_and_obsolete_state
  inheritance_generators_and_equivalent_types
  printer_parser_and_type_description_methods
  views_and_default_view_methods
  default_and_input_history_methods
  highlighting_choose_menu_and_accept_values_displayers
  subtype_supertype_walk_and_membership_operations
  lisp_type_or_membership_predicate
  cache_key_generators_and_cache_policy
  optional_binary_graphics_method
  protocol_flags_and_version
  definition_generation
}
```

A descriptor can provide printer, parser, type-name printer, describer, input-history
policy, default preprocessing, postprocessing, highlighting-box computation, menu and
Accepting Values displayers, views, subtype walking/predicates, equivalent host type,
and binary-graphics encoding. Methods can be inherited or obtained through type
expansion. (`G85-SRC`, `G8-MAN`)

`G85-SRC` establishes mutable descriptors, definition generations, and dependent
caches. The following publication rule is `INFERRED`: readers MUST see the old
complete descriptor or the new complete descriptor, never a partially installed
method set. Completing a definition advances its generation and invalidates affected
method, subtype, common-supertype, type-key, and handler caches. A replacement MAY use
immutable descriptor snapshots rather than reproducing Genera's mutable
representation.

### Displayed presentation

```text
DisplayedPresentation {
  object_or_locator
  source_form_or_location
  type_specifier
  view
  region_or_bounding_box
  parent: DisplayedPresentation | OutputRecord | null
  children
  sensitivity_policy
  highlight_policy
  stream_and_history_identity
  rendering_record_or_replay
  metadata
  liveness_state
}
```

The record MUST connect the exact object to its visible representation. Presentations
may nest. A parent can share a highlighting region with children, allow or suppress
sensitive inferiors, or present the same pixels at another semantic level. A record
can remain in output history after scrolling out of the viewport, but it is pointer
eligible only when its transformed region is currently visible.

The semantic object can be stored directly, recovered from an application location,
or recomputed from a recorded form under the selected protocol. No output record may
retain a dead stack/ephemeral reference after its dynamic extent. A null presentation
marks deliberately nonsensitive output. A parent region can contain holes occupied by
children, and a graphics presentation can refine rectangular hit testing by shape and
priority/timestamp.

### Input context entry

```text
InputContextEntry {
  required_type_specifier
  superior_context_or_null
  throw_or_return_enabled
  options
  context_generation
}
```

Input contexts form a dynamic stack. The innermost active context gets the first
opportunity to consume matching input. Compound parsers can push subordinate contexts
while accepting components. A reduced context MAY add a predicate or transform but
MUST retain enough ancestry for matching and diagnostics.

Entering a context MUST install its input-editor, mouse-motion wakeup, input-wait, and
dynamic-blip behavior as required by the stream. Leaving it MUST announce the context
change and remove transient highlighting and documentation in unwind-protected
cleanup, including after Abort or an error.

### Presentation blip and input-editor state

Pointer input is carried through the stream as a semantic blip rather than converted
to display text:

```text
PresentationBlip {
  presentation_or_semantic_result
  presentation_type
  triggering_raw_and_logical_gesture
  selected_handler
  object
  options_and_provenance
}

InputEditorState {
  buffer_elements              // characters, style changes, semantic blips
  point_and_optional_mark
  activation_and_rescan_state  // none, end-of-line, or activation
  per_stream_input_history
  shared_kill_ring_and_index
  numeric_argument
  command_map
  pending_static_blips
  dynamic_blip_handlers
  echo_and_display_state
}
```

The editor displays a compact placeholder for a presentation blip but MUST return the
semantic element on rescan. Ordinary movement and deletion treat it atomically. An
old blip whose presentation has been deleted MUST signal a controlled dead-blip
condition; it must not dereference stale output history.

### Handler descriptor

```text
PresentationHandler {
  kind: translator | action | presentation_to_command | command_menu | blank_area
  stable_name
  source_type
  target_type
  context_type
  logical_gesture_set
  object_tester
  context_or_result_tester
  translation_or_action_function
  priority
  documentation_and_pointer_documentation
  menu_policy
  highlight_policy
  context_independent
  exclude_other_handlers
  blank_area_enabled
  definition_generation
}
```

A handler is selected by semantic types and active context, not installed directly on
one rectangle. The same handler can apply to every visible object of a type; the same
object can have different applicable handlers in different contexts.

An action is a noncomposing translator whose useful result is its side effect and
which normally resumes the original accept operation. A presentation-to-command
translator targets the semantic command type. Blank-area handlers use a no-type
source sentinel and are considered only when no presentation owns the location.

### Output and redisplay records

```text
OutputRecord {
  kind
  region
  children
  replay_or_renderer
  parent
}

RedisplayPiece extends OutputRecord {
  unique_id
  cache_value
  cache_test
  displayer_continuation
  collection_and_display_generation
  contents_valid
  movement_allowed
  child_pieces_and_nonchild_output
  old_region
  new_region
  state: matched | unchanged | moved | changed | inserted | deleted
}
```

Presentation records and redisplay pieces can be nested inside formatted-output
records. They MUST remain distinct: presentation records answer “what object/type is
here?”, while redisplay pieces answer “what output can be retained or changed?”.

### Command and command table

```text
CommandDefinition {
  name
  argument_specs_and_options
  body
  documentation
  menu_and_accelerator_metadata
  declared_visible_values
}

CommandTable {
  name
  parent_tables
  command_definitions
  accelerators
  menu_levels_and_items
  presentation_handlers
  mutation_epoch
}
```

A command object is a command name plus already accepted semantic arguments. It is
independent of whether those arguments came from typing, completion, menus, or
pointer gestures. Positional or conditional arguments not read yet MUST remain
distinguishable from arguments explicitly supplied as `NIL`.

## Presentation type system

### Surface syntax

The selected substrate accepts three presentation-type shapes:

1. an atomic type name;
2. `(name . data-arguments)`; and
3. a full form containing name and data arguments followed by presentation arguments.

The compatibility frontend MUST decode all three without confusing presentation
arguments with semantic data arguments. A descriptor can require data arguments,
forbid atomic use, permit a Common Lisp type bridge, or mark itself
presentation-only. Cache keys for appearance/parsing operations include presentation
arguments; pure membership keys MAY omit arguments the descriptor proves irrelevant.

### Definition and canonicalization

A type definition MUST declare separate data and presentation argument lists and MAY
declare a supertype/expansion. Type specifiers are canonicalized by:

1. resolving the name to a current descriptor;
2. parsing supplied arguments and applying declared defaults;
3. preserving data and presentation arguments separately;
4. expanding aliases only as needed for the requested method or relationship;
5. detecting expansion cycles; and
6. retaining the original or reconstructible surface specifier for prompts and
   diagnostics.

Redefinition MUST increment an epoch and invalidate descriptor, method, subtype, and
handler caches that could depend on the prior definition.

Canonical cache keys MUST be collision-safe. Genera bounds and compresses large
type keys as an optimization. The `INFERRED` clean-room safeguard is that another
implementation may retain full immutable keys, and a compact-key collision MUST never
produce a false membership, method, subtype, or handler result. Descriptors with
mutable or opaque arguments MAY opt out of caching.

### Membership and subtyping

The relation `presentation-subtypep(A,B)` answers whether every semantic value of
specifier A is acceptable where B is requested. Internally it has four possible
results: true, false, unknown, or a conditional predicate which decides the relation
for concrete arguments. A public two-valued wrapper MAY collapse unresolved results,
but handler resolution MUST retain conditional information. It MUST account for:

- declared presentation-type inheritance/expansion;
- argument-dependent subtype rules;
- compound types such as conjunction, disjunction, membership, or predicate-refined
  types;
- an equivalent Lisp/host type only where the descriptor explicitly supplies one;
  and
- an unknown result when the relationship cannot be proved statically.

Presentation subtyping MUST NOT be replaced by raw host `TYPEP` alone. Two
presentations of the same underlying integer can have distinct UI meanings, and a
semantic subtype can be independent of object representation.

```text
subtype(A, B, seen):
  normalize A and B
  if (A,B) is already in seen: return unknown
  remember (A,B)
  handle equality, top, bottom, and no-type sentinels
  ask A's descriptor-specific subtype method; retain a conditional result
  recursively try A's declared, generated, and equivalent supertypes
  try Flavor/CLOS precedence, structure ancestry, and declared host-type bridges
  return true on proof; otherwise the best conditional/unknown/false result
```

Traversal MUST detect cycles. Parameterized aliases or host-type expansions must
terminate with an unresolved/false result or a structured error rather than recurse
forever.

### Method dispatch

Type-method lookup proceeds from the exact type descriptor through declared
expansions/supertypes until a method for the requested role is found. Argument values
must be available to methods whose behavior depends on them. The result MAY be cached
against the canonical specifier, method role, and relevant epochs.

At minimum, a `DW-G85/D0` implementation MUST provide method roles for:

| Family | Roles |
| --- | --- |
| Text conversion | presentation printer, parser, type-name printer, describer |
| Semantic relationship | membership/equivalent host type, subtype and supertype walking/predicates |
| Input lifecycle | default preprocessing, history choice, input postprocessing |
| Display modes | view choice, menu display, Accepting Values display, chooser |
| Feedback | highlighting-box or region policy |
| Encoding | binary-graphics representation where supported |

### Standard type-library boundary

The inspected selected modules contain 133 unqualified presentation-type definition
forms: 44 core, 19 numeric, 15 sequence, 48 general, and 7 character-style. The
general module also contains two explicitly `SCL:`-qualified definition calls, for
135 macro-family calls in a literal scan. Repeated `MEMBER` definitions, conditional
forms, and package variants mean neither number is a count of unique live names. A
reconstruction MUST ship a type library covering these semantic families:

- Lisp values and symbols;
- numbers, ranges, radices, and numeric subtypes;
- sequences, members, subsets, and structured compound values;
- pathnames, files, directories, and hosts;
- time and dates;
- fonts and character styles;
- systems, functions, classes, Flavors, and CLOS objects;
- windows, activities, printers, network and namespace objects; and
- application-extensible presentation types.

The source-form inventory is:

- **Core (44):** `EXPRESSION`, `GPRINT::EXPRESSION-LENGTH-ELLIPSIS`, `FORM`,
  `EVALUATED-FORM`, `OUT-OF-BAND-CHARACTER`, `CONS`, `LIST`, `NULL`, `NOT`,
  `PARSE-ERROR-WALL`, `OR`, `AND`, `SYMBOL`, `KEYWORD`, `PACKAGE`, `FUNCTION`,
  `COMPILED-FUNCTION`, `GENERIC-FUNCTION`, `CLOS-INTERNALS:FUNCALLABLE-INSTANCE`,
  `LEXICAL-CLOSURE`, `DYNAMIC-CLOSURE`, `COMPILED-FUNCTION-PC`,
  `COMPILER:COMPILED-FUNCTION-AND-PC`, `CHARACTER`, `STANDARD-CHAR`, `STRING-CHAR`,
  `SIMPLE-STRING`, `UNBOUND-LOGIC-VARIABLE`, `HASH-TABLE`, `DECLARE`,
  `SIMPLE-ARRAY`, `READTABLE`, `LOCATIVE`, `SIMPLE-BIT-VECTOR`, `ATOM`, `STREAM`,
  `COMMON`, `SATISFIES`, `DATA-TYPE`, `CLI::EQUIVALENT`, `INSTANCE`,
  `CLOS-INTERNALS:MEMBER-OF-CLASS`, `CLOS-INTERNALS::MEMBER-OF-CLASS-NAMED`, and
  `STRUCTURE`.
- **Numeric (19):** `NUMBER`, `INTEGER`, `MOD`, `BIT`, `UNSIGNED-BYTE`,
  `SIGNED-BYTE`, `BIGNUM`, `COMPLEX`, `FIXNUM`, `FLOAT`, `SHORT-FLOAT`,
  `SINGLE-FLOAT`, `DOUBLE-FLOAT`, `LONG-FLOAT`, `FUTURE-COMMON-LISP:REAL`,
  `RATIONAL`, `RATIO`, `SMALL-RATIO`, and `BIG-RATIO`.
- **Sequence (15 forms):** `STRING`, `SEQUENCE`, `VECTOR`, `ARRAY`, `BIT-VECTOR`,
  `SIMPLE-VECTOR`, `SEQUENCE-ENUMERATED`, `MEMBER-SEQUENCE`, two `MEMBER` forms,
  `SUBSET`, `ALIST-SUBSET`, `SEQUENCE-ELEMENT`, `ALIST-MEMBER`, and
  `SEQUENCE-SUBSET`.
- **General (48 unqualified plus two `SCL:` calls):** `BOOLEAN`,
  `INVERTED-BOOLEAN`, `T`, `NIL`, `PATHNAME`, `FS:DIRECTORY-PATHNAME`,
  `FS:WILDCARD-PATHNAME`, `FS:OPEN-FILE`, `MENU-CHOOSE`, `TOKEN-OR-TYPE`,
  `NULL-OR-TYPE`, `TYPE-OR-STRING`, `TIME:UNIVERSAL-TIME`, `TIME:TIME-INTERVAL`,
  `TIME:TIME-INTERVAL-60THS`, `TIME:TIMEZONE-SYMBOL`, `TIME:TIMEZONE-NUMBER`,
  `TIME:TIMEZONE`, `FONT`, `SYS:FONT-NAME`, `SCT:SYSTEM`, `SCT:SUBSYSTEM`,
  `SCT:SYSTEM-VERSION`, `SCT:SYSTEM-BRANCH`, `SYMBOL-NAME`, `NET:OBJECT`,
  `NETI:NAMESPACE-CLASS`, `NETI:NAMESPACE-OBJECT`, `NET:LOCAL-HOST`,
  `NETI:LOCAL-NETWORK`, `LOCAL-PRINTER`, `PRINTER`, `TV:SHEET`, `TV:WINDOW`,
  `DW:DYNAMIC-WINDOW`, `TV:MICROCODED-GRAPHICS-ALU`, `TV:ALU-FOR-SHEET`,
  `SI:RESOURCE-NAME`, `SI:INITIALIZATION-LIST-NAME`, `FS:PATHNAME-HOST`,
  `FLAVOR-NAME`, `CLOS:CLASS-NAME`, `GENERIC-FUNCTION-NAME`,
  `CLOS-INTERNALS:GENERIC-FUNCTION-NAME`, `FLAVOR:INSTANCE-VARIABLE-ACCESSOR`,
  `FUNCTION-SPEC`, `SI:LISP-SYNTAX`, `KEYWORD-VALUE-PAIRS`,
  `KEYWORD-VALUE-PAIR`, and `TV:WINDOW-FLAVOR`. `SCT:SYSTEM-BRANCH` and
  `FLAVOR:INSTANCE-VARIABLE-ACCESSOR` are the two explicitly `SCL:`-qualified calls.
- **Character style (7):** `CHARACTER-STYLE-FAMILY`, `CHARACTER-STYLE-FACE`,
  `CHARACTER-STYLE-SIZE`, `CHARACTER-STYLE`, `CHARACTER-STYLE-FOR-DEVICE`,
  `CHARACTER-STYLE-DEVICE-FONT`, and `CHARACTER-FACE-OR-STYLE`.

Exact argument lists and conditional live-name population remain an ABI metadata and
world-oracle appendix. This inventory is sufficient to prevent a reimplementation
from silently omitting an entire semantic family; it is not a claim that all 135
forms produce simultaneous distinct loaded types.

**Inventory evidence:** `G85-SRC` at
`dynamic-windows/core-types.lisp.~34~:137-1957`,
`dynamic-windows/number-types.lisp.~5~:148-781`,
`dynamic-windows/sequence-types.lisp.~28~:55-1893`,
`dynamic-windows/presentation-types.lisp.~722~:58-1775`, and
`sys2/character-style-presentations.lisp.~64~:371-671`. Their exact byte identities
are recorded in [Artifact identities](#artifact-identities).

Numeric range types MUST reject values outside the requested range after syntactic
parsing. Sequence/member/subset types MUST honor their supplied comparison functions
and return associated semantic values rather than equating display strings. The
character-style types cover family, face, size, device mapping, a combined style, and
face-or-style selection. `G85-SRC` establishes these families; which conditional
definitions are live in the patched world remains a metadata/oracle task.

## Typed output and presentation recording

### `PRESENT`

Conceptually:

```text
present(object, type_specifier, stream, view=stream_default, options):
  canonical = canonicalize(type_specifier)
  assert object satisfies canonical, unless options explicitly suppress checking
  begin presentation record with object, canonical, view, and sensitivity policy
  dispatch canonical's presentation-printer for view
  collect all text/graphics output and nested records
  compute or obtain highlight region
  attach record to current output history/record parent
  return object and/or printer-defined values according to compatibility API
```

An implementation MAY combine record construction with a scene graph, but the
semantic record MUST exist independently of screen pixels.

An object/type mismatch MUST signal a structured, continuable presentation error. It
cannot silently create a sensitive record that claims the wrong semantic type.

### `WITH-OUTPUT-AS-PRESENTATION`

The scoped output form records arbitrary application drawing as one presentation.
It MUST:

- retain the supplied object and full type specifier;
- collect the region of all enclosed output or accept an explicit region;
- preserve nested presentations;
- unwind cleanly after abort or error;
- avoid leaving a hit-testable record for output that never committed; and
- honor sensitivity and shared-box options.

### Record ordering and hit testing

Records are ordered consistently with output and nesting. Hit testing at a pointer
location MUST:

1. transform device coordinates into stream/history coordinates;
2. exclude records outside the visible viewport or clipped region;
3. descend from visually and semantically innermost eligible records outward;
4. respect a parent's policy for sensitive inferiors;
5. test the active context and applicable handlers; and
6. return the candidate sequence needed for priority/gesture resolution.

A bounding box MAY overapproximate drawn pixels. Selection follows the recorded
region, not alpha-testing the framebuffer, unless a type supplies a more precise
region test.

### Output history

A Dynamic Window retains output records beyond the current viewport until explicitly
cleared, superseded, or reclaimed by a documented policy. Scrolling changes the
viewport over this history; it does not turn pixels into semantic objects. Clearing
history MUST invalidate presentation hit testing and redisplay associations for the
removed records.

Applications MUST clear or replace stale presentations when their objects cease to be
valid. As an `INFERRED` implementation technique, a new implementation SHOULD use weak
references or explicit lifecycle hooks where safe. The observable requirement is that
a visible stale record MUST NOT invoke an operation on an unrelated replacement
object.

Output history is mutable, not append-only. It MUST support replacing a presentation's
semantic value/type, moving it with inferiors, erasing/deleting it, region redisplay,
scroll shifts, clearing/compaction, and replay after exposure. The following atomicity
rule is `INFERRED`: pixel changes and the semantic/spatial index commit together, or an
exception invalidates the region and forces repaint rather than leaving clickable
stale pixels.

## Typed input and `ACCEPT`

### Required modes

`ACCEPT` requests an object of a presentation type and MUST permit these input paths
when supported by the type and context:

- typed syntax parsed by the presentation parser;
- completion over a type-specific possibility set;
- selection from presentation history;
- acceptance of a currently displayed compatible presentation;
- translation of a displayed presentation into the requested type;
- compound recursive acceptance of component values; and
- default acceptance, editing, or replacement.

All successful paths return a semantic object satisfying the requested context after
postprocessing. The caller must not need to distinguish whether it was typed or
pointed unless it explicitly requests input-source metadata.

### Input transaction

```text
accept(type, stream, prompt, default, options):
  canonicalize type and preprocess default
  push InputContextEntry
  establish input-editor and completion/history state
  loop:
    wait for keyboard, pointer gesture, or handler-produced event
    if text activation:
      parse under canonical type
      on incomplete input: continue editing/completing
      on type error: report locally and retain editable input
    if pointer gesture:
      resolve applicable handler under complete context stack
      direct translation -> candidate object
      action -> perform action, then continue accepting
      command result -> return/queue according to command-reader context
    validate predicate and type membership
    postprocess and record history if enabled
    commit editor state and return value
  on abort/error: pop context and remove transient feedback without committing
```

Context push/pop and transient highlighting MUST use unwind-protected cleanup.

### Defaults, history, and completion

- A default is typed semantic state, not preinserted display text. The type can
  preprocess it and choose how it appears.
- Editing a default and selecting a default are distinct actions when the type
  supports both.
- History is partitioned or selected by presentation type policy. Recalled objects
  must be checked against the current full specifier and predicate.
- Completion MUST distinguish incomplete, ambiguous, unique, and invalid input. It
  SHOULD present possible completions using the same semantic type/view mechanisms.
- Parser errors MUST identify the failing type/context and leave the editor recoverable.

### Presentation blips and stream rescan

The input editor and parser are deliberately separate. The parser consumes the
editor's saved buffer. When the user edits already scanned material, the editor
nonlocally returns to the read boundary and the parser runs again over the corrected
buffer without re-echoing it. Parser code can therefore execute more than once and
SHOULD avoid irreversible side effects before acceptance commits.

The editor buffer can contain presentation blips as well as characters. On screen a
blip is abbreviated; during rescan it is returned as the semantic pointer event or
translated value. `:activation`, preemptable input, command characters, static blips,
dynamic blip handlers, notifications, and stream input-wait callbacks can return
control before ordinary text activation. Already buffered input MUST survive these
events.

```text
EDITING:
  wait for character, editor command, activation, EOF, notification, or blip
  self-insert/edit -> mutate buffer and efficient echo; remain EDITING
  presentation blip -> insert one atomic semantic element; remain EDITING
  activation -> return activation boundary to parser
  parser requests rescan -> reset scan point and enter RESCANNING
  full rubout -> return the configured empty-input outcome

RESCANNING:
  return saved characters/styles/blips without waiting or re-echoing
  at saved boundary -> resume EDITING or return activation according to state
```

The selected source limits insertion to one million characters. A replacement SHOULD
enforce a documented resource bound and signal a correctable condition rather than
truncate, wrap an index, or split a semantic blip.

### Input-editor command map

Legacy logical chords SHOULD remain available even when a port also supplies modern
bindings. Numeric modified digits build an argument; modified minus makes it
negative; `C-U` starts at four and multiplies by four on repetition.

| Binding or family | Required operation |
| --- | --- |
| Refresh; Page | Repaint editable input; erase/clear typeout according to stream policy |
| `M-<`/Home; `M->`/End | Beginning/end of complete input buffer |
| Clear Input | Delete the complete editable input through full-rubout protocol |
| `C-F`/Right; `C-B`/Left | Forward/backward one atomic buffer element |
| `C-D`; Rubout; `C-T` | Delete after point; delete before point; transpose adjacent elements |
| `C-A`/`M-Left`; `C-E`/`M-Right` | Beginning/end of line |
| `C-P`/Up; `C-N`/Down | Previous/next input or display line |
| `C-K`; `C-O`; Line | Kill to line end; open line; insert nonactivating newline where allowed |
| `M-F`; `M-B`; `M-D`; `M-Rubout`; `M-T` | Move, kill, or transpose words |
| `M-U`; `M-L`; `M-C` | Uppercase, lowercase, or capitalize word/region |
| `C-M-F`; `C-M-B`; `C-M-K`; `C-M-Rubout` | Move/kill over balanced Lisp expressions |
| `M-\`; `M-\|` | Delete horizontal whitespace; normalize it to one space |
| `C-Q`; `C-M-J` | Quote next character; invoke text-style input |
| Help; `C-Help` | Describe expected input; list editor commands/bindings |
| Escape; `C-Escape` | Browse per-stream input history; browse shared kill history |
| `C-Y`; `M-Y`; `C-M-Y` | Yank and rotate compatible kill/history entries |
| `C-W`; `M-W`; Super-W | Kill/copy marked regions under their region conventions |
| `C-Space`; `C-<`; `C->` | Set or move mark/region boundaries |
| Shift-yank; Cut/Copy/Paste | Integrate kill/selection sources with TV selection protocol |
| Search and scroll families | Search input/history or scroll typeout without losing point |

Consecutive compatible kills coalesce; a nonkill command breaks coalescing. Yank
rotation is valid only after a yank-compatible command. Ordinary input history is
per stream/type policy while the kill ring is shared by editors in the selected
system. Semantic blips are indivisible for character operations and MAY count as one
Lisp expression for structural motion. Less-common chords, style spans over blips,
and search/selection edge behavior are `TODO-RUNTIME`, not world-confirmed here.

### Completion state machine

Completion MUST retain at least five result states: no match, ambiguous prefix,
left-substring match, unique extension, and exact/complete match. Sources may be
sequences, arrays, alists, symbol sets, or indexed trees. They must honor configured
case folding, delimiter conversion, display names, semantic values, and equality
tests.

| Gesture | Required completion behavior |
| --- | --- |
| Complete | Extend only by text common to the current candidate set |
| Super-Complete | Request the strongest/maximal completion policy |
| Tab | Complete and append a separator when the result becomes valid |
| End | Terminate only when complete; may accept a documented left-substring match |
| `C-?` | List current possibilities |
| `C-/` | Apropos-style possibility search |
| Help | Explain the expected type and show possibilities where useful |
| Right mouse | Offer the same semantic choices in a menu |
| `C-Return` | Force unmatched text only when the type explicitly permits arbitrary input |

Ambiguity provides nondestructive feedback. Replacing text MUST preserve quoting and
put point after the inserted material. Closed enumerated types cannot be bypassed by
`C-Return`. An alist-backed completion returns the associated object, not the display
name. Ellipsis choices expand only in the matching completion context. Exact behavior
for maximal completion and left-substring edge cases remains `TODO-RUNTIME`.

**Evidence:** `G85-SRC` at `io/input-editor.lisp.~332~:120-2309` and
`dynamic-windows/completion.lisp.~206~:743-1923`; `G8-MAN` independently describes
activation, rescan, preemption, parser/editor separation, and input-editor options.
Only representative correction and pointer-blip paths are currently `G85-RUN`.

### Compound types

A compound presentation parser may call `ACCEPT` recursively. The outer parser MUST
maintain a procedural inverse relationship with its printer at the semantic level:
values printed in an accepted view should be reconstructible or selectable even when
the textual syntax is not a literal Lisp form. Nested input contexts MUST let the
pointer satisfy the innermost component while retaining the outer continuation.

## Gestures and handler resolution

### Logical gestures

Handlers name logical gestures such as Select, Describe, Menu, or application-defined
gestures. A gesture mapping converts raw button/modifier/key events into those names.
Applications MUST NOT need to hard-code host button numbers. The mapping is part of
the user/environment profile and can vary without redefining every translator.

The selected default mapping supplies these logical meanings. A physical chord can
name more than one logical gesture so different handlers can bind the same chord in
different semantic contexts.

| Physical chord | Selected logical meanings |
| --- | --- |
| Left | Select |
| Middle | Describe; Select-and-Edit |
| Right | Menu |
| Shift-Left | Select-and-Activate; Alternate-Select |
| Shift-Middle | Inspect; Delete; Remove |
| Shift-Right | System-Menu |
| Control-Left | Hold-and-Mark-Region |
| Control-Middle | Yank-Word |
| Control-Right | Marking-and-Yanking-Menu |
| Control-Shift-Middle | Mark-Word |
| Meta-Left | Edit-Function; Edit-Definition |
| Meta-Middle | Evaluate-Form; Disassemble |
| Meta-Shift-Right | Window-Operation-Menu |
| Super-Left | Select-Object |
| Super-Middle | Describe-Presentation |
| Super-Right | Presentation-Debugging-Menu |
| Super-Shift-Left | Reprint-Differently |
| Super-Shift-Middle | Edit-Viewspecs |
| Control-Meta-Left/Middle/Right | Set; clear; modify/complex breakpoint |
| Control-Meta-Shift-Left/Middle | Monitor; unmonitor location |

Gesture metadata also says whether raw text is required, whether a presentation
description should be requested, and whether documentation appears without a normal
semantic match. Remapping a chord MUST invalidate handler and pointer-documentation
caches.

### Applicability

A handler is potentially applicable when:

- the presented type is equal to or a subtype of the handler's source type;
- the handler's result target can satisfy an active input context, or its command
  table applies in the current command environment;
- the event maps to the handler's logical gesture;
- its tester succeeds for the object, record, context, and environment; and
- its menu/blank-area/nesting policy permits the current invocation.

For selected displayed type `D`, handler source type `S`, requested context type `C`,
and declared handler result type `R`, source applicability requires `D <: S` and
target applicability requires `R <: C`. A translation that returns an object failing
the context predicate MUST be rejected after translation. Here `R` is a variable, not
the historical universal presentation type named `T`.

### Resolution algorithm

The following is normative at the semantic level:

```text
resolve(pointer, raw_event, context_stack, command_table):
  gesture = map_raw_event(raw_event)
  presentations = hit_test_innermost_first(pointer)
  seen_contexts = identity_set()
  for context in context_stack from innermost to outermost:
    if context was already seen by identity: continue
    remember context
    candidates = []
    for presentation in presentations from innermost to outermost:
      for handler indexed by presentation.type and gesture:
        expand an all-gestures handler for the direct/menu mode
        require displayed-type <: handler-source-type
        run object tester
        translate speculatively only when result-dependent testing requires it
        reject the translator's explicit no-result/no-applicability outcome
        require handler-target-type <: requested-context-type
        run context/result tester and menu-presence policy
        append passing candidate with rejection evidence retained separately
    if candidates not empty:
      sort by descending explicit priority
      order context-dependent before context-independent where otherwise tied
      apply direct/menu and all-gesture ordering rules
      break the final tie by stable handler package/name
      apply exclude-other-handlers filtering
      return direct winner or ordered menu set
  consider applicable blank-area or command-menu handlers
  return no-handler
```

The subtype directions are normative: the displayed type is below the handler source,
and the handler target is below the requested context. Reversing either test admits
results the acceptor cannot consume or lets overly specific handlers claim general
objects. Nesting preference comes from context/presentation traversal and candidate
construction; the final source tie-break is priority and stable name/package, not an
unspecified “most recently defined” callback order. An implementation MUST retain
diagnostic reasons for candidate rejection so behavior can be inspected.

### Handler results

| Kind | Required effect |
| --- | --- |
| Translator | Return a new semantic object for the target input context |
| Action | Perform an interaction that may expose or alter choices, then continue the original acceptance unless explicitly completed |
| Presentation-to-command | Construct a command object with the presented object and any further accepted arguments |
| Command-menu | Invoke or construct a command according to the current command table/menu level |
| Blank-area | Offer an operation when no more specific presentation owns the pointer location |

Documentation and highlighting MUST be computed from the same effective candidates
used for dispatch. The bottom mouse line must not promise an operation whose tester
would reject the eventual click.

### Caching and invalidation

Handler lookup MAY be cached by canonical source type, target context, gesture,
command table, and relevant epochs. Cache entries MUST be invalidated when a type,
handler, gesture mapping, command table, or predicate-dependent registration changes.
Object-specific tester results SHOULD NOT be cached beyond a stability scope unless
the tester declares a valid cache key.

The 1989 paper reports performance and global-cache difficulties. A new implementation
is not required to reproduce those inefficiencies; it IS required to reproduce
dispatch results and cache invalidation behavior observable by applications.

**Evidence:** `G85-SRC` at `define-handler.lisp.~12~:65-587`,
`mouse-handler-lookup.lisp.~33~:1452-2220`, and
`dynamic-input.lisp.~498~:243-1313`; `UIST89` independently corroborates source and
target subtype direction, nested contexts/presentations, testers, priorities, menus,
and documentation. The inspected live handler report is `G85-RUN`; equal-priority and
exclusion conflicts remain `TODO-RUNTIME`.

## Highlighting and pointer documentation

When the pointer enters or changes effective presentation/handler:

1. wait a short, configurable dwell interval before expensive semantic lookup (the
   selected implementation uses 20 scheduler ticks, about one third second);
2. remove prior transient highlighting using saved/replayable output;
3. select the innermost presentation and effective handlers;
4. use an enclosing presentation for documentation only when it shares the relevant
   sensitive box under the source policy;
5. compute the current presentation's type-specific highlight region;
6. draw the highlight using a reversible or separately recorded style;
7. generate documentation in a protected print environment, merge equivalent
   descriptions, and compress it to available width; and
8. update one or, when configured, two mouse-documentation lines.

Moving away, changing contexts, redisplaying, scrolling, deexposing, or aborting MUST
remove stale highlighting and documentation. The highlight is feedback, not part of
the application's output history. A failing documentation function MUST be contained:
its entry may be suppressed and reported diagnostically, but it cannot break the
input loop or leave a highlight installed.

**Evidence:** `G85-SRC`, `dynamic-input.lisp.~498~:57,427-1156`; live pointer
documentation in Accepting Values and Presentation Inspector is `G85-RUN`. The dwell
value and two-line compression edge behavior are `TODO-RUNTIME` as user-visible
timing/layout oracles.

## Command Processor integration

### Command definitions

A command definition declares semantic arguments using presentation types, optional
defaults and prompts, a body, and menu/accelerator/documentation metadata. The command
reader MUST build a command object by accepting each argument in order. Pointer and
typed input can be mixed within one command.

Only keyword-style option groups are admitted by the selected command-definition
grammar. Positional arguments not read yet are represented as optional/unread slots;
that state is distinct from an explicitly supplied `NIL`. A later argument can become
visible or required conditionally on earlier semantic values. Parser and unparser
operate on the same command object. Unless a command explicitly declares visible
values, incidental multiple values from its body are hidden from listener history.

### Command tables

Command tables MAY inherit from multiple parent tables. Lookup MUST be deterministic
and detect cycles. The selected rule is depth-first traversal in declared parent
order, with the first found binding winning. A table can contribute:

- command definitions or references;
- typed command-name completion;
- keyboard accelerators, including whether single-character reading is enabled;
- menu levels and item order;
- presentation translators and command translators; and
- generated Help/documentation.

Mutating a table MUST invalidate effective-command, accelerator, menu, and handler
caches for its descendants.

The default name map is case-insensitive and keyboard accelerators can be enabled or
disabled per table. The global registry must preserve explicit `if-exists` behavior
and stable table identity when callers retain the object.

### Prefixes, accelerators, and command-or-form reading

Accelerators are direct mappings or prefix-tree states. A prefix is not itself a
completed command unless explicitly bound as one. Inherited accelerators follow the
same table-order contract as command names. Numeric arguments can precede an
accelerator, are visible in its prompt, and are delivered through the accelerator's
argument contract.

```text
READ-COMMAND:
  establish command input context, active table, program wakeups, and Help
  read keyboard gesture, presentation blip, or edited command text
  if gesture extends an accelerator prefix:
    retain prefix and numeric state; show legal continuations; read again
  if gesture completes an accelerator:
    construct its command object and arguments
  if text begins a full command:
    complete/parse command name, then ACCEPT each typed argument
  if a presentation translator yields a command:
    validate it through the same command-object path
  if form evaluation is enabled and the selected syntax denotes a form:
    return the form to the framework evaluator
  on correction:
    retain editable input and retry without executing a partial command
```

The selected command-or-form reader treats alphabetic input as command-preferring and
recognizes colon/comma-prefixed paths for full-command/form interpretation. A failed
command parse MUST NOT fall through to evaluation unless the documented reader state
allows it. Exact prefix-key presentation and every colon/comma corner are
`TODO-RUNTIME`; implementations MUST first match the source state machine rather than
guess from modern shell conventions.

### Command loop

```text
program_command_loop(frame):
  while frame remains active:
    choose terminal_io and selected interaction pane
    establish frame command table and input context
    read command from typed name, accelerator, menu, or presentation translator
    execute command with semantic arguments
    handle abort locally and serious conditions through the configured debugger path
    run post-command hooks
    request full or incremental pane redisplay according to framework policy
```

The visible command menu and typed interactor MUST be two surfaces over one command
model. A menu click must not call a separate callback that bypasses argument typing,
command documentation, or command-loop hooks.

### Noun-verb and verb-noun use

The implementation MUST support both:

- command first, then typed or pointed operands; and
- object first, then a presentation-to-command gesture or menu choice.

The resulting command object and application effect SHOULD be equivalent when the
same command and semantic arguments are chosen.

**Evidence:** `G85-SRC`, `cp/comtab.lisp.~103~:55-423`,
`cp/command-processor.lisp.~318~:532-1082,1396-1792,2328-2596`, and
`cp/read-accelerated-command.lisp.~142~:55-214,368-831`; `G8-MAN` corroborates typed
arguments, hierarchical tables, completion, Help, and accelerators. Resident program
loops are `G85-RUN`; synthetic inheritance/prefix conflicts are `TODO-RUNTIME`.

## Formatted output

Formatted output provides declarative layout, not semantic object identity by itself.
Presentation forms nested inside formatted cells add that identity.

Formatting continuations can execute once for measurement/collection and later for
display or replay. Values intended to be stable MUST be snapshotted or captured
immutably; values explicitly declared shared are reread. The selected implementation
warns about mutated snapped variables. Application callbacks in a continuation SHOULD
therefore be repeat-safe and MUST NOT assume a single execution.

### Box model

Each formatted construct produces a box with minimum, desired, and resulting extent,
children, and alignment/break policy. Required construct families include:

- tables, rows, and cells;
- item lists arranged by rows or columns;
- filling text, indentation, textual lists, and conditional line breaks;
- multiple columns with premeasurement;
- replayable and resortable output;
- abbreviation by width, height, ellipsis, or newline substitute;
- centering, underlining, and temporary character styles;
- explicit-coordinate output and embedded subwindows;
- surrounding rectangular or curved borders;
- graphs/trees with node and edge layout; and
- output-size measurement and hardcopy coordinate conversion.

Layout proceeds in at least two logical phases: measure/collect constraints, then
assign positions and render/replay. A new implementation MAY merge phases when output
metrics are known, but it MUST preserve nested alignment and conditional-break
results.

### Tables and item lists

A table MUST align cell boundaries across rows, honor intercolumn/interrow spacing,
and support alignment within cells. An item list MUST choose or obey row/column
geometry, preserve item order, and retain individual output/presentation records. A
cell's semantic records move with the cell and remain hit-testable at assigned
coordinates.

Filling derives its default column from usable viewport/inside width; when no geometry
exists the selected implementation uses an approximately 95-character fallback.
Spacing accepts numeric distance, measured strings, character/pixel units, or measured
continuation output. Those forms MUST normalize to one coordinate unit before layout.
Simulation must reproduce styles, presentations, indentation, filling, graphics
cells, and coordinates without accidentally attaching measured presentations to the
live output history.

### Deferred lexical state

Historical formatted-output and redisplay forms can capture lexical state for replay.
A reimplementation MUST define capture semantics explicitly. Values needed for a
stable replay SHOULD be snapshotted at record creation; values declared shared or
dynamic MUST be reread when replayed. The API MUST provide an escape for intentionally
mutable shared variables so cached output does not silently freeze application state.

**Evidence:** `G85-SRC`, `formatted-output.lisp.~397~:76-2681`; `G8-MAN` documents
the public formatting families and replay model. Runtime clients demonstrate visible
formatted output, but width rounding, continuation execution counts, every border,
hardcopy inversion, and the geometry-free fill fallback remain `TODO-RUNTIME`.

## Incremental redisplay

### Redisplay contract

An application describes a new output-record tree. Stable unique IDs relate new
redisplay pieces to old pieces. A cache value and comparison test say whether content
remains semantically unchanged. Geometry can change even when content does not.

### Reconciliation algorithm

```text
COLLECT:
  run the application displayer against a simulated/recording stream
  for each updating piece in encounter order:
    match an old sibling by scoped unique ID and compatible piece class
    if no ID was supplied, fall back to the next compatible old position
    compare cache values with the piece's declared test
    retain old recorded output only when cache matches and contents remain valid
    otherwise collect new output and inferiors

LAYOUT:
  compute natural sizes, table constraints, row/column/cell geometry, and final boxes

PLAN-MOVES:
  promote reusable unchanged pieces
  identify safe pixel copies for pieces whose boxes moved
  order overlapping copies so no source pixels are destroyed before use
  calculate stale/exposed regions and presentation relocations

DISPLAY:
  encounter exactly the same piece identities, classes, and order as COLLECT
  copy safe unchanged pixels; replay any unchanged piece that cannot be copied
  erase stale regions in overlap-safe order
  execute/replay changed pieces and attach their presentations
  update boxes, cursor, parentage, output history, and spatial indexes

COMMIT:
  atomically install the new piece tree and generation; discard stale presentations

ON ERROR OR COLLECTION/DISPLAY MISMATCH:
  invalidate the affected subtree and force a coherent full redraw
```

Unique IDs need only be unique within the declared redisplay scope. Duplicate IDs in
one scope MUST be diagnosed or handled deterministically; silently matching one at
random is nonconforming.

The collection/display identity rule is fundamental. Application display code can be
executed twice, and a branch that emits a different piece sequence in the display
pass is not allowed to attach old pixels or presentations to a different semantic
piece. Independently redisplayable formatting whose geometry depends on surrounding
flow MUST escalate to the nearest safe ancestor rather than update in isolation.

### Correctness rules

- An unchanged cache value is an application assertion. The framework MAY offer a
  debugging mode that recomputes and compares output.
- A changed child's old region must be erased even if the new child draws less area.
- Moving a record updates every nested presentation's transformed region.
- Reordering overlapping siblings must preserve final visual order even if each is
  individually unchanged.
- Scrolling and clipping can make a retained record newly visible or invisible;
  presentation eligibility follows current visibility.
- Clearing output history removes matching redisplay and presentation records.

**Evidence:** `G85-SRC`, `redisplay.lisp.~185~:57-2590`; `G8-MAN` corroborates
unique IDs, cache values, independent output, and pane-level incremental redisplay.
The exact collection/layout/promotion/copy/display machinery is source-established;
pixel-copy ordering, execution counts, mismatch recovery, and duplicate-ID behavior
remain `TODO-RUNTIME` oracle tests.

## Dynamic Window stream

A Dynamic Window is a TV stream augmented with output history, presentation
recording, formatted-output/redisplay contexts, viewport/scroll state, logical
gestures, and pointer feedback. It MUST still obey the underlying TV lifecycle,
selection, exposure, clipping, and input-buffer rules.

At minimum its state model includes:

```text
DynamicWindowState {
  tv_window_state
  output_history_root
  viewport_origin_and_extent
  presentation_index
  redisplay_root_and_transaction
  current_view
  active_input_context_stack
  command_table_environment
  highlight_and_mouse_documentation_state
  graphics_medium_or_raster_adapter
}
```

Vertical and horizontal scrolling MUST transform both rendered output and semantic
regions. Output scrolled out of the viewport remains in history until cleared but is
not selectable through an invisible location.

### Required Genera-TV and stream subset

Dynamic Windows assumes that its host provides:

- hierarchical sheets/windows and parent/child coordinate transforms;
- inside and viewport geometry, clipping, exposure, refresh, damage, and scrolling;
- character output, cursor state, text styles, and line metrics;
- keyboard and pointer queues plus stream listen/wait/wakeup operations;
- frame/constraint pane creation and configuration;
- process ownership and an Abort/nonlocal-exit boundary;
- selection, mouse documentation, menus, activities, and System Menu/Select hooks;
- raster operations or a semantically equivalent rendering backend; and
- ordinary stream operations such as input, output, fresh-line, cursor movement, and
  capability introspection.

Dynamic Windows adds typed semantic output history; it does not replace those host
contracts. A reimplementation SHOULD place them behind a narrow interactive-stream
and window-backend protocol. The public MIT TV specification is useful lineage
evidence, but only these requirements are normative for this `DW-G85` profile.

### Output modes and coordinate spaces

Drawing and recording are independent dimensions. Normal output draws and records;
history-only output records without drawing; direct/clear-region output draws without
recording. Text, formatted output, and graphics MUST preserve that distinction so
measurement, replay, erasure, and live output do not accidentally create or omit
semantic history.

At least five spaces must be distinguishable: application/logical graphics,
stream-inside, viewport, parent/screen, and raster-local coordinates. Every recorded
box declares or can convert from its space. Scroll and pane movement translate boxes;
pointer hit testing transforms into the space in which the recorded operation was
defined. Hardcopy may invert the vertical axis without changing the logical
presentation geometry.

### Process ownership, locks, and callbacks

The source establishes owning-process operations, asynchronous exposure/scroll work,
registry protection, generations, and nonlocal callback exits. The following
serialization policy is `INFERRED`: each output history has one serialization
boundary, and an exposure/scroll process cannot mutate history concurrently with an
application displayer without a transaction or owning-process handoff. Type, handler,
gesture, and command registries MAY use locks plus generations or immutable snapshots.
Input wakeups MUST not lose already buffered characters or blips.

The following callback-lock rule is also `INFERRED`: no implementation SHOULD invoke
arbitrary application printers, parsers, testers, translators, redisplayers, or
documentation functions while holding a global registry lock. Every callback can
signal or exit nonlocally; unwind cleanup must release locks, pop contexts, remove
feedback, and mark partially changed regions for repaint.

### Activities and remote degradation

Activity selection and reuse are host-TV services consumed by frameworks. A framework
definition registers an activity only when its policy requests it; creating an
individual Dynamic Window frame does not repeat that registration. Activity
compatibility must be checked before reusing a frame. Registration, resident
definition, activity availability, and a live instance are four distinct states.

Plain, background, or remote streams can lack spatial history, pointer input, raster
graphics, or local pane creation. `PRESENT`/`ACCEPT`, completion, commands, `FQUERY`,
and Accepting Values MUST capability-test and degrade to textual behavior where their
semantics permit it. They MUST NOT fabricate pointer sensitivity or assume every TV
stream is a Dynamic Window. Serial Accepting Values and FQUERY preserve typed values,
defaults, validation, and Abort even when layouts and mouse choices disappear.

**Evidence:** `G85-SRC`, `dynamic-window.lisp.~625~:225-3844`,
`accept-substrate.lisp.~19~:397-1339`, `accept-values.lisp.~244~:403-510`, and
`window/activities.lisp.~35~:65-554`; `G8-MAN` establishes the public TV/stream,
activity, and remote facility boundaries. Ordinary live windows are `G85-RUN`; exact
plain/background/remote fallbacks and cross-process exposure races are
`TODO-RUNTIME`.

## Graphics and viewport integration

Dynamic Windows graphics operate through generic operations and a raster mixin over
TV. A conforming implementation MUST provide:

```text
DrawingState {
  coordinate_transform
  line_thickness_and_scale
  line_end = butt
  line_joint = miter
  dashed = false
  dash_pattern = [10, 10]
  dash_phase = 0
  partial_dashes = true
  scale_dashes = false
  alu = draw
  source_pattern_or_tile_or_stipple
  gray_level = 1
  color_or_null
  opaque = true
  clipping_mask
  current_point_and_path
  scan_conversion_flags
}
```

The transform wrapper applies explicit transform, translation, rotation, and combined
scale in the selected source order, then clipping and drawing state. A port MUST test
its matrix convention so nested wrappers match that observable order.

- points, lines, polylines/polygons, rectangles, ellipses/arcs where supplied by the
  selected profile;
- text and character-style integration;
- clipping to the viewport and Dynamic Window inside region;
- coordinate transforms between application/viewport, history, sheet, and device;
- Boolean/raster operations and patterns compatible with the TV substrate;
- presentation recording around arbitrary graphical output; and
- replay/redisplay of graphical records.

The source primitive family includes points; single/multiple lines; rectangles;
triangles; polygons and regular polygons; circles, ellipses, and arcs; Bézier curves,
splines, and winding-rule paths; rasters/images; strings/glyphs; current-position
operations; and raster/bit-block transfer. An unsupported device primitive MAY be
software rendered, but geometry, clipping, source opacity, ALU, recording, and
sensitivity MUST remain equivalent.

The graphics API MAY use vector primitives internally, but the final Genera 8.5 VLM
profile is raster displayed. Hit testing is based on presentation regions, not on
reconstructing vector objects from pixels.

Binary graphics is an encoding/stream facility separate from on-screen presentation
records. Types that provide a binary encoder can serialize supported graphical values;
absence of an encoder MUST be reported rather than falling back to an unreadable
printed Lisp object.

Logical raster operations normalize at least to draw (inclusive OR), erase
(destination AND NOT source), flip (XOR), and no-op. Color devices may map these to a
device operation. With an opaque source, zero source pixels participate in background
behavior; with a transparent source they leave the destination unchanged. A mutable
raster recorded in output history MUST be copied or made replay-stable so later
application mutation cannot rewrite historical output silently.

A recorded graphics operation retains its operation and normalized arguments,
bounding box, priority/timestamp, replay behavior, coordinate adjustment for moves,
safe erase/invalidation behavior, and optional refined nonrectangular hit test. The
three output modes are:

| Mode | Draw now | Record |
| --- | :---: | :---: |
| normal | yes | yes |
| history-only | no | yes |
| direct/clear-region | yes | no |

An irreversible ALU MUST be erased by repainting the affected background, not by
assuming XOR. Refined geometry takes precedence over a coarse box for pointer
selection. Genera's private binary-graphics stream is versioned and opcode-based;
byte-exact wire compatibility remains outside the base profile and `TODO-RUNTIME`.

**Evidence:** `G85-SRC`, `graphics-flavors.lisp.~21~:59-192`,
`graphics-generics.lisp.~246~:123-4005`,
`raster-graphics-mixin.lisp.~157~:57-2393`,
`define-viewport-graphics-operation.lisp.~62~:57-1459`, and
`binary-graphics.lisp.~43~`; `G8-MAN` supplies the public graphics contracts. Visible
drawing is `G85-RUN`; primitive edge rules, transform rounding, and byte encoding are
`TODO-RUNTIME`.

## Program frameworks

### Declarative definition

`DEFINE-PROGRAM-FRAMEWORK` conceptually expands one declaration into:

- a program/frame class or flavor;
- declared program state and accessors;
- a command table and command-defining facility;
- pane definitions;
- one or more named frame configurations/constraints;
- terminal-I/O and selected interaction pane policy;
- activation, selection, deactivation, deexposure, kill, command-loop, and redisplay
  hooks;
- a top-level creation/selection function and process policy; and
- optional activity, System Menu, and Select-key registration.

The generated pieces MUST remain inspectable. Framework generation MUST reject
duplicate pane/state names, unresolved panes in configurations, command-table cycles,
and impossible default interaction panes before registering a partially functional
program.

### Program state

State variables belong to the program instance and can be used lexically by generated
commands and redisplayers. Declared defaults become program-flavor slot defaults and
are established when the program instance is made. Caller-supplied state-variable
overrides are applied while the owning frame is being initialized, before ordinary
program use. The selected framework does not define a separate generic
"initialization hook" between pane construction and the top-level loop; an application
that needs extra instance initialization supplies it through its flavor/class
facilities. Redefinition MUST define how existing instances migrate or require
recreation; it must not silently reinterpret old slot storage.

### Lifecycle

```text
DEFINE:
  parse and validate program, pane, configuration, and state declarations
  define/update the program flavor, frame-option constructor, and command table
  if selectable, define the activity and optional Select-key/System-Menu entries

INSTANTIATE:
  ask TV to make a program frame
  during frame pre-initialization, make the program instance and apply state overrides
  copy pane descriptions and selected/query/terminal/label role options into the frame
  let the TV frame/constraint lifecycle construct the initial panes and configuration
  after frame initialization, diagnose an unusable NIL selected pane

ACTIVATE/SELECT:
  let TV perform activation and selection
  invoke the after-activation and after-selection program hooks at those phases
  update the console's selected-program bookkeeping after selection

TOP-LEVEL/RUN:
  in the frame process, bind terminal, query, standard-input, and standard-output streams
  invoke the configured program top level
  under the default top level, perform initial redisplay in the command input context
  read accelerator, command, translated presentation, form, Help, or wakeup
  execute in program context; record visible values/history by policy
  handle Abort at a stable command boundary; repeat

RECONFIGURE:
  serialize against the owning frame process
  install/reuse panes according to configuration policy
  rebind role streams; resize/expose; redisplay affected panes

REUSE:
  search activity frames by program identity and the optional reuse predicate
  select a compatible existing frame instead of creating one when policy permits
  if caller-supplied state overrides are present, reset them, clear the frame, and reset its process

DEACTIVATE/DEEXPOSE/KILL:
  invoke the before-deactivation hook before TV deactivation
  invoke before- and after-deexposure hooks around TV deexposure and update console bookkeeping
  invoke the before-kill hook before TV destroys the frame
  retain the definition-time activity registration until the program definition changes
```

Activity registration is therefore a definition-time effect, not a CREATE-phase
effect, and starting the default top level is not a second generic initialization
hook. A framework can specify `:selectable nil`; that defines a reusable internal
program without defining its activity or System Menu/Select-key entries. Registration,
loaded definition, activity availability, and a live instance are distinct facts.

### Panes

The selected source registers seven standard pane families and permits further
dynamic registration:

| Pane type | Contract |
| --- | --- |
| Accept Values | Display typed queries and choices, edit through presentation input, synchronize program state, and redisplay dependencies |
| Display | Application output with full or incremental redisplayer, size/height policy, and optional typeout window |
| Title | Short program/status output with size and redisplay policy |
| Command Menu | Render a command-table menu level with row/column and alignment options |
| Interactor | Compact Command Processor input/output with optional typeout handling |
| Listener | Taller history-oriented interactor with optional typeout handling |
| Tree Browser | Display hierarchical semantic nodes with expansion/selection and framework integration |

Therefore pane type enumeration MUST be dynamic; a designer or introspector cannot
hard-code this table as the permanently complete universe.

Display panes accept a string or a function redisplayer under mutually compatible
options. Their incremental policy distinguishes full clear/redraw, updating-output,
viewport-limited updating, and an application-owned redisplayer. Forced redisplay
invalidates/clears existing records. A redisplayer error MUST offer a controlled
skip/debug/retry path while leaving the frame structurally usable.

### Configurations and constraints

Pane configurations form a tree of rows, columns, panes, and size constraints over
the underlying TV frame. The solver must allocate exact integer geometry and preserve
the TV frame invariants. Switching configurations deexposes absent panes, exposes
present panes, updates selected/terminal-I/O panes if needed, and invalidates formatted
and presentation regions affected by movement.

Pane parsing validates unique names, infers conventional query/selected/terminal/label
roles, and can turn output-measured sizing into a request to the TV constraint system.
If no explicit configuration is supplied, every declared pane appears in a default
vertical column. A configuration switch MUST occur in a safe owning-process context,
rebind all role streams, and repaint newly exposed or resized panes.

![Frame-Up displaying the live two-pane split used to verify program-frame configuration and pane geometry.](../assets/genera-screenshots/frame-up-split-layout.png)

> Bounded runtime evidence: the reviewed Frame-Up capture shows one live split-pane
> configuration after the recorded synthetic layout interaction. It supports the
> pane/configuration claim, not every constraint rule or framework lifecycle branch.
> Portable provenance and the image-specific rightsholder/fair-use analysis are in
> the [Genera screenshot asset catalog](../assets/genera-screenshots/index.md); the image is
> scholarly evidence, not a decorative gallery item or a runtime dump.

An activity advertises a name, selection key/System Menu entry, compatibility test,
and creation/reuse operation. Selection SHOULD find and raise an existing compatible
frame before creating another when reuse is enabled; it must not rerun destructive
initialization merely to expose the old frame.

**Evidence:** `G85-SRC`, `program-framework-panes.lisp.~32~:58-459`,
`define-program-framework.lisp.~332~:55-340,1106-1233,1343-1426,1726-1789`, and
`window/activities.lisp.~35~:65-554`; `G8-MAN` documents frameworks, the original six
overview pane families, configuration, and redisplay options. The Frame-Up split is
`G85-RUN`; default-column creation, every pane type, role inference, measured sizing,
reuse, and failure restarts remain `TODO-RUNTIME`.

## Accepting Values

### Query model

```text
AcceptingValuesQuery {
  id
  presentation_type
  prompt
  value
  default_and_default_state
  changed_by_user
  presentation_type_actually_read
  redisplay_piece
  start_position
  required_or_confirmation_policy
  dependency_or_cache_value
  displayed_value_presentation
  chooser_or_samples
  continuation
}
```

`ACCEPTING-VALUES` repeatedly runs a display body inside redisplay. Query IDs MUST be
stable across iterations so values and presentations match. Editing a query updates
its semantic value, validates it, records history when enabled, and redisplays the
query plus any dependent output whose cache changed.

When an explicit query identifier is absent, the selected source derives one from a
string prompt, or otherwise from the presentation type. The query table compares keys
with `EQUAL`. Repeated same-prompt/type queries therefore MUST supply distinct explicit
identifiers. An unchanged query can adopt a changed application default according to
the selected default policy; a user-changed query retains its value unless the
application explicitly resets it.

```text
SIZE/DISCOVER:
  run body; establish query identities and natural output size
DISPLAY:
  rerun body through updating output; match each query by identity
READ:
  accept pointer choice, field edit, navigation, Refresh, End, Abort, or command
EDIT FIELD:
  edit inline, in a limited area, at form end, or in a separate window
  parse through ACCEPT; on failure retain old semantic value and correction text
RESYNCHRONIZE:
  rerun body; add/remove conditional queries; preserve matching changed values
RETURN:
  rerun in return mode so each query yields its final semantic value
```

The facility dispatches by stream capability. Plain/remote streams use serial
prompts; a Dynamic Window can edit inline; a non-Dynamic TV stream can use a separate
screen/window; an Accept Values pane participates in its owning framework.

### Interaction contract

The `DW-G85/D4` standalone form MUST support:

- Select to replace a value through its type;
- Select-and-Edit to begin from the prior value;
- Remove to reset through the form's query command;
- presentation-sensitive enumerated choices, samples, and command buttons;
- next/previous question and next/previous choice navigation;
- edit/remove accelerators;
- complete refresh;
- generated Help;
- Done/End validation and commit; and
- Abort without accepting the form.

Pane-based Accept Values reuses the query/redisplay substrate but routes its commands
through the owning program. It MUST resynchronize program state after commands.

![The live Set GC Options Accepting Values form with typed Boolean choices and the pointer over its Abort presentation.](../assets/genera-screenshots/accepting-values-gc-options.png)

> Runtime observation: the preserved Genera 8.5 world rejected an expression entered
> while a Boolean field owned the input context, redisplayed after correction, changed
> the mouse documentation over the Abort presentation, and returned without applying
> options after pointer selection. This bounded scholarly claim establishes typed
> field input and presentation-sensitive abort, not every query type. Portable
> provenance and the image-specific rightsholder/fair-use analysis are in the
> [Genera screenshot asset catalog](../assets/genera-screenshots/index.md); the image is
> evidence, not decoration or a runtime dump.

**Evidence:** `G85-SRC`, `accept-values.lisp.~244~:105-1706`; `G8-MAN` independently
documents prompt/query identity, `EQUAL` comparison, conditional queries, and
formatted query output. Boolean correction and Abort are `G85-RUN`; changed-default
resynchronization, every edit placement, command buttons, and non-Dynamic/serial
fallbacks remain `TODO-RUNTIME`.

## FQUERY and query-stream compatibility

`FQUERY` is a lower-level choice prompt, not an Accepting Values synonym. It selects
or creates a query window when required, applies beep/clear/fresh-line options,
renders the prompt, and loops until a legal choice, character, line, or abort outcome
is obtained. Its choice objects have a presentation type and can use the completion
engine. Yes/no queries are specializations of this protocol.

```text
fquery(options, prompt, choices):
  select an existing compatible query stream or create a temporary one
  apply clear/fresh-line/beep and prompt options
  choose character-reader or line/completion-reader according to choice grammar
  loop until a typed choice, choice presentation, or permitted raw response succeeds
  unwind and release any temporary query window on Abort or nonlocal exit
```

A plain stream implementation MUST retain textual choice semantics without claiming
pointer/menu support. A spatial implementation MUST return the semantic choice object
from a presentation rather than reparsing its label. **Evidence:** `G85-SRC`,
`io1/fquery.lisp.~104~:55-327`; public query operators are `G8-MAN`. A systematic
FQUERY character/line/window/abort matrix is `TODO-RUNTIME`.

## Menu and sequence clients

These are selected-source client contracts, not yet complete `G85-RUN` oracles. The
interaction rules below are therefore `G85-SRC` requirements with `TODO-RUNTIME`
attached wherever exact drag thresholds, key sets, return values, or Abort ownership
have not been measured in the loaded world.

### `menu-program`

The reusable menu program accepts arbitrary semantic choices. Pointer Select returns
the recorded choice object. Typed characters build a case-insensitive prefix;
next/previous navigation moves the highlighted match; End returns it; Rubout and
Clear Input edit the prefix; Help reports generated controls; Abort exits without a
choice. Prefix state and highlight MUST remain synchronized after the choice set
changes.

### `reorder-sequence`

Each element is a presentation. Holding Select and dragging an item vertically moves
it as the pointer crosses recorded item regions. Done returns the reordered sequence;
Abort returns no committed result. The operation uses a working sequence so abort
cannot partially modify the caller's original unless the API explicitly documents
destructive input.

### `alter-sequences`

The client selects two working sequences, permits dragging within or between them,
and returns one result per original candidate, using an unchanged marker where
appropriate. Cross-sequence deletion and insertion MUST be atomic with respect to
Abort so an element cannot disappear or be duplicated between the two mutations.

### `undo-program`

The Graphics Editor source supplies a reusable, nonselectable Dynamic Windows program
framework for undo. Its history is a branching chain/tree, not only two stacks. Each
element has a name, monotonically assigned index, previous link, and either no next
element, one next element, or a list of alternative next branches. Each concrete
element MUST implement initialize, undo, and redo operations.

The current pointer denotes the last operation done or redone. Undo executes that
element's inverse and moves to its previous element. Redo either follows the one next
element or asks the user to choose among branches; an explicitly selected element can
be the target of Undo or Redo. Commands include Undo, Redo, Skip to the next branch,
and Clear Undo History. The `UNDO-ELEMENT` presentation type completes over names in
the history; command-menu handlers use a direct gesture for the default step and a
menu gesture to choose a specific element.

A reimplementation MUST preserve branches created after undoing and then performing a
new action. It MUST not silently discard the former redo path unless a documented
client policy requests linear history. Clearing history releases the full graph and
sets first, last, and current to empty; the selected source does **not** reset the
monotonic assignment index, so later entries keep increasing. Exact menu geometry,
messages, and branch-choice interaction are
`TODO-RUNTIME`.

`MENU-PROGRAM` resides in the program-framework implementation; reorder/alter clients
load in the Dynamic Window Clients layer; `UNDO-PROGRAM` is a generic framework in the
Graphics Editor source. Semantic equality and the supplied element presentation type
govern identity; display strings are not a valid substitute.
**Evidence:** selected component order at
`patch/system-452/system-452.component-dir.~10~:453-457`, client definitions in
`define-program-framework.lisp.~332~`, `reorder-sequence.lisp.~10~`, and
`graphic-editor/undo.lisp.~16~:56-323`, and public client descriptions in `G8-MAN`.
Standalone synthetic sessions for all four remain `TODO-RUNTIME`.

## Diagnostics and introspection

A conforming D0 implementation MUST make the following state inspectable:

- canonical presentation type, arguments, expansion, and method providers;
- presentation ancestry and bounding regions under a pointer;
- active input-context stack and reductions;
- every considered handler, its effective priority, gesture, menu policy, and exact
  acceptance/rejection reason;
- command-table inheritance and effective commands/accelerators;
- output-history and redisplay record ancestry; and
- cache epochs and invalidation events in a debugging mode.

The historical Presentation Inspector is the behavioral model. Diagnostics MUST NOT
execute a rejected handler merely to explain it.

![The Presentation Inspector showing applicable and rejected handlers for a researcher-entered integer presentation.](../assets/genera-screenshots/presentation-inspector-handler-report.png)

> Runtime observation: the preserved inspector displayed handler categories,
> priorities, gestures, menus, and applicability for the selected integer. This is
> bounded scholarly evidence that dispatch retains inspectable semantic candidates
> rather than one callback attached to the text rectangle. Portable provenance and
> the image-specific rightsholder/fair-use analysis are in the
> [Genera screenshot asset catalog](../assets/genera-screenshots/index.md); the image is
> evidence, not decoration or a runtime dump.

## Error, abort, and transactional behavior

These `INFERRED` reconstruction invariants synthesize the source, manual, and runtime
contracts and hold across all normal and recovery paths. They are not claims about
Genera's internal representation:

1. Every live child presentation has exactly one live parent or is a root.
2. A committed presentation object satisfies its declared type.
3. Pixels/output records and the semantic/spatial index commit together or the
   affected region is invalidated for repaint.
4. Type, handler, gesture, command, and redisplay cache entries name the generations
   for which they are valid.
5. Equal handler inputs produce deterministic candidate order.
6. Input contexts and transient feedback are removed after every nonlocal exit.
7. Presentation blips cannot dereference deleted records silently.
8. Redisplay's display pass has the same piece identities/classes/order as collection.
9. Recorded raster inputs are replay-stable.
10. Program role streams refer to active-configuration panes or a documented plain
    stream fallback.
11. Accepting Values preserves user-changed fields across resynchronization by query
    identity.
12. Parser, printer, completion, and membership methods agree on the semantic value
    domain of a type.

A conforming implementation MUST report and unwind safely for:

- unknown, malformed, or cyclic presentation types; incompatible redefinitions; or
  use of generation-sensitive state cached under an obsolete definition;
- an object that fails its declared presentation type;
- missing printer/parser/method for a required role;
- incomplete, ambiguous, or invalid typed input;
- a handler translation whose result fails the target context;
- handler ambiguity that cannot be resolved by specified nesting, priority,
  dependency, menu, and stable-name rules;
- stale or invisible presentation selection;
- duplicate redisplay IDs within one matching scope;
- malformed formatted-output nesting;
- impossible pane constraints or missing pane names;
- command-table inheritance cycles or accelerator conflicts; and
- a pane/program command invoked after its owning frame was killed.

Abort is an ordinary interaction outcome, not process corruption. It MUST remove
transient input editor state, contexts, highlights, menus, temporary TV windows, and
uncommitted output/redisplay records. Application model mutations that span multiple
steps SHOULD be protected by an explicit transaction or abort inhibition around the
small critical region.

## Performance requirements

The 1989 implementation reported global handler lookup and cache pressure. The
following performance guidance is `INFERRED`; a new implementation SHOULD improve
these properties while preserving results:

- index handlers by logical gesture and source-type ancestry;
- cache canonical types and type-method paths by descriptor epoch;
- cache effective command tables by table ancestry epoch;
- spatially index visible presentation regions while retaining semantic nesting;
- keep object-specific testers late in candidate evaluation;
- reconcile redisplay by stable scoped IDs rather than quadratic full-tree search;
- bound retained output history or expose an application-controlled reclamation
  policy; and
- provide counters for cache hits, candidate counts, full redraws, moved pieces, and
  stale-record rejection.

Optimization MUST NOT change which handler wins, omit Help/documentation candidates,
or leave presentation indexes inconsistent with pixels.

## Relationship to CLIM

CLIM inherits many ideas—presentation types, `PRESENT`/`ACCEPT`, translators,
commands, output records, incremental redisplay, frames, and panes—but is a portable
successor with a different API and implementation architecture. It is useful as an
independent conceptual cross-check, not as evidence of a Genera 8.5 default or exact
function contract.

A reconstruction MAY implement a CLIM adapter above this specification. It MUST NOT
claim Dynamic Windows conformance merely because a CLIM program runs. The full
release boundary and catalog audit are in
[How CLIM was used across the Lisp-machine software catalogs](../clim-use-across-lisp-machine-software.md).

## Clean-room reference architecture

A practical new implementation can use this decomposition:

```text
presentation-types/
  syntax, descriptors, methods, lattice, generations, collision-safe caches

presentations/
  semantic records, nesting, regions, spatial index, output-history transactions

input/
  contexts, blips, gestures, handler selection, pointer documentation
  editor, history, rescan, completion

commands/
  tables, descriptors, command objects, accelerators/prefixes, typed reader

output/
  formatted continuations, simulation and measurement
  updating-record tree, tables, reconciliation and redraw planner

graphics/
  drawing state, transforms, primitives, raster backend, recorded operations

framework/
  panes, configurations, activities, lifecycle, program loop
  Accepting Values, FQUERY, menu and sequence clients

backend/
  Genera-TV dependency subset: sheets, streams, events, selection, raster, processes
```

The following clean-room architecture is `INFERRED`, not a claim about Genera's
representation. Normalized type and handler descriptors SHOULD be immutable snapshots.
Semantic output records SHOULD be backend-neutral, with pixel resources attached only
by the renderer. Every history update should build a candidate tree and commit under
one per-stream transaction. Start with correct full redraw; add pixel movement and
caches only after generation invalidation and recovery tests pass.

This specification publishes only original behavioral analysis, witness metadata, and
black-box tests intended for clean-room use. It does not publish proprietary bytes or
implementation expression and does not decide downstream legal rights. Extracted
Help, fonts, bulk runtime output, and the licensed source and world remain outside this
specification.

## Reference protocol inventory

| Protocol family | Required operations |
| --- | --- |
| Type definitions | define/redefine type, canonicalize, expand, query descriptor, define/invoke type method |
| Type relationships | membership, subtype/supertype, walk expansions, equivalent host type, argument-aware predicates |
| Typed output | `PRESENT`, scoped presentation recording, nested records, views, sensitivity, highlighting region |
| Output history | add/remove/clear records, transform/scroll, visibility, hit test, presentation ancestry |
| Typed input | `ACCEPT`, parser/printer, defaults, semantic blips, editor/rescan/activation, history, completion, postprocessing, compound contexts |
| Contexts | push/pop/reduce, inspect stack, match target, unwind on abort |
| Handlers | define translator/action/command/blank handler, test, prioritize, document, menu expose, invoke |
| Gestures | raw-to-logical mapping, modifier variants, current documentation |
| Commands | define command, accept arguments, construct/execute object, command loop, Help metadata |
| Command tables | define/inherit/mutate, effective lookup, accelerator and menu levels, cache invalidation |
| Formatted output | boxes, tables, cells, item lists, text blocks, graphs, measure/layout/replay |
| Redisplay | define piece, unique ID/cache, match, move/erase/redraw, nested reconcile, commit/abort |
| Dynamic streams | viewport, scrolling, output history, presentation index, input/command environment |
| Graphics | drawing state, viewport transform, clipping, primitives, ALUs/opacity, patterns/raster adapter, graphical presentations, history-only/direct modes |
| Frameworks | define program/state/panes/configurations/hooks, instantiate/select/loop/deselect/kill, register activity |
| Query/client facilities | Accepting Values query loop, FQUERY, menu program, reorder/alter sequences, branching undo framework |
| TV/backend boundary | sheets, interactive streams, events/wakeups, raster, coordinates, process ownership, activities, plain/remote degradation |
| Diagnostics | type, presentation, context, handler, command, output, redisplay, and cache inspection |

## Historical source-interface and selected-module coverage

This appendix is normative about the boundary of a compatibility claim. D0-D4 cover
the semantic protocols and behaviors stated in this document. They do not promise
that an unmodified historical Genera program will compile. D5 is the closure level for
that stronger claim. A `pending` entry is an explicit nonclaim, not permission to
infer Genera behavior from CLIM or from a modern toolkit.

### D5 public API closure

For D5, the implementation MUST publish a machine-readable manifest that gives the
historical package and symbol, operator kind, complete lambda list or macro grammar,
defaults, accepted options, return values, conditions and restarts, and the D0-D4
semantic operation implemented by each public entry. Public manual metadata should be
the first source for public interfaces; installed-source metadata can identify
System 452.22 additions or differences without publishing implementation bodies.

| Surface | D0-D4 coverage in this specification | D5 closure requirement and current state |
| --- | --- | --- |
| Presentation-type definition and methods | Descriptor, argument classes, inheritance, method roles, generations, and invalidation | Exact defining macro/function names, package exports, lambda lists, method option grammars, redefinition values, and conditions are **pending** |
| Typed output, input, and contexts | `PRESENT`, scoped presentation recording, `ACCEPT`, input transactions, defaults, histories, completion, and nested contexts | Exact operator signatures, keyword defaults, multiple values, condition/restart contracts, and context-form grammars are **pending** |
| Handler definitions and logical gestures | Handler kinds, applicability, ordering, menu/direct modes, gesture mapping, diagnostics, and invalidation | Complete built-in handler catalog, exact defining forms/options, standard handler names, and add/remove/redefinition interfaces are **pending** |
| Standard presentation types | The 135 source-form calls are inventoried by family; common family invariants are normative | Per-type data and presentation lambda lists, defaults, parser/printer/view behavior, aliases, conditional population, and loaded-world identity are **pending** |
| Input editor, history, and completion | Buffer/blip/rescan model, major command map, numeric arguments, completion states, and semantic return values | Exact public entry points, every command chord, option grammar, history protocol, resource conditions, and completion auxiliary values are **pending** |
| Command Processor | Command objects, table inheritance, typed arguments, accelerators, menus, command/form reading, and loop semantics | Exact CP packages, public symbols, macro grammars, argument-slot encodings, prefix APIs, compatibility aliases, values, conditions, and restarts are **pending** |
| Formatted output and redisplay | Box families, simulation, tables, capture rules, updating pieces, reconciliation, movement, and recovery | Exact combinator names/signatures/options, output-record classes, redisplay entry points, rounding rules, and callback counts are **pending** |
| Graphics and raster integration | Drawing state, primitive families, transforms, clipping, ALUs, opacity, recorded graphics, and output modes | Exact graphics signatures/options, pattern constructors, device auxiliary values, primitive edge rules, and public binary-graphics framing are **pending** |
| Dynamic streams and frameworks | Stream state, TV dependency, pane/configuration semantics, corrected lifecycle phases, activities, and role streams | Exact flavors/classes, messages/functions, pane and constraint grammars, hook signatures, creation/reuse options, values, and conditions are **pending** |
| Query and reusable clients | Accepting Values, FQUERY, menu, sequence, and branching-undo semantics | Exact operator signatures, query option grammars, drag thresholds, return conventions, and Abort ownership are **pending** |
| Diagnostics | Required semantic inspection state and safe rejection reporting | Exact inspector commands, programmatic entry points, report formats, and auxiliary values are **pending** |

D5 conformance MAY be claimed for a declared subset only when every public interface
used by that subset has a complete manifest entry and a black-box source-compatibility
test. It MUST NOT be generalized from one compiling demonstration to the complete
Dynamic Windows API. Exact private binary encodings, QFASL compatibility, and Ivory
object layout require separately named profiles even after D5 closes.

### Selected System 452.22 module coverage

The component directory is a load-selection witness, not proof that every selected
module has a separate public contract. This matrix prevents a selected module from
silently disappearing from the reconstruction boundary. `Normative` means this page
states its D0-D4 semantic contract. `Partial` means only the named behavior is in the
base profile; the remaining public surface needs a subprofile or D5 closure.
`Infrastructure` means no independent user-visible contract has yet been established.

| Selected component group | D0-D4 status | Unspecified or follow-up boundary |
| --- | --- | --- |
| `SUBSTRATE-DEFINITIONS`, `TYPE-DESCRIPTOR`, `TYPE-METHODS`, `TYPE-WALK`, `TYPE-KEYS`, `DEFINE-TYPE`, `DEFINE-HANDLER`, `TYPE-PRIMITIVES`, `ACCEPT-SUBSTRATE` | **Normative:** semantic records, types, methods, lattice, definitions, typed I/O, and invalidation | Exact public operators and representation-facing auxiliary values are D5-pending |
| `GOOD-TABLES`, `MOUSE-HANDLER-TEST`, `HISTORY-INNER`, `HISTORY-SUBSTRATE`, `RESTRUCTURE-ARGLIST` | **Infrastructure/partial:** table lookup, testing, history, and argument normalization effects are consumed by normative protocols | No independent public contract is claimed; audit exports and callers before assigning a D5 surface |
| `CORE-TYPES`, `NUMBER-TYPES`, `SEQUENCE-TYPES`, `PRESENTATION-TYPES`, `CHARACTER-STYLE-PRESENTATIONS` | **Partial:** source-form name inventory and family invariants are specified | Exact per-type signatures/methods and live conditional population are D5-pending and `TODO-RUNTIME` |
| `COMPLETION`, `DYNAMIC-INPUT` | **Normative:** completion, editor/blip integration, gestures, pointer documentation, and input-context behavior | Remaining command/chord and ambiguity edges are `TODO-RUNTIME`; exact APIs are D5-pending |
| `BASIC-HANDLERS` | **Partial:** handler mechanism, standard gesture meanings, and representative live handlers are specified | Complete identity/default translator, action, command, menu, and debugging-handler inventory and contracts are D5-pending |
| CP `DEFS`, `COMTAB`, `COMMAND-PROCESSOR`, `READ-ACCELERATED-COMMAND`, `SUBSTRATE-COMMANDS` | **Normative** for command-table, typed reader, accelerator, and loop semantics; `DEFS` supplies shared declarations | Exact public API, standard substrate commands, and conditions are D5-pending |
| CP `OLD-SYMBOL-LINKS` | **Compatibility support** | Historical aliases are required only for D5 and remain pending |
| `FORMATTED-OUTPUT`, `REDISPLAY`, `DISPLAYED-PRESENTATION`, `DYNAMIC-WINDOW` | **Normative:** layout families, recorded output, semantic regions, streams, replay, and redisplay | Exact public API and remaining layout/pixel oracles are D5-pending or `TODO-RUNTIME` |
| `FORMATTED-OUTPUT-COLD`, `BOX-ARITHMETIC` | **Infrastructure/partial:** cold-load availability and box results support the normative layout contract | Exact arithmetic, rounding, cold-load dependencies, and any public entries need source audit and runtime probes |
| `GRAPHICS-PATTERNS`, `DYNAMIC-WINDOW-FLAVORS`, `GRAPHICS-FLAVORS`, `DYNAMIC-WINDOW-MIXINS`, `GRAPHICS-GENERICS`, `RASTER-GRAPHICS-MIXIN`, `DEFINE-VIEWPORT-GRAPHICS-OPERATION` | **Normative** for drawing state, transforms, primitives, raster execution, recording, and the TV adapter; patterns and flavor/mixin surfaces are **partial** | Pattern constructors and exact flavor/message APIs are D5-pending; primitive raster edges remain `TODO-RUNTIME` |
| `DYNAMIC-WINDOW-COMBINATIONS` | **Partial:** the base profile permits embedded subwindows and composite formatted output | Exact combination constructors, ownership, layout, input routing, and destruction semantics need a dedicated source/runtime subprofile before a compatibility claim |
| `GRAPHER` | **Partial:** graph/tree output, node/edge records, layout, and presentations are required only at the family level | Exact graph data model, layout algorithm, options, interaction, and failure behavior need a dedicated source/runtime subprofile |
| `BINARY-GRAPHICS` | **Partial:** versioned typed encoding and failure on unsupported values are specified | Byte-exact framing/opcodes are outside D0-D4 and remain separately pending after D5 unless explicitly included |
| `WINDOW;ACTIVITIES` | **Normative dependency:** registration, compatibility, selection, reuse, and state distinctions | Exact TV activity API belongs to the Genera-TV backend/D5 manifest |
| `WINDOW;BACKGROUND-STREAM` | **Partial dependency:** capability-tested textual degradation is normative | Exact queueing, process, remote, failure, and lifecycle behavior remains `TODO-RUNTIME` and D5-pending |
| Dynamic Windows `COMETH` | **Unclassified selected component** | Its independent purpose and public contract are not established here; do not infer either. Source/caller analysis is required before D5 closure |
| `PROGRAM-FRAMEWORK-PANES`, `DEFINE-PROGRAM-FRAMEWORK`, `ACCEPT-VALUES`, `IO1;FQUERY`, `REORDER-SEQUENCE` | **Normative** for pane families, lifecycle, typed forms/queries, menus, and sequence clients | Exact public grammars, options, values, and remaining interaction oracles are D5-pending |
| `GRAPHICS-TESTS`, `FORMATTED-OUTPUT-TESTS` | **Test-only in the selected directory:** not selected as normal loaded components | They are candidate oracle cases and evidence, not automatically normative production APIs |

**Coverage evidence:** `G85-SRC` component selection at
`patch/system-452/system-452.component-dir.~10~:370-457`. This matrix describes
coverage status only; it does not reproduce or characterize an uninspected module by
its name alone.

## Conformance test suite

Each test records the implementation version, `DW-G85` profile, TV backend, logical
event trace, semantic objects/results, record tree, and final framebuffer region. A
comparison against the preserved world additionally records the complete harness
provenance described below.

### D0 substrate tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-T01` | Type argument separation | Data arguments affect membership/subtyping; presentation arguments affect rendering/input without accidental membership change |
| `DW-T02` | Type expansion | Methods and relationships follow expansion; a cycle is diagnosed |
| `DW-T03` | Redefinition invalidation | Old type/method/handler cache entries cannot affect the redefined descriptor |
| `DW-T04` | Semantic versus host type | Two types over the same host class remain distinguishable in contexts and printers |
| `DW-T05` | Nested presentation recording | Exact objects, types, parentage, regions, and sensitivity survive output |
| `DW-T06` | Presentation unwind | An aborted output scope leaves no selectable incomplete record |
| `DW-T07` | Visibility and scrolling | Off-viewport history persists but cannot be selected until visible |
| `DW-T08` | Typed parser correction | Invalid input reports locally and remains editable; corrected input returns the typed object |
| `DW-T09` | Default and edit-default | Selecting and editing a default take the correct distinct paths |
| `DW-T10` | Completion states | Incomplete, ambiguous, unique, and invalid input remain distinct |
| `DW-T11` | Compound acceptance | Inner pointer/typed input satisfies one component and outer parser resumes correctly |
| `DW-T12` | History validation | Recalled object is checked against current arguments and predicate |
| `DW-T13` | Four-state subtyping | True, false, unknown, and conditional parameter relationship remain distinguishable internally |
| `DW-T14` | Type-key collision | Compact/canonical cache collision cannot change membership, methods, subtype, or handlers |
| `DW-T15` | Semantic blip rescan | Placeholder is visible, but parser receives the original atomic blip/object after editing |
| `DW-T16` | Dead blip | Deleting its presentation produces controlled correction, never stale dereference |
| `DW-T17` | Kill/history separation | Consecutive kills coalesce, yank rotates only after yank, and stream history remains separate |
| `DW-T18` | Numeric editor argument | Modified digits/minus and repeated `C-U` affect character, word, and expression commands correctly |
| `DW-T19` | Completion policy | No-match, ambiguity, left-substring, unique and exact states; closed types reject forced arbitrary input |

### Handler tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-H01` | Direct subtype match | A subtype presentation directly satisfies a supertype context |
| `DW-H02` | Translator match | Source subtype, target context, tester, and gesture produce the translated object |
| `DW-H03` | Rejected result | A translated object failing target predicate is not accepted |
| `DW-H04` | Nested contexts | Innermost applicable context wins; outer context remains available if inner has no candidate |
| `DW-H05` | Nested presentations | Innermost eligible presentation wins subject to explicit priority and sensitivity policy |
| `DW-H06` | Priority and deterministic tie | Effective ordering is stable and diagnostics show the rule |
| `DW-H07` | Action continuation | Action runs and original accept continues without a spurious value |
| `DW-H08` | Presentation-to-command | Result is a typed command object with selected operand, not immediate callback-only execution |
| `DW-H09` | Blank-area fallback | Applies only when no more specific candidate owns the gesture/context |
| `DW-H10` | Documentation parity | Highlight/mouse documentation names exactly the dispatchable handlers under each modifier |
| `DW-H11` | Handler mutation | Add/remove/redefine invalidates caches and changes dispatch immediately |
| `DW-H12` | Inspector safety | Candidate reasons are visible without executing handler bodies |
| `DW-H13` | Menu/direct separation | Menu-only and gesture-only handlers appear only in the applicable mode |
| `DW-H14` | Context dependency and exclusion | Context-dependent tie and exclude-other-handlers follow selected ordering |
| `DW-H15` | Gesture remap | Remapping physical chord updates dispatch and pointer documentation immediately |

### D1 command tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-C01` | Mixed argument sources | One command accepts typed, completed, and pointed operands in sequence |
| `DW-C02` | Entry-path equivalence | Typed name, menu, accelerator, and translator build equivalent command objects |
| `DW-C03` | Table inheritance | Commands, menus, handlers, and accelerators resolve deterministically; cycles fail |
| `DW-C04` | Table mutation | Descendant effective caches and Help update after change |
| `DW-C05` | Accelerator conflict | Profile rule resolves or reports conflict; it never silently invokes an arbitrary command |
| `DW-C06` | Abort command read | Partial argument contexts/editor/highlights unwind and command body does not run |
| `DW-C07` | Post-command lifecycle | Hooks and configured redisplays occur exactly once after a successful command |
| `DW-C08` | Noun-verb versus verb-noun | Equivalent semantic command and result for both interaction orders |
| `DW-C09` | Unread versus NIL | Conditional/optional unread slot stays distinct from an explicitly supplied NIL |
| `DW-C10` | Depth-first inheritance | First command/accelerator found in declared depth-first parent order wins |
| `DW-C11` | Prefix Help and activation | Prefix state lists legal continuations and cannot execute before completion |
| `DW-C12` | Numeric accelerator argument | Prefix argument reaches the same semantic command body exactly once |
| `DW-C13` | Command/form correction | Failed command input remains editable and cannot become an unintended evaluated form |

### D2 output and redisplay tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-O01` | Table alignment | Cell edges align across rows and nested presentations retain correct transformed regions |
| `DW-O02` | Item-list reflow | Width change alters row/column layout without changing object identity or order |
| `DW-O03` | Deferred state | Snapshotted and explicitly shared variables replay according to declaration |
| `DW-O04` | Stable redisplay ID | Equal cache and geometry retains pixels/record identity without executing changed renderer |
| `DW-O05` | Changed cache | Old full region erases and new output/presentations replace it |
| `DW-O06` | Move-only piece | Pixels may move, but nested semantic regions and clipping update exactly |
| `DW-O07` | Insert/delete/reorder | Final pixels/order equal a full redraw; no stale presentation is selectable |
| `DW-O08` | Duplicate ID | Diagnosed or deterministically scoped; never randomly matched |
| `DW-O09` | Redisplay abort | Old coherent tree or complete redraw remains; no mixed record index |
| `DW-O10` | Output-history clear | Removes visible/hidden presentations and redisplay associations |
| `DW-O11` | Overlapping moved pieces | Final stacking and exposed backgrounds equal a full redraw |
| `DW-O12` | Highlight during redisplay | Transient feedback is removed/recomputed and never becomes application output |
| `DW-O13` | Collection/display identity | Changing piece sequence/class/order between passes signals and forces coherent redraw |
| `DW-O14` | Callback count | Cache hit/miss and changed-piece paths execute collection/display continuations as specified |
| `DW-O15` | Flow-dependent child | Unsafe independent redisplay escalates to the nearest layout-safe ancestor |
| `DW-O16` | History-only/direct output | Record-without-draw and draw-without-record remain distinct for text and graphics |
| `DW-O17` | Mutable recorded raster | Replay uses the recorded snapshot, not later-mutated source bytes |

### D3 framework tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-F01` | Definition validation | Bad pane names/configuration/table cycles fail before registration |
| `DW-F02` | Lifecycle phase order | Definition-time activity registration, instance/state initialization, TV pane construction, activation/selection hooks, stream binding and top-level execution, reuse/reset, deexposure, and kill follow the specified phases; frame creation neither re-registers the activity nor invokes a nonexistent generic initialization hook |
| `DW-F03` | Nonselectable framework | Usable internally but absent from activity/System Menu/Select registries |
| `DW-F04` | Pane registry extension | New pane type appears to design/introspection tools without modifying their fixed code |
| `DW-F05` | Command menu unity | Menu item invokes the same command object and hooks as typed interaction |
| `DW-F06` | Display incremental policy | Only configured panes redisplay, with full versus incremental behavior respected |
| `DW-F07` | Configuration switch | Pane exposure, geometry, selected and terminal-I/O panes, and presentation transforms stay coherent |
| `DW-F08` | TV cover/deexpose | Dynamic output history remains semantic and redraws/restores correctly through TV lifecycle |
| `DW-F09` | Graphics transform | Application, viewport, history, sheet, and device coordinates round-trip within integer policy |
| `DW-F10` | Graphical presentation | Arbitrary drawing returns the exact recorded object through a gesture |
| `DW-F11` | Default pane configuration | Omitted configuration places every declared pane in a vertical column and binds inferred role streams |
| `DW-F12` | Activity reuse | Compatible existing frame is selected without destructive reinitialization |
| `DW-F13` | Remote/plain stream | Typed input/query semantics degrade textually without fabricated spatial facilities |

### D4 client tests

| ID | Test | Pass condition |
| --- | --- | --- |
| `DW-A01` | Accepting Values query stability | Query IDs preserve values/history across iterations and dependent redisplay is selective |
| `DW-A02` | Type rejection/correction | Wrong typed value does not commit; corrected value redisplays and can commit |
| `DW-A03` | Done versus Abort | Done validates/returns; Abort leaves caller state unchanged |
| `DW-A04` | Samples and buttons | Compatible sample copies value; command continuation runs then form resynchronizes |
| `DW-A05` | Pane ownership | Accept Values pane commands route through owning framework and state |
| `DW-M01` | Menu prefix | Case-insensitive prefix, highlight navigation, End, Rubout, Clear, Help, and Abort remain synchronized |
| `DW-R01` | Reorder drag | Each threshold crossing moves one item; Done returns order; Abort discards working state |
| `DW-R02` | Cross-sequence abort | Element exists exactly once before and after an abort at every mutation boundary |
| `DW-Q01` | FQUERY choice parity | Character, line/completion, and pointer choice return the same semantic choice object |
| `DW-Q02` | FQUERY cleanup | Temporary query window and editor/context state unwind on every Abort boundary |
| `DW-A06` | Query resynchronization | Conditional removal/reappearance preserves explicit-ID changed value under selected policy |
| `DW-U01` | Branching undo | Undo then new action preserves both redo branches; branch choice reaches the selected operation |
| `DW-U02` | Clear history index | Clear empties first/last/current while later operation indices remain monotonic |

## Source, compiled-world, and oracle disagreement rules

System 452.22's component directory establishes which source modules were selected;
it does not prove that the saved Genera 8.5 world contains those exact definitions.
The world can include patches, conditionals, architecture-specific compiled code,
runtime redefinitions, or definitions with no readable selected source witness.

Apply these rules:

1. For the `DW-G85` behavioral profile, a reproducible `G85-RUN` observation of the
   identified world outranks a conflicting source-only prediction for that exact
   interaction.
2. `G85-SRC` remains authoritative evidence for the selected source interface and
   algorithm; do not rewrite it to pretend it agreed with the world.
3. `G85-WORLD` introspection can establish that a definition, type, table, activity,
   or compiled method is resident, but not every hidden branch's behavior.
4. `G8-MAN` establishes intended public behavior. A manual/source/world conflict is
   recorded as a three-way conflict, not resolved by choosing the most convenient
   text.
5. `UIST89` establishes chronology and the paper-era design, not a later 8.5 defect.
6. A screenshot proves only its bounded visible state and recorded input path. It
   cannot alone prove hidden object identity, cache behavior, or method provenance.
7. Until a harmless synthetic oracle reaches a branch, retain `TODO-RUNTIME` and
   implement the source-established rule behind a compatibility switch if needed.

Each future oracle should ask the running system for loaded definition/patch identity
where possible and attach it to the harness record. If compiled behavior differs, add
a conformance variant with both expectations rather than silently blending them.

Known compiled/wire gaps include the exact binary-graphics byte encoding, conditional
standard-type population, architecture-specific compact type-key limits, and any
patched definitions whose readable source origin the world cannot report.

## Preserved-world comparison procedure

Use a fresh named run through the
[Genera computer-use harness](genera-computer-use-harness.md). A comparison record
for this profile begins from the 54,804,480-byte `Genera-8-5.vlod`, SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
It MUST record whether the private copy matched that base at start and how it differed
at stop; a matching world hash still does not establish which source version produced
every compiled definition. The comparison record
MUST retain the base/private VLOD, debugger and VLM hashes, compatibility preloads,
time responder and configuration, namespace/isolation state, X window identity,
ordered input intents and outcomes, screenshots and pixel hashes, private-world hash
change, and every shutdown stage. A forced host cleanup after Genera's known shutdown
stall is not an orderly guest exit and must be labeled separately.

Prefer researcher-owned synthetic values, frames, types, handlers, and commands
created in unsaved memory. Do not publish licensed output payloads or source. A
reviewed screenshot may document only the visible state needed by a substantive
claim.

## Known unknowns and required follow-up

- `TODO-RUNTIME`: define a small synthetic type lattice and measure exact live
  priority, context-dependency, stable-name tie order, nested contexts, and nested
  presentations.
- `TODO-RUNTIME`: exercise handler add/remove/redefinition and observe cache
  invalidation in the preserved 8.5 world.
- `TODO-RUNTIME`: compare all logical gesture/modifier mappings and mouse
  documentation for a synthetic handler set.
- `TODO-RUNTIME`: exercise the full input-editor command map over text, styles, and
  presentation blips, including kill/history/search/selection and rescan boundaries.
- `TODO-RUNTIME`: measure every completion state, maximal completion,
  left-substring termination, quoting, and forced-invalid policy.
- `TODO-RUNTIME`: test command-table parent conflicts, accelerator prefix Help,
  numeric arguments, unread conditional arguments, and command/form fallback.
- `TODO-RUNTIME`: run a synthetic formatted table/item list through width changes and
  record exact rounding and conditional-break results.
- `TODO-RUNTIME`: exercise redisplay insert, delete, move, reorder, duplicate ID,
  abort, and mutable lexical capture in one harmless framework.
- `TODO-RUNTIME`: exercise standalone `menu-program`, `reorder-sequence`,
  `alter-sequences`, `FQUERY`, and the branching undo framework with synthetic data.
- `TODO-RUNTIME`: exercise all seven standard pane types, default-column role
  inference, measured pane sizing, activity reuse, and redisplayer error restarts.
- `TODO-RUNTIME`: exercise serial/plain/background/remote stream degradation without
  assuming spatial Dynamic Window operations.
- `TODO-RUNTIME`: compare graphics transforms, raster edge rules, clipping,
  history-only/direct modes, mutable raster replay, and binary-graphics framing.
- `TODO-RUNTIME`: measure output-history reclamation and global handler-cache behavior
  to determine which `UIST89` limitations remain in System 452.22.
- The D5 public API manifest and all `pending` selected-module entries in the coverage
  appendix remain closure tasks. Use the public dictionaries for public interfaces
  first and local installed-source metadata only to identify release-specific facts;
  do not publish proprietary implementation bodies.
- No claim is made that CLIM's unspecified corner behavior fills a Dynamic Windows
  gap. Unverified differences stay TODOs.

## Artifact identities

The following are metadata for licensed local evidence; the files remain untracked.

| File | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| Base `Genera-8-5.vlod` world | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` | `G85-WORLD` identity used by the reviewed runs; not proof of source-definition identity |
| `sys.sct/patch/system-452/system-452.component-dir.~10~` | 70,420 | `65223d62d539dc78e57ee3671f292686bb2e8d388314474d866fd1115d35bcf7` | Selected module order |
| `sys.sct/sys/sysdcl.lisp.~1059~` | 39,497 | `3bb5fad39feb2d174c53b94ea7b726a6f3fa3de1ec18a1293352bb68027c1584` | Subsystem order and module composition |
| `sys.sct/dynamic-windows/substrate-definitions.lisp.~44~` | 47,954 | `d9692d71c5e0237944a32330f2b02ba9cafdee23f6f34b2f586edd706fdf8e3e` | Presentation substrate structures/protocols |
| `sys.sct/dynamic-windows/type-descriptor.lisp.~12~` | 41,401 | `b891b5326b00307fb36512f7680114388ab7fe6913237fd5b3dc3ab860a4bae1` | Descriptor protocol |
| `sys.sct/dynamic-windows/type-methods.lisp.~6~` | 32,708 | `c759735e87f996be7ae9eb5efb2afb10c523ec425b134be927a2e53cb2879aed` | Type-method lookup/inheritance |
| `sys.sct/dynamic-windows/type-primitives.lisp.~11~` | 14,636 | `bb59437df0373786f97d2ac08c926722df5d9776814639cd97f783ebd2861ce7` | Membership/subtype primitives |
| `sys.sct/dynamic-windows/type-walk.lisp.~17~` | 36,581 | `4cd810e5e96286d74934d04ae610dc25bbfe8fa206506e44ab4e6f1ad94dee9b` | Type-lattice traversal and host bridges |
| `sys.sct/dynamic-windows/type-keys.lisp.~3~` | 23,515 | `9b847c448bfe07450e3ad5f30162d39b226bf0b4ffb7c853d72a701007452116` | Canonical/cache keys |
| `sys.sct/dynamic-windows/define-type.lisp.~8~` | 43,218 | `f7505ed64460c90361b2cdfc09e2a96667dc1381a76270301233aa88573e4046` | Type-definition interface |
| `sys.sct/dynamic-windows/define-handler.lisp.~12~` | 25,689 | `00d7c33ea97a342ff53877b8c33106f2b1730bb0fd86963d1a086e4bac883ab0` | Handler-definition interface |
| `sys.sct/dynamic-windows/dynamic-input.lisp.~498~` | 55,058 | `a79805ece6844ccb568ecf97e2d818a0c6095e539e51fbf74423944a32b6dd8f` | Input contexts and typed interaction |
| `sys.sct/dynamic-windows/mouse-handler-lookup.lisp.~33~` | 99,828 | `601385c017301e7158599b8dfe235650a1f5dee06a7944fc701ce8a4a491d716` | Handler lookup and caches |
| `sys.sct/dynamic-windows/accept-substrate.lisp.~19~` | 53,779 | `3cc5c405bac3dc98d321cef309d51e4f9b1ec77369c3a82019e0fbd983376a33` | `PRESENT`, `ACCEPT`, tokens/history |
| `sys.sct/dynamic-windows/core-types.lisp.~34~` | 83,350 | `3ff0511b6fcfd6b8d5583b6f5dd96bc7e651ac5ee49147ea50cb5126fbd2f927` | Core standard presentation types |
| `sys.sct/dynamic-windows/number-types.lisp.~5~` | 34,144 | `7db2b506d918daed44731466a5bbb1504d198be7d7aed785a7778acf34353fa1` | Numeric standard presentation types |
| `sys.sct/dynamic-windows/sequence-types.lisp.~28~` | 86,023 | `2486d359cd77f76ae8488a7ba87823654696807d6808b081d20d884038d8a163` | Sequence and membership presentation types |
| `sys.sct/dynamic-windows/presentation-types.lisp.~722~` | 69,051 | `cbe5cc7b320896ca7c835ffb40c2835ed4fd78cb4496c965fcf91290fd541a38` | General system presentation types |
| `sys.sct/sys2/character-style-presentations.lisp.~64~` | 45,871 | `0649ab332ccd23954b660d31f21766c5cc18e388372f799c4152ea0113630aed` | Character-style presentation types |
| `sys.sct/dynamic-windows/completion.lisp.~206~` | 103,114 | `1af865c9149920a4a47090e2aea50d2db70ebf05550e2ed9a1c1e7fe6c62b07f` | Completion state machine |
| `sys.sct/io/input-editor.lisp.~332~` | 110,515 | `856548d945403aa4f5fa3036bd2e8b936890b07b231673c9e2cab5f9e42707b3` | Input editing, blips, rescan, commands |
| `sys.sct/cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | Command tables/inheritance |
| `sys.sct/cp/command-processor.lisp.~318~` | 131,639 | `248550a755130c40322b3a12c608cfa7a18213b504d18f36d5fcf3399dc4bca6` | Command definitions and typed reader |
| `sys.sct/cp/read-accelerated-command.lisp.~142~` | 37,639 | `8107cf4e993068344e624ec924c8d0cf0327158a927c1962666d22eb81494388` | Accelerator/prefix reader |
| `sys.sct/dynamic-windows/displayed-presentation.lisp.~47~` | 47,909 | `b0d4dc75d13fef088bec77bc228af3b87b51f59ab2d1334e7051f93cc9ebc4c0` | Spatial records and hit testing |
| `sys.sct/dynamic-windows/formatted-output.lisp.~397~` | 108,448 | `7317eee2b94d185f6f3ca51feed57a4adec7594760a81c17f7b55b043bb67de0` | Formatted output |
| `sys.sct/dynamic-windows/redisplay.lisp.~185~` | 113,947 | `61134f02a3491966b3f45199af264e622b2004feccc3c2e3263e9866a99b699e` | Incremental redisplay |
| `sys.sct/dynamic-windows/dynamic-window.lisp.~625~` | 177,680 | `92e9322d4e04020d014055ab452036ff7df2adfe13570eb8c99c02e369de55ca` | Dynamic Window stream/output history |
| `sys.sct/dynamic-windows/graphics-flavors.lisp.~21~` | 6,763 | `afc6cdf307fd60d2df8f66fe498faa876a19720b0afd80a1854350c58a7036ae` | Drawing state |
| `sys.sct/dynamic-windows/graphics-generics.lisp.~246~` | 182,943 | `76d11cb53809b2b96a07ed654fa57a63f52676a789978396e05a2b03d69576cd` | Graphics protocol/transforms/primitives |
| `sys.sct/dynamic-windows/raster-graphics-mixin.lisp.~157~` | 118,783 | `c78ca3292c788f46a0fefdcd5f2f86357498dc48b7b583eef717831728024c09` | Raster execution and clipping |
| `sys.sct/dynamic-windows/define-viewport-graphics-operation.lisp.~62~` | 59,210 | `9b4febea27966248fc8206e47252aa46a1700d0d252ce558ec95b27a6141a7bf` | Recorded graphics presentations |
| `sys.sct/dynamic-windows/binary-graphics.lisp.~43~` | 45,292 | `0d818dc79eef99f04ca709e76ac33c4a6d4220daca5aef2272de4ac751bab65e` | Versioned binary graphics |
| `sys.sct/dynamic-windows/program-framework-panes.lisp.~32~` | 18,999 | `4ebc7fac734b83b7f9c2be4e81fb47b6443157460c0fcdbbb864dd242eeb27ea` | Pane registry/standard panes |
| `sys.sct/dynamic-windows/define-program-framework.lisp.~332~` | 132,692 | `e4fde854b9a36492bf4d23eec0a812bd36c7d42e7d32c649c7aaa5786cd30128` | Framework generator and lifecycle |
| `sys.sct/dynamic-windows/accept-values.lisp.~244~` | 82,063 | `1c430c59e77f488fe3b85475bd89c704e2250e343243f7399ab9c0c5896de0d5` | Standalone/pane typed forms |
| `sys.sct/io1/fquery.lisp.~104~` | 13,320 | `022823ae8dddbf64c598ab59bde00945c9b5e621191617b1374a84f020730e0f` | FQUERY and yes/no queries |
| `sys.sct/window/activities.lisp.~35~` | 22,385 | `8965c6ae99c41efbab9cf10896d0bca253f99dd7a85ad76c30b3e86b7df91089` | Activity registry/reuse |
| `sys.sct/dynamic-windows/reorder-sequence.lisp.~10~` | 31,603 | `d84c935cd8f2b7540e00464ab2a0e58aa98c4975316ea9e375c97665cfaa5a0f` | Reorder/alter client source |
| `sys.sct/graphic-editor/undo.lisp.~16~` | 12,680 | `ce9e4a764cda0615c0771a55b3430e0a2c96d4e74cd8d0d910b50f61efaf7e9f` | Branching reusable undo framework |

The purchased Genera archive, VLOD, extracted source, and runtime session files remain
ignored. The harness and linked dossiers carry portable world and screenshot
provenance without exposing machine-specific paths.

## Sources

- Scott McKay, William York, and Michael McMahon,
  [“A Presentation Manager Based on Application Semantics”](https://doi.org/10.1145/73660.73678),
  *Proceedings of UIST 1989*, for the designers' semantic model, interaction goals,
  chronology, application experience, and then-current limitations.
- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  Genera 8, for presentations, input contexts, handlers, commands, formatted output,
  redisplay, panes, frameworks, and Accepting Values.
- Symbolics, [*User Interface Dictionary*](https://bitsavers.org/pdf/symbolics/software/genera_8/User_Interface_Dictionary.pdf),
  Genera 8, for the public interface reference.
- Licensed local Genera 8.5/System 452.22 source and preserved world, identified above
  and inspected 2026-07-18; only metadata and original analysis are published.
- Repository studies,
  [Dynamic Windows and presentation-based interaction](../dynamic-windows-and-presentation-based-interaction.md),
  [Presentation Inspector](presentation-inspector.md),
  [Screen Editor and Frame-Up](../screen-editor-and-frame-up.md), and
  [Genera computer-use harness](genera-computer-use-harness.md).

Last verified: 2026-07-19.
