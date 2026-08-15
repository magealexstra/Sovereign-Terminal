import React, { useState, useEffect, useRef } from 'react';
import { Palette, Check, Settings, X, Plus, Save, Trash2, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SurfaceSettingsModal from './SurfaceSettingsModal';

// Base-16 terminal color slots with display labels
const TERMINAL_COLOR_KEYS = [
  { key: 'black',         label: 'Black' },
  { key: 'red',           label: 'Red' },
  { key: 'green',         label: 'Green' },
  { key: 'yellow',        label: 'Yellow' },
  { key: 'blue',          label: 'Blue' },
  { key: 'magenta',       label: 'Magenta' },
  { key: 'cyan',          label: 'Cyan' },
  { key: 'white',         label: 'White' },
  { key: 'brightBlack',   label: 'Br.Black' },
  { key: 'brightRed',     label: 'Br.Red' },
  { key: 'brightGreen',   label: 'Br.Green' },
  { key: 'brightYellow',  label: 'Br.Yellow' },
  { key: 'brightBlue',    label: 'Br.Blue' },
  { key: 'brightMagenta', label: 'Br.Mag' },
  { key: 'brightCyan',    label: 'Br.Cyan' },
  { key: 'brightWhite',   label: 'Br.White' },
];

// UI shell color slots
const SHELL_COLOR_KEYS = [
  { key: 'bgEarth',        label: 'Void Base' },
  { key: 'bgCanopy',       label: 'Card Panel' },
  { key: 'borderForest',   label: 'Border' },
  { key: 'textParchment',  label: 'Primary Text' },
  { key: 'accentMana',     label: 'Accent' },
  { key: 'accentHighlight',label: 'Highlight' },
];

const ALL_COLOR_KEYS = [...TERMINAL_COLOR_KEYS, ...SHELL_COLOR_KEYS];

export default function ThemeSettings() {
  const {
    theme,
    setTheme,
    themes,
    saveCustomTheme,
    deleteCustomTheme,
    resetToDefault,
  } = useApp();

  const [editingTheme, setEditingTheme] = useState(null);
  const [customName, setCustomName] = useState('My Sovereign Custom');
  const [selectedColorKey, setSelectedColorKey] = useState(null);
  const [showSurfaceModal, setShowSurfaceModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const appliedToastTimerRef = useRef(null);
  const confirmDeleteTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (appliedToastTimerRef.current) {
        clearTimeout(appliedToastTimerRef.current);
      }
      if (confirmDeleteTimerRef.current) {
        clearTimeout(confirmDeleteTimerRef.current);
      }
    };
  }, []);


  const openCustomizeModal = (t) => {
    setCustomName(t.name);
    setEditingTheme({ ...t });
    setSelectedColorKey('black');
    setConfirmDelete(false);
  };

  const handleSaveModal = () => {
    if (!editingTheme) return;
    saveCustomTheme({ ...editingTheme, name: customName || 'My Custom Theme' });
    setEditingTheme(null);
    setSelectedColorKey(null);
    setConfirmDelete(false);
  };

  const handleDeleteModal = () => {
    if (!editingTheme || !deleteCustomTheme) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmDeleteTimerRef.current) clearTimeout(confirmDeleteTimerRef.current);
      confirmDeleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteCustomTheme(editingTheme.name);
    setConfirmDelete(false);
    setEditingTheme(null);
    setSelectedColorKey(null);
  };

  const isCustomTheme = editingTheme && Object.entries(themes || {}).some(
    ([k, v]) => v?.name === editingTheme?.name && (k.startsWith('Custom_') || v?.isCustom)
  );

  const closeModal = () => {
    setEditingTheme(null);
    setSelectedColorKey(null);
    setConfirmDelete(false);
  };

  const selectedLabel = selectedColorKey
    ? ALL_COLOR_KEYS.find(c => c.key === selectedColorKey)?.label
    : null;

  return (
    <div className="theme-settings-container">

      {/* ── 1. Theme Presets Grid (scrollable) ─────────────────────────────── */}
      <div className="theme-section theme-section-grid">
        <div className="section-header-compact">
          <Palette size={14} color="var(--accent-mana)" />
          <span>Theme Presets ({Object.keys(themes || {}).length})</span>
          <button
            type="button"
            className="create-custom-theme-btn"
            onClick={() => openCustomizeModal(theme)}
          >
            <Plus size={12} />
            <span>Custom Theme</span>
          </button>
        </div>

        <div className="surface-launcher-row" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            className="surface-modal-launcher-btn"
            onClick={() => setShowSurfaceModal(true)}
          >
            <SlidersHorizontal size={14} color="var(--accent-highlight)" />
            <span>Surface &amp; Typography Settings</span>
          </button>
        </div>

        <div className="native-theme-grid">
          {Object.entries(themes || {}).map(([key, t]) => {
            const isActive = theme && theme.name === t.name;
            return (
              <div
                key={key}
                className={`native-theme-button ${isActive ? 'active' : ''}`}
                style={{
                  backgroundColor: t.bgEarth || 'var(--bg-earth)',
                  color: t.textParchment || 'var(--text-parchment)',
                  borderColor: t.accentMana || 'var(--accent-mana)',
                  boxShadow: isActive ? `0 0 12px ${t.accentHighlight || 'var(--accent-highlight)'}` : 'none'
                }}
                onClick={() => setTheme(t)}
              >
                <div className="native-theme-header">
                  <span className="native-theme-title">{t.name}</span>
                  {isActive && <Check size={12} color={t.accentHighlight || 'var(--accent-highlight)'} />}
                </div>

                {/* Mini Base-16 swatch strip */}
                <div className="native-theme-strip">
                  {['red','green','yellow','blue','magenta','cyan'].map(c => (
                    <span key={c} className="native-strip-dot" style={{ backgroundColor: t[c] || 'var(--text-muted)' }} />
                  ))}
                </div>

                <button
                  type="button"
                  className="native-gear-btn"
                  onClick={(e) => { e.stopPropagation(); openCustomizeModal(t); }}
                  title="Customize Theme & Colors"
                >
                  <Settings size={12} color={t.accentHighlight || 'var(--accent-highlight)'} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <SurfaceSettingsModal
        isOpen={showSurfaceModal}
        onClose={() => setShowSurfaceModal(false)}
      />

      {/* ── 3. Theme Customizer Modal ───────────────────────────────────────── */}
      {editingTheme && (
        <div className="explorer-modal-overlay" onClick={closeModal}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Customize Theme</h3>
              {isCustomTheme ? (
                <button
                  type="button"
                  className="delete-theme-btn"
                  onClick={handleDeleteModal}
                  title="Delete Custom Theme"
                  style={{
                    background: confirmDelete ? 'var(--status-danger)' : 'rgba(239, 68, 68, 0.15)',
                    color: confirmDelete ? '#ffffff' : 'var(--status-danger)',
                    border: '1px solid var(--status-danger)',
                    borderRadius: '6px',
                    padding: '0.28rem 0.65rem',
                    fontWeight: '700',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: 'var(--font-mono)',
                    margin: '0 auto',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Trash2 size={12} />
                  <span>{confirmDelete ? 'Confirm Delete?' : 'Delete'}</span>
                </button>
              ) : (
                <div style={{ flex: 1 }} />
              )}
              <button type="button" className="modal-close-x" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            {/* Theme name */}
            <div className="theme-name-input-group">
              <label>Save As:</label>
              <input
                type="text"
                name="sovereign_theme_custom_name"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                data-lpignore="true"
                data-form-type="other"
                className="theme-name-field"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                placeholder="e.g. Mage Sovereign Dark"
              />
            </div>

            {/* Normal colors row */}
            <div className="modal-section-title">Terminal Colors — Normal</div>
            <div className="base16-swatch-grid">
              {TERMINAL_COLOR_KEYS.slice(0, 8).map(({ key, label }) => (
                <div
                  key={key}
                  className={`base16-swatch-cell ${selectedColorKey === key ? 'selected' : ''}`}
                  onClick={() => setSelectedColorKey(key)}
                >
                  <div className="base16-dot" style={{ backgroundColor: editingTheme[key] || '#000' }} />
                  <span className="base16-label">{label}</span>
                </div>
              ))}
            </div>

            {/* Bright colors row */}
            <div className="modal-section-title" style={{ marginTop: '0.4rem' }}>Terminal Colors — Bright</div>
            <div className="base16-swatch-grid">
              {TERMINAL_COLOR_KEYS.slice(8, 16).map(({ key, label }) => (
                <div
                  key={key}
                  className={`base16-swatch-cell ${selectedColorKey === key ? 'selected' : ''}`}
                  onClick={() => setSelectedColorKey(key)}
                >
                  <div className="base16-dot" style={{ backgroundColor: editingTheme[key] || '#000' }} />
                  <span className="base16-label">{label}</span>
                </div>
              ))}
            </div>

            {/* UI shell colors */}
            <div className="modal-section-title" style={{ marginTop: '0.4rem' }}>UI Shell Colors</div>
            <div className="base16-swatch-grid base16-swatch-grid-6">
              {SHELL_COLOR_KEYS.map(({ key, label }) => (
                <div
                  key={key}
                  className={`base16-swatch-cell ${selectedColorKey === key ? 'selected' : ''}`}
                  onClick={() => setSelectedColorKey(key)}
                >
                  <div className="base16-dot" style={{ backgroundColor: editingTheme[key] || '#000' }} />
                  <span className="base16-label">{label}</span>
                </div>
              ))}
            </div>

            {/* Inline editor for selected color */}
            {selectedColorKey && (
              <div className="modal-color-editor">
                <span className="modal-editing-label">Editing: {selectedLabel}</span>
                <div className="modal-color-editor-row">
                  <div
                    className="modal-color-preview"
                    style={{ backgroundColor: editingTheme[selectedColorKey] || '#000000' }}
                  />
                  <input
                    type="color"
                    value={editingTheme[selectedColorKey] || '#000000'}
                    onChange={(e) => setEditingTheme(prev => ({ ...prev, [selectedColorKey]: e.target.value }))}
                    className="audition-native-picker"
                  />
                  <input
                    type="text"
                    name="sovereign_theme_hex_input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck="false"
                    inputMode="text"
                    data-lpignore="true"
                    data-form-type="other"
                    value={editingTheme[selectedColorKey] || '#000000'}
                    onChange={(e) => setEditingTheme(prev => ({ ...prev, [selectedColorKey]: e.target.value }))}
                    onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="audition-hex-input"
                    placeholder="#HEX"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="modal-btn-row" style={{ marginTop: '0.75rem' }}>
              <button className="submit" onClick={handleSaveModal}>
                <Save size={13} />
                <span>Save & Add to Presets</span>
              </button>
              <button onClick={resetToDefault}>Reset Default</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
