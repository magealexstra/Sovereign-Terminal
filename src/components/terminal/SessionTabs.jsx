import React from 'react';
import { Terminal, Plus, X } from 'lucide-react';

export default function SessionTabs({ sessions, activeSession, onSelectSession, onAddSession, onCloseSession }) {
  return (
    <div className="session-tabs-bar">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          className={`session-pill-btn ${activeSession === session.id ? 'active' : ''}`}
          onClick={() => onSelectSession(session.id)}
        >
          <Terminal size={13} />
          <span>{session.name}</span>
          {sessions.length > 1 && (
            <span
              className="close-session-icon"
              onClick={(e) => {
                e.stopPropagation();
                onCloseSession(session.id);
              }}
            >
              <X size={12} />
            </span>
          )}
        </button>
      ))}
      <button type="button" className="add-session-pill-btn" onClick={onAddSession} title="New tmux Window">
        <Plus size={15} />
      </button>
    </div>
  );
}
