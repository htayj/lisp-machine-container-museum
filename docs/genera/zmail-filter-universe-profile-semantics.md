---
type: Reimplementation Specification
title: Zmail filters, universes, and Profile semantics
description: Release-bounded semantic contract for Genera 8.5 Zmail filter predicates, universe set expressions, named-definition persistence, and all source-visible user-option declarations.
tags: [genera, zmail, filters, universes, profile, reimplementation, source-code]
timestamp: 2026-07-19T18:44:32-04:00
---

# Zmail filters, universes, and Profile semantics

## Reconstruction claim

For the **System 452.1 / Zmail 442.0 readable-source profile**, a clean-room
implementation can reproduce the source-visible semantics of:

- editable and named message filters, including the constructor-generated form
  subset, predicate truth rules, address matching, search-key coercion, and date
  boundaries;
- editable and named universes, including their serialized expression grammar,
  lazy components, set operations, invalidation, ordering, and partial-failure
  behavior;
- the Profile source document, its generated user-option block, named filter and
  universe sections, source/compiled-cache relationship, and Save/Compile/Reset
  ordering; and
- the complete denominator of **81 textual
  `DEFINE-ZMAIL-USER-OPTION` forms** in the five selected files: 80 active forms
  and one form inside a block comment.

This page is a normative semantic companion to the broader
[ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md).
The broader specification controls application lifecycle, windows, input dispatch,
mail-file behavior, composition, and transport. This page controls the narrower
filter/universe/Profile contracts and option-declaration inventory.

It does **not** claim that these source bodies were proved identical to the compiled
definitions resident in the preserved Genera 8.5 world. It does not promise
unmodified historical-source compatibility, QFASL compatibility, the full Dynamic
Windows user-option protocol, exact presentation pixels, or behavior of site and
user patches. Those stronger claims require the runtime oracles and dependency work
listed below.

## Normative language and evidence classes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are reconstruction requirements. A
**strict S452 profile** preserves source-visible ordering and defects. A deliberately
safer implementation MUST identify itself as a different profile wherever it rejects
executable profile text, stages mutations transactionally, or normalizes malformed
input more aggressively.

| Code | Evidence class | What it establishes |
| --- | --- | --- |
| `S452-F` | readable licensed source | filter construction, predicates, matching, definition recovery, and editor completion order |
| `S452-U` | readable licensed source | universe grammar, objects, mapping, set operations, caching, and definition completion order |
| `S452-P` | readable licensed source | Profile editor lifecycle, persistence, restrictions, derived updates, and failure order |
| `S452-D` | readable licensed source | Zmail globals, the 80 active option declarations, restrictions, and registration hooks |
| `S452-M` | readable licensed source | mail command-documentation associations and the one inactive option form |
| `S452-CASE` | readable licensed support source | `STRING-SEARCH` is case-insensitive; the separately named exact variant is case-sensitive |
| `TODO-RUNTIME-G85` | unresolved runtime oracle | whether the selected source profile matches the definitions and visible states in the preserved Genera 8.5 world |

The local licensed source is evidence, not a redistributable payload. This page uses
original prose, public interface names, literal option defaults, source coordinates,
and independently written pseudocode. It contains no copied function body or bulk
Help text.

## Release and artifact profile

The patch directory names the source profile as System 452.1 / Zmail 442.0. The
following paths are relative to the licensed Open Genera source tree and are not
tracked repository inputs.

| Evidence | Portable path | Bytes | SHA-256 | Principal spans |
| --- | --- | ---: | --- | --- |
| `S452-F` | `sys.sct/zmail/filter.lisp.~1549~` | 99,538 | `368e8846de981b91fa4d5e03a6714bb9b2b6c009f6ebc8fb01b77a1a6a113cd0` | 524–1067, 1186–1620, 1949–2350 |
| `S452-U` | `sys.sct/zmail/universe.lisp.~1511~` | 55,488 | `2500d0ca328476e5e7cac343b7cf13cd01b64f1f61524fd47e4b09c87333c2a5` | 158–285, 310–937 |
| `S452-P` | `sys.sct/zmail/profile.lisp.~1517~` | 48,182 | `55af687c2b52606472544722a9ee5fd3a06534e5496dc5111baadeec84cfddd3` | 58–503, 593–760 |
| `S452-D` | `sys.sct/zmail/definitions.lisp.~1552~` | 98,226 | `f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6` | 203–234, 1682–1732, 1762–1800, 1867–2150 |
| `S452-M` | `sys.sct/zmail/mail.lisp.~1571~` | 152,833 | `6885d44e951270f9b9b4ebde5a2500fd674d4282599ba7c81e1fce017cb38c3a` | 58–66, 220–236, 1983–1996 |
| `S452-CASE` | `sys.sct/sys2/string.lisp.~326~` | 94,076 | `d688c5011f5f6f194a8351da03ea2acbf43c50253ad5748653f374ebc925cec7` | 1313–1350, 1529–1566 |
| release identity | `sys.sct/zmail/patch/zmail.system-dir.~262~` | 8,075 | `27366e60fbc6760d2fa937008c9f1883549b6089786fbdfa7230557943d56383` | 1–14 |

The files and hashes were rechecked with GNU `stat` and `sha256sum` on
2026-07-19. No machine-specific pathname is needed to repeat that check after the
licensed tree has been mounted locally.

## Compatibility levels

| Level | Contract | Status |
| --- | --- | --- |
| `FUP-L1` | object model, form grammars, predicate and set semantics | specified from readable source |
| `FUP-L2` | source-visible mutation, abort, persistence, cache, and update order | specified from readable source |
| `FUP-L3` | exact selected option-declaration metadata denominator | specified for the 81 textual forms, including active/commented status |
| `FUP-L4` | behavioral match to the preserved Genera 8.5 world | reserved pending `TODO-RUNTIME-G85-*` |
| `FUP-L5` | historical source, compiled-profile, QFASL, or pixel compatibility | out of scope and unclaimed |

Levels are cumulative. An implementation does not reach `FUP-L4` merely by passing
source-derived unit tests.

## Object and ownership model

### Filter definition

A named filter has five independently observable parts (`S452-F`):

```text
FilterDefinition {
  name-symbol
  optional-documentation
  editable-definition-form
  executable FILTER-FUNCTION property
  recoverable EXPR-FILTER-FUNCTION representation
  menu-entry in USER-FILTER-ALIST
}
```

The menu entry and the two function properties are mutable runtime state. The
profile source section is a separate persistence representation. Editing a form does
not change the runtime definition until Done or Sample evaluates it; evaluating it
does not by itself save the profile.

### Universe definition and universe object

A named universe has separate definition and expansion state (`S452-U`):

