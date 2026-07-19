---
type: Museum Catalog
title: How CLIM was used across the CADR and Genera software catalogs
description: A source-grounded audit of whether and how each of the sixty canonical Lisp-machine software dossiers used CLIM, provided a CLIM port or compatibility hook, used Dynamic Windows instead, or predates CLIM entirely.
tags: [lisp-machine, mit-cadr, lm-3, genera, clim, dynamic-windows, applications, user-interface]
timestamp: 2026-07-18T14:05:34-04:00
---

# How CLIM was used across the CADR and Genera software catalogs

CLIM was **not** the universal interface framework of either catalog. The MIT CADR
and maintained LM-3 software predates CLIM and uses the TV window system, EINE/ZWEI,
streams, and application-specific loops. Most native Genera applications likewise
use Dynamic Windows, ZWEI, or retained TV facilities rather than CLIM. In the
inspected Genera 8.5 media, CLIM is a distinct optional portable-interface family:
the release roster names core CLIM, a native Genera port, CLX and PostScript ports,
documentation, and demonstrations.

That distinction matters because Dynamic Windows and CLIM share conspicuous ideas:
typed presentations, command tables, formatted output, accepting values, panes, and
incremental redisplay. A source file containing `DEFINE-PRESENTATION-TYPE`, or a
screen containing mouse-sensitive objects, is not therefore enough to call an
application a CLIM application. This audit follows the defining package, system
dependency, frame macro, and port boundary for every topic in the
[60-dossier catalog](software-application-dossiers.md).

## Reading the classifications

| Classification | Meaning in this audit |
| --- | --- |
| **CLIM-native application** | The application is organized as a CLIM application frame or otherwise runs through CLIM's frame, pane, command, presentation, stream, or redisplay protocols. |
| **CLIM integration or consumer** | The software is not itself a CLIM application, but directly calls, extends, documents, converts, or conditionally consumes CLIM. |
| **CLIM port or provider** | The software supplies a display, stream, object-system, graphics, printing, process, or platform facility used by CLIM without thereby becoming a CLIM application. |
| **Dynamic Windows, not CLIM** | The Genera application uses `DW:DEFINE-PROGRAM-FRAMEWORK`, Dynamic Windows commands, presentations, panes, handlers, or redisplay. Similar concepts are independent evidence, not proof of CLIM. |
| **TV/ZWEI, pre-CLIM** | The CADR/LM-3 application belongs to the earlier window/editor substrate. Later conceptual similarity is lineage, not implementation use. |
| **Non-UI substrate or service** | The topic has no application interface of its own, or its interface is a command/stream/protocol surface outside CLIM. It may still be consumed by a CLIM port. |
| **Not established** | Available source, declarations, compiled media, manuals, and runtime state do not support a stronger statement. |

“Uses CLIM” below always states direction. A PostScript medium is a CLIM output
provider; it does not make the ordinary Genera Hardcopy or Print applications CLIM.
A Dynamic Windows-to-CLIM converter emits CLIM source; its own editor remains a
Dynamic Windows/Zmacs tool. A CLOS invalidation hook serves CLIM presentation
dispatch; the Flavor Examiner remains a Dynamic Windows program.

## Evidence boundary and method

The application boundary and row names come from the
[cross-system software catalog](lisp-machine-software-catalog.md) and its
[dossier coverage matrix](software-application-dossiers.md). The implementation
audit used these identified corpora:

| Corpus | Boundary used here |
| --- | --- |
| MIT CADR System 46 | [Public source snapshot at Git commit `8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src); CLIM did not yet exist, so the audit identifies the actual TV, EINE/ZWEI, stream, or non-UI mechanism rather than performing a meaningless name search alone. |
| Maintained LM-3 | [Public Fossil check-in `4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91); used to cross-check later CADR-lineage interfaces without projecting Genera facilities backward. |
| Genera 8.5 media | Licensed `sys.sct` tree of 5,075 files from the identified 206,213,430-byte Open Genera archive; inspected locally and described only in original prose. No source or decoded proprietary payload is reproduced here. |
| Runtime | The isolated base Genera world did not have the CLIM package, feature, or system loaded. Existing screenshots therefore establish Dynamic Windows or other native visible states, not CLIM execution. Optional CLIM applications remain explicit runtime TODOs. |

The source pass checked system declarations and package context before interpreting
surface macro names. It searched for CLIM application frames, commands, command
tables, panes and layouts, presentations and translators, input editing, formatted
output, drawing and designs, output records and redisplay, gadgets and dialogs,
streams, ports and mirrors, CLX/PostScript media, and `CLIM-SYS` process/lock use.
It also searched for Dynamic Windows and TV/ZWEI definitions so a negative CLIM
finding still names the real interface architecture.

One useful control is the application-frame census. The licensed tree contains 28
semantically relevant definition or conversion sites: 26 actual
`DEFINE-APPLICATION-FRAME` forms in the CLIM demonstration, tutorial, and test
sources, plus two Conversion Tools sites that recognize or emit that CLIM syntax.
The latter are not definitions of the converter's own interface.
Conversely, the media catalog contains 49 concrete Dynamic Windows program
frameworks. The two populations must not be merged merely because both have frames,
panes, commands, and presentations.

The baseline VLM system-info roster records the six CLIM release families together
at version 64.0. The installed CLIM-family patch directories separately report
released/latest patch generation 72; 64.0 is therefore the roster version, not the
only version marker present in the media:

| Release system | Role |
| --- | --- |
| `CLIM` | Portable core: geometry, sheets, media, streams, output records, formatting, presentations, input editing, commands, frames, panes, gadgets, and `CLIM-SYS`. |
| `Genera-CLIM` | Native Genera port, declared as port, mirror, medium, pixmap, frame, activity, and prefill modules; the implementation modules are compiled-only in this media. |
| `CLX-CLIM` | CLX display port with port, mirror, medium, pixmap, frame, and prefill modules. |
| `PostScript-CLIM` | Noninteractive PostScript port and medium with printer metrics. |
| `CLIM-Doc` | Document Examiner/Sage documentation system, including CLIM-specific record types and tutorial-source links. |
| `CLIM-Demo` | Demonstration, tutorial, and test applications audited separately as D59. |

