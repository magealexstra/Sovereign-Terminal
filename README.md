# <img src="public/favicon-48x48.png" width="48" height="48" align="left" alt="OmniState Logo"/> The Sovereign Terminal
<br/>

> **NOTICE: THIS APPLICATION IS CURRENTLY UNDER ACTIVE DEVELOPMENT**  
> *The Sovereign Terminal is actively being built and refined. Features, design specs, and APIs are evolving rapidly.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20%7C%20POSIX-orange.svg)]()
[![Container: Docker](https://img.shields.io/badge/Container-Docker%20Compose-blue)]()

---

## Overview

**The Sovereign Terminal** is an open-source, high-performance, system-agnostic web application designed to transform mobile phones and tablets into a complete, sovereign Linux server management workstation.

It pairs a fluid xterm.js terminal canvas with a GUI File Explorer, CodeMirror 6 text editor, highly customizable touch bars, single-handed mobile docking, dynamic theme engine, and a dedicated Python PTY backend gateway to replace traditional, rigid web terminals.

---

## Key Features

### 1. Multi-Tab Terminal Canvas & PTY Gateway
* **Universal Terminal Canvas:** Powered by `@xterm/xterm` with DOM/canvas fallback compatibility to eliminate mobile Safari crashes.
* **Multi-Device Persistence:** Support concurrent persistent sessions. Connect from a new device and authenticate via PAM to resume exactly where you left off.
* **Multi-Client Isolation & Takeover:** Connecting from a new device automatically isolates and creates a fresh session if existing sessions are attached elsewhere. Manual takeover is available in TMUX Settings.
* **Gboard Voice Engine & Command Stager:** Continuous Voice Activity Detection (VAD) dictation with persistent FIFO history memory.
* **Quick Sudo Entry Macro:** Single-tap encrypted sudo password entry.
* **Host Pass-Through Mode:** Seamless integration and control of native host tmux sessions directly from the containerized UI.

### 2. GUI File Explorer & CodeMirror 6 Multi-Document Editor
* **Terminal Directory Sync:** File tree automatically synchronizes with the active terminal working directory.
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting supporting Python, JavaScript, C, C++, Rust, HTML, CSS, XML, SQL, JSON, and Markdown.
* **Live File Execution (`RUN` Button):** Single-tap script execution directly in the active terminal tab.
* **Native Touch Integration:** Native OS selection handles and context menus.
* **Automated Git Commit Macro:** Auto-detects Git repository root and executes staging and commit sequences.
* **Universal Binary Transfer:** Direct bidirectional phone-to-server transfer.
* **File Viewer:** Built-in touch-enabled media playback for images, native HTML5 video/audio (with Plyr controls), and PDF viewing.
* **Safe Archiving:** Archive items to a local `_temp_trash` directory or delete permanently via the long-press/right-click context menu.

### 3. Touch Button Studio & Dynamic Theme Engine (Settings 1 & 2)
* **100% Dynamic Theme Engine:** Zero hardcoded colors or emojis; everything dynamically recolors with 12 curated base-16 open-source themes.
* **Fluid Flexbox Button Studio:** Dynamic proportional flex scaling across 4K displays, laptops, tablets, and smartphones.
* **Tactile Execution Mode Toggle:** Single-state button toggles between `EXECUTE` (direct PTY injection) and `STAGE` (routes to Stager).

### 4. Layout Builder (Settings 3)
* **Tap-Selection Workflow:** 2-tap add, move left/right, and delete interaction model for TouchBar customization.
* **Live TouchBar Strip:** 1:1 visual preview of the scrollable bottom TouchBar with real-time `localStorage` sync.
* **Categorized Toolkits:** Touchscreen access to 18+ categorized toolkits including AI Agent Suites, Package Managers, and System Tools.

### 5. TMUX Session Manager (Settings 4)
* **Live Session List:** Displays all active tmux sessions with name, status, and window count. Features an intelligent color-coded status indicator.
* **Multi-Client Takeover:** Attach to sessions in use elsewhere by kicking stale device connections.
* **Per-Session Kill & Sweep Zombies:** Remove individual sessions or terminate all detached sessions at once.
* **Kill-on-Close & Subagent Auto-Attach:** Control behavior for terminal tab closures and background AGY subagents.
* **Performance Tuning:** Configurable scrollback buffer and escape-time controls for optimal responsiveness.

---

## Quick Start Deployment

Sovereign Terminal runs in a fully isolated container and authenticates with a simple token by default.

Create your local `.env` configuration file from the template:

```bash
cp .env.example .env
```

**Compose Specification (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${CONTAINER_NAME:-sovereign-terminal}
    restart: "no"
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
      - ENABLE_HTTPS=${ENABLE_HTTPS:-false}
      - SSL_CERT_PATH=${SSL_CERT_PATH:-/etc/ssl/certs/fullchain.pem}
      - SSL_KEY_PATH=${SSL_KEY_PATH:-/etc/ssl/private/privkey.pem}
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 2G
    volumes:
      - ${HOST_WORKSPACE_PATH:-./}:/workspace
      - /etc/localtime:/etc/localtime:ro
      - sovereign-terminal-data:/root/.local/share/sovereign-terminal

volumes:
  sovereign-terminal-data:
```

**Steps:**
1. Configure `SERVER_AUTH_TOKEN` in `.env` with a strong cryptographic secret.
2. Launch container: `docker compose up -d`
3. Access `http://localhost:2069` and log in with your configured token.

For PAM modes, Host Passthrough, external drive mounting, and True Baremetal installation steps, consult the complete [USER_GUIDE.md](documentation/USER_GUIDE.md).

---

## HTTPS, Tailscale & Remote Access

Sovereign Terminal runs HTTP on port `2069` by default. To unlock Web Speech API microphone dictation on mobile devices and browsers, secure HTTPS access is required.

* **Tailscale (Recommended)**: Execute `tailscale serve https / http://127.0.0.1:2069` on your host machine to get instant, free Let's Encrypt certificates.
* **Reverse Proxies & Tunnels**: Supports Nginx Proxy Manager, Caddy, Cloudflare Tunnels, and local `mkcert`.
* **Security & Privacy**: Zero network scanning, zero background probing, and zero external telemetry. All session data remains 100% local.

---

## License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
