# Symbolics Genera and Open Genera

This collection covers Genera as a Lisp-machine operating environment and Open Genera
as its Virtual Lisp Machine implementation hosted on Unix.

## Articles

- [Software areas, applications, and programs in the inspected Genera 8.5 environment](software-areas-and-applications.md)
  catalogs the live activity, Select-key, System Menu, and command-area registries;
  all 98 live loaded-system names; the base release roster; all 133
  site/system-directory identifiers; optional products, services, language tools,
  and registered demonstrations, while keeping runtime, documentation, and
  media-presence claims distinct.
- [How CLIM was used across the CADR and Genera software catalogs](../clim-use-across-lisp-machine-software.md)
  classifies every canonical dossier by its real UI substrate and distinguishes
  CLIM applications, ports, integrations, and compatibility hooks from native
  Dynamic Windows, ZWEI, TV, and noninteractive facilities.
- [Dynamic Windows reimplementation specification](dynamic-windows-reimplementation-specification.md)
  defines a reconstruction-grade contract for presentations, typed input, handlers,
  commands, output histories, formatted layout, redisplay, frameworks, panes, and
  reusable clients, with evidence status and conformance tests for each layer.
- [Dynamic Lisp Listener in Symbolics Genera](dynamic-lisp-listener.md) documents
  the evaluation loop, Command Processor, Input Editor, presentations, complete
  configured base bindings, history timing, and fresh Genera 8.5 behavior.
- [Lisp Listeners and editable input reimplementation specification](../lisp-listeners-reimplementation-specification.md)
  gives the release-selectable Genera 8.5 reconstruction contract and contrasts its
  native Dynamic Windows command/form interaction with the CADR Listener families.
- [Reimplementation specification coverage](../reimplementation-specification-coverage.md)
  tracks the finite D01-D60 specification worklist across Genera, CADR, and LM-3.
- [Activities, Select keys, and the System Menu](activities-and-system-menu.md)
  reconciles the live selection and creation registries with source and manuals,
  including exact controls and an observed menu.
- [Program selection, activities, and window management reimplementation specification](../program-selection-activities-and-window-management-reimplementation-specification.md)
  gives the Genera 8.5 contract for activities, Select-key dispatch and firewall,
  the Select Key Selector, System Menu transactions, Split Screen, live layouts,
  failure behavior, and conformance tests.
- [Screen Editor and Frame-Up layout design reimplementation specification](../screen-editor-and-frame-up-layout-design-reimplementation-specification.md)
  gives separate Genera 8.5 contracts for the inherited live Screen Editor and the
  Dynamic Windows Frame-Up designer, including complete input trees, geometry and
  pane transactions, generated frameworks, Zmacs handoff, screenshots, and tests.
- [SUPDUP, Telnet, and the Genera Terminal program](../network-terminal-applications.md)
  inventories Terminal's commands, connection controls, Dynamic Windows gestures,
  login protocols, simulators, and CADR lineage.
- [Network services and site utilities](../network-services-and-site-utilities.md)
  inventories the generic server registry and trust policy, Finger and Show Users,
  complete FTP/TFTP/DNS/TCP diagnostic surfaces, and the exact all-disabled
  base-world state.
- [Network transports and protocol architecture](../network-transports-and-protocol-architecture.md)
  reconstructs Genera's service/protocol/medium graph, Chaos and VLM interfaces,
  Ethernet/ARP, optional DNA delegation, IP/TCP, RPC/NFS transport, all nine
  direct Networks commands, and the isolated runtime boundary.
- [Screen Editor and Frame-Up](../screen-editor-and-frame-up.md) separates Genera's
  inherited live-window Screen Editor from its Dynamic Windows code-generating
  layout designer, with complete controls, source findings, and runtime evidence.
- [Directory, difference, and buffer editors](../directory-difference-and-buffer-editors.md)
  compares Genera Dired and Edit Buffers with their MIT predecessors and inventories
  the complete specialized editor commands and presentation behavior.
- [File systems and file service](../file-systems-and-file-service.md) explains
  Genera's host-selected access paths, QFILE, NFILE, NFS, VLM-excluded LMFS, direct
  File/Directory/NFS commands, and the six-pane File Server operations frame.
- [Help, self-documentation, and Document Examiner](../help-self-documentation-and-document-examiner.md)
  documents the visible Help architecture and the full Document Examiner workflow,
  including a reviewed Standard-frame runtime observation.
