---
type: Artifact Analysis
title: Disk labels, packs, checkout, and file-system repair on the MIT Lisp Machine
description: An evidence-bounded study of DLEDIT, disk partitions, LMFILE packs and volumes, checkout, garbage collection, salvage, and bad-pack recovery from System 46 through LM-3 System 303.
tags: [mit-cadr, lm-3, disk, dledit, lmfile, salvage, preservation]
timestamp: 2026-07-18T06:44:46-04:00
---

# Disk labels, packs, checkout, and file-system repair on the MIT Lisp Machine

The MIT Lisp Machine does not have one all-purpose “disk repair” program. It has
several layers whose similar vocabulary can hide very different risks:

- DLEDIT reads and changes the physical disk label and its partition table;
- partition utilities copy, compare, identify, and select load bands and
  microcode partitions;
- disk checkout and formatting test the controller and recording surface, often
  by deliberately overwriting blocks;
- LMFILE mounts FILE partitions as packs, groups packs into volumes, and
  maintains their allocation metadata; and
- garbage collection and salvage repair different classes of LMFILE
  inconsistency.

These layers must not be interchanged. Editing a partition descriptor does not
move its contents. A “checkout” is not a read-only consistency check. LMFILE
salvage cannot reconstruct a missing physical label by itself, and DLEDIT cannot
repair directory structure inside a FILE partition.

This dossier covers the public MIT System 46 snapshot and the maintained LM-3
System 303 restoration separately. System 303 is valuable evidence for the
later software, but its maintained Fossil tree is not silently treated as a
pristine historical distribution. The corresponding Symbolics tools are
documented in
[FSEdit and File System Maintenance in Genera](../genera/fsedit-and-file-system-maintenance.md).

## Evidence boundary

The System 46 source was inspected at Git commit
8e978d7d1704096a63edd4386a3b8326a2e584af. The LM-3 source was inspected at
Fossil check-in
4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91.
The local copies matched these portable identities:

| Release and artifact | Bytes | SHA-256 | Principal evidence |
| --- | ---: | --- | --- |
| System 46 lmio/dledit.7 | 18,009 | bd05e5451c4aa57776c3a8714606baf7bcbf04cdfc821e4e0cf74e13317ec600 | label editor, command loop, templates |
| System 46 lmio/disk.161 | 65,042 | b17d839f22f2a21d41f9c0c5d4e6050d034baad392b06c6955f5a7712f87d4ec | partitions, bands, copy and compare |
| System 46 lmdoc/disk.22 | 18,115 | 7e79abe9df8563dcc5c5289ddd5b8feeef2245cda453345ea3bb3c63ab3387c4 | contemporary disk documentation |
| System 46 lcadr/d1chk.15 | 15,837 | 55a993e9cb520169553ecc09346db34a173a754f49b4ed17ab1c90b346417c2b | single-drive diagnostics and format |
| System 46 lmcons/dcheck.81 | 41,950 | 82d249891a6a9386b92438efe8d6185fd04f615f17a21e6f15be4237d263330e | controller checkout |
| System 46 lmcons/cc.516 | 101,897 | e81c03f764a6e7e6840c476508b25276fc91eefaae854ca474285c62e63e2b9e | console/debug connection used by repair procedures |
| System 46 cadrdc/format.pack | 1,022 | f7b5f3f9b09407d0000760c88f9093d0813d4370889aa57a2e5c9b9d595aad49 | contemporary destructive pack-rebuild procedure |
| LM-3 io/dledit.lisp | 28,221 | 20b2843249da2867d31144f3729a3170182b72425c1568e4b50e48bec0f07696 | later DLEDIT and safety changes |
| LM-3 io/disk.lisp | 88,661 | 12367a86eb8154ccfe45fc3b92f99526feb28d66e08565ba420a86e142f8b689 | later partition and band operations |
| LM-3 file2/pack.lisp | 30,216 | 5013606d0fff388ea28b85aac4db2fc6551c0389cdaab8c2bb86f753a3314d6a | pack and volume lifecycle |
| LM-3 file2/free.lisp | 21,856 | 6295b3a87b676eee002dadedefa2b742d8cbce8a229ee3fbcd4523d33a4a0e31 | allocation maps and free-record buffer |
| LM-3 file2/gc.lisp | 6,734 | f7db6dfae260dae897b95f7d8b33cf6497a3e250ef2af93bb5817636e34fbc75 | file-system garbage collection |
| LM-3 file2/salvag.lisp | 8,258 | 19cd4644bb2651b3e81c83c22a803f83b9ad421adb9622a5776a2c68d686fd53 | hierarchy salvage |
| LM-3 file2/maint.text | 35,455 | 9952293f4b01e65d85f1770e81f8370308d42ac29cbacc1c44cb6f32b8a87362 | maintenance operator documentation |
| LM-3 cc/salvag.lisp | 9,161 | c3ffaf54e57ebac89aed8bd42c29e18fd17c3b6f7c59a8cf1440f84ff0952cab | negative boundary: crash-buffer recovery, not disk salvage |

