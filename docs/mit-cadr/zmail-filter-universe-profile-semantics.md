---
type: Reimplementation Specification
title: ZMail filters, universes, and Profile semantics
description: Source-bounded semantic contract for maintained System 303 ZMail filters, universe set expressions, Profile persistence, and all 69 selected user-option declarations.
tags: [mit-cadr, lm-3, zmail, filters, universes, profile, reimplementation, source-code]
timestamp: 2026-07-19T18:44:32-04:00
---

# ZMail filters, universes, and Profile semantics

## Reconstruction claim

For the maintained LM-3 **System 303 source profile** pinned below, an
implementation can reproduce the source-visible semantics of:

- named and editable message filters, including the constructor-generated form
  subset, search-key dispatch, header and address matching, date boundaries,
  compilation, and definition recovery;
- named and editable universes, including the exact serialized grammar, set
  operations, mapping order, late binding, and historical validation defects;
- the executable ZMail Profile source document, generated option block, optional
  compiled cache, and separately selected filter/universe definition sections; and
- the complete denominator of **69 textual `DEFINE-ZMAIL-USER-OPTION` forms** in
  the selected `zmail/defs.lisp`, with exact source name, type, default,
  applicability, persistence class, and Profile-update behavior.

This page is a normative System 303 companion to the broader
[ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md)
and the [MIT CADR ZMail dossier](zmail.md). The broader specification controls
application lifecycle, layouts, commands, mail files, composition, and transport.
This page controls the narrower Filter, Universe, Profile, and selected-option
contracts.

The claim is deliberately source-bounded. The tested `System 303-0` load band
advertised Mail but did not contain a resident `ZWEI:ZMAIL-FRAME`; loading stopped
at an unsited file-host dependency. Therefore this page does **not** claim that the
maintained source was the exact code compiled into that band, that a historical site
used these defaults, or that the visible Filter, Universe, and Profile panes have
been exercised in the preserved runtime.

The compatibility boundary is source-visible C303 behavior. This specification does
not reserve or imply compiled-band, exact historical-release, or pixel compatibility.

## Normative language and evidence classes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are reconstruction requirements. A
**strict C303 profile** preserves the pinned source's ordering, executable-input
boundary, and defects. An implementation that rejects arbitrary Lisp, makes edits
transactional, fixes the `(ALL)` or reverse-map defects, or normalizes malformed
forms MUST identify itself as a safer or corrected profile.

| Code | Evidence class | What it establishes |
| --- | --- | --- |
| `C303-F` | public maintained source | filter construction, predicates, definition recovery, universe grammar, expansion, and mapping |
| `C303-P` | public maintained source | Profile pane lifecycle, source editing, named-definition selection, Save/Compile/Reset order |
| `C303-D` | public maintained source | ZMail object helpers, all 69 declarations, restrictions, header families, and option registration hooks |
| `C303-CVV` | public maintained source | generic user-option registration, reset, pruning, and `LOGIN-SETQ` serialization |
| `C303-CMD` | public maintained source | option-to-command-documentation associations and their concrete update effects |
| `C303-CASE` | public maintained source | ordinary `STRING-SEARCH` and `STRING-EQUAL` ignore alphabetic case unless explicitly told otherwise |
| `C303-RUN-BLOCKED` | runtime observation | the tested band exposed the Mail launcher but could not load the ZMail system in the isolated unsited session |

The maintained LM-3 Fossil branch is a restoration source profile, not a claim that
its 2020s check-in date is the historical authorship or release date.

## Release and artifact profile

The normative public source check-in is
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
Paths in this table are relative to that System checkout.

