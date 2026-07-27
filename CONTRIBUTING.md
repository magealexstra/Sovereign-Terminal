# Contributing to Sovereign Terminal

First off, thank you for considering contributing to Sovereign Terminal! This project will only thrive through community collaboration, especially since dealing with mobile browser quirks (Safari) requires testing across many different devices.

## The Quest Board

We are actively asking the community for help with the following specific items:

### 1. iOS Safari / WebKit Voice Dictation & Input Glitches
* **The Problem:** iOS Safari has aggressive, non-standard behaviors when handling the Web Speech API and Gboard/iOS keyboard dictation interactions inside xterm.js canvas overlays. Sometimes it swallows the first word, or causes the viewport to rubber-band.
* **The Quest:** We need developers with physical iPhones and iPads to test the `Dictation Stager` and the TouchBar. If you know how to defeat Safari's scroll-anchoring quirks or Web Speech API silence timeouts, PRs are incredibly welcome!

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
* The Docker host OS (Anroid, IOS, Manjaro ARM, postmarketOS, Mobian, or Ubuntu Touch)
* Steps to reproduce the bug.

Welcome to the Faction. We're excited to build with you!
