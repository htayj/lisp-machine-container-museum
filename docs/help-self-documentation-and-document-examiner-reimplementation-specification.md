---
type: Reimplementation Specification
title: Help, self-documentation, and Document Examiner reimplementation specification
description: A release-bounded reconstruction contract for CADR and Genera editor Help, keyboard registries, Lisp documentation, the Genera Help Program and pop-up Help frame, and Document Examiner.
tags: [lisp-machine, mit-cadr, lm-3, genera, zwei, zmacs, help, document-examiner, sage, reimplementation, specification]
timestamp: 2026-07-19T16:48:57-04:00
---

# Help, self-documentation, and Document Examiner reimplementation specification

## Status and reconstruction claim

This specification defines an implementation-independent reconstruction of D07 for
three deliberately separate release profiles:

- public MIT CADR **System 46** source at Git revision
  `8e978d7d1704096a63edd4386a3b8326a2e584af`;
- maintained LM-3 **System 303** source at Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`,
  plus a separately identified runnable `System 303-0` load band; and
- **Genera 8.5, System 452.22** Zmacs Help, Dynamic Windows Help Program,
  ephemeral Help frame, Extended Help integration, and Standard or Small Document
  Examiner from exact hashed licensed source files and a separately identified Open
  Genera world.

A conforming implementation can reproduce the source-closed semantic behavior of
the selected profile: dynamic documentation registries; editor command description;
alias, prefix, menu, hook, and computed-documentation resolution; System and Terminal
Help generation; general Lisp and flavor documentation boundaries; Help Program
topic mapping and cache invalidation; Help-frame reuse and burial; Document Examiner
layout selection, viewers, topics, candidates, bookmarks, command/menu/gesture
dispatch, incremental topic display, default thin-topic private-document serialization, self-help
generation, idle stream closure, optional hardcopy behavior, and the release defects
and missing assets named below.

The strongest claim is **semantic compatibility** for the source-present profiles.
Observable behavioral compatibility is additionally claimed only for the exercised
System 303 ZWEI and System Help paths and the exercised Genera Zmacs Help and Standard
Document Examiner paths. This specification does not claim:

- one universal Help application shared by CADR, ZWEI, Genera, and Sage;
- that a static manual or extracted help corpus is the effective runtime command
  environment;
- that the maintained LM-3 source built the observed `System 303-0` load band
  byte-for-byte;
- that every inspected Genera source body is resident unchanged in the licensed
  world;
- recovery of the missing System 46 Basic ZWEI tutorial;
- redistribution of licensed Genera source, tutorial, Sage database, Help prose, or
  extracted documentation payloads;
- exact historical package/API, callable-signature, condition/restart, module-load,
  QFASL, world, or ABI compatibility;
- pixel identity, historical font metrics, or timing beyond the bounded visible
  constraints attached to the reviewed screenshots; or
- a configured Symbolics site, documentation server, printer, or Development
  Utilities installation.

An implementation MAY offer all profiles, but it MUST select one explicitly. It
MUST NOT silently give System 46 Genera's tutorial loader, make System 303 accept its
source-unreachable `?` branch, replace a live registry with a canned table, or treat
a private Document Examiner file as a copy of the referenced documentation.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative only for the profile named by
the surrounding rule. `INF` identifies a portable reconstruction choice or an
optional safety correction, not an attribution to the historical implementation.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | Public System 46 source | Source-visible ZWEI, TV registry, Lisp-documentation, and flavor behavior | A runnable matching band or later LM-3 behavior |
| `C303-SRC` | Maintained LM-3 source | Source-visible System 303 editor, keyboard, and Lisp-documentation behavior | That the observed band loaded this exact tree |
| `C303-RUN` | Isolated `System 303-0` harness session | Exercised Help dispatcher, named-command, System Help, general documentation, and flavor-description results | Untested Terminal Help, every registry mutation, or source identity |
| `G85-SRC` | Licensed Genera 8.5 source inspected locally | Source-visible Zmacs Help, Dynamic Windows Help, Help frame, Sage, and Document Examiner behavior | Redistribution permission or source-to-world identity |
| `G85-RUN` | Isolated Genera harness sessions | Exercised Zmacs Help and Standard Document Examiner entry, layout, computed Help, and search behavior | Small frame, every command, optional module, or orderly VLM shutdown |
| `MIT-MAN` | Contemporary MIT operator documentation | Intended System 46 keyboard and self-documentation use | Exhaustive later behavior |
| `G8-MAN` | Public Genera 8 manuals and workbook | Supported Help and Document Examiner workflows | Exact 8.5 implementation without source/runtime cross-check |
| `INF` | Implementation-independent inference | Portable state representation, safety rule, or test mechanism | Historical internal representation |
| `TODO-RUNTIME` | Named unresolved oracle | Nothing until the probe is run | Permission to infer the result |

Source controls each named source profile. Runtime controls only the exact artifact
and path exercised. A manual supplies intended use but cannot erase a source-visible
branch, defect, or condition. Where those witnesses disagree, the implementation
MUST retain the disagreement as a profile or oracle result instead of averaging it.

## Compatibility profiles and levels

### Release profiles

| Profile | Exact target | D07 members | Required substrate |
| --- | --- | --- | --- |
| `HD-C46` | MIT CADR System 46 public source at `8e978d7` | ZWEI Help, System Help, Terminal Help, function and flavor documentation | System 46 TV, keyboard process, ZWEI, Lisp, Flavors |
| `HD-C303` | LM-3 source at `4df393c` plus separate `System 303-0` runtime | Later ZWEI Help, System Help, Terminal Help, general `DOCUMENTATION`, flavor description | System 303 TV, ZWEI/Zmacs, Lisp, Flavors |
| `HD-G85-ZMACS` | Genera 8.5 System 452.22 source plus base world | Zmacs Help dispatcher and command documentation | Genera ZWEI/Zmacs and TV |
| `HD-G85-HELP` | Same Genera release | Dynamic Windows Help Program, pop-up Help frame, Function/Select/Symbol Help, Extended Help | TV, Command Processor, Dynamic Windows, Sage |
| `HD-G85-DEX` | Same Genera release | Standard/Small Document Examiner, Sage search/navigation, private documents, optional hardcopy | TV, Command Processor, Dynamic Windows, Sage, optional printer support |

The UI substrate boundary is normative. `HD-C46` and `HD-C303` use TV and ZWEI and
predate CLIM. `HD-G85-ZMACS` is ZWEI/Zmacs over TV. `HD-G85-HELP` and
`HD-G85-DEX` are Dynamic Windows program frameworks over TV, Command Processor, and
Sage. None of the selected implementation files defines a CLIM application frame,
pane, port, command table, or CLIM dependency. A clean-room implementation MAY use
CLIM internally only if it preserves this specification's observable behavior and
does not relabel historical Dynamic Windows behavior as CLIM behavior.

### Conformance levels

| Level | Required behavior | Reserved behavior |
| --- | --- | --- |
| `L0` | Documentation values, registry rows, topic/record/viewer state, cache generations, and invariants | Interactive dispatch and visible layout |
| `L1` | `L0` plus complete effective input, prefix, menu, pointer/presentation, completion, search, navigation, and redisplay behavior | External file, tutorial, documentation-store, and printer transactions |
| `L2` | `L1` plus tutorial/file/database/hardcopy paths, lifecycle ordering, abort/failure behavior, release defects, and bounded visible states | Exact historical source interface |
| `L3` | Exact selected packages, symbols, signatures, values, conditions/restarts, and module/load closure | QFASL, world, or ABI identity |

This document normatively closes `HD-C46/L2`, `HD-C303/L2`,
`HD-G85-ZMACS/L2`, `HD-G85-HELP/L2`, and `HD-G85-DEX/L2` at the semantic
grain, subject to the explicit runtime oracles. It reserves `L3`. Source conformance
and preserved-runtime closure are independent axes:

| Member/profile | Contract defined | Preserved runtime verified | Remaining oracle boundary |
| --- | --- | --- | --- |
| C46 ZWEI Help | Source `L2` | No matching band | Every visible path and missing Basic ZWEI target |
| C46 System/Terminal Help | Source `L2` | No matching band | Live registries, generated displays, cancellation, mutation |
| C46 Lisp/flavor documentation | Source `L2` | No matching band | Compiled FEF and live flavor reports |
| C303 ZWEI Help | `L2` | Dispatcher, Dired description | Remaining branches and generated prefix listing |
| C303 System Help | `L2` | Five-entry generated table | Creation/cycling and registry mutation |
| C303 Terminal Help | Source `L2` | No | Generated table, numeric prefixes, wizard boundary |
| C303 Lisp/flavor documentation | `L2` | two `NIL` documentation probes and a large live flavor report | Positive compiled-documentation census |
| G85 Zmacs Help | `L2` | Dispatcher only | Every option, pointer key object, and tutorial load |
| G85 Help Program | Source `L2` | Indirectly through client frameworks only | Direct program-topic and menu-middle probes |
| G85 pop-up Help | Source `L2` | Entry attempt did not yield a publishable visible Help state | Complete frame, reuse, search, exit, and burial run |
| G85 Standard Document Examiner | `L2` | Entry, initial layout, Help, heuristic candidate search | Every menu, gesture, viewer, file, and optional command |
| G85 Small Document Examiner | Source `L2` | No; current harness display is 1200 pixels wide | Screen at 950 pixels or narrower |
| G85 hardcopy extension | Source `L2` and runtime-installed names | Names appeared in computed Help; no printing | Printer selection, output, failure, seen-only boundary |

## Evidence ledger

### Exact source artifacts

| Profile | Portable artifact | Bytes | SHA-256 or revision | Principal use |
| --- | --- | ---: | --- | --- |
| `HD-C46` | `src/nzwei/doc.31` | 14,517 | `9e379b908a508565d3115216dc65abab4db279768b579df6a9e18db17eb63d06` | Help dispatcher and command documenter |
| `HD-C46` | `src/nzwei/basic.zwei` | 53 | `27ff8f344dc9bd48f4b3ee0178d9eb5df92626c3ef0969e36475203b3b63cc36` | Placeholder reached by `B` |
| `HD-C46` | `src/nzwei/defs.56` | 13,128 | `70a53cbe611f8df1e3b87ae0c1b217285209eab5ba7381fec39eae3a3c8f71e2` | dispatcher state and defaults |
| `HD-C46` | `src/nzwei/macros.36` | 21,668 | `98bb23fae9aec8c3d8582df0b475d11c7dc5241a8fa29fcfc806ce27e1773b51` | command/documentation macro semantics |
| `HD-C46` | `src/nzwei/comtab.115` | 42,847 | `a40bcc9389cad426faf50ee7aaa507e40c569c90226ba5f53115b53f5f316834` | table inheritance and lookup |
| `HD-C46` | `src/nzwei/come.58` | 23,081 | `0c204b6ada9a061b5baa0c649c40a8cc3361eb9cf441de5df4b1544361adefd7` | Lossage behavior |
| `HD-C46` | `src/lmwin/basstr.163` | 37,385 | `19e0771ff876d5325f18b97a2ccbf392f7d5950d3a89751d633d27d7cbe01e72` | Terminal/System registries and Help displays |
| `HD-C46` | `src/lispm/qmisc.281` | 62,028 | `ed80c13e4d51f5d9b3132a8f193673f081f25d310835087c40cc8c9b08d063ad` | function documentation retrieval |
| `HD-C46` | `src/lispm2/flavor.164` | 72,844 | `a2fa9725c9dce174efda6306432b5bedba87d0383f9aa30beb0c48dd3d7a7178` | flavor description |
| `HD-C46` | `src/nzwei/comf.25` | 29,106 | `fff824c7bd91421f46feebca6b68e1d87aa28b0ddc21a0a11358289013c41f7a` | editor-facing flavor report |
| `HD-C46` | `src/nzwei/comd.57` | 32,805 | `5665e0e76eef451717b5ae85940dcba8523b252abea5f94b02456d2738765695` | variable documentation |
| `HD-C46` | `src/nzwei/comc.75` | 26,254 | `96f46dafa5c487959755df7a68fc01d8658941a0d79f3df1bf263a0fce74d10d` | brief and long function documentation |
| `HD-C46` | `src/nzwei/dired.55` | 34,913 | `fc5f0853854383b4c6dc81949b67fb452a478fd728b8b6eae88112ec3e40c3eb` | static contextual Dired Help |
| `HD-C46` | `src/lispm/pkgdcl.230` | 12,516 | `2d08a109871868990f10e1334a8b4d5199ac7c530bb50b04b93d5f552a83e1b9` | selected LMWIN load precedence |
| `HD-C303` | `l/sys/zwei/doc.lisp` | 23,055 | `533a733139c6de028462f15363edff5cdfcceebfb217a165b830f9838d8d9f6e` | conditional dispatcher and key/named-command help |
| `HD-C303` | `l/sys/zwei/defs.lisp` | 42,164 | `1ce50e3cead80a98fdce3c64697cd25837888ce27dbf9d0b61e42dd60f4faefc` | dispatcher state and defaults |
| `HD-C303` | `l/sys/zwei/macros.lisp` | 37,620 | `53636f531bc8563228f5e65820bd7c915f0242564443a55f4c2f09012c44a171` | command/documentation macro semantics |
| `HD-C303` | `l/sys/zwei/comtab.lisp` | 64,703 | `5e54ab5e70fd7e2e6086fb16d8a83efe27d65173abeaa78e0825804b3866e600` | dense/sparse table lookup and command queries |
| `HD-C303` | `l/sys/zwei/come.lisp` | 23,399 | `702f0e53f1306f9781d355250d63e682eda69717f4baf773561e3982de8fb978` | Lossage behavior |
| `HD-C303` | `l/sys/zwei/nprim.lisp` | 45,547 | `cfc611524f762599e8718f689e5116687162654b7b2c6589bad564608964c2e0` | recording stream and primitive behavior |
| `HD-C303` | `l/sys/zwei/comd.lisp` | 53,391 | `14b5734403c4e2e634a8dd30cb96d541a0d024870dabae5033b8d17df988c407` | variable documentation |
| `HD-C303` | `l/sys/zwei/comf.lisp` | 35,903 | `1ab4fff89f71aa51c671b47791aeb9336717aae218b2d09e354fa52d5c4626a9` | Undo and Teach Zmacs |
| `HD-C303` | `l/sys/window/basstr.lisp` | 81,846 | `8ba3a16e726ed043e6585c7a68b7096bb2dcc5d6f05476afd89f84a48dff2645` | System/Terminal registries and execution |
| `HD-C303` | `l/sys/sys/qmisc.lisp` | 83,123 | `d8c022999c40033b0073c0bec364fbe28ac20c4aa4ecb77afa4c70d1bfc9d840` | typed general documentation lookup |
| `HD-C303` | `l/sys/zwei/comg.lisp` | 24,115 | `920c5f11e55658b04190e63f4ad64687f3c1e9f01205855236951ea99f6c8da1` | editor Describe Flavor command and report |
| `HD-C303` | `l/sys/sys2/flavor.lisp` | 197,884 | `35d5ef57e644e30db531b72f889c1c5ea355fb1cfe55f2dc3d4a4ff1aca6be94` | general flavor description |
| `HD-C303` | `l/sys/sys2/describe.lisp` | 27,587 | `d0d4021aff9cdb95db4d8027863f639ab3a764dedeba8fc5319c40bb1e22ed23` | general Describe behavior |
| `HD-C303` | `l/sys/zwei/dired.lisp` | 110,561 | `34155fec3311a969cfbed31c640b59159f28251b179f51b4c4a6c08b19c9eb34` | contextual Dired Help overlay |
| `HD-C303` | `l/sys/zwei/bdired.lisp` | 16,636 | `58c365d9972cb22448e035ed220535e47dc2dc9ea02444a1416441b0c7009d22` | contextual BDired Help overlay |
| `HD-C303` | `l/sys/zwei/teach-zmacs.text` | 29,879 | `f266019948f649915abe780d64fcce28d49ffe96ff65b9a48f9fa75475582076` | public tutorial source copied by command |
| `HD-C303` | `l/sys/sys/sysdcl.lisp` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | system load/patch boundary |
| `HD-C303` lineage | `l/sys/patch/system-98-18.lisp` | 21,362 | `aed2b815d9975bb69d7058dabb4671e294eb469371301c36068237263c68a21b` | mouse/Scroll-aware Self Document patch |
| `HD-C303` lineage | `l/sys/patch/system-99-25.lisp` | 13,851 | `9122b6a4f51c782fdbd838eab6bc8a62ade3e987ccb75685718f7d6c1abe235f` | Quick/Brief/Long documentation patch |
| `HD-C303` lineage | `l/sys/patch/system-98-54.lisp` | 19,029 | `907555f2e1534ae6077537324ed0867f7eeb9191b8cad3954e157db168c808a4` | typed documentation/combined-method patch |
| `HD-C303` lineage | `l/sys/patch/system-100-14.lisp` | 14,184 | `4e94004c3f8111017b5901b9393a20c3d87e0534e9b6762b76b8d1e03738f6bb` | three-line Terminal N row patch |
| `HD-C303` lineage | `l/sys/zwei/patch/zwei-125-18.lisp` | 1,794 | `682e136238828ca68ef13f34b122b840cbbaae7f2b75c5bc2d03fda1078b5dca` | undefined-symbol Quick Documentation fix |
| `HD-C303` lineage | `l/sys/zwei/patch/zwei-126-28.lisp` | 5,048 | `3ddd151873b39b63189e1301fd887daa3be04121ce7b96f7fc11c8c58fbfc658` | numeric Quick Undo/Redo and region handling |
| `HD-C303` lineage | `l/sys/zwei/patch/zwei-128-1.lisp` | 6,775 | `503a41d879cec2daf54dbc229e7440511b2644f102d8b5797b60a029d6b0dce0` | Zmacs tables and Teach Zmacs installation |
| `HD-G85-ZMACS` | `sys.sct/zwei/doc.lisp.~110~` | 24,234 | `571f3fe9114376c9e13434e1825f4610198c227594cc3cb44eb35fc65edd0bcd` | Genera dispatcher and command documentation |
| `HD-G85-HELP` | `sys.sct/dynamic-windows/help-program.lisp.~4013~` | 14,996 | `9863229903ce00a32262862d2cbc0ff22447ffafcae6169f2a418969b3e70c04` | program-topic mapping and semantic Help gestures |
| `HD-G85-HELP` | `sys.sct/window/help-frame.lisp.~22~` | 17,047 | `93f9421715235bb3d1fee377cdee353724b43aee3603a45aafe6c8a8f6397db6` | reusable Help frame and registry displays |
| `HD-G85-HELP` | `sys.sct/sys/extended-help.lisp.~21~` | 4,330 | `2123c65102bbcb0a8d00b3fe5427e39c4c72d7f90216f52f6b162cd22c963979` | Extended Help system boundary |
| `HD-G85-HELP` | `sys.sct/cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | command-table inheritance |
| `HD-G85-HELP` | `sys.sct/cp/substrate-commands.lisp.~6~` | 14,731 | `558f085cc3953de3f831e4e9e195104303e9e6331861a9ed629b550870fb4f44` | scrolling, search, marking, and no-op accelerators |
| `HD-G85-HELP` | `sys.sct/cp/read-accelerated-command.lisp.~142~` | 37,639 | `8107cf4e993068344e624ec924c8d0cf0327158a927c1962666d22eb81494388` | numeric argument and accelerator-error semantics |
| `HD-G85-ZMACS` | `sys.sct/zwei/defs.lisp.~292~` | 45,782 | `e0c460db04abb2fb40af0717f3d0a0ba45bd83589f1846c4ba8c778420127b4c` | Zmacs state and option predicates |
| `HD-G85-ZMACS` | `sys.sct/zwei/comtab.lisp.~589~` | 100,220 | `5101f5a25a7222d6d0f8f48401522fa418576eb27d145f659513eb80660ca2b1` | command-table and query behavior |
| `HD-G85-ZMACS` | `sys.sct/zwei/come.lisp.~208~` | 31,996 | `6318de252c34c77ee3a14ef6b59e0bf399095970a62106de5d63a47c63635597` | recent-command display |
| `HD-G85-ZMACS` | `sys.sct/zwei/undo.lisp.~22~` | 87,202 | `bd336ae6b4a4917362e2b5f1414963a80c0f941f7fc80fd8f298badcb8ca1b09` | Undo dependency |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/examiner.lisp.~81~` | 31,580 | `dece335c917703acf440812d857af0e3e1d03dfe2b8118d21efcf6bfe4c22654` | frames, contexts, loop, candidates, bookmarks, self-help registration |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/dex-viewer-pane.lisp.~4~` | 3,836 | `8f467da798d50048decf666f84fbc55126335476598b43b381d2ca5a566aec2e` | viewer pane input and redisplay substrate |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/overview-grapher.lisp.~42~` | 24,825 | `5adb18bac47c75b16cba79aada3c006baf73cc7afea337516bd6d4e00835326b` | overview graph construction and display |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/dynamic-dex.lisp.~65~` | 47,320 | `2ce65041cb830282406450573a15a2ca1b835e2ba146299348fb0fcccb835623` | DEX items, viewing contexts, history, and ellipses |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/dexdispl.lisp.~59~` | 34,639 | `2bbbbcbf2599c18fac4aee9fe1a444e7ff4243782b6378223c7fbfab30dfc8e5` | topic display and incremental rendering |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/dexcom.lisp.~59~` | 44,235 | `f07593f5ecf076ad9c6b8ce9f979747414a9cf975615bdae7774ce027db5948d` | commands, menus, gestures, scrolling, private files |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/hardcopy-dexcom.lisp.~1~` | 7,965 | `5c5cb342877a5ac3e70480c9239f6ccefa530b06d7108f56c8ddbf549eb3a952` | optional hardcopy commands and translators |
| `HD-G85-DEX` | `sys.sct/nsage/ddex/cometh.lisp.~9~` | 3,145 | `9b931831d9406c61a0e7979f01c1196a6945f164f5c3e8e111a87c2b195be618` | command-table method glue |
| `HD-G85-DEX` | `sys.sct/nsage/commands.lisp.~75~` | 49,298 | `83910bba318a23c2e532c4e4b6d5ff1749b8d89239f40b7de975fb7c08bfdabe` | imported Sage commands and paired record-group/name translators |
| `HD-G85-DEX` | `sys.sct/nsage/sab-file.lisp.~122~` | 65,391 | `e8c40e1fd6705959c549083aafbaa22e969e0fbebb468c50502b1ee90a3e0685` | PSB object and symbol encoding |
| `HD-G85-DEX` | `sys.sct/nsage/show.lisp.~328~` | 8,232 | `65b3b63dc61a410865e052b3d1480cfe9a2e1dc7586765fc45fb2a463f25f866` | Sage display entry |
| `HD-G85-DEX` | `sys.sct/nsage/sage-ui.lisp.~287~` | 24,922 | `af2f4a124bdfdaa14625c8758829cbe7edf516ba65030d61b5197ea64247773a` | Sage UI integration |
| `HD-G85-DEX` | `sys.sct/nsage/strings.lisp.~193~` | 76,179 | `c6a1ab360a21709a688faaab5b75f7092f5b9d2aa77600ec1a49d0d9a99647b0` | candidate tokenization |
| `HD-G85-DEX` | `sys.sct/nsage/displayer.lisp.~161~` | 46,481 | `a617928c1e56ec5d4962c9021c0e6db0cbb2030ddc392f05ecd470801d5da471` | candidate condition evaluation |
| `HD-G85-DEX` | `sys.sct/nsage/formatter.lisp.~220~` | 87,718 | `88d3268ba0ff31317ba4e5f63ac9026c8d1cab14b864a7d25d59ab5859c96e58` | formatted Sage record line source |
| `HD-G85-DEX` | `sys.sct/nsage/defs-directives.lisp.~115~` | 78,792 | `f13b48c10d5a581cb79bc7513f9fd0c837678ff383a93e89ecaf7021f1a782e8` | default record title behavior |
| `HD-G85-DEX` | `sys.sct/nsage/compressed-database.lisp.~44~` | 24,106 | `49c10b683a7c74e2c5ecd555c32b7b90be5c8df927105cd933c45a6ed8a6e77c` | compressed-record title override |
| `HD-G85-DEX` | `sys.sct/nsage/nsage.lisp.~102~` | 11,597 | `f5ea917aac72f61ea55fd0b604646f5c823598c811df97bdaec409f5b5e91e12` | serial subsystem and optional-component ordering |
| optional `HD-G85-DEX+DEV` | `sys.sct/cp/development-commands-2.lisp.~35~` | 53,146 | `97c058d361860a393fe32e0c02bc03f5e5d1ceaff5f3bb4640b96f899439c3ce` | Edit Definition implementation when Development Utilities is loaded |
| optional `HD-G85-DEX+CONCORDIA` | `sys.sct/concordia/ed-record.lisp.~98~` | 106,982 | `0f1ec8c53c75eda41ba6d3791342c89b50a7f1fb1b5f8abafcdb28df15cad83d` | Edit Documentation command and translator overlay |

The Genera filenames and hashes identify licensed local evidence without reproducing
its bodies. The complete licensed documentation extraction remains ignored under
`build/help/genera/`; it is not an input a conforming clean-room implementation may
silently redistribute.

### Normative evidence map

| Contract area | Principal evidence | Status |
| --- | --- | --- |
| C46 editor dispatcher | `doc.31:7-52`; defaults in `defs.56:96-98` | Normative source; missing `B` payload explicit |
| C46 command resolution | `doc.31:54-363` | Normative source |
| C46 Terminal/System Help | `basstr.163:390-471,651-745` | Normative source |
| C46 function/flavor description | `qmisc.281:1226-1248`; `flavor.164:451-503`; `comf.25:337-484` | Normative source |
| C303 editor dispatcher | `zwei/doc.lisp:54-146`; default in `zwei/defs.lisp:334` | Normative source plus dispatcher runtime |
| C303 command resolution | `zwei/doc.lisp:148-550` | Normative source plus Dired-description runtime |
| C303 Terminal/System Help | `window/basstr.lisp:564-781,1470-1635` | Normative source plus System Help runtime |
| C303 general documentation | `sys/qmisc.lisp:1541-1577`; `zwei/comg.lisp:348-563`; `sys2/flavor.lisp:1208ff` | Normative source plus bounded `NIL` and flavor-report probes |
| G85 Zmacs dispatcher | `zwei/doc.lisp.~110~:58-150` | Normative source plus dispatcher runtime |
| G85 command resolution | `zwei/doc.lisp.~110~:152-565` | Normative source |
| Help Program | `help-program.lisp.~4013~:56-320` | Normative source |
| Pop-up Help frame | `help-frame.lisp.~22~:61-208,217-386` | Normative source; runtime capture open |
| DEX frames and loop | `nsage.lisp.~102~:226-243`; `examiner.lisp.~81~:57-521` | Normative source plus Standard-frame runtime |
| DEX candidates/bookmarks/help state | `examiner.lisp.~81~:523-749`; `dynamic-dex.lisp.~65~`; `dexcom.lisp.~59~:250-435` | Normative source plus Help/search runtime |
| DEX candidate/title/format substrate | `strings.lisp.~193~:657ff`; `displayer.lisp.~161~:682ff`; `formatter.lisp.~220~:139ff`; `defs-directives.lisp.~115~:1400ff`; `compressed-database.lisp.~44~:420ff` | Normative source for tokenization, matching, formatted line sources, and rendered titles |
| DEX commands/menus/gestures | `dexcom.lisp.~59~:60-248,437-1132` | Normative source |
| DEX imported Sage commands/translators | `nsage/commands.lisp.~75~:565-599,738-762,1083-1200` | Normative source; paired source-type expansion and example/variable effects retained |
| DEX optional hardcopy | `hardcopy-dexcom.lisp.~1~:55-187` | Source normative when module selected; installed-name runtime only |
| DEX optional Development Utilities | `cp/development-commands-2.lisp.~35~:491ff`; `examiner.lisp.~81~:344-354` | Overlay normative only when command is present at installation |
| DEX optional Concordia editing | `concordia/ed-record.lisp.~98~:620-648` | Source normative only when Concordia overlay selected |

## Architecture and ownership boundaries

The historical systems route a Help request to the metadata authority appropriate
to its context. No single global help database owns all answers:

```text
TV keyboard ingress
├─ System prefix -> mutable program-selection registry -> generated System Help
├─ Terminal/Function prefix -> mutable display-command registry -> generated Help
└─ selected ZWEI/Zmacs window -> active command-table chain
   └─ editor Help dispatcher -> command properties, hooks, prefixes, menus, macros

