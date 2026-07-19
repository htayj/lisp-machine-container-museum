---
type: Historical Article
title: Joshua rule and inference environment
description: A source-, manual-, help-, and runtime-grounded guide to the optional Symbolics Joshua expert-system environment, its rule engine, truth maintenance, object model, tools, and Jericho demonstrations.
tags: [lisp-machine, genera, joshua, jericho, expert-system, rete, truth-maintenance, zmacs]
timestamp: 2026-07-18T10:33:00-04:00
---

# Joshua rule and inference environment

Joshua is an optional Symbolics development environment for building rule-based and
expert-system applications inside Genera. It is not merely a Prolog-like reader, a
standalone rule interpreter, or one graphical application. The inspected release is a
layered product whose predicates are Flavors objects, whose approximately thirty
generic *Protocol of Inference* operations can be specialized, and whose default
implementation combines a discrimination-net database, unification, forward RETE
networks, backward rules, questions, truth-maintenance models, an object facility,
Dynamic Windows presentations, tracing, Zmacs support, and optional metering.

Four names belong together but should not be collapsed:

- **Joshua** (`JS`) is the implementation and ordinary user/developer interface.
- **Joshua Documentation** (`JD`) is the installed Document Examiner corpus.
- **Joshua Metering** (`JM` in the local system directory) adds three Joshua-specific
  collectors and views to Genera's separate Metering Interface.
- **Jericho** (`JE`) is the separately loadable test and demonstration suite. It is
  evidence about applications of Joshua, not the inference engine itself.

The licensed media contains source, binaries, system declarations, and documentation
for all four. A fresh Genera 8.5 world did **not** have the Joshua, internal, user, or
LTMS packages resident, and its system lookup did not know `Joshua` without trying a
site file host. The implementation and intended workflow are therefore established by
licensed source and manuals; the runtime result establishes nonresidency in this exact
base world, not that the optional product cannot run on Open Genera.

There is no exact Joshua counterpart in the bounded MIT CADR System 46 or maintained
LM-3 System 303 trees. A narrower historical connection is established below: the
Joshua database source explicitly names AMORD as one influence, and the public MIT
and LM-3 records preserve AMORD/TMS evidence. That does not justify calling Joshua a
wholesale continuation of AMORD.

## Scope and meaning of “complete”

This dossier inventories the product at the same release-bounded grain used for the
[editor studies](lisp-machine-text-editors.md). “Complete” here means:

1. every active Joshua Command Processor command in the inspected core and object
   source, including its command-table reach and arguments;
2. every active Joshua Trace prompt command and dedicated accelerator;
3. every Joshua-specific Zmacs command and explicit binding found in the loaded
   product definition;
4. every core presentation-to-command translator;
5. all active tracing-event and tracer registrations;
6. all three Joshua Metering run types and the source-visible data they collect;
7. the product/package graph, default inference path, predicate and object models,
   RETE, unification, database, TMS/LTMS, formats, and persistence boundary; and
8. enough of Jericho to explain how a user enters the test, benchmark, and demo
   workflows.

It does not enumerate the implementation's hundreds of exported functions one by one,
site extensions, or every example-specific command. The separate D60 examples study
is the proper boundary for exhaustive walkthroughs of Cryptarithmetic, the hardware
troubleshooter, N-Queens, modelling tutor, widget factory, and blocks-world planner.

The evidence classes remain separate:

| Evidence | What it establishes here |
| --- | --- |
| Public vendor manuals | Intended concepts, supported programming model, introductory and reference workflows. |
| Licensed 8.5 source and system records | Exact implementation, defaults, commands, editor integration, unfinished paths, release aliases, and serialization behavior in the inspected media. |
| Locally decoded licensed Help | Installed Document Examiner coverage and a cross-check on command and dictionary topics; no recovered prose is reproduced. |
| Fresh isolated runtime | Only the base world's package and system-registration state. No optional system was loaded and no Joshua application behavior is claimed. |
| Public System 46 and LM-3 source records | A bounded comparison with AMORD and historical TMS/Joshua names, not a runnable equivalent. |

## Product layers, releases, and aliases

The media's four system-directory records do not describe one monolithic load. They
record independently versioned products:

| Product | Long and short names | Inspected release record | Role |
| --- | --- | --- | --- |
| Core | `Joshua`, `JS` | released 237; the inspected system directory records Joshua 237.3 with System 452.20 | reader, predicates, protocol, database, rules, RETE, matcher, TMS/LTMS, object model, tracing, commands, and editor support |
| Documentation | `Joshua Documentation`, `JD` | released 216.0; inspected with Experimental Joshua 237.3 | Sage/Document Examiner manuals and dictionaries |
| Metering | `Joshua Metering`, local short name `JM` | released 206.0; inspected with Open Genera 2.0, Genera 8.5, Joshua 237.3, and Metering 444.0 | Joshua Tell, Ask, and Merge run types for the Metering Interface |
| Examples | `Jericho`, `JE` | released 237.0; inspected with Joshua 237.0 | tests, benchmarks, common demo frame, and example applications |

The core and Jericho system definitions use the long names `Joshua` and `Jericho` and
the short names `JS` and `JE`. Site records direct `Joshua` to the core system
definition and `Jericho` to the example system definition. A translation file maps
the `JOSHUA:**` logical host subtree into `SYS:JOSHUA`. The source declaration for
Joshua says to distribute sources and binaries through its product mechanism; that
historical build setting is **not** treated as permission to republish the licensed
media today.

