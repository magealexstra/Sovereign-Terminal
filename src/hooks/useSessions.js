import { useState, useEffect, useRef } from 'react';

// The most terminal sessions that can be open at once.
export const MAX_SESSIONS = 5;

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
 * Reads the session IDs saved from the previous run.
 * Returns a sessions array [{ id, name }] if valid data exists, null otherwise.
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
  const initialSessionId = useRef(
    `session-${Date.now().toString(36).substring(4)}`
  );

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSessionState] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const inputClearTimerRef = useRef(null);

  // The session list and the active id are mirrored in refs that change together with the state, so
  // event handlers and async code decide from the latest values instead of a render's closure, and no
  // setter has to run inside a state updater.
  const sessionsRef = useRef([]);
  const activeSessionRef = useRef('');
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const rootDirRef = useRef(rootDir);
  rootDirRef.current = rootDir;

  const commitSessions = (next) => {
    sessionsRef.current = next;
    setSessions(next);
  };

  const setActiveSession = (id) => {
    activeSessionRef.current = id;
    setActiveSessionState(id);
  };

  useEffect(() => {
    let cancelled = false;

    const openSessions = (list) => {
      commitSessions(list);
      setActiveSession(list[0].id);
    };

    // No live sessions, or the server is unreachable: reopen the tabs saved from the previous run
    // (the socket attaches with `new-session -A -s <id>`, which joins a surviving session or creates
    // a fresh one of the same name, so tab names stay stable across restarts), else start one.
    const openFallbackSessions = () => {
      const restored = _restoreSessionsFromStorage();
      openSessions(
        restored || [{ id: initialSessionId.current, name: formatSessionDisplayName(initialSessionId.current) }]
      );
    };

    fetch('/api/terminal/sessions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && data.sessions && data.sessions.length > 0) {
          const details = data.detail || [];
          const freeSessions = data.sessions.filter((id) => {
            const d = details.find((item) => item.name === id);
            return d ? !d.attached : true;
          });

          if (freeSessions.length > 0) {
            openSessions(freeSessions.map((id) => ({ id, name: formatSessionDisplayName(id) })));
          } else {
            const freshId = initialSessionId.current;
            openSessions([{ id: freshId, name: formatSessionDisplayName(freshId) }]);
          }
        } else {
          openFallbackSessions();
        }
      })
      .catch(() => {
        if (!cancelled) openFallbackSessions();
      });

    return () => { cancelled = true; };
  }, []);

  // Keep localStorage in sync with the current open tab IDs so TmuxManager can tell which sessions
  // are active when sweeping zombies. An empty list is not written: the list is empty only before the
  // first load, and writing it would erase the saved tabs the cold-start fallback reads.
  useEffect(() => {
    if (sessions.length === 0) return;
    try {
      localStorage.setItem('sovereign_active_session_ids', JSON.stringify(sessions.map(s => s.id)));
    } catch {
      // Storage is unavailable; the tabs are just not remembered across a restart.
    }
  }, [sessions]);

  // Listen for 'sovereign_attach_session' events dispatched from TmuxManager
  useEffect(() => {
    const handleAttachEvent = (e) => {
      const targetSession = e.detail?.sessionName;
      const forceTakeover = e.detail?.forceTakeover === true;
      if (!targetSession) return;

      const current = sessionsRef.current;
      const existing = current.find((s) => s.id === targetSession || s.name === targetSession);
      if (existing) {
        setActiveSession(existing.id);
        return;
      }

      if (current.length >= MAX_SESSIONS) {
        if (showToastRef.current) showToastRef.current(`Max ${MAX_SESSIONS} sessions — close a tab to attach another.`);
        return;
      }

      const newSessionObj = {
        id: targetSession,
        name: formatSessionDisplayName(targetSession),
        initialCwd: rootDirRef.current,
        forceTakeover,
      };
      commitSessions([...current, newSessionObj]);
      setActiveSession(targetSession);
    };

    window.addEventListener('sovereign_attach_session', handleAttachEvent);
    return () => window.removeEventListener('sovereign_attach_session', handleAttachEvent);
  }, []);

  const handleAddSession = async (inheritCwdOrPath = false) => {
    if (sessionsRef.current.length >= MAX_SESSIONS) {
      if (showToast) showToast(`Max ${MAX_SESSIONS} sessions — close a tab to add another.`);
      return;
    }
    const newId = `session-${Date.now().toString(36).substring(4)}`;
    const sessionName = formatSessionDisplayName(newId);
    let targetCwd = rootDir;

    if (typeof inheritCwdOrPath === 'string') {
      targetCwd = inheritCwdOrPath;
    } else if (inheritCwdOrPath && activeSessionRef.current) {
      let resolved = false;
      try {
        const res = await fetch(`/api/terminal/cwd?session=${encodeURIComponent(activeSessionRef.current)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.cwd) {
            targetCwd = data.cwd;
            resolved = true;
          }
        }
      } catch {
        // The server could not answer; the path the terminal last reported is used below.
      }
      if (!resolved && activeTerminalPath) targetCwd = activeTerminalPath;
    }

    // The lookup above is async, so the limit is checked again against the latest list.
    if (sessionsRef.current.length >= MAX_SESSIONS) {
      if (showToast) showToast(`Max ${MAX_SESSIONS} sessions — close a tab to add another.`);
      return;
    }
    commitSessions([...sessionsRef.current, { id: newId, name: sessionName, initialCwd: targetCwd }]);
    setActiveSession(newId);
  };

  const handleCloseSession = (id) => {
    const filtered = sessionsRef.current.filter((s) => s.id !== id);

    if (filtered.length === 0) {
      // Last tab closed — auto-create a fresh replacement so there's always a terminal
      const freshId = `session-${Date.now().toString(36).substring(4)}`;
      commitSessions([{ id: freshId, name: formatSessionDisplayName(freshId), initialCwd: rootDir }]);
      setActiveSession(freshId);
      return;
    }

    commitSessions(filtered);
    if (id === activeSessionRef.current) {
      setActiveSession(filtered[filtered.length - 1].id);
    }
  };

  // Unified input handler — used for both macro key-presses and voice dictation.
  // Both send a string to the terminal via the ephemeral voiceInput state channel:
  // the value is set, then cleared 50 ms later so the same input can be sent again.
  const handleTerminalInput = (text) => {
    clearTimeout(inputClearTimerRef.current);
    setVoiceInput(text);
    inputClearTimerRef.current = setTimeout(() => setVoiceInput(''), 50);
  };

  useEffect(() => () => clearTimeout(inputClearTimerRef.current), []);

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
