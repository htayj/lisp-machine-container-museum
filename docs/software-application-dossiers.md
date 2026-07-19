---
type: Museum Catalog
title: Application dossier coverage for the MIT CADR and Symbolics Genera
description: A finite coverage matrix mapping every meaningful program and software area in the release catalogs to an editor-depth museum dossier or an explicit grouped or blocked topic.
tags: [lisp-machine, mit-cadr, lm-3, genera, applications, documentation, research-plan]
timestamp: 2026-07-19T04:36:35-04:00
---

# Application dossier coverage for the MIT CADR and Symbolics Genera

The two release catalogs resolve into **60 canonical dossier topics**. They are the
finite documentation boundary for the request to study each meaningful application
and software area as deeply as the editors: implementation architecture, complete
feature and interaction inventory at a stated release boundary, source findings the
manuals omit, runtime behavior where the preserved software can be operated, and
explicit uncertainty where it cannot.

This matrix does not turn every package, alias, device driver, test, example frame,
or `DEFSYSTEM` name into a fictional standalone application. It does require every
meaningful catalog entry to appear in a dossier row, while the reconciliation tables
below account for the exhaustive low-level censuses and say why their members are
grouped. The source catalogs remain authoritative for release evidence and exact
counts:

- [MIT CADR and LM-3 software areas and applications](mit-cadr/software-areas-and-applications.md);
- [Genera 8.5 software areas, applications, and programs](genera/software-areas-and-applications.md).

The companion [CLIM-use audit](clim-use-across-lisp-machine-software.md) identifies
the actual UI substrate and the CLIM relationship for every row D01 through D60.

## What an editor-depth dossier requires

A finished dossier should contain, where the evidence exists:

1. identity, purpose, release boundary, lineage, and entry points;
2. implementation architecture and its dependencies, grounded in pinned source;
3. a complete, reproducible feature, command, key, menu, or protocol inventory at a
   clearly stated grain;
4. comparison with contemporary manuals and in-program Help;
5. deliberate source inspection for defaults, limits, unfinished paths, and behavior
   the manuals omit;
6. operation through the appropriate Xvfb harness, including representative visible
   states and reviewed screenshots when the program is runnable;
7. full portable runtime provenance and an explicit blocker when runtime verification
   is not currently possible;
8. the actual UI substrate and any CLIM relationship, established from dependencies,
   frame or port definitions, protocol calls, compatibility hooks, or equivalent
   evidence rather than shared vocabulary alone; and
9. preservation, rights, and open-question sections.

An infrastructure dossier substitutes formats, APIs, service state, failure modes,
and interoperability for a keybinding inventory. A demonstration-suite dossier must
still give every named demo its own purpose, controls, implementation, dependencies,
and runtime result or blocker; “grouped” does not mean “mentioned only in a list.”

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `deep/existing` | A current article already supplies most or all of the required depth for the evidence presently available. |
| `new-needed` | The canonical dossier has no editor-depth article yet, even if a catalog or preservation article supplies a useful start. |
| `grouped` | Closely related aliases, layers, services, or small programs belong in one coherent dossier with separately identified members. |
| `runtime-blocked` | Runtime or screenshot work is presently blocked by a missing load band, unloaded optional system, unconfigured service, absent hardware/data, or deliberately disruptive entry path. Source/manual research can still proceed. |

Statuses can be combined. `runtime-blocked` never licenses an unsupported behavioral
claim; the dossier must retain a `TODO` explaining the exact obstruction.