Lisp object or function query
└─ symbol/function/debugging/flavor metadata -> documentation or structural report

Genera Dynamic Windows application
├─ Help Program -> program mapping -> Sage topic index -> Show Documentation
├─ pop-up Help frame -> current renderer plus Help-frame command table
└─ Document Examiner -> viewers/candidates/bookmarks -> Sage records and streams
```

Ownership MUST remain explicit:

- TV owns physical keyboard ingress, System/Terminal prefixes, window selection,
  pop-up/typeout surfaces, pointer routing, and the mutable keyboard registries.
- ZWEI/Zmacs owns active command-table lookup, aliases, prefixes, named-command
  completion, macros, command hooks, editor numeric arguments, and typeout.
- D07 editor Help owns the staged Help dispatcher and presentation of lookup results;
  it does not own the command effects it describes.
- Lisp owns symbol properties, definitions, compiled debugging records, and general
  documentation types. Flavors owns component, variable, property, and method
  metadata. A missing value in one registry says nothing about another registry.
- Command Processor owns Dynamic Windows command definitions, named-command input,
  accelerators, menu handlers, and argument acquisition.
- Help Program owns only the mapping from an application concept to a candidate Sage
  topic and the availability cache. Sage owns topic/record lookup and display.
- The pop-up Help program owns its reusable frame, title, display callback, and burial
  behavior. The caller owns the content function.
- Document Examiner owns viewers, candidate and bookmark state, its command/menu
  surface, layout choice, command/background queues, and private-document reference
  list. Sage owns installed record content, tokenization/search primitives, formatted
  display, and kept documentation streams.
- Dynamic Windows owns typed presentations, gesture selection, incremental redisplay,
  Accept input, pane layout, and generic Input Editor behavior.
- Hardcopy owns printer transport and device failures. DEX merely filters eligible
  destinations and determines the record sequence.
- CLIM owns none of these selected historical paths.

## Semantic data and state model

### Documentation value and command descriptor

| Field | Meaning | Observable constraints | Evidence |
| --- | --- | --- | --- |
| `owner` | symbol, command, function object, method, flavor, menu, or topic | identity is not inferred from display text alone | `C46-SRC`, `C303-SRC`, `G85-SRC` |
| `kind` | command name, full/short command doc, function/variable/type/etc. doc, structural description | lookup path is kind-sensitive | same |
| `static-value` | stored string or absent | absence remains distinct from empty text | same |
| `computed-function` | optional function that derives name/full/short text | receives the selected context arguments | same |
| `source-generation` | command-table, registry, topic-index, or help-tick generation | changes invalidate dependent output | same |

For ZWEI command documentation, a computed documentation function receives the
command, the invoking character or `NIL`, and one of name/full/short. Full key
documentation additionally runs every active command hook that has a documentation
function. A generic Lisp documentation accessor MUST NOT be substituted for this
protocol.

### Keyboard registry row

| Field | System registry | Terminal/Function registry |
| --- | --- | --- |
| key | normalized character after prefix | normalized character after optional numeric prefix |
| target | window, flavor, expression, or activity | function or expression |
| documentation | displayed program description | string, computed string/list, or absent |
| options | creation rule | typeahead preservation, keyboard-process execution, or ordinary spawned process |

Rows are mutable and their order is observable in Help. A documentation value of
`NIL` hides a Terminal row from Help without unbinding it. System 303 System Help
sorts a copy and suppresses repeated character rows and invalid flavor names; System
46 formats its current list directly.

### Help dispatcher state

| Field | Meaning |
| --- | --- |
| `display-options` | profile-defined rows whose prompt predicates currently evaluate true |
| `accepted-options` | profile-defined rows accepted by validation regardless of prompt filtering |
| `last-option` | persistent last non-Space input; initially `B` in C46, C303, and G85 |
| `inside-help` | dynamically true while the dispatcher is reading or invoking |
| `repeating` | dynamically true only after `Space` substitutes `last-option` |
| `query-context` | active comtab, buffer/change history, playback support, minibuffer state |

The dispatcher does not commit a new `last-option` for `Space`; it substitutes the
old option and marks the request as a repeat. A selected option may mutate the
current editor independently, notably Undo.

### Help Program state

| Field | Meaning | Invalidation |
| --- | --- | --- |
| program identity | current Help Program object and pretty name | program destruction/replacement |
| command table | inherited Dynamic Windows table used for command/menu completion | table mutation |
| topic mapping | overview, command, menu item, title, or AVV prompt components | program method change |
| availability cache | key `(program, components...)` to available record pair or negative result | any change to Sage topic-array fill pointer clears the whole cache |
| cache tick | last observed topic-array fill pointer | compared before each lookup |

The cache key retains the program object. Negative and positive results are both
cached. A lookup MUST clear all entries before consulting the table when the fill
pointer differs. Historical `HD-G85-HELP` deliberately does not detect a same-length
in-place replacement, so such a replacement can leave either result stale. A safer
implementation MAY add a content-generation counter only as an explicitly
nonhistorical mode.

### Pop-up Help frame state

| Field | Meaning |
| --- | --- |
| title | caller-supplied current title or `NIL` |
| redisplay function | caller-supplied renderer, temporarily suppressible while clearing |
| lookup domain and frame/window identity | optional console/superior domain plus its findable reusable nonselectable program window |
| selected/exposed state | determines whether selection and optional wait occur |
| deexpose recursion guard | prevents recursive burial during deexposure |

### Document Examiner records

| Object | Required state |
| --- | --- |
| record group | topic, record type, installed/published record identity, title and relations |
| DEX item | record-group reference, display string, hierarchy level, seen contexts, formatted boxes, first/last presentations |
| candidate query | original words, token list, match mode, word-order condition, reason string, result set |
| candidate contents | current sorted result list plus prior-query history |
| viewer context | unique name, ordered displayed items, current item, bookmarks, and viewing history |
| bookmark contents | ordered growable sequence of DEX items |
| self-help record | computed record group, command registry tick shown, generated directives |
| frame state | selected Standard/Small class, current viewer, viewer list, panes, command queue |
| background state | process-wide background queue, kept Sage streams, timeout start and expiry flags |

### Invariants

1. A command description resolves against the active command environment at request
   time; cached static prose MUST NOT override a changed effective binding.
2. Alias resolution preserves the original active table as the lookup authority and
   prefix descent changes only to the referenced child table.
3. Missing, unimplemented, prefix, macro, menu, and ordinary command results remain
   distinct states.
4. System and Terminal Help enumerate the registry that drives execution, subject
   only to their source-defined visibility filters.
5. General Lisp, editor-command, flavor, Help Program, and Sage documentation are
   independent namespaces; `NIL` in one MUST NOT erase another.
6. A Help Program cache entry is considered reusable exactly when its recorded Sage
   topic-array fill pointer equals the current one; no content or identity check is
   implied.
7. At most one current viewer exists per DEX frame; every displayed item and bookmark
   belongs to a viewer context and retains its record-group identity.
8. Candidate replacement changes the candidate pane/history without discarding the
   viewer's displayed-topic sequence or bookmarks.
9. A PSB private document contains a count and topic/type references, not copied
   documentation bodies.
10. The computed DEX Help record is regenerated when and only when forced or its
    installed command-documentation tick has changed.
11. Queue removal occurs without interrupts only after the corresponding request has
    run or its error restart has chosen to skip it.
12. Closing kept Sage streams attempts normal closure first, then abort closure on
    error, and removes a stream only after one close path succeeds; double failure
    retains it.
13. Standard versus Small DEX selection depends on inside width: `> 950` selects
    Standard; `<= 950` selects Small.

## Complete effective input and gesture trees

### Normative companion incorporation

The following repository documents are normative dependencies rather than general
background:

| Profile and scope | Normative companion | Incorporated boundary |
| --- | --- | --- |
| C46/C303 editor entry and inherited context | [EINE, ZWEI, and Zmacs editor-family specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md#complete-effective-input-and-gesture-trees) and [MIT ZWEI/Zmacs bindings](mit-cadr/zwei-zmacs-keybindings.md) | every base, prefix, mode, reader, minibuffer, pointer, and inherited editor leaf through the active Help key |
| G85 editor entry and inherited context | [editor-family specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md#complete-effective-input-and-gesture-trees), [Genera Zmacs bindings](genera/zmacs-keybindings.md), and [named commands](genera/zmacs-named-commands.md) | every fixed Zmacs table, context, presentation action, translator, and named-command candidate through the Help command |
| C46/C303 global prefixes | [program-selection specification](program-selection-activities-and-window-management-reimplementation-specification.md#complete-input-binding-trees) and [TV specification](mit-cadr/tv-window-system-reimplementation-specification.md#keyboard-and-mouse-input) | physical System/Terminal ingress, selection registry, creation modifier, cancellation, typeahead, and global intercept behavior |
| G85 global Help and DEX entry | [program-selection specification](program-selection-activities-and-window-management-reimplementation-specification.md#complete-input-binding-trees) and [Dynamic Windows specification](genera/dynamic-windows-reimplementation-specification.md#program-frameworks) | Select/Function/Symbol-Help ingress, activity selection, System/Create menus, program-frame creation, and command-table program presentations |
| G85 Dynamic Windows input | [Dynamic Windows specification](genera/dynamic-windows-reimplementation-specification.md#typed-input-and-accept) and its [handler catalog](genera/dynamic-windows-reimplementation-specification.md#configured-built-in-handler-catalog) | Input Editor base map, numeric arguments, command input, presentation resolution, menus, marking, scrolling, and fallthrough |

This specification adds every D07-owned stage and leaf below. If a companion and
this specification disagree at the same pinned revision, that is a conformance and
documentation defect; neither timestamp selects a winner. Runtime/site/user/patch
overlays MUST be exported separately from the pristine source profile.

### Editor Help entry and precedence

The editor-level tree is:

```text
effective editor input
└─ profile's inherited Help binding -> COM-DOCUMENTATION
   └─ uppercase one-character D07 dispatcher
      ├─ direct option -> option command
      ├─ Space -> substitute persistent last option and set repeat flag
      ├─ dispatcher-help option -> display dispatcher documentation, then reprompt
      ├─ profile-specific abort/cancel -> abort or return
      └─ other -> beep and read again
