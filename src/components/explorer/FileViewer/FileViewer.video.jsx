/**
 * Native video player: a Plyr player for formats the browser streams itself.
 */

import { useState, useEffect, useRef } from 'react';
import Plyr from 'plyr';
import { useCacheState } from '../../../context/CacheStateContext';
import { CachingStalledOverlay, stopMedia, useCachingTimeout } from './FileViewer.shared';

/* ─── Video player — native (Plyr) ─────────────────────────────────────────── */
// Used for mp4 / webm / mov — formats Chrome streams natively.
// State machine: 'caching' | 'streaming'. A caching phase that outlasts
// CACHE_TIMEOUT_MS offers "Stream Directly".
export function VideoPlayer({ path }) {
  const videoRef  = useRef(null);
  const playerRef = useRef(null);
  const sessionId = useRef(Date.now()).current;

  const cacheState = useCacheState();
  const baseUrl    = `/api/fs/stream?path=${encodeURIComponent(path)}`;

  const [viewState, setViewState] = useState(() => {
    // If the SW isn't active (plain HTTP, non-secure context, or first load
    // before the SW takes control) there is no cacheState to wait on —
    // go straight to streaming so the video plays immediately.
    const swActive = !!navigator.serviceWorker?.controller;
    if (!swActive) return 'streaming';
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

  const cachingTimedOut = useCachingTimeout(viewState === 'caching');

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
      try { playerRef.current?.destroy(); } catch {
        // Plyr may already have torn down its markup; the element is stopped below.
      }
      playerRef.current = null;
      stopMedia(el);
    };
  }, [viewState]);

  if (viewState === 'caching') {
    if (cachingTimedOut) {
      return <CachingStalledOverlay onStreamDirect={() => { autoPlayRef.current = true; setViewState('streaming'); }} />;
    }
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
