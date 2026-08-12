import React, { useState, useEffect, useRef, useCallback } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { Film, Music, FileImage, File, X, Loader } from 'lucide-react';
import { getFileBrandColor } from '../../utils/fileColors';

import { IMAGE_EXTS, VIDEO_EXTS, AUDIO_EXTS, VIEWER_EXTENSIONS, getViewerType } from '../../utils/viewerTypes';
import { useCacheState } from '../../context/CacheStateContext';

// Re-export for external consumers
export { getViewerType, VIEWER_EXTENSIONS };

/* ─── Tab icon per type ─────────────────────────────────────────────────────── */
function TabIcon({ type, color }) {
  const props = { size: 13, color };
  switch (type) {
    case 'image':           return <FileImage {...props} />;
    case 'video':
    case 'video-nopreview': return <Film {...props} />;
    case 'audio':           return <Music {...props} />;
    default:                return <File {...props} />;
  }
}

/* ─── Image viewer — pinch-to-zoom + pan + double-tap ──────────────────────── */
function ImageViewer({ path }) {
  const containerRef = useRef(null);
  const lastTapRef   = useRef(0);

  // Single source of truth kept in a ref for gesture frames, then flushed to state
  const xformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const panRef   = useRef({ active: false, moved: false, startX: 0, startY: 0, startTX: 0, startTY: 0 });

  const [xform, setXform] = useState({ scale: 1, x: 0, y: 0, animated: false });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getDist = (t) => Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

  /** Clamp translation so panned image never reveals empty canvas outside edges */
  const clamp = (x, y, scale) => {
    const c = containerRef.current;
    if (!c) return { x, y };
    const maxX = Math.max(0, (c.clientWidth  * (scale - 1)) / 2);
    const maxY = Math.max(0, (c.clientHeight * (scale - 1)) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const commit = (next, animated = false) => {
    xformRef.current = next;
    setXform({ ...next, animated });
  };

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchRef.current = { active: true, startDist: getDist(e.touches), startScale: xformRef.current.scale };
      panRef.current.active = false;
    } else if (e.touches.length === 1) {
      pinchRef.current.active = false;
      panRef.current = {
        active: true,
        moved:  false,
        startX:  e.touches[0].clientX,
        startY:  e.touches[0].clientY,
        startTX: xformRef.current.x,
        startTY: xformRef.current.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      const newScale = Math.min(
        Math.max(pinchRef.current.startScale * (getDist(e.touches) / pinchRef.current.startDist), 0.3),
        6
      );
      const { x, y } = clamp(xformRef.current.x, xformRef.current.y, newScale);
      commit({ scale: newScale, x, y });

    } else if (e.touches.length === 1 && panRef.current.active && xformRef.current.scale > 1.02) {
      const dx = e.touches[0].clientX - panRef.current.startX;
      const dy = e.touches[0].clientY - panRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) panRef.current.moved = true;
      const { x, y } = clamp(panRef.current.startTX + dx, panRef.current.startTY + dy, xformRef.current.scale);
      commit({ ...xformRef.current, x, y });
    }
  };

  const handleTouchEnd = (e) => {
    const wasPinch = pinchRef.current.active;
    const wasPan   = panRef.current.moved;

    if (e.touches.length < 2) pinchRef.current.active = false;
    if (e.touches.length === 0) panRef.current = { ...panRef.current, active: false, moved: false };

    // Rubber-band: if pinch released below 1×, spring back to fit
    if (!pinchRef.current.active && xformRef.current.scale < 1) {
      commit({ scale: 1, x: 0, y: 0 }, true);
      return;
    }

    // Double-tap only fires if the touch didn't move (not a pan or pinch end)
    if (e.changedTouches.length === 1 && !wasPan && !wasPinch) {
      const now = Date.now();
      const gap = now - lastTapRef.current;
      lastTapRef.current = now;
      if (gap > 60 && gap < 300) {
        if (xformRef.current.scale > 1.05) {
          // Reset zoom + position with a smooth animation
          commit({ scale: 1, x: 0, y: 0 }, true);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          containerRef.current?.requestFullscreen().catch(() => {});
        }
      }
    }
  };

  const imgStyle = {
    transform:       `translate(${xform.x}px, ${xform.y}px) scale(${xform.scale})`,
    transformOrigin: 'center center',
    transition:      xform.animated ? 'transform 0.22s ease' : 'none',
    willChange:      'transform',
  };

  return (
    <div
      className="viewer-image-scroll"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="viewer-image-frame">
        <img
          src={`/api/fs/download?path=${encodeURIComponent(path)}&inline=true`}
          alt=""
          className="viewer-image"
          draggable={false}
          style={imgStyle}
          // SVG served via <img> — browser sandboxes scripts, cannot execute
        />
      </div>
    </div>
  );
}

