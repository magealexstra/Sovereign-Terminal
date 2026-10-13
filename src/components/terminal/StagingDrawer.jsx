import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3 } from 'lucide-react';

/**
 * StagingDrawer — TouchBar-Anchored Decoupled Command & Dictation Staging Drawer
 *
 * Positioned immediately above the bottom TouchBar (bottom: 3.5rem).
 * The parent container tracks the soft keyboard, so the drawer rides above it.
 * Capped at 45dvh max height with internal overflow scrolling.
 *
 * The text is owned by the parent (`text`, `onTextChange`) so macros and dictation add to the same
 * text the user is typing, and it survives the drawer being closed and reopened.
 *
 * Transmission Modes:
 *   - Direct Mode (Default): Sends text + '\n' to execute command immediately.
 *   - Two-Step Mode: Places text onto terminal prompt without '\n' for manual Enter.
 */
export default function StagingDrawer({
  isOpen,
  onClose,
  text,
  onTextChange,
  onSend,
}) {
  const textareaRef = useRef(null);
  const noBlur = {
    onTouchStart:  (e) => e.stopPropagation(),
    onTouchEnd:    (e) => e.stopPropagation(),
    onPointerDown: (e) => { e.stopPropagation(); e.preventDefault(); },
    onMouseDown:   (e) => { e.stopPropagation(); e.preventDefault(); },
  };
  const readSavedHistory = () => {
    try {
      const saved = localStorage.getItem('sovereign_stager_history');
      const list = saved ? JSON.parse(saved) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  const [history, setHistory] = useState(readSavedHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const draftTextRef = useRef('');
  const [historyToast, setHistoryToast] = useState('');
  const longPressTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const isLongPressRef = useRef(false);
  // The last text this component passed up; any other change to `text` came from outside.
  const lastEmittedRef = useRef(text);
  const stagingText = text;

  const setStagingText = (value) => {
    lastEmittedRef.current = value;
    onTextChange(value);
  };

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
    } catch {}
  };

  // Text changed from outside (a macro, dictation) ends any history browsing.
  useEffect(() => {
    if (text !== lastEmittedRef.current) {
      lastEmittedRef.current = text;
      setHistoryIndex(-1);
    }
  }, [text]);

  // Timers that outlive the drawer must not fire after it unmounts (a held Clear would wipe history).
  useEffect(() => () => {
    clearTimeout(longPressTimerRef.current);
    clearTimeout(toastTimerRef.current);
  }, []);

  // Puts the caret at the end of the text and focuses the textarea.
  const focusAtEnd = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const len = el.value.length;
    el.setSelectionRange(len, len);
  };

  // On open, focuses the textarea at once and again after 50 ms, since the terminal's own focus
  // handling can take focus back right after the open event, and prepares the terminal prompt.
  useEffect(() => {
    if (isOpen) {
      window.dispatchEvent(new CustomEvent('sovereign_open_stager'));
      focusAtEnd();
      const timerId = setTimeout(focusAtEnd, 50);
      return () => clearTimeout(timerId);
    } else {
      setHistoryIndex(-1);
    }
  }, [isOpen]);

  // Keeps the xterm helper textarea from taking focus while the drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const handleFocusIn = (e) => {
      if (e.target && (e.target.classList.contains('xterm-helper-textarea') || e.target.closest('.terminal-container'))) {
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
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
      const list = readSavedHistory();
      if (list.length === 0 || list[list.length - 1] !== cleanText) {
        list.push(cleanText);
        if (list.length > 1000) {
          list.shift();
        }
        localStorage.setItem('sovereign_stager_history', JSON.stringify(list));
        setHistory(list);
      }
    } catch {
      // The command is still sent; only the history entry is lost when storage is unavailable.
    }

    setHistoryIndex(-1);
    draftTextRef.current = '';
    onSend({ text: cleanText, executeImmediately: !isTwoStepMode });
    setStagingText('');
    onClose();
  };

  const startClearPress = () => {
    isLongPressRef.current = false;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      try {
        localStorage.removeItem('sovereign_stager_history');
      } catch {
        setHistoryToast('Could not clear stager history');
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setHistoryToast(''), 2000);
        return;
      }
      setHistory([]);
      setHistoryIndex(-1);
      draftTextRef.current = '';
      setStagingText('');
      setHistoryToast('Stager history cleared');
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setHistoryToast(''), 2000);
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
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={() => {
        if (textareaRef.current) textareaRef.current.focus({ preventScroll: true });
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
            className={`stager-mode-toggle ${tapTarget === 'stager' ? 'stager' : 'xterm'}`}
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
            className="stager-icon-btn"
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
      />

      <div className="staging-drawer-footer">
        <button
          type="button"
          className="stager-action-btn clear-btn"
          {...noBlur}
          onPointerDown={(e) => {
            noBlur.onPointerDown(e);
            startClearPress();
          }}
          onPointerUp={cancelClearPress}
          onPointerLeave={cancelClearPress}
          onPointerCancel={cancelClearPress}
          onClick={handleClearClick}
          disabled={!stagingText && history.length === 0}
          title="Tap to clear current text. Hold for 3s to wipe history."
        >
          <span>Clear</span>
        </button>

        <div className="stager-footer-nav-group">
          <button
            type="button"
            className="stager-nav-btn"
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
            className="stager-nav-btn"
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
