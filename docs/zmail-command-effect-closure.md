---
type: Reimplementation Specification
title: ZMail named-command effect closure
description: Normative source-profile closure for every System 303 and Genera 8.5 ZMail top-level completion command, including effects, applicability, partial failures, ownership, and count checks.
tags: [mit-cadr, genera, zmail, mail, commands, reimplementation]
timestamp: 2026-07-19T18:44:32-04:00
---

# ZMail named-command effect closure

## Status and reconstruction claim

This companion closes the named-command surface of the
[ZMail and mail-composition reimplementation specification](zmail-and-mail-composition-reimplementation-specification.md)
(D08): a conforming implementation of the selected source profiles MUST implement
each of the 86 System 303 definitions and each of the 152 Genera 8.5 completion
candidates exactly once, with the application-owned ordering and failure boundary
listed below. This is a semantic and source-profile contract. It is not evidence that
the commands were resident in the tested System `303-0` band, nor that the preserved
Genera 8.5 world has no site, patch, profile, or user additions.

**Compatibility boundary:** source-profile semantic command compatibility, plus
behavioral compatibility only for rows whose effect traces pass the conformance
suite. **Excluded and reserved claims:** this page does not claim loaded-world
identity, downstream service reimplementation, public or historical Lisp API
compatibility, file or binary compatibility, timing, or visual identity.

The Genera descriptions are original analysis. They disclose names needed to identify
the interface, source identities, concise behavior, and test obligations; they do not
reproduce proprietary source bodies or documentation. Licensed inputs remain local.