## Core user environment and visible applications

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D01 — Lisp Listeners and editable input** | `Lisp Listener / Lisp Interactor`; `Editing Lisp Listener / Lisp (Edit) / ZDT`; `ZTOP`; Lisp evaluator/REPL top level | `Lisp`; Dynamic Lisp Listener; `Command Processor`; `Input Editor`; `Evaluation Context`, `Global`, `Lisp`, `Process`, and `Session` command areas | [MIT Lisp Listener](mit-cadr/lisp-listener.md) and [Genera Dynamic Lisp Listener](genera/dynamic-lisp-listener.md), with the editor-family articles for ZDT/ZTOP integration, provide source/manual/runtime studies, complete stated-grain controls, and reviewed screenshots. The [D01 reimplementation specification](lisp-listeners-reimplementation-specification.md) converts that evidence into release-selectable state, transition, failure, visual, and conformance contracts. | `deep/existing; grouped` — the articles preserve the distinct input and command models instead of treating both systems as one REPL implementation. |
| **D02 — Program selection, activities, and window management** | `System Menu and window manager`; system-key registry and System Help; `TV` selection machinery | System Menu; activities; Create menu; `Select Key Selector`; `Activities` command area; aliases `Edit`/`Editor`, `Inspect`/`Inspector`, `Mail`/`Zmail` | [MIT System Menu and selection](mit-cadr/system-menu-and-select.md) and [Genera activities and System Menu](genera/activities-and-system-menu.md) give architecture, complete release-bounded registries and controls, fresh runtime comparisons, and reviewed screenshots. The [D02 reimplementation specification](program-selection-activities-and-window-management-reimplementation-specification.md) converts those findings into release-selectable registry, selection, menu, split-layout, persistence-boundary, visual, failure, and conformance contracts. | `deep/existing; grouped` — the separate registries and their reuse/create semantics are documented without collapsing them into one application manager; the broader `Window` command table remains outside D02. |
| **D03 — Screen Editor and Frame-Up layout design** | `Screen Editor (EDIT-SCREEN)`; screen splitting and live layout editing | retained `Screen Editor (EDIT-SCREEN)`; `Frame-Up`; `layout-designer`; generated Frame-Up program template | [Screen Editor and Frame-Up](screen-editor-and-frame-up.md) provides the three-generation Screen Editor lineage, complete pointer operations and Undo/attribute architecture, every Frame-Up and Zmacs integration command, pane types/options, source-only limitations, and fresh System 303 and Genera runtime captures. | `deep/existing; grouped` — the article corrects the false replacement inference: Genera has both the inherited live-window editor and the separate code-generating designer; both tools now have reviewed Genera runtime evidence. |
| **D04 — Emergency Break and degraded interaction paths** | `Emergency Break`; cold-load-stream evaluator | `Emergency Break`; emergency error-recovery path | [Emergency Break and the cold-load stream](emergency-break-and-cold-load-stream.md) supplies release-bounded architecture, entry points, recovery limits, a verified System 303 evaluation, and a reviewed screenshot. | `deep/existing` for CADR/LM-3; `deep/existing; runtime-blocked` for Genera — the proprietary source establishes its architecture and controls, while a fresh disposable VLM exercise remains an explicit `TODO`. |
| **D05 — EINE, ZWEI, and Zmacs editor family** | `EINE`; `ZWEI`; `Zmacs`; ZDT and ZTOP architecture; editor modes and command tables | `ZWEI`; `Zmacs`/`Editor`; editor modes, command tables, Teach Zmacs integration | [Cross-system lineage](lisp-machine-text-editors.md), [EINE](mit-cadr/eine.md), [CADR ZWEI/Zmacs](mit-cadr/zwei-and-zmacs.md), [Genera Zmacs](genera/zmacs.md), and their binding references | `deep/existing` for ZWEI/Zmacs; `deep/existing; runtime-blocked` for EINE because no compatible runnable band has been established. |
| **D06 — Directory, difference, and buffer editors** | `Dired`; `BDired`; `Edit Buffers` | `Dired`; `Edit Buffers`; directory/file command surfaces | [Directory, difference, and buffer editors](directory-difference-and-buffer-editors.md) gives architecture, complete release-bounded commands and gestures, source-only findings, and runtime observations, including the System 303 unmark defect. | `deep/existing; grouped` — the dossier preserves the specialized modes' distinct objects and workflows while comparing their shared Zwei substrate. |
| **D07 — Help, self-documentation, and Document Examiner** | ZWEI self-documentation; System Help; Lisp/flavor documentation; application Help handlers | `Document Examiner`; `doc-ex`; `small-doc-ex`; `Help Program`; `help`; `help-program`; Extended Help; `Documentation` command area | [Help, self-documentation, and Document Examiner](help-self-documentation-and-document-examiner.md) extends the recovery articles into complete visible workflows, commands, search/navigation behavior, source-only findings, and a reviewed live Standard frame. | `deep/existing; grouped` — storage/recovery and user-facing application behavior are now separately but cross-linked documented layers. |
| **D08 — ZMail and mail composition** | `ZMail`; `Mail` menu label; ZWEI Mail mode; mail transports and mail-file integration | `Zmail`; `Mail`; Mail mode; message, summary, filter, collection, and composition surfaces | [CADR/LM-3 ZMail](mit-cadr/zmail.md) and its [complete command/binding inventory](mit-cadr/zmail-keybindings.md), plus [Genera Zmail](genera/zmail.md) and its [complete command/binding inventory](genera/zmail-commands-and-bindings.md), provide source/manual/Help studies, architecture, transport boundaries, and reviewed empty-data runtime evidence. | `deep/existing; grouped; runtime-blocked` — both systems' readers and composition modes are complete at the stated grain; the tested CADR band lacks the optional ZMail load and Genera's site lacks `DIS-SYS-HOST`, so configured delivery remains explicitly runtime-blocked. Background delivery is D21. |
| **D09 — Converse, direct messages, and Notifications** | `Converse`; `SHOUT`; `NOTIFY`; `SEND-MSG`; saved sends | `Converse`; `Notifications`; `Conversation` and `Communication` command areas | [Converse, direct messages, and notifications](converse-direct-messages-and-notifications.md) separates every messaging and history layer, inventories complete specialized controls and Command Processor keywords, identifies source/manual defects, records the System 303 load boundary, and verifies Genera's empty editor plus a synthetic central notification with reviewed captures. | `deep/existing; grouped; runtime-blocked` — local application behavior is complete at the stated grain; honest delivery, replies, broadcast, duplicate filtering, and history order still require isolated peers, and the tested CADR band cannot load maintained Converse. |
| **D10 — Network terminal applications** | `SUPDUP`; `Telnet`; NVT window | `Terminal`; Telnet/NVT; remote-login terminal | [SUPDUP, Telnet, and the Genera Terminal program](network-terminal-applications.md) gives the complete release-bounded entry, command, connection-option, gesture, protocol, simulator, and display-effector inventories plus source/manual discrepancies. | `deep/existing; grouped; runtime-blocked` — static and recovered-Help coverage is complete at the stated grain; disconnected runtime and deterministic-peer negotiation remain explicit follow-up work. |
| **D11 — Object Inspector and Presentation Inspector** | `Inspector` / `INSPECT-FRAME` | `Inspector`; `Inspect`; `Presentation Inspector`; `presentation-inspector`; `Inspection` command area | [MIT Inspector](mit-cadr/inspector.md), the general-Inspector half of [Genera Inspector and Peek](genera/inspector-and-peek.md), and [Genera Presentation Inspector](genera/presentation-inspector.md) supply complete release-bounded control inventories, source/manual findings, safety boundaries, and reviewed synthetic-object runtime evidence. | `deep/existing; grouped` — both general Inspectors and Genera's presentation-handler debugger are complete at the stated grain, including the Presentation Inspector's processless lifecycle, ignored `Detailed` option, generic-window recovery, and two reviewed screens. |
| **D12 — Error Handler and graphical debuggers** | `Error Handler (EH)`; traps, stack frames, breakpoints, debugger window | `Debugger / Display Debugger`; `display-debugger`; condition handling, restarts, source access; `Debugging` command area | [MIT Error Handler and Window Debugger](mit-cadr/error-handler-and-debuggers.md) and [Genera Debugger and Display Debugger](genera/debugger-and-display-debugger.md) supply complete release-bounded controls, architecture, source/manual discrepancies, safe synthetic-error runtime studies, and reviewed ordinary/graphical captures. | `deep/existing; grouped` — the two articles preserve the generations' different condition and interface models while comparing their live-frame semantics. |
| **D13 — Trace, Stepper, breakpoints, and call analysis** | `Trace via menus`; `Stepper`; trace package | `Trace`; `Tracing`, `Breakpoint`, and `Callers` command areas; `WHO-CALLS` loaded system | [Trace, Stepper, breakpoints, and call analysis](trace-stepper-breakpoints-and-call-analysis.md) inventories all stated-grain controls and relationship types, traces project-owned functions on both systems, and records the Genera Input Editor and callers-mode boundaries with reviewed captures. | `deep/existing; grouped` — destructive breakpoint installation and database rebuilding remain intentionally unexercised but are fully source/manual-grounded. |
| **D14 — Peek and live system observation** | `Peek`; process, memory, file-system, and Chaosnet modes | `Peek`; process, window, file, and network modes | [MIT Peek](mit-cadr/peek.md) and the Peek half of [Genera Inspector and Peek](genera/inspector-and-peek.md) inventory the mode registries, controls, object menus, implementation behavior, and fresh runtime results, with one reviewed process view from each system. | `deep/existing` — destructive actions were deliberately not exercised; their behavior is source-grounded and the remaining runtime limits are explicit. |
| **D15 — Metering and performance analysis** | `Meter`; `LMETER`; `PTRAC`; process trace sources | `Meter`; `Metering Interface`; `metering-interface`; `metering`, `metering-substrate`, and `metering-interface` systems | [Metering and performance analysis](metering-and-performance-analysis.md) separates System 46 microcode counters and page tracing, LM-3 event metering, and Genera's substrate, compatibility layer, reports, and Dynamic Windows interface, with complete source-bounded controls and manual cross-checks. | `deep/existing; grouped; runtime-blocked` — Genera optional loading entered the unavailable `DIS-SYS-HOST` file-service path, and the System 303 `METR` runtime remains a named follow-up; no visible-state claim or screenshot is invented. |
| **D16 — Flavors, CLOS, and Flavor Examiner** | Flavors, classes, entities, and object-organization facilities | `Flavors`; `CLOS`; `Flavor Examiner`; `examiner`; `CLOS` and `Flavors` command areas | [Flavors, classes, CLOS, and the Flavor Examiner](flavors-clos-and-flavor-examiner.md) separates the object-system lineages, inventories every release-bounded inspection command/menu/gesture, records source-only defects, and verifies CADR, Flavor Examiner, and separate CLOS behavior with reviewed captures. | `deep/existing; grouped` — the dossier keeps CADR entities, Flavors, New Flavors, and CLOS distinct rather than implying one continuous class browser. |

