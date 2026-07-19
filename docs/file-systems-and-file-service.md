---
type: Historical Article
title: File systems and file service on CADR and Genera
description: An implementation and interface dossier on System 46 QFILE, LM-3 Local-File and LMFILE, Genera pathname access paths, QFILE, NFILE, NFS, LMFS, file commands, and the File Server program.
tags: [mit-cadr, lm-3, genera, file-system, pathname, qfile, nfile, nfs, lmfile, lmfs, file-server]
timestamp: 2026-07-18T07:14:15-04:00
---

# File systems and file service on CADR and Genera

The Lisp-machine file environment was not one file system. It was a stable
pathname-and-stream interface above changing local stores and network protocols.
MIT System 46 normally reached ITS or TOPS-20 through QFILE and a PDP-10 `FILE`
job. The maintained LM-3 tree contains both an older local CADR disk file system
and a different, hierarchical `LFS`/`LMFILE` file computer. Genera turns protocol
choice into a host-selected file access path: the same pathname operation can use
legacy QFILE, NFILE over a reliable marked byte stream, or NFS over UDP. Its native
LMFS remains represented in Open Genera source, but the Genera 8.5 release
declaration explicitly excludes the full `LMFS` system from VLM builds.

That distinction matters to both users and historians. Dired, Zmacs, `OPEN`, and
Command Processor file commands are clients of this substrate; they are not file
systems themselves. Conversely, the Genera File Server activity is an operations
and log frame, not a file browser.

## Evidence boundaries and inventory grain

This dossier uses four deliberately separate boundaries:

| Boundary | Evidence | What it establishes |
| --- | --- | --- |
| MIT CADR System 46 | Public source at Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | The early external-file-computer model, QFILE client, PDP-10 server, and exact server command table |
| LM-3 System 303 | Maintained public Fossil tree at check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | The generic file substrate, older `LOCAL-FILE`, later `LFS`/`LMFILE`, and two server families |
| Symbolics Genera 8.5 | Licensed Open Genera source, decoded local Help used only as evidence, public Genera 8 manuals, and the existing read-only software census | The access-path architecture, protocol implementations, direct Command Processor definitions, File Server frame, and VLM release limits |
| Runtime | Existing reviewed Dired observations plus the documented unconfigured Genera base world | What has and has not been operated; no service behavior is inferred from source presence |

“Complete” has a stated grain in each section. The pathname inventory lists every
operation directly delegated by Genera's active-pathname mixin. Protocol inventories
list every command accepted by the inspected server dispatcher or, for NFS, every
NFS version 2 procedure declared in the inspected protocol module. The Command
Processor inventory lists every command defined **directly** in the `File`,
`Directory`, and `NFS` areas in the licensed source tree, with every exposed
argument and keyword. It does not repeat inherited global/session commands, hidden
Lisp functions, commented-out proposals, or all methods of every stream flavor.

## Five layers that should not be collapsed

| Layer | Representative objects | Responsibility |
| --- | --- | --- |
| Names | pathname, host, device, directory, name, type, version | Parse host syntax, merge defaults, preserve file identity, and produce truenames |
| Generic operations | `OPEN`, directory listing, properties, completion, rename, delete, expunge | Give programs one interface independent of the selected store or protocol |
| Access path or client | QFILE, LMFILE-Remote, NFILE, NFS | Select a service, authenticate, marshal operations, manage streams and connections |
| Store or server | PDP-10 `FILE`, CADR `LOCAL-FILE`, LMFILE, Genera LMFS, NFS peer | Implement names, bytes, versions, directories, links, properties, and persistence |
| User interface | Dired, Zmacs, Command Processor, File Server frame | Present operations and service state; it does not define their storage semantics |

An operation such as `Delete File` therefore crosses several layers: the Command
Processor accepts a pathname; the pathname selects an access path for its host; the
access path invokes the store's delete operation; and the store decides whether
“delete” means immediate removal or a recoverable deleted state awaiting expunge.

## Pathnames, streams, and the generic contract

### From a PDP-10 name to a host-independent object

System 46's file manual describes a machine whose ordinary files live on an AI
Laboratory PDP-10. Its QFILE implementation nevertheless already separates a host
description, host-specific filename syntax, file channels, and Lisp streams. The
later generic pathname model makes the separation explicit. A pathname has six
conventional components—host, device, directory, name, type, and version—but each
host supplies its own parser and printer. Parsing a pathname does not prove that the
file exists; opening or probing it resolves the name and can return a truename.

System 303's `FILE-SYSTEM` declaration makes this structure visible in its load
order: basic access and pathname code, host pathname syntaxes (including logical,
LMFILE, and older local-disk syntax), file I/O, then Chaos QFILE. The pathname layer
is therefore not an alias for QFILE. The same pathname and stream clients can be
backed by a local store or a remote server.

Genera preserves that model and makes access selection a first-class object. An
active pathname asks its host for a file access path for the requested operation.
If the host has no cached access path, it invokes the network `FILE` service; the
selected network protocol constructs the appropriate access-path flavor. A
pathname's host syntax and its transport are consequently related but distinct.
The access path also remembers its open streams and login state.

### Complete Genera active-pathname operation inventory

The following 15 operations are every direct delegation in the inspected
`active-pathname-mixin`:

| Operation | Purpose |
| --- | --- |
| `ALL-DIRECTORIES` | Enumerate directories understood by the selected store |
| `CHANGE-PROPERTIES` | Change one or more file properties |
| `COMPLETE-STRING` | Complete a host pathname fragment |
| `CREATE-DIRECTORY` | Create a directory, with access-path-specific options |
| `CREATE-LINK` | Create a link to another pathname |
| `DELETE` | Mark or remove a file according to store semantics |
| `DIRECTORY-LIST` | Return a header plus matching pathname/property records |
| `EXPUNGE` | Permanently discard deleted entries where supported |
| `HOMEDIR` | Obtain a verified user home directory |
| `QUIET-HOMEDIR` | Obtain a cached or plausible default without requiring a connection |
| `MULTIPLE-FILE-PLISTS` | Fetch properties in a batch, notably for directory tools |
| `OPEN` | Construct a file stream through the selected access path |
| `PROPERTIES` | Return one file's properties and the settable-property set |
| `RENAME` | Change a pathname through the selected store |
| `UNDELETE` | Restore a soft-deleted file where possible |

`PATHNAME-FILE-ACCESS-PATH` is a source-visible efficiency side door used by
`OPEN`; it avoids repeating higher-level message dispatch but does not change the
selection semantics.

### `OPEN` at the Genera 8.5 source boundary

The generic wrapper's complete directly recognized controls are:

| Control | Source-visible values or behavior |
| --- | --- |
| `:DIRECTION` | Registered values are `:INPUT`, `:OUTPUT`, `:IO`, `:PROBE`, `:PROBE-LINK`, `:PROBE-DIRECTORY`, `:BLOCK-INPUT`, `:BLOCK`, and `:TRUNCATE`; obsolete aliases `:IN` and `:OUT` remain registered. `NIL` is canonicalized to `:PROBE`. An access path can still reject a direction it cannot implement. |
| `:ELEMENT-TYPE` | A Common Lisp type, or `:DEFAULT`; it supersedes the older character/byte-size pair |
| `:CHARACTERS`, `:BYTE-SIZE` | Accepted compatibility controls; the source warns that they are obsolete when used by newer copy code |
| `:IF-EXISTS` | Access-path implementations receive a canonical policy; the common policies include new version, supersede, overwrite, append, rename, rename-and-delete, or error |
| `:IF-DOES-NOT-EXIST` | Create, error, or return no stream, with defaults derived from direction and `:IF-EXISTS` |
| `:ERROR` | `T` signals normally, `NIL` returns a condition for file-operation failures, and `:REPROMPT` asks for another pathname |
| `:INHIBIT-LINKS` | Valid only for a probe; converted to `:PROBE-LINK` |
| Common pass-through controls | The source contract identifies `:DELETED`, `:PRESERVE-DATES`, and `:ESTIMATED-LENGTH`; additional keywords are deliberately access-path-specific |

The wrapper merges defaults, forces a logged-in user context, canonicalizes obsolete
forms, computes Common Lisp defaults, and then calls `FILE-ACCESS-PATH-OPEN` with the
translated physical pathname as well as the user-facing pathname. This explains why
the same Zmacs or Command Processor operation can preserve a logical/user name while
the stream reports a different truename.

## MIT System 46: QFILE and the external file computer

### What existed at this boundary

The System 46 manual does not describe a self-hosting CADR file system. It says that
the machine uses the AI PDP-10 file system and presents local Lisp-machine file
systems as future work. The implementation loads `QFILE` and registers remote file
computers such as ITS and TOPS-20 hosts. The server in this snapshot is not Lisp
code running on the CADR: `lmio/file.238` is the MIDAS source for the PDP-10 `FILE`
job.

The later names `LOCAL-FILE`, `LFS`, and `LMFILE` must therefore not be projected
back onto System 46 merely because a later CADR load band contains them.

### How QFILE works

QFILE opens a Chaos control connection to contact name `FILE`. Commands and replies
carry transaction identifiers, so control transactions can be outstanding while
data moves. Separate reusable bidirectional data connections carry file bytes. Each
half of a data connection can serve one input or output file handle, and closing a
file does not inherently close that data connection.

The client tracks file-channel direction, character/binary mode, control and data
connections, open/closed/EOF state, and synchronous or asynchronous mark state.
Synchronous marks delimit changes such as file position or byte size. An asynchronous
error suspends a channel until it can be continued or abandoned. The who-line shows
active file operations and progress.

The client caps an ITS host unit at three reusable data connections and a TOPS-20
unit at eight. The source also warns that two independent users of one channel are
not serialized safely. This is a concrete implementation limit, not a general
property of later file protocols.

An older file in the same snapshot, `lmio1/qfile.173`, is a different interim
implementation built around shared wired QIO buffers and a communication area. It
allows only one input file and one output file at once. Its presence records
lineage; it is not evidence that the later `lmio/qfile.31` has that same two-file
limit.

### Complete System 46 `FILE` server command table

The PDP-10 dispatcher compares only the first five characters of command names. Its
ten common commands, plus one ITS-conditional extension, are:

| Class | Exact commands |
| --- | --- |
| Connection and session | `DATA-CONNECTION`, `UNDATA-CONNECTION`, `LOGIN`; ITS builds additionally accept `HSNAME` |
| File stream | `OPEN`, `CLOSE`, `FILEPOS`, `CONTINUE`, `SET-BYTE-SIZE` |
| Mutation | `DELETE`, `RENAME` |

The complete `OPEN` option table is `READ`, `WRITE`, `PROBE`, `CHARACTER`, `BINARY`,
`BYTE-SIZE`, `RAW`, and `SUPER-IMAGE`, with TOPS-20-only `TEMPORARY` and `DELETED`.
Binary byte sizes must be from 1 through 16. `READ`/`WRITE` are checked against the
handle direction; character is the default; a probe needs no data handle.

This exact release boundary is smaller than later documents commonly called “the
QFILE protocol.” The maintained System 303 protocol document adds directory,
completion, property, and capability operations, and Genera's server grows again.
Command counts are therefore meaningful only with a named source version.

## LM-3 System 303: three storage/service families

### Declared systems and their roles