The product source was accumulated over time. Creation comments date the core system
definition to 1985 and Jericho's definition to 1987, while the inspected system
directories were written in the later Genera/Open Genera era. The page therefore uses
the exact evacuated versions and checksums rather than pretending every file is from
one original release date.

### Packages and intended audiences

| Package | Nickname | Intended use established by source |
| --- | --- | --- |
| `JOSHUA` | none | Public protocol and language surface. It exports predicates, rules, questions, TMS operations, unification, explanation/graphing, and object facilities, but does not itself use the Lisp application packages. |
| `JOSHUA-INTERNALS` | `JI` | Implementation and low-level extension package; it uses `JOSHUA` and `SCL` and exports internal models, database nets, debugger state, bits, and compilation machinery. |
| `JOSHUA-USER` | `JU` | Template application package; it uses `JOSHUA` and `SCL`. Joshua mode's initial file attributes default here. |
| `LTMS` | none | Package for the supplied logic-based TMS and its object predicates; it uses `JOSHUA`, `JI`, and `SCL` and exports the LTMS mixin/model, `one-of`, contradiction and nogood operations, backtracking, and object relationships. |

The manual's “Joshua context” and the source's `JU` default are related but not
identical statements. The former describes a configured Listener context; the latter
is the package written into a new Joshua source buffer by the editor command.

## A working model of Joshua

The shortest accurate workflow is:

1. enter a Joshua-aware Lisp context or put a Zmacs buffer in Joshua mode;
2. define predicate types and choose the database, rule, and truth-maintenance models
   mixed into each predicate;
3. write facts as bracketed predications and rules with forward or backward control;
4. `tell` facts or justifications into the virtual database;
5. `ask` a predication, receiving answers through a continuation while unification
   binds logic variables;
6. inspect, explain, graph, trace, or meter the resulting inference; and
7. keep durable definitions in source/compiled systems, rather than assuming the
   mutable database is a portable saved knowledge base.

The characteristic syntax is a bracketed statement such as
`[relationship ?subject ?object]`. The reader turns it into a predication maker or
predication in context; the predicate name denotes a type, not just the first element
of an untyped list. Ordinary Lisp forms remain available in rule actions and control
procedures. This is why the product is tightly integrated into Lisp and Genera rather
than being a foreign-language process.

The public manual describes five conceptual components—predications, database access,
rules/inference, unification, and truth maintenance—while the implementation makes the
extension boundary more explicit through the Protocol of Inference and predicate
models.

## Predications, truth values, and the Protocol of Inference

A predication is a Flavor instance whose `statement` contains the predicate and its
arguments. The inspected representation also packs state into a fixnum. The defined
fields include a two-bit truth value, whether the object has been in the database,
whether it contains logic variables, whether it was previously “in,” six bits donated
to a TMS implementation, and an “untold” flag. The four truth values are unknown,
true, false, and contradictory.

This design has two important consequences:

- a predicate can specialize operations through ordinary Flavor method composition;
  and
- two predications that print similarly can differ in canonical database identity,
  truth, support, and TMS state.

`define-predicate` composes a concrete predicate from models. The public package
exposes default ask, tell, rule-compilation, storage, error, and TMS models; the
implementation can substitute application-specific storage or inference behavior.
The manuals describe roughly thirty Protocol of Inference functions. The source groups
the user-visible and extension operations into these families:

| Protocol area | Representative operations | Responsibility |
| --- | --- | --- |
| Database and belief | `tell`, `untell`, `ask`, `ask-data`, `insert`, `fetch`, `uninsert`, `clear` | enter, remove, retrieve, and query beliefs through a virtual database |
| Truth maintenance | `justify`, `unjustify`, `support`, `current-justification`, `all-justifications`, notice/action on truth changes | attach support and propagate changes according to the selected TMS model |
| Rule indexing | add/delete/locate/map forward, backward, and question triggers | connect predicate patterns to the appropriate rule or question mechanisms |
| Rule compilation | expand triggers/actions, write matchers, compile actions, select skippable positions | customize how rule source becomes executable matching machinery |
| Questions and presentation | `ask-questions`, `say`, query printers and graphers | ask a user when enabled and render beliefs, queries, and support |

The protocol is not merely an API façade. `Show Joshua Protocol` asks the Flavor
system to compose the implementation for a selected predicate or model and displays
the implementing methods and lambda list for selected protocol functions.

### The default `ask` path

The high-level `ask` macro defaults `do-backward-rules` to true and `do-questions` to
false. The default ask method proceeds in a fixed order:

1. consult data;
2. if enabled, try backward rules; and
3. if enabled, ask questions.

Thus an ordinary query may backward-chain but will not unexpectedly interrogate the
user. Questions are an explicit opt-in. This default is easy to miss when reading only
feature descriptions, and is established by the inspected implementation.

Answers are delivered to a continuation rather than accumulated automatically into a
single list. That supports streaming alternatives and backtracking. Helper macros and
query-display functions provide higher-level collection or presentation when desired.

## Database discrimination and unification

Joshua's default fact store uses an interpreted discrimination graph. The source
contrasts it with the compiled matcher used for forward-rule triggers: facts can be
updated nearly as often as they are accessed, so a simple interpreted net avoids
recompiling on each database change.

The source states the following design choices:

- variables are allowed in both stored data and queries;
- fetching does not itself maintain a variable-binding environment;
- answers are passed down through a continuation;
- indexing is principally by `CAR`, with special treatment for tail variables;
- the net aims at complete discrimination rather than multiple alternative indexes;
  and
- segment variables are supported only in the tail position.