- [D07 reimplementation specification](../help-self-documentation-and-document-examiner-reimplementation-specification.md)
  specifies Zmacs Help, Dynamic Windows Help, the pop-up frame, and Standard/Small
  Document Examiner state, complete inputs, failure ordering, and conformance tests.
- [Zmail and mail composition in Symbolics Genera](zmail.md) separates the full
  reader, integrated Zmail drafts, Zmacs Text Mail mode, and background Mailer;
  its [command and binding companion](zmail-commands-and-bindings.md) inventories
  the release-bounded command surfaces.
- [Zmail declared-build source manifest](zmail-declared-build-source-manifest.md)
  records rights-safe metadata for all 47 selected source generations and defines
  reproducible content and selection closure hashes without publishing source text.
- [Zmail filters, universes, and Profile semantics](zmail-filter-universe-profile-semantics.md)
  specifies the executable definition languages, persistence and failure order, and
  all 81 textual user-option forms while keeping the 80 active forms distinct from
  the one block-commented form.
- [ZMail named-command effect closure](../zmail-command-effect-closure.md) gives the
  ordered applicability, mutations, delegation, partial failures, and ownership of
  all 152 clean-release completion candidates; [mail-file format semantics](../zmail-mail-file-format-semantics.md)
  specifies exact recognition, parser, serializer, Directory, Text, and KBIN
  boundaries without publishing licensed fixture bytes.
- [D08 ZMail and mail composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md)
  defines separate Genera 8.5 reader and Zmacs Text Mail targets, complete effective
  keyboard, menu, pointer, presentation, and transient-context trees, persistence
  and submission boundaries, reviewed visible states, and conformance tests.
- [Converse, direct messages, and notifications](../converse-direct-messages-and-notifications.md)
  separates the conversation editor, one-shot and broadcast messages, central
  notification delivery, the Notifications activity, and their complete local
  controls, with fresh synthetic-data runtime evidence.
- [Genera Converse and Notifications bindings and semantics](converse-notifications-bindings-and-semantics.md)
  supplies the normative editor, pop-up, activity, Command Processor, delivery,
  history, presentation, and failure contracts for the System 452.1/Zmail 442.0
  source profile, separately compared with the bounded Genera 8.5 System 452.22
  runtime witness.
- [D09 Converse, direct messages, and Notifications reimplementation specification](../converse-direct-messages-and-notifications-reimplementation-specification.md)
  defines the licensed-source and preserved-world profiles, exact effective input
  boundaries, reviewed visible states, peer-network exclusions, and conformance
  oracles.
- [Inspector and Peek in Symbolics Genera](inspector-and-peek.md) inventories object
  browsing, mutation semantics, live status modes and menus, including source/runtime
  discrepancies and representative reviewed captures.
- [Presentation Inspector in Symbolics Genera](presentation-inspector.md) documents
  the context-invoked presentation-handler debugger, its complete command and gesture
  surface, matching reports, source/manual discrepancies, processless lifecycle,
  and fresh reviewed runtime evidence.
- [Metering and performance analysis](../metering-and-performance-analysis.md)
  separates Genera's measurement substrate, Meter compatibility interface, Dynamic
  Windows Metering Interface, reports, and exact optional-system runtime blocker.
- [FSEdit and File System Maintenance](fsedit-and-file-system-maintenance.md)
  inventories the tree editor, four privilege levels, Salvager, free-record and
  partition operations, and the explicit boundary around destructive verification.
- [Tape systems and the Tape Utility Frame](../tape-systems-and-tape-utility-frame.md)
  documents Genera's record streams, local and remote devices, Carry, TAR, TAPEX,
  distribution and FEP paths, all 15 Tape Administration commands, and the exact
  hardware and configuration limits observed on the VLM.
- [Flavors, classes, CLOS, and the Flavor Examiner](../flavors-clos-and-flavor-examiner.md)
  distinguishes Genera New Flavors from CLOS, inventories both inspection-command
  families and the Flavor Examiner interface, and records source-visible limitations.
- [The Genera Debugger and Display Debugger](debugger-and-display-debugger.md)
  inventories the ordinary command loop and pane-oriented frame, including all
  gestures, source/manual discrepancies, and reviewed live states.