## Files, media, services, and operations

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D17 — File systems, Dired-facing operations, and file service** | Generic file system; `QFILE`; `Local-File`; `LFS / LMFILE`; `File-Server`; `LMFILE-Server / LMFILE-Remote` | Host-file access; NFILE/File service; NFS client/server documentation; LMFS; File Server activity/program; `File`, `File System`, `Directory`, `NFS` command areas | [File systems and file service](file-systems-and-file-service.md) separates five architectural layers and audits every stated-grain pathname operation, server/protocol command, NFS procedure, direct Command Processor command, and File Server pane/private command. | `deep/existing; grouped; runtime-blocked` — static coverage is complete at the stated grain; configured peers, service state, and a File Server frame remain explicit runtime work, and the Open Genera NFS Server implementation is not present in the inspected distribution. |
| **D18 — Disk labels, packs, salvage, and file-system maintenance** | `DLEDIT`; disk pack examination; checkout; salvage; bad-pack repair | `FSEdit` / File System Maintenance; storage and file-system administration; LMFS-related maintenance | [MIT disk labels, packs, checkout, and file-system repair](mit-cadr/disk-labels-packs-and-file-system-repair.md) and [Genera FSEdit and File System Maintenance](genera/fsedit-and-file-system-maintenance.md) cover all release-bounded DLEDIT keys/templates, partition and checkout paths, LMFILE lifecycle, 20 FSEdit object commands, direct gestures, all 33 maintenance menu labels, Salvager options, source-only findings, and preservation practice. | `deep/existing; grouped; runtime-blocked` — source/manual/help coverage is complete at the stated grain; destructive operations remain deferred until hash-identified disposable media and non-production LMFS inputs exist, and Genera's main FSEdit implementation source is absent from the inspected subset. |
| **D19 — Tape systems and Tape Utility Frame** | `Tape`; `TFrame`; `TAPE-COMPAT`; `WESPERCO`; `TAPEMASTER`; `VMS-TAPE`; LMFL/TAR/TANALYZ paths | `Tape`; `FEP-Tape`; remote tape; TAR tapes; `Tape Administration` command area | [Tape systems and the Tape Utility Frame](tape-systems-and-tape-utility-frame.md) separates the System 46 absence, later LMI System 303 stack, and Symbolics design; inventories every configured LM-3 format and user operation, all TFrame modes/commands/options, Genera stream messages and format tools, and all 15 live Tape Administration commands. | `deep/existing; grouped; runtime-blocked` — static and command-table coverage is complete at the stated grain. The VLM has no established local tape device, FEP-Tape is unavailable in this exact world, no remote server is configured, and physical LM-3 controllers are absent; no media-changing operation was attempted. |
| **D20 — Site data and Namespace administration** | login/site/host tables; `SITE`; `Site Data Editor` / `SITE-EDITOR` | Namespace database; `Namespace Editor`; `namespace-editor`; site configuration; `Namespace` and `Site Administration` command areas | [CADR site data, login, and Site Editor](mit-cadr/site-data-login-and-site-editor.md) and [Genera Namespace administration and editor](genera/namespace-administration-and-editor.md) give the release-bounded table/object models, complete editor commands, keys, gestures and fields, persistence workflows, source/manual gaps, and safe runtime result. | `deep/existing; grouped` — the licensed run verifies the exact empty frame and 13-command menu with one reviewed screenshot; configured object/server mutation remains intentionally deferred. The later LMI/Gigamos Site Data Editor is explicitly not attributed to MIT System 303. |
| **D21 — Background services and operations dashboards** | file-server processes; auxiliary service controls; no separately cataloged unified dashboard | `Mailer`; `Mailer Operations / Mailer Log`; `mailer-log-program`; `Print Spooler Log`; `print-spooler-log-program`; `Domain Server Log`; `domain-server-log-program`; File Server program; `Mailer`, `Printer Maintenance`, and administration command areas | [Background services and operations dashboards](background-services-and-operations-dashboards.md) inventories the CADR process/recovery surfaces and every stated-grain Genera pane, direct private command, Select key, worker/task state, shared log behavior, and directly relevant Mailer/Printer command. | `deep/existing; grouped; runtime-blocked` — source/manual/Help coverage is complete at the stated grain; safe live service frames need a disposable synthetic site because the preserved Genera world has servers disabled. |
| **D22 — Lisp runtime, compiler, and development environment** | reader, evaluator, printer, storage, processes, resources, compiler, optimizer, LAP, file compiler, disassembler, packages, `DEFSTRUCT`, `SETF`, `LOOP`, Common Lisp compatibility | Common Lisp/ZetaLisp, Lisp compiler, Common Lisp Developer, development commands/utilities, packages and conditions; `Programming Tools` command area | [Lisp runtime, compiler, and development environment](lisp-runtime-compiler-and-development-environment.md) inventories the named runtime and compiler layers, complete directly relevant Command Processor surface, release boundaries, source-only behavior, and controlled interpreted-to-compiled comparisons on System 303 and Genera. | `deep/existing; grouped` — the dossier is complete at the named-subsystem and supported-workflow grain, including three capture-specific-reviewed runtime screens; file-compilation and source-navigation follow-ups remain explicitly bounded. |
| **D23 — Compiled objects, QFASL, relocation, and UNFASL** | QFASL loader/dumper; `QFASL-REL`; relocation; `UNFASL` | `L-BIN` compiled-function/system loading substrate and `UNBIN` | [Compiled objects, QFASL, relocation, and UNFASL](compiled-objects-qfasl-relocation-and-unfasl.md) inventories all 56 maintained QFASL slots, every System 46 slot change, the five-operation REL sublanguage, all 55 version-5 L-BIN definitions, both inspectors, load-time effects, recovery limits, artifact hashes, and a fresh System 303 entry-point check. | `deep/existing; grouped; runtime-blocked` — static coverage is complete at the stated grain. A configured pathname is still needed for a full on-machine UNFASL dump. `BIN`, Zmail `KBIN`, and `C+LISP-SUPPORT` are explicitly corrected as separate serialization, mail-store, and embedding/RPC systems routed to D22, D07, and D47. |
| **D24 — System construction, patches, worlds, bands, and distribution** | `Make-System`; patch manager; cold-load builder; bands; load/distribution media; `COLD`, `COLD-LOAD`, `INNER-SYSTEM`, `OUTER-SYSTEM`, and aggregates | System Construction Tool; patches; World Building; `Distribute Systems`/`distribution`/`small-distribution`; `Restore Distribution`/`restore`; system maintenance and delivery worlds | [System construction, patches, worlds, bands, and distribution](system-construction-patches-worlds-and-distribution.md) follows declared source through compilation/loading, patch systems, cold-load and band construction, Genera world building, delivery-world tooling, distribution, and restoration, with complete release-bounded interfaces and artifact identities. | `deep/existing; grouped; runtime-blocked` — source/manual coverage is complete at the stated lifecycle grain; mutation-heavy build, patch, band/world-save, distribution, and restore paths require disposable configured media before runtime exercise. |
| **D25 — Source comparison, Compare/Merge, and version control** | `Source Compare (SRCCOM)` / `SRCCOM` | `SRCCOM`; `compare-merge`; `version-control`; `version-control-doc`; editor integration | [Source comparison, Compare/Merge, and version control](source-comparison-compare-merge-and-version-control.md) inventories both SRCCOM implementations, all editor controls, Compare/Merge surfaces, Version Control commands, menu and bindings, VCI exports, source-only findings, and a live presence check. | `deep/existing; grouped; runtime-blocked` — the base world has SRCCOM and its Zmacs integration, while the release declaration reader-disables the four adjacent Compare/Merge and Version Control systems; the dossier never promotes media presence into live availability. |
| **D26 — Formatting, spelling, and text-production utilities** | `FORMAT`; `FQUERY`; Grind; `Ispell`; Dribble; Bolio/Text editing support | `Document Formatting`, `Fonts`, and `Spelling` command areas; `SPELL`; formatting and document commands | [Formatting, spelling, and text production utilities](formatting-spelling-and-text-production-utilities.md) inventories the three releases' formatting languages, query options, grinder registrations, transcript behavior, spelling workflows, Bolio/Sage pipelines, font/character-style commands, manual gaps, and a fresh System 303 load-band/source discrepancy probe. | `deep/existing; grouped` — complete at the stated directive, option, command-table, and basic Sage-palette grain; optional Ispell, Genera visual forms, and one indentation effect remain explicit targeted runtime follow-ups. |
| **D27 — Mathematical and numeric facilities** | `MATH`; matrix, rational, and infix support | `MATH`; Common Lisp numeric facilities | [Mathematical and numeric facilities on CADR and Genera](mathematical-and-numeric-facilities.md) inventories the complete eight-function matrix API, algorithms and release changes, rational/complex layers, public numeric families, both infix grammars, source/manual/Help contradictions, and controlled runtime results. | `deep/existing; grouped` — complete at the infrastructure/API/grammar grain; the preserved Genera exact-division anomaly is explicitly unresolved rather than promoted into a release-wide semantic claim. Macsyma remains D42. |