Nodes use an adaptive table. Up to 18 entries it is an `EQUAL` association list; on
the nineteenth entry it converts to an `EQUAL` hash table. The comment says this
threshold was measured with a Joshua timing tool. It also says the design was derived
in part from AMORD and from the discrimination-net treatment in Charniak, Riesbeck,
and McDermott. This is a specific source attribution, not evidence that the entire
Joshua architecture came from AMORD.

Unification is a separate dynamic mechanism. A binding trail records assignments to
logic variables, and `with-unification` unwinds them when a match fails or a search
backtracks. The implementation handles variables, constants, strings, lists, and
predications, and supplies `variant` for equality up to consistent variable renaming.
An occurs-check helper exists, but the audit did not establish that every ordinary
unification path invokes it. This page therefore does not claim that Joshua's default
unifier universally rejects every cyclic binding.

## Rules, RETE, and scheduling

Joshua supports both forward and backward rules in one language.

### Forward rules

Forward-rule trigger conditions compile into a left-linear RETE structure. Leaf match
nodes test a database predication against one trigger; merge nodes combine compatible
environments from earlier conditions; procedure nodes execute Lisp/control tests; OR
nodes join alternatives; and terminal nodes queue rule bodies. Equivalent nodes can
be shared between rules through variant recognition.

The compiler is organized in three broad passes:

1. analyze source, syntax, and network topology;
2. compile match, merge, and Lisp procedure code; and
3. walk and trim the runtime structures after construction.

The matcher can compile both a full unifier and a faster semi-unifier. At runtime it
selects between them according to whether the database predication contains logic
variables. Compiled matchers and mergers are cached. The optimization assumes that
variables in asserted data are relatively uncommon; it does not ban them.

Successful terminal matches do not necessarily execute immediately. Firings enter a
global importance queue implemented as a maximum heap, so rule importance participates
in scheduling. `Graph Forward Rule Triggers` exposes the topology for selected rules
and can optionally include related branches that do not lead only to the requested
terminals.

### Backward rules and questions

Backward rules compile goal-triggered functions. When an `ask` permits backward
rules, Joshua locates trigger patterns that apply to the query, invokes their rule
bodies, and calls the original continuation for successful derivations. The tracing
surface distinguishes trying, succeeding, failing, retrying, queueing, and dequeuing
backward rules.

Questions occupy their own trigger index. A predicate model can customize question
behavior, and the default query path invokes it only when `do-questions` is true.
`undefrule` removes rule registry, trigger, and debugger information; `clear` can
optionally undefine rules as well as remove facts.

## Truth-maintenance choices

Joshua separates belief operations from any one truth-maintenance implementation.
The inspected core supplies at least two materially different choices.

### Trivial TMS

The trivial model directly records truth and uses the predication itself as simple
support. It does not build a dependency graph. It is appropriate when an application
needs the uniform protocol but not automatic dependency-directed retraction.

### LTMS

The supplied logic-based TMS follows a clause-oriented design attributed in the
manual/source to McAllester-style LTMS work. A predicate mixes `ltms-mixin` with the
default protocol and discrimination-net storage. Internal clause objects track
positive and negative literal incidence, satisfiable-literal counts, a consequent,
and the supporting clause. The public surface adds ordinary clauses, `one-of` choice
clauses, assumptions, contradictions, nogoods, and backtracking.

When support changes, the LTMS propagates truth, retracts unsupported consequences,
tries to re-establish alternative well-founded support, detects clauses with no
satisfiable literal, and invokes contradiction/backtracking handling. A predication
records the clauses in which it occurs positively and negatively and the clause that
currently supports it.

One source-only detail explains a subtle behavioral guarantee. During retraction the
LTMS queues noticers, actions, contradictions, and re-establishment work. Without
that delay, an object with two support paths could visibly transition true → unknown
→ true while one path is being dismantled. The queues let the network settle before
noticers and attached actions observe the final change. The source calls the unwanted
transient behavior “blinking”; this is about notification semantics, not screen
redisplay.

## Object facility

Joshua's object facility maps logical relations onto Flavor-based application
objects. It is not a separate persistent object database. Object types form a
hierarchy, objects can have part/whole paths, and slots are presented as logical
`value-of` relationships that can participate in rules, queries, support, and
tracing.

The four central predicates are `value-of`, `object-type-of`, `part-of`, and
`equated`; the `LTMS` package supplies corresponding TMS-aware variants. Object types
can define prototypes or typical instances and rebuild dependent definitions when a
type changes.

The inspected source exposes these exact slot-model choices:

| Slot option | Meaning at the established source boundary |
| --- | --- |
| `:set-valued` | allow a slot relationship to hold a set rather than one scalar current value |
| `:truth-maintenance` | choose whether slot beliefs use truth-maintenance behavior |
| `:equalities` | control equality relationships involving slot values |
| `:attached-actions` | associate behavior with logical slot transitions |
| `:object-notifying` | notify the owning object about changes |

Path resolution is integrated into `ask`. The slot-value method resolves object paths,
avoids repeating rule/question work when a value has already been obtained, and wraps
the continuation so a successful derived or user-supplied value can be cached by
telling it. This source-visible caching behavior is more specific than the manuals'
general statement that object values are queryable.

The visible object commands are deliberately small: describe an object as a slot
table, or tell a new `value-of` predication for a selected slot. The object itself
remains a Flavor instance; the logical view supplements rather than replaces the
ordinary Lisp object system. For Genera's underlying object systems, see
[Flavors, classes, CLOS, and the Flavor Examiner](flavors-clos-and-flavor-examiner.md).

