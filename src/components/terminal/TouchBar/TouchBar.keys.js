/**
 * Key tables of the touch bar: the escape sequence behind each special key label (built from the button presets), the glyph check and the saved sudo password lookup.
 */

import { KEY_NAV_PRESETS, KEY_FN_PRESETS, KEY_SYM_PRESETS, KEY_MODE_PRESETS } from '../../settings/button-studio/buttonData';

// Special keys are looked up by label before anything else. Their escape sequences come from the
// button presets so each is defined once; the old arrow glyphs and names are kept as aliases for
// labels saved on buttons and layouts.
const PRESET_KEY_VALUES = Object.fromEntries(
  [...KEY_NAV_PRESETS, ...KEY_FN_PRESETS, ...KEY_SYM_PRESETS, ...KEY_MODE_PRESETS].map((b) => [b.label, b.value])
);

const keysFromPresets = (labels) => Object.fromEntries(labels.map((label) => [label, PRESET_KEY_VALUES[label]]));

const aliasesOf = (presetLabel, aliases) => Object.fromEntries(aliases.map((alias) => [alias, PRESET_KEY_VALUES[presetLabel]]));

export const KEY_MAPPINGS = {
  ...keysFromPresets([
    'ESC', 'TAB', 'DEL', '-', '|', '~', '/',
    'PgUp', 'PgDn', 'Home', 'End', 'Ctrl+Left', 'Ctrl+Right', 'Shift+Tab', 'Backspace', '⏎',
    ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  ]),
  '^C': '\x03',
  '^Z': '\x1a',
  'sudo': 'sudo ',
  'exit': 'exit\n',
  'Enter': PRESET_KEY_VALUES['⏎'],
  ...aliasesOf('▲', ['ArrowUp', '▲ Up', '↑']),
  ...aliasesOf('▼', ['ArrowDown', '▼ Down', '↓']),
  ...aliasesOf('◀', ['ArrowLeft', '◀ Left', '◄', '←']),
  ...aliasesOf('▶', ['ArrowRight', '► Right', '▶ Right', '►', '→']),
  ...keysFromPresets(['▲', '▼', '◀', '▶']),
};

export const isGlyphSymbol = (str) => ['▲', '▼', '◀', '▶', '⏎', '◄', '►', '↑', '↓', '←', '→'].includes(str);

export const getSavedSudo = () => {
  try {
    return sessionStorage.getItem('sovereign_sudo_password');
  } catch {
    return null;
  }
};