The sections below use the CLIM 2 feature families as the semantic vocabulary, but
describe Symbolics' implementation only to the depth supported by its declarations,
readable application source, manuals, and runtime state. Compiled-only port modules
remain compiled-only evidence.

## D01–D20: core interaction, applications, and administration

### D01 — Lisp Listeners and editable input

**Classification: CLIM integration/provider; the ordinary Listeners are not
CLIM-native.** CADR and LM-3 use TV stream editing and, in editing listeners, ZWEI.
Genera's Dynamic Lisp Listener is a Dynamic Windows/Command Processor client. The
real CLIM relationship is below that UI: the reader can enter
`WITH-CLIM-COMPATIBLE-INPUT-EDITING`, and the history layer exposes a callback that
can mirror changes into CLIM's kill ring (`sys.sct/clcp/iofns.lisp.~273~` and
`sys.sct/io/history-inner.lisp.~23~`). The separately shipped CLIM Lisp Listener is
a D59 demo, not the implementation of Genera's normal Listener.

### D02 — Program selection, activities, and window management

**Classification: native TV/Dynamic Windows manager with a compiled CLIM adapter.**
CADR selection and the System Menu are TV facilities. Genera retains a native
activity registry and System Menu, while Dynamic Windows frameworks register with
that host machinery. `Genera-CLIM` separately declares frame and activity modules
(`sys.sct/clim/rel-2/genera/sysdcl.lisp.~10~`), and the CLIM activity demo confirms
that a CLIM frame can participate in Genera activities. The adapter bodies are
compiled-only, so their private mapping is not established; the direction is CLIM
joining the native activity system, not the System Menu being implemented in CLIM.

### D03 — Screen Editor and Frame-Up layout design

**Classification: TV and Dynamic Windows, not CLIM.** The CADR/LM-3 Screen Editor
directly edits the TV window tree; Genera retains that TV tool. Frame-Up is a separate
Dynamic Windows layout designer whose source emits
`DEFINE-PROGRAM-FRAMEWORK` templates (`sys.sct/dynamic-windows/layout-designer.lisp.~4039~`).
Neither tool defines a CLIM frame or depends on CLIM. The separate DW-to-CLIM
converter in D39 reinforces the boundary: a Dynamic Windows framework is input to a
conversion, not another spelling of a CLIM application frame.

### D04 — Emergency Break and degraded interaction paths

**Classification: primitive stream/TV recovery path, not CLIM.** Both lineages keep
Emergency Break beneath their ordinary application frameworks so that limited input
and evaluation can survive damage to higher UI layers. CADR/LM-3 implements it in
the base stream/window code; Genera combines the base-window path with its cold-load
stream (`sys.sct/window/basstr.lisp.~645~` and
`sys.sct/sys/cold-load-stream.lisp.~6~`). It neither creates a CLIM frame nor uses
CLIM input contexts; requiring CLIM here would defeat the degraded-mode dependency
design.

### D05 — EINE, ZWEI, and Zmacs editor family

**Classification: TV/ZWEI editor with a narrow CLIM development-tool hook.** EINE
and the public CADR editors predate CLIM. Genera Zmacs retains ZWEI buffers,
intervals, modes, command tables, redisplay, and TV editor frames; Dynamic Windows
adds native presentation integration, but Zmacs is not a CLIM application. One
direct CLIM-aware feature is source navigation: the language-mode machinery knows
the definition-name position of `CLIM:DEFINE-PRESENTATION-METHOD`
(`sys.sct/zwei/language-modes.lisp.~140~`). That helps edit and locate CLIM
definitions without changing the editor's own toolkit.

### D06 — Directory, difference, and buffer editors

**Classification: ZWEI/TV with Dynamic Windows assistance, not CLIM.** CADR Dired,
BDired, and Edit Buffers are special ZWEI modes displayed in TV editor windows. The
Genera versions remain ZWEI special buffers and add native presentation-sensitive
object operations (`sys.sct/zwei/dired.lisp.~465~`). Searches of Dired and the
encoded Buffer Editor source found no CLIM dependency or application frame. Their
interactive object displays belong to Genera's ZWEI/Dynamic Windows integration,
not to CLIM.

### D07 — Help, self-documentation, and Document Examiner

**Classification: Dynamic Windows application and CLIM documentation consumer.**
CADR and LM-3 Help are TV/ZWEI self-documentation facilities. Genera's Standard and
Small Document Examiner frames are Dynamic Windows frameworks
(`sys.sct/nsage/ddex/examiner.lisp.~81~`). The direct CLIM use is content-side:
`sys.sct/doc/clim/clim-doc.lisp.~68~` registers CLIM books, tutorial links, and
CLIM-specific defining-form record types with Sage/Document Examiner. The browser
therefore indexes CLIM documentation while remaining a native Dynamic Windows
application.

### D08 — ZMail and mail composition

**Classification: ZWEI/TV and Dynamic Windows, not CLIM.** The complete maintained
LM-3 reader and composer are ZWEI/TV applications; the System 46 source witness is
incomplete and is not silently filled from the later tree. Genera Zmail retains a
Flavors/ZWEI/TV top-level frame and uses Dynamic Windows presentation helpers in its
reader and summary windows (`sys.sct/zmail/top.lisp.~1561~` and
`sys.sct/zmail/window.lisp.~1538~`). No CLIM frame, pane, command, presentation
definition, or required-system edge was found in the application.

### D09 — Converse, direct messages, and Notifications

