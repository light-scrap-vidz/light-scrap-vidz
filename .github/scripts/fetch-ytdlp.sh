#!/usr/bin/env bash
# fetch-ytdlp.sh <asset> <destination>
#
# Downloads the yt-dlp release pinned in .github/yt-dlp-version and checks it against the
# SHA2-256SUMS published with that same release, so builds are reproducible and a tampered
# download fails the job. Bump the version file to update the bundled yt-dlp.
set -euo pipefail

asset="$1"
dest="$2"
version="$(tr -d '[:space:]' < "$(dirname "$0")/../yt-dlp-version")"
base="https://github.com/yt-dlp/yt-dlp/releases/download/$version"

curl -fsSL "$base/$asset" -o "$dest"
expected="$(curl -fsSL "$base/SHA2-256SUMS" | awk -v a="$asset" '$2 == a || $2 == "*" a { print $1; exit }')"
[ -n "$expected" ] || { echo "::error::no checksum for $asset in yt-dlp $version"; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$dest" | awk '{print $1}')"
else
  actual="$(shasum -a 256 "$dest" | awk '{print $1}')"
fi
[ "$actual" = "$expected" ] || { echo "::error::checksum mismatch for $asset ($actual != $expected)"; exit 1; }
chmod +x "$dest"
echo "yt-dlp $version $asset verified"
