import React, { useState } from 'react';
import { Plus, Sliders, Palette, Code } from 'lucide-react';

export default function ButtonStudio() {
  const [buttons, setButtons] = useState([
    { id: 'b1', label: 'ESC', value: '\x1b', width: 2.4, height: 2.0, shape: 'rounded', color: '#141E26' },
    { id: 'b2', label: 'TAB', value: '\t', width: 2.4, height: 2.0, shape: 'rounded', color: '#141E26' },
    { id: 'b3', label: '^C', value: '\x03', width: 2.4, height: 2.0, shape: 'rounded', color: '#141E26' },
    { id: 'b4', label: 'htop', value: 'htop\n', width: 3.2, height: 2.0, shape: 'pill', color: '#5E81AC' },
    { id: 'b5', label: 'docker ps', value: 'docker ps\n', width: 4.2, height: 2.0, shape: 'rounded', color: '#88C0D0' },
  ]);

  const [selectedId, setSelectedId] = useState('b4');
  const activeBtn = buttons.find((b) => b.id === selectedId) || buttons[0];

  const updateActiveBtn = (fields) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === activeBtn.id ? { ...b, ...fields } : b))
    );
  };

  const handleCreateNew = () => {
    const newId = `custom-${Date.now()}`;
    const newBtn = { id: newId, label: 'NEW', value: 'echo Hello\n', width: 3.2, height: 2.0, shape: 'rounded', color: '#5E81AC' };
    setButtons([...buttons, newBtn]);
    setSelectedId(newId);
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

      {/* Main Touch Surround Grid - Contained within Single Mobile Viewport */}
      <div className="studio-mobile-grid">
        {/* LEFT REGION: Command Output & Label */}
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
              placeholder="Command String"
            />
          </div>
        </div>

        {/* CENTER REGION: Live Interactive Button Preview Console */}
        <div className="region-box center">
          <span className="center-tag">PREVIEW</span>
          <button
            type="button"
            className={`live-studio-btn ${activeBtn.shape}`}
            style={{
              width: `${activeBtn.width}rem`,
              height: `${activeBtn.height}rem`,
              backgroundColor: activeBtn.color,
            }}
          >
            {activeBtn.label}
          </button>
        </div>

        {/* RIGHT REGION: Size & Shape Controls */}
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

        {/* BOTTOM REGION: Color Selector & Hex Code */}
        <div className="region-box bottom">
          <div className="region-tag"><Palette size={12} color="#4C7864" /> Color Palette</div>
          <div className="bottom-palette-row">
            <div className="swatch-strip">
              {['#141E26', '#2A3B4C', '#5E81AC', '#88C0D0', '#4C7864', '#FF003C', '#fbbf24'].map((color) => (
                <span
                  key={color}
                  className="palette-dot"
                  style={{ backgroundColor: color }}
                  onClick={() => updateActiveBtn({ color })}
                />
              ))}
            </div>
            <input
              type="text"
              className="micro-input hex-input"
              value={activeBtn.color}
              onChange={(e) => updateActiveBtn({ color: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
