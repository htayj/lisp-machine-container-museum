---
okf_version: "0.1"
---

# Lisp Machine Museum knowledge base

This is the durable research and interpretation layer of the repository. It records
what the preserved systems are, how their artifacts work, and what we learn while
running and studying them.

The root [README](../README.md) remains the practical guide to launching the museum.
These pages are written as portable Markdown so they can become the source of a future
public static site without moving the canonical content elsewhere.

The `docs/` directory is an Open Knowledge Format 0.1 bundle. OKF adds a small,
machine-readable metadata layer while retaining ordinary Markdown as the source.

## Collections

- [Symbolics Genera and Open Genera](genera/index.md) - The later Symbolics system,
  its Virtual Lisp Machine, and preserved Open Genera artifacts.
- [MIT CADR and LM-3](mit-cadr/index.md) - The earlier public MIT Lisp Machine
  lineage represented by CADR-compatible software and emulation.

## Start here

- [Software areas and programs of the MIT CADR and Symbolics Genera](lisp-machine-software-catalog.md)
  maps the listeners, editors, mail and communication tools, development
  environments, services, language products, system facilities, and demonstrations,
  with links to release-bounded exhaustive catalogs for each preserved system.
- [Application dossier coverage](software-application-dossiers.md) defines the
  finite 60-topic documentation boundary, the editor-depth evidence standard, and
  the exact completed, grouped, and runtime-blocked status for every catalog entry.
- [Reimplementation specification coverage](reimplementation-specification-coverage.md)
  tracks the D01-D60 reconstruction contracts, their release profiles, visual
  evidence obligations, and completion gates.
- [Lisp Listeners and editable input reimplementation specification](lisp-listeners-reimplementation-specification.md)
  defines the System 46, System 303, and Genera 8.5 Listener state, histories,
  input editing, ZDT/ZTOP embodiments, command dispatch, recovery, visible regions,
  and conformance tests.
- [Program selection, activities, and window management reimplementation specification](program-selection-activities-and-window-management-reimplementation-specification.md)
  defines the release-specific registries, reuse/create selection order, System and
  Select keys, System Menu transactions, Select Key Selector, Split Screen, live
  layouts, failure behavior, visual references, and conformance tests.
- [Screen Editor and Frame-Up layout design reimplementation specification](screen-editor-and-frame-up-layout-design-reimplementation-specification.md)
  defines four release-selectable live-window and program-layout profiles, complete
  staged pointer and command binding trees, geometry and pane algorithms, Undo and
  partial effects, code generation, Zmacs integration, screenshots, and conformance
  tests.
- [How CLIM was used across the software catalogs](clim-use-across-lisp-machine-software.md)
  audits all sixty dossiers, separating true CLIM applications, ports, consumers,
  and compatibility hooks from Dynamic Windows and the earlier TV/EINE/ZWEI stack.
- [MIT CADR/LM-3 TV window-system reimplementation specification](mit-cadr/tv-window-system-reimplementation-specification.md)
  defines release-selectable raster, sheet, exposure, stream, input, selection,
  menu, frame, constraint, typeout, and environment behavior with implementation,
  compiled-artifact, runtime, and manual evidence plus conformance tests.
- [Symbolics Genera Dynamic Windows reimplementation specification](genera/dynamic-windows-reimplementation-specification.md)
  specifies typed presentations, input contexts and handlers, commands, output
  histories, formatted layout, redisplay, frameworks, panes, and reusable clients
  against the preserved source tree, world, runtime, manuals, and 1989 paper.
- [RPC, embedding, UX, and Macintosh integration](rpc-embedding-ux-and-macintosh-integration.md)
  traces the public CADR UNIX-interface boundary through Genera's typed RPC/XDR
  layers, host embedding, UX services, MacIvory and Macintosh integrations, and
  Keyboard Control, with complete command and API inventories.