**Classification: ZWEI/TV plus Dynamic Windows, not CLIM.** Maintained Converse is
a ZWEI/TV messaging window. Genera's Converse remains a ZWEI/Flavors frame, while
the central Notifications viewer is a Dynamic Windows program framework
(`sys.sct/window/notifications-activity.lisp.~4011~`). Neither source family has a
direct CLIM adapter. The ability of these programs to live beside CLIM applications
in one Genera activity environment comes from the host activity/window layer, not
from their being rewritten in CLIM.

### D10 — Network terminal applications

**Classification: TV terminal windows with native Dynamic Windows facilities, not
CLIM.** CADR SUPDUP and NVT attach protocol streams to TV terminal windows. Genera's
Terminal/Telnet implementation likewise defines network terminal streams and TV
window behavior (`sys.sct/network/telnet.lisp.~1600~`) and adds Dynamic Windows
typeout, arguments, and presentations. There is no CLIM application-frame or port
implementation in this program; a remote connection would test protocol behavior,
not change the source-level toolkit classification.

### D11 — Object Inspector and Presentation Inspector

**Classification: TV Inspector and Dynamic Windows Presentation Inspector, not
CLIM.** The CADR and Genera general Inspectors are TV/Flavors applications. Genera's
Presentation Inspector is explicitly a Dynamic Windows program framework that
examines Dynamic Windows handler and dispatch objects
(`sys.sct/dynamic-windows/presentation-inspector.lisp.~4053~`). Its name is a
particularly strong false friend: presentations are shared design vocabulary, but
the inspected records, presentation types, and handlers are `DW`/`SCL` objects, not
CLIM presentations.

### D12 — Error Handler and graphical debuggers

**Classification: condition substrate with TV or Dynamic Windows UI, not CLIM.**
CADR's graphical Error Handler is a TV frame over trap and stack machinery. Genera's
ordinary debugger remains condition/restart infrastructure, and Display Debugger is
a Dynamic Windows framework with native panes, commands, and presentations
(`sys.sct/debugger/display-debugger.lisp.~38~`). A CLIM application may fall into
the host debugger, but that generic host-service relationship does not make the
debugger a CLIM program.

### D13 — Trace, Stepper, breakpoints, and call analysis

**Classification: non-UI instrumentation with TV/ZWEI or Command Processor/Dynamic
Windows clients, not CLIM.** Trace and Stepper primarily instrument evaluation and
function calls; Who Calls maintains analysis data. CADR exposes those facilities
through TV/ZWEI, while Genera uses native commands and presentations
(`sys.sct/debugger/stepper.lisp.~7~` and `sys.sct/sys2/who-calls.lisp.~4096~`). No
specific CLIM hook was found. CLIM code can be traced because it is Lisp code, not
because these tools implement a CLIM protocol.

### D14 — Peek and live system observation

**Classification: TV/Flavors application, not CLIM.** CADR and Genera Peek retain
TV modes, periodic redisplay, and object menus; the Genera frame has small Dynamic
Windows additions but no CLIM application frame (`sys.sct/window/peek.lisp.~4073~`).
CLIM-Demo contains a different program named `peek-frame` that uses CLIM incremental
redisplay. That source explicitly implements a small Peek-like example and must not
be used as evidence about the production Peek application.

### D15 — Metering and performance analysis

**Classification: non-UI measurement substrate with a Dynamic Windows interface,
not CLIM.** CADR/LM-3 metering records counters, events, and page traces and emits
TV/ZWEI reports. Genera's optional Metering Interface is directly defined as a
Dynamic Windows framework with native panes, presentation types, commands, and
Accepting Values (`sys.sct/metering/interface/mi.lisp.~229~`). No CLIM client form
or dependency occurs in that UI. The optional system's current runtime load blocker
does not weaken the direct source-level classification.

### D16 — Flavors, CLOS, and Flavor Examiner

**Classification: CLOS provider/integration hook; Flavor Examiner itself is Dynamic
Windows.** Flavors and CLOS are object substrates, not application toolkits. Genera's
visible Flavor Examiner is a Dynamic Windows framework. CLIM's declaration selects
Genera-specific CLOS extensions, while CLOS invokes an optional CLIM handler-cache
invalidator after relevant superclass changes
(`sys.sct/clos/basic-class.lisp.~158~`). This is real bidirectional infrastructure
integration for presentation dispatch, but it neither turns CLOS into a CLIM UI nor
turns the Flavor Examiner into a CLIM frame. The installed invalidator body is
compiled-only.

### D17 — File systems, Dired-facing operations, and file service

**Classification: stream/pathname provider with Dynamic Windows clients; not a CLIM
application.** CADR file protocols and services are non-UI substrate with ZWEI/TV
clients. Genera's visible File Server activity is a Dynamic Windows framework
(`sys.sct/io/server-util.lisp.~1532~`). CLIM does consume native Genera stream
semantics: its declaration selects Genera stream functions and includes a compiled
`genera-streams` adapter. That supports a provider relationship for ordinary CLIM
stream panes and file I/O, not a claim that the File Server program uses CLIM.

### D18 — Disk labels, packs, salvage, and file-system maintenance

**Classification: CADR terminal/TV utility; Genera UI remains
unknown/compiled-only, with no CLIM evidence.** DLEDIT is a direct character-command
loop over disk structures, while checkout and salvage are storage substrate. The
inspected Genera media exposes FSEdit names, Help, and ZWEI tree-editing references,
but not the main frame source. No FSEdit-specific CLIM reference or dependency was
found. A CLIM test file containing a saved process label for an Fsmaint frame is test
fixture data, not an API relationship; the positive Genera toolkit classification
therefore remains unresolved rather than guessed from appearance.

### D19 — Tape systems and Tape Utility Frame

**Classification: tape substrate with TV or Dynamic Windows administration, not
CLIM.** The maintained LMI-derived TFrame is a TV frame/pane application, distinct
from MIT System 46. Genera tape streams and formats are non-UI; the tape-host input
and Restore Distribution frame use Dynamic Windows
(`sys.sct/distribution/restore-frame.lisp.~4029~`). The FEP-Tape private UI module
is absent/compiled-only, but no available tape declaration or application source
requires CLIM. That gap is preserved instead of generalized from neighboring tools.

