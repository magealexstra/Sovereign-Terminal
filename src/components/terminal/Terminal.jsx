import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ArrowDown, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ activeSession, voiceInput, onDataSent }) {
  const { theme, fontSizeTerminal } = useApp();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  // Dynamic font size updates across xterm instance
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = fontSizeTerminal || 14;
      if (fitAddonInstance.current) {
        try {
          fitAddonInstance.current.fit();
        } catch (e) {}
      }
    }
  }, [fontSizeTerminal]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // High contrast terminal theme palette
    const termTheme = {
      background: theme?.bgEarth || '#141E26',
      foreground: theme?.textParchment || '#E6EDF0',
      cursor: theme?.accentHighlight || '#88C0D0',
      cursorAccent: theme?.bgEarth || '#141E26',
      selectionBackground: 'rgba(136, 192, 208, 0.4)',
      black: '#3B4252',
      red: '#BF616A',
      green: '#A3BE8C',
      yellow: '#EBCB8B',
      blue: '#81A1C1',
      magenta: '#B48EAD',
      cyan: '#88C0D0',
      white: '#E5E9F0',
      brightBlack: '#4C566A',
      brightRed: '#D08770',
      brightGreen: '#A3BE8C',
      brightYellow: '#EBCB8B',
      brightBlue: '#5E81AC',
      brightMagenta: '#B48EAD',
      brightCyan: '#8FBCBB',
      brightWhite: '#ECEFF4',
    };

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontSize: fontSizeTerminal || 14,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: termTheme,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((evt, url) => {
      window.open(url, '_blank');
    });

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon fallback to 2D canvas', e);
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 100);

    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection && selection.trim().length > 0) {
        navigator.clipboard.writeText(selection).then(() => {
          setCopyToast(true);
          setTimeout(() => setCopyToast(false), 2000);
        }).catch(() => {});
      }
    });

    term.onScroll(() => {
      if (term.buffer && term.buffer.active) {
        const isScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
        setShowScrollBottom(isScrolledUp);
      }
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:2068/ws/terminal?session=${activeSession}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      const { cols, rows } = fitAddon;
      socket.send(JSON.stringify({ type: 'resize', cols: cols || 80, rows: rows || 24 }));
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    socket.onclose = () => {
      term.writeln('\r\n\x1b[31m[Disconnected from Gateway. Reconnecting...]\x1b[0m');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (socket.readyState === WebSocket.OPEN) {
          const { cols, rows } = fitAddon;
          socket.send(JSON.stringify({ type: 'resize', cols: cols || 80, rows: rows || 24 }));
        }
      } catch (e) {}
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (socket) socket.close();
      term.dispose();
    };
  }, [activeSession]);

  useEffect(() => {
    if (voiceInput && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(voiceInput);
    }
  }, [voiceInput]);

  const scrollToBottom = () => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToBottom();
      setShowScrollBottom(false);
    }
  };

  return (
    <div className="terminal-wrapper" style={{ position: 'relative', width: '100%', height: '100%', flex: 1, background: theme?.bgEarth || '#141E26', overflow: 'hidden' }}>
      {copyToast && (
        <div className="copy-toast">
          <Copy size={13} />
          <span>Copied to Clipboard</span>
        </div>
      )}

      <div ref={terminalRef} className="terminal-container" style={{ width: '100%', height: '100%', padding: '4px' }} />

      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
    </div>
  );
}
