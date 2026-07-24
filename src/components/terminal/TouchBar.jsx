import React, { useState, useRef } from 'react';
import { Mic, MicOff, KeyRound, Trash2, Zap, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';

export default function TouchBar({ onKeyPress, onVoiceInput }) {
  const [isRecording, setIsRecording] = useState(false);
  const [lastSpeech, setLastSpeech] = useState('');
  const [showMacroModal, setShowMacroModal] = useState(false);
  const recognitionRef = useRef(null);

  // 12-Macro Preset Grid Definition (3 Rows x 4 Columns)
  const macroGrid = [
    { id: 'm1', label: 'htop', value: 'htop\n' },
    { id: 'm2', label: 'docker ps', value: 'docker ps\n' },
    { id: 'm3', label: 'git status', value: 'git status\n' },
    { id: 'm4', label: 'ls -la', value: 'ls -la\n' },
    { id: 'm5', label: 'aegis status', value: 'aegis status\n' },
    { id: 'm6', label: 'systemctl', value: 'systemctl status\n' },
    { id: 'm7', label: 'df -h', value: 'df -h\n' },
    { id: 'm8', label: 'top', value: 'top\n' },
    { id: 'm9', label: 'clear', value: 'clear\n' },
    { id: 'm10', label: 'exit', value: 'exit\n' },
    { id: 'm11', label: 'tmux ls', value: 'tmux ls\n' },
    { id: 'm12', label: 'ip a', value: 'ip a\n' },
  ];

  // Gboard Voice Dictation Handler with Auto-Stop on Silence VAD
  const toggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. Please use keyboard dictation.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }

      // Smart-diff tracker to stream text to terminal without duplicates
      if (currentTranscript && currentTranscript !== lastSpeech) {
        const newText = currentTranscript.slice(lastSpeech.length);
        if (newText && onVoiceInput) {
          onVoiceInput(newText);
        }
        setLastSpeech(currentTranscript);
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e);
      setIsRecording(false);
    };

    // Auto-Stop on Silence VAD
    recognition.onend = () => {
      setIsRecording(false);
      setLastSpeech('');
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
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

        <button className="touch-btn macro-launcher-btn" onClick={() => setShowMacroModal(true)} title="12-Macro Popup Grid">
          <Zap size={14} color="#88C0D0" />
          <span>MACROS</span>
        </button>

        <button className="touch-btn" onClick={() => onKeyPress('\x1b')}>ESC</button>
        <button className="touch-btn" onClick={() => onKeyPress('\t')}>TAB</button>
        <button className="touch-btn" onClick={() => onKeyPress('\x03')}>^C</button>
        <button className="touch-btn" onClick={() => onKeyPress('\x1a')}>^Z</button>
        <button className="touch-btn" onClick={() => onKeyPress('|')}>|</button>
        <button className="touch-btn" onClick={() => onKeyPress('~')}>~</button>

        <button className="touch-btn" onClick={() => onKeyPress('\x1b[A')}><ArrowUp size={14} /></button>
        <button className="touch-btn" onClick={() => onKeyPress('\x1b[B')}><ArrowDown size={14} /></button>
        <button className="touch-btn" onClick={() => onKeyPress('\x1b[D')}><ArrowLeft size={14} /></button>
        <button className="touch-btn" onClick={() => onKeyPress('\x1b[C')}><ArrowRight size={14} /></button>

        <button className="touch-btn clear-btn" onClick={() => onKeyPress('clear\n')} title="Clear Terminal Screen">
          <Trash2 size={14} />
        </button>
      </div>

      {/* 12-Macro Symmetrical Popup Grid Modal (3 Rows x 4 Columns) */}
      {showMacroModal && (
        <div className="macro-modal-overlay" onClick={() => setShowMacroModal(false)}>
          <div className="macro-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="macro-modal-header">
              <Zap size={16} color="#88C0D0" />
              <h3>QUICK MACRO GRID</h3>
              <button className="close-modal-btn" onClick={() => setShowMacroModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="macro-grid-3x4">
              {macroGrid.map((macro) => (
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
    </>
  );
}