/* ─── Video player — native (Plyr) ─────────────────────────────────────────── */
// Used for mp4 / webm / mov — formats Chrome streams natively.
// State machine: 'caching' | 'streaming'
function VideoPlayer({ path }) {
  const videoRef  = useRef(null);
  const playerRef = useRef(null);
  const sessionId = useRef(Date.now()).current;

  const cacheState = useCacheState();
  const baseUrl    = `/api/fs/stream?path=${encodeURIComponent(path)}`;

  const [viewState, setViewState] = useState(() => {
    const entry = cacheState?.[path];
    return (entry?.state === 'cached' || entry?.state === 'skip') ? 'streaming' : 'caching';
  });

  // Set to true when we transition caching → streaming so Plyr auto-plays.
  // Warm-cache opens (straight to streaming on mount) stay paused.
  const autoPlayRef = useRef(false);

  // Trigger SW to background-download if cold
  useEffect(() => {
    if (viewState === 'caching') {
      const sw = navigator.serviceWorker?.controller;
      if (sw) sw.postMessage({ type: 'start-cache', path });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire once on mount

  // Reactive: transition to streaming once SW reports cached
  useEffect(() => {
    if (viewState !== 'caching') return;
    const entry = cacheState?.[path];
    if (entry?.state === 'cached' || entry?.state === 'skip') {
      autoPlayRef.current = true;
      setViewState('streaming');
    }
  }, [cacheState, path, viewState]);

  // Plyr init — runs once when we enter 'streaming'
  useEffect(() => {
    if (viewState !== 'streaming') return;
    const el = videoRef.current;
    if (!el || playerRef.current) return;
    try {
      playerRef.current = new Plyr(el, {
        captions: { active: true, update: true, language: 'auto' },
        controls: [
          'play-large','play','progress','current-time','duration',
          'mute','volume','captions','settings','fullscreen',
        ],
      });
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        playerRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('[FileViewer] Plyr video init failed:', err);
    }
    return () => {
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = null;
    };
  }, [viewState]);

  if (viewState === 'caching') {
    return (
      <div className="viewer-video-frame">
        <div className="viewer-caching-overlay">
          <span className="viewer-caching-title">Caching for offline playback</span>
          <span className="viewer-caching-sub">Playback begins automatically when caching completes.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-video-frame">
      <video
        ref={videoRef}
        src={`${baseUrl}&sid=${sessionId}`}
        controls
        playsInline
      />
    </div>
  );
}

/* ─── Smart Video Player — non-native ────────────────────────────────────────── */
// Used for video-nopreview types (mkv, avi, wmv, etc.) that need the FFmpeg cache path.
//
// Pre-Cache Then Play: the video element never mounts until the file is fully
// cached. React fires a SW postMessage to kick off backgroundCache, then watches
// CacheStateContext. When the SW reports 'cached' the player transitions to
// 'streaming' and mounts the <video> into a guaranteed warm cache hit.
//
// State machine:
//   init → (ffmpeg check + cacheState snapshot) →
//     no_ffmpeg  — FFmpeg not installed
//     caching    — SW is downloading; progress overlay shown, no <video>
//     streaming  — file fully cached; Plyr initialized
//     failed     — 4xx/5xx or unsupported codec

// Extensions that route through the FFmpeg cache path on the server.
// Mirrors FFMPEG_CONTAINERS in server/fs_video.py.
const FFMPEG_EXTS = new Set(['mkv', 'avi', 'mpg', 'mpeg', 'wmv', 'm4v', 'flv', '3gp', 'ts', 'vob']);

// ── Phase 3a: Native codec detection ──────────────────────────────────────────
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
// native=true: cache the original file via &native=1 (Phase 3a native path).
// native=false (default): cache the FFmpeg-remuxed output (Phase 2b/2c path).
// The SW derives the normalized URL from (path + native flag) using URLSearchParams
// so the cache key always matches what the fetch handler produces.
function triggerSwCache(path, native = false) {
  const sw = navigator.serviceWorker?.controller;
  if (sw) sw.postMessage({ type: 'start-cache', path, native });
}

function SmartVideoPlayer({ path, name, ffmpegAvailable, onNeedFfmpegCheck }) {
  const failCountRef = useRef(0);
  const videoRef     = useRef(null);
  const playerRef    = useRef(null);
  const sessionId    = useRef(Date.now()).current;

  // Set to true when we transition caching → streaming so Plyr auto-plays.
  // Warm-cache opens (straight to streaming on mount) stay paused.
  const autoPlayRef = useRef(false);

  // Set to true by init() when /stream/probe + canPlayNatively() confirms the
  // browser can decode this file without FFmpeg (Phase 3a native path).
  // Must be set before any setViewState() call so videoSrc is correct at render.
  const nativeRef = useRef(false);

  // 'init' | 'caching' | 'streaming' | 'no_ffmpeg' | 'failed'
  const [viewState, setViewState]     = useState('init');
  const [subtitleTracks, setSubtitles] = useState([]);

  const cacheState = useCacheState();
  const isStreamingOnly = cacheState?.[path]?.state === 'skip';

  const ext        = path.split('.').pop()?.toLowerCase() ?? '';
  const needsRemux = FFMPEG_EXTS.has(ext);
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

        // Phase 3a: ask the server what codecs the file uses, then check
        // whether this browser can decode them natively (no FFmpeg needed).
        try {
          const probeRes = await fetch(`/api/fs/stream/probe?path=${encodeURIComponent(path)}`);
          if (probeRes.ok) {
            const { video_codec, audio_codec } = await probeRes.json();
            nativeRef.current = canPlayNatively(video_codec, audio_codec);
          }
        } catch (_) {}
        if (cancelled) return;

        // If the browser can't play natively AND FFmpeg isn't available, give up.
        if (!nativeRef.current && !available) {
          setViewState('no_ffmpeg');
          return;
        }
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
      } catch (_) {}
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ffmpegAvailable, onNeedFfmpegCheck, needsRemux]);
  // Note: intentionally NOT listing cacheState — init reads it as a snapshot.
  // The reactive watcher below handles ongoing updates.

  // ── Reactive cacheState watcher ───────────────────────────────────────────
  // Transitions 'caching' → 'streaming' once the SW broadcasts completion.
  useEffect(() => {
    if (viewState !== 'caching') return;
    const entry = cacheState?.[path];
    if (entry?.state === 'cached') { autoPlayRef.current = true; setViewState('streaming'); }
    if (entry?.state === 'skip')   { autoPlayRef.current = true; setViewState('streaming'); }
  }, [cacheState, path, viewState]);

  // ── Plyr init — runs once when we enter 'streaming' ───────────────────────
  // At this point the SW has a complete cached response — the first range
  // request from the <video> element is guaranteed to hit warm cache.
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
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = null;
    };
  }, [viewState]);

  // ── Event handlers ─────────────────────────────────────────────────────────
  const handleError = () => {
    failCountRef.current += 1;
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
        {failCountRef.current >= 3 && (
          <span className="viewer-no-preview-hint">
            If you recently installed FFmpeg, a page refresh may be required.
          </span>
        )}
      </div>
    );
  }

  if (viewState === 'caching') {
    return (
      <div className="viewer-video-frame">
        <div className="viewer-caching-overlay">
          <span className="viewer-caching-title">Caching for offline playback</span>
          <span className="viewer-caching-sub">Playback begins automatically when caching completes.</span>
        </div>
      </div>
    );
  }

  // 'streaming': video element mounts only here — guaranteed warm cache
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

