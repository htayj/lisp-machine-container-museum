---
type: Historical Article
title: Metering and Performance Analysis on Lisp Machines
description: A release-bounded, source- and manual-grounded comparison of MIT CADR counters and page tracing, LM-3 event metering, and the layered Symbolics Genera performance tools.
tags: [lisp-machine, mit-cadr, lm-3, genera, metering, performance, page-trace, pc-metering]
timestamp: 2026-07-18T06:08:00-04:00
---

# Metering and Performance Analysis on Lisp Machines

“The Lisp-machine meter” is not one continuously renamed application. The
inspected systems contain at least four different instruments:

- System 46 **LMETER** reads cumulative microcode counters before and after a
  form. It reports paging, map, PDL-buffer, and aging activity at the Listener.
- System 46 **PTRAC** records a time-ordered **page trace** and supplies textual
  decoders, filters, summaries, and paging-policy simulators. The source does
  not call it a process tracer.
- Maintained LM-3 System 303 **METER** records selected microcode events for
  enabled stack groups into a dedicated disk partition, then reconstructs a
  call tree or prints an event trace. It has a textual API, not a window-system
  front end.
- Genera retains the older **PC Meter** sampler and adds a large optional
  **Metering Substrate** plus the Dynamic Windows **Metering Interface**. The
  latter offers six run types, persistent run history, configurable fields,
  call-tree navigation, and programmatic form-measurement macros.

These distinctions matter historically and operationally. A cumulative counter
delta cannot reconstruct a call sequence. A page-reference trace is not a
function-call profile. A statistical PC histogram attributes samples to address
ranges but does not recover callers. The later Metering Interface combines
several collectors and views, but it does not make those underlying mechanisms
identical.

This page treats “complete” at the following explicit grain:

1. every user-oriented entry point and report in System 46 `LMETER`;
2. every output, filter, analysis, and keyboard-table entry in System 46
   `PTRAC`, while excluding its internal structure accessors;
3. every documented control and analysis option, analyzer, output form, and
   report column in the maintained LM-3 `METER` source;
4. every operation in the recovered Genera PC Meter dictionary, plus
   user-relevant source-only controls;
5. all 27 commands in the recovered Metering Interface command dictionary, all
   additional interface-local commands found in the inspected 8.5 source, all
   dedicated keyboard and mouse gestures, all six run types and their creation
   options, every major output-field family, and every display sorting/filtering
   choice; and
6. the four recovered documented short-form metering macros, with separately
   labeled source-only generalizations.

The inventory does not claim to cover site extensions, Joshua's separate
metering integration, arbitrary collectors constructed through the substrate,
or commands inherited from packages that are not loaded in the named world.

## Evidence and release boundaries

### MIT CADR System 46

The historical source is the public System 46 snapshot at Git revision
[`8e978d7d1704096a63edd4386a3b8326a2e584af`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src).

| Release file | Bytes | SHA-256 | Evidence supplied |
| --- | ---: | --- | --- |
| [`src/moon/lmeter.21`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/lmeter.21) | 5,144 | `18040dc133d0912ca24c54f1494582fc927a436f5ad79b76eab466e51120318f` | counter-delta Listener and one-form report |
| [`src/moon/ptrace.57`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/ptrace.57) | 32,764 | `f48065916bae608ed53945d54a137d6f2a07885d6dddda6b4ad4659c6e243f84` | page-trace recorder, decoders, filters, and simulations |
| [`src/moon/ptrace.notes`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/moon/ptrace.notes) | 1,134 | `c115283731af5ff2fc73e1b7eea1c284db75b3af72de07da250239e23471d229` | contemporary implementation checklist and unresolved documentation work |
| [`src/lispm/qmisc.281`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm/qmisc.281) | 62,028 | `ed80c13e4d51f5d9b3132a8f193673f081f25d310835087c40cc8c9b08d063ad` | primitive `READ-METER` and `WRITE-METER` access |

The recovered public System 46 on-line help contains the two `Qmisc`
docstrings but no operator documentation for LMETER or PTRAC. That omission is
consistent with two contemporary manual-planning notes: one says to add LMETER
to the programs chapter, and another lists “metering features” as an unwritten
system topic. `ptrace.notes` likewise ends with an unfinished request for a
brief document.

### Maintained LM-3 System 303

The later public source is the maintained LM-3 System repository at Fossil
check-in
[`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
tag `system-303`. This is maintained restoration work, not silently treated as
an untouched historical distribution.

| Maintained file | Bytes | SHA-256 | Evidence supplied |
| --- | ---: | --- | --- |
| [`io1/meter.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fmeter.lisp) | 32,671 | `d5c8248fdba68d31534a676a1eb959b914be6b961b407d7e1be18993aa80eefa` | recorder control, event parsing, analyzers, and reports |
| [`doc/meter.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fmeter.text) | 5,275 | `e625b050fbf9bd74e6c3bf20790b75a04563c3759a32d1643f6735efedbae33f` | older rough notes and sample output |
| [`man/fd-hac.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Ffd-hac.text) | 83,921 | `db1562bb42be7daae0fe1a16cc8bc1b9ab2c93254e546b2e84190b28ed7607a5` | maintained user manual |
| [`man/fd-sub.text`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Ffd-sub.text) | 64,764 | `5f52eb0f9bc4609540a06c54120676b3febd73bd00fbf9f80a2002e83ff35a8e` | explicit separation of raw microcode meters from Lisp metering tools |
| [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp) | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | one-module `METER` system declaration |

The current files were independently compared byte-for-byte with the named
Fossil check-in. The maintained microcode sources were also inspected where a
rough documentation claim conflicted with `meter.lisp`.

### Licensed Genera 8.5 material

The Genera source observations use the locally purchased Open Genera archive
and the Genera 8.5 world it supplies. The source, world, and decoded help remain
ignored and are not linked or redistributed. The descriptions below are
original evidence summaries.