| Declared system | Role | Important boundary |
| --- | --- | --- |
| `FILE-SYSTEM` (`FS`) | Generic pathnames, host syntaxes, `OPEN`, directory support, and QFILE client | Core substrate, not a store |
| `LOCAL-FILE` | Older direct file system for CADR disks | Short name `LFS`; explicitly `NOT-IN-DISK-LABEL`, but included in `OUTER-SYSTEM` |
| `FILE-SERVER` | Lisp-machine server for the later QFILE/`FILE` protocol | Serves whatever generic/local store the machine can open |
| `LFS` (nickname `LMFILE`) | Later hierarchical Lisp-machine file system | A different system from `LOCAL-FILE`, despite the older system's `LFS` short name |
| `LMFILE-SERVER` | Server component for the hierarchical file computer | Uses Chaos contact `LMFILE`, not QFILE's `FILE` contact |
| `LMFILE-REMOTE` | Remote LMFILE pathname and stream client | Marked `NOT-IN-DISK-LABEL`; includes ZMail integration |

This is a source-visible naming trap: “LFS” can mean the short display name of
`LOCAL-FILE` or the actual later system whose nickname is `LMFILE`. The two have
different representations, pathname rules, and protocols.

### The older `LOCAL-FILE`

The older store models a disk configuration, directories, basic files, files, and
links, with maps and page allocation. Attribute bits include closed, deleted,
dumped, character, directory, do-not-delete, and do-not-reap state. Its access-path
implementation describes itself as direct access to the file system on the current
disk.

At method grain, the complete access surface is 20 operations:

| Class | Exact operations | Source-visible limit or behavior |
| --- | --- | --- |
| Lifecycle and inspection | `RESET`, `OPEN-STREAMS`, `ACCESS-DESCRIPTION`, `CLOSE-ALL-FILES` | Reset closes all remembered local streams |
| User context | `HOMEDIR` | The method signals an internal-error path; this access object does not establish a home directory itself |
| File access | `OPEN`, `PROPERTIES`, `CHANGE-PROPERTIES`, `RENAME`, `DELETE`, `UNDELETE` | Uses the local node/file implementation directly |
| Directory access | `DIRECTORY-LIST`, `ALL-DIRECTORIES`, `CREATE-DIRECTORY`, `EXPUNGE` | Provides deleted-state and expunge semantics |
| Completion and batches | `COMPLETE-STRING`, `MULTIPLE-FILE-PLISTS`, `DELETE-MULTIPLE-FILES` | The batch property method explicitly identifies itself as a Dired speed optimization |
| Unsupported interfaces | `CREATE-LINK`, `REMOTE-CONNECT` | Both deliberately signal “not supported” rather than silently emulating the operation |

This implementation's `MULTIPLE-FILE-PLISTS` is a useful example of UI pressure on
the substrate: Dired can obtain properties for many displayed rows without opening
or probing each file independently.

### The hierarchical `LFS`/`LMFILE`

LMFILE treats directories as file nodes and supports a tree below a root. The
implementation is split into pack/free-space management, block I/O, files, garbage
collection, areas, nodes, name and hard links, PDP-10 compatibility, node changes,
salvage, general and special directories, directory reading, completion, streams,
and dump support. It is a store, not just a QFILE nickname.

The contemporary summary and source establish these user-visible semantics:

| Feature | Established behavior at this boundary |
| --- | --- |
| Tree names | Backslash separates path steps; `~` names the root. A semicolon can still divide directory and name portions for Lisp-machine defaulting. |
| Versions | Each step can carry `#` plus an exact integer, `>` for latest/new-version behavior, `<` for earliest, or `!` for the installed version. Zero and negative numbers count backward from the latest version. |
| Versioned directories | Directories can have versions. Creating a version initially inherits its subnodes as hard links unless that inheritance is disabled. Directories are normally supersede-protected. |
| Related-file type | A vertical bar expresses the auxiliary “type” relationship, for example a QFASL related to a source node; the document explicitly treats this as a relationship rather than an intrinsic source-file type. |
| Wildcards | `*` spans one tree level. A final `**` spans arbitrarily many levels; at this boundary a non-final `**` is only equivalent to `*`. |
| Delete and expunge | Delete is recoverable. Expunge releases deleted entries. Creating a same-name/same-version replacement uses deleted state and close-time visibility rather than instant destruction. |
| Links | Name links and hard links are implemented. The document gives a user interface for name links but says there is not yet a general user interface for creating hard links. |
| Dired properties | `@` maps to do-not-delete, `#` to do-not-supersede, and `$` to do-not-reap. Directories normally carry the first two. |
| PDP-10 access | Contact through the `FC:` device presents ITS-like names, lacks random access and nested subdirectory navigation, and cannot represent every long/tree name. A root-level link can expose a subdirectory. |

Several paragraphs in the contemporary LMFILE document are explicitly proposals:
special mailbox/database node flavors, tree-wide compilation, richer forking, and
some pathname syntax changes. They are not listed above as implemented features.

### The two System 303 servers

`FILE-SERVER` listens on Chaos contact `FILE` and implements the control/data split
expected by later QFILE clients. Its complete 18-branch direct dispatcher is:

| Class | Exact commands |
| --- | --- |
| Session/connection | `LOGIN`, `DATA-CONNECTION`, `MOBY-CONNECTION`, `UNDATA-CONNECTION` |
| Open and stream | `OPEN`, `OPEN-FOR-LISPM`, `EXTENDED-COMMAND`, `CLOSE`, `FILEPOS`, `CONTINUE` |
| Directory and mutation | `DELETE`, `RENAME`, `EXPUNGE`, `COMPLETE`, `DIRECTORY`, `CHANGE-PROPERTIES`, `CREATE-DIRECTORY`, `CREATE-LINK` |

