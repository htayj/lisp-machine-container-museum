---
type: Coverage Index
title: Reimplementation specification coverage
description: The finite D01-D60 worklist for release-bounded, implementation-ready specifications of the CADR, LM-3, and Genera software areas documented by this museum.
tags: [lisp-machine, mit-cadr, lm-3, genera, reimplementation, specification, coverage]
timestamp: 2026-07-19T20:42:09-04:00
---

# Reimplementation specification coverage

This is the finite specification worklist for the museum's software catalog. The
canonical boundary is D01 through D60 in the
[application dossier coverage](software-application-dossiers.md). A dossier explains
what was found; a specification turns that evidence into release-selectable state,
invariants, transitions, errors, visible requirements, compatibility limits, and
objective conformance tests.

`Specified` means that a reconstruction contract exists for the topic at its stated
compatibility levels. It does not mean every historical source API, optional product,
hardware path, or runtime branch has been recovered. Each specification reserves
those claims explicitly and gives unresolved work a concrete `TODO-RUNTIME` or
`TODO-SCREENSHOT` obligation.

## Evidence and visual policy

Every specification must distinguish public System 46 source, maintained LM-3 source,
an exact System 303 load band, licensed Genera source/media, an exact Genera world,
runtime observations, manuals, and implementation-independent inference. Profiles
must not be averaged across releases.

Visible applications must include the smallest already reviewed runtime image that
proves their appearance. A member without a reviewed image retains a named screenshot
probe and blocker; a screenshot from a related application cannot stand in for it.
Images constrain only visible facts. Their use must be recorded in the curated asset
catalog and the [publication-rights review](screenshot-publication-rights-review.md).

Every interactive application is incomplete until its specification contains, or
explicitly incorporates from a named normative in-repository companion, the full
effective input-binding tree for each selected profile: direct and modified
keys, every prefix and reachable multi-stage leaf, pane/mode/context overrides,
numeric arguments and repeats, pointer/presentation gestures, menu accelerators,
precedence and fallthrough, Help exposure, and unbound behavior. The conformance
suite must enumerate and inject that tree. An evidenced statement that the
application owns no bindings is the required substitute, not an omitted section;
inherited substrate bindings remain explicitly outside or inside the claimed scope.

The [MIT CADR/LM-3 TV window-system specification](mit-cadr/tv-window-system-reimplementation-specification.md)
is the common CADR display substrate for several topics, but it does not replace an
application-level contract. The Dynamic Windows specification is D28.

## Canonical specification worklist

