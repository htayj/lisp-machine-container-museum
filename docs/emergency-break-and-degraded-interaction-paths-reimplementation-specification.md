---
type: Reimplementation Specification
title: Emergency Break and degraded interaction paths reimplementation specification
description: A release-bounded reconstruction contract for the CADR and Genera cold-load recovery consoles, complete Emergency-Break-owned input trees, exact debugger transition edges, ownership, screen restoration, degraded window recovery, visible states, failures, and conformance tests.
tags: [lisp-machine, mit-cadr, lm-3, genera, emergency-break, cold-load-stream, debugger, recovery, keybindings, reimplementation, specification]
timestamp: 2026-07-19T08:55:47-04:00
---

# Emergency Break and degraded interaction paths reimplementation specification

## Status and reconstruction claim

This specification defines the live recovery path retained beneath the ordinary
window systems of three selected Lisp-machine releases:

- public MIT CADR System 46 source;
- maintained LM-3 source at the `system-303` check-in, triangulated against the
  separately preserved Experimental System 303.0 band; and
- licensed Genera 8.5 source and the separately identified Open Genera base world.

A conforming implementation can reconstruct the selected profile's global entry
routes, primitive cold-load stream, breakpoint evaluator, complete effective
Emergency-Break-owned entry, prefix, cold-reader, pagination, breakpoint, query,
degraded-recovery, pointer/menu, Help, numeric-argument, context-shadowing, and
unbound input trees, plus exact transitions into and out of debugger dependencies,
screen and keyboard ownership, cleanup, locked-error arbitration, Output Hold
recovery, automatic debugger fallback, recursive degradation, bounded visible
display, and failure semantics.
It can therefore preserve what makes this facility historically important: an
operator can inspect and alter the **live** Lisp world while ordinary window I/O is
unusable, then attempt to return to the interrupted state.

The name does not describe one implementation in every layer. In Genera, the
user-facing System Menu item **Emergency Break** and global `Function Suspend` leaf
both call `TV:KBD-USE-COLD-LOAD-STREAM`, which runs ordinary `BREAK` over the
primitive stream. The debugger's deeper recursion tier invokes a distinct minimal
`SI:EMERGENCY-BREAK` evaluator. A conforming Genera implementation MUST preserve
that distinction.

This document does not claim:

- that Emergency Break resets, warm-boots, cold-boots, reloads a band or world,
  restores a snapshot, or creates an isolated address space;
- that System 46, maintained LM-3 source, the System 303-0 band, licensed Genera
  source, and the Genera base world form one byte-identical build chain;
- exact historical package, callable signature, condition, restart, flavor/class,
  module-load, ABI, QFASL, band, world, or binary compatibility;
- that a primitive console survives arbitrary scheduler, memory, device, FEP, VLM,
  or kernel failure;
- that the ordinary Lisp Debugger, Display Debugger, IFEP Debugger, and Open Genera
  VLM Debugger are interchangeable; or
- pixel identity outside the bounded structural requirements attached to the two
  reviewed screenshots.

An implementation MAY support all selected profiles. It MUST NOT average their
input maps, ownership rules, screen restoration, error-window queues, pagination,
or exit behavior into a fictional common release. A safer extension MAY add cleanup
around a legacy unprotected query, but it MUST expose that as a non-historical
profile deviation.

## Normative language and evidence codes

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. Requirements apply only to
the profiles and evidence witnesses named beside them. `INF` denotes a clean-room
implementation rule rather than a historical representation.

| Code | Evidence class | Establishes | Does not establish |
| --- | --- | --- | --- |
| `C46-SRC` | Public MIT System 46 source at Git revision `8e978d7d1704096a63edd4386a3b8326a2e584af` | Terminal and pointer entry, cold reader, breakpoint loop, System Menu, and automatic fallback visible in source | A runnable System 46 band or later behavior |
| `C46-MAN` | Contemporary public MIT operator and window-debugging text | Intended operator workflow and terminology | Every source branch or maintained LM-3 behavior |
| `C303-SRC` | Maintained LM-3 source at Fossil check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, tag `system-303` | Source-visible System 303 cold stream, ownership, locked-error, query, and Output Hold contract | That the preserved band was compiled byte-for-byte from this check-in |
| `C303-RUN` | Isolated Experimental System 303.0, ZWEI 129.0, microcode 323 session | Exercised cold-stream evaluation and bounded visible state | Unexercised key branches or source-to-band identity |
| `G85-SRC` | Licensed Genera 8.5 source inspected locally | Source-visible entry, primitive stream, cleanup, recursive fallback, and minimal evaluator | Redistribution permission or proof every body is resident unchanged |
| `G85-BASE-WORLD` | Exact unconfigured `Genera-8-5.vlod` base world | Identity and resident behavior of the exercised world | Configured-site behavior or source-to-world build identity |
| `G85-RUN` | Isolated Open Genera session `d04-emergency-break-publication-20260719`, generation 1 | Actual System Menu entry, cold client, `End` submission, arithmetic evaluation, `Resume`, and restored main display | Every source branch, physical hardware, or orderly host shutdown |
| `G8-MAN` | Public Genera 8 manuals | Intended operator concepts and keyboard names | Exact 8.5 behavior where source or runtime differs |
| `SUBSTRATE` | Normative D02, TV, Dynamic Windows, debugger, scheduler, and VLM-layer documents in this repository | Explicitly incorporated global input, menu, debugger-transition, and machine-control behavior | Behavior not named here |
| `INF` | Clean-room reconstruction rule | Portable behavior that satisfies the cited observable contract | Historical internal representation |
| `TODO-RUNTIME` | Unclosed preserved-system oracle obligation | Nothing until the named probe is executed | Permission to fill the gap by intuition |

Source controls a named source profile. Runtime controls only the exact exercised
artifact and action sequence. A manual establishes intended operation but MUST NOT
override a contrary source-visible release rule. Licensed source is identified by
portable metadata and paraphrased in original words; its body is not reproduced.

## Compatibility profiles and levels

### Release profiles

| Profile | Exact target | Principal identity | Required substrate |
| --- | --- | --- | --- |
| `EB-C46` | MIT CADR System 46 public source | direct cold breakpoint; no keyboard owner or saved-screen transaction | System 46 TV, Terminal prefix, System Menu, top-level evaluator and error handler |
| `EB-C303` | Maintained LM-3 source plus separately identified `System 303-0` runtime | screen save/restore, keyboard ownership, locked-error queue, richer reader and recovery queries | System 303 TV, Terminal prefix, System Menu, FQUERY, scheduler and error handler |
| `EB-G85` | Genera 8.5 source plus separately identified base world | FEP-backed synthetic stream, owner-and-debugger-level cleanup, Function prefix, recursive degradation | Genera TV, FEP/Life Support I/O, scheduler, ordinary/Display Debugger and VLM boundary |

`EB-C303` source and runtime are triangulated evidence, not a proven build chain.
The same distinction applies to `G85-SRC` and `G85-BASE-WORLD`/`G85-RUN`.

The cold-load stream is TV/FEP life-support I/O. It is not a CLIM application. The
Genera System Menu entry is a Dynamic Windows menu only until it launches the
recovery process; the selected cold stream itself has no presentations or pointer
commands. The ordinary Genera Debugger uses Command Processor and presentations,
and its Display Debugger uses Dynamic Windows. Those higher interfaces are separate
consumers reached after an error or explicit debugger transition.

D04 conformance ends at the debugger transition boundary. The ordinary and
graphical Lisp Debuggers are D12 applications; the Open Genera VLM Debugger is a
D52 application. Their source-bounded maps below are dependency evidence and
closure checklists, not part of `EB-*/L1` or `EB-*/L2` conformance.

### Conformance levels

| Level | Required behavior | Reserved behavior |
| --- | --- | --- |
| `L0` | selected profile's semantic state, invariants, entry identities, display regions, and evaluator distinction | interactive input and recovery |
| `L1` | `L0` plus complete effective D04-owned entry, prefix, cold-editor, pagination, breakpoint, query, degraded-window, pointer/menu, Help, numeric-argument, context-shadowing, and unbound trees, plus exact debugger entry/return transitions | complete lifecycle and degraded recovery |
| `L2` | `L1` plus acquisition/cleanup transactions, screen and keyboard ownership, locked-error and Output Hold recovery, automatic fallback, recursive degradation, failure semantics, and bounded visuals | exact historical source API |
| `L3` | exact selected historical packages, callable/macro signatures, conditions/restarts, flavors/classes, and module/load contract | ABI, compiled object, band, world, or snapshot compatibility |

This document normatively defines `EB-C46/L2`, `EB-C303/L2`, and `EB-G85/L2` at
the semantic grain stated here. `L3` is reserved. A conforming `L1` implementation
MUST provide a machine-readable dump of its effective binding graph. Site patches
or remaps MUST appear as overlays on the selected base tree rather than being
silently substituted for missing base bindings.

An `EB-*/L2` claim does not imply D12 Lisp Debugger or D52 VLM Debugger application
conformance.

| Member | Contract defined | Preserved runtime verified | Remaining oracle boundary |
| --- | --- | --- | --- |
| `EB-C46` | `L2` source contract | no compatible band exercised | pixels, timing, all keys, automatic fallback |
| `EB-C303` | `L2` source contract | package/banner, Lisp form, value `42`, clean harness stop | guest Resume mapping, locked-error and Hold Output branches |
| `EB-G85` | `L2` source contract | actual menu leaf, cold client, `End`, result `42`, `Resume`, saved-screen return | Function Suspend, editor alternatives, automatic fallback, nested ownership; VLM Debugger is a non-gating D52 dependency |

## Evidence ledger

### Exact public source artifacts

| Profile | Portable pathname | Bytes | SHA-256 | Principal use |
| --- | --- | ---: | --- | --- |
| `C46-SRC` | `lmwin/basstr.163` | 37,385 | `19e0771ff876d5325f18b97a2ccbf392f7d5950d3a89751d633d27d7cbe01e72` | Terminal prefix and explicit breakpoint |
| `C46-SRC` | `lmwin/cold.47` | 32,313 | `b05fcdb914460b36f9293a0edb2992a4df9889f5d6c345cc6dfd55feae44e052` | primitive reader, editing and pagination |
| `C46-SRC` | `lispm/ltop.231` | 17,152 | `5e217afe3b7bd31645a3a793c1c4b4a33cf211cc4c3b5770210bed228a3f8f15` | breakpoint evaluator |
| `C46-SRC` | `lmwin/sysmen.105` | 28,436 | `c203bc08b5550edefb1928349179fc54c483655d273077294211eb778daff6f1` | two-stage System Menu route |
| `C46-SRC` | `lmwin/eh.48` | 46,386 | `4a335742ccb94c9de050bc9340bbc4321d40acf067b8938b4228706de556e87b` | automatic cold debugger fallback |
| `C46-SRC` | `lmwin/ehc.36` | 29,496 | `8b7672c24a2713cbca3b9dc9704d58c92170fceeeec697734562513c5af5c4ce` | complete ordinary debugger reader and dispatch |
| `C46-SRC` | `lmwin/ehw.56` | 27,488 | `b85bc19f2a382c8c853d7ee066e664939d1ba2f066bd9f4339ff799afcfe9116` | graphical debugger menu and pointer paths |
| `C303-SRC` | `window/basstr.lisp` | 81,846 | `8ba3a16e726ed043e6585c7a68b7096bb2dcc5d6f05476afd89f84a48dff2645` | Terminal entry, ownership and recovery |
| `C303-SRC` | `window/cold.lisp` | 96,344 | `969aa5ae7986019cf6b821923bb4473086e82911080c601b105d0b3e7f8a8a26` | cold stream and rubout editor |
| `C303-SRC` | `sys/ltop.lisp` | 42,225 | `57dd2591cfeb84ee00f1d9cb51c17b5c30f22e36026074117e3420f4e3dc943e` | breakpoint evaluator and special-key boundary |
| `C303-SRC` | `eh/eh.lisp` | 125,233 | `037216f14507392e801f5338ebe3b7230b137979b8fe5a38f392214f5016f78d` | debugger fallback and saved-screen ownership |
| `C303-SRC` | `eh/ehc.lisp` | 81,305 | `767f8821287fd1881cebb318d049c14620842feb9bbd04bcf999bc79356b7c92` | complete reader, dispatch, Help and proceed trees |
| `C303-SRC` | `eh/ehw.lisp` | 32,236 | `5ee9bbdb5615059ad573f59f9ec1fc9d05606aee3c6497b45301f37ee2f42e18` | graphical debugger menu and cold-stream guard |
| `C303-SRC` | `eh/ehbpt.lisp` | 16,529 | `9ea9315bd2ced827f6bf8249916dd49b7f0873f4df4d46cf1dad5283465fc3c3` | traps, breakpoints and stepping leaves |
| `C303-SRC` | `window/sheet.lisp` | 110,976 | `3547b359a4947d4eb7f256fefa5034c88e5afcb329bd435d7353cdf034d58902` | locked-error waiting and diversion |
| `C303-SRC` | `io1/fquery.lisp` | 15,618 | `3e4a519f9a0f44f87db2c6e594cb21a9bca5cde983df21fbdf9e6237fffdcf23` | complete query aliases and retry behavior |

