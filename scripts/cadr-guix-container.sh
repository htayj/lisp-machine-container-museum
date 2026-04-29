#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: cadr-guix-container.sh --mode MODE [--verify] [--bootstrap-only] [-- ARGS...]

Examples:
  ./scripts/cadr-guix-container.sh --mode run
  ./scripts/cadr-guix-container.sh --mode run --bootstrap-only
  ./scripts/cadr-guix-container.sh --mode run --prepare-only
  ./scripts/cadr-guix-container.sh --mode run --verify
  ./scripts/cadr-guix-container.sh --mode shell
  ./scripts/cadr-guix-container.sh --mode tool -- pwd
EOF
}

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
CONTAINER_ROOT=/workspace
MANIFEST_FILE="$ROOT_DIR/manifest.scm"
LM_HOME_DIR="$ROOT_DIR/.lm-home"
HOST_INNER_SCRIPT="$ROOT_DIR/scripts/inside-cadr-guix-container.sh"

mode=
extra_args=()

while (($#)); do
  case "$1" in
    --mode)
      mode=${2:?missing mode value}
      extra_args+=("$1" "$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      extra_args+=("$1")
      shift
      ;;
  esac
done

if [[ -z "${mode:-}" ]]; then
  usage >&2
  exit 1
fi

mkdir -p "$LM_HOME_DIR"

have_checkout() {
  [[ -f "$ROOT_DIR/l/.fslckout" || -f "$ROOT_DIR/l/_FOSSIL_" ]]
}

have_repo_files() {
  local repo_name

  for repo_name in l usim chaos sys usite; do
    if [[ ! -f "$ROOT_DIR/$repo_name.fossil" ]]; then
      return 1
    fi
  done

  return 0
}

have_bootstrap_state() {
  have_checkout && have_repo_files
}

has_arg() {
  local needle=$1
  local arg

  for arg in "${extra_args[@]}"; do
    if [[ "$arg" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

bootstrap_on_host() {
  guix shell -m "$MANIFEST_FILE" -- env \
    HOME="$LM_HOME_DIR" \
    TERM="${TERM:-xterm-256color}" \
    bash "$HOST_INNER_SCRIPT" --mode bootstrap
}

update_on_host() {
  guix shell -m "$MANIFEST_FILE" -- env \
    HOME="$LM_HOME_DIR" \
    TERM="${TERM:-xterm-256color}" \
    bash "$HOST_INNER_SCRIPT" --mode update
}

if [[ "$mode" == "bootstrap" ]]; then
  bootstrap_on_host
  exit 0
fi

if [[ "$mode" == "tool" ]]; then
  :
elif [[ "$mode" != "run" ]] || ! has_arg --verify; then
  if ! have_bootstrap_state; then
    bootstrap_on_host
  fi
fi

if [[ "$mode" == "update" ]]; then
  if have_bootstrap_state; then
    update_on_host
  else
    bootstrap_on_host
  fi
  exit 0
fi

if [[ "$mode" == "run" ]] && has_arg --bootstrap-only; then
  exit 0
fi

container_args=(
  shell
  -C
  -m "$MANIFEST_FILE"
  --share="$ROOT_DIR=$CONTAINER_ROOT"
)

if [[ -d /tmp ]]; then
  container_args+=(--share=/tmp=/tmp)
fi

if [[ -d /tmp/.X11-unix ]]; then
  container_args+=(--share=/tmp/.X11-unix=/tmp/.X11-unix)
fi

xauth_path=${XAUTHORITY:-"$HOME/.Xauthority"}
if [[ -f "$xauth_path" ]]; then
  container_args+=(--expose="$xauth_path=$xauth_path")
fi

display_value=${DISPLAY:-}
if [[ "$mode" == "run" ]] && ! has_arg --verify && ! has_arg --bootstrap-only && ! has_arg --prepare-only && [[ -z "$display_value" ]]; then
  printf 'DISPLAY is not set; run mode needs an X11 display.\n' >&2
  exit 1
fi

exec guix "${container_args[@]}" -- env \
  HOME="$CONTAINER_ROOT/.lm-home" \
  TERM="${TERM:-xterm-256color}" \
  CC="${CC:-gcc}" \
  DISPLAY="$display_value" \
  XAUTHORITY="$xauth_path" \
  SDL_AUDIODRIVER="${SDL_AUDIODRIVER:-dummy}" \
  SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-x11}" \
  bash -lc 'cd /workspace && exec bash ./scripts/inside-cadr-guix-container.sh "$@"' bash \
  "${extra_args[@]}"
