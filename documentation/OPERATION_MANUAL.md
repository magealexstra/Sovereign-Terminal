# Sovereign Terminal — Operation Manual

Welcome to **The Sovereign Terminal**, a touch-controlled, mobile-first Linux server management workstation. This manual serves as the definitive in-app guide for using the interface.

---

## Section 1: Header Navigation & Session Management

The main navigation bar at the top of the interface allows you to switch between the core workstation views:

* **Terminal (Tab 1):** Your primary command-line interface with multi-session `tmux` tab support.
* **Files (Tab 2):** Dual-pane File Explorer and Code Editor, synchronized with your terminal's working directory.
* **Settings (Tab 3):** The Settings Studio for customizing themes, macro buttons, TouchBar layouts, and `tmux` server behavior.

### Session Controls & Unique Identifiers
* **Session Brand Hitbox:** In the top-left corner of the header is the **SOVEREIGN TERMINAL** brand hitbox. Tapping this logo opens the Session Controls menu, displaying your active authentication mode (Linux OS PAM or Token) and the **LOGOUT SESSION** button.
* **Compact Session Chips (`S-XXXX`):** Active terminal tabs display their unique 4-character session ID (e.g. `S-4atx`, `S-9flh`) directly on the tab chip for instant multi-tab recognition on compact mobile screens.
* **Multi-Client Isolation:** When opening Sovereign Terminal on a new device, the system automatically checks for existing attached sessions and creates a dedicated fresh session, preventing accidental client collisions across devices.

---

## Section 2: Right-Edge Collapsible Copy Suite (`CopyCard`) & Canvas Routing

Flushed against the right edge of the terminal viewport is the vertical tri-color Copy Suite (`CopyCard`). In its collapsed state, it appears as a subtle 6px vertical handle. Tapping the handle slides out the full panel without dismissing your mobile soft keyboard or causing viewport shifts:

* **COPY (Sage Green):** Copies the output of the most recent terminal command.
* **ALL (Glacier Blue):** Copies the entire visible screen scrollback buffer.
* **CUST (Nordic Red):** Copies a specified number of scrollback lines (defaulting to 50 lines). You can customize this target line count in Settings -> Studio.

### Destination Toggle Pill
At the bottom of the `CopyCard` panel is an interactive destination toggle:
* **`[ CLIP ]`**: Copies selected text directly to your device's system clipboard.
* **`[ CODE ]`**: Pipes copied terminal output directly into a new `Inspect` tab inside the CodeMirror Editor (Tab 2). This allows you to inspect, search, or edit terminal outputs in a full code editor.

### Canvas Tap-Redirect Toggle
Tapping anywhere on the empty terminal canvas automatically routes your interaction according to your preference:
* **Stager Mode (Default):** Opens the Command Stager drawer for composing commands without triggering mobile keyboard shifts.
* **Terminal Focus Mode:** Directly focuses the underlying `xterm.js` terminal prompt.

---

## Section 3: The TouchBar, Dictation & Command Stager

Located at the bottom of the screen is the customizable TouchBar, engineered for rapid mobile and tablet input:

* **Mic Button:** Activates in-browser Web Speech API voice dictation for speaking commands directly (requires an HTTPS connection or `localhost`).
* **Command Stager Launcher (Edit Icon):** Opens the TouchBar-anchored Command Stager drawer.
* **Master Red `MACROS` Button:** Opens the complete library of categorized macro command toolkits (`AGY`, `APT`, `GIT`, `SYS`, `DOC`, `DEV`, `PAM`, etc.) for one-tap execution of complex shell workflows.

### Command Stager Capabilities
1. **Direct Mode vs. Two-Step Mode:**
   - **Direct Mode:** Pressing Send & Execute transmits and executes commands immediately.
   - **Two-Step Mode:** Loads commands into the stager for editing before manual transmission.
2. **Persistent FIFO Command History:**
   - All executed commands are automatically saved to persistent local storage (up to 1,000 commands).
   - Use the **Up** and **Down** arrow buttons in the Stager footer to cycle through previous commands.
   - Restoring a previous command automatically places your cursor at the end of the text.
3. **3-Second History Purge:**
   - Single tap on **CLEAR** empties the current textarea draft.
   - Press and hold **CLEAR** for 3 seconds to wipe entire stored command history.
