#!/usr/bin/env bash
# LightScrapVidz — one-line uninstaller for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/light-scrap-vidz/light-scrap-vidz/main/uninstall.sh | bash
#
#   macOS         → Homebrew cask, or the .app bundle if it was installed by hand
#   Linux + apt   → .deb package
#   Linux (other) → AppImage, its menu entry and its icon
#
# Mirrors install.sh: every install route it can create, this can undo. Removing
# something that was never installed is not an error — the script reports what it
# actually found.
#
# User settings and projects are left untouched, and so is the downloaded yt-dlp: pass
# --purge to remove that too (about 35 MB) along with the thumbnail cache.
set -eo pipefail

PURGE=0
[ "$1" = "--purge" ] && PURGE=1

REPO="light-scrap-vidz/light-scrap-vidz"
TAP="light-scrap-vidz/tap"
CASK="light-scrap-vidz"
APP_NAME="LightScrapVidz"
APP_SLUG="light-scrap-vidz"
DEB_PACKAGE="light-scrap-vidz"
ICON_SIZE="256x256"
BUNDLE_ID="com.lightscrape.vidz"

removed=0

log() { printf '==> %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

uninstall_macos() {
  if command -v brew >/dev/null 2>&1 && brew list --cask "$CASK" >/dev/null 2>&1; then
    log "Removing $APP_NAME via Homebrew…"
    brew uninstall --cask "$CASK"
    removed=1
  fi

  # Installed by hand rather than through Homebrew (the bundle was named after the slug
  # before 1.5).
  for app in "/Applications/$APP_NAME.app" "/Applications/$APP_SLUG.app"; do
    if [ -d "$app" ]; then
      log "Removing $app…"
      rm -rf "$app"
      removed=1
    fi
  done
}

uninstall_deb() {
  command -v dpkg-query >/dev/null 2>&1 || return 0
  dpkg-query -W -f='${Status}' "$DEB_PACKAGE" 2>/dev/null | grep -q "^install ok installed$" || return 0
  log "Removing the $DEB_PACKAGE package (sudo required)…"
  sudo apt-get remove -y "$DEB_PACKAGE"
  removed=1
}

uninstall_appimage() {
  bin="$HOME/.local/bin/$APP_SLUG.AppImage"
  desktop="$HOME/.local/share/applications/$APP_SLUG.desktop"
  icon="$HOME/.local/share/icons/hicolor/$ICON_SIZE/apps/$APP_SLUG.png"

  found=0
  for f in "$bin" "$desktop" "$icon"; do
    [ -e "$f" ] || continue
    [ "$found" -eq 1 ] || log "Removing the AppImage install…"
    found=1
    note "$f"
    rm -f "$f"
    removed=1
  done

  [ "$found" -eq 1 ] && command -v update-desktop-database >/dev/null 2>&1 \
    && update-desktop-database "$HOME/.local/share/applications" 2>/dev/null
  return 0
}

purge_data() {
  case "$(uname -s)" in
    Darwin) dirs="$HOME/Library/Application Support/$BUNDLE_ID $HOME/Library/Caches/$BUNDLE_ID" ;;
    *) dirs="${XDG_DATA_HOME:-$HOME/.local/share}/$BUNDLE_ID ${XDG_CACHE_HOME:-$HOME/.cache}/$BUNDLE_ID" ;;
  esac
  # Word splitting is wanted for the two directories, but not inside a path with spaces.
  for d in "$HOME/Library/Application Support/$BUNDLE_ID" "$HOME/Library/Caches/$BUNDLE_ID" \
           "${XDG_DATA_HOME:-$HOME/.local/share}/$BUNDLE_ID" "${XDG_CACHE_HOME:-$HOME/.cache}/$BUNDLE_ID"; do
    case "$dirs" in *"$d"*) ;; *) continue ;; esac
    [ -d "$d" ] || continue
    log "Removing $d…"
    rm -rf "$d"
    removed=1
  done
}

echo "$APP_NAME uninstaller"

case "$(uname -s)" in
  Darwin)
    uninstall_macos
    ;;
  Linux)
    # A machine can carry either route — or both, after switching. Undo whatever is there.
    uninstall_deb
    uninstall_appimage
    ;;
  *)
    die "Unsupported platform: $(uname -s)."
    ;;
esac

[ "$PURGE" -eq 1 ] && purge_data

if [ "$removed" -eq 1 ]; then
  log "Done. $APP_NAME has been removed."
  [ "$PURGE" -eq 1 ] || note "Your settings and the downloaded yt-dlp were left in place (--purge removes the latter)."
else
  log "Nothing to remove — $APP_NAME does not appear to be installed."
fi