```

The active ZWEI/Zmacs command table remains dynamically bound while an option runs.
Consequently `C`, `A`, `D`, and `W` describe the mode, application, task, prefix,
and user overlays actually active at entry. The Help dispatcher MUST NOT flatten or
cache that table before reading its option.

### System 46 ZWEI dispatcher

| Stage-one key | Leaf | Additional input and result | Invalid/abort semantics | Evidence |
| --- | --- | --- | --- | --- |
| `A` | Apropos | read substring; list matching named commands, short docs, and known invocation paths | reader abort propagates editor abort | `C46-SRC` |
| `B` | Basic ZWEI | view `AI: ZWEI; BASIC ZWEI` | file failure is retained; selected public target is only a 53-byte placeholder | `C46-SRC` |
| `C` | Self Document | read one mouse-or-keyboard character; traverse the key tree below | reader abort propagates | `C46-SRC` |
| `D` | Describe Command | complete over named commands; empty input aborts; print full command doc | completion ambiguity/failure remains a reader result | `C46-SRC` |
| `L` | What Lossage | show recent input history | dependency-owned failure | `C46-SRC` |
| `U` | Undo | run the ordinary editor Undo command | ordinary D05 Undo behavior | `C46-SRC` |
| `V` | Variable Apropos | read substring and search documented editor variables | reader abort propagates | `C46-SRC` |
| `W` | Where Is | complete command; enumerate all reachable keys; empty input aborts | report no keys rather than inventing one | `C46-SRC` |
| `Space` | repeat | substitute `last-option`; initial value is `B` | target failure is the selected option's failure | `C46-SRC` |
| `?` | dispatcher Help | show the full dispatcher documentation and reprompt | no option command commits | `C46-SRC` |
| `Control-G` | abort | invoke the editor error/abort path | leaves no new last option | `C46-SRC` |
| `Rubout` | invalid | none | beep and reprompt; unlike C303, this is not an abort key | `C46-SRC` |
| any other character | invalid | none | beep and reprompt | `C46-SRC` |

Letters are uppercased before matching. `?` displays Help but is still stored as the
last non-Space option before the next loop iteration; a subsequent `Space` therefore
replays dispatcher Help. Options that return normally end the dispatcher except the
dispatcher-help branch, which deliberately reprompts.

### System 303 ZWEI dispatcher

| Stage-one key | Leaf and availability | Additional behavior | Evidence |
| --- | --- | --- | --- |
| `C` | Self Document, always displayed | accepts a key, mouse character, or special scroll object | `C303-SRC` |
| `D` | Describe Command, always displayed | completed named command | `C303-SRC`, `C303-RUN` |
| `L` | What Lossage, displayed only when input handles playback | remains accepted even when hidden because validation tests alist membership, not the predicate | `C303-SRC` |
| `A` | Current Mode Apropos, always displayed | searches only commands accessible through the current-mode path | `C303-SRC` |
| `U` | Undo, always displayed | invokes the ordinary editor Undo command | `C303-SRC` |
| `V` | Variable Apropos | dependency-owned search | `C303-SRC` |
| `W` | Where Is | completed command and effective binding search | `C303-SRC` |
| `Space` | repeat | substitutes `last-option`, initially `B`; since `B` is absent, a fresh repeat finds no function and silently reprompts | `C303-SRC` |
| `Help` | dispatcher Help | prints dynamically filtered choices and reprompts | `C303-SRC`, `C303-RUN` |
| `?` | **unreachable source branch** | post-validation code would treat it as dispatcher Help, but the accepted-character predicate omits it | `C303-SRC` |
| `Control-G`, `Rubout` | abort | complete the query display and invoke editor abort | `C303-SRC` |
| any other character, including `?` | invalid | beep and reprompt | `C303-SRC` |

An exact `HD-C303` implementation MUST preserve the hidden-but-accepted `L`
distinction, the fresh-`Space` no-op loop, and the unreachable `?` branch. A
corrected extension MAY accept `?` and initialize repeat to a reachable option only
when labeled nonhistorical.

The display predicate on C303's `L` row is an arbitrary evaluated form rather than
a pure availability bit. Its side effects and conditions occur while the prompt is
built. Strict compatibility retains that ordering; a sandboxed implementation MAY
constrain predicates only as a documented nonhistorical safety profile.

### Genera 8.5 Zmacs dispatcher

| Stage-one key | Leaf | Additional behavior | Evidence |
| --- | --- | --- | --- |
| `A` | Apropos | normally searches command names and first documentation lines; any numeric argument restricts it to names; configured synonym sets are processed after the search regardless of whether matches occurred | `G85-SRC` |
| `C` | Self Document | reads keyboard or mouse input and resolves it in the active comtab | `G85-SRC` |
| `D` | Describe Command | accepts any extended command and reports binding plus full documentation | `G85-SRC` |
| `L` | Last Commands | prompt displays it only if playback is supported, but validation still accepts it | `G85-SRC` |
| `T` | Teach Zmacs | load tutorial on demand if command absent, suppressing load chatter, then execute the Command Processor command | `G85-SRC` |
| `U` | Undo | prompt displays it only with buffer history, but validation still accepts it | `G85-SRC` |
| `V` | Variable Apropos | dependency-owned search | `G85-SRC` |
| `W` | Where Is | report all effective invocations or explicitly say unavailable in current context | `G85-SRC` |
| `Space` | repeat | substitute persistent last option and adjust minibuffer history to repeat the leaf directly | `G85-SRC` |
| `?`, `Help` | dispatcher Help | display dispatcher documentation and reprompt | `G85-SRC`, `G85-RUN` |
| `Control-G` | abort | clear the typein window and invoke editor abort | `G85-SRC` |
| `Abort`, `Rubout` | quiet exit | retain mark, clear typein, return `DIS-NONE` without running an option | `G85-SRC` |
| any other character | invalid | beep and reprompt | `G85-SRC` |

Teach Zmacs has a three-outcome setup transaction: an already installed command
skips loading; a missing file produces an editor error naming the tutorial target;
another setup condition produces an editor error carrying the condition. Only a
successful setup invokes the named tutorial command. Licensed tutorial content is
outside the redistributable specification.

Genera inherits the lineage's initial `last-option = B` even though its dispatcher
has no `B` row. Fresh Space therefore substitutes B and silently reprompts. `?` and
Help are ordinary non-Space inputs for repeat state: each becomes `last-option`, so a
following Space replays dispatcher Help.

### Key-documentation recursive tree

All three editor profiles implement this semantic resolution tree, with the
profile-specific representation differences stated afterward:

```text
Document Key <input>
├─ absent / NIL -> report undefined
├─ symbol
│  ├─ lacks command-name metadata -> report named implementation missing
│  └─ named command -> print name and implementation identity
│     -> run every active hook documentation function
│     -> print computed or stored full documentation
├─ alias pair -> reconstruct target character -> restart lookup
├─ keyboard macro -> report macro identity and argument/repeat rule
├─ prefix object -> read one child
│  ├─ `*` -> enumerate every defined child with short documentation
│  └─ other -> recurse in child table; prefixes may nest
├─ menu command -> enumerate menu members
└─ other object -> report malformed/garbage binding
```

System 46 scans four modifier rows by 220 octal character cells when listing a
prefix. System 303 supports sparse inherited command tables as well as arrays and
adds a special explanation when the selected input is a mouse-scroll object. Genera
normalizes a modifier-free prefix child to uppercase, presents function identities
semantically, and retains nested prefix recursion.

Two defects are profile-visible. System 46's prefix-listing renderer keeps only one
prefix variable, so recursion deeper than one prefix can lose ancestor characters
in the printed invocation. System 303 converts a recognized mouse tuple to a
character, but an unknown non-Scroll cons enters a loop that neither changes nor
rereads the input. Strict-defect tests preserve those results under a watchdog; the
default safe mode MUST report the lost-prefix condition or invalid mouse object
without hanging and label that behavior `INF`.

Aliases in the historical code have no cycle guard. A default clean-room
implementation MUST detect a repeated `(table, character)` pair and report an alias
cycle without hanging. An isolated strict-defect test MAY reproduce historical
nontermination; this safety correction MUST be labeled `INF`.

### Named-command queries

| Operation | Required algorithm | No-result behavior |
| --- | --- | --- |
| List Commands | traverse inherited extended-command lists in profile order; show one-line doc | empty list still ends with completion marker |
| Apropos | obtain profile-specific matcher; test name and profile-selected doc region; report invocation path; G85 then processes configured synonym sets unconditionally | explicit no-match result remains separate from any G85 synonym proposals |
| Where Is | complete/select a command; recursively enumerate effective keys and Help-dispatch aliases | report no keys / unavailable in current context |
| Describe Command | complete/select; show semantic command identity, invocation summary where profile supplies it, then full doc | input cancellation aborts without a false entry |
| Document Containing Command | describe the active outer minibuffer command and, where present, its current argument documenter | absent command metadata remains absent |

Where Is and Apropos MUST traverse prefixes and current table inheritance according
to D05. Presence in a global named-command alist does not prove availability in the
current mode. Genera deduplicates repeated physical characters while scanning the
full keyboard/mouse character domain.

System 303 Where Is deliberately omits mouse commands, and its result-limit test is
off by one: a requested limit can print `limit + 1` matches. Both CADR profiles also
have a valid `:SMALL-FRACTION` editor-variable type that their value printer fails to
handle; three built-ins therefore show a label without a value in List Variables,
Variable Apropos, and Describe Variable. Those are compatibility defects, not
missing specification values. C303's generic Lisp Apropos has a separate
list-of-packages plus inheritors defect: it iterates a package variable but asks for
used-by packages of the whole list. The conformance suite MUST isolate these from
the editor command-search registry.

### System and Terminal prefix trees

The D07 Help-owned leaves sit inside the D02/TV global tree:

```text
System
├─ `?` or `Help` -> generate System Help from effective registry -> wait for flush input
├─ Rubout -> no selection
├─ <registered key, exact modifier identity> -> apply the profile row policy
└─ unregistered -> no selection; profile-specific beep only where source does so

Terminal / Function
├─ repeated digits and optional `-` -> numeric state -> continue reading
├─ `?` or `Help` -> generate Terminal/Function Help from effective registry
├─ Rubout -> cancel quietly
├─ registered key -> preserve typeahead if flagged -> run in keyboard or new process
├─ asynchronous character -> quote it back to keyboard input where supported
└─ other -> C46 returns quietly; C303 beeps
```

The non-Help System leaves are normatively incorporated from D02 rather than
redefined here. In C46 the lookup preserves the exact modifier bits, and an ordinary
registered row auto-creates when no eligible target exists according to that row's
policy. In C303, Control explicitly forces creation and is stripped before row
lookup. A reimplementation MUST NOT project the latter rule backward onto C46.

The complete source-initial System 46 System registry is `E` Editor, `I` Inspector,
`L` Lisp, `P` Peek, `R` window error handler, `S` Supdup, and `T` Telnet. The
registry remains mutable; the effective runtime dump, not this initialization list,
controls Help. The fresh System 303 world instead displayed Top-L Lisp(Edit), `E`
Editor, `I` Inspector, `L` Lisp, and `P` Peek.

The source-initial Terminal registries are included here because Help enumerates
their actual execution table:

| Profile | Ordinary documented or potentially documented leaves | Wizard/post-separator leaves | Hidden Help entries |
| --- | --- | --- | --- |
| C46 | Break, Clear, Form, `A`, `C`, `D`, `E`, `F`, `M`, `O`, `Q`, `S`, `W`, Hold-Output | Call, Control-Clear, Control-T, Control-G | `?` and Help invoke Help but have `NIL` row documentation |
| C303 | Clear, Resume, one nonprinting Set-Mouse-Screen key, Form, `A`, `B`, `C`, `F`, `G`, `H`, `I`, `M`, `N`, `O`, `Q`, `S`, `T`, `V`, `W`, Hold-Output | Call, Control-T, Control-Clear, Control-A | `?` and Help invoke Help but have `NIL` row documentation |

Terminal Help MUST omit any row whose documentation form evaluates false, preserve
multi-line documentation, mark the post-`NIL` separator section as wizard commands,
append the profile's fixed function-key summary, and wait for one flush input. The
physical identity of System 303's nonprinting Set-Mouse-Screen initializer remains
`TODO-RUNTIME-HD-TERM-CODE`; implementations MUST retain its raw character identity
from their selected source rather than guess a modern key name.

C46 numeric accumulation multiplies the current value by eight before adding each
accepted digit, even though its accepted range includes `8` and `9`. C303 uses
decimal accumulation. Minus negates the accumulated value or supplies `-1` when no
digits were entered. A conforming profile MUST preserve that difference.

Pressing Terminal again resets C46's accumulated argument and minus state. The same
input is merely an unknown key in C303. C303's source initializer for Terminal `N`
contains consecutive strings while the Help printer reads one documentation slot;
System patch 100.14 instead installs a quoted list of the three lines. Which form is
live in the selected `System 303-0` band remains
`TODO-RUNTIME-HD-C303-TERMINAL-N`; a source-profile implementation MUST select the
unpatched initializer or the named patch rather than concatenate them silently.

### Genera global Help and Document Examiner entry tree

```text
Function prefix
├─ `?` -> registered `KBD-ESC-HELP` -> Function Help in matching pop-up frame
└─ `Help` -> same

Symbol-Help key
└─ keyboard Escape-character registration -> console function -> Symbol Help

Select prefix
├─ unmapped or firewall-disabled `?` or `Help` -> Select Help in matching pop-up frame
└─ `D` -> `CHOOSE-DOC-EX-FOR-SCREEN`
   ├─ inside width > 950 or both screen choices NIL -> Standard DEX
   └─ inside width <= 950 -> Small DEX

activity/program entry
├─ Command Processor Select Activity `Document Examiner` -> same chooser/activity
├─ System menu Programs `Document Examiner` -> same activity
├─ Create menu `Document Examiner` -> create program frame through chooser
└─ Help-frame activity presentation -> installed `SI::COM-SELECT-ACTIVITY`

source-defined DEX self-help side door
└─ select default DEX -> enqueue `COM-HELP` with standard output suppressed
   └─ DEX command queue later constructs/displays computed Help
```

D02 normatively owns Select/Function modifier normalization, firewall, cancellation,
and unknown behavior. D07 owns the Help/DEX leaves above. Debugger Control-Help is a
D12 caller of the same `SHOW-HELP` programmatic interface. The source-defined
`SAGE::SELECT-DOCUMENT-EXAMINER-WITH-SELF-HELP` side door is active, but the startup
presentation or other effective object that invokes it is outside the inspected D07
closure; record this as `TODO-RUNTIME-HD-G85-DEX-SELF-HELP-ENTRY` rather than inventing
a pointer gesture.

### Help Program command and gesture tree

```text
Help Program command input
├─ Help [topic]
│  ├─ no initial topic -> explain accepted concepts -> ACCEPT Help Topic
│  ├─ mapped string/list available -> resolve record group -> Sage Show Documentation
│  ├─ mapped string/list absent -> report not documented -> no Sage display
│  └─ record group -> Sage Show Documentation directly
├─ Command Help -> read a command in the current program -> map -> Help
├─ imported Show Documentation / Show Overview -> Sage operation
├─ injected `window-wakeup-help` presentation blip
│  └─ throw from command reading -> return `(NIL, NIL, :BLANK-LINE)`
└─ unrecognized command -> inherited Command Processor behavior

