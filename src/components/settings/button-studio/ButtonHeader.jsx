import React from 'react';
import { Plus, Save } from 'lucide-react';

/**
 * ButtonHeader — Top search and dropdown selector navigation stack for Button Studio.
 */
export default function ButtonHeader({
  searchQuery,
  setSearchQuery,
  activeBtnId,
  filteredCustomButtons,
  displayCategories,
  onSelectPresetOrCustom,
  onCreateNew
}) {
  return (
    <div className="studio-top-row">
      <div className="studio-action-row" style={{ display: 'flex', width: '100%', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <button
          type="button"
          className="shape-tap-btn"
          style={{
            flex: 1,
            height: '36px',
            background: 'var(--bg-canopy)',
            border: '1.5px solid var(--status-active)',
            color: 'var(--text-parchment)',
            borderRadius: '10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            transition: 'all 0.15s ease'
          }}
          onClick={onCreateNew}
        >
          <Plus size={14} color="var(--status-active)" />
          <span>CREATE NEW BUTTON</span>
        </button>

        <button
          type="button"
          className="shape-tap-btn"
          style={{
            flex: 1,
            height: '36px',
            background: 'var(--bg-canopy)',
            border: '1.5px solid var(--accent-highlight)',
            color: 'var(--text-parchment)',
            borderRadius: '10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            transition: 'all 0.15s ease'
          }}
          onClick={() => {
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('sovereign_save_studio_buttons'));
            }
          }}
        >
          <Save size={14} color="var(--accent-highlight)" />
          <span>SAVE BUTTON</span>
        </button>
      </div>

      <div className="studio-top-select-group">
        <select
          className="studio-dropdown"
          style={{ flex: 1 }}
          value={activeBtnId || ''}
          onChange={(e) => onSelectPresetOrCustom(e.target.value)}
        >
          {/* SECTION 1: CUSTOM CREATIONS */}
          {filteredCustomButtons.length > 0 && (
            <optgroup label="CUSTOM CREATIONS">
              {filteredCustomButtons.map((b) => (
                <option key={b.id} value={b.id}>
                  [CUSTOM] {b.label || b.id} ({b.value ? String(b.value).trim() : ''})
                </option>
              ))}
            </optgroup>
          )}

          {/* SECTION 2: ALL LAYOUT TAB PRE-BUILT TOOLKITS */}
          <optgroup label="PRE-BUILT LAYOUT BUTTONS">
            {Object.entries(displayCategories)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([key, cat]) => (
                <React.Fragment key={key}>
                  {cat.items.map((item, idx) => (
                    <option key={`opt-${key}-${idx}`} value={item.label}>
                      [{key}] {item.label} ({item.value ? String(item.value).trim() : ''})
                    </option>
                  ))}
                </React.Fragment>
              ))}
          </optgroup>
        </select>
        <button type="button" className="studio-new-btn" onClick={onCreateNew}>
          <Plus size={13} />
          <span>New</span>
        </button>
      </div>
    </div>
  );
}
