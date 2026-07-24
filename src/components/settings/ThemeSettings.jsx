import React, { useState } from 'react';
import { Palette, Check, RefreshCw, Type, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ThemeSettings() {
  const { theme, setTheme, themes, updateCustomColor, resetToDefault } = useApp();
  const [terminalFontSize, setTerminalFontSize] = useState(14);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState('IBM Plex Mono');

  return (
    <div className="theme-settings-container">
      {/* 1. All 12 Open-Source MIT Theme Presets */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Palette size={14} color="#88C0D0" />
          <span>12 Open-Source MIT Theme Presets</span>
        </div>

        <div className="presets-full-grid">
          {Object.entries(themes || {}).map(([key, t]) => {
            const isActive = theme && theme.name === t.name;
            return (
              <div
                key={key}
                className={`full-preset-card ${isActive ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                <div className="preset-card-header">
                  <span className="preset-full-title">{t.name}</span>
                  {isActive && <Check size={12} color="#88C0D0" />}
                </div>

                <div className="swatches-5-strip">
                  <span style={{ backgroundColor: t.bgEarth || '#0A1118' }} title="Void" />
                  <span style={{ backgroundColor: t.bgCanopy || '#141E26' }} title="Card" />
                  <span style={{ backgroundColor: t.borderForest || '#2A3B4C' }} title="Border" />
                  <span style={{ backgroundColor: t.accentMana || '#5E81AC' }} title="Mana Blue" />
                  <span style={{ backgroundColor: t.accentHighlight || '#88C0D0' }} title="Polar Ice" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Hex Code Color Builder Studio */}
      <div className="theme-section">
        <div className="section-header-compact">
          <RefreshCw size={14} color="#5E81AC" />
          <span>Custom Hex Code Studio</span>
          <button type="button" className="reset-theme-btn" onClick={resetToDefault}>
            Reset Default
          </button>
        </div>

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
      </div>

      {/* 3. Typography & Font Controls (As specified in Blueprint TAB_3) */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Type size={14} color="#4C7864" />
          <span>Typography & Font Sizing</span>
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
    </div>
  );
}
