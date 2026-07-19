---
type: Artifact Analysis
title: Source Comparison, Compare/Merge, and Version Control
description: Evidence-bounded study of MIT and Symbolics SRCCOM, Genera Zmacs source comparison, and the media-present but release-disabled Compare/Merge and Version Control systems.
tags: [lisp-machine, mit-cadr, lm-3, genera, srccom, compare-merge, version-control, zmacs]
timestamp: 2026-07-18T08:00:49-04:00
---

# Source Comparison, Compare/Merge, and Version Control

The Lisp-machine material examined here contains three related but distinct
technologies:

1. **SRCCOM** is a two-source line comparison engine with an annotated two-way
   merge path. It is present in the maintained LM-3 source and is loaded in the
   preserved Genera 8.5 base world.
2. **Compare/Merge** is a later Symbolics N-way comparison and merge engine with
   automatic three-way-style resolution and a Zmacs annotation editor. Its source
   and compiled files are on the purchased media, but the Genera release roster
   reader-disables it.
3. **Version Control** is an experimental Symbolics source-control system built
   around branches, versions, explicitly bounded hard sections, compact delta
   storage, network locks, Compare/Merge, Zmacs, SCT, and patch tools. Its code and
   three documentation books are on the media, but `Lock-simple`, `compare-merge`,
   `Version-Control`, and `Version-Control-doc` are all reader-disabled in the
   roster. They are not established as live base-world applications.

That last boundary matters. Media presence is evidence of shipped material, not
evidence that a system is loaded, configured, supported on the VLM, or safe to
operate. A disposable Genera runtime probe found live base SRCCOM and its Zmacs
command, while the `COMPARE-MERGE` and `VERSION-CONTROL` packages were absent.

This dossier complements the editor studies in
[From EINE to ZWEI and Zmacs](lisp-machine-text-editors.md),
[ZWEI and Zmacs on the MIT CADR and LM-3](mit-cadr/zwei-and-zmacs.md), and
[Zmacs in Symbolics Genera](genera/zmacs.md). It inventories the implemented
interfaces and interaction controls rather than treating a manual as a complete
behavioral specification.

## Release and evidence boundary

| Material | What is established | What is not established |
| --- | --- | --- |
| MIT System 46, Git revision `8e978d7` | The complete public tree contains no SRCCOM source, system component, or generated named-command entry. Two prose occurrences use “srccom” as an ordinary comparison concept. | That the System 46 museum image offered an installed Source Compare command. |
| LM-3 `SYS`, Fossil check-in `4df393c` | The maintained tree contains `io1/srccom.lisp`, declares subsystem `SRCCOM`, and integrates it with Dired and a ZWEI merge entry path. | That every maintained post-1980 edit in those files was compiled into the preserved System 303 load band. |
| Genera 8.5 base world | `SRCCOM:SOURCE-COMPARE-FILES` and Zmacs `COM-SOURCE-COMPARE` were live in a fresh runtime. | A configured Symbolics site or file service. |
| Purchased Genera media | Source, VBIN files, site declarations, and Sage books exist for Compare/Merge and Version Control. | That those systems are loaded or advertised in the preserved base world. |
| Genera release roster | Four consecutive entries are each preceded by `#+ignore`: `Lock-simple` 437.0, `compare-merge` 404.0, `Version-Control` 405.0, and `Version-Control-doc` 401.0. | That removing the reader condition would make them runnable, compatible with the VLM, or appropriately configured. |

The System 46 conclusion comes from a case-insensitive search of every tracked
pathname and source byte, plus the generated named-command listing. The only hits
are a 1979 ZWEI note proposing a source-comparison-like comparison of wall charts
and a bug report advising users to compare files after a hardware error. Neither is
an implementation or command declaration.

The LM-3 checkout is a maintained restoration line. Its current SRCCOM header and
edit comments extend through later TI and System 127 work. This page therefore calls
it **LM-3 maintained source**, not “the historical System 46 implementation” and not
automatically “the binary in System 303.”

## SRCCOM's common design

Both maintained LM-3 SRCCOM and Genera SRCCOM use the same recognizable algorithm:

1. wrap each source in a `FILE` object that lazily caches lines;
2. compare corresponding cached lines;
3. on a mismatch, look ahead alternately in both sources for a possible
   resynchronization;
4. accept resynchronization only after a configurable run of matching lines,
   three by default;
5. call a replaceable difference printer for the unmatched runs;
6. optionally write common text plus marked alternatives into a merge buffer and
   record six buffer pointers around every conflict.

This is a line-oriented resynchronizing differ, not a syntax tree differ. “Source”
describes its intended use, not a parser-level guarantee. Labels are inferred from
the latest interesting preceding line: an opening parenthesis in Lisp/ZTOP mode, a
leading period in Text/Bolio mode, and a nonblank initial character otherwise.

The six recorded merge points bound the marker before the first alternative, its
text, the marker before the second alternative, its text, the closing marker, and
the following text. The editor uses those pointers to offer conflict choices without
having to parse the marker prose again.

## MIT CADR and LM-3 SRCCOM

### Complete maintained core interface

The current `io1/srccom.lisp` contains 26 top-level function definitions. The
grouping below is descriptive; every function name in that file is included.

| Role | Functions |
| --- | --- |
| File construction and input | `FILE-IDENTIFIER`, `CREATE-FILE`, `HANDLE-ESCAPE-CHARACTERS-IN-LINE`, `GET-FILE-LINE` |
| Labels and equality | `LINE-LAST-LABEL`, `LINE-INTERESTING-P`, `COMPARE-LINES` |
| Public/prompted entry | `SOURCE-COMPARE`, `PROMPTED-SOURCE-COMPARE`, `QUERY-TYPE`, `GET-SRCCOM-FILE-NAMES`, `GET-SRCCOM-FILE-NAMES-PROMPT`, `DESCRIBE-SRCCOM-SOURCES` |
| Comparison loop | `SOURCE-COMPARE-FILES`, `SET-FORM-VARIABLES`, `HANDLE-DIFFERENCE`, `CHECK-POTENTIAL-MATCH` |
| Difference output | `PRINT-DIFFERENCES`, `PRINT-DIFFS-1`, `PRINT-FILE-SEGMENT` |
| Merge and conflict recording | `SOURCE-COMPARE-AUTOMATIC-MERGE`, `SOURCE-COMPARE-AUTOMATIC-MERGE-1`, `SOURCE-COMPARE-AUTOMATIC-MERGE-RECORDING`, `PRINT-AUTOMATIC-MERGE`, `PRINT-AUTOMATIC-MERGE-1`, `RECORD-MERGE-BOUND` |

