---
type: Museum Guide
title: CLX, remote X screens, and X server facilities on Genera
description: An evidence-bounded guide to Genera's CLX implementation, X Remote Screen client, historical X11 Server, X documentation, CLX-CLIM port, controls, defaults, release boundaries, and relationship to the museum harness.
tags: [genera, open-genera, clx, x11, remote-screen, x-server, clim, preservation]
timestamp: 2026-07-18T11:26:39-04:00
---

# CLX, remote X screens, and X server facilities on Genera

Genera shipped several related X Window System facilities, but they did not all
put Genera on the same side of the X protocol:

- **CLX** is the Common Lisp X interface. A Lisp program using it is an X
  **client**.
- **X Remote Screen** uses CLX to present a Genera console or one Genera activity
  in a window managed by an X server. Genera is again the X **client**.
- **X-Documentation** is the on-line book for both the client and server
  products. It is documentation, not a protocol endpoint.
- The historical **Symbolics X Server** accepts connections from remote X
  clients and draws their windows inside Genera's `X11 Server` application. It
  puts Genera on the X **server** side, but the contemporary installation guide
  restricts it to non-embedded Symbolics machines.
- **CLX-CLIM** is an optional CLIM display port implemented over CLX. It is a
  client-side backend, not X Remote Screen and not the X Server.

The private Xvfb used by this repository's computer-use harness is none of those
products. It is a modern host-side containment and evidence device. Open
Genera's VLM relays the guest's X client stream to that Xvfb; the harness does
not turn the guest into an X server.

This article is complete at the **system, declared-module, direct-command,
portable special-key mapping, registered-keyboard-family, connection-option,
X-resource, and CLX facility-family grain**. It inventories all five direct
commands in the newest inspected X Remote Screen source, all five controls
documented for the historical X11 Server application, the complete default
special-key translation layer, every registered hardware family in the released
keyboard source generation, and all 15 CLX Programmer's Reference facility
families. The inspected `XLIB` package exports 559 names. Repeating all 559
reference entries would be a poorer substitute for the public CLX reference, so
the API table below gives every facility family and representative entry points
while recording the exact export cardinality.

“Complete” here does not include inherited Command Processor facilities, commands
inside an activity displayed on a remote screen, site customizations, every raw X
keycode in every vendor keyboard signature, or undocumented X Server options
whose implementation is absent from the inspected media. Those boundaries are
stated where they matter.

## Evidence classes and rights boundary

| Label | Evidence used here | What it can establish |
| --- | --- | --- |
| **Manual** | Symbolics X Window System User's Guide, Genera 8.3 installation guides, Genera 8.1 release notes, Open Genera Beta II release notes, CLX Programmer's Reference, and the CLIM 2 manual | Intended operation, public API, supported platforms, installation, terminology, and historically documented controls |
| **Licensed-source observation** | Inert inspection of the local Open Genera 2.0 / Genera 8.5 source and patch trees | Declarations, module composition, implementation-visible defaults, command definitions, connection paths, keyboard families, fonts, resources, and XDMCP behavior for the inspected files |
| **Licensed-world observation** | Inert string and metadata inspection of the preserved Genera 8.5 VLOD | Presence of system/patch and command-name evidence, but not successful command execution |
| **Runtime observation** | The latest isolated harness launch record at verification time | Only that the harness failed before starting the VLM; it provides no guest behavioral evidence for this dossier |
| **Interpretation** | Comparison across those layers | Architectural relationships and carefully bounded discrepancies, never invented behavior |

The licensed source tree, world, decoded on-line documentation, and raw harness
state remain local and ignored. This page records filenames, sizes, hashes,
counts, interface names, and original analysis; it does not republish source,
on-line Help prose, executable content, fonts, or other extracted licensed
payloads. The public manuals are paraphrased except for short names and labels
needed to identify interfaces.

## The client/server topology

The word *server* in X names the program that owns displays and input devices.
That is the opposite of the everyday intuition that the larger remote computer
must be the server. The products fit together as follows:

```text
Genera console or activity
  -> X Remote Screen display adapter
  -> CLX requests and event handling
  -> generic X service, TCP, DNA, or VLM console channel
  -> external or host X server
  -> an X window containing the Genera interface

CLIM application
  -> CLX-CLIM port
  -> CLX
  -> X server

remote xterm or another X client
  -> X11 protocol
  -> Symbolics X Server (historical, non-embedded machines)
  -> X11 Server application area on the Symbolics console

museum computer-use harness
  -> private host Xvfb plus narrow compatibility guards
  <- VLM-relayed guest X client stream
  <- Open Genera CLX / X Remote Screen display path
```

The first and last paths can carry similar X11 bytes without being the same
historical facility. Xvfb supplies the display server outside the guest. The VLM
console channel is a Genera/CLX transport to a host server. The repository's
harness supervises and constrains that transport for preservation work.

## Product and program inventory

| Facility | User-visible embodiment | X role | Inspected Open Genera media |
| --- | --- | --- | --- |
| `CLX` | No application frame of its own; the `XLIB` programming package | Client binding | Source system present; released as 450.0 |
| `X-Remote-Screen` | `Genera X Screen` remote-program framework, normally an X window containing a generic console or selected activity | Client application/display adapter | Source system present; release roster says 448.3 |
| `X-Documentation` | Sage/Document Examiner book; no independent application frame | Neither | Source declaration and 18-record SAB present; release roster says 422.0 |
| `X-Server` | `X11 Server` application, historically selected by `Select Square` | Server | Documented for Genera 8.3; no declaration, implementation, font payload, or release-roster entry found in the inspected Open Genera media |
| `CLX-CLIM` | No application frame of its own; display port used by CLIM frames | Client backend | Declaration plus seven compiled modules present at patch generation 72; implementation bodies are compiled-only |
| Genera CLX implementation layer | Implementation-dependent CLX stream, scheduler, locking, byte-order, authorization, and VLM-channel support | Client substrate | Readable implementation-dependent source present |

`Genera X Screen` is a Dynamic Windows remote-program framework. Its program
object owns an X console; starting it returns the root X window identifier, while
the actual Genera activity is started in a foreground process. A generic remote
screen initially presents a Lisp activity and keeps ordinary activity selection,
Select keys, and the system menu available. An activity-specific screen presents
only the selected activity and disables its system menu and Select keys.

The source gives several activity descriptions display-specific defaults:

| Activity description | Remote-screen override |
| --- | --- |
| `Flavor Examiner` | Icon name `FlavEx` |
| `Document Examiner` | Icon name `DocEx` |
| `Metering Interface` | Icon name `Metering` |
| `Editor` | Window width 785 pixels |
| `File System Operations` | Icon name `FSMaint` |

The manual's `Start X Screen ... :Activity Zmacs` example describes the same
785-pixel editor width. The difference between the example's activity name and
the source's activity description is preserved rather than silently normalized.

## Release, load, and platform boundaries

### Open Genera 2.0 / Genera 8.5

The release roster identifies Open Genera 2.0 as Genera 8.5, released 7 October
1998, and lists:

| System | Roster version | Local patch-directory evidence | Declaration/load notes |
| --- | --- | --- | --- |
| `CLX` | 450.0 | Released/latest major generation 450 | Basic source category; sources and binaries distributed; VLM adds the console-channel module |
| `X-Remote-Screen` | 448.3 | Released/latest major generation 448 | Basic source category; requires `Embedding-Support` and `IP-TCP`, and includes `CLX` as a system module |
| `X-Documentation` | 422.0 | Released 421, latest 422 | Basic Sage documentation system; no required-system clause in the inspected declaration |
| `CLX-CLIM` | Not in the core roster excerpt | Released/latest generation 72 | Optional CLIM port; requires `CLIM` |
| `X-Server` | Absent | No system directory found | Not established as an Open Genera/VLM product |

The `X-Documentation` 421/422 patch-directory pair and the roster's 422.0 are not
necessarily contradictory: one expresses released versus latest major
generations, while the roster names the selected system version. They are both
recorded because the media itself retains both notions.

The Open Genera Beta II notes list `CLX`, `X Remote Screen`, and `X
Documentation` among the source systems on the CD. They list `CLX-CLIM` among
optional loadable systems. They do not list `X-Server`. That omission agrees with
the local source-tree and release-roster search, but it does not prove that no
separate historical distribution ever supplied the server.

### Genera 8.3 and the historical hardware server

The Genera 8.3 installation guides describe the server as an optional restored
system with these conditions:

- it works only on **non-embedded** Symbolics machines;
- MacIvory and UX systems should instead use an X server on the embedding host;
- `X-Server` has no other loadable-system dependency, but its component
  `C-Runtime` must have been restored from the source tape and is loaded
  automatically;
- the `X-SERVER-FONTS` files must be restored for the standard server fonts; and
- `Load System X-Server` installs the application, whose default Select binding
  is `Select Square`.

The restriction matters for this museum. The VLM is an embedded Open Genera
environment, so a documented inability to run the historical server there is a
platform rule, not merely a missing command in the saved world.

The same installation guide calls X Remote Screen the client side, requires
`RPC`, `Embedding-Support`, and `IP-TCP`, and says most Genera 8.3 worlds contain
it. The inspected 8.5 declaration requires only `Embedding-Support` and `IP-TCP`.
The evidence does not establish whether `RPC` became transitive, became
unnecessary, or was simply omitted from the newer declaration; it establishes a
release-level dependency difference.

### Source-file generations versus the release component

The X Remote Screen 448 component directory names `keyboards` source generation
43 and `x-program` generation 22. The physical source tree also retains newer
generations 44 and 23. The newer keyboard file adds a PCXAL-AA signature and
mapping; the released generation 43 does not contain it. The five-command audit
below uses the only present `x-program` body, generation 23. The Genera 8.5 VLOD
contains all five command names and patch-load strings for 448.1 through 448.3,
but a string occurrence is not executable proof.

Accordingly:

- the default keyboard table and all families through DEC LK401-AA are bounded
  to released source generation 43;
- PCXAL-AA is labeled **newer local source only**;
- the three commands also described in the manual have independent manual
  support; and
- the two source-only command additions remain unverified in a live 448.3 world.

## CLX on Genera

CLX is the standard Common Lisp language binding for X11. It represents displays,
screens, windows, pixmaps, graphics contexts, fonts, colormaps, cursors, events,
and other server resources as Lisp objects. It buffers requests, decodes replies
and events, manages client-side state, and exposes X protocol errors as Lisp
conditions.

The implementation is portable in origin rather than a Symbolics-only API. The
inspected conditional source contains support paths for Genera and Minima as
well as several other historical Common Lisp environments. The Genera system
declaration serializes 21 implementation modules, one documentation example,
and a VLM-only console-channel module. Genera-specific code connects the portable
interface to Genera network streams, processes, locks, byte arrays, host objects,
and the VLM.

### Public API facility map

The ANSI-style `XLIB` package declaration in the inspected source exports 559
unique names. The count includes types, accessors, conditions, constants,
functions, and macros. Its facility coverage agrees with the 15 substantive API
chapters of the CLX Programmer's Reference:

| CLX facility | Responsibilities | Representative public interfaces |
| --- | --- | --- |
| Displays | Open/close a connection, buffer output, wait for completion, inspect vendor/protocol and resource-ID state | `open-display`, `close-display`, `with-display`, `display-force-output`, `display-finish-output`, `display-vendor` |
| Screens | Inspect the roots, dimensions, depths, visuals, default colormap, backing-store and save-under capabilities | `display-roots`, `display-default-screen`, `screen-root`, `screen-depths`, `screen-width`, `screen-height` |
| Windows and pixmaps | Create, map, configure, reparent, query, destroy, and use on- or off-screen drawables | `create-window`, `map-window`, `unmap-window`, `destroy-window`, `create-pixmap`, `free-pixmap`, `query-tree` |
| Graphics contexts | Create/copy/free drawing state and read or set foreground, background, line, fill, font, clipping, and raster-operation attributes | `create-gcontext`, `copy-gcontext`, `with-gcontext`, `free-gcontext`, `gcontext-foreground` |
| Graphic operations | Draw points, lines, segments, rectangles, arcs, and glyphs; copy areas and planes | `draw-line`, `draw-rectangle`, `draw-arc`, `draw-glyphs`, `copy-area`, `copy-plane` |
| Images | Move pixel arrays between client and server and represent XY, bitmap, and Z formats | `create-image`, `get-image`, `put-image`, `get-raw-image`, `put-raw-image`, `copy-image` |
| Fonts and characters | List/open/close fonts, inspect metrics and properties, measure or render strings and glyphs | `list-fonts`, `open-font`, `close-font`, `text-extents`, `text-width`, `font-properties` |
| Colors and colormaps | Create/install colormaps; allocate, look up, query, store, and free colors | `create-colormap`, `install-colormap`, `alloc-color`, `lookup-color`, `query-colors`, `store-colors` |
| Cursors | Build pixmap- or glyph-based cursors, recolor and free them, and query best dimensions | `create-cursor`, `create-glyph-cursor`, `recolor-cursor`, `free-cursor`, `query-best-cursor` |
| Atoms, properties, and selections | Name protocol objects; read/write properties; own and convert selections; manage cut buffers and ICCCM window-manager properties | `intern-atom`, `change-property`, `get-property`, `set-selection-owner`, `convert-selection`, `rotate-cut-buffers`, `set-wm-properties` |
| Events and input | Select, queue, dispatch, discard, synthesize, and wait for events, with event-case and handler abstractions | `event-case`, `event-cond`, `event-handler`, `event-listen`, `process-event`, `send-event`, `queue-event` |
| Resources | Parse, merge, search, read, and write X resource databases and application defaults | `make-resource-database`, `read-resources`, `merge-resources`, `get-resource`, `get-search-resource`, `wm-resources` |
| Control functions | Control input focus, pointer and keyboard mappings, grabs, access, screen saver, installed colormaps, client lifetime, and server synchronization | `set-input-focus`, `set-pointer-mapping`, `set-modifier-mapping`, `grab-server`, `kill-client`, `set-screen-saver`, `set-access-control` |
| Extensions | Discover server extensions and define client-side extension requests, events, and errors | `list-extensions`, `query-extension`, `define-extension`, `get-external-event-code`, `decode-core-error` |
| Errors | Condition hierarchy and handlers for connection, request, resource, implementation, reply, and protocol failures | `default-error-handler`, `connection-failure`, `request-error`, `resource-error`, `reply-timeout`, `unexpected-reply` |

This is a protocol-level toolkit, not an application framework. CLX does not by
itself create a Genera program frame, choose a user-interface policy, or turn a
Lisp listener into an X server. X Remote Screen and CLX-CLIM are two different
higher layers built on it.

### `open-display` and Genera connection paths

The inspected public entry point has this option surface:

| Argument | Meaning and default |
| --- | --- |
| `host` | Required X server host designator |
| `display` | X display number; default 0 |
| `protocol` | Implementation-specific transport selection; no portable default value is imposed |
| `authorization-name` | Optional X authorization protocol name |
| `authorization-data` | Optional authorization bytes |

On Genera, the implementation-dependent stream opener behaves as follows:

1. With display 0 and no explicit protocol, it invokes the generic
   `X-WINDOW-SYSTEM` byte-stream service on the host.
2. If a protocol is specified, or the display is greater than zero, it bypasses
   generic service selection.
3. The default explicit/network path is TCP on port `6000 + display`.
4. The DNA path uses contact name `X$X<display>`.
5. On a VLM, protocol `VLM` uses the console channel supplied by life support.

All paths still lead to the ordinary X11 setup handshake and the same CLX object
model. The transport changes; the client/server role does not.

### The VLM console channel

The VLM-only source describes the console channel as a direct life-support
interface to the host's X server. Genera asks it to read or write raw X data. The
output path uses a coprocessor call to avoid VLM scheduling overhead; the input
path queues bounded transfers and wakes the waiting Genera process. X Remote
Screen starts this path with protocol `VLM` when a console channel is available.

This is the historical guest-side half of the Open Genera display path. It is not
Xvfb, and it is not the host compatibility preload. The repository harness's
current direct trace shows that the VLM also relays the principal guest X11 byte
stream through host writes. The harness handles only narrowly pinned compatibility
cases and delegates nonmatching X writes unchanged; it does not implement CLX or
the Genera display device.

## X Remote Screen

X Remote Screen adapts Genera's console, screen, mouse, keyboard, fonts, colors,
bitmaps, activities, and program framework to an X window. A single Genera world
can maintain multiple remote interfaces, possibly on different X servers. The
manual explicitly warns that this does not make the operating system multiuser:
the applications still share one Genera address space.

### Complete direct command inventory

The newest inspected `x-program` source defines exactly five commands in the
`User` command table. There is no private editor-like command loop or separate
keymap for the framework itself.

| Command | Arguments and source defaults | Effect and evidence boundary |
| --- | --- | --- |
| `Start X Screen` | Positional `host`; keywords `Display 0`, `Screen 0`, `Program "Genera X Screen"`, `Activity None`, `Reuse Yes`, `Geometry` absent, `Foreground` absent, `Background` absent, `Border Width` absent, `Border Color` absent, `Who Line Default`, conditionally `Compatible Color Default`, and `Initial State Normal` | Starts a generic or activity-specific Genera interface as an X client. Manual and newest source agree on the core operation; the source always passes restartable true. |
| `Halt X Screen` | `screen` defaults to the current X screen, otherwise the sole X screen; the positional token `All` is accepted. Keyword `Kill` defaults to No and becomes Yes when merely mentioned. | Disconnects the corresponding X console. If the command is running on the screen being halted, source defers that shutdown to a background process. `All` and `Kill` are source-visible additions not described in the short manual entry. |
| `Show X Keyboard Mapping` | `screen` defaults as above; `All` defaults No and becomes Yes when mentioned; `Match` defaults absent | Prints keycode-to-Genera translations, normally only interesting mappings, optionally all entries or Genera key names matching a substring. Manual and source both describe it. |
| `Show X Font Mapping` | `screen` defaults as above; no keywords | Reports the effective server-font, generated composite-font, and pixmap fallback mapping. Found in newest source and VLOD strings, but absent from the inspected user-guide command set and not live-executed here. |
| `Set X Keyboard Mapping` | `screen` defaults as above; required keyboard-signature name chosen from the registered signatures | Replaces the X console's detected layout and recalculates the mapping. Found in newest source and VLOD strings, but absent from the inspected user-guide command set and not live-executed here. |

The source explicitly suppresses an Output Destination keyword for `Start X
Screen`. The other typeout commands participate in the normal Command Processor
environment where applicable; no additional facility-specific output switches
are defined in this file.

The public manual lists `Protocol` as a `Start X Screen` keyword. The newest
Command Processor definition does **not** expose it, although the underlying CLX
and X-screen implementation still accepts a protocol and the VLM startup path
passes `VLM`. This is a manual/source interface discrepancy, not evidence that
protocol selection ceased to exist internally.