## Tracing and metering

### Active tracing events and tracer groups

The source defines 26 active events:

| Event family | Active events | Default traced events in the corresponding active tracer |
| --- | --- | --- |
| Forward rules (4) | Fire, Exit, Queue, Dequeue | Fire and Queue |
| Backward rules (6) | Try, Fail/Exit, Succeed, Retry, Queue, Dequeue | Try, Fail/Exit, Retry, and Succeed |
| Predications (5) | Ask, Tell, Untell, Notice Truth Value Change, Act on Truth Value Change | Ask and Tell |
| RETE matching (6) | Try Merge, Merge, Fail Merge, Try Match, Match, Fail Match | no active tracer group |
| TMS protocol (2) | Justify, Unjustify | grouped with TMS Operations |
| LTMS behavior (3) | Notice Contradiction, Justify/Bring In TMS Predication, Unjustify/Retract TMS Predication | Contradiction, Bring In, and Retract |

Four tracer groups are active: **Forward Rules**, **Backward Rules**,
**Predications**, and **TMS Operations**. A fifth `Matches and Merges` RETE tracer is
present but commented out even though all six match/merge event definitions remain
active. Consequently, event-level tooling can still name those events, but the source
does not establish a normal active RETE tracer group in this release.

Tracing is installed through encapsulation only when needed and has explicit
`with-joshua-tracing` and `without-joshua-tracing` controls. Stepped events enter a
dedicated Command Processor prompt. Tracing, stepping, and metering are separate:
tracing reports selected semantic events, stepping pauses at them, and metering
aggregates counts/times.

### Joshua Metering

Joshua Metering depends on both core Joshua and the separate Genera Metering system.
It adds three run types to the [Metering Interface](metering-and-performance-analysis.md):

| Run type | Primary grouping and measures |
| --- | --- |
| Joshua Tell | by predicate: tell count, matching and merging work, fired-rule count, and time in protocol stages |
| Joshua Ask | by predicate: ask count, backward-rule activity, and time in ask, data/fetch, rules/map, and question paths |
| Joshua Merge | by rule/RETE-node graph: inclusive and exclusive match, merge, procedure, success, count, and timing fields |

The Merge view reconstructs the RETE network as an expandable tree. Shared nodes can
appear in more than one visual path and are marked as shared rather than pretending
the underlying graph is a tree. Its presentation handlers open, close, hide, or show
node descendants.

Two caveats come directly from source. First, the Ask collector records an
`ask-questions` time even though the recovered user-facing reporting discussion does
not clearly expose it as a distinct field. Second, comments mark continuation/excluded
time accounting and parts of Merge filtering, shared-parent handling, descriptions,
and sorting as unfinished or needing checking. Counts are therefore more firmly
established than a claim that every timing field perfectly partitions total runtime.

## Complete Command Processor command inventory

The implementation maintains three relevant tables:

- **Global**, the ordinary Listener/Command Processor table used for Joshua commands;
- **Joshua only**, a product-specific table; and
- **Joshua Trace**, the restricted step-prompt table, which deliberately does not
  inherit every Global command.

Twelve commands are explicitly installed in all three tables. `Explain Predication`
is Global-only. Three object commands are in Global and Joshua only. The three prompt
commands are Joshua Trace-only. This yields 19 active inference/object/trace commands
at the audited boundary.

| Command | Tables | Complete argument and behavior summary |
| --- | --- | --- |
| Show Joshua Rules | all three | type Forward/Backward/All; name substrings; trigger patterns that unify; packages or All; inherited-symbol search; optional system filter |
| Graph Forward Rule Triggers | all three | selected forward rules or All; include related branches; horizontal or vertical orientation; draws the selected RETE paths |
| Clear Joshua Database | all three | predications, All, or None; include opposite truth values; optionally undefine rules; verbose; query before changes; destructive and querying by default |
| Show Joshua Predicates | all three | name substrings; optionally include abstract models; package/All and inherited-symbol choices; optional system filter |
| Show Joshua Protocol | all three | predicate or model; selected protocol functions or All; displays composed implementing methods and argument lists |
| Show Joshua Database | all three | pattern or All; include opposite truth value; optionally report models that partially fail or signal errors; internal display queries suppress Joshua tracing |
| Enable Joshua Tracing | all three | tracer group or All; optional detail menu; per-group trace-event and step-event subsets |
| Disable Joshua Tracing | all three | tracer group or All; disables then reports state |
| Joshua Trace | all three | object type Rule, Predication, Predicate, or Event; selected object; applicable action or menu |
| Show Joshua Tracing | all three | tracer group or All; reports current trace and step configuration |
| Show Rule Definition | all three | one or more rules; load source into Zmacs Yes/No/Query; prints the editor interval when available |
| Reset Joshua Tracing | all three | tracer group or All; optionally reset trace/step event selections as well as object filters |
| Explain Predication | Global | selected database predication; depth, default 1; textual support explanation |
| Change Slot Value | Global, Joshua only | slot and new Lisp expression; tells a `value-of` belief |
| Set Slot Value | Global, Joshua only | slot, then a separate prompt for a new expression; tells a `value-of` belief |
| Describe Object | Global, Joshua only | object; displays slot names and current values in a Dynamic Windows table |
| Step | Joshua Trace | continue to the next selected trace event |
| Leap | Joshua Trace | relative depth, default 0; suppress events until the target depth condition is reached |
| Help | Joshua Trace | Brief or Detailed command-name help |

The commented `Joshua Help` definition is not counted. The active prompt already has
the ordinary `Help` command. Source also qualifies two commands:

- `Explain Predication` contains a note proposing a graphical incremental replacement;
  the shipped implementation is the textual depth-limited call.
- `Show Rule Definition` warns that the system cannot know with certainty whether the
  file/editor interval it finds is the definition currently loaded into the world.

### Trace-prompt accelerators

| Key or gesture in the Joshua Trace table | Command | Effect |
| --- | --- | --- |
| Abort | accelerator only | abort the traced execution from the prompt; Abort during command entry returns to the prompt instead |
| Return or `Control-S` | Step | continue one selected event |
| Line or `Control-L` | Leap | leap with numeric argument when supplied, otherwise depth offset 0 |
| Up-arrow character | Leap | depth offset +1 |
| Down-arrow character | Leap | depth offset -1 |
| Help | Help | show brief command help |

The named Lisp-machine `Line`, arrow, and Help characters are the source-level key
identities. This audit does not guess their host-PC key mapping without a loaded
Joshua prompt in the harness.

## Presentations and pointer operations

Joshua's textual output is semantic Dynamic Windows output. Rules, predicates,
predications, truth values, tracing events, trigger lists, object slots, and objects
are presentation types. A database predication's parser explicitly tells a keyboard
user to select one with the mouse, which is a concrete example of the product's
presentation-oriented design.

There are 23 active action translators at this boundary:

| Presented object | Actions | Gesture status |
| --- | --- | --- |
| Forward rule | trace; untrace | context-sensitive translator choices |
| Backward rule | trace; untrace | context-sensitive translator choices |
| Any Joshua rule | show source/definition | middle gesture |
| Joshua predicate | trace; untrace | context-sensitive translator choices |
| TMS predicate | trace; untrace | context-sensitive translator choices |
| Forward-trigger predication pattern | trace; untrace matching forward triggers | context-sensitive translator choices |
| Backward-trigger predication pattern | trace; untrace matching backward triggers | context-sensitive translator choices |
| Ordinary predication pattern | trace; untrace matching predications | context-sensitive translator choices |
| TMS predication | trace; untrace TMS operations | context-sensitive translator choices |
| Tracing event | trace; untrace; step; unstep | context-sensitive translator choices |
| Object slot | modify, invoking Set Slot Value | Modify gesture |
| Joshua object | Describe Object | `Control-Meta-Left` |

The first 21 are core tracing/source translators; the last two come from the object
facility. Two identity translators used to coerce compatible presentation types are
not user actions and are not counted. The availability of trace/untrace or step/unstep
is guarded by the current debugger state, so a menu should not offer both sides of an
inapplicable transition simultaneously.

For the underlying interaction model, see
[Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md).

## Joshua mode in Zmacs

Joshua mode inherits Lisp mode rather than replacing the editor. It changes reader
syntax, word/list parsing, matching, and blinking so bracketed predications and logic
variables behave as structured source. Lisp movement, indentation, evaluation, and
compilation commands remain inherited; they are not rebranded here as Joshua-specific
bindings.

The mode recognizes bracket pairs, ordinary parentheses and reader prefixes, the
logic-variable prefix, vertical-bar symbols, strings, and comments. Predication
brackets blink by default. Variable, vertical-bar, string, and comment blinking are
off by default in the inspected source. The mode also suppresses automatic uppercase
case conversion.

The complete product-specific editor surface is:

| Zmacs command | Explicit binding | Behavior |
| --- | --- | --- |
| Joshua Mode | none in the product source | enter the Joshua major mode; installed in the standard Zmacs command table for named-command access |
| Create Initial Joshua Attribute List | none in the product source | insert a Mode Joshua, Package `JU`, Syntax Joshua line, optional VSP, and creation record; reparse it and normalize the inserted comment style |
| Show Rule Documentation | `Super-Meta-D` | infer a rule topic at point, ask when necessary, and display the installed Sage record group |

The source no longer applies automatic package/style “magic” merely on entering the
mode; the explicit attribute-list command performs that setup. Its default package is
`JU`, base 10 is defined, and vertical spacing defaults off unless configured.

`Show Rule Documentation` has a source/docstring mismatch. Its documentation says a
numeric argument prompts for an output device, but the implementation has no numeric
argument branch and always calls the Sage display interface. That discrepancy is
preserved rather than silently promising printer selection.

## Jericho tests, benchmarks, and demonstrations

Jericho depends on Joshua, then loads package definitions, the Demosthenes demo
substrate, a chess font, example modules, the Samaritan test/benchmark layer, and
object-model tests. Its system definition says the individual demos should not depend
on one another after the shared substrate.

Three Global commands are the principal entry points:

| Command | Arguments | Result |
| --- | --- | --- |
| Test Joshua | selected registered tests or All | clears between tests, runs each, and reports pass/fail totals |
| Benchmark Joshua | selected benchmarks or All; iterations default 3 | runs initializers and bodies, compensates for clock-read overhead, and reports time plus forward/backward rule, merge, semi-merge, match, and semi-match activity |
| Demonstrate Joshua | none | finds or creates the `Jericho` program frame |

The Jericho frame has a title, display area, interaction history, and configurations
for **Introduction**, **Factory Simulation**, **Modelling Tutor**, **N Queens Solver**,
**Hardware Trouble Shooter**, **Blocks World Planner**, and **Cryptarithmetic Solver**.
Its user-facing selection command is **Choose Demo**. The source also defines
developer/maintenance commands **Eval Form**, **Refresh Screen**, and **Clear
History**; these are usually secret rather than ordinary demo controls.

