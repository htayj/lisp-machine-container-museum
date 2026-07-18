---
type: Preservation Note
title: Operating CADR through the Xvfb computer-use harness
description: Architecture, provenance, verified System 303 interactions, and limitations of the museum's private headless CADR sessions.
tags: [mit-cadr, lm-3, usim, computer-use, xvfb, preservation]
timestamp: 2026-07-18T02:21:27-04:00
---

# Operating CADR through the Xvfb computer-use harness

The repository can operate the current LM-3 System 303 environment through its real
`usim` X11 client on a private Xvfb display. This gives the museum a repeatable way to
test keyboard and mouse behavior and capture provenance-bearing screenshots without
using the host desktop. It does **not** turn one emulator run into proof about every
historical CADR, software release, or physical input device.

Operational commands are in the root
[CADR guide](../../README.md#headless-computer-use-harness). This page records how the
harness isolates a session, what the smoke series actually established, and what
remains uncertain. The tracked implementation is
[`scripts/cadr-computer-use.py`](../../scripts/cadr-computer-use.py), invoked through
[`scripts/cadr-computer-use.sh`](../../scripts/cadr-computer-use.sh) so its tools come
from the repository's Guix manifest.

## Evidence boundary

Two different kinds of evidence appear here:

- **Source and artifact facts** identify the maintained LM-3 restoration check-ins,
  load-band file, and harness mechanism inspected on 2026-07-17.
- **Runtime observations** report pixels and responses produced by one cold-booted
  `System 303-0` session. They establish behavior for that artifact and emulator
  combination, not automatically for an original MIT installation or a different
  load band.

The post-hardening confirmation run used:

| Component | Inspected identity |
| --- | --- |
| Load band | Public and private-start SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5`; public `disk-sys-303-0.img` size 269,562,880 bytes |
| System source | Current public and private copy-time LM-3 `sys` check-in [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), tagged `system-303`; private tree SHA-256 `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e` |
| Emulator | `usim` check-in [`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`](https://tumbleweed.nu/r/usim/info/330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d), executable SHA-256 `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be`, reporting `CADR emulator v0.9-ams sdl3-release` |
| Harness | Repository working tree based on commit `d62ad48fbf879fb09c7bc17c49735116cc13e143`, observed before the harness and its hardened provenance layout were committed |
| Session | `smoke`, generation 5; private sources copied 2026-07-17 at 17:07:36 -04:00 and session started at 17:07:40 -04:00; all three source-change flags false |
| Toolchain | Guix `guix` channel commit `230aa373f315f247852ee07dff34146e9b480aec`; `manifest.scm` SHA-256 `aad8d704f1f624005cb2065c2784a1e5e11770a4f282bb1045ab5cfac6962193`; Python 3.11.14 |
| Client window | Four captures at 768 by 963 pixels, title `LOCAL-CADR [running]` |
| Clean stop | `forced_stop` and `state_may_be_incomplete` false; public base checksum unchanged; `usim` and Xvfb exit status 0; recorded supervisor, emulator, and Xvfb PIDs gone after stop |

The System 303 Fossil check-in is a maintained restoration branch. Its modern Fossil
date is not the date on which the historical Lisp software was written. The table
pins the exact source and emulator context of this observation rather than merging
restoration history with original-system history.

The generation-5 source snapshot supplies the following private-copy fingerprint.
The hash at start equaled the copy-time hash in each case:

| Private tree | Fossil revision at copy | Tree SHA-256 at copy and start | Changed since copy |
| --- | --- | --- | --- |
| System | `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91` | `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e` | No |
| Site | `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e` | `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81` | No |
| Chaos | `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e` | `34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87` | No |

The current public System, site, and Chaos revisions at start were the same as those
copy-time revisions. The current public umbrella checkout was
`d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6`.
The private machine files selected by the configuration were:

| Private machine file | SHA-256 at start |
| --- | --- |
| `promh.mcr` | `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6` |
| `promh.sym` | `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d` |
| `ucadr.sym` | `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |

## Private-session architecture

Each named session lives below the ignored
`build/cadr-computer-use/<session>/` tree. The arrangement is deliberately local and
disposable:

1. The default state root carries a `.cadr-computer-use-root` ownership marker. Each
   session carries `.cadr-computer-use-session`, and each completed runtime carries
   `.cadr-computer-use-runtime`. Existing roots or sessions without the expected
   marker are not adopted. An existing runtime must have the recognized marker before
   it can be reused, replaced by `--fresh`, or removed with its session.
2. The harness prepares the public LM-3 checkout and a usable `usim` binary when they
   are absent. A repository-global preparation lock serializes bootstrap and rebuild
   work on these shared inputs even when callers select different state roots. The
   computer-use start path retains that lock until its private disk and source
   snapshot is complete. The direct public-disk launcher uses the same lock and
   retains it for the entire emulator run, preventing a private snapshot from racing
   a direct run against the writable shared base.
3. A new session receives a private copy of the System 303 disk plus private `sys`,
   `usite`, and `chaos` source trees. Copying requests filesystem reflinks when
   available and falls back to ordinary sparse copies. Fresh preparation occurs in a
   temporary directory under the session: the disk copy is checked against the
   public base checksum, source provenance and a runtime marker are written, and only
   then is the completed stage installed by a same-filesystem rename.
4. The writable filesystem mapping and emulated disk point at those session paths.
   The configuration also loads `promh.mcr`, `promh.sym`, and `ucadr.sym` from the
   private `sys/ubin` copy. The `usim` executable remains a shared public-checkout
   input, but its exact contents are hashed at session start. Immediately before
   launch, the supervisor reacquires the shared preparation lock, hashes the
   executable again, compares it with `usim_sha256_at_start`, and calls `Popen` while
   still holding the lock. A mismatch fails the start rather than executing a binary
   different from the one described by preparation provenance.
5. A detached supervisor starts a 1024 by 1100, 24-bit Xvfb server with TCP disabled.
   It creates a fresh MIT-MAGIC-COOKIE Xauthority file with mode `0600` inside the
   private runtime and passes that authority explicitly to the X clients. A second
   repository-global lock serializes display-number allocation across all state
   roots; the harness also checks the X socket and lock before selecting a display.
6. `usim` creates a fixed-size, unscaled 768 by 963 client window. Keyboard and mouse
   actions are sent to that identified window through XTEST after focusing it.
7. The supervisor owns both processes. A normal stop terminates `usim` first, allowing
   its configured state and final framebuffer files to be written, and removes Xvfb
   only afterward. The harness records whether the public base-disk checksum remained
   unchanged. If either process exceeds its shutdown timeout and requires a kill, the
   run is labeled `forced-stopped`, with `forced_stop` and
   `state_may_be_incomplete` true instead of implying a clean saved state.

A plain later `start` cold-boots the session's existing private disk and source
copies. `start --fresh` replaces that private runtime with copies of the current
public base and then cold-boots it. Neither mode writes through the public base disk.
Named sessions allow separate experiments without silently sharing their writable
disk or source state.

The session tree also contains process logs, saved machine state, a native PBM dump,
screenshots, and JSON metadata. It can contain changed Lisp-machine files and must not
be treated as a publishable artifact bundle. All of it remains ignored and untracked.

## Current screenshot provenance

The `screenshot` command captures the exact `usim` client window rather than the
larger Xvfb root screen. For each numbered PNG it writes a JSON sidecar containing:

- local timestamp, session name, and session generation;
- load-band name and the base and private-disk checksums at start;
- `public_source_revisions_at_start`, the then-current Fossil identities of the
  umbrella, System, `usim`, site, and Chaos public checkouts;
- `private_source_snapshot`, which records when the private sources were copied,
  their System, site, and Chaos revisions at copy time, and hashes of the three trees
  at copy time;
- hashes of the private source trees at this start and flags saying whether each tree
  changed since it was copied;
- the `usim` executable hash and individual hashes of the private `promh.mcr`,
  `promh.sym`, and `ucadr.sym` machine artifacts used by the configuration;
- `toolchain_provenance`: Python version and executable, `manifest.scm` hash, Guix
  channel description or collection error, and resolved paths for the X server,
  authentication, input, capture, copy, locking, build, and Guix commands;
- X display, window identifier, title, and observed geometry;
- PNG SHA-256 and a SHA-256 over normalized eight-bit RGB pixels.

The explicit public-at-start and private-at-copy records prevent a later checkout
update from being mistaken for the sources actually copied into a long-lived private
session. The tree and file hashes cover private changes and executable or machine
artifacts that Fossil identities alone cannot identify. The harness tree hash covers
sorted relative names, entry kinds, symlink targets, and regular-file content hashes,
with each component length-prefixed before hashing. The pixel hash distinguishes
displayed pixels from incidental PNG encoding changes.

Raw screenshot files and sidecars remain ignored session payloads. After a separate
redistribution review, a selected public-system capture can be copied into
`docs/assets/mit-cadr-screenshots/`; its catalog and article must retain the session,
action sequence, dimensions, image and pixel hashes, and shutdown result. Four
System 303 Zmacs captures from session `eine-zwei-20260718` have now completed that
review and are tracked in the
[curated screenshot catalog](../assets/mit-cadr-screenshots/). Their inclusion is
an asset- and use-specific fair-use determination for historical analysis, not an
inference that the Fossil tree or load band has one blanket license. The restrictive
LMI notice in the tree is scoped to the separate Tape subsystem and no Tape content
appears in these four frames. Unreviewed pixels stay local.

The execution-time check is recorded separately in session state as
`usim_sha256_at_exec`. Current screenshot sidecars include
`usim_sha256_at_start` but **not** `usim_sha256_at_exec`; an execution-integrity claim
must join the screenshot sidecar with the corresponding `run.json` rather than
inventing a sidecar field.

### Earlier smoke sidecars

The six original `smoke` captures predate the hardened provenance layout. Each old
sidecar has exactly these fields:

```text
format, timestamp, session, generation, display, window_id, window_title,
window_geometry, load_band, base_disk_sha256, session_disk_sha256_at_start,
source_revisions, path, width, height, png_sha256, pixel_sha256
```

In particular, the old `source_revisions` field recorded the public checkout state
seen by that run. It did not distinguish current public revisions from the private
sources' copy-time revisions, and it did not hash the private source trees, the
`usim` executable, or the private microcode and symbol files. The old sidecars still
identify the captured pixels, dimensions, load band, disk start hashes, and observed
window, but they are incomplete by the current provenance standard.

All six legacy sidecars and their ImageMagick geometry checks reported 768 by 963
pixels. Generation 4 then added the public-versus-private source identities and
source, emulator, and machine-artifact hashes used above, but its four sidecars did
not yet contain `toolchain_provenance`. It is therefore an intermediate hardened
layout. Generation 5 supersedes both earlier layouts as the primary evidence for the
four interactions below. The earlier session files remain useful for reconstructing
the smoke sequence and its warm-resume failure, but their sidecars should not be
presented as if they contained the current fields.

## Current-schema cold-boot observations

The following are direct observations of session `smoke`, generation 5, on
2026-07-17. The interactions used only harness keyboard or mouse commands after a
fresh cold boot. Each sidecar contains the current hardened provenance fields
described above.

| Action and observed response | Local evidence |
| --- | --- |
| The cold boot reached `Lisp Listener 1`; the bottom line instructed the user to click right for the System Menu. | `0011-final-cold-boot.png`, PNG SHA-256 `dd4b4dc0f64282f07c1246b56805d2f669f0825d7ba1b9944a7704a63d35005c`, pixel SHA-256 `bd0375cb482a8692283660eb5585ace393985dbcd559532637332e645ef7e153` |
| Sending the harness `help` alias, which maps to host `F5`, displayed top-level instructions for the Listener, the rightmost-button menu, and Control-, Meta-, System-, and Terminal-Help combinations. | `0012-final-help.png`, PNG SHA-256 `2e605ea5ba7c2a9a9d9c02c41175ec70cc5e1c07e9d77d85c6f6d8069a067099`, pixel SHA-256 `6c9c642721a7042ee1a94839b84b6e1acef5e795a80274e8d0529a16e266164d` |
| After completing the initial date-and-time dialogue, typing `(+ 2 3)` with Return at the Listener displayed the result `5`. | `0013-final-lisp-evaluation.png`, PNG SHA-256 `052328fa3cc04258a5ea91b4cdc0bad8f9378810620452a88114001620baf19e`, pixel SHA-256 `2fdf53005cec63239f1626b02f4b977205decb81d70b57ed68631c4e8b9412f6` |
| Clicking host button 3 in the client opened a three-column System Menu headed `Windows`, `This window`, and `Programs`. The menu included window-management actions, current-window actions, and program entries such as Lisp, Edit, Inspect, Trace, Peek, Mail, and Emergency Break. | `0014-final-system-menu.png`, PNG SHA-256 `9c84c403cf618a7f5db9548ee4b710301d5313d40631ac12a36336ae1cb68203`, pixel SHA-256 `36b96255622cb6d09360b75c6942b5b7ed28af7566b0409cd8cb043c0a44f267` |

These observations confirm that the current host `F5` mapping and host button 3 path
reached useful System 303 interactions under the recorded `usim` revision. They do
not by themselves establish the legends or electrical behavior of a historical
keyboard or mouse. Source analysis remains necessary for those historical claims.

### Generation-6 execution-integrity confirmation

Generation 5 remains the primary behavior record because it contains the complete
Help, Listener evaluation, and System Menu interaction sequence. Generation 6 was a
narrow latest-code confirmation of the shared-executable check. It plain-cold-booted
the private runtime copied for generation 5 rather than taking a fresh snapshot.

The generation-6 `run.json` records identical start-time and execution-time hashes:

```text
usim_sha256_at_start = 707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be
usim_sha256_at_exec  = 707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be
```

The 768 by 963 confirmation image is `0015-exec-verified-cold-boot.png`, PNG SHA-256
`15cd727710323ef23618ff52cce9e56a3a3c6c327dce9a8a4580f1793fb5148f`
and pixel SHA-256
`71e39f56cee0c2d8bc78e8d687af0428dd859a40b13cfd42b13fec03992d0ad0`.
Its sidecar contains the start-time hash only; the equal execution-time hash above is
run-state evidence. The session then stopped with both process exit statuses 0,
`forced_stop` and `state_may_be_incomplete` false, the public base checksum
unchanged, and all three recorded process identities gone.

## Current limitations

### Warm resume failed the smoke test

`start --resume` asks `usim` to restore the state file written during a clean stop.
This path is experimental. In smoke generation 2, the emulator accepted the state
filename and created its window, then halted almost immediately with:

```text
usim: illop, asserting halted
PC=00023 (ILLOP)
IR=(POPJ ZERO MF-1)
```

The failed run executed essentially no restored workload before stopping. The cause
has not been established, so this result should not be described as a general defect
in System 303 or `usim`. A generation-3 `--fresh` cold boot succeeded immediately
afterward, and final-schema generation 5 also cold-booted and stopped cleanly. Warm
resume was not retested. Until it is diagnosed and retested, use the private disk for
durable session changes and cold-boot it, and treat saved machine state only as
diagnostic output.

### A visible or stable screen is not semantic readiness

The `start` command establishes that the expected X client is alive, while the
`wait --stable-for` mode establishes only that captured pixels stopped changing for
an interval. Neither condition proves that Lisp initialization has reached a
particular prompt. Automation should take a screenshot and inspect the expected
interaction state before sending context-sensitive input.

### Input is host-mediated

XTEST events exercise `usim`'s configured `cadet` keyboard mapping and SDL/X11 mouse
path. This is valuable evidence about the preserved software stack as operated here,
but it is one layer removed from original CADR hardware. Coordinate actions are also
tied to the fixed 768 by 963 window used in this harness.

## Repeating an observation

For a museum-grade behavioral note:

1. Start a named session with `--fresh` when an unchanged base is important.
2. Record the `status` JSON before interaction.
3. Record every `key`, `type`, and `mouse` action in order.
4. Capture a labeled screenshot after the relevant response.
5. Retain the local JSON sidecar and emulator log until the claim is reviewed.
6. In the tracked article, record the portable artifact name, dimensions, hashes,
   public and private disk checksums, current public and private copy-time revisions,
   private source-tree hashes, `usim` and private machine-artifact hashes, toolchain
   provenance, and whether the statement is a runtime observation or a
   source-supported historical fact.
7. Stop the session and record its exit statuses, `forced_stop`,
   `state_may_be_incomplete`, and base-disk integrity result. Use `--discard` when its
   private payload is no longer needed.

Do not commit the session directory merely to publish a screenshot. A screenshot that
is ever selected for public distribution needs a separate content-rights and
provenance review; the default preservation workflow keeps it local. The four
cataloged Zmacs captures are examples of selected images that passed both reviews,
not permission to publish the rest of either session tree.

## Sources and verification

- LM-3 `sys` Fossil repository, maintained System 303 check-in
  [`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`](https://tumbleweed.nu/r/sys/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91).
- LM-3 `usim` Fossil repository, emulator check-in
  [`330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`](https://tumbleweed.nu/r/usim/info/330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d).
- Local smoke session metadata, screenshot sidecars, and emulator logs under ignored
  `build/cadr-computer-use/smoke/`, inspected 2026-07-17.
- [Curated System 303 Zmacs screenshot catalog](../assets/mit-cadr-screenshots/),
  including its content-specific rights determination and session provenance,
  verified 2026-07-18.

Last verified: 2026-07-18.
