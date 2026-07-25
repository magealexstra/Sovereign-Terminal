import React, { useState } from 'react';
import { Sliders, Code, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_BUTTONS, PREBUILT_CATEGORIES } from './button-studio/buttonData';
import ButtonHeader from './button-studio/ButtonHeader';
import ButtonPreview from './button-studio/ButtonPreview';
import AuditionConsole from './button-studio/AuditionConsole';

export default function ButtonStudio() {
  const { theme } = useApp();

  // Active Buttons List — persisted to localStorage
  const [buttons, setButtons] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_buttons');
      return saved ? JSON.parse(saved) : DEFAULT_BUTTONS;
    } catch { return DEFAULT_BUTTONS; }
  });

  const [selectedId, setSelectedId] = useState('b4');
  const [searchQuery, setSearchQuery] = useState('');
  const activeBtn = buttons.find((b) => b.id === selectedId) || buttons[0];

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

  const updateActiveBtn = (fields) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === activeBtn.id ? { ...b, ...fields } : b))
    );
  };

  const handleCreateNew = () => {
    const newId = `custom-${Date.now()}`;
    const newBtn = {
      id: newId,
      label: 'NEW',
      value: 'echo Hello\n',
      width: 3.2,
      height: 2.0,
      shape: 'rounded',
      bg: theme?.bgCanopy || '#141E26',
      text: theme?.textParchment || '#E6EDF0',
      border: theme?.accentMana || '#5E81AC'
    };
    setButtons([...buttons, newBtn]);
    setSelectedId(newId);
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
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2000);
    } catch {}
  };

  const handleClearAudition = () => {
    setAuditionHex('#88C0D0');
  };

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
              className="micro-input"
              value={activeBtn.label}
              onChange={(e) => updateActiveBtn({ label: e.target.value })}
              placeholder="Button Name"
            />
          </div>

          <div className="field-group flex-1">
            <label className="field-label">Function</label>
            <textarea
              className="micro-textarea flex-1"
              rows={3}
              value={activeBtn.value}
              onChange={(e) => updateActiveBtn({ value: e.target.value })}
              placeholder="Command Payload / Function"
            />
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
                onClick={() => updateActiveBtn({ shape: 'square' })}
              >
                Square
              </button>
              <button
                type="button"
                className={`shape-tap-btn shape-rounded ${activeBtn.shape === 'rounded' ? 'active' : ''}`}
                onClick={() => updateActiveBtn({ shape: 'rounded' })}
              >
                Round
              </button>
              <button
                type="button"
                className={`shape-tap-btn shape-pill ${activeBtn.shape === 'pill' ? 'active' : ''}`}
                onClick={() => updateActiveBtn({ shape: 'pill' })}
              >
                Pill
              </button>
            </div>
          </div>

          <div className="pinned-save-wrapper">
            <button type="button" className={`studio-save-btn ${saveToast ? 'saved' : ''}`} onClick={handleSaveButtons}>
              <Save size={12} />
              <span>{saveToast ? '✓ Saved!' : 'Save Custom Button'}</span>
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
