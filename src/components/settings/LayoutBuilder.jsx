import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, ArrowLeft, ArrowRight, Zap, Star } from 'lucide-react';

export default function LayoutBuilder() {
  // Search query & category dropdown filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('CUSTOM');

  // Custom user buttons from ButtonStudio (localStorage)
  const [customButtons, setCustomButtons] = useState([]);

  // Hidden pool chips (chips user removed from pool view)
  const [hiddenPoolChips, setHiddenPoolChips] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_hidden_pool_chips');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Active TouchBar items (single-row macro bar list)
  const [touchBarSlots, setTouchBarSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_layout_slots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.bottom && Array.isArray(parsed.bottom)) return parsed.bottom;
      }
      return ['AGY', 'CLD', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX', 'ESC', 'TAB', '^C', 'clear'];
    } catch {
      return ['AGY', 'CLD', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX', 'ESC', 'TAB', '^C', 'clear'];
    }
  });

  // Selection state:
  // selectedPoolItem: { type: 'pool', key: '...' }
  // selectedBarIndex: index in touchBarSlots
  const [selectedPoolItem, setSelectedPoolItem] = useState(null);
  const [selectedBarIndex, setSelectedBarIndex] = useState(null);

  // Load custom buttons from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sovereign_custom_buttons');
      if (saved) setCustomButtons(JSON.parse(saved));
    } catch {}
  }, []);

  // Built-in Categorized Preset Bundles
  const prebuiltCategories = {
    AGY: { name: 'Anti-Gravity CLI - AGY', items: ['AGY', '/model', '/clear', '/plan', '/schedule', '/goal', '/grill-me', '/teamwork', '/learn', 'Ctrl+O'] },
    APT: { name: 'APT Package Manager - APT', items: ['APT', 'upgrade -y', 'apt update', 'apt search', 'apt install', 'apt purge', 'autoremove', 'apt clean', 'dpkg -l'] },
    CLD: { name: 'Claude CLI - CLD', items: ['CLD', '/compact', '/cost', '/doctor', '/clear', '/help', '/init', '/bug', '/review', 'Ctrl+C'] },
    DOC: { name: 'Docker Suite - DOC', items: ['DOC', 'docker ps', 'docker ps -a', 'compose up', 'compose down', 'compose logs', 'docker exec', 'prune -f', 'docker images'] },
    FILE: { name: 'Files & Permissions - FILE', items: ['FILE', 'chmod +x', 'chmod 755', 'chmod 644', 'chown -R', 'chgrp -R', 'mkdir -p', 'find . -name', 'rsync -avz', 'tar -czvf', 'tar -xvf', 'unzip'] },
    GIT: { name: 'Git Version Control - GIT', items: ['GIT', 'git status', 'git log -10', 'git add .', 'git commit', 'git push', 'git pull', 'git checkout', 'git diff'] },
    HMS: { name: 'Hermes Agent - HMS', items: ['HMS', '/status', '/reset', '/tools', '/logs', '/cancel', '/config', '/memory', '/mcp'] },
    KEY: { name: 'Keyboard Shortcuts - KEY', items: ['MACROS', '|', '~', '>', '>>', '<', '&&', '||', ';', '`', '\\', '/', '$', '#', 'ESC', 'TAB', 'DEL', '^C', '^Z', '^D', '^A', '^E', '^K', '^U', '^W', '^Y', '^R', '^L'] },
    NET: { name: 'Networking Tools - NET', items: ['NET', 'ip a', 'ping', 'netstat', 'ss -tulpn', 'ufw status', 'curl -I', 'dig', 'traceroute'] },
    PAC: { name: 'Arch Pacman - PAC', items: ['PAC', 'upgrade -y', 'pacman install', 'pacman search', 'pacman remove', 'pacman clean', 'pacman list'] },
    PY:  { name: 'Python & Venv - PY', items: ['PY', 'python3', 'pip install', 'venv create', 'venv activate', 'pip list', 'pip freeze'] },
    SYS: { name: 'System Admin - SYS', items: ['SYS', 'systemctl', 'restart srv', 'journalctl', 'lsblk', 'blkid', 'df -h', 'du -sh *', 'fdisk -l', 'dmesg -T', 'htop', 'free -h', 'top', 'uptime'] },
    TMX: { name: 'Tmux Manager - TMX', items: ['TMX', 'tmux ls', 'tmux new', 'tmux attach', 'tmux kill', 'split h', 'split v'] },
    YUM: { name: 'Fedora/RHEL DNF - YUM', items: ['YUM', 'upgrade -y', 'dnf update', 'dnf install', 'dnf search', 'dnf remove', 'autoremove', 'dnf clean'] }
  };

  // Compute available pool items based on category & search query
  const getPoolItems = () => {
    let items = [];
    if (selectedCategory === 'CUSTOM') {
      items = customButtons.map(b => b.name || b.label || 'Custom');
      if (items.length === 0) items = ['(No Custom Buttons Created Yet)'];
    } else if (prebuiltCategories[selectedCategory]) {
      items = prebuiltCategories[selectedCategory].items;
    } else {
      // All items combined
      items = Object.values(prebuiltCategories).flatMap(c => c.items);
    }

    // Apply Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.toLowerCase().includes(q));
    }

    // Filter out hidden pool chips
    return items.filter(item => !hiddenPoolChips.includes(item));
  };

  const poolItems = getPoolItems();

  // Selection Handlers with propagation control
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

  // Save TouchBar layout to localStorage
  const saveLayout = (newSlots) => {
    setTouchBarSlots(newSlots);
    try {
      localStorage.setItem('sovereign_layout_slots', JSON.stringify(newSlots));
    } catch {}
  };

  // Add selected pool item to TouchBar
  const handleAddSelectedToBar = (e) => {
    e.stopPropagation();
    if (!selectedPoolItem) return;
    const updated = [...touchBarSlots, selectedPoolItem];
    saveLayout(updated);
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

  // Dual-Purpose Delete Handler
  const handleDelete = (e) => {
    e.stopPropagation();
    if (selectedBarIndex !== null) {
      // Delete button from active TouchBar
      const updated = touchBarSlots.filter((_, idx) => idx !== selectedBarIndex);
      saveLayout(updated);
      setSelectedBarIndex(null);
    } else if (selectedPoolItem !== null) {
      // Hide button chip from Available Pool View
      const updatedHidden = [...hiddenPoolChips, selectedPoolItem];
      setHiddenPoolChips(updatedHidden);
      try {
        localStorage.setItem('sovereign_hidden_pool_chips', JSON.stringify(updatedHidden));
      } catch {}
      setSelectedPoolItem(null);
    }
  };

  // Deselect active selections when clicking any blank space
  const handleContainerClick = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('button')) {
      return;
    }
    setSelectedPoolItem(null);
    setSelectedBarIndex(null);
  };

  return (
    <div className="layout-builder-container" onClick={handleContainerClick}>
      {/* 1. TOP CARD SECTION: SEARCH + CATEGORIZED DROPDOWN */}
      <div className="layout-editor-card" onClick={handleContainerClick}>
        <div className="search-filter-header" onClick={handleContainerClick}>
          <div className="search-input-box">
            <Search size={14} color="var(--accent-mana)" />
            <input
              type="text"
              placeholder="Search buttons & macros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="category-select-wrapper">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="category-dropdown"
            >
              {/* SECTION 1: CUSTOM BUTTONS (TOP PRIORITY) */}
              <optgroup label="CUSTOM CREATIONS">
                <option value="CUSTOM">[CUSTOM] Custom Buttons ({customButtons.length})</option>
              </optgroup>

              {/* SECTION 2: ALPHABETICAL PRE-BUILT TOOLKITS */}
              <optgroup label="PRE-BUILT TOOLKITS">
                {Object.entries(prebuiltCategories)
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

        {/* 2. MIDDLE UPPER SECTION: AVAILABLE BUTTONS POOL */}
        <div className="available-pool-section" onClick={handleContainerClick}>
          <div className="pool-section-label" onClick={handleContainerClick}>
            <span>AVAILABLE BUTTONS POOL ({poolItems.length})</span>
            {hiddenPoolChips.length > 0 && (
              <button
                type="button"
                className="reset-pool-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setHiddenPoolChips([]);
                  try { localStorage.removeItem('sovereign_hidden_pool_chips'); } catch {}
                }}
              >
                Reset Hidden Chips
              </button>
            )}
          </div>

          <div className="available-chips-grid" onClick={handleContainerClick}>
            {poolItems.map((item, idx) => {
              const isSelected = selectedPoolItem === item;
              const isLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

              return (
                <button
                  key={`pool-${item}-${idx}`}
                  type="button"
                  className={`pool-chip-item ${isSelected ? 'selected-glow' : ''} ${isLauncher ? 'launcher-chip' : ''}`}
                  onClick={(e) => handleSelectPoolItem(e, item)}
                >
                  {isLauncher && <Zap size={10} color="var(--accent-mana)" style={{ marginRight: '3px' }} />}
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. MIDDLE LOWER SECTION: LIVE TOUCHBAR PREVIEW ROW */}
        <div className="live-bar-preview-section" onClick={handleContainerClick}>
          <div className="bar-preview-label" onClick={handleContainerClick}>
            <span>LIVE TOUCHBAR PREVIEW (SCROLLABLE BOTTOM ROW)</span>
          </div>

          <div className="live-bar-strip-wrapper" onClick={handleContainerClick}>
            <div className="live-bar-strip" onClick={handleContainerClick}>
              {touchBarSlots.map((item, idx) => {
                const isSelected = selectedBarIndex === idx;
                const isLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

                return (
                  <button
                    key={`bar-${item}-${idx}`}
                    type="button"
                    className={`live-bar-tile ${isSelected ? 'selected-bar-tile' : ''} ${isLauncher ? 'launcher-tile' : ''}`}
                    onClick={(e) => handleSelectBarItem(e, idx)}
                  >
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className={`add-to-bar-btn ${selectedPoolItem ? 'active-add' : ''}`}
              onClick={(e) => handleAddSelectedToBar(e)}
              disabled={!selectedPoolItem}
              title="Add Selected Pool Button to TouchBar"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* 4. BOTTOM SECTION: STREAMLINED DUAL-PURPOSE ACTION CONTROLLER */}
        <div className="single-bar-control-console" onClick={handleContainerClick}>
          <div className="console-left-group" onClick={handleContainerClick}>
            <button
              type="button"
              className="action-btn"
              disabled={selectedBarIndex === null || selectedBarIndex === 0}
              onClick={(e) => handleMoveBarItem(e, 'left')}
            >
              <ArrowLeft size={13} />
              <span>Move Left</span>
            </button>

            <button
              type="button"
              className="action-btn"
              disabled={selectedBarIndex === null || selectedBarIndex === touchBarSlots.length - 1}
              onClick={(e) => handleMoveBarItem(e, 'right')}
            >
              <span>Move Right</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <button
            type="button"
            className="action-btn delete-action-btn"
            disabled={selectedBarIndex === null && selectedPoolItem === null}
            onClick={(e) => handleDelete(e)}
            title={selectedBarIndex !== null ? "Remove from TouchBar" : "Hide from Pool View"}
          >
            <Trash2 size={13} />
            <span>
              {selectedBarIndex !== null
                ? "Remove from Bar"
                : selectedPoolItem !== null
                ? "Hide from Pool"
                : "Delete"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