`SOURCE-COMPARE` is explicitly exported. Its complete configurable surface in the
inspected file is:

| Parameter | Default | Effect |
| --- | ---: | --- |
| output stream | standard output | Destination for comparison headers and differing segments. |
| comparison type | `:TEXT` | `:TEXT` compares lines; `:FORM` reads and compares Lisp objects. |
| `*PRINT-LABELS*` | true | Print the preceding interesting source line for each run. |
| `*LINES-NEEDED-TO-MATCH*` | 3 | Required consecutive matches before the files are considered resynchronized. |
| `*LINES-TO-PRINT-BEFORE*` | 0 | Matching context before a run. |
| `*LINES-TO-PRINT-AFTER*` | 1 | Matching context after a run. |
| `*DIFFERENCE-PRINTER*` | `PRINT-DIFFERENCES` | Callback for one unmatched run. |
| `*LINES-THAT-MATCHED*` | 0, dynamically reset | Number of lines matched before the current difference, made available to the difference printer. |
| `*ESCAPE-CHARACTER-IGNORE-FLAG*` | false | Text-only filtering: an atom removes that character; a pair removes the escape and the following specified number of characters. |
| `*PATHNAME-DEFAULTS*` | a pathname-defaults object | Defaults used while merging the two requested pathnames. |

The maintained `FILE` structure has six declared fields: cached length, name, type,
stream, major mode, and comparison kind. The remaining top-level variables are
internal output/merge state: `*OUTPUT-STREAM*`, `*MERGE-LINE-NO*`,
`*RECORD-MERGE-BOUNDS-P*`, `*MERGE-RECORD*`, and `*MERGE-THIS-RECORD*`.

Form comparison exists in the implementation, but `QUERY-TYPE` always returns
`:TEXT`; the source comments say the other mode was not useful enough to justify the
question. In form mode the code disables labels, requires one matching form, prints
no trailing match, reads with `READ`, and pretty-prints forms. This source-visible
path must not be advertised as a normal interactive choice.

`SOURCE-COMPARE-FILES` returns true when the sources are identical in this maintained
LM-3 file. That differs from Genera, whose same-named routine returns true when it
encountered any difference.

One static defect reinforces the lineage warning. In current `.44`,
`PROMPTED-SOURCE-COMPARE` appears to pass its comparison type in the output-stream
position. This is a finding about the maintained text, not proof that a loaded
System 303 function behaves that way. It remains a runtime TODO.

### LM-3 editor integration

The maintained Dired mode binds ordinary `=` to `COM-DIRED-SRCCOM`, which rejects
directories and entries marked deleted and compares the selected pathname with its
highest version. The source also binds a second literal Lisp-machine character,
stored as source byte `0x1e`, to `COM-DIRED-SRCCOM-FILE`; that command prompts for an
arbitrary second pathname. The mouse menu includes **Compare**, and Dired typeout
pathnames expose a **Compare** operation. Output goes to a buffer named from the two
pathnames.

The same maintained file implements `SOURCE-COMPARE-MERGE`: it opens an editor on a
merge request, builds annotated alternatives through SRCCOM, asks which alternatives
to retain, and writes the selected result to the requested output pathname. It is a
destructive writer and was not exercised here.

Later `zwei/patch/zwei-126-*` files contain `Source Compare`, `Source Compare
Changes`, and merge commands. They are patch-line evidence, not a safe basis for
claiming that those named commands are installed in the untouched System 303 world.
The current unpatched `zwei/zmacs.lisp` does not itself define those commands.

No CADR screenshot is published for this dossier. A useful runtime test requires
two synthetic files on a disposable private CADR disk plus proof of the actual
loaded SRCCOM function identity; that remains a TODO rather than being inferred from
the maintained tree.

## Genera base SRCCOM

### Complete core interface and drift

Genera's licensed `io1/srccom.lisp` contains 22 live top-level functions; the
block-commented compatibility macro is excluded.

| Role | Functions |
| --- | --- |
| File and line handling | `CREATE-FILE`, `GET-FILE-LINE` |
| Labels and equality | `LINE-LAST-LABEL`, `LINE-INTERESTING-P`, `COMPARE-LINES`, `COMPARE-LINES-LITERALLY`, `COMPARE-LINES-IGNORING-LEADING-SPACES` |
| Entry and prompt | `SOURCE-COMPARE`, `PROMPTED-SOURCE-COMPARE`, `GET-SRCCOM-FILE-NAMES` |
| Comparison loop | `SOURCE-COMPARE-FILES`, `HANDLE-DIFFERENCE`, `CHECK-POTENTIAL-MATCH` |
| Difference output | `PRINT-DIFFERENCES`, `PRINT-DIFFS-1`, `PRINT-FILE-SEGMENT` |
| Merge and conflict recording | `SOURCE-COMPARE-AUTOMATIC-MERGE`, `SOURCE-COMPARE-AUTOMATIC-MERGE-1`, `SOURCE-COMPARE-AUTOMATIC-MERGE-RECORDING`, `PRINT-AUTOMATIC-MERGE`, `PRINT-AUTOMATIC-MERGE-1`, `RECORD-MERGE-BOUND` |

The `FILE` structure adds a buffer-pointer table, an EOF flag, and presentation type
and object slots. Output can therefore make file pathnames, buffers, and line
locations presentation-sensitive instead of emitting only inert prose.

The complete set of live top-level variables in this Genera file is
`*OUTPUT-STREAM*`, `*PRINT-LABELS*`,
`*SRRCOM-LINE-COMPARISON-FUNCTION*`,
`*SRRCOM-STRING-COMPARISON-FUNCTION*`, `*PATHNAME-DEFAULTS*`,
`*DIFFERENCE-PRINTER*`, `*LINES-NEEDED-TO-MATCH*`,
`*LINES-TO-PRINT-BEFORE*`, `*LINES-TO-PRINT-AFTER*`,
`*MERGE-LINE-NO*`, `*RECORD-MERGE-BOUNDS-P*`, `*MERGE-RECORD*`, and
`*MERGE-THIS-RECORD*`.

