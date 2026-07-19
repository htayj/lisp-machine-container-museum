---
type: Museum Catalog
title: Software areas and programs of the MIT CADR and Symbolics Genera
description: A release-bounded map of the interactive applications, development tools, services, language products, system facilities, and demonstrations preserved for the two Lisp-machine environments.
tags: [lisp-machine, mit-cadr, lm-3, genera, applications, software-catalog]
timestamp: 2026-07-18T13:47:14-04:00
---

# Software areas and programs of the MIT CADR and Symbolics Genera

The two systems are complete programming environments rather than operating systems
with a small, sharply separated application layer. A listener, editor, mail reader,
debugger, compiler, file browser, window manager, server, and hardware diagnostic can
all coexist in one Lisp world and call one another directly. For that reason, a useful
"application list" must include more than the icons or menu entries that would define
an application list on a later workstation.

This page is the cross-system map. The release-bounded detailed catalogs are:

- [MIT CADR and LM-3 software areas and applications](mit-cadr/software-areas-and-applications.md),
  covering the public System 46 tape snapshot and the maintained System 303 source
  and load band used by the museum;
- [Symbolics Genera software areas and applications](genera/software-areas-and-applications.md),
  covering the inspected Genera 8.5/Open Genera 2.0 world and its installed source
  and system declarations.

The [application dossier coverage matrix](software-application-dossiers.md) turns
these exhaustive release catalogs into a finite 60-topic research queue and links
each completed editor-depth study. Its companion [CLIM-use audit](clim-use-across-lisp-machine-software.md)
identifies the actual interface substrate and any CLIM relationship for every one of
those sixty topics, including explicit negative findings where the software instead
uses TV, EINE/ZWEI, Dynamic Windows, streams, or a noninteractive service boundary.

The CADR System 46 evidence is public. The Genera archive, world, source, compiled
systems, and extracted documentation are licensed local inputs; only evidence-only
names, counts, hashes, and original analysis from them are tracked here.

Those pages carry the exhaustive name lists, evidence status, and release-specific
qualifications. This comparison deliberately does not turn a source directory, Lisp
package, library, test case, or individual command into an "application" merely
because it has a name.

## The visible center of each environment

These are the principal interactive roles a new user encounters. A dash means that
the inspected evidence did not establish a close counterpart, not that no one could
write one.

