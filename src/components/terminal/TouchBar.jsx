import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, KeyRound, Trash2, Zap, X, Edit3 } from 'lucide-react';
import StagingDrawer from './StagingDrawer';
import { PREBUILT_CATEGORIES } from '../settings/button-studio/buttonData';

export default function TouchBar({ onKeyPress, onVoiceInput }) {
  const [isRecording, setIsRecording] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [showStager, setShowStager] = useState(false);
  const [stagerText, setStagerText] = useState('');
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef(null);
  const lastSpeechRef = useRef('');
  const micToastTimerRef = useRef(null);

  const wasStagerOpen = useRef(false);
  useEffect(() => {
    if (wasStagerOpen.current && !showStager) {
      window.dispatchEvent(new Event('terminal-focus'));
    }
    wasStagerOpen.current = showStager;
  }, [showStager]);

  const [primaryGroup, setPrimaryGroup] = useState('AI');
  const [selectedSuite, setSelectedSuite] = useState('AGY');
  const [suiteOverrides, setSuiteOverrides] = useState({});
  const [customSuiteData, setCustomSuiteData] = useState({});
  const [customMacroSuites, setCustomMacroSuites] = useState([]);
  const [customButtonStyles, setCustomButtonStyles] = useState({});
  const [showFocusedSuiteModal, setShowFocusedSuiteModal] = useState(false);
  const [focusedSuiteName, setFocusedSuiteName] = useState(null);
  const [focusedSubSuite, setFocusedSubSuite] = useState(null);

  const GROUPS = {
    AI: { label: 'AI', suites: ['AGY', 'CLD', 'HMS'] },
    EDIT: { label: 'EDIT', suites: ['VIM', 'TXT', 'FILE'] },
    PKG: { label: 'PKG', suites: ['APT', 'PAC', 'YUM'] },
    SYS: { label: 'SYS', suites: ['DOC', 'GIT', 'SYS', 'NET', 'PY', 'NPM', 'TMX'] },
    KEY: { label: 'KEY', suites: ['KEY_NAV', 'KEY_FN', 'KEY_SYM', 'KEY_MODE', 'KEY_LINE'] },
  };

  const SUB_LABELS = {
    AGY: 'AGY',
    CLD: 'CLD',
    HMS: 'HMS',
    VIM: 'VIM',
    TXT: 'TXT',
    FILE: 'FILE',
    APT: 'APT',
    PAC: 'PAC',
    YUM: 'YUM',
    DOC: 'DOC',
    GIT: 'GIT',
    SYS: 'SYS',
    NET: 'NET',
    PY: 'PY',
    NPM: 'NPM',
    TMX: 'TMX',
    KEY_NAV: 'NAV',
    KEY_FN: 'FN',
    KEY_SYM: 'SYM',
    KEY_MODE: 'MODE',
    KEY_LINE: 'LINE'
  };

  // Inline mic-error toast — replaces browser alert() for non-blocking UX
  const [micToast, setMicToast] = useState(null);
  const showMicToast = (msg) => {
    setMicToast(msg);
    clearTimeout(micToastTimerRef.current);
    micToastTimerRef.current = setTimeout(() => setMicToast(null), 4000);
  };

  const PURGED_LAUNCHERS = ['AGY', 'CLD', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX', 'clear'];

  // Load active TouchBar layout from localStorage (or fallback defaults)
  const [activeSlots, setActiveSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_layout_slots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(item => !PURGED_LAUNCHERS.includes(item));
        if (parsed.bottom && Array.isArray(parsed.bottom)) return parsed.bottom.filter(item => !PURGED_LAUNCHERS.includes(item));
      }
    } catch {}
    return ['ESC', 'TAB', '^C', '-', '/'];
  });

  // Listen for layout changes across tabs / settings
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('sovereign_layout_slots');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setActiveSlots(parsed.filter(item => !PURGED_LAUNCHERS.includes(item)));
          else if (parsed.bottom && Array.isArray(parsed.bottom)) setActiveSlots(parsed.bottom.filter(item => !PURGED_LAUNCHERS.includes(item)));
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Categorized Command Toolkits (Abbreviated 3-Char Badges & AI/CLI Suites)
  const commandSuites = {
    AGY: [
      { id: 'agy0', label: 'agy', value: 'agy\n' },
      { id: 'agy1', label: '/model', value: '/model ' },
      { id: 'agy3', label: '/plan', value: '/plan ' },
      { id: 'agy4', label: '/schedule', value: '/schedule ' },
      { id: 'agy5', label: '/goal', value: '/goal ' },
      { id: 'agy6', label: '/grill-me', value: '/grill-me ' },
      { id: 'agy7', label: '/teamwork', value: '/teamwork-preview ' },
      { id: 'agy8', label: '/learn', value: '/learn ' },
      { id: 'agy9', label: '^O', value: '\x0f' },
      { id: 'agy10', label: 'update agy', value: 'npm update -g @google/antigravity\n' },
      { id: 'agy11', label: '/clear', value: '/clear\n' },
      { id: 'agy12', label: '^K', value: '\x0b' },
    ],
    CLD: [
      { id: 'cld0', label: 'claude', value: 'claude\n' },
      { id: 'cld1', label: '/compact', value: '/compact\n' },
      { id: 'cld2', label: '/cost', value: '/cost\n' },
      { id: 'cld3', label: '/doctor', value: '/doctor\n' },
      { id: 'cld5', label: '/help', value: '/help\n' },
      { id: 'cld6', label: '/init', value: '/init\n' },
      { id: 'cld7', label: '/bug', value: '/bug ' },
      { id: 'cld8', label: '/review', value: '/review ' },
      { id: 'cld9', label: '^C', value: '\x03' },
      { id: 'cld10', label: 'update cld', value: 'npm update -g @anthropic-ai/claude-code\n' },
      { id: 'cld11', label: '/clear', value: '/clear\n' },
      { id: 'cld12', label: 'mode', value: '\x1b[Z' },
    ],
    HMS: [
      { id: 'hms0', label: 'hermes', value: 'hermes\n' },
      { id: 'hms1', label: '/status', value: '/status\n' },
      { id: 'hms2', label: '/reset', value: '/reset\n' },
      { id: 'hms3', label: '/tools', value: '/tools\n' },
      { id: 'hms4', label: '/logs', value: '/logs\n' },
      { id: 'hms5', label: '/cancel', value: '/cancel\n' },
      { id: 'hms6', label: '/config', value: '/config ' },
      { id: 'hms7', label: '/memory', value: '/memory ' },
      { id: 'hms8', label: '/mcp', value: '/mcp ' },
      { id: 'hms9', label: 'update hms', value: 'pip install --upgrade hermes-agent\n' },
      { id: 'hms10', label: '/clear', value: '/clear\n' },
    ],
    VIM: [
      { id: 'vim1', label: ':w', value: '\x1b:w\n' },
      { id: 'vim2', label: ':q', value: '\x1b:q\n' },
      { id: 'vim3', label: ':wq', value: '\x1b:wq\n' },
      { id: 'vim4', label: ':q!', value: '\x1b:q!\n' },
      { id: 'vim5', label: ':w!', value: '\x1b:w!\n' },
      { id: 'vim6', label: ':x', value: '\x1b:x\n' },
      { id: 'vim7', label: '^R', value: '\x12' },
      { id: 'vim8', label: ':%s/', value: '\x1b:%s/' },
      { id: 'vim9', label: ':e!', value: '\x1b:e!\n' },
      { id: 'vim10', label: ':set nu', value: '\x1b:set nu\n' },
      { id: 'vim11', label: '\\x1b', value: '\x1b' },
    ],
    FILE: [
      { id: 'file1', label: 'chmod +x', value: 'chmod +x ' },
      { id: 'file2', label: 'chmod 755', value: 'chmod 755 ' },
      { id: 'file3', label: 'chmod 644', value: 'chmod 644 ' },
      { id: 'file4', label: 'chown -R', value: 'sudo chown -R ' },
      { id: 'file5', label: 'mkdir -p', value: 'mkdir -p ' },
      { id: 'file6', label: 'find .', value: 'find . -name ' },
      { id: 'file7', label: 'tar -czvf', value: 'tar -czvf ' },
      { id: 'file8', label: 'unzip', value: 'unzip ' },
    ],
    TXT: [
      { id: 'txt1', label: 'grep -rnw', value: 'grep -rnw . -e "' },
      { id: 'txt2', label: 'find name', value: 'find . -type f -name "' },
      { id: 'txt3', label: 'tail -f', value: 'tail -f ' },
      { id: 'txt4', label: 'watch', value: 'watch -n 2 ' },
      { id: 'txt5', label: 'cat', value: 'cat ' },
      { id: 'txt6', label: 'head', value: 'head -n 20 ' },
      { id: 'txt7', label: 'nano', value: 'nano ' },
    ],
    APT: [
      { id: 'apt1', label: 'upgrade -y', value: 'sudo apt update && sudo apt upgrade -y\n' },
      { id: 'apt2', label: 'apt update', value: 'sudo apt update\n' },
      { id: 'apt3', label: 'apt search', value: 'sudo apt search ' },
      { id: 'apt4', label: 'apt install', value: 'sudo apt install ' },
      { id: 'apt5', label: 'apt purge', value: 'sudo apt purge ' },
      { id: 'apt6', label: 'autoremove', value: 'sudo apt autoremove -y\n' },
      { id: 'apt7', label: 'apt clean', value: 'sudo apt clean\n' },
      { id: 'apt8', label: 'dpkg -l', value: 'dpkg -l\n' },
    ],
    PAC: [
      { id: 'pac1', label: 'upgrade -y', value: 'sudo pacman -Syu\n' },
      { id: 'pac2', label: 'pacman install', value: 'sudo pacman -S ' },
      { id: 'pac3', label: 'pacman search', value: 'pacman -Ss ' },
      { id: 'pac4', label: 'pacman remove', value: 'sudo pacman -Rns ' },
      { id: 'pac5', label: 'pacman clean', value: 'sudo pacman -Sc\n' },
      { id: 'pac6', label: 'pacman list', value: 'pacman -Qe\n' },
    ],
    YUM: [
      { id: 'yum1', label: 'upgrade -y', value: 'sudo dnf upgrade --refresh -y\n' },
      { id: 'yum2', label: 'dnf update', value: 'sudo dnf update\n' },
      { id: 'yum3', label: 'dnf install', value: 'sudo dnf install ' },
      { id: 'yum4', label: 'dnf search', value: 'dnf search ' },
      { id: 'yum5', label: 'dnf remove', value: 'sudo dnf remove ' },
      { id: 'yum6', label: 'autoremove', value: 'sudo dnf autoremove\n' },
      { id: 'yum7', label: 'dnf clean', value: 'sudo dnf clean all\n' },
    ],
    DOC: [
      { id: 'doc1', label: 'docker ps', value: 'docker ps\n' },
      { id: 'doc2', label: 'docker ps -a', value: 'docker ps -a\n' },
      { id: 'doc3', label: 'compose up', value: 'docker compose up -d\n' },
      { id: 'doc4', label: 'compose down', value: 'docker compose down\n' },
      { id: 'doc5', label: 'compose logs', value: 'docker compose logs -f\n' },
      { id: 'doc6', label: 'docker exec', value: 'docker exec -it ' },
      { id: 'doc7', label: 'prune -f', value: 'docker system prune -f\n' },
      { id: 'doc8', label: 'docker images', value: 'docker images\n' },
    ],
    GIT: [
      { id: 'git1', label: 'git status', value: 'git status\n' },
      { id: 'git2', label: 'git log -10', value: 'git log --oneline -n 10\n' },
      { id: 'git3', label: 'git add .', value: 'git add .\n' },
      { id: 'git4', label: 'git commit', value: 'git commit -m "' },
      { id: 'git5', label: 'git push', value: 'git push\n' },
      { id: 'git6', label: 'git pull', value: 'git pull\n' },
      { id: 'git7', label: 'git checkout', value: 'git checkout -b ' },
      { id: 'git8', label: 'git diff', value: 'git diff\n' },
    ],
    SYS: [
      { id: 'sys1', label: 'systemctl', value: 'sudo systemctl status ' },
      { id: 'sys2', label: 'restart srv', value: 'sudo systemctl restart ' },
      { id: 'sys3', label: 'journalctl', value: 'sudo journalctl -xeu ' },
      { id: 'sys4', label: 'htop', value: 'htop\n' },
      { id: 'sys5', label: 'df -h', value: 'df -h\n' },
      { id: 'sys6', label: 'free -h', value: 'free -h\n' },
      { id: 'sys7', label: 'top', value: 'top\n' },
      { id: 'sys8', label: 'uptime', value: 'uptime\n' },
    ],
    NET: [
      { id: 'net1', label: 'ip a', value: 'ip a\n' },
      { id: 'net2', label: 'ping', value: 'ping -c 4 ' },
      { id: 'net3', label: 'netstat', value: 'sudo netstat -tuln\n' },
      { id: 'net4', label: 'ss -tulpn', value: 'sudo ss -tulpn\n' },
      { id: 'net5', label: 'ufw status', value: 'sudo ufw status\n' },
      { id: 'net6', label: 'curl -I', value: 'curl -I ' },
      { id: 'net7', label: 'dig', value: 'dig ' },
      { id: 'net8', label: 'traceroute', value: 'traceroute ' },
    ],
    PY: [
      { id: 'py1', label: 'python3', value: 'python3 ' },
      { id: 'py2', label: 'pip install', value: 'pip install ' },
      { id: 'py3', label: 'venv create', value: 'python3 -m venv venv\n' },
      { id: 'py4', label: 'venv activate', value: 'source venv/bin/activate\n' },
      { id: 'py5', label: 'pip list', value: 'pip list\n' },
      { id: 'py6', label: 'pip freeze', value: 'pip freeze > requirements.txt\n' },
      { id: 'py7', label: 'python3 REPL', value: 'python3\n' },
      { id: 'py8', label: 'exit', value: 'exit()\n' },
      { id: 'py9', label: '^D', value: '\x04' },
    ],
    NPM: [
      { id: 'npm1', label: 'npm install', value: 'npm install\n' },
      { id: 'npm2', label: 'npm run dev', value: 'npm run dev\n' },
      { id: 'npm3', label: 'npm run build', value: 'npm run build\n' },
      { id: 'npm4', label: 'npx', value: 'npx ' },
      { id: 'npm5', label: 'yarn add', value: 'yarn add ' },
      { id: 'npm6', label: 'node -v', value: 'node -v\n' },
    ],
    TMX: [
      { id: 'tmx1', label: 'tmux ls', value: 'tmux ls\n' },
      { id: 'tmx2', label: 'tmux new', value: 'tmux new-session -s ' },
      { id: 'tmx3', label: 'tmux attach', value: 'tmux attach -t ' },
      { id: 'tmx4', label: 'tmux kill', value: 'tmux kill-session -t ' },
      { id: 'tmx5', label: 'split h', value: '\x02%' },
      { id: 'tmx6', label: 'split v', value: '\x02"' },
    ],
    KEY_NAV: [
      { id: 'nav1', label: '▲', value: '\x1b[A', width: 2.4, height: 2.0, shape: 'rounded', bg: 'var(--bg-canopy)', text: 'var(--text-parchment)', border: 'var(--border-sage)' },
      { id: 'nav2', label: '▼', value: '\x1b[B', width: 2.4, height: 2.0, shape: 'rounded', bg: 'var(--bg-canopy)', text: 'var(--text-parchment)', border: 'var(--border-sage)' },
      { id: 'nav3', label: '◀', value: '\x1b[D', width: 2.4, height: 2.0, shape: 'rounded', bg: 'var(--bg-canopy)', text: 'var(--text-parchment)', border: 'var(--border-sage)' },
      { id: 'nav4', label: '▶', value: '\x1b[C', width: 2.4, height: 2.0, shape: 'rounded', bg: 'var(--bg-canopy)', text: 'var(--text-parchment)', border: 'var(--border-sage)' },
      { id: 'nav5', label: 'PgUp', value: '\x1b[5~' },
      { id: 'nav6', label: 'PgDn', value: '\x1b[6~' },
      { id: 'nav7', label: 'Home', value: '\x1b[H' },
      { id: 'nav8', label: 'End', value: '\x1b[F' },
      { id: 'nav9', label: 'Ctrl+Left', value: '\x1b[1;5D' },
      { id: 'nav10', label: 'Ctrl+Right', value: '\x1b[1;5C' },
      { id: 'nav11', label: 'Shift+Tab', value: '\x1b[Z' },
      { id: 'nav12', label: 'Backspace', value: '\x7f' },
      { id: 'nav13', label: 'Enter', value: '\r' },
    ],
    KEY_FN: [
      { id: 'fn1', label: 'F1', value: '\x1bOP' },
      { id: 'fn2', label: 'F2', value: '\x1bOQ' },
      { id: 'fn3', label: 'F3', value: '\x1bOR' },
      { id: 'fn4', label: 'F4', value: '\x1bOS' },
      { id: 'fn5', label: 'F5', value: '\x1b[15~' },
      { id: 'fn6', label: 'F6', value: '\x1b[17~' },
      { id: 'fn7', label: 'F7', value: '\x1b[18~' },
      { id: 'fn8', label: 'F8', value: '\x1b[19~' },
      { id: 'fn9', label: 'F9', value: '\x1b[20~' },
      { id: 'fn10', label: 'F10', value: '\x1b[21~' },
      { id: 'fn11', label: 'F11', value: '\x1b[23~' },
      { id: 'fn12', label: 'F12', value: '\x1b[24~' },
    ],
    KEY_SYM: [
      { id: 'sym1', label: '|', value: '|' },
      { id: 'sym2', label: '~', value: '~' },
      { id: 'sym3', label: '>', value: '>' },
      { id: 'sym4', label: '>>', value: '>>' },
      { id: 'sym5', label: '<', value: '<' },
      { id: 'sym6', label: '&&', value: '&& ' },
      { id: 'sym7', label: '||', value: '|| ' },
      { id: 'sym8', label: ';', value: '; ' },
      { id: 'sym9', label: '`', value: '`' },
      { id: 'sym10', label: '\\', value: '\\' },
      { id: 'sym11', label: '/', value: '/' },
      { id: 'sym12', label: '$', value: '$' },
      { id: 'sym13', label: '#', value: '#' },
    ],
    KEY_MODE: [
      { id: 'mode1', label: 'ESC', value: '\x1b' },
      { id: 'mode2', label: 'TAB', value: '\t' },
      { id: 'mode3', label: 'DEL', value: '\x1b[3~' },
      { id: 'mode4', label: '^C (cancel)', value: '\x03' },
      { id: 'mode5', label: '^Z (suspend)', value: '\x1a' },
      { id: 'mode6', label: '^D (exit)', value: '\x04' },
    ],
    KEY_LINE: [
      { id: 'line1', label: '^A (Home)', value: '\x01' },
      { id: 'line2', label: '^E (End)', value: '\x05' },
      { id: 'line3', label: '^K (Cut end)', value: '\x0b' },
      { id: 'line4', label: '^U (Cut start)', value: '\x15' },
      { id: 'line5', label: '^W (Del word)', value: '\x17' },
      { id: 'line6', label: '^Y (Paste)', value: '\x19' },
      { id: 'line7', label: '^R (History)', value: '\x12' },
      { id: 'line8', label: '^L (Clear)', value: '\x0c' },
    ]
  };

  // --- A3: Label-to-value resolver ---
  // Resolution order: sovereign_buttons (custom) → commandSuites → PREBUILT_CATEGORIES → fallback
  const resolveLabel = (label, id) => {
    // 1. Check custom buttons first (so customized built-ins override defaults)
    try {
      const raw = localStorage.getItem('sovereign_buttons');
      if (raw) {
        const btns = JSON.parse(raw);
        const found = btns.find(b => b.label === label);
        if (found) return {
          id: id || found.id || `res-${label}`,
          label: found.label || label,
          value: found.value || `${label}\n`,
          bg: found.bg || null,
          text: found.text || null,
          border: found.border || null,
          width: found.width || null,
          height: found.height || null,
          shape: found.shape || null,
        };
      }
    } catch {}

    // 2. Check built-in command suites
    for (const suite of Object.values(commandSuites)) {
      const found = suite.find(btn => btn.label === label);
      if (found) return { id: id || found.id, label: found.label, value: found.value };
    }

    // 3. Check prebuilt categories
    for (const cat of Object.values(PREBUILT_CATEGORIES)) {
      const found = (cat.items || []).find(item => item.label === label);
      if (found) return { id: id || `res-${label}`, label: found.label, value: found.value };
    }

    // 4. Fallback
    return { id: id || `res-${label}`, label, value: `${label}\n` };
  };

  // --- A1 + A2: Suite data loader ---
  const loadSuiteData = () => {
    // A1: Load persisted overrides for each built-in suite
    const overrides = {};
    Object.keys(commandSuites).forEach(suiteKey => {
      try {
        const raw = localStorage.getItem(`sovereign_macro_suite_${suiteKey}`);
        if (raw) {
          const labels = JSON.parse(raw);
          if (Array.isArray(labels) && labels.length > 0) {
            overrides[suiteKey] = labels.map((lbl, idx) =>
              resolveLabel(lbl, `${suiteKey}-ov-${idx}`)
            );
          }
        }
      } catch {}
    });
    setSuiteOverrides(overrides);

    // A2: Load custom macro suites (sovereign_buttons entries where value === 'macro')
    try {
      const raw = localStorage.getItem('sovereign_buttons');
      const btns = raw ? JSON.parse(raw) : [];

      // Build style lookup map for all custom button visual properties
      const styleMap = {};
      btns.forEach(b => {
        const key = b.label || b.name || b.id;
        if (key) styleMap[key] = { bg: b.bg, text: b.text, border: b.border, width: b.width, height: b.height, shape: b.shape };
      });
      setCustomButtonStyles(styleMap);

      const macroNames = [...new Set(
        btns
          .filter(b => b && b.value && b.value.trim().toLowerCase() === 'macro')
          .map(b => b.label || b.name || b.id)
          .filter(Boolean)
      )];
      setCustomMacroSuites(macroNames);

      const custData = {};
      macroNames.forEach(name => {
        try {
          const suiteRaw = localStorage.getItem(`sovereign_macro_suite_${name}`);
          if (suiteRaw) {
            const labels = JSON.parse(suiteRaw);
            if (Array.isArray(labels)) {
              custData[name] = labels.map((lbl, idx) => ({
                ...resolveLabel(lbl, `cust-${name}-${idx}`),
                isSuiteLauncher: Object.keys(commandSuites).includes(lbl) || macroNames.includes(lbl),
              }));
            }
          }
        } catch {}
      });
      setCustomSuiteData(custData);
    } catch {
      setCustomMacroSuites([]);
      setCustomSuiteData({});
    }
  };

  // Load on mount and reload on any storage change
  useEffect(() => {
    loadSuiteData();
    window.addEventListener('storage', loadSuiteData);
    window.addEventListener('sovereign_custom_buttons_updated', loadSuiteData);
    return () => {
      window.removeEventListener('storage', loadSuiteData);
      window.removeEventListener('sovereign_custom_buttons_updated', loadSuiteData);
    };
  }, []);

  // CUST group prepended when custom suites exist; resolved active button array
  const effectiveGroups = customMacroSuites.length > 0
    ? { CUST: { label: 'CUST', suites: customMacroSuites }, ...GROUPS }
    : GROUPS;

  const activeSuiteButtons =
    suiteOverrides[selectedSuite] ||
    customSuiteData[selectedSuite] ||
    (commandSuites[selectedSuite] ? commandSuites[selectedSuite].map((b, i) => resolveLabel(b.label, `cmd-${selectedSuite}-${i}`)) : []);

  // Focused suite modal derived values (computed before return, used in JSX)
  const focusedActiveDisplay = focusedSubSuite || focusedSuiteName;
  const focusedDisplayButtons = focusedSuiteName ? (
    suiteOverrides[focusedActiveDisplay] ||
    customSuiteData[focusedActiveDisplay] ||
    (commandSuites[focusedActiveDisplay] ? commandSuites[focusedActiveDisplay].map((b, i) => resolveLabel(b.label, `cmd-${focusedActiveDisplay}-${i}`)) : [])
  ) : [];
  const focusedChips = focusedDisplayButtons.filter(b =>
    (b.isSuiteLauncher || customMacroSuites.includes(b.label) || Object.keys(commandSuites).includes(b.label)) && b.label !== focusedSuiteName
  );
  const focusedRegularButtons = focusedDisplayButtons.filter(b =>
    !(b.isSuiteLauncher || customMacroSuites.includes(b.label) || Object.keys(commandSuites).includes(b.label))
  );

  // Opens MACROS modal: defaults to first custom suite when CUST exists, else AGY
  const openMacrosModal = () => {
    if (customMacroSuites.length > 0) {
      setPrimaryGroup('CUST');
      setSelectedSuite(customMacroSuites[0]);
    } else {
      setPrimaryGroup('AI');
      setSelectedSuite('AGY');
    }
    setShowMacroModal(true);
  };

  // Gboard / Android-Style Continuous Voice Dictation Handler
  const toggleVoice = () => {
    if (isRecordingRef.current) {
      // User explicitly tapped mic button to turn OFF
      isRecordingRef.current = false;
      setIsRecording(false);
      lastSpeechRef.current = '';
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showMicToast('Voice dictation not supported in this browser.');
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    lastSpeechRef.current = '';

    const startListeningSession = () => {
      if (!isRecordingRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // continuous=false is significantly more stable on mobile & Chrome
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }

          if (currentTranscript) {
            setStagerText(currentTranscript);
            setShowStager(true);
          }
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition status:', e.error);
          // Do NOT stop recording on 'no-speech' or 'aborted' — ignore silence timeouts so mic stays ON
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            isRecordingRef.current = false;
            setIsRecording(false);
            showMicToast('Mic access denied — HTTPS or localhost required.');
          } else if (e.error === 'network') {
            isRecordingRef.current = false;
            setIsRecording(false);
            showMicToast('Voice recognition requires a network connection.');
          }
        };

        recognition.onend = () => {
          // Gboard mode: If user hasn't explicitly tapped mic OFF, automatically loop-restart!
          if (isRecordingRef.current) {
            lastSpeechRef.current = ''; // reset buffer for next spoken phrase
            setTimeout(() => {
              if (isRecordingRef.current) {
                startListeningSession();
              }
            }, 100);
          } else {
            setIsRecording(false);
            lastSpeechRef.current = '';
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.error('Failed to start speech recognition session:', err);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    startListeningSession();
  };

  const handleSudoMacro = () => {
    const savedSudo = sessionStorage.getItem('sovereign_sudo_password');
    if (savedSudo && onKeyPress) {
      onKeyPress(`${savedSudo}\n`);
    }
  };

  return (
    <>
      {/* TouchBar-Anchored Decoupled Command & Dictation Staging Drawer */}
      <StagingDrawer
        isOpen={showStager}
        onClose={() => setShowStager(false)}
        initialText={stagerText}
        onSend={(payload) => {
          if (onKeyPress) onKeyPress(payload);
          setStagerText('');
        }}
      />

      {/* Perimeter Touch Row */}
      <div className="touch-bar" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
        <button
          className={`touch-btn voice-btn ${isRecording ? 'recording' : ''}`}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setShowStager(true);
            toggleVoice();
          }}
          title="Gboard Voice Dictation"
        >
          {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        <button
          className="touch-btn stager-launcher-btn"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowStager((prev) => !prev)}
          title="Open Command Staging Drawer"
          style={{ borderColor: 'var(--accent-violet)', color: 'var(--accent-violet)' }}
        >
          <Edit3 size={15} />
        </button>

        {sessionStorage.getItem('sovereign_sudo_password') && (
          <button className="touch-btn sudo-btn" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={handleSudoMacro} title="Quick Sudo Password Entry">
            <KeyRound size={14} />
            <span>(***)</span>
          </button>
        )}

        {/* Dynamic User-Customized TouchBar Items from LayoutBuilder */}
        {activeSlots.map((item, idx) => {
          const isCategoryLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

          if (isCategoryLauncher) {
            return (
              <button
                key={`slot-${item}-${idx}`}
                className="touch-btn suite-chip-btn"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelectedSuite(item);
                  setShowMacroModal(true);
                }}
                title={`${item} Suite`}
              >
                {item}
              </button>
            );
          }

          // Command Payload Resolver (supports special keys, custom buttons, & raw commands)
          const getCommandPayload = (itemKey) => {
            const keyMappings = {
              'ESC': '\x1b',
              'TAB': '\t',
              'DEL': '\x1b[3~',
              '^C': '\x03',
              '^Z': '\x1a',
              '-': '-',
              '|': '|',
              '~': '~',
              '/': '/',
              'sudo': 'sudo ',
              'exit': 'exit\n',
              'ArrowUp': '\x1b[A',
              'ArrowDown': '\x1b[B',
              'ArrowLeft': '\x1b[D',
              'ArrowRight': '\x1b[C',
              '▲ Up': '\x1b[A',
              '▼ Down': '\x1b[B',
              '◀ Left': '\x1b[D',
              '► Right': '\x1b[C',
              '▶ Right': '\x1b[C',
              '▲': '\x1b[A',
              '▼': '\x1b[B',
              '◀': '\x1b[D',
              '►': '\x1b[C',
              '▶': '\x1b[C',
              'PgUp': '\x1b[5~',
              'PgDn': '\x1b[6~',
              'Home': '\x1b[H',
              'End': '\x1b[F',
              'Ctrl+Left': '\x1b[1;5D',
              'Ctrl+Right': '\x1b[1;5C',
              'Shift+Tab': '\x1b[Z',
              'Backspace': '\x7f',
              'Enter': '\r',
              'F1': '\x1bOP', 'F2': '\x1bOQ', 'F3': '\x1bOR', 'F4': '\x1bOS',
              'F5': '\x1b[15~', 'F6': '\x1b[17~', 'F7': '\x1b[18~', 'F8': '\x1b[19~',
              'F9': '\x1b[20~', 'F10': '\x1b[21~', 'F11': '\x1b[23~', 'F12': '\x1b[24~'
            };
            if (keyMappings[itemKey]) return keyMappings[itemKey];

            // Unicode arrow character fallback (thin arrows ← → ↓ ↑ and bold triangles ◀ ▶ ▼ ▲)
            const unicodeArrows = {
              '\u2190': '\x1b[D', '\u2192': '\x1b[C', '\u2193': '\x1b[B', '\u2191': '\x1b[A',
              '\u25c0': '\x1b[D', '\u25b6': '\x1b[C', '\u25bc': '\x1b[B', '\u25b2': '\x1b[A'
            };
            if (unicodeArrows[itemKey]) return unicodeArrows[itemKey];

            try {
              const saved = localStorage.getItem('sovereign_buttons');
              if (saved) {
                const btns = JSON.parse(saved);
                const match = btns.find(b => (b.label || b.name) === itemKey);
                if (match && match.value) return match.value;
              }
            } catch {}

            if (item.toLowerCase().includes('sudo')) {
              const savedSudo = sessionStorage.getItem('sovereign_sudo_password');
              if (!savedSudo) return null;
              return `${savedSudo}\n`;
            }

            return itemKey.endsWith('\n') ? itemKey : `${itemKey}\n`;
          };

          if (item.toLowerCase().includes('sudo') && !sessionStorage.getItem('sovereign_sudo_password')) {
            return null;
          }

          if (item === '⚡ MACROS' || item === 'MACROS') {
            return (
              <button
                key={`slot-${item}-${idx}`}
                className="touch-btn macro-launcher-btn"
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={openMacrosModal}
                title="Macro Master Catalog"
              >
                <Zap size={14} color="var(--status-danger)" />
                <span>MACROS</span>
              </button>
            );
          }

          if (customMacroSuites.includes(item)) {
            const btnStyle = customButtonStyles[item] || {};
            return (
              <button
                key={`slot-${item}-${idx}`}
                className={`touch-btn ${btnStyle.shape || ''}`}
                style={{
                  background: btnStyle.bg || undefined,
                  color: btnStyle.text || undefined,
                  borderColor: btnStyle.border || undefined,
                  width: btnStyle.width ? `${btnStyle.width}rem` : undefined,
                  height: btnStyle.height ? `${btnStyle.height}rem` : undefined,
                }}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setFocusedSuiteName(item);
                  setFocusedSubSuite(null);
                  setShowFocusedSuiteModal(true);
                }}
                title={`Open ${item} suite`}
              >
                {item}
              </button>
            );
          }

          const btnStyle = customButtonStyles[item] || {};
          return (
            <button
              key={`slot-${item}-${idx}`}
              className={`touch-btn ${btnStyle.shape || ''}`}
              style={{
                background: btnStyle.bg || undefined,
                color: btnStyle.text || undefined,
                borderColor: btnStyle.border || undefined,
                width: btnStyle.width ? `${btnStyle.width}rem` : undefined,
                height: btnStyle.height ? `${btnStyle.height}rem` : undefined,
              }}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onKeyPress(getCommandPayload(item))}
            >
              {item}
            </button>
          );
        })}

        {/* Master MACROS Catalog Launcher Pinned to Far Right (Bright Red) */}
        <button
          className="touch-btn macro-launcher-btn"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openMacrosModal}
          title="Master Macro Catalog"
        >
          <Zap size={14} color="var(--status-danger)" />
          <span>MACROS</span>
        </button>

        <button 
          className="touch-btn clear-btn" 
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onKeyPress('clear\n')} 
          title="Clear Terminal Screen"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Command Suite Modal with Categorized Sub-Tabs */}
      {showMacroModal && (
        <div className="macro-modal-overlay" onClick={() => setShowMacroModal(false)}>
          <div className="macro-modal-content" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}>
            <div className="macro-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={16} color="var(--status-active)" />
                <h3>{selectedSuite.replace('KEY_', '')} TOOLKIT</h3>
              </div>
              <button className="close-modal-btn" onClick={() => setShowMacroModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Primary Category Group Selector Bar */}
            <div className="suite-selector-scroll">
              {Object.keys(effectiveGroups).map((groupKey) => {
                const isActive = primaryGroup === groupKey;
                return (
                  <button
                    key={groupKey}
                    type="button"
                    className={`suite-tab-pill ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setPrimaryGroup(groupKey);
                      const defaultSub = effectiveGroups[groupKey].suites[0];
                      setSelectedSuite(defaultSub);
                    }}
                  >
                    {effectiveGroups[groupKey].label}
                  </button>
                );
              })}
            </div>

            {/* Sub-Suite Selector Bar for Active Group */}
            {effectiveGroups[primaryGroup] && (
              <div className="sub-suite-bar">
                {effectiveGroups[primaryGroup].suites.map((subKey) => {
                  const isSubActive = selectedSuite === subKey;
                  return (
                    <button
                      key={subKey}
                      type="button"
                      className={`sub-suite-pill ${isSubActive ? 'active' : ''}`}
                      onClick={() => setSelectedSuite(subKey)}
                    >
                      {SUB_LABELS[subKey] || subKey}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Suite Macro Grid */}
            <div className="macro-grid-3x4" style={{ marginTop: '0.75rem' }}>
              {activeSuiteButtons.map((macro) => {
                const isLauncher = macro.isSuiteLauncher || customMacroSuites.includes(macro.label) || Object.keys(commandSuites).includes(macro.label);

                return (
                  <button
                    key={macro.id}
                    className={`macro-grid-btn ${macro.shape || ''} ${isLauncher ? 'suite-launcher-grid-btn' : ''}`}
                    style={macro.bg || macro.text || macro.border || macro.width || macro.height ? {
                      background: macro.bg || undefined,
                      color: macro.text || undefined,
                      borderColor: macro.border || undefined,
                      width: macro.width ? `${macro.width}rem` : undefined,
                      height: macro.height ? `${macro.height}rem` : undefined,
                    } : {}}
                    onClick={() => {
                      if (isLauncher) {
                        const targetGroup = Object.keys(effectiveGroups).find(g =>
                          effectiveGroups[g].suites.includes(macro.label)
                        ) || 'AI';
                        setPrimaryGroup(targetGroup);
                        setSelectedSuite(macro.label);
                      } else {
                        onKeyPress(macro.value);
                        setShowMacroModal(false);
                      }
                    }}
                  >
                    {macro.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Focused Suite Modal — opens when a custom suite bar button is tapped */}
      {showFocusedSuiteModal && (
        <div className="macro-modal-overlay" onClick={() => setShowFocusedSuiteModal(false)}>
          <div
            className="macro-modal-content"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="macro-modal-header">
              <button
                className="focused-suite-title-reset"
                onClick={() => setFocusedSubSuite(null)}
                title="Tap to return to root suite view"
              >
                <h3>{focusedSuiteName}</h3>
              </button>
              <button className="close-modal-btn" onClick={() => setShowFocusedSuiteModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Chip tabs for nested macro suites (self-filtered: root suite never shows in its own chips) */}
            {focusedChips.length > 0 && (
              <div className="sub-suite-bar">
                {focusedChips.map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`sub-suite-pill ${focusedSubSuite === chip.label ? 'active' : ''}`}
                    onClick={() => setFocusedSubSuite(chip.label)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {/* Command button grid */}
            <div className="macro-grid-3x4" style={{ marginTop: '0.75rem' }}>
              {focusedRegularButtons.length === 0 && focusedChips.length === 0 ? (
                <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', padding: '0.5rem', gridColumn: '1 / -1' }}>
                  No buttons in this suite yet. Add some in the Layout tab.
                </span>
              ) : (
                focusedRegularButtons.map(macro => (
                  <button
                    key={macro.id}
                    className={`macro-grid-btn ${macro.shape || ''}`}
                    style={macro.bg || macro.text || macro.border || macro.width || macro.height ? {
                      background: macro.bg || undefined,
                      color: macro.text || undefined,
                      borderColor: macro.border || undefined,
                      width: macro.width ? `${macro.width}rem` : undefined,
                      height: macro.height ? `${macro.height}rem` : undefined,
                    } : {}}
                    onClick={() => {
                      onKeyPress(macro.value);
                      setShowFocusedSuiteModal(false);
                    }}
                  >
                    {macro.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mic error toast — non-blocking replacement for alert() */}
      {micToast && (
        <div className="copy-toast" style={{ bottom: '4.5rem', top: 'auto' }}>
          <span>{micToast}</span>
        </div>
      )}
    </>
  );
}