`SOURCE-COMPARE` accepts two filenames, optional output stream and
`PRINT-COMMENTS`, plus these keywords:

| Keyword | Exact implemented meaning |
| --- | --- |
| `IGNORE-CASE-AND-STYLE` | Selects the case/style-insensitive string comparison primitive. |
| `IGNORE-WHITESPACE` | Ignores only leading spaces and tabs on each line. Internal and trailing whitespace remain significant. |
| `DELETED` | Permits opening deleted versions, used by the Dired integration. |

The source contains a TODO for ignoring comments; it does not implement that option.
An old multi-font/Japanese decoding wrapper is under an inactive conditional, so it
is not counted as live behavior. The two dynamically bound comparison variables are
spelled `*SRRCOM-LINE-COMPARISON-FUNCTION*` and
`*SRRCOM-STRING-COMPARISON-FUNCTION*` in the preserved source; the doubled `R` is
retained here because it is part of the interface text.

The main loop returns `ANY-DIFFERENCES`: false means equal and true means at least
one mismatch. This is the reverse of the maintained LM-3 return convention. Code
ported between the two environments cannot safely treat the result as a stable
“equal” predicate.

### Complete Zmacs named-command surface

All eight base commands below are installed in the Zmacs named-command table. No
fixed direct key is assigned by the base Zmacs table; invoke them through `Meta-X`,
menus, or a user binding.

| Command | Compared quantities and result |
| --- | --- |
| **Source Compare** | Prompts independently for two quantities and writes a reusable `Source-Compare` support buffer. |
| **Source Compare Merge** | Prompts for two quantities and an output buffer, replaces that buffer with the annotated merge, queries at every difference, reparses attributes, and sectionizes the result. |
| **Source Compare Installed Definition** | Compares the definition at point with its installed definition. |
| **Source Compare Merge Installed Definition** | Merges the current and installed definitions. |
| **Source Compare Saved Definition** | Compares the current definition with the newest saved source version. |
| **Source Compare Merge Saved Definition** | Merges the current and saved definitions. |
| **Source Compare Newest Definition** | Compares with the newest definition in the normal source file, excluding patch-file lookup. |
| **Source Compare Merge Newest Definition** | Merges with that newest normal-source definition. |

For each operand, the general commands offer exactly these choices:

| Key | Quantity | Selection behavior |
| --- | --- | --- |
| `B` | Buffer | Prompt for a buffer. |
| `D` | Definition | Use the definition at point. |
| `F` | File | Prompt for a pathname without forcing the version to newest. |
| `K` or `Control-Y` | Last Kill | Use kill-history element zero. |
| `P` or `Meta-Y` | Previous Kill | Use kill-history element one. |
| `R` | Region | Use an existing region; otherwise select a buffer and enter a recursive editor where Region or Definition can be established, `End` finishes, and `Abort` aborts. |

The numeric argument is decoded by bits, not magnitude ranges: bit 2 ignores case
and style, bit 4 ignores leading whitespace, and 6 requests both. A Source Compare
buffer is reusable for the same pair in either order; its specialized revert method
clears the typeout-derived contents.

### Merge conflict controls

The first prompt for each conflict accepts the complete set below.

| Input | Action |
| --- | --- |
| `1` | Tentatively retain the first alternative, redisplay, then request confirmation. |
| `2` | Tentatively retain the second alternative, redisplay, then request confirmation. |
| `*` | Tentatively retain both alternatives, redisplay, then request confirmation. |
| `I` or `i` | Retain both alternatives and marker lines without confirmation. |
| `Space` | Retain both alternatives without redisplay or confirmation for this conflict. |
| `!` | Choose one policy for all remaining conflicts. |
| `Control-R` | Enter recursive editing, then return to the question. |
| `Rubout` | Retain neither alternative. |
| `Form` | Redisplay all. |
| `Control-L` | Recenter and redisplay. |
| `Help` | Print the conflict-choice help. |
| anything else | Beep and continue asking. |

After `!`, the allowed policies are first, second, both, indicators, or `Rubout` to
leave the policy question. A tentative `1`, `2`, or `*` choice reaches a second
prompt: `Space` confirms, `Rubout` restores the prior text, `Control-R` edits, and
`Help` explains the confirmation stage.

The public Genera 8 editing manual says the first and second merge questions also
have a mouse interface. The later 8.5 source explicitly says the mouse path had been
broken since Release 4 and removes its remnants. For this preserved source, the
keyboard interface above is the high-confidence claim; the manual's mouse statement
is retained as historical documentation, not current behavior.

### Dired, changed-file queries, and window comparison

Genera Dired binds `=` to compare the selected version with newest. A numeric
argument prompts for the second pathname; the same 2/4 option bits apply. A pathname
presentation also exposes **Compare**. Unlike maintained LM-3 Dired, the Genera
wrapper passes `DELETED T` through to SRCCOM.

When Zmacs discovers that an unedited visited file changed on disk, its revert query
offers **Yes**, **No**, and **Compare**. Choosing Compare opens an accepting-values
form with exactly two booleans: **Ignore Case and Style** and **Ignore Leading
Whitespace**. The comparison does not itself choose whether to revert.

**Compare Windows** is a separate editor command, not SRCCOM. Starting at point in
two selected windows, it compares characters until the first difference and moves
both points there. With more than two windows, decimal digits of a numeric argument
identify the two window positions. It produces locations, not an annotated diff or
merge buffer.

## Compare/Merge: media-present, release-disabled

The Compare/Merge system declaration is serial: core `compare-merge`, then
`editor-interfaces`. Its only declared exported function is
`COMPARE-MERGE:COMPARE-MERGE-INTERVALS`:

```lisp
(compare-merge-intervals source-list
                         &key target-interval
                              automatically-resolve-differences
                              typeout-differences
                              annotate-auto-resolutions)
```

The call accepts N source intervals. Each source descriptor can be tagged as an
original, old original, or force-edit source. The engine uses minimum match lengths
of two lines and five characters and a default duplicate lookahead of 100 positions.
It can emit an annotated target, type out differences, and attempt automatic
resolution. A later source edit enables resolution when every non-original version
agrees even if the original differs.

