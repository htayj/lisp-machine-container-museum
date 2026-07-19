---
type: Artifact Analysis
title: Login, site data, host tables, and the later Site Data Editor
description: A release-bounded study of MIT Lisp Machine login and site configuration from hand-maintained System 46 tables through the maintained LM-3 SITE system and later LMI Site Data Editor.
tags: [mit-cadr, lm-3, login, site-data, host-table, site-editor, preservation]
timestamp: 2026-07-18T07:04:33-04:00
---

# Login, site data, host tables, and the later Site Data Editor

Site administration changed substantially over the span represented by the
public CADR materials. System 46 has a small login layer and Lisp source files
that directly assign the Chaos host, display-name, and location tables. The
maintained LM-3 System 303 tree has a formal `SITE` system: `DEFSITE` options and
`LMLOCS` are compiled, a textual `HOSTS` file is translated into `HSTTBL`, and
site initializations install the resulting data. The graphical Site Data Editor
also carried by that maintained tree is later Lisp Machine, Inc. software, with
patch evidence from 1986 through 1988. It must not be described as the site
editor of MIT System 303.

The corresponding Symbolics design replaces these site-specific Lisp tables
with a distributed object database and is documented in
[Namespace administration and the Namespace Editor in Genera](../genera/namespace-administration-and-editor.md).

## Release and provenance boundary

