---
type: Artifact Analysis
title: Software areas and applications on the MIT CADR and LM-3
description: A release-bounded census of user applications, programming tools, services, subsystems, engineering utilities, games, and demos in public System 46 and maintained System 303 materials.
tags: [mit-cadr, lm-3, applications, software-catalog, preservation]
timestamp: 2026-07-18T13:16:09-04:00
---

# Software areas and applications on the MIT CADR and LM-3

## Conclusion

The CADR was not organized as a small operating system plus a separate application
catalog. Its listener, editor, debugger, inspector, mail reader, file tools, network
clients, window system, compiler, and hardware diagnostics were Lisp systems in one
live environment. A useful catalog therefore has to include both named interactive
programs and the substantial facilities on which those programs depended.

This census is complete at a deliberately stated grain for two preserved evidence
sets:

- every one of the **55 unique non-commented top-level `DEFSYSTEM` names** found in
  canonical files of the pinned maintained System 303 tree is accounted for;
- all **34 canonical `.lisp` files** in that tree's `demo/` directory are accounted
  for, separated into the 20 Lisp components actually named by `HACKS` and 14 extra
  source files which are not active `HACKS` components;
- the seven Program-column entries observed in the running System 303 System Menu
  are recorded without claiming that each target was launched;
- user-facing programs and major functional areas visible in the System 46 load
  inventory and public source tree are cross-checked separately.

“Complete” does **not** mean that every Lisp function, patch, device driver, source
revision, data file, or personal experiment has been promoted to “application.” It
also does not mean that everything in the maintained restoration tree was loaded in
the exercised System 303 band, or that later LMI additions in that tree were written
at MIT during System 303. Those boundaries are part of the catalog rather than
exceptions hidden in a footnote.

## Evidence sets and vocabulary

| Marker | Meaning |
| --- | --- |
| `46-source` | Source is present in the complete public System 46 snapshot. |
| `46-artifact` | Only compiled, generated, data, tag, or inventory evidence is present in that snapshot. |
| `303-declared` | A non-commented declaration or active component reference is present in the pinned maintained System 303 tree. This proves source-tree membership, not load-band installation. |
| `303-source` | Canonical source is present but is not an active component of the relevant declaration. |
| `RV-run` | The museum harness directly exercised the named behavior in the System 303 load band. |
| `RV-menu` | The live runtime exposed the named menu entry, but this audit did not launch its target. |
| `RV-help` | The live System-Help display exposed the named system-key binding, but this audit did not enter its target. |
| `optional` | The declaration explicitly puts the software in an optional aggregate or leaves it separately loadable. |
| `demo` | Demo or hack source, menu registration, or `HACKS` membership is present. |
| `external` | The local file is only a declaration, logical-path setup, or source-file registration for implementation files outside the preserved tree. |
| `uncertain` | Identity, completeness, dependencies, or startability remain unresolved. |

The two release markers are snapshot comparisons. “303-only” below means absent
from the complete System 46 snapshot but present in the pinned maintained tree; it
does not assert when the software was first written. Likewise, “46-only” means absent
from this particular maintained checkout, not absent from all later Lisp Machine
software.

| Evidence set | Identity | What was inspected |
| --- | --- | --- |
| MIT CADR System 46 | Git commit [`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src) | All 1,895 files in `src/` (54,459,607 bytes), especially [`lmdoc/lispm.files`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/lispm.files), `nzwei/`, `lmwin/`, `lmio1/`, `lmdemo/`, and `moon/`. |
| Maintained LM-3 System 303 | Fossil check-in [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), tag `system-303` | All 1,423 canonical paths after excluding Fossil's numbered historical revisions and checkout database; system declarations, packages, system keys, top-level functions, frame/window flavors, demo registrations, manuals, and source consumers. |
| System 303 runtime | The named `smoke` and `software-catalog-20260718` Xvfb harness sessions, plus the separately documented Zmacs sessions | Cold boot, Listener evaluation, the System Menu, System Help, and Zmacs interactions. Runtime evidence applies only to the action actually performed. |

The maintained tree includes files with dates and copyright notices later than the
System 303 era, notably 1985–1986 tape and Site Data Editor material. It is a
restoration and maintenance repository, not a frozen single-date distribution tape.

## Area map

| Area | Principal applications or facilities | Kind |
| --- | --- | --- |
| Interactive environment | Lisp Listener, Editing Lisp Listener, Emergency Break, System Menu, screen/layout editor | User applications plus window substrate |
| Editing and source navigation | ZWEI, Zmacs, ZTOP, Dired, BDired, Edit Buffers, editor mail composition | Applications and editor modes |
| Debugging and observation | Error Handler, Inspector, Trace, Stepper, Peek, Meter, CADR console debugger | Interactive development and operations tools |
| Communication | ZMail, Converse, SUPDUP, Telnet, SMTP/mail transports | Applications and protocols |
| Files and media | Dired, Local-File/LFS, QFILE, file servers, disk label/pack tools, tape and TFrame | Applications, services, and storage subsystems |
| Programming environment | evaluator, compiler, assembler, disassembler, QFASL tools, Flavors, packages, LOOP, FORMAT, Make-System, patch manager, source compare | Language runtime and development tools |
| Graphics and output | TV window system, Color, FED, Paint, image/font tools, Press, XGP, DPLT, hardcopy, Versatec | Applications, libraries, formats, and device support |
| Network and site operations | Chaosnet, Ethernet/ARP, EFTP, QFILE, host/site tables, Site Data Editor | Protocols, services, and administration |
| Machine engineering | microassembler, UCODE, cold-load builder, diagnostics, crash analysis, disk checkout, PROM and controller tools | Hardware and release engineering |
| Demonstrations and games | HACKS menu, MUNCH, LEXIPHAGE, clocks, graphical and sound hacks, Spacewar, Paint, Doctor | Optional programs and experiments |

## Runtime-observed core entry points

The running System 303 load band reached `Lisp Listener 1`; evaluating `(+ 2 3)`
returned `5`. Its System Menu visibly offered the following complete Programs
column. The source in
[`window/sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fsysmen.lisp&ln=61-76)
identifies each target.

| Runtime label | Target and purpose | Evidence |
| --- | --- | --- |
| [Lisp](lisp-listener.md) | `LISP-LISTENER`, the read-eval-print Listener. | `RV-run`; `RV-help`; `303-declared`; `46-source` |
| Edit | `ZWEI:ZMACS-FRAME`, the Zmacs editor. | `RV-run` in a separate documented interaction; `RV-menu`; `RV-help`; `303-declared`; partial `46-source`/`46-artifact` |
| [Inspect](inspector.md) | `INSPECT-FRAME`, the graphical object and data-structure browser. | `RV-run`; `RV-menu`; `RV-help`; `303-declared`; `46-source` |
| [Trace](../trace-stepper-breakpoints-and-call-analysis.md) | `TRACE-VIA-MENUS`, a menu front end to function tracing. | `RV-menu`; `303-declared`; `46-source`; controlled System 303 runtime study |
| [Peek](peek.md) | `PEEK-FRAME`, the display of processes, memory, file, network, and related system activity. | `RV-run`; `RV-menu`; `RV-help`; `303-declared`; `46-source` |
| Mail | `ZWEI:ZMAIL-FRAME`, the ZMail reader and sender. | `RV-menu`; `303-declared`; 303-only source in the compared snapshots |
| [Emergency Break](../emergency-break-and-cold-load-stream.md) | `KBD-USE-COLD-LOAD-STREAM`, a read-eval-print path which avoids the ordinary window system. | `RV-run`; `RV-menu`; `303-source`; `46-source` |

