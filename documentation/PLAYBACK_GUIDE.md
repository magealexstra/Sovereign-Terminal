# Sovereign Terminal — Playback Guide

FFmpeg-powered media streaming for non-native video formats.

---

## How It Works

The Viewer tab attempts in-browser playback for any video file you open.

**Native containers** (`.mp4`, `.webm`, `.mov`) — served directly via byte-range streaming.
No FFmpeg needed. Over **HTTPS**, these are cached by the Service Worker on first open for instant offline playback. Over **plain HTTP** (LAN without a cert, or Tailscale without HTTPS configured), the player skips the caching phase entirely and streams directly — no caching overlay.

**Non-native containers** (`.mkv`, `.avi`, `.mpg`, `.wmv`, `.m4v`, `.flv`, `.3gp`, `.ts`, `.vob`) —
require FFmpeg to remux into a format Chrome understands.

When you open an MKV (or similar):
1. The server runs `ffprobe` to detect video and audio codecs
2. Decides the cheapest path:
   - **Pure remux** — both codecs browser-safe → `ffmpeg -c copy` into a server-side cache file (near-instant)
   - **Hybrid remux** — video OK, audio not → copy video + transcode audio to Opus (fast)
   - **No preview** — video codec requires full transcode (Phase 3, opt-in)
3. The server streams the remuxed file as seekable byte-ranges once transcoding is complete

---

## Installation

### Docker (default)

FFmpeg is pre-installed in the Docker image. No action required.

### Baremetal (native host install)

When running in baremetal mode (`DEPLOYMENT_MODE=baremetal` in `.env`), install FFmpeg directly
on the host machine:

```bash
# Debian / Ubuntu / Mint
sudo apt install ffmpeg

# Fedora / RHEL / CentOS
sudo dnf install ffmpeg

# Arch / Manjaro
sudo pacman -S ffmpeg
```

**Verify the install:**
```bash
ffmpeg -version
ffprobe -version
```

After installing, **refresh the browser tab** — the FFmpeg health check runs once per session.

> **Note:** If the "FFmpeg is not available" card appears after installing, a full page reload
> (not just a tab refresh) clears the cached check result.

---

## Codec Coverage

| Scenario | Result |
|---|---|
| MKV + H.264 + AAC or Opus | Pure remux — plays after caching |
| MKV + H.264 + AC3 / DTS / TrueHD / EAC3 / FLAC | Hybrid remux — audio transcoded to Opus |
| MKV + AV1 / VP9 + any audio | Pure or hybrid remux depending on audio |
| MKV + HEVC / H.265 | No preview card (Phase 3) |
| AVI + H.264 + MP3 | Pure remux |
| FLV + H.264 + AAC | Pure remux |
| MPEG-2 / WMV3 / DivX / XviD | No preview card (Phase 3) |
| MP4 / WebM / MOV (native) | Direct byte-range stream, no FFmpeg |

---

## Phase 3 — Advanced Transcode (Opt-in)

Phase 3 enables software transcoding for HEVC/H.265, DivX, MPEG-2, and other
formats whose video codec requires re-encoding rather than a stream copy.

> **Warning:** Software transcode is CPU-intensive. Not recommended for shared
> servers without resource limits, or single-board computers.

To enable, add to your `.env`:

```env
ENABLE_ADVANCED_TRANSCODE=true
```

### Hardware Acceleration (VAAPI)

If your server has an Intel or AMD GPU with VAAPI support, you can significantly reduce
CPU load for Phase 3 transcodes.

**Verify VAAPI is available:**
```bash
vainfo
```

**Docker compose device passthrough:**
```yaml
devices:
  - /dev/dri:/dev/dri
```

Phase 3 hardware acceleration implementation is tracked in the playback quest log.

---

## Subtitles

If a video file contains embedded subtitle tracks, they are automatically extracted
and offered via the player's captions control. Text-based formats (SRT, SSA/ASS)
are converted to WebVTT on the fly.

Image-based subtitles (Blu-ray PGS, DVD VobSub) are not supported for in-browser
extraction — they require a separate text-based subtitle file alongside the video.

---

## Service Worker Cache (Phase 2c)

### What Is a Service Worker?

A Service Worker is a background script the browser registers and runs independently of the page.
It acts as a programmable network proxy — it can intercept requests, serve responses from local
storage, and run tasks even when the page is not open.

### Pre-Cache Then Play

When you open a video for the first time:

1. The Viewer tab shows a **"Caching for offline playback"** overlay — no `<video>` element is mounted yet
2. The tab chip at the top shows a green progress sweep as the file downloads in the background
3. Once the file is **fully cached**, the overlay disappears and playback begins automatically
4. The chip shows a **solid green dot** — the file is now cached locally

On every subsequent open of the same file, the video loads instantly from local storage with
no network activity required. Seeking, rewinding, and fast-forwarding all work offline.

### Why Wait for 100% Before Playing?

Chrome's media pipeline locks the transport source on the first byte of data. If playback begins
before the Service Worker is serving the file, Chrome fetches directly from the network.
Switching later causes `MEDIA_ERR_SRC_NOT_SUPPORTED`. Waiting for a fully warm cache guarantees
a clean, stable local playback session from the first frame.

### Why HTTPS Only?

Service Workers are restricted to **secure contexts** by the browser. The SW will only register and
intercept requests over HTTPS or `localhost`. On plain HTTP (e.g., accessing via local IP or a
Tailscale node without a cert), `navigator.serviceWorker.controller` is absent — the player detects
this on load and skips the caching phase entirely, going straight to streaming mode.

### Why Prod-Only?

In development mode (`npm run dev`), Vite uses Hot Module Replacement (HMR) which requires direct
network access to the dev server. A Service Worker intercepting those requests would break HMR.

The registration is guarded by `import.meta.env.PROD` in `main.jsx` — the SW never runs during
development. To test the full caching pipeline, serve over HTTPS or use:

```bash
npm run build && npm run preview
```

Then open DevTools → **Application → Service Workers** to confirm the SW is registered.

### Cache Limits

| Limit | Value |
|---|---|
| Per-file maximum | 1.5 GB |
| Total client cache | 5 GB (LRU eviction) |
| Cache TTL | 24 hours (swept on SW activate) |

Files over 1.5 GB are never cached. A "Streaming only" note appears in the player tab chip
for those files — they stream directly from the server with full seek support but no offline capability.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "FFmpeg is not available" card | FFmpeg not installed or not on PATH | `apt install ffmpeg` then hard-reload the page |
| "Playback failed" card | Codec unsupported or file corrupt | Check codec with `ffprobe <file>` locally |
| Caching overlay shows indefinitely | SW not registered in dev mode; on plain HTTP production the player auto-falls back to streaming | On HTTPS with a valid cert (e.g., Tailscale + cert), the full caching pipeline runs. In dev mode: `npm run build && npm run preview` |
| File cached twice in DevTools | Stale SW from before Phase 2c | Clear site data in DevTools and reload |
| Audio desync | VFR source with unusual timestamps | `-avoid_negative_ts make_zero` already applied; report if still occurring |
| "Streaming only" note in chip | File exceeds 1.5 GB per-file cache limit | Expected behavior; seek still works via server range requests |
| "If you recently installed FFmpeg" hint | FFmpeg installed after page load | Hard-reload the browser tab (Ctrl+Shift+R) |