Other modules include “I'm My Own Grandpa” and TMS examples, and the media contains
expository example files. Presence in Jericho does not make each one a separately
licensed commercial product. D60 will inventory each example's own controls and
runtime behavior when the optional system can be safely loaded.

## Files, compiled forms, and persistence

Joshua source normally uses `.lisp` with `Mode: Joshua`/`Syntax: Joshua` attributes;
Jericho also declares `.lisp-example` expository modules. The media contains compiled
`.vbin` files, Sage `.sab` documentation and restricted `.pic` material, system and
component directories, a demo font, and ordinary example source.

These are not interchangeable persistence layers:

| Artifact | What it preserves | What it does not establish |
| --- | --- | --- |
| Joshua source | predicate, rule, question, object, and application definitions in readable form | current mutable database contents or inference history |
| `.vbin` compiled modules | executable definitions that rebuild registries, methods, matcher code, and networks when loaded | original source layout/comments, or a portable snapshot of every live belief |
| Sage `.sab` | installed documentation records and embedded display data | application knowledge bases |
| Genera world/VLOD | a whole tagged-memory world that may contain loaded code and live objects | a Joshua-specific archive format or clean replayable transaction log |

The default discrimination-net database is world-resident. The protocol allows an
application to provide another storage model, including an external database, but no
general Joshua database-file format was found in the inspected core.

Predications do define a generic FASD reconstruction method. It emits enough to make a
predication with a copied statement in the selected area, but the source labels a bug:
the complete packed bits field is not recorded, and indexing is left to another
component. Truth/TMS/database flags therefore are not faithfully preserved by that
method alone. It must not be described as complete inference-session serialization.

A saved Genera world can preserve resident Joshua state as part of the whole machine
image, but that is the VM-snapshot-like boundary described in
[world loads and VLOD](genera/world-loads-and-vlod.md), not an application-level
knowledge-base export.

## Installed Help and public manuals

The inert local extractor found 18 Joshua Sage Binary files totaling 2,497,352 source
bytes, with 352 top-level records and 1,397,976 embedded byte-array bytes. Topics span
the compiler, seven dictionary partitions, installation, metering, modelling,
predications, rules, scripts, TMS, and the object facility. The decoded output remains
ignored under `build/help/genera/`; only counts and checksums are published.

The separate static source-help scan found 309 candidate entries across 25 Joshua
source files. Because categories overlap, those entries include 110 literal API
docstring candidates, 57 command/option definitions, 169 explicit Help/documentation
forms, and two Zmacs command-documentation forms. This is a lexical inventory, not
proof that every reader-conditional form was loaded.

The two public manuals cross-checked were the 177-page *User's Guide to Basic Joshua*
and the 274-page *Joshua Reference Manual*. The surviving PDFs display February 2018
in their rendered headers; that is an archival/render date, not evidence that Joshua
originated in 2018. The source and system records establish the much earlier product
lineage.

The manuals are essential but not complete behavioral specifications. They establish
the intended expert-system workflow and public protocol, while the source establishes
the exact defaults, caches, thresholds, incomplete features, and command-table
composition summarized here.

## Source/manual/runtime findings that must not be flattened

| Finding | Evidence and confidence |
| --- | --- |
| Ordinary `ask` backward-chains but does not ask a person by default. | High-confidence source default: backward rules true, questions false. |
| Database lookup uses an interpreted net and changes from alist to hash table after 18 entries. | High-confidence implementation detail; not a universal property of custom predicate models. |
| Forward matching chooses cached full or semi matchers based on variables in data. | High-confidence source behavior of the inspected default compiler/matcher. |
| LTMS queues changes during retraction to suppress transient noticer “blinking.” | High-confidence source-only behavior. |
| Six RETE events exist but their `Matches and Merges` tracer registration is commented out. | High-confidence source mismatch; do not advertise a normal fifth tracer group. |
| Show Rule Documentation advertises numeric-argument output selection but ignores the argument. | High-confidence source/docstring discrepancy. |
| Explain Predication is textual and carries a note for a future graphical implementation. | High-confidence source limitation. |
| Show Rule Definition can find source but cannot prove it is the currently loaded definition. | Explicit source warning. |
| Joshua Ask metering internally contains question time not clearly separated in the recovered user report, and several timing comments request validation. | Source/manual gap; counts are safer than perfect-partition claims. |
| Generic FASD predication output omits packed state. | Explicit source bug; it is not complete TMS/database persistence. |
| The preserved base world did not contain Joshua packages and could not resolve the system without a site host. | Fresh runtime observation, limited to the exact world and isolated configuration. |

## Fresh Genera 8.5 runtime observation

The museum ran one registration-only session through the
[Genera Xvfb computer-use harness](genera/genera-computer-use-harness.md):
`d40-joshua-registration-20260718`, generation 1, from 10:18:13 through 10:20:43 EDT
on 2026-07-18. The selected main window was `Genera on DIS-LOCAL-HOST`, 1200 by 900.

Two read-only probes were attempted:

1. package lookup for `JOSHUA`, `JOSHUA-INTERNALS`, `JI`, `JOSHUA-USER`, `JU`, and
   `LTMS` returned no packages; and
2. `sct:find-system-named` for `Joshua` reported it unknown and attempted to look for
   `DIS-SYS-HOST:>sys>site>joshua.system.newest`, reaching a login prompt.

The login was aborted. No optional product was loaded, no licensed source was copied
into the guest, and no Joshua database was changed. The second result means “not
registered in this base world and disconnected site configuration,” not “missing from
the purchased host media.”

