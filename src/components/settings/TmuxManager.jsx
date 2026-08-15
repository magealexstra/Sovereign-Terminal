import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Terminal as TermIcon, X, Zap, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatSessionDisplayName } from '../../hooks/useSessions';

export default function TmuxManager() {
  const { tmuxSettings, setTmuxSettings, syncUserSettingsToServer, setActiveMainTab } = useApp();

  const [detail, setDetail]             = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [actionMsg, setActionMsg]       = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  const flashTimerRef = useRef(null);

  const flash = (msg) => {
    setActionMsg(msg);
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => setActionMsg(''), 3500);
  };

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const selectedObj = detail.find((s) => s.name === selectedSession);
  const isAttachedElsewhere = selectedObj?.attached === true;

  const handleAttach = () => {
    if (!selectedSession) return;
    window.dispatchEvent(new CustomEvent('sovereign_attach_session', {
      detail: { sessionName: selectedSession, forceTakeover: isAttachedElsewhere }
    }));
    if (setActiveMainTab) {
      setActiveMainTab('terminal');
    }
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/terminal/sessions');
      if (res.ok) {
        const data = await res.json();
        setDetail(data.detail || []);
        setSessionCount((data.sessions || []).length);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const killSession = async (id) => {
    try {
      const res = await fetch(`/api/terminal/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedSession === id) setSelectedSession(null);
        flash(`Session "${id}" killed`);
        fetchSessions();
      } else {
        flash(`Failed to kill session "${id}"`);
      }
    } catch (err) {
      console.error('Failed to kill session:', err);
      flash(`Failed to kill session "${id}"`);
    }
  };

  const sweepZombies = async () => {
    let activeIds = [];
    try {
      const raw = localStorage.getItem('sovereign_active_session_ids');
      activeIds = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Error reading active session IDs:', err);
    }
    try {
      const res = await fetch('/api/terminal/sessions/sweep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activeIds }),
      });
      if (res.ok) {
        const data = await res.json();
        const n = data.swept?.length ?? 0;
        flash(n > 0 ? `Swept ${n} zombie session${n !== 1 ? 's' : ''}` : 'No zombie sessions found');
        fetchSessions();
      } else {
        flash('Failed to sweep zombie sessions');
      }
    } catch (err) {
      console.error('Failed to sweep zombie sessions:', err);
      flash('Failed to sweep zombie sessions');
    }
  };

  const updateBehavior = (key, value) => {
    setTmuxSettings({ [key]: value });
    syncUserSettingsToServer().catch(err => console.error('Server sync error:', err));
  };

  const applyPerfConfig = async (key, value) => {
    setTmuxSettings({ [key]: value });
    syncUserSettingsToServer().catch(err => console.error('Server sync error:', err));
    const body = {};
    if (key === 'scrollbackLines') body.historyLimit = value;
    if (key === 'escapeTimeMs')    body.escapeTimeMs  = value;
    try {
      const res = await fetch('/api/terminal/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        flash('Failed to apply performance config');
      }
    } catch (err) {
      console.error('Failed to apply performance config:', err);
      flash('Failed to apply performance config');
    }
  };

  const dotClass = !serverOnline
    ? 'tmux-status-dot offline'
    : sessionCount > 20
    ? 'tmux-status-dot danger'
    : sessionCount > 10
    ? 'tmux-status-dot warn'
    : 'tmux-status-dot ok';

  return (
    <div className="tmux-manager">

      <div className="tmux-status-card">

        <div className="tmux-status-left">
          <span className={dotClass} />
          <span className="tmux-status-text">
            {serverOnline
              ? `tmux server — ${sessionCount} session${sessionCount !== 1 ? 's' : ''} running`
              : 'tmux server — unavailable'}
          </span>
        </div>
        <button className="tmux-icon-btn" onClick={fetchSessions} title="Refresh session list">
          <RefreshCw size={13} />
        </button>
      </div>

      {actionMsg && <div className="tmux-action-flash">{actionMsg}</div>}

      <div className="tmux-section">
        <div className="tmux-section-header">
          <span className="tmux-section-label">SESSIONS</span>
          <div className="tmux-bulk-actions">
            <button className="tmux-sweep-btn" onClick={sweepZombies} title="Kill sessions not open as tabs">
              <Zap size={11} />
              Sweep Zombies
            </button>
            <button
              className={`tmux-attach-btn${selectedSession ? (isAttachedElsewhere ? ' takeover' : ' active') : ''}`}
              onClick={handleAttach}
              disabled={!selectedSession}
              title={
                !selectedSession
                  ? 'Select a session row below to attach'
                  : isAttachedElsewhere
                  ? `Disconnect other device and take over session "${selectedSession}"`
                  : `Attach session "${selectedSession}" as terminal tab`
              }
            >
              <Link2 size={11} />
              {isAttachedElsewhere ? 'Takeover' : 'Attach'}
            </button>
          </div>
        </div>

        <div className="tmux-session-list">
          {loading && <div className="tmux-empty-state">Loading...</div>}
          {!loading && detail.length === 0 && (
            <div className="tmux-empty-state">No active tmux sessions</div>
          )}
          {!loading && detail.map((sess) => (
            <div
              key={sess.name}
              className={`tmux-session-row${selectedSession === sess.name ? ' selected' : ''}`}
              onClick={() => setSelectedSession(selectedSession === sess.name ? null : sess.name)}
            >
              <TermIcon size={12} style={{ color: selectedSession === sess.name ? 'var(--accent-mana)' : 'var(--text-muted)', flexShrink: 0 }} />
              <span className="tmux-sess-name">{formatSessionDisplayName(sess.name)}</span>
              <span className={`tmux-badge${sess.attached ? ' attached' : ' detached'}`}>
                {sess.attached ? 'attached' : 'detached'}
              </span>
              <span className="tmux-sess-windows">
                {sess.windows} {sess.windows === 1 ? 'win' : 'wins'}
              </span>
              <button
                className="tmux-kill-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  killSession(sess.name);
                }}
                title={`Kill ${sess.name}`}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="tmux-section">
        <div className="tmux-section-header">
          <span className="tmux-section-label">BEHAVIOR</span>
        </div>
        <div className="tmux-settings-card">
          <div className="tmux-setting-row">
            <div className="tmux-setting-info">
              <span className="tmux-setting-label">Kill on Close</span>
              <span className="tmux-setting-desc">
                Terminate the tmux session when a tab is closed.
                Off = detach only (recommended).
              </span>
            </div>
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={!!tmuxSettings?.killOnClose}
                onChange={(e) => updateBehavior('killOnClose', e.target.checked)}
              />
              <span className="pill-track"><span className="pill-thumb" /></span>
            </label>
          </div>

          <div className="tmux-setting-row">
            <div className="tmux-setting-info">
              <span className="tmux-setting-label">Auto-Attach AGY Subagents</span>
              <span className="tmux-setting-desc">
                Automatically spawn new terminal tabs when a background subagent is detected.
              </span>
            </div>
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={!!tmuxSettings?.autoSpawnSubagents}
                onChange={(e) => updateBehavior('autoSpawnSubagents', e.target.checked)}
              />
              <span className="pill-track"><span className="pill-thumb" /></span>
            </label>
          </div>
        </div>
      </div>

      <div className="tmux-section">
        <div className="tmux-section-header">
          <span className="tmux-section-label">PERFORMANCE</span>
        </div>
        <div className="tmux-settings-card">
          <div className="tmux-setting-row">
            <div className="tmux-setting-info">
              <span className="tmux-setting-label">Scrollback Buffer</span>
              <span className="tmux-setting-desc">
                Lines of history per session. Applies to new windows only.
              </span>
            </div>
            <div className="tmux-slider-col">
              <span className="tmux-slider-value">
                {(tmuxSettings?.scrollbackLines ?? 10000).toLocaleString()} lines
              </span>
              <input
                type="range"
                className="font-slider tmux-slider"
                min={2000}
                max={100000}
                step={1000}
                value={tmuxSettings?.scrollbackLines ?? 10000}
                onChange={(e) => setTmuxSettings({ scrollbackLines: parseInt(e.target.value) })}
                onMouseUp={(e) => applyPerfConfig('scrollbackLines', parseInt(e.target.value))}
                onTouchEnd={(e) => applyPerfConfig('scrollbackLines', parseInt(e.target.value))}
              />
              <div className="tmux-slider-range">
                <span>2,000</span><span>100,000</span>
              </div>
            </div>
          </div>

          <div className="tmux-setting-row">
            <div className="tmux-setting-info">
              <span className="tmux-setting-label">Escape-time</span>
              <span className="tmux-setting-desc">
                Key sequence delay in ms. Use 0–10 for vim/neovim. Applies immediately.
              </span>
            </div>
            <div className="tmux-num-col">
              <input
                type="number"
                className="tmux-num-input"
                min={0}
                max={500}
                value={tmuxSettings?.escapeTimeMs ?? 10}
                onChange={(e) => setTmuxSettings({ escapeTimeMs: parseInt(e.target.value) || 0 })}
                onBlur={(e) => applyPerfConfig('escapeTimeMs', parseInt(e.target.value) || 0)}
              />
              <span className="tmux-unit">ms</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
