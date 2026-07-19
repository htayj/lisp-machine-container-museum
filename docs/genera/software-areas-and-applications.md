---
type: Artifact Analysis
title: Software areas, applications, and programs in the inspected Genera 8.5 environment
description: Evidence-bounded catalog of interactive programs, command areas, release systems, optional products, services, and demonstrations present in the inspected Open Genera media and world.
tags: [genera, open-genera, applications, software-catalog, preservation]
timestamp: 2026-07-19T12:23:53-04:00
---

# Software areas, applications, and programs in the inspected Genera 8.5 environment

Genera is not organized around one authoritative “applications folder.” Its software
appears through several overlapping registries: activities selected by name or key,
the System Menu, Command Processor command tables, release systems, loadable products,
program-framework definitions, and demonstrations. The most complete honest catalog
therefore keeps those layers separate.

For the inspected Open Genera 2.0 distribution and Genera 8.5 world, this audit found:

- 40 command-area names visibly reported by the running Command Processor;
- 11 program choices visibly present in the running System Menu;
- 19 names in the live activity table, 12 bindings in the live Select-key table,
  and ten entries in the default window-type menu, including its generic `Any` item;
- 98 systems for which the live System Construction Tool returned a non-null loaded
  version: 26 numeric versions and 72 `:NEWEST` states;
- 25 distinct activity names in the union of the installed Select Key Selector help
  and the public Genera handbook;
- 35 entries in the Genera 8.5 release-system declaration, of which 26 apply to the
  VLM build, five are excluded by `#-VLM`, and four are reader-disabled by
  `#+ignore`;
- 81 exact `site/*.system` identifiers and 114 exact `.system-dir` identifiers. The
  two sets overlap, so their union is 133 identifiers, not 195 products;
- 28 named loadable-system records in the installed documentation;
- 51 literal Dynamic Windows program-framework forms in 44 source files: 49 name
  concrete programs and two are program-generating templates;
- 18 named `site/*.demo` demonstrations; and
- 26 literal CLIM `define-application-frame` forms in 25 source files.

These are complete counts for those particular on-media enumerations, not a claim
that every named system is loaded, configured, licensed as a separate product, or
runnable on the VLM. Conversely, compiled world-resident programs can exist without a
corresponding source file in the distributed source subset.

## Evidence states

The tables use the following evidence vocabulary.

| State | What it establishes | What it does not establish |
| --- | --- | --- |
| Runtime opened | The program or surface was exercised in the inspected world through the Xvfb harness. | Every feature works, or behavior is the same in another world. |
| Runtime listed | The running world visibly offered the name in a menu or Help result. | Selecting it succeeds, its dependencies are installed, or it is configured. |
| Installed help | The local Document Examiner corpus names and describes the facility. | Its implementation is loaded or its hardware exists. |
| Release declaration | Genera 8.5's source identifies a release system and reader conditions. | A live query proved that system loaded in this world. |
| System/media | A site system file, system-directory file, source module, or compiled module is present. | It is a distinct end-user application or is usable on Open Genera. |
| Optional/contributed | Distribution metadata or directory placement presents the item as loadable, layered, or contributed. | It is part of the base world. |
| Documentation only | Documentation is present, but this audit found no matching source or system declaration. | The product is absent from all possible licensed media. |

## Inspected artifacts

All local items in this table came from licensed media and remain untracked. Only
names, counts, hashes, and original analysis are published.

| Portable artifact | Bytes | SHA-256 | Use |
| --- | ---: | --- | --- |
| `opengenera2.tar.bz2` | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` | Licensed release archive from which the inspected private runtime and source tree were freshly prepared |
| Extracted `sys.sct` tree | 174,490,231 across 5,075 files | Anchored by the archive identity above; no separate tree digest was recorded | Complete licensed media tree used for the source, system, demonstration, and documentation censuses |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` | Genera 8.5 release-system roster and VLM conditionals |
| `sys.sct/doc/installed-440/user/select-select-help.sab.~14~` | 27,570 | `5926571afb220b08a7dbf7583a37695dfbc77044b0d41a42fee66308f7b3cd19` | 23 installed activity records among 31 Select Key Selector records |
| `sys.sct/doc/installed-440/sig/genera-loadable-systems.sab.~12~` | 45,698 | `c90741ad4d2ba9b23c8868f63164276c2d9aa995d82b52388d256bedfd0d487a` | 28 named loadable-system records plus headings and delivery-world guidance |
| `sys.sct/window/activities.lisp.~35~` | 22,385 | `8965c6ae99c41efbab9cf10896d0bca253f99dd7a85ad76c30b3e86b7df91089` | activity, Select-key, and System Menu registration mechanics |
| `sys.sct/dynamic-windows/define-program-framework.lisp.~332~` | 132,692 | `e4fde854b9a36492bf4d23eec0a812bd36c7d42e7d32c649c7aaa5786cd30128` | Dynamic Windows program construction and automatic activity registration |

The ignored help catalog covers all 801 Sage Binary files found in the media and all
17,266 decoded records. Its SAB-source manifest is
`ca5678d3e1ffc8650e28836d4a2daf4cea1a48ee594dcf406485d92717281b70`.
The [help-recovery article](online-help-and-documentation-recovery.md) records the
selection rule and rights boundary. The [computer-use article](genera-computer-use-harness.md)
records the world, VLM, harness, action, and screenshot provenance used for runtime
observations.

For evacuated `site/*.system`, `site/*.demo`, and `.system-dir` files, the audit
grouped by logical pathname and selected the greatest numeric `~N~` version. The
Dynamic Windows and CLIM definition scans used binary-safe, case-insensitive
`rg -a -i`; every logical Lisp pathname contributing one of those definitions had only one
evacuated version in this tree. Textual hits were then inspected in context before a
name was classified as a concrete program, generated template, or reusable support.

## Runtime-visible command areas

The running Dynamic Lisp Listener responded to `Help Commands` with these 40 command
tables. They are areas of the interactive command language, not 40 separate GUI
applications.

| Broad area | Exact runtime-reported command tables |
| --- | --- |
| Interaction and session | `Activities`, `Evaluation Context`, `Global`, `Lisp`, `Process`, `Session`, `Utilities`, `Window` |
| Programming and diagnosis | `Breakpoint`, `Callers`, `CLOS`, `Debugging`, `Editing`, `Flavors`, `Garbage Collection`, `Inspection`, `Presentation`, `Programming Tools`, `Tracing` |
| Files and documents | `Directory`, `Document Formatting`, `Documentation`, `File`, `File System`, `Fonts`, `Spelling` |
| Communication and services | `Communication`, `Conversation`, `Mail Reading/Sending`, `Mailer`, `Namespace`, `Networks`, `NFS`, `Printer`, `Printer Maintenance`, `Tape Administration` |
| Operations | `Demonstration`, `Site Administration`, `System Maintenance`, `World Building` |

This is a runtime-opened observation from ignored session `museum-final-current`,
generation 1, on 2026-07-18. The same screen says that the world is not configured
for its local site and that servers are disabled, so the command names are not proof
of operational network services.

The [formatting, spelling, and text-production dossier](../formatting-spelling-and-text-production-utilities.md)
audits the three document-oriented command areas and their underlying `FORMAT`,
`FQUERY`, grinder, Zmacs, Sage, font, and spelling layers. The [Dynamic Windows
dossier](../dynamic-windows-and-presentation-based-interaction.md) separately audits
the `Presentation` area and the presentation/command substrate shared by these tables.

## Live activity and selection registries

A later fresh harness session evaluated the registries themselves rather than
inferring them from manuals or source. Ignored session `software-catalog-20260718`,
generation 1, returned these exact results:

| Registry | Count | Exact live values |
| --- | ---: | --- |
| `cli::*activity-table*` | 19 | `Converse`; `Distribute Systems`; `Document Examiner`; `Editor`; `File Server`; `Flavor Examiner`; `Frame-Up`; `Inspector`; `Keyboard Control`; `Lisp`; `Mail`; `Namespace Editor`; `Notifications`; `Peek`; `Restore Distribution`; `Select Key Selector`; `Terminal`; `Zmacs`; `Zmail` |
| `cli::*select-key-table*` | 12 | `=` → `Select Key Selector`; `C` → `Converse`; `D` → `Document Examiner`; `E` → `Editor`; `I` → `Inspector`; `L` → `Lisp`; `M` → `Zmail`; `N` → `Notifications`; `P` → `Peek`; `Q` → `Frame-Up`; `T` → `Terminal`; `X` → `Flavor Examiner` |
| `tv:*system-menu-programs-column*` | 11 | `Distribute Systems`; `Document Examiner`; `Editor`; `Emergency Break`; `Frame-Up`; `Hardcopy`; `Inspect`; `Lisp`; `Namespace Editor`; `Trace`; `Zmail` |
| `tv:default-window-types-item-list` | 10 | `Terminal`; `Lisp`; `Peek`; `Inspect`; `Edit`; `Frame-Up`; `Distribute Systems`; `Document Examiner`; `Namespace Editor`; `Any` |

`Any` is a generic window-type choice, not an application. Likewise, `Inspect` and
`Edit` are exact menu labels while the activity names are `Inspector` and `Editor`.
The four registries describe related but non-identical interaction surfaces.

