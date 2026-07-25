import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ArrowDown, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ activeSession, voiceInput, onOpenFile }) {
  const { theme, fontSizeTerminal } = useApp();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  const selectionTimer = useRef(null);
  
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  // Helper to generate xterm theme object from AppContext palette
  const getTermTheme = (currentTheme) => ({
    background: currentTheme?.bgEarth || '#141E26',
    foreground: currentTheme?.textParchment || '#E6EDF0',
    cursor: currentTheme?.accentHighlight || '#88C0D0',
    cursorAccent: currentTheme?.bgEarth || '#141E26',
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
  });

  // Live font size updates across active xterm instance
  useEffect(() => {
    if (xtermInstance.current && fitAddonInstance.current) {
      xtermInstance.current.options.fontSize = fontSizeTerminal || 14;
      requestAnimationFrame(() => {
        try {
          fitAddonInstance.current.fit();
          xtermInstance.current.refresh(0, xtermInstance.current.rows - 1);
        } catch (e) {}
      });
    }
  }, [fontSizeTerminal]);

  // Live color theme updates across active xterm instance
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getTermTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontSize: fontSizeTerminal || 14,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: getTermTheme(theme),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((evt, url) => {
      window.open(url, '_blank');
    });

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // Custom File Path Link Router (/workspace/..., /Heimr/..., ./...)
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const lineText = term.buffer.active?.getLine(bufferLineNumber - 1)?.translateToString(true);
        if (!lineText) {
          callback([]);
          return;
        }
        const regex = /(?:\/workspace|\/Heimr|\.\/|\.\.\/)[^\s:\x1b'"]+\.[a-zA-Z0-9]+/g;
        const links = [];
        let match;
        while ((match = regex.exec(lineText)) !== null) {
          const pathText = match[0];
          const startIdx = match.index;
          links.push({
            range: {
              start: { x: startIdx + 1, y: bufferLineNumber },
              end: { x: startIdx + pathText.length, y: bufferLineNumber }
            },
            text: pathText,
            activate: (evt, text) => {
              if (onOpenFile) {
                onOpenFile(text);
              }
            }
          });
        }
        callback(links);
      }
    });

    term.open(terminalRef.current);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon fallback to 2D canvas', e);
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    const performFit = () => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
          term.refresh(0, term.rows - 1);
        } catch (e) {}
      });
    };

    setTimeout(performFit, 50);
    setTimeout(performFit, 200);

    // Debounced Copy-on-Select Clipboard Handler
    term.onSelectionChange(() => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      selectionTimer.current = setTimeout(() => {
        const selection = term.getSelection();
        if (selection && selection.trim().length > 0) {
          navigator.clipboard.writeText(selection).then(() => {
            setCopyToast(true);
            setTimeout(() => setCopyToast(false), 2000);
          }).catch(() => {});
        }
      }, 300);
    });

    term.onScroll(() => {
      if (term.buffer && term.buffer.active) {
        const isScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
        setShowScrollBottom(isScrolledUp);
      }
    });

    // Retaining Port 2068 for testing environment compatibility
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:2068/ws/terminal?session=${activeSession}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const sendResizeHandshake = () => {
      if (socket.readyState === WebSocket.OPEN && fitAddon) {
        fitAddon.fit();
        const { cols, rows } = fitAddon;
        if (cols && rows) {
          socket.send(JSON.stringify({ type: 'resize', cols: cols, rows: rows }));
        }
      }
    };

    socket.onopen = () => {
      sendResizeHandshake();
      socket.send('\r');
      setTimeout(sendResizeHandshake, 250);
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

    const handleResize = () => {
      performFit();
      sendResizeHandshake();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      resizeObserver.disconnect();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
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
    <div className="terminal-wrapper">
      {copyToast && (
        <div className="copy-toast">
          <Copy size={13} />
          <span>Copied to Clipboard</span>
        </div>
      )}

      <div ref={terminalRef} className="terminal-container" />

      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
    </div>
  );
}
