---
type: Historical Article
title: Constructing systems, patches, worlds, and distributions
description: A source-grounded comparison of MIT CADR and Symbolics Genera facilities for building software systems, applying patches, saving runnable worlds, and preparing distributions.
tags: [lisp-machine, mit-cadr, lm-3, genera, make-system, sct, patches, world, distribution]
timestamp: 2026-07-18T07:38:23-04:00
---

# Constructing systems, patches, worlds, and distributions

MIT CADR software and Symbolics Genera both connect source-system descriptions,
compiled files, patches, and bootable memory images, but they do not use one
interchangeable artifact or one monolithic “system builder.” In the inspected
releases:

- MIT System 46 bootstraps a running world with `QLD`, writes a cold load with
  `MAKE-COLD`, saves memory into a disk load band with `DISK-SAVE`, and transfers
  bands separately. It predates the later `MAKE-SYSTEM` and patch-manager source
  inspected here.
- LM-3 System 303 has `MAKE-SYSTEM`, a patch manager and ZWEI patch commands, cold
  and load-band writers, network band transfer, and file-level distribution
  utilities.
- Genera 8.5 has the System Construction Tool (SCT), journal- and plan-based
  compilation/loading, a richer patch workflow, a World Building command subset,
  VLOD world loads, and interactive distribution and restoration frames.

The most important preservation distinction is that a *distribution* is not
necessarily a runnable memory image. A CADR `LOD` partition and a Genera `VLOD`
hold saved machine state; the distribution facilities select and copy systems,
source, binaries, patches, documentation, or installation media. Conversely, a
saved world is not a source archive. Genera's VLOD structure and its limits are
covered separately in [World loads and the VLOD format](genera/world-loads-and-vlod.md).

## Scope and meaning of “complete”

This is a release-bounded implementation dossier, not a universal command list for
every Lisp Machine site. “Complete” has the following reproducible grain:

| Surface | Inventory rule |
| --- | --- |
| System 46 | Direct construction, save, and band-transfer entry points in the pinned public source snapshot. |
| System 303 `MAKE-SYSTEM` | Every keyword with a `MAKE-SYSTEM-KEYWORD` handler in the pinned `maksys.lisp`. |
| System 303 patches | The callable patch-management surface identified in `patch.lisp`, every option parsed by `LOAD-PATCHES`, and every direct `DEFCOM` in `zwei/pated.lisp`. |
| System 303 distribution | Direct top-level distribution and band-transfer functions in the inspected files. |
| Genera SCT | Every active CP command defined in the inspected SCT command sources, plus every documented `DEFSYSTEM` option found in the installed 8.5 material. Block-commented stubs are identified but not counted as active commands. |
| Genera patch editing | Every public direct `DEFCOM` in the inspected Zmacs patch source, plus the two commands local to its special description-edit buffer. |
| Genera World Building | Every direct command assigned by source to the World Building command table. |
| Genera distribution | Every direct CP command, frame pane, direct frame command, accelerator, and source-defined mouse translator in the inspected distribution and restoration sources. |

This grain excludes commands installed later by a site, private user
initializations, runtime patches, inherited generic Dynamic Windows commands not
defined by these applications, and functions that are implementation helpers rather
than an intended entry surface. Source, manuals, and runtime observations are kept
separate when they disagree.

## Evidence boundary

The public MIT comparison uses two distinct revisions:

- MIT CADR System 46, Git commit
  `8e978d7d1704096a63edd4386a3b8326a2e584af`;
- maintained LM-3 System 303, Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

The latter is a maintained restoration tree, not evidence that every System 303
detail was present in System 46 or in an unmodified historical MIT tree.

The Genera comparison is a local, licensed Open Genera 2 / Genera 8.5 artifact
observation. The purchased archive is `opengenera2.tar.bz2`, 206,213,430 bytes,
SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
Its base `Genera-8-5.vlod` is 54,804,480 bytes, SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
Only filenames, sizes, hashes, interface inventories, and original analysis are
recorded here; no licensed source, manual text, or recovered payload is reproduced.

## Four layers that must not be collapsed

| Layer | CADR / LM-3 example | Genera example | What it preserves |
| --- | --- | --- | --- |
| Source-system construction | `QLD`, later `DEFSYSTEM` and `MAKE-SYSTEM` | SCT system definitions and plans | Relationships among source, binaries, dependencies, components, and load actions. |
| Patch lifecycle | System 303 patch directories and ZWEI patch commands | SCT patch objects, journals, and Zmacs patch commands | Ordered changes applied after a system version, with status and authorship metadata. |
| Runnable memory image | Cold load and `LOD` load band | `LOAD`, `ILOD`, and `VLOD` world-load files | Memory state from which the machine can start or resume its boot sequence. |
| Distribution media | File-copy utilities, directory/tape preparation, band transfer | Distribution and restoration plans for tape, disk, or supported removable media | A selected set of installable files or, separately, a transferred saved image. |

“Build the system,” “save the world,” and “make a distribution” are therefore
different operations, even when an operational recipe performs them in sequence.

## MIT CADR System 46: constructing and saving before `MAKE-SYSTEM`

### `QLD` constructs a running world

System 46's `QLD` is a staged loader rather than the later declarative
`MAKE-SYSTEM` interface. The source describes eight phases:

1. load a minimal nucleus including QFASL, string, and package support;
2. load the inner system;
3. load `FORMAT`;
4. load Chaosnet and related network support;
5. load the file/QFASL layer;
6. perform cold-boot-like file-system initialization;
7. use package-driven loading for the remainder of the world;
8. optionally compact property and method lists.

The procedure ends with an instruction to invoke `DISK-SAVE`; it does not itself
turn the loaded files into a durable boot band. `RECOMPILE-WORLD` is a related
recompilation entry point. This division is historically important: loading enough
code to create a working Lisp environment and recording that environment on disk are
separate steps.

No `MAKE-SYSTEM` implementation or patch-editor source was found in this pinned
System 46 snapshot. That is an absence claim about this revision, not a claim that
MIT Lisp Machines never acquired those facilities; System 303 below demonstrates
the later design.

### Cold loads and load bands

`MAKE-COLD` reads a prescribed list of QFASL inputs and writes a cold-load
partition. Its prompt asks whether to smash the target partition. `DISK-SAVE`
records the current Lisp memory into a selected disk partition after confirming the
overwrite, updating the partition comment, logging out, resetting network state, and
running save initializations. Both operations are media-mutating construction tools,
not archive extractors.

The direct System 46 band-transfer surface is:

| Entry point | Purpose | Preservation risk |
| --- | --- | --- |
| `BAND-TRANSFER-SERVER` | Serve band-transfer protocol requests. | Depends on the request received. |
| `RECEIVE-BAND` | Receive blocks into a local band. | Writes the target partition. |
| `COMPARE-BAND` | Compare local and remote band contents. | Read-only in the inspected implementation, but requires a live peer and network. |
| `TRANSMIT-BAND` | Send a local band to a remote receiver. | The remote target is written. |

The installation notes treat source/QFASL copying and band construction as related
operational work, but the saved band remains distinct from the file trees used to
construct it.

## LM-3 System 303: `DEFSYSTEM` and `MAKE-SYSTEM`

System 303 represents a system as components and transformations with dependencies.
`MAKE-SYSTEM` first resolves the named system, normally reloads a changed system
declaration, expands the requested top-level transformations including component
systems, builds a file-transformation plan, asks for confirmation as appropriate,
and then performs the plan. Conditions can recheck a transformation immediately
before execution because an earlier transformation may have changed its inputs.

### Complete `MAKE-SYSTEM` keyword inventory

| Keyword | Source-defined effect |
| --- | --- |
| `:NOCONFIRM` | Do not ask for confirmation. |
| `:SELECTIVE` | Ask about files individually. |
| `:SILENT` | Suppress normal file-list output. |
| `:RELOAD` | Load even when the normal loaded-state test says loading is unnecessary. |
| `:NOLOAD` | Remove loading from the requested transformations. |
| `:COMPILE` | Add compilation and the associated patch-version increment transformation. |
| `:RECOMPILE` | Combine forced reload with compilation, including files already compiled. |
| `:NO-INCREMENT-PATCH` | Remove patch-version incrementing; source makes this override `:COMPILE` regardless of keyword order. |
| `:INCREMENT-PATCH` | Request patch-version incrementing. |
| `:NO-LOAD-PATCHES` | Do not load patches for a patchable system as part of making it. |
| `:DO-NOT-DO-COMPONENTS` | Omit component systems. |
| `:NOWARN` | Suppress warning interaction/output used by the make operation. |
| `:DEFAULTED-BATCH` | Arrange a batch warning file using default naming. |
| `:BATCH` | Write compilation warnings to a loadable batch file. |
| `:PRINT-ONLY` | Print the work that would be required without compiling or loading. |
| `:NO-RELOAD-SYSTEM-DECLARATION` | Do not refresh the file containing the `DEFSYSTEM`. |
| `:NOOP` | Accept the option but add no operation. |
| `:DESCRIBE` | Report compile/load history and related file state. |

The manual documents fourteen of these. The source additionally accepts
`:NO-LOAD-PATCHES`, `:DO-NOT-DO-COMPONENTS`, `:NOWARN`, and `:DESCRIBE`.
`MAKE-SYSTEM` also has two behaviors easy to miss in a feature list:

- collective confirmation offers a selective path, and its unattended timeout
  proceeds after five minutes;
- `:PRINT-ONLY` still computes the transformation plan, making it the least
  invasive source-defined inspection mode even though no runtime check was made in
  this audit.

## System 303 patch management

A patchable system has a major version, an ordered minor-patch directory, status,
and source/QFASL patch files. Reserving a patch records a placeholder; finishing it
replaces that unfinished marker with an explanation and release state. Loading must
respect order so that the same system version denotes the same patch sequence.

### Patch-manager entry points

The intended callable surface found in `sys2/patch.lisp` groups as follows:

| Role | Entry points |
| --- | --- |
| Find and register | `GET-PATCH-SYSTEM-NAMED`, `ADD-PATCH-SYSTEM` |
| Major version and directory | `INCREMENT-PATCH-SYSTEM-MAJOR-VERSION`, `GET-PATCH-SYSTEM-MAJOR-VERSION`, `READ-PATCH-DIRECTORY`, `WRITE-PATCH-DIRECTORY` |
| Inspect | `PRINT-PATCHES`, `PATCH-LOADED-P`, `PRINT-PATCH`, `VIEW-UNFINISHED-PATCHES` |
| Load and save | `LOAD-PATCHES`, `LOAD-PATCHES-FOR-LOGICAL-PATHNAME-HOSTS`, `LOAD-AND-SAVE-INCREMENTAL-PATCHES`, `LOAD-AND-SAVE-PATCHES` |
| Author a patch | `RESERVE-PATCH`, `CONSUMMATE-PATCH`, `ABORT-PATCH` |
| Version and status administration | `GET-NEW-SYSTEM-VERSION`, `SYSTEM-VERSION-INFO`, `DESCRIBE-SYSTEM-VERSIONS`, `PRINT-SYSTEM-MODIFICATIONS`, `GET-SYSTEM-VERSION`, `SET-SYSTEM-STATUS` |

The source recognizes the statuses experimental, released, obsolete,
inconsistent, and broken.

### Complete `LOAD-PATCHES` option inventory

Options may also be system names directly. The parser otherwise recognizes:

| Option | Effect |
| --- | --- |
| `:SYSTEMS` *systems* | Restrict loading to the following system or list. |
| `:SILENT`, `:NOWARN` | Suppress patch-loading information and selection. |
| `:VERBOSE` | Print information for patches considered. |
| `:SELECTIVE` | Query about individual patches. |
| `:SITE` | Refresh site configuration information. |
| `:NOOP` | Perform no additional option action. |
| `:NOSITE` | Do not refresh site configuration information. |
| `:UNRELEASED` | Consider unreleased patches. |
| `:NOSELECTIVE` | Do not query about each patch. |
| `:FORCE-UNFINISHED` | Continue through unfinished patches. |

The installed manual mentions `:HOSTS` and `:NOHOSTS`, but neither is accepted by
this source parser. Conversely, the source accepts `:NOWARN` and `:NOOP`, which the
manual's option list omits. After the site path, source refreshes logical pathname
hosts without those two manual switches.

An unfinished entry has no explanation and normally stops the remaining sequence.
Loading an unfinished, unreleased, or out-of-sequence patch marks the system
inconsistent and warns against dumping a band. Selective loading times out after
five minutes: consideration of unreleased patches defaults to no, while a per-patch
load prompt defaults to proceeding. The `LOAD-AND-SAVE-*` helpers reject
`:FORCE-UNFINISHED` and `:UNRELEASED`, inspect inconsistent systems, and then save a
band only after loading changes. They are convenience pipelines for mutation, not
safe inspection commands.

### Complete System 303 ZWEI patch-command inventory

These ten direct commands are named-command operations, conventionally invoked
through `Meta-X`; the source does not install direct keystrokes for them:

1. `Add Patch`
2. `Start Patch`
3. `Start Private Patch`
4. `Cancel Patch`
5. `Resume Patch`
6. `Finish Patch`
7. `Finish Patch Unreleased`
8. `Release Patch`
9. `Add Patch Changed Sections`
10. `Add Patch Buffer Changed Sections`

Only one patch-editing state is active at once. `Start Private Patch` avoids
allocating a public system version, and private patches are outside the normal
`LOAD-PATCHES` sequence. `Add Patch` detects a readtable mismatch between a source
buffer and the patch buffer and inserts a warning note rather than silently treating
the text as context-free. `Finish Patch` with a numeric argument requests release;
without it, the command asks.

## System 303 cold loads, bands, and file distributions

The later `MAKE-COLD` still writes a cold-load partition from selected compiled
inputs and has an optional Lambda-machine branch. It remains distinct from
`MAKE-SYSTEM`, which operates on ordinary system files in a running world.

The System 303 band-transfer surface remains `BAND-TRANSFER-SERVER`,
`RECEIVE-BAND`, `COMPARE-BAND`, and `TRANSMIT-BAND`. Receive and transmit can select
a subset of blocks, allowing a transfer to resume, and server policy can be `NIL`,
`T`, or `:NOTIFY`. Resumability does not make receipt nonmutating: accepted blocks
still overwrite the destination band.

The direct file-distribution surface in `distribution/dist.lisp` is:

- system and patch copying: `MAKE-DISTRIBUTION`, `COPY-SYSTEM`, `COPY-SYSTEMS`,
  `COPY-PATCH-FILES`, `COPY-PATCH-FILES-OF-SYSTEM-VERSION`, and
  `COPY-PATCH-FILES-OF-SYSTEM`;
- machine inputs: `COPY-MICROCODE-FILES`, `TRANSLATE`, and
  `COPY-INSTALLED-VERSIONS`;
- broader selections: `COPY-WORLD`, `COPY-DOCUMENTATION-DIRECTORIES`, and
  `COPY-OZ-WORLD`;
- media and inspection helpers: `MAGTAPE-WRITE-SYSTEM-DIRECTORIES`,
  `DIRED-SYSTEM-DIRECTORIES`, `DIRED-ALL-DIRECTORIES`, and
  `DELETE-FILES-WITH-BAD-CONTENTS`, plus tape-restore pathname transforms.

Despite its name, `COPY-WORLD` copies system source and related files; it does not
copy the currently running memory or a `LOD` partition. `COPY-OZ-WORLD` similarly
selects logical source, binary, and documentation directories. Band transfer and
file distribution are parallel preservation paths, not aliases.