| ID | Software area or program family | Status | Specification |
| --- | --- | --- | --- |
| D01 | Lisp Listeners and editable input | Specified | [Lisp Listeners and editable input](lisp-listeners-reimplementation-specification.md) |
| D02 | Program selection, activities, and window management | Specified | [Program selection, activities, and window management](program-selection-activities-and-window-management-reimplementation-specification.md) |
| D03 | Screen Editor and Frame-Up layout design | Specified | [Screen Editor and Frame-Up layout design](screen-editor-and-frame-up-layout-design-reimplementation-specification.md) |
| D04 | Emergency Break and degraded interaction paths | Specified | [Emergency Break and degraded interaction paths](emergency-break-and-degraded-interaction-paths-reimplementation-specification.md) |
| D05 | EINE, ZWEI, and Zmacs editor family | Specified | [EINE, ZWEI, and Zmacs editor family](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md) |
| D06 | Directory, difference, and buffer editors | Specified | [Directory, difference, and buffer editors](directory-difference-and-buffer-editors-reimplementation-specification.md) |
| D07 | Help, self-documentation, and Document Examiner | Specified | [Help, self-documentation, and Document Examiner](help-self-documentation-and-document-examiner-reimplementation-specification.md) |
| D08 | ZMail and mail composition | Specified | [ZMail and mail composition](zmail-and-mail-composition-reimplementation-specification.md) |
| D09 | Converse, direct messages, and Notifications | Specified | [Converse, direct messages, and Notifications](converse-direct-messages-and-notifications-reimplementation-specification.md) |
| D10 | Network terminal applications | Specified | [Network terminal applications](network-terminal-applications-reimplementation-specification.md) |
| D11 | Object Inspector and Presentation Inspector | Planned | — |
| D12 | Error Handler and graphical debuggers | Planned | — |
| D13 | Trace, Stepper, breakpoints, and call analysis | Planned | — |
| D14 | Peek and live system observation | Planned | — |
| D15 | Metering and performance analysis | Planned | — |
| D16 | Flavors, CLOS, and Flavor Examiner | Planned | — |
| D17 | File systems, Dired-facing operations, and file service | Planned | — |
| D18 | Disk labels, packs, salvage, and file-system maintenance | Planned | — |
| D19 | Tape systems and Tape Utility Frame | Planned | — |
| D20 | Site data and Namespace administration | Planned | — |
| D21 | Background services and operations dashboards | Planned | — |
| D22 | Lisp runtime, compiler, and development environment | Planned | — |
| D23 | Compiled objects, QFASL, relocation, and UNFASL | Planned | — |
| D24 | System construction, patches, worlds, bands, and distribution | Planned | — |
| D25 | Source comparison, Compare/Merge, and version control | Planned | — |
| D26 | Formatting, spelling, and text-production utilities | Planned | — |
| D27 | Mathematical and numeric facilities | Planned | — |
| D28 | Dynamic Windows and presentation-based interaction | Specified | [Genera Dynamic Windows](genera/dynamic-windows-reimplementation-specification.md) |
| D29 | CLIM 2 on Genera | Planned | — |
| D30 | FED and Font Editor generations | Planned | — |
| D31 | Bitmap, stipple, and raster paint editors | Planned | — |
| D32 | Genera Graphic Editor and structured drawing | Planned | — |
| D33 | Color systems and Color Editor | Planned | — |
| D34 | Images, drawing primitives, and visual-asset substrates | Planned | — |
| D35 | Hardcopy, Press, printing, and plot output | Planned | — |
| D36 | Concordia, structured documentation, and book design | Planned | — |
| D37 | Symbolics C, FORTRAN, and Pascal environments | Planned | — |
| D38 | Compiler Tools, grammars, lexers, and Syntax Editor | Planned | — |
| D39 | Conversion Tools | Planned | — |
| D40 | Joshua rule and inference environment | Planned | — |
| D41 | Statice persistent object system | Planned | — |
| D42 | Macsyma 421 | Planned | — |
| D43 | NS electronic-design family | Planned | — |
| D44 | CLOE development and runtime environment | Planned | — |
| D45 | Network transports and protocol architecture | Planned | — |
| D46 | Network services and site utilities | Planned | — |
| D47 | RPC, embedding, UX, and Macintosh integration | Planned | — |
| D48 | CLX, remote X screens, and X server facilities | Planned | — |
| D49 | CL-HTTP and contributed Web systems | Planned | — |
| D50 | CADR microcode, microassembler, and console debugger | Planned | — |
| D51 | CADR diagnostics, checkout, and hardware tools | Planned | — |
| D52 | Ivory, FEP, and Open Genera/VLM implementation layers | Planned | — |
| D53 | MUNCH and Munching Squares | Planned | — |
| D54 | LEXIPHAGE | Planned | — |
| D55 | Spacewar | Planned | — |
| D56 | Doctor conversational program | Planned | — |
| D57 | CADR HACKS, display, sound, and novelty suite | Planned | — |
| D58 | Genera HACKS demonstration suite | Planned | — |
| D59 | CLIM demonstrations and tutorial | Planned | — |
| D60 | Product and programming examples | Planned | — |

## Completion rule

A topic moves to `Specified` only after the document passes the repository's strict
specification audit, its internal links and Markdown are checked, an adversarial
evidence review finds no release conflation or unsupported compatibility claim, every
visible member has either reviewed visual evidence or an explicit screenshot blocker,
and the topic's specification commit is pushed. Later runtime closure can strengthen a
specified profile without erasing the recorded uncertainty of earlier evidence.
