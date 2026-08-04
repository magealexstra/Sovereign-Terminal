/**
 * Helper to generate xterm theme object from AppContext palette.
 */
export const addAlpha = (color, opacityHex = '66') => {
  if (typeof color !== 'string') return '#88C0D0' + opacityHex;
  const trimmed = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed + opacityHex;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const expanded = '#' + trimmed[1] + trimmed[1] + trimmed[2] + trimmed[2] + trimmed[3] + trimmed[3];
    return expanded + opacityHex;
  }
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(trimmed)) {
    const alpha = (parseInt(opacityHex, 16) / 255).toFixed(2);
    return trimmed.replace(/rgb\(([^)]+)\)/i, `rgba($1, ${alpha})`);
  }
  return '#88C0D0' + opacityHex;
};

export const getTermTheme = (currentTheme) => ({
  background: currentTheme?.bgEarth || '#141E26',
  foreground: currentTheme?.textParchment || '#E6EDF0',
  cursor: currentTheme?.accentHighlight || '#88C0D0',
  cursorAccent: currentTheme?.bgEarth || '#141E26',
  selectionBackground: addAlpha(currentTheme?.accentHighlight || '#88C0D0', '66'),
  black:         currentTheme?.black         || '#3B4252',
  red:           currentTheme?.red           || '#BF616A',
  green:         currentTheme?.green         || '#A3BE8C',
  yellow:        currentTheme?.yellow        || '#EBCB8B',
  blue:          currentTheme?.blue          || '#81A1C1',
  magenta:       currentTheme?.magenta       || '#B48EAD',
  cyan:          currentTheme?.cyan          || '#88C0D0',
  white:         currentTheme?.white         || '#E5E9F0',
  brightBlack:   currentTheme?.brightBlack   || '#4C566A',
  brightRed:     currentTheme?.brightRed     || '#D08770',
  brightGreen:   currentTheme?.brightGreen   || '#A3BE8C',
  brightYellow:  currentTheme?.brightYellow  || '#EBCB8B',
  brightBlue:    currentTheme?.brightBlue    || '#5E81AC',
  brightMagenta: currentTheme?.brightMagenta || '#B48EAD',
  brightCyan:    currentTheme?.brightCyan    || '#8FBCBB',
  brightWhite:   currentTheme?.brightWhite   || '#ECEFF4',
});
