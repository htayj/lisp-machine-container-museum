# lisp-machine-container-museum

This repo launches two Lisp Machine environments in Guix containers:

- `CADR / LM-3`: fully public, based on the LM-3 upstream Fossil repos
- `Open Genera`: requires your own purchased `opengenera2.tar.bz2`

If you only want one system to start exploring, use the CADR path first.

Historical, architectural, and artifact research lives in the
[museum knowledge base](docs/index.md). It includes the current analysis of
[Open Genera VLOD world files](docs/genera/world-loads-and-vlod.md).

## What you need

- Guix installed and working on the host
- X11 available on the host
- for Open Genera only: a local `opengenera2.tar.bz2`

If X11 authentication fails, allow your user explicitly:

```bash
xhost +SI:localuser:$USER
```

## Which emulator to use

Use `CADR / LM-3` if you want:

- a fully public system
- the simplest first boot
- the MIT LM-3 environment from `tumbleweed.nu`

Use `Open Genera` if you want:

- Symbolics Genera
- your own commercial Open Genera world
- a closer approximation of a later Symbolics workstation environment

## CADR / LM-3

### Launch

```bash
./scripts/cadr-guix-container.sh --mode run
```

The first run will:

1. start a Guix container with the build/runtime dependencies for `usim`
2. create a local Fossil checkout in `./l`
3. cache the supporting upstream Fossil repositories in the repo root
4. build and launch the emulator

### What a successful boot looks like

A successful cold boot normally lands in a Lisp Listener. That is not a blank
system; it is the expected usable prompt.

On the first run, the bootstrap and build can take a while. Later runs should
be much faster.

### Keyboard notes

The default CADR key mapping in `usim` includes:

- `F1` = System
- `F2` = Network
- `F3` = Status
- `F4` = Terminal
- `F5` = Help
- `F6` = Clear Input

If you are unsure what to do next after boot, `F5` is the first key to try.

### Headless computer-use harness

The computer-use harness runs `usim` on a private, authenticated Xvfb display and
drives its real X11 window through keyboard and mouse events. It is intended for
repeatable behavioral checks and evidence screenshots without taking over the host
desktop.

Check the harness dependencies and prepared CADR artifacts:

```bash
./scripts/cadr-computer-use.sh doctor
```

Start a named session and inspect its status:

```bash
./scripts/cadr-computer-use.sh start --session research
./scripts/cadr-computer-use.sh status --session research
```

The first start creates private copies of the System 303 disk and source trees. A
later plain `start` cold-boots that existing private runtime. Use `--fresh` to discard
and recreate the private runtime from the current public base before cold booting a
stopped session:

```bash
./scripts/cadr-computer-use.sh stop --session research
./scripts/cadr-computer-use.sh start --session research --fresh
```

Fresh preparation builds and validates a staged runtime before installing it. The
state root, each session, and each completed private runtime carry harness ownership
markers; the tool refuses to adopt similarly named existing directories without
them. A pre-hardening session directory therefore cannot be reused automatically:
preserve it as evidence or remove it manually after review, then choose a new session
name.

Wait for an elapsed interval or a stable screen, then send keyboard input:

```bash
./scripts/cadr-computer-use.sh wait --session research --seconds 10
./scripts/cadr-computer-use.sh wait --session research --stable-for 3 --timeout 180
./scripts/cadr-computer-use.sh key --session research help
./scripts/cadr-computer-use.sh type --session research --enter '(+ 2 3)'
```

`help` is the portable key alias for `F5`; the other aliases are listed by the
script's `key --help` output. Mouse coordinates address the 768 by 963 CADR client
window. Host button 3 is the CADR head/rightmost button:

```bash
./scripts/cadr-computer-use.sh mouse --session research move 400 500
./scripts/cadr-computer-use.sh mouse --session research click 400 500 --button 3
```

Capture the exact client window and stop the session cleanly:

```bash
./scripts/cadr-computer-use.sh screenshot --session research --label listener
./scripts/cadr-computer-use.sh stop --session research
```