| Evidence | Public source | Bytes | SHA-256 | Principal spans |
| --- | --- | ---: | --- | --- |
| `C303-F` | [`zmail/filter.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ffilter.lisp) | 92,892 | `97e7dd830fd71d621b6aca7517e1cd5e1f138c741d64c57a152cdb202e788a31` | 585–845, 847–1312, 1710–2089 |
| `C303-P` | [`zmail/profil.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fprofil.lisp) | 45,394 | `be6d2632a8fbb82e8244714939824921031e84c27c18fc2811ba472a7c14d0c3` | 5–503, 718–1051 |
| `C303-D` | [`zmail/defs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fdefs.lisp) | 49,882 | `6f0b1401d0e48f049671088286685311f38e72a623f94ce242fa8df05431b00e` | 196–215, 285–384, 880–957, 945–1161 |
| `C303-P`, mail | [`zmail/mail.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmail.lisp) | 83,733 | `9bcf41074afa3524fee48f5b61af130a0115223c447db778f12b79ef138b7705` | 5–18, 557–603, 1802–1841 |
| `C303-CMD` | [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp) | 114,870 | `9a9e0d68cc3a3bbc358aa48ff407feaaba406bd717ec61d6d32681297d75ea93` | 235–247, 277–360, 1170–1332, 1724–1735 |
| `C303-CMD` | [`zmail/window.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fwindow.lisp) | 41,968 | `df732df25f9da4aeded86dedec7c5adeebc7e40882d293c9e7337249c627db6e` | 240–275, 454–467, 725–732 |
| `C303-CVV` | [`window/choice.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fchoice.lisp) | 84,440 | `866900e06a7f55855d84df71dbbb77c07040a4db586cba39e665c93f945f6dbd` | 1747–1834, 1933–1955 |
| `C303-CASE` | [`sys2/string.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys2%2Fstring.lisp) | 49,754 | `070c8f058bca3410ba5871ac1dbf00cb53d0d01b077111925d1fd314c29b12a5` | 358–463, 797–838 |

The files, sizes, and hashes were rechecked with GNU `stat` and `sha256sum` on
2026-07-19. The source links pin content rather than a moving branch name.

## Compatibility levels

| Level | Contract | Status |
| --- | --- | --- |
| `C303-FUP-L1` | objects, serialized grammars, predicate and set semantics | specified from public maintained source |
| `C303-FUP-L2` | exact mutation, abort, definition, mapping, and persistence order | specified from public maintained source |
| `C303-FUP-L3` | exact selected 69-option metadata denominator and update associations | specified from public maintained source |
| `C303-FUP-L4` | behavioral match to a runnable System 303 ZMail | reserved pending the runtime oracles below |
| `C303-FUP-L5` | exact historical release, QFASL, saved-band, or pixel compatibility | out of scope and unclaimed |

Levels are cumulative. Source-derived tests alone do not establish `C303-FUP-L4`.

## User-interface substrate

Filter, Universe, and Profile are implemented as ZWEI editor closures embedded in
TV constraint frames and panes. Their controls are TV button, menu, choose-variable-
values, mode-line, and editor-window flavors; command input is dispatched through
the ZMail/ZWEI command loops. This selected source has no CLIM system dependency,
application-frame definition, presentation translator, port, or CLIM protocol use.
A reconstruction MUST classify this as **TV + ZWEI**, not CLIM and not Genera
Dynamic Windows.

## Object and ownership model

### Filter definition

A named filter has separately mutable runtime parts (`C303-F`):

```text
FilterDefinition {
  name-symbol
  optional menu documentation
  USER-FILTER-ALIST entry
  FILTER-FUNCTION property
  optional EXPR-FILTER-FUNCTION property saved immediately before compilation
}
```

The Profile source section is a separate persistence representation. Evaluating a
definition mutates the runtime entry and function; saving options does not add that
definition to the Profile source.

### Universe definition

A named universe has only two registered parts in this profile:

```text
UniverseDefinition {
  name-symbol in ordered UNIVERSE-LIST
  serialized expression in the symbol's UNIVERSE property
}
```

There is no expanded-object property and no universe cache. Every mapping request
re-expands the current serialized expression, so named dependencies are late-bound.

### Profile document

The Profile is executable Lisp source, not a passive preferences file (`C303-P`).
Its editor buffer owns:

- source pathname, file identity, package/readtable/base attributes, and save tick;
- an option-variable tick and a separate editor-variable tick;
- a generated leading run of non-default `LOGIN-SETQ` forms;
- arbitrary user-authored Lisp outside that generated run;
- selected `DEFINE-FILTER` and `DEFINE-UNIVERSE` sections; and
- an optional compiled init file tracked by a compile tick.

The option block and named-definition sections are maintained by different paths.
Neither is an atomic snapshot of all runtime ZMail state.

## Filter definition language

### Outer form and executable boundary

The persisted form grammar is (`C303-F`):

```text
filter-definition := (DEFINE-FILTER name-symbol (message-variable)
                       [documentation-string]
                       body-form*)
```

`body-form*` is unrestricted Lisp. It can read global state, call arbitrary
functions, mutate objects, or signal. A strict profile therefore evaluates trusted
Profile code with the historical authority. A declarative clone MAY reject general
Lisp, but MUST call that a compatibility divergence.

The macro always gives the generated property function auxiliary variables named
`STATUS` and `KEYWORDS`. On every call, before the user body, it parses the message
and extracts the parsed keyword list. Unlike the Genera 8.5 profile, this work is not
conditional on free references in the body.

An empty `body-form*` has an unexpected result: the generated setup assignment is
the function's last form, so the filter returns the message's keyword list. It is
therefore true exactly when that returned list is non-null. The new-filter editor
initially contains an empty body; completing it without adding a clause is **not** a
constant-false filter in this source profile.

### Constructor-generated subset

The Filter frame's panes synthesize the following exact subset (`C303-F`):

| UI operation | Inserted semantics |
| --- | --- |
| Not, And, Or | open an ordinary `NOT`, `AND`, or `OR` form and leave point inside it |
| Close | move out over the next containing list using the standalone editor command |
| Any keyword | return the parsed `KEYWORDS` list itself |
| one keyword | identity-membership of the selected keyword symbol in `KEYWORDS` |
| Deleted, Unseen, Recent, Answered, Filed | property lookup on parsed `STATUS` |
| Search | full-message literal/FSM/FSM-expression search selected from an extended key |
| To | address-aware search of only `:TO` |
| To/Cc | address-aware search of the complete recipient-header family |
| From | address-aware search of only `:FROM` |
| Subject | recursive string search of `:SUBJECT` |
| Other | recursive or address-aware search of a selected header name |
| empty header key | non-null property test for that header; no search call |
| Before, On, After | absolute or execution-relative comparison against parsed `:DATE` |
| named user filter | call the named filter through `MSG-FITS-FILTER-P` |

The recipient-header family is exactly `:TO`, `:CC`, `:BCC`,
`:REDISTRIBUTED-TO`, `:FORWARDED-TO-TO`, `:FORWARDED-TO-CC`,
`:REDISTRIBUTED-TO-CC`, `:REMAILED-TO`, `:RESENT-TO`, and `:RESENT-CC`.
The constructor's From choice does not expand to all sender-type headers.

### Completion, compilation, and failure order

Done and Sample share this sequence (`C303-F`):

1. Reset the editor input stream to the interval start and read exactly one Lisp
   object with the special search-string readtable. A trailing object is ignored.
2. Evaluate that object.
3. Require the returned object to be a property function name whose first element
   is `:PROPERTY` and third element is `FILTER-FUNCTION`.
4. Take its second element as the filter name.
5. Copy the current `FILTER-FUNCTION` property to `EXPR-FILTER-FUNCTION`.
6. Compile the property function.
7. If compiler output left the typeout window incomplete, ask whether the result is
   acceptable. Declining aborts the current command.
8. Return the filter name. Done exits; Sample then surveys the selected universe.

Evaluation precedes result validation, expression capture, compilation, and warning
acceptance. The definition macro updates or appends the menu entry before defining
the property function. Thus arbitrary evaluation effects, a menu entry, a source
function, and the saved expression can exist after a wrong-result, compile, warning,
or Sample failure. There is no rollback.

The read helper catches reader errors without replacing the initial EOF sentinel;
both true EOF and a caught error consequently become the same “unbalanced
parentheses” failure. This does not erase effects of a form that was read and then
evaluated successfully.

### Names, redefinition, and recovery

Filter names are symbols interned in the task's current package. Left-clicking Name
reads a new string and rewrites the symbol in the editor form. Every non-left button
path opens the existing-definition menu; cancellation aborts the command. The pane
documentation mentions only a right-click menu, but the executable branch controls
strict compatibility.

Defining a new name appends its menu item. Redefining an existing name replaces the
item's tail in place and retains its position. Calling a named filter looks up its
current `FILTER-FUNCTION` property on every call, so a parent sees a later child
redefinition without recompilation. An absent property signals “not the name of a
filter.”

Definition recovery first inspects `FILTER-FUNCTION`; if that value is atomic it
falls back to `EXPR-FILTER-FUNCTION`. It accepts only a recognizable non-atomic
`NAMED-LAMBDA` whose property name identifies the requested filter. It reconstructs
the argument from the lambda list and takes the body tail after the generated setup
form. Otherwise it reports the filter as compiled. This recovers an equivalent
generated form, not author formatting. The optional documentation was removed
before generating the function and is not recovered, so a Profile round-trip through
this accessor loses that documentation string.

## Predicate contract

### Built-in truth and status predicates

The predicate protocol takes `(message, argument)`. Mapping calls the processing
function only when the predicate returns non-null. Opposite predicates are separate
functions, not a generic wrapper.

- Any-keyword and one-keyword predicates read the message keyword property; one-
  keyword membership uses symbol identity.
- Attribute predicates test a named message property. The five constructor status
  names are Deleted, Unseen, Recent, Answered, and Filed.
- True and false predicates return canonical `T` and `NIL`.
- Named-filter predicates dynamically resolve the current property function and
  canonicalize success with a non-null test. The negative form applies `NOT` to the
  child result.
- The direct Subject predicate accepts a scalar subject string or a list of subject
  strings and succeeds when any contains the key.
- Direct From, Recipient, and Sender-or-Recipient predicates parse the message and
  apply the same address matcher described below.

### Search keys, coercion, and case

Filter source embeds either an ordinary string or an `ART-16B` extended-search
object (`C303-F`, `C303-CASE`):

1. An ordinary string selects literal `SEARCH` for message intervals.
2. An object whose array type is exactly `ART-16B` is parsed into `SEARCH`,
   `FSM-SEARCH`, or `FSM-EXPR-SEARCH` plus a transformed key.
3. Any other object is rejected as an invalid search key. Because `ARRAY-TYPE` is
   called before the final rejection, a non-array can first signal its own type
   error.

Full-message search supports all three parser results. Header search maps literal
search to `STRING-SEARCH` and finite-state search to `FSM-STRING-SEARCH`, but has no
mapping for `FSM-EXPR-SEARCH`; the generated header form consequently has an invalid
callee. Address-header search likewise has no defined FSM-expression branch and can
fail while inspecting the transformed key. A strict C303 profile preserves this
header/full-message asymmetry.

Ordinary `STRING-SEARCH` and `STRING-EQUAL` are case-insensitive for letters because
their default “consider case” input is null. Literal subject/header and full address
comparisons therefore ignore alphabetic case. FSM case behavior is determined by
the extended-search compiler and MUST NOT be inferred from `STRING-SEARCH`.

An empty constructor key is converted to a header-presence test before search macro
expansion. A handwritten empty address-search key can fail when the macro indexes
its first and last characters.

### Header and address matching

Non-address headers may be a string or a list. Literal and FSM string search succeeds
if any list element matches. A missing property is false.

Address properties are lists of parsed recipient records (`C303-F`):

- An FSM key searches only a record's `:INTERVAL` bounds. A record with no interval
  is skipped; no original-string fallback exists in this profile.
- A literal key surrounded by the source's byte `0x18` and byte `0x19` delimiters
  has those delimiters stripped and performs case-insensitive substring search in
  each record's `:NAME`.
- Every other literal key is a full mailbox match. If it contains `@`, the entire
  record `:NAME` must equal the key prefix and the first element of the record's
  `:HOST` list must equal the key suffix. Without `@`, the entire `:NAME` must equal
  the entire key.

There is no bang-path or percent-route normalization, true-name fallback, suffix-
only mode, prefix-only mode, or personal-name comparison in the selected matcher.
Host comparison uses only the first parsed host. Equality and partial substring
comparison ignore alphabetic case.

### Date semantics

The constructor first parses the entered date while requesting an interpretation
not in the future. If the parser calls it relative, the user is asked whether it
should remain relative to filter execution time. Declining converts the parsed
instant to a fixed printed date/time. A zero-hours/minutes/seconds result omits the
time; otherwise the generated source retains hours and minutes and retains seconds
when nonzero (`C303-F`).

All comparisons use parsed `STATUS` property `:DATE`; a missing date is false.

| Predicate | Boundary |
| --- | --- |
| On absolute | `threshold <= message-date < threshold + 86,400 seconds` |
| Before absolute | `message-date < threshold` |
| After absolute | `message-date >= threshold` |
| On relative | the same half-open 86,400-second interval, with its threshold recomputed from current universal time on each call |
| Before/After relative | the same strict/inclusive comparisons against that recomputed threshold |

“On” is an interval anchored at the parsed threshold, not forcibly at civil
midnight. A handwritten relative macro whose date is parsed as absolute computes a
moving offset from its separately supplied `NOW` string; the constructor normally
uses the relative macro only after the parser reported a relative date.

## Universe description language

### Serialized grammar and operator octets

The intended surface language is:

```text
universe-definition := (DEFINE-UNIVERSE name-symbol () expression)

expression := NIL
            | file-name-string
            | pathname-object                 ; validator only; evaluator defect below
            | PRIMARY
            | CURRENT
            | defined-name-symbol
            | (any-symbol)                    ; shallow singleton escape
            | (not-operator expression)
            | (intersection-operator expression*)
            | (union-operator expression*)
```

The source operator print names are one-byte characters, not portable ASCII words:

| UI label | Source octet | Required semantic role |
| --- | ---: | --- |
| Not | `0x05` | complement |
| Intersection | `0x12` | set intersection |
| Union | `0x13` | set union |

A portable reimplementation MAY serialize named ASCII or Unicode tokens, but an
importer for the C303 source profile MUST map these exact octets without guessing
their modern glyph identities.

### Exact validator behavior

Validation order is observable (`C303-F`):

1. accept strings, pathname objects, `NIL`, `PRIMARY`, and `CURRENT`;
2. accept a symbol only when its current `UNIVERSE` property is non-null;
3. reject every other atom;
4. accept **any singleton list whose sole element is a symbol** without validating
   that symbol;
5. for Not, require exactly one operand but do not recursively validate it;
6. reject any other non-singleton operator except Intersection and Union;
7. recursively validate all Intersection/Union children. Empty forms are accepted.

Consequences include accepted `(UNDEFINED)`, accepted `(not-operator)` because it is
intercepted by the singleton rule, and accepted Not forms with an invalid nested
operand. Atomic `ALL` is not accepted by the validator. Forward references are
rejected when written atomically but pass through the singleton escape.

The Universe editor initializes a new buffer with only
`(DEFINE-UNIVERSE new-name ())`, omitting the required expansion argument. Done on
that untouched form fails macro argument checking. The user must insert a component
or edit the form.

### Definition and completion order

`DEFINE-UNIVERSE` runs the validator during macro expansion. If validation fails,
the generated registration code is not run. On success, evaluation:

1. appends a new name to `UNIVERSE-LIST` if it is not already present; then
2. replaces the symbol's `UNIVERSE` description property.

Redefinition retains the name's list position. These two writes are not wrapped in a
transaction. There is no eager expansion or cache installation.

Universe Done reads one form with the same reader helper and directly evaluates it.
Unlike Filter Done, it performs no result-shape check and no compile step. An
arbitrary form can have effects and its return value becomes the task result. A
valid definition normally returns the result of its final property write.

Name selection has the same left-versus-non-left behavior as Filter. Selecting an
existing name reconstructs its current property in a `DEFINE-UNIVERSE` form; an
absent property is represented as `NIL` rather than diagnosed by that accessor.

### Expansion semantics and source defects

Every `MAP-OVER-DEFINED-UNIVERSE` call expands the current description afresh:

| Expression | Expansion |
| --- | --- |
| `NIL` | `NIL`, which later mapping code cannot treat as a buffer |
| `PRIMARY` | current primary ZMail buffer |
| `CURRENT` | current selected ZMail buffer |
| runtime-only atomic `ALL` | empty-arity Intersection, meaning union of all currently known buffers |
| other symbol | recursively expand its current `UNIVERSE` property; an undefined property becomes `NIL` |
| string | resolve or visit the named mail file with creation/loading enabled |
| Not | expand operand, then build a temporary complement |
| Union | expand children, then build a temporary union |
| Intersection | expand children, then build a temporary intersection |
| singleton list | recursively expand the current property of its sole symbol |

Two mismatches are normative defects of the strict source profile:

1. The validator accepts pathname objects, but the evaluator has no pathname branch
   and next applies list access to the object. A normal pathname object therefore
   reaches a type failure rather than the string file-resolution path.
2. The visible Universe menu adds an **All** item and wraps every item selected from
   that menu in a singleton list. It therefore inserts `(ALL)`, which uses named-
   symbol property lookup and normally expands to `NIL`; it does not reach the
   runtime-only atomic `ALL` branch. A corrected clone may map this item to true All,
   but cannot call that exact C303 behavior without a compatibility switch.

Undefined names and cycles are not detected explicitly during expansion. Undefined
names collapse to `NIL` and fail when a caller expects a buffer. Cycles recurse
without a source-defined cycle guard.

### Set membership, order, and loading

All set membership is message-object identity membership (`C303-F`, `C303-D`).
Temporary set-result buffers are newly allocated and are not automatically appended
to `ZMAIL-BUFFER-LIST`.

- **Not** scans `ZMAIL-BUFFER-LIST` in list order, considers disk buffers only, and
  visits each buffer's currently active messages. It emits each message absent from
  the operand, preserving that scan order. It does not first force files fully
  loaded.
- **Union** sorts the newly constructed child-buffer list by descending active
  message count. It emits each child's messages in buffer order and suppresses later
  identity duplicates. Equal-size child order depends on the historical sort and is
  not strengthened here.
- **Intersection** with children sorts them by ascending active message count, scans
  the first/smallest in its order, and emits messages present by identity in every
  remaining child. An empty Intersection delegates to Union over the complete
  current `ZMAIL-BUFFER-LIST`; this can include both disk and temporary buffers and
  deduplicates overlapping messages.
- **Empty Union** creates an empty temporary buffer.

Because expansion sorts and scans concrete buffers immediately, a `NIL` child can
fail in message-count or buffer-array access. Any file visits and temporary buffers
created before that failure remain ordinary side effects; there is no rollback.

### Standard map functions

The source also defines exact mapping domains used with filters:

| Mapper | Order and loading contract |
| --- | --- |
| one message | test that object once |
| one buffer | forward over its current active array; no forced load |
| rest of buffer | start after the current message when it is the current buffer, otherwise at zero; request one next message whenever the index reaches the initially active length, stopping when the buffer refuses |
| beginning of buffer | reverse traversal; strict defect below |
| loaded buffers | in `ZMAIL-BUFFER-LIST` order, disk buffers only; force each fully loaded before forward mapping |
| all buffers | map loaded buffers first, then resolve string/pathname entries returned by the buffer-alist provider, force them fully loaded, and map them |
| defined universe | re-expand the named expression, then forward-map the resulting concrete buffer |

The beginning-of-buffer mapper ignores its argument's array and always binds the
array from the **current** ZMail buffer. If the argument is the current buffer it
starts before the current message; otherwise it scans the current buffer's entire
active array backward. A corrected implementation should fix this, but a strict
C303 compatibility test must expose it.

Callbacks are invoked in visit order only for matching messages. A callback failure
or nonlocal exit aborts traversal with no transactional undo of prior callback
effects or file loads.

## Profile persistence contract

### Entering and reading Profile

Profile selects the current user, initializes its editor closure on first use,
locks background processing, switches to the Profile window configuration, and
visits the init source (`C303-P`). If an already visited file differs from the file
computer's version, the user can choose the new version. A missing file creates a
Lisp-mode source header and immediately inserts current non-default options.

When the init pathname names a compiled file, Profile reads its recorded source
identity, opens the newest corresponding source file for editing, and compares
source identity and creation dates. A missing compiled file, different recorded
source, or newer source marks the compile tick stale. The editable buffer pathname
always denotes text even while the ordinary init pathname denotes the compiled file.

The source is read in its declared package/readtable/base. Older files missing
readtable or base attributes are assigned Zetalisp syntax and decimal base as
buffer-attribute updates.

### Generated `LOGIN-SETQ` run

`INSERT-CHANGED-VARIABLES` runs only when forced, or when the option-variable tick
is newer than the editor-variable tick; `:ASK` additionally requests confirmation.
It then (`C303-P`, `C303-CVV`):

1. ensures the existing buffer ends at a line boundary;
2. examines top-level forms beginning at the start of the source;
3. removes the first leading contiguous run whose forms begin with
   `(LOGIN-SETQ`; if the first top-level form is different, it inserts before it;
4. writes non-default ZMail options, then non-default ZMail hardcopy options;
5. writes a newline, requests text redisplay, and advances the editor-variable tick.

The scan does not search for or own arbitrary later `LOGIN-SETQ` forms. Conversely,
user-authored material placed inside the leading generated run's deletion interval
is not protected. A reimplementation MUST delimit ownership equivalently for strict
compatibility or use an explicit safer block marker in a different profile.

### Option serialization

Every selected option is registered in one alist by pushing at declaration time;
therefore the unpatched baseline serializes the 69 options in reverse declaration
order. Redeclaring an option removes its prior entry and pushes the new one. The
declaration records a `DEFAULT-VALUE` property before `DEFVAR`; reevaluating a
declaration updates metadata/default while preserving an already bound current
value (`C303-CVV`).

Only values unequal to their recorded defaults are written. The comparison binds
alphabetic-case-sensitive string comparison. Each value becomes one
`LOGIN-SETQ` form:

- numbers, `T`, and `NIL` are emitted directly;
- `:HOST-OR-NIL` host objects are reconstructed by name through `SI:PARSE-HOST`,
  and string/symbol host designators are quoted inside that parse call; and
- every other nontrivial value is quoted.

Reset-to-default iterates the registered alist and assigns every variable its
`DEFAULT-VALUE`. Restriction metadata affects Profile visibility only; hidden values
remain registered, resettable, and serializable.

### Save, compile, Reset, Defaults, and Edit

| Profile action | Ordered effects |
| --- | --- |
| left/keyboard Save | optionally ask to insert changed variables; save source; if a compiled profile exists and its tick differs, ask whether to recompile |
| right-menu Save file | save current text without first inserting changed variables |
| right-menu Insert changes | regenerate option forms without saving |
| middle / Make init compiled | if not compiled, choose a distinct source pathname, rename the editor buffer, mark source and compile state stale; then save if needed, compile to the ordinary init pathname, load it, and record the compile tick |
| Recompile file | fail if the profile is not already compiled; otherwise save if needed, compile, load, then record the compile tick |
| Reap file | offer old source versions and, when compiled, old ordinary-init versions for deletion |
| Reset | assign all defaults, then load the ordinary init file, recompute compiled/source match, refresh choices and all associated command documentation, advance the variable tick, and optionally revert or regenerate a modified source buffer |
| Defaults | assign all defaults, mark the profile uncompiled, refresh choices/documentation, advance the variable tick, and optionally regenerate a modified source buffer |
| Edit | first regenerate changed settings without asking; run the standalone source editor; sectionize; reset all options; evaluate the whole edited source; refresh choices/documentation; then synchronize both option ticks |

Declining insertion during save-all does not cancel the subsequent source save. An
error during Reset after defaults were assigned, during edited-source evaluation
after some forms ran, or during compile after saving is not rolled back. The compile
tick advances only after compiler output is loaded successfully.

### Named filter and universe sections

The Filters and Universes Profile buttons choose which registered runtime
definitions are represented in the source (`C303-P`):

1. Section metadata identifies symbols already associated with this Profile buffer.
2. A multiple-choice menu selects the desired set and may launch a new-definition
   task.
3. Existing sections excluded from the result are deleted one by one.
4. Newly selected names are appended at end of file, one reconstructed definition
   per section, in selected order.
5. The buffer is redisplayed and resectionized.

Unlike the later Genera implementation, this source performs no preflight recovery
of every addition before deletion. A recovery or insertion failure after removals
can leave Profile text partially rewritten. Removing a section does not remove its
runtime menu/property definition. Adding a filter can fail because its compiled
shape is not recoverable; adding a universe can serialize an undefined property as
`NIL`.

The four hidden association options are edited by dedicated Profile menus. Their
setters mutate alists and advance the Profile variable tick. They do not invoke the
generic command-documentation callback at that moment, even for options that have a
documentation association; Reset and Edit later call the global refresh path.

## Complete 69-option metadata contract

### Inventory rules and codes

This denominator is exactly the active textual forms matching
`DEFINE-ZMAIL-USER-OPTION` in pinned `zmail/defs.lisp`. It excludes the separately
declared site-alist option `*MAIL-SENDING-MODE*`, the hardcopy option alist, patch
files, backup revisions, and globals that are not registered by this macro.

The Type values are choose-variable-values descriptors, not Common Lisp type
declarations. Lowercase source spellings in rows 9, 41, 52, and 68 read as the same
uppercase symbol names under the selected readtable; spelling is retained to make a
textual audit reproducible.

Applicability codes are:

- `CVV`: ordinary Profile choice;
- `SPECIAL (:NEVER)`: hidden from the generic pane and edited by a dedicated path;
- `CVV if GMSGS`: shown only when site option `:GMSGS` is non-null; and
- `CVV if COMSAT`: shown only when site option `:COMSAT` is non-null.

All 69 rows have persistence code `ND`: registered, resettable, and emitted as
`LOGIN-SETQ` only when non-default, even when hidden by a restriction. Update codes:

- `tick`: a direct CVV edit changes the variable and Profile variable tick only;
- `summary`: also rebuild command/label documentation and, on an explicit Profile
  edit, ask once whether to recompute already cached summary lines in disk buffers;
- `*-doc`: recompute the named pointer/command documentation;
- `special`: dedicated-menu mutation and tick, with no immediate generic
  documentation callback;
- `alias`: establish the legacy forwarded value cell noted after the declaration;
  and
- `declared-only`: the selected source explicitly says the option is unimplemented
  and contains no consumer outside its declaration.

### Exact inventory

| # | Option source spelling | Type | Default source → value | Purpose | Applicability | Persist | Update |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `*OTHER-MAIL-FILE-NAMES*` | `:PATHNAME-LIST` | `NIL` | remembered non-primary mail files | SPECIAL (`:NEVER`) | ND | special |
| 2 | `*FILTER-KEYWORDS-ALIST*` | `:SEXP` | `NIL` | filter-to-keyword associations | SPECIAL (`:NEVER`) | ND | special; keyword docs refresh only on global refresh |
| 3 | `*FILTER-MOVE-MAIL-FILE-ALIST*` | `:SEXP` | `NIL` | filter-to-move-file associations | SPECIAL (`:NEVER`) | ND | special; Move docs refresh only on global refresh |
| 4 | `*FILTER-REFERENCE-UNIVERSE-ALIST*` | `:SEXP` | `NIL` | filter-to-universe associations | SPECIAL (`:NEVER`) | ND | special |
| 5 | `*FILTER-SUMMARY-WINDOW-FRACTION*` | `:NUMBER-OR-NIL` | `NIL` | Summary fraction in filter layout | CVV | ND | tick |
| 6 | `*SUMMARY-WINDOW-FRACTION*` | `:NUMBER` | `0.45s0` → short float `0.45` | ordinary Summary pane fraction | CVV | ND | tick |
| 7 | `*SUMMARY-SCROLL-FRACTION*` | `:NUMBER` | `0.2s0` → short float `0.2` | Summary scrolling increment | CVV | ND | tick |
| 8 | `*NEW-MAIL-FILE-APPEND-P*` | `:MENU-ALIST` | `:STICKY` | append/prepend policy for new mail files | CVV | ND | tick |
| 9 | `*default-mail-buffer-generation-retention-count*` | `:NUMBER-OR-NIL` | `nil` | generation retention for new mail files | CVV | ND | tick |
| 10 | `*DEFAULT-SUMMARY-TEMPLATE*` | `:SEXP` | `T` | default Summary display format | CVV | ND | summary; alias |
| 11 | `*GMSGS-OTHER-SWITCHES*` | `:STRING` | `"//Z"` | extra switches supplied to GMSGS | CVV if GMSGS | ND | tick |
| 12 | `*RUN-GMSGS-P*` | `:ASSOC` | `:NO` | whether/when to run GMSGS before inbox retrieval | CVV if GMSGS | ND | tick |
| 13 | `*MAIL-FILE-FOR-DRAFTS*` | `:PATHNAME-OR-NIL` | `NIL` | mail file used to store drafts | CVV | ND | tick |
| 14 | `*DEFAULT-DRAFT-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | default file for saving a draft | CVV | ND | tick |
| 15 | `*DEFAULT-MOVE-MAIL-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | default Move destination | CVV | ND | move-doc |
| 16 | `*MOVE-FILE-NAME-STICKY-FN2*` | `:BOOLEAN` | `T` | inherit Move file type from default | CVV | ND | tick |
| 17 | `*TEXT-MAIL-FILE-SEPARATOR*` | `:STRING` | `""` | text-file message separator | CVV | ND | tick |
| 18 | `*ZMAIL-STARTUP-FILE-NAME*` | `:PATHNAME-OR-NIL` | `NIL` | file read at ZMail startup | CVV | ND | tick |
| 19 | `*ZMAIL-USUAL-MAIL-FILE-DIRECTORY*` | `:PATHNAME-OR-NIL` | `()` → `NIL` | usual mail-file directory | CVV | ND | tick |
| 20 | `*FORWARDED-MESSAGE-END*` | `:STRING` | `""` | text after forwarded messages | CVV | ND | tick |
| 21 | `*FORWARDED-MESSAGE-SEPARATOR*` | `:STRING` | `""` | text between forwarded messages | CVV | ND | tick |
| 22 | `*FORWARDED-MESSAGE-BEGIN*` | `:STRING` | `""` | text before forwarded messages | CVV | ND | tick |
| 23 | `*DONT-REPLY-TO*` | `:STRING-LIST` | `'("INFO-*")` → `("INFO-*")` | addresses/patterns excluded from Reply | CVV | ND | tick |
| 24 | `*MIDDLE-REPLY-MODE*` | `:MENU-ALIST` | `:SENDER` | middle-button Reply recipients | CVV | ND | reply-doc |
| 25 | `*MIDDLE-REPLY-WINDOW-MODE*` | `:MENU-ALIST` | `:SHOW-ORIGINAL` | middle-button Reply layout | CVV | ND | reply-doc |
| 26 | `*1R-REPLY-MODE*` | `:MENU-ALIST` | `:SENDER` | Reply recipients for numeric argument one | CVV | ND | tick |
| 27 | `*REPLY-MODE*` | `:MENU-ALIST` | `:ALL` | ordinary Reply recipients | CVV | ND | reply-doc |
| 28 | `*REPLY-WINDOW-MODE*` | `:MENU-ALIST` | `:LIKE-MAIL` | ordinary Reply layout | CVV | ND | reply-doc |
| 29 | `*DEFAULT-MAIL-WINDOW-CONFIGURATION*` | `:MENU-ALIST` | `:NORMAL` | composition window layout | CVV | ND | tick |
| 30 | `*SEND-HEADER-FORMAT*` | `:MENU-ALIST` | `:INCLUDE-PERSONAL` | recipient format in sent headers | CVV | ND | tick |
| 31 | `*REPLY-HEADER-FORMAT*` | `:MENU-ALIST` | `:SHORT` | recipient format inserted in replies | CVV | ND | tick |
| 32 | `*DEFAULT-HEADER-FORCE*` | `:MENU-ALIST` | `:NONE` | default COMSAT header force | CVV if COMSAT | ND | tick |
| 33 | `*LOCAL-MAIL-HEADER-FORCE*` | `:MENU-ALIST` | `:ITS` | local-message header force | CVV | ND | tick |
| 34 | `*LOCAL-MAIL-INCLUDE-SUBJECT*` | `:BOOLEAN` | `T` | create Subject for local mail | CVV | ND | tick |
| 35 | `*DELETE-EXPIRED-MSGS*` | `:MENU-ALIST` | `:PER-FILE` | automatic expired-message deletion | CVV | ND | tick |
| 36 | `*DEFAULT-FCC-LIST*` | `:PATHNAME-LIST` | `NIL` | initial file-copy destinations | CVV | ND | tick |
| 37 | `*DEFAULT-CC-LIST*` | `:ADDRESS-LIST` | `NIL` | initial Cc recipients | CVV | ND | tick |
| 38 | `*REQUIRE-SUBJECTS*` | `:MENU-ALIST` | `NIL` | outgoing-subject requirement | CVV | ND | tick |
| 39 | `*GENERATE-IN-REPLY-TO-FIELD*` | `:BOOLEAN` | `T` | automatic In-Reply-To generation | CVV | ND | tick |
| 40 | `*GENERATE-MESSAGE-ID-FIELD*` | `:BOOLEAN` | `T` | automatic Message-ID generation | CVV | ND | tick |
| 41 | `*preserve-msg-references-across-expunge*` | `:boolean` | `T` | intended preservation of conversation references | CVV | ND | declared-only |
| 42 | `*SUMMARY-MOUSE-MIDDLE-MODE*` | `:MENU-ALIST` | `:DELETE-OR-UNDELETE` | Summary middle-button operation | CVV | ND | summary-mouse-doc |
| 43 | `*NEXT-MIDDLE-MODE*` | `:MENU-ALIST` | `:LAST-UNDELETED` | Next middle-button movement | CVV | ND | next-doc |
| 44 | `*PREVIOUS-MIDDLE-MODE*` | `:MENU-ALIST` | `:FIRST-UNDELETED` | Previous middle-button movement | CVV | ND | previous-doc |
| 45 | `*MAP-MIDDLE-MODE*` | `:ASSOC` | `NIL` | Map middle-button command | CVV | ND | map-doc |
| 46 | `*MAIL-MIDDLE-MODE*` | `:MENU-ALIST` | `:BUG` | Mail middle-button operation | CVV | ND | mail-doc |
| 47 | `*DEFAULT-INITIAL-WINDOW-CONFIGURATION*` | `:MENU-ALIST` | `:BOTH` | initial reader layout | CVV | ND | tick |
| 48 | `*DELETE-MIDDLE-MODE*` | `:MENU-ALIST` | `:BACKWARD` | Delete middle-button movement | CVV | ND | delete-doc |
| 49 | `*NEXT-AFTER-DELETE*` | `:MENU-ALIST` | `:FORWARD` | ordinary movement after Delete | CVV | ND | delete-doc |
| 50 | `*PRUNE-HEADERS-AFTER-YANKING*` | `:BOOLEAN` | `NIL` | prune headers of yanked messages | CVV | ND | tick |
| 51 | `*INHIBIT-BACKGROUND-MAIL-CHECKS*` | `:BOOLEAN` | `NIL` | disable background new-mail checks | CVV | ND | tick |
| 52 | `*notify-on-new-mail-in-background*` | `:assoc` | `nil` | converse/notify/never background notification | CVV | ND | tick |
| 53 | `*INHIBIT-BACKGROUND-SAVES*` | `:BOOLEAN` | `NIL` | disable automatic save after inbox retrieval | CVV | ND | tick |
| 54 | `*ONE-WINDOW-AFTER-YANK*` | `:BOOLEAN` | `T` | show one message window after yank | CVV | ND | tick |
| 55 | `*ALWAYS-JUMP-AFTER-GET-NEW-MAIL*` | `:BOOLEAN` | `NIL` | move to first message even with no new mail | CVV | ND | tick |
| 56 | `*FORWARDED-ADD-SUBJECT*` | `:BOOLEAN` | `T` | add Subject to forwarded messages | CVV | ND | tick |
| 57 | `*QUERY-BEFORE-EXPUNGE*` | `:BOOLEAN` | `NIL` | display and confirm before expunge | CVV | ND | tick |
| 58 | `*DELETE-AFTER-MOVE-TO-FILE*` | `:BOOLEAN` | `T` | mark message deleted after moving it | CVV | ND | tick |
| 59 | `*MAIL-HEADER-DELIMITER*` | `:STRING` | `"--Text Follows This Line--"` | draft header/body separator | CVV | ND | tick |
| 60 | `*DELETE-UNDIGESTIFIED-MESSAGE*` | `:BOOLEAN` | `T` | delete original after undigestifying | CVV | ND | tick |
| 61 | `*CLIP-UNDIGESTIFIED-MESSAGE*` | `:BOOLEAN` | `()` → `NIL` | clip original contents after undigestifying | CVV | ND | tick |
| 62 | `*INHERIT-SUBJECT-FIELD*` | `:BOOLEAN` | `T` | identify digest source in extracted Subject | CVV | ND | tick |
| 63 | `*DEFAULT-MAIL-TEMPLATE*` | `:SEXP` | `NIL` | template for ordinary composition | CVV | ND | tick |
| 64 | `*DEFAULT-REPLY-TEMPLATE*` | `:SEXP` | `NIL` | template for replies | CVV | ND | tick |
| 65 | `*DEFAULT-BUG-TEMPLATE*` | `:SEXP` | `NIL` | template for bug reports | CVV | ND | tick |
| 66 | `*DEFAULT-FORWARDING-TEMPLATE*` | `:SEXP` | `NIL` | template for forwarding | CVV | ND | tick |
| 67 | `*DEFAULT-REFORMATTING-TEMPLATE*` | `:SEXP` | `NIL` | template for incoming-header reformatting | CVV | ND | tick |
| 68 | `*from-user-id*` | `:string-or-nil` | `nil` | default user name in From fields | CVV | ND | tick |
| 69 | `*FROM-HOST*` | `:host-or-nil` | `NIL` | default host in From fields | CVV | ND | tick; host-special serialization |

Immediately after row 10, `*SUMMARY-INCLUDE-DATE*` is forwarded to the same value
cell as `*DEFAULT-SUMMARY-TEMPLATE*`; it is a legacy alias, not a seventieth option.
Rows 11–12 and 32 are pruned only from display when their site predicates are false.
Row 41 remains visible and persistent even though the source marks it unimplemented.

### Command-documentation update graph

Only these selected options have source-registered documentation associations:

```text
DEFAULT-SUMMARY-TEMPLATE
  -> SET-MSG-SUMMARY-LINE
  -> CHANGE-MSGS-SUMMARY-LINES

SUMMARY-MOUSE-MIDDLE-MODE -> ZMAIL-SUMMARY-MOUSE
NEXT-MIDDLE-MODE          -> COM-ZMAIL-NEXT
PREVIOUS-MIDDLE-MODE      -> COM-ZMAIL-PREVIOUS
NEXT-AFTER-DELETE --------+-> COM-ZMAIL-DELETE
DELETE-MIDDLE-MODE -------+
MAP-MIDDLE-MODE           -> COM-ZMAIL-MAP
MAIL-MIDDLE-MODE          -> COM-ZMAIL-MAIL

REPLY-MODE ---------------------+
REPLY-WINDOW-MODE ---------------+
MIDDLE-REPLY-MODE ----------------+-> NORMAL-REPLY
MIDDLE-REPLY-WINDOW-MODE ---------+   -> Reply, Reply All, Summary Reply text

FILTER-KEYWORDS-ALIST      -> COM-ZMAIL-KEYWORDS
FILTER-MOVE-MAIL-FILE-ALIST -+
DEFAULT-MOVE-MAIL-FILE-NAME -+-> GET-DEFAULTED-MOVE-ZMAIL-BUFFER
                                  -> Move/Summary Move dependents
```

A direct CVV choice performs its associated updates with
`*EXPLICIT-OPTION-UPDATE*` true. This is why only the summary-template path asks
whether to rewrite cached summary lines. The associations are not variable-cell
watchers: programmatic assignment or special-menu mutation does not automatically
run them. Reset, Defaults, and post-Edit refresh walk all associations explicitly.

## Failure, abort, and recovery matrix

| Operation | Failure point | State that may already have changed | Strict C303 recovery |
| --- | --- | --- | --- |
| filter read | EOF or caught reader error | editor only | report unbalanced parentheses; edit and retry |
| filter evaluation | arbitrary error or wrong return shape | arbitrary effects; menu/function may exist | no rollback |
| filter compile | error or warning declined | menu, function, and saved expression may exist | no rollback; edit/retry |
| filter Sample | universe selection or survey failure | filter already installed/compiled | no rollback |
| universe macro validation | invalid source-visible expression | arbitrary earlier effects in a surrounding evaluated form, but no registration from this macro | correct form and retry |
| universe registration | failure after list append | name may exist without updated property | no rollback |
| universe expansion | undefined/cycle/pathname/`(ALL)`/nil child failure | file visits and temporary buffers may exist | no rollback; repair definition |
| named-section selection | accessor/insertion failure after deletion starts | partially deleted/appended Profile text | manually repair or revert source buffer |
| option block regeneration | deletion/printer/editor failure | leading generated run may be absent or partial | repair/revert before save |
| Reset | init load or probe failure | defaults and partial init effects | no rollback |
| Edit reload | reader/evaluator failure | defaults plus partial edited-source effects | no rollback |
| compile | save, compiler, or load failure | source and/or compiled file may already differ | compile tick remains stale unless load completes |

Abort from Filter or Universe exits through the containing window-configuration
cleanup, but does not undo a definition that was already evaluated. Leaving Profile
restores the prior window configuration; it does not imply source save or world save.

## Conformance suite

Tests MUST use disposable definitions, buffers, messages, Profile pathnames, and
host objects, and MUST identify strict versus corrected behavior.

### Filter tests

1. `C303-FILT-READ-ONE`: place two forms in the editor and prove completion reads
   only the first.
2. `C303-FILT-READ-ERROR`: compare true EOF with a caught reader error and prove both
   reach the unbalanced-parentheses report.
3. `C303-FILT-WRONG-SHAPE`: evaluate a harmless effectful non-filter form and prove
   its effect precedes rejection.
4. `C303-FILT-WARNING-ABORT`: decline compiler warnings and prove the menu,
   property function, and saved expression are not rolled back.
5. `C303-FILT-EMPTY`: define an empty-body filter and prove its result is the parsed
   keyword list, including false for no keywords and non-null for one keyword.
6. `C303-FILT-ALWAYS-PARSE`: use a body independent of Status/Keywords and prove
   parsing and keyword retrieval still happen first.
7. `C303-FILT-KEYWORD-IDENTITY`: compare same-print-name symbols from different
   packages and prove membership uses identity.
8. `C303-FILT-SEARCH-DISPATCH`: cover ordinary, literal extended, FSM, FSM-expression,
   non-`ART-16B` array, and non-array keys in full-message and header contexts.
9. `C303-FILT-CASE`: prove literal subject/header and address-name/host comparison
   ignore alphabetic case.
10. `C303-FILT-ADDRESS`: cover interval-present/absent FSM records, paired
    `0x18`/`0x19` partial keys, exact name, name@first-host, extra hosts, bang/percent
    strings, and empty handwritten keys.
11. `C303-FILT-DATE`: test missing dates, threshold equality, both ends of On's
    half-open interval, a non-midnight anchor, and a retained relative date.
12. `C303-FILT-RECOVERY`: recover an uncompiled, editor-compiled, and unrecoverable
    compiled filter; prove optional documentation is lost from the recovered form.
13. `C303-FILT-LATE-BIND`: redefine a named child and prove an existing parent uses
    the new property function.

### Universe and mapping tests

14. `C303-UNI-GRAMMAR`: exhaust strings, pathname, nil, Primary, Current, atomic All,
    defined/undefined atoms, arbitrary singleton symbols, each operator arity, and
    invalid nested Not operands against the exact validator table.
15. `C303-UNI-OCTETS`: round-trip the three operator source bytes `05`, `12`, and
    `13` without Unicode substitution.
16. `C303-UNI-EMPTY-EDITOR`: complete the untouched two-argument initial form and
    prove macro arity failure before registration.
17. `C303-UNI-MENU-ALL`: select visible All, capture the generated `(ALL)`, and prove
    it does not reach atomic-All expansion in the unpatched source profile.
18. `C303-UNI-PATHNAME`: prove validator acceptance followed by evaluator failure.
19. `C303-UNI-EMPTY-SETS`: prove empty Union is empty and direct empty Intersection
    unions the current buffer list with identity deduplication.
20. `C303-UNI-ORDER`: prove Union's descending-size first-occurrence order and
    Intersection's ascending-size seed order, leaving equal-size ordering
    implementation-dependent.
21. `C303-UNI-NOT`: prove disk-buffer-only domain, active-message-only scan, list
    order, and identity membership.
22. `C303-UNI-LATE-BIND`: redefine a named child and prove the parent re-expands the
    new description on its next map.
23. `C303-UNI-UNDEFINED-CYCLE`: distinguish undefined-to-nil failure from unguarded
    cyclic recursion.
24. `C303-MAP-REST`: prove incremental `READ-NEXT-MSG` requests after the initial
    active length and exact current/noncurrent start indices.
25. `C303-MAP-BEGINNING-DEFECT`: pass a noncurrent buffer and prove the strict
    function traverses the current buffer backward.
26. `C303-MAP-LOADING`: distinguish one-buffer/current-universe active-only mapping
    from loaded/all-buffer forced loading.

### Profile and option tests

27. `C303-OPT-DENOMINATOR`: parse pinned `defs.lisp` without evaluating it and
    require exactly 69 active textual forms with table-identical names, types, and
    default forms; separately require one excluded site-alist mail-sending option.
28. `C303-OPT-RESTRICTIONS`: require exactly four `:NEVER`, two `:IF :GMSGS`, and one
    `:IF :COMSAT` restriction and prove pruning changes visibility, not registration
    or serialization.
29. `C303-OPT-ORDER`: load declarations into an empty alist and prove reverse-source
    order; redeclare one option and prove it moves to the front without resetting an
    already bound current value.
30. `C303-OPT-WRITE`: cover equal/non-equal values, case-only string differences,
    number/Boolean direct emission, quoted values, and all `:HOST-OR-NIL` branches.
31. `C303-OPT-DOC-GRAPH`: change every associated option through CVV and compare the
    exact graph above; change hidden associations through special menus and prove no
    immediate generic callback.
32. `C303-OPT-SUMMARY`: accept and decline the one-time cached-summary rewrite
    question and compare labels, cached lines, and ticks.
33. `C303-PROFILE-LEADING-RUN`: test no top-level form, a leading generated run, a
    later user `LOGIN-SETQ`, and user text interleaved inside the leading run.
34. `C303-PROFILE-SAVE-MATRIX`: execute all Save menu/button modes and every prompt
    branch; compare buffer text, source file, compiled file, load call, and three
    relevant ticks.
35. `C303-PROFILE-RESET-PARTIAL`: inject an init-load failure after defaults and
    prove partial state remains.
36. `C303-PROFILE-EDIT-PARTIAL`: inject an error after an early edited-source effect
    and prove reset plus that effect remain while final tick synchronization does not.
37. `C303-PROFILE-DEFINITION-PARTIAL`: remove one section, then fail recovery of an
    addition and prove the source rewrite is not transactional.
38. `C303-PROFILE-COMPILED-IDENTITY`: cover missing, wrong-source, older, matching,
    and failed-reload compiled files against compile-tick state.

## Runtime and screenshot oracle backlog

The existing [ZMail runtime audit](zmail.md#runtime-observation-advertised-but-not-resident)
records the exact current blocker: System `303-0` displayed a Mail System Menu item,
but `ZWEI:ZMAIL-FRAME` was absent and loading the maintained system stopped at the
unsited `AMS-BRIDGE-1` file-host path. Those captures do not show ZMail itself and
were intentionally not promoted as application screenshots.

No Filter, Universe, or Profile screenshot can yet be published as evidence for this
page. The required follow-up is to configure a disposable local file service inside
the established CADR harness boundary, load ZMail without saving the world, use only
synthetic messages and pathnames, and capture:

- `TODO-RUNTIME-C303-FILTER`: the initial Filter form and its System/Header/Date
  panes;
- `TODO-RUNTIME-C303-UNIVERSE`: the Universe pane with its operator and All
  controls; and
- `TODO-RUNTIME-C303-PROFILE`: Profile's option chooser plus
  Filters/Universes/Save controls.

Each runtime test must record the full harness provenance required by repository
policy and each selected image must pass the capture-specific rights review. Until
then, exact labels/layouts that are not established by source remain TODO, and the
source-visible `(ALL)` and reverse-map defects remain unconfirmed runtime oracles.

## Nonclaims and implementation cautions

- The 69-row table is complete for one macro spelling in one pinned file, not for
  hardcopy, mail-file, site-alist, patch-only, or runtime-added options.
- A choose-variable-values descriptor identifies the source editor contract; exact
  rejection, coercion, and pixel behavior of every generic type remains an external
  TV dependency.
- Public source availability does not make the maintained restoration identical to
  a particular historical System 303 band.
- The source operator bytes establish serialized identity and UI mapping, not a
  modern Unicode glyph assignment.
- Named filters and universes are both late-bound in this profile, but filters resolve
  a function property per message whereas universes resolve and materialize a set per
  map. They are not interchangeable query objects.
- Executable Profile and filter source is a security boundary. A sandboxed data-only
  replacement is prudent, but is not source-compatible without an explicit profile.
- Nothing in Profile Save or Compile invokes Save World or creates a host-process
  checkpoint.

## Sources and verification

- LM-3 maintained System source at Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
  files and spans listed in the artifact table; verified 2026-07-19.
- [MIT CADR ZMail dossier](zmail.md), especially the source/runtime boundary and
  `System 303-0` harness record.
- [ZMail and mail-composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md),
  for the surrounding application contract and cross-system compatibility profiles.
- [Screenshot publication rights review](../screenshot-publication-rights-review.md),
  which governs any future curated runtime capture.
