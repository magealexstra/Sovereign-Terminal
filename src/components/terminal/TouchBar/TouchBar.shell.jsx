/**
 * The touch bar: the key row, voice dictation into the stager, label resolution, custom button and suite loading from saved settings, and the macro modals' state.
 */

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Trash2, Zap, Edit3 } from 'lucide-react';
import StagingDrawer from '../StagingDrawer';
import { PREBUILT_CATEGORIES } from '../../settings/button-studio/buttonData';
import { KEY_MAPPINGS, getSavedSudo, isGlyphSymbol } from './TouchBar.keys';
import { GROUPS, commandSuites } from './TouchBar.suites';
import { MacroModal } from './TouchBar.macroModal';
import { FocusedSuiteModal } from './TouchBar.focusedSuiteModal';

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
    } catch {
      // Storage is unavailable; the choice applies until the page reloads.
    }
  };
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef(null);
  const micToastTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Stops speech recognition and the mic toast timer on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Recognition had already stopped.
        }
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

  useEffect(() => {
    const handleOpenStager = () => setShowStager(true);
    const handleCloseStager = () => setShowStager(false);
    window.addEventListener('sovereign_open_stager', handleOpenStager);
    window.addEventListener('sovereign_close_stager', handleCloseStager);
    return () => {
      window.removeEventListener('sovereign_open_stager', handleOpenStager);
      window.removeEventListener('sovereign_close_stager', handleCloseStager);
    };
  }, []);

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



  // Short-lived inline message above the bar (mic errors, a missing sudo password)
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
    } catch {
      // An unreadable saved layout falls back to the default keys.
    }
    return ['ESC', 'TAB', '^C', '-', '/'];
  });

  // Re-reads the layout when it is saved here (settings) or in another tab
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key !== 'sovereign_layout_slots') return;
      try {
        const saved = localStorage.getItem('sovereign_layout_slots');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setActiveSlots(parsed.filter(item => !PURGED_LAUNCHERS.includes(item)));
          else if (parsed.bottom && Array.isArray(parsed.bottom)) setActiveSlots(parsed.bottom.filter(item => !PURGED_LAUNCHERS.includes(item)));
        }
      } catch {
        // An unreadable saved layout keeps the one already shown.
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Label-to-value resolver. Resolution order: custom buttons, then the built-in suites, then the
  // prebuilt categories, then the label itself as a command.
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

  // Loads custom buttons, per-suite label overrides and custom macro suites from localStorage
  const loadSuiteData = () => {
    let btns = [];
    try {
      const raw = localStorage.getItem('sovereign_buttons');
      btns = raw ? JSON.parse(raw) : [];
      setCustomButtons(btns);
    } catch {
      setCustomButtons([]);
    }

    // Saved label overrides for each built-in suite
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
      } catch {
        // A suite with unreadable saved overrides keeps its built-in buttons.
      }
    });
    setSuiteOverrides(overrides);

    // Custom macro suites are the custom buttons whose value is 'macro'
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
        } catch {
          // A suite with unreadable saved labels is left out.
        }
      });

      // Provide default CUST suite containing all custom buttons
      if (btns && btns.length > 0) {
        custData['CUST'] = btns.map((b, idx) => ({
          ...b,
          id: b.id || `cust-btn-${idx}`,
          isSuiteLauncher: false,
        }));
      }
      setCustomSuiteData(custData);
    } catch {
      setCustomMacroSuites([]);
      setCustomSuiteData({});
    }
  };

  // Loads on mount and reloads when the button or suite data is saved here (settings) or elsewhere.
  // A storage event for any other key is ignored.
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key !== 'sovereign_buttons' && !e.key.startsWith('sovereign_macro_suite_')) return;
      loadSuiteData();
    };
    loadSuiteData();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sovereign_custom_buttons_updated', loadSuiteData);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sovereign_custom_buttons_updated', loadSuiteData);
    };
  }, []);

  // CUST group prepended when custom suites or custom buttons exist; resolved active button array
  const customSuitesList = customMacroSuites.length > 0 
    ? (customMacroSuites.includes('CUST') ? customMacroSuites : ['CUST', ...customMacroSuites])
    : (customButtons.length > 0 ? ['CUST'] : []);

  const effectiveGroups = customSuitesList.length > 0
    ? { CUST: { label: 'CUST', suites: customSuitesList }, ...GROUPS }
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

  // Continuous voice dictation: a new recognition session starts each time one ends, until the mic is tapped off.
  // Only the session held in recognitionRef may restart listening, so a quick off-and-on cannot leave two running.
  const toggleVoice = () => {
    if (isRecordingRef.current) {
      // User explicitly tapped mic button to turn OFF
      isRecordingRef.current = false;
      if (isMountedRef.current) setIsRecording(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {
          // Recognition had already stopped.
        }
        // Cleared so the aborted session's late end event cannot restart listening or flip the button
        recognitionRef.current = null;
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
          if (!isMountedRef.current || recognitionRef.current !== recognition) return;
          // Restart unless the user tapped the mic off
          if (isRecordingRef.current) {
            setTimeout(() => {
              if (isRecordingRef.current && isMountedRef.current && recognitionRef.current === recognition) {
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
        showMicToast('Could not start voice dictation.');
      }
    };

    startListeningSession();
  };

  const handleSudoMacro = () => {
    const savedSudo = getSavedSudo();
    if (savedSudo && onKeyPress) {
      onKeyPress(`${savedSudo}\n`);
    }
  };

  // Command Payload Resolver. A button is known by its label; what it sends is, in order: a special
  // key's escape sequence, a custom button's value, the value the caller already holds (a macro tile),
  // the saved sudo password for a sudo button, then the catalogue value for the label, which falls
  // back to the label itself as a command.
  const getCommandPayload = (itemKey, knownValue) => {
    if (KEY_MAPPINGS[itemKey]) return KEY_MAPPINGS[itemKey];

    const match = customButtons.find(b => (b.label || b.name) === itemKey);
    if (match && match.value) return match.value;

    if (knownValue) return knownValue;

    if (itemKey.toLowerCase().includes('sudo')) {
      const savedSudo = getSavedSudo();
      if (!savedSudo) return null;
      return `${savedSudo}\n`;
    }

    return resolveLabel(itemKey).value;
  };

  // Sends a resolved payload to the terminal. A null payload (a sudo button with no saved password)
  // sends nothing and says so.
  const sendPayload = (payload) => {
    if (payload === null) {
      showMicToast('No saved sudo password.');
      return;
    }
    onKeyPress(payload);
  };

  // Routes a tapped macro either into the stager text or straight to the terminal, per the macro target.
  // A macro marked not executable is sent without its trailing newline.
  const handleMacroPress = (macro) => {
    if (macroTarget === 'stager') {
      const valToAppend = macro.value ? macro.value.replace(/\n$/, '') : macro.label;
      setStagerText(prev => (prev && prev.trim().length > 0 ? `${prev} ${valToAppend}` : valToAppend));
      setShowStager(true);
    } else {
      sendPayload((macro.isExecutable === false)
        ? (macro.value ? macro.value.replace(/\n$/, '') : macro.label)
        : getCommandPayload(macro.label, macro.value));
    }
  };

  // Read once per render; it decides whether the sudo password button and sudo slots show
  const savedSudo = getSavedSudo();

  return (
    <>
      {/* TouchBar-Anchored Decoupled Command & Dictation Staging Drawer */}
      <StagingDrawer
        isOpen={showStager}
        onClose={() => setShowStager(false)}
        text={stagerText}
        onTextChange={setStagerText}
        onSend={(payload) => {
          if (onKeyPress) onKeyPress(payload);
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
          className="touch-btn"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowStager((prev) => !prev)}
          title="Open Command Staging Drawer"
          style={{ borderColor: 'var(--accent-violet)', color: 'var(--accent-violet)' }}
        >
          <Edit3 size={15} />
        </button>

        {savedSudo && (
          <button className="touch-btn sudo-btn" onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()} onClick={handleSudoMacro} title="Quick Sudo Password Entry">
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

          if (item.toLowerCase().includes('sudo') && !KEY_MAPPINGS[item] && !savedSudo) {
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
              className={`touch-btn ${btnStyle.shape || ''} ${isGlyphSymbol(item) ? 'glyph-icon-btn' : ''}`}
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
                const match = customButtons.find(b => (b.label || b.name) === item);
                if (match && match.isExecutable === false) {
                  const valToStage = match.value ? match.value.replace(/\n$/, '') : item;
                  setStagerText(prev => (prev && prev.trim().length > 0 ? `${prev} ${valToStage}` : valToStage));
                  setShowStager(true);
                  return;
                }
                sendPayload(getCommandPayload(item));
              }}
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
        <MacroModal
          setShowMacroModal={setShowMacroModal}
          selectedSuite={selectedSuite}
          macroTarget={macroTarget}
          handleMacroTargetToggle={handleMacroTargetToggle}
          effectiveGroups={effectiveGroups}
          primaryGroup={primaryGroup}
          setPrimaryGroup={setPrimaryGroup}
          setSelectedSuite={setSelectedSuite}
          activeSuiteButtons={activeSuiteButtons}
          customMacroSuites={customMacroSuites}
          handleMacroPress={handleMacroPress}
        />
      )}

      {/* Focused Suite Modal — opens when a custom suite bar button is tapped */}
      {showFocusedSuiteModal && (
        <FocusedSuiteModal
          setShowFocusedSuiteModal={setShowFocusedSuiteModal}
          setFocusedSubSuite={setFocusedSubSuite}
          focusedSuiteName={focusedSuiteName}
          macroTarget={macroTarget}
          handleMacroTargetToggle={handleMacroTargetToggle}
          focusedChips={focusedChips}
          focusedSubSuite={focusedSubSuite}
          focusedRegularButtons={focusedRegularButtons}
          handleMacroPress={handleMacroPress}
        />
      )}

      {/* Mic error toast (non-blocking) */}
      {micToast && (
        <div className="copy-toast" style={{ bottom: '4.5rem', top: 'auto' }}>
          <span>{micToast}</span>
        </div>
      )}
    </>
  );
}
