# MIT CADR and LM-3

This collection covers the MIT CADR Lisp Machine lineage represented in the museum by
the public LM-3 software and the `usim` emulator.

## Articles

- [Software areas and applications on the MIT CADR and LM-3](software-areas-and-applications.md)
  provides a release-bounded census of interactive applications, programming tools,
  services, storage and network facilities, engineering software, and games, plus
  all 55 maintained-tree `DEFSYSTEM` names and 34 canonical demo source files.
- [How CLIM was used across the CADR and Genera software catalogs](../clim-use-across-lisp-machine-software.md)
  records the pre-CLIM TV and EINE/ZWEI boundary for every CADR topic and contrasts
  it with later Genera CLIM applications, ports, integrations, and native alternatives.
- [The MIT Lisp Machine Lisp Listener](lisp-listener.md) documents the per-window
  REPL, input editing, histories, process and package state, complete controls, and
  a fresh System 303 multiple-value observation.
- [Lisp Listeners and editable input reimplementation specification](../lisp-listeners-reimplementation-specification.md)
  gives the release-selectable System 46 and System 303 reconstruction contract,
  including ZDT/ZTOP, failures, screenshots, oracle gaps, and conformance tests.
- [Reimplementation specification coverage](../reimplementation-specification-coverage.md)
  tracks the finite D01-D60 specification worklist across CADR, LM-3, and Genera.
- [TV window-system reimplementation specification](tv-window-system-reimplementation-specification.md)
  gives a reconstruction-grade, release-selectable contract for System 46 and
  maintained System 303 raster, sheet, exposure, stream, selection, input, menu,
  frame, constraint, typeout, and environment behavior, with conformance tests.
- [System Menu and program selection](system-menu-and-select.md) compares the
  pointer menu, System-key registry, recent-window stack, screen layouts, and
  creation-versus-reuse rules in System 46 and System 303.
- [Program selection, activities, and window management reimplementation specification](../program-selection-activities-and-window-management-reimplementation-specification.md)
  gives the release-selectable System 46 and System 303 contract for System-key and
  pointer selection, dynamic menu registries, Split Screen, live layouts, errors,
  visible states, and objective conformance tests.
- [Screen Editor and Frame-Up layout design reimplementation specification](../screen-editor-and-frame-up-layout-design-reimplementation-specification.md)
  gives the System 46 and maintained System 303 live Screen Editor contract,
  including complete staged pointer and typed-input trees, snapshots, Undo, geometry, attributes,
  partial failures, screenshots, and release-discriminating tests.
- [Screen Editor and Frame-Up](../screen-editor-and-frame-up.md) traces the
  live-window Screen Editor from System 46 through System 303 and Genera, inventories
  its complete pointer command surface, and distinguishes it from Frame-Up.
- [Directory, difference, and buffer editors](../directory-difference-and-buffer-editors.md)
  inventories Dired, BDired, and Edit Buffers commands and object models, including
  a runtime-confirmed System 303 unmark defect.
- [File systems and file service](../file-systems-and-file-service.md) separates the
  generic pathname/stream interface from System 46 QFILE, System 303 Local-File and
  LMFILE stores, and the QFILE and LMFILE server families, with exact protocol audits.
- [Help, self-documentation, and Document Examiner](../help-self-documentation-and-document-examiner.md)
  documents CADR editor, System, Lisp, and flavor Help and compares them with the
  later Genera application.
- [D07 reimplementation specification](../help-self-documentation-and-document-examiner-reimplementation-specification.md)
  gives separate System 46 and System 303 dispatcher, registry, documentation,
  defect, runtime-oracle, and conformance profiles.
- [The MIT Lisp Machine Inspector](inspector.md) inventories object displays,
  history, navigation and mutation controls, and a synthetic-object runtime study.
- [Peek on the MIT Lisp Machine](peek.md) documents every registered status mode,
  keyboard control and object menu in the pinned releases, with a fresh process view.