| Release pathname | Evacuated version | Bytes | SHA-256 | Evidence supplied |
| --- | ---: | ---: | --- | --- |
| `sys.sct/sys2/pcmeter.lisp` | 3032 | 20,225 | `0b5b565c9d97dd7b800fbe21b6df0e8a034ca6e8118ca992c92fc65f7d68a718` | older PC Meter implementation |
| `sys.sct/metering/metering-sysdcl.lisp` | 46 | 5,011 | `d75541a6f3187fc5bb62c8c60985b7e19c6226f86fdaf79fa9a0c6b9a05ab26b` | Metering Substrate composition |
| `sys.sct/metering/commands.lisp` | 4036 | 20,208 | `8182bc3c5c544bed5a8973b8f2bc3d5bfa797aeb397645dc8c5ac41fae4f06ab` | substrate's public control layer |
| `sys.sct/metering/function-call-metering.lisp` | 4060 | 50,339 | `f3250a9337dd7892ba86018395c69abc4af22a6803043862901a61e40dc877e7` | trap controls and fudge-factor calibration |
| `sys.sct/metering/pc-metering.lisp` | 4013 | 20,531 | `9f855228f739ef7803558eebdf8ec8199b1e32fe1e33c287ee6011029dfb8d51` | PC sampler as a substrate collector |
| `sys.sct/metering/utilities/measure-form.lisp` | 4027 | 30,011 | `94e3601ffc223bde410a22f5dbb044ea11aef1f17198d2936f4365ed586b180f` | short-form measurement and histograms |
| `sys.sct/metering/interface/sysdcl.lisp` | 17 | 3,713 | `1d44d34bb349a5f75c5a356da91e0050292a651c56e9e83ddf945611acc09b4c` | interface system and six run modules |
| `sys.sct/metering/interface/mi.lisp` | 229 | 111,662 | `47a0156b1ef4a51c3abbc585628a0096ce116093a8c402d3702b24cd20295f82` | program framework, commands, fields, and run creation |
| `sys.sct/metering/interface/call-tree-mixin.lisp` | 34 | 33,406 | `6429e320c168aad4e8ab7421bfddb9237e595dbf893f8e6ef618be0fc6218419` | call-tree filtering and gestures |
| `sys.sct/metering/interface/function-call-mixin.lisp` | 14 | 11,866 | `392f8e37fb2e53b701328ce537867859627de981d06b2496fbf36beeb1ba18a4` | function-list sorting and filtering |
| `sys.sct/metering/interface/function-call-metering-run.lisp` | 21 | 34,903 | `fe94fdaa36c2c0e3bd0c5f0947c2dbc8946ce2964e1773205abb5c2d872fa129` | deterministic function-call fields |
| `sys.sct/metering/interface/call-tree-metering-run.lisp` | 23 | 39,315 | `e289107a3a1e256b0e508b668482edee18c01f857f309b97a338e67acb04ac92` | deterministic call-tree fields |
| `sys.sct/metering/interface/statistical-function-call-metering-run.lisp` | 20 | 13,550 | `c75bf843017b4c55cc4407f663eed031244edcf0b2c94b9946ad3a0b22161ef0` | sampled function fields |
| `sys.sct/metering/interface/statistical-call-tree-metering-run.lisp` | 27 | 25,942 | `d56d8cc3e49d6c224bfe1acc84f108136232cfd7eb61a8b6213a2eef93bcb36d` | sampled call-tree fields |
| `sys.sct/metering/interface/page-trace-metering-run.lisp` | 31 | 37,006 | `8a1da815be71a16ed344d8ebda2a8b0530a97f428c664667150de461d488276d` | Page Fault run and event display |
| `sys.sct/metering/interface/pc-metering-run.lisp` | 25 | 16,727 | `12061125cbcf997711ed2ccaf3cfc9b64a068e1f6877a6faf97da07ca77cc264` | Statistical Program Counter run |

The local system directories identify both `METERING` and
`METERING-INTERFACE` component patch levels as 444. Recovered installed help is
from documentation system 440, so a difference between help and source is
reported as a versioned difference, not silently treated as a typo.

| Installed logical document | Evacuated version | Source bytes | Source SHA-256 | Records |
| --- | ---: | ---: | --- | ---: |
| `doc:installed-440;meter-int;meter-int1.sab` | 42 | 40,432 | `4042cc4fe8e893c620732f7dd1369d88bb388f1dedea587c6afc72383b87a6cf` | 12 |
| `doc:installed-440;meter-int;meter-int2.sab` | 37 | 61,012 | `75466b34970ae3e8dc032a77c08969e4417fd13fe8913b900f397cc17641c96e` | 29 |
| `doc:installed-440;meter-int;meter-int3.sab` | 31 | 97,962 | `db7222a7244806caacba78c9981bb9232609fdfcb520a0bec9f7284c89bec9ba` | 18 |
| `doc:installed-440;meter-int;meter-int4.sab` | 11 | 24,848 | `42f5b152a12b0ab627162effa73a0b74c690d36d16a6448d66df23cf904e2bfc` | 8 |
| `doc:installed-440;meter;pc-meter.sab` | 11 | 15,772 | `b9ec9462b9dd74b19a08b21dc2bb415f77793692e073779e5cc55bf4e62d0c77` | 17 |

The public manual cross-check is the Metering Interface and PC Metering material
in Symbolics's
[Program Development Utilities, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf).
The optional-system loading instruction is also present in the
[Genera 8.3 Software Installation Guide for the NXP1000](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_the_NXP1000.pdf).
Both were verified 2026-07-18.

## System 46: LMETER is a counter-delta tool

The primitive `READ-METER` and `WRITE-METER` functions address named entries in
the microcode's A-memory counter block. LMETER builds two user tools on that
primitive; it does not collect a stream of events.

| Entry point | Behavior | Visible report |
| --- | --- | --- |
| `READY-ON` | Replaces the ordinary Listener read/eval/print loop until `READY-OFF`; snapshots counters before each evaluation and prints their deltas after evaluation, excluding read and print time | elapsed seconds; disk reads, writes, and fresh pages; first- and second-level map reloads; PDL-buffer read, write, and memory faults; pages aged and age-flushed |
| `READY-OFF` | Throws to the catcher installed by `READY-ON` | no report; restores control to the caller |
| `METER form` | Evaluates one quoted form, prints its result, then computes counter changes | memory and wired size; map reloads; PDL-buffer faults; disk reads, writes, errors, and fresh pages; aging rate, calculated lap time, pages aged, and pages made flushable |

`READY-ON` also maintains the Listener history variables `-`, `*`, and `+`.
Its display is deliberately compact: a single braced status line follows each
evaluation. `METER` prints a multi-line report but does not measure a call tree,
attribute costs to individual functions, or remove the cost of the evaluated
form's own output.

Revision 21 differs from revision 20 only by the addition of the MIT copyright
notice. This is useful negative lineage evidence: the inspected System 46 tool's
behavior did not change between those two evacuated versions.

