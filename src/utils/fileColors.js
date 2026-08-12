/**
 * fileColors.js — Shared file extension brand color utility.
 *
 * Used by:
 *   - CodeEditor.jsx   (tab pill border/glow color)
 *   - FileExplorer.jsx (extension column text color)
 *   - FileViewer.jsx   (tab pill border/glow color)
 *
 * Color families (approved Aug 2026):
 *   Code languages  → official brand colors (unchanged)
 *   Images          → Cyan/Teal family
 *   Video (native)  → Forest/Emerald Green family
 *   Video (legacy)  → Sage Green (#5ba386, shared)
 *   Audio           → Muted Violet/Purple family
 *   PDF             → Dark Gold (#d6a013)
 *   SVG             → Deep Wine (#800946) — special case: vector + markup
 *   TIFF            → Deep Ocean Navy (#022638) — pro photography format
 */

export const getFileBrandColor = (filename) => {
  if (!filename) return '#A3B1B8';
  const fn = filename.toLowerCase();

  /* ── Code / Markup languages (official brand colors) ─────────────────────── */
  if (fn.endsWith('.py') || fn.endsWith('.mpy') || fn.endsWith('.upy')) return '#3776AB';
  if (fn.endsWith('.js') || fn.endsWith('.jsx'))                         return '#F7DF1E';
  if (fn.endsWith('.ts') || fn.endsWith('.tsx'))                         return '#3178C6';
  if (fn.endsWith('.html') || fn.endsWith('.htm'))                       return '#E34F26';
  if (fn.endsWith('.css'))                                               return '#1572B6';
  if (fn.endsWith('.sh') || fn.endsWith('.bash') || fn.endsWith('.zsh')) return '#4EAA25';
  if (fn.endsWith('.json'))                                              return '#F9A825';
  if (fn.endsWith('.md'))                                                return '#083FA1';
  if (fn.endsWith('.yaml') || fn.endsWith('.yml'))                       return '#CB171E';
  if (fn.endsWith('.rs'))                                                return '#CE422B';
  if (fn.endsWith('.c') || fn.endsWith('.cpp') || fn.endsWith('.h') || fn.endsWith('.hpp')) return '#659AD2';
  if (fn.endsWith('.xml'))                                               return '#F16529';
  if (fn.endsWith('.sql'))                                               return '#CC2927';
  if (fn.includes('docker') || fn.endsWith('.dockerignore'))             return '#2496ED';

  /* ── Images — Cyan/Teal family ───────────────────────────────────────────── */
  // SVG: Deep Wine — special case (vector + markup, sandboxed via <img>)
  if (fn.endsWith('.svg'))                                               return '#800946';
  if (fn.endsWith('.png'))                                               return '#0c92a8';
  if (fn.endsWith('.jpg') || fn.endsWith('.jpeg'))                       return '#067a96';
  if (fn.endsWith('.webp'))                                              return '#316775';
  if (fn.endsWith('.gif'))                                               return '#18bef5';
  if (fn.endsWith('.bmp'))                                               return '#0d66ba';
  if (fn.endsWith('.ico'))                                               return '#2aebbe';
  // TIFF: Deep Ocean Navy — pro/photography format
  if (fn.endsWith('.tiff') || fn.endsWith('.tif'))                       return '#022638';
  if (fn.endsWith('.avif'))                                              return '#0a5f70';

  /* ── Video — Forest/Emerald Green family ─────────────────────────────────── */
  if (fn.endsWith('.mp4'))                                               return '#1c8764';
  if (fn.endsWith('.webm'))                                              return '#1e7d5a';
  if (fn.endsWith('.mov'))                                               return '#558211';
  if (fn.endsWith('.mkv'))                                               return '#04523a';
  if (fn.endsWith('.avi'))                                               return '#178767';
  if (fn.endsWith('.mpg') || fn.endsWith('.mpeg'))                       return '#599404';
  // Legacy video formats — shared sage green
  if (fn.endsWith('.wmv') || fn.endsWith('.m4v') || fn.endsWith('.flv')
    || fn.endsWith('.3gp') || fn.endsWith('.ts')  || fn.endsWith('.vob')) return '#5ba386';

  /* ── Audio — Muted Violet/Purple family ──────────────────────────────────── */
  if (fn.endsWith('.mp3'))                                               return '#6443b0';
  if (fn.endsWith('.wav'))                                               return '#6e4c8f';
  if (fn.endsWith('.flac'))                                              return '#662ec7';
  if (fn.endsWith('.ogg'))                                               return '#9e36ad';
  if (fn.endsWith('.m4a'))                                               return '#8b5bba';
  if (fn.endsWith('.aac'))                                               return '#712eb3';
  if (fn.endsWith('.opus'))                                              return '#8b74cf';

  /* ── Documents ────────────────────────────────────────────────────────────── */
  if (fn.endsWith('.pdf'))                                               return '#d6a013';

  return '#A3B1B8'; // default muted slate
};

/**
 * getFileExtension — Returns the extension for display (e.g. ".md").
 * Returns null for:
 *   - Directories (pass isDir=true)
 *   - Dotfiles (.gitignore, .env) — the dot is part of the name, not a separator
 *   - Extensionless files (Makefile, Dockerfile, LICENSE)
 */
export const getFileExtension = (filename, isDir = false) => {
  if (isDir || !filename) return null;
  if (filename.startsWith('.')) return null;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return null;
  return filename.slice(lastDot); // e.g. ".md", ".js"
};