### D20 — Site data and Namespace administration

**Classification: data/service substrate with TV or Dynamic Windows editor, not
CLIM.** MIT site tables are non-UI, and the later LMI/Gigamos Site Data Editor is a
TV constrained-frame program rather than an MIT System 303 or CLIM application.
Genera's Namespace Editor is directly defined as a Dynamic Windows program framework
and uses the native namespace presentation types and Accepting Values
(`sys.sct/network/namespace-editor-activity.lisp.~4033~`). No CLIM frame or
presentation method occurs in the editor.

## D21–D40: services, development, media, and optional products

### D21 — Background services and operations dashboards

**Classification: non-UI services with TV/process or Dynamic Windows operator
surfaces, not CLIM.** CADR workers and file servers are Lisp processes with status
and recovery output. Genera's Mailer, Print Spooler, Domain Server, and File Server
monitors are Dynamic Windows program frameworks over shared task/log substrates;
representative declarations occur in `sys.sct/mailer/log.lisp.~1536~`,
`sys.sct/print/log.lisp.~1520~`, and
`sys.sct/ip-domain-server/domain-server.lisp.~4044~`. CLIM names in adjacent patch
headers describe the build world, not these systems' dependencies.

### D22 — Lisp runtime, compiler, and development environment

**Classification: non-UI runtime/compiler with a narrow CLIM input provider.** The
CADR evaluator, reader, compiler, disassembler, and TV/ZWEI development surfaces
predate CLIM. Genera's core reader can operate under either native or CLIM input
editing through `WITH-CLIM-COMPATIBLE-INPUT-EDITING`
(`sys.sct/sys2/lmmac.lisp.~587~`, with uses in `sys.sct/io/read.lisp.~602~` and
`readers.lisp.~251~`). This makes core input a compatibility provider. It does not
make the compiler, garbage collector, Listener, or Programming Tools commands CLIM
applications, and the lower adapter mechanics are compiled-only.

### D23 — Compiled objects, QFASL, relocation, and UNFASL

**Classification: non-UI serialization/loading substrate, not CLIM.** CADR QFASL
and Genera L-BIN/VBin machinery encode, relocate, load, and inspect compiled effects;
they expose no frame, pane, presentation, or display protocol. CLIM itself can be
delivered through this machinery, as the installed compiled-only modules demonstrate,
but that is a payload relationship. The dependency arrow is CLIM compiled by and
loaded through the D23 facilities, not the loader using CLIM.

### D24 — System construction, patches, worlds, bands, and distribution

**Classification: construction substrate and Dynamic Windows tools; catalog
consumer, not CLIM UI.** CADR Make-System, cold-load, and band construction use Lisp
with TV/ZWEI entry points. Genera's planning, world-building, distribution, and
restore surfaces use Command Processor and Dynamic Windows frameworks
(`sys.sct/distribution/distribute-frame.lisp.~4040~` and
`restore-frame.lisp.~4029~`). SCT's release roster knows the six CLIM system records
so it can build or distribute them. Cataloging a separately installable product is
not implementation of the construction UI in that product.

### D25 — Source comparison, Compare/Merge, and version control

**Classification: ZWEI and Dynamic Windows, not CLIM.** The complete maintained
LM-3 SRCCOM uses TV streams, ZWEI buffer pointers, and merge records; the System 46
implementation is missing. Genera Compare/Merge and Version Control are editor
extensions whose semantic objects use Dynamic Windows presentation types and
translators (`sys.sct/version-control/vc/dynamics.lisp.~2626~`). No readable body
defines a CLIM frame or requires CLIM. Presentation-based diagrams here are native
DW behavior, not evidence of a CLIM migration.

### D26 — Formatting, spelling, and text-production utilities

**Classification: stream processors with ZWEI/Dynamic Windows clients, not CLIM.**
FORMAT, FQUERY, grinders, transcripts, and spelling facilities are older stream and
editor subsystems in CADR/LM-3. Genera exposes spelling and document-production work
through Zmacs and Sage/Dynamic Windows presentation types
(`sys.sct/nsage/sage-ui.lisp.~287~`). A data identifier named `CLIMCopy` is not a
package call, and generic reader compatibility from D22 does not make each utility a
CLIM application.

### D27 — Mathematical and numeric facilities

**Classification: non-UI numeric substrate, not CLIM.** Matrix, rational, complex,
numeric, and infix facilities implement representations, algorithms, reader syntax,
and APIs in both lineages. Dynamic Windows and CLIM each define presentation types
that can accept or display numbers, but those are downstream UI consumers. No
numeric-system dependency on CLIM or application definition was found; the
architectural direction is from UI type systems toward the numeric objects.

### D28 — Dynamic Windows and presentation-based interaction

**Classification: a distinct native framework, explicitly not CLIM, with a shared
input-editing seam.** CADR TV frames, mouse-sensitive items, and typed windows are
pre-CLIM antecedents. Genera declares Presentation Substrate, Dynamic Windows, and
Dynamic Window Clients independently of CLIM, and implements its own presentations,
sensitive output, program frameworks, panes, and incremental redisplay. Readable DW
source uses the CLIM-compatible input wrapper
(`sys.sct/dynamic-windows/substrate-definitions.lisp.~44~`), enabling coexistence
without making the two APIs directly compatible or identical.

### D29 — CLIM 2 on Genera

**Classification: CLIM-native product and port family.** This is the actual portable
interface system: its declarations assemble CLIM utilities, Silica, standalone
streams/output/presentation/command/frame layers, and the Genera, CLX, and PostScript
ports (`sys.sct/clim/rel-2/sys/sysdcl.lisp.~216~`). The native port declares ports,
mirrors, media, pixmaps, frames, activities, and prefill. Most implementation bodies
are compiled-only, so the module graph and interface families are established but
private algorithms are not. The preserved base world did not have this optional
system loaded.

