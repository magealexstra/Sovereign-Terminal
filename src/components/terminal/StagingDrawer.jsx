import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, X, Edit3 } from 'lucide-react';

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
    onPointerDown: (e) => e.preventDefault(),
    onMouseDown:   (e) => e.preventDefault(),
  };
  const [stagingText, setStagingText] = useState(initialText);
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
    }
  }, [isOpen]);

  const toggleTwoStep = () => {
    const next = !isTwoStepMode;
    setIsTwoStepMode(next);
    try {
      localStorage.setItem('sovereign_stager_two_step', String(next));
    } catch {}
  };

  const handleSend = () => {
    if (!stagingText || stagingText.trim().length === 0) return;
    const cleanText = stagingText.trim();
    onSend({ text: cleanText, executeImmediately: !isTwoStepMode });
    setStagingText('');
    onClose();
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
        onChange={(e) => setStagingText(e.target.value)}
        placeholder="Type, paste URLs, or dictate command text here..."
        rows={3}
        autoCapitalize="none"
        autoCorrect="on"
        spellCheck="true"
        autoFocus
      />

      <div className="staging-drawer-footer">
        <button
          type="button"
          className="stager-action-btn clear-btn"
          {...noBlur}
          onClick={() => setStagingText('')}
          disabled={!stagingText}
        >
          <Trash2 size={13} />
          <span>Clear</span>
        </button>

        <button
          type="button"
          className="stager-action-btn send-btn"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSend}
          disabled={!stagingText || stagingText.trim().length === 0}
        >
          <Send size={13} />
          <span>{isTwoStepMode ? 'Stage to Prompt' : 'Send & Execute'}</span>
        </button>
      </div>
    </div>
  );
}
