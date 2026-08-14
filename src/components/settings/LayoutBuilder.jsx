import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft, ArrowRight, Zap, RotateCcw } from 'lucide-react';
import { PREBUILT_CATEGORIES } from './button-studio/buttonData';
import { useToast } from '../../hooks/useToast';
import { useApp } from '../../context/AppContext';

// Helper to pre-load all macro suite overrides from localStorage into memory
const loadMacroSuiteOverrides = () => {
  const overrides = {};
  if (PREBUILT_CATEGORIES && typeof PREBUILT_CATEGORIES === 'object') {
    Object.keys(PREBUILT_CATEGORIES).forEach((key) => {
      try {
        const raw = localStorage.getItem(`sovereign_macro_suite_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            overrides[key] = parsed;
          }
        }
      } catch {}
    });
  }
  return overrides;
};

// Helper to identify directional arrows and return icons
const isGlyphSymbol = (str) => ['▲', '▼', '◀', '▶', '⏎', '◄', '►', '↑', '↓', '←', '→'].includes(str);

/* ==========================================================================
   SUB-COMPONENTS FOR LAYOUT BUILDER
   ========================================================================== */

/** 1. MacroSuiteSelector — Top dropdown card for selecting active macro suite */
function MacroSuiteSelector({
  selectedMacroSuite,
  setSelectedMacroSuite,
  customMacroSuites,
  handleContainerClick
}) {
  return (
    <div className="layout-dropdown-card" onClick={handleContainerClick}>
      <div className="macro-suite-select-wrapper">
        <select
          value={selectedMacroSuite}
          onChange={(e) => {
            e.stopPropagation();
            setSelectedMacroSuite(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          className="category-dropdown"
          style={{
            width: '100%',
            background: 'var(--bg-canopy)',
            color: 'var(--text-parchment)',
            border: '1.5px solid var(--status-active)',
            borderRadius: '8px',
            fontWeight: '700',
            height: '36px',
            padding: '0 0.5rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem'
          }}
        >
          <optgroup label="SYSTEM MACRO BARS">
            <option value="PRIMARY">[PRIMARY] Main TouchBar</option>
            <option value="MASTER">[MASTER] Master Red MACROS Catalog</option>
          </optgroup>
          <optgroup label="PRE-BUILT SUITES">
            {Object.keys(PREBUILT_CATEGORIES).map((catKey) => (
              <option key={catKey} value={catKey}>
                [{catKey}] {PREBUILT_CATEGORIES[catKey].name}
              </option>
            ))}
          </optgroup>
          {customMacroSuites.length > 0 && (
            <optgroup label="CUSTOM MACRO SUITES">
              {customMacroSuites.map((suiteName) => (
                <option key={suiteName} value={suiteName}>
                  [CUSTOM] {suiteName} (macro)
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}

/** 2. CategorySelector — Dropdown card for filtering available button pool by category */
function CategorySelector({
  selectedCategory,
  setSelectedCategory,
  customButtonsCount,
  handleContainerClick
}) {
  return (
    <div className="layout-dropdown-card" onClick={handleContainerClick}>
      <div className="category-select-wrapper">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="category-dropdown"
        >
          {/* SECTION 1: CUSTOM BUTTONS (TOP PRIORITY) */}
          <optgroup label="CUSTOM CREATIONS">
            <option value="CUSTOM">[CUSTOM] Custom Buttons ({customButtonsCount})</option>
          </optgroup>

          {/* SECTION 2: ALPHABETICAL PRE-BUILT TOOLKITS */}
          <optgroup label="PRE-BUILT TOOLKITS">
            {Object.entries(PREBUILT_CATEGORIES)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([key, cat]) => (
                <option key={key} value={key}>
                  {cat.name}
                </option>
              ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
}

/** 3. ButtonPoolGrid — Grid displaying buttons available to pick in current category */
function ButtonPoolGrid({
  poolItems,
  selectedPoolItem,
  customButtonStyles,
  handleSelectPoolItem,
  handleContainerClick
}) {
  return (
    <div className="available-pool-section" onClick={handleContainerClick}>
      <div className="pool-section-label" onClick={handleContainerClick}>
        <span>AVAILABLE BUTTONS POOL ({poolItems.length})</span>
      </div>

      <div className="available-chips-grid" onClick={handleContainerClick}>
        {poolItems.map((item, idx) => {
          const isSelected = selectedPoolItem === item;
          const isLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

          const customStyle = customButtonStyles[item];
          return (
            <button
              key={`pool-${item}-${idx}`}
              type="button"
              className={`pool-chip-item ${isSelected ? 'selected-glow' : ''} ${isLauncher ? 'launcher-chip' : ''} ${customStyle?.shape || ''} ${isGlyphSymbol(item) ? 'glyph-icon-btn' : ''}`}
              style={customStyle ? {
                background: customStyle.bg || undefined,
                color: customStyle.text || undefined,
                borderColor: customStyle.border || undefined,
                width: customStyle.width ? `${customStyle.width}rem` : undefined,
                height: customStyle.height ? `${customStyle.height}rem` : undefined,
              } : {}}
              onClick={(e) => handleSelectPoolItem(e, item)}
              title="Click to select button"
            >
              {isLauncher && <Zap size={10} color="var(--accent-mana)" style={{ marginRight: '3px' }} />}
              <span>{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 4. TouchBarPreviewStrip — Horizontal preview strip showing active TouchBar layout slots */
function TouchBarPreviewStrip({
  touchBarSlots,
  selectedBarIndex,
  customButtonStyles,
  handleSelectBarItem,
  handleContainerClick
}) {
  return (
    <div className="live-bar-preview-section" onClick={handleContainerClick}>
      <div className="bar-preview-label" onClick={handleContainerClick}>
        <span>LIVE TOUCHBAR PREVIEW ({touchBarSlots.length} SLOTS)</span>
      </div>

      <div className="live-bar-strip-wrapper" onClick={handleContainerClick}>
        <div className="live-bar-strip" onClick={handleContainerClick}>
          {touchBarSlots.map((item, idx) => {
            const isSelected = selectedBarIndex === idx;
            const isLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

            const customStyle = customButtonStyles[item];
            return (
              <button
                key={`bar-${item}-${idx}`}
                type="button"
                className={`live-bar-tile ${isSelected ? 'selected-bar-tile' : ''} ${isLauncher ? 'launcher-tile' : ''} ${customStyle?.shape || ''} ${isGlyphSymbol(item) ? 'glyph-icon-btn' : ''}`}
                style={customStyle ? {
                  background: customStyle.bg || undefined,
                  color: customStyle.text || undefined,
                  borderColor: customStyle.border || undefined,
                  width: customStyle.width ? `${customStyle.width}rem` : undefined,
                  height: customStyle.height ? `${customStyle.height}rem` : undefined,
                } : {}}
                onClick={(e) => handleSelectBarItem(e, idx)}
              >
                <span>{item}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 5. LayoutActionConsole — Action controls for adding, moving, resetting, and removing buttons */
function LayoutActionConsole({
  selectedPoolItem,
  selectedBarIndex,
  selectedMacroSuite,
  touchBarSlotsCount,
  customButtons,
  handleAddSelectedToBar,
  handleMoveBarItem,
  handleReset,
  handleRemove,
  handleContainerClick
}) {
  return (
    <div className="single-bar-control-console" onClick={handleContainerClick}>
      <button
        type="button"
        className="action-btn add-action-btn"
        disabled={!selectedPoolItem}
        onClick={(e) => handleAddSelectedToBar(e)}
        title="Add Selected Pool Button to TouchBar"
      >
        <Plus size={13} />
        <span>Add</span>
      </button>

      <button
        type="button"
        className="action-btn move-action-btn"
        disabled={selectedBarIndex === null || selectedBarIndex === 0}
        onClick={(e) => handleMoveBarItem(e, 'left')}
      >
        <ArrowLeft size={13} />
        <span>Move Left</span>
      </button>

      <button
        type="button"
        className="action-btn move-action-btn"
        disabled={selectedBarIndex === null || selectedBarIndex === touchBarSlotsCount - 1}
        onClick={(e) => handleMoveBarItem(e, 'right')}
      >
        <span>Move Right</span>
        <ArrowRight size={13} />
      </button>

      <button
        type="button"
        className="action-btn reset-action-btn"
        disabled={!Object.keys(PREBUILT_CATEGORIES).includes(selectedMacroSuite)}
        onClick={(e) => handleReset(e)}
        title={`Reset ${selectedMacroSuite} suite to defaults`}
      >
        <RotateCcw size={13} />
        <span>Reset</span>
      </button>

      <button
        type="button"
        className="action-btn delete-action-btn"
        disabled={selectedBarIndex === null && !(selectedPoolItem !== null && customButtons.includes(selectedPoolItem))}
        onClick={(e) => handleRemove(e)}
        title={selectedBarIndex !== null ? "Remove selected button from TouchBar" : "Permanently delete custom button"}
      >
        <Trash2 size={13} />
        <span>{selectedBarIndex !== null ? 'Remove' : 'Delete'}</span>
      </button>
    </div>
  );
}

/* ==========================================================================
   MAIN LAYOUT BUILDER COMPONENT
   ========================================================================== */

export default function LayoutBuilder() {
  // Category dropdown filter
  const [selectedCategory, setSelectedCategory] = useState('CUSTOM');

  // Toast feedback
  const { toast, showToast } = useToast(2000);
  const { syncUserSettingsToServer } = useApp();

  // Custom user buttons from ButtonStudio (localStorage)
  const [customButtons, setCustomButtons] = useState([]);
  const [customButtonStyles, setCustomButtonStyles] = useState({});

  // In-memory cache for macro suite overrides to avoid synchronous localStorage calls in render loop
  const [macroSuiteOverrides, setMacroSuiteOverrides] = useState(loadMacroSuiteOverrides);

  // Macro Suite Selection State (PRIMARY, MASTER, built-in suites, or custom macro suites)
  const [selectedMacroSuite, setSelectedMacroSuite] = useState('PRIMARY');
  const [customMacroSuites, setCustomMacroSuites] = useState([]);
  const [selectedPoolItem, setSelectedPoolItem] = useState(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState(null);

  // Load slots for the currently selected macro suite
  const loadSlotsForSuite = (suiteKey) => {
    try {
      const storageKey = suiteKey === 'PRIMARY' ? 'sovereign_layout_slots' : `sovereign_macro_suite_${suiteKey}`;
      const saved = localStorage.getItem(storageKey);
      const purgeList = ['AGY', 'CLD', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX', 'clear'];
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(item => !purgeList.includes(item));
      }
      if (suiteKey === 'PRIMARY') {
        return ['ESC', 'TAB', '^C', '-', '/'];
      }
      if (PREBUILT_CATEGORIES[suiteKey]) {
        return PREBUILT_CATEGORIES[suiteKey].items.map(i => i.label).filter(item => !purgeList.includes(item));
      }
      return [];
    } catch {
      return ['ESC', 'TAB', '^C', '-', '/'];
    }
  };

  // Active TouchBar / Macro Suite slots
  const [touchBarSlots, setTouchBarSlots] = useState(() => loadSlotsForSuite('PRIMARY'));

  // Synchronize slots whenever selectedMacroSuite changes
  useEffect(() => {
    setTouchBarSlots(loadSlotsForSuite(selectedMacroSuite));
    setSelectedBarIndex(null);
  }, [selectedMacroSuite]);

  // Synchronize custom buttons, custom macro suites, and macro suite overrides from localStorage
  const loadCustomButtons = () => {
    try {
      const saved = localStorage.getItem('sovereign_buttons');
      let list = [];
      if (saved) list = list.concat(JSON.parse(saved));

      // Sanitize out blank unedited default placeholders
      const validList = list.filter(b => b && b.label && b.label !== 'NEW_BTN');

      // Map ALL custom buttons (both macro and regular) for the Pool dropdown
      const allCustomNames = validList.map(b => b.label || b.name || b.id).filter(Boolean);
      setCustomButtons(Array.from(new Set(allCustomNames)));

      // Map styles for all custom buttons
      const styles = {};
      validList.forEach(b => {
        const label = b.label || b.name || b.id;
        if (label) styles[label] = b;
      });
      setCustomButtonStyles(styles);

      // Find buttons where the exact function value is "macro" for the top Macro Suite selector
      const macroSuites = validList
        .filter(b => b && b.value && typeof b.value === 'string' && b.value.trim().toLowerCase() === 'macro')
        .map(b => b.label || b.name || b.id)
        .filter(Boolean);
      setCustomMacroSuites(Array.from(new Set(macroSuites)));

      // Refresh in-memory macro suite overrides cache
      setMacroSuiteOverrides(loadMacroSuiteOverrides());
    } catch {}
  };

  useEffect(() => {
    loadCustomButtons();
    window.addEventListener('storage', loadCustomButtons);
    window.addEventListener('sovereign_custom_buttons_updated', loadCustomButtons);
    return () => {
      window.removeEventListener('storage', loadCustomButtons);
      window.removeEventListener('sovereign_custom_buttons_updated', loadCustomButtons);
    };
  }, []);

  // Save layout for the active macro suite
  const saveLayout = (newSlots) => {
    setTouchBarSlots(newSlots);
    try {
      const storageKey = selectedMacroSuite === 'PRIMARY' ? 'sovereign_layout_slots' : `sovereign_macro_suite_${selectedMacroSuite}`;
      localStorage.setItem(storageKey, JSON.stringify(newSlots));
      if (selectedMacroSuite !== 'PRIMARY') {
        setMacroSuiteOverrides(prev => ({
          ...prev,
          [selectedMacroSuite]: newSlots
        }));
      }
      window.dispatchEvent(new Event('storage'));
      // Persist primary hotbar layout to server profile so it survives storage clears
      if (selectedMacroSuite === 'PRIMARY') {
        syncUserSettingsToServer({ layoutSlots: newSlots }).catch(err => console.error('Server sync error:', err));
      }
    } catch {}
  };

  // Add item directly to TouchBar with toast feedback and highlight in preview strip
  const handleAddDirect = (itemKey) => {
    if (!itemKey || itemKey === '(No Custom Buttons Created Yet)') return;
    const updated = [...touchBarSlots, itemKey];
    saveLayout(updated);
    setSelectedBarIndex(updated.length - 1);
    setSelectedPoolItem(itemKey);
    showToast(`Added '${itemKey}' to TouchBar`);
  };

  // Select a pool chip (must press Add button to append to TouchBar)
  const handleSelectPoolItem = (e, itemKey) => {
    e.stopPropagation();
    if (itemKey === '(No Custom Buttons Created Yet)') return;
    setSelectedPoolItem(itemKey);
    setSelectedBarIndex(null);
  };

  const handleSelectBarItem = (e, index) => {
    e.stopPropagation();
    setSelectedBarIndex(index);
    setSelectedPoolItem(null);
  };

  // Add selected pool item to TouchBar when user clicks the Add button
  const handleAddSelectedToBar = (e) => {
    if (e) e.stopPropagation();
    if (!selectedPoolItem) return;
    const updated = [...touchBarSlots, selectedPoolItem];
    saveLayout(updated);
    showToast(`Added '${selectedPoolItem}' to TouchBar`);
    setSelectedPoolItem(null);
  };

  // Move selected TouchBar item left or right
  const handleMoveBarItem = (e, direction) => {
    e.stopPropagation();
    if (selectedBarIndex === null) return;
    const targetIdx = direction === 'left' ? selectedBarIndex - 1 : selectedBarIndex + 1;
    if (targetIdx < 0 || targetIdx >= touchBarSlots.length) return;

    const updated = [...touchBarSlots];
    const [moved] = updated.splice(selectedBarIndex, 1);
    updated.splice(targetIdx, 0, moved);
    saveLayout(updated);
    setSelectedBarIndex(targetIdx);
  };

  // Remove button from active TouchBar or Delete custom button
  const handleRemove = (e) => {
    if (e) e.stopPropagation();
    
    if (selectedBarIndex !== null) {
      // Remove from TouchBar
      const itemRemoved = touchBarSlots[selectedBarIndex];
      const updated = touchBarSlots.filter((_, idx) => idx !== selectedBarIndex);
      saveLayout(updated);
      setSelectedBarIndex(null);
      if (itemRemoved) showToast(`Removed '${itemRemoved}' from TouchBar`);
    } else if (selectedPoolItem !== null && customButtons.includes(selectedPoolItem)) {
      // Delete custom button completely
      try {
        const saved = localStorage.getItem('sovereign_buttons');
        if (saved) {
          let buttons = JSON.parse(saved);
          buttons = buttons.filter(b => b.label !== selectedPoolItem && b.id !== selectedPoolItem && b.name !== selectedPoolItem);
          localStorage.setItem('sovereign_buttons', JSON.stringify(buttons));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('sovereign_custom_buttons_updated'));
          if (typeof syncUserSettingsToServer === 'function') {
            syncUserSettingsToServer({ buttons }).catch(err => console.error('Server sync error:', err));
          }
          showToast(`Deleted custom button '${selectedPoolItem}'`);
          setSelectedPoolItem(null);
          loadCustomButtons();
        }
      } catch {}
    }
  };

  // Reset active suite to factory defaults (PRIMARY or PREBUILT_CATEGORIES)
  const handleReset = (e) => {
    if (e) e.stopPropagation();
    if (selectedMacroSuite === 'PRIMARY') {
      localStorage.removeItem('sovereign_layout_slots');
      setTouchBarSlots(['ESC', 'TAB', '^C', '-', '/']);
      window.dispatchEvent(new Event('storage'));
      setSelectedBarIndex(null);
      showToast('Primary layout reset to defaults');
      return;
    }
    if (!Object.keys(PREBUILT_CATEGORIES).includes(selectedMacroSuite)) return;
    try {
      localStorage.removeItem(`sovereign_macro_suite_${selectedMacroSuite}`);
      setMacroSuiteOverrides(prev => {
        const next = { ...prev };
        delete next[selectedMacroSuite];
        return next;
      });
      setTouchBarSlots(loadSlotsForSuite(selectedMacroSuite));
      window.dispatchEvent(new Event('storage'));
      setSelectedBarIndex(null);
      showToast(`${selectedMacroSuite} suite reset to defaults`);
    } catch {}
  };

  // Deselect active selections when clicking any blank space
  const handleContainerClick = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) {
      return;
    }
    setSelectedPoolItem(null);
    setSelectedBarIndex(null);
  };

  // Compute available pool items based on category (reading from in-memory state)
  const getPoolItems = () => {
    let items = [];
    if (selectedCategory === 'CUSTOM') {
      items = customButtons;
      if (items.length === 0) items = ['(No Custom Buttons Created Yet)'];
    } else if (PREBUILT_CATEGORIES[selectedCategory]) {
      // Show current saved state of this suite from state cache; fall back to factory defaults if no override exists
      const saved = macroSuiteOverrides[selectedCategory];
      items = (Array.isArray(saved) && saved.length > 0)
        ? [selectedCategory, ...saved]
        : [selectedCategory, ...PREBUILT_CATEGORIES[selectedCategory].items.map((i) => i.label)];
    } else {
      items = Object.entries(PREBUILT_CATEGORIES).flatMap(([key, cat]) => [key, ...cat.items.map((i) => i.label)]);
    }

    return items;
  };

  const poolItems = getPoolItems();

  return (
    <div className="layout-builder-container" onClick={handleContainerClick}>
      {toast && (
        <div className="copy-toast" style={{ top: '1rem', bottom: 'auto' }}>
          <span>{toast}</span>
        </div>
      )}

      {/* 1. TOP CARD SECTION: MACRO SUITE DROPDOWN */}
      <MacroSuiteSelector
        selectedMacroSuite={selectedMacroSuite}
        setSelectedMacroSuite={setSelectedMacroSuite}
        customMacroSuites={customMacroSuites}
        handleContainerClick={handleContainerClick}
      />

      {/* 2. MIDDLE TOP CARD: CATEGORY DROPDOWN */}
      <CategorySelector
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        customButtonsCount={customButtons.length}
        handleContainerClick={handleContainerClick}
      />

      {/* 3. MAIN WORKSPACE CARD: AVAILABLE BUTTONS POOL, PREVIEW, CONTROLS */}
      <div className="layout-editor-card" onClick={handleContainerClick}>
        <ButtonPoolGrid
          poolItems={poolItems}
          selectedPoolItem={selectedPoolItem}
          customButtonStyles={customButtonStyles}
          handleSelectPoolItem={handleSelectPoolItem}
          handleContainerClick={handleContainerClick}
        />

        {/* 3. MIDDLE LOWER SECTION: LIVE TOUCHBAR PREVIEW ROW */}
        <TouchBarPreviewStrip
          touchBarSlots={touchBarSlots}
          selectedBarIndex={selectedBarIndex}
          customButtonStyles={customButtonStyles}
          handleSelectBarItem={handleSelectBarItem}
          handleContainerClick={handleContainerClick}
        />

        {/* 4. BOTTOM SECTION: STREAMLINED ACTION CONTROLLER (4 EQUAL BUTTONS) */}
        <LayoutActionConsole
          selectedPoolItem={selectedPoolItem}
          selectedBarIndex={selectedBarIndex}
          selectedMacroSuite={selectedMacroSuite}
          touchBarSlotsCount={touchBarSlots.length}
          customButtons={customButtons}
          handleAddSelectedToBar={handleAddSelectedToBar}
          handleMoveBarItem={handleMoveBarItem}
          handleReset={handleReset}
          handleRemove={handleRemove}
          handleContainerClick={handleContainerClick}
        />
      </div>
    </div>
  );
}