## Genera 8.5 SCT

The installed documentation expands SCT as *System Construction Tool*. Its source
evolves the System 303 model: a system definition names modules, components,
dependencies, source and destination policy, journal policy, patch policy, and
machine variants. Commands construct a plan for compilation, loading, editing, or
distribution. A plan can be shown or simulated before operations execute. Journals
record system/component histories and version designations.

### Complete documented `DEFSYSTEM` option inventory

The 24 options in the installed 8.5 material are:

| Concern | Options |
| --- | --- |
| Names and package | `:pretty-name`, `:short-name`, `:default-package`, `:package-override` |
| Paths and module type | `:default-pathname`, `:default-destination-pathname`, `:default-module-type` |
| Dependencies and components | `:required-systems`, `:parameters`, `:initializations` |
| Journals and versions | `:maintain-journals`, `:journal-directory`, `:version-mapping`, `:initial-status` |
| Patches and reporting | `:patchable`, `:patches-reviewed`, `:patch-atom`, `:bug-reports`, `:maintaining-sites` |
| Publication and installation | `:advertised-in`, `:source-category`, `:distribute-sources`, `:distribute-binaries`, `:installation-script` |

The list describes system declarations, not CP command keywords. A site or patch can
extend the system-definition machinery; completeness here is limited to the installed
8.5 documentation and inspected implementation.

### Complete active SCT CP command inventory

Eleven active direct commands are defined in the inspected SCT CP sources:

| Command | Source-defined arguments and options |
| --- | --- |
| `Load Patches` | All, Local, or a sequence of systems; `:Query`, `:Include Components`, `:Save`, `:Show`, `:Dangerous Patch Action`, `:Excluding`, `:Machine Type`. |
| `Load System` | System; `:Condition` (Always or Newly-Compiled), `:Query`, `:Redefinitions Ok`, `:Version`, `:Branch`, `:Silent`, `:Load Patches`, `:Include Components`, `:Component Version`, `:Simulate`, `:Machine Type`. |
| `Show System Modifications` | System; `:Author`, `:Before`, `:From`, `:Matching`, `:Newest`, `:Number`, `:Oldest`, `:Reviewer`, `:Since`, `:Through`. |
| `Show ECOs` | No command arguments in this definition. |
| `Compile System` | System; `:Version`, `:Branch`, `:Condition` (Always or New-Source), `:Copy Compile`, `:Load`, `:Query`, `:Redefinitions Ok`, `:New Major Version`, `:Update Directory`, `:Silent`, `:Batch`, `:Include Components`, `:Component Version`, `:Simulate`, `:Machine Type`. |
| `Edit System` | System; `:Branch`, `:Include Components`, `:Machine Types`, `:Query`, `:Silent`. |
| `Show System Plan` | System and operations; `:Detailed`, `:Version`, `:Machine Types`, `:Date Checking`. |
| `Show System Definition` | System; `:Detailed`, `:Version`, `:Use Journals`. |
| `Show System Components` | System. |
| `Show Additional Patches` | Systems; `:Comments`. |
| `Show System Version Designations` | Systems. |

`Create System` and `Release System` appear only in a block-commented source region
and are not counted as active commands. Their presence is design residue, not proof
that a user could invoke them in this release.

`Compile System` controls how source freshness, copying, loading, confirmations,
component inclusion, journaling, and target machine type affect the plan. `Load
System` builds a load plan rather than blindly loading every file. `Show System Plan`
and `:Simulate` expose the distinction between planning and execution. Nevertheless,
some plan construction can consult file state and journals; “simulate” means no
planned compile/load operation, not necessarily zero reads or zero ephemeral Lisp
allocation.

## Genera patches

Genera retains ordered patch directories and adds plan integration, component-system
handling, dangerous-patch policy, dependency retries, journals, and a larger Zmacs
authoring surface. `Load Patches` normally considers only systems whose patch
directory creation date changed. An unfinished patch stops the sequence. A patch can
require a minimum patch level in another system; the loader queues the dependent
system and retries it after prerequisites are processed.

The default `:Dangerous Patch Action` is to skip dangerous patches; the alternatives
query or load. This default is source-visible safety behavior, not a promise that
ordinary patches are harmless. The source's journal update narrows a concurrency
race by checking before the write and, on LMFS, again after writing but before
closing. Its own comment says a true distributed lock service is not yet present, so
this must not be described as transactional or globally locked patch installation.

### Complete public Zmacs patch-command inventory

The 24 direct public named commands in the inspected patch editor are:

1. `Edit System Files`
2. `Edit Patch File`
3. `Start Patch`
4. `Start Private Patch`
5. `Declare System for Private Patch`
6. `Resume Patch`
7. `Select Patch`
8. `Add Patch`
9. `Add Patch Undefine Function`
10. `Add Patch Cleanup Flavor`
11. `Finish Patch`
12. `Abort Patch`
13. `Revoke Patch`
14. `Set Patch Author`
15. `Set Patch Reviewer`
16. `Add Patch Changed Definitions`
17. `Add Patch Changed Definitions of Buffer`
18. `Add Patch Changed Definitions of Tag Table`
19. `Show Patches`
20. `Recompile Patch`
21. `Reload Patch`
22. `Edit Patch Comment`
23. `Add Patch Comment`
24. `Show Patch Mail Example`

