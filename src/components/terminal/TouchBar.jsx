import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, KeyRound, Trash2, Zap, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';

export default function TouchBar({ onKeyPress, onVoiceInput }) {
  const [isRecording, setIsRecording] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef(null);
  const lastSpeechRef = useRef('');
  const micToastTimerRef = useRef(null);

  const [primaryGroup, setPrimaryGroup] = useState('AI');
  const [selectedSuite, setSelectedSuite] = useState('AGY');

  const GROUPS = {
    AI: { label: 'AI', suites: ['AGY', 'CLD', 'HMS'] },
    PKG: { label: 'PKG', suites: ['APT', 'PAC', 'YUM'] },
    SYS: { label: 'SYS', suites: ['DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'] },
    KEY: { label: 'KEY', suites: ['KEY_NAV', 'KEY_FN', 'KEY_SYM', 'KEY_MODE', 'KEY_LINE'] },
  };

  const SUB_LABELS = {
    AGY: 'AGY',
    CLD: 'CLD',
    HMS: 'HMS',
    APT: 'APT',
    PAC: 'PAC',
    YUM: 'YUM',
    DOC: 'DOC',
    GIT: 'GIT',
    SYS: 'SYS',
    NET: 'NET',
    PY: 'PY',
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

  // Load active TouchBar layout from localStorage (or fallback defaults)
  const [activeSlots, setActiveSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_layout_slots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.bottom && Array.isArray(parsed.bottom)) return parsed.bottom;
      }
    } catch {}
    return ['AGY', 'CLD', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX', 'ESC', 'TAB', '^C', 'clear'];
  });

  // Listen for layout changes across tabs / settings
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('sovereign_layout_slots');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setActiveSlots(parsed);
          else if (parsed.bottom && Array.isArray(parsed.bottom)) setActiveSlots(parsed.bottom);
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Categorized Command Toolkits (Abbreviated 3-Char Badges & AI/CLI Suites)
  const commandSuites = {
    AGY: [
      { id: 'agy1', label: '/model', value: '/model ' },
      { id: 'agy2', label: '/clear', value: '/clear\n' },
      { id: 'agy3', label: '/plan', value: '/plan ' },
      { id: 'agy4', label: '/schedule', value: '/schedule ' },
      { id: 'agy5', label: '/goal', value: '/goal ' },
      { id: 'agy6', label: '/grill-me', value: '/grill-me ' },
      { id: 'agy7', label: '/teamwork', value: '/teamwork-preview ' },
      { id: 'agy8', label: '/learn', value: '/learn ' },
      { id: 'agy9', label: 'Ctrl+O', value: '\x0f' },
    ],
    CLD: [
      { id: 'cld1', label: '/compact', value: '/compact\n' },
      { id: 'cld2', label: '/cost', value: '/cost\n' },
      { id: 'cld3', label: '/doctor', value: '/doctor\n' },
      { id: 'cld4', label: '/clear', value: '/clear\n' },
      { id: 'cld5', label: '/help', value: '/help\n' },
      { id: 'cld6', label: '/init', value: '/init\n' },
      { id: 'cld7', label: '/bug', value: '/bug ' },
      { id: 'cld8', label: '/review', value: '/review ' },
      { id: 'cld9', label: 'Ctrl+C', value: '\x03' },
    ],
    HMS: [
      { id: 'hms1', label: '/status', value: '/status\n' },
      { id: 'hms2', label: '/reset', value: '/reset\n' },
      { id: 'hms3', label: '/tools', value: '/tools\n' },
      { id: 'hms4', label: '/logs', value: '/logs\n' },
      { id: 'hms5', label: '/cancel', value: '/cancel\n' },
      { id: 'hms6', label: '/config', value: '/config ' },
      { id: 'hms7', label: '/memory', value: '/memory ' },
      { id: 'hms8', label: '/mcp', value: '/mcp ' },
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
      { id: 'nav1', label: '▲ Up', value: '\x1b[A' },
      { id: 'nav2', label: '▼ Down', value: '\x1b[B' },
      { id: 'nav3', label: '◀ Left', value: '\x1b[D' },
      { id: 'nav4', label: '► Right', value: '\x1b[C' },
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

          // Synchronous ref-diffing: stream only NEW text characters to terminal
          if (currentTranscript.length > lastSpeechRef.current.length) {
            const newText = currentTranscript.slice(lastSpeechRef.current.length);
            if (newText && onVoiceInput) {
              onVoiceInput(newText);
            }
            lastSpeechRef.current = currentTranscript;
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
    // Send Sudo Macro JSON payload over WebSocket
    onKeyPress(JSON.stringify({ type: 'sudo_macro' }));
  };

  return (
    <>
      {/* Perimeter Touch Row */}
      <div className="touch-bar">
        <button
          className={`touch-btn voice-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleVoice}
          title="Gboard Voice Dictation"
        >
          {isRecording ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        <button className="touch-btn sudo-btn" onClick={handleSudoMacro} title="Quick Sudo Password Entry">
          <KeyRound size={14} />
          <span>(***)</span>
        </button>

        {/* Dynamic User-Customized TouchBar Items from LayoutBuilder */}
        {activeSlots.map((item, idx) => {
          const isCategoryLauncher = ['AGY', 'CLD', 'HMS', 'APT', 'DOC', 'GIT', 'SYS', 'NET', 'PY', 'TMX'].includes(item);

          if (isCategoryLauncher) {
            return (
              <button
                key={`slot-${item}-${idx}`}
                className="touch-btn suite-chip-btn"
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
              '|': '|',
              '~': '~',
              '/': '/',
              'clear': 'clear\n',
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
              '▲': '\x1b[A',
              '▼': '\x1b[B',
              '◀': '\x1b[D',
              '►': '\x1b[C',
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

            try {
              const saved = localStorage.getItem('sovereign_buttons');
              if (saved) {
                const btns = JSON.parse(saved);
                const match = btns.find(b => (b.label || b.name) === itemKey);
                if (match && match.value) return match.value;
              }
            } catch {}

            return itemKey.endsWith('\n') ? itemKey : `${itemKey}\n`;
          };

          if (item === '⚡ MACROS' || item === 'MACROS') {
            return (
              <button
                key={`slot-${item}-${idx}`}
                className="touch-btn macro-launcher-btn"
                onClick={() => { setSelectedSuite('AGY'); setShowMacroModal(true); }}
                title="Macro Master Catalog"
              >
                <Zap size={14} color="var(--status-danger)" />
                <span>MACROS</span>
              </button>
            );
          }

          return (
            <button
              key={`slot-${item}-${idx}`}
              className="touch-btn"
              onClick={() => onKeyPress(getCommandPayload(item))}
            >
              {item}
            </button>
          );
        })}

        {/* Master MACROS Catalog Launcher Pinned to Far Right (Bright Red) */}
        <button
          className="touch-btn macro-launcher-btn"
          onClick={() => { setSelectedSuite('AGY'); setShowMacroModal(true); }}
          title="Master Macro Catalog"
        >
          <Zap size={14} color="var(--status-danger)" />
          <span>MACROS</span>
        </button>

        <button className="touch-btn clear-btn" onClick={() => onKeyPress('clear\n')} title="Clear Terminal Screen">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Command Suite Modal with Categorized Sub-Tabs */}
      {showMacroModal && (
        <div className="macro-modal-overlay" onClick={() => setShowMacroModal(false)}>
          <div className="macro-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="macro-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={16} color="var(--accent-mana)" />
                <h3>{selectedSuite.replace('KEY_', '')} TOOLKIT</h3>
              </div>
              <button className="close-modal-btn" onClick={() => setShowMacroModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Primary Category Group Selector Bar */}
            <div className="suite-selector-scroll">
              {Object.keys(GROUPS).map((groupKey) => {
                const isActive = primaryGroup === groupKey;
                return (
                  <button
                    key={groupKey}
                    type="button"
                    className={`suite-tab-pill ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setPrimaryGroup(groupKey);
                      const defaultSub = GROUPS[groupKey].suites[0];
                      setSelectedSuite(defaultSub);
                    }}
                  >
                    {GROUPS[groupKey].label}
                  </button>
                );
              })}
            </div>

            {/* Sub-Suite Selector Bar for Active Group */}
            {GROUPS[primaryGroup] && (
              <div className="sub-suite-bar">
                {GROUPS[primaryGroup].suites.map((subKey) => {
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
              {(commandSuites[selectedSuite] || []).map((macro) => (
                <button
                  key={macro.id}
                  className="macro-grid-btn"
                  onClick={() => {
                    onKeyPress(macro.value);
                    setShowMacroModal(false);
                  }}
                >
                  {macro.label}
                </button>
              ))}
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
