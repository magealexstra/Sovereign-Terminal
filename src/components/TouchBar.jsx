import React, { useState, useRef } from 'react';
import { Mic, MicOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export default function TouchBar({ onKeyPress, onVoiceInput }) {
  const [isRecording, setIsRecording] = useState(false);
  const [lastSpeech, setLastSpeech] = useState('');
  const recognitionRef = useRef(null);

  // Gboard / Web Speech Recognition Handler
  const toggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Web Speech API is not supported in this browser. Please use Gboard voice key on mobile keyboard.');
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

      // Smart-diff tracking to send new text to terminal without duplicates
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

    recognition.onend = () => {
      setIsRecording(false);
      setLastSpeech('');
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  return (
    <div className="touch-bar">
      <button
        className={`touch-btn voice-btn ${isRecording ? 'recording' : ''}`}
        onClick={toggleVoice}
        title="Voice Dictation"
      >
        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      <button className="touch-btn" onClick={() => onKeyPress('\x1b')}>ESC</button>
      <button className="touch-btn" onClick={() => onKeyPress('\t')}>TAB</button>
      <button className="touch-btn" onClick={() => onKeyPress('\x03')}>^C</button>
      <button className="touch-btn" onClick={() => onKeyPress('\x1a')}>^Z</button>
      <button className="touch-btn" onClick={() => onKeyPress('|')}>|</button>
      <button className="touch-btn" onClick={() => onKeyPress('~')}>~</button>
      <button className="touch-btn" onClick={() => onKeyPress('-')}>-</button>
      <button className="touch-btn" onClick={() => onKeyPress('/')}>/</button>
      
      <button className="touch-btn" onClick={() => onKeyPress('\x1b[A')}><ArrowUp size={14} /></button>
      <button className="touch-btn" onClick={() => onKeyPress('\x1b[B')}><ArrowDown size={14} /></button>
      <button className="touch-btn" onClick={() => onKeyPress('\x1b[D')}><ArrowLeft size={14} /></button>
      <button className="touch-btn" onClick={() => onKeyPress('\x1b[C')}><ArrowRight size={14} /></button>
    </div>
  );
}
