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

// Reads the lines [startLine, endLine) of a terminal buffer as text, joining soft-wrapped lines
// back into the one line they were before wrapping.
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

// Where a tap on the terminal goes: 'stager' opens the command stager, anything else focuses xterm.
const readTapMode = () => {
  try {
    return localStorage.getItem('sovereign_stager_tap_redirect') || 'stager';
  } catch {
    return 'stager';
  }
};

// Matches a file path under the working root (or /app, ./ and ../) inside one terminal line.
const buildLinkRegex = (rootDir) => {
  const alternatives = ['/app', '\\./', '\\.\\./'];
  if (rootDir) alternatives.unshift(rootDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:${alternatives.join('|')})[^\\s:\\x1b'"]+\\.[a-zA-Z0-9]+`, 'g');
};

export default function Terminal({ session, isActive, isKeyboardOpen, voiceInput, onOpenFile, onCwdChange, onInspectText, rootDir }) {
  const { theme, fontSizeTerminal, tmuxSettings, terminalBgLightness, terminalMixColor } = useApp();
  const { toast, showToast } = useToast();
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const socketRef = useRef(null);
  const isSwipingRef = useRef(false);
  const selectionTimer = useRef(null);
  const fontTimerRef = useRef(null);
  const injectTimerRef = useRef(null);
  const backspaceTimerRef = useRef(null);
  // The lifecycle effect runs once, so it reads props and the toast function through refs to see the latest.
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const rootDirRef = useRef(rootDir);
  rootDirRef.current = rootDir;
  const onOpenFileRef = useRef(onOpenFile);
  onOpenFileRef.current = onOpenFile;
  const onCwdChangeRef = useRef(onCwdChange);
  onCwdChangeRef.current = onCwdChange;
  const lastFitKeyRef = useRef('');
  const tmuxSettingsRef = useRef(tmuxSettings);
  tmuxSettingsRef.current = tmuxSettings;
  const lastSubagentSyncRef = useRef(0);
  const injectingRef = useRef(false);
  const lastColsRef = useRef(0);
  const lastRowsRef = useRef(0);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const connectRef = useRef(null);

  // Fits the terminal and tells the server its size. Only the active, visible session sends; without
  // force it sends only when the size changed.
  const sendResizeHandshake = (force = false) => {
    if (!isActiveRef.current) return;
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
      } catch {
        // A failed fit or send leaves the old size in place; the next resize or tab switch retries.
      }
    }
  };

  // Re-fits the active terminal when the visual viewport scales (soft keyboard, pinch zoom).
  // Hidden sessions skip it; they re-fit when they become active.
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleVisualResize = () => {
      if (fitAddonInstance.current && isActiveRef.current) {
        try {
          fitAddonInstance.current.fit();
        } catch {
          // The terminal may be mid-teardown or hidden; there is nothing to fit.
        }
      }
    };

    window.visualViewport.addEventListener('resize', handleVisualResize);
    return () => {
      window.visualViewport.removeEventListener('resize', handleVisualResize);
    };
  }, []);

  // Applies a font size change and, after a short pause, refits and tells the server the new size.
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = fontSizeTerminal || 14;
      if (fitAddonInstance.current && socketRef.current?.readyState === WebSocket.OPEN) {
        if (fontTimerRef.current) clearTimeout(fontTimerRef.current);
        fontTimerRef.current = setTimeout(() => {
          sendResizeHandshake(true);
        }, 100);
      }
    }
    return () => { if (fontTimerRef.current) clearTimeout(fontTimerRef.current); };
  }, [fontSizeTerminal]);

  // Applies theme and surface-mix changes to the running terminal.
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getTermTheme(theme, terminalBgLightness, terminalMixColor);
    }
  }, [theme, terminalBgLightness, terminalMixColor]);

  // Re-fits, focuses and scrolls when this session becomes the active tab or the keyboard opens or closes.
  // Reconnects if the socket was lost while inactive. The server is asked to redraw only on a tab switch;
  // a keyboard change alters the size, which the resize message already carries.
  useEffect(() => {
    const fitKey = `${session?.id}:${isActive}`;
    const isSwitch = lastFitKeyRef.current !== fitKey;
    lastFitKeyRef.current = fitKey;

    if (isActive) {
      const isSocketDead = !socketRef.current ||
        socketRef.current.readyState === WebSocket.CLOSED ||
        socketRef.current.readyState === WebSocket.CLOSING;

      if (isSocketDead && connectRef.current) {
        connectRef.current();
      }

      if (fitAddonInstance.current && xtermInstance.current) {
        const runFit = (force = false) => {
          try {
            if (!terminalRef.current || terminalRef.current.clientHeight === 0) return;

            fitAddonInstance.current.fit();
            xtermInstance.current.refresh(0, xtermInstance.current.rows - 1);
            xtermInstance.current.scrollToBottom();
            if (!document.body.querySelector('.staging-drawer-container') && !document.body.querySelector('.macro-modal-overlay')) {
              xtermInstance.current.focus();
            }

            sendResizeHandshake(force);
          } catch {
            // The terminal may have been disposed since the timer was set.
          }
        };

        runFit(isSwitch);
        const timer = setTimeout(() => runFit(isSwitch), 150);

        return () => {
          clearTimeout(timer);
        };
      }
    }
  }, [isActive, session?.id, isKeyboardOpen]);

  // Reconnects a dead socket when the page becomes visible again (phone unlock, returning to the browser tab).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        const isSocketDead = !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED ||
          socketRef.current.readyState === WebSocket.CLOSING;
        if (isSocketDead && connectRef.current) {
          connectRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Focuses the terminal on request unless a modal or the stager is open.
  useEffect(() => {
    const handleGlobalFocus = () => {
      if (injectingRef.current) return;
      if (document.body.querySelector('.macro-modal-overlay') || document.body.querySelector('.staging-drawer-container')) return;
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
    let isMounted = true;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      fontSize: fontSizeTerminal || 14,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: getTermTheme(theme, terminalBgLightness, terminalMixColor),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((evt, url) => {
      window.open(url, '_blank');
    });

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    // File path links (working root, /app, ./ and ../). The root and the open-file callback are read
    // through refs so a root that arrives after mount is used; the pattern is rebuilt only when it changes.
    let linkRegex = null;
    let linkRegexRoot = null;
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const lineText = term.buffer.active?.getLine(bufferLineNumber - 1)?.translateToString(true);
        if (!lineText) { callback([]); return; }
        const root = rootDirRef.current || '';
        if (!linkRegex || linkRegexRoot !== root) {
          linkRegex = buildLinkRegex(root);
          linkRegexRoot = root;
        }
        const regex = linkRegex;
        regex.lastIndex = 0;
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
            activate: (evt, text) => { if (onOpenFileRef.current) onOpenFileRef.current(text); }
          });
        }
        callback(links);
      }
    });

    term.open(terminalRef.current);

    let handleTextareaBlur = null;
    let refocusTimer = null;
    if (term.textarea) {
      // Attributes that turn off auto-capitalization, autocorrect and spellcheck on the input
      term.textarea.setAttribute('autocorrect', 'off');
      term.textarea.setAttribute('autocapitalize', 'none');
      term.textarea.setAttribute('spellcheck', 'false');
      term.textarea.setAttribute('autocomplete', 'off');
      // Makes Gboard drop its composition buffer and predictive text ribbon
      term.textarea.setAttribute('inputmode', 'email');

      handleTextareaBlur = (e) => {
        if (injectingRef.current) return;
        // Do NOT reclaim focus if Master Macro Modal, Command Stager, or Copy Card is active in DOM
        if (document.body.querySelector('.macro-modal-overlay') || 
            document.body.querySelector('.staging-drawer-container') ||
            document.body.querySelector('.copy-card-container')) return;
        const target = e.relatedTarget;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest?.('.copy-card-container'))) {
          return; // Let the Stager, copy card, or other input take focus
        }
        if (isActiveRef.current) {
          // Reclaim focus aggressively to prevent keyboard dismissal ONLY while terminal tab is active and no modal/stager is open
          clearTimeout(refocusTimer);
          refocusTimer = setTimeout(() => {
            if (injectingRef.current || !isActiveRef.current) return;
            if (document.body.querySelector('.macro-modal-overlay') || 
                document.body.querySelector('.staging-drawer-container') ||
                document.body.querySelector('.copy-card-container')) return;
            if (term.textarea) term.focus();
          }, 10);
        }
      };
      term.textarea.addEventListener('blur', handleTextareaBlur);
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // performFit: fitAddon.fit() is the single source of truth for sizing, run on the next frame and
    // coalesced so several requests in one frame fit once. It skips a container with zero height
    // (display:none parent) so a hidden terminal is never fitted and no bad size reaches the server.
    let fitFrame = 0;
    const performFit = () => {
      if (fitFrame) return;
      fitFrame = requestAnimationFrame(() => {
        fitFrame = 0;
        try {
          if (!isMounted || !terminalRef.current || terminalRef.current.clientHeight === 0) return;
          fitAddon.fit();
          term.refresh(0, term.rows - 1);
        } catch {
          // The terminal may have been disposed between the request and the frame.
        }
      });
    };

    // Initial fit pulses let the flex layout finish painting before it is measured
    const initialFitTimers = [setTimeout(performFit, 50), setTimeout(performFit, 200)];

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          if (isMounted) performFit();
        })
        .catch(() => {});
    }

    // Copies the selection to the clipboard 300 ms after it stops changing.
    const selectionDisposable = term.onSelectionChange(() => {
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      selectionTimer.current = setTimeout(() => {
        const selection = term.getSelection();
        if (selection && selection.trim().length > 0) {
          writeToClipboard(selection).then(() => {
            showToastRef.current('Copied to Clipboard');
          }).catch(() => {
            showToastRef.current('Failed to copy to clipboard');
          });
        }
      }, 300);
    });

    const scrollDisposable = term.onScroll(() => {
      if (term.buffer && term.buffer.active) {
        const isScrolledUp = term.buffer.active.viewportY < term.buffer.active.baseY;
        setShowScrollBottom(isScrolledUp);
      }
    });

    // Touch swipe-to-scroll: a swipe sends SGR mouse-wheel escape sequences through the live
    // WebSocket. tmux receives them as real mouse wheel events and enters or scrolls copy-mode.
    //
    // touchmove is non-passive so it can call preventDefault. xterm draws into plain DOM elements
    // with no CSS scroll container of its own, so without preventDefault a swipe that reaches the end
    // of tmux's buffer would chain to the document and pan the page. overscroll-behavior:none only
    // stops the bounce at the edge of a real CSS scroll container. preventDefault cancels the browser's
    // scroll gesture for the whole touch sequence while the wheel codes still go out over the socket.
    // xterm's tap, focus and selection use touchstart and touchend, which this does not affect.
    const SCROLL_SENSITIVITY = 36; // px per scroll tick (matches ttyd-mobile)
    let touchStartYLocal = 0;
    let touchStartYForSwipe = 0; // closure-local anchor for swipe displacement check
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
        touchStartYForSwipe = e.touches[0].clientY;
        touchAccumLocal = 0;
        isSwipingRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      // Prevent the browser from scrolling the document while touching the
      // terminal. The canvas has no CSS scroll container, so without this
      // the browser would chain any unhandled pan gesture to the document.
      e.preventDefault();
      if (e.touches.length !== 1) return;

      const totalDiffY = Math.abs(e.touches[0].clientY - touchStartYForSwipe);
      if (totalDiffY > 8) {
        isSwipingRef.current = true;
      }

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

    // The swipe flag stays set briefly after the finger lifts so the click that ends a swipe is ignored.
    let swipeResetTimer = null;
    const handleTouchEnd = () => {
      touchAccumLocal = 0;
      clearTimeout(swipeResetTimer);
      swipeResetTimer = setTimeout(() => {
        isSwipingRef.current = false;
      }, 150);
    };

    const containerEl = terminalRef.current;
    containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    containerEl.addEventListener('touchmove', handleTouchMove, { passive: false }); // non-passive: needs preventDefault
    containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    // WebSocket with automatic reconnect
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sessionId = session?.id || 'main';
    const cwdParam = session?.initialCwd ? `&cwd=${encodeURIComponent(session.initialCwd)}` : '';
    const takeoverParam = session?.forceTakeover ? '&takeover=true' : '';
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal?session=${sessionId}${cwdParam}${takeoverParam}`;

    let reconnectAttempts = 0;
    const maxReconnects = 10;
    let reconnectTimeout = null;
    // Set when a connect was requested while the container had no height (a hidden panel). The
    // ResizeObserver completes it as soon as the container is laid out, so nothing polls meanwhile.
    let connectPending = false;

    const connect = () => {
      if (!isMounted) return;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      const el = terminalRef.current;
      if (!el || el.clientHeight === 0) {
        connectPending = true;
        return;
      }
      connectPending = false;

      if (socketRef.current) {
        try {
          if (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING) {
            socketRef.current.close();
          }
        } catch {
          // The old socket is being replaced; a failed close changes nothing.
        }
      }

      const sock = new WebSocket(wsUrl);
      socketRef.current = sock;

      sock.onopen = () => {
        performFit();
        sendResizeHandshake(true);
      };

      sock.onmessage = (event) => {
        if (typeof event.data === 'string' && event.data.startsWith('{')) {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'ready') {
              // The server started the shell. The retry count resets only here, not on open, so a
              // server that accepts the socket and closes it at once still runs into the retry cap.
              reconnectAttempts = 0;
              performFit();
              sendResizeHandshake(true);
              return;
            }
          } catch {
            // Output that merely starts with a brace is not JSON; it is written to the terminal below.
          }
        }

        term.write(event.data);
      };
      sock.onerror = (err) => { console.error('WebSocket Error:', err); };

      sock.onclose = (closeEvent) => {
        // Bail out if component unmounted or a newer socket has superseded this one
        if (!isMounted || socketRef.current !== sock) return;
        if (closeEvent.code === 1008) {
          // The server refused the session (not signed in, or an invalid session name); retrying cannot help.
          if (isActiveRef.current) {
            term.writeln(`\r\n\x1b[31m[Connection refused${closeEvent.reason ? `: ${closeEvent.reason}` : ''}]\x1b[0m`);
          }
        } else if (isActiveRef.current && reconnectAttempts < maxReconnects) {
          reconnectAttempts++;
          const delay = Math.min(reconnectAttempts * 1000, 5000);
          term.writeln(
            `\r\n\x1b[33m[Connection lost — reconnecting in ${delay / 1000}s` +
            ` (${reconnectAttempts}/${maxReconnects})]\x1b[0m`
          );
          reconnectTimeout = setTimeout(connect, delay);
        } else if (isActiveRef.current) {
          term.writeln('\r\n\x1b[31m[Could not reconnect. Reopen this tab or switch views to reconnect.]\x1b[0m');
        }
      };
    };

    connectRef.current = () => {
      reconnectAttempts = 0;
      connect();
    };

    connect();

    // When the setting is on, looks at the last lines of output a second after it settles for a
    // subagent marker and asks the server which new tmux sessions to attach (at most every 20 s).
    let parseDebounceTimer = null;
    const parseDisposable = term.onWriteParsed(() => {
      if (!tmuxSettingsRef.current?.autoSpawnSubagents) return;
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
                } catch {
                  // An unreadable saved list is sent as empty.
                }
                fetch('/api/terminal/sessions/sync-subagents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ active: activeIds }),
                })
                  .then((res) => {
                    if (!res.ok) throw new Error(`sync-subagents ${res.status}`);
                    return res.json();
                  })
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
                  .catch(() => {
                    showToastRef.current('Subagent sync failed');
                  });
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

    // Reports shell title/CWD changes to the parent
    term.onTitleChange((title) => {
      if (!title || !onCwdChangeRef.current) return;
      let parsed = title.trim();
      if (parsed.includes(':')) {
        parsed = parsed.split(':').pop().trim();
      }
      if (parsed.startsWith('/') || parsed.startsWith('~')) {
        onCwdChangeRef.current(parsed);
      }
    });

    // Re-fits on container resizes and completes a connect that was waiting for a layout. A session
    // that is not the active tab skips the fit; it re-fits when it becomes active.
    let resizeDebounce = null;
    const handleResize = () => {
      if (connectPending && terminalRef.current && terminalRef.current.clientHeight > 0) {
        connect();
      }
      if (!isActiveRef.current) return;
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
      clearTimeout(swipeResetTimer);
      clearTimeout(refocusTimer);
      initialFitTimers.forEach(clearTimeout);
      cancelAnimationFrame(fitFrame);
      if (parseDebounceTimer) clearTimeout(parseDebounceTimer);
      if (selectionTimer.current) clearTimeout(selectionTimer.current);
      if (fontTimerRef.current) clearTimeout(fontTimerRef.current);
      clearTimeout(injectTimerRef.current);
      clearTimeout(backspaceTimerRef.current);
      selectionDisposable.dispose();
      scrollDisposable.dispose();
      parseDisposable.dispose();
      resizeObserver.disconnect();
      if (term.textarea && handleTextareaBlur) {
        term.textarea.removeEventListener('blur', handleTextareaBlur);
      }
      containerEl.removeEventListener('touchstart', handleTouchStart);
      containerEl.removeEventListener('touchmove', handleTouchMove);
      containerEl.removeEventListener('touchend', handleTouchEnd);
      if (socketRef.current) socketRef.current.close();
      try {
        term.dispose();
      } catch {
        // Teardown is best effort; the instance is dropped either way.
      }
    };
  }, []);



  const ensureLivePrompt = useCallback(() => {
    if (!isActiveRef.current) return;
    try {
      // Only send \x1b (tmux copy-mode exit) if xterm's buffer shows the user
      // is actually scrolled up into history. Sending it unconditionally would
      // forward a raw Escape to whatever process is running at the live prompt
      // (e.g., AGY-CLI), which interprets it as a cancel/interrupt signal.
      const buf = xtermInstance.current?.buffer?.active;
      const isScrolledUp = buf && buf.viewportY < buf.baseY;
      if (isScrolledUp && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send('\x1b');
      }
      if (xtermInstance.current) {
        xtermInstance.current.scrollToBottom();
        xtermInstance.current.clearSelection();
      }
    } catch (e) {
      console.error('ensureLivePrompt error:', e);
    }
  }, []);

  // Leaves tmux copy-mode and returns to the live prompt when the stager opens.
  useEffect(() => {
    const handleStagerOpen = () => {
      if (isActiveRef.current) {
        ensureLivePrompt();
      }
    };
    window.addEventListener('sovereign_open_stager', handleStagerOpen);
    return () => window.removeEventListener('sovereign_open_stager', handleStagerOpen);
  }, [ensureLivePrompt]);

  // Sends the input handed down from the touch bar or stager to the active session only: a string is
  // typed as is; { text, executeImmediately } is typed and, when immediate, followed by Enter. The
  // effect depends on the input alone, so a re-render cannot send the same input twice.
  useEffect(() => {
    if (!isActiveRef.current) return;
    const input = voiceInput;
    if (!input) return;
    const sock = socketRef.current;
    const isOpen = sock && sock.readyState === WebSocket.OPEN;
    if (typeof input === 'object') {
      const { text, executeImmediately } = input;
      injectingRef.current = true;
      try {
        if (isOpen) {
          if (executeImmediately) {
            sock.send(text + '\r');
          } else {
            sock.send(text);
            // Staged text is followed a second later by a space and a backspace
            clearTimeout(backspaceTimerRef.current);
            backspaceTimerRef.current = setTimeout(() => {
              const live = socketRef.current;
              if (live && live.readyState === WebSocket.OPEN) live.send(' \x7f');
            }, 1000);
          }
        } else {
          showToastRef.current('Terminal reconnecting — please retry');
        }
      } catch (e) {
        console.error('Injection error:', e);
        showToastRef.current('Could not send to the terminal');
      } finally {
        if (xtermInstance.current) {
          xtermInstance.current.focus();
        }
        clearTimeout(injectTimerRef.current);
        injectTimerRef.current = setTimeout(() => {
          injectingRef.current = false;
        }, 100);
      }
    } else if (isOpen) {
      sock.send(input);
    } else {
      showToastRef.current('Terminal reconnecting — please retry');
    }
  }, [voiceInput]);


  // Copy handlers for CopyCard: each takes the text from the terminal buffer and either copies it
  // to the clipboard ('clip') or hands it to the inspector.
  const handleCopyLastOutput = useCallback((mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const maxLines = Math.min(buffer.length, 60);
    const startLine = Math.max(0, buffer.length - maxLines);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToastRef.current('Copied Last Output to Clipboard')).catch(() => showToastRef.current('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, 'Last Command Output');
    }
  }, [onInspectText]);

  const handleCopyScreenBuffer = useCallback((mode) => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const startLine = buffer.viewportY || 0;
    const endLine = Math.min(buffer.length, startLine + term.rows);
    const text = extractBufferRange(buffer, startLine, endLine);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToastRef.current('Copied Screen Buffer to Clipboard')).catch(() => showToastRef.current('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, 'Screen Buffer');
    }
  }, [onInspectText]);

  const handleCopyCustomLines = useCallback((mode, linesOverride) => {
    if (!xtermInstance.current) return;
    const customCount = typeof linesOverride === 'number' ? linesOverride : 50;

    const term = xtermInstance.current;
    const buffer = term.buffer.active;
    const lineCount = (customCount === 0 || customCount > buffer.length) ? buffer.length : customCount;
    const startLine = Math.max(0, buffer.length - lineCount);
    const text = extractBufferRange(buffer, startLine, buffer.length);
    if (mode === 'clip') {
      writeToClipboard(text).then(() => showToastRef.current(`Copied ${lineCount} Lines to Clipboard`)).catch(() => showToastRef.current('Failed to copy to clipboard'));
    } else if (onInspectText) {
      onInspectText(text, `Custom ${lineCount} Lines`);
    }
  }, [onInspectText]);

  const scrollToBottom = () => {
    ensureLivePrompt();
    setShowScrollBottom(false);
  };

  return (
    <div
      className="terminal-wrapper"
      onPointerDownCapture={(e) => {
        if (e.target.closest('.copy-card-container') || e.target.closest('.scroll-bottom-btn')) return;
        const isStagerOpen = !!document.body.querySelector('.staging-drawer-container');
        if (readTapMode() === 'stager' || isStagerOpen) {
          // Intercept pointer before xterm can focus .xterm-helper-textarea
          e.stopPropagation();
        }
      }}

      onClick={(e) => {
        if (isSwipingRef.current) return;
        if (e.target.closest('.copy-card-container') || e.target.closest('.scroll-bottom-btn')) return;
        if (readTapMode() === 'stager') {
          const isStagerOpen = !!document.body.querySelector('.staging-drawer-container');
          if (isStagerOpen) {
            window.dispatchEvent(new CustomEvent('sovereign_close_stager'));
            if (document.activeElement?.blur) document.activeElement.blur();
          } else {
            window.dispatchEvent(new CustomEvent('sovereign_open_stager'));
          }
        } else {
          if (!document.body.querySelector('.staging-drawer-container') && !document.body.querySelector('.macro-modal-overlay')) {
            xtermInstance.current?.focus();
            xtermInstance.current?.scrollToBottom();
          }
        }
      }}
    >
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
