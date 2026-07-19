---
type: Artifact Analysis
title: Tape systems and the Tape Utility Frame
description: A release-bounded, source- and runtime-grounded dossier on MIT System 46 tape evidence, the restored LMI Tape and TFrame systems in LM-3 System 303, and Symbolics Genera 8.5 tape facilities.
tags: [mit-cadr, lm-3, lmi, genera, tape, tframe, rtape, tar, carry-tape, preservation]
timestamp: 2026-07-18T07:29:39-04:00
---

# Tape systems and the Tape Utility Frame

The three releases inspected here do **not** contain one continuous tape
application. MIT CADR System 46 has no Lisp-machine tape system or Tape Utility
Frame in its public source snapshot. The similarly named files that do occur there
are PDP-10 or hardware material, not an ancestor that can safely be described as
the System 303 application. The maintained LM-3 System 303 tree instead contains a
later LMI “new tape” stack, back-ported from the Lambda to CADR releases and paired
with the mouse-oriented `TFrame`. Symbolics Genera 8.5 has a separate and broader
Tape system: record streams, local and remote devices, Carry and TAR formats,
distribution media, FEP tapes, and a Tape Administration Command Processor area.
It does not contain LMI's `TFrame` in the inspected source.

This matters operationally. A format name such as TAR does not imply that the
releases use the same implementation or support modern `ustar`; a declared tape
device does not imply that the Open Genera VLM has a physical drive; and a
documented application does not imply that it is loaded in a particular world.
The live Genera 8.5 world exposed all 15 Tape Administration commands but did not
recognize `FEP-Tape` as an activity. No media-changing operation was attempted.

## Scope, evidence labels, and rights boundary

The page uses four evidence classes:

- **Source** means behavior visible in the exact source artifact identified below.
- **Manual** means intended behavior stated by contemporary public documentation
  or licensed installed Help.
- **Runtime** means a direct observation in the hash-identified world through this
  repository's Xvfb computer-use harness.
- **Interpretation** is a conclusion drawn from those facts and is kept narrower
  than the evidence.

The MIT System 46 source is public under its accompanying license. The maintained
LM-3 material is also publicly browsable, but it is historically later: its current
read-me describes an LMI-to-GigaMos-to-Bogodyne provenance chain, while an older
copyright file retained in the same directory has a more restrictive LMI notice.
This page records that documentary tension and does not make a new legal conclusion
about it.

