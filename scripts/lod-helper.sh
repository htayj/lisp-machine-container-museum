#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: lod-helper.sh COMMAND [ARGS...]

Commands:
  list-releases
      Show built-in release aliases.

  inspect [SOURCE] [-- LOD_ARGS...]
      Inspect a load band with the local lod tool.
      SOURCE can be a local file, URL, or release alias.
      Default SOURCE is 303-dist.

  install [SOURCE] [TARGET_BAND] [--disk DISK_IMAGE] [--no-backup] [--no-set-current]
      Restore a load band into a CADR disk image using diskmaker.
      SOURCE can be a local file, URL, or release alias.
      Default SOURCE is 303-dist.  Default TARGET_BAND comes from the alias,
      otherwise LOD6 is used.

Examples:
  ./scripts/lod-helper.sh list-releases
  ./scripts/lod-helper.sh inspect 303-dist
  ./scripts/lod-helper.sh inspect https://tumbleweed.nu/system-303-0-release/LOD6-Exp-303-0-Dist.gz -- -p 377777
  ./scripts/lod-helper.sh install 303-dist
  ./scripts/lod-helper.sh install /tmp/LOD6-Exp-303-0-Dist LOD6 --disk ./l/usim/disk-sys-303-0.img
EOF
}

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
MANIFEST_FILE="$ROOT_DIR/manifest.scm"
LM_HOME_DIR="$ROOT_DIR/.lm-home"
USIM_DIR="$ROOT_DIR/l/usim"
CONTAINER_ROOT=/workspace
CONTAINER_USIM_DIR="$CONTAINER_ROOT/l/usim"
CONTAINER_SCRIPT="$ROOT_DIR/scripts/cadr-guix-container.sh"
DEFAULT_DISK_IMAGE="$USIM_DIR/disk-sys-303-0.img"
WORK_DIR="$LM_HOME_DIR/lod-helper"
DOWNLOAD_DIR="$WORK_DIR/downloads"
EXTRACT_DIR="$WORK_DIR/extracted"
BACKUP_DIR="$WORK_DIR/backups"
STAGED_DIR="$WORK_DIR/staged"

mkdir -p "$LM_HOME_DIR"
mkdir -p "$DOWNLOAD_DIR" "$EXTRACT_DIR" "$BACKUP_DIR" "$STAGED_DIR"

tmpdir=$(mktemp -d)
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

list_releases() {
  cat <<'EOF'
303-dist  https://tumbleweed.nu/system-303-0-release/LOD6-Exp-303-0-Dist.gz  -> default target LOD6
303-cold  https://tumbleweed.nu/system-303-0-release/LOD5-cold-6-Jan-25.gz   -> default target LOD5
100-dist  https://tumbleweed.nu/system-100-0-release/LOD2-Exp-100-0.gz        -> default target LOD2
100-cold  https://tumbleweed.nu/system-100-0-release/LOD1-cold-3-23-23.gz     -> default target LOD1
EOF
}

resolve_release() {
  local source=$1

  case "$source" in
    303-dist)
      printf '%s\n%s\n' "https://tumbleweed.nu/system-303-0-release/LOD6-Exp-303-0-Dist.gz" "LOD6"
      ;;
    303-cold)
      printf '%s\n%s\n' "https://tumbleweed.nu/system-303-0-release/LOD5-cold-6-Jan-25.gz" "LOD5"
      ;;
    100-dist)
      printf '%s\n%s\n' "https://tumbleweed.nu/system-100-0-release/LOD2-Exp-100-0.gz" "LOD2"
      ;;
    100-cold)
      printf '%s\n%s\n' "https://tumbleweed.nu/system-100-0-release/LOD1-cold-3-23-23.gz" "LOD1"
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_tools() {
  if [[ -x "$USIM_DIR/lod" && -x "$USIM_DIR/diskmaker" ]]; then
    return 0
  fi

  if [[ ! -d "$USIM_DIR" || ! -f "$ROOT_DIR/l/m" ]]; then
    "$CONTAINER_SCRIPT" --mode run --prepare-only
  fi

  run_in_tools_container make -C "$CONTAINER_USIM_DIR" tools
}