## User-interface, graphics, and document production

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D28 — Dynamic Windows and presentation-based interaction** | TV frames, menus, mouse-sensitive items, and choices as historical antecedents | `Dynamic Windows`; program frameworks; command tables; panes; presentations; redisplay; input contexts; `Presentation` command area; internal `accept-values`, `menu-program`, `undo-program`, `reorder-sequence`, and `alter-sequences` | [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md) separates CADR TV antecedents from the Genera substrate, inventories the five-layer system graph, type/handler/command/redisplay interfaces, six pane types, and every directly interactive control of the bundled generic programs, with reviewed live Presentation Inspector, Frame-Up, and standalone Accepting Values evidence. | `deep/existing; grouped` — complete at the substrate, public-interface, and bundled-generic-program grain; optional branching undo and dedicated researcher-owned sequence-program probes remain explicitly bounded. |
| **D29 — CLIM 2 on Genera** | No bounded CADR counterpart in these catalogs | `CLIM`; `CLIM-Doc`; `genera-clim`; `clx-clim`; `postscript-clim`; CLX and PostScript ports | [CLIM 2 on Symbolics Genera](clim-2-on-genera.md) inventories the portable utility/Silica/standalone graph, all 125 core and port binary modules, complete facility families, Genera integration and limitations, 36 input-editor commands plus universal gestures, release changes, patch/source boundaries, Help metadata, and fresh load-state evidence. | `deep/existing; runtime-blocked` — the base world has no CLIM system registration, package, or feature, and the isolated site has no guest file service for optional loading. D59 covers the demonstrations separately. |
| **D30 — FED and the Font Editor generations** | `FED`; `XFED`; font utilities and metrics | `FED`; `Font Editor`; `font-editor`; font-support systems | [FED and the Font Editor generations](fed-and-font-editor-generations.md) distinguishes old-window FED, exact XFED deltas, new-window/NFED lineage, maintained System 303 FED, Genera's Bitmap Editor-based Font Editor, and the unresolved legacy Genera FED, with complete controls, formats, source findings, and asset cross-links. | `deep/existing; grouped; runtime-blocked` — neither optional CADR FED nor Genera Font Editor is loaded in the preserved worlds, and the file-service boundary prevents honest optional loading; no error/listener screenshot is substituted for an editor frame. |
| **D31 — Bitmap, stipple, and raster paint editors** | `Paint / NPaint`; brushes, patterns, selection, text, and raster save/restore | `Bitmap Editor`; `standalone-bitmap-editor`; `Stipple Editor`; `bitmap-editor`; `stipple-editor` | [Bitmap, stipple, and raster paint editors](bitmap-stipple-and-raster-paint-editors.md) inventories the complete CADR PAINT/NPAINT and Genera Bitmap/Stipple Editor surfaces, architectures, raster/register semantics, file/object workflows, source defects, manual discrepancies, and preservation boundaries. | `deep/existing; grouped; runtime-blocked` — the CADR base band has no callable PAINT and cannot load retained NPAINT through the current file-service path; a Genera editor frame remains a targeted fresh-session follow-up. |
| **D32 — Graphic Editor and structured drawing** | Drawing primitives and DPLT output, but no established full SUDS editor | `Graphic Editor`; `graphic-editor`; `graphic-editing`; `graphics-support`; `GRED-DOC`; `graphics-toolkit` | [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md) inventories all 16 entity types, 13 transforms, 63 active commands, gestures, parameters, representations, integrations, source/help discrepancies, and the CADR/SUDS evidence boundary. | `deep/existing; runtime-blocked` — the fresh world lacked the optional packages and an isolated guest media path for loading them, so no editor frame or screenshot is claimed. |
| **D33 — Color systems and Color Editor** | optional `Color`; indexed color maps; `COLORHACK`, `COLXOR`, and `CAFE` experiments | `Color`; `Color Editor`; `color-editor`; `color-doc`; Ivory color support | [Color systems, the Genera Color Editor, and CADR color experiments](color-systems-and-color-editor.md) covers indexed/direct architecture, every Color Editor and Palette control, models, palette representation, the CADR substrate, each named experiment, source/manual gaps, and exact runtime evidence; [CADR color inks](mit-cadr/color-inks-and-raster-patterns.md) remains the focused ink study. | `deep/existing; grouped; runtime-blocked` — the base world had no registered Color screen or resident editor and the isolated guest could not reach the optional system files; host X depth is explicitly not treated as a color-workstation result. |
| **D34 — Images, drawing primitives, and preserved visual assets** | BITBLT graphics, image manipulation, `PICT`, `SCAN`, SUDS `.DRW`/`.PLT`, graphical fonts and sprites | image substrates, `images`, `framethrower`, `framethrower-xl-interface`, BITBLT and compression support | [Images, drawing primitives, and visual-asset substrates](images-drawing-and-visual-asset-substrates.md) gives the complete Genera layer/API/UI/format/hardware and installed-asset audit while linking the focused [public CADR visual-assets inventory](mit-cadr/visual-assets-inventory.md). | `deep/existing; grouped; runtime-blocked` — the Genera world had only Compression loaded; image systems and FrameThrower were absent and the historical XL hardware unavailable. The article keeps asset files subordinate to the architecture instead of inventing applications. |
| **D35 — Hardcopy, Press, printing, and plot output** | Hardcopy dispatcher; `PRESS`; `XGP`; `DPLT`; `Versatec`; screen-copy paths | `Hardcopy`; System Menu `Hardcopy`; `Print`; printer queues; PostScript/`ps`; spooler; `Printer` and `Printer Maintenance` command areas | [Hardcopy, Press, printing, and plot output](hardcopy-press-printing-and-plot-output.md) gives complete CADR/LM-3 APIs and formats, Genera registries, file/screen forms, client/queue/maintenance commands, spooler architecture, delivery and PostScript paths, source-only findings, and fresh read-only form evidence. | `deep/existing; grouped; runtime-blocked` — no default printer or historical hardware/service was available, so physical output and interoperability remain explicit TODOs; no request was submitted. |
| **D36 — Concordia structured authoring** | No System 46 implementation; LM-3 records name Basic Sage and Writer Tools but no corresponding public source survives in the pinned manifest | `Concordia`; `Page Previewer`; `page-previewer`; `Book Design Browser`; `book-design-browser`; `SGD-Book-Design`; NSage records, markup, indexing, preview, and publication | [Concordia, structured documentation, and book design](concordia-document-and-book-design.md) covers the record model and `.sab` format, structural editor, all 74 Concordia commands, 26 Page Previewer commands, 11 Book Design Browser commands, inheritance, integrations, source/manual gaps, preservation, and fresh load-state evidence. | `deep/existing; grouped; runtime-blocked` — NSage remained resident, but the three optional application configurations and Writer Tools command table were absent; no optional load was attempted. |

## Languages, knowledge systems, and optional products

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D37 — Symbolics C, FORTRAN, and Pascal environments** | PL/I, TECO, MIDAS, and Macsyma editor modes are mode evidence only, not installed language products | Symbolics C (`c`, `c-documentation`, `c-library-headers`, `c-packages`, `c-runtime`); FORTRAN (`fortran`, `fortran-doc`, `fortran-package`, `fortran-runtime`); Pascal (`pascal`, `pascal-doc`, `pascal-package`, `pascal-runtime`) | [Symbolics C, FORTRAN, and Pascal environments](symbolics-c-fortran-and-pascal-environments.md) gives each product compiler/runtime, files, complete recovered language-specific Zmacs and command interfaces, listener/debugger/build workflow, libraries, execution model, Lisp interoperation, discrepancies, provenance, and bounded CADR/LM-3 comparison. | `deep/existing; grouped; runtime-blocked` — the base world had none of the `C-SYSTEM`, `F77`, or `PASCAL` packages; visible modes, listeners, debugger surfaces, and effective loaded tables remain explicit TODOs. |
| **D38 — Compiler Tools, grammar, lexer, and syntax systems** | Compiler and editor-mode infrastructure only | Compiler Tools (`compiler-tools-*`/`cts-*`); context-free grammar (`context-free-grammar`, `cfg` and packages); `lalr-1`; `ll-1`; lexer package/run-times; syntax-editor run-time/support | [Compiler Tools, grammars, lexers, and the Syntax Editor](compiler-tools-grammar-lexer-and-syntax-editor.md) reconstructs every declared layer, compiler/debugger architecture, parser and lexer model, incremental buffer structures, serialization boundary, complete common keys/commands, source-only findings, and fresh load-state probe. | `deep/existing; grouped; runtime-blocked` — all thirteen media systems and the `CTS`/`GRAMMAR`/`LEXER` packages were absent from the base world; optional loading was deliberately not attempted. |
| **D39 — Conversion Tools** | No counterpart | `Conversion-Tools`; ZetaLisp-to-Common-Lisp, Flavors-to-CLOS, Symbolics-Common-Lisp-to-portable-Common-Lisp, Dynamic-Windows-to-CLIM, and CLIM-version converters | [Conversion Tools and source migration on Symbolics Genera](conversion-tools-and-source-migration.md) inventories the structured editor architecture, all 14 commands and query controls, every readable VLM conversion set, mapping censuses, preservation behavior, manual/source discrepancies, and fresh runtime evidence. | `deep/existing; runtime-blocked` — version 436 media is present, but the fresh world contained only an unloaded package shell; no optional load or decorative Listener screenshot was substituted for converter behavior. |
| **D40 — Joshua rule and inference environment** | System 46 AMORD/LMTMS bug evidence and maintained LM-3 `site/amord.system`; bounded lineage witnesses, not the exact Joshua 237 implementation | `Joshua`; `joshua-doc`; `joshua-metering`; `js`; `jd`; Jericho integration; rule language, object facility, TMS, and examples | [Joshua rule and inference environment](joshua-rule-and-inference-environment.md) reconstructs the layered product, Protocol of Inference, discrimination/unification path, forward RETE and backward rules, questions, TMS/LTMS, objects, tracing, metering, complete 19-command and 23-translator surfaces, Zmacs support, Jericho boundaries, source findings, provenance, and fresh load-state probe. | `deep/existing; grouped; runtime-blocked` — the fresh base world had none of six Joshua-related packages and did not know the system; no optional load or generic Listener screenshot substitutes for the still-TODO effective command tables, inference run, editors, metering views, or representative application capture. D60 retains example-by-example behavior. |
| **D41 — Statice persistent object system** | No bounded counterpart | `Statice`; `statice-runtime`; `statice-server`; `statice-documentation`/`statice-doc`; `Statice Browser`; `statice-browser`; B-tree support | [Statice persistent object and database environment](statice-persistent-object-and-database-environment.md) reconstructs the development, run-time, server, Browser, documentation, DBFS/B*-tree storage, transaction, recovery, backup, Command Processor, maintenance, and preservation surfaces, with public-manual, licensed-source, Help, bounded CADR/LM-3, and fresh base-world load-state evidence. | `deep/existing; grouped; runtime-blocked` — all six probed Statice/DBFS packages and all seven loaded-only Statice/DBFS/BTree systems were absent from the base world; no optional load or database mutation was attempted, so Browser and maintenance screenshots remain explicit TODOs pending a disposable, rights-clear DBFS test database. |
| **D42 — Macsyma 421** | Public System 46 port documentation and editor integration plus LM-3 world/bug/patch evidence; product implementation absent from both pinned public trees | `Macsyma`; algebra, analysis, integration, plotting, simplification, solving, translation, standalone Help database, Genera frame, and expression editors | [Macsyma 421 on Lisp machines](macsyma-421-symbolic-mathematics-environment.md) reconstructs the 167-component system, complete 69-command/49-panel menu hierarchy, expression gestures, mathematical families, plotting, 2,510-topic Help database, MEDIT, Display Editor, Zmacs integration, public lineage, artifact provenance, and fresh base-world probe. | `deep/existing; runtime-blocked` — licensed contributed 421 media is present, but the clean world had no Macsyma/Climax packages or registered system. The effective Display Editor keymap and visible application states remain explicit installed-product TODOs. |
| **D43 — NS electronic-design family** | SUDS drawing/plot artifacts and CADR hardware drawings, but no complete runnable SUDS editor | `basic-ns`; `gate-array-ns`; `pcb-ns`; `schematic-ns`; `vlsi-ns`; schematic, PCB, simulation, and VLSI modules | [The NS electronic-design family](ns-electronic-design-family.md) reconstructs the shared object/frame model, all 104 NS commands, all 29 menu actions, every compiled gesture table, schematic/RSIM/timing, gate-array, PCB interchange, VLSI physical design, workflows, formats, source/paper discrepancies, and the CADR/LM-3 boundary. | `deep/existing; grouped; runtime-blocked` — licensed release-36 media is present, but the fresh registration probe failed before VLM execution; no optional load, password bypass, or decorative Listener screenshot was attempted, so loaded behavior and screenshots remain explicit TODOs. |
| **D44 — CLOE development and runtime environment** | No counterpart | CLOE Developer, installation/migration, Intel PC Runtime/Application Generator, DOS/Windows CLIM and Window Front End, Listener/debugger, files, bindings, and historical Unix/UI/window-demo records | [CLOE development and runtime environment](cloe-development-and-runtime-environment.md) reconstructs all 61 documentation records, all 29 CLOE-specific and 36 generic CLIM input-editor actions, the Genera-to-PC workflow, and exact media/base-world absence evidence. | `deep/existing; grouped; runtime-blocked` — no product source, declaration, runtime, PC payload, or representative screen is preserved; compatibility references and generic CLIM demos do not substitute for CLOE. |