This is materially broader than SRCCOM. SRCCOM searches for resynchronization
between two sequences and leaves two marked alternatives. Compare/Merge compares
multiple source histories, understands distinguished ancestors, and can decide some
conflicts automatically before offering the annotation editor.

### Complete source-visible editor command surface

| Command | Purpose |
| --- | --- |
| **Merge Environment Help** | Print the merge accelerator summary, then invoke ordinary editor Help. |
| **Swap Merge Difference Info** | Toggle the annotation for the current difference against the currently selected result. |
| **Take Merge Choice** | Prompt for a tag and insert the text associated with that tag. |
| **Prefix Take** | Insert the text for the tag encoded by the following command character. |
| **Prefix Take Activate** | Insert that tag, remove the annotation, redisplay, and ask for confirmation. |
| **Tags Edit Compare Differences** | Make `Control-.` visit unresolved annotations across the current tag table. |
| **Edit Compare Differences** | Make `Control-.` visit unresolved annotations in the current buffer. |
| **Compare Merge Multiple Files** | Collect N pathname/buffer sources, match starname expansions by name and type, run Compare/Merge, and optionally visit unresolved results. |

`Test Merge Environment` is a source-visible debugging minor-mode initializer, not
counted as a normal user command. An older diagram-oriented interface and commands
named **Resolve Differences**, **Remove Comparison Header**, and **Remove Compare
Diagrams** are inside a block comment and are not counted as live current UI.

The merge-acceleration mode installs these controls:

| Control | Effect |
| --- | --- |
| `Super-Z`, then `A` through `Z` | Take the corresponding tag. |
| `Super-Z`, then `Super-A` through `Super-Z` | Take the tag, hide annotations, and confirm. |
| `Super-C` | Prompt for a tag. |
| `Super-Control-S` | Toggle annotations versus the merge selected so far. |
| `Help` | Merge help followed by ordinary editor documentation. |
| `Meta-Right` on a tag line | Take the presented tag. The raw 006 edit history also retains the superseded `Super-Right` spelling; the manual and later edit branch agree on `Meta-Right`. |

**Compare Merge Multiple Files** opens an accepting-values form whose complete
source-visible controls are:

- **Enable automatic merging** and **Type out differences on the typeout window**;
- a repeatable source sequence, each choosing **Pathname** or **Zwei Buffer** and
  then the object;
- when automatic merging is enabled, source option **None**, **Original**, **Old
  Original**, or **Force Edit**;
- result disposition **Pathname**, **Special Buffer**, **Overwrite**, or, when no
  wildcard pathname is present, **Buffer**;
- a target pathname or target buffer when that disposition needs one.

Wildcard source sets are paired by name and type. The source rejects mixing a Zmacs
buffer with wildcard pathname sets. A source-only anomaly is that the local
`EDIT-DIFFERENCES-P` variable is returned to the caller but no accepting-values
control assigns it in the preserved text, so automatic entry into difference
editing is not claimed without a compiled/runtime check.

The evacuated Lisp source retains Symbolics 006 edit records, and its raw form has
unmatched parentheses if those histories are treated as ordinary text. This dossier
reports the greatest logical source revision and identifies edit alternatives; it
does not claim that loading the raw evacuated file is a valid reconstruction method.

## Symbolics Version Control: design and architecture

The internal guide identifies the material as a draft Symbolics-internal Version
Control 0 design from November 1987. It is not part of the ordinary public Genera
manual set. This page paraphrases the local licensed books and does not reproduce
their prose.

The system stores the history of what would ordinarily be many numbered flat files
inside one version-controlled file. A file image is divided into **hard sections**:
explicit logical units whose identities persist across versions. Branches represent
parallel development; each version records section ordering and changed section
content. A VC pathname adds branch and in-file version information to an ordinary
flat pathname. SCT maps system branches to file branches and uses those versions for
system builds, journals, and patches.

The on-media system declaration loads these subsystems in order:

| Subsystem | Role established by declarations and source |
| --- | --- |
| `vc-packages` | Defines `VCI`, `VC`, patch, and system-change packages. |
| `vc-pathnames` | Extends file access path behavior for VC branch/version pathnames. |
| `compare-merge` | Supplies multi-source merge and annotation editing. |
| `vc-file-substrate` | Parses and encaches VC files, reconstructs versions, streams selected versions, clones branches, and manages locked file updates. |
| `vc-editor-support` | Adds hard-section nodes, histories, modification comments, branch merges, diagrams, commands, and VC buffer mode to Zmacs. |
| `vc-interfaces` | Adds conversion, extraction, archive, patch, system-change, debugging, and tree-conversion commands. |

The storage description divides a VC file into header, version/section text records,
and trailer/control records. Reading a version reconstructs its section order and
text from those records rather than mounting a VM snapshot or filesystem image.
“Encached file” is the implementation's in-memory parsed model, not an archive
format exposed as an ordinary directory.

Version Control requires `Lock-simple`. The associated book describes single-writer,
multiple-reader network locks transported over the transaction-token-list medium on
TCP or CHAOS. Its public operations are `READ-LOCK`, `WRITE-LOCK`,
`DOWNGRADE-LOCK`, `UNLOCK`, `BREAK-LOCK`, and `LOCK-STATUS`, with timeout and
user-error conditions. The documentation limits server support to Symbolics 3600
family machines. The preserved VLM is unconfigured, servers are disabled, and the
base roster reader-disables Lock-simple; no live lock service is asserted.

### Complete active editor implementation inventory

There are 25 active source-visible editor command implementations: 24 live `DEFCOM`
forms in `commands.lisp`, plus the contextual `COM-VC-MENU` in
`diagram-lines.lisp`. The sole additional textual `DEFCOM`, **Show VC Section
Data**, is block-commented and excluded.

