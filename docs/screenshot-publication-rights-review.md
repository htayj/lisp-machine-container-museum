---
type: Rights Review
title: Publishing runtime screenshots for museum documentation
description: Capture-specific U.S. copyright review and publication policy for CADR and Genera runtime screenshots used as historical evidence.
tags: [screenshots, copyright, fair-use, preservation, cadr, genera]
timestamp: 2026-07-19T13:47:58-04:00
---

# Publishing runtime screenshots for museum documentation

The selected CADR System 303 and Genera 8.5 runtime screenshots reviewed here
may be published in this museum as evidence beside criticism, scholarship, and
historical analysis. The basis is a documented application of U.S. fair use,
not a claim that every screenshot is public domain, licensed by the vendor, or
automatically lawful in every context and jurisdiction.

This conclusion covers a small, purposeful set of actual runtime captures. It
does not cover raw session dumps, decorative galleries, extracted assets,
substantial documentation payloads, or arbitrary third-party material that a
system happens to display.

## Capture-specific conclusion

The following System 303 captures passed review and are published in the
[curated CADR screenshot catalog](assets/mit-cadr-screenshots/index.md):

| Curated capture | Documentary purpose | Conclusion |
| --- | --- | --- |
| `zmacs-lisp-buffer.png` | Shows the fresh Zmacs Lisp buffer and its mode line after evaluating `(ED T)` | Publish beside analysis of editor entry and initial mode |
| `zwei-help-menu.png` | Shows the result of pressing `Help` twice and the live self-documentation dispatcher | Publish only beside analysis of that dispatcher; do not reuse as a general help-text extract |
| `zmacs-text-mode.png` | Shows the mode-line result of invoking `Meta-X Text Mode` | Publish beside the mode-transition analysis |
| `zmacs-lisp-mode.png` | Shows the mode line after invoking `Meta-X Lisp Mode` | Publish beside the mode-transition analysis |
| `emergency-break-cold-load-evaluation.png` | Shows the degraded cold-load-stream breakpoint accepting the researcher-entered form `(+ 40 2)` and printing `42` over the saved listener display | Publish only beside analysis of the independent recovery console and the present harness limitation; do not reuse as a generic Lisp Machine illustration |
| `lisp-listener-multiple-values.png` | Shows the Listener printing the two values of the researcher-entered form `(values 7 8)` | Publish beside analysis of Listener evaluation and multiple-value display |
| `system-menu.png` | Shows the live three-column System Menu and its functional window-management labels | Publish beside analysis that cross-checks the observed menu against the pinned implementation |
| `inspector-list.png` | Shows the Inspector displaying the researcher-created list `'(museum listener inspector peek)` | Publish beside analysis of Inspector layout, history, and object presentation; do not generalize the synthetic object to other inspected types |
| `peek-processes.png` | Shows Peek's live Active Processes table without opening or operating a destructive action menu | Publish beside analysis of Peek's process-monitoring mode and source-defined columns |
| `screen-editor-menu.png` | Shows the complete 15-item live Screen Editor menu and operation-specific pointer documentation without applying a geometry change | Publish beside the release/source comparison of Screen Editor controls; do not reuse as a generic CADR illustration |
| `describe-flavor-lisp-listener.png` | Shows the first page of Zmacs's source-grounded `Describe Flavor` report for the system's own `TV:LISP-LISTENER` flavor, including component order, state, methods, and pagination | Publish beside the object-system inspection analysis; do not present the first page as a complete dump or reuse it as a generic CADR illustration |
| `error-handler-dynamic-choices.png` | Shows a researcher-created condition in the ordinary Error Handler together with its live context and dynamically computed proceed choices | Publish beside debugger analysis; the synthetic error does not authorize publication of unrelated debugger sessions or user data |
| `window-error-handler.png` | Shows the independent window-oriented Error Handler and its functional proceed interface for a second synthetic condition | Publish only for comparison with the ordinary handler and source-defined window behavior |
| `trace-step-and-who-calls.png` | Shows trace output, entry into and exit from Step, and a `Who Calls` result for researcher-defined functions | Publish beside analysis of the three tools; do not generalize the one call-analysis result to completeness across compiled and interpreted code |
| `compiler-macroexpand-disassembly.png` | Shows compilation, result `81`, a one-step macroexpansion, and CADR disassembly for one researcher-written function | Publish beside the cross-system runtime/compiler analysis; no installed source, Help prose, manual text, or user data is displayed |
| `network-service-registry.png` | Shows the exact thirteen-contact System 303 Chaos registry, two security-sensitive gate values, and six function-presence results without invoking a service | Publish only beside analysis of the service inventory, defaults, and load-band boundary; the screen does not authorize service access, network bridging, or publication of real peer responses |
| `spacewar-game.png` | Shows the complete live Spacewar playfield after loading the public source and public `SHIP` sprite font, with both ships and the central sun | Publish only beside the source/runtime game analysis; the 768-by-770 crop removes an unrelated debugger and retains no source listing, Help prose, manual text, or proprietary Genera material |
| `doctor-conversation.png` | Shows three responses from public CADR DOCTOR source to researcher-written statements about computer preservation and history | Publish only beside the source/runtime conversational analysis; no private conversation, substantial script corpus, manual prose, or licensed Genera material is displayed |
| `qix-live.png` | Shows the public CADR `NQIX` implementation's evolving XOR line trail in the full Listener interior | Publish only beside analysis of QIX and the HACKS suite; the single functional state is not a general screenshot gallery or evidence that the other hardware-, color-, data-, or service-dependent demos ran |
| `edit-buffers.png` | Shows the initial System 303 Edit Buffers list, four action columns, two session-local buffer names, and read-only mode line | Publish beside the D06 architecture and compatibility analysis; do not infer the later mark transitions, `U` defect, destructive effects, or Dired behavior from the image |

