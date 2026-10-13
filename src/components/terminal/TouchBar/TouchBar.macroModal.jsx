/**
 * The macro catalogue modal: group tabs, the suite bar, the macro target toggle and the grid of the selected suite. It holds no state; the bar owns the selection and passes it in.
 */

import { Zap, X, Edit3, Terminal } from 'lucide-react';
import { isGlyphSymbol } from './TouchBar.keys';
import { SUB_LABELS, commandSuites } from './TouchBar.suites';

export function MacroModal({
  setShowMacroModal,
  selectedSuite,
  macroTarget,
  handleMacroTargetToggle,
  effectiveGroups,
  primaryGroup,
  setPrimaryGroup,
  setSelectedSuite,
  activeSuiteButtons,
  customMacroSuites,
  handleMacroPress,
}) {
  return (
    <div
      className="macro-modal-overlay"
      onTouchStart={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setShowMacroModal(false)}
    >
      <div
        className="macro-modal-content"
        onTouchStart={(e) => e.preventDefault()}
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="macro-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={16} color="var(--status-active)" />
            <h3>{selectedSuite.replace('KEY_', '')} TOOLKIT</h3>
          </div>

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

          <button className="close-modal-btn" onPointerDown={(e) => e.preventDefault()} onClick={() => setShowMacroModal(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Primary Category Group Selector Bar */}
        <div className="suite-selector-scroll">
          {Object.keys(effectiveGroups).map((groupKey) => {
            const isActive = primaryGroup === groupKey;
            return (
              <button
                key={groupKey}
                type="button"
                className={`suite-tab-pill ${isActive ? 'active' : ''}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPrimaryGroup(groupKey);
                  const defaultSub = effectiveGroups[groupKey].suites[0];
                  setSelectedSuite(defaultSub);
                }}
              >
                {effectiveGroups[groupKey].label}
              </button>
            );
          })}
        </div>

        {/* Sub-Suite Selector Bar for Active Group */}
        {effectiveGroups[primaryGroup] && (
          <div className="sub-suite-bar">
            {effectiveGroups[primaryGroup].suites.map((subKey) => {
              const isSubActive = selectedSuite === subKey;
              return (
                <button
                  key={subKey}
                  type="button"
                  className={`sub-suite-pill ${isSubActive ? 'active' : ''}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setSelectedSuite(subKey)}
                >
                  {SUB_LABELS[subKey] || subKey}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Suite Macro Grid */}
        <div className="macro-grid-3x4" style={{ marginTop: '0.75rem' }}>
          {activeSuiteButtons.map((macro) => {
            const isLauncher = macro.isSuiteLauncher || customMacroSuites.includes(macro.label) || Object.keys(commandSuites).includes(macro.label);

            return (
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
                  if (isLauncher) {
                    const targetGroup = Object.keys(effectiveGroups).find(g =>
                      effectiveGroups[g].suites.includes(macro.label)
                    ) || 'AI';
                    setPrimaryGroup(targetGroup);
                    setSelectedSuite(macro.label);
                  } else {
                    handleMacroPress(macro);
                    setShowMacroModal(false);
                  }
                }}
              >
                {macro.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
