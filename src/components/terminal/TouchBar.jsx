import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, KeyRound, Trash2, Zap, X, Edit3, Terminal } from 'lucide-react';
import StagingDrawer from './StagingDrawer';
import { 
  PREBUILT_CATEGORIES,
  KEY_NAV_PRESETS,
  KEY_FN_PRESETS,
  KEY_SYM_PRESETS,
  KEY_MODE_PRESETS,
  KEY_LINE_PRESETS
} from '../settings/button-studio/buttonData';

const KEY_MAPPINGS = {
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

const UNICODE_ARROWS = {
  '\u2190': '\x1b[D', '\u2192': '\x1b[C', '\u2193': '\x1b[B', '\u2191': '\x1b[A',
  '\u25c0': '\x1b[D', '\u25b6': '\x1b[C', '\u25bc': '\x1b[B', '\u25b2': '\x1b[A'
};

export default function TouchBar({ onKeyPress }) {
  const [isRecording, setIsRecording] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [showStager, setShowStager] = useState(false);
  const [stagerText, setStagerText] = useState('');

  const [macroTarget, setMacroTarget] = useState(() => {
    try {
      return localStorage.getItem('sovereign_macro_target') || 'stager';
    } catch {
      return 'stager';
    }
  });

  const handleMacroTargetToggle = (target) => {
    setMacroTarget(target);
    try {
      localStorage.setItem('sovereign_macro_target', target);
    } catch {}
  };
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef(null);
  const micToastTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Speech recognition cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if (micToastTimerRef.current) {
        clearTimeout(micToastTimerRef.current);
      }
    };
  }, []);

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
  const [customButtons, setCustomButtons] = useState([]);
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
    if (!isMountedRef.current) return;
    setMicToast(msg);
    if (micToastTimerRef.current) clearTimeout(micToastTimerRef.current);
    micToastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setMicToast(null);
    }, 4000);
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
    // 0-indexed suites
    AGY: PREBUILT_CATEGORIES.AGY.items.map((item, idx) => ({ id: `agy${idx}`, ...item })),
    CLD: PREBUILT_CATEGORIES.CLD.items.map((item, idx) => ({ id: `cld${idx}`, ...item })),
    HMS: PREBUILT_CATEGORIES.HMS.items.map((item, idx) => ({ id: `hms${idx}`, ...item })),
    
    // 1-indexed suites
    VIM: PREBUILT_CATEGORIES.VIM.items.map((item, idx) => ({ id: `vim${idx + 1}`, ...item })),
    FILE: PREBUILT_CATEGORIES.FILE.items.map((item, idx) => ({ id: `file${idx + 1}`, ...item })),
    TXT: PREBUILT_CATEGORIES.TXT.items.map((item, idx) => ({ id: `txt${idx + 1}`, ...item })),
    APT: PREBUILT_CATEGORIES.APT.items.map((item, idx) => ({ id: `apt${idx + 1}`, ...item })),
    PAC: PREBUILT_CATEGORIES.PAC.items.map((item, idx) => ({ id: `pac${idx + 1}`, ...item })),
    YUM: PREBUILT_CATEGORIES.YUM.items.map((item, idx) => ({ id: `yum${idx + 1}`, ...item })),
    DOC: PREBUILT_CATEGORIES.DOC.items.map((item, idx) => ({ id: `doc${idx + 1}`, ...item })),
    GIT: PREBUILT_CATEGORIES.GIT.items.map((item, idx) => ({ id: `git${idx + 1}`, ...item })),
    SYS: PREBUILT_CATEGORIES.SYS.items.map((item, idx) => ({ id: `sys${idx + 1}`, ...item })),
    NET: PREBUILT_CATEGORIES.NET.items.map((item, idx) => ({ id: `net${idx + 1}`, ...item })),
    PY: PREBUILT_CATEGORIES.PY.items.map((item, idx) => ({ id: `py${idx + 1}`, ...item })),
    NPM: PREBUILT_CATEGORIES.NPM.items.map((item, idx) => ({ id: `npm${idx + 1}`, ...item })),
    TMX: PREBUILT_CATEGORIES.TMX.items.map((item, idx) => ({ id: `tmx${idx + 1}`, ...item })),
    
    // Imported keyboard shortcuts
    KEY_NAV: KEY_NAV_PRESETS,
    KEY_FN: KEY_FN_PRESETS,
    KEY_SYM: KEY_SYM_PRESETS,
    KEY_MODE: KEY_MODE_PRESETS,
    KEY_LINE: KEY_LINE_PRESETS
  };

  // --- A3: Label-to-value resolver ---
  // Resolution order: sovereign_buttons (custom) → commandSuites → PREBUILT_CATEGORIES → fallback
  const resolveLabel = (label, id, customButtonsOverride) => {
    const btns = customButtonsOverride || customButtons;
    // 1. Check custom buttons first (so customized built-ins override defaults)
    if (btns && btns.length > 0) {
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

    // 2. Check built-in command suites
    for (const suite of Object.values(commandSuites)) {
      const found = suite.find(btn => btn.label === label);
      if (found) {
        return {
          bg: null, text: null, border: null, width: null, height: null, shape: null,
          ...found,
          id: id || found.id
        };
      }
    }

    // 3. Check prebuilt categories
    for (const cat of Object.values(PREBUILT_CATEGORIES)) {
      const found = (cat.items || []).find(item => item.label === label);
      if (found) {
        return {
          bg: null, text: null, border: null, width: null, height: null, shape: null,
          ...found,
          id: id || `res-${label}`
        };
      }
    }

    // 4. Fallback
    return { id: id || `res-${label}`, label, value: `${label}\n` };
  };

  // --- A1 + A2: Suite data loader ---
  const loadSuiteData = () => {
    let btns = [];
    try {
      const raw = localStorage.getItem('sovereign_buttons');
      btns = raw ? JSON.parse(raw) : [];
      setCustomButtons(btns);
    } catch {
      setCustomButtons([]);
    }

    // A1: Load persisted overrides for each built-in suite
    const overrides = {};
    Object.keys(commandSuites).forEach(suiteKey => {
      try {
        const raw = localStorage.getItem(`sovereign_macro_suite_${suiteKey}`);
        if (raw) {
          const labels = JSON.parse(raw);
          if (Array.isArray(labels) && labels.length > 0) {
            overrides[suiteKey] = labels.map((lbl, idx) =>
              resolveLabel(lbl, `${suiteKey}-ov-${idx}`, btns)
            );
          }
        }
      } catch {}
    });
    setSuiteOverrides(overrides);

    // A2: Load custom macro suites (sovereign_buttons entries where value === 'macro')
    try {
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
                ...resolveLabel(lbl, `cust-${name}-${idx}`, btns),
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
      if (isMountedRef.current) setIsRecording(false);
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
    if (isMountedRef.current) setIsRecording(true);

    const startListeningSession = () => {
      if (!isRecordingRef.current || !isMountedRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // continuous=false is significantly more stable on mobile & Chrome
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          if (!isMountedRef.current) return;
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
            if (isMountedRef.current) setIsRecording(false);
            showMicToast('Mic access denied — HTTPS or localhost required.');
          } else if (e.error === 'network') {
            isRecordingRef.current = false;
            if (isMountedRef.current) setIsRecording(false);
            showMicToast('Voice recognition requires a network connection.');
          }
        };

        recognition.onend = () => {
          if (!isMountedRef.current) return;
          // Gboard mode: If user hasn't explicitly tapped mic OFF, automatically loop-restart!
          if (isRecordingRef.current) {
            setTimeout(() => {
              if (isRecordingRef.current && isMountedRef.current) {
                startListeningSession();
              }
            }, 100);
          } else {
            if (isMountedRef.current) setIsRecording(false);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.error('Failed to start speech recognition session:', err);
        isRecordingRef.current = false;
        if (isMountedRef.current) setIsRecording(false);
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

  // Command Payload Resolver (supports special keys, custom buttons, & raw commands)
  const getCommandPayload = useCallback((itemKey) => {
    if (KEY_MAPPINGS[itemKey]) return KEY_MAPPINGS[itemKey];
    if (UNICODE_ARROWS[itemKey]) return UNICODE_ARROWS[itemKey];

    const match = customButtons.find(b => (b.label || b.name) === itemKey);
    if (match && match.value) return match.value;

    if (itemKey.toLowerCase().includes('sudo')) {
      const savedSudo = sessionStorage.getItem('sovereign_sudo_password');
      if (!savedSudo) return null;
      return `${savedSudo}\n`;
    }

    return itemKey.endsWith('\n') ? itemKey : `${itemKey}\n`;
  }, [customButtons]);

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

          if (item.toLowerCase().includes('sudo') && !sessionStorage.getItem('sovereign_sudo_password')) {
            return null;
          }

          if (item === 'MACROS') {
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
        <div
          className="macro-modal-overlay"
          onTouchStart={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowMacroModal(false)}
        >
          <div
            className="macro-modal-content"
            onTouchStart={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="macro-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={16} color="var(--status-active)" />
                <h3>{selectedSuite.replace('KEY_', '')} TOOLKIT</h3>
              </div>

              <div className="macro-target-toggle">
                <button
                  type="button"
                  className={`target-pill ${macroTarget === 'stager' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMacroTargetToggle('stager');
                  }}
                  title="Route macro selection to Command Stager"
                >
                  <Edit3 size={11} />
                  <span>STAGER</span>
                </button>
                <button
                  type="button"
                  className={`target-pill ${macroTarget === 'terminal' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMacroTargetToggle('terminal');
                  }}
                  title="Route macro selection directly to Terminal PTY"
                >
                  <Terminal size={11} />
                  <span>PTY</span>
                </button>
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
                        if (macroTarget === 'stager') {
                          const valToAppend = macro.value ? macro.value.replace(/\n$/, '') : macro.label;
                          setStagerText(prev => (prev && prev.trim().length > 0 ? `${prev} ${valToAppend}` : valToAppend));
                          setShowStager(true);
                        } else {
                          onKeyPress(macro.value);
                        }
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
        <div
          className="macro-modal-overlay"
          onTouchStart={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowFocusedSuiteModal(false)}
        >
          <div
            className="macro-modal-content"
            onTouchStart={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="macro-modal-header">
              <button
                className="focused-suite-title-reset"
                onClick={() => setFocusedSubSuite(null)}
                title="Tap to return to root suite view"
              >
                <h3>{focusedSuiteName}</h3>
              </button>

              <div className="macro-target-toggle">
                <button
                  type="button"
                  className={`target-pill ${macroTarget === 'stager' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMacroTargetToggle('stager');
                  }}
                  title="Route macro selection to Command Stager"
                >
                  <Edit3 size={11} />
                  <span>STAGER</span>
                </button>
                <button
                  type="button"
                  className={`target-pill ${macroTarget === 'terminal' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMacroTargetToggle('terminal');
                  }}
                  title="Route macro selection directly to Terminal PTY"
                >
                  <Terminal size={11} />
                  <span>PTY</span>
                </button>
              </div>

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
                      if (macroTarget === 'stager') {
                        const valToAppend = macro.value ? macro.value.replace(/\n$/, '') : macro.label;
                        setStagerText(prev => (prev && prev.trim().length > 0 ? `${prev} ${valToAppend}` : valToAppend));
                        setShowStager(true);
                      } else {
                        onKeyPress(macro.value);
                      }
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