| Command | Implemented behavior |
| --- | --- |
| **Find File Ignore Version Control** | Visit the flat stored representation while ignoring VC attributes; intended for debugging. |
| **Create Version Controlled File Buffer** / **Create VC File Buffer** | Create an unsaved VC buffer with attribute and first-content hard sections; numeric argument prompts for the initial branch. The two names alias one implementation. |
| **Split Hard Section** | Split at point or create an empty section beside a diagram boundary/end. |
| **Kill Hard Section** | Mark the section deleted, remove it from display, and push it on the kill ring. |
| **Set Buffer Disposition** | Choose next-in-branch, a new public/private branch, merge onto another branch, or disconnect an unmodified buffer. |
| **Show Modification Comments** | Expose editable trailer commentary for all sections. |
| **Hide Modification Comments** | Hide those trailer sections. |
| **Show Section History** | Open a buffer containing historical versions of the current hard section. |
| **Show Section Authors** | Show author, version, date, and time; numeric argument limits it to the current branch. |
| **List Modified Sections** | List sections changed since read (argument 1/default) or since save (argument 2) as navigable possibilities. |
| **List Deleted Sections** | List every historically deleted section; numeric argument limits it to the current branch. |
| **Show Section Changes** | Compare the current hard section with its last changed saved version; numeric argument selects two saved versions. |
| **Show All Section Changes** | Compare changed sections in the current buffer or two selected saved file versions. |
| **Show All Section Changes of System** | Compare all sections across an SCT system; numeric argument includes components. |
| **Merge VC File Branches** | Three-way merge newest source and target branches against their common ancestor; create a result buffer set to save next in target. |
| **Merge VC System Branches** | Apply file-branch merge across an SCT system and select results as a tag table; numeric argument includes components. |
| **Show VC File Branches** | Graph file branches; numeric argument adds every version. |
| **Goto Hard Section Beginning** | Go to the current section start, or the previous start when already there. |
| **Goto Hard Section End** | Go to the current section end, or the next end when already there. |
| **Show Titles** | Display full hard-section title diagrams. |
| **Hide Titles** | Reduce titles to thin section targets. |
| **Show Branch Lock Status** | Query the default or selected branch lock and report it. |
| **Break Branch Lock** | After warning and explicit confirmation, forcibly unlock a selected branch. |
| **Revert Section** | Discard changes to the current hard section. |
| **VC Menu** | Build a contextual section menu: kill always; author/history/changes for existing sections; revert when an existing section is modified. |

The VC file-buffer minor mode installs four fixed controls:

| Binding | Command |
| --- | --- |
| `Super-<` | Goto Hard Section Beginning |
| `Super->` | Goto Hard Section End |
| `Super-O` | Split Hard Section |
| `Super-Mouse-Left` | Contextual VC Menu |

Its named menu contains 17 labels: Set Buffer Disposition, Split Hard Section, Kill
Hard Section, Show Modification Comments, Hide Modification Comments, Show VC
Section Data, Merge VC File Branches, Show VC File Branches, Show Section History,
Show Section Authors, List Modified Sections, Show Section Changes, Show All Section
Changes, Show Branch Lock Status, Break Branch Lock, Revert Section, and List Deleted
Sections.

That menu exposes a source defect: **Show VC Section Data** remains in the menu, but
its only definition is inside a block comment. Invoking it from a source-equivalent
build would target an undefined command unless another patch supplied it.

The current implementation also makes a hard-section title presentation-sensitive:
Middle kills an existing section, while Super-Mouse-Left opens the contextual menu.
The source's named menu is richer than the November 1987 guide's command list.

### Complete Command Processor inventory

The declared `vc-interfaces` source contains 16 Command Processor definitions.
Many create, rewrite, extract, delete, or lock files; none was executed in this
museum run.

| Command | Required inputs | Keywords/options and effect |
| --- | --- | --- |
| **Convert File Tree to VC Files** | tree-spec file, source files, target template | `Create Directories`, `Verify`; convert a described parallel flat-file tree. |
| **Convert System Sources Tree to VC Files** | tree-spec file, SCT system | `Include Components` default yes, VC subdirectory default `VC`, `Create Directories`, `Verify`. |
| **Fork VC System** | version-controlled system, branch, version, new branch name | `Include Components`; clone the selected system version into a new branch. |
| **Extract VC File Version** | VC pathname, version when not encoded in pathname, flat target | Refuses to overwrite the VC file; reconstructs one version without diagrams. |
| **Convert File Sets to VC Files** | wildcard file sets, target | `Create Directories`, `Verify`, `Branch Name`, `New Branch Root`; one VC file per flat version set. |
| **Convert Files to VC File** | files/file sets, one target | Same four keywords; collect all inputs into one VC file. |
| **Convert System Sources to VC Files** | SCT system | `Include Components`, VC subdirectory, `Create Directories`, `Verify`, `Branch Name`, `New Branch Root`. |
| **Show VC File Branches** | one or more newest VC pathnames | `Detailed`; print the branch tree and optionally versions. The function is internally named `COM-SHOW-VC-FILE-CONTENTS`. |
| **Show Archive** | compact-file pathname | Produce a Dired-style listing of archived flat versions. |
| **Extract Archive Files** | compact file(s), start version | optional end version; restore archived versions and properties to their prior locations. |
| **Add Archive Files** | base files | `Keep` default 2, `In Background`, `Verbose`; archive new versions and delete older archived copies unless protected. |
| **Make VC Private Patch File** | VC file, branch, patch pathname | `Base Branch`, `Base Version`, `Patch Note`; write a `.vcp` source. |
| **Add Patch VC File Differences** | VC file and branch | same base/note controls; add differing sections to the current SCT patch. |
| **Make VC System Branch Patch File** | SCT system, branch, patch pathname | `Include Components`, base branch/version, note; write system-wide `.vcp`. |
| **Add Patch VC System Differences** | SCT system and branch | same controls; add system differences to the current patch. |
| **Show VC Patch** | `.vcp` pathname | Decode and display the VC patch source. |

The guide's CP summary names **Show VC File Versions**, while the current source
registers **Show VC File Branches**. The guide also documents **UnKill Hard
Section**, but no live definition occurs anywhere in the inspected media source.
Conversely, current source adds Section Authors, Deleted Sections, Revert Section,
system-wide section changes, and the contextual menu beyond the guide's summary.
These are version differences, not synonyms silently normalized by this page.

### Package interface

`VERSION-CONTROL` (`VC`) has no export list; its source comment says an export plan
had not been chosen. `VERSION-CONTROL-INTERNALS` (`VCI`) exports 85 symbols. Six
names begin with raw Lisp-machine character byte `0x8d`; the portable transcription
`[LM-char-215]` below records the byte's octal value without guessing a Unicode
identity.

