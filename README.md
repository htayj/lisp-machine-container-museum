# lisp-machine-container-museum

This repo launches two Lisp Machine environments in Guix containers:

- `CADR / LM-3`: fully public, based on the LM-3 upstream Fossil repos
- `Open Genera`: requires your own purchased `opengenera2.tar.bz2`

If you only want one system to start exploring, use the CADR path first.

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
  runtime still tries to use legacy Linux networking behavior that modern
  unprivileged setups reject.

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