The original catalog-session menu capture remains ignored. A later, independently
provenanced [System Menu study](system-menu-and-select.md) selected one exact menu
state for the curated screenshot tree after capture-specific review. The original
capture's filename, PNG and pixel hashes, input
sequence, band identity, and shutdown status are retained in the
[harness observation table](cadr-computer-use-harness.md#current-schema-cold-boot-observations).
The curated [Zmacs screenshots](../assets/mit-cadr-screenshots/) provide the visual
evidence for the separately exercised editor states.

The runtime menu is a high-confidence list of core entry points, but it is not the
whole software catalog. Separately loadable systems add system keys and commands,
and many services have no top-level window at all. The system-key machinery in
[`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fbasstr.lisp&ln=1523-1603)
is therefore evidence for selectable programs, not a declaration that every source
file is an application.

A fresh System-Help invocation in harness session `software-catalog-20260718`,
generation 1, displayed exactly five current bindings:

| System key | Displayed description | Runtime target |
| --- | --- | --- |
| `Top-L` | `LISP(Edit)` | Editing Lisp Listener / `EDITOR-TOP-LEVEL` |
| `E` | `Editor` | Zmacs |
| `I` | `Inspector` | Inspector |
| `L` | `Lisp` | Lisp Listener |
| `P` | `Peek` | Peek |

This is `RV-help` evidence for registry visibility, not proof that each target was
entered. It also demonstrates that the System Menu and System Help are different
registries: Trace, Mail, and Emergency Break appeared in the live Programs column
but did not appear in this System-Help list. Conversely, System Help exposed the
Editing Lisp Listener even though it was not a Programs-column item. The local-only
capture is `0003-system-help.png`, PNG SHA-256
`06253bde02161f986fccd80f084a60dbbb7174e60c92c91f2aacdeaec4938aa6` and pixel
SHA-256 `1344fd3d9e779aa2df89a6f255c444005a6883ed12ab72273339d904b77a7617`.
The session ran System `303-0` against public software check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` with `usim`
check-in `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`.
Its base disk SHA-256 was
`bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` and remained
unchanged; shutdown was clean (`forced_stop: false`, `usim` exit 0). The image
remains unembedded pending image-specific publication review.

The discrepancy is source-consistent. The Programs column is a static item list,
whereas System Help walks the current `TV:*SYSTEM-KEYS*` registry, suppresses
duplicate characters, and skips an atomic target whose flavor is not presently
defined. Thus the Help display is a dynamic view of current registrations, not an
alias for the Programs column. The five-entry observation alone does not establish
whether omitted optional software was loadable, loaded, or broken.

### System-Help runtime provenance

| Field | Portable record |
| --- | --- |
| Session | `software-catalog-20260718`, generation 1; prepared `2026-07-18T03:07:01-04:00`; capture `2026-07-18T03:08:55-04:00` |
| Researcher-recorded input | After fresh boot: capture `0001-pre-select-help`; answer the two successive date/time questions with `n`, Return, `n`, Return; capture `0002-post-date`; send harness aliases `system help` (X keysyms F1 then F5); capture `0003-system-help`. No other guest input occurred between those captures. The CADR harness does not yet serialize an action ledger, so this sequence is researcher-recorded evidence. |
| Load band and disk | `System 303-0`; base and private session disk SHA-256 at start `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`; base disk unchanged after the run |
| Public source revisions | System `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; Chaos `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`; usite `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`; umbrella `l` `d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6`; `usim` `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d` |
| Private source copy | Copy-time revisions equal the public System, Chaos, and usite revisions above. Copy/start tree SHA-256: System `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`; Chaos `34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87`; usite `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81`. All three private copies were unchanged since copy. |
| Emulator identity | `usim_sha256_at_start` and `usim_sha256_at_exec` both `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be` |
| Private machine artifacts | `promh.mcr` `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`; `promh.sym` `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`; `ucadr.sym` `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| Window and capture | `LOCAL-CADR [running]`, X window 2097202 at `(0,0)`, 768 by 963; PNG SHA-256 `06253bde02161f986fccd80f084a60dbbb7174e60c92c91f2aacdeaec4938aa6`; pixel SHA-256 `1344fd3d9e779aa2df89a6f255c444005a6883ed12ab72273339d904b77a7617` |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`, Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`, Python 3.11.14, Xorg Server 21.1.21, ImageMagick 6.9.13-5, xdotool 3.20211022.1 |
| Termination | `status: stopped`; `forced_stop: false`; `state_may_be_incomplete: false`; `usim` exit 0; Xvfb exit 0 |

This provenance joins the screenshot sidecar to `run.json`; the sidecar itself does
not claim the execution-time `usim` hash. All raw session files remain ignored.

## Interactive applications and user environment

| Name | What it is | Release and confidence |
| --- | --- | --- |
| [Lisp Listener / Lisp Interactor](lisp-listener.md) | Windowed Lisp read-eval-print environment with editable input and Listener state. | `RV-run`; `RV-help`; `303-declared` through `TV`; `46-source` |
| [Emergency Break](../emergency-break-and-cold-load-stream.md) | Cautionary cold-load-stream evaluator used when the normal window path is unsuitable. | `RV-run`; `RV-menu`; `303-source`; `46-source` |
| [System Menu and window manager](system-menu-and-select.md) | Selects or creates programs, manipulates the current window, switches screens/layouts, splits the screen, and invokes the screen editor. | `RV-run`; `RV-menu`; `303-declared` through `TV`; `46-source` |
| [Screen Editor (`EDIT-SCREEN`)](../screen-editor-and-frame-up.md) | Mouse-driven live-window tool for creating, moving, reshaping, exposing, burying, expanding, killing, and editing window attributes. | `RV-run`; `RV-menu`; `303-declared`; `46-source`; complete controls and lineage audited |
| ZWEI | Reusable editing substrate: command loop, buffers, redisplay, modes, search, file operations, editor streams, keyboard macros, mouse commands, and self-documentation. | `303-declared`; substantial `46-source` |
| Zmacs | Multi-buffer, file, and Lisp-development editor built on ZWEI. | `RV-run`; `RV-help`; `303-declared`. System 46 has commands, tags, structures, and generated help, but its Zmacs implementation source file is absent: partial `46-source` plus `46-artifact`. See [the editor study](zwei-and-zmacs.md). |
| Editing Lisp Listener / `Lisp (Edit)` / ZDT | A Lisp top level using the ZWEI editor-stream interface; the system selection menu names `EDITOR-TOP-LEVEL`. | `RV-help`; `303-declared` as part of ZWEI; System 46 tags name it but the corresponding source is absent: `46-artifact` |
| ZTOP | A Lisp top level inside a Zmacs buffer, with evaluation results inserted into the editor context. | `303-declared`; System 46 tag evidence only; not runtime exercised |
| [Dired](../directory-difference-and-buffer-editors.md) | Directory editor: list a directory and mark files for operations from an editor buffer. | `303-declared`; `46-source`; complete command audit |
| [BDired](../directory-difference-and-buffer-editors.md) | Directory-differences editor. | `303-declared`; 303-only source in the compared snapshots; complete command audit |
| [Edit Buffers](../directory-difference-and-buffer-editors.md) | Special ZWEI mode for selecting, saving, reverting, printing, or deleting buffers. | `303-declared`; absent from the preserved System 46 ZWEI source; complete command audit |
| ZWEI Mail mode | Mail-composition/editing mode in ZWEI. It is not the full ZMail application. | `303-declared`; `46-source` |
| ZMail | Full windowed mail reader and sender, including mail files, summaries, filters, profiles, RFC 733 parsing, and composition integration. See the [application and runtime study](zmail.md) and [command/binding inventory](zmail-keybindings.md). | `RV-menu`; `303-declared`; 303-only source in the compared snapshots. A later direct runtime check found the static menu entry present but the frame flavor not loaded in the exact base band. |
| [Inspector](inspector.md) | Graphical browser for Lisp objects and data structures, with history and typeout panes. | `RV-run`; `RV-menu`; `RV-help`; `303-declared` through `TV`; `46-source` |
| [Error Handler (`EH`)](error-handler-and-debuggers.md) | Condition/error handler and graphical debugger, including traps, breakpoints, frames, and window UI. | `303-declared`; `46-source`; safe synthetic-condition runtime study with reviewed captures |
| [Trace via menus](../trace-stepper-breakpoints-and-call-analysis.md) | Menu-driven selection and configuration of function tracing. | `RV-menu`; `303-source` through the System Menu and core trace package; `46-source`; runtime exercised on project-owned functions |
| [Stepper](../trace-stepper-breakpoints-and-call-analysis.md) | Single-step execution support for Lisp code. | `303-declared` within `SYSTEM-INTERNALS`; `46-source`; controlled interpreted runtime exercise |
| [Peek](peek.md) | Windowed system-status display with process, memory, file-system, and Chaosnet extensions. | `RV-run`; `RV-menu`; `RV-help`; `303-declared`; `46-source` |
| [FED](../fed-and-font-editor-generations.md) | Font Editor and associated image tools; edits bitmap character rasters and font metrics. | `303-declared`, `optional`; three distinct System 46 implementations; complete source/control/format audit plus [font recovery](font-sources-and-recovery.md). |
| [Converse](../converse-direct-messages-and-notifications.md) | Interactive person-to-person message application with a ZWEI-based frame and saved sends. | `303-declared` and part of `OUTER-SYSTEM`; 303-only source in the compared snapshots; tested System 303-0 band did not have it loaded |
| [SUPDUP](../network-terminal-applications.md) | Network virtual terminal window for SUPDUP sessions. | `303-declared`; `46-source`; complete architecture/control/protocol audit |
| [Telnet](../network-terminal-applications.md) | Telnet/NVT window and connection routines included in the current SUPDUP source module. A second `telnet-front-hack.lisp` copy is source-present but is not a separate declared system. | `303-declared` through `SUPDUP`; 303-only source in the compared snapshots; complete static audit, connected runtime pending an isolated peer |
| [Site Data Editor](site-data-login-and-site-editor.md) | Later windowed editor for site/network configuration data, with 12 selectable commands plus direct key and mouse surfaces. | Declared in the maintained tree, but dated LMI/Gigamos 1986–1988 source; not claimed as original System 303 load-band content |
| [Tape Utility Frame (`TFrame`)](../tape-systems-and-tape-utility-frame.md#the-lmi-tape-utility-frame-tframe) | Windowed tape operations interface with seven modes, 23 commands, 16 options, direct gestures, a background execution process, and a system-key entry point. | `303-declared`, later LMI tape layer; complete source audit, but not claimed loaded in the tested band and not runtime verified without tape/device support |
| [Spacewar](spacewar-on-the-lisp-machine.md) | Two-player graphical game with ship sprites, complete source-defined controls and physics, System-key `W`, and a reviewed live System 303 playfield. | `303-source`; `46-source`; `runtime-observed`; not a component of the System 303 `HACKS` declaration |
| EINE | Historically important predecessor editor, but **not part of either bounded System 46 or System 303 software set in this census**. Its separate late-1977 corpus is covered in [the EINE article](eine.md). | Adjacent historical source corpus |

### Editor modes are not separate language systems

The System 46 ZWEI source defines major modes for Lisp, MIDAS, Text, Bolio,
Fundamental, PL/I, Electric PL/I, TECO, and Macsyma, plus minor modes including
Emacs compatibility, Auto Fill, Overwrite, Word Abbrev, and Electric Shift Lock.
System 303 adds or retains further modes and special buffers such as C, Scheme, T,
TeX, Possibilities, Warnings, Edit Buffers, directory differences, and ZTOP. These
are real editor facilities, cataloged in detail in
[ZWEI and Zmacs](zwei-and-zmacs.md#modes-in-the-pinned-trees), but an editor mode
does not by itself prove that a PL/I, Macsyma, Scheme, T, or C implementation
shipped in the same band. Macsyma is the important bounded exception to an overly
broad reading of that warning: contemporary System 46 material describes the
Lisp-Machine port, and LM-3 bug/patch records identify worlds containing
Experimental Macsyma releases, even though neither pinned public tree includes the
product implementation. [The Macsyma dossier](../macsyma-421-symbolic-mathematics-environment.md)
separates those public lineage facts from the later licensed Symbolics 421 media.

## Programming, debugging, and performance tools

| Name or area | Established role | Evidence |
| --- | --- | --- |
| [Lisp evaluator and runtime](../lisp-runtime-compiler-and-development-environment.md) | Reader, printer, evaluator, REP top level, numbers, arrays, strings, symbols, storage, stack groups, processes, resources, time, streams, and I/O. | `303-declared` in `SYSTEM`/`SYSTEM-INTERNALS`; System 46 load inventory and source; controlled System 303 runtime study |
| [Macsyma on Lisp machines](../macsyma-421-symbolic-mathematics-environment.md) | Symbolic-mathematics environment with its own language, display, editors, Help, algebra/calculus/matrix/plotting facilities, and Lisp integration. | System 46 port documentation and editor mode; LM-3 world/bug/patch evidence; product implementation absent from both pinned public trees; later Symbolics 421 media analyzed separately |
| [AMORD/LMTMS and the later Joshua environment](../joshua-rule-and-inference-environment.md) | Earlier rule/truth-maintenance research records in the public Lisp-Machine lineage; later Symbolics Joshua adds a full predicate protocol, unification, RETE/backward rules, TMS/LTMS, objects, tracing, metering, and Jericho examples. | System 46 AMORD/LMTMS bug evidence and maintained LM-3 `site/amord.system`; these witnesses are not represented as the exact Joshua 237 source or proof that the preserved System 303 band loaded it |
| [Packages, Flavors, classes, entities](../flavors-clos-and-flavor-examiner.md), `DEFSTRUCT`, `SETF`, and `LOOP` | Core language and object/program-organization facilities; the linked dossier distinguishes the pre-CLOS class facility and inventories the object-inspection commands. | `303-declared`; `46-source` in earlier forms; fresh `Describe Flavor` runtime study |
| Common Lisp compatibility layer | `CLPACK`, `CLMAC`, and “new commonlisp functions” provide a compatibility layer. This is not a claim of later ANSI Common Lisp conformance. | `303-declared`; partial equivalents in System 46 |
| [Compiler](../lisp-runtime-compiler-and-development-environment.md) | Lisp compiler, macro compiler, optimizer, peephole passes, LAP output, file compiler, and disassembler. | `303-declared` as `COMPILER`; System 46 load inventory/source; controlled compile/macroexpand/disassemble study |
| [QFASL loader, dumper, relocation, and `UNFASL`](../compiled-objects-qfasl-relocation-and-unfasl.md) | A 52-slot System 46 and 56-slot System 303 loader language serializes compiled Lisp objects and load-time effects; `QFASL-REL` relocates sectioned object graphs and `UNFASL` prints structural descriptions rather than original source. | `303-declared`; `46-source`; fresh `UNFASL-PRINT` entry-point check |
| [`FORMAT`, `FQUERY`, and output formatting](../formatting-spelling-and-text-production-utilities.md) | Formatted text output and interactive query support, including a fresh System 303 load-band/source discrepancy check. | `303-declared`; `46-source`; complete release-bounded directive and option audit |
| [Grind](../formatting-spelling-and-text-production-utilities.md#the-lisp-grinder) | Lisp pretty-printing and formatted source display. | `303-declared` inside `SYSTEM-INTERNALS`; System 46 load inventory/source; special-layout registrations audited |
| [Make-System and patch manager](../system-construction-patches-worlds-and-distribution.md) | Declares, compiles, loads, recompiles, patches, versions named software systems, and participates in band/distribution construction. | `303-declared`; System 46 load inventory/source; full lifecycle audit |
| [Source Compare (`SRCCOM`)](../source-comparison-compare-merge-and-version-control.md) | Compares source files/forms, with editor commands and source-only options differing across the releases. | `303-declared`; `46-source`; complete implementation/interaction inventories |
| [Meter](../metering-and-performance-analysis.md) | Performance metering and reporting across counter, page-trace, and event models. | `303-declared`; System 46 has core meter and separate `LMETER`/`PTRAC` sources; the linked dossier preserves their different semantics |
| [Trace, Stepper](../trace-stepper-breakpoints-and-call-analysis.md), [Error Handler](error-handler-and-debuggers.md), Inspector, Peek | Complementary tracing, single-stepping, condition debugging, object browsing, and live system observation. | See the interactive table; mixed `RV-menu`, `303-declared`, `46-source`, and fresh controlled runtime evidence |
| [Ispell](../formatting-spelling-and-text-production-utilities.md#spelling-correction) | Optional spelling checker integrated with ZWEI. | `303-declared`, `optional`; 303-only source in the compared snapshots; full command/source boundary documented |
| [Math, matrix, rational, and infix support](../mathematical-and-numeric-facilities.md) | Eight-function matrix system plus distinct rational, complex, elementary-function, and infix-reading/evaluation layers. | `303-declared` as `MATH` and core modules; System 46 source; complete API/grammar/algorithm audit and controlled runtime study |
| [CADR microassembler](cadr-microcode-microassembler-and-console-debugger.md) | Assembles and manages CADR microcode, symbols, microload artifacts, error tables, and incremental modules; the linked dossier inventories its language and exact build boundary. | `303-declared` as `CADR-MICRO-ASSEMBLER`; `46-source` |
| 8748/8751 assemblers | Source tools for Intel 8748/8751 microcontrollers. Their exact operational deployment is **TODO**. | `303-source`; no active `DEFSYSTEM` component found |

## Files, disks, tapes, and release administration

| Name or area | Established role | Evidence |
| --- | --- | --- |
| [Generic file system](../file-systems-and-file-service.md#pathnames-streams-and-the-generic-contract) | Pathnames, logical hosts, directory parsing, open/access operations, buffered directory access, and file streams. | `303-declared` as `FILE-SYSTEM`; System 46 source/load inventory; complete architecture dossier linked |
| [QFILE client](../file-systems-and-file-service.md#mit-system-46-qfile-and-the-external-file-computer) | Chaosnet file access and the System 46 PDP-10 `FILE` peer. | Component of `FILE-SYSTEM`; `303-declared`; `46-source`; complete System 46 server command table and System 303 protocol audit linked |
| [Local-File](../file-systems-and-file-service.md#the-older-local-file) | Local disk file system implementation, access control, and streams. | `303-declared`; part of `OUTER-SYSTEM`; all 20 direct file methods audited |
| [LFS / LMFILE](../file-systems-and-file-service.md#the-hierarchical-lfslmfile) | Alternate local file system with packs, free-space management, directories, links, garbage collection, dump, salvage, and ZMail integration. | `303-declared`; protocol architecture linked; [pack/volume/repair audit](disk-labels-packs-and-file-system-repair.md#lmfile-packs-and-volumes) separate |
| [File-Server](../file-systems-and-file-service.md#the-two-system-303-servers) | Network file server for the local file implementation. | `303-declared`; part of `OUTER-SYSTEM`; 18 dispatcher branches and 15 public protocol names audited |
| [LMFILE-Server / LMFILE-Remote](../file-systems-and-file-service.md#the-two-system-303-servers) | Server and remote access layers for LMFILE, with ZMail integration. | `303-declared`; all 29 server command symbols audited; runtime not verified |
| [Dired / BDired / Edit Buffers](../directory-difference-and-buffer-editors.md) | User-facing directory, directory-comparison, and buffer-management interfaces. | Complete cross-release command and behavior dossier; see interactive table |
| [`DLEDIT`](disk-labels-packs-and-file-system-repair.md#dledit-the-physical-label-editor) | Disk-label editor. | `303-declared` in `SYSTEM-INTERNALS`; complete System 46/System 303 command comparison and source-visible defect audit |
| [Disk pack, checkout, and salvage tools](disk-labels-packs-and-file-system-repair.md) | Pack examination, disk diagnostics, file-system salvage, repair, and remote/debug-cable access. | `303-declared` across `LFS` and `CADR-DEBUGGER`; `46-source` for earlier tools; destructive runtime remains intentionally deferred |
| Bands and cold-load builder | Creates/loads cold-load and distribution bands and manages disk-label band entries. | `303-declared` in `COLD`, `COLD-LOAD`, `INNER-SYSTEM`, and core band modules; `46-source` |
| [Tape](../tape-systems-and-tape-utility-frame.md#maintained-lm-3-system-303-architecture-and-lineage) | Later LMI device/format, archive, backup, test, and user-interface layer. The current declaration configures RAW, LMFL, old TAR, and TANALYZ formats and routes CADR through RTAPE; the complete 26-operation user API is audited. | `303-declared`; later LMI source; part of `OUTER-SYSTEM`; physical and remote-device runtime remains blocked |
| [TFrame](../tape-systems-and-tape-utility-frame.md#the-lmi-tape-utility-frame-tframe) | Windowed tape utility with seven operational/documentation modes and complete source-visible controls. | `303-declared`; later LMI source; System-key registration present; not runtime verified in the tested band |
| [Tape compatibility and variants](../tape-systems-and-tape-utility-frame.md#what-was-restored) | `TAPE-COMPAT`, `WESPERCO`, `TAPEMASTER`, and `VMS-TAPE` preserve old device/format interfaces and variant declarations. | `303-declared`; exact controller applicability varies; the CADR build's active current path is RTAPE rather than proof that all four variants operate |
| [Dribble](../formatting-spelling-and-text-production-utilities.md#dribbling-a-listener-session) | Transcript/logging facility for interactive I/O. | `303-declared` in core; System 46 load inventory/source; stream behavior and controls documented |
| Distribution tools | Copy/build support for system distributions and load media. | `303-source` under `distribution/`; no single user application claimed |
| [Login, site, and host tables](site-data-login-and-site-editor.md) | User login initialization, hand tables in System 46, System 303 site parameters, logical hosts, generated host tables, and override precedence. | `303-declared` as core and `SITE`; System 46 source; maintained `usite` restoration cross-check |

## Networking, terminals, mail, and services

| Name or area | Established role | Evidence |
| --- | --- | --- |
| [Chaosnet](../network-transports-and-protocol-architecture.md#system-46-chaosnet) | Network Control Program, connection/simple transactions, routing, user interface, diagnostics, and the transport beneath EFTP/QFILE. | Complete System 46/System 303 source-bounded packet and operator audit; runtime peer behavior remains blocked. |
| [Ethernet and address resolution](../network-transports-and-protocol-architecture.md#maintained-system-303-chaos-over-a-separate-ethernet-layer) | Maintained simple 3Com Ethernet interface and Chaos-to-Ethernet resolution. | `303-declared`; exact Lambda controller path and tools audited; no corresponding standalone System 46 driver found and preserved-band loading not inferred. |
| [EFTP](../network-transports-and-protocol-architecture.md#eftp-is-a-foreign-protocol-carried-by-chaos) | PUP-family foreign-protocol file transfer carried through the Chaos path. | Both public implementations and all four entry points audited; synthetic-peer interoperability remains TODO. |
| [QFILE](../network-transports-and-protocol-architecture.md#qfiles-place-in-the-stack) | Chaosnet file-protocol client transport. | System 46/System 303 source and transport contract audited; file semantics remain in D17. |
| [Host and user queries](../network-services-and-site-utilities.md#hostat-finger-and-name) | `HOSTAT`, `FINGER`, `WHOIS`, `UPTIME`, Lisp Machine availability searches, time comparison, and routing-table/path displays. Finger also has a keyboard-driven pop-up display. | Complete System 46/System 303 source audit and a noncontacting live entry-point probe. |
| [Direct Chaos messages](../converse-direct-messages-and-notifications.md) | System 303 `SHOUT`/`NOTIFY` and System 46 `SEND-MSG`/saved-send routines provide command-level messages outside the full Converse application. | Complete source-bounded controls and defects audited; peer-dependent behavior remains runtime-blocked |
| [Auxiliary Chaos servers](../network-services-and-site-utilities.md#maintained-system-303-service-family) | Finger/Name, time/uptime, dummy mail, remote disk, Babel, Telnet, evaluation, notification, status, band transfer, and routing-table contacts. | Exact thirteen-contact live registry; `EVAL` and `TELNET` switches observed true without accepting or initiating a connection. |
| [MIT-local physical/site controls](../network-services-and-site-utilities.md#mit-local-physical-and-novelty-utilities) | System 46 `CALL-ELEVATOR`, `BUZZ-DOOR`, `HACK-DOOR`, and small external-site clients. | Complete source-bounded behavior; physical controls are inactive in System 303 and were deliberately not invoked. |
| [File-Server and LMFILE-Server operator surfaces](../background-services-and-operations-dashboards.md#cadr-processes-and-maintenance-rather-than-dashboards) | Lisp Machine file services with listener functions, who-line state, connection records, and generic background-process recovery rather than dedicated dashboards. | `303-declared`; complete stated-grain operator inventory; runtime service state not verified |
| SUPDUP and Telnet | Interactive network virtual-terminal clients. | `SUPDUP` is `303-declared` and occurs in the System 46 load inventory/source; current source also defines Telnet |
| [Converse](../converse-direct-messages-and-notifications.md) | Interactive messages between users/machines. | `303-declared`; part of `OUTER-SYSTEM`; absent from System 46 snapshot; direct-load interval initialization blocker recorded |
| ZMail and mail transports | Windowed mail application plus mail-file and network transport support, including RFC 733-era parsing and SMTP-related code. | `303-declared`; `RV-menu`; absent from System 46 snapshot |
| [Site and host data](site-data-login-and-site-editor.md) | Site configuration, generated host tables, network utilities, and the separately declared later Site Data Editor. | `303-declared`; mixed MIT-era and later LMI/Gigamos source explicitly separated |
| `MIT-SPECIFIC` | MIT XGP support plus local Chaosnet utilities. | `303-declared`; not a portable user application |
| Generic server/service skeletons | `network/server.lisp` and `network/service.lisp` contain framework names and incomplete bodies. | `303-source`, `uncertain`; not counted as working services |
| `UNIX` / Unix-Interface | Active declaration naming `LAMTTY`, `SHARE-CHAOS`, and `IOMSG` under `SYS:UNIX;`, but that implementation directory is absent from the pinned tree. | `303-declared`, `uncertain`; declaration-only/missing implementation |

## Graphics, fonts, drawing, and printing

| Name or area | Established role | Evidence |
| --- | --- | --- |
| TV window system | Screens, sheets, streams, menus, frames, mouse, redisplay, scrolling, choices, System Menu, Inspector, and screen editor. | `303-declared`; `46-source`; portions runtime observed |
| [Color](../color-systems-and-color-editor.md#mit-cadr-color-substrate) | Optional four-bit indexed-color screen, sixteen mutable RGB map entries, raster drawing, and source experiments COLORHACK, COLXOR, and CAFE. | `303-declared`, `optional`; `46-source` for the substrate; maintained public source for the three experiments; complete evidence-bounded audit linked |
| [Drawing and image tools](visual-assets-inventory.md) | Lines, rectangles, circles, BITBLT-based graphics, pixel arrays, image manipulation, and hardcopy helpers, kept distinct from [later Genera image objects and FrameThrower](../images-drawing-and-visual-asset-substrates.md). | `303-source`/core components; `46-source`; public asset inventory and cross-system architecture boundary linked |
| Fonts and Font Utilities | Runtime bitmap fonts, descriptor conversion, metrics, and shared utilities used by FED and the window system. | `303-declared`; `46-source`; see [font usage audit](font-usage-audit.md) and [editor generations](../fed-and-font-editor-generations.md) |
| [FED](../fed-and-font-editor-generations.md) | Bitmap font editors with magnified raster, glyph/font metrics, live-font update, samples, and KST/compiled-font paths. | `303-declared`, `optional`; old-window and new-window System 46 source plus a larger maintained System 303 implementation; complete controls audited |
| [Paint / NPaint](../bitmap-stipple-and-raster-paint-editors.md) | Two source generations of the same `PAINT` entry point, with brushes/patterns, selection, text, line/circle drawing, palette modes, and raster save/restore operations; the linked dossier records complete menus, keys, mouse switches, four unimplemented menu cells, and XOR asymmetry. | `46-source`; `303-source` as `demo/npaint.lisp`, but not an active `HACKS` component; base-band entry point unbound and retained source unreachable through the present file-service path |
| [XFED](../fed-and-font-editor-generations.md#system-46-xfed) | March 1980 old-window FED variant: a near-copy whose exact deltas include set/erase drawing, four-neighbor region erasure, fixed character selection behavior, and no later new-window architecture. The `X` expansion and deployment status remain unknown. | Full 46-only source and exact comparison; no compatible runtime band |
| [Press](../hardcopy-press-printing-and-plot-output.md#press-page-description-and-dover-transport) | Press-format construction, text/font formatting, and direct/EFTP/spooled Dover output. | `303-declared`, `optional`; `46-source`; complete public entry-point and option audit linked |
| [XGP](../hardcopy-press-printing-and-plot-output.md#xgp-scan-files-and-queue-requests) | One-bit scan encoding plus a separate textual queue request, included by `MIT-SPECIFIC` in the maintained tree. | `303-declared`; `46-source`; per-scanline literal/RLE behavior audited |
| [Hardcopy dispatcher](../hardcopy-press-printing-and-plot-output.md#the-lm-3-generic-hardcopy-contract) | Routes file, stream, bit-array, and status operations through printer-type capabilities; Terminal-Q supplies screen capture. | Core `303-declared`; later maintained public source; no historical printer service configured |
| [DPLT](../hardcopy-press-printing-and-plot-output.md#dplt-suds-plots-to-press) | Reads SUDS `.PLT` material in two passes and emits scaled/rotated Dover Press pages. | `303-source`; `46-source`; not a SUDS drawing editor; known unsupported plot features retained |
| [Versatec](../hardcopy-press-printing-and-plot-output.md#versatec-direct-hardware-not-a-file-formatter) | Low-level UNIBUS printer/plotter output, DMA mapping, and screen-copy routines. | `303-source` under `demo/`; not an active `HACKS` component; hardware absent |
| SUDS drawings and plot data | Hundreds of hardware-design `.DRW` and `.PLT` artifacts survive, but no complete runnable SUDS editor was found in either inspected software set. | Data evidence; see [visual assets](visual-assets-inventory.md#suds-drawings-and-plot-streams) |
| PICT and SCAN | System 46 demo media includes compiled `PICT` and an XGP scan input used by `SCAN`; source/startability is incomplete. | `46-artifact`, `uncertain`; see [visual assets](visual-assets-inventory.md) |

## CADR hardware, microcode, and diagnostic software

| Name or area | Established role | Evidence |
| --- | --- | --- |
| [`CADR` aggregate](cadr-microcode-microassembler-and-console-debugger.md) | Groups the CADR microassembler and console debugger; the linked dossier explains why their register, symbol, image, and error-table contracts form one engineering loop. | `303-declared`; `46-source` |
| [CADR console debugger](cadr-microcode-microassembler-and-console-debugger.md#what-the-console-debugger-controls) | “Cons Machine Console”/DDT-like control, register and memory access, loading, symbol handling, remote Lisp inspection, crash analysis, and salvage, with all release-bounded controls inventoried. | `303-declared` as `CADR-DEBUGGER`; `46-source`; separate disposable debuggee still required for runtime |
| [CADR microassembler](cadr-microcode-microassembler-and-console-debugger.md#how-cons-lap-represents-microinstructions) | CADR microcode assembly, symbols, word/microcode dumping, linkage, error metadata, and incremental image management. | `303-declared`; `46-source`; complete stated-grain language and workflow audit |
| [`UCODE`](cadr-microcode-microassembler-and-console-debugger.md#the-released-system-composition) | Ordered microcode build/declaration system: monolithic in the bounded System 46 evidence and 23 Make-System modules in maintained System 303. | `303-declared`; System 46 microcode sources |
| [Diagnostics and diagnostic monitor](cadr-diagnostics-checkout-and-hardware-tools.md#machine-checkout-with-cc-test-machine) | Ordered machine tests, diagnostic execution, memory and I/O-board checks, and target initialization. | `303-declared` through `CADR-DEBUGGER`; `46-source`; complete source-bounded test hierarchy linked, with hardware runtime deferred |
| [`CCWHY` and crash analysis](cadr-microcode-microassembler-and-console-debugger.md#remote-lisp-inspection-and-crash-analysis) | Diagnoses machine stops/crashes from CADR console state; the engineering-tools dossier separately covers diagnostic primitives it calls. | `303-declared` through debugger; `46-source` |
| [Disk checkout and salvage](disk-labels-packs-and-file-system-repair.md) | Controller/disk tests, bad-pack and file-system repair, and debugger-assisted salvage. | `303-declared`; `46-source`; complete operator surface and preservation-safe runtime plan linked |
| [PROM programmer](cadr-diagnostics-checkout-and-hardware-tools.md#prom-programmer) | Transfers, verifies, reads, and physically programs PROM devices through attached serial hardware, including the six-device CADR bootstrap set. | `303-source` (`io1/promp.lisp`); System 46 source; complete workflow linked |
| [8748/8741 and 8x51 assemblers](cadr-diagnostics-checkout-and-hardware-tools.md#embedded-controller-assemblers) | Two-pass Lisp-data assemblers producing peripheral firmware/PROM arrays rather than CADR microcode. | `303-source` (`io1/as8748.lisp`, `io1/as8751.lisp`); complete instruction-family and source-form audit linked |
| [Continuity tester and probe drive](cadr-diagnostics-checkout-and-hardware-tools.md#continuity-tester-ctest) | Parses board wire lists, plans probe travel, isolates failed wire segments, calibrates and drives two physical test probes. | `303-source` (`demo/ctest.lisp`, `io1/cdrive.lisp`); not `HACKS` components; complete manual control surface linked |
| [Chaos board tester (`CHATST`)](cadr-diagnostics-checkout-and-hardware-tools.md#chaos-interface-board-tester-chatst) | Exercises and diagnoses the raw Chaosnet interface board with pattern, echo, monitor, endurance, and optional live-NCP tests. | Active `CHAOS` component; `303-declared`; `46-source`; test families and untested interrupt boundary linked |
| [Unibus, serial, keyboard, mouse, disk, and display drivers](cadr-diagnostics-checkout-and-hardware-tools.md#the-shared-diagnostic-architecture) | Low-level machine support rather than standalone applications; `LDBG` unifies Busint, serial, and Chaos debug access. | Core `303-declared`; System 46 source |

The host-side `usim` emulator and the repository's Xvfb harness are preservation
infrastructure, not applications inside the Lisp Machine, and are intentionally not
counted here.

## System 303 `HACKS` and demo-directory census

The `HACKS` declaration calls itself “Random use programs and demos.” It actively
names `HAKDEF` plus 19 Lisp modules, then loads two compiled support objects,
`TVBGAR` and `WORMCH`. Only a file which calls `DEFDEMO` necessarily contributes a
menu entry; active system membership alone does not make a menu item.

The [complete CADR HACKS dossier](cadr-hacks-display-sound-and-novelty-suite.md)
gives every active component, compiled support object, and extra canonical visual,
sound, novelty, or infrastructure module its own source-grounded section and records
the reviewed live QIX observation. The tables here retain the release census.

### Active `HACKS` Lisp components

| Component | Established contents | Demo-menu evidence |
| --- | --- | --- |
| `HAKDEF` | `DEFDEMO` registry, sorted menu dispatcher, real-time wrapper, and shared HOF window; infrastructure rather than a demo. | Defines the menu and a `Quit` entry |
| `ABACUS` | Graphical, mouse/keyboard-driven abacus using the `ABACUS` sprite font. | `Abacus` |
| `ALARM` | Background alarms and periodic checks for times, mail, files, hosts, or free machines. | No `DEFDEMO` found |
| `BEEPS` | Sound/noise routines and short tunes using the machine beep facility. | `Beep Hacks` |
| `CROCK` | Graphical analog wall clock. | `Crock` |
| `DC` | Large six-digit graphical clock. | `Digital Crock` |
| `DEUTSC` | German cardinal, ordinal, date, and time formatting routines. | No `DEFDEMO` found |
| `DLWHAK` | PARC-style label mixin, mouse-drawn splines, tally notation, and walking TV bug. | `Splines`; `TV bug` |
| [`DOCTOR`](doctor.md) | ELIZA-style conversational program adapted from Multics, with a separately loaded `DOCSCR` rule base and a reviewed live synthetic conversation. | No `DEFDEMO` found; callable top level `DOCTOR` |
| `DOCSCR` | Rule and response data loaded by Doctor, not an independent program. | None |
| `GEB` | Mathematical/XOR visual programs named Godel, Escher, and Birds. An Atan definition survives inside a source `COMMENT` form and is not active. | Three corresponding top-level families, each with nested actions |
| `HCEDIT` | Interactive Hollerith punched-card editor, including a multi-card variant. | `Hollerith Editor`; `Multiple Hollerith Editor` |
| `MUNCH` | Munching Squares with a displayed and editable switch register. | `Munching Squares`; see [dedicated article](munch.md) |
| `OHACKS` | Miscellaneous older hacks, including sound and display routines. | `Munching Tunes`; `Live Bounce`; `Lexiphage` |
| `ORGAN` | Keyboard-controlled organ/gamelan sound program. | No `DEFDEMO` found; callable top level `ORGAN` |
| [`QIX`](cadr-hacks-display-sound-and-novelty-suite.md#qix) | Moving XOR line-and-history-trail display, explicitly described as not the arcade game; loaded and observed in a fresh System 303 session. | `Qix` |
| `ROTATE` | BITBLT bitmap rotation and cellular-automaton Life display. | `Rotate`; `Life` |
| `ROTCIR` | Rotating-circle/spirograph display. | `Rotating Circles` |
| `WORM` | Recursive/fractal worm graphics using the `WORM` sprite font. | `Worm` |
| `WORM-TRAILS` | Interactive trail-learning game in which the user trains a moving worm. | `Worm-Trails` |

The active list is taken from
[`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=sys%2Fsysdcl.lisp&ln=358-373).
`TVBGAR` supplies walking-bug raster arrays and `WORMCH` supports the worm display;
neither is counted as a separate application.

### Extra canonical `demo/*.lisp` source, not active `HACKS` components

| File | Established contents | Why it is not promoted to installed demo |
| --- | --- | --- |
| `CAFE` | Four-bit color version of the cafe-wall optical illusion. | Explicitly commented out of `HACKS` with the other color files |
| `COLORHACK` | Color-map manipulation, drawing primitives, and assorted color-screen demonstrations. | Explicitly commented out of `HACKS` |
| `COLXOR` | Four-bit color XOR, ramp, line, and animation experiments. | Explicitly commented out of `HACKS`, despite defining a `Color TV Hacks` menu entry if loaded |
| `CRAZE` | Recursive clipped-line and jagged-ray display routines. | Source present; no `HACKS` component or `DEFDEMO` registration found |
| `CTEST` | CADR board continuity-test mapping, probe, wire-run, and optimization software. | Engineering tool stored in `demo/`, not a casual demo or `HACKS` component |
| `FREDKIN` | Reversible XOR image transformation with a `Fredkin` demo registration. | Not a `HACKS` component and unconditionally loads missing `SYS:DEMO;ELP-ARRAY`; incomplete in this checkout |
| `LISS` | Converts X/Y duration sequences into a Lissajous-like vector display. | Source present; no `HACKS` component or `DEFDEMO` found |
| `NPAINT` | Legacy mouse-driven raster Paint program. | Source present; not a `HACKS` component |
| `PFOM` | Image-backed color window, “Lunar turkey” display, and a mouse-driven tile game. | Not a `HACKS` component; default `SYS:DEMO;RISING SUN` image input is absent |
| `TREEDV` | Three-dimensional segmented-vector library and demos including rotating aircraft, boxes, surfaces, and stereo viewing. | Source present; not a `HACKS` component and color paths depend on `COLORHACK` |
| `VERSAT` | Versatec printer/plotter control and screen-copy routines. | Hardware output utility, not a `HACKS` component |
| `VOTRAX` | Serial interface to a Votrax speech synthesizer and phoneme/word routines. | Hardware-dependent source, not a `HACKS` component |
| `WHAT` | Novelty natural-language-like question dispatcher with extensible response “demons.” | Source present; no `HACKS` component or `DEFDEMO` found |
| `WORDS` | Pronunciation property data consumed by `VOTRAX`. | Support data expressed as Lisp, not an independent application |

This separation matters: a researcher can study all 34 files without claiming that
the System 303 band loaded all 34, that the demo menu exposed them, or that missing
hardware/data dependencies work under emulation.

### Other games and System 46 demo material

| Program or artifact | Evidence-bounded status |
| --- | --- |
| [Spacewar](spacewar-on-the-lisp-machine.md) | Standalone `46-source` and `303-source`; System-key `W` in maintained source; live playfield observed; not a `HACKS` component. |
| MUNCH, Munching Tunes, Organ, and Lexiphage | Present together in System 46 `lmio1/hacks`; the maintained tree splits them among `MUNCH`, `ORGAN`, and `OHACKS`. See [MUNCH](munch.md) and [LEXIPHAGE](lexiphage.md). |
| Paint / NPaint | `46-source`; also retained as extra `303-source`; see graphics table. |
| GEB | System 46 preserves source and/or QFASL material; active System 303 `HACKS` component. |
| `LMDEMO QFASL` | Compiled System 46 demo bundle of unresolved exact contents: `46-artifact`, `uncertain`. |
| `PICT QFASL` | Compiled-only System 46 procedural graphics program: `46-artifact`, `uncertain` start procedure. |
| `SCANIN CWH3` | Data input for the `SCAN` display, not itself an application. The associated executable source is not recovered in the snapshot. |

## Complete maintained-tree named-system census

The following table accounts for all 55 unique non-commented top-level `DEFSYSTEM`
names in canonical source files. The categories describe the declaration's role;
they do not turn aggregates or libraries into applications, and they do not prove
that every declaration file was loaded.

| Declaration class | Count | Names |
| --- | ---: | --- |
| Aggregates and boot/build sets | 8 | `SYSTEM`, `SYSTEM-INTERNALS`, `SYSTEM-MACROS`, `COLD`, `COLD-LOAD`, `INNER-SYSTEM`, `OUTER-SYSTEM`, `OPTIONAL-SYSTEM` |
| Core language/runtime systems | 7 | `FONTS`, `FORMAT`, `COMPILER`, `QFASL-REL`, `TIME`, `MATH`, `GARBAGE-COLLECTOR` |
| User-interface and application systems | 10 | `TV`, `ZWEI`, `ZMAIL`, `EH`, `PEEK`, `FED`, `HACKS`, `CONVERSE`, `ISPELL`, `COLOR` |
| Files, storage, and tape | 13 | `FILE-SYSTEM`, `FILE-SYSTEM-UTILITIES`, `LOCAL-FILE`, `FILE-SERVER`, `LFS`, `LMFILE-SERVER`, `LMFILE-REMOTE`, `TAPE`, `TFRAME`, `TAPE-COMPAT`, `WESPERCO`, `TAPEMASTER`, `VMS-TAPE` |
| Network, terminal, and site systems | 7 | `CHAOS`, `ETHERNET`, `SITE`, `SITE-EDITOR`, `SUPDUP`, `UNIX`, `MIT-SPECIFIC` |
| Output and development support | 4 | `PRESS`, `FONT-UTILITIES`, `SRCCOM`, `METER` |
| CADR hardware and microcode | 4 | `CADR`, `CADR-DEBUGGER`, `CADR-MICRO-ASSEMBLER`, `UCODE` |
| External implementation declarations | 2 | `AMORD`, `SPICE-PLOT` |
| **Total** | **55** | Every unique non-commented top-level `DEFSYSTEM` name found by the pinned-tree audit |

Three declaration relationships are especially useful for interpreting that list:

- `OUTER-SYSTEM` actively groups `ZWEI`, `ZMAIL`, `CONVERSE`, `LOCAL-FILE`,
  `FILE-SERVER`, and `TAPE` as standard interfaces loaded over the core system.
- `OPTIONAL-SYSTEM` actively groups `FED`, `COLOR`, `PRESS`, `HACKS`, and `ISPELL`.
- The main `SYSTEM` declaration directly includes core runtime systems but leaves
  ZWEI, FED, Color, Press, HACKS, Converse, and Ispell separate so they can be
  patched or loaded independently. A commented line is not an active component.

The non-commented external declarations `AMORD` and `SPICE-PLOT` point to
implementation directories on an `OZ` host which are not in the preserved checkout.

| Declared name | What the local declaration establishes | Status |
| --- | --- | --- |
| `AMORD` | An external package with `TMS`, `NNMORD`, functions, and rules modules. Its user-facing purpose is **TODO** without the implementation. | `external`, `uncertain` |
| `SPICE-PLOT` | An external `SPICE` package with structure, window, SPICE parser, plotting, and random-support modules. | `external`; implementation and runtime behavior absent |

Six additional site files register external system-definition paths without
declaring the systems locally:

| Registered name | Local evidence | Status |
| --- | --- | --- |
| `ARLO`, `ARLOX` | Logical host and two external system-definition paths | `external` |
| `Daedalus`, `nodes` | `DPL` logical host and external definitions | `external` |
| `RLL` | Four logical host mappings and an external `SysDef` path | `external` |
| `YAPS` | `YAPS` logical host and external `mit-defsystem` path | `external` |

The commented candidates `TIGER`, `KERMIT`, `WINDOW-MAKER`, `OBJECTLISP`,
`MEDIUM-RESOLUTION-COLOR`, `GATEWAY`, and `LAMBDA-DIAG` are historical leads, not
present applications in this census. `SITE-EDITOR` and `CADR` are also commented
out of particular aggregates, but each has an active declaration elsewhere and is
therefore legitimately counted. The `UNIX` declaration is counted but marked
incomplete because its named implementation files are absent.

## System 46 source/load census versus maintained System 303

The System 46 snapshot lacks a central `DEFSYSTEM` inventory comparable to the
maintained tree, so its strongest installation evidence is `lmdoc/lispm.files`.
That load list accounts for
the core Lisp runtime and structures; disk I/O, `DLEDIT`, Dribble, Grind, Trace and
Step; XGP, Chaosnet, `CHATST`, EFTP, SUPDUP, Press, FORMAT, compiler, QFASL
relocation; Color, FED, CADR console/debugger tools; Error Handler, TV window system,
System Menu, screen editor, Peek and Inspector; QFILE, font utilities, meter, package
declarations, and system-building support.

The rest of the public tree adds bounded source or artifact evidence for ZWEI and
Dired, Paint, DPLT, Spacewar, MUNCH and other hacks, Lexiphage, PICT, GEB, Organ,
and older measurement/trace tools. It does not justify claiming that every personal
file under `moon/` was installed in System 46.

Important snapshot differences include:

| Compared result | Evidence-bounded conclusion |
| --- | --- |
| Zmacs | System 46 preserves ZWEI sources, tags, structures, and generated command help, but not the Zmacs implementation source. System 303 has the complete declaration and source. |
| ZMail, Converse, BDired, Edit Buffers, Ispell, TFrame, and Site Data Editor | Source is present only in the maintained tree of the two compared snapshots. This does not date first invention or prove tested-band installation. |
| Paint and Spacewar | Source is present in both snapshots, but neither is an active System 303 `HACKS` component. |
| XFED, `LMETER`, and `PTRAC` | Named source survives in System 46 and is absent under those exact names in maintained canonical source. Related later font, meter, and trace facilities do exist; these are not simple “feature removed” claims. |
| PICT and System 46 demo bundle | Compiled artifacts survive without complete source identity/start procedures. |
| Tapes and Site Editor | Maintained-tree declarations include later LMI material; source presence must not be backdated to original MIT System 303. |

## Completeness limits and open questions

- **Load-band membership remains narrower than source-tree membership.** The
  Listener, Zmacs, System Menu, Inspector, Peek, Emergency Break, and five
  System-Help bindings now have bounded runtime evidence in the museum's System 303
  harness records; that evidence does not establish every declared subsystem.
- **The System 46 snapshot is early and uneven.** Generated tags and QFASLs sometimes
  name implementations whose source is missing; Zmacs is the clearest example.
- **Maintained-tree chronology is layered.** Later LMI files and restorations coexist
  with MIT material. The Fossil check-in is the reproducible software witness; it is
  not a claim of one authorship or date.
- **External site registrations are not recovered programs.** ARLO, ARLOX, Daedalus,
  nodes, RLL, YAPS, AMORD, and SPICE-PLOT need their external trees before their
  actual feature sets can be cataloged.
- **Source-visible dependencies can still be absent.** `FREDKIN` lacks `ELP-ARRAY`,
  `PFOM` lacks its default `RISING SUN` input, and hardware-bound programs require
  devices not supplied by `usim`.
- **SUDS remains data-only here.** Drawings and plot streams survive, and DPLT prints
  plot data, but this audit found no complete runnable SUDS drawing editor in either
  bounded software set.
- **TODO:** identify the precise contents/start procedure of System 46 `LMDEMO QFASL`
  and `PICT QFASL` without executing untrusted compiled code.
- **TODO:** exercise Trace, Editing Lisp Listener, Dired, BDired, FED, Converse,
  Spacewar, and Paint through the harness; extend ZMail runtime
  work only after loading its optional frame into a disposable band;
  publish only individually reviewed screenshots used as scholarly evidence.

## Reproducing the census

The named-system count was obtained from non-commented top-level `DEFSYSTEM` forms in
canonical `.lisp` and `.system` files, excluding numbered Fossil history files. The
demo count similarly uses canonical `demo/*.lisp` paths. A compact reproduction from
the root of a checkout is:

```sh
rg -i '^\(defsystem[[:space:]]+' l/sys \
  --glob '*.lisp' --glob '*.system' --glob '!*.lisp.[0-9]*'

find l/sys/demo -maxdepth 1 -type f -name '*.lisp' -print | sort

rg -a -n '^\(DEFDEMO|^\(defdemo' l/sys/demo/*.lisp
```

The count was then audited against component systems and module lists in `sysdcl`,
the separate file/tape/Site Editor declarations, `SET-SYSTEM-SOURCE-FILE`
registrations, System-key registration, window/frame flavors, top-level functions,
and the complete System 46 filename/load inventory. A textual hit was treated as a
lead until its declaring or consuming context established a role.

## Sources

- MIT CADR System 46 public source at pinned Git commit
  [`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  especially the [`LISPM.FILES` load inventory](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmdoc/lispm.files),
  [`NZWEI`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei),
  [`HACKS`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/hacks.189),
  and [`Spacewar`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/swar.2).
- Maintained LM-3 System 303 Fossil check-in
  [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  especially [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=sys%2Fsysdcl.lisp),
  [`window/sysmen.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fsysmen.lisp),
  [`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=window%2Fbasstr.lisp),
  [`file/fs.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=file%2Ffs.lisp),
  [`file2/system.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=file2%2Fsystem.lisp),
  [`tape/sysdef.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=tape%2Fsysdef.lisp),
  and the [`demo/` source directory](https://tumbleweed.nu/r/sys/dir?ci=4df393c68d7f083ce42d5c377039d26043cc18a9&name=demo).
- Repository studies of [ZWEI and Zmacs](zwei-and-zmacs.md),
  [on-line help recovery](online-help-and-documentation-recovery.md),
  [visual assets](visual-assets-inventory.md),
  [fonts](font-usage-audit.md), and
  [runtime harness observations](cadr-computer-use-harness.md#current-schema-cold-boot-observations).

Last verified: 2026-07-18.