## Networking and host integration

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D45 — Network transports and protocol architecture** | `Chaosnet`; `Ethernet`; ARP; EFTP; QFILE transport; routing/path diagnostics | Chaosnet/DNA support; `IP-TCP`; TCP; IP applications; NFS transport; `Networks` command area | [Network transports and protocol architecture](network-transports-and-protocol-architecture.md) supplies the three-generation packet/service model, complete operator command and route/controller surface at its stated grain, source/manual/runtime differences, and isolated-world boundary. | `deep/existing; grouped; runtime-blocked` — source and command coverage is complete at the stated grain; a deterministic local peer is still needed for substantive CADR and Genera network-state captures, and no configured-site state is inferred. |
| **D46 — Network services and site utilities** | EFTP; Finger/Name, time/uptime, dummy mail, remote disk, Babel, Telnet, evaluation, notification servers; `HOSTAT`, `WHOIS`; `CALL-ELEVATOR`, `BUZZ-DOOR`, `HACK-DOOR`; `CHATST` | FTP server; domain-name server; TCP diagnostics; File/NFS services; Finger example; network applications; server utilities | [Network services and site utilities](network-services-and-site-utilities.md) inventories every release-bounded CADR service, exact live System 303 registry and defaults, MIT-local building/site clients, Genera server policy, Finger/Show Users, all 31 FTP commands, TFTP, DNS, TCP diagnostics, and two controlled runtime probes. | `deep/existing; grouped; runtime-blocked` — the isolated worlds establish registration and enablement state, not configured peers; optional DNS/example Finger, physical controls, destructive services, and real network interoperability remain deliberately unrun. Hardware board testing remains D51. |
| **D47 — RPC, embedding, UX, and Macintosh integration** | `UNIX / Unix-Interface` declaration with missing `LAMTTY`, `SHARE-CHAOS`, and `IOMSG` implementation | `RPC`; `RPC-Development`; Embedding Support; UX Support/Development; MacIvory Support/Development; `Keyboard Control`; HyperCard-MacIvory; Mac-Dex; DBFS Utilities | [RPC, embedding, UX, and Macintosh integration](rpc-embedding-ux-and-macintosh-integration.md) reconstructs the layered call/data/transport architecture; all 192 RPC and 161 Mac Toolbox exports; network defaults and user properties; the complete UX, remote-program, Mac Genera, Keyboard Control, HyperCard, Mac-Dex, and DBFS operator surfaces; public CADR/LM-3 boundaries; licensed artifact provenance; and a fresh isolated runtime probe. | `deep/new; grouped; runtime-blocked` — the clean VLM's keyboard layout type was `NIL`, so the source-defined activity predicate rejected Keyboard Control; separate MacIvory systems are excluded from the VLM release, HyperCard/Mac-Dex media and the System 303 UNIX implementation are absent, and their visible states remain exact screenshot/source TODOs rather than inferred behavior. |
| **D48 — CLX, remote X screens, and X server facilities** | No native X counterpart established in the bounded catalog | `CLX`; `X-Remote-Screen`; `X-Documentation`; historical `X-Server`; Genera CLX implementation; `CLX-CLIM` | [CLX, remote X screens, and X server facilities on Genera](clx-remote-x-screens-and-x-server-facilities.md) separates the client, server, documentation, CLIM-port, VLM-console-channel, and host-Xvfb layers; inventories all direct controls, portable special-key mappings, registered keyboard families, X resources/defaults, 15 CLX facility families and 559 exports; and records the XDMCP, font, release, platform, rights, and source-generation boundaries. | `deep/new; grouped; runtime-blocked` — the current isolated launcher fails before the VLM, while the historical X Server is restricted to non-embedded hardware and is absent from the inspected Open Genera media. |
| **D49 — CL-HTTP and contributed web systems** | No counterpart | `cl-http`; `http-base-client`; `http-client-substrate`; `http-proxy`; `w3p`; `w4`; `lambda-ir`; `showable-procedures`/`showproc`; `btree`; bundled example applications | [CL-HTTP and the contributed Web systems in Open Genera](cl-http-and-contributed-web-systems.md) inventories the server/client/proxy architecture, complete direct controls, W3P types, W4 constraints/actions, Lambda IR, Showable Procedures/Btree, every bundled example, security findings, and exact runtime-absence evidence. | `deep/new; grouped; runtime-blocked` — all nine systems were absent from the isolated base world; meaningful runtime verification requires deliberate loading and a loopback-only fixture without the unsafe aggregate exports. |

## Machine engineering and implementation substrate

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D50 — CADR microcode, microassembler, and console debugger** | `CADR`; `CADR-MICRO-ASSEMBLER`; `UCODE`; CADR console debugger / `CADR-DEBUGGER`; DDT-like control, symbols, crash analysis | Ivory compiler/linker and architecture systems are not direct counterparts | [CADR microcode, microassembler, and console debugger](mit-cadr/cadr-microcode-microassembler-and-console-debugger.md) gives the complete 23-module UCODE build, two-pass assembler language and artifact pipeline, incremental module operations, all direct controls, format modes, register spaces, and 44 System 303 colon commands, with System 46 differences and source-only findings. | `deep/existing; grouped; runtime-blocked` — CC requires and mutates a separate debuggee through a hardware/debug transport; the one-machine harness is not a substitute, so a disposable two-instance fixture and reviewed screenshot remain explicit TODOs. |
| **D51 — CADR diagnostics, checkout, and hardware tools** | diagnostic monitor; `CCWHY`; disk checkout; PROM programmer; continuity tester `CTEST`; probe drive; Chaos board tester `CHATST`; 8748/8751 assemblers; device drivers | hardware diagnostics and platform-support systems only as comparison | [CADR diagnostics, checkout, and hardware tools](mit-cadr/cadr-diagnostics-checkout-and-hardware-tools.md) inventories the ordered machine and memory tests, exact seven-stage disk checkout, PROM workflow and file form, both embedded-controller assembler languages, continuity planning, every manual probe control, Chaos-board test families, and low-level transport boundary. | `deep/existing; grouped; runtime-blocked` — source coverage is complete at the stated grain, but a separate debuggee, scratch disk, PROM programmer, calibrated probe fixture, and isolated Chaos board are required for meaningful runtime evidence; a decorative Listener capture is deliberately not substituted. |
| **D52 — Ivory, FEP, and Open Genera/VLM implementation layers** | CADR comparison only | `I-ARCHITECTURE`; `I-LINKER`; `I-LISP-COMPILER`; FEP file system; bus access; netboot; keyboard; embedding; compression/encryption; VLM host relationship | [Ivory, FEP, and Open Genera VLM implementation layers](ivory-fep-and-open-genera-vlm-implementation-layers.md) provides the complete physical FEP, IFEP/VLM Debugger, host configuration, architecture, platform-condition, safety, provenance, and runtime audit. | `deep/new; grouped; runtime-blocked` — the pause path and implementation systems were verified, but the current harness cannot explicitly select the Cold Load window for safe debugger interaction and screenshot review. |

## Demonstrations, games, and examples

