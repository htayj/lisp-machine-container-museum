---
type: Artifact Analysis
title: FSEdit and File System Maintenance in Symbolics Genera
description: A rights-conscious, manual- and artifact-grounded dossier on Genera FSEdit, the four File System Maintenance menu levels, LMFS salvage, partitions, and destructive-operation boundaries.
tags: [genera, fsedit, fsmaint, lmfs, salvage, file-system, preservation]
timestamp: 2026-07-18T06:44:46-04:00
---

# FSEdit and File System Maintenance in Symbolics Genera

Genera's File System Maintenance program is two interfaces in one
frame. FSEdit is the ordinary, mouse-oriented tree editor for viewing and
changing directories, files, links, and properties. Behind it are three
progressively more privileged maintenance menus for backup media,
free-record management, server shutdown, LMFS salvage, partition changes,
initialization, and finally direct editing of active file-system
structures.

The distinction is a data-safety boundary. Browsing a tree is not
equivalent to running the Salvager; soft deletion is not immediate
expunging; flushing the free buffer is not a hierarchy check; and
initializing or removing an LMFS partition can irretrievably destroy
data. The installed documentation itself grades the four menu levels
from general operations to “extremely dangerous” internal
manipulation.

This page records all 33 menu labels in that four-level framework, all
20 documented FSEdit object commands, every documented direct mouse
gesture and configuration switch, and the complete stated Salvager
option surface. It does not reproduce licensed Symbolics source or
Help prose. The earlier MIT disk-label and LMFILE layers are documented
separately in
[Disk labels, packs, checkout, and file-system repair](../mit-cadr/disk-labels-packs-and-file-system-repair.md).

## Evidence and rights boundary

The installed Help database and the limited source subset came from the
licensed Open Genera release and remain untracked. The decoded Help
stays under the ignored build tree. This article publishes only
portable artifact identities, short interface labels, factual
inventories, and original analysis.

| Licensed artifact | Bytes | SHA-256 | Use in this study |
| --- | ---: | --- | --- |
| doc/installed-440/fsed/fsed1.sab.~27~ | 42,970 | b9efac9a9abb05018fc05ae1c33a75c632019d2e0c02a21364a278bd08b21b32 | FSEdit gestures, commands, variables, and display format |
| doc/installed-440/site/site1.sab.~53~ | 293,406 | 827915f0be3b308e7988af80ed53020b2928afcd6910aaeb1979bf59277a5728 | File System Maintenance framework and 33 menu labels |
| doc/installed-440/file/file7.sab.~59~ | 97,800 | 68be53ced439bdffe36310ada5bc5152b9bbcbe40a7271f54bf7455827104b18 | free records, LMFS Salvager, properties, and links |
| doc/installed-440/file/file8.sab.~34~ | 20,745 | 79325ecbd99b6271806207dfd08ad96f5fdcfdaecead44bedd0bdb4f02e9f810 | LMFS organization and operations |
| doc/installed-440/file/file9.sab.~35~ | 5,097 | 33b2c4b75b0a44479ece416f84040da24e8b2df56ea37dc8b0190f87d18a5fd6 | local LMFS maintenance entry points |
| lmfs/defstorage.lisp.~3033~ | 61,929 | dee8e9b5dc62948bb8208cc28450d1ca45bbba5322a0901d2658d02e7794ba8a | flat storage-description substrate |
| lmfs/fs-user.lisp.~109~ | 4,927 | e73fc6dcda32fc3fd51aef046f44a5962b9c60a66f0ea027fa3f2403cead877f | local/remote LMFS access-path boundary |
| lmfs/lmfs-pathnames.lisp.~79~ | 18,054 | d32dbc2b91283339ec75ec2cfe586b8080b38da8d4a1b177515f1b1169e6a9dc | LMFS pathname behavior in the distributed subset |
| lmfs/fep-pathnames.lisp.~129~ | 13,629 | 6eb480065501ef795ec78adad5171f33a135f764ec8ecd6ad96fb4761f0ab1c0 | FEP pathname behavior in the distributed subset |

