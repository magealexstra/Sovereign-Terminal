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
* **True Multi-Device Persistence:** Multi-session tab bar supporting concurrent persistent sessions. Close your phone browser, open a tablet, authenticate via PAM, and resume exactly where you left off.
* **Zombie-Proof Sessions:** Advanced PTY session tracking prevents orphaned connections and guarantees accurate controlling terminal sizes across device hand-offs.
* **Gboard Voice Engine:** Continuous Voice Activity Detection (VAD) dictation with real-time transcript diffing.
* **Quick Sudo Entry Macro:** Single-tap encrypted sudo password entry satisfying `[sudo]` prompts without exposing plain text on screen.
* **Master Red `MACROS` Launcher:** Pinned bright red catalog launcher granting instant access to the full command toolkit library.
* **Touch Scrollback & Copy-on-Select:** Swiping up/down scrolls history smoothly; text selection automatically copies content to system clipboard.
* **Port Decoupling & Host Auto-Resolution:** Fully decoupled REST and WebSocket architecture (`PORT=2069` by default) with relative `/api/fs/...` paths.
* **Live Session Count Badge:** Displays the number of active tmux sessions on the terminal tab bar. The badge changes color automatically — green (1–10), amber (11–20), and red (21+) — so you always know how many background sessions are consuming resources.
* **Host Pass-Through Mode:** Supports seamless integration and control of native host tmux sessions directly from the containerized UI.

### 2. GUI File Explorer & CodeMirror 6 Multi-Document Editor
* **Terminal Directory Sync:** File tree automatically synchronizes with the active terminal working directory.
* **Interactive Breadcrumbs:** Tap-based directory navigation (e.g., `~/projects` > `docs` > `things`).
* **Universal Language Highlighting:** CodeMirror 6 syntax highlighting supporting Python, JavaScript, C, C++, Rust, HTML, CSS, XML, SQL, JSON, Markdown, Shell, Dockerfile, and configuration formats.
* **Native Touch Integration:** Native OS selection handles, magnifying glass, and context menus (`Copy`, `Cut`, `Paste`).
* **Unsaved File Safeguards:** Modal dialog on tab close with explicit options (`[ Save & Close ]`, `[ Discard ]`, `[ Cancel ]`).
* **Automated Git Commit Macro:** Auto-detects Git repository root and executes staging and commit sequences.
* **Universal Binary Transfer:** Direct bidirectional phone-to-server transfer supporting images, archives, audio, 3D models, and PDFs, with on-the-fly zip archive streaming for multi-file downloads.
* **Configurable Trash Protection:** Safe trash mode moves deleted files to `./_temp_trash/` by default. Permanent removal can be enabled via `ENABLE_PERMANENT_DELETE=true` in `.env`.

### 3. Single-Bar Visual TouchBar Editor (Settings Sub-Tab 3: Layout Builder)
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

### 5. Touch Button Studio & 100% Dynamic Theme Engine (Settings Sub-Tabs 1 & 2)
* **Fluid Flexbox Button Studio:** Dynamic proportional flex scaling across 4K displays, laptops, 12" tablets, fold phones, and smartphones.
* **Output & Function Card:** Button Name input + 3-line Function `<textarea rows={3} />`.
* **Size, Shape & Save Card:** Width/Height steppers, vertically stacked tap shape buttons (`Square`, `Round`, `Pill`), and pinned Save button.
* **Live Preset & Custom Dropdown:** Search bar input stacked above dropdown containing all pre-built layout commands and custom buttons.
* **100% Dynamic Theme Engine:** Zero hardcoded colors or emojis; all icons, buttons, borders, and modals dynamically recolor with 12 curated base-16 open-source themes (Dracula, Nord, Tokyo Night, Catppuccin, Solarized, Monokai, etc.).