### Raw meters are not the later Meter application

The name collision persists into System 303. Its maintained subsystem manual
explicitly distinguishes the `READ-METER`/`WRITE-METER` microcode counters from
the Lisp metering tools. LMETER uses those counters directly; LM-3 `METER`
instead records event frames. Calling both simply “the meter” obscures a real
architecture change.

## System 46: PTRAC is a page-reference trace

The `ptrace.57` heading calls itself “Page-trace support macrocode.” No inspected
source expands `PTRAC` as an acronym, so this page preserves that uncertainty.
What is certain is its subject: page-ins, page-outs, and their paging context,
not scheduler/process events in general.

### Record layout and lifecycle

`PAGE-TRACE-ON` allocates a wired, static `ART-32B` array, by default large
enough for 2,000 four-word records. Each record contains:

1. a clock sample;
2. the referenced virtual address;
3. flags for swap-out, stack-group switch, transport, scavenging, and
   asynchronous activity, together with a low micro-PC field; and
4. a sampled current function taken from the machine's M-AP register.

The recorder validates that loaded microcode symbols match the running
microcode version, clears the array, wires it, and enables the `%PAGE-TRACE`
microcode hook. `PAGE-TRACE-OFF` disables the hook, unwires the array, and
releases the GC arrest. GC is arrested because collection or flipping could
change address and region meanings; the source also warns that flipping
invalidates a trace.

The “current function” is explicitly heuristic: the microcode samples M-AP at
the page event and hopes it is representative. The decoder stores area and
space names, function, and micro-PC symbol information in list records before a
later flip can invalidate those interpretations.

### Complete user-oriented PTRAC surface

| Group | Entry points | Result |
| --- | --- | --- |
| Start/stop | `PAGE-TRACE-ON &optional trace-size`, `PAGE-TRACE-OFF` | enable or disable recording and manage wiring/GC arrest |
| Decode current buffer | `PRINT-PAGE-TRACE &optional last-n`, `LISTIFY-PAGE-TRACE &optional last-n` | newest-first text, or an oldest-first list of decoded `PAGE-TRACE-ELEMENT` records |
| Decode saved list | `PRINT-PAGE-TRACE-LIST list` | oldest-first text with inter-event deltas |
| File output | `FILE-PAGE-TRACE filename &optional last-n`, `FILE-PAGE-TRACE-LIST filename list` | print current or saved trace to a file |
| Editor output | `BUFFER-PAGE-TRACE buffer &optional last-n`, `BUFFER-PAGE-TRACE-LIST buffer list` | append a page break and report to a named editor buffer |
| Filters | `FILTER-SWAP-IN list in-p`, `FILTER-AREA list area`, `FILTER-SPACE list space`, `FILTER-SCAVENGER list scavenger-p` | return a filtered reference string without changing the records |
| Basic summary | `SUMMARY-INFORMATION list`, `REPORT-AREA-COUNTS list` | counts of swap-ins, scavenger/transporter/async activity and distinct pages; or page-fault counts by area |
| Re-reference analysis | `SUMMARIZE-RE-SWAPINS list max-interval`, `SUMMARIZE-THRASHING list max-interval &optional show-p` | interval distributions for repeated swap-ins or swap-out/then-in pairs |
| Policy simulation | `SIMULATE-HYPER-PAGING list hyper-page-size &optional max-time-interval`, `SIM-FIFO list memory-size`, `SIM-LRU list memory-size`, `SIM-DEFERRED-CACHE list memory-size &optional cache-size`, `GROUP-SWAP-HACK list fifo-size area-group-size-alist` | estimated locality and alternative paging-policy results |
| Page-table inspection | `PRINT-PHT-STATS`, `REPORT-WIRED-PAGES &optional area-name` | page-table swap-status totals or wired-page area scan |

The textual trace heading says that entries are newest first and identifies the
columns as delta milliseconds, address, flags, micro-PC, and macro function.
Each decoded line can show the area and region space type plus `OUT`, `SCAV`,
`TRAN`, and `ASYN` flags.

Two shortcuts are pushed into `TV:*ESCAPE-KEYS*`:

- the character named `HAND-UP` calls `PAGE-TRACE-ON`; and
- `HAND-DOWN` sends the current trace to an editor buffer named `PAGE TRACE`.

These are entries in the historical TV escape-key table. Without a compatible
System 46 runtime, this page does not guess how a particular modern keyboard
mapping labels those characters.

### Source-visible limits and unfinished work

- A proposed 512-by-512 scatter plot of space interval against time interval is
  present only as commented code in revision 57. It is not a shipped command.
- `ptrace.notes` says the filters, evaluated address fields, micro-PC timing
  investigation, and GC arrest were completed, but a brief user document was
  still outstanding.
- Revision 57 improves wiring, adds more region-space decodes, handles the
  special free-memory address, and reformats output relative to revision 54.
  It comments out the scatter plot that was live in revision 54.
- Several simulations describe their own approximation limits. For example,
  the group-swap model does not fully model memory residency or induced paging,
  and the deferred-cache simulation omits some verification references.

## LM-3 System 303: disk-backed microcode event metering

The maintained `METER` system is one source module. Its rough documentation says
that it is awaiting a window-system interface, and the maintained system
declaration still contains no graphical module. Its workflow is Listener- and
file-oriented:

1. create or locate a disk partition named `METR`;
2. enable selected stack groups, processes, windows, or all stack groups;
3. reset the recording buffer;
4. execute forms with selected microcode event bits enabled; and
5. analyze the event frames into a call tree, summary, or event listing.

The microcode writes complete records into a wired memory page and spills full
pages into `METR`. A record does not cross a page boundary. Its common header
holds event code and length, real-time clock, accumulated disk-wait time,
page-read count, current stack group, current function, and regular-stack depth.
Function entry/exit and stack-switch records add event-specific values; page
records add the fault address and micro-PC/flag information.

Because records contain raw Lisp pointers outside the collected heap, the tool
arrests the GC process. The operator must call `METER:RESUME-GC-PROCESS` after
finishing.

### Recording controls and event mask

