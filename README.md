# The Sovereign Terminal

> ⚠️ **NOTICE: THIS APPLICATION IS CURRENTLY UNDER ACTIVE DEVELOPMENT**
> *The Sovereign Terminal is actively being built and refined. Features, design specs, and APIs are evolving rapidly.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20POSIX-orange.svg)]()
[![Container: Docker](https://img.shields.io/badge/Container-Docker%20Compose-blue)]()

---

## Overview

**The Sovereign Terminal** is an open-source, high-performance, system-agnostic web application designed to transform mobile devices, tablets, and desktop browsers into a complete, sovereign Linux server management workstation.

Designed to replace traditional, rigid web terminals, it pairs a hardware-accelerated 60fps WebGL terminal canvas with a GUI File Explorer, CodeMirror 6 text editor, highly customizable touch bars, single-handed mobile docking, dynamic theme engine, and a dedicated Python PTY backend gateway.

---

## Key Features & Current Development State

### 1. Multi-Tab WebGL Terminal & PTY Gateway
* **60fps WebGL Canvas:** Powered by `@xterm/xterm` and `@xterm/addon-webgl` for GPU-accelerated rendering.
* **tmux Session Persistence:** Multi-session tab bar supporting concurrent persistent sessions (`mobile-voice`, `dev`, `server-logs`) with controlling terminal ioctl allocation.
* **Gboard Voice Engine:** Continuous Voice Activity Detection (VAD) dictation with real-time transcript diffing.
* **Quick Sudo Entry Macro:** Single-tap encrypted sudo password entry satisfying `[sudo]` prompts without exposing plain text on screen.
* **Master Red `MACROS` Launcher:** Pinned bright red catalog launcher granting instant access to the full command toolkit library.
* **Touch Scrollback & Copy-on-Select:** Swiping up/down scrolls history smoothly; text selection automatically copies content to system clipboard.
* **Port Decoupling & Host Auto-Resolution:** Fully decoupled REST and WebSocket architecture (`PORT=2068` in dev, `PORT=2069` in release template) with relative `/api/fs/...` paths.

### 2. GUI File Explorer & CodeMirror 6 Multi-Document Editor
* **Terminal Directory Sync:** File tree automatically synchronizes with the active terminal working directory.
* **Interactive Breadcrumbs:** Tap-based directory navigation (e.g., `/workspace` > `Verdand` > `The_Weaver_Shack`).
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting supporting Python, JavaScript, C, C++, Rust, Go, Markdown, HTML, CSS, JSON, Shell, Dockerfile, and configuration formats.
* **Native Touch Integration:** Native OS selection handles, magnifying glass, and context menus (`Copy`, `Cut`, `Paste`).
* **Unsaved File Safeguards:** Modal dialog on tab close with explicit options (`[ Save & Close ]`, `[ Discard ]`, `[ Cancel ]`).
* **Automated Git Commit Macro:** Auto-detects Git repository root and executes staging and commit sequences.
* **Universal Binary Transfer:** Direct bidirectional phone-to-server transfer supporting images, archives, audio, 3D models, and PDFs, with on-the-fly zip archive streaming for multi-file downloads.
* **Configurable Trash Protection:** Safe trash mode moves deleted files to `./_temp_trash/` by default. Permanent removal can be enabled via `ENABLE_PERMANENT_DELETE=true` in `config.env`.

### 3. Single-Bar Visual TouchBar Editor (Settings Tab 1)
* **Tap-Selection Workflow:** 2-tap add, move left/right, and delete interaction model for full TouchBar customization.
* **Live TouchBar Strip:** 1:1 visual preview of the scrollable bottom TouchBar with real-time `localStorage` sync (`sovereign_layout_slots`).
* **Searchable Category Selector:** Combined real-time search bar and two-tier category dropdown menu (Custom Buttons top priority, followed by alphabetical pre-built toolkits).
* **Dual-Purpose Delete Handler:** Removes buttons from the TouchBar or hides unwanted chips from the Available Pool view while preserving system defaults.
* **Tap-to-Deselect:** Tapping any blank background area of the card or container deselects the active button item.

### 4. Categorized Command Toolkits & AI Agent Suites
* **`AGY` (Google Antigravity CLI Suite):** `/model`, `/clear`, `/plan`, `/schedule`, `/goal`, `/grill-me`, `/teamwork-preview`, `/learn`, `Ctrl+O`.
* **`CLD` (Claude CLI Suite):** `/compact`, `/cost`, `/doctor`, `/clear`, `/help`, `/init`, `/bug`, `/review`, `Ctrl+C`.
* **`HMS` (Hermes Agent Suite):** `/status`, `/reset`, `/tools`, `/logs`, `/cancel`, `/config`, `/memory`, `/mcp`.
* **`APT` (Debian/Ubuntu Package Manager):** `upgrade -y` (`sudo apt update && sudo apt upgrade -y`), `sudo apt update`, `sudo apt search`, `sudo apt install`, `sudo apt purge`, `sudo apt autoremove -y`, `sudo apt clean`.
* **`PAC` (Arch Linux Pacman Suite):** `upgrade -y` (`sudo pacman -Syu`), `sudo pacman -S`, `pacman -Ss`, `sudo pacman -Rns`, `sudo pacman -Sc`.
* **`YUM` (Fedora/RHEL DNF Suite):** `upgrade -y` (`sudo dnf upgrade --refresh -y`), `sudo dnf update`, `sudo dnf install`, `dnf search`, `sudo dnf remove`.
* **`DOC` (Docker Suite):** `docker ps`, `docker ps -a`, `docker compose up -d`, `docker compose down`, `docker compose logs -f`, `docker exec -it`, `docker system prune -f`.
* **`GIT` (Git Version Control):** `git status`, `git log -10`, `git add .`, `git commit -m`, `git push`, `git pull`, `git checkout -b`, `git diff`.
* **`SYS` (System & Disks):** `sudo systemctl status`, `sudo systemctl restart`, `sudo journalctl -xeu`, `lsblk`, `sudo blkid`, `df -h`, `du -sh *`, `sudo fdisk -l`, `sudo dmesg -T`, `htop`.
* **`FILE` (Permissions & Archives):** `chmod +x`, `chmod 755`, `chmod 644`, `sudo chown -R`, `sudo chgrp -R`, `mkdir -p`, `find . -name`, `rsync -avz`, `tar -czvf`, `tar -xvf`, `unzip`.
* **`NET` (Networking Tools):** `ip a`, `ping -c 4`, `sudo netstat -tuln`, `sudo ss -tulpn`, `sudo ufw status`, `curl -I`, `dig`, `traceroute`.
* **`PY` (Python & Venv):** `python3`, `pip install`, `python3 -m venv venv`, `source venv/bin/activate`, `pip list`, `pip freeze`.
* **`TMX` (Tmux Manager):** `tmux ls`, `tmux new-session -s`, `tmux attach -t`, `tmux kill-session -t`, `split h`, `split v`.
* **`KEY` (Stacked Mobile Keys):** 3-button sub-navigation:
  * `SYM` (Shell Operators): `|`, `~`, `>`, `>>`, `<`, `&&`, `||`, `;`, `` ` ``, `\`, `/`, `$`, `#`
  * `MODE` (Signals/Escapes): `ESC`, `TAB`, `DEL` (`\x1b[3~`), `^C`, `^Z`, `^D`
  * `LINE` (Cursor Controls): `^A` (Home), `^E` (End), `^K` (Cut end), `^U` (Cut start), `^W` (Delete word), `^Y` (Paste), `^R` (History search), `^L` (Clear)

### 5. Touch Button Studio & 100% Dynamic Theme Engine (Settings Tabs 2 & 3)
* **Fluid Flexbox Button Studio:** Dynamic proportional flex scaling across 4K displays, laptops, 12" tablets, fold phones, and smartphones.
* **Output & Function Card:** Button Name input + 3-line Function `<textarea rows={3} />`.
* **Size, Shape & Save Card:** Width/Height steppers, vertically stacked tap shape buttons (`Square`, `Round`, `Pill`), and pinned Save button.
* **Live Preset & Custom Dropdown:** Search bar input stacked above dropdown containing all pre-built layout commands and custom buttons.
* **100% Dynamic Theme Engine:** Zero hardcoded colors or emojis; all icons, buttons, borders, and modals dynamically recolor with 12 curated base-16 open-source themes (Dracula, Nord, Tokyo Night, Catppuccin, Solarized, Monokai, etc.).

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

# 3. Launch Docker Stack (Port 2068 in Dev / 2069 in Release)
docker compose up -d
```

## HTTPS, Tailscale & Remote Access

Sovereign Terminal runs HTTP on port `2068` (or `2069` in production templates) by default. To unlock Web Speech API microphone dictation on mobile devices and browsers, secure HTTPS access is required.

* **Tailscale (Recommended for Mobile Voice)**: Execute `tailscale serve https / http://127.0.0.1:2068` on your host machine to get instant, free Let's Encrypt certificates for your MagicDNS `.ts.net` address.
* **Reverse Proxies & Tunnels**: Supports Nginx Proxy Manager, Caddy, Cloudflare Tunnels (`cloudflared`), and local `mkcert` SAN certificates.
* **Security & Privacy**: Zero network scanning, zero background probing, and zero external telemetry. All session data remains 100% local.

For full step-by-step setup guides, consult [HTTPS and Networking Guide](docs/HTTPS_AND_NETWORKING_GUIDE.md).

---

## Architecture & Technical Documentation

For detailed architectural specifications, consult the documents in the `docs/` directory:

* [HTTPS, Tailscale & Remote Access Guide](docs/HTTPS_AND_NETWORKING_GUIDE.md)
* [Overall Architecture Specification](docs/OVERALL_SOVEREIGN_TERMINAL_DESIGN.md)
* [Backend Gateway Specification](docs/SOVEREIGN_BACKEND_GATEWAY.md)
* [Tab 1 Multi-Tab Terminal Specification](docs/TAB_1_MULTI_TAB_TERMINAL.md)
* [Tab 2 File Explorer & Editor Specification](docs/TAB_2_FILE_EXPLORER_AND_EDITOR.md)
* [Tab 3 Settings & Studio Specification](docs/TAB_3_SETTINGS_AND_STUDIO.md)
* [Development Plan & Roadmap](docs/DEVELOPMENT_PLAN.md)


---

## License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
