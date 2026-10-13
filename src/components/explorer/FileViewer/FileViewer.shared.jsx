/**
 * Helpers the media players share: the caching timeout hook, the stalled-caching overlay and the media teardown helper.
 */

import { useState, useEffect } from 'react';

/* ─── Shared player helpers ─────────────────────────────────────────────────── */

// How long a player waits for the service worker to finish caching before it
// offers to stream the file directly.
const CACHE_TIMEOUT_MS = 45_000;

// True once `isCaching` has stayed true for CACHE_TIMEOUT_MS. Caused by: the
// service worker being killed mid-download, a failed stream request (the worker
// reports nothing then), Cache API quota, or a stalled connection.
export function useCachingTimeout(isCaching) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!isCaching) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), CACHE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [isCaching]);
  return timedOut;
}

// Overlay shown when caching has taken too long, with a way to skip it.
export function CachingStalledOverlay({ onStreamDirect }) {
  return (
    <div className="viewer-video-frame">
      <div className="viewer-caching-overlay">
        <span className="viewer-caching-title">Loading is taking longer than expected</span>
        <span className="viewer-caching-sub">
          Your browser may not support background caching for files of this size,
          or your connection is too slow. You can try streaming the file directly.
        </span>
        <button className="viewer-stream-direct-btn" onClick={onStreamDirect}>
          Stream Directly
        </button>
      </div>
    </div>
  );
}

// Pauses a media element being torn down. A removed element keeps playing
// (audio included) until it is garbage collected, so the tab would stay audible.
export function stopMedia(el) {
  try {
    el.pause();
  } catch {
    // The element is already gone; there is nothing left to stop.
  }
}
