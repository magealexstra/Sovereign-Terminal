/**
 * viewerTypes.js — File extension routing for the File Viewer tab.
 *
 * Shared between:
 *   - App.jsx        (handleOpenFile intercept + magic byte fallback)
 *   - FileViewer.jsx (tab icon, sub-renderer selection)
 *
 * Separation of NATIVE vs FFMPEG video:
 *   - NATIVE_VIDEO_EXTS  → Chrome plays directly, uses VideoPlayer + Plyr
 *   - FFMPEG_VIDEO_EXTS  → routed to Viewer but shows NoPreview card until Phase 2
 */

export const IMAGE_EXTS = new Set([
  'png','jpg','jpeg','webp','gif','svg','bmp','ico','tiff','avif',
]);

export const NATIVE_VIDEO_EXTS = new Set(['mp4','webm','mov']);

export const FFMPEG_VIDEO_EXTS = new Set([
  'mkv','avi','mpg','mpeg','wmv','m4v','flv','3gp','ts','vob',
]);

export const VIDEO_EXTS = new Set([...NATIVE_VIDEO_EXTS, ...FFMPEG_VIDEO_EXTS]);

export const AUDIO_EXTS = new Set([
  'mp3','wav','flac','ogg','m4a','aac','opus',
]);

/** All extensions that route to the Viewer tab (never to the text editor). */
export const VIEWER_EXTENSIONS = new Set([
  ...IMAGE_EXTS,
  ...VIDEO_EXTS,
  ...AUDIO_EXTS,
  'pdf',
]);

/**
 * Returns the viewer sub-type for a given filename.
 *
 * 'image'           → ImageViewer
 * 'video'           → VideoPlayer (Plyr, native browser formats)
 * 'video-nopreview' → NoPreview card ("not supported for in-browser playback")
 * 'audio'           → AudioPlayer (Plyr)
 * 'pdf'             → PdfViewer (iframe)
 * 'other'           → falls through to text editor (or binary guard)
 */
export const getViewerType = (filename) => {
  if (!filename) return 'other';
  const ext = filename.split('.').pop().toLowerCase();
  if (IMAGE_EXTS.has(ext))        return 'image';
  if (NATIVE_VIDEO_EXTS.has(ext)) return 'video';
  if (FFMPEG_VIDEO_EXTS.has(ext)) return 'video-nopreview';
  if (AUDIO_EXTS.has(ext))        return 'audio';
  if (ext === 'pdf')               return 'pdf';
  return 'other';
};

/**
 * Maps a magic-byte-detected type string (from /api/fs/filetype)
 * to a viewer type. Used for extensionless files.
 */
export const magicTypeToViewerType = (magicType, magicExt) => {
  if (magicType === 'image') return 'image';
  if (magicType === 'pdf')   return 'pdf';
  if (magicType === 'audio') return 'audio';
  if (magicType === 'video') {
    return NATIVE_VIDEO_EXTS.has(magicExt) ? 'video' : 'video-nopreview';
  }
  return 'other'; // 'binary' or 'text' — handled by caller
};
