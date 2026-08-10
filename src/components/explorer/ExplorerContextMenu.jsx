import React from 'react';
import {
  Plus, FolderOpen, Terminal, Pencil,
  Scissors, Copy, Clipboard, ClipboardCopy, Files, Archive,
  FolderMinus, Trash2,
} from 'lucide-react';

/**
 * ExplorerContextMenu — long-press / right-click bottom sheet for the file explorer.
 *
 * Props:
 *   visible          {boolean}  Whether the sheet is shown
 *   selectedItems    {string[]} Array of selected item paths
 *   allItems         {object[]} Full directory listing [{name, isDir, path, size}]
 *   clipboardItems   {string[]} Staged clipboard paths
 *   clipboardMode    {string}   'cut' | 'copy' | null
 *   currentPath      {string}   Current directory path
 *   onClose          {fn}       Close the menu
 *   onNew            {fn}       Open the new file/folder modal
 *   onOpen           {fn(path)}
 *   onOpenInTerminal {fn(path)}
 *   onRename         {fn(path)}
 *   onCut            {fn}
 *   onCopy           {fn}
 *   onPaste          {fn}
 *   onDuplicate      {fn(path)}
 *   onCopyName       {fn}       Copy filename(s) as text to system clipboard
 *   onCopyPath       {fn}       Copy full path(s) as text to system clipboard
 *   onCompress       {fn}
 *   onArchive        {fn}
 *   onDelete         {fn}
 */
export default function ExplorerContextMenu({
  visible,
  selectedItems = [],
  allItems = [],
  clipboardItems = [],
  clipboardMode = null,
  onClose,
  onNew,
  onOpen,
  onOpenInTerminal,
  onRename,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onCopyName,
  onCopyPath,
  onCompress,
  onArchive,
  onDelete,
}) {
  if (!visible) return null;

  const anySelected   = selectedItems.length > 0;
  const singleSelected = selectedItems.length === 1;
  const hasClipboard  = clipboardItems.length > 0;

  const singleItem = singleSelected
    ? allItems.find((i) => i.path === selectedItems[0])
    : null;
  const singleIsDir = singleItem?.isDir ?? false;

  const close = (fn) => () => { onClose(); fn && fn(); };
  const closeWith = (fn, arg) => () => { onClose(); fn && fn(arg); };

  return (
    <>
      {/* Backdrop — tap to dismiss */}
      <div className="ctx-backdrop" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="ctx-sheet">
        <div className="ctx-handle" />

        {/* Group 1: Creation — always visible */}
        <div className="ctx-group">
          <button className="ctx-btn" onClick={close(onNew)}>
            <Plus size={16} />
            <span>New</span>
          </button>
        </div>

        {/* Group 2: Single-item ops */}
        {singleSelected && (
          <>
            <div className="ctx-separator" />
            <div className="ctx-group">
              <button className="ctx-btn" onClick={closeWith(onOpen, selectedItems[0])}>
                <FolderOpen size={16} />
                <span>Open</span>
              </button>
              {singleIsDir && (
                <button className="ctx-btn" onClick={closeWith(onOpenInTerminal, selectedItems[0])}>
                  <Terminal size={16} />
                  <span>Open in Terminal</span>
                </button>
              )}
              <button className="ctx-btn" onClick={closeWith(onRename, selectedItems[0])}>
                <Pencil size={16} />
                <span>Rename</span>
              </button>
            </div>
          </>
        )}

        {/* Group 3: Clipboard operations */}
        {(anySelected || hasClipboard) && (
          <>
            <div className="ctx-separator" />
            <div className="ctx-group">
              {anySelected && (
                <>
                  <button className="ctx-btn" onClick={close(onCut)}>
                    <Scissors size={16} />
                    <span>Cut</span>
                  </button>
                  <button className="ctx-btn" onClick={close(onCopy)}>
                    <Copy size={16} />
                    <span>Copy</span>
                  </button>
                </>
              )}
              {hasClipboard && (
                <button className="ctx-btn ctx-btn--accent" onClick={close(onPaste)}>
                  <Clipboard size={16} />
                  <span>
                    Paste Here{clipboardMode === 'cut' ? ' — Move' : ' — Copy'}{' '}
                    ({clipboardItems.length} item{clipboardItems.length !== 1 ? 's' : ''})
                  </span>
                </button>
              )}
              {singleSelected && (
                <button className="ctx-btn" onClick={closeWith(onDuplicate, selectedItems[0])}>
                  <Files size={16} />
                  <span>Duplicate</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Group 4: Text clipboard — Copy Name / Copy Path */}
        {anySelected && (
          <>
            <div className="ctx-separator" />
            <div className="ctx-group">
              <button className="ctx-btn" onClick={close(onCopyName)}>
                <ClipboardCopy size={16} />
                <span>Copy Name</span>
              </button>
              <button className="ctx-btn" onClick={close(onCopyPath)}>
                <Clipboard size={16} />
                <span>Copy Path</span>
              </button>
            </div>
          </>
        )}

        {anySelected && (
          <>
            <div className="ctx-separator" />
            <div className="ctx-group">
              <button className="ctx-btn" onClick={close(onCompress)}>
                <Archive size={16} />
                <span>Compress to ZIP</span>
              </button>
            </div>
          </>
        )}

        {/* Group 5: Destructive */}
        {anySelected && (
          <>
            <div className="ctx-separator" />
            <div className="ctx-group">
              <button className="ctx-btn ctx-btn--danger" onClick={close(onArchive)}>
                <FolderMinus size={16} />
                <span>Archive to Trash</span>
              </button>
              <button className="ctx-btn ctx-btn--danger" onClick={close(onDelete)}>
                <Trash2 size={16} />
                <span>Delete Permanently</span>
              </button>
            </div>
          </>
        )}

        {/* Bottom safe-area spacer for notched phones */}
        <div className="ctx-safe-area" />
      </div>
    </>
  );
}