The `OPEN-FOR-LISPM`, `EXTENDED-COMMAND`, and `MOBY-CONNECTION` branches are
implementation extensions beyond the portable command set in `doc/chfile.text`.
The public protocol document instead defines 15 portable names at its own boundary:
`DATA-CONNECTION`, `UNDATA-CONNECTION`, `OPEN`, `CLOSE`, `FILEPOS`, `DELETE`,
`RENAME`, `CONTINUE`, `SET-BYTE-SIZE`, `LOGIN`, `DIRECTORY`, `COMPLETE`,
`CHANGE-PROPERTIES`, `ENABLE-CAPABILITIES`, and `DISABLE-CAPABILITIES`.

`LMFILE-SERVER` is a separate protocol. It listens on contact `LMFILE`; the RFC
contains a user identity and first command. A connection owns one current file
stream, and a second `OPEN` is rejected until that stream is finished. Control
commands and file data share the connection, with packet opcodes separating command,
reply, character data, binary data, EOF, node boundaries, and temporary
lossage/winnage notifications.

At command-symbol grain, every server command installed in the active
`file2/server.lisp` module is:

| Class | Exact command symbols |
| --- | --- |
| Open, transfer, and stream | `OPEN`, `OPEN-FOR-PDP10`, `CLOSE`, `FINISH`, `NIL`, `START-DATA-TRANSMISSION`, `STOP-DATA-TRANSMISSION`, `NEXT-NODE`, `SET-POINTER`, `SET-BYTE-SIZE`, `STREAM-OPERATION` |
| Mutation | `DELETE`, `DELETE-STREAM`, `RENAME`, `RENAME-STREAM`, `MAKE-LINK`, `UNDELETE`, `EXPUNGE`, `CHANGE-PROPERTIES`, `DELETE-MULTIPLE-FILES`, `UNDELETE-MULTIPLE-FILES` |
| Directory and metadata | `DIRECTORY-STREAM`, `DIRECTORY-LIST`, `DIRECTORY-LIST-STREAM`, `HOMEDIR`, `ALL-DIRECTORIES`, `MULTIPLE-FILE-PROPERTY-LISTS`, `PROPERTIES`, `COMPLETE-STRING` |

The catch-all `STREAM-OPERATION` forwards only operations the opened local stream
advertised, and the probe stream exposes only properties/operations reported by the
server. This is capability discovery, not an assumption that every LMFILE node
implements every stream message.

The `LMFILE-SERVER` declaration names `SERVER` and `MAISER` as its `MAIN` module.
The maintained tree also preserves an alternate `file2/xserver.lisp` with the same
29 command definitions and several implementation differences, but it is not the
module selected by this system declaration. Source presence alone must not promote
that alternate file to the active server boundary.

## Genera 8.5 file access paths

### QFILE: retained legacy compatibility

Genera defines QFILE only over the Chaos medium. It preserves the separate control
and reusable data-connection architecture and selects specialized access-path flavors
for ITS, TOPS-20/Tenex, generic hosts, or another Lisp machine. The source retains
the historical limits of three data connections for ITS and eight for ordinary
remote hosts, while its LMFS-specific QFILE path permits 69.

The Genera server's complete 23-command dispatcher is:

| Class | Exact commands |
| --- | --- |
| Session/connection | `LOGIN`, `DATA-CONNECTION`, `UNDATA-CONNECTION`, `ENABLE-CAPABILITIES`, `DISABLE-CAPABILITIES` |
| Open and transfer | `OPEN`, `CLOSE`, `FILEPOS`, `CONTINUE`, `READ`, `ABORT`, `DIRECT-OUTPUT`, `FINISH` |
| Directory and mutation | `DELETE`, `RENAME`, `EXPUNGE`, `COMPLETE`, `DIRECTORY`, `PROPERTIES`, `CHANGE-PROPERTIES`, `CREATE-DIRECTORY`, `CREATE-LINK`, `SET-FILE-SYSTEM` |

This 23-name implementation inventory does not contradict the NFILE manual's
comparison with an 18-command QFILE baseline; it demonstrates that “QFILE” changed
between documented and implementation boundaries.

### NFILE: the preferred marked-stream protocol

NFILE is registered as a `FILE` protocol over `BYTE-STREAM-WITH-MARK`, with a higher
desirability than QFILE. Namespace service entries can offer it over Chaos or TCP;
the generic network layer chooses the path, so ordinary operations such as Zmacs
Find File do not expose NFILE as a separate application.

Commands and responses are typed token lists on a bidirectional control stream and
carry transaction identifiers. File data uses separately coordinated data channels.
Marks provide framing and resynchronization, and a suspended asynchronous-error
channel must be continued or resynchronized before normal transfer resumes. The
client supports reader-process, interrupt, and polling response paths, scavenges
idle/unsafe channels, and has direct-access streams for partial reads or writes in
addition to ordinary sequential character, binary, wide-binary, and bidirectional
forms.

The installed NFILE reference and server source agree on this complete set of 25
commands:

| Class | Exact commands |
| --- | --- |
| Session and connection | `LOGIN`, `HOME-DIRECTORY`, `DATA-CONNECTION`, `UNDATA-CONNECTION`, `ENABLE-CAPABILITIES`, `DISABLE-CAPABILITIES` |
| Open, transfer, and recovery | `OPEN`, `CLOSE`, `FINISH`, `FILEPOS`, `CONTINUE`, `RESYNCHRONIZE-DATA-CHANNEL`, `READ`, `ABORT`, `DIRECT-OUTPUT` |
| Directory and mutation | `DELETE`, `DIRECTORY`, `MULTIPLE-FILE-PLISTS`, `PROPERTIES`, `CHANGE-PROPERTIES`, `RENAME`, `EXPUNGE`, `CREATE-DIRECTORY`, `CREATE-LINK`, `COMPLETE` |

