import React, { useState, useEffect, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { Save, GitCommit, Search, Copy, Clipboard, Undo, Redo, X, Terminal as TermIcon, FileText, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function CodeEditor({ openDocuments, activeFilePath, onSelectTab, onCloseTab, onContentChange, onSaveFile, onGitCommit, onReturnToTerminal }) {
  const { theme } = useApp();
  const [closeConfirmModal, setCloseConfirmModal] = useState(null);
  const pressTimer = useRef(null);

  const activeDoc = openDocuments.find((doc) => doc.path === activeFilePath) || openDocuments[0];

  const getLanguageExtension = (filename) => {
    if (!filename) return [markdown()];
    if (filename.endsWith('.py')) return [python()];
    if (filename.endsWith('.json')) return [json()];
    if (filename.endsWith('.md')) return [markdown()];
    return [javascript({ jsx: true })];
  };

  const isImageFile = (filename) => {
    if (!filename) return false;
    return /\.(png|jpe?g|webp|svg|gif)$/i.test(filename);
  };

  // Single-Tap vs Long-Press Tab Close Safeguard
  const handleTabClosePress = (docPath) => {
    pressTimer.current = setTimeout(() => {
      onCloseTab(docPath, true);
    }, 700);
  };

  const handleTabCloseRelease = (docPath, isModified) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    if (isModified) {
      setCloseConfirmModal(docPath);
    } else {
      onCloseTab(docPath, false);
    }
  };

  if (!activeDoc) {
    return (
      <div className="editor-empty-state">
        <FileText size={48} color="#A3B1B8" />
        <h3>No Open Documents</h3>
        <p>Select a file from the File Explorer or tap a link in the Terminal to open a document.</p>
        <button onClick={onReturnToTerminal} className="empty-return-btn">
          <TermIcon size={14} />
          <span>Return to Terminal</span>
        </button>
      </div>
    );
  }

  return (
    <div className="code-editor-workspace">
      {/* Browser-Style Document Tabs Bar */}
      <div className="editor-tabs-bar">
        {openDocuments.map((doc) => (
          <div
            key={doc.path}
            className={`doc-pill-btn ${activeFilePath === doc.path ? 'active' : ''}`}
            onClick={() => onSelectTab(doc.path)}
          >
            <FileText size={13} />
            <span className="doc-tab-title">{doc.name}</span>
            {doc.isModified && <span className="modified-dot">•</span>}
            <button
              className="doc-tab-close"
              onMouseDown={() => handleTabClosePress(doc.path)}
              onMouseUp={() => handleTabCloseRelease(doc.path, doc.isModified)}
              onTouchStart={() => handleTabClosePress(doc.path)}
              onTouchEnd={() => handleTabCloseRelease(doc.path, doc.isModified)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Editor Sub-Header Bar */}
      <div className="editor-subheader">
        <span className="active-doc-path">{activeDoc.path}</span>
        <button className="term-return-btn" onClick={onReturnToTerminal}>
          <TermIcon size={13} />
          <span>Return to Terminal</span>
        </button>
      </div>

      {/* Main Workspace (CodeMirror 6 with Word Wrap Enabled by Default / Image Preview) */}
      <div className="editor-viewport">
        {isImageFile(activeDoc.path) ? (
          <div className="image-preview-container">
            <ImageIcon size={32} color="#88C0D0" />
            <img src={`http://${window.location.hostname}:2068/api/fs/read?path=${encodeURIComponent(activeDoc.path)}`} alt={activeDoc.name} />
          </div>
        ) : (
          <CodeMirror
            value={activeDoc.content || ''}
            height="100%"
            theme={oneDark}
            extensions={[
              ...getLanguageExtension(activeDoc.path),
              EditorView.lineWrapping // Word Wrap Enabled by Default
            ]}
            onChange={(value) => onContentChange(activeDoc.path, value)}
          />
        )}
      </div>

      {/* Dedicated Editor Touch Bar */}
      <div className="editor-touch-bar">
        <button className="editor-touch-btn save" onClick={() => onSaveFile(activeDoc.path)}>
          <Save size={14} />
          <span>SAVE</span>
        </button>
        <button className="editor-touch-btn commit" onClick={() => onGitCommit(activeDoc.path)}>
          <GitCommit size={14} />
          <span>SAVE & COMMIT</span>
        </button>
        <button className="editor-touch-btn" onClick={() => document.execCommand('copy')}>
          <Copy size={14} />
        </button>
        <button className="editor-touch-btn" onClick={() => document.execCommand('paste')}>
          <Clipboard size={14} />
        </button>
        <button className="editor-touch-btn" onClick={onReturnToTerminal}>
          <TermIcon size={14} />
        </button>
      </div>

      {/* Unsaved File Close Check Safeguard Modal */}
      {closeConfirmModal && (
        <div className="explorer-modal-overlay" onClick={() => setCloseConfirmModal(null)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Unsaved Changes</h3>
            <p>Save changes to <strong>{closeConfirmModal.split('/').pop()}</strong> before closing?</p>
            <div className="modal-btn-row">
              <button
                className="submit"
                onClick={() => {
                  onSaveFile(closeConfirmModal);
                  onCloseTab(closeConfirmModal, true);
                  setCloseConfirmModal(null);
                }}
              >
                Save & Close
              </button>

              <button
                className="delete"
                onClick={() => {
                  onCloseTab(closeConfirmModal, true);
                  setCloseConfirmModal(null);
                }}
              >
                Discard
              </button>

              <button onClick={() => setCloseConfirmModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
