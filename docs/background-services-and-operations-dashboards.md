---
type: Historical Article
title: Background services and operations dashboards on CADR and Genera
description: An implementation and interface dossier on CADR file-service processes and the Genera Mailer, Printer Spooler, Domain Server, and File Server operations programs.
tags: [mit-cadr, lm-3, genera, services, operations, mailer, print-spooler, domain-server, file-server]
timestamp: 2026-07-18T07:07:40-04:00
---

# Background services and operations dashboards on CADR and Genera

The two Lisp-machine families expose very different operator models. Early MIT
CADR software has background processes, notifications, who-line state, and
debugger entry, but no single service dashboard. System 46 is only a client of an
external PDP-10 file computer. The maintained LM-3 System 303 tree adds Lisp
Machine `FILE` and `LMFILE` servers, yet their normal operator surfaces remain
listener functions, the who-line, Peek, and a generic background-process window.

Genera instead packages several services with purpose-built Dynamic Windows
programs. The Mailer, Printer Spooler, Domain Server, and File Server each have a
log or operations frame, but the frame is not the service: it observes state and
dispatches commands to processes, queues, persistent files, network servers, and
device managers beneath it. Their common Server Utilities layer supplies
background task queues and a multi-destination logging framework.

This article documents that infrastructure grain completely: every source-defined
pane, direct private command, menu label, Select key, and directly relevant
`Mailer` or `Printer Maintenance` Command Processor command in the inspected
Genera sources; the LMFILE controls in the maintained file-computer manual and
the direct QFILE diagnostics named below; and the significant source/manual
disagreements. It does not inventory every inherited global command, every mail,
printer, or file protocol operation, hidden helper functions, or the ordinary
debugger command set.

## Evidence boundaries

| Boundary | Evidence | What it can establish |
| --- | --- | --- |
| MIT CADR System 46 | Public source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | The Chaos background process, background-stream notification model, and absence of a CADR-resident file server in this release |
| LM-3 System 303 | Maintained public Fossil tree at check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | The later `FILE` and `LMFILE` server processes, maintenance controls, connection records, error entry, and who-line integration |
| Symbolics Genera 8.5 | Licensed Open Genera source, installed Help decoded locally as evidence, and public Genera 8 manuals | The service/process architecture, exact frame and command definitions, defaults, logging behavior, and source/manual discrepancies |
| Runtime | Existing reviewed startup observations only | The preserved Genera world reports an unconfigured local site with servers disabled; none of these service programs was operated for this article |

The LM-3 tree is a maintained restoration, not evidence that all of its later
facilities existed in System 46. Likewise, a Genera source definition proves an
implementation was distributed, not that the optional system is loaded or that a
site has supplied the namespace objects, directories, queues, printers, or launch
files needed to run it.

## Service, process, log, and dashboard are different things

| Layer | Examples | Responsibility |
| --- | --- | --- |
| Network or device service | Chaos `FILE`, `LMFILE`, SMTP, DNS, printer queue | Accept a request or drive a device-facing operation |
| Worker process | Mail foreground/delivery/background processes, printer managers, one file-server process per connection | Own mutable work and wait states |
| Persistent operational state | Mail queue files, mailbox snapshots, printer request directories, log generations | Survive process or machine transitions where designed |
| Shared logging substrate | Server Utilities log monitor, host notification, log file, background rotation | Record and route events |
| Operations program | Mailer Operations, Printer Spooler Log, Domain Server Log, File Server | Present selected state and invoke operator commands |
| General diagnostic surface | who-line, notifications, Peek, debugger, listener | Observe or repair processes that have no dedicated program |

A blank or absent dashboard therefore does not prove a service is stopped, and a
displayed frame does not prove that its workers, network listeners, or persistent
state are healthy.

## CADR: processes and maintenance rather than dashboards

### System 46 has a Chaos background process, not a service console

System 46 creates a process named `Chaos Background`. Its queue receives forms in
FIFO order after a list reversal, runs timed retransmission and probing work, and
is part of the network substrate on which the QFILE client depends. The general
process top level directs output from windowless processes to a background stream.
This is infrastructure, not an application frame: the inspected source defines no
pane layout, command menu, or dedicated Select key for it.

The contemporary operations manual describes the visible recovery path. An error
or typeout from a process without an exposed window produces a notification.
`Terminal 0 S` selects the window that wants attention; `Terminal S` returns to the
previous window. This selection mechanism is generic and may choose any waiting
background or deexposed process. It is not a “Chaos dashboard.”

