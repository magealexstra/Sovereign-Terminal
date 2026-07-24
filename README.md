# The Sovereign Terminal

> **A Touch-Controlled, Mobile/Tablet-First Linux Server Workstation and Control Portal**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20POSIX-orange.svg)]()
[![Container: Docker](https://img.shields.io/badge/Container-Docker%20Compose-blue)]()

---

## Overview

**The Sovereign Terminal** is an open-source, high-performance, system-agnostic web application designed to transform mobile devices, tablets, and desktop browsers into a complete Linux server management workstation.

Designed to replace traditional web terminals, it pairs a hardware-accelerated 60fps WebGL terminal canvas with a GUI File Explorer, CodeMirror 6 text editor, customizable touch bars, single-handed mobile docking, and a dedicated Python PTY backend gateway.

---

## Key Features

### Tab 1: Multi-Tab WebGL Terminal
* **60fps WebGL Canvas:** Powered by `@xterm/xterm` and `@xterm/addon-webgl` for GPU-accelerated rendering.
* **tmux Session Management:** Multi-session tab bar supporting concurrent sessions (e.g., `mobile-voice`, `dev`, `server-logs`).
* **Gboard Voice Engine:** Integrated Voice Activity Detection (VAD) dictation without triggering native OS keyboard layout jumps.
* **Quick Sudo Entry Macro:** Single-tap encrypted sudo password entry satisfying `[sudo]` prompts without exposing plain text on screen.
* **12-Macro Popup Grid:** Symmetrical 3x4 touch macro drawer for frequent shell operations.
* **Dual Link Router:** Automatically routes workspace file paths (`/workspace/...`) to the CodeMirror 6 Editor and web URLs (`https://...`) to new browser tabs.
* **Touch Scrollback & Copy-on-Select:** Swiping up/down scrolls history smoothly; text selection automatically copies content to system clipboard.

### Tab 2: GUI File Explorer & CodeMirror 6 Multi-Document Editor
* **Terminal Directory Sync:** File tree automatically synchronizes with the active terminal working directory.
* **Interactive Breadcrumbs:** Tap-based directory navigation (e.g., `/workspace` > `Verdand` > `The_Weaver_Shack`).
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting supporting Python, JavaScript, C, C++, Rust, Go, Markdown, HTML, CSS, JSON, Shell, Dockerfile, and configuration formats.
* **Native Touch Integration:** Native OS selection handles, magnifying glass, and context menus (`Copy`, `Cut`, `Paste`).
* **Unsaved File Safeguards:** Modal dialog on tab close with explicit options (`[ Save & Close ]`, `[ Discard ]`, `[ Cancel ]`).
* **Automated Git Commit Macro:** Auto-detects Git repository root and executes staging and commit sequences.
* **Universal Binary Transfer:** Direct bidirectional phone-to-server transfer supporting images, archives, audio, 3D models, and PDFs, with on-the-fly zip archive streaming for multi-file downloads.
* **Configurable Trash Protection:** Default safe trash mode moves deleted files to `./_temp_trash/`. Permanent removal can be enabled via `ENABLE_PERMANENT_DELETE=true` in `config.env`.

### Tab 3: Themes & Button Studio
* **Default Theme:** Vitni Nordic Forest palette utilizing `IBM Plex Mono` / `IBM Plex Sans` typography, `#0A1118` Void background, `#141E26` Card container, and `#88C0D0` Polar Ice Cyan highlights.
* **12 Open-Source Presets:** Dracula, One Dark, Tokyo Night, Solarized, Monokai, Nord, Catppuccin, Gruvbox, Kanagawa, Rose Pine, and Cyberpunk.
* **Custom Hex Code Builder:** Real-time color palette customizer modifying terminal and interface variables dynamically.
* **Touch Button Studio:** Live preview console with customizable button payloads, dimensions, colors, and edge docking (`Bottom`, `Right`, `Left`, `Top`).

---

## File Safety & Trash Policy

By default, file deletion within the File Explorer follows **Safe Trash Mode**, moving deleted items to `./_temp_trash/` instead of executing unrecoverable removal.

To enable permanent deletion, update `config.env`:

```env
# Enable Permanent Deletion (Bypasses _temp_trash)
SAFE_TRASH_MODE=false
ENABLE_PERMANENT_DELETE=true
```

---

## Quick Start Deployment

```bash
# 1. Clone repository
git clone https://github.com/magealexstra/Sovereign_Terminal.git
cd Sovereign_Terminal

# 2. Configure environment
cp config.env.example config.env

# 3. Launch Docker Stack (Port 2068 / 2069)
docker compose up -d
```

---

## Architecture & Technical Documentation

For detailed architectural specifications, consult the documents in the `docs/` directory:

* [Overall Architecture Specification](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/OVERALL_SOVEREIGN_TERMINAL_DESIGN.md)
* [Backend Gateway Specification](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/SOVEREIGN_BACKEND_GATEWAY.md)
* [Tab 1 Terminal Specification](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/TAB_1_MULTI_TAB_TERMINAL.md)
* [Tab 2 File Explorer & Editor Specification](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/TAB_2_FILE_EXPLORER_AND_EDITOR.md)
* [Tab 3 Settings & Studio Specification](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/TAB_3_SETTINGS_AND_STUDIO.md)
* [Development Plan & Roadmap](file:///Heimr/Verdand/The_Weaver_Shack/Sovereign_Terminal/docs/DEVELOPMENT_PLAN.md)

---

## License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