The local 1,200 by 900 evidence captures are not embedded because they have not yet
received capture-specific rights review:

| Capture | Observation | Captured/action-log prefix | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | --- | --- | --- | --- |
| `0006-select-table-evaluated.png` | 12 live Select-key bindings | `03:11:11-04:00`; 10 records, `419c8dbdd17b8a4f36ce314ef0550a1c6e5192a739efbdf6ced7388fd56b881b` | `690500997a6d10e274e24807541b9c79c4ba7e67470b977ff1b09776251cf34f` | `80da125aa759836e1af8a4e265b3890bd1933b17a6f1b8da081dee97c7965de3` |
| `0007-activity-table-evaluated.png` | 19 live activity names | `03:12:28-04:00`; 12 records, `ea2d77dee63c426dae1ba6e68e963b6b09acd1cf692c52fc5c9fe9d5c61cbe3f` | `42b477239a1b5d224935e216f23a768da295ee19dc16c138b0a20db2f3c1698f` | `49c302c96553aa81ea08276dc220fa42b9e1c7411ace79014d226357d8bb047d` |
| `0008-menu-tables-evaluated.png` | System Menu and default-window-type lists | `03:13:09-04:00`; 14 records, `9e28af32ccecfee54a276e3e47016064e9dec4697f45d3a7e73f473e8a8f5ce1` | `7aa62faf010dbb14f4d6f5992f48ac902888c012667431df61f75d977fd8f765` | `d1943e5a362317e1521190f2549be4fe388001b9a7a5c2a7b254dcf0c0c0ad5f` |