- [CL-HTTP and the contributed Web systems](cl-http-and-contributed-web-systems.md)
  reconstructs the server, clients, proxy, W3P, W4, Lambda IR, Showable
  Procedures/Btree substrate, direct controls, bundled examples, security
  findings, and verified unloaded-world boundary.
- [The Genera HACKS demonstration suite](genera/genera-hacks-demonstration-suite.md)
  gives all 18 registered demonstrations separate implementation and control
  studies, with lineage, provenance, source-only findings, and an exact runtime
  blocker instead of inferred screenshots.
- [CADR HACKS, display, sound, and novelty programs](mit-cadr/cadr-hacks-display-sound-and-novelty-suite.md)
  gives every active HACKS component, omitted canonical demo, and compiled support
  object a separate source-grounded treatment, with complete controls and a reviewed
  live QIX capture.
- [DOCTOR, the ELIZA-style conversational program](mit-cadr/doctor.md) documents the
  engine, executable rule corpus, complete controls, Multics-to-CADR lineage, source
  defects, and a reviewed synthetic System 303 conversation.
- [Spacewar on the MIT Lisp Machine](mit-cadr/spacewar-on-the-lisp-machine.md)
  reconstructs the complete game from the public System 46 and maintained System
  303 implementations and verifies its live playfield through the isolated CADR
  harness.
- [Directory, difference, and buffer editors](directory-difference-and-buffer-editors.md)
  compares Dired, BDired, Edit Buffers, List Buffers, Kill Or Save Buffers, and
  Compare Directories across the preserved systems, including complete command
  inventories and implementation/runtime discrepancies.
- [Directory, difference, and buffer editors reimplementation specification](directory-difference-and-buffer-editors-reimplementation-specification.md)
  defines System 46, System 303, and Genera 8.5 view models, complete effective
  input and presentation trees, deferred-operation ordering, partial failures,
  reviewed Edit Buffers visuals, protocol surfaces, and conformance tests.
- [Help, self-documentation, and Document Examiner](help-self-documentation-and-document-examiner.md)
  connects editor and system Help to Genera's documentation browser, with complete
  controls, search behavior, source-only findings, and a reviewed live frame.
- [Help, self-documentation, and Document Examiner reimplementation specification](help-self-documentation-and-document-examiner-reimplementation-specification.md)
  defines the release-selectable state, exhaustive effective input/gesture trees,
  failures, private-document bytes, visual requirements, and conformance suite.
- [Presentation Inspector in Symbolics Genera](genera/presentation-inspector.md)
  explains how Genera diagnoses presentation hierarchies, input contexts, handlers,
  gestures, menus, priorities, and translator failures.
- [Zmail on the MIT CADR/LM-3](mit-cadr/zmail.md) and
  [Zmail and mail composition in Genera](genera/zmail.md) document the two mail
  environments, complete release-bounded controls, composition modes, transport
  boundaries, source findings, and safe runtime observations. The
  [Genera declared-build source manifest](genera/zmail-declared-build-source-manifest.md)
  gives the rights-safe 47-member version/size/hash oracle. Exact companions close
  the [named-command effects](zmail-command-effect-closure.md),
  [mail-file grammars and failures](zmail-mail-file-format-semantics.md), and the
  [System 303](mit-cadr/zmail-filter-universe-profile-semantics.md) and
  [Genera](genera/zmail-filter-universe-profile-semantics.md) filter, universe,
  Profile, and option semantics.
- [ZMail and mail composition reimplementation specification](zmail-and-mail-composition-reimplementation-specification.md)
  defines five separately selectable System 46, System 303, and Genera 8.5 reader
  and composition targets, their complete effective input trees, persistence and
  partial-failure order, reviewed visible states, and conformance tests.
- [Converse, direct messages, and notifications](converse-direct-messages-and-notifications.md)
  compares QSend, Converse, SHOUT, network notices, central notification delivery,
  and the Notifications viewer, including complete controls and reviewed live states.
