/**
 * Cache-aware video player: picks native or FFmpeg-remuxed playback, asks the service worker to cache the file, and reports loading and failure states.
 */

import { useState, useEffect, useRef } from 'react';
import Plyr from 'plyr';
import { Film, Loader } from 'lucide-react';
import { FFMPEG_VIDEO_EXTS } from '../../../utils/viewerTypes';
import { useCacheState } from '../../../context/CacheStateContext';
import { CachingStalledOverlay, stopMedia, useCachingTimeout } from './FileViewer.shared';

/* ─── Smart Video Player — non-native ────────────────────────────────────────── */
// Used for video-nopreview types (mkv, avi, wmv, etc.) that need the FFmpeg cache path.
//
// Pre-Cache Then Play: React fires a SW postMessage to kick off backgroundCache,
// then watches CacheStateContext. When the SW reports 'cached' (or 'skip') the
// player transitions to 'streaming' and mounts the <video>, normally into a warm
// cache hit. Without a controlling service worker, or when the user picks
// "Stream Directly", it mounts the <video> without waiting for the cache.
//
// State machine:
//   init → (ffmpeg check + cacheState snapshot) →
//     no_ffmpeg  — FFmpeg not installed
//     caching    — SW is downloading; progress overlay shown, no <video>
//     streaming  — <video> mounted and Plyr initialized
//     failed     — 4xx/5xx or unsupported codec

// ── Native codec detection ──────────────────────────────────────────
// Maps ffprobe codec_name (exact lowercase strings) to the MIME/codec string
// that HTMLVideoElement.canPlayType() understands.
// Codecs with no browser support (wmv3, vc1) are intentionally omitted —
// if a codec isn't here, canPlayNatively() returns false and we fall back to
// the remux path (or show the "No preview" card if remux also can't handle it).
const NATIVE_VIDEO_MIME = {
  hevc:       'video/mp4; codecs="hvc1"',
  mpeg4:      'video/mp4; codecs="mp4v.20.3"',
  mpeg1video: 'video/mpeg',
  mpeg2video: 'video/mpeg',
};

// Audio codec suffix for combined canPlayType() checks (e.g. 'hvc1,mp4a.40.2').
// AC3, DTS, TrueHD are intentionally absent — Chrome on Android/Linux lacks
// the Dolby license; canPlayType() will return "" for those automatically.
const NATIVE_AUDIO_CODEC = {
  aac:  'mp4a.40.2',
  mp3:  'mp3',
  opus: 'opus',
  flac: 'flac',
  alac: 'alac',
  eac3: 'ec-3',    // Dolby Digital+ — partial Android support, canPlayType handles it
};

/**
 * Check whether the current browser can decode the given video + audio codec
 * combination natively, without FFmpeg remuxing.
 *
 * Returns true when canPlayType() reports 'probably' or 'maybe'.
 * A 'maybe' result means the browser recognises the codec but can't guarantee
 * support until it loads data — we treat it as supported and fall back
 * gracefully via the <video> element's error event if it actually fails.
 */
