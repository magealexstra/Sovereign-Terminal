# Sovereign Terminal — Categorized Command Toolkits & Macro Suites

This document serves as the complete reference manual for all pre-built command toolkits, AI agent macro suites, mobile operator keys, and TouchBar customization components in **The Sovereign Terminal**.

---

## Source Code & Implementation Architecture

The TouchBar macro engine, preset libraries, and customization tools are implemented across the following source code components:

* **[buttonData.js](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/button-studio/buttonData.js)**: Defines the static preset arrays (`PREBUILT_CATEGORIES`), default TouchBar slots (`DEFAULT_BUTTONS`), and mobile operator key bundles (`KEY_NAV_PRESETS`, `KEY_FN_PRESETS`, `KEY_SYM_PRESETS`, `KEY_MODE_PRESETS`, `KEY_LINE_PRESETS`).
* **[TouchBar.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/terminal/TouchBar.jsx)**: Renders the persistent bottom TouchBar, master red `MACROS` drawer, voice dictation engine, and command execution handlers.
* **[ButtonStudio.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/ButtonStudio.jsx)**: Provides the interactive Button Studio UI (Settings -> Sub-Tab 2) for creating, sizing, coloring, and editing individual macro buttons.
* **[LayoutBuilder.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/LayoutBuilder.jsx)**: Provides the 2-tap slot assignment interface (Settings -> Sub-Tab 3) for reordering and configuring TouchBar button layouts.
* **[StagingDrawer.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/terminal/StagingDrawer.jsx)**: Anchored command staging drawer for reviewing, editing, and appending text (spoken or typed) prior to shell execution.

---

## 1. AI Agent Suites

Sovereign Terminal includes one-tap macro suites for major autonomous AI coding agents:

### `AGY` (Google Antigravity CLI)
* **`agy`**: Launches the Antigravity CLI session (`agy\n`).
* **`/model`**: Switches active LLM model or opens interactive picker (`/model\n`).
* **`/plan`**: Initiates autonomous planning workflow (`/plan\n`).
* **`/schedule`**: Schedules background timers or recurring crons (`/schedule\n`).
* **`/goal`**: Enforces long-running autonomous execution (`/goal\n`).
* **`/grill-me`**: Launches interactive planning interview (`/grill-me\n`).
* **`/teamwork`**: Spawns multi-agent task collaboration (`/teamwork-preview\n`).
* **`/learn`**: Inspects recent interactions and proposes learned rules/skills (`/learn\n`).
* **`update agy`**: Updates Antigravity CLI (`agy update\n`).
* **`/clear`**: Resets conversation context (`/clear\n`).
* **`^O` / `^K`**: Keyboard shortcuts (`\x0f`, `\x0b`).

### `CLD` (Claude CLI)
* **`claude`**: Launches Claude Code CLI (`claude\n`).
* **`/compact`**: Compacts conversation history (`/compact\n`).
* **`/cost`**: Displays session token cost (`/cost\n`).
* **`/doctor`**: Runs environment diagnostics (`/doctor\n`).
* **`/help`**: Shows command help (`/help\n`).
* **`/init`**: Initializes project configuration (`/init\n`).
* **`/bug` / `/review`**: Submits bug reports or code reviews (`/bug\n`, `/review\n`).
* **`update cld`**: Updates Claude package (`npm update -g @anthropic-ai/claude-code\n`).
* **`/clear`**: Resets conversation context (`/clear\n`).

### `HMS` (Hermes Agent)
* **`hermes`**: Launches Hermes AI agent (`hermes\n`).
* **`/status` / `/reset` / `/tools` / `/logs` / `/cancel`**: Agent management directives (`\n`).
* **`/config` / `/memory` / `/mcp`**: Configuration, memory, and MCP server management (`\n`).
* **`update hms`**: Updates Hermes package (`pip install --upgrade hermes-agent\n`).
* **`/clear`**: Clears agent context (`/clear\n`).

---

## 2. Package Manager Toolkits

Provides single-tap execution for system updates, package searches, installs, and dependency cleanups across major Linux distributions:

* **`APT` (Debian / Ubuntu / Raspbian)**:
  * `upgrade -y`: `sudo apt update && sudo apt upgrade -y\n`
  * `apt update` / `apt search` / `apt install` / `apt purge` / `autoremove` / `apt clean` / `dpkg -l`
* **`PAC` (Arch Linux / Manjaro)**:
  * `upgrade -y`: `sudo pacman -Syu\n`
  * `pacman install` / `pacman search` / `pacman remove` / `pacman clean` / `pacman list`
* **`YUM` (Fedora / RHEL / Rocky Linux)**:
  * `upgrade -y`: `sudo dnf upgrade --refresh -y\n`
  * `dnf update` / `dnf install` / `dnf search` / `dnf remove` / `autoremove` / `dnf clean`