- [Screen Editor and Frame-Up](screen-editor-and-frame-up.md) distinguishes live
  window-hierarchy editing from Genera program-frame design, traces the Screen Editor
  lineage, inventories every control, and includes fresh runtime evidence.
- [Emergency Break and the cold-load stream](emergency-break-and-cold-load-stream.md)
  explains the degraded recovery console in System 46, LM-3 System 303, and Genera,
  including verified System 303 and Genera evaluations and reviewed runtime captures.
- [Emergency Break and degraded interaction paths reimplementation specification](emergency-break-and-degraded-interaction-paths-reimplementation-specification.md)
  gives release-selectable cold-console, complete D04-owned input-tree, exact
  debugger-transition, ownership, recursive-degradation, failure, visual, and
  conformance contracts.
- [Flavors, classes, CLOS, and the Flavor Examiner](flavors-clos-and-flavor-examiner.md)
  separates the CADR object facilities from Genera New Flavors and CLOS, inventories
  their inspection commands, and records implementation findings and live behavior.
- [Trace, Stepper, breakpoints, and call analysis](trace-stepper-breakpoints-and-call-analysis.md)
  compares execution-analysis models and complete control surfaces from System 46
  through Genera, including controlled cross-system runtime evidence.
- [Metering and performance analysis](metering-and-performance-analysis.md) compares
  counter snapshots, page tracing, event metering, sampling, reports, and the Genera
  Metering Interface without conflating their different implementations.
- [File systems and file service](file-systems-and-file-service.md) follows the
  pathname, access-path, protocol, store, and user-interface layers from System 46
  QFILE through LM-3 Local-File/LMFILE and Genera QFILE, NFILE, NFS, and LMFS.
- [MIT disk labels, packs, checkout, and file-system repair](mit-cadr/disk-labels-packs-and-file-system-repair.md)
  and [Genera FSEdit and File System Maintenance](genera/fsedit-and-file-system-maintenance.md)
  document storage repair from physical labels through file-system salvage, with
  complete controls and conservative destructive-operation boundaries.
- [Tape systems and the Tape Utility Frame](tape-systems-and-tape-utility-frame.md)
  distinguishes the absent System 46 subsystem, the later LMI Tape/TFrame stack in
  maintained System 303, and Genera's separate tape streams, formats, transports,
  distribution paths, FEP activity, and complete administration command surface.
- [CADR site data, login, and Site Editor](mit-cadr/site-data-login-and-site-editor.md)
  and [Genera Namespace administration and editor](genera/namespace-administration-and-editor.md)
  document identity, site/host tables, namespace objects, complete editor controls,
  persistence boundaries, and the verified empty Genera frame.
- [Background services and operations dashboards](background-services-and-operations-dashboards.md)
  compares CADR process/operator surfaces with the Genera Mailer, Printer Spooler,
  Domain Server, and File Server programs and their shared logging substrate.
- [Lisp runtime, compiler, and development environment](lisp-runtime-compiler-and-development-environment.md)
  compares the reader/evaluator, language context, storage, scheduler, garbage
  collector, compiler pipelines, development release, and live machine-code output.
- [Ivory, FEP, and Open Genera VLM implementation layers](ivory-fep-and-open-genera-vlm-implementation-layers.md)
  separates the Ivory execution architecture, physical and virtual front ends,
  Life Support, host controls, debuggers, platform systems, and CADR comparison.
- [Compiler Tools, grammars, lexers, and the Syntax Editor](compiler-tools-grammar-lexer-and-syntax-editor.md)
  reconstructs Genera's shared foreign-language compiler IR, parser generators,
  incremental lexer/parser, syntax-aware Zmacs commands, templates, and exact
  unloaded-world boundary.
- [Conversion Tools and source migration on Symbolics Genera](conversion-tools-and-source-migration.md)
  reconstructs the structured source-to-source engine, all 14 Zmacs commands and
  query controls, built-in conversion sets, mappings, extension API, and exact
  unloaded-world boundary.