The session loaded `Genera-8-5.vlod` (54,804,480 bytes, SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`),
and the base world remained unchanged. Shutdown confirmation and cleanup progress
were observed, followed by the already documented VLM host-shutdown deadlock and
bounded forced cleanup (`forced_after_confirmed_shutdown_stall: true`, harness exit
2). No host processes remained. The unsaved session Lisp state was discarded; this
does not imply a Save World or checkpoint.

These evaluations expose two important documentation discrepancies. The public
User's Guide assigns `F` to File System Maintenance, but this live Select-key table
does not. The handbook lists FEP-Tape and File System Maintenance as selectable
activities, but neither occurs in the live activity table. Conversely, File Server
and Namespace Editor are live activities even though the installed selector-help
database has no activity record for either.

The loaded-system roster also contains four deceptively adjacent names whose roles
are now source-audited in
[Compiled objects, QFASL, relocation, and UNFASL](../compiled-objects-qfasl-relocation-and-unfasl.md):
`L-BIN` is the compiled-file loader/dumper system; `BIN` is a separate string/object
serialization facility; `KBIN` is Zmail store persistence; and
`C+LISP-SUPPORT` names embedding/RPC octet-structure support. Loaded-system
membership does not establish a common file-format lineage.

## Live loaded-system roster

A second fresh, read-only session closed the largest remaining static-versus-world
gap. It iterated `sct::*all-systems*`, retained entries for which
`sct:system-version-loaded` returned non-null, and sorted their system names. The
inspected base world returned exactly 98 names. A separate query found 26 numeric
loaded-version values and 72 `:NEWEST` values; neither query returned
`:INCOMPLETE`.

The complete alphabetical name result is:

```text
APPROACHABILITY
BIN
BITBLT
BUS-ACCESS
C+LISP-SUPPORT
CHAOS
CL-DEVELOPER
CLOS
CLX
COMMON-LISP
COMPRESSION
CONVERSE
CP
DEBUGGER
DEVELOPMENT-COMMANDS
DEVELOPMENT-DEBUGGER
DEVELOPMENT-UTILITIES
DISTRIBUTION
DOC
DYNAMIC-INDEX
DYNAMIC-WINDOW-CLIENTS
DYNAMIC-WINDOWS
ECO-SUPPORT
EMBEDDING
EMBEDDING-SUPPORT
ENCRYPTION
ERROR-SYSTEM
EXTENDED-HELP
FEP-FS
FILE-SYSTEM
FILESYSTEM-SERVER
FLAVOR
FLAVOR-EXAMINER
FONT-SUPPORT
FONTS
GARBAGE-COLLECTOR
GPRINT
HARDCOPY
I-ARCHITECTURE
I-LINKER
I-LISP-COMPILER
INSTALLATION-TOOLS
IP-TCP
IP-TCP-APPLICATIONS
IP-TCP-DOC
IVORY-COLOR-SUPPORT-PARTS
KBIN
KEYBOARD
L-BIN
LANGUAGE-TOOLS
LGP2-METRICS
LISP+C-SYNTAX
LISP-COMPILER
LMFS-DEFSTORAGE
LOGICAL-PATHNAMES-TRANSLATION-FILES
MACIVORY-D&E
MATH
METER
MONOCHROME-SYNC-PROGRAMS
NAMESPACE-EDITOR
NETBOOT
NETBOOT-SERVER
NETBOOT-STUBS
NETWORK
NETWORK-APPLICATIONS
NFS-CLIENT
NFS-DOCUMENTATION
NSAGE
OLD-TV
PRESENTATION-SUBSTRATE
PRESS
REMOTE-PROGRAM
REMOTE-TAPE
RPC
RPC-DEVELOPMENT
SCHEDULER
SCT
SERVER-UTILITIES
SPELL
SRCCOM
SYSTEM
SYSTEM-COMMANDS
SYSTEM-INTERNALS
TABLES
TAPE
TCP
TCP-SERVICE-PATHS
TIME
TV
TV-APPLICATIONS
UTILITIES
UX-DEVELOPMENT
UX-SUPPORT
WHO-CALLS
X-DOCUMENTATION
X-REMOTE-SCREEN
ZMAIL
ZWEI
```

This is a loaded-system roster, not an application list. It includes low-level
substrates such as `BITBLT`, `TABLES`, and `TCP`, and one product can span many
systems. It also resolves apparent static contradictions without erasing them: for
example, `LMFS-DEFSTORAGE` is loaded even though the 8.5 release declaration excludes
the distinct top-level `LMFS` release system on VLM.

The evidence came from ignored session `software-catalog-loaded-20260718`, generation
1. Its two local 1,200 by 900 captures remain unembedded pending capture-specific
rights review:

| Capture | Observation | Captured/action-log prefix | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | --- | --- | --- | --- |
| `0001-loaded-systems.png` | Exact 98-name sorted result | `03:18:49-04:00`; 2 records, `452e084a8ab5d063423c8407e1ceedaccc5a96b8600396b2ea8c1bb3d308be46` | `2c9f91b8b7c386fc47dad96e987930f9d4af2b9d892469c055313a424a4296d7` | `ab79c6ee39e98aa4d9385a014ee6656992629afb2c805619d9f77bfcddf1db33` |
| `0002-loaded-system-version-states.png` | 98 total, 26 numeric and 72 `:NEWEST` version states | `03:19:29-04:00`; 4 records, `06f5e6cfc7650756f1f8270cea39870595c2bf3ef6631c1d15f94ade870580ab` | `9802266ad3f35d1d5b9289fab82bf732d4b5f69a3cdb3af4a06d425a484ab387` | `1ce827cecd6ee6d320ff47dccd3dbf0a7cb9a662c06afb4c2cbb213820f0c9cf` |

The action log has four intent/outcome records and SHA-256
`06f5e6cfc7650756f1f8270cea39870595c2bf3ef6631c1d15f94ade870580ab`.
The same 54,804,480-byte base world identified above remained unchanged. Shutdown
again reached confirmation and cleanup progress before the known host-shutdown
deadlock required bounded forced cleanup
(`forced_after_confirmed_shutdown_stall: true`, `forced_stop: true`); no processes
remained.

## Runtime-observation provenance

The three runtime evidence sets used by this catalog are fresh generation-1 sessions.
Their final `run.json` and immutable `runs/generation-0001.json` records are
byte-identical within each session. All paths and payloads remain in ignored private
session trees; the following is the portable, non-secret record needed to reproduce
and interpret the observations.

### Shared execution envelope

All three sessions used the same freshly prepared inputs and harness build:

| Field | Portable record |
| --- | --- |
| Licensed release input | `opengenera2.tar.bz2`, 206,213,430 bytes, SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`. Each private copy matched the base at start and stop, did not change during the run, and the base remained unchanged. |
| Debugger and VLM | `VLM_debugger`, 346,880 bytes, start SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`; `genera`, 1,533,760 bytes, start and execution SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`. The run schema has no separate debugger execution/stop digest. |
| Configuration and compatibility binaries | `.VLM`, 285 bytes, start and execution SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086`; `ifconfig-bypass.so`, 15,248 bytes, start and execution SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`, source SHA-256 `a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7`; `x-compat.so`, 21,280 bytes, start and execution SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`, source SHA-256 `4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392`. |
| Time responder | `rfc868-time-server.py`, 10,032 bytes, source/start/execution SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`. Each supervised responder became ready, emitted one private raw-Ethernet RFC 868 reply, and exited 0; per-run evidence hashes appear below. |
| Harness sources | Shell entry point `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05`; Python harness `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; network-namespace helper `17a3e297930eef45a6f59a349f92ec1f6dc99b2c4d5caa2392dc0521636af01c`; VLM helper `cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8`. |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d` at Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; Guix 1.5.0; Python 3.11.14; Xorg/Xvfb 21.1.21; Bubblewrap 0.11.0; GCC 15.2.0; glibc 2.41; ImageMagick 6.9.13-5; xdotool 3.20211022.1. The recorded Guix provenance error is null. |
| Process/filesystem isolation | Mode `bubblewrap-filesystem-process-and-network-sandbox`: separate user, mount, network, PID, IPC, and UTS namespaces; scrubbed environment; hidden host root; read-only Guix store, helpers, and exact private X socket; only the private runtime writable. The record explicitly makes no kernel-security-boundary claim. |
| Network isolation | Mode `bubblewrap-unprivileged-user-and-network-namespace`; private `tun0` has host `10.0.0.1/24` and guest `10.0.0.2/24`; dummy `eth0` is `192.0.2.1/24`. There is no default or external route and no guest-visible host file service. |
| Display and X compatibility | Each private X server was 1,440 by 1,100 at depth 24. The selected main window was `Genera on DIS-LOCAL-HOST`, kind `main`, XID 4194310 within its private server, at `(72,55)` with 1,200 by 900 client pixels. MIT-SHM was disabled and live-verified absent; Mod2 was prepared with `Left`; the 140-byte relay replacement name, SHA-256 `a6c472743dd40ae103e78134fc6c6deffb36feec674ea26c65212b4d69f1ae36`, was verified absent. Compatibility mode was `typed-xlib-hooks-plus-exact-guest-x-relay-transform`, and both pinned guest-relay substitutions were observed before `running`; nonmatching writes were delegated byte-for-byte. |
| Persistence boundary | The harness did not invoke Save World and did not create a host process checkpoint. `save_world_performed` and `guest_checkpoint_created` remain null/unknown; an unchanged private world is not generalized into a claim about every possible guest save path. |

### Session records and termination

Times are 2026-07-18 in America/New_York.

| Session | Run interval and role | Final action log | RFC 868 evidence/completion SHA-256 |
| --- | --- | --- | --- |
| `museum-final-current` | `00:00:45`–`00:01:48`; startup header, `Help Commands`, and visible System Menu | 10 records, `b07da8a7a314f702fa763513d9e501b87cb23cc1b7e89b3150d0cb0ba3f17a25` | `bcac4ffb9a93f0c76d55213bdccb7bd533c5e4c94adac5878f5c120be6279663` / `6088dd439c0fcfd1d25b960f647f6f7e625d98656fe6a067590cb36ba8515276` |
| `software-catalog-20260718` | `03:07:08`–`03:15:10`; activity, Select-key, Programs, and Create registries | 14 records, `9e28af32ccecfee54a276e3e47016064e9dec4697f45d3a7e73f473e8a8f5ce1` | `4102853b7d821edf026ed54ee004f57779be685d02c7c6a4905a008a4525039b` / `3a2576fc2b92f475f2d58f572b815b50625dc291e9c246f642d4fe37a2a0c283` |
| `software-catalog-loaded-20260718` | `03:17:55`–`03:21:23`; loaded-system names and version-state classes | 4 records, `06f5e6cfc7650756f1f8270cea39870595c2bf3ef6631c1d15f94ade870580ab` | `c9bf26230aa242a0a630e78435566c36a2353337e5bdc3b10f467b5a86005463` / `3a049246af8b5f1a0f57c411688eb3fd66b41da261c214dc47cb54ff946f52dc` |

All three shutdown records have the same outcome: prompt observed, `yes` sent,
confirmation accepted, and cleanup progress observed, followed by the documented
confirmed cleanup stall. The harness then forced the VLM (`launcher` status 137),
while Xvfb exited 0. Each final status is `forced-stopped`,
`forced_after_confirmed_shutdown_stall: true`, `forced_stop: true`,
`orderly_vlm_host_shutdown: false`, and `state_may_be_incomplete: true`; the record
marks unsaved Lisp state discarded and reports no remaining processes. This is not an
orderly shutdown and does not establish an in-guest save or checkpoint.

### Ordered input actions

Every recorded intent below has a linked `succeeded` outcome with no dispatch error.
That proves XTEST delivery, not semantic guest acceptance by itself; the resulting
exact-window captures establish the displayed results.

- `museum-final-current`: type `Help Commands` and Return; hold `Shift_L`; click
  Mouse-3 at `(810,360)`; move to `(810,360)`; release `Shift_L`. The initial,
  Help-commands, and System Menu captures occurred respectively before input, after
  the typed command, and after the Shift/Mouse-3 click.

- `software-catalog-20260718`: send `[F1,F5]`, then `[F1,Help]`, then `[Help]`;
  send `Delete`; evaluate, in order:

  ```lisp
  (let ((l nil))
    (maphash #'(lambda (k v) (push (list k v) l)) cli::*select-key-table*)
    (sort l #'char< :key #'car))
  ```

  ```lisp
  (let ((l nil))
    (maphash #'(lambda (k v) (declare (ignore v)) (push k l))
             cli::*activity-table*)
    (sort l #'string-lessp))
  ```

  ```lisp
  (list :programs (mapcar #'car tv:*system-menu-programs-column*)
        :create (mapcar #'car tv:default-window-types-item-list))
  ```

- `software-catalog-loaded-20260718`: evaluate, in order:

  ```lisp
  (let ((l (loop for s in sct::*all-systems*
                 when (sct:system-version-loaded s)
                   collect (string (sct:system-name s)))))
    (list (length l) (sort l #'string-lessp)))
  ```

  ```lisp
  (let ((v (loop for s in sct::*all-systems*
                 for x = (sct:system-version-loaded s)
                 when x collect x)))
    (list :total (length v)
          :numbered (count-if #'numberp v)
          :other (remove-duplicates (remove-if #'numberp v))))
  ```

The five exploratory Select/Help captures preceding the three registry evaluations
remain with the ignored action ledger but are not used to support catalog claims.
The three `museum-final-current` claim-bearing captures are:

| Capture | Observation | Captured/action-log prefix | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | --- | --- | --- | --- |
| `0001-initial-listener.png` | Startup header and unconfigured-site notice | `00:00:57-04:00`; 0 records, `4912214614f7a38bcc05d15a27d3b89cc25257dc38ddce97cdf2c850cbd99c15` | `491367d073809a339ae8450224a15f01f3086782dfe1b3007f91d3277a63dcd7` | `aad5aaa101a62abbe824c04f148fe7ceb0d6918d61472b20803def984751f5c3` |
| `0002-help-commands.png` | Exact 40 command-area names | `00:01:01-04:00`; 2 records, `39434212d6616d2be84676e87e38a851ac87506e9a1c6fde8283f6f1e177242c` | `2327e65c17f25f66200608654ca5be9f5b3c4fd6883f4fa0c5507f0563a11820` | `37f6bbbea04625966db36cec23a3e10d042d15bff12a206cb053c3095f59d4bb` |
| `0003-system-menu.png` | Visible Programs column | `00:01:12-04:00`; 6 records, `a17ca48c013ce9f1d4661a6f933efd4a3e95ae33a574ce1331c0393aa3af96f2` | `4bc60e8a4fa530c479f53db0a334c2c65c8239a0cce4d193a036f07d2a4504ce` | `40255bfabd1f8c1932459c422e90d08a7e802eb1418a3c9a08dd8a606569c2e4` |

These captures and the registry/loaded-system captures listed in their respective
sections are all 1,200 by 900. Their sidecars provide execution identities and
isolation records but not final shutdown state; the record above joins those sidecars
to the immutable generation result. None has received image-specific publication
review for this catalog, so no raw image is embedded or tracked.

## Runtime System Menu

Session `software-catalog-20260718`, generation 1, read these 11 exact values from
`tv:*system-menu-programs-column*`. The visible Programs column in the System Menu
was independently captured in session `museum-final-current`. Only Lisp and
Editor/Zmacs were separately opened in the recorded research sessions; the remaining
rows are **runtime listed**, not launch-tested.

| Exact menu label | Area and purpose | Cross-check |
| --- | --- | --- |
| Distribute Systems | Build a distributable set of systems or world material. | Installed activity help and source define full and small distribution frames. |
| [Document Examiner](../help-self-documentation-and-document-examiner.md) | Browse the installed hypertext documentation corpus. | Installed activity help, Standard/Small source frames, complete command audit, and fresh reviewed runtime frame. |
| Editor | Select the Zmacs file/program editor. | Runtime-opened Zmacs study and source registration aliasing `Editor` and `Zmacs`. |
| [Emergency Break](../emergency-break-and-cold-load-stream.md) | Enter an emergency error-recovery path. | Source/manual study complete; runtime exercise remains intentionally deferred because it disrupts the session. |
| [Frame-Up](../screen-editor-and-frame-up.md#frame-up-designing-a-program-frame) | Design Dynamic Windows program-frame pane layouts and generate a framework definition. | Source/manual/control audit plus a fresh two-pane runtime exercise. |
| [Hardcopy](../hardcopy-press-printing-and-plot-output.md#genera-hardcopy) | Reach the typed file-output form backed by the format/device registry. | Base-release `Hardcopy` system, installed documentation, exact source census, and fresh read-only form/registry verification. |
| [Inspect](inspector-and-peek.md#inspector) | Inspect Lisp objects interactively. | Installed source/help plus a fresh synthetic-object runtime study. |
| [Lisp](dynamic-lisp-listener.md) | Select a Dynamic Lisp Listener. | Runtime opened and studied against source, Help, and manuals. |
| [Namespace Editor](namespace-administration-and-editor.md) | Edit seven source-defined object classes in the Genera namespace database; the linked dossier inventories all 13 menu commands and complete key/gesture behavior. | Public handbook, source-defined program, reviewed empty-frame runtime; absent from the 23 installed selector-help activity records. |
| [Trace](../trace-stepper-breakpoints-and-call-analysis.md) | Reach tracing facilities. | Runtime menu, complete `Tracing` command-table audit, and controlled project-function runtime exercise. |
| [Zmail](zmail.md) | Read, organize, compose, and send mail. | Installed activity, extensive source/help, complete command inventory, and fresh empty-mailbox runtime evidence. |

The raw `museum-final-current` System Menu capture remains local and unreviewed. A
later independent session supplied the one sparse menu image selected for the
[activities and System Menu study](activities-and-system-menu.md) under the
repository's capture-specific publication policy.

## Selectable activities

An *activity* is a selectable working context. It can wrap a Dynamic Windows program,
a window flavor, or a choice made at selection time. It therefore should not be
equated mechanically with either a process or an executable file.

The installed Select Key Selector database has 23 activity records. The public
Genera handbook's Select Activity table has 21 names. Their intersection has 19 and
their union has 25:

| Activity | Purpose | Live table | Installed 8.5 selector help | Public handbook | Source/media observation |
| --- | --- | :---: | :---: | :---: | --- |
| [Converse](../converse-direct-messages-and-notifications.md) | Real-time person-to-person text conversation and notifications. | yes | yes | yes | Zwei-derived frame, complete controls, and fresh empty-state runtime evidence; peer delivery remains blocked. |
| Distribute Systems | Distribution-building UI. | yes | yes | yes | Full and small program frames present. |
| [Document Examiner](../help-self-documentation-and-document-examiner.md) | On-line documentation browser. | yes | yes | yes | Standard and Small frames; size chosen at selection time; live Standard frame and search verified. |
| Editor | Zmacs under the ordinary user-facing name. | yes | yes | yes | Same Zmacs frame is registered with both names. |
| [FED](../fed-and-font-editor-generations.md#what-happened-to-legacy-fed-in-genera) | Separately named legacy font editor. | no | yes | no | Installed Help and selector naming establish the program name, but no matching legacy implementation was found in the inspected distributed source; behavior and relationship to Font Editor remain `TODO`. |
| [FEP-Tape](../tape-systems-and-tape-utility-frame.md#fep-tape-activity) | Tape operations mediated by the front-end processor. | no | yes | yes | Nine documented commands are inventoried; a fresh VLM selection attempt established that the activity is not loaded in this exact world, without touching media. |
| [File Server](../file-systems-and-file-service.md#the-genera-file-server-program) | File-server status/operations program. | yes | no | yes | Six-pane `file-server-program` and its three private commands are audited; direct Select-key registration is commented out in the inspected source. |
| [File System Maintenance](fsedit-and-file-system-maintenance.md) | Hierarchical file-system operations, also documented as FSEdit. | no | yes | yes | Complete installed-Help control and four-level maintenance audit; distributed source subset does not expose the main program framework. |
| [Flavor Examiner](../flavors-clos-and-flavor-examiner.md) | Browse Flavors, methods, and related definitions. | yes | yes | yes | `examiner` program frame and Zmacs integration present; complete command and fixed-menu audit linked. |
| [Font Editor](../fed-and-font-editor-generations.md#genera-85-font-editor) | Newer bitmap-based font editing program. | no | yes | no | Selectable `font-editor` program inherits the Bitmap Editor's raster commands and adds font/glyph operations; it was not loaded in the fresh base world. |
| [Frame-Up](../screen-editor-and-frame-up.md#frame-up-designing-a-program-frame) | Interactive Dynamic Windows layout designer. | yes | yes | yes | `layout-designer` program frame; runtime split and `Done` path verified. |
| [Inspector](inspector-and-peek.md#inspector) | General Lisp object inspector. | yes | yes | yes | Inspector source and Select registration present; runtime exercised with a synthetic object. |
| Keyboard Control | Configure supported host/embedded keyboard behavior. | yes | yes | yes | Source-defined program-choice activity; host-specific usefulness not tested. |
| [Lisp](dynamic-lisp-listener.md) | Dynamic Lisp Listener. | yes | yes | yes | Runtime opened; source, manual, Help, and controls audited. |
| [Mail](zmail.md) | Mail-composition/reading entry point. | yes | yes | yes | Zmail registers `Mail` as an additional activity name; Zwei also has a distinct Mail editing mode, both separately audited. |
| [Metering Interface](../metering-and-performance-analysis.md) | Configure and inspect performance measurements. | no | yes | no | Source-defined `metering-interface` program, absent from this live activity table; optional loading is blocked by the unconfigured site's file service. |
| [Namespace Editor](namespace-administration-and-editor.md) | Edit namespace objects and attributes. | yes | no | yes | Source-defined program, runtime System Menu entry, and reviewed nonmutating empty-frame capture. |
| [Notifications](../converse-direct-messages-and-notifications.md#the-genera-notifications-activity) | Review asynchronous notifications and progress messages. | yes | yes | yes | Source-defined frame plus fresh synthetic-record history observation. |
| [Peek](inspector-and-peek.md#peek) | Inspect processes, windows, files, networks, and other live system state. | yes | yes | yes | Source/help audited and multiple live modes exercised in the isolated world. |
| [Presentation Inspector](presentation-inspector.md) | Diagnose Dynamic Windows presentations and handlers. | no | yes | no | Source-defined context-invoked program, absent from this live activity table; complete commands, gestures, analysis categories, and implementation behavior are audited separately. |
| Restore Distribution | Restore material created by distribution facilities. | yes | yes | yes | Source-defined restore frame. |
| Select Key Selector | View and edit Select-key assignments. | yes | yes | yes | Source-defined program frame and activity-table machinery. |
| [Terminal](../network-terminal-applications.md) | Network remote-login terminal. | yes | yes | yes | Telnet/NVT source explicitly registers the official activity name `Terminal`; the linked dossier audits all commands, controls, protocols, and simulators. |
| Zmacs | File and program editor under its product name. | yes | yes | yes | Runtime opened; same frame as `Editor`. |
| [Zmail](zmail.md) | Mail reader and composer. | yes | yes | yes | Source/help/commands audited and reader plus Text Mail boundary exercised live. |

The differences are useful evidence, not errors to smooth over. The installed 8.5
selector documentation adds FED, Font Editor, Metering Interface, and Presentation
Inspector to the handbook's set, while the handbook adds File Server and Namespace
Editor to the installed-help set. The live registry selects a third boundary: it
contains the latter two but not the installed-only four, FEP-Tape, or File System
Maintenance. Source inspection explains at least part of the divergence: Namespace
Editor is a defined program, and File Server's direct Select-key registration is
commented out even though another initialization path installed its live activity.

## Other interactive programs and specialized editors

The following named tools are present in source or installed help but are not all
independent Select activities.

| Program or surface | Role | Evidence and boundary |
| --- | --- | --- |
| [Command Processor](dynamic-lisp-listener.md#command-processor-modes-and-dispatch) | Typed, presentation-aware command environment used by Listeners and many applications. | Runtime-opened command Help; source and installed manual. |
| [Input Editor](dynamic-lisp-listener.md#complete-configured-base-input-editor-bindings) | Editable command/form input on interactive streams. | Core source/help; distinct from Zwei even though integrations exist. |
| Zmacs / Zwei | General file/program editor and its reusable editing substrate. | Runtime opened, source audited, documented separately in [Zmacs](zmacs.md). |
| [Dired](../directory-difference-and-buffer-editors.md) | Directory editor built on Zwei. | Source, installed help, and complete specialized command audit; not a separate Zmacs version. |
| [Edit Buffers](../directory-difference-and-buffer-editors.md) | Read-only action editor for buffer operations inside Zmacs; distinct from the presentation-backed List Buffers report. | Complete source commands audited; the existing runtime capture is List Buffers, so true Edit Buffers remains a runtime screenshot TODO. |
| Teach Zmacs | Interactive editor tutorial assembled from a command and tutorial buffers. | Source consumer and local-only extracted text verified. |
| [Mail mode](zmail.md#zwei-mail-mode-in-zmacs) | Zwei-based message-composition mode. | Source and complete bindings audited; distinct blank composition surface verified live. |
| [Zmail](zmail.md) | Zwei-family mail application with message, summary, filter, collection, and composition surfaces. | Activity, source/help/commands, and reviewed empty-reader runtime evidence. |
| [Converse](../converse-direct-messages-and-notifications.md) | Zwei-family interactive conversation application. | Activity/source/help/controls plus reviewed blank-buffer runtime evidence. |
| [Debugger / Display Debugger](debugger-and-display-debugger.md) | Condition handling, stack navigation, restarts, breakpoints, source access, and a multi-pane graphical debugger. | Complete source/manual control audit plus fresh ordinary and pane-oriented runtime states; Display Debugger is context-invoked, not a selectable activity. |
| [Inspector](inspector-and-peek.md#inspector) | General object examination and interaction. | Activity/source/help/runtime; documented separately. |
| [Flavor Examiner](../flavors-clos-and-flavor-examiner.md) | Flavors, methods, and generic-function analysis. | Activity/source/help plus complete command, interface, and implementation audit. |
| [Peek](inspector-and-peek.md#peek) | Live system-state browser with multiple modes. | Activity/source/help/runtime; documented separately. |
| [Frame-Up](../screen-editor-and-frame-up.md#frame-up-designing-a-program-frame) | Program-frame layout designer. | Activity/source/help plus runtime verification. |
| [Presentation Inspector](presentation-inspector.md) | Presentation hierarchy, context, translator, and handler diagnosis. | Context-invoked source/help program; complete audit plus live hierarchy, handler, lifecycle, and reviewed-screen evidence. |
| [Metering Interface](../metering-and-performance-analysis.md) | Interactive performance-measurement control and results. | Layered source/manual audit complete; absent from the live activity table and blocked on optional-system loading in this unconfigured site. |
| [Bitmap Editor](../bitmap-stipple-and-raster-paint-editors.md#genera-bitmap-editor) | Shared raster-plane editor substrate plus a standalone form, with drawing, selection, transforms, registers, image I/O, and inherited presentation gestures. | Complete source/control/format audit plus 143-record Help database; fresh editor-frame runtime remains pending. |
| [Font Editor](../fed-and-font-editor-generations.md#genera-85-font-editor) | Bitmap-derived character and font editor with inherited raster operations, character/font metrics, live update, and file conversion. | Full distributed source, installed manual, complete command/gesture audit, and an unloaded-world runtime boundary. |
| [FED](../fed-and-font-editor-generations.md#what-happened-to-legacy-fed-in-genera) | Separately named older font editor retained alongside Font Editor. | Installed Help/selector evidence only in the inspected distribution; implementation and behavior remain unknown. |
| [Stipple Editor](../bitmap-stipple-and-raster-paint-editors.md#genera-stipple-editor) | Bitmap-derived editor for tiled stipple patterns, live-object creation, and source-form export. | Complete inherited/specialized command audit and installed Help; source identifies commands inherited despite the missing register pane. |
| [Graphic Editor](../genera-graphic-editor-and-structured-drawing.md) | Structured object drawing editor with 16 entity types, 13 transforms, presentation-bearing graphics, files, generated code, images, hardcopy, and undo. | Complete 63-command source surface, 61-topic help reconciliation, public manual, and fresh optional-system load-state probe; editor frame remained unavailable. |
| [Color Editor and Color Palette](../color-systems-and-color-editor.md) | Edit live colors through multiple three-slider models; select, interpolate, organize, and serialize palette libraries. | Complete menus, gestures, models, configuration, indexed/direct behavior, and IBIN palette semantics audited; the disconnected base world had no Color screen or resident entry point. |
| [Images, drawing primitives, and FrameThrower](../images-drawing-and-visual-asset-substrates.md) | Layered image object model, dynamic file-format registry, native image/dump persistence, BITBLT and Dynamic Windows drawing, compression, screen transfer, and XL400/XL1200 framebuffer/video support. | Complete source/manual/API/UI and installed-asset audit; fresh world had only Compression loaded, with image and FrameThrower systems absent and hardware unavailable. |
| [Document Examiner](../help-self-documentation-and-document-examiner.md) | Standard/small hypertext manual browser. | Source, installed corpus, System Menu/activity records, complete controls, and fresh runtime. |
| [Help Program / Help frame](../help-self-documentation-and-document-examiner.md) | Program-, command-, option-, symbol-, and debugger-help display machinery. | Core source and complete surface audit; a reusable framework rather than one ordinary application. |
| [Concordia](../concordia-document-and-book-design.md) | Integrated NSage-backed structured-document authoring environment with 74 application-specific commands, record/field editing, linking, indexing, graphics, locking, source comparison, and Scribe conversion. | Complete source/manual/help and format audit; fresh world retained the NSage package but no Concordia program or Writer Tools command table. |
| [Page Previewer](../concordia-document-and-book-design.md#page-previewer-and-formatter-workflow) | Concordia formatter and formatted-page preview configuration with 26 commands for layout, navigation, options, tags/indexes, hardcopy, Help, and printer queues. | Source/manual surface complete; it is a configuration inside Concordia, not an independent activity, and was absent from the base world. |
| [Book Design Browser](../concordia-document-and-book-design.md#book-design-browser-interface-and-commands) | Inspect and edit inherited Lisp book-design elements, devices, environments, and dependencies through 11 application commands. | Source/manual surface complete; optional program was not resident in the fresh world. |
| Statice Browser | Interactive browser for Statice persistent data. | Optional layered program source; system-menu registration exists in that product's source. |
| [Mailer Operations / Mailer Log](../background-services-and-operations-dashboards.md#mailer-operations--store-and-forward-mailer) | Operate and inspect the background mail-delivery service. | Six panes, 15 direct VLM commands, six private tasks, one direct CP command, optional system, and installed Help. |
| [Print Spooler Log](../background-services-and-operations-dashboards.md#printer-spooler-log) | Inspect print-spooler activity. | Three panes, two direct commands, six manager states, three Printer Maintenance commands, and optional system evidence. |
| [Domain Server Log](../background-services-and-operations-dashboards.md#domain-server-log) | Inspect the domain-name server. | Four panes, four commands, four launch tags, source-defined Select registration, and optional system record. |
| [File Server program](../background-services-and-operations-dashboards.md#file-server-program) | Inspect or operate the Genera file server. | Complete six-pane/three-command source audit; handbook-listed activity; direct Select registration commented out; configured-service runtime remains blocked. |
| Distribution / Restore | Build and restore software distributions. | Source programs and Select/System Menu exposure. |
| [FSEdit](fsedit-and-file-system-maintenance.md) | Hierarchical file-system maintenance interface. | Installed help/activity, 20 object commands, direct gestures, and 33 maintenance-menu labels audited; main implementation source remains unavailable. |
| [Namespace Editor](namespace-administration-and-editor.md) | Edit namespace database objects and administer site context. | Source program, handbook activity, runtime System Menu, complete command/field audit, and reviewed empty frame. |
| Keyboard Control | Host/embedding keyboard configuration UI. | Source program-choice activity; hardware applicability untested. |
| [Notifications](../converse-direct-messages-and-notifications.md#the-genera-notifications-activity) | Dedicated notification history/activity. | Source/help/controls plus live retained synthetic record. |

[Dynamic Windows](../dynamic-windows-and-presentation-based-interaction.md) also
defines internal or reusable programs such as Accept Values, Help, Menu Program,
Reorder Sequence, Alter Sequences, and Undo Program. Their program-framework status
does not make each one a separately advertised application; the linked dossier gives
their exact architecture and complete directly interactive controls.

### Source program-framework census

For a static implementation cross-check, the source tree contains 51 literal
`define-program-framework` forms in 44 files. Forty-nine forms name a concrete
program; the other two generate a caller-supplied program name in the Macintosh
remote-program support and Frame-Up layout code.

| Class | Count | Exact concrete program symbols |
| --- | ---: | --- |
| System, development, document, and service programs | 35 | `examiner`; `stipple-editor`; `font-editor`; `bitmap-editor`; `standalone-bitmap-editor`; `restore`; `distribution`; `small-distribution`; `page-previewer`; `select-key-selector`; `book-design-browser`; `Concordia`; `notifications`; `undo-program`; `help`; `file-server-program`; `graphic-editor`; `display-debugger`; `keyboard-control`; `choose-topics-to-remove-program`; `reorder-sequence`; `alter-sequences`; `menu-program`; `presentation-inspector`; `accept-values`; `layout-designer`; `help-program`; `doc-ex`; `small-doc-ex`; `mailer-log-program`; `print-spooler-log-program`; `metering-interface`; `Statice-Browser`; `namespace-editor`; `domain-server-log-program` |
| Examples | 14 | `widgetsim`; `n-queens`; `jericho-demo-suite`; `blocks-demo`; `modelling-tutor`; `ht-demo`; `cryptarithmetic`; `DIAL-DEMO`; `employee-editor`; `avv-pane-test`; `accept-two`; `calculator`; `life`; `books` |

This table is complete for literal program-framework definitions in the inspected
`.lisp` files, excluding fake SCT test-case systems. It is not a claim that all 49
programs are advertised, loaded, or independently selectable: for example, Document
Examiner has two size-dependent frames, Distribution has two layouts, and several
frameworks explicitly specify `:selectable nil`.

## Languages and development products

| Area or product | Components visible in the inspected media | Status |
| --- | --- | --- |
| [Ivory, FEP, and Open Genera VLM implementation layers](../ivory-fep-and-open-genera-vlm-implementation-layers.md) | `I-ARCHITECTURE`, `I-LISP-COMPILER`, `I-LINKER`, FEP filesystem and command layers, IFEP/VLM Debugger, Life Support, netboot stubs, bus access, keyboard, embedding, compression, and encryption. | Complete architecture/control/safety/provenance dossier with a verified VLM pause path; safe Cold Load debugger selection remains harness-blocked. |
| [Common Lisp and ZetaLisp compatibility](../lisp-runtime-compiler-and-development-environment.md) | Common Lisp implementation, compiler, evaluator, packages, conditions, sequences, [numeric tower and matrix facilities](../mathematical-and-numeric-facilities.md), compatibility layers, and Lisp Listener. | Base world/source/help; controlled language-context, compiler, and numeric runtime studies. |
| [CLOS and Flavors](../flavors-clos-and-flavor-examiner.md) | CLOS object system and MOP-related code; older Flavors system and Flavor Examiner. | CLOS is in the 8.5 VLM release roster; source/help present for both object systems; the linked dossier keeps their command families and semantics distinct. |
| [Common Lisp Developer](../lisp-runtime-compiler-and-development-environment.md) | Compiler/development integration and program-development utilities, separately versioned from the base Common Lisp system. | VLM-applicable release system; release/source boundary audited. |
| [Symbolics C](../symbolics-c-fortran-and-pascal-environments.md#symbolics-c) | Development, package, run-time, library headers, syntax-aware Zmacs modes, C Listener/commands, debugger, program/call-tree execution, Lisp interoperability, and documentation. | Five site systems and complete recovered language-specific command/manual audit; fresh world had no `C-SYSTEM` package, so visible and effective loaded tables remain runtime-blocked. |
| [Symbolics FORTRAN](../symbolics-c-fortran-and-pascal-environments.md#symbolics-fortran) | Development, package, run-time, statement-field/continuation-aware Zmacs mode, compile/run/system commands, debugger, numeric/character spaces, Lisp calls, and documentation. | Four site systems and complete recovered language-specific command/manual audit; fresh world had no `F77` package. |
| [Symbolics Pascal](../symbolics-c-fortran-and-pascal-environments.md#pascal-tool-kit) | Development, package, run-time, syntax templates/completion, units and programs, execution options, debugger, Lisp interoperability, and documentation. | Four site systems and complete recovered language-specific command/manual audit; fresh world had no `PASCAL` package. |
| [Compiler Tools System](../compiler-tools-grammar-lexer-and-syntax-editor.md) | Package, run-time, development, and debugger support shared by foreign-language products: IR, control/data flow, allocation, source locations, include caching, stack accounting, and hybrid debugging. | Four site aliases target four `cts-*` system directories; complete media graph and compiled-object census; fresh world returned NIL for every system and the `CTS` package. |
| [Grammar, lexer, and syntax tools](../compiler-tools-grammar-lexer-and-syntax-editor.md) | Context-free grammar package, LALR(1), LL(1), lexer package/run-time, minimal lexer run-time, and syntax-editor run-time/support, including incremental Zmacs token/parse/section structures and the complete common command surface. | Layered source/system media and public C/Pascal manuals audited; all nine named systems and `GRAMMAR`/`LEXER` packages were absent from the fresh base world. |
| [System Construction Tool](../system-construction-patches-worlds-and-distribution.md) | `defsystem`, compilation/loading plans, journals, patches, worlds, delivery worlds, distributions, restoration, and system inspection commands. | Core source and System Maintenance/World Building command areas; complete stated-grain lifecycle audit. |
| [Version Control, Compare/Merge, and SRCCOM](../source-comparison-compare-merge-and-version-control.md) | Resident source comparison plus separately delivered versioned-file, editor-integration, comparison/merge, and design-documentation systems. | SRCCOM is present in the base world; the 8.5 release declaration reader-disables the four adjacent Compare/Merge and Version Control systems with `#+ignore`. |
| [Conversion Tools](../conversion-tools-and-source-migration.md) | ZetaLisp syntax/radix/package/function/structure conversion; Flavors-to-CLOS; Symbolics Common Lisp portability and Common Lisp Developer cleanup; Dynamic-Windows-to-CLIM; CLIM 1.1-to-2.0; custom conversion-set support. | Version 436 source and VLM binaries are present. A fresh world retained only the unloaded package shell: no loaded system, registry, or representative Zmacs commands. |
| [CLIM 2](../clim-2-on-genera.md) | Portable Common Lisp Interface Manager, Silica, Genera/CLX/PostScript ports, docs, demos, and tutorial. | 125 compiled core/port modules plus declarations and patch metadata; core implementation source is absent beside those binaries; fresh world has no CLIM system, package, or feature. |
| [Dynamic Windows](../dynamic-windows-and-presentation-based-interaction.md) | Genera's native presentation-based UI, program frames, command tables, panes, graphics, redisplay, and input contexts. | Core source/world substrate rather than a separately named site system; complete substrate and bundled-program dossier linked. |
| [CLX and X facilities](../clx-remote-x-screens-and-x-server-facilities.md) | CLX, remote X screens, X documentation, a CLIM CLX port, and the historically separate X11 Server product. | Complete direct-command, key-map, resource/default, XDMCP, 15-family CLX, and five-control server audit linked. CLX, X-Remote-Screen, and X-Documentation are in the VLM roster; the non-embedded X-Server is absent from the inspected media. |
| [Joshua and Jericho](../joshua-rule-and-inference-environment.md) | Predicate Protocol of Inference, discrimination network/unification, forward RETE and backward rules, questions, trivial TMS/LTMS, object facility, tracing, metering, Zmacs mode, documentation, tests, and demonstrations. | Optional source/docs at Joshua 237/Jericho 237; a fresh world had none of the six probed packages and did not know the system. The dossier inventories all 19 active commands, 23 action translators, editor surface, trace controls, and source-only limitations. |
| [Statice](../statice-persistent-object-and-database-environment.md) | Persistent object/database development, run-time, server, Browser, DBFS/B*-tree storage, schemas and queries, transactions, recovery, backup, maintenance, and documentation systems. | Optional layered source/docs; all six probed packages and seven loaded-only systems were absent from the base world. The dossier inventories all 83 programming operators and the complete Browser, Command Processor, and File System Operations surfaces. |
| [Macsyma 421](../macsyma-421-symbolic-mathematics-environment.md) | Symbolic mathematics system with a 167-component installed core spanning evaluation, parsing/display, algebra, analysis, integration, matrices, plotting, simplification, solving, translation, Help, and three editor routes. | Contributed proprietary system/media and local-only decoded Help are present. The clean world had no Macsyma/Climax packages or registered system; the dossier records all 69 top commands, 49 nested panels, expression gestures, and explicit runtime TODOs. |
| [Concordia](../concordia-document-and-book-design.md) | Structured authoring, NSage records and `.sab` serialization, markup, linking, indexing, book design, preview, hardcopy, graphics, and Zmacs/Document Examiner integration. | Layered product source/docs and complete 74/26/11 command audit; fresh world had NSage but not the three application configurations. |
| [NS electronic-design family](../ns-electronic-design-family.md) | `basic-ns`, `gate-array-ns`, `pcb-ns`, `schematic-ns`, and `vlsi-ns`; one integrated library/module/aspect editor spanning schematic capture, RSIM/timing, gate arrays, PCB production, and VLSI physical design. | Contributed release-36 compiled media; complete inert command/gesture audit. The expansion of “NS” and loaded runtime behavior remain TODOs. |
| [CLOE](../cloe-development-and-runtime-environment.md) | Genera-side Developer and migration environment paired with an Intel PC Runtime/Application Generator, DOS/Windows CLIM port, Listener, debugger, and delivery-image workflow. | Evidence-limit dossier: the exact 5,078-file media manifest contains only the 61-record compiled documentation database; shared compatibility references are not product source, and a fresh world had none of four packages, three features, or five loaded-only systems. |

Trademark notices mention additional historical products such as Symbolics Prolog,
KEE, SmartStore, and Semanticue. A notice is not an installation inventory. This
audit found no matching system declaration or product source for those names, so
they are not promoted into the inspected-media catalog.

## File, network, service, and operations areas

| Area | Named facilities found | Evidence and Open Genera limit |
| --- | --- | --- |
| [File systems](../file-systems-and-file-service.md#genera-85-file-access-paths) | Host-file access, QFILE and NFILE service, NFS client, LMFS documentation/code, Dired, FSEdit, and File Server. | Complete access-path, protocol, direct-command, and frame audit; NFS client is VLM-applicable, while the 8.5 release declaration excludes LMFS with `#-VLM`. |
| [Namespace](namespace-administration-and-editor.md) | Namespace descriptor/object/log/change databases, Editor, server views, validation, presentation types, service attributes, site selection, and construction. | Source/help and reviewed runtime menu; site was explicitly unconfigured and no object/server mutation was attempted. |
| [IP networking and services](../network-services-and-site-utilities.md#genera-internet-ftp-server) | IP/TCP, FTP server, TFTP, Telnet/Terminal, domain-name server, Finger/Name paths, and TCP diagnostics over the [generic transport graph](../network-transports-and-protocol-architecture.md#generas-generic-network-graph). | Complete service/command and transport-path audits; the base VLM release has IP-TCP, but all 47 observed core services were disabled and optional DNS/example Finger contacts were absent. No external service was exercised. |
| [Legacy networking and services](../network-services-and-site-utilities.md#generas-generic-server-framework) | Chaosnet protocols and contacts, evaluation, notification, screen/status/routing services, terminals, diagnostics, and DNA-related support; [transport details](../network-transports-and-protocol-architecture.md) are kept separate. | Source/help present; a fresh registry probe established registration and disablement only, not peer behavior. |
| Mail | Zmail user agent, Converse, SMTP, mail access paths, Mailer background service, logs and queues. | Zmail is base; Mailer is documented as loadable. Servers were disabled in the observed world. |
| [Printing and hardcopy](../hardcopy-press-printing-and-plot-output.md) | Hardcopy streams/devices, six live formats, Function-Q capture, PostScript generation/interpreter, printer queues, Print service, spooler log, and maintenance commands. | Hardcopy 446.0 is live in the base world; Print and PostScript were not loaded, both default printers were `NIL`, no request was submitted, and two option-form crops are reviewed. |
| [Tape](../tape-systems-and-tape-utility-frame.md#symbolics-genera-85-tape-system) | Record streams, local/remote selection, RTAPE and Unix `rmt`, Carry, TAR, TAPEX, distribution media, FEP-Tape, and 15 Tape Administration commands. | Tape is in the VLM release roster and the live command table was audited; no local drive, remote server, or FEP-Tape frame was established, and no media operation was attempted. |
| [RPC and embedding](../rpc-embedding-ux-and-macintosh-integration.md) | RPC, RPC Development, Embedding Support, UX Support/Development, MacIvory Support/Development, Keyboard Control, HyperCard-MacIvory, and Mac-Dex; DBFS Utilities is cross-linked to Statice. | Complete 192-symbol RPC and 161-symbol Mac Toolbox package inventories, direct UX/Mac/keyboard commands and defaults, host-family conditions, and source/manual discrepancies. The VLM release retains RPC, Embedding, and UX while excluding separate MacIvory systems; a fresh isolated probe found the console keyboard layout type `NIL`, so Keyboard Control rejected the activity exactly as its source predicate specifies. |
| [X integration](../clx-remote-x-screens-and-x-server-facilities.md) | CLX clients, X remote screens, documentation, fonts, XDMCP, CLX-CLIM, and the separate historical server. | Guest client/server roles and VLM transport are explicitly distinct from the host Xvfb used by the preservation harness. |
| [HTTP/web](../cl-http-and-contributed-web-systems.md) | Contributed CL-HTTP server, base client and substrate, proxy, W3P, W4, Lambda IR, Showable Procedures, Btree substrate, and bundled examples. | Complete system, command, gesture, W3P, W4, Lambda IR, and example inventories are linked. A network-isolated probe found all nine systems absent from the base world; meaningful execution requires deliberate loading and a loopback-only fixture. |
| World and distribution operations | Distribute Systems, Restore Distribution, patches, world building, system maintenance, delivery-world guidance. | Core source/help and runtime menu. No Save World was performed by the harness. |
| Site and server administration | Site configuration, users/hosts, processes, file/mailer/printer/domain logs, garbage collection, scheduler, and storage tools. | Core command/source areas; observed world says site configuration is incomplete and servers disabled. |

## Genera 8.5 release-system roster

The release declaration is the strongest static evidence for what belongs to the
Genera 8.5 VLM release as opposed to merely sharing the media tree. It names 35
entries:

| Reader state | Count | Exact release-system names |
| --- | ---: | --- |
| Applies to the VLM | 26 | `System`, `CLOS`, `RPC`, `Embedding-Support`, `UX-Support`, `Development-Utilities`, `Old-TV`, `Zwei`, `Utilities`, `RPC-Development`, `UX-Development`, `Server-Utilities`, `Hardcopy`, `Zmail`, `Tape`, `NSage`, `Extended-Help`, `CL-Developer`, `DOC`, `IP-TCP`, `IP-TCP-DOC`, `CLX`, `X-Remote-Screen`, `X-Documentation`, `NFS-Client`, `NFS-Documentation` |
| Excluded by `#-VLM` | 5 | `MacIvory-Support`, `MacIvory-Development`, `Serial`, `SCSI`, `LMFS` |
| Disabled by `#+ignore` | 4 | `Lock-simple`, `compare-merge`, `Version-Control`, `Version-Control-doc` |

The declaration labels the release `8.5`, Open Genera `2.0`, status `released`, and
date 1998-10-07; it identifies `System` as 452.22. The visible startup header
independently displayed Open Genera 2.0, Genera 8.5, Genera program 9.0, and DEC
OSF/1 V127; it did not display `System 452.22`. The 35-name release roster and
98-name live loaded-system roster answer different questions: supported top-level
release systems versus every SCT system with a non-null loaded-version state.

## Installed documentation's loadable systems

The installed loadable-systems database contains 28 product records. These are exact
record labels, grouped here only for readability.

| Group | Exact installed record labels |
| --- | --- |
| Color, database, and Macintosh integration | `IVORY-COLOR-SUPPORT`; `HyperCard-MacIvory`; `Mac-Dex`; `DBFS-Utilities`; `Statice-Runtime` |
| X and network | `X-Documentation`; `X-Remote-Screen`; `X-Server`; `NFS-Documentation`; `NFS-Server and NFS-Client`; `IP-TCP-Doc`; `IP-TCP`; `Domain Name Server` |
| Utilities and services | `Hacks`; `Conversion-Tools`; `Metering`; `Mailer`; `Print` |
| CLIM | `CLIM-Doc`; `CLIM-Demo`; `CLIM` |
| Host and embedding | `UX-Development`; `MacIvory-Development`; `RPC-Development`; `UX-Support`; `MacIvory-Support`; `Embedding-Support`; `RPC` |

“Loadable” is distribution documentation, not proof that the system is currently
loaded. Some records also describe other machine families and delivery-world
construction.

## Exact site system inventory

There are 81 distinct names in the greatest evacuated versions of
`sys.sct/site/*.system`. Sibling names are grouped, but every exact identifier is
retained below.

| Family | Count | Exact site identifiers |
| --- | ---: | --- |
| Core/general utilities | 4 | `examples`, `genera-extensions`, `conversion-tools`, `lock-simple` |
| Symbolics C | 5 | `c`, `c-documentation`, `c-library-headers`, `c-packages`, `c-runtime` |
| Symbolics Fortran | 4 | `fortran`, `fortran-doc`, `fortran-package`, `fortran-runtime` |
| Symbolics Pascal | 4 | `pascal`, `pascal-doc`, `pascal-package`, `pascal-runtime` |
| Compiler, grammar, lexer, and syntax tools | 13 | `compiler-tools-debugger`, `compiler-tools-development`, `compiler-tools-package`, `compiler-tools-runtime`, `context-free-grammar`, `context-free-grammar-package`, `lalr-1`, `lexer-package`, `lexer-runtime`, `minimal-lexer-runtime`, `ll-1`, `syntax-editor-runtime`, `syntax-editor-support` |
| UI and image substrates | 5 | `clim`, `clim-doc`, `essential-image-substrate`, `image-substrate`, `postscript` |
| Graphics and editors | 10 | `bitmap-editor`, `color`, `color-doc`, `framethrower`, `framethrower-xl-interface`, `graphic-editing`, `graphic-editor`, `graphics-support`, `gred-doc`, `images` |
| Concordia publishing | 3 | `concordia`, `concordia-doc`, `sgd-book-design` |
| Knowledge, database, mathematics, and electronic design | 16 | `btree`, `statice`, `statice-browser`, `statice-documentation`, `statice-runtime`, `statice-server`, `joshua`, `joshua-doc`, `joshua-metering`, `jericho`, `macsyma`, `basic-ns`, `gate-array-ns`, `pcb-ns`, `schematic-ns`, `vlsi-ns` |
| Contributed HTTP stack | 8 | `cl-http`, `http-base-client`, `http-client-substrate`, `http-proxy`, `lambda-ir`, `showable-procedures`, `w3p`, `w4` |
| Network and mail services | 2 | `domain-name-server`, `mailer` |
| Host integration | 1 | `macivory-support` |
| Metering | 2 | `metering`, `metering-substrate` |
| Versioning | 3 | `compare-merge`, `version-control`, `version-control-doc` |
| Demonstrations | 1 | `hacks` |

## Additional system-directory identifiers

The media has 114 distinct `.system-dir` identifiers. Sixty-two have an exact same
name in the 81-name site list above. These are the remaining 52 exact identifiers;
together, the two tables cover the full 133-name union.

| Family | Count | Exact additional `.system-dir` identifiers |
| --- | ---: | --- |
| Base release and editor systems | 11 | `system`, `clos`, `cl-developer`, `development-utilities`, `doc`, `extended-help`, `nsage`, `old-tv`, `utilities`, `zwei`, `zmail` |
| Canonical compiler/syntax targets behind site aliases | 8 | `cfg`, `cfg-package`, `cts-debugger`, `cts-development`, `cts-package`, `cts-runtime`, `syntax-ed-runtime`, `syntax-ed-support` |
| UI, graphics, printing, and X | 13 | `clim-demo`, `clx`, `clx-clim`, `color-editor`, `genera-clim`, `genex`, `graphics-toolkit`, `hardcopy`, `postscript-clim`, `ps`, `support`, `x-documentation`, `x-remote-screen` |
| Network, host integration, and services | 13 | `embedding-support`, `ip-tcp`, `ip-tcp-doc`, `ipds`, `ml`, `nfs-client`, `nfs-documentation`, `rpc`, `rpc-development`, `su`, `tape`, `ux-development`, `ux-support` |
| Canonical product targets behind site aliases | 5 | `jd`, `je`, `js`, `showproc`, `statice-doc` |
| Metering UI | 1 | `metering-interface` |
| Demonstration bundle | 1 | `demos` |

Nineteen site-only names are aliases or source-file entry points rather than matching
system-directory filenames. The mappings established by their site files are:

| Site name | Target or role |
| --- | --- |
| `compiler-tools-debugger` | `cts-debugger` |
| `compiler-tools-development` | `cts-development` |
| `compiler-tools-package` | `cts-package` |
| `compiler-tools-runtime` | `cts-runtime` |
| `context-free-grammar` | `cfg` |
| `context-free-grammar-package` | `cfg-package` |
| `domain-name-server` | `ipds` |
| `examples` | Source `examples/sysdcl`; no same-named `.system-dir` found |
| `genera-extensions` | `genex` |
| `graphics-support` | `support` |
| `jericho` | `je` product/example system |
| `joshua` | `js` |
| `joshua-doc` | `jd` |
| `mailer` | `ml` |
| `metering-substrate` | `metering` |
| `showable-procedures` | `showproc` |
| `statice-documentation` | `statice-doc` |
| `syntax-editor-runtime` | `syntax-ed-runtime` |
| `syntax-editor-support` | `syntax-ed-support` |

## Demonstrations and examples

### HACKS demonstrations

The 18 greatest-version `site/*.demo` descriptors all require the `Hacks` system.
Their names are complete for that registry. Purpose summaries below are paraphrased
from descriptor and implementation inspection. The
[full HACKS suite dossier](genera-hacks-demonstration-suite.md) gives every entry a
separate implementation, control, option, lineage, and runtime-boundary study.

| Exact demonstration | What it demonstrates |
| --- | --- |
| `ABACUS` | Interactive graphical abacus. |
| `BIRDS` | Moving XOR triangle pattern. |
| `CROCK` | Analog clock display. |
| `DIGITAL-CROCK` | Digital clock display. |
| `ESCHER` | Animated XOR line-segment pattern. |
| `GODEL` | Visualizes the motion algorithm used by Escher. |
| `HACKS` | Demonstration chooser/umbrella entry. |
| `HOLLERITH-EDITOR` | Named Hollerith editing demonstration; exact user purpose remains a runtime **TODO**. |
| `LEXIPHAGE` | Animates a moving mouth consuming displayed text. |
| `LIFE` | Conway-style cellular-automaton demonstration. |
| `MUNCHING-SQUARES` | Classic arithmetic/XOR display pattern. |
| `MUNCHING-TUNES` | Sound demonstration derived from the Munching Squares calculation. |
| `QIX` | Animated line drawing. |
| `ROTATE` | Bitmap rotation demonstration. |
| `SPLINES` | Draws open or closed curves through mouse-selected points. |
| `TV-BUG` | Animated display creature/effect; exact controls remain a runtime **TODO**. |
| `WORM` | Animated surface/worm display; exact interaction remains a runtime **TODO**. |
| `ZOWIE` | Short sound effect demonstration. |

The adjacent `demo/` implementation directory also contains historical source
modules named `abacus`, `alarm`, `crazed`, `crock`, `dc`, `deutsc`, `dlwhak`, `geb`,
`hcedit`, `munch`, `ohacks`, `organ`, `pict`, `qix`, `rotate`, and `worm`. Module
presence is recorded as source/media evidence; only the 18 descriptor names above
are promoted as registered demos.

### CLIM demonstrations and tutorial

The [complete CLIM demonstrations and tutorial dossier](../clim-demonstrations-and-tutorial.md)
gives every canonical frame a separate architecture, command, gesture, dependency,
data/format, safety, source/manual-discrepancy, and screenshot-boundary section. It
also distinguishes the 16 ordinary chooser demos from the seventeenth registered
Test Suite launcher, whose body is loaded separately.

Static source inspection found 26 literal `define-application-frame` forms in 25
files. The demo frames include `address-book`, `bitmap-editor`, `browser`, `cad-demo`,
`color-chooser`, `demo-app`, `flight-planner`, `graphics-demo`, `graphics-editor`,
`ico-frame`, `lisp-listener`, `peek-frame`, `plot-demo`, `puzzle`, `scigraph`, and
`thinkadot`. `selected-object-mixin` is a superclass used by the graphics editor,
not a standalone demo.

The tutorial contains five successive Fifteen Puzzle frames
(`fifteen-puzzle-1` through `fifteen-puzzle-5`), two source stages defining `lsq`,
and a Tic-Tac-Toe source example. The CLIM tree also defines `clim-tests`; one
Conversion Tools form computes its frame name conditionally and is not promoted to a
named application. These are source-present examples, not runtime-verified programs.

### Other example collections

The [complete product and programming examples dossier](../product-and-programming-examples.md)
audits every file in the five bounded example collections, gives all fourteen
concrete example program frameworks their own controls and implementation analysis,
and preserves the distinction between applications, tutorials, tests, benchmarks,
configuration samples, and unsafe export/server examples.

| Collection | Named source-visible examples |
| --- | --- |
| Core Genera examples | Accepting Values; audio; Common Lisp Life variants; constraint-frame language stages; program-framework examples (`avv-pane-test`, `accept-two`, `calculator`); file-server initialization; Flavor Life; Gabriel benchmarks; hardcopy stream; incremental redisplay; Finger server; Teach Zmacs; employee-editor UI example. |
| Joshua | Cryptarithmetic; Demosthenes; Dial demo; “I'm My Own Grandpa”; HT examples; model tutor; N-Queens variants; object-modelling tests; planning/blocks; Samaritan/Jericho; TMS examples; widget factory. Source defines program frames for `cryptarithmetic`, `DIAL-DEMO`, `ht-demo`, `modelling-tutor`, `blocks-demo`, `jericho-demo-suite`, `n-queens`, and `widgetsim`. |
| Statice | Bank, Books, extended types, Finger, image, Joshua integration, presentation type, and university examples; source defines a `books` program frame. |
| Color | AOS hacks, curve, fog and fog figures, mirror, spheres, and test-pattern modules. |
| CL-HTTP | Access control, client, configuration, documentation, Listener, log window, mail archive/index, slides, MCF, Twistdown Tree, and VRML scenes. |

## What remains unproved

This catalog deliberately stops short of several tempting claims:

- The four live registries were enumerated read-only in one fresh session, but a site,
  user initialization, layered-system load, or runtime mutation can change them.
- The loaded-system query is exact for this fresh base-world session, but an optional
  system load, site initialization, user initialization, or runtime mutation can
  change it. Static system directories and documentation books remain distinct
  evidence even where their names overlap the live roster.
- Some program-frameworks specify `:selectable nil`, some names select between
  alternative frames, and some frames are reusable internal machinery. Counting forms
  as applications would overstate the result.
- Installed documentation includes legacy hardware, other Symbolics platforms, and
  products not implemented in this source subset. Documentation presence alone is
  therefore labelled explicitly.
- The observed world was not configured for its local site and had servers disabled.
  Network, mail, printing, tape, and server behavior remains unverified.
- No claims in this article authorize redistribution of the licensed source, compiled
  systems, decoded help, or other media payload.

A future runtime audit should repeat these read-only enumerators after deliberate
optional-system loads and after configuring a disposable site, retain the results as
evidence-only metadata, and launch representative applications through the harness.
Any visible application article should include a reviewed screenshot or an explicit
blocker, as required by the repository writing guide.

## Public sources

- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf), especially “SELECT Key” and the standard Select assignments.
- Symbolics, [*Genera Handbook*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Handbook.pdf), especially “Select Activity” and the application summaries.
- Symbolics, [*Genera Concepts*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Concepts.pdf), for the environment's system and interaction model.
- Symbolics, [*Program Development Utilities*](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf), for debugging, inspection, metering, and system-development tools.
- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf), for Dynamic Windows programs, command tables, presentations, and activities.
- Symbolics, [*Editing and Mail*](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf), for Zmacs, Zwei, Dired, Zmail, Converse, and Mail mode.
- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf), for the VLM host relationship and normal Genera environment.
- Symbolics, [Genera 8 manual index](https://bitsavers.org/pdf/symbolics/software/genera_8/), for the public manuals cross-checked in this audit.

Public links last verified 2026-07-18. Exact 8.5 counts and conditions come from the
local licensed artifacts identified above, not from treating the public Genera 8
manual set as a byte-for-byte specification of this world.