The protocol's direct operations are significant. `READ` requests a byte range for a
direct opening, `ABORT` interrupts that read, and `DIRECT-OUTPUT` binds or unbinds an
output data channel. This is different from QFILE's normal whole-stream transfer and
different again from an NFS remote procedure.

### NFS: UNIX semantics behind the same file interface

The NFS client is a Genera file access path over UDP. It uses Sun RPC and XDR, chooses
the highest usable protocol version registered for the host, maps UNIX-style
pathnames, manages mount records, translates user/group identities, and adapts a
largely versionless UNIX namespace to Genera's pathname/version conventions. A
namespace service entry `FILE UDP NFS` makes the access path available; the public
guide says it is preferred over FTP when so declared.

The protocol source's complete NFS version 2 procedure set is:

`NULL`, `GETATTR`, `SETATTR`, `LOOKUP`, `READLINK`, `READ`, `WRITE`, `CREATE`,
`REMOVE`, `RENAME`, `LINK`, `SYMLINK`, `MKDIR`, `RMDIR`, `READDIR`, and `STATFS`.

The client also declares the version 1 mount operations `NULL`, `MNT`, `DUMP`,
`UMNT`, `UMNTALL`, and `EXPORT`. These are protocol procedures, not Command
Processor commands.

Source-visible cache policy is bounded and validation-aware: directory-handle and
directory-content caches each hold 16 entries, the link cache holds 64, and their
reap periods are five minutes. Mount entries also expire after five minutes of idle
time and are unmounted by a timer. Directory entries are checked with modification
and change times; updates invalidate cache entries if the update takes longer than
the ten-second vulnerability window. These defaults explain why a Genera directory
view can be responsive without treating NFS state as permanently authoritative.

There is an important media limit. The NFS user guide describes a symmetrical
client/server product and names `NFS Server`. The inspected Open Genera source subset
contains `NFS-CLIENT` and `NFS-DOCUMENTATION` system declarations, client modules,
and server callback names in the shared protocol layer, but no NFS-server system or
server implementation. The Genera 8.5 VLM release roster likewise names only
`NFS-Client` and `NFS-Documentation`. Therefore:

- client architecture and the NFS wire contract are established here;
- the manual establishes that a Symbolics NFS server product existed; and
- the implementation and availability of that server in this exact Open Genera
  distribution remain a **TODO**, not an inferred feature.

### LMFS on Open Genera

Genera's LMFS is the Symbolics native file system, not the same implementation or
pathname syntax as the earlier MIT LMFILE. The remote pathname layer uses `>` as the
directory delimiter and `.` for type/version syntax, supplies a meaningful root,
and accepts the standard deleted/undelete semantics. Its source is useful for
understanding remote LMFS names even when no local LMFS store is available.

For release 8.5, the source roster places full `LMFS` behind `#-VLM`; it is excluded
from the Open Genera VLM release. `LMFS-DEFSTORAGE`, however, is a separately loaded
development-utilities subsystem because other systems use its storage definitions.
Seeing LMFS symbols or `LMFS-DEFSTORAGE` in the world therefore does **not** prove
that the VLM has a local native LMFS volume.

## Dired-facing operations

Dired is the principal visible client of these file semantics, but its keys belong
to the editor, not to QFILE, LMFILE, NFILE, or NFS. The complete local command tables,
menus, implementation changes, runtime observations, and reviewed screenshots are
in [Directory, difference, and buffer editors](directory-difference-and-buffer-editors.md).

The storage-facing differences are:

| Release | How the directory editor obtains and acts on files |
| --- | --- |
| System 46 | Reads fixed-format `DIR` device output into one global `*DIRED*` buffer; its semantics reflect the external PDP-10 directory model |
| System 303 | Stores exact pathname objects, uses directory/property operations including batch property lookup, supports nested LMFILE directories, and can toggle the LMFILE protection properties `@`, `#`, and `$` |
| Genera 8.5 | Builds a protected special editor node over `FS:DIRECTORY-LIST`; pathname operations select the active access path, so the same editor can address NFILE, NFS, QFILE, or another host implementation |

This is why a Dired feature cannot be used as proof that a given protocol has a
native verb. Genera can simulate `PROPERTIES` with a directory listing and
`UNDELETE` with a property change when an access path lacks a specialized operation.

## Genera Command Processor file areas

### Command-table structure

`File System` is the grouping area and has no directly defined commands in the
inspected source. `File` and `Directory` are its two direct subsets. When the NFS
client is loaded, `NFS` is added as a subset of `File`, so it inherits the ordinary
file surface while adding two NFS status commands.

The following 25 commands are the complete direct-definition inventory. Optional
systems matter: the compression commands require the Compression system, the source
comparison and development commands require their development systems, and NFS
commands require the NFS client.

### Complete `File` area: 15 direct commands

