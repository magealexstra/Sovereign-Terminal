import React from 'react';
import { Type, Square, Layers, Plus, Trash2 } from 'lucide-react';

/**
 * AuditionConsole — Bottom color target selector and swatch palette / hex audition console.
 */
export default function AuditionConsole({
  targetLayer,
  setTargetLayer,
  themeSwatches,
  customSwatches,
  auditionHex,
  setAuditionHex,
  onApplySwatch,
  onAddSwatch,
  onClearAudition
}) {
  return (
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
                onClick={() => onApplySwatch(color)}
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
                    onClick={() => onApplySwatch(color)}
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
            onClick={() => onApplySwatch(auditionHex)}
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
            <button type="button" className="add-swatch-btn" onClick={onAddSwatch}>
              <Plus size={12} />
              <span>Add</span>
            </button>
            <button type="button" className="clear-swatch-btn" onClick={onClearAudition}>
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