### Adjacent keyboard-layout command

The X user guide also documents the general Genera command `Show Keyboard
Layout`. It is not one of the five commands defined by X Remote Screen, but it is
the graphical companion to the X mapping reporter.

| Argument or keyword | Choices and default |
| --- | --- |
| `keyboard-layout` | Apple, Apple Extended, Apple ISO, Apple ISO Extended, Mac 512K, Mac 512K International, Mac Plus, Mac Portable, Mac Portable ISO, NCD N-101, SGI Iris, Sun Type 3, Sun Type 4, or Symbolics |
| `Include Codes` | No (default), Octal, Decimal, or Hex |
| `Include Legends` | Yes (default) or No |
| `Include Mappings` | Yes (default) or No |
| `More Processing` | Default (default), Yes, or No |
| `Output Destination` | Normal Genera destinations; defaults to `*standard-output*` |

The Keyboard Control activity's `Hardcopy Keyboard Layout` operation is the
manual's route to a landscape template. That hardcopy operation is not treated
as an X Remote Screen command.

### Start behavior and defaults beyond the manual

The underlying start function accepts host, display, screen, reuse, geometry,
initial state, remote program, activity, foreground, background, border color,
border width, who-line, restartable, and compatible-color options. It rejects an
activity whose activity object says it cannot work on a single-activity X screen.

For a generic `Genera X Screen`, source-visible defaults are:

- X resource name `genera` and class `Genera`;
- title `Genera on <local-host>` and icon name `Genera`;
- black foreground, white background, black border, border width 0;
- normal rather than iconic initial state;
- the root visual depth, capped by any requested depth;
- a who line by default for the generic console;
- minimum size 640 by 320 with a who line, or 320 by 160 without one;
- maximum size equal to the selected X screen; and
- absent resource or geometry overrides, an origin 5 percent from the top and
  left with width and height equal to 90 percent of the X screen.

The last rule is the implementation behind the manual's less precise “covers
most of the console” description. Width and height are clamped to the minimum and
maximum bounds.

The created X window asks for key press/release, button press/release, exposure,
visibility, structure, pointer motion, keymap state, enter/leave, and focus events.
It requests backing store and installs normal ICCCM window-manager properties,
including resource names, icon data, size hints, initial state, and user- versus
program-specified geometry.

### X resource database surface

The screen reads the root resource database and consults these application
resources:

| Resource | Role |
| --- | --- |
| `whoLine` | Status/who-line choice |
| `compatibleColor` | Request compatible-color mode |
| `geometry` | Main window geometry |
| `depth` | Requested depth, never above root depth |
| `iconGeometry` | Icon position and size |
| `initialState` | `normal`, `iconic`, or `dont-care` internally |
| `borderColor`, `borderWidth` | Main-window border |
| `foreground`, `background` | Main drawing colors |
| `cursorForeground`, `cursorBackground` | Pointer colors |

Compatible color is not a generic “color display” flag. The source enables it
only if requested and an 8-bit pseudo-color visual is available. Otherwise it
falls back to the root visual and default colormap.

### Screen reuse and loss of connection

By default, `Start X Screen` asks to reuse resources from an old disconnected X
screen. The manual names explicit halt, warm boot, and network failure as ways a
screen can become reusable. `Reuse No` forces a new screen instead. This can
preserve expensive Dynamic Windows histories, bitmaps, and screen objects while
replacing the network-visible X connection.

The Genera 8.1 release notes record three behavior fixes that reveal practical
remote-screen edges not conveyed by the command synopsis:

- the X client already spoke the X11 Release 4 protocol when the historical X
  server was upgraded to R4;
- Symbolics-keyboard recognition between the Symbolics client and server was
  repaired;
- Namespace Editor windows invoked from a remote console were fixed to appear on
  that remote console rather than the main console; and
- a timed-out local X connection was fixed so it no longer entered the Debugger.

These are release-note facts about 8.1. They do not prove that every later remote
application is console-correct.

## Keyboard translation and direct gestures

Genera translates X keysyms and server keycodes into its larger character and
modifier vocabulary. The manual's minimum X keyboard has alphanumeric keys,
Control/Meta/Alt, distinct Delete and Backspace, distinct Return and Linefeed,
and 12 function keys. Specialized physical-keyboard mappings add convenient
copies; they do not remove the portable function-key fallbacks.

### Complete portable function-key layer

| Host key | Unshifted Genera meaning | Shifted Genera meaning |
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

This is the default X Remote Screen map, not a claim that the host desktop or
museum automation layer sends every function key unchanged. The harness's own
key translation must be verified separately for each runtime claim.

### Complete portable keypad and named-key layer

| Physical/X keysym | Genera meaning |
| --- | --- |
| keypad decimal | Rubout |
| keypad 1, 2, 3 | End, Keyboard Down, Scroll |
| keypad 4, 5, 6 | Keyboard Left, right Symbol modifier, Keyboard Right |
| keypad 7, 8, 9 | Keyboard Home, Keyboard Up, Keyboard Back-Scroll |
| keypad divide, multiply, minus | Keyboard Paste, Keyboard Cut, Keyboard Copy |
| Home, Up, Left, Right, Down | Corresponding Keyboard character |
| Print, Undo, Redo, Find | Corresponding Keyboard character |
| Next, Prior | Scroll, Keyboard Back-Scroll |
| Break | Suspend |
| Num Lock | locking Num Lock modifier/state |
| left Alt, right Alt | left Symbol, right Symbol modifiers |

The manual names the Keyboard character set as the bridge used by Dynamic
Windows and Zmacs for arrows, by cut-buffer operations for Undo/Cut/Copy/Paste,
and by the hardcopy facility for Print. `#\Keyboard:Cut` is the documented Lisp
notation pattern. This translation layer makes the same physical key usable by
presentation-based applications and editor commands without making those
commands part of X Remote Screen itself.

### Hardware signatures and mappings

Released keyboard source generation 43 registers these signatures:

| Signature family | Signature variants | Named mapping present? |
| --- | --- | --- |
| Symbolics | Symbolics server | Yes |
| Sun Type 3 | MIT X Consortium and Sun X11/NeWS vendor forms | Yes |
| Sun Type 4 | MIT X Consortium and Sun X11/NeWS vendor forms | Yes |
| SGI Iris | Silicon Graphics server | Yes |
| NCD N-101 | Two NCD/DECwindows vendor strings | Yes |
| NDS | Northwest Digital Systems | Yes |
| Apple Extended | MacX signature | No separate named mapping in this file |
| DEC LK401-AA | DECwindows/OSF signature | Yes |

