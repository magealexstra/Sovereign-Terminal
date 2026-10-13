/**
 * Small static views of the file viewer: the tab icon per file type, the PDF frame, the no-preview card and the empty state.
 */

import { Film, Music, FileImage, File } from 'lucide-react';

/* ─── Tab icon per type ─────────────────────────────────────────────────────── */
export function TabIcon({ type, color }) {
  const props = { size: 13, color };
  switch (type) {
    case 'image':           return <FileImage {...props} />;
    case 'video':
    case 'video-nopreview': return <Film {...props} />;
    case 'audio':           return <Music {...props} />;
    default:                return <File {...props} />;
  }
}

/* ─── PDF viewer ────────────────────────────────────────────────────────────── */
export function PdfViewer({ path }) {
  return (
    <iframe
      className="viewer-pdf-frame"
      src={`/api/fs/download?path=${encodeURIComponent(path)}&inline=true`}
      title="PDF Viewer"
    />
  );
}

/* ─── No preview fallback ──────────────────────────────────────────────────── */
export function NoPreview({ filename, type }) {
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
export function ViewerEmptyState() {
  // window.isSecureContext is true on HTTPS or localhost, false on plain HTTP.
  // Only show the notice when the SW cannot run — no alarm, just context.
  const needsHttps = !window.isSecureContext;
  return (
    <div className="viewer-empty-state">
      <FileImage size={48} color="var(--text-dim)" />
      <p className="viewer-empty-title">Open a file from the Files tab</p>
      <span className="viewer-empty-sub">Images, video, audio, and PDF files appear here.</span>
      {needsHttps && (
        <p className="viewer-https-notice">
          Video caching requires a secure connection (HTTPS).
          Playback still works for supported formats.
        </p>
      )}
    </div>
  );
}
