# genera-emu

This repo provides two Guix-based launchers:

- `scripts/cadr-guix-container.sh` for the public LM-3 CADR emulator stack
- `scripts/opengenera-guix-container.sh` for Open Genera, using a
  user-supplied `opengenera2.tar.bz2`

The CADR path bootstraps the LM-3 Lisp Machine working directory the way
upstream documents it: `fossil open https://tumbleweed.nu/r/l`, then `./m -s`.

## CADR quick start

Run:

```bash
./scripts/cadr-guix-container.sh --mode run
```

On the first run this will:

1. start a Guix container with the build/runtime dependencies for `usim`
2. create a local Fossil checkout in `./l` with its repository stored as
   `./l.fossil`
3. cache the supporting upstream Fossil repositories in the repo root
   (`usim.fossil`, `chaos.fossil`, `sys.fossil`, `usite.fossil`) so later
   container starts do not need network access for nested checkouts
4. launch the upstream Lisp Machine bootstrap command from that checkout

## CADR other commands

Validate the container toolchain without starting the emulator:

```bash
./scripts/cadr-guix-container.sh --mode run --verify
```

Only create the upstream checkout:

```bash
./scripts/cadr-guix-container.sh --mode run --bootstrap-only
```

Prepare the nested repositories and build `usim` inside the container without
launching the GUI:

```bash
./scripts/cadr-guix-container.sh --mode run --prepare-only
```

Open a shell in the upstream checkout inside the same container:

```bash
./scripts/cadr-guix-container.sh --mode shell
```

Update the Fossil checkout later:

```bash
./scripts/cadr-guix-container.sh --mode update
```

## LOD helpers

The repo also includes a helper around the upstream `lod` and `diskmaker`
tools for inspecting world-load bands and swapping them into the disk image:

```bash
./scripts/lod-helper.sh list-releases
./scripts/lod-helper.sh inspect 303-dist
./scripts/lod-helper.sh install 303-dist
```

Built-in aliases currently point at the public release files:

- `303-dist` -> `LOD6-Exp-303-0-Dist.gz`
- `303-cold` -> `LOD5-cold-6-Jan-25.gz`
- `100-dist` -> `LOD2-Exp-100-0.gz`
- `100-cold` -> `LOD1-cold-3-23-23.gz`

`install` restores the chosen band into the disk image, backs up the previous
contents of that `LODn` partition under `.lm-home/lod-helper/backups/`, and
sets the disk's current band to the restored partition by default.

By default `inspect` runs `lod -m 0400`, which gives a stable memory-oriented
summary of the load band. To use a different `lod` mode, pass raw arguments
after `--`, for example:

```bash
./scripts/lod-helper.sh inspect 303-dist -- -p 377777
```

## Notes

- `usim` is launched with `SDL_VIDEODRIVER=x11` so the container only needs the
  host X11 socket and your Xauthority cookie.
- Audio is disabled with `SDL_AUDIODRIVER=dummy` to avoid container audio setup
  getting in the way of the first boot.
- If X11 authentication fails, allow your user explicitly on the host with:

```bash
xhost +SI:localuser:$USER
```

## Open Genera

The Open Genera launcher does not include or redistribute Symbolics software.
You must provide your own purchased archive, for example:

```bash
~/opengenera2.tar.bz2
```

The first run stages the proprietary files under `./.lm-home/opengenera/`,
which is already gitignored. Nothing extracted from that archive is checked in.

### Open Genera quick start

Create the host-side `tun0` device once:

```bash
sudo ./scripts/opengenera-host-net.sh up --user "$USER"
```

Then launch Open Genera:

```bash
./scripts/opengenera-guix-container.sh --mode run --archive ~/opengenera2.tar.bz2
```

On the first run this will:

1. start a Guix container with the legacy runtime dependencies Open Genera
   expects
2. download the public `snap4.tar.gz` Linux VLM runtime into
   `./.lm-home/opengenera/downloads/`
3. extract the official `Genera-8-5.vlod`, `VLM_debugger`, and `sys.sct` tree
   from your `opengenera2.tar.bz2` into `./.lm-home/opengenera/`
4. write a local `.VLM` file and launch the Linux VLM

### Open Genera commands

Validate the Open Genera container without launching the GUI:

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

Extra arguments after `--` are passed through to `genera`. The public Open
Genera User's Guide documents options such as `-world`, `-debugger`,
`-network`, and `-vm`; the launcher's `.VLM` file is the default, and command
line options still override it.

### Open Genera notes

- The default VLM network is `10.0.0.2` with a host interface named `tun0`.
- Despite the name, the Linux VLM wants `tun0` to be a TAP device
  (`IFF_TAP | IFF_NO_PI`), not a TUN device. The helper script now creates it
  that way and assigns `10.0.0.1/24`.
- If launch stops with `Can't TUNSETIFF for VLM network interface #0` and
  `Operation not permitted`, create `tun0` first with
  `sudo ./scripts/opengenera-host-net.sh up --user "$USER"`.
- The launcher stages the purchased world and debugger from your archive, but
  uses the public historical Linux VLM runtime from `snap4.tar.gz` because the
  purchased archive only includes the original Alpha/Digital Unix executable.
- The launcher also builds a tiny local preload shim to ignore the historical
  `SIOCSARP` ioctl that `snap4` still tries to issue on startup; on modern
  unprivileged Linux this call fails even when the TAP device itself is
  prepared correctly.
- This setup does not currently provision NFS exports, `inetd` time/daytime, or
  `/etc/hosts` entries for you. It focuses on launching the VLM cleanly inside
  Guix without checking any proprietary payload into git.
