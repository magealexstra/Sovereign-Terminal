import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, FolderTree, Sliders } from 'lucide-react';
import { useApp } from './context/AppContext';
import { useSessions } from './hooks/useSessions';
import { useToast } from './hooks/useToast';

import Terminal from './components/terminal/Terminal';
import SessionTabs from './components/terminal/SessionTabs';
import TouchBar from './components/terminal/TouchBar';

import FileExplorer from './components/explorer/FileExplorer';
import CodeEditor from './components/explorer/CodeEditor';

import SettingsManager from './components/settings/SettingsManager';

export default function App() {
  const { activeMainTab, setActiveMainTab } = useApp();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Dynamic Visual Viewport & Android VirtualKeyboard API Listener
  useEffect(() => {
    // Enable native Android Chrome VirtualKeyboard overlay geometry if supported
    if ('virtualKeyboard' in navigator) {
      try {
        navigator.virtualKeyboard.overlaysContent = true;
      } catch (e) {}
    }

    const handleViewportResize = (event) => {
      const fullHeight = window.innerHeight;
      let targetHeight = fullHeight;
      let keyboardActive = false;

      if (window.visualViewport) {
        const vvHeight = window.visualViewport.height;
        // Soft keyboard active threshold: visualViewport height is >100px smaller than full window height
        keyboardActive = (fullHeight - vvHeight) > 100;
        targetHeight = keyboardActive ? vvHeight : fullHeight;
      } else if (event && event.target && event.target.boundingRect) {
        const kbHeight = event.target.boundingRect.height;
        keyboardActive = kbHeight > 100;
        targetHeight = keyboardActive ? (fullHeight - kbHeight) : fullHeight;
      }

      setIsKeyboardOpen(keyboardActive);

      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${targetHeight}px`
      );
    };

    handleViewportResize();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }

    if ('virtualKeyboard' in navigator) {
      navigator.virtualKeyboard.addEventListener('geometrychange', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
        window.visualViewport.removeEventListener('scroll', handleViewportResize);
      }
      if ('virtualKeyboard' in navigator) {
        navigator.virtualKeyboard.removeEventListener('geometrychange', handleViewportResize);
      }
    };
  }, []);

  // Session limit toast (replaces the alert() that was inside useSessions)
  const { toast: sessionToast, showToast: showSessionToast } = useToast(3000);

  // Tab 1 Terminal Sessions — all state and handlers live in useSessions
  const [activeTerminalPath, setActiveTerminalPath] = useState('/workspace');
  const {
    sessions,
    activeSession,
    voiceInput,
    setActiveSession,
    handleAddSession,
    handleCloseSession,
    handleTerminalInput,
  } = useSessions(activeTerminalPath, showSessionToast);
  const [openDocuments, setOpenDocuments] = useState([
    {
      name: 'README.md',
      path: '/workspace/README.md',
      isModified: false,
      content: '# 👑 SOVEREIGN TERMINAL\n\nWelcome to your mobile-first Linux control workstation.'
    }
  ]);
  const [activeFilePath, setActiveFilePath] = useState('/workspace/README.md');
  const [explorerSubTab, setExplorerSubTab] = useState('tree');

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
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filepath)}`);
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
      const res = await fetch(`/api/fs/save`, {
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
      const res = await fetch(`/api/fs/git-commit`, {
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

    // Safety backstop: never silently discard unsaved changes.
    // The CodeEditor UI already shows a Save/Discard/Cancel modal and calls
    // onCloseTab(path, true) after the user confirms — so this guard only
    // fires if handleCloseTab is ever called directly without force=true.
    if (!force && doc.isModified) return;

    const filtered = openDocuments.filter((d) => d.path !== filepath);
    setOpenDocuments(filtered);
    if (activeFilePath === filepath && filtered.length > 0) {
      setActiveFilePath(filtered[0].path);
    }
  };

  return (
    <div className={`sovereign-layout ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
      {/* Header with OmniState Logo & Vertically Stacked Title */}
      <header className="main-nav-bar">
        <div className="brand-title" title="Sovereign Terminal">
          <img
            src="/omnistate-logo.png"
            alt="OmniState Logo"
            className="omni-logo-img"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/favicon.svg';
            }}
          />
          <div className="brand-stacked-text">
            <span className="brand-line-1">SOVEREIGN</span>
            <span className="brand-line-2">TERMINAL</span>
          </div>
        </div>

        <div className="nav-tabs-group">
          <button
            type="button"
            className={`nav-tab-btn ${activeMainTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('terminal')}
          >
            <TerminalIcon size={13} />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeMainTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('explorer')}
          >
            <FolderTree size={13} />
            <span>Files</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeMainTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('settings')}
          >
            <Sliders size={13} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Tab 1: Multi-Tab WebGL Terminal */}
      <div className="tab-content-panel" style={{ display: activeMainTab === 'terminal' ? 'flex' : 'none' }}>
        {sessionToast && (
          <div className="copy-toast" style={{ top: '4rem', bottom: 'auto' }}>
            <span>{sessionToast}</span>
          </div>
        )}
        <SessionTabs
          sessions={sessions}
          activeSession={activeSession}
          onSelectSession={setActiveSession}
          onAddSession={handleAddSession}
          onCloseSession={handleCloseSession}
        />

        <div style={{ flex: '1 1 100%', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          {sessions.map((sess) => (
            <div
              key={sess.id}
              style={{
                display: activeSession === sess.id ? 'flex' : 'none',
                flex: '1 1 100%',
                alignSelf: 'stretch',
                width: '100%',
                height: '100%',
                minHeight: 0,
                position: 'relative',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <Terminal
                session={sess}
                isActive={activeMainTab === 'terminal' && activeSession === sess.id}
                isKeyboardOpen={isKeyboardOpen}
                voiceInput={voiceInput}
                onOpenFile={(filepath) => {
                  handleOpenFile(filepath);
                  setActiveMainTab('explorer');
                }}
              />
            </div>
          ))}
        </div>

        <TouchBar
          onKeyPress={handleTerminalInput}
          onVoiceInput={handleTerminalInput}
        />
      </div>

      {/* Tab 2: GUI File Explorer & Multi-Document CodeEditor */}
      <div className="tab-content-panel" style={{ display: activeMainTab === 'explorer' ? 'flex' : 'none' }}>
        <div className="settings-subtabs-bar">
          <button
            type="button"
            className={`subtab-btn ${explorerSubTab === 'tree' ? 'active' : ''}`}
            onClick={() => setExplorerSubTab('tree')}
          >
            <FolderTree size={13} />
            <span>Files</span>
          </button>

          <button
            type="button"
            className={`subtab-btn ${explorerSubTab === 'editor' ? 'active' : ''}`}
            onClick={() => setExplorerSubTab('editor')}
          >
            <TerminalIcon size={13} />
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

      {/* Tab 3: Settings, Themes & Button Studio */}
      <div className="tab-content-panel" style={{ display: activeMainTab === 'settings' ? 'flex' : 'none' }}>
        <SettingsManager />
      </div>
    </div>
  );
}
