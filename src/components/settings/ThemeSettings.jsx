import React, { useState } from 'react';
import { Palette, Check, Settings, X, RefreshCw, Type, Plus, Save, Terminal as TermIcon, FileCode } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ThemeSettings() {
  const { theme, setTheme, themes, updateCustomColor, saveCustomTheme, resetToDefault } = useApp();
  const [editingTheme, setEditingTheme] = useState(null);
  const [customName, setCustomName] = useState('My Sovereign Custom');

  const [terminalFontSize, setTerminalFontSize] = useState(14);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('IBM Plex Mono');

  // Predefined editable preview text
  const [terminalSampleText, setTerminalSampleText] = useState(
    'mage@sovereign:~$ docker ps\nCONTAINER ID   IMAGE                STATUS\n896468d35eb4   sovereign-terminal   Up 30m (healthy)\nmage@sovereign:~$ echo "Theme Preview Active"'
  );

  const [editorSampleText, setEditorSampleText] = useState(
    'def initialize_sovereign_node(hostname="192.168.2.100"):\n    """Sovereign Workstation Node Gateway."""\n    print(f"Connected to {hostname}:2068")\n    return True'
  );

  // Extract 16 base colors of active theme
  const activeThemeSwatches = [
    theme.bgEarth || '#141E26',
    theme.bgCanopy || '#1F2D3A',
    theme.borderForest || '#2A3B4C',
    theme.borderSage || '#5E81AC',
    theme.textParchment || '#E6EDF0',
    theme.textMuted || '#A3B1B8',
    theme.textDim || '#4C566A',
    theme.accentMana || '#5E81AC',
    theme.accentHighlight || '#88C0D0',
    theme.statusActive || '#4C7864',
    '#282a36', '#bd93f9', '#ff79c6', '#50fa7b', '#f1fa8c', '#89b4fa'
  ];

  const handleCreateCustom = () => {
    const clonedActiveTheme = {
      ...theme,
      name: 'My Custom Theme'
    };
    setCustomName('My Custom Theme');
    setEditingTheme(clonedActiveTheme);
  };

  const handleSaveModal = () => {
    if (!editingTheme) return;
    const finalTheme = {
      ...editingTheme,
      name: customName || 'My Custom Theme',
      bgEarth: theme.bgEarth,
      bgCanopy: theme.bgCanopy,
      borderForest: theme.borderForest,
      textParchment: theme.textParchment,
      accentMana: theme.accentMana,
      accentHighlight: theme.accentHighlight
    };
    saveCustomTheme(finalTheme);
    setEditingTheme(null);
  };

  return (
    <div className="theme-settings-container">
      {/* 1. Main Viewport: Compact Native Theme Buttons Grid */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Palette size={14} color="#88C0D0" />
          <span>Theme Presets ({Object.keys(themes || {}).length})</span>
          <button type="button" className="create-custom-theme-btn" onClick={handleCreateCustom}>
            <Plus size={12} />
            <span>Custom Theme</span>
          </button>
        </div>

        <div className="native-theme-grid">
          {Object.entries(themes || {}).map(([key, t]) => {
            const isActive = theme && theme.name === t.name;
            return (
              <div
                key={key}
                className={`native-theme-button ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: t.bgEarth || '#0A1118',
                  color: t.textParchment || '#E6EDF0',
                  borderColor: t.accentMana || '#5E81AC',
                  boxShadow: isActive ? `0 0 12px ${t.accentHighlight || '#88C0D0'}` : 'none'
                }}
                onClick={() => setTheme(t)}
              >
                <div className="native-theme-header">
                  <span className="native-theme-title">{t.name}</span>
                  {isActive && <Check size={12} color={t.accentHighlight || '#88C0D0'} />}
                </div>

                <button
                  type="button"
                  className="native-gear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomName(t.name);
                    setEditingTheme(t);
                  }}
                  title="Customize Theme & Colors"
                >
                  <Settings size={12} color={t.accentHighlight || '#88C0D0'} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Typography Controls & Live Theme-Styled Interactive Preview Boxes */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Type size={14} color="#4C7864" />
          <span>Typography & Live Previews</span>
          <button type="button" className="reset-theme-btn" onClick={resetToDefault}>
            <RefreshCw size={11} />
            <span>Reset Default</span>
          </button>
        </div>

        <div className="font-controls-grid">
          <div className="font-control-card">
            <div className="font-control-label">
              <span>Terminal Font Size</span>
              <strong>{terminalFontSize}pt</strong>
            </div>
            <input
              type="range"
              min="6"
              max="20"
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          <div className="font-control-card">
            <div className="font-control-label">
              <span>Editor Font Size</span>
              <strong>{editorFontSize}pt</strong>
            </div>
            <input
              type="range"
              min="6"
              max="20"
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          <div className="font-control-card full-width">
            <span>Font Family</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="font-select-dropdown"
            >
              <option value="IBM Plex Mono">IBM Plex Mono (Nordic Standard)</option>
              <option value="Fira Code">Fira Code (Ligatures)</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Inconsolata">Inconsolata</option>
            </select>
          </div>
        </div>

        {/* DUAL LIVE THEME-STYLED INTERACTIVE PREVIEW WINDOWS */}
        <div className="live-font-preview-grid">
          {/* BOX 1: TERMINAL FONT PREVIEW */}
          <div className="preview-window-card">
            <div className="preview-card-header">
              <TermIcon size={12} color={theme.accentHighlight || '#88C0D0'} />
              <span>Terminal Font Preview ({terminalFontSize}pt)</span>
            </div>
            <textarea
              className="live-preview-textarea"
              style={{
                backgroundColor: theme.bgEarth || '#141E26',
                color: theme.textParchment || '#E6EDF0',
                borderColor: theme.accentMana || '#5E81AC',
                fontSize: `${terminalFontSize}pt`,
                fontFamily: fontFamily
              }}
              value={terminalSampleText}
              onChange={(e) => setTerminalSampleText(e.target.value)}
            />
          </div>

          {/* BOX 2: CODE EDITOR FONT PREVIEW */}
          <div className="preview-window-card">
            <div className="preview-card-header">
              <FileCode size={12} color={theme.accentMana || '#5E81AC'} />
              <span>Editor Font Preview ({editorFontSize}pt)</span>
            </div>
            <textarea
              className="live-preview-textarea"
              style={{
                backgroundColor: theme.bgCanopy || '#1F2D3A',
                color: theme.textParchment || '#E6EDF0',
                borderColor: theme.accentHighlight || '#88C0D0',
                fontSize: `${editorFontSize}pt`,
                fontFamily: fontFamily
              }}
              value={editorSampleText}
              onChange={(e) => setEditorSampleText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 3. Theme Customizer Pop-up Modal */}
      {editingTheme && (
        <div className="explorer-modal-overlay" onClick={() => setEditingTheme(null)}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>🎨 Customize Theme</h3>
              <button type="button" className="modal-close-x" onClick={() => setEditingTheme(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Theme Name Input */}
            <div className="theme-name-input-group">
              <label>Theme Name:</label>
              <input
                type="text"
                className="theme-name-field"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Mage Sovereign Dark"
              />
            </div>

            {/* Active Theme Base-16 Palette Swatches Bar */}
            <div className="modal-section-title">Active Base-16 Color Palette</div>
            <div className="modal-swatch-row">
              {activeThemeSwatches.map((color, idx) => (
                <span
                  key={`modal-swatch-${idx}`}
                  className="palette-dot"
                  style={{ backgroundColor: color }}
                  title={`Color: ${color}`}
                />
              ))}
            </div>

            {/* All 6 Signature Hex Color Pickers */}
            <div className="modal-section-title" style={{ marginTop: '0.6rem' }}>Color Palette (6 Colors)</div>
            <div className="custom-hex-grid">
              <div className="hex-picker-card">
                <span>Void Base</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.bgEarth || '#141E26'}
                    onChange={(e) => updateCustomColor('bgEarth', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.bgEarth || '#141E26'}
                    onChange={(e) => updateCustomColor('bgEarth', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Card Panel</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.bgCanopy || '#1F2D3A'}
                    onChange={(e) => updateCustomColor('bgCanopy', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.bgCanopy || '#1F2D3A'}
                    onChange={(e) => updateCustomColor('bgCanopy', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Border / Grid</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.borderForest || '#2A3B4C'}
                    onChange={(e) => updateCustomColor('borderForest', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.borderForest || '#2A3B4C'}
                    onChange={(e) => updateCustomColor('borderForest', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Primary Text</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.textParchment || '#E6EDF0'}
                    onChange={(e) => updateCustomColor('textParchment', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.textParchment || '#E6EDF0'}
                    onChange={(e) => updateCustomColor('textParchment', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Glacier Blue</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.accentMana || '#5E81AC'}
                    onChange={(e) => updateCustomColor('accentMana', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.accentMana || '#5E81AC'}
                    onChange={(e) => updateCustomColor('accentMana', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Polar Ice Cyan</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.accentHighlight || '#88C0D0'}
                    onChange={(e) => updateCustomColor('accentHighlight', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.accentHighlight || '#88C0D0'}
                    onChange={(e) => updateCustomColor('accentHighlight', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-btn-row" style={{ marginTop: '1rem' }}>
              <button className="submit" onClick={handleSaveModal}>
                <Save size={13} />
                <span>Save & Add to Presets</span>
              </button>
              <button onClick={resetToDefault}>
                Reset Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
