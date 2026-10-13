/**
 * The tabbed file viewer: tab strip, the FFmpeg availability check, and the choice of player for the active file.
 */

import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { getFileBrandColor } from '../../../utils/fileColors';
import { useCacheState } from '../../../context/CacheStateContext';
import { AudioPlayer } from './FileViewer.audio';
import { ImageViewer } from './FileViewer.image';
import { NoPreview, PdfViewer, TabIcon, ViewerEmptyState } from './FileViewer.panels';
import { SmartVideoPlayer } from './FileViewer.smartVideo';
import { VideoPlayer } from './FileViewer.video';

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
      const res = await fetch('/api/fs/ffmpeg-health');
      // A failed check says nothing about FFmpeg, so it is not remembered: the
      // next video file asks again.
      if (!res.ok) return false;
      const data = await res.json();
      ffmpegRef.current = !!data.available;
      setFfmpegAvailable(!!data.available);
      return !!data.available;
    } catch {
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
      case 'video-nopreview': return <SmartVideoPlayer  key={path} path={path} name={name} ffmpegAvailable={ffmpegAvailable} onNeedFfmpegCheck={checkFfmpeg} />;
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