Screenshots, JSON provenance sidecars, private disks and source trees, saved emulator
state, credentials, and logs stay in the ignored
`build/cadr-computer-use/<session>/` directory. `stop --discard` deletes that named
session instead of retaining it. Current sidecars distinguish revisions in the
public checkouts at start from the private sources' copy-time revisions; they also
hash the private source trees, `usim` executable, and private microcode and symbol
files used by the run. Toolchain provenance records the Guix channel, manifest hash,
Python version, and resolved commands as well. Immediately before launching the
shared `usim` executable, the supervisor reacquires the preparation lock, hashes it
again, compares that value with `usim_sha256_at_start`, and performs the launch while
still holding the lock. A mismatch fails the start. The execution-time hash is kept
in session state; screenshot sidecars retain only the start-time hash.

A normal stop reports `forced_stop: false` and `state_may_be_incomplete: false`. If a
process exceeds its shutdown timeout and must be killed, the session is labeled
`forced-stopped` with both flags true; do not treat that saved emulator state as a
known-complete warm-resume artifact.

Warm `start --resume` is experimental. In the 2026-07-17 smoke run, restoring the
state written by a clean stop halted immediately at microcode `ILLOP`; a subsequent
`--fresh` cold boot worked. Do not currently rely on `--resume` for session
persistence. See the
[harness architecture and observation record](docs/mit-cadr/cadr-computer-use-harness.md)
for provenance and the exact evidence boundary.

Raw screenshots remain in the ignored session tree. A small number may be copied
into the museum only after an image- and use-specific copyright review under the
[runtime screenshot publication policy](docs/screenshot-publication-rights-review.md).
Curated screenshot files are outside any blanket project license.

### Useful CADR commands

Validate the container toolchain without starting the GUI:

```bash
./scripts/cadr-guix-container.sh --mode run --verify
```

Only create the upstream checkout:

```bash
./scripts/cadr-guix-container.sh --mode run --bootstrap-only
```

Prepare the repositories and build `usim` without launching the GUI:

```bash
./scripts/cadr-guix-container.sh --mode run --prepare-only
```

Open a shell inside the prepared environment:

```bash
./scripts/cadr-guix-container.sh --mode shell
```

Update the upstream LM-3 checkout:

```bash
./scripts/cadr-guix-container.sh --mode update
```

### LOD helpers

The repo also includes a helper around the upstream `lod` and `diskmaker`
tools for inspecting world-load bands and swapping them into the disk image.

List built-in aliases:

```bash
./scripts/lod-helper.sh list-releases
```

Inspect the default public System 303 load band:

```bash
./scripts/lod-helper.sh inspect 303-dist
```

Install a different public load band into the disk image:

```bash
./scripts/lod-helper.sh install 303-dist
```

Built-in aliases currently include:

- `303-dist`
- `303-cold`
- `100-dist`
- `100-cold`

## Open Genera

Open Genera is not included in this repo. You must supply your own purchased
archive, for example:

```bash
~/opengenera2.tar.bz2
```

Do not use the Open Genera archive that is commonly available on well known
public piracy websites. Using infringing copies is illegal. Obtain Open Genera
legitimately instead, for example by purchasing it from Symbolics:
http://www.symbolics-dks.com/

Nothing extracted from that archive is checked into git. Runtime files are
staged under `./.lm-home/opengenera/`.

### One-time host network setup

Open Genera expects a host TAP device named `tun0`.

Create or repair it with:

```bash
sudo ./scripts/opengenera-host-net.sh up --user "$USER"
```

Check its current state with:

```bash
./scripts/opengenera-host-net.sh status
```

Despite the name, `tun0` must be a TAP device, not a TUN device. The helper
script handles that for you.

### Writable site storage on the host

To create a local site and save a reusable world, Genera needs a writable host
file service. In this repo that is expected to be an NFS export visible to the
VLM at the default Open Genera host paths:
`HOST:/var/lib/symbolics/sys.sct/site/` and
`HOST:/usr/opt/VLM200/lib/symbolics/`.