The Open Genera world, extracted source, and installed Help are licensed local
artifacts. They remain untracked. This page reproduces no source body or substantial
Help prose; it records short interface labels, factual inventories, checksums, and
original analysis. Raw runtime captures also remain ignored. The screenshot decision
for this study is documented under [Runtime verification and screenshot status](#runtime-verification-and-screenshot-status).

## Release boundary at a glance

| Release | What the inspected artifact establishes | What it does not establish |
| --- | --- | --- |
| MIT CADR System 46, Git `8e978d7d1704096a63edd4386a3b8326a2e584af` | No case-insensitive exact file match for `TAPE`, `TFRAME`, `LMFL`, `TANALYZ`, `TAPETEST`, `TAPE-COMPAT`, `WESPERCO`, `TAPEMASTER`, `VMS-TAPE`, or `RTAPE`; no Lisp-machine tape system definition found | That MIT never used tape in any release, or that unrelated PDP-10 tape utilities are the later LMI stack |
| Maintained LM-3 System 303, Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | Public LMI-derived `TAPE`, `TFRAME`, and `TAPE-COMPAT` sources; CADR device path through `RTAPE`; LMFL, RAW, TANALYZ, and old TAR formats | That this later restored code was part of MIT System 46, or that physical Lambda controllers work in `usim` |
| Symbolics Genera 8.5 world `a8ee5e86…0672` and source subset | Symbolics Tape architecture, Carry/TAR/TAPEX/distribution paths, FEP-Tape declaration and Help, remote-tape protocol, and live Tape Administration command inventory | A local VLM tape drive, a configured remote server, or a runnable `FEP-Tape` frame in this particular world |

## Artifact provenance

### Public MIT and LM-3 material

The System 46 source tree at the pinned Git commit contains 1,895 files totaling
54,459,607 bytes. The exact search was performed on a clean local copy on
2026-07-18. The one substantive magnetic-tape program found by the broader search
was `src/moon/rayth.30`, 15,843 bytes, SHA-256
`55ecb7ec829ef92576595ce78b2fa57411e414294f24ee938352cc88d4c50d91`.
Its accompanying `src/LICENSE` is 1,516 bytes, SHA-256
`05b8de7c86c946cc747ab71a9aaa7dd56e37365278b5585ab685156eaa90fb92`.

The LM-3 checkout was matched through its Fossil database to check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
tagged `system-303`, dated 2025-01-06 15:52 UTC. Fossil reported 4,917 checkout
records and no changed files. The following files are the principal evidence:

| Public LM-3 file | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `tape/-read-me-.text` | 3,477 | `fd60802c8a618a88f33e162aff7c4ab8fd03a9512b48df96489549fcd7c1bbe0` | restoration history, CADR limits, open work |
| `tape/copyright.text` | 499 | `408bdf1ada07aae4315312cb1cec2004ba54ab89450650318be52c79cf7d6c57` | retained older LMI notice |
| `tape/sysdef.lisp` | 3,775 | `01cbbc0b190c7c839d08588903208e212a993ab82d55ca0be0d1cf197786ebc8` | current systems and modules |
| `tape/system.lisp` | 1,280 | `5231927342c6f6f48dc859c996e0d48c3ab2f3f30c5f8ae333a26da0891730c5` | older device-system declarations |
| `tape/tape.lisp` | 35,975 | `4d4ca48137c3cf8bf4170a19003c5fdbedfc686d93c9000e267ecabbbd4cb43f` | device and format protocols |
| `tape/test.lisp` | 6,378 | `5c333d3ba58bb2a8aa3ee63b96d2a411fe3491111f71ff81fbdf2e889270a25e` | destructive device diagnostics loaded by the current system |
| `tape/user.lisp` | 32,713 | `9d9d43a410c3f14b7b0f29485abd4e0d58b0dd8154f8c0ed3fbef052554e0c76` | user-level operations |
| `tape/backup.lisp` | 14,554 | `320912366f0bb33532b6a3fa32b4541d29d4cfaaaf4011f6aa1af919909ffe02` | backup logs and incremental selection |
| `tape/lmfl-format.lisp` | 33,538 | `e1d1f679c5e59d1ea8a31a097d4646aa023d80a2b1d2822db25cf8d64a30a5a0` | LMFL format |
| `tape/raw-format.lisp` | 6,020 | `451c567c9630e7d05b6cb68b669b28fa0bbe739579c357b270c7746c2df36696` | unstructured record stream |
| `tape/tanalyz-format.lisp` | 8,805 | `3b703b13a379198e7c1c8118b875d7a2289a9e034edc130bce48f7d25d3c6711` | record analyzer |
| `tape/tapetest-format.lisp` | 9,050 | `05de96963c7e03bea1876462c5eeb23c6765ee75371cd69a0292618c4f35c3c0` | destructive scratch-tape tester, present but not loaded by current `sysdef.lisp` |
| `tape/tar-format.lisp` | 23,599 | `6a8eb6edcaf393883acf7e623b3c4d778a44777d444ab8a27c7e4eddb1cfcb50` | Version 7-era TAR support |
| `tape/rtape-device.lisp` | 23,463 | `8634df80da2a3d20c528109f3c1b71e7afd22894029564ececbd785418264969` | CADR remote device |
| `tape/remote-tape-device.lisp` | 4,153 | `bac7fa438b091e010ee327c7919e2c60417526bd643dc9216731fe8b665a4379` | disabled/incomplete older remote path |
| `tape/initializations.lisp` | 1,186 | `16d42cf18f1ea2940f4118c3c036879ace8dba090be43e2f5c628534a5a8ec79` | available-device detection and default selection |
| `tape/tframe-macros.lisp` | 5,030 | `949bc75da4d878b08f86ec16f993e749724475da772147da57bc10df20a5c4d7` | frame definition macros |
| `tape/tframe-defs.lisp` | 3,592 | `17825d2207cd94ad561e69f637ebc3faa30acae307dff89cd4f42a2b9c272cf9` | modes, commands, options |
| `tape/tframe-process.lisp` | 10,907 | `8627f79e65cb0355fdd03875a1be86f8f3d979f0b19e867f44abac06006674b2` | process and execution loop |
| `tape/tframe-window.lisp` | 9,486 | `ee1a0dd031ddc271f52c54858c78644beb1d6de5bb0ec8fdd53074edaf61e4b1` | panes, menus, redisplay |
| `tape/tframe-coms.lisp` | 27,296 | `e23999c8467d795294e169ffa64a23433d97cad139abf8e8e5d0bb1c5e0c7504` | command implementations |
| `tape/tframe-cwarns.lisp` | 3,707 | `66590ca4a45878573a35dc68dcc21c7b1395967d454e1c27fcb0dfdada957c59` | saved compiler warnings |
| `tape/newtape.info` | 14,688 | `cea331ada0f17e8aab63ff03329cafd8b558fea9b20a7d2f5925803828f939b1` | self-documentation source |

### Licensed Genera material

The source paths below are archive-relative identifiers, not repository links.
Checksums let another licensed researcher identify the same inputs without
publishing them.

| Licensed source artifact | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `sys.sct/lmtape/tappkg.lisp.~71~` | 5,126 | `f20f487e754f06520a6646400513edb8e8243ac1962f340e8faadb0f49c25ae1` | Tape system declaration |
| `sys.sct/lmtape/tapestr.lisp.~4017~` | 9,603 | `5ad6bd9e18dc3add90685e89a7ff7f64d81d955f32cd7be5dd16eb713d1e9816` | stream protocol and local-drive enumeration |
| `sys.sct/lmtape/record-stream.lisp.~4017~` | 12,555 | `657ec94d40d508caef38c4636aa8cb0eed8dedb13739d66f8b62e7588df958e1` | record-stream layer |
| `sys.sct/lmtape/tape-host.lisp.~4046~` | 34,264 | `ac8cec1ec63a2c60d0280e61dd888b81f9303f8e8539453f7a43a1d94e257daf` | specs and local/remote selection |
| `sys.sct/lmtape/rtape-user.lisp.~4027~` | 35,386 | `9820299e29958a71a0d3bd282aa4ac2e5832f77b11c2cfbc95eaff5035c1f73f` | remote client |
| `sys.sct/lmtape/rtape-server.lisp.~4021~` | 18,723 | `fb7533ce823ce811e407492f78680bcb1f8b06350bfcac7be4b0acc3a98db965` | remote server |
| `sys.sct/embedding/ux/unix-tape.lisp.~18~` | 22,235 | `2036f599c68956181419e4cff74dd7dca6a4f3a67480666533eb515c9745f783` | Unix `rmt` client over `rexec` |
| `sys.sct/lmtape/carry.lisp.~1529~` | 40,903 | `ac83e3d5b2f2d9080cd45f74d8dffba75b6b15ef6e9e19bec5534c43d8263d9f` | Carry format and commands |
| `sys.sct/lmtape/tar-tapes.lisp.~2519~` | 55,290 | `f6dd082f09865f0d9c6a25d6d85f07d11ab62cd5da528d7000ad782ad3f64b62` | TAR format and commands |
| `sys.sct/lmtape/tapex.lisp.~4016~` | 22,017 | `920a0b3e9a22e8db0206cb9fb327a423bdb66f087ca1888db96ed5b3b64c78a3` | TAPEX compatibility |
| `sys.sct/distribution/distribution-commands.lisp.~4024~` | 27,254 | `8d07d4585c5d70023b525eefb9a63bd844065367fd9e6d1f449353e80b94fb3d` | distribution commands |
| `sys.sct/distribution/restore-specifiers.lisp.~4013~` | 22,215 | `0ee388eb032d4acfa83369af2c88c8500c82fad6ddaf8846065423dc9596db05` | restore and content-verification implementation |
| `sys.sct/distribution/restore-frame.lisp.~4029~` | 37,635 | `61848009a9b511055bba7a664163b0a3e23e4cf11896b264c57aead5cbdef437` | Restore Distribution frame |
| `sys.sct/distribution/tape-interface.lisp.~4023~` | 26,792 | `c07d4b80ce6c108fa887856058f4fc2a1980e69b828324294950b06dbc0f34d6` | generic distribution access-path interface |

Three installed-Help source records supplied documentation that is more complete
than the available implementation subset:

| Installed Help record | Bytes | Source SHA-256 | Decoded text SHA-256 |
| --- | ---: | --- | --- |
| `doc/installed-440/tape/tape1.sab.~23~` | 19,807 | `c8ae1022820b42377f272693bc07553cf7bf0a4b02a6669c7d811c0092e0d850` | `eac732c57c57eb7976ce8dde1ee9b994ed130751b62d600415c724bd2c48c89e` |
| `doc/installed-440/tape/tape2.sab.~89~` | 249,366 | `9bc055e332c9364094580727644173c41a8f6083c7efdb062bef49d5005bc863` | `703e865b218e370f106329dd2694f5570b118d850286d0a299481d7369fd30f5` |
| `doc/installed-440/tape/tape4.sab.~49~` | 149,630 | `e98b8f213d9beb6bb92a12206cb18528cfc20b4a75d0a1b0a34c1827511a74b9` | `bdf5c6deec23f071a9b4cfdeb1759ac4143226426bf14f8a4a47b0ca7dd05059` |

The public Genera 8 *Site Operations* scan used for cross-checking is 2,293,893
bytes, SHA-256
`6812c8f6131954751ce8f5ca281a451546d9e61e75b34af106971889a3f384f2`.
Relevant printed pages are 755–781.

## MIT CADR System 46: an absence that defines the boundary

The exact-name inventory found no `TAPE`, `TFRAME`, `LMFL`, `TANALYZ`, `TAPETEST`,
`TAPE-COMPAT`, `WESPERCO`, `TAPEMASTER`, `VMS-TAPE`, or `RTAPE` system matching
the later LMI subsystem. Broad textual searching did find magnetic tape, paper
tape, PROM programming, and hardware references. Those are not interchangeable.

`src/moon/rayth.30`, for example, is a PDP-10 MACRO program identified in its own
header as “ring wraith.” It reads and writes EBCDIC magnetic tapes with 80-column
records grouped into 1,600-byte blocks. Its user command vocabulary is `In`, `Out`,
and `Rewind`. It is not Lisp source, does not define the later tape object protocol,
and has no `TFrame` UI. Treating it as a CADR Tape application would merge two
different machines and software lineages merely because both manipulate tape.

The defensible release-bounded conclusion is therefore narrow: **the public System
46 snapshot inspected here does not contain the later Lisp-machine Tape/TFrame
subsystem**. This is not a claim about every MIT internal tree or later MIT release.

## Maintained LM-3 System 303: architecture and lineage

### What was restored

The current read-me calls this a back-port of the LMI Lambda “new tape” system to
CADR System 100/300 releases. It says the files came through Bogodyne and GigaMos
from LMI, and notes that the code was copied from an LMI `RELEASE-3.TAPE` tree on
1986-10-02. The maintained source expects a release later than System 109 with patch
109.80, except where the CADR port supplies compatibility.

The current system declaration divides the material into three loadable systems:

| System | Contents and purpose |
| --- | --- |
| `TAPE` | generic errors and device/format protocols; backup and user interface; CADR support; Lambda Tapemaster and NUPI sources; LMFL, RAW, TANALYZ, and TAR formats; CADR `RTAPE` client; initialization |
| `TFRAME` | the Tape Utility Frame's macros, definitions, process, window, commands, warnings, and self-documentation |
| `TAPE-COMPAT` | older `MTDEFS`, `MTSTR`, `COPY`, `MTAUX`, `ANSI`, and `TOPS20` compatibility code |

An older `system.lisp` additionally declares old Tape/FDUMP/Copy/PDP-10 material,
`WESPERCO` (`MTRQB`, `WEUNIT`), `TAPEMASTER` (`TMDEFS`, `MTRQB`, `TM`, `TMUNIT`),
and `VMS-TAPE`/`VMST`. These declarations establish historical source organization,
not that each controller is enabled by the maintained CADR configuration.
The checkout also contains `tapetest-format.lisp`, but the current `TAPE` format
module does not name it. Its presence is source history, not a currently loaded
format declaration.

### Layering

The implementation separates interaction, logical tape format, device, and transport:

```text
TFrame or TAPE user functions
        -> basic-tape-format (LMFL / RAW / TANALYZ / TAR)
        -> basic-tape-device
        -> CADR RTAPE client -> Chaos RTAPE service -> physical drive elsewhere
```

The format object controls tape headers, file properties, listing, file navigation,
restore, compare, append, and finalization. The device object controls locking,
status, motion, record transfer, file marks, and optional direct disk operations.
This division is why the same frame can expose format and device choices separately,
and why a format can reject an operation even when the device can move the medium.

### Generic device contract and concrete devices

Every `basic-tape-device` is expected to implement initialization and
deinitialization; lock, unlock, and lock-state testing; option set/reset; status and
speed; rewind and unload; forward and reverse spacing; forward and reverse file-mark
motion; chunk, block, and array I/O; optional direct disk read/write/compare; and
writing a file mark.

| Device path | Source-visible name | Release/device boundary |
| --- | --- | --- |
| Restored Chaos remote tape | `rtape` | The intended CADR path. Options are host, unit, density, and read-only state. The read-me explicitly targets `usim`, which has no emulated tape controller. |
| Lambda Tapemaster | `tr` | Present in the combined source and device registry; not enabled as CADR hardware by the maintained configuration. |
| Lambda NUPI | `nt` | Present in the combined source and device registry; not enabled as CADR hardware by the maintained configuration. |
| Older “remote tape device” | `RM` in its standalone source | Defined in a file that is disabled in the current system declaration and described as nonfunctional by the read-me. Do not confuse it with `RTAPE`. |
| WESPERCO and VMS paths | older system declarations | Historical compatibility declarations, not a demonstrated current System 303 device. |

The original device syntax accepts `Host:DeviceUnit:` or `DeviceUnit:`. The
restoration adds `Host:Device:Unit`. Device selection parses the registered device
name, constructs the matching flavor, then applies options. No default physical
drive can be inferred from a syntactically valid specification.

The `RTAPE` read-only option requests a read-only mount, but its write-block,
write-array, and write-filemark methods only issue a warning before sending the
write opcode. Effective protection therefore depends on the server honoring the
mount mode. A preservation harness must enforce read-only state below this client,
not treat its warning as a write barrier.

### CADR RTAPE protocol

The CADR client opens the Chaos contact name `RTAPE`. It provides record/block
transfer and the following protocol operations:

| Opcode | Operation | Opcode | Operation |
| ---: | --- | ---: | --- |
| 1 | login | 8 | offline/unload |
| 2 | mount | 9 | position by files |
| 3 | probe/status | 10 | position by blocks |
| 4 | read | 11 | unused in this source |
| 5 | write | 12 | write end-of-file mark |
| 6 | rewind | 13 | close |
| 7 | synchronous rewind |  |  |

The restored client fixes the status record's drive-name field at 15 bytes—16 bytes
when the separate one-byte name-length field is counted—where some upstream RTAPE
code used 16 for the name itself. Direct disk read, write, and compare are explicitly
unimplemented and signal errors. Thus `RTAPE` is a remote record device, not a disk
image format or a virtual-machine checkpoint mechanism.

### Format capabilities

| Format | Default and options | Identification | Supported high-level work | Important limits |
| --- | --- | --- | --- | --- |
| `LMFL` | 4,096-byte records; selectable 1,024–65,536 in 1,024-byte steps | `LMFL` header followed by property lists | file and partition write/restore/compare, listing, navigation, append, and multi-reel continuation | Lisp-machine-specific metadata and continuation rules; not TAR |
| `RAW` | 4,096-byte records; selectable 1,024–20,480 in 1,024-byte steps; each opened stream can select 8- or 16-bit and character or noncharacter I/O | no format header | open a raw input or output stream | no file/partition restore, write, compare, listing, navigation, finish, or append protocol |
| `TANALYZ` | analysis blocks up to 32 KiB; `kblocks` 1–32; Brief, Verbose, or Full output | analysis rather than a storage signature | inspect/list physical records and marks | read-only analysis: no restore, write, compare, open-file stream, or append |
| `TAPETEST`, source-only | blocking factor 1–63, default 32; generated zero, one, and `AA`-byte patterns | deliberately never auto-detected | destructive write/read test of scratch media through the compare path | not named by current `sysdef.lisp`; source says it tests tape errors, not hardware; no file restore/write/list/navigation protocol |
| `TAR` | 10,240-byte records by default; record length in 1,024-byte steps; ASCII translation Determine, Always, Query, or Never; default pathname for relative host/directory transforms | old TAR headers | read, write, list, and compare | Version 7-era support; beginning/next/previous/open are marked not implemented, reverse find is unsupported, and append positioning is an empty stub; POSIX TAR remained TODO |

LMFL's write path distinguishes end-of-tape in a header from end-of-tape in file
data, can unload and request the next reel, and carries continuation state. The
restoration read-me specifically reports that Version 7 TAR works; that statement
must not be generalized to modern `ustar`, PAX, GNU extensions, or arbitrary link
semantics.

TANALYZ contains two definitions of its `:previous-file` method. The later one
replaces the earlier definition and differs only in a small sequencing wrapper.
That duplicate is source-visible maintenance evidence, not a documented feature.
For RAW, byte size and character mode are `open-file` arguments rather than persistent
format-menu options; the only RAW format-menu option is record size.

`TAPETEST` is especially dangerous to infer from its friendly format registration.
The file carries a 1988 GigaMos copyright, later than the 1986 LMI frame sources.
Its three-pass routine rewinds, writes a leading-offset zero pattern, overwrites the
medium with one bits, reads and compares, then unloads. It repurposes `compare-file`
so TFrame's Verify path can start the test and signals logical end-of-tape to stop the
generic loop. It is for an expendable scratch tape only. The source even contains a
duplicate unsupported `:write-file` method, another sign that this unconfigured file
should be treated as restoration material rather than a demonstrated production
feature.

### Complete user-level operation surface

The public `user.lisp` exposes the following release-bounded operations. The table
groups them by function but does not omit any entry point found in that interface.

| Group | Operations |
| --- | --- |
| Selection and configuration | `select-device`, `set-device-options`, `select-format`, `set-format-options`, `select-format-from-tape` |
| Mount and motion | `mount-tape`, `rewind`, `unload`, `reset-device`, `device-status`, `beginning-of-file`, `next-file`, `previous-file`, `find-file`, `find-file-reverse`, `position-to-append` |
| Inspection and transfer | `list-files`, `compare-files`, `restore-files`, `write-files`, `open-file`, `write-partition` |
| Completion and packaged workflows | `finish-tape`, `backup-files`, `view-tape`, `install-distribution-tape` |
| Packaged diagnostics | `test-device`, with subordinate single-block, array-transfer, and direct-disk tests in the current system's `test` module |
| Backup-log support | `load-backup-logs`, `compile-backup-logs`, `find-file-backups`, plus source-visible backup-bit and file-list helpers |

An operation's presence in this API does not imply that every format implements it.
For example, `position-to-append` is part of the generic interface while the TAR
method is an empty stub and RAW has no corresponding structured-file operation.

`test-device` is not a safe inspection command. It rewinds and overwrites the
selected tape while testing one-block and array transfers. It then offers a
confirmed direct-disk test that writes 500 blocks from one half of a selected
partition to tape and reads them back over the other half before comparing the two
regions. The CADR `RTAPE` implementation rejects those direct-disk methods, but that
is not a safety mechanism for other devices. The helper named
`fill-string-randomly` actually writes a deterministic index-modulo-123 pattern.
These are source-only diagnostics for disposable media and partitions.

## The LMI Tape Utility Frame (`TFrame`)

### Entry point, layout, and interaction model

`TFrame` registers **System-B** with the label **Tape Utility Frame**. That is its
only application-specific key binding in the inspected source. It can also be
selected from the rightmost-button system menu when the system is loaded. The
interaction pane inherits the ordinary Lisp top-level input editor, but the frame
does not define an editor-like accelerator table of its own.

The title is `LMI Tape Utility Frame (V. <tape-system-version>)`. The frame chooses
landscape or portrait constraints and composes seven named panes:

| Pane | Purpose |
| --- | --- |
| status | current operation/status string |
| mode | mode choices plus Refresh, Restart, and QUIT |
| interaction | typeout and Lisp interaction |
| commands | commands available in the current mode |
| options | global and mode-specific option values |
| format | selected logical tape format |
| device | selected tape device |

The layout choice is not an aspect-ratio test: source selects the landscape
constraint only when the main screen width is exactly 1,024 pixels and selects the
portrait constraint for every other width. Resizing reruns that rule.

The interface is menu-first and depends on mouse-button distinctions:

- clicking a mode changes the command and option menus;
- Left on a command invokes its primary action, Middle invokes the secondary action
  where one exists, and Right asks for that command's documentation;
- Left or Right on an option cycles through or edits values according to its type,
  while Middle asks for option documentation;
- Left on the selected format/device chooses another item, Middle edits that
  object's options, and Right restores the frame's default format or device
  selection; changing the device deinitializes the former device;
- `Refresh` redraws the whole frame;
- `Restart` signals the frame restart, rebuilding commands and resetting options;
  and
- `QUIT` selects the previously selected window. It does not kill the frame and does
  not by itself unlock a tape device.

Killing the frame runs an unlock operation on the selected device. The startup code
can leave the selected device as `NIL` when no registered device is detected, yet
the kill path calls unlock without first testing that value. This is a source-visible
no-device hazard, especially relevant to `usim`.

Two options are global in every mode: **Global numeric argument**, default `1`, and
**Global pathname argument**, default `NIL`. Their effect is command-specific.

### Control mode

Control is the default startup mode.

| Command | Left | Middle or other behavior |
| --- | --- | --- |
| Rewind/Unload | rewind to load point | unload; subsequent operations fail until another tape is loaded |
| Space for Append | position at logical end through the selected format | none |
| Beginning of File | return to the beginning of the current logical file | none |
| Backward Files | move by the positive Global numeric argument | prompt for a positive integer |
| Forward Files | move by the positive Global numeric argument | prompt for a positive integer |
| Reset Device | reset driver and hardware | reset and then rewind |
| Device Status | return the selected device's keyword status list | none |

### Tape Info mode

| Command | Left | Middle or other behavior |
| --- | --- | --- |
| Rewind/Unload | rewind | unload |
| Mount Tape | detect a supported format, print its header when present, and position to the first file | none |
| List Tape | list every logical file and return property lists | none |
| List Some Files | list the Global numeric argument's count | prompt for a positive count |
| Get File Properties | list one file to an internal result and attempt to restore the previous tape position | none |

The “attempt” qualifier on Get File Properties is important: it catches physical
beginning-of-tape conditions around the forward and reverse positioning calls, so a
successful property return is not a general transactional-position guarantee for an
arbitrary device failure.

### Dump mode

| Option | Values and default |
| --- | --- |
| Default Host | host or `NIL`; local host by default |
| Default Disk Unit | number; CADR unit `0` by default |
| Write Subdirectories | Boolean; `T` |
| End of Tape Action | Continue or Error; Continue |
| Verify Files | Boolean; `T` |

| Command | Left | Middle or other behavior |
| --- | --- | --- |
| Rewind/Unload | rewind | unload |
| Write Files | write the Global pathname argument using current recursion and end-of-tape options | none |
| Write Partition | prompt through the partition searcher, using Default Host and Default Disk Unit as its starting location | none |
| Finish Tape | finish according to the selected format | finish and rewind |
| Verify Tape | rewind and compare tape content with the original files or partition data, subject to selected format capability | none |

LMFL can continue onto another reel when **End of Tape Action** is Continue. The
option does not manufacture multi-reel behavior in a format that lacks it.

### Backup mode

| Option | Values and default |
| --- | --- |
| Backup Host | local host; the UI does not offer a supported remote backup-host path |
| Backup Mode | Incremental or Full; Incremental |
| Record Files as Backed Up | Boolean; `T` |
| Verify Files | Boolean; `T` |

| Command | Left | Middle or other behavior |
| --- | --- | --- |
| Rewind/Unload | rewind | unload |
| Verify Tape | compare written content | none |
| Backup Filesystem | back up the whole local file system | use Global pathname argument to select a subtree/filespec |

The backup-log subsystem is what lets Incremental selection reason about prior
backups. “Backup Host” is not evidence that a remote file system is supported here;
the source fixes this option to the local host because the remote path was not
implemented.

### Retrieve mode

| Option | Values and default |
| --- | --- |
| File Match | filespec; `*;*.*#*` |
| Transform | `NIL`, pathname, or function; `NIL` |
| Query | Boolean; `NIL` |
| Overwrite | Never, Always, or Query; Never |
| Create Directory | Always, Query, Never, or Error; Always |
| Verify Files | Boolean; `T` |

| Command | Left | Middle or other behavior |
| --- | --- | --- |
| Rewind/Unload | rewind | unload |
| Verify Tape | compare tape against target files | none |
| Find File | search using File Match | none |
| Restore Files | restore through logical end-of-tape | restore only the positive Global numeric argument's number of files |
| Install Distribution Tape | invoke the distribution-install workflow | available only to a supporting format and media layout |

The transform option is deliberately broad: a pathname can reroot output, and a
function can compute destinations. Its existence is not a promise that author,
creation date, or every source-host pathname property survives every format.

### Backup Logs and Self Documentation modes

Backup Logs shares the local **Backup Host** option and offers:

| Command | Left | Middle |
| --- | --- | --- |
| Load Logs | load the backup logs | none |
| Compile Logs | compile loaded logs | none |
| Find File Backups | use Global pathname argument | prompt for a pathname |

Self Documentation has **Documentation Format**, either Text or BOTEX with Text as
the default, and one command:

| Command | Left | Middle |
| --- | --- | --- |
| Format Documentation | format documentation for Global pathname argument | prompt for a pathname |

The formatter walks mode options and commands, making the frame partly
self-describing. This is generated documentation from registered definitions, not a
record of runtime hardware support.

### TFrame source findings absent from the user story

- The command-definition documentation advertises an `:EXECUTION-CONSTRAINTS`
  facility and a `:TAPE-ALLOCATED` constraint, but the command structure and macro
  expansion contain no corresponding field or enforcement path.
- A macro comment says command strings will gain `[R: Document Command]`; the code
  actually appends `[R: Document self]`. Right still enters the documentation path,
  but the implementation's displayed phrase differs from its own macro commentary.
- `*comment-output*` looks up a `drawing-pane`, which is not among the frame's
  declared panes. The variable is not the documented interaction pane.
- The saved compiler-warning file records likely undefined tape calls and free
  variables, including `*HOST-TO-USE*`. Some warnings can be load/compile-order
  artifacts, so this is evidence of unresolved build hygiene, not proof that every
  warned command fails.
- **Verify Files** is displayed in Dump, Backup, and Retrieve modes and its own
  documentation promises post-write or post-retrieve verification. In the inspected
  commands, however, only the two Backup Filesystem branches read `*verify-files*`
  and pass it as `:compare`; Write Files, Write Partition, and Restore Files do not
  reference the option. The separate Verify Tape command remains available. This is
  a source/documentation discrepancy, not a verified automatic behavior.
- The restoration read-me still lists “Fix TFrame” as open work.
- `QUIT` leaves a live frame, whereas killing it attempts to unlock the selected
  device. These are materially different lifecycle actions.

No maintained System 303 runtime screenshot is published here. The tested public
CADR band used elsewhere in this repository is a System 303 environment, but
`TFrame` needs the later LMI tape code loaded and a viable device selection. A
reproducible runtime test remains blocked on producing a disposable, hash-identified
band with the pinned LMI system loaded plus a controlled `RTAPE` server. The frame's
no-device kill path should be patched or isolated before such a run.

## Symbolics Genera 8.5 Tape system

### System composition and device boundary

Genera's `Tape` system declaration combines several layers:

```text
Tape stream API
  -> local cartridge / industry-compatible drive, or remote-tape client
  -> Carry, TAR, TAPEX, distribution, and FEP-tape consumers
```

The declaration includes remote record streams, a tape-host abstraction, RTAPE
client and server, a Unix-side `rmt` path, Carry, TAR, distribution support, 3600
cartridge and half-inch drivers, and IMACH SCSI/QIC support. `FEP-Tape` is declared
only for 3600 and IMACH machine types. A VLM-specific exclusion in the distribution
mapping is another warning that an Open Genera runtime is not equivalent to every
supported Symbolics machine.

Several declared physical-driver module bodies are absent from the inspected source
subset: the 3600 `ldcw`, `tape-stream`, `cart-tape`, `nbs-cart`, `lstream`, and
`ldebug` files, and the IMACH `scsi-tape` and `QIC-100-stream` files. The declaration
proves system composition; it does not permit a complete controller-level audit.
The remote client/server bodies, generic stream layer, Carry, TAR, and TAPEX bodies
are present.

The IMACH implementation's `local-tape-drives` method returns SCSI drives only for
MacIvory, Merlin, Zora, and Domino machine families; it otherwise returns `NIL`.
The inspected Open Genera VLM therefore has no source-supported local physical tape
drive. A remote namespace entry and reachable RTAPE server would be required for
actual media operations. The isolated harness deliberately provides neither.

Contemporary Site Operations documentation distinguishes Cipher and Archive
cartridge hardware. A 3600 Cipher drive is limited to about 20 MB, while Archive
drives can use a longer tape; the FEP-Tape UI calls the compatibility choice 19 MB
versus 39 MB. The source's QIC constants use 8,192-byte blocks, ten header blocks,
138 safety blocks, and a minimum of 4,810 blocks. DC 300 XL/P cartridges for the
3600 family and DC 2000 cartridges for Ivory systems are documented as mutually
incompatible physical media.

### Tape specifications

A tape specification selects the host, device, unit, and physical parameters. The
manual examples are:

| Example | Meaning |
| --- | --- |
| `Host:` | default drive on Host |
| `Host:0` | unit 0 on Host |
| `:cart` | cartridge drive on the default host |
| `density=1600` | default host/device at 1,600 bpi |
| `:1,density=1600` | unit 1 on the default host at 1,600 bpi |

Commas, colons, and equals signs can be included in values by quoting them. At a
tape-spec prompt, **Control-Meta-Y** yanks the default specification.

The parser recognizes more parameter spellings than the manual's short table:

| Canonical parameter | Source-visible aliases |
| --- | --- |
| Host | Machine |
| Device | Dev, Unit |
| Reel | Volume, Vol |
| Density | Dens, Den |
| Number of Buffers | Buffers, Bufs, Buffs, N-Buffers, N-Bufs, N-Buffs |
| Cartridge maximum bytes to write | Cart-Max-Bytes-To-Write |
| Record Length | Length, Len, Reclen, Recsize |
| Granularity | Gran |
| Minimum Record Length | Minimum, Minimum-Length, Minimum-Record, Minrec, Minreclen |

The manual's use of “Unit” as a synonym for Device and the source's separate legacy
`unit` argument are release-compatibility details, not evidence for two independent
physical selectors in every call.

### `TAPE:MAKE-STREAM`

`TAPE:MAKE-STREAM` is the central programmatic entry point. Its source-visible
surface is broader than the installed Help record:

| Argument group | Values or purpose |
| --- | --- |
| Direction | Input/Read/In, Output/Write/Out, or Bidirectional/Both; Input by default |
| Selection | tape specification, Prompt, host, device, reel, and legacy local/unit arguments |
| Records | record length, minimum record length, granularity, number of buffers |
| Input behavior | `No-Read-Ahead`, `Input-Stream-Mode`, and `No-BOT-Prompt` |
| Completion and output | `No-Rewind`, pad character, and cartridge maximum bytes to write |
| Coordination | lock reason and legacy background option |
| Internal compatibility | buffer size, legacy local, unit, and background arguments |

Installed Help documents host, unit, reel, direction, input-stream-mode, a default
4,096-byte record, density 1,600, pad 0, minimum length 64/Full/`NIL`, granularity,
prompting, No-BOT, No-Rewind, and lock reason. The source additionally exposes
several buffering and compatibility arguments. Their source presence establishes an
entry surface, not that all combinations are meaningful on every device.

Minimum Record Length can be an integer below Record Length, Full, or `NIL`; when it
is omitted, 64 is assumed. Granularity can be an integer or `NIL`, and the documented
Genera applications use four-byte granularity. Supplying Pad Character without an
explicit minimum or granularity requests Full padding for compatibility. Input Stream
Mode defaults to `T`, which hides record boundaries and reports EOF only at file
marks; `NIL` exposes each record end as EOF, after which Discard Current Record moves
on. No-BOT-Prompt suppresses ready/BOT checks, while No-Rewind suppresses the normal
rewind at close. Cartridge devices ignore the industry-tape record-size, density,
padding, and granularity controls where documented.

### Stream messages

In addition to ordinary stream I/O, the implementation documents tape-specific
messages:

| Availability | Messages |
| --- | --- |
| Any tape stream | close, rewind, await-rewind, set-offline, clear-error, skip-file by positive or negative count, host-name, BOT-p, check-ready |
| Input | clear-EOF, discard-current-record, record-status with error indication |
| Output | write-EOF, force-output, write-error-status with error indication |

Reverse file skipping is not supported on cartridge drives. `record-status` and
`write-error-status` expose record-level conditions; they are not filesystem file
status calls.

### Genera RTAPE

Genera supports both RTAPE client and server roles and discovers a server through a
namespace Tape service. The protocol is close to, but not identical with, the CADR
back-port:

| Opcode | Operation | Opcode | Operation |
| ---: | --- | ---: | --- |
| 1 | login | 8 | offline |
| 2 | mount | 9 | skip files |
| 3 | probe | 10 | skip blocks |
| 4 | read | 11 | obsolete/reserved |
| 5 | write | 12 | write EOF mark |
| 6 | rewind | 13 | close |
| 7 | synchronous rewind | 14 | set cartridge maximum bytes |

Responses 33–36 cover login response, data, EOF, and status. The cartridge-size
operation is a concrete protocol difference from the CADR client. The
presence of Unix `rmt` and server source does not establish that either service is
configured in the inspected world.

### Unix `rmt` path

The UX subsystem also registers a distinct `:unix-rexec` tape byte-stream protocol
on TCP port 512. It invokes `/usr/sbin/rmt` on recognized DEC AXP hosts and
`/etc/rmt` elsewhere. This is not RTAPE: it speaks the traditional Unix remote-tape
command stream and derives a Unix device pathname from host type, density, unit, and
No-Rewind state.

| Remote host class | Device-name rule and source-visible limit |
| --- | --- |
| Sun | `/dev/nr<device>`; status queries suppressed because the driver is assumed not to implement them |
| DEC AXP/Alpha | device must begin with `mt`, use unit 0–31, and end in density code `a`, `l`, `m`, or `h`; maps to `/dev/nr<device>`; status queries suppressed |
| Other/VAX-style | trailing unit 0–3; maps to `/dev/r<stem><minor>`, with minor adjusted for No-Rewind and density 800, 1,600, or 6,250 bpi |

The status decoder recognizes these historical device-type codes: `01` TS-11;
`02` TU77-family; `03` TM-11; `04` TU78; `05` Unibus GCR; `06` Multibus CPC;
`07` Multibus Archive; `08` SCSI Archive; `09` Xylogics 472; `0A` SCSI Sysgen;
`0B` SCSI Emulex MT02; `0C` generic SCSI CCS; `10` Sysgen QIC-11; `11` Sysgen
QIC-11/24; `12` default SCSI CCS; `13` SCSI Adaptec; `14` SCSI Emulex MT02;
`15` Archive QIC-150; `16` Wangtek QIC-150; `17` ADSI; `18`–`1F` generic SCSI
CCS; `20` CDC; `21` Fujitsu; `22` Kennedy; `23` HP; `24`–`27` generic SCSI CCS;
`28` Exabyte; and `29`–`2F` generic SCSI CCS. These are remote Unix status codes,
not a list of locally attached Open Genera VLM devices.

The stream explicitly reports that it cannot reverse-skip. No `rmt` connection was
attempted: the museum harness has no external route, and legacy `rexec` requires a
separate security and containment plan before any future synthetic test.

## Genera operator entry points and complete command inventories

### Tape Administration command area

The Command Processor command `Help Commands :Format Detailed :Command Table
Tape Administration` succeeded in the live 8.5 world and displayed exactly these
15 commands, in alphabetical order:

1. Compare TAR File
2. Compare TAR Tape
3. Distribute Systems
4. Read Carry Tape
5. Read TAR File
6. Read TAR Tape
7. Restore Distribution
8. Show Carry Tape
9. Show Distribution Directory
10. Show TAR File
11. Show TAR Tape
12. Verify Distribution
13. Write Carry Tape
14. Write TAR File
15. Write TAR Tape

This is a command-table area, not a `TFrame` equivalent. Commands can be typed to a
Dynamic Lisp Listener or invoked wherever the Command Processor exposes that table.
The inspected source and Help define command argument presentations, but no dedicated
Tape Administration keyboard accelerator map was found. Ordinary Command Processor
completion, editing, Help, and presentation gestures remain inherited facilities.
Where the Command Processor supplies its common output controls, **More Processing**
is Default, Yes, or No and **Output Destination** is Buffer, File, Kill Ring, None,
Printer, Stream, or Window; these are generic wrappers rather than tape-format
options.

### Carry-Tape

Carry-Tape is a system-independent file-transfer format within the supported
Symbolics family, intended for selected files rather than filesystem restoration or
layered system distribution. The source writes a textual version-1 prologue and
property lists into 8,192-byte tape records. File bodies use embedded lengths, a
minimum transfer unit of 256 bytes, and granularity 4. Character data uses the Lisp
Machine character interchange; wider binary data is narrowed only according to the
format's explicit byte-size logic.

| Command | Arguments and options |
| --- | --- |
| Write Carry Tape | pathnames/filespecs; Since date; Author; Tape Spec; Query, default Yes; Verify, default No |
| Read Carry Tape | Tape Spec; If Exists = Error, Skip, or Supersede, default Skip |
| Show Carry Tape | Tape Spec; Verify, default No |

The command wrapper also inherits the Command Processor's standard More Processing
and Output Destination controls where documented. Programmatic entry points are
`tape:carry-dump`, `tape:carry-load`, and `tape:carry-list`, with device, tape host,
density, reel, and report-stream controls.
The programmatic `carry-load` default for If Exists is Error, whereas the Read Carry
Tape command wrapper explicitly defaults it to Skip. Code calling the function and
an operator entering the command therefore do not have the same collision default.

The manual says Carry does not span multiple tapes, and the source begins with
“multiple tape handling” in its unfinished-work list. A write loop does catch
end-of-tape and asks for continuation, but its `n-tapes` counter remains initialized
to one in the inspected path. That combination is evidence of incomplete or
untested continuation code, not grounds to override the supported single-tape limit.

Carry groups files according to each original wildcard/filespec request and can use
those groups during restore queries. The loader copies file content and computes
target names; its documented command does not promise to restore author and creation
date properties. “Verify” means reading content back against source/target data, not
cryptographic signing of the medium.

### TAR tapes and TAR files

Genera can operate either on a physical tape stream or on a TAR byte stream in a
host file. The user-facing command surface is:

| Command | Required arguments and release-bounded options |
| --- | --- |
| Compare TAR Tape | Prefix, default `host:`; Tape Name, default No, to compare the whole tree and report missing/extra files; Verbose, default No |
| Compare TAR File | TAR pathname; Prefix, default `host:`; Tape Name, default No; Verbose, default No. A Compressed argument is under `#+ignore` and therefore not implemented in this command source. |
| Read TAR Tape | destination Root, defaulting from the current pathname history; Mode = Binary, Text, or Query, default Query; Reroot Absolute Pathnames, default No |
| Read TAR File | TAR pathname; destination Root with the same history default; Mode = Binary, Text, Query, or Function, default Query; Reroot Absolute Pathnames, default No; Compressed, default No; Function Name, default `NIL`, when Function mode is selected |
| Write TAR Tape | pathnames; Mode = Binary, Text, Query, or Heuristicate, default Query; Relativize Pathnames, default No; optional Since date |
| Write TAR File | pathnames; TAR pathname; Mode = Binary, Text, Query, or Heuristicate, default Query; Relativize Pathnames, default No; optional Since date |
| Show TAR Tape | no tape-specific command arguments beyond the prompted/default spec |
| Show TAR File | TAR pathname; Compressed, default No |

The implementation is an old Version 7-style TAR, not a modern general archive
engine. It uses 512-byte headers grouped into 20-block records and a 100-character
pathname field. It does not emit a `ustar` prefix, PAX records, GNU long names, or
the metadata range expected from contemporary TAR implementations. On writing it
uses mode 0644 and numeric user/group IDs zero, skips directories and links instead
of encoding them, and writes regular-file content. On reading it ignores hard-link
and symbolic-link entries. Preservation work should therefore retain the original
TAR bytes and use an external modern parser before asking Genera to rewrite them.

`Heuristicate` tries to choose text versus binary from the source file. A source
comment says the inference only works for LMFS because an NFS server reports
misleading information. That caveat is not apparent from the command's menu value.
The lower-level compare functions default to verbose reporting, while both Compare
TAR command wrappers default Verbose to No.

### TAPEX compatibility

`TAPE:TAPEX` is a listener function rather than a Command Processor command. It
asks **Read, Write, or List?**, with single-key choices `R`, `W`, and `L`. Its format
is intentionally narrow:

- 1,600 bpi;
- every physical record is 4,096 bytes;
- a logical file is a pathname header record followed by data records;
- octal `200` terminates the header and data body;
- file marks separate logical files and a double file mark ends the tape; and
- data is non-Lisp-Machine ASCII with CR/LF line endings, tabs and form feeds
  translated explicitly.

The source says it cannot represent non-ASCII extended characters and provides no
binary-file encoding. The reader asks for each target pathname and permits skipping;
the writer repeatedly prompts for source files; the lister prints header pathnames.
The same file contains a separate legacy `READ-LMI-TAPE` path. These are
compatibility tools, not the Carry or TAR formats and not a safe general-purpose
archival representation.

### Distribution media

Distribution tapes package systems and logical-pathname-based software components,
not arbitrary file trees or bootable world images. The complete source-visible
`Distribute Systems` option surface is:

| Option | Values and default |
| --- | --- |
| Systems and Versions | sequence of system/version pairs; an empty/null result selects the menu workflow |
| Source Category | Basic, Optional, Restricted, Optional-Only, Restricted-Only; Basic |
| File Types | Default, Sources, Binaries, Both, Patches-Only; Default |
| Default Version | Released or another version designator; Released |
| Query | Everything, Yes, Confirm-Only, No; Confirm-Only |
| Menu | Boolean; No |
| System Branch | branch selection; `NIL` |
| Flatten Files | Boolean; Yes |
| Compress Files | Boolean; No |
| Include Patches | Yes, No, or Selective; Yes |
| Distribute Patch Sources | Boolean; No |
| Include Components | Boolean; Yes |
| Included Files Checkpoint | patch number, release name, or None; None |
| Use Cached Checkpoint | Boolean; No |
| Use Disk | compatibility presentation accepting Tape, Disk, or Floppy as the machine permits; Tape |
| Tape Spec | parsed tape specification |
| Full Length Tapes | Boolean; Yes in the inspected source default |
| Machine Types | All or selected machine families; All |

The public manual also shows standard Command Processor More Processing and Output
Destination controls. It reports some “mentioned defaults” that differ from the
actual default, so the table above follows the inspected command definition rather
than prose that describes what another command invocation might prefill.

`System Branch` and `Flatten Files` appear only when the Version Control feature is
present. The remaining administration commands have these release-bounded controls:

| Command | Options |
| --- | --- |
| Restore Distribution | Use Disk = Tape, Disk, or Floppy, default Tape; Skip Restoration of Existing Files, default Yes; Menu, default No |
| Show Distribution Directory | Use Disk = Tape, Disk, or Floppy, default Tape |
| Verify Distribution | Use Disk = Tape, Disk, or Floppy, default Tape |

Site Operations says a multi-tape distribution is a set of independently restorable
single tapes whose order the operator must enforce. Its summary table says
distribution tape is not verifiable, while the live 8.5 command table contains
`Verify Distribution`. The inspected implementation resolves the contradiction for
Genera 7-style distributions: it reads the directory, locates each corresponding
filesystem file, decodes recorded attributes, decompresses content when required,
and compares file and distribution streams, including length/EOF mismatches and a
16-to-8-bit path. Missing files and mismatches enter continuable error paths. It does
not compare file properties—the source leaves that as an open question—and it says
verification of pre-Genera-7 distribution tapes is not implemented.

Restoration has a separate machine boundary. A recognized Release 6 distribution
is handed to the old distribution loader on 3600 builds and on non-VLM IMACH
builds, but the VLM branch reports that Release 6 media cannot be reloaded in Open
Genera. This is a source-enforced Open Genera limitation, not a general statement
about every Symbolics machine.

#### Restore Distribution frame

`Restore Distribution :Menu Yes` and `Select Activity Restore Distribution` are
documented entry points. The frame has three command labels:

| Command | Purpose |
| --- | --- |
| Help | explain the frame |
| Initialize Restoration | read the distribution directory and populate the panes |
| Perform Restoration | restore the selected files |

Its visible panes are the command menu, Files to Restore, Actions During Restore,
and Systems to Restore. The complete documented direct gestures are:

| Target | Gesture | Effect |
| --- | --- | --- |
| file row | Left | toggle that file |
| system row | Left | toggle that system and its displayed file set |
| system header in Files pane | Left | select every file in that system |
| system header in Files pane | Middle | deselect every file in that system |
| Systems title line | Left | select all systems |
| Systems title line | Middle | deselect all systems |

The documented frame keys are Help, Refresh, `Control-V` or Scroll for forward
scrolling, `Meta-V` or Meta-Scroll for backward scrolling, `Meta-<`, `Meta->`, and
Space to remove the temporary typeout pane. These are frame/navigation keys; the
destructive action still requires initialization, selection, and Perform Restoration.

### FEP-Tape Activity

FEP-Tape is for cartridge sets containing world-load and, on 3600-family machines,
microcode files. It is not the FEP's Initial File System tape operation: restoring an
IFS tape can recreate the disk's front-end structure and destroy existing disk data.

Installed Help and Site Operations describe `Select Activity FEP-Tape` as opening a
frame with a command menu, file-display pane, and listener prompt `FEP-Tape Command:`.
Commands can be typed at that prompt or clicked in the command pane. The file pane
uses the standard Scroll, Meta-Scroll, `Meta-<`, and `Meta->` navigation gestures;
no FEP-Tape-specific accelerator table is documented in the available material. The
declared commands are:

| Command | Arguments or behavior |
| --- | --- |
| Add File | pathname; kind = Initial Microcode, Other, or Both; optional comment for Other files |
| Add Microcode Files | microcode version; row-major and/or column-major array form; whether to set the initial microcode files |
| Read Script File | read a previously saved file-set description |
| Read Tape | scan a set, prompting for each target pathname or skip; Host and Full Length controls |
| Remove All Files | clear the proposed set |
| Remove File | remove one proposed file |
| Verify Tape | compare a newly written set against disk files |
| Write Script File | save the proposed set |
| Write Tape | Host, default Local; Unit, default Cart; Full Length Tapes selection |

One manual paragraph calls the second command “Add Files for Microcode Version”
while the command table calls it **Add Microcode Files**. The latter is the stable
menu label in the installed Help inventory; the former is preserved as a prose
variant rather than silently normalized.

The default short tape holds no more than 19 MB for Cipher compatibility. Full
Length selects about 39 MB for Archive hardware and must not be used if a reader has
only a Cipher drive. A set can span multiple cartridges. Lisp can use a remote tape
drive, but FEP-level reading requires a local drive. The FEP cannot create target
files; suitable FEP files must already exist before an in-FEP restore. Writing a set
from files on a remote FEP filesystem can bake that remote host name into the FEP
pathname and make the tape site-specific, so the manual recommends local source FEP
files even when the actual drive is remote.

The system declaration names a `fep-tape` source module, but that module is absent
from the licensed source subset inspected here. Installed Help is therefore the
principal detailed evidence for its UI. The runtime world did not recognize the
documented activity, as discussed below; none of these operations was invoked.

## Choosing among the Genera facilities

| Facility | Intended unit | Local drive required? | Multi-volume? | Verification | Read by |
| --- | --- | --- | --- | --- | --- |
| File System Maintenance backup | an LMFS filesystem or selected LMFS hierarchy | No; remote tape supported | Yes | Yes | Lisp |
| Distribution | layered systems defined through logical pathnames | No | Each tape independently restorable; operator controls ordering | Genera 7-style file content and length; not properties or pre-Genera-7 media | Lisp |
| Carry | selected files and filespec groups across hosts | No | Supported documentation says No | Yes | Lisp |
| FEP-Tape | world loads and 3600-family microcode | FEP reading: Yes; Lisp operation: No | Yes | Yes | Lisp and FEP |
| TAR | interchange with old Unix-style TAR layouts | No when remote tape is configured; file form needs no drive | no supported multi-reel claim found | compare commands exist | Lisp and external TAR readers within format limits |
| TAPEX | legacy ASCII logical files | depends on stream selection | no supported continuation claim found | no dedicated verify mode | Lisp compatibility program |

“Remote supported” means the software can select an RTAPE service. It does not mean
the default Open Genera image is configured with one.

## Manual, source, and runtime discrepancies

| Question | Manual or historical statement | Source or runtime evidence | Release-bounded conclusion |
| --- | --- | --- | --- |
| Was TFrame an MIT System 46 application? | Later LM-3 documentation describes a CADR port | System 46 has none of the subsystem's exact files or system declarations; maintained System 303 identifies LMI Lambda ancestry | Do not retroject the LMI application into System 46 |
| Does every TFrame command enforce advertised execution constraints? | Macro documentation names `:EXECUTION-CONSTRAINTS` and `:TAPE-ALLOCATED` | no command field or enforcement expansion exists | Treat this as unimplemented design documentation |
| Does TFrame's Verify Files option govern Dump and Retrieve? | option documentation says written or retrieved files will be verified | only Backup Filesystem reads the option; Dump and Retrieve command bodies do not | Use the explicit Verify Tape command; do not claim automatic verification in those modes |
| Is TFrame finished in the maintained restoration? | `newtape.info` describes a complete-looking UI | read-me still says “Fix TFrame”; saved warnings and no-device lifecycle hazard remain | Source inventory is complete, runtime readiness is not established |
| Can Carry span volumes? | Site Operations says No | source TODO says multiple-tape handling; an end-of-tape loop exists but has suspicious unchanged tape count | Supported answer remains No; continuation requires a focused synthetic-media test |
| Can a distribution be verified? | Site Operations summary table says No | source and live command table contain `Verify Distribution`; implementation compares decoded file content and length | Yes for Genera 7-style distributions, but not properties or pre-Genera-7 media; runtime remains unexercised |
| Are long distribution cartridges the default? | Site Operations describes Full Length Tapes with an actual default of No and a mentioned default of Yes | the inspected 8.5 command definition sets its default to Yes | Treat this default as release/source-version sensitive and specify it explicitly |
| Is `MAKE-STREAM` fully described by installed Help? | Help lists the common selection, record, and motion controls | source exposes additional buffering, cartridge-size, No-Read-Ahead, and legacy compatibility arguments | Help is an operator subset, not the whole programmatic signature |
| Is FEP-Tape available in Genera 8.5? | Site Operations and installed Help document `Select Activity FEP-Tape` | the inspected 8.5 world replied that `FEP-Tape` was not an activity name; its source module is absent from the subset | It is a release facility but not a runnable activity in this world as currently loaded |
| Does Open Genera have a local tape drive? | the general manual describes local 3600 and Ivory devices | IMACH source returns local devices only for named hardware families, not VLM; isolated runtime has no server | No local VLM tape path is established |
| Is Genera TAR a contemporary general TAR implementation? | command names say TAR and offer binary/text modes | old fixed header layout, 100-character names, skipped/ignored links, fixed metadata, no PAX/ustar, and a disabled compressed Compare File argument | Use it only for the documented old format subset and preserve original bytes |
| Does `Heuristicate` work on all Genera filesystems? | command presentation offers it without a filesystem qualifier | source says its inference only works correctly on LMFS and calls out NFS | Do not use it as an automatic preservation classifier on NFS |

## Runtime verification and screenshot status

### What was exercised

The Genera Xvfb harness session was named `d19-tape-20260718`, generation 1. It
booted the licensed 8.5 world at 2026-07-18 06:45:42 EDT and selected the window
`Genera on DIS-LOCAL-HOST`, XID 4194310, 1,200×900 at `(72,55)`. The meaningful
input sequence was:

1. enter `Help Commands`;
2. enter detailed Help requests for the Tape Administration command table;
3. correct the argument ordering and enter `Help Commands :Format Detailed
   :Command Table Tape Administration`, producing the 15-item inventory above;
4. enter `Select Activity FEP-Tape`, which reported that `FEP-Tape` was not an
   activity name;
5. clear the abort state and enter `Start System FEP-Tape`, which reported that
   `Start System` was not a command name.

The last failure does not prove that no Lisp-level system-loading function could
load an FEP-Tape module. It proves only that this attempted Command Processor route
was absent. The experiment stopped there rather than guessing a loader name or
altering the licensed world. It performed no mount, initialization, rewind, erase,
read, write, compare, distribution restore, remote connection, or device probe.

### Reproducible run record

| Input or run component | Identity |
| --- | --- |
| Purchased archive | `opengenera2.tar.bz2`, 206,213,430 bytes, SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base/private world | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Debugger | 346,880 bytes, SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| VLM executable | 1,533,760 bytes, SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Private configuration | SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| X compatibility preload | SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| exact ifconfig interposer | SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7` |
| one-shot RFC 868 responder | SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; one validated request/reply and successful responder exit |
| Python harness at execution | SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a` |
| Action log at stop | 20 intent/outcome records, SHA-256 `4999482ae14a9205d6f2f11c9ec5f8cbef2fa508453c18f92b922ee839d674c8` |
| Guix provenance | channel commit `230aa373f315f247852ee07dff34146e9b480aec`; manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d` |

The VLM ran in separate user, mount, network, PID, IPC, and hostname namespaces. It
had no default route, external route, or host file service; the private runtime was
the only writable host-backed tree; the exact X socket was read-only; MIT-SHM was
disabled and live-verified absent. The runtime reported the required exact X-protocol
substitutions and one-shot time reply rather than arbitrary stream interposition.

Shutdown confirmation was accepted and cleanup progress was observed, but the known
VLM cleanup stall required bounded `SIGKILL`. The launcher returned 137;
`forced_after_confirmed_shutdown_stall`, `forced_stop`, and
`state_may_be_incomplete` are true, while `orderly_vlm_host_shutdown` is false. The
base and private world hashes remained unchanged. The harness did not invoke Save
World or create a host process checkpoint; `save_world_performed` and
`guest_checkpoint_created` remain unknown because the harness cannot prove guest
state from intent alone. The session left no resumable host checkpoint and discarded
unsaved Lisp state.

### Why no screenshot is published

Three raw 1,200×900 captures remain in the ignored session, identified here only for
research reproducibility:

| Raw capture | PNG SHA-256 | Pixel SHA-256 | What it shows |
| --- | --- | --- | --- |
| `0008-tape-administration-detailed-correct.png` | `06f64f759fbd44bd9ef12871e24c7dfcb5617fc2612b1d6005e0db6c6c859eaf` | `445effd7fa5cbb25b995a537806a7aa5d72492ba42919d0914cde25a07eb5c7b` | full Help-generated 15-command list |
| `0009-fep-tape-frame.png` | `9fef96cbe0df96cfdb2b417cced7e4b23f39cf8c473b48179c5a76a766b02751` | `38016ee9489d3b626063240aeca8ff01ef840f2d1491cb425d175a49f5a7c516` | the activity-name failure, despite the exploratory filename |
| `0010-start-fep-tape-result.png` | `009fc60518c67107ba57eb9019007d15802d815d052920e99ad3d260c013b1e2` | `9bd8624f58c13fecedc3d056164de717da2614ffdfdaa69b2be39eb5abc149db` | the absent Command Processor loader route |

None is published. The first is essentially a full licensed Help listing; the
factual command inventory above establishes the same research point with less
copyrighted screen content. The other two show listener errors, not the FEP-Tape
application's visible behavior. They therefore fail the repository's
minimum-necessary-evidence criterion for this article even though a limited runtime
screenshot can in principle be published on a documented fair-use basis.

**Screenshot TODO:** reach `FEP-Tape` or another genuinely visible tape frame in a
fresh, hash-identified world without operating media; capture only the empty initial
frame and a non-destructive menu state; then perform an image-specific four-factor
review under [the screenshot publication policy](screenshot-publication-rights-review.md).
For public LM-3 `TFrame`, first prepare a disposable System 303 band with the pinned
source and a controlled no-data `RTAPE` endpoint. Until then, the absent screenshot
is an explicit runtime blocker, not a gap filled from the manual illustration.

## Preservation and emulation implications

- Record the software release, physical-device family, logical format, record size,
  density, cartridge length, volume/reel identity, and remote server implementation
  separately. “Tape” alone is not enough provenance.
- Preserve raw record boundaries and file marks as well as logical file bytes. LMFL,
  TAPEX, TAR, and Carry assign different meaning to those boundaries.
- Do not convert an old TAR by round-tripping it through Genera before retaining the
  original. Long names, links, ownership, modes, and extension records can be lost or
  ignored.
- Treat RTAPE as an I/O protocol to a stateful device, not as a world image, archive
  container, or VLOD-like VM snapshot. A network capture alone may omit medium state
  and operator actions.
- Keep media writes disabled during discovery. Synthetic blank-media servers and
  copied tape images should be hash-identified and disposable before testing rewind,
  file marks, end-of-tape, continuation, or failure recovery.
- Do not use an FEP-Tape/IFS restore experiment on a disk containing preservation
  data. IFS restoration is explicitly destructive, and FEP-Tape expects precreated
  targets when run at the FEP.
- Preserve the System 46 absence and LMI restoration provenance in catalogs. Naming
  System 303's Tape Utility Frame simply “the CADR tape program” erases its later
  LMI history.
- For licensed Genera artifacts, track extraction/audit code and evidence-only
  metadata, not recovered source, Help payloads, world data, or raw captures.

## Open questions and bounded follow-up work

- **TODO — LM-3 runtime:** build a disposable System 303 band containing the pinned
  `TAPE` and `TFRAME` sources; provide a synthetic, no-private-data Chaos `RTAPE`
  service; verify startup, no-device behavior, every mode transition, option gesture,
  lifecycle unlock, and format rejection paths through the CADR harness.
- **TODO — TFrame build health:** determine which saved compiler warnings reproduce
  under the pinned maintained build and which are only compile-order residue. Test the
  missing `drawing-pane`, no-device kill, and advertised execution constraint paths.
- **TODO — format vectors:** construct freely redistributable synthetic LMFL, RAW,
  TANALYZ, Version 7 TAR, Carry, and TAPEX fixtures. Analyze `TAPETEST` only against
  an explicitly disposable virtual scratch medium. Record file marks and record
  boundaries, then cross-check round trips without using proprietary payloads.
- **TODO — Carry continuation:** force end-of-tape on synthetic media and establish
  whether the dormant continuation loop can complete a second reel despite the
  manual's supported single-volume statement and the unchanged counter.
- **TODO — Verify Distribution runtime:** use a synthetic disk-image distribution to
  confirm the source-audited content, decompression, length, missing-file, and
  mismatch paths without touching physical media; verify that properties remain
  outside the comparison as the source comment indicates.
- **TODO — FEP-Tape source and runtime:** inventory another licensed release for the
  declared but absent `fep-tape` module; determine the system-loading route and
  machine-type gate for the inspected world without forcing arbitrary loads.
- **TODO — Genera local-device stubs:** document how the VLM reports no local tape
  drive at the namespace and stream layers and whether a controlled RTAPE server is
  sufficient for all non-FEP tools.
- **TODO — screenshots:** publish only a minimal initial application frame after the
  runtime blockers above are resolved and the specific image passes rights review.

## Sources

- MIT CADR System 46, [public source tree at commit
  `8e978d7d`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src), including
  [`moon/rayth.30`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/rayth.30)
  and the [source license](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE).
- LM-3 maintained System repository, [System 303 check-in
  `4df393c6`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  including the pinned
  [tape read-me](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2F-read-me-.text),
  [retained copyright file](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Fcopyright.text),
  [system declaration](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Fsysdef.lisp),
  [generic protocol](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftape.lisp),
  [user API](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Fuser.lisp),
  [device diagnostics](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftest.lisp),
  [RTAPE device](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Frtape-device.lisp),
  [LMFL](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Flmfl-format.lisp),
  [RAW](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Fraw-format.lisp),
  [TANALYZ](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftanalyz-format.lisp),
  [TAPETEST](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftapetest-format.lisp),
  [TAR](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftar-format.lisp),
  [TFrame commands](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftframe-coms.lisp),
  and [TFrame window](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=tape%2Ftframe-window.lisp).
- Symbolics, [*Site Operations*, Genera
  8](https://bitsavers.org/pdf/symbolics/software/genera_8/Site_Operations.pdf),
  “Using the Tape Facilities,” printed pages 755–781.
- Licensed Genera 8.5 source, installed Help, and world artifacts identified by
  portable filename, size, and SHA-256 above, inspected locally without publishing
  their payloads.
- [Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md)
  and [Publishing runtime screenshots for museum
  documentation](screenshot-publication-rights-review.md), for the runtime and image
  evidence rules applied here.

Last verified: 2026-07-18.