The workflow can save modified source buffers, compile the patch, handle compiler
warnings, edit the explanatory comment, send patch mail, and record dependencies.
These are named commands; the inspected source installs no general direct key
bindings for them.

Two additional commands exist only in the special patch-description editing buffer:
`Exit Patch Description Edit` and `Abort Patch Description Edit`. In that buffer,
`End` or `Control-Altmode` exits and continues; `Abort`, `Control-Z`, or `Control-]`
aborts. Those local keys are not global Zmacs patch bindings.

## Genera World Building

World Building is a command-table subset under Site Administration, not a single
frame or one “World Builder” application. The source assigns four direct commands:

| Command | Role | Open Genera relevance and risk |
| --- | --- | --- |
| `Save World` | Save a complete, or where supported incremental, world to a pathname. | Writes a world load and transforms the running process into the save path; not exercised. |
| `Show Login History` | Report login history. | Read-oriented, but ancillary to construction. |
| `Optimize World` | Perform immediate layered garbage collection/release work before a save. | Confirms a roughly forty-minute operation and mutates the live world's state; not exercised. |
| `Configure MacIvory Application` | Prepare MacIvory application configuration. | Platform-specific and not the Open Genera/VLM workflow. |

On the VLM, `Save World` accepts a pathname and defaults to a complete save; the
complete/incremental choice is present only when incremental saving is enabled.
`DISK-SAVE` prepares the world, resets temporary allocation, reaches a point it labels
too late to return from, transfers control to an initial process, and waits. The VLM
implementation refuses a second save from the same running world. A save is
therefore neither an ordinary file-copy command nor a reversible UI experiment.

Genera pathname types distinguish `:COLD-LOAD` (`LOAD`), `:I-COLD-LOAD` (`ILOD`),
and `:V-COLD-LOAD` (`VLOD`). A VLOD is a structured saved virtual-memory image, not
an archive of independent source files. CADR `LOD` partitions and Genera VLOD files
occupy analogous lifecycle positions but are not the same on-disk format.

## Genera distribution and restoration

### Complete CP command inventory

Four direct CP commands expose the subsystem:

| Command | Source-defined options |
| --- | --- |
| `Distribute Systems` | System/version specifications; `:Source Category`, `:File Types`, `:Default Version`, `:Query`, `:Menu`, `:System Branch`, `:Flatten Files`, `:Compress Files`, `:Include Patches`, `:Distribute Patch Sources`, `:Include Components`, `:Included Files Checkpoint`, `:Use Cached Checkpoint`, `:Use Disk`, `:Tape Spec`, `:Full Length Tapes`, `:Machine Types`, plus generic More Processing and Output Destination controls. |
| `Restore Distribution` | `:Use Disk`, `:Skip Restoration`, `:Menu`, plus generic output controls. |
| `Show Distribution Directory` | `:Use Disk`. |
| `Verify Distribution` | `:Use Disk`. |

With no system specifications, `Distribute Systems` enters its menu-driven frame.
The source notes that an existing frame preserves prior system specifications but
resets keyword-derived state; it calls this inconsistency out rather than hiding it.
Generating a plan and writing media are separate actions, and a new plan initially
selects all included files.

The media abstraction covers tape and disk, with platform-dependent removable-media
support. Disk output uses a tape-like image representation rather than turning the
distribution into a VLOD. Restoration likewise initializes media, displays its
systems/files, lets the user select a subset, and only then performs copying. Before
performing, the source checks that the medium still identifies as the one initialized.

### Distribution frame: panes and commands

The standard `distribution` frame and the `small-distribution` variant have the same
eight direct panes; only sizing and fonts differ. The chooser selects the standard
form above 950 pixels of screen width and the small form otherwise.

1. `title`
2. `mode`
3. `menu`
4. `actions`
5. `defaults`
6. `default-recast-menu`
7. `display`
8. `interact`

Manual descriptions combine these into larger semantic regions, so their smaller
section count is not a contradiction to the eight implementation panes.

The 21 direct distribution-frame commands are:

1. `Add System Specs`
2. `Menu Delete System Specs`
3. `Delete System Specs`
4. `Menu Edit System Spec`
5. `Edit System Spec`
6. `Recast System Specs from Defaults`
7. `Recast System Spec from Defaults`
8. `Generate Plan`
9. `Toggle Distribution of File`
10. `Include All Files of System`
11. `Exclude All Files of System`
12. `Write Distribution`
13. `Switch Modes`
14. `Reset Defaults`
15. `Help`
16. `Distribute Refresh`
17. `Distribute Scroll Forward`
18. `Distribute Scroll Backward`
19. `Distribute Scroll to Beginning`
20. `Distribute Scroll to End`
21. `Distribute Remove Typeout Window`

The visible top menu exposes Add, Delete, Edit, Generate Plan, Write, Switch, Reset,
and Help; Recast has a separate control. The two `Menu ...` commands are menu
wrappers rather than additional conceptual operations.

In system-specification mode, left-clicking the title invokes Add, left-clicking a
system line invokes Edit, middle-clicking a system line invokes Delete, and the
right-button menu includes Recast. In plan mode, left-clicking a file toggles its
selection, left-clicking a system header includes all its files, and middle-clicking
the header excludes them.