The System 46 identities refer to public Git revision `8e978d7d...`; the LM-3
identities refer to Fossil check-in `4df393c...`. Exact source anchors appear in
the [sources](#sources).

### Exact licensed Genera artifacts

| Archive-relative pathname | Bytes | SHA-256 | Principal use |
| --- | ---: | --- | --- |
| `sys.sct/window/basstr.lisp.~645~` | 65,555 | `112245299c0d46cf81a67f2cc8de714c766711653be215467ef41bb2c6778021` | Function parser, acquisition wrapper, keyboard entry and degraded global leaves |
| `sys.sct/window/sysmen.lisp.~250~` | 52,798 | `2f54fdb15335fc7f9f9f5c47a03f1ad2a5803d86787267949825f23853363f4c` | Emergency Break menu registration |
| `sys.sct/sys/cold-load-stream.lisp.~6~` | 15,225 | `a6ba54d93b4d8b5852653686b183e9e7ba70763da48fe276e842f591f60ff27c` | synthetic cold-load stream and editor |
| `sys.sct/sys/ifepio.lisp.~239~` | 17,345 | `2ea2530f775e4653891e49ea59c2dc05fe16b8155a91bdb8c30521aa2c61ac78` | FEP character interception, output and MORE |
| `sys.sct/io/read.lisp.~602~` | 124,647 | `e60087709843bf2ed37b30f6dd742e5451ca5d1721769e9355a882ec7aad7f92` | Lisp reader's `End` activation contract |
| `sys.sct/debugger/defs.lisp.~107~` | 16,053 | `849db8c65d75f1baa8e5e377e8d4e2eb82400cb14bc7c13c3672757345087e97` | debugger recursion thresholds |
| `sys.sct/debugger/debugger.lisp.~784~` | 99,026 | `0f12aed40337a76298f42ba16fe3e23723ac005e34a63927c0dbff8b6c91e600` | takeover, ownership, cleanup and recursive fallback |
| `sys.sct/debugger/commands.lisp.~19~` | 91,999 | `4fa991a004df4cd7c0976f2253b9be8fcb334cb2f3c3b5bffaa80735da1988ec` | ordinary debugger commands, accelerators, frame PDL and translators |
| `sys.sct/debugger/display-debugger.lisp.~38~` | 45,535 | `c6802ce33704f5495ba255949034b1a600aa79c21c32876fde835665930177f2` | Display Debugger buttons, menus, entry and exit |
| `sys.sct/debugger/analyze.lisp.~16~` | 20,375 | `75dc075191ccb51a039717c67a82ad504adee1f63542fc01a057d11db2af4cb3` | frame-analysis accelerator |
| `sys.sct/debugger/stepper.lisp.~7~` | 35,960 | `6e7bbdb140bcee4f8696457699d2b3b70fe67d0907d4fbab4259e68a87d1bc90` | single-step accelerator |
| `sys.sct/cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | command-table inheritance and standard argument tables |
| `sys.sct/cp/read-accelerated-command.lisp.~142~` | 37,639 | `8107cf4e993068344e624ec924c8d0cf0327158a927c1962666d22eb81494388` | prefix, Help, error and numeric-argument semantics |
| `sys.sct/sys/ltop.lisp.~754~` | 25,132 | `18f1cc03e5a5aefc06b97eaa5649cffdf2717b824f994422d8ea2111f1db6ebb` | minimal emergency evaluator and warm reinitialization |
| `sys.sct/sys/command-loop.lisp.~200~` | 25,251 | `a7078b06d8513e8b06bee0746ad965bfdf6dd7be920909d60fbfc411f2c94a45` | ordinary Break first-character, Abort, Resume and return-form tree |
| `sys.sct/scheduler/dispatcher.lisp.~192~` | 29,797 | `b2e404fe6cef97805936cd13e20c24a7eb2ef2bf303cb3653ded285a777812ab` | required entry from invalid scheduler state |
| `sys.sct/scheduler/process.lisp.~371~` | 99,630 | `62bfaa60c40624d0e4765fa887b880b88fda7175b6777b39dd033df37dcfec8a` | process-abort fallback query |
| `sys.sct/scheduler/init.lisp.~101~` | 19,236 | `2601c7f57f41e95ca7c671843d0a6fb4e3b7f646729f9db39325e1bc857800b3` | warm-boot process semantics |
| `sys.sct/sys/cold-load.lisp.~288~` | 32,657 | `24c20c139fa18fe2f07ef1bc660bd8fa82d666834c44ac0162bf06d12cb90662` | low-level cold-load/FEP lifecycle |

The purchased archive is 206,213,430 bytes with SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
The files remain local ignored inputs. Their identities support audit and original
technical description, not redistribution.

### Normative evidence map

| Contract surface | Primary witness | Runtime witness |
| --- | --- | --- |
| global keyboard and pointer ingress | `basstr`, `sysmen`, D02 | `G85-RUN` menu path; C303 menu only observed separately |
| cold input/editing and pagination | `cold.47`, `window/cold.lisp`, Genera cold-stream/IFEP files | arithmetic submission only |
| breakpoint evaluation | each release's `ltop` plus Genera keyboard wrapper | C303 and G85 `(+ 40 2)` -> `42` |
| screen/keyboard acquisition and cleanup | C303 `basstr`/`eh`; Genera `basstr`/`debugger` | G85 main display restored after `Resume` |
| locked-error and query paths | C303 `sheet`, `fquery`, `basstr` | `TODO-RUNTIME` |
| Output Hold and related degraded leaves | C46/C303/Genera `basstr` | `TODO-RUNTIME` |
| automatic debugger fallback | C46/C303 error handlers; Genera debugger | `TODO-RUNTIME` |
| recursive degradation | Genera debugger/defs/ltop | `TODO-RUNTIME` |
| Open Genera VLM Debugger boundary | public Open Genera guide and local layer analysis | `TODO-RUNTIME` |

## Architecture and ownership boundaries

The required dependency order is:

```text
global keyboard or pointer ingress
  -> dedicated recovery process
    -> cold-load stream acquisition
      -> primitive/FEP display and keyboard channel
        -> breakpoint evaluator
          -> ordinary debugger on evaluation failure or explicit debugger key
            -> recursive cold/minimal/halt degradation when the debugger fails
```

The following boundaries are normative:

| Layer | Owns | Must not be confused with |
| --- | --- | --- |
| TV/global console | Terminal/Function prefix, System Menu, screen selection, window locks and global recovery leaves | the cold reader |
| cold-load stream | primitive character input/output, cursor, clear, rubout buffer, prompt/noise, activation and pagination | Dynamic Windows, CLIM, an ordinary Listener pane |
| breakpoint evaluator | read/evaluate/print loop and history; special continuation/abort leaves | world loading or process snapshots |
| ordinary Lisp Debugger | stack frames, restarts/proceeds, Lisp forms, mutations, recursive error handling | the minimal `SI:EMERGENCY-BREAK` evaluator |
| Display/Window Debugger | graphical presentation of the same suspended computation | a prerequisite for cold input |
| scheduler/process recovery | process abort, lock cleanup, waiting and warm-boot policy | Emergency Break itself |
| Open Genera VLM Debugger | address-oriented halted-machine control in the separate Cold Load client; related to but not identical with IFEP debugging strata | Lisp `BREAK` or the Display Debugger |

An `EB-G85` implementation MUST route primitive stream operations through an
equivalent Life Support/FEP boundary. A port MAY implement that boundary inside one
host process, but it MUST keep its state and failure behavior independent of the
ordinary window toolkit. An implementation that merely draws a modal window inside
the normal application event loop does not conform to `L2`.

## Semantic state model

### Cold stream

The clean-room model MUST expose at least:

```text
ColdStream {
  selected: Boolean
  available: Boolean
  cursor_x, cursor_y: Integer
  width, height, character_width, line_height: Integer
  unread_character: Character | None
  activator: Character | List | None
  input_buffer: growable character vector
  fill_index, scan_index: Integer
  rubbed: Boolean
  noise_strings: ordered map<input-boundary, display-string>
  prompt, reprompt: Optional callback/string
  more_enabled: Boolean
}
```

`EB-C46` MAY use its smaller historical representation, but its behavior MUST match
the selected profile. `EB-G85` starts with a 512-character input vector, default
width 1000, height 300, cursor coordinates zero, character width 10 and line height
16. Growth MAY use another allocation strategy provided no specified input is lost.

### Acquisition context

```text
ColdAcquisition {
  acquiring_process
  original_terminal_io
  original_selected_window
  inherited_scheduler_inhibit
  owns_cleanup: Boolean
  saved_screen: Optional raster
  saved_who_line: Optional raster
  owner_debugger_level: Optional Integer
  prior_keyboard_owner
}
```

`EB-C46` does not save a screen or establish the later global keyboard owner.
`EB-C303` saves the main display and who-line and dynamically owns the keyboard.
`EB-G85` best-effort saves an eligible local unlocked main screen and records the
acquiring process and exact debugger recursion level. These differences MUST remain
profile-visible.

### Breakpoint session

```text
BreakpointSession {
  profile
  reason
  package
  stream
  evaluation_history
  recursive_debugger_depth
  exit_reason: resume | abort | return-form | top-level-throw | error | nonlocal
}
```

`EB-G85` additionally distinguishes `ordinary-cold-break` from
`minimal-emergency-evaluator`. The former is the user-facing path. The latter is
entered only by the recursive degradation tier or an explicit internal call.

### Locked-error and Output Hold state

`EB-C303` MUST model an ordered set of locked error windows, each with its waiting
debugger/process and lock state. It MUST separately model the current Output Hold
candidate, target sheet, superior-lock diagnosis, helper-process deadline, and
decision history. These are independent state machines; using one generic
“emergency recovery” flag is nonconforming.

### Core invariants

1. Entry MUST operate on the current live Lisp state; no band/world/snapshot reload
   occurs as part of Emergency Break.
2. Cold input MUST NOT require an ordinary application window, pane redisplay,
   presentation database, or CLIM/Dynamic Windows event loop.
3. No cold-stream profile defines a pointer command after stream selection.
4. Only the acquisition that owns cleanup MAY restore or release the shared cold
   display state.
5. `EB-G85` restoration MUST additionally match both acquiring process and exact
   debugger level; a nested or foreign unwind MUST NOT restore the outer raster.
6. Every profile MUST preserve ordinary Lisp multiple values and update the
   profile's specified history variables.
7. Numeric arguments accepted by a global prefix MUST NOT acquire semantics at a
   list-form Emergency Break leaf that ignores them.
8. Abort, process reset, warm boot, cold boot, VLM shutdown, Save World, and host
   forced stop MUST remain distinct operations and evidence claims.
9. A runtime `succeeded` XTEST action proves host dispatch only; the corresponding
   guest leaf is verified only by a recorded guest-visible result.

## Complete effective entry and binding trees

This section is exhaustive for fixed D04-owned leaves and source-defined parser
states at the selected base boundary. Shared mutable Terminal/Function registries and
sheet-pointer routing are incorporated from D02's
[complete input trees](program-selection-activities-and-window-management-reimplementation-specification.md#complete-input-binding-trees);
a conformance dump MUST enumerate their effective keys and owners. “Unbound” means
the profile's beep/ordinary-input/fallthrough behavior, not an invitation to invent a
binding. Loaded-world/site overlays MUST be reported separately.

### `EB-C46` global entry trees

```text
Terminal prefix (old keyboard: Esc)
├─ unmodified 0..9 -> argument := 8 * (argument or 0) + digit
├─ unmodified minus -> set sticky negative flag
├─ Terminal/Esc again -> reset prefix state
├─ O -> ignore argument; select last eligible exposed MRU entry
├─ S -> consume signed argument through recent-window selection
├─ Call -> evaluate list-form leaf in new process "KBD ESC"
│          -> KBD-USE-COLD-LOAD-STREAM
├─ Help, ?, or another exact registered suffix -> dispatch effective shared entry
└─ unregistered suffix, including Rubout -> no operation
```

The parsed argument is discarded at `Call` because the table action is a literal
form. The radix-eight accumulator deliberately accepts `8` and `9`; for example,
those values participate literally in `8 * old + digit`. Minus negates the eventual
value or supplies `-1` without digits. Suffix modifier bits are retained for exact
registry matching. The mutable effective registry and all non-D04 owners MUST be
dumped as the normative overlay incorporated from D02. Pointer ingress begins with
D02's complete sheet/application router, not an
unconditional right-button leaf. In a C46 keyboard-sensitive window encoded
double-Right is the escape hatch, an unselected window consumes another click to
select itself, and a selected window can receive the encoded event. At the default
unhandled bitmask, Left selection wins over Right. Only an accepted Right reaches:

```text
right button -> System Menu
└─ any button on Other -> Auxiliary Menu
   └─ any button on Emergency Break -> same cold-load function
```

The full [D02 pointer/context tree](program-selection-activities-and-window-management-reimplementation-specification.md#pointer-and-application-local-trees)
is incorporated normatively. The operator text recommends Left, while the System 46
`BASIC-MENU` implementation
selects an ordinary item with any button. A conforming source-exact profile MUST
retain the implementation behavior and record the manual discrepancy.

### `EB-C303` global entry trees

```text
Terminal
├─ 0..9 -> argument := 10 * (argument or 0) + digit
├─ minus -> set sticky negative flag
├─ B -> bury selected window alias; ignore argument
├─ character #x1D -> Set Mouse Screen; NIL cycles, non-NIL chooses
├─ O -> ignore argument; select last eligible exposed MRU entry
├─ S -> consume signed argument through recent-window selection
├─ Call -> new process "Handle Terminal-CALL" -> KBD-USE-COLD-LOAD-STREAM
├─ other exact registered suffix -> dispatch shared entry
├─ unregistered selected-buffer/global asynchronous suffix -> quote if room
├─ unregistered Rubout -> no operation
└─ other unregistered suffix -> beep
```

The list-form `Call` leaf again ignores the parsed argument. Minus negates the
eventual value or supplies `-1` without digits. Terminal preserves suffix modifier
bits and has no second-Terminal reset branch. The complete mutable registry and leaf
owners are the incorporated D02 overlay.

```text
D02 context router accepts menu request -> three-column System Menu
└─ any button on Programs / Emergency Break
   -> new process "Emergency Break"
      -> KBD-USE-COLD-LOAD-STREAM
```

The incorporated C303 router gives encoded double-Right escape precedence. A
keyboard-mouse window otherwise receives the event; an essential application can
select an unselected target, deliver through `:FORCE-KBD-INPUT`, accept single Right
for System Menu, or beep. At the no-window handler, Left then Middle then Right bit
priority applies without fallthrough from a false higher-priority gate. The simple
tree above begins only after that complete context route selects System Menu.

### `EB-G85` Function and pointer trees

```text
Function
├─ function keys disabled -> beep, terminate prefix
├─ 0..9 -> argument := 10 * (argument or 0) + digit
├─ minus -> set sticky negative flag
├─ Function again -> reset argument
├─ O -> ignore argument; select last eligible exposed MRU entry
├─ S -> consume signed argument through recent-window selection
├─ uppercase terminal leaf, preserving modifier bits
│  ├─ Suspend -> list-form (KBD-USE-COLD-LOAD-STREAM)
│  │             process "Function Suspend", priority 100, typeahead held
│  └─ other firewall-enabled exact registration -> dispatch effective owner
├─ unresolved Help/? with installed registration -> Function Help
├─ unresolved Rubout -> no operation
├─ unresolved Abort/Suspend base character -> corresponding Control async intercept
└─ every other unresolved/disabled suffix -> beep
```

The `Function Suspend` numeric prefix is syntactically valid but semantically
ignored because the literal handler form replaces the generic argument before
evaluation. Typeahead hold ends after the handler returns.
The firewall and registry gate all registered leaves, and suffix modifier bits remain
significant. The complete effective registration set and its owners are a mutable
D02 overlay, not behavior to infer from this one Emergency Break leaf.

Pointer ingress is the following leaf after the complete G85 D02 context router:

```text
Shift + rightmost-button momentary System Menu
└─ press/drag to Programs / Emergency Break
   └─ select plain :EVAL item
      -> process "Emergency Break"
         -> KBD-USE-COLD-LOAD-STREAM with reason "Emergency Break"
```

The G85 router gives encoded double-Right escape precedence. A single Left can select
an unselected window and then be conditionally forwarded; another event can be
consumed by application `:FORCE-KBD-INPUT`. At the unhandled Right boundary,
unmodified or Shift-Right requests System Menu, Meta-Shift-Right enters the separate
window editor, and other modifier combinations beep. The no-window handler uses
Left, then Middle, then Right priority without falling through after an ineligible
higher bit. The item itself has no application-specific left/middle/right variants.
Both the complete
[D02 pointer/context tree](program-selection-activities-and-window-management-reimplementation-specification.md#pointer-and-application-local-trees)
and its [momentary-menu transaction](program-selection-activities-and-window-management-reimplementation-specification.md#invoke-and-dismiss-the-pointer-system-menu)
are incorporated normatively.

### Genera portable host-key bridge used by `G85-RUN`

The preserved X Remote Screen map distinguishes guest keyboard characters from host
keysyms. Relevant complete function-key translations are:

| Host key | Unshifted guest meaning | Shifted guest meaning |
| --- | --- | --- |
| `F1` | Select | Square |
| `F2` | Network | Circle |
| `F3` | Function | Triangle |
| `F4` | Suspend | locking Mode Lock |
| `F5` | Resume | no extra mapping |
| `F6` | Abort | no extra mapping |
| `F7` | left Super modifier | no extra mapping |
| `F8` | left Hyper modifier | no extra mapping |
| `F9` | Scroll | Page |
| `F10` | Clear Input | Refresh |
| `F11` | Complete | End |
| `F12` | Help | no extra mapping |

The keypad mapping includes keypad decimal -> Rubout and keypad 1 (`KP_End`) ->
`End`. `G85-RUN` used explicit cold-window targeting, `KP_End` for `End`, and `F5`
for `Resume`. These host names are evidence for this harness/runtime pair, not
physical Symbolics keyboard legends.

### `EB-C46` cold reader

| Input/context | Exact effect |
| --- | --- |
| Clear | empty the complete buffered input, echo Clear, advance a line, and rescan after new input |
| Form | echo the key, clear the cold display, redraw buffered input |
| Vertical Tab | echo, advance a line, redraw buffered input |
| Rubout with content | remove one character; reaching empty throws to full-rubout handling |
| Control- or Meta-bitted ordinary character | beep and ignore |
| other ordinary character | echo and append/self-insert |
| parse error | retain and retype the saved buffer; require corrective editing |
| pointer input | no binding |
| Help | no reader-specific branch |
| numeric/repeat prefix | none |

The hardware wait inhibits scheduling; Lisp evaluation restores scheduling. At the
`**MORE**` pause, the next accepted character dismisses the marker. Break read
outside the rubout handler can recursively invoke `BREAK`.

### `EB-C303` cold reader

| Input/context | Exact effect |
| --- | --- |
| Clear / Clear Input | erase entire buffer, echo, advance line, force rescan |
| Form / Clear Screen | clear display and redraw prompt plus buffer |
| Delete | start a new line and redraw prompt plus buffer |
| Rubout with content | remove one character and mark input edited |
| Rubout at empty | perform full-rubout transfer to the special-key boundary |
| End | return `(:activation End 1)` to terminate the current form reader |
| other character with modifier bits | beep and ignore |
| other ordinary character | echo and append; rescan if prior editing occurred |
| parse error | print an error marker and condition, redraw the buffer, wait for editing |
| nested rubout handler | append options unless `:NONRECURSIVE` is present |
| pointer input | no binding |
| numeric/repeat prefix | none |

If global MORE processing is enabled, the next accepted character dismisses
`**MORE**`; if disabled, output wraps without waiting. Recursive `BREAK` MUST save
and restore the interrupted rubout buffer and scan position.

### `EB-G85` low-level intercept before rubout editing

The FEP character layer runs before the stream editor:

| Character | Effect |
| --- | --- |
| Hyper-Control-Function | swallow; return no input |
| Control-Suspend | call `(BREAK T)` |
| Control-Meta-Suspend | call the ordinary debugger entry `DBG` |
| Control-Abort | signal `SYS:ABORT` |
| every other character | pass to the cold stream/editor |

This precedence matters. A special character intercepted here cannot be redefined as
a self-inserting cold-reader character.

### `EB-G85` cold reader decision tree

```text
next passed character
├─ matches caller blip predicate
│  -> return (:BLIP-CHARACTER character NIL)
├─ matches caller activation predicate
│  ├─ no editing/rescan -> return (:ACTIVATION character NIL)
│  └─ after edit -> store activator and throw to rescan
├─ Refresh
│  -> clear whole cold window; redraw prompt, buffer, noise strings
├─ Control-Refresh
│  -> fresh line; redraw prompt, buffer, noise strings
├─ Clear Input
│  -> erase buffer; zero fill; clear noise; mark edited/rescan
├─ Rubout
│  ├─ empty -> beep
│  └─ content -> erase one displayed character and boundary noise;
│                decrement fill; mark edited;
│                if now empty and FULL-RUBOUT -> throw out
├─ Help
│  -> fresh line; choose first available help mode:
│     BRIEF -> COMPLETE -> MERGED function -> PARTIAL -> generic cold-stream note;
│     fresh line; redraw prompt/buffer
├─ any remaining character with nonzero modifier bits
│  -> beep and ignore
└─ plain character
   -> echo and append
      ├─ prior edit -> throw to rescan
      └─ no edit -> advance scan and return character
```

The Lisp reader configures exactly `End` as its activation character. There are no
hidden cursor, word-motion, kill/yank, completion-prefix, pointer, numeric-argument,
or repeat commands in this cold editor. `Return` MAY appear as an ordinary character
accepted by Lisp syntax, but it MUST NOT replace the source-defined `End` activation
leaf.

On parse error the implementation clears any pending activator, reports the
condition, explains Rubout correction when supported, redraws the buffer, and forces
another edit when correction is enabled.

`UNTYI` stores a list as the activator; otherwise it stores one unread character
when outside editing or at the start, and otherwise backs up the scan index. `LISTEN`
checks unread input, then the activator, then hardware. `CLEAR-INPUT` clears unread,
buffer positions, noise and pending hardware input.

### `EB-G85` cold `MORE` subcontext

The page boundary is two line-heights above the bottom.

```text
output reaches page boundary
├─ MORE globally and locally enabled
│  -> display **MORE**; read one character; erase marker/home
│     ├─ Suspend -> (BREAK T)
│     ├─ Abort -> signal SYS:ABORT
│     ├─ Space -> continue
│     └─ any other returned character -> consume and continue
│        (no UNTYI pushback)
└─ MORE disabled
   -> clear/restart at home without pausing
```

Tab advances to the next eight-column stop. Unsupported character-set or diacritic
output uses a lozenged character name when one is available.

### Breakpoint command-boundary trees

`EB-C46`:

| Input | Effect |
| --- | --- |
| Altmode-P or a character whose special name is Resume | return `NIL` from `BREAK` and continue |
| Altmode-G | throw to `TOP-LEVEL`, caught by the enclosing recovery function |
| `(RETURN expression)` | evaluate expression and return its value from `BREAK` |
| other readable form | evaluate; print every value; update `*`, `**`, `***`, `+`, `++`, `+++`, `-`, and `//` |
| Abort | no explicit System 46 breakpoint branch; MUST NOT be claimed as normative exit |
| Help, pointer, numeric/repeat | no breakpoint-specific binding |

`EB-C303`:

| Input at new-form boundary | Effect |
| --- | --- |
| Resume | print the resume marker and return `NIL` |
| Abort | signal abort; surrounding restart is named exit from cold-load-stream breakpoint |
| Control-Z | translate to Abort |
| Break | recursively invoke `BREAK` over the cold stream |
| Meta-Abort | reset the current Emergency Break process with the always policy |
| Meta-Break | signal keyboard break into the ordinary debugger |
| `(RETURN expression)` | evaluate expression and return its value |
| ordinary Lisp form | evaluate, print all values, update listener history |
| End | activate/terminate the current form reader |
| Help, pointer, numeric/repeat | no breakpoint-specific binding |

Raw special-key dispatch occurs only at the new-form boundary. During editing, the
cold reader's own map wins except for lower-level intercepts.

`EB-G85` user-facing entry invokes the ordinary command-loop `BREAK` over the cold
stream. Its first-nonwhitespace tree is:

| Input at new-form boundary | Exact effect |
| --- | --- |
| Resume | print `[Resume]` and return no values from `BREAK` |
| Abort | route through the standard abort intercept and the Break-loop abort path |
| Control-Z | translate to Abort before the same path |
| Suspend | route through the standard suspend/break intercept; enter nested `BREAK` |
| Meta-Suspend | route through the standard meta-suspend intercept; enter ordinary Debugger |
| `(RETURN expression)` | evaluate in the Break environment and return all values; omitted expression evaluates `NIL` |
| ordinary form | evaluate in the selected Break environment and print through the ordinary command loop |
| End | activate/terminate the cold reader's current form |

These special-character leaves are read only at the first nonwhitespace boundary;
after text begins, standard intercepted characters take their ordinary asynchronous
path. Control-Suspend, Control-Meta-Suspend and Control-Abort also retain the
lower-level cold-stream meanings above. A read/evaluation error enters ordinary
debugger machinery; it does not silently switch to the minimal evaluator.

### Minimal Genera emergency evaluator

The debugger depth-25 tier binds standard input/output to synthetic terminal I/O,
marks the debugger potentially broken, prints its reason and loops:

| Form | Effect |
| --- | --- |
| `(RETURN expression)` | evaluate expression and return it; omitted expression evaluates `NIL` |
| any other readable form | evaluate; collect every value; shift primary history through `*`, `**`, `***`; shift value lists through `//`, `////`, `//////`; print every value |
| colon command | no special command language |
| pointer gesture | none |
| additional prefix | none beyond the cold editor |

Errors are not caught as a second mini-language; they re-enter debugger machinery
with the system-problems flag set.

## Debugger transition dependencies and source-bounded maps

The breakpoint reader and the ordinary debugger are different contexts. The tables
below become active only after an evaluation error, an explicit debugger character,
or another transition into the error handler. A reimplementation MUST NOT apply
these keys as cold-editor bindings before that transition.

Normative D04 behavior in this section is limited to the entry and exit edges named
in the breakpoint and architecture sections. The remaining tables preserve source
evidence for D12/D52 and are non-gating dependency checklists. They MUST NOT be
cited as complete effective debugger-application trees until those specifications
dump inherited, world, and site overlays.

### System 46 debugger dependency: complete initial dispatch table

Every non-null initial dispatch-table entry is listed. Condition-specific questions,
site patches, and dynamically rebound characters are overlays.

| Key/range | Command and effect |
| --- | --- |
| `?`, Help | print debugger Help |
| Line, Control-N | move down/less-recent in stack |
| Form, Control-L | clear, print error and show current frame |
| Return, Control-P | move up/more-recent in stack |
| Resume, Control-C | invoke applicable proceed action |
| Control-0...9 | numeric prefix |
| Control-A | show current function arglist |
| Control-B | brief backtrace |
| Control-E | edit current function |
| Control-R | return one requested value from frame |
| Control-S | search frames by function-name substring |
| Control-T | read tag and value, then throw |
| Control-Z | throw to Lisp top level |
| Meta-0...9 | numeric prefix |
| Meta-`<`, Meta-`>` | select top/most-recent or bottom/least-recent frame |
| Meta-B | detailed backtrace |
| Meta-C | restart-oriented bash-and-proceed path |
| Meta-L | show full current frame |
| Meta-N, Meta-P | detailed next/previous motion |
| Meta-R | reserved return-many-values leaf; intentionally unimplemented |
| Meta-S | search then show full frame |
| Meta-Z | leave one recursive error level |
| Control-Meta-0...9 | numeric prefix |
| Control-Meta-A | put numbered argument in `*` and its locative in `+` |
| Control-Meta-B | uncensored detailed backtrace |
| Control-Meta-C | continue from error-restart context |
| Control-Meta-F | put current function in `*` |
| Control-Meta-L | put numbered local in `*` and locative in `+` |
| Control-Meta-N, Control-Meta-P | uncensored stack motion |
| Control-Meta-R | reinvoke selected call with reconstructed arguments |
| Control-Meta-U | normalize selection to an interesting frame |
| Control-Meta-W | enter graphical window error handler |

Numeric prefixes apply only where the selected debugger command consumes them. An
unlisted modified character follows the debugger's unbound-command response; the
source does not close its exact beep/message at every terminal, so that visible
response remains `TODO-RUNTIME`. Unmodified ordinary characters enter the Lisp form
reader. Rubout at command boundary retries, Control-G is intercepted through the I/O
buffer and throws to the debugger's top-level catcher, and Break can enter a nested
break loop.

The numeric tree is decimal despite the historical reader's possible octal base:

```text
Control-, Meta-, or Control-Meta digit
├─ first digit -> argument = digit
├─ more digits -> argument = old * 10 + digit
└─ next debugger command -> consume argument, then clear it
```

There is no minus argument leaf. Backtrace and motion variants use the value as a
depth/count; Control-Meta-A and Control-Meta-L use it as an index, default zero.
Control-Z accepts but ignores a value. Most other bodies accept and ignore one,
while Meta-Z has no numeric parameter in its function signature; a conforming
implementation MUST NOT promise that every prefixed command succeeds uniformly.

The source-bounded System 46 graphical menu is ordered:

```text
What Error -> Arglist -> Retry -> Set arg -> T -> Quit one level -> Inspect
-> Return a value -> Search -> NIL -> Exit -> Edit -> Continue -> Throw
```

Its effective pointer/input overlay is:

| Context | Input | Effect |
| --- | --- | --- |
| stack line | Select | change current frame |
| generic sensitive value | Select | place value in `*` |
| Inspector history | Select / alternate pointer path | re-inspect / return value |
| argument or local | applicable mutation presentation | replace the live slot |
| stack margin | inherited TV top/bottom gesture | select stack extreme |
| graphical interactor | Form | clear interactor |
| graphical interactor at empty boundary | Rubout | ignore |
| graphical interactor otherwise | form or pointer blip | evaluate/read selected object |
| graphical yes/no query | `Y`, `y`, Space / `N`, `n`, Rubout | yes / no; menu `T` and `NIL` are equivalent |

No source guard corresponding to the System 303 cold-stream Control-Meta-W guard was
found. That absence is source-scoped, not a claim that every System 46 display can
successfully construct the graphical handler.

### System 303 debugger dependency: complete initial dispatch table

| Key/range | Command and effect |
| --- | --- |
| `?`, Help | topical Help |
| Line, Form, Return | next frame, redisplay, previous frame aliases |
| Resume | default proceed, or exit examine-only stack-group mode |
| Abort | return to prior command loop/debugger |
| Rubout | edit debugger input |
| Control-minus, Control-0...9 | signed numeric prefix |
| Control-A | show arglist |
| Control-B | brief backtrace |
| Control-C | default proceed |
| Control-D | proceed and trap at next call |
| Control-E | edit current function |
| Control-I | macro single step |
| Control-L | clear/error/current frame |
| Control-M | open bug report with error/backtrace |
| Control-N, Control-P | ordinary censored frame motion |
| Control-R | return requested value from selected frame |
| Control-S | frame-name search |
| Control-T | read tag/value and throw |
| Control-X | toggle current exit trap |
| Control-Z | abort/top-level transfer |
| Meta-minus, Meta-0...9 | signed numeric prefix |
| Meta-`<`, Meta-`>` | top and bottom frames |
| Meta-B | detailed backtrace |
| Meta-D | toggle next-call trap |
| Meta-I | show current-instance variable |
| Meta-L | detailed frame |
| Meta-N, Meta-P | detailed motion |
| Meta-R | reinvoke after editing reconstructed call |
| Meta-S | show named frame variable |
| Meta-T | show stack temporaries |
| Meta-X | set exit traps on selected and all outer frames |
| Control-Meta-minus, Control-Meta-0...9 | signed numeric prefix |
| Control-Meta-A | numbered argument/value locative into `*`/`+` |
| Control-Meta-B | uncensored detailed backtrace |
| Control-Meta-C | show catch/unwind frames |
| Control-Meta-D | describe `*` deeply |
| Control-Meta-E | show lexical environment |
| Control-Meta-F | put current function in `*` |
| Control-Meta-H | show active condition/resume handlers |
| Control-Meta-L | numbered local/value locative into `*`/`+` |
| Control-Meta-N, Control-Meta-P | uncensored motion |
| Control-Meta-Q | describe current proceed types |
| Control-Meta-R | reinvoke with same arguments |
| Control-Meta-S | show frame special bindings |
| Control-Meta-T | numbered temporary into `*` |
| Control-Meta-U | move outward to interesting frame |
| Control-Meta-V | numbered outgoing value into `*` |
| Control-Meta-W | enter graphical window debugger |
| Control-Meta-X | clear exit traps on selected and outer frames |
| Control-Shift-S | set compiled-code breakpoint |
| Control-Shift-C | clear selected breakpoint |
| Meta-Shift-C | clear all breakpoints |
| Control-Shift-L | list breakpoints |
| Meta-Shift-S | macro single step |
| Super-A...Super-Z | select the currently printed dynamic proceed/special choice by position |
| Control-Quote | evaluate in error handler's own environment |
| Control-Meta-Delta | extended deep description of last object |

System 303's Help reader is itself a complete nested binding tree:

```text
Help or ?
├─ G/g -> General
├─ I/i or E/e -> Information
├─ F/f -> Stack Frames
├─ S/s -> Stepping
├─ P/p or X/x -> Proceeding plus current dynamic choices
├─ T/t -> Transferring
├─ D/d or C/c -> Describe, then read one debugger command character
├─ Help/? -> print topics and remain in Help
└─ Abort, Control-Z, or Control-G -> abort Help
```

Super letters are not 26 static commands: only choices assembled for the current
condition are bound semantically. The numeric parser has a release-specific edge
that MUST NOT be normalized away:

```text
Control-, Meta-, or Control-Meta-minus/digit
├─ first minus -> -1
├─ second minus -> beep; retain prior argument
├─ digit -> digit + 10 * prior argument
└─ next command -> consume and clear argument
```

Thus minus then `3` produces `-7` in the pinned source, not conventional `-3`.
Runtime confirmation remains an oracle obligation. Numeric Abort clears the prefix
and returns to the debugger command-loop top; bare Abort exits. Backtraces and motion
consume depth/count. Control-Meta-A/L/T/V use an index, default zero.
Control-Meta-S lists bindings without a prefix and selects the indexed binding into
`*`/`+` with one. Control-Meta-H treats any prefix as “all handlers.” Meta-T uses no
prefix for temporaries, zero to include pending open frames, and `-1` for every
regular-PDL word. Control-M uses the prefix as bug-report frame count.
Control-Shift-S treats a prefix as a PC; Control-Shift-C treats `-1` as clear-all in
the current function and another prefix as a PC. Meta-Shift-C, Control-Shift-L and
Meta-Shift-S accept but ignore the value. Meta-I's documentation advertises a
prefixed show-all variant, but the source body ignores its argument.

System 303's graphical menu is ordered:

```text
What Error -> Arglist -> Retry -> Set Arg -> T -> Exit Window EH -> Inspect
-> Return a Value -> Search -> NIL -> Abort Program -> Edit -> Proceed -> Throw
```

Left on **Proceed** invokes the default, right opens the current dynamic proceed
menu, and middle is unbound. Left selects stack frames and generic values. Inspector
history left re-inspects while right transfers the object to `*`; Inspector-pane
right also transfers its object. Argument/local presentations can be selected for
replacement, and inherited margin gestures reach stack top/bottom. On the cold-load
stream, Control-Meta-W explicitly reports that the graphical debugger cannot be
invoked and leaves the user in the textual debugger.

### Genera ordinary Debugger dependency: source-bounded command surface

At the ordinary prompt, colon or Meta-X starts a named Command Processor command, an
accelerator invokes its command directly, and an ordinary readable form evaluates
in the selected frame's environment. A numeric prefix on colon or Meta-X is an
accelerator error because full-command entry accepts no argument. The complete
printed command inventory is:

| Named command | Accelerator(s) | Effect |
| --- | --- | --- |
| `:Abort` | Abort, Control-Z | abandon to applicable outer handler/command level |
| `:Analyze Frame` | Control-Meta-Z | identify erroneous frame and source |
| `:Bottom Of Stack` | Meta-`>` | select least-recent frame |
| `:Clear All Breakpoints` | named only | clear all breakpoints in selected function |
| `:Clear Breakpoint` | named only | remove one breakpoint |
| `:Clear Trap On Call` | Control-X Control-C | clear selected call trap |
| `:Clear Trap On Exit` | Control-X Control-E | clear selected/all exit traps |
| `:Describe Last` | Control-Meta-D | describe most recent displayed value and retain in `*` |
| `:Disable Aborts` | named only | suppress Debugger Abort command |
| `:Disable Condition Tracing` | Control-X T | stop condition tracing |
| `:Edit Function` | Control-E | visit current/selected function in Zmacs |
| `:Enable Aborts` | named only | restore Debugger Abort command |
| `:Enable Condition Tracing` | Control-X T | start condition tracing |
| `:Find Frame` | Control-S | find/select frame by function name |
| `:Help` | Control-Help | list commands and accelerators |
| `:Mail Bug Report` | Control-M | compose error/backtrace report |
| `:Monitor Variable` | named only | trap selected accesses to location/special variable |
| `:Next Frame` | Line, Control-N, Meta-N, Control-Meta-N | move toward less-recent callers at selected detail/visibility |
| `:Previous Frame` | Return, Control-P, Meta-P, Control-Meta-P, Control-Meta-U | move toward more-recent callees or interesting frame |
| `:Proceed` | Resume | default proceed/restart |
| `:Proceed Trap On Call` | Control-X Meta-C | resume and trap at next call |
| `:Reinvoke` | Control-Meta-R | retry function represented by current frame |
| `:Restart Trap On Call` | Control-X Control-Meta-C | reinvoke and trap at next call |
| `:Return` | Control-R | make selected frame return requested values |
| `:Set Breakpoint` | named only | insert compiled-code debugger breakpoint |
| `:Set Current Frame` | left on presented frame | select pointed frame |
| `:Set Stack Size` | named only | set Control, Binding or Data stack capacity |
| `:Set Trap On Call` | Control-X C | trap at next call from current frame |
| `:Set Trap On Exit` | Control-X E | trap when selected/outer frame exits |
| `:Show Arglist` | manual says Control-X Control-A; source says Control-Shift-A | show lambda list; preserve discrepancy |
| `:Show Argument` | Control-Meta-A | show one/all arguments |
| `:Show Backtrace` | Control-B, Meta-B, Control-Meta-B | brief/detailed/full backtraces |
| `:Show Bindings` | Control-X B | show special bindings |
| `:Show Breakpoints` | named only | list breakpoints |
| `:Show Catch Blocks` | named only | show catches/unwind blocks |
| `:Show Compiled Code` | named only | disassemble selected function |
| `:Show Condition Handlers` | named only | show active handlers |
| `:Show Frame` | Refresh, Control-L, Meta-L | redisplay frame at selected detail |
| `:Show Function` | Control-Meta-F | show function object/name |
| `:Show Instruction` | Control-Meta-I | show trapped/next instruction |
| `:Show Lexical Environment` | named only | show inherited lexical bindings |
| `:Show Local` | Control-Meta-L | show one/all locals |
| `:Show Monitored Locations` | named only | list monitors |
| `:Show Proceed Options` | named only | redisplay choices |
| `:Show Rest Argument` | named only | show `&rest` argument |
| `:Show Source Code` | Control-X Control-D | display source |
| `:Show Special` | named only | show special in selected environment |
| `:Show Stack` | named only | show local/temporary stack slots |
| `:Show Standard Value Warnings` | named only | explain nonstandard debugger specials |
| `:Show Value` | Control-Meta-V | show outgoing values |
| `:Single Step` | Control-Shift-S | step one instruction, stepping over calls |
| `:Symeval In Last Instance` | Control-X Control-I | treat symbol as instance variable |
| `:Throw` | Control-T | evaluate tag/value and throw |
| `:Top Of Stack` | Meta-`<` | select most-recent/error frame |
| `:Unmonitor Variable` | named only | remove selected/all monitor |
| `:Use Dynamic Environment` / `:Use Lexical Environment` | Control-X I | toggle evaluation environment |
| `:Display Debugger` | Control-Meta-W | enter pane-oriented debugger |

Source-visible additions complete the base tree:

| Control | Effect |
| --- | --- |
| Meta-Shift-N / Meta-Shift-P | next/previous including invisible frames |
| Control-Meta-Space | exchange current frame with frame PDL |
| Control-Shift-B / Meta-Shift-B | brief or invisible-frame backtrace variants |
| Control-Shift-E | explicitly read/evaluate a form in debugger |
| Control-X Control-A | source: show all argument values |
| Control-X Control-L | show all locals |
| Control-X Control-R | show `&rest` argument |
| Control-X D | show compiled code |
| End | leave Display Debugger for ordinary error context |

The ordinary frame PDL has its own argument-sensitive tree; it is not the VLM point
stack:

```text
Control-Space
├─ no prefix -> push current frame
├─ modified numeric 0 -> show frame PDL
├─ exactly Control-U (argument class :control-u, value 4)
│  -> pop and select saved frame
├─ exactly Control-U Control-U (argument class :control-u, value 16)
│  -> pop and discard saved frame
└─ every other prefix, including a typed modified 4 -> beep; no command
```

Control-Meta-Space exchanges the current frame with the top saved frame and rejects
every numeric argument. It does not rotate the PDL.

The inherited standard argument grammar is also a multi-stage tree:

```text
Debugger command boundary
├─ Control-U -> argument class :control-u, value 4
│  └─ repeated Control-U -> multiply by four
├─ Control-, Meta-, or Control-Meta-minus -> signed argument state -1
├─ Control-, Meta-, or Control-Meta-digit -> signed decimal accumulation
├─ modified Infinity -> sign times 2^40
├─ another argument character -> continue argument state
└─ accelerator
   ├─ argument-aware leaf -> consume class and value
   └─ argument-disallowing or unknown leaf -> accelerator error
```

Unmodified digits, minus and Infinity begin ordinary form input rather than numeric
arguments. Prefix state survives entry into Control-X. Accelerator error beeps,
clears accelerator input, reports the undefined/disallowed sequence and reprompts.

The complete Control-X tree is:

```text
Control-X
├─ C -> set trap on call
├─ Control-C -> clear trap on call
├─ Meta-C -> proceed and trap on call
├─ Control-Meta-C -> restart and trap on call
├─ E -> set current exit trap; any numeric presence means current plus outer
├─ Control-E -> clear current exit trap; numeric presence means current plus outer
├─ T -> condition tracing: no prefix toggles, 0 disables, nonzero enables
├─ B -> bindings: no prefix current frame, prefix entire stack
├─ I -> environment: no prefix toggles, 0 dynamic, nonzero lexical
├─ Control-I -> symeval in last instance
├─ Control-A -> all arguments
├─ Control-L -> all locals
├─ Control-R -> rest argument
├─ D -> compiled code
├─ Control-D -> source code
├─ Help -> enumerate applicable inherited leaves; execute none
└─ unknown -> accelerator error
```

Control-X makes a short typeahead probe; if no terminal is ready it displays the
prefix prompt and continues waiting. It has no timeout termination. The
implementation MUST NOT flatten Control-X C, Control-X Control-C and Control-X
Meta-C into one command.

The dynamic direct-choice tree is assembled for each condition. Super-A through
Super-Z select current proceed/restart/special entries by position. The base source
also provides Super-Shift-C for `:store-new-value` and Control-Shift-P for
`:package-dwim` when applicable. Earlier dynamic entries shadow later ones, and
dynamic entries shadow global commands except Abort and Resume; Resume is assigned
to the first suitable proceed/restart. Selecting a presented proceed option executes
that same option.

Plain Help is introductory; Control-Help lists the command inventory. In the Display
Debugger, Help routes to its Dynamic Windows Help display. Entry/exit leaves are:

| Input/path | Effect |
| --- | --- |
| Meta-Suspend while waiting for terminal input | debugger entry |
| Control-Meta-Suspend | forced immediate debugger entry |
| `BREAK` or `ZL:DBG` | programmatic entry |
| Abort or Control-Z | leave failing action according to active abort choice |
| Resume | default proceed/restart |
| Control-Meta-W or `:Display Debugger` | enter Display Debugger |
| End in Display Debugger | return to ordinary Debugger, retain error context |
| Switch windows button | select shadowed failing activity; Function-S returns |

An otherwise ordinary graphic character begins Lisp-form input in the selected
frame. Presentation blips may satisfy typed command arguments. Meta-Abort is the
reader's abort character; Suspend and Meta-Suspend are intercepted entry/suspension
controls rather than Debugger table leaves.

### Genera Display Debugger dependency: source-bounded pointer composition

The interactor retains every ordinary Debugger keyboard command above. Its sixteen
button rows and all secondary gestures are:

| Button | Left | Middle | Right |
| --- | --- | --- | --- |
| Abort | abort failing action | unbound | unbound |
| Proceed | default proceed | unbound | unbound |
| Return | return from current frame | return from pointed frame | unbound |
| Reinvoke | reinvoke current frame | reinvoke pointed frame | unbound |
| Exit | leave Display Debugger only | unbound | unbound |
| Switch windows | select shadowed activity | unbound | unbound |
| Help | Display Debugger help | unbound | unbound |
| Bug Report | construct report | unbound | unbound |
| Edit function | edit current/pointed function | unbound | unbound |
| Find Frame | prompt/search | repeat last search | unbound |
| Backtrace | ordinary | include invisible frames | submenu |
| Source code | source | compiled code | submenu |
| Breakpoints | show | clear all | submenu |
| Monitor | show monitors | unbound | submenu |
| Exit traps | set current-frame exit trap | clear current-frame trap | submenu |
| Call traps | set call trap | clear call trap | submenu |

Right-button submenus are complete:

| Parent | Ordered choices |
| --- | --- |
| Backtrace | ordinary backtrace; invisible-frame backtrace |
| Source code | display source; display compiled code |
| Breakpoints | set; clear one; clear all; show |
| Monitor | monitor variable; unmonitor variable; unmonitor all; show monitored locations |
| Exit traps | set current; set all; clear current; clear all |
| Call traps | set; clear; proceed-and-trap; restart-and-trap |

The Display Debugger composes its application overlay with the complete Dynamic
Windows raw map. The selected base initializes one unique primary gesture for each
of 32 modifier states on each of Left, Middle and Right: 96 cells. Each row below
expands to `<prefix>Left`, `<prefix>Middle` and `<prefix>Right`; empty means the
unmodified buttons:

| State | Primary prefix | State | Primary prefix |
| ---: | --- | ---: | --- |
| 0 | *(empty)* | 16 | Shift- |
| 1 | Control- | 17 | Control-Shift- |
| 2 | Meta- | 18 | Meta-Shift- |
| 3 | Control-Meta- | 19 | Meta-Control-Shift- |
| 4 | Super- | 20 | Super-Shift- |
| 5 | Super-Control- | 21 | Super-Control-Shift- |
| 6 | Super-Meta- | 22 | Super-Meta-Shift- |
| 7 | Super-Meta-Control- | 23 | Super-Meta-Control-Shift- |
| 8 | Hyper- | 24 | Hyper-Shift- |
| 9 | Hyper-Control- | 25 | Hyper-Control-Shift- |
| 10 | Hyper-Meta- | 26 | Hyper-Meta-Shift- |
| 11 | Hyper-Meta-Control- | 27 | Hyper-Meta-Control-Shift- |
| 12 | Hyper-Super- | 28 | Hyper-Super-Shift- |
| 13 | Hyper-Super-Control- | 29 | Hyper-Super-Control-Shift- |
| 14 | Hyper-Super-Meta- | 30 | Hyper-Super-Meta-Shift- |
| 15 | Hyper-Super-Meta-Control- | 31 | Hyper-Super-Meta-Control-Shift- |

The non-null initialization aliases relevant to this composition are:

| Raw state | Additional logical meaning(s) |
| --- | --- |
| Left / Middle / Right | Select / Describe and Select-and-Edit / Menu |
| Shift-Left / Shift-Middle / Shift-Right | Select-and-Activate and Alternate-Select / Inspect, Delete and Remove / System-Menu |
| Control-Left / Control-Middle / Control-Right | Hold-and-Mark-Region / Yank-Word / Marking-and-Yanking-Menu |
| Control-Shift-Middle | Mark-Word |
| Meta-Left / Meta-Middle / Meta-Shift-Right | Edit-Function and Edit-Definition / Evaluate-Form and Disassemble / Window-Operation-Menu |
| Super-Left / Super-Middle / Super-Right | Select-Object / Describe-Presentation / Presentation-Debugging-Menu |
| Super-Shift-Left / Super-Shift-Middle | Reprint-Differently / Edit-Viewspecs |
| Control-Meta-Left / Control-Meta-Middle / Control-Meta-Right | Set-Breakpoint / Clear-Breakpoint / Modify and Set-Complex-Breakpoint |
| Control-Meta-Shift-Left / Control-Meta-Shift-Middle | Monitor-Location / Unmonitor-Location |

Every other raw cell retains only its unique primary gesture and has no
Debugger-specific base handler. Generic Dynamic Windows handlers may still apply by
presentation type. The exact physical multi-button, double-click and Shift-Right
System Menu precedence is incorporated normatively from the
[Dynamic Windows gesture contract](genera/dynamic-windows-reimplementation-specification.md#gestures-and-handler-resolution).

Debugger-specific pane translators are:

| Presented context | Raw/logical input | Base result |
| --- | --- | --- |
| stack frame | Left / Select | make current |
| stack frame | Shift-Left / Alternate-Select | make current and show detailed |
| stack frame | Middle / Describe | show call arguments |
| stack frame function | Meta-Left / Edit-Function | edit function |
| applicable frame function | Meta-Middle / Disassemble | show compiled code |
| stack frame | Right / Menu | assemble applicable translator menu; base candidates include return, reinvoke, set/clear exit trap and show function arglist |
| current proceed option | Left / Select | execute if still valid for current error |
| code fragment | Meta-Middle / Evaluate-Form | evaluate form |
| code fragment | Control-Meta-Left / Set-Breakpoint | set simple breakpoint |
| code fragment | Control-Meta-Middle / Clear-Breakpoint | clear breakpoint |
| applicable code fragment | Control-Meta-Right / Set-Complex-Breakpoint | set or modify complex breakpoint |
| argument or local | Control-Meta-Right / Modify | replace live slot; mutating |
| Inspector history | Left / Select | re-examine object |
| interactor presentation | active typed input context | satisfy the corresponding Command Processor argument |

Source-language presentations retain applicable language/type translators. The
effective Right menu is therefore not a closed static list: inherited Dynamic
Windows translators plus loaded-world and site extensions are overlays. A conforming
implementation MUST dump the presentation ancestry, active command table, raw
gesture, applicable translator order and resulting menu for the pinned world; until
that probe is run, the exact loaded-world menu is `TODO-RUNTIME` rather than guessed.

### Open Genera VLM Debugger dependency: source-bounded compact prefixes

The Open Genera VLM Debugger runs in the separate Cold Load X client and is an
address-oriented halted-machine debugger, not a Lisp evaluator. An `EB-G85/L2`
implementation MUST preserve this transition boundary even if VLM commands are
implemented by another host component. In the pinned runtime the harness must
target that client as `--window-kind cold-load`; its reserved title-only `debugger`
classifier is not an observed route for this profile.

Its numeric/location grammar is:

```text
number in current base [dot -> establish point]
├─ Control/Meta/Super/Hyper numeric context -> decimal argument
├─ #'symbol -> function cell
├─ 'symbol -> symbol address
├─ backquote + Q/O/S -> object/input form
└─ @V / @P / @R / @U -> virtual / physical / region / unmapped segment
```

Typeout formats are character (`'`), bit numbers (`#`), array header (`A`), control
register (`C`), error trap (`E`), instruction (`I`), current-base integer (`O`), Lisp
pointer (`Q`) and Lisp object (`S`). Escape/lozenge modifies a command's secondary or
default argument only where that command defines it.

The point-stack prefix tree is:

```text
Control-Space -> push current point
Control-U Control-Space -> pop and select
Control-U Control-U Control-Space -> pop and discard
0 Control-Space -> display point stack
Control-Meta-Space -> exchange top points
numeric-argument Control-Meta-Space -> rotate points
```

Complete compact stack commands are:

| Command | Accelerator(s) |
| --- | --- |
| Show Argument | Control-Meta-A |
| Show Backtrace | Control-B, Meta-B, Control-Meta-B |
| Show Compiled Code | Control-Meta-D, Control-X D, Control-X Control-D |
| Show Frame | Control-L, Meta-L, Control-X Control-L, Control-X Control-A |
| Show Function | Control-Meta-F |
| Show Local | Control-Meta-L |
| Bottom / Top | Meta-`>` / Meta-`<` |
| Find Frame | Control-S |
| Next / Previous | Control-N or Meta-N / Control-P or Meta-P |

Complete location controls are: `=` Describe Location; `^`, Return, Line, Space or
Backspace set an open location when an argument is active; `/`, `^`, Tab, Line,
Space or Backspace show an open location when the set preconditions are absent; `;`
shows a supplied value in a format. The same `^` is context-sensitive. A conforming
implementation MUST decide from open-location and argument state before mutation
and SHOULD confirm historical memory writes.

Named debugger commands additionally include Describe Area, Describe Physical
Address, Describe Region, Describe Virtual Address, Symbol Function, Symbol Value,
Debug Process, Set Typeout Format, Set Base, Set Debugger Options, Set Default
Segment, Set Package, Mail Bug Report, Accelerator Help (Control-Help), and Abort
(Control-Z or Abort).

Named full commands enter through colon or Meta-X. Unlike the Lisp Debugger there is
no Lisp-form fallback, and the selected source/manual profile establishes no pointer
binding. Exact undefined-key diagnostics, completion behavior and nested Help topics
remain `TODO-RUNTIME` for the pinned 346,880-byte debugger image with SHA-256
`2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`.

VLM-only top-level leaves are:

| Command | Effect |
| --- | --- |
| `:Continue` | resume stopped Ivory execution |
| `:Show Version` | report VLM debugger/version identity |
| `:Shutdown` | terminate VLM and lose unsaved state |
| `:Start` | start/warm-start or resume a no-shutdown Halt |
| `:Show Status` | report virtual-machine status |
| `:Clear Screen` | erase Cold Load display |

The full VLM inventory is also maintained in the normative
[Ivory/FEP/VLM layer analysis](ivory-fep-and-open-genera-vlm-implementation-layers.md#ifep-and-vlm-debugger).
That incorporation MUST be version-pinned in any implementation test fixture.

## Query and degraded-window input trees

### Standard System 303 yes/no query

| Decision | Accepted input |
| --- | --- |
| Yes | `Y`, `T`, Space, Hand-Up |
| No | `N`, Rubout, Hand-Down |
| Help | print available primary choices and retry |
| Clear Screen | clear and retry |
| invalid | beep, clear typeahead, print choices and retry |

This complete FQUERY tree is inherited by each System 303 recovery question unless
the question explicitly adds choices.

### Explicit `EB-C303` locked-error diversion

```text
enter explicit Emergency Break
-> own keyboard; save main and who-line rasters
-> for each LOCKED-ERROR-WINDOW in order
   -> ask "handle this error in cold stream?"
      ├─ Yes -> restore saved screen; remove window; wake its debugger; exit
      └─ No -> next queued window
-> no selected queued error
   -> bind streams; display package/reason; run breakpoint
-> any unwind
   -> restore screen; restore keyboard-owner binding; terminate process
```

### Automatic System 303 locked-error arbitration

```text
unsafe error window
-> push on LOCKED-ERROR-WINDOWS without interrupts
-> free temporary locks
-> if immediate query enabled:
   save screen; own keyboard; clear cold input; ask C/U/N
   ├─ C -> remove this window; waiting debugger adopts cold stream
   ├─ U -> clear all window-system locks; retry normal notification
   ├─ N -> leave locks and wait
   ├─ Help/Clear Screen -> generic FQUERY behavior
   └─ invalid -> generic beep/typeahead-clear/list/retry
-> wait until safety predicate succeeds or window removed
-> unwind always removes stale list entry
```

No pointer aliases exist. In the selected source, the immediate query's local screen
restore is not itself enclosed by an unwind-protect. An injected nonlocal exit can
bypass that local restore even though the outer cleanup removes the queue entry and
unwinds keyboard ownership. `EB-C303` MUST preserve this in a legacy-exact mode. A
safer mode MAY guarantee restore but MUST label the deviation.

When immediate querying is disabled, external leaves are:

| Global route | Effect |
| --- | --- |
| Terminal Call | offer pending locked errors using the standard yes/no tree |
| Terminal Control-Clear-Input | clear window-system locks |
| Terminal `0 S` | select an interesting/error-pending window |
| Terminal Resume | permit deexposed typeout on interesting window |
| Terminal `N`, `1 N`, `2 N` | show, defer, or reset pending notifications according to argument |

### Terminal Hold Output trees

`EB-C46`:

```text
Terminal Hold-Output
├─ process exactly in Output Hold, with sheet and hold flag
│  -> free temporary locks; expose sheet
└─ otherwise -> beep
```

`EB-C303`:

```text
Terminal Hold-Output
├─ no suitable process/window -> beep
├─ temporary locks only -> free them; expose
├─ window or superior locked
│  ├─ ask attempt exposure while impersonating locking process?
│  │  ├─ Yes -> helper process, bounded at 10 seconds
│  │  │  ├─ success -> return
│  │  │  ├─ condition -> report; continue
│  │  │  └─ timeout -> reset helper; report; continue
│  │  └─ No -> continue
│  └─ ask forcibly unlock all window-system locks?
│     ├─ Y / Space / T -> clear locks
│     ├─ N / Rubout -> retain locks
│     ├─ D / E -> set Debug I/O to cold stream; interrupt process into debugger
│     └─ Help / Clear Screen / invalid -> FQUERY retry behavior
└─ exposed, unlocked, inexplicably held sheet
   ├─ Yes -> clear output-hold flag
   └─ No -> retain flag
```

Unless an earlier success/debugger branch returns, the ordinary tail attempts to
expose the target. The impersonated helper's success, condition and timeout are
three observably distinct results.

Genera retains the same diagnostic shape with a cold query when normal screen use is
unavailable. Its yes aliases are `Y`, Space and `T`; no aliases are `N` and Rubout;
Debugger is `D`. In the forcibly-unlock query, the debugger choice asynchronously
breaks the held process after routing Debug I/O to cold stream. A conforming Genera
profile MUST preserve the bounded helper and distinguish expose failure from
force-unlock authorization.

### Related global degraded leaves

| Profile/route | Effect |
| --- | --- |
| `EB-C46` Terminal Control-Clear-Input | clear window-system locks |
| `EB-C303` Terminal Control-T | deexpose only exposed temporary sheets whose locks are obtainable; ignore individual errors |
| `EB-C303` Terminal Control-Clear-Input | perform Control-T cleanup, then clear locks |
| C46/C303 Terminal Form | lock-aware redisplay only where locks can be obtained |
| `EB-G85` Function Control-T | clear temporary windows |
| `EB-G85` Function Control-Clear-Input | clear temporary windows, then locks |
| `EB-G85` Function Escape Output Hold | run the release's nested Output Hold diagnosis/query tree |

These leaves MAY be invoked from the cold evaluator by calling their Lisp functions,
but they are not automatically executed by Emergency Break.

## Lifecycle and transaction model

### `EB-C46` explicit breakpoint

The source-exact transaction is:

```text
entry
-> home cold cursor; clear rest of line
-> establish top-level catch
-> bind terminal I/O to cold stream
-> permit scheduling during Lisp evaluation
-> print current package and enter BREAK
-> Resume/Altmode-P, Altmode-G, RETURN form, error or nonlocal transfer
-> leave without a saved-screen restore transaction
```

Cold output can overwrite the visible ordinary display. Recovery of that display is
a separate operator redisplay action. A conforming `EB-C46` implementation MUST NOT
invent later screen-save or ownership semantics.

### `EB-C303` explicit breakpoint

```text
entry process
-> dynamically set COLD-LOAD-STREAM-OWNS-KEYBOARD = true
-> save main screen and who-line bitmaps
-> home cold cursor; clear current line
-> offer each locked error window
-> if none selected, bind query/terminal streams to cold stream
-> print package and reason
-> run BREAK inside named abort/error restart
-> unwind for every normal or abnormal exit
-> restore saved screen unconditionally
-> restore prior keyboard-owner binding
-> process terminates
```

Screen restoration is part of the explicit transaction, not a success-only action.
The implementation MUST cover Resume, Abort, `(RETURN ...)`, evaluator error and
nonlocal exit. A fault in the restoration mechanism itself follows the release's
ordinary error policy; it MUST NOT be relabeled successful recovery.

### `EB-G85` acquisition wrapper

`WITH-COLD-LOAD-STREAM` performs:

1. capture original terminal I/O and selected window;
2. construct/bind synthetic terminal I/O for query, debug, error, standard input and
   standard output;
3. preserve the inherited scheduler-inhibit value;
4. if terminal I/O is not already cold, mark this invocation as cleanup owner,
   mark the stream selected and request debugger takeover;
5. execute the body inside an Error/Abort restart whose purpose is leaving the cold
   breakpoint; and
6. on every unwind, invoke debugger recovery only when this invocation acquired the
   stream.

The keyboard/menu entry executes without interrupts, dynamically clears the
selected-window binding, reports the package and enters ordinary `BREAK`.

### `EB-G85` debugger takeover and recovery

Takeover MUST:

- switch terminal I/O to the cold stream;
- inhibit scheduling so one process owns primitive interaction;
- best-effort save a nonremote, unlocked main screen into a correctly sized raster;
- record the owner process and current debugger recursion level;
- select the stream, home the cursor, and print a reason banner.

Recovery MUST:

1. clear the stream-selected flag;
2. confirm that current process and debugger level equal the saved owner;
3. deselect/finish the cold stream;
4. clear ownership without interrupts;
5. temporarily force the required main-sheet locks;
6. copy the saved raster back;
7. deallocate the raster;
8. restore lock values/count; and
9. mark the who-line clobbered so it will be repaired.

A nested debugger level or foreign process MUST NOT restore the outer raster. It may
clear its local selected flag only. This exact owner-and-level condition prevents a
nested failure from prematurely repainting the screen of the suspended outer
debugger.

The cold stream's `SELECT` operation finishes pending output, sets its selected flag
and asks the FEP to select. `DESELECT` asks the FEP, finishes output and clears the
flag. These calls are observable lifecycle events even if a port has no physical
FEP.

### Availability branches

`EB-G85` source defines:

| Platform/condition | Result |
| --- | --- |
| 3600-family build | enter directly |
| I-machine other than restricted Domino case | enter |
| Domino with debug switch enabled | enter |
| unavailable and optional | post TV notification; do not pretend entry succeeded |
| unavailable and required | signal the stated reason so stack-trace/warm-boot policy can run |

The Null/Idle process uses required entry if it detects scheduling left inhibited or
preemption disabled. The lower takeover routine separately warns that some platforms
have a null cold stream; an implementation MUST distinguish guarded user entry from
an internal unguarded selection whose output would be invisible.

## Primitive display and stream protocol

### Genera Life Support operation set

The selected source's cold display uses these operation codes:

| Code | Operation |
| ---: | --- |
| `0` | draw character |
| `1` | set cursor position |
| `2` | clear rest of line |
| `3` | clear rest of window |
| `4` | draw lozenged string |
| `5` | draw lozenged character |
| `12` | beep |
| `13` | select stream/display |
| `14` | deselect stream/display |
| `200` | read input character |
| `201` | set display size |

An `EB-G85/L2` port MUST provide behaviorally equivalent operations and ordering. It
MAY encode them differently only below a conformance-visible adapter. Input must not
be lost across cursor/clear operations. Output completion must precede selection
state changes as described above.

### Required stream operations

The semantic stream protocol MUST cover:

- character and string output, cursor position and fresh-line handling;
- clear rest of line/window, home and finish output;
- character input, any-character input, unread input and listen/readiness;
- clear input, rubout-handler invocation and editable input buffer access;
- selection/deselection, size negotiation and beep;
- prompt/reprompt and display noise associated with input positions; and
- MORE pagination with the selected profile's interception semantics.

The `ANY-TYI` equivalent MUST avoid ordinary scheduler blocking outside rubout
editing. A reimplementation that waits on a normal window toolkit condition variable
while the scheduler is the failed subsystem MUST provide an independently serviced
life-support path or it is not `L2` conforming.

### Display geometry and rendering

Text advances by character width; newline advances by line height and returns to the
left edge. Tab targets the next multiple-of-eight column. Output that cannot be
represented directly SHOULD use a visibly delimited character name. Clearing and
redrawing input MUST preserve prompt, buffer and noise-string order exactly at the
semantic level, although the raster font and host pixel layout may differ outside a
selected visual profile.

## Error, abort, and recovery behavior

### Automatic cold debugger fallback

`EB-C46` selects cold debugger I/O when:

- the error occurs in scheduler, keyboard or mouse processing;
- terminal I/O is clobbered;
- printing the error fails and the retry also fails; or
- error-handler I/O is explicitly configured as the cold stream.

It homes and clears the primitive display. It does not save/restore the screen or
establish the later owner flag. Operator redisplay is separate.

`EB-C303` adds:

- first-entry-only screen save;
- the responsible second-level debugger stack group;
- cold-stream keyboard ownership;
- scheduling inhibition while the cold debugger is active;
- restoration of owner binding on unwind; and
- when that debugger stack group is freed, a standard yes/no/Help/Clear Screen
  question asking whether to restore the saved screen.

Choosing No deliberately leaves the cold display visible. A conforming
implementation MUST NOT restore automatically after No.

### Genera recursive degradation ladder

Each debugger entry increments depth. The exact policy is:

| Depth after entry | Required mode |
| ---: | --- |
| `0...14` | ordinary configured debugger I/O |
| `15...19` | force cold-load I/O; suppress ordinary display dependency |
| `20...24` | recursively call `BREAK` with warning to use emergency debugger |
| `25...29` | bind all relevant streams cold, inhibit scheduling, enter minimal `SI:EMERGENCY-BREAK` |
| `30+` | invoke auxiliary halt and hand control to FEP/VLM layer |

Cold or remote debugger sessions suppress proceed menus that require the ordinary
presentation surface. Threshold tests MUST distinguish 14/15, 19/20, 24/25 and
29/30; an implementation MUST NOT use `>= 15` for every degraded state.

### Genera process-abort dependency (D22; non-gating)

Process abort is a separate D22 process/scheduler application dependency. D04 owns
the semantic edge by which its timeout query can acquire and unwind the cold stream;
the query's generated physical shortcuts do not gate `EB-G85/L2`. Process abort is
initially cooperative. After its timeout, a query may appear on an ordinary popup or
the cold stream. The cold query takes the scheduler lock, acquires the cold stream,
and guarantees corresponding recovery on unwind. Its complete semantic choice set
is:

| Choice | Effect |
| --- | --- |
| Debug | asynchronously enter debugger; this abort attempt reports failure |
| Abort | record forcible abort and interrupt the victim process |
| Skip / Status | skip the current candidate or display status according to the query context |
| Wait Indefinitely | remove the timeout and continue waiting |
| Help/Clear/invalid | query framework behavior |

The exact displayed shortcut characters are query-generated and MUST be dumped from
the selected installed option set before claiming a physical key map. The semantic
choices above are source-required. This state machine MUST remain separate from the
user-facing Emergency Break process.

### Abort, reset, warm boot and world boundaries

- Cold-stream Abort signals the ordinary abort condition; it is not a process reset
  or boot.
- Meta-Abort in the System 303 breakpoint explicitly resets that Emergency Break
  process; it does not restore a band.
- A Genera warm reinitialization rebinds basic I/O to cold load, resets warm-boot and
  error-recursion state, and rebuilds process/screen-manager state. Source warns that
  current process state is lost without ordinary unwind; old processes run their
  warm-boot action or are flushed.
- Cold boot or world loading replaces a wider machine state and is outside this
  application transaction.
- `Halt Genera :Shutdown No` pauses the running VLM process; `:Start`/`:Continue`
  can resume it. `:Shutdown` makes unsaved state non-resumable. Save World is a
  separate guest operation requiring its own authorization and direct observation;
  it was not verified in `G85-RUN`.
- A host harness stop is containment evidence. It is not a guest Abort, Resume,
  Reset, Warm Boot or Save World.

### Failure matrix

| Failure point | Selected-profile result |
| --- | --- |
| cold stream unavailable, optional G85 entry | notification; no false success |
| cold stream unavailable, required G85 entry | signal reason into higher recovery |
| input modifier has no editor binding | beep/ignore after low-level intercepts |
| Rubout at empty | profile-specific full-rubout or beep |
| parse failure with correction | retain/redraw input; require edit/rescan |
| evaluation failure | enter ordinary debugger, potentially recursively degraded |
| screen not eligible for G85 save | continue without raster; cleanup MUST tolerate none |
| nested/nonowner G85 unwind | do not restore outer raster |
| condition during C303 impersonated expose | report, then continue force-unlock decision |
| helper timeout | reset helper, report timeout, continue decision tree |
| nonlocal exit from legacy C303 immediate locked query | local screen restore may be bypassed; outer queue/owner cleanup still runs |
| debugger depth 30 | auxiliary halt, not another Lisp reader |
| VLM host termination stall in identified runtime | bounded forced stop; mark incomplete; do not claim orderly exit |

## Observable behavior and bounded visual reference

### System 303 cold breakpoint

![The System 303 cold-load breakpoint displaying the researcher-entered form (+ 40 2) and result 42 over the saved Listener display.](assets/mit-cadr-screenshots/emergency-break-cold-load-evaluation.png)

*`C303-RUN`, 2026-07-18. The primitive break display announces the package and
cold-load-stream breakpoint, accepts a synthetic form and displays `42`. The entry
was invoked through the menu target's Lisp function rather than a successfully
observed item-selection dispatch; guest Resume/restoration was not verified in this
run. The exact image is approved only for this analytical use under the repository's
capture-specific rights review.*

An `EB-C303` visual profile MUST retain:

- the ordinary screen visible beneath/around primitive cold text when the raster is
  not cleared completely;
- a package line, breakpoint/recovery instructions and a command prompt;
- monospaced unornamented primitive output; and
- typed form and printed values in chronological order.

Exact font pixels and this screenshot's screen contents are not otherwise normative.

### Genera 8.5 actual System Menu entry and cold client

![The separate Open Genera Cold Load Stream client after actual System Menu Emergency Break entry, displaying (+ 40 2), the result 42, and the next Command prompt.](assets/genera-screenshots/emergency-break-arithmetic-evaluation.png)

*`G85-RUN`, 2026-07-19. The actual System Menu leaf launched a process whose banner
read “Emergency Break, using the cold load stream.” The researcher entered only
synthetic arithmetic, submitted it with the source-defined `End` character, and
received `42`. A subsequent `Resume` restored the saved main Listener display. The
exact image is approved only for D04 analysis and is excluded from the project
license.*

The tested VLM exposes the cold stream as a separate 1024 by 768 X client titled
`INTERNET|10.0.0.2 Cold Load Stream`. An `EB-G85` visual profile MUST preserve the
semantic separation between the primitive cold display and the 1200 by 900 main
Genera client, but a non-X port MAY represent them as independently targetable
surfaces. The cold view requires:

- an entry banner containing the supplied reason;
- current package identification;
- breakpoint name and Resume/Abort guidance;
- `Command:` prompt; and
- left-to-right form/result/new-prompt chronology.

### `G85-RUN` exact observation record

| Item | Recorded value |
| --- | --- |
| Session/generation | `d04-emergency-break-publication-20260719`, generation 1 |
| Interval | 2026-07-19 08:13:46–08:16:36 EDT |
| Archive | 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| World | 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| VLM | SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Debugger world | SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness source | SHA-256 `6f8c65bdc2f814a8408f92eb05d3fac68eafefefe889bd02e570059694145497` |
| Arithmetic image | 1024 by 768; PNG `b7edcce3ba94e9601335ac280438988d5ae40451c1f2235f2b5fe786f8736eb6`; pixels `219c9bce8d7771553141df4873aced28255317f6e7b1cd9700c61ef5ac834445` |
| Restored-main image | 1200 by 900; PNG `641dcef54b379e67a74e5e7bd19bbb5838ae42d01d5b63f8536c8fd2695bb35d`; pixels `a82369a293e213a82ff65db8b02843f83693fe94a869e560f54ad8c59fa76f7d` |
| Final action log | 42 records; SHA-256 `0e3563bb5af99754dd00e08f294cdfc235e9bc2988b019c418342073f794bcdd` |
| Persistence | base/private world unchanged; `save_world_invoked_by_harness=false`; `process_checkpoint_created_by_harness=false`; `save_world_performed` and `guest_checkpoint_created` unknown; unsaved Lisp state recorded discarded/non-resumable after VLM termination |
| Stop | confirmation and cleanup progress observed; known forced mutex-stall cleanup; `state_may_be_incomplete=true` |

The action sequence included explicit exact-window selection. After two nonselecting
menu attempts retained as negative evidence, the successful sequence held Shift and
right button, exposed the menu, moved to the highlighted Emergency Break row,
released, then selected it with left. The cold client showed the exact reason banner.
The harness typed `(+ 40 2)`, sent `end` -> `KP_End`, observed `42`, sent `resume` ->
`F5`, and captured the restored main client. Host success records alone do not carry
these claims; the before/after pixels do.

## Reference semantic protocol inventory

A clean-room implementation MAY use different names, but the following roles and
observable contracts MUST exist for `L2`:

| Interface | Required operations |
| --- | --- |
| `GlobalRecoveryRouter` | parse profile prefix/argument; launch named recovery process; dispatch System Menu item; report unavailable path |
| `ColdConsole` | select, deselect, size, home, cursor, clear-line/window, draw char/string/name, beep, finish, read raw char |
| `ColdInputEditor` | editable buffer, scan/fill positions, rubout/full-rubout, activation/blip, unread/listen, prompt/reprompt/noise, Help priority, parse recovery |
| `ColdPaginator` | page threshold, MORE marker, Suspend/Abort/Space/consume tree, disabled wrap |
| `ColdAcquirer` | capture bindings; acquire only once; scheduler/keyboard ownership; optional raster; cleanup predicate and unwind |
| `BreakpointEvaluator` | package/reason banner; form read/eval/print; multiple-value histories; Resume/Abort/return-form exits |
| `LockedErrorBroker` | ordered queue, safety wait, C/U/N decisions, external diversion and stale-entry cleanup |
| `OutputHoldRecovery` | diagnose temporary locks/superior lock/inexplicable hold; bounded helper; query; unlock/debugger/expose outcomes |
| `DebuggerEscalator` | depth counter and exact 15/20/25/30 transitions |
| `MachineDebuggerBridge` | pause/halt status and address-oriented debugger, independent of Lisp reader |
| `BindingIntrospector` | dump base and overlay graphs with prefixes, context, aliases, arguments, pointer buttons and unbound leaves |

Each operation MUST define success, recoverable failure, abnormal unwind and any
side effect on ownership, locks, screen pixels, process state, input buffer and
history. It MUST NOT expose a generic “recovered” result that erases these states.

## Exact source-interface and module closure

`L3` is reserved because this specification does not close:

- every historical package/export and nickname;
- exact function/macro lambda lists, special variables and setf protocols;
- all flavors/classes/method combinations and object layouts;
- conditions, handlers, restarts and nonlocal tag names;
- module definitions, compilation order, patch systems and load-time side effects;
- machine word/tag layouts, FEP wire records, VLM ABI, QFASL or world relocation;
- exact printer/readtable/package behavior for arbitrary forms; or
- binary compatibility with an existing band/world.

An implementation claiming `L3` MUST publish that closure separately and run it
against the exact selected source profile. Semantic `L2` conformance MUST NOT be
advertised as source, ABI or image compatibility.

## Conformance test suite

Every test records profile, source/artifact identity, base binding graph hash,
overlays, ordered inputs, semantic output and final ownership/lock/screen state.

### Artifact and profile isolation

| ID | Test |
| --- | --- |
| `EB-T01` | verify every selected artifact byte count and SHA-256 before fixture generation |
| `EB-T02` | reject a mixed fixture that claims maintained LM-3 source is the exact System 303-0 build |
| `EB-T03` | reject a mixed profile that gives C46 saved-screen or G85 owner-level behavior |
| `EB-T04` | dump effective base binding graph plus site/runtime overlays separately |

### Global entry and prefixes

| ID | Test |
| --- | --- |
| `EB-T05` | C46 Terminal parser: absent, zero, positive, negative, `8`/`9` in the radix-eight recurrence, multiple digits, registered/unregistered fallthrough and second-prefix reset |
| `EB-T06` | C303 Terminal parser: absent, zero, signed decimal, multiple digits, B/#x1D/O/S, exact registered suffix, asynchronous quote, Rubout and beep fallbacks |
| `EB-T07` | prove list-form Call ignores every parsed numeric argument in C46/C303 |
| `EB-T08` | G85 Function disabled branch beeps and launches nothing |
| `EB-T09` | G85 Function signed argument/reset/O/S/uppercase/modifier retention, firewall/registry owner dump, Help/Rubout/async and unbound leaves |
| `EB-T10` | prove Function Suspend launches exact name/priority/typeahead path and ignores numeric argument |
| `EB-T11` | traverse D02 application-window, unselected-window, `:FORCE-KBD-INPUT`, double-Right, no-window bit-priority and G85 Right-modifier routes before every relevant System Menu button/blank-area/release path |
| `EB-T12` | prove cold-stream context has no pointer binding after selection |

### Cold reader and pagination

| ID | Test |
| --- | --- |
| `EB-T13` | table-drive every C46 Clear/Form/Vertical-Tab/Rubout/bucky/plain/parse branch |
| `EB-T14` | table-drive every C303 Clear/Form/Delete/Rubout-empty/content/End/bucky/plain branch |
| `EB-T15` | verify nested C303 rubout options, parse-condition display and interrupted-buffer scan restoration |
| `EB-T16` | table-drive G85 low-level Hyper-Control-Function, Control-Suspend, Control-Meta-Suspend and Control-Abort precedence |
| `EB-T17` | table-drive every G85 blip, activation-immediate, activation-after-edit, Refresh, Control-Refresh, Clear Input, Rubout, Help-priority, bucky and plain branch |
| `EB-T18` | verify G85 End is activation, Return is not substituted, and unlisted navigation/edit keys beep rather than acquiring invented commands |
| `EB-T19` | verify UNTYI list/character/scan-back branches, LISTEN priority and CLEAR-INPUT hardware drain |
| `EB-T20` | verify MORE threshold and Suspend/Abort/Space/other consumption plus disabled wrap |
| `EB-T21` | verify tab columns and lozenged unsupported-character output |

### Evaluators and debugger transition edges

| ID | Test |
| --- | --- |
| `EB-T22` | C46 Altmode-P/Resume, Altmode-G, return-form, ordinary form, multiple values and all histories |
| `EB-T23` | C303 Resume, Abort, Control-Z, Break, Meta-Abort, Meta-Break, return-form, ordinary form and End at command boundary and mid-form |
| `EB-T24` | G85 first-nonwhitespace Resume, Abort, Control-Z, Suspend, Meta-Suspend, return-form multiple values, ordinary form, End and evaluation-error transition |
| `EB-T25` | minimal G85 evaluator return-form, zero/one/multiple values and both history families |

### D12 debugger application dependency closure (non-gating for D04)

`EB-T26` through `EB-T31` close the separately scoped D12 debugger applications.
They preserve the audit obligations discovered here but do not gate `EB-*/L2`.

| ID | Test |
| --- | --- |
| `EB-T26` | exhaust every non-null C46 debugger table key/range and unbound neighbor |
| `EB-T27` | exhaust every C303 debugger table key/range, all Help topics and dynamic Super-choice sizing |
| `EB-T28` | exhaust every Genera printed/named accelerator and source addition, including manual/source Show Arglist discrepancy as two profiles until runtime resolves it |
| `EB-T29` | traverse every Control-X leaf, prefix Help and unknown leaf; every Standard Arguments class; the exact frame-PDL Control-Space argument-class tree; and argument consumption/rejection without invented timeout |
| `EB-T30` | traverse every Display Debugger button, middle/right alternative, submenu item and End exit; inject all 96 raw Dynamic Windows cells over every debugger-specific pane presentation; dump inherited/site translator overlays and the effective Right menu |
| `EB-T31` | compare a machine-readable effective tree isomorphically with the complete normative inventory; no undocumented terminal node may be silently ignored |

### Ownership, locks and degraded recovery

| ID | Test |
| --- | --- |
| `EB-T32` | C46 entry leaves display damage and requires separate redisplay |
| `EB-T33` | C303 normal, Abort, error and injected nonlocal exits all restore exact raster and keyboard owner |
| `EB-T34` | G85 acquisition already-cold nesting acquires/cleans exactly once |
| `EB-T35` | G85 restore requires both owner process and exact debugger level |
| `EB-T36` | G85 no-eligible-screen path cleans safely without a raster |
| `EB-T37` | standard yes/no query exercises every alias, Help, Clear Screen and invalid retry |
| `EB-T38` | locked-error fixture exercises C/U/N, query-disabled wait, Terminal Call diversion, external lock clearing and stale cleanup |
| `EB-T39` | inject nonlocal query exit and distinguish legacy screen-restore defect from safer optional profile |
| `EB-T40` | C46 Output Hold success and beep branches |
| `EB-T41` | C303/G85 Output Hold: no target, temporary locks, impersonated success/condition/10-second timeout, unlock/no/debugger and inexplicable-hold branches |
| `EB-T42` | Control-T, Control-Clear-Input and Form leaves respect lock availability and ordering |

### Automatic fallback and persistence

| ID | Test |
| --- | --- |
| `EB-T43` | independently trigger C46 scheduler, keyboard, mouse, clobbered-I/O, double-print-failure and explicit-cold causes |
| `EB-T44` | C303 first/nested cold debugger entries and Yes/No screen-restore question |
| `EB-T45` | inject G85 depths 14, 15, 19, 20, 24, 25, 29 and 30 |
| `EB-T46` | branch-test G85 3600, I-machine, Domino switch, optional unavailable and required unavailable policies |
| `EB-T50` | distinguish guest Resume, guest Abort, process reset, warm boot, cold boot, VLM shutdown, host stop and Save World in evidence records |

### D22 process/scheduler dependency closure (non-gating for D04)

| ID | Test |
| --- | --- |
| `EB-T47` | process-abort popup/cold fallback, every semantic decision, and runtime dump of the installed query's generated physical shortcuts |

### D52 VLM Debugger dependency closure (non-gating for D04)

| ID | Test |
| --- | --- |
| `EB-T48` | VLM numeric/segment/typeout grammar, point-stack prefixes, stack/location commands and context-sensitive mutation confirmation |
| `EB-T49` | pause with no-shutdown halt, run read-only VLM version/status and resume with Start/Continue; separately record harness Save-World/checkpoint flags, guest unknowns and world hashes |

### Visual and runtime oracle tests

| ID | Test |
| --- | --- |
| `EB-T51` | render required C303 and G85 semantic regions at legible resolution without decorative manual/source reproduction |
| `EB-T52` | actual G85 menu leaf reason string must be `Emergency Break`, proving dispatch rather than a direct substitute call |
| `EB-T53` | G85 synthetic form -> `42` through exact cold client and `End`; Resume -> restored main display |
| `EB-T54` | compute exact PNG and normalized-pixel hashes for curated evidence; retain raw-to-curated byte identity |
| `EB-T55` | stop with no harness Save-World/checkpoint request; assert those exact false fields, unknown guest fields, unchanged world hashes, shutdown markers and incomplete-state label independently |

## Preserved-system comparison procedure

1. Select one profile and verify its source/world/band identities.
2. Create a disposable isolated runtime. Do not expose licensed Genera media or an
   ordinary host file service.
3. Dump the installed D04 global and reader binding graphs before interaction; dump
   debugger graphs only as separately labeled D12/D52 dependency evidence.
4. Establish a harmless Listener state whose pixels can be compared after recovery.
5. Enter through the exact keyboard prefix and exact System Menu path separately.
6. Target the primitive client/surface explicitly; fail on zero or multiple matches.
7. Exercise one side-effect-free form and the source-defined activation key.
8. Exercise the profile's supported Resume/Abort path and compare ownership, locks
   and saved pixels.
9. Test destructive/lock/debugger branches only with synthetic fixtures and explicit
   restoration assertions.
10. Stop without the harness invoking Save World or creating a host checkpoint unless
    persistence is the separately authorized test; retain independent in-guest
    save/checkpoint fields as unknown absent direct evidence.
11. Freeze the action log, input hashes, screen hashes and stop result.
12. Publish only original description and the minimum image approved by a
    capture-specific rights review.

### Runtime closure probes

The following remain `TODO-RUNTIME`:

- run a compatible System 46 band and capture its exact direct/no-save display;
- resolve the current System 303 host mapping for guest Resume and prove saved-screen
  restoration;
- exercise Genera `Function Suspend`, including ignored numeric argument and
  typeahead lifecycle;
- exercise every Genera cold editor key, Help mode, MORE branch and pointer
  nonbinding;
- create safe System 303 and Genera locked-error and Output Hold fixtures;
- trigger automatic cold debugger fallback and nested owner-level cleanup without
  manufacturing unsafe damage;
- branch-test actual VLM platform availability;
- use the now-capable exact cold-window selector for a separate read-only VLM
  `:Show Version`/`:Show Status` and pause/resume observation, routed to D52 and
  non-gating for `EB-G85/L2`; and
- dump the live Display Debugger's inherited presentation-translator overlays and
  compare every effective Right menu against the source-bounded base candidates,
  routed to D12 and non-gating for D04.

## Known unknowns and nonclaims

- The maintained LM-3 check-in is not proven to be the exact source of the System
  303-0 band.
- The licensed Genera source tree is not proven byte-for-byte identical to every
  resident function in the base world.
- The System 303 Resume source/runtime discrepancy remains unresolved at the host
  mapping or compiled-band layer.
- `G85-RUN` proves one menu dispatch, `End`, arithmetic, Resume and restored main
  pixels; it does not prove exact screen-save eligibility for remote/color/locked
  screens.
- The first two publication-run menu attempts changed the global input status but
  did not display/select the item. The successful third attempt is the positive
  oracle; the timing/focus cause of the earlier attempts remains unknown.
- No claim is made that the cold stream retains full ordinary debugger usability at
  every recursion depth. The specified suppression and degradation rules control.
- The Display Debugger's debugger-specific translators are source-bounded, but its
  effective Right menus remain open to inherited Dynamic Windows and loaded-world
  overlays until the required runtime dump is captured.
- No VLM Debugger screenshot or live command claim is added by D04.
- No claim is made that a modern host's `End`, `F5`, modifier or mouse names match a
  physical Symbolics/CADR keyboard electrically.
- No extracted Genera source, font, help corpus, world data or raw session record is
  redistributed by this specification.

## Artifact identities and rights boundary

Public CADR/LM-3 source and the tracked CADR screenshot follow their recorded public
provenance and image-specific review. Licensed Genera archive/source/world/debugger,
raw captures, sidecars and action logs remain ignored local evidence. The tracked
Genera PNG is an exact minimal excerpt selected for criticism, scholarship and
historical documentation after a four-factor review; it is excluded from the
project license and conveys no right to the underlying software or other captures.

The exact decisions and raw mappings are in:

- [runtime screenshot publication review](screenshot-publication-rights-review.md);
- [CADR screenshot catalog](assets/mit-cadr-screenshots/); and
- [Genera screenshot catalog](assets/genera-screenshots/).

A reimplementation MUST NOT require proprietary extracted data to run its
conformance suite. Fixtures derived from licensed behavior must be abstract semantic
records or independently created test values, not copied source/world content.

## Sources

- MIT System 46,
  [`lmwin/basstr.163`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/basstr.163#L388),
  Terminal prefix and breakpoint, and
  [`lmwin/cold.47`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/cold.47#L80),
  primitive reader; inspected 2026-07-19.
- MIT System 46,
  [`lispm/ltop.231`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/ltop.231#L151),
  breakpoint evaluator;
  [`lmwin/sysmen.105`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/sysmen.105#L61),
  menu route; and
  [`lmwin/eh.48`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/eh.48#L819),
  fallback; inspected 2026-07-19.
- MIT System 46,
  [`lmwin/ehc.36`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/ehc.36#L5),
  complete reader/dispatch, and
  [`lmwin/ehw.56`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/ehw.56#L1),
  graphical menu and pointer paths; inspected 2026-07-19.
- Maintained LM-3 System,
  [`window/basstr.lisp`](https://tumbleweed.nu/r/sys/file?name=window%2Fbasstr.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`window/cold.lisp`](https://tumbleweed.nu/r/sys/file?name=window%2Fcold.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and [`sys/ltop.lisp`](https://tumbleweed.nu/r/sys/file?name=sys%2Fltop.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  inspected 2026-07-19.
- Maintained LM-3 System,
  [`eh/eh.lisp`](https://tumbleweed.nu/r/sys/file?name=eh%2Feh.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`window/sheet.lisp`](https://tumbleweed.nu/r/sys/file?name=window%2Fsheet.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  and [`io1/fquery.lisp`](https://tumbleweed.nu/r/sys/file?name=io1%2Ffquery.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  inspected 2026-07-19.
- Maintained LM-3 System,
  [`eh/ehc.lisp`](https://tumbleweed.nu/r/sys/file?name=eh%2Fehc.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  complete reader/dispatch/Help;
  [`eh/ehw.lisp`](https://tumbleweed.nu/r/sys/file?name=eh%2Fehw.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  graphical debugger; and
  [`eh/ehbpt.lisp`](https://tumbleweed.nu/r/sys/file?name=eh%2Fehbpt.lisp&ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  traps, breakpoints and stepping; inspected 2026-07-19.
- MIT, [window debugging manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/wdebug.6),
  for contemporary operator intent; inspected 2026-07-19.
- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  for public VLM control and persistence boundaries; inspected 2026-07-19.
- Licensed Genera artifacts identified in the evidence ledger, inspected locally
  2026-07-19; no proprietary source body is reproduced.
- [Emergency Break and the cold-load stream](emergency-break-and-cold-load-stream.md),
  source/runtime dossier.
- [MIT error handler and debuggers](mit-cadr/error-handler-and-debuggers.md),
  complete public debugger analysis.
- [Genera Debugger and Display Debugger](genera/debugger-and-display-debugger.md),
  complete command, accelerator and gesture analysis.
- [Program selection and window management specification](program-selection-activities-and-window-management-reimplementation-specification.md),
  global prefix and System Menu substrate.
- [Ivory, FEP and VLM implementation layers](ivory-fep-and-open-genera-vlm-implementation-layers.md),
  machine-debugger and persistence boundary.
- `G85-RUN` ignored session/action/screenshot records described above, inspected
  2026-07-19.

Last verified: 2026-07-19.