The inspected source subset does not contain the implementation of the
FSEdit frame, its object menus, the File System Maintenance command
levels, or the LMFS Salvager. Consequently, the user interface and
maintenance behavior below are installed-Help and public-manual
findings unless explicitly marked as a limited source finding. A
future complete licensed-source recovery is required for the same
code-level completeness achieved for the MIT tools.

## Names and boundaries

| Name | Role |
| --- | --- |
| File System Maintenance, or FSMaint | The whole frame: command menu plus a large interaction/editor pane |
| FSEdit, or File System Editor | The tree-oriented state of the large pane |
| LMFS | The Lisp Machine File System being maintained |
| FEPFS | The Front-End Processor file system that holds LMFS partition files, boot files, and suitable emergency logs |
| Salvager | The LMFS record scanner that rebuilds free maps and can inspect hierarchy and repatriate orphans |
| Dired | A separate Zmacs special-purpose directory editor; it is not FSEdit |

The frame starts with a command menu above a Lisp Interaction pane. A
Tree Edit command changes the large pane into FSEdit. Lisp Window
changes it back, where Command Processor commands or Lisp forms can be
entered. The menu has four nested levels; moving deeper increases both
authority and potential damage.

## Entry points and a version discrepancy

The installed Genera 8 documentation gives three entry routes:

- Select F;
- the Command Processor command Select Activity File System
  Operations; and
- File System in the System menu.

Those are intended documented routes, not all confirmed behavior of the
repository's live 8.5 world. A fresh runtime inventory documented in
[Activities, Select keys, and the System Menu](activities-and-system-menu.md)
found no Select F binding and no File System Maintenance entry in the
live activity table. That world may differ by release, loaded systems,
or site state. The discrepancy is preserved rather than “corrected”
from one source.

The workbook assigns three gestures to Tree Edit Home Dir:

| Gesture | Workbook behavior |
| --- | --- |
| Left | Use the user's directory on the file-server machine |
| Middle | Use the user's directory on the current machine, or notify if none exists |
| Right | Prompt for a host, then use the user's directory there |

The Site Operations Help record only says that Tree Edit Home Dir uses
the home directory. Because the exact three-way behavior has not yet
been exercised in the 8.5 runtime, it remains a version-sensitive
manual finding.

## FSEdit's tree model

The selected base directory opens automatically. Each inferior appears
as an indented row:

- a closed directory initially has a pathname row with no inferiors;
- opening it inserts rows for its contents;
- a file row has name, type, version, lengths, dates, and available
  ownership/flag fields; and
- a link row substitutes an arrow and target pathname for ordinary
  length detail.

Opening successive directories produces a recursive tree, not a new
window for each directory. Closing a directory hides its inferiors.
The ordinary mouse scrolling behavior handles trees larger than the
pane.

FSEdit caches an opened directory. If another user changes it, the
display can be stale until Decache tells FSEdit to discard the cached
model and reread the directory. This is an important operational
distinction: Refresh Display repaints the current view, whereas Decache
refreshes its file-system data.

### Directory-row notation

The documented common row can contain:

| Field or mark | Meaning |
| --- | --- |
| leading D | object is soft-deleted |
| physical volume | storage volume, where the host reports one |
| name, type, version | pathname components |
| blocks and bytes with byte size | two size representations |
| creation date and time | creation timestamp |
| reference date | most recent reference date |
| X= date | last expunge date on a directory, in place of reference date |
| author and last reader | identities where the host records them |
| exclamation mark | not backed up |
| at sign | do not delete |
| dollar sign | do not reap |
| arrow and pathname | link target |
| DIRECTORY | directory object in place of byte length |

Fields depend on the remote file-system protocol. Their absence is not
evidence that a generic concept does not exist on another host.

## Direct FSEdit gestures

With TV:*USE-NEW-FSEDIT-COMMAND-SET* at its default true value:

| Gesture on an object row | Operation |
| --- | --- |
| Left | Toggle an open/closed directory; on a file, show the file |
| Middle | Delete or undelete the selected object |
| Right | Open the object-sensitive operation menu |