The similarly named System 46 PACKD documentation describes Lisp packages, not
disk packs. It is not evidence for this subsystem. Likewise, LM-3
cc/salvag.lisp is a console-debugger utility for rescuing editor and Zmail
buffers after a crash, not an LMFILE disk salvager.

## The storage layers

| Layer | Authoritative object | Typical tool | What a change affects |
| --- | --- | --- | --- |
| Controller and medium | sectors, seeks, ECC, recording surface | DCHECK, DCHECK, FORMAT-DISK | physical blocks; tests may destroy data |
| Disk label | geometry and partition descriptors in the label block | DLEDIT | how later software interprets ranges of blocks |
| Partition | a named contiguous block range such as MCR, LOD, PAGE, or FILE | disk partition utilities | microcode, world, paging, or file-system payload |
| LMFILE pack | one formatted FILE partition | pack maintenance functions | allocation maps, root, clean state, and records |
| LMFILE volume | one or more packs with a shared volume identity | mount and volume functions | the set that must be present together |
| File hierarchy | directories, files, and pointers inside mounted volumes | GC and salvage | reachability and consistency of LMFILE records |

In LMFILE terminology, a pack is any FILE partition formatted for LMFILE. It
need not be a removable physical disk. Two FILE partitions on one drive can be
two packs. A volume can span several packs; every pack in that volume is
required for mounting it.

## DLEDIT: the physical label editor

### What is edited

DLEDIT places a label image in a disk request buffer in Lisp memory and edits
that image. Its display covers:

- pack name, drive name, and comment;
- label checkword and version, which are displayed but not ordinary editable
  fields;
- cylinders, heads, blocks per track, and blocks per cylinder;
- current microload and current load-band selections;
- partition count and descriptor size; and
- each partition's name, starting block, size, and comment.

The display marks the currently selected MCR and LOD partitions with an
asterisk. It also reports unallocated gaps and overlaps, so the operator can see
an internally inconsistent partition table before committing it.

The editor does not continuously update disk. Control-W is the explicit label
write. Until that command is confirmed, edits exist only in the in-memory
request buffer. Conversely, writing a changed start or size alters only the
descriptor: DLEDIT does not relocate, resize, copy, erase, or validate the
partition's existing payload.

The unit argument is broader than a local drive number. System 46 accepts a
local unit, a machine name reached over the Chaosnet disk protocol, or the
special CC debug-cable path. System 303 additionally decodes TEST as a
synthetic unit and MT as a magnetic-tape path. The CC path is restricted to
unit zero and has special handling for low-numbered blocks used by the remote
debug mechanism.

### Complete command comparison

This table inventories every source-defined command in the two DLEDIT command
loops. “Same” means System 303 retains the System 46 behavior unless the notes
state otherwise.

