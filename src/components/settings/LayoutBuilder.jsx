import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, AlignLeft, AlignCenter, AlignRight, Maximize2, MoveVertical } from 'lucide-react';

export default function LayoutBuilder() {
  // Active Bar Selection: 'top' | 'bottom' | 'left' | 'right'
  const [activeBar, setActiveBar] = useState('bottom');
  
  // Sorting State per Bar: 'start' | 'center' | 'end' | 'disperse'
  const [barSorts, setBarSorts] = useState({
    top: 'center',
    bottom: 'center',
    left: 'center',
    right: 'center',
  });

  // Selected Pool Button for 2-Tap Placement
  const [selectedPoolKey, setSelectedPoolKey] = useState(null);

  // Perimeter Slot Allocations (Exact 1:1 Squares)
  const [slots, setSlots] = useState({
    top: ['ESC', 'TAB', '^C', '^Z', '|', '~'],
    bottom: ['htop', 'docker', 'git', 'clear', 'ip a', 'df -h'],
    left: ['ESC', 'TAB', '^C', 'htop'],
    right: ['^Z', '|', 'clear', 'docker'],
  });

  // Central Button Pool (16 Buttons Matrix around ⚡ MACROS)
  const buttonPool = [
    'ESC', 'TAB', '^C', '^Z',
    '|', '⚡ MACROS', '~', '/',
    'htop', 'docker', 'git', 'clear',
    'sudo', 'ls -la', 'nano', 'exit'
  ];

  // Helper to compute dynamic font size class based on text length
  const getFontSizeClass = (text) => {
    if (!text) return 'text-md';
    const len = text.length;
    if (len <= 3) return 'text-lg';    // e.g. ESC, TAB, ^C, git
    if (len <= 5) return 'text-md';    // e.g. htop, sudo, nano
    if (len <= 7) return 'text-sm';    // e.g. docker, clear, ip a
    return 'text-xs';                  // e.g. ⚡ MACROS, ls -la
  };

  const handleTapPool = (key) => {
    setSelectedPoolKey(key);
  };

  const handleTapSlot = (bar, index) => {
    if (!selectedPoolKey) return;
    const updated = [...slots[bar]];
    updated[index] = selectedPoolKey;
    setSlots({ ...slots, [bar]: updated });
    setSelectedPoolKey(null);
  };

  const handleSortChange = (sortType) => {
    setBarSorts({ ...barSorts, [activeBar]: sortType });
  };

  const isHorizontal = activeBar === 'top' || activeBar === 'bottom';

  return (
    <div className="layout-builder-wrapper">
      {/* UPPER VIEWPORT: Perfect 1:1 Square Matrix Surround Grid */}
      <div className="perfect-square-frame">
        {/* TOP ROW SLOTS */}
        <div className={`perimeter-row top-row ${activeBar === 'top' ? 'active-bar' : ''}`}>
          {slots.top.map((key, idx) => (
            <div
              key={`top-${idx}`}
              className={`square-slot-box ${getFontSizeClass(key)} ${selectedPoolKey ? 'target-pulse' : ''}`}
              onClick={() => handleTapSlot('top', idx)}
            >
              <span>{key}</span>
            </div>
          ))}
        </div>

        {/* MIDDLE SECTION: LEFT COL + CENTER POOL + RIGHT COL */}
        <div className="perimeter-middle-section">
          {/* LEFT COL SLOTS */}
          <div className={`perimeter-col left-col ${activeBar === 'left' ? 'active-bar' : ''}`}>
            {slots.left.map((key, idx) => (
              <div
                key={`left-${idx}`}
                className={`square-slot-box ${getFontSizeClass(key)} ${selectedPoolKey ? 'target-pulse' : ''}`}
                onClick={() => handleTapSlot('left', idx)}
              >
                <span>{key}</span>
              </div>
            ))}
          </div>

          {/* CENTER BUTTON POOL (4x4 Matrix around ⚡ MACROS) */}
          <div className="center-pool-container">
            <div className="pool-4x4-grid">
              {buttonPool.map((key) => {
                const isMacros = key === '⚡ MACROS';
                const isSelected = selectedPoolKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`square-pool-tile ${getFontSizeClass(key)} ${isMacros ? 'macros-anchor' : ''} ${isSelected ? 'selected-glow' : ''}`}
                    onClick={() => handleTapPool(key)}
                  >
                    {isMacros ? (
                      <span className="macros-label"><Zap size={11} color="#88C0D0" /> MACROS</span>
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT COL SLOTS */}
          <div className={`perimeter-col right-col ${activeBar === 'right' ? 'active-bar' : ''}`}>
            {slots.right.map((key, idx) => (
              <div
                key={`right-${idx}`}
                className={`square-slot-box ${getFontSizeClass(key)} ${selectedPoolKey ? 'target-pulse' : ''}`}
                onClick={() => handleTapSlot('right', idx)}
              >
                <span>{key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM ROW SLOTS */}
        <div className={`perimeter-row bottom-row ${activeBar === 'bottom' ? 'active-bar' : ''}`}>
          {slots.bottom.map((key, idx) => (
            <div
              key={`bottom-${idx}`}
              className={`square-slot-box ${getFontSizeClass(key)} ${selectedPoolKey ? 'target-pulse' : ''}`}
              onClick={() => handleTapSlot('bottom', idx)}
            >
              <span>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LOWER THUMB CONTROL CONSOLE */}
      <div className="lower-thumb-console">
        {/* ROW 1: BAR SELECTOR BUTTONS */}
        <div className="bar-selector-row">
          <button
            type="button"
            className={`bar-select-btn ${activeBar === 'top' ? 'active' : ''}`}
            onClick={() => setActiveBar('top')}
          >
            <ArrowUp size={13} />
            <span>Top</span>
          </button>

          <button
            type="button"
            className={`bar-select-btn ${activeBar === 'bottom' ? 'active' : ''}`}
            onClick={() => setActiveBar('bottom')}
          >
            <ArrowDown size={13} />
            <span>Bottom</span>
          </button>

          <button
            type="button"
            className={`bar-select-btn ${activeBar === 'left' ? 'active' : ''}`}
            onClick={() => setActiveBar('left')}
          >
            <ArrowLeft size={13} />
            <span>Left</span>
          </button>

          <button
            type="button"
            className={`bar-select-btn ${activeBar === 'right' ? 'active' : ''}`}
            onClick={() => setActiveBar('right')}
          >
            <ArrowRight size={13} />
            <span>Right</span>
          </button>
        </div>

        {/* ROW 2: DYNAMIC CONTEXT-SENSITIVE SORTING BUTTONS */}
        <div className="dynamic-sorting-row">
          {isHorizontal ? (
            <>
              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'start' ? 'active' : ''}`}
                onClick={() => handleSortChange('start')}
              >
                <AlignLeft size={13} />
                <span>Collect Left</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'center' ? 'active' : ''}`}
                onClick={() => handleSortChange('center')}
              >
                <AlignCenter size={13} />
                <span>Center</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'end' ? 'active' : ''}`}
                onClick={() => handleSortChange('end')}
              >
                <AlignRight size={13} />
                <span>Collect Right</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'disperse' ? 'active' : ''}`}
                onClick={() => handleSortChange('disperse')}
              >
                <Maximize2 size={13} />
                <span>Disperse</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'start' ? 'active' : ''}`}
                onClick={() => handleSortChange('start')}
              >
                <ArrowUp size={13} />
                <span>Collect Top</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'center' ? 'active' : ''}`}
                onClick={() => handleSortChange('center')}
              >
                <AlignCenter size={13} />
                <span>Center</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'end' ? 'active' : ''}`}
                onClick={() => handleSortChange('end')}
              >
                <ArrowDown size={13} />
                <span>Collect Bottom</span>
              </button>

              <button
                type="button"
                className={`sort-action-btn ${barSorts[activeBar] === 'disperse' ? 'active' : ''}`}
                onClick={() => handleSortChange('disperse')}
              >
                <MoveVertical size={13} />
                <span>Disperse</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