Setting that variable false restores the pre-Genera 8.0 mapping:
Left opens and Middle closes. It removes the direct Middle
delete/undelete gesture; deletion remains available from the menu.

TV:*CONFIRM-FSEDIT-QUICK-SOFT-FILE-DELETION* defaults true. Setting it
false removes confirmation only when the target host supports soft
deletion and therefore undeletion. FSEdit always confirms deletion on a
host where deletion is immediate. This prevents a preference intended
for reversible LMFS deletion from weakening the hard-delete boundary
on another file system.

The installed FSEdit Help defines no dedicated keyboard command table.
It refers to ordinary scrolling and to keyboard continuation after
typeout, while the encompassing Lisp Interaction pane accepts commands.
Without the missing implementation source or a runtime audit, this page
does not infer additional FSEdit keys.

## Complete FSEdit object-command inventory

Right-click presents only commands applicable to the selected object's
type and the host's capabilities. These are all 20 commands documented
by the inspected installed Help:

| Menu command | Objects | Behavior and boundary |
| --- | --- | --- |
| Delete | files, directories, links | Mark for soft deletion; shown only for a live object on a host with undeletion |
| Delete (immediate) | files, directories, links | Confirm hard deletion, then remove the row; used where soft deletion is unavailable |
| Wildcard Delete | directories | Prompt with wildcard defaults, list matches, confirm, delete with per-object error reports, and update the display |
| Undelete | files, directories, links | Restore a D-marked object where the host supports soft deletion |
| Rename | files, directories, links | Prompt for a new name; a full pathname can also move a file or link, but not a directory, to another directory |
| Show Properties | files, directories, links | Type out each property and value over the tree until keyboard continuation or Refresh Display |
| Edit Properties | files, directories, links | Use Choose Variable Values for changeable system and user properties |
| New Property | files, directories, links | Uppercase the supplied property name; an empty value removes the user property |
| Show | files, links | Display file contents without updating the reference date; a link must be transparent to read and target a file |
| Create Inferior Directory | directories | Prompt for a simple inferior name and create it |
| Create Link | directories | Prompt for link name and full target pathname |
| Expunge | directories | Permanently remove soft-deleted entries; offered only where the host supports the operation |
| Open | closed directories | Insert all ordinary inferiors; equivalent to the current Left gesture |
| Selective Open | directories | Open only entries matching a prompted wildcard; unspecified components default to a wildcard |
| Close | open directories | Hide the inferior rows |
| Link Transparencies | links, directories | Edit a link's operation transparencies or a directory's defaults, then choose Do It or Abort |
| Decache | directories | Discard the cached directory model and reread it from the host |
| Hardcopy | files | Open the system hardcopy menu for the file |
| Edit File | files | Invoke Zmacs on the file |
| Load | files | Load the file into the running Lisp world |

The Link Transparencies choice exposes five documented operation
keywords:

| Keyword | Operation redirected to the target when transparent |
| --- | --- |
| READ | open for input |
| WRITE | open for append |
| CREATE | open for output |
| RENAME | rename |
| DELETE | delete |

Defaults can be set on a directory for newly created links. This makes
a link's behavior operation-specific rather than a single
follow/do-not-follow switch. Directory links are a special case: the
documentation permits chains up to ten links and says the transparency
list is not interpreted while resolving such a directory chain.

Delete and Expunge must also be kept separate. Soft-deleted LMFS
objects can be undeleted. Expunge makes the corresponding storage
reclaimable and is not undone by FSEdit's Undelete command.

## All four File System Maintenance menus

### Level 1: general file-system operations

| Command | Behavior |
| --- | --- |
| Tree Edit Root | Enter FSEdit with the local root as base |
| Tree Edit Any | Prompt for a base directory, local or remote, then enter FSEdit |
| Tree Edit Home Dir | Enter FSEdit at a home directory; gesture details are version-sensitive as described above |
| Lisp Window | Return the large pane to Lisp Interaction state |
| Refresh Display | Clear overlaid typeout or continue from a More pause, then repaint FSEdit |
| Help | Type general help for the frame and FSEdit |
| Local LMFS Operations | Enter the Level 2 local-control menu |

