import React from 'react';
import { Terminal, Plus, X } from 'lucide-react';

export default function SessionTabs({ sessions, activeSession, onSelectSession, onAddSession, onCloseSession }) {
  return (
    <div className="session-tabs-bar">
      {sessions.map((session) => (
        <button
          key={session.id}
          className={`tab-button ${activeSession === session.id ? 'active' : ''}`}
          onClick={() => onSelectSession(session.id)}
        >
          <Terminal size={13} />
          <span>{session.name}</span>
          {sessions.length > 1 && (
            <X
              size={12}
              className="close-tab"
              onClick={(e) => {
                e.stopPropagation();
                onCloseSession(session.id);
              }}
            />
          )}
        </button>
      ))}
      <button className="add-tab-button" onClick={onAddSession} title="New tmux Window">
        <Plus size={15} />
      </button>
    </div>
  );
}
