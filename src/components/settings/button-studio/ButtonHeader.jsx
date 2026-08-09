import React from 'react';
import { Plus, Save, Trash2, RotateCcw } from 'lucide-react';

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
  onCreateNew,
  onResetDelete,
  isResetMode,
  isResetDeleteDisabled,
}) {
  return (
    <div className="studio-top-row">
      <div className="studio-action-row">
        <button
          type="button"
          className="studio-action-btn studio-action-btn--create"
          onClick={onCreateNew}
        >
          <Plus size={14} />
          <span>CREATE</span>
        </button>

        <button
          type="button"
          className={`studio-action-btn ${isResetMode ? 'studio-action-btn--reset' : 'studio-action-btn--delete'}`}
          onClick={onResetDelete}
          disabled={isResetDeleteDisabled}
        >
          {isResetMode ? <RotateCcw size={14} /> : <Trash2 size={14} />}
          <span>{isResetMode ? 'RESET' : 'DELETE'}</span>
        </button>

        <button
          type="button"
          className="studio-action-btn studio-action-btn--save"
          onClick={() => {
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('sovereign_save_studio_buttons'));
            }
          }}
        >
          <Save size={14} />
          <span>SAVE</span>
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
