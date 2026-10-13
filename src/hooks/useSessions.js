import React, { useState, useEffect } from 'react';

/**
 * Display name for a tmux session id: a generated `session-<suffix>` id
 * becomes `S-<suffix>`, any other id is shown as is.
 */
export function formatSessionDisplayName(sessionId) {
  if (!sessionId) return 'term';
  if (sessionId.startsWith('session-')) {
    return `S-${sessionId.replace('session-', '')}`;
  }
  return sessionId;
}

/**
 * Read previously saved session IDs from localStorage.
 * Returns a sessions array  [{ id, name }]  if valid data exists, null otherwise.
 * Used as a cold-start fallback when the server reports no live tmux sessions.
 */
function _restoreSessionsFromStorage() {
  try {
    const raw = localStorage.getItem('sovereign_active_session_ids');
    if (!raw) return null;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return ids.map((id) => ({ id: String(id), name: formatSessionDisplayName(String(id)) }));
  } catch {
    return null;
  }
}

/**
 * useSessions: manages the tmux terminal session tab state.
 *
 * Returns:
 *   sessions            {Array}    List of { id, name, initialCwd? } objects.
 *   activeSession       {string}   ID of the currently visible session.
 *   voiceInput          {string|object}  Ephemeral input sent to the active Terminal via prop:
 *                                  a string, or { text, executeImmediately }.
 *   setActiveSession    {function} Select a session tab by ID.
 *   handleAddSession    {function} Add a new session. Argument: true to inherit the active
 *                                  session's cwd, or a path string to start there.
 *   handleCloseSession  {function} Close a session by ID (auto-creates replacement if last).
 *   handleTerminalInput {function} Send a command string to the terminal (macro or voice).
 *
 * @param {string|null} activeTerminalPath  Current CWD tracked by the terminal (used when inheriting the cwd).
 * @param {function}    showToast           showToast(msg) from useToast().
 * @param {string}      rootDir             Starting directory for new sessions.
 */
export function useSessions(activeTerminalPath, showToast, rootDir) {
  // Give the first session a unique ID so it never collides with a stale
  // tmux session of the same name across page reloads.
  const initialSessionId = React.useRef(
    `session-${Date.now().toString(36).substring(4)}`
  );

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [voiceInput, setVoiceInput] = useState('');

  React.useEffect(() => {
    fetch('/api/terminal/sessions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.sessions && data.sessions.length > 0) {
          const details = data.detail || [];
          const freeSessions = data.sessions.filter((id) => {
            const d = details.find((item) => item.name === id);
            return d ? !d.attached : true;
          });

          if (freeSessions.length > 0) {
            const loadedSessions = freeSessions.map((id) => ({
              id: id,
              name: formatSessionDisplayName(id)
            }));
            setSessions(loadedSessions);
            setActiveSession(loadedSessions[0].id);
          } else {
            const freshId = initialSessionId.current;
            setSessions([{ id: freshId, name: formatSessionDisplayName(freshId) }]);
            setActiveSession(freshId);
          }
        } else {
          // No live sessions (cold start, container restart, or tmux wiped).
          // Check localStorage for session IDs saved during the previous run.
          // The WS reconnects via  new-session -A -s <id>  which either attaches
          // to a surviving session or creates a fresh one with the same name —
          // either way tab names stay stable across restarts on this device.
          const restored = _restoreSessionsFromStorage();
          if (restored) {
            setSessions(restored);
            setActiveSession(restored[0].id);
          } else {
            setSessions([{ id: initialSessionId.current, name: formatSessionDisplayName(initialSessionId.current) }]);
            setActiveSession(initialSessionId.current);
          }
        }
      })
      .catch(() => {
        // Server unreachable — same fallback: prefer localStorage over fresh random.
        const restored = _restoreSessionsFromStorage();
        if (restored) {
          setSessions(restored);
          setActiveSession(restored[0].id);
        } else {
          setSessions([{ id: initialSessionId.current, name: formatSessionDisplayName(initialSessionId.current) }]);
          setActiveSession(initialSessionId.current);
        }
      });
  }, []);

  // Keep localStorage in sync with the current open tab IDs so TmuxManager
  // can determine which sessions are "active" when sweeping zombies.
  useEffect(() => {
    try {
      localStorage.setItem('sovereign_active_session_ids', JSON.stringify(sessions.map(s => s.id)));
    } catch {}
  }, [sessions]);

  // Listen for 'sovereign_attach_session' events dispatched from TmuxManager
  useEffect(() => {
    const handleAttachEvent = (e) => {
      const targetSession = e.detail?.sessionName;
      const forceTakeover = e.detail?.forceTakeover === true;
      if (!targetSession) return;

      setSessions((prev) => {
        const existing = prev.find((s) => s.id === targetSession || s.name === targetSession);
        if (existing) {
          setActiveSession(existing.id);
          return prev;
        }

        if (prev.length >= 5) {
          if (showToast) showToast('Max 5 sessions — close a tab to attach another.');
          return prev;
        }

        const newSessionObj = { id: targetSession, name: formatSessionDisplayName(targetSession), initialCwd: rootDir, forceTakeover };
        setActiveSession(targetSession);
        return [...prev, newSessionObj];
      });
    };

    window.addEventListener('sovereign_attach_session', handleAttachEvent);
    return () => window.removeEventListener('sovereign_attach_session', handleAttachEvent);
  }, [rootDir, showToast]);

  const handleAddSession = async (inheritCwdOrPath = false) => {
    if (sessions.length >= 5) {
      // Non-blocking toast
      if (showToast) showToast('Max 5 sessions — close a tab to add another.');
      return;
    }
    const newId = `session-${Date.now().toString(36).substring(4)}`;
    const sessionName = formatSessionDisplayName(newId);
    let targetCwd = rootDir;

    if (typeof inheritCwdOrPath === 'string') {
      targetCwd = inheritCwdOrPath;
    } else if (inheritCwdOrPath && activeSession) {
      try {
        const res = await fetch(`/api/terminal/cwd?session=${encodeURIComponent(activeSession)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.cwd) {
            targetCwd = data.cwd;
          }
        }
      } catch (e) {
        if (activeTerminalPath) targetCwd = activeTerminalPath;
      }
    }

    setSessions((prev) => [...prev, { id: newId, name: sessionName, initialCwd: targetCwd }]);
    setActiveSession(newId);
  };

  const handleCloseSession = (id) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);

      if (filtered.length === 0) {
        // Last tab closed — auto-create a fresh replacement so there's always a terminal
        const freshId = `session-${Date.now().toString(36).substring(4)}`;
        const fresh = { id: freshId, name: formatSessionDisplayName(freshId), initialCwd: rootDir };
        setActiveSession(freshId);
        return [fresh];
      }

      if (id === activeSession) {
        setActiveSession(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  // Unified input handler — used for both macro key-presses and voice dictation.
  // Both send a string to the terminal via the ephemeral voiceInput state channel.
  const handleTerminalInput = (text) => {
    setVoiceInput(text);
    setTimeout(() => setVoiceInput(''), 50);
  };

  return {
    sessions,
    activeSession,
    voiceInput,
    setActiveSession,
    handleAddSession,
    handleCloseSession,
    handleTerminalInput,
  };
}
