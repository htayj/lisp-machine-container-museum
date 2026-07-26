#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
usage:
  curate-runtime-animation.sh frames OUTPUT.gif FRAME.png [...]
  curate-runtime-animation.sh video INPUT.mkv OUTPUT.gif [FPS]

Build a candidate native-pixel animation from one coherent runtime interaction.
The input session and raw video remain under ignored build/ trees; this command
does not perform publication or rights review.
EOF
}

test $# -ge 1 || { usage >&2; exit 2; }
mode=$1
shift

case "$mode" in
  frames)
    test $# -ge 3 || { usage >&2; exit 2; }
    output=$1
    shift
    first_geometry=$(identify -format '%wx%h' "$1")
    for frame in "$@"; do
      test "$(identify -format '%wx%h' "$frame")" = "$first_geometry" || {
        printf 'frame geometry mismatch: %s\n' "$frame" >&2
        exit 1
      }
    done
    args=()
    for frame in "$@"; do
      args+=(-delay 140 "$frame")
    done
    magick "${args[@]}" -loop 0 -layers Optimize "$output"
    ;;
  video)
    test $# -ge 2 || { usage >&2; exit 2; }
    input=$1
    output=$2
    fps=${3:-10}
    ffmpeg -hide_banner -loglevel error -i "$input" \
      -vf "fps=${fps},split[s0][s1];[s0]palettegen=max_colors=16:stats_mode=diff[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle" \
      -loop 0 -y "$output"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

identify "$output" | tail -1
sha256sum "$output"
