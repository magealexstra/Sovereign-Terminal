import React, { useState, useEffect } from 'react';
import { X, Terminal as TermIcon, FileCode, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SurfaceSettingsModal({ isOpen, onClose }) {
  const {
    theme,
    deviceBaselinePx,
    terminalScaleMultiplier,
    setTerminalScaleMultiplier,
    editorScaleMultiplier,
    setEditorScaleMultiplier,
    inputScaleMultiplier,
    setInputScaleMultiplier,
    terminalBgLightness,
    setTerminalBgLightness,
    terminalMixColor,
    setTerminalMixColor,
    editorBgLightness,
    setEditorBgLightness,
    editorMixColor,
    setEditorMixColor,
    inputBgLightness,
    setInputBgLightness,
    inputMixColor,
    setInputMixColor,
    syncUserSettingsToServer,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('terminal'); // 'terminal' | 'editor' | 'input'

  // Uncommitted local draft state
  const [draftTermLightness, setDraftTermLightness] = useState(terminalBgLightness || '18%');
  const [draftTermMixColor, setDraftTermMixColor]   = useState(terminalMixColor);
  const [draftTermScale, setDraftTermScale]         = useState(terminalScaleMultiplier || 1.0);

  const [draftEdLightness, setDraftEdLightness]     = useState(editorBgLightness || '18%');
  const [draftEdMixColor, setDraftEdMixColor]       = useState(editorMixColor);
  const [draftEdScale, setDraftEdScale]             = useState(editorScaleMultiplier || 1.0);

  const [draftInLightness, setDraftInLightness]     = useState(inputBgLightness || '14%');
  const [draftInMixColor, setDraftInMixColor]       = useState(inputMixColor);
  const [draftInScale, setDraftInScale]             = useState(inputScaleMultiplier || 1.0);

  // Sync draft state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftTermLightness(terminalBgLightness || '18%');
      setDraftTermMixColor(terminalMixColor);
      setDraftTermScale(terminalScaleMultiplier || 1.0);

      setDraftEdLightness(editorBgLightness || '18%');
      setDraftEdMixColor(editorMixColor);
      setDraftEdScale(editorScaleMultiplier || 1.0);

      setDraftInLightness(inputBgLightness || '14%');
      setDraftInMixColor(inputMixColor);
      setDraftInScale(inputScaleMultiplier || 1.0);
    }
  }, [
    isOpen,
    terminalBgLightness, terminalMixColor, terminalScaleMultiplier,
    editorBgLightness, editorMixColor, editorScaleMultiplier,
    inputBgLightness, inputMixColor, inputScaleMultiplier
  ]);

  if (!isOpen) return null;

  // Active theme swatches for quick mix-target selection
  const themeSwatches = [
    { label: 'Parchment', hex: theme?.textParchment || '#E6EDF0' },
    { label: 'Mana',      hex: theme?.accentMana || '#5E81AC' },
    { label: 'Highlight', hex: theme?.accentHighlight || '#88C0D0' },
    { label: 'Br.Cyan',   hex: theme?.brightCyan || '#88C0D0' },
    { label: 'Br.Blue',   hex: theme?.brightBlue || '#81A1C1' },
    { label: 'White',     hex: '#FFFFFF' },
  ];

  // Helper getters/setters for active sub-tab
  const getActiveLightness = () => {
    if (activeSubTab === 'terminal') return draftTermLightness;
    if (activeSubTab === 'editor')   return draftEdLightness;
    return draftInLightness;
  };

  const getActiveMixColor = () => {
    if (activeSubTab === 'terminal') return draftTermMixColor;
    if (activeSubTab === 'editor')   return draftEdMixColor;
    return draftInMixColor;
  };

  const getActiveScale = () => {
    if (activeSubTab === 'terminal') return draftTermScale;
    if (activeSubTab === 'editor')   return draftEdScale;
    return draftInScale;
  };

  const setActiveLightness = (val) => {
    const formatted = typeof val === 'number' ? `${val}%` : val;
    if (activeSubTab === 'terminal') setDraftTermLightness(formatted);
    else if (activeSubTab === 'editor') setDraftEdLightness(formatted);
    else setDraftInLightness(formatted);
  };

  const setActiveMixColor = (val) => {
    if (activeSubTab === 'terminal') setDraftTermMixColor(val);
    else if (activeSubTab === 'editor') setDraftEdMixColor(val);
    else setDraftInMixColor(val);
  };

  const setActiveScale = (val) => {
    if (activeSubTab === 'terminal') setDraftTermScale(val);
    else if (activeSubTab === 'editor') setDraftEdScale(val);
    else setDraftInScale(val);
  };

  // Tab-scoped Reset (reverts active sub-tab only)
  const handleResetActiveTab = () => {
    if (activeSubTab === 'terminal') {
      setDraftTermLightness('18%');
      setDraftTermMixColor(null);
      setDraftTermScale(1.0);
    } else if (activeSubTab === 'editor') {
      setDraftEdLightness('18%');
      setDraftEdMixColor(null);
      setDraftEdScale(1.0);
    } else {
      setDraftInLightness('14%');
      setDraftInMixColor(null);
      setDraftInScale(1.0);
    }
  };

  // Commit and Save globally
  const handleSaveAll = () => {
    setTerminalBgLightness(draftTermLightness);
    setTerminalMixColor(draftTermMixColor);
    setTerminalScaleMultiplier(draftTermScale);

    setEditorBgLightness(draftEdLightness);
    setEditorMixColor(draftEdMixColor);
    setEditorScaleMultiplier(draftEdScale);

    setInputBgLightness(draftInLightness);
    setInputMixColor(draftInMixColor);
    setInputScaleMultiplier(draftInScale);

    syncUserSettingsToServer({
      terminalBgLightness: draftTermLightness,
      terminalMixColor:    draftTermMixColor,
      terminalScaleMultiplier: draftTermScale,
      editorBgLightness:   draftEdLightness,
      editorMixColor:      draftEdMixColor,
      editorScaleMultiplier: draftEdScale,
      inputBgLightness:    draftInLightness,
      inputMixColor:       draftInMixColor,
      inputScaleMultiplier: draftInScale,
    }).catch(err => console.error('Server sync error:', err));

    onClose();
  };

  const currentLightnessPct = parseInt(getActiveLightness(), 10) || 0;
  const currentScale = getActiveScale();
  const currentPixelSize = Math.round(deviceBaselinePx * currentScale);
  const activeEffectiveMixColor = getActiveMixColor() || theme?.textParchment || '#E6EDF0';

  // Sample texts
  const terminalSampleText =
    'mage@sovereign:~$ docker ps\nCONTAINER ID   IMAGE                STATUS\n896468d35eb4   sovereign-terminal   Up 30m (healthy)\nmage@sovereign:~$ echo "Terminal Surface Active"';

  const editorSampleText =
    'def initialize_sovereign_node(hostname="192.168.2.100"):\n    """Sovereign Workstation Node Gateway."""\n    print(f"Connected to {hostname}:2069")\n    return True';

  const inputSampleText =
    'mage@sovereign:~$ git commit -m "feat: surface color correction & sizing modal"';

  return (
    <div className="explorer-modal-overlay" onClick={onClose}>
      <div className="surface-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header-row">
          <div className="modal-header-title">
            <SlidersHorizontal size={16} color="var(--accent-highlight)" />
            <h3>Surface &amp; Typography Settings</h3>
          </div>
          <button type="button" className="modal-close-x" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Sub-Tabs Bar */}
        <div className="surface-subtabs-bar">
          <button
            type="button"
            className={`surface-tab-btn ${activeSubTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('terminal')}
          >
            <TermIcon size={12} />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            className={`surface-tab-btn ${activeSubTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('editor')}
          >
            <FileCode size={12} />
            <span>Editor</span>
          </button>

          <button
            type="button"
            className={`surface-tab-btn ${activeSubTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('input')}
          >
            <SlidersHorizontal size={12} />
            <span>Inputs</span>
          </button>
        </div>

        {/* Controls Body */}
        <div className="surface-modal-body">
          
          {/* Surface Brightness Slider */}
          <div className="surface-control-group">
            <div className="surface-control-label">
              <span>Surface Brightness (Lightness Ratio)</span>
              <strong>{currentLightnessPct}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              value={currentLightnessPct}
              onChange={(e) => setActiveLightness(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          {/* Mix Target Color Controls */}
          <div className="surface-control-group">
            <div className="surface-control-label">
              <span>Mix Target Color</span>
              <span className="mix-color-subtext">
                {getActiveMixColor() ? 'Custom Override' : 'Auto (Theme Text)'}
              </span>
            </div>

            <div className="mix-color-picker-row">
              <input
                type="text"
                className="audition-hex-input"
                value={activeEffectiveMixColor}
                onChange={(e) => setActiveMixColor(e.target.value)}
                placeholder="#HEX"
                maxLength={7}
              />
              
              <input
                type="color"
                className="audition-native-picker"
                value={activeEffectiveMixColor.startsWith('#') ? activeEffectiveMixColor : '#E6EDF0'}
                onChange={(e) => setActiveMixColor(e.target.value)}
              />

              <div className="mix-swatch-strip">
                {themeSwatches.map((swatch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`mix-swatch-dot ${getActiveMixColor() === swatch.hex ? 'selected' : ''}`}
                    style={{ backgroundColor: swatch.hex }}
                    onClick={() => setActiveMixColor(swatch.hex)}
                    title={`Set mix target to ${swatch.label} (${swatch.hex})`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Font Scale Slider */}
          <div className="surface-control-group">
            <div className="surface-control-label">
              <span>Font Size / Scale Multiplier</span>
              <strong>{Math.round(currentScale * 100)}% ({currentPixelSize}px)</strong>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.0"
              step="0.05"
              value={currentScale}
              onChange={(e) => setActiveScale(Number(e.target.value))}
              className="font-slider"
            />
          </div>

          {/* Interactive Live Sample Preview Textarea */}
          <div className="surface-preview-container">
            <div className="preview-card-header">
              <span>Interactive Live Preview ({activeSubTab.toUpperCase()})</span>
            </div>
            <textarea
              className="live-preview-textarea"
              style={{
                backgroundColor: `color-mix(in srgb, ${theme?.bgEarth || '#0A1118'} calc(100% - ${currentLightnessPct}%), ${activeEffectiveMixColor} ${currentLightnessPct}%)`,
                color: theme?.textParchment || '#E6EDF0',
                borderColor: theme?.accentMana || '#5E81AC',
                fontSize: `${currentPixelSize}px`,
                fontFamily: theme?.fontMono || 'monospace'
              }}
              value={
                activeSubTab === 'terminal'
                  ? terminalSampleText
                  : activeSubTab === 'editor'
                  ? editorSampleText
                  : inputSampleText
              }
              readOnly
            />
          </div>

        </div>

        {/* Footer Actions (Pure Text Labels, No Icons) */}
        <div className="modal-btn-row surface-modal-footer">
          <button type="button" className="btn-surface-reset" onClick={handleResetActiveTab}>
            Reset
          </button>
          <button type="button" className="btn-surface-save" onClick={handleSaveAll}>
            Save
          </button>
        </div>

      </div>
    </div>
  );
}