- [Trace, Stepper, breakpoints, and call analysis](../trace-stepper-breakpoints-and-call-analysis.md)
  documents Genera's execution-analysis tools, persistent callers database, complete
  command surfaces, and controlled runtime boundaries.
- [Emergency Break and the cold-load stream](../emergency-break-and-cold-load-stream.md)
  compares Genera's degraded recovery path with its MIT predecessors and records an
  actual System Menu entry, cold-client evaluation, and return to the saved display.
- [Emergency Break and degraded interaction paths reimplementation specification](../emergency-break-and-degraded-interaction-paths-reimplementation-specification.md)
  defines the Genera 8.5 cold console, complete D04-owned source-bounded input trees,
  exact debugger transition edges, recursive degradation, ownership, failure,
  visual, and conformance contracts while preserving the licensed-evidence boundary.
- [Zmacs in Symbolics Genera](zmacs.md) documents the ZWEI substrate, object
  model, Zmacs application, development features, modes, source/manual
  discrepancies, and isolated Genera 8.5 observations; its
  [binding companion](zmacs-keybindings.md) enumerates the inspected configured
  tables, arguments, Help, mode composition, pointer/presentation layers and
  live-world oracle, while the [named-command audit](zmacs-named-commands.md) records the
  counts, categories, and installation semantics of 277 source candidates
  without publishing the exact licensed-source inventory.
- [EINE, ZWEI, and Zmacs editor-family reimplementation
  specification](../eine-zwei-and-zmacs-editor-family-reimplementation-specification.md)
  defines the Genera 8.5 configured-source editor contract, complete fixed-tree
  boundary, installed-overlay oracle, lifecycle, failure behavior, visuals, and
  conformance tests while keeping licensed evidence local.
- [Directory, difference, and buffer editors reimplementation
  specification](../directory-difference-and-buffer-editors-reimplementation-specification.md)
  defines Genera 8.5 Dired, Edit Buffers, List Buffers, Kill Or Save Buffers, and
  Compare Directories as distinct ZWEI, TV, Dynamic Windows, and Command Processor
  surfaces, with complete app-owned inputs and reviewed visual evidence.
- [Operating Genera through the Xvfb computer-use harness](genera-computer-use-harness.md) -
  How authenticated, network-isolated private sessions turn real VLM keyboard,
  pointer, and screenshot observations into evidence without distributing licensed
  artifacts, and distinguish accepted shutdown confirmation from the current forced
  cleanup stall and from in-guest Save World.
- [Ivory, FEP, and Open Genera VLM implementation layers](../ivory-fep-and-open-genera-vlm-implementation-layers.md)
  - The Ivory instruction contract, physical FEP and IFEP, Open Genera Life Support,
    host controls, debugger surfaces, architecture-specific systems, platform
    conditions, safety boundaries, and recorded pause-path behavior.
- [World loads and the VLOD format](world-loads-and-vlod.md) - How a VLM world stores
  Genera's tagged virtual memory and what can be recovered from it.
- [Recovering code and assets from a world](recovering-code-and-assets-from-worlds.md)
  - The boundary between original source, decompiled executable representations, and
  effect-preserving recovery of resident fonts and other assets.
- [Compiled objects, QFASL, relocation, and UNFASL](../compiled-objects-qfasl-relocation-and-unfasl.md)
  - The Genera L-BIN command language, `UNBIN` inspection boundary, and correction
  separating L-BIN from the unrelated `BIN`, Zmail `KBIN`, and RPC support systems.
- [Extracting resident fonts from a Genera world](extracting-resident-fonts.md) - The
  reproducible local-only workflow for decoding licensed world-resident fonts into
  BDF, normalized records, and specimen sheets.
- [Genera 8.5 resident font catalog](font-catalog.md) - Evidence-graded styles,
  character-set roles, application uses, and explicit unknowns for all 89 distinct
  font objects in the inspected base world.
- [Genera on-line help and documentation recovery](online-help-and-documentation-recovery.md)
  - The indexed Sage Binary corpus, Document Examiner and runtime help layers, and a
  complete local-only decode of all 801 licensed documentation databases plus three
  consumer-audited standalone help files.
- [Namespace administration and the Namespace Editor](namespace-administration-and-editor.md)
  - Namespace database architecture, seven object classes, all editor and Command
  Processor controls, persistence safety, and a reviewed live empty-object frame.
