import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Code, Save, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_BUTTONS, PREBUILT_CATEGORIES } from './button-studio/buttonData';
import ButtonHeader from './button-studio/ButtonHeader';
import ButtonPreview from './button-studio/ButtonPreview';
import AuditionConsole from './button-studio/AuditionConsole';

export default function ButtonStudio() {
  const { theme, syncUserSettingsToServer } = useApp();

  const saveToastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  // Active Buttons List — persisted to localStorage
  const [buttons, setButtons] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_buttons');
      return saved ? JSON.parse(saved) : DEFAULT_BUTTONS;
    } catch { return DEFAULT_BUTTONS; }
  });
  // Dedicated CUST Button State
  const [custButton, setCustButton] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_cust_button');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { label: 'CUST', value: 'set number of lines to copy (50)' };
  });

  const [selectedId, setSelectedId] = useState('b4');
  const [searchQuery, setSearchQuery] = useState('');

  const isEditingCust = selectedId === 'cust-button';

  const defaultFallbackBtn = {
    id: 'b-default',
    label: 'NEW_BTN',
    value: '',
    width: 3.2,
    height: 2.0,
    shape: 'rounded',
    bg: 'var(--bg-canopy)',
    text: 'var(--text-parchment)',
    border: 'var(--accent-mana)',
  };

  const activeBtn = (isEditingCust
    ? {
        id: 'cust-button',
        label: custButton?.label || 'CUST',
        value: custButton?.value || 'set number of lines to copy (50)',
        width: 3.2,
        height: 2.0,
        shape: 'pill',
        bg: 'var(--bg-earth)',
        text: 'var(--text-parchment)',
        border: 'var(--status-danger)',
        isCust: true,
      }
    : (buttons.find((b) => b.id === selectedId) || buttons[0] || defaultFallbackBtn)) || defaultFallbackBtn;

  // Target Color Layer Selection: 'text' | 'bg' | 'border'
  const [targetLayer, setTargetLayer] = useState('bg');
  const [saveToast, setSaveToast] = useState(false);

  // Hex Audition State
  const [auditionHex, setAuditionHex] = useState('#88C0D0');

  // User Custom Created Swatches (Persists across theme swaps)
  const [customSwatches, setCustomSwatches] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_custom_swatches');
      return saved ? JSON.parse(saved) : ['#FF003C', '#00FFCC', '#FFA500'];
    } catch { return ['#FF003C', '#00FFCC', '#FFA500']; }
  });

  // True Base-16 terminal palette from the active theme
  const themeSwatches = [
    theme?.black         || '#3B4252',
    theme?.red           || '#BF616A',
    theme?.green         || '#A3BE8C',
    theme?.yellow        || '#EBCB8B',
    theme?.blue          || '#81A1C1',
    theme?.magenta       || '#B48EAD',
    theme?.cyan          || '#88C0D0',
    theme?.white         || '#E5E9F0',
    theme?.brightBlack   || '#4C566A',
    theme?.brightRed     || '#D08770',
    theme?.brightGreen   || '#A3BE8C',
    theme?.brightYellow  || '#EBCB8B',
    theme?.brightBlue    || '#5E81AC',
    theme?.brightMagenta || '#B48EAD',
    theme?.brightCyan    || '#8FBCBB',
    theme?.brightWhite   || '#ECEFF4',
  ];

  const updateActiveBtn = (updates) => {
    if (isEditingCust) {
      setCustButton((prev) => ({ ...prev, ...updates }));
      return;
    }
    setButtons((prev) =>
      prev.map((b) => {
        if (b.id !== activeBtn.id) return b;
        return { ...b, ...updates };
      })
    );
  };

  const handleCreateNew = () => {
    const newId = `custom-${Date.now()}`;
    const newBtn = {
      id: newId,
      label: 'NEW_BTN',
      value: '',
      width: 3.2,
      height: 2.0,
      shape: 'rounded',
      bg: 'var(--bg-canopy)',
      text: 'var(--text-parchment)',
      border: 'var(--accent-mana)'
    };
    setButtons(prev => [...prev, newBtn]);
    setSelectedId(newId);
  };

  // Determines if the active button has a matching built-in in PREBUILT_CATEGORIES.
  // If true: removing it from custom list falls back silently to the built-in (RESET).
  // If false: removing it is permanent — no built-in fallback exists (DELETE).
  const isResetMode = Object.values(PREBUILT_CATEGORIES)
    .flatMap(cat => cat.items)
    .some(item => item.label === activeBtn?.label);

  const handleResetDelete = () => {
    if (!activeBtn || isEditingCust) return;
    const currentIndex = buttons.findIndex(b => b.id === activeBtn.id);
    const updated = buttons.filter(b => b.id !== activeBtn.id);
    setButtons(updated);
    // Auto-advance selection to nearest remaining button
    if (updated.length > 0) {
      const nextIndex = Math.min(currentIndex, updated.length - 1);
      setSelectedId(updated[nextIndex].id);
    } else {
      setSelectedId(null);
    }
  };

  // Apply swatch to selected layer AND load into audition box so Add works as expected
  const handleApplySwatch = (color) => {
    if (targetLayer === 'bg')     updateActiveBtn({ bg: color });
    if (targetLayer === 'text')   updateActiveBtn({ text: color });
    if (targetLayer === 'border') updateActiveBtn({ border: color });
    setAuditionHex(color);
  };

  // Add auditionHex to custom swatches
  const handleAddSwatch = () => {
    const hex = auditionHex?.trim().toLowerCase();
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return;
    const alreadyExists = customSwatches.some(s => s.toLowerCase() === hex);
    if (!alreadyExists) {
      const updated = [...customSwatches, hex];
      setCustomSwatches(updated);
      try { localStorage.setItem('sovereign_custom_swatches', JSON.stringify(updated)); } catch {}
    }
  };

  const handleSaveButtons = () => {
    try {
      localStorage.setItem('sovereign_buttons', JSON.stringify(buttons));
      localStorage.setItem('sovereign_cust_button', JSON.stringify(custButton));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('sovereign_custom_buttons_updated'));
      if (typeof syncUserSettingsToServer === 'function') {
        syncUserSettingsToServer({ buttons, custButton }).catch(err => console.error('Server sync error:', err));
      }
      setSaveToast(true);
      if (saveToastTimerRef.current) {
        clearTimeout(saveToastTimerRef.current);
      }
      saveToastTimerRef.current = setTimeout(() => setSaveToast(false), 2000);
    } catch {}
  };

  const handleClearAudition = () => {
    setAuditionHex('#88C0D0');
  };

  useEffect(() => {
    const handleSaveEvent = () => handleSaveButtons();
    window.addEventListener('sovereign_save_studio_buttons', handleSaveEvent);
    return () => window.removeEventListener('sovereign_save_studio_buttons', handleSaveEvent);
  }, [buttons, custButton]);

  const handleSelectPresetOrCustom = (selectedKey) => {
    const custom = buttons.find((b) => b.id === selectedKey);
    if (custom) {
      setSelectedId(selectedKey);
      return;
    }

    for (const cat of Object.values(PREBUILT_CATEGORIES)) {
      const match = cat.items.find(item => item.label === selectedKey || item.value === selectedKey);
      if (match) {
        const existing = buttons.find(b => b.label === match.label);
        if (existing) {
          setSelectedId(existing.id);
        } else {
          const newId = `preset-${Date.now()}`;
          const newBtn = {
            id: newId,
            label: match.label,
            value: match.value,
            width: 3.2,
            height: 2.0,
            shape: 'rounded',
            bg: theme?.bgCanopy || 'var(--bg-canopy)',
            text: theme?.textParchment || 'var(--text-parchment)',
            border: theme?.accentMana || 'var(--accent-mana)'
          };
          setButtons([...buttons, newBtn]);
          setSelectedId(newId);
        }
        return;
      }
    }
  };

  const getFilteredCategories = () => {
    if (!searchQuery.trim()) return PREBUILT_CATEGORIES;
    const q = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(PREBUILT_CATEGORIES).forEach(([key, cat]) => {
      const matchingItems = cat.items.filter(
        item => item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
      );
      if (matchingItems.length > 0) {
        filtered[key] = { ...cat, items: matchingItems };
      }
    });

    return filtered;
  };

  const filteredCustomButtons = searchQuery.trim()
    ? buttons.filter(b => b.label.toLowerCase().includes(searchQuery.toLowerCase()) || b.value.toLowerCase().includes(searchQuery.toLowerCase()))
    : buttons;

  const displayCategories = getFilteredCategories();

  const shapeStyle = {
    backgroundColor: activeBtn?.bg || 'var(--bg-canopy)',
    color: activeBtn?.text || 'var(--text-parchment)',
    borderColor: activeBtn?.border || 'var(--accent-mana)'
  };

  return (
    <div className="touch-studio-mobile-window">
      {/* Top Search & Dropdown Navigation Stack */}
      <ButtonHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeBtnId={activeBtn?.id}
        filteredCustomButtons={filteredCustomButtons}
        displayCategories={displayCategories}
        onSelectPresetOrCustom={handleSelectPresetOrCustom}
        onCreateNew={handleCreateNew}
        onResetDelete={handleResetDelete}
        isResetMode={isResetMode}
        isResetDeleteDisabled={isEditingCust || !activeBtn || buttons.length === 0}
      />

      {/* Main Surround Grid with Dynamic Flex Growth */}
      <div className="studio-mobile-grid">
        {/* LEFT REGION: Command Output & Function */}
        <div className="region-box left flex-column-grow">
          <div className="region-tag"><Code size={12} color="var(--accent-mana)" /> Output</div>

          <div className="field-group">
            <label className="field-label">Name</label>
            <input
              type="text"
              name="sovereign_button_name_field"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              data-lpignore="true"
              data-form-type="other"
              className="micro-input"
              value={activeBtn?.label || ''}
              onChange={(e) => updateActiveBtn({ label: e.target.value })}
              onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              placeholder="Button Name"
            />
          </div>

          <div className="field-group flex-1">
            <label className="field-label">Function</label>
            <textarea
              className="micro-textarea flex-1"
              rows={3}
              value={activeBtn?.value || ''}
              onChange={(e) => updateActiveBtn({ value: e.target.value })}
              onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              onBlur={() => {
                if (isEditingCust) {
                  const val = activeBtn?.value ? activeBtn.value.trim() : '';
                  if (!/^\d+$/.test(val) && !/\((\d+)\)/.test(val)) {
                    updateActiveBtn({ value: 'set number of lines to copy (50)' });
                  }
                }
              }}
              placeholder="Command Payload / Function"
            />
          </div>

          {/* Pinned Interactive CUST Button Control */}
          <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--border-forest)', paddingTop: '0.6rem', textAlign: 'center' }}>
            <label className="field-label" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
              Terminal Copy Button (Tap to Edit)
            </label>
            <button
              type="button"
              className={`shape-tap-btn ${isEditingCust ? 'active' : ''}`}
              style={{
                width: '64px',
                height: '32px',
                margin: '0 auto',
                border: '1.5px solid var(--status-danger)',
                background: isEditingCust ? 'var(--status-danger)' : 'var(--bg-earth)',
                color: isEditingCust ? 'var(--bg-earth)' : 'var(--text-parchment)',
                borderRadius: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => setSelectedId('cust-button')}
            >
              {custButton.label || 'CUST'}
            </button>
          </div>
        </div>

        {/* CENTER REGION: Live Interactive Button Preview Console */}
        <ButtonPreview activeBtn={activeBtn} />

        {/* RIGHT REGION: Size, Shape & Pinned Save */}
        <div className="region-box right flex-column-grow">
          <div className="region-tag"><Sliders size={12} color="var(--accent-mana)" /> Size & Shape</div>

          <div className="stepper-section">
            <label className="field-label">Width</label>
            <div className="micro-step-row">
              <button type="button" className="step-btn" onClick={() => updateActiveBtn({ width: Math.max(1.8, Number((activeBtn.width - 0.2).toFixed(1))) })}>-</button>
              <span className="step-val">{activeBtn.width}</span>
              <button type="button" className="step-btn" onClick={() => updateActiveBtn({ width: Number((activeBtn.width + 0.2).toFixed(1)) })}>+</button>
            </div>
          </div>

          <div className="stepper-section">
            <label className="field-label">Height</label>
            <div className="micro-step-row">
              <button type="button" className="step-btn" onClick={() => updateActiveBtn({ height: Math.max(1.5, Number((activeBtn.height - 0.2).toFixed(1))) })}>-</button>
              <span className="step-val">{activeBtn.height}</span>
              <button type="button" className="step-btn" onClick={() => updateActiveBtn({ height: Number((activeBtn.height + 0.2).toFixed(1)) })}>+</button>
            </div>
          </div>

          <div className="shape-section">
            <label className="field-label">Shape</label>
            <div className="micro-shapes-row">
              <button
                type="button"
                className={`shape-tap-btn shape-square ${activeBtn.shape === 'square' ? 'active' : ''}`}
                style={shapeStyle}
                onClick={() => updateActiveBtn({ shape: 'square' })}
              >
                Square
              </button>
              <button
                type="button"
                className={`shape-tap-btn shape-rounded ${activeBtn.shape === 'rounded' ? 'active' : ''}`}
                style={shapeStyle}
                onClick={() => updateActiveBtn({ shape: 'rounded' })}
              >
                Round
              </button>
              <button
                type="button"
                className={`shape-tap-btn shape-pill ${activeBtn.shape === 'pill' ? 'active' : ''}`}
                style={shapeStyle}
                onClick={() => updateActiveBtn({ shape: 'pill' })}
              >
                Pill
              </button>
            </div>
          </div>

          <div className="pinned-save-wrapper">
            <button type="button" className={`studio-save-btn ${saveToast ? 'saved' : ''}`} onClick={handleSaveButtons}>
              <Save size={12} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {saveToast ? <><Check size={14} /> Saved!</> : 'Save Custom Button'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Target Color Layer & Audition Console */}
      <AuditionConsole
        targetLayer={targetLayer}
        setTargetLayer={setTargetLayer}
        themeSwatches={themeSwatches}
        customSwatches={customSwatches}
        auditionHex={auditionHex}
        setAuditionHex={setAuditionHex}
        onApplySwatch={handleApplySwatch}
        onAddSwatch={handleAddSwatch}
        onClearAudition={handleClearAudition}
      />
    </div>
  );
}