The action log contains six intent/outcome records and has SHA-256
`c8953a1e0a4fb9d04d321f3951893f3c984cf64164ea5759da6dea0ac0114951`.
The runtime used the 54,804,480-byte world
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`,
346,880-byte debugger
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`,
and 1,533,760-byte VLM
`9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`.
The world hash was unchanged at stop.

The executable config, legacy-ifconfig interposer, X compatibility preload, and RFC
868 responder hashes at execution were respectively
`5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`,
`f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`,
`acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`,
and `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`.
The responder emitted one validated local reply and exited zero; its evidence hash was
`c36e93181e493040c85b6628a4097648e050d4d38e428a688531398f99eb5f02`.
The tracked Python harness was 132,919 bytes with SHA-256
`bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`.

Bubblewrap isolated user, mount, network, PID, IPC, and hostname namespaces. The VLM
had no default/external route or host file service; Xvfb live-verified MIT-SHM absent;
and both exact X-protocol compatibility substitutions were observed before the session
was considered running. These are harness properties, not a configured Symbolics site.

Shutdown reached the prompt, sent and accepted confirmation, and observed cleanup
progress, then reproduced the known VLM cleanup stall and required bounded force-stop.
`orderly_vlm_host_shutdown` is false, `forced_after_confirmed_shutdown_stall` and
`state_may_be_incomplete` are true. The harness did not invoke Save World or create a
host process checkpoint. `save_world_performed` and `guest_checkpoint_created` remain
unknown; the private world was unchanged.

### Why there is no published screenshot yet

The session retained raw listener captures, including the NIL package result and the
site login prompt, in the ignored session tree. Neither image shows the Joshua
application, its rule displays, tracing prompt, or Jericho frame. Publishing one would
be decorative evidence of an absence rather than a representative application state.

**TODO:** safely provide the isolated guest with the licensed optional system, load it
without configuring a historical site, exercise the command tables and one minimal
rule/TMS workflow, and capture a representative frame. Any selected image must receive
the image-specific review required by
[the screenshot publication policy](screenshot-publication-rights-review.md). Raw
licensed Help pages, example artwork, and bulk interaction sequences remain excluded.

## CADR and LM-3 boundary

The public System 46 source snapshot at Git revision
`8e978d7d1704096a63edd4386a3b8326a2e584af` contains no exact Joshua, Jericho, or LTMS
implementation found by this audit. A historical bug/document file does record an
AMORD package and a 1979 `AMORD;LMTMS` compiled-file issue. This establishes that
AMORD/TMS work was part of the broader MIT Lisp-machine environment represented by
the archive, not that System 46 shipped Joshua.

The maintained LM-3 System repository at Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, tag
`system-303`, has a current `site/amord.system` declaration. It locates AMORD modules
such as TMS, functions, and rules on an external `OZ` source path; their implementation
is not in the current public tree. Historical bug records in the repository also
preserve banners naming Joshua Distribution 1.0, Jericho Distribution 1.0, and an
experimental justification-based control/truth-maintenance system. Those are valuable
presence/lineage clues, not source for the inspected Joshua 237 product.

The only direct implementation link established here is Joshua's own discrimination
network comment that it was “cribbed” in part from AMORD. The rest of Joshua—its Flavor
protocol, RETE compiler, Dynamic Windows command/presentation integration, object
facility, and Metering Interface layer—must be assessed on its own evidence.

The System 46 Git tree is a historical public snapshot. The LM-3 Fossil tree is a
maintained restoration repository that also carries historical records. Their claims
are kept separate rather than silently merging files across eras.

## Licensed-source provenance and rights boundary

The following principal files were inspected locally. Paths are logical release paths,
not host locations. Sizes and hashes allow another lawful holder of the same media to
repeat the audit without redistributing the files.

