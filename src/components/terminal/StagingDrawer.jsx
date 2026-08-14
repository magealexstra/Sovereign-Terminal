import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3 } from 'lucide-react';

/**
 * StagingDrawer — TouchBar-Anchored Decoupled Command & Dictation Staging Drawer
 *
 * Positioned immediately above the bottom TouchBar (bottom: 3.5rem).
 * Glides smoothly above mobile soft keyboards using visual viewport geometry.
 * Capped at 45dvh max height with internal overflow scrolling.
 *
 * Transmission Modes:
 *   - Direct Mode (Default): Sends text + '\n' to execute command immediately.
 *   - Two-Step Mode: Places text onto terminal prompt without '\n' for manual Enter.
 */
export default function StagingDrawer({
  isOpen,
  onClose,
  initialText = '',
  onSend,
}) {
  const textareaRef = useRef(null);
  const noBlur = {
    onTouchStart:  (e) => e.stopPropagation(),
    onTouchEnd:    (e) => e.stopPropagation(),
    onPointerDown: (e) => { e.stopPropagation(); e.preventDefault(); },
    onMouseDown:   (e) => { e.stopPropagation(); e.preventDefault(); },
  };
  const [stagingText, setStagingText] = useState(initialText);
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_stager_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftTextRef = useRef('');
  const [historyToast, setHistoryToast] = useState('');
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  const [isTwoStepMode, setIsTwoStepMode] = useState(() => {
    try {
      return localStorage.getItem('sovereign_stager_two_step') === 'true';
    } catch {
      return false;
    }
  });
  const [tapTarget, setTapTarget] = useState(() => {
    try {
      return localStorage.getItem('sovereign_stager_tap_redirect') || 'stager';
    } catch {
      return 'stager';
    }
  });

  const toggleTapTarget = () => {
    const next = tapTarget === 'stager' ? 'xterm' : 'stager';
    setTapTarget(next);
    try {
      localStorage.setItem('sovereign_stager_tap_redirect', next);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  // Sync initialText when dictation updates
  useEffect(() => {
    if (initialText) {
      setStagingText(initialText);
      setHistoryIndex(-1);
    }
  }, [initialText]);

  // Focus Lock: Ensure textarea receives focus immediately upon opening
  useEffect(() => {
    if (isOpen) {
      const timerId = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timerId);
    } else {
      setHistoryIndex(-1);
    }
  }, [isOpen]);

  const toggleTwoStep = () => {
    const next = !isTwoStepMode;
    setIsTwoStepMode(next);
    try {
      localStorage.setItem('sovereign_stager_two_step', String(next));
    } catch {}
  };

  const navigateHistory = (direction) => {
    if (history.length === 0) return;

    if (direction === 'up') {
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) return;

      if (historyIndex === -1) {
        draftTextRef.current = stagingText;
      }

      setHistoryIndex(nextIndex);
      const targetCommand = history[history.length - 1 - nextIndex];
      setStagingText(targetCommand);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(targetCommand.length, targetCommand.length);
        }
      });
    } else if (direction === 'down') {
      if (historyIndex === -1) return;

      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);

      if (nextIndex === -1) {
        const restored = draftTextRef.current || '';
        setStagingText(restored);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(restored.length, restored.length);
          }
        });
      } else {
        const targetCommand = history[history.length - 1 - nextIndex];
        setStagingText(targetCommand);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(targetCommand.length, targetCommand.length);
          }
        });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory('down');
    }
  };

  const handleSend = () => {
    if (!stagingText || stagingText.trim().length === 0) return;
    const cleanText = stagingText.trim();

    try {
      const saved = localStorage.getItem('sovereign_stager_history');
      const list = saved ? JSON.parse(saved) : [];
      if (list.length === 0 || list[list.length - 1] !== cleanText) {
        list.push(cleanText);
        if (list.length > 1000) {
          list.shift();
        }
        localStorage.setItem('sovereign_stager_history', JSON.stringify(list));
        setHistory(list);
      }
    } catch {}

    setHistoryIndex(-1);
    draftTextRef.current = '';
    onSend({ text: cleanText, executeImmediately: !isTwoStepMode });
    setStagingText('');
    onClose();
  };

  const startClearPress = () => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      try {
        localStorage.removeItem('sovereign_stager_history');
      } catch {}
      setHistory([]);
      setHistoryIndex(-1);
      draftTextRef.current = '';
      setStagingText('');
      setHistoryToast('Stager history cleared');
      setTimeout(() => setHistoryToast(''), 2000);
    }, 3000);
  };

  const cancelClearPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClearClick = (e) => {
    e.stopPropagation();
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    setStagingText('');
    setHistoryIndex(-1);
    draftTextRef.current = '';
  };

  if (!isOpen) return null;

  return (
    <div
      className="staging-drawer-container"
      onClick={() => {
        if (textareaRef.current) textareaRef.current.focus();
      }}
    >
      <div className="staging-drawer-header">
        <div className="staging-drawer-title">
          <Edit3 size={15} color="var(--accent-violet)" />
          <span>COMMAND STAGER</span>
          {historyToast && <span className="stager-toast-badge">{historyToast}</span>}
        </div>

        <div className="staging-drawer-controls">
          <button
            type="button"
            className={`stager-mode-toggle tap-target ${tapTarget === 'stager' ? 'stager' : 'xterm'}`}
            {...noBlur}
            onClick={(e) => {
              e.stopPropagation();
              toggleTapTarget();
            }}
            title={tapTarget === 'stager' ? 'Tap Target: Terminal taps open Command Stager' : 'Tap Target: Terminal taps focus xterm directly'}
          >
            <span>{tapTarget === 'stager' ? 'STAGER' : 'XTERM'}</span>
          </button>

          <button
            type="button"
            className={`stager-mode-toggle ${isTwoStepMode ? 'two-step' : 'direct'}`}
            {...noBlur}
            onClick={(e) => {
              e.stopPropagation();
              toggleTwoStep();
            }}
            title={isTwoStepMode ? 'Two-Step Mode: Places text on prompt without Enter' : 'Direct Mode: Sends text and executes Enter immediately'}
          >
            <span>{isTwoStepMode ? 'TWO-STEP' : 'DIRECT'}</span>
          </button>

          <button
            type="button"
            className="stager-icon-btn close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close Staging Drawer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="staging-drawer-textarea"
        value={stagingText}
        onChange={(e) => {
          setStagingText(e.target.value);
          if (historyIndex === -1) {
            draftTextRef.current = e.target.value;
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type, paste URLs, or dictate command text here..."
        rows={3}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        autoFocus
      />

      <div className="staging-drawer-footer">
        <button
          type="button"
          className="stager-action-btn clear-btn"
          {...noBlur}
          onTouchStart={startClearPress}
          onTouchEnd={cancelClearPress}
          onMouseDown={startClearPress}
          onMouseUp={cancelClearPress}
          onMouseLeave={cancelClearPress}
          onClick={handleClearClick}
          disabled={!stagingText && history.length === 0}
          title="Tap to clear current text. Hold for 3s to wipe history."
        >
          <span>Clear</span>
        </button>

        <div className="stager-footer-nav-group">
          <button
            type="button"
            className="stager-nav-btn glyph-icon-btn"
            {...noBlur}
            onClick={(e) => {
              e.stopPropagation();
              navigateHistory('down');
            }}
            disabled={historyIndex === -1}
            title="Next command (Down)"
          >
            <span>▼</span>
          </button>

          <button
            type="button"
            className="stager-nav-btn glyph-icon-btn"
            {...noBlur}
            onClick={(e) => {
              e.stopPropagation();
              navigateHistory('up');
            }}
            disabled={history.length === 0 || historyIndex === history.length - 1}
            title="Previous command (Up)"
          >
            <span>▲</span>
          </button>
        </div>

        <button
          type="button"
          className="stager-action-btn send-btn"
          {...noBlur}
          onClick={handleSend}
          disabled={!stagingText || stagingText.trim().length === 0}
        >
          <span>{isTwoStepMode ? 'Stage to Prompt' : 'Send & Execute'}</span>
        </button>
      </div>
    </div>
  );
}
