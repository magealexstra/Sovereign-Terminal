# The Sovereign Terminal

>  **NOTICE: THIS APPLICATION IS CURRENTLY UNDER ACTIVE DEVELOPMENT**
> *The Sovereign Terminal is actively being built and refined. Features, design specs, and APIs are evolving rapidly.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20POSIX-orange.svg)]()
[![Container: Docker](https://img.shields.io/badge/Container-Docker%20Compose-blue)]()

---

## Overview

**The Sovereign Terminal** is an open-source, high-performance, system-agnostic web application explicitly designed to transform mobile phones and tablets into a complete, sovereign Linux server management workstation.

Designed to replace traditional, rigid web terminals, it pairs a fluid xterm.js terminal canvas with a GUI File Explorer, CodeMirror 6 text editor, highly customizable touch bars, single-handed mobile docking, dynamic theme engine, and a dedicated Python PTY backend gateway.

---

## Key Features & Current Development State

### 1. Multi-Tab Terminal Canvas & PTY Gateway
* **Universal Terminal Canvas:** Powered by `@xterm/xterm` with DOM/canvas fallback compatibility to eliminate mobile Safari crashes.
* **Flawless Mobile Resizing:** Dynamically monitors DOM layout paints and guarantees pixel-perfect flexbox scaling for viewport height, preventing cut-off prompts.
* **True Multi-Device Persistence:** Multi-session tab bar supporting concurrent persistent sessions with compact `S-XXXX` tab chips. Close your phone browser, open a tablet, authenticate via PAM, and resume exactly where you left off.
* **Multi-Client Isolation & Takeover:** Connecting from a new device automatically isolates and creates a fresh session if existing sessions are attached elsewhere. Manual takeover allows kicking stale clients on demand from Settings.
* **Automatic Copy-Mode Lockout Release:** Seamlessly unlocks `tmux` copy-mode and anchors focus when typing, staging, or sending commands.
* **Zombie-Proof Sessions:** Advanced PTY session tracking prevents orphaned connections and guarantees accurate controlling terminal sizes across device hand-offs.
* **Gboard Voice Engine & Command Stager:** Continuous Voice Activity Detection (VAD) dictation with persistent FIFO history memory, footer arrow navigation, and a 3-second long-press clear.
* **Quick Sudo Entry Macro:** Single-tap encrypted sudo password entry satisfying `[sudo]` prompts without exposing plain text on screen.
* **Master Red `MACROS` Launcher:** Pinned bright red catalog launcher granting instant access to the full command toolkit library.
* **Touch Scrollback & CopyCard Suite:** Collapsible tri-color copy panel (`COPY`, `ALL`, `CUST`) with touch isolation and destination toggle (`[ CLIP ]` / `[ CODE ]`).
* **Canvas Tap-Redirect:** Configurable canvas tap routing (`Stager Drawer` vs `Terminal Focus`).
* **Port Decoupling & Host Auto-Resolution:** Fully decoupled REST and WebSocket architecture (`PORT=2069` by default) with relative `/api/fs/...` paths.
* **Live Session Count Badge:** Displays the number of active tmux sessions on the terminal tab bar with color-coded thresholds (green, amber, red).
* **Host Pass-Through Mode:** Supports seamless integration and control of native host tmux sessions directly from the containerized UI.

### 2. GUI File Explorer & CodeMirror 6 Multi-Document Editor
* **Terminal Directory Sync:** File tree automatically synchronizes with the active terminal working directory.
* **Interactive Breadcrumbs:** Tap-based directory navigation (e.g., `~/projects` > `docs` > `things`).
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting supporting Python, JavaScript, C, C++, Rust, HTML, CSS, XML, SQL, JSON, Markdown, Shell, Dockerfile, and configuration formats.
* **Live File Execution (`RUN` Button):** Single-tap script execution directly in the active terminal tab with a non-destructive Save & Run modal for unsaved buffers.
* **Native Touch Integration:** Native OS selection handles, magnifying glass, and context menus (`Copy`, `Cut`, `Paste`).
* **Unsaved File Safeguards:** Modal dialog on tab close with explicit options (`[ Save & Close ]`, `[ Discard ]`, `[ Cancel ]`).
* **Automated Git Commit Macro:** Auto-detects Git repository root and executes staging and commit sequences.
* **Universal Binary Transfer:** Direct bidirectional phone-to-server transfer supporting images, archives, audio, 3D models, and PDFs, with on-the-fly zip archive streaming for multi-file downloads.
* **Dual File Management:** Dedicated GUI controls for both standard permanent deletion and safe archiving (moving items to a local `_temp_trash` directory).

### 3. Single-Bar Visual TouchBar Editor (Settings Sub-Tab 3: Layout Builder)
* **Tap-Selection Workflow:** 2-tap add, move left/right, and delete interaction model for full TouchBar customization.
* **Live TouchBar Strip:** 1:1 visual preview of the scrollable bottom TouchBar with real-time `localStorage` sync (`sovereign_layout_slots`).
* **Searchable Category Selector:** Combined real-time search bar and two-tier category dropdown menu (Custom Buttons top priority, followed by alphabetical pre-built toolkits).
* **Dual-Purpose Delete Handler:** Removes buttons from the TouchBar or hides unwanted chips from the Available Pool view while preserving system defaults.
* **Tap-to-Deselect:** Tapping any blank background area of the card or container deselects the active button item.

### 4. Categorized Command Toolkits & AI Agent Suites
* **Built-in Touch Toolkits**: One-tap touchscreen access to 18+ categorized toolkits including AI Agent Suites (`AGY`, `CLD`, `HMS`), Package Managers (`APT`, `PAC`, `YUM`), Containers & DevOps (`DOC`, `TMX`, `GIT`), and System Tools (`SYS`, `NET`, `PY`, `FILE`, `VIM`).
* **Mobile Operator Keys**: Stacked keys for shell operators (`|`, `~`, `>`, `&&`), signals (`ESC`, `TAB`, `^C`, `^Z`), and cursor navigation (`^A`, `^E`, `^K`).
* **Dynamic Customization**: Full visual button studio for customizing labels, colors, shapes, and shell strings stored in [buttonData.js](src/components/settings/button-studio/buttonData.js).

*For the complete command reference, key injection guide, and source files, see [COMMAND_TOOLKITS_AND_MACROS.md](documentation/COMMAND_TOOLKITS_AND_MACROS.md) and [CUSTOM_BUTTON_GUIDE.md](documentation/CUSTOM_BUTTON_GUIDE.md).*

### 5. Touch Button Studio & 100% Dynamic Theme Engine (Settings Sub-Tabs 1 & 2)
* **Fluid Flexbox Button Studio:** Dynamic proportional flex scaling across 4K displays, laptops, 12" tablets, fold phones, and smartphones.
* **Tactile Execution Mode Toggle:** Single-state button toggles between `EXECUTE` (direct PTY injection) and `STAGE` (routes to Stager).
* **Reliable Sizing Controls:** Precise stepper controls for button width and height with guaranteed state normalization.
* **Output & Function Card:** Button Name input + 3-line Function `<textarea rows={3} />`.
* **Size, Shape & Save Card:** Width/Height steppers, vertically stacked tap shape buttons (`Square`, `Round`, `Pill`), and pinned Save button.
* **Live Preset & Custom Dropdown:** Search bar input stacked above dropdown containing all pre-built layout commands and custom buttons.
* **100% Dynamic Theme Engine:** Zero hardcoded colors or emojis; all icons, buttons, borders, and modals dynamically recolor with 12 curated base-16 open-source themes (Dracula, Nord, Tokyo Night, Catppuccin, Solarized, Monokai, etc.).

### 6. TMUX Session Manager (Settings Sub-Tab 4)
* **Live Session List:** Displays all active tmux sessions with name (`S-XXXX`), attached/detached status, and window count. Refreshes on demand.
* **Intelligent Status Indicator:** A color-coded dot tracks session count thresholds in real time (vivid green = ok, amber = 11–20, red = 21+).
* **Multi-Client Takeover:** Instantly attach to sessions in use elsewhere by kicking stale device connections with the amber `Takeover` button.
* **Per-Session Kill:** Remove any individual session with a single click without disturbing others.
* **Sweep Zombies:** Identifies and terminates detached tmux sessions — those with no active client connected from any device. Sessions that are attached (phone, tablet, or any other browser) are never touched, regardless of which device triggers the sweep.
* **Kill All (Confirmed):** Two-click confirmation flow to clear all tmux sessions and reset the server.
* **Kill-on-Close Toggle:** Controls whether closing a terminal tab terminates (`on`) or detaches (`off`) the underlying tmux session. Defaults to **off** so background work survives browser closure.
* **Auto-Sweep on Startup:** Optionally clears orphaned sessions automatically each time the backend restarts.
* **Scrollback Buffer Control:** Configurable slider (2,000–100,000 lines) per session for fine-tuning memory vs. history depth.
* **Escape-Time Tuning:** Direct escape-time ms control for optimal `vim`/`neovim` responsiveness, applied to the live server immediately.

---

## File Management & Archiving

The Sovereign Terminal GUI Explorer provides two distinct file management workflows directly in the interface:

1. **Permanent Delete (`Trash2` Icon):** Executes a standard, unrecoverable removal that matches native operating system commands (e.g., `rm`). Items deleted this way are permanently destroyed.
2. **Archive to Trash (`FolderMinus` Icon):** Safely moves the selected files or directories into a local `_temp_trash` directory, preserving them for potential recovery.

> [!WARNING]
> **Deletion is Final:** The standard delete button bypasses the archive functionality. Please exercise caution when choosing to permanently delete files.

---

## Quick Start Deployment

Sovereign Terminal deployment is defined by two separate concepts: **Deployment Architecture** (where it runs) and **Authentication Mode** (how you log in).

### Configuration Workflow (`.env` vs `docker-compose.yml`)

The repository includes a version-controlled configuration template named `.env.example`. Create your local `.env` configuration file from this template:

```bash
cp .env.example .env
```

`docker-compose.yml` uses environment variable substitution with fallbacks (`${VARIABLE:-fallback}`), automatically loading settings defined in `.env`. For detailed deployment matrix specifications, see [USER_GUIDE.md](documentation/USER_GUIDE.md).

#### Section 1: Option A (Sandbox) + Token Mode (The Default)

This is the simplest method for getting started immediately. The terminal runs in a fully isolated container and authenticates with a simple token.

**Compose Specification (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${CONTAINER_NAME:-sovereign-terminal}
    restart: unless-stopped
    ports:
      - "${PORT:-2069}:${PORT:-2069}"
    environment:
      - PORT=${PORT:-2069}
      - AUTH_MODE=${AUTH_MODE:-token}
      - SERVER_AUTH_TOKEN=${SERVER_AUTH_TOKEN:-1234}
      - DEPLOYMENT_MODE=${DEPLOYMENT_MODE:-sandbox}
      - PYTHONUNBUFFERED=1
      - SOVEREIGN_ROOT=/workspace
      - SAFE_TRASH_MODE=${SAFE_TRASH_MODE:-true}
      - ENABLE_PERMANENT_DELETE=${ENABLE_PERMANENT_DELETE:-false}
      - TZ=${TZ:-America/Chicago}
    volumes:
      - ${HOST_WORKSPACE_PATH:-./}:/workspace
      - /etc/localtime:/etc/localtime:ro
      - sovereign-terminal-data:/root/.local/share/sovereign-terminal

volumes:
  sovereign-terminal-data:
```

**Quick Start Steps:**
1. Copy `.env.example` to `.env`: `cp .env.example .env`
2. Configure `SERVER_AUTH_TOKEN` in `.env` with a strong cryptographic secret.
3. Launch container: `docker compose up -d`
4. Access `http://localhost:2069` and log in with your configured token.

For PAM modes, Host Passthrough, external drive mounting (`/mnt`, `/media`), and True Baremetal installation steps, consult the complete [USER_GUIDE.md](documentation/USER_GUIDE.md).

---

## HTTPS, Tailscale & Remote Access

Sovereign Terminal runs HTTP on port `2069` by default. To unlock Web Speech API microphone dictation on mobile devices and browsers, secure HTTPS access is required.

* **Tailscale (Recommended for Mobile Voice)**: Execute `tailscale serve https / http://127.0.0.1:2069` on your host machine to get instant, free Let's Encrypt certificates for your MagicDNS `.ts.net` address.
* **Reverse Proxies & Tunnels**: Supports Nginx Proxy Manager, Caddy, Cloudflare Tunnels (`cloudflared`), and local `mkcert` SAN certificates.
* **Security & Privacy**: Zero network scanning, zero background probing, and zero external telemetry. All session data remains 100% local.

---

## License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
