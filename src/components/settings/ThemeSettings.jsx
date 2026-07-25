import React, { useState } from 'react';
import { Palette, Check, Settings, X, RefreshCw, Type, Plus, Save, Terminal as TermIcon, FileCode, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
    resetToDefault,
    deviceBaselinePx,
    terminalScaleMultiplier,
    setTerminalScaleMultiplier,
    editorScaleMultiplier,
    setEditorScaleMultiplier,
  } = useApp();

  const [editingTheme, setEditingTheme] = useState(null);
  const [customName, setCustomName] = useState('My Sovereign Custom');
  const [selectedColorKey, setSelectedColorKey] = useState(null);

  // Predefined editable preview text
  const [terminalSampleText, setTerminalSampleText] = useState(
    'mage@sovereign:~$ docker ps\nCONTAINER ID   IMAGE                STATUS\n896468d35eb4   sovereign-terminal   Up 30m (healthy)\nmage@sovereign:~$ echo "Theme Preview Active"'
  );

  const [editorSampleText, setEditorSampleText] = useState(
    'def initialize_sovereign_node(hostname="192.168.2.100"):\n    """Sovereign Workstation Node Gateway."""\n    print(f"Connected to {hostname}:2069")\n    return True'
  );

  const [localTerminalScale, setLocalTerminalScale] = useState(terminalScaleMultiplier || 1.0);
  const [localEditorScale, setLocalEditorScale] = useState(editorScaleMultiplier || 1.0);
  const [appliedToast, setAppliedToast] = useState(false);

  const localTerminalPx = Math.round(deviceBaselinePx * localTerminalScale);
  const localEditorPx   = Math.round(deviceBaselinePx * localEditorScale);

  const handleApplyFontSettings = () => {
    setTerminalScaleMultiplier(localTerminalScale);
    setEditorScaleMultiplier(localEditorScale);
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2500);
  };

  const handleResetFonts = () => {
    setLocalTerminalScale(1.0);
    setLocalEditorScale(1.0);
    setTerminalScaleMultiplier(1.0);
    setEditorScaleMultiplier(1.0);
  };

  const openCustomizeModal = (t) => {
    setCustomName(t.name);
    setEditingTheme({ ...t });
    setSelectedColorKey('black');
  };

  const handleSaveModal = () => {
    if (!editingTheme) return;
    saveCustomTheme({ ...editingTheme, name: customName || 'My Custom Theme' });
    setEditingTheme(null);
    setSelectedColorKey(null);
  };

  const closeModal = () => {
    setEditingTheme(null);
    setSelectedColorKey(null);
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

      {/* ── 2. Typography & Live Previews ──────────────────────────────────── */}
      <div className="theme-section">
        <div className="section-header-compact">
          <Type size={14} color="var(--status-active)" />
          <span>Typography & Live Previews</span>
          {appliedToast && (
            <span className="applied-toast-badge">
              <CheckCircle2 size={12} /> Applied Live
            </span>
          )}
        </div>

        <div className="font-controls-grid">
          <div className="font-control-card">
            <div className="font-control-label">
              <span>Terminal Font Scale</span>
              <strong>{Math.round(localTerminalScale * 100)}% ({localTerminalPx}px)</strong>
            </div>
            <input
              type="range"
              min="0.7" max="1.8" step="0.05"
              value={localTerminalScale}
              onChange={(e) => setLocalTerminalScale(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          <div className="font-control-card">
            <div className="font-control-label">
              <span>Editor Font Scale</span>
              <strong>{Math.round(localEditorScale * 100)}% ({localEditorPx}px)</strong>
            </div>
            <input
              type="range"
              min="0.7" max="1.8" step="0.05"
              value={localEditorScale}
              onChange={(e) => setLocalEditorScale(Number(e.target.value))}
              className="font-slider"
            />
          </div>
        </div>

        <div className="live-font-preview-grid">
          <div className="preview-window-card">
            <div className="preview-card-header">
              <TermIcon size={12} color={theme.accentHighlight || '#88C0D0'} />
              <span>Terminal ({Math.round(localTerminalScale * 100)}% — {localTerminalPx}px)</span>
            </div>
            <textarea
              className="live-preview-textarea"
              style={{
                backgroundColor: theme.bgEarth || '#141E26',
                color: theme.textParchment || '#E6EDF0',
                borderColor: theme.accentMana || '#5E81AC',
                fontSize: `${localTerminalPx}px`,
                fontFamily: theme.fontMono || 'monospace'
              }}
              value={terminalSampleText}
              onChange={(e) => setTerminalSampleText(e.target.value)}
            />
          </div>

          <div className="preview-window-card">
            <div className="preview-card-header">
              <FileCode size={12} color={theme.accentMana || '#5E81AC'} />
              <span>Editor ({Math.round(localEditorScale * 100)}% — {localEditorPx}px)</span>
            </div>
            <textarea
              className="live-preview-textarea"
              style={{
                backgroundColor: theme.bgCanopy || '#1F2D3A',
                color: theme.textParchment || '#E6EDF0',
                borderColor: theme.accentHighlight || '#88C0D0',
                fontSize: `${localEditorPx}px`,
                fontFamily: theme.fontMono || 'monospace'
              }}
              value={editorSampleText}
              onChange={(e) => setEditorSampleText(e.target.value)}
            />
          </div>
        </div>

        <div className="font-action-btn-row">
          <button type="button" className="font-reset-btn" onClick={handleResetFonts}>
            <RefreshCw size={12} />
            <span>Reset Default (100%)</span>
          </button>
          <button type="button" className="font-apply-btn" onClick={handleApplyFontSettings}>
            <CheckCircle2 size={12} />
            <span>Implement Font Settings</span>
          </button>
        </div>
      </div>

      {/* ── 3. Theme Customizer Modal ───────────────────────────────────────── */}
      {editingTheme && (
        <div className="explorer-modal-overlay" onClick={closeModal}>
          <div className="theme-modal-card" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header-row">
              <h3>🎨 Customize Theme</h3>
              <button type="button" className="modal-close-x" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            {/* Theme name */}
            <div className="theme-name-input-group">
              <label>Save As:</label>
              <input
                type="text"
                className="theme-name-field"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
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
                    value={editingTheme[selectedColorKey] || '#000000'}
                    onChange={(e) => setEditingTheme(prev => ({ ...prev, [selectedColorKey]: e.target.value }))}
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
