import React from 'react';

/**
 * ButtonPreview — Center region live interactive button preview component for Button Studio.
 */
export default function ButtonPreview({ activeBtn }) {
  if (!activeBtn) return null;

  return (
    <div className="region-box center">
      <span className="center-tag">PREVIEW</span>
      <button
        type="button"
        className={`live-studio-btn ${activeBtn.shape || 'rounded'}`}
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
  );
}