Level 1 is the ordinary user surface. It can still change or delete
files through FSEdit, but it does not directly expose raw LMFS
structures.

### Level 2: local control and backup

| Command | Behavior and notable options |
| --- | --- |
| Incremental Dump | Dump the changed portion of the local root; Accept Values exposes its parameters |
| Complete Dump | Dump the complete local root; Accept Values exposes its parameters |
| Consolidated Dump | Produce a consolidated local-root dump; Accept Values exposes its parameters |
| Read Backup Tape | Retrieve individual files or reload a tape; its pop-up can instead list or compare |
| Find Backup Copies | Prompt for a file specification and locate matching tape copies |
| Display Tape Map | Prompt for a tape number and display the expected directory; a host and tape-directory pathname can select a remote catalog |
| List Backup Tape | Prompt for a mounted tape specification and list actual contents |
| Compare Backup Tape | Compare a mounted tape to local LMFS; Read Backup Tape is the documented route for remote comparison |
| List FEP FS Root | List the default disk unit's FEPFS root |
| Free Records | Left/default reports free, used, and total; Middle writes a per-directory usage report; Right reports usage by partition |
| Flush Free Buffer | Write the in-core pool of free records to disk; logout normally does this |
| Close All Files | Close every local and remote file open by the machine, including valid program use |
| Expunge Local LMFS | Expunge every local directory and report recovered space |
| Server Shutdown | Left schedules and announces shutdown; Middle cancels; Right reschedules |
| Server Errors | Display accumulated file-server error messages |
| Exit Level 2 | Return to Level 1 |
| LMFS Maintenance Operations | Enter the dangerous Level 3 menu |

Close All Files is not scoped to damaged LMFS files. It calls the
generic close-all operation and can disrupt healthy programs using
either local or remote files.

Server Shutdown is also narrower and broader than its label suggests.
It does not stop local LMFS operation. At the scheduled time it closes
and disables all Chaosnet servers on that machine, not only the file
server. The default delay is five minutes, and users receive periodic
notices containing the operator's message.

### Level 3: potentially destructive LMFS maintenance

| Command | Behavior and boundary |
| --- | --- |
| Salvage | Rebuild free maps and optionally check the hierarchy and repatriate orphans |
| Initialize | Create a new local LMFS or, through its Right menu, add a partition file; wrong use can destroy the existing file system |
| Check Records | Walk the hierarchy top-down and report record inconsistencies without performing the full salvage |
| Grow Partition | Select an LMFS partition and add a prompted number of blocks |
| Remove Partition | Evacuate files and directories, verify capacity, remove the partition, and optionally delete its now-empty FEP file |
| Exit Level 3 | Return to Level 2 |
| LMFS Internal Tools | Enter the extremely dangerous Level 4 menu |

Initialize's Right gesture offers New File System and Auxiliary
Partition paths. Added partitions are initialized by the system as part
of creation and must not be separately initialized. The documented
prompts include the FEP pathname and number of blocks. The initially
offered pathname is suitable for New File System and is explicitly
documented as never correct for Auxiliary Partition, so it must be
replaced rather than accepted by habit. An operation in progress must
not be interrupted; the documented estimate is about one minute per
4,000 records. Using this LMFS tool to create paging space is
specifically outside its contract and can destroy the file system.

Remove Partition first walks LMFS and evacuates objects to other
partitions. It reports insufficient space and can stop if the selected
partition is not empty. Its optional FEP-file deletion is only valid
after evacuation. The documentation explicitly excludes direct
manipulation of the active LMFS partition files and partition table,
including lmfs.file, lmfs1.file, and fspt.fspt.

### Level 4: active internal structures

| Command | Behavior |
| --- | --- |
| Active Structure Edit | Display active LMFS internal structures in an editable scrolling view |
| Exit Level 4 | Return to Level 3 |

