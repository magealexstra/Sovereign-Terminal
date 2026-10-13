/**
 * Image viewer: loads one image and handles pinch-to-zoom, pan and double-tap zoom.
 */

import { useState, useRef } from 'react';
import { FileImage } from 'lucide-react';

/* ─── Image viewer — pinch-to-zoom + pan + double-tap ──────────────────────── */
export function ImageViewer({ path }) {
  const containerRef = useRef(null);
  const lastTapRef   = useRef(0);

  // Single source of truth kept in a ref for gesture frames, then flushed to state
  const xformRef = useRef({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });
  const panRef   = useRef({ active: false, moved: false, startX: 0, startY: 0, startTX: 0, startTY: 0 });

  const [xform, setXform] = useState({ scale: 1, x: 0, y: 0, animated: false });
  const [loadFailed, setLoadFailed] = useState(false);

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

  if (loadFailed) {
    return (
      <div className="viewer-no-preview">
        <FileImage size={48} color="var(--text-dim)" />
        <p className="viewer-no-preview-name">{path.split('/').pop()}</p>
        <span className="viewer-no-preview-note">This image could not be loaded.</span>
      </div>
    );
  }

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
          onError={() => setLoadFailed(true)}
          // SVG served via <img> — browser sandboxes scripts, cannot execute
        />
      </div>
    </div>
  );
}