| Interface | Exact behavior |
| --- | --- |
| `METER:RESET` | disables microcode events while resetting the memory pointer, disk address, and remaining partition count |
| `METER:ENABLE &rest things` | enables the stack group denoted by each stack group, process, or window; `T` enables all stack groups globally |
| `METER:DISABLE &rest things` | disables named objects; no arguments disables all tracked objects; `T` disables only the global enable |
| `METER:METERED-OBJECTS` | records the objects enabled through the API |
| `METER:SUSPEND` | prevents further disk spill by setting remaining disk count to zero |
| `METER:RESUME-GC-PROCESS` | revokes the `METERING` GC arrest reason |
| `METER:TEST form &optional enables` | resets, enables only the current stack group, evaluates one form, then disables it; default event mask is octal `14` |
| `METER:RUN &rest forms` | resets and evaluates forms using stack groups already enabled; event mask is octal `14` |
| `METER:PRINT-RAW-DATA` | prints raw event number and record length for every frame |

`SYS:%METER-MICRO-ENABLES` uses bit 1 for page faults, 2 for consing, 4
for function entry/exit, and 8 for stack-group switches. The default octal
`14` therefore records function boundaries and stack switches. Stack-switch
records are essential to avoid charging time spent in another stack group to
the function that happened to be active before the switch.

The maintained microcode implements page-in and page-out recording when bit 1
is enabled. A cons event number and analyzer slot exist, but `meter.lisp` marks
the cons event unimplemented and no corresponding microcode recording routine
was found.

### Complete `METER:ANALYZE` option and report surface

General keywords are:

| Keyword | Meaning |
| --- | --- |
| `:ANALYZER` | event table or analyzer name; default `:TREE`, alternative `:LIST-EVENTS` |
| `:STREAM` | write to the supplied stream |
| `:FILE` | create an output file and close it afterward |
| `:BUFFER` | append through an interval stream to a named editor buffer |
| `:RETURN` | retain and return the parsed intermediate structure |
| `:INFO` | reuse a returned intermediate structure instead of rereading `METR` |

The `:TREE` analyzer accepts:

| Keyword | Meaning |
| --- | --- |
| `:OUTPUT` | `METER:TREE-NULL`, `METER:TREE-PRINT`, or default `METER:SUMMARIZE-TREE` |
| `:FIND-CALLERS` | replace normal output with caller counts for one function spec or a list |
| `:STACK-GROUP` | restrict `TREE-PRINT`, `SUMMARIZE-TREE`, or caller output to one stack group or a list |
| `:SUMMARIZE` | restrict summary rows to one function spec or a list |
| `:INCLUSIVE` | include callees in a function's totals; recursive calls can therefore be counted more than once |
| `:SORT-FUNCTION` | `MAX-CALLS`, `MAX-RUN-TIME` (default), `MAX-REAL-TIME`, `MAX-PAGE-FAULTS`, or `MAX-RUN-TIME-PER-CALL` |

The three tree reports answer different questions:

- `TREE-PRINT` prints every reconstructed call-tree node with indentation,
  function, own real/run time and faults, and descendant real/run time and
  faults.
- `SUMMARIZE-TREE` merges nodes by function and prints **Functions**, **#
  calls**, **Run T**, **Faults**, and **Real T**, followed by totals.
- `TREE-FIND-CALLERS` prints caller, callee, and call count for the requested
  callees.

`:LIST-EVENTS` prints one row per event with real time, run time, cumulative
page faults, stack-group name, current function, stack depth, event kind, and
event-specific data. Function records show calls and returns; stack-switch
records name the old stack group; page records show page-in/page-out, address,
area, and decoded microcode position.

### Documentation drift is evidence

The older rough `doc/meter.text` calls the analyzer option `:FILTER`; the
maintained source parser and formal manual call it `:ANALYZER`. Passing
`:FILTER` to the inspected implementation does not select an analyzer: it falls
through into analyzer-specific options and is rejected. The rough note also
says page-fault recording is unimplemented, whereas the maintained microcode
contains explicit page-in and page-out recording paths. The consing statement
remains accurate.

This is an example of why the manual layers cannot be collapsed. The rough note
captures an earlier state and design intent; the maintained source and formal
manual describe a later interface.

## Genera has three metering layers

### 1. The older PC Meter

PC Meter predates the Metering Interface, which the installed documentation
dates to Genera 7.2. It statistically samples the current macro-PC into a wired
array of address-range buckets. On 3600-family hardware the sampling source can
be an audio microtask or a FEP task; on Ivory/IMach the inspected source uses a
periodic interrupt handler. Samples outside the configured address range are
counted as misses.

The recovered dictionary documents the following complete operation set:

| Operation | Purpose |
| --- | --- |
| `METER:MAKE-PC-ARRAY size` | allocate and wire the sample array |
| `METER:MONITOR-ALL-FUNCTIONS` | make the current compiled-function address extent the monitored range |
| `METER:SETUP-MONITOR &optional start end` | map an address interval into the array |
| `METER:MONITOR-BETWEEN-FUNCTIONS lower upper` | use two functions as approximate range boundaries; compilation/region allocation can invalidate the assumption |
| `METER:EXPAND-RANGE start-bucket &optional end-bucket` | remap the whole array onto an inclusive old bucket range |
| `METER:START-MONITOR &optional clear` | enable sampling, normally clearing prior counts |
| `METER:STOP-MONITOR` | disable sampling |
| `METER:REPORT &optional function-list` | print totals and per-bucket percentages/functions |
| `METER:PRINT-FUNCTIONS-IN-BUCKET bucket` | print compiled functions mapped to a bucket |
| `METER:LIST-FUNCTIONS-IN-BUCKET bucket` | return those function names as a list |
| `METER:RANGE-OF-BUCKET bucket` | return bucket start and limit addresses |
| `METER:MAP-OVER-FUNCTIONS-IN-BUCKET bucket function &rest args` | invoke a callback for each compiled function in a bucket |
| `METER:FUNCTION-RANGE function` | return the first and last buckets occupied by a function |
| `METER:FUNCTION-NAME-WITH-ESCAPES object` | decode a compiled function or microcode escape object |
| `METER:WITH-MONITORING clear body...` | unwind-protected start/body/stop wrapper |

`REPORT` first prints total, ignored, and listed sample counts and the percentage
listed. Each subsequent row identifies a bucket, percentage, and either one
function or a truncated indication of multiple functions.

Source adds user-relevant operations omitted from the recovered dictionary:
`UNMAKE-PC-ARRAY`, `PC-METERING-SUPPORTED-P`, sampling-rate query/setters,
`FUNCTION-LIST` with a threshold, and `ESCAPE-MONITOR`. The apparent escape-key
registration for `ESCAPE-MONITOR` is commented out, so it is not counted as a
live key binding.

