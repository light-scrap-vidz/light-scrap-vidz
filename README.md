<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="LightScrapVidz" width="128" />
</p>

# LightScrapVidz

Download videos from TikTok, Instagram, YouTube, Facebook — and any site supported by yt-dlp — directly as MP4 or MP3.

![license](https://img.shields.io/badge/license-MIT-blue) ![platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20macOS-lightgrey)

---

## Features

- **Single video or full playlist/profile** download
- **Audio-only extraction** to MP3
- **Browser cookie auth** for Instagram and private content (Firefox, Chrome, Chromium, Brave, Edge, Opera, Vivaldi, Safari) — *Auto* only reads cookies for sites that need a login, *None* never does
- **Download queue** for batch processing — survives a restart and can be cancelled item by item
- **System notifications** when a download — or a whole queue — finishes
- **Quality selector** — best, 1080p, 720p, 480p
- **No manual yt-dlp setup** — it is bundled in the package, and *Settings → Check for updates* refreshes it (checksum-verified)

---

## Install

One command, identical on macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/light-scrap-vidz/light-scrap-vidz/main/install.sh | bash
```

| Platform | What it installs |
|----------|------------------|
| macOS | Homebrew cask `light-scrap-vidz/tap/light-scrap-vidz` |
| Linux — Debian / Ubuntu | `.deb` package |
| Linux — other distributions | `.AppImage` in `~/.local/bin`, registered in your applications menu |

Re-run the exact same command to upgrade to the latest release. The app can also update itself from *Settings → Check for updates*: macOS and AppImage installs update in place (signed), `.deb` and `.rpm` installs are sent to the release page.

> Apple Silicon only (M1 or later).

### Manual install

**macOS — Homebrew**

```bash
brew install --cask light-scrap-vidz/tap/light-scrap-vidz
```

**Linux — Debian / Ubuntu**

Download the `.deb` from the [latest release](https://github.com/light-scrap-vidz/light-scrap-vidz/releases/latest), then:

```bash
sudo apt install ./LightScrapVidz_*_amd64.deb
```

**Linux — other distributions**

Download the `.AppImage` from the [latest release](https://github.com/light-scrap-vidz/light-scrap-vidz/releases/latest), then:

```bash
chmod +x LightScrapVidz_*_amd64.AppImage
./LightScrapVidz_*_amd64.AppImage
```

---

## Requirements

- macOS: Apple Silicon (M1 or later), macOS 12 or later
- Linux: x86_64 — Debian 12+ / Ubuntu 22.04+ recommended; other distributions via the AppImage
- **ffmpeg** — merges video and audio (the *Best* and capped qualities) and extracts MP3. The installer, the `.deb` and the Homebrew cask bring it; with a manual AppImage install, install it yourself. The app warns at startup when it is missing.
- **A JavaScript runtime (deno, node or bun)** — yt-dlp will soon require one for YouTube. `brew install deno` on macOS; the `.deb` recommends `nodejs`. The app warns when none is found.

---

## Mobile

An Android and iOS client is available in
[light-scrap-vidz-mobile](https://github.com/light-scrap-vidz/light-scrap-vidz-mobile) — a thin
Expo app talking to a small self-hosted server that reuses this project's download logic.

---

## Uninstall

**macOS — Homebrew**

```bash
brew uninstall --cask light-scrap-vidz
brew untap light-scrap-vidz/tap
```

Add `--zap` to also remove settings, caches and application data:

```bash
brew uninstall --zap --cask light-scrap-vidz
```

**Linux — Debian / Ubuntu**

```bash
sudo apt remove light-scrap-vidz
```

**Linux — AppImage**

```bash
rm ~/.local/bin/light-scrap-vidz.AppImage
rm ~/.local/share/applications/light-scrap-vidz.desktop
rm ~/.local/share/icons/hicolor/256x256/apps/light-scrap-vidz.png
update-desktop-database ~/.local/share/applications
```

**Any route, with the uninstall script**

```bash
curl -fsSL https://raw.githubusercontent.com/light-scrap-vidz/light-scrap-vidz/main/uninstall.sh | bash
```

It undoes every route `install.sh` can create. The downloaded yt-dlp (about 35 MB) and the thumbnail cache are kept; add `-s -- --purge` after `bash` to remove them too.

---

## Updates

The app looks for a new version a few seconds after it starts and offers it in a banner, with what
it brings; *Settings → Check for updates* does the same on demand. After an update, a *What's new*
window opens once, and it is always available from *Settings*.

The look (colours, font, sizes, light and dark theme) and these screens are shared with
LightCutVidz and the other apps of the suite: they live in `src/suite/`, which is the same in
each app — change them everywhere or nowhere.

---

## Development

### Prerequisites

- [Rust](https://rustup.rs) stable
- [Node.js](https://nodejs.org) 22.22.2+ (24 LTS recommended)
- The [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS

### Setup

```bash
git clone https://github.com/light-scrap-vidz/light-scrap-vidz.git
cd light-scrap-vidz
npm install
```

### Run in dev mode

```bash
npm run tauri dev
```

### Build the packaged app

```bash
npm run tauri build
```

### Tests

```bash
npm test                                   # frontend (Vitest) — includes the IPC contract with the Rust sources
cargo test --manifest-path src-tauri/Cargo.toml   # backend, including a fake yt-dlp run end to end
```

The Rust side needs the Tauri system dependencies and a yt-dlp sidecar under `src-tauri/binaries/`
(`yt-dlp-lsv-<target-triple>`); `.github/scripts/fetch-ytdlp.sh` downloads the pinned, checksum-verified build.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only |
| `npm run build` | Type-check and build the frontend |
| `npm run test` | Vitest unit and contract tests |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint over `src/`, `e2e/` and the config files, accessibility rules included (no warnings allowed) |
| `npm run format` | Prettier over `src/` |

---

## Privacy and security notes

- *Sign-in* uses `--cookies-from-browser`, which lets yt-dlp read the **whole** cookie jar of the chosen browser. *Auto* (the default) does so only for Instagram and Facebook, using the first detected browser, and only for that request; pick *None* to never read cookies. On macOS, Safari additionally needs *Full Disk Access* for the app.
- Fonts are bundled and thumbnails are fetched by the app (https only, public hosts only, cached under the app cache folder) and handed to the window through the `thumb://` scheme, so the window itself does not contact third-party hosts: its Content-Security-Policy allows no remote image.
- The webview runs under a strict Content-Security-Policy; the *Open file* action only opens folders and media files, never an application bundle.
- Quitting the app stops any running yt-dlp/ffmpeg and deletes their partial files.

---

## Changelog

[CHANGELOG.md](CHANGELOG.md) (English) and [CHANGELOG.fr.md](CHANGELOG.fr.md) (French) list the changes of every version and follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Keep both in step.

---

## License

MIT — see [LICENSE](LICENSE).