| Key | System 46 | LM-3 System 303 |
| --- | --- | --- |
| Control-B | Select the previous editable item | Same |
| Control-F | Select the next editable item | Same; can reach the synthetic insertion row after the last partition |
| Control-P | Move to the previous display line | Same |
| Control-N | Move to the next display line | Same; can reach the insertion row |
| Control-R | Read the physical label into the editor | Same |
| Control-W | Confirm and write the in-memory label to disk | Same; also clears the modified-state flag |
| Control-I | Choose a known pack template and initialize an in-memory label | Same |
| Control-E | Edit the selected field | Same |
| Control-O | Add a partition descriptor | Same |
| Control-K | Confirm and delete the selected partition descriptor | Same |
| Control-S | Sort partition descriptors by starting block | Same |
| Control-D | No command | Describe the selected partition |
| Control-L | No command | Redisplay |
| Form | Redisplay; this binding is present in source but omitted from its local Help text | Same source-only binding |
| Meta-tilde | No command | Mark the current in-memory image unmodified without writing it |
| Help or question mark | Display local help | Same |
| End | Exit immediately; unwritten in-memory edits are discarded without a warning | Warn when the in-memory image is modified, then offer the exit decision |
| Abort | No distinct command | Print a reminder rather than abandoning the editor |
| Any other key | Beep | Beep |

No mouse gesture is defined in either inspected command loop. Navigation and
editing are keyboard-driven.

### Startup changed between releases

System 46 begins by constructing a default label image in memory, displaying
it, and telling the operator to use Control-R to read the label that is already
on the disk. This creates a sharp safety boundary: entering DLEDIT has not yet
read the medium, and an accidental Control-W could replace its label with the
displayed default.

System 303 reads the existing label automatically during normal entry. It
constructs an initialized label only when its initialization option is
explicitly requested. It also tracks whether edits have occurred and warns at
End. These are concrete later safety improvements, not merely documentation
changes.

### Known pack templates

System 46 supplies templates for:

| Template | Geometry | Initial partition families |
| --- | --- | --- |
| Trident T-80 | 815 cylinders, 5 heads, 17 blocks per track | MCR1–MCR2, PAGE, FILE, LOD1–LOD3 |
| Trident T-300 | 815 cylinders, 19 heads, 17 blocks per track | MCR1–MCR2, PAGE, FILE, LOD1–LOD4 |
| Marksman M-20 | 210 cylinders, 4 heads, 21 blocks per track | MCR1–MCR2, LOD1, PAGE |

The LM-3 tree retains the two Trident choices but changes their proposed
partition sets, and adds a Fujitsu Eagle:

| System 303 template | Geometry | Initial partition families |
| --- | --- | --- |
| Trident T-80 | 815 cylinders, 5 heads, 17 blocks per track | MCR1–MCR2, PAGE, LOD1–LOD2, FILE |
| Trident T-300 | 815 cylinders, 19 heads, 17 blocks per track | MCR1–MCR8, PAGE, LOD1–LOD8, FILE |
| Fujitsu Eagle | 842 cylinders, 20 heads, 25 blocks per track | LMC1–LMC8, PAGE, FILE, LOD1–LOD6, METR |

A template is a proposed layout, not evidence that a particular surviving pack
has that layout. Reading and preserving its actual label remains the first
evidentiary step. The changed T-80 and T-300 sets also demonstrate why a drive
model alone is insufficient to infer which software release initialized a
label.

## Partition and band operations

The disk library provides the user-facing operations that DLEDIT deliberately
does not perform:

| Operation | Purpose and safety boundary |
| --- | --- |
| PRINT-DISK-LABEL | Decode and print a label without entering its editor |
| PRINT-DISK-ERROR-LOG | Report the error log maintained for the disk path |
| PRINT-LOADED-BAND | Identify the loaded world band |
| SET-CURRENT-MICROLOAD | Change the label's selected MCR partition |
| SET-CURRENT-BAND | Change the label's selected LOD partition |
| PARTITION-COMMENT and UPDATE-PARTITION-COMMENT | Read or update the comment attached to one descriptor |
| RECEIVE-PARTITION | Receive a partition image over the supported transport into a target range |
| TRANSMIT-PARTITION | Send a partition image from a source range |
| COMPARE-RECEIVED-PARTITION | Compare a received image with the disk range |
| LOAD-MCR-FILE | Put a microcode file into a microcode partition |
| COPY-DISK-PARTITION | Copy partition contents, separately from copying its descriptor |
| COMPARE-DISK-PARTITION | Compare the contents of two partition selections |
| FIND-MEASURED-PARTITION-SIZE | Infer the used extent where the payload format supports it |

System 303 adds COPY-DISK-LABEL, which explicitly confirms that the target
label will be smashed, and read-only helpers to describe partitions and find
plausible partitions after a label has been damaged. FIND-PLAUSIBLE-PARTITIONS
scans for headers that look like load bands; it is a recovery clue, not proof
of the original partition boundaries.

The later SET-CURRENT-BAND performs more checks than its name suggests. It
validates the partition naming convention, verifies PAGE capacity, checks
incremental-world base-band relationships, checks desired microcode, and asks
about mismatches. This protects boot selection; it does not validate every
object in the world image. The bootstrap PROM can find only MCR descriptors in
the label page it searches, so label placement remains a boot-level constraint.

### Interrupted-copy marker

Before System 303 copies a partition, it replaces the target partition comment
with “Incomplete Copy.” It restores the source comment only after the copying
loop completes. A reset or I/O failure therefore leaves a durable warning
rather than making a partial target look complete. The copy path also checks
target size and, for load bands, can use measured payload size instead of
blindly copying the entire partition.

This is a source-visible preservation feature absent from the maintenance
manual's high-level description.

## Disk checkout and formatting

The word checkout means controller and medium diagnosis here, not a harmless
inspection pass.

### The single-drive diagnostic

System 46 lcadr/d1chk.15 explicitly warns that it tests “disk #1,” must not be
run on a one-disk machine, and will clobber disk zero under that configuration.
Its DCHECK operation seeks, writes test patterns to block 1, rereads them, and
reports error bits. DC-WRITE-READ-TEST repeats destructive write/read cycles
until keyboard input stops it. That test prompts independently for cylinder,
head, block, and pattern; each address can be a single value, a case list, or
a stepped range, and ALL expands to the built-in range. Its complete built-in
pattern set is all zeroes, all ones, alternating bits, address-derived data,
floating one, floating zero, and a fixed “gubbish” value. A trace variable can
print each selected location and pattern.

FORMAT-DISK refuses unit zero in this version but otherwise formats the selected
medium cylinder by cylinder and zeros cylinders. Its built-in geometries cover
the T-80 and T-300, selected by its T-300-P argument. Refusing one unit is not
general data protection: the other unit is intentionally erased.

### The controller checkout

System 46 lmcons/dcheck.81 is aimed at a newly constructed disk controller. Its
test sequence covers:

- controller-register and bus response;
- block counter and rotational-position behavior;
- recalibration and seeks;
- non-existent-memory handling;
- a write/read pattern test at block 1; and
- reads from several block ranges before directing the operator toward format
  and ECC tests.

It has a USE-LOCAL-DISK path, but the inspected source reaches a breakpoint
whose own comment says the remainder will not work on that path. That is an
implementation limit, not a supported local-disk workflow.

Neither checkout belongs on the only copy of a preservation disk. Safe
emulator research requires a disposable, hash-identified clone and an explicit
expectation that its contents will be destroyed.

### The contemporary rebuild procedure

System 46 cadrdc/format.pack is a short operator procedure, tentatively labeled
for T-80 packs. It uses two CADRs connected by the debug umbilicus: a master
loads formatting microcode and performs operations on a slave whose normal pack
has been replaced by the pack to rebuild. After formatting, the procedure calls
for the destructive checkout and all-location write/read test, initializes the
slave label through DLEDIT's CC unit, and copies selected LOD and MCR
partitions from the master.