Newer physical source generation 44 adds a `PCXAL-AA` signature and mapping for
a Digital UNIX DECwindows server. Because the release component names generation
43, PCXAL-AA is not counted as released 448 source behavior here.

Detection compares the server vendor name and version plus its reported keysyms,
allows a keycode offset, scores differences, and chooses a known signature only
above the implementation's threshold. Heavily customized server maps can
therefore fall back to the portable default. `Set X Keyboard Mapping` provides a
manual override in the newer source; `Show X Keyboard Mapping` exposes the
effective result.

The public X guide emphasizes Sun Type 3/4 and NCD diagrams and its general
`Show Keyboard Layout` list includes several Mac families. The 8.5 source has a
different concern: signatures actually used for automatic recognition. A
graphical layout supported by the general keyboard-control database is not
automatically proof of a signature in X Remote Screen.

## Fonts, colors, and off-screen storage

### Three font paths

The manual and source agree on a priority order:

1. If the X server has native Genera fonts, use them.
2. Otherwise, map character styles to standard 75 dpi X fonts when possible.
3. For a glyph with no usable server font, create an X pixmap from the resident
   Genera raster glyph and copy that image to the window.

The source inventories server fonts matching `genera-*`. Its standard family
mapping is complete and small:

| Genera style family | X family |
| --- | --- |
| `FIX` | Courier |
| `SWISS` | Helvetica |
| `DUTCH` | Times |
| `JESS` | Helvetica |

The named size mapping is `tiny` 6, `very-small` 8, `small` 10, `normal` 12,
`large` 14, `very-large` 18, and `huge` 24. It maps the standard character set to
ISO 8859-1 where possible and can compose server fonts with Symbol or local
pixmap fallback glyphs. `Show X Font Mapping` exists precisely because one
Genera character style can become a composite of these paths.

Native X font files and fallback pixmaps are delivery mechanisms for the same
logical Genera font choices; they do not establish vector fonts inside the
Genera display system. The separate [Genera font extraction study](genera/extracting-resident-fonts.md)
documents the resident raster fonts and the distinct outline hardcopy subsystem.

### Color

On a color X server, ordinary Genera graphics color and gray-level arguments can
be realized through the X display device. The manual permits named basic colors,
RGB triples in the range zero through one, or Genera color objects. Compatible
color is a narrower indexed-color compatibility mode requiring an 8-bit
pseudo-color visual, as described above.

### Temporary pixmaps and a source-only failure mode

The X screen implementation defaults to allocating server-side pixmaps for
temporary Genera bit arrays. That accelerates screen copies, particularly on
color displays. A source-visible switch can disable this path and keep temporary
storage out of the X server.

The implementation comment explains why: memory-limited X terminals can fail
poorly near server-memory exhaustion. Disabling remote temporary pixmaps avoids
that failure mode at a performance cost. This tradeoff is more specific than the
manual's general discussion of choosing host/server versus Ivory memory for
off-screen images.

## XDMCP: automatic client-side session creation

X Remote Screen contains an X Display Manager Control Protocol version 1 server
on UDP port 177. This can sound like the Symbolics X Server, but its effect is the
opposite: an X terminal/display manager asks Genera to start an X screen back to
that display, so Genera ultimately becomes an X **client**.

The inspected implementation handles Query, Broadcast Query, Indirect Query,
Forward Query, Request, Manage, and KeepAlive exchanges. Its safety and lifecycle
conditions are unusually explicit:

- it answers only after system initialization, with networking enabled and
  namespaces initialized;
- Query-family willingness is limited to trusted requesters;
- Request acceptance also requires a trusted host and a coherent local-site
  relationship;
- Manage creates or reuses a session and starts the X screen in a process;
- KeepAlive reports whether the session identifier remains known; and
- network reinitialization, site initialization, and warm initialization all
  close and clear sessions.

There is no direct user command in `x-program` for enabling or managing XDMCP.
It is a network server endpoint whose successful outcome is a client-side remote
screen.

## The historical Symbolics X Server

The X Server is a separate Genera product, documented as a C port of the standard
MIT X11 Release 4 server. It accepts protocol requests from external clients such
as `xterm`, renders their windows within an `X11 Server` application area, and
routes local keyboard and mouse input to the selected X client while in server
mode. The contemporary guide cautions that little work had been done to optimize
the portable server.

No `X-Server` declaration, source tree, compiled module, `X-SERVER-FONTS`
payload, BDF-to-SNF utility, or MkFontDir utility was found in a recursive search
of the inspected Open Genera runtime/source tree. The local X documentation still
describes them. Documentation presence is evidence of the wider Genera product
line, not proof that this Open Genera release can load the product.

### Complete documented X11 Server controls

The implementation is unavailable, so “complete” in this table means every
control named by the contemporary X guide. The manual gives no arguments or
keyword options for them; hidden or release-specific options remain unknown.

| Command or key | Documented effect |
| --- | --- |
| `Select Square` | Select the `X11 Server` application by its default Select binding |
| `Start Server` | Create the background process that manages X network connections |
| `Halt Server` | Kill that background connection-manager process |
| `Switch Mode` | Give keyboard and mouse control to the X server and its client applications |
| `Network` | Leave switched X input mode and return to the Genera command loop of `X11 Server` |
| `Start X Server` | Also create the background X connection manager |
| `Halt X Server` | Also kill the background X connection manager |

The two start names and two halt names are documented with the same semantics.
Without source or runtime evidence, this page does not invent a distinction. In
switched mode, ordinary Genera key meanings are routed to the remote X client;
the manual's example says `Select L` then selects a Listener inside a Genera
Remote Screen running as an X client, rather than the local Listener.

### Server fonts and maintenance commands

The distribution historically included a standard X font set in Server Native
Format (SNF). Local Bitmap Distribution Format (BDF) files could be converted by
loading the BDFtoSNF support and using the ordinary `Compile File` command.
`Create X Font Directory` invoked the MkFontDir program to rebuild `fonts.dir`
after SNF files were added or removed. Its directory argument had to be a Genera
logical pathname.

These SNF files belong to the historical X Server product and are not the same as
the resident Genera raster-font objects recovered from the world. No X Server
fonts are extracted or published here.

