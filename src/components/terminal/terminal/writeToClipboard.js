/**
 * Clipboard write helper — tries modern Clipboard API first (requires HTTPS or localhost),
 * then falls back to legacy textarea trick (for plain-HTTP deployments).
 */
export const writeToClipboard = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure HTTP contexts
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      resolve();
    } else {
      reject(new Error('execCommand copy failed'));
    }
  });
};