System 46 also does not contain the later Lisp Machine file servers. Its QFILE
code is a client of the `FILE` job on an ITS or TOPS-20 file computer. The server
side in this snapshot is PDP-10 MIDAS source. The architectural and protocol
details are documented separately in
[File systems and file service on CADR and Genera](file-systems-and-file-service.md#mit-system-46-qfile-and-the-external-file-computer).

### System 303 `FILE` server

The maintained `FILE-SERVER` system registers a Chaos `FILE` initializer. Each
accepted connection gets a process named `File Server` and private bindings for
its control stream, openings, data connections, transaction identifier, protocol
version, user, and server tag. The server:

- rejects incompatible Symbolics connections and unsupported protocol versions;
- adds the live connection to the file-state who-line sheet;
- reads and dispatches commands until EOF, close, or network failure;
- removes the who-line entry, abort-closes remaining openings, and tears down
  data connections during unwind cleanup.

The source retains errors as records in `LMFS-SERVER-LOSSAGES` containing time,
operation identifier, report text, and remote Chaos host. The direct
source-level operator/diagnostic entry points at this article's grain are:

| Entry point | Arguments/defaults | Effect |
| --- | --- | --- |
| `TRACE-SERVER` | Optional on/off value, default true | Enable or disable capture of control-command strings |
| `LMFS-DEBUG-SERVER` | Variable, default false | When true, new server processes do not trap most errors, preserving debugger entry |
| `LMFS-SERVER-DONT-ANSWER-LOGINS` | Variable, default false; a true value is used as the rejection reason | Refuse new logins while letting the listener return an explicit host-unavailable response |
| `FILE-SERVER-SHUTDOWN` | Message; optional minutes default 5 | Schedule warnings and server shutdown |
| `FILE-SERVER-CANCEL-SHUTDOWN` | Optional internal key default cancel | Cancel the schedule |
| `FILE-SERVER-RESCHEDULE-SHUTDOWN` | Message; optional minutes default 5 | Replace the current schedule |
| `FILE-SERVER-SHUTDOWN-STATE` | None | Return current message and scheduled time |
| `SET-SERVER-PRIORITY` | Nonpositive priority | Change processes whose names contain “File Server”; positive priority is rejected |

These are Lisp functions or variables, not a visible command table.

Live server details also feed the file-state who-line and a Peek server
presentation. That is a monitoring surface, but still not a dedicated operations
frame. See [Peek](mit-cadr/peek.md) for the general program and
[Error handler and debuggers](mit-cadr/error-handler-and-debuggers.md) for the
debugger rather than treating either as part of the file server.

### System 303 `LMFILE` server

The declared `LFS` system has an `LMFILE-SERVER` component whose active module is
`file2/server.lisp`. The similarly named `file2/xserver.lisp` is an alternate
preserved file and is not the module selected by the inspected system declaration.

`ENABLE-FILE-SERVER` adds a Chaos `LMFILE` server initializer. A connection creates
an `LMFILE server` process, parses the user and first command from the RFC,
records `(user, host, time)` in `LMFILE-SERVER-CONNECTION-RECORD`, opens that
user's file area where supported, and adds a who-line server entry. Unwind cleanup
closes the connection, removes the who-line entry, closes the file area, and may
free cached areas. Disk-full and disk-unfull conditions send explicit lossage and
recovery messages to the remote client.

The maintained `file2/maint.text` describes the complete network-service
maintenance surface at that document's grain:

| Control | Arguments/defaults | Effect |
| --- | --- | --- |
| `BRING-UP-SERVER` | Normally no argument; an internal warm-boot flag exists | Stops/reloads/restarts the file-computer environment and then enables its services |
| `ENABLE-FILE-SERVER` | Optional local host, default `LFS-HOST` | Adds the `LMFILE` listener initializer |
| `DISABLE-FILE-SERVER` | None | Removes the `LMFILE` contact from the Chaos server alist; it does not itself kill already existing connections |
| `ENABLE-MAIL-SERVER` | None documented | Enables the separate file-computer mail server |
| `DISABLE-MAIL-SERVER` | None documented | Disables that separate mail server |
| `PRINT-SERVER-CONNECTIONS` | None | Prints the connection record accumulated since boot |
| `FILE-QSEND` | Minutes, default 60; a non-number means all records since cold boot; then reads a message | Sends a notice to distinct recent users, reporting delivery results |
| `TV:CLOSE-ALL-SERVERS` | Reason string | Closes extant servers and sends the reason to remote machines |
| `Terminal 0 S` | Keyboard gesture | Selects the oldest window/process waiting for attention; for an errored LMFILE process the manual names the resulting window “LMFILE Server Background Window” |

The mail-server enable/disable calls are included because the file-computer boot
procedure invokes them beside the file server. They do not imply a ZMail-like mail
operations dashboard.

The background window is an error-handler entry into a dead server, not a status
screen. The maintenance text explicitly warns against simply aborting a process
that might hold a node lock or be midway through a structural update. If the
operator cannot establish a safe continuation, clearing and restarting the file
system is the documented last resort. `Terminal 0 S` also cycles through unrelated
windowless/deexposed processes in attention order, so even its target is not
file-server-exclusive.

### CADR visible-surface inventory

At the stated infrastructure grain, neither inspected CADR release defines a
file-service command menu or multi-pane dashboard:

| Release/facility | Dedicated panes | Dedicated menu | Dedicated Select key | Visible state/control |
| --- | ---: | --- | --- | --- |
| System 46 Chaos background | 0 | none | none | Notifications and generic `Terminal 0 S` background-window selection |
| System 46 QFILE | 0 | none | none | Client progress in the who-line; server is external |
| System 303 `FILE` server | 0 | none | none | File-state who-line, Peek server detail, notifications, debugger, listener diagnostics |
| System 303 `LMFILE` server | 0 | none | none | Who-line entry, connection report, listener controls, generic `Terminal 0 S` error window |

This absence is itself a lineage result: the Genera programs below are later
operations interfaces, not renamed System 46 applications.

## Genera Server Utilities: shared process and log machinery

The `SERVER-UTILITIES` system loads background tasks, logging, filesystem helpers,
UID and stable-object support, then a filesystem-server subsystem containing
server errors, shared server support, NFILE, and QFILE. Mailer, Print Spooler,
Domain Server, and File Server code all use portions of this substrate.

### Background task queues

A Server Utilities background task stores a name, function, interval, and
last-run time. A queue has its own polling period and task list. On process start,
all tasks are made immediately due; after that, a task runs only when elapsed time
is greater than its interval.

The shared `Server Utilities Background` process polls every two minutes. Two
standard tasks are registered by the logging layer:

| Task | Requested interval | Purpose |
| --- | --- | --- |
| Reset Log Window Histories | 30 minutes | Trim active log-window output history |
| Finish Log Files | 5 minutes | Flush pending file output and rotate a log that exceeds its size limit |

A requested task interval cannot make this queue wake more often than its
two-minute polling period. This becomes an observable source/manual concern for
the Mailer frame below.

### Logging destinations and state

`LOG-EVENT` accepts exactly four event types: `:normal`, `:problem`,
`:disaster`, and `:debug`. Debug entries are conditional on the log's debugging
flag. Mixins independently send one event to:

- the in-memory/display history;
- an optional rotating file;
- configured remote hosts through notification;
- the local notification system for problem and disaster events;
- an interactive typeout destination when a command requests it.

If a monitor pane is locked—for example by a menu—the event is not written to the
pane. The mixin counts such losses and reports the count when output resumes. By
default, the shared background task keeps approximately the latest 500 lines of
on-screen history. This does not truncate the associated log file.

File logs default to 450,000 characters per generation and use a default
generation-retention count of 10. Rotation also reaps and expunges the log
directory. The five-minute finisher handles ordinary flushing, a file server that
closes the stream asynchronously, and filesystem/network errors. Warm-boot
cleanup forcibly unlocks log objects, detaches old streams, and closes them in
another process; before a cold save, open log files are closed.

One implementation limit is especially important to preservation work:
`LOG-EVENT` silently does nothing until the window system's initialization flag is
set. The source calls this a quick fix and identifies warm-booting a MacIvory with
the print spooler already running as the known case. A missing early entry is
therefore not proof that the event did not happen.

## Mailer Operations / Store-and-Forward Mailer

### Identity and purpose

Three names refer to the same operational family:

- the loadable system's pretty name is `Mailer`;
- its bug-report system is `Store-and-Forward Mailer`;
- the Dynamic Windows program's pretty name is also
  `Store-and-Forward Mailer`, while the installed manual calls the visible frame
  `Mailer Operations`.

The Mailer receives messages, maintains local and remote delivery state, resolves
hosts and mailboxes, retries deferred or failed work, and optionally hardcopies
selected users' mail. The operations program is its status, log, and command
surface; it is not a mail reader. User-facing message reading and composition
belong to [ZMail](genera/zmail.md).

### Processes, queues, and durable state

The source divides work among a foreground process, a background process, optional
delivery processes, an optional slow-delivery process, and transient receipt work.
The shipped defaults enable delivery processes, request one delivery process, and
enable the slow-delivery process. If no slow network is present, the source declines
to create that special process.

The foreground startup list runs, in order: log monitor, options, directory, log
file, Dialnet registry where applicable, breathing room, UID, queues, mailboxes,
hosts, and messages. A cold `Start Mailer` reconstructs that environment from
persistent files; the source-only `RESTART-MAILER` function selects warm recovery.
The operations menu does not expose a separate Restart command.

The Mailer uses a rejection-slip object to explain why incoming service is
temporarily unavailable:

| State transition | Source behavior |
| --- | --- |
| Start | Marks the service uninitialized while restoring state, creates/enables workers, then clears the rejection slip |
| Suspend | Marks manual suspension, installs an operator rejection reason, and sends `:stop` to all Mailer processes at their command checkpoints |
| Resume | Requires an active suspended Mailer, clears the suspension and rejection slip, and sends `:start` |
| Halt | Rejects new incoming work, waits for receipt processes, sends `:halt`, waits for workers, and closes the log |
| Program error during startup | Retains a program-authored rejection reason and records a disaster instead of claiming that service is operational |

The three concrete queues are Incoming, Outgoing, and Slow. The display also
computes Active and Retransmit pseudoqueues: Active counts messages currently held
by foreground/delivery workers, while Retransmit counts queued host messages not
already represented by those states.

Mailer storage has static, dynamic, log, and hardcopy directories. It reserves a
200,000-byte “breathing room” file. A coordinated no-more-room handler can delete
that reserve, expunge the dynamic directory, and retry the failed operation; this
is a failure-survival mechanism absent from the manual's high-level window
description.

### Mailer background schedule

The Mailer owns a private queue polled once per minute:

| Task | Interval | Work |
| --- | ---: | --- |
| Message retransmission | 10 minutes | Probe hosts, then requeue messages whose destinations can be retried |
| Deferred delivery | 10 minutes | Deliver at configured times or intervals, grouping work for costly connections |
| Deferred receipt | 10 minutes | Probe configured hosts that require the Mailer to initiate receipt |
| Resolve hosts | 20 minutes | Revisit hosts that could not previously be resolved |
| Process mailbox table | 15 minutes | Detect and process forwarding/mailbox-table work |
| Return mail for undeliverable hosts | 4 hours | Find queued mail that has exceeded delivery policy |

These six registrations are the complete set targeting
`*MAILER-TASK-QUEUE*` in the inspected Mailer source tree.

### Complete pane and selection inventory

`Select O` invokes the Mailer selector, registered with the label `Mailer`. The
source defines six panes:

| Pane | Type | Visible role |
| --- | --- | --- |
| Title | title | One-line program title |
| Log | display | Scrollable operational log, occupying half the main layout |
| Processes | redisplaying display | Current Mailer process summary |
| Queues | redisplaying display | Incoming, Outgoing, Slow, Active, and Retransmit summaries |
| Listener | listener | Typed commands and command output |
| Commands | command menu | Clickable direct Mailer commands |

The manual describes five functional panes—Log, Processes, Queues, Commands, and
Mailer Listener—because it does not count the title strip. That is consistent with
the six source pane objects.

The private command table inherits no other table and disables keyboard
accelerators. Thus the complete direct VLM command inventory is the following 15
commands:

| Command/menu label | Arguments and defaults | Operational effect |
| --- | --- | --- |
| Start Mailer | None | Cold-start the environment and workers |
| Halt Mailer | None | Refuse new incoming work, drain receipt work, halt workers, close log |
| Suspend Mailer | None | Stop workers at command checkpoints without destroying their state |
| Resume Mailer | None | Clear suspension and restart existing workers |
| Summarize Mailer Processes | None | Print the same process summary used by the status pane |
| Summarize Mailer Queues | None | Print the same concrete and pseudoqueue summary used by the status pane |
| Probe Hosts | Host sequence or `All`; default `All`; confirmation required | Probe selected destination hosts and immediately retry queued mail where applicable |
| Clear Log History | None | Clear both the Log pane and Listener histories |
| Switch Log Files | None | Close and reopen the Mailer file log; command-errors if no file is open |
| Disable Debugging | None | Stop accepting debug log entries |
| Enable Debugging | `Protocol Debugging` boolean, default Yes | Enable debugging and optionally include protocol-specific entries |
| Resolve Hosts | Unresolved Mailer-host sequence or `All`; default `All`; confirmation required | Re-resolve the selected host objects |
| Update Mailbox Table | None | Reprocess mailbox/forwarding definitions |
| Update Options | None | Reread and apply Mailer options |
| Hardcopy Mail | Users or `All`, default `All`; `Quantity` New/Last/All, default New and mentioned-default Last; `Printer` default system text printer | Print the selected generation of stored mail |

A sixteenth source definition, `Reload Subnet File` with no arguments, is guarded
by `#-VLM`. It is not part of the Open Genera/VLM menu and reloads the Dialnet
registry on other machine types.

### Relevant `Mailer` Command Processor area

The `Mailer` Command Processor table is a subset of `Site Administration`. At the
article's direct-definition grain it contains one command:

| Command | Arguments/defaults | Effect |
| --- | --- | --- |
| Show Expanded Mailing List | Address sequence; `All Levels` boolean default No and mentioned-default Yes; optional `Matching` string sequence | Expands and sorts addresses, optionally recursing through all levels and filtering displayed results |

Address presentations also translate to this command. Presentation translators
are invocation paths, not additional commands.

### Manual cross-check and source-only findings

The installed `netio17` Help lists the same 15 VLM commands and the same five
functional panes. It also explains the five queue labels. Three details require
source evidence:

1. The manual says `Clear Log History` clears the Log pane. The implementation
   clears both Log and Listener history.
2. The program registers a shared “Log frame update” background task with a
   ten-second interval, but the shared queue wakes only every two minutes. The
   process and queue panes therefore cannot be refreshed by that task every ten
   seconds; the effective background wake cadence is no faster than two minutes.
3. Cold Start and warm Restart are distinct source paths, but only Start appears
   in the direct operations command table.

## Printer Spooler Log

### Identity, workers, and persisted requests

The `PRINT` system's pretty name is `Print Spooler`. Its serial modules load log,
request, printer-manager, printer-queue server, and device/backend support. The
visible program's pretty name is `Printer Spooler Log`.

Starting the spooler waits until the window system is initialized, initializes a
new log, reads the local host's spooled-printer objects, creates or reuses one
printer manager per supported printer, and enables those manager processes.
Requests and per-printer stable queue/policy/characteristic state live under a
printer-specific `>Print-Spooler>` directory. Halting sends shutdown to every
manager and closes the log; it does not erase queued requests.

The `:printer-queue` service enable hook starts the spooler only when the local
host has at least one spooled printer and advertises Hardcopy service. Startup and
shutdown are spun into separate processes because an embedded host can enable
services before window initialization.

Each printer manager has exactly six declared states:

| State | Meaning in source |
| --- | --- |
| `:uninitialized` | Manager is not ready to accept new queue entries |
| `:booting` | Device/queue restoration is in progress |
| `:crashed` | An unhandled manager error was recorded |
| `:suspended` | Operator or intervention has halted the manager |
| `:idle` | Manager is ready and waiting for a request |
| `:printing` | A request is being printed |

The manager separately tracks device state, so a spooler can be logically idle or
printing while the device reports an operational, intervention, or irrecoverable
condition. A top-level error moves the manager to `:crashed` and logs a disaster.

### Complete program surface

`Select S` is registered with label `Print Spooler`. The source defines three
panes and no title pane:

| Pane | Type | Visible role |
| --- | --- | --- |
| Log | display | Scrollable job, manager, device, and service log |
| Command Menu | command menu | Margin label `Printer Log` |
| Listener | listener | Prompt `Print Spooler command: ` and command output |

The command table inherits only `Global`. Source lines for `Colon Full Command`,
`Standard Arguments`, and `Standard Scrolling` are present but commented out.
Keyboard accelerators are disabled.

There are exactly two direct program commands, both argumentless:

| Source command/menu label | Effect |
| --- | --- |
| Start Print Spooler | Initialize log and start/reuse local printer managers |
| Halt Print Spooler | Shut down all managers and close the spooler log |

### Complete direct `Printer Maintenance` area

`Printer Maintenance` is a subset of `Site Administration`. Its three direct
commands are:

| Command | Arguments and defaults | Operational effect |
| --- | --- | --- |
| Halt Printer | Printer defaults to the default text printer; `Confirm` defaults Yes; `Urgency` ASAP/After Current Request/After Next Copy defaults ASAP; `Starting From` number defaults 0 but source says unused; `Disposition` Restart/Hold/Delete defaults Hold; generated operator reason | Suspends the controller immediately or after the requested extent, with a race-safe check that the confirmed request is still printing |
| Start Printer | Printer defaults to the default text printer | Resumes a suspended printer controller |
| Reset Printer | Printer defaults to the default text printer; `Confirm` defaults Yes; `Disposition` Restart/Hold/Delete defaults Hold; generated operator reason | Resets the controller and applies the requested disposition to a still-current request |

Printer and printer-request presentations translate to these commands. Ordinary
`Printer` queue/request commands are a different user surface and belong with the
printing pipeline rather than this operations-dashboard inventory.

### Manual cross-check and source-only findings

The installed Printer Installation Guide agrees on `Select S`, the log/prompt
division, startup semantics, persistence of queued requests while halted, and
reprinting of a request interrupted by spooler shutdown. It disagrees in two
visible details:

1. The guide calls the menu item `Stop Print Spooler`. The inspected source
   defines and labels it `Halt Print Spooler`.
2. The guide says the prompt accepts all commands normally found in a Lisp
   Listener. The inspected private command table inherits only `Global`, with
   the broader command tables commented out. Runtime is needed to determine the
   exact effective inherited command set in this world.

The printer manager also marks one logging attribution as knowingly inaccurate:
the fixed process identifier used for Printer Queue Server access-path logging is
unrelated to the actual sending process. A log's process tag should therefore not
be treated as reliable process provenance for that path.

Finally, the common Server Utilities pre-window loss rule applies despite the
spooler's explicit waits. The shared logging source specifically names a warm
boot with an already-running print spooler as its known early-loss case.

## Domain Server Log

### Identity and service architecture

The loadable system is `DOMAIN-NAME-SERVER` with patch atom `IPDS`; its only
serial module is the domain-server implementation. The visible program is
`Domain Server Log`.

The same request handler is exposed through two network servers:

| Service | Medium | Server flavor |
| --- | --- | --- |
| `:domain` | Reliable byte stream | Domain byte-stream server |
| `:domain-simple` | UDP | Domain UDP server |

The handler logs requests and responses, answers ordinary queries with optional
recursion, handles authority transfer, refuses inverse queries, and marks unknown
opcodes not implemented. Errors generate an automatic bug report and a log entry;
an error in one query is translated into server failure for that response.
Returned authoritative TTLs are capped at six hours by the inspected server.

`Launch Domain Server` first lands the old instance. Unless an internal override
is supplied, the local host must advertise Domain service. The launch file
supports four active record types:

| Launch tag | Meaning |
| --- | --- |
| `Domain` | Declare a domain for which this server has responsibility |
| `Primary` | Load a local domain-data file for the named origin |
| `Secondary` | Queue transfer of a zone from the named host/address |
| `Dialnet` | Load a Dialnet registry for an origin |

Launch initializes/reinitializes the resolver, enables the handler flag, and
starts `Domain Server Background`. Secondary transfers are scheduled every 60
minutes; a failed transfer is retried after 15 minutes.

### Complete program surface

`Select @` is registered with label `Domain Server Log`. Its private command
table inherits `Colon Full Command`, `Standard Arguments`,
`Standard Scrolling`, and `Global`; keyboard accelerators are disabled.

The four source panes are:

| Pane | Type | Visible role |
| --- | --- | --- |
| Title | title | Fixed text `Domain Server` |
| Log | display | Scrollable history labeled `Domain Server Log` |
| Command Menu | command menu | Labeled `Domain Server Commands` |
| Listener | listener | Typed inherited or direct commands and output |

The four direct commands are:

| Menu label / command | Arguments and defaults | Effect |
| --- | --- | --- |
| Load / Load Domain File | Required pathname; confirmed origin string | Initialize the monitor and load one domain file as that origin |
| Clear / Clear Log History | None | Initialize the monitor and clear only the Log pane's history |
| Launch / Launch Domain Server | Pathname default `SYS:SITE;LAUNCH-DOMAIN-SERVER.TEXT` | Initialize the monitor and launch, complaining if service is not enabled |
| Land / Land Domain Server | None | Kill the background process, clear its work queue, and mark the handler disabled |

### Manual cross-check and source-only findings

The installed Networks and Site Operations Help documents the launch file,
domain-data files, namespace service attribute, and primary/secondary roles. No
matching Help section for the four-pane `Domain Server Log` program or its four
commands was found in the inspected installed documents. The visible inventory
above is therefore source-derived and remains a runtime TODO.

Two source details materially qualify the operator model:

1. `LAND-DOMAIN-SERVER` contains a call to disable network services, but that call
   is commented out. Landing kills background transfer work and clears the
   enabled flag; it does not itself unregister the byte-stream or UDP server
   definitions. A request reaching the still-registered handler while disabled
   receives a refused response.
2. The log object includes the file-log mixin, but the program constructs it with
   a null directory and this module contains no call to open a log file. The
   inspected implementation establishes an on-screen monitor; it does not by
   itself establish persistent Domain Server log generations.

A large earlier namespace-maintenance section in the same source file is inside a
block comment and labels that maintenance unavailable. It is lineage evidence,
not an active command surface.

## File Server program

### Purpose and process relationship

Genera's File Server program observes NFILE/QFILE-family service activity, errors,
and scheduled shutdown state. It uses the same shared server utilities as the
network handlers. It is not a file browser, directory editor, or storage
implementation; those layers are covered in
[File systems and file service](file-systems-and-file-service.md#the-genera-file-server-program).

One log object can be associated with each host being served. Server errors are
retained with time, operation key, condition type/report, user, host, and protocol,
then displayed in the error pane. The status pane currently redisplays only
whether shutdown is scheduled and, if so, its time and message.

At shutdown time the implementation logs and broadcasts warnings, disables
services, closes active file servers, waits for bounded cleanup, and leaves the
status state clear. The schedule is therefore an operationally broad service
action, not merely a frame-local timer.

### Complete program surface

The source's direct `Select &` registration is commented out following a recorded
UI review decision. The supported entry is `Select Activity` with argument
`File Server`.

There are six source pane objects:

| Pane | Type | Visible role |
| --- | --- | --- |
| Title | title | Fixed text `File Server` |
| Log | display | Access and service events, labeled `File Server Log` |
| Command Menu | command menu | Labeled `File Server Commands` |
| Status | redisplaying display | Scheduled-shutdown state, labeled `File Server Status` |
| Errors | display | Retained server errors, labeled `File Server Errors` |
| Listener | listener | Typed commands and command output |

The manual's “five smaller panes” is consistent if the title strip is excluded.
The source command table inherits `Colon Full Command`, `Standard Arguments`,
`Standard Scrolling`, and `Global`.

The complete direct source command inventory is three:

| Menu label / command | Arguments and defaults | Effect |
| --- | --- | --- |
| Shutdown File Server / Schedule File Server Shutdown | Minutes, nonnegative integer default 5; confirmed message string | Schedule shutdown and warnings |
| Cancel File Server Shutdown | None | Cancel an existing schedule |
| Reschedule File Server Shutdown | Minutes, nonnegative integer default 5; confirmed message string | Replace the existing time/message |

### Manual/source discrepancy

The installed File Server Activity Help lists five menu commands: the three above
plus `Set User Password` and `Remove User Password`. A complete search of the
inspected licensed source tree found no direct definitions of those two password
commands. This does not prove the manual is stale: they may live in an omitted
LMFS/access-control component or be generated elsewhere in a complete native
world. It does prove that this Open Genera source distribution does not support a
high-confidence claim that the five-item menu will appear. A configured runtime
must resolve the discrepancy.

## Cross-system source findings not evident from the manuals

| Finding | Evidence class | Consequence |
| --- | --- | --- |
| CADR service errors reuse generic background-window selection | Source plus contemporary/manual maintenance text | `Terminal 0 S` is an attention queue, not a service selector or dashboard |
| System 303's declared LMFILE server uses `file2/server.lisp` | System declaration | The alternate `xserver.lisp` must not silently stand in for the active maintained implementation |
| Shared Genera log calls before window initialization are lost | Licensed source | Absence from a log pane/file can be an instrumentation gap |
| Locked Genera log panes count and later report missed monitor entries | Licensed source | On-screen history is not necessarily a complete event record |
| Mailer requests a ten-second frame update on a two-minute polling queue | Licensed source | Background status refresh is coarser than the task label implies |
| Mailer Clear Log History also clears Listener history | Licensed source versus Help | The command has a broader visible effect than documented |
| Printer manual says Stop; source says Halt | Licensed source versus Help | The exact menu label requires runtime adjudication |
| Printer queue-server process tag is known inaccurate | Licensed source comment and implementation | Do not use that tag as reliable per-event process attribution |
| Domain Land does not unregister service definitions | Licensed source | Landing stops work but is not identical to disabling network service |
| Domain log monitor is not shown opening a file log | Licensed source | Do not claim persistent Domain log files without runtime/configuration evidence |
| File Server Help lists two password commands absent from inspected source | Licensed source versus Help | Menu completeness is unresolved for this distribution |

## Runtime status, screenshot blockers, and exact TODOs

No new emulator session was started for this article. The Genera VLM slot was
reserved by the coordinating documentation run, and the existing reviewed startup
observation already establishes that the exact world is not configured for its
local site and has servers disabled. Starting these services merely to obtain a
picture would be misleading and would mutate operational state:

- Mailer startup expects site mail options, mailbox definitions, writable queue
  directories, and network service identity.
- Print startup expects local spooled-printer namespace objects, a supported
  printer manager/backend, and writable request/log directories.
- Domain startup expects the local Domain service attribute, resolver/site data,
  and a launch file; secondary operation would attempt network transfers.
- File Server operation changes service exposure and writes logs; its password
  discrepancy may depend on omitted native LMFS components.

The harness's isolated network also has no appropriate historical mail, printer,
DNS, or file-service peer. A frame instantiated without those dependencies could
verify geometry and labels, but not the service states described here.

The CADR blocker is different. System 46 has no dashboard to capture. For System
303, the named LMFILE background window appears only after a server has died with
an error. Reaching it responsibly requires a disposable, configured LMFILE disk
and a controlled client transaction; deliberately wedging a server on the current
preservation disk could leave node locks or half-updated structures. Normal `FILE`
and `LMFILE` status would require enabling listeners and a private Chaos client.

The required future runtime work is therefore:

1. Build disposable CADR file-computer media, enable `FILE` and `LMFILE` only on
   a private Chaos network, capture the who-line/Peek states, and separately induce
   a known-safe error to verify `Terminal 0 S` selection and the exact background
   window label.
2. Build a disposable Genera site with synthetic users/hosts, Mailer options and
   empty queues; verify all six panes, the 15-command VLM menu, Select O, refresh
   cadence, and the two-history Clear behavior.
3. Configure a synthetic spooler/printer backend; verify Select S, the three-pane
   layout, `Halt` versus `Stop`, effective listener inheritance, manager states,
   and request persistence over halt/start.
4. Configure an isolated Domain service and local primary-only launch file; verify
   Select @, all four panes/commands, Land behavior, and whether any external
   initialization adds persistent logging.
5. Configure File Server on disposable storage; verify Select Activity, the
   six-pane source layout, and whether password commands are supplied by runtime
   components absent from the inspected source.

Until those runs exist, this page intentionally contains no screenshot. That is an
explicit runtime/configuration blocker, not an inference that the interfaces are
invisible or unpublishable.

## Screenshot and preservation rights

Any future captures must remain in the ignored harness session trees until
reviewed under
[Publishing runtime screenshots for museum documentation](screenshot-publication-rights-review.md).
A publishable service screenshot should use a sterile synthetic site and show only
the minimum frame state needed for the historical claim. In particular it should
not expose real user names, mail addresses or message text, queued documents,
printer jobs, network addresses, credentials, file names from private storage, or
substantial Help text.

A limited interface screenshot used beside analysis can be reviewed as a
scholarly runtime observation. That review does not authorize publication of
Mailer queue files, log generations, domain data, proprietary source, extracted
icons/fonts, or other licensed payloads. CADR public-source status likewise does
not automatically settle the rights in every message, file, or third-party object
that might appear on screen.

## Reproducible evidence records

### Public CADR inputs

The System 46 files are from Git commit
`8e978d7d1704096a63edd4386a3b8326a2e584af`:

| Portable path | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `src/lmio/chsncp.161` | 77,787 | `71bfa07a1633866784acd274c0c0ed5382dc0754e2b4ec903094fda5c7706c05` | Chaos background queue and timed process |
| `src/lmwin/proces.48` | 22,771 | `ac5f450b62f4f4336a163f541a36aeb7905caa44b2deb4d508faf05d0d31c5a6` | Generic process/background-stream top level |
| `src/lmwind/operat.27` | 85,337 | `a5ab658210dc09891b0886b58af705368e33a41f013073c8b9a637d99ab0f02d` | Contemporary notification and selection manual |

The LM-3 files are from Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`:

| Portable path | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `file/server.lisp` | 59,760 | `729937a18a7f53a69e83ff20ab9a694012a9869109b699cdc2903e9c4e183107` | Maintained QFILE/`FILE` connection process and diagnostics |
| `file2/system.lisp` | 1,319 | `102b0ec8a6f0d8bf903ec24cd894d771b5d317b843119acbdd0e2d57a889f8c8` | Declares `file2/server.lisp` as the active LMFILE server |
| `file2/server.lisp` | 33,798 | `f21af69317d6c08f1471727027c70314f975fba0249af592015d2469ca904647` | Maintained LMFILE connection process and operator helpers |
| `file2/maint.text` | 35,455 | `9952293f4b01e65d85f1770e81f8370308d42ac29cbacc1c44cb6f32b8a87362` | File-computer boot, network controls, and error recovery |

### Licensed Genera source inputs

The licensed source tree is anchored by `opengenera2.tar.bz2`,
206,213,430 bytes, SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
Paths below are portable within its `og2` tree; no proprietary source text is
reproduced here.

| Portable path | Bytes | SHA-256 | Evidence role |
| --- | ---: | --- | --- |
| `sys.sct/server-utilities/sysdcl.lisp.~42~` | 4,455 | `29e6ef832060eb9d182c0888acb6d02e0069f5123bbe34f5b27bc90482e2d0bc` | Shared system/subsystem lineage |
| `sys.sct/server-utilities/background-tasks.lisp.~1505~` | 6,343 | `e62de3c2f4fb7c40ce0679f4d818246650168e1fdccc21b189d5dd6338cbca11` | Task queue and polling semantics |
| `sys.sct/server-utilities/log.lisp.~1540~` | 25,492 | `32befb82dbab8d9bac2cae15f5f80c1092cb19ff93836f3376b33ad53c4c0c8c` | Event types, monitor/file/notification behavior |
| `sys.sct/mailer/system.lisp.~76~` | 3,802 | `7e7a7aaaddd478a2da0b7a29ab811705b934e15df044d2106e92d4e780695fd9` | Mailer identity and module lineage |
| `sys.sct/mailer/log.lisp.~1536~` | 15,612 | `8595865d6cd2f1bc3c0c0459f0324bab19177bc1cffa4ff170c8ecca0b138bb3` | Frame, Select key, log behavior, 14 VLM log commands |
| `sys.sct/mailer/hardcopy.lisp.~1512~` | 13,142 | `2996f5b7bc83d3d4c37a009736c3e45bf5c6e04e7f8ac47459ef1606d6d76663` | Fifteenth VLM command and arguments |
| `sys.sct/mailer/toplevel.lisp.~1560~` | 44,419 | `c1c1fb9c67fabd03932cee1b21f0e18265ec0e70d3f02818e0e846a93b50777d` | Processes, lifecycle, tasks, service hooks |
| `sys.sct/mailer/queue.lisp.~1508~` | 8,741 | `57a8585bc0700caa3c267452e942c115958040abecbcedccc87b84dd97387705` | Concrete and pseudoqueue summaries |
| `sys.sct/print/sysdcl.lisp.~23~` | 3,492 | `8a399c4bf7c7011f73c8fcd153443bccb42dde816baaf27566808cae1a3243fb` | Print system identity and modules |
| `sys.sct/print/log.lisp.~1520~` | 7,856 | `51d991f661d125fe392fa08f6b711f913e04d76d946dd8d0c34c1f535a3472a0` | Printer Spooler frame, Select key, two commands |
| `sys.sct/print/printer-manager.lisp.~1558~` | 55,907 | `fa34e1ab7736a2e6ec935b6550fdb94c12f52d20c1997abe028976933545cd00` | Manager state machine, start/halt, service hooks |
| `sys.sct/hardcopy/defs.lisp.~1519~` | 16,767 | `14c3b2c1a266fe0263aa4b323216fc075f38395180b2d62eba484ddd17b7588e` | `Printer Maintenance` command-area lineage |
| `sys.sct/hardcopy/printer-queue-user.lisp.~1542~` | 68,274 | `578226d509ac6bd1fab9188ce11c9ff788c21c6ae8c65268430d0da85c3e892c` | Three maintenance commands and presentation translators |
| `sys.sct/ip-domain-server/sysdcl.lisp.~19~` | 3,480 | `a2cd215cff645305e7cea88e11e7fa014205d3030f45f1aef1082040a4343eb3` | Domain system identity |
| `sys.sct/ip-domain-server/domain-server.lisp.~4044~` | 54,420 | `04e7ff791e5b7b0c5d52cecc61f3ecbde768a748323eea5a72d02ca08d71fda3` | Domain services, frame, four commands, launch/background behavior |
| `sys.sct/io/server-util.lisp.~1532~` | 26,867 | `709d50ae10458950563fe272e57f6eec5880bad7244305c7696eb20b8cef4fdb` | File Server frame, shutdown commands, errors/status |
| `sys.sct/zmail/definitions.lisp.~1552~` | 98,226 | `f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6` | `Mailer` Command Processor subset |
| `sys.sct/zmail/commands.lisp.~1600~` | 120,174 | `4b00879c28268561def2e2ee34a34026f73aca9dc8f5a4cb6077a66af342adf1` | Direct mailing-list command |

### Installed Help inputs

Decoded text remained under the ignored Genera Help build tree. These source SAB
objects identify the licensed inputs used for manual cross-checking:

| Portable source object | Bytes | SHA-256 | Subject |
| --- | ---: | --- | --- |
| `sys.sct/doc/installed-440/netio/netio17.sab.~36~` | 181,834 | `b5f7cb7b0084727d3c6dac53fa2b05896341220b8c4378532621b36f25942ef1` | Mailer Operations |
| `sys.sct/doc/installed-440/pig/pig.sab.~60~` | 436,655 | `fa2dc8d4dfaefcd03e1a4872edf560411864c431c7b6fc4675a774a67cf352e4` | Printer installation and spooler control |
| `sys.sct/doc/installed-440/netio/netio10.sab.~40~` | 64,794 | `fe40b49438431ecf17cbc4d575b5e3f01196e6da94dfd7d4aec8c3eb5dd0ed28` | Domain systems and launch files |
| `sys.sct/doc/installed-440/file/acls.sab.~26~` | 181,567 | `53bf2abeab085bb772ebddf93018d30dd6df3f2c84e205fd9fd5f814530e6355` | File Server Activity and access control |
| `sys.sct/doc/installed-440/site/site6.sab.~38~` | 19,292 | `d13b8565d2a6f89f7ddbe79ea8e96305f2d2fd665e9d82ffa2565ce248931ba7` | Mail-site setup and Select O |
| `sys.sct/doc/installed-440/site/site9.sab.~33~` | 112,398 | `fc719d4a16f605d9150bb69fbfcc0edb66df74770bf376434d6348bd17d08b07` | Domain-site operations |

## Open questions

- Does the preserved VLM world supply `Set User Password` and
  `Remove User Password` through a loaded component absent from the source tree?
- Does its Printer Spooler menu say `Halt` as source specifies, or `Stop` as the
  installed guide states?
- Which inherited commands are actually accepted at the Printer Spooler prompt?
- Does any site initialization outside `domain-server.lisp` assign a Domain log
  directory and open a persistent file?
- What exact process/status strings and pane update cadence appear under real
  Mailer load rather than source-level timing analysis?
- Which maintained LM-3 file-server components are present in the System 303 load
  band, and which require an explicit load before a disposable runtime study?

## Sources

- MIT CADR System 46,
  [Chaos networking source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsncp.161),
  [process source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwin/proces.48),
  and [operations manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmwind/operat.27).
- LM-3 project, maintained System 303
  [`FILE` server](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file%2Fserver.lisp),
  [LMFILE system declaration](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fsystem.lisp),
  [LMFILE server](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fserver.lisp),
  and [maintenance text](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fmaint.text).
- Symbolics, [`Networks`](https://bitsavers.org/pdf/symbolics/software/genera_8/Networks.pdf),
  for Mailer, Domain, and network-service administration.
- Symbolics, [`Site Operations`](https://bitsavers.org/pdf/symbolics/software/genera_8/Site_Operations.pdf),
  for server-machine and site-administration context.
- Licensed Symbolics Genera 8.5 source and installed Help artifacts identified by
  hashes above; inspected locally without publishing proprietary source or Help
  text.

Last verified: 2026-07-18.
