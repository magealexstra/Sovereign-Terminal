import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_THEME_PRESETS } from './themePresets';

const AppContext = createContext(null);

const DEFAULT_TMUX_SETTINGS = {
  killOnClose: false,
  autoSweepOnStartup: false,
  scrollbackLines: 10000,
  escapeTimeMs: 10
};

// Base font size by device class: wider screens get 13px, phones 10px.
const getDeviceBaseline = () => (window.innerWidth >= 768 ? 13 : 10);

export function AppProvider({ children }) {
  const [activeMainTab, setActiveMainTab] = useState('terminal');

  // The provider's own state starts from hardcoded defaults and reads no localStorage on mount,
  // so a different user logging in on a shared device inherits nothing.
  // fetchUserSettings() restores the persisted state after auth.
  const [themes, setThemes] = useState(DEFAULT_THEME_PRESETS);
  const [theme, setThemeState] = useState(DEFAULT_THEME_PRESETS.VitniNordic);
  const [tmuxSettings, setTmuxSettingsState] = useState(DEFAULT_TMUX_SETTINGS);
  const [terminalScaleMultiplier, setTerminalScaleMultiplier] = useState(1.0);
  const [editorScaleMultiplier, setEditorScaleMultiplier] = useState(1.0);
  const [inputScaleMultiplier, setInputScaleMultiplier] = useState(1.0);

  const [terminalBgLightness, setTerminalBgLightness] = useState('6%');
  const [terminalMixColor, setTerminalMixColor] = useState('#FFFFFF');
  const [editorBgLightness, setEditorBgLightness] = useState('6%');
  const [editorMixColor, setEditorMixColor] = useState('#FFFFFF');
  const [inputBgLightness, setInputBgLightness] = useState('6%');
  const [inputMixColor, setInputMixColor] = useState(null);

  // Authenticated user identity — set by App.jsx after verify/login resolves.
  // Token users land on 'admin'; PAM users get their Linux username.
  const [username, setUsername] = useState('');

  // ── Profile Cache Helpers ─────────────────────────────────────────────────
  // Cache is keyed by username so different users on the same device never
  // bleed into each other. The cache is the speed layer; the server is truth.

  const _getCacheKey = (uname) => `sovereign_profile_${uname || 'default'}`;

  const _readProfileCache = (uname) => {
    try {
      const raw = localStorage.getItem(_getCacheKey(uname));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const _writeProfileCache = (uname, data) => {
    try {
      localStorage.setItem(_getCacheKey(uname), JSON.stringify(data));
    } catch {
      // The cache is only a speed layer; without storage the server copy is used.
    }
  };

  // Exposed to App.jsx — called during logout to wipe this user's cache so
  // the device returns cleanly to defaults for the next user.
  const clearUserCache = (uname) => {
    try {
      localStorage.removeItem(_getCacheKey(uname || username));
    } catch {
      // Storage unavailable: there is no cache to clear.
    }
  };

  // ── Settings Application ──────────────────────────────────────────────────
  // Single function that applies any settings object to all React state and
  // to the individual operational localStorage keys that components like
  // TouchBar listen to directly via the storage event.

  const _applySettingsObject = (settings) => {
    if (settings.customThemes) {
      const mergedThemes = { ...DEFAULT_THEME_PRESETS, ...settings.customThemes };
      setThemes(mergedThemes);
      try { localStorage.setItem('sovereign_custom_themes', JSON.stringify(settings.customThemes)); } catch {}
    }

    if (settings.activeThemeKey) {
      const allThemes = { ...DEFAULT_THEME_PRESETS, ...settings.customThemes };
      if (allThemes[settings.activeThemeKey]) {
        setThemeState(allThemes[settings.activeThemeKey]);
        try { localStorage.setItem('sovereign_active_theme_key', settings.activeThemeKey); } catch {}
      }
    }

    if (settings.buttons) {
      try { localStorage.setItem('sovereign_buttons', JSON.stringify(settings.buttons)); } catch {}
    }

    if (settings.custButton) {
      try { localStorage.setItem('sovereign_cust_button', JSON.stringify(settings.custButton)); } catch {}
    }

    if (settings.copyDestination) {
      try { localStorage.setItem('sovereign_copy_destination', settings.copyDestination); } catch {}
    }

    if (settings.layoutSlots && Array.isArray(settings.layoutSlots)) {
      try {
        localStorage.setItem('sovereign_layout_slots', JSON.stringify(settings.layoutSlots));
        window.dispatchEvent(new Event('storage')); // triggers TouchBar activeSlots update
      } catch {}
    }

    if (settings.tmux) {
      setTmuxSettingsState(prev => ({ ...DEFAULT_TMUX_SETTINGS, ...prev, ...settings.tmux }));
      try { localStorage.setItem('sovereign_tmux_settings', JSON.stringify(settings.tmux)); } catch {}
    }

    // Font scale multipliers from the saved profile; only positive numbers are accepted.
    if (typeof settings.terminalScaleMultiplier === 'number' && settings.terminalScaleMultiplier > 0) {
      setTerminalScaleMultiplier(settings.terminalScaleMultiplier);
    }
    if (typeof settings.editorScaleMultiplier === 'number' && settings.editorScaleMultiplier > 0) {
      setEditorScaleMultiplier(settings.editorScaleMultiplier);
    }
    if (typeof settings.inputScaleMultiplier === 'number' && settings.inputScaleMultiplier > 0) {
      setInputScaleMultiplier(settings.inputScaleMultiplier);
    }

    // Surface brightness & mix target color persistence
    if (settings.terminalBgLightness) setTerminalBgLightness(settings.terminalBgLightness);
    if (settings.terminalMixColor !== undefined) setTerminalMixColor(settings.terminalMixColor);
    if (settings.editorBgLightness) setEditorBgLightness(settings.editorBgLightness);
    if (settings.editorMixColor !== undefined) setEditorMixColor(settings.editorMixColor);
    if (settings.inputBgLightness) setInputBgLightness(settings.inputBgLightness);
    if (settings.inputMixColor !== undefined) setInputMixColor(settings.inputMixColor);
  };

  // ── Theme Setter ──────────────────────────────────────────────────────────
  const setTheme = (newTheme, themeKey = null) => {
    setThemeState(newTheme);
    try {
      if (themeKey) {
        localStorage.setItem('sovereign_active_theme_key', themeKey);
      } else {
        const matchingEntry = Object.entries(themes).find(([, val]) => val === newTheme);
        if (matchingEntry) {
          localStorage.setItem('sovereign_active_theme_key', matchingEntry[0]);
        }
      }
    } catch {}
  };

  // ── tmux Settings ─────────────────────────────────────────────────────────
  const setTmuxSettings = (partial) => {
    setTmuxSettingsState(prev => {
      const merged = { ...prev, ...partial };
      try { localStorage.setItem('sovereign_tmux_settings', JSON.stringify(merged)); } catch {}
      return merged;
    });
  };

  // ── Custom Theme Saver & Deleter ──────────────────────────────────────────
  // Returns true when the custom theme list was stored on this device.
  const saveCustomTheme = (customThemeObject) => {
    const themeKey = `Custom_${Date.now()}`;
    const formattedTheme = { ...customThemeObject, isCustom: true };
    const updatedThemes = { ...themes, [themeKey]: formattedTheme };
    setThemes(updatedThemes);
    // The new theme becomes the active one, so its key is stored as the active key.
    setTheme(formattedTheme, themeKey);
    try {
      const userCustomOnly = Object.fromEntries(
        Object.entries(updatedThemes).filter(([k, v]) => k.startsWith('Custom_') || v?.isCustom)
      );
      localStorage.setItem('sovereign_custom_themes', JSON.stringify(userCustomOnly));
      return true;
    } catch {
      return false;
    }
  };

  // Returns { found, stored }: whether a custom theme matched, and whether the new list was stored on this device.
  const deleteCustomTheme = (themeKeyOrName) => {
    const matchingEntry = Object.entries(themes).find(
      ([k, v]) => (k === themeKeyOrName || v?.name === themeKeyOrName) && (k.startsWith('Custom_') || v?.isCustom)
    );
    if (!matchingEntry) return { found: false, stored: true };

    const [targetKey, targetTheme] = matchingEntry;
    const updatedThemes = { ...themes };
    delete updatedThemes[targetKey];
    setThemes(updatedThemes);

    // The deleted theme was in use when it is the active object or the stored active key.
    let activeKey = null;
    try { activeKey = localStorage.getItem('sovereign_active_theme_key'); } catch { /* unreadable: compare by object only */ }
    if (theme === targetTheme || activeKey === targetKey) {
      const fallbackKey = updatedThemes.VitniNordic ? 'VitniNordic' : Object.keys(updatedThemes)[0];
      if (fallbackKey) setTheme(updatedThemes[fallbackKey], fallbackKey);
    }

    try {
      const userCustomOnly = Object.fromEntries(
        Object.entries(updatedThemes).filter(([k, v]) => k.startsWith('Custom_') || v?.isCustom)
      );
      localStorage.setItem('sovereign_custom_themes', JSON.stringify(userCustomOnly));
    } catch {
      return { found: true, stored: false };
    }

    return { found: true, stored: true };
  };

  // ── Dynamic Device Baseline ───────────────────────────────────────────────
  const [deviceBaselinePx, setDeviceBaselinePx] = useState(getDeviceBaseline);

  useEffect(() => {
    const handleResize = () => {
      const next = getDeviceBaseline();
      setDeviceBaselinePx((prev) => (prev !== next ? next : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const terminalFontSizePx = Math.round(deviceBaselinePx * terminalScaleMultiplier);
  const editorFontSizePx   = Math.round(deviceBaselinePx * editorScaleMultiplier);

  // ── CSS Custom Properties ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-earth',          theme.bgEarth);
    root.style.setProperty('--bg-canopy',         theme.bgCanopy);
    root.style.setProperty('--bg-panel',          theme.bgPanel || 'rgba(31, 45, 58, 0.85)');
    root.style.setProperty('--bg-grove',          theme.bgGrove || theme.bgCanopy);
    root.style.setProperty('--border-forest',     theme.borderForest);
    root.style.setProperty('--border-sage',       theme.borderSage || theme.accentMana);
    root.style.setProperty('--text-parchment',    theme.textParchment);
    root.style.setProperty('--text-muted',        theme.textMuted);
    root.style.setProperty('--text-dim',          theme.textDim || '#4C566A');
    root.style.setProperty('--accent-mana',       theme.accentMana);
    root.style.setProperty('--accent-highlight',  theme.accentHighlight);
    root.style.setProperty('--status-active',     theme.statusActive  || '#4C7864');
    root.style.setProperty('--status-confirm',    theme.brightGreen   || '#4d8c5e');
    root.style.setProperty('--status-danger',     theme.statusDanger  || '#FF003C');
    root.style.setProperty('--status-warning',    theme.statusWarning || '#fbbf24');
    root.style.setProperty('--accent-violet',     theme.accentViolet  || '#B48EAD');
    root.style.setProperty('--font-mono',         theme.fontMono);
    root.style.setProperty('--font-sans',         theme.fontSans);
    root.style.setProperty('--device-baseline-px', `${deviceBaselinePx}px`);
    root.style.setProperty('--font-size-terminal', `${terminalFontSizePx}px`);
    root.style.setProperty('--font-size-editor',   `${editorFontSizePx}px`);

    // Surface brightness lightness ratios & mix target colors
    root.style.setProperty('--terminal-bg-lightness', terminalBgLightness);
    root.style.setProperty('--terminal-mix-color',    terminalMixColor || '#FFFFFF');
    root.style.setProperty('--editor-bg-lightness',   editorBgLightness);
    root.style.setProperty('--editor-mix-color',      editorMixColor || '#FFFFFF');
    root.style.setProperty('--input-bg-lightness',    inputBgLightness);
    root.style.setProperty('--input-mix-color',       inputMixColor || '#FFFFFF');
    root.style.setProperty('--input-scale-multiplier', `${inputScaleMultiplier}`);

    document.body.style.backgroundColor = theme.bgEarth;
    document.body.style.color = theme.textParchment;
  }, [
    theme, deviceBaselinePx, terminalFontSizePx, editorFontSizePx,
    terminalBgLightness, terminalMixColor, editorBgLightness, editorMixColor,
    inputBgLightness, inputMixColor, inputScaleMultiplier
  ]);

  // ── Server Sync ───────────────────────────────────────────────────────────
  // Builds the canonical settings payload, POSTs to server, then mirrors the
  // result to the user-namespaced localStorage cache for fast restore.
  //
  // partialSettings overrides specific fields — used when calling immediately
  // after a setState (before the state update has propagated to the closure),
  // e.g. syncUserSettingsToServer({ terminalScaleMultiplier: newValue }).
  //
  // Resolves to true when the server accepted the profile and false when the
  // request failed or was rejected, so callers can tell the user.

  const syncUserSettingsToServer = async (partialSettings = {}) => {
    try {
      const activeThemeKey    = localStorage.getItem('sovereign_active_theme_key') || 'VitniNordic';
      const custBtn           = localStorage.getItem('sovereign_cust_button');
      const copyDest          = localStorage.getItem('sovereign_copy_destination');
      const buttonsRaw        = localStorage.getItem('sovereign_buttons');
      const layoutSlotsRaw    = localStorage.getItem('sovereign_layout_slots');
      const customThemesRaw   = localStorage.getItem('sovereign_custom_themes');
      const tmuxRaw           = localStorage.getItem('sovereign_tmux_settings');

      const payload = {
        activeThemeKey,
        custButton:             custBtn          ? JSON.parse(custBtn)          : null,
        copyDestination:        copyDest         || 'clip',
        buttons:                buttonsRaw       ? JSON.parse(buttonsRaw)       : null,
        layoutSlots:            layoutSlotsRaw   ? JSON.parse(layoutSlotsRaw)   : null,
        customThemes:           customThemesRaw  ? JSON.parse(customThemesRaw)  : null,
        tmux:                   tmuxRaw          ? JSON.parse(tmuxRaw)          : null,
        terminalScaleMultiplier,   // from React state closure
        editorScaleMultiplier,     // from React state closure
        inputScaleMultiplier,
        terminalBgLightness,
        terminalMixColor,
        editorBgLightness,
        editorMixColor,
        inputBgLightness,
        inputMixColor,
        ...partialSettings         // overrides for values set in the same render cycle
      };

      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Mirror the payload to the namespaced cache even when the server refused it,
      // so this device keeps the user's latest choices.
      if (username) {
        _writeProfileCache(username, payload);
      }
      return res.ok;
    } catch {
      return false;
    }
  };

  // ── Profile Fetch ─────────────────────────────────────────────────────────
  // Two-stage restore:
  //   1. Apply namespaced cache immediately — zero visible flash on return visits.
  //   2. Fetch server profile (authoritative) — overwrites cache if anything changed.
  //
  // Resolves to false when the server profile could not be read; the cached
  // profile stays applied in that case.

  const fetchUserSettings = async (uname) => {
    const effectiveUser = uname || username;

    // Stage 1: instant cache restore
    const cached = _readProfileCache(effectiveUser);
    if (cached) {
      _applySettingsObject(cached);
    }

    // Stage 2: server fetch (authoritative)
    try {
      const res = await fetch('/api/user/settings');
      if (!res.ok) return false;
      const data = await res.json();
      if (data.status === 'error') return false;
      const settings = data.settings || {};
      if (Object.keys(settings).length > 0) {
        _applySettingsObject(settings);
        // Update cache with latest authoritative data
        _writeProfileCache(effectiveUser, settings);
      }
      return true;
    } catch {
      return false;
    }
  };

  // ── Reset to Defaults ─────────────────────────────────────────────────────
  // Resolves like syncUserSettingsToServer: true when the server kept the reset.
  const resetToDefault = () => {
    setDeviceBaselinePx(getDeviceBaseline());
    setTheme(DEFAULT_THEME_PRESETS.VitniNordic, 'VitniNordic');
    setTerminalScaleMultiplier(1.0);
    setEditorScaleMultiplier(1.0);
    setInputScaleMultiplier(1.0);
    setTerminalBgLightness('6%');
    setTerminalMixColor('#FFFFFF');
    setEditorBgLightness('6%');
    setEditorMixColor('#FFFFFF');
    setInputBgLightness('6%');
    setInputMixColor(null);
    return syncUserSettingsToServer({
      activeThemeKey: 'VitniNordic',
      terminalScaleMultiplier: 1.0,
      editorScaleMultiplier: 1.0,
      inputScaleMultiplier: 1.0,
      terminalBgLightness: '6%',
      terminalMixColor: '#FFFFFF',
      editorBgLightness: '6%',
      editorMixColor: '#FFFFFF',
      inputBgLightness: '6%',
      inputMixColor: null
    });
  };

  return (
    <AppContext.Provider
      value={{
        activeMainTab,
        setActiveMainTab,
        theme,
        themes,
        setTheme: (newTheme, themeKey) => {
          setTheme(newTheme, themeKey);
          return syncUserSettingsToServer();
        },
        // Resolves to true when the theme was stored on this device and on the server.
        saveCustomTheme: async (customThemeObject) => {
          const stored = saveCustomTheme(customThemeObject);
          const synced = await syncUserSettingsToServer();
          return stored && synced;
        },
        // Resolves to true when a custom theme was removed and the change was stored on this device and on the server.
        deleteCustomTheme: async (themeKeyOrName) => {
          const { found, stored } = deleteCustomTheme(themeKeyOrName);
          const synced = await syncUserSettingsToServer();
          return found && stored && synced;
        },
        fetchUserSettings,
        syncUserSettingsToServer,
        resetToDefault,
        setUsername,
        clearUserCache,
        deviceBaselinePx,
        terminalScaleMultiplier,
        setTerminalScaleMultiplier,
        editorScaleMultiplier,
        setEditorScaleMultiplier,
        inputScaleMultiplier,
        setInputScaleMultiplier,
        terminalBgLightness,
        setTerminalBgLightness,
        terminalMixColor,
        setTerminalMixColor,
        editorBgLightness,
        setEditorBgLightness,
        editorMixColor,
        setEditorMixColor,
        inputBgLightness,
        setInputBgLightness,
        inputMixColor,
        setInputMixColor,
        tmuxSettings,
        setTmuxSettings,
        editorFontSizePx,
        fontSizeTerminal: terminalFontSizePx
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
