import React, { useState, useEffect } from 'react';
import { parseCopyLines } from '../../utils/parseCopyLines';

/**
 * CopyCard — Left-Edge Pinned Vertical Copy Suite
 *
 * Provides 1-tap extraction of terminal buffer text into either:
 *   - Direct Mobile Clipboard (Target A: navigator.clipboard.writeText)
 *   - CodeMirror Document Inspector (Target B: editable doc tab)
 *
 * Buttons:
 *   - COPY: Last command execution response output (Green Border)
 *   - ALL:  Currently visible screen buffer (Blue Border)
 *   - CUST: Custom scrollback line count from Settings (Red Border)
 *   - Destination Mode Pill: Toggles between [ CLIP ] and [ CODE ]
 */
export default function CopyCard({
  onCopyLastOutput,
  onCopyScreenBuffer,
  onCopyCustomLines,
}) {
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
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleDestination = () => {
    const nextMode = destinationMode === 'clip' ? 'code' : 'clip';
    setDestinationMode(nextMode);
    try {
      localStorage.setItem('sovereign_copy_destination', nextMode);
    } catch {}
  };

  const parsedLines = parseCopyLines(custConfig.value);

  return (
    <div className="copy-card-container" title="Terminal Copy Suite">
      <button
        type="button"
        className="copy-card-btn btn-copy"
        onClick={() => onCopyLastOutput(destinationMode)}
        title={destinationMode === 'clip' ? 'Copy last command response to mobile clipboard' : 'Open last command response in CodeMirror'}
      >
        <span>COPY</span>
      </button>

      <button
        type="button"
        className="copy-card-btn btn-all"
        onClick={() => onCopyScreenBuffer(destinationMode)}
        title={destinationMode === 'clip' ? 'Copy visible screen buffer to mobile clipboard' : 'Open visible screen buffer in CodeMirror'}
      >
        <span>ALL</span>
      </button>

      <button
        type="button"
        className="copy-card-btn btn-cust"
        onClick={() => onCopyCustomLines(destinationMode, parsedLines)}
        title={destinationMode === 'clip' ? `Copy ${parsedLines} scrollback lines to mobile clipboard` : `Open ${parsedLines} scrollback lines in CodeMirror`}
      >
        <span>{custConfig.label || 'CUST'}</span>
      </button>

      <button
        type="button"
        className={`copy-card-toggle ${destinationMode}`}
        onClick={toggleDestination}
        title={`Destination Mode: ${destinationMode === 'clip' ? 'Direct Mobile Clipboard' : 'CodeMirror Inspector'}. Tap to toggle.`}
      >
        <span>{destinationMode === 'clip' ? 'CLIP' : 'CODE'}</span>
      </button>
    </div>
  );
}
