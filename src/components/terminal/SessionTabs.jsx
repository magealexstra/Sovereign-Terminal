import React from 'react';
import { Terminal, Plus, FolderDown, X } from 'lucide-react';

export default function SessionTabs({ sessions, activeSession, onSelectSession, onAddSession, onCloseSession, rootDir }) {
  return (
    <div className="session-tabs-bar">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className={`session-pill-btn ${activeSession === session.id ? 'active' : ''}`}
          onClick={() => onSelectSession(session.id)}
        >
          <Terminal size={12} />
          <span className="tab-auto-text">{session.name}</span>
          <span
            className="close-session-icon"
            onClick={(e) => {
              e.stopPropagation();
              onCloseSession(session.id);
            }}
            title="Close session"
          >
            <X size={11} />
          </span>
        </button>
      ))}

      {/* Button 1: New Session at Root */}
      <button
        type="button"
        className="add-session-pill-btn"
        onClick={() => onAddSession(false)}
        disabled={sessions.length >= 5}
        title={sessions.length >= 5 ? 'Max 5 parallel sessions reached' : `New Session at Root Dir (${rootDir})`}
        style={{ opacity: sessions.length >= 5 ? 0.4 : 1, cursor: sessions.length >= 5 ? 'not-allowed' : 'pointer' }}
      >
        <Plus size={14} />
      </button>

      {/* Button 2: New Session in Current Working Directory */}
      <button
        type="button"
        className="add-session-pill-btn inherit-cwd"
        onClick={() => onAddSession(true)}
        disabled={sessions.length >= 5}
        title={sessions.length >= 5 ? 'Max 5 parallel sessions reached' : 'New Session in Current Working Directory'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', opacity: sessions.length >= 5 ? 0.4 : 1, cursor: sessions.length >= 5 ? 'not-allowed' : 'pointer' }}
      >
        <Plus size={14} />
        <FolderDown size={14} color={sessions.length >= 5 ? 'var(--text-muted)' : 'var(--accent-mana)'} />
      </button>
    </div>
  );
}