- [The NS electronic-design family](ns-electronic-design-family.md) reconstructs
  Basic-NS, Schematic-NS, Gate-Array-NS, PCB-NS, and VLSI-NS; inventories every
  compiled command, menu action, and gesture; and documents the schematic,
  simulation, board, IC-layout, interchange, and preservation boundaries.
- [CLOE development and runtime environment](cloe-development-and-runtime-environment.md)
  reconstructs CLOE Developer's Genera-to-Intel migration and delivery pipeline,
  DOS/Windows CLIM port, Listener/debugger, files, all documented bindings, and
  exact evidence that the product is absent from the preserved media and base world.
- [Symbolics C, FORTRAN, and Pascal environments](symbolics-c-fortran-and-pascal-environments.md)
  compares the three integrated Genera language products, their compiler/runtime,
  editor, listener, debugger, build, library, Lisp-interoperation, and complete
  recovered language-specific command surfaces.
- [System construction, patches, worlds, bands, and distribution](system-construction-patches-worlds-and-distribution.md)
  follows both systems from declarations and builds through patches, CADR load bands,
  Genera worlds, delivery worlds, distributions, and restoration.
- [Source comparison, Compare/Merge, and version control](source-comparison-compare-merge-and-version-control.md)
  documents SRCCOM on both systems and preserves the exact disabled-system boundary
  around Genera's media-present Compare/Merge and Version Control facilities.
- [Formatting, spelling, and text production utilities](formatting-spelling-and-text-production-utilities.md)
  follows `FORMAT`, `FQUERY`, grinders, dribbling, spelling, Bolio, Sage, fonts, and
  editor-side document production across System 46, System 303, and Genera 8.5.
- [Concordia, structured documentation, and book design](concordia-document-and-book-design.md)
  documents the NSage record model, structural Zmacs authoring, Page Previewer,
  book-design inheritance and Browser, all application commands, serialized
  formats, CADR/LM-3 boundary, and exact runtime load state.
- [Mathematical and numeric facilities on CADR and Genera](mathematical-and-numeric-facilities.md)
  inventories the complete `MATH` matrix API, rational/complex layers, numeric
  families, infix grammars, implementation changes, and a preserved runtime anomaly.
- [Macsyma 421 on Lisp machines](macsyma-421-symbolic-mathematics-environment.md)
  reconstructs the symbolic-mathematics product, all menu panels and expression
  gestures, plotting, Help, MEDIT, Display Editor, Zmacs integration, MIT/LM-3
  lineage, and exact unloaded-world boundary.
- [Joshua rule and inference environment](joshua-rule-and-inference-environment.md)
  reconstructs the optional expert-system product, predicate protocol, unification,
  RETE rules, truth maintenance, objects, tracing, metering, commands, presentations,
  Zmacs support, Jericho examples, and public AMORD lineage evidence.
- [Statice persistent object and database environment](statice-persistent-object-and-database-environment.md)
  reconstructs the development, run-time, server, Browser, DBFS/B*-tree storage,
  transactions, recovery, backup, maintenance, and preservation surfaces.
- [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md)
  explains Genera's typed object-to-output links, input contexts, translators,
  command tables, redisplay, program frameworks, generic programs, and CADR
  antecedents, with reviewed runtime examples.
- [CLIM 2 on Symbolics Genera](clim-2-on-genera.md)
  documents the optional portable UI system, Silica, native/CLX/PostScript ports,
  complete facility map and default Genera gestures, compiled-only source boundary,
  and exact unloaded-world result.
- [CLIM 2 demonstrations and tutorial programs](clim-demonstrations-and-tutorial.md)
  documents every chooser registration, tutorial stage, test family, command,
  presentation gesture, dependency, format, implementation finding, and exact
  screenshot blocker in the inspected optional CLIM media.
- [Product and programming examples in Genera](product-and-programming-examples.md)
  audits every bounded Core, Joshua/Jericho, Statice, Color, and CL-HTTP example,
  with complete direct controls for all fourteen example frames, source-only
  findings, side-effect boundaries, and exact runtime blockers.