```text
UniverseDefinition {
  name-symbol
  serialized-description
  expanded-universe-object
  membership in UNIVERSE-LIST
}
```

The serialized description is stored as one symbol property. The expanded object is
stored as another. The ordered name list is a third object. These three writes are
not one transaction.

An expanded universe implements a sequence-like mapping protocol. A universe may be
a direct sequence, a lazy mail-file indirection, a dynamic composite, a variable
indirection, or a temporary resource. `SIMPLE-P` distinguishes direct sequences from
the composite mapping path; it is not a claim that a direct sequence is immutable.

### Profile document

The Profile is executable Lisp source, not a passive preference serialization
(`S452-P`, `S452-D`). Its editor interval owns:

- a source pathname and file identity;
- a modified/save tick and a separate option-variable tick;
- an automatically generated block of non-default `LOGIN-SETQ` forms;
- ordinary user-authored Lisp outside that block;
- named filter and universe definition sections; and
- an optional compiled file whose source identity and creation date are checked.

The generated block and named-definition sections are edited by different code
paths. A conforming implementation MUST NOT imply that saving option values alone
captures a newly defined filter or universe unless its definition form is also in the
profile source.

## Filter definition language

### Outer form and execution model

The persisted source form has this grammar (`S452-F`):

```text
filter-definition := (DEFINE-FILTER name-symbol (message-variable)
                       [documentation-string]
                       body-form*)
```

`body-form*` is general Lisp, not a sealed query language. The form may call other
functions, refer to global state, signal conditions, or have side effects. The macro
ensures that an empty body is false. It also scans the body for free references to
the conventional `STATUS` and `KEYWORDS` names. When required, it injects parsing of
the message status and retrieval of its keyword list before the user body. A locally
bound name is not treated as one of those implicit references.

This has two required consequences:

1. A strict compatibility profile MUST evaluate trusted profile/filter Lisp with the
   historical power and risks of executable initialization code.
2. A safe declarative clone MAY accept only the constructor subset below, but MUST
   advertise that restriction and MUST NOT claim historical Profile compatibility.

### Constructor-generated subset

The Filter pane's buttons and menus synthesize this subset. These are exact semantic
shapes, written with descriptive operators where the original uses ordinary Lisp
symbols (`S452-F`):

| UI operation | Inserted predicate semantics |
| --- | --- |
| Not, And, Or | open a `NOT`, `AND`, or `OR` form and leave insertion inside it |
| Close | move outward over the next containing list |
| any keyword | true when the derived keyword list is nonempty |
| one keyword | identity-membership of the selected keyword symbol in the derived list |
| Deleted, Unseen, Answered, Recent, Filed | non-null property lookup on parsed status |
| Expired | expiration predicate on the message and current universal time |
| Current | reminder/current-on-day predicate supplied by the calendar subsystem |
| Digest | digest recognizer on the message |
| full-message Search | literal, finite-state, or finite-state-expression search selected by the extended-search parser |
| Recipient, Author, Author/Recipient | address-header search over the corresponding header-type supertype |
| Subject with empty search text | presence of a Subject header |
| other header with empty search text | presence of that exact header type |
| Subject or other header with text | address-aware search for address types; recursive string search otherwise |
| On, Before, After | absolute or execution-relative date macro, selected after parsing and confirmation |
| named user filter | invoke the current executable definition associated with that filter symbol |

The constructor composes ordinary truth values. `AND` and `OR` preserve Lisp
short-circuit order. `NOT` negates any non-null result; it does not require a canonical
Boolean input.

### Reading, evaluation, compilation, and completion order

Done and Sample share the same definition-completion operation (`S452-F`):

1. Position the editor stream at the start and read **one** Lisp object using the
   interval's syntax, defaulting to Common Lisp syntax when no syntax is recorded.
   Trailing objects are not checked by this operation.
2. Evaluate that object.
3. Require the value to identify a function property whose property name is
   `FILTER-FUNCTION`; otherwise signal the task's “not a filter definition” failure.
4. Compile that function-property specification.
5. If compilation added warnings, ask whether to accept them. Declining aborts the
   current command.
6. Return the filter name. Done exits; Sample then surveys the selected universe with
   the just-defined filter.

Evaluation precedes the result-shape check and compilation. Evaluating an arbitrary
non-filter form can therefore have effects before rejection. The definition macro
also updates or appends the menu entry before the generated executable definitions
finish installing. A compilation warning is offered **after** those mutations. A
declined warning, compilation failure, or later Sample failure does not roll them
back. A transactional clone is a safety-corrected profile, not strict S452 behavior.

End-of-file while reading is reported as unbalanced parentheses. The general read
error branch does not manufacture a valid form. No subsequent mutation may be
claimed from the reader alone, although evaluation of a successfully read malicious
form remains unrestricted.

### Naming and redefinition

Filter names are package symbols. The task runs with the ZWEI package selected;
typing a new name is read and interned there. A left click on Name rewrites only the
name in the editable form. Middle, right, or keyboard entry chooses an existing
definition; if none exist, the operation fails without creating one. This executable
branch contradicts the pane's broader left/middle wording, so strict conformance uses
the executable branch (`S452-F`).

Defining a new symbol appends a menu entry, then optionally sorts the list using the
configured predicate. Redefining a symbol replaces its menu metadata without moving
it first. Because the sort predicate is itself evaluated configuration, a strict
profile preserves its ability to signal or execute arbitrary trusted code.

Calling a named filter resolves the symbol's current `FILTER-FUNCTION` property at
call time. A missing property signals that the symbol is not a filter. Thus a parent
filter sees a later successful redefinition of a referenced child without recompiling
the parent.

## Predicate contract

### Built-in predicate families

For every source-defined “predicate and opposite” pair, the opposite evaluates the
same body and applies Lisp `NOT` to its result (`S452-F`). It is not an independently
optimized relation. Errors, parsing, and other side effects occur in the same order
before negation.

| Family | Positive result |
| --- | --- |
| any keyword | message keyword property is non-null |
| selected keyword | selected keyword symbol is present by identity |
| true | always true; its generated opposite is always false |
| status attribute | named status property is non-null |
| undeleted status attribute | parse status, require Deleted absent, then require named attribute present |
| named filter | current named filter function returns non-null |
| digest | digest recognizer returns non-null |
| literal/full-message search | selected matcher finds a span between message start and end |
| recipient | any header whose type is a Recipient subtype contains a matching address |
| From | the exact From header contains a matching address |
| sender | any Sender-subtype header contains a matching address |
| sender or recipient | any Sender-or-Recipient-subtype header contains a matching address |
| exact subject | canonical subject exists and is equal to the key ignoring case |
| subject substring | real subject exists and the ordinary search matcher finds the key |
| subject finite-state | real subject exists and the finite-state matcher succeeds |
| expired | expiration exists and current time is strictly later than it |
| on date | message date is at least the selected midnight and less than midnight plus 86,400 seconds |