Active Structure Edit is a debugger for people who already understand
the implementation. It is not a property editor and has no
source-verified transaction, undo, or validation guarantee in the
available evidence.

## Free records and crash behavior

LMFS keeps a small working pool of free records in memory; the
installed documentation describes roughly 30 records in normal use.
Those records are marked as in use in the on-disk free map while held
in the pool. A crash before the pool is flushed can therefore strand
space, but it should not make the same record available to two files.
Flush Free Buffer makes that state durable, and logout normally invokes
the same protection. The Salvager reconstructs the map and can recover
stranded records.

Free Records reports three different views because they answer
different questions:

- Left/default compares the maps' free and used totals and can expose
  lost records;
- Middle attributes record use by directory into a requested output
  file; and
- Right reports use by physical LMFS partition, which is the necessary
  capacity evidence before growing or removing one.

## LMFS partition files and FSPT

An LMFS installation can use a default FEP file on the boot drive and
additional FEP files as partitions. An optional FEP:>fspt.fspt table
records which FEP files comprise the local LMFS. If that table is
absent, the boot-drive lmfs.file is the default.

The LMFS partition contents do not themselves record their current FEP
pathname. That permits moving a partition file if FSPT is updated to
the new location, but it also means preservation provenance must retain
both the partition bytes and the external table that assembles them.
The table file is metadata for the set, not an interchangeable data
partition.

## The Salvager

### Complete option surface

Salvage opens an Accept Values menu. For a multipartition LMFS it first
lists the partitions, then provides:

| Option | Values and effect |
| --- | --- |
| partitions | select some or all for scanning |
| Top-down treewalk record check | Yes or No; after other work, walk from root and report bad records, missing files, and hierarchy disagreements |
| Check for and repatriate orphans | Yes or No; find unreferenced objects, restore them to the hierarchy, and replace bad directory records |
| Output recording | Tape, File, or Console only |
| File for output | destination used by File recording |

If any partition is deselected, the orphan option disappears. The
reason is architectural: repatriation requires a model of the complete
hierarchy, which cannot be established from only part of the local file
system.

The Genera 8.1 release notes changed the repatriation default to No
because automatically reinserting orphan objects was judged less safe
than making the operator request it. That is a versioned behavior
change; a screen from another release must not be assumed to use the
same default.

### What it repairs

The documented Salvager:

- reads every selected LMFS record;
- always reconstructs free-record maps;
- identifies records in use and free;
- finds objects present in storage but absent from the directory
  hierarchy;
- can repatriate those orphans;
- can perform a separate root-down hierarchy check; and
- can replace bad or misplaced directory records with fresh empty
  records.

When an orphan's intended directory cannot be recovered, it is placed
under a >repatriations>lost-N directory for human inspection. Orphan
storage remains in use even when repatriation is disabled, so the map
rebuild does not silently reuse its records.

The installed documentation characterizes repatriation as not losing
files. Because the actual Salvager source is absent and no destructive
runtime experiment was performed, this page records that as the
vendor's intended guarantee, not an independently verified outcome for
every damaged-record case. Replacing a record with a fresh empty one is
itself a reason to retain the pre-salvage disk clone.

### Logging is part of recovery

Tape output writes each message immediately in its special format;
industry-compatible reel tape is documented as durable for this use,
whereas immediate cartridge persistence is not guaranteed. File output
can use local FEPFS or another host's FEPFS or LMFS, but not the local
LMFS being salvaged. The default is a boot-unit-zero FEP file. Each log
line is followed by a finish operation so a crash should retain output
through the last completed line. Console-only logging is the fallback,
not the preferred evidence record.

Two documented Lisp helpers recover tape logs:

| Function | Arguments | Purpose |
| --- | --- | --- |
| LMFS:PRINT-SALVAGER-OUTPUT-TAPE | optional tape-spec and output stream | print the Salvager tape, prompting for omitted tape specification |
| LMFS:COPY-SALVAGER-OUTPUT-TAPE-TO-FILE | optional tape-spec and pathname | copy the Salvager tape into a file |

