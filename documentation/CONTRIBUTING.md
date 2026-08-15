# Contributing to Sovereign Terminal

First off, thank you for considering contributing to Sovereign Terminal! This project will only thrive through community collaboration, especially since dealing with mobile browser quirks (Safari) requires testing across many different devices.

## The Quest Board

We are actively asking the community for help with the following specific items:

### 1. iOS Safari / WebKit Voice Dictation & Input Glitches
* **The Problem:** iOS Safari has aggressive, non-standard behaviors when handling the Web Speech API and Gboard/iOS keyboard dictation interactions inside xterm.js canvas overlays. While the decoupled `Staging Drawer` (`src/components/terminal/StagingDrawer.jsx`) was deployed to isolate dictation from canvas scroll events, subtle mobile Safari quirks may remain.
* **The Quest:** We need developers with physical iPhones and iPads to test the `Staging Drawer` and the TouchBar. If you know how to defeat Safari's scroll-anchoring quirks, visual viewport resize shifts, or Web Speech API silence timeouts, PRs and feedback are welcome!

### 2. Claude Code & Hermes Subagent Action Approval Hotkey
* **The Problem:** The AGY (Antigravity) suite includes a `^K` button that approves a pending subagent action when AGY freezes and asks for explicit permission before executing a tool call. We need the equivalent hotkey for Claude Code (`claude`) and Hermes (`hermes`) — the specific key that unfreezes the CLI when it is waiting at a "Allow this action?" prompt for a specific tool call. This is distinct from Claude's `Shift+Tab` mode cycling (which pre-approves all future actions). If you actively use `claude` or `hermes` CLI and have triggered this approval state, the exact key(s) to press are what we need.
* **The Quest:** Test a Claude Code or Hermes session, trigger a tool/subagent action that requires manual approval, observe what key the CLI instructs you to press, and open a PR adding that key as a button to the `CLD` or `HMS` suite in `src/components/terminal/TouchBar.jsx` and its mirror entry in `src/components/settings/button-studio/buttonData.js`.

### 3. Theme Alignment & Color Palette Harmonization
* **The Problem:** Several built-in theme presets in `src/context/themePresets.js` have misaligned surface colors (`bgEarth`, `bgCanopy`, `bgPanel`, `bgGrove`), uncalibrated contrast ratios for muted/dim text (`textMuted`, `textDim`), or ANSI terminal color mappings that clash with active UI surfaces. Furthermore, select component styles still rely on hardcoded color values rather than referencing CSS design tokens from `src/styles/tokens.css`.
* **The Quest:**
  * Audit and tune preset palettes in `src/context/themePresets.js` to ensure balanced contrast, legible syntax highlighting, and accurate surface tiering across all themes (Vitni Nordic, Dracula, OneDark, Catppuccin Mocha, Nord, Tokyo Night, Monokai Pro, Cyberpunk 2077, Solarized Dark, Gruvbox Dark, etc.).
  * Eliminate lingering hardcoded hex/rgba color values in `src/styles/` by routing them through semantic CSS custom properties (`var(--bg-earth)`, `var(--bg-canopy)`, `var(--border-forest)`, `var(--status-confirm)`, etc.).
  * Ensure full visual cohesion between the xterm.js canvas ANSI palette and the surrounding UI shell components (touchbar, session drawer, copy cards, code editor, and modals).



## How to Submit a Pull Request

1. Fork the repository and create your branch from `main`.
2. Ensure you are running locally on port `2069` using `docker compose up --build`.
3. Test your changes thoroughly on **both** Desktop and Mobile (using Chrome DevTools device mode, or a physical device on your LAN).
4. Update the `README.md` or `USER_GUIDE.md` if your change adds new functionality.
5. Submit the PR with a clear description of the problem solved and a screenshot/video if it is a UI change.

## Bug Reports

Please use the GitHub Issues tab to report bugs. Include:
* Your device model and OS version.
* Your browser (Chrome, Safari, Firefox).
* The Docker host OS (Android, iOS, Manjaro ARM, postmarketOS, Mobian, or Ubuntu Touch)
* Steps to reproduce the bug.

Welcome to the Faction. We're excited to build with you!
