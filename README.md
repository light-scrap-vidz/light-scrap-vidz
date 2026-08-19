# LightScrapVidz

Download videos from TikTok, Instagram, YouTube, Facebook — and any site supported by yt-dlp — directly as MP4 or MP3.

![CI](https://github.com/light-scrap-vidz/light-scrap-vidz/actions/workflows/ci.yml/badge.svg) ![license](https://img.shields.io/badge/license-MIT-blue) ![platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20macOS-lightgrey)

**Website** — <https://light-scrap-vidz.github.io/light-scrap-vidz/>

---

## Features

- **Single video or full playlist/profile** download
- **Audio-only extraction** to MP3
- **Browser cookie auth** for Instagram and private content (Firefox, Chrome, Chromium)
- **Download queue** for batch processing
- **System notifications** on completion
- **Quality selector** — best, 1080p, 720p, 480p
- **No manual yt-dlp setup** — it is bundled in the package

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

Re-run the exact same command to upgrade to the latest release.

> Apple Silicon only (M1 or later).

### Manual install

**macOS — Homebrew**

```bash
brew install --cask light-scrap-vidz/tap/light-scrap-vidz
```

**Linux — Debian / Ubuntu**

Download the `.deb` from the [latest release](https://github.com/light-scrap-vidz/light-scrap-vidz/releases/latest), then:

```bash
sudo apt install ./light-scrap-vidz_*_amd64.deb
```

**Linux — other distributions**

Download the `.AppImage` from the [latest release](https://github.com/light-scrap-vidz/light-scrap-vidz/releases/latest), then:

```bash
chmod +x light-scrap-vidz_*_amd64.AppImage
./light-scrap-vidz_*_amd64.AppImage
```

---

## Requirements

- macOS: Apple Silicon (M1 or later)
- Linux: x86_64 — Debian 12+ / Ubuntu 22.04+ recommended; other distributions via the AppImage

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

---

## Development

### Prerequisites

- [Rust](https://rustup.rs) stable
- [Node.js](https://nodejs.org) 20+
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

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only |
| `npm run build` | Type-check and build the frontend |
| `npm run test` | Vitest unit tests |
| `npm run test:watch` | Watch mode |
| `npm run lint` | ESLint over `src/` (no warnings allowed) |
| `npm run format` | Prettier over `src/` |

---

## CI / CD

- **CI** (`ci.yml`) runs on every push and pull request: lint, type-check and unit tests.
- **Pages** (`pages.yml`) deploys `docs/` to GitHub Pages on every push to `main`.
- **Release** is triggered by pushing a `v*.*.*` tag: builds the `.deb`, `.AppImage` and `.rpm` on Linux and the app archive on macOS, and attaches them to the GitHub release.

---

## License

MIT — see [LICENSE](LICENSE).