### 6. TMUX Session Manager (Settings Sub-Tab 4)
* **Live Session List:** Displays all active tmux sessions with name, attached/detached status, and window count. Refreshes on demand.
* **Intelligent Status Indicator:** A color-coded dot tracks session count thresholds in real time (vivid green = ok, amber = 11–20, red = 21+).
* **Per-Session Kill:** Remove any individual session with a single click without disturbing others.
* **Sweep Zombies:** Identifies and terminates orphaned sessions that are no longer associated with any open terminal tab.
* **Kill All (Confirmed):** Two-click confirmation flow to clear all tmux sessions and reset the server.
* **Kill-on-Close Toggle:** Controls whether closing a terminal tab terminates (`on`) or detaches (`off`) the underlying tmux session. Defaults to **off** so background work survives browser closure.
* **Auto-Sweep on Startup:** Optionally clears orphaned sessions automatically each time the backend restarts.
* **Scrollback Buffer Control:** Configurable slider (2,000–100,000 lines) per session for fine-tuning memory vs. history depth.
* **Escape-Time Tuning:** Direct escape-time ms control for optimal `vim`/`neovim` responsiveness, applied to the live server immediately.

---

## File Safety & Trash Policy

By default, file deletion within the File Explorer follows **Safe Trash Mode**, moving deleted items to `./_temp_trash/` instead of executing unrecoverable removal.

To enable permanent deletion, update `.env`:

```env
# Enable Permanent Deletion (Bypasses _temp_trash)
SAFE_TRASH_MODE=false
ENABLE_PERMANENT_DELETE=true
```

---

## Quick Start Deployment

Sovereign Terminal deployment is defined by two separate concepts: **Deployment Architecture** (where it runs) and **Authentication Mode** (how you log in).

### Overview of Deployment Matrices

Sovereign Terminal offers two primary Authentication Modes (Token vs. PAM) combined with three primary Deployment Architectures (Option A: Sandbox, Option B: Host Passthrough, Option C: True Baremetal). This results in 5 possible installation matrices.

* **Token Mode:** The simple default. Log in with a single `SERVER_AUTH_TOKEN`.
* **PAM Mode:** The advanced mode. Log in with your Linux OS user. Enables true multi-device resume via persistent background `tmux` sessions.

#### Section 1: Option A (Sandbox) + Token Mode (The Default)

This is the simplest method for getting started immediately. The terminal runs in a fully isolated container and authenticates with a simple token.

**Code:** (This is the default `docker-compose.yml` provided in the repository)
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - AUTH_MODE=token
      - SERVER_AUTH_TOKEN=1234
      - PORT=2069
      - SOVEREIGN_ROOT=/workspace
    volumes:
      - ./:/workspace
```
**Explanation:**
1. Run `docker compose up -d` in your terminal.
2. Open your browser and log in with the default token: `1234`.
3. **IMPORTANT:** For prolonged usage, change `SERVER_AUTH_TOKEN` in `docker-compose.yml` (and `.env`) to a strong cryptographic string and run `docker compose up -d` again to apply the changes.

#### Section 2: Option A (Sandbox) + PAM Mode (Internal Users)

This runs the isolated sandbox, but uses PAM authentication against test users *inside* the container for testing multi-device persistence without touching your host machine.

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - AUTH_MODE=pam
      - PORT=2069
      - SOVEREIGN_ROOT=/workspace
    volumes:
      - ./:/workspace
```
**Explanation:** 
1. Open `Dockerfile` and uncomment `# RUN useradd -m -s /bin/bash testuser && echo "testuser:password" | chpasswd`.
2. Update your `docker-compose.yml` to the block above, changing `AUTH_MODE` to `pam`.
3. Build and launch: `docker compose up -d --build`.
4. Log in with user `testuser` and password `password`.

#### Section 3: Option B (Host Passthrough) + Token Mode

This option maps your host OS's filesystem and `tmux` environment into the container, giving you control over your real system while still protecting the web UI with a simple token login.

> **WARNING: Host Control**
> In `pass-through` mode, Sovereign Terminal's UI actively controls the host's local tmux server. Creating, killing, or sweeping sessions in the web UI will affect your host machine directly!

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=3.6 # MUST MATCH YOUR HOST tmux -V
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=/tmp/tmux-1000/default
      - AUTH_MODE=token
      - SERVER_AUTH_TOKEN=1234
      - PORT=2069
      - SOVEREIGN_ROOT=/workspace
    volumes:
      - ./:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /home:/home
