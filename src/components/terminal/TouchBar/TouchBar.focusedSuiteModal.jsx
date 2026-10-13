/**
 * The focused suite modal opened from a custom suite button on the bar: nested suite chips, the macro target toggle and the grid of that suite. It holds no state; the bar owns the selection and passes it in.
 */

import { X, Edit3, Terminal } from 'lucide-react';
import { isGlyphSymbol } from './TouchBar.keys';

export function FocusedSuiteModal({
  setShowFocusedSuiteModal,
  setFocusedSubSuite,
  focusedSuiteName,
  macroTarget,
  handleMacroTargetToggle,
  focusedChips,
  focusedSubSuite,
  focusedRegularButtons,
  handleMacroPress,
}) {
  return (
    <div
      className="macro-modal-overlay"
      onTouchStart={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setShowFocusedSuiteModal(false)}
    >
      <div
        className="macro-modal-content"
        onTouchStart={(e) => e.preventDefault()}
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="macro-modal-header">
          <button
            className="focused-suite-title-reset"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setFocusedSubSuite(null)}
            title="Tap to return to root suite view"
          >
            <h3>{focusedSuiteName}</h3>
          </button>

          <div className="macro-target-toggle">
            <button
              type="button"
              className={`target-pill ${macroTarget === 'stager' ? 'active' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleMacroTargetToggle('stager');
              }}
              title="Route macro selection to Command Stager"
            >
              <Edit3 size={11} />
              <span>STAGER</span>
            </button>
            <button
              type="button"
              className={`target-pill ${macroTarget === 'terminal' ? 'active' : ''}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleMacroTargetToggle('terminal');
              }}
              title="Route macro selection directly to Terminal PTY"
            >
              <Terminal size={11} />
              <span>PTY</span>
            </button>
          </div>

          <button className="close-modal-btn" onPointerDown={(e) => e.preventDefault()} onClick={() => setShowFocusedSuiteModal(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Chip tabs for nested macro suites (self-filtered: root suite never shows in its own chips) */}
        {focusedChips.length > 0 && (
          <div className="sub-suite-bar">
            {focusedChips.map(chip => (
              <button
                key={chip.id}
                type="button"
                className={`sub-suite-pill ${focusedSubSuite === chip.label ? 'active' : ''}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setFocusedSubSuite(chip.label)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Command button grid */}
        <div className="macro-grid-3x4" style={{ marginTop: '0.75rem' }}>
          {focusedRegularButtons.length === 0 && focusedChips.length === 0 ? (
            <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', padding: '0.5rem', gridColumn: '1 / -1' }}>
              No buttons in this suite yet. Add some in the Layout tab.
            </span>
          ) : (
            focusedRegularButtons.map(macro => (
              <button
                key={macro.id}
                className={`macro-grid-btn ${macro.shape || ''} ${isGlyphSymbol(macro.label) ? 'glyph-icon-btn' : ''}`}
                style={macro.bg || macro.text || macro.border || macro.width || macro.height ? {
                  background: macro.bg || undefined,
                  color: macro.text || undefined,
                  borderColor: macro.border || undefined,
                  width: macro.width ? `${macro.width}rem` : undefined,
                  height: macro.height ? `${macro.height}rem` : undefined,
                } : {}}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleMacroPress(macro);
                  setShowFocusedSuiteModal(false);
                }}
              >
                {macro.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