The corresponding Genera review covered local sessions `zmacs-research`,
`core-dossiers-20260718`, `layout-tools-20260718`,
`debuggers-d12-genera-20260718`, `d06-d07-genera-20260718`,
`flavors-d16-genera-20260718`, `d13-analysis-genera-20260718`,
`zmail-d08-genera-20260718`, `d11-presentation-inspector-20260718`, and
`d09-converse-notifications-genera-20260718`, `d20-namespace-editor`,
`d22-runtime-compiler-genera-20260718`, and
`d28-d29-ui-clim-20260718`, and `d35-hardcopy-20260718`, with the
generation numbers recorded in the asset catalog, plus
`d46-network-services-genera-20260718`, generation 2, and
`d04-emergency-break-publication-20260719`, generation 1, and
`d06-edit-buffers-genera-20260719`, generation 1. The first sessions were
captured on 2026-07-18 and the D04 and D06 sessions on 2026-07-19 from the same
identified Genera 8.5 world. Thirty-three screens
passed review for publication in the
[curated Genera screenshot catalog](assets/genera-screenshots/index.md):

| Curated capture | Documentary purpose | Conclusion |
| --- | --- | --- |
| `zmacs-editor-menu.png` | Shows the editor's short functional menu while the right button is held | Publish beside analysis of the editor menu |
| `zmacs-help-dispatcher.png` | Shows that host `F12` reached the Help dispatcher in this harness | Publish beside the harness-bounded Help observation; do not present `F12` as a Symbolics-keyboard fact |
| `zmacs-two-window-layout.png` | Shows the two-pane result of `Control-X 3` and the new lower buffer | Publish beside analysis of window splitting |
| `zmacs-list-buffers.png` | Shows the presentation-oriented List Buffers typeout report and its new/non-file-buffer legend | Publish beside analysis of buffer reporting; do not relabel it as Edit Buffers |
| `zmacs-list-buffers-pointer-documentation.png` | Shows generic bottom-line mouse documentation while List Buffers is visible | Publish only beside the corrected analysis; it does not prove a row-presentation hit or buffer-specific operation |
| `zmacs-list-buffers-generic-operation-menu.png` | Shows a generic Operation menu while List Buffers is displayed | Publish only for the observed context; the image does not prove a row presentation or buffer-specific menu owner |
| `dynamic-lisp-listener-multiple-values.png` | Shows the Listener printing two values from the researcher-entered form `(values 17 23)` | Publish beside analysis of Listener evaluation and multiple-value display; the startup notice is incidental context, not the publication purpose |
| `system-menu.png` | Shows the observed three-column System Menu and its short functional labels | Publish beside the source/runtime menu comparison; the startup notice is incidental context, not the publication purpose |
| `emergency-break-arithmetic-evaluation.png` | Shows the separately targeted cold-load client identifying Emergency Break and the cold-load breakpoint, then evaluating the researcher-entered form `(+ 40 2)` to `42` | Publish only beside the D04 recovery-console analysis and specification; do not reuse as a generic Genera or Lisp Machine illustration |
| `inspector-list.png` | Shows the Inspector displaying the project-owned probe `'(alpha (beta . gamma) #(1 2 3))` | Publish beside analysis of Inspector panes, history, and the observed menu discrepancy; no licensed source is displayed |
| `peek-processes.png` | Shows Peek's live process and timer headings without exposing a Help screen or choosing a process operation | Publish beside analysis of the Processes mode and the source-defined table structure |
| `frame-up-split-layout.png` | Shows the researcher-created two-pane Frame-Up model and short Command Processor transcript after splitting the default pane | Publish beside the source/manual analysis of Frame-Up's pane model and horizontal-split semantics, including the Dynamic Windows program-framework analysis; no licensed source or Help prose is displayed |
| `debugger-dynamic-choices.png` | Shows the ordinary Debugger for a researcher-created condition, its selected frame, and two condition-specific restart choices before any proceed operation | Publish beside the condition-system and Debugger analysis; do not reuse as a generic error illustration |
| `display-debugger-layout.png` | Shows the pane-oriented Display Debugger after the article's explicitly documented internal-entry caveat, with the retained synthetic condition and functional pane arrangement | Publish only beside that caveated layout analysis; do not present the nested history-pane condition as normal supported entry behavior |
| `screen-editor-menu.png` | Shows the complete functional Screen Editor menu reached from the live System Menu before exiting without a geometry change | Publish beside the source/runtime Screen Editor comparison; do not treat it as a reusable Genera menu gallery image |
| `document-examiner-initial.png` | Shows the sparse initial Standard Document Examiner frame, six functional surfaces, short document-family titles, and eight-item menu before Help prose is requested | Publish beside layout and command-surface analysis; richer Help and candidate screens remain untracked |
| `flavor-examiner-three-result-history.png` | Shows three nonmutating inspections of `DW:PROGRAM-FRAME` retained in the Flavor Examiner's source-defined history rotation | Publish beside object-system analysis; do not present the displayed result panes as a complete source or definition dump |
| `clos-standard-object-superclasses.png` | Shows the short result of the separate CLOS superclass command for `CLOS:STANDARD-OBJECT` | Publish beside the Flavors/CLOS boundary analysis; the three-line result is functional evidence, not a class-library extract |
| `trace-and-step-entry.png` | Shows trace entry/exit and the live Step `Eval:` prompt for researcher-owned functions, retaining initial empty breakpoint and callers-mode observations | Publish beside the trace/Stepper integration analysis; do not infer undocumented key behavior from the image |
| `zmail-reader-empty.png` | Shows the empty live Zmail summary/message layout, 20-cell main menu, and three short operational hints after local login, without displaying user mail | Publish beside analysis of the reader architecture and live entry path; the short hints supply necessary functional context and do not authorize publication of message content or fuller Help prose |
| `zmacs-text-mail-template.png` | Shows a blank Zmacs Text Mail template, body separator, and mode line, without a recipient or message body | Publish beside analysis distinguishing the embedded composition mode from the Zmail reader; do not use it as a mail-content illustration |
| `presentation-inspector-integer.png` | Shows the Presentation Inspector's three functional surfaces, complete ten-command menu, copied contexts, and researcher-entered integer `42` | Publish beside analysis of the frame architecture, invocation, and lifecycle; the synthetic object does not authorize unrelated inspection sessions |
| `presentation-inspector-handler-report.png` | Shows the first live all-presentations report page for the synthetic integer, including effective priorities, gestures, menus, and categorized handler candidates | Publish beside the Presentation Inspector or Dynamic Windows handler-matching analysis; do not present it as a general handler database extract or publish the exploratory report sequence |
| `converse-empty.png` | Shows a fresh Converse editor containing only its functional `To:` template, structural separator, scrollbar, and short send/exit mode-line summary | Publish beside analysis of Converse's editor model and entry state; the blank form does not authorize publication of real conversations, addresses, or substantial local Help prose |
| `notifications-synthetic-record.png` | Shows the separate Notifications title/typeout/menu frame containing one researcher-authored `TV:NOTIFY` record | Publish beside analysis of central notification retention and the viewer boundary; do not use it as permission to publish real system, user, network, or service notifications |
| `namespace-editor-empty.png` | Shows the Namespace Editor's empty-object frame, prompt, pane division, and complete thirteen-command menu without any configured object or site data | Publish beside the source/manual analysis of the frame and command surface; do not use it as permission to publish configured namespace records or fuller Help prose |
| `compiler-macroexpand-disassembly.png` | Shows the interpreted-to-compiled transition, result `81`, Common Lisp macroexpansion, and Ivory disassembly for one researcher-written function | Publish beside the compiler comparison; the synthetic form and functional output do not authorize publication of licensed source listings |
| `lisp-context-gc-status.png` | Shows read-only language-context and garbage-collector status, including clearly volatile counts and capacities | Publish beside the runtime architecture analysis; do not generalize the measured values into release constants or use the screen as a decorative system-status image |
| `accepting-values-gc-options.png` | Shows the live typed GC-options form with operational choices, current volatile values, a pointer over its printed Abort presentation, and the resulting context-sensitive mouse documentation | Publish only beside the Dynamic Windows analysis of Accepting Values, typed fields, presentations, redisplay, and abort behavior; do not treat current settings as release defaults or reuse the screen as a general configuration guide |
| `hardcopy-file-options.png` | Shows the complete typed Hardcopy File form and the exact six live format choices while no printer or request is selected | Publish the cropped form only beside analysis of the Hardcopy command and live registry; do not infer successful printer configuration or output from unsubmitted defaults |
| `screen-hardcopy-options.png` | Shows the complete Screen hardcopy option form, including capture sources, cursor inclusion, destination, announcement, and shutter-trigger controls | Publish the cropped form only beside Function-Q analysis; do not infer that a capture, file write, or printer submission occurred |
| `network-service-registry-disabled.png` | Shows a researcher-entered read-only report of server policy, 47 core registrations, and selected registered/enabled pairs, all disabled, with optional Domain and Site-NAMES contacts absent | Publish only beside analysis of service registration, enablement, and the base-world load boundary; no service output, configured site data, installed Help, or network transaction is shown |
| `zmacs-edit-buffers-marked-delete.png` | Shows the true Edit Buffers application after exact recorded `Control-X Control-Shift-B` input and the visible `D` action produced by lowercase `d` | Publish beside D06 analysis of Edit Buffers' row/action model; no deletion was executed, and the image does not establish `Abort`, List Buffers, Dired, or source-to-world identity |