Prepare it with:

```bash
sudo ./scripts/opengenera-host-nfs.sh up
```

Check the export and the Genera-facing paths with:

```bash
./scripts/opengenera-host-nfs.sh status
```

This helper exports writable directories for:
- site files under `/var/lib/symbolics/sys.sct/site/`
- saved `.vlod` worlds under `/usr/opt/VLM200/lib/symbolics/`

That means the standard Genera defaults from the installation guide can be used
without editing them to repo-specific paths.

If you want to remove just these dedicated exports later:

```bash
sudo ./scripts/opengenera-host-nfs.sh down
```

### NFSv2 fallback when the host kernel only offers NFSv3/v4

Some modern host kernels expose only NFSv3/v4, but Open Genera's built-in NFS
client expects NFSv2. When `rpcinfo -p 127.0.0.1` does not show program
`100003` version `2`, use the bundled Nimble userspace NFSv2 server instead.

Start it with:

```bash
sudo ./scripts/opengenera-host-nimble.sh up
```

Check it with:

```bash
./scripts/opengenera-host-nimble.sh status
```

This helper stops conflicting kernel RPC/NFS services if needed, starts Nimble,
and exports the standard Open Genera paths directly, so inside Genera use:
- `DIS-EMB-HOST:/var/lib/symbolics/sys.sct/site/` for site files
- `DIS-EMB-HOST:/usr/opt/VLM200/lib/symbolics/` for saved worlds

### Launch

```bash
./scripts/opengenera-guix-container.sh --mode run --archive ~/opengenera2.tar.bz2
```

The first run will:

1. start a Guix container with the required runtime tools
2. download the public `snap4.tar.gz` Linux VLM runtime into
   `./.lm-home/opengenera/downloads/`
3. extract the official `Genera-8-5.vlod`, `VLM_debugger`, and `sys.sct` tree
   from your archive
4. build a small local compatibility shim for modern Linux
5. start the VLM

### What a successful boot looks like

You should see the VLM POST complete and a Cold Load stream appear. The usual
non-fatal early warning is:

```text
genera (Cold Load): Unable to allocate a modifier for the Hyper key.
```

That warning by itself is not a failed boot.

### Genera headless computer-use harness

The Genera computer-use harness runs the real VLM client on an authenticated private
Xvfb display and sends keyboard and mouse events through XTEST. Unlike the ordinary
launcher above, it runs the native VLM in a Bubblewrap sandbox with separate user,
network, PID, IPC, mount, and hostname namespaces. The sandbox sees a read-only Guix
store, the exact private X socket and two read-only launch helpers, and its writable
session runtime; it does not see the host home, repository, ordinary runtime sockets,
or a default network route. Its private `tun0` exposes no NFS, Nimble, FTP, or other
guest file service. The private Xvfb disables MIT-SHM and verifies its absence before
launch, preventing the out-of-namespace X server from attaching host shared-memory
segments for the VLM.

Two tracked compatibility modules remain deliberately narrow. One suppresses only
the redundant legacy
`/sbin/ifconfig tun0 10.0.0.1 dstaddr 10.0.0.2 netmask 255.255.255.0` request after
the private interface is configured; every other `system(3)` command retains normal
libc behavior. The X module installs typed event converters only on displays
returned by `XOpenDisplay`, replaces only zero timestamps on seven core input event
types, locally handles the byte-exact typed modifier request, and pairs its typed
grab suppression with the matching ungrab. Direct tracing also established that the
main Genera display relays a guest X11 byte stream through `write(2)`. Only on
descriptors belonging to those wrapped Displays, the module replaces the exact
observed eight-byte
`GrabServer`-plus-`GetModifierMapping` request and exact 148-byte
`SetModifierMapping` request with sequence- and reply-compatible requests accepted
by the private Xvfb. The replacement extension name must first be live-verified
absent. No read-family API is interposed. The globally wrapped `write(2)` delegates
every untracked or nonmatching write byte-for-byte, including TAP, world-image,
ordinary-file, and unrelated-socket writes. A separate supervised process answers
one observed RFC 868 request with one raw Ethernet reply entirely inside the
throwaway network namespace. The harness reports `running` only after it has observed
both exact X substitutions, validated packet evidence, and a successful responder
exit.