## X-Documentation

The `X-Documentation` declaration builds a Sage book from its X documentation
module and also incorporates three UX/SIG documentation modules. The local
`x-documentation.sab` is 22,010 bytes and decodes to 18 top-level records. The
record titles provide this complete installed topic inventory without reproducing
the licensed bodies:

| Group | Installed titles |
| --- | --- |
| Book and client | `Symbolics X Window System User's Guide`; `The Genera X Client`; `Configuring the Remote Screen Facility for the X Client`; `Installing Genera Fonts for the X Client`; `Installing Genera Fonts for the M.I.T. X Server`; `Providing X Server Access to the Symbolics Machine` |
| Server overview | `The Genera X Server`; `Introduction to the X Server`; `Installing the X Server`; `Using the X Server` |
| Server controls | `Start X Server Command`; `Halt X Server Comand`; `Switch Mode X Server Command`; `Halt Server X Server Command`; `Start Server X Server Command` |
| Server fonts | `Compiling Fonts for the X Server`; `Compiling BDF Files to Symbolics X Server SNF Files`; `Create X Font Directory Command` |

`Comand` is the spelling in the installed title and is retained as artifact
metadata, not silently corrected. The decoded JSON and prose remain under the
ignored Genera Help build tree, governed by the same boundary as the broader
[on-line documentation recovery](genera/online-help-and-documentation-recovery.md).

## CLX-CLIM and the two meanings of a Genera CLX port

There are two related but distinct “ports” in this area:

1. The **Genera implementation layer of CLX** makes the portable `XLIB` API work
   with Genera networking, processes, arrays, locking, and VLM life support.
2. **CLX-CLIM** makes CLIM use CLX as its display port. Its seven compiled modules
   cover the package, port, mirrors, medium, pixmaps, frames, and prefill support.

The latter requires the base `CLIM` system and is not the native `Genera-CLIM`
port. The CLIM 2 manual calls the CLX port an unsupported sample on Genera; the
native Genera port is the normal choice. The installed CLX-CLIM implementation
bodies are seven `.vbin` files totaling 108,208 bytes, with a 4,430-byte readable
system declaration. The patch component record says it was produced in a Genera
8.5a/Open Genera 2.0 environment displaying through a 1280 by 976 8-bit
pseudo-color X screen with 224 Genera fonts. That header is historical build
provenance, not a fresh museum runtime observation.

The full system/module, feature, interaction, and load-state analysis is in
[CLIM 2 on Symbolics Genera](clim-2-on-genera.md). No CLIM frame is counted as an
X Remote Screen frame merely because both can ultimately use CLX.

## Manual, source, world, and runtime comparison

| Question | Manual evidence | Source/media evidence | Runtime evidence | Conclusion |
| --- | --- | --- | --- | --- |
| Is X Remote Screen an X client? | Explicitly yes | CLX opens an X display and creates the root window | Main harness path has historically displayed Genera through a host X server, but no fresh D48 guest probe completed | Established architecture; current command behavior not freshly observed |
| Can Genera also be an X server? | Yes, through separate X11 Server on non-embedded hardware | No X Server implementation or distribution payload in inspected Open Genera media | VLM cannot satisfy the documented platform condition | Historical Genera capability, not an established Open Genera/VLM capability |
| What are the direct X Remote Screen commands? | Start, Halt, and Show Keyboard Mapping are documented | Newest source and VLOD strings name five, adding Show Font Mapping and Set Keyboard Mapping | Not executed in this audit | Five source-visible names; three independently manual-confirmed; two await live confirmation |
| Can users choose `Protocol` in `Start X Screen`? | Manual says yes | Newest CP command omits it; lower layers and VLM startup retain protocol selection | Not tested | User-level keyword differs from internal capability |
| What does the default geometry mean? | Most of the X display | Source computes 5-percent offsets and 90-percent width/height, then clamps | Not freshly measured | Exact source default established, runtime result resource-dependent |
| Which keyboard families are recognized? | Manual focuses on Sun, NCD, and general layout diagrams | Released source registers Symbolics, Sun 3/4, SGI, NCD, NDS, Apple Extended, and DEC LK401-AA; newer source adds PCXAL-AA | Not queried live | Keep released and newer source generations separate |
| Does X Remote Screen require RPC? | Genera 8.3 guide says yes | 8.5 declaration names only Embedding-Support and IP-TCP | Not load-tested | Release-level dependency discrepancy remains unresolved |
| Is X-Documentation 421 or 422? | Installation guide names the system, not patch generation | Patch directory says released 421/latest 422; 8.5 roster selects 422.0 | Not relevant | Both metadata statements can be true |
| Does CLX-CLIM work on Genera? | Manual calls it unsupported sample code | Seven compiled modules and a build header demonstrate it was built in a Genera 8.5a X-screen environment | Base-world CLIM study found no loaded CLIM package/system and could not load optional files | Media presence and historical build do not establish current runnable support |

## Relationship to the museum Xvfb harness

The [Genera computer-use harness](genera/genera-computer-use-harness.md) starts a
private Xvfb on the host, exposes only its exact X socket to the isolated VLM, and
records the display, VLM, debugger, world, preload, responder, configuration,
window, action, screenshot, and shutdown identities. This is research
infrastructure surrounding the artifact.

The distinctions are exact:

| Layer | Runs where | Role |
| --- | --- | --- |
| CLX | Genera guest | X client library |
| X Remote Screen | Genera guest | Adapts Genera UI to an X client window |
| VLM console channel / X relay | Guest and VLM life support | Carries guest X bytes to the host server |
| Xvfb | Private host namespace | X server used as a virtual evidence display |
| Harness compatibility preloads | Private VLM host process | Narrow, pinned compatibility substitutions and event handling; not a general X proxy or server implementation |
| Symbolics X Server | Historical non-embedded Genera machine | X server product accepting remote X clients |
| CLX-CLIM | Genera guest, when loaded | CLIM backend producing X client operations |

The fact that Xvfb accepts X protocol requests does not make it the Symbolics X
Server. The fact that Genera is visible in Xvfb does not prove `Start X Screen`
was interactively invoked in that session: Open Genera startup can establish its
initial display through the VLM console channel.

## Runtime and screenshot status

No screenshot is published for this dossier. The meaningful visible targets are
an X Remote Screen state that exposes its own mapping or activity behavior, a
CLIM frame running through CLX-CLIM, or the historical X11 Server application.
A generic Listener already displayed by Open Genera would not distinguish any of
those claims and would be decorative.