- [CLX, remote X screens, and X server facilities on Genera](clx-remote-x-screens-and-x-server-facilities.md)
  separates guest X clients, the historical hardware-only X server, CLX-CLIM,
  VLM display transport, and the museum's host-side Xvfb harness.
- [FED and the Font Editor generations](fed-and-font-editor-generations.md)
  compares the System 46 old-window, XFED, and new-window branches, maintained
  System 303 FED, and Genera's separate Bitmap Editor-based Font Editor.
- [Bitmap, stipple, and raster paint editors](bitmap-stipple-and-raster-paint-editors.md)
  documents CADR PAINT/NPAINT and Genera's Bitmap/Stipple Editor family with complete
  controls, raster/register semantics, file/object workflows, and source-only defects.
- [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md)
  inventories the object-based drawing model, all active commands and transforms,
  gestures, formats, presentation semantics, source-only findings, and exact
  optional-system runtime boundary.
- [Color systems, the Genera Color Editor, and CADR color experiments](color-systems-and-color-editor.md)
  distinguishes indexed and direct color, inventories the complete Color Editor and
  Palette interactions, and analyzes the CADR color substrate plus COLORHACK,
  COLXOR, and CAFE without inventing lineage.
- [Images, drawing primitives, and visual-asset substrates](images-drawing-and-visual-asset-substrates.md)
  maps Genera's BITBLT, Dynamic Windows drawing, image objects and formats,
  compression, FrameThrower hardware, and complete installed asset census while
  linking the distinct public CADR recovery boundary.
- [Hardcopy, Press, printing, and plot output](hardcopy-press-printing-and-plot-output.md)
  follows CADR Press, XGP, DPLT, and Versatec output into Genera's format/device
  registry, Function-Q capture, printer queues, spooler, and PostScript paths, with
  two reviewed live option-form crops.
- [SUPDUP, Telnet, and the Genera Terminal program](network-terminal-applications.md)
  traces the network-terminal architecture from CADR NVT windows to Genera's
  protocol/filter/simulator stack and inventories every local command and option.
- [Network services and site utilities](network-services-and-site-utilities.md)
  compares the CADR Chaos service sets and MIT-local utilities with Genera's generic
  server framework, complete FTP/TFTP/DNS/Finger/TCP surfaces, security defaults,
  and fresh read-only registry observations.
- [Network transports and protocol architecture](network-transports-and-protocol-architecture.md)
  compares Chaosnet, Ethernet/ARP, EFTP/QFILE transport, Genera's generic
  service-path graph, IP/TCP, RPC/NFS, routing, and operator diagnostics across
  System 46, maintained System 303, and Genera 8.5.
- [CADR microcode, microassembler, and console debugger](mit-cadr/cadr-microcode-microassembler-and-console-debugger.md)
  documents the UCODE build and artifact pipeline, incremental microassembly, remote
  hardware/Lisp inspection, and the complete release-bounded CC command interface.
- [CADR diagnostics, checkout, and hardware tools](mit-cadr/cadr-diagnostics-checkout-and-hardware-tools.md)
  covers the machine-test hierarchy, memory and disk checkout, PROM and controller
  assemblers, continuity/probe automation, and raw Chaos interface diagnostics.
- [Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md)
  records the capture-specific U.S. fair-use review, publication limits, license
  boundary, and reassessment process for curated CADR and Genera runtime images.
- [From EINE to ZWEI and Zmacs](lisp-machine-text-editors.md) explains the
  editor lineage, separates reusable ZWEI machinery from the Zmacs application,
  and links the code- and runtime-grounded feature and keybinding references for
  both preserved systems.
- [EINE, ZWEI, and Zmacs editor-family reimplementation
  specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md)
  defines release-selectable semantic models, command loops, complete
  source-profile input trees and prefixes, files, modes, lifecycle, failure
  behavior, reviewed visuals, and conformance tests.