## Normative vocabulary and scope

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. “Then” gives observable order;
it does not imply atomicity. “Prompt” includes the source's minibuffer, menu, or query
interaction. Unless a row says otherwise, abort while choosing an operand precedes
the first application mutation, but an error after the first listed mutation retains
completed effects. The command loop's preflight and recovery contract remains D08's
[foreground command transaction](zmail-and-mail-composition-reimplementation-specification.md#foreground-command-transaction).

The tables cover the named top-level completion registries. Direct generic ZWEI
bindings, integrated-draft-only commands, transient task buttons, TV blips, Dynamic
Windows translators, and separate Zmacs Mail mode are closed by D08's
[complete effective input and gesture trees](zmail-and-mail-composition-reimplementation-specification.md#complete-effective-input-and-gesture-trees),
not counted again here.

Visible layout and the two reviewed runtime images are incorporated from D08's
[visible-interface evidence](zmail-and-mail-composition-reimplementation-specification.md#visible-interface-requirements-and-runtime-evidence).
This command-effect companion adds no decorative or payload screenshot.

## Compatibility profiles and closure levels

This companion inherits D08's `C303` and `G85` release profiles and its `L1`, `L2`
and `L3` ladder. Matching the static denominator and tuples supports the `L1`
interface/data claim. The complete command-effect tests below are required for the
source-profile behavioral `L2` claim. The two preserved-runtime oracles are required
only for the corresponding `L3` preserved-system claim; leaving them open does not
silently demote source-closed `L2` behavior. This page does not claim public API,
historical-source, file-format, binary, timing, or pixel compatibility.

### Source identities

- `C303` means the public maintained LM-3 System source at Fossil check-in
  `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.
  A source cell such as `zmail/comnds.lisp:146` names that pinned path and starting
  line. The public file browser is the stable source authority; for example,
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp).
- `G85` means the Genera source profile System 452.1 / Zmail 442.0 selected by
  `zmail/patch/zmail.system-dir.~262~`, not an assertion that these source bytes and
  the inspected Genera 8.5 world are identical. Every G85 source cell gives an
  artifact-relative physical filename and line. File sizes and hashes are in D08's
  [licensed evidence ledger](zmail-and-mail-composition-reimplementation-specification.md#licensed-genera-evidence-only-artifacts).
- `C303-SRC` and `G85-SRC` establish source-visible order. `G85-RUN` in D08 establishes
  only the separately recorded empty-reader and Zmacs Mail paths; no row below is
  mislabeled as runtime-observed.

## Command architecture and ownership model

Every completion candidate is an application adapter around D08 state plus, where
listed, a delegated editor, file, network, print, compiler, distribution, encryption,
or submission service. Dispatch first applies wrapper preconditions, then the
command-owned operand and button logic, then ordered model and adapter effects, and
finally returns a redisplay/result indication. The tables specify that chain without
turning downstream services into ZMail-owned implementations.

### Applicability notation

Each applicability cell is exhaustive for the command wrapper and adds any body-level
button branch:

| Token | Meaning |
| --- | --- |
| `M` | a current message is required |
| `S` | a current sequence/buffer is required; where `M` appears, `S` is implied |
| `M0` | the command is permitted without a current message |
| `S0` | the command is permitted without a current sequence/buffer |
| `N` | a numeric argument is admitted and interpreted as stated; absence of `N` means the wrapper rejects one before the body |
| `D` | the Genera wrapper applies its dangerous-command confirmation policy |
| `K/L/M/R` | keyboard, left, middle, and right command-button ingress; “same” means no command-owned branch |

System 303's source spelling `NO-ZMAIL-BUFFER-OK` maps to `S0`; Genera's
`NO-SEQUENCE-OK` maps to the same semantic precondition. `NO-MSG-OK` maps to `M0`.
An admitted numeric argument can still be used only as a boolean selector by a
particular command. D08's [numeric rules](zmail-and-mail-composition-reimplementation-specification.md#numeric-arguments-repeat-and-unbound-behavior)
remain normative.

### Failure and ownership notation

| Token | Required boundary |
| --- | --- |
| `V` | validation, empty history, inapplicability, or canceled operand selection precedes application mutation |
| `U` | an undo record is created where stated, but rollback is not automatic; later failure can retain a partial mutation |
| `P` | an ordered per-message, per-file, per-rule, or multi-step mutation retains completed earlier effects |
| `X` | the row crosses a filesystem, network, printer, compiler, editor, distribution, or submission adapter; the application does not promise rollback after delegation begins |
| `I` | only application interaction/display/configuration state is changed before redisplay; a later redisplay failure does not restore it |

The final column identifies the normative owner. `D08 reader`, `D08 storage`, `D08
draft`, `D08 calendar`, `D08 input`, and `D08 background` refer respectively to the
[reader contracts](zmail-and-mail-composition-reimplementation-specification.md#reader-collection-and-message-contracts),
[persistence contracts](zmail-and-mail-composition-reimplementation-specification.md#mail-file-and-persistence-contracts),
[draft contracts](zmail-and-mail-composition-reimplementation-specification.md#composition-and-draft-contracts),
[calendar contract](zmail-and-mail-composition-reimplementation-specification.md#genera-calendar-and-reminder-overlay-contract),
[input trees](zmail-and-mail-composition-reimplementation-specification.md#complete-effective-input-and-gesture-trees),
and [background ordering](zmail-and-mail-composition-reimplementation-specification.md#background-worker-ordering).
When another dossier owns the downstream service, this page specifies the ZMail
adapter left in scope.

## System 303: all 86 definitions

The order here is deterministic source-path and source-offset order. Humanized names
are the exact completion names produced by the selected naming rule.

| ID | Completion name | Source owner | Family | Ordered observable effect | Applicability | Failure / partial-effect boundary | Normative owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C303-001 | Self Document | `zmail/comnds.lisp:146` | help | Read one input event, resolve it against the effective ZMail table, then display the inherited line-help result. | `S0`; `K/L/M/R` same | `V`; no mail state changes | [D07 Help](help-self-documentation-and-document-examiner-reimplementation-specification.md); ZMail supplies the active table |
| C303-002 | Apropos | `zmail/comnds.lisp:152` | help | Prompt for a substring, scan the current named-command alist, then list matching names and documentation. | `S0`; same | `V`; registry is read-only | D07 Help; ZMail supplies and orders its registry |
| C303-003 | Documentation | `zmail/comnds.lisp:168` | help | Install the ZMail completion alist for the help reader, accept a key or star request, then describe the selected command set. | `S0`; same | `V`; no mutation | D07 Help; D08 input owns ZMail-specific star/key routing |
| C303-004 | Help | `zmail/comnds.lisp:180` | help | Perform the same ZMail help dispatch as Documentation. | `S0`; same | `V`; no mutation | D07 Help; alias identity remains visible to completion |
| C303-005 | Extended Command | `zmail/comnds.lisp:249` | dispatch | Prompt from the ZMail named-command alist, bind the selected command as current, then invoke it with the existing numeric state. | `S0 N`; same | `V` before invocation; selected command owns later partial effects | D08 input; D07 owns completion mechanics |
| C303-006 | Large Argument | `zmail/comnds.lisp:269` | argument | Replace numeric state with signed `37777777` and mark it as the large/infinite argument; return to prefix dispatch without running a mail operation. | `S0`; same | `I`; argument state alone changes | D08 input |
| C303-007 | Next | `zmail/comnds.lisp:284` | navigation | Resolve next-mode from keyboard/left or the middle/right policy, search in that direction, then select the result. | `M N`; `K/L` next undeleted, `M` profile default, `R` menu | `V` if no target; selection changes only after resolution | D08 reader |
| C303-008 | Down to Next | `zmail/comnds.lisp:296` | navigation | Move forward by the source-defined count including deleted messages, then select the target. | `M N`; same | `V` at sequence boundary | D08 reader |
| C303-009 | Previous | `zmail/comnds.lisp:310` | navigation | Resolve previous-mode from keyboard/left or middle/right policy, search backward, then select the result. | `M N`; `K/L` previous undeleted, `M` profile default, `R` menu | `V` if no target | D08 reader |
| C303-010 | Up to Previous | `zmail/comnds.lisp:323` | navigation | Move backward by the source-defined count including deleted messages, then select the target. | `M N`; same | `V` at sequence boundary | D08 reader |
| C303-011 | Delete | `zmail/comnds.lisp:362` | message state | Resolve a numbered message or button-selected delete mode; mark it deleted; then perform the selected next, previous, none, or remove transition. | `M N`; `K/L` policy, `M` middle policy, `R` menu | `P`: delete can precede a failing movement; Remove has its own temporary-sequence check | D08 reader |
| C303-012 | Delete and Up | `zmail/comnds.lisp:384` | message state | Mark the current message deleted, then select the previous undeleted message. | `M`; same | `P`: deletion remains if backward selection fails | D08 reader |
| C303-013 | Remove | `zmail/comnds.lisp:396` | collection state | Verify a removable temporary sequence, remove the current member, then select according to deletion policy. | `M`; same | `V` for disk-backed sequence; `P` after removal | D08 reader |
| C303-014 | Undelete | `zmail/comnds.lisp:411` | message state | With `N`, resolve that message and require its deleted flag; otherwise scan backward for the nearest deleted message; clear the flag and select it. | `M N`; same | `V` before flag clear when no deleted target | D08 reader |
| C303-015 | Set Pop Mark | `zmail/comnds.lisp:575` | point stack | Interpret the universal-argument state as push, pop-and-move, or pop-and-discard; then update point-stack and possibly selection. | `M N`; same | `V` on empty stack; a pop precedes a failing target selection | D08 reader |
| C303-016 | Move to Previous Point | `zmail/comnds.lisp:617` | point stack | Rotate the top two points by default, the whole stack for one, or the signed requested span; then select the new point. | `M N`; same | `V` for invalid/empty rotation; stack rotation precedes selection | D08 reader |
| C303-017 | Move to Default Previous Point | `zmail/comnds.lisp:625` | point stack | If `N`, replace the remembered rotation count; rotate by that remembered count; then select. | `M N`; same | `P`: a new default remains if rotation later fails | D08 reader |
| C303-018 | Mouse Point PDL | `zmail/comnds.lisp:656` | typeout navigation | Choose summary or message typeout, render saved points as selectable items, then service a selected point. | `M`; pointer/typeout | `V` before selection; parse or typeout failure leaves mail state unchanged | D08 reader and D08 input |
| C303-019 | Quit | `zmail/comnds.lisp:709` | lifecycle/storage | Resolve the button's save/expunge/kill choices, process affected buffers, then deselect and bury the reusable frame. | `S0`; `K/L` normal policy, `R` option menu | `P X`; completed file operations survive later failure; ordinary Quit is not frame kill | D08 storage and [reader quit](zmail-and-mail-composition-reimplementation-specification.md#reader-quit-bury-kill-and-reinitialize) |
| C303-020 | Not Modified | `zmail/comnds.lisp:729` | storage state | Clear the current buffer's modified indication without writing it. | `S M0`; same | `V` if no buffer; then immediate state change | D08 storage |
| C303-021 | Save | `zmail/comnds.lisp:739` | storage | Choose ordinary all-file save/expunge or right-button per-file operations; execute them in selected order. | `S M0`; `R` operation menu | `P X`; earlier expunges/writes/kills remain | D08 storage |
| C303-022 | Kill Current Buffer | `zmail/comnds.lisp:750` | buffer lifecycle | Validate replacement/dirty-buffer policy, optionally save, detach the current buffer, then select a replacement. | `S M0`; same | `P X`; a completed save or detach is not rolled back | D08 reader and storage |
| C303-023 | Expunge | `zmail/comnds.lisp:759` | storage | Remove messages marked deleted from the current disk-backed buffer and rewrite/refresh its sequence state. | `S M0`; same | `P X`; strict C303 file-write ordering applies | D08 storage |
| C303-024 | Edit Current Msg | `zmail/comnds.lisp:1124` | integrated editing | Materialize the selected message in the message editor, switch to its edit layout/table, and leave message changes governed by editor exit. | `M`; same | `V` before layout switch; later edit mutation follows D08/D05 editor boundaries | D08 draft plus [D05 editor family](eine-zwei-and-zmacs-editor-family-reimplementation-specification.md) |
| C303-025 | Keywords | `zmail/comnds.lisp:1199` | classification | Resolve remembered, filter-derived, or menu-selected add/remove sets; save undo state; update keywords and summary. | `M`; `L` repeats, `M` derives, `R` chooses | `U`; validation precedes header/status mutation | D08 reader |
| C303-026 | Move | `zmail/comnds.lisp:1319` | filing | Resolve a destination from prompt, remembered target, filters, or menu; add the message there; update remembered target and current-message state. | `M`; `K/L/M/R` have distinct chooser paths | `P X`; a destination add is retained if later state recomputation fails | D08 reader and storage |
| C303-027 | Rename Buffer | `zmail/comnds.lisp:1603` | collection state | Prompt for a unique name, replace the current buffer name, then refresh labels/registries. | `S M0`; same | `V` before rename; `I` after registry mutation | D08 reader |
| C303-028 | Refresh | `zmail/comnds.lisp:1621` | display | Invalidate the reader display and perform complete redisplay. | `S0`; same | `I`; no model rollback on drawing failure | D08 reader |
| C303-029 | Start of Msg | `zmail/comnds.lisp:1630` | display navigation | Set message viewport to its beginning and redisplay. | `S0`; same | `I`; no message mutation | D08 reader |
| C303-030 | End of Msg | `zmail/comnds.lisp:1639` | display navigation | Set message viewport to its end and redisplay. | `S0`; same | `I`; no message mutation | D08 reader |
| C303-031 | Mode Line Scroll | `zmail/comnds.lisp:1664` | display navigation | Resolve forward, backward, beginning, or end from the mode-line buttons; scroll the message pane. | `S0`; `L` forward, `M` backward, `R` menu | `I`; no message mutation | D08 input and reader |
| C303-032 | Scroll Summary Window | `zmail/comnds.lisp:1687` | display navigation | Apply the numeric/default scroll amount to the summary viewport, independent of the message viewport. | `S M0 N`; same | `I` | D08 reader |
| C303-033 | Jump | `zmail/comnds.lisp:1703` | navigation | Accept or derive a message number, validate it in the current sequence, then select it. | `M N`; same | `V` before selection | D08 reader |
| C303-034 | Break | `zmail/comnds.lisp:1710` | debugging | Enter the Lisp break/debug path in the ZMail process. | `S0`; same | Delegated debugger may nonlocally exit; mail mutations made before entry are untouched | [D12 emergency/debugger spec](emergency-break-and-degraded-interaction-paths-reimplementation-specification.md); ZMail only enters it |
| C303-035 | Map | `zmail/comnds.lisp:1733` | bulk dispatch | Resolve a filter/scope and a remembered, profile, or menu command; enumerate the stable result; invoke that command for each message in order. | `S M0 N`; `L` repeats, `M` profile, `R` menu | `P`; no implicit rollback of earlier messages; command-specific errors propagate to loop recovery | D08 reader |
| C303-036 | Delete All | `zmail/comnds.lisp:1748` | bulk message state | Confirm the selected population where required, then mark each member deleted in order. | `M`; same | `P`; earlier flags remain | D08 reader |
| C303-037 | Undelete All | `zmail/comnds.lisp:1771` | bulk message state | Clear the deleted flag on every member of the selected population, then recompute display state. | `M`; same | `P` | D08 reader |
| C303-038 | Type | `zmail/comnds.lisp:1780` | typeout | Parse and render the current message to the typeout stream. | `M`; same | Parse/output can be partial; message model is unchanged | D08 reader |
| C303-039 | Type All | `zmail/comnds.lisp:1787` | bulk typeout | Render selected messages in sequence order with command-owned separators/progress. | `M`; same | `P`; earlier typeout remains after parse/output failure | D08 reader |
| C303-040 | Find String | `zmail/comnds.lisp:1833` | search/navigation | Prompt or reuse the search string, scan later messages in the requested direction/count, then select the first match. | `M N`; same | `V` if no match; no message mutation | D08 reader |
| C303-041 | Delete and Save Msg | `zmail/comnds.lisp:1852` | kill ring/message state | Copy the current message to the ZWEI kill ring, mark it deleted, then perform post-delete selection. | `M`; same | `P`: kill-ring copy or deletion can remain if later movement fails | D08 reader; D05 owns kill-ring storage |
| C303-042 | Yank Msg | `zmail/comnds.lisp:1866` | message editing | Resolve a numbered or last-deleted source message, append its text to the current message, then mark display/state dirty. | `M N`; same | `V` before insertion; `P` after interval insertion | D08 reader; D05 owns interval insertion primitives |
| C303-043 | Occur | `zmail/comnds.lisp:1889` | search/typeout | Prompt for a string, scan the selected messages, then emit matching lines as sensitive typeout entries. | `M`; same | `P` only in output; messages unchanged | D08 reader and input |
| C303-044 | Keywords All | `zmail/comnds.lisp:1960` | bulk classification | Choose keyword additions, then apply them to the selected population in order. | `M`; same | `P U`; completed messages remain changed | D08 reader |
| C303-045 | Unkeywords All | `zmail/comnds.lisp:1965` | bulk classification | Choose keyword removals, then apply them to the selected population in order. | `M`; same | `P U` | D08 reader |
| C303-046 | Move All to File | `zmail/comnds.lisp:2014` | bulk filing | Resolve one destination, then add the entire selected population to it and refresh current-message state. | `M`; `R` destination menu | `P X`; completed additions remain | D08 reader and storage |
| C303-047 | Sort | `zmail/comnds.lisp:2061` | sequence order | Resolve key/direction from remembered state, buffer default, or right menu; reject no-op key; save rearrangement undo; reorder the sequence. | `S`; `L` remembered, `M` buffer/default direction, `R` chooser | `V` before undo/save; `U` after reorder | D08 reader |
| C303-048 | Forward All | `zmail/comnds.lisp:2201` | composition | Collect the selected messages, create a forward draft containing them, then enter the integrated composer. | `M`; same | `P X`; draft construction can precede later template/editor/submission failure | D08 draft |
| C303-049 | Reply All | `zmail/comnds.lisp:2239` | composition | Derive recipients across the selected population, construct one reply draft, then enter composition. | `M`; same | `P X`; a created draft remains recoverable after later failure | D08 draft |
| C303-050 | Concatenate All | `zmail/comnds.lisp:2268` | bulk message mutation | Append every later selected message to the first in order, then mark all appended source messages deleted. | `M`; same | `P`; strict source order is not atomic | D08 reader |
| C303-051 | Concatenate | `zmail/comnds.lisp:2287` | message mutation | Choose a target message, append the current message to it, then delete the current source as specified by the source helper. | `M`; same | `V` before target; `P` after append | D08 reader |
| C303-052 | Undigestify Message | `zmail/comnds.lisp:2342` | digest | Optionally clip the original digest, parse and insert child messages one by one, then delete the original only after the child loop completes. | `M`; same | `P`; clipped original and a prefix of children may remain on failure | [D08 digest contract](zmail-and-mail-composition-reimplementation-specification.md#digests-duplicate-detection-reformatting-and-rules) |
| C303-053 | Select References | `zmail/comnds.lisp:2516` | references | Traverse direct and indirect references from the current message, build a temporary sequence including it, then select that sequence. | `M`; same | `V` for unresolved graph before selection; temporary collection may exist after later failure | D08 reader |
| C303-054 | Select Conversation by References | `zmail/comnds.lisp:2525` | references | Traverse both referenced-by and references edges, materialize the conversation collection, then select it. | `M`; same | `P` during graph materialization; no message content rollback needed | D08 reader |
| C303-055 | Select Referenced Msg | `zmail/comnds.lisp:2532` | references/navigation | Resolve the referenced message in the configured universe, switch buffer if needed, then select it. | `M`; same | `V` if absent/unresolvable | D08 reader |
| C303-056 | Delete Referenced Msgs | `zmail/comnds.lisp:2536` | references/bulk mutation | Compute the transitive referenced set including current, then mark each member deleted. | `M`; same | `P` | D08 reader |
| C303-057 | Delete Conversation by References | `zmail/comnds.lisp:2544` | references/bulk mutation | Compute the bidirectional conversation including current, then mark its members deleted. | `M`; same | `P` | D08 reader |
| C303-058 | Append to Referenced Msg | `zmail/comnds.lisp:2552` | references/message mutation | Resolve the referenced target, append current-message content to it, then update affected message state. | `M`; same | `V` before target; `P` after append | D08 reader |
| C303-059 | Move in Place of Referenced Msg | `zmail/comnds.lisp:2560` | references/filing | Resolve a referenced target and its file position, mark that target deleted, then add the current message at that position and report the destination. | `M`; same | `P X`; target deletion precedes insertion and is retained if insertion fails | D08 reader and storage |
| C303-060 | Other Commands | `zmail/comnds.lisp:2623` | dispatch | Resolve the last, middle-default, or right-menu auxiliary command, remember it, then invoke it with current numeric state. | `S0 N`; `L` repeat, `M` profile, `R` menu | `V` before invocation; callee owns later effects | D08 input |
| C303-061 | View File | `zmail/comnds.lisp:2636` | file display | Prompt for a pathname, open it through the file subsystem, then display it in a read-only viewer/typeout path. | `S0`; same | `V X`; no ZMail message mutation | [D07 document/viewer contract](help-self-documentation-and-document-examiner-reimplementation-specification.md); ZMail owns pathname prompting |
| C303-062 | Replay Keyboard Macro | `zmail/comnds.lisp:2667` | input replay | Resolve the remembered or right-menu macro, then replay its input events through normal dispatch. | `S0`; `L` remembered, `R` menu | `V` before replay; `P` across replayed commands | D08 input and D05 editor input |
| C303-063 | Kill Ring Save Msg | `zmail/comnds.lisp:2686` | kill ring | Serialize/copy current-message text to the ZWEI kill ring without deleting the message. | `M`; same | `X` only to D05 kill-ring allocation; message unchanged | D05 editor family; ZMail owns message-to-interval selection |
| C303-064 | List Buffers | `zmail/comnds.lisp:2692` | typeout/collections | Enumerate ZMail buffers, print status rows as sensitive items, then allow a listed-buffer action. | `S0`; pointer/typeout | Output can be partial; selected action owns mutation | D08 reader and input |
| C303-065 | Enable Background Process When Deexposed | `zmail/comnds.lisp:2732` | background option | Interpret `N` as the explicit boolean where supplied, set the deexposed-run option, then update documentation/state. | `S0 N`; same | `I`; option changes before any later worker wakeup failure | D08 background |
| C303-066 | Delete Duplicate Msgs | `zmail/comnds.lisp:2742` | duplicate detection | Build duplicate groups under source equality, preserve the chosen representative, then mark other members deleted in traversal order. | `M`; same | `P` | D08 digest/duplicate contract |
| C303-067 | Set Expiration Date | `zmail/comnds.lisp:2769` | message metadata | Prompt for a date, then replace/delete the expiration property and refresh the message. | `M`; same | `V` before accepted date; header update is not a cross-command transaction | D08 reader; C303 has no G85 calendar-view closure |
| C303-068 | Whois | `zmail/comnds.lisp:2779` | directory lookup | Prompt for a user, delegate lookup, then render returned directory information. | `S0`; same | `V X`; network output can be partial; no mail mutation | [Network services](network-services-and-site-utilities.md); ZMail owns prompt and display |
| C303-069 | Select Arbitrary Format Mail File | `zmail/comnds.lisp:2788` | file loading | Prompt for pathname and explicit format, open and parse through that adapter, register a buffer, then select it. | `S0`; same | `P X`; stream/buffer/parser ordering follows C303 strict load behavior | D08 storage |
| C303-070 | View Original Header | `zmail/comnds.lisp:2809` | header display | Ensure the current message is parsed, then render its retained original header representation without replacing normalized headers. | `M`; same | Parse/output failure leaves message content unchanged apart from parse caches | D08 reader |
| C303-071 | Select | `zmail/filter.lisp:11` | collection selection | Resolve recent buffer, filtered subset, or right-menu source; create/load if requested; then select the resulting sequence. | `S0`; `L` recent, `M` filter subset, `R` menu | `P X`; created/loaded sequence can remain if selection later fails | D08 reader and storage |
| C303-072 | Survey | `zmail/filter.lisp:221` | filtered typeout | Resolve current/default or right-button filter, materialize its stable result, then emit summary rows. | `S M0`; `R` chooses filter | `V` before enumeration; output may be partial | D08 reader |
| C303-073 | Goto | `zmail/filter.lisp:278` | filtered navigation | Resolve remembered filter, recent-message menu, or explicit filter; search from current position; then select a match. | `M`; `L` remembered, `M` recent, `R` filter | `V` if no match | D08 reader |
| C303-074 | Mail | `zmail/mail.lisp:16` | composition | Resolve normal mail, profile middle action, or right menu; instantiate the selected template and enter the integrated composer. | `S0`; `L` mail, `M` profile, `R` menu | `P X`; a created draft may remain after editor/submission failure | D08 draft |
| C303-075 | Forward | `zmail/mail.lisp:39` | composition | Construct a forward draft from current message, then enter composition. | `M`; same | `P X` | D08 draft |
| C303-076 | Bug | `zmail/mail.lisp:42` | composition | Select the bug-report template, gather its target/context, create a draft, then enter composition. | `S0`; same | `P X`; external bug destination is a submission adapter | D08 draft |
| C303-077 | Continue | `zmail/mail.lisp:248` | draft lifecycle | Resolve last, last-unsent, or menu-selected draft/file/message; restore it into the reply editor; then enter composition. | `S0`; `L` last, `M` unsent, `R` chooser | `V` before restore; `P X` after draft state is reopened | D08 draft |
| C303-078 | Reply | `zmail/mail.lisp:565` | composition | Resolve recipient/window/yank policy from numeric and button state, derive reply headers, construct the draft, then enter the chosen layout. | `M N`; `L/M` profile modes, `R` chooser | `P X`; header/draft construction is not rolled back automatically | D08 draft |
| C303-079 | Redistribute Msg | `zmail/mail.lisp:927` | composition | Build a redistribution draft containing the current message and enter composition. | `M`; same | `P X` | D08 draft |
| C303-080 | Redistribute All | `zmail/mail.lisp:933` | composition | Build a redistribution draft from the selected population in order and enter composition. | `M`; same | `P X` across message collection | D08 draft |
| C303-081 | Get New Mail | `zmail/mfiles.lisp:840` | inbox ingestion | Choose default or right-specified inbox, establish loading state, read/parse/append messages, perform C303 post-save source deletion, then select according to policy. | `S0`; `K/L` default, `R` alternate retained source | `P X`; C303 may rename before read and can clear pending work despite post-save delete failure | [D08 inbox contract](zmail-and-mail-composition-reimplementation-specification.md#get-new-mail-and-inboxes) |
| C303-082 | Gmsgs | `zmail/mfiles.lisp:920` | system-message ingestion | Run host `GMSGS` for the primary buffer's configured host, pass its result into new-mail ingestion, mark typeout complete, then redisplay text. | `M`; same | `X P`; host network error beeps/reports inside `GMSGS`; any ingestion already performed remains | D08 inbox; [network transports](network-transports-and-protocol-architecture.md) owns host protocol |
| C303-083 | Hardcopy Msg | `zmail/mfiles.lisp:1551` | print adapter | Select current-message printable content/options, then submit it to the hardcopy subsystem. | `M`; same | `V X`; ZMail does not roll back a submitted print request | [D35 hardcopy dossier](hardcopy-press-printing-and-plot-output.md); ZMail owns message selection |
| C303-084 | Hardcopy All | `zmail/mfiles.lisp:1557` | print adapter | Enumerate the current buffer in order, form hardcopy content/options, then submit it. | `M`; same | `P X`; rendering/submission can be partial | D35 hardcopy dossier; ZMail owns population selection |
| C303-085 | Profile | `zmail/profil.lisp:118` | profile task | Synchronize profile state, expose the profile frame, run its button/editor loop, then reread/apply changes on exit as selected. | `S0`; task-local buttons | `P X`; inserted/saved/compiled profile actions remain; editor abort is scoped as D08 specifies | D08 input and D08 storage; D05 owns inherited editing |
| C303-086 | Configure | `zmail/window.lisp:205` | view configuration | Choose Both directly or a right-menu layout, install its pane configuration, then redisplay. | `S0`; `L` Both, `R` menu | `I`; layout state remains if redraw fails | D08 reader and input |

## Genera 8.5: all 152 completion candidates

This denominator is the clean selected source closure, not merely a grep count. It
includes the 147 ordinary ZMail macro forms, the three separately loaded ECO forms,
the package-qualified KBIN reparse form, and the printer command adopted into ZMail.
The source's internal `Save` and `Expunge` synonym functions copy existing command
names and therefore do not add completion candidates.

| ID | Completion name | Source owner | Family | Ordered observable effect | Applicability | Failure / partial-effect boundary | Normative owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G85-001 | Set Expiration Date | `zmail/calendar.lisp.~1522~:59` | calendar metadata | Prompt for expiration; after acceptance replace or delete the header with an undo record; redisplay the message. | `M`; same | `V U`; no header change on prompt abort | D08 calendar |
| G85-002 | Set Start Date | `zmail/calendar.lisp.~1522~:68` | calendar metadata | Prompt for date and optional time; after acceptance replace or delete the start-date header with an undo record; redisplay. | `M`; same | `V U` | D08 calendar |
| G85-003 | Compose Reminder | `zmail/calendar.lisp.~1522~:86` | calendar composition | Select keyboard, once-only, periodic, or chooser template from button state; expand its reminder prompts; create and enter the draft. | `M0`; `K` keyboard template, `L` once-only, `M` periodic, `R/other` chooser | `V` before template acceptance; `P X` once draft/template mutation begins | D08 calendar and draft |
| G85-004 | Survey Reminders | `zmail/calendar.lisp.~1522~:112` | calendar report | Prompt for a day; compute holidays and messages satisfying all present reminder constraints; output the ordered survey. | `M`; same | `V`; parse/output may be partial, messages unchanged | D08 calendar |
| G85-005 | Kill Sequence | `zmail/collections.lisp.~1552~:154` | sequence lifecycle | Accept a sequence; if current, choose replacement; enforce file-buffer save/confirmation policy; detach and kill it. | `S M0 N D`; same | `P X`; a save or registry detach is not rolled back | D08 reader/storage |
| G85-006 | Kill Current Sequence | `zmail/collections.lisp.~1552~:172` | sequence lifecycle | Apply current-sequence kill policy, choose replacement where needed, then kill current. | `S M0 N`; same | `P X` | D08 reader/storage |
| G85-007 | Delete | `zmail/collections.lisp.~1552~:553` | message state | Resolve numbered message or button delete mode; mark deleted; then move, remain, or remove as selected. | `M N`; `K/L` default, `M` profile, `R` menu | `P`; deletion can precede failing movement | D08 reader |
| G85-008 | Delete And Up | `zmail/collections.lisp.~1552~:575` | message state | Mark current deleted, then move to previous undeleted. | `M`; same | `P` | D08 reader |
| G85-009 | Remove | `zmail/collections.lisp.~1552~:580` | collection state | Require a temporary collection, remove current member, then repair selection/state. | `M`; same | `V` before removal for disk buffer; `P` after | D08 reader |
| G85-010 | Undelete | `zmail/collections.lisp.~1552~:630` | message state | With `N`, resolve and require a deleted message; otherwise scan backward; clear deleted and select. | `M N`; same | `V` before flag clear | D08 reader |
| G85-011 | Next | `zmail/collections.lisp.~1552~:1032` | navigation | Resolve next policy from button/profile, search, then select. | `M N`; `K/L` next undeleted, `M/R` chooser policy | `V` if no target | D08 reader |
| G85-012 | Down To Next | `zmail/collections.lisp.~1552~:1044` | navigation | Move forward under the direct next policy, then select. | `M N`; same | `V` at boundary | D08 reader |
| G85-013 | Previous | `zmail/collections.lisp.~1552~:1056` | navigation | Resolve previous policy from button/profile, search backward, then select. | `M N`; `K/L` previous undeleted, `M/R` chooser policy | `V` if no target | D08 reader |
| G85-014 | Up To Previous | `zmail/collections.lisp.~1552~:1069` | navigation | Move backward under direct previous policy, then select. | `M N`; same | `V` at boundary | D08 reader |
| G85-015 | Next Unseen | `zmail/collections.lisp.~1552~:1073` | navigation | Search forward for unseen, then select it. | `M N`; same | `V` if none | D08 reader |
| G85-016 | Previous Unseen | `zmail/collections.lisp.~1552~:1078` | navigation | Search backward for unseen, then select it. | `M N`; same | `V` if none | D08 reader |
| G85-017 | Set Pop Mark | `zmail/collections.lisp.~1552~:1367` | point stack | Interpret universal-argument state as push, pop-and-move, or pop-and-discard; update point stack and selection. | `M N`; same | `V` on empty; pop can precede selection failure | D08 reader |
| G85-018 | Move To Previous Point | `zmail/collections.lisp.~1552~:1426` | point stack | Rotate default two, all for one, or signed requested stack span; select new point. | `M N`; same | `V` for invalid stack; rotation precedes selection | D08 reader |
| G85-019 | Move To Default Previous Point | `zmail/collections.lisp.~1552~:1435` | point stack | Optionally replace remembered rotation with `N`; rotate by it; select. | `M N`; same | `P`: remembered default can survive later failure | D08 reader |
| G85-020 | Mouse Point Pdl | `zmail/collections.lisp.~1552~:1466` | typeout navigation | Render point stack as sensitive rows in summary/message typeout, then service the chosen point. | `M`; pointer/typeout | Output may be partial; `V` before selection | D08 reader/input |
| G85-021 | Reverse Sequence | `zmail/collections.lisp.~1552~:1549` | sequence order | Save rearrangement undo, reverse the sequence, then redisplay. | `S`; same | `U`; no automatic rollback | D08 reader |
| G85-022 | Sort | `zmail/collections.lisp.~1552~:1600` | sequence order | Resolve key/direction, reject no-op default, remember right-menu choice, save undo, then reorder. | `S`; `L` remembered, `M` sequence default/opposite, `R` chooser | `V` before undo; `U` after | D08 reader |
| G85-023 | Move | `zmail/collections.lisp.~1552~:1884` | filing | Resolve file/sequence/remembered/filter/menu destination, add current message, update remembered target and state. | `M N`; `K/L/M/R` distinct chooser paths | `P X` | D08 reader/storage |
| G85-024 | Move All To File | `zmail/collections.lisp.~1552~:1927` | bulk filing | Resolve common or per-message filtered destinations; enumerate sequence; add each message; report per-destination counts. | `M N`; `K/L/M/R` distinct chooser paths | `P X`; completed additions and default target remain | D08 reader/storage |
| G85-025 | Rename Sequence | `zmail/collections.lisp.~1552~:2291` | collection state | Prompt for a valid unique name, update sequence registry/name, then labels. | `S M0`; same | `V` before rename; `I` after | D08 reader |
| G85-026 | List Sequences | `zmail/collections.lisp.~1552~:2359` | typeout/collections | Enumerate sequences and status as sensitive presentations; dispatch any selected operation. | `S0`; presentation/typeout | Output may be partial; selected operation owns effects | D08 reader/input |
| G85-027 | Hardcopy Message | `zmail/collections.lisp.~1552~:2577` | print adapter | Select current message and print options, render printable content, submit to hardcopy. | `M`; same | `V X`; submitted work is not rolled back | D35 hardcopy dossier; ZMail owns message adapter |
| G85-028 | Hardcopy All | `zmail/collections.lisp.~1552~:2597` | print adapter | Enumerate selected messages, render with options, submit. | `M`; same | `P X` | D35 hardcopy dossier; ZMail owns population adapter |
| G85-029 | Self Document | `zmail/commands.lisp.~1600~:275` | help | Resolve one event against effective ZMail table and show line help. | `S0`; same | `V`; read-only | D07 Help; ZMail supplies table |
| G85-030 | Apropos | `zmail/commands.lisp.~1600~:281` | help | Prompt substring, scan named-command registry, output matching command help. | `S0`; same | `V`; read-only | D07 Help; ZMail supplies registry |
| G85-031 | Help | `zmail/commands.lisp.~1600~:293` | help | Accept key, menu item, or star; star sorts and lists completion registry; otherwise describe or report undefined. | `S0`; same | `V`; read-only | D07 Help and D08 input |
| G85-032 | Describe Command | `zmail/commands.lisp.~1600~:366` | help | Complete a ZMail command name, run its documentation updater, then show full documentation. | `S0`; same | `V`; read-only | D07 Help; ZMail owns dynamic updater invocation |
| G85-033 | Extended Command | `zmail/commands.lisp.~1600~:393` | dispatch | Complete from named registry, bind current command, invoke with existing numeric state. | `S0 N`; same | `V` before call; callee owns effects | D08 input |
| G85-034 | Set Key | `zmail/commands.lisp.~1600~:410` | key-table mutation | Complete a command, bind the ZMail table as installation target, accept a key; without `N` descend a prefix and ask for a leaf, with `N` replace the prefix cell itself; install mapping. | `M0 N`; same | `V` before final key; table mutation is immediate and not undoable by ZMail | D08 input; D05 owns generic installation primitive |
| G85-035 | Large Argument | `zmail/commands.lisp.~1600~:422` | argument | Replace numeric value with signed `37777777`, mark it infinite/large, return to dispatch. | `S0 N`; same | `I`; argument state only | D08 input |
| G85-036 | Repeat Last Mini Buffer Command | `zmail/commands.lisp.~1600~:450` | minibuffer replay | Select the most recent recorded minibuffer command, apply admitted repeat/count semantics, then reexecute it. | `S0 N`; same | `V` if history empty; replayed command owns partial effects | D08 input and D05 minibuffer |
| G85-037 | Repeat Last Matching Mini Buffer Command | `zmail/commands.lisp.~1600~:459` | minibuffer replay | Prompt substring, find the latest matching recorded minibuffer command, then reexecute with numeric state. | `S0 N`; same | `V` if canceled/no match; callee owns effects | D08 input and D05 minibuffer |
| G85-038 | Edit Current Message | `zmail/commands.lisp.~1600~:528` | integrated editing | Materialize current message in edit node, switch table/layout, then enter editor. | `M`; same | `V` before switch; later edit effects follow D08/D05 | D08 draft and D05 editor |
| G85-039 | Set Message Default Character Style | `zmail/commands.lisp.~1600~:720` | message style | Prompt/accept a character style, save appropriate state, install it as message default, update mappings/display. | `M`; same | `V` before mutation; `U/P` after style installation | D08 reader; [D03 Dynamic Windows](genera/dynamic-windows-reimplementation-specification.md) owns style representation |
| G85-040 | Explain Bad Header | `zmail/commands.lisp.~1600~:752` | diagnostics | Ensure parse state, obtain retained header error information, then explain it in typeout. | `M`; same | Parsing/output may fail; message content unchanged | D08 reader |
| G85-041 | Show Received Path | `zmail/commands.lisp.~1600~:770` | header report | Parse Received fields, derive hop order, then render the path. | `M`; same | Parse/output partial only | D08 reader |
| G85-042 | Keywords | `zmail/commands.lisp.~1600~:854` | classification | Resolve remembered/filter/menu add-remove sets, save undo, update keywords and summary. | `M`; `L` repeat, `M` derive, `R` choose | `V U` | D08 reader |
| G85-043 | Refresh | `zmail/commands.lisp.~1600~:1035` | display | Invalidate all reader display state and redisplay. | `S0`; same | `I` | D08 reader |
| G85-044 | Scroll Message Next Screen | `zmail/commands.lisp.~1600~:1045` | display navigation | Scroll message forward by numeric/default amount and redisplay. | `S0 N`; same | `I` | D08 reader |
| G85-045 | Scroll Message Previous Screen | `zmail/commands.lisp.~1600~:1053` | display navigation | Scroll message backward by numeric/default amount and redisplay. | `S0 N`; same | `I` | D08 reader |
| G85-046 | Recenter Message Or Summary Window | `zmail/commands.lisp.~1600~:1061` | display navigation | Choose active message/summary pane, recenter using numeric/default line, redisplay. | `S0 N`; same | `I` | D08 reader |
| G85-047 | Start Of Message | `zmail/commands.lisp.~1600~:1082` | display navigation | Move message viewport to beginning and redisplay. | `S0`; same | `I` | D08 reader |
| G85-048 | End Of Message | `zmail/commands.lisp.~1600~:1087` | display navigation | Move message viewport to end and redisplay. | `S0`; same | `I` | D08 reader |
| G85-049 | Scroll Summary Window | `zmail/commands.lisp.~1600~:1126` | display navigation | Scroll summary forward by numeric/default amount. | `S M0 N`; same | `I` | D08 reader |
| G85-050 | Scroll Summary Window Backward | `zmail/commands.lisp.~1600~:1138` | display navigation | Scroll summary backward by numeric/default amount. | `S M0 N`; same | `I` | D08 reader |
| G85-051 | Start Of Summary Window | `zmail/commands.lisp.~1600~:1147` | display navigation | Move summary viewport to beginning. | `S M0`; same | `I` | D08 reader |
| G85-052 | End Of Summary Window | `zmail/commands.lisp.~1600~:1152` | display navigation | Move summary viewport to end. | `S M0`; same | `I` | D08 reader |
| G85-053 | Jump | `zmail/commands.lisp.~1600~:1202` | navigation | Resolve message number from numeric/input, validate, then select. | `M N`; same | `V` | D08 reader |
| G85-054 | Break | `zmail/commands.lisp.~1600~:1209` | debugging | Enter the debugger/break path in the ZMail process. | `S0`; same | Nonlocal debugger exit; prior mail effects untouched | D12 emergency/debugger spec; ZMail only enters it |
| G85-055 | Map Over | `zmail/commands.lisp.~1600~:1241` | bulk dispatch | Resolve stable population and permitted map command, confirm danger, then invoke it per message in order. | `S M0 N D`; `K/L/M/R` select scope/command through D08 tree | `P`; no implicit rollback | D08 reader/input |
| G85-056 | Delete All | `zmail/commands.lisp.~1600~:1279` | bulk message state | Confirm where required, mark each selected member deleted in order. | `M`; same | `P` | D08 reader |
| G85-057 | Undelete All | `zmail/commands.lisp.~1600~:1306` | bulk message state | Clear deleted on selected members in order, then refresh state. | `M`; same | `P` | D08 reader |
| G85-058 | Type | `zmail/commands.lisp.~1600~:1317` | typeout | Parse and render current message. | `M`; same | Partial output; content unchanged | D08 reader |
| G85-059 | Type All | `zmail/commands.lisp.~1600~:1324` | bulk typeout | Render selected messages in order. | `M`; same | `P` in output only | D08 reader |
| G85-060 | Find String | `zmail/commands.lisp.~1600~:1438` | search/navigation | Prompt/reuse string, scan subsequent messages with numeric direction/count, select first match. | `M N`; same | `V` if no match | D08 reader |
| G85-061 | Delete And Save Message | `zmail/commands.lisp.~1600~:1473` | kill ring/message | Copy current message to kill ring, mark deleted, then perform post-delete selection. | `M`; same | `P` | D08 reader; D05 owns kill ring |
| G85-062 | Yank Message | `zmail/commands.lisp.~1600~:1484` | message editing | Resolve numbered or saved source; append its text to current message; update dirty/display state. | `M N`; same | `V` before insert; `P` after | D08 reader; D05 owns interval operations |
| G85-063 | Occur | `zmail/commands.lisp.~1600~:1516` | search/typeout | Prompt string, scan population, output matching lines as sensitive items. | `M`; same | Partial output; messages unchanged | D08 reader/input |
| G85-064 | Keywords All | `zmail/commands.lisp.~1600~:1646` | bulk classification | Choose additions, apply to selected messages in order. | `M`; same | `P U` | D08 reader |
| G85-065 | Unkeywords All | `zmail/commands.lisp.~1600~:1673` | bulk classification | Choose removals, apply in order. | `M`; same | `P U` | D08 reader |
| G85-066 | Reply All | `zmail/commands.lisp.~1600~:1744` | composition | Derive recipients across selected population, construct one reply draft, enter composer. | `M`; same | `P X` | D08 draft |
| G85-067 | Concatenate All | `zmail/commands.lisp.~1600~:1756` | bulk message mutation | Append later selected messages to first in order, then mark appended sources deleted. | `M`; same | `P`; non-atomic | D08 reader |
| G85-068 | Concatenate | `zmail/commands.lisp.~1600~:1766` | message mutation | Choose target, append current into it, then apply source deletion/state update. | `M`; same | `V` before target; `P` after append | D08 reader |
| G85-069 | Other Commands | `zmail/commands.lisp.~1600~:1902` | dispatch | Resolve remembered/middle/right auxiliary command, remember it, then invoke with numeric state. | `S0 N`; `L` repeat, `M` profile, `R` menu | `V` before call; callee owns effects | D08 input |
| G85-070 | Hardcopy File | `zmail/commands.lisp.~1600~:1926` | print adapter | Prompt pathname, then submit file to background hardcopy operation. | `S0`; same | `V X`; submitted request persists | D35 hardcopy dossier; ZMail owns prompt |
| G85-071 | Compile File | `zmail/commands.lisp.~1600~:1933` | compiler adapter | Prompt input and, with `N`, output pathname; invoke compiler; report result. | `S0 N`; same | `V X`; compiler files/definitions are not rolled back by ZMail | [D22 system construction dossier](system-construction-patches-worlds-and-distribution.md); ZMail owns prompts |
| G85-072 | Load File | `zmail/commands.lisp.~1600~:1947` | loader adapter | Prompt pathname, invoke Lisp loader, report completion. | `S0`; same | `X P`; definitions loaded before an error remain | D22 system construction dossier; ZMail owns prompt |
| G85-073 | Show File | `zmail/commands.lisp.~1600~:1966` | file display | Prompt pathname, open and render it in the show-file path. | `S0`; same | `V X`; read-only to mail | D07 viewer contract; ZMail owns prompt |
| G85-074 | Show Mail | `zmail/commands.lisp.~1600~:1973` | inbox file display | Derive possible default mail-file pathnames, choose the first existing default inbox, and show it through the format's element type without merging it; otherwise report no new mail. | `S0`; same | `V X`; file display can be partial; ZMail sequence unchanged | D08 inbox/format adapter and D07 viewer contract |
| G85-075 | Edit File | `zmail/commands.lisp.~1600~:2030` | editor adapter | Prompt pathname, enter/select its Zmacs buffer, position according to supplied context. | `S0`; same | `V X`; editor buffer can persist | D05 editor family; ZMail owns prompt/context |
| G85-076 | Replay Keyboard Macro | `zmail/commands.lisp.~1600~:2071` | input replay | Resolve remembered/right-menu macro, replay through normal input dispatch. | `S0`; `L` remembered, `R` chooser | `V` before replay; `P` across commands | D08 input and D05 |
| G85-077 | Kill Ring Save Message | `zmail/commands.lisp.~1600~:2091` | kill ring | Without `N`, save the message interval as represented; with `N`, construct an interval containing message text with original headers; copy the chosen interval to the ZWEI kill ring. | `M N`; same | Temporary interval construction can fail before kill-ring mutation; message remains unchanged | D05 kill ring; ZMail owns message/header interval selection |
| G85-078 | Kill Ring Yank Message | `zmail/commands.lisp.~1600~:2103` | message creation | Obtain the top kill-ring interval, make a new message from it, add it to the local-mail buffer and also to the current temporary collection when applicable, update mappings/summary, then select it. | `S M0`; same | `V` if the kill ring cannot yield content; `P` after the first buffer insertion | D08 reader and D05 kill ring |
| G85-079 | Enable Background Process When Deexposed | `zmail/commands.lisp.~1600~:2117` | background option | Set the option allowing worker execution while frame is deexposed, then refresh documentation. | `S0`; same | `I`; later worker failure does not revert option | D08 background |
| G85-080 | Disable Background Process When Deexposed | `zmail/commands.lisp.~1600~:2124` | background option | Clear that option so deexposure pauses worker eligibility, then refresh documentation. | `S0`; same | `I`; an already completed worker slice remains | D08 background |
| G85-081 | Whois | `zmail/commands.lisp.~1600~:2131` | directory lookup | Prompt/accept user identity, query directory service, render result. | `S0`; same | `V X`; partial output, no mail mutation | Network services dossier; ZMail owns prompt/display |
| G85-082 | Add File References | `zmail/commands.lisp.~1600~:2171` | message metadata | Choose file references, encode the field value, add/replace the current message field, then redisplay. | `M`; same | `V` before accepted list; `U/P` for field update | D08 reader; D05 owns file chooser/editor surface |
| G85-083 | Add Message References | `zmail/commands.lisp.~1600~:2180` | references metadata | Resolve referenced messages, encode their identifiers, update current message References field, refresh reference state. | `M`; same | `V` before selection; `U/P` after field update | D08 reader |
| G85-084 | Show Mailing List | `zmail/commands.lisp.~1600~:2271` | address-service lookup | Accept addresses, defaulting from a suitable current To recipient; query one-level expansion without `N` or all levels with `N`; render it. | `S0 N`; same/presentation | `V X`; partial output; mail state unchanged | D08 draft address adapter; network services owns lookup |
| G85-085 | Show Expanded Mailing List | `zmail/commands.lisp.~1600~:2283` | address-service alias | Invoke Show Mailing List as a distinct completion synonym; expansion depth still depends on numeric-argument presence rather than the synonym's name. | `S0 N`; same/presentation | Same as G85-084; alias remains separately enumerable | D08 draft address adapter; network services owns lookup |
| G85-086 | Edit Keywords List | `zmail/commands.lisp.~1600~:2501` | global keyword configuration | Open keyword chooser over global list, apply accepted edits, then refresh keyword menus/state. | `S M0`; same | `V` on cancel; `I/P` after list mutation | D08 reader/input |
| G85-087 | Construct Digest | `zmail/digest.lisp.~1511~:84` | digest composition | Validate the sequence, build a digest template from its messages in order, create a draft, then enter composition. | `M`; same | `P X`; constructed draft survives later editor/submission failure | D08 digest and draft |
| G85-088 | Undigestify | `zmail/digest.lisp.~1511~:146` | digest split | Parse a complete child list, save undo, optionally create a collection, complete pending input, insert all children, then update mappings, headers, and references while retaining the original digest. | `M`; same | `V` before complete parse; `P U` after child insertion; unlike C303, do not clip/delete original | D08 digest contract |
| G85-089 | Undigestify All Messages | `zmail/digest.lisp.~1511~:152` | bulk digest split | Traverse current sequence, run the Genera split operation for each recognized digest, and update resulting collection/reference state. | `M`; same | `P U`; earlier split results remain | D08 digest contract |
| G85-090 | Make Encoded Eco File | `zmail/eco-commands.lisp.~5~:57` | ECO encode adapter | Prompt input and output pathnames, open both, encode input as the ASCII distribution representation, close streams. | `S0`; same | `V X`; output may exist partially after encoder/I/O failure | [D19 system/distribution dossier](system-construction-patches-worlds-and-distribution.md); ZMail owns prompts and stream handoff |
| G85-091 | Mail Eco | `zmail/eco-commands.lisp.~5~:73` | ECO composition | Prompt source; validate encoded preamble; if invalid, beep, prompt output, encode there; bind selected encoded file; expand ECO mail template into a draft. | `S0`; same | `P X`; generated encoded file remains if draft creation fails | D19 owns encoding; D08 draft owns composition adapter |
| G85-092 | Decode Eco | `zmail/eco-commands.lisp.~5~:136` | ECO decode/restore adapter | Locate a delimiter pair in current message, read encoded preamble/path, disclose destination, ask whether to restore, decode to that path, then if accepted invoke Restore Distribution and report subsequent patch-load step. | `M`; same | `V` before decode for missing/malformed envelope; `P X` after decoder creates output; distribution restore is non-atomic and not rolled back | D19 system/distribution dossier; ZMail owns envelope selection, prompts, and delegation |
| G85-093 | Select Sequence | `zmail/filter.lisp.~1549~:66` | collection selection | Accept a sequence using numeric/button defaults, then select it. | `S0 N`; button defaults per D08 | `V` before selection | D08 reader/input |
| G85-094 | Select Previous Sequence | `zmail/filter.lisp.~1549~:92` | collection history | Resolve requested/recent history element, rotate selection history as required, then select sequence. | `S0 N`; same | `V` for empty/invalid history | D08 reader |
| G85-095 | Select | `zmail/filter.lisp.~1549~:119` | collection selection | Resolve recent sequence, filtered collection, marked survey, file, or menu choice; materialize/load if needed; then select. | `S0 N`; `L/M/R` use companion tree | `P X`; created/loaded collection can remain | D08 reader/storage/input |
| G85-096 | Mark Survey | `zmail/filter.lisp.~1549~:295` | transient collection | Clear marks, expose summary, run marking task, then on End build a temporary collection; on abort restore prior layout without collection. | `M`; summary blips/End/Abort | `V` on abort; unwind clears marks; created collection can remain if final selection fails | D08 input/reader |
| G85-097 | Goto | `zmail/filter.lisp.~1549~:482` | filtered navigation | Resolve remembered/recent/explicit filter, search in selected direction, then select match. | `M`; `L` remembered, `M` recent, `R` chooser | `V` if no match | D08 reader |
| G85-098 | Reformat Headers | `zmail/headers.lisp.~1534~:1160` | header normalization | Save undo; without `N`, reformat current headers under the default template; with `N`, restore retained original headers; recenter at message start. | `M N`; same | `U/P`; missing retained original can fail after the undo entry is saved | D08 digest/header contract |
| G85-099 | Reformat All | `zmail/headers.lisp.~1534~:1177` | bulk header normalization | Traverse selected messages and reformat each under current policy. | `M`; same | `P U` | D08 digest/header contract |
| G85-100 | Unreformat All | `zmail/headers.lisp.~1534~:1192` | bulk header restoration | Traverse selected messages with retained original-header state and restore each eligible header representation. | `M`; same | `P U`; ineligible messages are not fabricated | D08 digest/header contract |
| G85-101 | Reparse All Loaded Messages | `zmail/kbin/buffer.lisp.~1511~:292` | format migration | Confirm scope; dynamically increment KBIN format version; upgrade loaded files and reparse every message; with `N`, include only KBIN, otherwise include other loaded formats too. | `M N`; same | `V` on declined query; `P X` per file/message, including modified KBIN buffers | D08 storage/format adapters |
| G85-102 | Change Mail File Options | `zmail/mail-files.lisp.~1566~:548` | buffer options | Resolve current or selected mail file from numeric/button state, edit its option set, validate, then install and refresh. | `S M0 N`; button chooser per D08 | `V` before install; `I/P` after options change | D08 storage/input |
| G85-103 | Edit Mail File | `zmail/mail-files.lisp.~1566~:689` | file/editor adapter | Prompt/accept pathname, load or create its mail buffer, enable ordinary save policy, then select/edit it. | `S0`; same/presentation | `P X`; loaded/created buffer may persist | D08 storage; D05 owns editor surface |
| G85-104 | Examine Mail File | `zmail/mail-files.lisp.~1566~:707` | file/view adapter | Prompt/accept existing pathname, load its mail buffer with saving disabled, then select it. | `S0`; same/presentation | `P X`; read buffer may persist after selection failure | D08 storage |
| G85-105 | Select Arbitrary Format Mail File | `zmail/mail-files.lisp.~1566~:789` | file loading | Prompt pathname and format, open/parse through selected adapter, register buffer, then select. | `S0`; same | `P X`; adapter load state can remain | D08 storage |
| G85-106 | Get New Mail From Inbox | `zmail/mail-files.lisp.~1566~:1586` | inbox ingestion | Establish user; choose target buffer/inboxes from button state; check status; select target; load/parse/insert inbox messages; save target; then delete source identities according to G85 rules. | `S0`; `K/L` defaults, `M` explicit inbox, `R` target menu | `P X`; on non-not-found delete failure pending identities remain; selection and inserted/saved mail remain | D08 inbox/storage |
| G85-107 | Gmsgs | `zmail/mail-files.lisp.~1566~:1597` | system-message ingestion | Establish user; require default buffer; check its state; select it; run GMSGS; if it yields an inbox pathname, ingest it, otherwise report none. | `M`; same | `V` before selection for no default; `P X` after selection; caught file/network errors become ZMail command errors without rollback | D08 inbox; network transports owns GMSGS protocol |
| G85-108 | Quit | `zmail/mail-files.lisp.~1566~:2157` | lifecycle/storage | Apply dangerous confirmation and save/expunge choices; complete selected file operations; deselect/bury reusable frame while worker persists. | `S0 D`; button options per D08 | `P X`; ordinary Quit is not Kill; completed writes remain | D08 storage and reader quit |
| G85-109 | Not Modified | `zmail/mail-files.lisp.~1566~:2181` | storage state | Clear current mail file's need-save indication without writing. | `S M0`; same | Immediate state change; no rollback | D08 storage |
| G85-110 | Enable Saves For Buffer | `zmail/mail-files.lisp.~1566~:2187` | storage policy | Enable save permission on current buffer, update state/documentation. | `S M0`; same | `I` | D08 storage |
| G85-111 | Disable Saves For Buffer | `zmail/mail-files.lisp.~1566~:2200` | storage policy | Disable subsequent saves on current buffer, update state/documentation. | `S M0`; same | `I`; does not undo prior writes | D08 storage |
| G85-112 | Save All Mail Files | `zmail/mail-files.lisp.~1566~:2216` | storage | Keyboard/left expunges all sequences, saves nondefault file buffers, then saves the default buffer last; middle expunges current; right runs the per-file expunge/save/kill menu. | `S0 D`; `K/L` all, `M` current expunge, `R` menu | `P X`; completed expunges and buffer commits remain | D08 storage |
| G85-113 | Expunge Sequence | `zmail/mail-files.lisp.~1566~:2234` | storage | Confirm danger; remove deleted messages from current sequence; commit through its format adapter; refresh selection/status. | `S M0 D`; same | `P X`; Genera adapter-specific commit, not universal temp/rename | D08 storage |
| G85-114 | Save Mail File | `zmail/mail-files.lisp.~1566~:2247` | storage | Without `N`, expunge deleted messages and synchronously save current mail file; with `N`, start a background save without expunging. | `S M0 N D`; same | `P X`; synchronous and background adapter commits are profile-specific | D08 storage/background |
| G85-115 | Save Current Buffer | `zmail/mail-files.lisp.~1566~:2263` | storage | Save only current buffer without expunging, then update status. | `S M0`; same | `X`; commit may already have occurred on later status error | D08 storage |
| G85-116 | Start Background Save | `zmail/mail-files.lisp.~1566~:2268` | background storage | Validate current buffer, enqueue/start its background save, return while worker performs slices. | `S M0`; same | `V` before enqueue; later `P X` belongs to worker and is not synchronously rolled back | D08 background/storage |
| G85-117 | Abort Background Save | `zmail/mail-files.lisp.~1566~:2273` | background control | Require a file buffer in saving state, invoke mail-I/O completion with abort-saves enabled, then report the save aborted. | `S M0`; same | `V` before abort request if not saving; already completed output remains and abort is not rollback | D08 background/storage |
| G85-118 | Check For New Mail | `zmail/mail-files.lisp.~1566~:3967` | inbox status | Query the file computer's new-mail indication and report/update the non-ingesting status display. | `S0`; same | `X`; no messages inserted | D08 inbox; network/file service owns query |
| G85-119 | Mail | `zmail/mail.lisp.~1571~:75` | composition | Establish user; resolve template: `N=1` redistribute, `N=3/4` bug, otherwise left mail, middle profile action, right menu; expand template with current message if any; create and continue draft. | `S0 N`; `L/M/R` distinct | `V` for unsupported numeric/template abort; `P X` after draft creation | D08 draft |
| G85-120 | Forward | `zmail/mail.lisp.~1571~:179` | composition | Choose forward template, expand with current message, create and continue draft. | `M`; same | `P X` | D08 draft |
| G85-121 | Forward All | `zmail/mail.lisp.~1571~:182` | composition | Check population size, snapshot sequence order, expand forward template, create and continue draft. | `M`; same | `V` at size check; `P X` after draft construction | D08 draft |
| G85-122 | Report Bug | `zmail/mail.lisp.~1571~:198` | composition alias | Invoke Bug as a distinct completion alias; Bug performs template choice and draft creation. | `S0`; same | Same as Bug; alias remains separately enumerable | D08 draft |
| G85-123 | Bug | `zmail/mail.lisp.~1571~:203` | composition | Choose bug-report template/subject, expand it, create and continue draft. | `S0`; same | `V` before expansion; `P X` after draft creation | D08 draft |
| G85-124 | Reply | `zmail/mail.lisp.~1571~:242` | composition | Try draft-reply, failed-mail reply, then normal reply handlers in order; normal reply resolves numeric/button template; construct and continue draft; error if no handler accepts. | `M N`; `L` normal, `M` middle, `R` chooser, `N=1` 1R, `N=3/4` yank template | `V` for unsupported numeric/no handler; `P X` after draft mutation | D08 draft |
| G85-125 | Continue | `zmail/mail.lisp.~1571~:883` | draft lifecycle | Resolve recent/unsent/menu or presentation-selected draft; save/setup its window points; install draft/layout; enter editor. | `S0`; `L/M/R` distinct | `V` before draft; `P` after draft becomes active | D08 draft |
| G85-126 | Revoke Message | `zmail/mail.lisp.~1571~:1016` | revocation composition | Resolve sent draft or message; confirm each target; optionally find and delete filed copies by references; then compose a revocation draft. | `S0`; `L` latest, `M` first sent, `R` chooser/current-summary | `V` during confirmation; `P X`: filed-copy deletion precedes and survives failed draft/submission | D08 draft/references/storage |
| G85-127 | Show Draft Dispositions | `zmail/mail.lisp.~1571~:1107` | draft report | Enumerate live and dummy drafts; present each summary and disposition records; finish typeout. | `S0`; presentation/typeout | Output can be partial; drafts unchanged | D08 draft/input |
| G85-128 | Redistribute Message | `zmail/mail.lisp.~1571~:2131` | composition | Choose redistribution template, expand with current message, create/transmit draft as template dictates, then recompute message state. | `M`; same | `P X`; submitted draft and REDISTRIBUTED flag stages are not globally atomic | D08 draft/submission |
| G85-129 | Redistribute All | `zmail/mail.lisp.~1571~:2135` | bulk composition | Check size, snapshot sequence, create/transmit redistribution draft per message in order, then recompute state. | `M`; same | `P X` across messages | D08 draft/submission |
| G85-130 | Redirect Message | `zmail/mail.lisp.~1571~:2231` | redirect workflow | Parse recipients; prompt removals/additions/comment; validate anomalies; send reference notice, redistribute amended message, alter local copy, then optionally enter reply. | `M`; same | `V` through address confirmations; `P X` after first transmission—network sends and local header changes are not atomic | D08 draft/submission |
| G85-131 | Encrypt Message | `zmail/message-encryption.lisp.~1510~:142` | message encryption | Parse message; reject already encrypted; choose method; save undo; compute encrypted body; delete clear body; append envelope/ciphertext; add encryption header; update character mappings. | `M`; same | Provider failure before encrypted interval leaves body; `U/P` after old-body deletion; no security-strength claim | D08 encryption feature closure |
| G85-132 | Decrypt Message | `zmail/message-encryption.lisp.~1510~:163` | message decryption | Require encryption header and compute decrypted interval; without `N`, output headers plus plaintext copy and discard temporary; with `N`, save undo, replace body, remove encryption header, update mappings. | `M N`; same | Provider failure precedes mutation; no-`N` can partially expose output; with `N`, `U/P` after body deletion | D08 encryption feature closure |
| G85-133 | Profile | `zmail/profile.lisp.~1517~:58` | profile task | Synchronize values; expose/run profile task; execute chosen edit/association/save/compile/reset actions; reread/apply on exit. | `S0`; task-local buttons | `P X`; saved/compiled/inserted changes remain; editor abort scope is explicit in D08 | D08 input/storage; D05 owns editing |
| G85-134 | Select References | `zmail/references.lisp.~1515~:222` | references | Resolve numeric/current starting message, traverse outgoing references, materialize collection including start, select it. | `M N`; same | `V` for no resolvable graph; collection may remain after selection failure | D08 reader |
| G85-135 | Select Conversation By References | `zmail/references.lisp.~1515~:235` | references | Traverse incoming and outgoing edges from selected/numeric message, build conversation, select it. | `M N`; same | `P` during collection build | D08 reader |
| G85-136 | Select All Conversations By References | `zmail/references.lisp.~1515~:259` | bulk references | For every current-sequence message, compute conversation closure, union without duplicates, materialize and select collection. | `M N`; same | `P`; partial derived collection can exist | D08 reader |
| G85-137 | Append Conversation By References | `zmail/references.lisp.~1515~:293` | references/message mutation | Compute current conversation, append its messages into current according to graph order, update state. | `M N`; same | `P U`; interval mutations are non-atomic | D08 reader |
| G85-138 | Delete Conversation By References | `zmail/references.lisp.~1515~:315` | references/bulk mutation | Compute bidirectional conversation including current/numeric target, mark members deleted in order. | `M N`; same | `P` | D08 reader |
| G85-139 | Select Referenced Message | `zmail/references.lisp.~1515~:332` | references/navigation | Resolve referenced target from current/numeric message and universe, switch sequence if needed, select target. | `M N`; same | `V` if absent | D08 reader |
| G85-140 | Delete Referenced Messages | `zmail/references.lisp.~1515~:345` | references/bulk mutation | Compute transitive outgoing set for current/numeric message, mark members deleted. | `M N`; same | `P` | D08 reader |
| G85-141 | Append To Referenced Message | `zmail/references.lisp.~1515~:385` | references/message mutation | Resolve referenced target, append current/numeric source to it, update affected state. | `M N`; same | `V` before target; `P U` after append | D08 reader |
| G85-142 | Move In Place Of Referenced Message | `zmail/references.lisp.~1515~:400` | references/filing | Resolve referenced target and its sequence index; mark target deleted; add current at that index; report destination. | `M`; same | `P X`; target deletion precedes and survives a failed insertion | D08 reader/storage |
| G85-143 | Source Compare Referenced Message | `zmail/references.lisp.~1515~:420` | comparison adapter | Resolve referenced target, materialize comparable intervals/files, invoke source comparison display. | `M N`; same | `V X`; temporary/editor comparison state may remain; messages unchanged | [D06 directory/difference spec](directory-difference-and-buffer-editors-reimplementation-specification.md); ZMail owns reference resolution |
| G85-144 | Delete Duplicate Messages | `zmail/references.lisp.~1515~:952` | duplicate detection | Build duplicate equivalence groups, preserve selected representative, mark remaining duplicates deleted. | `M`; same | `P` | D08 digest/duplicate contract |
| G85-145 | Merge Keywords In Conversation | `zmail/references.lisp.~1515~:1125` | references/classification | Compute current/numeric conversation, union its keywords, then apply merged set to members according to source policy. | `M N`; same | `P U` | D08 reader |
| G85-146 | Run Rules Message | `zmail/rule.lisp.~1504~:61` | rules | Traverse rules in alist order; for every matching filter, describe then execute each action/value pair in order; if none match, report that result. | `M`; same | `P`; completed actions remain and later rules stop on uncaught failure | D08 digest/rules contract |
| G85-147 | Run Rules All | `zmail/rule.lisp.~1504~:67` | bulk rules | Traverse sequence order; run the same ordered rule/action loop for each message without the per-message trace stream. | `M`; same | `P` across actions, rules, and messages | D08 digest/rules contract |
| G85-148 | Undo | `zmail/undo.lisp.~1508~:57` | command history | Pop entries until one no longer references killed messages; require one; ask confirmation; invoke its undo method; report; push it on redo history; recompute state. | `S M0`; same | Killed entries are pruned; cancel/failure after live pop loses that entry from undo history; inverse may be partial | D08 reader; history method contract in this page's high-risk notes |
| G85-149 | Redo | `zmail/undo.lisp.~1508~:76` | command history | Pop redo entries until live; require one; confirm; invoke redo; report; push onto undo history; recompute. | `S M0`; same | Cancel/failure after pop loses live redo entry; method partial effects remain | D08 reader |
| G85-150 | Survey | `zmail/universe.lisp.~1511~:1234` | filtered typeout | Resolve universe/filter scope, materialize stable ordered selection, render summary rows and sensitive operations. | `S M0`; button chooser per D08 | `V` before materialization; partial output only | D08 reader/input |
| G85-151 | Configure | `zmail/window.lisp.~1538~:242` | view configuration | Resolve named layout/button policy, compute panes/constraints, install configuration and selected calendar/date state where applicable, redisplay. | `S0`; `L/M/R` layout-specific | `I`; configuration state can precede failed redraw | D08 reader/calendar/input |
| G85-152 | Show Printer Status | `hardcopy/printer-queue-user.lisp.~1542~:1342`, adopted at `zmail/commands.lisp.~1600~:1924` | printer report adapter | Prompt for one or more printers, defaulting to configured text printer when present; invoke printer-status report. | `S0 M0 N` admitted but ignored; `K/L/M/R` same because the adopted DEFCom has no ZMail wrapper | `V X`; read-only to mail, output can be partial | D35 hardcopy dossier; ZMail's sole owned effect is registry adoption/dispatch |

## High-risk command contracts

These rules expand rows where a command name or manual gloss hides ordering that a
reimplementation can easily get wrong. They are normative for the stated source
profile.

### GMSGS is an ingestion adapter, not an alternate reader

`C303-082` calls the configured host's GMSGS operation for the primary buffer and
immediately hands the returned value to the ordinary new-mail helper. The provider
catches a network condition, beeps, reports it, and returns through that call; ZMail
does not synthesize an independent transactional queue. The command makes the
typeout window complete after the helper returns.

`G85-107` first establishes the ZMail user, rejects absence of a default buffer,
checks that buffer's I/O state, and selects it *before* running GMSGS. A pathname
result is passed to ordinary G85 new-mail ingestion; a null result only reports that
there are no new system messages. File and network conditions are translated to the
ZMail command-error path. Selection is therefore a possible visible prefix of a
failed GMSGS command.

The network or host method is owned by the
[network transport architecture](network-transports-and-protocol-architecture.md).
The ZMail compatibility surface is host selection, error translation, ingestion
handoff, output, and the partial-selection boundary above.

### Set Key mutates the effective ZMail table

`G85-034` is not a profile-file editor. It completes a command, dynamically makes
the top-level ZMail command table the generic installer's target, and reads a key.
If that key currently denotes a prefix, invocation without a numeric argument reads
another character and changes the selected child. Invocation with a numeric argument
changes the prefix cell itself. Cancellation before the final key leaves the table
unchanged; successful installation is immediate and has no ZMail undo record. A
conformance implementation MUST expose the mutation to subsequent dispatch and Help
enumeration in the same frame. Persistence beyond the live command-table object is
not established by this command and MUST NOT be invented.

### Undo and Redo prune and pop before confirmation

For `G85-148` and `G85-149`, the historical order is:

1. pop history entries until one does not reference a killed message;
2. fail if no live entry remains;
3. ask whether to undo or redo the live entry;
4. invoke its method and report success;
5. push that entry onto the opposite history;
6. recompute current-message state and redisplay.

Consequently, killed entries are permanently pruned. More surprisingly, the live
entry has already been removed when the confirmation is declined or its method
fails; the source contains no unwind that restores it. A strict source-profile
implementation MUST preserve that loss. A safer implementation MAY offer a separate
non-historical mode, but MUST NOT claim strict G85 compatibility for it. Undo-entry
methods can themselves perform multiple mutations, so command history is an inverse
protocol, not a transaction manager.

### Rules run every match and every action in stored order

`G85-146` and `G85-147` traverse the rule alist in order. A matching filter does not
short-circuit later rules. Each matching rule's property list is visited as
action/value pairs in order; when a trace stream is supplied, the description of an
action is emitted immediately before its action function runs. The single-message
command reports when nothing matched. The all-message command traverses sequence
order and omits that trace stream. Neither command saves one aggregate undo record or
rolls back earlier actions, rules, or messages after a later failure.

The selected source establishes delete and keyword rule actions plus extensibility
through action properties. A reimplementation MUST reject or surface an unknown
action rather than silently treating it as success.

### Encryption separates provider computation from body replacement

`G85-131` rejects an already encrypted message and chooses a registered encryption
method, saves an undo entry, and obtains the encrypted interval before deleting the
old body. It then deletes the body, optionally inserts a provider envelope, inserts
encrypted content, adds the encryption header, and updates character mappings.
Failure of the provider before interval production therefore leaves the message body
intact but can leave the newly saved undo entry; a failure after deletion can leave a
partial message.

`G85-132` requires an encryption header and likewise computes a decrypted interval
first. Without a numeric argument it writes the original headers and decrypted copy
to output, then destroys only the temporary interval. With a numeric argument it
saves undo, deletes and replaces the body, removes the encryption header, and updates
mappings. A test MUST use synthetic nonsecret material and a deterministic fake
provider; neither source inspection nor this specification claims that a historical
algorithm remains cryptographically suitable.

### Decode ECO crosses two irreversible boundaries

`G85-092` requires two delimiter occurrences and a valid encoded preamble. It learns
the destination pathname from that preamble and asks whether restoration should
follow *before* it performs the decode. The decoder owns creation and content of the
destination file. If restoration was accepted, ZMail next adapts that pathname to
the distribution subsystem and invokes Restore Distribution, then tells the user to
load patches. Decoder failure can leave filesystem output; restore failure can leave
both a decoded file and partial distribution state. ZMail provides no rollback for
either boundary. D19's
[system construction and distribution dossier](system-construction-patches-worlds-and-distribution.md)
owns the encoded representation and restore semantics; D08 owns only message-body
interval selection and interactive delegation.

### Calendar commands are only the completion-visible part of the calendar

The four top-level commands `G85-001` through `G85-004` do not exhaust calendar
interaction. D08's calendar contract normatively supplies Year, Month, Four Weeks,
and Week configurations; date alignment and rollover; day/month/week presentations;
reminder sorting; and the once-only/periodic template state. In particular:

- a reminder is valid on a day only when every present expiration, period, and start
  constraint passes and at least period or start is present;
- start-date comparison uses the end of the selected day, while expiration compares
  selected-day midnight strictly before expiration;
- left/middle/right Compose Reminder select once-only, periodic, and template chooser
  branches; keyboard uses its own template;
- accepted header changes create command-specific undo state, while parse/prompt
  rejection precedes mutation; and
- failures during a multi-header day-presentation action are not silently upgraded
  to atomic behavior.

The two day converters and the non-command calendar presentations remain in D08's
typed presentation denominator. They are not omitted merely because this page counts
named completion commands.

## Denominator construction and generated validation

The denominator was produced by inert parsing; no historical form was evaluated.
For C303, the parser walks top-level lists in the active unversioned source files,
normalizes the macro head case-insensitively, and selects exactly the 86 definitions
in `comnds`, `filter`, `mail`, `mfiles`, `profil`, and `window`. This catches the
lowercase `View Original Header` form that an uppercase anchored grep misses. Patch
files and old numbered siblings are excluded from the clean-source denominator.

For G85, the same parser walks the selected physical source versions from the exact
[declared build-source manifest](genera/zmail-declared-build-source-manifest.md).
Its set equation is:

~~~text
147 ordinary zmail DEFINE-ZMAIL-TOP-LEVEL-COMMAND forms
+ 3 eco-commands forms loaded as the ECO extension
+ 1 package-qualified kbin/buffer reparse form
+ 1 externally defined printer command explicitly adopted into ZMail
= 152 completion candidates
~~~

For an independent transcription check, encode each table row in profile/ID order as
UTF-8 `ID`, tab, trimmed completion name, tab, trimmed literal Markdown source-owner
cell, newline. The 238-record stream is 13,095 bytes and has SHA-256
`f8583a50211bee3642c064ec12a53f8eee5da9732275277de0a7d299ab9a04df`.

The font-change escape surrounding `Set Key` is removed only from its identifier;
the source bytes are otherwise not normalized. The two compatibility synonym forms
for Save and Expunge map to existing completion names and add zero. Humanization uses
the profile's command-name constructor; the G85 constructor expands `Msg`/`Msgs` to
`Message`/`Messages`, while the C303 table retains its selected names.

After each edit, a document-side checker MUST enforce all of the following:

1. IDs are exactly `C303-001` through `C303-086` and `G85-001` through `G85-152`;
2. every ID and completion name is unique within its profile;
3. each source-produced tuple `(profile, completion-name, physical-path, line)` has
   one row and no row lacks such a tuple, except the explicitly two-owner adopted
   printer row;
4. the Set Key, ECO, KBIN, printer-adoption, lowercase-C303, and synonym cases produce
   the arithmetic above; and
5. each row has nonempty family, effect, applicability, failure, and normative-owner
   cells.

The following rights-safe check validates the finite document shape. Source-to-row
comparison MUST additionally use the inert extractor and licensed inputs locally;
the licensed source is not copied into a test fixture.

~~~python
import re
from pathlib import Path

text = Path("docs/zmail-command-effect-closure.md").read_text()
for profile, expected in (("C303", 86), ("G85", 152)):
    rows = re.findall(
        rf"^\\| ({profile})-(\\d{{3}}) \\| ([^|]+) \\| ([^|]+) \\|"
        rf" ([^|]+) \\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\| ([^|]+) \\|$",
        text,
        re.MULTILINE,
    )
    assert [int(row[1]) for row in rows] == list(range(1, expected + 1))
    assert len({row[2].strip() for row in rows}) == expected
    assert all(all(cell.strip() for cell in row[2:]) for row in rows)
~~~

## Command-effect conformance suite

| Test | Profiles | Discriminating procedure and required result |
| --- | --- | --- |
| `ZM-CMD-01` | C303, G85 | Run the inert source enumerator and exact augment/exclusion rules; compare the full tuple set to this page, not just counts. No missing, duplicate, or extra row is allowed. |
| `ZM-CMD-02` | C303, G85 | For every row, invoke through named completion under absent/present sequence and message states and all four numeric states from D08. Admission or rejection MUST match the applicability cell before the first effect. |
| `ZM-CMD-03` | C303, G85 | For each button-aware command, inject `K/L/M/R` and record chooser, target, ordered adapter calls, result, and redisplay code. “Same” rows MUST not invent a button branch. |
| `ZM-CMD-04` | C303, G85 | Install tracing fakes at every semicolon-separated effect boundary in each row and fail each boundary in turn. The retained state MUST be exactly the listed prefix; no implicit rollback is allowed. |
| `ZM-CMD-05` | C303, G85 | Dispatch all names through Extended Command and prove exactly one selected function per profile. Synonyms and aliases MUST retain the stated completion identity without changing denominators. |
| `ZM-CMD-06` | G85 | Set Key a normal leaf, a child beneath a prefix, and the prefix itself with `N`; re-enumerate dispatch and Help after each mutation. Abort before the final key MUST preserve the old cell. |
| `ZM-CMD-07` | G85 | Seed Undo/Redo histories with killed and live entries. Prove killed-entry pruning, live-entry loss on declined confirmation, opposite-stack push only after method success, and prefix retention after injected partial method failure. |
| `ZM-CMD-08` | G85 | Use two matching rules with at least two actions each and inject a fault in the third action overall. Trace MUST show rule order, description-before-action, retained first two effects, and no later action/message. |
| `ZM-CMD-09` | G85 | With a deterministic fake crypto provider, fail before interval production and after old-body deletion in both replace paths; compare body, header, mapping, undo, temporary-interval, and output state. |
| `ZM-CMD-10` | G85 | Decode a synthetic ECO envelope through fake decoder and distribution adapters. Test missing delimiter, bad preamble, decode failure after file creation, declined restore, and restore failure; retained filesystem/distribution prefixes MUST match this page. |
| `ZM-CMD-11` | C303, G85 | Fail GMSGS before and after provider return. C303 MUST use the primary buffer host and complete typeout only after helper return; G85 MUST retain its pre-provider default-buffer selection and translate caught file/network errors. |
| `ZM-CMD-12` | G85 | Exercise the four completion-visible calendar commands together with every D08 calendar presentation/converter, boundary-day predicate, navigation rollover, and prompt abort. The command count MUST remain four even though the interaction graph is larger. |
| `ZM-CMD-13` | C303, G85 | For every `X` row, replace the downstream subsystem with a trace-only fake and prove the ZMail-owned prompt, operand normalization, call ordering, error translation, and retained app state without requiring a real network, printer, compiler, distribution, or mail submission. |

Each test records profile, exact source identities, pristine versus mutated table
state, fixture, input/button/numeric state, ordered trace, result, cleanup, and base
artifact immutability. Real mail delivery, restoration, printing, and destructive
filesystem actions are outside the safe preserved-system oracle; fakes are normative
for effect order.

## Known unknowns, runtime oracles, and nonclaims

`TODO-RUNTIME-ZM-CMD-01`: after a disposable CADR file host makes the selected System
303 ZMail sources loadable, enumerate the live completion alist, compare all 86 names,
and exercise one harmless representative of every family in a synthetic temporary
mailbox. The current `303-0` observation found the program advertised but not
resident, so source closure is not mislabeled as loaded-band closure.

`TODO-RUNTIME-ZM-CMD-02`: in a disposable licensed Genera private world, enumerate
the clean effective completion registry before and after profile/init processing and
compare the 152-name baseline. Exercise read-only commands and reversible synthetic
message mutations through the Genera harness. Do not invoke real ECO restore,
external submission, printing, arbitrary compilation/loading, or real cryptographic
material. This oracle distinguishes clean source, compiled-world, and user/site
registry state; until it runs, every G85 row remains source-established.

This page does not claim exact callable Lisp signatures, binary identity, timing,
pixels, downstream printer/compiler/distribution/network behavior, or security of
historical encryption. A command delegated to another dossier is closed here only at
the explicitly stated ZMail adapter boundary.

## Sources

- LM-3 System 303 pinned public
  [`zmail/comnds.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fcomnds.lisp),
  [`filter.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Ffilter.lisp),
  [`mail.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmail.lisp),
  [`mfiles.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmfiles.lisp),
  [`profil.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fprofil.lisp), and
  [`window.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fwindow.lisp).
- Licensed local Genera System 452.1 / Zmail 442.0 sources named in every G85 row;
  exact sizes and hashes are retained in D08 and the
  [Genera application study](genera/zmail.md#evidence-and-rights-boundary).
- Symbolics, [*Editing and Mail*, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  used as intended-behavior cross-check, not as the command denominator.
- Richard Stallman, [*ZMail Manual*, first edition](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=zmail%2Fmanual%2Fmanual.text),
  April 1983, used as a System 303 intended-behavior cross-check.

Last verified: 2026-07-19.