The most recent fresh isolated launch available during this audit was session
`d43-ns-registration-20260718`, generation 1. It used the 54,804,480-byte Genera
8.5 VLOD with SHA-256
`a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`.
The Bubblewrap launcher failed before the VLM started with:

```text
bwrap: execvp /usr/bin/bash: No such file or directory
```

The action log contains zero actions; status is `failed`; no forced stop occurred;
the private and base world hashes remained unchanged. Because the guest never
started, `save_world_performed` and `guest_checkpoint_created` remain unknown,
and the session establishes no Genera behavior. No second launch was made after
this same-day failure because no harness input had changed.

### Capture-specific TODOs

- **TODO — X Remote Screen:** after repairing the sandbox executable binding,
  start a fresh isolated session and use the current X screen to run `Show X
  Keyboard Mapping` and `Show X Font Mapping`. Capture a narrowly cropped,
  non-prose-heavy state that proves command availability and effective mapping.
  Starting a second remote screen requires a deliberately contained reachable X
  endpoint; the harness currently exposes no external route.
- **TODO — activity-specific screen:** in a containment design that can expose a
  second private X endpoint, start one activity-specific screen and verify its
  title, geometry, who-line state, Select-key behavior, and shutdown/reuse cycle.
- **TODO — X11 Server:** use a licensed non-embedded Symbolics system with the
  actual X-Server and X-SERVER-FONTS media. The Open Genera VLM is excluded by
  the contemporary platform rule and lacks the implementation.
- **TODO — CLX-CLIM:** load CLIM and CLX-CLIM from a private guest-visible source
  in a newly isolated world, then run a minimal frame through the CLX port. The
  preserved base world has no loaded CLIM system.

Any future selected image requires the image- and use-specific
[screenshot publication review](screenshot-publication-rights-review.md). A
single narrow screenshot beside analysis of mapping, remote-screen geometry, or
the historical server workflow could support scholarship under a documented
four-factor fair-use conclusion. A decorative console image, a gallery, or a
screen full of licensed Help prose would not meet this page's evidence need.

## Preservation implications

- Preserve `CLX`, `X-Remote-Screen`, `X-Documentation`, `X-Server`, and
  `CLX-CLIM` as separate catalog entities even though the vendor grouped them in
  one X manual.
- When emulating Open Genera display behavior, preserve the client-side CLX and
  VLM-console-channel semantics separately from the chosen modern host X server.
- Do not describe an Xvfb screenshot as evidence that the Symbolics X Server ran.
- Preserve source generation numbers as well as system versions. The keyboard
  43/44 and X-program 22/23 boundaries show why a newest-file audit is not
  automatically a released-world audit.
- Preserve X resource defaults, keyboard mappings, font substitution, and
  off-screen-pixmap policy. They affect what the interface looks and feels like
  even when the core X protocol is reproduced correctly.
- Keep XDMCP's trust and initialization gates. Reimplementing only the packet
  opcodes without those policy conditions would change historical behavior.
- Treat X Server SNF fonts, Genera X client BDF fonts, resident Genera raster
  fonts, and hardcopy outline fonts as distinct assets with distinct recovery
  and rights paths.
- Keep decoded licensed on-line X documentation ignored. The inert
  [Genera Help extractor](genera/online-help-and-documentation-recovery.md)
  provides reproducibility without distributing the prose.

## Local artifact provenance

All paths in this table are portable logical suffixes within the private Open
Genera runtime tree; no host-specific absolute path is published.

