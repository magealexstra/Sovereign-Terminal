# Sovereign Terminal — Operation Manual

Welcome to **The Sovereign Terminal**, a touch-controlled, mobile-first Linux server management workstation. This manual serves as the definitive in-app guide for using the UI.

---

## Section 1: Header Navigation & Session Management

The main navigation bar is located at the top of the interface and allows you to seamlessly switch between the core workstation areas:

*   **Terminal (Tab 1):** Your primary command-line interface with multi-session support.
*   **Files (Tab 2):** The File Explorer and Code Editor, synchronized with your terminal's working directory.
*   **Settings (Tab 3):** The Settings Studio where you can customize themes, layouts, and macro buttons.

**Session Controls:**
In the top-left corner of the header, you will find the **SOVEREIGN TERMINAL** brand logo hitbox. Tapping this logo reveals the active session pop-up menu. This menu displays your current authentication mode (Linux OS PAM or Token). Most importantly, this menu houses the **LOGOUT SESSION** button. Tapping this button securely tears down active WebSockets, clears your session credentials, and returns you to a clean login screen, ensuring your workstation remains secure when you step away.

---

## Section 2: Terminal & Left-Edge Copy Suite (`CopyCard`)

Pinned to the left edge above the TouchBar is the vertical 3-button Copy Suite, known as the `CopyCard`. This provides rapid text extraction capabilities without awkward mobile text selection:

*   **COPY (Sage Green):** Copies the active terminal line to your selected destination. Useful for quickly grabbing the most recent output or command.
*   **ALL (Glacier Blue):** Copies the entire terminal scrollback buffer. Ideal for exporting extensive logs or a full session history.
*   **CUST (Nordic Red):** Copies a specified number of lines (defaulting to the last 50 lines). You can customize this line count to your preference.

**Destination Toggle Pill:**
At the bottom of the `CopyCard`, there is an interactive pill-shaped toggle. Tapping this pill switches the destination of your copied text:
*   **`[ CLIP ]`**: Copies the selected text directly to your device's system clipboard, ready to be pasted into other apps.
*   **`[ CODE ]`**: Pipes the copied terminal output directly into a new document tab inside the CodeMirror Editor (Tab 2). This is a powerful feature for instantly reviewing or modifying command outputs in a full text editor.

---

## Section 3: The TouchBar, Dictation & Command Stager

Located at the bottom of the screen is the customizable TouchBar, designed for rapid mobile input:

*   **Mic Button:** Tap this to activate your device's Gboard voice dictation, allowing you to speak commands directly.
*   **Stager Launcher Button (Edit Icon):** This button opens the TouchBar-anchored dictation & command staging drawer immediately above the TouchBar. This is the **Command Stager**. It allows you to stage, review, and edit commands (whether spoken or typed) before executing them, preventing accidental or malformed commands from being sent to the server.
*   **Master Red `MACROS` Button:** Tapping this opens the complete library of categorized macro command toolkits. These suites (`AGY`, `APT`, `GIT`, `SYS`, etc.) provide one-tap access to complex or frequently used commands, drastically reducing the need for manual typing on a mobile device.

---

## Section 4: File Explorer & Code Editor (Tab 2)

The second tab houses a dual-pane File Explorer and Code Editor optimized for touch interactions:

*   **File Tree Sync:** The explorer automatically synchronizes with your active terminal working directory, ensuring you are always viewing the relevant files for your current task.
*   **Multi-Document Tabs:** The Code Editor supports opening multiple files simultaneously in tabs. These tabs are color-coded with official language brand colors (e.g., Python Blue, JS Yellow, HTML Orange) for easy visual identification.
*   **Touch Scrolling:** You can smoothly drag with your finger to scroll through long code or Markdown documents. The scrollbars automatically adapt to your active theme.
*   **Editor Touch Bar:** Located at the bottom of the editor, this action row provides quick access to essential file operations: **SAVE**, **SAVE & COMMIT** (for rapid git workflows), **COPY ALL** (copies the entire document), and **CLOSE** (closes the active tab).

---

## Section 5: Settings Studio (Tab 3)

The Settings Studio allows deep customization of your Sovereign Terminal experience:

*   **Theme Engine:** Switch between various pre-built theme presets or define your own. You can precisely adjust font scaling using the sliders, ranging from a compact 6px to a highly readable 20px, optimizing the interface for your specific device screen size.
*   **Button Layout Builder:** This powerful tool lets you edit the default TouchBar slots. It features an intuitive 2-tap add/move workflow, allowing you to quickly swap out default buttons for the macros you use most frequently.
*   **Button Studio:** Here you can fully customize individual macro buttons. You can change their shapes (Square, Round, Pill), assign specific colors, and edit their labels. **Crucially, this is where you can edit the `CUST` button's behavior**, allowing you to change its target line count value from the default 50 to any number that suits your workflow.