- [Flavors, classes, CLOS, and the Flavor Examiner](../flavors-clos-and-flavor-examiner.md)
  documents the CADR Flavors and entity/class facilities, every release-bounded
  ZWEI inspection command, and their later relationship to Genera's separate tools.
- [The MIT CADR Error Handler and Window Debugger](error-handler-and-debuggers.md)
  covers error dispatch, every ordinary and graphical control, live stack-frame
  behavior, and reviewed ordinary/window debugger captures.
- [Trace, Stepper, breakpoints, and call analysis](../trace-stepper-breakpoints-and-call-analysis.md)
  inventories execution-analysis controls and source/runtime findings from System 46
  and System 303 through their Genera successors.
- [Metering and performance analysis](../metering-and-performance-analysis.md)
  distinguishes System 46 LMETER and page tracing, LM-3 event metering, and the
  later layered Genera tools, with complete source-bounded control inventories.
- [Disk labels, packs, checkout, and file-system repair](disk-labels-packs-and-file-system-repair.md)
  separates DLEDIT, partition and load-band operations, destructive checkout,
  LMFILE pack/volume management, garbage collection, salvage, and bad-pack recovery.
- [Tape systems and the Tape Utility Frame](../tape-systems-and-tape-utility-frame.md)
  establishes the System 46 absence and documents the later LMI-derived System 303
  Tape stack, four configured formats, complete user API, and every TFrame mode,
  command, option, gesture, and device/runtime boundary.
- [ZMail on the MIT CADR and LM-3](zmail.md) studies the maintained mail reader,
  composition integration, architecture, and exact base-band load boundary; its
  [command and keybinding companion](zmail-keybindings.md) inventories the complete
  audited command surface.
- [ZMail filters, universes, and Profile semantics](zmail-filter-universe-profile-semantics.md)
  specifies the public System 303 definition languages, persistence and failure
  order, historical defects, and all 69 selected user-option declarations.
- [ZMail named-command effect closure](../zmail-command-effect-closure.md) gives the
  ordered applicability, mutations, delegation, partial failures, and ownership of
  all 86 System 303 commands; [mail-file format semantics](../zmail-mail-file-format-semantics.md)
  specifies the exact public parsers, serializers, properties, and damaged-input
  behavior.
- [D08 ZMail and mail composition reimplementation specification](../zmail-and-mail-composition-reimplementation-specification.md)
  keeps System 46's composition-only implementation separate from the maintained
  System 303 reader and composer, with exact effective input trees, mail-file and
  submission ordering, partial failures, runtime blockers, and conformance tests.
- [Converse, direct messages, and notifications](../converse-direct-messages-and-notifications.md)
  traces System 46 QSend into maintained System 303 Converse, SHOUT, and NOTIFY,
  inventories their controls, and records the exact tested-band load blocker.
- [SUPDUP, Telnet, and the Genera Terminal program](../network-terminal-applications.md)
  documents the CADR two-process NVT architecture, complete Network-key controls,
  SUPDUP/Telnet protocol behavior, and the later Genera redesign.
- [Network services and site utilities](../network-services-and-site-utilities.md)
  inventories the System 46 and live System 303 Chaos contacts, Hostat/Finger,
  EFTP entry points, security-sensitive EVAL/Telnet/remote-disk services, MIT-local
  building utilities, and their later Genera counterparts.
- [Network transports and protocol architecture](../network-transports-and-protocol-architecture.md)
  compares System 46 Chaosnet, EFTP and QFILE with maintained System 303 routing,
  broadcast, Lambda 3Com Ethernet, address resolution, controller tools, and
  explicit preserved-band limits.
- [CADR microcode, microassembler, and console debugger](cadr-microcode-microassembler-and-console-debugger.md)
  reconstructs the 23-module UCODE build, two-pass assembler and output formats,
  incremental microassembly, remote-object inspection, and every release-bounded CC
  control while preserving the separate-debuggee safety boundary.