Before and After are standalone functions, not generated opposite pairs. Before uses
strict `<`; After uses `>=`. In the filter chooser, negating Before is normalized to
After, and negating After is normalized to Before. A message with no date makes both
positive predicates false; an explicit Lisp `NOT` around Before would instead be
true, so the chooser's normalization is significant.

### Search-key coercion and case

The macro-level search-key grammar has three branches (`S452-F`):

- an ordinary string selects the ordinary search function;
- a 16-bit extended-search string, or a constructor form that creates one, is parsed
  into literal, finite-state, or finite-state-expression search state; and
- every other key is rejected during macro expansion.

Ordinary `STRING-SEARCH` and `STRING-EQUAL` in this source environment compare
characters without case distinction. `S452-CASE` establishes that the ordinary
search calls `CHAR-EQUAL`/`%STRING-EQUAL`; a separately named Exact operation uses
`CHAR=`/`%STRING=`. Therefore literal header, subject, name-fragment, user-at-host,
and routed-name matches in this contract are case-insensitive.

Finite-state and finite-state-expression keys preserve the extended-search parser's
own expression semantics. This page does not reduce that expression language to a
literal string or claim that every expression has one global case rule. A conforming
implementation MUST pass the parsed matcher and key through unchanged.

General header search recursively descends cons-valued header fields and succeeds if
any leaf string matches. An exact header-type list uses identity membership; a header
supertype request uses the header-type lattice.

### Address matching

Address matching first classifies the parsed search key (`S452-F`):

1. A finite-state or finite-state-expression key searches each recipient's preserved
   original string or source interval.
2. A key surrounded by the two internal partial-match delimiters searches for a
   case-insensitive substring of the parsed address name.
3. A leading delimiter requires a case-insensitive suffix; a trailing delimiter
   requires a case-insensitive prefix.
4. A literal containing `@` is split at the first `@`; both parsed name and printable
   host name must match case-insensitively.
5. A literal containing `!` or `%` but no `@` compares the complete parsed name
   case-insensitively.
6. Every other literal compares a cached **true name** case-insensitively.

True-name derivation strips routing between the last `!` and first `%` in the normal
route shape. If neither delimiter exists, the whole name is the true name. If the
two delimiters occur in the source's exceptional crossing/adjacent arrangement, the
whole name is retained. The derived value is cached in the parsed address property
list; an explicitly present null true-name property means “use the original name.”

The partial-match delimiters are single-character symbols emitted by the historical
extended-search UI. A file-compatible implementation must preserve their character
identity. A semantic-only implementation may expose readable aliases, but must map
them to the four behaviors above without swapping prefix and suffix.

### Date and expiration rules

The constructor parses a date assuming universal-time zone argument zero and
distinguishes absolute from relative input (`S452-F`):

- If the parser says the input is relative, the user may retain an expression whose
  offset is recomputed from the time at which the filter runs, or freeze the parsed
  instant into a normalized absolute date string.
- Absolute On filters compile one midnight and use the half-open interval
  `[midnight, midnight + 86400)`.
- Absolute Before is `< midnight`; absolute After is `>= instant`.
- Relative forms compute an offset from a normalized record of the definition-time
  date and apply that offset to the execution-time clock.
- A missing message date makes On, Before, and After false.
- An expiration scalar expires only when `now > expiration`, not at equality. If the
  expiration property is a list, its last element is the comparison instant. A
  missing expiration is not expired.

The fixed 86,400-second On interval is historical behavior. A civil-calendar clone
that silently substitutes daylight-saving-aware next-midnight arithmetic is not a
strict implementation.

## Universe description language

### Serialized grammar

The definition form is:

```text
(DEFINE-UNIVERSE name-symbol () description)
```

The ignored empty list is nevertheless required by the macro call grammar. The
description grammar is (`S452-U`):

```text
description := file-name-string
             | DEFAULT | CURRENT | LOADED
             | defined-universe-symbol
             | (any-symbol)
             | (NOT-GLYPH description)
             | (INTERSECTION-GLYPH description*)
             | (UNION-GLYPH description*)
```

The preserved text source encodes the single-character operator print names with
octets `0x05` (Not), `0x12` (Intersection), and `0x13` (Union). These are historical
character-set glyph tokens, not ASCII control operations. A representation-compatible
writer must emit symbols with those print names in the selected source encoding. A
semantic implementation may additionally accept ASCII aliases.

`NIL`, an arbitrary non-string atom, an unknown multi-element operator, and a Not
form with other than one operand are invalid. Source-visible edge cases are:

- any one-element list whose element is a symbol passes both checker invocations,
  even when that symbol is not a defined universe; an unknown symbol then fails
  later during expansion;
- an empty Union expands to an empty set;
- an empty Intersection is initialized from the current complete sequence list,
  representing the source's “everything” convention; and
- a zero-operand Not passes the shallow one-element-list check but fails during
  expansion when its missing component is expanded.

These edge cases distinguish the strict profile from a mathematically tidier parser.

### Definition and expansion order

Macro expansion checks the grammar while allowing forward symbol names. Evaluation
then performs these effects in order (`S452-U`):

1. Recheck the quoted description and normally require referenced named universes to
   be defined at that time. The one-element-list escape above is the exception.
2. Record source-definition metadata.
3. Append the name to `UNIVERSE-LIST` if it is not already present by identity.
4. Store the serialized description property.
5. Expand the description to an object and store that object property.
6. Return the name symbol.

Step 1 precedes registry mutation, so an ordinary missing dependency changes
nothing. A missing name hidden inside the accepted one-element-list shape fails only
in step 5. That failure, and any other failure in steps 4–5, can leave the name
registered and/or the new description installed without a new expanded object. The
UI catches an evaluation error, beeps, reports it, and remains in the task; it does
not restore the prior properties.

Definition order in a profile is therefore normative: referenced names must already
be active when the generated runtime check executes. Cycles introduced through
redefinition can pass name-existence checks and fail or recurse during expansion.

### Expansion semantics

| Description | Expanded object and binding time |
| --- | --- |
| direct sequence object | the same object |
| `DEFAULT` | shared indirection that resolves the default buffer when prepared |
| `CURRENT` | shared indirection through the currently selected sequence variable |
| `LOADED` | shared multi-universe whose components are currently loaded mail buffers |
| file-name string | lazy mail-file universe; loading is deferred until preparation |
| named symbol or singleton named list | the expanded object currently stored on that symbol |
| Not | dynamic composite over one expanded child |
| Intersection/Union | dynamic composite over the children expanded at definition time |