This establishes what “rebuild” meant at that boundary: format the medium,
construct a new label, then repopulate boot partitions from a known source. It
is not an in-place repair and does not preserve an unknown FILE partition.
The document's own uncertainty about applying beyond the T-80 is retained; the
procedure is not generalized to other pack models.

## LMFILE packs and volumes

### On-disk pack identity

An LMFILE pack header records at least:

- pack and version identity;
- volume name, pack number, and number of packs in the volume;
- an incarnation value;
- pages per LMFILE block;
- allocation maps;
- root block;
- comment and clean/dirty state;
- free-space thresholds;
- parent volume; and
- total block count.

Volumes form a parent/child tree. A child volume cannot mount without its
parent, and all packs in one volume must be present. Directory pointers are
constrained to the same volume or suitable descendants so a volume can be
salvaged without requiring arbitrary unrelated volumes.

### The three maps

The maintenance document describes a free map, a block-starts-file map, and a
“bad block map.” The maintained source names the third map LOCKED-BLOCK. Its
setter's own comment defines a locked block as bad and not to be used, so the
code corroborates the manual's intended map rather than defining a different
kind of object. The implementation adds an important nuance: it says not to
lock a block unless it is already in a file, removes a newly locked block from
the available/free pools, and remembers that live files can contain locked
blocks. The map excludes known suspect storage from future allocation; it is
not itself an automatic surface-error detector.

The block-starts-file map lets maintenance code locate every file independently
of directory reachability. The free map records allocation state. For speed,
LMFILE transfers free records into an in-core available table and marks them
used in the durable map. A crash can therefore lose available space, but the
design prevents those records from being allocated twice; garbage collection
can recover them later.

## Creating and changing packs

### INIT-FILE-PARTITION

INIT-FILE-PARTITION formats a FILE partition as a new pack. It dismounts any
current use, asks for strong confirmation, initializes the header and maps, and
marks the pack dirty so the first garbage collection builds its free map. It is
destructive.

The complete documented keyword surface is:

| Keyword | Documented default | Meaning |
| --- | --- | --- |
| VOLUME-NAME | FOO | volume identity |
| COMMENT | FOO | operator description |
| PAGES-PER-BLOCK | 1 | LMFILE block size in machine pages |
| PACK-NUMBER | 0 | this pack's index within its volume |
| PACKS-IN-VOLUME | 1 | required pack count |
| PARENT-VOLUME-NAME | ROOT | parent in the volume tree |
| DANGER-AVAILABLE-BLOCKS | 200 | critical low-space threshold |
| MINIMUM-AVAILABLE-BLOCKS | 300 | minimum desired reserve |
| MAXIMUM-AVAILABLE-BLOCKS | 2000 | upper reserve threshold |
| DESIRABLE-AVAILABLE-BLOCKS | 1000 | normal reserve target |
| AVAILABLE-TABLE-SIZE | 1200 | in-core free-record table capacity |

### REINIT-FILE-PARTITION

REINIT-FILE-PARTITION changes selected metadata while preserving the intended
pack contents. It can change:

- volume name and comment;
- number of packs and parent volume;
- all four availability thresholds; and
- available-table size.

It cannot change pages per block. If the underlying partition grew, it can
expand the maps to cover the new extent. It marks the pack dirty so garbage
collection reconciles allocation state. Because a mistaken identity or
geometry change can still make data unreachable, this remains a confirmed
maintenance operation rather than a harmless preference editor.

## Mount, dismount, and emergency state control

The complete operator-level lifecycle described by the maintained sources is:

| Entry point | Behavior |
| --- | --- |
| CONSIDER-UNIT unit partition [allow-errors] | Read and validate a prospective pack header into the tentative-unit set |
| MOUNT-TENTATIVE-UNITS | Require complete volumes, required parents, and exactly one root, then mount the considered set |
| START-FILE-SYSTEM | Mount, open the root, and garbage-collect dirty packs |
| PRINT-MOUNTED-UNITS | Report current pack and volume state |
| DISMOUNT-UNIT | Select a pack by unit and partition, then normally dismount its whole volume and dependent child volumes; if tentative, only remove it from the tentative set |
| DISMOUNT-VOLUME | Normally dismount every pack in the named volume and its dependent child volumes |
| STOP-FILE-SYSTEM | Close files, flush free state, and mark normally closed packs clean |
| DIKE-OUT-UNIT | Forget one unit in core without writing the pack |
| DIKE-OUT-PACK | Forget one pack in core without writing it |
| CLEAR-FILE-SYSTEM | Discard all in-core file-system pack state |
| PUNT-ALL-LOCKS | Debugging escape that abandons locks; not a routine repair |

The whole-volume behavior keeps the mounted parent/child set consistent; a
request naming one pack can consequently close more storage than its argument
suggests. The clean flag is set dirty on mount and made clean only by orderly
dismount. Mounting a dirty pack triggers garbage collection. DIKE-OUT and
CLEAR-FILE-SYSTEM deliberately avoid disk writes, which can be useful when the
in-core view is suspect, but recent output may be lost and the disk remains
dirty. “No disk write” does not mean “no consequence.”

## Garbage collection

LMFILE garbage collection is an allocation reconstruction pass. It scans the
block-starts-file map, follows each file's block map, and rebuilds knowledge of
used and available records. It recovers records stranded from the in-core free
table after a crash.

Garbage collection does not prove that the directory hierarchy is correct. It
intentionally preserves valid-looking files that no directory points to. That
is why salvage is a separate operation.

## File-system salvage

SALVAGE-FILE-SYSTEM runs while the file system is mounted. It copies relevant
allocation maps, walks the hierarchy, and reports:

- duplicate or invalid directory pointers;
- files whose starter records are invalid;
- records claimed by more than one file;
- records marked free while a file claims them; and
- valid files not reachable from a directory.

Its initial question asks whether to include overlap state retained from a
previous salvage. The maintenance instructions distinguish the passes: answer
No on the first pass, inspect and remove the invalid claimant or pointer, then
rerun with Yes to expose the other member of an overlap.

FIX-FILES-NOT-POINTED-TO handles orphan starters by case:

- a half-dead file has its starter bit cleared automatically;
- a file with a usable redundant pathname can be offered for reinsertion, but
  its directory must already exist; and
- a file whose pathname cannot be determined prompts before its starter bit is
  cleared.

The operator can create a missing directory and rerun the operation. This is
important because clearing the starter bit gives the file's storage back to the
allocator; it is not merely removing a stale display row.

DIKE-OUT-SUBNODE removes a directory pointer, not necessarily the underlying
file. If another valid pointer to the same file must survive, the operator must
decline clearing the starter bit. The distinction between a pointer and the
storage object is central to safe overlap repair.

## What “bad-pack repair” can mean

No source-defined application named BAD-PACK or single bad-pack repair command
was found in either inspected tree. The historically accurate repair map is:

| Observed problem | Relevant layer | Candidate evidence or action | Destructive boundary |
| --- | --- | --- | --- |
| Controller, seek, ECC, or surface failure | controller and medium | checkout diagnostics and error log | diagnostic write tests overwrite blocks |
| Entire medium must be recreated | controller and medium | FORMAT-DISK | erases the selected disk |
| Label unreadable or overwritten | label | preserve raw image; inspect or reconstruct with DLEDIT and plausible-partition scanning | writing a guessed label can hide or overlap payloads |
| Wrong current world or microcode | label | SET-CURRENT-BAND or SET-CURRENT-MICROLOAD after validation | changes subsequent boot selection |
| Suspected partial partition copy | partition | inspect the “Incomplete Copy” comment; compare against a known source | recopy overwrites the target |
| Dirty pack or lost free records after crash | LMFILE allocation | mount through the normal dirty-pack path and garbage-collect | repairs maps; still requires a clone for preservation research |
| Orphan, duplicate pointer, or overlap | LMFILE hierarchy | salvage, inspect, then repair the specific pointer or starter | clearing a starter frees file storage |
| Known suspect records must not be newly allocated | LMFILE allocation | locked-block map | setting the bit requires a diagnosis; the map does not discover surface errors |

