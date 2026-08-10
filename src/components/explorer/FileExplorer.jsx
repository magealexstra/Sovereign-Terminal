import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FileText, ChevronRight, Search, Download, Upload, RefreshCw, Home, CornerLeftUp, Terminal, TerminalSquare, Clipboard, FileCode, Check, CheckSquare, Square } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { writeToClipboard } from '../terminal/terminal/writeToClipboard';
import ExplorerContextMenu from './ExplorerContextMenu';
import { getFileBrandColor, getFileExtension } from '../../utils/fileColors';

export default function FileExplorer({ onCopyPath, onOpenFile, onOpenTerminal, activeTerminalPath, rootDir, currentPath, setCurrentPath, refreshKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFileModal, setNewFileModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('file');
  const [destinationMode, setDestinationMode] = useState('clip');
  const [copied, setCopied] = useState(false);
  const [permanentDeleteModal, setPermanentDeleteModal] = useState(false);
  const [isSudoer, setIsSudoer] = useState(false);
  const [sudoElevationModal, setSudoElevationModal] = useState(null);
  const [accessDeniedModal, setAccessDeniedModal] = useState(null);

  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [clipboardItems, setClipboardItems] = useState([]);
  const [clipboardMode, setClipboardMode] = useState(null); // 'cut' | 'copy'

  // Rename modal state
  const [renameModal, setRenameModal] = useState({ visible: false, itemPath: '', currentName: '' });
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const newFileInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    fetch('/api/auth/verify')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.is_sudoer !== undefined) {
          setIsSudoer(!!data.is_sudoer);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (newFileModal) {
      const timer = setTimeout(() => {
        if (newFileInputRef.current) newFileInputRef.current.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [newFileModal]);

  useEffect(() => {
    if (renameModal.visible) {
      setRenameValue(renameModal.currentName);
      setRenameError('');
      const timer = setTimeout(() => {
        if (renameInputRef.current) renameInputRef.current.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [renameModal.visible]);

  useEffect(() => {
    const loadDest = () => {
      try {
        const d = localStorage.getItem('sovereign_copy_destination');
        if (d === 'code') setDestinationMode('code');
        else setDestinationMode('clip');
      } catch {}
    };
    loadDest();
    window.addEventListener('storage', loadDest);
    return () => window.removeEventListener('storage', loadDest);
  }, []);

  const fetchDirectory = async (targetPath) => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(targetPath)}`);
      if (fetchId !== fetchIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (fetchId !== fetchIdRef.current) return;
        setCurrentPath(data.currentPath);
        try {
          localStorage.setItem('sovereign_explorer_last_path', data.currentPath);
        } catch {}
        setItems(data.items);
        setSelectedItems([]);
      }
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('Failed to fetch directory tree:', e);
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (refreshKey > 0) fetchDirectory(currentPath);
  }, [refreshKey]);

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Root', path: '/' }];
    let acc = '';
    parts.forEach((p) => {
      acc += '/' + p;
      crumbs.push({ name: p, path: acc });
    });
    return crumbs;
  };

  const handleSelectItem = (itemPath) => {
    setSelectedItems((prev) =>
      prev.includes(itemPath) ? prev.filter((p) => p !== itemPath) : [...prev, itemPath]
    );
  };

  // ── Long Press / Context Menu ──────────────────────────────────────────────

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startLongPress = useCallback((e, item = null) => {
    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      if (item && !selectedItems.includes(item.path)) {
        setSelectedItems([item.path]);
      }
      setContextMenuVisible(true);
    }, 500);
  }, [cancelLongPress, selectedItems]);

  const handleContextMenuOpen = useCallback((e, item = null) => {
    e.preventDefault();
    if (item && !selectedItems.includes(item.path)) {
      setSelectedItems([item.path]);
    }
    setContextMenuVisible(true);
  }, [selectedItems]);

  // ── Clipboard Operations ───────────────────────────────────────────────────

  const handleCut = useCallback(() => {
    if (selectedItems.length === 0) return;
    setClipboardItems([...selectedItems]);
    setClipboardMode('cut');
    setSelectedItems([]);
  }, [selectedItems]);

  const handleCopyFiles = useCallback(() => {
    if (selectedItems.length === 0) return;
    setClipboardItems([...selectedItems]);
    setClipboardMode('copy');
    setSelectedItems([]);
  }, [selectedItems]);

  const handlePaste = useCallback(async () => {
    if (clipboardItems.length === 0 || !clipboardMode) return;
    const endpoint = clipboardMode === 'cut' ? '/api/fs/move' : '/api/fs/copy';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: clipboardItems, destination: currentPath }),
      });
      if (res.status === 403) {
        if (isSudoer) {
          setSudoElevationModal({ itemPath: clipboardItems[0], action: clipboardMode === 'cut' ? 'move' : 'copy' });
        } else {
          setAccessDeniedModal({ itemPath: clipboardItems[0] });
        }
        return;
      }
      if (res.ok) {
        setClipboardItems([]);
        setClipboardMode(null);
        fetchDirectory(currentPath);
      }
    } catch (e) {
      console.error('Paste error:', e);
    }
  }, [clipboardItems, clipboardMode, currentPath, isSudoer]);

  const handleDuplicate = useCallback(async (itemPath) => {
    try {
      const res = await fetch('/api/fs/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: [itemPath], destination: currentPath }),
      });
      if (res.ok) fetchDirectory(currentPath);
    } catch (e) {
      console.error('Duplicate error:', e);
    }
  }, [currentPath]);

  // ── Rename ─────────────────────────────────────────────────────────────────

  const openRenameModal = useCallback((itemPath) => {
    const name = itemPath.split('/').pop();
    setRenameModal({ visible: true, itemPath, currentName: name });
  }, []);

  const executeRename = async (e) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renameModal.currentName) {
      setRenameModal({ visible: false, itemPath: '', currentName: '' });
      return;
    }
    try {
      const res = await fetch('/api/fs/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: renameModal.itemPath, new_name: trimmed }),
      });
      if (res.status === 409) {
        setRenameError(`"${trimmed}" already exists in this directory.`);
        return;
      }
      if (res.status === 403) {
        if (isSudoer) {
          setSudoElevationModal({ itemPath: renameModal.itemPath, action: 'rename', newName: trimmed });
        } else {
          setAccessDeniedModal({ itemPath: renameModal.itemPath });
        }
        setRenameModal({ visible: false, itemPath: '', currentName: '' });
        return;
      }
      if (res.ok) {
        setRenameModal({ visible: false, itemPath: '', currentName: '' });
        setSelectedItems([]);
        fetchDirectory(currentPath);
      }
    } catch (e) {
      console.error('Rename error:', e);
    }
  };

  // ── Compress ───────────────────────────────────────────────────────────────

  const handleCompress = useCallback(async () => {
    if (selectedItems.length === 0) return;
    try {
      const res = await fetch('/api/fs/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: selectedItems, destination: currentPath }),
      });
      if (res.ok) {
        setSelectedItems([]);
        fetchDirectory(currentPath);
      }
    } catch (e) {
      console.error('Compress error:', e);
    }
  }, [selectedItems, currentPath]);

  // ── Archive / Delete ───────────────────────────────────────────────────────

  const handleArchiveSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    for (const itemPath of selectedItems) {
      try {
        const res = await fetch('/api/fs/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: itemPath }),
        });
        if (res.status === 403) {
          if (isSudoer) {
            setSudoElevationModal({ itemPath, action: 'trash' });
            return;
          } else {
            setAccessDeniedModal({ itemPath });
            return;
          }
        }
      } catch (e) {
        console.error('Archive error:', e);
      }
    }
    setSelectedItems([]);
    fetchDirectory(currentPath);
  }, [selectedItems, isSudoer, currentPath]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    setPermanentDeleteModal(true);
  }, [selectedItems]);

  const executePermanentDelete = async () => {
    setPermanentDeleteModal(false);
    if (selectedItems.length === 0) return;
    for (const itemPath of selectedItems) {
      try {
        const res = await fetch('/api/fs/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: itemPath }),
        });
        if (res.status === 403) {
          if (isSudoer) {
            setSudoElevationModal({ itemPath, action: 'delete' });
            return;
          } else {
            setAccessDeniedModal({ itemPath });
            return;
          }
        }
      } catch (e) {
        console.error('Delete error:', e);
      }
    }
    setSelectedItems([]);
    fetchDirectory(currentPath);
  };

  // ── Sudo Elevation Retry ───────────────────────────────────────────────────

  const handleSudoElevatedAction = async () => {
    if (!sudoElevationModal) return;
    const { itemPath, action, newName } = sudoElevationModal;
    setSudoElevationModal(null);

    let endpoint = '/api/fs/trash';
    let body = { path: itemPath, use_sudo: true };
    if (action === 'delete') { endpoint = '/api/fs/delete'; }
    if (action === 'move')   { endpoint = '/api/fs/move';   body = { sources: clipboardItems, destination: currentPath, use_sudo: true }; }
    if (action === 'copy')   { endpoint = '/api/fs/copy';   body = { sources: clipboardItems, destination: currentPath, use_sudo: true }; }
    if (action === 'rename') { endpoint = '/api/fs/rename'; body = { source: itemPath, new_name: newName, use_sudo: true }; }

    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error('Sudo elevation error:', e);
    }
    if (action === 'move' || action === 'copy') {
      setClipboardItems([]);
      setClipboardMode(null);
    }
    setSelectedItems([]);
    fetchDirectory(currentPath);
  };

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName) return;
    const targetPath = `${currentPath}/${newItemName}`;
    try {
      const res = await fetch('/api/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, type: newItemType }),
      });
      if (res.ok) {
        setNewFileModal(false);
        setNewItemName('');
        fetchDirectory(currentPath);
      }
    } catch (e) {
      console.error('Create error:', e);
    }
  };

  // ── Download / Upload ──────────────────────────────────────────────────────

  const handleDownload = () => {
    const downloadPath = selectedItems.length > 0 ? selectedItems.join(',') : currentPath;
    window.location.href = `${window.location.origin}/api/fs/download?path=${encodeURIComponent(downloadPath)}`;
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      const res = await fetch(`/api/fs/upload?target_dir=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) fetchDirectory(currentPath);
    } catch (e) {
      console.error('Upload error:', e);
    }
  };

  // ── Open handlers (from context menu) ─────────────────────────────────────

  const handleOpenItem = useCallback((itemPath) => {
    const item = items.find((i) => i.path === itemPath);
    if (!item) return;
    if (item.isDir) fetchDirectory(itemPath);
    else onOpenFile(itemPath);
  }, [items, onOpenFile]);

  const handleOpenInTerminal = useCallback((itemPath) => {
    if (onOpenTerminal) onOpenTerminal(itemPath);
  }, [onOpenTerminal]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const filteredItems = items
    .filter((item) => item && item.name)
    .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedItems.includes(item.path));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      const visiblePathSet = new Set(filteredItems.map((i) => i.path));
      setSelectedItems((prev) => prev.filter((path) => !visiblePathSet.has(path)));
    } else {
      const visiblePaths = filteredItems.map((i) => i.path);
      setSelectedItems((prev) => Array.from(new Set([...prev, ...visiblePaths])));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="file-explorer-container">
      {/* Explorer Action Header */}
      <div className="explorer-header-wrapper">
        {/* Row 1: Breadcrumbs & Copy Path */}
        <div className="explorer-breadcrumbs-bar">
          <div className="breadcrumbs-scroll-container">
            {getBreadcrumbs().map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                <span className="crumb-item" onClick={() => fetchDirectory(crumb.path)}>
                  {crumb.name}
                </span>
                {idx < getBreadcrumbs().length - 1 && <ChevronRight size={12} color="var(--text-muted)" />}
              </React.Fragment>
            ))}
          </div>
          <button
            className="tb-btn"
            style={{ flexShrink: 0, borderColor: 'var(--status-active)', marginLeft: '0.5rem' }}
            title={destinationMode === 'clip' ? 'Copy Path to Clipboard' : 'Open Path in Code Editor'}
            onClick={() => {
              const crumbs = getBreadcrumbs();
              const pathToCopy = crumbs[crumbs.length - 1]?.path || '/';
              if (destinationMode === 'clip') {
                writeToClipboard(pathToCopy).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              } else {
                if (onCopyPath) onCopyPath(pathToCopy);
              }
            }}
          >
            {copied ? <Check size={14} color="var(--status-active)" /> : (destinationMode === 'clip' ? <Clipboard size={14} /> : <FileCode size={14} />)}
          </button>
        </div>

        {/* Row 2: Action Buttons — navigation and utility only */}
        <div className="explorer-actions-bar">
          <button className="tb-btn" onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/') || '/')} title="Up One Level">
            <CornerLeftUp size={14} />
          </button>
          <button className="tb-btn" onClick={() => setCurrentPath(rootDir)} title="Home Directory">
            <Home size={14} />
          </button>
          <button className="tb-btn" onClick={() => setCurrentPath(activeTerminalPath)} title="Snap to Terminal">
            <Terminal size={14} />
          </button>
          <button className="tb-btn" onClick={() => onOpenTerminal && onOpenTerminal(currentPath)} title="Open New Terminal Here">
            <TerminalSquare size={14} />
          </button>
          <button className="tb-btn" onClick={() => fetchDirectory(currentPath)} title="Refresh Directory">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button
            className={`tb-btn ${allVisibleSelected ? 'active' : ''}`}
            onClick={handleToggleSelectAll}
            title={allVisibleSelected ? 'Deselect All Visible Items' : 'Select All Visible Items'}
          >
            {allVisibleSelected ? (
              <CheckSquare size={14} color="var(--status-active)" />
            ) : (
              <Square size={14} />
            )}
          </button>
          <button className="tb-btn" onClick={handleDownload} title="Download to Phone">
            <Download size={14} />
          </button>
          <label className="tb-btn upload-label" title="Upload from Phone">
            <Upload size={14} />
            <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} />
          </label>
          <button className="tb-btn" onClick={() => setShowSearchModal(true)} title="Tab-Scoped File Search">
            <Search size={14} color="var(--accent-mana)" />
          </button>
        </div>
      </div>

      {/* Directory Item List */}
      <div
        className="file-tree-list"
        onContextMenu={(e) => handleContextMenuOpen(e, null)}
      >
        {filteredItems.map((item) => (
          <div
            key={item.path}
            className={`tree-item ${selectedItems.includes(item.path) ? 'selected' : ''}`}
            onTouchStart={(e) => { e.preventDefault(); startLongPress(e, item); }}
            onTouchMove={cancelLongPress}
            onTouchEnd={cancelLongPress}
            onContextMenu={(e) => handleContextMenuOpen(e, item)}
            onClick={() => {
              if (item.isDir) {
                fetchDirectory(item.path);
              } else {
                onOpenFile(item.path);
              }
            }}
          >
            <input
              type="checkbox"
              className="item-checkbox"
              checked={selectedItems.includes(item.path)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectItem(item.path);
              }}
            />
            {item.isDir
              ? <Folder size={16} color="var(--accent-mana)" />
              : <FileText size={16} color="var(--status-active)" />}
            <span className="tree-item-name">{item.name}</span>
            <span className="tree-item-ext" style={{ color: getFileBrandColor(item.name) }}>
              {getFileExtension(item.name, item.isDir) || ''}
            </span>
            <span className="tree-item-size">{item.size || (item.isDir ? '—' : '')}</span>
          </div>
        ))}
      </div>

      {/* Context Menu Bottom Sheet */}
      <ExplorerContextMenu
        visible={contextMenuVisible}
        selectedItems={selectedItems}
        allItems={items}
        clipboardItems={clipboardItems}
        clipboardMode={clipboardMode}
        currentPath={currentPath}
        onClose={() => setContextMenuVisible(false)}
        onNew={() => setNewFileModal(true)}
        onOpen={handleOpenItem}
        onOpenInTerminal={handleOpenInTerminal}
        onRename={openRenameModal}
        onCut={handleCut}
        onCopy={handleCopyFiles}
        onPaste={handlePaste}
        onDuplicate={handleDuplicate}
        onCompress={handleCompress}
        onArchive={handleArchiveSelected}
        onDelete={handleDeleteSelected}
      />

      {/* File Search Modal */}
      {showSearchModal && (
        <div className="explorer-modal-overlay" onClick={() => setShowSearchModal(false)}>
          <div className="explorer-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Search size={18} color="var(--accent-mana)" />
              <h3>Search Directory Files</h3>
            </div>
            <input
              type="text"
              className="modal-input"
              placeholder="Search filenames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className="modal-btn-row">
              <button type="button" onClick={() => setShowSearchModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* New File/Folder Modal */}
      {newFileModal && (
        <div className="explorer-modal-overlay" onClick={() => setNewFileModal(false)}>
          <form className="explorer-modal-card" onSubmit={handleCreateItem} onClick={(e) => e.stopPropagation()}>
            <h3>Create New {newItemType === 'directory' ? 'Directory' : 'File'}</h3>
            <div className="modal-radio-group">
              <label>
                <input
                  type="radio"
                  name="type"
                  checked={newItemType === 'file'}
                  onChange={() => setNewItemType('file')}
                /> File
              </label>
              <label>
                <input
                  type="radio"
                  name="type"
                  checked={newItemType === 'directory'}
                  onChange={() => setNewItemType('directory')}
                /> Directory
              </label>
            </div>
            <input
              ref={newFileInputRef}
              type="text"
              className="modal-input"
              placeholder="Filename (e.g. notes.md)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              autoFocus
              required
            />
            <div className="modal-btn-row">
              <button type="button" onClick={() => setNewFileModal(false)}>Cancel</button>
              <button type="submit" className="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.visible && (
        <div className="explorer-modal-overlay" onClick={() => setRenameModal({ visible: false, itemPath: '', currentName: '' })}>
          <form className="explorer-modal-card" onSubmit={executeRename} onClick={(e) => e.stopPropagation()}>
            <h3>Rename Item</h3>
            <input
              ref={renameInputRef}
              type="text"
              className="modal-input"
              value={renameValue}
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
              autoFocus
              required
            />
            {renameError && (
              <p style={{ color: 'var(--status-danger)', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
                {renameError}
              </p>
            )}
            <div className="modal-btn-row">
              <button type="button" onClick={() => setRenameModal({ visible: false, itemPath: '', currentName: '' })}>Cancel</button>
              <button type="submit" className="submit">Rename</button>
            </div>
          </form>
        </div>
      )}

      {/* Permanent Delete Warning Modal */}
      {permanentDeleteModal && (
        <div className="explorer-modal-overlay" onClick={() => setPermanentDeleteModal(false)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--status-danger)', borderBottom: '1px solid var(--border-forest)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              WARNING: Permanent Deletion
            </h3>
            <p style={{ color: 'var(--text-parchment)', fontSize: '0.88rem', lineHeight: '1.4', margin: '0.85rem 0' }}>
              Are you sure you want to permanently delete <strong>{selectedItems.length} item(s)</strong>? This action CANNOT be undone.
            </p>
            <div className="modal-btn-row">
              <button type="button" onClick={() => setPermanentDeleteModal(false)}>Cancel</button>
              <button type="button" className="delete" onClick={executePermanentDelete}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Sudo Elevation Modal */}
      {sudoElevationModal && (
        <div className="explorer-modal-overlay" onClick={() => setSudoElevationModal(null)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--accent-mana)', borderBottom: '1px solid var(--border-forest)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Permission Denied: Administrator Required
            </h3>
            <p style={{ color: 'var(--text-parchment)', fontSize: '0.88rem', lineHeight: '1.4', margin: '0.85rem 0' }}>
              System write permission was denied for <strong>{sudoElevationModal.itemPath.split('/').pop()}</strong>. Would you like to proceed as Administrator (sudo)?
            </p>
            <div className="modal-btn-row">
              <button type="button" onClick={() => setSudoElevationModal(null)}>Cancel</button>
              <button type="button" className="submit" onClick={handleSudoElevatedAction}>Proceed as Administrator</button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal */}
      {accessDeniedModal && (
        <div className="explorer-modal-overlay" onClick={() => setAccessDeniedModal(null)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--status-danger)', borderBottom: '1px solid var(--border-forest)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              Access Denied: Permission Required
            </h3>
            <p style={{ color: 'var(--text-parchment)', fontSize: '0.88rem', lineHeight: '1.4', margin: '0.85rem 0' }}>
              You do not have Linux system write permissions to modify <strong>{accessDeniedModal.itemPath.split('/').pop()}</strong>.
            </p>
            <div className="modal-btn-row">
              <button type="button" onClick={() => setAccessDeniedModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