| ID and canonical dossier | MIT CADR / LM-3 catalog entries covered | Genera 8.5 catalog entries covered | Existing depth | Status and rationale |
| --- | --- | --- | --- | --- |
| **D53 — MUNCH and Munching Squares** | `MUNCH`; `Munching Squares`; switch-register controls | `MUNCHING-SQUARES` HACKS descriptor | [MUNCH article](mit-cadr/munch.md) | `deep/existing; runtime-blocked` — source, purpose, controls, and lineage are deep; runtime comparison and reviewed screenshot remain explicit open work. |
| **D54 — LEXIPHAGE** | `LEXIPHAGE`; System 46, LM-3, and PDP-10 source forms | `LEXIPHAGE` HACKS descriptor | [LEXIPHAGE article](mit-cadr/lexiphage.md) | `deep/existing; runtime-blocked` — implementation and attribution are deep; the exact runtime comparison is not yet performed. |
| **D55 — Spacewar** | `Spacewar`; System-key `W`; ship sprites | No exact catalog counterpart | [Spacewar on the MIT Lisp Machine](mit-cadr/spacewar-on-the-lisp-machine.md) gives every control and tunable parameter, the simulation and sprite-font architecture, System 46-to-303 changes, source-only findings, exact artifact provenance, and a reviewed live playfield capture. | `deep/new` — the public maintained source and `SHIP` QFASL were loaded through the isolated FILE bridge and the live game was entered; individual thrust, turn, fire, and hyperspace controls remain explicit runtime TODOs rather than blocking the application dossier. |
| **D56 — Doctor conversational program** | `DOCTOR`; `DOCSCR` support data | No exact catalog counterpart | [DOCTOR, the ELIZA-style conversational program](mit-cadr/doctor.md) reconstructs the engine, executable rule corpus, matcher, reassembly rotation, memory path, complete controls, Multics/System 46/System 303 lineage, source defects, and exact artifact provenance, then verifies a synthetic conversation and the maintained `10-4` regression with a reviewed screenshot. | `deep/new; grouped` — `DOCSCR` is correctly retained as Doctor's separately loaded knowledge payload rather than promoted to an independent application. |
| **D57 — CADR HACKS, display, sound, and novelty suite** | `HAKDEF`; `ABACUS`; `ALARM`; `BEEPS`; `CROCK`; `DC`; `DEUTSC`; `DLWHAK`; `GEB`; `HCEDIT`; `OHACKS`; `ORGAN`; `QIX`; `ROTATE`; `ROTCIR`; `WORM`; `WORM-TRAILS`; plus extra `CAFE`, `COLORHACK`, `COLXOR`, `CRAZE`, `FREDKIN`, `LISS`, `PFOM`, `TREEDV`, `VOTRAX`, `WHAT`, and support `WORDS`, `TVBGAR`, `WORMCH` | Directly related later demo names can be compared in D58 | [CADR HACKS, display, sound, and novelty programs](mit-cadr/cadr-hacks-display-sound-and-novelty-suite.md) gives every named member a separate purpose, implementation, control, dependency, asset, safety, and lineage section; audits the complete menu/support boundary; and adds a reviewed live QIX observation. | `deep/new; grouped; runtime-blocked` — public QIX now verifies the representative monochrome draw/stop path, while color hardware, sound/speech capture, printers, missing image data, configured services, and other member-specific fixtures remain explicit blockers rather than being generalized from QIX. |
| **D58 — Genera HACKS demonstration suite** | Historical counterparts through D53, D54, and D57 | Exact descriptors `ABACUS`, `BIRDS`, `CROCK`, `DIGITAL-CROCK`, `ESCHER`, `GODEL`, `HACKS`, `HOLLERITH-EDITOR`, `LEXIPHAGE`, `LIFE`, `MUNCHING-SQUARES`, `MUNCHING-TUNES`, `QIX`, `ROTATE`, `SPLINES`, `TV-BUG`, `WORM`, `ZOWIE` | [The Genera HACKS demonstration suite](genera/genera-hacks-demonstration-suite.md) documents all 18 exact descriptors, complete direct controls and options at the stated grain, implementation and lineage boundaries, source-only findings, HACKS 440 provenance, and a fresh isolated runtime probe. | `deep/new; grouped; runtime-blocked` — the fresh base world had no loaded HACKS system or demonstration definitions and the default `SYS:SITE` descriptor path reached an unconfigured-site login; every implementation is source/descriptor-grounded, but representative application screenshots remain blocked pending a minimal isolated licensed-media path. |
| **D59 — CLIM demonstrations and tutorial** | No counterpart | `address-book`; CLIM `bitmap-editor`; `browser`; `cad-demo`; `color-chooser`; `demo-app`; `flight-planner`; `graphics-demo`; `graphics-editor`; `ico-frame`; `lisp-listener`; `peek-frame`; `plot-demo`; `puzzle`; `scigraph`; `thinkadot`; `fifteen-puzzle-1` through `fifteen-puzzle-5`; `lsq`; Tic-Tac-Toe; `clim-tests` | [CLIM 2 demonstrations and tutorial programs on Genera](clim-demonstrations-and-tutorial.md) gives all 24 canonical programs separate architecture, complete command/gesture, dependency, data/format, safety, source/manual-discrepancy, and screenshot-boundary sections; it also audits all 17 chooser registrations, five puzzle stages, both LSQ stages, 69 active Genera tests, and 39 benchmarks. | `deep/new; grouped; runtime-blocked` — the isolated base world has no CLIM package, feature, or system, so every application screenshot remains an explicit optional-load TODO; `selected-object-mixin` and the computed Conversion Tools frame stay correctly classified as support rather than applications. |
| **D60 — Product and programming examples** | Incidental source demonstrations not promoted from personal files | Core Genera examples; Joshua frames `cryptarithmetic`, `DIAL-DEMO`, `ht-demo`, `modelling-tutor`, `blocks-demo`, `jericho-demo-suite`, `n-queens`, `widgetsim`; Statice `books`; `employee-editor`; `avv-pane-test`; `accept-two`; `calculator`; `life`; CL-HTTP, Color, and product examples | [Product and programming examples in Genera](product-and-programming-examples.md) audits every file in the five bounded example collections, gives all 14 concrete example frameworks separate purpose, architecture, control, dependency, and source-finding sections, accounts for every Color registration and CL-HTTP example, and distinguishes applications, tutorials, tests, support, and site templates. | `deep/new; grouped; runtime-blocked` — the core examples system is distribution-only in this media, Joshua, Statice, and CL-HTTP are absent from the fresh world, and no Color screen is registered; representative runtime captures therefore remain deliberate private-load or fixture TODOs rather than inferred behavior. |

## Reconciliation with the exhaustive catalog censuses

The dossier matrix is intentionally coarser than system registries. These tables make
the compression auditable: every exact census family maps to one or more dossier IDs,
including low-level entries that do not merit their own visible-application article.

### All 55 maintained CADR `DEFSYSTEM` names

| Exact catalog family and names | Dossier coverage |
| --- | --- |
| Aggregates/build: `SYSTEM`, `SYSTEM-INTERNALS`, `SYSTEM-MACROS`, `COLD`, `COLD-LOAD`, `INNER-SYSTEM`, `OUTER-SYSTEM`, `OPTIONAL-SYSTEM` | D22 and D24; aggregates are build boundaries, not eight applications. |
| Runtime: `FONTS`, `FORMAT`, `COMPILER`, `QFASL-REL`, `TIME`, `MATH`, `GARBAGE-COLLECTOR` | D22, D23, D26, D27, and D30; `TIME` and garbage collection remain core runtime sections. |
| UI/applications: `TV`, `ZWEI`, `ZMAIL`, `EH`, `PEEK`, `FED`, `HACKS`, `CONVERSE`, `ISPELL`, `COLOR` | D02, D05, D08, D09, D12, D14, D26, D30, D33, and D57. |
| Files/storage/tape: `FILE-SYSTEM`, `FILE-SYSTEM-UTILITIES`, `LOCAL-FILE`, `FILE-SERVER`, `LFS`, `LMFILE-SERVER`, `LMFILE-REMOTE`, `TAPE`, `TFRAME`, `TAPE-COMPAT`, `WESPERCO`, `TAPEMASTER`, `VMS-TAPE` | D17, D18, and D19. |
| Network/site: `CHAOS`, `ETHERNET`, `SITE`, `SITE-EDITOR`, `SUPDUP`, `UNIX`, `MIT-SPECIFIC` | D10, D20, D45, D46, and D47. `MIT-SPECIFIC` is a portability boundary, not an application. |
| Output/development: `PRESS`, `FONT-UTILITIES`, `SRCCOM`, `METER` | D15, D25, D30, and D35. |
| CADR engineering: `CADR`, `CADR-DEBUGGER`, `CADR-MICRO-ASSEMBLER`, `UCODE` | D50 and D51. |
| External declarations: `AMORD`, `SPICE-PLOT` | No implementation is present. They are retained as unresolved leads under D40/D43 where relevant and the exclusion rule below; no behavioral dossier can yet be completed. |

The separately registered external paths `ARLO`, `ARLOX`, `Daedalus`, `nodes`,
`RLL`, and `YAPS`, and the commented candidates `TIGER`, `KERMIT`, `WINDOW-MAKER`,
`OBJECTLISP`, `MEDIUM-RESOLUTION-COLOR`, `GATEWAY`, and `LAMBDA-DIAG`, remain
research leads rather than canonical dossiers because the bounded catalogs establish
neither complete implementation nor installed program identity.

