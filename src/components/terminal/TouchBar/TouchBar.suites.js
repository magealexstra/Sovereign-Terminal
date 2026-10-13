/**
 * Static macro data: the modal's group tabs, the suite bar display names and the built-in command suites by name.
 */

import { 
  PREBUILT_CATEGORIES,
  KEY_NAV_PRESETS,
  KEY_FN_PRESETS,
  KEY_SYM_PRESETS,
  KEY_MODE_PRESETS,
  KEY_LINE_PRESETS
} from '../../settings/button-studio/buttonData';

// The macro modal's group tabs and the suites under each.
export const GROUPS = {
  AI: { label: 'AI', suites: ['AGY', 'CLD', 'HMS'] },
  EDIT: { label: 'EDIT', suites: ['VIM', 'TXT', 'FILE'] },
  PKG: { label: 'PKG', suites: ['APT', 'PAC', 'YUM'] },
  SYS: { label: 'SYS', suites: ['DOC', 'GIT', 'SYS', 'NET', 'PY', 'NPM', 'TMX'] },
  KEY: { label: 'KEY', suites: ['KEY_NAV', 'KEY_FN', 'KEY_SYM', 'KEY_MODE', 'KEY_LINE'] },
};

// Display names for the keyboard suites in the sub-suite bar; other suites show their own key.
export const SUB_LABELS = {
  KEY_NAV: 'NAV',
  KEY_FN: 'FN',
  KEY_SYM: 'SYM',
  KEY_MODE: 'MODE',
  KEY_LINE: 'LINE'
};

// The built-in command suites by name, with an id on each button; the keyboard suites come from the presets.
export const commandSuites = {
  AGY: PREBUILT_CATEGORIES.AGY.items.map((item, idx) => ({ id: `agy${idx}`, ...item })),
  CLD: PREBUILT_CATEGORIES.CLD.items.map((item, idx) => ({ id: `cld${idx}`, ...item })),
  HMS: PREBUILT_CATEGORIES.HMS.items.map((item, idx) => ({ id: `hms${idx}`, ...item })),

  VIM: PREBUILT_CATEGORIES.VIM.items.map((item, idx) => ({ id: `vim${idx + 1}`, ...item })),
  FILE: PREBUILT_CATEGORIES.FILE.items.map((item, idx) => ({ id: `file${idx + 1}`, ...item })),
  TXT: PREBUILT_CATEGORIES.TXT.items.map((item, idx) => ({ id: `txt${idx + 1}`, ...item })),
  APT: PREBUILT_CATEGORIES.APT.items.map((item, idx) => ({ id: `apt${idx + 1}`, ...item })),
  PAC: PREBUILT_CATEGORIES.PAC.items.map((item, idx) => ({ id: `pac${idx + 1}`, ...item })),
  YUM: PREBUILT_CATEGORIES.YUM.items.map((item, idx) => ({ id: `yum${idx + 1}`, ...item })),
  DOC: PREBUILT_CATEGORIES.DOC.items.map((item, idx) => ({ id: `doc${idx + 1}`, ...item })),
  GIT: PREBUILT_CATEGORIES.GIT.items.map((item, idx) => ({ id: `git${idx + 1}`, ...item })),
  SYS: PREBUILT_CATEGORIES.SYS.items.map((item, idx) => ({ id: `sys${idx + 1}`, ...item })),
  NET: PREBUILT_CATEGORIES.NET.items.map((item, idx) => ({ id: `net${idx + 1}`, ...item })),
  PY: PREBUILT_CATEGORIES.PY.items.map((item, idx) => ({ id: `py${idx + 1}`, ...item })),
  NPM: PREBUILT_CATEGORIES.NPM.items.map((item, idx) => ({ id: `npm${idx + 1}`, ...item })),
  TMX: PREBUILT_CATEGORIES.TMX.items.map((item, idx) => ({ id: `tmx${idx + 1}`, ...item })),

  KEY_NAV: KEY_NAV_PRESETS,
  KEY_FN: KEY_FN_PRESETS,
  KEY_SYM: KEY_SYM_PRESETS,
  KEY_MODE: KEY_MODE_PRESETS,
  KEY_LINE: KEY_LINE_PRESETS
};
