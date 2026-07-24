import React, { useState } from 'react';
import { Palette, Check, Settings, X, RefreshCw, Type } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ThemeSettings() {
  const { theme, setTheme, themes, updateCustomColor, resetToDefault } = useApp();
  const [editingTheme, setEditingTheme] = useState(null);

  const [terminalFontSize, setTerminalFontSize] = useState(14);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('IBM Plex Mono');

  return (
    <div className="theme-settings-container">
      {/* 1. Main Viewport: Compact 3-Column Native Theme Buttons Grid */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Palette size={14} color="#88C0D0" />
          <span>12 Open-Source MIT Theme Presets</span>
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
                  title="Customize Theme & Fonts"
                >
                  <Settings size={12} color={t.accentHighlight || '#88C0D0'} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Theme Customizer Pop-up Modal */}
      {editingTheme && (
        <div className="explorer-modal-overlay" onClick={() => setEditingTheme(null)}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3>🎨 Customize: {editingTheme.name}</h3>
              <button type="button" className="modal-close-x" onClick={() => setEditingTheme(null)}>
                <X size={16} />
              </button>
            </div>

            {/* Hex Color Pickers */}
            <div className="modal-section-title">Color Palette</div>
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

            {/* Typography Controls */}
            <div className="modal-section-title" style={{ marginTop: '0.75rem' }}>Typography & Fonts</div>
            <div className="font-controls-grid">
              <div className="font-control-card">
                <div className="font-control-label">
                  <span>Terminal Font</span>
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
                  <span>Editor Font</span>
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