### D30 — FED and the Font Editor generations

**Classification: TV on CADR and Dynamic Windows on Genera, not CLIM.** The public
FED generations directly use old/new TV window facilities. Genera's Font Editor is a
Dynamic Windows program derived from Bitmap Editor, with native presentation types,
translators, and handlers (`sys.sct/bitmap-editor/font-editor.lisp.~124~`). A source
comment treats future CLIM support as distinct from the implementation in hand. The
CLIM demo bitmap editor and color chooser belong to D59 and are not production Font
Editor code.

### D31 — Bitmap, stipple, and raster paint editors

**Classification: direct TV graphics on CADR and Dynamic Windows on Genera, not
CLIM.** PAINT/NPAINT use screen state, TV menus, and BITBLT. Genera Bitmap Editor
and Stipple Editor explicitly define Dynamic Windows program frameworks,
presentations, mouse tracking, and native incremental redisplay
(`sys.sct/bitmap-editor/bitmap-editor.lisp.~284~` and
`stipple-editor.lisp.~15~`). The similarly named CLIM demo is an independent D59
specimen rather than a toolkit layer beneath these editors.

### D32 — Graphic Editor and structured drawing

**Classification: CADR drawing substrate and Genera Dynamic Windows editor, not
CLIM.** The public trees establish BITBLT-era drawing and file-format clues but not a
complete earlier structured editor. Genera's production Graphic Editor directly
defines a Dynamic Windows framework, entity presentations, pointer tracking, and
native output (`sys.sct/graphic-editor/graphic-editor.lisp.~351~`). No CLIM
application-frame or required-system edge occurs. CLIM-Demo's Graphics Editor is a
separate program with a separate object model.

### D33 — Color systems and Color Editor

**Classification: TV/color substrate and TV/Flavors editor, not CLIM.** CADR color
code drives indexed-color hardware and direct experiments. Genera's production Color
Editor creates a TV window and uses Flavors/window mixins
(`sys.sct/color/color-editor/color-editor.lisp.~72~`); it is not even a Dynamic
Windows program framework in the inspected source. The D59 CLIM Color Chooser uses
CLIM inks and gadgets but is a demonstration, not this editor.

### D34 — Images, drawing primitives, and preserved visual assets

**Classification: non-UI graphics/image substrate; an indirect CLIM provider
relationship is plausible but no direct dependency is established.** CADR BITBLT,
PICT/SCAN, fonts, sprites, and drawing files feed TV applications. Genera Image
Substrate adds Dynamic Windows acceptance and viewport operations. The compiled
Genera CLIM port necessarily maps CLIM media, mirrors, and pixmaps onto host graphics,
but its declarations do not name a required `Images` system. The audit therefore
records low-level host provision without inventing a direct D34-to-CLIM edge.

### D35 — Hardcopy, Press, printing, and plot output

**Classification: native hardcopy is stream/TV or Dynamic Windows; PostScript-CLIM
is a separate CLIM provider.** CADR PRESS, XGP, plotting, and spool paths predate
CLIM. Genera's print forms and queue objects use Dynamic Windows
(`sys.sct/hardcopy/windows.lisp.~1530~`). Separately,
`sys.sct/clim/rel-2/postscript/sysdcl.lisp.~11~` declares a PostScript CLIM port and
medium with printer metrics. That backend serves CLIM output; its existence does
not make the ordinary Hardcopy/Print applications CLIM or prove that it delegates
to Genera's separate native PostScript product.

### D36 — Concordia structured authoring

**Classification: Dynamic Windows, not CLIM; no public CADR implementation.** The
public LM-3 records for Basic Sage and Writer Tools do not provide an implementation
from which to infer a UI. Genera Concordia, Page Previewer, and Book Design Browser
each define Dynamic Windows program frameworks and use native presentations and
graphics (`sys.sct/concordia/activity.lisp.~108~` and related sources). No readable
application body defines a CLIM frame or requires CLIM.

### D37 — Symbolics C, FORTRAN, and Pascal environments

**Classification: ZWEI modes on CADR; Zmacs/Command Processor/Dynamic Windows on
Genera, not CLIM.** Public evidence establishes editing modes such as PL/I, not the
later compiler products. Genera's language UIs are substantially compiled-only, but
their symbol/declaration evidence identifies ZWEI, native presentations, and Dynamic
Windows programs rather than CLIM frames. A C input path can use the generic
CLIM-compatible reader seam from D22; that is stream compatibility, not a CLIM
listener implementation.

### D38 — Compiler Tools, grammar, lexer, and syntax systems

**Classification: parser/compiler infrastructure with ZWEI/Dynamic Windows clients,
not CLIM.** CADR provides compiler and editor-mode substrate. Genera Compiler Tools
uses Dynamic Windows acceptance/completion, while the Syntax Editor is a Zmacs
extension around parser and lexer infrastructure
(`sys.sct/cts/cts-runtime-defs.lisp.~16~`). Compiled symbol inventories agree on
ZWEI/native presentations, and neither declarations nor readable Lisp define a CLIM
application frame or dependency.

### D39 — Conversion Tools

**Classification: genuine CLIM consumer and source converter; its own UI remains
ZWEI/Dynamic Windows.** The system declaration isolates a `clim` module containing
DW-to-CLIM and CLIM-1-to-CLIM-2 conversions and explicitly requires CLIM
(`sys.sct/conversion-tools/sysdcl.lisp.~28~`). The conversion rules map formatted
output, drawing, presentations, commands, program frameworks/application frames,
panes, and redisplay. The editor that hosts those transformations uses ZWEI buffers,
Dynamic Windows redisplay, presentations, and Accepting Values. It produces and
understands CLIM source without itself being a CLIM frame.

### D40 — Joshua rule and inference environment

