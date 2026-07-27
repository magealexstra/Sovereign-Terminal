# Contributing to Sovereign Terminal

First off, thank you for considering contributing to Sovereign Terminal! This project thrives on community collaboration, especially since dealing with mobile browser quirks (I'm looking at you, Safari) requires testing across many different devices.

## The "Help Wanted" Quest Board

We are actively asking the community for help with the following specific items:

### 1. iOS Safari / WebKit Voice Dictation & Input Glitches
* **The Problem:** iOS Safari has aggressive, non-standard behaviors when handling the Web Speech API and Gboard/iOS keyboard dictation interactions inside xterm.js canvas overlays. Sometimes it swallows the first word, or causes the viewport to rubber-band.
* **How You Can Help:** We need developers with physical iPhones and iPads to test the `Dictation Stager` and the TouchBar. If you know how to defeat Safari's scroll-anchoring quirks or Web Speech API silence timeouts, PRs are incredibly welcome!

### 2. Multi-Tap Touch Selection in xterm.js
* **The Problem:** Selecting text on mobile by dragging a finger across the terminal canvas is currently functional, but double-tap to select a word, or triple-tap to select a line (common mobile paradigms) is missing from the xterm.js touch event handlers.
* **How You Can Help:** Implement native-feeling double-tap and triple-tap selection logic inside `Terminal.jsx` that interfaces cleanly with `xterm.js` buffer parsing.

### 3. PWA (Progressive Web App) Manifest & Offline Caching
* **The Problem:** We want users to be able to "Add to Home Screen" on Android and iOS to get a full-screen, app-like experience without the browser URL bar taking up valuable screen space.
* **How You Can Help:** Help us build a solid `manifest.json` and a lightweight Service Worker (`sw.js`) that handles the standalone display mode and caches the frontend static assets.

### 4. Custom Themes & Button Macros
* **The Problem:** We want to expand our default library of themes and TouchBar macro buttons.
* **How You Can Help:** Submit PRs adding your favorite Base-16 color palettes to our theme engine, or submit new CLI macro packs for things like `kubectl`, `npm`, or `aws-cli`.

## How to Submit a Pull Request

1. Fork the repository and create your branch from `main`.
2. Ensure you are running locally on port `2068` using `docker compose up --build`.
3. Test your changes thoroughly on **both** Desktop and Mobile (using Chrome DevTools device mode, or a physical device on your LAN).
4. Update the `README.md` or `USER_GUIDE.md` if your change adds new functionality.
5. Submit the PR with a clear description of the problem solved and a screenshot/video if it is a UI change.

## Bug Reports

Please use the GitHub Issues tab to report bugs. Include:
* Your device model and OS version.
* Your browser (Chrome, Safari, Firefox).
* The Docker host OS (Ubuntu, Debian, Raspberry Pi OS).
* Steps to reproduce the bug.

Welcome to the Guild. We're excited to build with you!