| Artifact | Bytes | SHA-256 | Use in this audit |
| --- | ---: | --- | --- |
| `sys.sct/x11/clx/defsystem.lisp.~5008~` | 18,238 | `983b080cf779ca460792f1722404b34323aeabcbada5f6d29cc9b86aef4a7f4d` | CLX module graph and VLM conditional |
| `sys.sct/x11/clx/package.lisp.~5002~` | 21,405 | `34451543f885cc0c59dbef854ae34bd9db4aaedc18af082e5e0d6d2562476fa4` | 559-name public export audit |
| `sys.sct/x11/clx/dependent.lisp.~5036~` | 123,439 | `5f4291b42979055b70cef1cecb49348603477747dacc0598a9f4fd23fab2e423` | Genera transports and implementation dependencies |
| `sys.sct/x11/clx/vlm-console-channel.lisp.~37~` | 17,399 | `1f9143a201d2b5cb2425741ea00bf92f66fcbade4f7c7cb35c1e09d3b527a46d` | Guest/VLM X transport |
| `sys.sct/x11/screen/sysdcl.lisp.~22~` | 3,559 | `fb5f3697bd8381d3cf76c6fa2ae876e8556a11fa9d0932d9a39f54c16ed33693` | X Remote Screen composition and dependencies |
| `sys.sct/x11/screen/x-program.lisp.~23~` | 22,081 | `eb0266c806e25a5ffb8280b967e41cdc6a3e5e587248233a4ee30d801eb2b5ec` | Newest source command/program inventory |
| `sys.sct/x11/screen/x-console.lisp.~46~` | 82,191 | `4bee0c1f16d71fbce277491cca8fb2a9802bdd59a38cb44726bbd9cc873c688f` | Window defaults, resources, events, font path |
| `sys.sct/x11/screen/x-display-device.lisp.~9~` | 42,089 | `85745c5b21ec557b24480bc2dcf1d527017614a4d344c888825157707acdedf3` | Display-device behavior |
| `sys.sct/x11/screen/keyboards.lisp.~44~` | 75,353 | `b28392b18273fd5f4c9fa2a4a570021d8ecf85634fd68b103cfff78ce72a9d92` | Newest keyboard source; PCXAL-AA addition is not attributed to released generation 43 |
| `sys.sct/x11/screen/xdmcp.lisp.~7~` | 12,844 | `ac7cb062ae5a079b081bcd319996c73c4211bb6b59fafdc013c77b90806c7231` | XDMCP protocol and lifecycle |
| `sys.sct/x11/doc/sysdcl.lisp.~11~` | 3,436 | `7852bb875cb2cfd187f4c8485865a2d11a1476789c714d58d774dcefcb1a80b0` | Documentation system composition |
| `sys.sct/x11/doc/x-documentation.sab.~18~` | 22,010 | `e58b896a4e49a418489d6980fbc96a4ba5f26ad5bae1416c53725ba904592c8f` | 18-record installed topic inventory |
| `sys.sct/clim/rel-2/clx/sysdcl.lisp.~11~` | 4,430 | `3fa2a9c6be50d609f7fe5702a50644529809d5e5a7f03c206c0ceedd216161ac` | CLX-CLIM module graph and dependency |
| `sys.sct/sct/system-info.lisp.~206~` | 85,747 | `8f3196dbadb0c6eb77c35e148aa8618fd05a6cd36b2e68bbe671c0dcd4f95607` | Open Genera 2.0 release roster |
| `Genera-8-5.vlod` | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` | Inert system/command-name scan and failed-launch identity |

The top-level physical-file inventories are:

| Tree | Files | Bytes | Interpretation |
| --- | ---: | ---: | --- |
| `sys.sct/x11/clx/` | 24 | 995,358 | Readable CLX implementation, example, and VLM channel |
| `sys.sct/x11/screen/` | 13 | 428,679 | Remote-screen source, two retained keyboard generations, and four XBM icon/mask files |
| `sys.sct/x11/doc/` | 3 | 28,844 | Declaration, book definition, and SAB |
| `sys.sct/clim/rel-2/clx/` | 8 | 112,638 | One readable declaration plus seven compiled port modules |

The original purchased Open Genera archive is 206,213,430 bytes with SHA-256
`89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`.
It is an untracked licensed input and is not distributed by this repository.

## Public document provenance

| Document | Pages | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Symbolics X Window System User's Guide | 21 | 151,207 | `ea8ca58cecdf6ec356a922ae5bbb8c637c7f4daa8735e8328d20d4bfbc84cd9e` |
| CLX Programmer's Reference | 234 | 980,248 | `57a9844ee10adee502c8d21b23a07dbc818eca2277c9274c2168601468602e38` |
| Genera 8.3 Software Installation Guide for UX Family Machines | 75 | 498,160 | `f8c09d757e08c65094676b76f5ad8d2e95d4b1309962c60cf26d463e57c2a126` |
| Genera 8.3 Software Installation Guide for 3600 Family Machines | 80 | 543,814 | `e30becd77fcf4e1491c1377cbed452eaaaf05efa4965843e72f5b06108b46551` |
| Genera 8.1 Release Notes | 202 | 1,020,591 | `4b26763c71ada2ddd3dc4019e83f70df9ff242857a99e5d5326ca68f0be23225` |
| Open Genera Beta II Release Notes | 15 | 97,257 | `2aedf9f0110693c46bdc0f164c7e69e5916df48f023d742a7881aed30833d9f1` |

PDFs were inspected with Poppler `pdfinfo` and `pdftotext -layout`. Local source
was searched and counted inertly with `find`, `rg`, `strings`, `sha256sum`, and a
whitespace-token audit scoped to the `XLIB` export form. No licensed Lisp form was
evaluated.

## Open questions

- Which of the two newer `x-program` source-only commands were introduced before
  or by X-Remote-Screen 448.3, and what exact argument surface does the compiled
  world expose? A successful live command-table query is needed.
- Does the Genera 8.5 runtime treat `RPC` as a transitive dependency of X Remote
  Screen, or was the explicit 8.3 requirement removed?
- Was `X-Server` ever distributed for a VLM despite the 8.3 non-embedded rule?
  The inspected Open Genera roster, CD list, and source tree say no, but a later
  separate product notice could refine the history.
- What authorization mechanisms and site defaults were normally used in
  production for remote X connections beyond the explicit CLX authorization
  arguments and manual `xhost`-era setup?
- How did real X terminals behave when server-side temporary pixmaps exhausted
  memory, and which sites disabled that optimization?
- Does released keyboard source generation 43 exactly match the loaded 448.3
  binary after patches 1 through 3, particularly for DEC keyboards?
- Which CLIM demonstrations were historically exercised through CLX-CLIM rather
  than the native Genera port? The build header proves a CLX display environment,
  not a specific application run.
- Can a non-embedded Symbolics X11 Server installation and its C/SNF media be
  preserved with sufficient rights and provenance for a future isolated runtime
  study?

## Validation result

Verified 2026-07-18:

- exactly five `cp:define-command` forms occur in the newest inspected
  `x-program` source;
- the released keyboard source generation contains eight signature families and
  seven named family-specific mappings plus the portable default; the newer file
  adds PCXAL-AA;
- the `XLIB` export form contains 559 unique whitespace-delimited exported names;
- the X documentation SAB decodes to 18 records whose titles match the inventory
  above;
- the Open Genera release roster contains CLX 450.0, X Remote Screen 448.3, and
  X Documentation 422.0, but no X Server;
- recursive declaration/name searches found no X Server implementation or font
  distribution in the inspected runtime tree;
- all local and public artifact hashes in the provenance tables were recomputed;
  and
- no screenshot, decoded Help body, licensed source body, or extracted font was
  added to the tracked documentation.

## Sources

- Symbolics, [Symbolics X Window System User's Guide](https://bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_X_Window_System_User_s_Guide.pdf),
  especially printed pages 1265–1284; verified 2026-07-18.
- Texas Instruments and MIT contributors, [CLX Programmer's Reference](https://cmucl.org/doc/encycmuclopedia/x/clx.pdf),
  1988–1989; verified 2026-07-18.
- Symbolics, [Genera 8.3 Software Installation Guide for UX Family Machines](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_UX_Family_Machines.pdf),
  printed pages 705–706; verified 2026-07-18.
- Symbolics, [Genera 8.3 Software Installation Guide for 3600 Family Machines](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.3_Software_Installation_Guide_for_3600_Family_Machines.pdf),
  printed pages 480–481; verified 2026-07-18.
- Symbolics, [Genera 8.1 Release Notes](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_8.1_Release_Notes.pdf),
  “Changes to the X Window System in Genera 8.1,” printed pages 135–136; verified
  2026-07-18.
- Symbolics, [Open Genera Beta II Release Notes](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Beta_II_Release_Notes.pdf),
  CD source and loadable-system inventories; verified 2026-07-18.
- Symbolics, [Common Lisp Interface Manager (CLIM) Release 2.0](https://bitsavers.org/pdf/symbolics/software/genera_8/Common_Lisp_Interface_Manager__CLIM__Release_2.0.pdf),
  CLX port support statement; verified 2026-07-18.