| Logical release path | Evacuated version | Bytes | SHA-256 | Evidence |
| --- | ---: | ---: | --- | --- |
| `joshua/code/joshua-defsystem.lisp` | 206 | 4,061 | `0ce15bd66adb97dca77fd3c68bfaf233a754973106b888000e17c04d4c6d1cbc` | core module order and aliases |
| `joshua/code/package-definitions.lisp` | 221 | 13,514 | `01fc6ee7c91b3a15419ee4c0718160788b306561098a1947923abf547ea1cfad` | public/internal/user/LTMS packages |
| `joshua/code/predication-defs.lisp` | 201 | 16,395 | `2ffc8c2e3abc16cc82f053e4fab677a3e013f60cdad2d728d3e7fd2a034b0c24` | predicate and bit definitions |
| `joshua/code/predications.lisp` | 211 | 79,688 | `d41880670c99bfc5caba93f48444ed0d98e5a03dc684d2802ab03cc915a321b5` | reader-facing objects, `ask` defaults, FASD boundary |
| `joshua/code/unification.lisp` | 203 | 16,686 | `e4a265d9b872ce40f0850c82116ae0c376dfada5d1d6ad7727d4276c78acda99` | binding trail, unification, variants |
| `joshua/code/matcher.lisp` | 220 | 46,589 | `445c2112f733693bc4d94e6343b0e9114f18e7bcf8c5b34070e76027aa10e44e` | full/semi compiled matchers and caches |
| `joshua/code/rete.lisp` | 245 | 76,445 | `d374a5b7241c485a1da539959a6cad838474893164650787871e5d49747cb728` | RETE nodes and compilation passes |
| `joshua/code/discrimination-network.lisp` | 203 | 27,013 | `810bc180f5eb66e2f6f7c9719b852cd063eb9bde9051783e2bbe467ba0f55efa` | database net, threshold, AMORD attribution |
| `joshua/code/predication-protocol.lisp` | 216 | 24,816 | `b5153bd1353b5eaa746b833277ae844d1bfe0754b7da9839d7f02825c76d8cd2` | generic Protocol of Inference |
| `joshua/code/predication-implementation.lisp` | 222 | 32,460 | `be934d668be24c56d7aacd9a1a874e775987bc018494f08b199278d4b75c7839` | default database/ask/TMS behavior |
| `joshua/code/rules.lisp` | 224 | 46,684 | `09c136ca4a921eb45af6cf8427c6d1d86091bffeca68a62ed026b1bb0479b750` | forward/backward/question machinery |
| `joshua/code/ltms.lisp` | 207 | 32,717 | `9e80da7eb550b6d2f5ed528e4a8069564cba5f2c6d435f6856101e7023d9c913` | clauses, propagation, queues, contradiction |
| `joshua/code/tracing.lisp` | 209 | 103,643 | `10b7c6b82384a207608dc4f1a447b3645c8fde40a18e9650b61f12408be202c9` | debugger, 26 events, four active tracers |
| `joshua/code/ptypes-and-commands.lisp` | 210 | 61,055 | `1812ac78cd2ed42f5825e4c3c25b3591deab30443cce5bbab7814a90abb382d4` | presentations, translators, 16 core/trace commands |
| `joshua/code/object-model.lisp` | 95 | 88,768 | `6f575ed24f2c540db95892b2af9a22af5fd4d26668465d6bfa4ff6880e6233a4` | object types, paths, slot models, three commands |
| `joshua/code/editor.lisp` | 8 | 20,514 | `1d3f25d4d19b1a3379b42162454bdb924893fc47c7261f71511c712631933a06` | Joshua mode and attribute-list command |
| `joshua/code/system-patches.lisp` | 223 | 54,196 | `d7ea1891a4a5a9e021b09406e8537be427a7ba0b2899f86961daeff9843b69c5` | Sage rule-document command and binding |
| `joshua/metering/joshua-metering.lisp` | 8 | 76,196 | `2d06ca98ea4371b009e35f2ef8d5adf711fab8e10157966d8e7c40359d80707d` | three collectors and Merge view |
| `joshua/examples/jericho-defsystem.lisp` | 206 | 1,856 | `0d6eb856af6d9d9898c3f256977fed491ed6dcb12c90aa1128b18f947c3b5a66` | Jericho composition |
| `joshua/examples/samaritan.lisp` | 222 | 76,437 | `63954b44d0237b071317e759e106bd5d4805be2d6c34254d56385ed345afe984` | tests, benchmarks, and Jericho frame |

The local Help catalog has SHA-256
`a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed`;
the static source-help JSONL has
`8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190`;
and the tracked inert extractor has
`e59440906a0092afe28ca514be9e7afdf6c21ca1009b765a710f0a4121f13a74`.
The sorted Joshua Sage-file evidence lines hash to
`974b88c87d211a3d54397dacd2e03a0bda8a883371795d55bd49298688f23ac4`.

No licensed source, binaries, Sage prose, diagrams, demo font, or example payloads are
tracked by this article. Names, counts, hashes, brief interface descriptions, and
original analysis are evidence-only. The public manuals are linked rather than copied.

## Open questions and next runtime work

- **TODO:** establish a safe, reproducible optional-system media bridge inside the
  isolated Genera harness and load Joshua/Jericho from a private copy.
- **TODO:** enumerate effective command tables after load and compare them with the
  static 19-command/23-translator inventory, including reader-conditionals and patches.
- **TODO:** run one minimal fact, forward-rule, backward-rule, unification, and LTMS
  retraction workflow; verify visible trace and explanation behavior against source.
- **TODO:** open Joshua Tell, Ask, and Merge metering runs and determine which source
  timing caveats are visible in the released interface.
- **TODO:** exercise Joshua mode, its special characters, `Super-Meta-D`, and the
  trace-prompt host-key mappings.
- **TODO:** capture and review one representative Joshua or Jericho runtime image. A
  listener-only absence result is intentionally not substituted.
- **TODO (D60):** document each example's own commands, panes, inputs, expected
  reasoning result, and example-specific rights/provenance.
- **Open question:** determine the exact historical relationship among the LM-3
  Joshua/Jericho Distribution 1.0 banners and the inspected Joshua 237/Jericho 237
  media without treating a banner as source lineage.

## Sources

- Symbolics, [*User's Guide to Basic Joshua*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Users-Guide-to-Basic-Joshua.pdf),
  archival PDF, 177 pages; verified 2026-07-18.
- Symbolics, [*Joshua Reference Manual*](https://ocw.mit.edu/courses/6-871-knowledge-based-applications-systems-spring-2005/resources/joshua_reference/),
  MIT OpenCourseWare copy, 274 pages; verified 2026-07-18.
- MIT CADR System 46,
  [`src/lmdoc/bug.nlispm`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/bug.nlispm),
  revision `8e978d7d1704096a63edd4386a3b8326a2e584af`; verified 2026-07-18.
- Maintained LM-3 System repository,
  [`site/amord.system`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=site%2Famord.system),
  [`doc/bug.lispm42`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fbug.lispm42),
  and
  [`doc/bug.lispm41`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fbug.lispm41),
  Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
  tag `system-303`; verified 2026-07-18.
- Licensed Open Genera 2.0/Genera 8.5 source, system directories, installed Help, and
  private-world runtime observations identified by hash above; inspected 2026-07-18,
  not redistributed.