**Classification: non-UI inference substrate with Dynamic Windows clients, not
CLIM.** Public AMORD/LMTMS records are incomplete historical leads, not an earlier
Joshua or CLIM implementation. Genera Joshua exposes predications, objects,
commands, translators, and metering through native Dynamic Windows presentations
(`sys.sct/joshua/code/ptypes-and-commands.lisp.~210~`). Its examples likewise use
Dynamic Windows frameworks. CLIM strings in generated patch headers record the build
world and do not create a system dependency.

## D41–D60: products, integration, machine layers, and demonstrations

### D41 — Statice persistent object system

**Classification: non-UI database runtime with a Dynamic Windows browser, not
CLIM.** Statice separates its persistent-object kernel/runtime from development
tools. The visible browser directly uses `DW:DEFINE-PROGRAM-FRAMEWORK`, native
presentation types, and Dynamic Windows incremental redisplay
(`sys.sct/statice/development/browser.lisp.~41~`). The Books example uses the same
substrate. No package import, application frame, or required-system edge connects
Statice to CLIM; its “presentation” utilities are `SCL`/Dynamic Windows facilities.

### D42 — Macsyma 421

**Classification: TV/ZWEI-era, compiled-only UI; not established as CLIM.** The
public trees expose documentation/editor integration rather than a complete product.
Genera's declaration identifies Lisp-machine menu, window, plotting, Help, and ZWEI
support modules (`sys.sct/contributed/macsyma-421/defs/sysdcl.lisp.~382~`) without a
CLIM requirement. Their bodies are compiled-only, so the precise window superclasses
remain unknown; the declaration and dependency graph support “older Lisp-machine UI,
not CLIM,” not a stronger Dynamic Windows claim.

### D43 — NS electronic-design family

**Classification: Dynamic Windows/New Flavors, not CLIM; implementation bodies are
compiled-only.** Basic, Schematic, Gate Array, PCB, and VLSI NS declarations form a
Genera-native family without CLIM dependencies. An inert symbol inventory across the
compiled NS modules found Dynamic Windows framework, presentation-type, and mouse
handler vocabulary but no CLIM package identity. That establishes the family-level
toolkit while leaving exact pane composition and private methods for future runtime
or source evidence.

### D44 — CLOE development and runtime environment

**Classification: documented CLIM 1.0 host/provider and development integration;
not every CLOE UI is CLIM.** Contemporary CLOE material describes a CLIM 1.0 port on
Windows 3.0, hosted Listener/demos, and a Genera-side development workflow that can
expose a loaded CLIM system to CLOE. It also describes a separate non-CLIM Window
Front End. The inspected media lacks the runtime executable and port source, so this
is a documentation-grounded architecture claim rather than a body-level or live
audit. It must not be mislabeled CLIM 2.

### D45 — Network transports and protocol architecture

**Classification: non-UI transport substrate with TV/Listener or Dynamic Windows
administration, not CLIM.** CADR Chaosnet, EFTP, QFILE, Ethernet, and address
resolution predate CLIM. Genera network protocols remain service-path and transport
code; namespace input and the editor use native Dynamic Windows presentations and a
DW program framework (`sys.sct/network/namespace-editor-activity.lisp.~4033~`).
Typed network arguments expose objects to Genera's presentation-oriented UI, but no
transport system defines a CLIM frame or port.

### D46 — Network services and site utilities

**Classification: non-UI servers with TV/Listener or Dynamic Windows operator
clients, not CLIM.** CADR services are server loops and simple utilities. Genera
FTP, TFTP, DNS, and diagnostic services remain protocol substrate; where a graphical
operator frame exists, such as Domain Server Log, it is a Dynamic Windows program
(`sys.sct/ip-domain-server/domain-server.lisp.~4044~`). Presentation-sensitive Show
and Inspect commands are native Command Processor/DW integration, not CLIM.

### D47 — RPC, embedding, UX, and Macintosh integration

**Classification: non-UI RPC with a remote Dynamic Windows implementation, not a
CLIM port.** Genera RPC and embedding declarations do not require CLIM. The Macintosh
remote-program layer serializes native program frameworks, presentations, input
contexts, redisplay, commands, output-record bounds, and drawing over RPC/QuickDraw
(`sys.sct/embedding/rpc/ui/macintosh/remote-program.lisp.~38~` and related files).
That is historically significant distributed presentation UI, but its source
expands to Dynamic Windows framework forms. Keyboard Control is also a Dynamic
Windows frame.

### D48 — CLX, remote X screens, and X server facilities

**Classification: CLX is substrate, CLX-CLIM is a real CLIM port, and X Remote
Screen is a separate TV/Dynamic Windows facility.** CLX supplies X protocol,
drawable, event, and graphics operations. `sys.sct/clim/rel-2/clx/sysdcl.lisp.~11~`
requires CLIM and declares port, mirror, medium, pixmap, frame, and prefill modules,
making it affirmative provider evidence; the bodies are compiled-only. By contrast,
X Remote Screen uses TV screen/window behavior plus a Dynamic Windows control
program. The architectural stack is CLX to CLX-CLIM to a CLIM application, not “all
X support is CLIM.”

### D49 — CL-HTTP and contributed web systems

**Classification: non-UI server with an independent W3P system and one narrow CLIM
consumer.** CL-HTTP does not require CLIM, and W3P defines its own HTML-oriented
presentation classes, views, acceptance, and forms. One W4 method conditionally
accepts a `CLIM:SHEET` as a report stream
(`sys.sct/contributed/cl-http/w4/walker.lisp.~44~`), which is genuine integration
without making W4 or the server CLIM-native. An export example names an
`HTTP:CLIM` tree absent from the inspected media; its implementation and shipped
status remain an explicit open question.

### D50 — CADR microcode, microassembler, and console debugger