### Restoration frame: panes and commands

The `restore` frame has six direct panes:

1. `title`
2. `menu`
3. `actions`
4. `system-display`
5. `display`
6. `interact`

Its 19 direct commands are:

1. `Select All Systems`
2. `Deselect All Systems`
3. `Select System`
4. `Deselect System`
5. `Toggle Selection of System`
6. `Select All Files of System`
7. `Deselect All Files of System`
8. `Select File`
9. `Deselect File`
10. `Toggle Selection of File`
11. `Initialize Restoration`
12. `Perform Restoration`
13. `Help`
14. `Restore Refresh`
15. `Restore Scroll Forward`
16. `Restore Scroll Backward`
17. `Restore Scroll to Beginning`
18. `Restore Scroll to End`
19. `Restore Remove Typeout Window`

The visible menu has Initialize, Perform, and Help. Other selection operations are
presentation-driven: left-clicking a file or system toggles it; left- and
middle-clicking a file-system header select or deselect all its files; left- and
middle-clicking the systems title select or deselect all systems. The source also
defines translators for typed selection and deselection commands.

Both frames bind Help and Refresh, `Control-V` or Scroll for forward scrolling,
`Meta-V` or Meta-Scroll for backward scrolling, `Meta-<` and `Meta->` for the
beginning and end, and Space to remove a typeout window.

## Source/manual differences that affect operation

| Release and surface | Manual evidence | Pinned source evidence | Documentation conclusion |
| --- | --- | --- | --- |
| System 303 `MAKE-SYSTEM` | Lists fourteen keyword options. | Adds `:NO-LOAD-PATCHES`, `:DO-NOT-DO-COMPONENTS`, `:NOWARN`, and `:DESCRIBE`. | The source inventory is broader for this check-in. |
| System 303 `LOAD-PATCHES` | Lists `:HOSTS` and `:NOHOSTS`; omits `:NOWARN` and `:NOOP`. | Parser rejects the host switches and accepts the omitted pair. | Do not present the manual list as the executable grammar of this source. |
| Genera `Load Patches` | Says `:Include Components` defaults to No. | Command definition defaults it to true. | Unresolved release-artifact contradiction; inspect live argument prompting before choosing. |
| Genera `Load System` | Includes `:Condition Never`. | Active command choice is only Always or Newly-Compiled. | `Never` is not source-supported by this command definition. |
| Genera machine targets | Manual option summaries omit `:Machine Type` for Compile, Load, and Patches. | Active commands implement it. | The source exposes a target-machine control absent from those summaries. |
| Genera `:Branch` | Manual calls it reserved for future use. | Source conditionally uses it when version-control support is present. | Its effect depends on loaded feature support; “always inert” is too strong. |
| Genera distribution options | Manual omits `:System Branch` and `:Flatten Files`. | `Distribute Systems` accepts both. | Include both in the release-bounded source inventory. |
| Genera `:Full Length Tapes` | Manual says default No. | Source default is true. | Unresolved release-artifact contradiction. |
| Genera disk distribution | Manual says a disk plan is not divided by a size limit. | Plan construction assigns disk a finite tape-equivalent capacity and divides the plan. | Preserve the disagreement; do not promise unlimited single-volume output. |

These differences are why the manual is used as evidence of supported intent, while
source is used to enumerate the exact implementation inspected. Neither establishes
site-local patches or runtime state by itself.

## Runtime verification and safety boundary

No construction, patch installation, world save, band write/transfer, distribution
write, or restoration operation was run for this dossier. Those actions would modify
a private copy of a preserved band/world, write derived licensed material, change
patch or journal state, or affect another endpoint. `MAKE-COLD`, `DISK-SAVE`,
`RECEIVE-BAND`, `TRANSMIT-BAND`, `LOAD-AND-SAVE-PATCHES`, Genera `Compile System`,
`Load System`, `Load Patches`, `Save World`, `Optimize World`, `Write Distribution`,
and `Perform Restoration` are explicitly outside the experiment boundary.

An existing reviewed Genera 8.5 System Menu observation confirms that `Distribute
Systems` is visibly registered in the release; see
[Activities and the System Menu](genera/activities-and-system-menu.md). It does not
verify either distribution frame's panes, menus, mouse gestures, defaults, media
initialization, or results. Those claims above are source/manual findings.

No application-frame screenshot is published here. A useful new capture would
require a fresh isolated world, opening only `Distribute Systems` and `Restore
Distribution`, and stopping before Generate Plan, Initialize Restoration, Write, or
Perform. That bounded frame-only observation was not made during this audit, so the
visible layout remains an explicit screenshot `TODO` rather than a guessed runtime
claim. Any candidate must first pass the image-specific
[screenshot publication review](screenshot-publication-rights-review.md) and retain
the Genera harness provenance required by
[the computer-use procedure](genera/genera-computer-use-harness.md).

For System 303, a future safe check could invoke `MAKE-SYSTEM` with `:PRINT-ONLY` on
a disposable private session and capture only its proposed transformations. It must
not progress to `DISK-SAVE`, patch loading, or a band-transfer receiver. System 46
offers no equivalently useful nonmutating application UI for the construction path;
its direct operations are loader or media writers.