* **`NPM` (Node.js & Web Development)**:
  * `npm install` / `npm run dev` / `npm run build` / `npx` / `yarn add` / `node -v`

---

## 3. DevOps, Containers & System Administration

* **`DOC` (Docker Suite)**:
  * `docker ps` / `docker ps -a` / `compose up` (`docker compose up -d\n`) / `compose down` / `compose logs` / `docker exec` / `prune -f` / `docker images`
* **`TMX` (Tmux Manager)**:
  * `tmux ls` / `tmux new` / `tmux attach` / `tmux kill` / `split h` (`Ctrl+B %`) / `split v` (`Ctrl+B "`)
* **`GIT` (Git Version Control)**:
  * `git status` / `git log -10` / `git add .` / `git commit` / `git push` / `git pull` / `git checkout` / `git diff`
* **`SYS` (System & Disks)**:
  * `systemctl` / `restart srv` / `journalctl` / `lsblk` / `blkid` / `df -h` / `du -sh *` / `fdisk -l` / `dmesg -T` / `htop` / `free -h` / `top` / `uptime`
* **`FILE` (Permissions & Archives)**:
  * `chmod +x` / `chmod 755` / `chmod 644` / `chown -R` / `chgrp -R` / `mkdir -p` / `find . -name` / `rsync -avz` / `tar -czvf` / `tar -xvf` / `unzip`
* **`NET` (Networking Tools)**:
  * `ip a` / `ping` / `netstat` / `ss -tulpn` / `ufw status` / `curl -I` / `dig` / `traceroute`
* **`PY` (Python & Virtual Environments)**:
  * `python3` / `pip install` / `venv create` / `venv activate` / `pip list` / `pip freeze` / `python3 REPL` / `exit`
* **`TXT` (Search & Text Parsing)**:
  * `grep -rnw` / `find name` / `tail -f` / `watch` / `cat` / `head` / `nano`
* **`VIM` (Vim Text Editor)**:
  * `:w` / `:q` / `:wq` / `:q!` / `:w!` / `:x` / `^R` / `:%s/` / `:e!` / `:set nu`

---

## 4. Mobile Operator & Navigation Keys

To eliminate awkward mobile touch input, the `KEY` and `NAV` toolkits provide stacked touch keys for shell operators and control signals:

* **Shell Operators (`KEY` / `SYM`)**:
  * `|`, `~`, `>`, `>>`, `<`, `&&`, `||`, `;`, `` ` ``, `\`, `/`, `-`, `$`, `#`
* **Control Signals & Escapes (`KEY` / `MODE`)**:
  * `ESC` (`\x1b`), `TAB` (`\t`), `DEL` (`\x1b[3~`), `^C` (Cancel `\x03`), `^Z` (Suspend `\x1a`), `^D` (EOF `\x04`)
* **Cursor & Line Operations (`KEY` / `LINE`)**:
  * `^A` (Home), `^E` (End), `^K` (Cut to end), `^U` (Cut to start), `^W` (Delete word), `^Y` (Paste), `^R` (History search), `^L` (Clear screen)
* **Navigation & Function Keys (`NAV`)**:
  * Arrow Keys (`▲`, `▼`, `◀`, `▶`), `PgUp`, `PgDn`, `Home`, `End`, `Ctrl+Left`, `Ctrl+Right`, `Shift+Tab`, `Backspace`, `⏎` (Return), `F1`–`F12`

---

## 5. Customizing Buttons in Settings

You can fully customize your TouchBar layout and create custom macro buttons:

1. **Creating Custom Buttons (Settings -> Buttons tab)**:
   * Define **Name**, **Function / Payload**, **Execution Mode** (`EXECUTE` vs `STAGE`), **Width**, **Height**, **Shape** (Square, Rounded, Pill), and optional color swatches.
   * Default color inheritance ensures buttons dynamically match the active theme.
   * Tap **SAVE** in the top action header to commit changes to `localStorage` and sync with your server profile.
2. **Building TouchBar Layouts (Settings -> Layout tab)**:
   * Uses an intuitive 2-tap workflow: tap a button on the visual TouchBar strip, then tap any prebuilt or custom button in the pool to swap or insert it.
   * Tap **RESET** to revert the Primary layout or active prebuilt suite to factory defaults.
3. **Master Macro Modal Dual Routing**:
   * Open the Master Macro modal on the far right of the TouchBar.
   * Use the **STAGER / TERMINAL** toggle in the header:
     * **`TERMINAL`**: Executes commands directly into the active shell.
     * **`STAGER`**: Injects commands into the Command Stager drawer for review and voice dictation.
