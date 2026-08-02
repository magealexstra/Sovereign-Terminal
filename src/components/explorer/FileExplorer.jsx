import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, Search, Plus, Trash2, Download, Upload, RefreshCw, Home, CornerLeftUp, Terminal, Clipboard, FileCode, Check } from 'lucide-react';
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

  // Golden Rule of Deletion: Move to ./_temp_trash/
  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    if (!confirm(`Move ${selectedItems.length} item(s) to _temp_trash?`)) return;

    for (const itemPath of selectedItems) {
      try {
        await fetch(`/api/fs/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: itemPath }),
        });
      } catch (e) {
        console.error('Delete error:', e);
      }
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
          <button className="tb-btn" onClick={() => setNewFileModal(true)} title="New File/Folder">
            <Plus size={14} color="var(--status-active)" />
          </button>
          {selectedItems.length > 0 && (
            <button className="tb-btn delete" onClick={handleDeleteSelected} title="Move to Trash">
              <Trash2 size={14} color="var(--status-danger)" />
            </button>
          )}
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
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>🔍 Search Directory Files</h3>
            <input
              type="text"
              className="modal-input"
              placeholder="Search filenames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button className="modal-close-btn" onClick={() => setShowSearchModal(false)}>Done</button>
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
              type="text"
              className="modal-input"
              placeholder="Filename (e.g. notes.md)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              required
            />
            <div className="modal-btn-row">
              <button type="button" onClick={() => setNewFileModal(false)}>Cancel</button>
              <button type="submit" className="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
