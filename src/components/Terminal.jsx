import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ activeSession, voiceInput, onDataSent }) {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js instance with Dark Forest theme
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'Fira Code', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#090e08',
        foreground: '#f5f5f5',
        cursor: '#5b9bd5',
        cursorAccent: '#090e08',
        selectionBackground: 'rgba(91, 155, 213, 0.35)',
        black: '#182c16',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#5b9bd5',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f5f5f5',
        brightBlack: '#2d5a27',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#e9d5ff',
        brightCyan: '#7dd3fc',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Try WebGL acceleration for 60fps canvas rendering
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon could not be loaded, falling back to standard DOM renderer', e);
    }

    fitAddon.fit();
    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Welcome Banner
    term.writeln('\x1b[1;32m   ─── THE SOVEREIGN TERMINAL ───\x1b[0m');
    term.writeln('\x1b[90m   Verdant Archive System Control | Kattegat Bare-Metal Shell\x1b[0m');
    term.writeln('\x1b[90m   Connected to session: \x1b[36m' + activeSession + '\x1b[0m\r\n');
    term.write('$ ');

    // Handle user keystrokes
    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n$ ');
      } else if (data === '\x7f') {
        // Backspace
        term.write('\b \b');
      } else {
        term.write(data);
      }
      if (onDataSent) onDataSent(data);
    });

    // Window resize handler
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [activeSession]);

  // Inject voice input from Gboard tracker directly into terminal buffer
  useEffect(() => {
    if (voiceInput && xtermInstance.current) {
      xtermInstance.current.write(voiceInput);
    }
  }, [voiceInput]);

  return (
    <div className="terminal-wrapper">
      <div ref={terminalRef} className="terminal-container" />
    </div>
  );
}