**Classification: non-UI implementation substrate and stream/console debugger, not
CLIM.** The microassembler, compiler, and DDT-like console debugger operate below
ordinary application frameworks in the public CADR/LM-3 trees. No CLIM package or
macro occurs, and a command-oriented debugger is not thereby a CLIM command table.
The closest Genera Ivory compiler/linker/FEP facilities belong to D52 and likewise
do not retroactively change the CADR tools' implementation identity.

### D51 — CADR diagnostics, checkout, and hardware tools

**Classification: console and TV hardware tools, not CLIM.** The checkout,
diagnostic monitor, PROM/microcontroller programming, continuity, and Chaos-board
test programs are low-level command loops and hardware exercises; some call TV for
mouse input, terminal input, or beeps. None defines CLIM sheets, frames, panes, or
presentations. No one-to-one Genera diagnostic family was established, so the audit
does not generalize this result to every later platform tool.

### D52 — Ivory, FEP, and Open Genera/VLM implementation layers

**Classification: implementation substrate with low-level TV and occasional Dynamic
Windows diagnostics, not CLIM.** Ivory instruction definitions, compiler back end,
linker, wired console/screen, disk saving, page trace, FEP, and VLM support sit below
application UI. Some disassembly and trace output carries native Dynamic Windows
presentations, but the wired console deliberately works beneath normal high-level
window systems. No CLIM use was found in the relevant source; making boot/FEP
facilities depend on a CLIM application frame would invert their dependency order.

### D53 — MUNCH and Munching Squares

**Classification: TV graphics demo, pre-CLIM.** The maintained implementation builds
a TV constraint frame and panes, then handles input and drawing directly
(`l/sys/demo/munch.lisp`); Genera retains that TV identity in
`sys.sct/demo/munch.lisp.~4010~`. It defines neither presentations nor CLIM frames.
Running the inherited program in a later Genera world does not turn it into a CLIM
application.

### D54 — LEXIPHAGE

**Classification: direct TV/raster demo, pre-CLIM.** LM-3 implements Lexiphage in
`l/sys/demo/ohacks.lisp` with a TV window and direct triangle/raster drawing. The
Genera continuation in `sys.sct/demo/ohacks.lisp.~4009~` preserves the same
approach. The visual algorithm and host-window generation are separate facts; no
CLIM port, frame, presentation, or command protocol is involved.

### D55 — Spacewar

**Classification: TV/blinker game with raw input, pre-CLIM.** The maintained game
uses TV character blinkers for moving objects, a game process, a TV
listener/window, System-key selection, and direct keyboard-state polling
(`l/sys/io1/swar.lisp`). No CLIM event, presentation, pane, or command loop occurs.
No exact Genera continuation was found in the bounded catalog, so no later toolkit
migration is inferred.

### D56 — Doctor conversational program

**Classification: line-oriented stream program, not CLIM.** Doctor reads and writes
through the current Listener stream and applies its rule corpus
(`l/sys/demo/doctor.lisp`); it does not create a graphical window framework. Being
hosted inside a Lisp Listener does not make it part of that Listener's implementation
or a CLIM Listener. No exact Genera counterpart was found.

### D57 — CADR HACKS, display, sound, and novelty suite

**Classification: TV/stream demo registry, pre-CLIM.** The public HACKS registry
opens a TV menu and manages reusable TV windows (`l/sys/demo/hakdef.lisp`), while
members draw through window primitives or use terminal streams. Genera descendants
retain that TV behavior. CLIM names found in a HACKS patch system-directory header
describe the world that built the patch, not a HACKS dependency.

### D58 — Genera HACKS demonstration suite

**Classification: TV demonstration suite, not CLIM.** The Genera HACKS registry and
readable member sources use TV windows, blinkers, raster operations, and stream input
(`sys.sct/demo/hakdef.lisp.~4015~`). D58 and D59 may appear beside one another under
Demonstration commands, but menu placement is not a toolkit identity. HACKS remains
TV; the separately declared CLIM-Demo system is CLIM.

### D59 — CLIM demonstrations and tutorial

**Classification: CLIM-native application family.** Demo and tutorial declarations
require CLIM, and 26 actual `DEFINE-APPLICATION-FRAME` forms organize the Address
Book, Bitmap Editor, Browser, CAD Demo, Color Chooser, activity demo, Flight Planner,
Graphics Demo/Editor, Icosahedron, Lisp Listener, Peek Frame, Plot Demo, Puzzle,
Scigraph, Thinkadot, five tutorial puzzles, least-squares examples, and Tic-Tac-Toe.
They exercise presentations, translators, commands, stream panes, input editing,
formatted output, drawing/media, custom and updating output records, incremental
redisplay, gadgets, dialogs, and Genera activity/port integration. The tests extend
coverage to provider conformance. Runtime screenshots remain blocked until the
optional CLIM systems can be loaded into an isolated museum world.

### D60 — Product and programming examples

**Classification: TV/ZWEI examples on CADR and Dynamic Windows examples on Genera,
apart from the separately cataloged D59 CLIM suite.** All fourteen concrete Genera
frameworks in the bounded Core, Joshua, and Statice example sets use
`DW:DEFINE-PROGRAM-FRAMEWORK` or the same native environment. They exercise panes,
presentations, Accepting Values, output records, and incremental redisplay, but the
package/macro identity is Dynamic Windows. Color examples follow TV/New
Flavors/DW; CL-HTTP examples use W3P and retain only the unresolved external
`HTTP:CLIM` lead described in D49.

## Cross-catalog findings

The audit supports five conclusions that are easy to lose in a name-only inventory:

1. **CADR and the maintained LM-3 application implementations are pre-CLIM.** The
   positive source definitions resolve to TV, EINE/ZWEI, streams, and direct graphics.
   Exact CLIM searches over the pinned public implementation trees found no client or
   port; later Dynamic Windows snippets preserved inside bug-report prose are not
   runnable LM-3 implementations.
