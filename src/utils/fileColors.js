/**
 * fileColors.js — Shared file extension brand color utility.
 *
 * Used by:
 *   - CodeEditor.jsx  (tab pill border/glow color)
 *   - FileExplorer.jsx (extension column text color)
 *
 * Colors are official language/tool brand colors.
 * Intentionally hardcoded — these are identity colors, not theme tokens.
 */
export const getFileBrandColor = (filename) => {
  if (!filename) return '#A3B1B8';
  const fn = filename.toLowerCase();
  if (fn.endsWith('.py') || fn.endsWith('.mpy') || fn.endsWith('.upy')) return '#3776AB';
  if (fn.endsWith('.js') || fn.endsWith('.jsx')) return '#F7DF1E';
  if (fn.endsWith('.ts') || fn.endsWith('.tsx')) return '#3178C6';
  if (fn.endsWith('.html') || fn.endsWith('.htm')) return '#E34F26';
  if (fn.endsWith('.css')) return '#1572B6';
  if (fn.endsWith('.sh') || fn.endsWith('.bash') || fn.endsWith('.zsh')) return '#4EAA25';
  if (fn.endsWith('.json')) return '#F9A825';
  if (fn.endsWith('.md')) return '#083FA1';
  if (fn.endsWith('.yaml') || fn.endsWith('.yml')) return '#CB171E';
  if (fn.endsWith('.rs')) return '#CE422B';
  if (fn.endsWith('.c') || fn.endsWith('.cpp') || fn.endsWith('.h') || fn.endsWith('.hpp')) return '#659AD2';
  if (fn.endsWith('.xml') || fn.endsWith('.svg')) return '#F16529';
  if (fn.endsWith('.sql')) return '#CC2927';
  if (fn.includes('docker') || fn.endsWith('.dockerignore')) return '#2496ED';
  return '#A3B1B8';
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
