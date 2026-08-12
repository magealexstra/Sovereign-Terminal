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
import { Save, GitCommit, Copy, Clipboard, X, FileText, Image as ImageIcon, Eye, Code, WrapText, Wand2, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../hooks/useToast';
import { openSearchPanel, searchKeymap, search } from '@codemirror/search';
import { keymap as cmKeymap } from '@codemirror/view';
import { getFileBrandColor } from '../../utils/fileColors';

// Lightweight Markdown HTML Preview Component
function MarkdownPreview({ content }) {
  if (!content) return <div className="markdown-preview-pane"><p className="preview-p">Empty document.</p></div>;
  
  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${idx}`} className="preview-code-block">
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={idx}>{line.replace('# ', '')}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={idx}>{line.replace('## ', '')}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={idx}>{line.replace('### ', '')}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={idx}>{line.replace(/^[-*]\s+/, '')}</li>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={idx}>{line.replace('> ', '')}</blockquote>);
    } else if (line.trim() === '---') {
      elements.push(<hr key={idx} />);
    } else if (line.trim().length > 0) {
      elements.push(<p key={idx}>{line}</p>);
    }
  });

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre key="code-end" className="preview-code-block">
        <code>{codeBuffer.join('\n')}</code>
      </pre>
    );
  }

  return <div className="markdown-preview-pane">{elements}</div>;
}

export default function CodeEditor({ activeSession, openDocuments, activeFilePath, onSelectTab, onCloseTab, onContentChange, onSaveFile, onGitCommit, onReturnToTerminal, onSaveAs, suggestedSaveDir }) {
  const { theme, editorFontSizePx } = useApp();
  const { toast: editorToast, showToast: triggerToast } = useToast(2000);
  const [closeConfirmModal, setCloseConfirmModal] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(true);
  const pressTimer = useRef(null);
  const editorViewRef = useRef(null);
  const [saveAsModal, setSaveAsModal] = useState(false);
  const [saveAsPath, setSaveAsPath]   = useState('');

  const activeDoc = openDocuments.find((doc) => doc.path === activeFilePath) || openDocuments[0];

  const isMarkdown   = activeDoc?.name?.toLowerCase().endsWith('.md');
  const isVirtualDoc = activeDoc?.virtual === true;

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

  /**
   * Returns true for any file that should never open in the text editor.
   * Covers all viewer-handled types + known binary formats.
   */
  const isBinaryOrMediaFile = (filename) => {
    if (!filename) return false;
    return /\.(png|jpe?g|webp|gif|bmp|ico|tiff?|avif|svg|mp4|webm|mov|mkv|avi|mpg|mpeg|wmv|m4v|flv|3gp|ts|vob|mp3|wav|flac|ogg|m4a|aac|opus|pdf|exe|dll|so|bin|class|pyc|\.o|\.a|dylib|wasm)$/i.test(filename);
  };

  /**
   * Content-based binary detection — fallback for extensionless files.
   * Checks the first 1024 chars for null bytes or high non-printable ratio.
   */
  const isBinaryContent = (content) => {
    if (!content || content.length === 0) return false;
    if (content.includes('\x00')) return true;
    const sample = content.slice(0, 1024);
    const nonPrintable = sample.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code < 9 || (code > 13 && code < 32) || code === 127;
    }).length;
    return nonPrintable / sample.length > 0.15;
  };

  // Touch Bar Action Handlers
  const handleFormatContent = () => {
    if (!activeDoc || !activeDoc.content) return;
    try {
      if (activeDoc.name.endsWith('.json')) {
        const parsed = JSON.parse(activeDoc.content);
        const formatted = JSON.stringify(parsed, null, 2);
        onContentChange(activeDoc.path, formatted);
        triggerToast('JSON Formatted');
      } else {
        const trimmed = activeDoc.content.split('\n').map(l => l.trimEnd()).join('\n');
        onContentChange(activeDoc.path, trimmed);
        triggerToast('Code Formatted');
      }
    } catch (e) {
      triggerToast('Format Error: Invalid Data');
    }
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

  const handleOpenSaveAs = () => {
    const defaultName = (activeDoc?.name || 'inspect').toLowerCase().replace(/\s+/g, '_') + '.txt';
    setSaveAsPath(`${suggestedSaveDir || ''}/${defaultName}`);
    setSaveAsModal(true);
  };

  const handleConfirmSaveAs = () => {
    if (!saveAsPath.trim() || !activeDoc) return;
    onSaveAs(activeDoc.path, saveAsPath.trim(), activeDoc.content || '');
    setSaveAsModal(false);
  };

  if (!activeDoc) {
    return (
      <div className="editor-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '2rem' }}>
        <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-parchment)', fontSize: '1.1rem' }}>No Open Documents</h3>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a file from the Files tab to open it in CodeMirror 6</p>
      </div>
    );
  }

  if (!activeDoc) {
    return (
      <div className="code-editor-workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
          <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-parchment)', fontSize: '1.1rem' }}>No File Selected</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Select a file from the Files tab to open it in CodeMirror 6</p>
        </div>
      </div>
    );
  }

  return (
    <div className="code-editor-workspace">
      {/* Dynamic Multi-Document Tab Bar */}
      <div className="editor-tabs-bar" onContextMenu={(e) => e.preventDefault()}>
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

            >
              {doc.virtual
                ? <Eye size={13} color="var(--text-muted)" />
                : <FileText size={13} color={brandColor} />
              }
              <span className="tab-filename">{doc.name}</span>
              {doc.isModified && <span className="modified-dot" style={{ backgroundColor: brandColor }} title="Unsaved Changes" />}
              <span
                className="close-tab-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (doc.isModified && !doc.virtual) {
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

        {(isBinaryOrMediaFile(activeDoc.name) || isBinaryContent(activeDoc.content)) ? (
          <div className="image-preview-card">
            <FileText size={48} color={theme?.accentHighlight || '#88C0D0'} style={{ opacity: 0.5 }} />
            <h3>Binary File</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>{activeDoc.name}</p>
            <span className="image-note">
              This file cannot be opened as text. Right-click it in the File Manager to download it.
            </span>
          </div>
        ) : isMarkdown && isPreviewMode ? (
          <MarkdownPreview content={activeDoc.content || ''} />
        ) : (
          <CodeMirror
            value={activeDoc.content || ''}
            height="100%"
            onCreateEditor={(view) => { editorViewRef.current = view; }}
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
                paddingBottom: 'calc(100vh - var(--visual-viewport-height) + 45px)',
                userSelect: 'text',
                webkitUserSelect: 'text'
              },
              '.cm-line': {
                userSelect: 'text',
                webkitUserSelect: 'text'
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
              ...(isWordWrap ? [EditorView.lineWrapping] : []),
              search({ top: true }),
              cmKeymap.of(searchKeymap),
            ]}
            onChange={(value) => onContentChange(activeDoc.path, value)}
          />
        )}
      </div>

      {/* Expanded Code Editor Touch Bar */}
      <div className="editor-touch-bar">
        <button
          className="editor-touch-btn save"
          onClick={() => isVirtualDoc ? handleOpenSaveAs() : onSaveFile(activeDoc.path)}
          title={isVirtualDoc ? 'Save buffer as a new file' : 'Save file'}
        >
          <Save size={14} />
          <span>{isVirtualDoc ? 'SAVE AS' : 'SAVE'}</span>
        </button>

        <button
          className="editor-touch-btn commit"
          onClick={() => onGitCommit(activeDoc.path)}
          disabled={isVirtualDoc}
          style={{ opacity: isVirtualDoc ? 0.35 : 1 }}
          title={isVirtualDoc ? 'Save the file first before committing' : 'Save and commit to git'}
        >
          <GitCommit size={14} />
          <span>SAVE &amp; COMMIT</span>
        </button>

        {isMarkdown && (
          <button
            className={`editor-touch-btn ${isPreviewMode ? 'active' : ''}`}
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            title={isPreviewMode ? 'Switch to Source Code' : 'Switch to Markdown Preview'}
          >
            {isPreviewMode ? <Code size={14} /> : <Eye size={14} />}
            <span>{isPreviewMode ? 'SOURCE' : 'PREVIEW'}</span>
          </button>
        )}

        <button
          className={`editor-touch-btn ${isWordWrap ? 'active' : ''}`}
          onClick={() => setIsWordWrap(!isWordWrap)}
          title="Toggle Line Word Wrap"
        >
          <WrapText size={14} />
          <span>WRAP</span>
        </button>

        <button
          className="editor-touch-btn"
          onClick={() => { if (editorViewRef.current) openSearchPanel(editorViewRef.current); }}
          title="Search document (Ctrl+F)"
        >
          <Search size={14} />
          <span>FIND</span>
        </button>

        <button className="editor-touch-btn" onClick={handleFormatContent} title="Auto-Format File / JSON">
          <Wand2 size={14} />
          <span>FORMAT</span>
        </button>

        <button className="editor-touch-btn" onClick={handleCopyContent} title="Copy All Content">
          <Copy size={14} />
        </button>

        <button className="editor-touch-btn" onClick={handlePasteContent} title="Paste Clipboard Content">
          <Clipboard size={14} />
        </button>
      </div>

      {/* Unsaved File Close Check Safeguard Modal */}
      {closeConfirmModal && (
        <div className="explorer-modal-overlay" onClick={() => setCloseConfirmModal(null)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Unsaved Changes</h3>
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

      {saveAsModal && (
        <div className="explorer-modal-overlay" onClick={() => setSaveAsModal(false)}>
          <div className="explorer-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Save Inspect Buffer As</h3>
            <p>Enter the full path for the new file.</p>
            <input
              type="text"
              className="theme-name-field"
              value={saveAsPath}
              onChange={(e) => setSaveAsPath(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder={`${suggestedSaveDir || ''}/output.txt`}
              autoFocus
            />
            <div className="modal-btn-row" style={{ marginTop: '0.75rem' }}>
              <button className="submit" onClick={handleConfirmSaveAs}>
                <Save size={13} />
                <span>Save to Server</span>
              </button>
              <button onClick={() => setSaveAsModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