A parent named universe captures the child objects returned during its own
definition. Redefining a child replaces the child's stored object but does not walk
and rewrite already expanded parents. The parent must be redefined or reloaded to
capture the replacement. This differs from named filters, which resolve a child's
function property at call time.

### Preparation, mapping, and caching

A direct sequence prepares before mapping unless `NO-PREPARE` was explicitly set.
For an ordinary sequence, preparation expunges when its expunge tick is absent or
older than the global buffer-expunge tick. A message buffer first ensures that the
file is fully loaded and applies its distinct expunge rule (`S452-U`).

Mapping over a direct sequence visits the half-open index range `[START, END)` in
ascending order, or descending from `END - 1` when `FROM-END` is true. The callback
is invoked once for each visited array member. A caller-supplied bad range or a
callback failure is not normalized or rolled back by this layer.

Dynamic set universes retain an array, a composite modification tick, and a child-to-
last-seen-tick association list. Before recomputing they prepare children and update
the remembered child ticks. If any child is newer than the composite, the composite
sets its result fill pointer to zero, rebuilds, and only then advances its own tick.
Failure during rebuild may therefore expose an emptied or partially rebuilt array,
while the stale composite tick causes a later call to retry.

Set operations have these exact meanings:

- **Union:** visit children in listed order, append each child's messages, then
  destructively eliminate duplicate message identities with the source's
  from-end policy.
- **Intersection:** if the child list is empty, replace it with a copy of the current
  sequence list; otherwise sort children in place by increasing message count, then
  emit messages in the smallest child's order when every other child contains the
  same message.
- **Not:** iterate every currently loaded mail-buffer sequence and emit messages not
  present in the one source universe. Collections are not independently traversed,
  because they duplicate mail-buffer messages.

Neither set construction nor generic multiple-universe mapping is a snapshot
transaction across files. Child preparation, lazy loading, callback effects, and a
later failure may already have occurred.

## Named-definition persistence in Profile

### Selecting the active definition set

The Filters and Universes Profile buttons edit which runtime definitions are copied
into the Profile source (`S452-P`). The operation:

1. Sectionizes the current editor interval and determines which registered names
   already have a definition section of the matching type.
2. Lets the user choose a new active set, possibly defining a new item.
3. If the active set is unchanged, returns without rewriting.
4. Resolves and validates the recoverable definition of **every** newly active name
   before deleting any definition text.
5. For each removed filter or universe, checks configured associations and asks
   permission before removing those associations.
6. Deletes every old matching definition section from the Profile interval.
7. Appends the recoverable definition of each newly active name, in selected order.
8. Redisplays and sectionizes the changed interval.

Step 4 prevents a missing or unrecognizable newly active definition from destroying
old definition text. The whole operation is still not atomic. Confirming cleanup for
one removed name mutates association alists immediately; declining a later prompt
can leave that earlier cleanup in memory even though definition rewriting is
aborted. A failure after step 6 can leave definition text deleted or only partly
reinserted.

Removing a definition section does not unregister its runtime filter function or
universe properties. It controls future persistence, not immediate runtime lifetime.

### Recovering a filter definition

Definition recovery first consults the executable function property, then its
digest representation, then asks the Profile editor for a matching source
definition. It undigests the lambda, verifies recognizable generated provenance,
removes injected status/keyword setup and compiler declarations, merges available
documentation, and reconstructs a `DEFINE-FILTER` form (`S452-F`). An atom, an
unrecognized lambda shape, or missing evidence fails rather than inventing source.

The reconstruction is behaviorally equivalent source for the recognized generated
shape; it is not proof of the author's original formatting or macro body.

### Source file and compiled cache

On entry, Profile probes the source file. A different external file version can
trigger a prompt to revert; a missing source creates a new Profile buffer and inserts
current settings; an unavailable host records a warning state rather than pretending
the file was read (`S452-P`).

The optional compiled Profile is a cache, not the canonical editable document.
Profile compares its recorded source pathname identity and creation date with the
source. A missing compiled file, a character file where a compiled file is expected,
a different source identity, or an older compiled creation date clears the
“compiled matches source” tick. Compile writes the binary file, reloads the Profile
with reset enabled, and only then records the new compile tick.

### Generated option block and Save modes

Before inserting option settings, Profile recomputes the site-relative
Dont-Reply-To deltas. It finds and replaces the prior generated block of recognized
`LOGIN-SETQ` forms, writes current non-default Zmail and selected hardcopy options,
updates the editor-variable tick, and restores temporary configuration-name
normalization in an unwind cleanup (`S452-P`). Arbitrary Lisp outside the marked
block remains user-owned text.

| Save action | Ordered effects |
| --- | --- |
| Insert changes | regenerate the option block; do not save the file |
| Save | save current Profile text; do not first regenerate settings |
| Compile | ask whether to insert changes; ask to save if modified; if saved state is still stale, ask whether to compile it anyway; compile and reload only when accepted |
| Reap | offer to delete old Profile file versions |
| left/keyboard Save (“save all”) | ask whether to insert changes, save the source, then offer to recompile when the saved source differs from the compile tick |

Reset reloads Profile values and may offer to revert edited source text. Defaults
loads system defaults without loading the user profile, refreshes the choices, and
then may insert changed variables. Neither path is described as an all-or-nothing
transaction.

## User-option metadata contract

### How to read the inventory

The next table is the exact source-form denominator requested for this profile. It
does not include hardcopy options or the separately declared site-alist
`*MAIL-SENDING-MODE*`, because neither is a textual
`DEFINE-ZMAIL-USER-OPTION` form in the selected files.

The Type column is a choose-variable-values editor descriptor, not a Common Lisp
declaration. The Default column preserves source spelling and gives the evaluated
value when quoting matters. Exposure codes are:

- `CVV`: present in the ordinary Profile choose-variable-values pane;
- `SPECIAL`: active and persistent but hidden by source-local `:NEVER` restriction;
- `DYNAMIC`: visibility is changed by another option; and
- `INACTIVE`: text is inside a block comment and does not register an option.

Every ordinary CVV edit first delegates value parsing to the generic chooser, then
advances the Profile variable tick, requests an explicit command-documentation
update, and reselects Zmail. The Update column lists only additional source-visible
effects:

- `none`: no bespoke Profile update beyond that generic sequence;
- `rename`: mail-file rename rewrites this option, marks Profile changed, and
  refreshes the chooser when Profile is open;
- `mail-doc` / `reply-doc`: the named command's mouse documentation is associated
  with the option and is recomputed by the generic update request;