- [CADR diagnostics, checkout, and hardware tools](cadr-diagnostics-checkout-and-hardware-tools.md)
  documents ordered machine and memory tests, destructive disk checkout, PROM and
  embedded-controller workflows, the continuity/probe test stand, and the complete
  source-bounded Chaos-board test surface.
- [Emergency Break and the cold-load stream](../emergency-break-and-cold-load-stream.md)
  explains the independent recovery console across CADR, LM-3, and Genera and
  includes a verified System 303 evaluation.
- [Emergency Break and degraded interaction paths reimplementation specification](../emergency-break-and-degraded-interaction-paths-reimplementation-specification.md)
  defines separate System 46 and System 303 entry, cold-reader, breakpoint,
  exact debugger-transition, ownership, failure, visual, and complete D04-owned
  input-tree profiles.
- [EINE, the first Lisp Machine editor](eine.md) studies the exact late-1977
  recipe-derived source corpus, definition-oriented file model, graphical
  interaction, and source-visible incomplete behavior; its
  [binding companion](eine-keybindings.md) inventories every initial keyboard,
  prefix, named-command, Help, minibuffer, EDT, and mouse entry.
- [ZWEI and Zmacs on the MIT CADR and LM-3](zwei-and-zmacs.md) documents the
  reusable editing substrate, Zmacs application, public System 46 source gap,
  maintained System 303 implementation, and verified runtime behavior; its
  [binding companion](zwei-zmacs-keybindings.md) gives release-bounded effective
  trees.
- [EINE, ZWEI, and Zmacs editor-family reimplementation
  specification](../eine-zwei-and-zmacs-editor-family-reimplementation-specification.md)
  defines the data, operation, complete input-tree, lifecycle, failure, visual,
  and conformance contracts for the public profiles without filling the missing
  System 46 Zmacs layer from a later release.
- [Directory, difference, and buffer editors reimplementation
  specification](../directory-difference-and-buffer-editors-reimplementation-specification.md)
  defines the public System 46 Dired and maintained System 303 Dired, BDired,
  Edit Buffers, List Buffers, and Kill Or Save Buffers profiles, including their
  complete local and incorporated inherited inputs and partial-effect order.
- [Operating CADR through the Xvfb computer-use harness](cadr-computer-use-harness.md)
  documents the sentinel-owned private-session architecture, hardened screenshot
  provenance, shared-executable verification, observed System 303 interactions, and
  the current warm-resume limitation.
- [CADR site data, login, and Site Editor](site-data-login-and-site-editor.md)
  separates System 46 hand-maintained tables, maintained System 303 site generation,
  and the later LMI/Gigamos Site Data Editor with complete controls and lineage.
- [Background services and operations dashboards](../background-services-and-operations-dashboards.md)
  documents CADR background-process recovery and the maintained FILE/LMFILE server
  operator surfaces without inventing a unified CADR dashboard.
- [Lisp runtime, compiler, and development environment](../lisp-runtime-compiler-and-development-environment.md)
  inventories the System 46 and System 303 runtime/compiler layers and includes a
  controlled System 303 compilation, macroexpansion, and disassembly comparison.
- [Symbolics C, FORTRAN, and Pascal environments](../symbolics-c-fortran-and-pascal-environments.md)
  documents the later integrated Genera products while bounding CADR and LM-3
  evidence to editing modes such as PL/I, TECO, and MIDAS rather than treating a
  mode name as proof that a compiler product shipped.
- [System construction, patches, worlds, bands, and distribution](../system-construction-patches-worlds-and-distribution.md)
  documents Make-System, patches, cold-load and load-band construction, release
  aggregates, and how those mechanisms differ from later Genera worlds.
- [Source comparison, Compare/Merge, and version control](../source-comparison-compare-merge-and-version-control.md)
  gives complete System 46 and System 303 SRCCOM inventories and distinguishes them
  from Genera's separately delivered versioning products.