| Command | Required arguments | Exposed options and defaults | Effect or boundary |
| --- | --- | --- | --- |
| `Copy File` | file sequence; destination | `Byte Size` (no default); `Copy Properties` = author and creation date; `Create Directories` = Query (`Yes`, `Error`, `Query`); `Mode` = Default (`Binary`, `Character`, `Macintosh`, `Raw Character`, `Default`); `Query` = No (`Yes`, `No`, `Ask`); `If Exists` has no displayed default (`New Version`, `Overwrite`, `Supersede`, `Nothing`) | Expands wildcards, skips directories/links, and selects an element type per mode |
| `Create Link` | link pathname; target pathname | `Type` = Use Default (`Read-only`, `Read-write`, `Create-through`, `All`, `Use-default`); `Create Directories` = Query | Creates the physical link, then maps the requested type to link-transparency properties |
| `Delete File` | file sequence | `Expunge` = No (`Yes`, `No`, `Ask`); `Query` = No (`Yes`, `No`, `Ask`) | Deletes matches, optionally expunging each affected directory |
| `Rename File` | old pathname; new pathname | `Query` = No (`Yes`, `No`, `Ask`); `Create Directories` = Query (`Yes`, `Error`, `Query`) | Supports wildcard translation and link-opaque truenames |
| `Show File` | file sequence | none | Displays file contents with pathname/truename headings |
| `Undelete File` | file sequence | `Query` = No (`Yes`, `No`, `Ask`) | Includes deleted entries when expanding wildcards |
| `Edit File` | file sequence | `Editor` = Default, or a dynamically registered file editor | Dispatches through the editor registry; it is not intrinsically a Zmacs-only command |
| `Create File` | pathname | none | Uses the Input Editor; `End` writes and `Abort` abandons the edit; warns if the file already exists |
| `Set File Properties` | existing pathname | none | Opens the Zwei file-property editor in the current window context |
| `Clean File` | pathname sequence | `Keep Versions` = Zwei's configured retention count; `Query Each` = Yes; `Expunge` = Ask (`Yes`, `No`, `Ask`) | Deletes excess versions and optionally expunges |
| `Show Differences` | two pathnames | `Ignore` subset = none; choices are `Indentation` and `Case-and-Style` | Invokes source comparison, including wildcard translation |
| `Find String` | one or more strings | `Files`; `Systems`; `Patches` = Yes; `Branch` = none; `Include Components` = No; `Stop If Found` = No | Requires files or systems and searches their source inputs |
| `Append` | input destinations; output destinations | none | Concatenates each input and emits a fresh line between sources |
| `Compress File` | file sequence; destination | `Copy Properties` = author and creation date; `Create Directories` = Query; `Preamble Type` = Symbolics (`Symbolics`, `UNIX`); `Translation Strategy` is derived from the preamble by default; `Query` = No | Compresses to an 8-bit output stream, preserving selected metadata |
| `Decompress File` | file sequence; destination | `Copy Properties` = author and creation date; `Create Directories` = Query; `Translation Strategy` = Query (`Text`, `Binary`, `Query`, `Heuristicate`); `Query` = No | Detects the compression preamble and chooses text/binary translation |

### Complete `Directory` area: eight direct commands

| Command | Required arguments | Exposed options and defaults | Effect or boundary |
| --- | --- | --- | --- |
| `Create Directory` | directory pathname | none | Forces user login and invokes the pathname's create-directory operation |
| `Expunge Directory` | directory sequence | `Notify` = site variable, normally No (`Yes`, `No`, `Query`); `Delay After Notification` = 300 seconds; `Query` = No | Wild top-level expunges can notify the site and wait before permanent deletion |
| `Delete Directory` | directory sequence | `Confirm` = Each (`Yes`, `No`, `Each`) | Refuses ambiguous pathnames with name/type/version components, then recursively deletes |
| `Show Disk Usage` | pathname sequence | none | Totals file and deleted-file blocks without printing each file |
| `Show Directory` | pathname sequence | `Excluding` = none; `Size` = 0 blocks; `Since` = none; `Before` = none; `Author` = none; `Order` = Name (`Smallest-first`, `Largest-first`, `Oldest-first`, `Newest-first`, `Name`, `Type`); `Partition ID` = context default (`Invisible`, `Any`, or integer) | Lists deleted-state-aware directory records with filters and totals |
| `Clean Directory` | pathname sequence | `Keep Versions` = Zwei retention count; `Query Each` = Yes; `Expunge` = Ask | Same cleanup engine as `Clean File`, with a wildcard-directory default |
| `Compare Directories` | first and second pathname | `Ignore Versions` = No | Reports names present on only one side; the implementation describes itself as simple |
| `Edit Directory` | directory pathname | `Version` = All (`All`, `Newest`, `Number`) | Enters Dired for the computed pathname; `Number` prompts for an exact version |

### Complete `NFS` area: two direct commands

| Command | Argument | Behavior |
| --- | --- | --- |
| `Show NFS Mounts` | host | Obtains or creates that host's NFS access path and displays its active mount records, devices, entry points, types, and authentication description |
| `Show NFS Exports` | host | Calls the mount export procedure over UDP, falling back to TCP for the export query if the UDP RPC host does not respond |

These two status commands do not limit NFS to two operations. Ordinary inherited
file and directory commands operate through the NFS access path; the NFS area adds
protocol-specific observation.

## The Genera File Server program

The File Server activity is a Dynamic Windows operations dashboard around active
file services. Its main configuration has six panes:

| Pane | Purpose |
| --- | --- |
| Title | Fixed `File Server` title |
| File Server Log | Scrollable monitored service log |
| Listener | Interactive command/listener stream |
| File Server Commands | Command menu |
| File Server Errors | Truncated/scrollable error history |
| File Server Status | Shows either no scheduled shutdown or its time and message |

Keyboard accelerators are disabled for its private command table. The program is an
activity, but its direct Select-key registration is commented out in response to a
UI review; source directs users through Select Activity instead.

Its complete private command set is three commands:

| Command/menu label | Arguments | Effect |
| --- | --- | --- |
| `Schedule File Server Shutdown` / `Shutdown File Server` | minutes = 5; confirmed message | Schedules warnings, disables services at expiry, closes active servers, and waits boundedly for shutdown |
| `Cancel File Server Shutdown` | none | Cancels the pending schedule and notifies connected servers |
| `Reschedule File Server Shutdown` | minutes = 5; confirmed message | Replaces the pending schedule and broadcasts the change |

The source framework is shared by QFILE and NFILE server infrastructure and offers a
hook for connectionless protocols such as NFS to receive shutdown notices. This
dashboard therefore observes and coordinates services; it does not replace their
protocol-specific connection state.