/* ─── Audio player (Plyr) ──────────────────────────────────────────────────── */
// Number of decorative waveform bars — pure CSS height variation, no Web Audio API.
const WAVE_BAR_COUNT = 40;

function AudioPlayer({ path, filename }) {
  const audioRef  = useRef(null);
  const playerRef = useRef(null);

  const [meta, setMeta]     = useState(null);   // { title, artist, album, format, bits_per_sample, sample_rate }
  const [artUrl, setArtUrl] = useState(null);   // string URL or null (no art found)
  const [artError, setArtError] = useState(false);

  // Fetch metadata and art in parallel on mount.
  useEffect(() => {
    let cancelled = false;
    const encoded = encodeURIComponent(path);

    Promise.all([
      fetch(`/api/fs/audio-meta?path=${encoded}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/fs/audio-art?path=${encoded}`, { method: 'HEAD' }).then(r => r.ok),
    ]).then(([metaData, hasArt]) => {
      if (cancelled) return;
      if (metaData) setMeta(metaData);
      if (hasArt) setArtUrl(`/api/fs/audio-art?path=${encoded}`);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [path]);

  // Init Plyr audio player.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    try {
      playerRef.current = new Plyr(el, {
        controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume'],
      });
    } catch (err) {
      console.error('[FileViewer] Plyr audio init failed:', err);
    }
    return () => {
      try { playerRef.current?.destroy(); } catch (_) {}
      playerRef.current = null;
    };
  }, []);

  // Format technical sub-label: e.g. "FLAC · 24-bit / 96 kHz"
  const techLabel = (() => {
    if (!meta) return null;
    const parts = [meta.format].filter(Boolean);
    if (meta.bits_per_sample) parts.push(`${meta.bits_per_sample}-bit`);
    if (meta.sample_rate) {
      const khz = (parseInt(meta.sample_rate, 10) / 1000).toFixed(1).replace(/\.0$/, '');
      parts.push(`${khz} kHz`);
    }
    return parts.length > 1 ? parts.join(' · ') : parts[0] || null;
  })();

  const displayTitle  = meta?.title  || filename;
  const displayArtist = meta?.artist || '';
  const displayAlbum  = meta?.album  || '';

  return (
    <div className="viewer-audio-frame">
      <div className="viewer-audio-card">

        {/* Top row: art panel + metadata */}
        <div className="viewer-audio-top">
          <div className="viewer-audio-art-panel">
            {artUrl && !artError
              ? <img
                  src={artUrl}
                  alt="Album art"
                  className="viewer-audio-art-img"
                  onError={() => setArtError(true)}
                />
              : <Music size={48} className="viewer-audio-art-icon" />
            }
          </div>
          <div className="viewer-audio-meta">
            <span className="viewer-audio-title">{displayTitle}</span>
            {displayArtist && <span className="viewer-audio-artist">{displayArtist}</span>}
            {displayAlbum  && <span className="viewer-audio-album">{displayAlbum}</span>}
            {techLabel     && <span className="viewer-audio-tech">{techLabel}</span>}
          </div>
        </div>

        {/* Decorative waveform — static CSS, no live audio data */}
        <div className="viewer-audio-wave" aria-hidden="true">
          {Array.from({ length: WAVE_BAR_COUNT }, (_, i) => (
            <span key={i} className="viewer-audio-wave-bar" />
          ))}
        </div>

        {/* Plyr audio controls */}
        <div className="viewer-audio-player-wrap">
          <audio
            ref={audioRef}
            src={`/api/fs/stream?path=${encodeURIComponent(path)}`}
            controls
          />
        </div>

      </div>
    </div>
  );
}