The System 46 snapshot is public source at Git revision
[`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af).
The later source is the maintained LM-3 System Fossil checkout at
[`4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
tagged `system-303`, plus the separately maintained `usite` checkout at
`8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`.
The latter is operational restoration material, not an untouched historical
site directory.

| Evidence | Bytes | SHA-256 | What it establishes |
| --- | ---: | --- | --- |
| System 46 `lispm2/login.42` | 1,921 | `2839d60436b00b0cefdccbd953f69d8f5b90a0a8e70545deb3bcccbdee63c1a3` | login, logout, init-file loading, reversible login forms |
| System 46 `lmio/chstbl.43` | 3,882 | `0b51ec3bae052c440fa69b100f70c8b19f0ec2cf0106283639881f7d5e4e2ef9` | literal Chaos names, addresses, display names, and locations |
| System 46 `lmio/chsaux.113` | 47,474 | `1990f30c37def0129f7f36faac310f68b303687571d46ff8057b93ac0b6e316d` | consumers of the Chaos tables |
| System 46 `lmio/qfile.31` | 80,121 | `aa28d984d494f679ca3839f8e039f1a4674bf2eab81e8b075b09da601203997d` | file-host lookup and login plumbing |
| LM-3 `sys/sysdcl.lisp` | 25,396 | `2999f1824666171d729dae611a09204ac0bd42373f30d7d22c733f904c27a6dd` | `SITE` system and host-table build rule |
| LM-3 `sys/qmisc.lisp` | 83,123 | `d8c022999c40033b0073c0bec364fbe28ac20c4aa4ecb77afa4c70d1bfc9d840` | `DEFSITE`, option precedence, and site reload machinery |
| LM-3 `sys2/login.lisp` | 13,557 | `189f4e71eb9c6b1291ca8ff6fceaeb755863d08a5d83b48c186b20c137fe3e4f` | later login, `LOG1`, history, and initialization lists |
| LM-3 `network/host.lisp` | 31,860 | `e0b4161041cdc0d0df319df9809e12e73c1cd1886a025829578a457029a50d20` | host objects and `DEFINE-HOST` boundary |
| LM-3 `network/chaos/chsaux.lisp` | 67,218 | `29fb941e5147b5f7ae51331f90dd11ffbf9ed93058c1e0835d6c6900f3803a05` | `HOSTS` to `HSTTBL` generator |
| maintained `usite/site.lisp` | 374 | `f8f3356df6de7d740d3cdc2af55bc08ac9efa3d0f0a788d462ed41cd9f3086f6` | restoration-specific `DEFSITE :LM-3` example |
| maintained `usite/lmlocs.lisp` | 1,323 | `94b9ce8c44cb967abc9c05e4ae3bf01422d73020a47183b2e32e14b96f6d22b9` | restoration machine-location table |
| maintained `usite/-read-.-this-` | 6,575 | `9f2bc320fbc0b71953b2b8732b352d93e42212168b1d881cdd51f0debed268d3` | current emulator/site construction procedure |

All source identities were verified locally on 2026-07-18. The public trees
contain real historical material, but the maintained System checkout also
contains later vendor additions. File location alone is therefore not a date.

## System 46: login and hand-maintained tables

### Login entry points and effects

System 46 exposes Lisp functions rather than a separate account-management
application:

| Entry point | Arguments and effect |
| --- | --- |
| `LOGIN` | `user-name` and optional `machine-or-t`, defaulting to `"AI"`. It first logs out, records the trimmed user name, informs the selected file host, performs file login, asks that host for the user's `LISPM` init pathname, and loads the `USER` init file. Supplying `T` selects the default file host and suppresses init-file work. |
| `LOGOUT` | Evaluates the accumulated undo forms, clears user identity, personal-name, affiliation, host-name, and login-machine state, clears the undo list, and tells the file layer that login has ended. |
| `LOGIN-EVAL` | Adds a caller-supplied undo form to the logout list. |
| `LOGIN-SETQ` | Assigns variables while recording either their old values or an unbind operation for logout. |
| `LOGIN-FDEFINE` | Replaces a function definition while recording the prior definition when one exists. |

There is no login dialog, user database editor, or login-specific keymap in the
inspected System 46 source. The call is made from Lisp. Its `USER` init file can
change a live world, while the three helper operations give cooperating init
code a way to undo those effects at logout.

### What counted as site data

`lmio/chstbl.43` says explicitly that it is not compiled because the Chaos
tables change frequently. Loading the source directly assigns four tables:

| Table | Record shape and use |
| --- | --- |
| `HOST-ALIST` | host-name string to octal Chaos address; aliases share an address and the preferred displayed name comes first |
| `KNOWN-NAME-ALIST` | Chaos address to descriptive machine name |
| `FINGER-ALIST` | Chaos address to human-readable console location |
| `CONSOLE-LOCATION-ALIST` | Chaos address, MIT building identifier, and floor number |

The file-name layer separately maps host names to host implementation closures.
There is no `DEFSITE`, `SITE` system, `LMLOCS`, `HSTTBL` generator, or Site
Editor in the public System 46 snapshot. Administration means editing and
loading Lisp tables. Later terminology must not be projected backward: a
System 46 host alias is not a Genera Namespace `Host` object, and its location
alist is not yet the later site database.

## Maintained System 303: the `SITE` build pipeline

The System 303 declaration introduces a coherent build unit:

1. the `SITE` module compiles and loads `SYS:SITE;SITE` and
   `SYS:SITE;LMLOCS`;
2. `SITE` normally contains a `DEFSITE` form whose option alist defines the
   installation-wide policy;
3. `LMLOCS` supplies `MACHINE-LOCATION-ALIST` entries for individual Lisp
   machines;
4. the textual `SYS:SITE;HOSTS` file is translated into
   `SYS:SITE;HSTTBL LISP` and compiled; and
5. site initializations load the files, establish local-host variables, and
   make their host and location information active.

`DEFINE-HOST` is documented in source as belonging in the generated
`SYS:SITE;HSTTBL LISP` file. The input host table is thus human-oriented text,
while the generated Lisp expresses host objects. `UPDATE-SITE-CONFIGURATION-INFO`
can reload site files and the host table and rerun site initializations.

`GET-SITE-OPTION` first consults the per-host override alist, then the site-wide
alist. This is a source-visible precedence rule: a machine can override an
installation default without changing the global `DEFSITE` value. `DEFSITE`
itself is constrained to `SYS:SITE;SITE LISP`, and `SET-SYS-HOST` exists to
bootstrap the logical system-file host before ordinary site translations are
available.

### Later login surface

The System 303 login source keeps the System 46 idea but adds initialization
lists, history, and more explicit failure handling:

| Entry point | Complete release-bounded interface |
| --- | --- |
| `LOGIN` | `user-name`, optional `host` defaulting to `ASSOCIATED-MACHINE`, and optional `inhibit-init-file-p`. It logs out first, canonicalizes the pathname host, runs login initializations, resets logout initializations, records login history, establishes the home-directory default, and normally loads the `LISPM` init file. `host = T` is retained as compatibility syntax for no init file. |
| `LOG1` | `user-name`, `:HOST`, `:INIT`, and arbitrary additional keywords. Extra options are dynamically available to the user's init file through `USER-INIT-OPTIONS`. |
| `LOGOUT` | Runs reversible forms and logout initializations, resets the login initialization list, then clears user state. Its own documentation says cold boot is usually preferable. |
| `PRINT-LOGIN-HISTORY` | Prints user, login host, physical Lisp Machine, and date for the accumulated in-world history. |
| `LOGIN-FORMS`, `LOGIN-EVAL`, `LOGIN-SETQ`, `LOGIN-FDEFINE` | Arrange undo work for logout; the generalized undo machinery also knows how to reverse definitions, advice, package changes, and some command definitions. |

An abort before login completes triggers logout. An abort while loading the
user init file deliberately leaves the user logged in. That distinction is in
the implementation, not just the high-level login description.

### What the maintained `usite` tree proves

The pinned restoration site defines an `:LM-3` site, its time zone and service
hosts, a machine-location alist, and logical-pathname translations. Its operator
note explains how to set a bootstrap SYS host, log in to a bridge, load the site
and translations, compile the `SITE` system, and save the result into a chosen
load band. It also describes the alternative of copying the minimum site files
onto LMFILE and rebuilding from there.

These are useful instructions for the maintained emulator environment, not
evidence that an MIT operator in the System 303 period used the same bridge,
directory layout, addresses, credentials, or disk-save sequence. Site-specific
values, including credentials, are not reproduced here.

## The later LMI Site Data Editor

### Provenance: not an MIT System 303 program

`l/sys/network/edit/` declares package `SITE-DATA-EDIT`, with nicknames `SITED`
and `SITE-EDITOR`, and a patchable system named “Site Data Editor.” Its core
source carries Lisp Machine, Inc. 1986 notices. Patch metadata makes the later
lineage unambiguous:

| Evidence | Release context | Finding |
| --- | --- | --- |
| `patch-3-4.lisp` | LMI Cambridge, 1986-09-12; System 110.232, Site Editor 3.3 | fixes belong to an LMI release years after System 303 |
| `patch-8-1.lisp` | Site Editor 8 | keeps network and subnet values internally numeric while writing human-readable site files |
| `patch-8-2.lisp` | Site Editor 8 | clears the current object during database flush, deletion, and initialization |
| `patch-8-3.lisp` | Site Editor 8 | corrects expert-menu comment handling |
| `patch-8-4.lisp` | Site Editor 8 | tightens subnet-mask checking |
| `patch-8-5.lisp` | Gigamos Cambridge, 1988-02-23; System 123.204, Site Editor 8.4 | prevents an unknown host display from falling into cold-load/error behavior |

The System 303 master declaration contains a commented-out `SITE-EDITOR`
optional-system line, while the editor has its own active `network/edit/sysdef.lisp`.
The maintained tree is preserving multiple layers of Lisp Machine history; it
does not make all of them components of the tagged band.

### Entry points and visible frame

`SITED:SITED` takes optional `select-p`, default true, creates a singleton
`SITE-EDITOR-FRAME`, and selects it. A system-key registration calls
`(SITED:SITED NIL)` using raw character code 6. The inspected source does not
establish the printed name of that key on every keyboard, so this page does not
invent one.

The frame has an object editor, a `Site Editor Interaction Pane`, and a command
menu. It chooses `expert` automatically on an 800-pixel-wide main screen and
otherwise starts in `normal`; Configure Window can select either. A third
`longmenu` configuration exists in source but is not offered by that command.
Expert mode removes the nonselectable section headings from the menu.

### Complete command menu

All twelve selectable commands in the pinned source are below. The four
section labels are nonselectable comments.

| Section | Command | Behavior and boundary |
| --- | --- | --- |
| Site Editor Database | Flush Database | Clears the current object and forgets all buffered editor data. The implementation does not ask for confirmation. |
| Site Editor Database | Reload | Reloads only after the database has been flushed/decached; otherwise tells the user that reload is unnecessary and explains the flush-then-reload sequence. |
| External Site Files | Point to Site Files | Selects a local or remote SYS host and site directory, confirms the change, establishes SYS, and loads `SYS.TRANSLATIONS`. |
| External Site Files | Load Site Files | Loads newest QFASLs for `DEFSITE`, `LMLOCS`, and `HSTTBL`, resets the local Chaos address, and runs site initializations. This changes the active running configuration. |
| External Site Files | Save Site Files | Confirms, then writes editor state back as the `DEFSITE`, `LMLOCS`, and textual host-table inputs. |
| External Site Files | Compile Files | Translates the textual host table to Lisp `HSTTBL` and compiles the three site outputs. |
| Editing Objects | Edit | Loads data if needed; if the current object has unsaved line changes, asks whether to annul them; then chooses an object class and object. |
| Editing Objects | Copy | Copies the current object. Hosts receive generated unused addresses; other deletable classes receive generated names. A Site is not a useful copy target. |
| Editing Objects | Delete | Chooses an object, rejects nondeletable objects and objects with referrers, confirms, deletes, and clears the current display when appropriate. |
| Editing Objects | Save Object Changes | Applies changed and deleted editor lines to the in-memory Site Editor database and consolidates them. It does not write external site files. |
| Special Commands | Parameters | Edits the Chaos host-table output, `LMLOCS` output, `DEFSITE` output, keyboard-choice threshold, and Choose-Any character; the derived `HSTTBL` pathname follows the DEFSITE host. |
| Special Commands | Configure Window | Selects `normal` or `expert` layout. |

A `Check Site Configuration` command is present only inside a block comment and
its body says it is not implemented. It is not a thirteenth command.

### Complete direct keyboard and object gestures

| Context | Key or gesture | Effect |
| --- | --- | --- |
| frame | Help or `?` | display the editor's local help in the interaction pane |
| frame | Control-L or Clear Screen | refresh the object editor and clear the interaction pane |
| frame | any other direct character | beep with no command |
| attribute label, repeatable field | Left | add another line of that attribute |
| attribute label | Middle | delete the line when deletion is allowed |
| attribute label | Right | restore the old value |
| ordinary value or empty value position | Left | edit or begin the value |
| choice value | Left | select that choice |
| object reference or restricted keyword | Left | choose from a menu, with a keyboard-input alternative where allowed |
| whole object list | Left | add an object |
| object-list element | Left | move the element to the front |
| object-list element | single Middle | delete the element |
| object-list element | other Middle click count (`M2` in who-line help) | replace the element |
| object-list element | Right | move the element to the rear |
| network address/specification | Left on a displayed subfield | edit that addressing-domain, address, network-number, or subnet-mask component |

The object chooser uses a mouse menu when the candidate count is at or below
the configurable threshold, initially 15, and keyboard input above it. `?`
lists keyboard choices. The configurable Choose-Any character defaults to
Control-Return and widens a restricted keyboard choice to the broader object
class. These are chooser behaviors, not global frame commands.

### Complete object-class and field inventory

Every object has a primary Name and zero or more Nicknames. Unknown site or
host properties are retained as user-property pairs rather than discarded.

| Class | Source-defined fields exposed by the editor |
| --- | --- |
| Site | Name, Nickname; SYS Host Login Name, optional SYS Host Login Password, Standalone, Default Associated Machine, Timezone, Host for Bug Reports, Local Mail Hosts, Long Pretty Name, Short Pretty Name, Site Specific System, Default Mail Mode, Default Printer, Default Bit Array Printer, Verify Dumps Made on LMI Lambdas, Backup Host, Time Server Hosts, Chaos Time Server Hosts, Chaos Mail Server Hosts, Spell Server Hosts, Ispell Server Hosts, ARPA Gateways, SMTP Mail Server Hosts, Chaos Host Table Server Hosts, Front End TCP Chaos Server, and user properties |
| Host | Name, Nickname, optional Short Name, System Type, Machine Type, File System Type, one or more Addresses, Services, Pretty Name, Finger Location, Location, Server Machine, Associated Machine, Printer, Default Bit Array Printer, Backup Host, Verify LM Dumps, and user properties |
| Printer | Name, Nickname, Type, and Parameters |
| Network | Name, Nickname, optional Short Name, and one or more Network Specs containing addressing domain, network number, and optional subnet mask |

Legacy site inputs `SYS-HOST`, `ARPA-CONTACT-NAME`, `DOVER`, `PRINTER-NAMES`,
`HOST-DEFAULT-DEVICE-ALIST`, and `SPECIAL-FILE-HOSTS` are ignored as direct Site
attributes during import. Some are reconstructed through the later object model
when files are emitted; “ignored as an editor line” does not mean “deleted from
the generated configuration.”

### Object workflow and persistence

The editor has two save layers:

1. Edit, Copy, and line gestures change a displayed working copy.
2. Save Object Changes validates and merges those lines into the editor's
   in-memory database.
3. Save Site Files serializes that database to the three external site inputs.
4. Compile Files produces the loadable artifacts.
5. Load Site Files mutates the currently running site and network state.

That separation explains why “Save Object Changes” is not durable site
publication. Flush Database can destroy step 2 changes before step 3, while
Load Site Files can alter a running machine without writing the source files.
Point to Site Files can redirect the entire workflow to another SYS host.

## Source findings beyond the user-facing model

- The editor's `longmenu` geometry is implemented but absent from Configure
  Window's two choices.
- Flush Database has no confirmation in the inspected implementation, despite
  being the command whose documentation says it forgets changes.
- `Check Site Configuration` is commented out and explicitly unimplemented.
- Deletion performs a full interobject-reference scan before removal.
- Host copy allocates new addresses by incrementing until no current object owns
  the candidate; this is collision avoidance inside the editor's loaded model,
  not a network-wide probe.
- The bootstrap module can build site files and invoke a disk save. That is an
  installation path, not an ordinary editor gesture, and it is not safe to run
  against preservation media without a disposable clone.
- The patch series preserves compatibility work for old site-option names and
  host-table representations; it also shows that the code continued changing
  after the core 1986 files.

## Runtime and screenshot status

No runtime screenshot is published for this page. That is an evidence boundary,
not an assumption that the program was text-only:

- System 46 has no Site Editor in the inspected source, so its site-data state
  has no corresponding application frame to capture.
- The available CADR harness boots the exact maintained System 303 band. The
  Site Data Editor source carried in the tree is later LMI/Gigamos software, is
  commented out of the optional-system declaration, and has not been shown to
  be present in that band.
- Running later editor code in the System 303 world would manufacture a mixed
  configuration and would not verify historical LMI System 110/123 behavior.

TODO: acquire a rights-cleared LMI release/load band that actually includes the
matching Site Editor version, run it through an isolated clone, verify the raw
system-key name, layouts, chooser threshold, object gestures, and safety prompts,
then conduct an image-specific screenshot review. Until then, all visible-frame
claims above are source claims and the lack of a screenshot is explicit.

## Safety notes for preservation work

- Read and hash site inputs before loading them. Loading is executable Lisp in
  both releases.
- Treat `HOSTS` as the maintained input and `HSTTBL` as generated output only
  within the exact build procedure that produced it.
- Do not publish restoration site credentials, private host inventories, or
  local network addresses merely because their containing source tree is
  public.
- Never test Point, Save, Compile, Load, bootstrap, or disk-save operations on
  the only copy of a load band or site directory.
- Keep System 46, maintained System 303, and later LMI Site Editor findings
  labeled separately in any derivative catalog.

## Open questions

- TODO: identify the first historical release in which `DEFSITE`, `LMLOCS`, and
  the generated `HSTTBL` pipeline shipped together.
- TODO: locate the matching Site Data Editor manuals for LMI System 110 and
  Gigamos System 123, then compare their documented menu to this exact source.
- TODO: establish the keyboard name represented by raw character code 6 on each
  supported LMI keyboard rather than extrapolating from another Lisp Machine.
- TODO: determine whether any shipped configuration exposed the defined
  `longmenu` layout.
- TODO: audit the suspicious `n-tuple :void-p` implementation against a matching
  runtime before calling it a defect; its name and predicate disagree, but the
  live consequence is not yet established.

## Sources

- MIT CADR System 46,
  [`login.42`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lispm2/login.42),
  [`chstbl.43`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chstbl.43),
  [`chsaux.113`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsaux.113), and
  [`qfile.31`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/qfile.31),
  revision `8e978d7`; verified 2026-07-18.
- Maintained LM-3 System tree,
  [`sysdcl.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/sysdcl.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`qmisc.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys/qmisc.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`login.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/sys2/login.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`network/edit`](https://tumbleweed.nu/r/lm-3/dir?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=l/sys/network/edit),
  check-in `4df393c`; verified 2026-07-18.
- Maintained LM-3 `usite` checkout, check-in
  `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`;
  local `site.lisp`, `lmlocs.lisp`, `sys.translations`, and operator note
  inspected 2026-07-18.
