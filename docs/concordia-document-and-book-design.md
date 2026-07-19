---
type: Artifact Analysis
title: Concordia, structured documentation, and book design
description: An evidence-graded study of Symbolics Concordia authoring, NSage records and formatting, the Page Previewer, Book Design Browser, complete application-specific command surfaces, file formats, and the CADR and LM-3 boundary.
tags: [genera, concordia, nsage, writer-tools, book-design, page-previewer, documentation, preservation]
timestamp: 2026-07-18T09:48:00-04:00
---

# Concordia, structured documentation, and book design

## Conclusion

Symbolics Concordia is not simply a word processor or a page-layout program. It is
an integrated structured-document production environment built around the NSage
record database and formatter. Authors edit independently addressable documentation
records through a structural Zmacs mode, connect those records into books with typed
links, preview and print the resulting pages, embed object and bitmap graphics, and
inspect or modify the Lisp book-design specifications that map document semantics to
an output device. The same installed records can then be retrieved on-line by
Document Examiner.

The central source artifact is a `.sab` file. It is binary, but it is neither a VLOD
world snapshot nor merely an opaque compiled object. It is a purpose-built,
machine-independent serialization of named documentation records, their typed
fields, structural and formatter markup, links, indexes, pictures, histories, and
symbol/string tables. Symbolics' own system tools treat `.sab` files as source files;
the documentation system has no corresponding `.bin` or `.ibin` object for each
module. The tracked inert extractor demonstrates that useful structure can be
recovered without running licensed code, but every decoded Genera payload remains
ignored licensed output.

At the inspected media boundary, Concordia 444 combines four configurations inside
one Dynamic Windows program frame:

1. the Concordia structural editor;
2. the Page Previewer and formatter front end;
3. the object-based Graphic Editor; and
4. the Book Design Browser.

The source-defined Concordia mode adds 74 named commands and 24 direct keystroke
bindings to inherited Zmacs. Its mouse command pane organizes 14 categories of
ordinary editing and document operations. The Page Previewer has 26 active named
commands at the chosen source boundary, including formatter, navigation, hardcopy,
tag, index, option, Help, and printer-queue commands. The Book Design Browser has 11
active application commands, 10 of them in its fixed menu.

A fresh isolated Genera 8.5 run established a partial load boundary. `SAGE` and
`NSAGE` named the same resident package, but the Concordia program, Page Previewer,
Book Design Browser, and bound Writer Tools command table were absent. Looking up
the optional Concordia system fell through to the unconfigured world's inaccessible
site system host; no optional system was loaded. Consequently this page has no
published Concordia screenshot. The runtime proves the resident/optional boundary,
not the visible behavior of an actually loaded Concordia frame.

The public MIT CADR System 46 snapshot has no Concordia, Sage, Writer Tools, Page
Previewer, or Book Design Browser implementation. The maintained LM-3 System 303
archive is more revealing: historical bug and release records name `Basic Sage` and
`Writer Tools` across several old system versions, but the pinned public source
manifest contains no corresponding subsystem paths. Those records establish an
antecedent product line, not a recoverable public implementation and not proof that
Concordia ran on the System 303 restoration band.

## Scope and evidence notation

This page keeps four evidence classes separate:

- **Manual** means the public archival Concordia manuals and release notes linked in
  [Sources](#sources). They describe intended operation, but not every active command
  or later implementation detail.
- **Source** means direct inspection of the licensed local Open Genera source and
  system records identified by checksum below. Only original analysis and short
  identifiers are published; no licensed implementation is reproduced.
- **Installed help** means structural inspection of locally recovered Sage records.
  Counts, topic names, and disagreements are evidence; recovered prose and pictures
  remain ignored.
- **Runtime observation** means the isolated Xvfb session of 2026-07-18. It tested
  only package, symbol, and system residency in that exact base world.

“Complete” means complete for active definitions installed into the named command
tables in the inspected source snapshot, using the inclusion rules stated with each
inventory. It does not include the full inherited Zmacs command universe, inactive
block-commented experiments, debugging-only commands gated out of normal use, site
patches, or every historical Concordia release.

## Release identity and component boundary

The media separates the document substrate, authoring application, and installed
documentation:

| System | Released version | Role |
| --- | ---: | --- |
| `NSage` | 440 | Record registry, `.sab` reader/writer, formatter, environments, counters, collectors, devices, database, and Document Examiner substrate. |
| `Concordia` | 444 | High-end Writer Tools activity: structural editor, Page Previewer, Book Design Browser, graphics integration, locking, indexing, patching, source comparison, and Scribe conversion. |
| `Concordia-Doc` | 432 | Installed Concordia manuals and command documentation. |

The Concordia system directory was written on 1998-09-08 under System 452.16. Its
dependency context records NSage 440, Image Substrate 440.4, Graphic Editing 441,
Graphic Editor 440, Bitmap Editor 441, Postscript 436, Lock Simple 435.1, and
Concordia Documentation 431. The separate Concordia documentation directory was
written on 1998-10-05 under System 452.11 and releases `Concordia-Doc` 432. NSage's
directory was written on 1997-09-10 under System 452.1 and releases NSage 440.

The main declaration advertises `Symbolics Concordia` in the herald, gives it Select
key `W`, and loads Image Substrate, Graphic Editor, Bitmap Editor, Postscript, Lock
Simple, the internal Concordia subsystem, and Concordia documentation. Fonts and
documentation are dependencies of the application, but they are not evidence that
Concordia is preloaded in every world. The runtime result below demonstrates that
the inspected Genera 8.5 base world has NSage package state without the optional
Concordia activity.

The public consolidated manual is a 2018 archival rendering of documents from
several product eras. It includes Concordia 3.1 material and older 7.3/7.4 release
notes alongside a later source-media snapshot. A feature stated in one section is
therefore not silently treated as the exact behavior of every released system.

## What Concordia is for

### One corpus, two principal reading forms

**Manual and source:** a record is the independently retrievable unit. It has a
unique topic/name and type, fields such as contents and keywords, an identity in the
record registry, and links to other records. Authors can compose one physical book
from records spread across several `.sab` files, while Document Examiner can retrieve
an individual record without reconstructing that book's printed order.

This dual use changes the writing model:

| Concern | Concordia representation |
| --- | --- |
| On-line lookup | A typed, independently meaningful record registered by topic and identity. |
| Printed hierarchy | Include/contents links rooted at a chosen record group; not the physical sequence in a file. |
| Cross-reference | A typed link resolved against registry and formatter state. |
| Formatting | Semantic commands and environments interpreted under a document-device type. |
| Illustration | A picture object, compact Graphic Editor drawing, bitmap/image, or other registered picture type embedded in a record. |
| Publication | Installed or published record versions plus documentation-system journals and indexes. |

The physical order of records in a `.sab` file does not define the book. Reordering
or relinking records can change a document hierarchy without copying the underlying
record text. Conversely, a record written for on-line lookup needs enough context to
stand alone even when its printed parent and neighbors are absent.

### The four configurations are one activity

**Source:** `Concordia` is one Dynamic Windows program with four configurations,
not four unrelated processes. Each embedded program frame is created with no
separate process. The persistent top title and selector pane switch the rest of the
frame among these layouts:

| Configuration | Principal panes and role |
| --- | --- |
| Editor | Current-record title, Zmacs structural editor, expandable Editor Commands pane, and Collected Record Names pane. |
| Page Previewer | Formatted-page display plus its four-line command interactor. |
| Graphic Editor | The embedded structured-drawing program frame. |
| Book Design Browser | Book-design display, fixed command menu, and three-line interactor. |

The always-visible selector uses four application font glyphs. The editor is the
initial configuration. Graphic Editor callbacks can return directly to it, and the
Page Previewer `Edit Record` command switches back to it after queueing the edit.
See [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md)
for the illustration subsystem's own complete command and format analysis.

The public guide documents switching by the four icons and by a Super-Select
sequence for Editor, Page Previewer, Graphic Editor, and Book Design Browser.
The inspected Super-Select hook, however, recognizes only `E`, `P`, and `G`; it has
no Book Design Browser entry. The source does include the Browser icon and the
`Change Configuration` command. This is a source/manual discrepancy, not grounds to
invent a fourth key.

## Record and editor data model

### Registry, record group, and multiple versions

**Source:** the registry groups records by topic, type, and unique identity. A record
group can refer to published, installed, and one or more edited records rather than
overwriting one undifferentiated value. Lookup mode selects among three policies:

| Mode | Source-defined policy |
| --- | --- |
| Normal | Prefer the newest edited/installed record, otherwise use the published record. |
| Use Published Record | Resolve only the published record. |
| Edit Newest Record | Read the newest `.sab` version containing the record into the editor. |

Installing an edited record clones and canonicalizes it, updates index information,
and marks both editor and installed copies. Published and edited link sets can
therefore disagree temporarily; commands that show links distinguish which version
contributes a relationship.

The editor tracks modification, installed, published, and checkpointed state. A
coarse file lock protects writing a `.sab` buffer; it is not a per-field or per-link
transaction. `Set Buffer Disposition` can lock a connected file or disconnect the
buffer, while `Break File Lock` forcibly removes a lock and is explicitly a recovery
operation, not normal collaboration.

### Fields exposed by the structural editor

The active field construction is type-sensitive:

| Record kind | Fields represented as structural editor nodes |
| --- | --- |
| Every documentation record | `Source-Topic`, `Contents`, `Oneliner`, `Keywords`, `Related`, `Notes` |
| Lisp record specialization | `Arglist` |
| Concept record specialization | `Source-Title` |

`Contents`, `Oneliner`, and `Keywords` are created by default. `Source-Topic`,
`Related`, `Notes`, `Arglist`, and `Source-Title` are available but suppressed from
automatic creation. `Add Record Field` exposes the optional fields appropriate to
the current record type; `Update Arglist Field` derives an object record's argument
list from the live definition when possible.

### Structural Zmacs, not decorated flat text

The `.sab` file type selects `Concordia` major mode. The editor maps records, fields,
formatter environments, formatter commands, links, pictures, and record markers to
Zwei structure nodes. Text remains editable through Zmacs, but markup appears as
diagram nodes with structural extent. Commands such as Beginning/End Environment,
Remove Markup, Kill Environment, and Change Environment act on those objects rather
than searching for visually similar punctuation.

This explains several otherwise surprising behaviors:

- deleting a record from a buffer and killing/undocumenting it are different
  operations;
- `Remove Markup` retains the environment's contents, while `Kill Environment`
  removes both wrapper and contents;
- links have editable views and targets rather than being mere text labels;
- moving records among buffers preserves registry identity;
- pictures can invoke an external editor and later regenerate their encoded display;
- `Parse and Replace Region` converts flat at-sign formatter syntax into structure,
  while its inverse operation is a separate unparse action.

### Link views and document structure

The active source list contains four link views:

| View | Role |
| --- | --- |
| `Include` | Expands the target's material into the document hierarchy. |
| `Contents` | Establishes contents/hierarchy relationships without the ordinary full include presentation. |
| `Crossreference` | Refers to a target while leaving it structurally elsewhere. |
| `Precis` | Uses a summarized view of the target. |

A `Topic` entry survives only behind an ignored reader conditional and is not part
of the active list. `Graph Links From Record` is narrower than its name might imply:
the source says it graphs structural links and does not display every crossreference
or other view. `Find Orphan Records` also uses a pragmatic preservation definition:
it finds records with no incoming links or with no contents, not a proof that a
record is semantically unused.

## Concordia editor interface

### Editor Commands and Collected Record Names panes

**Source and manual:** the right-side Editor Commands pane is a direct-manipulation
index into the structural editor's command table. Clicking a category heading with
the selection gesture expands or contracts it; the menu gesture opens that
category's commands in a pop-up. Operating on the all-categories heading provides
these exact setup operations:

| Operation | Effect |
| --- | --- |
| Hide All / Show All | Contract or expand every category. |
| Reorder | Drag categories into a new order. |
| Reset To Default | Recompute the shipped category set and order. |
| Save Set | Put a Lisp setup form on the Zmacs kill history for insertion into an init file. |
| Redisplay | Force a hard redraw of the command pane. |

The customization is live state unless the generated setup form is saved and later
evaluated. The separately named `Insert Concordia Menu Choices` command instead
opens a boolean form and inserts a `setq` form into the current buffer; it is not in
the normal Writer Tools command table inventoried below.

The Collected Record Names pane stores convenient link targets. Creating records
and explicit collection commands add names; clicking a name can supply it to a link
operation, and a presentation command removes a collected name. Dragging the pane's
title with the selection gesture resizes the pane. The implementation treats other
gestures on that title as abort/no-operation paths rather than text editing.

### Complete visible category menu

This is the complete normal category definition in `comtab.lisp.~52~`. A name in
this table means it is exposed through that mouse pane; commands that exist only by
name or keystroke appear in later inventories.

| Category | Complete source-defined entries |
| --- | --- |
| Buffers | Beginning, End, Next Screen, Previous Screen, Mark, Find File, Save, Select, Select Previous, Set Buffer Disposition, Find Orphan Records |
| Topics | Show Outline, Hardcopy |
| Links | Show Links From Record, Show Links To Record, Graph Links From Record, Create Link, Create Link and Record, Edit Link, Find Link, Reverse Find Link |
| Records | Beginning, End, Mark, Create, Edit, Kill, Add Record Field, Rename, Preview, Check Spelling, Show Records in Buffer, Collect Record Name, Collect All Record Names, Reorder Records, Move Records Among Buffers, Add Patch Changed Records, List Changed Records |
| Markup | Beginning, End, Create, Make Language Form, Remove Markup, Change Environment, Kill, Find Markup, Reverse Find Markup, Find Markup String, Reverse Find Markup String |
| Kill History | Yank From Kill History, Yank Previous, Show Kill History |
| Marked Regions | Fill, Interchange, Copy, Kill, Hardcopy, Sort Lines, Sort Paragraphs |
| Paragraphs | Beginning, End, Mark, Fill |
| Sentences | Beginning, End, Kill Forward, Kill Backward, Kill, Mark |
| Words | Forward, Backward, Delete Forward, Delete Backward, Capitalize, Uppercase, Lowercase, Mark, Interchange |
| Lines | Beginning, End, Up, Down, Kill Forward, Kill Backward, Open, Interchange |
| Characters | Forward, Backward, Search Forward, Search Backward, Interchange |
| Character Style | Change Region to Italic, Change Region to Bold, Change Region to Regular, Show Character Styles, Change Typein Style |

A `Debugging` category is created only when the private `*debugging-sage*` switch is
enabled. It is excluded from the public user surface and from the counts here.

### Complete direct key and mouse bindings

The mode inherits ordinary Zmacs motion, editing, search, window, macro, and file
commands. The following table is complete for literal bindings added or changed by
the inspected Concordia mode table:

| Gesture | Concordia operation |
| --- | --- |
| Mouse-Right | Pop-up of Update Arglist Field, Add Record Field, Edit Record, Show Links To Record, Install Record, Check Spelling of Record, Change Typein Style, Change Style Region, Uppercase Region, Lowercase Region, Show Records in Buffer, List Buffers, Kill or Save Buffers, and Split Screen. |
| Super-A | Beginning of Record |
| Super-E | End of Record |
| Super-H | Mark Record |
| Super-. | Edit Record |
| Super-P | Preview Record; a numeric argument requests hardcopy through the Topics menu entry. |
| Super-L | Make Language Form |
| Super-M | Create Markup |
| Super-^ | Remove Markup |
| Super-K | Kill Environment |
| Super-F | Forward Environment |
| Super-B | Backward Environment |
| Super-( | Beginning of Environment |
| Super-) | End of Environment |
| Super-W | What Record Am I |
| Super-I | Insert Multilevel Index Entry |
| Meta-@ | Mark Whole Word |
| Meta-Q | Fill Paragraph using markup-aware boundaries |
| Super-Tab | Insert Tab-to-Tab-Stop formatter command |
| Super-_ | Insert Em Dash formatter command |
| Super-= | Insert Collect-Centering formatter command |
| Super-> | Insert Collect-Right-Flushing formatter command |
| Super-Help | Show the commands specific to Writer Tools mode |
| Super-S | Find Markup String forward |
| Super-R | Find Markup String backward |

Concordia deliberately undefines Control-;, Meta-;, Meta-N, Meta-P, Meta-Line, and
Control-Meta-; in this mode because the inherited Lisp comment commands would damage
the structural representation. The comment in the source recommends the structural
Super-M route for comments instead.

Loading Concordia also changes tables outside its mode:

- the global Zmacs table receives Super-. for `Edit Record` and the named
  `Concordia Mode` command;
- the global Zmacs named-command set receives `Align Table Tabs`, which calculates
  common tab stops for marked table lines;
- the standard Zwei table receives Super-Space `Again` and Super-Backspace
  `Reverse Again`, replaying the last minibuffer command without reconfirming its
  arguments; Reverse Again negates its numeric argument.

Those are source-visible global side effects of loading Concordia, not intrinsic
bindings in an unloaded Genera world. The 7.3/7.4 notes also warn that left-side
Super+Shift combinations and Super-Select were unreliable on MacIvory keyboards;
they recommend the right modifier keys or the on-screen icons for that environment.

## Complete Concordia-mode named-command inventory

### Inclusion rule

The count is the 74 unique commands explicitly supplied to the active `*wt-comtab*`
command alist in `comtab.lisp.~52~`. A second form repeats `Convert Flat Text to
Record`; it is counted once. The ordinary inherited Zmacs set, menu aliases with a
numeric argument, inactive commented commands, and debugging commands are excluded.
The descriptions below combine implementation docstrings with direct control-flow
inspection; they are not copied manual prose.

### Buffer, syntax, record, and registry commands

| Command | Source-defined behavior |
| --- | --- |
| Set Lisp Syntax | Selects Lisp syntax for the editor buffer through inherited Zwei support. |
| Edit Record | Prompts for a registered topic, ensures its editable record is in a buffer, and selects it. |
| Edit Installed Record | Opens the currently installed version rather than silently preferring an edited copy. The Records menu entry for it is commented out, but the named command is active. |
| Create Record | Creates a typed record after the current record. With a marked region, moves that text into the new record and leaves a chosen link behind. |
| Create Link and Record | Creates a target record and a typed link to it as one operation. |
| Install Record | Clones and installs the current record, or every record in the marked structural region, and updates documentation lookup/index state. |
| Check Spelling of Record | Runs spelling correction over the current record contents, or over all records in the marked structural region. |
| Set Lookup Mode | Chooses Normal, Use Published Record, or Edit Newest Record lookup policy. |
| Copy Record | Creates a new record from another record's contents; other fields are not indiscriminately cloned. |
| Add Record Field | Adds or moves to an optional field allowed for the current record type. |
| Update Arglist Field | Recomputes the argument-list field for the current documented definition. |
| Remove Record From Buffer | Removes the structural record node without updating the documentation database; remembers the record so `Insert Record` can restore it. |
| Kill Record | Undocuments the record while leaving a tombstone so its identity and removal are represented. |
| Rename Record | Changes the current record's registered name. |
| Change Record Type | Changes the registry/documentation type of the current record. |
| Insert Record | Inserts an existing edited record, defaulting to the record most recently removed from a buffer. |
| Exchange Records | Swaps the adjacent records around point. |
| Show Records in Buffer | Displays the buffer's record inventory. |
| Count Records in Buffer | Counts structural records in the current buffer. |
| Reorder Records | Opens the record sequence in the reorder menu. |
| Move Records Among Buffers | Uses a sequence-alteration menu to redistribute selected records among Concordia buffers. |
| Sort Records | Sorts records in the buffer using the command's chosen ordering. |
| Collect Record Name | Adds the current record to Collected Record Names. |
| Collect All Record Names | Adds all record names in the current buffer to the collection. |
| Clear Record Name Collection | Empties the Collected Record Names pane. |
| Set Record Name Prefix | Sets text prepended to subsequently created record names, ignoring leading whitespace in the setting. |
| Set Record Name Suffix | Sets text appended to subsequently created record names, ignoring trailing whitespace in the setting. |
| Clear Record Name Prefix | Removes the active creation prefix. |
| Clear Record Name Suffix | Removes the active creation suffix. |

### Links, markup, pictures, examples, and generated matter

| Command | Source-defined behavior |
| --- | --- |
| Create Link | Inserts a selected link view to a registered target record. |
| Edit Link | Edits the attributes of the structural link at point. |
| Show Links From Record | Groups outgoing links from the selected record by view. |
| Show Links To Record | Shows records that point to the selected target, retaining version distinctions when necessary. |
| Graph Links From Record | Graphs structural contents/include relationships; the source explicitly does not claim every link view. |
| Sort Links in Record | Reorders links within the current record. |
| Find Link | Searches forward for a target/view pair; a negative numeric argument reverses direction. |
| Reverse Find Link | Searches backward for a target/view pair; a negative numeric argument reverses direction. |
| Create Environment | Wraps the region, when present, in a selected formatter environment. |
| Create Command | Inserts a formatter command with accepted arguments. |
| Change Environment | Edits the specifications on the current formatter environment. |
| Query Change Environments | Walks occurrences of one environment and asks whether to replace each with another. Its source says it is not connected to Undo. |
| Parse and Replace Region | Parses flat at-sign formatter text and replaces the region with Concordia structure. |
| Find Markup | Searches for a named markup environment in the numeric-argument direction. |
| Reverse Find Markup | Performs the complementary directional markup search. |
| Change All Record Views | Changes the displayed structural view of all record nodes in the buffer. |
| Change Record View | Changes the structural view of the record at point. |
| Create Picture | Inserts a picture after accepting picture type, source, and name. |
| Recompile All Pictures of Buffer | Regenerates picture encodings from their registered source/editor representations for the region or buffer. |
| Insert Graphic Editor Drawing | Opens/selects a drawing in Graphic Editor and embeds its compact display encoding. |
| Create Example Record Marker | Associates the example at point with a selected record kind. |
| Test Example | Executes the active example environment and updates associated records. |
| Make Active Text | Associates marked text with a Dynamic Windows presentation type and object. |
| Insert Whole Index | Recomputes the index from a topic already formatted in this Concordia activity and inserts its directives into the buffer. |
| Insert Whole TOC | Performs the analogous insertion for a table of contents. |
| Collect Index Entries of Topic | Recursively expands a topic and gathers title, keyword, and explicit index entries into an `*Index-Entries*` split-screen buffer. |
| Collect Index Entries of Tag Table | Gathers entries from every `.sab` file represented in the current tag table. |
| Collect Index Entries of Buffer | Gathers entries from all records in the current buffer. |
| Show Outline | Displays the linked outline rooted at a chosen topic. |

### Conversion, change control, repair, and configuration commands

| Command | Source-defined behavior |
| --- | --- |
| Convert Flat Text to Record | Uses the first nonblank line of a marked region as the default title, creates a typed record from the remaining text, and replaces the original region with a chosen link. |
| Add Patch Changed Records | Queries over changed, unpatched records in all Concordia buffers and adds approved records to the current patch. |
| Add Patch Changed Records of Buffer | Restricts that operation to the current buffer. |
| List Changed Records | Lists changed records across Concordia buffers and installs a possibility sequence navigable with the standard next-possibility command. Numeric mode distinguishes changes since read from changes since save. |
| List Changed Records of Buffer | Restricts the changed-record report to the current buffer. |
| Show Modification History | Reports who modified the current record and when. |
| Kill Whole Sentence | Removes the complete sentence containing point. |
| Mark Whole Sentence | Marks the complete sentence containing point. |
| Set Buffer Disposition | Chooses the file connection/lock disposition for a Concordia buffer. |
| Break File Lock | Forcibly removes a write lock after the operator determines its owner is no longer going to save. |
| Source Compare | Compares files or buffers and merges differences into the selected output buffer; numeric bits control case/style and leading-whitespace treatment. |
| Find Orphan Records | Finds registered records that lack incoming links or contents. |
| Find Orphan Records in Buffer | Restricts orphan checking to the current buffer. |
| Find Orphan Records in Tag Table | Checks buffers represented by the current tag table. |
| Remove Run-In Markers | Inserts line breaks needed to eliminate run-in marks over the region or whole buffer. |
| Change Configuration | Switches the enclosing Concordia frame among its allowed configurations. |

`Create Markup`, `Find Markup String`, and `Reverse Find Markup String` remain
active direct-key/menu commands described above, but the inspected source does not
supply them to the mode's named-command alist. They are therefore deliberately not
part of the 74 count.

## Page Previewer and formatter workflow

### What “preview” means here

The Page Previewer is a formatter front end and page browser, not a passive bitmap
viewer. `Format Pages` expands the chosen record hierarchy, evaluates formatter
commands and environments under a document-device type, performs line and page
breaking, constructs headings and collectors, resolves tags and case options, and
stores page-box objects with semantic presentations. It can produce an index and
table of contents and optionally send the result directly to a printer.

The manual warns that screen spacing and fonts need not exactly match printed
output. Source inspection explains why: formatted pages are device-aware box trees,
and display is a rendering of those trees, not a raster capture of printer bytes.
Page border presentations navigate backward and forward; page numbers and index
entries are presentations that can select a page; record presentations can switch
back to the editor.

The frame keeps a hash table from record group to formatted-pages object. Each
entry contains the page sequence plus final ambient values, final heading state, and
any improperly referenced tags. `Show Formatted Pages` switches among these cached
results during the boot. This cache is Lisp-world state; the source does not claim
that it is a durable host-side page cache.

### Format Pages options and validation

| Argument or option | Active behavior |
| --- | --- |
| Topic | Root record group to expand and format. |
| Printer | Optional immediate hardcopy destination after successful formatting. |
| Index | Generate an index; default is the formatter's index setting and the mentioned default is Yes. |
| TOC | Generate a table of contents; default is the formatter's TOC setting and the mentioned default is Yes. |
| Query | `All`, `None`, or `Unassigned` policy for asking about Case selectors. |

Each run increments a formatter timestamp, clears stale Case bindings and the list
of unassigned selectors, and can reuse the prior formatted result's final ambient
values. After building pages it annotates presentations that cross a page boundary,
selects the first page, checks tag references, reports unassigned Case selectors,
and clears transient Case bindings again. This last validation work is easy to miss
if the Page Previewer is described only as “print preview.”

`Set Widow Action` has four exact policies:

| Choice | Meaning in the source |
| --- | --- |
| Force | Keep widows and orphans with the rest of the paragraph. |
| ForceWarn | Apply Force and warn. |
| Ignore | Do not handle widows or orphans specially. |
| Warn | Apply Ignore behavior and warn. |

`Change Layout` switches between `Single-Page` and `Two-Page`. Next/Previous move
one page in single-page mode and two in two-page mode. `Set Page` searches by the
page's rendered page-number string, starting after the current spread and wrapping
around, rather than assuming page labels are consecutive integers.

### Complete Page Previewer command inventory

The inclusion boundary contains 18 commands defined directly by the Page Previewer
and BIX modules, three NSage variable commands explicitly installed into its table,
and five ordinary Help/printer operations available through the inherited command
environment. Disabled block-commented forms and the `#+Franz` experimental formatter
are excluded. Two active definitions retain comments saying they are probably or
only for debugging; they are included because the source still installs them.

| Command | Origin | Behavior and important options |
| --- | --- | --- |
| Edit Record | Page Previewer | Queues an edit of the selected record group and switches the enclosing Concordia activity to the editor. |
| Format Pages | Page Previewer | Formats a topic with optional printer, Index, TOC, and Case-query controls; validates tags and selectors. |
| Reformat End Pages | Page Previewer | Formats a topic's end matter into a separately named cached result. The active source calls it probably debugging-oriented. |
| Next Page | Page Previewer | Advances one page or one two-page spread. |
| Previous Page | Page Previewer | Moves backward one page or spread. |
| Set Page | Page Previewer | Selects a formatted page by its displayed page-number presentation. |
| Set Widow Action | Page Previewer | Selects Force, ForceWarn, Ignore, or Warn. |
| Change Layout | Page Previewer | Selects Single-Page or Two-Page display. |
| Describe Page | Page Previewer | Calls the object inspector description on a selected page-box; the active definition is marked debugging-only in a comment. |
| Show Formatted Pages | Page Previewer | Selects a cached formatted record group and can optionally hardcopy all its pages. |
| Hardcopy Pages | Page Previewer | Outputs a selected inclusive page range to a printer or printer-format file, optionally in a background process. Reversed endpoints are normalized. |
| Save Tags | Page Previewer | Writes a `.CTAGS` reconstruction file for counters, tag values, citations, and the owning record-group identity. |
| Restore Tags | Page Previewer | Loads `.CTAGS` forms in a guarded Page Previewer context and attaches the restored values to cached formatter state. |
| Show Tags | Page Previewer | Displays tag and citation state from a formatted topic or a `.CTAGS` file. |
| Show Improperly Referenced Tags | Page Previewer | Reports tags marked erroneous in the current formatted-pages result. |
| Show Unassigned Case Selectors | Page Previewer | Reports formatter Case selectors for which no value was assigned. |
| Save Index | BIX module | Writes the current formatted topic's index entries to a `.BIX` binary file. |
| Format Merged Index | BIX module | Reads a text list of `.BIX` files, reconstructs their entries with registered-book mnemonics, and formats one merged index. |
| Set Sage Variable | NSage command | Sets a named formatter/document option for later formatting. |
| Clear Sage Variable | NSage command | Removes a named formatter/document option. |
| List Sage Variables | NSage command | Displays the current formatter/document option bindings. |
| Show Overview | Help environment | Displays the Page Previewer overview record. |
| Show Documentation | Help environment | Looks up and displays documentation from the command context. |
| Show Printer Status | Standard hardcopy environment | Reports one or all spooled printer queues. |
| Delete Printer Request | Standard hardcopy environment | Removes a selected queued printer request. |
| Restart Printer Request | Standard hardcopy environment | Restarts a selected queued request. |

The source contains but does not activate `Show Page Containing`, `Check for Bogus
Tags`, and `Discard Ambient Values`; they sit in block comments. `Format Experimental
Record` is guarded by `#+Franz` and explicitly debugging-only. None belongs in the
active count.

### Installed-help gaps

The recovered Concordia help set has ordinary topics for Format Pages and 13 command
topics named as Page Previewer commands: Change Layout, Edit Record, Hardcopy Pages,
Next Page, Previous Page, Restore Tags, Save Tags, Set Page, Set Widow Action, Show
Documentation, Show Formatted Pages, Show Improperly Referenced Tags, and Show
Overview. The active implementation surface is broader.

In particular, `Reformat End Pages`, `Describe Page`, `Show Tags`, `Show Unassigned
Case Selectors`, `Save Index`, `Format Merged Index`, and the three Sage-variable
commands are source-visible even though that named Page Previewer command-topic set
does not cover them. The three printer-queue commands are system-wide facilities and
need not have Concordia-specific help records. This comparison is structural; it
does not claim the public guide never mentions an operation in explanatory prose.

## Formatter state files and outputs

### `.CTAGS` is executable reconstruction data

`Save Tags` does not write a generic JSON-like table. It uses the Genera forms
dumper to write forms in the Sage package that allocate counters, repair circular
parent/child/alias relationships, and restore tag and citation values. `Restore
Tags` invokes the binary loader inside a dynamically guarded continuation; loading
the file outside the command's context is rejected.

For preservation, `.CTAGS` should therefore be treated as trusted Genera/Sage
reconstruction input, not opened as an inert interchange archive. An external
extractor may parse it, but executing an untrusted file would invoke a Lisp loader.

### `.BIX` is a compact index interchange, not a world image

The active BIX format begins with the indexed topic and type, then a 32-bit entry
count. Each entry contains a 32-bit page number, the page-number rendering contents,
the index-entry contents, and a sort string or `nil`, using the SAB symbol and object
encodings. It omits the original live counter graph and reconstructs stand-in page
counters when read.

`Format Merged Index` takes a small text file whose nonblank lines name `.BIX` files;
`!` begins a line comment. Every source index must resolve to a registered book with
a nonempty mnemonic, which prefixes its reconstructed page references. The source
warns that multilevel-index support in this merge path still needs work. `.BIX` is
therefore meaningful, narrow formatter interchange, not a resumable VM snapshot and
not a lossless substitute for the source records.

### Hardcopy and Scribe

Page hardcopy can target the configured printer or a file using that printer's
format. The output pipeline is the Genera hardcopy device system; Postscript is an
explicit Concordia dependency, and older book designs include LGP device paths.
See [hardcopy, Press, printing, and plot output](hardcopy-press-printing-and-plot-output.md)
for the wider cross-system printing substrate.

The 7.3/7.4 notes and the active `toscribe.lisp.~216~` source also preserve an export
route from a documentation topic to Scribe `.mss` source. That is a conversion from
Concordia structure into another formatter language. It is not evidence that `.sab`
itself is Scribe source or that the round trip preserves every Concordia-only
presentation, picture, Case, and book-design behavior.

## Book design model

### Document type, device type, and their pairing

Concordia separates what a document is from where it is rendered:

| Term | Meaning at the book-design layer |
| --- | --- |
| Document type | A family of formatting specifications for a semantic genre such as manual, article, letter, memo, installation guide, approach, or Lisp dictionary. |
| Device type | A rendering target or generic inheritance layer. The public guide names Generic, Screen, LGP2, and Dex. |
| Document-device type | The resolved pairing, such as Letter Screen or a manual design for LGP2. It determines the top-level book-design elements used during formatting. |
| Book-design element | A named bundle of specifications that can inherit from other bundles and contribute environments, counters, collectors, commands, headings, and page style. |
| Environment | The formatting semantics attached to structural markup such as a section, paragraph form, example, table, or list. |

The current source's low-level device registry initializes `Generic`, `LGP2`, and
`LM`, while its output flavors separately implement window/DEX and hardcopy device
protocols. The guide's user-facing device names and the implementation's primitive
device objects are therefore related layers, not a one-to-one enumeration. The
article does not infer unsupported modern printer types from old LGP names.

### Inheritance and effective specifications

Book designs are Lisp source files, principally under `SYS:NSAGE;`. A named element
has definition forms and a source file. A `use` clause names parent elements; the
child inherits their specifications and can add or override values. Top-level
document-device entries compose several elements, so one apparent formatting rule
can originate far from the final document type.

The active model includes at least these kinds of specification:

| Kind | Purpose |
| --- | --- |
| Environment modifications | Set margins, spacing, fonts/styles, line behavior, headings, and other attributes for semantic environments. |
| Counter definitions | Number chapters, sections, pages, figures, tables, footnotes, or site-defined structures; parent counters express hierarchical numbering. |
| Collectors | Gather table-of-contents, figure, table, and index entries during formatting. |
| Commands | Define formatter operations that insert, select, set, refer to, or compute content and state. |
| Top-level style/text clauses | Establish document-level page and text policy. |
| `define`, `modify`, and `first` forms | Define new material, alter inherited material, and control priority/first-use behavior in the design registry. |

This is executable configuration in a live Lisp environment, not a CSS-like static
style sheet. A book design can call functions and register commands. Concordia's
`DynamicText` facility goes further: it can call a named Lisp function while a
record is formatted, so output can depend on document options and machine state.
That power makes source provenance and a controlled evaluation environment important
when preserving or reviving a book design.

### Source organization

The public book-design guide identifies specialized sources for Approach, Article,
Lisp Dictionary, Installation, Letter, Memo, and Reference Cards alongside generic
elements. The inspected media contains corresponding `bd-*.lisp` modules. The
generic modules supply reusable document/device elements; specialized files compose
or modify them rather than duplicating a complete formatter.

The Browser's internal registry retains each book-design element's name, definition
forms, and defining source pathname. `Edit Book Design Element` opens that source in
Zmacs at the defining form. This means the Browser is simultaneously:

- an inheritance and dependency inspector;
- a documentation front end for environment and attribute meanings; and
- a development navigator into editable Lisp book-design source.

It is not a WYSIWYG drag-and-drop page designer. Actual page results are verified in
Page Previewer after definitions are compiled or loaded.

## Book Design Browser interface and commands

### Pane and gesture model

The embedded Browser has a scrollable Display pane, a fixed top-level command menu,
and a three-line Interactor. Command output in the Display pane is presentation
sensitive. A selection or menu gesture on a document-device type, book-design
element, environment, or attribute can describe it, show dependencies, edit its
source, or retrieve its documentation according to type and gesture.

The source disables keyboard command accelerators. A comment explains that enabling
the generic accelerator mode would make the command processor accept commands only
through Meta-X or the colon command syntax. The two explicit Scroll Forward and
Scroll Backward command definitions are consequently block-commented; the pane's
left and bottom scroll bars provide navigation.

The fixed menu has these ten labels in four columns:

| Column | Entries |
| --- | --- |
| Document/device | Describe Document Device Type; Show All Document Device Types |
| Book-design element | Describe Book Design Element; Edit Book Design Element; Show Dependencies On Book Design Element |
| Environment | Describe Environment; List Book Design Elements Using Environment; Show Dependencies On Environment |
| Session/help | Clear Display; Help |

The manual generally offers Display, Printer, and Typeout as output destinations.
The implementation routes Display output to the Browser pane, Printer output to a
hardcopy stream, and Typeout to the current command output. Environment descriptions
request landscape printer output; the other browser reports use portrait.

### Complete Book Design Browser command inventory

The 11-command count includes every active `define-book-design-browser-command` form
after removing top-level block comments. Ten commands are in the fixed menu. The
eleventh, `Describe Registered Book`, is command-line only.

| Command | Menu | Source-defined behavior |
| --- | --- | --- |
| Help | Yes | Displays the installed overview record for the Book Design Browser. |
| Clear Display | Yes | Clears the current Display window after adding a separator to its scroll history. |
| Describe Document Device Type | Yes | Shows the ordered book-design elements that specify a selected document/device pairing, recursively exposing `use` ancestry; accepts Display, Printer, or Typeout. |
| Show All Document Device Types | Yes | Sorts and describes every registered pairing. Unlike the general manual statement, this implementation hardcodes Printer output and accepts no destination argument. |
| Describe Book Design Element | Yes | Shows its defining source and forms, with inherited element presentations and provenance. |
| Edit Book Design Element | Yes | Opens the newest defining Lisp source in Zmacs and positions at the element definition. |
| Show Dependencies On Book Design Element | Yes | Recursively reports elements and document-device types that depend on the selected element. |
| Describe Environment | Yes | Resolves the effective attributes of an environment for a selected document-device type and identifies the book-design element from which each value is inherited. |
| List Book Design Elements Using Environment | Yes | Lists designs that define or modify the selected environment. |
| Show Dependencies On Environment | Yes | Reports other environment/design dependencies relevant to the selected environment. |
| Describe Registered Book | No | Displays the registration metadata for a book; active but omitted from both the fixed menu and the nine-command installed dictionary. |

The source contains a substantial `Define Document Device Type` prototype, but the
entire command and its helpers are inside a block comment. It is not a hidden active
feature. New pairings are created in source using the documented book-design forms,
then loaded/compiled; the Browser inspects and edits those definitions.

### Manual and source discrepancies

Three differences are preservation-relevant:

1. The installed dictionary documents nine domain commands. It does not list the
   Browser's active `Help` wrapper or command-line-only `Describe Registered Book`.
2. The guide says every command except Clear Display and Edit Book Design Element
   accepts an output destination. The inspected `Show All Document Device Types`
   definition instead takes no argument and always sends its reports to Printer.
3. The manual's four-way Super-Select switching sequence includes the Browser; the
   active configuration hook includes only Editor, Page Previewer, and Graphic
   Editor. The icon and `Change Configuration` remain valid source-defined routes.

These are bounded disagreements at one media snapshot. They could reflect a manual
revision mismatch or a later source change; neither side is silently declared wrong
for all releases.

## End-to-end authoring and publication workflows

### Create and structure a document

1. Load/select the optional Concordia system and create or read a `.sab` buffer in
   Concordia mode.
2. Create typed records, fill their structural fields, and keep each independently
   meaningful for on-line lookup.
3. Create Include/Contents links to establish a hierarchy; use Crossreference or
   Precis where inclusion is not wanted.
4. Add formatter environments and commands, pictures, examples, active text, Case
   options, index directives, tags, and citations.
5. Check spelling, link graphs, outlines, orphan reports, and modification history.
6. Format the root topic in Page Previewer, inspect page breaks and presentations,
   repair tag/Case diagnostics, and reformat.
7. Send selected pages to hardcopy or a printer-format file, or export a bounded
   topic to Scribe where that compatibility path is required.

The editor's preview command can format a record or send it to hardcopy, while Page
Previewer formats a complete linked document with collectors and page state. Those
operations are related but not interchangeable.

### Develop or modify a book design

1. In Book Design Browser, describe the target document-device type and identify the
   element that supplies the effective environment attribute.
2. Show dependencies before changing a widely inherited generic element.
3. Edit the defining element in its Lisp source, preferably specializing a narrower
   child when the change should not affect every document type.
4. Compile/load the definition in a controlled development world.
5. Reformat representative books and inspect both Screen/DEX and intended hardcopy
   routes; the inheritance graph alone cannot prove page behavior.
6. Package site changes through the normal system/patch workflow so the source and
   loaded definitions remain reproducible.

The Browser makes inheritance visible, but it does not provide transactional rollback
for arbitrary evaluated book-design code. Source control, system versions, and
patches remain the durable change mechanism.

### Install and distribute documentation

The documentation maintenance guide models a documentation corpus as a patchable
Genera system whose ordinary modules are `.sab` inputs. Compilation installs the
records and updates component directories, journals, and database/index state. The
guide explicitly configures source distribution for `.sab` modules and disables
ordinary binary-object distribution because there is no per-module `.bin` product.

The same `.sab` file can be loaded on 3600-family and Ivory machines. A second
machine-type “compile” can therefore consist of updating system journals/component
metadata rather than translating record code into a new instruction-set object.
That is strong contemporary evidence that `.sab` is portable serialized document
source, even though its representation is binary.

The 7.3/7.4 installation notes add operational context:

- loading Concordia was an optional, historically lengthy operation;
- writer use generally required decompressing the installed documentation database
  so full record-group relationships were available;
- Lock Simple coordinated shared `.sab` writes;
- sites with custom designs, commands, or environments needed to distribute and
  load both the definitions and their documentation.

## `.sab` preservation and extraction

### Format character

**Source:** `sab-file.lisp.~122~` describes its principal operations as writing and
reading a compiled Sage record over a byte stream. The encoding is a tagged object
language with separate symbol and string tables. Active type codes cover, among
other things:

- records, types, function specifications, fields, and unique identifiers;
- strings, long strings, characters, lists, fixnums, and interned or uninterned
  symbols from several packages;
- contents lists, environments, environment modifications, commands, macro calls,
  and source locations;
- links/references, including the later extensible-reference representation;
- token lists, modification histories, indexes, callees, and file attributes;
- pictures, eight-bit byte arrays, and example-record markers.

Each record is independently addressable by a start pointer and length. A file also
contains an index and attribute information, which lets the database locate records
without materializing an entire world image. Package symbols and executable-looking
formatter structures are serialized as data for the Sage loader; a generic parser
must not assume that every field is plain Unicode text.

This answers several preservation questions directly:

| Question | Evidence-based answer |
| --- | --- |
| Is `.sab` an archive? | It is a multi-record indexed container, but not a general-purpose archive such as tar or ZIP. |
| Is it serialized? | Yes. It is a typed serialization specialized for Sage records and formatter objects. |
| Is it a VM snapshot? | No. It does not capture processes, stacks, device state, or the whole Lisp heap. See [world loads and VLOD](genera/world-loads-and-vlod.md). |
| Is it compiled? | Symbolics calls the record representation “compiled Sage,” but the system treats the resulting `.sab` as distributable source and produces no separate per-module `.bin`. |
| Can it be extracted meaningfully? | Yes. Topics, record types and fields, links, markup, commands, pictures, and byte arrays can be decoded structurally. Reconstructing every live object behavior still requires definitions and package context. |
| Is extraction equivalent to the original authoring source? | No. It recovers the compiled/serialized record graph, not necessarily the exact editor history, original at-sign spelling, external illustration source, or site-specific Lisp definitions. |

### Local recovered corpus boundary

The inert Genera help extractor selected 30 Concordia `.sab` inputs at the inspected
media boundary. They total 3,896,264 source bytes, 689 decoded records, and 2,602,648
bytes of embedded byte arrays. A sorted evidence manifest of logical path, record
count, source size, embedded byte count, and source SHA-256 hashes to
`3bce1e6e43283a8b88c2a2cf554f4fabb6c3f72e4253d2c9f55d4cefd54c8cd7`.

Representative components include:

| Logical input | Bytes | Records | Embedded bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| `concordia/doc/tutorial.sab` | 944,413 | 39 | 837,420 | `a845bed1b6360928aab9e36a6f85fd4eeefbd77f310e7d4a71873f887f23c70a` |
| `concordia/doc/new-wt1.sab` | 661,493 | 45 | 538,589 | `e5bf0cb086655b9361e41514af244192f3b92c8c4ba94f99df03c9dc6c24380a` |
| `concordia/doc/new-wt2.sab` | 212,237 | 54 | 119,414 | `7f8a658c510fcfe38c002b312ae2adc888fd2a78f7952f29610f5d691df4f50c` |
| `concordia/doc/new-wt3.sab` | 261,989 | 43 | 173,515 | `f5e7113cb76fabc70be213695f403d74679fb9cbc4d9f75593d3dfc7c978581a` |
| `concordia/doc/bk-design3.sab` | 575,046 | 51 | 461,910 | `6756574d45ff2253b8eeabc788014e1fac61d80b726dcc36f064d98dca54c40e` |
| `concordia/doc/bk-design-dict.sab` | 88,808 | 29 | 47,987 | `06dc73162b00cf3762b0d6db5d5159848d3be75d80bfb21fafbd639997cb5b11` |
| `concordia/doc/application-interface.sab` | 62,617 | 46 | 1,261 | `76ed41d877f47c7b777526c36a159744701719e262e73f1fc95381dfc4acb2e9` |
| `concordia/doc/db-admin.sab` | 51,056 | 20 | 0 | `e50ace6473f9d7fc8fe91c84b83dd5f0a644c62ba2842513d5ca54a170eb322e` |

These counts are evidence, not redistributable content. The decoded JSON, text,
pictures, and byte arrays remain under ignored `build/help/genera/`. The repository
tracks the inert extractor and this original analysis only.

### What external extraction preserves and loses

The current decoder preserves enough structure to inventory record topics and types,
fields, commands, environments, links, pictures, styled strings, character styles,
function specs, reader-source forms, and embedded arrays. The full 801-file Genera
run recovered 17,266 records; Concordia's 30-file subset is reported separately
above so corpus-wide counts are not misrepresented as Concordia-only.

High-confidence extraction can retain the *effects represented in data*: linked
hierarchy, formatter commands, text, field values, encoded pictures, and identifiers.
It cannot by itself reproduce:

- arbitrary functions called by DynamicText or active examples;
- the effective book design unless the relevant Lisp definitions are also analyzed;
- live registry conflicts, site patches, fonts, printers, or presentation
  translators;
- an external Graphic Editor source drawing when the `.sab` retains only a compact
  replay encoding;
- author intent that was discarded when flat markup became compiled structure.

For that reason a museum export should expose a normalized record graph and mark
unresolved executable or package-dependent objects, rather than pretending the
result is either original prose source or a resumed Genera system.

## Integrations beyond the editor

| Subsystem | Concordia integration |
| --- | --- |
| Zmacs/Zwei | Structural editing substrate, files and buffers, kill history, styles, macros, source navigation, and ordinary text editing. |
| Document Examiner | On-line consumption of installed records and options; DEX is one book-design/display route. |
| Graphic Editor | Object illustrations, compact display encoding, editable drawing callback, and presentation-bearing graphics. |
| Bitmap Editor / Images | Raster illustration creation and editing, including historically documented MacPaint/screen-image paths. |
| Dynamic Windows | Program frame, command processors, presentation-sensitive records/links/pages, active text, and Browser navigation. |
| Hardcopy / Postscript | Page output, printer-format files, queues, headings, font substitution, and device-specific rendering. |
| Lock Simple | Cooperative write locks for shared `.sab` files. |
| System Construction / patches | Installation, documentation versions, component directories, changed-record patching, and site distribution. |
| Source Compare | File/buffer comparison and merge directly from Concordia mode. |
| Scribe | Import of old `.mss` material through parse/replace workflows and export of a topic back to `.mss`. |

The 3.1 material adds presentation-bearing `ActiveText`, DynamicText, user-selectable
Case options, the Book Design Browser, record-name prefixes/suffixes, expandable
editor-menu categories, and richer Graphic Editor presentations. The 7.3/7.4 notes
also document MacDraw/MacPaint paths, a single-record view command, a renamed and
enhanced table-of-contents operation, a revised screen-capture gesture, internal
hyphenated markup through a numeric argument to Create Markup, and the Scribe export.
These are release evidence, not a claim that every feature is present in the cold
world tested below.

## Findings not evident from the user manuals alone

| Finding | Evidence and confidence |
| --- | --- |
| Four configurations share one program/process context | **High-confidence source finding.** Embedded frames use `:process nil`; editor/preview/graphics callbacks explicitly switch the enclosing activity. |
| The Super-Select hook omits Book Design Browser | **High-confidence source/manual discrepancy.** Icons and manual list four routes; the active hook maps only E/P/G. |
| Concordia loading mutates global editor bindings | **High-confidence source finding.** Super-Space/Backspace affect the standard Zwei table, and Super-. plus two named commands affect global Zmacs. |
| File locking is coarse | **High-confidence source finding.** Disposition and Lock Simple protect a connected `.sab` buffer/file, not individual record fields. |
| Published, installed, and edited records coexist | **High-confidence source finding.** Record groups and lookup modes preserve separate versions; link reports can expose their disagreements. |
| `Kill Record` is not a simple delete | **High-confidence source finding.** It uses the undocument/tombstone path, while Remove Record From Buffer is explicitly non-database removal. |
| Markup-string search is outside the 74 named-command alist | **High-confidence source finding.** It remains directly bound and menu-visible, illustrating why command names alone undercount interaction. |
| `Query Change Environments` is not undoable | **High-confidence source finding.** Its own implementation documentation calls out the missing Undo model. |
| `Graph Links From Record` graphs only structural links | **High-confidence source finding.** The implementation documents crossreference and other link views as a current limitation. |
| Page Previewer carries semantic presentations across page boundaries | **High-confidence source finding.** A post-format pass annotates entry/exit presentations and leftover stacks page by page. |
| Two active preview commands are debugging-oriented | **High-confidence source finding.** `Reformat End Pages` and `Describe Page` remain installed despite source comments questioning normal use. |
| Saved tags are loader input | **High-confidence source finding.** `.CTAGS` reconstructs counters with dumped Lisp forms and is restored under a guarded binary-load context. |
| Merged indexes are intentionally lossy | **High-confidence source finding.** `.BIX` rebuilds stand-in page counters and comments acknowledge incomplete multilevel-index handling. |
| Show All Document Device Types ignores the documented destination pattern | **High-confidence source/manual discrepancy.** Its active definition has no destination argument and always constructs printer output. |
| Clear Display does not mean erase all history | **High-confidence source finding.** It emits a separator before clearing the current display window; scroll history is maintained by the pane. |
| Book Design Browser is an inspector/development navigator, not a visual layout editor | **High-confidence source and manual synthesis.** It reports definitions/dependencies and opens Lisp source; Page Previewer supplies rendered validation. |

## CADR and LM-3 historical boundary

### MIT CADR System 46

A case-insensitive search of the complete pinned public `src/` snapshot for
`Concordia`, `Basic Sage`, `Writer Tools`, `SAGE-BINARY`, `Page Previewer`, and
`Book Design Browser` returned no files. System 46 does provide the underlying
historical categories—ZWEI/Zmacs editing, documentation strings and help, fonts,
Press/XGP/Versatec/DPLT output, and Lisp data structures—but no evidence supports
calling those pieces an early Concordia application.

This boundary matters. Similar goals such as editing text and producing hardcopy do
not establish source lineage. The earliest public tree here should be described as
providing ancestors of the platform facilities, not the Concordia record database,
formatter, or book-design browser.

### LM-3 System 303

The pinned LM-3 System manifest contains 4,917 file entries. Its path inventory has
no Sage, Writer Tools, Concordia, Page Previewer, or Book Design Browser subsystem.
A full-text search of the corresponding maintained checkout finds the selected terms
only in 24 historical bug/release-record files (including duplicate evacuated
versions), not implementation modules.

Those records nevertheless establish chronology that System 46 cannot. They name,
among other combinations:

- Experimental Basic Sage 2.2 with a “New Sage” environment;
- Experimental Basic Sage 7.6 and Experimental Writer Tools 7.0;
- Basic Sage 15.9 and Experimental Writer Tools 12.23 in Release 6.0 records;
- later Basic Sage 42.x/52.0 and Writer Tools 37.0/41.0 contexts.

This is evidence that Sage and Writer Tools existed in the Symbolics-era software
line represented by those archived reports before the later Concordia 444 snapshot.
It does **not** prove that their source is open, that the LM-3 restoration distributes
it, that their feature set matches Concordia, or that the current System 303 band
loads them. Recovering that implementation would require a separately licensed or
authoritatively public historical source corpus.

The exact public boundaries checked here are MIT CADR commit
[`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
and LM-3 System check-in
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
The latter is a maintained restoration check-in, not the date of the historical bug
reports it carries.

## Runtime observation and screenshot status

### Exact probe and result

Session `d36-concordia-20260718`, generation 1, cold-booted the private Genera 8.5
world in the repository's isolated Xvfb harness. The selected main window was
1200 by 900 pixels and titled `Genera on DIS-LOCAL-HOST`. The ordered input intents
were:

1. find the packages named `NSAGE`, `SAGE`, and `CONCORDIA`;
2. for `CONCORDIA`, `*WT-COMTAB*`, `PAGE-PREVIEWER`, and
   `BOOK-DESIGN-BROWSER`, report symbol accessibility plus function and variable
   binding state in the Sage package;
3. ask the System Construction Tool for `Concordia` and `NSage` without issuing a
   load command;
4. send Abort after the system lookup requested a site login.

The first form returned the same `SAGE` package object for `NSAGE` and `SAGE`, and
`nil` for a separate `CONCORDIA` package. The second returned:

- an internal `CONCORDIA` symbol with neither function nor variable binding;
- an external `*WT-COMTAB*` symbol with no variable binding;
- no `PAGE-PREVIEWER` or `BOOK-DESIGN-BROWSER` symbols.

The system lookup reported Concordia unknown and tried to locate a Concordia system
definition through the unconfigured site's `DIS-SYS-HOST`. It reached a Login prompt
because the sandbox intentionally supplies neither an external route nor guest-visible
host file service. The lookup was aborted; no optional system, source, help file, or
book was loaded, compiled, installed, or written.

This proves that the base world contains resident NSage/Sage package substrate but
not the inspected Concordia application definitions. It does not prove that all of
NSage 440 is loaded, and absence from this world is not absence from the licensed
media.

### Why there is no published screenshot

Four raw screenshots and their sidecars remain in the ignored session tree. The
three evidentiary captures were:

| Capture | PNG SHA-256 | Pixel SHA-256 | What it proves |
| --- | --- | --- | --- |
| Package probe, 1200x900 | `746f4ce01d8e6a8327e4f4de9533867ccce787a12b5b65c069523de4d3cdb73f` | `7066e411c1da8828cf90468d64258dd2c7a6639327122a5a85849b39097ee77c` | The `SAGE`/`NSAGE` package identity and absent `CONCORDIA` package. |
| Symbol probe, 1200x900 | `6c868bc8804b62bfa46be77bdfa5df9b6bbe7ec31e3d8e9ea0e26e9737750e72` | `c9c9ee33488eae2a24a8f4b5b2c58f2e83822d3d368b574115e14b05806bd7f4` | The four symbol/binding results. |
| System lookup, 1200x900 | `7a248b9e4665f34c65332d003e0d01615bafe8f7629d15d6e945c1a967255cd7` | `09dd86cf2509d885e1afef5565b69a8391109d4d513d0e742d6fb22a0f152186` | Concordia was unknown to the resident lookup and the missing system host blocked resolution. |

They show only a Dynamic Lisp Listener, not the application documented here. Under
the repository's [screenshot publication review](screenshot-publication-rights-review.md),
publishing one would add little application evidence and risk becoming decorative.
No image was curated into `docs/assets/`. A future page revision should publish a
specific, rights-reviewed Concordia frame only after the optional activity can be
loaded safely and its visible state is actually exercised.

### Harness and shutdown provenance

| Item | Runtime evidence |
| --- | --- |
| Acquired archive | 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base/private world | 54,804,480 bytes; SHA-256 at start `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Debugger | 346,880 bytes; SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| VLM at execution | 1,533,760 bytes; SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| X compatibility preload | 21,280 bytes; execution SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| Ifconfig interposer | 15,248 bytes; execution SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7` |
| RFC 868 responder | execution SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; successful responder exit and evidence SHA-256 `af43bccef555336908d2057b7a678e26c3c2db825ad6334fc6f30d7fd519289c` |
| VLM configuration | execution SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| Action log | 8 intent/outcome entries; SHA-256 `6d51ff03233dcf08ac304c599d0916dea1099c5bd2bf48b85800527626eeac02` |

The harness ran in separate user, mount, network, PID, IPC, and hostname namespaces;
the guest had no default/external route or host file service. Xvfb advertised no
MIT-SHM, and both pinned X-protocol substitutions plus the local RFC 868 reply were
observed before the session was considered running.

Shutdown reproduced the already documented VLM behavior: the prompt appeared,
`yes` was sent and accepted, cleanup progress appeared, and the VLM then reached the
confirmed stall that required the bounded forced stop. The result is **not** an
orderly VLM shutdown. At handoff both VLM and Xvfb were dead, the base world was
unchanged, the private world was unchanged, and no host process checkpoint was
created. `save_world_performed` and `guest_checkpoint_created` remain unknown, and
`state_may_be_incomplete` is true. No world hash change is being used to infer a
guest Save World.

## Licensed source and extraction provenance

### Principal Concordia inputs

All pathnames below are portable media-relative identities under `sys.sct/`; no
machine-specific acquisition path is published.

| Source artifact | Bytes | SHA-256 | Evidence role |
| --- | ---: | --- | --- |
| `concordia/patch/concordia.system-dir.~158~` | 10,816 | `071380ca7280201534e177b70bc6c5b111e666b34622883244d5979484d1326d` | Released version and source-world dependency context |
| `concordia/concordia.lisp.~44~` | 5,173 | `c2d6e250f98fc6462fc32566c8acee929c8d96923adb3e45f8875352b8efcd69` | System/subsystem declaration and dependencies |
| `concordia/activity.lisp.~108~` | 51,153 | `8255e3f3e408832f5fd97c49730c038b6396698e9bb684054479692161fb4d43` | Integrated frame, configurations, menus, switching, pane gestures |
| `concordia/comtab.lisp.~52~` | 15,308 | `3ddba29aab79a3ff7859251474907ac15f1ca0987eb9dfc32b99f147a2a3008c` | Complete mode bindings, 74-command alist, and category menu |
| `concordia/editor-interface.lisp.~164~` | 73,566 | `c2d042eb5ec30d1fb327c337313d406685ab3ab699c2c89d3867f4ad0cd1e8f9` | Markup, picture, example, index, search, lock, and change commands |
| `concordia/editor-support.lisp.~30~` | 27,116 | `ac022e5623111802a39ac9030bd5d6779abd37314a6e4aee6b560433d151640f` | Flat-text conversion and record-name prefix/suffix behavior |
| `concordia/ed-record.lisp.~98~` | 106,982 | `0f1ec8c53c75eda41ba6d3791342c89b50a7f1fb1b5f8abafcdb28df15cad83d` | Record lifecycle, registry versions, links, indexes, orphan checks |
| `concordia/ed-glue.lisp.~148~` | 98,275 | `ad9a7048f4011b7671acb4a05b6af4cb0b2710ecc9cedf775c8df90c509d252d` | Sage-to-Zwei node mapping and editable field set |
| `concordia/markup-diagrams.lisp.~315~` | 146,469 | `d716632f0e10cfe23a4bf6b3dacd474e8a7c4e4da3f12ee643ac643784bb09cd` | Structural diagrams, record views, picture regeneration, table tabs |
| `concordia/wt-defs.lisp.~16~` | 17,094 | `59f9ac6cf27e23a4a5cac5ee2c666f6da11b50449b4cb8a58c41a3ed43c5b79a` | Writer Tools definitions and active link-view list |
| `concordia/page-previewer.lisp.~33~` | 44,692 | `5affd46ebac60707a5718432c7025fa9885bf1a08160a5c94e3710fd68e59c10` | Preview frame, formatter commands, navigation, tags, diagnostics |
| `concordia/bix.lisp.~1~` | 15,636 | `f3d0bded3a909a563f86c89eeb3dcbf9814d14560e3dd501fa1d9dcd50401774` | `.BIX` write/read/merge format and commands |
| `concordia/book-design-browser.lisp.~7~` | 36,114 | `b1e44d67f751d90d2bbcc7b03685ff6c6c694b5f886d3fd076d5f2eb3edb8329` | Browser panes, presentations, 11 commands, dependency traversal |
| `concordia/toscribe.lisp.~216~` | 43,592 | `9f5dfae2f2acb1f80ef1b6f0e5d706d034ca814af0b86773e07362359abf43bf` | Concordia-to-Scribe conversion |
| `concordia/doc/patch/concordia-doc.system-dir.~95~` | 9,294 | `2b2bc0ab69c3de23ad77d855500b7c7fc28ad4167300321a439f8ad78fcc09c0` | Concordia-Doc 432 identity |

### Principal NSage inputs

| Source artifact | Bytes | SHA-256 | Evidence role |
| --- | ---: | --- | --- |
| `nsage/patch/nsage.system-dir.~194~` | 7,920 | `4ce000a7a4cf313b2b95e6fa91374379b6aa9a2ef590151ef043f830a3d77c20` | NSage 440 release identity |
| `nsage/sage-defs.lisp.~417~` | 26,491 | `0e0b12241c85772135849370446584a8874698429a34f1d16e14551377c6858d` | Core formatter and database definitions |
| `nsage/record.lisp.~169~` | 79,838 | `26fb0007bb968e5626f7dcccd4c0f1642a82985b8b2f1e7ae76682459f5bee7f` | Record groups, installed/published/edited versions, lookup policy |
| `nsage/sab-file.lisp.~122~` | 65,391 | `e8c40e1fd6705959c549083aafbaa22e969e0fbebb468c50502b1ee90a3e0685` | Typed `.sab` serialization |
| `nsage/database.lisp.~246~` | 93,906 | `e97a4e12ab2e80493e94b7c8af055caa422c832cc7a9ba01dbc3411abbda2ffb` | Registries, device/document definitions, database operations |
| `nsage/formatter.lisp.~220~` | 87,718 | `88d3268ba0ff31317ba4e5f63ac9026c8d1cab14b864a7d25d59ab5859c96e58` | Formatter pipeline |
| `nsage/forpage.lisp.~121~` | 83,571 | `3f1147aec367c75568d03e46a389e34887716975b65e02a0d64448b0ee56c047` | Page construction and breaking |
| `nsage/envr.lisp.~229~` | 108,608 | `8af25c6ed8a0eaa435b2fef1dad17dfc42a5ae943d60e4eb383d7d4aaa32c3ef` | Environment and book-design resolution |
| `nsage/defs-directives.lisp.~115~` | 78,792 | `f13b48c10d5a581cb79bc7513f9fd0c837678ff383a93e89ecaf7021f1a782e8` | Definition macros for designs, environments, lines, and boxes |
| `nsage/defs-io.lisp.~51~` | 41,282 | `8f46dddbf78127dcf240b08db9acea8a913659281dc95afe5253c5c5f03326ec` | Window/DEX output-device model |
| `nsage/defs-hardcopy.lisp.~10~` | 19,101 | `7fa2162eeb9cb88f7b1115c87fd4a32c8fc21ed872dd7de1cf5c20407ba4562c` | LGP/hardcopy output-device definitions |
| `nsage/hardcopy-devices.lisp.~7~` | 36,567 | `cf672c33b2b21d92b2eb8f0f01397b5914bedc2471cc525af78504c169ad36fc` | Actual hardcopy preparation, fonts, headings, and device operations |
| `nsage/bd-generic.lisp.~8~` | 6,679 | `ed648b6ca06fc962bf951e6b5084e63a97bcdeb0f45187037f0915448f326e01` | Generic reusable book-design elements |
| `nsage/bd-letter.lisp.~14~` | 10,173 | `8de8c5c77ef8c86499ce908a60b6bbc6acef33353d0935b2a26dd6af7d9133ac` | Example specialized document/device composition |

### Help extraction toolchain

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/extract-genera-help.py` | 55,939 | `e59440906a0092afe28ca514be9e7afdf6c21ca1009b765a710f0a4121f13a74` |
| ignored `catalog.json` | 577,696 | `a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed` |
| ignored `lisp-source-help.jsonl` | 9,817,347 | `8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190` |

The full source-input manifest recorded by the catalog hashes to
`ca5678d3e1ffc8650e28836d4a2daf4cea1a48ee594dcf406485d92717281b70`.
The source-help pass is non-evaluating: it identifies literal docstrings, command
definitions, and explicit documentation registrations but does not macroexpand or
load the licensed source. All figures in this page were verified on 2026-07-18.

## Public manual artifact provenance

The public manuals were downloaded from the University of Hamburg Symbolics archive
and inspected locally with `pdfinfo`, `pdftotext`, `sha256sum`, and targeted text
search. Page counts below are PDF page counts, not printed page labels.

| Public artifact | Bytes | PDF pages | SHA-256 |
| --- | ---: | ---: | --- |
| *Symbolics Concordia* consolidated manual | 3,121,750 | 508 | `4b4625068731f1da52d2c0c8d0b50baf76c41707d237b9909339f378d22b7dfe` |
| *User's Guide to Symbolics Concordia Book Design* | 472,585 | 60 | `d6194cb5071766bed1873872f6fbeaabed47cb8fee2218f7be9d462d53ffce1f` |
| *Concordia 7.3 Ivory Release Notes* | 146,523 | 28 | `70af7d808e8574e8ae24b0e10e6d787bee873e0d5d77bdefc4aa4a316fb7690d` |
| *Concordia 7.4 Ivory Patch Notes* | 145,276 | 28 | `4f50bba4ffe5c3a30c86bc875dd9d06cb9d929b2e89fd3e635bc7ce5360fcd3d` |

These hashes identify the exact copies used for the manual claims. The archival site
can replace a PDF without changing its URL; a later researcher should compare the
hash before assuming pagination or wording is identical.

## Limitations and open questions

- **TODO — exercise the loaded application:** the licensed source establishes the
  frame, panes, command tables, formats, and callbacks, but the optional Concordia
  system could not be resolved from the isolated base world. A future controlled run
  should load it from an explicitly mounted, read-only licensed system definition,
  open a disposable copied `.sab`, and verify visible pane geometry, icon labels,
  configuration switching, menu expansion, presentation gestures, and Page
  Previewer navigation.
- **TODO — curate one evidentiary screenshot:** after that run, review a minimal
  Concordia editor or Page Previewer capture under the repository's four-factor
  screenshot policy. Do not substitute a Listener probe or publish recovered manual
  pages, embedded pictures, or full Help text.
- **TODO — round-trip a disposable `.sab`:** the serializer and extractor establish
  the format model, but this investigation did not compare a live editor save with a
  normalized external decode/re-encode. Such a test must use a private copy and must
  distinguish semantic equality from byte-for-byte equality.
- **TODO — validate real device output:** printer queues, fonts, PostScript paths,
  hardcopy headings, and `.BIX` page-counter reconstruction were inspected in source
  but not exercised against a configured historical device. No claim here guarantees
  faithful output on an unconfigured modern site.
- The 74, 26, and 11 command counts are exact for the active definitions in the
  identified source files, not every patch level. Inherited Zmacs and Dynamic Windows
  interaction remains documented with those parent systems rather than duplicated as
  Concordia-specific commands.
- The public manuals span multiple Concordia eras, while the source snapshot records
  Concordia 444 and NSage 440. Version-qualified disagreements remain unresolved
  rather than being projected backward or forward.
- LM-3 bug records establish names and version contexts for Basic Sage and Writer
  Tools, but no public implementation was found. Their precise code lineage into
  Concordia, and whether an authoritatively redistributable source survives, remain
  open historical questions.

## Sources

### Public manuals and exhibit

- Symbolics, [*Symbolics Concordia* consolidated manual](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Symbolics-Concordia.pdf),
  especially “Using Symbolics Concordia,” “Concordia 3.1,” Page Previewer, Writer
  Tools commands, and documentation maintenance sections.
- Symbolics, [*User's Guide to Symbolics Concordia Book Design*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Users-Guide-to-Symbolics-Concordia-Book-Design.pdf),
  especially the document-device model, inheritance, environments, and Book Design
  Browser chapters.
- Symbolics, [*Concordia 7.3 Ivory Release Notes*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Concordia-7.3-Ivory-Release-Notes.pdf).
- Symbolics, [*Concordia 7.4 Ivory Patch Notes*](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/Concordia-7.4-Ivory-Patch-Notes.pdf).
- University of Hamburg, [Symbolics documentation index](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/documentation/index.html)
  and [Concordia exhibit](https://www.chai.uni-hamburg.de/~moeller/symbolics-info/concordia/concordia.html).

### Public source boundaries

- MIT CADR System 46, [pinned public source tree](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  commit `8e978d7d1704096a63edd4386a3b8326a2e584af`.
- LM-3 System 303, [pinned maintained restoration check-in](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`;
  the public historical [System 42 bug report](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fbug.lispm42)
  is one of the records carrying Basic Sage and Writer Tools version evidence.

### Related museum studies

- [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md)
- [World loads and VLOD](genera/world-loads-and-vlod.md)
- [Help, self-documentation, and Document Examiner](help-self-documentation-and-document-examiner.md)
- [Lisp Machine text editors](lisp-machine-text-editors.md)
- [Hardcopy, Press, printing, and plot output](hardcopy-press-printing-and-plot-output.md)
- [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md)
- [Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md)

External public links and pinned source boundaries last verified 2026-07-18.
