import React, { useState, useEffect, useRef } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { cpp } from '@codemirror/lang-cpp';
import { rust } from '@codemirror/lang-rust';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { Save, GitCommit, Copy, Clipboard, X, Terminal as TermIcon, FileText, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/useToast';

export default function CodeEditor({ openDocuments, activeFilePath, onSelectTab, onCloseTab, onContentChange, onSaveFile, onGitCommit, onReturnToTerminal }) {
  const { theme, editorFontSizePx } = useApp();
  const { toast: editorToast, showToast: triggerToast } = useToast(2000);
  const [closeConfirmModal, setCloseConfirmModal] = useState(null);
  const pressTimer = useRef(null);

  const activeDoc = openDocuments.find((doc) => doc.path === activeFilePath) || openDocuments[0];

  const getLanguageExtension = (filename) => {
    if (!filename) return [markdown()];
    const fn = filename.toLowerCase();
    if (fn.endsWith('.js') || fn.endsWith('.jsx') || fn.endsWith('.ts') || fn.endsWith('.tsx')) return [javascript({ jsx: true })];
    if (fn.endsWith('.py') || fn.endsWith('.mpy') || fn.endsWith('.upy')) return [python()];
    if (fn.endsWith('.json')) return [json()];
    if (fn.endsWith('.md')) return [markdown()];
    if (fn.endsWith('.c') || fn.endsWith('.cpp') || fn.endsWith('.h') || fn.endsWith('.hpp')) return [cpp()];
    if (fn.endsWith('.rs')) return [rust()];
    if (fn.endsWith('.html') || fn.endsWith('.htm')) return [html()];
    if (fn.endsWith('.css')) return [css()];
    if (fn.endsWith('.xml') || fn.endsWith('.svg')) return [xml()];
    if (fn.endsWith('.sql')) return [sql()];
    return [];
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
  };

  // Fallback copy helper for non-secure HTTP contexts where navigator.clipboard is disabled.
  const writeToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('execCommand copy failed'));
    });
  };

  // Touch Bar Clipboard Handlers (Modern Clipboard API)
  const handleCopyContent = () => {
    if (activeDoc && activeDoc.content) {
      writeToClipboard(activeDoc.content).then(() => {
        triggerToast('Document Copied');
      }).catch(() => {
        triggerToast('Copy Failed');
      });
    }
  };

  const handlePasteContent = () => {
    if (!navigator.clipboard || !window.isSecureContext) {
      triggerToast('Paste requires HTTPS');
      return;
    }
    navigator.clipboard.readText().then((clipText) => {
      if (clipText && activeDoc) {
        onContentChange(activeDoc.path, (activeDoc.content || '') + clipText);
        triggerToast('Clipboard Pasted');
      }
    }).catch(() => {
      triggerToast('Clipboard Permission Denied');
    });
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

  const getFileBrandColor = (filename) => {
    if (!filename) return '#88C0D0';
    const fn = filename.toLowerCase();
    if (fn.endsWith('.py')) return '#3776AB'; // Python Blue
    if (fn.endsWith('.js') || fn.endsWith('.jsx')) return '#F7DF1E'; // JS Yellow
    if (fn.endsWith('.ts') || fn.endsWith('.tsx')) return '#3178C6'; // TS Blue
    if (fn.endsWith('.html')) return '#E34F26'; // HTML5 Orange
    if (fn.endsWith('.css')) return '#1572B6'; // CSS3 Blue
    if (fn.endsWith('.sh') || fn.endsWith('.bash') || fn.endsWith('.zsh')) return '#4EAA25'; // Shell Green
    if (fn.endsWith('.json')) return '#F9A825'; // JSON Gold
    if (fn.endsWith('.md')) return '#083FA1'; // Markdown Blue
    if (fn.endsWith('.yaml') || fn.endsWith('.yml')) return '#CB171E'; // YAML Red
    if (fn.includes('docker') || fn.endsWith('.dockerignore')) return '#2496ED'; // Docker Blue
    return '#A3B1B8'; // Default Muted
  };

  return (
    <div className="code-editor-workspace">
      {/* Dynamic Multi-Document Tab Bar */}
      <div className="editor-tabs-bar">
        {openDocuments.map((doc) => {
          const brandColor = getFileBrandColor(doc.name);
          const isActive = activeFilePath === doc.path;

          return (
            <button
              key={doc.path}
              type="button"
              className={`doc-pill-btn ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? brandColor : 'var(--border-forest)',
                color: isActive ? 'var(--text-parchment)' : 'var(--text-muted)',
                background: isActive ? 'var(--bg-earth)' : 'var(--bg-canopy)',
                boxShadow: isActive ? `0 0 10px ${brandColor}50` : 'none',
                transition: 'all 0.15s ease'
              }}
              onClick={() => onSelectTab(doc.path)}
              onTouchStart={() => handleTabClosePress(doc.path)}
              onTouchEnd={() => handleTabCloseRelease(doc.path, doc.isModified)}
              onMouseDown={() => {
                isTouchDevice.current = false;
              }}
            >
              <FileText size={13} color={brandColor} />
              <span className="tab-filename">{doc.name}</span>
              {doc.isModified && <span className="modified-dot" style={{ backgroundColor: brandColor }} title="Unsaved Changes" />}
              <span
                className="close-tab-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (doc.isModified) {
                    setCloseConfirmModal(doc.path);
                  } else {
                    onCloseTab(doc.path, false);
                  }
                }}
                title="Close File (Long-press forces close)"
              >
                <X size={11} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Editor Viewport or Image Preview Card */}
      <div className="editor-viewport">
        {editorToast && (
          <div className="editor-toast-banner">
            <span>{editorToast}</span>
          </div>
        )}

        {isImageFile(activeDoc.name) ? (
          <div className="image-preview-card">
            <ImageIcon size={48} color={theme?.accentHighlight || '#88C0D0'} />
            <h3>Image Artifact File</h3>
            <p>{activeDoc.path}</p>
            <span className="image-note">Binary asset preview generated by Sovereign system</span>
          </div>
        ) : (
          <CodeMirror
            value={activeDoc.content || ''}
            height="100%"
            theme={EditorView.theme({
              '&': {
                height: '100%',
                backgroundColor: theme?.bgEarth || '#0A1118',
                color: theme?.textParchment || '#E6EDF0',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: `${editorFontSizePx || 14}px`
              },
              '.cm-content': {
                caretColor: theme?.accentHighlight || '#88C0D0',
                fontSize: `${editorFontSizePx || 14}px`,
                paddingBottom: 'calc(100vh - var(--visual-viewport-height) + 45px)'
              },
              '&.cm-focused .cm-cursor': {
                borderLeftColor: theme?.accentHighlight || '#88C0D0'
              },
              '.cm-gutters': {
                backgroundColor: theme?.bgCanopy || '#141E26',
                color: theme?.textMuted || '#A3B1B8',
                borderRight: '1px solid ' + (theme?.borderForest || '#2A3B4C')
              },
              '.cm-scroller': {
                overflow: 'auto !important',
                height: '100% !important',
                overscrollBehavior: 'none'
              }
            }, { dark: true })}
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
        <button className="editor-touch-btn" onClick={handleCopyContent} title="Copy All Content">
          <Copy size={14} />
        </button>
        <button className="editor-touch-btn" onClick={handlePasteContent} title="Paste Clipboard Content">
          <Clipboard size={14} />
        </button>
        <button className="editor-touch-btn" onClick={onReturnToTerminal} title="Return to Terminal">
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
