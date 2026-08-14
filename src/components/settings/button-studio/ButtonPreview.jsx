import React from 'react';

/**
 * ButtonPreview — Center region live interactive button preview component for Button Studio.
 */
const isGlyphSymbol = (str) => ['▲', '▼', '◀', '▶', '⏎', '◄', '►', '↑', '↓', '←', '→'].includes(str);

export default function ButtonPreview({ activeBtn }) {
  if (!activeBtn) return null;

  return (
    <div className="region-box center">
      <span className="center-tag">PREVIEW</span>
      <button
        type="button"
        className={`live-studio-btn ${activeBtn.shape || 'rounded'} ${isGlyphSymbol(activeBtn.label) ? 'glyph-icon-btn' : ''}`}
        style={{
          width: `${activeBtn.width}rem`,
          height: `${activeBtn.height}rem`,
          backgroundColor: activeBtn.bg || 'var(--bg-canopy)',
          color: activeBtn.text || 'var(--text-parchment)',
          borderColor: activeBtn.border || 'var(--border-sage)',
          borderWidth: '1.5px',
          borderStyle: 'solid'
        }}
      >
        {activeBtn.label}
      </button>
    </div>
  );
}