Check the harness tools and currently staged Open Genera inputs:

```bash
./scripts/genera-computer-use.sh doctor
```

Start a named session from your purchased archive and inspect its status:

```bash
./scripts/genera-computer-use.sh start \
  --archive ~/opengenera2.tar.bz2 \
  --session research \
  --fresh
./scripts/genera-computer-use.sh status --session research
```

The first start verifies the purchased archive and exact known Genera 8.5 world,
debugger, and public `snap4` VLM identities. It then places private copies of those
inputs, both compatibility modules, the RFC 868 responder, generated host files, and
configuration under the ignored session tree. Immediately before execution the
supervisor rehashes every private artifact and tracked launch source. The ordinary
launcher stages inputs but is not retained as another runtime layer. A later `start`
with the same required `--archive` but without `--fresh` reuses the private inputs;
`--fresh` replaces them from the verified base. Every start creates a new VLM
process; the harness has no host-process snapshot or resume mechanism. A reused
private world could contain an explicitly saved in-guest state, which requires
separate verification.

Wait for the main client, capture it, and send input only after verifying the current
screen:

```bash
./scripts/genera-computer-use.sh wait --session research
./scripts/genera-computer-use.sh screenshot \
  --session research --label initial-display
./scripts/genera-computer-use.sh key --session research Return
./scripts/genera-computer-use.sh type --session research 'text to type'
```

Open Genera changes X clients while moving from Cold Load to its main display. The
harness rediscovers the current client rather than retaining the first window ID.
Mouse coordinates therefore refer to the geometry reported for the currently
selected window, not the fixed CADR dimensions:

```bash
./scripts/genera-computer-use.sh mouse --session research move 600 450
./scripts/genera-computer-use.sh mouse \
  --session research click 600 450 --button 1
```

Capture the resulting exact client window and stop the VLM:

```bash
./scripts/genera-computer-use.sh screenshot \
  --session research --label after-input
./scripts/genera-computer-use.sh stop --session research
```

On stop, the supervisor sends `SIGTERM` to the actual VLM process, waits for its
prompt, and answers `yes`. A pipe trace proved that the current public VLM reads the
answer and begins cleanup, including breaking its X connection. This VLM artifact
then stalls while terminating its Cold Load channel, so the bounded stop finishes
with `SIGKILL`. `stop` consequently returns status 2 and records
`forced_after_confirmed_shutdown_stall: true`, `forced_stop: true`, and
`state_may_be_incomplete: true`; it must not be described as orderly host shutdown.

Neither the accepted confirmation nor forced cleanup invokes Genera's in-guest Save
World operation. The harness does not create a process checkpoint or expose an NFS,
Nimble, or FTP service. Absent a separately verified in-guest Save World action,
unsaved Lisp memory, editor buffers, definitions, and processes are discarded with
the VLM process. See the linked evidence guide for the mutex-level shutdown finding
and the exact scope of that observation.

Each generation has a generation-scoped run record, updated atomically while active
and preserved before the next generation, plus an ordered action log. Input
operations record intent before XTEST dispatch and a linked `succeeded` or
`failed-or-partial` outcome afterward. Screenshots,
sidecars, logs, Xauthority, configuration, and all licensed or runtime copies stay
under ignored `build/genera-computer-use/<session>/`. Use
`stop --discard` to delete a stopped named session. Selected runtime screenshots may
be copied into the museum only after an image- and use-specific copyright review;
permission or a documented U.S. fair-use basis can support publication. The raw
session remains ignored, and curated screenshot files remain outside any blanket
project license. See the
[runtime screenshot publication policy](docs/screenshot-publication-rights-review.md)
and the
[Genera harness architecture and evidence guide](docs/genera/genera-computer-use-harness.md).