### 2. The optional Metering Substrate

`METERING-SUBSTRATE` is a general instrumentation framework, not a screen. Its
system declaration is marked optional and not advertised. The module order was
deliberately flattened because the source says the system-construction tool had
dependency bugs; that comment is restoration-relevant evidence, not a claim
that the conceptual architecture is random.

The architecture separates:

- **triggers**, which define observable events or boundaries;
- **regions**, which pair an entry and exit and can compute differences;
- **controls**, which decide scope and when instrumentation is switched on;
- **generators**, which create values at a trigger;
- **collectors**, including records, histograms, and backtraces, which retain
  generated values; and
- **generated/inserted/wirable code**, which installs fast instrumentation into
  function and machine paths.

The command layer exposes composition operations rather than a fixed profiler:
attach a collector or generator to a trigger, name generated values, filter
events, meter conditionally, set a control's scope/switch, turn a function into
a metering region, remove function metering, display/reset collectors, show
active metering state, and reset or disable the utility. The Metering Interface
uses this substrate to construct its standard run types.

Function-call metering calibrates entry and exit overhead. The first interface
selection computes repeated “fudge factors” so this overhead can be subtracted
and an error estimate displayed. The source default on VLM is to ignore
inconsistent trials rather than prompt, while the recovered general
documentation describes the interactive **Retry once**, **Retry**, and
**Ignore** choices. That machine-conditional source behavior is another reason
not to generalize hardware instructions to Open Genera without qualification.

### 3. The optional Metering Interface

Loading system `METERING` loads `METERING-SUBSTRATE` and then the Dynamic
Windows interface. The site system file deliberately maps the name `METERING`
to the interface system, while `METERING-SUBSTRATE` maps to the lower layer.
After loading, the program's Select key is `%`.

The source layout has a title, an interactor, a command menu, a **History of
Metering Runs** pane, a separate field-header pane, and a **Metering Results**
pane. Runs remain in the Lisp world until explicitly deleted or a cold boot.
The six top command-menu items, in source order, are:

| Row | Menu items |
| --- | --- |
| 1 | **Meter Form**, **Meter in Process**, **Re-Meter**, **Set Display Options**, **Show Metering Run**, **Help** |

## Metering Interface run types and creation options

| Run type | Collection and indexing | Availability |
| --- | --- | --- |
| **Function Call** | records every function entry/exit and indexes merged data by function | form or process |
| **Call Tree** | records every function entry/exit and indexes by complete calling path | form or process |
| **Page Fault** | records paging-system events and indexes by page-fault event | form or process |
| **Statistical Function Call** | periodically samples the metered process's current function | form or process |
| **Statistical Call Tree** | periodically samples the metered process's stack trace | form or process |
| **Statistical Program Counter** | microcode/interrupt PC samples with iterative range expansion; exclusive time only | form only, and only when PC metering is supported |

For either creation command, **What to meter** is one of **Everything**,
**Only When Enabled**, or **Within Functions**. The second choice restricts
collection to the dynamic scope of `MI:WITH-METERING-ENABLED`; the third asks
for a sequence of function specs and installs metering regions around them.

### Complete `Meter Form` arguments

| Argument | Applies to | Meaning/default |
| --- | --- | --- |
| form | all | expression to execute and meter |
| metering type | all | one of the six types above |
| what to meter | all | Everything, Only When Enabled, or Within Functions |
| `:METERED-FUNCTIONS` | Within Functions | sequence of defined function specs |
| `:NAME` | all | optional history/display name |
| `:COUNT` | all | number of trials; only the last is collected; default 1 |
| `:WITHOUT-INTERRUPTS` | Function Call, Call Tree, Page Fault, Statistical Program Counter | execute the measured extent without scheduler preemption; default No and potentially dangerous |
| `:INITIALLY-FLUSH-ALL-PAGES` | Page Fault | flush before collecting; default No |
| `:SAMPLING-INTERVAL` | Statistical Function Call, Statistical Call Tree, and PC sampling when the architecture supports rate control | approximate seconds between samples; source default 1/30 second for process samplers |
| `:RESOLUTION-PERCENTAGE` | Statistical Program Counter | recursively expand peaks above this share; default 0.5 percent |

The documentation-440 command page does not list `:SAMPLING-INTERVAL`, but the
inspected 8.5 source accepts it. It is therefore labeled source-visible in the
later component rather than retroactively inserted into the older dictionary.

Before the collected trial, the implementation executes the form `COUNT - 1`
times. It compiles forms whose operator or arguments cannot safely be applied
directly and asks whether to continue if compilation produced warnings.

### Complete `Meter in Process` arguments and controls

| Argument | Meaning/default |
| --- | --- |
| process | process whose activity is sampled/instrumented |
| metering type | any type except Statistical Program Counter |
| what to meter and `:METERED-FUNCTIONS` | same scope choices as Meter Form |
| `:NAME` | optional run name |
| `:START-AND-STOP` | **Until End chosen** (default) or **Function keys** |
| `:MODE-LOCK-P` | collect only while the Mode Lock key is down; default No and polled rather than immediate |
| `:INITIALLY-FLUSH-ALL-PAGES` | Page Fault only |
| `:SAMPLING-INTERVAL` | Statistical Function Call and Statistical Call Tree |

With **Function keys**, `Function-(` starts and `Function-)` finishes the run.
Mode Lock can gate either start/stop scheme; with Function keys both conditions
must be true. With the default scheme, the current source presents a completion
choice in the Metering Interface. Installed help additionally says the `END`
key ends the run. Runtime verification of the exact Open Genera key path remains
pending below.

Starting or stopping in the middle of a function has visible consequences. A
Call Tree run can show multiple apparent roots because the real root was entered
before recording. A Function Call run counts only completed entry/exit pairs;
an incomplete final invocation can be invisible as such after earlier completed
calls have already contributed data.

## Complete command inventory

The installed documentation-440 dictionary contains 27 named commands. The
table is exhaustive for that dictionary; source-only additions follow it.