These screens contain functional interface layout, short labels, status
information, blank forms, and researcher-entered text. Genera captures that retain startup context also
contain the short release copyright and unconfigured-site notices that the world
displayed before the documented interaction; those notices are retained because
the surrounding Listener and menu geometry is part of the runtime evidence, not
to republish the notices as standalone text. The Genera Emergency Break capture
instead contains only a short cold-load-stream announcement, package and breakpoint
status, one recovery instruction, and the researcher-entered arithmetic probe needed
to identify and verify the recovery path. They do
not reproduce source files, fonts, a manual chapter, a demonstration image, or a
useful substitute for the software. These reviewed complete states are the minimum
needed to distinguish Zmail from Zwei Mail mode, to establish both the Presentation
Inspector frame and the report whose implementation the article analyzes, and to
distinguish blank Converse from a Notifications history containing controlled
research input, to establish the Namespace Editor's real empty-object layout
without exposing site data, to compare actual compiler output and read-only
runtime state without showing licensed source, to establish the live typed-form
and presentation-sensitive abort behavior of Accepting Values, and to verify the
Hardcopy registries and option structure without reproducing the unrelated Listener
or exploratory Debugger, and to distinguish a registered service from an enabled
one without publishing any request or response. Their reviewed raw
source names and exact hashes are retained in the
curated catalog.