| Group | Complete exported names |
| --- | --- |
| Section records | `[LM-char-215]-SECTION`, `[LM-char-215]-SECTION-P`, `[LM-char-215]-SECTION-SECTION-ID`, `[LM-char-215]-SECTION-NEW-VERSION-INTERVAL`, `MAKE-[LM-char-215]-SECTION`, `MAKE-NEW-VERSION-FROM-[LM-char-215]-SECTION-ARRAY`, `MAKE-SECTION-BOUNDARY-BLIP`, `SECTION-BOUNDARY-BLIP`, `SBB-BEGIN-SECTION-ID` |
| Version and branch model | `ADD-NEW-VERSION`, `BRANCH-DEFINED-P`, `BRANCH-LAST-VERSION`, `CHOOSE-FILE-VERSION-DYNAMIC`, `COPY-FILE-VERSION`, `COPY-FILE-VERSION-INFO`, `DUPLICATE-FILE-BRANCH`, `FILE-BRANCH`, `FILE-BRANCH-NAME`, `FILE-BRANCH-NAME-ALIST`, `FILE-BRANCH-PARENT-FILE-VERSION`, `FILE-BRANCH-PRIVATE-USER-NAME`, `FILE-BRANCHES`, `LEAF-FILE-VERSION-P`, `LOOKUP-FILE-BRANCH`, `MAKE-FILE-BRANCH`, `MAKE-FILE-VERSION`, `MAKE-FILE-VERSION-INFO`, `FILE-VERSION`, `FILE-VERSION-INFO`, `FILE-VERSION-INFO-AUTHOR`, `FILE-VERSION-INFO-LENGTH`, `FILE-VERSION-INFO-CREATION-DATE`, `FILE-VERSION-BRANCH-NAME`, `FILE-VERSION-BRANCH-VERSION`, `FILE-VERSIONS-EQUAL`, `RECORD-FILE-BRANCH` |
| Encached file and streams | `ENCACHED-FILE`, `ENCACHED-FILE-ANCESTOR-VERSION-P`, `ENCACHED-FILE-FILE-INFO`, `ENCACHED-FILE-FIND-COMMON-ANCESTOR`, `ENCACHED-FILE-HEADER-MERGE-VERSION`, `ENCACHED-FILE-PARENT-VERSION-P`, `ENCACHED-FILE-PATHNAME`, `ENCACHED-FILE-PROPERTIES-1`, `ENCACHED-FILE-VERSION-SECTION-ORDER`, `ENCACHED-FILE-VERSION-INFO`, `ENCACHED-FILE-VERSION-INFO-CHANGED-SECTIONS`, `ENCACHED-FILE-VERSION-INFO-SECTION-ORDER`, `ENCACHED-FILE-VERSION-INFO-SECTION-ORDER-CHANGED-P`, `ENCACHED-FILE-VERSION-STREAM`, `ENCACHED-FILE-VERSION-STREAM-BLIP`, `ENCACHED-FILE-VERSIONS`, `ENCACHED-FILE-SECTION-NOT-EMPTY-FOR-VERSION`, `ENCACHED-RECORD`, `ENCACHED-CONTROL-RECORD`, `ENSURE-ENCACHED-FILE-UP-TO-DATE`, `FIND-OR-MAKE-ENCACHED-FILE-HEADER`, `FIND-OR-MAKE-LOCKED-ENCACHED-FILE`, `ONE-VERSION-FILE-STREAM`, `OPEN-ENCACHED-FILE-STREAM`, `OPEN-ENCACHED-OR-FILE-STREAM`, `REREAD-ENCACHED-FILE`, `CONVERT-FILE-STREAM-TO-ONE-VERSION-STREAM`, `WRITE-OUT-NEW-FILE-VERSION` |
| Locks, pathnames, trailers, and utilities | `BRANCH-LOCK-STATUS`, `BREAK-BRANCH-LOCK`, `LOCK-BRANCH-FOR-MODIFICATION`, `UNLOCK-BRANCH`, `WITH-LOCKED-ENCACHED-FILE-LOCKED`, `CHECK-NEW-FILE-COLLISION`, `CONVERTED-PATHNAME-ALIST`, `CONVERTED-PATHNAME-LINKS-CHASED`, `RETURN-VC-PATHNAMES`, `NON-VERSION-CONTROLLED-FILE`, `MAKE-FILE-ATTRIBUTE-PROPERTY`, `MAKE-FILE-VERSION-TRAILER`, `MAKE-FILE-VERSION-TRAILER-PS`, `FILE-VERSION-TRAILER-AUTHOR`, `FILE-VERSION-TRAILER-PER-SECTION-ARRAY`, `FILE-VERSION-TRAILER-DATE`, `FILE-VERSION-TRAILER-DESCRIPTION`, `PRINT-BRANCHES-IN-TREE`, `INSERT-INTO-VECTOR`, `*DEFAULT-INITIAL-BRANCH-NAME*`, `*INITIALIZATIONS*` |

The verified total is 85 unique source symbols.

## Documentation system

`Version-Control-doc` defines three Sage books:

| Book | Recovered records | Subject |
| --- | ---: | --- |
| **Symbolics Internal Guide to Version Control** (`VC`) | 82 | User model, hard sections, branches, pathnames, SCT, Zmacs and CP workflows. |
| **Symbolics Version Control Design and Implementation** (`VC Internals`) | 131 | Packages, pathnames, storage records, encaching, streams, file and branch algorithms. |
| **The Lock-simple Network Service** | 28 | Lock naming, holders and server selection, protocol functions, conditions, and setup. |

The `.SAB` files are product files on the purchased media and were decoded only
under ignored `build/help/genera/`. Neither decoded prose nor embedded assets are
tracked. The documentation system declaration distributes Sage sources/binaries,
but the release roster still reader-disables `Version-Control-doc`; distribution
metadata does not prove a live Document Examiner book in the base world.

## Runtime observation and screenshot disposition

A fresh isolated session named `d25-source-compare-20260718`, generation 1, evaluated
only package/function presence and then attempted a comparison between two synthetic
in-memory streams. The presence expression returned `(T T NIL NIL)` for, in order:

1. `SRCCOM:SOURCE-COMPARE-FILES` function-bound;
2. Zmacs `COM-SOURCE-COMPARE` function-bound;
3. `COMPARE-MERGE` package plus exported function present;
4. `VERSION-CONTROL` package present.

This directly confirms the base SRCCOM/Zmacs boundary and the absence of the two
disabled package interfaces in that world. It does not prove that no user could
manually load media components.

