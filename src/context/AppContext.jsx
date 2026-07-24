import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(null);

export const DEFAULT_THEME_PRESETS = {
  VitniNordic: {
    name: 'Vitni Nordic Forest (Default)',
    bgEarth: '#141E26',
    bgCanopy: '#1F2D3A',
    bgPanel: 'rgba(31, 45, 58, 0.85)',
    borderForest: '#2A3B4C',
    borderSage: '#5E81AC',
    textParchment: '#E6EDF0',
    textMuted: '#A3B1B8',
    textDim: '#4C566A',
    accentMana: '#5E81AC',
    accentHighlight: '#88C0D0',
    statusActive: '#4C7864',
    fontMono: "'IBM Plex Mono', monospace",
    fontSans: "'IBM Plex Sans', sans-serif"
  },
  Dracula: {
    name: 'Dracula',
    bgEarth: '#282a36',
    bgCanopy: '#44475a',
    bgPanel: 'rgba(68, 71, 90, 0.85)',
    borderForest: '#6272a4',
    borderSage: '#bd93f9',
    textParchment: '#f8f8f2',
    textMuted: '#6272a4',
    textDim: '#44475a',
    accentMana: '#bd93f9',
    accentHighlight: '#ff79c6',
    statusActive: '#50fa7b',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  OneDark: {
    name: 'One Dark Pro',
    bgEarth: '#21252b',
    bgCanopy: '#282c34',
    bgPanel: 'rgba(40, 44, 52, 0.85)',
    borderForest: '#3e4451',
    borderSage: '#61afef',
    textParchment: '#abb2bf',
    textMuted: '#5c6370',
    textDim: '#3e4451',
    accentMana: '#61afef',
    accentHighlight: '#98c379',
    statusActive: '#98c379',
    fontMono: "'JetBrains Mono', monospace",
    fontSans: "'Inter', sans-serif"
  },
  TokyoNight: {
    name: 'Tokyo Night',
    bgEarth: '#1a1b26',
    bgCanopy: '#24283b',
    bgPanel: 'rgba(36, 40, 59, 0.85)',
    borderForest: '#414868',
    borderSage: '#7aa2f7',
    textParchment: '#a9b1d6',
    textMuted: '#565f89',
    textDim: '#414868',
    accentMana: '#7aa2f7',
    accentHighlight: '#bb9af7',
    statusActive: '#9ece6a',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  SolarizedDark: {
    name: 'Solarized Dark',
    bgEarth: '#002b36',
    bgCanopy: '#073642',
    bgPanel: 'rgba(7, 54, 66, 0.85)',
    borderForest: '#586e75',
    borderSage: '#268bd2',
    textParchment: '#839496',
    textMuted: '#657b83',
    textDim: '#586e75',
    accentMana: '#268bd2',
    accentHighlight: '#2aa198',
    statusActive: '#859900',
    fontMono: "'Inconsolata', monospace",
    fontSans: "'Inter', sans-serif"
  },
  MonokaiPro: {
    name: 'Monokai Pro',
    bgEarth: '#2d2a2e',
    bgCanopy: '#3a373b',
    bgPanel: 'rgba(58, 55, 59, 0.85)',
    borderForest: '#5b585c',
    borderSage: '#ffd866',
    textParchment: '#fcfcfa',
    textMuted: '#727072',
    textDim: '#5b585c',
    accentMana: '#ffd866',
    accentHighlight: '#ff6188',
    statusActive: '#a9dc76',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  Nord: {
    name: 'Nord',
    bgEarth: '#2e3440',
    bgCanopy: '#3b4252',
    bgPanel: 'rgba(59, 66, 82, 0.85)',
    borderForest: '#4c566a',
    borderSage: '#88c0d0',
    textParchment: '#d8dee9',
    textMuted: '#e5e9f0',
    textDim: '#4c566a',
    accentMana: '#88c0d0',
    accentHighlight: '#81a1c1',
    statusActive: '#a3be8c',
    fontMono: "'IBM Plex Mono', monospace",
    fontSans: "'IBM Plex Sans', sans-serif"
  },
  CatppuccinMocha: {
    name: 'Catppuccin Mocha',
    bgEarth: '#1e1e2e',
    bgCanopy: '#181825',
    bgPanel: 'rgba(24, 24, 37, 0.85)',
    borderForest: '#313244',
    borderSage: '#89b4fa',
    textParchment: '#cdd6f4',
    textMuted: '#a6adc8',
    textDim: '#585b70',
    accentMana: '#89b4fa',
    accentHighlight: '#f5e0dc',
    statusActive: '#a6e3a1',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  GruvboxDark: {
    name: 'Gruvbox Dark',
    bgEarth: '#282828',
    bgCanopy: '#3c3836',
    bgPanel: 'rgba(60, 56, 54, 0.85)',
    borderForest: '#504945',
    borderSage: '#fe8019',
    textParchment: '#ebdbb2',
    textMuted: '#a89984',
    textDim: '#665c54',
    accentMana: '#fe8019',
    accentHighlight: '#fabd2f',
    statusActive: '#b8bb26',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  Kanagawa: {
    name: 'Kanagawa',
    bgEarth: '#1f1f28',
    bgCanopy: '#2a2a37',
    bgPanel: 'rgba(42, 42, 55, 0.85)',
    borderForest: '#363646',
    borderSage: '#7e9cd8',
    textParchment: '#dcd7ba',
    textMuted: '#717c7c',
    textDim: '#54546d',
    accentMana: '#7e9cd8',
    accentHighlight: '#98bb6c',
    statusActive: '#98bb6c',
    fontMono: "'IBM Plex Mono', monospace",
    fontSans: "'IBM Plex Sans', sans-serif"
  },
  RosePine: {
    name: 'Rose Pine',
    bgEarth: '#191724',
    bgCanopy: '#1f1d2e',
    bgPanel: 'rgba(31, 29, 46, 0.85)',
    borderForest: '#26233a',
    borderSage: '#ebbcba',
    textParchment: '#e0def4',
    textMuted: '#908caa',
    textDim: '#6e6a86',
    accentMana: '#ebbcba',
    accentHighlight: '#9ccfd8',
    statusActive: '#31748f',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  },
  Cyberpunk2077: {
    name: 'Cyberpunk 2077',
    bgEarth: '#120428',
    bgCanopy: '#1e0938',
    bgPanel: 'rgba(30, 9, 56, 0.85)',
    borderForest: '#fcee0a',
    borderSage: '#05d9e8',
    textParchment: '#fdfdfd',
    textMuted: '#05d9e8',
    textDim: '#1e0938',
    accentMana: '#fcee0a',
    accentHighlight: '#05d9e8',
    statusActive: '#fcee0a',
    fontMono: "'Fira Code', monospace",
    fontSans: "'Inter', sans-serif"
  }
};

export function AppProvider({ children }) {
  const [activeMainTab, setActiveMainTab] = useState('terminal');
  
  // Restore saved custom themes from localStorage
  const [themes, setThemes] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_custom_themes');
      return saved ? { ...DEFAULT_THEME_PRESETS, ...JSON.parse(saved) } : DEFAULT_THEME_PRESETS;
    } catch {
      return DEFAULT_THEME_PRESETS;
    }
  });

  // Restore saved active theme from localStorage
  const [theme, setThemeState] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('sovereign_active_theme');
      return savedTheme ? JSON.parse(savedTheme) : DEFAULT_THEME_PRESETS.VitniNordic;
    } catch {
      return DEFAULT_THEME_PRESETS.VitniNordic;
    }
  });

  // Restore saved font sizes from localStorage
  const [fontSizeTerminal, setFontSizeTerminalState] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_font_terminal');
      return saved ? Number(saved) : 14;
    } catch {
      return 14;
    }
  });

  const [fontSizeEditor, setFontSizeEditorState] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_font_editor');
      return saved ? Number(saved) : 14;
    } catch {
      return 14;
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('sovereign_active_theme', JSON.stringify(newTheme));
    } catch (e) {}
  };

  const setFontSizeTerminal = (size) => {
    setFontSizeTerminalState(size);
    try {
      localStorage.setItem('sovereign_font_terminal', size.toString());
    } catch (e) {}
  };

  const setFontSizeEditor = (size) => {
    setFontSizeEditorState(size);
    try {
      localStorage.setItem('sovereign_font_editor', size.toString());
    } catch (e) {}
  };

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
    root.style.setProperty('--font-size-terminal', `${fontSizeTerminal}px`);
    root.style.setProperty('--font-size-editor', `${fontSizeEditor}px`);

    document.body.style.backgroundColor = theme.bgEarth;
    document.body.style.color = theme.textParchment;
  }, [theme, fontSizeTerminal, fontSizeEditor]);

  const updateCustomColor = (key, value) => {
    const updated = { ...theme, [key]: value };
    setTheme(updated);
  };

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
    setFontSizeTerminal(14);
    setFontSizeEditor(14);
  };

  return (
    <AppContext.Provider
      value={{
        activeMainTab,
        setActiveMainTab,
        theme,
        themes,
        setTheme,
        updateCustomColor,
        saveCustomTheme,
        resetToDefault,
        fontSizeTerminal,
        setFontSizeTerminal,
        fontSizeEditor,
        setFontSizeEditor
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
