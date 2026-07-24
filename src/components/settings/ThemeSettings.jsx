import React from 'react';
import { Palette, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ThemeSettings() {
  const { theme, setTheme, themes, updateCustomColor, resetToDefault } = useApp();

  return (
    <div className="theme-settings-container">
      {/* 1. Open-Source 12 MIT Presets (Compact 3-Column Mobile Micro Grid) */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Palette size={14} color="#88C0D0" />
          <span>12 Open-Source MIT Theme Presets</span>
        </div>

        <div className="compact-preset-grid">
          {Object.entries(themes).map(([key, t]) => {
            const isActive = theme.name === t.name;
            return (
              <div
                key={key}
                className={`micro-preset-card ${isActive ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                <div className="micro-swatch-row">
                  <span style={{ backgroundColor: t.bgVoid }} />
                  <span style={{ backgroundColor: t.bgCard }} />
                  <span style={{ backgroundColor: t.accentGlacier }} />
                  <span style={{ backgroundColor: t.accentPolar }} />
                </div>
                <div className="micro-preset-footer">
                  <span className="micro-preset-name">{t.name}</span>
                  {isActive && <Check size={11} color="#88C0D0" />}
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
                value={theme.bgVoid}
                onChange={(e) => updateCustomColor('bgVoid', e.target.value)}
              />
              <input
                type="text"
                value={theme.bgVoid}
                onChange={(e) => updateCustomColor('bgVoid', e.target.value)}
              />
            </div>
          </div>

          <div className="hex-picker-card">
            <span>Card Panel</span>
            <div className="color-input-group">
              <input
                type="color"
                value={theme.bgCard}
                onChange={(e) => updateCustomColor('bgCard', e.target.value)}
              />
              <input
                type="text"
                value={theme.bgCard}
                onChange={(e) => updateCustomColor('bgCard', e.target.value)}
              />
            </div>
          </div>

          <div className="hex-picker-card">
            <span>Glacier Blue</span>
            <div className="color-input-group">
              <input
                type="color"
                value={theme.accentGlacier}
                onChange={(e) => updateCustomColor('accentGlacier', e.target.value)}
              />
              <input
                type="text"
                value={theme.accentGlacier}
                onChange={(e) => updateCustomColor('accentGlacier', e.target.value)}
              />
            </div>
          </div>

          <div className="hex-picker-card">
            <span>Polar Ice Cyan</span>
            <div className="color-input-group">
              <input
                type="color"
                value={theme.accentPolar}
                onChange={(e) => updateCustomColor('accentPolar', e.target.value)}
              />
              <input
                type="text"
                value={theme.accentPolar}
                onChange={(e) => updateCustomColor('accentPolar', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