## Preservation implications

- Preserve source trees, QFASLs, patch directories, saved worlds/bands, disk labels,
  and distribution media as distinct artifact classes. None substitutes for all the
  others.
- Record exact system definitions and journal/patch metadata with files. A directory
  full of Lisp source does not preserve dependency order, target variants, or the
  loaded patch sequence.
- Treat world saves as machine-state evidence. They may retain compiled functions,
  objects, fonts, and application state absent from a file distribution, but they do
  not recover original source comments, formatting, macro inputs, or build history.
- Clone writable media before experimenting. A confirmation prompt reduces operator
  error; it does not make `MAKE-COLD`, `DISK-SAVE`, restore, or band receipt safe on
  an original.
- Record contradictions instead of silently normalizing them. The exact source,
  manual edition, runtime world, and patch level determine which default a restorer
  actually encounters.

## Open questions

- Which historical MIT check-in first introduced the `MAKE-SYSTEM` and patch-manager
  implementations represented in maintained System 303?
- Does an unpatched Genera 8.5 runtime prompt show the source or manual default for
  `Load Patches :Include Components` and `:Full Length Tapes`?
- Does the shipped disk distribution path enforce the finite capacity visible in
  source for every target, or does a later method specialize it away at runtime?
- Which incremental-save facilities are present and supported in the exact Open
  Genera VLM world, beyond the conditional command grammar?
- A frame-only, nonmutating runtime capture of the Genera distribution and restore
  interfaces remains to be made and reviewed.

## Reproducible source inventory

### Public MIT sources

| Revision-relative file | Bytes | SHA-256 |
| --- | ---: | --- |
| System 46 `src/lispm/lfl.192` | 15,463 | `b2da667d3bf2bd211717accfc984fbdf01309912155815d0bc32e3ca05901759` |
| System 46 `src/lispm/coldut.22` | 47,914 | `4566bcd85cbb95758a44e968cddff6d32afe28b476fc214ac59aa49248a905bc` |
| System 46 `src/lispm/qmisc.281` | 62,028 | `ed80c13e4d51f5d9b3132a8f193673f081f25d310835087c40cc8c9b08d063ad` |
| System 46 `src/lispm2/band.16` | 10,792 | `3c10189cd539effe1c93f626e98a11c35d8c4e7ce5fe7b7e1a31774e3a4bc40e` |
| System 46 `src/lmman/fd_hac.50` | 14,881 | `d064109ae6b51b3b2b9962d6c0867145ef0f844fea82765a88598bb013194ba4` |
| System 46 `src/lmdoc/instal.newsys` | 9,779 | `d28a26342143907a7ce546097fc58d56328906550d34fb240ba60a365f3125e1` |
| System 303 `l/sys/sys2/maksys.lisp` | 93,257 | `bc2c889505560ff2b70b0b213d761b51f50cb443651048882f78f42c6825eba3` |
| System 303 `l/sys/sys2/patch.lisp` | 34,441 | `39f6ac864aff3c905432f2897313cd5402d69c746bd0af14e4318b3ebb46a07f` |
| System 303 `l/sys/zwei/pated.lisp` | 17,116 | `4aca984824d8050a3aff9750154f8db876c2a3f5bc28d46705c778d9c901fb13` |
| System 303 `l/sys/cold/coldut.lisp` | 58,186 | `7f5d92f5423f3292ba2a9e858f9848d3fecf79294324be75ab4dc928da06d204` |
| System 303 `l/sys/sys2/band.lisp` | 13,316 | `f7de2972368f491b9f0fc37729ccb37d1f58465a72a5140b5ad0a5a2928b504c` |
| System 303 `l/sys/distribution/dist.lisp` | 13,808 | `5ea9feb1db1b65871b24f026607903f71ad31a419e1e054a3f708e8031becf85` |
| System 303 `l/sys/man/maksys.text` | 34,612 | `8d6408bfdd6a915be9ef4a0bf4e2a99bab8d9832a09d8dcbb7a6eecffe0cc1c2` |
| System 303 `l/sys/man/patch.text` | 26,069 | `91b478c477e1e3f131cbf6d41f0bbbee773be87d02b7cab0bc8fe7780d6afacb` |
| System 303 `l/sys/man/fd-hac.text` | 83,921 | `db1562bb42be7daae0fe1a16cc8bc1b9ab2c93254e546b2e84190b28ed7607a5` |

### Licensed Genera source observations

Paths are relative to the licensed extracted `sys.sct` tree; they are identifiers,
not repository links.

