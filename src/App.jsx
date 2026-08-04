import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, FolderTree, Sliders, LogOut } from 'lucide-react';
import { useApp } from './context/AppContext';
import { useSessions } from './hooks/useSessions';
import { useToast } from './hooks/useToast';

import Terminal from './components/terminal/Terminal';
import SessionTabs from './components/terminal/SessionTabs';
import TouchBar from './components/terminal/TouchBar';

import FileExplorer from './components/explorer/FileExplorer';
import CodeEditor from './components/explorer/CodeEditor';

import SettingsManager from './components/settings/SettingsManager';
import LoginModal from './components/auth/LoginModal';

export default function App() {
  const { activeMainTab, setActiveMainTab, fetchUserSettings, setUsername, clearUserCache } = useApp();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const [rootDir, setRootDir] = useState('');
  const [explorerPath, setExplorerPath] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.rootDir) {
            setRootDir(data.rootDir);
            setActiveTerminalPath(data.rootDir);
            setExplorerPath(data.rootDir);
          }
        }
      } catch (e) {
        console.error('Failed to load system config:', e);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  // Authentication State & Session Verification
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(true);
  const [authMode, setAuthMode] = useState('token');

  useEffect(() => {
    const fetchAuthMode = async () => {
      try {
        const modeRes = await fetch('/api/auth/mode');
        if (modeRes.ok) {
          const modeData = await modeRes.json();
          setAuthMode(modeData.auth_mode || 'token');
        }
      } catch {}
    };
    fetchAuthMode();

    const verifyAuth = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          const uname = data.username || 'default';
          setUsername(uname);
          setIsAuthenticated(true);
          setAuthEnabled(data.auth_enabled !== false);
          if (data.auth_mode) setAuthMode(data.auth_mode);
          // Call directly with username — avoids stale closure from state timing
          fetchUserSettings(uname);
        } else {
          setIsAuthenticated(false);
          const headerMode = res.headers.get('X-Auth-Mode');
          if (headerMode) setAuthMode(headerMode);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsAuthVerified(true);
      }
    };
    verifyAuth();
  }, []);

  const [showBrandMenu, setShowBrandMenu] = useState(false);

  useEffect(() => {
    if (!showBrandMenu) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.brand-title') && !e.target.closest('.brand-menu-popup')) {
        setShowBrandMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showBrandMenu]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearUserCache();       // wipe namespaced cache — device returns to defaults
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUsername('');
    setShowBrandMenu(false);
  };

  // Dynamic Visual Viewport & Android VirtualKeyboard API Listener
  useEffect(() => {
    // Enable native Android Chrome VirtualKeyboard overlay geometry if supported
    if ('virtualKeyboard' in navigator) {
      try {
        navigator.virtualKeyboard.overlaysContent = true;
      } catch (e) {}
    }

    const handleViewportResize = () => {
      const fullHeight = window.innerHeight;
      let targetHeight = fullHeight;
      let keyboardActive = false;
      let kbHeight = 0;

      if ('virtualKeyboard' in navigator) {
        // Modern Android: Use exact geometry from the new API
        kbHeight = navigator.virtualKeyboard.boundingRect.height;
        keyboardActive = kbHeight > 100;
        targetHeight = keyboardActive ? (fullHeight - kbHeight) : fullHeight;
      } else if (window.visualViewport) {
        // iOS Safari: Fallback to visual viewport differences
        const vvHeight = window.visualViewport.height;
        // Soft keyboard active threshold: visualViewport height is >100px smaller than full window height
        keyboardActive = (fullHeight - vvHeight) > 100;
        targetHeight = keyboardActive ? vvHeight : fullHeight;
      }

      setIsKeyboardOpen(prev => prev === keyboardActive ? prev : keyboardActive);

      const newHeightStr = `${targetHeight}px`;
      if (document.documentElement.style.getPropertyValue('--visual-viewport-height') !== newHeightStr) {
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          newHeightStr
        );
      }
    };

    handleViewportResize();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    if ('virtualKeyboard' in navigator) {
      navigator.virtualKeyboard.addEventListener('geometrychange', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
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
  } = useSessions(activeTerminalPath, showSessionToast, rootDir);
  const [openDocuments, setOpenDocuments] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState('');
  const [explorerSubTab, setExplorerSubTab] = useState('tree');
  const inspectCountRef = useRef(0);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  // Dispatch layout reflow on return to Terminal tab to snap absolute footers/stagers to bottom: 3.5rem
  useEffect(() => {
    if (activeMainTab === 'terminal') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Dismiss soft keyboard when navigating away from Terminal tab to Files or Settings
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
  }, [activeMainTab]);

  // One-Time Welcome Screen: Load OPERATION_MANUAL.md after login
  useEffect(() => {
    // Only run this logic if the user is successfully authenticated
    if (!isAuthenticated) return;

    // Check if the user has already seen the manual in this browser
    const hasSeenManual = localStorage.getItem('hasSeenManual');
    if (!hasSeenManual) {
      // Fetch the live manual from the container's hard drive
      fetch(`/api/fs/read?path=${rootDir}/OPERATION_MANUAL.md`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.content) {
            // Open the manual as a new tab
            setOpenDocuments([{
              name: 'OPERATION_MANUAL.md',
              path: `${rootDir}/OPERATION_MANUAL.md`,
              isModified: false,
              content: data.content
            }]);
            setActiveFilePath(`${rootDir}/OPERATION_MANUAL.md`);
            
            // Mark it as seen so it never auto-opens again
            localStorage.setItem('hasSeenManual', 'true');
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

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
    if (doc.virtual) return;

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
    const commitDoc = openDocuments.find((d) => d.path === filepath);
    if (!commitDoc || commitDoc.virtual) return;
    try {
      const res = await fetch(`/api/fs/git-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filepath })
      });
      if (res.ok) {
        const data = await res.json();
        showSessionToast(data.message);
      }
    } catch (e) {
      console.error('Git commit error:', e);
    }
  };

  const handleInspectText = (text) => {
    inspectCountRef.current += 1;
    const count  = inspectCountRef.current;
    const name   = `Inspect ${count}`;
    const path   = `__inspect__/inspect_${count}_${Date.now()}`;
    const newDoc = { name, path, content: text, isModified: false, virtual: true };
    setOpenDocuments((prev) => [...prev, newDoc]);
    setActiveFilePath(path);
    setExplorerSubTab('editor');
    setActiveMainTab('explorer');
  };

  const handleSaveAs = async (virtualPath, realPath, content) => {
    try {
      const res = await fetch('/api/fs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: realPath, content }),
      });
      if (!res.ok) {
        showSessionToast('Save As failed — check the file path');
        return;
      }
      setOpenDocuments((prev) =>
        prev.map((d) =>
          d.path === virtualPath
            ? { ...d, path: realPath, name: realPath.split('/').pop(), isModified: false, virtual: false }
            : d
        )
      );
      setActiveFilePath(realPath);
      setTreeRefreshKey((k) => k + 1);
      showSessionToast(`Saved as ${realPath.split('/').pop()}`);
    } catch (e) {
      showSessionToast('Save As failed — connection error');
    }
  };

  const suggestedSaveDir = (() => {
    if (activeFilePath && !activeFilePath.startsWith('__inspect__')) {
      const last = activeFilePath.lastIndexOf('/');
      return last > 0 ? activeFilePath.substring(0, last) : rootDir;
    }
    return rootDir;
  })();

  const handleCloseTab = (filepath, force = false) => {
    const doc = openDocuments.find((d) => d.path === filepath);
    if (!doc) return;

    // Safety backstop: never silently discard unsaved changes.
    // The CodeEditor UI already shows a Save/Discard/Cancel modal and calls
    // onCloseTab(path, true) after the user confirms — so this guard only
    // fires if handleCloseTab is ever called directly without force=true.
    if (!force && doc.isModified && !doc.virtual) return;

    const filtered = openDocuments.filter((d) => d.path !== filepath);
    setOpenDocuments(filtered);
    if (activeFilePath === filepath && filtered.length > 0) {
      setActiveFilePath(filtered[0].path);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className={`sovereign-layout ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
        <div className="login-modal-overlay">
          <div className="login-modal-card" style={{ maxWidth: '320px', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
            <div className="login-header" style={{ marginBottom: 0 }}>
              <h2>INITIALIZING SYSTEM...</h2>
              <p>Synchronizing configuration...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthVerified) {
    return (
      <div className={`sovereign-layout ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
        <div className="login-modal-overlay">
          <div className="login-modal-card" style={{ maxWidth: '320px', padding: '2.5rem 1.5rem' }}>
            <div className="login-header" style={{ marginBottom: 0 }}>
              <div className="login-icon-badge">
                <TerminalIcon size={22} color="var(--accent-mana)" />
              </div>
              <h2>SOVEREIGN TERMINAL</h2>
              <p>Verifying workstation session...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authEnabled && !isAuthenticated) {
    return (
      <div className={`sovereign-layout ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
        <LoginModal
          authMode={authMode}
          onLoginSuccess={async () => {
            // Call verify after login to resolve username before loading profile
            try {
              const res = await fetch('/api/auth/verify');
              if (res.ok) {
                const data = await res.json();
                const uname = data.username || 'default';
                setUsername(uname);
                if (data.auth_mode) setAuthMode(data.auth_mode);
                setIsAuthenticated(true);
                fetchUserSettings(uname);
              } else {
                setIsAuthenticated(true); // fallback — no profile load
              }
            } catch {
              setIsAuthenticated(true); // fallback
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`sovereign-layout ${isKeyboardOpen ? 'keyboard-open' : ''}`}>
      {/* Header with OmniState Logo & Vertically Stacked Title */}
      <header className="main-nav-bar" style={{ position: 'relative', width: '100%' }}>
        <div
          className={`brand-title ${showBrandMenu ? 'active' : ''}`}
          title="Session Controls (Tap to Open)"
          onClick={() => setShowBrandMenu((prev) => !prev)}
        >
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

        {/* Floating Brand Session Menu Pop-Up */}
        {showBrandMenu && (
          <div className="brand-menu-popup">
            <div className="brand-menu-header">
              SESSION ACTIVE ({authMode === 'pam' ? 'Linux OS PAM' : 'Token'})
            </div>
            <button
              type="button"
              className="brand-menu-logout-btn"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span>LOGOUT SESSION</span>
            </button>
          </div>
        )}

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
      <div
        className="tab-content-panel"
        style={{
          position: activeMainTab === 'terminal' ? 'relative' : 'absolute',
          left: activeMainTab === 'terminal' ? 0 : '-9999px',
          top: activeMainTab === 'terminal' ? 0 : '-9999px',
          visibility: activeMainTab === 'terminal' ? 'visible' : 'hidden',
          opacity: activeMainTab === 'terminal' ? 1 : 0,
          pointerEvents: activeMainTab === 'terminal' ? 'auto' : 'none',
          width: '100%',
          height: '100%'
        }}
      >
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
          rootDir={rootDir}
        />

        <div style={{ flex: '1 1 100%', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          {sessions.map((sess) => (
            <div
              key={sess.id}
              style={{
                position: activeSession === sess.id ? 'relative' : 'absolute',
                left: activeSession === sess.id ? 0 : '-9999px',
                top: activeSession === sess.id ? 0 : '-9999px',
                visibility: activeSession === sess.id ? 'visible' : 'hidden',
                opacity: activeSession === sess.id ? 1 : 0,
                pointerEvents: activeSession === sess.id ? 'auto' : 'none',
                flex: '1 1 100%',
                alignSelf: 'stretch',
                width: '100%',
                height: '100%',
                minHeight: 0,
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <Terminal
                session={sess}
                isActive={activeMainTab === 'terminal' && activeSession === sess.id}
                isKeyboardOpen={isKeyboardOpen}
                voiceInput={voiceInput}
                onCwdChange={(cwd) => setActiveTerminalPath(cwd)}
                rootDir={rootDir}
                onOpenFile={(filepath) => {
                  handleOpenFile(filepath);
                  setActiveMainTab('explorer');
                }}
                onInspectText={handleInspectText}
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
          <FileExplorer onCopyPath={handleInspectText} onOpenFile={handleOpenFile} activeTerminalPath={activeTerminalPath} rootDir={rootDir} currentPath={explorerPath} setCurrentPath={setExplorerPath} refreshKey={treeRefreshKey} />
        ) : (
          <CodeEditor
            openDocuments={openDocuments}
            activeFilePath={activeFilePath}
            onSelectTab={setActiveFilePath}
            onCloseTab={handleCloseTab}
            onContentChange={handleContentChange}
            onSaveFile={handleSaveFile}
            onGitCommit={handleGitCommit}
            onSaveAs={handleSaveAs}
            suggestedSaveDir={suggestedSaveDir}
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