The synthetic expression used two string input streams, requested no file, buffer,
server, or Save World mutation, and constructed internal SRCCOM file objects rather
than using the supported Zmacs/file wrappers. Its host typing action exceeded the
10-second XTEST dispatch limit and is correctly recorded as `failed-or-partial`.
Later captures show a complete-looking expression still in the input editor, with no
result or new prompt. The following Keypad-Subtract (Abort) dispatch and the
Control-G key-down, `g`, and key-up dispatches all succeeded at the host level but
did not visibly change that state. This evidence does **not** establish that the form
was submitted or that SRCCOM hung, and no comparison-output behavior is inferred
from it. A future test should use two disposable Zmacs buffers and the public
command.

| Runtime evidence | Value |
| --- | --- |
| Archive | `opengenera2.tar.bz2`, 206,213,430 bytes, SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| World | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM / debugger | 1,533,760-byte VLM `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; 346,880-byte debugger `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Compatibility inputs | config `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`; X preload at execution `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`; ifconfig preload `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; RFC 868 responder `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb` |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; read-only Guix store/helpers/X socket; writable private runtime; no default/external route or guest-visible file service; MIT-SHM live-verified absent |
| Display | Main window `Genera on DIS-LOCAL-HOST`, 1200 by 900; Xvfb screen 1440 by 1100 by 24 |
| Actions | 12 intent/outcome records; final action-log SHA-256 `c1f49288f29c20acb452b8dc85de13a9ab9d7a9f6cb30974438aaa707f3f3045` |
| Shutdown | Confirmation accepted and cleanup observed; known Cold Load channel stall required bounded termination; `forced_stop=true`, `state_may_be_incomplete=true`; the harness invoked no Save World and created no host-process checkpoint, while `save_world_performed` and `guest_checkpoint_created` remain unknown; unsaved Lisp state was discarded, and the private and base world files were unchanged |

No screenshot is embedded or approved for publication in this dossier. The most
useful raw candidate, `0002-presence-now.png`, remains in the ignored session tree;
it is 1200 by 900, PNG SHA-256
`9a54984e0782a2119307e5a93b1928fe71bd31d77a9a972f3094f8280c4fbdea`,
pixel SHA-256
`346779925e9c442a8bea13568f83bed7ae8d4c7d8fe12e43b8a21bf27aa983f5`,
and records the two successful presence checks and two absent packages. It must pass
the repository's image-specific rights review before any later publication.

## Findings the manuals alone do not establish

- System 46 has no recoverable SRCCOM implementation or command in the pinned public
  snapshot; a casual search for the word would misleadingly find only prose.
- Maintained LM-3 `:FORM` comparison is implemented but deliberately removed from
  the interactive query, and its current prompted wrapper appears to misplace the
  type argument.
- The maintained LM-3 and Genera functions named `SOURCE-COMPARE-FILES` use opposite
  Boolean return conventions.
- Genera's “ignore whitespace” option is specifically leading-space/tab
  normalization, not arbitrary whitespace-insensitive comparison.
- The later Genera source contradicts the public manual's still-described mouse
  interface for Source Compare Merge.
- Compare/Merge is an N-way ancestor-aware engine, not a cosmetic rename of SRCCOM.
- Compare/Merge's accepting-values source never assigns the returned
  `EDIT-DIFFERENCES-P` variable in the inspected logical revision.
- Version Control's mode menu retains **Show VC Section Data** after its only
  implementation was block-commented.
- The internal guide documents **UnKill Hard Section**, but the inspected media has
  no live definition; current source instead adds several commands absent from the
  guide's summary.
- `VC` has no public export plan, while the deliberately exported `VCI` substrate has
  85 names, including six whose first character is a Lisp-machine byte that should
  not be guessed into Unicode.
- Most importantly, release-media source and VBIN presence does not override the
  roster's four explicit reader-disables or the base runtime's absent packages.

## Open questions and safe next tests

- Run maintained LM-3 SRCCOM against two synthetic files on a disposable private
  CADR disk, then compare the live function identity with the current Fossil source.
- Repeat the Genera comparison through two disposable Zmacs buffers, test literal,
  case/style, and leading-whitespace modes, and record whether three matching lines
  are visibly required for resynchronization.
- Confirm the eight Source Compare named commands through live Zmacs Help and capture
  only a minimal synthetic difference after separate screenshot review.
- Do not load Compare/Merge or Version Control merely to obtain screenshots. First
  reconstruct their dependency graph in a disposable copied world, determine whether
  Lock-simple can be safely stubbed or isolated, and audit every file-writing and
  network-lock path.
- Determine which 006 edit-selection rules produced the shipped VBINs before treating
  raw evacuated source alternatives as one evaluable program.

## Public sources

- MIT CADR System 46, [public source snapshot](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af),
  revision `8e978d7`; verified 2026-07-18.
- LM-3 maintained source, [`io1/srccom.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/io1/srccom.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`zwei/dired.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/dired.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  Fossil check-in `4df393c`; verified 2026-07-18.
- Symbolics, [Editing and Mail, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  especially “Comparing Files and Buffers”; verified 2026-07-18.

## Portable licensed-source evidence

The following files are untracked licensed inputs. Only paths relative to the staged
media root, byte counts, hashes, and original analysis are recorded.

| Portable artifact | Bytes | SHA-256 | Evidence used |
| --- | ---: | --- | --- |
| `sys.sct/io1/srccom.lisp.~4033~` | 18,235 | `ff672a93bf51bb8b29604e19dd4fc96b369b23e53602fb28c804c9c6bc5cbd95` | Genera SRCCOM core |
| `sys.sct/zwei/misc-buffers.lisp.~15~` | 33,327 | `4fad1aadf4a9a6f81bb241d537c81fff178974a8cd1eefa3a6d3395083f4afad` | Zmacs compare/merge commands and query controls |
| `sys.sct/zwei/dired.lisp.~465~` | 78,695 | `d988987ca7220fd156a0c35eca2651e009c0054a8b9b86774890bfcaa6055da5` | Dired compare integration |
| `sys.sct/zwei/files.lisp.~378~` | 88,157 | `f627f666b0fe9ca7a1450526f081685b95b2c7e522a06d71b6db962345e957bc` | changed-file Compare query |
| `sys.sct/zwei/zmacs.lisp.~1058~` | 31,456 | `082959472626b04d74631ada24bb8ad164bc44ef19f292343f905fbf10bf1d2f` | eight installed named commands |
| `sys.sct/zwei/window-commands.lisp.~9~` | 16,387 | `700ff88a8e90439f74b392338b61f9961ae651f8a16d8ac85183e52b517ab00f` | Compare Windows |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` | four reader-disabled roster entries |
| `sys.sct/site/lock-simple.system.~3~` | 2,339 | `1682fd3b9095d2b5207fd89650503e8a615bdd81317c66e82589518fdfd197a8` | Lock-simple media presence |
| `sys.sct/site/compare-merge.system.~4~` | 270 | `a6f2e727b0ff314538ed5fde7db5f9a5ae1500e9f7c2dfe907ace3bc665083e9` | Compare/Merge site declaration |
| `sys.sct/site/version-control.system.~9~` | 258 | `e78cb5da1aa299a89f7d904bb4dc47353e7bc8f1d8b525b2159d2c391a38adb2` | Version Control site declaration |
| `sys.sct/site/version-control-doc.system.~1~` | 326 | `a612401f9a17ba95ea76305e767732d365fc29e660a64b296a46d9ebc759fcf7` | documentation site declaration |
| `sys.sct/version-control/compare-merge/sysdcl.lisp.~22~` | 3,581 | `7dea4f95c5865dcaf840ea282b02a01566f353d9ee00d864f6b714b934e40b1f` | system/API declaration |
| `sys.sct/version-control/compare-merge/compare-merge.lisp.~3007~` | 101,998 | `d3cba66a21f24ba3204c954b255276eb926b2ecd7f1302aa8a8527b343ed05ea` | N-way algorithm |
| `sys.sct/version-control/compare-merge/editor-interfaces.lisp.~3020~` | 68,264 | `04b2327f663f9ceaac7397c9fa371ba48166c195e6fdbc11f18e7e7317989236` | UI, commands, controls, 006 edits |
| `sys.sct/version-control/vc/version-control-sysdcl.lisp.~40~` | 5,827 | `2e2ff9901be88d8e22e7628677e03e3d43e5a586c0a7011059ef1576c3d7bf59` | VC subsystem graph |
| `sys.sct/version-control/vc/version-control-doc-sysdcl.lisp.~15~` | 3,738 | `58021823cfdf049a78a2174a25430e1f7a360a7454f70581bc1a9a37834ae157` | three Sage books |
| `sys.sct/version-control/vc/package-declarations.lisp.~7~` | 6,429 | `a6af1162b3712f16d01eeed00f1145db2f0435e775e2b407072d8f8fc31c8d59` | packages and 85-symbol VCI export list |
| `sys.sct/version-control/editor-support/commands.lisp.~2679~` | 39,276 | `7c7e60864075d91f73f42d6ab105a91e74cba84edc55d6374fd42d0144120394` | 24 live editor commands and one commented command |
| `sys.sct/version-control/editor-support/diagram-lines.lisp.~2642~` | 20,299 | `d38bd094522a2168bad4a6eb655eab33f4acd4a256e58ac7b54a6b65e3aafeba` | contextual menu and gestures |
| `sys.sct/version-control/editor-support/vc-file-buffer-mode.lisp.~2612~` | 4,849 | `fc11f3cbf8ea222906038d88dd5b1966bfae756c8858aba0b4001e202c1b7915` | fixed keys and 17-label mode menu |
| `sys.sct/version-control/tools/tree-converter.lisp.~2616~` | 16,802 | `4cdf4c50f5c614d1051ce5c2a8dad4d89029bbda1078ff8fdec94b1bf8552a3b` | two tree conversion commands |
| `sys.sct/version-control/tools/tablewear.lisp.~2607~` | 8,782 | `ce10f3fce8c0b498034acd6941153cb9405b4cc1d3fe021dfce67ace52af6323` | Fork VC System |
| `sys.sct/version-control/tools/extraction.lisp.~2607~` | 7,427 | `f1926a577882e89078ccb6c467336e8dc18995b484a827d97b2606ed33dc9b17` | Extract VC File Version |
| `sys.sct/version-control/tools/conversions.lisp.~2638~` | 50,522 | `cc75ec52fe521ed76b879034dbab2180cbdea90a3bc27f158b2b6b763d738231` | conversion and branch display commands |
| `sys.sct/version-control/tools/compact.lisp.~2600~` | 51,018 | `e10330fc01a24fed3cfb3d7661b895d215b1019cad94784262e27d36948052ac` | compact archive commands |
| `sys.sct/version-control/patches/patch-from-branch.lisp.~2615~` | 21,372 | `6d730da7820693be4272eaec33341a76bae03fcb26c0ce899c203e3b1af363fd` | four branch-to-patch commands |
| `sys.sct/version-control/patches/patches.lisp.~2611~` | 20,164 | `6f677136b093b0ab3c7fcd01c86807b1c24435b25920ff677596e49b1add05fc` | Show VC Patch and SCT integration |
| `sys.sct/version-control/design/vc-document.sab.~39~` | 132,519 | `f82d5dda252c22d0c00cfd95ff4f540606ec1780ac08f09510dcf7eda8ca0d8e` | 82-record internal user guide |
| `sys.sct/version-control/design/internals.sab.~6~` | 164,072 | `f341e9a9058cc7f8d1001ab7b18b12fedffdc36c1b6a0980f2e90a6c4813123b` | 131-record design guide |
| `sys.sct/version-control/design/lock-server-doc.sab.~6~` | 29,112 | `650a48714f942f580215d8e99180751c91fef655147a6bf4a40becc7f9c844da` | 28-record Lock-simple guide |

## Public LM-3 file identities

| Artifact at Fossil check-in `4df393c` | Bytes | SHA-256 |
| --- | ---: | --- |
| `io1/srccom.lisp` | 19,170 | `404e922a773e39c0afc35c77eb390f064357202b9e26e2f031f4c37aa8d86b29` |
| `sys/sysdcl.lisp` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` |
| `zwei/dired.lisp` | 110,561 | `34155fec3311a969cfbed31c640b59159f28251b179f51b4c4a6c08b19c9eb34` |
| `zwei/zmacs.lisp` | 115,156 | `513f39d440a6612ff7d3d540a62b397fe6348456bd36a450262ff6fa372799d0` |
