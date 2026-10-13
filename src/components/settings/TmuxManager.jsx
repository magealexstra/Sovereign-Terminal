import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Terminal as TermIcon, X, Zap, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatSessionDisplayName } from '../../hooks/useSessions';

// Keys that move a range slider; releasing one commits the new value.
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

export default function TmuxManager() {
  const { tmuxSettings, setTmuxSettings, syncUserSettingsToServer, setActiveMainTab } = useApp();

  const [detail, setDetail]             = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  const [actionMsg, setActionMsg]       = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  // Scrollback value while the slider is being dragged; the setting itself changes once, on release.
  const [scrollbackDraft, setScrollbackDraft] = useState(null);

  const flashTimerRef = useRef(null);
  const mountedRef = useRef(true);
  // Last value sent per performance setting, so one slider release is applied once.
  const appliedPerfRef = useRef({});

  const flash = (msg) => {
    if (!mountedRef.current) return;
    setActionMsg(msg);
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => setActionMsg(''), 3500);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
    setActiveMainTab('terminal');
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/terminal/sessions');
      if (!mountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (!mountedRef.current) return;
        setDetail(data.detail || []);
        setSessionCount((data.sessions || []).length);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      if (mountedRef.current) setServerOnline(false);
    } finally {
      if (mountedRef.current) setLoading(false);
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
    } catch {
      flash(`Failed to kill session "${id}"`);
    }
  };

  const sweepZombies = async () => {
    let activeIds = [];
    try {
      const raw = localStorage.getItem('sovereign_active_session_ids');
      activeIds = raw ? JSON.parse(raw) : [];
    } catch {
      // An unreadable list is sent as empty; the sweep still runs.
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
    } catch {
      flash('Failed to sweep zombie sessions');
    }
  };

  // The new value is passed to the sync explicitly: the stored copy is written
  // inside a state updater that React may not have run yet.
  const updateBehavior = async (key, value) => {
    setTmuxSettings({ [key]: value });
    const saved = await syncUserSettingsToServer({ tmux: { ...tmuxSettings, [key]: value } });
    if (!saved) flash('Failed to save tmux settings to the server');
  };

  const applyPerfConfig = async (key, value) => {
    // A touch release is followed by an emulated mouse release; the repeat sends nothing.
    if (appliedPerfRef.current[key] === value) return;
    appliedPerfRef.current[key] = value;
    setTmuxSettings({ [key]: value });
    const syncing = syncUserSettingsToServer({ tmux: { ...tmuxSettings, [key]: value } });
    const body = {};
    if (key === 'scrollbackLines') body.historyLimit = value;
    if (key === 'escapeTimeMs')    body.escapeTimeMs  = value;
    let applied = false;
    try {
      const res = await fetch('/api/terminal/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      applied = res.ok;
    } catch {
      applied = false;
    }
    const saved = await syncing;
    if (!applied) {
      // Let the same value be sent again on the next release.
      delete appliedPerfRef.current[key];
      flash('Failed to apply performance config');
    } else if (!saved) {
      flash('Failed to save tmux settings to the server');
    }
  };

  const commitScrollback = (value) => {
    setScrollbackDraft(null);
    applyPerfConfig('scrollbackLines', value);
  };

  const scrollbackValue = scrollbackDraft ?? (tmuxSettings?.scrollbackLines ?? 10000);

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
              <TermIcon size={12} style={{ color: selectedSession === sess.name ? 'var(--accent-mana)' : sess.attached ? 'var(--status-confirm)' : 'var(--text-muted)', flexShrink: 0 }} />
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
                {scrollbackValue.toLocaleString()} lines
              </span>
              <input
                type="range"
                className="font-slider tmux-slider"
                min={2000}
                max={100000}
                step={1000}
                value={scrollbackValue}
                onChange={(e) => setScrollbackDraft(parseInt(e.currentTarget.value, 10))}
                onMouseUp={(e) => commitScrollback(parseInt(e.currentTarget.value, 10))}
                onTouchEnd={(e) => commitScrollback(parseInt(e.currentTarget.value, 10))}
                onKeyUp={(e) => {
                  if (SLIDER_KEYS.has(e.key)) commitScrollback(parseInt(e.currentTarget.value, 10));
                }}
                onBlur={(e) => {
                  if (scrollbackDraft !== null) commitScrollback(parseInt(e.currentTarget.value, 10));
                }}
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
                onChange={(e) => setTmuxSettings({ escapeTimeMs: parseInt(e.currentTarget.value, 10) || 0 })}
                onBlur={(e) => applyPerfConfig('escapeTimeMs', parseInt(e.currentTarget.value, 10) || 0)}
              />
              <span className="tmux-unit">ms</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