- [Background services and operations dashboards](../background-services-and-operations-dashboards.md)
  - Mailer, Printer Spooler, Domain Server, and File Server process/log programs,
  exact controls, shared logging machinery, and configured-service runtime limits.
- [Lisp runtime, compiler, and development environment](../lisp-runtime-compiler-and-development-environment.md)
  - Common Lisp and ZetaLisp contexts, scheduler and garbage collection, the
  shared/Ivory compiler pipeline, development commands, and controlled live output.
- [Compiler Tools, grammars, lexers, and the Syntax Editor](../compiler-tools-grammar-lexer-and-syntax-editor.md)
  - The CTS foreign-language compiler/debugger substrate, CFG and LALR/LL(1)
  parsers, table-driven lexer, incremental syntax-aware Zmacs framework, complete
  common controls, and exact unloaded base-world result.
- [Conversion Tools and source migration](../conversion-tools-and-source-migration.md)
  - The structured Zmacs conversion engine, all commands and query controls,
  ZetaLisp/Common Lisp, Flavors/CLOS, Dynamic Windows/CLIM and CLIM-version sets,
  custom sets, discrepancies, and fresh nonresident-system evidence.
- [The NS electronic-design family](../ns-electronic-design-family.md)
  - Basic-NS, Schematic-NS, Gate-Array-NS, PCB-NS, and VLSI-NS, with every compiled
  command, menu action, gesture, workflow, interchange path, and preservation limit.
- [CLOE development and runtime environment](../cloe-development-and-runtime-environment.md)
  - The Genera-side Developer and external Intel PC Runtime/Application Generator,
  including migration, DOS/Windows CLIM, Listener/debugger behavior, release drift,
  complete documented controls, and the product's exact preservation boundary.
- [Symbolics C, FORTRAN, and Pascal environments](../symbolics-c-fortran-and-pascal-environments.md)
  - Compiler and run-time configurations, Zmacs modes and keybindings, language
  listeners/commands/debuggers, programs and systems, libraries, Lisp calls,
  manual/source disagreements, and fresh nonresident-package evidence.
- [System construction, patches, worlds, bands, and distribution](../system-construction-patches-worlds-and-distribution.md)
  - System Construction Tool plans and journals, patches, world building, delivery
  worlds, distribution, restoration, and their preservation boundaries.
- [Source comparison, Compare/Merge, and version control](../source-comparison-compare-merge-and-version-control.md)
  - Resident SRCCOM/Zmacs behavior and the exact reader-disabled release boundary for
  the media-present Compare/Merge and Version Control systems.
- [Formatting, spelling, and text production utilities](../formatting-spelling-and-text-production-utilities.md)
  - `FORMAT`, presentation-aware `FQUERY`, the grinder, dribbling, Zmacs spelling,
  Sage, character styles, fonts, and document-production commands in Genera 8.5.
- [Concordia, structured documentation, and book design](../concordia-document-and-book-design.md)
  - NSage records and `.sab` serialization, structural editing, Page Previewer,
  book-design inheritance and Browser, complete 74/26/11 command surfaces,
  integrations, preservation boundary, and fresh residency probe.
- [Mathematical and numeric facilities on CADR and Genera](../mathematical-and-numeric-facilities.md)
  - Genera's matrix subsystem, numeric tower, documented function families, infix
  reader, source/manual evidence, and an explicitly unresolved live exact-division anomaly.
- [Macsyma 421 on Lisp machines](../macsyma-421-symbolic-mathematics-environment.md)
  - The 167-component symbolic-mathematics environment, complete menu and expression
  gestures, mathematical families, plotting, Help, editors, lineage, and unloaded
  base-world result.
- [Joshua rule and inference environment](../joshua-rule-and-inference-environment.md)
  - Predicates and the Protocol of Inference, database/unification, forward RETE and
  backward rules, TMS/LTMS, objects, tracing, metering, all commands/translators,
  Zmacs support, Jericho examples, source findings, and the exact unloaded boundary.
- [Statice persistent object and database environment](../statice-persistent-object-and-database-environment.md)
  - Development, run-time, server, Browser, DBFS/B*-tree storage, schemas, queries,
  transactions, recovery, backup, maintenance, source findings, and load-state probe.
