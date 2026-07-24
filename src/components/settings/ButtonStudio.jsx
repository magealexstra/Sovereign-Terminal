import React, { useState } from 'react';
import { Edit3, Plus, Sliders, Palette, Code, Check } from 'lucide-react';

export default function ButtonStudio() {
  const [buttons, setButtons] = useState([
    { id: 'b1', label: 'ESC', value: '\x1b', width: 2.4, height: 2.2, shape: 'rounded', color: '#141E26' },
    { id: 'b2', label: 'TAB', value: '\t', width: 2.4, height: 2.2, shape: 'rounded', color: '#141E26' },
    { id: 'b3', label: '^C', value: '\x03', width: 2.4, height: 2.2, shape: 'rounded', color: '#141E26' },
    { id: 'b4', label: 'htop', value: 'htop\n', width: 3.2, height: 2.2, shape: 'pill', color: '#5E81AC' },
    { id: 'b5', label: 'docker ps', value: 'docker ps\n', width: 4.5, height: 2.2, shape: 'rounded', color: '#88C0D0' },
  ]);

  const [selectedId, setSelectedId] = useState('b4');
  const [activeRegion, setActiveRegion] = useState('left'); // 'left' | 'right' | 'bottom'

  const activeBtn = buttons.find((b) => b.id === selectedId) || buttons[0];

  const updateActiveBtn = (fields) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === activeBtn.id ? { ...b, ...fields } : b))
    );
  };

  const handleCreateNew = () => {
    const newId = `custom-${Date.now()}`;
    const newBtn = { id: newId, label: 'NEW', value: 'echo Hello\n', width: 3.2, height: 2.2, shape: 'rounded', color: '#5E81AC' };
    setButtons([...buttons, newBtn]);
    setSelectedId(newId);
  };

  return (
    <div className="button-studio-container">
      {/* Top Dropdown Selector */}
      <div className="studio-top-bar">
        <label>Select Button to Edit:</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {buttons.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label} ({b.value.trim()})
            </option>
          ))}
        </select>
        <button className="create-btn" onClick={handleCreateNew}>
          <Plus size={14} />
          <span>Create New</span>
        </button>
      </div>

      {/* Main Touch Studio Surround Grid */}
      <div className="studio-surround-grid">
        {/* Left Region: Command Output */}
        <div
          className={`studio-region left ${activeRegion === 'left' ? 'active' : ''}`}
          onClick={() => setActiveRegion('left')}
        >
          <div className="region-header">
            <Code size={15} color="#88C0D0" />
            <span>1. Command / Output Payload</span>
          </div>
          <div className="region-content">
            <label>Button Label:</label>
            <input
              type="text"
              value={activeBtn.label}
              onChange={(e) => updateActiveBtn({ label: e.target.value })}
            />

            <label>Sent Command String:</label>
            <textarea
              rows={3}
              value={activeBtn.value}
              onChange={(e) => updateActiveBtn({ value: e.target.value })}
              placeholder="e.g. docker ps\n"
            />
          </div>
        </div>

        {/* Center Region: Live Interactive Button Preview Console */}
        <div className="studio-center-preview">
          <span className="preview-label">LIVE BUTTON PREVIEW</span>
          <button
            className={`live-preview-btn ${activeBtn.shape}`}
            style={{
              width: `${activeBtn.width}rem`,
              height: `${activeBtn.height}rem`,
              backgroundColor: activeBtn.color,
            }}
          >
            {activeBtn.label}
          </button>
        </div>

        {/* Right Region: Size & Shape Controls */}
        <div
          className={`studio-region right ${activeRegion === 'right' ? 'active' : ''}`}
          onClick={() => setActiveRegion('right')}
        >
          <div className="region-header">
            <Sliders size={15} color="#5E81AC" />
            <span>2. Size & Shape Controls</span>
          </div>
          <div className="region-content">
            <div className="step-row">
              <label>Width ({activeBtn.width}rem):</label>
              <div className="btn-stepper">
                <button onClick={() => updateActiveBtn({ width: Math.max(2.0, Number((activeBtn.width - 0.2).toFixed(1))) })}>-</button>
                <button onClick={() => updateActiveBtn({ width: Number((activeBtn.width + 0.2).toFixed(1)) })}>+</button>
              </div>
            </div>

            <div className="step-row">
              <label>Height ({activeBtn.height}rem):</label>
              <div className="btn-stepper">
                <button onClick={() => updateActiveBtn({ height: Math.max(1.8, Number((activeBtn.height - 0.2).toFixed(1))) })}>-</button>
                <button onClick={() => updateActiveBtn({ height: Number((activeBtn.height + 0.2).toFixed(1)) })}>+</button>
              </div>
            </div>

            <label>Button Shape:</label>
            <div className="shape-options">
              <button
                className={activeBtn.shape === 'square' ? 'active' : ''}
                onClick={() => updateActiveBtn({ shape: 'square' })}
              >
                Square
              </button>
              <button
                className={activeBtn.shape === 'rounded' ? 'active' : ''}
                onClick={() => updateActiveBtn({ shape: 'rounded' })}
              >
                Rounded
              </button>
              <button
                className={activeBtn.shape === 'pill' ? 'active' : ''}
                onClick={() => updateActiveBtn({ shape: 'pill' })}
              >
                Pill
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Region: Color Swatches & Hex Input */}
        <div
          className={`studio-region bottom ${activeRegion === 'bottom' ? 'active' : ''}`}
          onClick={() => setActiveRegion('bottom')}
        >
          <div className="region-header">
            <Palette size={15} color="#4C7864" />
            <span>3. Color Selector</span>
          </div>
          <div className="region-content horizontal">
            <div className="swatch-picker">
              {['#141E26', '#2A3B4C', '#5E81AC', '#88C0D0', '#4C7864', '#FF003C', '#fbbf24'].map((color) => (
                <span
                  key={color}
                  className="studio-swatch"
                  style={{ backgroundColor: color }}
                  onClick={() => updateActiveBtn({ color })}
                />
              ))}
            </div>

            <div className="hex-input-group">
              <label>Hex Code:</label>
              <input
                type="text"
                value={activeBtn.color}
                onChange={(e) => updateActiveBtn({ color: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