presentation/gesture input
├─ command-menu item + middle -> map menu label -> Help command if topic exists
├─ program title + middle -> map program name -> Help command if topic exists
├─ program-name presentation in Help-topic context -> record-group conversion
├─ AVV query in Help-topic context -> map query prompt -> record-group conversion
├─ command/menu/overview completion -> union of inherited live candidates
└─ no available topic -> translator inapplicable, allowing normal handler fallthrough
```

The logical `:command-menu-help` gesture is mapped to Mouse-Middle. Ordinary left or
right menu behavior remains owned by the client command table. The block-commented
Show Missing Help implementation is not a command and MUST NOT appear in the base
effective tree.

### Pop-up Help frame bindings

| Context | Input | Operation | Precedence/fallthrough | Evidence |
| --- | --- | --- | --- | --- |
| Help frame | `End`, `Abort` | bury/exit | direct Help-table accelerator | `G85-SRC` |
| Help frame | `Help` | display Help about the Help frame | direct Help-table accelerator | `G85-SRC` |
| display pane | `Scroll`, `Meta-Scroll` | forward/backward screen scrolling | inherited Input Editor compatibility | `G85-SRC` |
| display pane | `Meta-<`, `Meta->` | beginning/end | inherited | `G85-SRC` |
| display pane | `Control-S`, `Control-R` | forward/backward displayed-text search | inherited | `G85-SRC` |
| display pane | `Control-Mouse-Left` | mark text | typed Input Editor context | `G85-SRC` |
| display pane | `Control-Mouse-Right` | marked-text operation menu | typed Input Editor context | `G85-SRC` |
| display pane | `Super-W`, `Meta-W` | push marked text to ZWEI kill ring | inherited compatibility | `G85-SRC` |
| frame | `Refresh` | redisplay | inherited standard command | `G85-SRC` |
| pseudo-menu | first Exit item, menu accelerator | bury frame | direct menu command | `G85-SRC` |
| activity presentation / command route | Select Activity | installed `SI::COM-SELECT-ACTIVITY` | Dynamic Windows presentation/command resolution | `G85-SRC` |
| other key/gesture | none D07-specific | inherited Help Program, Standard Arguments, Input Editor Compatibility, then unbound | dependency tree controls | `G85-SRC` |

The Help application owns no D07-local prefix family; inherited scrolling registers
do add Control-Meta-S and Control-Meta-R second-stage characters. The compact
precedence table above is expanded normatively, including every alias and numeric
case, under [Complete pop-up Help accelerator behavior](#complete-pop-up-help-accelerator-behavior).
The frame top level establishes a typed `SI:INPUT-EDITOR` context specifically so
Control-Mouse-Right can resolve.

### Document Examiner accelerator tree

Document Examiner owns no D07-local multi-character keyboard prefix. Its complete fixed core accelerator set
is:

| Input | Numeric argument handling | Command/effect | Failure or fallthrough | Evidence |
| --- | --- | --- | --- | --- |
| `Help` | disallowed; signals accelerator error | build/show computed command summary | record construction/display errors remain command errors | `G85-SRC`, `G85-RUN` |
| `Control-Meta-L` | absent or explicit `1` is coerced to `2`; other integers are retained | select the indexed prior viewing context | value above viewer count beeps; zero/negative reaches the substrate sequence-index error because no local guard exists | `G85-SRC` |
| `Space` | disallowed; signals accelerator error; ordinary echo suppressed | remove viewer typeout overlay / reset scroll position | no unrelated buffer insertion | `G85-SRC` |
| `Refresh` | disallowed; signals accelerator error | refresh current context | dependency errors propagate | `G85-SRC` |
| `Meta-<` | disallowed; signals accelerator error | beginning of first viewer topic | beep when no first item | `G85-SRC` |
| `Meta->` | disallowed; signals accelerator error | last displayed screen of last topic | beep when no last item | `G85-SRC` |
| `Scroll`, `Control-V` | absent/sign-only means screens; finite numeric means lines; signed infinity means end selection | pass the signed count to viewer scrolling | a negative count reverses the nominal direction; viewport failure remains substrate error | `G85-SRC` |
| `Meta-Scroll`, `Meta-V` | same, with infinity selecting beginning; negate the signed count | nominally scroll viewer backward | a negative argument reverses direction | `G85-SRC` |
| `Control-Scroll` | absent/sign-only means screens; finite numeric means lines; signed infinity selects end | pass signed count to typeout scrolling | negative reverses direction; typeout state governs | `G85-SRC` |
| `Control-Meta-Scroll` | same, with infinity selecting beginning; negate the signed count | nominally scroll typeout backward | negative reverses direction | `G85-SRC` |
| `Super-S`, `Super-R` | disallowed; signals accelerator error | search viewer strings forward/backward from visible range boundary | search input/error belongs to D28 | `G85-SRC` |
| `Super-G` | disallowed; signals accelerator error | clear marked text on all exposed inferiors | beep if none supports/contains regions | `G85-SRC` |
| `Super-W` | disallowed; signals accelerator error | concatenate marked regions with returns and push one interval to ZWEI kill history | beep if no region text | `G85-SRC` |
| any other key | inherited numeric/Input Editor/Command Processor resolution | named command input or unbound | top level treats an unknown accelerator as a command start | `G85-SRC` |

The generated Help deliberately suppresses duplicate display of `Control-V` and
`Meta-V` while retaining those aliases in the effective accelerator tree. Help's
preferred presentation order does not change command precedence.
The no-argument behavior above is not an inference from documentation: the standard
accelerator macro supplies an empty argument list, and Command Processor's default
`argument-allowed` setting rejects a preceding numeric argument. Only
Control-Meta-L and the explicitly parameterized scrolling families accept one.

### Document Examiner menus and named commands

The Standard frame's fixed top level is two columns of four. Left and right invoke
the direct command for the four Show items, Help, and Reselect Candidates. Select
Viewer and Read Private Document use left for their default command and right for
their submenu. Help additionally assigns middle to full installed documentation.

```text
Standard menu :top-level
├─ Show Candidates [L/R] -> Show Candidates
├─ Show Documentation [L/R] -> Show Documentation
├─ Show Overview [L/R] -> Show Overview
├─ Show Table of Contents [L/R] -> Show Table of Contents
├─ Help [L/R] -> computed command summary
│  └─ Help [M] -> Document Examiner Documentation
├─ Select Viewer
│  ├─ [L] -> Select Viewer
│  └─ [R] -> :viewer-commands submenu
│     ├─ Select Viewer
│     ├─ Remove Viewer
│     └─ Hardcopy Viewer, when optional module is installed
├─ Reselect Candidates [L/R] -> Reselect Candidates
└─ Read Private Document
   ├─ [L] -> Read Private Document
   └─ [R] -> :private-document-commands submenu
      ├─ Read Private Document
      ├─ Load Private Document
      ├─ Save Private Document
      └─ Hardcopy Private Document, when installed
```

The Small command table defines this exact staged menu tree. In the inspected
source, however, reader conditionals compile the `menu-pane` reference out of the
selected Small layout even though a pane definition remains. Therefore this is the
source-defined dispatch hierarchy, not a claim that two cells are visibly present or
that an effective user route reaches it in the unexercised frame:

```text
Small menu :small-top-level
├─ Show [L or R] -> :show-commands submenu
│  ├─ Show Documentation
│  ├─ Show Overview
│  ├─ Show Candidates
│  └─ Show Table of Contents
└─ Other [L or R] -> :other-commands submenu
   ├─ Help -> same L/R summary and M full-document split
   ├─ Select Viewer -> same viewer subtree
   ├─ Reselect Candidates
   └─ Read Private Document -> same private-document subtree
```

Both command tables expose the following active core named commands even when a
command has no fixed accelerator or visible top-level cell:

| Family | Named commands |
| --- | --- |
| topic/query | Show Documentation, Show Overview, Show Candidates, Show Table of Contents, Add Bookmark, Remove Item, Beginning of Topic, End of Topic, Show More of Topic, Reselect Candidates, Goto Beginning, Goto End, Remove Typeout Window, Show Forward Reference |
| Help | Help, Document Examiner Documentation |
| viewer | Select Viewer, Select Previous Viewer, Remove Viewer, Refresh, Scroll Viewer, Scroll Typeout Window, Scroll Search |
| marking | Clear Marked Text, Push Marked Text |
| private document | Save Private Document, Read Private Document, Load Private Document |
| Sage imports | Set Sage Variable, Clear Sage Variable, List Sage Variables, Run Documentation Example, Edit Documentation Example |
| conditional import | Edit Definition only if Development Utilities supplied the function at installation time |
| optional hardcopy | Hardcopy Viewer, Hardcopy Documentation, Hardcopy Private Document |

Source-block-commented test commands for moving topics, clearing history, manually
inserting/removing ellipses, and evaluating a form are not active and MUST NOT appear
in the base table.

### Document Examiner presentation tree

| Presented object | Gesture/context | Command or conversion | Shadowing/fallthrough |
| --- | --- | --- | --- |
| candidate `record-group` | left/default | Show Documentation | typed record handler wins over text-only fallback |
| candidate `record-group-name` | left/default after conversion/tester | Show Documentation | macro-generated twin of the record-group translator |
| candidate `record-group` | middle | Show Overview | only when translator applicable |
| candidate `record-group-name` | middle after conversion/tester | Show Overview | same applicability as converted record group |
| candidate `record-group` | Shift-middle | Add Bookmark | distinct from middle |
| candidate `record-group-name` | Shift-middle after conversion/tester | Add Bookmark | macro-generated twin |
| candidate `record-group` | right/menu | offer applicable topic operations, including Table of Contents and optional Hardcopy | Dynamic Windows resolver orders handlers |
| candidate `record-group-name` | right/menu | offer the corresponding converted operations | tester failure falls through |
| candidate `record-group` | gesture-`NIL` operation-menu leaf | Show Table of Contents | contributes no direct pointer accelerator |
| candidate `record-group-name` | gesture-`NIL` after conversion/tester | Show Table of Contents | macro-generated twin |
| candidate `record-group` / `record-group-name` | gesture-`NIL` when hardcopy overlay is selected | Hardcopy Documentation | paired optional translators; printer tester controls applicability |
| bookmark | left/default | Show Documentation after conversion to record group | retains bookmark identity for other gestures |
| bookmark | middle | Show Overview | — |
| bookmark | Shift-middle | Remove Item | opposite of candidate Shift-middle |
| bookmark | right/menu | offer applicable bookmark commands | gesture-`NIL` translators contribute menu-only leaves |
| Sage ellipsis | default selection | Show More of Topic for owning DEX item | absent/stale last presentation beeps |
| undefined reference box | applicable handler | Show Forward Reference | source-defined documentation/tester controls availability |
| record group/name with Development Utilities overlay | applicable operation-menu gesture | Edit Definition | installed only when its defining command is present |
| record group/name with Concordia overlay | applicable operation-menu gesture | Edit Documentation | installed only in `HD-G85-DEX+CONCORDIA` |
| `active-example` | default/select | Run Documentation Example | imported Sage translator; execution policy applies |
| `active-example` | `:edit-definition` gesture | Edit Documentation Example | opens a non-file Zmacs example buffer |
| Help menu presentation | left/right/middle | split described above | exact gesture wins before generic menu fallback |
| marked text region | inherited Control gestures | D28 marking/kill-ring operations | DEX Super-G/W operate across exposed panes |

The right-button menu is dynamically constructed from applicable translators; it is
not one static menu. Every exported effective-tree dump MUST record presentation
type, gesture, tester/applicability result, priority, composed conversions, owning
command table, selected handler, and shadowed candidates.

### Exhaustive binding enumeration requirement

For each selected profile and active context, the conformance runner MUST enumerate:

1. every physical/logical character and modifier supported by the release;
2. every D07 dispatcher stage and every recursively reachable editor prefix child;
3. System and Terminal numeric/prefix paths and the live registry generation;
4. every Help Program command/menu/title/AVV translation;
5. every Help-frame direct and inherited accelerator;
6. every DEX fixed accelerator, named command, Standard/Small menu path, optional
   module leaf, pointer/presentation gesture, and one unbound gesture; and
7. candidate tables/handlers in precedence order, normalization, numeric state,
   selected owner/leaf, shadowed values, Help exposure, and final effect-contract ID.

The enumerator MUST terminate on alias, prefix, command-table, presentation
conversion, and submenu cycles. It MUST dump pristine and live overlay graphs
separately. A name-only mapping without the behavioral contract below is `L1`
dispatch evidence, not `L2` conformance.

## Lifecycle, failure, and recovery model

### Editor dispatcher transaction

The dispatcher is a read/dispatch loop, not an atomic command transaction:

```text
enter COM-DOCUMENTATION
  -> retain current editor command-table/context bindings
  -> display profile-filtered prompt
  -> read one input object
  -> normalize only as the profile specifies
  -> Space substitutes persistent last option
  -> validate against profile option rows
     -> help row: display, retain its profile-specific repeat state, loop
     -> abort/quiet-exit row: perform profile cleanup, return or signal
     -> invalid row: beep or defect behavior, loop
     -> command row: update last-option at the source-defined point
        -> invoke leaf with current editor state
        -> return its display code, value, abort, or condition
```

The dispatcher does not roll back a leaf that changed a buffer, undo history,
minibuffer history, playback state, registry, or displayed output before failing.
The implementation MUST distinguish four outcomes: no leaf selected, leaf returned,
leaf aborted, and leaf failed after partial effect. The display predicate phase is
also observable in C303 and G85 because predicate evaluation can fail before input.

### Registry and generated-Help lifecycle

System and Terminal Help enumerate the registry that execution itself will consult.
A conforming mutable registry supplies at least these operations:

1. add a row while preserving the profile's duplicate and ordering rule;
2. remove a row by the profile's character-identity rule;
3. save and replay user modifications where the profile supports it;
4. enumerate rows in the profile's source-defined live-list or copied-list order;
   and
5. execute a selected row after Help returns.

C46 walks its live list without a lock or snapshot, while C303 System Help sorts a
copy. Concurrent-mutation behavior is therefore an unresolved historical oracle,
not a no-tearing guarantee. C303 System addition stacks a differing row for the same
character; removal removes
the first row and can reveal the prior definition. Its Terminal add function rejects
non-string user documentation even though built-in rows can contain computed forms,
lists, or `NIL`. Replaying user Terminal modifications re-adds saved rows without the
`:SYSTEM` flag and can duplicate entries. These are strict-profile behaviors. An
implementation that replaces them with unique-map semantics or a normalized schema
MUST expose that as a corrected profile.

Both CADR Help displays dismiss after **any** input character even when their prose
asks for Space. C46 keeps its escape-prefix time marker set during the Help wait and
clears it only when the handler returns; C303 clears it before waiting. Input read to
dismiss Help is consumed. Registry mutation concurrent with rendering MAY affect the
current or a later render according to the selected profile's list operations. A
safe snapshot mode MUST be labeled `INF`.

### Help Program mapping and cache lifecycle

Help Program maps a client object or string to an ordered Sage topic specification.
The base historical cache key is only the fill pointer of the Sage topic array:

```text
request mapping
  -> read current topic-array fill pointer
  -> if equal to cached fill pointer, reuse availability map
  -> otherwise rebuild map and store the new fill pointer
  -> resolve requested mapping against cached availability
  -> applicable: enter Sage Show Documentation
  -> unavailable: issue the not-documented result
