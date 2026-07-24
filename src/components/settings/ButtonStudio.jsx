import React, { useState } from 'react';
import { Plus, Sliders, Palette, Code, Trash2, Check, Type, Square, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ButtonStudio() {
  const { theme } = useApp();

  const [buttons, setButtons] = useState([
    { id: 'b1', label: 'ESC', value: '\x1b', width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b2', label: 'TAB', value: '\t', width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b3', label: '^C', value: '\x03', width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b4', label: 'htop', value: 'htop\n', width: 3.2, height: 2.0, shape: 'pill', bg: '#141E26', text: '#5E81AC', border: '#4C7864' },
    { id: 'b5', label: 'docker ps', value: 'docker ps\n', width: 4.2, height: 2.0, shape: 'rounded', bg: '#21252b', text: '#88C0D0', border: '#fcee0a' },
  ]);

  const [selectedId, setSelectedId] = useState('b4');
  const activeBtn = buttons.find((b) => b.id === selectedId) || buttons[0];

  const [targetLayer, setTargetLayer] = useState('bg');
  const [auditionHex, setAuditionHex] = useState('#88C0D0');
  const [customSwatches, setCustomSwatches] = useState(['#FF003C', '#00FFCC', '#FFA500']);

  // Dynamic Theme Base 16 Swatches with safe optional chaining
  const themeSwatches = [
    theme?.bgEarth || '#141E26',
    theme?.bgCanopy || '#1F2D3A',
    theme?.borderForest || '#2A3B4C',
    theme?.borderSage || '#5E81AC',
    theme?.textParchment || '#E6EDF0',
    theme?.textMuted || '#A3B1B8',
    theme?.textDim || '#4C566A',
    theme?.accentMana || '#5E81AC',
    theme?.accentHighlight || '#88C0D0',
    theme?.statusActive || '#4C7864',
    '#282a36', '#bd93f9', '#ff79c6', '#50fa7b', '#f1fa8c', '#89b4fa'
  ];

  const updateActiveBtn = (fields) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === activeBtn.id ? { ...b, ...fields } : b))
    );
  };

  const handleCreateNew = () => {
    const newId = `custom-${Date.now()}`;
    const newBtn = {
      id: newId,
      label: 'NEW',
      value: 'echo Hello\n',
      width: 3.2,
      height: 2.0,
      shape: 'rounded',
      bg: theme?.bgCanopy || '#1F2D3A',
      text: theme?.textParchment || '#E6EDF0',
      border: theme?.accentMana || '#5E81AC'
    };
    setButtons([...buttons, newBtn]);
    setSelectedId(newId);
  };

  const handleApplySwatch = (color) => {
    if (targetLayer === 'bg') updateActiveBtn({ bg: color });
    if (targetLayer === 'text') updateActiveBtn({ text: color });
    if (targetLayer === 'border') updateActiveBtn({ border: color });
  };

  const handleAddSwatch = () => {
    if (auditionHex && !customSwatches.includes(auditionHex)) {
      setCustomSwatches([...customSwatches, auditionHex]);
    }
  };

  const handleClearAudition = () => {
    setAuditionHex('#88C0D0');
  };

  return (
    <div className="touch-studio-mobile-window">
      {/* Top Dropdown Navigation Row */}
      <div className="studio-top-row">
        <select
          className="studio-dropdown"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {buttons.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} ({b.value.trim()})
            </option>
          ))}
        </select>
        <button type="button" className="studio-new-btn" onClick={handleCreateNew}>
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>

      {/* Main Surround Grid */}
      <div className="studio-mobile-grid">
        <div className="region-box left">
          <div className="region-tag"><Code size={12} color="#88C0D0" /> Output</div>
          <div className="region-inputs">
            <input
              type="text"
              className="micro-input"
              value={activeBtn.label}
              onChange={(e) => updateActiveBtn({ label: e.target.value })}
              placeholder="Label"
            />
            <input
              type="text"
              className="micro-input"
              value={activeBtn.value}
              onChange={(e) => updateActiveBtn({ value: e.target.value })}
              placeholder="Command Payload"
            />
          </div>
        </div>

        <div className="region-box center">
          <span className="center-tag">PREVIEW</span>
          <button
            type="button"
            className={`live-studio-btn ${activeBtn.shape}`}
            style={{
              width: `${activeBtn.width}rem`,
              height: `${activeBtn.height}rem`,
              backgroundColor: activeBtn.bg,
              color: activeBtn.text,
              borderColor: activeBtn.border,
              borderWidth: '2px',
              borderStyle: 'solid'
            }}
          >
            {activeBtn.label}
          </button>
        </div>

        <div className="region-box right">
          <div className="region-tag"><Sliders size={12} color="#5E81AC" /> Size & Shape</div>
          <div className="region-steppers">
            <div className="micro-step-row">
              <span>W:</span>
              <button type="button" onClick={() => updateActiveBtn({ width: Math.max(1.8, Number((activeBtn.width - 0.2).toFixed(1))) })}>-</button>
              <span>{activeBtn.width}</span>
              <button type="button" onClick={() => updateActiveBtn({ width: Number((activeBtn.width + 0.2).toFixed(1)) })}>+</button>
            </div>
            <div className="micro-step-row">
              <span>H:</span>
              <button type="button" onClick={() => updateActiveBtn({ height: Math.max(1.5, Number((activeBtn.height - 0.2).toFixed(1))) })}>-</button>
              <span>{activeBtn.height}</span>
              <button type="button" onClick={() => updateActiveBtn({ height: Number((activeBtn.height + 0.2).toFixed(1)) })}>+</button>
            </div>
            <div className="micro-shapes">
              <button type="button" className={activeBtn.shape === 'square' ? 'active' : ''} onClick={() => updateActiveBtn({ shape: 'square' })}>Sq</button>
              <button type="button" className={activeBtn.shape === 'rounded' ? 'active' : ''} onClick={() => updateActiveBtn({ shape: 'rounded' })}>Rd</button>
              <button type="button" className={activeBtn.shape === 'pill' ? 'active' : ''} onClick={() => updateActiveBtn({ shape: 'pill' })}>Pill</button>
            </div>
          </div>
        </div>
      </div>

      {/* Target Color Layer & Audition Console */}
      <div className="studio-lower-color-console">
        <div className="target-layer-row">
          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'text' ? 'active' : ''}`}
            onClick={() => setTargetLayer('text')}
          >
            <Type size={12} />
            <span>Text Color</span>
          </button>

          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'bg' ? 'active' : ''}`}
            onClick={() => setTargetLayer('bg')}
          >
            <Square size={12} />
            <span>Background</span>
          </button>

          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'border' ? 'active' : ''}`}
            onClick={() => setTargetLayer('border')}
          >
            <Layers size={12} />
            <span>Border / Icon</span>
          </button>
        </div>

        <div className="dual-color-console">
          <div className="vertical-swatch-palette">
            <span className="swatch-group-title">Theme Swatches (16)</span>
            <div className="swatch-grid-rows">
              {themeSwatches.map((color, idx) => (
                <span
                  key={`theme-${idx}-${color}`}
                  className="palette-dot"
                  style={{ backgroundColor: color }}
                  onClick={() => handleApplySwatch(color)}
                  title={`Apply ${color} to ${targetLayer}`}
                />
              ))}
            </div>

            {customSwatches.length > 0 && (
              <>
                <span className="swatch-group-title" style={{ marginTop: '0.4rem' }}>User Custom Swatches</span>
                <div className="swatch-grid-rows">
                  {customSwatches.map((color, idx) => (
                    <span
                      key={`custom-${idx}-${color}`}
                      className="palette-dot custom-dot"
                      style={{ backgroundColor: color }}
                      onClick={() => handleApplySwatch(color)}
                      title={`Apply ${color} to ${targetLayer}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="right-audition-panel">
            <div
              className="large-audition-box"
              style={{ backgroundColor: auditionHex }}
              onClick={() => handleApplySwatch(auditionHex)}
              title="Tap to apply color directly to selected layer"
            >
              <span>{auditionHex}</span>
            </div>

            <div className="audition-input-row">
              <input
                type="color"
                className="audition-native-picker"
                value={auditionHex}
                onChange={(e) => setAuditionHex(e.target.value)}
              />
              <input
                type="text"
                className="audition-hex-input"
                value={auditionHex}
                onChange={(e) => setAuditionHex(e.target.value)}
                placeholder="#HEX"
              />
            </div>

            <div className="audition-btn-row">
              <button type="button" className="add-swatch-btn" onClick={handleAddSwatch}>
                <Plus size={12} />
                <span>Add</span>
              </button>
              <button type="button" className="clear-swatch-btn" onClick={handleClearAudition}>
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