- `calendar-exit`: leaving Profile recomputes calendar windows if the value changed;
- `dont-diff`: recompute hidden site-add/site-delete lists under a lock;
- `danger-visibility`: reconstruct or show/hide dependent dangerous-command choices;
- `danger-register`: new dangerous commands update this value/default/menu and may
  reconstruct the pane; and
- `special-menu`: mutation is owned by a dedicated Profile menu rather than CVV.

### Complete 81-form inventory

| # | Option | Type | Default source → value | Applies to | Exposure | Additional update |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `*OTHER-MAIL-FILE-NAMES*` | `:PATHNAME-LIST` | `NIL` | remembered non-default mail files | SPECIAL | special-menu, rename |
| 2 | `*FILTER-KEYWORDS-ALIST*` | `:SEXP` | `NIL` | filter-to-keyword associations | SPECIAL | special-menu |
| 3 | `*FILTER-MOVE-MAIL-FILE-ALIST*` | `:SEXP` | `NIL` | filter-to-move-file associations | SPECIAL | special-menu, rename |
| 4 | `*FILTER-REFERENCE-UNIVERSE-ALIST*` | `:SEXP` | `NIL` | filter-to-reference-universe/file associations | SPECIAL | special-menu, rename |
| 5 | `*DELETE-EXPIRED-MSGS*` | `:MENU-ALIST` | `':PER-FILE` → `:PER-FILE` | automatic expiration deletion policy | CVV | none |
| 6 | `*SHOW-REMINDERS-IN-YEAR-MODE*` | `:BOOLEAN` | `NIL` | year-calendar reminder highlighting | CVV | none |
| 7 | `*CALENDAR-MODE-WEEK-STARTS-ON-MONDAY*` | `:BOOLEAN` | `T` | calendar week alignment | CVV | calendar-exit |
| 8 | `*CONFIGURE-MIDDLE-MODE*` | `:MENU-ALIST` | `':BOTH` → `:BOTH` | middle-button Configure layout | CVV | none |
| 9 | `*PRESERVE-MSG-REFERENCES-ACROSS-EXPUNGE*` | `:BOOLEAN` | `NIL` | reference preservation during expunge | CVV | none |
| 10 | `*QUERY-BEFORE-SELECTING-EMPTY-SEQUENCE*` | `:BOOLEAN` | `NIL` | empty-sequence selection confirmation | CVV | none |
| 11 | `*DEFAULT-MAIL-BUFFER-GENERATION-RETENTION-COUNT*` | `:NUMBER-OR-NIL` | `NIL` | generations retained for new mail files | CVV | none |
| 12 | `*DELETE-AFTER-MOVE-TO-BUFFER*` | `:BOOLEAN` | `T` | source-message deletion after move | CVV | none |
| 13 | `*DEFAULT-MOVE-MAIL-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | default Move destination | CVV | rename |
| 14 | `*TEXT-MAIL-FILE-SEPARATOR*` | `:STRING` | `""` | separator written between text-file messages | CVV | none |
| 15 | `*FILTER-ALIST-SORT-PREDICATE*` | `:MENU-ALIST` | `'(FUNCTION STRING-LESSP)` → `(FUNCTION STRING-LESSP)` | user-filter menu order | CVV | none |
| 16 | `*KEYWORD-ALIST-SORT-PREDICATE*` | `:MENU-ALIST` | `'(FUNCTION STRING-LESSP)` → `(FUNCTION STRING-LESSP)` | keyword-menu order | CVV | none |
| 17 | `*SUMMARY-MOUSE-MIDDLE-MODE*` | `:MENU-ALIST` | `':DELETE-OR-UNDELETE` → `:DELETE-OR-UNDELETE` | Summary middle-button operation | CVV | none |
| 18 | `*MAP-MIDDLE-MODE*` | `:ASSOC` | `NIL` | Map middle-button command | CVV | none |
| 19 | `*PREVIOUS-MIDDLE-MODE*` | `:MENU-ALIST` | `':FIRST-UNDELETED` → `:FIRST-UNDELETED` | Previous middle-button movement | CVV | none |
| 20 | `*NEXT-MIDDLE-MODE*` | `:MENU-ALIST` | `':LAST-UNDELETED` → `:LAST-UNDELETED` | Next middle-button movement | CVV | none |
| 21 | `*NEXT-AFTER-DELETE*` | `:MENU-ALIST` | `':FORWARD` → `:FORWARD` | post-delete movement direction | CVV | none |
| 22 | `*DELETE-MIDDLE-MODE*` | `:MENU-ALIST` | `':BACKWARD` → `:BACKWARD` | Delete middle-button movement | CVV | none |
| 23 | `*INDENT-FORWARDED-MSGS*` | `:BOOLEAN` | `NIL` | indentation of forwarded text | CVV | none |
| 24 | `*REFORMAT-FORWARDED-MSGS*` | `:MENU-ALIST` | `T` | forwarded-header reformat policy | CVV | none |
| 25 | `*FORWARDED-ADD-SUBJECT*` | `:BOOLEAN` | `T` | adding a subject to forwards | CVV | none |
| 26 | `*FORWARDED-MESSAGE-END*` | `:STRING` | `""` | text after forwarded messages | CVV | none |
| 27 | `*FORWARDED-MESSAGE-SEPARATOR*` | `:STRING` | `""` | text between forwarded messages | CVV | none |
| 28 | `*FORWARDED-MESSAGE-BEGIN*` | `:STRING` | `""` | text before forwarded messages | CVV | none |
| 29 | `*PRUNE-HEADERS-AFTER-YANKING*` | `:BOOLEAN` | `T` | pruning headers of yanked messages | CVV | none |
| 30 | `*ONE-WINDOW-AFTER-YANK*` | `:BOOLEAN` | `T` | one-window layout after yank | CVV | none |
| 31 | `*DONT-REPLY-TO*` | `:STRING-LIST` | `NIL` | merged effective no-reply address list | CVV | dont-diff |
| 32 | `*ADD-TO-SITE-DONT-REPLY-TO-LIST*` | `:STRING-LIST` | `NIL` | persisted additions to the site no-reply list | SPECIAL | dont-diff |
| 33 | `*DELETE-FROM-SITE-DONT-REPLY-TO-LIST*` | `:STRING-LIST` | `NIL` | persisted deletions from the site no-reply list | SPECIAL | dont-diff |
| 34 | `*GENERATE-IN-REPLY-TO-FIELD*` | `:BOOLEAN` | `T` | automatic In-Reply-To generation | CVV | none |
| 35 | `*REPLY-HEADER-FORMAT*` | `:MENU-ALIST` | `':SHORT` → `:SHORT` | headers inserted into replies | CVV | none |
| 36 | `*MIDDLE-REPLY-WINDOW-MODE*` | `:MENU-ALIST` | `':TWO-WINDOWS` → `:TWO-WINDOWS` | middle-button Reply layout | CVV | reply-doc |
| 37 | `*REPLY-WINDOW-MODE*` | `:MENU-ALIST` | `':TWO-WINDOWS` → `:TWO-WINDOWS` | ordinary Reply layout | CVV | reply-doc |
| 38 | `*MIDDLE-REPLY-MODE*` | `:MENU-ALIST` | `':SENDER` → `:SENDER` | middle-button Reply recipients | CVV | reply-doc |
| 39 | `*1R-REPLY-MODE*` | `:MENU-ALIST` | `':SENDER` → `:SENDER` | Reply recipients for numeric argument one | CVV | none |
| 40 | `*REPLY-MODE*` | `:MENU-ALIST` | `':ALL` → `:ALL` | ordinary Reply recipients | CVV | reply-doc |
| 41 | `*MAIL-FILE-FOR-DRAFTS*` | `:PATHNAME-OR-NIL` | `NIL` | mail file used to store drafts | CVV | rename |
| 42 | `*DEFAULT-DRAFT-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | default draft-save pathname | CVV | none |
| 43 | `*DEFAULT-MAIL-BUFFER-MAJOR-MODE*` | `:MENU-ALIST` | `:TEXT` | major mode for new composition buffers | CVV | none |
| 44 | `*ADD-SUPERSEDES-AND-COMMENTS-WHEN-RETRANSMITTING*` | `:MENU-ALIST` | `:ASK` | Supersedes/Comments retransmission policy | CVV | none |
| 45 | `*DEFAULT-BFCC-LIST*` | `:PATHNAME-LIST` | `NIL` | initial blind file-copy recipients | CVV | rename |
| 46 | `*DEFAULT-FCC-LIST*` | `:PATHNAME-LIST` | `NIL` | initial file-copy recipients | CVV | rename |
| 47 | `*DEFAULT-BCC-LIST*` | `:ADDRESS-LIST` | `NIL` | initial blind-copy recipients | CVV | none |
| 48 | `*DEFAULT-CC-LIST*` | `:ADDRESS-LIST` | `NIL` | initial copy recipients | CVV | none |
| 49 | `*DEFAULT-REPLY-TO-LIST*` | `:ADDRESS-LIST` | `NIL` | initial Reply-To recipients | CVV | none |
| 50 | `*LOCAL-MAIL-INCLUDE-SUBJECT*` | `:BOOLEAN` | `T` | initial Subject for local mail | CVV | none |
| 51 | `*LOCAL-MAIL-HEADER-FORCE*` | `:MENU-ALIST` | `':ITS` → `:ITS` | local-message header-force policy | CVV | none |
| 52 | `*SEND-HEADER-FORMAT*` | `:MENU-ALIST` | `':INCLUDE-PERSONAL` → `:INCLUDE-PERSONAL` | headers emitted on send | CVV | none |
| 53 | `*REQUIRE-SUBJECTS*` | `:MENU-ALIST` | `T` | outgoing-subject requirement | CVV | none |
| 54 | `*PROMPT-FOR-MISSING-HEADERS*` | `:BOOLEAN` | `T` | minibuffer prompting for absent headers | CVV | none |
| 55 | `*HEADER-WINDOW-NLINES*` | `:NUMBER` | `3` | draft header-pane size | CVV | none |
| 56 | `*DRAFT-EDITOR-END-KEY-TREATMENT*` | `:MENU-ALIST` | `:ADD-MORE-TEXT` | End in the draft header pane | CVV | none |
| 57 | `*DEFAULT-MAIL-WINDOW-CONFIGURATION*` | `:MENU-ALIST` | `':SEND` → `:SEND` | composition window layout | CVV | none |
| 58 | `*MAIL-MIDDLE-MODE*` | `:MENU-ALIST` | `':BUG` → `:BUG` | Mail command middle-button mode | CVV | mail-doc |
| 59 | `*INHIBIT-BACKGROUND-SAVES*` | `:INVERTED-BOOLEAN` | `NIL` | automatic post-inbox background save | CVV | none |
| 60 | `*QUERY-BEFORE-EXPUNGE*` | `:BOOLEAN` | `NIL` | pre-expunge display and confirmation | CVV | none |
| 61 | `*GMSGS-OTHER-SWITCHES*` | `:STRING` | `"//Z"` | extra GMSGS switches | CVV | none |
| 62 | `*RUN-GMSGS-P*` | `:ASSOC` | `':NO` → `:NO` | whether/when to run GMSGS before inbox | CVV | none |
| 63 | `*REFORMAT-HEADERS-P*` | `:MENU-ALIST` | `T` | non-BABYL header reformatting | CVV | none |
| 64 | `*BABYL-REFORMATTING-CONTROLLED-BY-FILE*` | `:BOOLEAN` | `NIL` | whether BABYL file options control reformatting | CVV | none |
| 65 | `*ALWAYS-SELECT-SAVED-CURRENT-MSG*` | `:BOOLEAN` | `NIL` | reselection of saved current message | CVV | none |
| 66 | `*ALWAYS-JUMP-AFTER-GET-NEW-MAIL-FROM-INBOX*` | `:BOOLEAN` | `NIL` | jump behavior after inbox processing | CVV | none |
| 67 | `*INHIBIT-BACKGROUND-MAIL-CHECKS*` | `:INVERTED-BOOLEAN` | `NIL` | periodic background mail checking | CVV | none |
| 68 | `*AUTOSAVE-IF-INBOX-REQUIRES-SAVE*` | `:MENU-ALIST` | `:ASK` | save policy when inbox processing requires it | CVV | none |
| 69 | `*COMPLETE-GET-INBOX-IN-BACKGROUND*` | `:BOOLEAN` | `T` | completion of inbox reading in background | CVV | none |
| 70 | `*NEW-MAIL-FILE-APPEND-P*` | `:MENU-ALIST` | `':STICKY` → `:STICKY` | append/prepend policy for new mail files | CVV | none |
| 71 | `*ZMAIL-STARTUP-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | initial Get Inbox/Select file | CVV | rename |
| 72 | `*FILTER-SUMMARY-WINDOW-FRACTION*` | `:NUMBER-OR-NIL` | `NIL` | Summary fraction in filtering layout | CVV | none |
| 73 | `*SUMMARY-SCROLL-FRACTION*` | `:NUMBER` | `0.2s0` → short float `0.2` | Summary scrolling increment | CVV | none |
| 74 | `*SUMMARY-SUBJECT-TRIM-SPACES*` | `:BOOLEAN` | `T` | leading-space trimming in Summary subjects | CVV | none |
| 75 | `*SUMMARY-WINDOW-FRACTION*` | `:NUMBER` | `0.45s0` → short float `0.45` | ordinary Summary pane fraction | CVV | none |
| 76 | `*DEFAULT-SUMMARY-TEMPLATE*` | `:MENU-ALIST` | `T` | default Summary format template | CVV | none |
| 77 | `*DEFAULT-INITIAL-WINDOW-CONFIGURATION*` | `:MENU-ALIST` | `':BOTH` → `:BOTH` | startup reader layout | CVV | none |
| 78 | `*TOO-MANY-MSGS-QUERY-THRESHOLD*` | `:INTEGER` | `20.` → decimal integer `20` | Map Over confirmation threshold | DYNAMIC | danger-visibility |
| 79 | `*SELECTED-DANGEROUS-ZMAIL-COMMANDS*` | `:CHOOSE-MULTIPLE` | `NIL` | commands queried in Selective mode | DYNAMIC | danger-visibility, danger-register |
| 80 | `*ASK-BEFORE-EXECUTING-DANGEROUS-ZMAIL-COMMANDS*` | `:MENU-ALIST` | `:ALL` | global dangerous-command confirmation policy | CVV | danger-visibility |
| 81 | `*DEFAULT-HEADER-FORCE*` | `:MENU-ALIST` | `':NONE` → `:NONE` | obsolete COMSAT header-force option text | INACTIVE | none; a global with the same name is defined separately |

