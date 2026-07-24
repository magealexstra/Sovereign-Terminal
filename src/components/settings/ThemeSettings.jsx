import React, { useState } from 'react';
import { Palette, Type, Check, RefreshCw } from 'lucide-react';
import { useApp, THEME_PRESETS } from '../../context/AppContext';

export default function ThemeSettings() {
  const { currentThemeKey, selectThemePreset, theme, setTheme, fontSizeTerminal, setFontSizeTerminal, fontSizeEditor, setFontSizeEditor } = useApp();
  const [customMode, setCustomMode] = useState(currentThemeKey === 'Custom');

  const [customColors, setCustomColors] = useState({
    bgEarth: theme.bgEarth || '#0A1118',
    bgCanopy: theme.bgCanopy || '#141E26',
    textParchment: theme.textParchment || '#E6EDF0',
    accentMana: theme.accentMana || '#5E81AC',
    accentHighlight: theme.accentHighlight || '#88C0D0',
    statusActive: theme.statusActive || '#4C7864',
  });

  const handleCustomColorChange = (key, value) => {
    const updated = { ...customColors, [key]: value };
    setCustomColors(updated);
    setTheme({
      name: 'Custom Hex Color Scheme',
      ...updated,
      bgPanel: 'rgba(20, 30, 38, 0.8)',
      borderForest: '#2A3B4C',
      borderSage: updated.accentMana,
      textMuted: '#A3B1B8',
      textDim: '#4C566A',
      fontMono: theme.fontMono,
      fontSans: theme.fontSans
    });
  };

  return (
    <div className="theme-settings-container">
      <div className="settings-section">
        <div className="section-title">
          <Palette size={18} color="#88C0D0" />
          <h3>1-Click Open-Source Theme Presets</h3>
        </div>

        <div className="preset-grid">
          {Object.keys(THEME_PRESETS).map((key) => {
            const p = THEME_PRESETS[key];
            const isSelected = currentThemeKey === key && !customMode;
            return (
              <div
                key={key}
                className={`preset-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  setCustomMode(false);
                  selectThemePreset(key);
                }}
              >
                <div className="preset-header">
                  <span className="preset-name">{p.name}</span>
                  {isSelected && <Check size={14} color="#88C0D0" />}
                </div>
                <div className="preset-swatches">
                  <span className="swatch" style={{ background: p.bgEarth }} title="Background" />
                  <span className="swatch" style={{ background: p.bgCanopy }} title="Card" />
                  <span className="swatch" style={{ background: p.accentMana }} title="Accent" />
                  <span className="swatch" style={{ background: p.accentHighlight }} title="Highlight" />
                  <span className="swatch" style={{ background: p.textParchment }} title="Text" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Color Scheme Builder Studio */}
      <div className="settings-section">
        <div className="section-title">
          <RefreshCw size={18} color="#5E81AC" />
          <h3>Custom Hex Code Color Builder Studio</h3>
        </div>

        <div className="custom-studio-card">
          <div className="custom-color-row">
            <label>Background (Void):</label>
            <input
              type="text"
              value={customColors.bgEarth}
              onChange={(e) => handleCustomColorChange('bgEarth', e.target.value)}
            />
            <input
              type="color"
              value={customColors.bgEarth.startsWith('#') ? customColors.bgEarth : '#0A1118'}
              onChange={(e) => handleCustomColorChange('bgEarth', e.target.value)}
            />
          </div>

          <div className="custom-color-row">
            <label>Card / Panel:</label>
            <input
              type="text"
              value={customColors.bgCanopy}
              onChange={(e) => handleCustomColorChange('bgCanopy', e.target.value)}
            />
            <input
              type="color"
              value={customColors.bgCanopy.startsWith('#') ? customColors.bgCanopy : '#141E26'}
              onChange={(e) => handleCustomColorChange('bgCanopy', e.target.value)}
            />
          </div>

          <div className="custom-color-row">
            <label>Primary Text:</label>
            <input
              type="text"
              value={customColors.textParchment}
              onChange={(e) => handleCustomColorChange('textParchment', e.target.value)}
            />
            <input
              type="color"
              value={customColors.textParchment.startsWith('#') ? customColors.textParchment : '#E6EDF0'}
              onChange={(e) => handleCustomColorChange('textParchment', e.target.value)}
            />
          </div>

          <div className="custom-color-row">
            <label>Primary Accent:</label>
            <input
              type="text"
              value={customColors.accentMana}
              onChange={(e) => handleCustomColorChange('accentMana', e.target.value)}
            />
            <input
              type="color"
              value={customColors.accentMana.startsWith('#') ? customColors.accentMana : '#5E81AC'}
              onChange={(e) => handleCustomColorChange('accentMana', e.target.value)}
            />
          </div>

          <div className="custom-color-row">
            <label>Highlight / Link:</label>
            <input
              type="text"
              value={customColors.accentHighlight}
              onChange={(e) => handleCustomColorChange('accentHighlight', e.target.value)}
            />
            <input
              type="color"
              value={customColors.accentHighlight.startsWith('#') ? customColors.accentHighlight : '#88C0D0'}
              onChange={(e) => handleCustomColorChange('accentHighlight', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Font Size Sliders */}
      <div className="settings-section">
        <div className="section-title">
          <Type size={18} color="#88C0D0" />
          <h3>Typography & Font Scaling</h3>
        </div>

        <div className="font-control-card">
          <div className="font-slider-row">
            <label>Terminal Font Size ({fontSizeTerminal}px):</label>
            <input
              type="range"
              min="10"
              max="24"
              value={fontSizeTerminal}
              onChange={(e) => setFontSizeTerminal(Number(e.target.value))}
            />
          </div>

          <div className="font-slider-row">
            <label>CodeEditor Font Size ({fontSizeEditor}px):</label>
            <input
              type="range"
              min="10"
              max="24"
              value={fontSizeEditor}
              onChange={(e) => setFontSizeEditor(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