/* ─── PDF viewer ────────────────────────────────────────────────────────────── */
function PdfViewer({ path }) {
  return (
    <iframe
      className="viewer-pdf-frame"
      src={`/api/fs/download?path=${encodeURIComponent(path)}&inline=true`}
      title="PDF Viewer"
    />
  );
}

/* ─── No preview fallback ──────────────────────────────────────────────────── */
function NoPreview({ filename, type }) {
  const ext = filename ? '.' + filename.split('.').pop().toLowerCase() : '';
  const isVideoNoPreview = type === 'video-nopreview';
  return (
    <div className="viewer-no-preview">
      {isVideoNoPreview
        ? <Film size={48} color="var(--text-dim)" />
        : <File size={48} color="var(--text-dim)" />
      }
      <p className="viewer-no-preview-name">{filename}</p>
      <span className="viewer-no-preview-note">
        {isVideoNoPreview
          ? `${ext} is not supported for in-browser playback. Use the File Manager to download it.`
          : 'No preview available. Use the File Manager to download this file.'
        }
      </span>
    </div>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────────────── */
function ViewerEmptyState() {
  return (
    <div className="viewer-empty-state">
      <FileImage size={48} color="var(--text-dim)" />
      <p className="viewer-empty-title">Open a file from the Files tab</p>
      <span className="viewer-empty-sub">Images, video, audio, and PDF files appear here.</span>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────────── */
export default function FileViewer({
  viewerDocs,
  setViewerDocs,
  activeViewerPath,
  setActiveViewerPath,
}) {
  const activeDoc = viewerDocs.find(d => d.path === activeViewerPath) || viewerDocs[0] || null;
  const cacheState = useCacheState();

  // ── FFmpeg lazy health check ─────────────────────────────────────────────
  // Fires at most once per session, on the first video-nopreview file opened.
  // Result is cached in ffmpegRef (persists across re-renders) and mirrored to
  // ffmpegAvailable state (triggers re-render to pass updated value to children).
  const ffmpegRef = useRef(null);  // null = unchecked | true | false
  const [ffmpegAvailable, setFfmpegAvailable] = useState(null);

  const checkFfmpeg = useCallback(async () => {
    if (ffmpegRef.current !== null) return ffmpegRef.current;
    try {
      const res  = await fetch('/api/fs/ffmpeg-health');
      const data = await res.json();
      ffmpegRef.current = data.available;
      setFfmpegAvailable(data.available);
      return data.available;
    } catch {
      ffmpegRef.current = false;
      setFfmpegAvailable(false);
      return false;
    }
  }, []);

  const handleCloseTab = (path) => {
    const remaining = viewerDocs.filter(d => d.path !== path);
    setViewerDocs(remaining);
    if (activeViewerPath === path) {
      setActiveViewerPath(remaining.length > 0 ? remaining[remaining.length - 1].path : '');
    }
  };

  const renderViewport = () => {
    if (!activeDoc) return <ViewerEmptyState />;
    const { path, name, type } = activeDoc;
    switch (type) {
      case 'image':           return <ImageViewer key={path} path={path} />;
      case 'video':           return <VideoPlayer       key={path} path={path} />;
      case 'video-nopreview': return <SmartVideoPlayer  key={path} path={path} name={name} type={type} ffmpegAvailable={ffmpegAvailable} onNeedFfmpegCheck={checkFfmpeg} />;
      case 'audio':           return <AudioPlayer     key={path} path={path} filename={name} />;
      case 'pdf':             return <PdfViewer       key={path} path={path} />;
      default:                return <NoPreview       filename={name} type={type} />;
    }
  };

  return (
    <div className="viewer-workspace">

      {/* Tab Bar */}
      <div className="viewer-tabs-bar" onContextMenu={(e) => e.preventDefault()}>
        {viewerDocs.length === 0 && (
          <span className="viewer-tabs-empty-hint">No files open</span>
        )}
        {viewerDocs.map((doc) => {
          const brandColor = getFileBrandColor(doc.name);
          const isActive   = activeViewerPath === doc.path || (!activeViewerPath && viewerDocs[0]?.path === doc.path);
          
          const cacheEntry = cacheState?.[doc.path];
          const cachePct   = (cacheEntry?.state === 'downloading') ? (cacheEntry.percent ?? 0) : 0;

          return (
            <button
              key={doc.path}
              type="button"
              className={`doc-pill-btn ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? brandColor : 'var(--border-forest)',
                color:       isActive ? 'var(--text-parchment)' : 'var(--text-muted)',
                boxShadow:   isActive ? `0 0 10px ${brandColor}50` : 'none',
                '--cache-pct': cachePct,
              }}
              onClick={() => setActiveViewerPath(doc.path)}
            >
              {cacheEntry?.state === 'cached' && (
                <span className="cache-dot" aria-hidden="true" />
              )}
              <TabIcon type={doc.type} color={brandColor} />
              <span className="tab-chip-label">{doc.name}</span>
              <span
                className="close-tab-icon"
                onClick={(e) => { e.stopPropagation(); handleCloseTab(doc.path); }}
                title="Close"
              >
                <X size={11} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Viewport */}
      <div className="viewer-viewport">
        {renderViewport()}
      </div>

    </div>
  );
}