The two commented GMSGS restrictions do not restrict rows 61–62 in this source
profile. The inactive row 81 also contains an inactive COMSAT-only restriction; it
must not be counted among the 80 registered Zmail user options.

### Dynamic option applicability

The clean source Profile pane applies these exact visibility rules (`S452-P`):

- Confirmation policy `:ALL`: hide Selected Dangerous Commands; show the mapping
  threshold.
- `:SELECTIVE`: show Selected Dangerous Commands; show the threshold only when the
  selected set contains the Map Over command.
- `:NONE`: hide both dependent choices.

Changing either controlling choice reconstructs the CVV pane only when its visible
set changed. Registration of a new dangerous command sorts the command menu,
replaces the selected-option menu metadata, preserves prior selected identities,
selects the newly registered command, and reconstructs an existing Profile pane.

Source-local `:NEVER` restrictions hide rows 1–4 and 32–33 from CVV. They remain
active user options for serialization and are managed by special Profile operations
or derived-list logic. An external site can add further restrictions; none are
inferred here.

### Derived update contracts

`*DONT-REPLY-TO*` is a merged effective value. A site initialization resets its
default from the site option, then combines it with hidden addition and deletion
lists under one lock. Editing the visible merged list or inserting changed Profile
variables recomputes those hidden deltas under the same lock. The profile persists
the deltas so a later site-default change can be merged; it does not treat the
visible list as a simple independent default (`S452-D`, `S452-P`).

