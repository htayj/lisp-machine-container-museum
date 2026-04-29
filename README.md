# genera-emu

This repo now bootstraps the LM-3 Lisp Machine working directory inside a Guix
container and starts it the way upstream documents it: `fossil open
https://tumbleweed.nu/r/l`, then `./m -s`.

## Quick start

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

## Other commands

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