```

Replacing topic records while preserving the fill pointer can therefore leave a
stale availability result. `HD-G85-HELP` MUST preserve that defect. An optional safe
profile MAY add a content generation or identity but MUST demonstrate the differing
same-length replacement case. The mapping, availability test, candidate completion,
and final Sage display are distinct stages; a successful map does not prove the
record can still be opened.

### Pop-up Help frame lifecycle and stale-display boundaries

A request finds or creates a matching nonselectable Help program window in the
caller's optional console/superior lookup domain. One may be precreated before cold
boot when site conditions permit, but source does not prove one global singleton.
The request installs a title and renderer, exposes that matching frame, and forces
redisplay only according to the caller's cache rule. End, Abort, or the first
pseudo-menu item buries the frame; it does not destroy it. A later request in the
same lookup domain can therefore expose the same frame with retained pane identity
and scroll state subject to the caller's redisplay action.

Function Help compares the **identity** of `TV:*FUNCTION-KEYS*` with the last list.
Replacing the list forces a refresh; mutating rows or documentation in place can
leave the reused display stale. Select Help starts with a `T` sentinel, flips it to
`NIL` after its first display, and has no source-visible registry generation, so
later Select-table or enablement changes can also remain stale. Symbol Help combines
fixed explanation with live console-type details and has no equivalent generation.
Changing the installed title/renderer or explicitly forcing redisplay remains a
separate refresh cause. These stale cases are normative defects for the strict
profile.

### Document Examiner lifecycle

DEX startup is ordered:

1. select `doc-ex` for inside width above 950 pixels, otherwise `small-doc-ex`;
2. create or reactivate the program framework and its viewing-context collection;
3. initialize the default viewer if no current context exists;
4. observe commands and translators already installed by the selected subsystem and
   optional-module load order;
5. establish viewer, candidate, bookmark, typeout, and command-loop state; and
6. enter the Dynamic Windows top-level loop.

Selecting a viewer snapshots the old viewer's dynamic display context, changes the
current viewing context, restores or initializes the new one, updates candidate and
bookmark panes, and redisplays affected panes. Previous-viewer selection is indexed
over the viewing-context sequence with the exact coercion and error cases in the
accelerator table. Removing a viewer deletes it, then selects another context. If no
viewer remains, DEX creates and selects a fresh empty `Default Viewer` before
resetting the current viewer and display. Asking to select a nonexistent viewer
without creation prints an error to `*ERROR-OUTPUT*`; it is not a local beep.

DEX catches queued documentation errors at its work-loop boundary, offers the
source-defined error restart/skip behavior, and removes a queue item only after it
was processed or explicitly skipped. Queue order is FIFO. A failed operation can
leave already-created viewers, display records, stream handles, typeout, or history;
there is no enclosing database transaction.

### Stream and shutdown recovery

Sage record streams retained for redisplay are eligible for idle closure after
approximately one minute. Closure first attempts the ordinary close; if that fails,
DEX attempts abort close. A stream is removed from the tracked set only after normal
or abort close succeeds; if both fail, the condition escapes before removal and the
stream remains tracked. The implementation MUST log normal close, abort close,
both-failed, and already-removed separately.

Generic Dynamic Windows exit/deactivation is dependency-owned; the selected D07
source establishes no exit-time stream-close guarantee, and its viewer deactivation
method is commented out. Retained streams are governed by the idle mechanism only
while the top-level loop runs. Exit does not imply an Open Genera Save World, host
checkpoint, persisted private document, or closed Sage stream. Preserved-runtime
harness shutdown is evidence external to D07 and MUST retain prompt, confirmation,
cleanup, forced termination, and private-world hash outcomes separately.

## Lisp and flavor documentation contracts

### System 46 function documentation precedence

`HD-C46` resolves function documentation in this exact order:

1. For a symbol, recurse into its function definition when it is function-bound;
   if that yields `NIL` or the symbol is unbound, fall back to the symbol's
   `:DOCUMENTATION` property.
2. For a lambda or named-lambda form, skip the name where present, argument list,
   and optional declaration; return a leading string only when at least one body form
   follows it. A sole string body therefore returns `NIL`.
3. For a macro definition, recurse into the macro expansion function.
4. For another function specifier, recurse into its function definition when one
   exists.
5. For a compiled FEF, return `:DOCUMENTATION` from debugging information.
6. Otherwise return `NIL`.

Quick/brief editor description may print an implementation identity and first line;
long description prints the retained documentation body. Those presentation modes
MUST use this retrieval result without treating an editor-command documentation
property as a Lisp function docstring.

### System 303 typed documentation precedence

`HD-C303`'s general `DOCUMENTATION` accepts an object and a document type. Its
observable precedence is:

1. type `VALUE` plus a symbol `:DOCUMENTATION` property;
2. a symbol's `DOCUMENTATION-PROPERTY` association selected by string equality after
   converting the requested document type to a string;
3. type `TYPE`, through the object's type-expander function documentation;
4. type `SETF`, through its SETF-method function documentation;
5. any remaining type other than `FUNCTION`, returning `NIL`;
6. a function-bound symbol, after removing encapsulation, recursively documenting
   its definition;
7. a cons or function-like object: macro expansion function first; otherwise
   debugging information under `DOCUMENTATION`, then `:DOCUMENTATION`, then an
   extracted lambda-body docstring; a defined nonfunction specifier recurses;
8. a compiled function: a combined-method special case, otherwise the same debugging
   documentation lookup.

The first successful applicable branch wins. A branch that returns `NIL` does not
license a fallback to editor command metadata. The observed world returned `NIL`
for `(DOCUMENTATION 'CAR)` and for the Dired command symbol while editor Help could
still describe Dired, directly proving the registry separation.

### Flavor structural description

The flavor report is a structural renderer, not merely a docstring. For a defined
flavor it MUST preserve source order while reporting every available category:

- direct dependencies, included flavors, flavors depending on it, and transitive
  components;
- local and inherited instance variables, declared access, defaults, and total
  instance size;
- before, primary, after, wrapper, and other methods, including owning flavor and
  generated status;
- generated getter, setter, and initializer methods;
- accepted initialization keywords, default initialization property list,
  outside-access macros, and random flavor properties; and
- method table/hash information and any release-visible implementation metadata.

An undefined flavor takes the release's absence path and MUST NOT fabricate an empty
report. An error while printing one method or metadata field can leave prior report
text visible. C46 and C303 representations differ, so conformance compares semantic
rows and order within a selected profile rather than byte-identical prose.

## Editor self-documentation leaf contracts

### Command search and description

C46 and C303 Apropos search command **names only**. C46 reports at most four known
invocation paths per match. C303 distinguishes a direct/local binding, a local
extended-command route, and any extended-command route; its limit defect can emit
one more result than requested. G85 alone normally searches names and first
documentation lines, while any numeric argument restricts matching to names.
Configured synonym sets are processed after the match/no-match output in either
case, so a synonym proposal may accompany successful command matches.

Describe Command accepts a named command, resolves the selected implementation in
the current context, prints its invocation summary where the profile supplies one,
runs documentation hooks, and prints full documentation. A symbol with no command
documentation is silent in the historical key-document path rather than guaranteed
to print a placeholder. Where Is walks the profile's accessible command tables and
prefixes: C303 omits mouse commands and extended-command paths; G85 covers its full
keyboard/mouse domain and deduplicates physical characters.

Prefix `*` is a one-level enumeration. A child that is itself a prefix is described
as that child; its descendants are not recursively flattened until the user selects
it. The exhaustive conformance tool traverses recursively as a separate audit
operation and MUST NOT confuse that audit with historical on-screen output.

### Recent input history

C46 Lossage reads the circular input stream, retains number-valued character events,
orders them oldest to newest, and prints their key descriptions. C303 records input
at the window layer, requires the selected window to support `:PLAYBACK`, and skips
list-valued events while rendering. A hidden C303 `L` remains invocable even when
the prompt predicate says playback is unavailable; the resulting leaf behavior is
then controlled by the actual playback call.

### Undo

C46 Undo identifies the previous undoable interval, queries the user where required,
and replaces the interval with its saved prior contents. C303 distinguishes contained
from overlapping change records, queries over the selected change, removes it from
the undo list at the source-defined point, and then mutates the buffer. Neither path
is transactional: an injected error after history removal or partial interval change
MUST leave and report that partial state. D05 owns the general buffer/change model;
D07 owns the fact that the Help dispatcher invokes the ordinary Undo leaf.

### Editor variables

Variable Apropos matches variable names. Describe Variable completes a name; empty
completion enters the editor's `BARF`/abort path. The ordinary display prints a
value, and a numeric argument additionally requests documentation. The exact
supported renderers include Boolean, character, decimal, octal, string, atom, and
other source-defined categories. `:SMALL-FRACTION` is declared and used by three
built-ins but is not handled by the C46/C303 printer, producing a label without its
value. Strict profiles preserve this defect; corrected profiles MAY render it only
with an explicit delta.

### Dired contextual Help delta

C46 Dired binds `?` and Help directly to a static Dired-help command. C303 Dired and
BDired instead prepend `M` = Dired Help dynamically to the general dispatcher. The
observed System 303 sequence Help, `D`, Dired only proved generic named-command
description; it did not exercise contextual Dired Help. D06 defines the Dired
operation tree and incorporates this D07 leaf. A conforming profile MUST NOT expose
both contextual designs as if they were one release.

### Tutorial integration

C46 `B` announces and views the exact logical pathname `AI: ZWEI; BASIC ZWEI`.
Logical-host, open, or file failure propagates after the announcement. The public
53-byte placeholder is evidence for the entry point but is not the intended tutorial
and MUST NOT be accepted as recovered content.

C303 has a separate `COM-TEACH-ZMACS`: if the user's `Teach-ZMacs` file is absent it
copies the 29,879-byte public `SYS: ZWEI; TEACH-ZMACS TEXT`, then edits the private
copy; if present it preserves and edits that copy. It is not a C303 Help-dispatcher
leaf. Zwei patch 128.1 adds it to the extended command table, so its presence in a
loaded band is an oracle, not a deduction from the current maintained source.
Genera `T` instead loads its licensed example/tutorial component when the command is
missing and then invokes the Command Processor command. These three paths MUST remain
separate.

## Genera Help Program and pop-up frame contracts

### Topic mapping

A Help Program mapping is an ordered tuple of zero or more topic components and an
optional record type. A single string component is used without whitespace
normalization. Multiple or symbolic components are rendered and trimmed before
lookup; an all-space component can reach invalid trim indices and condition. The
strict profile preserves that edge. The availability cache records misses as well as
hits.

Availability means the Sage index contains the requested key. It does not prove that
an installed record can be opened. Overview completion adds an installed-record
check, so completion and direct translation can disagree. Menu completion walks all
inherited menu levels and can offer a mapped label whose topic is absent; invoking
Help then reports that it is not documented and opens no record.

### Client integration and semantic gestures

Clients may map program names, commands, menu labels, title presentations, and AVV
queries. Command Help first reads a command in the current client and then applies
the same mapping. Middle-click on an applicable command menu or title uses the Help
translation; left and right continue through the client's ordinary menu handlers.
The translator MUST be inapplicable rather than consuming input when the topic map
or availability test fails.

The keyboard Command Help path is different: it always calls Help with the mapping
result. If a client returns `NIL` for a successfully read command, Help treats that
as no initial topic, explains its accepted concept/command query, and performs a
second Help Topic accept. That is not translator fallthrough.

When top-level Help explanation is emitted with no partial command string, the Help
Program force-injects a `window-wakeup-help` presentation blip whose object is the
followed underlying stream. Its wakeup handler throws from command reading and
returns three values—`NIL`, `NIL`, and `:BLANK-LINE`—so the command loop flushes the
typeout state. A nonempty partial command does not inject this blip. Output preceding
an injection or handler failure remains visible; there is no rollback.

The source-block-commented missing-help auditor is absent. A reimplementation MUST
not expose it as an installed base command merely because its text exists in source.

### Complete pop-up Help accelerator behavior

The effective table is local Help, then Help Program, Standard Arguments, Input
Editor Compatibility, Standard Scrolling, and Marked Text. D28's typed
`SI:INPUT-EDITOR` 96-state pointer tree is incorporated exactly and remains
substrate-owned. The Help table also installs `SI::COM-SELECT-ACTIVITY` so an
activity presentation can remain sensitive; this is a command/presentation route,
not a fixed accelerator. The remaining effective keyboard accelerators are:

| Input | Numeric behavior | Exact operation |
| --- | --- | --- |
| `End`, `Abort` | rejected | both invoke the local Exit command and bury Help |
| `Help` | rejected | render Help about this Help frame |
| Control/Meta/Control-Meta `-`, `0`–`9`, Infinity | build argument | minus establishes signed state; digits accumulate signed decimal; Infinity is signed `2^40`; unmodified forms and Control-U are not argument constructors |
| `Scroll` | accepted | vertical forward; absent/sign-only = screen, finite = lines, Infinity = end; retain sign |
| `Meta-Scroll`, `Back-Scroll` | accepted | vertical backward; absent/sign-only = screen, all other values including Infinity = lines; negate signed count |
| `Meta-<`, `Home`; `Meta->` | rejected | vertical beginning; vertical end |
| `Shift-Scroll` | accepted | horizontal forward with forward screen/line/Infinity semantics |
| `Meta-Shift-Scroll`, `Shift-Back-Scroll` | accepted | horizontal backward with backward semantics, including Infinity as a huge line count |
| `Control-Scroll` | accepted | typeout vertical forward; first trigger output-hold/make-incomplete behavior |
| `Control-Meta-Scroll`, `Control-Back-Scroll` | accepted | typeout vertical backward; Infinity remains a huge line count |
| `Control-Meta-S` then character | rejected | find scrolling window, save `(window, viewport)` in a character-equal register, then reapply that position |
| `Control-Meta-R` then character | rejected | restore only when register exists and saved window is identical; otherwise command error |
| `Control-S`, `Shift-S`; `Control-R`, `Shift-R` | rejected | search displayed strings forward from viewport start; backward from viewport end; no displayed-string target beeps |
| `Super-W`, `Meta-W` | rejected | collect marked strings from top frame, exposed inferiors, and typeouts in traversal order; unmark and push non-`NIL` strings to ZWEI kill history; empty is silent |
| `Cut`; `Copy` | rejected | collect as above, with or without deletion; push to ZWEI and available console kill histories; empty is silent |
| `Super-G` | rejected | unmark every supporting window; none is a command error |
| `Return`, `Space`, `Clear-Input`, `Rubout`, `Tab` | accepted and ignored | no-op; pending argument is also ignored |
| `Refresh` | rejected | request asynchronous refresh of the top frame |
| other key | n/a | accelerator error and reprompt; it does not start general command input |

Target selection prefers an appropriate margin-scrollbar window in the top-frame
tree, then a viewport-capable window or fallback stream; no target beeps. A screen
count of absolute value one moves one screenful with configured line overlap; larger
screen counts use `(dimension - 1) * count`; line mode uses relative jump. A
disallowed argument takes accelerator error, beeps, clears input, prints its
diagnostic, and reprompts. In particular, backward Infinity is **not** beginning in
this inherited table, unlike the local DEX backward family.

When the reused frame is already selected, `wait` alone does not force refresh. A
new selection first installs an ignore renderer, selects/clears, then installs the
real renderer and optionally waits for exposure. Conformance MUST distinguish
selected vs buried reuse, same renderer/title, changed renderer/title, explicit
force, replacement registry object, and in-place registry mutation.
Separately, the top-level handler for a signaled `SYS:ABORT` removes terminal
typeout, buries the frame, and returns `NIL` so an outer handler can continue; this
condition path is not the Abort-key accelerator.

## Document Examiner semantic contracts

### Serial subsystem and optional overlays

The source serial order is viewer pane, overview grapher, examiner, dynamic DEX,
display renderer, optional hardcopy commands, DEX commands, and command-table method
glue. Commands and paired record-group/name translators imported from NSage are part
of the semantic closure even though they live outside `ddex`.

Development Utilities conditionally contributes Edit Definition. Concordia adds
Edit Documentation plus record-group and record-group-name translators at priority
1 on the same `:edit-function` gesture. In `HD-G85-DEX+CONCORDIA`, Edit
Documentation wins and the base Edit Definition handler remains a recorded shadowed
candidate. Small inherits the Standard command table, so selected overlays apply to
both layouts.

Computed DEX Help is not an effective-table dump. It deliberately hides the
Control-V and Meta-V aliases and contains only rows registered through its Help
macro/manual installer. Imported Sage commands, Remove Typeout Window, Show Forward
Reference, and some overlays can be executable while absent from computed Help.
Generic table removal/mutation does not advance the self-help tick. Implementations
MUST preserve the distinction among active tree, Help registry, and rendered Help.

The self-help tick and generated Sage record are process-global, but each frame's DEX
item and formatted line-source cache are local. After a tick change, the first frame
to invoke Help rebuilds the global record and consumes the tick. A second frame that
still owns an old cached Help item can then see no tick change, deduplicate to that
old item, and render stale Help. First-ever record construction also deliberately
reports `changed-p = NIL`. Strict compatibility preserves the two-frame stale case;
a per-frame generation is an optional correction.

Imported Sage variables are mutable application state. Set accepts a Sage variable
and confirmed string and replaces its static value; Clear writes `NIL`; List prints a
dedicated empty result or a Variable/Value table by iterating the static-counter hash
table, whose row order is unspecified. Parser rejection, direct non-string values,
overwrite, clear, and omission from computed DEX Help are distinct test cases. The
interactive parser rejects a non-string Set value, but a direct command-function call
passes its value unchanged to `set-static-value`; strict protocol tests retain that
boundary.

The `active-example` default translator runs documentation example contents. If an
`ENDEXAMPLECOMPILEDPROLOGUE` marker occurs, it first compiles Sage text intervals to
core in the SI user package and Common Lisp readtable, transitions with initialization
and completion markers, then reads and evaluates subsequent forms. Without the marker
it evaluates from the start. It echoes source spans, rotates Listener input/value
histories, prints every returned value, resets accumulated forms at example-record
markers, and ignores unsupported directive shapes. There is no sandbox or rollback;
reader, compiler, evaluator, and already-performed side effects propagate.

Edit Documentation Example copies only Sage text intervals into a reusable non-file
Zmacs Lisp buffer named `Documentation Examples`, inserting a form-feed separator
when appending, then opens Zmacs at the appended start. The reimplementation MUST
provide a policy gate before executing untrusted or licensed documentation payloads;
disabling execution is a deployment policy, not a claim that the historical command
was inert. Example bodies are not part of this redistributable specification.

### Layout and visible panes

Standard DEX presents a title/status region, documentation viewer, candidates,
bookmarks, a bottom-left Commands interactor, and the eight-item two-column menu described
by the command tree; the preserved display does not draw box borders around those
items. Its main column is top-part then bottom-part. Bottom is four command-pane
lines high, with a fixed 660-pixel command pane and menu in the remaining width. The
top row fixes title-and-viewer at 660 pixels and gives candidates/bookmarks the
remainder, split vertically at one half. The title occupies one line and centers
`Document Examiner` in huge italic Eurex. Candidate and bookmark labels are normal
Swiss bold italic; the active command label is only `Commands` in Swiss bold italic.
The parenthetical `Completion; end with Return` text is semicolon-commented and does
not display. The typeout viewer has no blinker or More processor, truncates
at end of page, and has left and bottom scrollbars. Candidate/bookmark panes
truncate and have right-column vertical scrollbars; command input scrolls.

Standard's viewer margins are a one-pixel ragged border, two-pixel left whitespace,
left scrollbar, two-pixel bottom whitespace, bottom scrollbar, and two-pixel white
border. Candidate/bookmark panes use one-pixel pattern edges on all four sides,
two-pixel left whitespace, left scrollbar, and two-pixel white border. The menu has
top/right/bottom one-pixel pattern edges, two-pixel left whitespace, and two-pixel
white border. The command pane has left/top/bottom pattern edges, four-pixel left
whitespace, left scrollbar, and two-pixel white border.

At inside width 950 or less, Small DEX is selected. Its source defines a menu pane
and Show/Other submenu command tables, but the active layout compiles the menu-pane
reference out under `#+Ignore`. A strict implementation therefore MUST NOT invent
two visible cells. It MUST implement the source-defined command tables but MUST NOT
claim an effective user route reaches them; `TODO-RUNTIME-HD-G85-SMALL-DEX` remains
until a bounded-width run confirms both reachability and the rest of the layout.

Small's selected layout is a column of title, viewer, a four-line horizontal
candidate/bookmark row split at one half, and a two-line command pane. The title is
large Swiss bold italic; candidate/bookmark labels are small Swiss bold italic; the
command label is compiled out. The ignored menu definition is one Show/Other row,
but both its layout and size references are excluded, so the title occupies the
whole top row. A `NIL` supplied screen first falls back to `TV:MAIN-SCREEN`; Standard
is selected by absence only when both are `NIL`. Conformance MUST test widths above,
equal to, and below 950, supplied-`NIL` fallback, and both-screens-`NIL` construction.

Small's title has one-pixel left/right/bottom pattern edges and two-pixel top
whitespace. Its viewer matches Standard except the bottom scrollbar elevator is
five pixels thick. Candidate/bookmark panes change left whitespace from two to four
pixels and use small labels. The command pane adds the right one-pixel pattern edge;
the ignored menu's margin definition matches its own top/right/bottom pattern and
two-pixel left/white-border components. The fixed-roman normal command prompt begins
with Space plus right-triangle in Standard and Space plus right-open-arrow in Small.

### Viewer, item, and context state

A viewing context includes current viewer identity, ordered DEX items, active item,
candidate result/history state, bookmark display state, presentation/string/graphics
sets, viewport, and redisplay metadata. Context snapshots alias the pane's
presentation, string, and graphics sets rather than deep-copying them. Background
transfer likewise appends the same display objects from a temporary viewer after
coordinate adjustment. Mutation can therefore affect pane/state aliases and retained
presentation objects; sharing between two distinct viewing contexts remains a
runtime oracle unless deliberately injected.

DEX item deduplication is `EQ` topic plus `EQ` canonical property type, not string
equality. Removing an absent item passes an invalid index onward and can condition;
the normal UI prevents this, but direct protocol conformance MUST retain it.
Failed viewer selection falls the current pointer back to the first viewer without
the normal pane-reset path. Repeated background routing appends an already-found
Background context again, so identical context references can occur in history.

Bookmarks are stably ordered with items whose `seen-contexts` is nonempty before
items never seen anywhere. This is not a selected-viewer membership test. Remove
Item and selection operations use bookmark identity and conversion
rules from the presentation tree, not rendered-title equality.

### Candidate query and history

Candidate input removes Space from accept-blip terminators so Space is accepted as
content; the candidate substring MUST be the final positional argument. Matching
supports exact equality, heuristic/token, substring, and initial routes selected by the
source query path.

Heuristic matching tokenizes and then reverses the token list. If a one-character
open/close delimiter such as `/` or `?` yields no tokens, it falls back to a
one-element list containing the original string. The resulting process-global list
is stored in `ZWEI:*LAST-MATCH-LIST*`; concurrent queries can overwrite it.

No candidates takes the editor `barf` path—beep plus diagnostic—and retains the old
candidate pane and history. Successful results are destructively sorted by rendered
title with case-insensitive `string-lessp`; order among equal titles is unspecified.
Candidate history uses default `EQL`/identity on the result-list and reason objects,
not structural query equality. Reselect restores stored results and does not rerun
the query, despite an obsolete source comment.

### Surface routing and item navigation

Show Documentation prepares the persistent viewer and adds/deduplicates a DEX item.
Add Bookmark adds or deduplicates the record without displaying it. Show Overview
does **not** prepare the viewer: it writes its formatted block and graph to the
viewer-owned transient typeout overlay, drawing a thick separator first when incomplete typeout is
already exposed. Space removes that overlay. Show Candidates and Show Table of
Contents replace only the candidate contents. A clone that renders Overview as a
persistent viewer topic is incompatible.

Remove Item first removes any typeout, deletes the item from bookmark/viewer arrays,
compacts displayed regions, and clears history when nothing visible remains. A
direct absent-item call can condition. Table of Contents flattens depth-tagged
children only from `expand` caller triples and includes the selected topic as root.
It replaces candidates only when more than one item exists and logs regardless; a
topic with no children can beep once on `NIL` candidate replacement and again on the
subsequent `barf` diagnostic.

Beginning/End of Topic default to the first item overlapping the viewport. End
redisplays from the item's start if it fits; otherwise it walks line boxes backward
until accumulated height exceeds viewer height and begins at the following box.
Goto Beginning/End use the selected viewer's first/last item. Refresh redraws
candidates and viewer; the explicit bookmark-redisplay call is commented out and
incremental state owns any bookmark update.

### Topic and overview display

Preparing a DEX item lazily creates and then permanently caches one formatted Sage
line source. It does not notice documentation recompilation or viewer resize. The
formatted source ends with a two-pixel, screen-scaled, 33-percent-gray separator.
Strict compatibility preserves this stale cache; a corrected implementation may
key it by record/content/width generation only as a labeled extension.

Incremental display consumes horizontal boxes until viewport height is exhausted,
but continues while a presentation stack is open so nested boxes close consistently.
When content remains it adds a centered italic sans-serif ellipsis presentation five
pixels below the prior cursor with a two-pixel 33-percent-gray rule. The presentation
object contains the DEX item and top offset. A prospective Y scroll that would expose
the active item's ellipsis cancels that viewport change and enqueues Show More of
Topic; relative or absolute mouse scrolling also queues bookmark redisplay.

Show More removes the ellipsis under abort suppression, moves any following topic to
make room, and formats more content into the viewport. If later aborted, it restores
a visible ellipsis, moves the following region back, and clears the active item. This
is targeted partial recovery, not a transaction.

Show Overview first emits a fixed-500-pixel formatted block containing presented
type/title, optional one-line description, structural parents for expand/precis/
contents views (omitted for documents), containing documents, keyword-token lists
except the title-derived first list, and deduplicated crossreferences recursively
harvested through included fragments. The Related field is deliberately excluded.
It then draws a horizontal immediate-family graph:

- roots are structural parents, or the topic itself when there are none;
- duplicate parent records are removed;
- concept records with the same `EQ` topic collapse to one node;
- only every root's children and the original topic's children expand;
- dictionary children are hidden except when dictionary is the original topic;
- field width is `(inside-width + column-spacing) / tree-depth - column-spacing`;
- labels use small Swiss roman, no border, five-pixel within-column spacing, and are
  record-group presentations; and
- after drawing, the viewport is restored to overview start if rendering scrolled
  past it.

The depth pass and recursive fragment-reference scan have no explicit visited-set.
Structural or fragment cycles can nonterminate. Strict-defect tests use a watchdog;
a safe extension MAY add cycle detection and MUST label the result `INF`.

### Private document binary contract

A private document is a PSB reference list, not copied prose or viewer state. Its
outer stream has byte size 8 and begins with an unsigned 16-bit little-endian entry
count. Each entry encodes a topic followed by a type:

```text
topic
├─ string shorter than 256 bytes -> code 11, uint8 length, bytes
├─ longer string -> code 12, uint32-LE length, bytes
├─ fat/styled string -> code 34, selected SAB fat-string encoding
└─ non-string function spec -> code 2, printed representation encoded as string

type
└─ code 1 (type-symbol)
   └─ shared symbol table
      ├─ code 14, uint16-LE prior symbol index
      └─ definition
         ├─ code 15 uninterned -> symbol-name string
         ├─ code 16 Sage package -> symbol-name string
         ├─ code 32 keyword package -> symbol-name string
         └─ code 17 other package -> package-name string -> symbol-name string
```

Symbol indices are insertion ordered and shared across entries. Thin strings and the
default `:BIN-CHARACTER` topic path are the interoperable `L2` target; complete code
34 fat-string subencoding is reserved for `L3` until its character dependency is
closed. Code 33 is a reference, not a fat string. String lengths use the stated 8-
or 32-bit form with the 255/256 boundary.
The reader requires type code 1 and resolves each pair immediately against installed
Sage records.

When entry count exceeds 65,535, the 16-bit header wraps but Save still writes every
active bookmark. A strict reader consumes the wrapped prefix and leaves trailing SAB
objects unchecked. A wrapped symbol-reference index can resolve to the wrong earlier
symbol or fail validation. These are historical overflow defects, not permission to
truncate the writer's loop.

Save creates/truncates its target and writes progressively; there is no temporary
file or rename, so failure leaves a partial file. Read/Load selects or creates the
requested viewer **before** opening or decoding, and applies each entry immediately.
A missing file, malformed code, truncated item, missing package/type/topic, or later
record error can leave a selected/new viewer containing the valid prefix already
displayed or bookmarked. No rollback is permitted in the strict profile.

### Work queues and hardcopy

The local queue is checked before the background queue; each queue is FIFO. A caught
error or abort still removes the request after its restart/skip decision. Queue and
stream state MUST be inspectable so conformance can distinguish pending, active,
processed, skipped, failed, and removed.

Fresh requests are appended with destructive concatenation. The head stays present
while its function runs; only normal return or the selected Skip restart performs an
interrupt-suppressed `delete`, which can remove every `EQL` occurrence of the same
request object. A continuous local producer can starve background work. New requests
appended during processing retain FIFO order behind the active head.

The idle timer is 60 seconds. After a timeout with tracked streams, DEX attempts
normal then abort close and deletes the stream only after one path completes; if
abort close also errors, deletion is not reached. When the set becomes empty it
stores the `:none` sentinel. A timeout with no streams sets a long-ago marker; later
ordinary input plus newly opened streams resets the timer instead of closing them
immediately.

Hardcopy is an optional installed extension. Printer selection and output errors are
external transaction boundaries. `seen-only` is not a per-item filter: it emits the
contiguous bookmark prefix until the first item not seen in the selected viewer,
then stops. Stable seen-before-unseen ordering normally makes this useful; a direct
reordered fixture can omit later seen items and MUST be tested. Hardcopy output is
not a runtime screenshot and its documentation/source content retains separate
rights treatment.

The default target is the configured default text printer only if Sage accepts it,
otherwise the first accepted previous Sage target, otherwise `NIL` and a prompt.
Viewer hardcopy titles output with the viewer name and defaults `seen-only` to true.
Hardcopy Documentation wraps one Sage display in kept-file handling. Hardcopy
Private Document opens an output device titled by pathname and reads PSB with
`context-p NIL`, so it does not create/select/mutate a DEX viewer, but it prints
records progressively. A later parse or device error leaves a partial printer job.

## Visible interface requirements and runtime evidence

### Editor dispatcher witnesses

The selected C303 runtime displays the live dispatcher as a transient editor Help
surface, not as a separate application frame:

![System 303 ZWEI displaying the live Help dispatcher with its current choices.](assets/mit-cadr-screenshots/zwei-help-menu.png)

*Runtime observation — `System 303-0`, session `d06-d07-20260718`, generation 1,
verified 2026-07-18 after pressing Help and then Help.
The reviewed 768 by 963 image is 4,770 bytes; PNG SHA-256
`e0d6bf39d9de90b8c94ba93aeb2a70bbe1bec1e8ebbefebf80ffa371ac420c48`;
normalized-pixel SHA-256
`b56f866686fe6414758656dff8b60f3657fc35aa63978f70402e34fb0b8cd83d`.
It establishes the visible C, D, L, A, U, V, W, Space, and Help choices and active
Zmacs Lisp context. It does not establish the hidden-L path, unreachable `?`, leaf
effects, or maintained-source identity. MIT and other applicable rightsholders retain
interests in the screen expression; this minimum image is published under the
page-specific fair-use review to support historical criticism and reconstruction,
and no endorsement is implied.*

The Genera editor retains the same dispatcher pattern but adds the tutorial and quiet
exit rows:

![Genera 8.5 Zmacs displaying its one-line Help dispatcher in a researcher-created buffer.](assets/genera-screenshots/zmacs-help-dispatcher.png)

*Runtime observation — Genera 8.5, session `zmacs-research`, generation 1, verified
2026-07-18 after the recorded host-key probes and host F12 dispatch. The
reviewed 1200 by 900 image is 2,846 bytes; PNG SHA-256
`3bb262dd10fbc7e641a749a9047af753fc7886774815d88321e8c5a925a26c28`;
normalized-pixel SHA-256
`9faf0e0c2fc57d3f81df27896cffaad1e6a4afeafa7fc4b64051702c97dcb474`.
It establishes the visible A, C, D, L, T, U, V, W, Space, Help, and Abort prompt in
that run. Host F12 was only a harness mapping and is not a Symbolics-keyboard claim;
the image does not establish leaf effects or conditional hidden acceptance.
Symbolics and other applicable rightsholders retain interests in the licensed screen;
this minimum image is published under the page-specific fair-use review to support
historical criticism and reconstruction, and no endorsement is implied.*

The two captures have been reassessed for this specification under the repository's
four-factor screenshot policy. They contain only the short interface state needed to
analyze the dispatcher and are not substitutes for Help prose or a manual.

### System and Terminal Help visual boundary

The C303 session also reached a generated System Help table showing Top-L Lisp(Edit),
E Editor, I Inspector, L Lisp, and P Peek. Its local raw capture remains unreviewed
and is therefore not linked here. `TODO-SCREENSHOT-HD-C303-SYSTEM-HELP` requires a
specific four-factor review, curated copy, complete portable sidecar/run join, and
catalog entry before publication. No C46 or Terminal Help runtime is presently
available; their source-complete display rules remain `TODO-HD-C46-BAND` and
`TODO-HD-C303-TERM` rather than inferred pixels.

### Pop-up Help frame visible contract and blocker

The source-defined frame is one simple vertical column: a one-line centered title,
a display pane taking the remainder, and a three-line pseudo-menu. The display is a
typeout pane with ragged border, two pixels of left whitespace, vertical and bottom
scrollbars as needed, and a five-pixel white border; commands do not themselves
redisplay it. The short `Press End to exit.` instruction itself is a Swiss bold
large presentation whose object is the first command-menu item; no separate Exit
label is drawn. The frame is
nonselectable and a deexpose callback buries it under a recursion guard.

No current Genera capture confidently reached that frame; attempted Select/Help
states remained ordinary listener/selection views. Therefore
`TODO-SCREENSHOT-HD-G85-HELP-FRAME` blocks pixel-level layout conformance. A future
run MUST exercise title `NIL`, same/changed title and renderer, selected/buried reuse,
force, wait, renderer failure, deexpose recursion, top-level abort, and the
pseudo-menu's first item before one representative image is reviewed.

### Standard Document Examiner witness

![The Genera 8.5 Standard Document Examiner showing its title and viewer, populated Current Candidates, empty Bookmarks, Commands interactor, and eight menu items in two columns.](assets/genera-screenshots/document-examiner-initial.png)

*Runtime observation — Genera 8.5, session `d06-d07-genera-20260718`, generation 3,
verified 2026-07-18 after `Select D`. The reviewed 1200 by 900 image is 6,475 bytes; PNG SHA-256
`2579d041983693aec1a794ba1efa23ca70e21421c2a2ca5b7eaab8d39e908834`;
normalized-pixel SHA-256
`0f6cf810c2665a4f3d36c6ec6fce918d3149d2489c1c01a3cef77545365d7bdc`;
the two-action prefix hash is
`aeb83393dc85ed3d90ab081717e341a7b01068090e6bcda5080778f61b6b831b`.
It establishes the Standard arrangement, Default Viewer label, candidate/bookmark
split, Commands interactor, and positions of eight text menu items. It does not prove
boxed cells, gestures, the 950-pixel threshold, Small layout, search effects, Help
contents, or optional commands. Symbolics and other applicable rightsholders retain
interests in the licensed screen; this minimum image is published under the
page-specific fair-use review to support historical criticism and reconstruction,
and no endorsement is implied.*

This licensed-world run used the repository's isolated Genera harness. The curated
asset catalog retains the exact base/private VLOD, VLM, debugger, preload, responder,
configuration, sandbox, Xvfb, selected-window, input, screenshot, and shutdown
evidence. Shutdown reached confirmed cleanup and then the bounded known VLM stall;
it was forced, the private world was unchanged, and no Save World or checkpoint is
claimed.

### Remaining visual oracles

The current 1200-pixel display cannot select Small DEX. A run at exactly 950 pixels
and one below it MUST capture the actual no-menu selected layout and compare pane
bounds, labels, text styles, and scrollbars. A separate null-screen construction test
must confirm Standard class selection without claiming visible pixels. Rich Help,
candidate-result, private-document, and documentation screens remain local because
they could reproduce licensed prose; visual conformance SHOULD use researcher-created
or minimal records unless a specific screenshot review finds the screen necessary.

## Release deltas and historical defects

| Area | C46 | C303 | G85 / DEX |
| --- | --- | --- | --- |
| dispatcher choices | B/C/L/D/A/U/V/W, Space, `?` | C/D/L/A/U/V/W, Space, Help; B removed | A/C/D/L/T/U/V/W, Space, `?`/Help, Abort/Rubout |
| fresh repeat | B, whose public target is missing | B, now absent, silently reprompts | B is also absent and silently reprompts; `?`/Help then become repeatable |
| prompt conditions | fixed | only L conditional; U unconditional; predicate evaluated | L and U conditionally displayed but accepted |
| `?` | Help | rejected despite dead Help branch | Help |
| Rubout | beep/reprompt | abort | quiet exit |
| malformed Self Document mouse object | ordinary binding representation | unknown non-Scroll cons can loop forever | profile-specific normalized input |
| prefix list | one prefix variable loses deep ancestors | dense/sparse support; no cycle guard | recursive comtabs, full keyboard/mouse domain |
| Apropos | names only, four invocation paths | names only, limit+1 defect | names and doc first lines unless numeric; synonyms |
| Where Is | direct/prefix/Help pseudo-path | omits mouse and M-X paths | full live domain, duplicate physical keys suppressed |
| variable `:SMALL-FRACTION` | declared but blank | declared but blank | separate implementation dependency |
| Terminal number base | eight, though 8/9 accepted | ten | not this TV prefix architecture |
| repeated Terminal | resets numeric state | unknown suffix | n/a |
| Terminal unknown | returns quietly | async requeue, Rubout quiet, otherwise beep | n/a |
| System creation modifier | exact modified key; no generic Control-create | Control forces create and is stripped | Select/CP program framework instead |
| general docs | function recursion/debug property | typed DOCUMENTATION precedence | Sage plus Genera metadata |
| basic tutorial | B file target missing publicly | separate public Teach Zmacs command/patch | T loads licensed tutorial on demand |
| Help topic cache | n/a | n/a | Sage fill pointer only; same-length stale entries |
| Help frame cache | n/a | n/a | identity/sentinel cache permits in-place staleness |
| DEX self-help | n/a | n/a | process-global tick plus per-frame cache can stale |
| DEX layout | n/a | n/a | Standard >950; Small <=950; ignored visible menu |
| DEX private files | n/a | n/a | progressive PSB references with no rollback |

The maintained C303 canonical source already incorporates several patch bodies. The
named 98.18, 99.25, 98.54, 100.14 and Zwei 125.18, 126.28, 128.1 files are causal
lineage evidence, not a second algorithm to layer on top. Loaded-band patch state is
an independent runtime observation.

## Reference semantic protocol inventory

This table names implementation-independent messages. Historical symbol identity is
reserved for `L3`; an `L2` implementation can use different host APIs while
preserving ordering and effects.

| Protocol | Inputs | Result/effects | Failure boundary |
| --- | --- | --- | --- |
| `dispatch-editor-help` | profile, context, input stream, persistent last option | selected leaf/display code and updated repeat state | predicate/read/leaf abort or partial failure |
| `document-effective-input` | command-table context, input object | semantic binding report or next prefix state | malformed/cycle/strict hang |
| `enumerate-effective-bindings` | profile, pristine/live graph | ordered candidates, winner, shadowed nodes, unbound rows | cycle watchdog |
| `render-system-help` | live registry | ordered visible registry documentation | computed-doc/output/input failure |
| `run-terminal-prefix` | registry, digit/minus state, input | handler/process/requeue/cancel | target or buffer failure |
| `lookup-lisp-documentation` | profile, object, type | doc value or `NIL` | metadata accessor/expander failure |
| `describe-flavor` | flavor identity | ordered structural rows | undefined flavor or partial output condition |
| `map-help-topic` | client mapping and Sage state | available record-group/type or absence | stale cache or malformed component |
| `show-popup-help` | title, renderer, force, wait | reused/exposed/buried frame state | render/select/deexpose/abort path |
| `select-viewing-context` | name/context, create flag | selected/restored or fresh context | error output and fallback state |
| `show-documentation` | record group/type, viewer | persistent DEX item and redisplay | record/format/display partial failure |
| `show-overview` | record group/type, typeout | formatted facts plus graph | missing record/cycle/render error |
| `replace-candidates` | results, reason | sorted pane and identity history | `NIL` barf retains prior state |
| `show-more` | ellipsis item/offset | expanded item and shifted successors | targeted partial abort recovery |
| `save-private-document` | pathname, active bookmarks | progressive PSB bytes | truncated/partial file |
| `load-private-document` | pathname, context policy | progressive resolved items/output | viewer/output and valid prefix retained |
| `drain-dex-request` | local/background queues | FIFO effect then deletion | restart/skip and EQL duplicate deletion |
| `close-idle-streams` | time, tracked streams | normal/abort close and `:none` sentinel | abort-close failure retains stream |
| `hardcopy-dex` | target, records, seen policy | progressive printer output | target selection/device/parse partial job |

## Exact source-interface and module closure boundary

`L2` base semantic closure requires every unconditional artifact for the selected
profile in the evidence ledger plus the normative companions' exact selected
revisions. Rows labeled optional are required only when that overlay profile is
selected. Rows labeled lineage establish the origin of behavior already incorporated
in canonical C303 files; they are evidence, not additional loaded modules.
`HD-C46` loads `LMWIN BASSTR` through `pkgdcl.230`; `src/lmio1/escape.6` (18,149 bytes, SHA-256
`67f279a52db74340df57c4d1e1c8e83d454287aac1d8058b77412fdd63328f32`)
is an older alternate Escape-repository architecture and is explicitly excluded from
the selected profile. It may be specified later as another profile, not substituted
for loaded LMWIN behavior.

The Genera DEX base serial closure is `dex-viewer-pane`, `overview-grapher`,
`examiner`, `dynamic-dex`, `dexdispl`, `dexcom`, and `cometh`, with the ledger's
NSage command, tokenization, candidate, formatter, title, display, and SAB encoding
dependencies. `hardcopy-dexcom` belongs only to the hardcopy overlay. Development
Utilities and Concordia are independent selectable overlays. Their absence is a
valid base profile; their presence changes the effective command/presentation graph
and MUST be recorded.

The inspected Genera CLIM documentation source describes Sage records used to
document CLIM; it does not make Help or DEX a CLIM application. The exact file is
`sys.sct/doc/clim/clim-doc.lisp.~68~`, 9,126 bytes, SHA-256
`b2559a5245d23eb4f0c55f67873de53f0935d79c67732361e2b5f41484ff9d1d`.
The selected UI closure remains TV, ZWEI where applicable, Command Processor,
Dynamic Windows, and Sage.

An `L3` claim additionally requires exact packages, exported/internal symbol names,
argument lists, multiple values, macros, flavor methods, condition types/restarts,
dynamic variables, module definitions, load/patch order, QFASL/world residency, and
all SAB character encodings. Those are intentionally not inferred from this semantic
contract.

## Conformance test suite

Each test emits the selected source profile, optional overlays, strict/safe defect
mode, input graph generation, initial state digest, ordered trace, result, final state
digest, and preserved-runtime oracle identity where applicable. A watchdog outcome
is a required result for an intentional nontermination test, never an unbounded test
runner hang.

### Artifact and dispatcher tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-ART-01` | load C46/C303/G85 fixture | every normative file, commit/check-in, byte count, and hash matches; source and runtime profiles are reported independently |
| `HD-ART-02` | enable Dev, Concordia, hardcopy singly and together | effective command/translator graph contains only selected overlays; Concordia priority wins while Edit Definition is recorded shadowed |
| `HD-C46-D01` | inject lower-case a/b/c/d/l/u/v/w | input uppercases and invokes matching fixed-order row; normal return exits dispatcher |
| `HD-C46-D02` | `?`, then Space | `?` renders full dispatcher and reprompts, becomes last option; Space repeats `?` |
| `HD-C46-D03` | fresh Space; C-G; Rubout; unknown | Space reaches exact Basic pathname; C-G aborts; Rubout/unknown beep and reprompt |
| `HD-C303-D01` | toggle playback predicate | prompt omits/includes only L; U appears in both; hidden L is accepted and reaches Lossage |
| `HD-C303-D02` | `?`; Help; fresh Space | `?` beeps; Help renders filtered rows; fresh Space substitutes absent B and silently reprompts |
| `HD-C303-D03` | C-G/Rubout and erroring/side-effecting L predicate | abort completes query then barfs; predicate executes during prompt and full-Help generation |
| `HD-G85-D01` | toggle playback/history predicates | prompt filters L/U but direct hidden input remains accepted |
| `HD-G85-D02` | `?`, Help, Abort, Rubout, invalid | two Help forms reprompt; Abort/Rubout clear typein and quietly return; invalid beeps |
| `HD-G85-D03` | fresh Space; `?` then Space; Help then Space | initial B has no row and silently reprompts; each Help form becomes last option and is replayed |
| `HD-HELP-DYN-01` | spy option and Space repeat | leaf sees inside-Help binding; Space sees repeat binding and does not overwrite last option; dynamic bindings unwind on return/abort |
| `HD-HELP-INT-01` | install intercepted characters | ordinary dispatcher read follows D02/D05 interception; Self Document/prefix-child read suppresses synchronous output mapping but not asynchronous Control-Abort |
| `HD-G85-ENTRY-01` | Function `?`/Help, Symbol-Help, Select `?`/Help, Select D under mapped/firewall/width variants | D02 prefix winner/fallthrough is exact; Help opens matching lookup-domain frame; D chooses Standard/Small exactly |
| `HD-G85-ENTRY-02` | CP Select Activity, System Programs item, Create item, Help-frame activity presentation | all named routes reach the correct chooser/create/select operation; Help table's installed Select Activity command is present |
| `HD-G85-ENTRY-03` | directly invoke DEX self-help side door | select default DEX, append queued Help, suppress standard output during execution, then display through queue; owning startup presentation remains the named runtime oracle |

### Effective binding and query tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-KEY-01` | table with `NIL`, unnamed symbol, normal/smart/hook command, alias, macro, prefix, menu, malformed object | each binding kind takes its specified branch; smart function receives command, invoking character or `NIL`, and name/full/short mode; hooks run in order only for full key documentation |
| `HD-KEY-02` | named command without literal/computed doc | historical path prints identity/heading where applicable but no invented prose |
| `HD-KEY-03` | nested prefix plus `*` | selected child descends; `*` lists one level; nested prefix is described, not recursively flattened |
| `HD-KEY-04` | instrument C46 prefix enumeration | exactly 4 modifier banks by octal 220 character slots are addressed |
| `HD-KEY-05` | dense and all-sparse C303 tables | dense dimensions normally cover 16 modifiers by octal 240 codes; sparse parents enumerate key union in precedence order |
| `HD-KEY-06` | atomic, mouse tuple, Scroll, unknown cons on C303 | first three resolve/fixed-explain; strict unknown cons hits watchdog; safe profile reports malformed event |
| `HD-KEY-07` | alias, prefix, and parent cycles | strict historical path is watchdog bounded; safe graph reports repeated node and terminates |
| `HD-C46-Q01` | name-only/doc-only matches; five bindings at limit four | doc-only does not match; four paths print then continuation; nested prefix reproduces lost ancestors |
| `HD-C303-Q01` | current-mode vs public Apropos and five results at limit four | names only; direct/local-M-X/any-M-X classification; current mode excludes any-M-X-only; five results print before continuation |
| `HD-G85-Q01` | doc-only/name match with and without numeric arg, each with configured synonym hit | doc line participates only without numeric; synonym processing occurs after both successful and unsuccessful searches |
| `HD-CADR-Q02` | empty/unbound/direct/prefix/Help pseudo-path Where Is | empty barfs; unbound explicit; expected paths found; C303 omits mouse and M-X-only path |
| `HD-CADR-Q03` | Describe/List over inherited tables | empty Describe barfs; exact prints full doc; List follows effective source order, short docs, and final completion marker |
| `HD-DIRED-01` | invoke contextual Help in C46 Dired, C303 Dired, C303 BDired | C46 goes directly to static Dired Help; C303 enters shared dispatcher with dynamic M row; Help D remains generic description |
| `HD-BIND-ALL-01` | enumerate full logical character/modifier/mouse/prefix/command/menu/translator domain | dump every winner, shadowed candidate, argument state, Help exposure, and unbound outcome for pristine and live graphs; no reachable leaf omitted |

### Editor leaf and metadata tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-C46-L01` | wrap recording ring with number/list/`NIL` entries | number-valued events only, oldest-to-newest; no playback barfs; untyi does not double-record before next underlying read |
| `HD-C303-L01` | playback with atomic/list/`NIL` events | recording wrapper is identity; no playback barfs; list and `NIL` skipped, width/fallback 95 and line breaking preserved |
| `HD-C46-U01` | no state, wrong interval, No, Yes, injected failures | exact messages; No no-op; Yes orders mark, point, inverse save, delete, insert, report; each fault preserves historical prefix state |
| `HD-C303-U01` | no item, overlap conflict, contained item, No/Yes, injected failures | selection and barf rules; Yes moves point/mark, removes item, applies saved change, pushes inverse, reports; no rollback |
| `HD-C303-U02` | Quick Undo numeric default/positive/negative | default one; positive N; negative continues until failure according to selected 126.28 lineage |
| `HD-VAR-01` | every declared display type, with/without numeric argument | names-only match; numeric adds docs; empty Describe barfs; supported values render |
| `HD-VAR-02` | each built-in `:SMALL-FRACTION` | strict C46/C303 label plus blank value; corrected renderer only under explicit delta |
| `HD-C46-F01` | Brief/Long with missing name, one-line/multiline/no-CR doc | Brief uses relevant name and first line safely; Long prints argument list and full doc; no Quick command |
| `HD-C303-F01` | Quick/Brief/Long over undefined and typed roles | Quick relevant-name/prompt rules, arglist, doc/no-doc; Brief first line; Long all typed roles/fallback in order |
| `HD-C46-G01` | fbound/unbound symbol, definition returning doc/`NIL` plus symbol property, lambda with leading string plus body, sole-string lambda, named lambda, macro, function spec, FEF, negative | exact fallback precedence; sole-string lambda and true negative return `NIL` |
| `HD-C303-G01` | VALUE, typed symbol with distinct-but-string-equal type designator, TYPE, SETF, symbol, macro, lambda, compiled, combined method | exact eight-stage typed precedence and string-equality association; unknown non-FUNCTION type returns `NIL` |
| `HD-C303-G02` | DEFCOM with editor doc but generic no doc | editor description succeeds while general DOCUMENTATION returns `NIL` |
| `HD-FLAVOR-01` | synthetic flavor spanning every structural category | all dependency, variable, size, method, accessor, initializer, keyword, plist, property, and table rows retain profile order |
| `HD-C303-APROPOS-DEFECT-01` | list of packages with inheritors | strict path calls used-by on entire package list and reproduces defect; safe profile labels correction |
| `HD-C46-TUTOR-01` | Basic target available/missing/placeholder | exact announce/view pathname; errors propagate; 53-byte public placeholder never counted as recovered tutorial |
| `HD-C303-TUTOR-01` | private Teach file absent/present and copy failure | copy only when absent, preserve existing, edit after successful copy; dispatcher has no T row; patch-loaded command state separately observed |
| `HD-G85-TUTOR-01` | command present, load success, missing file, other setup condition | skip/load transaction and error classification; execute only after successful setup; no licensed body in fixture |

### System and Terminal registry tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-C46-T01` | digits including 8/9, minus, repeated Terminal | base-eight accumulation despite accepted digits; minus and `-1`; repeat resets arg/minus |
| `HD-C303-T01` | same numeric inputs | base-ten accumulation; repeated Terminal is ordinary unknown; signed counts preserved |
| `HD-CADR-T02` | doc forms false/atom/list, separator, `?`/Help | false omitted, atom one line, list all lines, wizard boundary/fixed chart; `?`/Help rows hidden; any char dismisses |
| `HD-C46-T03` | typeahead, keyboard-process, spawned target, unknown | typeahead copied before target; inline/spawn order; escape time clears after target; unknown/Rubout quiet |
| `HD-C303-T03` | async unknown, Rubout, ordinary unknown | async requeued when room, Rubout quiet, other beeps; escape time cleared before Help rendering/wait |
| `HD-C303-T04` | N row canonical vs patch 100.14 | canonical row exposes source-selected single slot; patch row exposes quoted three-line list; loaded band is separate oracle |
| `HD-C303-T05` | add invalid docs and replay user rows twice | user add rejects non-string schema; replay omits SYSTEM and grows saved duplicates while active table stays one row per character |
| `HD-C46-S01` | every initial row target/create policy plus direct mutation | E/I/L/P/R/S/T order; ordinary cycle/auto-create; Control-modified key is not generic create; Rubout quiet; unknown beeps; Help changes after mutation |
| `HD-C303-S01` | expression/specific/invalid/sole/disabled/atom/list rows with and without Control | Control captured then stripped and force-creates where allowed; normal cycle/create rules and exact beep cases |
| `HD-C303-S02` | add exact/differing duplicate, remove once | exact row is no-op; differing row stacks newest; Help suppresses duplicate character; remove reveals prior row |
| `HD-REG-RACE-01` | mutate while rendering | record profile-specific observed result; strict C46 live walk and C303 copied sort are not replaced by one snapshot claim |

### Help Program and pop-up-frame tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-HP-01` | string, multi-component, symbolic, record-group mappings | sole string bypasses trim; composite normalizes; record group goes directly to Sage |
| `HD-HP-02` | all-space component | strict path reaches trim-index condition; safe mode reports malformed mapping and is labeled |
| `HD-HP-03` | cache hit, miss, append, same-length replace/mutate | hits and misses cache; fill-pointer change invalidates; same-length replacement/mutation remains stale |
| `HD-HP-04` | index entry present but installed record absent | translator/direct availability can succeed then display fail; overview completion can exclude it |
| `HD-HP-05` | inherited menu label maps to absent topic | completion can offer it; Help diagnoses absent and opens nothing |
| `HD-HP-06` | Command Help client maps read command to `NIL` | Help explains topic query and performs second Help Topic accept, not fallthrough |
| `HD-HP-07` | middle-click command/menu/title/AVV mapping present/absent | applicable mapping invokes Help; absent mapping leaves translator inapplicable; left/right retain client behavior |
| `HD-HP-08` | enumerate installed commands | block-commented missing-help auditor is absent |
| `HD-HP-09` | top-level empty vs nonempty partial command string | empty path force-injects one typed `window-wakeup-help` blip on followed stream; nonempty path does not |
| `HD-HP-10` | deliver wakeup blip and inject failures before/after prose | handler throws from command read with `(NIL, NIL, :BLANK-LINE)`; earlier output persists and unrelated blips use default handler |
| `HD-HF-01` | precreated/missing frame; same/different console/superior domains; selected/buried reuse; same/changed title/renderer; force/wait | matching-domain identity and optional creation are exact; clear/select/ignore-renderer/real-renderer/wakeup/exposure ordering matches; wait alone does not refresh selected frame |
| `HD-HF-02` | Function registry in-place mutation vs replacement | in-place identity remains stale; replacement refreshes |
| `HD-HF-03` | Select first display then registry/enablement mutation | sentinel flips to `NIL`; later mutation can remain stale |
| `HD-HF-04` | local End, Abort key, and signaled SYS:ABORT | keys only bury; signaled condition removes typeout, buries, and returns `NIL` |
| `HD-HF-05` | deexpose recursively | callback buries once under recursion guard |
| `HD-HF-06` | full accelerator/numeric cross-product | every local/inherited alias, multi-stage register, no-op, pointer state, accepted/rejected numeric value, error, winner, and unbound key matches the complete tree |
| `HD-HF-07` | Scroll modes with ±sign, finite ±N, ±Infinity | forward/end and backward-huge-line distinctions; negative reverses nominal direction; screen overlap formula |
| `HD-HF-08` | save/restore scrolling register missing/mismatched/matched | character-equal registry and identical-window guard; exact command errors |
| `HD-HF-09` | marked-text empty/nonempty across inferiors/typeouts | Super-W/Meta-W, Cut, Copy, Super-G ordering, deletion, dual kill histories, empty silent/error split |
| `HD-HF-10` | Return/Space/Clear-Input/Rubout/Tab with numeric arg | no-op and argument accepted/ignored, unlike ordinary no-arg accelerators |
| `HD-HF-VIS-01` | source layout at representative widths | title/display/pseudo-menu geometry, borders, scrollbars, font, first presentation, and instruction match; remains runtime-blocked until reviewed capture |

### Document Examiner input, state, and display tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-DEX-BIND-01` | exhaustive Standard and Small tables | every fixed accelerator, named/imported/optional command, menu/submenu leaf, pointer/presentation translator, priority, shadowed handler, Help exposure, and unbound path is dumped |
| `HD-DEX-BIND-02` | prefix numeric before every accelerator | only C-M-L and parameterized Scroll families accept per table; standard no-arg rows signal accelerator error; aliases identical |
| `HD-DEX-BIND-03` | C-M-L with absent, 1, 2, >count, 0, negative | absent/1 coerce to 2; valid selects; high beeps; zero/negative reaches sequence-index condition |
| `HD-DEX-BIND-04` | record-group and record-group-name presentations | paired translators exist for Show Documentation, Overview, Add Bookmark, TOC, and selected optional hardcopy/edit handlers |
| `HD-DEX-BIND-05` | Concordia plus Development Utilities | priority-1 Edit Documentation wins `:edit-function`; Edit Definition remains shadowed and reported |
| `HD-DEX-BIND-06` | active-example default/edit gestures | Run/Edit commands selected; applicability, selected/shadowed handlers, and execution policy recorded |
| `HD-DEX-EX-01` | Run example without/with compiled-prologue marker | evaluate from start vs compile text to core, print transition markers, then read/evaluate remaining forms in SI user package/Common Lisp readtable |
| `HD-DEX-EX-02` | text, unsupported directive, example-record marker, multiple values | source spans echo; unsupported shape ignored; form list resets; Listener input/value histories rotate and every value prints |
| `HD-DEX-EX-03` | inject reader/compiler/evaluator failure after each form | prior compile/evaluation/output/history and arbitrary side effects remain; no rollback or implicit sandbox |
| `HD-DEX-EX-04` | Edit example with absent then existing Documentation Examples buffer | create non-file Lisp buffer then append on reuse with form-feed; copy only Sage text intervals; Zmacs opens at appended start; failure preserves prior prefix |
| `HD-DEX-HELP-01` | computed Help vs effective table | C-V/M-V aliases hidden; imported/Remove Typeout/Show Forward Ref rows can be active but absent; every discrepancy explicit |
| `HD-DEX-HELP-02` | mutate generic table without Help installer | effective tree changes but self-help tick/render need not |
| `HD-DEX-HELP-03` | two frames cache v1, mutate docs, frame B consumes v2 tick, frame A invokes Help | frame A can retain cached v1; per-frame-generation correction separately tested |
| `HD-DEX-HELP-04` | fresh global record and fresh frame invoke Help once | record contents are filled while construction reports `changed-p = NIL`; item follows ordinary add/dedup path |
| `HD-DEX-LAYOUT-01` | inside width 951, 950, 949; supplied `NIL` with main screen; both screens `NIL` | Standard, Small, Small; main-screen class; Standard |
| `HD-DEX-LAYOUT-02` | Standard geometry | 660-pixel divisions, four-line bottom, half right split, exact labels/styles, every pattern/whitespace/scrollbar/white-border component, eight menu positions, and Space+right-triangle prompt |
| `HD-DEX-LAYOUT-03` | Small geometry | title/viewer/four-line split/two-line command; exact margin deltas and five-pixel elevator; no visible Show/Other pane or command label; Space+right-open-arrow prompt; staged hierarchy still present |
| `HD-DEX-VIEW-01` | create/select/snapshot/restore contexts | state ordering and shallow pane/state aliases match; no unproved cross-context sharing assertion |
| `HD-DEX-VIEW-02` | remove current/sole/nonexistent viewer | select survivor; sole removal creates fresh empty Default Viewer; nonexistent selection prints error; failed selection first-context fallback retains abnormal pane state |
| `HD-DEX-VIEW-03` | same/different EQ topic and canonical type | dedup only when both identities match; equal strings alone do not dedup |
| `HD-DEX-VIEW-04` | remove absent item directly | strict invalid-index condition; normal UI path never emits call |
| `HD-DEX-VIEW-05` | repeated Background route | duplicate identical context references append in strict profile |
| `HD-DEX-BOOK-01` | never-seen and ever-seen bookmarks across contexts | stable nonempty-seen-contexts before empty; not selected-context ordering |
| `HD-DEX-SURF-01` | Show Documentation, Add Bookmark, Overview, Candidates, TOC | persistent viewer vs bookmark-only vs transient typeout vs candidate-only surfaces and state transitions remain distinct |
| `HD-DEX-NAV-01` | Beginning/End overlapping item, short/long item, Goto ends | overlap default, fit/box-backwalk positioning, and first/last viewer item rules |
| `HD-DEX-TOC-01` | expand/non-expand caller tree and leaf topic | flattened depth list only from expand; selected root included; leaf can take double-beep/diagnostic path |
| `HD-DEX-REFRESH-01` | mutate candidates/viewer/bookmarks then Refresh | candidates and viewer explicitly redraw; bookmark behavior follows incremental state, not invented direct call |

### Candidate, rendering, serialization, and queue tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-DEX-CAND-01` | substring containing spaces and positional trailing argument | Space is data, not accept terminator; substring is final positional argument |
| `HD-DEX-CAND-02` | exact, heuristic, substring, initial fixtures | correct matcher and keyword-token basis selected |
| `HD-DEX-CAND-03` | `/`, `?`, multi-token heuristic | tokens reverse; empty delimiter tokenization falls back to original one-element list; global last-match list updated |
| `HD-DEX-CAND-04` | two concurrent queries | process-global last-match list race is exposed; safe task-local mode labeled |
| `HD-DEX-CAND-05` | no match after populated pane/history | beep/diagnostic and old state retained |
| `HD-DEX-CAND-06` | equal and unequal rendered titles | case-insensitive destructive sort; unequal order exact; tie order unconstrained |
| `HD-DEX-CAND-07` | structurally equal distinct lists vs same list | history dedup/restoration uses identity; Reselect does not query again |
| `HD-DEX-DISP-01` | first prepare, documentation recompile, viewer resize | one cached line source remains stale; safe generation profile refreshes explicitly |
| `HD-DEX-DISP-02` | viewport exhaustion inside nested presentation | renderer continues until presentation stack closes |
| `HD-DEX-DISP-03` | remaining content | exact ellipsis presentation object, style, offsets, and gray rule |
| `HD-DEX-DISP-04` | scroll would expose active ellipsis; mouse scroll | viewport change canceled, Show More enqueued; mouse additionally queues bookmark redisplay |
| `HD-DEX-DISP-05` | Show More with following topic and injected abort | following region moves; abort restores ellipsis/region and clears active item |
| `HD-DEX-OV-01` | document/concept/dictionary, zero/multiple/duplicate parents | fixed block fields and graph root/child/collapse/suppression rules |
| `HD-DEX-OV-02` | nested fragments, duplicate refs, Related-only ref | recursive crossrefs dedup; Related excluded |
| `HD-DEX-OV-03` | narrow/deep graph, aliases, missing one-liner/tokens | width formula, presentation labels, optional-field omission, viewport restoration |
| `HD-DEX-OV-04` | structural and fragment cycles | strict watchdog; safe visited-set result labeled `INF` |
| `HD-DEX-PSB-01` | thin topics at 0, 255, 256 bytes and repeated type symbols | golden little-endian bytes, short/long boundary, shared symbol reference, round trip |
| `HD-DEX-PSB-02` | every package symbol class and function-spec topic | correct 15/16/32/17 plus names and code-2 printed representation |
| `HD-DEX-PSB-03` | >65,535 entries and symbol refs | wrapped header with all objects still written/trailing; wrapped ref wrong-symbol/failure behavior |
| `HD-DEX-PSB-04` | wrong type code/ref, missing package/type/topic, truncation at every byte | exact condition point and progressive retained prefix state |
| `HD-DEX-PSB-05` | Save fault after each byte/object | file already truncated/created and partial bytes remain; no rename/temp recovery |
| `HD-DEX-PSB-06` | Read/Load missing/malformed after requested new viewer | viewer is created/selected before open; valid prior items remain; no rollback |
| `HD-DEX-PSB-07` | fat/styled topic and code 33 input | strict `L2` reports reserved code-34 character closure; code 33 is decoded only as a reference; `L3` fixture must supply exact selected fat encoding |
| `HD-DEX-Q-01` | local and background requests together, continuous local producer | local wins and can starve background; FIFO within each queue |
| `HD-DEX-Q-02` | append while head runs, duplicate same request object | new request follows head; delete can remove every EQL duplicate after return/skip |
| `HD-DEX-Q-03` | request success/error/abort with Skip | head remains while running; removed only after return or selected skip; state distinguishes outcomes |
| `HD-DEX-STREAM-01` | close success, normal fail/abort success, double failure | delete/sentinel only after successful path; double failure retains stream |
| `HD-DEX-STREAM-02` | no streams timeout, then new stream and input | long-ago marker then timer reset; no immediate close |
| `HD-DEX-HC-01` | no/default-rejected/previous target | default acceptance, first accepted fallback, or prompt order |
| `HD-DEX-HC-02` | seen/unseen reorder, all seen, all unseen | contiguous prefix cutoff at first not seen in selected viewer |
| `HD-DEX-HC-03` | device or PSB failure after output | partial job remains; Private path with context false creates no viewer |
| `HD-DEX-SAGEVAR-01` | interactive set/overwrite/clear, unknown parser value, direct non-string Set, empty/nonempty List | parser requires string; direct function stores unchanged value; static values mutate; empty message vs header/rows; hash row order tolerated; computed Help omission retained |

### Visual, rights, and provenance tests

| ID | Fixture/action | Required assertion |
| --- | --- | --- |
| `HD-VIS-01` | compare C303 dispatcher to reviewed image | short visible choices/order/mode match within selected artifact; hidden paths are not inferred from pixels |
| `HD-VIS-02` | compare G85 dispatcher to reviewed image | prompt choices/order and surrounding Zmacs state match; host-key mapping excluded from keyboard claim |
| `HD-VIS-03` | compare 1200 by 900 Standard DEX | title/viewer/candidate/bookmark/Commands/menu positions and visible labels match; no boxed-cell claim |
| `HD-VIS-04` | run DEX at 950 and below | Small screenshot remains blocked until behavior and image-specific rights review complete |
| `HD-VIS-05` | exercise Help frame | no screenshot publication until exact state is reached, provenance closed, and four factors reviewed |
| `HD-RIGHTS-01` | stage documentation build | no ignored raw session, licensed prose/source/Sage data, Genera font/picture/help payload, or unreviewed capture is tracked |
| `HD-RIGHTS-02` | validate curated image reference | exact file is in approved catalog, page-specific reuse review names this specification, caption is analytical, and image excluded from repository-wide license |
| `HD-PROV-CADR-01` | ingest CADR run | session/generation, band/disks, public and private revisions/hashes, both usim hashes, inputs, screenshot hashes, shutdown flags are present; sidecar never falsely claims execution-time usim hash |
| `HD-PROV-G85-01` | ingest Genera run | all VLOD/VLM/debugger/preload/responder/config/sandbox/Xvfb/window/input/image/shutdown fields present; Save World/checkpoint remain unknown unless separately proved |

## Preserved-system comparison procedure

### CADR

1. Verify the exact public Git/Fossil pins and record the selected band's independent
   checksum and private-disk identities.
2. Start a fresh named Xvfb harness session; retain all required start- and
   execution-time provenance and verify no prior state is reused silently.
3. Exercise only the named test sequence, recording every input intent and screen.
4. Export the live command/prefix registries before and after mutation probes.
5. Join screenshot sidecars to `run.json` for execution-time usim identity.
6. Exit normally where possible and retain `forced_stop` and
   `state_may_be_incomplete`; never promote a forced run to clean evidence.
7. Keep raw captures ignored. Curate only the minimum screen after a separate rights
   review and catalog update.

### Genera

1. Copy the exact licensed world/debugger/VLM inputs into the private ignored runtime
   and verify every hash required by the harness record.
2. Launch the private VLM only through the repository harness, with the documented
   namespaces, read-only Guix/helpers/X socket, no external guest route, MIT-SHM
   disabled and live-verified, exact X11 substitutions, and supervised RFC 868 reply.
3. Require the harness's running markers before interaction. Select and record the
   exact X window and geometry.
4. Record each input intent before XTEST and its outcome afterward. For DEX, prefer
   researcher-created/minimal topics and never expose a VLM-writable capture path to
   host ImageMagick.
5. Export effective command, translator, Help-registry, viewer, and cache generations
   without copying licensed prose into tracked output.
6. Preserve shutdown stages separately. The current VLM's confirmed cleanup stall
   requires bounded kill; this is not orderly and does not prove Save World.
7. Keep raw payloads ignored and submit each proposed screenshot to exact-image,
   exact-page review.

### Recorded runtime witnesses

| Witness | Verified behavior | Not verified |
| --- | --- | --- |
| `d06-d07-20260718`, generation 1 | C303 dispatcher visible; generic Dired description; five-row System Help; two general `DOCUMENTATION` probes `NIL`; structural flavor report; clean stop and unchanged base | source-to-band identity, hidden/defect paths, Terminal, registry mutation, Undo |
| `zmacs-research`, generation 1 | G85 Zmacs dispatcher visible in editor | physical Symbolics F12 identity, leaf effects, tutorial, predicates |
| `d06-d07-genera-20260718`, generation 3 | Standard DEX entry/layout, computed Help, heuristic search, optional hardcopy names | Small/Help frame, full trees, gestures, file/hardcopy effects, orderly VLM stop |

Runtime comparison MUST report observed text, state, hashes, and uncertainty; it MUST
NOT overwrite a source-profile result merely because the preserved band differs.

## Known unknowns and nonclaims

- `TODO-HD-C46-BAND`: no matching runnable System 46 band has exercised D07.
- `TODO-HD-C46-BASIC`: the intended Basic ZWEI tutorial remains missing; the public
  placeholder is not recovery.
- `TODO-HD-C303-DISPATCH-DEFECTS`: hidden L, unconditional U, dead `?`, and fresh
  Space remain source-only for the selected band.
- `TODO-HD-C303-TERM`: live Terminal table, dismissal timing, numeric state,
  asynchronous requeue, and escape-time behavior remain unexercised.
- `TODO-RUNTIME-HD-TERM-CODE`: preserve and report the raw identity of C303's
  nonprinting Set-Mouse-Screen initializer before assigning a modern key name.
- `TODO-RUNTIME-HD-C303-TERMINAL-N`: whether the selected band has the canonical
  one-slot N row or patch 100.14's three-line list is unknown.
- `TODO-HD-C303-SYS-CREATE`: Control creation, cycling, stacking, and mutation remain
  unexercised.
- `TODO-HD-C303-EVENTS`, `TODO-HD-C303-QUERIES`, `TODO-HD-C303-UNDO`, and
  `TODO-HD-C303-VAR`: malformed event, limit/mouse omission, partial Undo, and
  small-fraction defects remain source-only.
- `TODO-HD-C303-GENERIC-POSITIVE`: the selected world's positive compiled-function
  documentation census is open; two `NIL` probes are not a census.
- `TODO-HD-C303-TEACH`: loaded-band Teach Zmacs patch state and runtime copy/edit path
  are open.
- `TODO-SCREENSHOT-HD-C303-SYSTEM-HELP`: a local capture exists but is not yet
  approved for publication; every other C46/C303 visible path lacks a reviewed image.
- `TODO-HD-G85-HELP-FRAME` and `TODO-SCREENSHOT-HD-G85-HELP-FRAME`: no successful
  visible frame observation or reviewed screenshot exists.
- `TODO-RUNTIME-HD-G85-DEX-SELF-HELP-ENTRY`: the side-door function is source-closed,
  but the effective startup presentation or other object that invokes it is not.
- `TODO-RUNTIME-HD-G85-SMALL-DEX`: source closes the class and ignored menu reference,
  but no <=950 runtime observation exists.
- DEX's entire optional command/translator effective tree, exact world-installed
  Development Utilities/Concordia state, printer path, private-file faults, and
  multi-frame stale self-help remain source-only.
- Concurrency results for live CADR registry mutation and DEX's process-global match
  list are unspecified beyond the named source operations.
- Code-33 fat-string PSB interoperability, exact historical condition/restart/API
  identity, QFASL/world residency, ABI, timing, and pixel identity remain `L3` or
  explicit runtime oracles.
- This specification does not redistribute or authorize Genera source, Sage records,
  tutorials, documentation prose, font data, pictures, or unreviewed screenshots.

Open items do not weaken closed `L2` source semantics. They limit claims about a
particular preserved runtime, visible pixels, optional installation, or exact source
interface and MUST remain visible in conformance reports.

## Artifact identities

The evidence-ledger hashes are normative for source comparisons. The public Genera
manual witnesses inspected for this specification are:

| Artifact | Bytes | SHA-256 | Use |
| --- | ---: | --- | --- |
| *Genera User's Guide* | 1,377,112 | `a38dd9a070d5a0069aa5baa084d3ed1b8be698587e28ffc5efa9c78db36e5ad8` | on-line documentation and Document Examiner user model |
| *Genera Workbook* | 1,115,793 | `a199e856ec896beb5e804ba6d384934fc62a0a35e483480e41c326b3c9411963` | frame, commands, walkthrough, and bookmarks |

The public CADR source is pinned to Git
`8e978d7d1704096a63edd4386a3b8326a2e584af`. The maintained LM-3 source is pinned to
Fossil
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
The observed `System 303-0` load band and Genera worlds are separately hashed in their
ignored harness run records; those machine-local identities are intentionally not
replaced with absolute paths here.

Curated screenshots are independently cataloged in
[MIT CADR runtime screenshot evidence](assets/mit-cadr-screenshots/) and
[Genera runtime screenshot evidence](assets/genera-screenshots/). Their PNG and pixel
hashes in this specification are content identities, not proof of source/world
identity. The exact-page reuse decision is recorded in
[Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md).

All Genera source paths in the evidence ledger are portable suffixes within a
licensed local source tree. No source body, Sage record, tutorial, or recovered Help
payload is tracked. All raw CADR and Genera session material remains under ignored
`build/` trees.

## Sources

- MIT CADR System 46,
  [`nzwei/doc.31`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/doc.31),
  dispatcher and command-documentation implementation.
- MIT CADR System 46,
  [`lmwin/basstr.163`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/basstr.163),
  selected System/Terminal registry and execution implementation.
- MIT CADR System 46,
  [`lispm/qmisc.281`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281),
  function-documentation precedence.
- MIT CADR System 46,
  [`lispm2/flavor.164`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/flavor.164),
  flavor description.
- MIT CADR System 46,
  [`nzwei/basic.zwei`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/nzwei/basic.zwei),
  the incomplete public Basic ZWEI target.
- LM-3 System 303,
  [`zwei/doc.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fdoc.lisp),
  conditional dispatcher, effective key documentation, and query defects.
- LM-3 System 303,
  [`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=window%2Fbasstr.lisp),
  System/Terminal registries and prefix automata.
- LM-3 System 303,
  [`sys/qmisc.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fqmisc.lisp),
  typed general documentation and Apropos defect.
- LM-3 System 303,
  [`zwei/comf.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zwei%2Fcomf.lisp),
  Undo and Teach Zmacs behavior.
- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf),
  on-line documentation and Document Examiner chapters.
- Symbolics, [*Genera Workbook*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Workbook.pdf),
  Document Examiner overview and walkthrough.
- Licensed local Genera 8.5 source artifacts named and hashed in the evidence ledger,
  especially Zmacs `doc`, Dynamic Windows `help-program`, TV `help-frame`, DDEX,
  NSage command/SAB, and Command Processor substrate files. These are evidence only
  and are not reproduced.
- [Help, self-documentation, and Document Examiner on CADR and Genera](help-self-documentation-and-document-examiner.md),
  the evidence narrative and complete portable harness provenance.
- [EINE, ZWEI, and Zmacs editor-family reimplementation specification](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md),
  [program selection specification](program-selection-activities-and-window-management-reimplementation-specification.md),
  [TV specification](mit-cadr/tv-window-system-reimplementation-specification.md),
  and [Dynamic Windows specification](genera/dynamic-windows-reimplementation-specification.md),
  the explicitly incorporated substrate contracts.

Last verified: 2026-07-19.
