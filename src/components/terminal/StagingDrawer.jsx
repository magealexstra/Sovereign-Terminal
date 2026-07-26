import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, X, Sliders, Sparkles, Edit3 } from 'lucide-react';

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
  const [stagingText, setStagingText] = useState(initialText);
  const [isTwoStepMode, setIsTwoStepMode] = useState(() => {
    try {
      return localStorage.getItem('sovereign_stager_two_step') === 'true';
    } catch {
      return false;
    }
  });

  // Sync initialText when dictation updates
  useEffect(() => {
    if (initialText) {
      setStagingText(initialText);
    }
  }, [initialText]);

  // Focus Lock: Ensure textarea receives focus immediately upon opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
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
    const payload = isTwoStepMode ? cleanText : `${cleanText}\n`;
    onSend(payload);
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
            className={`stager-mode-toggle ${isTwoStepMode ? 'two-step' : 'direct'}`}
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
        autoFocus
      />

      <div className="staging-drawer-footer">
        <button
          type="button"
          className="stager-action-btn clear-btn"
          onClick={() => setStagingText('')}
          disabled={!stagingText}
        >
          <Trash2 size={13} />
          <span>Clear</span>
        </button>

        <button
          type="button"
          className="stager-action-btn send-btn"
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