| Artifact-relative file | Bytes | SHA-256 |
| --- | ---: | --- |
| `sct/system-commands.lisp.~317~` | 43,999 | `697d1113826658c3afbef9e015f845b48638f39ddff8ebceb4676eeb01085420` |
| `sct/development-commands.lisp.~27~` | 47,662 | `eaa796b79baee9857ee7950277c3331fee8f7fc3ad0bea1ff6d7ed00f9f1cdfa` |
| `sct/patch.lisp.~229~` | 98,924 | `b41723c2a78ab071ed48629a742206e7f888bfacc86c24d1a5685e1cde73e870` |
| `sct/make-plan.lisp.~247~` | 82,494 | `6e30839bbfcd31a160fa910cdb501981b5bf1115596140699581a7b4c52cc3bd` |
| `sct/journals.lisp.~246~` | 82,325 | `5f76f0ffafa14403f1021b14dd749ea622991f933ee6b4906c01650ed09c46ff` |
| `sct/distribution-support.lisp.~56~` | 35,434 | `25ab53fc18cf694d9ef7262d83db7233a819e27af7e3ccbac957643cc5429825` |
| `cp/sct-commands.lisp.~28~` | 18,995 | `840810443a6a01aa6b423ca0a1becd1aab44203e51ebf086481a7905ee54f70b` |
| `zwei/pated.lisp.~321~` | 127,190 | `010026c3ca264dc76c3278eda79bbbd69d1e9f51e4a6d088c686187ba2f418bf` |
| `distribution/distribution-commands.lisp.~4024~` | 27,254 | `8d07d4585c5d70023b525eefb9a63bd844065367fd9e6d1f449353e80b94fb3d` |
| `distribution/distribute-frame.lisp.~4040~` | 56,321 | `a9aba96d2e276d4ff5d18e617c55ab9033e1ccf3e3086b8c23d5dc296ba07adc` |
| `distribution/restore-frame.lisp.~4029~` | 37,635 | `61848009a9b511055bba7a664163b0a3e23e4cf11896b264c57aead5cbdef437` |
| `distribution/distribution.lisp.~4084~` | 28,711 | `27c1100afece07529072c05874a7f3d8e7702d9fc8ac3496195d58434d57ccfd` |
| `l-sys/disk-save.lisp.~158~` | 55,040 | `4709ea266a71715b0138a32b1e4eaa72afc9b832e39c86999aab2472ef99fcf9` |
| `cp/utility-commands.lisp.~343~` | 36,758 | `31e1c10c3c4e7d0d40332e0a0110832fce7d42185c7979415a4905a4ecae517d` |
| `cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` |
| `io/pathnm.lisp.~882~` | 121,441 | `c0d34616bf7f3c2638e556773e8d9b745ddb2c6f3799af929117f5190ddcb4e0` |
| `embedding/macivory/ui/file-formats.lisp.~39~` | 29,952 | `70b521b6bf90116def9cd0b33be736fc0a14ca4699db2962dd6d435e576e0511` |

### Licensed installed-manual observations

| Artifact-relative file | Bytes | SHA-256 |
| --- | ---: | --- |
| `doc/installed-440/cp/cp2.sab.~152~` | 164,164 | `2dda47b43c53edcab060da0d5b513f2d5735d7d4d447157aa2cdd269a3dae7b6` |
| `doc/installed-440/cp/cp3.sab.~184~` | 404,196 | `24ed5565a80c9857feae331466cffc9cecbdf6439ae30a3de0f650e0f4b1c484` |
| `doc/installed-440/cp/maint1.sab.~78~` | 147,908 | `51159979903e91d26f75126a4839f826d36aaf72fdbdffdec027bbe30ce76705` |
| `doc/installed-440/cp/maint2.sab.~50~` | 55,657 | `b6649aad7149f5619ad803709351937d2d80b79ccf10e718c67dfd6293d97835` |
| `doc/installed-440/cp/maint3.sab.~40~` | 72,675 | `69984c38bdedf59b2dd6f478ad560310361850326570c3720ccb060814e235d4` |
| `doc/installed-440/tape/tape2.sab.~89~` | 249,366 | `9bc055e332c9364094580727644173c41a8f6083c7efdb062bef49d5005bc863` |

The installed `.sab` material was decoded only under the repository's ignored
Genera help build tree. The table identifies original inputs; decoded licensed prose
is not tracked or linked.

## Sources

- MIT CADR System 46, [`QLD` and world-loading source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/lfl.192),
  [`MAKE-COLD`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/coldut.22),
  [`DISK-SAVE`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281), and
  [band transfer](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/band.16),
  revision `8e978d7`; verified 2026-07-18.
- MIT CADR System 46,
  [file and band handling notes](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/fd_hac.50) and
  [new-system installation notes](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/instal.newsys),
  revision `8e978d7`; verified 2026-07-18.
- LM-3 System 303,
  [`MAKE-SYSTEM` implementation](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/maksys.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [patch manager](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/patch.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [ZWEI patch editor](https://tumbleweed.nu/r/lm-3/file/l/sys/zwei/pated.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in [`4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91);
  verified 2026-07-18.
- LM-3 System 303,
  [cold-load writer](https://tumbleweed.nu/r/lm-3/file/l/sys/cold/coldut.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [band transfer](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/band.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [distribution utilities](https://tumbleweed.nu/r/lm-3/file/l/sys/distribution/dist.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- LM-3 System 303,
  [`MAKE-SYSTEM` manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/maksys.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91) and
  [patch manual source](https://tumbleweed.nu/r/lm-3/file/l/sys/man/patch.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- Symbolics, [Program Development Utilities, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf),
  system construction and patching chapters; verified 2026-07-18.
- Symbolics, [Site Operations, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Site_Operations.pdf),
  world building, distribution, and restoration chapters; verified 2026-07-18.
- Symbolics, [Open Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  world-load and VLM operating context; verified 2026-07-18.

Last verified: 2026-07-18.