There is no documented automatic analyzer for the resulting file log.

## Limited source findings

The distributed source subset establishes two architectural points but
does not implement the visible programs:

1. The storage-description layer constructs explicit flat byte and bit
   fields over ART-8B storage, including bit arrays and character
   strings. It is an on-disk representation substrate rather than a
   graph of ordinary in-memory Lisp pointers.
2. The user-facing file-system access layer distinguishes a local LMFS
   access path from network paths. If local LMFS support is not loaded,
   it signals that condition instead of trying to connect back to the
   same machine through the network protocol.

The second behavior is a fail-closed local/remote boundary. It does not
establish how FSEdit commands are dispatched, how Salvager updates are
ordered, or whether Active Structure Edit has safeguards.

## Manual disagreements and source gaps

The evidence does not form one seamless specification:

- installed manuals prescribe Select F, but the inspected live 8.5
  activity table has no F binding;
- the workbook gives three mouse gestures for Tree Edit Home Dir,
  while Site Operations states only the generic home-directory result;
- the public and installed manuals describe the visible and operator
  surfaces, but the distributed licensed source subset omits their
  implementation; and
- installed Help states the intended no-file-loss property of
  repatriation, but the same description permits replacing bad records
  with fresh empty ones.

These are explicit TODOs for implementation recovery and runtime
observation, not invitations to select whichever version is more
convenient.

## Runtime and screenshot status

No FSEdit or File System Maintenance screenshot is published with this
page. The root operator did not clear a Genera harness slot for this
subtask, and the current private world is not documented as a configured
Symbolics site with a disposable local LMFS. Entering Levels 2–4
without that isolation would create an unnecessary risk of changing
licensed world or FEP storage. The live activity-table discrepancy also
means Select F cannot be treated as a verified route in this world.

TODO: copy the licensed world and all FEP/LMFS inputs into a named
isolated Genera harness session; create a disposable test hierarchy;
reach the frame through a route actually present in that world; capture
the initial Lisp pane, one FSEdit tree, an object-sensitive Right menu,
and the four menu levels without invoking maintenance actions. Verify
Left/Middle/Right behavior only on disposable objects. Record all
harness hashes and shutdown flags, then select only the minimum
scholarly images for image-specific review under
[the screenshot publication policy](../screenshot-publication-rights-review.md).

Destructive runtime tests of Initialize, Remove Partition, salvage
repair, or Active Structure Edit require a separately hash-identified
throwaway LMFS image and an explicit experiment plan. They are not
prerequisites for safely capturing the menus.

## Preservation implications

- Preserve the FEP partition files and FSPT together; neither alone
  completely identifies a multipartition LMFS.
- Hash an immutable pre-salvage copy. A successful boot or directory
  listing after salvage does not prove that every original record
  survived.
- Write Salvager output outside the local LMFS under repair.
- Use Free Records' partition report before any grow/remove decision.
- Treat Close All Files and Server Shutdown as machine-wide operations,
  not only file-system-local cleanup.
- Distinguish soft deletion, expunging, orphan repatriation, free-map
  rebuilding, record checking, and partition evacuation in research
  logs.
- Never infer an implementation guarantee from Active Structure Edit's
  presence; the available source does not expose its mutation model.

## Sources

- Symbolics, [Site Operations](https://bitsavers.org/pdf/symbolics/software/genera_8/Site_Operations.pdf), Genera 8.
- Symbolics, [Genera User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf), Genera 8.
- Symbolics, [Genera Workbook](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Workbook.pdf), FSEdit exercise.
- Symbolics, [Genera 8.0 Release Notes](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.0_Release_Notes.pdf), FSEdit mouse-command transition.
- Symbolics, [Genera 8.1 Release Notes](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.1_Release_Notes.pdf), safer orphan-repatriation default.
- The licensed installed-Help and source artifacts identified above,
  inspected locally without reproducing their payloads.

Last verified: 2026-07-18.