| Group | Documented commands |
| --- | --- |
| Create/repeat/show | **Meter Form**, **Meter in Process**, **Show Metering Run**, **Re-Meter** |
| Run lifecycle | **Describe Metering Run**, **Delete Metering Run** |
| Display state | **Set Display Options**, **Lock Results Display**, **Unlock Results Display** |
| Major fields | **Add Output Field**, **Delete Output Field**, **Move Output Field**, **Describe Output Field**, **Expand Field** |
| Subfields/defaults | **Add Output Subfield**, **Delete Output Subfield**, **Set Default Output Fields for Type**, **Set Output Fields of Run From Defaults** |
| Call-tree navigation | **Hoist Node**, **Dehoist**, **Hide Node Children**, **Show Node Children**, **Show All Node Descendants**, **Hide All But Path to This Node**, **Hide Node**, **Set Indentation Depth** |
| Help | **Metering Interface Help** |

The 8.5 source defines these additional interface-local commands or distinct
subfield variants:

| Source-visible command | Visibility/effect |
| --- | --- |
| **Clear Output History**, **Copy Output History** | command-table operations adapted from general Dynamic Windows tools |
| **Scroll Window** | common internal target for four dedicated scroll accelerators |
| **Wipe Text** | pushes marked results text to the kill ring |
| **Move Output Subfield**, **Describe Output Subfield** | distinct source commands where documentation groups the operation with the major-field command |
| **Open Ladder Below Node** | recursively opens descendants whose selected component exceeds a percentage of the parent; default 80 percent |
| **Open Sub Faults** | toggles subevents for a main Page Fault event by clicking it |

An old **Display Page Fault Meters** command remains inside a block comment and
is not counted as live. The program also explicitly installs the standard
commands **Edit Definition**, **Report Bug**, **Set Window Options**, **Show
Callers**, **Show Compiled Code**, and **Show Function Arguments**, in addition
to inherited Help Program and Standard Arguments command tables.

`Show Metering Run` normally makes a run current. With an output destination it
can render to a buffer, window, or printer; installed help excludes direct file
and stream destinations. A buffer can subsequently be saved to a file.

## Complete dedicated keyboard and mouse interface

Symbolics notation uses `c` for Control, `m` for Meta, `s` for Super, and `sh`
for Shift.

### Keyboard accelerators and asynchronous controls

| Key | Command or effect |
| --- | --- |
| `Select-%` | select the Metering Interface |
| `c-sh-D` | Describe Metering Run for the current run |
| `c-m-R` | Re-Meter the current run |
| `c-m-U` | Dehoist one level; positive numeric argument chooses levels, zero or an infinite argument goes all the way |
| `Scroll` | vertical forward scroll; numeric argument changes screen/line/end behavior |
| `m-Scroll` | vertical backward scroll |
| `s-Scroll` | horizontal forward scroll |
| `m-s-Scroll` | horizontal backward scroll |
| `s-W` or `m-W` | Wipe Text from the results pane into the kill ring |
| `Function-(` / `Function-)` | asynchronously start/finish a process run when that start/stop method was selected |
| Mode Lock | synchronously gates collection when `:MODE-LOCK-P` is Yes; the source polls every 0.5 seconds |

### Mouse gestures by presentation

| Gesture | Run/menu/field behavior | Call-tree/Page Fault behavior |
| --- | --- | --- |
| Left | invoke a command-menu item; show a run | toggle node children; toggle Page Fault subevents in current source |
| Middle | describe run, command, field, or subfield; expand data | describe/expand the selected presentation |
| Right | context menu | node/event context menu where supplied |
| `sh-Middle` (`:delete`) | delete run, field, or subfield | hide a node and descendants |
| `c-m-Left` | add a major field from a run or a subfield from a field | — |
| `c-m-Middle` | move a field or subfield | — |
| `s-Middle` | Re-Meter a run | — |
| `m-Left` | Set Display Options on a run | hide all but the path to a call-tree node |
| `sh-Left` | — | hide visible node children |
| `s-m-Left` | — | hoist a node, or dehoist if it is already the root |
| `s-m-Middle` | — | make the selected node's depth the zero-indentation depth |
| `s-c-Left` | — | show all descendants in the inspected 8.5 source |
| `s-Left` | — | source-only Open Ladder Below Node, defaulting to descendants over 80 percent of their parent's selected component |

There is a direct help/source disagreement. Documentation system 440 assigns
**Show All Node Descendants** to `s-Left`. The component-444 source assigns that
command `s-c-Left` and uses `s-Left` for the undocumented thresholded ladder.
Both facts are preserved; runtime must determine which bindings are installed
in the specific world used by the harness.

## Reports, output fields, and display choices

The interface stores collector data independently of its view. Major output
fields can be added, removed, moved, or reset to per-run-type defaults;
subfields choose numerical totals, averages, percentages, bar graphs,
histograms, or error estimates. Clicking Middle on expandable data displays its
collector details, including extrema, average, standard deviation, and one or
more histogram modes.

### Complete major fields and visible subfield families

| Run type | Available major fields and source-defined subfields | Default major fields |
| --- | --- | --- |
| Function Call | **Calls** (`Count`, `Incl Count`); **Incl Time** (`Total`, `%Run`, `Avg`, `RAvg`, `Dist`, `WDist`, `/Run`, `Error`, `Avg Error`, `Error%`, `Error/`); **Incl Process Time** (same family); **Excl Time** (`Total`, `%Run`, `%Process`, `%Incl`, `Avg`, `RAvg`, `Dist`, `WDist`, `/Run`, `/Process`, `/Incl`, four error views); **Excl Consing** (`Total`, `Avg`); **PFs** (`#`, `Avg`); **Incl PS time** and **Excl PS time** (`Total`, `Avg`, `Dist`, `WDist`, percentage/bar relative to inclusive or exclusive time); **Function** | Calls, Incl Process Time, Excl Time, Excl Consing, PFs, Excl PS time, Function |
| Call Tree | **Calls**; **Incl Time** and **Incl Process Time** (totals/averages, run/root shares, distributions, errors, plus process/inclusive shares where applicable); **Excl Time** (run/root/inclusive/process shares, distributions, errors); **Excl Consing**, **Incl Consing**; **PFs**; **Excl PS time**, **Incl PS time**; **Function** | Calls, Incl Process Time, Excl Time, Incl PS time, Function |
| Statistical Function Call | **Excl Time** (`Total`, `%Run`, `/Run`); **Excl Process Time** (run/exclusive shares); **PFs**; **PS time** (process and total-exclusive shares); **Samples**; **Function** | Excl Time, Excl Process Time, PFs, PS time, Function |
| Statistical Call Tree | **Incl Time**, **Incl Process Time** (run/root/inclusive shares); **Incl PFs**; **Incl PS time** (run/root/inclusive and total-run/root shares); **Incl Consing**; **Samples**; **Function** | Incl Process Time, Incl Time, Incl PFs, Incl PS time, Function |
| Page Fault | **Start** (`Time`); **Total** (`Time`); **Fault Type** (`Name`); **VMA** (`Address`, `Page`, `Area Name`, `Space`, `Rep`); **Function/Object** (`PC`, `Object`) | all five major fields |
| Statistical Program Counter | **Excl Time** (`%Run`, `/Run`); **Function** | both fields |