The Genera full-Help and command-list captures were not approved as a bulk
publication set. A particular screen containing more installed explanatory
prose can still receive a separate review when the prose itself is necessary to
an article's analysis, but convenience or visual interest is not enough.

### Reimplementation-specification reuse reviewed 2026-07-19

The exact `lisp-listener-multiple-values.png` and
`dynamic-lisp-listener-multiple-values.png` files were separately reassessed for
the [Lisp Listeners and editable input reimplementation specification](lisp-listeners-reimplementation-specification.md).
That page uses one frame from each system beside narrower analysis of the visible
Listener regions, input cursor, value-line ordering, and release-specific window
substrate. It adds no pixels, source, Help prose, or decorative use. The two frames
are the minimum needed to make the cross-release visual contract checkable and do
not substitute for either system. The capture-specific conclusions above therefore
support this additional scholarly use. This paragraph approves no other screenshot
for specification reuse.

### Program-selection specification reuse reviewed 2026-07-19

The exact CADR and Genera `system-menu.png` files were separately reassessed for the
[program selection, activities, and window management reimplementation
specification](program-selection-activities-and-window-management-reimplementation-specification.md).
That page uses one sparse frame from each system to compare the visible displayed
menu state: placement, three-column organization, labels, current item box, and
bottom pointer documentation. The Genera frame additionally establishes its title,
border, and drop shadow; those features are not attributed to the CADR frame. The
surrounding startup and Listener text is incidental context. The reuse adds no
pixels, source, Help prose, or decorative use. The images do not establish the
invocation gesture, target-window or registry identity, registry dynamism,
selection/reuse/create order, callback order, destructive-operation results, or
layout identity and persistence; those claims remain action-log-, source-, or
runtime-trace-grounded. These two exact frames are the minimum reviewed images needed
to make the release-specific visual contract checkable. This paragraph approves no
other screenshot for specification reuse.