When a mail file is renamed, Profile checks pathname equality after merging both
names with Zmail pathname defaults. It rewrites the three scalar pathname options,
the three pathname-list options, and the two filter-association alists marked
`rename` above. The first change advances the variable tick and reports that Profile
must be saved; an open Profile chooser is refreshed after all rewrites. A failure
partway through this loop is not rolled back (`S452-P`).

Changing calendar week-start takes effect in the variables immediately, but calendar
window recomputation is delayed to the unwind cleanup when leaving the Profile
command. This cleanup also runs after an abnormal exit from the editor. Mail and
Reply documentation associations are refreshed during ordinary variable-choice
handling; the association is not a general callback attached to the variable cell.

## Failure, abort, and recovery matrix

| Operation | Failure point | State that may already have changed | Recovery in strict S452 |
| --- | --- | --- | --- |
| filter read | EOF/read error | editor only | report/barf; remain in task or unwind command |
| filter evaluation | arbitrary error or wrong result shape | arbitrary evaluated effects; possibly menu/functions | no rollback |
| filter compile | compiler error or warning declined | menu entry and evaluated definition may exist | no rollback; edit and retry |
| filter Sample | universe choice/survey failure | compiled filter already installed | no rollback |
| universe validation | missing/invalid dependency in runtime recheck | none from definition registration | report, remain in task |
| universe expansion | cycle, lazy-object construction, or later error | name list and definition property may be new | report, remain; repair/redefine |
| dynamic universe rebuild | child preparation or callback error | child loads/preparation and empty/partial cached array | composite tick remains stale; later prepare retries |
| active-definition edit | failed preflight accessor | none from section deletion | abort rewrite |
| dependency cleanup | later confirmation declined | earlier association cleanups may remain | no rollback |
| definition section rewrite | deletion/insertion error | partial Profile text | editor remains modified; manually repair/revert |
| option variable edit | chooser rejects input | generic chooser controls mutation | no bespoke Zmail rollback |
| Profile block generation | printer/editor error | prior generated block may be partly replaced; temporary name normalization is unwound | repair/revert |
| Profile compile | save declined/stale-state override declined/compiler or reload error | inserted/saved source may already differ | compiled-match tick not advanced on incomplete success |

Abort from the Filter or Universe task restores the prior Zmail window configuration
through an unwind cleanup. It does not undo already evaluated definitions. Exit from
Profile similarly restores the prior layout and who-line state; calendar week-start
cleanup may run during that exit.

## Conformance suite

Tests below use disposable messages, definitions, profile text, and mail files. A
test harness MUST record the target source/runtime profile and restore all mutable
state after each case.

### Filter tests

1. `FILT-READ-ONE`: place two forms in the editor; prove only the first is read by
   definition completion.
2. `FILT-WRONG-SHAPE`: evaluate a harmless effectful form returning a non-filter
   value; prove the effect occurs before rejection.
3. `FILT-WARNING-ABORT`: install a definition which produces a compiler warning,
   decline it, and prove the runtime menu/definition mutation is not rolled back.
4. `FILT-IMPLICIT-STATE`: define bodies with free Status, free Keywords, locally
   bound names, and neither; prove parsing/keyword setup is injected only for the
   first two free-reference cases.
5. `FILT-OPPOSITE-EFFECT`: use a predicate body that increments a counter and returns
   non-null; prove the opposite increments once and returns false.
6. `FILT-KEYWORD-IDENTITY`: use distinct same-print-name symbols and prove keyword
   membership uses identity.
7. `FILT-SUBJECT-CASE`: compare mixed-case canonical and real subjects; prove exact
   and ordinary substring paths are case-insensitive while retaining their distinct
   canonical/real-subject inputs.
8. `FILT-HEADER-RECURSION`: search a nested cons-valued header and prove any matching
   leaf succeeds.
9. `FILT-ADDRESS-MATRIX`: test plain, `@`, `!`, `%`, prefix, suffix, substring,
   original-string FSM, and interval FSM keys with mixed case.