2. **Dynamic Windows remained the normal Genera application framework.** The
   Listener, Document Examiner, debuggers, administration tools, production graphics
   editors, Concordia, Statice, Joshua, network dashboards, and ordinary examples
   examined here do not become CLIM applications merely because they use frames,
   panes, presentations, commands, sensitive output, Accepting Values, or incremental
   redisplay.
3. **Genera CLIM is a distinct optional family integrated with its host.** The
   portable core and Silica sit above native Genera, CLX, or PostScript ports. Host
   seams cover streams/input history, CLOS cache invalidation, activities, frames,
   media, pixmaps, and printing. Those providers do not make the host applications
   themselves CLIM-native.
4. **The clearest application consumers are explicit.** Conversion Tools requires
   CLIM to translate DW/CLIM-1 source; Document Examiner indexes CLIM definitions;
   Zmacs recognizes a CLIM defining form; W4 conditionally accepts a CLIM sheet; and
   CLOE is documented as hosting a CLIM 1.0 port. These are different relationships
   and should not be collapsed into one “uses CLIM” flag.
5. **Name collisions require an implementation check.** The ordinary Genera Lisp
   Listener, Peek, Bitmap Editor, Graphic Editor, and Color Editor/Chooser have CLIM
   demo analogues. Only the D59 versions are defined as CLIM application frames.

The runtime result is consistent with that architecture: the preserved base world
had no CLIM package, feature, or registered system loaded, yet the native Genera
applications operated normally. That observation proves absence from this saved
world, not absence from the release media. It also means existing screenshots of the
native applications cannot serve as screenshots of CLIM.

## Portable source provenance

The following licensed artifacts are identified so another authorized holder can
repeat the boundary audit. Paths are distribution-relative; hashes describe the
locally inspected files, and no file contents are reproduced.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `sys.sct/site/clim.system.~12~` | 573 | `fd3f124a6888dd68cc85057197d32f53045951e14358235f9bd9fbd723de4183` |
| `sys.sct/site/clim-doc.system.~9~` | 2,339 | `c9aea395d0dc489db6aa9b5a1ee1b3f2f8d9ecfeb344f6e10c35c5c73d03c526` |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` |
| `sys.sct/clim/rel-2/sys/sysdcl.lisp.~216~` | 21,137 | `6c3053a983262b527895f17abb72a6978fe13072cf445359d4a615fa2f9d2afa` |
| `sys.sct/clim/rel-2/genera/sysdcl.lisp.~10~` | 3,833 | `df10180278f2d9fe2da608460a1c9c87d5d4b86a1639900e2ff86a7a17dbf780` |
| `sys.sct/clim/rel-2/clx/sysdcl.lisp.~11~` | 4,430 | `3fa2a9c6be50d609f7fe5702a50644529809d5e5a7f03c206c0ceedd216161ac` |
| `sys.sct/clim/rel-2/postscript/sysdcl.lisp.~11~` | 3,826 | `946b986c235687541d014d5d0e6d167024287e77273cbd5c26ed6e0c89f8bafc` |
| `sys.sct/conversion-tools/sysdcl.lisp.~28~` | 3,811 | `6d4600bf67e7ede3764916645c1d7afe8811eed949bf280b9872fa0b58460b6d` |
| `sys.sct/clcp/iofns.lisp.~273~` | 100,273 | `21b171f5c23054894b7d11a3001226dabc6109790a1badb19a1f8ebbea84212d` |
| `sys.sct/io/history-inner.lisp.~23~` | 22,956 | `9bcae5154c64553638a4f3a660c2d8ad4b9eec46821837a80483aa36aa9e44f6` |
| `sys.sct/clos/basic-class.lisp.~158~` | 38,704 | `ba2b555734a867d97c9a3d97880fe63b843d349f9e646ebdf629f3fa02de6ab0` |

## Preservation implications

- Record the toolkit or non-UI substrate beside each future application claim; do
  not let “presentation-oriented” silently become “CLIM.”
- Preserve system declarations and compiled-module inventories with the licensed
  media. They establish port and dependency boundaries even when implementation
  bodies are unavailable, but cannot support invented private algorithms.
- Keep D28 Dynamic Windows, D29 CLIM, D58 HACKS, and D59 CLIM-Demo as separate
  catalog entities. Their coexistence is historically more informative than a false
  unified-GUI narrative.
- When optional CLIM loading becomes possible, capture a small representative set of
  actual D59 frames through the isolated Genera harness. Until then, retain the
  runtime `TODO`; a Dynamic Windows look-alike is not substitute evidence.
- Locate and rights-check the absent CLOE runtime/port source and the external or
  omitted `HTTP:CLIM` tree before promoting either from documented/open-question
  status to an implementation claim.

## Sources

- [CLIM 2 on Symbolics Genera](clim-2-on-genera.md), for the full facility and
  module audit, public specification cross-check, and base-world load-state result.
- [CLIM demonstrations and tutorial programs](clim-demonstrations-and-tutorial.md),
  for every CLIM application frame, command, gesture, tutorial stage, test, and
  benchmark in the readable demo sources.
- [Dynamic Windows and presentation-based interaction](dynamic-windows-and-presentation-based-interaction.md),
  for the distinct native Genera framework and its visible applications.
- [Conversion Tools and source migration](conversion-tools-and-source-migration.md),
  for the Dynamic Windows-to-CLIM and CLIM 1-to-2 conversion surfaces.
- [CLOE development and runtime environment](cloe-development-and-runtime-environment.md),
  [CLX, remote X screens, and X server facilities](clx-remote-x-screens-and-x-server-facilities.md),
  and [CL-HTTP and contributed web systems](cl-http-and-contributed-web-systems.md),
  for the detailed D44, D48, and D49 evidence boundaries.
- [CLIM II Specification](https://dept-info.labri.fr/~strandh/Teaching/PFS/Common/CLIM-spec/cover.html),
  consulted for the semantic distinction among ports, sheets, streams, media,
  output records, presentations, commands, frames, panes, and gadgets.

Last verified: 2026-07-18.