All 34 canonical System 303 `demo/*.lisp` files are also assigned. Active components
`HAKDEF`, `ABACUS`, `ALARM`, `BEEPS`, `CROCK`, `DC`, `DEUTSC`, `DLWHAK`, `GEB`,
`HCEDIT`, `OHACKS`, `ORGAN`, `QIX`, `ROTATE`, `ROTCIR`, `WORM`, and `WORM-TRAILS`
go to D57; `MUNCH` goes to D53; and `DOCTOR` plus its `DOCSCR` data go to D56.
Among the 14 non-component files, `CAFE`, `COLORHACK`, `COLXOR`, `CRAZE`,
`FREDKIN`, `LISS`, `PFOM`, `TREEDV`, `VOTRAX`, `WHAT`, and support data `WORDS` go
to D57; engineering program `CTEST` goes to D51; raster editor `NPAINT` goes to D31;
and output utility `VERSAT` goes to D35. This assignment preserves the catalog's
loaded-component distinction rather than treating directory membership as a demo
registration.

Across D53, D54, and D57, the exact source-registered menu entries remain separately
reviewable:
`Abacus`, `Beep Hacks`, `Crock`, `Digital Crock`, `Splines`, `TV bug`, `Godel`,
`Escher`, `Birds`, `Atan`, `Hollerith Editor`, `Multiple Hollerith Editor`,
`Munching Squares`, `Munching Tunes`, `Live Bounce`, `Lexiphage`, `Qix`, `Rotate`,
`Life`, `Rotating Circles`, `Worm`, and `Worm-Trails`. `Quit` is registry control
rather than a demo; Munching Squares and Lexiphage receive D53 and D54; Doctor and Organ are callable
top levels even though their active modules do not call `DEFDEMO`.

### Genera release, site, and system-directory names

| Exact catalog family and names | Dossier coverage |
| --- | --- |
| Base/runtime/editor: `system`, `clos`, `cl-developer`, `development-utilities`, `doc`, `extended-help`, `nsage`, `old-tv`, `utilities`, `zwei`, `zmail`, plus release names `System`, `CLOS`, `Development-Utilities`, `Zwei`, `Utilities`, `Zmail`, `NSage`, `Extended-Help`, `CL-Developer`, `DOC` | D01, D02, D05, D07, D08, D16, D22, and D28. Names with case differences are system identifiers, not separate products. |
| General/compatibility: `examples`, `genera-extensions`/`genex`, `lock-simple` | D22, D25, and D60; libraries/examples do not become standalone applications. |
| Foreign languages: `c`, `c-documentation`, `c-library-headers`, `c-packages`, `c-runtime`, `fortran`, `fortran-doc`, `fortran-package`, `fortran-runtime`, `pascal`, `pascal-doc`, `pascal-package`, `pascal-runtime` | D37. |
| Compiler/language tools: `compiler-tools-debugger`, `compiler-tools-development`, `compiler-tools-package`, `compiler-tools-runtime`, `cts-debugger`, `cts-development`, `cts-package`, `cts-runtime`, `context-free-grammar`, `context-free-grammar-package`, `cfg`, `cfg-package`, `lalr-1`, `ll-1`, `lexer-package`, `lexer-runtime`, `minimal-lexer-runtime`, `syntax-editor-runtime`, `syntax-editor-support`, `syntax-ed-runtime`, `syntax-ed-support` | D38. The site-to-directory pairs are aliases. |
| UI/CLIM/image: `clim`, `clim-doc`, `clim-demo`, `genera-clim`, `clx-clim`, `postscript-clim`, `essential-image-substrate`, `image-substrate`, `images`, `framethrower`, `framethrower-xl-interface`, `graphics-toolkit`, `support`/`graphics-support` | D28, D29, D34, and D59. |
| Editors/graphics/color: `bitmap-editor`, `color`, `color-doc`, `color-editor`, `graphic-editing`, `graphic-editor`, `gred-doc` | D30 through D33. |
| Hardcopy/PostScript: `hardcopy`, `postscript`, `ps` | D35. |
| Concordia: `concordia`, `concordia-doc`, `sgd-book-design` | D36. |
| Joshua/Jericho: `joshua`/`js`, `joshua-doc`/`jd`, `joshua-metering`, `jericho`/`je` | D40 and D60. |
| Statice/B-tree: `btree`, `statice`, `statice-browser`, `statice-documentation`/`statice-doc`, `statice-runtime`, `statice-server` | D41. |
| Mathematics/electronics: `macsyma`, `basic-ns`, `gate-array-ns`, `pcb-ns`, `schematic-ns`, `vlsi-ns` | D42 and D43. |
| HTTP: `cl-http`, `http-base-client`, `http-client-substrate`, `http-proxy`, `lambda-ir`, `showable-procedures`/`showproc`, `w3p`, `w4` | D49. |
| Mail/network/services: `domain-name-server`/`ipds`, `mailer`/`ml`, `ip-tcp`, `ip-tcp-doc`, `nfs-client`, `nfs-documentation`, `server-utilities`/`su`, `tape` | D08, D17, D19, D21, D45, and D46. |
| Host integration: `embedding-support`, `rpc`, `rpc-development`, `ux-support`, `ux-development`, `macivory-support` | D47. |
| X: `clx`, `x-documentation`, `x-remote-screen` | D48. |
| Metering: `metering`, `metering-substrate`, `metering-interface` | D15. |
| Versioning/conversion: `compare-merge`, `version-control`, `version-control-doc`, `conversion-tools` | D25 and D39. |
| Demonstrations: `hacks`, `demos` | D58 through D60. |

This accounts for all 133 identifiers in the site/system-directory union. The VLM
release-only conditions also map cleanly: `RPC`, `Embedding-Support`, `UX-Support`,
`RPC-Development`, `UX-Development` go to D47; `Hardcopy` to D35; `Tape` to D19;
`IP-TCP`/`IP-TCP-DOC` to D45; `CLX`/`X-Remote-Screen`/`X-Documentation` to D48;
`NFS-Client`/`NFS-Documentation` to D17. Excluded `MacIvory-Support`,
`MacIvory-Development`, `Serial`, `SCSI`, and `LMFS` remain condition-qualified in
D17, D19, D47, and D52; reader-disabled `Lock-simple`, `compare-merge`,
`Version-Control`, and `Version-Control-doc` remain condition-qualified in D25.

The 28 installed loadable-system labels add documentation and platform applicability,
not 28 more applications. Their exact assignment is:

| Dossier coverage | Exact installed labels |
| --- | --- |
| D15, D21, D33, D35, D39, D41, D47, D52, D58 | `IVORY-COLOR-SUPPORT`, `HyperCard-MacIvory`, `Mac-Dex`, `DBFS-Utilities`, `Statice-Runtime`, `Hacks`, `Conversion-Tools`, `Metering`, `Mailer`, `Print` |
| D17, D45, D46, D48 | `X-Documentation`, `X-Remote-Screen`, `X-Server`, `NFS-Documentation`, `NFS-Server and NFS-Client`, `IP-TCP-Doc`, `IP-TCP`, `Domain Name Server` |
| D29 and D59 | `CLIM-Doc`, `CLIM-Demo`, `CLIM` |
| D47 | `UX-Development`, `MacIvory-Development`, `RPC-Development`, `UX-Support`, `MacIvory-Support`, `Embedding-Support`, `RPC` |

### The 98 live loaded-system names

Loaded-system membership is implementation evidence, not a request for 98 articles.
Every exact name is assigned below to the dossier that explains its role.

