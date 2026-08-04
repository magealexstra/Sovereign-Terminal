# Sovereign Terminal — Custom TouchBar Button & Key Injection Guide

This document provides complete technical instructions for designing, configuring, and building custom TouchBar buttons, key injection macros, ASCII control signals, and ANSI escape sequences in **The Sovereign Terminal**.

---

## 1. Overview & Architecture

TouchBar buttons inject raw bytes directly into the terminal PTY WebSockets stream (`term.write()` / WebSocket send). When a button is pressed, its configured `value` string is processed and delivered to the underlying shell (`bash`, `zsh`, `tmux`, `python`, `htop`, `vim`).

### Storage Location & Persistence
* **LocalStorage**: Saved in the browser under `sovereign_custom_buttons` (JSON array of custom button objects) and active TouchBar layout slots under `sovereign_touchbar_buttons`.
* **Backend Profile Sync**: Automatically backed up to the server profile when authenticated.

### Source Code References
* **[buttonData.js](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/button-studio/buttonData.js)**: Contains static preset definitions (`PREBUILT_CATEGORIES`), default TouchBar layout (`DEFAULT_BUTTONS`), and pre-built key arrays (`KEY_NAV_PRESETS`, `KEY_FN_PRESETS`, `KEY_SYM_PRESETS`, `KEY_MODE_PRESETS`, `KEY_LINE_PRESETS`).
* **[ButtonStudio.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/ButtonStudio.jsx)**: The interactive visual button builder (Settings -> Sub-Tab 2).
* **[LayoutBuilder.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/settings/LayoutBuilder.jsx)**: The 2-tap slot assignment interface (Settings -> Sub-Tab 3).
* **[TouchBar.jsx](file:///home/magealexstra/TheWorkshop/Projects/Sovereign_Terminal/src/components/terminal/TouchBar.jsx)**: TouchBar rendering engine, macro drawer UI, and command execution handlers.

---

## 2. The 3 Types of Button Functions (`value` field)

When creating a button in **Settings -> Sub-Tab 2 (Studio)**, the string you enter into the **Function / Value** `<textarea>` determines how the shell processes the input:

### A. Auto-Executing Shell Commands (Command + Newline)
* **Rule**: Append `\n` (or `\r`) to the end of the command string.
* **Examples**:
  * `docker ps\n`
  * `git status\n`
  * `sudo apt update && sudo apt upgrade -y\n`
* **Behavior**: Pastes the command into the shell prompt and immediately presses Return to execute it.

### B. Staged Commands (Prefix / Unfinished Strings)
* **Rule**: Omit `\n` at the end of the string.
* **Examples**:
  * `git commit -m "`
  * `sudo apt install `
  * `docker exec -it `
* **Behavior**: Places the text string on the command prompt (or into the Command Stager drawer), leaving the cursor at the end so you can type additional arguments or use voice dictation before executing.

### C. Raw Key Injections (ASCII Control Characters & ANSI Escape Sequences)
* **Rule**: Use JavaScript hex/escape string notation (`\xHH`, `\t`, `\x1b`).
* **Behavior**: Simulates hardware key presses, terminal control signals (`Ctrl+C`, `Ctrl+Z`), navigation arrows, function keys, or editor shortcuts (`vim`, `tmux`, `htop`).

---

## 3. ASCII Control Characters & Terminal Signals (`Ctrl+Key`)

The table below details common ASCII control codes used for process management, text editing, and navigation:

| Desired Shortcut | Button Label | Function Value (`value`) | ASCII Code | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Cancel / Interrupt** | `^C` | `\x03` | `0x03` (ETX) | Sends `SIGINT` to interrupt/terminate running foreground process |
| **Suspend Job** | `^Z` | `\x1a` | `0x1A` (SUB) | Sends `SIGTSTP` to suspend running process and send to background |
| **EOF / Exit Shell** | `^D` | `\x04` | `0x04` (EOT) | Sends End-of-File signal; exits active shell session |
| **Cursor to Start** | `^A` | `\x01` | `0x01` (SOH) | Jumps cursor to line start (Bash/Zsh/Readline) |
| **Cursor to End** | `^E` | `\x05` | `0x05` (ENQ) | Jumps cursor to line end |
| **Cut to Line End** | `^K` | `\x0b` | `0x0B` (VT) | Deletes text from cursor to the end of line |
| **Cut to Line Start** | `^U` | `\x15` | `0x15` (NAK) | Deletes text from line start to the cursor |
| **Delete Word Back** | `^W` | `\x17` | `0x17` (ETB) | Deletes previous word behind cursor |
| **Yank / Paste Cut** | `^Y` | `\x19` | `0x19` (EM) | Pastes previously cut text buffer |
| **Reverse Search** | `^R` | `\x12` | `0x12` (DC2) | Triggers interactive shell history search |
| **Clear Screen** | `^L` | `\x0c` | `0x0C` (FF) | Clears terminal screen buffer |
| **Tmux Lead Key** | `Ctrl+B` | `\x02` | `0x02` (STX) | Default Tmux prefix (e.g., `\x02%` for horizontal split) |

---

## 4. ANSI / VT100 Escape Sequences Table

The table below lists ANSI escape sequences for cursor navigation, scrolling, function keys, and editor shortcuts:

| Key / Function | Button Label | Function Value (`value`) | Description |
| :--- | :--- | :--- | :--- |
| **Escape** | `ESC` | `\x1b` | Simulates hardware Escape key |
| **Tab** | `TAB` | `\t` | Tab completion key |
| **Shift+Tab** | `Shift+Tab` | `\x1b[Z` | Reverse tab navigation |
| **Arrow Up** | `▲` | `\x1b[A` | Move cursor up / previous command history |
| **Arrow Down** | `▼` | `\x1b[B` | Move cursor down / next command history |
| **Arrow Left** | `◀` | `\x1b[D` | Move cursor left |
| **Arrow Right** | `▶` | `\x1b[C` | Move cursor right |
| **Word Left (Ctrl+Left)**| `Ctrl+Left` | `\x1b[1;5D` | Jump cursor left by full word boundary |
| **Word Right (Ctrl+Right)**| `Ctrl+Right` | `\x1b[1;5C` | Jump cursor right by full word boundary |
| **Home Key** | `Home` | `\x1b[H` | Jump cursor to home position |
| **End Key** | `End` | `\x1b[F` | Jump cursor to end position |
| **Page Up** | `PgUp` | `\x1b[5~` | Scroll terminal window up |
| **Page Down** | `PgDn` | `\x1b[6~` | Scroll terminal window down |
| **Delete** | `DEL` | `\x1b[3~` | Delete character at/ahead of cursor |
| **F1 – F4 Keys** | `F1`–`F4` | `\x1bOP` .. `\x1bOS` | Virtual function keys F1 through F4 |
| **F5 – F12 Keys** | `F5`–`F12` | `\x1b[15~` .. `\x1b[24~` | Virtual function keys F5 through F12 |
| **Vim Save & Exit** | `:wq` | `\x1b:wq\n` | Sends `ESC`, types `:wq`, and presses Return |
| **Vim Force Quit** | `:q!` | `\x1b:q!\n` | Sends `ESC`, types `:q!`, and presses Return |

---

## 5. Step-by-Step Tutorial: Creating a Custom Button

Here is a step-by-step example of creating a custom button for `git push origin main`:

1. Open **Settings -> Sub-Tab 2 (Studio)**.
2. Under **Output & Function Card**:
   - Set **Button Name**: `git push`
   - Set **Function**: `git push origin main\n`
3. Under **Size, Shape & Save Card**:
   - Adjust **Width**: `4.0` (or desired flex width ratio)
   - Adjust **Height**: `2.0`
   - Select **Shape**: `Rounded` or `Pill`
   - Choose custom **Background**, **Text**, and **Border** colors if desired.
4. Click **Save Button**. The button is now saved and available in your custom button pool.
5. Open **Settings -> Sub-Tab 3 (Layout)**:
   - Tap any slot in your active TouchBar preview strip.
   - Tap your new `git push` button from the custom pool to assign it to that slot.

---

## 6. External Reference Material & Standards

For advanced terminal key code mapping and sequence standards, refer to these specifications:

* **[XTerm Control Sequences Reference](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html)** — Official specification for xterm ANSI control sequences.
* **[ASCII Control Code Table (0x00–0x1F)](https://en.wikipedia.org/wiki/C0_and_C1_control_codes)** — Detailed breakdown of ISO/IEC 6429 control codes.
* **[ECMA-48 Control Functions Standard](https://www.ecma-international.org/publications-and-standards/standards/ecma-48/)** — European standard for 8-bit code control functions.
