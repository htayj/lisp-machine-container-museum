---
type: Artifact Analysis
title: RPC, embedding, UX, and Macintosh integration
description: Source-, manual-, Help-, and runtime-grounded dossier on Genera RPC, host embedding, UX and MacIvory support, Keyboard Control, HyperCard and Mac-Dex integration, and the CADR UNIX-interface boundary.
tags: [mit-cadr, lm-3, genera, rpc, xdr, embedding, ux, macivory, keyboard-control, hypercard, mac-dex, dbfs]
timestamp: 2026-07-18T12:07:17-04:00
---

# RPC, embedding, UX, and Macintosh integration

Genera's embedding software is not one remote-desktop feature.  It is a layered
application substrate: a typed remote-call system; transport agents for shared
memory, serial lines, Chaosnet, TCP, and UDP; a host-independent remote-program
framework; host file access; keyboard models and remapping tools; UNIX services;
and a Macintosh Toolbox bridge capable of presenting a Genera-controlled program
as an ordinary classic Macintosh application.  MacIvory's Genera console,
HyperCard bridge, and Mac-Dex example are applications of that substrate rather
than unrelated compatibility tricks.

The public CADR evidence is much narrower.  MIT System 46 contains no matching
UNIX-interface declaration.  The maintained LM-3 System 303 tree declares a
three-module `Unix-Interface`, but the three implementation files are absent from
the pinned tree and the system is commented out of `Outer System`.  It would be
speculation to turn the filenames into a behavioral account.  The historical
claim this page can support is therefore a declaration-and-absence result, not a
claim that CADR shipped Genera-style RPC or UX embedding.

This dossier inventories user/operator commands, direct keybindings, program
frames, public package interfaces, declared protocols, defaults, and platform
conditions.  “Complete” has a stated grain:

- For visible applications, it includes every command defined directly in the
  program's command table, every directly declared menu item and accelerator, and
  the program's own panes and presentations.  Inherited global Command Processor
  editing and Help commands are excluded unless they materially alter the surface.
- For RPC and the Macintosh bridge, it includes all 192 external symbols declared
  by the inspected `RPC` package and all 161 external symbols declared by the
  inspected `MAC-TOOLBOX` package, grouped below.  It does not reproduce every
  internal function, every generated remote entry, or every Macintosh Manager
  routine generated into C.
- For operating-system host programs, it inventories the documented command-line
  options, state-dependent menus, and public library routines, not private host
  implementation entry points.
- For DBFS Utilities, the complete direct menu is summarized and linked to the
  deeper Statice dossier; the database implementation itself is outside this
  article.

## Evidence and rights boundary

Four evidence classes are kept separate:

| Evidence class | What it can establish here | What it cannot establish |
| --- | --- | --- |
| Public CADR source | Exact System 46 presence/absence and the System 303 declaration at pinned revisions | Behavior of missing System 303 modules |
| Public manuals and protocol specifications | Intended user workflows, classic Mac and UNIX host surfaces, RFC wire conventions | That a particular optional system is present or runnable in this local world |
| Licensed Genera source and inertly decoded Help | Dependency graphs, direct definitions, defaults, package exports, and installed documentation inventory | Redistribution permission for source, decoded prose, resource forks, or application media |
| Isolated runtime observation | The exact result of the recorded Keyboard Control probe in this Open Genera 8.5 world | MacIvory or UX hardware behavior, or any behavior blocked by the VLM keyboard identity |

The purchased Open Genera archive, world, source tree, Help payloads, and all
runtime captures remain untracked.  This page publishes original analysis,
short interface labels and identifiers needed to identify behavior, and portable
hash evidence.  It does not reproduce proprietary source bodies, decoded Help
prose, Macintosh resource data, HyperCard stacks, or recovered application files.