- [Directory, difference, and buffer editors reimplementation
  specification](directory-difference-and-buffer-editors-reimplementation-specification.md)
  defines the Dired, BDired, Edit Buffers, List Buffers, Kill Or Save Buffers, and
  Compare Directories reconstruction contracts without conflating their releases
  or UI substrates.
- [Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md)
  explains authenticated, network-isolated operation of a licensed world, exact-window
  evidence capture, and why an accepted shutdown confirmation currently ends in
  bounded forced cleanup without saving guest state.
- [Operating CADR through the Xvfb computer-use harness](mit-cadr/cadr-computer-use-harness.md)
  explains how isolated private sessions, current-versus-copy-time fingerprints, and
  execution-time verification turn computer-use observations into museum evidence.
- [MIT CADR on-line help and documentation recovery](mit-cadr/online-help-and-documentation-recovery.md)
  explains the source-integrated ZWEI, Lisp, flavor, keyboard, and application Help
  mechanisms and links the tracked public System 46 source corpus.
- [Visual assets in the MIT CADR and LM-3 software](mit-cadr/visual-assets-inventory.md)
  maps native raster pictures, graphical font atlases, paint patterns, technical
  drawings, and procedural imagery, with explicit preservation and rights boundaries.
- [Color inks and raster patterns in the MIT CADR software](mit-cadr/color-inks-and-raster-patterns.md)
  explains how sixteen indexed solid fills acquire mutable RGB values and how they
  differ from the monochrome window system's named stipples.
- [MUNCH and Munching Squares on the MIT CADR](mit-cadr/munch.md) explains how a
  classic PDP-1 display idea became an interactive Lisp Machine XOR graphics demo.
- [LEXIPHAGE, the Lisp Machine word eater](mit-cadr/lexiphage.md) explains how its
  animated jaws erase large raster-font text and distinguishes three preserved
  implementations.
- [Open Genera world loads and the VLOD format](genera/world-loads-and-vlod.md) explains
  what a `.vlod` contains, why it is closer to a cold heap snapshot than an archive,
  and what can currently be recovered from one.
- [Recovering code and assets from a Genera world](genera/recovering-code-and-assets-from-worlds.md)
  explains what “decompiled Lisp” can honestly mean and how resident fonts differ
  from their original source files.
- [Extracting resident fonts from a Genera world](genera/extracting-resident-fonts.md)
  provides the reproducible local-only VLOD workflow and links the evidence-graded
  catalog of all 89 fonts in the inspected world.
- [Genera on-line help and documentation recovery](genera/online-help-and-documentation-recovery.md)
  explains the Document Examiner's 801-file Sage Binary corpus, three reviewed
  standalone help files, the additional runtime help layers, and the
  non-redistributing local extraction workflow.
- [MIT CADR font sources and recovery](mit-cadr/font-sources-and-recovery.md) explains
  the public source-first pipeline and catalogs the trackable BDF and PNG derivatives.
- [MIT CADR compiled QFASL font recovery](mit-cadr/compiled-qfasl-font-recovery.md)
  documents the separate non-evaluating extraction of 19 public runtime font objects
  and the evidence distinguishing them from authoring source.
- [Compiled objects, QFASL, relocation, and UNFASL](compiled-objects-qfasl-relocation-and-unfasl.md)
  inventories the CADR and Genera loader languages, explains what their inspection
  tools can recover, and separates compiled files from archives and world snapshots.
- [MIT CADR font usage audit](mit-cadr/font-usage-audit.md) identifies source-backed
  roles where the pinned source supports them and leaves evidence-bounded `TODO`s for
  every unresolved name.

## Editorial principles

The museum favors primary sources and reproducible artifact inspection. Pages should
separate verified facts from local observations, interpretation, and unanswered
questions. Licensed historical software is described but not redistributed.

See the [writing and research guide](writing-guide.md) for the OKF profile, page
conventions, and evidence rules.
