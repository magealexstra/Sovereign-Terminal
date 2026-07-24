import React, { useState } from 'react';
import { Terminal as TerminalIcon, FolderTree, Sliders, Shield } from 'lucide-react';
import { useApp } from './context/AppContext';

import Terminal from './components/terminal/Terminal';
import SessionTabs from './components/terminal/SessionTabs';
import TouchBar from './components/terminal/TouchBar';

import FileExplorer from './components/explorer/FileExplorer';
import CodeEditor from './components/explorer/CodeEditor';

import SettingsManager from './components/settings/SettingsManager';

export default function App() {
  const { activeMainTab, setActiveMainTab } = useApp();

  // Tab 1 Terminal Sessions
  const [sessions, setSessions] = useState([
    { id: 'mobile-voice', name: 'mobile-voice' },
    { id: 'dev', name: 'dev' },
    { id: 'server-logs', name: 'server-logs' },
  ]);
  const [activeSession, setActiveSession] = useState('mobile-voice');
  const [voiceInput, setVoiceInput] = useState('');

  // Tab 2 File Explorer & Multi-Document CodeEditor State
  const [explorerSubTab, setExplorerSubTab] = useState('tree');
  const [activeTerminalPath, setActiveTerminalPath] = useState('/workspace');
  const [openDocuments, setOpenDocuments] = useState([
    {
      name: 'README.md',
      path: '/workspace/README.md',
      isModified: false,
      content: '# 👑 SOVEREIGN TERMINAL\n\nWelcome to your mobile-first Linux control workstation.'
    }
  ]);
  const [activeFilePath, setActiveFilePath] = useState('/workspace/README.md');

  // Terminal Handlers
  const handleAddSession = () => {
    const newId = `session-${sessions.length + 1}`;
    setSessions([...sessions, { id: newId, name: newId }]);
    setActiveSession(newId);
  };

  const handleCloseSession = (id) => {
    if (sessions.length === 1) return;
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSession === id) {
      setActiveSession(filtered[0].id);
    }
  };

  const handleKeyPress = (keyData) => {
    setVoiceInput(keyData);
    setTimeout(() => setVoiceInput(''), 50);
  };

  const handleVoiceInput = (text) => {
    setVoiceInput(text);
    setTimeout(() => setVoiceInput(''), 50);
  };

  // File Explorer & CodeEditor Handlers
  const handleOpenFile = async (filepath) => {
    const filename = filepath.split('/').pop();
    const existing = openDocuments.find((doc) => doc.path === filepath);

    if (existing) {
      setActiveFilePath(filepath);
      setExplorerSubTab('editor');
      return;
    }

    try {
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/read?path=${encodeURIComponent(filepath)}`);
      if (res.ok) {
        const data = await res.json();
        const newDoc = {
          name: filename,
          path: filepath,
          content: data.content,
          isModified: false
        };
        setOpenDocuments([...openDocuments, newDoc]);
        setActiveFilePath(filepath);
        setExplorerSubTab('editor');
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  };

  const handleContentChange = (filepath, newContent) => {
    setOpenDocuments((prev) =>
      prev.map((doc) => (doc.path === filepath ? { ...doc, content: newContent, isModified: true } : doc))
    );
  };

  const handleSaveFile = async (filepath) => {
    const doc = openDocuments.find((d) => d.path === filepath);
    if (!doc) return;

    try {
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filepath, content: doc.content })
      });
      if (res.ok) {
        setOpenDocuments((prev) =>
          prev.map((d) => (d.path === filepath ? { ...d, isModified: false } : d))
        );
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  };

  const handleGitCommit = async (filepath) => {
    await handleSaveFile(filepath);
    try {
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/git-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filepath })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
      }
    } catch (e) {
      console.error('Git commit error:', e);
    }
  };

  const handleCloseTab = (filepath, force = false) => {
    const doc = openDocuments.find((d) => d.path === filepath);
    if (!doc) return;

    const filtered = openDocuments.filter((d) => d.path !== filepath);
    setOpenDocuments(filtered);
    if (activeFilePath === filepath && filtered.length > 0) {
      setActiveFilePath(filtered[0].path);
    }
  };

  return (
    <div className="sovereign-layout">
      {/* Mobile Touch Header with SOVEREIGN TERMINAL Brand & Pill Buttons */}
      <header className="main-nav-bar">
        <div className="brand-title">
          <Shield size={18} color="#88C0D0" />
          <span>SOVEREIGN TERMINAL</span>
        </div>

        <div className="nav-tabs-group">
          <button
            type="button"
            className={`nav-pill-btn ${activeMainTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('terminal')}
          >
            <TerminalIcon size={15} />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            className={`nav-pill-btn ${activeMainTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('explorer')}
          >
            <FolderTree size={15} />
            <span>Files</span>
          </button>

          <button
            type="button"
            className={`nav-pill-btn ${activeMainTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('settings')}
          >
            <Sliders size={15} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Tab 1: Multi-Tab WebGL Terminal */}
      {activeMainTab === 'terminal' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
          <SessionTabs
            sessions={sessions}
            activeSession={activeSession}
            onSelectSession={setActiveSession}
            onAddSession={handleAddSession}
            onCloseSession={handleCloseSession}
          />

          <Terminal
            activeSession={activeSession}
            voiceInput={voiceInput}
            onDataSent={(data) => {}}
          />

          <TouchBar
            onKeyPress={handleKeyPress}
            onVoiceInput={handleVoiceInput}
          />
        </div>
      )}

      {/* Tab 2: GUI File Explorer & Multi-Document CodeEditor */}
      {activeMainTab === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
          <div className="settings-subtabs-bar">
            <button
              type="button"
              className={`subtab-btn ${explorerSubTab === 'tree' ? 'active' : ''}`}
              onClick={() => setExplorerSubTab('tree')}
            >
              <FolderTree size={14} />
              <span>Files</span>
            </button>

            <button
              type="button"
              className={`subtab-btn ${explorerSubTab === 'editor' ? 'active' : ''}`}
              onClick={() => setExplorerSubTab('editor')}
            >
              <TerminalIcon size={14} />
              <span>Editor ({openDocuments.length})</span>
            </button>
          </div>

          {explorerSubTab === 'tree' ? (
            <FileExplorer onOpenFile={handleOpenFile} activeTerminalPath={activeTerminalPath} />
          ) : (
            <CodeEditor
              openDocuments={openDocuments}
              activeFilePath={activeFilePath}
              onSelectTab={setActiveFilePath}
              onCloseTab={handleCloseTab}
              onContentChange={handleContentChange}
              onSaveFile={handleSaveFile}
              onGitCommit={handleGitCommit}
              onReturnToTerminal={() => setActiveMainTab('terminal')}
            />
          )}
        </div>
      )}

      {/* Tab 3: Settings, Themes & Button Studio */}
      {activeMainTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
          <SettingsManager />
        </div>
      )}
    </div>
  );
}
