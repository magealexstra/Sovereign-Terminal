import React, { useState } from 'react';
import { Plus, Sliders, Code, Trash2, Type, Square, Layers, Save, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ButtonStudio() {
  const { theme } = useApp();

  const DEFAULT_BUTTONS = [
    { id: 'b1', label: 'ESC', value: '\x1b', width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b2', label: 'TAB', value: '\t',   width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b3', label: '^C', value: '\x03', width: 2.4, height: 2.0, shape: 'rounded', bg: '#141E26', text: '#E6EDF0', border: '#5E81AC' },
    { id: 'b4', label: 'htop', value: 'htop\n', width: 3.2, height: 2.0, shape: 'pill', bg: '#141E26', text: '#5E81AC', border: '#4C7864' },
    { id: 'b5', label: 'docker ps', value: 'docker ps\n', width: 4.2, height: 2.0, shape: 'rounded', bg: '#21252b', text: '#88C0D0', border: '#fcee0a' },
  ];

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
    setAuditionHex(color); // sync audition box so user can inspect then Add
  };

  // Add auditionHex to custom swatches — normalized to lowercase to avoid case-mismatch duplicates
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

  // Built-in Categorized Preset Bundles from Layout Tab (No Emojis)
  const prebuiltCategories = {
    AGY: { name: 'Anti-Gravity CLI - AGY', items: [
      { label: '/model', value: '/model ' },
      { label: '/clear', value: '/clear\n' },
      { label: '/plan', value: '/plan ' },
      { label: '/schedule', value: '/schedule ' },
      { label: '/goal', value: '/goal ' },
      { label: '/grill-me', value: '/grill-me ' },
      { label: '/teamwork', value: '/teamwork-preview ' },
      { label: '/learn', value: '/learn ' },
      { label: 'Ctrl+O', value: '\x0f' }
    ]},
    APT: { name: 'APT Package Manager - APT', items: [
      { label: 'upgrade -y', value: 'sudo apt update && sudo apt upgrade -y\n' },
      { label: 'apt update', value: 'sudo apt update\n' },
      { label: 'apt search', value: 'sudo apt search ' },
      { label: 'apt install', value: 'sudo apt install ' },
      { label: 'apt purge', value: 'sudo apt purge ' },
      { label: 'autoremove', value: 'sudo apt autoremove -y\n' },
      { label: 'apt clean', value: 'sudo apt clean\n' },
      { label: 'dpkg -l', value: 'dpkg -l\n' }
    ]},
    CLD: { name: 'Claude CLI - CLD', items: [
      { label: '/compact', value: '/compact\n' },
      { label: '/cost', value: '/cost\n' },
      { label: '/doctor', value: '/doctor\n' },
      { label: '/clear', value: '/clear\n' },
      { label: '/help', value: '/help\n' },
      { label: '/init', value: '/init\n' },
      { label: '/bug', value: '/bug ' },
      { label: '/review', value: '/review ' },
      { label: 'Ctrl+C', value: '\x03' }
    ]},
    DOC: { name: 'Docker Suite - DOC', items: [
      { label: 'docker ps', value: 'docker ps\n' },
      { label: 'docker ps -a', value: 'docker ps -a\n' },
      { label: 'compose up', value: 'docker compose up -d\n' },
      { label: 'compose down', value: 'docker compose down\n' },
      { label: 'compose logs', value: 'docker compose logs -f\n' },
      { label: 'docker exec', value: 'docker exec -it ' },
      { label: 'prune -f', value: 'docker system prune -f\n' },
      { label: 'docker images', value: 'docker images\n' }
    ]},
    FILE: { name: 'Files & Permissions - FILE', items: [
      { label: 'chmod +x', value: 'chmod +x ' },
      { label: 'chmod 755', value: 'chmod 755 ' },
      { label: 'chmod 644', value: 'chmod 644 ' },
      { label: 'chown -R', value: 'sudo chown -R ' },
      { label: 'chgrp -R', value: 'sudo chgrp -R ' },
      { label: 'mkdir -p', value: 'mkdir -p ' },
      { label: 'find . -name', value: 'find . -name ' },
      { label: 'rsync -avz', value: 'rsync -avz ' },
      { label: 'tar -czvf', value: 'tar -czvf ' },
      { label: 'tar -xvf', value: 'tar -xvf ' },
      { label: 'unzip', value: 'unzip ' }
    ]},
    GIT: { name: 'Git Version Control - GIT', items: [
      { label: 'git status', value: 'git status\n' },
      { label: 'git log -10', value: 'git log --oneline -n 10\n' },
      { label: 'git add .', value: 'git add .\n' },
      { label: 'git commit', value: 'git commit -m "' },
      { label: 'git push', value: 'git push\n' },
      { label: 'git pull', value: 'git pull\n' },
      { label: 'git checkout', value: 'git checkout -b ' },
      { label: 'git diff', value: 'git diff\n' }
    ]},
    HMS: { name: 'Hermes Agent - HMS', items: [
      { label: '/status', value: '/status\n' },
      { label: '/reset', value: '/reset\n' },
      { label: '/tools', value: '/tools\n' },
      { label: '/logs', value: '/logs\n' },
      { label: '/cancel', value: '/cancel\n' },
      { label: '/config', value: '/config ' },
      { label: '/memory', value: '/memory ' },
      { label: '/mcp', value: '/mcp ' }
    ]},
    KEY: { name: 'Keyboard Shortcuts - KEY', items: [
      { label: '|', value: '|' },
      { label: '~', value: '~' },
      { label: '>', value: '>' },
      { label: '>>', value: '>>' },
      { label: '<', value: '<' },
      { label: '&&', value: '&& ' },
      { label: '||', value: '|| ' },
      { label: ';', value: '; ' },
      { label: '`', value: '`' },
      { label: '\\', value: '\\' },
      { label: '/', value: '/' },
      { label: '$', value: '$' },
      { label: '#', value: '#' },
      { label: 'ESC', value: '\x1b' },
      { label: 'TAB', value: '\t' },
      { label: 'DEL', value: '\x1b[3~' },
      { label: '^C', value: '\x03' },
      { label: '^Z', value: '\x1a' },
      { label: '^D', value: '\x04' },
      { label: '^A', value: '\x01' },
      { label: '^E', value: '\x05' },
      { label: '^K', value: '\x0b' },
      { label: '^U', value: '\x15' },
      { label: '^W', value: '\x17' },
      { label: '^Y', value: '\x19' },
      { label: '^R', value: '\x12' },
      { label: '^L', value: '\x0c' }
    ]},
    NET: { name: 'Networking Tools - NET', items: [
      { label: 'ip a', value: 'ip a\n' },
      { label: 'ping', value: 'ping -c 4 ' },
      { label: 'netstat', value: 'sudo netstat -tuln\n' },
      { label: 'ss -tulpn', value: 'sudo ss -tulpn\n' },
      { label: 'ufw status', value: 'sudo ufw status\n' },
      { label: 'curl -I', value: 'curl -I ' },
      { label: 'dig', value: 'dig ' },
      { label: 'traceroute', value: 'traceroute ' }
    ]},
    PAC: { name: 'Arch Pacman - PAC', items: [
      { label: 'upgrade -y', value: 'sudo pacman -Syu\n' },
      { label: 'pacman install', value: 'sudo pacman -S ' },
      { label: 'pacman search', value: 'pacman -Ss ' },
      { label: 'pacman remove', value: 'sudo pacman -Rns ' },
      { label: 'pacman clean', value: 'sudo pacman -Sc\n' },
      { label: 'pacman list', value: 'pacman -Qe\n' }
    ]},
    PY: { name: 'Python & Venv - PY', items: [
      { label: 'python3', value: 'python3 ' },
      { label: 'pip install', value: 'pip install ' },
      { label: 'venv create', value: 'python3 -m venv venv\n' },
      { label: 'venv activate', value: 'source venv/bin/activate\n' },
      { label: 'pip list', value: 'pip list\n' },
      { label: 'pip freeze', value: 'pip freeze > requirements.txt\n' }
    ]},
    SYS: { name: 'System Admin - SYS', items: [
      { label: 'systemctl', value: 'sudo systemctl status ' },
      { label: 'restart srv', value: 'sudo systemctl restart ' },
      { label: 'journalctl', value: 'sudo journalctl -xeu ' },
      { label: 'lsblk', value: 'lsblk\n' },
      { label: 'blkid', value: 'sudo blkid\n' },
      { label: 'df -h', value: 'df -h\n' },
      { label: 'du -sh *', value: 'du -sh *\n' },
      { label: 'fdisk -l', value: 'sudo fdisk -l\n' },
      { label: 'dmesg -T', value: 'sudo dmesg -T\n' },
      { label: 'htop', value: 'htop\n' },
      { label: 'free -h', value: 'free -h\n' },
      { label: 'top', value: 'top\n' },
      { label: 'uptime', value: 'uptime\n' }
    ]},
    TMX: { name: 'Tmux Manager - TMX', items: [
      { label: 'tmux ls', value: 'tmux ls\n' },
      { label: 'tmux new', value: 'tmux new-session -s ' },
      { label: 'tmux attach', value: 'tmux attach -t ' },
      { label: 'tmux kill', value: 'tmux kill-session -t ' },
      { label: 'split h', value: '\x02%' },
      { label: 'split v', value: '\x02"' }
    ]},
    YUM: { name: 'Fedora/RHEL DNF - YUM', items: [
      { label: 'upgrade -y', value: 'sudo dnf upgrade --refresh -y\n' },
      { label: 'dnf update', value: 'sudo dnf update\n' },
      { label: 'dnf install', value: 'sudo dnf install ' },
      { label: 'dnf search', value: 'dnf search ' },
      { label: 'dnf remove', value: 'sudo dnf remove ' },
      { label: 'autoremove', value: 'sudo dnf autoremove\n' },
      { label: 'dnf clean', value: 'sudo dnf clean all\n' }
    ]}
  };

  const handleSelectPresetOrCustom = (selectedKey) => {
    // Check if it's a custom button ID
    const custom = buttons.find((b) => b.id === selectedKey);
    if (custom) {
      setSelectedId(selectedKey);
      return;
    }

    // Check if it's a prebuilt item value
    for (const cat of Object.values(prebuiltCategories)) {
      const match = cat.items.find(item => item.label === selectedKey || item.value === selectedKey);
      if (match) {
        const existing = buttons.find(b => b.label === match.label);
        if (existing) {
          setSelectedId(existing.id);
        } else {
          // Instantiate a editable preset button
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
    if (!searchQuery.trim()) return prebuiltCategories;
    const q = searchQuery.toLowerCase();
    const filtered = {};

    Object.entries(prebuiltCategories).forEach(([key, cat]) => {
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
            value={activeBtn?.id || ''}
            onChange={(e) => handleSelectPresetOrCustom(e.target.value)}
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
          <button type="button" className="studio-new-btn" onClick={handleCreateNew}>
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Main Surround Grid with Dynamic Flex Growth */}
      <div className="studio-mobile-grid">
        {/* LEFT REGION: Command Output & Function (Dynamic Growth) */}
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
        <div className="region-box center">
          <span className="center-tag">PREVIEW</span>
          <button
            type="button"
            className={`live-studio-btn ${activeBtn.shape}`}
            style={{
              width: `${activeBtn.width}rem`,
              height: `${activeBtn.height}rem`,
              backgroundColor: activeBtn.bg,
              color: activeBtn.text,
              borderColor: activeBtn.border,
              borderWidth: '2px',
              borderStyle: 'solid'
            }}
          >
            {activeBtn.label}
          </button>
        </div>

        {/* RIGHT REGION: Size, Shape & Pinned Save (Dynamic Growth) */}
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
      <div className="studio-lower-color-console">
        <div className="target-layer-row">
          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'text' ? 'active' : ''}`}
            onClick={() => setTargetLayer('text')}
          >
            <Type size={12} />
            <span>Text Color</span>
          </button>

          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'bg' ? 'active' : ''}`}
            onClick={() => setTargetLayer('bg')}
          >
            <Square size={12} />
            <span>Background</span>
          </button>

          <button
            type="button"
            className={`target-layer-btn ${targetLayer === 'border' ? 'active' : ''}`}
            onClick={() => setTargetLayer('border')}
          >
            <Layers size={12} />
            <span>Border / Icon</span>
          </button>
        </div>

        <div className="dual-color-console">
          <div className="vertical-swatch-palette">
            <span className="swatch-group-title">Theme Swatches (16)</span>
            <div className="swatch-grid-rows">
              {themeSwatches.map((color, idx) => (
                <span
                  key={`theme-${idx}-${color}`}
                  className="palette-dot"
                  style={{ backgroundColor: color }}
                  onClick={() => handleApplySwatch(color)}
                  title={`Apply ${color} to ${targetLayer}`}
                />
              ))}
            </div>

            {customSwatches.length > 0 && (
              <>
                <span className="swatch-group-title" style={{ marginTop: '0.4rem' }}>User Custom Swatches</span>
                <div className="swatch-grid-rows">
                  {customSwatches.map((color, idx) => (
                    <span
                      key={`custom-${idx}-${color}`}
                      className="palette-dot custom-dot"
                      style={{ backgroundColor: color }}
                      onClick={() => handleApplySwatch(color)}
                      title={`Apply ${color} to ${targetLayer}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="right-audition-panel">
            <div
              className="large-audition-box"
              style={{ backgroundColor: auditionHex }}
              onClick={() => handleApplySwatch(auditionHex)}
              title="Tap to apply color directly to selected layer"
            >
              <span>{auditionHex}</span>
            </div>

            <div className="audition-input-row">
              <input
                type="color"
                className="audition-native-picker"
                value={auditionHex}
                onChange={(e) => setAuditionHex(e.target.value)}
              />
              <input
                type="text"
                className="audition-hex-input"
                value={auditionHex}
                onChange={(e) => setAuditionHex(e.target.value)}
                placeholder="#HEX"
              />
            </div>

            <div className="audition-btn-row">
              <button type="button" className="add-swatch-btn" onClick={handleAddSwatch}>
                <Plus size={12} />
                <span>Add</span>
              </button>
              <button type="button" className="clear-swatch-btn" onClick={handleClearAudition}>
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
