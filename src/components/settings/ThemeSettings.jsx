import React, { useState } from 'react';
import { Palette, Check, Settings, X, RefreshCw, Type, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ThemeSettings() {
  const { theme, setTheme, themes, updateCustomColor, resetToDefault } = useApp();
  const [editingTheme, setEditingTheme] = useState(null);

  const [terminalFontSize, setTerminalFontSize] = useState(14);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('IBM Plex Mono');

  const handleCreateCustom = () => {
    const newCustom = {
      name: 'Custom Theme',
      bgEarth: '#0A1118',
      bgCanopy: '#141E26',
      bgPanel: 'rgba(20, 30, 38, 0.85)',
      borderForest: '#2A3B4C',
      borderSage: '#5E81AC',
      textParchment: '#E6EDF0',
      textMuted: '#A3B1B8',
      accentMana: '#5E81AC',
      accentHighlight: '#88C0D0',
      statusActive: '#4C7864',
      fontMono: "'IBM Plex Mono', monospace",
      fontSans: "'IBM Plex Sans', sans-serif"
    };
    setTheme(newCustom);
    setEditingTheme(newCustom);
  };

  return (
    <div className="theme-settings-container">
      {/* 1. Main Viewport: Compact 3-Column Native Theme Buttons Grid */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Palette size={14} color="#88C0D0" />
          <span>12 Open-Source MIT Theme Presets</span>
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

      {/* 2. Main Page Typography & Font Controls (Always Visible) */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Type size={14} color="#4C7864" />
          <span>Typography & Font Sizing</span>
          <button type="button" className="reset-theme-btn" onClick={resetToDefault}>
            <RefreshCw size={11} />
            <span>Reset Default</span>
          </button>
        </div>

        <div className="font-controls-grid">
          <div className="font-control-card">
            <div className="font-control-label">
              <span>Terminal Font Size</span>
              <strong>{terminalFontSize}px</strong>
            </div>
            <input
              type="range"
              min="10"
              max="22"
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          <div className="font-control-card">
            <div className="font-control-label">
              <span>Editor Font Size</span>
              <strong>{editorFontSize}px</strong>
            </div>
            <input
              type="range"
              min="10"
              max="22"
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
      </div>

      {/* 3. Theme Customizer Pop-up Modal (All 6 Signature Color Pickers) */}
      {editingTheme && (
        <div className="explorer-modal-overlay" onClick={() => setEditingTheme(null)}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>🎨 Customize: {editingTheme.name}</h3>
              <button type="button" className="modal-close-x" onClick={() => setEditingTheme(null)}>
                <X size={16} />
              </button>
            </div>

            {/* All 6 Signature Hex Color Pickers */}
            <div className="modal-section-title">Color Palette (6 Colors)</div>
            <div className="custom-hex-grid">
              <div className="hex-picker-card">
                <span>Void Base</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.bgEarth || '#0A1118'}
                    onChange={(e) => updateCustomColor('bgEarth', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.bgEarth || '#0A1118'}
                    onChange={(e) => updateCustomColor('bgEarth', e.target.value)}
                  />
                </div>
              </div>

              <div className="hex-picker-card">
                <span>Card Panel</span>
                <div className="color-input-group">
                  <input
                    type="color"
                    value={theme?.bgCanopy || '#141E26'}
                    onChange={(e) => updateCustomColor('bgCanopy', e.target.value)}
                  />
                  <input
                    type="text"
                    value={theme?.bgCanopy || '#141E26'}
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
              <button className="submit" onClick={() => setEditingTheme(null)}>
                Apply & Save
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