```
**Explanation:** 
1. Check your host's tmux version with `tmux -V` and set `TMUX_VERSION` accordingly.
2. The `/tmp/tmux-1000` volume allows the container to attach to your host's native tmux.
3. Replace `1234` with a secure token!

#### Section 4: Option B (Host Passthrough) + PAM Mode

The ultimate containerized sovereign workstation. Manages your host system and authenticates using your actual host Linux user account.

> **WARNING: Host Control**
> As with Option B Token Mode, Sovereign Terminal's UI actively controls the host's local tmux server in `pass-through` mode. Modifying sessions in the UI will affect your host machine directly!

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=3.6
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=/tmp/tmux-1000/default
      - AUTH_MODE=pam
      - PORT=2069
      - SOVEREIGN_ROOT=/workspace
    volumes:
      - ./:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /etc/passwd:/etc/passwd:ro
      - /etc/shadow:/etc/shadow:ro
      - /etc/group:/etc/group:ro
      - /home:/home
```
**Explanation:** 
We mount `/etc/passwd`, `/etc/shadow`, and `/etc/group` in read-only mode so the container can authenticate against your host Linux users directly via PAM. Match `TMUX_VERSION` to your host, build, and deploy.

> **CRITICAL SETUP REQUIREMENT**
> For Pass-through to work correctly, you **MUST** have an active `tmux` server running natively on your host machine before logging into Sovereign Terminal. If the host socket (`/tmp/tmux-1000/default`) is empty, the container will automatically spawn its own `tmux` server on that socket. Because that new server is spawned by the container, it will run inside the container's isolated filesystem (giving you a containerized shell rather than your host shell).
> 
> To prevent this, ensure a host session is running: `tmux -S /tmp/tmux-1000/default new -d -s host-session`

#### Section 5: Option C (True Baremetal Execution)

Run the backend natively on your host OS. Bypasses Docker completely for absolute native integration. No container layer means direct access to all system binaries, user permissions, and host networking interfaces.

**Code:**
```bash
# Install system dependencies (Debian/Ubuntu example)
sudo apt update && sudo apt install -y python3 python3-pip tmux nodejs npm

# Install Python backend dependencies
cd server && pip install -r requirements.txt

# Install frontend dependencies and build
cd .. && npm install && npm run build

# Configure environment natively
cp .env.example .env
# Edit .env and set AUTH_MODE=token or AUTH_MODE=pam

# Run the Python Gateway natively
cd server
python3 -m uvicorn main:app --host 0.0.0.0 --port 2069
```
**Explanation:** 
The application reads `.env` directly from the local file system. Set `AUTH_MODE` natively and run Uvicorn. Ensure you manage the Uvicorn process with `systemd` or similar for production persistence.

## HTTPS, Tailscale & Remote Access

Sovereign Terminal runs HTTP on port `2069` by default. To unlock Web Speech API microphone dictation on mobile devices and browsers, secure HTTPS access is required.

* **Tailscale (Recommended for Mobile Voice)**: Execute `tailscale serve https / http://127.0.0.1:2069` on your host machine to get instant, free Let's Encrypt certificates for your MagicDNS `.ts.net` address.
* **Reverse Proxies & Tunnels**: Supports Nginx Proxy Manager, Caddy, Cloudflare Tunnels (`cloudflared`), and local `mkcert` SAN certificates.
* **Security & Privacy**: Zero network scanning, zero background probing, and zero external telemetry. All session data remains 100% local.


For full step-by-step setup guides, consult [`docs/HTTPS_AND_NETWORKING_GUIDE.md`](docs/HTTPS_AND_NETWORKING_GUIDE.md) in the repository.

---

## License & Copyright

Distributed under the **MIT License**.

`Copyright (c) 2026 Daniel Hall (OmniState, a DBA of The Faction LLC)`
