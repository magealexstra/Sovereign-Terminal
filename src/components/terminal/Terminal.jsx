import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ArrowDown, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ activeSession, voiceInput, onDataSent }) {
  const { theme } = useApp();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // High contrast terminal theme palette
    const termTheme = {
      background: '#0A1118',
      foreground: '#E6EDF0',
      cursor: '#88C0D0',
      cursorAccent: '#0A1118',
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
      fontSize: 15,
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

    // Try WebGL addon for hardware-accelerated 60fps rendering
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon fallback to 2D canvas', e);
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Delayed initial fit to ensure DOM dimensions are calculated correctly
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {}
    }, 100);

    // Automatic Copy-on-Select
    term.onSelectionChange(() => {
      const selection = term.getSelection();
      if (selection && selection.trim().length > 0) {
        navigator.clipboard.writeText(selection).then(() => {
          setCopyToast(true);
          setTimeout(() => setCopyToast(false), 2000);
        }).catch(() => {});
      }
    });

    // Scroll position listener for floating [ ⬇️ Bottom ] button
    term.onScroll(() => {
      if (term.buffer && term.buffer.active) {
        const isScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
        setShowScrollBottom(isScrolledUp);
      }
    });

    // Connect WebSocket to Sovereign Gateway
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

    // ResizeObserver for dynamic terminal resizing on screen/viewport changes
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

  // Handle Voice Input or Touch Bar key presses
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
    <div className="terminal-wrapper" style={{ position: 'relative', width: '100%', height: '100%', flex: 1, background: '#0A1118', overflow: 'hidden' }}>
      {/* Copy-on-Select Toast Alert */}
      {copyToast && (
        <div className="copy-toast">
          <Copy size={13} />
          <span>Copied to Clipboard</span>
        </div>
      )}

      {/* Terminal Viewport */}
      <div ref={terminalRef} className="terminal-container" style={{ width: '100%', height: '100%', padding: '4px' }} />

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
    </div>
  );
}