## Findings visible in source but easy to miss in manuals

1. **Fallback operations are real behavior.** A Genera access path without a direct
   properties operation can synthesize it through a deleted-aware directory listing;
   undelete can be synthesized as a property change; a path with no completion method
   returns the original string with no completion. Clients must not infer a native
   wire verb from a successful generic operation.
2. **Requested sorting is verified, not blindly trusted.** The directory-stream
   mixin detects out-of-order server results and sorts them locally while preserving
   the header record.
3. **Quiet close reporting is intentionally inconsistent.** The generic file-access
   path defaults `CLOSE-ALL-FILES` to abort mode with no per-file query and no output,
   explicitly preserving older silent behavior even though other methods default to
   verbose reporting.
4. **The Genera `OPEN` header comment is stale about `:APPEND` as a direction.** A
   complete source-tree scan finds no registered `:APPEND` direction, although
   append remains a valid `:IF-EXISTS` policy. Code should use the latter.
5. **QFILE has no timeless command count.** The inspected System 46 server has ten
   common commands, the System 303 public protocol document has 15, its Lisp server
   dispatch has 18 implementation branches, and Genera has 23. These are versioned
   facts, not four estimates of one invariant.
6. **NFILE contains two stale recovery names outside its registered command set.**
   Login/shutdown dispatch tests mention `RESYNCHRONIZE` or
   `RESYNCHRONIZE-DATA-CONNECTION`, while the registered and documented command is
   `RESYNCHRONIZE-DATA-CHANNEL`. The 25-command registry and manual agree; the stray
   tests are retained as source inconsistencies, not promoted to extra commands.
7. **Several Command Processor proposals are still comments, not features.** `Delete
   File` has no exposed `Keep`; `Edit Directory` has no Property or Order option;
   `Find String` does not expose its disabled line-count option; and `Append` exposes
   neither Query Each nor Order.
8. **`Compress File` appears to have a malformed choice value.** In the inspected
   source, the displayed `Heuristicate` translation choice maps to `:DOCUMENTATION`
   rather than `:HEURISTICATE`, unlike `Decompress File`. Static evidence predicts
   that choosing it reaches an invalid strategy; runtime confirmation remains a
   **TODO**.
9. **NFS documentation is broader than this source distribution.** The manual's
   server product claim is historical product evidence, while the VLM media's client-
   only system roster is distribution evidence. Neither silently overrides the other.
10. **LMFS definitions are not an LMFS store.** Open Genera loads shared
    `LMFS-DEFSTORAGE` support while excluding full `LMFS`; symbol presence cannot be
    used as a mounted-filesystem test.

## Runtime status, screenshots, and safety

No new runtime was started for this dossier. The existing Dired article supplies
reviewed System 303 and Genera screenshots for the visible directory-editor states
and records its complete harness provenance. Reproducing those images here would add
no new evidence.

The visible File Server program and live network service paths remain blocked for
this exact museum configuration:

- the observed Genera base world explicitly says that its local site is unconfigured
  and servers are disabled;
- full LMFS is excluded from the VLM release;
- the isolated harness exposes no guest-visible NFS, QFILE, NFILE, or other file
  peer; and
- starting a server or destructive expunge against historical disks would be a
  state-changing experiment, not a read-only interface check.

**TODO — runtime and screenshot:** configure a disposable licensed Genera site and a
deterministic private NFILE/NFS peer, operate ordinary and failing file commands,
select the File Server activity, and capture only the status/log/error states needed
to substantiate the observations. Separately, prepare disposable LM-3 media and a
private Chaos peer to verify `LOCAL-FILE`, QFILE service, and LMFILE without risking
the preserved System 303 disks. Review any selected images under the repository's
[screenshot publication policy](screenshot-publication-rights-review.md). Until
then, source-visible pane titles and service behavior remain source evidence, not
claims about a running configured site.

## Preservation and rights

The System 46 and maintained LM-3 sources cited below are public preservation
materials at pinned revisions. The Genera analysis was performed on licensed local
inputs. No proprietary source or decoded manual prose is reproduced here; command
names, parameter names, counts, hashes, interface facts, and original analysis are
used as evidence.

The licensed source tree is anchored by `opengenera2.tar.bz2`, 206,213,430 bytes,
SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
Selected evacuated files inspected for this dossier are:

| Portable licensed path | Bytes | SHA-256 | Evidence role |
| --- | ---: | --- | --- |
| `sys.sct/io/file-access-paths.lisp.~203~` | 46,579 | `dffaa8e412793d4ff34572dbe1f4ef1f989c0d3f74e09ee63c4e7c42cd330fc0` | host selection, 15 operations, fallbacks, connection lifetime |
| `sys.sct/io/open.lisp.~408~` | 90,946 | `c69109607da8e016f2a5f442417f79ed51eddc765b11e2c499bfada9673e2e5f` | generic `OPEN` contract and direction registry |
| `sys.sct/io/qfile.lisp.~470~` | 87,342 | `539fbad7d13b2dffbb7573fc4a04eb0e822ab73b67ac367f909ff75f33a92ee0` | QFILE client and access-path flavors |
| `sys.sct/io/qserver.lisp.~1532~` | 60,809 | `842e14126db15fe6c49b3bab9162302dc010ccaaa1e17cea51a58ad31b9cc43f` | 23-command QFILE server |
| `sys.sct/io/nfile-user.lisp.~229~` | 101,577 | `48e186427768d729600e28571a41b16fae498705b1d9b3985ed56ddb92f06da1` | NFILE client, channels, streams, and recovery |
| `sys.sct/io/nfile-server.lisp.~1545~` | 75,193 | `d775773e04d607a3dd29369b1e3e5bd3f4004c457cd24e27786bdd0f91048e88` | 25-command NFILE server registry |
| `sys.sct/io/server-util.lisp.~1532~` | 26,867 | `709d50ae10458950563fe272e57f6eec5880bad7244305c7696eb20b8cef4fdb` | File Server program, logs, shutdown commands |
| `sys.sct/cp/comtab.lisp.~103~` | 36,295 | `f60724c8e2526950000f090f2dae4745b3394079713b3601606be865c23b98e1` | File System, File, and Directory command-table hierarchy |
| `sys.sct/cp/file-commands.lisp.~167~` | 61,930 | `7d0816d75eba38fa2477a50734551b624411e94dc9e5eb08c8555db49cfbf90a` | core File and Directory commands |
| `sys.sct/cp/utility-commands.lisp.~343~` | 36,758 | `31e1c10c3c4e7d0d40332e0a0110832fce7d42185c7979415a4905a4ecae517d` | `Append` command |
| `sys.sct/cp/development-commands.lisp.~16~` | 7,817 | `25cea8185071c62869280b82f2f84dd6cef857226d6c5e6dd7a7ee18a0c5bf50` | file-property editor command |
| `sys.sct/cp/development-commands-2.lisp.~35~` | 53,146 | `97c058d361860a393fe32e0c02bc03f5e5d1ceaff5f3bb4640b96f899439c3ce` | clean, compare, edit-directory, and search commands |
| `sys.sct/compression/user-interface.lisp.~6~` | 23,689 | `25c54724d725f342be44a809d9528353a17cf077e051dcc0259af66fd484a382` | compression commands and malformed choice evidence |
| `sys.sct/nfs/nfs-common.lisp.~2003~` | 14,683 | `0e559ad28d56ebf57cc67751bb25327c2c12b884ac38c6f54acb300e87f611fa` | NFS command-table hierarchy and shared client substrate |
| `sys.sct/nfs/nfs-client-sys.lisp.~2008~` | 3,424 | `659594fde13af2cc7f2616ef46dd3767a1e921453b46fd144713c8d83096f20d` | NFS Client system declaration and component boundary |
| `sys.sct/nfs/nfs-doc-sys.lisp.~6~` | 3,498 | `982701bff9deb4325ef81ce88d90309b618e61a933f96a1235166ed7c2b89b40` | NFS Documentation system declaration |
| `sys.sct/nfs/nfs-client.lisp.~2036~` | 131,383 | `7478e01ef019fb05bbf632d8dfb05cd50bc6cd110600fdc39e4ff647cabdf040` | NFS access path, caches, mounts, status command |
| `sys.sct/nfs/nfs2-client.lisp.~2016~` | 38,838 | `4847925d5716578dc2e6099c21a1ed543ce177fe24ca14b2a3a0c3e8b3c7b7d1` | NFS export-status command and version 2 client calls |
| `sys.sct/nfs/nfs2-protocol.lisp.~2004~` | 28,581 | `c1b2264e554c79980c71d5a8f6f6d91be5d473fd9376dc7f4f5f3f94eb96468a` | NFS v2 and mount v1 procedure declarations |
| `sys.sct/lmfs/lmfs-pathnames.lisp.~79~` | 18,054 | `d32dbc2b91283339ec75ec2cfe586b8080b38da8d4a1b177515f1b1169e6a9dc` | remote LMFS syntax and pathname behavior |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` | Genera 8.5 VLM release conditions |

Decoded NFILE and NFS Help remained under ignored `build/help/genera/`. Their source
Sage binaries have SHA-256
`1d032ae827d6bf16f6125dd52708a3180f89eda60a3a0abfeab2e04c7b188c6e`
and `be358eba2dbf5e0566c13ee1df8bf88feddd301db5dd07b74dcfedab07fb3a68`,
respectively. Those identities support verification without publishing the licensed
payloads.

## Public sources

- MIT, System 46 [`lmio/qfile.31`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/qfile.31),
  [`lmio1/qfile.173`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/qfile.173),
  [PDP-10 `FILE` server](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/file.238), and
  [file-system manual source](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmman/files.16).
- LM-3 project, System 303 [`FILE-SYSTEM` declarations](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys%2Fsysdcl.lisp),
  [`LOCAL-FILE` and `FILE-SERVER` declarations](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file%2Ffs.lisp),
  [`LOCAL-FILE` access methods](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file%2Ffsname.lisp), and
  [`FILE` server](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file%2Fserver.lisp).
- LM-3 project, System 303 [`LFS`/`LMFILE` declarations](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fsystem.lisp),
  [contemporary LMFILE summary](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fdoc.text),
  [active `LMFILE` server](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fserver.lisp), and
  [remote client](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=file2%2Fremote.lisp).
- LM-3 project, [Chaos `FILE` protocol description](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fchfile.text),
  [pathname manual](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Fpathnm.text), and
  [file-system interface manual](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=man%2Ffiles.text).
- Symbolics, [*Genera Concepts*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_Concepts.pdf), for pathnames, files, hosts, and the generic environment.
- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf), for file commands, directories, login, and ordinary user workflows.
- Symbolics, [*Editing and Mail*](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf), for Dired and Zmacs file interaction.
- Symbolics, [*Networks*](https://bitsavers.org/pdf/symbolics/software/genera_8/Networks.pdf), for network services and file-server administration.
- Symbolics, [*Symbolics Network File System (NFS) User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Network_File_System__NFS__User_s_Guide.pdf), for the supported NFS client/server product description and user workflow.
- Sun Microsystems, [*Network File System Protocol Specification*, RFC 1094](https://www.rfc-editor.org/rfc/rfc1094), for the public NFS version 2 procedure contract.

Public links last verified 2026-07-18. Licensed-source facts are exact only for the
identified archive; public LM-3 facts distinguish the maintained restoration tree
from an untouched historical System 303 release witness.
