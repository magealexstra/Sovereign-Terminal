import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export default function Terminal({ session, isActive, isKeyboardOpen, voiceInput, onOpenFile, onCwdChange, onInspectText, rootDir }) {
  const { theme, fontSizeTerminal, tmuxSettings } = useApp();
  const { toast, showToast } = useToast();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  const selectionTimer = useRef(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const tmuxSettingsRef = useRef(tmuxSettings);
  tmuxSettingsRef.current = tmuxSettings;
  const lastSubagentSyncRef = useRef(0);
  const injectingRef = useRef(false);
  const lastColsRef = useRef(0);
  const lastRowsRef = useRef(0);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Single-Pipeline Guarded Resize Handshake
  const sendResizeHandshake = (force = false) => {
    if (!isActive) return;
    const sock = socketRef.current;
    const currentTerm = xtermInstance.current;
    if (sock && sock.readyState === WebSocket.OPEN && fitAddonInstance.current && currentTerm) {
      try {
        if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;
        
        fitAddonInstance.current.fit();
        const cols = currentTerm.cols;
        const rows = currentTerm.rows;
        
        if (cols && rows) {
          if (!force && cols === lastColsRef.current && rows === lastRowsRef.current) return;
          lastColsRef.current = cols;
          lastRowsRef.current = rows;
          sock.send(JSON.stringify({ type: 'resize', cols, rows, force_refresh: force }));
        }
      } catch (e) {}
    }
  };

  // VisualViewport API listener — triggers fitAddon on viewport scaling
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleVisualResize = () => {
      if (fitAddonInstance.current) {
        try {
          fitAddonInstance.current.fit();
        } catch (e) {}
      }
    };

    window.visualViewport.addEventListener('resize', handleVisualResize);
    return () => {
      window.visualViewport.removeEventListener('resize', handleVisualResize);
    };
  }, []);

  // Live font size updates: let fitAddon.fit() own the resize completely
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = fontSizeTerminal || 14;
      if (fitAddonInstance.current && socketRef.current?.readyState === WebSocket.OPEN) {
        setTimeout(() => {
          sendResizeHandshake(true);
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
      const runFit = (force = false) => {
        try {
          if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;

          if (xtermInstance.current) {
            try {
              xtermInstance.current.clearTextureAtlas();
            } catch (e) {}
          }

          fitAddonInstance.current.fit();
          xtermInstance.current.refresh(0, xtermInstance.current.rows - 1);
          xtermInstance.current.scrollToBottom();
          xtermInstance.current.focus();

          sendResizeHandshake(force);
        } catch (e) {}
      };

      runFit(true);
      const timer = setTimeout(() => runFit(true), 150);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isActive, session?.id, isKeyboardOpen]);

  useEffect(() => {
    const handleGlobalFocus = () => {
      if (injectingRef.current) return;
      if (isActive && xtermInstance.current) {
        xtermInstance.current.focus();
      }
    };
    window.addEventListener('terminal-focus', handleGlobalFocus);
    return () => window.removeEventListener('terminal-focus', handleGlobalFocus);
  }, [isActive]);

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

  // Main terminal lifecycle — runs once per mounted instance.
  // App.jsx uses key={sess.id} so each session gets its own component instance.
  useEffect(() => {
    if (!terminalRef.current) return;
    let isMounted = true;

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

    // Custom File Path Link Router (rootDir/..., /app/..., ./...)
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const lineText = term.buffer.active?.getLine(bufferLineNumber - 1)?.translateToString(true);
        if (!lineText) { callback([]); return; }
        const escapedRoot = (rootDir || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:${escapedRoot}|/app|\\./|\\.\\./)[^\\s:\\x1b'"]+\\.[a-zA-Z0-9]+`, 'g');
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
      // Force Gboard to drop composition buffer and predictive text ribbon
      term.textarea.setAttribute('inputmode', 'email');

      term.textarea.addEventListener('blur', (e) => {
        if (injectingRef.current) return;
        // Do NOT reclaim focus if Master Macro Modal is active in DOM
        if (document.body.querySelector('.macro-modal-overlay')) return;
        const target = e.relatedTarget;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return; // Let the Stager or other input take focus
        }
        if (isActiveRef.current) {
          // Reclaim focus aggressively to prevent keyboard dismissal ONLY while terminal tab is active and no macro modal is open
          setTimeout(() => {
            if (injectingRef.current || !isActiveRef.current) return;
            if (document.body.querySelector('.macro-modal-overlay')) return;
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
      document.fonts.ready
        .then(() => {
          if (isMounted) performFit();
        })
        .catch(() => {});
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

    // ── Stream parsing for auto-spawning subagents check ────────────────────
    let parseDebounceTimer = null;
    const parseDisposable = term.onWriteParsed(() => {
      if (parseDebounceTimer) clearTimeout(parseDebounceTimer);
      parseDebounceTimer = setTimeout(() => {
        if (tmuxSettingsRef.current?.autoSpawnSubagents) {
          const buffer = term.buffer.active;
          if (buffer) {
            const startLine = Math.max(0, buffer.length - 4);
            const text = extractBufferRange(buffer, startLine, buffer.length);
            if (/Agent\([^)]+\)/.test(text) || /\d+\s+subagent\(s\)/.test(text)) {
              const now = Date.now();
              if (now - lastSubagentSyncRef.current >= 20000) {
                lastSubagentSyncRef.current = now;
                let activeIds = [];
                try {
                  const raw = localStorage.getItem('sovereign_active_session_ids');
                  activeIds = raw ? JSON.parse(raw) : [];
                } catch {}
                fetch('/api/terminal/sessions/sync-subagents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ active: activeIds }),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (data && Array.isArray(data.new_sessions)) {
                      data.new_sessions.forEach((sess) => {
                        window.dispatchEvent(
                          new CustomEvent('sovereign_attach_session', {
                            detail: { sessionName: sess },
                          })
                        );
                      });
                    }
                  })
                  .catch(() => {});
              }
            }
          }
        }
      }, 1000);
    });

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
      if (parsed.startsWith('/') || parsed.startsWith('~')) {
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
      if (parseDebounceTimer) clearTimeout(parseDebounceTimer);
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      try { parseDisposable.dispose(); } catch (e) {}
      resizeObserver.disconnect();
      containerEl.removeEventListener('touchstart', handleTouchStart);
      containerEl.removeEventListener('touchmove', handleTouchMove);
      containerEl.removeEventListener('touchend', handleTouchEnd);
      if (socketRef.current) socketRef.current.close();
      try { term.dispose(); } catch (e) {}
    };
  }, []);



  useEffect(() => {
    if (!isActive) return; // Strict guard: ONLY active visible tab receives macro/CD inputs
    if (voiceInput) {
      if (typeof voiceInput === 'object') {
        const { text, executeImmediately } = voiceInput;
        injectingRef.current = true;
        try {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(text);
            if (executeImmediately) {
              socketRef.current.send('\r');
            }
          }
        } catch (e) {
          console.error('Injection error:', e);
        } finally {
          if (xtermInstance.current) {
            xtermInstance.current.focus();
          }
          setTimeout(() => {
            injectingRef.current = false;
          }, 100);
        }
      } else {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(voiceInput);
        }
      }
    }
  }, [voiceInput, isActive]);


  // Buffer extraction handlers for CopyCard
  const handleCopyLastOutput = useCallback((mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const maxLines = Math.min(buffer.length, 60);
    const startLine = Math.max(0, buffer.length - maxLines);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast('Copied Last Output to Clipboard')).catch(() => showToast('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, 'Last Command Output');
    }
  }, [onInspectText, showToast]);

  const handleCopyScreenBuffer = useCallback((mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const startLine = buffer.viewportY || 0;
    const endLine = Math.min(buffer.length, startLine + term.rows);
    const text = extractBufferRange(buffer, startLine, endLine);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast('Copied Screen Buffer to Clipboard')).catch(() => showToast('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, 'Screen Buffer');
    }
  }, [onInspectText, showToast]);

  const handleCopyCustomLines = useCallback((mode, linesOverride) => {
    if (!xtermInstance.current) return;
    let customCount = typeof linesOverride === 'number' ? linesOverride : 50;

    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const lineCount = (customCount === 0 || customCount > buffer.length) ? buffer.length : customCount;
    const startLine = Math.max(0, buffer.length - lineCount);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToast(`Copied ${lineCount} Lines to Clipboard`)).catch(() => showToast('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, `Custom ${lineCount} Lines`);
    }
  }, [onInspectText, showToast]);

  const scrollToBottom = () => {
    if (xtermInstance.current) {
      xtermInstance.current.scrollToBottom();
      setShowScrollBottom(false);
    }
  };

  return (
    <div className="terminal-wrapper" onClick={() => xtermInstance.current?.focus()}>
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
