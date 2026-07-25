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

  const [theme, setTheme] = useState(DEFAULT_THEME_PRESETS.VitniNordic);
  const [terminalScaleMultiplier, setTerminalScaleMultiplier] = useState(1.0);
  const [editorScaleMultiplier, setEditorScaleMultiplier] = useState(1.0);

  // Dynamic Device Baseline Detection (Phone: 12px, Tablet: 15px, Desktop: 16px)
  const getDeviceBaseline = () => {
    if (typeof window === 'undefined') return 14;
    const width = window.innerWidth;
    if (width < 600) return 12;
    if (width <= 1024) return 15;
    return 16;
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
    root.style.setProperty('--status-active', theme.statusActive || '#4C7864');
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

  const resetToDefault = () => {
    setTheme(DEFAULT_THEME_PRESETS.VitniNordic);
    setTerminalScaleMultiplier(1.0);
    setEditorScaleMultiplier(1.0);
  };

  return (
    <AppContext.Provider
      value={{
        activeMainTab,
        setActiveMainTab,
        theme,
        themes,
        setTheme,
        saveCustomTheme,
        resetToDefault,
        deviceBaselinePx,
        terminalScaleMultiplier,
        setTerminalScaleMultiplier,
        editorScaleMultiplier,
        setEditorScaleMultiplier,
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