`Time` is wall-clock time and can include other processes. `Process Time`
counts only time in the metered process. `Incl` includes callees or descendants;
`Excl` does not. Slash-prefixed subfields are bar graphs, while percent-prefixed
subfields are numeric percentages. `RAvg` is the average of the main histogram
mode, a heuristic noise filter rather than a guaranteed corrected value.

### Complete display-parameter choices

| Run family | Sorting choices | Filtering/options |
| --- | --- | --- |
| Function Call | total/average Inclusive Process time; total/average Inclusive time; total/average Exclusive time; total/average Exclusive Page Fault time; total/average Exclusive Consing; function name; total calls | filter by the same or another sorting component; percentage threshold; absolute integer threshold |
| Call Tree | total/average Inclusive Process time; total/average Inclusive time; total/average Inclusive Paging System time; total Inclusive Consing | filter component; percentage of caller (default 80); percentage of total (default 20); maximum depth; substring sequence of function names |
| Statistical Function Call | Exclusive time; Exclusive Process time; Exclusive Process Page Fault time; function name | component, percentage threshold, absolute threshold |
| Statistical Call Tree | total Inclusive Process time; total Inclusive time; total Inclusive Process Consing; total Inclusive Process Paging System time; total Inclusive Process Page Faults | same call-tree thresholds/depth/function matching |
| Page Fault | start time; duration; function name | minimum duration; selected page-event types; whether to retain events whose subevents were all filtered |
| Statistical Program Counter | Exclusive time; function name | minimum percentage |

The 12 Page Fault event-type choices are **Replace**, **Write**, **Fetch**,
**Prefetch**, **Prefetch Mark**, **Fetch Load**, **Prefetch Load**, **Prefetch
Load Mark**, **Create Page**, **Flushable Page Fault**, **Prefetched Page Fault**,
and **Flush**.

Call-tree filtering ORs the two node thresholds and function-name matches, then
ANDs that result with maximum depth. A displayed matching descendant retains
its calling path. Hoisting changes the display root without losing the run's
whole-run totals; `/Root` and `%Root` subfields make the distinction explicit.

### Measurement caveats represented by the interface

- Percentages can exceed 100 when overlapping inclusive values are summed or a
  denominator represents a different scope.
- Deterministic entry/exit metering adds substantial overhead; calibrated fudge
  factors and Error subfields estimate, but cannot eliminate, uncertainty.
- Statistical results require enough samples and are not expected to be exactly
  repeatable.
- Statistical Function Call and Statistical Call Tree sampling runs in another
  process, so it cannot sample code while scheduling is inhibited. Statistical
  Program Counter sampling is lower-level and can observe such code.
- Metering code and collectors enlarge the working set, so the act of measuring
  can increase paging.
- Paging-system time is based on a coarsely ticking clock; small sample counts
  have correspondingly large uncertainty.
- “Within Functions” uses encapsulation. On very short runs, its own boundary
  functions and several hundred microseconds of overhead can become visible.

## Short-form metering macros

The installed dictionary documents four macros for repeatedly measuring a
short compiled form and comparing it with an empty timing loop:

| Macro | Distinct role |
| --- | --- |
| `METERING:WITH-PART-OF-FORM-MEASURED` | repeats the body but times only subforms wrapped by its local `FORM-TO-MEASURE` macro; the wrapped subform's values are discarded |
| `METERING:WITH-FORM-MEASURED` | times the whole body |
| `METERING:DEFINE-METERING-FUNCTION` | compiles and returns/names a reusable measurement function, adding unspecified metering keywords to its arglist |
| `METERING:MEASURE-TIME-OF-FORM` | compiles a temporary measurement function, invokes it once, and does not retain it |

All accept `:NO-INTS`, `:VERBOSE`, `:VALUES`, `:TIME-LIMIT`, and
`:COUNT-LIMIT`. Time and count limits are mutually exclusive and cannot both be
nil; the usual time limit is one second. `:NO-INTS` defaults true and prompts
before a predicted five-minute scheduler lockout. `:VERBOSE` prints full
histograms. `:VALUES` suppresses output and returns average time, the form-time
histogram, and the empty-loop histogram.

Default output shows average time and average clock overhead as expandable
presentations. A further warning appears when two clock-overhead measurements
differ beyond `*TOLERABLE-CLOCK-VARIATION*`; the inspected default is 0.05.

The source also defines the more general, undocumented-in-these-records
`WITH-FORM-METERED`, `MEASURE-PERFORMANCE-OF-FORM`, and
`DEFINE-PERFORMANCE-METERING-FUNCTION`. They accept generator descriptions in
`:DATA` and can collect measurements other than elapsed time through the same
trigger/collector substrate. An older incompatible `MEASURE-TIME-OF-FORM`
implementation is retained only inside a block comment and is not live.

## Runtime and screenshot status

The fresh Genera run reached a release-media boundary, not the Metering
Interface. No interface screenshot is substituted for that failed load.

- The museum does not currently have a compatible System 46 load band in the
  CADR harness, so LMETER and PTRAC could not be exercised in their named
  historical environment.
- The maintained System 303 tool is textual and requires a `METR` partition.
  A fresh harness check must verify that the private System 303 disk supplies
  that partition before attempting even a small `METER:TEST`; no current
  screenshot is claimed.
- The Metering Interface remains optional and was not resident in the fresh
  Genera 8.5 world. The bounded runtime attempt below could not load it without
  configuring access to the licensed release tree, which was deliberately
  outside the exercise.

### Genera runtime observation: optional system not resident

A fresh isolated session named `d15-metering-genera-20260718`, generation 1,
booted the known Genera 8.5 VLOD and reached Dynamic Lisp Listener 1. The exact
command intent `Load System Metering` was dispatched there. The Command
Processor said that `METERING` was unknown, searched the site pathname
`DIS-SYS-HOST:>sys>site>metering.system.newest`, and requested a login. This is
positive runtime evidence that the optional system was neither known to this
fresh world nor reachable through its unconfigured site/file-service context;
it is not evidence that the purchased archive lacks the source, which the
static audit above directly inspected. A subsequent `Select-%` attempt did not
open a Metering Interface frame.