### D03 Screen Editor and Frame-Up specification reuse reviewed 2026-07-19

The exact CADR `screen-editor-menu.png`, Genera `screen-editor-menu.png`, and Genera
`frame-up-split-layout.png` files were separately reassessed for the
[Screen Editor and Frame-Up layout design reimplementation
specification](screen-editor-and-frame-up-layout-design-reimplementation-specification.md).
That page uses the two menu frames only to constrain the visible release-specific
operation inventories, ordering, label/styling, current item, short pointer
documentation, and surrounding-screen relationship. It uses the Frame-Up frame only
to constrain the researcher-created two-display-pane model, pane labels, horizontal
divider, short typed command transcript, and title/display/interactor/menu regions.

The reuse adds no pixels, source listing, extracted Help, or decorative gallery use.
The images do not establish input dispatch, raw button precedence, object identity,
snapshot freshness, geometry algorithms, mutation, Undo, cleanup, presentation-menu
contents, generated forms, Preview, or source-to-world/build identity; those claims
remain source-, action-log-, trace-, or explicit-oracle-grounded. These three exact
frames are the minimum reviewed images needed to make the D03 cross-release visual
contract checkable. This paragraph approves no other screenshot for specification
reuse.

### D04 Emergency Break specification and Genera capture reviewed 2026-07-19

The exact Genera `emergency-break-arithmetic-evaluation.png` file was reviewed for
the first time, and the already-published CADR
`emergency-break-cold-load-evaluation.png` file was separately reassessed for the
[Emergency Break and degraded interaction paths reimplementation
specification](emergency-break-and-degraded-interaction-paths-reimplementation-specification.md).
The following four-factor conclusion is specific to those exact files on that D04
page.

1. **Purpose and character.** The D04 specification uses one observed recovery
   frame from each runtime-observed system profile to criticize and explain how
   interaction changes when the ordinary window substrate is unavailable. The
   Genera frame verifies the separate cold-load client, Emergency Break and
   breakpoint identity, cold-stream Break evaluation protocol, and
   researcher-entered arithmetic result. The CADR frame verifies the materially
   different primitive overlay and saved-listener relationship, including the
   documented runtime limitation on Resume delivery.
   This nonprofit historical and compatibility-analysis purpose is evidentiary, not
   decorative or a substitute user interface. This factor strongly favors the two
   reviewed uses.
2. **Nature of the displayed work.** The Genera image is a sparse functional console:
   a short recovery heading, package and breakpoint status, one short operational
   instruction, the project-entered `(+ 40 2)` probe, `42`, a prompt, and otherwise
   blank space. It contains no artwork, source, font sheet, Help page, manual prose,
   user data, or third-party media. The CADR image likewise documents primitive
   recovery text and the same synthetic probe over the functional saved screen. This
   factor favors the reviewed uses, while recognizing that particular screen
   expression may still be copyrighted.
3. **Amount and substantiality.** D04 uses one still for each of its C303 and G85
   runtime-observed profiles; no C46 runtime image is claimed. The complete
   1024-by-768 Genera cold-load client is retained because its independent-client
   boundary, position of the small text region, and overwhelming blank area are part
   of the visual contract; nearly all pixels are empty and cropping to the text would
   erase that evidence. The one existing CADR frame is needed to show the contrasting
   overlay relationship. Neither image is part of a sequence or gallery, and the
   pair is a minute portion of two large interactive systems. This factor favors the
   reviewed uses.
4. **Effect on the market.** Neither still can execute a break loop, provide the
   licensed world or public load band, reproduce source or documentation, expose a
   command corpus, or replace any software or screenshot-licensing product. Their
   value comes from the surrounding provenance, source comparison, and conformance
   analysis. This factor strongly favors the reviewed uses.

On balance, the Genera image may be published and both exact images may be embedded
in D04 under this case-specific fair-use rationale. The approval adds no pixels or
licensed payloads, extends no repository license to either screen, and does not
approve either file as a generic illustration, any additional screenshot, richer
debugger or Help screens, or reuse outside the analyzed purpose.

