---
type: Reimplementation Specification
title: Screen Editor and Frame-Up layout design reimplementation specification
description: A release-bounded reconstruction contract for the CADR and Genera live Screen Editors and Genera Frame-Up, including geometry, transactions, complete effective staged input-binding trees, generated frameworks, visible states, failures, and conformance tests.
tags: [lisp-machine, mit-cadr, lm-3, genera, screen-editor, frame-up, layout-designer, dynamic-windows, reimplementation, specification]
timestamp: 2026-07-19T07:37:50-04:00
---

# Screen Editor and Frame-Up layout design reimplementation specification

## Status and reconstruction claim

This specification defines two different reconstruction targets rather than one
generic layout editor:

- the live **Screen Editor** in public MIT CADR System 46 source, maintained LM-3
  source and the separately preserved System 303-0 band, and Genera 8.5 System
  452.22 source media and base world; and
- the **Frame-Up** `layout-designer` in Genera 8.5, which edits a private pane-tree
  model and generates a `DEFINE-PROGRAM-FRAMEWORK` form.

A conforming implementation can reproduce the selected Screen Editor profile's
snapshot and one-level Undo model, live-window ordering and geometry transactions,
operation inventory, release-specific staged pointer tree, edge association,
expansion behavior, attribute protocol, error and partial-effect rules, and bounded
visible menu. A conforming Frame-Up implementation can reproduce its pane-tree
model, ten commands, complete application-owned presentation routes, named Command
Processor routes, pane-type registry, simulated layout display, code generation,
Preview and Done transactions, and Zmacs integration.

This document does not claim:

- that Screen Editor and Frame-Up share an abstraction, object model, transaction,
  or compatibility surface;
- that System 46, maintained System 303 source, the System 303-0 band, Genera source,
  and the Genera base world form one build chain or interchangeable release;
- exact historical package, flavor, class, function, macro, callable signature,
  condition, restart, module-load, ABI, QFASL, band, world, or byte compatibility;
- pixel identity outside the bounded visible requirements attached to the three
  reviewed screenshots;
- that Frame-Up is a general parser or decompiler for hand-edited framework forms,
  a constraint solver, or a pixel-exact WYSIWYG designer; or
- runtime confirmation for the named oracle gaps, especially destructive Screen
  Editor operations, every staged pointer branch, Frame-Up Preview, menu-only
  presentation handlers, and failure after partial mutation.

An implementation MAY offer all four profiles. It MUST NOT average their menu
orders, button meanings, abort sentinels, target-finder policies, reshape gestures,
or Undo effects into a fictional common release. Screen Editor MUST mutate the live
direct-inferior hierarchy; Frame-Up MUST edit a separate model until Preview or
generated code is evaluated.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. A requirement applies only to
the profiles named beside it. `INF` marks an implementation-independent clean-room
rule or an explicitly safer optional profile, not a historical representation.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | Public MIT System 46 source at Git revision `8e978d7d1704096a63edd4386a3b8326a2e584af` | Source-visible Screen Editor state, algorithms, order, controls, and failure prefixes | A runnable System 46 band or later LM-3 behavior |
| `C303-SRC` | Maintained LM-3 source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | Source-visible System 303 Screen Editor contract | That the preserved band was built byte-for-byte from that check-in |
| `C303-RUN` | Isolated Experimental System 303.0, ZWEI 129.0, microcode 323 session | The exercised Edit Screen entry, complete visible menu, pointer documentation, exit, and clean shutdown | Untested geometry, attributes, destruction, and abort branches |
| `G85-S452.22` | Licensed Genera 8.5 System 452.22 source inspected locally | Source-visible Screen Editor and Frame-Up models, commands, protocols, and order | Redistribution permission or proof that every body is loaded in the base world |
| `G85-BASE-WORLD` | Exact unconfigured `Genera-8-5.vlod` base world | World identity and resident behavior queried in the preserved environment | Configured-site behavior or source-to-world build identity |
| `G85-RUN` | Isolated Genera 8.5 VLM sessions | Exercised Screen Editor menu and exit; Frame-Up selection, typed split, display, Done, and return | Every translator hit-test, Preview, destructive operation, or orderly host shutdown |
| `MIT-MAN` | Contemporary MIT operator-manual source | Intended System 46 Screen Editor operation | Maintained System 303 implementation detail |
| `G8-MAN` | Public Genera 8 Workbook, User's Guide, and programming manual | Intended Genera operation and Frame-Up workflow | Exact 8.5 behavior where source or runtime differs |
| `G85-HELP` | Licensed installed Genera Help records inspected locally | Intended operation in the exact record versions | Permission to reproduce the prose or proof of implementation behavior |
| `SUBSTRATE` | Normative D02, TV, Dynamic Windows, and editor specifications in this repository | Incorporated selection, menu, input-editor, presentation, and Zmacs behavior named below | Application-owned behavior not expressly incorporated |
| `INF` | Implementation-independent reconstruction rule | A portable way to satisfy the cited observable contract | Historical data layout or expression |
| `TODO-RUNTIME` | Unclosed preserved-system oracle obligation | Nothing until the stated probe is run | Permission to fill a gap by inference |

Source controls a named source profile; runtime controls only the exact exercised
artifact path. A manual establishes intended use but MUST NOT override a contrary
source-visible release rule. Licensed source is identified by portable metadata and
paraphrased in original words; no proprietary body is reproduced here.

## Compatibility profiles and levels

### Release profiles