No host file service, site configuration, or credential was added merely to
make the screen reachable. Consequently the six menu items, live field layout,
fudge-factor interaction, and the disputed Super-Left bindings remain
unverified in this world. The ignored capture
`build/genera-computer-use/d15-metering-genera-20260718/screenshots/0002-load-metering.png`
records the minimal blocker at 1,200 by 900 pixels (PNG SHA-256
`3c9a5c3c24363f7700adf37cd1de0f31ede50c6e0fa2506e9391793b624ae98b`,
pixel SHA-256
`b1dac302e707cef17c2eed22a32bda4385ce43515d9d0781c9708296bfdb458d`).
It is not curated into the museum: it shows a failed load in the Listener, not
the visible application this article is about. This explicit blocker therefore
stands in place of an application screenshot under the repository policy.

The generation record retains the full harness provenance. In portable form:

| Evidence | Recorded value |
| --- | --- |
| Purchased archive | 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base/private VLOD at start | 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`; private copy matched base |
| Debugger and VLM | debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a`; executed VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| Compatibility inputs | `ifconfig` preload SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; X preload SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`; configuration SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| Isolation and X checks | separate user, mount, network, PID, IPC, and hostname namespaces; no default/external route or host file service; MIT-SHM live-verified absent; both exact X-protocol substitutions observed |
| Selected window | `Genera on DIS-LOCAL-HOST`; main client 1,200 by 900 at X=72, Y=55; X window identifier 4194310 |
| Ordered guest input | type `Load System Metering` and Return; bounded Abort/Control-Z/Control-] probes at the resulting login request; blank Return; `Select-%` probe; all 12 intent/outcome action records retained with ledger SHA-256 `f21283570ea91d1dbc1aff37b0ad6c6fdcf7102e4e8c57a550c8eb33e4a6b77f` |
| Toolchain | Guix channel commit `230aa373f315f247852ee07dff34146e9b480aec`; manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Python 3.11.14 |
| Shutdown and persistence | prompt seen, confirmation sent and accepted, cleanup progress seen, then the known bounded VLM stall forced; `forced_after_confirmed_shutdown_stall`, `forced_stop`, and `state_may_be_incomplete` true; host shutdown not orderly; all recorded processes gone; base and private world unchanged; no harness Save World or process checkpoint, while in-guest Save World and guest checkpoint remain unverified rather than inferred |

The one-shot RFC 868 responder also completed successfully, with responder
evidence SHA-256
`095a9399505c0f38ec9df869e2f1227e8d9e3b0d7551c2a80ac2fe5ee5739645`
and completion-record SHA-256
`4cb87fe34076cc7d91b468e722fabb44ca82f3892220a29cff85b3b82e84b792`.

TODO: after a separately authorized, isolated, and reproducible way to expose
the licensed Metering system to the private world exists, load it, select `%`,
wait for fudge-factor work to settle, verify the six-item command menu and the
actual Super-Left/Super-Control-Left call-tree bindings, and capture one sparse
initial interface state. Review that exact image and use under the repository's
screenshot policy before embedding it. Do not capture a full Help chapter or a
bulk command sequence.

TODO: when the CADR harness is available, inspect the System 303 disk label for
`METR`. If present, run a harmless small form through `METER:TEST`, display both
summary and `:LIST-EVENTS` output, resume GC, and capture only the minimal report
needed to establish actual behavior. If absent, record that exact runtime
blocker rather than mutating the preservation disk layout.

## What is established, inferred, and still open

**Established by source:** LMETER is a counter-delta tool; System 46 PTRAC is a
page trace; LM-3 METER is a disk-backed microcode event recorder with tree and
event analyzers; Genera's PC Meter, Metering Substrate, and Metering Interface
are separate layers; and the command, option, field, and gesture inventories
above match the inspected revisions.

**Established by manuals and recovered help:** intended workflows, the six
Genera run types, the 27-command documentation-440 dictionary, interpretation
guidance, and the statement that the graphical interface was introduced after
the older PC Meter.

**Interpretation:** LM-3 METER is the architectural bridge between System 46's
special-purpose page trace and Genera's general event-collector substrate. It
combines lower-level event recording with higher-level function reports, but
its fixed disk format and analyzer tables remain much narrower than Genera's
trigger/generator/collector composition model.

**Open:** the specific Open Genera world's installed call-tree mouse bindings
and initial visible state remain blocked because its fresh VLOD neither knows
nor can reach the optional system in the isolated, unconfigured site context.
The availability of a safe `METR` partition in the System 303 harness is also
open. These remain runtime TODOs, not facts inferred from source.

## Related documentation

- [Trace, Stepper, Breakpoints, and Call Analysis on Lisp Machines](trace-stepper-breakpoints-and-call-analysis.md)
  covers call interception, including Genera's per-process `TRACE` option. That
  is distinct from System 46 PTRAC page tracing.
- [Operating CADR through the Xvfb computer-use harness](mit-cadr/cadr-computer-use-harness.md)
  defines the runtime evidence and provenance requirements for the pending
  System 303 observation.
- [Operating Genera through the Xvfb computer-use harness](genera/genera-computer-use-harness.md)
  defines the isolated licensed-world workflow for the pending interface
  observation.
- [Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md)
  governs any eventual curated image.

## Sources

- MIT CADR System 46, pinned files and manual-planning notes linked in the
  evidence section above.
- LM-3 project, pinned System 303 [`METER` source](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fmeter.lisp),
  [rough notes](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fmeter.text),
  [user manual](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Ffd-hac.text),
  and [subsystem manual](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Ffd-sub.text).
- Symbolics, [Program Development Utilities, Genera 8](https://bitsavers.org/pdf/symbolics/software/genera_8/Program_Development_Utilities.pdf),
  Metering Interface and PC Metering chapters.
- Symbolics, [Genera 8.3 Software Installation Guide for the NXP1000](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_the_NXP1000.pdf),
  optional Metering system loading instruction.
- Local purchased Genera 8.5 source and recovered installed help identified by
  portable path, evacuated version, byte length, and SHA-256 above; not
  redistributed.

Last verified: 2026-07-18.
