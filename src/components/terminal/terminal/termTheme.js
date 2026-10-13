// Used when a theme (for example a saved custom one) lacks a colour.
const FALLBACK_ANSI = {
  black: '#3B4252', red: '#BF616A', green: '#A3BE8C', yellow: '#EBCB8B',
  blue: '#81A1C1', magenta: '#B48EAD', cyan: '#88C0D0', white: '#E5E9F0',
  brightBlack: '#4C566A', brightRed: '#D08770', brightGreen: '#A3BE8C', brightYellow: '#EBCB8B',
  brightBlue: '#5E81AC', brightMagenta: '#B48EAD', brightCyan: '#8FBCBB', brightWhite: '#ECEFF4',
};

// Returns `color` with the alpha channel `opacityHex` (two hex digits) added.
const addAlpha = (color, opacityHex = '66') => {
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

// Blends `baseHex` toward `mixHex` by `lightnessPercent` (0-100) and returns the resulting hex colour.
const computeColorMix = (baseHex, mixHex, lightnessPercent = 18) => {
  const parseHex = (hex, fallbackHex) => {
    let cleaned = (typeof hex === 'string' ? hex : fallbackHex).trim().replace('#', '');
    if (cleaned.length === 3) {
      cleaned = cleaned.split('').map(c => c + c).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
      cleaned = fallbackHex.replace('#', '');
    }
    const num = parseInt(cleaned, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const rawNum = typeof lightnessPercent === 'string'
    ? parseFloat(lightnessPercent.replace('%', ''))
    : Number(lightnessPercent);
  const numericLightness = isNaN(rawNum) ? 18 : rawNum;
  const ratio = Math.max(0, Math.min(1, numericLightness / 100));

  const baseRgb = parseHex(baseHex, '111d29');
  const mixRgb = parseHex(mixHex, 'E6EDF0');

  const blendedRgb = baseRgb.map((b, i) => Math.round(b * (1 - ratio) + mixRgb[i] * ratio));
  return '#' + blendedRgb.map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
};

// Builds the xterm theme object from the app theme, the surface mix amount and the mix colour.
export const getTermTheme = (currentTheme, lightness = 18, mixColor) => {
  const baseBg = currentTheme?.bgEarth || '#111d29';
  const targetMix = mixColor || currentTheme?.textParchment || '#E6EDF0';
  const computedBg = computeColorMix(baseBg, targetMix, lightness);

  return {
    background: computedBg,
    foreground: currentTheme?.textParchment || '#E6EDF0',
    cursor: currentTheme?.accentHighlight || '#4e90a3',
    cursorAccent: computedBg,
    selectionBackground: addAlpha(currentTheme?.accentHighlight || '#4e90a3', '66'),
    ...Object.fromEntries(
      Object.entries(FALLBACK_ANSI).map(([name, fallback]) => [name, currentTheme?.[name] || fallback])
    ),
  };
};