### D05 editor-family specification reuse reviewed 2026-07-19

The exact CADR `zmacs-lisp-buffer.png`, `zwei-help-menu.png`,
`zmacs-text-mode.png`, and `zmacs-lisp-mode.png` files and the exact Genera
`zmacs-editor-menu.png`, `zmacs-help-dispatcher.png`, and
`zmacs-two-window-layout.png` files were separately reassessed
for the [EINE, ZWEI, and Zmacs editor-family reimplementation
specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md).

The D05 page uses the four public-system observations to constrain initial editor
geometry, the staged Help state, and a mode transition. It uses the three Genera
observations to constrain the editor menu, Help state, and two-pane relationship.
The images sit beside source-grounded criticism and conformance requirements;
none is a decorative
illustration or operating substitute. The Help frames contain only the one
functional dispatcher state needed to identify the multistage interface, not a
navigable Help corpus.

Seven complete frames are proportionate because each supplies a distinct visual
state across two release profiles; D05 publishes no full or step-by-step
interaction sequence, EINE facsimile, source listing, font sheet, manual page,
or additional Genera output.
The frames cannot provide the editors, public band, licensed world, source, Help
database, keymap or presentation registry. Their market value derives from the
museum's provenance and analysis. On balance, the existing capture-specific
conclusions support these exact scholarly reuses.

The images establish only the visible anchors named on D05. They do not establish
source-to-band/world identity, hidden table or translator ownership, command
effects, complete Help prose, timing, undo, file mutation, exact fonts, or pixel
identity. This review approves no other D05 screenshot or generic reuse and
extends no project license to the screen displays.

### D06 Edit Buffers captures reviewed 2026-07-19

The exact CADR `edit-buffers.png` and Genera
`zmacs-edit-buffers-marked-delete.png` files were reviewed for the
[directory, difference, and buffer editors reimplementation
specification](directory-difference-and-buffer-editors-reimplementation-specification.md).
This conclusion is limited to those two files on that scholarly page and the
closely linked factual dossier.

1. **Purpose and character.** D06 uses one runtime observation from each selected
   runnable profile to criticize and explain a material implementation change:
   System 303 exposes four independent action columns, while Genera exposes one
   per-row action character. The images make that release-specific visual contract
   independently checkable beside source, manual, and conformance analysis. They
   are not decorative application portraits or operating substitutes. This factor
   strongly favors the reviewed use.
2. **Nature of the displayed work.** Both captures are sparse, predominantly
   functional editor states: a heading, synthetic or default buffer names, status
   columns, a cursor, scrollbar, mode line, and otherwise blank space. They contain
   no source listing, artwork, user file, configured site data, third-party media,
   font sheet, or Help/manual prose. This factor favors the reviewed use while
   recognizing possible copyright in particular screen expression.
3. **Amount and substantiality.** One complete client frame per runtime profile is
   needed to preserve the relationship among heading, row model, action columns,
   mode line, and surrounding blank editor geometry. D06 does not publish the CADR
   Help screen, Dired login prompts, later mark/defect sequence, the Genera unmarked
   baseline, or the post-alias diagnostic frame. Two stills are a minute portion of
   the interactive systems and are not a navigable sequence. This factor favors the
   reviewed use.
4. **Effect on the market.** The two stills cannot execute Edit Buffers, perform a
   buffer action, supply the public load band or licensed world, expose the binding
   tables, reproduce documentation, or substitute for any software or licensed
   publication. Their value comes from the museum's provenance and comparison.
   This factor strongly favors the reviewed use.

On balance, the two exact images may be published for this D06 evidentiary use.
The review does not approve the local CADR Help or `U`-defect captures, any Genera
List Buffers image as a substitute for Edit Buffers, a Dired login prompt as a
directory-listing illustration, destructive action execution, bulk reuse, or a
project license in either screen display. Pixels establish only the visible states;
input dispatch and the Genera `d` transition additionally rely on the recorded
action log, while the older CADR session remains explicitly intermediate evidence.

## U.S. fair-use analysis

[17 U.S.C. section 107](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section107)
identifies criticism, comment, teaching, scholarship, and research as purposes
that may qualify as fair use and requires consideration of four nonexclusive
factors. No factor supplies a mechanical safe harbor.

### 1. Purpose and character

The museum uses each selected image to establish what a preserved system
actually displayed after a recorded interaction. The nearby prose explains the
behavior, the capture identifies the release-bounded observation, and the
image lets a reader verify details that source or manuals alone do not prove.
The reviewed publication is a free museum knowledge-base use: scholarly and
evidentiary rather than advertising, decoration, or a substitute user
interface.