| Role | MIT CADR / LM-3 | Symbolics Genera 8.5 |
| --- | --- | --- |
| Interactive Lisp | [Lisp Listener](mit-cadr/lisp-listener.md) | [Dynamic Lisp Listener with the Command Processor](genera/dynamic-lisp-listener.md) |
| Text and program editing | EINE in a separate late-1977 source corpus; ZWEI as the System 46/303 editing substrate and Zmacs as the later editor application | ZWEI as the substrate and Zmacs, selected as Editor, as the application |
| Mail | [Zmail](mit-cadr/zmail.md), shown as Mail in the System 303 menu | [Zmail and its distinct composition modes](genera/zmail.md), plus the background Mailer and its log interface |
| Live user-to-user messages | [System 46 QSend and maintained System 303 Converse](converse-direct-messages-and-notifications.md) | [Converse plus central Notifications](converse-direct-messages-and-notifications.md) |
| Object browsing | [Inspector](mit-cadr/inspector.md) | [Inspector](genera/inspector-and-peek.md#inspector) and [Presentation Inspector](genera/presentation-inspector.md) |
| Errors and debugging | [Error Handler/Window Debugger](mit-cadr/error-handler-and-debuggers.md), [Trace, Stepper, breakpoints, and call analysis](trace-stepper-breakpoints-and-call-analysis.md), CADR Debugger | [Debugger/Display Debugger](genera/debugger-and-display-debugger.md), [Trace, Stepper, Breakpoint and Callers tools](trace-stepper-breakpoints-and-call-analysis.md), and monitoring tools |
| System observation | [Peek](mit-cadr/peek.md) and [LMETER, PTRAC, and Meter](metering-and-performance-analysis.md) | [Peek](genera/inspector-and-peek.md#peek), [Meter and Metering Interface](metering-and-performance-analysis.md), notifications, and service-log activities |
| Files and directories | [Pathnames, QFILE, Local-File, LMFILE, and file servers](file-systems-and-file-service.md), directory editor within ZWEI, file-system maintenance, disk-label tools | [Host-selected access paths, QFILE, NFILE, NFS, LMFS, File/Directory/NFS commands, and the File Server frame](file-systems-and-file-service.md), [Namespace Editor](genera/namespace-administration-and-editor.md), and media-present version-control tools |
| On-line documentation | [Source-integrated Help and editor documentation](help-self-documentation-and-document-examiner.md) | [Document Examiner, context Help, extended Help, and application command documentation](help-self-documentation-and-document-examiner.md) |
| Remote terminal | [SUPDUP and Telnet terminal implementations](network-terminal-applications.md) | [Terminal for Telnet and related network terminal use](network-terminal-applications.md) |
| Window/layout tools | [System Menu](mit-cadr/system-menu-and-select.md), [Screen Editor](screen-editor-and-frame-up.md), and split-screen layouts | [System Menu and activities](genera/activities-and-system-menu.md), [the retained Screen Editor and separate Frame-Up designer](screen-editor-and-frame-up.md), activity selector, and window commands |
| Raster graphics authoring | [FED Font Editor generations](fed-and-font-editor-generations.md), [PAINT/NPAINT](bitmap-stipple-and-raster-paint-editors.md), [indexed color and experiments](color-systems-and-color-editor.md#mit-cadr-color-substrate), and [public picture, scan, sprite, pattern, and SUDS assets](mit-cadr/visual-assets-inventory.md) | [Bitmap-derived Font Editor](fed-and-font-editor-generations.md#genera-85-font-editor), [Bitmap and Stipple Editors](bitmap-stipple-and-raster-paint-editors.md), [Graphic Editor](genera-graphic-editor-and-structured-drawing.md), [Color Editor and Palette](color-systems-and-color-editor.md), plus [image objects, formats, drawing, and FrameThrower](images-drawing-and-visual-asset-substrates.md) |
| Printing and document production | [Hardcopy, Press, XGP, DPLT, and Versatec](hardcopy-press-printing-and-plot-output.md), Bolio, and [formatting, spelling, and text-production utilities](formatting-spelling-and-text-production-utilities.md) | [Hardcopy, Print, and PostScript](hardcopy-press-printing-and-plot-output.md), [Sage and text-production utilities](formatting-spelling-and-text-production-utilities.md), and [Concordia structural authoring, Page Previewer, and book design](concordia-document-and-book-design.md) |

This is a role map, not a lineage claim. Similar labels can hide substantial
implementation changes. The detailed pages identify when Genera retained an MIT
concept, replaced it, or added a new subsystem.

## Software-domain map

| Area | MIT CADR / LM-3 examples | Symbolics Genera examples |
| --- | --- | --- |
| Lisp development | Listener, [runtime and compiler](lisp-runtime-compiler-and-development-environment.md), package system, [Flavors and the earlier entity/class facility](flavors-clos-and-flavor-examiner.md), ZWEI/Zmacs, [source comparison](source-comparison-compare-merge-and-version-control.md), [system builder and patch tools](system-construction-patches-worlds-and-distribution.md) | Dynamic Listener and Command Processor, [runtime/compiler/development release](lisp-runtime-compiler-and-development-environment.md), [CLOS, New Flavors, and the Flavor Examiner](flavors-clos-and-flavor-examiner.md), Zmacs, [resident SRCCOM and media-present Compare/Merge and Version Control](source-comparison-compare-merge-and-version-control.md), [Compiler Tools and syntax infrastructure](compiler-tools-grammar-lexer-and-syntax-editor.md), [system construction and distribution](system-construction-patches-worlds-and-distribution.md) |
| Compiled objects | [QFASL, QFASL-REL, and UNFASL](compiled-objects-qfasl-relocation-and-unfasl.md) | [L-BIN and UNBIN](compiled-objects-qfasl-relocation-and-unfasl.md#genera-l-bin); separate `BIN`, Zmail `KBIN`, and embedding/RPC support |
| Other languages and representations | Microassembler and machine diagnostics; PL/I editing mode; Lisp Machine Lisp | [Symbolics C, FORTRAN, and Pascal](symbolics-c-fortran-and-pascal-environments.md), [CLIM 2](clim-2-on-genera.md) and its [demonstrations/tutorial](clim-demonstrations-and-tutorial.md), [Compiler Tools, grammar/lexer packages, and Syntax Editor support](compiler-tools-grammar-lexer-and-syntax-editor.md), [Conversion Tools](conversion-tools-and-source-migration.md), the [CLOE external delivery environment](cloe-development-and-runtime-environment.md), and [RPC/embedding tools](rpc-embedding-ux-and-macintosh-integration.md) |
| Knowledge and data systems | [Matrix, rational, complex, and infix facilities](mathematical-and-numeric-facilities.md), core Lisp data, Inspector, experimental AMORD/LMTMS source records, and historical Macsyma integration evidence | [Common Lisp numeric and matrix facilities](mathematical-and-numeric-facilities.md#genera-85), [Joshua and Jericho](joshua-rule-and-inference-environment.md), [Statice](statice-persistent-object-and-database-environment.md), [Macsyma 421](macsyma-421-symbolic-mathematics-environment.md), B-tree support, and namespace design tools |
| Communication | Chaosnet, Ethernet, SUPDUP/Telnet, Converse, Zmail, file service | Chaosnet and TCP/IP, Terminal, Converse, Zmail/Mailer, NFS, DNS, [CL-HTTP and its client/proxy systems](cl-http-and-contributed-web-systems.md), [RPC](rpc-embedding-ux-and-macintosh-integration.md), and X remote screens |
| Host and coprocessor integration | No matching System 46 subsystem; maintained System 303 declares a three-module `Unix-Interface`, but its implementation files are absent | [Ivory, FEP, Life Support, and the Open Genera VLM](ivory-fep-and-open-genera-vlm-implementation-layers.md), plus [RPC/XDR, Embedding and UX Support, MacIvory, Keyboard Control, HyperCard-MacIvory, Mac-Dex, and DBFS Utilities](rpc-embedding-ux-and-macintosh-integration.md) |
| Storage and operations | [Local and remote file systems and file servers](file-systems-and-file-service.md), [DLEDIT, pack management, checkout, and salvage](mit-cadr/disk-labels-packs-and-file-system-repair.md), [site/login data and later Site Editor](mit-cadr/site-data-login-and-site-editor.md), [later LMI Tape/TFrame systems](tape-systems-and-tape-utility-frame.md), [cold load and load-band construction](system-construction-patches-worlds-and-distribution.md) | [File-service architecture and operations](file-systems-and-file-service.md), [namespace/site administration](genera/namespace-administration-and-editor.md), [FSEdit, LMFS maintenance, and salvage](genera/fsedit-and-file-system-maintenance.md), [tape streams, formats, transports, FEP-Tape, and administration](tape-systems-and-tape-utility-frame.md), [world building, patching, and distribution](system-construction-patches-worlds-and-distribution.md), and host/VLM integration |
| User interface and media | Window system, menus, fonts, [FED generations](fed-and-font-editor-generations.md), [public images and visual assets](mit-cadr/visual-assets-inventory.md), color support, hardcopy, PRESS, and the [TV antecedents to presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md#cadr-tv-is-an-antecedent-not-the-same-system) | [Dynamic Windows and presentations](dynamic-windows-and-presentation-based-interaction.md), [CLIM 2](clim-2-on-genera.md), fonts, raster and structured-graphics editing tools, [image objects/formats and FrameThrower](images-drawing-and-visual-asset-substrates.md), color systems, hardcopy, Print, and PostScript |
| Monitoring and repair | Peek, meter, trace, Error Handler, CADR debugger, diagnostics, [background server recovery](background-services-and-operations-dashboards.md), and [disk/file-system repair](mit-cadr/disk-labels-packs-and-file-system-repair.md) | Peek, metering, trace, Debugger, Inspector, [Flavor Examiner](flavors-clos-and-flavor-examiner.md), [service logs and operations programs](background-services-and-operations-dashboards.md), [FSEdit and storage maintenance](genera/fsedit-and-file-system-maintenance.md), and printer maintenance |
| Demonstrations and examples | [MUNCH](mit-cadr/munch.md), [LEXIPHAGE](mit-cadr/lexiphage.md), [DOCTOR](mit-cadr/doctor.md), [Spacewar](mit-cadr/spacewar-on-the-lisp-machine.md), and the complete [CADR HACKS/display/sound/novelty suite](mit-cadr/cadr-hacks-display-sound-and-novelty-suite.md) | [HACKS](genera/genera-hacks-demonstration-suite.md), [CLIM demonstrations and tutorial programs](clim-demonstrations-and-tutorial.md), and the bounded [Core, Joshua, Statice, Color, and CL-HTTP example collections](product-and-programming-examples.md) |

## What "complete" means here

The catalog is complete for the identified preserved evidence, not for every program
ever written for either machine family. It records the following evidence layers
separately:

| Evidence layer | What it establishes |
| --- | --- |
| Distribution or artifact present | The named material occurs on the inspected release media or load-band support tree. |
| Source present | Source contains a distinct user program, server, tool, diagnostic, or demonstration with an identifiable entry point. |
| Declared or known | The system registry has a declaration for it. This does not mean it is loaded. |
| Loaded | The exact inspected world reports the system resident. This does not necessarily make it interactive. |
| Registered activity | The window/activity machinery knows how to select or create it. |
| Select key | The exact world or source binds it in the system-key/SELECT table. |
| System or Create menu | It appears in one deliberately curated menu subset. |
| Command or function entry | It is an interactive tool entered from the Listener, Command Processor, editor, or a Lisp call rather than a top-level menu. |
| Embedded mode or subapplication | It is a separately usable facility inside a larger program, such as Dired within the editor. |
| Runtime observed | The museum directly exercised or displayed it with the identified load band/world and emulator/VLM. |
| Documented product | A contemporary manual or installed documentation set describes it, although the inspected code or runtime state might be optional or absent. |

The detailed lists do not collapse these layers into "available." In particular,
source presence does not prove that a program is loaded, configured, working, or
supported in the inspected world. An installed Genera `.system` record does not
prove that its product is resident. A menu entry proves an entry point, not every
feature behind it. Conversely, menu enumeration undercounts by design: both systems
provide interactive programs that do not occupy their short Programs columns.

Aliases are retained but counted as one user-facing concept when they identify the
same implementation: for example, Edit, Editor, and Zmacs, or Mail and Zmail. Distinct
implementation generations such as EINE and Zmacs remain distinct.

The census excludes individual Lisp functions, Command Processor commands, editor
commands, packages, flavors/classes, low-level source modules, data files, fonts,
tests, and incidental examples embedded in documentation. Those have their own
inventories where useful. It includes libraries and infrastructure only when they
define a historically meaningful software area needed to understand what the
environment could do.

## Runtime cross-checks

The museum's isolated harnesses provide two narrow runtime anchors:

- A fresh System 303 session's System-Help table displayed five bindings: Top-L for
  `LISP(Edit)`, E for Editor, I for Inspector, L for Lisp, and P for Peek. Its
  Programs menu separately displayed Lisp, Edit, Inspect, Trace, Peek, Mail, and
  Emergency Break. The difference demonstrates why neither registry is sufficient
  alone. The earlier menu capture and hashes are recorded in the
  [CADR harness report](mit-cadr/cadr-computer-use-harness.md#current-schema-cold-boot-observations).
- A direct evaluation of the Select-key table in a fresh copy of the inspected
  Genera 8.5 world returned twelve bindings: `=` Select Key Selector, C Converse,
  D Document Examiner, E Editor, I Inspector, L Lisp, M Zmail, N Notifications,
  P Peek, Q Frame-Up, T Terminal, and X Flavor Examiner. The F binding for File
  System Maintenance printed in the *Genera User's Guide* was absent from this exact
  world. Its System Menu separately displayed Distribute Systems, Document Examiner,
  Editor, Emergency Break, Frame-Up, Hardcopy, Inspect, Lisp, Namespace Editor,
  Trace, and Zmail.
- The same world's live activity registry contained nineteen names: Converse,
  Distribute Systems, Document Examiner, Editor, File Server, Flavor Examiner,
  Frame-Up, Inspector, Keyboard Control, Lisp, Mail, Namespace Editor,
  Notifications, Peek, Restore Distribution, Select Key Selector, Terminal, Zmacs,
  and Zmail. Its Create registry contained Terminal, Lisp, Peek, Inspect, Edit,
  Frame-Up, Distribute Systems, Document Examiner, Namespace Editor, and the generic
  `Any` choice. These tables again disagree in useful ways with both the short menu
  and the documentation-derived union.
- A second fresh, read-only runtime query found 98 System Construction Tool records
  with a non-null loaded version in this world: 26 had numbered versions and 72 used
  `:NEWEST`. Their complete exact-name roster is retained in the
  [Genera detailed catalog](genera/software-areas-and-applications.md#live-loaded-system-roster).
- The same Genera world's top-level `Help Commands` response displayed command areas
  ranging from activities, editing, files, and Lisp through networking, printing,
  site administration, tape administration, and world building. This is a command
  taxonomy, not an application registry.

The exact-table query captures remain local. Separate later runtime studies selected
one sparse menu state from each system for capture-specific publication review and
the corresponding application dossiers. Their portable identities and shutdown
evidence are recorded in the curated screenshot catalogs. The earlier Genera System
Menu and command-category capture is described in
the [Genera harness report](genera/genera-computer-use-harness.md#screenshot-policy-and-final-verification).

Neither menu is the whole software catalog. Both systems also contain facilities
entered by commands, Select keys, functions, subsystem menus, server processes, or
explicit system loading.

## Sources and verification

- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf),
  especially "Selecting and Creating Activities" and "Standard Activities".
- Symbolics, [*Genera Handbook*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Handbook.pdf),
  especially the `SELECT HELP` description and `Select Activity` command.
- MIT CADR System 46
  [public source snapshot](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  including its release README and license.
- LM-3 System 303
  [system declaration](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp)
  and
  [System Menu implementation](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp).

Last verified: 2026-07-18.