- [Formatting, spelling, and text production utilities](../formatting-spelling-and-text-production-utilities.md)
  inventories the CADR and maintained LM-3 `FORMAT`, `FQUERY`, grinder, dribble,
  Ispell, Bolio, font, and editor text-production layers and compares them with Genera.
- [Concordia, structured documentation, and book design](../concordia-document-and-book-design.md)
  documents the later Genera authoring product while preserving the narrower public
  LM-3 bug/release-record evidence for Basic Sage and Writer Tools without claiming
  that their absent implementation runs in the museum band.
- [Mathematical and numeric facilities on CADR and Genera](../mathematical-and-numeric-facilities.md)
  gives the complete System 46/System 303 `MATH` API, rational and complex layer,
  infix grammar, algorithms, source/manual differences, and controlled runtime study.
- [Macsyma 421 on Lisp machines](../macsyma-421-symbolic-mathematics-environment.md)
  corrects the public-tree “editor mode only” boundary with contemporary port and
  LM-3 world evidence, then documents the later Symbolics product without treating
  licensed 421 media as public CADR source.
- [Joshua rule and inference environment](../joshua-rule-and-inference-environment.md)
  documents the later Symbolics product while bounding the public CADR/LM-3 evidence
  to AMORD and LMTMS records; it does not turn those earlier names into the exact
  Joshua 237 implementation.
- [Dynamic Windows and presentation-based interaction](../dynamic-windows-and-presentation-based-interaction.md)
  documents CADR TV frames, menus, choices, pointer tracking, highlighting, and
  who-line documentation as specific antecedents rather than as Dynamic Windows itself.
- [FED and the Font Editor generations](../fed-and-font-editor-generations.md)
  separates old-window FED, XFED, new-window/NFED lineage, maintained System 303
  FED, their complete controls and formats, and the later Genera Font Editor.
- [Bitmap, stipple, and raster paint editors](../bitmap-stipple-and-raster-paint-editors.md)
  reconstructs the two PAINT/NPAINT source generations, complete menus, keys,
  mouse-switch behavior, formats, implementation gaps, and present runtime boundary.
- [Images, drawing primitives, and visual-asset substrates](../images-drawing-and-visual-asset-substrates.md)
  places the public CADR BITBLT, picture, scan, font/sprite, paint-pattern, and SUDS
  evidence beside Genera's later layered image infrastructure without claiming a
  single application or unsupported lineage.
- [Hardcopy, Press, printing, and plot output](../hardcopy-press-printing-and-plot-output.md)
  documents the public Press writer and Dover paths, XGP scan encoding and queue
  records, DPLT's two-pass SUDS conversion, Versatec UNIBUS output, and the later
  LM-3 generic dispatcher and Terminal-Q capture contract.
- [MIT CADR on-line help and documentation recovery](online-help-and-documentation-recovery.md)
  explains ZWEI self-documentation, Lisp and flavor metadata, key and application
  Help handlers, the tracked 949-declaration System 46 recovery, and the
  metadata-only LM-3 cross-check.
- [Visual assets in the MIT CADR and LM-3 software](visual-assets-inventory.md)
  inventories the native picture, sprite-font, paint-pattern, SUDS drawing, and
  procedural graphics forms, with a local-only decoder for two standalone System 46
  pictures.
- [Color inks and raster patterns in the MIT CADR software](color-inks-and-raster-patterns.md)
  explains why `COLOR-INKS` is a legacy solid-fill cache rather than a fixed
  palette, shows the source-defined color maps, and distinguishes the window
  system's named gray stipples.
- [Color systems, the Genera Color Editor, and CADR color experiments](../color-systems-and-color-editor.md)
  documents the four-bit indexed color screen, sixteen mutable map entries, and
  source-grounded behavior of COLORHACK, COLXOR, and CAFE while keeping them
  distinct from the later Genera editor.