This factor strongly favors the reviewed uses. In
[*Sony Computer Entertainment America v. Bleem*, 214 F.3d 1022](https://law.resource.org/pub/us/case/reporter/F3/214/214.F3d.1022.99-17137.html),
the Ninth Circuit vacated a preliminary injunction against actual videogame
screenshots used in commercial comparative advertising. Accurate captures were
needed to communicate what the software displayed, even in a less favorable
commercial setting. The Copyright Office provides a concise
[case summary](https://www.copyright.gov/fair-use/summaries/sonycomputer-bleem-9thcir2000.pdf).

The conclusion remains use-specific. In
[*Andy Warhol Foundation v. Goldsmith*](https://www.supremecourt.gov/opinions/22pdf/21-869_87ad.pdf),
the Supreme Court emphasized the purpose of the particular challenged use, not
new meaning in the abstract. That is why this policy requires a screenshot to
sit beside analysis of the exact historical or behavioral claim it supports.

### 2. Nature of the displayed work

A software screen can contain copyrightable text or artwork. It can also be
dominated by functional layout, methods of operation, short labels, status
fields, and researcher-entered text. Section
[102(b)](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section102)
does not extend copyright protection to a procedure, process, system, or method
of operation, although a particular expressive depiction can still be
protected.

The Copyright Office's
[Compendium, section 721.10](https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf),
recognizes potentially copyrightable screen text, artwork, and photographs but
also says registration should be refused where a screen-display claim rests
only on layout or format, blank forms, de minimis menus, or purely functional
elements. The reviewed application screens are primarily functional and factual.
The ZWEI Help dispatcher contains more authored prose, so this factor is less
favorable for that image, but the narrow analytical purpose remains strong.

### 3. Amount and substantiality

Most images reproduce one complete visible state because editor geometry, mode
lines, mouse documentation, menu placement, or surrounding context are part of
their evidence. Cropping those elements would impair those claims. The two
Hardcopy images make the opposite capture-specific judgment: only the complete
form is probative, so the unrelated underlying Listener and exploratory Debugger
were removed. The selected stills are nevertheless a minute part of large
interactive systems, and the site does not publish a navigable sequence or
comprehensive screen catalog.

This factor favors the reviewed set. *Sony v. Bleem* treated a handful of full
software screenshots as an insignificant portion of the interactive works.
The Second Circuit likewise found fair use when complete copyrighted posters
and tickets were reproduced at an appropriate scale as historical artifacts in
an explanatory history in
[*Bill Graham Archives v. Dorling Kindersley*, 448 F.3d 605](https://www.law.berkeley.edu/files/Bill_Graham_case.pdf).

### 4. Effect on the potential market

These stills cannot operate CADR or Genera and cannot replace a world image,
source tree, manual, font, help corpus, or other licensed product. Their value
comes from the museum's provenance and analysis. Publishing this small set does
not supply a substitute screenshot library or a substitute for licensing the
systems themselves.

This factor strongly favors publication. The conclusion does not depend on
copyright abandonment or on Symbolics material being public domain. The
repository continues to treat Genera as proprietary and keeps the world,
source, extracted payloads, and raw sessions local.

## CADR and Genera rights boundaries

The public System 46 source license does not automatically license every pixel
drawn by the later maintained LM-3 System 303 environment. The CADR selection
therefore relies on its capture-specific fair-use analysis, with the exact
source and runtime provenance recorded in the curated catalog. Conflicting or
subsystem-specific notices elsewhere in an LM-3 tree are not silently applied
to unrelated editor pixels, nor are they ignored when the displayed content
actually comes from that subsystem.

The inspected Open Genera media marks its software, data, and information as
proprietary and refers use and copying to a written license agreement that is
not present in the inspected release tree. This review does not infer public
domain status, ownership, or vendor permission from that absence. Fair use is a
limitation on U.S. copyright rights; a separately accepted purchase agreement
could present a contract question depending on its actual language and
applicable law. If such an agreement is located, review it rather than
inventing a restriction or assuming that a generic proprietary notice answers
the contract question.

The same copyright analysis applies to the reviewed Genera screenshots because
their publication purpose, amount, and lack of substitution are independent of
whether the running input was licensed. It does not authorize distribution of
the input itself.

## Publication policy

Before tracking a runtime screenshot:

1. Record the system, release, session, action sequence, capture time,
   dimensions, PNG hash, decoded-pixel hash, and shutdown or forced-stop state.
2. State the precise criticism, scholarship, research, or historical claim for
   which the image is needed. A decorative illustration is not enough.
3. Review the four section 107 factors for that image in that context. Permission
   is one possible basis, but a well-supported fair-use conclusion is also a
   valid copyright basis.
4. Publish only the number and extent needed. Retain the whole client screen
   when layout and context matter; otherwise crop unrelated host framing.
5. Put descriptive alt text and a nearby runtime-observation caption beside the
   analysis. Do not link a public page to an ignored build path.

All raw PNGs, sidecars, action logs, framebuffer dumps, disks, worlds,
credentials, and session state remain under the ignored computer-use build
trees. Only separately selected, reviewed images may be copied to
`docs/assets/mit-cadr-screenshots/` or `docs/assets/genera-screenshots/`.

Curated screenshot files are excluded from any present or future blanket
software or content license for this repository unless an asset-specific notice
expressly says otherwise. Publication does not grant a sublicense in the
underlying interface or displayed software. The asset catalog should state
that boundary so downstream users do not mistake repository access for a
general reuse license.

## Exclusions and enhanced review

Do not use this policy to publish:

- bulk galleries, full interaction sequences, or decorative hero images;
- substantial manual, tutorial, Help, or Document Examiner prose except when a
  separately reviewed excerpt is necessary to the analysis;
- extracted fonts, font sheets, icons, pictures, scans, sprites, source code,
  documentation databases, or other recovered payloads relabeled as
  “screenshots”;
- third-party artwork, photographs, video, game content, user documents, or
  other material merely displayed inside the system without a separate review;
- credentials, personal or customer data, non-public hostnames or network details,
  license keys, confidential information, or trade secrets; or
- material subject to a known contractual restriction until that restriction
  has been assessed.

Trademarked names may identify the system and application accurately, but the
page and caption must not imply sponsorship or endorsement.

## Attribution and reassessment

Use a caption substantially like:

> Runtime observation: Zmacs on Genera 8.5 after invoking **List Buffers**,
> captured 2026-07-18. Underlying software and display material remain the
> property of their respective rightsholders; reproduced here for criticism,
> scholarship, and historical documentation under 17 U.S.C. section 107. No
> affiliation or endorsement is implied.

Attribution and a fair-use notice are not substitutes for the analysis, but
they make the repository's purpose and license boundary clear.

A rightsholder or depicted person may request reassessment through the
repository's [GitHub issue tracker](https://github.com/htayj/lisp-machine-container-museum/issues).
The request should identify the image, claimed work or interest, and requested
remedy. Preserve the research and provenance record, promptly reassess the
specific use, and correct attribution, crop, temporarily unpublish, or remove
the public asset when the documented basis is mistaken or the image exposes
material outside this policy. A good-faith reassessment process is not an
admission that the reviewed use infringes.

## Sources

- United States Code, [17 U.S.C. section 107](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section107),
  fair use, and [section 102](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section102),
  subject matter and functional exclusions; verified 2026-07-18.
- U.S. Copyright Office,
  [Fair Use Index](https://www.copyright.gov/fair-use/) and
  [*Sony Computer Entertainment America v. Bleem* summary](https://www.copyright.gov/fair-use/summaries/sonycomputer-bleem-9thcir2000.pdf);
  verified 2026-07-18.
- United States Court of Appeals for the Ninth Circuit,
  [*Sony Computer Entertainment America v. Bleem*, 214 F.3d 1022](https://law.resource.org/pub/us/case/reporter/F3/214/214.F3d.1022.99-17137.html),
  full opinion; verified 2026-07-18.
- United States Court of Appeals for the Second Circuit,
  [*Bill Graham Archives v. Dorling Kindersley*, 448 F.3d 605](https://www.law.berkeley.edu/files/Bill_Graham_case.pdf),
  full opinion, and the Copyright Office's
  [case summary](https://www.copyright.gov/fair-use/summaries/billgraham-dorling-2dcir2006.pdf);
  verified 2026-07-18.
- Supreme Court of the United States,
  [*Andy Warhol Foundation for the Visual Arts v. Goldsmith*, 598 U.S. 508](https://www.supremecourt.gov/opinions/22pdf/21-869_87ad.pdf);
  verified 2026-07-18.
- U.S. Copyright Office,
  [*Compendium of U.S. Copyright Office Practices*, chapter 700, section 721.10](https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf),
  computer programs and screen displays; verified 2026-07-18.

This is the museum's documented U.S. publication policy, not legal advice or a
claim of worldwide clearance. Reassess it if the publication context, selected
images, governing law, or known contractual evidence changes.