10. `FILT-DATE-BOUNDARIES`: test one second before, exactly at, and one second after
    Before/After thresholds and both ends of the On half-open interval.
11. `FILT-EXPIRATION-BOUNDARIES`: test missing, scalar, list, equality, and one-second-
    later expiration values.
12. `FILT-CHILD-REDEFINE`: redefine a named child filter and prove an existing parent
    sees the new function without parent recompilation.

### Universe tests

13. `UNI-GRAMMAR-TABLE`: enumerate strings, three built-ins, defined/undefined
    symbols, singleton lists, every operator arity, arbitrary atoms, and unknown
    operators against the exact accept/reject table.
14. `UNI-OPERATOR-OCTETS`: round-trip the three one-character operator print names in
    the selected source encoding and verify octets `05`, `12`, and `13`.
15. `UNI-EMPTY-SETS`: prove empty Union is empty and empty Intersection derives from
    the complete current sequence list.
16. `UNI-ZERO-NOT`: prove the shallow check accepts the singleton operator form and
    expansion subsequently fails without claiming atomic restoration.
17. `UNI-DEFINITION-ORDER`: reference an undefined child, then define it first and
    retry; prove registry mutation begins only after the runtime dependency check.
18. `UNI-PARTIAL-INSTALL`: inject a failure after name/description installation but
    before expanded-object installation; observe the partial properties.
19. `UNI-CHILD-REDEFINE`: define parent from child, redefine child, and prove the old
    parent retains its captured object until parent redefinition.
20. `UNI-LAZY-FILE`: define from a synthetic file-name string and prove no load occurs
    until preparation.
21. `UNI-UNION-ORDER`: use overlapping child sequences and prove source child order
    plus from-end duplicate elimination.
22. `UNI-INTERSECTION-ORDER`: use unequal child sizes and prove the child list is
    reordered smallest-first and output follows that child.
23. `UNI-NOT-DOMAIN`: include a collection and loaded buffers; prove complement scans
    loaded mail buffers rather than treating the collection as an independent domain.
24. `UNI-REBUILD-FAILURE`: fail after one element is appended; prove partial cache,
    stale composite tick, and retry on the next prepare.
25. `UNI-MAP-RANGE`: exercise forward/reverse start/end boundaries and a failing
    callback; prove visit order and lack of rollback.

### Profile and option tests

26. `PROFILE-OPTION-DENOMINATOR`: parse the five selected files without evaluating
    them; require 81 textual forms, 80 active, one block-commented, with names, types,
    and defaults identical to the inventory above.
27. `PROFILE-RESTRICTIONS`: require exactly six active source-local `:NEVER` options;
    prove the two GMSGS and inactive COMSAT restrictions do not execute.
28. `PROFILE-DANGER-VISIBILITY`: exhaust `:ALL`, `:SELECTIVE` with/without Map Over,
    and `:NONE`; compare the exact dependent-pane visibility.
29. `PROFILE-DANGER-REGISTER`: add a disposable dangerous command and prove menu sort,
    selected/default update, and pane reconstruction order.
30. `PROFILE-DONT-DIFF`: vary site default and visible list under concurrent site
    update; prove lock-serialized additions, deletions, and merged value.
31. `PROFILE-RENAME`: rename a synthetic mail file and compare exactly the eight
    marked option/association surfaces and one-time changed notification.
32. `PROFILE-CALENDAR-EXIT`: change week-start and leave normally and abnormally;
    prove calendar recomputation occurs during cleanup in both cases.
33. `PROFILE-DEFINITION-PREFLIGHT`: include one unrecoverable newly active definition;
    prove no old definition sections are deleted.
34. `PROFILE-LATE-CANCEL`: approve cleanup for one removed definition and reject a
    later dependency prompt; prove the first cleanup can remain.
35. `PROFILE-SAVE-MATRIX`: execute Insert, Save, Compile, Reap, and save-all with all
    prompt branches; compare generated text, disk state, load calls, and ticks.
36. `PROFILE-CACHE-IDENTITY`: test missing, character, wrong-source, older, and
    matching compiled Profile files against compile-tick state.

## Preserved-world oracle backlog

- `TODO-RUNTIME-G85-FILTER`: in an isolated Genera harness session, create synthetic
  messages covering mixed-case subject/address and date boundaries; compare Filter
  pane results with tests 7–11 and capture a reviewed, minimal pane screenshot.
- `TODO-RUNTIME-G85-UNIVERSE`: define three disposable universes, exercise empty and
  overlapping set cases, inspect ordering, then remove the definitions without
  saving the licensed world.
- `TODO-RUNTIME-G85-PROFILE`: use a disposable private Profile pathname to exercise the
  visibility and Save-mode matrix. Record prompt order and verify that the base world
  and any real user Profile remain unchanged.
- `TODO-RUNTIME-G85-SOURCE-MATCH`: inspect resident function identities or controlled
  behavior probes sufficient to establish which S452 definitions are present in the
  Genera 8.5 world. Source presence alone does not close this claim.

No screenshot specific to the Filter, Universe, or Profile visible states is
published with this semantic companion yet. The work requires a synthetic Profile
and rights-reviewed capture that reveals no user addresses, pathnames, messages, or
licensed Help text. Until that oracle is run, this page makes source-visible semantic
claims only and does not guess at exact pane pixels.

## Nonclaims and implementation cautions

- The option table is complete for the five named files and macro spelling, not for
  every site option, hardcopy option, mail-file option, or patched runtime addition.
- A source type descriptor does not prove every rejection, coercion, or display
  detail of the external choose-variable-values implementation.
- Executable Profile and filter forms are a compatibility and security boundary. A
  sandboxed declarative replacement is sensible, but it is a selectable divergence.
- The three universe operator octets establish the preserved source representation;
  they do not by themselves establish Unicode code points or a modern interchange
  encoding.
- Named filter redefinition is late-bound; named universe composition is object-
  captured at definition time. Treating both as the same kind of symbolic query is
  incompatible.
- None of these source-level findings proves that a Save World occurred or that the
  preserved runtime would retain disposable test state after shutdown.

## Sources and verification

- Licensed local Symbolics System 452.1 / Zmail 442.0 source files listed in the
  artifact table; inspected 2026-07-19. The source files remain untracked.
- Symbolics, [*Editing and Mail*, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  for the supported user-facing Zmail and Profile context; source behavior above is
  not inferred from the manual.
- [Zmail and mail composition in Symbolics Genera](zmail.md), for the broader source,
  manual, runtime, and rights boundary.
- [Zmail commands and bindings](zmail-commands-and-bindings.md), for the normative
  application-owned input tree around the three task frames.

Last verified: 2026-07-19.