- [Dynamic Windows and presentation-based interaction](../dynamic-windows-and-presentation-based-interaction.md)
  - Typed presentations, input contexts, handlers, command tables, formatted output,
  redisplay, panes, program frameworks, and complete controls for the bundled generic
  programs, illustrated with reviewed runtime evidence.
- [CLIM 2 on Symbolics Genera](../clim-2-on-genera.md)
  - Portable CLIM, Silica, native/CLX/PostScript ports, complete feature and default
    gesture maps, media patch lineage, compiled-only implementation boundary, and the
    verified unloaded base-world state.
- [CLIM 2 demonstrations and tutorial programs](../clim-demonstrations-and-tutorial.md)
  - All 17 chooser registrations, every tutorial and test program, complete
    application-owned controls and gestures, source/manual findings, data and safety
    boundaries, and the exact optional-system screenshot blocker.
- [CLX, remote X screens, and X server facilities](../clx-remote-x-screens-and-x-server-facilities.md)
  - CLX client facilities, remote Genera screens, the historical non-embedded X11
    Server, X documentation, CLX-CLIM, keyboard mappings, resources, and XDMCP.
- [RPC, embedding, UX, and Macintosh integration](../rpc-embedding-ux-and-macintosh-integration.md)
  - RPC/XDR and its 192-symbol package surface, transport agents and network
    defaults, Embedding and UX Support, MacIvory's 161-symbol Toolbox boundary,
    Keyboard Control, HyperCard/Mac-Dex, DBFS Utilities, and platform conditions.
- [CL-HTTP and the contributed Web systems](../cl-http-and-contributed-web-systems.md)
  - Server, clients, proxy, W3P, W4, Lambda IR, Showable Procedures/Btree,
    complete direct controls, bundled examples, security findings, and the
    verified unloaded base-world boundary.
- [The Genera HACKS demonstration suite](genera-hacks-demonstration-suite.md)
  - All 18 registered HACKS descriptors, their individual purposes,
    implementations, controls, lineage, HACKS 440 provenance, and the exact
    unloaded-world and descriptor-path runtime boundary.
- [Product and programming examples in Genera](../product-and-programming-examples.md)
  - Every bounded Core, Joshua/Jericho, Statice, Color, and CL-HTTP example file;
    all fourteen concrete example program frameworks; their complete direct
    controls, dependencies, side effects, source findings, and runtime blockers.
- [FED and the Font Editor generations](../fed-and-font-editor-generations.md)
  - Genera's Bitmap Editor-derived Font Editor in its exact historical lineage,
  complete inherited controls and formats, and the separately named unresolved FED.
- [Bitmap, stipple, and raster paint editors](../bitmap-stipple-and-raster-paint-editors.md)
  - The shared raster-plane editor, standalone Bitmap Editor, Stipple Editor,
  inherited commands and gestures, image/register workflows, and source-level caveats.
- [Genera Graphic Editor and structured drawing](../genera-graphic-editor-and-structured-drawing.md)
  - The object drawing model, complete active command and transform surfaces,
  gestures, native and exported representations, Concordia integration, and
  optional-system runtime boundary.
- [Color systems, the Genera Color Editor, and CADR color experiments](../color-systems-and-color-editor.md)
  - Indexed and direct-color architecture, complete Color Editor and Color Palette
  menus and gestures, palette serialization, controller boundaries, and the exact
  disconnected optional-load result.
- [Hardcopy, Press, printing, and plot output](../hardcopy-press-printing-and-plot-output.md)
  - The Hardcopy format/device registry, typed file and screen-capture forms,
  client integrations, printer queues, Print Spooler, and PostScript output and
  interpretation, compared with the public CADR output families.
- [Images, drawing primitives, and visual-asset substrates](../images-drawing-and-visual-asset-substrates.md)
  - Essential Image, Image Substrate, Images, native and interchange formats,
  BITBLT/Dynamic Windows drawing, compression, FrameThrower, API/UI surfaces, and
  the complete installed visual-asset census.

## Assets

- [Curated Genera runtime screenshots](../assets/genera-screenshots/) - Thirty-one
  capture-specific-reviewed application states with exact raw mappings, action-prefix
  provenance, image hashes, shutdown evidence, fair-use scope, and project-license
  exclusion.

For launch and host-integration instructions, see the root
[Open Genera guide](../../README.md#open-genera).