| Profile | Exact target | Required substrate | Principal identity |
| --- | --- | --- | --- |
| `SE-C46` | MIT CADR System 46 public source | [System 46 TV](mit-cadr/tv-window-system-reimplementation-specification.md) and [D02 entry routing](program-selection-activities-and-window-management-reimplementation-specification.md#edit-screen-dispatch) | Thirteen operations, old rectangle interaction, no abort sentinel, entry-time snapshot |
| `SE-C303` | Maintained LM-3 source plus separately identified `System 303-0` runtime | [System 303 TV](mit-cadr/tv-window-system-reimplementation-specification.md) and D02 | Fifteen operations, command-time resnapshot, explicit initial abort sentinel, fixed attribute form |
| `SE-G85` | Genera 8.5 System 452.22 source plus separately identified base world | Genera TV plus [D02 entry routing](program-selection-activities-and-window-management-reimplementation-specification.md#edit-screen-dispatch) | Fifteen-operation descendant, console-aware target selection, one-corner reshaper, delegated attributes |
| `FU-G85` | Genera 8.5 `layout-designer` | [Dynamic Windows](genera/dynamic-windows-reimplementation-specification.md), Command Processor, Input Editor, and Zmacs | Private pane-tree designer, ten commands, code generation and Preview |

`SE-C303` source and runtime are triangulated evidence, not a proven build chain.
The same distinction applies to `G85-S452.22` and the base world. A requirement
names the witness that supports it rather than silently treating those artifacts as
identical.

Screen Editor is a TV/native live-window tool in every profile. Frame-Up is a native
Dynamic Windows program framework. Neither is CLIM, and CLIM's use of terms such as
frame, pane, presentation, or command does not transfer CLIM semantics into these
profiles.

### Conformance levels

| Level | Required behavior | Reserved behavior |
| --- | --- | --- |
| `L0` | Selected profile's semantic objects, exact operation inventory, state invariants, and visible structural regions | Interactive dispatch and mutation |
| `L1` | `L0` plus complete selected-source effective key, pointer, menu, presentation, prefix, Help, argument, context-shadowing, staged, and unbound trees; transaction, abort, Undo, and error behavior | Full geometry/code-generation closure |
| `L2` | `L1` plus Screen Editor geometry/ordering algorithms or Frame-Up pane editing, simulated rendering, generation, Preview/Done, Zmacs integration, and bounded visual requirements | Exact historical source interface |
| `L3` | Exact selected historical package/API signatures, flavor/class method closure, conditions/restarts, and module/load contract | ABI, compiled object, band, or world compatibility |

This specification normatively defines `SE-C46/L2`, `SE-C303/L2`, `SE-G85/L2`,
and `FU-G85/L2` at the semantic grain stated here. `SE-C46` is source-only;
`SE-C303`, `SE-G85`, and `FU-G85` include only the bounded runtime observations
listed below. `L3` is reserved.

Here, `L1` closes every application-owned binding and incorporates the complete
selected-source Dynamic Windows, Command Processor, Input Editor, and Zmacs trees
named below. Source-initialized maps and live installed maps remain distinct: a site
remap or patch is a separately dumped overlay, not an omitted base binding and not an
application-owned command. Runtime obligations test the specified source trees and
record overlays; they do not weaken this inventory by hiding an unspecified chord.

| Member | Contract defined | Preserved runtime verified | Remaining oracle boundary |
| --- | --- | --- | --- |
| `SE-C46` | `L2` source contract | No | Compatible band, pixels, every pointer and failure branch |
| `SE-C303` | `L2` | Entry, full menu, live item documentation, exit | All mutating operations and staged-button matrix |
| `SE-G85` | `L2` | Entry, full menu, Undo documentation, exit | All mutating operations, attributes, reshape modifiers |
| `FU-G85` | `L2` | Select Q, typed horizontal split, resulting model, Done and return | Direct translator hit-tests, all other commands, Preview and failures |

## Evidence ledger

### Exact source artifacts

| Profile | Portable artifact | Bytes | SHA-256 | Principal use |
| --- | --- | ---: | --- | --- |
| `SE-C46` | `src/lmwin/scred.62` | 49,289 | `63bdc78c6984cbb6e68b207fea7f2167955bae17350680d6fe2381fec1e8ecb8` | Complete public Screen Editor implementation |
| `SE-C46` | `src/lmwind/operat.27` | 85,337 | `a5ab658210dc09891b0886b58af705368e33a41f013073c8b9a637d99ab0f02d` | Contemporary intended operation |
| `SE-C303` | `sys/window/scred.lisp` | 69,028 | `8f76df709ca1b913925370463248d00c13d059c97a2bdb6d5154db3797749cf9` | Complete maintained Screen Editor implementation |
| `SE-C303` | `sys/window/choice.lisp` | 84,440 | `866900e06a7f55855d84df71dbbb77c07040a4db586cba39e665c93f945f6dbd` | Variable-value row gestures and typed-entry handoff |
| `SE-C303` | `sys/window/rh.lisp` | 68,866 | `6e71970e7b481441554ed64af2ac9ca04439a9af6d532a61a24d02cce8a4e0f8` | Selected alternate rubout-handler binding map and editing state machine |
| `SE-C303` | `sys/window/stream.lisp` | 26,023 | `3159e4aa22a77a71a2d603cb5fe9ec78c1674af0615dd9ad83d238195613cef8` | TV stream/rubout-handler dispatch substrate |
| `SE-C303` | `sys/window/mouse.lisp` | 57,256 | `facf7f3dd979a758bd70b0644120ccceb0f243188acd180dcbf0a70a836ec6b2` | Raw-mask, modifier, click-count, and System Menu pointer encoding |
| `SE-C303` | `sys/window/sysmen.lisp` | 43,408 | `b53b7c3d5a59040f3180d5be0d2072b2a334bb386fa5e19dd6abbd945148b40` | Keyboard-only pop-up diagnostic dismissal and System Menu interaction |
| `SE-C303` | `sys/window/tvdefs.lisp` | 44,999 | `ae8a8a342d10e4bdc89dc119f9afca9606a7797757601fdd593f8477bfc738ed` | `WINDOW-CALL` selection and conditional restoration around diagnostic input |
| `SE-C303` | `sys/window/baswin.lisp` | 82,708 | `3b86ca413528046887da8371433d656ecd9d5f9130d6eadd764fc54f137b42f1` | Pop-up interactive-stream composition used by diagnostic `:TYI` |
| `SE-C303` | `sys/window/sheet.lisp` | 110,976 | `3547b359a4947d4eb7f256fefa5034c88e5afcb329bd435d7353cdf034d58902` | Depth-first postorder exposed-sheet traversal used by smart-corner snapping |
| `SE-C303` | `sys/wind/operat.text` | 105,069 | `3129801c6193035feb527c24ec65942a9b5b6b57cbaf9dcddc4372214ad47a97` | Maintained operator-manual witness; not assumed to match source where they disagree |
| `SE-G85` | `sys.sct/window/scred.lisp.~181~` | 94,187 | `d0756bb5102789ad748a08bb1087166c9e13f071ec233adbeca1730107d1e542` | Licensed Screen Editor implementation; metadata and paraphrase only |
| `SE-G85` | `sys.sct/window/sysmen.lisp.~250~` | 52,798 | `2f54fdb15335fc7f9f9f5c47a03f1ad2a5803d86787267949825f23853363f4c` | Raw-event pop-up diagnostic call; metadata and paraphrase only |
| `SE-G85` | `sys.sct/window/basstr.lisp.~645~` | 65,555 | `112245299c0d46cf81a67f2cc8de714c766711653be215467ef41bb2c6778021` | Global keyboard ingestion and interception before pop-up input; metadata and paraphrase only |
| `SE-G85` | `sys.sct/io/interactive-stream.lisp.~244~` | 65,634 | `e49e7c0b175529cb051574c81e8c1062b07783f2c9a611bd46cce0ea9d24bb4e` | Raw `:ANY-TYI` versus blip-filtering `:TYI`; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/layout-designer.lisp.~4039~` | 50,166 | `3fe3957872d881daf28bc9cb60079fbb32bfdca28dbefb098722cea5befb46a4` | Licensed Frame-Up model, commands, rendering, generation, and Zmacs integration |
| `FU-G85` | `sys.sct/dynamic-windows/program-framework-panes.lisp.~32~` | 18,999 | `4ebc7fac734b83b7f9c2be4e81fb47b6443157460c0fcdbbb864dd242eeb27ea` | Licensed pane-type registry; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/define-program-framework.lisp.~332~` | 132,692 | `e4fde854b9a36492bf4d23eec0a812bd36c7d42e7d32c649c7aaa5786cd30128` | Fixed command-menu dispatch and framework behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/cp/command-processor.lisp.~318~` | 131,639 | `248550a755130c40322b3a12c608cfa7a18213b504d18f36d5fcf3399dc4bca6` | Command acquisition and activation behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/cp/substrate-commands.lisp.~6~` | 14,731 | `558f085cc3953de3f831e4e9e195104303e9e6331861a9ed629b550870fb4f44` | Standard scrolling and argument accelerator behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/io/input-editor.lisp.~332~` | 110,515 | `856548d945403aa4f5fa3036bd2e8b936890b07b231673c9e2cab5f9e42707b3` | Complete selected Input Editor base map and dispatch; metadata and paraphrase only |
| `FU-G85` | `sys.sct/io/readers.lisp.~251~` | 89,420 | `234f313926a322f3d61e7d750c96bd3a1f4408b8eaf9eb8afffb294a28667491` | Standard intercepted characters and Preview character-reader behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/dynamic-input.lisp.~498~` | 55,058 | `a79805ece6844ccb568ecf97e2d818a0c6095e539e51fbf74423944a32b6dd8f` | Raw logical gestures, input contexts, and dead-blip fallthrough; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/basic-handlers.lisp.~30~` | 58,716 | `3a85f039dbeb76b65401c0f88f1b1712cf9961645aee6f82c5bfb04c14c4303d` | Generic menus, System/Window operations, marking, and raw-text handlers; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/handler-debug.lisp.~33~` | 13,058 | `ff2081af4ac6b0c4c41446b2f12de971e6f16b8197cd8005a204bfca5c04007a` | Presentation-debugging gesture/menu handlers; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/presentation-inspector.lisp.~4053~` | 45,825 | `9f20e13acd39201e73fee30d6890275aaf9d0b745f6b2089dfad0e05869f494d` | Loaded Presentation Inspector member that can populate the debugging menu; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/accept-values.lisp.~244~` | 82,063 | `1c430c59e77f488fe3b85475bd89c704e2250e343243f7399ab9c0c5896de0d5` | Complete Accepting Values base accelerator and pointer maps; metadata and paraphrase only |
| `FU-G85` | `sys.sct/io1/fquery.lisp.~104~` | 13,320 | `022823ae8dddbf64c598ab59bde00945c9b5e621191617b1374a84f020730e0f` | Readline Yes/No confirmation behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/window/mouse.lisp.~472~` | 119,392 | `9375d99e127c097e22852dc0ea7f6cd496101f01946a42eb0c6bf58051d4a3b6` | Button transition, simultaneous-mask, and double-click encoding; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/dynamic-window-mixins.lisp.~204~` | 139,058 | `d1c9db01f37982f10efdd5f7f21dff938a437c4b1f80633c04054158be87a482` | Selected-window-sensitive presentation click routing; metadata and paraphrase only |
| `FU-G85` | `sys.sct/io/format.lisp.~369~` | 91,024 | `ae5135cf2be3af4741093ea7f8e885259927d9aaa32555c7fa292553eb112249` | Historical modifier-name formatter used by all 96 primary gestures; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/define-handler.lisp.~12~` | 25,689 | `00d7c33ea97a342ff53877b8c33106f2b1730bb0fd86963d1a086e4bac883ab0` | Presentation-handler construction; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/mouse-handler-lookup.lisp.~33~` | 99,828 | `601385c017301e7158599b8dfe235650a1f5dee06a7944fc701ce8a4a491d716` | Gesture and menu-only handler lookup; metadata and paraphrase only |
| `FU-G85` | `sys.sct/dynamic-windows/type-methods.lisp.~6~` | 32,708 | `c759735e87f996be7ae9eb5efb2afb10c523ec425b134be927a2e53cb2879aed` | Command argument default/usability behavior; metadata and paraphrase only |
| `FU-G85` | `sys.sct/clcp/listfns.lisp.~161~` | 34,956 | `85e1377fc8225563c3d75c4653a5cff9f722011184a6f34f325cf2d1c1bb1c83` | Destructive list replacement used by Frame-Up; metadata and paraphrase only |
| `FU-G85` | `sys.sct/clcp/iofns.lisp.~273~` | 100,273 | `21b171f5c23054894b7d11a3001226dabc6109790a1badb19a1f8ebbea84212d` | Command-reading wrapper that establishes the outer Input Editor presentation context; metadata and paraphrase only |
| `G85-HELP` | installed Help record `SYS:DOC;INSTALLED-440;USER;WB1-CHAP16.SAB.13` | 16 records | source binary SHA-256 `7ed8f74a0982e51b509477b3473edd9e6930f5e431af64bf0e2bb35dde07e8f4` | Metadata-only evidence for the installed Select-key wording; decoded proprietary text remains ignored |

The installed Help record reports compilation in System 451.0 and Sage 439.0. The
ignored decoded text used only for local inspection is 21,280 bytes with SHA-256
`ecf64a74115e0cf3d305e2ade3276934b50b50280dc303d76aeaa9c206436b55`;
neither that text nor a machine-specific build path is linked or tracked.

### Normative source and observation map

| Contract area | `SE-C46` | `SE-C303` | `SE-G85` or `FU-G85` | Status |
| --- | --- | --- | --- | --- |
| Screen Editor menu, loop, snapshot, apply, exit | `scred.62`, Screen Editor definitions and operation list | `scred.lisp:548-710` | `window/scred:681-849` | Normative per source profile |
| Keyboard nonownership and fallthrough | `menu.29:216-224`; `mouse.149:221-226`; `basstr.163:184-269,324-471,690-750` | `menu.lisp:602-611`; `mouse.lisp:446-451`; `basstr.lisp:223-326,501-510,564-781,1523-1637` | D02 Select/Function trees and selected-owner routing | Normative effective application-boundary tree; registries remain mutable |
| C303 Attributes row and typed-editor input | Not applicable | `choice.lisp:130-135,467-517,935-937,1049-1095,1457-1567,1645-1745`; `rh.lisp:95-98,130-616,620-1659`; `mouse.lisp:176-205,824-858`; `stream.lisp:145-153,172-202,278-329`; `sysmen.lisp:667-682`; `tvdefs.lisp:749-777` | Not applicable | Normative native TV tree, asynchronous margin process, stream/RH dispatch, temporary-form selection, and diagnostic dismissal; Genera Input Editor does not apply |
| C303 Screen Editor diagnostic input | Not applicable | `scred.lisp:157-164,635-641,761-764`; `sysmen.lisp:667-682`; `stream.lisp:145-153`; `mouse.lisp:824-836`; `tvdefs.lisp:749-777`; `baswin.lisp:88-92,1623-1629`; complete global trees incorporated from D01/D02 | Not applicable | Normative keyboard/pointer tree and conditional old-selection restoration |
| G85 Screen Editor diagnostic input | Not applicable | Not applicable | `window/scred:262-264,777-779,902-908,2118-2131`; `window/sysmen:837-853`; `io/interactive-stream:629-667,692-742`; global/physical ingress incorporated from D02/D28 and `window/basstr` | Normative raw-delivered-event distinction; exact physical click delivery remains `TODO-RUNTIME` |
| Individual live-window operations | `scred.62`, command functions | `scred.lisp:713-1099` | `window/scred:851-1063` | Normative per source profile |
| Edge/corner selection and multi/single move | `scred.62`, following-arrow and movement region | `scred.lisp:113-137,1103-1631`; `sheet.lisp:110-114` | `window/scred:1065-1591` | Normative, including depth-first postorder smart-snap overwrite; runtime unexercised |
| Genera one-corner reshape | Not applicable | Older two-corner helper | `window/scred:2072-2189` | Normative for `SE-G85`; modifier paths unexercised |
| Frame-Up framework and initial state | Not applicable | Not applicable | `layout-designer:351-435` | Normative for `FU-G85` |
| Frame-Up presentation tree and pane commands | Not applicable | Not applicable | `layout-designer:453-777,919-1035` | Normative; one typed split exercised |
| Frame-Up rendering | Not applicable | Not applicable | `layout-designer:473-639` | Normative simulated renderer |
| Generation, Preview, Done | Not applicable | Not applicable | `layout-designer:777-918` | Normative; Preview runtime open |
| Zmacs integration | Not applicable | Not applicable | `layout-designer:1037-1163` | Normative named commands; runtime open |
| Pane-type registry and Tree Browser constraints | Not applicable | Not applicable | `program-framework-panes:83-230,217-360,431-457` | Normative dynamic registry, constructor constraints, branch protocol, and generated-pane Select behavior |
| Frame-Up effective input and framework dispatch | Not applicable | Not applicable | `define-program-framework:697-874,1042-1061,2323-2484`; `command-processor:1396-1569`; `substrate-commands:99-299`; `input-editor:902-1102,1233-2309`; `readers:62-71,720-881`; `dynamic-input:243-367,1160-1239`; `dynamic-window-mixins:708-743`; `basic-handlers:498-621,674-708,801-872,901-1169`; `handler-debug:294-304`; `presentation-inspector:1068-1077`; `define-handler:319-356,445-447`; `accept-values:378-396,749-969,1080-1252`; `fquery:201-313`; `window/mouse:631-700,1153-1163,1862-1867`; `io/format:1006-1036`; `clcp/iofns:2562-2584`; handler lookup/default artifacts above | Normative incorporated substrate routes, all 96 primary gestures, selected-window routing, physical ingress, and menu/dead-result semantics used by Frame-Up |
| Destructive pane-list replacement | Not applicable | Not applicable | `clcp/listfns` artifact above | Normative for the specified mutation prefix |
| Visible menu/model | No runtime witness | `screen-editor-menu.png` | `screen-editor-menu.png`; `frame-up-split-layout.png` | Bounded runtime and pixel evidence only |

### Selected-module coverage

| Module family | Closed at `L2` | Reserved for `L3` or oracle work |
| --- | --- | --- |
| Screen Editor core | State record, menu inventory, resnapshot, apply order, Undo, selection, exit | Exact packages, generic menu API, conditions, scheduler interleavings |
| Geometry | Move, reshape, edge classification/association, single/multiple move, expand one/all | Every historical callable signature and unexercised pixel/timing quirk |
| Attributes | C303 fixed query/setter sequence; G85 delegated query/setter sequence | Every possible target class's attribute protocol |
| Frame-Up model | Pane tree, registry, commands, configurations, rendering and generation | Generic Dynamic Windows internals already incorporated from D28 |
| Frame-Up input | Complete application and incorporated-substrate command, parser, Input Editor, Accepting Values, pointer, menu, Help, prefix, argument, unbound, global-entry, and Zmacs trees | Runtime confirmation and explicitly dumped site/patch overlays; no selected-source base binding is omitted |
| Zmacs bridge | Four named commands, their exact `M-X` and `C-M-X` routes, and model-based replacement behavior | Site-added editor remappings outside the selected world |

## Architecture and ownership boundaries

```text
D02 System Menu / selection routing
    -> Screen Editor
        -> live direct inferiors of one TV sheet
        -> TV geometry, exposure, ordering, mouse, menu, who-line protocols

Select Q or System Menu Frame-Up
    -> Dynamic Windows layout-designer program framework
        -> private layout-pane tree
        -> simulated box renderer
        -> DEFINE-PROGRAM-FRAMEWORK form
            -> Preview or later evaluation creates a real program frame

Zmacs named command
    -> Frame-Up model/session
        -> generated form returned through in-world result list/tick
            -> insertion or interval replacement in the editor buffer
```

- D02 owns **Edit Screen** routing, including the frozen alternate target. Screen
  Editor owns everything after it receives the top sheet.
- TV owns live sheet coordinates, inside edges, exposure, ordering, selection,
  pointer acquisition, menus, blinkers, and window messages. This specification
  narrows those primitives into application-level order and failure contracts.
- Screen Editor owns a one-level model over direct inferiors and applies the result
  back to those same live objects. It is not a retained scene graph or layout file.
- Dynamic Windows owns Frame-Up's Command Processor, Input Editor, presentations,
  Accepting Values, output records, panes, and framework runtime. Frame-Up owns its
  specific program, state, commands, translators, model, renderer, and generator.
- Zmacs owns generic extended-command entry, buffer intervals, insertion, and editor
  process behavior. Frame-Up owns the four installed named commands and the result
  handoff described here.
- No CLIM layer participates in these selected implementations.

## Semantic data and state model

### Screen Editor session

| Field | Meaning | Observable constraints | Evidence |
| --- | --- | --- | --- |
| `top-sheet` | Sheet whose direct inferiors are edited | Fixed for one session; chosen by D02 and release-specific screen finder | `C46-SRC`, `C303-SRC`, `G85-S452.22` |
| `current-model` | Ordered list of editable direct-inferior records | Order participates in exposure/bury reconstruction | same |
| `previous-model` | One-level Undo slot | Holds direct live object references and prior record values; not a deep copy of window objects | same |
| `old-selected-window` | Selection to restore on exit when possible | Restored only if it and every ancestor remain exposed | same |
| `mouse/pointer sheet` | Pointer context during editing | Restored on nonlocal exit; Genera derives it from the edited sheet's console | same |
| `menu` | Temporary operation chooser | Re-exposed for every command and deactivated during pointing | same |
| `abort sentinel` | Distinguishes no-command from an unchanged returned model | Absent in C46; present for many C303/G85 paths; not returned by every later-stage cancel | profile-specific source |

### Screen Editor window record

The clean-room semantic record is:

```text
WindowRecord = {
  window: live direct-inferior identity,
  exposure: true | false | bury-request,
  left: integer,
  top: integer,
  right: integer,
  bottom: integer
}
```

`bury-request` corresponds to the historical special marker used to request a bury
during application; it is not a third persistent TV exposure state. Coordinates are
in the edited superior's coordinate space and use left/top inclusive and
right/bottom exclusive containment. A snapshot includes a direct inferior only when
it is exposed or reports that it remains visible while deexposed.

### Frame-Up state

| Field | Initial value or meaning | Observable constraints | Evidence |
| --- | --- | --- | --- |
| `package` | NIL on direct start | A Zmacs-launched session supplies the calling package | `G85-S452.22` |
| `top-pane` | One new `PANE-1` leaf of type `:DISPLAY` after initialization | Root of the private model; not a live program pane | same |
| `configuration-name` | `MAIN` | Name emitted for the generated configuration | same |
| `program-name` | `USER::DUMMY-PROGRAM` | Used as the second element of the generated form and result replacement key | same |
| `state-variables` | NIL | Emitted if populated, but the intended interactive editor is disabled in this source | same |
| `command-definer` | enabled | Controls whether the generated framework requests a command definer | same |
| `inherited-command-tables` | `colon full command`, `standard arguments`, `input editor compatibility` | Stored as names/strings and converted during generation | same |
| `generated-keyboard-accelerators` | disabled | Applies to the generated program command table, not to Frame-Up's own table | same |
| `generated-select-key` | NIL | Optional Select key for the generated program | same |
| `results` | in-world list keyed by program symbol | One latest generated definition per program name | same |
| `results-tick` | monotonically incremented integer | Wakes waiting Zmacs integration after Done | same |

### Frame-Up `LayoutPane`

```text
LayoutPane = {
  box: optional simulated rectangle,
  name: symbol,
  type: registered leaf type | internal-row | internal-column,
  options: property list filtered to the type's allowed keys,
  stacking-direction: horizontal | vertical,
  superior: LayoutPane | null,
  inferiors: ordered list<LayoutPane>
}
```

Leaves represent emitted program panes. Internal row and column nodes exist only to
encode layout. They MUST NOT appear in the emitted pane catalog. A newly made pane
merges the selected type's defaults before removing options not allowed by that
type. The registry is mutable: adding an existing type name replaces its definition,
and enumeration order is the current registry order rather than a fixed seven-item
ABI.

### Invariants

1. A Screen Editor record names a live direct inferior of the fixed top sheet when
   captured. Historical code does not make that reference safe against concurrent
   destruction; a safety profile MAY reject stale references only if labeled `INF`.
2. In `SE-C303` and `SE-G85`, every changed rectangle MUST receive an affirmative
   result from the target window's geometry verifier before its edges change; the
   central apply pass has no independent positive-extent predicate. Strict `SE-C46`
   forwards a command's proposal directly to the target window. In either case an
   inverted proposal is accepted or rejected according to the target's underlying
   verification/edge-setting behavior.
3. The historical Screen Editor commit is not atomic. Geometry/exposure effects that
   precede an error remain unless the underlying window operation itself rolls them
   back.
4. Undo swaps/reapplies model snapshots; it is not a durable command journal. It has
   no resurrection or object-destruction operation. The exact outcome after Create
   or Kill is an oracle gap, and hidden ordering can be reconstructed only
   approximately.
5. A Frame-Up model is a rooted, ordered tree. Every nonroot pane has exactly one
   superior, and every superior lists that pane exactly once in the normal state.
6. Frame-Up leaf names SHOULD be unique. The historical numeric-suffix allocator
   scans all names and chooses one greater than the maximum parseable suffix, but a
   source comment identifies a duplicate-type standard-layout naming defect.
7. A split creates exactly one new display leaf and either appends it beside the
   selected leaf under a matching parent or inserts exactly one hidden parent.
8. A normal delete never leaves a hidden parent with one child; the survivor is
   promoted. The only root leaf cannot be deleted interactively.
9. Generated pane descriptions contain leaves only and contain only the options
   allowed by each leaf's registered type at generation time.
10. Frame-Up's simulated boxes are advisory display state. The generated framework
    and Preview, not the boxes, determine real Dynamic Windows layout behavior.

## Exact operation inventories

### Screen Editor menu order

The order below is normative and profile-specific. Each row is one menu item; there
are no hidden Screen Editor keyboard commands.

| Position | `SE-C46` | `SE-C303` | `SE-G85` |
| ---: | --- | --- | --- |
| 1 | Bury | Bury | Bury |
| 2 | Expose | Expose | Expose |
| 3 | Expose (menu) | Expose (menu) | Expose (menu) |
| 4 | Create | Create | Create |
| 5 | Kill | Create (expand) | Create (expand) |
| 6 | Exit | Kill | Kill |
| 7 | Undo | Move window | Exit |
| 8 | Move window | Reshape | Undo |
| 9 | Reshape | Move multiple | Move window |
| 10 | Move multiple | Move single | Reshape |
| 11 | Move single | Expand window | Move multiple |
| 12 | Expand window | Expand all | Move single |
| 13 | Expand all | Attributes | Expand window |
| 14 | — | Undo | Expand all |
| 15 | — | Exit | Attributes |

The Genera menu is labeled **Screen Edit Operation**. Exit and Undo use the
bold-italic Swiss style; Kill and Undo are underlined. System 303 gives Exit the
`:MENU-STANDOUT` style and supplies operation-specific pointer documentation on all
15 items; the preserved runtime visibly showed the Reshape documentation. System 46
has no per-item font or documentation override in this menu. Genera likewise showed
Undo-specific bottom-line documentation.

In every profile the menu resource points at a mutable item-list variable and reads
its current value when choosing. The tables above define the selected base-release
fixture, not an immutable registration ABI. A runtime binding dump MUST record any
mutation and invalidate a cached exhaustive-input tree. No separate supported
Screen Editor command-registration API was found.

### Frame-Up command menu

Frame-Up's command-menu pane has exactly two columns in this order:

| Column 1 | Column 2 |
| --- | --- |
| Set Program Options | Set Pane Options |
| Select Configuration | Set Pane Name |
| Reset Configuration | Split Pane |
| Preview | Swap Panes |
| Done | Delete Pane |

All ten are also typed named commands in the local Command Processor. The declaration
that makes them menu accelerators marks menu membership; it does not assign a
character key.

## Complete input and gesture binding trees

This section is normative at `L1`. It enumerates application-owned entry paths,
every staged pointer state, presentation translators, menu-only routes, and known
unbound outcomes. Generic TV menu mechanics come from the TV specification. Generic
Dynamic Windows Command Processor and Input Editor bindings are incorporated below
for Frame-Up, but are not relabeled as application-owned.

### Screen Editor entry tree

```text
D02 System Menu -> Edit Screen
├─ SE-C46 ordinary single item
│  └─ frozen target -> release-specific screen finder -> edit selected top sheet
├─ SE-C303 button triple
│  ├─ Left   -> edit current mouse sheet directly
│  ├─ Middle -> edit current mouse sheet directly
│  └─ Right  -> frozen target -> release-specific screen finder
└─ SE-G85 button triple
   ├─ Left   -> edit menu mouse/default superior directly
   ├─ Middle -> edit menu mouse/default superior directly
   └─ Right  -> frozen target -> release-specific screen finder
```

The D02 specification is incorporated normatively for frozen-target timing and
button dispatch. Screen Editor has no application-owned character key, prefix key,
numeric argument, repeat syntax, or Help prefix. Characters delivered while its
temporary menu or mouse tracking waits follow the exact tree below; none names a
Screen Editor operation.

### Screen Editor effective keyboard and fallthrough tree

The temporary operation menu and all pointing trackers seize or poll mouse state
only; they never read characters and the menu is not selected for keyboard input.
Screen Editor runs in the System Menu process while the keyboard dispatcher and the
currently selected I/O owner remain separate.

```text
hardware code while Screen Editor menu or tracker waits
├─ selected I/O buffer is in raw mode
│  └─ enqueue raw code directly in that private buffer when capacity permits;
│     bypass conversion and every Terminal/System/global/asynchronous branch below
└─ selected I/O buffer is not raw -> convert to Lisp Machine character
   ├─ SE-C46 encoded Terminal/Escape prefix -> global mutable Escape tree
│  ├─ unmodified 0..9/minus/repeated prefix -> base-eight accumulation and reset
│  │  rules; literal 8 and 9 are accepted by the historical accumulator
│  ├─ unmodified Help/? -> global Terminal Help, never Screen Editor Help
│  ├─ registered suffix -> registered global action
│  ├─ Terminal-A/Arrest -> may target Screen Editor because WHO-LINE-PROCESS is
│  │  dynamically bound to its process
│  └─ unknown suffix -> no operation
   ├─ SE-C303 Terminal prefix -> global mutable Terminal tree
│  ├─ digits/minus -> base-ten numeric state
│  ├─ Help/? -> global Terminal Help, never Screen Editor Help
│  ├─ registered suffix -> registered global action
│  ├─ eligible asynchronous/global unknown -> quote into selected I/O buffer
│  ├─ unresolved Rubout -> no operation
│  └─ every other unknown -> beep
   ├─ SE-C46/SE-C303 System prefix -> profile global mutable System tree
│  ├─ Help/? -> global System Help
│  ├─ registered suffix -> select/cycle/create action; current selection may change
│  ├─ unresolved Rubout -> no operation
│  └─ unresolved non-Rubout -> beep
   ├─ SE-G85 Select prefix -> D02 exact global Select tree
   ├─ SE-G85 Function prefix -> D02 exact global Function/numeric tree
   ├─ profile global asynchronous interception
│  ├─ C46 Call or Abort, unless selected buffer requests super-image mode
│  ├─ C303 Terminal/System/Control-Clear, then the selected buffer's asynchronous
│  │  table (base defaults include Control-Abort, Control-Meta-Abort,
│  │  Control-Break, and Control-Meta-Break); super-image makes that table NIL but
│  │  does not disable the preceding global keys
│  └─ G85 -> selected-world TV/Function asynchronous route incorporated from D02
   └─ every other character, including bare Help and any selected-app prefix,
      numeric/repeat key, or unbound chord
      └─ enqueue in TV's bounded global intermediate keyboard queue
         ├─ a later read transfers it to the I/O buffer selected at read time; that
         │  owner's keymap determines its meaning
         └─ no selected I/O-buffer read -> retain it in the intermediate queue
```

The CADR branches above directly resolve the release difference that the generic TV
routing prose formerly obscured. Queue mechanics come from
[TV keyboard routing](mit-cadr/tv-window-system-reimplementation-specification.md#keyboard-routing),
while the selected base-release global prefix trees, including Genera Select and
Function, come from
[D02 complete input binding trees](program-selection-activities-and-window-management-reimplementation-specification.md#complete-input-binding-trees).
The mutable registries MUST be dumped at test time; a site-added leaf keeps its
recorded owner and is not misattributed to Screen Editor. A global selector or Create
can change the selected I/O owner between hardware enqueue and consumption unless a
prefix path explicitly preserves typeahead for the old owner. Selection change alone
does not wake a mouse-only tracker; the operation chooser returns NIL only when an
external effect deexposes or dismisses its menu.

### Initial direct-inferior selection common core

```text
choose-window(model, point, button-mask)
├─ find first model record containing point
│  ├─ mask contains Left -> return that record
│  └─ mask has no Left -> abort selection
└─ no containing record
   └─ any button mask -> no target; command-specific abort/no-op result
```

Containment is left/top inclusive and right/bottom exclusive, and ordered model
position breaks overlap ties. In `SE-C303` and `SE-G85`, most initial aborts return
the explicit abort sentinel and preserve the prior Undo slot. In `SE-C46`, there is
no sentinel: the unchanged model is treated as a completed result and replaces the
prior Undo slot. Later-stage helpers can return unchanged geometry without the
sentinel even in later profiles; those exceptions are called out below. A represented
deexposed-visible record remains point-selectable because the finder does not filter
on its exposure field.

The CADR finder first waits for every button to be up, then samples X, Y, and the raw
mask at the first nonzero down transition. Masks 1, 3, 5, and 7 select because they
contain Left; masks 2, 4, and 6 cancel. Modifier state is irrelevant, and the helper
returns without waiting for release. The System 303 Create-expand point finder uses
the same down-time raw-Left-bit rule and the same lack of a final-release wait.

The ordinary operation menu itself accepts any of the seven nonzero three-button
masks on an item; blank interior does not select. Except for live Shift state in the
Genera Reshape tracker, keyboard modifiers do not alter a Screen Editor-owned menu or
geometric pointing leaf: every main-operation button-mask leaf below therefore also
covers its modifier combinations. This rule does not extend into the System 303
variable-value editor or Genera Accepting Values, whose encoded modifier,
multiple-click, and nested input trees are stated separately. Button identity matters
only after dispatch to an operation's nested pointing or choice stage. The main
Screen Editor trackers have no double-click branch.

### Ordinary operation tree

```text
operation menu
├─ chooser returns NIL because the menu was externally deexposed/dismissed
│  └─ invoke no command; do not snapshot, rotate history, or apply; re-expose menu
├─ Bury -> choose-window
│  ├─ any Left-containing mask -> move record to model end; mark bury-request; apply
│  └─ no Left -> profile abort rule
├─ Expose -> choose-window
│  ├─ any Left-containing mask -> move record to model front; mark exposed; apply
│  └─ no Left -> profile abort rule
├─ Expose (menu)
│  ├─ choose hidden direct inferior -> add/modify exposed record; apply
│  ├─ dismiss menu -> abort/no change according to helper
│  └─ empty list -> C46 no explicit diagnostic; C303/G85 beep, error popup, abort
├─ Create -> D02 System Menu creation helper
│  ├─ success -> retain resulting model and resnapshot later
│  └─ cancel/failure -> C46 returns unchanged model; C303/G85 abort sentinel
├─ Create (expand) [C303/G85 only]
│  └─ same tree with expand flag enabled
├─ Kill -> choose-window
│  ├─ C46 Left-containing mask -> kill immediately; remove record
│  ├─ C303 Left-containing mask -> one-item positive confirmation
│  │  ├─ positive item -> kill; remove record
│  │  └─ dismissal -> abort sentinel
│  ├─ G85 Left-containing mask -> Yes/No confirmation
│  │  ├─ Yes -> kill; remove record
│  │  └─ No/dismiss -> abort sentinel
│  └─ no Left -> profile abort rule
├─ Expand window -> choose-window
│  ├─ Left-containing mask -> compute horizontal then vertical expansion; apply
│  └─ no Left -> profile abort rule
├─ Expand all -> compute horizontal pass then vertical pass; apply
├─ Attributes [C303/G85 only] -> choose-window
│  ├─ Left-containing mask -> profile attribute editor
│  └─ no Left -> abort sentinel
├─ Undo -> return previous model for application
└─ Exit -> terminate session and run restoration
```

No operation label has an accelerator character. Menu pointer Help/documentation is
metadata on menu items and MUST NOT be treated as another activation route.

### Move Window staged trees

```text
SE-C46 Move window
├─ choose target: any Left-containing mask selects; no Left cancels but consumes Undo
└─ outline placement loop
   ├─ any nonzero mask -> wait for release, then sample the release-time position
   │  ├─ position verifier accepts -> return edge proposal to central direct apply
   │  └─ position verifier rejects -> beep and continue placement
   └─ no button -> continue tracking

SE-C303 Move window
├─ choose target: any Left-containing mask selects; no Left -> abort sentinel
└─ outline placement loop
   ├─ sample mask and cursor coordinates at button-down; return while held
   ├─ sampled mask containing Middle -> abort
   ├─ any remaining sampled mask containing Left or Right -> propose placement
   │  ├─ position verifier accepts -> return proposal for central edge re-verification
   │  └─ position verifier rejects -> beep and continue placement
   └─ no button -> continue tracking

SE-G85 Move window
├─ choose target: any Left-containing mask selects; no Left -> abort sentinel
└─ outline placement loop
   ├─ any mask containing Middle or Right -> abort
   ├─ Left alone -> propose placement
   │  ├─ position verifier accepts -> return proposal for central edge re-verification
   │  └─ invalid -> beep and continue placement
   └─ no button -> continue tracking
```

System 46 deliberately does not inspect the final button identity. System 303 Right
is acceptance, not a snapping gesture. Those source rules override broader manual
wording that says Middle or Right aborts.

### Reshape staged trees

```text
SE-C46 Reshape
├─ choose target: any Left-containing mask selects; no Left cancels but consumes Undo
└─ two-corner acquisition
   ├─ first corner: any nonzero mask; wait for release and use release-time point
   ├─ second/lower-right corner: wait for any nonzero mask without storing its
   │  identity, perform blinker cleanup, then sample still-live coordinates without
   │  release; add one to x and y for exclusive right/bottom edges; no abort leaf
   ├─ nonpositive rectangle -> replace with full inside rectangle
   ├─ helper verifier accepts -> return proposal to central direct apply
   └─ helper verifier rejects -> beep and repeat acquisition

SE-C303 Reshape
├─ choose target: any Left-containing mask selects; no Left -> abort sentinel
└─ two-corner acquisition
   ├─ at each corner preserve the button-down mask
   ├─ first corner coordinate -> sampled only after that button is released
   ├─ second/lower-right coordinate -> sampled after down-time mask capture and
   │  cleanup while no release is awaited; then add one to x and y for exclusive edges
   ├─ any mask containing Middle -> beep; return original edges as a normal result
   │  and therefore consume Undo
   ├─ any remaining mask containing Right -> smart corner
   │  ├─ traverse every exposed descendant and the edited sheet itself in depth-first
   │  │  postorder, following each exposed-inferior list in order
   │  ├─ per visited sheet test x-low, x-high, y-low, then y-high independently
   │  ├─ every qualifying directional delta 0 < d < 32 overwrites the prior axis value
   │  └─ after all overwrites clamp x to the closed coordinate bounds
   │     `[inside-left, inside-right]` and y to `[inside-top, inside-bottom]`
   ├─ Left alone -> ordinary corner
   ├─ helper verifier accepts -> return proposal for central edge re-verification
   └─ helper verifier rejects -> beep, error popup, and retry

SE-G85 Reshape
├─ choose target: any Left-containing mask selects; no Left -> abort sentinel
└─ one-corner window-editor reshaper
   ├─ initial active corner -> saved global default, initially lower-right
   ├─ pointer -> warped to active corner
   ├─ any mask containing Middle -> return original edges as a normal result;
   │  consume Undo
   ├─ any remaining mask containing Right -> smart-snap active corner
   ├─ Left alone -> place without smart snapping
   ├─ Shift held during tracking -> move the opposite corner dynamically too
   ├─ negative width/height -> beep and continue
   └─ proposal -> clamp to bounding box, then central window validation
```

The Genera Shift rule changes tracking mode while held; it is not a prefix and does
not require a second key. The one-corner default is mutable global state and MUST be
read at operation entry rather than compiled into the implementation.

### Edge and corner classification

For Move Multiple and Move Single, select the first containing record. Within its
rectangle:

1. For an extent, the low corner zone uses the strict test
   `coordinate < low + truncate(extent / 3)` and the high corner zone uses the
   strict test `coordinate > high - truncate(extent / 3)`. Equality at either
   third boundary is not a corner-zone hit.
2. A point in both a horizontal and vertical terminal third denotes the corresponding
   corner.
3. Otherwise normalize distance to the nearest horizontal and vertical boundary on
   a 0-to-100 scale and choose the nearer edge.
4. The following-arrow blinker origin and rotation identify the selected edge or
   corner.
5. Genera's finder releases any button outside every record and continues. The older
   finders return an explicit `:OUT` classification. C46 passes that invalid
   descriptor to its add-moving-window path; C46 and C303 Move Single likewise pass
   it to their feature path and signal rather than silently ignoring it. C303 Move
   Multiple alone has a source-visible outside branch described below.

C46's source literal for a displayed corner segment is octal `100`, decimal 64, and
its edge strip is 4 pixels. C303 and Genera use 64-pixel displayed corner segments
and 8-pixel edge strips. A conformer MAY scale them only in a separately labeled
accessibility profile; strict visual/interaction mode uses those device-pixel values.

### Move Multiple association rule

A selected record carries four independent booleans for left, top, right, and
bottom. Selecting an edge toggles one; selecting a corner toggles two as a unit.
Turning a feature on also turns on every eligible exactly coincident opposite
feature:

- a vertical edge association requires equal x coordinates and the selected
  vertical span to contain the other opposite edge's span;
- a horizontal edge association requires equal y coordinates and the selected
  horizontal span to contain the other opposite edge's span; and
- corner association requires both shared coordinates and the geometrically
  opposite corner pairing.

Turning a feature off removes only the selected record's feature pair; it does not
recursively clear associated records. The highlighted rectangle list is reconstructed
after each toggle.

### Move Multiple staged trees

```text
SE-C46 Move multiple: selection phase
├─ any mask containing Middle or Right -> abort whole command
├─ Left inside, released at elapsed <= 60 ticks -> toggle feature; continue
├─ Left inside, still held when elapsed > 60 ticks -> toggle feature; begin movement
└─ Left outside -> pass source-produced :OUT descriptor to ADD-MOVING-WINDOW;
   signal from that invalid feature path

SE-C303 Move multiple: selection phase
├─ any mask containing Middle -> return unchanged normal model; consume Undo
├─ any remaining mask containing Left over a feature
│  ├─ release at elapsed <= 60 ticks -> toggle feature; continue
│  └─ still held when elapsed > 60 ticks -> toggle feature; begin movement
├─ Right alone over a feature
│  ├─ movement-list is non-NIL -> begin movement without toggling pointed feature;
│  │  this includes a retained record whose four feature flags are all false
│  └─ movement-list is NIL -> finish with no geometry change
└─ any non-Middle mask outside -> :OUT toggles nothing and the nonzero mask exits
   selection
   ├─ movement-list is non-NIL -> begin movement without adding the outside feature
   └─ movement-list is NIL -> return unchanged normal model; consume Undo

SE-G85 Move multiple: selection phase
├─ any button pressed outside every record -> release it and continue tracking
├─ any mask containing Middle over a feature -> cancel with unchanged model
├─ any remaining mask containing Left over a feature
│  ├─ release at elapsed <= 60 ticks -> toggle feature; continue
│  └─ still held when elapsed > 60 ticks -> toggle feature; begin movement
└─ Right alone over a feature
   ├─ nonempty move set -> begin movement without toggling pointed feature
   └─ empty move set -> finish with no geometry change

movement phase, SE-C46
├─ track delta and outline; out of bounds -> beep and continue
├─ Left alone -> commit
└─ any mask containing Middle or Right -> return original model normally; consume Undo

movement phase, SE-C303 and SE-G85
├─ track delta and outline; out of bounds -> beep and continue
├─ any mask containing Middle -> return original model normally; consume Undo
└─ any remaining nonzero mask -> commit
```

The 60-tick threshold is described in the source as one second. Release at elapsed
time less than or equal to 60 ticks is the short/toggle branch; movement begins only
when the held interval is strictly greater than 60. Strict compatibility MUST use
the profile clock's comparison; a portable profile MAY define the wall-clock
equivalent and disclose it.

### Move Single staged trees

```text
SE-C46 and SE-C303 selection phase
├─ any mask containing Middle or Right -> abort whole command
├─ Left alone on an edge/corner -> select only that feature and immediately move
└─ Left outside -> pass the source-produced :OUT descriptor to the feature path;
   signal rather than silently ignore

SE-G85 selection phase
├─ any button pressed outside every record -> release it and continue tracking
├─ any mask containing Middle or Right over a feature -> cancel unchanged model
└─ Left alone over a feature -> select it and immediately move

movement phase, SE-C46
├─ valid delta + Left alone -> commit
├─ any mask containing Middle or Right -> abort
└─ out of bounds -> beep and continue

movement phase, SE-C303 and SE-G85
├─ any mask containing Middle -> abort
├─ valid delta + any remaining nonzero mask -> commit
└─ out of bounds -> beep and continue
```

Move Single never adds coincident neighbors. Later profiles test only for Middle at
final placement, so Right commits even though user documentation emphasizes Left.

### Frame-Up application-owned and incorporated binding tree

```text
global entry
├─ Select Q -> select or create Frame-Up activity
└─ System Menu -> Frame-Up -> select or create Frame-Up activity

Frame-Up local command table
├─ typed command name or command-menu cell -> Set Program Options
├─ typed command name or command-menu cell -> Select Configuration
├─ typed command name or command-menu cell -> Reset Configuration
├─ typed command name or command-menu cell -> Preview
├─ typed command name or command-menu cell -> Done
├─ typed command name or command-menu cell -> Set Pane Options
├─ typed command name or command-menu cell -> Set Pane Name
├─ typed command name or command-menu cell -> Split Pane
├─ typed command name or command-menu cell -> Swap Panes
├─ typed command name or command-menu cell -> Delete Pane
├─ application character accelerator or prefix -> none: accelerator reading is disabled
├─ inherited application command table -> none
└─ application numeric/repeat syntax -> none

layout-pane presentation in the outer idle command-input context
├─ exact unmodified Left / :select on a leaf
│  └─ activated Split Pane <leaf> Horizontally
├─ exact Shift-Left on a leaf, including the raw double-Left encoding
│  └─ activated Split Pane <leaf> Vertically
├─ exact unmodified Middle on any presented layout node
│  └─ Set Pane Options <node>
│     └─ an internal row/column can fail because it is not a registered pane type
├─ exact unmodified Right -> generic Dynamic Windows Operation menu
│  ├─ Split Horizontally and Split Vertically are candidates on leaves
│  ├─ Set Pane Options is a candidate on presented nodes
│  ├─ Set Pane Name is a menu-only candidate on presented nodes
│  └─ Delete Pane is a menu-only candidate on presented nodes
├─ handler-menu-only Set Pane Name <node> <unread name>
│  └─ produce a nonactivated command and acquire the name before execution
└─ handler-menu-only Delete Pane <node> -> produce an activated command

layout-pane presentation while CP is acquiring a layout-pane argument
├─ exact Left -> innermost identity/Select handler supplies the pane argument
├─ exact Shift-Left -> innermost Select-and-Activate handler supplies the pane
│  argument and activates when the reader permits it
└─ outer idle Split translators do not outrank that inner acquisition context

Zmacs standard command table
├─ M-X Extended Command -> name completion/activation
│  ├─ Create Program Definition
│  ├─ Insert Program Definition
│  ├─ Edit Program Definition
│  └─ Edit Program Redisplay Function
└─ C-M-X Any Extended Command -> name completion/activation
   ├─ Create Program Definition
   ├─ Insert Program Definition
   ├─ Edit Program Definition
   └─ Edit Program Redisplay Function
```

Every Frame-Up keyboard subtree below begins only after Genera console ingress. A
hardware code first follows the exact raw-mode, Select-prefix, Function/numeric,
asynchronous, and selected-buffer routing tree incorporated from
[D02 complete input binding trees](program-selection-activities-and-window-management-reimplementation-specification.md#complete-input-binding-trees).
A globally consumed Select/Function/asynchronous character never becomes Command
Processor or Input Editor text. A selector can also move keyboard focus away from
Frame-Up while its program process remains alive.

The Frame-Up command table explicitly disables character accelerators and inherits
from no command table. The three command-table names stored in the work area are
defaults for the program being generated, not Frame-Up parents. Consequently the
framework calls the ordinary Command Processor command reader rather than the
accelerated reader. The Input Editor is still active while the command name and
arguments are acquired, but its keys edit or navigate that input; they do not repeat
a Frame-Up command.

The selected-source Input Editor registry and its dispatch precedence are incorporated
normatively from the complete
[Dynamic Windows Input Editor map](genera/dynamic-windows-reimplementation-specification.md#input-editor-dispatch-and-complete-base-command-map).
That companion inventory includes every base chord, the `C-Q` and scroll-register
second-stage reads, numeric argument construction, standard intercepted characters,
ordinary self-insertion, unknown-control beep behavior, and mutable-overlay rule.
Frame-Up adds the following per-call Command Processor option layer ahead of that
global editor registry:

```text
Frame-Up interactor character
├─ asynchronous console interception before delivery
│  ├─ C-Abort or C-M-Abort -> selected process abort route
│  └─ C-Suspend or C-M-Suspend -> selected process suspension route
├─ Command Processor command-name option map
│  ├─ graphic text -> self-insert into a command name
│  │  ├─ optional initial colon -> consumed by the command parser
│  │  └─ comma -> ordinary name text here, never a form-reader prefix
│  ├─ Space or Line -> partial-complete/name-token delimiter
│  ├─ Complete -> complete the name, then become its argument-space delimiter
│  ├─ Meta-Complete -> complete/preview and acquire arguments
│  ├─ Tab -> complete and validate, then become Space
│  ├─ Super-Complete -> maximal completion
│  ├─ Help, C-?, or C-/ -> contextual help or current possibilities
│  ├─ Right on a completion presentation -> semantic completion menu
│  └─ Return, C-Return, or End -> activate/terminate only if the command is valid
├─ per-call Input Editor option binding -> run it before the global editor map
├─ exact global Input Editor chord -> run the incorporated editor command
├─ Abort or M-Abort -> normal keyboard interception and top-level command abort
├─ Suspend or M-Suspend with framework typeout
│  └─ expose/use/remove the typeout window, then abort this command read
├─ any modified digit or modified minus -> build an Input Editor numeric argument
├─ C-U -> multiply that editor argument by four
├─ other unbound control/format character -> beep and clear the editor argument
└─ other graphic, Return, Tab, Backspace, or diacritic
   └─ self-insert according to the active CP option/parser boundary
```

The exact source-initialized command-name stages are:

| Command | Positional acquisition after the completed name | Nested interaction |
| --- | --- | --- |
| Set Program Options | none | opens Accepting Values over copied program options |
| Select Configuration | configuration name | menu/typed acquisition, then readline Yes/No confirmation |
| Reset Configuration | none | readline Yes/No confirmation |
| Preview | none | generic one-character reader described below |
| Done | none | validate/generate/return |
| Set Pane Options | layout pane | opens Accepting Values over a copied pane option list |
| Set Pane Name | layout pane, then name | ordinary CP acquisition for both arguments |
| Split Pane | layout pane, then horizontal/vertical direction | typed, pointer, or menu acquisition by presentation type |
| Swap Panes | first layout pane, then second layout pane | typed or pointer acquisition by presentation type |
| Delete Pane | layout pane | typed or pointer acquisition by presentation type |

Each typed route is `command-name -> delimiter/completion -> arguments in declared
order -> Return/C-Return/End activation`. `Meta-Complete` after the name enters the
argument-preview path, which uses Accepting Values when more than one argument remains.
Help and completion are recomputed at the current stage; Abort unwinds the current
read rather than executing a partial command. There is no Command Processor numeric
prefix grammar at the idle Frame-Up prompt because accelerated reading is disabled.
Any Input Editor numeric state instead applies to the next editor command or
self-insertion and is then cleared.

A translator declared with no gesture is menu-only in this source: it appears in a
presentation handler/Operation menu when its tester and input context permit it and
MUST NOT be invented as a direct pointer chord. The exact live Right-menu contents
were dismissed before reading and remain `TODO-RUNTIME-FU-HANDLER-MENU`. A Left click
in pane whitespace produced no visible split in the preserved run, while a typed
Split Pane command succeeded; `TODO-RUNTIME-FU-LEAF-HITBOX` must establish whether
the source translator's presentation region excludes that whitespace or the loaded
world differs.

The fixed command-menu pane has the following button dispatch:

```text
command-menu cell
├─ exact unmodified Left
│  ├─ every missing positional argument has a usable default and no confirmation
│  │  is required -> supply defaults and execute directly
│  └─ any missing argument lacks a usable default, or confirmation is required
│     -> acquire/confirm through the Command Processor
├─ exact unmodified Right
   ├─ zero remaining arguments -> execute
   ├─ more than one remaining argument -> acquire with Accepting Values
   └─ exactly one remaining argument
      ├─ presentation type has a non-printer menu displayer -> menu acquisition
      └─ otherwise -> keyboard Command Processor acquisition
├─ exact unmodified Middle -> no Frame-Up command-menu action
└─ every modified Left/Middle/Right raw character -> no fixed-menu handler;
   continue through generic Dynamic Windows resolution, then dead-blip/beep if none
```

Consequently, Split Pane, Swap Panes, and Set Pane Name use Accepting Values when
chosen with Right from the fixed menu; the one-argument `layout-pane` commands use
keyboard acquisition because that type defines only parser/printer behavior; and
Select Configuration's menu-choice argument is acquired by menu. These are standard
program-framework command-menu handler semantics exercised by Frame-Up's declared
commands and therefore part of the effective tree, although the handler mechanism is
Dynamic Windows-owned.

The raw mouse encoder constructs a distinct character for each of the 32 combinations
of Shift, Control, Meta, Super, and Hyper bits on each of Left, Middle, and Right.
Frame-Up therefore has 96 distinguishable raw pointer characters; modifier-bearing
characters do not fall back to the unmodified fixed-menu or layout translator.
Simultaneous newly-down buttons choose the highest newly-down bit: Left+Middle becomes
Middle, while every simultaneous mask containing Right becomes Right. Sequential
chords resolve each newly-down transition separately. After a press, the physical
encoder waits its configurable interval for release and repress of that same highest
button; a NIL interval disables double-click construction entirely. It suppresses
double-click construction when keyboard input is already
pending, ORs Shift into a recognized second click, and stops after that second click;
there is no distinct triple-click encoding. Thus double-Left is indistinguishable
from Shift-Left, double-Middle from Shift-Middle, and double-Right from Shift-Right at
the logical-gesture boundary. Conformance MUST test direct injection of all 96 logical
characters separately from this physical transition/timing path.

Every one of those 96 characters first has a unique primary gesture named from its
modifier state and button. The selected source adds only these aliases; every raw
state absent from this table retains only its unique primary gesture:

Primary symbol spelling is historical, not a modern canonical modifier order.
Numeric bit state 3 is specially printed `CONTROL-META`; every other combined state
uses long-name order Hyper, Super, Meta, Control, then Shift. Thus bit state 19's
primary symbols are `META-CONTROL-SHIFT-LEFT/MIDDLE/RIGHT`, even though the aliases
declared with `c-m-sh-mouse-*` are Monitor/Unmonitor as shown below. A clone that
serializes gesture names MUST preserve this distinction.

This is the exhaustive primary-state inventory. Each row expands to the three raw
characters `<prefix>LEFT`, `<prefix>MIDDLE`, and `<prefix>RIGHT`, yielding exactly 96
cells; the empty prefix in state 0 yields `LEFT`, `MIDDLE`, and `RIGHT`.

| State | Historical primary prefix | State | Historical primary prefix |
| ---: | --- | ---: | --- |
| 0 | *(empty)* | 16 | `SHIFT-` |
| 1 | `CONTROL-` | 17 | `CONTROL-SHIFT-` |
| 2 | `META-` | 18 | `META-SHIFT-` |
| 3 | `CONTROL-META-` | 19 | `META-CONTROL-SHIFT-` |
| 4 | `SUPER-` | 20 | `SUPER-SHIFT-` |
| 5 | `SUPER-CONTROL-` | 21 | `SUPER-CONTROL-SHIFT-` |
| 6 | `SUPER-META-` | 22 | `SUPER-META-SHIFT-` |
| 7 | `SUPER-META-CONTROL-` | 23 | `SUPER-META-CONTROL-SHIFT-` |
| 8 | `HYPER-` | 24 | `HYPER-SHIFT-` |
| 9 | `HYPER-CONTROL-` | 25 | `HYPER-CONTROL-SHIFT-` |
| 10 | `HYPER-META-` | 26 | `HYPER-META-SHIFT-` |
| 11 | `HYPER-META-CONTROL-` | 27 | `HYPER-META-CONTROL-SHIFT-` |
| 12 | `HYPER-SUPER-` | 28 | `HYPER-SUPER-SHIFT-` |
| 13 | `HYPER-SUPER-CONTROL-` | 29 | `HYPER-SUPER-CONTROL-SHIFT-` |
| 14 | `HYPER-SUPER-META-` | 30 | `HYPER-SUPER-META-SHIFT-` |
| 15 | `HYPER-SUPER-META-CONTROL-` | 31 | `HYPER-SUPER-META-CONTROL-SHIFT-` |

| Exact raw state | Additional logical gestures, in lookup order after the primary |
| --- | --- |
| Left | Select |
| Middle | Describe; Select-and-Edit |
| Right | Menu |
| Shift-Left | Select-and-Activate; Alternate-Select |
| Shift-Middle | Inspect; Delete; Remove |
| Shift-Right | System-Menu |
| Control-Left | Hold-and-Mark-Region |
| Control-Middle | Yank-Word |
| Control-Right | Marking-and-Yanking-Menu |
| Control-Shift-Middle | Mark-Word |
| Meta-Left | Edit-Function; Edit-Definition |
| Meta-Middle | Evaluate-Form; Disassemble |
| Meta-Shift-Right | Window-Operation-Menu |
| Super-Left | Select-Object |
| Super-Middle | Describe-Presentation |
| Super-Right | Presentation-Debugging-Menu |
| Super-Shift-Left | Reprint-Differently |
| Super-Shift-Middle | Edit-Viewspecs |
| Control-Meta-Left | Set-Breakpoint |
| Control-Meta-Middle | Clear-Breakpoint |
| Control-Meta-Right | Modify; Set-Complex-Breakpoint |
| Control-Meta-Shift-Left | Monitor-Location |
| Control-Meta-Shift-Middle | Unmonitor-Location |

Hyper-only states and unlisted multi-modifier combinations deliberately have no
additional alias in this initialization. A handler still needs a compatible
presentation/context/tester to make an alias actionable. The map is mutable:
`set-mouse-char-for-gesture` can move or delete an alias and clears the relevant
caches. A site-profile dump MUST therefore record all 96 `mouse-char-gestures` cells
and the reverse gesture-to-character pairs.

Before Dynamic Windows sees a physical event, the Essential Mouse layer consumes an
exact `CHAR-MOUSE-EQUAL` match to `MOUSE-R-2`. It opens System Menu on a
console-enabled stream and otherwise
beeps; there is no fallback into Dynamic Windows. That character can arise from either
a physical Shift+single Right or a natural unmodified Right double click; the two are
indistinguishable. Meta-Shift-Right is a different mouse character and reaches the Window
Operation Menu path. This ingress rule does not prevent a test harness from injecting
the raw character directly below the Essential Mouse layer, so both levels MUST be
tested and identified.

Click routing also depends on selection. If the selected window implements the
presentation-input-blip handler, hit-testing and coordinates come from the clicked
window but the blip travels through the console system-I/O buffer, so the selected
window's active input context and command table govern translation. Otherwise the
event is forced into the clicked window. A click on an unselected Frame-Up display is
therefore not automatically interpreted in Frame-Up's context. On blank area, exact
unmodified Left has the generic Select This Window candidate only when the clicked
window alias differs from the selected alias; the tester rejects an already-selected
window.

For every raw character without a Frame-Up leaf, the complete outcome is:

```text
unclaimed Frame-Up raw pointer character
├─ choose the highlighted innermost presentation using all three button characters
│  that share the event's modifier bits, not only the button actually pressed
│  └─ a sibling-button handler can therefore determine this outer presentation/context
├─ try that highlighted presentation in its highlighted context
├─ retry that presentation across active contexts, innermost to outermost
│  └─ suppress duplicate presentation-type context objects by identity
├─ reselect/retry using only the actual character while ignoring suppress-highlighting
├─ first applicable direct handler -> invoke it
│  └─ handler returns NIL without an explicit non-NIL type, or semantic dead result
│     -> return (dead-blip) without the no-match condition/beep path
├─ applicable menu alias -> construct the context-filtered generic menu
└─ no matching handler
   ├─ signal dead-blip with "<mouse char> is not defined in this context"
   ├─ condition unhandled -> beep
   └─ return the semantic (dead-blip) result
```

Definite generic candidates still have capability/tester gates. Below physical
ingress, Shift-Right has a System Menu handler only on a console-enabled stream.
Meta-Shift-Right starts the asynchronous TV Window Editor path. Super-Right opens
Presentation Debugging only when its named menu has at least one applicable member;
loading the Presentation Inspector component makes that menu nonempty for ordinary
nonanonymous presentations when its debugging tester succeeds. While an
`si:input-editor` context is active,
Control-Left can hold/mark displayed strings; Control-Middle and
Control-Shift-Middle require synthesized raw text; and Control-Right opens its
Marking/Yanking menu only when that menu is nonempty. Super-Left and the remaining
aliases likewise require a compatible type/tester; otherwise they reach dead-blip.
This is generic substrate behavior, not an undocumented Frame-Up command. A
conforming profile MUST dump the mutable gesture and handler registries and enumerate
all 96 characters in each active context rather than extrapolating from unmodified
buttons. Same-priority handler ordering cannot safely be inferred from the selected
source's apparent name-comparison typo; the live effective order must be recorded
where a tie actually occurs.

The fixed base contract comprises the 96 primary cells, initialization aliases and
order, highest-newly-down-button rule, Shift-OR double encoding, lookup/context/dead
algorithm, and selected built-in handler definitions. Profile inputs are the mutable
gesture map, loaded handler registry and command tables, active context and selected
window, tester/capability/object state, physical keyboard-to-internal modifier map,
double-click timeout including NIL-off, and local-versus-remote debounce behavior.
Every conformance result MUST state those profile inputs rather than treating the
source initialization as an immutable global keymap.

Exact unmodified Right on a Frame-Up leaf's `layout-pane` presentation opens an
Operation menu. Its application-owned unstyled members are Split Horizontally, Split
Vertically, Set Pane Options, Set Pane Name, and Delete for a leaf; an internal node
omits the two Split entries. Generic styled groups add Window Operation Menu always,
System Menu when console-enabled, and Presentation Debugging Menu when loaded and
nonempty, plus Marking and Yanking Menu when the outer Input Editor context makes that
named menu nonempty. All unstyled entries sort alphabetically before all styled entries, which
also sort alphabetically; the last choice is remembered separately per menu type. On
blank Right there is always Window Operation Menu, optionally System Menu and Select
This Window, and—because command reading establishes an outer `si:input-editor`
presentation context—Marking and Yanking Menu when that named menu has an applicable
member. There is no Presentation Debugging blank-area member.

### Frame-Up confirmation and Preview nested trees

Select Configuration and Reset Configuration use a readline `FQUERY`, not a
single-character Y/N reader:

```text
readline Yes/No confirmation
├─ edit text -> full incorporated Input Editor map
├─ Space/Line/Complete/Tab/Super-Complete -> completion/delimiter behavior
├─ Help/C-?/C-/ -> show the Yes and No possibilities
├─ Return/C-Return/End on a complete Yes or No -> return that Boolean choice
├─ invalid or incomplete text -> retain editable input and request correction
├─ applicable pointer presentation -> return the same semantic choice
└─ Abort/intercept route -> unwind without confirming
```

Preview uses the generic character reader after drawing the candidate layout:

```text
Preview wait
├─ Refresh -> repaint/reprompt, continue waiting
├─ any returned ordinary character, including Help without an installed help callback
│  └─ leave Preview and restore the designer
├─ Abort/M-Abort -> ordinary intercept/abort
├─ Suspend/M-Suspend -> ordinary suspend/typeout interception
└─ noncharacter blip -> generic TYI blip handler
   ├─ plain Mouse-Left -> ignore and continue
   ├─ other mouse button -> consider global System Menu dispatch, then continue
   ├─ Menu or Typeout-Execute blip -> beep, continue
   ├─ registered blip kind -> invoke its handler
   └─ unknown blip -> ignore, continue
```

The four Zmacs commands are reached through `M-X` or `C-M-X`, but their prompt is
Mini-IE rather than the ordinary Dynamic Windows interactor. Its local table binds
`C-Q`, `C-G`, Abort, the ordinary and shifted `M-Y`/`C-M-Y` variants, completion,
Help, and conditional Return; explicitly shadows `C-Z`, `M-Z`, `C-M-Z`, and `M-;`
as undefined; and inherits the full Standard Zwei map, including its `C-X` prefix
tree. `C-M-X` during an active `M-X` prompt converts it to Any Extended Command while
preserving entered text. The exact inherited tree is incorporated from
[Zmacs Mini-IE and recursive contexts](genera/zmacs-keybindings.md#mini-input-and-recursive-contexts);
numeric arguments are displayed/preserved by that editor but do not repeat a
Frame-Up integration command.

### System 303 Attributes nested input tree

`SE-C303` uses the older variable-value editor. Its application-owned row and margin
gesture tree is complete below:

The form selects an ordinary TV stream, so hardware ingress still passes through the
complete `SE-C303` nonraw global layer in the
[Screen Editor effective keyboard tree](#screen-editor-effective-keyboard-and-fallthrough-tree)
before any event below. Terminal and System prefixes, Control-Clear, and the selected
buffer's asynchronous table (base Control-Abort, Control-Meta-Abort, Control-Break,
and Control-Meta-Break) can therefore act before enqueue; super-image disables only
that selected-buffer table. Only an event delivered after those branches enters the
idle chooser or alternate rubout handler. The mutable exact Terminal/System suffix
trees remain normatively incorporated from D02 and TV; their keys MUST NOT be
misreported as RH self-insert or unbound commands.

```text
attribute form
├─ byte-exact MOUSE-3-2 with Control/Meta/Super/Hyper absent, anywhere
│  ├─ physical Shift+single Right and natural unmodified Right double click both encode it
│  └─ essential-mouse layer opens global System Menu before form hit-testing
├─ association-choice row (font, More, Reverse, input action, output action,
│  draw ALU, erase ALU, save bits)
│  ├─ exact unmodified single Left encoding -> assign that choice; no typed input
│  ├─ exact unmodified single Right encoding -> assign that choice; no typed input
│  ├─ unmodified Middle encoding -> no row action
│  └─ any other modifier-bearing or multiple-click encoding -> no row action
├─ typed row (vertical spacing, Other value, priority, name/label, border width,
│  border-margin width)
│  ├─ exact unmodified single Left encoding -> edit an empty input buffer
│  ├─ exact unmodified single Right encoding -> edit the printed old value
│  ├─ unmodified Middle, any other modifier, or multiple click -> no row action
│  ├─ any edit that empties the buffer -> full-rubout handshake below
│  ├─ once editing -> native System 303 alternate-rubout-handler tree below
│  └─ accepted text -> row-specific NUMBER, S-expression, or STRING reader
├─ idle chooser event
│  ├─ Variable-Choice blip -> run the selected row path above
│  ├─ Choice-Box blip -> run the selected Done/Abort path below
│  ├─ Mouse-Button blip -> consume/ignore
│  ├─ every other cons/blip -> signal FERROR
│  ├─ exact unmodified Form atom -> refresh the form
│  └─ every other atom/character -> consume without row action
├─ current bottom margin-choice region established by mouse motion
│  ├─ x falls in the gap/outside both small boxes -> beep and handle; never fall through
│  └─ x hits Done or Abort with any other encoded button
│     ├─ start separate Choice process; enqueue a Choice-Box blip asynchronously
│     ├─ rubout handler consumes it before typed edit returns -> ignored; no choice
│     └─ idle form chooser consumes it -> Done commits, or Abort catches, beeps,
│        applies no setter, returns unchanged normal model, and consumes Undo
└─ no row and the whole-bottom-margin method declined or was not current
   ├─ exact unmodified Left while chooser is deselected
   │  └─ essential-mouse may select the chooser instead of enqueueing a blip
   └─ otherwise -> no form action
```

For an unmodified physical mask the TV encoder chooses the highest set button:
mask 1 becomes Left; 2 and 3 become Middle; and 4, 5, 6, and 7 become Right.
Consequently a Left+Right, Middle+Right, or three-button chord takes the exact Right
row path, while Left+Middle takes the no-action Middle path. Control, Meta, Super,
and Hyper bits remain in the encoded character and prevent an exact row match. Shift
increments the click count, so it likewise prevents a single-click row match. This
mask rule applies to buttons newly down in one transition. Sequential presses dispatch
separately: after Left enters a typed row, a later Right is handled inside the rubout
handler rather than retroactively selecting the Right-prefill row path. For a margin
choice, only otherwise-unmodified Shift plus a Right-containing mask (or an equivalent
natural Right double click) becomes byte-exact MOUSE-3-2 and diverts to System Menu;
adding Control, Meta, Super, or Hyper makes it a different character that the margin
box dispatcher accepts and schedules. The tracked `CURRENT-REGION` covers the whole
bottom margin; click-time x, not region identity, distinguishes Done, Abort, and the
beeping gap.

`CHOOSE-VARIABLE-VALUES` acquires a temporary form resource, saves the selected
window, exposes and selects the form, and runs this event loop. Its unwind cleanup
deactivates the form and unconditionally reselects the saved non-NIL object, with no
liveness test. Consequently, selecting another window from System Menu while the
Attributes form is active can be overridden when the form exits, and a destroyed
saved selection is passed back to `:SELECT` without a defensive guard. This nested
selection restoration is independent of Screen Editor's own outer restoration.

The typed replacement stage is native TV, not Dynamic Windows. The selected System
303 load enables `ALTERNATE-RUBOUT-HANDLER` globally through `RH-ON`; its mutable
binding tree is specified below and MUST be dumped before a site-specific test.

```text
typed-row event inside the alternate rubout handler
├─ cons/blip
│  ├─ Redisplay Rubout Handler -> clear and reprint edited input
│  ├─ configured blip handler -> absent for Attributes
│  ├─ configured preemption -> absent for Attributes
│  ├─ exact unmodified single Right encoding
│  │  └─ open System Menu; keep editing
│  └─ Left, Middle, any modifier, or multiple click -> ignore; keep editing
└─ character
   ├─ configured command/activation/editing/pass-through rule -> absent here
   ├─ exact key in mutable RH-COMMAND-ALIST -> invoke with signed argument
   │  └─ command leaves buffer empty -> return through :FULL-RUBOUT
   ├─ digit 0..9 whose remaining `CHAR-BITS` are nonzero after exact-command lookup
   │  └─ decimal numeric accumulator; normal keyboard bits are Control/Meta/Super/Hyper,
   │     and a synthetically forced Mouse-bit character also satisfies this predicate
   │     (physical Shift instead changes the converted code; Shift-only letters can remain
   │     zero-bit self-insert, while C-Shift-A/D can hit exact registered commands)
   ├─ C-U -> numeric := (numeric if present, else 1) * 4
   ├─ modified minus with no numeric value yet -> toggle negative sign
   ├─ modified minus after a numeric value -> beep; preserve prefix state
   ├─ any other unbound modified character -> beep; clear numeric/sign
   └─ otherwise unmodified -> insert numeric-or-one copies unless sign is negative;
      clear numeric/sign
```

The handler passes `(numeric-or-1 * sign)` to a registered command and resets the
prefix only after that command returns normally. A command-raised error escapes into
the enclosing chooser before that explicit reset, but the argument/sign bindings are
`LET`-bound and local to the unwound handler invocation, so a retry starts with no
prefix. Cons/blip handling—including System Menu and ignored blips—preserves the
numeric/sign state, so `C-3`, Right/System Menu, `C-F` still moves three characters.
Insertion batches are capped by the historical 64-element resource
buffer; movement clamps at the buffer endpoints and beeps only when asked to move
farther from an endpoint already reached. Delete ranges clamp and a zero-width delete
is silent. Right-edit inserts the old printed text but supplies no initial-pointer
option, so point starts at the **beginning** of that prefilled text, not its end.

The complete source-initialized `RH-COMMAND-ALIST`, in registration order, is:

| Binding | Operation and argument behavior |
| --- | --- |
| Clear Screen, `C-L` | Clear the window and reprint input |
| `M-<`, `M->` | Beginning/end of complete buffer |
| `C-F`, `C-B` | Forward/backward N characters |
| `C-<`, `C->` | Put mark at buffer beginning/end |
| `C-Space`, `C-@` | Put mark at point |
| `C-W` | Kill point-to-mark; beep with no mark |
| `M-W` | Save point-to-mark in the Zwei kill history; beep with no mark |
| `C-A`, `C-E` | Beginning/end of current line |
| `C-P`, `C-N` | Previous/next N lines with preserved, clamped column |
| `C-D`, Rubout | Delete next/previous N characters |
| Clear Input | Delete the complete buffer, then apply full-rubout |
| `C-K` | Kill to line end, or the newline when already at line end; numeric ignored |
| `M-F`, `M-B` | Forward/backward N words |
| `M-D`, `M-Rubout` | Delete next/previous N words |
| `M-T` | Exchange words; zero uses mark or beeps when no mark, negative repeats backward, positive forward |
| `C-M-F`, `C-M-B` | Forward/backward one S-expression; numeric ignored |
| `C-M-K`, `C-M-Rubout` | Delete next/previous one S-expression; numeric ignored |
| `C-M-T` | Exchange adjacent S-expressions; numeric ignored |
| `C-M-Y`, `C-C` | Yank per-stream input history; zero lists its first page, N selects entry N |
| `C-Y` | Yank global kill history; zero lists its first page, N selects entry N |
| `M-Y`, `M-C` | Rotate/replace after a compatible yank; otherwise no replacement |
| Status | Display first input-history page |
| `C-Status` | Display first kill-history page |
| `M-Status` | Display later input history from default page boundary or explicit N |
| `C-M-Status` | Display later kill history from default page boundary or explicit N |
| `C-!` | Complete the buffer prefix from input history at match N; beep if absent |
| `M-!` | Next/previous matching history completion only after that completion family; otherwise beep |
| Help | Contextual input help, including Right/System/Terminal help pointers |
| `M-Help` | Display special keyboard-symbol translations |
| `C-Help` | Display the live alternate-rubout-handler command list |
| `C-M-Help` | Display internal buffer pointers, size, and options |
| `C-Q` then a second event | Quote-next tree specified immediately below |
| `C-T` | Transpose adjacent characters using beginning/middle/end rules; beep below length two; numeric ignored |
| `C-O` | Insert N newlines; in the middle, normal return moves point back before them; at end, insertion throws for rescan first and leaves point after them |
| `C-Shift-A` | Display arglist near point; argument 2 uses SEND/FUNCALL lookup |
| `C-Shift-D` | Display arglist and documentation; argument 2 uses SEND/LEXPR-SEND lookup |

Unless a table row or the paragraph below explicitly names N, zero, sign, or a
special argument value, the registered command receives but does not consult the
prefix; normal return still consumes and resets it.

Numeric behavior is deliberately nonuniform and MUST NOT be normalized into a
generic repeat rule. Default N is +1. `C-F`/`C-B` reverse naturally for negative N
and no-op at zero; `C-P`/`C-N` no-op for every N <= 0. `C-D`/Rubout silently no-op
at zero, but negative N reaches the historical reversed-interval path rather than a
reverse-delete feature, so the exact condition or mutation is a required strict
oracle. `M-F`/`M-B` with negative N do not reverse: their increasing loop proceeds
until its boundary/no-next-word exit; the Meta delete commands delete to that result.
Meta word commands no-op at zero except `M-T`, whose zero case explicitly uses mark
and whose negative case explicitly repeats backward. `C-Q` and `C-O` with zero insert
no elements but mark/enter the rescan path: at buffer end the throw is immediate,
whereas in the middle the zero-width insertion can return and rescan occurs later. A negative count reaches the
historical negative-width insertion path and requires a strict failure oracle. A
`C-O` rescan also skips the command's later reposition step, so its end-of-buffer and
middle-of-buffer point results differ. The insertion helper caps the copied batch at
64, but the middle-path subtraction uses original uncapped N; for N > 64 it can
overshoot/clamp toward buffer start instead of simply stopping before the 64 inserted
newlines. A
zero-prefixed **ordinary** self-insert is more defective: at a fresh Left-start end
with no prior rubout it copies nothing but advances scan and can return a stale
resource-buffer character, whereas an already edited or Right-prefilled context
forces rescan. A strict clone MUST preserve/profile this resource-state distinction,
not treat zero as a universal no-op. `C-!` accepts only a positive match index; zero
or negative eventually beeps. `M-!` supports negative direction and uses the current
yank position at zero. `M-Y`/`M-C` at zero after a compatible yank delete the prior
yank, insert nothing, set mark, and retain the compatible history-command type;
without compatible yank state they perform no replacement. History-index signs and wrapping also depend on the selected mutable
history policy and MUST be dumped with the registry.

`C-Q` is the only registered multi-stage prefix in this handler:

```text
C-Q -> read one next event with alternate rubout handling bypassed
├─ exact unmodified single Right mouse blip -> open System Menu; keep reading
├─ any other noncharacter blip -> ignore; keep reading for a character
├─ unmodified character -> insert it N times
├─ modified alphabetic A..Z -> convert to control code 1..26; insert N times
└─ every other modified character -> beep; insert nothing
```

The Attributes wrapper adds one stage after `:FULL-RUBOUT`; emptying the buffer does
not itself restore the old value:

```text
alternate handler returns full-rubout
└─ stream TYI loop
   ├─ exact unmodified single Right mouse blip -> open System Menu; keep reading
   ├─ any other noncharacter blip -> ignore; keep reading
   ├─ returned character is Rubout -> choose NO-CHANGE and restore old value
   └─ any other returned character -> untyi it; restart from an empty edit buffer
```

Thus Rubout at the initial Right-start point zero is a silent zero-width delete and
cannot empty the prefilled text by repetition alone. The user must first move point
right/end and rub out, or use Clear Input; after actual emptying, one additional
Rubout restores. A Left-start edit begins empty, so even Help or a motion command that
leaves it empty enters this handshake.
The active parenthesis-motion definitions in the selected file are the later
S-expression commands listed above; the older parenthesis forms are commented out
and never register. `ADD-RH-COMMAND` replaces an existing association or appends a
new one, so a loaded-world dump remains mandatory for patches or site additions.
At normal physical ingress the essential-mouse layer diverts byte-exact MOUSE-3-2,
regardless of whether physical Shift+single Right or natural unmodified double-Right
produced it, before it can become a rubout-handler blip. Only an already queued or
synthetically forced MOUSE-3-2 blip reaches the handler's generic ignore branch.

After editing, NUMBER rows read one Lisp object and reject it unless it satisfies
`NUMBERP`; S-expression rows use the ordinary Lisp reader; STRING rows use line
input. These reader protocols, rather than an Attributes activation-key override,
decide when delimiters or Return terminate input. A `SYS:PARSE-ERROR` is caught inside
the stream rubout handler: it prints the error marker, requests re-echo, and stays in
the alternate editor so the user can correct or rub out the text. An error that
escapes that inner clause—such as NUMBER post-validation rejecting a non-number—uses
the variable-value form's outer handler. That handler prints the condition and reads
one dismissal character through the stream TYI filter: exact unmodified single Right
can open System Menu first and other blips are ignored. Space is consumed. Every
other returned character is put back and the form redisplays with `FULL-RUBOUT`
still true: an untyied Rubout is consumed by the next loop's old-value handshake and
restores the old value, while any other character is put back again and becomes the
first input of the next empty retry.

### Genera Attributes nested input tree

`SE-G85` Attributes opens an owned Dynamic Windows Accepting Values interaction.
Its keyboard events first pass through the Genera console raw-mode, Select, Function,
asynchronous, and selected-buffer tree incorporated from D02, exactly as for Frame-Up;
only a delivered event enters the accelerated form map below.
The complete selected-source idle accelerator tree is:

```text
Accepting Values
├─ local exact accelerator
│  ├─ Refresh -> force redisplay
│  ├─ Help -> Accepting Values help and effective accelerator documentation
│  ├─ End -> Done/validate
│  ├─ Abort -> signal Abort
│  ├─ Space
│  │  ├─ highlighted value/query -> replace it
│  │  ├─ highlighted enumerated choice -> choose it
│  │  └─ nothing highlighted -> accelerator error
│  ├─ C-E
│  │  ├─ highlighted value/query -> edit from old value
│  │  ├─ highlighted enumerated choice -> choose it
│  │  └─ nothing highlighted -> accelerator error
│  ├─ C-D
│  │  ├─ highlighted value/query -> remove/reset it
│  │  ├─ highlighted enumerated choice -> "Can't remove this field" error
│  │  └─ nothing highlighted -> accelerator error
│  ├─ C-N [argument] -> next query
│  ├─ C-P [argument] -> previous query
│  ├─ C-F [argument] -> next enumerated choice
│  └─ C-B [argument] -> previous enumerated choice
├─ inherited Standard Scrolling accelerator
│  ├─ Scroll -> vertical forward
│  ├─ M-Scroll or Back-Scroll -> vertical backward
│  ├─ M-< or Home -> vertical beginning
│  ├─ M-> -> vertical end
│  ├─ Super-Scroll -> horizontal forward
│  ├─ M-Super-Scroll or Super-Back-Scroll -> horizontal backward
│  ├─ C-Scroll -> typeout forward
│  ├─ C-M-Scroll or C-Back-Scroll -> typeout backward
│  ├─ C-M-S then one character -> save position in that register
│  ├─ C-M-R then one character -> restore position from that register
│  ├─ C-S or Super-S -> search forward
│  └─ C-R or Super-R -> search backward
├─ inherited Standard Arguments prefix
│  ├─ C-U [repeatable] -> argument starts at four and multiplies by four
│  ├─ Control-, Meta-, or Control-Meta digit/minus sequence -> signed decimal
│  ├─ dedicated infinity character -> infinite argument
│  ├─ then C-N/C-P/C-F/C-B or argument-aware scrolling -> consume argument
│  └─ then another local accelerator -> accelerator error, beep, clear input
├─ colon -> no full-command route in this table; accelerator error
├─ every other unknown idle character -> accelerator error, beep, clear input
└─ replace/edit opens a field reader
   └─ context-shadowed Input Editor, ACCEPT parser, completion, Help, and activation
```

Query/choice motion does not wrap. Positive motion from no highlight selects the
first candidate; negative motion from no highlight beeps. Reaching an end beeps and
preserves the current candidate. Negative arguments reverse direction. A zero query
argument preserves the current query; the source's zero-choice branch can lose the
choice highlight and MUST be reproduced/tested rather than normalized into a no-op.

The direct presentation and exit-box pointer tree is:

```text
Accepting Values presentation
├─ value/query
│  ├─ exact unmodified Left -> replace
│  ├─ exact unmodified Middle -> edit old value
│  ├─ exact Shift-Middle or encoded double-Middle -> remove/reset
│  └─ exact unmodified Right -> generic Operation menu with applicable
│     replace/edit/remove candidates
├─ enumerated choice
│  ├─ exact unmodified Left -> choose
│  └─ exact unmodified Right -> generic Operation menu with choose candidate
├─ Done or Abort program-framework cell/inline exit presentation
│  ├─ exact unmodified Left -> execute zero-argument Done/Abort
│  ├─ exact unmodified Right -> execute zero-argument Done/Abort
│  └─ Middle or any modified raw gesture -> no cell handler
└─ every other raw modifier/button state
   └─ generic presentation handler if applicable, else dead-blip/beep
```

Field entry transfers to the full context-shadowed Input Editor and completion tree
specified in [Dynamic Windows](genera/dynamic-windows-reimplementation-specification.md#input-editor-dispatch-and-complete-base-command-map);
the idle accelerator table does not remain in control of editing characters. Screen
Editor does not catch the form's Abort locally; its eventual preserved-world
destination remains `TODO-RUNTIME-SE-G85-ATTRIBUTES-ABORT`. The source-initialized
map is complete here, while live gesture, accelerator, and handler registries remain
mandatory comparison dumps for patches and site remapping.

The four Zmacs commands add no command-specific direct chord. In the selected Genera
8.5 standard table, both `M-X` (**Extended Command**) and `C-M-X` (**Any Extended
Command**) reach name completion and activation for all four names, as specified by
the exact [Zmacs standard command map](genera/zmacs-keybindings.md#search-evaluation-help-and-commands).
Its Standard Zwei, `C-X` prefix, Mini-IE, Help, completion, and unbound behavior is
incorporated at that document's stated scope. Site remappings remain outside this
base profile.

### Entry-target and nested choice button precedence

The `SE-C303` and `SE-G85` D02 **Edit Screen** entries are three-button items. For a
multi-button chord the highest set button selects the branch: Right takes precedence
over Middle, which takes precedence over Left. Ordinary Screen Editor items and
ordinary momentary choices instead execute on any pointer button without inspecting
its identity.

The Right-entry target finder is release-specific:

- `SE-C46` walks ancestors and retains every `BASIC-FRAME`, without an explicit
  exposure filter. With no frame it returns the mouse sheet. Otherwise it ensures a
  mouse-sheet choice and asks which object to edit.
- `SE-C303` retains exposed `BASIC-FRAME` ancestors and clears the accumulated list
  after a deexposed ancestor. It stores label/window pairs, then mistakenly tests
  the raw mouse sheet against those pair objects with the source's `MEMQ` condition.
  Whenever the candidate list is non-NIL that test misses, so the code always prepends
  a `(label . mouse-sheet)` row. It is a duplicate only when the mouse sheet was
  already represented among the Basic Frame candidates. The prompt asks which screen
  or frame's inferiors to edit.
- `SE-G85` retains exposed ancestors that affirm `:INFERIORS-EDITABLE-P`, clears the
  list at a deexposed ancestor, deduplicates raw sheet identities correctly, and
  labels them only after collection. Its prompt identifies editing subwindows.

**Expose (menu)** and confirmation menus accept any pointer button on a row.
`SE-C303` and `SE-G85` beep and display a dismissible diagnostic when there is no
hidden direct inferior, but their input contracts differ. C303's complete nested
pop-up tree is:

```text
C303 POP-UP-MESSAGE / POP-UP-FORMAT
├─ WINDOW-CALL selects the pop-up and saves the old selection
├─ global nonraw keyboard ingress -> D02 Terminal/System/Clear/async tree
├─ byte-exact MOUSE-3-2 before enqueue, from Shift+single Right or Right double click
│  └─ Essential Mouse consumes it and opens System Menu; keep waiting
├─ if the pop-up became deselected, exact MOUSE-1-1 may reselect it instead of enqueueing
└─ event delivered to the pop-up's keyboard-filtering :TYI
   ├─ any character -> dismiss
   ├─ exact queued MOUSE-3-1 -> open System Menu; continue waiting
   ├─ every other mouse or noncharacter blip -> discard; continue waiting
   └─ WINDOW-CALL cleanup
      ├─ current selection is still pop-up/descendant -> restore saved selection
      └─ another selection remains current -> do not override it
```

No C303 pointer click dismisses the diagnostic. The same tree governs its invalid-edge
`POP-UP-FORMAT` call sites. The G85 pop-up instead prompts “Click here or type any
character” and calls raw `:ANY-TYI`, so the first keyboard character or pointer blip
actually delivered to the pop-up dismisses it; globally intercepted pointer encodings
never reach that call, and the exact physical-delivery matrix remains a runtime
oracle. `SE-C46` has no explicit empty-list diagnostic. A selected inferior omitted
from the snapshot is inserted using its live edges.

**Create** incorporates the selected profile's D02 creation registry and constructor
transaction. Its window-type and subordinate choice menus are ordinary any-button
menus: all seven nonzero masks select a row. C46's already-allocated window enters a nonabortable two-corner
initializer: every nonzero mask fixes each corner. At either C303 corner, any
Middle-containing mask aborts, Right alone or Left+Right requests smart placement,
and Left alone places normally. Each C303 smart corner uses the exact depth-first
postorder, per-sheet low/high overwrite, strict 32-pixel delta, and inclusive final
clamp specified in the [C303 Reshape tree](#reshape-staged-trees); this common helper
contract applies independently to both Create corners. Genera uses the same button
precedence but its separate newer geometry helper: Middle-containing
aborts, a Right-containing mask without Middle requests smart placement, and the
remaining Left mask places normally. Nonpositive rectangles become the superior's
full inside rectangle; minimum-size or outside failures beep and restart acquisition.
Construction occurs only after successful geometry in C303/G85. C46's older path
allocates before its initializer, as specified in D02. **Create (expand)** uses a
point picker on which every Left-containing mask accepts the point and every mask
without Left (Middle, Right, or Middle+Right) aborts. It expands a rectangle about
the chosen point while ignoring the exposed inferior already containing it, then
constructs and mouse-selects. Cancel and failure return the later abort sentinel;
C46 Create returns an unchanged normal model.

## Screen Editor lifecycle and transaction model

### Session entry

Preconditions:

- D02 has selected a top sheet;
- the top sheet supplies the required mouse/screen-management substrate; and
- the temporary Screen Editor menu resource can be acquired.

Required order:

1. Save the previously selected window and pointer sheet as entry values.
2. Acquire the temporary Screen Editor menu resource **before** moving the pointer
   context. An acquisition failure therefore occurs before pointer-restoration
   cleanup is established, while the pointer is still unmoved.
3. `SE-C46` captures its initial direct-inferior snapshot after menu acquisition and
   before entering the pointer-restoration unwind scope. `SE-C303` and `SE-G85`
   defer their first snapshot until after the first non-NIL operation choice has
   deactivated the menu.
4. Establish the unwind cleanup, then move the pointer context to the edited top
   sheet. `SE-C46` and `SE-C303` dynamically bind the CADR `WHO-LINE-PROCESS` to
   the current process for the whole menu loop. `SE-G85` instead saves and replaces
   the edited console who-line's forced-process slot within the protected setup.
5. Expose the operation menu near the pointer and repeat the profile-specific choose,
   resnapshot, command, and apply transactions until Exit or a nonlocal transfer. If
   choice returns NIL because the menu was externally deexposed or dismissed,
   re-expose it without invoking a command, snapshotting, rotating history, or
   applying state.
6. In unwind cleanup, restore the saved pointer sheet; unwind the CADR dynamic
   who-line-process binding or, for Genera, restore the exact old console
   forced-process value.
7. On normal exit only, reselect the old window if it and every ancestor remain
   exposed; otherwise ask the edited top sheet to autoexpose inferiors.

An error or external abort still runs unwind cleanup but bypasses the normal
post-unwind reselection branch. A dead saved pointer or selection has no explicit
historical liveness guard and remains `TODO-RUNTIME-SE-CLEANUP-DEAD-OBJECT`.

### `SE-C46` loop

```text
current := snapshot(top-sheet)       // once, at entry
previous := current
loop:
  choice := choose-operation()
  if choice == NIL: re-expose menu; continue
  deactivate-menu()
  result := invoke(choice, top-sheet, current)
  if choice is Exit: leave
  apply(result, old=current)
  previous := current                // unchanged results still advance Undo
  current := snapshot(top-sheet)     // after application
```

The stored model is not every command's sole input. Target hit-testing, Bury, Expose,
Move Multiple, Move Single, and Expand All use its stale rows/edges. Move Window
initializes from the live sheet position and dimensions and writes live dimensions
into its result. Reshape initializes from live offsets/dimensions and calls the live
verifier. Expand Window rereads the live superior, exposed siblings, and target
geometry. Expose-menu, Create, and Kill also enumerate or mutate live objects. An
external geometry change while the menu is exposed can therefore be ignored, read,
or mixed with stale selection/order according to the chosen command; a clone MUST
not substitute either one blanket stale snapshot or one blanket fresh snapshot.
There is no abort sentinel. Cancellation normally returns `current`, so it consumes
the preceding Undo slot.

### `SE-C303` and `SE-G85` loop

The historical loop rotates history based on the preceding result and resamples
immediately before the next command. The equivalent observable contract is:

```text
previous := undefined
command-start := undefined
prior-result := abort-sentinel
first-command := true
loop:
  choice := choose-operation()
  if choice == NIL: re-expose menu; continue
  deactivate-menu()
  under delayed-screen-management with unwind flush:
    if not first-command and prior-result != abort-sentinel:
      previous := command-start
    command-start := snapshot(top-sheet)
    if first-command:
      previous := command-start
      first-command := false
    result := invoke(choice, top-sheet, command-start)
    if result != abort-sentinel:
      apply(result, old=command-start)
  prior-result := result
```

Delayed screen management queues and later flushes management work. It is not a lock
and does not make the command or apply pass atomic. Other processes can mutate live
sheets; callbacks and conditions can escape after partial effects.

Literal abort preserves the older Undo snapshot. A normal return advances history
even if it is NIL, has identical rows, or encodes original edges. In particular:

- initial target cancellation for ordinary later commands normally returns abort;
- C303/G85 Reshape Middle returns original edges and consumes Undo;
- C303/G85 Move Multiple and Move Single cancellation return an unchanged model and
  consume Undo;
- C303 Attributes Abort is caught and returns an unchanged model, consuming Undo;
- G85 Attributes completion with no changes returns an unchanged model and consumes
  Undo; the form's Abort propagation remains an oracle; and
- a C303/G85 Right-start of Move Multiple with a truly NIL movement list is a
  successful no-op and consumes Undo. In C303, a non-NIL retained movement record
  whose four flags are false instead enters movement and can expose the 65,535
  maximum-coordinate sentinel path.

### Snapshot and apply contract

Snapshot traverses direct inferiors in their live order. It includes each exposed
inferior and each deexposed inferior that reports deexposed visibility; it excludes
invisible deexposed inferiors and every nested descendant. The exposure field is the
live exposed predicate result.

Application iterates desired records in order:

1. Find the matching command-start record by live object identity.
2. If its edges differ, C46 sends the new edges directly. C303/G85 first asks the
   window to verify the proposed rectangle.
3. On later-profile verification success, set the edges. On rejection, beep, display
   the returned diagnostic, skip only this record's geometry, and continue.
4. If desired exposure is true and old exposure was false, expose the window. If it
   is `bury-request`, bury it immediately.
5. After all records, make a second pass and bury every desired false record that is
   still exposed.

Objects absent from the desired result are not explicitly killed, deexposed, or
buried by this pass. A rejected geometry does not suppress its exposure action or
later records. An error retains the successfully applied prefix. A portable
all-or-nothing transaction is allowed only as a labeled `INF` safety profile and is
not strict compatibility.

### Undo contract

Undo returns the single previous shallow snapshot and uses the ordinary apply pass.
The command-start state of Undo then becomes the next previous state, so a second
Undo often toggles back. It is not guaranteed to do so because:

- deexposed relative ordering is not exactly represented;
- burying a previously hidden window cannot restore its precise hidden position;
- records retain live object references but not arbitrary object state;
- attributes are outside the model;
- a killed object cannot be resurrected; and
- an object created since the old snapshot is absent, while apply does not explicitly
  bury or destroy absent objects.

Source comments/manual material expect an undone Create to leave the new object
buried, while the apply algorithm has no direct absent-record action and the Genera
menu documentation says Create and Kill cannot be undone. Strict conformance MUST
retain `TODO-RUNTIME-SE-CREATE-KILL-UNDO` rather than selecting a convenient result.

## Screen Editor operation contracts

### Bury, Expose, Expose by menu, Create, and Kill

- **Bury** copies the chosen record, moves it to the model end, and writes the special
  bury request. Application performs the live bury during its first pass.
- **Expose** copies the chosen record, moves it to the model front, and marks it true.
- **Expose (menu)** enumerates live deexposed direct inferiors. C46 modifies only a
  candidate already found in its snapshot; later profiles can construct a fresh row
  for an omitted invisible inferior. Names prefer selection name and then sheet name
  where those protocols exist.
- **Create** and **Create (expand)** delegate to D02 as described in the binding
  section. Screen Editor does not roll back a partially constructed object.
- **Kill** is immediate and unconfirmed in C46. C303/G85 ask for confirmation before
  synchronous destruction. C303's source uses a one-item positive confirmation;
  Genera normally uses a Yes/No menu but can select an older compatibility UI.
  Cancellation does not kill. Once killing begins, deexposure, inferior destruction,
  and dead-state effects are not undone by Screen Editor.

### Move Window

The chosen window's width and height remain constant. Tracking proposes a new
upper-left coordinate and displays an outline; live mutation occurs only through the
profile's eventual validation/application path. C46 clamps only maximum x/y in the
inspected helper, while C303/G85 use a stay-inside positioning box. The tracker first
sends a position-verification request. Rejection beeps and retries. Acceptance merely
returns a model proposal: C46 central apply then sends edges directly, whereas
C303/G85 central apply separately verifies the derived edge rectangle before setting
it. A stateful verifier can therefore accept position but reject or signal on the
later edge operation; in C303/G85 that is a normal command result with skipped
geometry and advanced history. The exact button and coordinate-sampling trees above
are normative.

### Reshape

C46 and C303 acquire two corners. A nonpositive rectangle becomes the entire inside
rectangle. C46 has no pointer cancel in the corner helper. C303 Middle cancellation
beeps and yields the old edges as success. Its smart placement considers exposed
edges with directional distance strictly greater than zero and less than 32 pixels;
it walks exposed inferiors recursively in list order and postorder, including nested
descendants and the edited sheet itself. Within each visited sheet it tests low then
high x edges and low then high y edges; successive eligible edges overwrite earlier
axis values, then x and y are clamped inclusively to `inside-left..inside-right` and
`inside-top..inside-bottom`; the high coordinate itself is allowed. It therefore MUST
NOT be described as a global nearest-edge search. In both older
profiles the lower-right coordinate sampled
shortly after button-down, while release is not awaited, is inside the requested
rectangle: the helper adds one to its x and y coordinates to produce half-open right
and bottom edges. Omitting this conversion makes a clone one pixel too small in each
dimension.

The older reshape helper performs its own geometry verification before it returns a
proposal. Central application is a second stage: C46 directly sends the returned
edges and can signal, while C303 asks the verifier again and can reject the same
edges, skip geometry, continue exposure/later rows, and still advance history. A
stateful verifier therefore makes helper-accept/central-reject observable.

Genera's newer one-corner helper uses the configured active corner, live Shift state,
superior bounding box, and optional smart target. Screen Editor requests calculation
without immediate live movement; central application validates later. The documented
NIL default-corner mode appears able to reach an invalid case because Screen Editor
does not supply a click-derived corner; this is
`TODO-RUNTIME-SE-G85-NIL-RESHAPE-CORNER`.

### Edge movement legality and source defects

The movement precheck requires every changed coordinate to be at least the inside
minimum and strictly less than the inside maximum. Equality with right/bottom maximum
is rejected. It does not independently enforce left less than right or top less than
bottom. C303/G85 central verification can reject an inverted rectangle after other
records have changed; C46 forwards each proposal directly, so the target's
edge-setting behavior decides whether an inverted rectangle is accepted or signals.

Normalized classification ties choose the horizontal boundary because the historical
comparison selects the vertical edge only on a strict lesser x-distance. Exact
midpoints therefore resolve to Right or Bottom after nearest-side selection. A zero-
or negative-extent record cannot satisfy the containing-record guard and is therefore
classified as outside; the later division is unreachable through the selected
application interface absent concurrent or malicious mutation between the guard and
arithmetic. C46 Multiple and C46/C303 Single pass the `:OUT` classification into an
invalid feature path and can signal; Genera ignores outside clicks in the audited
paths. Clearing a final move feature can leave an empty movement record; starting
thereafter can expose a maximum-coordinate sentinel in relative rectangle
construction. These are strict-profile defects, not opportunities to invent silent
repair.

### Expand Window

Expansion is calculated without live mutation:

1. Start with the superior's inside bounds.
2. Scan exposed siblings for nearest left and right blockers that overlap the
   original vertical interval.
3. Adopt the horizontal expansion.
4. Scan exposed siblings for top and bottom blockers using the newly widened
   horizontal interval.
5. Return the resulting edges for central application.

Touching half-open edges do not overlap. Horizontal-before-vertical order is
normative and can differ from a globally maximal empty rectangle. The Genera helper
can return NIL for a window without a superior; the exact Screen Editor downstream
failure is `TODO-RUNTIME-SE-G85-EXPAND-ROOT`.

### Expand All

Only exposed records enter the solver. Deexposed records are appended from the first
false-exposure entry onward, relying on an exposed-prefix ordering assumption.

For each dimension, in horizontal-then-vertical order:

1. Build nearest overlapping blocker sets on each side, retaining ties.
   Orthogonal boundary equality counts as overlap: only strict separation with `>`
   or `<` excludes a candidate.
2. Propose integer midpoint sharing for each gap. A low-side midpoint is
   `low + truncate(gap / 2)`; a high-side midpoint is
   `high - truncate(gap / 2)`. Odd gaps therefore do not use one symmetric formula.
3. Ask affected windows whether candidate edges verify.
4. If both sides can move, share at the midpoint.
5. If the current target cannot move, try growing eligible winners; if a winner
   cannot move, the target may take the whole gap according to the release branch.
6. Propagate accepted winner bounds into cached scratch records so later decisions
   observe earlier ones.

The result depends on snapshot order and verifier responses; it is not an optimizer
and does not promise a unique or globally maximum tiling. C46 and C303 differ when
there is no winner. C303 still verifies the midpoint and performs no scratch change
when it rejects. C46 skips midpoint verification in that branch and tries the full
boundary; even if that rejects, it writes the **unverified** midpoint into its scratch
proposal, which the later direct apply sends to the target. C303 central apply
verifies again and can still produce a partial result.

### `SE-C303` Attributes

The fixed form first probes optional capabilities in the exact order border, label,
then name. It then sends ten unconditional base getters, in order, for current font, More,
reverse-video, vertical spacing, deexposed input action, deexposed output action,
character ALU, erase ALU, priority, and save bits. Next it sends the applicable
conditional getter for name or label, then border specification, then border-margin
width; normalizes the staged values; and, while constructing the form, obtains the
font map. It presents the following exact displayed rows and value mappings:

| Order | Displayed caption | Editor and displayed choice -> stored value |
| ---: | --- | --- |
| 1 | `Current font` | Association choices in font-map array order; each unique non-NIL font contributes `FONT-NAME(font) -> font` |
| 2 | `More processing enabled` | `Yes -> T`; `No -> NIL` |
| 3 | `Reverse video` | `Yes -> T`; `No -> NIL` |
| 4 | `Vertical spacing` | Number |
| 5 | `Deexposed typein action` | `Wait until exposed -> :NORMAL`; `Notify user -> :NOTIFY` |
| 6 | `Deexposed typeout action` | `Wait until exposed -> :NORMAL`; `Notify user -> :NOTIFY`; `Let it happen -> :PERMIT`; `Signal error -> :ERROR`; `Other -> :OTHER` |
| 7 | `"Other" value of above` | S-expression; always displayed |
| 8 | `ALU function for drawing` | `Ones -> ALU-IOR`; `Zeroes -> ALU-ANDCA`; `Complement -> ALU-XOR` |
| 9 | `ALU function for erasing` | Same three mappings as drawing |
| 10 | `Screen manager priority` | S-expression |
| 11 | `Save bits` | `Yes -> T`; `No -> NIL` |
| 12 | `Name of window` or `Label` | String; Name is used when Set-Name is supported, otherwise Label when Set-Label is supported; omitted if neither |
| 13a | `Width of borders` | Number; present only with border capability |
| 13b | `Width of border margins` | Number; present only with border capability |

Only the name/label and border getter groups are capability-gated. The Other row is
not fetched: it starts as local NIL and receives the original object during
normalization when an old output action is not one of the standard choices. In that
case the displayed action becomes Other, so leaving both untouched sends nothing.
Editing the Other row has setter effect only while output action is Other; changing
away from Other clears it and refreshes the form. Reverse-video editing also stages
coherent character and erase ALUs.

Normalization preserves the original getter object in each `OLD-*` slot. If the
border specification is a cons whose CAR is NIL or `:ZERO`, the staged width is 0;
otherwise it is `(FOURTH (FIRST old-spec)) - (SECOND (FIRST old-spec))`. Because the
old slot remains the cons, an untouched cons border normally compares `NEQ` with that
number and deterministically sends `:SET-BORDERS`. If a Name or Label getter returns
a cons, the displayed/staged string is its SIXTH. An untouched Name cons therefore
compares `NEQ` and sends `:SET-NAME` with the extracted value. An untouched Label cons
also compares `NEQ`; commit mutates the old cons's SIXTH and sends that same cons via
`:SET-LABEL`.

Done detects change with object identity (`NEQ`), not value equality, then sends only
changed setters sequentially in the listed order; failure leaves the setter prefix.
Attributes are outside Screen Editor Undo.

### `SE-G85` Attributes

Genera asks the target for attribute queries under Dynamic Windows Accepting Values.
Applicable methods combine most-specific-last and append message/value pairs. Base
families cover more processing, reverse video, spacing, deexposed input/output
actions, draw/erase ALUs, priority, and save bits; border, label, name, graphics, and
other mixins extend the list. This is an extensible target protocol, not a fixed
catalog.

After Done, Screen Editor sends each message/value pair in returned order. An odd
list supplies NIL for the final missing value. An error in a later setter retains all
earlier sends. No attribute send is represented in the geometry snapshot and Undo
cannot reverse it.

## Frame-Up lifecycle and program contract

### Program framework and persistence

The selected program is internally `layout-designer` and visibly named **Frame-Up**.
It registers Select `Q` and the System Menu/activity name **Frame-Up**, supplies a
command definer, and disables local keyboard accelerators. Its local command table
inherits from no other command table.
Its top level binds the stored package only when non-NIL, resolves it before
entering the default command top level, and can therefore fail before the command
loop on a stale package name.

Its real framework panes are:

| Pane | Type and role | Required behavior |
| --- | --- | --- |
| `TITLE` | Title pane | Display exactly `Layout for program <program>`; the source's configuration-name text is commented out |
| `DISPLAY` | Typeout-capable display pane | Render the private layout simulation and presentations |
| `INTERACTOR` | Command Processor interactor | Parse typed named commands and missing arguments |
| `COMMAND-MENU` | Two-column command menu | Display the exact ten-cell inventory and standard left/right handler behavior |

Instance initialization creates one private `:DISPLAY` leaf. Done deselects rather
than killing or resetting the program, so direct reselection retains model and program
settings. Reset Configuration resets only the pane tree.

### Pane construction and naming

Creating a normal leaf:

1. Look up the exact registered type identity.
2. Merge its default initialization property list with supplied options.
3. Remove options not present in that type's editable allowed list.
4. Generate a name from a root and a decimal suffix.
5. Initialize an empty inferior list, superior link, and vertical stacking direction.

The helper always appends `-N`, even when the caller supplies a name root. Unique
naming traverses the current top tree in preorder, parses decimal suffixes sharing
the root, and returns one greater than the maximum. Set Pane Name does not enforce
uniqueness. Detached standard-layout construction can therefore generate duplicate
names because the incomplete siblings are not yet reachable from `top-pane`.

The typed `layout-pane` parser suggests leaves only, permits no arbitrary input, and
prints the pane name. That parser restriction is not an invariant on programmatic
calls or presentation translators: Middle can supply an internal node, and Delete
can receive one through a nonstandard call.

## Frame-Up pane-type registry

Registry entries contain `(type-name, allowed-option-list, default-init-plist)`.
Lookup uses type identity. A new name is pushed to the front; replacing an existing
name keeps that entry's position. The effective enumeration order is mutable and
reverse-biased by fresh registrations.

| Type | Allowed editable options | Default model options after pruning |
| --- | --- | --- |
| `:INTERACTOR` | typeout window, automatic typeout removal, height in lines | height 4; other runtime traits are not all retained as editable options |
| `:LISTENER` | typeout window, automatic typeout removal, height in lines | no editable height default in the inspected registry |
| `:COMMAND-MENU` | menu level, rows, columns, centering, equalized/compressed columns, extend width | top-level menu |
| `:TITLE` | redisplay function, redisplay string, redisplay after commands, height, size from output | height 1; after commands false |
| `:DISPLAY` | flavor, redisplay function/string, incremental, after commands, typeout, automatic removal, height, size from output | no editable defaults survive pruning |
| `:ACCEPT-VALUES` | accepting function, query independence, changed-value/default policy, program-modifies-state, after commands, typeout, automatic removal, size from output, height | accepting function; false query independence; false changed-value default; true program modification; true size from output; true after commands |
| `:TREE-BROWSER` | height, size, margins; root/root function/open branches; leaf predicate/style; branch description, walker, style, comparison, inferiors, and data | registry-specific tree defaults; options named below remain excluded |

The public manual's six-type list is incomplete for this profile: the source registry
also contains `:TREE-BROWSER`. Tree-style, leaf-description, and branch-printer
metadata/slots exist elsewhere but are commented out of Frame-Up's allowed list and
MUST NOT be presented as editable options. A generated tree browser has its own
branch-open interaction, but that belongs to the generated pane and is not a
Frame-Up-owned binding.

When generated code instantiates a Tree Browser, its pane implementation requires
exactly one of a direct branch-inferiors function or the pair of leaf predicate and
tree walker; exactly one of literal root or root function; and branch data. It
reinitializes supplied open-branch state to a root-only state. These are generated
pane constraints, not extra Frame-Up commands or gestures.

## Frame-Up graphical simulation

### Top box and coordinates

The renderer computes a top model rectangle whose width is two thirds of the display
pane's inside width. Its height preserves the current screen aspect ratio, and the
rectangle is centered using display viewport coordinates. Each node receives a
half-open box. Rendering decrements right and bottom for the visible hollow border.

Every node is emitted as a nested `layout-pane` presentation and hollow rectangle.
Leaves center the text `NAME  :TYPE`. Pane options are not drawn. Thus internal
border-only regions can expose an internal presentation while leaf interiors usually
select the innermost leaf; exact Dynamic Windows nested-presentation tie breaking is
incorporated from D28 and remains a runtime dump obligation for this app.

### Partition algorithm

For each internal node:

1. Use its stacking direction to select horizontal or vertical extent.
2. Compute a simulated fixed extent only for children whose type has a registered
   simulation size function.
3. Subtract fixed extents from the parent's available extent.
4. If there is at least one unconstrained child, divide the remainder equally among
   those children using integer floor.
5. Give the reverse-accumulated/source-last unconstrained child the ceiling/remainder
   so the final edge reaches the parent's terminal edge.
6. Assign child boxes in source order and recurse.

The fixed scale is 20 pixels per simulated character unit. Command-menu vertical
size uses explicit rows, then list length, then a two-row default; horizontal size
estimates ten average characters per column. Interactor and Display use vertical
height-in-lines; Title defaults to one line. Listener, Accept Values, and Tree Browser
have no special simulation size function in this source.

There is no general overconstraint rejection or clipping rule. When every child is
fixed, no division occurs: children are laid out in order using their computed sizes,
even when their final edges escape the parent. When fixed children leave a negative
remainder and unconstrained children exist, their computed shares can likewise be
negative; no clipping or rejection repairs the result. The renderer is a simulation,
not the real constraint-frame layout engine and not a WYSIWYG compatibility claim.

## Frame-Up command contracts

### Split Pane

Inputs are a leaf pane and `Horizontally` or `Vertically`. Human **Horizontally**
means a horizontal divider and a vertical stack/private column; **Vertically** means
a vertical divider and a horizontal row.

Required order:

1. Reject a pane that already has inferiors.
2. Allocate a new `:DISPLAY` sibling with a NIL superior.
3. Set the selected pane's stacking-direction field to the inverse of the requested
   parent direction.
4. If the current parent already has the requested private orientation, set the new
   sibling's superior backlink to that parent **before** checking membership, then
   find the selected child and insert the sibling immediately after it.
5. Otherwise allocate an empty hidden parent, set its superior to the selected
   pane's old parent, set the selected and sibling backlinks to that new parent, set
   the new parent's inferiors to `[selected, new]`, then substitute the new parent
   into the old parent or make it the root.

The stored stacking-direction is used when that node lays out inferiors and during
promotion; the Split command never reads it to choose a later split. The dossier's
former suggestion of automatic next-split alternation is not part of this contract.

If a corrupt matching parent does not contain the selected child, failure occurs
after the new pane was allocated, the selected stacking-direction field changed, and
the sibling backlink was set to that parent. In the nonmatching-orientation branch,
substitution does not signal when the old parent omits selected: its inferior list
remains unchanged while the already-linked new subtree is detached and the new
parent still points back to that old parent. There is no rollback.

### Swap Panes

Swap requires two distinct siblings under the same non-NIL parent. The same object,
the top pane, or different parents causes a beep and explanatory message with no
intended mutation. Valid swap replaces through a temporary marker so object names,
types, options, and descendants move with their identities. The historical function
does not first prove that each object occurs exactly once in the parent list; corrupt
or duplicate state remains an oracle/safety-profile boundary.

### Delete Pane

Deleting the only/root pane prints a refusal without beeping. Otherwise:

1. Destructively remove the pane from its parent's inferior list.
2. If zero or two-or-more siblings remain, stop.
3. If exactly one remains, promote it through the hidden parent.
4. With a grandparent, substitute the survivor and set its superior backlink; set
   its stacking direction to the inverse of the grandparent's stored direction.
5. Without a grandparent, make the survivor the new top pane.

The deleted pane's old superior link and the collapsed parent's backlinks are not
cleared. For a stale/nonmember pane, destructive deletion leaves the parent's
inferior members unchanged. The code nevertheless continues by list length: an
unchanged one-member list promotes its sole member, while zero or two-or-more stops.
If the target really was the sole member, deletion leaves zero and therefore stops
without collapsing. These malformed-state outcomes are strict source-profile
behavior; proactive membership rejection is allowed only in a labeled `INF` safety
variant.

### Set Pane Options and Set Pane Name

Set Pane Options edits a copied options list inside resynchronizing Accepting Values.
It commits the pane's name, type, and options only after successful form exit.

- Changing type replaces options with that type's defaults; switching back during
  the same form restores the original options.
- Redisplay mode is None, String, or Function. Each removes incompatible keys;
  Function additionally exposes incremental redisplay. Title may temporarily gain
  incremental state in the form, but generation filters it out because the type does
  not allow that key.
- Command-menu geometry is Default, Rows, or Columns. Rows wins if a corrupt input
  contains both. Numeric entry defaults to 1; content mode edits existing strings
  and exposes one append slot.
- An allowed option without specialized metadata falls back to expression input.
  Flavor is stored raw; most nonconstant expressions are quoted.
- Rename has no uniqueness check.
- An internal row/column reaches a missing registry entry and can fail before commit.

Set Pane Name directly assigns the supplied symbol and redisplays. The menu-only
translator returns an inactive partial command so name acquisition precedes that
assignment.

### Set Program Options

The form edits only:

- generated program name;
- optional generated Select key;
- whether to generate a command-defining macro;
- generated command-table keyboard-accelerator policy; and
- inherited generated command tables.

It does not expose the stored package, configuration name, or program state
variables. The attempted state-variable editor is commented out as unsatisfactory.

### Select Configuration and Reset Configuration

The standard-layout registry replaces matching names case-insensitively in place and
pushes new names to the front. The two built-ins are:

| Visible registry name | Exact constructed child order |
| --- | --- |
| `title display command-menu interactor` | Title, Command Menu, Display, Interactor |
| `command-menu listener` | Command Menu, Listener |

The first name and its actual source child order disagree; a conformer MUST preserve
the exact order rather than infer it from the label.

Both commands beep before destructive confirmation. No retains the tree. Yes sets
`top-pane` to NIL before expansion or replacement; allocation, naming, or registry
failure thereafter leaves NIL or a partial detached structure. Reset builds one
Display leaf and does not reset program options. Select expands the selected dynamic
registry description and is exposed to the duplicate-name defect described above.

### Generated form

Generation first scans all nodes. If any node is `:ACCEPT-VALUES`, it adds the string
`accept-values-pane` to the stored inherited-command-table list. This is a sticky
model mutation: deleting all Accept Values panes later does not remove it.

It then returns one `DEFINE-PROGRAM-FRAMEWORK` form containing:

1. the program symbol;
2. optional generated Select key;
3. command-definer policy;
4. inherited table names, converting table objects to names while retaining strings;
5. generated command-table accelerator policy;
6. state variables;
7. leaf pane descriptions only, filtered against current allowed options; and
8. exactly one quoted configuration.

It omits Frame-Up's own pretty name, System Menu registration, top level, and stored
package. Multiple generated configurations are unsupported. Private row/column
nodes appear only in recursive layout. The top internal node is named with the
configuration name. An unsplit leaf uses the release-7 fallback of a one-column
layout and one even-sized member.

Size selection precedence is explicit height-in-lines, then size-from-output as an
ask-window constraint, then even. Within each generated size clause, all explicit
sizes are emitted before the separator and all even panes after it, while the layout
child order itself remains unchanged.

### Preview

Preview is not a sandbox:

1. Generate the form, including any sticky inheritance mutation.
2. Evaluate it with definition and framework redefinition enabled, changing the real
   named program in the current Lisp world.
3. Acquire or reuse a temporary processless program frame beneath Frame-Up's
   superior.
4. Enter protected window-call cleanup that deactivates the temporary frame on exit.
5. Bind terminal, query, and standard streams, clear query input, and print each
   parsed pane name into its pane.
6. Read one arbitrary character. The prompt requests Space, but Space is not
   enforced.

Preview does not run the generated program's top level. Generation, evaluation,
construction, redisplay, or stream errors can retain the real definition and sticky
model mutation. Resource cleanup deactivates the temporary frame but supplies no
semantic rollback.

### Done

Done commits in this order:

1. Generate the form.
2. Replace the matching program-symbol result in place or push a new result first.
3. Increment the global result tick.
4. Deselect Frame-Up.

It performs no file or world save. A generation/storage failure prevents tick and
deselection, although sticky Accept Values inheritance may already have happened.
A deselection failure leaves result and tick committed, so editor waiters can wake.
There is no lock or rollback.

## Frame-Up Zmacs integration

### Shared insertion behavior

Insertion prints one form through a presentation-recording interval stream under the
current package/readtable, downcases for a lowercase buffer, pushes the old point,
and leaves point after the form. It does not explicitly append a newline.

Each calling command selects Frame-Up before invoking the wait helper. After that
selection returns, the helper displays a Control-Abort continuation message,
snapshots the global result tick, waits for a greater tick, and inserts the first
global result. The helper itself never selects Frame-Up. This creates three
normative source-visible races:

- a fast Done before the tick snapshot can be missed, causing a wait for another
  Done;
- multiple waiters share one tick and can all wake together; and
- there is no caller/program correlation, so the first result can belong to another
  program.

### Create Program Definition

This command requires an existing Frame-Up window, reads a program name through
general typein, creates a new Display pane before replacing `top-pane`, resets only
program name, package, and root pane, asynchronously clears the frame, resets its
process, selects it, waits, and inserts. Configuration name, command settings, state
variables, and other stored options persist. Because naming scans the old tree, a
reused designer can start the new model at a suffix greater than 1.

### Insert Program Definition

This command errors when the result list is empty. Otherwise it chooses a retained
program, defaulting to the first, finds it by symbol identity, and inserts its stored
form.

### Edit Program Definition

The command reads the enclosing definition interval and requires a
`DEFINE-PROGRAM-FRAMEWORK` head, but compares against only the first retained result
and the same program identity. It does not parse the buffer form back into a model.
It warns that source-added options will be lost, edits will revert, and deletions
will reappear; refusal aborts the Zmacs command. On acceptance it selects retained
designer state, waits globally, deletes the old interval, then inserts the newest
first result. Insertion failure can therefore leave the original code deleted.

### Edit Program Redisplay Function

This command accepts any symbol that names a program; it does not choose from or
require a retained Frame-Up result. It calls the program-instantiation operation,
chooses among panes that have an explicit redisplay function, and invokes the editor
on that function. Absence of such a pane/function is an error. Instantiation can
itself have side effects or fail.

Replacement of a result preserves its old list position while new names are pushed
first. Therefore “latest per program name” MUST NOT be conflated with “first result”
in the wait/edit paths.

## Cross-subsystem ordering and failure matrix

| Transaction | Required order | Commit point | Abort/error result |
| --- | --- | --- | --- |
| C46 Screen Editor command | stored model plus command-specific live reads -> command -> direct apply -> history rotation -> resnapshot | first live window effect | unchanged model still consumes Undo; errors retain prefix |
| C303/G85 ordinary command | menu deactivate -> fresh snapshot -> command -> non-abort apply | first live window effect | literal abort preserves history; normal no-op consumes it |
| C303/G85 apply row | verify geometry -> set if valid -> exposure/bury -> later rows -> false-state bury pass | each individual send | rejection skips one geometry only; exposure and later rows continue |
| Attributes | collect/stage -> Done -> sequential setters | first setter send | later error retains setter prefix; never part of Undo |
| Frame-Up split | allocate sibling -> mutate selected direction -> matching-parent backlink/membership/splice, or empty-parent allocation/superior/backlinks/inferiors/substitution | parent/root splice, with earlier partial state possible | matching omission signals after sibling backlink; nonmatching omission silently leaves detached linked subtree |
| Frame-Up delete | destructive list replacement -> length test -> promote only at exactly one survivor | parent list replacement | stale member can trigger unrelated sole-child promotion; zero or multiple survivors stop; old backlinks remain |
| Frame-Up Select/Reset | beep -> confirm -> clear root -> construct | new root assignment | No unchanged; construction error can leave NIL |
| Generate | scan -> sticky Accept Values inheritance -> build form | inherited-list mutation can precede returned form | later error can retain sticky mutation |
| Preview | generate -> eval real definition -> acquire frame -> display -> read character | definition evaluation | resource deactivates; definition/model effects remain |
| Done | generate -> store/replace -> tick -> deselect | result store, then tick separately observable | later failure retains committed prefix |
| Zmacs Edit | validate/warn -> select/wait -> delete interval -> insert | interval deletion before insertion | insertion failure can leave source removed |

### Failure and recovery rules

- Unknown/stale live windows are not proactively validated by the historical Screen
  Editor. An `INF` safety profile MAY reject them before mutation but MUST disclose
  the changed race behavior.
- C303/G85 invalid geometry produces a beep and diagnostic and continues where the
  relevant helper or central apply says to continue. It is not a transaction abort.
- Menu dismissal, literal Abort, successful unchanged result, and escaping condition
  are distinct outcomes and MUST NOT be normalized.
- Frame-Up commands mutate ordinary in-world model objects without a transaction log.
  No command supplies Undo.
- Accepting Values form exit can be transactional for its copied local option list
  while subsequent target setters or Frame-Up tree mutation remain nontransactional.
- Every abnormal exit MUST perform only the cleanup established for its dynamic
  resource scope; it MUST NOT invent semantic rollback.

## Release deltas and witness disagreements

| Topic | `SE-C46` | `SE-C303` | `SE-G85` / `FU-G85` |
| --- | --- | --- | --- |
| Screen Editor menu | 13 entries | 15; Undo/Exit last | 15; Exit/Undo after Kill; labeled/styled |
| Command snapshot | Entry/previous result, then postapply resnapshot | Fresh before command | Fresh before command, console-relative |
| Abort sentinel | None | Many initial paths | Many initial paths, not all later cancels |
| Geometry apply | Direct set | Per-row verify, partial continuation | Per-row verify, partial continuation |
| Move Window final Right | Accepts any button | Accepts Right unless Middle also held | Right aborts |
| Reshape | Any-button two-corner, no abort | Two-corner, Middle old-edge no-op, Right smart | One-corner, Shift, bounding box, Right smart |
| Attributes | Absent | Fixed variable-value form | Target-delegated Accepting Values |
| Target ancestry | Basic frames without exposure filter | Exposed basic frames; pair-membership defect | Editable exposed ancestors, fixed deduplication |
| Frame-Up | Absent | Absent | Separate Dynamic Windows program |

The MIT manuals broadly say Middle or Right aborts, but the implementation-specific
trees above contain Right acceptance, start, smart placement, and final commit paths.
Source controls those profiles. The System 303 manual also preserves an older menu
order and omits Attributes; source and the reviewed runtime agree on the 15-item
order specified here.

For Genera Frame-Up:

- source, Workbook, and runtime establish Select `Q`;
- an extracted installed User's Guide record says Select `T`, which is stale or
  conflicting for this exact profile and is not normative;
- the manual lists six pane types while source has a seventh Tree Browser and an
  extensible registry;
- the manual's inherited-table description differs from the exact three stored
  defaults in source;
- the public chapter lists three Zmacs commands while source installs a fourth,
  Edit Program Redisplay Function; and
- the built-in layout label says `title display command-menu interactor`, while the
  constructed child order places Command Menu before Display.

An optional safety-corrected implementation MAY add stale-reference checks, model
validation, atomic staging, unique-name enforcement, per-caller result correlation,
or rollback. It MUST expose that as an `INF` profile and MUST retain strict-profile
tests for the historical order and partial effects.

## Bounded visual reference

These images constrain only the visible regions and states named beside them. They
do not establish invocation routing, object identity, hidden geometry, command
algorithms, mutation, Undo, menu-handler availability, generated forms, or cleanup.
Each exact reuse is separately reviewed in the
[screenshot publication-rights record](screenshot-publication-rights-review.md#d03-screen-editor-and-frame-up-specification-reuse-reviewed-2026-07-19).

### `SE-C303` operation menu

![System 303 Screen Editor menu showing all fifteen operations and Reshape pointer documentation.](assets/mit-cadr-screenshots/screen-editor-menu.png)

*Runtime observation: the complete System 303 Screen Editor operation menu after
Edit Screen, captured 2026-07-18 without a geometry command. MIT and other underlying
interests remain with their rightsholders; reproduced for criticism, scholarship,
and historical documentation under 17 U.S.C. section 107. No affiliation or
endorsement is implied.*

The strict visible profile MUST be capable of displaying one temporary 15-item menu
in the captured order over the selected screen, with the highlighted item and its
bottom pointer documentation. The image does not define a general CADR font or
pixel-perfect desktop profile.

| Capture field | Value |
| --- | --- |
| Session | `layout-tools-20260718`, generation 1 |
| Guest | Experimental System 303.0, ZWEI 129.0, microcode 323 |
| Action | Open live System Menu; select Edit Screen; hover Reshape; execute no geometry command |
| Curated PNG | 768 by 963; 4,688 bytes; SHA-256 `87cb86efce54505176e82157a09aab6a0ba693359012afefc02f33e01c525c6e` |
| Normalized pixels | SHA-256 `12f8b164a5105aa996f480d8f8631c27ae5cdc214961b0afb34ba90c3a6d44b3` |
| Final run record | SHA-256 `794a35bb1223a152e0f9093d39d577fc7bccd55c002fe27ed53d159749d519dd` |
| Shutdown | Clean; public base disk unchanged |

### `SE-G85` operation menu

![Genera 8.5 Screen Editor menu showing its title, fifteen operations, styling, and Undo documentation.](assets/genera-screenshots/screen-editor-menu.png)

*Runtime observation: the complete Genera 8.5 Screen Editor menu after Edit Screen,
captured 2026-07-18 before exiting without mutation. Symbolics and other underlying
interests remain with their rightsholders; reproduced for criticism, scholarship,
and historical documentation under 17 U.S.C. section 107. No affiliation or
endorsement is implied.*

The strict visible profile MUST provide the **Screen Edit Operation** label, exact
15-item order, visible grouping and emphasis, current-item feedback, and bottom
operation documentation. Surrounding Listener/debugger text is incidental session
context and is not a Screen Editor requirement.

| Capture field | Value |
| --- | --- |
| Session | `debuggers-d12-genera-20260718`, generation 2 |
| World | `Genera-8-5.vlod`, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Action | Open live System Menu; select Edit Screen; hover Undo; later Exit without mutation |
| Curated PNG | 1200 by 900; 14,224 bytes; SHA-256 `c917789c97344cd4b0a5e23ffa0949b3292b197a76a105d96933e90e9992231d` |
| Normalized pixels | SHA-256 `1c2ba250dffe05ce195acb029cc1748c0053a049e7da7ef3ff1851ec31a620e0` |
| Capture prefix | 76 records; SHA-256 `477e0cbbd983afb4e7f162e29bb1020ff6cb660860885e63c22340d2c9ce0c30` |
| Full action log | 80 records; SHA-256 `c865f298f1710ffd67237ed52a6a7abd8fc72dba38e37a6b8387483e09b96386` |
| Final record | SHA-256 `e83a9a7896b44b028d115f0da452b35f38d841bfeead1b805439814984688e03` |
| Shutdown | Confirmed cleanup entered; known Cold Load stall required bounded host stop; no Save World; world unchanged |

### `FU-G85` two-pane model

![Frame-Up after the typed command Split Pane PANE-1 Horizontally produced two equal display-pane boxes.](assets/genera-screenshots/frame-up-split-layout.png)

*Runtime observation: Genera 8.5 Frame-Up after a researcher-requested horizontal
split of the default pane, captured 2026-07-18. Symbolics and other underlying
interests remain with their rightsholders; reproduced for criticism, scholarship,
and historical documentation under 17 U.S.C. section 107. No affiliation or
endorsement is implied.*

The strict visible profile MUST provide a title region, graphical layout region,
interactor, and ten-cell two-column menu. After the typed command shown, it MUST
render two labeled `:DISPLAY` leaves, `PANE-1` above `PANE-2`, separated by a
horizontal divider. The image constrains this unconstrained two-leaf case only; it
does not make the simulator a pixel-exact constraint engine.

| Capture field | Value |
| --- | --- |
| Session | `layout-tools-20260718`, generation 1 |
| World | `Genera-8-5.vlod`, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| Action | Select Q; type `Split Pane PANE-1 Horizontally`; capture; choose Done |
| Curated PNG | 1200 by 900; 2,940 bytes; SHA-256 `74925b70d33db0041b024d9fd68c2132d10f071839fc9cd688d09c0385966bb0` |
| Normalized pixels | SHA-256 `c74dcb59fac25239f723eb3be43327c39866f6a1533fe2838a8b2f94bb51b90a` |
| Capture prefix | 26 records; SHA-256 `ff67d57b9d36482395c5d5afc288bf7fd6aa86d9919593171882d927e3fbd2c9` |
| Full action log | 28 records; 13,301 bytes; SHA-256 `0e8cc59f1dda23f0f34484911ade97928b986c55dcbdd54f4d79507e85a42e24` |
| Final record | SHA-256 `90171c2f3881211b699160ccf43a11010fef820111ca549635496ce252536956` |
| Shutdown | Confirmed shutdown accepted; known stall required bounded host stop; no Save World; world unchanged |

The action prefix also records a Left click in apparent pane whitespace with no
visible split and a Right click that opened a generic Operation menu. Because the
presentation hit region and menu contents were not captured completely, those are
oracle obligations rather than contradictory requirements.

## Reference semantic protocol inventory

This table names implementation-independent operations. It is not an exact
historical callable API.

| Operation family | Inputs | Result/effect | Failure behavior | Evidence |
| --- | --- | --- | --- | --- |
| Select edit root | frozen/direct sheet, button path | one top sheet | cancellation or target-finder profile defect | `SUBSTRATE`, per-profile source |
| Snapshot inferiors | top sheet | ordered WindowRecord list | stale refs remain possible | per-profile source |
| Pick record | model, point, button mask | first containing row or no target | half-open miss; no Left means no target | same |
| Apply model | old and desired lists | sequential live geometry/exposure/order effects | per-row reject/condition can leave prefix | same |
| Undo | previous shallow snapshot | ordinary model application | incomplete hidden order; dead/new object gap | same |
| Bury/Expose | chosen row | reordered proposed list | target abort/no-op profile rules | same |
| Expose hidden | chosen direct inferior | fresh/front exposed record | empty/cancel profile rules | same |
| Create | type and geometry | new selected live window | D02 allocation/constructor partial effects | `SUBSTRATE` |
| Kill | target and confirmation | dead object removed from proposal | irreversible prefix | per-profile source |
| Move | target and new origin | same size, proposed new rectangle | button/verify retry profile rules | same |
| Reshape | target, active corner(s), modifiers | proposed rectangle | successful old-edge cancel in later profiles | same |
| Classify feature | point and record | edge/corner/outside | nonpositive record classifies outside; profile-specific ignore/error follows | same |
| Associate feature | selected feature and model | one-hop coincident additions | off-toggle does not propagate | same |
| Move feature set | selections and delta | proposed row set | bounds precheck then partial central verify | same |
| Expand one | record and exposed siblings | horizontal-then-vertical rectangle | root/no-superior gap | same |
| Expand all | ordered exposed prefix | verification-sensitive tiling proposal | no global optimum or atomicity | same |
| Edit attributes | target-generated or fixed queries | sequential setters after Done | later failure retains prefix | same |
| Register pane type | name, allowed keys, defaults | mutable registry entry | replacement retains position | `G85-S452.22` |
| Construct pane | type, root, options | pruned LayoutPane | missing registry/type error | same |
| Split/Swap/Delete | model pane identities | in-place tree mutation | validation messages or partial corrupt-state effects | same |
| Simulate layout | pane tree and viewport | nested boxes/presentations | fixed overflow and negative unconstrained extents remain unclipped | same |
| Generate framework | Frame-Up model | one definition form | sticky inheritance can precede error | same |
| Preview | generated form and character | real redefinition plus temporary display | definition remains after later error | same |
| Done | generated form | remembered result, tick, deselection | ordered partial commit | same |
| Zmacs bridge | editor context and global results | insertion/replacement or ED | missed wake, wrong first result, deletion-before-insert | same |

## Exact source-interface and module closure

`L3` is reserved. The evidence closes behavior, but this document does not inventory
every package export, flavor component order, method combination, lambda list,
multiple-value convention, condition, restart, macro expansion, module dependency,
or load-time side effect required for unmodified historical source compatibility.

| Selected module | `L2` coverage | Missing `L3` closure |
| --- | --- | --- |
| C46/C303/G85 Screen Editor file | Semantic records, operation inventory, staged input, algorithms, apply and cleanup | Exact public/private symbol inventory, callable signatures, flavors, menu resource API, conditions, load order |
| D02/TV dependencies | Incorporated behavior named above | Complete cross-module historical API and scheduler ABI |
| Genera layout designer | Program state, pane model, commands, translators, renderer, generation, Zmacs bridge | Exact macro grammars, expansion, class/flavor precedence, namespace/export and condition surface |
| Program-framework pane registry | Seven selected types and option metadata | Every runtime-added type and exact pane implementation API |
| Dynamic Windows dependencies | Incorporated CP/Input Editor/presentation behavior | Full Dynamic Windows source compatibility remains in D28's reserved level |

A future `L3` claim MUST enumerate packages/namespaces, every selected public and
private operator kind and complete signature, defaults, all return and multiple
values, conditions/restarts, presentation type grammars, flavor/class precedence,
module/load order, aliases, and runtime registrations, then compile unmodified
selected historical clients. File names or symbol presence alone are insufficient.

## Conformance test suite

Every run records profile, exact artifact or implementation revision, clean fixture,
logical input trace including complete button masks/modifiers, semantic event trace,
final model/live state, diagnostics, and pixels only where the visible claim applies.

### Screen Editor core and bindings

| ID | Profile/level | Setup and action | Objective pass condition |
| --- | --- | --- | --- |
| `D03-SE-001` | all/L0 | Instantiate menu | Exact profile item count, order, label, styling, and documentation metadata |
| `D03-SE-002` | all/L1 | Inject all seven nonzero button masks with every available modifier over each ordinary menu item and blank interior | Every item dispatches independent of mask/modifier; blank does not dispatch; no double-click branch |
| `D03-SE-003` | all/L1 | Exercise D02 Edit Screen Left, Middle, Right, and every chord | Direct/finder path and highest-button precedence match profile tree |
| `D03-SE-004` | all/L0 | Mix exposed, visible-deexposed, invisible-deexposed, inactive, and nested sheets | Snapshot contains exact ordered direct-inferior subset |
| `D03-SE-005` | all/L1 | Overlap rows and test each half-open boundary with all button masks | First containing row and Left-containing acceptance match contract |
| `D03-SE-006` | C46 vs C303/G85 | Mutate live geometry while the menu is exposed; then exercise stale-row selection/Bury/Move Multiple/Expand All and live-read Move/Reshape/Expand/Expose-menu paths | C46 exact stale-model/live-helper matrix matches; later profiles take a fresh command-start snapshot while retaining their specified live helper reads |
| `D03-SE-007` | C303/G85/L1 | Return literal abort versus identical copied model after a prior move, then Undo | Only literal abort preserves prior Undo target |
| `D03-SE-008` | all/L2 | Inject a geometry failure in second of three desired rows | C46 direct behavior or later skip-one geometry; exposure/later rows and prefix match profile |
| `D03-SE-009` | all/L2 | Expose, bury, deexpose, then Undo twice | Geometry/exposure and documented hidden-order limitations are exact |
| `D03-SE-010` | all/L2 | Create then Undo; Kill then Undo | Resolves absent-created/dead-record behavior without resurrection assumptions |
| `D03-SE-011` | all/L1 | Menu-acquisition and initial-snapshot failure; normal Exit; command/apply error; dead old selection or pointer sheet | Pre-unwind failure prefix, pointer/who-line restoration, and normal-only reselection match contract |
| `D03-SE-012` | all/L1 | Dump effective raw/nonraw/super-image, global prefix, numeric/minus/reset, asynchronous, Help, intermediate-queue/selected-buffer, pointer, and menu trees before and after selection changes | Empty app keyboard map plus exact mode, profile-global, and enqueue/read-time-owner routes are isomorphic to this specification; site entries retain recorded owners |
| `D03-SE-013` | C46/C303/G85/L1 | Cause the operation chooser to return NIL after a useful Undo state | Menu re-exposes with no command, snapshot, history rotation, or apply effect |

### Screen Editor commands and geometry

| ID | Profile/level | Setup and action | Objective pass condition |
| --- | --- | --- | --- |
| `D03-SE-020` | all/L1 | Bury/Expose target with every button mask and overlap fixture | Correct target, proposed order/exposure marker, abort/no-op history behavior |
| `D03-SE-021` | all/L1 | Expose-menu populated, empty, dismissed, and omitted-snapshot candidate; inject every keyboard/pointer class into the empty diagnostic | Choice construction, C303 `:TYI` keyboard-only versus G85 delivered-`:ANY-TYI` dismissal tree, insertion, and history match profile |
| `D03-SE-022` | all/L2 | Create ordinary/expand: cancel at every stage, invalid geometry, constructor failure, success, and for each C303 smart corner use nested exposed descendants with conflicting low/high candidates, controlled traversal order, and an out-of-bounds final candidate | D02 allocation order, sentinel/no-op, selection and partial effects match profile; C303 smart Create reproduces the common depth-first postorder overwrite and inclusive clamp independently at both corners |
| `D03-SE-023` | all/L2 | Kill cancellation, confirmation, injected recursive failure | Profile confirmation and irreversible effect prefix are exact |
| `D03-SE-024` | all/L1 | Move Window with all seven masks, drag between press/release, first-stage rejection, invalid-edge diagnostic input classes, and a stateful verifier that accepts position but rejects/signals on edges | Profile sampling time, button leaves, retry, C303 keyboard-only diagnostic dismissal, helper-to-central order, skipped geometry/history, or C46 signal match |
| `D03-SE-025` | C46/C303/L1 | Reshape both corner stages with all masks, move while held across down-time capture/cleanup, compete snap targets, nest exposed descendants with conflicting low/high edges and controlled inferior-list order, force the final snap beyond the edited inside rectangle, and use a helper-accept/central-reject verifier | Release-time first point; C46 discards second-mask identity while C303 freezes it; both sample the latest current coordinate after cleanup without a release wait; exact lower-right `+1`, C303 depth-first postorder/per-sheet edge overwrite and final clamp, cancellation, and validation behavior match |
| `D03-SE-026` | G85/L1 | Reshape with live Shift transitions, all masks, negative sizes, bounds, NIL default corner | One-corner semantics, snap, clamp, history and named defect outcome |
| `D03-SE-027` | all/L1 | Probe both strict thirds equalities, normalized-distance tie, outside point, and zero/negative-extent record | Exact corner exclusions and edge tie match; nonpositive records classify outside and follow profile outside behavior without dividing |
| `D03-SE-028` | all/L1 | Toggle every edge/corner relation on/off across adjacent rectangles | One-hop contained-span/exact-corner association and nonpropagating removal |
| `D03-SE-029` | all/L1 | Move Multiple selection with every mask, short/60/long Left, pure Right, NIL list, retained all-false record, and outside | Start/cancel/toggle/no-op/sentinel tree and strict threshold match profile |
| `D03-SE-030` | all/L2 | Move Multiple placement with every mask, maximum-bound equality, inverted rectangle | Profile final-button tree, retry, precheck and partial central verify match |
| `D03-SE-031` | all/L2 | Move Single with all masks at selection and placement | First-stage Right cancel and later-profile second-stage Right commit distinguish stages |
| `D03-SE-032` | all/L2 | Asymmetric blockers and touching half-open edges | Expand-one proves horizontal-before-vertical result |
| `D03-SE-033` | all/L2 | Tied/equality-touching blockers, odd gaps on both sides, immovable winner/target, no-winner branch, second execution | Exact asymmetric midpoint formulas, overlap equality, C303 rejected-midpoint no-change and C46 unverified-midpoint-after-full-boundary-rejection branches, order, and non-guaranteed idempotence match |
| `D03-SE-034` | C303/L2 | Dump `RH-COMMAND-ALIST`; enumerate every row and idle cons, all seven raw masks, modifier/click-count encodings, every registered alias, signed/default/zero/negative/over-64 arguments including fresh-vs-edited zero self-insert and middle-vs-end `C-O` state, prefix preservation across blips/System Menu and loss across error unwind, all Control/Meta/Super/Hyper and physical-Shift digit/minus/letter classes plus a synthetic Mouse-bit character, repeated `C-U`, every `C-Q` second event, Help variants, unbound events, full-rubout handshake, inner parse-error correction versus outer type-error dismissal/retry, selected/deselected form and tracked/untracked/active-edit margin scheduling, System Menu reselection during the temporary form, a dead saved selection, and failing getter/setter | Registry order and complete encoded row/RH/reader/error/margin tree match; tracked margin gaps never fall through; nested form cleanup overrides an intervening selection and exposes the unguarded dead-selection result; Left starts empty, Right starts prefilled at point zero; zero/negative/capped-width defects are not normalized; capability probes, getters, normalization, `NEQ`, setters, and partial effects remain exact |
| `D03-SE-035` | G85/L2 | Synthetic mixins append queries; dump effective AV tables; enumerate local/inherited accelerators, argument prefixes and errors, navigation edges/zero/negative counts, all 96 pointer characters, generic menus, field-entry transition, Done, no-change, odd list, later failing setter, and Abort | Complete AV keyboard/pointer/input-context tree, method order, setter prefix, Undo, and Abort destination match |

### Frame-Up model, commands, bindings, and generation

| ID | Profile/level | Setup and action | Objective pass condition |
| --- | --- | --- | --- |
| `D03-FU-001` | G85/L0 | Fresh instance and reselection after Done | Four real panes, one PANE-1 display model, exact settings, retained state |
| `D03-FU-002` | G85/L1 | Dump local table, `kbd-accelerator-p`, parents, per-call editor options, Input Editor registry, intercepted sets, and inject every character/modifier/prefix candidate | NIL parents/accelerators; exact CP-option-before-editor precedence; all base editor aliases, numeric and multistage leaves, intercepts, self-insert and beep outcomes match |
| `D03-FU-003` | G85/L1 | Invoke every fixed menu cell with direct injection of all 96 raw mouse characters and with physical simultaneous/sequential masks; vary defaults, missing arguments, confirmation, and active typeout | Only exact unmodified Left/Right handlers fire; default, CP, AV, confirmation, generic-fallthrough, simultaneous-button, and no-handler outcomes match |
| `D03-FU-004` | G85/L1 | Hit leaf label/interior, internal node/border, and blank with all 96 raw mouse characters; separately exercise same-button double timing and NIL-disabled mode, keyboard-pending suppression, third click, simultaneous masks, selected/unselected clicked windows, and selected-window presentation-handler capability in idle and every active argument context | Exact outer translators, physical Essential Mouse interception, direct-injection distinction, 96 primary names, double/Shift equivalence and disabled mode, selected-window routing, inner-context precedence, blank Left selection tester, internal-node risk, generic aliases, dead blips, hit boxes, and Operation-menu membership/order match |
| `D03-FU-005` | G85/L1 | Enumerate nil-gesture and menu-enabled translators plus the live gesture/handler registries under each input context, both before and after loading Presentation Inspector | Set Name/Delete remain menu-only; Split/Options routes/testers, Shift-Right/Meta-Shift-Right/Super-Right and loaded Presentation Debugging membership, editor marking/yanking gestures, conditional handlers, found-handler semantic-dead return, and true no-match signal/beep leaves are exact |
| `D03-FU-006` | G85/L2 | Split root and nested leaves in both orientations | Exact private topology, sibling insertion order, backlinks and boxes |
| `D03-FU-007` | G85/L2 | Omit selected from a matching-orientation parent, then from a nonmatching parent, and Split | Matching branch signals after sibling backlink; nonmatching branch silently leaves old list plus detached linked subtree after exact allocation/superior/backlink/inferior order |
| `D03-FU-008` | G85/L2 | Swap valid siblings and every rejection case | Identity-preserving order or exact beep/message without intended mutation |
| `D03-FU-009` | G85/L2 | Delete leaf, collapse parent, refuse root, then delete a stale/nonmember or sole member to leave zero, one, and multiple survivors | Exact destructive replacement, sole-survivor promotion even for stale target, zero/multiple stop, direction, and uncleared backlinks match |
| `D03-FU-010` | G85/L2 | Enumerate registry; replace and add types | Seven base types, exact option/default filtering, mutable order |
| `D03-FU-011` | G85/L2 | Exercise every pane option mode, type switch/back, internal node, duplicate name | Copy/commit, filtering, raw/quoted values, errors and lack of uniqueness |
| `D03-FU-012` | G85/L2 | Set every program option and inspect untouched state | Only five exposed option families change |
| `D03-FU-013` | G85/L2 | Select each built-in layout; exercise readline Yes/No with all editor/completion/help/activation/abort and pointer routes; cancel; inject construction failure; Reset | FQUERY tree, beep/confirmation, exact child order, duplicate naming, and NIL partial state match |
| `D03-FU-014` | G85/L2 | Render mixed fixed/even children and odd remainder | Top box, 20-pixel estimates, floor/ceiling assignment, nested presentations |
| `D03-FU-015` | G85/L2 | Render all-fixed and negative-remainder layouts | No all-fixed division; ordered fixed extents may escape parent; negative unconstrained extents and absence of clipping match |
| `D03-FU-016` | G85/L2 | Generate every pane type, internal topology, sizes, and Accept Values on leaf and synthetic internal node before removal | Exact normalized AST, leaf filtering, layout/size order, any-node scan, and sticky inheritance match |
| `D03-FU-017` | G85/L2 | Preview synthetic harmless program; inject eval/allocation/redisplay errors; enumerate ordinary characters, Refresh, Help, intercepts, Left/other mouse, Menu/Typeout and registered/unknown blips | Real redefinition, exact character/blip exit-or-continue tree, cleanup and retained prefixes |
| `D03-FU-018` | G85/L2 | Done with failures at generation, store, tick, and deselect | Result/tick/deselection prefix and no file save match contract |
| `D03-FU-019` | G85/L2 | Exercise all four commands through M-X/C-M-X; enumerate Mini-IE local keys, explicit undefined shadows, inherited Standard Zwei/C-X trees, completion/Help/activation/abort, in-prompt C-M-X conversion, numeric state, and lowercase/mixed buffers | Complete editor route plus named-command form printing, point, replacement, retained model, independent program acceptance, pane choice, and redisplay ED behavior match |
| `D03-FU-020` | G85/L2 | Two retained programs, fast Done, two concurrent waiters, nonfirst edit, insertion failure | Missed wake, shared wake, wrong-first risk and deletion-before-insert are observable |
| `D03-FU-021` | G85/L1 | For each of ten typed names, exercise plain text/leading colon/comma, Space/Line/Complete/Meta-Complete/Super-Complete/Tab, Help/C-Help/C-?/C-/, Right completion, Return/C-Return/End, Abort/intercepts, and every argument stage | Exact command-only CP parse tree, argument order, contextual Help, activation/error, preview/AV acquisition, and absence of accelerator/numeric-command grammar match |
| `D03-FU-022` | G85/L1 | Enter Set Program Options, Set Pane Options, and every menu-Right multiargument acquisition; enumerate the complete AV accelerator, standard-argument/scrolling, field-editor, pointer, exit and error matrix | Each nested form is isomorphic to the shared Accepting Values tree and returns/cancels through the owning command at the documented boundary |
| `D03-BINDINGS` | all interactive profiles | Enumerate every application and incorporated-substrate context, item, raw button/modifier/click-count character, simultaneous-mask transition, staged state, handler, fixed-menu path, character, prefix leaf, Help path, numeric argument, field editor, parser, and unbound/no-handler outcome; dump mutable registries first | Every selected-source path is isomorphic to the normative trees; any live mutation is recorded as a distinct site overlay with an owner and cannot be silently attributed to the application |

## Preserved-system comparison procedure

1. Verify the selected source revision or world/load-band checksum and the executable
   emulator/VLM checksum.
2. Start from a disposable private copy with network and host file access disabled;
   never mutate the public base band or licensed base world.
3. Create only synthetic sheets, panes, names, and functions owned by the researcher.
4. Dump the effective menu/item/command/presentation tables before gesture tests so
   mutable registrations are part of the result.
5. Inject logical button masks and modifiers, recording raw logical input and
   application events rather than relying on host physical-button labels.
6. For destructive and failure probes, instrument synthetic objects whose geometry,
   setters, constructor, or redisplay fails at one controlled step.
7. Record before/after model and live state, result/condition, diagnostic sequence,
   action log, and bounded screenshot only when appearance is the claim.
8. Exit through the normal application path when possible, then prove base artifact
   hashes unchanged. Record forced termination honestly.
9. Promote a result only into the exact source/runtime profile exercised.

### Runtime closure probes

| Obligation | Setup and discriminating action | Claim closed |
| --- | --- | --- |
| `TODO-RUNTIME-SE-CREATE-KILL-UNDO` | Create/Undo and Kill/Undo disposable synthetic windows | Absent-created and dead-record restoration result |
| `TODO-RUNTIME-SE-CLEANUP-DEAD-OBJECT` | Kill saved selection/pointer target, then normal and abnormal exit | Liveness failure and cleanup prefix |
| `TODO-RUNTIME-SE-G85-ATTRIBUTES-ABORT` | Abort delegated Attributes with prior useful Undo | Abort destination and history effect |
| `TODO-RUNTIME-SE-G85-NIL-RESHAPE-CORNER` | Bind NIL default corner, invoke Screen Editor Reshape | Error versus nearest-click behavior |
| `TODO-RUNTIME-SE-G85-EXPAND-ROOT` | Call Expand on a controlled superiorless target | NIL/result downstream behavior |
| `TODO-RUNTIME-FU-HANDLER-MENU` | Right-click exact leaf presentation and dump menu handlers/order | Effective menu-only translator surface |
| `TODO-RUNTIME-FU-LEAF-HITBOX` | Click label, interior, border, and blank regions under presentation trace | Exact nested hit-test regions |
| `TODO-RUNTIME-FU-PREVIEW` | Preview safe mixed panes and press non-Space | Real layout, arbitrary-character exit, cleanup |
| `TODO-RUNTIME-FU-ZMACS-RACES` | Coordinate fast Done and two waiters over two result names | Missed/shared wake and wrong-first insertion |
| `TODO-IMAGE-D03-G85-SOURCE-WORLD` | Inspect resident compiled definitions or callable identities without extracting code | Stronger source-to-world linkage |

## Known unknowns and nonclaims

- No preserved System 46 runtime has closed the source-only visual and pointer paths.
- The maintained System 303 tree and runnable band are not proven to be one exact
  build; only the visible menu agrees at the exercised boundary.
- The Genera source media and base world are not proven to have identical bodies;
  runtime agreement closes only the visible menus and one Frame-Up split.
- Screen Editor owns no keyboard binding. Effective global-prefix and selected-owner
  fallthrough is closed at the application boundary above; mutable site additions
  must still be enumerated from the live registry for a site-specific profile.
- Create/Kill Undo, dead saved-object cleanup, default-corner NIL, root expansion,
  live handler-menu contents/hit boxes, Preview, and Zmacs races retain named probes.
- Effective site-added pane types, command tables, activities, presentation handlers,
  and key remappings are outside the base profile unless enumerated at test time.
- Frame-Up's direct leaf translators, menu-only contents, Preview, all commands other
  than typed horizontal Split and Done, and all four Zmacs paths are source-grounded
  but not yet runtime-confirmed.
- No exact source API, binary, saved-world, timing, scheduler, font, or general
  pixel-identity compatibility is claimed.

## Artifact identities and rights boundary

| Role | Portable identity | Size/checksum/revision | Publication boundary |
| --- | --- | --- | --- |
| C46 source | `mit-cadr-system-software`, `src/lmwin/scred.62` | 49,289 bytes; SHA-256 `63bdc78c6984cbb6e68b207fea7f2167955bae17350680d6fe2381fec1e8ecb8`; Git `8e978d7d1704096a63edd4386a3b8326a2e584af` | Public source repository |
| C46 manual source | `src/lmwind/operat.27` | 85,337 bytes; SHA-256 `a5ab658210dc09891b0886b58af705368e33a41f013073c8b9a637d99ab0f02d` | Public source repository |
| C303 source | LM-3 `sys/window/scred.lisp` | 69,028 bytes; SHA-256 `8f76df709ca1b913925370463248d00c13d059c97a2bdb6d5154db3797749cf9`; Fossil `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | Public maintained repository |
| C303 choice source | LM-3 `sys/window/choice.lisp` | 84,440 bytes; SHA-256 `866900e06a7f55855d84df71dbbb77c07040a4db586cba39e665c93f945f6dbd`; same Fossil check-in | Public maintained repository |
| C303 rubout-handler source | LM-3 `sys/window/rh.lisp` | 68,866 bytes; SHA-256 `6e71970e7b481441554ed64af2ac9ca04439a9af6d532a61a24d02cce8a4e0f8`; same Fossil check-in | Public maintained repository |
| C303 stream source | LM-3 `sys/window/stream.lisp` | 26,023 bytes; SHA-256 `3159e4aa22a77a71a2d603cb5fe9ec78c1674af0615dd9ad83d238195613cef8`; same Fossil check-in | Public maintained repository |
| C303 mouse source | LM-3 `sys/window/mouse.lisp` | 57,256 bytes; SHA-256 `facf7f3dd979a758bd70b0644120ccceb0f243188acd180dcbf0a70a836ec6b2`; same Fossil check-in | Public maintained repository |
| C303 System Menu/pop-up source | LM-3 `sys/window/sysmen.lisp` | 43,408 bytes; SHA-256 `b53b7c3d5a59040f3180d5be0d2072b2a334bb386fa5e19dd6abbd945148b40`; same Fossil check-in | Public maintained repository |
| C303 window-call source | LM-3 `sys/window/tvdefs.lisp` | 44,999 bytes; SHA-256 `ae8a8a342d10e4bdc89dc119f9afca9606a7797757601fdd593f8477bfc738ed`; same Fossil check-in | Public maintained repository |
| C303 basic-window source | LM-3 `sys/window/baswin.lisp` | 82,708 bytes; SHA-256 `3b86ca413528046887da8371433d656ecd9d5f9130d6eadd764fc54f137b42f1`; same Fossil check-in | Public maintained repository |
| C303 sheet traversal source | LM-3 `sys/window/sheet.lisp` | 110,976 bytes; SHA-256 `3547b359a4947d4eb7f256fefa5034c88e5afcb329bd435d7353cdf034d58902`; same Fossil check-in | Public maintained repository |
| C303 manual source | LM-3 `sys/wind/operat.text` | 105,069 bytes; SHA-256 `3129801c6193035feb527c24ec65942a9b5b6b57cbaf9dcddc4372214ad47a97`; same Fossil check-in | Public maintained repository |
| C303 runtime | `System 303-0` band | base/private-start SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` | Local runtime input; screenshot only as separately reviewed |
| G85 source | `sys.sct/window/scred.lisp.~181~` | 94,187 bytes; SHA-256 `d0756bb5102789ad748a08bb1087166c9e13f071ec233adbeca1730107d1e542` | Licensed local input; metadata/paraphrase only |
| G85 System Menu/pop-up support | `sys.sct/window/sysmen.lisp.~250~` | 52,798 bytes; SHA-256 `2f54fdb15335fc7f9f9f5c47a03f1ad2a5803d86787267949825f23853363f4c` | Licensed local input; metadata/paraphrase only |
| G85 interactive-stream support | `sys.sct/window/basstr.lisp.~645~` | 65,555 bytes; SHA-256 `112245299c0d46cf81a67f2cc8de714c766711653be215467ef41bb2c6778021` | Licensed local input; metadata/paraphrase only |
| G85 raw/filtered stream input support | `sys.sct/io/interactive-stream.lisp.~244~` | 65,634 bytes; SHA-256 `e49e7c0b175529cb051574c81e8c1062b07783f2c9a611bd46cce0ea9d24bb4e` | Licensed local input; metadata/paraphrase only |
| G85 Frame-Up source | `sys.sct/dynamic-windows/layout-designer.lisp.~4039~` | 50,166 bytes; SHA-256 `3fe3957872d881daf28bc9cb60079fbb32bfdca28dbefb098722cea5befb46a4` | Licensed local input; metadata/paraphrase only |
| G85 pane registry | `sys.sct/dynamic-windows/program-framework-panes.lisp.~32~` | 18,999 bytes; SHA-256 `4ebc7fac734b83b7f9c2be4e81fb47b6443157460c0fcdbbb864dd242eeb27ea` | Licensed local input; metadata/paraphrase only |
| G85 framework definition support | `sys.sct/dynamic-windows/define-program-framework.lisp.~332~` | 132,692 bytes; SHA-256 `e4fde854b9a36492bf4d23eec0a812bd36c7d42e7d32c649c7aaa5786cd30128` | Licensed local input; metadata/paraphrase only |
| G85 Command Processor support | `sys.sct/cp/command-processor.lisp.~318~` | 131,639 bytes; SHA-256 `248550a755130c40322b3a12c608cfa7a18213b504d18f36d5fcf3399dc4bca6` | Licensed local input; metadata/paraphrase only |
| G85 substrate-command support | `sys.sct/cp/substrate-commands.lisp.~6~` | 14,731 bytes; SHA-256 `558f085cc3953de3f831e4e9e195104303e9e6331861a9ed629b550870fb4f44` | Licensed local input; metadata/paraphrase only |
| G85 Input Editor support | `sys.sct/io/input-editor.lisp.~332~` | 110,515 bytes; SHA-256 `856548d945403aa4f5fa3036bd2e8b936890b07b231673c9e2cab5f9e42707b3` | Licensed local input; metadata/paraphrase only |
| G85 reader support | `sys.sct/io/readers.lisp.~251~` | 89,420 bytes; SHA-256 `234f313926a322f3d61e7d750c96bd3a1f4408b8eaf9eb8afffb294a28667491` | Licensed local input; metadata/paraphrase only |
| G85 dynamic-input support | `sys.sct/dynamic-windows/dynamic-input.lisp.~498~` | 55,058 bytes; SHA-256 `a79805ece6844ccb568ecf97e2d818a0c6095e539e51fbf74423944a32b6dd8f` | Licensed local input; metadata/paraphrase only |
| G85 basic-handler support | `sys.sct/dynamic-windows/basic-handlers.lisp.~30~` | 58,716 bytes; SHA-256 `3a85f039dbeb76b65401c0f88f1b1712cf9961645aee6f82c5bfb04c14c4303d` | Licensed local input; metadata/paraphrase only |
| G85 handler-debug support | `sys.sct/dynamic-windows/handler-debug.lisp.~33~` | 13,058 bytes; SHA-256 `ff2081af4ac6b0c4c41446b2f12de971e6f16b8197cd8005a204bfca5c04007a` | Licensed local input; metadata/paraphrase only |
| G85 Presentation Inspector handler support | `sys.sct/dynamic-windows/presentation-inspector.lisp.~4053~` | 45,825 bytes; SHA-256 `9f20e13acd39201e73fee30d6890275aaf9d0b745f6b2089dfad0e05869f494d` | Licensed local input; metadata/paraphrase only |
| G85 Accepting Values support | `sys.sct/dynamic-windows/accept-values.lisp.~244~` | 82,063 bytes; SHA-256 `1c430c59e77f488fe3b85475bd89c704e2250e343243f7399ab9c0c5896de0d5` | Licensed local input; metadata/paraphrase only |
| G85 FQUERY support | `sys.sct/io1/fquery.lisp.~104~` | 13,320 bytes; SHA-256 `022823ae8dddbf64c598ab59bde00945c9b5e621191617b1374a84f020730e0f` | Licensed local input; metadata/paraphrase only |
| G85 mouse encoder support | `sys.sct/window/mouse.lisp.~472~` | 119,392 bytes; SHA-256 `9375d99e127c097e22852dc0ea7f6cd496101f01946a42eb0c6bf58051d4a3b6` | Licensed local input; metadata/paraphrase only |
| G85 presentation-click routing support | `sys.sct/dynamic-windows/dynamic-window-mixins.lisp.~204~` | 139,058 bytes; SHA-256 `d1c9db01f37982f10efdd5f7f21dff938a437c4b1f80633c04054158be87a482` | Licensed local input; metadata/paraphrase only |
| G85 pointer-name formatter support | `sys.sct/io/format.lisp.~369~` | 91,024 bytes; SHA-256 `ae5135cf2be3af4741093ea7f8e885259927d9aaa32555c7fa292553eb112249` | Licensed local input; metadata/paraphrase only |
| G85 handler-definition support | `sys.sct/dynamic-windows/define-handler.lisp.~12~` | 25,689 bytes; SHA-256 `00d7c33ea97a342ff53877b8c33106f2b1730bb0fd86963d1a086e4bac883ab0` | Licensed local input; metadata/paraphrase only |
| G85 mouse-handler support | `sys.sct/dynamic-windows/mouse-handler-lookup.lisp.~33~` | 99,828 bytes; SHA-256 `601385c017301e7158599b8dfe235650a1f5dee06a7944fc701ce8a4a491d716` | Licensed local input; metadata/paraphrase only |
| G85 argument-type support | `sys.sct/dynamic-windows/type-methods.lisp.~6~` | 32,708 bytes; SHA-256 `c759735e87f996be7ae9eb5efb2afb10c523ec425b134be927a2e53cb2879aed` | Licensed local input; metadata/paraphrase only |
| G85 destructive-list support | `sys.sct/clcp/listfns.lisp.~161~` | 34,956 bytes; SHA-256 `85e1377fc8225563c3d75c4653a5cff9f722011184a6f34f325cf2d1c1bb1c83` | Licensed local input; metadata/paraphrase only |
| G85 Command Processor I/O wrapper support | `sys.sct/clcp/iofns.lisp.~273~` | 100,273 bytes; SHA-256 `21b171f5c23054894b7d11a3001226dabc6109790a1badb19a1f8ebbea84212d` | Licensed local input; metadata/paraphrase only |
| G85 installed Help metadata | `SYS:DOC;INSTALLED-440;USER;WB1-CHAP16.SAB.13` | System 451.0 / Sage 439.0; 16 records; source SHA-256 `7ed8f74a0982e51b509477b3473edd9e6930f5e431af64bf0e2bb35dde07e8f4`; ignored decoded 21,280 bytes, SHA-256 `ecf64a74115e0cf3d305e2ade3276934b50b50280dc303d76aeaa9c206436b55` | Licensed local input; metadata only, decoded prose ignored |
| Purchased archive | `opengenera2.tar.bz2` | 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` | Local licensed input; untracked |
| Base world | `Genera-8-5.vlod` | 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` | Local licensed input; untracked and unchanged |
| G85 VLM | Executed VLM | SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` | Local executable identity |
| Screenshots | Three exact PNGs above | Per-image and normalized-pixel SHA-256 recorded above | Tracked under capture-specific scholarly/fair-use review; excluded from repository-wide license |

No licensed Genera source, world bytes, extracted Help prose, or recovered payload is
tracked by this specification. The images are narrow runtime evidence and not a
substitute for the systems.

## Sources

- MIT, [System 46 Screen Editor source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/scred.62),
  pinned public release revision; verified 2026-07-19.
- MIT, [System 46 operator manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/operat.27),
  “The Screen Editor”; verified 2026-07-19.
- LM-3 project, [System 303 Screen Editor source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fscred.lisp),
  pinned Fossil check-in; verified 2026-07-19.
- LM-3 project, pinned System 303 [choice-variable source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fchoice.lisp),
  [alternate rubout-handler source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Frh.lisp),
  [stream source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fstream.lisp),
  [mouse source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fmouse.lisp),
  [System Menu and pop-up source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsysmen.lisp),
  [`WINDOW-CALL` source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Ftvdefs.lisp),
  [basic-window source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbaswin.lisp),
  and [sheet traversal source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fsheet.lisp);
  verified 2026-07-19.
- LM-3 project, [System 303 operator-manual source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=wind%2Foperat.text),
  pinned Fossil check-in; verified 2026-07-19.
- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf),
  System Menu and Frame-Up material; verified 2026-07-19.
- Symbolics, [*Genera Workbook*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Workbook.pdf),
  Screen Editor and Frame-Up exercises; verified 2026-07-19.
- Symbolics, [*Programming the User Interface*](https://bitsavers.org/pdf/symbolics/software/genera_8/Programming_the_User_Interface.pdf),
  program frameworks, panes, and Frame-Up; verified 2026-07-19.
- [Screen Editor and Frame-Up museum article](screen-editor-and-frame-up.md), which
  records the broader historical interpretation, runtime sessions, and rights
  boundary.
- Local licensed Genera 8.5 source and extracted Help records identified by exact
  metadata above, inspected 2026-07-19; not distributed.
