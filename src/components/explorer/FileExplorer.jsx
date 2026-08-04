import React, { useState, useEffect, useRef } from 'react';
import { Folder, FileText, ChevronRight, Search, Plus, Trash2, Download, Upload, RefreshCw, Home, CornerLeftUp, Terminal, Clipboard, FileCode, Check, CheckSquare, Square, FolderMinus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { writeToClipboard } from '../terminal/terminal/writeToClipboard';

export default function FileExplorer({ onCopyPath, onOpenFile, activeTerminalPath, rootDir, currentPath, setCurrentPath, refreshKey }) {
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
  const newFileInputRef = useRef(null);

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
        if (newFileInputRef.current) {
          newFileInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [newFileModal]);

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

  // Fetch directory contents from Sovereign Gateway
  const fetchDirectory = async (targetPath) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPath(data.currentPath);
        try {
          localStorage.setItem('sovereign_explorer_last_path', data.currentPath);
        } catch {}
        setItems(data.items);
        setSelectedItems([]);
      }
    } catch (e) {
      console.error('Failed to fetch directory tree:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(currentPath);
  }, [currentPath]);

  // External refresh trigger — fires when CodeEditor completes a Save As
  useEffect(() => {
    if (refreshKey > 0) fetchDirectory(currentPath);
  }, [refreshKey]);

  // Split path into interactive breadcrumbs
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

  // Archive to Dynamic Local Trash
  const handleArchiveSelected = async () => {
    if (selectedItems.length === 0) return;

    for (const itemPath of selectedItems) {
      try {
        const res = await fetch(`/api/fs/trash`, {
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
  };

  // Permanent Delete Trigger & Execution Handlers
  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    setPermanentDeleteModal(true);
  };

  const executePermanentDelete = async () => {
    setPermanentDeleteModal(false);
    if (selectedItems.length === 0) return;

    for (const itemPath of selectedItems) {
      try {
        const res = await fetch(`/api/fs/delete`, {
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

  // Sudo Elevation Retry Handler
  const handleSudoElevatedAction = async () => {
    if (!sudoElevationModal) return;
    const { itemPath, action } = sudoElevationModal;
    setSudoElevationModal(null);

    const endpoint = action === 'delete' ? '/api/fs/delete' : '/api/fs/trash';
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: itemPath, use_sudo: true }),
      });
    } catch (e) {
      console.error('Sudo elevation error:', e);
    }
    setSelectedItems([]);
    fetchDirectory(currentPath);
  };

  // Create new file or directory
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName) return;
    const targetPath = `${currentPath}/${newItemName}`;
    try {
      const res = await fetch(`/api/fs/create`, {
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

  // Single or Batch Download to Phone Storage
  const handleDownload = () => {
    const downloadPath = selectedItems.length > 0 ? selectedItems.join(',') : currentPath;
    window.location.href = `${window.location.origin}/api/fs/download?path=${encodeURIComponent(downloadPath)}`;
  };

  // Phone to Server Upload Handler
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
      if (res.ok) {
        fetchDirectory(currentPath);
      }
    } catch (e) {
      console.error('Upload error:', e);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <div className="file-explorer-container">
      {/* Explorer Action Header */}
      <div className="explorer-toolbar">
        <div className="breadcrumbs-row" style={{ overflowX: 'visible', overflowY: 'visible', flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', flex: 1, overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0, gap: '0.35rem' }}>
            {getBreadcrumbs().map((crumb, idx) => (
              <React.Fragment key={crumb.path}>
                <span className="crumb-item" onClick={() => fetchDirectory(crumb.path)}>
                  {crumb.name}
                </span>
                {idx < getBreadcrumbs().length - 1 && <ChevronRight size={12} color="var(--text-muted)" />}
              </React.Fragment>
            ))}
          </span>
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

        <div className="toolbar-actions">
          <button className="tb-btn" onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/') || '/')} title="Up One Level">
            <CornerLeftUp size={14} />
          </button>
          <button className="tb-btn" onClick={() => setCurrentPath(rootDir)} title="Home Directory">
            <Home size={14} />
          </button>
          <button className="tb-btn" onClick={() => setCurrentPath(activeTerminalPath)} title="Snap to Terminal">
            <Terminal size={14} />
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
          <button className="tb-btn" onClick={() => setNewFileModal(true)} title="New File/Folder">
            <Plus size={14} color="var(--status-active)" />
          </button>
          <button 
            className="tb-btn" 
            onClick={handleArchiveSelected} 
            title="Archive to Local _temp_trash"
            disabled={selectedItems.length === 0}
            style={{ opacity: selectedItems.length === 0 ? 0.4 : 1, cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <FolderMinus size={14} color={selectedItems.length === 0 ? 'var(--text-muted)' : 'var(--accent-mana)'} />
          </button>
          <button 
            className="tb-btn delete" 
            onClick={handleDeleteSelected} 
            title="Delete Permanently"
            disabled={selectedItems.length === 0}
            style={{ opacity: selectedItems.length === 0 ? 0.4 : 1, cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <Trash2 size={14} color={selectedItems.length === 0 ? 'var(--text-muted)' : 'var(--status-danger)'} />
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
      <div className="file-tree-list">
        {filteredItems.map((item) => (
          <div
            key={item.path}
            className={`tree-item ${selectedItems.includes(item.path) ? 'selected' : ''}`}
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
            {item.isDir ? <Folder size={16} color="var(--accent-mana)" /> : <FileText size={16} color="var(--status-active)" />}
            <span className="tree-item-name">{item.name}</span>
            {item.size && <span className="tree-item-size">{item.size}</span>}
          </div>
        ))}
      </div>

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
            <h3>+ Create New File / Directory</h3>
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
              You do not have Linux system write permissions to delete or move <strong>{accessDeniedModal.itemPath.split('/').pop()}</strong>.
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
