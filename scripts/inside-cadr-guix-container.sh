#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: inside-cadr-guix-container.sh --mode MODE [--verify] [--bootstrap-only] [-- ARGS...]

Modes:
  run        Bootstrap the upstream LM working directory and start ./m -s
  bootstrap  Only create/open the upstream working directory checkout
  shell      Open an interactive shell in the upstream working directory
  tool       Run an arbitrary command in the shared workspace
  update     Pull and update the upstream checkout

Flags:
  --verify          Print a few tool versions and exit
  --bootstrap-only  With --mode run, stop after the checkout exists
  --prepare-only    With --mode run, execute ./m without starting usim
EOF
}

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
LM_URL=${LM_URL:-https://tumbleweed.nu/r/l}
LM_CHECKOUT_DIR=${LM_CHECKOUT_DIR:-"$ROOT_DIR/l"}
LM_REPO_PATH=${LM_REPO_PATH:-"$ROOT_DIR/l.fossil"}
LM_REPOS=${LM_REPOS:-"usim chaos sys usite"}
LM_VERSION=${LM_VERSION:-303-0}

mode=run
verify=0
bootstrap_only=0
prepare_only=0
pass_args=()

while (($#)); do
  case "$1" in
    --mode)
      mode=${2:?missing mode value}
      shift 2
      ;;
    --verify)
      verify=1
      shift
      ;;
    --bootstrap-only)
      bootstrap_only=1
      shift
      ;;
    --prepare-only)
      prepare_only=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      pass_args+=("$@")
      break
      ;;
    *)
      pass_args+=("$1")
      shift
      ;;
  esac
done

have_checkout() {
  [[ -f "$LM_CHECKOUT_DIR/.fslckout" || -f "$LM_CHECKOUT_DIR/_FOSSIL_" ]]
}

clone_repo_file() {
  local repo_name=$1
  local repo_path="$ROOT_DIR/$repo_name.fossil"

  if [[ ! -f "$repo_path" ]]; then
    fossil clone "https://tumbleweed.nu/r/$repo_name" "$repo_path"
  fi

  fossil set autosync 0 -R "$repo_path" >/dev/null

  if [[ "$repo_name" == "sys" ]]; then
    fossil sync -u -R "$repo_path" >/dev/null
  fi
}

prefetch_repo_files() {
  local repo_name

  clone_repo_file "l"
  for repo_name in $LM_REPOS; do
    clone_repo_file "$repo_name"
  done
}

quarantine_partial_nested_dirs() {
  local repo_name
  local repo_dir
  local backup_dir

  for repo_name in $LM_REPOS; do
    repo_dir="$LM_CHECKOUT_DIR/$repo_name"
    if [[ -d "$repo_dir" && ! -f "$repo_dir/.fslckout" && ! -f "$repo_dir/_FOSSIL_" ]]; then
      backup_dir="${repo_dir}.partial.$(date +%s)"
      mv "$repo_dir" "$backup_dir"
      printf 'Moved partial checkout aside: %s -> %s\n' "$repo_dir" "$backup_dir" >&2
    fi
  done
}

trim_value() {
  local value=$1

  value=${value#"${value%%[![:space:]]*}"}
  value=${value%"${value##*[![:space:]]}"}
  printf '%s\n' "$value"
}

normalize_disk_config_file() {
  local config_file=$1
  local tmp_file

  [[ -f "$config_file" ]] || return 0

  tmp_file=$(mktemp)
  awk '
    /^\[kbd\.modifiers\][[:space:]]*$/ { skip_kbd_modifiers = 1; next }
    /^\[/ {
      skip_kbd_modifiers = 0
      in_disk = ($0 ~ /^\[disk\][[:space:]]*$/)
      print
      next
    }
    skip_kbd_modifiers { next }
    {
      if (in_disk && match($0, /^[[:space:]]*disk([0-7])_filename[[:space:]]*=[[:space:]]*(.*)$/, parts)) {
        value = parts[2]
        sub(/^[[:space:]]+/, "", value)
        sub(/[[:space:]]+$/, "", value)
        printf "disk%s = T-300,%s\n", parts[1], value
        next
      }
      if ($0 ~ /^[[:space:]]*F7[[:space:]]*=[[:space:]]*integral[[:space:]]*$/) {
        next
      }
      print
    }
  ' "$config_file" >"$tmp_file"
  mv "$tmp_file" "$config_file"
}

ensure_usim_override_config() {
  local usim_dir="$LM_CHECKOUT_DIR/usim"
  local override_file="$usim_dir/usim.ini"
  local exported_file="$usim_dir/usim-$LM_VERSION.ini"

  if [[ ! -f "$override_file" && -f "$exported_file" ]]; then
    cp "$exported_file" "$override_file"
  fi

  if [[ -f "$override_file" ]]; then
    normalize_disk_config_file "$override_file"
  fi
}

runtime_artifacts_ready() {
  [[ -f "$LM_CHECKOUT_DIR/usim/.fslckout" ]] &&
    [[ -f "$LM_CHECKOUT_DIR/chaos/.fslckout" ]] &&
    [[ -f "$LM_CHECKOUT_DIR/sys/.fslckout" ]] &&
    [[ -f "$LM_CHECKOUT_DIR/usite/.fslckout" ]] &&
    [[ -x "$LM_CHECKOUT_DIR/usim/usim" ]] &&
    [[ -f "$LM_CHECKOUT_DIR/usim/disk-sys-$LM_VERSION.img" ]] &&
    ([[ -f "$LM_CHECKOUT_DIR/usim/usim.ini" ]] || [[ -f "$LM_CHECKOUT_DIR/usim/usim-$LM_VERSION.ini" ]])
}

prepare_runtime() {
  cd "$LM_CHECKOUT_DIR"
  ./m -M "$ROOT_DIR" "${pass_args[@]}"
  ensure_usim_override_config
}

bootstrap_checkout() {
  prefetch_repo_files

  if have_checkout; then
    return 0
  fi

  if [[ -d "$LM_CHECKOUT_DIR" ]]; then
    if find "$LM_CHECKOUT_DIR" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
      printf 'Refusing to open Fossil checkout into non-empty directory: %s\n' "$LM_CHECKOUT_DIR" >&2
      exit 1
    fi
  fi

  fossil open "$LM_REPO_PATH" --workdir "$LM_CHECKOUT_DIR"
}

if ((verify)); then
  fossil version
  make --version | sed -n '1p'
  pkg-config --modversion sdl3
  exit 0
fi

case "$mode" in
  run)
    bootstrap_checkout
    if ((bootstrap_only)); then
      exit 0
    fi
    quarantine_partial_nested_dirs
    if ((prepare_only)); then
      prepare_runtime
      exit 0
    fi
    if ! runtime_artifacts_ready; then
      prepare_runtime
    else
      ensure_usim_override_config
    fi
    cd "$LM_CHECKOUT_DIR"
    exec ./m -M "$ROOT_DIR" -s "${pass_args[@]}"
    ;;
  bootstrap)
    bootstrap_checkout
    ;;
  shell)
    bootstrap_checkout
    cd "$LM_CHECKOUT_DIR"
    exec bash -i
    ;;
  tool)
    cd "$ROOT_DIR"
    if ((${#pass_args[@]} == 0)); then
      printf 'tool mode needs a command after --\n' >&2
      exit 1
    fi
    exec "${pass_args[@]}"
    ;;
  update)
    bootstrap_checkout
    cd "$LM_CHECKOUT_DIR"
    fossil pull
    fossil update trunk
    ;;
  *)
    printf 'Unknown mode: %s\n' "$mode" >&2
    usage >&2
    exit 1
    ;;
esac
