import React, { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_THEME_PRESETS } from './themePresets';

// Re-export so any file importing DEFAULT_THEME_PRESETS from AppContext.jsx
// continues to work without changes.
export { DEFAULT_THEME_PRESETS };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeMainTab, setActiveMainTab] = useState('terminal');
  const [themes, setThemes] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_custom_themes');
      return saved ? { ...DEFAULT_THEME_PRESETS, ...JSON.parse(saved) } : DEFAULT_THEME_PRESETS;
    } catch {
      return DEFAULT_THEME_PRESETS;
    }
  });

  const [theme, setThemeState] = useState(() => {
    try {
      const savedKey = localStorage.getItem('sovereign_active_theme_key');
      const allThemes = { ...DEFAULT_THEME_PRESETS };
      const savedCustom = localStorage.getItem('sovereign_custom_themes');
      if (savedCustom) {
        Object.assign(allThemes, JSON.parse(savedCustom));
      }
      if (savedKey && allThemes[savedKey]) {
        return allThemes[savedKey];
      }
    } catch {}
    return DEFAULT_THEME_PRESETS.VitniNordic;
  });

  const setTheme = (newTheme, themeKey = null) => {
    setThemeState(newTheme);
    try {
      if (themeKey) {
        localStorage.setItem('sovereign_active_theme_key', themeKey);
      } else {
        // Find matching key in themes or presets
        const matchingEntry = Object.entries(themes).find(([, val]) => val === newTheme);
        if (matchingEntry) {
          localStorage.setItem('sovereign_active_theme_key', matchingEntry[0]);
        }
      }
    } catch {}
  };

  const [terminalScaleMultiplier, setTerminalScaleMultiplier] = useState(1.0);
  const [editorScaleMultiplier, setEditorScaleMultiplier] = useState(1.0);

  const DEFAULT_TMUX_SETTINGS = { killOnClose: false, autoSweepOnStartup: false, scrollbackLines: 10000, escapeTimeMs: 10 };
  const [tmuxSettings, setTmuxSettingsState] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_tmux_settings');
      return saved ? { ...DEFAULT_TMUX_SETTINGS, ...JSON.parse(saved) } : DEFAULT_TMUX_SETTINGS;
    } catch {
      return DEFAULT_TMUX_SETTINGS;
    }
  });
  const setTmuxSettings = (partial) => {
    setTmuxSettingsState(prev => {
      const merged = { ...prev, ...partial };
      try { localStorage.setItem('sovereign_tmux_settings', JSON.stringify(merged)); } catch {}
      return merged;
    });
  };

  // Dynamic Device Baseline Detection (Default: 10px for maximum terminal real estate)
  const getDeviceBaseline = () => {
    return 10;
  };

  const [deviceBaselinePx, setDeviceBaselinePx] = useState(getDeviceBaseline);

  useEffect(() => {
    const handleResize = () => {
      setDeviceBaselinePx(getDeviceBaseline());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute Deterministic Integer Pixels (Math.round for sharp XTerm WebGL rendering)
  const terminalFontSizePx = Math.round(deviceBaselinePx * terminalScaleMultiplier);
  const editorFontSizePx = Math.round(deviceBaselinePx * editorScaleMultiplier);
  const iconSizeSm = Math.max(12, Math.round(deviceBaselinePx * 0.95));
  const iconSizeMd = Math.max(14, Math.round(deviceBaselinePx * 1.1));
  const iconSizeLg = Math.max(18, Math.round(deviceBaselinePx * 1.3));

  // Dynamically apply CSS custom properties to document root & body
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-earth', theme.bgEarth);
    root.style.setProperty('--bg-canopy', theme.bgCanopy);
    root.style.setProperty('--bg-panel', theme.bgPanel || 'rgba(31, 45, 58, 0.85)');
    root.style.setProperty('--border-forest', theme.borderForest);
    root.style.setProperty('--border-sage', theme.borderSage || theme.accentMana);
    root.style.setProperty('--text-parchment', theme.textParchment);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--text-dim', theme.textDim || '#4C566A');
    root.style.setProperty('--accent-mana', theme.accentMana);
    root.style.setProperty('--accent-highlight', theme.accentHighlight);
    root.style.setProperty('--status-active',    theme.statusActive    || '#4C7864');
    root.style.setProperty('--status-danger',    theme.statusDanger    || '#FF003C');
    root.style.setProperty('--status-warning',   theme.statusWarning   || '#fbbf24');
    root.style.setProperty('--accent-violet',    theme.accentViolet    || '#B48EAD');
    root.style.setProperty('--font-mono', theme.fontMono);
    root.style.setProperty('--font-sans', theme.fontSans);
    root.style.setProperty('--device-baseline-px', `${deviceBaselinePx}px`);
    root.style.setProperty('--font-size-terminal', `${terminalFontSizePx}px`);
    root.style.setProperty('--font-size-editor', `${editorFontSizePx}px`);

    document.body.style.backgroundColor = theme.bgEarth;
    document.body.style.color = theme.textParchment;
  }, [theme, deviceBaselinePx, terminalFontSizePx, editorFontSizePx]);


  const saveCustomTheme = (customThemeObject) => {
    const themeKey = `Custom_${Date.now()}`;
    const updatedThemes = {
      ...themes,
      [themeKey]: customThemeObject
    };
    setThemes(updatedThemes);
    setTheme(customThemeObject);

    try {
      const userCustomOnly = Object.fromEntries(
        Object.entries(updatedThemes).filter(([k]) => k.startsWith('Custom_'))
      );
      localStorage.setItem('sovereign_custom_themes', JSON.stringify(userCustomOnly));
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e);
    }
  };

  const syncUserSettingsToServer = async (partialSettings = {}) => {
    try {
      const activeThemeKey = localStorage.getItem('sovereign_active_theme_key') || 'VitniNordic';
      const custBtn = localStorage.getItem('sovereign_cust_button');
      const copyDest = localStorage.getItem('sovereign_copy_destination');
      const buttonsRaw = localStorage.getItem('sovereign_buttons');
      const layoutSlotsRaw = localStorage.getItem('sovereign_layout_slots');
      const customThemesRaw = localStorage.getItem('sovereign_custom_themes');

      const tmuxRaw = localStorage.getItem('sovereign_tmux_settings');

      const payload = {
        activeThemeKey,
        custButton: custBtn ? JSON.parse(custBtn) : null,
        copyDestination: copyDest || 'clip',
        buttons: buttonsRaw ? JSON.parse(buttonsRaw) : null,
        layoutSlots: layoutSlotsRaw ? JSON.parse(layoutSlotsRaw) : null,
        customThemes: customThemesRaw ? JSON.parse(customThemesRaw) : null,
        tmux: tmuxRaw ? JSON.parse(tmuxRaw) : null,
        ...partialSettings
      };

      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {}
  };

  const fetchUserSettings = async () => {
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || {};

        if (settings.customThemes) {
          const mergedThemes = { ...DEFAULT_THEME_PRESETS, ...settings.customThemes };
          setThemes(mergedThemes);
          try { localStorage.setItem('sovereign_custom_themes', JSON.stringify(settings.customThemes)); } catch {}
        }

        if (settings.activeThemeKey) {
          const allThemes = { ...DEFAULT_THEME_PRESETS, ...(settings.customThemes || {}) };
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
          try {
            setTmuxSettingsState(prev => ({ ...prev, ...settings.tmux }));
            localStorage.setItem('sovereign_tmux_settings', JSON.stringify(settings.tmux));
          } catch {}
        }
      }
    } catch {}
  };

  const resetToDefault = () => {
    setTheme(DEFAULT_THEME_PRESETS.VitniNordic, 'VitniNordic');
    setTerminalScaleMultiplier(1.0);
    setEditorScaleMultiplier(1.0);
    syncUserSettingsToServer({ activeThemeKey: 'VitniNordic' });
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
          syncUserSettingsToServer();
        },
        saveCustomTheme: (customThemeObject) => {
          saveCustomTheme(customThemeObject);
          syncUserSettingsToServer();
        },
        fetchUserSettings,
        syncUserSettingsToServer,
        resetToDefault,
        deviceBaselinePx,
        terminalScaleMultiplier,
        setTerminalScaleMultiplier,
        editorScaleMultiplier,
        setEditorScaleMultiplier,
        tmuxSettings,
        setTmuxSettings,
        terminalFontSizePx,
        editorFontSizePx,
        iconSizeSm,
        iconSizeMd,
        iconSizeLg,
        fontSizeTerminal: terminalFontSizePx,
        setFontSizeTerminal: (val) => {
          if (typeof val === 'number' && val > 2) {
            setTerminalScaleMultiplier(val / deviceBaselinePx);
          }
        },
        fontSizeEditor: editorFontSizePx,
        setFontSizeEditor: (val) => {
          if (typeof val === 'number' && val > 2) {
            setEditorScaleMultiplier(val / deviceBaselinePx);
          }
        }
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
