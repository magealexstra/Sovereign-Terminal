# Sovereign Terminal — User Guide & Mobile Operation Manual

Welcome to **The Sovereign Terminal**, a touch-controlled, mobile-first Linux server management workstation. This manual explains key touch gestures, navigation controls, custom settings, and session options.

---

## 1. Header Navigation & Session Controls

* **Main Navigation Bar:** Switch between **Terminal** (Tab 1), **File Explorer & Editor** (Tab 2), and **Settings Studio** (Tab 3).
* **Brand Logo & Session Popup:** Tapping the **SOVEREIGN TERMINAL** logo image or title in the top-left header toggles the active session pop-up menu.
  * **Session Status:** Displays your active authentication mode (Linux OS PAM or Token).
  * **Logout:** Tap **LOGOUT SESSION** to tear down WebSocket connections, erase session credentials, and return to a clean login screen.

---

## 2. Terminal & Left-Edge Copy Suite (`CopyCard`)

Pinned to the left edge above the TouchBar is the vertical 3-button Copy Suite:

* **COPY (Sage Green):** Copies the active terminal line to your selected destination.
* **ALL (Glacier Blue):** Copies the entire terminal scrollback buffer.
* **CUST (Nordic Red):** Copies a specified number of lines (default 50 lines). Tap the `CUST` button in Settings -> Button Studio to edit its target line count.
* **Destination Toggle Pill (Bottom of Card):** Tapping the pill at the bottom of the card toggles between:
  * **`[ CLIP ]`**: Copies text directly to the system clipboard.
  * **`[ CODE ]`**: Copies text into a new document tab inside the CodeMirror Editor.

---

## 3. TouchBar, Dictation & Command Stager

Located at the bottom of the screen is the customizable TouchBar:

* **Mic Button:** Tap to activate Gboard voice dictation.
* **Stager Launcher Button (Edit Icon):** Opens the TouchBar-anchored dictation & command staging drawer immediately above the TouchBar.
  * **Direct Mode:** Sends commands to terminal on tap.
  * **Two-Step Mode:** Allows reviewing and editing spoken or typed text before transmitting.
* **Quick Sudo Button `(***)`:** Appears when opted-in during PAM login. Transmits your session sudo password without exposing text.
* **Master Red `MACROS` Button:** Opens the complete library of categorized command toolkits (`AGY`, `CLD`, `HMS`, `APT`, `DOC`, `GIT`, `SYS`, `NET`, `PY`, `TMX`).

---

## 4. File Explorer & Code Editor

* **File Tree Sync:** Synchronizes with your active terminal working directory.
* **Multi-Document Tabs:** Displays open files with official language brand colors (Python Blue, JS Yellow, HTML Orange, CSS Blue, Shell Green, etc.).
* **Touch Scrolling:** Drag with your finger to scroll long code or Markdown documents smoothly with theme-adapting scrollbars.
* **Editor Touch Bar:** Bottom action row for **SAVE**, **SAVE & COMMIT**, **COPY ALL**, and **CLOSE**.

---

## 5. Settings Studio (Tab 3)

* **Button Layout Builder:** Customize TouchBar slots with 2-tap add, move, and remove workflows.
* **Button Studio:** Customize macro button colors, labels, and functions, including the pinned interactive `CUST` button.
* **Theme Settings:** Switch theme presets, adjust font scaling sliders (6px to 20px), and create custom Base-16 color palettes.

---

## 6. Multi-User PAM Server Persistence & Multi-Device Resume

When logging in via Linux PAM (`AUTH_MODE=pam`), your workstation is truly sovereign and persistent:

* **Preferences Sync:** Your custom themes, button layouts, font scale settings, and CopyCard preferences are automatically saved to your server home directory:
  `/home/{username}/.config/sovereign-terminal/settings.json`
* **True Multi-Device Resume:** Your terminal tabs are powered by persistent background `tmux` sessions. You can close your mobile browser on your phone, pick up a tablet using your Linux username, and your tabs will instantly reconnect you precisely where you left off.
* **Zombie-Proofing:** Connecting to a session from a new device explicitly kicks out any orphaned connections from previous device drop-outs, preventing locked sizes and ensuring flawless dynamic flexbox resizing perfectly matches your active screen.

Log in from anywhere, and your personalized workstation environment loads instantly.
