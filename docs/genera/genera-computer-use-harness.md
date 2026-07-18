---
type: Preservation Note
title: Operating Genera through the Xvfb computer-use harness
description: Isolation, compatibility, provenance, input, screenshot, and persistence boundaries for private headless Open Genera sessions.
tags: [genera, open-genera, vlm, computer-use, xvfb, preservation]
timestamp: 2026-07-18T02:30:44-04:00
---

# Operating Genera through the Xvfb computer-use harness

The repository can operate the identified Genera 8.5 world through its real VLM X11
client on an authenticated private Xvfb display. The tracked harness contains the
native process in a Bubblewrap filesystem, process, and network sandbox, discovers
the changing Cold Load and main windows, sends real XTEST keyboard and pointer
events, and captures the exact selected client.

This is repeatable behavioral-research infrastructure, not a Genera distribution.
The purchased archive, world, debugger, private runtime copies, logs, raw screen
captures, and complete session records remain below the ignored
`build/genera-computer-use/` tree. Six Zmacs images selected after a capture-specific
rights review are tracked separately as curated evidence; their
[asset catalog](../assets/genera-screenshots/) records the raw mappings and boundary.

Operational commands are in the root
[Open Genera guide](../../README.md#genera-headless-computer-use-harness). The tracked
entry point is
[`scripts/genera-computer-use.sh`](../../scripts/genera-computer-use.sh).

## Evidence boundary

Four layers must remain distinct:

- **Licensed inputs and raw outputs** include the purchased archive, Genera world,
  debugger, raw screenshots, logs, and session records. They remain local research
  material, not tracked repository content.
- **Public host machinery** includes the historical Linux VLM from the pinned
  `snap4` payload, the tracked harness, and its small compatibility components.
- **Runtime observations** establish what the exact world and VLM displayed after a
  recorded action sequence. They do not by themselves establish historical intent,
  behavior in another release, or behavior on a physical Symbolics machine.
- **Curated publication artifacts** currently comprise six exact Zmacs PNGs selected
  because each is needed beside analysis of an observed behavior. Their
  [capture-specific fair-use review](../screenshot-publication-rights-review.md) does
  not license the underlying interface, authorize other captures, or change the
  local-only status of the raw session and licensed inputs.

The locally verified inputs are:

| Artifact | Role | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `opengenera2.tar.bz2` | Purchased Open Genera archive | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| `Genera-8-5.vlod` | Licensed Genera world | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| `VLM_debugger` | Licensed debugger world | 346,880 | `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| `genera` | Public Linux VLM executable | 1,533,760 | `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| `snap4.tar.gz` | Historical public VLM payload | Not redistributed here | `e03dd3f2f75a55445aa762dbd2e98ba654d9bda135b54353877f136d2fe34be8` |

The staging helper rejects a `snap4` payload with a different digest. The computer-use
harness also rejects a staged world, debugger, or VLM whose digest differs from the
identified set. These hashes identify the investigation; they are not download links
or grants of redistribution permission.

## Private-session architecture

Every named session is restricted to
`build/genera-computer-use/<session>/`. A fresh run proceeds as follows:

1. The staging path verifies the supplied archive and the pinned `snap4` payload,
   then exposes the known base world, debugger, and VLM.
2. The harness creates private copies of those three artifacts. It builds private
   copies of the narrow `ifconfig` and X11 compatibility modules and copies the
   tracked RFC 868 responder. Generated configuration, `hosts`, `nsswitch.conf`, and
   Xauthority files also live in the private runtime.
3. Immediately before launch, the supervisor rehashes every private artifact and
   every tracked launch source against the preparation record. The execution record
   is written before the VLM is started.
4. Xvfb listens only on one authenticated Unix socket; TCP is disabled. Before VLM
   launch, `xmodmap` installs the compatible host-side Mod2 setting required by the
   traced Cold Load path: Mod2 contains keycode `0x71`, keysym `Left`, rather than
   `Num_Lock`. This is not the rejected 18-key-per-row guest map.
   Xvfb is launched with MIT-SHM disabled, and `xdpyinfo` must confirm that both it
   and the relay's reserved `QueryExtension` name are absent before the session can
   continue. Disabling MIT-SHM prevents the X server, which runs outside the VLM's
   IPC namespace, from resolving host-namespace shared-memory identifiers on behalf
   of the sandboxed client. The reserved-name check establishes the absent reply on
   which the exact relay substitution depends.
5. Bubblewrap creates separate user, mount, network, PID, IPC, and hostname
   namespaces. The sandbox receives a minimal `/proc` and `/dev`, a read-only
   `/gnu/store`, generated `/etc/hosts` and `/etc/nsswitch.conf`, the exact X socket,
   two exact read-only helper scripts, and one writable private runtime. It does not
   receive the host root, home, repository, `/run/user`, agent sockets, D-Bus sockets,
   or container-engine sockets. Its environment and `PATH` are rebuilt explicitly.
6. The network namespace contains TAP `tun0` at `10.0.0.1/24` and a dummy `eth0` at
   `192.0.2.1/24` with MAC `02:00:00:00:00:01`. It has no default route, external
   route, NFS, FTP, Nimble, or other guest-visible file service.
7. A supervised process binds UDP port 37 as a guard and listens on `tun0` with an
   `AF_PACKET` socket. It answers exactly one observed RFC 868 request with one raw
   Ethernet frame, records the request and reply fields and frame hashes, and exits.
   The launch helper reaps the responder and writes a separate successful-exit record
   tied to the evidence hash. The supervisor will not report `running` without both
   valid records and observed completion markers for the two exact X relay
   substitutions. A separate failure marker lets responder or completion errors
   reach the outer bounded cleanup immediately even if the VLM is still waiting at
   its own termination prompt. No read API is interposed. TAP descriptors are never
   tracked as Displays, so their writes delegate unchanged.
8. The private VLM is launched directly. The ordinary Open Genera launcher is a
   staging mechanism, not another runtime layer around the session.

The sandbox is a strong reduction of native-process reach, but it is not a claim
that a historical binary is safe against all kernel or X-server vulnerabilities. The
VLM retains the capabilities required to configure and use its throwaway network
namespace and can reach its dedicated Xvfb socket. Those residual boundaries belong
in any threat assessment.

## Narrow compatibility behavior

The harness does not execute the broad ordinary-launch compatibility preload. Its
two private modules have smaller contracts.

The `ifconfig` module intercepts `system(3)` only for this exact command, whose work
the namespace helper has already completed:

```text
/sbin/ifconfig tun0 10.0.0.1 dstaddr 10.0.0.2 netmask 255.255.255.0
```

Every other `system(3)` request reaches libc unchanged.

The X module has two deliberately different boundaries because direct tracing proved
that the VLM has two different X paths.

For every successful `XOpenDisplay`, typed Xlib state is attached to that `Display`
with `XExtData`. `XESetWireToEvent` wraps the seven core input-event converters. Each
wrapper first delegates to the converter it replaced, then changes only a resulting
`CurrentTime` field. At this boundary the module:

- gives core input event types 2 through 8 a nonzero timestamp only when Xlib
  produced `CurrentTime`;
- acknowledges the byte-exact typed modifier request locally after the private Xvfb
  has been prepared with the compatible Mod2 keycode `0x71`; and
- pairs a locally suppressed typed `XGrabServer` call with its typed
  `XUngrabServer`. An unmatched tracked ungrab is enqueued and flushed while one Xlib
  display lock is retained.

The main Genera display is different. Static inspection locates its connection in
`DoConsoleIO`: the host calls `XOpenDisplay`, takes the connection descriptor, and
then relays guest-supplied X11 requests with `write(2)` and replies with `read(2)`.
Those requests never cross the host's `XSetModifierMapping` function, so a typed
interposer cannot return the success reply that the guest requires.

The relay accommodation is therefore intentionally byte-exact and pinned to this
VLM. The preload globally wraps `write(2)`, but records descriptors only from its
wrapped `XOpenDisplay` results and removes them at `XCloseDisplay`. On those live
descriptors it recognizes only two little-endian call shapes:

| Observed guest request | Replacement | Preserved property |
| --- | --- | --- |
| Eight bytes: `GrabServer` followed by `GetModifierMapping` | `NoOperation` followed by the unchanged `GetModifierMapping` | Two requests, no added reply, unchanged sequence count |
| The fingerprinted 148-byte `SetModifierMapping` request | One 148-byte `QueryExtension` for a 140-byte reserved name | One request, one 32-byte reply, unchanged sequence count |

Before VLM launch, `xdpyinfo` must show that the reserved extension name is absent.
An absent `QueryExtension` reply has `present = 0`; that byte occupies the same place
and has the same value as `MappingSuccess = 0` in a successful
`SetModifierMapping` reply. The replacement therefore supplies the reply the guest
expects without installing the rejected historical map. The request and map
fingerprints are:

- complete request SHA-256
  `e17ca71a9780516bee282b09c5297660122fca7806a111dc00771748e850fc71`;
  and
- 144-byte map SHA-256
  `a7362578d007021c2ebed608aa5a02783e440382db61f77d6c9ee732a88a0466`.

On the verified same-thread continuation path, short writes do not mix replacement
bytes with a retry from the original buffer. The preload retains the replacement
offset for the writing thread, verifies that the next bytes are the corresponding
original tail, and continues with the replacement tail. A mismatch fails closed with
`EPROTO`. Every untracked or nonmatching write delegates byte-for-byte. No
read-family API is interposed; TAP, world-image, ordinary-file, and unrelated-socket
writes are never modified. The supervisor will not report `running` until the log
contains successful-completion markers for both exact relay substitutions as well as
valid RFC 868 evidence.

A compiled behavioral harness covers independent Displays, converter chaining and
lifetime, all typed timestamp fields, exact typed modifier matching, typed
grab/ungrab pairing, full and partial relay writes, mismatched-continuation failure,
nonmatching delegation, and descriptor removal at close.

### Why the relay boundary is necessary

Ignored diagnostic session `xgrab-wire-current`, generation 1, started
`2026-07-17T22:59:57-04:00` with the world and VLM identities in the table above. Its
19,025,232-byte full-process write trace is retained as
`diagnostics/xgrab-wire-current.strace` below the ignored computer-use root and has
SHA-256
`302d2395f4af69025124ab312e4430029f2018184d9e578d2e082b2d102604fa`.
The Cold Load display used Xlib `writev` and entered the typed hooks. The later main
display used VLM `write(2)` on descriptor 4: it sent `GrabServer` plus
`GetModifierMapping`, then the exact 148-byte `SetModifierMapping`. Xvfb returned
`BadValue` for opcode 118, and the guest sent no later request or `UngrabServer` on
that connection.

Ignored diagnostic session `xguard-typed-probe`, generation 1, tested a typed-only
alternative. A pre-VLM client made itself impervious to server grabs with XTEST and
repeatedly issued typed `XUngrabServer`. This freed Xvfb sufficiently for the harness
to discover and capture the 1,200 by 900 main window, but all three captures were
blank and pixel-identical: PNG SHA-256
`97a7ee166891b77a8923bbeaf3235414e9539c93518d0d1a039fe3fdd74e5035`
and normalized-pixel SHA-256
`b535bff2f596e50c384a155d2503b1170b360dca5e88537c6548b6717756b71b`.
After a recorded successful XTEST dispatch of `Help Commands` plus Return, the pixels
still did not change. The run ended forced and incomplete. The guard could release
the server grab; it could not synthesize the success reply awaited by the guest. A
fresh exact-relay run instead advanced through `Lisp is running` and produced visible
responses to the same input, so the relay accommodation is necessary for this
identified world and VLM pair.

Earlier traces also observed zero-timestamp core events. The modifier map repeats
nonzero keycodes in multiple modifier rows; inspection of the packaged Xorg Server
21.1.21 source found that its modifier-map builder rejects a keycode already assigned
earlier in the same request. This explains the local `BadValue`; it is not a claim
about every X server or VLM release.

## Time-service evidence

The observed request is an empty UDP datagram from guest IP `10.0.0.2`, guest MAC
`40:00:00:00:00:00`, and source port 1025 to broadcast IP and MAC on destination
port 37. Its 58-byte Ethernet frame has stable SHA-256
`99436b7cb2393ba0d8b1691a9393b2bfdd7a33d7fc976461e721bb074542710c`
in the tested world.

The responder sends a 46-byte IPv4/UDP frame from `10.0.0.1`, MAC
`02:00:00:00:00:25`, and port 37 to the observed guest addresses and port. The UDP
checksum is zero and the four-byte payload is RFC 868 seconds since 1900. Payload and
reply-frame hashes necessarily vary with wall-clock time. Each generation records
the exact values rather than treating one old reply as a fixture.

The VLM log also contains a finite burst of `tx ip` messages after the one time
exchange. Packet inspection identified those frames as ICMP echo requests, not
additional RFC 868 attempts. The time responder still receives and answers exactly
one UDP request.

## Window discovery and input

Open Genera changes X clients while moving from Cold Load to the main display. The
harness continually rediscovers candidates and ranks a window titled `Genera on ...`
above the Cold Load and debugger windows. Status, action, and screenshot records
retain the selected identifier, title, kind, and geometry.

`key`, `type`, and `mouse` focus that selected client and send real XTEST events.
Each operation appends an intent record before dispatch and a linked `succeeded` or
`failed-or-partial` outcome afterward. A timeout after partial XTEST delivery
therefore remains visible instead of silently disappearing from the action history.
A `succeeded` outcome proves host dispatch; a guest-behavior claim additionally
requires a visible or otherwise recorded resulting state change. This verifies the
preserved X client and VLM input paths, not the electrical behavior or legends of a
historical Symbolics keyboard and mouse. Mouse coordinates are client-relative and
are checked against the observed root position after each move.

The default `wait` condition is semantic main-window discovery. Pixel stability is
available for special cases but is not a readiness guarantee; the Listener's blinking
cursor can also prevent a stable-pixel condition indefinitely.

## Per-generation provenance

`run.json` is the current convenience record. A generation-scoped copy under
`runs/generation-NNNN.json` is updated atomically while that generation is active;
ordered actions live under `actions/generation-NNNN.json`. Starting another
generation freezes and consistency-checks the preceding record rather than silently
relabeling its inputs or screenshots.

A screenshot sidecar and the generation run record together retain:

- archive, base, private, and execution-time hashes for the world, debugger, VLM,
  configuration, responder, and both compatibility modules;
- hashes of the Python supervisor, shell entry point, two sandbox helpers, responder
  source, and compatibility sources;
- Guix channel, manifest, Python, and resolved command provenance;
- Bubblewrap mounts, namespace mode, capabilities, network interfaces, and absence
  of a default route or guest file service;
- RFC 868 request and reply evidence plus the responder's successful-exit record;
- the live-verified absence of MIT-SHM and the reserved relay extension name from
  the private X server, plus both observed relay-substitution completion markers;
- the selected window, geometry, ordered actions, PNG hash, and normalized RGB pixel
  hash; and
- prompt, confirmation, cleanup, process, forced-stop, and world-identity results.

The ignored records contain machine paths and licensed-derived data. Tracked prose
uses portable names, sizes, hashes, actions, and original-language descriptions only.
Transient wait captures are streamed by ImageMagick into atomically installed files
under a host-only session directory; the VLM-writable runtime never receives their
pathnames.

## Shutdown confirmation currently ends in forced cleanup

When Lisp is running, the VLM handles `SIGTERM` by asking on standard input whether
it should exit. The supervisor signals the actual loader-launched VLM, waits for the
`(yes or no)` prompt, and writes lowercase `yes` followed by newline to the inherited
pipe. A direct system-call trace proved `read(0, "yes\n", 4096) = 4` for the public
VLM identified above.

The answer begins cleanup and breaks the X connection, but this VLM does not finish.
It stalls while `TerminateColdLoadChannel` waits at the mutex stored at
`EmbCommAreaPtr+0x6f8`. After a bounded grace period the harness sends `SIGKILL`,
reaps the wrapper and responder, and terminates Xvfb. The expected `stop` result is
therefore status 2 with `forced_stop`, `state_may_be_incomplete`, and
`forced_after_confirmed_shutdown_stall` true. It is not an orderly host shutdown.

The record keeps prompt observation, confirmation sent, confirmation accepted,
cleanup progress, forced termination, and orderly exit as separate facts. Prompt and
cleanup tokens are searched only in log bytes appended after the current `SIGTERM`,
so text left by an earlier event cannot satisfy a later shutdown. A forced fallback
caused by some other supervisor failure must not be relabeled as the confirmed mutex
stall. The inner helper never performs an unreported VLM `SIGKILL`; bounded forcing
belongs to the outer supervisor and is recorded as incomplete state.

Neither the accepted answer nor forced process cleanup invokes Genera's in-guest
`Save World`. The harness creates no host-process checkpoint and configures no NFS,
Nimble, or FTP service. Absent an explicit, separately verified in-guest Save World
action, unsaved Lisp memory, editor buffers, definitions, and processes are discarded
with the VLM process. A later start creates a new VLM and loads the private world
file; `--fresh` refreshes that file from the verified base. A changed private-world
hash is recorded but is not by itself labeled a successful Save World.

## Screenshot policy and final verification

The harness captures the exact 1,200 by 900 main client, not the 1,440 by 1,100 Xvfb
root. Raw Genera captures and their sidecars remain licensed-derived local research
material in the ignored session tree. Tracking a selected image requires a documented
capture-specific legal basis and a scholarly purpose; permission is one possible
basis, but a supported fair-use conclusion can also justify publication.

The review completed on 2026-07-18 covers exactly six functional Zmacs captures. The
[rights review](../screenshot-publication-rights-review.md) explains the four-factor
analysis, and the [curated asset catalog](../assets/genera-screenshots/) records their
exact raw-to-curated mappings, action-prefix provenance, PNG and pixel hashes,
shutdown result, and project-license exclusion. Only the unmodified PNG bytes were
copied; sidecars, logs, and every other session artifact remain ignored. This decision
is not blanket permission for other Genera screens, bulk galleries, Help text, source,
fonts, or extracted assets.

Ignored session `museum-final-current`, generation 1, is the final post-hardening
validation record. It booted at `2026-07-18T00:00:42-04:00` and reached marker-gated
`running` at `00:00:45`. Its execution record identifies Python harness source
SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`,
X-compatibility source SHA-256
`4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392`,
and built X module SHA-256
`acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1`.
The run record contains both exact-relay completion markers, live absence evidence
for MIT-SHM and the reserved extension name, one validated RFC 868 request and reply,
and a successful responder exit.

The three local 1,200 by 900 captures are:

TODO: capture-specific rights review has not been completed for these three
Listener and System Menu images, so they remain local-only.

| Portable filename | Visible state | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | --- | --- | --- |
| `0001-initial-listener.png` | Dynamic Lisp Listener 1 for `DIS-LOCAL-HOST`; the display explicitly says the world is not configured for the local site and servers are disabled | `491367d073809a339ae8450224a15f01f3086782dfe1b3007f91d3277a63dcd7` | `aad5aaa101a62abbe824c04f148fe7ceb0d6918d61472b20803def984751f5c3` |
| `0002-help-commands.png` | Visible response to typed `Help Commands` plus Return, including the command-table categories | `2327e65c17f25f66200608654ca5be9f5b3c4fd6883f4fa0c5507f0563a11820` | `37f6bbbea04625966db36cec23a3e10d042d15bff12a206cb053c3095f59d4bb` |
| `0003-system-menu.png` | The System Menu visibly open after `Shift_L` down and client-relative button-3 click at `(810, 360)` | `4bc60e8a4fa530c479f53db0a334c2c65c8239a0cce4d193a036f07d2a4504ce` | `40255bfabd1f8c1932459c422e90d08a7e802eb1418a3c9a08dd8a606569c2e4` |

All five action attempts have linked `succeeded` outcomes. This includes a repeated
move to `(810, 360)` after the menu capture, verifying that the harness no longer
waits indefinitely when the pointer is already at the requested coordinate. The
session stopped at `00:01:48` after the prompt, confirmation, and cleanup-progress
markers were all observed. It records the known forced shutdown stall, unchanged
base and private world hashes, no Save World invocation by the harness, and unknown
rather than guessed in-guest save/checkpoint status.

## Repeating an observation

1. Run `doctor`, then start a named `--fresh` session with the purchased archive.
2. Use `wait --session NAME` and inspect the selected main window.
3. Record every `key`, `type`, and `mouse` action in order.
4. Capture each distinct state with a descriptive screenshot label.
5. Stop the session and expect status 2 for the currently identified shutdown stall.
6. Retain the ignored generation record, action log, sidecars, logs, and private
   artifacts until the claim has been reviewed.
7. In tracked prose, distinguish source evidence from runtime observation and record
   the portable provenance of the raw capture.
8. Before tracking any image, document its precise analytical purpose and assess its
   copyright, contract, privacy, and confidentiality boundary. Permission, public
   domain status, and a supported capture-specific fair-use conclusion are distinct
   possible publication bases.
9. For an approved image, copy only the curated PNG into the appropriate asset
   catalog, retain the exact raw mapping and hashes, exclude it from the project
   license, and embed it beside the claim with descriptive alt text and a runtime
   observation caption.
10. If that review is incomplete, keep the pixels local and retain an explicit
    `TODO: screenshot pending rights review` in the publishable article.

## Sources and verification

- Symbolics, [*Open Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_User_s_Guide.pdf),
  especially “Controlling Open Genera” for starting, exiting, and saving worlds.
- Symbolics, [*Open Genera Installation Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Installation_Guide.pdf),
  for the host, network, world, and debugger roles.
- X.Org Foundation, [Xorg Server 21.1.21 source release](https://www.x.org/releases/individual/xserver/xorg-server-21.1.21.tar.xz),
  especially `dix/inpututils.c` for duplicate modifier-key validation and
  `dix/extension.c` for the absent-extension reply; source inspected 2026-07-17.
- X.Org Foundation, [*X Window System Protocol*](https://www.x.org/archive/current/doc/xproto/x11protocol.pdf),
  for the core `QueryExtension`, `SetModifierMapping`, request-sequence, and reply
  layouts; inspected 2026-07-17.
- The tracked harness, sandbox helpers, responder, and two bounded compatibility
  sources in `scripts/`, inspected 2026-07-17.
- Local A/B boots, X protocol logs, packet evidence, process traces, and shutdown
  inspection retained under the ignored build tree, inspected through 2026-07-18.

Last verified: 2026-07-18.
