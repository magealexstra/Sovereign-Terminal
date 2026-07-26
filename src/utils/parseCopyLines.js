/**
 * parseCopyLines — Robust parser and auto-healing validator for CUST scrollback lines.
 *
 * Supports:
 *   1. Raw integers: "500", "0", "1000" -> returns 500, 0, 1000
 *   2. Standard format with parentheses: "set number of lines to copy (50)" -> returns 50
 *   3. Malformed strings: "(invalid)", "random text" -> returns 50 (fallback)
 *
 * @param {string} rawString
 * @returns {number} Integer number of lines to copy
 */
export function parseCopyLines(rawString) {
  if (typeof rawString !== 'string' || rawString.trim().length === 0) {
    return 50;
  }

  const trimmed = rawString.trim();

  // Case 1: Direct integer input (e.g. "500", "0", "1000")
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Case 2: Parentheses with integer (e.g. "set number of lines to copy (50)")
  const parenMatch = trimmed.match(/\((\d+)\)/);
  if (parenMatch) {
    return parseInt(parenMatch[1], 10);
  }

  // Case 3: Fallback for malformed inputs
  return 50;
}

/**
 * isValidCopyFunctionFormat — Checks if a function string is valid.
 * Used by ButtonStudio for auto-healing onBlur.
 */
export function isValidCopyFunctionFormat(rawString) {
  if (typeof rawString !== 'string' || rawString.trim().length === 0) return false;
  const trimmed = rawString.trim();
  return /^\d+$/.test(trimmed) || /\((\d+)\)/.test(trimmed);
}