### Useful Open Genera commands

Validate the container setup without launching the GUI:

```bash
./scripts/opengenera-guix-container.sh --mode run --verify --archive ~/opengenera2.tar.bz2
```

Stage the runtime without starting it:

```bash
./scripts/opengenera-guix-container.sh --mode run --prepare-only --archive ~/opengenera2.tar.bz2
```

Open a shell in the prepared runtime:

```bash
./scripts/opengenera-guix-container.sh --mode shell --archive ~/opengenera2.tar.bz2
```

Extra arguments after `--` are passed through to `genera` itself. That lets
you override the default `.VLM` configuration if needed.

### Open Genera notes

- Only run one Open Genera instance at a time against `tun0`.
- If you launch a second instance while one is already running, you can see
  `Device or resource busy`.
- The launcher uses your purchased world/debugger, but the Linux-hosted VLM
  runtime comes from the historical public `snap4` package.
- The launcher includes a small compatibility preload because the historical
  runtime still tries to use legacy Linux networking behavior and X11 keyboard
  modifier remapping that modern unprivileged/Xwayland setups reject. The same
  preload also answers the VLM's early RFC 868 time request locally, so no host
  `time` daemon or privileged UDP/37 listener is required.

## Font recovery

Recover the public CADR font sources from a checkout of
`mietek/mit-cadr-system-software`:

```bash
python3 scripts/extract-cadr-fonts.py \
  /path/to/mit-cadr-system-software/src/lmfont \
  --output build/fonts/cadr \
  --clean \
  --strict
```

This reads the historical source representations under `src/lmfont`; it does not
inspect a CADR load band or heap. The curated public outputs and full format notes are
in [the CADR font recovery article](docs/mit-cadr/font-sources-and-recovery.md).

Recover the fonts resident in your own licensed Genera world:

```bash
python3 scripts/extract-genera-fonts.py \
  .lm-home/opengenera/runtime/Genera-8-5.vlod \
  --output build/fonts/genera \
  --clean
```

That command writes BDF files, normalized JSON, and PNG font sheets. All Genera
outputs are derived from licensed media and remain in the ignored local build tree;
do not commit or redistribute them. See the
[Genera extraction procedure](docs/genera/extracting-resident-fonts.md) and
[evidence-graded font catalog](docs/genera/font-catalog.md).

## On-line help recovery

Recover the source-integrated help from the pinned public MIT CADR System 46 tree:

```bash
python3 scripts/extract-cadr-help.py \
  --source /path/to/mit-cadr-system-software/src \
  --output docs/assets/mit-cadr-online-help \
  --clean
```

The checked-in result contains exact public source contexts, four standalone ZWEI
artifacts, catalogs, and the source license. See the
[CADR help recovery article](docs/mit-cadr/online-help-and-documentation-recovery.md)
for the inclusion rule and optional metadata-only LM-3 cross-check.

Recover the installed documentation from your own licensed Genera `sys.sct` tree:

```bash
python3 scripts/extract-genera-help.py \
  --sys-sct .lm-home/opengenera/runtime/sys.sct \
  --output build/help/genera \
  --clean
```

This decodes the Document Examiner's Sage Binary databases, copies three reviewed
standalone help files, and inventories source-level help declarations without
executing Genera code. Every output derived from Genera remains under the ignored
`build/help/genera/` tree and must not be committed or redistributed. See the
[Genera help recovery article](docs/genera/online-help-and-documentation-recovery.md).

## Day-to-day use

Once either machine finishes booting, the normal place to work is a Lisp
Listener.

Practical first steps:

1. Click into the Lisp Machine window.
2. Try the help key for the emulator you launched.
3. Treat the Listener as your REPL and command entry point.

If you stop the emulator process abruptly, unsaved in-memory state is lost.

## Files and caches

The repo creates a few local working directories:

- `./l/` for the LM-3 upstream working checkout
- `./.lm-home/` for container home directories and runtime caches
- `./*.fossil` for cached Fossil repositories

These are intentionally ignored by git.
