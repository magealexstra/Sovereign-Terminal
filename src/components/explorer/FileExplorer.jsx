import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, Search, Plus, Trash2, Download, Upload, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function FileExplorer({ onOpenFile, activeTerminalPath }) {
  const [currentPath, setCurrentPath] = useState(activeTerminalPath || '/workspace');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newFileModal, setNewFileModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('file');

  // Fetch directory contents from Sovereign Gateway
  const fetchDirectory = async (targetPath) => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/tree?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPath(data.currentPath);
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
  }, []);

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
        await fetch(`http://${window.location.hostname}:2068/api/fs/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: itemPath }),
        });
      } catch (e) {
        console.error('Delete error:', e);
      }
    }
    fetchDirectory(currentPath);
  };

  // Create new file or directory
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemName) return;
    const targetPath = `${currentPath}/${newItemName}`;
    try {
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/create`, {
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
    const downloadPath = selectedItems.length > 0 ? selectedItems[0] : currentPath;
    window.location.href = `http://${window.location.hostname}:2068/api/fs/download?path=${encodeURIComponent(downloadPath)}`;
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
      const res = await fetch(`http://${window.location.hostname}:2068/api/fs/upload?target_dir=${encodeURIComponent(currentPath)}`, {
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
        <div className="breadcrumbs-row">
          {getBreadcrumbs().map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              <span className="crumb-item" onClick={() => fetchDirectory(crumb.path)}>
                {crumb.name}
              </span>
              {idx < getBreadcrumbs().length - 1 && <ChevronRight size={12} color="#A3B1B8" />}
            </React.Fragment>
          ))}
        </div>

        <div className="toolbar-actions">
          <button className="tb-btn" onClick={() => fetchDirectory(currentPath)} title="Refresh Directory">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="tb-btn" onClick={() => setShowSearchModal(true)} title="Tab-Scoped File Search">
            <Search size={14} color="#88C0D0" />
          </button>
          <button className="tb-btn" onClick={() => setNewFileModal(true)} title="New File/Folder">
            <Plus size={14} color="#4C7864" />
          </button>
          {selectedItems.length > 0 && (
            <button className="tb-btn delete" onClick={handleDeleteSelected} title="Move to Trash">
              <Trash2 size={14} color="#FF003C" />
            </button>
          )}
          <button className="tb-btn" onClick={handleDownload} title="Download to Phone">
            <Download size={14} />
          </button>
          <label className="tb-btn upload-label" title="Upload from Phone">
            <Upload size={14} />
            <input type="file" multiple onChange={handleUpload} style={{ display: 'none' }} />
          </label>
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
              onChange={(e) => {
                e.stopPropagation();
                handleSelectItem(item.path);
              }}
            />
            {item.isDir ? <Folder size={16} color="#88C0D0" /> : <FileText size={16} color="#4C7864" />}
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
