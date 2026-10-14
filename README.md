# Vortex

High-performance, unrestricted desktop media hub and video downloader powered by yt-dlp, FFmpeg, Electron, and React.

---

## Overview

Vortex is a modern, standalone desktop application engineered for seamless video and audio extraction, playback, and library management across more than 1,000 supported websites. Built from the ground up to eliminate paywalls, telemetry, and external dependencies, Vortex packages everything needed to extract, transcode, organize, and stream media across your personal devices.

---

## Key Features

### Autonomous First-Run Bootstrapper
- Zero-configuration setup: runs seamlessly on fresh computers without requiring Python, Git, or manual PATH configurations.
- Automatic binary resolution: on first launch, Vortex detects whether the host system contains required utilities (`yt-dlp` and `FFmpeg`). If missing, it securely fetches official Windows release binaries from GitHub via redirect-following streaming HTTPS.
- Built-in verification: automatically unpacks, places binaries in `%USERPROFILE%\.vortex\bin\`, and executes health checks before enabling download workflows.

### Comprehensive Media Extraction and Transcoding
- Supports custom resolution targets (Best, 4K UHD, 1440p QHD, 1080p FHD, 720p HD, 480p SD).
- Video container selection: MP4 (H.264 / AAC for universal playback), MKV, and WebM.
- Audio-only extraction: pristine 320kbps MP3, AAC/M4A, FLAC lossless, WAV, and Opus.
- Metadata and point-of-interest indexing: automatic extraction of video chapters, high-resolution thumbnails, and subtitle tracks.
- SponsorBlock integration: optional automatic removal of sponsored segments.
- Browser cookie integration: import authentication cookies from Brave, Chrome, Firefox, or Edge for restricted streams.

### Integrated Media Player and Persistent Dock
- Native in-app video modal with chapter navigation and multi-speed playback (0.75x to 2.0x).
- Persistent bottom dock mini-player: listen to audio tracks or monitor playback while continuing to browse your library or queue new downloads.
- Custom media streaming protocol (`vortex-media://`) backed by an internal HTTP server supporting HTTP 206 Partial Content range requests for instant scrubbing and zero stutter.

### Local Network QR Mobile Sharing
- Built-in lightweight LAN HTTP server running on local port 6767.
- Dynamic QR code generation: scan with any phone or tablet on the same Wi-Fi network to open the Vortex Mobile web interface.
- Bidirectional workflow:
  - Download to mobile: stream and save completed desktop downloads directly to mobile device storage.
  - Send to PC: paste links from your mobile browser to immediately trigger downloads on your workstation.

### Local SQLite Database and Backward Compatibility
- Fast in-memory WebAssembly SQLite engine (`sql.js`) backed by disk persistence at `%USERPROFILE%\.vortex\storage\vortex.db`.
- Seamless zero-data-loss migration: automatically migrates existing library data and history from legacy `.smasher` or `.stacher` installations.
- Automated library reconciler: scans selected directories to repair broken links when files are renamed or moved.
- Full database backup and restore via standard JSON snapshots.

### Visual Architecture and Themes
- 15 curated design themes: Synthwave, Cyberpunk, Retro Terminal, Hacker, Midnight, Noir OLED, Solarized, Vapor, Cosmic, Coffee, Forest, Autumn, Christmas, Halloween, and Spring.
- Real-time accent color picker: customize primary gradients and glowing accents.
- Keyboard-driven command palette (`Ctrl+K`): quick search across downloads, theme switching, and instant navigation.

---

## Installation

Pre-built Windows release packages are located in the `release/` directory:

| Package | Format | Description |
| :--- | :--- | :--- |
| `Vortex Setup 1.0.0.exe` | NSIS Executable Installer | Universal standard installer. Installs for current user without administrator privileges, adds desktop and Start Menu shortcuts with uninstaller. |
| `Vortex 1.0.0.msi` | Windows Installer Package | Enterprise-ready MSI package for system administrators and corporate software distribution. |
| `win-unpacked/` | Portable Folder | Unpacked directory containing `Vortex.exe`. Can be run directly without installation. |

---

## Building from Source

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Windows 10 or 11 (64-bit)

### Installation

Clone the repository and install project dependencies:

```bash
git clone https://github.com/zbrau/vortex.git
cd vortex
npm install
```

### Development Mode

Run the Vite development server with Electron hot reload:

```bash
npm run dev
```

### Production Build

Compile TypeScript and bundle the frontend and Electron main processes:

```bash
npm run build
```

### Generating Windows Installers (.exe and .msi)

To build both the NSIS `.exe` installer and the `.msi` package:

```bash
npm run dist:all
```

To build only the universal `.exe` installer:

```bash
npm run dist:exe
```

To build only the `.msi` Windows Installer:

```bash
npm run dist:msi
```

Output packages will be saved to the `release/` folder.

---

## Project Structure

```
vortex/
├── build/                      # Windows icon files (.ico, .png)
├── dist/                       # Compiled React frontend distribution
├── dist-electron/              # Compiled Electron main and preload outputs
├── src/
│   ├── main/                   # Electron main process
│   │   ├── binary-manager.ts   # Binary detection, download, and extraction engine
│   │   ├── database.ts         # SQLite database and historical data migration
│   │   ├── downloader.ts       # yt-dlp execution and progress pipeline
│   │   ├── index.ts            # Application lifecycle, IPC handlers, protocol registration
│   │   └── server.ts           # Local LAN streaming and mobile web interface
│   ├── preload/                # Context-isolated secure preload scripts
│   │   └── index.ts            # Exposes vortexAPI to renderer window
│   └── renderer/               # React 18 frontend
│       ├── components/         # Modals, Navbar, Library, Download bar, Video player
│       ├── theme/              # Mantine theme presets and custom color engine
│       ├── types/              # TypeScript interface definitions
│       ├── App.tsx             # Main application orchestrator
│       └── main.tsx            # React DOM root entry point
├── package.json                # Project dependencies and electron-builder configuration
├── tsconfig.json               # TypeScript compiler configuration
├── vite.config.ts              # Vite build setup with Electron integration
└── README.md                   # Project documentation
```

---

## Autonomous Engine Details

Vortex isolates third-party dependencies from your system's global environment:
- Downloaded binaries reside exclusively in `%USERPROFILE%\.vortex\bin\`.
- Windows release bundles are fetched from verified GitHub releases:
  - `yt-dlp`: official release from `yt-dlp/yt-dlp`
  - `FFmpeg`: official Windows GPL release from `yt-dlp/FFmpeg-Builds`
- Decompression is performed natively using Windows `tar.exe` with PowerShell fallback, without installing third-party decompression utilities.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