- [MUNCH and Munching Squares on the MIT CADR](munch.md) explains the classic
  PDP-1-derived XOR display algorithm, its interactive switch register, and the
  distinct System 46 and LM-3 System 303 implementations.
- [LEXIPHAGE, the Lisp Machine word eater](lexiphage.md) traces the text-eating
  animation through its compact CADR, later LM-3, and separate PDP-10 TV source
  forms, including its `43VXMS` font use and evidence-bounded attribution.
- [DOCTOR, the ELIZA-style conversational program](doctor.md) reconstructs the
  engine and complete `DOCSCR` rule architecture, controls, lineage, source-visible
  defects, and a reviewed live synthetic conversation that confirms the maintained
  `10-4` regression.
- [CADR HACKS, display, sound, and novelty programs](cadr-hacks-display-sound-and-novelty-suite.md)
  gives every active HACKS component, omitted canonical demo, and compiled support
  object its own source-grounded section, with complete controls, dependencies, and
  a reviewed live QIX capture.
- [Spacewar on the MIT Lisp Machine](spacewar-on-the-lisp-machine.md) documents the
  complete two-player controls, physics, collision and hyperspace rules, tunable
  parameters, `SHIP` sprite-font architecture, System 46-to-303 changes, and a
  reviewed live System 303 playfield capture.
- [MIT CADR font sources and recovery](font-sources-and-recovery.md) explains how the
  public source representations are decoded into the tracked BDF fonts and PNG font
  sheets, without reading a load band or VLOD.
- [MIT CADR compiled QFASL font recovery](compiled-qfasl-font-recovery.md) explains
  the separate non-evaluating recovery of 19 public serialized runtime font objects,
  including exact source cross-checks and two older compiled versions.
- [Compiled objects, QFASL, relocation, and UNFASL](../compiled-objects-qfasl-relocation-and-unfasl.md)
  documents the complete release-bounded operation tables, REL section model,
  inspection interface, runtime check, and realistic source-recovery limits.
- [MIT CADR font usage audit](font-usage-audit.md) records the evidence-backed role
  or explicit `TODO` boundary for every source-backed and compiled-only font name.

## Generated assets and local outputs

- [Curated MIT CADR runtime screenshots](../assets/mit-cadr-screenshots/) contain
  nineteen reviewed System 303 application captures—eighteen exact full
  framebuffers and one documented complete-window crop—with session provenance and
  an asset-specific fair-use review; the PNGs are excluded from any project-wide
  license.
- [MIT CADR System 46 on-line help assets](../assets/mit-cadr-online-help/)
  contain four standalone files, 89 exact source-context files, the public source
  license, and machine-readable and readable catalogs.
- Reconstructed `10LEAF` and `SCANIN CWH3` pictures intentionally remain untracked
  under `build/visual-assets/mit-cadr/` while their content rights are unresolved.
- [CADR color-map specimen](../assets/mit-cadr-color-inks/palettes.png) shows three
  idealized, source-derived mappings of the sixteen four-bit pixel indexes.
- [MIT CADR font assets](../assets/mit-cadr-fonts/) contains the source-provenance
  catalog, 150 BDF fonts, 150 font-sheet images, and a copy of the public source
  license.
- [MIT CADR compiled QFASL font assets](../assets/mit-cadr-qfasl-fonts/) contains the
  compiled-artifact catalog and 19 BDF, normalized JSON, and PNG sheet exports.
- [MIT CADR font usage catalog](font-usage-catalog.json) is the machine-readable
  companion to the per-font source audit.

## Further synthesis

- a dedicated provenance and lineage history of the LM-3 Fossil repositories and
  restoration branches, synthesizing the pinned evidence already recorded in the
  individual articles.

For current launch, build, and LOD-inspection commands, see the root
[CADR / LM-3 guide](../../README.md#cadr--lm-3).
