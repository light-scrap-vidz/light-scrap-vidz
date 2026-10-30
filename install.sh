#!/usr/bin/env bash
# LightScrapVidz — one-line installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/light-scrap-vidz/light-scrap-vidz/main/install.sh | bash
#
#   macOS         → Homebrew cask (light-scrap-vidz/tap/light-scrap-vidz)
#   Linux + apt   → .deb package
#   Linux (other) → .AppImage in ~/.local/bin, registered in the applications menu
#
# Re-run the same command to upgrade an existing install.
set -eo pipefail

REPO="light-scrap-vidz/light-scrap-vidz"
TAP="light-scrap-vidz/tap"
CASK="light-scrap-vidz"
APP_NAME="LightScrapVidz"
APP_SLUG="light-scrap-vidz"
APP_COMMENT="Video downloader"
CATEGORIES="AudioVideo;Video;Network;"
ICON_URL="https://raw.githubusercontent.com/$REPO/main/src-tauri/icons/128x128@2x.png"
ICON_SIZE="256x256"
RUNTIME_DEPS="ffmpeg"

log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# fetch <url> [output] — writes to <output>, or to stdout when omitted
fetch() {
  if command -v curl >/dev/null 2>&1; then
    if [ $# -ge 2 ]; then curl -fsSL "$1" -o "$2"; else curl -fsSL "$1"; fi
  elif command -v wget >/dev/null 2>&1; then
    if [ $# -ge 2 ]; then wget -qO "$2" "$1"; else wget -qO- "$1"; fi
  else
    die "curl or wget is required"
  fi
}

# latest_asset <extension> — download URL of the first matching asset of the latest release
latest_asset() {
  fetch "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o "\"browser_download_url\": *\"[^\"]*\\.$1\"" \
    | head -1 \
    | sed 's/.*"\(https[^"]*\)"/\1/'
}

# verify <file> <asset name> — checks the file against the SHA256SUMS published with the
# release. A release without that file (older ones) is installed with a warning.
verify() {
  sums="$(fetch "https://github.com/$REPO/releases/latest/download/SHA256SUMS" 2>/dev/null)" || sums=""
  if [ -z "$sums" ]; then
    log "Warning: no SHA256SUMS published for this release — integrity not verified."
    return 0
  fi
  expected="$(printf '%s\n' "$sums" | awk -v n="$2" '$2 == n || $2 == "*" n { print $1; exit }')"
  [ -n "$expected" ] || die "$2 is not listed in SHA256SUMS"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$1" | awk '{print $1}')"
  else
    actual="$(shasum -a 256 "$1" | awk '{print $1}')"
  fi
  [ "$actual" = "$expected" ] || die "checksum mismatch for $2 — download discarded"
  log "Checksum verified."
}

# install_pkgs <packages…> — best effort: a missing package must not stop the installation
install_pkgs() {
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$@"
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm "$@"
  elif command -v zypper >/dev/null 2>&1; then
    sudo zypper install -y "$@"
  else
    return 1
  fi
}

install_runtime_deps() {
  if ! command -v ffmpeg >/dev/null 2>&1; then
    log "Installing ffmpeg…"
    # Fedora ships ffmpeg-free; plain ffmpeg needs RPM Fusion.
    install_pkgs ffmpeg 2>/dev/null \
      || { command -v dnf >/dev/null 2>&1 && install_pkgs ffmpeg-free; } \
      || log "Could not install ffmpeg — install it manually (the Best quality and MP3 need it)."
  fi
  # YouTube will require a JavaScript runtime (deno, node or bun).
  if ! command -v deno >/dev/null 2>&1 && ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
    log "Installing Node.js (JavaScript runtime for YouTube)…"
    install_pkgs nodejs \
      || log "Could not install Node.js — install deno, node or bun manually."
  fi
  return 0
}

install_macos() {
  [ "$(uname -m)" = "arm64" ] \
    || die "Apple Silicon (M1 or later) is required. Download manually from https://github.com/$REPO/releases"
  command -v brew >/dev/null 2>&1 \
    || die "Homebrew is required on macOS. Install it from https://brew.sh"
  brew tap "$TAP"
  # Runtime tools the app relies on (the cask also depends on them).
  brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg || log "Could not install ffmpeg — run: brew install ffmpeg"
  brew list deno >/dev/null 2>&1 || brew install deno || log "Could not install deno — run: brew install deno"
  if brew list --cask "$CASK" >/dev/null 2>&1; then
    log "Upgrading $APP_NAME via Homebrew…"
    brew upgrade --cask "$TAP/$CASK"
  else
    log "Installing $APP_NAME via Homebrew…"
    brew install --cask "$TAP/$CASK"
  fi
  log "Done. Launch $APP_NAME from Spotlight or your Applications folder."
}

install_deb() {
  url="$(latest_asset deb)"
  [ -n "$url" ] || die "No .deb found (no release yet, or GitHub API rate limit reached — retry later) — see https://github.com/$REPO/releases"
  tmp="$(mktemp -d)/$(basename "$url")"
  log "Downloading $(basename "$url")…"
  fetch "$url" "$tmp"
  verify "$tmp" "$(basename "$url")"
  log "Installing the .deb package (sudo required)…"
  sudo apt-get install -y "$tmp"
  rm -rf "$(dirname "$tmp")"
  log "Done. Launch $APP_NAME from your applications menu."
}

install_appimage() {
  url="$(latest_asset AppImage)"
  [ -n "$url" ] || die "No .AppImage found (no release yet, or GitHub API rate limit reached — retry later) — see https://github.com/$REPO/releases"

  bin_dir="$HOME/.local/bin"
  desktop_dir="$HOME/.local/share/applications"
  icon_dir="$HOME/.local/share/icons/hicolor/$ICON_SIZE/apps"
  mkdir -p "$bin_dir" "$desktop_dir" "$icon_dir"

  target="$bin_dir/$APP_SLUG.AppImage"
  log "Downloading $(basename "$url")…"
  fetch "$url" "$target"
  verify "$target" "$(basename "$url")"
  chmod +x "$target"
  command -v fusermount >/dev/null 2>&1 \
    || log "Note: AppImages need FUSE 2 (e.g. 'libfuse2'); install it if the app does not start."

  fetch "$ICON_URL" "$icon_dir/$APP_SLUG.png" 2>/dev/null || true

  cat > "$desktop_dir/$APP_SLUG.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=$APP_COMMENT
Exec=$target
Icon=$APP_SLUG
Terminal=false
Categories=$CATEGORIES
StartupWMClass=$APP_SLUG
EOF

  update-desktop-database "$desktop_dir" 2>/dev/null || true

  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *) log "Note: $bin_dir is not in your PATH — add it to your shell profile to launch from a terminal." ;;
  esac
  log "Done. Installed to $target — launch $APP_NAME from your applications menu."
}

echo "$APP_NAME installer"

case "$(uname -s)" in
  Darwin)
    install_macos
    ;;
  Linux)
    [ "$(uname -m)" = "x86_64" ] \
      || die "Only x86_64 Linux builds are published (this machine is $(uname -m)). See https://github.com/$REPO/releases"
    install_runtime_deps
    if command -v apt-get >/dev/null 2>&1; then
      install_deb
    else
      install_appimage
    fi
    ;;
  *)
    die "Unsupported platform: $(uname -s). Download manually from https://github.com/$REPO/releases"
    ;;
esac
