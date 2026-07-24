import React, { useState } from 'react';
import { Move, RefreshCw, Layout, Smartphone, Check } from 'lucide-react';

export default function LayoutBuilder() {
  const [targetBar, setTargetBar] = useState('terminal'); // 'terminal' | 'editor'
  const [dockPosition, setDockPosition] = useState('bottom'); // 'bottom' | 'right' | 'left' | 'top'
  const [alignment, setAlignment] = useState('center'); // 'start' | 'center' | 'end' | 'disperse'
  const [selectedPoolKey, setSelectedPoolKey] = useState(null);

  const [dockKeys, setDockKeys] = useState(['ESC', 'TAB', '^C', 'htop', 'docker ps']);

  const buttonPool = ['ESC', 'TAB', '^C', '^Z', '|', '~', '/', '-', 'htop', 'docker ps', 'git status', 'aegis', 'clear'];

  const cycleAlignment = () => {
    const states = ['start', 'center', 'end', 'disperse'];
    const nextIdx = (states.indexOf(alignment) + 1) % states.length;
    setAlignment(states[nextIdx]);
  };

  const handleTapPool = (key) => {
    setSelectedPoolKey(key);
  };

  const handleTapSlot = (index) => {
    if (!selectedPoolKey) return;
    const updated = [...dockKeys];
    updated[index] = selectedPoolKey;
    setDockKeys(updated);
    setSelectedPoolKey(null);
  };

  return (
    <div className="layout-builder-container">
      {/* Target Bar Selector */}
      <div className="builder-top-tabs">
        <button
          className={`builder-tab ${targetBar === 'terminal' ? 'active' : ''}`}
          onClick={() => setTargetBar('terminal')}
        >
          <span>Terminal Touch Bar</span>
        </button>
        <button
          className={`builder-tab ${targetBar === 'editor' ? 'active' : ''}`}
          onClick={() => setTargetBar('editor')}
        >
          <span>Editor Touch Bar</span>
        </button>
      </div>

      {/* Edge Dock & Handedness Controls */}
      <div className="dock-config-bar">
        <div className="dock-option-group">
          <Smartphone size={16} color="#88C0D0" />
          <label>Edge Dock Position:</label>
          <div className="position-btns">
            {['bottom', 'right', 'left', 'top'].map((pos) => (
              <button
                key={pos}
                className={dockPosition === pos ? 'active' : ''}
                onClick={() => setDockPosition(pos)}
              >
                {pos.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button className="align-cycle-btn" onClick={cycleAlignment}>
          <RefreshCw size={14} />
          <span>Align: {alignment.toUpperCase()}</span>
        </button>
      </div>

      {/* Target Edge Dock Slots (Tap-Tap Target) */}
      <div className="dock-slots-preview">
        <h4>Target Edge Dock Slots (Tap slot to place selected button)</h4>
        <div className={`dock-slots-row align-${alignment}`}>
          {dockKeys.map((key, idx) => (
            <div
              key={idx}
              className={`dock-slot ${selectedPoolKey ? 'target-ready' : ''}`}
              onClick={() => handleTapSlot(idx)}
            >
              <span>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Central Button Pool (Tap-Tap Source) */}
      <div className="button-pool-section">
        <h4>Central Button Pool (Tap button to select)</h4>
        <div className="pool-grid">
          {buttonPool.map((key) => (
            <button
              key={key}
              className={`pool-btn ${selectedPoolKey === key ? 'selected' : ''}`}
              onClick={() => handleTapPool(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