This layered account is deliberately less convenient than a fictional one-button
repair tool, but it matches the implementation and prevents a label operation,
hardware checkout, and hierarchy salvage from being mistaken for equivalents.

## Source-only findings and unresolved defects

Several behaviors are visible in source but not in the short operator help:

1. Form redisplays DLEDIT in both inspected command loops even though the local
   Help text omits it.
2. System 46 can exit with an edited in-memory label without warning; System 303
   added explicit modified-state tracking.
3. System 303 reserves a synthetic row after the last partition so normal
   forward motion can reach the append position.
4. A partition copy marks the target “Incomplete Copy” before transferring data
   and restores the normal comment only on completion.
5. The LMFILE manual calls the third map the bad-block map, while source
   implements it as LOCKED-BLOCK and reveals that a locked block can remain in
   an existing file even though it is excluded from future allocation.
6. The System 303 Control-D handler appears to call DESCRIBE-PARTITION with only
   the partition name and therefore lets its unit argument default to local unit
   zero. If DLEDIT is examining a nonzero or remote unit, it may describe the
   same-named partition on unit zero. This is a static code finding, not a
   runtime-confirmed defect.

The last point remains a TODO for a safe multi-unit emulator test. It must not
be tested against the sole copy of a historical disk.

## Runtime and screenshot status

No runtime screenshot is published with this page. DLEDIT is a visible
application, but the current research turn did not have a CADR harness slot
cleared by the root operator, and the editor is adjacent to an explicit physical
label write. Checkout and format are more destructive still.

TODO: create two hash-identified disposable disk clones, boot the documented
System 303 load band in the Xvfb harness, enter DLEDIT on the nonboot clone,
capture the label after a read-only Control-R, exercise navigation and Help, and
exit without Control-W. Record the complete harness provenance and submit only
the minimal screenshot needed for a separate publication-rights review. A
second clone can then test the suspected nonzero-unit Control-D defect without
risk to preservation media.

Until that experiment is complete, command-loop and screen-field claims on this
page are source findings, not runtime observations.

## Preservation practice

For any surviving disk image:

1. hash and retain an immutable original before invoking a Lisp-machine tool;
2. record the raw label block and a decoded printout before editing;
3. work on a disposable clone and keep label, partition, and LMFILE actions in
   separate logs;
4. distinguish current-band selection from the contents of the selected band;
5. treat checkout and format as destructive even when their names sound
   diagnostic;
6. preserve “Incomplete Copy,” dirty-pack, and orphan evidence until the cause
   is understood; and
7. compare the resulting clone block-for-block, not only by whether it boots.

## Sources

- MIT System 46
  [DLEDIT source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/dledit.7),
  [disk library](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/disk.161),
  [disk documentation](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/disk.22),
  [single-drive checkout](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lcadr/d1chk.15), and
  [controller checkout](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmcons/dcheck.81), plus the
  [pack-rebuild procedure](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/cadrdc/format.pack).
- LM-3
  [DLEDIT source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io%2Fdledit.lisp),
  [disk library](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io%2Fdisk.lisp),
  [pack management](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fpack.lisp),
  [free-record management](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Ffree.lisp),
  [garbage collector](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fgc.lisp),
  [salvager](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fsalvag.lisp), and
  [maintenance text](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fmaint.text), with
  [console crash-buffer salvage](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=cc%2Fsalvag.lisp)
  used only to establish the negative boundary.

Last verified: 2026-07-18.
