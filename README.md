# 👑 THE SOVEREIGN TERMINAL
> **A Touch-Controlled, Mobile/Tablet-First Linux Server Workstation & Control Portal**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built for Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20POSIX-orange.svg)]()
[![Container: Docker](https://img.shields.io/badge/Container-Docker%20Compose-blue)]()

---

## 📖 Overview

**The Sovereign Terminal** is an open-source, high-performance, system-agnostic web application designed to turn any mobile phone, tablet, or desktop browser into a complete Linux server control workstation.

Replacing raw web terminals, it pairs a 60fps WebGL terminal canvas with a GUI File Explorer, CodeMirror 6 text editor, customizable perimeter touch bars, single-handed mobile docking, and a custom Python PTY backend gateway.

---

## ✨ Key Features

### 🖥️ Tab 1: Multi-Tab WebGL Terminal
* **60fps WebGL Canvas:** Powered by `@xterm/xterm` + `@xterm/addon-webgl`.
* **`tmux` Session Bar:** Multi-session tab bar (`mobile-voice`, `dev`, `server-logs`).
* **Gboard Voice Engine:** Voice Activity Detection (VAD) dictation without opening the OS soft keyboard.
* **`[ (***) ]` Quick Sudo Entry Macro:** 1-Tap encrypted sudo password entry.
* **12-Macro Popup Grid:** Symmetrical 3×4 touch macro drawer.
* **Dual Link Router:** File links (`/workspace/...`) open in CodeMirror 6 Editor; Web URLs (`https://...`) open in new browser tabs.
* **Touch Scrollback & Copy-on-Select:** Swiping up/down scrolls 5,000+ lines of history; selecting text copies automatically to clipboard.

### 📂 Tab 2: GUI File Explorer & Multi-Doc CodeMirror 6 Editor
* **Terminal Directory Sync:** File tree automatically opens to active terminal working directory.
* **Interactive Breadcrumbs:** Tap-based directory jumping (`/workspace` > `Verdand` > `The_Weaver_Shack`).
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting for Python, JS, C, C++, Rust, Go, Markdown, HTML, CSS, JSON, Shell, Dockerfile, etc.
* **Native OS Touch Integration:** Native selection handles, magnifying glass, and context menus (`Copy`, `Cut`, `Paste`).
* **Unsaved File Safeguard:** Save check modal on tab close (`[ 💾 Save & Close ]`, `[ 🗑️ Discard ]`, `[ ❌ Cancel ]`).
* **`[ 🚀 SAVE & COMMIT ]` Git Macro:** Auto-detects Git repositories and executes `git add && git commit`.
* **Universal Binary Transfer:** Phone ↔ Server upload/download for any file type (Images, `.zip` archives, Audio, 3D `.stl` models, PDFs) + on-the-fly `.zip` batch downloads.
* **Configurable Trash Safety:** Default mode moves deleted files to `./_temp_trash/`. Toggle `ENABLE_PERMANENT_DELETE=true` in `config.env` for permanent removal.

### ⚙️ Tab 3: Themes & Button Studio
* **Default Theme:** **Vitni Nordic Forest** (`IBM Plex Mono`/`Sans` fonts, `#0A1118` Void, `#141E26` Card, `#88C0D0` Polar Ice Cyan).
* **12 MIT Open-Source Presets:** Dracula, One Dark, Tokyo Night, Solarized, Monokai, Nord, Catppuccin, Gruvbox, Kanagawa, Rose Pine, Cyberpunk.
* **Custom Hex Code Builder Studio:** Interactive real-time color palette customizer.
* **Touch Button Studio & Tap-Tap Layout Builder:** Live Center Preview, Command/Size/Color editor regions, and Handedness Docking (`Bottom`, `Right`, `Left`, `Top`).

---

## 🔒 Trash Safety vs. Permanent Delete Mode

By default, file deletion in the GUI File Explorer follows **Safe Trash Mode**, which moves deleted files into `./_temp_trash/` instead of executing permanent `rm` destruction.

If you prefer permanent file removal, set the environment variable in `config.env`:

```env
# Enable Permanent Deletion (Bypasses _temp_trash)
SAFE_TRASH_MODE=false
ENABLE_PERMANENT_DELETE=true
```

---

## ⚡ 1-Click Deployment

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

## ⚖️ License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