function canPlayNatively(videoCodec, audioCodec) {
  const videoMime = NATIVE_VIDEO_MIME[videoCodec];
  if (!videoMime) return false;

  const probe = document.createElement('video');

  // Try the combined codec string first (most accurate result).
  const audioPart = NATIVE_AUDIO_CODEC[audioCodec];
  if (audioPart) {
    // e.g. 'video/mp4; codecs="hvc1,mp4a.40.2"'
    const combined = videoMime.replace(/"$/, `,${audioPart}"`);
    const result   = probe.canPlayType(combined);
    if (result === 'probably' || result === 'maybe') return true;
  }

  // Fallback: video codec alone. Audio may still play if the browser can
  // handle the track natively from the container (common for MKV + HEVC).
  const result = probe.canPlayType(videoMime);
  return result === 'probably' || result === 'maybe';
}

// ── SW cache trigger ───────────────────────────────────────────────────────────
// Tell the SW to start background-caching this path.
// native=true: cache the original file via &native=1 (native path).
// native=false (default): cache the FFmpeg-remuxed output (remux path).
// The SW derives the normalized URL from (path + native flag) using URLSearchParams
// so the cache key always matches what the fetch handler produces.
function triggerSwCache(path, native = false) {
  const sw = navigator.serviceWorker?.controller;
  if (sw) sw.postMessage({ type: 'start-cache', path, native });
}

export function SmartVideoPlayer({ path, name, ffmpegAvailable, onNeedFfmpegCheck }) {
  const videoRef     = useRef(null);
  const playerRef    = useRef(null);
  const sessionId    = useRef(Date.now()).current;

  // Set to true when we transition caching → streaming so Plyr auto-plays.
  // Warm-cache opens (straight to streaming on mount) stay paused.
  const autoPlayRef = useRef(false);

  // Set to true by init() when /stream/probe + canPlayNatively() confirms the
  // browser can decode this file without FFmpeg (native path).
  // Must be set before any setViewState() call so videoSrc is correct at render.
  const nativeRef = useRef(false);

  // 'init' | 'caching' | 'streaming' | 'no_ffmpeg' | 'failed'
  const [viewState, setViewState]     = useState('init');
  const [subtitleTracks, setSubtitles] = useState([]);
  const cacheState = useCacheState();
  const isStreamingOnly = cacheState?.[path]?.state === 'skip';

  const ext        = path.split('.').pop()?.toLowerCase() ?? '';
  const needsRemux = FFMPEG_VIDEO_EXTS.has(ext);
  // baseUrl: cache key root (no sid, no native flag — those are appended per use-site).
  const baseUrl          = `/api/fs/stream?path=${encodeURIComponent(path)}`;
  // effectiveBaseUrl: appends &native=1 when the probe confirmed native support.
  // nativeRef.current is always set before any setViewState() call in init(),
  // so this is correct by the time any state other than 'init' renders.
  const effectiveBaseUrl = nativeRef.current ? `${baseUrl}&native=1` : baseUrl;
  const videoSrc         = `${effectiveBaseUrl}&sid=${sessionId}`;

  // ── Init: codec probe (needsRemux files) + cacheState snapshot ────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. For needsRemux files: probe codec to determine native vs remux path.
      //    Must run before the warm-cache fast-path so nativeRef is set before
      //    any setViewState() call and effectiveBaseUrl is correct at render.
      if (needsRemux) {
        let available = ffmpegAvailable;
        if (available === null) available = await onNeedFfmpegCheck();
        if (cancelled) return;

        // Ask the server what codecs the file uses, then check
        // whether this browser can decode them natively (no FFmpeg needed).
        try {
          const probeRes = await fetch(`/api/fs/stream/probe?path=${encodeURIComponent(path)}`);
          if (probeRes.ok) {
            const { video_codec, audio_codec } = await probeRes.json();
            nativeRef.current = canPlayNatively(video_codec, audio_codec);
          }
        } catch {
          // The probe is optional: without it the file takes the FFmpeg path.
        }
        if (cancelled) return;

        // If the browser can't play natively AND FFmpeg isn't available, give up.
        if (!nativeRef.current && !available) {
          setViewState('no_ffmpeg');
          return;
        }
      }

      // SW availability check — skip caching entirely if the Service Worker
      // isn't active. This happens on plain HTTP (non-secure context) where
      // the SW cannot register, or on the very first HTTPS page load before
      // the SW has taken control. In either case go straight to streaming:
      // the video element makes range requests directly to the server, and
      // onError handles unsupported codecs as normal.
      const swActive = !!navigator.serviceWorker?.controller;
      if (!swActive) {
        if (!cancelled) setViewState('streaming');
        return;
      }

      // 2. Snapshot cacheState at mount time (not reactive — that's the watcher below)
      const entry = cacheState?.[path];

      if (entry?.state === 'cached' || entry?.state === 'skip') {
        // Warm cache or oversized file — go straight to streaming.
        // nativeRef is already set above so effectiveBaseUrl is correct.
        if (!cancelled) setViewState('streaming');
        return;
      }

      if (entry?.state === 'downloading') {
        // Another tab already kicked off a download — join in progress
        if (!cancelled) setViewState('caching');
        return;
      }

      // 3. Cold start — enter caching state and trigger SW download
      if (!cancelled) {
        setViewState('caching');
        triggerSwCache(path, nativeRef.current);
      }

      // Pre-fetch subtitle tracks (best-effort, never throws to the caller)
      try {
        const res = await fetch(`/api/fs/subtitles/list?path=${encodeURIComponent(path)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setSubtitles(data.tracks || []);
        }
      } catch {
        // Subtitles are optional; the video plays without them.
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ffmpegAvailable, onNeedFfmpegCheck, needsRemux]);
  // Note: intentionally NOT listing cacheState — init reads it as a snapshot.
  // The reactive watcher below handles ongoing updates.

  // ── Caching timeout ────────────────────────────────────────────────────────
  // If the SW hasn't reported 'cached' within CACHE_TIMEOUT_MS, surface an
  // actionable message instead of leaving the user stuck indefinitely.
  const cachingTimedOut = useCachingTimeout(viewState === 'caching');

  // ── Reactive cacheState watcher ───────────────────────────────────────────
  // Transitions 'caching' → 'streaming' once the SW broadcasts completion.
  useEffect(() => {
    if (viewState !== 'caching') return;
    const entry = cacheState?.[path];
    if (entry?.state === 'cached') { autoPlayRef.current = true; setViewState('streaming'); }
    if (entry?.state === 'skip')   { autoPlayRef.current = true; setViewState('streaming'); }
  }, [cacheState, path, viewState]);

  // ── Plyr init — runs once when we enter 'streaming' ───────────────────────
  // Normally the SW already holds a complete cached response, so the first range
  // request from the <video> element hits the cache.
  useEffect(() => {
    if (viewState !== 'streaming') return;
    const el = videoRef.current;
    if (!el || playerRef.current) return;

    try {
      playerRef.current = new Plyr(el, {
        controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
        seekTime:    10,
        resetOnEnd:  false,
      });
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        playerRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('[SmartVideoPlayer] Plyr init failed:', err);
    }

    return () => {
      try { playerRef.current?.destroy(); } catch {
        // Plyr may already have torn down its markup; the element is stopped below.
      }
      playerRef.current = null;
      stopMedia(el);
    };
  }, [viewState]);

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleError = () => {
    setViewState('failed');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (viewState === 'init') {
    return (
      <div className="viewer-no-preview">
        <Loader size={32} color="var(--text-dim)" className="viewer-spinner" />
      </div>
    );
  }

  if (viewState === 'no_ffmpeg') {
    return (
      <div className="viewer-no-preview">
        <Film size={48} color="var(--text-dim)" />
        <p className="viewer-no-preview-name">{name}</p>
        <span className="viewer-no-preview-note">
          FFmpeg is not available. Install FFmpeg to enable playback of this format.
          Right-click to download.
        </span>
      </div>
    );
  }

  if (viewState === 'failed') {
    return (
      <div className="viewer-no-preview">
        <Film size={48} color="var(--text-dim)" />
        <p className="viewer-no-preview-name">{name}</p>
        <span className="viewer-no-preview-note">
          This format is not supported for in-browser playback. Right-click to download.
        </span>
      </div>
    );
  }

  if (viewState === 'caching') {
    if (cachingTimedOut) {
      return <CachingStalledOverlay onStreamDirect={() => { autoPlayRef.current = true; setViewState('streaming'); }} />;
    }
    return (
      <div className="viewer-video-frame">
        <div className="viewer-caching-overlay">
          <span className="viewer-caching-title">Caching for playback</span>
          <span className="viewer-caching-sub">Playback begins automatically when caching completes.</span>
        </div>
      </div>
    );
  }

  // 'streaming': the video element mounts only here
  return (
    <div className="viewer-video-frame">
      {isStreamingOnly && (
        <p className="viewer-no-preview-note viewer-streaming-only-note">
          File too large to cache locally. Streaming only.
        </p>
      )}
      <div className="viewer-plyr-wrap">
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          onError={handleError}
        >
          {subtitleTracks.map((track, i) => (
            <track
              key={i}
              kind="subtitles"
              src={`/api/fs/subtitles?path=${encodeURIComponent(path)}&track=${track.index}`}
              srcLang={track.lang}
              label={track.label}
              default={i === 0}
            />
          ))}
        </video>
      </div>
    </div>
  );
}