is_url() {
  [[ "$1" =~ ^https?:// ]]
}

fetch_url() {
  local url=$1
  local filename=${url##*/}
  local dest="$DOWNLOAD_DIR/$filename"

  if [[ ! -f "$dest" ]]; then
    curl -L --fail --output "$dest" "$url"
  fi

  printf '%s\n' "$dest"
}

extract_if_needed() {
  local input_file=$1
  local filename
  local output_file

  filename=$(basename "$input_file")
  if [[ "$filename" == *.gz ]]; then
    output_file="$EXTRACT_DIR/${filename%.gz}"
    if [[ ! -f "$output_file" || "$input_file" -nt "$output_file" ]]; then
      gzip -dc "$input_file" >"$output_file"
    fi
    printf '%s\n' "$output_file"
  else
    printf '%s\n' "$input_file"
  fi
}

stage_if_needed() {
  local input_file=$1
  local staged_file

  case "$input_file" in
    "$ROOT_DIR"/*)
      printf '%s\n' "$input_file"
      ;;
    *)
      staged_file="$STAGED_DIR/$(basename "$input_file")"
      cp -f "$input_file" "$staged_file"
      printf '%s\n' "$staged_file"
      ;;
  esac
}

run_in_tools_container() {
  "$CONTAINER_SCRIPT" --mode tool -- "$@"
}

prepare_source() {
  local source=${1:-303-dist}
  local release_text=
  local resolved_url=
  local default_band=
  local source_file=

  if release_text=$(resolve_release "$source" 2>/dev/null); then
    resolved_url=$(printf '%s\n' "$release_text" | sed -n '1p')
    default_band=$(printf '%s\n' "$release_text" | sed -n '2p')
    source_file=$(fetch_url "$resolved_url")
    source_file=$(extract_if_needed "$source_file")
  elif is_url "$source"; then
    source_file=$(fetch_url "$source")
    source_file=$(extract_if_needed "$source_file")
  else
    if [[ ! -f "$source" ]]; then
      printf 'Source file not found: %s\n' "$source" >&2
      exit 1
    fi
    source_file=$(extract_if_needed "$source")
  fi

  source_file=$(stage_if_needed "$source_file")

  printf '%s\n%s\n' "$source_file" "${default_band:-}"
}

backup_band() {
  local disk_image=$1
  local band_name=$2
  local timestamp
  local backup_file

  timestamp=$(date +%Y%m%d-%H%M%S)
  backup_file="$BACKUP_DIR/${band_name}-${timestamp}.lod"
  run_in_tools_container "$CONTAINER_USIM_DIR/diskmaker" dump-band "$disk_image" "$band_name" "$backup_file" >/dev/null
  printf '%s\n' "$backup_file"
}

inspect_command() {
  local source=303-dist
  local prepared_text
  local source_file
  local lod_args=()

  if (($# > 0)) && [[ "$1" != "--" ]]; then
    source=$1
    shift
  fi

  if (($# > 0)); then
    if [[ "$1" != "--" ]]; then
      printf 'Unexpected argument: %s\n' "$1" >&2
      exit 1
    fi
    shift
    lod_args=("$@")
  fi

  ensure_tools
  prepared_text=$(prepare_source "$source")
  mapfile -t prepared <<<"$prepared_text"
  source_file=${prepared[0]}

  if ((${#lod_args[@]} == 0)); then
    lod_args=(-m 400)
  fi

  run_in_tools_container "$CONTAINER_USIM_DIR/lod" "${lod_args[@]}" "$source_file"
}

install_command() {
  local source=303-dist
  local target_band=
  local disk_image=$DEFAULT_DISK_IMAGE
  local do_backup=1
  local set_current=1
  local prepared_text
  local source_file
  local default_band=
  local backup_file=

  if (($# > 0)) && [[ "$1" != --* ]]; then
    source=$1
    shift
  fi

  if (($# > 0)) && [[ "$1" != --* ]]; then
    target_band=$1
    shift
  fi

  while (($#)); do
    case "$1" in
      --disk)
        disk_image=${2:?missing disk image path}
        shift 2
        ;;
      --no-backup)
        do_backup=0
        shift
        ;;
      --no-set-current)
        set_current=0
        shift
        ;;
      *)
        printf 'Unexpected argument: %s\n' "$1" >&2
        exit 1
        ;;
    esac
  done

  if [[ ! -f "$disk_image" ]]; then
    printf 'Disk image not found: %s\n' "$disk_image" >&2
    exit 1
  fi

  ensure_tools
  prepared_text=$(prepare_source "$source")
  mapfile -t prepared <<<"$prepared_text"
  source_file=${prepared[0]}
  default_band=${prepared[1]:-}

  if [[ -z "${target_band:-}" ]]; then
    if [[ -n "$default_band" ]]; then
      target_band=$default_band
    else
      target_band=LOD6
    fi
  fi

  if ((do_backup)); then
    backup_file=$(backup_band "$disk_image" "$target_band")
    printf 'Backed up %s to %s\n' "$target_band" "$backup_file"
  fi

  run_in_tools_container "$CONTAINER_USIM_DIR/diskmaker" restore-band "$source_file" "$disk_image" "$target_band"

  if ((set_current)); then
    run_in_tools_container "$CONTAINER_USIM_DIR/diskmaker" set-band "$disk_image" "$target_band" >/dev/null
    printf 'Set current band to %s\n' "$target_band"
  fi
}

command=${1:-}
if [[ -z "$command" ]]; then
  usage >&2
  exit 1
fi
shift || true

case "$command" in
  help|-h|--help)
    usage
    ;;
  list-releases)
    list_releases
    ;;
  inspect)
    inspect_command "$@"
    ;;
  install)
    install_command "$@"
    ;;
  *)
    printf 'Unknown command: %s\n' "$command" >&2
    usage >&2
    exit 1
    ;;
esac
