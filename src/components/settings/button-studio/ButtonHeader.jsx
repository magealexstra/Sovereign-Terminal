import React from 'react';
import { Search, Plus } from 'lucide-react';

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
      <div className="search-input-box" style={{ width: '100%' }}>
        <Search size={14} color="var(--accent-mana)" />
        <input
          type="text"
          placeholder="Search studio buttons & macros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
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
                  [CUSTOM] {b.label} ({b.value.trim()})
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
                      [{key}] {item.label} ({item.value.trim()})
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