The inspected `sys.sct/embedding/` subtree contains 204 files totaling 3,834,706
bytes.  A manifest made by sorting every relative pathname and its file SHA-256,
then hashing the resulting manifest, has SHA-256
`2f0d47806fa25beb1192117f5469631699f9c094e3a041464b7067c8c319a7ed`.
Selected licensed evidence is identified later under
[Portable provenance](#portable-provenance).

## Product and dependency map

| System or program | Direct prerequisites in the inspected declaration | Release/platform condition | Role established by source and Help |
| --- | --- | --- | --- |
| `RPC` | none declared | In all Ivory worlds; in the VLM release roster | Runtime remote calls, server dispatch, transport agents, bulk transfer, errors, and optional IP/TCP services |
| `RPC Development` | `RPC` according to installed Help | In the VLM release roster | Definition macros, types, generated calls, tracing, dummy and reliable-stream agents, and examples/tooling |
| `Embedding Support` | `RPC` | In the VLM release roster | Keyboard descriptions, the generic remote-program framework and console, and embedded-host remote file access |
| `UX Support` | `RPC`, `Embedding-Support` | In the VLM release roster | UNIX `rexec`/`rsh` protocols, host RPC services, utilities, remote tape, and UNIX LPD integration |
| `UX Development` | `UX-Support`, `RPC-Development` | In the VLM release roster | Dependency marker only in this snapshot; its body is an empty `:parallel` group |
| `MacIvory Support` | `Embedding-Support`, `RPC` | Explicitly excluded from the VLM release by `#-VLM` | Mac internals, resource-defined keyboards, Toolbox and remote UI bridge, Genera console, fonts, errors, and remote Mac files |
| `MacIvory Development` | not recoverable from a source declaration | Installed Help calls it 3600-relevant and says all Ivory worlds contain it; separately excluded from VLM release | Development UI facilities according to Help; implementation inventory is a `TODO` |
| `Keyboard Control` | part of the keyboard subsystem in `Embedding Support` | Activity is present in the Open Genera world, but requires a recognized console keyboard | Inspect, test, print, compare, edit, revert, and serialize keyboard mappings |
| `HyperCard-MacIvory` | `Mac-Dex` | Embedded transport only; useful on MacIvory | HyperCard XFCN-to-RPC bridge and twelve demonstration cards |
| `Mac-Dex` | not stated by the inspected loadable-system entry | Lisp side can serve a non-NuBus Mac connected to a 3600 | Example Macintosh Document Examiner built with the remote-program framework |
| `DBFS-Utilities` | `Statice-Runtime` | Loadable optional system | `Statice File System Operations`, including backup, restore, and DBFS administration |

The base Open Genera world reports `RPC`, `RPC-DEVELOPMENT`,
`EMBEDDING-SUPPORT`, `UX-SUPPORT`, `UX-DEVELOPMENT`, `REMOTE-PROGRAM`, and
`KEYBOARD` among its loaded systems.  It also reports `MACIVORY-D&E` as loaded,
although the release declaration excludes the separately named MacIvory Support
and Development systems from VLM builds.  That is evidence of product/media
naming drift, not proof that `MACIVORY-D&E` is byte-for-byte equivalent to either
separate system.

One package boundary reinforces that caution.  `MACINTOSH-INTERNALS` is declared
with internal colon mode in the package file, accompanied by a note that
MacIvory Development changes it to external.  The package can therefore exist in
an Ivory world while the user-facing development product boundary varies.

## The public CADR UNIX-interface boundary

The pinned public MIT System 46 source snapshot at Git commit
[`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src)
has no `UNIX` system declaration, no `unix/` source directory, and no files named
`LAMTTY`, `SHARE-CHAOS`, or `IOMSG`.  Searches were made over the exact Git tree,
not merely the checked-out working directory.

The maintained LM-3 System 303 Fossil tree at check-in
[`4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
does contain this declaration in
[`sys/sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp):

| Declared element | Exact declaration-level fact |
| --- | --- |
| System | symbol `unix`, pretty name `Unix-Interface`, short name `unix` |
| Package and directory | package `unix`; pathname default `sys:unix;` |
| Configuration module | `sys;lam-config`, compiled in package `si` |
| Main modules | `lamtty`, `share-chaos`, `iomsg` |
| Patch policy | not patchable; patch pathname token `unix99-patch` |
| Outer-system status | `UNIX-INTERFACE` is commented out of `Outer System` |

None of the three declared main-module files is present at that check-in.  Direct
Fossil raw-file requests for each name resolve to the repository index rather
than a file artifact, and the repository tree has no `unix/` directory.  The
configuration module alone is insufficient to establish the interface.  In
particular, this page does **not** expand `LAMTTY`, infer what was shared over
Chaosnet, or assign a message protocol to `IOMSG` from their names.  Those remain
open until a licensed or public source witness containing the files is found.

The downloaded System 303 declaration is 25,396 bytes with SHA-256
`2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd`.
The System 303 result must not be projected backward onto public System 46: the
two pinned trees genuinely differ.

## Genera RPC architecture

### Call, data, and transport layers

Genera RPC separates three concerns that are often collapsed in descriptions of
MacIvory:

1. A **call layer** names a remote module and version, chooses an entry, returns
   multiple values, and represents remotely signalled errors.
2. A **data layer** serializes typed values.  The public manuals identify the
   network form as RPC version 2 with XDR; this corresponds to
   [RFC 1057](https://datatracker.ietf.org/doc/html/rfc1057) and
   [RFC 1014](https://datatracker.ietf.org/doc/html/rfc1014).  RPC moves values,
   not live Lisp object references.
3. A **transport-agent layer** carries calls over an embedded/shared-memory
   channel, serial or reliable serial channel, a generic stream, Chaosnet, TCP,
   UDP, or a dummy test agent.  Programs query the agent rather than bake one
   transport into their interfaces.

`DEFINE-REMOTE-MODULE`, `DEFINE-REMOTE-ENTRY`, `DEFINE-REMOTE-TYPE`, and
`DEFINE-REMOTE-ERROR` are the principal Lisp definition forms.  A module declares
its number, version, client/server languages, and entries.  The generators can
emit C declarations and client/server material as well as Lisp call machinery.
The predefined type layer covers signed and unsigned cardinal widths, booleans,
characters, strings, vectors, opaque bytes, lists, alternatives, structures,
enumerations, members, bits, and single floats.

Installed RPC documentation names 22 predefined remote types:
`INTEGER-32`, `BOOLEAN`, `OPAQUE-BYTES`, `PASCAL-STRING`, `ENUMERATION`,
`C-STRING`, `STRING`, `SPREAD-VECTOR`, `OR`, `VECTOR`, `STRUCTURE`, `MEMBER`,
`LIST`, `SINGLE-FLOAT`, `BIT`, `CARDINAL-4`, `INTEGER-16`, `INTEGER-8`,
`CHARACTER-8`, `CARDINAL-8`, `CARDINAL-16`, and `CARDINAL-32`.  The package
also exports lower-level octet-structure field types; those are implementation
and code-generation tools, not additional claims about the documented portable
remote type set.

### System composition and platform branches

The `RPC` declaration loads call runtime and server first; then generic agent,
STD agent, stream agent, an `Emb-Agent` only for `:imach`, bulk transfer, error
codes, and final initialization.  When `IP-TCP` is available it additionally
loads port mapping, Yellow Pages/NIS, authentication, TCP and UDP agents, and
UNIX name lookup from the NFS tree.  This explains why RPC is not synonymous
with network RPC: the same call layer also serves local coprocessor embedding.

`RPC Development` supplies `Utilities`, `Remote-type`, `Type-definitions`,
`Remote-call-defs`, `Remote-Call`, `Trace`, `Dummy-Agent`, and
`Reliable-stream`.  A conditional `rpc-c` branch adds a C testing subsystem.
Keeping runtime and development systems separate lets a delivered world retain
generated calls without every macro, generator, trace utility, and example.

### Wire registrations and remote-system identities

The source declares `:RPC` and `:RPC-LITTLE-ENDER` over the generic
`:BYTE-STREAM` medium.  With IP/TCP, the registered TCP ports are 6259 for
`:RPC` and 6257 for `:RPC-LITTLE-ENDER`; the UDP agent registers corresponding
simple-RPC ports.  Chaosnet uses contact name `RPC` with protocol
`:RPC-BIG-IN-LITTLE-BYTES`.  The names describe byte ordering at the transport
boundary; they do not create a new application-level call model.

Agent-visible remote-system types include `:MACINTOSH` for the embedded Mac,
`:UNIX42` for UX-family UNIX services, and `:LISPM` for a peer Lisp machine.
Error-number translation and conditional behavior use those identities.  The
UX-only C surface also exposes `RPCAgentFileDescriptor`, allowing a host event
loop to integrate an RPC agent's descriptor.

### Network RPC defaults and name lookup

The network agent supports port mapping, UDP and TCP, deferred/future calls, and
null, UNIX, or DES authentication.  The inspected defaults are measured in
sixtieths of a second:

| Setting | Source default | Human duration |
| --- | ---: | ---: |
| UDP call timeout | 1,740 ticks | 29 seconds |
| Retransmission schedule | 60, 120, 240, 480, 840 ticks | 1, 2, 4, 8, and 14 seconds |
| Idle UDP-agent timeout | 10,800 ticks | 3 minutes |

The UNIX name-lookup layer can consult the Genera namespace, Yellow Pages/NIS,
the password and group files, and the hosts file.  The exact twenty host or user
properties are:

`RPC-USE-YELLOW-PAGES`, `RPC-UDP-CONNECTION-IDLE-TIMEOUT`,
`RPC-UDP-CALL-RETRANSMIT-TIMEOUTS`, `RPC-UDP-CALL-TIMEOUT`,
`YP-DOMAIN-NAME`, `YP-DOMAIN-SERVER`, `RPC-USE-FILE`,
`RPC-USE-NAMESPACE`, `RPC-USE-HOSTS-FILE`, `RPC-PASSWD-FILE`,
`RPC-GROUP-FILE`, `RPC-HOSTS-FILE`, `RPC-HOST-UID`, `RPC-UID`,
`RPC-HOST-GID`, `RPC-GID`, `RPC-GIDS`, `RPC-HOST-GIDS`,
`RPC-HOST-HOMEDIR`, and `RPC-HOMEDIR`.

Default pathnames are `/etc/passwd`, `/etc/group`, and `/etc/hosts`.  The global
use switches are enabled, while the low-level source defaults namespace lookup
and NIS to true, file lookup to false, and hosts-file lookup to false.  Installed
documentation says file lookup defaults true; loading `NFS Common` changes the
default file switch to true.  This is a load-order-sensitive source/documentation
difference, not a reason to choose one statement as universally correct.

### Complete external `RPC` package surface

The following is the complete 192-symbol external interface declared by the
inspected package file, in declaration order.  Group names are analytical; the
ordering and symbols are source facts.  “External” means callable or nameable by
another package, not that every symbol is a supported end-user API in every
release.

**Definition and control (1–10):** `DEFINE-REMOTE-MODULE`,
`DEFINE-REMOTE-ENTRY`, `DEFINE-REMOTE-TYPE`, `DEFINE-REMOTE-ERROR`,
`DEFINE-REMOTE-C-PROGRAM`, `DEFINE-REMOTE-ERROR-NUMBER`, `RPC-VALUES`,
`RPC-ERROR`, `TYPE-ERROR`, `PARSE-MACRO-OPTIONS`.

**Type protocol (11–20):** `REMOTE-TYPE-FIXED-SIZE`,
`REMOTE-TYPE-SIZE-EXPRESSION`, `REMOTE-TYPE-SEND`,
`REMOTE-TYPE-SEND-MULTIPLE`, `REMOTE-TYPE-SEND-MULTIPLE-TRANSLATED`,
`REMOTE-TYPE-RECEIVE`, `REMOTE-TYPE-PREPROCESS`, `REMOTE-TYPE-FREE`,
`REMOTE-TYPE-FREE-MULTIPLE`, `REMOTE-TYPEP`.

**Codec and language (21–44):** `SEND-WORD`, `SEND-WORDS`,
`SEND-WORD-VECTOR`, `SEND-BYTE-VECTOR`, `SEND-CHAR-VECTOR`,
`SEND-BIT-VECTOR`, `SEND-HALFWORD-VECTOR`, `SEND-SIGNED-BYTE-VECTOR`,
`SEND-SIGNED-HALFWORD-VECTOR`, `SEND-NIBBLE-VECTOR`,
`SEND-SINGLE-FLOAT-VECTOR`, `RECEIVE-WORD`, `RECEIVE-WORD-VECTOR`,
`RECEIVE-BYTE-VECTOR`, `RECEIVE-CHAR-VECTOR`, `RECEIVE-BIT-VECTOR`,
`RECEIVE-HALFWORD-VECTOR`, `RECEIVE-SIGNED-BYTE-VECTOR`,
`RECEIVE-SIGNED-HALFWORD-VECTOR`, `RECEIVE-NIBBLE-VECTOR`,
`RECEIVE-SINGLE-FLOAT-VECTOR`, `TYPE`, `ORIGINAL-TYPE`, `LANGUAGE`.

**Agents (45–56):** `*DEFAULT-TRANSPORT-AGENT*`, `EMBEDDED-AGENT-P`,
`NETWORK-AGENT-P`, `AGENT-CONNECTED-P`, `OPEN-SERIAL-AGENT`,
`OPEN-TCP-AGENT`, `OPEN-CHAOS-AGENT`, `OPEN-DUMMY-AGENT`, `CLOSE-AGENT`,
`REMOTE-HOST`, `REMOTE-SYSTEM-TYPE`, `*SERVER-DEBUG-FLAG*`.

**Tracing (57–59):** `DISABLE-RPC-TRACE`, `ENABLE-RPC-TRACE`,
`SHOW-RPC-TRACE`.

**Predefined exported types (60–75):** `INTEGER-32`, `INTEGER-16`,
`INTEGER-8`, `CARDINAL-32`, `CARDINAL-16`, `CARDINAL-8`, `CARDINAL-4`,
`SINGLE-FLOAT`, `STRING`, `PASCAL-STRING`, `C-STRING`, `CHARACTER-8`,
`OPAQUE-BYTES`, `SPREAD-VECTOR`, `OR`, `STRUCTURE`.

**C generation (76–85):** `DECLARE-C-VARIABLE`, `DECLARE-C-TYPE`,
`LISP-NAME-TO-C-NAME`, `C-NAME-TO-LISP-NAME`, `*C-DECLARATIONS*`,
`*C-TYPEDEFS*`, `COLLECT-C-DECLARATIONS`, `*KNOWN-LANGUAGES*`,
`PARENTHESIZE-C-EXPRESSION`, `WRITE-C-TOKEN-LIST`.

**Octet structures (86–123):** `BYTE-SWAPPED-8-AREF-16`,
`BYTE-SWAPPED-8-AREF-32`, `DEFINE-OCTET-STRUCTURE-FIELD-TYPE`,
`DEFINE-OCTET-STRUCTURE-FIELD-TYPE-MACRO`,
`DEFINE-OCTET-STRUCTURE-CONVERSION-FIELD-TYPE`, `SIGNED-BYTE`,
`UNSIGNED-BYTE`, `VECTOR`, `LOAD-BYTE`, `BIT`, `BOOLEAN`, `BOOLEAN8`,
`BOOLEAN16`, `BOOLEAN32`, `MEMBER`, `SUBSET`, `ENUMERATION`, `LIST`,
`CHARACTER`, `PADDING`, `BOOLEAN-BIT`, `ASCII-CHARACTER`,
`DEFINE-OCTET-STRUCTURE`, `OCTET-STRUCTURE-FIELD-REF`,
`OCTET-STRUCTURE-FIELD-INDEX`, `OCTET-STRUCTURE-FIELD-SIZE`,
`OCTET-STRUCTURE-TOTAL-SIZE`, `OCTET-STRUCTURE-FIELD-ENTRY`,
`OCTET-STRUCTURE-FIELD-INDIRECT-ARRAY`,
`WITH-OCTET-STRUCTURE-ACCESS-TYPE`, `WITH-OCTET-STRUCTURE-FIELDS`,
`DEFINE-OCTET-STRUCTURE-AND-FLAVOR`,
`DEFINE-OCTET-STRUCTURE-AND-FLAVOR-1`, `COPY-OCTET-STRUCTURE`,
`OCTET-STRUCTURE-EQUAL`, `COPY-FIELDS-FROM-OCTET-STRUCTURE`,
`DESCRIBE-OCTET-STRUCTURE`, `WRITE-OCTET-STRUCTURE-DEFINITIONS-TO-C-FILE`.

**Network agents (124–151):** `HOST-PMAPPROC-CALLIT-TRANSPORT-AGENT`,
`PORT-MAPPING-TRANSPORT-AGENT-MIXIN`, `FORGET-PORT`, `FORGET-PORTS`,
`FORGET-ALL-PORT-MAPPING-TRANSPORT-AGENT-PORTS`, `PORT-UNAVAILABLE`,
`AUTHENTICATION-MIXIN`, `AUTHENTICATION-INITIALIZE`,
`AUTHENTICATION-USERNAME`, `AUTHENTICATION-RESET`,
`RESET-ALL-AUTHENTICATING-TRANSPORT-AGENTS`, `AUTHENTICATION-DESCRIBE`,
`HOST-TCP-TRANSPORT-AGENT`,
`CLOSE-ALL-PORT-MAPPING-TCP-TRANSPORT-AGENTS`,
`TCP-AGENT-NOTE-DEPENDENT`, `DEPENDENT-NOTE-TCP-AGENT-CLOSED`,
`TCP-RPC-STREAM-CLOSED`, `HOST-UDP-TRANSPORT-AGENT`,
`UDP-AGENT-NOTE-DEPENDENT`, `DEPENDENT-NOTE-UDP-AGENT-CLOSED`,
`UDP-RPC-HOST-NOT-RESPONDING`, `UDP-RPC-CONNECTION-ERROR`,
`*UDP-CALL-TIMEOUT*`, `*DEFAULT-UDP-CALL-TIMEOUT*`,
`*UDP-CALL-RETRANSMIT-TIMEOUTS*`,
`*DEFAULT-UDP-CALL-RETRANSMIT-TIMEOUTS*`,
`*UDP-RPC-CONNECTION-IDLE-TIMEOUT*`,
`*DEFAULT-UDP-RPC-CONNECTION-IDLE-TIMEOUT*`.

**UNIX name lookup (152–186):** `USERNAME->PASSWD`,
`USERNAME->PASSWORD`, `USERNAME->UID`, `USERNAME->GID`,
`USERNAME->GECOS`, `USERNAME->HOMEDIR`, `USERNAME->SHELL`,
`USERNAME->GIDS`, `UID->PASSWD`, `UID->USERNAME`, `GROUPNAME->GROUP`,
`GROUPNAME->GID`, `GROUPNAME->PASSWORD`, `GROUPNAME->USERNAMES`,
`GID->GROUP`, `GID->GROUPNAME`, `HOSTNAME->HOST`, `HOSTNAME->ADDRESS`,
`ADDRESS->HOST`, `ADDRESS->HOSTNAME`, `HOST-UNIX-NAME-LOOKUP-ACCESS-PATH`,
`RESET-ALL-UNIX-NAME-LOOKUP-ACCESS-PATHS`,
`UNIX-NAME-LOOKUP-ACCESS-PATH-NOTE-DEPENDENT`,
`DEPENDENT-NOTE-UNIX-NAME-LOOKUP-ACCESS-PATH-RESET`, `YELLOW-PAGES-ORDER`,
`YELLOW-PAGES-LOOKUP`, `YELLOW-PAGES-LIST`,
`*USE-NAMESPACE-FOR-UNIX-NAME-LOOKUP*`,
`*DEFAULT-USE-NAMESPACE-FOR-UNIX-NAME-LOOKUP*`,
`*USE-YELLOW-PAGES-FOR-UNIX-NAME-LOOKUP*`,
`*DEFAULT-USE-YELLOW-PAGES-FOR-UNIX-NAME-LOOKUP*`,
`*USE-FILE-FOR-UNIX-NAME-LOOKUP*`,
`*DEFAULT-USE-FILE-FOR-UNIX-NAME-LOOKUP*`,
`*USE-HOSTS-FILE-FOR-UNIX-NAME-LOOKUP*`,
`*DEFAULT-USE-HOSTS-FILE-FOR-UNIX-NAME-LOOKUP*`.

**Console (187–192):** `RPC-CONSOLE`, `CREATE-RPC-CONSOLE`,
`NEW-UNIQUE-ID`, `*RPC-SCREEN-USE-HOST-SCREEN-STYLE*`,
`*RPC-SCREEN-USE-BACKUP-SCREEN*`,
`*RPC-SCREEN-ALWAYS-USE-BACKUP-SCREEN*`.

### Delivered C runtime and life-support calls

The public MacIvory manual documents the C-side RPC/life-support surface at a
different grain.  The inspected list includes agent lifecycle
`emb_agent_open`, `InitializeRPC`, `PollRPC`, and `CloseRPC`; MacIvory startup
`InitMacIvorySupport` and `InitMacIvory`; server setup
`initialize_remote_module_name_server` and
`initialize_predefined_remote_entries_server`; application recovery
`RestartMacIvoryApplication`; failure reporting `ColdLoadVisible`,
`ReportRPCOpenFailure`, `RPCRemoteError`, and `ReportRPCCallFailure`; and machine
control `ShowColdLoad`, `IsNetworkEnabled`, `IsColdLoadWindow`, `HideColdLoad`,
`EnableNetwork`, `DisableNetwork`, `BusyWait`, `ColdBootFEP`, `RestartLisp`,
`ColdBootLisp`, `ContinueLisp`, `RestartFEP`, `ShutDownIvory`, and `StopLisp`.

These routines expose why a MacIvory application is more than a remote window:
the host program participates in starting and polling RPC, presenting failure
state, controlling Ethernet ownership, and transferring control between Lisp and
the Ivory FEP.

## Embedding Support and the remote-program substrate

`Embedding Support` contains three serial pieces:

- `keyboard`: keyboard geometry, legends, mappings, and PC keyboard layouts;
- `remote-program`: the generic remote-program framework plus an RPC console;
- `file-system`: embedded-host and remote-access support for the host file
  system.

The source's placement of the generic framework under a `macintosh` directory is
explicitly called “wrong place” by its own declaration.  Its abstraction is not
Mac-only: a remote program records a remote-system type and upgrades Genera
command-table menu metadata into host-native menus.  It provides three panes for
the local representation—viewer, command menu, and interactor—and transports
Accept Values questions as booleans, enumerations, or strings that a host dialog
manager can display.

The six names exported by this source file are `REMOTE-PROGRAM`,
`REMOTE-PROGRAM-QUIT`, `REMOTE-PROGRAM-P`, `WITH-OUTPUT-TO-VIEWER`,
`WITH-REMOTE-ACCEPTING-VALUES`, and `DEFINE-REMOTE-PROGRAM-FRAMEWORK`.
The associated definition surface also includes
`DEFINE-REMOTE-PROGRAM-COMMAND` and `DEFINE-SUBCOMMAND-MENU-HANDLER`.

Two reusable command frameworks are source-visible:

| Framework | Direct commands | Direct keybindings |
| --- | --- | --- |
| `REMOTE-QUIT-COMMANDS` | Quit | Super-Q in Genera, presented as Mac Command-Q |
| `REMOTE-VIEWER-COMMANDS` | Close front viewer; Close All viewers; inherits Quit | Super-W/Mac Command-W for Close; none for Close All; inherited Super-Q/Mac Command-Q for Quit |

The standard Edit menu template names Undo, Cut, Copy, Paste, and Clear, with
Super-Z, Super-X, Super-C, and Super-V shown for the first four applicable
entries.  A template label is not an implementation.  A concrete remote program
must install or inherit handlers; this distinction matters for the Genera Mac
program below.

## UX Support and UX Development

### What UX Support adds

`UX Support` loads four modules in order: `unix-protocols`, `rpc-services`,
`predefined-entries`, and `utilities`.  The inspected source adds these concrete
capabilities:

- TCP services and clients for UNIX `rexec` on port 512 and `rsh` on port 514;
- paired RPC modules with UNIX as server or client, plus a UX400 run-lights
  module;
- UNIX error translation, UNIX epoch/time calls, host OS-version reporting, and
  predefined host entries;
- a remote tape stream that starts `/usr/sbin/rmt` or `/etc/rmt` through `rexec`;
- UNIX LPD hardcopy and queue/control integration on TCP port 515.

The RPC service layer waits 10 seconds by default for a UNIX RPC response.  The
remote tape stream uses a 262,144-byte buffer and recognizes a table of historical
tape controller codes; that table does not imply the VLM has any such device.
The LPD hardcopy buffer is 32,768 bytes and its acknowledgement wait is 20
seconds.

The LPD implementation is intentionally incomplete at the generic printer API
boundary.  Job submission, short-form queue query, and job deletion are
implemented.  Queue creation, creating or assigning a data channel, queue entry
modification, policy modification, printer characteristic query, restart,
suspend, resume, and reset explicitly signal “unimplemented”.  This is
source-visible behavior not evident from the simple claim “UNIX LPD support”.

### Complete direct UX user command

Only one user command is defined directly in the inspected UX sources:

| Command | Required arguments | Keyword and default | Behavior |
| --- | --- | --- | --- |
| Execute Command | host; remote command string | `Source`, default `None`; choices File, Buffer, Stream, or Command | run the string through `rexec`, optionally streaming the selected source to standard input, and send remote output to the command's output destination |

The source calls this a rough prototype and notes that Meta-Complete is normally
needed to enter its richer source presentation.  It obtains login credentials
through the tape/login support if not supplied at the API level.  There is no
direct command-table keybinding.

### UX Development is empty in this snapshot

The `UX Development` declaration requires `UX Support` and `RPC Development`,
but its body is exactly an empty `(:parallel)` group.  Installed active Help also
describes it as reserved and lists no files.  Thus “development” here is a named
dependency boundary, not an additional API or application whose missing commands
should be guessed.  It may have been populated in another release; finding such
a witness is an open preservation task.

### Open Genera host application options

The public Open Genera guide documents 22 distinct `genera` command-line option
names.  They are part of the UX/VLM host operating surface, not Lisp commands:

| Group | Options and documented defaults |
| --- | --- |
| Core | `-spy` (No), `-diagnostic`, `-world` (`/usr/lib/symbolics/Genera-8-5.vlod`), `-debugger` (`/usr/lib/symbolics/VLM_debugger`), repeatable `-network` for units 0–7, `-vm` (200 MB/40 MW), `-ids` (No), `-searchpath` |
| Main X console | `-display` (`DISPLAY`, else local host), `-geometry`, `-iconic` (No), `-foreground`/`-fg`, `-background`/`-bg`, `-bordercolor`/`-bd`, `-borderwidth`/`-bw` |
| Cold-load X console | `-coldloaddisplay`/`-cld` (main display), `-coldloadgeometry`/`-clg`, `-coldloadiconic`/`-cli` (Yes), `-coldloadforeground`/`-clfg`, `-coldloadbackground`/`-clbg`, `-coldloadbordercolor`/`-clbd`, `-coldloadborderwidth`/`-clbw` |

Equivalent X-resource-style names can be read, in increasing precedence, from a
site `.VLM`, the user's `.VLM`, the working-directory `.VLM`, and finally the
command line.  The documented search-path example contains `/user/lib/symbolics`
where `/usr/lib/symbolics` might be expected; this page preserves it as a manual
observation and does not silently “correct” a historical document.

**UX screenshot TODO:** a substantive `Execute Command` capture needs a
deterministic, synthetic `rexec` peer inside the isolated namespace and disposable
credentials.  This study did not send a command or expose credentials merely to
produce a listener image.  A future probe should show the accepted source choice
and harmless peer output while retaining the no-external-route boundary.

## Keyboard Control

Keyboard Control is both a diagnostic application and an editor for the mapping
table attached to the current console.  The frame has five panes in one vertical
configuration:

1. a one-line title containing the program and current layout names;
2. a keyboard display pane whose keys are presentations;
3. a top-level command menu;
4. an Accept Values pane for mapping entries;
5. a four-line interactor.

The keyboard and mapping panes split the remaining space evenly.  Clicking a key
presentation translates directly to `Edit Mappings` for that key.  The activity
does not start merely because the program code is loaded: its choice predicate
must find a layout matching the console keyboard's layout type.

### Complete direct command inventory

The source defines exactly eleven commands in the Keyboard Control command table.
Commands without a menu accelerator remain typeable program commands; they are
not silently promoted to menu buttons here.

| # | Command | Arguments and defaults | Direct behavior |
| ---: | --- | --- | --- |
| 1 | Key Test | none | take raw keyboard/mouse input, animate physical transitions and mouse buttons, and end on End |
| 2 | Typing Test | none | show raw transitions and current shifted mapping while forwarding typed characters; end on End |
| 3 | Show Codes | `Radix`, default 8 | output every key name and hardware code in the selected radix; supports output destination |
| 4 | Where Is | character, confirmed | find and display every key/shift combination that produces the character |
| 5 | Edit Mappings | `None`, `All`, or one key | hide mappings, expose all mapping entries, or expose one key's entries in the Accept Values pane |
| 6 | Show Differences | none | compare current and original tables and display key, current mapping, and standard mapping |
| 7 | Revert | none | copy the original mapping table over the current table |
| 8 | Save Differences | none | serialize changed entries as Lisp forms into a Zwei kill-ring interval |
| 9 | Hardcopy | printer (default text printer); Portrait; legends Yes; mappings Yes; codes No/Octal/Decimal/Hex | print the current geometry and selected legend, code, and shifted-mapping pages |
| 10 | Hardcopy All Layouts | printer (default text printer); Portrait; optional sequence of name fragments | print every layout, or layouts whose pretty names match any supplied fragment |
| 11 | Set Keyboard | `Default` or a named layout; default `Default` | return to the real console keyboard or display a named layout using its default mapping table |

`Hardcopy` contains a compiled-out `Include Keysyms` choice whose source comment
calls the keysyms potentially wrong.  It is not part of the user surface.
`Save Differences` does not write a site file: it prints replayable
`SYS:SET-KEYBOARD-TABLE-MAPPING` forms to the kill ring, in hexadecimal and
lowercase.  Persistence requires the user to paste or otherwise save those forms.

The application defines no direct command accelerator.  End terminates only the
raw Key Test and Typing Test loops, and inherited Help and Accept Values editing
come from parent command tables.  A `:menu-accelerator t` declaration means “use
the generated command name as a menu label”; it is not a keyboard shortcut.

### The separate Show Keyboard Layout command

`Show Keyboard Layout` is a Documentation-area Command Processor command, not a
twelfth application command.  It takes a layout, defaulting to the current
console's recognized layout when available, plus:

- `Include Legends`, default Yes;
- `Include Mappings`, default current mappings when the chosen layout is current,
  otherwise the layout defaults; if current and default differ, the choices are
  Current, Default, or No;
- `Include Codes`, default No, with Octal, Decimal, and Hex alternatives.

It also inherits ordinary output-destination and More Processing behavior from
the Documentation command environment.

### Layout inventory and documentation drift

The generic source files define these eleven layout records:

- Symbolics, Sun Type 3, Sun Type 4, SGI Iris, NCD N-101, NDS, and DEC LK401 AA;
- IBM PC (U.S. English), IBM PC (101 keys, U.S. English), IBM PC (102 keys, key
  numbers), and IBM PC (another 102 keys, key numbers).

MacIvory additionally loads Macintosh layouts from a resource file rather than
Lisp geometry forms.  Installed UX documentation has a fourteen-name list:
Apple, Apple Extended, Apple ISO, Apple ISO Extended, Mac 512K, Mac 512K
International, Mac Plus, Mac Portable, Mac Portable ISO, NCD N-101, SGI Iris,
Sun Type 3, Sun Type 4, and Symbolics.  That Help list omits the later source's
NDS, DEC, and IBM PC records, while including dynamically supplied Mac layouts.
It is therefore an installed-documentation snapshot, not an exhaustive list of
the later source tree.

### MacIvory common settings and native-Mac mapping

The Genera Mac program's `Keyboard` submenu invokes Keyboard Control and exposes
`Common settings`.  In the inspected source, Common settings has a specialized
dialog only for `Apple Extended`:

- shift-key order: Control–Meta–Super, Super–Meta–Control, or
  Meta–Control–Super;
- whether mouse keys act as mouse buttons rather than shift keys.

The MacIvory manual separately documents how a **Symbolics keyboard drives native
Macintosh applications**.  The direction is important; this is not the mapping
from an Apple keyboard into Genera.

| Symbolics input | Native Mac result |
| --- | --- |
| ordinary character | same ordinary character |
| Escape, Super, Meta, Control | Escape, Command, Option, Control |
| Scroll, Clear Input, Help, End | Enter, Clear, Help, End |
| Shift with `1` through `9`, `0`, minus, equals, backquote, backslash, vertical bar | F1 through F15 |
| Symbol with `0` through `7`, `9`, minus, period, slash | numeric keypad equivalents |
| Up, Down, Left, Right | Symbol-I, Symbol-comma, Symbol-J, Symbol-L |
| Home, Page Up, Page Down, forward Delete | Symbol-K, Symbol-Page, Page, Symbol-Rubout |

The manual describes special same/opposite-Shift handling for numeric keypad 8,
equals, asterisk, and plus.  It also records two host limitations: MultiFinder
could lose key-up events despite a polling workaround, and the classic Mac event
queue was small enough to make typeahead less reliable.  These are manual claims
for MacIvory, not behavior reproduced on the VLM.

### Isolated Open Genera runtime probe

A read-only probe used named session `d47-keyboard-control-20260718`, generation
1, from 2026-07-18 11:38:44 to 11:40:28 EDT.  The ordered input was:

1. type `Select Activity Keyboard Control` and press Return;
2. after the activity was rejected, evaluate
   `(sys:keyboard-layout-type (sys:console-keyboard (send
   (tv:console-default-superior) :console)))`.

The runtime displayed exactly:

> Keyboard Control cannot be used on a console with an unrecognized keyboard.

The read-only expression returned `NIL`.  This agrees with the source choice
predicate and establishes the blocker: the VLM X console did not identify itself
as any loaded keyboard layout.  It does not establish that Keyboard Control is
broken on a recognized console.

The final action log contains eight intent/outcome records and has SHA-256
`d3177e5b12c28295024bb6a42659b4ccaece57ee8ec1b14178e6a65f01e88467`.
The two relevant ignored captures were 1200×900:

| Capture | Time | PNG SHA-256 | Pixel SHA-256 | What it proves |
| --- | --- | --- | --- | --- |
| rejection after activity selection | 11:39:29 EDT | `2229c8f1920fa6d8a36943cb1be5d4a395b3a9e2672838ad550bc888db37ae71` | `71322227f203c63868ddb816a330522e1a3d0a0b34874ea4004dbd7187a2e339` | exact rejection in the listener |
| layout-type evaluation | 11:39:56 EDT | `57f139aff7a0adbf65668ebf4e0985d12f6f6f560b822c8c6a7d35e10630e365` | `bbb23e7b01dd01ddad51f1f50266c45da1d85bc2b73952d586e8f8ad775f679d` | the runtime value is `NIL` |

The harness ran the private VLM in separate user, mount, network, PID, IPC, and
hostname namespaces.  It exposed no host root, external route, default route, or
guest-visible host file service; Xvfb did not advertise MIT-SHM.  The selected
window was `Genera on DIS-LOCAL-HOST`, 1200×900 at X=72, Y=55.  Both exact X
protocol substitutions and the one-shot RFC 868 reply were observed before the
run was accepted as running; the supervised responder separately exited with
status 0.  This isolated local identity is not a configured Symbolics site.

The base and private world hashes remained
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
The harness did not invoke Save World or make a host checkpoint;
`save_world_performed` and `guest_checkpoint_created` remain unknown.  Shutdown
was recorded as separate stages: the prompt was observed, `yes` was sent,
confirmation was accepted, and cleanup progress was observed.  The known VLM
cleanup stall then required a bounded forced stop.  `orderly_vlm_host_shutdown`
is false and `state_may_be_incomplete` is true.

### Screenshot rights review and exact blocker

The rejection capture was reviewed specifically, not under a blanket rule.  Its
proposed purpose would be noncommercial historical scholarship and criticism;
the visible interface is highly functional; one cropped listener state is the
minimum amount needed to evidence the exact rejection; and such a use would not
substitute for the product or its documentation.  Those facts support a fair-use
case for a carefully cropped evidentiary image.

No image is published here, however.  The capture shows the blocker rather than
Keyboard Control itself and adds little visual evidence beyond the exact recorded
message.  The raw capture remains in the ignored session tree.

**Screenshot TODO:** configure a recognized keyboard layout in the harness
without broadening its pinned X compatibility contract, then capture the actual
five-pane initial program and one non-destructive mapping-inspection state.
Review each selected image under the repository policy and curate it separately;
do not replace this blocker with an unproven illustration.

## MacIvory Support and Development

### What the support system contains

`MacIvory Support` serially combines:

1. Macintosh internals and resource-defined key layouts;
2. Mac keyboard-cap geometry;
3. Mac Toolbox and remote Mac file-system systems;
4. toolkit, callback, UIMS, and dialog substrate;
5. the remote Genera console program;
6. Genera-to-Mac font mappings;
7. Mac/RPC error translation.

The Macintosh-internals subsystem covers Mac types, QuickDraw, file formats,
fonts, time conversion, Mac image copying, RPC status, and a machine-conditional
MacIvory configuration module.  The file-system layer distinguishes ordinary
data and resource forks and makes the host Mac available through a Genera host
object.  Presence in the licensed source tree does not imply that the VLM can
instantiate its `:imach` hardware paths.

The Mac Toolbox declaration contains 40 manager/program source units: ADB, color
manager and picker, Color QuickDraw and Color Toolbox, control, desk, dialog,
disk initialization, event communication, file, font, graphics devices,
international utilities, list, memory, menu, palette, QuickDraw, resource, scrap,
script, SCSI, segment loader, sound, Standard File, system miscellaneous,
TextEdit, Toolbox event, window, printing, device, disk driver, serial driver,
Toolbox utilities, OS utilities, OS event, vertical retrace, slot, and
notification.  Definitions, Mac OS errors, all-manager glue, toolkit macros, and
remote launch support sit around those units.

The source declaration comments that AppleTalk is the only manager not included.
Installed `toolbox5` Help nevertheless has an AppleTalk Manager section.  No
AppleTalk manager implementation unit appears in this source declaration or
subtree, so the Help heading is evidence of documentation coverage or another
release—not proof of a loadable AppleTalk bridge here.

The public MacIvory Delivery manual provides a separate product check: it lists
Macintosh file-system support, Macintosh Toolbox support, and Macintosh RPC among
the facilities retained in its reduced delivery world, while excluding many
development applications and databases.  Embedding was therefore part of the
delivery substrate, not merely development tooling.

### Complete external `MAC-TOOLBOX` package surface

The package declaration exports 161 names.  The list below is complete at that
package boundary and in declaration order; it is much smaller than the generated
set of individual Macintosh Manager calls.

**Graphics and display (1–11):** `QUICKDRAW-PICTURE`,
`WITH-OUTPUT-TO-QUICKDRAW-PICTURE`, `QUICKDRAW-PRESENTATION`,
`QD-PRESENTATION-UNIQUE-ID`, `QD-PRESENTATION-BOUNDING-BOX`,
`QD-PRESENTATION-CHORDS`, `LOAD-MORE-FONTS`, `*MAC-DISPLAY-DEVICE*`,
`*AUTOMATICALLY-GENERATE-PIXMAP-CORRESPONDENCES*`,
`*PIXMAP-CORRESPONDENCE-MEMORY-THRESHOLD*`, `READ-MACPAINT-FILE`.

**Structure basics (12–19):** `DEFINE-MAC-STRUCTURE`, `POINT`, `RECT`,
`POLYGON`, `PATTERN`, `CURSOR`, `SET-POINT`, `SET-RECT`.

**File, volume, and queue structures (20–71):** `CCONSTANT`, `CCONSTANT-1`,
`HANDLE`, `FINFO`, `FINFO-FDTYPE`, `FINFO-FDCREATOR`, `FINFO-FDFLAGS`,
`FILEPARAM`, `MAKE-FILEPARAM`, `FILEPARAM-IOFLFNDRINFO`,
`FILEPARAM-IOFLLGLEN`, `FILEPARAM-IOFLRLGLEN`, `FILEPARAM-IOFLMDDAT`,
`VOLUMEPARAM`, `MAKE-VOLUMEPARAM`, `VOLUMEPARAM-IOVREFNUM`,
`DRVQEL-QLINK`, `DRVQEL-DQDRIVE`, `MAKE-HVOLUMEPARAM`,
`HVOLUMEPARAM-IOVREFNUM`, `HVOLUMEPARAM-IOVNMALBLKS`,
`HVOLUMEPARAM-IOVALBLKSIZ`, `HVOLUMEPARAM-IOVFRBLK`,
`HVOLUMEPARAM-IOVFILCNT`, `HVOLUMEPARAM-IOVDIRCNT`, `MAKE-HFILEINFO`,
`HFILEINFO-IOFLATTRIB`, `HFILEINFO-IOFLFNDRINFO`, `HFILEINFO-IOFLLGLEN`,
`HFILEINFO-IOFLPYLEN`, `HFILEINFO-IOFLRLGLEN`, `HFILEINFO-IOFLRPYLEN`,
`HFILEINFO-IOFLMDDAT`, `HFILEINFO-IOFLBKDAT`, `DIRINFO-IODRDIRID`,
`DIRINFO-IODRNMFLS`, `DIRINFO-IODRMDDAT`, `DIRINFO-IODRBKDAT`,
`MAKE-FCBPBREC`, `FCBPBREC-IOVREFNUM`, `FCBPBREC-IOREFNUM`,
`FCBPBREC-IOFCBFLAGS`, `FCBPBREC-IOFCBEOF`, `FCBPBREC-IOFCBPLEN`,
`FCBPBREC-IOFCBCRPS`, `FCBPBREC-IOFCBPARID`, `QELEM-QLINK`, `QELEMPTR`,
`QHDR`, `QHDR-QHEAD`, `MAKE-SYSENVREC`, `SYSENVREC-SYSVREFNUM`.

**Remote-menu constants (72–76):** `REMOTE-VIEWER-COMMANDS`,
`REMOTE-QUIT-COMMANDS`, `*STANDARD-REMOTE-VIEWER-FILE-MENU*`,
`*STANDARD-EDIT-MENU*`, `SIZE`.

**Resources and ports (77–95):** `WITH-QD-PORT`, `WITH-WINDOW`,
`WITH-HANDLE-LOCKED`, `WITH-RESOURCE-HANDLE`, `WITH-RESOURCE`,
`CCONSTANT-CASE`, `CCONSTANT-ECASE`, `WITH-MAC-STRUCT`,
`MAP-OVER-MAC-QUEUE-ELEMENTS`, `USING-RESFILE`, `DO-RESTYPES`, `DO-RSRCS`,
`SHOW-RESFILES`, `WITH-MAC-TEMP`, `WITH-RESFILES`, `WITH-RESLOAD`,
`USING-SCRATCH-RESFILE`, `DOWNLOAD-RESOURCE`, `RPC-WINDOW-FOR-MAC-WINDOW`.

**Errors and remote access (96–115):** `MAC-OS-ERROR`, `RPC-FILE-ERROR`,
`MAC-FS-NOT-A-DIRECTORY`, `MAC-RPC-FILE-RENAME-ACROSS-VOLUMES`,
`MAC-RPC-FILE-UNKNOWN-PROPERTY`, `WITH-MAC-OS-ERROR-ARGS`,
`SIGNAL-MAC-OS-ERROR`, `LOOKUP-MAC-OS-CONDITION`, `WITH-OPEN-REFNUM`,
`WITH-PICT-FROM-FILE`, `EZ-SFGETFILE`, `OCTET-REF-REMOTE-PTR`,
`OCTET-REF-REMOTE-HANDLE`, `WITH-RECT`, `WITH-POINT`, `REMOTE-NUMBER`,
`READ-REMOTE-NUMBER`, `WRITE-REMOTE-NUMBER`, `DESCRIBE-EVENTRECORD`,
`WITH-TEMPS`.

**Callbacks and definition types (116–146):** `WITH-MAC-CALLBACK`,
`WITH-MAC-CALLBACK-FUNCTION`, `GET-CANNED-CALLBACK`, `MAKE-MAC-CALLBACK`,
`REMOVE-MAC-CALLBACK`, `CONTROL-DEFINITION`, `CONTROL-INDICATOR-ACTION`,
`CONTROL-NONINDICATOR-ACTION`, `DIALOG-SOUND-PROC`,
`DIALOG-USER-ITEM-DEFINITION`, `DRAW-DIALOG-LINE`, `MENU-DEFINITION`,
`MODAL-DIALOG-FILTER`, `QUICKDRAW-ARCPROC`, `QUICKDRAW-BITSPROC`,
`QUICKDRAW-COMMENTPROC`, `QUICKDRAW-GETPICPROC`, `QUICKDRAW-LINEPROC`,
`QUICKDRAW-OVALPROC`, `QUICKDRAW-POLYPROC`, `QUICKDRAW-PUTPICPROC`,
`QUICKDRAW-RECTPROC`, `QUICKDRAW-RGNPROC`, `QUICKDRAW-RRECTPROC`,
`QUICKDRAW-TEXTPROC`, `QUICKDRAW-TXMEASPROC`,
`STANDARD-FILE-DIALOG-HOOK`, `STANDARD-FILE-FILE-FILTER`,
`TEXT-EDIT-CLICK-PROC`, `TEXT-EDIT-WORD-BREAK-PROC`, `WINDOW-DEFINITION`.

**MacBinary (147–161):** `MACBINARY`, `MAKE-MACBINARY`,
`MACBINARY-VERSION`, `MACBINARY-NAME`, `MACBINARY-TYPE`,
`MACBINARY-CREATOR`, `MACBINARY-FLAGS`, `MACBINARY-LOCATION`,
`MACBINARY-WINDOW`, `MACBINARY-LOCK`, `MACBINARY-DATA-FORK-LENGTH`,
`MACBINARY-RESOURCE-FORK-LENGTH`, `MACBINARY-CREATION-DATE`,
`MACBINARY-MODIFICATION-DATE`, `MACBINARY-COMPUTER-TYPE`.

### MacIvory Development boundary

No `MacIvory Development` system declaration or development source subtree was
found in the inspected source snapshot.  Installed Help describes development
user-interface tools, says the system is relevant on 3600-series machines, and
says all Ivory worlds contain it.  Those statements are retained as installed
documentation claims.  They do not supply a complete command or API inventory,
and the base VLM's differently named `MACIVORY-D&E` system does not close that
gap.

**TODO:** locate a licensed release with the `MacIvory Development` declaration
and source or a public programmer's reference that enumerates its exact additions;
then distinguish those additions from the Support system and generic Dynamic
Windows APIs.

## The remote Genera program on a MacIvory

### Frame, menus, commands, and keybindings

The source defines a remote-program framework named `GENERA`, selectable only
when the remote-system type is `:MAC`.  It represents a Genera console inside a
classic Macintosh application, queries the host's displays, creates an RPC
console, and converts Genera command/menu metadata into native Mac menu state.

The declared menu order is File, the standard Edit template, and Options.  File
names Close and Quit; Options contains a Keyboard submenu.  The source defines
these seven direct program commands and two direct menu-to-command handlers:

| User-facing item | Definition kind | Arguments/defaults | Direct keybinding | Effect |
| --- | --- | --- | --- | --- |
| Fixed Screen / Movable Screen | one toggle command with state-dependent label | none | none | switch the remote console between fixed and host-style movable screen geometry |
| Enable Backup Screen / Disable Backup Screen | one toggle command with state-dependent label | none | none | enable or disable the RPC backup screen; item disappears if backup screens are forced globally |
| Start Screen | program command, normally used as initial application command | eight choices described below | none | construct and start the remote Genera console |
| Cut | menu handler into `Edit Cut/Copy` | internal Boolean `Cut` = Yes | Super-X / Mac Command-X | copy marked Genera text to the Mac scrap and delete it |
| Copy | menu handler into `Edit Cut/Copy` | internal Boolean `Cut` = No | Super-C / Mac Command-C | copy marked Genera text to the Mac scrap without deletion |
| Paste | program command | none | Super-V / Mac Command-V | copy the Mac scrap to the Zwei kill ring and inject it into the selected Genera input editor |
| Keyboard Control | program command | none | none | select Keyboard Control on this RPC console |
| Common settings | program command | Apple Extended choices described above | none | edit common shift and mouse-key mappings |
| Quit | inherited from `REMOTE-QUIT-COMMANDS` | none | Super-Q / Mac Command-Q | quit the remote program |

`Edit Cut/Copy` is one direct command with a Boolean; Cut and Copy are two menu
handlers that instantiate it.  Thus the table has nine user-facing actions but
seven program-command definitions plus inherited Quit.

The standard Edit template also names Undo with Super-Z and Clear, but no direct
handler for either appears in the Genera program source.  They are not asserted
as implemented.  The File menu ordering names Close, but this frame inherits only
`REMOTE-QUIT-COMMANDS`, not the framework that defines Close/Close All viewer
commands.  Close might be host-reserved behavior; its exact effect is a runtime
`TODO`.  `Close All` is part of the generic remote-viewer framework and is not in
this Genera frame's declared File menu.

An internal `Mac Window Scroll` Command Processor command exists in a private
Mac Window Control table for presentation-driven scrolling.  It has no user menu
item or accelerator in this frame and is not counted as a user command.

### Complete Start Screen surface

| Argument | Default | Conditional behavior |
| --- | --- | --- |
| Initial Activity | `Initial Lisp`; alternative `None` or a named activity | always shown |
| Screen Number | `Default` (0), or 1 through number of remote screens | shown only when the host reports more than one screen |
| Movable Screen | current program setting | always shown |
| Backup Screen | current program setting | hidden when backup screens are globally forced |
| Color | No | shown only when at least one host screen has depth greater than one bit |
| Who Line | Yes | always shown |
| Main Screen | Yes only for an embedded agent when no main console exists | always accepted |
| Display Device Type | `Genera fonts installed on Mac` | alternatives `Genera fonts as images` and `Just Mac fonts` |

If the chosen display is smaller than 900×700 and uses installed Genera fonts,
the source substitutes a small-screen display device.  A movable screen deducts
20 pixels from the reported host height for the title bar.  Screen number and
Color are forcibly reset to safe values when their conditional questions were
not presented, avoiding stale defaults from a preconstructed command.

### Configure MacIvory Application

`Configure MacIvory Application` is a no-argument `World Building` Command
Processor command that opens an Accept Values form and writes a configured
classic Macintosh application.  Its complete direct input surface is:

| Field | Default or constraint |
| --- | --- |
| From file | current Mac application on a MacIvory, otherwise no default; must exist |
| To file | no default; output pathname |
| Application | optional remote-program name valid for `:MAC`; may derive from output name |
| Version | required Mac version resource value |
| Minimum and recommended memory (KB) | initially 256 and 750; minimum at least 128; minimum must not exceed recommended; inherited SIZE values are rounded to KB and clamped |
| Agent | Embedded; alternatives TCP, Serial, Reliable Serial |
| Remote host | only for TCP; default `Listen for connection`, otherwise a Genera host |
| About box description | only when an application is selected; at most 255 characters |
| Initial application command | only when an application is selected; parsed in that remote program's command table |

The implementation reads the template's data and resource forks, replaces the
application configuration, version, memory, and description resources, and
writes the new Macintosh file.  That is a mutating build operation; it was not
run against the preserved media.  A correct future test needs a disposable copy
of a period Mac application and a host able to preserve both forks.

### Ivory menu and control panel

The classic Mac host software also supplies an `Ivory` menu outside the remote
Genera command table.  Its state-dependent inventory is:

| While Lisp is running | While control is in the FEP |
| --- | --- |
| Restart Lisp | Transfer to Lisp |
| Cold Boot Lisp | Restart Lisp |
| Transfer to FEP | Cold Boot Lisp |
| Restart FEP | Restart FEP |
| Cold Boot FEP | Cold Boot FEP |
| Shut Down | Shut Down |
| Hide/Show Cold Load | Hide/Show Cold Load |
| Enable/Disable Network | Enable/Disable Network |

`Restart Lisp` preserves virtual-memory contents while reinitializing processes
and network connections; `Cold Boot Lisp` discards that state.  Network enable
or disable transfers the single Ethernet interface between Ivory and the Mac.
Those meanings come from the public MacIvory manual and C library API, not from a
local MacIvory run.

The MacIvory Control Panel has three functional panes:

- **Hardware status:** Ivory processor and NuBus memory, with raw MB and usable
  40-bit-plus-ECC megawords.
- **Status and configuration:** Configure, an immediate `Ethernet Grabbed`
  checkbox, Status, and Help.
- **Disk partitions:** inspect, create, and delete MacIvory partitions, plus a
  Copy/Compare utility for MacIvory partitions or Macintosh disks and its Help.

Disk creation/deletion, cold boots, network ownership, and shutdown are
materially mutating operations.  They were not exercised for documentation.

### Screenshot status

**Screenshot TODO:** no MacIvory-capable host, application resource fork, or
classic Mac UI runtime was available to the isolated VLM harness.  The VLM release
explicitly excludes the separate MacIvory systems, so a Genera X-window capture
would not verify these native menus or dialogs.  A future capture should use
rights-cleared period Mac system software and disposable disk images, record both
host and Lisp artifacts, and stop before executing cold boot, partition, network,
or application-output actions.  Public manual illustrations are evidence but are
not republished as a substitute for a runtime observation.

## HyperCard-MacIvory

HyperCard-MacIvory demonstrates a two-way bridge.  A HyperCard external function
named `CallIvory` sends a routine name and argument string through RPC.  Genera
finds the corresponding Lisp XFCN server and returns three logically separate
results: an error description, text written to standard output, and the Lisp
values.  While HyperCard waits, its XFCN continues serving RPC, which allows the
Lisp server to call back into HyperCard rather than deadlocking on a strictly
one-way request.

The loadable-system entry requires `Mac-Dex` and says this interface always uses
an embedded channel.  Consequently it is useful only on MacIvory in the documented
form, even though the underlying RPC system has network and serial agents.

### The twelve demonstration cards

| Card | Demonstrated integration |
| --- | --- |
| HyperIvory Apologia | purpose and orientation |
| HyperIvory menu | entry point to the demos |
| IvoryCom | low-level direct access to `CallIvory` |
| Stack Dumper | serialize much of a stack to a Lisp-readable text form |
| EVAL Service | evaluate entered Lisp forms |
| Ivory At Your Command | issue Genera Command Processor commands |
| The Obligatory Flavor Demo | compute components and dependents of a named Flavor |
| Spellbound | spelling service and worked server-definition example |
| The Hypertext Delivery Story | HyperCard front end to Genera Document Examiner material |
| Iconizer | extract Finder desktop icons and place them on cards |
| Map | compute and display routes among towns |
| Mug Shots | retrieve and display records from a Statice database |

These are manual descriptions of the distributed stack, not locally executed
claims.  In particular, the Statice, Joshua, Finder, and Document Examiner demos
depend on additional data and programs whose presence was not established here.

### HyperTalk and Lisp bridge API

The complete documented HyperTalk surface has six routines:

| Routine | Role |
| --- | --- |
| `CallIvory(routineName, routineArgs)` | invoke a named Genera server and return the composite result string |
| `ResultError(results)` | extract the error portion |
| `ResultTypeout(results)` | extract standard-output text |
| `ResultValues(results)` | extract all returned values separated by returns |
| `ResultNValues(results)` | extract the returned-value count |
| `ResultValue(results, valueNumber)` | extract one one-based returned value |

At the documented Lisp boundary, the complete bridge-specific surface has these
nineteen names:

- server control: `MTB:*DEBUG-HC-SERVER-FLAG*` and
  `MTB:DEFINE-XFCN-SERVER`;
- string parsing: `MTB:HC-CHUNK-CHARACTER` and `MTB:HC-CHUNK-ITEM`, both using
  zero-based indices unlike HyperTalk chunks;
- scoped allocation and drawing: `MTB:WITH-HC-ZSTRING`,
  `MTB:WITH-HC-EVAL-EXPR`, and `MTB:MAKING-QD-PICTURE`;
- implemented callbacks: `MTB:HC-SEND-CARD-MESSAGE`,
  `MTB:HC-SEND-HC-MESSAGE`, `MTB:HC-EVAL-EXPR`, `MTB:HC-ZERO-BYTES`,
  `MTB:HC-GET-GLOBAL`, `MTB:HC-SET-GLOBAL`,
  `MTB:HC-GET-FIELD-BY-NAME`, `MTB:HC-GET-FIELD-BY-NUM`,
  `MTB:HC-GET-FIELD-BY-ID`, `MTB:HC-SET-FIELD-BY-NAME`,
  `MTB:HC-SET-FIELD-BY-NUM`, and `MTB:HC-SET-FIELD-BY-ID`.

`WITH-HC-ZSTRING` and `WITH-HC-EVAL-EXPR` free their temporary Mac handles on
exit.  The lower-level getters can return allocated handles for which the caller
is responsible.  The manual warns that leaking those handles exhausts the
HyperCard heap and that stopping an XFCN server in the Genera Debugger can also
stop HyperCard's UI service.

The five general CallIvory servers supplied by the interface are
`LIST-ROUTINES`, `ECHO-ARG`, `BEEP-SOME`, `EVAL-SOME`, and `COMMAND-SOME`.
Seven named demo servers support the cards: `FLAVOR-PARTS`,
`CARDS-FOR-ALL-DESKTOP-ICONS`, `CARDS-FOR-SAGE-TOPIC`, `MAP-HACK-CLICK`,
`LIST-MUGSHOTS-STARTING-WITH`, `GET-MUGSHOT-FOR`, and `GET-MUGSHOT-FOR-1`.
The last seven are examples/application entries, not generic bridge primitives.

### Deliberately unimplemented HyperCard callbacks

The public manual explicitly lists seventeen HyperCard callbacks that the remote
bridge does not implement because Lisp already handles their string, coercion,
or conversion work:

`BoolToStr`, `ExtToStr`, `LongToStr`, `NumToHex`, `NumToStr`, `PasToZero`,
`ReturnToPas`, `ScanToReturn`, `ScanToZero`, `StringEqual`, `StringLength`,
`StringMatch`, `StrToBool`, `StrToExt`, `StrToLong`, `StrToNum`, and
`ZeroToPas`.

This is a useful limit: “callbacks into HyperCard” never meant every callback in
the HyperCard host API.

### Source and screenshot status

The installed manuals and loadable-system Help identify the historical source
directory and stack, but neither the HyperCard/MacIvory Lisp examples nor the
HyperIvory stack is present in the inspected licensed source snapshot.  No local
source-derived claim is made about card button layouts or scripts.

**Screenshot TODO:** obtain a rights-cleared HyperCard runtime and the matching
HyperIvory stack plus Lisp-side system, run them on a disposable MacIvory setup,
and capture one card together with the minimum Genera response needed to prove
the round trip.  The current VLM cannot supply the embedded Mac channel, and a
manual scan is not a runtime substitute.

## Mac-Dex

Mac-Dex is the Macintosh Document Examiner example for the remote-program
framework.  The loadable-system entry describes a standard Macintosh application
paired with a Lisp-side program defined through
`DW:DEFINE-REMOTE-PROGRAM-FRAMEWORK`.  The Lisp side can run on an Ivory or a
3600-series machine; a non-NuBus Macintosh can connect to the latter over a
supported RPC transport.

The documented operating sequence is:

1. load `Mac-Dex` in Genera;
2. quit the Genera application if it is occupying the Mac UI;
3. double-click the Mac Dex application;
4. use its Lookup menu to request documentation.

The installed Help record and manual commentary are not sufficient to reconstruct
the complete Lookup menu, window controls, keyboard equivalents, result
navigation, or error states with high confidence.  The relevant source system and
Mac application are absent from this snapshot.  Those details remain `TODO`
rather than being inferred from the ordinary Document Examiner.

**Screenshot TODO:** locate the exact Mac-Dex application and matching Lisp
sources, preserve both forks and hashes, then exercise only lookup and navigation
on a disposable classic Mac/MacIvory environment.  Until then no screenshot can
verify the user surface.

## DBFS Utilities in this integration family

`DBFS-Utilities` is grouped here because the Genera installation media presents
it alongside loadable host/integration systems, not because it uses MacIvory RPC.
It requires `Statice-Runtime` and selects the `Statice File System Operations`
program with `Select Shift-D`.  The deeper architecture, recovery semantics, and
source evidence are documented in
[Statice persistent object and database environment](statice-persistent-object-and-database-environment.md#statice-file-system-operations-program).

The complete 19-item top menu in the inspected maintenance program is:

| # | Menu item | Purpose |
| ---: | --- | --- |
| 1 | Complete Backup | write a complete Statice File System backup volume set |
| 2 | Compare Backup Volume Set | compare backed-up pages with the selected file system |
| 3 | Complete Restore | destructively replace databases from a complete backup |
| 4 | Selective Restore | recover selected database paths under explicit conflict policy |
| 5 | Show Backup History | query recorded runs for a Statice File System |
| 6 | Find Backup Volumes | locate volumes by database filename or file ID |
| 7 | Describe Backup Volume | report a tape volume's label/library information |
| 8 | Initialize Backup Volume | label and register a backup volume |
| 9 | Create Statice File System | create DBFS directory, log, and partition configuration |
| 10 | Describe Statice File System | report server and storage configuration |
| 11 | Delete Statice File System | destroy the file system and databases after confirmation |
| 12 | Show All Statice File Systems | enumerate namespace-registered DBFS services |
| 13 | Enable Statice File System | enable one local file system |
| 14 | Disable Statice File System | disable one local file system |
| 15 | Enable Statice | start the Statice/DBFS service layer |
| 16 | Disable Statice | stop the service layer |
| 17 | Add Statice Partition | attach an FEP partition and size |
| 18 | Show Statice Partitions | list configured partitions |
| 19 | Help | enter program Help |

The lower interactor also installs Show Directory, Create Statice File System,
Delete File, Rename File, Show File, Expunge Directory, Copy Statice Database,
Delete Statice File System, Show All Statice File Systems, Add Statice Partition,
and Show Statice Partitions.  `Show DBFS Meters` exists internally.  This is the
same complete inventory as the Statice dossier; it is repeated to make the
loadable-system entry self-contained, not to imply an independent implementation.

**Screenshot TODO:** the program is not loaded in the base world, and a useful
capture requires a disposable DBFS configuration.  A future capture must stop
before End on any backup, restore, delete, partition, or service-state form and
undergo a capture-specific rights review.

## Cross-evidence discrepancies and limits

| Topic | Evidence that disagrees or stops short | Resolution used here |
| --- | --- | --- |
| CADR UNIX interface | System 46 has no declaration; System 303 declares it but lacks all three main modules and excludes it from `Outer System` | document declaration and absence only; do not infer behavior from filenames |
| UNIX file lookup default | low-level source initializes file lookup false; installed documentation says true; loading NFS Common changes the default to true | identify load order explicitly |
| `UX Development` | product/system name suggests tools; declaration and active Help contain no files | call it an empty dependency shell in this snapshot |
| MacIvory development naming | Help names `MacIvory Development`; base VLM reports `MACIVORY-D&E`; source declaration is absent; VLM release excludes the separately named Mac systems | preserve all three observations without equating them |
| AppleTalk Manager | installed Toolbox Help has a section; Mac Toolbox declaration says AppleTalk is the one manager not included | do not claim an AppleTalk implementation from documentation alone |
| Keyboard layout list | installed UX Help lists fourteen layouts; later source contains NDS, DEC, and four IBM PC variants but Mac layouts are resource-driven | treat each list as a release/layer-specific inventory |
| Keyboard Control runtime | activity and source are present; the VLM returns layout type `NIL` and rejects the activity | document the exact blocker and leave visible program behavior to a recognized-keyboard run |
| Genera Mac Edit/File menus | template names Undo, Clear, and Close; direct Genera handlers exist for Cut, Copy, Paste, and Quit, not those three | labels alone are not counted as implemented commands |
| HyperCard and Mac-Dex | manuals and loadable-system Help describe them; matching application/source artifacts are absent | document interface contracts and workflows, leave exact UI controls and runtime behavior as `TODO` |
| DBFS `Find Backup Volumes` | later program source includes it; public Statice 2.0 command dictionary does not | label it a later source-visible addition in the Statice dossier |

No RPC, UX, HyperCard, Mac-Dex, or DBFS network transaction was sent during this
study.  The only runtime evaluation was the read-only keyboard-layout query.
Protocol behavior is source/manual/RFC-grounded; configured peer interoperability
remains untested.

## Open preservation questions

- Where are the missing System 303 `lamtty`, `share-chaos`, and `iomsg` sources,
  and which historical system/version first carried them?
- Does an earlier or later Genera release populate `UX Development`, and if so,
  which APIs belong to it rather than RPC Development?
- What exactly does `MACIVORY-D&E` contain in the VLM world, and how does that
  registry name relate to the documented Support and Development products?
- Can a matching MacIvory Development declaration and public programmer's
  reference be located without redistributing proprietary source?
- Does a period Mac runtime give the Genera program a host-reserved Close action,
  and are Undo or Clear ever installed dynamically?
- Which exact HyperIvory stack and Mac-Dex application versions match the
  inspected Open Genera source and documentation?
- Can the harness advertise one already-supported keyboard identity without
  weakening its exact, byte-scoped X compatibility rules?
- What configured UNIX versions interoperate with the source's `rexec`, `rmt`,
  LPD, NIS, and authentication assumptions?

## Portable provenance

### Licensed source witnesses

All paths in this table are relative to the licensed `sys.sct/` root.  They are
identifiers and hashes, not repository links.

| Artifact | Bytes | SHA-256 | Principal use |
| --- | ---: | --- | --- |
| `embedding/rpc/sysdcl.lisp.~66~` | 4,072 | `ee6085b06ec1fb2ca33e616a16c154cb4d76c46c9170292268da075450f62963` | RPC runtime composition |
| `embedding/rpc/rpc-development.lisp.~6~` | 3,999 | `91c97683940ddd655fb4f1596aaf083f61b8608d97e56392c431a31d4606d328` | RPC Development composition |
| `embedding/embedding-support.lisp.~9~` | 3,993 | `6de498a24cd41d81e9b48b0202b7d6ec9bc36bf68463bbfc552d660757c95ac9` | embedding dependencies and subsystems |
| `embedding/ux/ux-support.lisp.~6~` | 3,334 | `b11cde81b238ab1b9eb40ae1a0bf67c1900d11d53de5325101ecc3f7cf11dbda` | UX Support composition |
| `embedding/ux/ux-development.lisp.~4~` | 3,286 | `2d75d4850aff30a9285c8e04d55c0e3f8597405d670063be94faa87dacd5b022` | empty UX Development declaration |
| `embedding/ux/unix-protocols.lisp.~9~` | 9,009 | `1cb8abe55c9bf9caadb166da1a76b1a540f7575700c1838364a97171ee7fbf5d` | `rexec`, `rsh`, and Execute Command |
| `embedding/macivory/macivory-support.lisp.~47~` | 6,646 | `c0895e7f652d32fb5cb5010cb51de3174578ff928ad217799b79885765ac8944` | Mac support and Toolbox declarations |
| `embedding/keyboards/keyboard-control.lisp.~9~` | 52,058 | `49520e5a6fdb427c3af7b734c88d2cedf588613aafdddc752b15df78f3d9a8ed` | Keyboard Control frame and commands |
| `embedding/keyboards/keyboard-layout.lisp.~113~` | 20,458 | `b0127eca4cfe454da6808f8684daf966a15173b6b07983ffac0e1421bc88a40c` | layout model and presentation types |
| `embedding/keyboards/keyboards.lisp.~95~` | 58,560 | `36990f02428ad4780c26c67b1d515224cc33bb5054259ea77bb1403e2c2fe393` | workstation keyboard layouts |
| `embedding/keyboards/pc-keyboards.lisp.~3~` | 17,233 | `f2a8b8f799a5d4eccfef552923a7b7a045d75970f53d69acfa390a664852eb5b` | four IBM PC layouts |
| `embedding/rpc/stream-agent.lisp.~22~` | 10,803 | `701494469344fec17037eef7cd6f9048822f577edc0eb8acfc7fdd548e5e1f1b` | stream protocols, ports, Chaos contact |
| `embedding/rpc/ui/macintosh/remote-program.lisp.~38~` | 26,350 | `ef4a39517bb7e178029fe07ae10f2d227b5631af089ecf604bb2dc0fb7a72be6` | generic remote-program framework |
| `embedding/rpc/ui/macintosh/genera.lisp.~93~` | 53,915 | `b219307b52aa3d5a26e461032a6c59c3316e0517119610a1548652051d230f2b` | remote Genera console and commands |
| `embedding/rpc/ui/macintosh/uims.lisp.~221~` | 79,089 | `ae3d8054062bb0a58bc021881bed072a34099836c31ecc9ac110e60780e7bbe7` | remote windows, menus, viewers, and standard commands |
| `embedding/rpc/ui/macintosh/uims1.lisp.~5~` | 30,113 | `0de28cb412bd4bfe056f5ab6cbac65c2c199898ed685675b09d0fe0ad28fdc3b` | remote event UI layer |
| `embedding/macivory/ui/file-formats.lisp.~39~` | 29,952 | `70b521b6bf90116def9cd0b33be736fc0a14ca4699db2962dd6d435e576e0511` | Configure MacIvory Application |
| `sys/pkgdcl.lisp.~1343~` | 293,126 | `48a2dc4950a21bcfd99444883911875f13f2c16ee75e96beff88dd5111ee4709` | RPC and Mac Toolbox package exports |
| `nfs/unix-name-lookup.lisp.~2021~` | 77,118 | `763a06b8ce78ba80fa1f3719cfce9646f826faf6dbf0249f5163fabe8db8d7f7` | UNIX identity lookup and defaults |
| `nfs/udp-agent.lisp.~2031~` | 46,923 | `a1015565a4e8961037e42e14115874c55529a898e33926ac17ce9a13b1de04c1` | UDP RPC timeouts and registrations |
| `nfs/nfs-common.lisp.~2003~` | 14,683 | `0e559ad28d56ebf57cc67751bb25327c2c12b884ac38c6f54acb300e87f611fa` | load-time file-lookup default change |

### Installed Help witnesses

The tracked inert extractor
[`scripts/extract-genera-help.py`](../scripts/extract-genera-help.py) is 55,939
bytes with SHA-256
`e59440906a0092afe28ca514be9e7afdf6c21ca1009b765a710f0a4121f13a74`.
Its ignored catalog is 577,696 bytes with SHA-256
`a089d1e64e65e06471ef5bb90533164242267c9f8eb1067062a41796998c1aed`;
the ignored source-form Help inventory is 9,817,347 bytes with SHA-256
`8e59a784b805808e86b84be58fea8622f64fb3e79d7d0603ef64ce0ed1365190`.

| Installed SAB, relative to `sys.sct/` | Bytes | SHA-256 | Records |
| --- | ---: | --- | ---: |
| `doc/installed-440/rpc/rpc1.sab.~23~` | 125,344 | `ab12823ab8de66b926976a9eee2bc8f9904b60a7171398b90f7c40e1a70523c9` | 47 |
| `doc/installed-440/rpc/rpc2.sab.~22~` | 36,591 | `0c5e3128871f6a2dbd2347eb463d93a57d111cd7fe08c0d19160987da6bba650` | 32 |
| `doc/installed-440/ux400/net-rpc.sab.~11~` | 36,884 | `6770172274ff1f229b6f6738f374f169f431007f765746233493120e174534f6` | 30 |
| `doc/installed-440/ux400/ux2.sab.~31~` | 92,794 | `4e2cd34e22d4bca8535ed94c4568c0bcd35ef3b0cb6f00ec1fdb03e43f0bc99f` | 25 |
| `doc/installed-440/ux400/ux3.sab.~33~` | 64,557 | `0e3452fc75c365510fc18a1a39512ea5190467e7f20b007b7bc184fe5f258ce6` | 26 |
| `doc/installed-440/ux400/ux4.sab.~7~` | 44,197 | `735df2b3c17273fd19d8de266354b777a5619938631d0046c237814e52b62fa5` | 49 |
| `doc/installed-440/macivory/toolbox5.sab.~4~` | 109,918 | `3e9bed2cd62b57e171e51d2c23cbcdfaf3a8b44af41c7b3be1a7663a8c111b4b` | 39 |
| `doc/installed-440/sig/genera-loadable-systems.sab.~12~` | 45,698 | `c90741ad4d2ba9b23c8868f63164276c2d9aa995d82b52388d256bedfd0d487a` | 31 |

Record counts are inert extractor records, not counts of commands or APIs.
Decoded content remains ignored under `build/help/genera/`.

### Runtime witness

The runtime source and execution identities for the Keyboard Control probe are:

| Artifact | Bytes when recorded | SHA-256 |
| --- | ---: | --- |
| purchased archive `opengenera2.tar.bz2` | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| base and private `Genera-8-5.vlod` | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| private VLM executable at execution | 1,533,760 | `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| private VLM debugger | 346,880 | `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| private `.VLM` configuration | 285 | `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| X compatibility preload at execution | 21,280 | `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| exact-ifconfig preload at execution | 15,248 | `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7` |
| one-shot RFC 868 responder | 10,032 | `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb` |

Tracked harness-source hashes at start were Python harness
`bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`,
Guix entrypoint
`e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05`,
VLM helper
`cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8`,
namespace helper
`17a3e297930eef45a6f59a349f92ec1f6dc99b2c4d5caa2392dc0521636af01c`,
X preload source
`4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392`,
and ifconfig preload source
`a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7`.

The Guix manifest SHA-256 was
`3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`
at channel commit `230aa373f315f247852ee07dff34146e9b480aec`.  Principal tool versions were
Guix 1.5.0, Bubblewrap 0.11.0, Xorg server 21.1.21, Python 3.11.14,
ImageMagick 6.9.13-5, and xdotool 3.20211022.1.

## Public primary sources

All public links in this section were fetched successfully on 2026-07-18.

- [MIT CADR System 46 source at commit `8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af/src),
  with [its license](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/LICENSE), whose bytes have
  SHA-256 `05b8de7c86c946cc747ab71a9aaa7dd56e37365278b5585ab685156eaa90fb92`.
- [LM-3 System 303 check-in `4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91)
  and its exact [`sys/sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp).
- [RFC 1057: RPC version 2](https://datatracker.ietf.org/doc/html/rfc1057) and
  [RFC 1014: XDR](https://datatracker.ietf.org/doc/html/rfc1014).
- [*MacIvory User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/MacIvory_User_s_Guide.pdf),
  especially “Controlling the Ivory Coprocessor”, “Using the Ivory Menu”,
  “Using the MacIvory Control Panel”, “Developing User Interfaces with MacIvory”,
  and “MacIvory Interface to HyperCard”;
  939,014 bytes, 188 pages, SHA-256
  `61881c6c26f08bfe20a11a52db9cd4af9324ab40e3ab18fe2c6e9eb2cb05f486`.
- [*MacIvory Delivery User's Manual*](https://bitsavers.org/pdf/symbolics/software/genera_8/MacIvory_Delivery_User_s_Manual.pdf),
  “Overview of the MacIvory Delivery Software” and “Technical Description of the
  MacIvory Delivery Software”;
  135,457 bytes, 16 pages, SHA-256
  `41239c9139327331f650c431712d07cad83be6a777d00bc8a9de64ae610cc2e7`.
- [*Genera 8.3 Software Installation Guide for MacIvory Machines*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_MacIvory_Machines.pdf),
  loadable-system entries “DBFS-Utilities”, “HyperCard-MacIvory”, and “Mac-Dex”;
  518,507 bytes, 75 pages, SHA-256
  `31cc677db1b14e141b8332675cb068432d53efb5482cea4254a1513977944c46`.
- [*Genera 8.3 Software Installation Guide for UX Family Machines*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_UX_Family_Machines.pdf),
  the same loadable-system entries and UX installation boundary;
  498,160 bytes, 75 pages, SHA-256
  `f8c09d757e08c65094676b76f5ad8d2e95d4b1309962c60cf26d463e57c2a126`.
- [*Networks*](https://bitsavers.org/pdf/symbolics/software/genera_8/Networks.pdf),
  “The Remote Procedure Call Facility” and “Symbolics RPC and Sun RPC”;
  1,060,873 bytes, 261 pages, SHA-256
  `0c2b3d558998a6e7a4a7a47a58e3000707284369683c09caaebb00b4f5d78329`.
- [*Symbolics X Window System User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_X_Window_System_User_s_Guide.pdf),
  “Keyboard Support in the Genera X Client” and “Hardcopy Keyboard Layout”;
  151,207 bytes, 21 pages, SHA-256
  `ea8ca58cecdf6ec356a922ae5bbb8c637c7f4daa8735e8328d20d4bfbc84cd9e`.
- [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  “Open Genera Architecture”, “The genera Digital Unix Application”, and “Open
  Genera Keyboard Support”;
  213,075 bytes, 29 pages, SHA-256
  `174563f2e7939c990b7e730911e1b4d49f30f7a172e942c2e3a107d906625874`.

Related museum dossiers provide the wider
[network transport context](network-transports-and-protocol-architecture.md#rpc-and-nfs-transport),
[file-system context](file-systems-and-file-service.md), and
[Genera Help recovery method](genera/online-help-and-documentation-recovery.md).

## Validation

- Recounted the package declarations and checked that all 192 `RPC` and all 161
  `MAC-TOOLBOX` external names occur in the inventories above.
- Searched the pinned System 46 Git tree and System 303 Fossil check-in by exact
  tree membership, then fetched the System 303 declaration and all three missing
  module endpoints independently.
- Recomputed the licensed embedding manifest, selected source hashes, public PDF
  hashes/page counts, inert Help hashes/counts, and runtime sidecar hashes.
- Parsed the frontmatter as YAML, checked the one-H1 rule, local file links and
  heading anchors, tabs and trailing whitespace, and rendered the page from GFM
  to HTML with Pandoc without an error.
- Fetched every public source URL above successfully on 2026-07-18.

Last verified: 2026-07-18
