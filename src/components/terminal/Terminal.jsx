import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ArrowDown, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/useToast';
import { getTermTheme } from './terminal/termTheme';
import { writeToClipboard } from './terminal/writeToClipboard';
import CopyCard from './CopyCard';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ session, isActive, isKeyboardOpen, voiceInput, onOpenFile, onCwdChange, onInspectText }) {
  const { theme, fontSizeTerminal } = useApp();
  const { toast, showToast } = useToast();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  const selectionTimer = useRef(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Live font size updates: let fitAddon.fit() own the resize completely
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = fontSizeTerminal || 14;
      if (fitAddonInstance.current && socketRef.current?.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          try {
            fitAddonInstance.current.fit();
            const { cols, rows } = fitAddonInstance.current;
            if (cols && rows) {
              socketRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
            }
          } catch (e) {}
        }, 100);
      }
    }
  }, [fontSizeTerminal]);

  // Live color theme updates
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getTermTheme(theme);
    }
  }, [theme]);

  // Re-fit, focus, and scroll when this session becomes the active visible tab.
  // Two-stage: rAF catches the immediate layout, setTimeout(50) catches cases where
  // display:flex hasn't reflowed yet by the first animation frame.
  useEffect(() => {
    if (isActive && fitAddonInstance.current && xtermInstance.current) {
      const activate = () => {
        try {
          if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;
          fitAddonInstance.current.fit();
          xtermInstance.current.refresh(0, xtermInstance.current.rows - 1);
          xtermInstance.current.scrollToBottom();
          xtermInstance.current.focus();

          const sock = socketRef.current;
          if (sock && sock.readyState === WebSocket.OPEN && fitAddonInstance.current) {
            const { cols, rows } = fitAddonInstance.current;
            if (cols && rows) sock.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        } catch (e) {}
      };
      requestAnimationFrame(activate);
      setTimeout(activate, 50);
      setTimeout(activate, 150);
    }
  }, [isActive]);

  useEffect(() => {
    const handleGlobalFocus = () => {
      if (isActive && xtermInstance.current) {
        xtermInstance.current.focus();
      }
    };
    window.addEventListener('terminal-focus', handleGlobalFocus);
    return () => window.removeEventListener('terminal-focus', handleGlobalFocus);
  }, [isActive]);

  // Main terminal lifecycle — runs once per mounted instance.
  // App.jsx uses key={sess.id} so each session gets its own component instance.
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

    // Custom File Path Link Router (/workspace/..., /app/..., ./...)
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const lineText = term.buffer.active?.getLine(bufferLineNumber - 1)?.translateToString(true);
        if (!lineText) { callback([]); return; }
        const regex = /(?:\/workspace|\/app|\.\/|\.\.\/)[^\s:\x1b'"]+\.[a-zA-Z0-9]+/g;
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
            activate: (evt, text) => { if (onOpenFile) onOpenFile(text); }
          });
        }
        callback(links);
      }
    });

    term.open(terminalRef.current);

    if (term.textarea) {
      // Non-disruptive attributes to disable auto-capitalization and spellcheck desync
      term.textarea.setAttribute('autocorrect', 'off');
      term.textarea.setAttribute('autocapitalize', 'none');
      term.textarea.setAttribute('spellcheck', 'false');
      term.textarea.setAttribute('autocomplete', 'off');

      term.textarea.addEventListener('blur', (e) => {
        const target = e.relatedTarget;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return; // Let the other input take focus
        }
        if (isActiveRef.current) {
          // Reclaim focus aggressively to prevent keyboard dismissal
          setTimeout(() => {
            if (term.textarea) term.focus();
          }, 10);
        }
      });
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // performFit: fitAddon.fit() is the single source of truth for sizing.
    // Guard: skip if the container has zero height (display:none parent) to
    // avoid fitting a hidden terminal and sending a bad resize to the backend.
    const performFit = () => {
      requestAnimationFrame(() => {
        try {
          if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;
          fitAddon.fit();
          term.refresh(0, term.rows - 1);
        } catch (e) {}
      });
    };

    // Initial fit pulses — lets the DOM fully paint the flex layout before measuring
    setTimeout(performFit, 50);
    setTimeout(performFit, 200);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        performFit();
      });
    }

    // Debounced Copy-on-Select Clipboard Handler
    term.onSelectionChange(() => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      selectionTimer.current = setTimeout(() => {
        const selection = term.getSelection();
        if (selection && selection.trim().length > 0) {
          writeToClipboard(selection).then(() => {
            showToast('Copied to Clipboard');
          }).catch(() => {
            showToast('Copied to Clipboard');
          });
        }
      }, 300);
    });

    term.onScroll(() => {
      if (term.buffer && term.buffer.active) {
        const isScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
        setShowScrollBottom(isScrolledUp);
      }
    });

    // ── Touch Swipe-to-Scroll (ttyd pattern) ───────────────────────────────
    // Send SGR mouse-wheel escape sequences through the live WebSocket.
    // tmux receives these as real mouse wheel events and enters/scrolls
    // copy-mode — the same mechanism that makes ttyd-mobile scroll work.
    //
    // touchmove is NON-PASSIVE so we can call e.preventDefault().
    // The terminal is an xterm canvas — the browser sees no CSS scroll
    // container inside it. Without preventDefault, when tmux hits the
    // bottom of its buffer and the user continues swiping, the browser
    // immediately chains the scroll to the document and pans the page.
    // overscroll-behavior:none only stops bounce at the edge of an
    // existing CSS scroll container, which the canvas is not.
    // e.preventDefault() cancels the browser's scroll gesture for the
    // full touch sequence; our SGR codes go via WebSocket unaffected.
    // xterm tap/focus/selection use touchstart & touchend directly, so
    // preventing the browser default on touchmove does not break them.
    const SCROLL_SENSITIVITY = 36; // px per scroll tick (matches ttyd-mobile)
    let touchStartYLocal = 0;
    let touchAccumLocal = 0;

    const sendMouseScroll = (up) => {
      const sock = socketRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        // SGR mouse wheel: \x1b[<65;col;rowM = scroll up, \x1b[<64;col;rowM = scroll down
        sock.send(up ? '\x1b[<65;1;1M' : '\x1b[<64;1;1M');
      }
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartYLocal = e.touches[0].clientY;
        touchAccumLocal = 0;
      }
    };

    const handleTouchMove = (e) => {
      // Prevent the browser from scrolling the document while touching the
      // terminal. The canvas has no CSS scroll container, so without this
      // the browser would chain any unhandled pan gesture to the document.
      e.preventDefault();
      if (e.touches.length !== 1) return;
      const diffY = touchStartYLocal - e.touches[0].clientY;
      touchAccumLocal += diffY;
      touchStartYLocal = e.touches[0].clientY;

      while (Math.abs(touchAccumLocal) >= SCROLL_SENSITIVITY) {
        if (touchAccumLocal > 0) {
          sendMouseScroll(true);  // swipe up → scroll up (older content)
          touchAccumLocal -= SCROLL_SENSITIVITY;
        } else {
          sendMouseScroll(false); // swipe down → scroll down (newer content)
          touchAccumLocal += SCROLL_SENSITIVITY;
        }
      }
    };

    const handleTouchEnd = () => { touchAccumLocal = 0; };

    const containerEl = terminalRef.current;
    containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerEl.addEventListener('touchmove', handleTouchMove, { passive: false }); // non-passive: needs preventDefault
    containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    // ── WebSocket with auto-reconnect ────────────────────────────────────────
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sessionId = session?.id || 'main';
    const cwdParam = session?.initialCwd ? `&cwd=${encodeURIComponent(session.initialCwd)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?session=${sessionId}${cwdParam}`;

    let reconnectAttempts = 0;
    const maxReconnects = 10;
    let reconnectTimeout = null;
    let isMounted = true;

    // sendResizeHandshake always reads socketRef.current so it works after reconnects
    const sendResizeHandshake = () => {
      const sock = socketRef.current;
      const currentTerm = xtermInstance.current;
      if (sock && sock.readyState === WebSocket.OPEN && fitAddonInstance.current && currentTerm) {
        try {
          if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;
          
          fitAddonInstance.current.fit();
          const cols = currentTerm.cols;
          const rows = currentTerm.rows;
          
          if (cols && rows) {
            sock.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        } catch (e) {}
      }
    };

    const connect = () => {
      if (!isMounted) return;
      const el = terminalRef.current;
      if (!el || el.clientHeight === 0) {
        // Container not painted yet — delay connect until next layout frame
        requestAnimationFrame(() => setTimeout(connect, 50));
        return;
      }

      const sock = new WebSocket(wsUrl);
      socketRef.current = sock;

      sock.onopen = () => {
        reconnectAttempts = 0;
      };

      sock.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data.startsWith('{')) {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'ready') {
              performFit();
              sendResizeHandshake();
              return;
            }
          } catch (e) {}
        }
        term.write(event.data);
      };
      sock.onerror = (err) => { console.error('WebSocket Error:', err); };

      sock.onclose = () => {
        // Bail out if component unmounted or a newer socket has superseded this one
        if (!isMounted || socketRef.current !== sock) return;
        if (reconnectAttempts < maxReconnects) {
          reconnectAttempts++;
          const delay = Math.min(reconnectAttempts * 1000, 5000);
          term.writeln(
            `\r\n\x1b[33m[Connection lost — reconnecting in ${delay / 1000}s` +
            ` (${reconnectAttempts}/${maxReconnects})]\x1b[0m`
          );
          reconnectTimeout = setTimeout(connect, delay);
        } else {
          term.writeln('\r\n\x1b[31m[Could not reconnect. Close and reopen this tab to try again.]\x1b[0m');
        }
      };
    };

    connect();

    // term.onData uses socketRef.current so it targets the live socket after any reconnect
    term.onData((data) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    // Report shell title/CWD changes to parent App state
    term.onTitleChange((title) => {
      if (!title || !onCwdChange) return;
      let parsed = title.trim();
      if (parsed.includes(':')) {
        parsed = parsed.split(':').pop().trim();
      }
      if (parsed.startsWith('~')) {
        parsed = parsed.replace('~', '/home/magealexstra');
      }
      if (parsed.startsWith('/')) {
        onCwdChange(parsed);
      }
    });

    // ── ResizeObserver ───────────────────────────────────────────────────────
    let resizeDebounce = null;
    const handleResize = () => {
      performFit();
      clearTimeout(resizeDebounce);
      resizeDebounce = setTimeout(() => {
        sendResizeHandshake();
      }, 150);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) resizeObserver.observe(terminalRef.current);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      clearTimeout(resizeDebounce);
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      resizeObserver.disconnect();
      containerEl.removeEventListener('touchstart', handleTouchStart);
      containerEl.removeEventListener('touchmove', handleTouchMove);
      containerEl.removeEventListener('touchend', handleTouchEnd);
      if (socketRef.current) socketRef.current.close();
      try { term.dispose(); } catch (e) {}
    };
  }, []);

  // isKeyboardOpen is a prop that changes over time, but the ResizeObserver closure
  // captures the initial value. Use a ref so the closure always reads the latest.
  const isKeyboardOpenRef = useRef(isKeyboardOpen);
  isKeyboardOpenRef.current = isKeyboardOpen;

  // When keyboard state changes, pulse the resize logic to ensure we catch
  // the exact resting height after the mobile browser animation finishes.
  useEffect(() => {
    if (fitAddonInstance.current) {
      const pulseFit = () => {
        try {
          fitAddonInstance.current.fit();
          const { cols, rows } = fitAddonInstance.current;
          if (cols && rows && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        } catch (e) {}
      };
      
      pulseFit();
      setTimeout(pulseFit, 150);
      setTimeout(pulseFit, 350);
      setTimeout(pulseFit, 650);
    }
  }, [isKeyboardOpen]);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return; // Strict guard: ONLY active visible tab receives macro/CD inputs
    if (voiceInput && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(voiceInput);
    }
  }, [voiceInput, isActive]);

  // Helper: extracts buffer lines and intelligently joins soft-wrapped lines
  const extractBufferRange = (buffer, startLine, endLine) => {
    let result = '';
    for (let i = startLine; i < endLine; i++) {
      const line = buffer.getLine(i);
      if (!line) continue;
      const str = line.translateToString(true);
      if (line.isWrapped && result.length > 0) {
        result += str;
      } else {
        result += (result.length > 0 ? '\n' : '') + str;
      }
    }
    return result.trim();
  };

  // Buffer extraction handlers for CopyCard
  const handleCopyLastOutput = (mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const maxLines = Math.min(buffer.length, 60);
    const startLine = Math.max(0, buffer.length - maxLines);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast('Copied Last Output to Clipboard')).catch(() => showToast('Copied Last Output'));
    } else if (onInspectText) {
      onInspectText(text, 'Last Command Output');
    }
  };

  const handleCopyScreenBuffer = (mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const startLine = buffer.viewportY || 0;
    const endLine = Math.min(buffer.length, startLine + term.rows);
    const text = extractBufferRange(buffer, startLine, endLine);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast('Copied Screen Buffer to Clipboard')).catch(() => showToast('Copied Screen Buffer'));
    } else if (onInspectText) {
      onInspectText(text, 'Screen Buffer');
    }
  };

  const handleCopyCustomLines = (mode, linesOverride) => {
    if (!xtermInstance.current) return;
    let customCount = typeof linesOverride === 'number' ? linesOverride : 50;

    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const lineCount = (customCount === 0 || customCount > buffer.length) ? buffer.length : customCount;
    const startLine = Math.max(0, buffer.length - lineCount);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast(`Copied ${lineCount} Lines to Clipboard`)).catch(() => showToast(`Copied ${lineCount} Lines`));
    } else if (onInspectText) {
      onInspectText(text, `Custom ${lineCount} Lines`);
    }
  };

  const scrollToBottom = () => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToBottom();
      setShowScrollBottom(false);
    }
  };

  return (
    <div className="terminal-wrapper">
      {toast && (
        <div className="copy-toast">
          <Copy size={13} />
          <span>{toast}</span>
        </div>
      )}

      {isActive && (
        <CopyCard
          onCopyLastOutput={handleCopyLastOutput}
          onCopyScreenBuffer={handleCopyScreenBuffer}
          onCopyCustomLines={handleCopyCustomLines}
        />
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
