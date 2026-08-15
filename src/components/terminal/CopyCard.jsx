import React, { useState, useEffect, useRef } from 'react';
import { parseCopyLines } from '../../utils/parseCopyLines';

/**
 * CopyCard — Right-Edge Collapsible Copy Suite
 *
 * Collapsed state: a persistent 6px tri-color bar flush against the right edge
 * of the terminal. The bar is always visible and tracks the keyboard via the
 * parent flex layout (same positioning context as the original panel).
 *
 * Expanded state: the full button panel slides out to the left of the bar,
 * visually identical to the original floating panel.
 *
 * Collapse triggers:
 *   - Tap COPY / ALL / CUST  → action fires then auto-collapses
 *   - Tap bar again           → explicit collapse
 *   - Tap anywhere outside    → collapses (no preventDefault — keyboard stays up)
 *
 * The CLIP/CODE toggle is inside containerRef so the outside-click handler
 * naturally ignores it; the panel stays open when toggling mode.
 *
 * Keyboard retention: every interactive element inside this component carries
 * onPointerDown + onMouseDown preventDefault to prevent xterm textarea blur.
 */
export default function CopyCard({
  onCopyLastOutput,
  onCopyScreenBuffer,
  onCopyCustomLines,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  const [destinationMode, setDestinationMode] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_copy_destination');
      return saved === 'code' ? 'code' : 'clip';
    } catch {
      return 'clip';
    }
  });

  // Dynamic CUST button label & parsed line count from localStorage
  const [custConfig, setCustConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('sovereign_cust_button');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { label: 'CUST', value: 'set number of lines to copy (50)' };
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('sovereign_cust_button');
        if (saved) setCustConfig(JSON.parse(saved));
        
        const d = localStorage.getItem('sovereign_copy_destination');
        if (d === 'code') setDestinationMode('code');
        else if (d === 'clip') setDestinationMode('clip');
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Outside-click collapse — only active while expanded.
  // Does NOT call preventDefault on the document event so xterm retains
  // focus and the virtual keyboard remains up.
  useEffect(() => {
    if (!isExpanded) return;

    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };

    // Defer by one frame so the tap that opened the panel doesn't
    // immediately re-trigger this handler on the same event cycle.
    // listenerAttached guards against the race where cancelAnimationFrame
    // fires before the frame executes — without it, the frame could attach
    // handleOutside AFTER cleanup, leaving an orphaned document listener.
    let listenerAttached = false;
    const frame = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handleOutside);
      listenerAttached = true;
    });

    return () => {
      cancelAnimationFrame(frame);
      if (listenerAttached) {
        document.removeEventListener('pointerdown', handleOutside);
      }
    };
  }, [isExpanded]);

  const toggleDestination = () => {
    const nextMode = destinationMode === 'clip' ? 'code' : 'clip';
    setDestinationMode(nextMode);
    try {
      localStorage.setItem('sovereign_copy_destination', nextMode);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  };

  const parsedLines = parseCopyLines(custConfig.value);

  // Shared pointer-block props — prevents keyboard dismissal on every tap
  const noBlur = {
    onTouchStart:  (e) => { e.stopPropagation(); },
    onTouchEnd:    (e) => { e.stopPropagation(); },
    onPointerDown: (e) => { e.stopPropagation(); e.preventDefault(); },
    onMouseDown:   (e) => { e.stopPropagation(); e.preventDefault(); },
  };

  const handleBarTap = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.activeElement?.blur) {
      document.activeElement.blur();
    }
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`copy-card-container${isExpanded ? ' expanded' : ''}`}
      title="Terminal Copy Suite"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Expandable panel — slides out to the left of the bar */}
      <div className="copy-card-panel">
        <button
          type="button"
          className="copy-card-btn btn-copy"
          {...noBlur}
          onClick={(e) => { e.stopPropagation(); onCopyLastOutput(destinationMode); setIsExpanded(false); }}
          title={destinationMode === 'clip'
            ? 'Copy last command response to mobile clipboard'
            : 'Open last command response in CodeMirror'}
        >
          <span>COPY</span>
        </button>

        <button
          type="button"
          className="copy-card-btn btn-all"
          {...noBlur}
          onClick={(e) => { e.stopPropagation(); onCopyScreenBuffer(destinationMode); setIsExpanded(false); }}
          title={destinationMode === 'clip'
            ? 'Copy visible screen buffer to mobile clipboard'
            : 'Open visible screen buffer in CodeMirror'}
        >
          <span>ALL</span>
        </button>

        <button
          type="button"
          className="copy-card-btn btn-cust"
          {...noBlur}
          onClick={(e) => { e.stopPropagation(); onCopyCustomLines(destinationMode, parsedLines); setIsExpanded(false); }}
          title={destinationMode === 'clip'
            ? `Copy ${parsedLines} scrollback lines to mobile clipboard`
            : `Open ${parsedLines} scrollback lines in CodeMirror`}
        >
          <span>{custConfig.label || 'CUST'}</span>
        </button>

        <button
          type="button"
          className={`copy-card-toggle ${destinationMode}`}
          {...noBlur}
          onClick={(e) => { e.stopPropagation(); toggleDestination(); }}
          title={`Destination Mode: ${destinationMode === 'clip' ? 'Direct Mobile Clipboard' : 'CodeMirror Inspector'}. Tap to toggle.`}
        >
          <span>{destinationMode === 'clip' ? 'CLIP' : 'CODE'}</span>
        </button>
      </div>

      {/* Persistent bar handle — always visible, toggles expand/collapse */}
      <div
        className="copy-card-bar-handle"
        {...noBlur}
        onClick={handleBarTap}
        title="Copy Suite (tap to expand)"
        role="button"
        aria-label="Toggle copy suite"
        aria-expanded={isExpanded}
      />
    </div>
  );
}
