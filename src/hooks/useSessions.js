import React, { useState, useEffect } from 'react';

/**
 * useSessions — manages the tmux terminal session tab state.
 *
 * Returns:
 *   sessions            {Array}    List of { id, name, initialCwd? } objects.
 *   activeSession       {string}   ID of the currently visible session.
 *   voiceInput          {string}   Ephemeral string sent to the active Terminal via prop.
 *   setActiveSession    {function} Select a session tab by ID.
 *   handleAddSession    {function} Add a new session (inheritCwd = false).
 *   handleCloseSession  {function} Close a session by ID (auto-creates replacement if last).
 *   handleTerminalInput {function} Send a command string to the terminal (macro or voice).
 *
 * @param {string|null} activeTerminalPath  Current CWD tracked by the terminal (used for inheritCwd).
 * @param {function}    showToast           showToast(msg) from useToast() — replaces alert().
 */
export function useSessions(activeTerminalPath, showToast, workspaceRoot) {
  // Counter only ever increments — prevents duplicate names after close+add cycles
  const sessionCounterRef = React.useRef(1);

  // Give the first session a unique ID so it never collides with a stale
  // tmux session of the same name across page reloads.
  const initialSessionId = React.useRef(
    `session-${Date.now().toString(36).substring(4)}`
  );

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [tmuxSessionCount, setTmuxSessionCount] = useState(0);

  React.useEffect(() => {
    fetch('/api/terminal/sessions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.sessions && data.sessions.length > 0) {
          const loadedSessions = data.sessions.map((id, index) => ({
            id: id,
            name: `term-${index + 1}`
          }));
          sessionCounterRef.current = loadedSessions.length;
          setSessions(loadedSessions);
          setActiveSession(loadedSessions[0].id);
        } else {
          setSessions([{ id: initialSessionId.current, name: 'term-1' }]);
          setActiveSession(initialSessionId.current);
        }
      })
      .catch(() => {
        setSessions([{ id: initialSessionId.current, name: 'term-1' }]);
        setActiveSession(initialSessionId.current);
      });
  }, []);

  // Poll the live tmux session count every 30 seconds independent of the tab list.
  // This reflects background sessions that may exist even without an open UI tab.
  useEffect(() => {
    const poll = () =>
      fetch('/api/terminal/sessions')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.sessions) setTmuxSessionCount(d.sessions.length); })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  // Keep localStorage in sync with the current open tab IDs so TmuxManager
  // can determine which sessions are "active" when sweeping zombies.
  useEffect(() => {
    try {
      localStorage.setItem('sovereign_active_session_ids', JSON.stringify(sessions.map(s => s.id)));
    } catch {}
  }, [sessions]);

  const handleAddSession = async (inheritCwd = false) => {
    if (sessions.length >= 5) {
      // Use toast instead of browser alert() for non-blocking UX
      if (showToast) showToast('Max 5 sessions — close a tab to add another.');
      return;
    }
    const newId = `session-${Date.now().toString(36).substring(4)}`;
    sessionCounterRef.current += 1;
    const sessionName = `term-${sessionCounterRef.current}`;
    let targetCwd = workspaceRoot;

    if (inheritCwd && activeSession) {
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
        sessionCounterRef.current += 1;
        const freshId = `session-${Date.now().toString(36).substring(4)}`;
        const fresh = { id: freshId, name: `term-${sessionCounterRef.current}`, initialCwd: workspaceRoot };
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
    tmuxSessionCount,
    setActiveSession,
    handleAddSession,
    handleCloseSession,
    handleTerminalInput,
  };
}