| Dossier coverage | Exact loaded-system names |
| --- | --- |
| D01, D02, D05, D07, D08, D11–D16, D22, D24, D26–D28, D30 | `APPROACHABILITY`, `CL-DEVELOPER`, `CLOS`, `COMMON-LISP`, `CONVERSE`, `DEBUGGER`, `DEVELOPMENT-COMMANDS`, `DEVELOPMENT-DEBUGGER`, `DEVELOPMENT-UTILITIES`, `DOC`, `DYNAMIC-INDEX`, `DYNAMIC-WINDOW-CLIENTS`, `DYNAMIC-WINDOWS`, `ERROR-SYSTEM`, `EXTENDED-HELP`, `FLAVOR`, `FLAVOR-EXAMINER`, `FONT-SUPPORT`, `FONTS`, `GARBAGE-COLLECTOR`, `LANGUAGE-TOOLS`, `LISP-COMPILER`, `MATH`, `METER`, `OLD-TV`, `PRESENTATION-SUBSTRATE`, `SCHEDULER`, `SCT`, `SPELL`, `SRCCOM`, `SYSTEM`, `SYSTEM-COMMANDS`, `SYSTEM-INTERNALS`, `TABLES`, `TIME`, `TV`, `TV-APPLICATIONS`, `UTILITIES`, `WHO-CALLS`, `ZMAIL`, `ZWEI` |
| D17–D21, D35, D45, D46, D48 | `CHAOS`, `CLX`, `FILE-SYSTEM`, `FILESYSTEM-SERVER`, `FEP-FS`, `GPRINT`, `HARDCOPY`, `IP-TCP`, `IP-TCP-APPLICATIONS`, `IP-TCP-DOC`, `LMFS-DEFSTORAGE`, `LOGICAL-PATHNAMES-TRANSLATION-FILES`, `NAMESPACE-EDITOR`, `NETBOOT`, `NETBOOT-SERVER`, `NETBOOT-STUBS`, `NETWORK`, `NETWORK-APPLICATIONS`, `NFS-CLIENT`, `NFS-DOCUMENTATION`, `PRESS`, `REMOTE-PROGRAM`, `REMOTE-TAPE`, `SERVER-UTILITIES`, `TAPE`, `TCP`, `TCP-SERVICE-PATHS`, `X-DOCUMENTATION`, `X-REMOTE-SCREEN` |
| D07, D08, D22–D24, D30, D33–D34, D37, D45, D47, D52 | `BIN`, `BITBLT`, `BUS-ACCESS`, `C+LISP-SUPPORT`, `COMPRESSION`, `CP`, `ECO-SUPPORT`, `EMBEDDING`, `EMBEDDING-SUPPORT`, `ENCRYPTION`, `I-ARCHITECTURE`, `I-LINKER`, `I-LISP-COMPILER`, `INSTALLATION-TOOLS`, `IVORY-COLOR-SUPPORT-PARTS`, `KBIN`, `KEYBOARD`, `L-BIN`, `LGP2-METRICS`, `LISP+C-SYNTAX`, `MACIVORY-D&E`, `MONOCHROME-SYNC-PROGRAMS`, `NSAGE`, `RPC`, `RPC-DEVELOPMENT`, `UX-DEVELOPMENT`, `UX-SUPPORT` |
| D24 | `DISTRIBUTION` |

The four rows contain 98 names in total. `BITBLT`, `TABLES`, `BIN`, schedulers,
metrics, and similar substrates are covered inside architecture dossiers rather than
misrepresented as selectable programs. D23's format audit establishes that `L-BIN`
is the compiled-file system, whereas `BIN`, Zmail `KBIN`, and
`C+LISP-SUPPORT` belong respectively to core serialization, mail storage, and
embedding/RPC coverage.

### Runtime command tables and program frameworks

The 40 Command Processor areas map as follows:

| Dossier coverage | Exact runtime command tables |
| --- | --- |
| D01–D04 and D28 | `Activities`, `Evaluation Context`, `Global`, `Lisp`, `Process`, `Session`, `Utilities`, `Window`, `Presentation` |
| D05, D11–D16, D22, D26 | `Breakpoint`, `Callers`, `CLOS`, `Debugging`, `Editing`, `Flavors`, `Garbage Collection`, `Inspection`, `Programming Tools`, `Tracing`, `Fonts`, `Spelling` |
| D06, D07, D17, D18, D24, D26 | `Directory`, `Document Formatting`, `Documentation`, `File`, `File System`, `World Building`, `System Maintenance` |
| D08–D10, D19–D21, D35, D45–D48 | `Communication`, `Conversation`, `Mail Reading/Sending`, `Mailer`, `Namespace`, `Networks`, `NFS`, `Printer`, `Printer Maintenance`, `Tape Administration`, `Site Administration` |
| D53–D60 | `Demonstration` |

All 35 concrete system/development/service program frameworks are covered by D02,
D03, D07, D11, D12, D15, D17, D20, D21, D28, D30–D32, D36, and D41:
`examiner`, `stipple-editor`, `font-editor`, `bitmap-editor`,
`standalone-bitmap-editor`, `restore`, `distribution`, `small-distribution`,
`page-previewer`, `select-key-selector`, `book-design-browser`, `Concordia`,
`notifications`, `undo-program`, `help`, `file-server-program`, `graphic-editor`,
`display-debugger`, `keyboard-control`, `choose-topics-to-remove-program`,
`reorder-sequence`, `alter-sequences`, `menu-program`, `presentation-inspector`,
`accept-values`, `layout-designer`, `help-program`, `doc-ex`, `small-doc-ex`,
`mailer-log-program`, `print-spooler-log-program`, `metering-interface`,
`Statice-Browser`, `namespace-editor`, and `domain-server-log-program`.

The 14 example frameworks are assigned to D60, then interpreted in their owning
product/UI dossiers: `widgetsim`, `n-queens`, `jericho-demo-suite`, `blocks-demo`,
`modelling-tutor`, `ht-demo`, `cryptarithmetic`, `DIAL-DEMO`, `employee-editor`,
`avv-pane-test`, `accept-two`, `calculator`, `life`, and `books`. The two generated
program-name templates are implementation techniques in D03 and D47, not anonymous
applications.

The remaining source-visible example collections are also D60 case studies, linked
back to their owning dossier. The exact catalog summaries are: Accepting Values,
audio, Common Lisp Life variants, constraint-frame stages, file-server
initialization, Flavor Life, Gabriel benchmarks, a hardcopy stream, incremental
redisplay, a Finger server, and Teach Zmacs in the core collection; Cryptarithmetic,
Demosthenes, Dial demo, “I'm My Own Grandpa,” HT examples, model tutor, N-Queens,
object-modelling tests, planning/blocks, Samaritan/Jericho, TMS examples, and widget
factory under Joshua; Bank, Books, extended types, Finger, image, Joshua integration,
presentation-type, and university examples under Statice; AOS hacks, curve, fog and
fog figures, mirror, spheres, and test-pattern modules under Color; and access
control, client, configuration, documentation, Listener, log window, mail
archive/index, slides, MCF, Twistdown Tree, and VRML scenes under CL-HTTP. These names
are evidence of examples, not proof that each is a loaded independent application.

## Explicit non-dossier exclusions

The following catalog material is accounted for but does not create another canonical
dossier:

- aliases, capitalization variants, site-to-directory redirects, and alternate frame
  sizes stay with their canonical program;
- `Any`, `selected-object-mixin`, `DOCSCR`, `WORDS`, `TVBGAR`, and `WORMCH` are generic
  choices, superclasses, rule/data modules, or raster support, not applications;
- device drivers, packages, macros, low-level libraries, generated tables, and data
  files are explained in their owning architecture dossier;
- editor modes do not prove that their named language implementations shipped;
- personal source files, tests, incidental tutorial stages, and product examples are
  subordinate case studies unless the catalog establishes an independent entry point;
- `AMORD`, `SPICE-PLOT`, `UNIX`, CLOE, external path registrations, commented system
  candidates, compiled-only `LMDEMO QFASL`/`PICT QFASL`, and missing SUDS/SCAN inputs
  retain explicit evidence limits rather than acquiring invented application behavior;
- trademark notices for Symbolics Prolog, KEE, SmartStore, and Semanticue are not
  installation evidence and therefore do not enter the 60-topic queue.

## Coverage result and work order

The matrix has **60 canonical dossier rows**. Reading the status tokens in the table
above gives the current, deliberately overlapping totals:

- all 60 rows have substantial depth for the presently available evidence: D01–D60;
- all 60 rows now have an editor-depth article at their stated evidence boundary;
- no canonical topic still requires a new article or a substantial application-depth
  extension;
- 50 topics are deliberately grouped because their exact entries are aliases, layers,
  small related programs, services, or examples rather than independent products;
- 43 topics currently have at least one runtime blocker, usually an optional unloaded
  system, unconfigured site, absent peripheral, missing historical input, or disruptive
  recovery path.

Those status totals overlap and describe planning state, not evidence strength.
Future runtime work should proceed through core visible applications already
registered in the running worlds; safely triggerable development tools; optional
systems that can be loaded without site configuration; services in a deliberately
disposable configured site; and finally hardware- or artifact-blocked programs. New
evidence should update the appropriate canonical dossier rather than expanding the
scope by silently treating another internal symbol as an application.

## Sources and verification

- [Cross-system software catalog](lisp-machine-software-catalog.md), including the
  evidence-layer and alias rules.
- [MIT CADR and LM-3 detailed catalog](mit-cadr/software-areas-and-applications.md),
  including all 55 maintained-tree system declarations and 34 canonical demo files.
- [Genera 8.5 detailed catalog](genera/software-areas-and-applications.md), including
  the live registries, 98 loaded systems, 133 media system identifiers, 49 concrete
  Dynamic Windows programs, and demonstration/example censuses.
- [Writing and research guide](writing-guide.md), for the implementation, manual,
  runtime, screenshot, provenance, and rights requirements applied to every dossier.
- [CLIM use across the software catalogs](clim-use-across-lisp-machine-software.md),
  for the D01-D60 UI-substrate and integration audit.

Last verified: 2026-07-18.
