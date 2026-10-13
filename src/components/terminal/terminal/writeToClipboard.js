/**
 * Clipboard write helper — tries modern Clipboard API first (requires HTTPS or localhost),
 * otherwise copies through a hidden textarea (for plain-HTTP deployments).
 */
export const writeToClipboard = (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure HTTP contexts
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('inputmode', 'none');
    ta.setAttribute('tabindex', '-1');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    let ok = false;
    try {
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand('copy');
    } catch {
      // Treated as a failed copy below.
    } finally {
      if (ta.blur) ta.blur();
      document.body.removeChild(ta);
    }
    if (ok) {
      resolve();
    } else {
      reject(new Error('execCommand copy failed'));
    }
  });
};