4. **Offline Reconnection Safeguard:**
   - If sending a command while your mobile connection is waking up, a non-blocking toast notifies you (`Terminal reconnecting — please retry`) and safely preserves your typed draft in the stager.

> **PRO TIP: Mobile Keyboard Dictation (Recommended for HTTP)**
> If accessing Sovereign Terminal over local network HTTP (without SSL certificates), use your device's native soft keyboard dictation (e.g., Gboard mic or Samsung voice input) inside the **Command Stager** drawer. Because speech-to-text conversion is handled natively by your keyboard app, it completely bypasses browser Web Speech API / HTTPS certificate requirements, allowing smooth voice input on any connection!

---

## Section 4: File Explorer & Code Editor (Tab 2)

Tab 2 provides a touch-optimized file workspace with two sub-tabs:

* **File Explorer (`Files` Sub-Tab):** Synchronizes automatically with your terminal session's working directory (`cwd`). Supports browsing, creating, deleting, and selecting files.
* **Code Editor (`Editor` Sub-Tab):** Multi-document CodeMirror editor featuring:
  * **Language Badges & Tab Navigation:** Color-coded document tabs for code files and virtual `Inspect` tabs generated via the `CopyCard`.
  * **Touch Scrolling:** Smooth momentum scrolling optimized for mobile and tablet touch displays.
  * **RUN Action Button:** Single-tap execution of the active file (`python`, `bash`, `node`) directly in your live terminal session. If unsaved changes exist, a **Save & Run** confirmation modal prompts for instant save and execution.
  * **Editor Action Row:** Includes **RUN** (executes file in terminal), **SAVE** (writes to disk), **SAVE & COMMIT** (saves and executes git commit), **SAVE AS** (prompts for disk location when saving virtual inspect tabs), **COPY ALL** (copies document text), and **CLOSE** (closes document tab with unsaved changes prompt).

---

## Section 5: Settings Studio (Tab 3)

The Settings Studio provides deep customization across four dedicated sub-tabs:

### 1. Themes (`ThemeSettings`)
* **Visual Presets:** Switch between 12 curated dark and high-contrast color themes.
* **Font Scaling:** Adjust terminal and code editor font sizes dynamically via sliders, ranging from 6px (dense view) to 20px (large readability).

### 2. Studio (`ButtonStudio`)
* **Macro Customization:** Customize macro button shapes (Square, Round, Pill), colors, labels, and command strings.
* **Tactile Execution Mode Toggle:** Single-state button toggles between **`EXECUTE`** (direct PTY injection with green accent) and **`STAGE`** (routes to Stager with violet accent).
* **Reliable Sizing Steppers:** Stepper controls (`+` / `-`) for exact button width and height in rem units.
* **Custom Copy Value:** Edit the target line count for the `CUST` button in the `CopyCard` (e.g. change default from 50 to 100 or 500 lines).

### 3. Layout (`LayoutBuilder`)
* **TouchBar Builder:** Re-order and swap slot assignments on your TouchBar using an intuitive 2-tap add/move workflow.

### 4. TMUX (`TmuxManager`)
* **Server Health Indicator:** Displays real-time `tmux` server connectivity and active session counts.
* **Session Manager:** Lists active and detached `tmux` sessions on the server with one-tap controls:
  * **Attach:** Attaches a detached `tmux` session directly as an active terminal tab in Tab 1.
  * **Takeover:** If a session is actively attached to another device, an amber **Takeover** button allows you to forcefully disconnect the other client and take over the session on your current device.
  * **Kill Session (`X`):** Terminates the targeted `tmux` session.
  * **Sweep Zombies:** Kills all tmux sessions that are detached — no active client connected from any device. Sessions that are attached (open on a phone, tablet, or any other browser) are never touched, regardless of which device triggers the sweep.
* **Behavior Settings:**
  * **Kill on Close:** Toggle whether closing a terminal tab kills the underlying `tmux` session or detaches it (default: detach).
  * **Auto-Attach AGY Subagents:** Automatically spawns new terminal tabs when background subagents are detected.
* **Performance Controls:**
  * **Scrollback Buffer Slider:** Adjust session history buffer depth (2,000 to 100,000 lines).
  * **Escape-time Input:** Adjust key sequence delay in milliseconds (0–10ms recommended for Vim/Neovim responsiveness).
